// Crane Pick Analyzer (apps/crane-pick), C4: ground and supports (engine/ground.js): outrigger float loads (rigid body, four floats on
// a rectangle; three when one lifts), crawler track pressures (inside / outside the kern), the bounding estimate (proved ≥ the
// rigid-body result over random cases), mats (spread, bending, shear), ground bearing, stress at depth (shared/boussinesq.js), units.
// Node only, with the SYNTHETIC cranes of tests/smoke/crane-fake-*.json (made-up values).
//   node tests/engine/run.mjs crane-ground
//
// Hand checks (independent arithmetic, done by hand / calculator; the numbers below are those results):
// A. Symmetric (fake wheeled crane: floats at x = ±12 ft, spread 24 ft → b = 12, a = 12, x̄ = 0; boom-foot e = 2 ft):
//    W_c 40,000 lb at x_c 0; W_u 30,000 at x_u 0; W_cw 20,000 at r_cw 10; W_b 6,000, f_b 0.5 → x_b = 2 + 0.5(30 − 2) = 16;
//    hook W 22,000 at R 30, θ = 0 (over the front):  V = 118,000 lb;
//    ΣWx = −20,000·10 + 6,000·16 + 22,000·30 = −200,000 + 96,000 + 660,000 = 556,000 → X = 4.711864 ft, Y = 0;
//    u = 4.711864/12 = 0.392655, v = 0 → |u| + |v| ≤ 1: front floats V/4 (1 + u) = 29,500 × 1.392655 = 41,083.33 lb each,
//    rear 29,500 × 0.607345 = 17,916.67 lb each (Σ = 118,000).
// B. Eccentric (as A with x_c = 1.5, x_u = −2, θ = 60°: û = (0.5, −0.866025)):
//    positions c (1.5, 0), u (−1, 1.732051), cw (−5, 8.660254), b (8, −13.856406), hook (15, −25.980762);
//    ΣWx = 60,000 − 30,000 − 100,000 + 48,000 + 330,000 = 308,000 → X = 2.610169; ΣWy = 51,961.52 + 173,205.08 − 83,138.44
//    − 571,576.76 = −429,548.60 → Y = −3.640242; u = 0.217514, v = −0.303354 (|u| + |v| = 0.520868 ≤ 1):
//    FL 29,500(1 + u + v) = 26,967.74; FR 29,500(1 + u − v) = 44,865.60; RL 29,500(1 − u + v) = 14,134.40; RR 29,500(1 − u − v) = 32,032.26.
// C. Three floats (as B with W = 60,000): V = 156,000, X = 5.628205, Y = −9.082164, u = 0.469017, v = −0.756847, |u| + |v| = 1.225864 > 1:
//    the heaviest FR = V(|u| + |v|)/2 = 95,617.40; FL (same end) V(1 − |v|)/2 = 18,965.93; RR (same side) V(1 − |u|)/2 = 41,416.67; RL 0.
// D. Crawler (fake crawler: track length 26, gauge 18, shoe 3 ft; e = 0): W_c 200,000 at 1.0; W_u 50,000 at −3; W_cw 150,000 at 15;
//    W_b 30,000 (x_b = 0.5 R = 20); θ = 0, R = 40:
//    W 60,000 → V 490,000, X = 800,000/490,000 = 1.632653 ≤ 26/6 = 4.3333 (inside the kern): V_L = V_R = 245,000;
//      q_max = 245,000/(3 · 26)·(1 + 6 · 1.632653/26) = 3,141.03 × 1.376766 = 4,324.46 psf, q_min = 1,957.59 psf;
//    W 150,000 → V 580,000, X = 4,400,000/580,000 = 7.586207 > 4.3333 (outside): L_b = 3(13 − 7.586207) = 16.241379 ft,
//      q_max = 2 · 290,000/(3 · 16.241379) = 11,903.75 psf.
// E. Mats (float 2 ft → a = 2√π/2 = 1.772454 ft; P = 44,865.60 lb): timber 4 × 4 ft, t = 12 in, k = 1: B_e = min(4, 1.772454 + 2) =
//    3.772454, A_e = 14.231407 ft², q = 3,152.58 psf, q_g = 3,152.58 + 50 · 1 = 3,202.58 psf; c = 1.000000 ft; M = q c²/2 = 1,576.29
//    lb·ft/ft, V = q c = 3,152.58 lb/ft; F_b' 1,200 psi → M_a = 1,200 · 144 · 1²/6 = 28,800; F_v' 150 psi → V_a = 2 · 150 · 144 · 1/3 =
//    14,400 lb/ft. Steel plate 4 × 4 ft, t = 1 in, F_y 36 ksi: B_e = 1.772454 + 2/12 = 1.939121, A_e = 3.760190, q = 11,931.74 psf,
//    q_g = 11,931.74 + 490/12 = 11,972.58; c = 0.083333; M = 41.43; M_a = 36 · 144,000 · (1/12)²/(4 · 1.67) = 5,389.22 lb·ft/ft;
//    V_a = 0.6 · 36 · 144,000 · (1/12)/1.50 = 172,800 lb/ft. No mat: q_g = 44,865.60/(π · 2²/4) = 14,281.16 psf.
// F. Stress at depth (A, heading 90° so the front is east; a pipe under the front floats at depth 3 ft): under FL, the float as the
//    1.772454 ft square at q = 41,083.33/1.772454² = 13,077.23 psf; m = n = 0.886227/3 = 0.295409, I = 0.036362 →
//    own 4 q I = 1,902.04; FR (24 ft away) 0.064, RL 0.028, RR 0.005 → Δσ_z = 1,902.14 psf.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { test, loadShared, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps', 'crane-pick', 'engine');
const W = loadShared('steps.js', 'boussinesq.js', path.join(APP, 'geo.js'), path.join(APP, 'osha.js'), path.join(APP, 'cranes.js'), path.join(APP, 'lift.js'), path.join(APP, 'elev.js'), path.join(APP, 'ground.js'));
const K = W.CranePickCranes, GR = W.CranePickGround, BQ = W.SharedBoussinesq;
const fake = n => K.parse(JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'smoke', `crane-fake-${n}.json`), 'utf8'))).crane;
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const grp = (c, id) => K.groups(c).find(g => Object.values(g.configs).some(x => x.id === id)).key;
const withPh = (c, ph) => { const d = JSON.parse(JSON.stringify(c)); d.app_inputs = Object.assign({}, d.app_inputs, { ph4: ph }); return d; };
const WH0 = fake('wheeled'), CR0 = fake('crawler');
const U = o => Object.assign({ x: 1000, y: 2000, heading: 0, group: grp(WH0, 'or-full-360'), boom: 60, mode: null, pad: 100 }, o);
const UC = o => Object.assign({ x: 0, y: 0, heading: 0, group: grp(CR0, 'rear-150k'), boom: 100, mode: null }, o);
const PH_A = { carrierLb: 40000, carrierCg: 0, upperLb: 30000, upperCg: 0, boomLb: 6000, cwRad: 10 };
const PH_B = Object.assign({}, PH_A, { carrierCg: 1.5, upperCg: -2 });
const PH_D = { carrierLb: 200000, carrierCg: 1, upperLb: 50000, upperCg: -3, boomLb: 30000, cwRad: 15 };

