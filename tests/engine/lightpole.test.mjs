// "Light Pole and Sign Post.html": the tool's own engine functions (loaded from the page text by lp-source.mjs), checked
// against the hand checks of the 2026-11-01 deep review (§3, Cases 1–3) and the fixlog check cases. Arithmetic in the comments.
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { lpEngine, lpDefaultInp } from './lp-source.mjs';

const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
const near = (a, b, abs, what) => assert.ok(Math.abs(a - b) <= abs, `${what}: ${a} vs ${b} (±${abs})`);
const FIX = { hf: 35, th: 0, a: 6, epa: 1.6, aIce: 1.6, tIce: 0.5, W: 55 };
const CAB = { hc: 32, th: 15, L: 80, s: 4, D: 0.75, g: 0.35 };

/* ---------- Case 1: default light pole, ASCE 7-22 wind on fixture, cable and mast ---------- */
test('Case 1: K_z(35 ft, Exp. C) = 2.01(35/900)^(2/9.5) = 1.0147', () => {
  const lp = lpEngine();
  near(lp.call('Kz', 35, 'C'), 1.0147, 5e-5, 'Kz(35)');
  near(lp.call('Kz', 32, 'C'), 0.9957, 5e-5, 'Kz(32)');
  // below 15 ft K_z is taken at 15 ft
  close(lp.call('Kz', 5, 'C'), lp.call('Kz', 15, 'C'), 1e-12, 'Kz floor 15 ft');
});

test('Case 1: fixture q_z·G = 0.00256·1.0147·1.0·1.0·115²·0.85 = 29.20 psf; F_w = 29.20·1.6·1.1 = 51.39 lb', () => {
  const lp = lpEngine();
  const fx = lp.call('fixtureComponents', FIX, lpDefaultInp());
  near(fx.qz, 29.20, 0.005, 'q_z·G');
  near(fx.Fw, 51.39, 0.01, 'F_w');
  near(fx.ex, 6, 1e-9, 'e_x'); near(fx.ey, 0, 1e-9, 'e_y');
});

test('Case 1: cable q_W = 0.00256·0.9957·13225·1.1·0.85 = 31.52 psf; w_h = 31.52·0.75/12 = 1.970 lb/ft; H_D = 0.35·80²/(8·4) = 70.0 lb', () => {
  const lp = lpEngine();
  const cp = lp.call('cableComponents', CAB, lpDefaultInp());
  near(cp.qW, 31.52, 0.005, 'q_W');
  near(cp.W_h, 1.970, 0.0005, 'w_h');
  near(cp.pullFromLoad(0.35), 70.0, 1e-9, 'H_D');
  // ASD D + 0.6W: w_R = √(0.35² + (0.6·1.970)²) = 1.233 lb/ft; H = 1.233·6400/32 = 246.6 lb
  const r = cp.react(0.35, 0.6 * cp.W_h);
  near(r.wRes, 1.233, 0.0005, 'w_R'); near(r.Hpull, 246.6, 0.1, 'H (D + 0.6W)');
  near(r.Hw, 0.6 * cp.W_h * 40, 1e-9, 'transverse w_h·L/2');
});

/* ---------- Case 2: default pole base section (AISC 360-16) and anchors (ACI 318-19) ---------- */
test('Case 2: base section D 10 × t 0.25: A 7.658, I = π/64(10⁴ − 9.5⁴) = 91.05, S 18.21, Z 23.77 in³; F8 compact, M_n = 50·23.77 = 1,188.5 kip·in', () => {
  const lp = lpEngine();
  const p = lp.call('hssProps', 'round', { D: 10, t: 0.25 });
  near(p.A, 7.658, 0.0005, 'A'); near(p.Ix, 91.054, 0.001, 'I'); near(p.Sx, 18.21, 0.005, 'S'); near(p.Zx, 23.77, 0.005, 'Z');
  const mn = lp.call('hssMn', 'round', p.Sx, p.Zx, p.slend, 50, 29000);
  assert.equal(mn.cls, 'compact'); near(mn.lp, 40.6, 1e-9, 'λp = 0.07E/Fy');
  near(mn.Mn, 1188.5, 0.1, 'M_n');
});

