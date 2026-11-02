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
