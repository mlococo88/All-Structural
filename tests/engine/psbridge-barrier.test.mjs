// apps/ps-bridge: "Barrier weight from: Geometry" (BARG, 2026-11-24; shared/barrier.js; engine/bridge-dl.js, ui/bridgedl.js). Checks:
//  - Entered (bMode absent, every project saved before, or 'entered'): distribute(), the engine inputs of every line and the checks are the same
//    with and without shared/barrier.js loaded; an old project's file after import exports the same with and without the new code (nothing written).
//  - Geometry = typing the computed width and weight, the DC2 line load at the centroid x̄ (engineer 2026-11-24): a 12 × 42 in rectangle
//    (x̄ = b/2, the entered rule's point: identical), and a six-point polygon = the Steel Bridge app's SBDLoads.dead with the load at x̄.
//  - Hand check (made up: 5 girders at 9.5 ft, overhangs 3.25 ft, deck 44.5 ft, MassDOT pile-cap, x̄_girders 22.25 ft, Σc² = 902.5 ft²; left
//    barrier the six-point polygon, w = 0.41719 klf, right 0.40 klf at 0.75 ft; no sidewalk, no wearing surface): G1's DC2 share of the left
//    barrier before (typed, at b/2 = 0.75 ft) 0.083438 + 0.41719(21.50)(19)/902.5 = 0.272270 klf, after (at x̄ = 0.45599 ft)
//    0.083438 + 0.41719(21.79401)(19)/902.5 = 0.274852 klf; DC2 G1..G5 after 0.354852, 0.259145, 0.163438, 0.253964, 0.344490 klf (= Steel's).
//  - The checks name each geometry field; the UI handler writes the computed weight and width into w, bw; JSON round trip.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const ENG = ['sections', 'model', 'lldf-fg', 'reltension', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck'].map(n => path.join(APP, `engine/${n}.js`));
const W = loadShared('steps.js', 'barrier.js', ...PBDF, ...ENG, path.join(APP, 'ui/bridgedl.js'));
const W0 = loadShared('steps.js', ...PBDF, ...ENG);   // without shared/barrier.js
const S = loadShared('steps.js', 'barrier.js', path.join(ROOT, 'apps/steel-bridge/engine/loads.js'));
const J = v => JSON.parse(JSON.stringify(v));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const HEX = [[0, 0], [18, 0], [18, 3], [9, 12], [6, 42], [0, 42]];
const bridge = (Wx, method) => { const P = Wx.PSBModel.newProject(); P.xs.bays = [9.5, 9.5, 9.5, 9.5]; P.xs.ohL = 3.25; P.xs.ohR = 3.25;
  Object.assign(P.xs.dl, { mode: 'distributed', method, barL: { bw: 1.5, w: 0.4 }, barR: { bw: 1.5, w: 0.4 }, swL: { w: 0, t: 8 }, swR: { w: 0, t: 8 }, fws: 0, extra: [] }); return P; };
const R0 = R => J({ dc2: R.dc2, dw: R.dw, per: R.per.map(L => [L.id, L.x, L.plf, L.dist, L.r]), steps: R.steps.map(s => [s.id, s.value, s.sub, s.label]) });

