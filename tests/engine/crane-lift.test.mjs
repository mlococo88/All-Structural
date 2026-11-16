// Crane Pick Analyzer (apps/crane-pick), C2-2: setups, picks, capacity at the hook, swing path, zones, thresholds, plan footprint and
// clearances (engine/lift.js). Node only, with the SYNTHETIC cranes of tests/smoke/crane-fake-*.json (made-up values).
//   node tests/engine/run.mjs crane
//
// Hand check (fake crane, outriggers full 360°, boom 60 ft; rotation at E 1,000, N 2,000, heading 0 = grid north):
//   pick (1,030, 2,000): R = √(30² + 0²) = 30.00 ft → L_tab 60, R_tab 30 → C = 39,000 lb; W = 20,000 + 1,000 + 1,000 + 0 = 22,000 lb;
//     %chart = 22,000 / 39,000 × 100 = 56.41 % (within the chart, caution ≥ 75 %);
//   set (1,000, 2,020): R = 20.00 ft → C = 58,000 lb → 37.93 %; swing shortest = −90° (counter-clockwise), R_max = 30 ft; governing at
//     the pick (56.41 %).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps', 'crane-pick', 'engine');
const W = loadShared('steps.js', path.join(APP, 'geo.js'), path.join(APP, 'osha.js'), path.join(APP, 'cranes.js'), path.join(APP, 'lift.js'));
const K = W.CranePickCranes, LF = W.CranePickLift;
const fake = n => K.parse(JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'smoke', `crane-fake-${n}.json`), 'utf8'))).crane;
const WH = fake('wheeled'), CR = fake('crawler');
const plain = o => JSON.parse(JSON.stringify(o));
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const grp = (c, id) => K.groups(c).find(g => Object.values(g.configs).some(x => x.id === id)).key;
const S0 = { caution: 75, critical: 75, limit: 100, interp: false };
const U = (o) => Object.assign({ x: 1000, y: 2000, heading: 0, group: grp(WH, 'or-full-360'), boom: 60, mode: null }, o);
const PK = (o) => Object.assign({ pick: { x: 1030, y: 2000 }, set: { x: 1000, y: 2020 }, load: 20000, rigging: 1000, hook: 1000, ded: 0, swing: 'short' }, o);

