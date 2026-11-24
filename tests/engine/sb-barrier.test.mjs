// Steel Bridge Design: "Barrier weight from: Geometry" (BARG, 2026-11-24; shared/barrier.js). Checks:
//  - Entered (absent bMode, every project saved before): the loads are the same with and without shared/barrier.js loaded, and an old
//    project's JSON exports byte-identical after import (no default written).
//  - Geometry gives the same DC2 per girder as typing the computed width and weight, with the load at the centroid x̄ (engineer
//    2026-11-24): a rectangle (x̄ = b/2, the entered rule's point too: identical), and a six-point polygon (= typed + the x override x̄).
//  - Hand check (built-in project: 5 girders at 9.5 ft, overhangs 3.25 ft, deck 44.5 ft, MassDOT pile-cap, x̄_girders 22.25 ft, Σc² = 902.5 ft²):
//      left barrier = the six-point polygon, w = 0.41719 klf; G1's share P/N + P e c1/Σc², c1 = −19 ft:
//      before (typed 0.41719 klf, at b/2 = 0.75 ft): e = 0.75 − 22.25 = −21.50, 0.083438 + 0.41719(21.50)(19)/902.5 = 0.083438 + 0.188832 = 0.272270 klf
//      after (geometry, at x̄ = 0.45599 ft):           e = −21.79401,             0.083438 + 0.41719(21.79401)(19)/902.5 = 0.083438 + 0.191414 = 0.274852 klf
//  - JSON round trip of a Geometry project; the UI handler (ui/loads.js onChange) and the field of each geometry message (inputcheck).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const ENG = ['engine/model.js', 'engine/legacy.js', 'engine/sections.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js', 'engine/inputcheck.js', 'ui/loads.js'].map(E);
const W = loadShared('units.js', 'steps.js', 'lldf.js', 'barrier.js', ...ENG);
const W0 = loadShared('units.js', 'steps.js', 'lldf.js', ...ENG);   // without shared/barrier.js
const J = o => JSON.parse(JSON.stringify(o));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const HEX = [[0, 0], [18, 0], [18, 3], [9, 12], [6, 42], [0, 42]];
const run = (Wx, P) => { const { b, p } = Wx.SBDLoads.fromModel(P, { girder: 0 }); return Wx.SBDLoads.compute(b, p); };
const dl = R => J({ dc1: R.dead.dc1, dc2: R.dead.dc2, dw: R.dead.dw, per: R.dead.per.map(L => [L.id, L.x, L.plf, L.dist, L.r]), faces: R.ll, steps: R.dead.steps.map(s => [s.id, s.value, s.sub]) });

test('Entered (absent bMode): the loads with and without shared/barrier.js are the same; an old project exports byte-identical', () => {
  for (const method of ['massdot', 'aashto', 'ridot']) {
    const P = W.SBDModel.defaultProject(); P.xs.dlMethod = method; P.xs.edges.R.bwt = 0.55; P.xs.edges.R.bw = 1.25;
    const P0 = W0.SBDModel.defaultProject(); P0.xs.dlMethod = method; P0.xs.edges.R.bwt = 0.55; P0.xs.edges.R.bw = 1.25;
    assert.deepEqual(dl(run(W, P)), dl(run(W0, P0)), method);
    const P2 = J(P); P2.xs.edges.L.bMode = 'entered'; assert.deepEqual(dl(run(W, P2)), dl(run(W, P)), `${method}: bMode 'entered' = absent`);
    P2.xs.edges.L.bShape = 'rect'; P2.xs.edges.L.bDims = { b: 99, h: 99 }; assert.deepEqual(dl(run(W, P2)), dl(run(W, P)), `${method}: a kept shape is not read in Entered`);
  }
  const M = W.SBDModel, P = M.defaultProject(), txt = M.exportJSON(P), r = M.importJSON(txt);
  assert.equal(r.ok, true); assert.equal(M.exportJSON(r.project), txt); assert.ok(!/bMode|bShape|bDims|bPts|bGam/.test(txt));
  W.SBDUiLoads.ensure(r.project); assert.equal(M.exportJSON(r.project), txt, 'ensure() adds nothing');
});

