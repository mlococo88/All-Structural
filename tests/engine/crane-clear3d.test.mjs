// Crane Pick Analyzer (apps/crane-pick), C3-2: 3D clearances (engine/clear3d.js) and the path models (engine/lift.js). Node only, with
// the SYNTHETIC fake crane of tests/smoke/crane-fake-wheeled.json (made-up values).
//   node tests/engine/run.mjs crane
//
// Hand-computed distance cases (ft):
//   segment–segment: (0,0,0)-(10,0,0) to (5,5,−5)-(5,5,5) = 5 (closest (5,0,0), (5,5,0)); to (0,3,4)-(0,13,4) = √(3² + 4²) = 5;
//     parallel (2,3,4)-(8,3,4) = 5; crossing (5,−5,0)-(5,5,0) = 0.
//   segment–prism (square 0…10 × 0…10, z 0…20): (15,5,10)-(25,5,10) = 5 (side face); (−5,5,25)-(15,5,25) = 5 (above the top);
//     (13,14,10)-(14,13,10) = |10 + 10 − 27| / √2 = 4.9497 (the vertical edge at (10, 10)); (−5,5,10)-(15,5,10) = 0 (through it).
//   cylinder–prism: centre (20,5), r 3, z 0…5 to the square, z 8…20: √((10 − 3)² + (8 − 5)²) = √58 = 7.6158.
// Lift (fake crane, boom 60, pad 100, boom-foot pin 8 ft high / 2 ft ahead (file); pick (1,030, 2,000) R 30: chart angle 61° →
//   tip (1,030, 2,000, 160.4772); foot pin (1,002, 2,000, 108); load bottom 102 at the pick, travel 120, H 6):
//   115 kV line along x = 1,040 (D_min 15 ft), wire 50 ft above grade 100 = el. 150: the load line (x = 1,030, el. 108 … 160.48)
//     passes el. 150 at 10.00 ft → 10.00 < 15: red, the load line governs at the pick. The boom: the point (1,040, 150) to the boom
//     segment in its vertical plane: t = (38·28 + 42·52.4772) / (28² + 52.4772²) = 0.92372, closest (1,027.86, 156.47) → 13.76 ft.
//     Wire 200 ft above grade (el. 300): at the pick the tip is √(10² + 139.5228²) = 139.88 ft away; the minimum lies early in the swing
//     (the tip rises as the radius shrinks): checked against a brute-force search of the path (info, ≥ 15). Sway 3 ft: 7.00 ft. Height not
//     entered: a vertical plane → the load (radius √(40² + 4²)/2 = 20.10 ft) reaches it in plan: 0.
//   Obstruction 1,015…1,025 × 2,010…2,020 under the swing, grade 100, 10 ft high (top 110), a point load (no L, W): hoisting at the
//     pick it is 11.18 ft away in plan; the load at travel 120 passes 10.00 ft above it (OK ≥ 2 ft); 25 ft high (top 125 > 120):
//     contact, red. Governing there: the counterweight (tail 15 ft, el. 104 … 110) to the pier corner (1,015, 2,010): √325 − 15 = 3.03 ft.
//     With the 40 × 4 ft load (plan radius 20.10 ft > 11.18 ft) it is reached while hoisting: contact.
//   Wall 980…985 × 1,990…2,010 (15 ft west of the rotation centre = the tail radius 15): counterweight bottom 100 + 4 = 104; wall 3 ft
//     high (top 103): 1.00 ft < 2 ft → amber; 5 ft high: contact, red.
// Path models (pick R 30 east, set R 20 north, counter-clockwise 90°): uniform = 91 points (every degree); luff = 10 points of luff
//   (R 30 → 21 at the pick's azimuth) + 91 of swing at R 20; tL = 10 / (10 + 20 π / 2) = 0.241453.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps', 'crane-pick', 'engine');
const W = loadShared('steps.js', path.join(APP, 'geo.js'), path.join(APP, 'model.js'), path.join(APP, 'osha.js'), path.join(APP, 'cranes.js'), path.join(APP, 'lift.js'), path.join(APP, 'elev.js'), path.join(APP, 'clear3d.js'));
const K = W.CranePickCranes, LF = W.CranePickLift, EL = W.CranePickElev, C3 = W.CranePickClear, M = W.CranePickModel;
const WH = K.parse(JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'smoke', 'crane-fake-wheeled.json'), 'utf8'))).crane;
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const grp = (c, id) => K.groups(c).find(g => Object.values(g.configs).some(x => x.id === id)).key;
const S0 = Object.assign({}, LF.DEF);
const U = o => Object.assign({ x: 1000, y: 2000, heading: 0, group: grp(WH, 'or-full-360'), boom: 60, mode: null, pad: 100 }, o);
const PK = o => Object.assign({ pick: { x: 1030, y: 2000 }, set: { x: 1000, y: 2020 }, load: 20000, rigging: 1000, hook: 1000, ded: 0, swing: 'short',
  elev: { pg: 98, ph: 4, sg: null, sh: 20, rig: 12, blk: 5, trav: null, L: 40, W: 4, H: 6 } }, o);
