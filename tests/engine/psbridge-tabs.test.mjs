// apps/ps-bridge PR 2b-2: the worked steps of the Section properties, Loads & LLDF and Analysis tabs (engine/worked.js); PR 2c-1: the
//   Losses and Stresses tabs (engine/worked-stress.js; each step's R path, used by tests/psbridge-compare.mjs, holds the step's value).
//   Each step's value is the engine's (computeAll) value, and the step's expression evaluated from its substituted values reproduces it
//   (the derivation shown is the engine's): every pair agrees to 1e-9 (relative), on several designs (simple / continuous with restraint,
//   interior / exterior, skew ≥ 30°, haunch included, NEXT, box without topping, diaphragms, an owner, entered DF and LL).
//   The steps' TeX is parsed with KaTeX by tex.test.mjs (run last; the harness records every step).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBD, ...['model', 'design', 'fields', 'inputcheck', 'worked', 'worked-stress', 'worked-strength'].map(n => path.join(APP, `engine/${n}.js`)));
const at = (R, p) => p.split('.').reduce((o, k) => o == null ? o : o[k], R);
const STEPS = (inp, R) => ({ section: W.PSBWorked.section(inp, R), loads: W.PSBWorked.loads(inp, R), analysis: W.PSBWorked.analysis(inp, R),
  losses: W.PSBWorkedStress.losses(inp, R), stresses: W.PSBWorkedStress.stresses(inp, R),
  flexure: W.PSBWorkedStrength.flexure(inp, R), shear: W.PSBWorkedStrength.shear(inp, R) });
const CASES = TAB_CASES(() => W.PSBModel.defaultProject());
for (const [name, P] of Object.entries(CASES)) {
  test(`worked steps = engine values: ${name}`, () => {
    assert.deepEqual(JSON.parse(JSON.stringify(W.PSBInputCheck.collect(P).errors.map(e => e.msg))), []);
    const inp = W.PSBDesign.inputs(P), R = W.computeAll(inp); assert.equal(R.error, null);
    let n = 0;
    const ST = STEPS(inp, R);
    for (const f of Object.keys(ST)) {
      const r = ST[f];
      Object.entries(r.paths || {}).forEach(([id, p]) => { const s = r.steps.find(q => q.id === id), v = at(R, p); assert.ok(s, 'path of a step ' + id); assert.ok(Object.is(s.value, v), `${id}: value ${s.value} vs R.${p} ${v}`); });
      if (['losses', 'stresses', 'flexure', 'shear'].includes(f)) assert.ok(Object.keys(r.paths).length >= (f === 'losses' || f === 'stresses' ? 20 : 15), f + ' paths ' + Object.keys(r.paths).length);
      assert.ok(r.steps.length >= 8, f);
      const ids = r.steps.map(s => s.id); assert.equal(new Set(ids).size, ids.length, 'unique ids ' + f);
      r.steps.forEach(s => { if (typeof s.value === 'number') assert.ok(Number.isFinite(s.value), `${s.id} finite`); });
      r.pairs.forEach(p => { n++; const tol = 1e-9 * Math.max(1, Math.abs(p.engine)); assert.ok(Math.abs(p.shown - p.engine) <= tol, `${p.id}: shown ${p.shown} vs engine ${p.engine}`); });
    }
    assert.ok(n >= 100, 'pairs ' + n);
  });
}
test('the step values are the engine\'s own numbers (spot check of paths)', () => {
  const P = CASES['continuous 3 spans, exterior G6 in span 2, skew 35°, restraint, haunch in the section'], inp = W.PSBDesign.inputs(P), R = W.computeAll(inp);
  const v = (f, id) => W.PSBWorked[f](inp, R).steps.find(s => s.id === id).value;
  assert.equal(v('section', 'sec.Ic'), R.cp.Ic); assert.equal(v('section', 'sec.eMid'), R.ss.eMid); assert.equal(v('loads', 'ld.dfm'), R.dfm);
  assert.equal(v('loads', 'ld.skM'), R.df.skM); assert.equal(v('analysis', 'an.pier.Mu'), R.cont.MuN / 12); assert.equal(v('analysis', 'an.restr.B.Mres'), R.cont.restr.B.Mres);
  const mid = R.diagrams.reduce((b, r) => Math.abs(r.x - R.L / 2) < Math.abs(b.x - R.L / 2) ? r : b);
  assert.equal(v('analysis', 'an.MuS'), mid.M_StrI_pos);
});
