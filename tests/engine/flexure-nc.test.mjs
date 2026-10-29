// apps/steel-bridge/engine/flexure.js, noncomposite girders (prj.deck.composite === false; SB2-O7, engineer's decision
// 2026-10-29). GirderDetail has no noncomposite path, so there is no parity reference. Instead:
//   1. Two hand checks (all arithmetic below): a simple-span doubly symmetric plate girder in positive flexure (App. A6
//      governs) and a monosymmetric section with a slender web in negative flexure (6.10.8; R_b < 1; f_ℓ on both flanges).
//   2. Consistency: noncomposite negative flexure = the existing (composite) negative-flexure path of the same steel section
//      with no deck rebar, at every negative station of the 100 gd_*.json payloads (strength values).
//   3. Consistency: noncomposite positive flexure = noncomposite negative flexure of the same section turned upside down
//      (plates and F_y swapped top <-> bottom, moments negated, f_ℓ swapped) at every station of the payloads: every check.
//   4. Steps: unique ids, no NaN, every check links to a step and cites the 10th Ed.
// The composite results are covered by tests/engine/flexure.test.mjs (GirderDetail parity, unchanged).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const W = loadShared('units.js', 'steps.js', path.join(ROOT, 'apps/steel-bridge/engine/sections.js'), path.join(ROOT, 'apps/steel-bridge/engine/flexure.js'));
const FX = W.SBDFlexure, STEPS = W.SharedSteps;
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
const DIR = path.join(ROOT, 'tests/projects/st');
const payloads = fs.readdirSync(DIR).filter(f => /^gd_.*\.json$/.test(f)).sort();
const readP = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).payload;
const NC = (prj) => ({ ...prj, deck: { ...prj.deck, composite: false } });
const ck = (r, id, key) => r.checks.find(c => c.id === id && c.key === key);