test('Case 2: IBC §1807.3.2.1 embedment, P 477.1 lb, h 24.28 ft, b 3 ft, S1 150: d = 6.24 ft', () => {
  const lp = lpEngine();
  lp.set('isoFac', 1); lp.set('constraint', 'non');
  const e = lp.call('solveEmbed', 477.1, 477.1 * 24.28, 24.28, lpDefaultInp());
  // d = 6.24: S1 = 150·6.24/3 = 312; A = 2.34·477.1/(312·3) = 1.193; d = 0.5·1.193·(1 + √(1 + 4.36·24.28/1.193)) = 6.25
  near(e.d, 6.244, 0.002, 'd');
});

test('Case 2: anchors (6) 1 in F1554 Gr 55, BC 16: A_se 0.6057, φN_sa 34,073 lb, N_b 115,918 lb, T_max = 239,388·8/192 − 1,087.8/6', () => {
  const lp = lpEngine();
  lp.set('anchRe', 'yes');
  const b = lp.call('anchorBolts', lpDefaultInp(), { Mang: 0 }, { Mu: 19949, Pu: 1087.8, Vu: 500 });
  near(b.Ase, 0.6057, 5e-5, 'A_se = π/4(1 − 0.9743/8)²');
  near(b.phiNsa, 34073, 1, 'φN_sa = 0.75·0.6057·75,000');
  near(b.Nb, 115918, 1, 'N_b = 24√4000·18^1.5');
  near(b.sumY2, 192, 1e-9, 'Σy² = 2·64 + 4·16');
  near(b.Tmax, 19949 * 12 * 8 / 192 - 1087.8 / 6, 1e-6, 'T_max');
  near(b.psi_ed, 0.7 + 0.3 * 10 / 27, 1e-12, 'ψ_ed,N');
});

/* ---------- Case 3: default monopost sign ---------- */
function signInp() {
  return lpDefaultInp({ mode: 'sign', signPosts: 1, H: 16, poleTaper: false, poleDiaBase: 6.0, poleTwBase: 0.1875 });
}
test('Case 3: sign q_h·G = 0.00256·0.8605·0.85·0.85·115² = 21.05 psf; C_f(s/h 0.375, B/s 2) = 1.7625; F_A = 2,671 lb', () => {
  const lp = lpEngine();
  const sw = lp.call('signWind', signInp());
  near(sw.Kzh, 0.8605, 5e-5, 'K_z(16)');
  near(sw.qh, 21.05, 0.005, 'q_h·G');
  near(sw.cfAB, 1.7625, 1e-9, 'C_f');
  near(sw.F_A, 2671, 1, 'F_A');
});

test('Case 3: Case C (B/s = 2): 21.05·(2.25 + 1.50)·36 = 2,842 lb; x_R = 5.40 ft from the windward edge', () => {
  const lp = lpEngine();
  const sw = lp.call('signWind', signInp());
  near(sw.caseC.F, 2842, 1, 'F_C');
  near(sw.caseC.xR, 5.40, 0.005, 'x_R');
});

test('Fig. 29.3-1 Case A/B table: s/h 0.375 between the 0.3 and 0.5 rows; s/h 1 row at B/s 45 = 1.30', () => {
  const lp = lpEngine();
  near(lp.call('signCfAB', 0.375, 2), 1.80 - 0.375 * (1.80 - 1.70), 1e-12, 'interp');
  near(lp.call('signCfAB', 1.0, 45), 1.30, 1e-12, 'corner');
});

/* ---------- fixlog TQ3: square shaft edge distance per bolt ---------- */
test('TQ3: square shaft b 2 ft, (4) 1 in on BC 16 at θ_b 45°: c_a,min = 12 − 8·0.7071 = 6.34 in', () => {
  const lp = lpEngine();
  const b = lp.call('anchorBolts', lpDefaultInp({ shaftShape: 'square', b: 2, boltQty: 4, boltTheta: 45 }), { Mang: 0 }, { Mu: 1000, Pu: 0, Vu: 0 });
  near(b.ca17, 6.343, 0.001, 'c_a,min');
  assert.equal(b.edOK, true);
});

