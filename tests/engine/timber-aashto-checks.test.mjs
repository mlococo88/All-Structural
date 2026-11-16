// "Timber Beam Check.html", AASHTO LRFD 10th Ed. mode, phase T3 (fix log TBA4, 2026-11-16): the checks of tbcAasChecks: flexure
// (Art. 8.6.1, 8.6.2 with C_L; glulam: the lesser of C_L and C_V, Art. 8.4.4.5, C_V with the points of zero moment of the governing
// load case) and shear (Art. 8.7). Hand checks written out below (independent closed-form arithmetic); the two worked examples of
// the PR are pinned here: example 1, sawn stringer, simple span; example 2, glulam, two continuous spans.
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { tbcEngine } from './tbc-source.mjs';

const E = tbcEngine();
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (±${tol})`);
const run = (fn) => { const m = E.tbcDefaultModel(); m.design.code = 'AASHTO'; m.design.aashto = E.tbcAashtoDefaults(); m.design.aashto.bl = E.tbcAasLoadDefaults(); m.design.moisture = 'Wet'; fn(m);
  const A = E.tbcAashto(m), L = E.tbcAasLoads(m, A); assert.ok(L.ok, (L.errors || []).join('; ')); const D = E.aasDemands(L), C = E.tbcAasChecks(m, A, L, D); assert.ok(C.ok, C.errors.join('; ')); return { m, A, L, D, C }; };
// Example 1: 10x16 DF-L No. 1 Beams and Stringers (9.5 x 15.5 in.), wet, 14 ft simple span, bearing 5.5 in.; s = 24 in. (S = 2 ft),
// 4 in. plank deck, 2 in. bituminous wearing surface, interior stringer, 24 ft roadway (N_L = 2), IM 0, top edge braced by the deck.
const EX1 = m => { m.design.aashto.gr = 'No.1'; m.material.size = '10x16'; m.geom.spacing = 24; m.geom.spans = [{ L: 14 }]; m.geom.supports = [0, 1].map(() => ({ t: 'pin', lb: 5.5, cb: false })); m.design.aashto.bl.tWs = 2; };
// Example 2: glulam 24F-V4 DF/DF, 8-3/4 x 33 in. (22 laminations of 1.5 in.), wet, two spans of 30 ft, bearing 6 in.; s = 48 in. (S = 4 ft),
// glued laminated deck panels 5.125 in., 3 in. bituminous, interior, 24 ft roadway; top edge braced by the deck, bottom edge braced at 10 ft.
const EX2 = m => { m.material.type = 'glulam'; m.material.glulam.grp = 'DF'; m.material.glulam.b = 8.75; m.material.glulam.nLam = 22; m.design.aashto.gl = '24F-V4 DF/DF'; m.geom.spacing = 48;
  m.geom.spans = [{ L: 30 }, { L: 30 }]; m.geom.supports = [0, 1, 2].map(() => ({ t: 'pin', lb: 6, cb: false })); Object.assign(m.design.aashto.bl, { deck: 'glpanel', tD: 5.125, tWs: 3 }); m.design.latBot = 'Supports'; m.design.luBot = 10; };

test('example 1 (sawn, simple span): flexure Art. 8.6.2 and shear Art. 8.7, by hand', () => {
  const { A, L, C } = run(EX1);
  // w_DC = 0.050 x 9.5 x 15.5/144 + 0.050 x 4/12 x 2 = 0.0511285 + 0.0333333 = 0.0844618 kip/ft; w_DW = 0.140 x 2/12 x 2 = 0.0466667
  close(L.wDC, 0.0844618, 1e-6, 'w_DC'); close(L.wDW, 0.0466667, 1e-6, 'w_DW');
  // HL-93 per lane, 14 ft: tandem axle at x, the other at x + 4: M = x[25(14 - x) + 25(10 - x)]/14 = 42.85714x - 3.571429x^2; lane 0.32x(14 - x)
  // total 47.33714x - 3.891429x^2; at x = 6.1 (and 7.9 by symmetry): 288.7566 - 144.8000 = 143.9566 kip-ft (the truck, 32 x 14/4 = 112, is less)
  const f = C.flex[0]; assert.equal(C.flex.length, 1); close(f.x, 7.9, 1e-9, 'x of M_u'); close(f.sec.M.ll.max, 47.337143 * 6.1 - 3.8914286 * 6.1 * 6.1, 1e-4, 'M_LL per lane');
  // M_DC = 0.0844618 x 7.9 x 6.1/2 = 2.035107; M_DW = 0.0466667 x 24.095 = 1.124433; g_M = 2/6.7 = 0.298507
  // M_u = 1.25 x 2.035107 + 1.50 x 1.124433 + 1.75 x 0.298507 x 143.9566 = 2.543884 + 1.686650 + 75.201164 = 79.431698 kip-ft
  close(f.Mu, 79.4317, 2e-4, 'M_u');
  // F_b = 1.350 x (2.5/0.85) x 1.00 (C_M, > 4 in.) x (12/15.5)^(1/9) x 0.8 = 3.970588 x 0.971963 x 0.8 = 3.087413 ksi; C_L = 1.0 (top braced)
  close(f.Fb, 3.087413, 1e-6, 'F_b'); assert.equal(f.CL, 1); assert.equal(f.clWhy, 'braced');
  // S = 9.5 x 15.5^2/6 = 380.3958 in^3; M_n = 3.087413 x 380.3958 / 12 = 97.86993 kip-ft; M_r = 0.85 x 97.86993 = 83.18944; ratio 0.95483
  close(C.S, 380.3958, 1e-4, 'S'); close(f.Mn, 97.86993, 1e-4, 'M_n'); close(f.Mr, 83.18944, 1e-4, 'M_r'); close(f.ratio, 0.95483, 1e-5, 'M_u/M_r'); assert.equal(f.ok, true);
  // shear: face 5.5/24 = 0.229167 ft; a = min(3 x 1.291667, 14/4) = 3.5 -> x_LL = 3.729167 ft; x_d = 0.229167 + 1.291667 = 1.520833 ft
  // V_lane: tandem 25(10.270833 + 6.270833)/14 = 29.538690; lane 0.64 x 10.270833^2/28 = 2.411201 -> 31.949891 kip
  // V_LL = 0.50[0.60 x 0.5 + 0.298507] x 31.949891 = 0.2992537 x 31.949891 = 9.561124; V_DC = 0.0844618 x (7 - 1.520833) = 0.462780,
  // V_DW = 0.0466667 x 5.479167 = 0.255694; V_u = 1.25 x 0.462780 + 1.50 x 0.255694 + 1.75 x 9.561124 = 0.578475 + 0.383542 + 16.731967 = 17.693984
  const v = C.shear[0]; close(v.s.VLane, 31.949891, 1e-5, 'V_lane'); close(v.Vu, 17.693984, 1e-5, 'V_u');
  // F_v = 0.170 x (2.5/0.75) x 1.00 x 0.8 = 0.453333 ksi; V_n = 0.453333 x 9.5 x 15.5/1.5 = 44.50222 kip; V_r = 0.75 x 44.50222 = 33.37667; ratio 0.53013
  close(v.Fv, 0.453333, 1e-6, 'F_v'); close(v.Vn, 44.50222, 1e-4, 'V_n'); close(v.Vr, 33.37667, 1e-4, 'V_r'); close(v.ratio, 0.53013, 1e-5, 'V_u/V_r');
  close(C.gov.ratio, 0.95483, 1e-5, 'governing: flexure'); assert.equal(C.gov.kind, 'flex'); assert.equal(C.fails.length, 0);
  assert.equal(A.isGL, false);
});

test('example 2 (glulam, two continuous spans): C_L, C_V from the zero-moment points, the lesser; shear', () => {
  const { A, L, C } = run(EX2);
  assert.equal(C.flex.length, 4);   // +M and -M in each span (Strength I)
  const pos = C.flex.find(x => x.sg > 0 && x.k === 0), neg = C.flex.find(x => x.sg < 0 && x.k === 0);
  // w_DC = 0.050 x 8.75 x 33/144 + 0.050 x 5.125/12 x 4 = 0.100260 + 0.085417 = 0.185677; w_DW = 0.140 x 3/12 x 4 = 0.140; g_M = 4/10 = 0.400
  close(L.wDC, 0.1856771, 1e-6, 'w_DC'); close(L.df.gM, 0.4, 1e-12, 'g_M');
  // -M at the pier: M_DC = -wL^2/8 = -0.185677 x 900/8 = -20.88867; M_DW = -15.75; M_LL- per lane -265.08 (T2: cross-checked with
  // shared/moving-load.js within 0.2 %); M_u = 1.25 x 20.88867 + 1.50 x 15.75 + 1.75 x 0.4 x 265.08 = 26.111 + 23.625 + 185.56 = 235.29 kip-ft
  close(neg.x, 30, 1e-9, '-M at the pier'); close(neg.Mu, 1.25 * 0.1856771 * 112.5 + 1.5 * 0.14 * 112.5 + 0.7 * -neg.sec.M.ll.min, 1e-4, 'M_u- composition (beam engine vs wL^2/8)'); close(neg.Mu, 235.29, 0.01, 'M_u-');
  // F_b- (without C_V) = 1.85 x 2.941176 x 0.80 (C_M) x 0.8 = 3.482353 ksi; L_u = 120 in., L_u/d = 3.636 < 7 -> L_e = 2.06 x 120 = 247.2 in.
  // R_B = sqrt(247.2 x 33/8.75^2) = sqrt(106.5482) = 10.32222; E = 1800 x 0.833 = 1499.4 ksi; F_bE = 1.10 x 1499.4/106.5482 = 15.47975 ksi
  // A = 15.47975/3.482353 = 4.445198; C_L = 5.445198/1.9 - sqrt(2.865894^2 - 4.445198/0.95) = 2.865894 - 1.879944 = 0.985949
  close(neg.Fb, 3.482353, 1e-6, 'F_b-'); close(neg.Le, 247.2, 1e-9, 'L_e'); close(neg.RB, 10.32222, 1e-5, 'R_B'); close(neg.FbE, 15.47975, 1e-4, 'F_bE'); close(neg.A, 4.445198, 1e-5, 'A'); close(neg.CL, 0.985949, 2e-6, 'C_L');
  // C_V, -M: zero-moment points of the governing case 22.378 and 36.988 ft -> L = 14.6103 ft; [(12/33)(5.125/8.75)(21/14.6103)]^0.1 = 0.306137^0.1 = 0.888364
  close(neg.Lz, 14.6103, 2e-3, 'L between zero-moment points, -M'); close(neg.CV, 0.888364, 2e-5, 'C_V-'); assert.equal(neg.facBy, 'CV'); close(neg.fac, neg.CV, 0, 'lesser');
  // S = 8.75 x 33^2/6 = 1588.125; M_n = 3.482353 x 1588.125 x 0.888364/12 = 409.4185; M_r = 0.85 x 409.4185 = 348.0057; ratio 235.29/348.01 = 0.6761
  close(C.S, 1588.125, 1e-9, 'S'); close(neg.Mr, 348.0057, 0.01, 'M_r-'); close(neg.ratio, 0.67611, 1e-4, 'ratio -M');
  // +M (span 1): F_b+ = 2.4 x 2.941176 x 0.80 x 0.8 = 4.517647; C_L = 1.0 (deck). The governing case at x = 12.15 ft is the tandem + lane on span 1
  // (the influence line of M at 12.15 ft is negative on span 2, so the lane is not there). Independent check of its zero-moment point:
  // two equal spans, three-moment equation: M_B = -(sum P a (L^2 - a^2))/(4 L^2) - w_lane L^2/16 for loads in span 1, - w L^2/8 for a uniform w on both.
  close(pos.Fb, 4.517647, 1e-6, 'F_b+'); assert.equal(pos.CL, 1); close(pos.zl, 0, 1e-9, 'x_l = support A');
  const gv = pos.sec.M.ll.gMax, Lz = 30, g = 1.75 * 0.4, wD = 1.25 * L.wDC + 1.5 * L.wDW;
  assert.match(gv.cfg, /tandem/);
  const ax = gv.pos.map((x, i) => [gv.P[i] * g, x]).filter(([, x]) => x >= 0 && x <= 30);
  const wl = g * 0.64, MB = -ax.reduce((s, [P, a]) => s + P * a * (Lz * Lz - a * a), 0) / (4 * Lz * Lz) - wl * Lz * Lz / 16 - wD * Lz * Lz / 8;
  const RA = (wD + wl) * Lz / 2 + ax.reduce((s, [P, a]) => s + P * (Lz - a), 0) / Lz + MB / Lz;
  const Mx = x => RA * x - (wD + wl) * x * x / 2 - ax.reduce((s, [P, a]) => s + (x > a ? P * (x - a) : 0), 0);
  close(Mx(pos.x), pos.Mu, 2e-3, 'the case at the section = M_u+');
  let lo = 20, hi = 29.9; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (Mx(mid) > 0) lo = mid; else hi = mid; }
  close(pos.zr, lo, 2e-3, 'zero-moment point x_r (+M), three-moment equation'); close(pos.Lz, 24.8993, 2e-3, 'L+');
  // C_V+ = [(12/33)(5.125/8.75)(21/24.8993)]^0.1 = 0.179633^0.1 = 0.842245; M_n = 4.517647 x 1588.125 x 0.842245/12 = 503.5635; M_r = 428.0290
  close(pos.CV, 0.842245, 2e-5, 'C_V+'); close(pos.Mr, 428.029, 0.01, 'M_r+'); close(pos.ratio, pos.Mu / pos.Mr, 1e-12, 'ratio +M'); close(pos.Mu, 252.526, 0.01, 'M_u+');
  // shear: F_v = 0.265 x 0.72 x (2.5/0.75) x 0.875 x 0.8 = 0.4452 ksi; V_n = 0.4452 x 8.75 x 33/1.5 = 85.701 kip; V_r = 0.75 x 85.701 = 64.27575 kip
  C.shear.forEach(s => { close(s.Fv, 0.4452, 1e-9, 'F_v'); close(s.Vr, 64.27575, 1e-6, 'V_r'); close(s.ratio, s.Vu / 64.27575, 1e-12, 'ratio'); });
  close(C.gov.ratio, neg.ratio, 1e-12, 'governing -M'); assert.equal(C.fails.length, 0);
  assert.ok(A.isGL);
});

test('beam stability: L_e ranges, R_B > 50 is NG, d <= b gives C_L = 1, bottom edge "same as top"', () => {
  // L_e (Art. 8.6.2): L_u/d < 7: 2.06 L_u; 7..14.3: 1.63 L_u + 3d; > 14.3: 1.84 L_u
  close(E.aasLe(100, 20).Le, 206, 1e-12, '2.06'); close(E.aasLe(140, 20).Le, 1.63 * 140 + 60, 1e-12, '1.63 (=7)'); close(E.aasLe(286, 20).Le, 1.63 * 286 + 60, 1e-12, '1.63 (=14.3)'); close(E.aasLe(300, 20).Le, 552, 1e-9, '1.84');
  // sawn 6x16 DF-L No. 1, 20 ft, top edge at supports only with L_u = 10 ft: L_u/d = 120/15.5 = 7.742 -> L_e = 1.63 x 120 + 3 x 15.5 = 242.1 in.;
  // R_B = sqrt(242.1 x 15.5/5.5^2) = sqrt(124.0512) = 11.13783; F_bE = 0.76 x 1600/124.0512 = 9.80240 (dry: E = 1600); F_b = 3.087413 (C_M 1.0 > 4 in.)
  // A = 3.174956; C_L = 4.174956/1.9 - sqrt(2.197345^2 - 3.174956/0.95) = 2.197345 - 1.219125 = 0.978220
  const r = run(m => { m.design.moisture = 'Dry'; m.design.aashto.gr = 'No.1'; m.material.size = '6x16'; m.geom.spacing = 24; m.geom.spans = [{ L: 20 }]; m.design.latTop = 'Supports'; m.design.luTop = 10; });
  const f = r.C.flex[0]; close(f.RB, 11.13783, 1e-5, 'R_B'); close(f.FbE, 9.80240, 1e-5, 'F_bE'); close(f.CL, 0.978220, 2e-6, 'C_L'); close(f.Mr, 0.85 * 3.087413 * (5.5 * 15.5 * 15.5 / 6) * 0.978220 / 12, 1e-4, 'M_r with C_L');
  // R_B > 50: a 2x12 with the top edge free over 40 ft: NG whatever the ratio
  const r2 = run(m => { m.material.size = '2x12'; m.geom.spans = [{ L: 40 }]; m.design.latTop = 'Supports'; m.design.luTop = 0; });
  assert.ok(r2.C.flex[0].RB > 50 && r2.C.flex[0].rbNG && !r2.C.flex[0].ok);
  // bottom edge "same as top" (an earlier-version setting) = the top setting
  const r3 = run(m => { EX2(m); m.design.latBot = 'same'; });
  assert.ok(r3.C.flex.filter(x => x.sg < 0).every(x => x.CL === 1 && x.clWhy === 'braced'));
});

test('Strength II (permit vehicle) with C_lambda = 1.0; flat use refused; NDS untouched', () => {
  const r = run(m => { EX1(m); m.design.aashto.bl.permit = '20, 30@14, 30@4'; });
  const f2 = r.C.flex.find(x => x.lim === 'StrII'), v2 = r.C.shear.find(x => x.lim === 'StrII');
  assert.ok(f2 && v2); close(f2.Fb, 3.087413 / 0.8, 1e-6, 'F_b at C_lambda = 1.0'); close(f2.Mu, Math.abs(r.D.Mpos2.v), 1e-9, 'M_u Strength II');
  close(v2.Vr, 33.37667 / 0.8, 1e-4, 'V_r at C_lambda = 1.0');
  const m = E.tbcDefaultModel(); m.design.code = 'AASHTO'; m.design.aashto = E.tbcAashtoDefaults(); m.design.aashto.bl = E.tbcAasLoadDefaults(); m.material.size = '4x6'; m.design.flatUse = true;
  const A = E.tbcAashto(m), L = E.tbcAasLoads(m, A), C = E.tbcAasChecks(m, A, L, E.aasDemands(L));
  assert.equal(C.ok, false); assert.equal(JSON.stringify(C.errTab), '["factors"]');
});
