// shared/moving-load.js additions of 2026-10-29: staticAnalysis, camber, and analyze() with 5+ spans.
// Closed-form hand checks (uniform section unless stated); tolerance 1e-7 relative (round-off of the dense LU solve). E 29000 ksi, I 10000 in^4: EI = 29000*10000/144 kip-ft^2.
import assert from 'node:assert/strict';
import { loadShared, test } from './harness.mjs';

const W = loadShared('vehicles.js', 'moving-load.js'), S = W.SharedMovingLoad;
const E = 29000, I = 10000, EI = E * I / 144;
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
const at = (r, x) => r.x.findIndex(v => Math.abs(v - x) < 1e-6);

test('simple span 100 ft, w = 1 klf: M = wL²/8, R = wL/2, δ = 5wL⁴/(384EI)', () => {
  const r = S.staticAnalysis({ spans: [100], E, segs: [{ len: 0, I }], loads: { w: 1 } }), i = at(r, 50);
  close(r.M[i], 1250, 1e-7, 'M mid'); close(r.R[0], 50, 1e-7, 'R_A'); close(r.R[1], 50, 1e-7, 'R_B');
  close(r.defl[i], 5 * 1e8 / (384 * EI) * 12, 1e-7, 'δ mid (in)');   // 7.7586 in
  close(r.VR[0], 50, 1e-7, 'V at A'); close(r.VL[at(r, 100)], -50, 1e-7, 'V at B');
});

test('simple span 100 ft, P = 10 kips at 30 ft: M = Pab/L, δ under the load = Pa²b²/(3EIL)', () => {
  const r = S.staticAnalysis({ spans: [100], E, segs: [{ len: 0, I }], loads: { P: [[30, 10]] }, stations: [0, 30, 100] }), i = at(r, 30);
  close(r.M[i], 10 * 30 * 70 / 100, 1e-7, 'M'); close(r.VL[i], 7, 1e-7, 'V left'); close(r.VR[i], -3, 1e-7, 'V right');
  close(r.defl[i], 10 * 900 * 4900 / (3 * EI * 100) * 12, 1e-7, 'δ');
});

test('SB2-X1: point load 0.005 ft from a node (station): exact ΣR, reactions, M and V (applied inside its element)', () => {
  // Simple span 100 ft, w = 1 klf + P = 10 kips at a = 49.995 ft (station 50 ft is 0.005 ft away; h_max = 100/240 = 0.4167 ft, so
  // 0.005 < 0.05 h_max: the load is not meshed as a 0.005 ft element). R_A = 50 + 10(100 − 49.995)/100 = 55.0005; R_B = 50 + 4.9995
  // = 54.9995; ΣR = 110. M(50) = 1250 + 10(49.995)(50)/100 = 1250 + 249.975 = 1499.975 kip-ft; V(50) = 55.0005 − 50 − 10 = −4.9995.
  // Tolerance 1e-7 as the file's other checks: the same solve with w alone is off by 1.6e-8 relative (round-off), and so is P at the node.
  const r = S.staticAnalysis({ spans: [100], E, segs: [{ len: 0, I }], loads: { w: 1, P: [[49.995, 10]] } }), i = at(r, 50);
  close(r.R[0], 55.0005, 1e-7, 'R_A'); close(r.R[1], 54.9995, 1e-7, 'R_B'); close(r.R[0] + r.R[1], 110, 1e-7, 'ΣR');
  close(r.M[i], 1499.975, 1e-7, 'M(50)'); close(r.VL[i], -4.9995, 1e-7, 'V left of 50'); close(r.VR[i], -4.9995, 1e-7, 'V right of 50');
  const j = at(r, 45); close(r.VL[j], 55.0005 - 45, 1e-7, 'V(45)'); close(r.M[j], 55.0005 * 45 - 45 * 45 / 2, 1e-7, 'M(45)');
  // Continuous 110 + 140 + 110 ft, segments I 60000 / 120000 / 60000 in⁴, w = 1.2 klf, P = 1 kip at 222 − 0.005 ft (next to the 222 ft
  // station): ΣR = 1.2(360) + 1 = 433 kips. Before the fix ΣR was off by 6.6e-3 kips (0.005 ft element; 0.31 kips at 0.001 ft).
  const spans = [110, 140, 110], segs = [{ len: 100, I: 60000 }, { len: 30, I: 120000 }, { len: 100, I: 60000 }];
  [0.005, 0.001, 1e-4].forEach(d => { const q = S.staticAnalysis({ spans, E, segs, loads: { w: 1.2, P: [[222 - d, 1]] } });
    close(q.R.reduce((a, b) => a + b, 0), 433, 1e-11, `ΣR, load ${d} ft from the node`); });
  // continuity: the moment at 222 ft tends to the value with the load at the node
  const m0 = S.staticAnalysis({ spans, E, segs, loads: { w: 1.2, P: [[222, 1]] } }), m1 = S.staticAnalysis({ spans, E, segs, loads: { w: 1.2, P: [[222 - 1e-5, 1]] } }), k = at(m0, 222);
  close(m1.M[k], m0.M[k], 1e-6, 'M(222) continuous in the load position');
});

