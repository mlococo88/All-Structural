// Crane Pick Analyzer (apps/crane-pick), C1: coordinates, plane geometry, sheet calibration / georeference, OSHA Table A lookup,
// worked steps. Node only; proj4 2.11.0 from tests/libs (the version the page pins).
//   node tests/engine/run.mjs crane
//
// Control values (published):
//  - Snyder, J. P., "Map Projections — A Working Manual", USGS Professional Paper 1395 (1987):
//      Lambert conformal conic, ellipsoid, numerical example (p. 296): Clarke 1866, φ1 33°, φ2 45°, φ0 23°, λ0 96° W;
//        φ 35° N, λ 75° W -> x = 1,894,410.9 m, y = 1,564,649.5 m.
//      Transverse Mercator, ellipsoid, numerical example (p. 269): Clarke 1866, k0 0.9996, λ0 75° W, φ0 0;
//        φ 40°30′ N, λ 73°30′ W -> x = 127,106.5 m, y = 4,484,124.4 m.
//    These check proj4's lcc / tmerc code (the same code the zone definitions use).
//  - The zone definitions (EPSG / NGS SPCS83 parameters): each zone's grid origin (φ0, λ0) maps to its false easting / northing exactly
//    (EPSG:2249 656,166.667 ftUS / 2,460,625 ftUS; EPSG:26986 200,000 m / 750,000 m; EPSG:2234 1,000,000 ftUS / 500,000 ftUS;
//    EPSG:3438 328,083.333 ftUS / 0), and points away from the origin agree with Snyder's formulas (implemented below, independently of
//    proj4) with the zone parameters, to 1 mm.
import assert from 'node:assert/strict';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps', 'crane-pick', 'engine');
const W = loadShared(path.join(ROOT, 'tests', 'libs', 'proj4@2.11.0', 'dist', 'proj4.js'), 'steps.js',
  path.join(APP, 'geo.js'), path.join(APP, 'osha.js'), path.join(APP, 'worked.js'), path.join(APP, 'model.js'));
const proj4 = W.proj4, G = W.CranePickGeo, O = W.CranePickOSHA, WK = W.CranePickWorked, M = W.CranePickModel;
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const FT = 1200 / 3937;

// ---- independent formulas (Snyder 1987, ellipsoidal LCC eqs. 15-1, 15-7 to 15-10, 14-15; TM eqs. 8-9 to 8-13, 3-21) ----
const GRS80 = { a: 6378137, f: 1 / 298.257222101 };
const rad = d => d * Math.PI / 180;
function lccS(el, p1, p2, p0, l0, FE, FN, lat, lon) {
  const a = el.a, e2 = el.f * (2 - el.f), e = Math.sqrt(e2);
  const m = p => Math.cos(p) / Math.sqrt(1 - e2 * Math.sin(p) ** 2);
  const t = p => Math.tan(Math.PI / 4 - p / 2) / ((1 - e * Math.sin(p)) / (1 + e * Math.sin(p))) ** (e / 2);
  const [f1, f2, f0, ph, l] = [p1, p2, p0, lat, lon].map(rad);
  const n = (Math.log(m(f1)) - Math.log(m(f2))) / (Math.log(t(f1)) - Math.log(t(f2))), F = m(f1) / (n * t(f1) ** n);
  const r0 = a * F * t(f0) ** n, r = a * F * t(ph) ** n, th = n * (l - rad(l0));
  return { x: FE + r * Math.sin(th), y: FN + r0 - r * Math.cos(th) };
}
function tmS(el, p0, l0, k0, FE, FN, lat, lon) {
  const a = el.a, e2 = el.f * (2 - el.f), ep2 = e2 / (1 - e2), ph = rad(lat), l = rad(lon);
  const M = p => a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * p - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * p)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * p) - (35 * e2 ** 3 / 3072) * Math.sin(6 * p));
  const N = a / Math.sqrt(1 - e2 * Math.sin(ph) ** 2), T = Math.tan(ph) ** 2, C = ep2 * Math.cos(ph) ** 2, A = (l - rad(l0)) * Math.cos(ph);
  const x = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120);
  const y = k0 * (M(ph) - M(rad(p0)) + N * Math.tan(ph) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
  return { x: FE + x, y: FN + y };
}

