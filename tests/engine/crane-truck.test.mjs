// Crane Pick Analyzer (apps/crane-pick), 2026-11-17: the route / girder geometry link (engine/route.js geometry(): L2 from the load for
// dolly / jeep haulers, deck fit and overhangs for semi / stretch, rear-overhang limit, front reach to the cab), the height stack-up
// (deck + blocking + load, the vehicle height in the overhead checks), and the vehicle-and-load drawing (engine/truckgfx.js) drawn from
// the engine's values. Node only; synthetic geometry.
//   node tests/engine/run.mjs crane-truck
//
// Hand checks (calculator; the numbers below are those results):
// A. Dolly hauler, L2 from the girder: L 120, a_F 3, r 5 → L2 = 120 − 3 − 5 = 112 ft; f = 120 − 112 − 5 = 3 = a_F. Load 90,000 lb, CG 60
//    from the front: x_L = 60 − 3 = 57; R_b = 90,000·57/112 = 45,803.57; rear dolly 45,803.57 + 12,000 = 57,803.57; R_H = 44,196.43;
//    R_drive = (20,000·8 + 44,196.43·19)/20 = 49,986.61; R_steer = 14,209.82; gross 122,000 lb.
//    Steady off-tracking at R 150 (L1 20, e 1, k 0): R_T = √(150² − 20²) = 148.6607, R_K = √(R_T² + 1) = 148.6641,
//    L2 112: R_D = √(R_K² − 112²) = 97.7599, OT = 52.2401; girder shortened to 100 ft → L2 92: R_D = 116.7776, OT = 33.2224.
//    The same route saved without L2src (legacy) keeps its entered L2 (80): the derivation applies only when switched.
// B. Semi, deck fit: L2 40, dF 3, dR 4 → deck 47 ft. Girder 60, r 6: f = 60 − 40 − 6 = 14, o_F = 14 − 3 = 11, o_R = 6 − 4 = 2.
//    Cab 8 ft behind the steer axle: c_cab = (20 − 1) − 8 = 11 → f = 14 ≥ 11: reaches the cab (warn while the cab is the default,
//    stop when entered). Load 50, r 2, B 8: f = 8 < 11, ρ = √(8² + 4²) = 8.9443 ≤ 11: clear; B 20: ρ = √(8² + 10²) = 12.8062 > 11: warn.
//    Rear overhang r 16: o_rear = 16 − 4 = 12 > 10 (default limit): warn; project limit 15: none. Dolly r 10, Ld 12: 10 − 6 = 4.
//    Jeep: c_cab = (20 − 1) + (10 − 0.5) − 8 = 20.5. Stretch closed 40 + 30 max: L2 75 stop, 35 stop, 60 none.
//    Overall length, the default semi + 50 ft load: front +4 (bumper), rear: load −61 / deck −63 / tractor −23 → 4 − (−63) = 67 ft.
// C. Height stack-up: deck 5 + blocking 0.5 + load 6 = 11.5 ft. An overhead line 12.0 ft: c = 0.5 < 1 (margin): warn; vehicle height
//    13.5 entered: H = max(13.5, 11.5) = 13.5, c = −1.5: stop. Power line 20 ft, sag 1, crossed: d_v = 20 − 1 − 11.5 = 7.5.
//    Blocking 0 and no vehicle height: H_top = 5 + 0 + 6 = 11.00, the C6 value.
import assert from 'node:assert/strict';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps', 'crane-pick', 'engine');
const W = loadShared('steps.js', 'boussinesq.js', ...['geo.js', 'model.js', 'osha.js', 'cranes.js', 'lift.js', 'elev.js', 'clear3d.js', 'ground.js', 'tandem.js', 'route.js', 'truckgfx.js'].map(f => path.join(APP, f)));
const RT = W.CranePickRoute, M = W.CranePickModel, TG = W.CranePickTruckGfx;
const same = (a, b, m) => assert.equal(JSON.stringify(a), JSON.stringify(b), m);   // the vm context's objects (another realm)
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const P0 = { items: [], routeMarks: [], setups: [], cranes: [], tandems: [], picks: [] };
const SEMI = { type: 'semi', L1: 20, e: 1, L2: 40, Wtr: 20000, xt: 8, Wtl: 15000, xtl: 25, nS: 1, nD: 2, nR: 3, tS: 2, tD: 4, tR: 4 };
const DOLLY = { type: 'dolly', L1: 20, e: 1, Wtr: 20000, xt: 8, Wd: 12000, L2src: 'load' };
const straight = o => Object.assign({ pts: [{ x: 0, y: 0 }, { x: 400, y: 0 }], rad: [null, null], margin: 1 }, o);
const circleRoute = (R, N) => { const pts = [{ x: -200, y: 0 }], step = 2 * Math.PI / N, Lh = R * Math.tan(step / 2); let th = 0, p = { x: 0, y: 0 };
  for (let k = 0; k < 2 * N; k++) { const v = { x: p.x + Lh * Math.cos(th), y: p.y + Lh * Math.sin(th) }; pts.push(v); th += step; p = { x: v.x + Lh * Math.cos(th), y: v.y + Lh * Math.sin(th) }; }
  pts.push({ x: p.x + 2 * Lh * Math.cos(th), y: p.y + 2 * Lh * Math.sin(th) }); return { pts, rad: pts.map((_, i) => i ? R * (1 - 1e-9) : null) }; };

