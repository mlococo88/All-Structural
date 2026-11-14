// apps/ps-bridge PS-19 (engineer decision 2026-11-13): the exterior girder's rigid cross-section factor (AASHTO LRFD 10th Ed. Eq. C4.6.2.2.2d-1)
//   on the real girder lines with unequal bays (engine/rigid.js, an app-side addition; the moved engine files are not edited).
//   1. Equal bays: no rigidX in the inputs (byte-identical inputs and results); rigidOf on equal positions = the engine's own R (to 1e-12).
//   2. The hand check 8 / 10 / 10 / 8 ft (G1, d_e 2.0 ft, N_L 2): X_ext 18 ft, Σx² 848 ft², R = 0.7821 (engine equal-spacing form 0.7500).
//   3. Interior lines and NEXT unchanged; the moved files untouched (verbatim test, run separately).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBDF, ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck'].map(n => path.join(APP, `engine/${n}.js`)));
const W0 = loadShared('steps.js', ...PBDF, ...['sections', 'model', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck'].map(n => path.join(APP, `engine/${n}.js`)));   // before PS-19 (with PS-35 in both)
const M = W.PSBModel, D = W.PSBDesign, RG = W.PSBRigid;
const J = v => JSON.parse(JSON.stringify(v));
const C = v => typeof v === 'number' ? (Object.is(v, -0) ? '-0' : String(v)) : v === null || typeof v !== 'object' ? (typeof v === 'function' ? '' : JSON.stringify(v))
  : Array.isArray(v) ? '[' + v.map(C).join(',') + ']' : '{' + Object.keys(v).filter(k => typeof v[k] !== 'function').map(k => JSON.stringify(k) + ':' + C(v[k])).join(',') + '}';

test('equal bays: no rigidX, inputs and results byte-identical to before PS-19 (19 harness B designs × every line); the real-position formula = the engine\'s on equal spacing', () => {
  for (const [name, P0] of Object.entries(TAB_CASES(() => M.defaultProject()))) {
    const P = M.importJSON(M.exportJSON(P0)).project, P2 = W0.PSBModel.importJSON(M.exportJSON(P0)).project; W.PSBBridge.fill(P); W0.PSBBridge.fill(P2);
    W.PSBBridge.cells(P).forEach(c => { const a = D.cellInputs(P, c.k, c.g), b = W0.PSBDesign.cellInputs(P2, c.k, c.g);
      assert.equal(a.rigidX, undefined); assert.equal(JSON.stringify(a), JSON.stringify(b), `${name} G${c.g}`);
      if (c.g === 1) assert.equal(C(W.PSBHoldDown.compute(J(a))), C(W0.PSBHoldDown.compute(J(b))), `${name} G1 result`); });
  }
  for (const [nb, S, de, NL] of [[5, 9, 2, 2], [6, 8.5, 1.25, 3], [4, 10, 3.5, 4], [7, 7, -0.5, 2]]) {
    const P = M.newProject(); delete P.xs.dl;   // PS-20: no cross-section barriers → d_e as entered
    P.xs.nb = nb; P.xs.bays = Array(nb - 1).fill(S); P.types = W.PSBBridge.newTypes(P); P.base.loads.de = de; P.base.loads.NL = NL;
    const i = D.cellInputs(P, 1, 1), R = W.computeAll(J(i)), x = Array.from({ length: nb }, (_, j) => j * S), r = RG.rigidOf(x, 1, de, NL);
    assert.ok(Math.abs(r.R - R.df.rigid) < 1e-12 && r.NL === R.df.rigidNL && Math.abs(r.R1 - R.df.rigid1) < 1e-12, `${nb} @ ${S}: ${r.R} vs ${R.df.rigid}`);
  }
});

test('hand check 8 / 10 / 10 / 8 ft, G1 (d_e 2.0, N_L 2): X_ext 18, Σx² 848, R = 0.78208 (engine form 0.75); DF_M of G1 = R; interior lines unchanged', () => {
  const P = M.newProject(); P.xs.bays = [8, 10, 10, 8]; P.xs.dl.barL.bw = 1; P.xs.dl.barR.bw = 1;   // PS-20: d_e = 3 − 1 = 2.0 ft from the cross-section
  const i = D.cellInputs(P, 1, 1); assert.equal(i.loads.de, 2); assert.deepEqual(J(i.rigidX), { x: [0, 8, 18, 28, 36], g: 1 });
  const R = W.PSBHoldDown.compute(J(i)), q = R.df.rigidX, near = (a, b, t) => assert.ok(Math.abs(a - b) < (t || 1e-9), `${a} vs ${b}`);
  near(q.xbar, 18); near(q.Xext, 18); near(q.sumX2, 848);
  // N_L = 1: e = 18 + 2 − 5 = 15; R = 1.2 (1/5 + 18 × 15 / 848) = 0.62208; N_L = 2: Σe = 15 + 3 = 18; R = 1.0 (2/5 + 18 × 18 / 848) = 0.78208
  near(q.trials[0].r, 1.2 * (0.2 + 270 / 848)); near(q.trials[1].r, 0.4 + 324 / 848); near(R.df.rigid, 0.4 + 324 / 848); assert.equal(R.df.rigidNL, 2);
  near(q.engine.rigid, 0.75);   // the engine's equal-spacing form at S = 8 ft: X_ext 16, Σx² 640: 0.4 + 16 × 14 / 640
  near(R.df.dfmRaw, Math.max(R.df.eM * R.df.m2, R.df.lever, 0.4 + 324 / 848)); near(R.dfm, R.df.dfmRaw * R.df.skM);
  assert.equal(R.dfm.toFixed(4), '0.7821'); assert.equal(q.engine.dfm.toFixed(4), '0.7500');
  // the right exterior line G5 (x 36): the same by symmetry; an interior line: no change
  near(W.PSBHoldDown.compute(J(D.cellInputs(P, 1, 5))).df.rigid, 0.4 + 324 / 848);
  const ii = D.cellInputs(P, 0, 3), Ri = W.PSBHoldDown.compute(J(ii)), R0 = W.computeAll(J(ii)); assert.equal(C(Ri.df), C(R0.df));
  // the global distFactors is restored after each run
  assert.equal(W.distFactors.name, 'distFactors');
});
