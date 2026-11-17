// Crane Pick Analyzer (apps/crane-pick): the crane's plan symbol (engine/cranegfx.js, 2026-11-17) and the aerial plan's tile and
// world-file arithmetic (ui/aerial.js, its no-DOM part). Node only, SYNTHETIC fake cranes (tests/smoke/crane-fake-*.json).
//   node tests/engine/run.mjs crane
// The symbol calculates nothing the checks use: these tests hold it to the engine values it draws.
//   Wheeled (fake AT, outriggers full 24 ft, beams 12 ft ahead / 12 ft behind, float 2 ft): rotation centre (500, 2,000), heading 30°.
//     Float centres = engine footprint floatC: carrier frame (±12, ±12) -> grid x = 500 + lx sin 30° − ly cos 30°, y = 2,000 + lx cos 30°
//     + ly sin 30°; e.g. front left (12, 12): x = 500 + 6 − 10.392 = 495.608, y = 2,000 + 10.392 + 6 = 2,016.392; r = 1 ft.
//     Tail-swing radius 15 ft: the counterweight's rear corners lie on it (|corner − centre| = 15.000), no part of it outside.
//     Hook at (500 + 30 sin 75°, 2,000 + 30 cos 75°) = (528.978, 2,007.765): R = 30.000, slew azimuth 75°, 45° right of the carrier front
//     (slewRel +45); boom foot 2 ft ahead (file): foot = centre + 2 (sin 75°, cos 75°) = (501.932, 2,000.518); tip over the hook.
//   Crawler (fake CR, track 26 ft, gauge 18 ft, shoe 3 ft, tail 18 ft): track outlines = engine footprint tracks; CW corners on 18 ft.
//   World file (hand case): window E 1,000 … 1,300, N 2,000 … 2,200 ft, 600 × 400 px -> s = 0.5 ft / px.
//     Grid (US ft): A = 0.5, D = 0, B = 0, E = −0.5, C = 1,000 + 0.25 = 1,000.25, F = 2,200 − 0.25 = 2,199.75.
//     DXF (the sheet places the window's lower-left corner at (X0, Y0) = (40, 30) in, 12 units per ft): A = 6, E = −6, C = 43, F = 2,427.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps', 'crane-pick');
const W = loadShared('steps.js', 'dxf.js', ...['geo', 'model', 'osha', 'cranes', 'lift', 'elev', 'cranegfx'].map(f => path.join(APP, 'engine', f + '.js')), path.join(APP, 'ui', 'aerial.js'));
const K = W.CranePickCranes, LF = W.CranePickLift, CG = W.CranePickCraneGfx, AE = W.CranePickAerial;
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const load = f => K.parse(JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'smoke', f), 'utf8'))).crane;
const WH = load('crane-fake-wheeled.json'), CR = load('crane-fake-crawler.json');
const grpOf = (c, id) => K.groups(c).find(g => Object.values(g.configs).some(x => x.id === id)).key;
const rad = d => d * Math.PI / 180;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('crane symbol, wheeled: floats = engine footprint, CW corners on the tail radius, boom tip at the hook, turns with the slew', () => {
  const u = { x: 500, y: 2000, heading: 30, group: grpOf(WH, 'or-full-360'), boom: 60 };
  const hook = { x: 500 + 30 * Math.sin(rad(75)), y: 2000 + 30 * Math.cos(rad(75)) };
  const s = CG.symbol(WH, u, { hook, load: { L: 10, W: 4 } }), fp = LF.footprint(WH, u);
  const fl = s.circles.filter(c => c.g === 'float');
  assert.equal(fl.length, 4); fl.forEach((c, i) => { near(c.c.x, fp.floatC[i].x, 1e-9); near(c.c.y, fp.floatC[i].y, 1e-9); near(c.r, 1, 1e-12, 'float r = 2 ft / 2'); });
  near(fl[0].c.x, 495.608, 1e-3, 'front-left float x (hand)'); near(fl[0].c.y, 2016.392, 1e-3, 'front-left float y (hand)');
  near(s.key.R, 30, 1e-9); near(s.key.slewAz, 75, 1e-9); near(s.key.slewRel, 45, 1e-9);
  near(s.key.tip.x, hook.x, 1e-9, 'tip over the hook'); near(s.key.tip.y, hook.y, 1e-9);
  near(s.key.foot.x, 501.932, 1e-3, 'boom foot 2 ft ahead'); near(s.key.foot.y, 2000.518, 1e-3);
  const cwd = s.key.cwPts.map(p => dist(p, u)); near(Math.max(...cwd), 15, 1e-9, 'CW rear corners on the tail-swing circle');
  assert.equal(cwd.filter(d => Math.abs(d - 15) < 1e-9).length, 2, 'two rear corners on R_t');
  // every upperworks / counterweight point within the tail radius behind the rotation centre
  s.parts.filter(q => q.g === 'cwt').forEach(q => q.pts.forEach(p => assert.ok(dist(p, u) <= 15 + 1e-9)));
  // the carrier outline = the engine footprint body (it does not turn with the slew)
  const body = s.parts.find(q => q.g === 'carrier' && q.closed); body.pts.forEach((p, i) => { near(p.x, fp.body[i].x, 1e-9); near(p.y, fp.body[i].y, 1e-9); });
  // the load L x W at the hook: L along the boom
  const ld = s.parts.find(q => q.g === 'load'); const c = { x: ld.pts.reduce((a, p) => a + p.x, 0) / 4, y: ld.pts.reduce((a, p) => a + p.y, 0) / 4 };
  near(c.x, hook.x, 1e-9); near(c.y, hook.y, 1e-9); near(dist(ld.pts[0], ld.pts[3]), 10, 1e-9, 'L along the boom'); near(dist(ld.pts[0], ld.pts[1]), 4, 1e-9);
  // slewing 90° more: the upper turns, the carrier and floats stay
  const h2 = { x: u.x + 30 * Math.sin(rad(165)), y: u.y + 30 * Math.cos(rad(165)) }, s2 = CG.symbol(WH, u, { hook: h2 });
  s2.circles.filter(q => q.g === 'float').forEach((q, i) => { near(q.c.x, fl[i].c.x, 1e-9); near(q.c.y, fl[i].c.y, 1e-9); });
  near(s2.key.slewRel, 135, 1e-9);
  const rot = (p, a) => ({ x: u.x + (p.x - u.x) * Math.cos(rad(-a)) - (p.y - u.y) * Math.sin(rad(-a)), y: u.y + (p.x - u.x) * Math.sin(rad(-a)) + (p.y - u.y) * Math.cos(rad(-a)) });
  s.key.cwPts.forEach((p, i) => { const q = rot(p, 90); near(s2.key.cwPts[i].x, q.x, 1e-9, 'CW turned 90° clockwise'); near(s2.key.cwPts[i].y, q.y, 1e-9); });
  // the assumptions are listed (the fake file has no axle, tyre, cab or boom-width data)
  assert.ok(s.assumed.some(t => /axles/.test(t)) && s.assumed.some(t => /telescopic base section 3 ft/.test(t)) && s.assumed.some(t => /operator cab/.test(t)));
  assert.equal(s.dims.boomType, 'telescopic'); assert.equal(s.dims.axles.length, 4, 'round(40 / 9) = 4 axles');
  // simple detail draws fewer parts (the map at a small zoom) with the same key geometry
  const s3 = CG.symbol(WH, u, { hook, detail: 'simple' }); assert.ok(s3.parts.length <= s.parts.length); near(s3.key.tip.x, s.key.tip.x, 1e-12);
});

