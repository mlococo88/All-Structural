// apps/ps-bridge PR 2b-2: the worked steps of the Section properties, Loads & LLDF and Analysis tabs (engine/worked.js); PR 2c-1: the
//   Losses and Stresses tabs (engine/worked-stress.js; each step's R path, used by tests/psbridge-compare.mjs, holds the step's value);
//   PR 2c-2 Flexure and Shear (engine/worked-strength.js); PR 2d-1 End zone & hold-down and Camber & deflection (engine/worked-end.js);
//   PR 2d-2 Handling, Deck and Rating (engine/worked-hdr.js; Handling and Deck only where their module is on).
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
const W = loadShared('steps.js', ...PBD, ...['sections', 'model', 'lldf-fg', 'holddown', 'pierblock', 'design', 'fields', 'inputcheck', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`)));
const at = (R, p) => p.split('.').reduce((o, k) => o == null ? o : o[k], R);
const STEPS = (inp, R) => ({ section: W.PSBWorked.section(inp, R), loads: W.PSBWorked.loads(inp, R), analysis: W.PSBWorked.analysis(inp, R),
  losses: W.PSBWorkedStress.losses(inp, R), stresses: W.PSBWorkedStress.stresses(inp, R),
  flexure: W.PSBWorkedStrength.flexure(inp, R), shear: W.PSBWorkedStrength.shear(inp, R),
  endzone: W.PSBWorkedEnd.endzone(inp, R), camber: W.PSBWorkedEnd.camber(inp, R),
  handling: W.PSBWorkedHDR.handling(inp, R), deck: W.PSBWorkedHDR.deck(inp, R), rating: W.PSBWorkedHDR.rating(inp, R) });
const CASES = TAB_CASES(() => W.PSBModel.defaultProject());
for (const [name, P] of Object.entries(CASES)) {
  test(`worked steps = engine values: ${name}`, () => {
    assert.deepEqual(JSON.parse(JSON.stringify(W.PSBInputCheck.collect(P).errors.map(e => e.msg))), []);
    const inp = W.PSBDesign.inputs(P), R = W.PSBHoldDown.compute(inp); assert.equal(R.error, null);   // PR 2d-3: + the PS-10 check (engine/holddown.js)
    let n = 0;
    const ST = STEPS(inp, R);
    for (const f of Object.keys(ST)) {
      const r = ST[f];
      Object.entries(r.paths || {}).forEach(([id, p]) => { const s = r.steps.find(q => q.id === id), v = at(R, p); assert.ok(s, 'path of a step ' + id); assert.ok(Object.is(s.value, v), `${id}: value ${s.value} vs R.${p} ${v}`); });
      const off = (f === 'handling' && !R.handling) || (f === 'deck' && !R.deck);
      if (off) { assert.equal(r.steps.length, 0, f + ' off: no steps'); continue; }
      if (['losses', 'stresses', 'flexure', 'shear', 'endzone', 'camber', 'handling', 'deck', 'rating'].includes(f)) assert.ok(Object.keys(r.paths).length >= (f === 'losses' || f === 'stresses' || f === 'handling' || f === 'deck' ? 20 : f === 'endzone' ? 8 : 15), f + ' paths ' + Object.keys(r.paths).length);
      assert.ok(r.steps.length >= 8, f);
      const ids = r.steps.map(s => s.id); assert.equal(new Set(ids).size, ids.length, 'unique ids ' + f);
      r.steps.forEach(s => { if (typeof s.value === 'number') assert.ok(Number.isFinite(s.value), `${s.id} finite`); });
      r.pairs.forEach(p => { n++; const tol = 1e-9 * Math.max(1, Math.abs(p.engine)); assert.ok(Math.abs(p.shown - p.engine) <= tol, `${p.id}: shown ${p.shown} vs engine ${p.engine}`); });
    }
    assert.ok(n >= 100, 'pairs ' + n);
  });
}
test('PR 2d-1: the owner hold-down check worked (MassDOT, default BT-72: F_hd = 94.8 kip > 0.75 W = 74.3 kip)', () => {
  const P = W.PSBModel.defaultProject(); P.base.owner = 'MassDOT'; const inp = W.PSBDesign.inputs(P), R = W.computeAll(inp), E = W.PSBWorkedEnd.endzone(inp, R);
  const v = id => E.steps.find(s => s.id === id).value;
  assert.equal(v('ez.hd.F'), R.own.hd.Ftot); assert.equal(v('ez.hd.lim'), R.own.hd.lim);
  assert.equal(v('ez.hd.F').toFixed(1), '94.8'); assert.equal(v('ez.hd.lim').toFixed(1), '74.3'); assert.equal(v('ez.hd.r').toFixed(3), '1.276');
  assert.ok(!R.ps10 && R.checks.filter(c => /^Hold-down force/.test(c.n)).length === 1, 'MassDOT: the owner rule only (no PS-10 check)');
  const Q = W.PSBModel.defaultProject(); Q.base.opt.hdCheck = false; const iq = W.PSBDesign.inputs(Q), A = W.PSBWorkedEnd.endzone(iq, W.PSBHoldDown.compute(iq));
  assert.ok(A.steps.some(s => s.id === 'ez.slope') && !A.steps.some(s => s.id === 'ez.hd.F'), 'AASHTO, PS-10 box off: slope, no hold-down limit');
});
/* PR 2d-3 (PS-10): the hold-down check for AASHTO / RIDOT, an engine addition (engine/holddown.js); hand check on the default BT-72 (AASHTO):
   tan α = (60 − 8)/(12 × 0.40 × 120) = 0.090278, α = 0.090033 rad, F_str = 202.50 × 0.217 × sin α = 3.9506 kip, F_hd = 2 × 12 × F_str = 94.8 kip;
   L_g = 120 ft, W = 0.825590 × 120 = 99.07 kip, 0.75 W = 74.3 kip; ratio 1.276 (FAIL). */
test('PR 2d-3: PS-10 hold-down check, default BT-72 under AASHTO (hand check 94.8 vs 74.3 kip)', () => {
  const P = W.PSBModel.defaultProject(); assert.equal(P.base.opt.hdCheck, true); assert.equal(P.base.opt.hdFrac, 0.75);
  const inp = W.PSBDesign.inputs(P), R0 = W.computeAll(inp), R = W.PSBHoldDown.compute(inp), h = R.ps10;
  assert.equal(R0.own, undefined); assert.equal(R0.checks.length + 1, R.checks.length, 'one check added');
  assert.deepEqual(JSON.parse(JSON.stringify(R.checks.slice(0, -1))), JSON.parse(JSON.stringify(R0.checks)), 'the engine\'s own checks unchanged');
  const ya = 60, ym = 8, frac = 0.40, L = 120, nh = 12, Ab = 0.217, fpbt = 0.75 * 270;   // the default inputs (harp, strand 0.6 in, f_pbt = 0.75 f_pu)
  assert.equal(inp.harp.yEnd, ya); assert.equal(inp.harp.yMid, ym); assert.equal(inp.harp.frac, frac); assert.equal(inp.harp.n, nh); assert.equal(R.fpbt, fpbt); assert.equal(R.ss.st.Ab, Ab);
  const al = Math.atan((ya - ym) / (12 * frac * L)), F = 2 * nh * fpbt * Ab * Math.sin(al), Wb = R.g.wsw * L, lim = 0.75 * Wb;
  const near = (a, b) => assert.ok(Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
  near(h.alpha, al); near(h.Ftot, F); near(h.W, Wb); near(h.lim, lim);
  assert.equal(h.Ftot.toFixed(1), '94.8'); assert.equal(h.W.toFixed(1), '99.1'); assert.equal(h.lim.toFixed(1), '74.3');
  const c = R.checks.at(-1); assert.equal(c.n, 'Hold-down force (PS-10)'); assert.equal(c.r.toFixed(3), '1.276'); assert.equal(c.pass, false);
  const E = W.PSBWorkedEnd.endzone(inp, R), v = id => E.steps.find(s => s.id === id).value;
  assert.equal(v('ez.hd.F'), h.Ftot); assert.equal(v('ez.hd.lim'), h.lim); assert.equal(v('ez.hd.r'), c.r);
  // editable fraction; RIDOT the same; box off: no check; MassDOT / CTDOT: their own rule, never PS-10
  P.base.opt.hdFrac = 0.9; let Rx = W.PSBHoldDown.compute(W.PSBDesign.inputs(P)); near(Rx.ps10.lim, 0.9 * Wb); assert.ok(Rx.checks.at(-1).r < 1.07 && Rx.checks.at(-1).r > 1.06);
  P.base.owner = 'RIDOT'; Rx = W.PSBHoldDown.compute(W.PSBDesign.inputs(P)); assert.ok(Rx.ps10 && Rx.checks.at(-1).n === 'Hold-down force (PS-10)');
  P.base.opt.hdCheck = false; Rx = W.PSBHoldDown.compute(W.PSBDesign.inputs(P)); assert.ok(Rx.ps10.off && !Rx.checks.some(q => /^Hold-down/.test(q.n)));
  for (const ow of ['MassDOT', 'CTDOT']) { P.base.owner = ow; P.base.opt.hdCheck = true; Rx = W.PSBHoldDown.compute(W.PSBDesign.inputs(P)); assert.ok(!Rx.ps10 && Rx.checks.filter(q => /^Hold-down/.test(q.n)).length === 1, ow); }
  // no draped strands: nothing added
  const N = W.PSBModel.defaultProject(); N.base.harp.n = 0; const Rn = W.PSBHoldDown.compute(W.PSBDesign.inputs(N)); assert.ok(!Rn.ps10 && !Rn.checks.some(q => /^Hold-down/.test(q.n)));
});
test('PR 2d-3: saved data: base.opt.hdCheck / hdFrac default ON / 0.75 for an existing psb2 project without them; a saved value is kept', () => {
  const P = W.PSBModel.defaultProject(); delete P.base.opt.hdCheck; delete P.base.opt.hdFrac;
  const r = W.PSBModel.importJSON(JSON.stringify(P)); assert.ok(r.ok); assert.equal(r.project.base.opt.hdCheck, true); assert.equal(r.project.base.opt.hdFrac, 0.75);
  const Q = W.PSBModel.defaultProject(); Q.base.opt.hdCheck = false; Q.base.opt.hdFrac = 0.6;
  const q = W.PSBModel.importJSON(JSON.stringify(Q)); assert.equal(q.project.base.opt.hdCheck, false); assert.equal(q.project.base.opt.hdFrac, 0.6);
  const old = W.PSBModel.defaultProject(); delete old.base; const o = W.PSBModel.importJSON(JSON.stringify(old)); assert.equal(o.project.base.opt.hdCheck, true);   // a PR 1 project (no base)
  assert.deepEqual(JSON.parse(JSON.stringify(W.PSBInputCheck.collect(r.project).errors)), []);
});
test('the step values are the engine\'s own numbers (spot check of paths)', () => {
  const P = CASES['continuous 3 spans, exterior G6 in span 2, skew 35°, restraint, haunch in the section'], inp = W.PSBDesign.inputs(P), R = W.PSBHoldDown.compute(inp);
  const v = (f, id) => W.PSBWorked[f](inp, R).steps.find(s => s.id === id).value;
  assert.equal(v('section', 'sec.Ic'), R.cp.Ic); assert.equal(v('section', 'sec.eMid'), R.ss.eMid); assert.equal(v('loads', 'ld.dfm'), R.dfm);
  assert.equal(v('loads', 'ld.skM'), R.df.skM); assert.equal(v('analysis', 'an.pier.Mu'), R.cont.MuN / 12); assert.equal(v('analysis', 'an.restr.B.Mres'), R.cont.restr.B.Mres);
  const mid = R.diagrams.reduce((b, r) => Math.abs(r.x - R.L / 2) < Math.abs(b.x - R.L / 2) ? r : b);
  assert.equal(v('analysis', 'an.MuS'), mid.M_StrI_pos);
});