test('A. dolly hauler: L2 from the girder length (hand check), axle statics, off-tracking follows the girder length; legacy keeps L2', () => {
  const r = straight({ veh: DOLLY, load: { L: 120, W: 90000, cg: 60, r: 5, fF: 3 } }), ev = RT.evaluate(r, P0, 'rt');
  near(ev.sim.v.L2, 112, 1e-12, 'L2'); assert.equal(ev.sim.v.from.L2, 'load'); near(ev.ax.f, 3, 1e-12, 'f = a_F');
  const g = k => ev.ax.groups.find(q => q.k === k).load;
  near(g('R'), 57803.5714, 1e-3, 'rear dolly'); near(g('D'), 49986.6071, 1e-3, 'drive'); near(g('S'), 14209.8214, 1e-3, 'steer'); near(ev.ax.gross, 122000, 1e-6, 'gross');
  assert.equal(ev.geo.steps.find(s => s.id.endsWith('.L2')).eq, 'L \\minus a_{F} \\minus r');
  near(RT.steady(ev.sim.v, 150).OT, 52.2401, 1e-4, 'OT at L 120');
  // the girder linked from a C5 lift: its length drives L2; shortening it changes L2 and the off-tracking
  const t = M.normTandem({ id: 't1', name: 'G', girder: { L: 120, W: 90000, H: 7 }, pick: { x: 0, y: 0, h: 0 } }), P = Object.assign({}, P0, { tandems: [t] });
  const rr = Object.assign(circleRoute(150, 72), { veh: DOLLY, tandemId: 't1', load: { r: 5, fF: 3 } });
  let e1 = RT.evaluate(rr, P, 'rt'); near(e1.sim.v.L2, 112, 1e-9, 'L2 from the girder object');
  const ot1 = e1.otMax; t.girder.L = 100; const e2 = RT.evaluate(rr, P, 'rt'); near(e2.sim.v.L2, 92, 1e-9, 'L2 after the girder is shortened');
  near(RT.steady(e2.sim.v, 150).OT, 33.2224, 1e-4, 'OT at L 100'); assert.ok(e2.otMax < ot1 - 10, `off-tracking ${ot1} → ${e2.otMax}`);
  // override: L2src 'entered' (or a legacy route without it) uses veh.L2
  const leg = RT.evaluate(straight({ veh: { type: 'dolly', L2: 80 }, load: { L: 100, r: 10 } }), P0, 'rt'); near(leg.sim.v.L2, 80, 1e-12, 'legacy L2'); assert.equal(leg.sim.v.L2src, 'entered');
  const ent = RT.evaluate(straight({ veh: Object.assign({}, DOLLY, { L2src: 'entered', L2: 90 }), load: { L: 120, r: 5, fF: 3 } }), P0, 'rt'); near(ent.sim.v.L2, 90, 1e-12, 'entered L2');
  const bad = RT.evaluate(straight({ veh: DOLLY, load: { L: 6, r: 3, fF: 3 } }), P0, 'rt'); assert.equal(bad.ok, false); assert.match(bad.flags[0].text, /not positive/);
  // the semi ignores L2src
  near(RT.vehOf({ veh: Object.assign({}, SEMI, { L2src: 'load' }) }).L2, 40, 0, 'semi: L2 as entered');
});

