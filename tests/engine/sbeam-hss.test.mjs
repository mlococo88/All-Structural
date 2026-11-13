// Steel Beam Design - AISC 15th.html: the HSS path (rectangular and round), AISC 360-16 LRFD. The app's own functions are run
// in Node (sbeam-source.mjs: pulled from the page by name; member check mode runs the page's computeMember()).
// Each fixture states the hand calculation with its equation numbers (paraphrased, not quoted). Three kinds of reference:
//   - the hand value, computed here from the database properties: matched to 1e-9 (the same arithmetic);
//   - the engineer's HSS spreadsheet ("ASIC 15th Ed - STEEL DESIGN - HSS Member.xlsm", sheet "HSS Members", review of
//     2026-11-13) and AISC Design Example values: matched to their rounding (tolerance stated at each check);
//   - the app's exact value at the time of writing, to 1e-6, so any later change to a result shows up here.
// Database: AISC Shapes Database v16.0 as embedded in the app. E = 29,000 ksi.
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { sbEngine } from './sbeam-source.mjs';

const sb = sbEngine();
const E = 29000, SQ = Math.sqrt;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);
const rel = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);
const sec = (fam, lbl, grade) => sb.call('sectionFor', fam, lbl, grade);
// member check mode, the page's own path: S reset to the page default, then computeMember()
function member(section, m) {
  sb.ctx.__m = { section, m };
  const A = sb.design(`(()=>{S=defaultState();S.mode='member';S.section=Object.assign({ovr:{}},__m.section);
    const m=__m.m;['L','Lb','Lv','cont','Cb'].forEach(k=>{if(k in m)S.member[k]=m[k];});S.member.rows=m.rows;
    ['Lcx','Lcy','Lcz'].forEach(k=>{if(k in m)S.design[k]=m[k];});return computeMember();})()`);
  delete sb.ctx.__m;
  assert.equal(A.designError, undefined, 'design error: ' + A.designError);
  assert.equal(A.blockers.length, 0, 'blockers: ' + A.blockers.join('; '));
  return A.design;
}