test('crane symbol, crawler: tracks = engine footprint, tumblers, lattice chords, CW on the 18 ft tail radius', () => {
  const u = { x: 0, y: 0, heading: 0, group: grpOf(CR, 'rear-150k'), boom: 100 };
  const s = CG.symbol(CR, u, { hook: { x: 0, y: -40 } }), fp = LF.footprint(CR, u);
  assert.equal(fp.tracks.length, 2);
  fp.tracks.forEach(t => assert.ok(s.parts.some(q => q.g === 'carrier' && q.closed && q.pts.length === 4 && q.pts.every((p, i) => Math.abs(p.x - t[i].x) < 1e-9 && Math.abs(p.y - t[i].y) < 1e-9)), 'track outline from the engine'));
  // heading 0 (front north): the left track (ly = +9, shoe 3) spans grid x −10.5 … −7.5, y ±13
  const xs = fp.tracks[0].map(p => p.x), ys = fp.tracks[0].map(p => p.y); near(Math.max(...ys), 13, 1e-9); near(Math.min(...ys), -13, 1e-9); near(Math.max(...xs), -7.5, 1e-9); near(Math.min(...xs), -10.5, 1e-9);
  near(s.key.slewRel, 180, 1e-9, 'over the rear'); near(s.key.R, 40, 1e-9); near(s.key.tip.y, -40, 1e-9);
  near(Math.max(...s.key.cwPts.map(p => Math.hypot(p.x, p.y))), 18, 1e-9);
  assert.equal(s.dims.boomType, 'lattice'); assert.ok(s.dims.tumbler.xs.length === 2);
  assert.equal(s.circles.filter(c => c.g === 'float').length, 0, 'no floats on a crawler');
});