test('B. deck fit, overhangs, rear-overhang limit, front reach to the cab, stretch range, overall size (hand checks)', () => {
  const fl = (ev, re) => ev.flags.filter(f => f.kind === 'geo' && re.test(f.text));
  let ev = RT.evaluate(straight({ veh: SEMI, load: { L: 60, r: 6 } }), P0, 'rt');
  near(ev.geo.Ldeck, 47, 1e-12); near(ev.geo.f, 14, 1e-12); near(ev.geo.oF, 11, 1e-12); near(ev.geo.oR, 2, 1e-12); near(ev.geo.cCab, 11, 1e-12);
  assert.equal(fl(ev, /overhangs the 47\.00 ft deck by 11\.00 ft at the front and by 2\.00 ft at the rear/)[0].level, 'info');
  assert.equal(fl(ev, /reaches the back of the cab/)[0].level, 'warn', 'cab assumed: warn');
  ev = RT.evaluate(straight({ veh: Object.assign({}, SEMI, { cab: 8 }), load: { L: 60, r: 6 } }), P0, 'rt'); assert.equal(fl(ev, /reaches the back of the cab/)[0].level, 'stop', 'cab entered: stop');
  ev = RT.evaluate(straight({ veh: SEMI, load: { L: 50, r: 2, B: 8 } }), P0, 'rt'); near(ev.geo.rho, 8.9443, 1e-4); assert.equal(ev.flags.filter(f => f.kind === 'geo' && f.level !== 'info').length, 0);
  near(ev.geo.Lov, 67, 1e-12, 'overall length'); near(ev.geo.Wov, 8.5, 1e-12); near(ev.geo.Hov, 11, 1e-12);
  ev = RT.evaluate(straight({ veh: SEMI, load: { L: 50, r: 2, B: 20 } }), P0, 'rt'); near(ev.geo.rho, 12.8062, 1e-4); assert.equal(fl(ev, /swing 12\.81 ft/)[0].level, 'warn');
  ev = RT.evaluate(straight({ veh: SEMI, load: { L: 70, r: 16 } }), P0, 'rt'); near(ev.geo.oRear, 12, 1e-12); assert.equal(fl(ev, /Rear overhang 12\.00 ft .* limit 10\.00 ft \(default\)/)[0].level, 'warn');
  ev = RT.evaluate(straight({ veh: SEMI, load: { L: 70, r: 16 } }), Object.assign({}, P0, { routeSet: { ohRear: 15 } }), 'rt'); assert.equal(fl(ev, /Rear overhang/).length, 0, 'project limit 15 ft');
  ev = RT.evaluate(straight({ veh: { type: 'dolly', L2: 80 }, load: { L: 100, r: 10 } }), P0, 'rt'); near(ev.geo.oRear, 4, 1e-12, 'dolly: r − Ld/2');
  ev = RT.evaluate(straight({ veh: { type: 'jeep', L1: 20, e: 1, Lj: 10, ej: 0.5, L2: 80 }, load: { L: 100, r: 10 } }), P0, 'rt'); near(ev.geo.cCab, 20.5, 1e-12, 'jeep c_cab');
  for (const [L2, n] of [[75, 1], [35, 1], [60, 0]]) { ev = RT.evaluate(straight({ veh: Object.assign({}, SEMI, { type: 'stretch', L2, L2c: 40, xMax: 30 }), load: { L: 50, r: 2 } }), P0, 'rt'); assert.equal(fl(ev, /Stretch trailer/).length, n, 'stretch L2 ' + L2); }
});

test('C. height stack-up: deck + blocking + load; the vehicle height in the overhead and power-line checks', () => {
  const marks = [{ id: 'm1', type: 'overhead', name: 'Sign', pts: [{ x: 150, y: -30 }, { x: 150, y: 30 }], h: 12 }];
  const items = [{ id: 'p1', type: 'power', name: 'OH', kv: 13.8, pts: [{ x: 250, y: -60 }, { x: 250, y: 60 }], height: 20, sag: 1 }];
  const P = Object.assign({}, P0, { routeMarks: marks, items });
  let ev = RT.evaluate(straight({ veh: SEMI, load: { L: 50, r: 2, h: 6, hB: 0.5 } }), P, 'rt');
  near(ev.oh.LT, 11.5, 1e-12); near(ev.oh.Htop, 11.5, 1e-12); const o = ev.oh.list.find(x => x.kind === 'mark'); near(o.c, 0.5, 1e-12); assert.equal(o.flag.level, 'warn');
  near(ev.oh.list.find(x => x.kind === 'power').steps.find(s => s.id.endsWith('.dv')).value, 7.5, 1e-12, 'd_v');
  ev = RT.evaluate(straight({ veh: Object.assign({}, SEMI, { hV: 13.5 }), load: { L: 50, r: 2, h: 6, hB: 0.5 } }), P, 'rt');
  near(ev.oh.Htop, 13.5, 1e-12); near(ev.oh.LT, 11.5, 1e-12); const o2 = ev.oh.list.find(x => x.kind === 'mark'); near(o2.c, -1.5, 1e-12); assert.equal(o2.flag.level, 'stop'); assert.match(o2.flag.text, /vehicle top/);
  ev = RT.evaluate(straight({ veh: SEMI, load: { L: 50, r: 2, h: 6 } }), P, 'rt'); near(ev.oh.Htop, 11, 1e-12, 'C6 value');
});

