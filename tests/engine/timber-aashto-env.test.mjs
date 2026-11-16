// "Timber Beam Check.html", AASHTO LRFD 10th Ed. mode, phase T2 part 2 (fix log TBA3, 2026-11-16): HL-93 envelopes along the stringer
// (tbcAasEnv: influence lines from the tool's beam engine tbcSolve), the wood shear rule (Art. 8.7, Eq. 4.6.2.2.2a-1) and the factored
// Strength I demands (aasDemands). Hand checks (independent closed-form calculations, written out below) and a cross-check of a
// continuous beam against the repo's tested moving-load engine shared/moving-load.js (SharedMovingLoad.analyze, HL-93 preset).
import assert from 'node:assert/strict';
import { test, loadShared } from './harness.mjs';
import { tbcEngine } from './tbc-source.mjs';

const E = tbcEngine();
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (±${tol})`);
// 6x16 DF-L No. 1 (5.5 x 15.5 in.), s = 24 in. (S = 2 ft), 4 in. plank deck (soft 0.050 kcf), interior, 24 ft roadway, IM 0, bearing 3.5 in.
const run = (spans, fn, sup) => { const m = E.tbcDefaultModel(); m.design.code = 'AASHTO'; m.design.aashto = E.tbcAashtoDefaults(); m.design.aashto.gr = 'No.1'; m.material.size = '6x16'; m.geom.spacing = 24;
  m.geom.spans = spans.map(L => ({ L })); m.geom.supports = sup || spans.concat([0]).map(() => ({ t: 'pin', lb: 3.5, cb: false })); m.design.aashto.bl = E.tbcAasLoadDefaults(); fn && fn(m);
  const A = E.tbcAashto(m), L = E.tbcAasLoads(m, A); assert.ok(L.ok, (L.errors || []).join('; ')); return { A, L, e: L.env, D: E.aasDemands(L) }; };
const at = (e, x) => e.secs.find(s => Math.abs(s.x - x) < 1e-9);

test('hand check D: HL-93 per lane, 20 ft simple span (moment, shear, reaction)', () => {
  const { e } = run([20]);
  // midspan: tandem axles at 10 and 14 ft: R_A = 25(10/20) + 25(6/20) = 20.0, M = 20 x 10 = 200.0; lane 0.64 x 20^2/8 = 32.0 -> 232.0 kip-ft
  close(at(e, 10).M.ll.max, 232.0, 1e-6, 'M at midspan');
  // absolute maximum: tandem axle at x, the other at x + 4: M = x(900 - 50x)/20 + 0.32x(20 - x) = 51.4x - 2.82x^2, max at x = 9.1135 ft:
  // 51.4^2/(4 x 2.82) = 234.2195 kip-ft (the scan is to 0.1 ft: 234.216 at 9.1 ft or 10.9 ft)
  const mx = e.secs.reduce((b, s) => s.M.ll.max > b.M.ll.max ? s : b);
  close(mx.M.ll.max, 234.2195, 0.01, 'absolute maximum M'); assert.match(mx.M.ll.gMax.cfg, /tandem/);
  // truck alone at midspan: 32 x 20/4 = 160 < 200 (the 8-kip and the second 32-kip axle are off the span or reduce): tandem governs
  // shear at the support: tandem 25 + 25(16/20) = 45.0; lane 0.64 x 20/2 = 6.4 -> 51.4 kip (truck: 32 + 32(6/20) = 41.6 + 6.4 = 48.0)
  close(e.secs[0].VR.ll.max, 51.4, 1e-6, 'V at the support'); close(e.reac[0].ll.max, 51.4, 1e-6, 'R_A');
  // dead load: w_DC = 0.0296007 + 0.0333333 = 0.0629340 kip/ft; M = wL^2/8 = 3.14670 kip-ft
  close(at(e, 10).M.dc, 0.0629340 * 400 / 8, 1e-5, 'M_DC at midspan');
});

test('hand check E: HL-93 per lane, 30 ft simple span', () => {
  const { e } = run([30]);
  // midspan: tandem at 15 and 19 ft: R_A = 25(15/30) + 25(11/30) = 21.667, M = 325.0; lane 0.64 x 900/8 = 72.0 -> 397.0
  close(at(e, 15).M.ll.max, 397.0, 1e-6, 'M at midspan');
  // absolute: 56.267x - 1.98667x^2 -> x = 14.161, M = 398.398 (truck + lane: 58.667x - 2.4533x^2 -> 350.72, less)
  close(e.secs.reduce((b, s) => Math.max(b, s.M.ll.max), 0), 398.398, 0.01, 'absolute maximum M');
  // support shear: truck 32 + 32(16/30) + 8(2/30) = 49.6; lane 9.6 -> 59.2 kip (tandem 25 + 25(26/30) = 46.667 + 9.6 = 56.27)
  close(e.secs[0].VR.ll.max, 59.2, 1e-6, 'V at the support'); assert.match(e.secs[0].VR.ll.gMax.cfg, /truck, rear spacing 14/);
});

test('hand check F: wood shear rule (Art. 8.7, Eq. 4.6.2.2.2a-1) and Strength I, 20 ft span', () => {
  const { L, D } = run([20]);
  // d = 15.5 in.; face = 3.5/2 in. = 0.14583 ft from the support line; a = min(3d, L/4) = min(3.875, 5) = 3.875 ft -> x_LL = 4.02083 ft
  const s = D.shear[0]; close(s.xl, 0.145833 + 3.875, 1e-5, 'x_LL'); close(s.xd, 0.145833 + 1.291667, 1e-5, 'x_d = 1.4375 ft');
  // V_lane(x_LL): tandem 25(15.97917/20) + 25(11.97917/20) = 19.97396 + 14.97396 = 34.94792; lane 0.64(15.97917)^2/40 = 4.08534 -> 39.03326
  close(s.VLane, 39.03326, 1e-4, 'V_lane');
  // V_LU = 0.5 x 39.03326 = 19.51663; V_LD = (2/6.7) x 39.03326 = 11.65172; V_LL = 0.50(0.60 x 19.51663 + 11.65172) = 11.68085
  close(s.VLU, 19.51663, 1e-4, 'V_LU'); close(s.VLD, 11.65172, 1e-4, 'V_LD'); close(s.VLL, 11.68085, 1e-4, 'V_LL');
  // V_DC at x_d = 0.0629340 x (10 - 1.4375) = 0.538873; V_u = 1.25 x 0.538873 + 1.75 x 11.68085 = 0.673591 + 20.441488 = 21.11508 kip
  close(s.Vu, 21.11508, 1e-4, 'V_u Strength I');
  // Strength I moment at midspan: 1.25 x 3.14670 + 1.75 x 0.298507 x 232.0 = 3.93338 + 121.19403 = 125.12741 kip-ft
  const q = D.sec.find(r => Math.abs(r.x - 10) < 1e-9); close(q.M.StrI.max, 125.12741, 1e-4, 'M_u at midspan'); close(q.M.SerI.max, 3.14670 + 2 / 6.7 * 232.0, 1e-4, 'Service I: 3.14670 + 69.25373 = 72.40043');
  // reaction: 1.25 x 0.0629340 x 10 + 1.75 x 0.298507 x 51.4 = 0.786675 + 26.85075 = 27.63742 kip
  close(D.reac[0].Ru, 27.63742, 1e-4, 'R_u'); assert.equal(L.df.woodV, true);
});

test('dead-load deflection and minimum load factors', () => {
  const { e, A } = run([20]);
  // 5wL^4/384EI: w_DC = 0.062934 kip/ft, L = 20 ft, E = 1600 ksi, I = 5.5 x 15.5^3/12 = 1706.78 in^4 -> EI = 18964.2 kip-ft^2
  const EI = 1600 * 5.5 * Math.pow(15.5, 3) / 12 / 144, mid = e.defl.find(d => Math.abs(d.x - 10) < 1e-9);
  close(mid.dc, 5 * 0.0629340 * Math.pow(20, 4) / (384 * EI) * 12, 1e-6, 'DC deflection (in.)'); assert.equal(A.E, 1600);
  // gamma_p minimum where the permanent load reduces the effect: a negative LL effect with a positive DC effect
  const f = E.aasFactor({ dc: 10, dw: 2, ll: { max: 5, min: -20 }, pm: null }, 0.5, 1);
  close(f.StrI.max, 1.25 * 10 + 1.5 * 2 + 1.75 * 0.5 * 5, 1e-12, 'max'); close(f.StrI.min, 0.9 * 10 + 0.65 * 2 - 1.75 * 0.5 * 20, 1e-12, 'min');
});

test('continuous 2 x 30 ft: the same HL-93 envelopes as shared/moving-load.js (SharedMovingLoad.analyze)', () => {
  const { e, A } = run([30, 30]);
  const W = loadShared('vehicles.js', 'moving-load.js'), P = W.SharedVehicles.build().presets, H = P['HL93-Truck'], spans = [30, 30];
  const mm = { spans, E: A.E, segs: [{ len: 1e9, I: A.b * Math.pow(A.d, 3) / 12 }], stdLane: null, dirs: [1, -1], llf: 1, dfM: [1, 1], dfV: [1, 1], dfNeg: 0, step: 0.5, hStep: 2, simple: false,
    axles: H.axles.map(a => [...a]), short: 'HL93-Truck', udl: { ...H.udl }, vK: H.vary.k, vMin: H.vary.min, vMax: H.vary.max, neglect: H.neglect, secondary: H.secondary, multi: H.multi.on, mScale: H.multi.scale, mHmin: H.multi.hmin, mFixed: H.multi.fixed,
    imp: { method: 'const', val: 1, S: 6.5, bal: false, onUdl: false } };
  const R = W.SharedMovingLoad.analyze(mm, { vehicles: P });
  const ref = (x, t) => R.res[R.effs.findIndex(f => f.t === t && Math.abs(f.x - x) < 1e-6)];
  [6, 12, 15, 30, 45].forEach(x => { const s = at(e, x), r = ref(x, 'M'); close(s.M.ll.max, r.max, 0.002 * Math.max(1, Math.abs(r.max)), 'M+ at ' + x); close(s.M.ll.min, r.min, 0.002 * Math.max(1, Math.abs(r.min)), 'M- at ' + x); });
  [0, 30, 60].forEach(x => close(e.reac.find(q => Math.abs(q.x - x) < 1e-9).ll.max, ref(x, 'R').max, 1e-3, 'R at ' + x));
  close(e.secs[0].VR.ll.max, ref(0, 'V').max, 1e-3, 'V at A');
});

test('cantilever geometry and permit vehicle (Strength II)', () => {
  // span + overhang: a tip load gives negative moment over the whole back span; reactions and the tip deflection exist
  const o = run([12, 4], null, [{ t: 'pin', lb: 3.5 }, { t: 'pin', lb: 3.5 }, { t: 'free', lb: 3.5 }]);
  const B = at(o.e, 12); assert.ok(B.M.ll.min < 0); close(B.M.ll.min, -(32 * 4 + 0.64 * 16 / 2), 1e-6, 'M at B: a 32-kip truck axle at the tip (4 ft; the other axles in the back span add nothing to M at B) + lane 0.64 x 4^2/2 = -133.12 (tandem: 25 x 4 + 25 x 0 = 100 + 5.12, less)');
  assert.ok(o.e.defl.some(d => Math.abs(d.x - 16) < 1e-9), 'tip deflection station');
  // permit 20, 30@14, 30@4 on 20 ft: max M at midspan with a 30-kip axle on it (hand: axles at 10 and 14 ft, 30(10/20)+30(6/20) = 24 -> 240)
  const p = run([20], m => { m.design.aashto.bl.permit = '20, 30@14, 30@4'; });
  close(at(p.e, 10).M.pm.max, 240, 1e-6, 'permit M at midspan'); assert.ok(p.D.Mpos2.v > 0);
  assert.deepEqual(JSON.parse(JSON.stringify(E.aasParsePermit('20, 30@14, 30@4'))), [[20, 0], [30, 14], [30, 4]]);
  assert.equal(E.aasParsePermit(''), null); assert.equal(E.aasParsePermit('20, x'), false);
  const bad = E.tbcAasLoads(Object.assign(E.tbcDefaultModel(), {}), null); assert.ok(!bad.ok);
});