test('crane symbol: draw() walks every part; DXF with the CRANE-* layers is valid R12', () => {
  const X = W.SharedDxf, D = X.drawing({ prefix: 'C-' }); D.h = 1;
  const u = { x: 0, y: 0, heading: 0, group: grpOf(WH, 'or-full-360'), boom: 60 }, s = CG.symbol(WH, u, { hook: { x: 20, y: 20 }, load: { L: 8, W: 4 } });
  CG.draw(s, { poly: (g, pts, cl) => D.pline(D.layer(CG.GROUPS[g].layer, CG.GROUPS[g].aci), pts.map(p => [p.x * 12, p.y * 12]), cl),
    circle: (g, c, r) => D.circle(D.layer(CG.GROUPS[g].layer, CG.GROUPS[g].aci), c.x * 12, c.y * 12, r * 12), text: (g, p, t, rot) => D.text(D.layer(CG.GROUPS[g].layer, 7), p.x * 12, p.y * 12, 6, t, 0, rot) });
  const v = X.validate(D.toDXF({ ltscale: 1 })); assert.ok(v.ok, v.errors.join('; '));
  ['C-CRANE-CARRIER', 'C-CRANE-OUTRIGGER', 'C-CRANE-FLOAT', 'C-CRANE-UPPER', 'C-CRANE-CWT', 'C-CRANE-BOOM', 'C-CRANE-HOOK', 'C-CRANE-LOAD', 'C-CRANE'].forEach(l => assert.ok(v.layers.includes(l), 'layer ' + l));
  assert.ok(v.counts.POLYLINE > 20, 'polylines');
  const sv = CG.svg(s, p => p, p => -p, 1); assert.ok(/<path/.test(sv) && /SLEW \+45° FROM FRONT/.test(sv));
});

test('aerial: tile zoom and count, the grid -> tile pixel affine, the world file (hand case)', () => {
  // world file: window 1,000…1,300 x 2,000…2,200 ft, 600 x 400 px
  const wf = AE.worldFile({ x0: 1000, x1: 1300, y0: 2000, y1: 2200 }, 600, 400);
  assert.deepEqual(Array.from(wf.grid, v => +v.toFixed(6) || 0), [0.5, 0, 0, -0.5, 1000.25, 2199.75]);
  const dx = AE.worldFile({ x0: 1000, x1: 1300, y0: 2000, y1: 2200 }, 600, 400, { X0: 40, Y0: 30, X1: 40 + 3600, Y1: 30 + 2400 });
  assert.deepEqual(Array.from(dx.dxf, v => +v.toFixed(6) || 0), [6, 0, 0, -6, 43, 2427]);
  assert.equal(AE.pgw(dx.dxf), '6.0000000000\n0.0000000000\n0.0000000000\n-6.0000000000\n43.0000000000\n2427.0000000000\n');
  // metre zone: grid values in the zone's native unit (1 ftUS = 1200/3937 m)
  const m = AE.worldFile({ x0: 0, x1: 3937, y0: 0, y1: 3937 }, 3937, 3937, null, v => v * 1200 / 3937); near(m.grid[0], 1200 / 3937, 1e-12); near(m.grid[4], 0.5 * 1200 / 3937, 1e-12);
  // Web Mercator: lat 0 lng 0 at zoom 0 is pixel (128, 128); ground resolution 156,543.03 cos(lat) / 2^z m per px
  const p = AE.merc(0, 0, 0); near(p.x, 128, 1e-9); near(p.y, 128, 1e-9);
  near(AE.res(42, 19), 156543.03392804097 * Math.cos(rad(42)) / 524288, 1e-12);
  // zoom: the finest z <= 19 whose resolution is at least as fine as the image's, then down until the tile count fits
  const z = AE.pickZoom(42, 0.5 * 0.3048006, 19); assert.equal(z, 19, 'needs z = ceil(log2(156,543 cos 42° / 0.152)) = 20: capped at 19');
  assert.equal(AE.pickZoom(42, 2 * 0.3048006, 19), 18, 'res(18) = 0.444 m <= 0.610 m < res(17) = 0.888 m');
  const tl = AE.tiles({ x: 1000.5, y: 2000.5 }, { x: 1600.2, y: 2400.9 }, 64); assert.deepEqual(Array.from([tl.x0, tl.x1, tl.y0, tl.y1, tl.n]), [3, 6, 7, 9, 12]);
  // affine through three points maps them exactly
  const T = AE.affine([[0, 0], [10, 0], [0, 5]], [[3, 4], [23, 4], [3, 14]]); const q = AE.apply(T, [10, 5]); near(q[0], 23, 1e-12); near(q[1], 14, 1e-12);
  const I = AE.invert(T), r = AE.apply(I, [23, 14]); near(r[0], 10, 1e-12); near(r[1], 5, 1e-12);
});
