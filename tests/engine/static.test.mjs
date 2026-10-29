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