test('proj4 reproduces Snyder (USGS PP 1395) LCC and TM ellipsoid examples', () => {
  const l = proj4('+proj=lcc +lat_1=33 +lat_2=45 +lat_0=23 +lon_0=-96 +x_0=0 +y_0=0 +ellps=clrk66 +units=m +no_defs').forward([-75, 35]);
  near(l[0], 1894410.9, 0.06, 'LCC x'); near(l[1], 1564649.5, 0.06, 'LCC y');
  const t = proj4('+proj=tmerc +lat_0=0 +lon_0=-75 +k=0.9996 +x_0=0 +y_0=0 +ellps=clrk66 +units=m +no_defs').forward([-73.5, 40.5]);
  near(t[0], 127106.5, 0.06, 'TM x'); near(t[1], 4484124.4, 0.06, 'TM y');
  // and the independent formulas used below reproduce them too
  const CL = { a: 6378206.4, f: 1 - Math.sqrt(1 - 0.00676866) };
  const ls = lccS(CL, 33, 45, 23, -96, 0, 0, 35, -75); near(ls.x, 1894410.9, 0.06); near(ls.y, 1564649.5, 0.06);
  const ts = tmS(CL, 0, -75, 0.9996, 0, 0, 40.5, -73.5); near(ts.x, 127106.5, 0.06); near(ts.y, 4484124.4, 0.06);
});

test('zone grid origins map to the EPSG false easting / northing', () => {
  const cases = [['EPSG:2249', 41, -71.5, 656166.667, 2460625, 0.001], ['EPSG:26986', 41, -71.5, 200000, 750000, 0.0005],
    ['EPSG:2234', 40.83333333333334, -72.75, 1000000, 500000, 0.001], ['EPSG:3438', 41.08333333333334, -71.5, 328083.333, 0, 0.001]];
  for (const [id, lat, lng, E, N, tol] of cases) { const r = G.llToNative(proj4, id, lat, lng); near(r.E, E, tol, id + ' E'); near(r.N, N, tol, id + ' N'); }
});

test('zone points agree with Snyder formulas (GRS80, zone parameters) to 1 mm; round trip; m and ftUS variants agree', () => {
  const pts = { 'EPSG:2249': [[42.3601, -71.0589], [42.6, -73.3], [41.5, -70.0]], 'EPSG:2234': [[41.7658, -72.6734], [41.05, -73.6], [42.0, -71.85]],
    'EPSG:3438': [[41.824, -71.4128], [41.35, -71.85], [42.0, -71.15]] };
  for (const [lat, lng] of pts['EPSG:2249']) {
    const s = lccS(GRS80, 42.68333333333333, 41.71666666666667, 41, -71.5, 200000.0001016, 750000, lat, lng), r = G.llToNative(proj4, 'EPSG:2249', lat, lng);
    near(r.E * FT, s.x, 0.001, 'MA E'); near(r.N * FT, s.y, 0.001, 'MA N');
    const m = G.llToNative(proj4, 'EPSG:26986', lat, lng); near(m.E, r.E * FT - 0.0001016, 0.000001, 'MA m vs ftUS'); near(m.N, r.N * FT, 0.000001);
    const back = G.nativeToLl(proj4, 'EPSG:2249', r.E, r.N); near(back.lat, lat, 1e-9); near(back.lng, lng, 1e-9);
  }
  for (const [lat, lng] of pts['EPSG:2234']) {
    const s = lccS(GRS80, 41.86666666666667, 41.2, 40.83333333333334, -72.75, 304800.6096, 152400.3048, lat, lng), r = G.llToNative(proj4, 'EPSG:2234', lat, lng);
    near(r.E * FT, s.x, 0.001, 'CT E'); near(r.N * FT, s.y, 0.001, 'CT N');
  }
  for (const [lat, lng] of pts['EPSG:3438']) {
    const s = tmS(GRS80, 41.08333333333334, -71.5, 0.99999375, 99999.99998984, 0, lat, lng), r = G.llToNative(proj4, 'EPSG:3438', lat, lng);
    near(r.E * FT, s.x, 0.001, 'RI E'); near(r.N * FT, s.y, 0.001, 'RI N');
  }
  // the site frame (ftUS) of the metre zone equals the ftUS zone's to the false-easting difference (0.0001016 m = 0.00033 ft)
  const a = G.llToFt(proj4, 'EPSG:26986', 42.36, -71.06), b = G.llToFt(proj4, 'EPSG:2249', 42.36, -71.06);
  near(a.x, b.x - 0.0001016 / FT, 1e-6); near(a.y, b.y, 1e-6);
  const ll = G.ftToLl(proj4, 'EPSG:26986', a.x, a.y); near(ll.lat, 42.36, 1e-9); near(ll.lng, -71.06, 1e-9);
});