test('units: ksf ↔ psf, kip ↔ lb, in → ft, psi / ksi → psf', () => {
  assert.equal(GR.U.psfPerKsf, 1000); assert.equal(GR.U.lbPerKip, 1000); near(12 * GR.U.ftPerIn, 1, 1e-15); assert.equal(GR.U.psfPerPsi, 144); assert.equal(GR.U.psfPerKsi, 144000);
  near(2.5 * GR.U.psfPerKsf, 2500, 1e-12, '2.5 ksf = 2,500 psf'); near(1200 * GR.U.psfPerPsi, 172800, 1e-9, '1,200 psi = 172,800 psf');
});

test('A. symmetric: four floats, rigid body, hand check', () => {
  const c = withPh(WH0, PH_A), u = U(), inp = GR.inputsOf(c, u), S = GR.supports(c, u);
  assert.equal(inp.mode, 'rigid'); assert.equal(inp.Wcw, 20000); assert.equal(inp.from.Wcw, 'chart configuration'); assert.equal(inp.e, 2); assert.equal(inp.fb, 0.5);
  assert.equal(S.kind, 'wheeled'); assert.deepEqual([S.xF, S.xR, S.b, S.a, S.xbar, S.f], [12, 12, 12, 12, 0, 2]);
  const r = GR.rigidAt(inp, S, 0, 30, 22000);
  assert.equal(r.V, 118000); near(r.X, 4.711864, 1e-6); near(r.Y, 0, 1e-9); near(r.d.u, 0.392655, 1e-6); assert.equal(r.d.three, false);
  [41083.33, 41083.33, 17916.67, 17916.67].forEach((v, i) => near(r.load[i], v, 0.01, GR.FLOATS[i].id));
});

