// apps/light-pole/lts-engine.js (window.LpLts): the AASHTO LRFDLTS mode of "Light Pole and Sign Post.html", checked against
// hand-worked values from AASHTO LRFDLTS 1st Ed. (2015) with 2017 Interim Revisions (docs/lts-mode-plan.md §2, §3.5).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test, ROOT } from './harness.mjs';

export function ltsEngine() {
  const ctx = { console, Math, JSON }; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared/steps.js'), 'utf8').replace(/^/, 'var window = globalThis;\n'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps/light-pole/lts-engine.js'), 'utf8'), ctx, { filename: 'lts-engine.js' });
  return ctx.LpLts;
}

/* ---------- LTS-1: Table 3.8-1 MRI, Table 3.4-1 combinations ---------- */
test('LTS-1: MRI per Table 3.8-1 (p. 3-5): Typical 300/700/700/1700, High 1700, Low 300; roadside sign 10 yr', () => {
  const L = ltsEngine();
  assert.deepEqual(['lt100', '100to1k', '1kto10k', 'gt10k'].map(a => L.mri('typical', a, false).mri), [300, 700, 700, 1700]);
  assert.deepEqual(['lt100', '100to1k', '1kto10k', 'gt10k'].map(a => L.mri('high', a, false).mri), [1700, 1700, 1700, 1700]);
  assert.deepEqual(['lt100', '100to1k', '1kto10k', 'gt10k'].map(a => L.mri('low', a, false).mri), [300, 300, 300, 300]);
  assert.equal(L.mri('high', 'gt10k', true).mri, 10);
  assert.equal(L.mri('typical', '1kto10k', false).fig, 'Fig. 3.8-1');
  assert.equal(L.mri('typical', 'gt10k', false).fig, 'Fig. 3.8-2');
  assert.equal(L.mri('low', 'gt10k', false).fig, 'Fig. 3.8-3');
  assert.equal(L.mri('typical', 'gt10k', true).fig, 'Fig. 3.8-4');
});

test('LTS-1: Table 3.4-1 (p. 3-3) factors: Strength I 1.25DC; Extreme I 1.1/0.9DC + 1.0W; Service I 1.0DC + 1.0W', () => {
  const L = ltsEngine(), C = Object.fromEntries(L.COMBOS.map(c => [c.key, c]));
  assert.deepEqual([C.S1.DC, C.S1.W, C.S1.ICE], [1.25, 0, 1.25]);
  assert.deepEqual([C.E1max.DC, C.E1max.W, C.E1max.ICE, C.E1max.wind], [1.1, 1.0, 0, 'extreme']);
  assert.deepEqual([C.E1min.DC, C.E1min.W, C.E1min.wind], [0.9, 1.0, 'extreme']);
  assert.deepEqual([C.SV1.DC, C.SV1.W, C.SV1.wind], [1.0, 1.0, 'service']);
  assert.equal(L.comboLabel(C.E1max), '1.1DC + 1.0W');
});

test('LTS-1: the tool loads the engine with a classic relative script tag', () => {
  const html = fs.readFileSync(path.join(ROOT, 'Light Pole and Sign Post.html'), 'utf8');
  assert.ok(html.includes('<script src="apps/light-pole/lts-engine.js"></script>'));
});