const P3 = (x, y, z) => ({ x, y, z });
const SQ = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
function lift(items, s, k, c) { s = Object.assign({}, S0, s || {}); k = k || PK(); c = c || WH; const u = U(), ev = LF.evaluate(c, u, k, s, 'k'); ev.elev = EL.evaluate(c, u, k, ev, 'k.el'); return C3.check(c, u, k, ev, items.map(M.normItem), s, 'k.c3'); }
const line = o => Object.assign({ type: 'power', name: 'OH 115 kV', kv: 115, pts: [{ x: 1040, y: 1900 }, { x: 1040, y: 2100 }] }, o);

test('segment–segment distances (hand cases)', () => {
  const a = P3(0, 0, 0), b = P3(10, 0, 0);
  let r = C3.segSeg3(a, b, P3(5, 5, -5), P3(5, 5, 5)); near(r.d, 5, 1e-12); near(r.p.x, 5, 1e-12); near(r.q.y, 5, 1e-12); near(r.q.z, 0, 1e-12);
  near(C3.segSeg3(a, b, P3(0, 3, 4), P3(0, 13, 4)).d, 5, 1e-12);
  near(C3.segSeg3(a, b, P3(2, 3, 4), P3(8, 3, 4)).d, 5, 1e-12, 'parallel');
  near(C3.segSeg3(a, b, P3(5, -5, 0), P3(5, 5, 0)).d, 0, 1e-12, 'crossing');
  near(C3.segSeg3(a, a, P3(3, 4, 0), P3(3, 4, 0)).d, 5, 1e-12, 'two points');
});

test('segment–prism and cylinder–prism distances (hand cases)', () => {
  const Q = { F: SQ, z0: 0, z1: 20 };
  near(C3.segPrism(P3(15, 5, 10), P3(25, 5, 10), Q).d, 5, 1e-12, 'side face');
  near(C3.segPrism(P3(-5, 5, 25), P3(15, 5, 25), Q).d, 5, 1e-12, 'above the top');
  near(C3.segPrism(P3(13, 14, 10), P3(14, 13, 10), Q).d, 7 / Math.SQRT2, 1e-12, 'vertical edge');
  assert.equal(C3.segPrism(P3(-5, 5, 10), P3(15, 5, 10), Q).d, 0, 'through the prism');
  assert.equal(C3.segPrism(P3(5, 5, -10), P3(5, 5, 30), Q).d, 0, 'vertical through it');
  near(C3.segPrism(P3(5, 5, 25), P3(5, 5, 40), Q).d, 5, 1e-12, 'vertical above it');
  near(C3.segPrism(P3(20, 20, 30), P3(30, 30, 40), Q).d, Math.hypot(10, 10, 10), 1e-12, 'corner');
  near(C3.discPrism({ x: 20, y: 5 }, 3, 0, 5, { F: SQ, z0: 8, z1: 20 }).d, Math.sqrt(58), 1e-12);
  assert.equal(C3.discPrism({ x: 12, y: 5 }, 3, 0, 5, { F: SQ, z0: 0, z1: 20 }).d, 0, 'overlap');
  near(C3.ptPrism(P3(5, 5, 30), Q).d, 10, 1e-12);
  // a span with a sway allowance: a rectangle ± s_h; without: the line itself
  near(C3.segPrism(P3(0, 0, 5), P3(0, 10, 5), { F: C3.spanRect({ x: 10, y: 0 }, { x: 10, y: 10 }, 3), z0: 0, z1: 10 }).d, 7, 1e-12);
  near(C3.segPrism(P3(0, 0, 5), P3(0, 10, 5), { F: [{ x: 10, y: 0 }, { x: 10, y: 10 }], z0: 0, z1: 10 }).d, 10, 1e-12);
  assert.equal(C3.segPrism(P3(0, 5, 5), P3(20, 5, 5), { F: [{ x: 10, y: 0 }, { x: 10, y: 10 }], z0: 0, z1: 10 }).d, 0, 'through a conductor plane');
});