/* ---------- LP-R3: pole/post C_f from ASCE 7-22 Fig. 29.4-1 (added 2026-11-01) ---------- */
test('Fig. 29.4-1: default pole (round 6–10 in, 35 ft): D√q_z > 2.5, h/D = 35/0.667 = 52.5 → moderately smooth 0.7', () => {
  const lp = lpEngine();
  const a = lp.call('cfPoleFig2941', lpDefaultInp({ cfPoleSurf: 'smooth' }));
  // q_z(17.5) = 0.00256·2.01(17.5/900)^0.2105·13225; D = 8/12
  near(a.hD, 52.5, 1e-9, 'h/D'); assert.equal(a.row, 'smooth'); assert.ok(a.Dsq > 2.5); near(a.cf, 0.7, 1e-12, 'C_f');
});
test('Fig. 29.4-1: 4 in round post, 16 ft: q_z(8 → 15 ft) = 0.00256·0.849·13225 = 28.74, D√q_z = 0.333·5.361 = 1.79 ≤ 2.5 → 1.2', () => {
  const lp = lpEngine();
  const a = lp.call('cfPoleFig2941', lpDefaultInp({ H: 16, poleDiaTop: 4, poleDiaBase: 4, cfPoleSurf: 'smooth' }));
  near(a.qz, 28.74, 0.01, 'q_z'); near(a.Dsq, 1.787, 0.002, 'D√q_z'); assert.equal(a.row, 'lowq'); near(a.cf, 1.2, 1e-12, 'C_f');
});
test('Fig. 29.4-1: 8 in square post, 16 ft: h/D = 24 → 1.4 + (24 − 7)/(25 − 7)·(2.0 − 1.4) = 1.967; hex/oct pole 35 ft → 1.4', () => {
  const lp = lpEngine();
  const a = lp.call('cfPoleFig2941', lpDefaultInp({ H: 16, poleShape: 'square', poleDiaTop: 8, poleDiaBase: 8 }));
  near(a.cf, 1.4 + 17 / 18 * 0.6, 1e-12, 'square');
  near(lp.call('cfPoleFig2941', lpDefaultInp({ cfPoleSurf: 'poly' })).cf, 1.4, 1e-12, 'poly');
  // rectangular 8 × 6 in: D = least dimension 6 in → h/D = 35/0.5 = 70 → 2.0
  near(lp.call('cfPoleFig2941', lpDefaultInp({ poleShape: 'rect', poleDiaTop: 8, poleDiaBase: 8, poleDepthTop: 6, poleDepthBase: 6 })).cf, 2.0, 1e-12, 'rect');
});

/* ---------- LP-R6: pullout bearing area of the heavy hex nut (added 2026-11-01) ---------- */
test('Pullout: 1 in heavy hex nut F = 1.625 in, A_brg = 0.866·1.625² − 0.785·1² = 1.5015 in²; φN_p = 0.70·8·1.5015·4000 = 33,632 lb', () => {
  const lp = lpEngine();
  const b = lp.call('anchorBolts', lpDefaultInp(), { Mang: 0 }, { Mu: 19949, Pu: 1087.8, Vu: 500 });
  near(b.nutF, 1.625, 1e-12, 'F');
  near(b.Abrg, Math.sqrt(3) / 2 * 1.625 ** 2 - Math.PI / 4, 1e-12, 'A_brg'); near(b.Abrg, 1.5015, 0.0001, 'A_brg');
  near(b.phiNp, 0.70 * 8 * b.Abrg * 4000, 1e-9, 'φN_p'); near(b.phiNp, 33632, 1, 'φN_p');
  // 1½ in: F = 2.375, A_brg = 0.866·2.375² − 0.785·1.5² = 3.118 in²
  near(lp.call('anchorBolts', lpDefaultInp({ boltDia: 1.5 }), { Mang: 0 }, { Mu: 19949, Pu: 1087.8, Vu: 500 }).Abrg, 3.118, 0.0005, 'A_brg 1.5');
});

