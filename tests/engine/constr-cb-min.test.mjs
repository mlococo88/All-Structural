// SBCB (engineer decision 2026-11-10; AASHTO LRFD 10th Ed. 6.10.8.2.3b, C6.10.8.2.3b): C_b for deck placement and the overhang checks is
// not taken below 1.0. Eq. 6.10.8.2.3b-1 with |M| at the quarter points can give less than 1.0 where the flange is in tension over part of
// the unbraced length (0.217 at skewed G1 x = 153 ft); C6.10.8.2.3b gives 1.0 as the base value for a constant moment and allows 1.0 in any
// case, so C_b = max(1.0, Eq. 6.10.8.2.3b-1) wherever C_b is computed (bracingC) or used for LTB (location(), overhang()).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared(...['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'ui/demands.js', 'ui/flexure.js', 'ui/shear.js', 'ui/framing.js', 'ui/splices.js', 'ui/constructibility.js'].map(E)));
const C = W.SBDConstr, near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);
const skewed = () => { const P = W.SBDModel.defaultProject(); P.spans.lengths = [100, 130, 100]; P.xs.skews = [35, 30, 30, 35];
  const pos = { D: 60, tw: 0.5625, topB: 16, topT: 0.75, botB: 18, botT: 1.25 }, neg = { D: 60, tw: 0.5625, topB: 18, topT: 1.5, botB: 18, botT: 2 };
  const segs = () => [{ x0: 0, x1: 80, ...pos }, { x0: 80, x1: 120, ...neg }, { x0: 120, x1: 210, ...pos }, { x0: 210, x1: 250, ...neg }, { x0: 250, x1: 330, ...pos }];
  P.girders = [{ id: 'G1', label: 'G1', position: 'exterior', beff: 102, segments: segs() }, { id: 'G2', label: 'G2', position: 'interior', beff: 114, segments: segs() }];
  P.framing.splices = [70, 165, 260]; return P; };

test('C_b clamped to 1.0: skewed G1 x = 153 ft, negative-moment case (Eq. 6.10.8.2.3b-1 gives 0.217) (SBCB)', () => {
  const R = W.SBDConstrUI.build({ P: skewed(), g: 0, src: 'project' }), r = R.rows.find(q => Math.abs(q.x - 153) < 0.006), n = r.cases.find(q => q.side < 0);
  // Hand check (L_b 130.94–153.46 ft = 270.12 in, top flange 16 × 0.75 in compression: M_c = 1.25(−85.21) + 1.50(86.01) = +22.52 kip-ft):
  //   Eq. 6.10.8.2.3b-1 = 12.5(28.30)/[2.5(28.30) + 3(266.35) + 4(150.83) + 3(52.58)] = 353.75/1630.5 = 0.217 → C_b = max(1.0, 0.217) = 1.0;
  //   r_t = 3.7183 in, L_p = 98.50 in, L_r = 336.24 in: F_nc,LTB = 1.0[1 − 0.3(270.12 − 98.50)/(336.24 − 98.50)](50) = 39.172 ksi;
  //   GS14 buckling (0.235 + 9.38/3)/39.172 = 0.0858. Before: F_nc = 0.217(39.172) = 8.50 ksi, 0.3955, which governed the location.
  near(n.cbParts.Cb0, 0.217, 1e-9, 'Eq. 6.10.8.2.3b-1'); assert.equal(n.CbCu, 1); assert.equal(n.CbC, 1);
  near(n.ltC.Fnc, 39.172, 1e-3, 'F_nc'); near(n.checks.find(c => c.key === 'buckling').ratio, 0.0858, 1e-4, 'GS14 buckling');
  assert.equal(r.side, 1, 'the positive case governs now'); near(r.gov.ratio, 0.3837, 1e-4, 'GS14 yield, positive case');
  const st = n.steps.find(s => s.id === 'cn.Cb'); assert.ok(/gives 0\.217 here, so 1\.0 is used/.test(st.note) && /\\max\\left\(1\.0/.test(st.eq), 'worked: max(1.0, …) and the value before the bound');
});

test('C_b ≥ 1.0 in location() for a given C_b and in the overhang checks (SBCB)', () => {
  const prj = { mat: { Fyt: 50, Fyb: 50, Fyw: 50 }, G: C.factors() }, pl = { D: 60, tw: 0.5, topB: 16, topT: 1, botB: 16, botT: 1 };
  const L = { name: 'x', x: 10, plates: pl, M: { DC1: 1000, DCc: 0, CL: 0 }, V: { DC1: 0, CL: 0 }, LbC: 25, Cb: 1, flC: 2, do: 0, end: false };
  const a = C.location({ ...L, CbC: 0.648 }, prj), b = C.location({ ...L, CbC: 1 }, prj);
  assert.equal(a.CbCu, 1); assert.equal(a.CbRaw, 0.648); assert.equal(a.ltC.Fnc, b.ltC.Fnc); assert.equal(a.amC.fl, b.amC.fl, 'the 6.10.1.6 limit uses the bounded C_b');
  assert.ok(/gives 0\.648 here, so 1\.0 is used/.test(a.steps.find(s => s.id === 'cn.Cb').note));
  const row = { name: 'oh', x: 50, ...pl, Lb: 25, MDC1: 1000, MCL: 0 }, p = { ...C.OH_DEF };
  const o8 = C.overhang([row], { ...p, Cb: 0.8 }, { Fyf: 50, Fyw: 50 }), o1 = C.overhang([row], { ...p, Cb: 1 }, { Fyf: 50, Fyw: 50 });
  assert.equal(o8.Cb, 1); assert.equal(o8.rows[0].Fnc, o1.rows[0].Fnc); assert.ok(/entered 0\.80 raised to 1\.0/.test(o8.rows[0].steps.find(s => s.id === 'oh.LTB').label));
  assert.ok(C.notes(true, true).some(t => /not taken below 1\.0/.test(t) && /C6\.10\.8\.2\.3b/.test(t)));
  assert.ok(!C.notes(true, true).some(t => /used as computed/.test(t)), 'the former open-item note is gone');
});