test('distance, azimuth, bearing text, area, centroid, buffer', () => {
  const a = { x: 0, y: 0 }, b = { x: 30, y: 40 };
  assert.equal(G.dist(a, b), 50); near(G.azimuth(a, b), 36.86989765, 1e-8);
  assert.equal(G.bearingText(36.86989765), 'N 36°52′12″ E'); assert.equal(G.bearingText(180 - 36.86989765), 'S 36°52′12″ E');
  assert.equal(G.bearingText(225), 'S 45°00′00″ W'); assert.equal(G.bearingText(359.99999), 'N 0°00′00″ W'); assert.equal(G.bearingText(90), 'N 90°00′00″ E');
  near(G.azimuth(a, { x: -1, y: 0 }), 270, 1e-12);
  const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 20 }, { x: 0, y: 20 }];
  assert.equal(G.area(sq), 200); assert.equal(G.perimeter(sq), 60); assert.deepEqual({ ...G.centroid(sq, true) }, { x: 5, y: 10 });
  assert.equal(G.lineDist({ x: 5, y: 30 }, sq, true), 10); assert.equal(G.inside({ x: 5, y: 5 }, sq), true); assert.equal(G.inside({ x: 15, y: 5 }, sq), false);
  const rings = G.bufferRings([{ x: 0, y: 0 }, { x: 100, y: 0 }], 10, 16);
  assert.equal(rings.length, 3); rings.forEach(r => assert.ok(G.signedArea(r) > 0, 'every ring counter-clockwise'));
  assert.equal(JSON.stringify(rings[2]), JSON.stringify([{ x: 0, y: -10 }, { x: 100, y: -10 }, { x: 100, y: 10 }, { x: 0, y: 10 }]));
});

test('sheet placement: pixel <-> grid, scale calibration, georeference with rotation', () => {
  const pl = { x: 1000, y: 2000, s: 0.5, rot: 0 };
  assert.deepEqual({ ...G.pxToFt(pl, 100, 40) }, { x: 1050, y: 1980 });   // py downward: the grid y falls
  const back = G.ftToPx(pl, 1050, 1980); near(back.px, 100, 1e-12); near(back.py, 40, 1e-12);
  // calibration: two points 400 px apart are 100 ft -> 0.25 ft/px; about the midpoint, which keeps its grid position
  const c = G.calScale({ px: 100, py: 100 }, { px: 340, py: 420 }, 100); assert.equal(c.dpx, 400); assert.equal(c.s, 0.25);
  const q = G.rescaleAbout(pl, 0.25, 220, 260), m0 = G.pxToFt(pl, 220, 260), m1 = G.pxToFt(q, 220, 260); near(m0.x, m1.x, 1e-9); near(m0.y, m1.y, 1e-9);
  // georeference: a sheet drawn at 0.2 ft/px, rotated 30° CCW, pixel (0,0) at (5000, 6000)
  const T = { x: 5000, y: 6000, s: 0.2, rot: Math.PI / 6 };
  const p1 = { px: 120, py: 80 }, p2 = { px: 2400, py: 1700 }, g1 = G.pxToFt(T, p1.px, p1.py), g2 = G.pxToFt(T, p2.px, p2.py);
  const r = G.georef(p1, p2, g1, g2); near(r.s, 0.2, 1e-12); near(r.rot, Math.PI / 6, 1e-12); near(r.x, 5000, 1e-8); near(r.y, 6000, 1e-8);
  // worked check case (hand): p1 (120, 80), p2 (2400, 1700): d_px = √(2280² + 1620²) = 2796.927 px; L_g = 0.2 × 2796.927 = 559.385 ft
  near(r.dpx, Math.hypot(2280, 1620), 1e-9); near(r.dft, 0.2 * Math.hypot(2280, 1620), 1e-9); near(r.dpx, 2796.927, 0.001);
  // the items on the sheet move with it
  const mv = G.placementMove(pl, T), it = G.pxToFt(pl, 300, 500), moved = mv(it), exp = G.pxToFt(T, 300, 500); near(moved.x, exp.x, 1e-9); near(moved.y, exp.y, 1e-9);
});

