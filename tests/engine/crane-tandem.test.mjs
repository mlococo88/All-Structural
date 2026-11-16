// Crane Pick Analyzer (apps/crane-pick), C5: girder lifts — load share, the path, per-step capacity, the tandem limit, crane–crane
// distance (engine/tandem.js). Node only, with the SYNTHETIC fake crane of tests/smoke/crane-fake-wheeled.json (made-up values).
//   node tests/engine/run.mjs crane
//
// Hand cases (lb, ft):
//   Load share, hooks plumb: R1 = W (x2 − x_cg) / (x2 − x1), R2 = W − R1.
//     symmetric: L 100, W 100,000, hooks at 10 / 90, CG 50 → R1 = R2 = 50,000.
//     eccentric CG 45: R1 = 100,000 (90 − 45) / 80 = 56,250; R2 = 43,750.
//     rigging per hook: hook 1 + 2,000 rigging + 1,500 block + 500 other = 60,250; hook 2 + 1,200 rigging + 1,000 block = 45,950.
//     CG at 95 (outside 10 … 90): R1 = 100,000 (−5) / 80 = −6,250 → a stop flag (the girder tips).
//     paired girders: W1 80,000, W2 60,000 (both CG 50), cross-frames 10,000 at 30, spacing 8 → W_g = 150,000;
//       x_cg = (80,000·50 + 60,000·50 + 10,000·30) / 150,000 = 48.6667; t_cg = (80,000 (−4) + 60,000 (4)) / 150,000 = −0.5333;
//       hooks 10 / 90: R1 = 150,000 (90 − 48.6667) / 80 = 77,500.0; R2 = 72,500.0.
//   Tandem (fake crane, 80 ft boom, outriggers full 360°, pad 100): crane 1 at (1,000, 2,000), crane 2 at (1,100, 2,000); girder L 60,
//     W 40,000, CG 28 from end A, hooks at 10 / 50 (R1 = 40,000 (50 − 28) / 40 = 22,000; R2 = 18,000), each hook + 1,000 rigging +
//     1,000 block → W1 = 24,000, W2 = 20,000; heading 90° (end A west). Pick pose centre (1,050, 1,980), set pose (1,050, 2,000).
//     Hooks at the set: (1,030, 2,000) and (1,070, 2,000): R = 30.00 → C(80, 30) = 37,000 → 64.86 % and 54.05 %.
//     At the pick: R = √(30² + 20²) = 36.06 → next radius 40 → 27,000 → 88.89 % (crane 1, ≥ 75 %: over the tandem limit), 74.07 %.
//     Path: hoist z_b 105 → 120 (15 steps), travel: slew 90 + atan(20/30) … = 33.69° per crane, hook travel 20 ft → n = 34 (+ the end
//     pose) → 50 steps; step 15 + 17 = 32: centre (1,050, 1,990), hook 1 (1,030, 1,990): R = √(30² + 10²) = 31.62 → C 27,000 → 88.89 %.
//     Governing: crane 1 at step 0 (hoisting at the pick: the first of the equal steps), 88.89 %; crane 2 at step 0, 74.07 %.
//     Heights at the set (girder depth 6, rigging height 10, block 4): z_hk = 120 + 6 + 10 = 136, z_bk = 140; boom angle (chart, 80 ft,
//     R 30) 69° → z_tip = 100 + 8 + 80 sin 69° = 182.686 → margin 42.69 (head allowance 0).
//     Crane–crane: at the set the booms are in one vertical plane y = 2,000: foot pins (1,002, 108) and (1,098, 108), tips (1,030,
//     182.686) and (1,070, 182.686): least distance tip to tip = 40.00 ft. The cranes are symmetric about x = 1,050 at every step, so
//     the tips are always at one height and 40 ft apart (the hooks' spacing): 40.00 ft at every step; reported at the first (step 0).
//   Ground per crane (C4 weights of the ground hand check A: W_c 40,000 @ 0, W_u 30,000 @ 0, W_cw 20,000 @ r 10, W_b 6,000, e 2,
//     f_b 0.5; floats at x ±12, spread 24): each crane's own hook load (W1 24,000, W2 20,000) at its own hook. At the set, crane 1
//     (heading 0) has its hook at (1,030, 2,000): θ = 90°, R 30: û = (0, −1); y: cw +10, boom −(2 + 0.5·28) = −16, hook −30 →
//     V = 120,000, ΣWy = 200,000 − 96,000 − 720,000 = −616,000 → Y = −5.133333, v = −0.427778, u = 0:
//     FL = RL = 30,000 (1 − 0.427778) = 17,166.67 lb; FR = RR = 30,000 (1.427778) = 42,833.33 lb.
//   Stress at depth from two setups (summed): two fake cranes (case A weights), crane 1 at (1,000, 2,000), crane 2 at (1,030, 2,000), both
//     heading 0 (front north), each hook 30 ft ahead (θ 0, R 30, W 22,000 → front floats 41,083.33, rear 17,916.67 lb, case A); a pipe
//     along x = 1,015 at depth 3 ft, between crane 1's right floats (x 1,012) and crane 2's left floats (x 1,018). Float = the 1.772454 ft
//     equal-area square, q_front = 41,083.33 / 1.772454² = 13,077.23 psf. At (1,015, 2,012) (3 ft from each front float centre, level
//     with it): own front float = q · 2 [I(1.295409, 0.295409) − I(0.704591, 0.295409)] = 13,077.23 · 2 (0.083359 − 0.067889) =
//     404.63 psf; the crane's other floats (15 + ft away) 0.036 + 0.027 + 0.004 → 404.69 psf per crane; both cranes (symmetric):
//     Δσ_z = 404.69 + 404.69 = 809.38 psf (one setup alone, as C4 computes it: 404.69).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps', 'crane-pick', 'engine');
const W = loadShared('steps.js', 'boussinesq.js', path.join(APP, 'geo.js'), path.join(APP, 'model.js'), path.join(APP, 'osha.js'), path.join(APP, 'cranes.js'), path.join(APP, 'lift.js'), path.join(APP, 'elev.js'), path.join(APP, 'clear3d.js'), path.join(APP, 'ground.js'), path.join(APP, 'tandem.js'));
const GR = W.CranePickGround, K = W.CranePickCranes, LF = W.CranePickLift, M = W.CranePickModel, T = W.CranePickTandem, C3 = W.CranePickClear;
const WH = K.parse(JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'smoke', 'crane-fake-wheeled.json'), 'utf8'))).crane;
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const grp = (c, id) => K.groups(c).find(g => Object.values(g.configs).some(x => x.id === id)).key;
const U = o => M.normSetup(Object.assign({ x: 1000, y: 2000, heading: 0, group: grp(WH, 'or-full-360'), boom: 80, mode: null, pad: 100 }, o));
const TG = o => M.normTandem(Object.assign({ type: 'tandem', girder: { L: 100, W: 100000, cg: 50 }, hooks: [{ s: 10 }, { s: 90 }] }, o));

