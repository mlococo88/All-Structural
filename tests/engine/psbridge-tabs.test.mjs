// apps/ps-bridge PR 2b-2: the worked steps of the Section properties, Loads & LLDF and Analysis tabs (engine/worked.js).
//   Each step's value is the engine's (computeAll) value, and the step's expression evaluated from its substituted values reproduces it
//   (the derivation shown is the engine's): every pair agrees to 1e-9 (relative), on several designs (simple / continuous with restraint,
//   interior / exterior, skew ≥ 30°, haunch included, NEXT, box without topping, diaphragms, an owner, entered DF and LL).
//   The steps' TeX is parsed with KaTeX by tex.test.mjs (run last; the harness records every step).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBD, ...['model', 'design', 'fields', 'inputcheck', 'worked'].map(n => path.join(APP, `engine/${n}.js`)));
const base = () => W.PSBModel.defaultProject();
const CASES = {
  'default (BT-72, interior, simple)': base(),
  'continuous 3 spans, exterior G6 in span 2, skew 35°, restraint, haunch in the section': (() => { const P = base(); P.spans = { lengths: [100, 125, 100], continuity: 'composite' };
    P.xs = { nb: 6, bays: [8.5, 8.5, 8.5, 8.5, 8.5], ohL: 2.5, ohR: 3.25, skews: [35, 35, 35, 35] }; P.design = { g: 6, s: 2 }; P.base.cont.restraint = true; P.base.haunchInProps = true; return P; })(),
  'NEXT 36F with a 6 in topping, no draped strands': (() => { const P = base(); P.base.girder = 'NEXT 36F'; P.base.ts = 6; P.xs.bays = [10, 10, 10, 10]; P.base.harp.n = 0; return P; })(),
  'box BIII-36, no topping, debonded row, diaphragm, RIDOT': (() => { const P = base(); P.base.girder = 'AASHTO BIII-36 (27in)'; P.base.ts = 0; P.base.harp.n = 0;
    P.base.rows = [{ n: 12, y: 2, nd: 4, dbnd: 10 }]; P.xs.bays = [3, 3, 3, 3]; P.base.loads.diaph = [{ P: 2, a: 40 }]; P.base.owner = 'RIDOT'; P.base.opt.etaI = true; return P; })(),
  'AASHTO Type IV exterior G1, 85 ft, entered DF, separate deck thickness': (() => { const P = base(); P.base.girder = 'AASHTO Type IV'; P.spans.lengths = [85]; P.design = { g: 1, s: 1 };
    P.base.loads.dfAuto = false; P.base.loads.dfm = 0.65; P.base.loads.dfv = 0.8; P.base.tsSeparate = true; P.base.tsDL = 8.5; P.base.harp.yEnd = 44; return P; })(),
  'entered LL, two continuous spans without restraint, MassDOT': (() => { const P = base(); P.spans = { lengths: [110, 110], continuity: 'composite' }; P.xs.skews = [0, 0, 0]; P.base.owner = 'MassDOT'; return P; })(),
  'simple, entered M_LL / V_LL': (() => { const P = base(); P.base.loads.llAuto = false; P.base.loads.MLL = 2500; P.base.loads.VLL = 110; return P; })()
};
for (const [name, P] of Object.entries(CASES)) {
  test(`worked steps = engine values: ${name}`, () => {
    assert.deepEqual(JSON.parse(JSON.stringify(W.PSBInputCheck.collect(P).errors.map(e => e.msg))), []);
    const inp = W.PSBDesign.inputs(P), R = W.computeAll(inp); assert.equal(R.error, null);
    let n = 0;
    for (const f of ['section', 'loads', 'analysis']) {
      const r = W.PSBWorked[f](inp, R);
      assert.ok(r.steps.length >= 8, f);
      const ids = r.steps.map(s => s.id); assert.equal(new Set(ids).size, ids.length, 'unique ids ' + f);
      r.steps.forEach(s => { if (typeof s.value === 'number') assert.ok(Number.isFinite(s.value), `${s.id} finite`); });
      r.pairs.forEach(p => { n++; const tol = 1e-9 * Math.max(1, Math.abs(p.engine)); assert.ok(Math.abs(p.shown - p.engine) <= tol, `${p.id}: shown ${p.shown} vs engine ${p.engine}`); });
    }
    assert.ok(n >= 40, 'pairs ' + n);
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