/* ---------- hand check 1: positive flexure, simple span ---------- */
test('hand check: noncomposite simple-span plate girder, positive flexure (14 × 1 flanges, 36 × 1/2 web): App. A6 governs', () => {
  // Steel: flanges 14 × 1 (top and bottom), web 36 × 0.5, F_y = 50 ksi (all plates), d = 38 in. Simple span (cont = false), L_b = 20 ft,
  // C_b = 1.0, no skew, f_ℓ = 0. M_DC1 600, M_DC2 100, M_DW 80, M_LL+IM 700 kip-ft (positive; LL− = 0). Noncomposite: all on the steel.
  // Section: A = 14 + 18 + 14 = 46 in²; ȳ = 19 in (symmetric); I = 2[14(1)³/12 + 14(18.5)²] + 0.5(36)³/12 = 2(1.1667 + 4791.5) + 1944
  //   = 11,529.33 in⁴; S_top = S_bot = 11,529.33/19 = 606.807 in³.
  // Strength I: all moments add to the positive moment -> γ max: M_u = 1.25(600) + 1.25(100) + 1.50(80) + 1.75(700)
  //   = 750 + 125 + 120 + 1225 = 2220 kip-ft. f_bu (top flange, compression) = 2220(12)/606.807 = 43.902 ksi.
  // M_y (D6.2.1) = F_yS_x = 50(606.807)/12 = 2528.36 kip-ft (both flanges).
  // D_c = (d − t_t) − ȳ = 37 − 19 = 18 in (D6.3.1); 2D_c/t_w = 72.
  // R_b (6.10.1.10.2): 72 ≤ λ_rw = 5.7√(29000/50) = 137.27 -> R_b = 1.0.  R_h = 1.0 (homogeneous).
  // A6 permitted (6.10.6.2.3): F_y ≤ 70; a_wc = 2(18)(0.5)/(14·1) = 1.2857, c_rw = 3.1 + 5.0/1.2857 = 6.99 -> 5.7, λ_rw = 137.27 > 72;
  //   I_yc/I_yt = 1.0 ≥ 0.3; skew 0; prismatic -> A6 used (auto).
  // 6.10.8 (computed, not in use): λ_f = 14/2 = 7 ≤ λ_pf = 0.38√580 = 9.152 -> F_nc,FLB = 50.
  //   r_t = 14/√(12(1 + 18(0.5)/(3·14·1))) = 14/√(12 × 1.214286) = 14/3.81725 = 3.66756 in; L_p = 1.1(3.66756)(24.0832) = 97.159 in;
  //   F_yr = 35; L_r = π(3.66756)√(29000/35) = 331.659 in; L_b = 240 in:
  //   F_nc,LTB = [1 − (1 − 35/50)(240 − 97.159)/(331.659 − 97.159)]50 = [1 − 0.3(0.60913)]50 = 40.863 ksi -> ratio 43.902/40.863 = 1.0744.
  // A6: Z = 2(14)(1)(18.5) + 0.5(36)²/4 = 518 + 162 = 680 in³; M_p = 50(680)/12 = 2833.33 kip-ft (bisection, noncomposite, SB2-O1);
  //   D_cp = 18 in. λ_pw(Dcp) = √580/(0.54(2833.33)/2528.36 − 0.09)² = 24.0832/(0.60513 − 0.09)² = 24.0832/0.265357 = 90.755
  //   (≤ λ_rw D_cp/D_c = 137.27) -> 2D_cp/t_w = 72 ≤ 90.755: compact web, R_pc = R_pt = M_p/M_y = 2833.33/2528.36 = 1.12062.
  //   FLB: λ_f = 7 ≤ 9.152 -> M_nc,FLB = R_pcM_yc = 2833.33.
  //   LTB: J = 36(0.5)³/3 + 2(14)(1)³/3(1 − 0.63/14) = 1.5 + 8.9133 = 10.4133 in⁴; h = 37 in; F_yr = min(35, 50(606.8/606.8), 50) = 35;
  //   L_r = 1.95r_t(E/F_yr)√(J/(S_xch))√(1 + √(1 + 6.76(F_yrS_xch/(EJ))²)) = 1.95(3.66756)(828.571)(0.021536)(2.79986) = 357.308 in;
  //   M_nc,LTB = [1 − (1 − 35(606.807)/12/2833.33)(240 − 97.159)/(357.308 − 97.159)]2833.33 = [1 − 0.37534(0.54907)]2833.33 = 2249.41 kip-ft.
  //   GS9 compression: M_u = 2220 ≤ 2249.41 -> ratio 0.98693. Tension: 2220 ≤ R_ptM_yt = 2833.33 -> 0.78353.
  // Service II: M_s = 600 + 100 + 80 + 1.30(700) = 1690; f_f = 1690(12)/606.807 = 33.421 ksi ≤ 0.80R_hF_yf = 40 -> 0.83552 (Eq. 6.10.4.2.2-3).
  //   Web (Eq. -4): D_c = 18, k = 9/(18/36)² = 36, F_crw = 0.9(29000)(36)/72² = 181.25 -> min(R_hF_yc = 50, 50/0.7) = 50; 33.421/50.
  // Constructibility (information): f_bu + f_ℓ = 43.902 ≤ 50 (0.87804); web not slender -> Eq. 6.10.3.2.1-3 not checked; tension 43.902 ≤ 50.
  const prj = { deck: { composite: false, ts: 8, tdeck: 8.5, haunch: 2, rebar: { top: { A: 6.6, c: 2.5 }, bot: { A: 3.2, c: 1.75 } } }, mat: { Fyt: 50, Fyb: 50, Fyw: 50, Fyr: 60, fc: 4 }, n: 8, G: FX.factors(), a6: { method: 'auto', skews: [0] } };
  const L = { name: 'A', region: 'pos', cont: false, plates: { D: 36, tw: 0.5, topB: 14, topT: 1, botB: 14, botT: 1 }, beff: 0, Lb: 20, Cb: 1, fl: 0, flT: 0,
    M: { DC1: 600, DC2: 100, DW: 80, LLp: 700, LLn: 0, FATp: 0, FATn: 0 } };
  const r = FX.location(L, prj);
  close(r.card.s.I, 11529.333333, 1e-9, 'I'); close(r.Mu, 2220, 1e-12, 'M_u'); close(r.fbuC, 43.901931, 1e-7, 'f_bu');
  close(r.yT.My, 2528.3626, 1e-7, 'M_y top'); close(r.yB.My, 2528.3626, 1e-7, 'M_y bottom');
  close(r.Dc, 18, 1e-12, 'D_c'); assert.equal(r.Rb, 1); assert.equal(r.Rh, 1);
  close(r.lt.rt, 3.6675578, 1e-7, 'r_t'); close(r.lt.Lp, 97.159138, 1e-7, 'L_p'); close(r.lt.Lr, 331.65902, 1e-7, 'L_r');
  close(r.lt.FLB, 50, 1e-12, 'F_nc,FLB'); close(r.lt.LTB, 40.863053, 1e-7, 'F_nc,LTB');
  close(ck(r, 'GS7', 'fnc').ratio, 1.0743674, 1e-7, 'GS7 ratio'); assert.equal(ck(r, 'GS7', 'fnc').inUse, false);
  close(r.pl.Mp, 2833.3333, 1e-7, 'M_p'); close(r.Dcp, 18, 1e-7, 'D_cp');
  assert.equal(r.A6.ok, true); assert.equal(r.useA6, true); close(r.A6.lpDcp, 90.755371, 1e-6, 'λ_pw(Dcp)'); assert.equal(r.A6.webCompact, true);
  close(r.A6.Rpc, 1.1206199, 1e-7, 'R_pc'); close(r.A6.J, 10.413333, 1e-7, 'J'); close(r.A6.Lr, 357.30847, 1e-7, 'L_r (A6)');
  close(r.A6.MncF, 2833.3333, 1e-7, 'M_nc,FLB'); close(r.A6.MncL, 2249.4059, 1e-7, 'M_nc,LTB');
  close(ck(r, 'GS9', 'a6c').ratio, 0.98692726, 1e-7, 'GS9 compression'); close(ck(r, 'GS9', 'a6t').ratio, 2220 / 2833.3333, 1e-7, 'GS9 tension');
  assert.equal(r.gov.id, 'GS9'); assert.equal(r.gov.key, 'a6c');
  close(ck(r, 'GS12', 'svt').ratio, 0.83552099, 1e-7, 'Service II top'); close(ck(r, 'GS12', 'svt').capacity, 40, 1e-12, '0.80R_hF_yf');
  close(ck(r, 'GS13', 'web').capacity, 50, 1e-12, 'F_crw'); close(r.webS.k, 36, 1e-9, 'k');
  assert.ok(!ck(r, 'GS5', 'duct').inUse && !ck(r, 'GS6', 'mn').inUse, 'GS5/GS6 n/a for noncomposite');
  const cy = ck(r, 'CN', 'cnY'); close(cy.ratio, 43.901931 / 50, 1e-7, 'constructibility'); assert.equal(cy.inUse, false); assert.ok(!isFinite(ck(r, 'CN', 'cnW').ratio));
  assert.match(STEPS.line(r.steps.find(s => s.id === 'fx.a6c.ok'), false), /≤ 2249\.41/);
});

