// Fixtures of the Auto design tests (added 2026-10-30): the 20 recorded projects (5 projects × 4 owners, as tests/projects/sbd2-fat and
// sbd2-loads), as Preliminary sizing has them (plProject, as framing.test.mjs) and as an sbd2 project of this app (sbd2FromPL).
//
// sbd2FromPL(P, rec, M): an sbd2 project with Preliminary sizing project P's spans, skews, girder count and bays, overhangs, deck, materials,
// owner and load modifiers, framing settings and field splices, its plates (one layout for every girder, as Suggest designs it), two plate
// girders (an interior and an exterior, Suggest's "envelope" girder type), and the cross-section loads GirderDetail had for the project
// (the sbd2-loads recording rec: edges, dead load method, sidewalks, median, added rows such as the utilities, wearing surface, SIP forms,
// detail allowance). Not taken over (this app's defaults instead): stiffener, stud, fatigue, cross-frame and splice detail inputs; the deck
// rebar is 1 % of the deck (Preliminary sizing analysis.rebar) in two layers, 2/3 top. The same project carries every design compared, so a
// difference in these inputs affects the legacy design and Auto design alike.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './harness.mjs';

export const OWNERS = ['AASHTO', 'RIDOT', 'MassDOT', 'CTDOT'];
export const PROJECTS = ['builtin', 'builtin28', 'curb', 'util', 'xsA'];
export const RECS = PROJECTS.flatMap(p => OWNERS.map(o => [p, o]));
const J = o => JSON.parse(JSON.stringify(o));

