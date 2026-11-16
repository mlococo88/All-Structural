// Crane Pick Analyzer (apps/crane-pick), C6: the trucking route (engine/route.js): path curves, kinematic off-tracking vs the closed-form
// steady state, axle-load statics, overhead / power-line travel clearances (29 CFR 1926.1411 Table T), posted bridges, haul-road tyre
// bearing, staging (C2 pick, C5 girder lift). Node only; no crane chart data is needed (synthetic geometry).
//   node tests/engine/run.mjs crane-route
//
// Hand checks (independent arithmetic, calculator; the numbers below are those results):
// A. Steady-state off-tracking on a constant radius (the closed form of the kinematic model: SAE J695; NCHRP Report 505 (2003) ch. 3):
//    semi L1 = 20, e = +1, L2 = 40, R = 60 ft: R_T = √(60² − 20²) = √3,200 = 56.5685; R_K = √(3,200 + 1²) = 56.5774;
//    R_D = √(3,201 − 40²) = √1,601 = 40.0125; OT = 60 − 40.0125 = 19.9875 ft.
//    semi L1 = 15, e = −1, L2 = 50, R = 60: R_D² = 3,600 − 225 + 1 − 2,500 = 876 → R_D = 29.5973, OT = 30.4027 ft.
//    jeep L1 18, e 1, Lj 12, ej 0.5, L2 90, R 150 (k = 0): R_D² = 22,500 − 324 + 1 − 144 + 0.25 − 8,100 = 13,933.25 → R_D = 118.0392, OT = 31.9608.
//    The simulation follows a 72-sided polygon whose curves (r = R) join into a full circle, three laps: it must reach the closed form.
// B. Axle loads, semi (statics): tractor W 20,000 lb at 8 ft behind the steer axle, L1 20, e 1; trailer 15,000 lb at 25 ft behind the
//    kingpin, L2 40; load 50 ft, 40,000 lb, rear overhang 2, CG at mid-length: f = 50 − 40 − 2 = 8; x_L = 25 − 8 = 17;
//    R_rear = (15,000·25 + 40,000·17)/40 = 1,055,000/40 = 26,375; R_K = 55,000 − 26,375 = 28,625;
//    R_drive = (20,000·8 + 28,625·19)/20 = 703,875/20 = 35,193.75; R_steer = 20,000 + 28,625 − 35,193.75 = 13,431.25; gross 75,000 lb.
//    Per axle: drive 17,596.875 (2 axles), rear 8,791.667 (3); per tyre: steer 6,715.625 (2), drive 4,399.219 (8), rear 2,197.917 (12).
//    Jeep + dolly: jeep Lj 10, ej 0.5, 8,000 lb; dolly 12,000 lb at the pivot, L2 90; load 100 ft, 80,000 lb, r 5, CG 50:
//    f = 5, x_L = 45; R_b = 80,000·45/90 = 40,000; R_rear = 52,000; R_H = 40,000; R_J = (40,000·9.5 + 8,000·10)/10 = 46,000;
//    R_K = 40,000 + 8,000 − 46,000 = 2,000; R_drive = (160,000 + 2,000·19)/20 = 9,900; R_steer = 22,000 − 9,900 = 12,100; gross 120,000.
// C. Overhead (straight route east along y = 0; load top 5 + 6 = 11 ft): a line across at x = 150 with h 14.5 → c = 3.5 ≥ 1 OK; h 11.5 →
//    c = 0.5 < 1 warn; h 10 → −1 stop. A power line across at x = 200, lowest wire 20 ft, sag 1 → d_v = 20 − 1 − 11 = 8, d_h = 0, d = 8:
//    13.8 kV (Table T 6 ft) → OK but < 20 ft: spotter (warn); 115 kV (10 ft) → stop. A line along y = 15 (the outlines' edge is at
//    4.25 ft: tractor / trailer width 8.5), 13.8 kV, wire 12 ft: d_h = 10.75, d_v = 1, d = √(10.75² + 1²) = 10.7964 ≥ 6: spotter (warn).
// D. Posting: gross 75,000 lb = 37.50 t: 40 t OK, 36 t over; heaviest axle 17,596.875 lb = 8.7984 t: 10 t OK, 8 t over.
// E. Haul road, no mat: heaviest tyre 6,715.625 lb (steer), A = 100 in² = 0.694444 ft² → q_g = 6,715.625 / 0.694444 = 9,670.50 psf;
//    q_a 10,000 → 0.9671 OK.
// F. Staging (straight route ending at (300, 0) heading east, the semi above): steer axle 300, drive 280, kingpin 281, load front
//    281 + 8 = 289, CG 25 behind it: (264, 0). C5 girder lift L 50 with its pick pose at (275, 0), h 270° (end A toward the tractor:
//    A → B points west): offset 11.00 ft, Δh 0°.
// G. Curve fit: 90° bend between two 100 ft end segments, r 150 asked: T = 150 tan 45° = 150 > 100 available → r = 100 (flagged).
import assert from 'node:assert/strict';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps', 'crane-pick', 'engine');
const W = loadShared('steps.js', 'boussinesq.js', ...['geo.js', 'model.js', 'osha.js', 'cranes.js', 'lift.js', 'elev.js', 'clear3d.js', 'ground.js', 'tandem.js', 'route.js'].map(f => path.join(APP, f)));
const RT = W.CranePickRoute, O = W.CranePickOSHA, M = W.CranePickModel;
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const SEMI = { type: 'semi', L1: 20, e: 1, L2: 40, Wtr: 20000, xt: 8, Wtl: 15000, xtl: 25, nS: 1, nD: 2, nR: 3, tS: 2, tD: 4, tR: 4 };
const LOAD = { L: 50, W: 40000, r: 2, h: 6, B: 8 };
function circleRoute(R, laps, N) {   // a polygon circumscribed about the circle (centre (0, R)): its curves of radius R form the circle
  const pts = [{ x: -200, y: 0 }], step = 2 * Math.PI / N, Lh = R * Math.tan(step / 2); let th = 0, p = { x: 0, y: 0 };
  for (let k = 0; k < laps * N; k++) { const v = { x: p.x + Lh * Math.cos(th), y: p.y + Lh * Math.sin(th) }; pts.push(v); th += step; p = { x: v.x + Lh * Math.cos(th), y: v.y + Lh * Math.sin(th) }; }
  pts.push({ x: p.x + 2 * Lh * Math.cos(th), y: p.y + 2 * Lh * Math.sin(th) });
  return { pts, rad: pts.map((_, i) => i ? R * (1 - 1e-9) : null) };
}
const straight = (o) => Object.assign({ pts: [{ x: 0, y: 0 }, { x: 300, y: 0 }], rad: [null, null], veh: SEMI, load: LOAD, margin: 1 }, o);

