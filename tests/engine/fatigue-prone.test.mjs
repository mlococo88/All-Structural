// apps/steel-bridge/engine/fatigue.js: the fatigue-prone check of the MBE 4th Ed. (2026) Art. 7.2.3 (Eq. 7.2.3-1, p. 7-5), FA8 (2026-11-10):
// a detail is evaluated (FA5, FA6) only where 2.2(Δf)_tension > f_dead-load compression, (Δf)_tension the tensile portion of the effective
// stress range of 7.2.2 (R_pR_sγ_II × the unfactored live-load tension at the detail), f_DL,compression the unfactored dead-load compression.
//
// Hand check, default project, this app's analysis, G1, evaluation on with its defaults (a = 58, ADTT_SL 1500, g 2 %, R_s 1.0, n_L 2):
//   "Bottom flange shop transition at 88.00 ft" (Category B, span 1, L = 110 ft): R_p = 0.988 + 6.87e-5(110) + 4.01e-6(1764.71) + 0.0107/2
//   = 1.007983; f_LL,t = 1.34895 ksi (positive fatigue moment, tension); (Δf)_tension = 1.007983(1.0)(0.80)(1.34895) = 1.08777 ksi;
//   2.2(1.08777) = 2.39310 ≤ f_DL,compression = 7.24431 ksi: not fatigue-prone, not evaluated (before: evaluated, FA5 (Δf)_max 7.0942/16 = 0.4434).
//   "Span 1, flange-to-web weld at max. positive range" (B, no dead-load compression): 2.2(1.007983)(0.80)(3.14692) = 5.58280 > 0: evaluated.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const U = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', E('engine/model.js'), E('engine/sections.js'), E('engine/flexure.js'), E('engine/owners.js'), 'lldf.js', E('engine/lldf.js'), E('engine/loads.js'),
  E('engine/shear.js'), E('engine/stiffeners.js'), E('engine/analysis.js'), E('engine/framing.js'), E('engine/crossframes.js'), E('engine/fatigue.js'), E('engine/studs.js'), E('ui/shear.js'), E('ui/flexure.js'), E('ui/fatigue.js'));
const FA = U.SBDFatigue, near = (a, b, t, w) => assert.ok(Math.abs(a - b) <= t, `${w}: ${a} vs ${b}`);

test('MBE 4th Ed. 7.2.3 (FA8): default project with the evaluation on — four bottom-flange transitions over the piers are not fatigue-prone', () => {
  const P = U.SBDModel.defaultProject(); P.fatigue.ev = { ...FA.EV_DEF, on: 'yes' };
  const R = U.SBDFatigueUI.build({ P, g: 0, src: 'analysis' }); assert.ok(!R.err, R.err);
  const r = R.FR.rows.find(q => q.name === 'Bottom flange shop transition at 88.00 ft, G1'), e = r.ev;
  near(e.Rp, 1.007983, 1e-6, 'R_p'); near(e.ft0, 1.34895, 5e-6, 'f_LL,t'); near(e.dft, 1.08777, 5e-6, '(Δf)_tension'); near(2.2 * e.dft, 2.39310, 5e-5, '2.2(Δf)_tension'); near(e.fdc, 7.24431, 5e-6, 'f_DL,c');
  assert.equal(e.prone, false);
  const ck = id => R.FC.find(c => c.id === id);
  assert.ok(ck('FA8').items.find(it => it.step === `fa${r.i}.prone`).loc.includes('not fatigue-prone'));
  const f5 = ck('FA5').items.find(it => it.step === `fa${r.i}.prone`); assert.ok(f5 && f5.r === undefined && /not evaluated/.test(f5.loc));
  const w = R.FR.rows.find(q => q.name === 'Span 1, flange-to-web weld at max. positive range, G1'); near(2.2 * w.ev.dft, 5.58280, 5e-5, 'weld'); assert.equal(w.ev.fdc, 0); assert.ok(w.ev.prone);
  assert.deepEqual(JSON.parse(JSON.stringify(R.FR.rows.filter(q => !q.ev.prone).map(q => q.name))), ['Bottom flange shop transition at 88.00 ft, G1', 'Bottom flange shop transition at 128.00 ft, G1', 'Bottom flange shop transition at 232.00 ft, G1', 'Bottom flange shop transition at 272.00 ft, G1']);
  near(R.faGov.it.r, 0.71135, 5e-5, 'governing fatigue ratio unchanged (FA5, span 3 connection plate)');
  const ids = FA.steps(R.FR, r).map(s => s.id.replace(/^fa\d+\./, '')); assert.ok(ids.includes('prone') && !ids.includes('dfmax'), ids.join());   // stops at FA8
});
test('MBE 4th Ed. 7.2.3 (FA8): entered stresses — a finite-life detail drops out of FA6 when the dead-load compression exceeds 2.2(Δf)_tension', () => {
  // Category E gusset, entered Δf+ = 3, Δf− = 1 ksi; L = 140 ft: R_p = 1.010044; (Δf)_tension = 1.010044(1.0)(0.80)(3) = 2.42411; 2.2 × = 5.33303
  const run = fDL => { const p = JSON.parse(JSON.stringify(FA.DEFAULT)); p.ev = { ...FA.EV_DEF, on: 'yes', L: 140 };
    Object.assign(p.rows[2], { mode: 'S', dfP: 3, dfN: 1, fDL }); const R = FA.compute(p); assert.deepEqual([...R.errors], []); return { R, C: FA.checks(R), r: R.rows[2] }; };
  let q = run(-7);   // 5.33303 ≤ 7: not fatigue-prone
  near(2.2 * q.r.ev.dft, 5.33303, 5e-5, '2.2(Δf)_tension'); assert.equal(q.r.ev.fdc, 7); assert.equal(q.r.ev.prone, false);
  assert.ok(!q.C.find(c => c.id === 'FA6').items.some(it => it.step === 'fa2.life'));
  q = run(-5);       // 5.33303 > 5: fatigue-prone; (Δf)_max = 1.010044(1.75)(4) = 7.07031 > 4.5: finite, FA6 evaluated
  assert.ok(q.r.ev.prone); near(q.r.ev.dfmax, 7.07031, 5e-5, '(Δf)_max'); assert.ok(q.C.find(c => c.id === 'FA6').items.some(it => it.step === 'fa2.life'));
  FA.steps(q.R, q.r);
});
test('MBE 4th Ed. 7.2.3: the evaluation off — no FA8, results as before', () => {
  const P = U.SBDModel.defaultProject(), R = U.SBDFatigueUI.build({ P, g: 0, src: 'analysis' });
  assert.ok(!R.FC.some(c => ['FA5', 'FA6', 'FA8'].includes(c.id)));
});