test('rectangle 12 × 42 in both sides = typing 1.00 ft and 0.525 klf (x̄ = b/2: the same load point); every method', () => {
  for (const method of ['massdot', 'aashto', 'ridot']) {
    const P = W.SBDModel.defaultProject(); P.xs.dlMethod = method;
    const Pe = J(P); ['L', 'R'].forEach(s => { Pe.xs.edges[s].bw = 1; Pe.xs.edges[s].bwt = 0.525; });
    const Pg = J(P); ['L', 'R'].forEach(s => Object.assign(Pg.xs.edges[s], { bMode: 'geom', bShape: 'rect', bDims: { b: 12, h: 42 }, bGam: 0.15 }));
    const Re = run(W, Pe), Rg = run(W, Pg); assert.deepEqual(J(Rg.errors), []);
    Re.dead.dc2.forEach((v, i) => near(Rg.dead.dc2[i], v, 1e-12, `${method} DC2 G${i + 1}`)); Re.dead.dw.forEach((v, i) => near(Rg.dead.dw[i], v, 1e-12, `${method} DW G${i + 1}`));
    Re.dead.per.forEach((L, k) => { near(Rg.dead.per[k].x, L.x, 1e-12, 'x'); near(Rg.dead.per[k].plf, L.plf, 1e-15, 'w'); });
    near(Rg.ll.L.r, 1, 1e-15, 'traffic face = b_deck'); near(Rg.dead.per.find(L => L.id === 'barL').plf, 0.525, 1e-15, '0.525 klf');
  }
});

test('six-point polygon = typed width and weight with the load moved to x̄; hand check of G1 before and after (MassDOT pile-cap)', () => {
  const P = W.SBDModel.defaultProject(), G = W.SharedBarrier.compute(W.SharedBarrier.spec({ bShape: 'poly', bPts: HEX }));
  const Pg = J(P); Object.assign(Pg.xs.edges.L, { bMode: 'geom', bShape: 'poly', bPts: HEX, bGam: 0.15 });
  const Pt = J(P); Object.assign(Pt.xs.edges.L, { bw: G.bDeck, bwt: G.w });   // typed: at b/2 = 0.75 ft
  const Px = J(Pt); Px.xs.overrides = { barL: { x: G.xc } };   // typed + the load at x̄
  const Rg = run(W, Pg), Rt = run(W, Pt), Rx = run(W, Px);
  Rx.dead.dc2.forEach((v, i) => near(Rg.dead.dc2[i], v, 1e-12, `DC2 G${i + 1} = typed at x̄`));
  const g1 = R => R.dead.per.find(L => L.id === 'barL').r[0];
  near(g1(Rt), 0.272270, 5e-7, 'before: at b/2'); near(g1(Rg), 0.274852, 5e-7, 'after: at x̄');
  near(Rg.dead.per.find(L => L.id === 'barL').x, 0.455992509, 1e-9, 'x̄'); near(Rg.dead.xbar, 22.25, 0, 'x̄ girders'); near(Rg.dead.S2, 902.5, 1e-9, 'Σc²');
  // the right edge mirrors: x = W_deck − x̄
  const Pr = J(P); Object.assign(Pr.xs.edges.R, { bMode: 'geom', bShape: 'poly', bPts: HEX, bGam: 0.15 }); near(run(W, Pr).dead.per.find(L => L.id === 'barR').x, 44.5 - G.xc, 1e-12, 'right x');
  // the worked steps (Loads & LLDF tab, DC2 topic; Report): the shoelace and the weight under dl.load.barL
  const ids = Rg.dead.steps.map(s => s.id); for (const id of ['dl.load.barL.geo.S', 'dl.load.barL.geo.A', 'dl.load.barL', 'dl.load.barL.geo.b', 'dl.load.barL.geo.xc']) assert.ok(ids.includes(id), id);
  const dc2re = /^dl\.(xbar|S\d+$|load\.|G\d+\.(barL|barR|ws|DC2|DW)$)/; assert.ok(ids.filter(i => /barL\.geo|load\.barL$/.test(i)).every(i => dc2re.test(i)), 'in the DC2 topic');
  assert.match(Rg.dead.steps.find(s => s.id === 'dl.load.barL').note, /centroid x̄_bar = 0\.456 ft from the left deck edge.*b\/2 = 0\.750 ft/);
});