// ---------------------------------------------------------------------------------------------------------------------
// 1. Spreadsheet example: HSS12X6X1/2, A500 Gr. B (Fy = 46 ksi), Lb = Lcx = Lcy = 12 ft, Cb = 1
//    Database: A = 15.3, tdes = 0.465, Zx = 57.4, Sx = 45.2, Zy = 35.2, ry = 2.44, J = 227, C = 59.0
// ---------------------------------------------------------------------------------------------------------------------
test('HSS12X6X1/2 Gr. B: flexure, shear, compression, torsion (spreadsheet example)', () => {
  const p = sec('HSSR', 'HSS12X6X1/2', 'A500B_R'), Fy = 46, t = 0.465;
  assert.equal(p.mat.Fy, Fy);
  // Table B4.1b case 17 / 19: b/t = (6 - 3t)/t = 9.90 <= 1.12 sqrt(E/Fy) = 28.12; h/t = (12 - 3t)/t = 22.81 <= 2.42 sqrt(E/Fy) = 60.76: compact
  near(p.btdes, (6 - 3 * t) / t, 1e-12, 'b/t'); near(p.htdes, (12 - 3 * t) / t, 1e-12, 'h/t');
  // F7.4: Lp = 0.13 E ry sqrt(JA)/Mp (F7-12) = 205.3 in = 17.11 ft; Lr = 2 E ry sqrt(JA)/(0.7 Fy Sx) (F7-13) = 5730 in = 477.5 ft
  const Mp = Fy * 57.4, Lp = 0.13 * E * 2.44 * SQ(227 * 15.3) / Mp, Lr = 2 * E * 2.44 * SQ(227 * 15.3) / (0.7 * Fy * 45.2);
  const fx = sb.call('flexFor', p, 'x', 144, 1);
  const ltb = fx.ls.find(l => /Lateral/.test(l.name)).d;
  near(ltb.Lp, Lp, 1e-9, 'Lp'); near(ltb.Lr, Lr, 1e-9, 'Lr');
  near(Lp / 12, 17.11, 0.005, 'Lp vs spreadsheet 17.11 ft'); near(Lr / 12, 477.5, 0.05, 'Lr vs spreadsheet 477.5 ft');
  // Lb = 144 in < Lp: yielding governs, phi Mnx = 0.9 Fy Zx (F7-1) = 0.9(46)(57.4)/12 = 198.03 kip-ft
  assert.equal(fx.gov.clause, 'F7.1 (F7-1)');
  near(fx.phiMn / 12, 0.9 * Mp / 12, 1e-9, 'phiMnx hand'); near(fx.phiMn / 12, 198.03, 0.005, 'phiMnx vs spreadsheet 198.03');
  // minor axis: phi Mny = 0.9(46)(35.2)/12 = 121.44 kip-ft (F7-1)
  const fy = sb.call('flexFor', p, 'y', 0, 1);
  near(fy.phiMn / 12, 0.9 * Fy * 35.2 / 12, 1e-9, 'phiMny hand'); near(fy.phiMn / 12, 121.44, 0.005, 'phiMny vs spreadsheet 121.44');
  // G4: h = 12 - 3t = 10.605 in, Aw = 2ht = 9.8627 in^2; h/t = 22.81 <= 1.10 sqrt(kv E/Fy) = 61.76 (kv = 5) -> Cv2 = 1 (G2-9);
  // phi Vn = 0.9(0.6 Fy Aw Cv2) = 0.9(0.6)(46)(9.8627) = 244.99 kip. The spreadsheet's 244.92 takes h from the rounded h/t = 22.8.
  const vx = sb.call('shearMajor', p, null);
  near(vx.Aw, 2 * (12 - 3 * t) * t, 1e-12, 'Aw');
  near(vx.phi * vx.Vn, 0.9 * 0.6 * Fy * 2 * (12 - 3 * t) * t, 1e-9, 'phiVnx hand');
  near(vx.phi * vx.Vn, 244.92, 0.1, 'phiVnx vs spreadsheet 244.92 (h rounding)');
  // minor-axis shear: Aw = 2bt, b = 6 - 3t = 4.605 in: phi Vn = 0.9(0.6)(46)(2)(4.605)(0.465) = 106.38 kip (spreadsheet 106.35)
  const vy = sb.call('shearMinor', p);
  near(vy.phi * vy.Vn, 0.9 * 0.6 * Fy * 2 * (6 - 3 * t) * t, 1e-9, 'phiVny hand'); near(vy.phi * vy.Vn, 106.35, 0.05, 'phiVny vs spreadsheet');
  // E3: Lc/ry = 144/2.44 = 59.02; Fe = pi^2 E/(Lc/r)^2 (E3-4) = 82.18 ksi; Fy/Fe = 0.560 <= 2.25 -> Fcr = 0.658^(Fy/Fe) Fy (E3-2)
  // = 36.39 ksi; walls nonslender (b/t, h/t <= 1.40 sqrt(E/Fy) = 35.15, Table B4.1a case 6): phi Pn = 0.9(36.39)(15.3) = 501.12 kip
  const Fe = Math.PI ** 2 * E / (144 / 2.44) ** 2, Fcr = Math.pow(0.658, Fy / Fe) * Fy;
  const c = sb.call('compStrength', p, 144, 144, 144);
  near(c.Fcr, Fcr, 1e-9, 'Fcr'); near(c.phiPn, 0.9 * Fcr * 15.3, 1e-9, 'phiPn hand'); near(c.phiPn, 501.12, 0.005, 'phiPn vs spreadsheet 501.12');
  // H3.1(b): h/t = 22.81 <= 2.45 sqrt(E/Fy) = 61.52 -> Fcr = 0.6 Fy = 27.6 ksi (H3-3); phi Tn = 0.9 Fcr C (H3-1) = 0.9(27.6)(59)/12
  // = 122.13 kip-ft. The spreadsheet's 122.11 uses C from the H3 user-note formula (58.99) instead of the tabulated 59.0.
  const tor = sb.call('torsionHSS', p, 0);
  assert.equal(tor.clause, 'H3-3');
  near(tor.phiTn / 12, 0.9 * 0.6 * Fy * 59 / 12, 1e-9, 'phiTn hand'); near(tor.phiTn / 12, 122.11, 0.05, 'phiTn vs spreadsheet 122.11');
});