test('hand check: radius, chart capacity, total load, % of chart, swing, R_max, governing point', () => {
  const ev = LF.evaluate(WH, U(), PK(), S0, 'k');
  assert.equal(ev.W, 22000);
  near(ev.pick.R, 30, 1e-9); assert.equal(ev.pick.C, 39000); near(ev.pick.pct, 22000 / 39000 * 100, 1e-9); assert.equal(ev.pick.cls, 'ok');
  near(ev.set.R, 20, 1e-9); assert.equal(ev.set.C, 58000); near(ev.set.pct, 22000 / 58000 * 100, 1e-9);
  near(ev.path.d, -90, 1e-9); near(ev.path.Rmax, 30, 1e-9); assert.equal(ev.path.pts.length, 91);
  assert.equal(ev.gov, ev.gov); near(ev.gov.pct, 56.41025641, 1e-6); assert.equal(ev.govWhere, 'at the pick'); assert.equal(ev.cls, 'ok');
  // the worked steps of the pick point: R, L_tab, R_tab, C, %
  assert.deepEqual(plain(ev.pick.steps.map(s => s.id)), ['k.pick.R', 'k.pick.Lt', 'k.pick.Rt', 'k.pick.C', 'k.pick.pct']);
  assert.equal(ev.Wsteps[0].sub, '20{,}000 + 1{,}000 + 1{,}000 + 0');
  assert.match(ev.pick.steps[3].ref, /FAKECO TEST-AT 100 \(FAKE TEST DATA\), chart "Main boom, outriggers full/);
});

test('thresholds: caution / critical lift / over the chart are project inputs', () => {
  const at = (load, s) => LF.evaluate(WH, U(), PK({ load, rigging: 0, hook: 0 }), s || S0).gov;
  assert.equal(at(39000 * 0.7499).cls, 'ok'); assert.equal(at(39000 * 0.75).cls, 'critical', '≥ 75 %: caution and critical at the same default');
  assert.equal(at(39000).cls, 'over'); assert.equal(at(39000 * 0.999).cls, 'critical');
  const s = { caution: 60, critical: 90, limit: 100 };
  assert.equal(at(39000 * 0.8, s).cls, 'caution'); assert.equal(at(39000 * 0.95, s).cls, 'critical'); assert.equal(at(39000 * 0.5, s).cls, 'ok');
  assert.deepEqual(JSON.parse(JSON.stringify(LF.settingsOf({ lift: { caution: -1, critical: 80 } }))), { caution: 75, critical: 80, limit: 100, interp: false });
});

test('swing direction and the path: sweep, R_max = larger end radius, governing point at the larger radius', () => {
  assert.equal(LF.sweep(350, 10, 'short'), 20); assert.equal(LF.sweep(10, 350, 'short'), -20); assert.equal(LF.sweep(10, 350, 'cw'), 340); assert.equal(LF.sweep(350, 10, 'ccw'), -340);
  assert.equal(LF.sweep(90, 270, 'short'), 180, 'a half turn: clockwise'); assert.equal(LF.sweep(45, 45, 'cw'), 0);
  let ev = LF.evaluate(WH, U(), PK({ swing: 'cw' }), S0); near(ev.path.d, 270, 1e-9); near(ev.path.Rmax, 30, 1e-9);
  // the path radius changes uniformly with the angle: the midpoint of the swing
  const mid = ev.path.pts[135]; near(Math.hypot(mid.x - 1000, mid.y - 2000), 25, 1e-9, 'r at half the swing');
  ev = LF.evaluate(WH, U(), PK({ pick: { x: 1020, y: 2000 }, set: { x: 955, y: 2000 } }), S0);   // R 20 east -> R 45 west
  near(ev.path.Rmax, 45, 1e-9); assert.equal(ev.set.C, 20000); near(ev.set.pct, 110, 1e-9); assert.equal(ev.cls, 'over'); assert.equal(ev.govWhere, 'at the set');
  ev = LF.evaluate(WH, U(), PK({ set: { x: 1000, y: 2075 } }), S0); assert.equal(ev.set.cls, 'np'); assert.equal(ev.cls, 'np'); assert.match(ev.set.look.why, /beyond the largest tabulated radius/);
  // a point on the swing can govern: pick R 30, set R 30, but the chart is a different zone between them (below)
});

test('zones: the slew angle from the carrier front picks the zone chart inside its sector only', () => {
  const rub = grp(WH, 'rubber-360'), u = U({ group: rub, boom: 40 });
  const c = JSON.parse(JSON.stringify(WH));
  // sectors not set: the 360 chart everywhere (conservative)
  let ev = LF.evaluate(c, u, PK({ pick: { x: 1000, y: 2015 }, set: { x: 1015, y: 2000 }, load: 10000, rigging: 0, hook: 0 }), S0);
  assert.equal(ev.pick.zone, 'over-side'); assert.equal(ev.pick.cfg.id, 'rubber-360'); assert.equal(ev.pick.C, 20000);
  c.app_inputs = { sectors: { front: 10 } };
  ev = LF.evaluate(c, u, PK({ pick: { x: 1000, y: 2015 }, set: { x: 1015, y: 2000 }, load: 10000, rigging: 0, hook: 0 }), S0, 'z');
  assert.equal(ev.pick.zone, 'over-front'); assert.equal(ev.pick.cfg.id, 'rubber-front'); assert.equal(ev.pick.C, 30000); near(ev.pick.pct, 33.333333, 1e-5);
  assert.equal(ev.set.zone, 'over-side'); assert.equal(ev.set.C, 20000);
  assert.equal(ev.gov.C, 20000); near(ev.gov.pct, 50, 1e-9); assert.notEqual(ev.govWhere, 'at the pick');
  assert.ok(ev.pick.steps.some(s => s.id === 'z.pick.th' && Math.abs(s.value) < 1e-9));
  // a heading turns the zones with the carrier: heading 90 (east) puts the set (east) over the front
  ev = LF.evaluate(c, U({ group: rub, boom: 40, heading: 90 }), PK({ pick: { x: 1000, y: 2015 }, set: { x: 1015, y: 2000 }, load: 10000, rigging: 0, hook: 0 }), S0);
  assert.equal(ev.set.zone, 'over-front'); near(ev.pick.theta, -90, 1e-9); assert.equal(ev.pick.zone, 'over-side');
  // the crawler: over rear inside its sector, over side elsewhere; no front / 360 chart -> the side chart (over-side = outside the sectors)
  const cr = JSON.parse(JSON.stringify(CR)); const uc = { x: 0, y: 0, heading: 0, group: K.groups(cr)[0].key, boom: 100 };
  const P2 = PK({ pick: { x: 0, y: -40 }, set: { x: 40, y: 0 }, load: 50000, rigging: 0, hook: 0 });
  ev = LF.evaluate(cr, uc, P2, S0); assert.equal(ev.pick.zone, 'over-side'); assert.equal(ev.pick.C, 80000, 'rear sector not set: the side chart');
  cr.app_inputs = { sectors: { rear: 30 } }; ev = LF.evaluate(cr, uc, P2, S0);
  assert.equal(ev.pick.zone, 'over-rear'); assert.equal(ev.pick.C, 100000); assert.equal(ev.set.C, 80000); near(ev.gov.pct, 62.5, 1e-9);
});

test('footprint: carrier, outrigger floats at the chart spread, crawler tracks, heading', () => {
  let fp = LF.footprint(WH, U({ x: 0, y: 0 }));
  assert.equal(fp.spread, 'full'); assert.equal(fp.tail, 15); assert.equal(fp.floatC.length, 4);
  const fc = fp.floatC.map(f => [Math.round(f.x * 1e6) / 1e6, Math.round(f.y * 1e6) / 1e6]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  assert.deepEqual(plain(fc), [[-12, -12], [-12, 12], [12, -12], [12, 12]], 'beams 12 ft ahead / behind, spread 24 ft');
  const by = fp.body.map(p => p.y), bx = fp.body.map(p => p.x); near(Math.max(...by), 26, 1e-9); near(Math.min(...by), -14, 1e-9); near(Math.max(...bx), 5, 1e-9);
  fp = LF.footprint(WH, U({ x: 0, y: 0, heading: 90 })); near(Math.max(...fp.body.map(p => p.x)), 26, 1e-9, 'heading east: the front is east');
  near(LF.toGrid({ x: 0, y: 0, heading: 0 }, 0, 5).x, -5, 1e-12, 'left of a north-facing carrier is west');
  fp = LF.footprint(WH, U({ x: 0, y: 0, group: grp(WH, 'or-mid-360') })); assert.equal(fp.spread, 'mid'); near(Math.max(...fp.floatC.map(f => f.x)), 8, 1e-9);
  fp = LF.footprint(WH, U({ x: 0, y: 0, group: grp(WH, 'rubber-360') })); assert.equal(fp.floatC.length, 0, 'on rubber: no outriggers drawn');
  fp = LF.footprint(CR, { x: 0, y: 0, heading: 0, group: K.groups(CR)[0].key }); assert.equal(fp.tracks.length, 2);
  near(Math.max(...fp.tracks[0].map(p => p.y)), 13, 1e-9); near(Math.max(...fp.tracks.flat().map(p => Math.abs(p.x))), 10.5, 1e-9, 'gauge 18 / 2 + shoe 3 / 2');
});

test('plan clearances: power-line D_min to the swing, exclusion zones, obstructions, tail swing', () => {
  const u = U(), k = PK(), ev = LF.evaluate(WH, u, k, S0);
  const line = kv => ({ id: 'pl', type: 'power', name: 'OH line', kv, pts: [{ x: 1040, y: 1900 }, { x: 1040, y: 2100 }] });   // 10 ft east of the pick point
  assert.deepEqual(plain(LF.clearances(WH, u, ev, [line(13.8)]).filter(f => f.kind === 'power')), [], 'D_min 10 ft = the closest distance: not inside');
  const f = LF.clearances(WH, u, ev, [line(115)]); assert.equal(f[0].level, 'stop'); near(f[0].d, 10, 1e-9); assert.equal(f[0].D, 15); assert.match(f[0].text, /within D_min = 15 ft of "OH line" in plan \(closest 10\.0 ft\)/);
  assert.equal(LF.minDist([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], true, [{ x: 5, y: -5 }, { x: 5, y: 20 }], false), 0, 'a line across a polygon');
  near(LF.minDist([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], true, [{ x: 20, y: -5 }, { x: 20, y: 20 }], false), 10, 1e-9);
  const ex = { id: 'ex', type: 'excl', name: 'Lane', pts: [{ x: 990, y: 2015 }, { x: 1010, y: 2015 }, { x: 1010, y: 2025 }, { x: 990, y: 2025 }] };
  assert.match(LF.clearances(WH, u, ev, [ex]).map(x => x.text).join(), /load path crosses the exclusion zone "Lane"/);
  const ob = { id: 'ob', type: 'obst', name: 'Pier', height: 30, pts: [{ x: 1003, y: 2003 }, { x: 1008, y: 2003 }, { x: 1008, y: 2008 }, { x: 1003, y: 2008 }] };
  const fo = LF.clearances(WH, u, ev, [ob]); assert.equal(fo[0].level, 'stop'); assert.match(fo[0].text, /footprint overlaps the obstruction "Pier"/);
  const ob2 = { id: 'ob2', type: 'obst', name: 'Wall', pts: [{ x: 1006, y: 1993 }, { x: 1008, y: 1993 }, { x: 1008, y: 1995 }, { x: 1006, y: 1995 }] };   // inside the 15 ft tail circle, off the carrier
  assert.match(LF.clearances(WH, u, ev, [ob2]).map(x => x.text).join(), /tail-swing circle \(15\.0 ft\) reaches the obstruction "Wall"/);
  const ob3 = { id: 'ob3', type: 'obst', name: 'Tree', height: 40, pts: [{ x: 1020, y: 2005 }, { x: 1024, y: 2005 }, { x: 1024, y: 2009 }, { x: 1020, y: 2009 }] };   // under the swing
  const f3 = LF.clearances(WH, u, ev, [ob3]); assert.equal(f3[0].level, 'info'); assert.match(f3[0].text, /passes over the obstruction "Tree" \(40\.0 ft high\) in plan/);
  assert.deepEqual(plain(LF.clearances(WH, u, ev, [{ id: 'far', type: 'power', kv: 13.8, pts: [{ x: 1500, y: 0 }, { x: 1500, y: 4000 }] }])), []);
});

test('steps: KaTeX (strict) for every sym / eq / sub / unit; no NaN / undefined in the text', async () => {
  const { createRequire } = await import('node:module');
  const katex = createRequire(import.meta.url)(path.join(ROOT, 'tests/libs/katex@0.16.9/dist/katex.min.js'));
  const parse = t => katex.renderToString(t, { ...W.SharedSteps.katexOpt, throwOnError: true, strict: 'error' });
  const c = JSON.parse(JSON.stringify(WH)); c.app_inputs = { sectors: { front: 10, rear: 20 } };
  const evs = [LF.evaluate(WH, U(), PK(), S0), LF.evaluate(c, U({ group: grp(WH, 'rubber-360'), boom: 40 }), PK({ pick: { x: 1000, y: 2015 }, set: { x: 1015, y: 2000 } }), S0), LF.evaluate(WH, U(), PK({ set: { x: 1000, y: 2075 } }), S0)];
  let k = 0;
  for (const ev of evs) for (const s of [].concat(ev.Wsteps, ev.pick.steps, ev.set.steps, ev.path.steps, ev.gov.steps)) {
    for (const f of ['sym', 'eq', 'sub']) if (s[f]) { parse(s[f]); k++; } if (s.unit) { parse(W.SharedSteps.unitTeX(s.unit)); k++; }
    assert.ok(!/NaN|undefined/.test(W.SharedSteps.toText([s])), s.id);
  }
  assert.ok(k > 60, String(k));
});

test('a zone change keeps each setup (position and heading) and the pick / set points on the ground', () => {
  const V = loadShared(path.join(ROOT, 'tests', 'libs', 'proj4@2.11.0', 'dist', 'proj4.js'), path.join(APP, 'geo.js'));
  const G = V.CranePickGeo, proj4 = V.proj4;
  const P = { site: { zone: 'EPSG:2249' }, items: [], sheets: [], setups: [{ id: 'u', x: 775400, y: 2956500, heading: 30 }], picks: [{ id: 'k', pick: { x: 775450, y: 2956520 }, set: { x: 775380, y: 2956560 } }] };
  const Q = G.reproject(proj4, P, 'EPSG:2234'), B = G.reproject(proj4, Q, 'EPSG:2249');
  const ll = (z, p) => G.ftToLl(proj4, z, p.x, p.y);
  const a = ll('EPSG:2249', P.setups[0]), q = ll('EPSG:2234', Q.setups[0]);
  near(a.lat, q.lat, 1e-9); near(a.lng, q.lng, 1e-9);
  assert.ok(Math.abs(Q.setups[0].heading - 30) > 0.01, 'the grid convergence of another zone turns the grid heading');
  near(B.setups[0].heading, 30, 1e-6, 'back: the same heading'); near(B.setups[0].x, 775400, 1e-4); near(B.picks[0].set.y, 2956560, 1e-4);
  near(G.dist(Q.setups[0], Q.picks[0].pick), G.dist(P.setups[0], P.picks[0].pick), 0.01, 'radius kept within the scale-factor difference');
});