/* ---------- hand check 2: negative flexure, slender web ---------- */
test('hand check: noncomposite negative flexure, slender web (top 18 × 1.5, web 60 × 7/16, bottom 14 × 1): 6.10.8, R_b < 1, f_ℓ both flanges', () => {
  // Plates: top 18 × 1.5 (tension), web 60 × 0.4375, bottom 14 × 1 (compression); F_y 50; L_b = 18 ft, C_b = 1.3; first-order f_ℓ:
  // bottom 4 ksi, top 2 ksi. M_DC1 −900, M_DC2 −150, M_DW −120, M_LL −800 (LL+ 150) kip-ft. The deck rebar entered is ignored (noncomposite).
  // Section: A = 14 + 26.25 + 27 = 67.25 in²; ȳ = [14(0.5) + 26.25(31) + 27(61.75)]/67.25 = (7 + 813.75 + 1667.25)/67.25 = 36.99628 in;
  //   I = 44,016.92 in⁴; S_bot = I/ȳ = 1189.766, S_top = I/(62.5 − 36.99628) = 1725.902 in³.
  // M_u = 1.25(−900) + 1.25(−150) + 1.50(−120) + 1.75(−800) = −1125 − 187.5 − 180 − 1400 = −2892.5 kip-ft.
  //   f_bu (bottom, compression) = 2892.5(12)/1189.766 = 29.1738 ksi; tension (top) = 2892.5(12)/1725.902 = 20.1112 ksi.
  // D_c = ȳ − t_b = 35.99628 in; 2D_c/t_w = 164.554; a_wc = 2(35.99628)(0.4375)/(14·1) = 2.24977; c_rw = 3.1 + 5.0/2.24977 = 5.3225
  //   (4.6 ≤ c_rw ≤ 5.7); λ_rw = 5.3225√(29000/50) = 5.3225(24.0832) = 128.182 (Eqs. 6.10.1.10.2-5, -8; SB2-O6, 2026-10-29);
  //   R_b = 1 − 2.24977/(1200 + 300(2.24977))(164.554 − 128.182) = 1 − 0.0011999(36.373) = 0.95636.
  //   (Before SB2-O6, λ_rw = 5.7√(E/F_yc) = 137.274: R_b = 1 − 0.0011999(27.280) = 0.96727, F_nc = 48.363, GS7 0.63760.)
  // A6 (6.10.6.2.3): λ_rw = 128.182 ≤ 164.554 -> slender web: not permitted; 6.10.8.
  //   I_yc/I_yt = 1(14)³/(1.5(18)³) = 2744/8748 = 0.3137.
  // FLB: λ_f = 7 ≤ 9.152 -> F_nc,FLB = R_bR_hF_yc = 0.95636(50) = 47.818 ksi.
  // LTB: r_t = 14/√(12(1 + 35.99628(0.4375)/(3·14·1))) = 3.44661 in; L_p = 1.1(3.44661)(24.0832) = 91.306 in; L_r = π(3.44661)(28.7849) = 311.679 in;
  //   L_b = 216 in: C_b[1 − 0.3(216 − 91.306)/(311.679 − 91.306)]R_bR_hF_yc = 1.3(0.83026)(47.818) > 47.818 -> F_nc,LTB = 47.818.
  // f_ℓ amplification (6.10.1.6): F_cr = 1.3(0.95636)π²(29000)/(216/3.44661)² = 90.6019 ksi; limit 1.2L_p√(C_bR_b/(f_bu/F_yc))
  //   = 1.2(91.306)√(1.3(0.95636)/(29.1738/50)) = 159.937 in < 216 -> AF = 0.85/(1 − 29.1738/90.6019) = 1.25369 -> f_ℓ = 5.01475 ksi.
  // GS7: 29.1738 + 5.01475/3 = 30.8454 ≤ 47.818 -> 0.64506.  GS8 (Eq. 6.10.8.1.2-1): 20.1112 + 2/3 = 20.7779 ≤ R_hF_yt = 50 -> 0.41556.
  // GS10: bottom 5.01475 ≤ 30, top 2 ≤ 30.
  // Service II: M_s = −900 − 150 − 120 + 1.30(−800) = −2210; bottom 2210(12)/1189.766 = 22.2901 + 4/2 = 24.2901 ≤ 0.80(50) = 40 -> 0.60725;
  //   top 2210(12)/1725.902 = 15.3659 + 2/2 = 16.3659 -> 0.40915. Web: k = 9/(35.99628/60)² = 25.0052,
  //   F_crw = 0.9(29000)(25.0052)/(137.143)² = 34.6995 ksi; f_c = 22.2901 -> 0.64237.
  // Constructibility (information): f_bu + f_ℓ = 29.1738 + 5.0147 = 34.1886 ≤ 50; slender web -> f_bu = 29.1738 ≤ F_crw = 34.6995 (0.84075);
  //   tension 20.1112 + 2 = 22.1112 ≤ 50.
  const prj = { deck: { composite: false, ts: 8, tdeck: 8.5, haunch: 2, rebar: { top: { A: 6.6, c: 2.5 }, bot: { A: 3.2, c: 1.75 } } }, mat: { Fyt: 50, Fyb: 50, Fyw: 50, Fyr: 60, fc: 4 }, n: 8, G: FX.factors(), a6: { method: 'auto', skews: [0] } };
  const L = { name: 'B', region: 'neg', cont: true, plates: { D: 60, tw: 0.4375, topB: 18, topT: 1.5, botB: 14, botT: 1 }, beff: 100, Lb: 18, Cb: 1.3, fl: 4, flT: 2,
    M: { DC1: -900, DC2: -150, DW: -120, LLp: 150, LLn: -800, FATp: 0, FATn: 0 } };
  const r = FX.location(L, prj);
  close(r.card.cr.yb, 36.996283, 1e-7, 'ȳ (no rebar)'); close(r.Mu, -2892.5, 1e-12, 'M_u'); close(r.fbuC, 29.173806, 1e-7, 'f_bu'); close(r.tF.f, 20.111224, 1e-7, 'f_t');
  close(r.Dc, 35.996283, 1e-7, 'D_c'); close(r.Rb, 0.9563555, 1e-7, 'R_b'); close(r.rb.lrw, 128.18161, 1e-7, 'λ_rw (R_b, c_rw)');
  assert.equal(r.A6.ok, false); assert.equal(r.useA6, false); close(r.A6.lrwP, 128.18161, 1e-7, 'λ_rw (A6)'); assert.ok(r.A6.why.some(s => /slender/.test(s)));
  close(r.lt.FLB, 47.817775, 1e-7, 'F_nc,FLB'); close(r.lt.rt, 3.4466103, 1e-7, 'r_t'); close(r.lt.LTB, 47.817775, 1e-7, 'F_nc,LTB');
  close(r.lt.Fcr, 90.601901, 1e-7, 'F_cr'); close(r.am.AF, 1.2536872, 1e-6, 'AF'); close(r.am.fl, 5.0147488, 1e-7, 'f_ℓ amplified');
  close(ck(r, 'GS7', 'fnc').ratio, 0.64506115, 1e-7, 'GS7'); close(ck(r, 'GS8', 'fnt').ratio, 0.4155578, 1e-7, 'GS8');
  close(ck(r, 'GS10', 'fl').demand, 5.0147488, 1e-7, 'GS10 bottom'); close(ck(r, 'GS10', 'flT').demand, 2, 1e-12, 'GS10 top');
  close(ck(r, 'GS12', 'svb').ratio, 0.60725248, 1e-7, 'Service II bottom'); close(ck(r, 'GS12', 'svt').ratio, 0.40914697, 1e-7, 'Service II top');
  close(r.webS.F, 34.699549, 1e-7, 'F_crw'); close(ck(r, 'GS13', 'web').ratio, 0.64237432, 1e-7, 'GS13');
  close(ck(r, 'CN', 'cnY').demand, 34.188555, 1e-7, 'cnY'); close(ck(r, 'CN', 'cnW').ratio, 0.84075462, 1e-7, 'cnW'); close(ck(r, 'CN', 'cnT').demand, 22.111224, 1e-7, 'cnT');
  assert.equal(r.gov.id, 'GS7');   // GS7 0.64506 > GS13 0.64237 (before SB2-O6: GS13 governed, GS7 0.63760)
});

