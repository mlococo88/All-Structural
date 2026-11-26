// apps/ps-bridge batch G8 (2026-11-15): the 3D view's reinforcement cage (ui/view3d.js geom: the old app's Rebar3D items, O:5268-5325) and
//   the 3D capture in the Report (§2). Checked: (1) the cage only for the girders whose strands are drawn (the type shown; a close-up's
//   line); (2) the stirrup stations = the old app's walk (from 3 in, s_end within endZoneLen × L of each ℄ bearing, s_int between, to
//   L − 3 in) and their legs inside the web; two longitudinal top bars end to end; splitN legs within h/4 of each end (a deck slab: the
//   width / 4, bars across the width); (3) the new layers are off at first; (4) a capture given to the Report: a figure in §2 after the plan,
//   a note when the project changed since, links resolved; none without one.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'report.js', ...PBD, ...['sections', 'model', 'rigid', 'lldf-fg', 'reltension', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['inputs', 'vizkit', 'vizalong', 'outkit', 'section', 'loads', 'analysis', 'strands', 'losses', 'stresses', 'flexure', 'shear', 'endzone', 'camber', 'handling', 'deck', 'rating', 'dash', 'summary', 'bridgedl', 'view3d'].map(n => path.join(APP, `ui/${n}.js`)),
  ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
const proj = o => { const P = W.PSBModel.defaultProject(); P.types = W.PSBBridge.newTypes(P); P.xs.dl = W.PSBBridgeDL.defaults(P); if (o) o(P); return P; };

test('G8: the cage of the girders shown: stirrup stations as the old app, legs in the web, two top bars, splitN legs within h/4 of each end', () => {
  const P = proj(), G = W.PSB3DUI.geom(P), sh = G.girders.filter(q => q.shown);
  assert.ok(sh.length >= 1);
  const q = sh[0], op = q.inp.opt, Lin = q.xb - q.xa, eL = op.endZoneLen * q.inp.L * 12, st = [];
  for (let u = 3; u <= Lin - 3;) { st.push(u); u += (u <= eL || u >= Lin - eL) ? op.sEnd : op.sInt; }
  const C = G.cage.filter(c => c.g === q.g && c.s === q.s);
  const stir = C.filter(c => c.kind === 'stir'); assert.equal(stir.length, st.length, 'stations');
  assert.deepEqual(JSON.parse(JSON.stringify(stir.map(c => +(c.pts[0][0] - q.xa).toFixed(6)))), st.map(u => +u.toFixed(6)));
  const wLeg = Math.max(q.gg.bw / 2 - 0.4, 1); assert.ok(stir.every(c => Math.abs(Math.abs(c.pts[0][2] - q.z) - wLeg) < 1e-9 && Math.abs(c.pts[0][1] - (q.yBot + 2)) < 1e-9), 'legs inside the web from 2 in');
  const lon = C.filter(c => c.kind === 'lon'); assert.equal(lon.length, 2); assert.ok(lon.every(c => c.pts[0][0] === q.x0 && c.pts[1][0] === q.x1 && Math.abs(c.pts[0][1] - (q.yBot + q.h - 2)) < 1e-9));
  const spl = C.filter(c => c.kind === 'spl'), nS = Math.round(op.splitN); assert.equal(spl.length, 2 * Math.min(nS, 40));
  assert.ok(spl.every(c => { const u = c.pts[0][0] - q.xa; return (u > 0 && u <= q.h / 4 + 1e-9) || (u < Lin && u >= Lin - q.h / 4 - 1e-9); }), 'within h/4 of each end');
  assert.ok(G.cage.every(c => sh.some(r => r.g === c.g && r.s === c.s)), 'only the girders shown');
  const G2 = W.PSB3DUI.geom(P, { strLine: 1 }); assert.ok(G2.cage.length > 0 && G2.cage.every(c => c.g === 1), 'close-up: its line');
});

test('G8: a voided deck slab: the splitting bars across the width within w/4 of each end', () => {
  const P = proj(P => { P.types.forEach(t => { t.ovr = Object.assign({}, t.ovr, { girder: 'AASHTO SIV-48 (21in)', ts: 6, harp: { n: 0, yEnd: 8, yMid: 4, frac: 0.4 }, rows: [{ n: 10, y: 2, nd: 0, dbnd: 0 }] }); }); P.xs.bays = P.xs.bays.map(() => 4); });
  const G = W.PSB3DUI.geom(P), q = G.girders.find(r => r.shown), spl = G.cage.filter(c => c.g === q.g && c.s === q.s && c.kind === 'spl');
  assert.equal(q.kind, 'deck'); assert.ok(spl.length > 0);
  assert.ok(spl.every(c => Math.abs(c.pts[0][2] - c.pts[1][2]) > q.top - 5 && c.pts[0][0] === c.pts[1][0]), 'across the width');
  const Lin = q.xb - q.xa; assert.ok(spl.every(c => { const u = c.pts[0][0] - q.xa; return u <= q.top / 4 + 1e-9 || u >= Lin - q.top / 4 - 1e-9; }), 'within w/4');
});

test('G8: the new layers off at first (the view as before)', () => {
  const L = Object.fromEntries(W.PSB3DUI.LAY.map(([k, , on]) => [k, on]));
  assert.deepEqual([L.stir, L.lon, L.spl, L.cam, L.sfc], [false, false, false, false, false]);
  assert.deepEqual([L.girder, L.deck, L.str, L.lbl], [true, true, true, true]);
});

test('G8: the 3D capture in the Report §2 (after the framing plan); a note when the project changed; none without one', () => {
  const P = W.PSBModel.defaultProject(), B = W.PSBReportData.compute(P, null), png = 'data:image/png;base64,iVBORw0KGgo=';
  const fig = M => M.sections.find(s => s.id === 'proj').subs.flatMap(s => s.items).filter(it => it.type === 'figure' && /^(Figure [\d.]+: )?3D view/.test(it.caption));
  assert.equal(fig(W.PSBReportBuild.model(B, {})).length, 0);
  let M = W.PSBReportBuild.model(B, { snap3d: { png, at: 'now', key: JSON.stringify(B.P), meta: 'Whole bridge' } }), f = fig(M);
  assert.equal(f.length, 1); assert.ok(f[0].svg.includes(png)); let T = W.SharedReport.text(W.SharedReport.build(M)); assert.ok(!/Captured before the last input change/.test(T));
  assert.deepEqual(JSON.parse(JSON.stringify(W.SharedReport.build(M).unresolved)), []);
  M = W.PSBReportBuild.model(B, { snap3d: { png, at: 'now', key: '{"old":1}', meta: 'Whole bridge' } }); T = W.SharedReport.text(W.SharedReport.build(M));
  assert.ok(/Captured before the last input change/.test(T)); assert.deepEqual(JSON.parse(JSON.stringify(W.SharedReport.build(M).unresolved)), []);
  assert.equal(fig(W.PSBReportBuild.model(B, { snap3d: { png: 'javascript:alert(1)', at: 'x' } })).length, 0, 'only a PNG data URL');
});