test('A. steady-state off-tracking: closed form (hand check) and the simulation on a constant radius', () => {
  const cases = [[SEMI, 60, 40.0125, 19.9875], [{ type: 'semi', L1: 15, e: -1, L2: 50 }, 60, 29.5973, 30.4027], [{ type: 'jeep', L1: 18, e: 1, Lj: 12, ej: 0.5, L2: 90, k: 0 }, 150, 118.0392, 31.9608]];
  for (const [veh, R, RD, OT] of cases) {
    const ss = RT.steady(RT.vehOf({ veh }), R); near(ss.RD, RD, 1e-4, veh.type + ' R_D'); near(ss.OT, OT, 1e-4, veh.type + ' OT');
    const r = Object.assign(circleRoute(R, 3, 72), { veh, load: LOAD }), sim = RT.simulate(r);
    assert.equal(sim.pa.turns.filter(t => t.reduced).length, 0);
    const q = sim.samples[sim.samples.length - 30], rd = Math.hypot(q.p.D.x, q.p.D.y - R);
    near(rd, RD, 2e-3, veh.type + ' simulated R_D'); near(R - rd, OT, 2e-3, veh.type + ' simulated OT'); near(q.ot, OT, 5e-3, veh.type + ' off-tracking (distance to the path)');
  }
  assert.equal(RT.steady(RT.vehOf({ veh: SEMI }), 15), null, 'R < L1: no steady state');
});