test('OSHA D_min in 3D: true minimum distance and the governing component (hand check)', () => {
  let r = lift([line({ height: 50, gradeEl: 100 })]).results[0];
  assert.equal(r.D, 15); near(r.gov.d, 10, 1e-9); assert.equal(r.gov.comp, 'line'); assert.equal(r.where, 'at the pick (hoisting)'); assert.equal(r.level, 'stop');
  near(r.comps.find(x => x.comp === 'boom').d, 13.76, 0.01, 'boom');
  assert.match(r.text, /load line comes within 10\.0 ft of "OH 115 kV" in 3D \(at the pick \(hoisting\)\) < D_min = 15 ft/);
  assert.deepEqual(JSON.parse(JSON.stringify(r.steps.map(s => s.id.split('.').pop()))), ['D', 'zw', 'zl', 'd', 'chk']);
  // wire el. 300: the closest point is near the start of the swing, where the tip rises faster than it moves away: an independent brute
  // force over 20,000 path points (tip from engine/elev.js, the line x = 1,040 at el. 300) agrees with the refined search
  r = lift([line({ height: 200, gradeEl: 100 })]).results[0]; assert.equal(r.level, 'info');
  { const u = U(), ev = LF.evaluate(WH, u, PK(), S0, 'k'), g = EL.geomOf(WH); let m = Infinity;
    for (let i = 0; i <= 20000; i++) { const q = ev.path.at(i / 20000), R = Math.hypot(q.x - 1000, q.y - 2000), zt = EL.tipAt(WH, u, LF.cfgAt(WH, u, q, ev.chs), R, g); m = Math.min(m, Math.hypot(1040 - q.x, 300 - zt)); }
    near(r.gov.d, m, 1e-3, 'refined = brute force'); assert.ok(r.gov.d < Math.hypot(10, 300 - (108 + 60 * Math.sin(61 * Math.PI / 180))), 'below the value at the pick (139.88)'); }
  assert.match(r.text, /in 3D \((boom|load line), on the swing/);
  r = lift([line({ height: 50, gradeEl: 100, sway: 3, sag: 5 })]).results[0]; near(r.gov.d, 7, 1e-9);
  r = lift([line({ height: null })]).results[0]; assert.equal(r.gov.d, 0); assert.equal(r.gov.comp, 'load'); assert.match(r.text, /Wire height not entered: checked in plan/);
  // a boom section width counts against the boom
  const c = JSON.parse(JSON.stringify(WH)); c.app_inputs = { geom: { boomW: 4 } };
  r = lift([line({ height: 50, gradeEl: 100 })], null, null, c).results[0]; near(r.comps.find(x => x.comp === 'boom').d, 11.76, 0.01);
  // voltage over 1,000 kV without the set distance
  r = lift([line({ kv: 1100, height: 50 })]).results[0]; assert.equal(r.level, 'stop'); assert.match(r.text, /clearance not set/);
});

test('obstructions and the counterweight in 3D; exclusion zones; flags', () => {
  const sq = (x0, x1, y0, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  const kp = PK({ elev: { pg: 98, ph: 4, sh: 20, rig: 12, blk: 5, H: 6 } });   // a point load in plan (no L, W): the 40 × 4 ft load would reach the pier while hoisting
  let o = lift([{ type: 'obst', name: 'Pier', height: 10, gradeEl: 100, pts: sq(1015, 1025, 2010, 2020) }], null, kp);
  let r = o.results[0]; near(r.comps.find(x => x.comp === 'load').d, 10, 1e-6, 'the load at travel 120 over the top at 110');
  assert.equal(r.gov.comp, 'cw'); near(r.gov.d, Math.sqrt(325) - 15, 1e-9, 'the tail-swing cylinder (15 ft, el. 104 … 110) to the corner (1,015, 2,010)'); assert.equal(r.level, 'ok'); assert.equal(o.flags.length, 0);
  r = lift([{ type: 'obst', name: 'Pier', height: 25, gradeEl: 100, pts: sq(1015, 1025, 2010, 2020) }], null, kp).results[0]; assert.equal(r.level, 'stop'); assert.equal(r.gov.d, 0);
  r = lift([{ type: 'obst', name: 'Pier', height: 10, gradeEl: 100, pts: sq(1015, 1025, 2010, 2020) }]).results[0]; assert.equal(r.gov.d, 0, 'the 40 × 4 ft load (radius 20.10 ft) reaches it while hoisting at the pick'); assert.equal(r.where, 'at the pick (hoisting)');
  r = lift([{ type: 'obst', name: 'Wall', height: 3, pts: sq(980, 985, 1990, 2010) }]).results[0];
  assert.equal(r.gov.comp, 'cw'); near(r.gov.d, 1, 1e-9); assert.equal(r.level, 'warn'); assert.match(r.text, /counterweight \(tail swing\) comes within 1\.00 ft/);
  r = lift([{ type: 'obst', name: 'Wall', height: 5, pts: sq(980, 985, 1990, 2010) }]).results[0]; assert.equal(r.level, 'stop');
  r = lift([{ type: 'obst', name: 'Wall', height: 3, pts: sq(980, 985, 1990, 2010) }], { obstClr: 0.5 }).results[0]; assert.equal(r.level, 'ok', 'the clearance is a project setting');
  r = lift([{ type: 'obst', name: 'Shed', pts: sq(1015, 1025, 2010, 2020) }]).results[0]; assert.equal(r.level, 'warn'); assert.match(r.text, /height not entered/);
  o = lift([{ type: 'excl', name: 'Lane', pts: sq(1016, 1019, 2016, 2019) }]); r = o.results[0];
  assert.equal(r.level, 'warn'); assert.match(r.text, /Over the exclusion zone "Lane": boom, load line, load/); assert.equal(o.flags[0].kind, 'c3-excl');
});

test('path models: uniform (C2) and luff then swing; the luff path avoids what the uniform path crosses', () => {
  const u = U(), k = PK(), g = w => LF.pathPoints(u, k.pick, k.set, 'short', w);
  const a = g('uniform'), b = g('luff');
  assert.equal(a.pts.length, 91); assert.equal(a.tL, 0); near(a.pts[45].r, 25, 1e-9);
  assert.equal(b.pts.length, 101); near(b.tL, 10 / (10 + 20 * Math.PI / 2), 1e-12); near(b.pts[5].r, 25, 1e-9); near(b.pts[5].az, 90, 1e-12); assert.equal(b.pts[5].seg, 'luff');
  near(b.pts[55].r, 20, 1e-9); near(b.at(1).x, 1000, 1e-9); near(b.at(1).y, 2020, 1e-9);
  // C2 values unchanged by the uniform default
  const ev = LF.evaluate(WH, u, k, S0, 'k'); near(ev.gov.pct, 56.41025641, 1e-6); assert.equal(ev.path.pts.length, 91);
  const el = LF.evaluate(WH, u, k, Object.assign({}, S0, { path: 'luff' }), 'k'); assert.equal(el.path.model, 'luff'); assert.equal(el.govWhere, 'at the pick'); assert.ok(el.path.steps.some(s => /\.luff$/.test(s.id)));
  const ex = [{ type: 'excl', name: 'Lane', pts: [{ x: 1016, y: 2016 }, { x: 1019, y: 2016 }, { x: 1019, y: 2019 }, { x: 1016, y: 2019 }] }];
  const k0 = PK({ elev: { pg: 98, ph: 4, sh: 20, rig: 12, blk: 5, H: 6 } });   // a point load (no L, W)
  assert.equal(lift(ex, { path: 'uniform' }, k0).results[0].comps.find(x => x.comp === 'load').d, 0);
  near(lift(ex, { path: 'luff' }, k0).results[0].comps.find(x => x.comp === 'load').d, Math.hypot(16, 16) - 20, 1e-6, 'the refined minimum on the arc R 20');
  // the governing point on the luff: pick R 20, set R 30 → over the chart's larger radius first on the luff
  const k2 = PK({ pick: { x: 1020, y: 2000 }, set: { x: 1000, y: 2030 } }); const e2 = LF.evaluate(WH, u, k2, Object.assign({}, S0, { path: 'luff' }), 'k'); near(e2.path.Rmax, 30, 1e-9); near(e2.gov.R, 30, 1e-9);
});

test('steps: KaTeX (strict) for every sym / eq / sub / unit of the 3D checks; no NaN / undefined', async () => {
  const { createRequire } = await import('node:module');
  const katex = createRequire(import.meta.url)(path.join(ROOT, 'tests/libs/katex@0.16.9/dist/katex.min.js'));
  const parse = t => katex.renderToString(t, { ...W.SharedSteps.katexOpt, throwOnError: true, strict: 'error' });
  const sq = [{ x: 1015, y: 2010 }, { x: 1025, y: 2010 }, { x: 1025, y: 2020 }, { x: 1015, y: 2020 }];
  const c = JSON.parse(JSON.stringify(WH)); c.app_inputs = { geom: { boomW: 4 } };
  const rs = [].concat(lift([line({ height: 50, gradeEl: 100 }), line({ height: null }), { type: 'obst', height: 10, pts: sq }, { type: 'obst', topEl: 130, pts: sq }, { type: 'excl', pts: sq }]).results,
    lift([line({ height: 80 })], { path: 'luff' }, null, c).results, lift([line({ kv: 1100 })]).results);
  let n = 0;
  for (const r of rs) for (const s of r.steps) { for (const f of ['sym', 'eq', 'sub']) if (s[f]) { parse(s[f]); n++; } if (s.unit) { parse(W.SharedSteps.unitTeX(s.unit)); n++; } assert.ok(!/NaN|undefined/.test(W.SharedSteps.toText([s])), s.id); }
  assert.ok(n > 40, String(n));
});