test('Entered: distribute(), engine inputs and checks the same with and without shared/barrier.js; an old project exports the same', () => {
  for (const method of ['massdot', 'aashto', 'ridot']) {
    const P = bridge(W, method), P0 = bridge(W0, method);
    assert.deepEqual(R0(W.PSBBridgeDL.distribute(P)), R0(W0.PSBBridgeDL.distribute(P0)), method);
    const P2 = J(P); P2.xs.dl.barL.bMode = 'entered'; P2.xs.dl.barL.bShape = 'rect'; P2.xs.dl.barL.bDims = { b: 99, h: 99 };
    assert.deepEqual(R0(W.PSBBridgeDL.distribute(P2)), R0(W.PSBBridgeDL.distribute(P)), `${method}: 'entered' with a kept shape`);
    assert.deepEqual(J(W.PSBBridgeDL.checks(P)), J(W0.PSBBridgeDL.checks(P0)));
  }
  const cases = TAB_CASES(() => W.PSBModel.defaultProject());
  for (const [name, P0] of Object.entries(cases)) {
    const txt = W.PSBModel.exportJSON(P0), r = W.PSBModel.importJSON(txt); assert.equal(W.PSBModel.exportJSON(r.project), W0.PSBModel.exportJSON(W0.PSBModel.importJSON(txt).project), name);   // the same file with and without the new code
    assert.ok(!/bMode|bShape|bDims|bPts|bGam/.test(txt));
    const Q = J(r.project), Q0 = J(r.project); Q.xs.dl = Object.assign(W.PSBBridgeDL.defaults(Q), { mode: 'distributed' }); Q0.xs.dl = Object.assign(W0.PSBBridgeDL.defaults(Q0), { mode: 'distributed' });
    W.PSBBridge.fill(Q); W0.PSBBridge.fill(Q0);
    W.PSBBridge.cells(Q).forEach(c => assert.equal(JSON.stringify(W.PSBDesign.cellInputs(Q, c.k, c.g)), JSON.stringify(W0.PSBDesign.cellInputs(Q0, c.k, c.g)), `${name} G${c.g}/S${c.s}`));
  }
});

test('rectangle 12 × 42 in both sides = typing 0.525 klf and 1.00 ft (x̄ = b/2); every method; the engine inputs take it', () => {
  for (const method of ['massdot', 'aashto', 'ridot']) {
    const Pe = bridge(W, method); ['L', 'R'].forEach(s => Object.assign(Pe.xs.dl['bar' + s], { bw: 1, w: 0.525 }));
    const Pg = bridge(W, method); ['L', 'R'].forEach(s => Object.assign(Pg.xs.dl['bar' + s], { bMode: 'geom', bShape: 'rect', bDims: { b: 12, h: 42 }, bGam: 0.15 }));
    assert.deepEqual(J(W.PSBBridgeDL.checks(Pg)), []);
    const Re = W.PSBBridgeDL.distribute(Pe), Rg = W.PSBBridgeDL.distribute(Pg);
    Re.dc2.forEach((v, i) => near(Rg.dc2[i], v, 1e-12, `${method} DC2 G${i + 1}`)); Re.dw.forEach((v, i) => near(Rg.dw[i], v, 1e-12, 'DW'));
    near(W.PSBBridgeDL.edgeFace(Pg, 'L').f, 1, 1e-15, 'traffic face = b_deck');
    W.PSBBridge.cells(Pg).forEach(c => near(W.PSBDesign.cellInputs(Pg, c.k, c.g).loads.wBar, Rg.dc2[c.g - 1], 0, 'wBar of the line'));
  }
});

test('six-point polygon: = the Steel Bridge app\'s dead() with the load at x̄; hand check G1 before / after (MassDOT pile-cap)', () => {
  const G = W.SharedBarrier.compute(W.SharedBarrier.spec({ bShape: 'poly', bPts: HEX }));
  const Pg = bridge(W, 'massdot'); Object.assign(Pg.xs.dl.barL, { bMode: 'geom', bShape: 'poly', bPts: HEX, bGam: 0.15 });
  const Pt = bridge(W, 'massdot'); Object.assign(Pt.xs.dl.barL, { bw: G.bDeck, w: G.w });   // typed: at b/2
  const Rg = W.PSBBridgeDL.distribute(Pg), Rt = W.PSBBridgeDL.distribute(Pt), g1 = R => R.per.find(L => L.id === 'barL').r[0];
  near(g1(Rt), 0.272270, 5e-7, 'before'); near(g1(Rg), 0.274852, 5e-7, 'after');
  [0.354852, 0.259145, 0.163438, 0.253964, 0.344490].forEach((v, i) => near(Rg.dc2[i], v, 5e-7, `DC2 G${i + 1}`));
  const pos = [0, 9.5, 19, 28.5, 38], R2 = S.SBDLoads.dead({ Nb: 5, OL: 3.25, ts: Rg.ts, fL: 1.5, fR: 1.5 }, { pos, Wdeck: 44.5 },
    { method: 'massdot', ped: 0, swL: 0, swThkL: 8, swR: 0, swThkR: 8, medW: 0, medThk: 0, fws: 0, uwc: Rg.wc, uwcA: null, hh: 0, sip: 0, bf: 0,
      edges: [{ id: 'barL', desc: 'Left barrier', cat: 'DC2', side: 'L', x: G.xc, plf: G.w }, { id: 'barR', desc: 'Right barrier', cat: 'DC2', side: 'R', x: 0.75, plf: 0.4 }], extra: [], ovl: [], ovr: null, bcls: null });
  assert.deepEqual(J(Rg.dc2), J(R2.dc2), 'the same as the steel app at x̄');
  // the worked steps: the shoelace and the weight under dl.load.barL (Loads & LLDF tab, Report)
  const ids = W.PSBBridgeDL.stepsFor(Pg, 1).map(s => s.id);
  for (const id of ['dl.load.barL.geo.S', 'dl.load.barL.geo.A', 'dl.load.barL', 'dl.load.barL.geo.b', 'dl.load.barL.geo.xc', 'dl.G1.barL', 'dl.G1.DC2']) assert.ok(ids.includes(id), id);
  assert.match(Rg.steps.find(s => s.id === 'dl.load.barL').note, /centroid x̄_bar = 0\.456 ft from the left deck edge/);
  near(Rg.steps.find(s => s.id === 'dl.load.barL').value, 400.5 / 144 * 0.15, 0, 'w step');
});