test('A2. steered rear dolly: the closed form (δ = −k γ, fixed point) equals the simulation; steering reduces off-tracking', () => {
  for (const veh of [{ type: 'dolly', L1: 20, e: 1, L2: 100, k: 0.5 }, { type: 'jeep', L1: 18, e: 1, Lj: 12, ej: 0.5, L2: 90, k: 0.7 }]) {
    const R = 150, ss = RT.steady(RT.vehOf({ veh }), R), ss0 = RT.steady(RT.vehOf({ veh: Object.assign({}, veh, { k: 0 }) }), R);
    const sim = RT.simulate(Object.assign(circleRoute(R, 3, 72), { veh, load: { L: 110, r: 5 } })), q = sim.samples[sim.samples.length - 30];
    near(Math.hypot(q.p.D.x, q.p.D.y - R), ss.RD, 2e-3, veh.type + ' R_D'); near(q.p.dl, ss.dl, 1e-4, veh.type + ' δ');
    assert.ok(ss.OT < ss0.OT - 5, `${veh.type}: steered ${ss.OT} < unsteered ${ss0.OT}`);
  }
  // k = 0.5, δmax 5°: the steer angle is held at 5°
  const sl = RT.steady(RT.vehOf({ veh: { type: 'dolly', L1: 20, e: 1, L2: 100, k: 0.5, dmax: 5 } }), 150); near(Math.abs(sl.dl) * 180 / Math.PI, 5, 1e-9);
});

test('B. axle-group loads by statics (hand checks: semi; jeep + dolly); entered loads', () => {
  const a = RT.axles({ veh: SEMI, load: LOAD }, 'ax');
  const g = Object.fromEntries(a.groups.map(q => [q.k, q]));
  near(a.f, 8, 1e-12); near(a.xL, 17, 1e-12); near(g.R.load, 26375, 1e-9); near(g.D.load, 35193.75, 1e-9); near(g.S.load, 13431.25, 1e-9); near(a.gross, 75000, 1e-9);
  near(g.D.perAxle, 17596.875, 1e-9); near(g.R.perAxle, 8791.6667, 1e-3); near(g.S.perTyre, 6715.625, 1e-9); near(g.D.perTyre, 4399.21875, 1e-9); near(g.R.perTyre, 2197.9167, 1e-3);
  assert.equal(a.heavyAxle.q.k, 'D'); assert.equal(a.heavyTyre.q.k, 'S');
  const j = RT.axles({ veh: { type: 'jeep', L1: 20, e: 1, Wtr: 20000, xt: 8, Lj: 10, ej: 0.5, Wj: 8000, Wd: 12000, L2: 90 }, load: { L: 100, W: 80000, r: 5, cg: 50 } }, 'ax');
  const h = Object.fromEntries(j.groups.map(q => [q.k, q]));
  near(h.R.load, 52000, 1e-9); near(h.J.load, 46000, 1e-9); near(h.D.load, 9900, 1e-9); near(h.S.load, 12100, 1e-9); near(j.gross, 120000, 1e-9);
  const e = RT.axles({ veh: SEMI, load: LOAD, axIn: { on: true, S: 12000, D: 34000, R: 30000 } }, 'ax'); assert.equal(e.mode, 'entered'); near(e.gross, 76000, 1e-9);
  const up = RT.axles({ veh: SEMI, load: { L: 50, W: 40000, r: 40 } }, 'ax'); assert.ok(up.flags.some(f => /uplift/.test(f.text)), 'a load far behind: uplift flagged');
});

