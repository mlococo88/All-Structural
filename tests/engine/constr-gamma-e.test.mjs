// SBGE (engineer decision 2026-11-10; AASHTO LRFD 10th Ed. 6.10.8.2.3c, C6.10.8.2.3c, App. D6.6): the γ_e of a nonprismatic deck-placement
// unbraced length is passed directly from bracingC() to location() (nprC.gB), not rebuilt at each location as F_e,s/(K f_s) with
// K = f_max/f_x at the nearest station. Regression: where the moment at the nearest station is 0 (f_x ≤ 0, k blank) the former code took
// K = 1, so γ_e = F_e,s/f_s with the tiny stress at the location, and F_nc went up to the yield plateau (unconservative). A hand-made row
// without γ_e and without a usable K takes f_max = max(f_bu,gov, f_s) (conservative, stated in the worked step and the notes).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared('units.js', 'steps.js', ...['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/shear.js', 'engine/constructibility.js'].map(E));
const C = W.SBDConstr, near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);

// One unbraced length 0–20 ft (brace points 0, 20, 40 ft) with a section change at 10 ft; M_DC1 = 4x(80 − x)/2 kip-ft (0 at x = 0), M_CL = 0.
//   small section (0–10 ft): top 12 × 0.625, web 60 × 0.5, bottom 16 × 1.0; large (10–40 ft): top 18 × 1.0, web 60 × 0.5, bottom 18 × 1.25.
//   The step is 50 % of L_b from the brace point with the smaller moment and I_y,top ratio 0.185 < 0.5: nonprismatic (6.10.8.2.3c);
//   the top flange I_y changes by 5.40 > 2.0: App. D6.6.2 Method A not used, the conservative bound.
const xs = Array.from({ length: 41 }, (_, k) => k), Mof = x => 4 * x * (80 - x) / 2, MDC1 = xs.map(Mof), MCL = xs.map(() => 0);
const small = { D: 60, tw: 0.5, topB: 12, topT: 0.625, botB: 16, botT: 1 }, big = { D: 60, tw: 0.5, topB: 18, topT: 1, botB: 18, botT: 1.25 };
const secAt = x => x < 10 ? small : big, prj = { mat: { Fyt: 50, Fyb: 50, Fyw: 50 }, G: C.factors() };
const row = (x, nprC) => { const br = C.bracingC(x, { xs, MDC1, MCL }, { braces: [0, 20, 40], L: 80, secAt, D: 60, sp: 20 });
  return { br, r: C.location({ name: `x = ${x}`, x, plates: secAt(x), M: { DC1: Mof(x), CL: 0 }, V: { DC1: 0, CL: 0 }, LbC: br.LbC, CbC: br.CbC, Cb: 1, nprC: nprC ? nprC(br.nprC) : br.nprC, flC: 0, do: 0, end: false }, prj) }; };

test('γ_e of a nonprismatic deck-placement unbraced length passed directly (SBGE): f_x ≤ 0 at the nearest station no longer gives K = 1', () => {
  // Hand check (conservative bound, App. D6.6; L_b = 20 ft = 240 in; M_c = 1.25M_DC1, largest at x = 20: 1.25(4)(20)(60)/2 = 3000 kip-ft):
  //   small section: A = 16 + 30 + 7.5 = 53.5 in², ȳ = (16(0.5) + 30(31) + 7.5(61.3125))/53.5 = 26.128 in, I = 29,507 in⁴, c_top = 61.625 − 26.128 = 35.497 in;
  //   f_max,small = 3000(12)(35.497)/29,507 = 43.31 ksi; D_c = 35.497 − 0.625 = 34.872 in; r_t = 12/√(12(1 + 34.872(0.5)/(3(12)(0.625)))) = 2.6002 in;
  //   F_e,small = π²(29,000)/(240/2.6002)² = 33.59 ksi; γ_e = 33.59/43.31 = 0.7757 (the large section's ratio is larger).
  //   f_bu,gov (large section at x = 20): ȳ = 29.263 in, I = 46,573 in⁴, c_top = 32.987 in: 3000(12)(32.987)/46,573 = 25.50 ksi.
  //   F_e = 0.7757(25.50) = 19.78 ksi (Eq. 6.10.8.2.3c-2); r_t = (240/π)√(19.78/29,000) = 1.9951 in (Eq. 6.10.8.2.3c-3);
  //   L_r = π(1.9951)√(29,000/35) = 180.4 in < 240 in: F_nc = F_cr = F_e = 19.78 ksi (C_b = 1.0, Eq. 6.10.8.2.3c-1; R_b = R_h = 1.0).
  //   Before (x = 0.30 ft: nearest station x = 0, M = 0, so k blank and K = 1): f_s = 0.863 ksi, γ_e = 33.59/0.863 = 38.93, F_e = 992.7 ksi, F_nc 49.03 ksi.
  for (const x of [0.3, 5, 19.7]) { const { br, r } = row(x), q = r.ltC.npr;
    assert.equal(q.kind, 'ge'); assert.equal(q.gm, 'bound', `x = ${x}: the bound γ_e as passed`);
    near(br.nprC.gB.fm, 43.308, 1e-3, 'f_max,small'); near(br.nprC.gB.rt, 2.6002, 1e-4, 'r_t,small'); near(br.nprC.gB.Fe, 33.59, 0.01, 'F_e,small');
    assert.equal(q.ge, 0.7757); near(q.fbu, 25.498, 1e-3, 'f_bu,gov'); near(q.Fe, 19.779, 1e-3, 'F_e'); near(q.rtE, 1.9951, 1e-4, 'r_t'); near(r.ltC.Fnc, 19.779, 1e-3, `x = ${x} F_nc`); }
  const a = row(0.3); assert.equal(a.br.nprC.k, '', 'f_x = 0 at the nearest station: no K'); near(a.r.ltC.npr.fS, 0.8629, 1e-4, 'f_s');
  const st = a.r.steps.find(s => s.id === 'cn.ge'); assert.ok(st && /f_x ≤ 0 or near 0 here does not enter/.test(st.note), 'the worked γ_e states the rule');
  // A hand-made row without γ_e and without a usable K (k blank): f_max = max(f_bu,gov, f_s) = max(25.50, 0.863) = 25.50 ksi,
  //   γ_e = 33.59/25.50 = 1.3176, F_e = 1.3176(25.50) = 33.59 ksi, r_t = 2.6002 in, L_r = π(2.6002)(28.785) = 235.1 in < 240: F_nc = 33.59 ksi (was 49.03 with K = 1).
  const h = row(0.3, n => { const o = { ...n }; delete o.gB; return o; }), qh = h.r.ltC.npr;
  assert.equal(qh.gm, 'fmax'); near(qh.ge, 33.595 / 25.498, 1e-3, 'γ_e = F_e,s/f_max'); near(h.r.ltC.Fnc, 33.595, 1e-2, 'F_nc');
  assert.ok(C.notes(false).some(t => /f_x ≤ 0/.test(t) && /6\.10\.8\.2\.3c/.test(t)), 'the rule is an in-app note');
});