test('load share: symmetric, eccentric CG, rigging per hook, CG outside the lifting points', () => {
  let s = T.share(TG()); near(s.R[0], 50000, 1e-9); near(s.R[1], 50000, 1e-9); assert.ok(s.ok);
  s = T.share(TG({ girder: { L: 100, W: 100000, cg: 45 } })); near(s.R[0], 56250, 1e-9); near(s.R[1], 43750, 1e-9);
  s = T.share(TG({ girder: { L: 100, W: 100000, cg: 45 }, hooks: [{ s: 10, rig: 2000, hook: 1500, ded: 500 }, { s: 90, rig: 1200, hook: 1000 }] }));
  near(s.Wh[0], 60250, 1e-9); near(s.Wh[1], 45950, 1e-9);
  const st = Object.fromEntries(s.steps.map(x => [x.id.split('.').pop(), x])); near(st.R1.value, 56250, 1e-9); near(st.W1.value, 60250, 1e-9); assert.match(st.R1.sub, /100\{,\}000 \\frac\{90\.00 - 45\.00\}\{90\.00 - 10\.00\}/);
  s = T.share(TG({ girder: { L: 100, W: 100000, cg: 95 } })); near(s.R[0], -6250, 1e-9); assert.ok(!s.ok); assert.ok(s.flags.some(f => f.level === 'stop' && /outside the lifting points/.test(f.text)));
  s = T.share(TG({ hooks: [{ s: 40 }, { s: 40 }] })); assert.ok(!s.ok && /same place/.test(s.flags[0].text));
  s = T.share(TG({ type: 'single', hooks: [{ s: 0, rig: 3000, hook: 1000 }] })); near(s.Wh[0], 104000, 1e-9); near(s.xs[0], 50, 1e-12, 'single: hook over the CG');
});