/* ---------- LP-R2: anchor reinforcement check, ACI 318-19 §17.5.2.1 (added 2026-11-01) ---------- */
test('Anchor reinforcement: 2 #6 per anchor, x 3 in, h_ef 18, cover 3: φA_sf_y = 0.75·0.88·60000 = 39,600 lb; l_d = 60000/(25√4000)·0.75 = 28.5 in > l_avail = 18 − 3/1.5 − 3 = 13.0 in', () => {
  const lp = lpEngine();
  lp.set('anchRe', 'yes');
  const inp = lpDefaultInp({ arBars: 2, arBar: 'shaft', arX: 3 });
  inp.arShaftBar = lp.call('barByName', '#6');
  const b = lp.call('anchorBolts', inp, { Mang: 0 }, { Mu: 19949, Pu: 1087.8, Vu: 500 });
  near(b.ar.phiNar, 39600, 1e-6, 'φN_ar'); assert.equal(b.ar.okN, true);
  near(b.ar.ld, 60000 / (25 * Math.sqrt(4000)) * 0.75, 1e-9, 'l_d'); near(b.ar.ld, 28.46, 0.01, 'l_d');
  near(b.ar.lAvail, 13.0, 1e-9, 'l_avail'); assert.equal(b.ar.okLd, false); assert.equal(b.ar.okX, true);
  // #8 bars (l_d uses 20): 60000/(20√4000)·1.0 = 47.4 in
  const b8 = lp.call('anchorBolts', lpDefaultInp({ arBars: 2, arBar: '#8', arX: 3 }), { Mang: 0 }, { Mu: 19949, Pu: 1087.8, Vu: 500 });
  near(b8.ar.ld, 60000 / (20 * Math.sqrt(4000)), 1e-9, 'l_d #8');
  lp.set('anchRe', 'no');
  assert.equal(lp.call('anchorBolts', inp, { Mang: 0 }, { Mu: 19949, Pu: 1087.8, Vu: 500 }).ar, null);
});

/* ---------- LP-R4: base plate, bending line at the pole face, double-nut (added 2026-11-01) ---------- */
test('Base plate: D 10, BC 16, n 6, F_y 36: b_eff = π·10/6 = 5.236 in, m = 3 in; P_rod = max(T, C); t = √(4·P·3/(0.9·36000·5.236))', () => {
  const lp = lpEngine();
  const b = lp.call('anchorBolts', lpDefaultInp({ bpFy: 36, bpT: 1.25 }), { Mang: 0 }, { Mu: 19949, Pu: 1087.8, Vu: 500 });
  near(b.beff, Math.PI * 10 / 6, 1e-12, 'b_eff'); near(b.m, 3, 1e-12, 'm');
  // compression rod: 19,949·12·8/192 + 1,087.8/6 = 9,974.5 + 181.3 = 10,155.8 lb > T_max 9,793.2
  near(b.Cmax, 19949 * 12 * 8 / 192 + 1087.8 / 6, 1e-6, 'C_max'); near(b.Prod, b.Cmax, 1e-9, 'P_rod');
  near(b.tpReq, Math.sqrt(4 * b.Cmax * 3 / (0.9 * 36000 * Math.PI * 10 / 6)), 1e-12, 't_req'); near(b.tpReq, 0.848, 0.001, 't_req');
  assert.equal(b.tpOK, true);
  // P_u = 0: T = C = 9,974.5 lb → t = √(4·9974.5·3/(0.9·36000·5.236)) = 0.840 in
  near(lp.call('anchorBolts', lpDefaultInp({ bpFy: 36, bpT: 1.25 }), { Mang: 0 }, { Mu: 19949, Pu: 0, Vu: 0 }).tpReq, 0.840, 0.002, 'P_u = 0');
});