test('C. overhead clearances: marks (margin) and power lines (29 CFR 1926.1411 Table T, spotter within 20 ft)', () => {
  [[0.48, 4], [0.75, 4], [0.76, 6], [13.8, 6], [50, 6], [115, 10], [345, 10], [500, 16], [750, 16], [765, 20], [1000, 20]].forEach(([kv, ft]) => assert.equal(O.travel({ kv }).ft, ft, kv + ' kV'));
  assert.ok(isNaN(O.travel({ kv: 1100 }).ft)); assert.equal(O.travel({ kv: 1100, setFt: 30 }).ft, 30); assert.equal(O.travel({}).ft, 20); assert.equal(O.travel({}).known, false);
  const oh = h => ({ id: 'm1', type: 'overhead', name: 'Sign bridge', pts: [{ x: 150, y: -20 }, { x: 150, y: 20 }], h });
  const run = (marks, items) => RT.evaluate(straight(), { items: items || [], routeMarks: marks, setups: [], picks: [], cranes: [] }, 'rt');
  let ev = run([oh(14.5)]); near(ev.oh.Htop, 11, 1e-12); near(ev.oh.list[0].c, 3.5, 1e-12); assert.equal(ev.oh.list[0].flag, null);
  ev = run([oh(11.5)]); assert.equal(ev.oh.list[0].flag.level, 'warn');
  ev = run([oh(10)]); assert.equal(ev.oh.list[0].flag.level, 'stop');
  ev = run([{ id: 'm2', type: 'overhead', name: 'off route', pts: [{ x: 150, y: 30 }], w: 2, h: 5 }]); assert.equal(ev.oh.list.length, 0, 'a point 30 ft off the route is not reached');
  const pw = (kv, o) => Object.assign({ id: 'p1', type: 'power', name: 'OH', kv, pts: [{ x: 200, y: -50 }, { x: 200, y: 50 }], height: 20, sag: 1 }, o);
  ev = run([], [pw(13.8)]); let p = ev.oh.list[0]; near(p.d, 8, 1e-9); assert.equal(p.DT, 6); assert.equal(p.flag.level, 'warn'); assert.match(p.flag.text, /spotter/);
  ev = run([], [pw(115)]); assert.equal(ev.oh.list[0].flag.level, 'stop');
  ev = run([], [pw(13.8, { height: null })]); assert.equal(ev.oh.list[0].flag.level, 'stop', 'crossed with no wire height');
  ev = run([], [pw(13.8, { pts: [{ x: -50, y: 15 }, { x: 400, y: 15 }], height: 12, sag: 0 })]); p = ev.oh.list[0]; near(p.dh, 10.75, 1e-9); near(p.d, Math.hypot(10.75, 1), 1e-9); assert.equal(p.flag.level, 'warn');
  ev = run([], [pw(13.8, { pts: [{ x: -50, y: 30 }, { x: 400, y: 30 }], height: 25 })]); assert.equal(ev.oh.list.length, 0, '25.75 ft away: not listed');
});

test('D. posted bridges: gross, per axle, by vehicle type', () => {
  const br = post => ({ id: 'b1', type: 'bridge', name: 'Br. 12', pts: [{ x: 100, y: 0 }, { x: 160, y: 0 }], w: 30, post });
  const run = post => RT.evaluate(straight(), { items: [], routeMarks: [br(post)], setups: [], picks: [], cranes: [] }, 'rt').br[0];
  let b = run({ gross: 40 }); assert.equal(b.ok, true); near(b.checks[0].val, 37.5, 1e-12);
  b = run({ gross: 36 }); assert.equal(b.flag.level, 'stop');
  b = run({ axle: 10 }); assert.equal(b.ok, true); near(b.checks[0].val, 8.7984375, 1e-9);
  b = run({ axle: 8 }); assert.equal(b.flag.level, 'stop');
  b = run({ tLabel: 'Type 3S2', tTons: 36 }); assert.equal(b.flag.level, 'stop'); assert.match(b.flag.text, /Type 3S2/);
  b = run({}); assert.equal(b.flag.level, 'warn', 'no posting entered');
  const off = RT.evaluate(straight(), { items: [], routeMarks: [{ id: 'b2', type: 'bridge', pts: [{ x: 100, y: 100 }, { x: 160, y: 100 }], w: 30, post: { gross: 1 } }] }, 'rt'); assert.equal(off.br.length, 0, 'a bridge 100 ft away is not on the route');
});