test('paired girders with cross-frames: combined weight and CG', () => {
  const s = T.share(TG({ girder: { L: 100, W: 80000, cg: 50, pair: { on: true, s: 8, W2: 60000, xf: 10000, xfCg: 30 } } }));
  near(s.ob.Wg, 150000, 1e-9); near(s.ob.xcg, 48.666666667, 1e-8); near(s.ob.tcg, -0.533333333, 1e-8);
  near(s.R[0], 77500, 1e-6); near(s.R[1], 72500, 1e-6);
  const p = { x: 0, y: 0, h: 0 }, h = T.hooks(TG(), p, s); near(h[0].x, -0.5333333, 1e-6); near(h[0].y, 10 - 50, 1e-9, 'hook 1 40 ft south of the centre (heading 0: end A south)');
  const ol = T.outline(TG({ girder: { L: 100, W: 80000, pair: { on: true, s: 8 }, B: 2 } }), p); assert.equal(ol.lines.length, 2); near(ol.box[0].x, -5, 1e-9); near(ol.box[2].x, 5, 1e-9);
});

const ENV = items => ({ setups: [U(), U({ x: 1100 })], cranes: [WH, WH], items: (items || []).map(M.normItem), s: Object.assign({}, LF.DEF, { tandem: 75 }), zPad: 100 });
const TAN = o => M.normTandem(Object.assign({ type: 'tandem', girder: { L: 60, W: 40000, cg: 28, H: 6 }, hooks: [{ s: 10, rig: 1000, hook: 1000, rigH: 10, blk: 4 }, { s: 50, rig: 1000, hook: 1000, rigH: 10, blk: 4 }],
  pick: { x: 1050, y: 1980, h: 90, z: 105 }, set: { x: 1050, y: 2000, h: 90, z: 120 } }, o));

test('tandem path: sampling, per-step capacity (hand-checked step), governing steps, the tandem limit', () => {
  const r = T.evaluate(TAN(), ENV(), 'tg');
  near(r.sh.Wh[0], 24000, 1e-9); near(r.sh.Wh[1], 20000, 1e-9);
  assert.equal(r.path.nH, 15); assert.equal(r.path.legs[0].n, 34); near(r.path.legs[0].slew, Math.atan2(20, 30) * 180 / Math.PI, 0.02); near(r.path.legs[0].hookD, 20, 1e-6);
  assert.equal(r.steps.length, 50);
  const last = r.steps[49].cr; near(last[0].R, 30, 1e-9); near(last[0].C, 37000, 0); near(last[0].pct, 24000 / 37000 * 100, 1e-9); near(last[1].pct, 20000 / 37000 * 100, 1e-9); assert.equal(last[0].cls, 'ok');
  near(last[0].zHk, 136, 1e-9); near(last[0].zBk, 140, 1e-9); near(last[0].zTip, 108 + 80 * Math.sin(69 * Math.PI / 180), 1e-9); near(last[0].margin, 42.686, 1e-3);
  const s32 = r.steps[32]; assert.equal(s32.x.phase, 'travel'); assert.equal(s32.x.k, 17); near(s32.x.pose.y, 1990, 1e-9); near(s32.cr[0].p.x, 1030, 1e-9); near(s32.cr[0].p.y, 1990, 1e-9);
  near(s32.cr[0].R, Math.sqrt(1000), 1e-9); near(s32.cr[0].C, 27000, 0); near(s32.cr[0].pct, 88.888888889, 1e-6); assert.equal(s32.cr[0].cls, 'over');
  const s0 = r.steps[0].cr; near(s0[0].R, Math.hypot(30, 20), 1e-9); near(s0[0].pct, 88.888888889, 1e-6); near(s0[1].pct, 74.074074074, 1e-6); assert.equal(s0[1].cls, 'ok');
  assert.equal(r.gov[0].i, 0); near(r.gov[0].c.pct, 88.888888889, 1e-6); assert.equal(r.gov[0].where, 'hoisting at the pick, girder bottom el. 105.00'); assert.equal(r.gov[1].i, 0); near(r.gov[1].c.pct, 74.074074074, 1e-6);
  assert.ok(r.flags.some(f => f.level === 'stop' && f.crane === 0 && /88\.9 % of chart at step 0 .*≥ the tandem limit 75 %/.test(f.text)), r.flags.map(f => f.text).join(' | '));
  assert.ok(!r.flags.some(f => f.kind === 'cap' && f.crane === 1));
  const lim = r.gov[0].steps.find(x => x.id.endsWith('.lim')); assert.equal(lim.value, 'NOT OK'); assert.equal(lim.ok, false);
  // tandem limit 90 %: no capacity flag; single-crane thresholds do not apply to a tandem crane
  const r2 = T.evaluate(TAN(), Object.assign(ENV(), { s: Object.assign({}, LF.DEF, { tandem: 90 }) }));
  assert.ok(!r2.flags.some(f => f.kind === 'cap'), r2.flags.map(f => f.text).join(' | ')); assert.equal(r2.steps[0].cr[0].cls, 'ok');
  // a set the boom cannot reach (R 70 → not permitted at 80 ft? R 70 is tabulated; R 75 is not)
  const r3 = T.evaluate(TAN({ set: { x: 1050, y: 2070, h: 90, z: 120 } }), ENV()); assert.ok(r3.flags.some(f => f.kind === 'cap' && f.level === 'stop' && /not permitted/.test(f.text)));
});