test('D. the drawing: dimensions and outlines are the engine values (plan, side, the map vehicle at a route pose)', () => {
  const t = M.normTandem({ id: 't1', name: 'G', girder: { L: 120, W: 90000, H: 7 }, pick: { x: 0, y: 0, h: 0 } }), P = Object.assign({}, P0, { tandems: [t] });
  for (const veh of [SEMI, DOLLY, { type: 'jeep', L1: 20, e: 1, Lj: 10, ej: 0.5, L2src: 'load', hV: 14 }]) {
    const r = Object.assign({}, straight({ veh, tandemId: 't1', load: { r: 5, fF: 3, hB: 0.75 } }), { pts: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }], rad: [null, 120, null] }), ev = RT.evaluate(r, P, 'rt'), m = TG.model(r, P, ev);
    const pl = TG.plan(m), sd = TG.side(m), dv = (f, id) => (f.prims.find(p => p.v === id) || {}).val;
    near(dv(pl, 'L2'), ev.sim.v.L2, 0, veh.type + ' L2'); near(dv(pl, 'L1'), ev.sim.v.L1, 0); near(dv(pl, 'L'), ev.sim.l.L, 0, 'L = girder'); near(dv(pl, 'Lov'), ev.geo.Lov, 0); near(dv(pl, 'Wov'), ev.geo.Wov, 0); near(dv(pl, 'Rmin'), ev.sim.v.Rmin, 0);
    if (Math.abs(ev.ax.f) > 1e-9) near(dv(pl, 'f'), ev.ax.f, 1e-12, 'f');
    near(dv(sd, 'LT'), ev.oh.LT, 0, 'load top'); near(dv(sd, 'hB'), 0.75, 0); near(dv(sd, 'hDeck'), ev.sim.v.hDeck, 0); near(dv(sd, 'Hov'), ev.geo.Hov, 0);
    ev.ax.groups.forEach(q => near(dv(sd, 'ax' + q.k), q.load, 0, 'axle group ' + q.k));
    // the plan dimension's drawn length = its value (to scale)
    const dL2 = pl.prims.find(p => p.v === 'L2'); near(Math.abs(dL2.b[0] - dL2.a[0]), ev.sim.v.L2, 1e-9, 'drawn L2');
    const dLT = sd.prims.find(p => p.v === 'LT'); near(dLT.b[1] - dLT.a[1], ev.oh.LT, 1e-9, 'drawn load top');
    // the outlines: engine/route.js outlines() at the straight pose and at the stop (the map vehicle)
    const o0 = RT.outlines(ev.sim.v, ev.sim.l, m.p0); o0.forEach(pp => same(pl.prims.find(p => p.part === pp.part).pts, pp.poly.map(q => [q.x, q.y])));
    const q = ev.sim.samples[ev.sim.samples.length - 1], pm = TG.plan(m, q.p); q.parts.forEach(pp => same(pm.prims.find(p => p.part === pp.part).pts, pp.poly.map(c => [c.x, c.y]), 'map ' + pp.part));
    assert.equal(pm.prims.filter(p => p.t === 'dim').length, 0, 'no dimensions on the map vehicle');
    const s1 = TG.svg(pl), s2 = TG.svg(sd); assert.ok(/data-v="L2"/.test(s1) && /data-v="LT"/.test(s2) && /tg-scale/.test(s1) && !/NaN|undefined/.test(s1 + s2), veh.type + ' svg');
    // one scale for x and y (to scale)
    const k = +s1.match(/data-ftpx="([\d.]+)"/)[1]; assert.ok(k > 0);
  }
});