test('parse angles and numbers', () => {
  near(G.parseAngle('42.3601'), 42.3601, 1e-12); near(G.parseAngle('42 21 36'), 42.36, 1e-12); near(G.parseAngle('71°03′32″ W'), -(71 + 3 / 60 + 32 / 3600), 1e-12);
  near(G.parseAngle('-71.06'), -71.06, 1e-12); assert.ok(isNaN(G.parseAngle('42 61'))); assert.ok(isNaN(G.parseAngle('abc')));
  assert.equal(G.parseNum('2,955,123.45'), 2955123.45); assert.ok(isNaN(G.parseNum('')));
});

test('OSHA 29 CFR 1926.1408 Table A lookup (row boundaries include the "to" value)', () => {
  const cases = [[0.12, 10], [13.8, 10], [50, 10], [50.01, 15], [115, 15], [200, 15], [230, 20], [345, 20], [350, 20], [350.1, 25], [500, 25], [765, 45], [735, 35], [750, 35], [1000, 45]];
  for (const [kv, ft] of cases) { const r = O.clearance({ kv }); assert.equal(r.ft, ft, kv + ' kV'); assert.equal(r.ok, true); assert.equal(r.steps[0].value, ft); assert.match(r.steps[0].ref, /1926\.1408 Table A/); }
  const hi = O.clearance({ kv: 1100 }); assert.ok(isNaN(hi.ft)); assert.equal(hi.ok, false);
  assert.equal(O.clearance({ kv: 1100, setFt: 60 }).ft, 60);
  assert.equal(O.clearance({ kv: null }).ft, 50); assert.equal(O.clearance({ kv: null, le350: true }).ft, 20);
  assert.equal(O.ROWS.length, 6);
});

test('worked steps: dimension, shape, calibration, georeference (values = the geometry functions)', () => {
  const d = WK.dim({ x: 100, y: 200 }, { x: 130, y: 240 }, 'x'); assert.equal(d.L, 50); assert.equal(d.steps.find(s => s.id === 'x.L').value, 50);
  assert.equal(d.bearing, 'N 36°52′12″ E');
  const sh = WK.shape([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 20 }, { x: 0, y: 20 }], true, 'y'); assert.equal(sh.A, 200); assert.equal(sh.steps[0].value, 200);
  const sheet = { cal: { p1: { px: 100, py: 100 }, p2: { px: 340, py: 420 }, dist: 100 } };
  const c = WK.cal(sheet, 'c'); assert.equal(c.s, 0.25); assert.equal(c.steps.map(s => s.id).join(), 'c.dpx,c.D,c.s');
  const T = { x: 5000, y: 6000, s: 0.2, rot: Math.PI / 6 }, p1 = { px: 120, py: 80 }, p2 = { px: 2400, py: 1700 };
  const g1 = G.pxToFt(T, 120, 80), g2 = G.pxToFt(T, 2400, 1700);
  const g = WK.geo({ geo: { p1, p2, g1: { E: g1.x, N: g1.y }, g2: { E: g2.x, N: g2.y } }, cal: sheet.cal }, 'EPSG:2249', 'g');
  near(g.r.s, 0.2, 1e-12); near(g.steps.find(s => s.id === 'g.rot').value, 30, 1e-9); near(g.chk, 0.25, 1e-12);   // calibration 0.25 vs georef 0.20: +25 %
  const gm = WK.geo({ geo: { p1, p2, g1: { E: g1.x * FT, N: g1.y * FT }, g2: { E: g2.x * FT, N: g2.y * FT } } }, 'EPSG:26986', 'm'); near(gm.r.s, 0.2, 1e-9); assert.equal(gm.steps[0].id, 'm.conv');
});