test('crane–crane distance (hand case: tips 40 ft apart) and girder level', () => {
  const r = T.evaluate(TAN(), ENV());
  near(r.cc.d, 40, 1e-6); assert.equal(r.cc.c1, 'boom'); assert.equal(r.cc.c2, 'boom'); assert.equal(r.cc.j, 0, 'the same at every step: the first');
  near(r.cc.p.x, 1030, 1e-6); near(r.cc.q.x, 1070, 1e-6); near(r.cc.p.z, r.cc.q.z, 1e-9, 'tip to tip');
  assert.ok(!r.flags.some(f => f.kind === 'cc'));
  // a 10 ft girder, the hooks at 4.5 / 5.5 (1 ft apart; symmetric again): the tips 1.00 ft apart < the 2 ft clearance → amber; rigging
  // heights 10 / 12 → the hooks 2.00 ft apart in height (girder level, informational)
  const r2 = T.evaluate(TAN({ girder: { L: 10, W: 40000, cg: 5, H: 6 }, hooks: [{ s: 4.5, rigH: 10 }, { s: 5.5, rigH: 12 }], pick: { x: 1050, y: 2000, h: 90, z: 120 } }), ENV());
  near(r2.cc.d, 1, 1e-6); assert.ok(r2.flags.some(f => f.kind === 'cc' && f.level === 'warn'));
  near(r2.level.d, -2, 1e-12); assert.ok(r2.flags.some(f => f.kind === 'level' && /2\.00 ft apart in height/.test(f.text)));
  // segment–segment (clear3d) hand check: the boom lines in one vertical plane
  near(C3.segSeg3({ x: 1002, y: 2000, z: 108 }, { x: 1030, y: 2000, z: 182.686 }, { x: 1098, y: 2000, z: 108 }, { x: 1070, y: 2000, z: 182.686 }).d, 40, 1e-9);
});

test('girder box clearance and the single-crane girder lift', () => {
  // an obstruction 10 × 10 ft (y 1,975 … 1,985) under the pick pose, top el. 112: hoisting from z_b 105 the girder (a line at y 1,980,
  // no width) is in it → contact; picked at 120 instead, the girder clears it by 120 − 112 = 8 ft
  const ob = { type: 'obst', id: 'o1', name: 'Pier', topEl: 112, pts: [{ x: 1045, y: 1975 }, { x: 1055, y: 1975 }, { x: 1055, y: 1985 }, { x: 1045, y: 1985 }] };
  const r = T.evaluate(TAN(), ENV([ob])); const c = r.clr[0];
  assert.equal(c.gov.comp, 'girder'); near(c.gov.d, 0, 1e-9, 'the girder box at the pick (z 105 … 111) overlaps the pier (top 112) in plan → contact'); assert.equal(c.level, 'stop');
  const r2 = T.evaluate(TAN({ pick: { x: 1050, y: 1980, h: 90, z: 120 } }), ENV([ob])); near(r2.clr[0].gov.d, 8, 1e-9, 'travel at 120: 8 ft above the top'); assert.equal(r2.clr[0].level, 'ok');
  // single crane: hook over the CG; W = W_g + rigging + block
  const s = T.evaluate(TAN({ type: 'single', girder: { L: 60, W: 20000, H: 6 }, hooks: [{ rig: 1000, hook: 1000, rigH: 10, blk: 4 }], pick: { x: 1030, y: 2000, h: 0, z: 120 }, set: { x: 1030, y: 2000, h: 0, z: 120 } }), ENV());
  assert.equal(s.nC, 1); near(s.steps[0].cr[0].R, 30, 1e-9); near(s.steps[0].cr[0].pct, 22000 / 37000 * 100, 1e-9); assert.equal(s.steps.length, 2); assert.equal(s.cc, null);
});