test('B. eccentric: four floats, hand check and statics (ΣP = V, ΣP·x = V·X, ΣP·y = V·Y)', () => {
  const c = withPh(WH0, PH_B), u = U(), inp = GR.inputsOf(c, u), S = GR.supports(c, u);
  const r = GR.rigidAt(inp, S, 60, 30, 22000);
  near(r.X, 2.610169, 1e-6); near(r.Y, -3.640242, 1e-6); near(r.d.u, 0.217514, 1e-6); near(r.d.v, -0.303354, 1e-6);
  [26967.74, 44865.60, 14134.40, 32032.26].forEach((v, i) => near(r.load[i], v, 0.01, GR.FLOATS[i].id));
  const xs = S.items.map(f => f.lx), ys = S.items.map(f => f.ly);
  near(r.load.reduce((a, b) => a + b), r.V, 1e-6); near(r.load.reduce((a, P, i) => a + P * xs[i], 0), r.V * r.X, 1e-4); near(r.load.reduce((a, P, i) => a + P * ys[i], 0), r.V * r.Y, 1e-4);
});

test('C. three floats (the diagonally opposite float lifts), hand check and statics', () => {
  const c = withPh(WH0, PH_B), u = U(), inp = GR.inputsOf(c, u), S = GR.supports(c, u);
  const r = GR.rigidAt(inp, S, 60, 30, 60000);
  assert.equal(r.V, 156000); near(r.X, 5.628205, 1e-6); near(r.Y, -9.082164, 1e-6); assert.equal(r.d.three, true); assert.equal(r.stable, true);
  [18965.93, 95617.40, 0, 41416.67].forEach((v, i) => near(r.load[i], v, 0.01, GR.FLOATS[i].id));
  const xs = S.items.map(f => f.lx), ys = S.items.map(f => f.ly);
  near(r.load.reduce((a, P, i) => a + P * xs[i], 0), r.V * r.X, 1e-4); near(r.load.reduce((a, P, i) => a + P * ys[i], 0), r.V * r.Y, 1e-4);
  // outside the floats: not stable
  assert.equal(GR.floatDist(100, 13, 0, S).stable, false);
});

test('D. crawler: track pressure inside and outside the kern, hand check', () => {
  const c = withPh(CR0, PH_D), u = UC(), inp = GR.inputsOf(c, u), S = GR.supports(c, u);
  assert.equal(inp.mode, 'rigid'); assert.equal(inp.Wcw, 150000); assert.equal(inp.e, 0); assert.deepEqual([S.kind, S.Lt, S.g, S.s], ['crawler', 26, 18, 3]);
  let r = GR.rigidAt(inp, S, 0, 40, 60000);
  assert.equal(r.V, 490000); near(r.X, 1.632653, 1e-6); near(r.load[0], 245000, 1e-6); assert.equal(r.d.T[0].tri, false);
  near(r.q[0], 4324.46, 0.01, 'q_max'); near(r.d.T[0].q2, 1957.59, 0.01, 'q_min');
  r = GR.rigidAt(inp, S, 0, 40, 150000);
  near(r.X, 7.586207, 1e-6); assert.equal(r.d.T[0].tri, true); near(r.d.T[0].Lb, 16.241379, 1e-6); near(r.q[0], 11903.75, 0.01, 'triangular q_max');
  // lateral split and the pressure plane integrate back to the track load (kern and triangular)
  r = GR.rigidAt(inp, S, 150, 40, 90000);
  near(r.load[0] + r.load[1], r.V, 1e-6); near((r.load[0] - r.load[1]) * S.g / 2, r.V * r.Y, 1e-3);
  for (const T of [GR.trackP(245000, 1.632653, 26, 3), GR.trackP(290000, 7.586207, 26, 3)]) {
    const n = 20000; let sum = 0, mom = 0; for (let k = 0; k < n; k++) { const eta = -13 + 26 * (k + 0.5) / n, q = Math.max(0, T.q0 + T.gy * eta); sum += q * 3 * 26 / n; mom += q * 3 * 26 / n * eta; }
    near(sum, T.Vt, T.Vt * 1e-6, 'ΣV'); near(mom / sum, T.e, 1e-4, 'e');
  }
});

