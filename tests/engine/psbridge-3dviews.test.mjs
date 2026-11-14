// apps/ps-bridge 2026-11-14 (PS Bridge catch-up, item 8b: the 3D view's View choices and diagram overlays; ui/view3d.js PSB3DUI):
//   1. the close-up of a girder line: geom(P, { strLine: g }) gives the strands of every girder of line g (each span, whatever type is shown),
//      at the same positions as the type-shown strands of the same girder; the default geom(P) is unchanged (the type shown only);
//   2. the diagrams: series(R, d) of each choice is the engine's R.diagrams values at its stations, unchanged (both envelope branches, the unit),
//      for every choice of the View's Diagram list. Display only.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBD, ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl'].map(n => path.join(APP, `engine/${n}.js`)), ...['vizkit', 'strands', 'view3d'].map(n => path.join(APP, `ui/${n}.js`)));
const J = v => JSON.parse(JSON.stringify(v));
function project() {
  const P = W.PSBModel.newProject(); P.spans.lengths = [100, 120]; P.spans.continuity = 'composite'; P.xs.skews = [0, 10, 0]; W.PSBBridge.syncSpans(P);
  P.base.rows = [{ n: 12, y: 2, dbnd: 8, nd: 4 }, { n: 12, y: 4, dbnd: 0, nd: 0 }]; return P;
}
test('3D close-up: the strands of every girder of the line (every span); the default view unchanged', () => {
  const P = project(), G0 = W.PSB3DUI.geom(P), sh = W.PSBBridge.shown(P);
  assert.ok(G0.strands.every(s => W.PSBBridge.typeAt(P, s.s, s.g) === sh.k), 'default: the type shown only');
  [1, 3, 5].forEach(g => {
    const G = W.PSB3DUI.geom(P, { strLine: g }), mine = G.strands.filter(s => s.g === g);
    assert.equal(mine.length, G.strands.length, `G${g}: only its strands`);
    assert.deepEqual(J([...new Set(mine.map(s => s.s))].sort()), [1, 2], `G${g}: in every span`);
    assert.deepEqual(J(G.girders), J(G0.girders), `G${g}: the same girders`);
    // a girder of the type shown on this line: the same strand lines as the default view
    const same = G0.strands.filter(s => s.g === g); if (same.length) [...new Set(same.map(s => s.s))].forEach(s => assert.deepEqual(J(mine.filter(q => q.s === s)), J(same.filter(q => q.s === s)), `G${g} span ${s}: the same strands`));
  });
});
test('3D diagrams: each Diagram choice is the engine\'s R.diagrams at its stations, unchanged', () => {
  const P = project(), c = W.PSBBridge.cells(P)[0], R = W.PSBHoldDown.compute(J(W.PSBDesign.cellInputs(P, c.k, c.g)));
  assert.ok(!R.error); assert.equal(W.PSB3DUI.series(R, 'off'), null);
  W.PSB3DUI.DG.filter(d => d[0] !== 'off').forEach(([k, , hi, lo, u]) => {
    const s = W.PSB3DUI.series(R, k); assert.ok(s, k);
    assert.deepEqual(J(s.x), J(R.diagrams.map(r => r.x)), `${k}: stations`); assert.deepEqual(J(s.hi), J(R.diagrams.map(r => r[hi])), `${k}: ${hi}`);
    if (lo) assert.deepEqual(J(s.lo), J(R.diagrams.map(r => r[lo])), `${k}: ${lo}`); else assert.equal(s.lo, null);
    assert.ok(s.hi.every(v => typeof v === 'number' && isFinite(v)), `${k}: finite`); assert.equal(s.u, u); assert.equal(s.L, R.L);
  });
});