test('E. haul road: heaviest tyre bearing (C4 bearing method); with a mat', () => {
  const hl = o => Object.assign({ id: 'h1', type: 'haul', name: 'Haul road', pts: [{ x: 50, y: 0 }, { x: 250, y: 0 }], w: 20, qa: 10000, mat: { type: 'none' } }, o);
  let h = RT.evaluate(straight({ tyre: { A: 100 } }), { items: [], routeMarks: [hl()] }, 'rt').haul[0];
  near(h.P, 6715.625, 1e-9); near(h.qg, 9670.5, 1e-6); near(h.ratio, 0.96705, 1e-6); assert.equal(h.flag, null);
  h = RT.evaluate(straight({ tyre: { A: 100 } }), { items: [], routeMarks: [hl({ qa: 8000 })] }, 'rt').haul[0]; assert.equal(h.flag.level, 'stop');
  // a timber mat 4 × 4 ft × 12 in, k 1: a = √(100/144) = 0.833333; B_e = min(4, 0.833333 + 2) = 2.833333; q = 6,715.625 / 2.833333² = 836.55; q_g = q + 50·1
  h = RT.evaluate(straight({ tyre: { A: 100 } }), { items: [], routeMarks: [hl({ mat: { type: 'timber', B: 4, L: 4, t: 12, Fb: 1200, Fv: 150, k: 1 } })] }, 'rt').haul[0];
  near(h.qg, 6715.625 / Math.pow(Math.sqrt(100 / 144) + 2, 2) + 50, 1e-6);
});

test('F. staging: load CG at the stop vs a C2 pick; a C5 girder lift pose; conflicts with the site', () => {
  const sim = RT.simulate(straight()); const cg = RT.loadCg(sim); near(cg.x, 264, 1e-9); near(cg.y, 0, 1e-9);
  const P = { items: [], routeMarks: [], setups: [], picks: [{ id: 'k1', name: 'G1', pick: { x: 270, y: 0 }, set: { x: 0, y: 0 } }], cranes: [] };
  let ev = RT.evaluate(straight({ pickId: 'k1' }), P, 'rt'); near(ev.stage.off, 6, 1e-9); assert.ok(ev.stage.flags.some(f => /6\.0 ft from the pick point/.test(f.text)));
  const t = M.normTandem({ id: 't1', name: 'G1 tandem', girder: { L: 50, W: 40000 }, pick: { x: 275, y: 0, h: 270 } });
  P.tandems = [t]; ev = RT.evaluate(straight({ tandemId: 't1', load: { r: 2 } }), P, 'rt');
  assert.equal(ev.sim.l.from, 'girder lift "G1 tandem"'); near(ev.sim.l.L, 50, 1e-12); near(ev.sim.l.W, 40000, 1e-12);
  near(ev.stage.lp.x, 264, 1e-9); near(ev.stage.lp.h, 270, 1e-9); near(ev.stage.off, 11, 1e-9); near(ev.stage.dh, 0, 1e-9);
  ev = RT.evaluate(straight({ tandemId: 't1', endA: 'rear', load: { r: 2 } }), P, 'rt'); near(Math.abs(ev.stage.dh), 180, 1e-9); assert.ok(ev.stage.flags.some(f => /180\.0°/.test(f.text)));
  const obst = { id: 'o1', type: 'obst', name: 'Pier', pts: [{ x: 100, y: 3 }, { x: 110, y: 3 }, { x: 110, y: 10 }, { x: 100, y: 10 }] };
  ev = RT.evaluate(straight(), { items: [obst, Object.assign({}, obst, { id: 'o2', type: 'excl', name: 'Wetland', pts: obst.pts.map(p => ({ x: p.x + 50, y: p.y + 10 })) })], routeMarks: [] }, 'rt');
  assert.equal(ev.conf.length, 1); assert.equal(ev.conf[0].level, 'stop'); assert.match(ev.conf[0].text, /Pier/);
});

