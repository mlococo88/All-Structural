// Helpers for tests/engine/analysis.test.mjs: a girderDemands hand-off payload (tests/projects/st/gd_*.json) as an sbd2
// project, with the payload's loads and distribution factors in the fields the loads PR fills (girder.loads, girder.df).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './harness.mjs';

export const STDIR = path.join(ROOT, 'tests/projects/st');
export const payloadFiles = () => fs.readdirSync(STDIR).filter(f => /^gd_.*\.json$/.test(f)).sort();
export const readPayload = f => JSON.parse(fs.readFileSync(path.join(STDIR, f), 'utf8')).payload;

// GirderDetail's node grid (sgBeam) and the payload's stations at the nodes (an interior support has two stations,
// x ∓ 0.001 ft: L = just left, R = just right; elsewhere both are the one station)
export function gdNodes(p) {
  const xs = [0], sup = [0];
  p.member.spans.forEach(L => { const n = Math.max(8, Math.round(L)), h = L / n, x0 = xs[xs.length - 1]; for (let k = 1; k <= n; k++) xs.push(x0 + k * h); sup.push(xs.length - 1); });
  const N = xs.length, at = [], st = p.stations; let j = 0;
  for (let i = 0; i < N; i++) { if (i > 0 && i < N - 1 && sup.includes(i)) { at.push({ i, L: st[j], R: st[j + 1] }); j += 2; } else { at.push({ i, L: st[j], R: st[j] }); j++; } }
  if (j !== st.length) throw new Error(`stations ${st.length} vs nodes ${N}`);
  const trib = xs.map((_, k) => ((k < N - 1 ? xs[k + 1] - xs[k] : 0) + (k > 0 ? xs[k] - xs[k - 1] : 0)) / 2);
  return { xs, sup, N, at, trib };
}
// the zone at x as GirderDetail's saSec finds it (the first zone whose [x0, x1] holds x)
export const zoneAt = (p, x) => p.section.zones.find(z => x >= z.startX - 1e-9 && x <= z.endX + 1e-9) || p.section.zones[p.section.zones.length - 1];
export const steelArea = z => z.topFlange.width * z.topFlange.thickness + z.botFlange.width * z.botFlange.thickness + z.web.depth * z.web.thickness;
export const steelAllow = p => (p.girderDetail.loads.components.find(c => c.id === 'steel') || {}).allowancePct || 0;

// The cross-frame point loads are not in the payload (only their number and total). GirderDetail applies them as node
// loads (gdXfNodal). Each node load is recovered from the jump of V_DC1steel at a node that is not a support:
// F_i = V(element i−1) − V(element i) (GirderDetail's sign) − w_steel(x_i)·trib_i. V is rounded to 0.001 kip, so
// |noise| ≤ 0.001 kip; node loads below 0.003 kip are dropped. Loads on a support do not change M or V (not recovered).
export function recoverXF(p, G) {
  const allow = steelAllow(p), Vr = G.at.map(a => -a.R.V_DC1steel), out = [];
  for (let i = 1; i < G.N - 1; i++) { if (G.sup.includes(i)) continue;
    const w = steelArea(zoneAt(p, G.xs[i])) * 3.4 / 1000 * (1 + allow / 100), F = Vr[i - 1] - Vr[i] - w * G.trib[i];
    if (Math.abs(F) > 0.003) out.push({ x: G.xs[i], P: F }); }
  return out;
}