test('bounding estimate ≥ rigid body: 4,000 random wheeled cases and 4,000 random crawler cases, every float / track', () => {
  let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const R = (a, b) => a + (b - a) * rnd();
  const cW = withPh(WH0, PH_A), uW = U(), SW = GR.supports(cW, uW);
  const cC = withPh(CR0, PH_D), uC = UC(), SC = GR.supports(cC, uC);
  let nW = 0, nC = 0, tight = 0; const unb = { w: 0, c: 0 };
  for (const [S, kind] of [[SW, 'w'], [SC, 'c']]) {
    let n = 0;
    for (let tries = 0; n < 4000 && tries < 200000; tries++) {
      const inp = { Wc: R(5e3, 3e5), xc: R(-4, 4), Wu: R(5e3, 2e5), xu: R(-6, 4), Wcw: R(0, 2e5), rcw: R(3, 20), Wb: R(0, 6e4), e: R(0, 3), fb: R(0.3, 0.6) };
      const theta = R(-180, 180), Rr = R(8, 90), Wh = R(0, 1.5e5);
      inp.G = inp.Wc + inp.Wu + inp.Wb;
      const rest = GR.rigidAt(inp, S, theta, Rr, 0), B = GR.restBox(S);
      if (!(rest.X >= B.x0 && rest.X <= B.x1 && rest.Y >= B.y0 && rest.Y <= B.y1)) continue;   // the crane without the load within the rest box
      const r = GR.rigidAt(inp, S, theta, Rr, Wh); if (!r.stable) continue;                      // a lift the crane can make
      const b = GR.boundAt(inp, S, theta, Rr, Wh);
      assert.ok(b.feasible, 'the bound region contains the rigid-body resultant'); if (!b.stable) unb[kind]++;
      const rv = kind === 'w' ? r.load : r.q, bv = kind === 'w' ? b.load : b.q;
      rv.forEach((v, i) => assert.ok(bv[i] >= v - 1e-6 * Math.max(1, v), `${kind} support ${i}: bound ${bv[i]} < rigid ${v} (θ ${theta}, R ${Rr}, W ${Wh})`));
      if (kind === 'w') assert.ok(b.load.every((v, i) => v >= r.load[i] - 1e-6)); else assert.ok(b.load.every((v, i) => v >= r.load[i] - 1e-6), 'track loads');
      if (Math.max(...bv) < 1.02 * Math.max(...rv)) tight++;
      n++;
    }
    if (kind === 'w') nW = n; else nC = n;
  }
  assert.equal(nW, 4000); assert.equal(nC, 4000); assert.equal(unb.w, 0, 'floats: always bounded (≤ V)'); console.log(`       crawler cases where the estimate is unbounded (resultant can reach a track end): ${unb.c} of 4000`); assert.ok(tight > 0, 'the bound is reached in some cases');
});