/* ---------- consistency 1: noncomposite negative = the existing negative path, steel section with no rebar ---------- */
test('consistency: noncomposite negative flexure = the existing negative-flexure path of the same steel section (no deck rebar), 100 payloads', () => {
  let n = 0, worst = { rel: 0 };
  const cmp = (a, b, what) => { if (Object.is(a, b) || a === b) return; const rel = Math.abs(a - b) / Math.max(1e-300, Math.abs(b));
    if (rel > worst.rel) worst = { rel, what }; assert.ok(rel < 1e-12, `${what}: ${a} vs ${b}`); };
  for (const f of payloads) {
    const F = FX.fromPayload(readP(f), { fl: /_G1\.json$/.test(f) ? 7.5 : 0 }), locs = F.locs.filter(L => L.region === 'neg');
    const zero = { ...F.prj, deck: { ...F.prj.deck, rebar: { top: { A: 0, c: 0 }, bot: { A: 0, c: 0 } } } };
    const A = FX.girder(locs, zero, {}).rows, B = FX.girder(locs, NC(F.prj), {}).rows;
    A.forEach((a, i) => { const b = B[i], w = `${f} ${a.name}`; n++;
      for (const k of ['Mu', 'Dc', 'Rb', 'Rh', 'fbuC', 'CbU', 'useA6']) cmp(b[k], a[k], `${w} ${k}`);
      cmp(b.tF.f, a.tF.f, `${w} f_t`); cmp(b.yT.My, a.yT.My, `${w} M_yt`); cmp(b.yB.My, a.yB.My, `${w} M_yc`); cmp(b.pl.Mp, a.pl.Mp, `${w} M_p`); cmp(b.Dcp, a.Dcp, `${w} D_cp`);
      for (const k of ['FLB', 'LTB', 'Fnc', 'rt', 'Lp', 'Lr', 'Fcr']) cmp(b.lt[k], a.lt[k], `${w} lt.${k}`);
      cmp(b.am.fl, a.am.fl, `${w} f_l`);
      for (const k of ['ok', 'lw', 'lrwP', 'lpDcp', 'webCompact', 'Rpc', 'Rpt', 'Sxc', 'J', 'FyrA', 'MncF', 'MncL', 'Mnc', 'Mnt']) cmp(b.A6[k], a.A6[k], `${w} A6.${k}`);
      for (const [id, key] of [['GS7', 'fnc'], ['GS8', 'fnt'], ['GS9', 'a6c'], ['GS9', 'a6t'], ['GS13', 'web']]) { const p = ck(a, id, key), q = ck(b, id, key);
        if (!p) { assert.ok(!q, `${w} ${id} ${key}`); continue; } cmp(q.ratio, p.ratio, `${w} ${id} ${key}`); cmp(q.inUse, p.inUse, `${w} ${id} ${key} in use`); }
    });
  }
  console.log(`       ${n} negative-flexure locations; largest relative difference ${worst.rel ? worst.rel.toExponential(2) + ' (' + worst.what + ')' : '0 (identical)'}`);
  assert.ok(n > 10000);
});

