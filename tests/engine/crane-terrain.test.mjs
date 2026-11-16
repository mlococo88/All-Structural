// Crane Pick Analyzer (apps/crane-pick), C8: preliminary terrain from USGS 3DEP (engine/terrain.js). Node only: synthetic grids (planes, a
// bump, a crest, a sag) and MOCKED USGS answers (the USGS hosts could not be reached from the build container). No crane chart data.
//   node tests/engine/run.mjs crane-terrain
//
// Hand checks:
//  A bilinear: z = 100 + 0.02x − 0.01y on a 5 ft grid is reproduced exactly anywhere (bilinear is exact for a plane); a 2 ft bump on one
//    node: 102.00 at the node, 101.00 half way to the next node, 100.50 at the centre of an adjacent cell.
//  B levelness, floats x_F 10, x_R 8, spread 18 (b 9), heading 0 (front = north), centre (0, 0), z = 100 + 0.02x + 0.03y:
//    FL (−9, 10) 100.12, FR (9, 10) 100.48, RL (−9, −8) 99.58, RR (9, −8) 99.94;
//    s_L = 100 [(100.12 + 100.48)/2 − (99.58 + 99.94)/2] / 18 = 3.000 %; s_T = 100 [(100.12 + 99.58)/2 − (100.48 + 99.94)/2] / 18 = −2.000 %;
//    s_max = √13 = 3.6056 %; twist 0; level at the highest support (FR 100.48): blocking FL 0.36, FR 0, RL 0.90, RR 0.54 ft;
//    tolerance 1 % -> amber (warn); blocking limit 0.5 ft -> red (stop, 0.90 > 0.50); datum 100.00 -> FR −0.48 (cut: warn).
//  C pad grading, z = 100 + 0.02x, pad 40 × 20 ft on the carrier axis (heading 90°: along +x): at el. 100 fill = cut = W s B²/8 =
//    20 × 0.02 × 40²/8 = 80 ft³ (2.963 cy); at el. 101 fill = 1 × 800 − 0 = 800 ft³, cut 0; not entered: the mean ground 100.00.
//  D route profile, straight route (0, 0) → (300, 0), semi L1 20, e 1 (H 19 ft behind the steer axle), L2 40, load 50 ft, r 2 (f = 8),
//    deck 5 ft -> h_u = 5 − 1 = 4 ft (default):
//    crest z = 107.5 − 0.05|x − 150|: grade ±5 %; crest at sta. 150; chord clearance c(a) = 4 − 0.1a + 0.0025a² (a = 150 − s_R), the least
//    at a = 20: c = 4 − 2 + 1 = 3.00 ft, between the supports; sag z = 100 + 0.05|x − 150|: front overhang with H at the sag bottom:
//    c = 3.2 + 0.1a -> 3.20 ft at a = 0 (the rear overhang gives 3.8 + 0.1a); sag at sta. 150 (grade break A = +10 % >= 2 %; crest A = −10 %). Maximum grade 8 % (default): no flag;
//    4 %: the tangent's 5 % flagged (warn). Grid nodes on multiples of the spacing, so x = 150 is a node (the crest is not cut off).
import assert from 'node:assert/strict';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps', 'crane-pick', 'engine');
const W = loadShared('steps.js', 'boussinesq.js', ...['geo.js', 'model.js', 'osha.js', 'cranes.js', 'lift.js', 'elev.js', 'clear3d.js', 'ground.js', 'tandem.js', 'route.js', 'terrain.js'].map(f => path.join(APP, f)));
const T = W.CranePickTerrain, RT = W.CranePickRoute, M = W.CranePickModel, EL = W.CranePickElev;
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const grid = (ext, dx, f) => { const s = T.gridSpec(ext, dx); return T.makeGrid(s, T.nodes(s).map(q => f(q.x, q.y))); };

test('A bilinear: a plane is exact; a bump on one node', () => {
  const G = grid({ x0: -50, y0: -50, x1: 50, y1: 50 }, 5, (x, y) => 100 + 0.02 * x - 0.01 * y);
  for (const [x, y] of [[0, 0], [3.3, -7.1], [-41.2, 22.7], [12.5, 12.5]]) near(T.at(G, x, y), 100 + 0.02 * x - 0.01 * y, 1e-9, `plane at ${x}, ${y}`);
  const g = T.grad(G, 7, 8); near(g.gx, 0.02, 1e-12); near(g.gy, -0.01, 1e-12);
  assert.equal(T.at(G, 500, 0), null, 'outside the grid: null');
  const s = T.gridSpec({ x0: 0, y0: 0, x1: 20, y1: 20 }, 5), z = T.nodes(s).map(() => 100), nodes = T.nodes(s);
  const k = nodes.findIndex(q => q.i === 2 && q.j === 2); z[k] = 102; const B = T.makeGrid(s, z), q = nodes[k];
  near(T.at(B, q.x, q.y), 102, 1e-12, 'at the node'); near(T.at(B, q.x + 2.5, q.y), 101, 1e-12, 'half way'); near(T.at(B, q.x + 2.5, q.y + 2.5), 100.5, 1e-12, 'cell centre');
  z[k] = NaN; assert.equal(T.at(T.makeGrid(s, z), q.x + 1, q.y + 1), null, 'a no-data corner: null');
  const b = T.bilStep(B, 'x', 'z', 'Ground', q.x + 2.5, q.y + 2.5); near(b.z, 100.5, 1e-12); assert.match(W.SharedSteps.line(b.step, false), /100\.50/);
});