test('model: normalize, file round trip, inputs text leaves out the view', () => {
  const P = M.newProject(); P.items.push({ type: 'power', pts: [{ x: 1, y: 2 }, { x: 3, y: 4 }], kv: 13.8, name: 'PL' }, { type: 'obst', pts: [{ x: 0, y: 0 }] }, { type: 'nope', pts: [] });
  P.view = { lat: 42, lng: -71, z: 18 };
  const n = M.normalize(JSON.parse(JSON.stringify(P))); assert.equal(n.items.length, 1); assert.equal(n.items[0].kv, 13.8); assert.equal(n.items[0].le350, false);
  const f = JSON.parse(JSON.stringify(M.toFile(n))); assert.equal(f.format, 'crane-pick.project'); assert.equal(f.version, 1); assert.equal(f.images, undefined);
  const back = M.fromFile(f); assert.equal(JSON.stringify(back.project), JSON.stringify(n));
  assert.equal(JSON.parse(M.inputsText(n)).view, undefined);
  assert.throws(() => M.fromFile({ format: 'other' }), /not a Crane Pick Analyzer file/);
  assert.ok(Object.values(M.KEYS).every(k => k.startsWith('crane.')), 'every key starts with crane.');
});

test('worked steps: every sym / eq / sub / unit parses with KaTeX (strict), the built-in renderer shows them', async () => {
  const { createRequire } = await import('node:module');
  const katex = createRequire(import.meta.url)(path.join(ROOT, 'tests/libs/katex@0.16.9/dist/katex.min.js'));
  const parse = t => katex.renderToString(t, { ...W.SharedSteps.katexOpt, throwOnError: true, strict: 'error' });
  const T = { x: 5000, y: 6000, s: 0.2, rot: Math.PI / 6 }, g1 = G.pxToFt(T, 120, 80), g2 = G.pxToFt(T, 2400, 1700), cal = { p1: { px: 100, py: 100 }, p2: { px: 340, py: 420 }, dist: 100 };
  const all = [...WK.dim({ x: -3, y: 2 }, { x: 1300.5, y: -40 }, 'd').steps, ...WK.shape([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 20 }], true, 's').steps, ...WK.shape([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 20 }], false, 'l').steps,
    ...WK.cal({ cal }, 'c').steps, ...WK.geo({ geo: { p1: { px: 120, py: 80 }, p2: { px: 2400, py: 1700 }, g1: { E: g1.x * FT, N: g1.y * FT }, g2: { E: g2.x * FT, N: g2.y * FT } }, cal }, 'EPSG:26986', 'g').steps,
    ...[13.8, 115, 1200, null].flatMap(kv => O.clearance({ kv, setFt: kv === 1200 ? 70 : null }).steps), ...O.clearance({ kv: null, le350: true }).steps, ...O.clearance({ kv: 1100 }).steps];
  let k = 0;
  for (const s of all) { for (const f of ['sym', 'eq', 'sub']) if (s[f]) { parse(s[f]); k++; } if (s.unit) { parse(W.SharedSteps.unitTeX(s.unit)); k++; }
    assert.ok(!/NaN|undefined/.test(W.SharedSteps.toText([s])), s.id); }
  assert.ok(k > 40, String(k));
});