/* ---------- LTS-2: wind (Arts. 3.8.1–3.8.7, 3.9), dead load, base actions. Hand checks HC-1 / HC-2 (docs/lts-mode-plan.md §3.5) ---------- */
const HC1 = { mode: 'pole', shape: 'round', H: 40, Dtop: 4.5, Dbase: 8, rs: 0, fixtures: [{ hf: 40, th: 0, a: 6, epa: 1.2, W: 55, armD: 2.375 }], DCpole: 300, DL: 0 };
const HC2 = { mode: 'sign', shape: 'round', H: 12, Dtop: 6.625, Dbase: 6.625, rs: 0, sign: { B: 8, s: 5, clr: 7, W: 160, nPost: 1 }, DCpole: 100, DL: 0 };
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (±${tol})`);

test('LTS-2: K_z = 2.0(z/900)^(2/9.5), z ≥ 16 ft (Eq. 3.8.4-1): 40 ft 1.038 (Table C3.8.4-1: 1.04); 9.5 ft → 16 ft 0.856', () => {
  const L = ltsEngine();
  near(L.kz(40), 1.0384, 5e-4, 'Kz(40)'); near(L.kz(9.5), 0.8562, 5e-4, 'Kz(16)');
  // Table C3.8.4-1 (p. 3-16): 20 ft 0.90, 50 ft 1.09, 100 ft 1.26
  near(L.kz(20), 0.90, 0.005, 'Kz(20)'); near(L.kz(50), 1.09, 0.005, 'Kz(50)'); near(L.kz(100), 1.26, 0.005, 'Kz(100)');
});

test('LTS-2: C_d (Table 3.8.7-1, 2017): round 1.10 / 129/(CvVd)^1.3 / 0.45; HC-1 base 0.8·130·8/12 = 69.33 → 0.522; square 2.0 − 6r_s / 1.25; sign L/W 1.6 → 1.162', () => {
  const L = ltsEngine();
  near(L.cdRound(39), 1.10, 1e-12, '≤39'); near(L.cdRound(69.3333), 0.5216, 5e-4, '69.33'); near(L.cdRound(78), 0.45, 1e-12, '≥78');
  near(L.cdSquare(0), 2.0, 1e-12, 'sq 0'); near(L.cdSquare(0.1), 1.4, 1e-12, 'sq 0.1'); near(L.cdSquare(0.125), 1.25, 1e-12, 'sq 0.125');
  near(L.cdSign(8, 5), 1.162, 1e-9, 'L/W 1.6'); near(L.cdSign(5, 5), 1.12, 1e-12, '1.0'); near(L.cdSign(30, 2), 1.30, 1e-12, '15');
  assert.equal(L.kd('round'), 0.95); assert.equal(L.kd('square'), 0.90); assert.equal(L.G, 1.14);
});

test('LTS-2 HC-1: fixture W_l = 0.00256·1.0384·0.95·1.14·130²·1.2 = 48.65·1.2 = 58.38 lb; arm C_d 1.10 (CvVd = 20.6), 53.52·(2.375/12)·6 = 63.55 lb; T = 6·58.38 + 3·63.55 = 541.0 lb·ft (wind toward 90°)', () => {
  const L = ltsEngine(), fr = L.windForces(HC1, 130, 'extreme', 90);
  const fx = fr.find(q => q.kind === 'fixture'), arm = fr.find(q => q.kind === 'arm');
  near(fx.q, 48.654, 0.005, 'q'); near(fx.Fy, 58.38, 0.01, 'W_l'); near(arm.Cd, 1.10, 1e-12, 'arm Cd'); near(arm.Fy, 63.55, 0.01, 'W_h');
  near(L.sectionWind(fr, 0).T, 6 * 58.384 + 3 * 63.554, 0.05, 'T');
  // wind along the arm (toward 0°): no arm area, no torsion
  const f0 = L.windForces(HC1, 130, 'extreme', 0); assert.equal(f0.find(q => q.kind === 'arm').Fx < 1e-9, true); near(L.sectionWind(f0, 0).T, 0, 1e-9, 'T0');
});

test('LTS-2 HC-2: sign P_z = 0.00256·0.8562·0.95·1.14·76²·1.162 = 15.93 psf; W_p = 15.93·8·5 = 637.3 lb; T = 637.3·0.15·8 = 764.8 lb·ft (Art. 3.9.4.2)', () => {
  const L = ltsEngine(), fr = L.windForces(HC2, 76, 'extreme', 0), pn = fr.find(q => q.kind === 'panel');
  near(pn.Pz, 15.93, 0.005, 'Pz'); near(pn.Fx, 637.3, 0.05, 'Wp'); near(pn.T015, 764.8, 0.05, 'T');
  // two posts: no 0.15b torsion (decision Q-C2), each post half the panel
  const two = { ...HC2, sign: { ...HC2.sign, nPost: 2, spacing: 6 } };
  assert.equal(L.windForces(two, 76, 'extreme', 0).find(q => q.kind === 'panel').T015, 0);
});

test('LTS-2: Table 3.9.3-1 case 3 = 0.75 (normal) + 0.75 (transverse); Extreme I DC 1.1/0.9 on P; Strength I 1.25 DC', () => {
  const L = ltsEngine(), ba = L.baseActions(HC1, { V: 130, Vsvc: 76, tIce: 0 });
  const r = k => ba.rows.find(x => x.combo === 'E1max' && x.lc === k);
  near(r('d45').Mx, 0.75 * (r('n0').Mx - 1.1 * 55 * 6) + 1.1 * 55 * 6, 1e-6, 'case 3 Mx');
  near(r('d45').My, 0.75 * r('t90').My, 1e-6, 'case 3 My');
  near(r('n0').P, 1.1 * (300 + 55), 1e-9, 'P E1max'); near(ba.rows.find(x => x.combo === 'E1min').P, 0.9 * 355, 1e-9, 'P E1min');
  near(ba.rows.find(x => x.combo === 'S1').P, 1.25 * 355, 1e-9, 'P S1');
});

/* ---------- LTS-3: member checks (Section 5), second order (Art. 4.8.1). HC-1 worked by hand (Python, independent of the engine):
   base D 8 × t 0.1793, F_y 55: D/t = 44.62 > λp = 0.07E/F_y = 36.91 → noncompact; Z = (8³ − 7.6414³)/6 = 10.969 in³,
   M_n = 603.27·(0.77 + 0.016·527.27/44.62) = 578.58, φM_n = 520.72 kip-in. Pole weight 465.44 lb.
   B₂ (Eq. 4.8.1-1): I_B 33.698, I_T 4.5 × 0.1793: P_eq = (I_B/I_T)^(1/3)·1.1·0.055 + 0.38·1.1·0.46544 = 0.30402 kip,
   P_E,bot = π²·29000·33.698/(2·480)² = 10.4655 kip → B₂ = 1.02992; kL/r = 447.1 ≥ 2π√(E/F_y) = 144.3 (valid).
   P_nc: KL/r = 2.1·480/2.1475 = 469.4, F_e = 1.2988, F_cr = 0.877F_e = 1.1390 ksi, φP_nc = 0.9·4.4053·1.1390 = 4.516 kip.
   φV_n = 0.9·33.0·4.4053/2 = 65.42 kip; φT_n = 0.95·(2π·3.91035²·0.1793)·33.0 = 540.04 kip-in.
   Extreme I max, wind toward 90°: V = 771.4 lb, M_y = 18,739.6 lb·ft, M_x (fixture weight) = 1.1·55·6 = 363 lb·ft,
   M_u = 224.92 kip-in, P_u = 1.1·(465.44 + 55) = 0.57248 kip, T_u = 6.4916 kip-in (T_u/T_r = 0.012 ≤ 0.20 → shear and torsion ignored);
   P_u/P_r = 0.12677 < 0.20 → Eq. 5.12.1-3: 0.12677/2 + 1.02992·224.92/520.72 = 0.06338 + 0.44485 = 0.50824.
   Governing: load case 3 (0.75·0° + 0.75·90°, Table 3.9.3-1): M_x = 0.75·(13,862.08 + 58.384·40) + 363 = 12,511.1, M_y = 0.75·18,739.6
   = 14,054.7 lb·ft → M_u = 18,816.7 lb·ft = 225.80 kip-in → 0.06338 + 1.02992·225.80/520.72 = 0.50999. ---------- */
function roundSecs(H, Dt, Db, t, den) {
  const props = D => { const Di = D - 2 * t, A = Math.PI / 4 * (D * D - Di * Di), I = Math.PI / 64 * (D ** 4 - Di ** 4), Z = (D ** 3 - Di ** 3) / 6;
    return { A, Ix: I, Iy: I, Sx: I / (D / 2), Sy: I / (D / 2), Zx: Z, Zy: Z, rx: Math.sqrt(I / A), ry: Math.sqrt(I / A) }; };
  const Dz = z => Dt + (Db - Dt) * (H - z) / H, M = 4000, dz = H / M;
  const wAbove = z => { let w = 0; for (let i = 0; i < M; i++) { const zm = (i + 0.5) * dz; if (zm > z) w += props(Dz(zm)).A / 144 * dz * den; } return w; };
  return Array.from({ length: 21 }, (_, k) => { const z = H * k / 20, D = Dz(z); return { z, shape: 'round', D, B: D, Ht: D, t, ...props(D), Wabove: wAbove(z) }; });
}
test('LTS-3 HC-1: base φM_n 520.72, φP_nc 4.516, φV_n 65.42, φT_n 540.04 kip(-in); B₂ 1.0299 (Art. 4.8.1, valid); ratio at the base 0.5100 (Eq. 5.12.1-3, load case 3)', () => {
  const L = ltsEngine(), secs = roundSecs(40, 4.5, 8, 0.1793, 490);
  const g = { ...HC1, DCpole: secs[0].Wabove, taper: true };
  const mc = L.memberCheck(g, { V: 130, Vsvc: 76, tIce: 0 }, secs, 55);
  const b = mc.rows.find(r => r.sec.z === 0);
  near(secs[0].Wabove, 465.44, 0.05, 'pole W');
  near(b.Mrx, 520.72, 0.01, 'φMn'); assert.equal(b.mx.cls, 'noncompact');
  near(b.Pr, 4.516, 0.001, 'φPnc'); near(b.Vr, 65.42, 0.01, 'φVn'); near(b.Tr, 540.04, 0.05, 'φTn');
  near(mc.Bs.E1max.B, 1.02992, 2e-5, 'B2'); assert.equal(mc.Bs.E1max.valid, true); near(mc.Bs.E1max.klr, 447.08, 0.02, 'kL/r');
  near(b.gov.ratio, 0.50999, 2e-4, 'ratio'); assert.equal(b.gov.eq, '5.12.1-3'); assert.ok(['d45', 'd315'].includes(b.gov.lc));
  near(b.gov.Mu, 225.80, 0.01, 'Mu');
});
test('LTS-3: Table 5.8.2-1 round branches and λ > λmax not permitted; Eq. 5.12.1-1 used when T_u/T_r > 0.20', () => {
  const L = ltsEngine(), sec = { shape: 'round', D: 10, t: 0.25 };
  const cl = L.classify(sec, 50); near(cl.lp, 40.6, 1e-9, 'λp'); near(cl.lrF, 179.8, 1e-9, 'λr');
  assert.equal(L.mnOf(sec, 10, 50, cl).cls, 'compact');
  const thin = { shape: 'round', D: 30, t: 0.1 }; assert.equal(L.mnOf(thin, 10, 50, L.classify(thin, 50)).cls, 'exceeds λmax (not permitted)');
  const it = L.interaction({ Pu: 1, Pr: 10, BMr: 0.5, Vr: 0.1, Tr: 0.3 }); assert.equal(it.eq, '5.12.1-1'); near(it.ratio, 0.1 + 0.9 ** 2, 1e-12, 'Eq. 5.12.1-1');
});
/* HC-2 by hand (Python, independent): post 6.625 × 0.280, F_y 42, 12 ft, 227.9 lb; D/t = 23.66 ≤ 48.33 → compact, φM_n = 0.9·Z·F_y = 426.38 kip-in;
   wind toward 0°, V = 76 mph (10-yr): post 99.92 lb (M 599.5), panel 637.3 lb at 9.5 ft → M_u = 6,653.9 lb·ft = 79.847 kip-in, T = 764.8 lb·ft;
   KL/r = 2.1·144/2.2455 = 134.67, F_cr = 13.84, φP_nc = 69.52 kip; P_u = 1.1·(227.9 + 160) = 0.42670 kip; B = 1/(1 − P_u/P_e) = 1.00487 (Eq. 5.12.1-10);
   T_u/T_r = 9.177/423.90 = 0.0216 → Eq. 5.12.1-3: 0.00614/2 + 1.00487·79.847/426.38 = 0.19125. */
test('LTS-3 HC-2: monopost φM_n 426.38, B 1.00487 (prismatic, Eq. 5.12.1-10), base ratio 0.1912 (Eq. 5.12.1-3, case 1 normal)', () => {
  const L = ltsEngine(), secs = roundSecs(12, 6.625, 6.625, 0.28, 490);
  const g = { ...HC2, DCpole: secs[0].Wabove, taper: false };
  const mc = L.memberCheck(g, { V: 76, Vsvc: 76, tIce: 0 }, secs, 42), b = mc.rows.find(r => r.sec.z === 0);
  near(secs[0].Wabove, 227.905, 0.01, 'W'); near(b.Mrx, 426.378, 0.01, 'φMn'); near(b.Pr, 69.524, 0.01, 'φPnc'); near(b.Tr, 423.90, 0.05, 'φTn');
  near(mc.Bs.E1max.B, 1.004868, 2e-6, 'B'); assert.equal(mc.Bs.E1max.method, '5.12.1-10');
  near(b.gov.ratio, 0.19125, 2e-4, 'ratio'); assert.ok(['n0', 'n180'].includes(b.gov.lc));
});

/* ---------- LTS-5: deflection (Art. 10.4.2.1), fatigue applicability (Arts. 11.4, 11.7.2), breakaway (Art. 2.5.2) ----------
   HC-2 by hand (closed form, Service I, V_svc 76 mph, C_v 1.0): post C_d = 129/(76·0.5521)^1.3 = 1.0021, uniform w = 0.00256·0.8562·0.95·1.14·76²·1.0021·0.5521
   = 7.586 lb/ft (K_z at 16 ft over the whole post); panel P = 637.3 lb at a = 9.5 ft. EI = 29000·28.14 kip-in².
   Δ = P a²(3L − a)/(6EI) + wL⁴/(8EI) = 0.53787 + 0.04163 = 0.57950 in; B (Eq. 5.12.1-10, 1.0DC) = 1.00442 → Δ = 0.5821 in ≤ 0.025·144 = 3.60 in.
   Slope = [Pa²/(2EI) + wL³/(6EI)]·B·12 = 0.0658 in/ft. */
test('LTS-5 HC-2: Service I top deflection 0.582 in (hand closed form), 2.5 % H limit 3.60 in; slope information only (no moment load)', () => {
  const L = ltsEngine(), secs = roundSecs(12, 6.625, 6.625, 0.28, 490);
  const g = { ...HC2, DCpole: secs[0].Wabove, taper: false };
  const d = L.deflection(g, { V: 76, Vsvc: 76, tIce: 0 }, secs, 42);
  near(d.B, 1.00442, 2e-5, 'B'); const n0 = d.rows.find(r => r.lc === 'n0');
  near(n0.d, 0.58206, 0.002, 'Δ'); near(n0.slope, 0.0658, 0.0005, 'slope');
  const tr = d.checks.find(c => c.key === 'trans'); near(tr.limit, 3.60, 1e-9, 'limit'); assert.equal(tr.ok, true);
  assert.equal(d.checks.find(c => c.key === 'slope').applies, false); assert.equal(d.checks.some(c => c.key === 'lum'), false);
});
test('LTS-5: fatigue not required < 55 ft and for roadside signs; required (HMLT, outside the tool) at ≥ 55 ft; breakaway checklist', () => {
  const L = ltsEngine();
  assert.equal(L.fatigue(HC1).required, false); assert.equal(L.fatigue(HC2).required, false);
  assert.equal(L.fatigue({ ...HC1, H: 55 }).hmlt, true);
  assert.equal(L.breakaway(false).needed, false); assert.ok(L.breakaway(true).items.length >= 6);
  // HC-1 has an arm-mounted fixture with an unbalanced dead load: the 0.35 in/ft slope check applies; the luminaire limit is 10 % H = 48 in
  const secs = roundSecs(40, 4.5, 8, 0.1793, 490), d = L.deflection({ ...HC1, DCpole: secs[0].Wabove, taper: true }, { V: 130, Vsvc: 76, tIce: 0 }, secs, 55);
  assert.equal(d.checks.find(c => c.key === 'slope').applies, true); near(d.checks.find(c => c.key === 'lum').limit, 48, 1e-9, '0.10H');
});