test('HSS12X6X1/2 Gr. B member check mode: H1-1b, H3-6 and H1-1a (spreadsheet example)', () => {
  const D = member({ family: 'HSSR', label: 'HSS12X6X1/2', grade: 'A500B_R' }, {
    Lb: 12, Cb: 1, Lcx: 12, Lcy: 12, Lcz: 12,
    rows: [{ id: 'm1', name: 'XLS', Mux: 3.89, Vux: 10, Pu: 0.1, Muy: 0.59, Vuy: 10, Tu: 0 },
      { id: 'm2', name: 'XLS+T', Mux: 3.89, Vux: 10, Pu: 0.1, Muy: 0.59, Vuy: 10, Tu: 40 },
      { id: 'm3', name: 'big', Mux: 150, Vux: 60, Pu: 150, Muy: 40, Vuy: 20, Tu: 0 }]
  });
  const [a, b, c] = D.perCombo, Pc = D.comp.phiPn, Mcx = 198.03, Mcy = 121.44, Vcx = D.shearX.phi * D.shearX.Vn, Vcy = D.shearY.phi * D.shearY.Vn;
  // H1-1b (Pr/Pc < 0.2): Pr/(2Pc) + Mrx/Mcx + Mry/Mcy = 0.1/(2(501.12)) + 3.89/198.03 + 0.59/121.44 = 0.0001 + 0.01964 + 0.00486 = 0.02460
  assert.equal(a.inter.eq, 'H1-1b');
  near(a.inter.value, 0.1 / (2 * Pc) + 3.89 / Mcx + 0.59 / Mcy, 1e-9, 'H1-1b hand');
  near(a.inter.value, 0.02460, 0.00001, 'H1-1b vs spreadsheet 0.02460');
  // Tu = 40: Tr/Tc = 40/122.13 = 0.3275 > 0.2, so H3-6 replaces H1 (H3.2). Both axes summed in each group (app and spreadsheet):
  // (Pr/Pc + Mrx/Mcx + Mry/Mcy) + (Vrx/Vcx + Vry/Vcy + Tr/Tc)^2 = 0.02470 + (0.04082 + 0.09400 + 0.32752)^2 = 0.23846
  assert.equal(b.inter.eq, 'H3-6');
  near(b.dcrT, 40 / 122.13, 1e-9, 'Tr/Tc');
  near(b.inter.value, (0.1 / Pc + 3.89 / Mcx + 0.59 / Mcy) + Math.pow(10 / Vcx + 10 / Vcy + 40 / 122.13, 2), 1e-9, 'H3-6 hand');
  near(b.inter.value, 0.23856, 0.0002, 'H3-6 vs spreadsheet 0.23856 (Vc and C rounding)');
  // H1-1a (Pr/Pc = 150/501.12 = 0.2993 >= 0.2): Pr/Pc + 8/9 (Mrx/Mcx + Mry/Mcy) = 0.2993 + 8/9 (0.7575 + 0.3294) = 1.2654
  assert.equal(c.inter.eq, 'H1-1a');
  near(c.inter.value, 150 / Pc + 8 / 9 * (150 / Mcx + 40 / Mcy), 1e-9, 'H1-1a hand');
  near(c.inter.value, 1.2654, 0.00005, 'H1-1a vs spreadsheet 1.2654');
  // app values when this test was written
  rel(a.inter.value, 0.024601631286723335, 1e-6, 'app H1-1b'); rel(b.inter.value, 0.2384595628619506, 1e-6, 'app H3-6');
  rel(c.inter.value, 1.2654115248234146, 1e-6, 'app H1-1a');
});