test('G. curves: the radius reduced to fit the tangents; the minimum turning radius flag; the model keeps the inputs', () => {
  const r = { pts: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], rad: [null, 150, null], veh: SEMI, load: LOAD };
  const pa = RT.path(r); assert.equal(pa.turns.length, 1); near(pa.turns[0].r, 100, 1e-9); assert.equal(pa.turns[0].reduced, true); near(pa.turns[0].D, Math.PI / 2, 1e-12);
  near(pa.L, 100 * Math.PI / 2, 1e-9, 'all curve');
  const ev = RT.evaluate(Object.assign({}, r, { rad: [null, 40, null], veh: Object.assign({}, SEMI, { Rmin: 45 }) }), { items: [], routeMarks: [] }, 'rt');
  assert.ok(ev.turns[0].flags.some(f => f.level === 'stop' && /minimum turning radius/.test(f.text)));
  assert.ok(ev.turns[0].Rin > 0 && ev.turns[0].Rin < 40 && ev.turns[0].Rout > 40, 'inside < r < outside');
  const n = M.normRoute({ name: 'R', pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }], veh: { type: 'jeep', e: -2, L1: -3 }, load: { r: -1 }, rad: [5, 6] });
  assert.equal(n.veh.type, 'jeep'); assert.equal(n.veh.e, -2); assert.equal(n.veh.L1, null); assert.equal(n.load.r, -1); assert.equal(n.rad.join(), '5,6');
  assert.equal(M.normalize({ schema: 'crane-pick.project' }).routes.length, 0);
  assert.equal(M.normRouteMark({ type: 'overhead', pts: [{ x: 1, y: 2 }], h: 14 }).h, 14); assert.equal(M.normRouteMark({ type: 'nope', pts: [] }), null);
});

test('steps: KaTeX (strict) for every sym / eq / sub / unit; no NaN / undefined (turns, axles, overhead, haul, bridges, staging)', async () => {
  const { createRequire } = await import('node:module');
  const katex = createRequire(import.meta.url)(path.join(ROOT, 'tests/libs/katex@0.16.9/dist/katex.min.js'));
  const parse = x => katex.renderToString(x, { ...W.SharedSteps.katexOpt, throwOnError: true, strict: 'error' });
  const items = [{ id: 'p1', type: 'power', name: 'OH', kv: 13.8, pts: [{ x: 150, y: -60 }, { x: 150, y: 260 }], height: 25, sag: 1, sway: 1 }];
  const marks = [{ id: 'm1', type: 'overhead', name: 'Sign', pts: [{ x: 60, y: -20 }, { x: 60, y: 20 }], h: 15 }, { id: 'h1', type: 'haul', name: 'Haul', pts: [{ x: 0, y: 0 }, { x: 200, y: 0 }], w: 20, qa: 5000, mat: { type: 'steel', B: 4, L: 4, t: 1, Fy: 36 } },
    { id: 'b1', type: 'bridge', name: 'Br', pts: [{ x: 20, y: 0 }, { x: 60, y: 0 }], post: { gross: 40, axle: 10, tLabel: '3S2', tTons: 36 } }];
  const t = M.normTandem({ id: 't1', name: 'G', girder: { L: 100, W: 80000, H: 6, pair: { on: true, s: 8 } }, pick: { x: 200, y: 180, h: 0 } });
  const P = { items, routeMarks: marks, setups: [], cranes: [], tandems: [t], picks: [{ id: 'k1', name: 'K', pick: { x: 0, y: 0 }, set: { x: 0, y: 0 }, load: 1 }] };
  const base = { pts: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 100, y: 300 }], rad: [null, 80, 60, null] };
  const rs = [RT.evaluate(Object.assign({}, base, { veh: SEMI, load: LOAD, pickId: 'k1' }), P, 'rt'), RT.evaluate(Object.assign({}, base, { veh: { type: 'jeep', k: 0.6, L2: 85 }, tandemId: 't1', load: { r: 6 } }), P, 'rt', { tev: { steps: [] } }),
    RT.evaluate(Object.assign({}, base, { veh: { type: 'dolly', k: 0.4, L2: 80 }, load: { L: 100, r: 10 } }), P, 'rt')];
  let n = 0;
  for (const r of rs) { const all = [].concat(...r.turns.map(q => q.steps), r.ax.steps, r.oh.top, ...r.oh.list.map(o => o.steps), ...r.haul.filter(h => !h.flagOnly).map(h => h.steps), ...r.br.map(b => b.steps), r.stage.steps);
    for (const s of all) { for (const f of ['sym', 'eq', 'sub']) if (s[f]) { parse(s[f]); n++; } if (s.unit) { parse(W.SharedSteps.unitTeX(s.unit)); n++; }
      assert.ok(!/NaN|undefined/.test(W.SharedSteps.toText([s])), s.id + ' ' + W.SharedSteps.toText([s])); } }
  assert.ok(rs.every(r => r.oh.list.length === 2 && r.haul.length && r.br.length === 1) && n > 200, String(n));
});
