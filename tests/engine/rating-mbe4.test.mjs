// apps/steel-bridge/engine/rating.js: the MBE 4th Ed. (2026) adoptions of 2026-11-10 (engineer standing rule), hand checks on the built-in
// project (this app's analysis, G1):
//   - Service II f_R (Art. 6A.6.4.2.2, p. 6-66): 0.95 F_yf composite (no R_h), 0.80 R_h F_yf noncomposite. Before: 0.95 R_h F_yf composite.
//   - shear (Art. 6A.4.2.4, p. 6-25): φ_s = 1.0 for shear at the Strength limit state, C = φ_c φ_v V_n. Before: φ_c φ_s φ_v V_n. Flexure
//     keeps φ_c φ_s (≥ 0.85).
// Deliberate differences from ST-Girder / GirderDetail (they keep 0.95 R_h F_yf and φ_c φ_s on shear): they show only on a hybrid
// section (R_h < 1) and with φ_s < 1; the 100 gd_* payloads of rating.test.mjs are homogeneous and rated with φ_s = 1.0, so its parity holds.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const U = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', E('engine/model.js'), E('engine/sections.js'), E('engine/flexure.js'), E('engine/owners.js'), 'lldf.js', E('engine/lldf.js'), E('engine/loads.js'),
  E('engine/shear.js'), E('engine/stiffeners.js'), E('engine/analysis.js'), E('engine/fatigue.js'), E('engine/rating.js'), E('engine/framing.js'), E('ui/shear.js'), E('ui/flexure.js'), E('ui/rating.js'));
const RT = U.SBDRating, near = (a, b, t, w) => assert.ok(Math.abs(a - b) <= t, `${w}: ${a} vs ${b}`);
const rate = mod => { const P = U.SBDModel.defaultProject(); if (mod) mod(P); const R = U.SBDRatingUI.build({ P, g: 0, src: 'analysis' }); assert.ok(!R.err, R.err); return R; };
const row = (R, name, key) => R.rows.find(q => q.name === name && q.key === key);

test('MBE 4th Ed. 6A.4.2.4: φ_s = 1.0 on shear, flexure keeps φ_c φ_s (built-in project, x = 109.99 ft)', () => {
  // V_n = 905.410 kip, V_DC = 119.370, V_DW = 14.664, V_LL+IM = 126.194 kip (direction −1)
  // φ_c = φ_s = 1.0 (default): C = 905.410; RF_inv = (905.410 − 1.25(119.370) − 1.50(14.664))/(1.75(126.194)) = 734.200/220.839 = 3.3246 (unchanged)
  const R0 = rate(), q0 = row(R0, 'x = 109.99 ft', 'v');
  near(q0.C, 905.410, 0.001, 'C'); near(q0.inv, 3.3246, 5e-5, 'RF inv'); near(q0.opr, 4.3097, 5e-5, 'RF opr');
  // φ_s = 0.90: before C = 0.90(905.410) = 814.869, RF_inv = 643.659/220.839 = 2.9146; after C = 1.0(905.410), RF_inv = 3.3246
  const R1 = rate(P => { P.rating = { phiC: 1.0, phiS: 0.90 }; }), q1 = row(R1, 'x = 109.99 ft', 'v');
  near(q1.C, 905.410, 0.001, 'C φs 0.90'); near(q1.inv, 3.3246, 5e-5, 'RF inv φs 0.90');
  assert.match(q1.steps.find(s => s.id === 'rt.phiCS').ref, /6A\.4\.2\.4/);
  // flexure keeps φ_cφ_s: x = 316 ft, C = 0.90(9,625.952) = 8,663.356
  near(row(R1, 'x = 316.00 ft', 'mp').C, 8663.356, 0.001, 'flexure C φs 0.90');
  // φ_c = 0.95, φ_s = 0.95: shear C = max(0.95(1.0), 0.85)(905.410) = 860.139 (before 0.9025(905.410) = 817.132)
  const R2 = rate(P => { P.rating = { phiC: 0.95, phiS: 0.95 }; }); near(row(R2, 'x = 109.99 ft', 'v').C, 860.139, 0.001, 'C φc 0.95 φs 0.95');
  assert.equal(RT.phi(0.85, 0.85).vV, 0.85); assert.equal(RT.phi(1, 0.85).vV, 1);
});
test('MBE 4th Ed. 6A.6.4.2.2: Service II f_R = 0.95F_yf composite (no R_h); built-in project and a hybrid web', () => {
  // built-in (homogeneous, R_h = 1.0), top flange at x = 249.99 ft: f_R = 0.95(50) = 47.5 ksi (unchanged); f_DC = 16.764, f_DW = 1.565, f_LL = 10.149 ksi
  // RF_inv = (47.5 − 16.764 − 1.565)/(1.30(10.149)) = 29.171/13.193 = 2.2111; RF_op = 29.171/10.149 = 2.8744
  const q0 = row(rate(), 'x = 249.99 ft', 'svt'); near(q0.C, 47.5, 1e-9, 'f_R'); near(q0.inv, 2.2111, 5e-5, 'RF inv'); near(q0.opr, 2.8744, 5e-5, 'RF opr');
  // Grade 36 web (hybrid, R_h = 0.98526): before f_R = 0.95(0.98526)(50) = 46.800, RF_inv 2.1580; after f_R = 47.5, RF_inv 2.2111
  const q1 = row(rate(P => { P.materials.steel.web = '36'; }), 'x = 249.99 ft', 'svt');
  near(q1.C, 47.5, 1e-9, 'f_R hybrid'); near(q1.inv, 2.2111, 5e-5, 'RF inv hybrid');
  assert.match(q1.steps.find(s => s.id === 'rt.C').note, /without the hybrid factor/);
  assert.match(RT.BASIS.svc, /0\.95F_yf.*0\.80R_hF_yf/);
});