// ---------------------------------------------------------------------------------------------------------------------
// 2. Slender walls: HSS12X12X1/4 and HSS10X6X3/16, A500 Gr. B (Fy = 46 ksi), Lc = 12 ft (review sections 3.2 to 3.4)
// ---------------------------------------------------------------------------------------------------------------------
test('HSS12X12X1/4 Gr. B: E7 effective area (phi Pn 346.2), F7-3/F7-4 (phi Mn 125.1), G4', () => {
  const p = sec('HSSR', 'HSS12X12X1/4', 'A500B_R'), Fy = 46, t = 0.233, b = 12 - 3 * t, lam = b / t, lr = 1.40 * SQ(E / Fy);
  // b = h = 11.301 in, b/t = 48.50 > lambda_r = 1.40 sqrt(E/Fy) = 35.15: slender (Table B4.1a case 6)
  near(p.btdes, lam, 1e-12, 'b/t');
  // E3: Lc/r = 144/4.79 = 30.06, Fe = 316.7 ksi, Fcr = 0.658^(46/316.7)(46) = 43.29 ksi
  const Fe = Math.PI ** 2 * E / (144 / 4.79) ** 2, Fcr = Math.pow(0.658, Fy / Fe) * Fy;
  // E7.1: lambda > lambda_r sqrt(Fy/Fcr) = 36.24, so be < b. Table E7.1 case (b): c1 = 0.20, c2 = 1.38.
  // Fel = (c2 lambda_r/lambda)^2 Fy (E7-5) = 46.01 ksi; be = b (1 - c1 sqrt(Fel/Fcr)) sqrt(Fel/Fcr) (E7-3) = 9.249 in
  // Ae = A - 4(b - be)t = 10.8 - 4(2.052)(0.233) = 8.888 in^2; phi Pn = 0.9 Fcr Ae (E7-1) = 0.9(43.29)(8.888) = 346.2 kip
  const Fel = (1.38 * lr / lam) ** 2 * Fy, rt = SQ(Fel / Fcr), be = b * (1 - 0.20 * rt) * rt, Ae = 10.8 - 4 * (b - be) * t;
  const c = sb.call('compStrength', p, 144, 144, 144);
  near(c.Fcr, Fcr, 1e-9, 'Fcr'); near(c.eff[0].be, be, 1e-9, 'be (E7-3)'); near(c.Ae, Ae, 1e-9, 'Ae');
  near(c.phiPn, 0.9 * Fcr * Ae, 1e-9, 'phiPn hand'); near(c.phiPn, 346.2, 0.05, 'phiPn vs review 346.2 (the spreadsheet, without E7, gives 420.7)');
  // F7.2(c): be = 1.92 t sqrt(E/Fy)[1 - (0.38/(b/t)) sqrt(E/Fy)] <= b (F7-4) = 9.023 in; Se from the section with the
  // ineffective strip (b - be)t of the compression flange removed (centroid shifted): Se = 36.27 in^3; Mn = Fy Se (F7-3)
  // phi Mn = 0.9(46)(36.27)/12 = 125.1 kip-ft
  const beF = 1.92 * t * SQ(E / Fy) * (1 - 0.38 / lam * SQ(E / Fy));
  const fx = sb.call('flexFor', p, 'x', 0, 1);
  assert.equal(fx.gov.clause, 'F7.2 (F7-3/4)');
  near(fx.gov.d.be, beF, 1e-9, 'be (F7-4)');
  const dA = (b - beF) * t, y = (12 - t) / 2, ybar = -dA * y / (10.8 - dA), I = 248 - dA * y * y - (10.8 - dA) * ybar * ybar, Se = I / (6 - ybar);
  near(fx.gov.d.Se, Se, 1e-9, 'Se hand'); near(fx.phiMn / 12, 0.9 * Fy * Se / 12, 1e-9, 'phiMn hand'); near(fx.phiMn / 12, 125.1, 0.05, 'phiMn vs review 125.1');
  // G4: h/t = 48.50 <= 1.10 sqrt(5E/Fy) = 61.76 -> Cv2 = 1; phi Vn = 0.9(0.6)(46)(2)(11.301)(0.233) = 130.8 kip
  const v = sb.call('shearMajor', p, null);
  near(v.phi * v.Vn, 0.9 * 0.6 * Fy * 2 * b * t, 1e-9, 'phiVn hand'); near(v.phi * v.Vn, 130.8, 0.05, 'phiVn vs spreadsheet 130.8');
});

