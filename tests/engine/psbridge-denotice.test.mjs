// apps/ps-bridge PS-23 (engineer decision 2026-11-13; display only): the notice where an exterior line's d_e computed from the bridge
//   cross-section (PS-20, engine/design.js deOf) differs from the d_e entered (engine/design.js deDiff / deText).
//   1. The hand check: overhangs 3 / 4 ft, barriers 1.5 ft, entered d_e 2.0 ft → G1 2.0 → 1.5 ft, G5 2.0 → 2.5 ft.
//   2. Where they match (overhangs 3.5 ft, barriers 1.5 ft, entered 2.0) and with no cross-section barriers (17 harness B designs): no rows.
//   3. A line whose types in different spans have different entered values: one row per entered value, its spans named (where not every span).
//   4. The dismissal key changes with the difference; the computed engine inputs are not changed by deDiff (nothing written to P).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBDF, ...['model', 'rigid', 'holddown', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck'].map(n => path.join(APP, `engine/${n}.js`)));
const M = W.PSBModel, D = W.PSBDesign;
const J = v => JSON.parse(JSON.stringify(v));
const sub = t => `_${t}`;
// PS-24: a new project's entered d_e is the computed one (1.5 ft); these cases model a project whose entered d_e is 2.0 ft (made before PS-24)
const NP = () => { const P = M.newProject(); P.base.loads.de = 2.0; return P; };

test('hand check: overhangs 3 / 4 ft, barriers 1.5 ft, entered d_e 2.0 → G1 2.0 → 1.5 ft, G5 2.0 → 2.5 ft; the DF use the computed value', () => {
  const P = NP(); P.xs.ohL = 3; P.xs.ohR = 4;
  assert.equal(P.base.loads.de, 2.0); assert.equal(P.xs.dl.barL.bw, 1.5); assert.equal(P.xs.dl.barR.bw, 1.5);
  const before = JSON.stringify(P), r = D.deDiff(P);
  assert.equal(JSON.stringify(P), before, 'deDiff writes nothing');
  assert.deepEqual(J(r.rows), [{ g: 1, side: 'left', spans: null, entered: 2, computed: 1.5 }, { g: 5, side: 'right', spans: null, entered: 2, computed: 2.5 }]);
  assert.equal(r.sig, 'G1:2>1.5;G5:2>2.5');
  assert.equal(D.deText(r, sub), "d_e of the exterior girder lines (PS-20): the entered d_e differs from the d_e computed from the bridge cross-section (that side's overhang − the barrier / curb face): G1: entered 2.0 ft, computed 1.5 ft (left overhang); G5: entered 2.0 ft, computed 2.5 ft (right overhang). The live-load distribution factors use the computed d_e.");
  assert.equal(D.cellInputs(P, 1, 1).loads.de, 1.5); assert.equal(D.cellInputs(P, 1, 5).loads.de, 2.5);   // PS-20, unchanged
});

test('where they match, or without the cross-section barriers: no rows (no notice, no Report note)', () => {
  const P = NP(); P.xs.ohL = 3.5; P.xs.ohR = 3.5;   // 3.5 − 1.5 = 2.0 = entered
  assert.deepEqual(J(D.deDiff(P)), { rows: [], sig: '' });
  P.xs.ohR = 3.5 + 1e-12; assert.equal(D.deDiff(P).rows.length, 0, 'within 1e-9 ft');
  for (const [name, P0] of Object.entries(TAB_CASES(() => M.defaultProject()))) {
    const Q = M.importJSON(M.exportJSON(P0)).project; W.PSBBridge.fill(Q); assert.equal(Q.xs.dl, undefined, name);
    assert.deepEqual(J(D.deDiff(Q)), { rows: [], sig: '' }, name);
  }
});

test('different entered values per span on one line: a row per value with its spans; the key follows the difference', () => {
  const P = NP(); P.spans.lengths = [100, 100, 100]; P.xs.skews = [0, 0, 0, 0]; W.PSBBridge.syncSpans(P);
  const ext2 = P.types.findIndex(t => t.span === 2 && t.lines.includes(1)); assert.ok(ext2 >= 0);
  W.PSBBridge.setOvr(P, ext2, Object.assign(J(P.base), { loads: Object.assign(J(P.base.loads), { de: 1.5 }) }));   // span 2 entered 1.5 = computed
  const r = D.deDiff(P);
  assert.deepEqual(J(r.rows), [{ g: 1, side: 'left', spans: [1, 3], entered: 2, computed: 1.5 }, { g: 5, side: 'right', spans: [1, 3], entered: 2, computed: 1.5 }]);
  assert.match(D.deText(r, sub), /G1 \(spans 1, 3\): entered 2\.0 ft, computed 1\.5 ft \(left overhang\); G5 \(spans 1, 3\): entered 2\.0 ft, computed 1\.5 ft/);
  const k0 = r.sig; P.xs.ohL = 3.25; assert.notEqual(D.deDiff(P).sig, k0);
});

test('PS-24: a new project enters the computed d_e (1.5 ft) on every type: no rows (no notice); its results = those with 2.0 entered (every cell)', () => {
  const P = M.newProject(); assert.equal(P.base.loads.de, 1.5); assert.ok(P.types.every(t => !('loads.de' in (t.ovr || {}))));
  assert.deepEqual(J(D.deDiff(P)), { rows: [], sig: '' });
  const Q = J(P); Q.base.loads.de = 2.0;   // the new project before PS-24
  const C = v => JSON.stringify(v, (k, x) => typeof x === 'number' && Object.is(x, -0) ? '-0' : typeof x === 'function' ? undefined : x);
  W.PSBBridge.cells(P).forEach(c => { const a = D.cellInputs(P, c.k, c.g), b = D.cellInputs(Q, c.k, c.g), ext = c.g === 1 || c.g === P.xs.nb;
    if (ext) assert.equal(C(a), C(b), `G${c.g}: identical inputs (the computed d_e either way)`); else { assert.equal(a.loads.de, 1.5); assert.equal(b.loads.de, 2.0); }
    const ra = W.PSBHoldDown.compute(J(a)), rb = W.PSBHoldDown.compute(J(b)); assert.equal(C(ra), C(rb), `G${c.g} S${c.s}: results byte-identical`); });
});