test('grid spec: covers the extent; the spacing grows to stay within the point limit', () => {
  const s = T.gridSpec({ x0: 0, y0: 0, x1: 100, y1: 50 }, 5);
  assert.equal(s.nx, 21); assert.equal(s.ny, 11); assert.equal(s.x0, 0); assert.ok(s.x0 <= 0 && s.x0 + (s.nx - 1) * s.dx >= 100 && s.y0 <= 0 && s.y0 + (s.ny - 1) * s.dx >= 50); assert.equal(s.grown, false);
  const g = T.gridSpec({ x0: 0, y0: 0, x1: 2000, y1: 2000 }, 5); assert.ok(g.n <= T.LIM.maxPts && g.grown && g.dx > 5, JSON.stringify(g));
});

const FL = { ok: true, kind: 'wheeled', xF: 10, xR: 8, b: 9, items: W.CranePickGround.FLOATS.map(t => Object.assign({ lx: t.sx > 0 ? 10 : -8, ly: t.sy * 9 }, t)) };
test('B levelness on a plane: slopes, blocking, badge', () => {
  const G = grid({ x0: -60, y0: -60, x1: 60, y1: 60 }, 5, (x, y) => 100 + 0.02 * x + 0.03 * y), u = { x: 0, y: 0, heading: 0 };
  const L = T.level(FL, u, G, { tol: 1 }, 'lv'), z = id => L.pts.find(p => p.id === id).z, b = id => L.pts.find(p => p.id === id).blk;
  near(z('FL'), 100.12, 1e-9); near(z('FR'), 100.48, 1e-9); near(z('RL'), 99.58, 1e-9); near(z('RR'), 99.94, 1e-9);
  near(L.sL, 3, 1e-9, 's_L'); near(L.sT, -2, 1e-9, 's_T'); near(L.sMax, Math.sqrt(13), 1e-9, 's_max'); near(L.tw, 0, 1e-9);
  near(b('FL'), 0.36, 1e-9); near(b('FR'), 0, 1e-9); near(b('RL'), 0.90, 1e-9); near(b('RR'), 0.54, 1e-9);
  assert.equal(L.status, 'warn');
  assert.equal(T.level(FL, u, G, { tol: 4 }).status, 'ok');
  const R = T.level(FL, u, G, { tol: 1, maxBlk: 0.5 }); assert.equal(R.status, 'stop'); assert.ok(R.flags.some(f => f.level === 'stop' && /10\.8 in/.test(f.text)), R.flags.map(f => f.text).join(' | '));
  const D = T.level(FL, u, G, { tol: 1, datum: 100 }); near(D.pts.find(p => p.id === 'FR').blk, -0.48, 1e-9); assert.ok(D.flags.some(f => /below the ground/.test(f.text)));
  // rotated crane, same plane: the slope magnitude is the same (the plane's own gradient = √(2² + 3²) %)
  near(T.level(FL, { x: 5, y: -3, heading: 37 }, G, {}).sMax, Math.sqrt(13), 1e-9, 'rotated');
  // crawler: track ends at ±L_t/2, ±g/2
  const CR = { ok: true, kind: 'crawler', Lt: 20, g: 16, s: 3, items: [] }, C = T.level(CR, { x: 0, y: 0, heading: 90 }, G, {});
  assert.equal(C.pts.map(p => p.id).join(), 'LF,RF,LR,RR'); near(C.sL, 2, 1e-9, 'crawler heading 90: along +x'); near(C.sT, 3, 1e-9);   // left = +y at heading 90
  // no terrain / off the grid
  assert.equal(T.level(FL, u, null, {}).status, 'none'); assert.equal(T.level(FL, { x: 1000, y: 0, heading: 0 }, G, {}).status, 'stop');
});