test('HSS10X6X3/16 Gr. B: F7-2 (AISC Design Example F.7B, phi Mn 57.0), minor-axis F7-3, E7 on the h-walls (phi Pn 156.2)', () => {
  const p = sec('HSSR', 'HSS10X6X3/16', 'A500B_R'), Fy = 46, t = 0.174, rEF = SQ(E / Fy);
  const bt = (6 - 3 * t) / t, h = 10 - 3 * t, ht = h / t;
  // flange b/t = 31.48: 1.12 sqrt(E/Fy) = 28.12 < 31.48 <= 1.40 sqrt(E/Fy) = 35.15 -> noncompact (Table B4.1b case 17)
  // Mn = Mp - (Mp - Fy S)(3.57 (b/t) sqrt(Fy/E) - 4.0) <= Mp (F7-2) = 828 - (828 - 685.4)(0.4762) = 760.1 kip-in = 63.34 kip-ft;
  // phi Mn = 57.01 kip-ft. AISC Design Example F.7B (Design Examples v14.0, A500 Gr. B, Fy = 46 ksi): phi Mn = 57.0 kip-ft.
  const Mp = Fy * 18, MnF = Mp - (Mp - Fy * 14.9) * (3.57 * bt * SQ(Fy / E) - 4.0);
  const fx = sb.call('flexFor', p, 'x', 0, 1);
  assert.equal(fx.gov.clause, 'F7.2 (F7-2)');
  near(fx.Mn, MnF, 1e-9, 'Mn hand'); near(fx.phiMn / 12, 57.0, 0.05, 'phi Mn vs Design Example F.7B 57.0');
  // Same shape, A500 Gr. C (Fy = 50): Mn = 66.39 kip-ft; Design Examples v16.0 F.7B: Mn = 66.3 kip-ft (the app's Validation tab)
  const fC = sb.call('flexFor', sec('HSSR', 'HSS10X6X3/16', 'A500C_R'), 'x', 0, 1);
  near(fC.Mn / 12, 66.3, 0.1, 'Mn Gr. C vs Design Example F.7B (v16) 66.3');
  // minor axis: the flange is the h-wall, h/t = 54.47 > 35.15: slender. be = 1.92 t sqrt(E/Fy)[1 - (0.38/(h/t)) sqrt(E/Fy)]
  // (F7-4) = 6.919 in; Mn = Fy Se (F7-3) with Se = 9.187 in^3: phi Mn = 31.69 kip-ft (the spreadsheet's extrapolated F7-2: 27.0)
  const fy = sb.call('flexFor', p, 'y', 0, 1);
  assert.equal(fy.gov.clause, 'F7.2 (F7-3/4)');
  near(fy.gov.d.be, 1.92 * t * rEF * (1 - 0.38 / ht * rEF), 1e-9, 'be minor (F7-4)');
  near(fy.phiMn / 12, 0.9 * Fy * fy.gov.d.Se / 12, 1e-9, 'phiMny = 0.9 Fy Se'); near(fy.phiMn / 12, 31.7, 0.05, 'phiMny vs review 31.7');
  // E3 about y: Lc/ry = 144/2.52 = 57.14, Fe = 87.65 ksi, Fcr = 0.658^(46/87.65)(46) = 36.93 ksi.
  // E7: b-walls (31.48 <= 35.15) fully effective; h-walls 54.47 > lambda_r sqrt(Fy/Fcr) = 39.23: Fel = (1.38(35.15)/54.47)^2 (46)
  // = 36.48 ksi; be = h(1 - 0.20 sqrt(Fel/Fcr)) sqrt(Fel/Fcr) = 7.548 in; Ae = 5.37 - 2(9.478 - 7.548)(0.174) = 4.698 in^2;
  // phi Pn = 0.9(36.93)(4.698) = 156.2 kip (the spreadsheet, without E7: 178.5)
  const Fe = Math.PI ** 2 * E / (144 / 2.52) ** 2, Fcr = Math.pow(0.658, Fy / Fe) * Fy;
  const Fel = (1.38 * 1.40 * rEF / ht) ** 2 * Fy, rt = SQ(Fel / Fcr), be = h * (1 - 0.20 * rt) * rt, Ae = 5.37 - 2 * (h - be) * t;
  const c = sb.call('compStrength', p, 144, 144, 144);
  near(c.Ae, Ae, 1e-9, 'Ae'); near(c.phiPn, 0.9 * Fcr * Ae, 1e-9, 'phiPn hand'); near(c.phiPn, 156.2, 0.05, 'phiPn vs review 156.2');
});