test('E. saved data: the new fields only when present (normRoute); steps KaTeX (strict), no NaN / undefined', async () => {
  const old = M.normRoute({ pts: [{ x: 0, y: 0 }, { x: 10, y: 0 }], veh: { type: 'dolly', L2: 80 }, load: { L: 100 } });
  assert.ok(!('L2src' in old.veh) && !('cab' in old.veh) && !('hV' in old.veh) && !('fF' in old.load) && !('hB' in old.load), 'an old route gains no field');
  const nw = M.normRoute({ pts: [{ x: 0, y: 0 }, { x: 10, y: 0 }], veh: { type: 'dolly', L2src: 'load', cab: 9, hV: 13.5, L2c: 40, xMax: 20 }, load: { fF: 3, hB: 0.5 } });
  same([nw.veh.L2src, nw.veh.cab, nw.veh.hV, nw.veh.L2c, nw.veh.xMax, nw.load.fF, nw.load.hB], ['load', 9, 13.5, 40, 20, 3, 0.5]);
  same(M.normalize({ format: M.FORMAT }).routeSet, { ohRear: null }); same(M.normalize({ format: M.FORMAT, routeSet: { ohRear: 12 } }).routeSet, { ohRear: 12 });
  const { createRequire } = await import('node:module');
  const katex = createRequire(import.meta.url)(path.join(ROOT, 'tests/libs/katex@0.16.9/dist/katex.min.js'));
  const parse = x => katex.renderToString(x, { ...W.SharedSteps.katexOpt, throwOnError: true, strict: 'error' });
  const evs = [RT.evaluate(straight({ veh: Object.assign({}, SEMI, { type: 'stretch', L2c: 30, xMax: 20, hV: 13 }), load: { L: 60, r: 6, hB: 1 } }), P0, 'rt'), RT.evaluate(straight({ veh: DOLLY, load: { L: 120, r: 5, fF: 3 } }), P0, 'rt'),
    RT.evaluate(straight({ veh: { type: 'jeep', L2src: 'load' }, load: { L: 100, r: 5, fF: 4, B: 20 } }), P0, 'rt'), RT.evaluate(straight({ veh: SEMI, load: { L: 50, r: 2, B: 20 } }), P0, 'rt')];
  let n = 0;
  evs.forEach(ev => [].concat(ev.geo.steps, ev.oh.top).forEach(s => { for (const f of ['sym', 'eq', 'sub']) if (s[f]) { parse(s[f]); n++; } if (s.unit) { parse(W.SharedSteps.unitTeX(s.unit)); n++; } assert.ok(!/NaN|undefined/.test(W.SharedSteps.toText([s])), s.id + ' ' + W.SharedSteps.toText([s])); }));
  assert.ok(n > 60, String(n));
});

test('F. QA 2026-11-17: tangent-length text r tan(|Δ|/2); the off-tracking window reported; the load defaults flagged', () => {
  const r = { pts: [{ x: 0, y: 0 }, { x: 120, y: 10 }, { x: 220, y: 60 }, { x: 300, y: 160 }, { x: 330, y: 300 }], rad: [null, 80, null, 40, null], veh: { type: 'jeep', L1: 18, e: 1, Lj: 12, ej: 0.5, L2: 90, k: 0.6 }, load: { L: 110, r: 5, W: 90000 }, pickId: 'k1' };
  const P = Object.assign({}, P0, { picks: [{ id: 'k1', name: 'Pick 1', pick: { x: 0, y: 0 }, set: { x: 0, y: 0 } }] }), ev = RT.evaluate(r, P, 'rt');
  const T = ev.turns[0].steps.find(s => s.id.endsWith('.T')); assert.equal(W.SharedSteps.toText(T.eq), 'r tan(|Δ|/2)'); assert.match(W.SharedSteps.toText(T.sub), /^80\.00 tan\([\d.]+°\/2\)$/);
  // turn 1's window (curve start + one vehicle length) runs into turn 2: labelled; the values are unchanged (pinned in crane-road G)
  const ot = ev.turns[0].steps.find(s => s.id.endsWith('.OT')); assert.match(ot.label, /searched from 105\.0 to [\d,.]+ ft .*runs into turn 2 from 220\.9 ft: the value can include its off-tracking \(conservative\)/); assert.equal(ev.turns[0].otOver, true);
  near(ev.turns[0].ot, 6.140997313745413, 1e-9, 'unchanged');
  const fl = ev.flags.filter(f => f.kind === 'load'); assert.equal(fl.length, 1); assert.equal(fl[0].level, 'warn');
  assert.match(fl[0].text, /the DEFAULT width 8\.00 ft, height 6\.00 ft are used \(the pick "Pick 1" does not give the load's size\)/);
  assert.equal(RT.evaluate(Object.assign({}, r, { load: { L: 110, r: 5, W: 90000, B: 8, h: 6 } }), P, 'rt').flags.filter(f => f.kind === 'load').length, 0, 'all entered: no flag');
});