test('C pad grading on a plane (closed form)', () => {
  const G = grid({ x0: -60, y0: -40, x1: 60, y1: 40 }, 5, x => 100 + 0.02 * x), u = { x: 0, y: 0, heading: 90 };
  let r = T.padGrade(G, u, { B: 40, W: 20, el: 100 }); near(r.fill, 80, 1e-9, 'fill'); near(r.cut, 80, 1e-9, 'cut'); near(r.fillCy, 80 / 27, 1e-12); near(r.A, 800, 1e-9);
  r = T.padGrade(G, u, { B: 40, W: 20, el: 101 }); near(r.fill, 800, 1e-9); near(r.cut, 0, 1e-12);
  r = T.padGrade(G, u, { B: 40, W: 20, el: null }); near(r.el, 100, 1e-9); near(r.fill, 80, 1e-9); assert.match(r.from, /mean existing ground/);
  r = T.padGrade(G, { x: 0, y: 0, heading: 0 }, { B: 40, W: 20, el: 100 }); near(r.fill, 20 * 0.02 * 400 / 8 * 2, 1e-9, 'heading 0: the slope across the pad (W = 20 along x): B s W²/8 = 40');
});

const SEMI = { type: 'semi', L1: 20, e: 1, L2: 40, hDeck: 5 }, LOAD = { L: 50, r: 2, W: 40000 };
const route = () => M.normRoute({ name: 'Haul', pts: [{ x: 0, y: 0 }, { x: 300, y: 0 }], veh: SEMI, load: LOAD });
test('D route profile: grade, crest, sag, long-load clearance (hand cases)', () => {
  const crest = grid({ x0: -10, y0: -10, x1: 310, y1: 10 }, 5, x => 107.5 - 0.05 * Math.abs(x - 150));
  const P = { tandems: [], picks: [], setups: [], cranes: [], items: [], routeMarks: [] };
  let p = T.profile(RT, route(), P, crest, {}, 'tp');
  assert.ok(p.ok); near(p.hu, 4, 1e-12, 'h_u default deck − 1'); near(Math.abs(p.gov.g), 5, 1e-9, 'max grade 5 %');
  assert.equal(p.crest.length, 1); near(p.crest[0].s, 150, 1.01); assert.equal(p.sag.length, 0);
  near(p.clr.min, 3, 1e-9, 'crest: chord clearance 3.00 ft'); assert.equal(p.clr.where, 'between the supports'); near(p.clr.sR, 130, 1e-9);
  assert.equal(p.flags.length, 0);
  p = T.profile(RT, route(), P, crest, { maxGrade: 4, clr: 3.5 }); assert.ok(p.flags.some(f => /grade 5\.00 %/.test(f.text) || /grade -5\.00 %/.test(f.text)), p.flags.map(f => f.text).join(' | '));
  assert.ok(p.flags.some(f => f.level === 'warn' && /ground clearance/.test(f.text)));
  p = T.profile(RT, route(), P, crest, { hu: 0.5 }); assert.ok(p.flags.some(f => f.level === 'stop' && /grounds/.test(f.text)));
  const sag = grid({ x0: -10, y0: -10, x1: 310, y1: 10 }, 5, x => 100 + 0.05 * Math.abs(x - 150));
  p = T.profile(RT, route(), P, sag, {});
  assert.equal(p.sag.length, 1); near(p.sag[0].s, 150, 1.01); assert.equal(p.crest.length, 0);
  near(p.clr.min, 3.2, 1e-9, 'sag: front overhang 3.20 ft'); assert.equal(p.clr.where, 'front overhang'); near(p.clr.sH, 150, 1e-9);
  // off the grid: flagged
  const small = grid({ x0: -10, y0: -10, x1: 100, y1: 10 }, 5, () => 100); p = T.profile(RT, route(), P, small, {}); assert.ok(p.flags.some(f => /terrain missing/.test(f.text)));
});

test('contours (marching squares) and slope classes', () => {
  const G = grid({ x0: 0, y0: 0, x1: 20, y1: 20 }, 2, x => 0.1 * x);
  const c = T.contours(G, 1); const l1 = c.levels.find(l => Math.abs(l.z - 1) < 1e-9);
  assert.ok(l1 && l1.segs.length >= 10); l1.segs.forEach(sg => sg.forEach(q => near(q.x, 10, 1e-9, 'z = 1 at x = 10')));
  assert.ok(c.levels.find(l => l.z === 0 || l.z === 1).major !== undefined);
  near(T.cellSlope(G, 3, 3), 10, 1e-9, '10 % slope'); assert.equal(T.SLOPE_CLASSES[T.slopeClass(10)].label, '≥ 10 %'); assert.equal(T.slopeClass(0.5), 0);
  assert.ok(T.contours(G, 0.001).tooMany > 250);
});