// sbd2 project (engine/model.js schema) from a payload. o.xf overrides the recovered cross-frame loads; o.crack the cracked zones.
export function projectFromPayload(p, o = {}) {
  const g = p.girderDetail, m = g.materials, dk = g.deck, T = g.loads.totals, G = gdNodes(p), allow = steelAllow(p);
  const xf = o.xf !== undefined ? o.xf : recoverXF(p, G);
  return {
    schema: 'sbd2.project', version: 1, project: { name: p.project, number: '', owner: p.ownerRules.owner, designer: '', checker: '', date: '', notes: '' },
    spans: { lengths: [...p.member.spans], continuity: /continuous/.test(p.notes[0]) ? 'continuous' : 'simple' },
    materials: { steel: { top: m.gradeFlange, bot: m.gradeFlange, web: m.gradeWeb }, Es: m.Es, concrete: { fc: m.fc, wc: m.wc, K1: 1, nRule: 'exact' }, rebar: { Fyr: 60 } },
    deck: { composite: true, ts: dk.ts, tdeck: dk.ts, haunch: dk.haunch, rebar: { top: { A: dk.Ar, c: dk.ts / 2 }, bot: { A: 0, c: 1 } }, rebarInPositiveMp: false },
    analysis: { im: g.im.truck, imf: g.im.fatigue, crack: o.crack || 'none', deflLimit: g.deflection.ll.spans[0].ratio, seq: 'on', seqMod: 'n', seqCustom: '', steelAllowPct: allow,
      haunchInStiffness: p.ownerRules.haunchInProperties !== false },
    girders: [{ id: g.label, label: g.label, position: g.position, beff: dk.beff,
      segments: p.section.zones.map(z => ({ x0: z.startX, x1: z.endX, D: z.web.depth, tw: z.web.thickness, topB: z.topFlange.width, topT: z.topFlange.thickness, botB: z.botFlange.width, botT: z.botFlange.thickness })),
      loads: { DC1wet: T.DC1wet, DC2: T.DC2, DW: T.DW, CL: g.loads.construction ? g.loads.construction.w : 0, UT: T.UT || 0, UF: T.UF || 0, xf, steelAllowPct: allow, source: 'hand-off payload' },
      df: { spans: g.df.spans.map(s => ({ gM: s.gM, gV: s.gV, fatM: s.fatM, fatV: s.fatV })), piers: g.df.piers.map(q => ({ gM: q.gM })), gDef: g.loads.liveLoad.deflectionDF, source: 'hand-off payload' } }]
  };
}