test('checks: each geometry message on its field; UI handler writes the computed weight and width; JSON round trip', () => {
  const P = bridge(W, 'aashto'); Object.assign(P.xs.dl.barL, { bMode: 'geom', bShape: 'slope', bDims: { b: 15, h: null }, bGam: 0.15 });
  assert.deepEqual(J(W.PSBBridgeDL.checks(P)), [{ path: 'xs.dl.barL.bDims.bt', msg: 'Left deck edge: the barrier top width must be positive (in).' }, { path: 'xs.dl.barL.bDims.h', msg: 'Left deck edge: the barrier height must be positive (in).' }]);
  assert.equal(W.PSBBridgeDL.distribute(P), null, 'blocking');
  const Q = bridge(W0, 'aashto'); Object.assign(Q.xs.dl.barL, { bMode: 'geom', bShape: 'rect', bDims: { b: 12, h: 42 } }); assert.match(W0.PSBBridgeDL.checks(Q)[0].msg, /not loaded/);
  const U = W.PSBBridgeDLUI, P2 = bridge(W, 'massdot'), ch = (path, value) => U.onChange({ dataset: { path, dl: 'bgeo' }, value }, P2);
  assert.equal(ch('xs.dl.barR.bMode', 'geom'), true); assert.deepEqual(J(P2.xs.dl.barR.bDims), { b: 18, h: null }); assert.equal(P2.xs.dl.barR.w, 0.4, 'kept until computed');
  ch('xs.dl.barR.bDims.b', '12'); ch('xs.dl.barR.bDims.h', '42'); near(P2.xs.dl.barR.w, 0.525, 1e-15, 'w'); near(P2.xs.dl.barR.bw, 1, 0, 'bw');
  ch('xs.dl.barR.bShape', 'poly'); assert.deepEqual(J(P2.xs.dl.barR.bPts), [[0, 0], [12, 0], [12, 42], [0, 42]]);
  ch('xs.dl.barR.bPts', '0,0; 18,0; 18,3; 9,12; 6,42; 0,42'); near(P2.xs.dl.barR.w, 400.5 / 144 * 0.15, 1e-15, 'polygon w');
  near(W.PSBBridgeDL.distribute(P2).per.find(L => L.id === 'barR').x, 44.5 - 13149 / 2403 / 12, 1e-12, 'right barrier at W − x̄');
  const txt = W.PSBModel.exportJSON(P2), r = W.PSBModel.importJSON(txt); assert.equal(W.PSBModel.exportJSON(r.project), txt);
  assert.deepEqual(R0(W.PSBBridgeDL.distribute(r.project)), R0(W.PSBBridgeDL.distribute(P2)));
  assert.match(U.card(P2), /Barrier weight from[\s\S]*Custom \(polygon\)[\s\S]*readonly[\s\S]*<svg/);
});