test('saved tandem: normalize keeps it; a project without tandems gets []', () => {
  const P = M.normalize({ schema: 'crane-pick.project', tandems: [TAN()], lift: { tandem: 70 } });
  assert.equal(P.tandems.length, 1); assert.equal(P.lift.tandem, 70); assert.equal(JSON.stringify(M.normalize(JSON.parse(JSON.stringify(P))).tandems), JSON.stringify(P.tandems));
  assert.equal(JSON.stringify(M.normalize({ schema: 'crane-pick.project' }).tandems), '[]'); assert.equal(M.normalize({}).lift.tandem, 75);
});

const withPh = (c, ph) => { const d = JSON.parse(JSON.stringify(c)); d.app_inputs = Object.assign({}, d.app_inputs, { ph4: ph }); return d; };
const PH_A = { carrierLb: 40000, carrierCg: 0, upperLb: 30000, upperCg: 0, boomLb: 6000, cwRad: 10 };
test('ground: each crane its own hook load and hook positions (hand check at the set)', () => {
  const c = withPh(WH, PH_A), P = M.normalize({ schema: 'crane-pick.project' }), e = Object.assign(ENV(), { cranes: [c, c], P });
  const r = T.evaluate(TAN(), e);
  assert.ok(r.ground && r.ground.cr.length === 2); assert.equal(r.ground.cr[0].W, 24000); assert.equal(r.ground.cr[1].W, 20000);
  assert.equal(r.ground.cr[0].samples.length, r.steps.length);
  const last = r.ground.cr[0].samples[r.steps.length - 1]; near(last.theta, 90, 1e-9); near(last.R, 30, 1e-9);
  [17166.67, 42833.33, 17166.67, 42833.33].forEach((v, i) => near(last.load[i], v, 0.01, GR.FLOATS[i].id));
  assert.ok(r.ground.cr[0].steps.some(x => /girder lift's steps/.test(x.label)));
  assert.ok(r.flags.some(f => f.kind === 'ground' && /^Crane 1: Ground: no allowable bearing/.test(f.text)));
  // the C2 pick path is unchanged when no override is given (the same as before: W from the pick)
  const pk = { load: 22000, pick: { x: 1030, y: 2000 }, set: { x: 1030, y: 2000 } }, g0 = GR.evaluate(c, U({ boom: 60 }), pk, P, 'x');
  assert.equal(g0.W, 22000); assert.equal(g0.src, 'swing');
});
test('stress at depth: two setups summed (hand check 809.38 psf), one setup alone 404.69', () => {
  const c = withPh(WH, PH_A), pipe = M.normItem({ type: 'util', id: 'u1', name: 'Pipe', kind: 'utility', depth: 3, pts: [{ x: 1015, y: 1950 }, { x: 1015, y: 2050 }] });
  const P = M.normalize({ schema: 'crane-pick.project', items: [pipe] }), u1 = U({ boom: 60 }), u2 = U({ boom: 60, x: 1030 });
  const o1 = GR.evaluate(c, u1, null, P, 'a', { W: 22000, pts: [{ x: 1000, y: 2030 }] }), o2 = GR.evaluate(c, u2, null, P, 'b', { W: 22000, pts: [{ x: 1030, y: 2030 }] });
  [41083.33, 41083.33, 17916.67, 17916.67].forEach((v, i) => near(o1.samples[0].load[i], v, 0.01));
  near(o1.depth[0].ds, 404.69, 0.01, 'one setup alone');
  const d = GR.depthPair([o1, o2], [u1, u2], P, 'p')[0];
  near(d.ds, 809.38, 0.01, 'both setups'); near(d.parts[0], 404.69, 0.01); near(d.parts[1], 404.69, 0.01); near(d.p.x, 1015, 1e-9); near(d.p.y, 2012, 1e-9);
  const sum = d.steps.find(x => x.id.endsWith('.sum2')); near(sum.value, 0.80938, 1e-5); assert.match(sum.sub, /0\.405 \+ 0\.405/);
  // an entered allowable 700 psf: over with both cranes (809), OK with one (405)
  P.ground.caps.u1 = 700; const d2 = GR.depthPair([o1, o2], [u1, u2], P, 'p')[0]; near(d2.ratio, 809.38 / 700, 1e-4);
  // inside a tandem evaluate, the pair is computed and flagged
  const tg = M.normTandem({ type: 'tandem', girder: { L: 30, W: 40000, cg: 15 }, hooks: [{ s: 0 }, { s: 30 }], pick: { x: 1015, y: 2030, h: 90, z: 100 }, set: { x: 1015, y: 2030, h: 90, z: 100 } });
  const r = T.evaluate(tg, { setups: [u1, u2], cranes: [c, c], items: P.items, P, s: Object.assign({}, LF.DEF, { tandem: 75 }), zPad: 100 });
  near(r.sh.Wh[0], 20000, 1e-9); assert.equal(r.ground.pair.length, 1); assert.ok(r.ground.pair[0].ds > r.ground.cr[0].depth[0].ds);
  assert.ok(r.flags.some(f => /both cranes together/.test(f.text)));
});
test('steps: KaTeX (strict) for every sym / eq / sub / unit; no NaN / undefined (load share, path, governing, clearances, ground, pair)', async () => {
  const { createRequire } = await import('node:module');
  const katex = createRequire(import.meta.url)(path.join(ROOT, 'tests/libs/katex@0.16.9/dist/katex.min.js'));
  const parse = x => katex.renderToString(x, { ...W.SharedSteps.katexOpt, throwOnError: true, strict: 'error' });
  const c = withPh(WH, PH_A), items = [{ type: 'util', id: 'u1', name: 'Pipe', kind: 'utility', depth: 3, pts: [{ x: 1050, y: 1950 }, { x: 1050, y: 2050 }] },
    { type: 'power', id: 'pw', name: 'Line', kv: 115, wireH: 60, pts: [{ x: 900, y: 2100 }, { x: 1200, y: 2100 }] },
    { type: 'obst', id: 'o1', name: 'Pier', topEl: 112, pts: [{ x: 1045, y: 1975 }, { x: 1055, y: 1975 }, { x: 1055, y: 1985 }, { x: 1045, y: 1985 }] }];
  const P = M.normalize({ schema: 'crane-pick.project', items, ground: { caps: { u1: 2000 } } });
  const rs = [T.evaluate(TAN({ girder: { L: 60, W: 40000, cg: 28, H: 6, pair: { on: true, s: 8, xf: 4000 } }, way: [{ x: 1060, y: 1990, h: 80 }] }), Object.assign(ENV(), { cranes: [c, c], items: P.items, P })),
    T.evaluate(TAN({ type: 'single', girder: { L: 60, W: 20000 } }), Object.assign(ENV(), { cranes: [c, c], items: P.items, P }))];
  let n = 0;
  for (const r of rs) { const all = [].concat(r.sh.steps, r.path.steps, ...r.gov.map(g => g.steps), r.level ? r.level.steps : [], r.cc ? r.cc.steps : [], ...r.clr.map(x => x.steps),
    ...r.ground.cr.map(g => [].concat(g.steps, ...g.bear.map(b => b.steps), ...g.depth.map(d => d.steps || []))), ...r.ground.pair.map(d => d.steps || []));
    for (const s of all) { for (const f of ['sym', 'eq', 'sub']) if (s[f]) { parse(s[f]); n++; } if (s.unit) { parse(W.SharedSteps.unitTeX(s.unit)); n++; }
      assert.ok(!/NaN|undefined/.test(W.SharedSteps.toText([s])), s.id + ' ' + W.SharedSteps.toText([s])); } }
  assert.ok(rs[0].ground.pair.length === 1 && n > 150, String(n));
});