// ---------- comparison ----------
// Each quantity: [name, ours (per node), reference (per node)]; the difference is reported as the largest |ours − ref| and
// that divided by the largest |ref| of the quantity on the girder (rel). Nodes are GirderDetail's grid (stations = nodes).
// skip: node indices left out of the LL moments (where the pier regions differ, see analysis.test.mjs). The pedestrian load
// (M_PL, V_PL: in LL+IM in the payloads of bridges with sidewalks) is taken out of LL+IM: the new engine has no pedestrian load yet.
export function pairsPayload(R, p, G, skip) {
  const A = G.at, N = G.N, L = k => A.map(a => a.L[k] || 0), Rr = k => A.map((a, i) => (i === N - 1 ? a.L : a.R)[k] || 0), sub = (a, b) => a.map((v, i) => v - b[i]);
  const out = [
    ['M_DC1steel', R.st.DC1steel.M, L('M_DC1steel')], ['M_DC1wet', R.st.DC1wet.M, L('M_DC1wet')], ['M_DC1', R.st.DC1.M, L('M_DC1')], ['M_DC2', R.st.DC2.M, L('M_DC2')],
    ['M_DW', R.st.DW.M, L('M_DW')], ['M_CL', R.st.CL.M, L('M_CL')],
    ['V_DC1', R.x.map((_, i) => i === N - 1 ? R.st.DC1.VL[i] : R.st.DC1.VR[i]), Rr('V_DC1').map(v => -v)], ['V_DC2', R.x.map((_, i) => i === N - 1 ? R.st.DC2.VL[i] : R.st.DC2.VR[i]), Rr('V_DC2').map(v => -v)],
    ['V_DW', R.x.map((_, i) => i === N - 1 ? R.st.DW.VL[i] : R.st.DW.VR[i]), Rr('V_DW').map(v => -v)], ['V_CL', R.x.map((_, i) => i === N - 1 ? R.st.CL.VL[i] : R.st.CL.VR[i]), Rr('V_CL').map(v => -v)],
    ['V_DC1 left of piers', G.sup.slice(1, -1).map(i => R.st.DC1.VL[i]), G.sup.slice(1, -1).map(i => -A[i].L.V_DC1)],
    ['D_DC1steel', R.camber.steel, L('D_DC1steel')], ['D_DC1wet', R.camber.wet, L('D_DC1wet')], ['D_DC2DW', R.camber.sd, L('D_DC2DW')]];
  if (R.seq) out.push(['M_DCc', R.seq.MDCc, L('M_DCc')]);
  if (R.ll) {
    const ll = R.ll, ft = R.fat;
    out.push(['M_LLpos', ll.Mpos, sub(L('M_LLpos'), L('M_PLpos')), skip], ['M_LLneg', ll.Mneg, sub(L('M_LLneg'), L('M_PLneg')), skip], ['M_FATpos', ft.Mpos, L('M_FATpos')], ['M_FATneg', ft.Mneg, L('M_FATneg')]);
    const v = (o, s) => R.x.map((_, i) => i === N - 1 ? o['VL' + s][i] : o['VR' + s][i]);
    out.push(['V_LL max', v(ll, 'pos'), sub(Rr('V_LLneg'), Rr('V_PLneg')).map(x => -x)], ['V_LL min', v(ll, 'neg'), sub(Rr('V_LLpos'), Rr('V_PLpos')).map(x => -x)],
      ['V_FAT max', v(ft, 'pos'), Rr('V_FATneg').map(x => -x)], ['V_FAT min', v(ft, 'neg'), Rr('V_FATpos').map(x => -x)],
      ['V_LL max left of piers', G.sup.slice(1, -1).map(i => ll.VLpos[i]), G.sup.slice(1, -1).map(i => -(A[i].L.V_LLneg - (A[i].L.V_PLneg || 0)))],
      ['V_LL min left of piers', G.sup.slice(1, -1).map(i => ll.VLneg[i]), G.sup.slice(1, -1).map(i => -(A[i].L.V_LLpos - (A[i].L.V_PLpos || 0)))],
      ['LL deflection per span', R.lld.map(q => q.d), p.girderDetail.deflection.ll.spans.map(s => s.d)]);
  }
  return out;
}
export function pairsGD(R, D, skip) {
  const N = D.N, sp = D.sup, vr = (o, k) => R.x.map((_, i) => i === N - 1 ? o.VL[i] : o.VR[i]), ge = arr => R.x.map((_, i) => arr[Math.min(i, N - 2)]);
  const out = [
    ['M_DC1steel', R.st.DC1steel.M, D.MS], ['M_DC1wet', R.st.DC1wet.M, D.MDk], ['M_DC2', R.st.DC2.M, D.MDC2], ['M_DW', R.st.DW.M, D.MDW], ['M_CL', R.st.CL.M, D.MCL],
    ['V_DC1', vr(R.st.DC1), ge(D.VDC1)], ['V_DC2', vr(R.st.DC2), ge(D.VDC2)], ['V_DW', vr(R.st.DW), ge(D.VDW)],
    ['R_DC1', R.st.DC1.R, D.reac.map(r => r.DC1)], ['R_DC2', R.st.DC2.R, D.reac.map(r => r.DC2)], ['R_DW', R.st.DW.R, D.reac.map(r => r.DW)], ['R_CL', R.st.CL.R, D.reac.map(r => r.CL)],
    ['D_DC1steel', R.camber.steel, D.dS], ['D_DC1wet', R.camber.wet, D.dDk], ['D_DC2DW', R.camber.sd, D.dSD]];
  if (D.MDCc && R.seq) out.push(['M_DCc', R.seq.MDCc, D.MDCc], ['f_deck (pour sequence)', R.seq.fdk, D.SQ.fdk]);
  if (R.ll) {
    const vs = R.x.map((_, i) => i === N - 1 ? D.vSec(N - 2, false) : D.vSec(i, true)), ll = R.ll, ft = R.fat;
    const v = (o, s) => R.x.map((_, i) => i === N - 1 ? o['VL' + s][i] : o['VR' + s][i]);
    out.push(['M_LLpos', ll.Mpos, D.LLp, skip], ['M_LLneg', ll.Mneg, D.LLn, skip], ['M_FATpos', ft.Mpos, D.FMp], ['M_FATneg', ft.Mneg, D.FMn],
      ['V_LL max', v(ll, 'pos'), vs.map(q => q.Lp)], ['V_LL min', v(ll, 'neg'), vs.map(q => q.Ln)], ['V_FAT max', v(ft, 'pos'), vs.map(q => q.Fp)], ['V_FAT min', v(ft, 'neg'), vs.map(q => q.Fn)],
      ['R_LL max', R.llR.map(r => r.max), D.reac.map(r => r.llMax)], ['R_LL min', R.llR.map(r => r.min), D.reac.map(r => r.llMin)],
      ['LL deflection per span', R.lld.map(q => q.d), D.lld.map(q => q.d)]);
  }
  return out;
}
// statistics over pairs: { name: { abs, rel, at, ours, ref, file } } keeping the largest rel per name
export function diffStats(pairs, stats, file, xs) {
  for (const [name, a, b, skip] of pairs) {
    let sc = 0; b.forEach(v => { sc = Math.max(sc, Math.abs(v)); });
    let mx = 0, at = -1; a.forEach((v, i) => { if (skip && skip.has(i)) return; const d = Math.abs(v - b[i]); if (!(d <= mx)) { mx = d; at = i; } });
    const rel = sc > 0 ? mx / sc : mx, s = stats[name];
    if (!s || rel > s.rel || Number.isNaN(rel)) stats[name] = { abs: mx, rel, at: xs && at >= 0 && xs.length === a.length ? xs[at] : at, ours: a[at], ref: b[at], file, scale: sc };
  }
  return stats;
}
