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