/* the Preliminary sizing project of a recording: built-in (DEFAULT, builtin28 = every skew 28°) or the seed's plateline_autosave_v1 */
export function plProject(pr, owner, DEF) {
  let P;
  if (pr === 'builtin' || pr === 'builtin28') P = J(DEF);
  else { const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/projects/gd', pr + '.json'), 'utf8')); P = JSON.parse(seed.plateline_autosave_v1).data; }
  P.limits.dot = owner; if (pr === 'builtin28') P.bridge.skews = P.bridge.skews.map(() => 28);
  return P;
}
export const loadsRec = (pr, owner) => { const f = path.join(ROOT, 'tests/projects/sbd2-loads', `${pr}_${owner}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };

const num = v => typeof v === 'number' ? v : parseFloat(v);
/* a Preliminary sizing layout { D, web, top, bot: [{ L, b, t }], splices } as sbd2 segments */
export function segsFromLegacy(lay) {
  const run = list => { let x = 0; return list.map(r => { const o = { x0: x, x1: x + num(r.L), b: num(r.b), t: num(r.t) }; x = o.x1; return o; }); };
  const W = run(lay.web), T = run(lay.top), B = run(lay.bot), at = (l, x) => l.find(r => x >= r.x0 - 1e-9 && x < r.x1 - 1e-9) || l[l.length - 1];
  const xs = [...new Set([...W, ...T, ...B].flatMap(r => [+r.x0.toFixed(4), +r.x1.toFixed(4)]))].sort((a, b) => a - b), out = [];
  xs.slice(1).forEach((x, i) => { if (x - xs[i] < 1e-6) return; const m = (xs[i] + x) / 2, w = at(W, m), t = at(T, m), b = at(B, m);
    out.push({ x0: xs[i], x1: x, D: num(lay.D), tw: w.t, topB: t.b, topT: t.t, botB: b.b, botT: b.t }); });
  return out;
}
export function sbd2FromPL(P, rec, M) {
  const B = P.bridge, G = P.girder, p = M.defaultProject(), spans = B.spans.map(num), nb = Math.round(num(B.nb));
  const bays = String(B.bays || '').split(/[\s,;]+/).map(num).filter(v => v > 0), S = num(B.S);
  p.project.name = `${(P.meta || {}).name || 'project'} (${P.limits.dot})`;
  p.spans = { lengths: spans, continuity: B.cont === 'continuous' && spans.length > 1 ? 'continuous' : 'simple' };
  p.materials.steel = { top: G.gF, bot: G.gF, web: G.gW }; p.materials.concrete = { ...p.materials.concrete, fc: num(B.fc), wc: num(B.wc), ...(num(B.wcE) > 0 ? { wcE: num(B.wcE) } : {}) };
  const tsac = num(B.tsac) > 0 ? num(B.tsac) : 0, ts = num(B.ts);
  p.deck = { ...p.deck, ts, tdeck: ts + tsac, haunch: num(B.haunch) };
  p.ownerRules = { owner: P.limits.dot, eta: { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1, ...(B.eta || {}) } };
  p.xs = M.defaultXs(p); const xs = p.xs;
  xs.nb = nb; xs.bays = bays.length === nb - 1 && B.spacing !== 'equal' ? bays : new Array(nb - 1).fill(S); xs.ohL = num(B.ohL); xs.ohR = num(B.ohR); xs.skews = B.skews.map(num);
  xs.sip = num(P.suggest.sip) || 0; xs.ws = { ...xs.ws, mode: 'psf', psf: num(P.suggest.fws) || 0 }; xs.allow = num(P.limits.allow) || 0;
  if (rec && rec.df) { const df = rec.df, dl = df.dl || {};
    if (df.edges) xs.edges = J(df.edges);
    xs.dlMethod = dl.method || xs.dlMethod; xs.extra = J(df.extra || []);
    xs.sidewalks = { L: { w: +dl.swL || 0, t: dl.swThkL != null ? +dl.swThkL : 8, fence: dl.fenceL ?? null, fenceX: dl.fenceXL ?? null }, R: { w: +dl.swR || 0, t: dl.swThkR != null ? +dl.swThkR : 8, fence: dl.fenceR ?? null, fenceX: dl.fenceXR ?? null }, ped: +dl.ped || 0 };
    xs.median = { w: +dl.medW || 0, t: dl.medThk != null ? +dl.medThk : 8, joint: dl.medJoint === 'yes' };
    if (df.bridge) { if (df.bridge.fws != null) xs.ws.psf = +df.bridge.fws; if (df.bridge.sip != null) xs.sip = +df.bridge.sip; if (df.bridge.allow != null) xs.allow = +df.bridge.allow; } }
  const Sx = xs.bays.reduce((a, v) => a + v, 0) / xs.bays.length, oh = Math.max(xs.ohL, xs.ohR), ar = (num((P.analysis || {}).rebar) || 1) / 100;
  const segs = segsFromLegacy({ D: G.D, web: G.web, top: G.top, bot: G.bot });
  const cl = num(P.suggest.cll) || 0;
  p.girders = [['G2', 'interior', Sx, 1], ['G1', 'exterior', Sx / 2 + oh, 0]].map(([id, pos, w, line]) => ({ id, label: id, position: pos, line, beff: +(12 * w).toFixed(4), segments: J(segs),
    loadsManual: { CL: +(cl * w / 1000).toFixed(5) } }));
  const Ar = ar * 12 * Sx * ts; p.deck.rebar = { top: { A: +(Ar * 2 / 3).toFixed(3), c: 2.5 }, bot: { A: +(Ar / 3).toFixed(3), c: 1.75 } };
  const F = P.framing || {};
  p.framing = { ...M.defaultFraming(), spacing: num(F.spacing) || 25, spPier: F.spPier ?? '', pierLen: F.pierLen ?? '', orient: F.orient || 'auto', arrange: F.arrange || 'contiguous',
    supClear: num(F.supClear) || 3, stagMin: num(F.stagMin) || 4, spliceClear: num(P.limits.spliceClear) || 2, tol: num(P.limits.tol) || 0.5, splices: (G.splices || []).map(num) };
  p.stiffeners.layout.doRatio = num(F.doRatio) || 1; p.stiffeners.layout.frames.Lb = num(F.spacing) || 25;
  p.analysis = { crack: (P.analysis || {}).crack || 'none' };
  return p;
}