// ---------------------------------------------------------------------------------------------------------------------
// 3. Round HSS: HSS10.750X0.500, A500 Gr. C round (Fy = 46 ksi), L = Lv = Lc = 12 ft
//    Database (v16.0 as embedded): OD = 10.8 (the database's rounded D), tdes = 0.465, A = 15.0, Zx = 49.2, r = 3.64, C = 74.1.
//    D/t is recomputed by the app as OD/tdes = 23.23 (the database tabulates 23.1).
// ---------------------------------------------------------------------------------------------------------------------
test('HSS10.750X0.500 Gr. C round: F8-1, G5, E3, H3-2', () => {
  const p = sec('HSSP', 'HSS10.750X0.500', 'A500C_P'), Fy = 46, D = 10.8, Dt = D / 0.465;
  assert.equal(p.mat.Fy, Fy); near(p.Dt, Dt, 1e-12, 'D/t');
  // F8: D/t = 23.23 <= 0.07 E/Fy = 44.13: compact (Table B4.1b case 20); phi Mn = 0.9 Fy Z (F8-1) = 0.9(46)(49.2)/12 = 169.74 kip-ft
  const f = sb.call('flexFor', p, 'x', 0, 1);
  near(f.phiMn / 12, 0.9 * Fy * 49.2 / 12, 1e-9, 'phiMn hand'); near(f.phiMn / 12, 169.7, 0.05, 'phiMn vs spreadsheet 169.7');
  // G5, Lv = 144 in: Fcr = larger of 1.60E/(sqrt(Lv/D)(D/t)^(5/4)) (G5-2a) and 0.78E/(D/t)^(3/2) (G5-2b), not over 0.6 Fy:
  // G5-2a = 1.60(29000)/(sqrt(13.33)(50.86)) = 249.2 ksi -> Fcr = 0.6(46) = 27.6 ksi; Vn = Fcr Ag/2 (G5-1) = 207.0 kip; phi Vn = 186.3
  const g5a = 1.60 * E / (SQ(144 / D) * Dt ** 1.25), g5b = 0.78 * E / Dt ** 1.5;
  const v = sb.call('shearMajor', p, 144);
  near(v.Fcr, Math.min(0.6 * Fy, Math.max(g5a, g5b)), 1e-9, 'Fcr G5'); near(v.phi * v.Vn, 186.3, 1e-9, 'phiVn');
  // E3: Lc/r = 144/3.64 = 39.56, Fe = 182.9 ksi, Fcr = 0.658^(46/182.9)(46) = 41.40 ksi; D/t <= 0.11 E/Fy = 69.35: nonslender
  // (Table B4.1a case 9); phi Pn = 0.9(41.40)(15.0) = 558.9 kip
  const Fe = Math.PI ** 2 * E / (144 / 3.64) ** 2, Fcr = Math.pow(0.658, Fy / Fe) * Fy;
  const c = sb.call('compStrength', p, 144, 144, 0);
  near(c.phiPn, 0.9 * Fcr * 15.0, 1e-9, 'phiPn hand'); near(c.phiPn, 558.9, 0.05, 'phiPn vs spreadsheet 558.9');
  // H3.1(a), L = 144 in: Fcr = larger of 1.23E/(sqrt(L/D)(D/t)^(5/4)) (H3-2a) = 191.6 ksi and 0.60E/(D/t)^(3/2) (H3-2b) = 155.5 ksi,
  // not over 0.6 Fy = 27.6 ksi -> 27.6; phi Tn = 0.9 Fcr C = 0.9(27.6)(74.1)/12 = 153.39 kip-ft
  const t = sb.call('torsionHSS', p, 144);
  near(t.F1, 1.23 * E / (SQ(144 / D) * Dt ** 1.25), 1e-9, 'H3-2a'); near(t.F2c, 0.60 * E / Dt ** 1.5, 1e-9, 'H3-2b');
  near(t.Fcr, 27.6, 1e-9, 'Fcr capped'); near(t.phiTn / 12, 0.9 * 27.6 * 74.1 / 12, 1e-9, 'phiTn'); near(t.phiTn / 12, 153.4, 0.05, 'phiTn vs review 153.4');
});