test('JSON round trip of a Geometry project; the UI handler writes the computed width and weight into bw, bwt', () => {
  const M = W.SBDModel, U = W.SBDUiLoads, P = M.defaultProject(), ch = (path, value) => U.onChange({ dataset: { path, kind: 'x' }, value }, P);
  assert.equal(ch('xs.edges.L.bMode', 'geom'), true);
  assert.deepEqual(J(P.xs.edges.L.bDims), { b: 18, h: null }); assert.equal(P.xs.edges.L.bShape, 'rect'); assert.equal(P.xs.edges.L.bGam, 0.15);
  assert.equal(P.xs.edges.L.bwt, 0.4, 'nothing computed yet: kept');
  ch('xs.edges.L.bDims.b', '12'); ch('xs.edges.L.bDims.h', '42');
  near(P.xs.edges.L.bw, 1, 1e-15, 'bw'); near(P.xs.edges.L.bwt, 0.525, 1e-15, 'bwt');
  ch('xs.edges.L.bShape', 'poly'); assert.deepEqual(J(P.xs.edges.L.bPts), [[0, 0], [12, 0], [12, 42], [0, 42]], 'polygon starts from the rectangle');
  ch('xs.edges.L.bPts', '0,0; 18,0; 18,3; 9,12; 6,42; 0,42'); near(P.xs.edges.L.bwt, 400.5 / 144 * 0.15, 1e-15, 'polygon bwt'); near(P.xs.edges.L.bw, 1.5, 0, 'polygon bw');
  ch('xs.edges.L.bGam', ''); assert.equal(P.xs.edges.L.bGam, null); near(P.xs.edges.L.bwt, 400.5 / 144 * 0.15, 1e-15, 'blank γ = 0.150');
  const txt = M.exportJSON(P), r = M.importJSON(txt); assert.equal(r.ok, true); assert.equal(M.exportJSON(r.project), txt);
  assert.deepEqual(dl(run(W, r.project)), dl(run(W, P)));
  ch('xs.edges.L.bMode', 'entered'); assert.equal(P.xs.edges.L.bMode, 'entered'); near(P.xs.edges.L.bwt, 400.5 / 144 * 0.15, 1e-15, 'the last computed value stays as the typed one');
});

test('geometry errors: blocking, each on its field (input check)', () => {
  const P = W.SBDModel.defaultProject(); Object.assign(P.xs.edges.L, { bMode: 'geom', bShape: 'slope', bDims: { b: 15, h: null }, bGam: 0.15 });
  const R = run(W, P); assert.deepEqual(J(R.errors), ['Left deck edge: the barrier top width must be positive (in).', 'Left deck edge: the barrier height must be positive (in).']);
  assert.deepEqual(J(R.errors.map(m => W.SBDInputCheck.loadsPath(m, P))), ['xs.edges.L.bDims.bt', 'xs.edges.L.bDims.h']);
  Object.assign(P.xs.edges.R, { bMode: 'geom', bShape: 'poly', bPts: [[0, 0], [10, 10], [10, 0], [0, 10]] });
  const m = run(W, P).errors.find(x => /^Right/.test(x)); assert.match(m, /simple polygon/); assert.equal(W.SBDInputCheck.loadsPath(m, P), 'xs.edges.R.bPts');
  const Q = W0.SBDModel.defaultProject(); Object.assign(Q.xs.edges.L, { bMode: 'geom', bShape: 'rect', bDims: { b: 12, h: 42 } });
  assert.match(run(W0, Q).errors[0], /shared\/barrier\.js is not loaded/);
});