test('2 equal spans 100 ft, w = 1: M_B = −wL²/8, R = 3/8, 10/8, 3/8 wL', () => {
  const r = S.staticAnalysis({ spans: [100, 100], E, segs: [{ len: 0, I }], loads: { w: 1 } });
  close(r.M[at(r, 100)], -1250, 1e-7, 'M_B'); close(r.R[0], 37.5, 1e-7, 'R_A'); close(r.R[1], 125, 1e-7, 'R_B');
});

test('5 equal spans 100 ft, w = 1: M_B = −2/19 wL², M_C = −3/38 wL², R_A = 15/38 wL', () => {
  const r = S.staticAnalysis({ spans: [100, 100, 100, 100, 100], E, segs: [{ len: 0, I }], loads: { w: 1 } });
  close(r.M[at(r, 100)], -2 / 19 * 1e4, 1e-7, 'M_B'); close(r.M[at(r, 200)], -3 / 38 * 1e4, 1e-7, 'M_C');
  close(r.R[0], 15 / 38 * 100, 1e-7, 'R_A'); close(r.R.reduce((a, b) => a + b, 0), 500, 1e-7, 'ΣR');
});

test('simple spans (2 × 100, simple: true): pier moment 0, pier reaction wL', () => {
  const r = S.staticAnalysis({ spans: [100, 100], E, segs: [{ len: 0, I }], loads: { w: 1 }, simple: true });
  close(r.M[at(r, 100)], 0, 1e-7, 'M_B'); close(r.R[1], 100, 1e-7, 'R_B'); close(r.M[at(r, 150)], 1250, 1e-7, 'M mid span 2');
  close(r.VL[at(r, 100)], -50, 1e-7, 'V left of B'); close(r.VR[at(r, 100)], 50, 1e-7, 'V right of B');
});

test('variable EI (stiffer middle third) and partial load: equilibrium; camber = sum of stages', () => {
  const segs = [{ len: 40, I }, { len: 40, I: 3 * I }, { len: 0, I }];
  const s1 = { spans: [60, 60], E, segs, loads: { w: 1.2 } }, s2 = { spans: [60, 60], E, segs: segs.map(s => ({ ...s, I: s.I * 2 })), loads: { dist: [[10, 70, 0.5]], P: [[90, 5]] } };
  const r2 = S.staticAnalysis(s2); close(r2.R.reduce((a, b) => a + b, 0), 0.5 * 60 + 5, 1e-7, 'ΣR');
  const c = S.camber([s1, s2]), a = S.staticAnalysis(s1);
  c.x.forEach((_, i) => close(c.total[i], a.defl[i] + r2.defl[i], 1e-12, 'camber sum'));
});

test('analyze(): 5 spans run (HL-93), the engine-check reads n/a for theory; results symmetric', () => {
  const P = W.SharedVehicles.build().presets, p = P['HL93-Truck'], spans = [80, 100, 100, 100, 80];
  const m = { spans, E, segs: [{ len: 0, I, bad: false }], axles: p.axles.map(a => [...a]), short: 'HL93-Truck', stdLane: null, udl: { ...p.udl },
    vK: 3, vMin: 14, vMax: 30, neglect: true, dirs: [1, -1], secondary: 'HL93-Tandem', multi: true, mScale: 0.9, mHmin: 50, mFixed: 14,
    imp: { method: 'const', val: 1.33, S: 6.5, bal: false, onUdl: false }, llf: 1, dfM: spans.map(() => 1), dfV: spans.map(() => 1), dfNeg: 0, step: 1, hStep: 2 };
  const R = S.analyze(m, { refine: false, vehicles: P });
  assert.match(R.check, /theory: n\/a wL²/);
  const reac = R.effs.map((ef, i) => [ef, R.res[i]]).filter(([ef]) => ef.t === 'R').map(([, r]) => r.max);
  assert.equal(reac.length, 6); close(reac[0], reac[5], 1e-6, 'R_A = R_F'); close(reac[1], reac[4], 1e-6, 'R_B = R_E');
});