// ---------------------------------------------------------------------------------------------------------------------
// 4. Review item A1 (TLEN, PR #1468): round HSS torsion in member check mode uses the member length L in Eq. H3-2a.
//    HSS20.000X0.250, A500 Gr. C round (Fy = 46): D = 20.000, t = 0.233, D/t = 85.84, C = 141 in^3; member length 60 ft.
// ---------------------------------------------------------------------------------------------------------------------
test('A1: HSS20.000X0.250, 60 ft: H3-2a governs, phi Tn = 240.6 kip-ft (not 291.9)', () => {
  const p = sec('HSSP', 'HSS20.000X0.250', 'A500C_P'), Dt = 20 / 0.233;
  // H3-2a, L = 720 in: 1.23(29000)/(sqrt(720/20)(85.84)^1.25) = 35,670/(6 x 261.3) = 22.75 ksi
  // H3-2b: 0.60(29000)/(85.84)^1.5 = 17,400/795.3 = 21.88 ksi; Fcr = min(0.6 Fy = 27.6, max(22.75, 21.88)) = 22.75 ksi
  // phi Tn = 0.9(22.75)(141)/12 = 240.6 kip-ft. With L = 0 (the old member-mode value) H3-2a is infinite: Fcr = 27.6, 291.9 kip-ft.
  const F1 = 1.23 * E / (SQ(720 / 20) * Dt ** 1.25), F2 = 0.60 * E / Dt ** 1.5;
  const t = sb.call('torsionHSS', p, 720);
  near(t.F1, F1, 1e-9, 'H3-2a'); near(t.F2c, F2, 1e-9, 'H3-2b'); near(t.Fcr, F1, 1e-9, 'H3-2a governs');
  near(t.phiTn / 12, 0.9 * F1 * 141 / 12, 1e-9, 'phiTn hand'); near(t.phiTn / 12, 240.6, 0.05, 'phiTn 240.6');
  near(sb.call('torsionHSS', p, 0).phiTn / 12, 291.87, 1e-9, 'L = 0 gives the 0.6Fy cap');
  const row = [{ id: 'm1', name: 'T', Mux: 0, Vux: 0, Pu: 0, Muy: 0, Vuy: 0, Tu: 100 }];
  const S = { family: 'HSSP', label: 'HSS20.000X0.250', grade: 'A500C_P' };
  // member span L = 60 ft entered: 240.6 kip-ft, source "member span L"; the shear length Lv has no effect
  for (const m of [{ L: 60, Lb: 60, Lv: null }, { L: 60, Lb: 10, Lv: 5 }]) {
    const D = member(S, { ...m, rows: row });
    near(D.perCombo[0].phiTn, 0.9 * F1 * 141 / 12, 1e-9, `member mode ${JSON.stringify(m)}`);
    assert.equal(D.torsL.src, 'member span L'); assert.equal(D.warns.length, 0);
  }
  // span blank: the unbraced length Lb = 60 ft is used, with a warning
  let D = member(S, { L: null, Lb: 60, Lv: null, rows: row });
  near(D.perCombo[0].phiTn, 0.9 * F1 * 141 / 12, 1e-9, 'Lb fallback'); assert.ok(D.torsL.fallback); assert.ok(/H3-2a/.test(D.warns.join(' ')));
  // continuously braced, no length at all: H3-2a dropped, Fcr = min(27.6, 21.88) = 21.88 ksi, phi Tn = 231.4 kip-ft, with a warning
  D = member(S, { L: null, Lb: null, Lv: null, cont: true, rows: row });
  near(D.perCombo[0].phiTn, 0.9 * F2 * 141 / 12, 1e-9, 'no length: H3-2b'); assert.ok(/H3-2a/.test(D.warns.join(' ')));
  // span 30 ft: H3-2a = 32.2 ksi > 27.6, the cap governs: 291.9 kip-ft
  D = member(S, { L: 30, Lb: 30, rows: row });
  near(D.perCombo[0].phiTn, 291.87, 1e-9, '30 ft: 0.6Fy cap');
});