test('bound: the per-float maximum over the resultant box is at the checked candidate points (dense grid never exceeds it)', () => {
  const S = GR.supports(withPh(WH0, PH_A), U());
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = 0; k < 300; k++) {
    const x0 = -12 + 24 * rnd(), x1 = x0 + (12 - x0) * rnd(), y0 = -12 + 24 * rnd(), y1 = y0 + (12 - y0) * rnd(), reg = { x0, x1, y0, y1 };
    const cand = GR.boundCandidates(reg, S), best = [0, 0, 0, 0];
    cand.forEach(c => GR.floatDist(1, c.X, c.Y, S).P.forEach((p, i) => { best[i] = Math.max(best[i], p); }));
    for (let i = 0; i <= 30; i++) for (let j = 0; j <= 30; j++) { const P = GR.floatDist(1, x0 + (x1 - x0) * i / 30, y0 + (y1 - y0) * j / 30, S).P; P.forEach((p, q) => assert.ok(p <= best[q] + 1e-12, `grid ${p} > candidates ${best[q]}`)); }
  }
});

test('estimate mode: gross weight entered, weights / CGs missing; labelled; the hand values of the bound at θ = 0', () => {
  const c = withPh(WH0, { grossLb: 76000 }), u = U({ heading: 90 }), inp = GR.inputsOf(c, u);
  assert.equal(inp.mode, 'estimate'); assert.equal(inp.G, 76000);
  const S = GR.supports(c, u), b = GR.boundAt(inp, S, 0, 30, 22000);
  // V = 76,000 + 20,000 + 22,000 = 118,000; Q = 96,000; X ∈ [(22,000·30 − 96,000·12)/118,000, (660,000 + 1,152,000)/118,000] ∩ [−12, 12]
  //   = [−4.169492, 12]; Y ∈ [−9.762712, 9.762712]; the front floats: worst at (X, Y) = (12, ±9.762712) → u = 1, v = 0.813559 →
  //   three floats: V (1 + 0.813559)/2 = 107,000.0 lb.
  assert.equal(b.V, 118000); near(b.reg.x0, -4.169492, 1e-6); near(b.reg.x1, 12, 1e-9); near(b.reg.y1, 9.762712, 1e-6);
  near(b.load[0], 107000, 0.05); near(b.load[1], 107000, 0.05);
  const k = { pick: { x: 1030, y: 2000 }, set: { x: 1000, y: 1970 }, load: 20000, rigging: 1000, hook: 1000, ded: 0, swing: 'short' };
  const ev = GR.evaluate(c, u, k, { items: [] });
  assert.equal(ev.mode, 'estimate'); assert.match(ev.label, /estimate — verify with the manufacturer's outrigger calculator/);
  assert.equal(GR.evaluate(withPh(WH0, PH_A), u, k, { items: [] }).label, 'entered data');
  assert.equal(GR.evaluate(WH0, u, k, { items: [] }).mode, 'none', 'nothing entered: neither method');
});

test('swing path: every degree; the max per float and its slew angle equal a brute-force sweep; A at the pick', () => {
  const c = withPh(WH0, PH_A), u = U({ heading: 90 });
  const k = { pick: { x: 1030, y: 2000 }, set: { x: 1000, y: 1970 }, load: 20000, rigging: 1000, hook: 1000, ded: 0, swing: 'short' };
  const ev = GR.evaluate(c, u, k, { items: [] });
  assert.equal(ev.samples.length, 91); near(ev.samples[0].theta, 0, 1e-9); near(ev.samples[90].theta, 90, 1e-9);
  near(ev.max[0].load, 41083.33, 0.01, 'FL at the pick'); near(ev.max[0].theta, 0, 1e-9);
  const inp = GR.inputsOf(c, u), S = GR.supports(c, u);
  for (let i = 0; i < 4; i++) { let best = -1, th = null; for (let d = 0; d <= 90; d++) { const r = GR.rigidAt(inp, S, d, 30, 22000); if (r.load[i] > best + 1e-9) { best = r.load[i]; th = d; } } near(ev.max[i].load, best, 1e-6); near(ev.max[i].theta, th, 1e-9); }
  assert.equal(ev.gov.id, ev.max.reduce((b, m) => (m.load > b.load ? m : b)).id);
});

test('E. mats: timber and steel plate, effective area, bearing, bending and shear (hand check); no mat', () => {
  const S = GR.supports(withPh(WH0, PH_A), U()), P = 44865.60;
  let b = GR.bearing(P, S, GR.matOf({ ground: { mat: { type: 'timber', B: 4, L: 4, t: 12, Fb: 1200, Fv: 150, E: 1.2e6 } } }), 't');
  near(b.a, 1.772454, 1e-6); near(b.Be, 3.772454, 1e-6); near(b.A, 14.231407, 1e-5); near(b.q, 3152.58, 0.01); near(b.qg, 3202.58, 0.01); near(b.c, 1, 1e-6);
  near(b.M, 1576.29, 0.01); near(b.V, 3152.58, 0.01); near(b.Ma, 28800, 1e-6); near(b.Va, 14400, 1e-6); near(b.rM, 1576.29 / 28800, 1e-6); assert.ok(b.defl > 0 && b.defl < 0.01);
  // a mat larger than the spread: the effective area is the spread (the same as 4 × 4 here)
  near(GR.bearing(P, S, GR.matOf({ ground: { mat: { type: 'timber', B: 8, L: 8, t: 12, Fb: 1200, Fv: 150 } } }), 't').A, 14.231407, 1e-5);
  b = GR.bearing(P, S, GR.matOf({ ground: { mat: { type: 'steel', B: 4, L: 4, t: 1, Fy: 36 } } }), 's');
  near(b.Be, 1.939121, 1e-6); near(b.A, 3.760190, 1e-5); near(b.q, 11931.74, 0.01); near(b.qg, 11972.58, 0.01); near(b.c, 0.083333, 1e-6);
  near(b.M, 41.43, 0.01); near(b.Ma, 5389.22, 0.01); near(b.Va, 172800, 1e-6);
  b = GR.bearing(P, S, GR.matOf({}), 'n'); near(b.qg, 14281.16, 0.01);
  // crawler mat across the track: q = q_max s / B_e
  const SC = GR.supports(withPh(CR0, PH_D), UC());
  b = GR.bearing(4324.46, SC, GR.matOf({ ground: { mat: { type: 'timber', B: 16, t: 12, Fb: 1200, Fv: 150 } } }), 'c');
  near(b.Be, 5, 1e-12); near(b.q, 4324.46 * 3 / 5, 1e-9); near(b.c, 1, 1e-12); near(b.qg, 4324.46 * 3 / 5 + 50, 1e-9);
});

test('F. stress at depth: Newmark I(1, 1) = 0.1752 (GEC 6 Fig. 5-11); a pipe under the front floats (hand check)', () => {
  near(BQ.cornerFactor(1, 1), 0.1752, 5e-5, 'chart value');
  // a float square a × a, z = a/2: under its centre 4 q I(1, 1)
  const a = Math.sqrt(Math.PI), q = 10000 / (a * a);
  near(GR.stressAt([{ x: 0, y: 0, Bx: a, By: a, q }], { x: 0, y: 0 }, a / 2), 4 * q * 0.1752215, 0.01);
  const c = withPh(WH0, PH_A), u = U({ heading: 90 });
  const k = { pick: { x: 1030, y: 2000 }, set: { x: 1000, y: 1970 }, load: 20000, rigging: 1000, hook: 1000, ded: 0, swing: 'short' };
  const items = [{ id: 'p1', type: 'util', name: 'Water main', kind: 'utility', pts: [{ x: 1012, y: 2004 }, { x: 1012, y: 2060 }], closed: false, depth: 3 }];   // under FL only (FR is 16 ft from its end)
  const ev = GR.evaluate(c, u, k, { items, ground: { caps: { p1: 1500 } } });
  const d = ev.depth[0]; near(d.z, 3, 1e-12); near(d.ds, 1902.14, 0.05, 'Δσ_z under FL'); near(d.theta, 0, 1e-9); near(d.p.x, 12, 1e-6); near(d.p.y, 12, 1e-6);
  near(d.ratio, 1902.14 / 1500, 1e-4); assert.ok(ev.flags.some(f => f.level === 'stop' && /stress at depth at "Water main"/.test(f.text)));
  // from the top elevation: z = pad − top el.
  const it2 = [{ id: 'p2', type: 'util', name: 'Culvert', kind: 'culvert', pts: [{ x: 1012, y: 1940 }, { x: 1012, y: 2060 }], closed: false, topEl: 97 }];
  near(GR.evaluate(c, u, k, { items: it2 }).depth[0].z, 3, 1e-12);
  assert.match(GR.evaluate(c, u, k, { items: [Object.assign({}, it2[0], { topEl: null })] }).depth[0].none, /enter the depth/);
});

test('crawler stress at depth: the track pressure plane (kern) equals a fine sum of strips', () => {
  const c = withPh(CR0, PH_D), u = UC(), S = GR.supports(c, u), inp = GR.inputsOf(c, u), r = GR.rigidAt(inp, S, 0, 40, 60000), T = r.d.T[0];
  const area = { track: true, y: 9, B: 3, L: 26, q0: T.q0, gy: T.gy, tri: false, ok: true }, p = { x: 10, y: 9 }, z = 4;
  const v = GR.stressAt([area], p, z);
  let s = 0; const n = 400; for (let k = 0; k < n; k++) { const eta = -13 + 26 * (k + 0.5) / n; s += BQ.uniformRect((T.q0 + T.gy * eta) / 1000, 3, 26 / n, 0, p.x - eta, z) * 1000; }
  near(v, s, 0.5);
});

test('steps: KaTeX (strict) for every sym / eq / sub / unit; no NaN / undefined (rigid, estimate, crawler, mats, depth)', async () => {
  const katex = createRequire(import.meta.url)(path.join(ROOT, 'tests/libs/katex@0.16.9/dist/katex.min.js'));
  const parse = t => katex.renderToString(t, { ...W.SharedSteps.katexOpt, throwOnError: true, strict: 'error' });
  const k = { pick: { x: 1030, y: 2000 }, set: { x: 1000, y: 1970 }, load: 20000, rigging: 1000, hook: 1000, ded: 0, swing: 'short' };
  const items = [{ id: 'p1', type: 'util', name: 'Water main', kind: 'utility', pts: [{ x: 1012, y: 1940 }, { x: 1012, y: 2060 }], closed: false, depth: 3 }];
  const mats = [{ type: 'timber', B: 4, L: 4, t: 12, Fb: 1200, Fv: 150, E: 1.2e6 }, { type: 'steel', B: 4, L: 4, t: 1, Fy: 36 }, { type: 'none' }];
  const evs = [];
  mats.forEach(m => { evs.push(GR.evaluate(withPh(WH0, PH_B), U({ heading: 90, ground: { mat: m, qa: 4000 } }), k, { items })); evs.push(GR.evaluate(withPh(WH0, { grossLb: 76000 }), U({ heading: 90, ground: { mat: m, qa: 4000 } }), k, { items })); });
  const kc = { pick: { x: 40, y: 0 }, set: { x: 0, y: 40 }, load: 100000, rigging: 0, hook: 0, ded: 0, swing: 'short' };
  const itc = [{ id: 'c1', type: 'util', name: 'Culvert', kind: 'culvert', pts: [{ x: -20, y: 5 }, { x: 20, y: 5 }, { x: 20, y: 15 }, { x: -20, y: 15 }], closed: true, depth: 5 }];
  evs.push(GR.evaluate(withPh(CR0, PH_D), UC({ ground: { mat: mats[0], qa: 6000 } }), kc, { items: itc }), GR.evaluate(withPh(CR0, { grossLb: 280000 }), UC(), kc, { items: itc }));
  let n = 0;
  for (const ev of evs) { assert.notEqual(ev.mode, 'none'); for (const s of [].concat(ev.steps, ...ev.bear.map(b => b.steps), ...ev.depth.map(d => d.steps || []))) {
    for (const f of ['sym', 'eq', 'sub']) if (s[f]) { parse(s[f]); n++; } if (s.unit) { parse(W.SharedSteps.unitTeX(s.unit)); n++; }
    assert.ok(!/NaN|undefined/.test(W.SharedSteps.toText([s])), s.id + ' ' + W.SharedSteps.toText([s]));
  } }
  assert.ok(n > 300, String(n));
});