/* ---------- consistency 2: noncomposite positive = noncomposite negative of the section turned upside down ---------- */
test('consistency: noncomposite positive flexure = negative flexure of the same section upside down (every check), 100 payloads', () => {
  let n = 0, nA6 = 0, worst = { rel: 0 };
  const cmp = (a, b, what) => { if (Object.is(a, b) || a === b) return; if (typeof a === 'number' && Number.isNaN(a) && Number.isNaN(b)) return;
    const rel = Math.abs(a - b) / Math.max(1e-300, Math.abs(b)); if (rel > worst.rel) worst = { rel, what }; assert.ok(rel < 1e-9, `${what}: ${a} vs ${b}`); };
  const flipKey = { svt: 'svb', svb: 'svt', fl: 'flT', flT: 'fl' };
  for (const f of payloads) {
    const F = FX.fromPayload(readP(f)), prj = NC(F.prj), sk = { ...prj, mat: { ...prj.mat, Fyt: prj.mat.Fyb, Fyb: prj.mat.Fyt } };
    const locs = F.locs.map((L, i) => ({ ...L, region: 'pos', npr: null, fl: 3 + (i % 3), flT: 2 * (i % 2) }));
    const flip = locs.map(L => { const p = L.plates, M = L.M;
      return { ...L, region: 'neg', fl: L.flT, flT: L.fl, plates: { D: p.D, tw: p.tw, topB: p.botB, topT: p.botT, botB: p.topB, botT: p.topT },
        M: { DC1: -M.DC1, DC2: -M.DC2, DW: -M.DW, LLp: -M.LLn, LLn: -M.LLp, UT: -M.UT, UF: -M.UF, FATp: -M.FATn, FATn: -M.FATp } }; });
    const A = FX.girder(locs, prj, {}).rows, B = FX.girder(flip, sk, {}).rows;
    A.forEach((a, i) => { const b = B[i], w = `${f} ${a.name}`; n++; if (a.useA6) nA6++;
      cmp(a.Mu, -b.Mu, `${w} Mu`); cmp(a.Ms, -b.Ms, `${w} Ms`); cmp(a.useA6, b.useA6, `${w} useA6`);
      for (const k of ['Dc', 'Rb', 'Rh', 'fbuC', 'DcS', 'dfT']) cmp(a[k], k === 'dfT' ? b.dfB : b[k], `${w} ${k}`);
      cmp(a.pl.Mp, b.pl.Mp, `${w} M_p`); cmp(a.Dcp, b.Dcp, `${w} D_cp`);
      for (const k of ['Fnc', 'LTB', 'FLB']) cmp(a.lt[k], b.lt[k], `${w} lt.${k}`);
      for (const k of ['Mnc', 'Mnt', 'Rpc']) cmp(a.A6[k], b.A6[k], `${w} A6.${k}`);
      const bc = b.checks.filter(c => !(c.id === 'GS19'));
      a.checks.filter(c => c.id !== 'GS19' && !(c.id === 'GS5' || c.id === 'GS6')).forEach(c => {
        const q = bc.find(x => x.id === c.id && x.key === (c.id === 'GS10' || c.id === 'GS12' ? flipKey[c.key] : c.key));
        assert.ok(q, `${w} ${c.id} ${c.key} missing in the flipped section`);
        cmp(c.ratio, q.ratio, `${w} ${c.id} ${c.key}`); cmp(c.inUse, q.inUse, `${w} ${c.id} ${c.key} in use`); cmp(c.ok, q.ok, `${w} ${c.id} ${c.key} ok`); });
      assert.equal(a.checks.filter(c => c.id !== 'GS5' && c.id !== 'GS6').length, b.checks.length, `${w} number of checks`);
    });
  }
  console.log(`       ${n} locations (A6 in use at ${nA6}); largest relative difference ${worst.rel ? worst.rel.toExponential(2) + ' (' + worst.what + ')' : '0 (identical)'}`);
  assert.ok(n > 30000 && nA6 > 0);
});

