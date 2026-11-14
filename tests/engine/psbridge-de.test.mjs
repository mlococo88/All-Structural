// apps/ps-bridge PS-20 (engineer decision 2026-11-13): d_e of each exterior girder line from the bridge cross-section (that line's overhang −
//   the barrier / curb traffic face), each exterior line its own distribution factors, the worst line governs (engine/design.js deOf).
//   1. A project without the cross-section barriers (saved before PR 3a-3): d_e as entered, inputs byte-identical (18 harness B designs).
//   2. Equal overhangs: G1 and G_Nb take the same d_e and give the same results (but their label and side).
//   3. The hand check: overhangs 3 ft / 4 ft, barriers 1.5 ft: d_e 1.5 / 2.5 ft; lever rule, e_M, rigid section, DF_M per line.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBDF, ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck'].map(n => path.join(APP, `engine/${n}.js`)));
const M = W.PSBModel, D = W.PSBDesign;
const J = v => JSON.parse(JSON.stringify(v));
const C = v => typeof v === 'number' ? (Object.is(v, -0) ? '-0' : String(v)) : v === null || typeof v !== 'object' ? (typeof v === 'function' ? '' : JSON.stringify(v))
  : Array.isArray(v) ? '[' + v.map(C).join(',') + ']' : '{' + Object.keys(v).filter(k => typeof v[k] !== 'function').map(k => JSON.stringify(k) + ':' + C(v[k])).join(',') + '}';
const near = (a, b, t) => assert.ok(Math.abs(a - b) < (t || 1e-9), `${a} vs ${b}`);

test('no cross-section barriers (saved before 3a-3): d_e as entered, inputs byte-identical to D.one of the old design (18 designs, every line)', () => {
  for (const [name, P0] of Object.entries(TAB_CASES(() => M.defaultProject()))) {
    const P = M.importJSON(M.exportJSON(P0)).project; W.PSBBridge.fill(P); assert.equal(P.xs.dl, undefined);
    W.PSBBridge.cells(P).forEach(c => { const i = D.cellInputs(P, c.k, c.g); assert.equal(i.loads.de, P0.base.loads.de, `${name} G${c.g}`); assert.equal(D.deOf(P, c.g), null); });
  }
});

test('equal overhangs: G1 and G5 the same d_e and the same results (but the label and the side)', () => {
  const P = M.newProject();
  const a = D.cellInputs(P, 1, 1), b = D.cellInputs(P, 1, 5);
  assert.equal(a.loads.de, 1.5); assert.equal(b.loads.de, 1.5);
  const s = o => { const q = J(o); delete q.proj; return q; };
  assert.equal(JSON.stringify(s(a)), JSON.stringify(s(b)));
  assert.equal(C(Object.assign(W.PSBHoldDown.compute(J(a)), { warns: 0 })), C(Object.assign(W.PSBHoldDown.compute(J(b)), { warns: 0 })));
  assert.equal(D.deOf(P, 3), null, 'an interior line: none');
  assert.equal(D.cellInputs(P, 0, 3).loads.de, P.base.loads.de, 'interior: the entered value, unused');
});

test('hand check: overhangs 3 / 4 ft, barriers 1.5 ft → d_e 1.5 / 2.5 ft; G1 DF_M 0.7778 (rigid), G5 0.8667 (lever); the worst line governs the Exterior type', () => {
  const P = M.newProject(); P.xs.ohR = 4;
  const L = W.PSBHoldDown.compute(J(D.cellInputs(P, 1, 1))), R = W.PSBHoldDown.compute(J(D.cellInputs(P, 1, 5)));
  near(D.deOf(P, 1), 1.5); near(D.deOf(P, 5), 2.5);
  // lever: 1.2 Σ 0.5 (S + x)/S, x = d_e − 2, d_e − 8 (> −S): G1 1.2 (0.5 × 8.5 + 0.5 × 2.5)/9 = 0.73333; G5 1.2 (0.5 × 9.5 + 0.5 × 3.5)/9 = 0.86667
  near(L.df.lever, 1.2 * (0.5 * 8.5 + 0.5 * 2.5) / 9); near(R.df.lever, 1.2 * (0.5 * 9.5 + 0.5 * 3.5) / 9);
  near(L.df.eM, 0.77 + 1.5 / 9.1); near(R.df.eM, 0.77 + 2.5 / 9.1);
  // rigid, 2 lanes: X_ext 18, Σx² 810: G1 Σe = 14.5 + 2.5 = 17 → 0.4 + 18 × 17/810 = 0.77778; G5 Σe = 19 → 0.82222
  near(L.df.rigid, 0.4 + 18 * 17 / 810); near(R.df.rigid, 0.4 + 18 * 19 / 810);
  near(L.dfm, 0.4 + 18 * 17 / 810); near(R.dfm, 1.2 * 13 / 18);
  const A = W.PSBBridge.results(P, i => W.PSBHoldDown.compute(J(i))), ext = A.types.find(t => t.label === 'Exterior S1');
  assert.equal(ext.gov['Flexure'].g, 5, 'the right line governs flexure');
  // the right exterior line in the field note
  assert.match(W.PSBFields.CARDS.find(c => c.id === 'extll').note(P.base, P), /G1 1\.500 ft .* G5 2\.500 ft/);
});