test('USGS answers (mocked): getSamples by locationId, NoData, errors; EPQS; the request body', () => {
  const r = T.parseSamples({ samples: [{ location: { x: -7910000, y: 5210000, spatialReference: { wkid: 3857 } }, locationId: 1, value: '12.5', rasterId: 7, resolution: 1 },
    { locationId: 0, value: 'NoData', resolution: 1 }, { locationId: 2, value: '30.48,1', resolution: 3 }] }, 3);
  assert.ok(isNaN(r.m[0])); near(r.m[1], 12.5, 1e-12); near(r.m[2], 30.48, 1e-12); assert.equal(r.res, 1); assert.equal(r.nodata, 1);
  const o = T.parseSamples({ samples: [{ value: '1' }, { value: '2' }] }, 2); assert.equal(o.m.join(), '1,2', 'no locationId: by order');
  assert.throws(() => T.parseSamples({ error: { code: 400, message: 'Unable to complete operation.', details: ['bad geometry'] } }, 1), /USGS service error 400: Unable to complete operation\. \(bad geometry\)/);
  assert.throws(() => T.parseSamples('x', 1)); assert.throws(() => T.parseSamples({}, 1), /no "samples"/);
  near(T.parseEpqs({ location: { x: -71, y: 42 }, value: 123.4, rasterId: 1, resolution: 1 }), 123.4, 1e-12); assert.ok(isNaN(T.parseEpqs({ value: '-1000000' })));
  near(T.FT_PER_M * 30.48, 99.9998, 1e-4, 'm -> ftUS (1 m = 3937/1200 ftUS)');
  const body = T.samplesBody([{ lat: 42.1, lng: -71.2 }]);
  assert.match(decodeURIComponent(body), /^geometry=\{"points":\[\[-71\.2,42\.1\]\],"spatialReference":\{"wkid":4326\}\}&geometryType=esriGeometryMultipoint&returnFirstValueOnly=true&interpolation=RSP_BilinearInterpolation&f=json$/);
  assert.match(T.epqsUrl({ lat: 42.1, lng: -71.2 }), /^https:\/\/epqs\.nationalmap\.gov\/v1\/json\?x=-71\.20000000&y=42\.10000000&wkid=4326&units=Feet&includeDate=false$/);
});

test('elevations from terrain (engine/elev.js provider): pad, pick / set ground; entered values override', () => {
  const tp = { pad: u => 50 + u.x / 100, ground: (x, y) => 40 + y / 100, depthPad: () => 49 };
  EL.setTerrain(tp);
  try {
    assert.equal(EL.padEl({ x: 100, y: 0, pad: null }), 51); assert.equal(EL.padEl({ x: 100, y: 0, pad: 7 }), 7);
    const E = EL.el0({ pick: { x: 0, y: 200 }, set: { x: 0, y: 300 }, elev: { pg: null, sg: 12 } });
    assert.equal(E.pg, 42); assert.equal(E.sg, 12); assert.equal(E.from.pg, 'terrain'); assert.equal(E.from.sg, 'entered');
    assert.equal(W.CranePickGround.depthOf({ topEl: 45 }, { x: 0, y: 0, pad: null }).z, 4, 'depth from the lowest support ground');
  } finally { EL.setTerrain(null); }
  assert.equal(EL.padEl({ x: 100, y: 0, pad: null }), 0); assert.equal(EL.el0({ elev: {} }).pg, null);
});

test('steps: KaTeX (strict); no NaN / undefined', async () => {
  const { createRequire } = await import('node:module');
  const katex = createRequire(import.meta.url)(path.join(ROOT, 'tests/libs/katex@0.16.9/dist/katex.min.js'));
  const parse = x => katex.renderToString(x, { ...W.SharedSteps.katexOpt, throwOnError: true, strict: 'error' });
  const G = grid({ x0: -60, y0: -60, x1: 320, y1: 60 }, 5, (x, y) => 100 + 0.02 * x + 0.03 * y - 0.0004 * (x - 150) * (x - 150) / 10);
  const all = [].concat(T.level(FL, { x: 0, y: 0, heading: 20 }, G, { maxBlk: 0.1 }).steps, T.level({ ok: true, kind: 'crawler', Lt: 20, g: 16, items: [] }, { x: 0, y: 0, heading: 0 }, G, {}).steps,
    T.padGrade(G, { x: 0, y: 0, heading: 0 }, { B: 30, W: 20, el: null }).steps, T.profile(RT, route(), { tandems: [] }, G, {}).steps, [T.bilStep(G, 'x', 'o', 'Out', 1e4, 0).step]);
  let n = 0;
  for (const s of all) { for (const f of ['sym', 'eq', 'sub']) if (s[f]) { parse(s[f]); n++; } if (s.unit) { parse(W.SharedSteps.unitTeX(s.unit)); n++; }
    const ln = W.SharedSteps.line(s, false) + ' ' + (s.note || '') + ' ' + (s.label || ''); assert.ok(!/NaN|undefined/.test(ln), s.id + ' ' + ln); }
  assert.ok(n > 60, String(n));
});