test('noncomposite: steps unique, no NaN, every check links to a step; composite results ignore flT', () => {
  const pl = readP('gd_builtin_AASHTO_G2.json'), F = FX.fromPayload(pl, { fl: 5 }), prj = NC(F.prj);
  const pick = F.locs.filter((L, i) => i % 23 === 0 || (L.npr && i % 5 === 0)).map((L, i) => ({ ...L, flT: i % 2 ? 2 : 0 }));
  for (const L of pick) { const r = FX.location(L, prj), ids = r.steps.map(s => s.id);
    assert.equal(new Set(ids).size, ids.length, `${L.name} ids unique`);
    r.steps.forEach(s => assert.ok(!/undefined|NaN/.test(STEPS.line(s, true)), `${L.name} ${s.id}: ${STEPS.line(s, true)}`));
    r.checks.forEach(c => { assert.ok(ids.includes(c.step), `${L.name} ${c.id} ${c.key}: step ${c.step}`); assert.match(c.ref, /AASHTO LRFD 10th Ed\./); });
    const a = FX.location({ ...L, flT: 7 }, F.prj), b = FX.location({ ...L, flT: 0 }, F.prj);
    assert.deepEqual(a.checks.map(c => c.ratio), b.checks.map(c => c.ratio), `${L.name} composite ignores flT`); }
  assert.throws(() => FX.location({ ...pick[0], region: 'pos', npr: { kind: 'ge', b: 10, t: 1 } }, prj), /not available/);
});
