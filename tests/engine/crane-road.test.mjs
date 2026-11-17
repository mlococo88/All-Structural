// Crane Pick Analyzer (apps/crane-pick), 2026-11-17: the fitted route alignment (engine/align.js), OpenStreetMap roads (engine/osm.js:
// graph, snapping, Dijkstra, names, one-way), the lane offset, the fitted path in engine/route.js, and legacy routes unchanged.
// Node only; synthetic geometry; no chart data; no network (a mocked Overpass answer).
//   node tests/engine/run.mjs crane-road
//
// Hand checks (calculator):
// A. Free least-squares circle: points every 0.5° on a 90° arc of R = 200 ft, centre (0, 0), with Gaussian noise σ = 0.5 ft (seeded):
//    R_LS within 1 % of 200 (the worst of 30 seeds is 0.43 %); without noise R = 200.000 exactly, centre (0, 0).
// B. Tangent–curve–tangent: a 300 ft tangent east, a left curve R = 250 ft, Δ = 60°, a 300 ft tangent (noise σ = 0.3 ft):
//    PI at x = 300 + 250 tan 30° = 300 + 144.3376 = 444.3376, y = 0; T = 144.34 ft; L = 250 × π/3 = 261.80 ft. Fitted: one curve,
//    R within 1 %, Δ within 0.5°, the PI within 2 ft.
// C. Many clicks along a curve: start (−200, 0), (0, 0), then points every 10° on R = 150 (centre (0, 150)) to 90°, then (150, 350):
//    legacy = 10 turns of r 50 (the clicks); fitted = 1 curve, Δ = 90°, R ≈ 150 (the clicks lie on the circle; their chords are inside it
//    by up to 150 (1 − cos 5°) = 0.571 ft, so the fit is within 1 %: 151.2).
// D. Corners: clicks (0, 0), (200, 0), (200, 160), (400, 160): two intersection turns with the PIs on the clicked corners (Δ +90°,
//    −90°), the route default radius 50 ft: T = 50 tan 45° = 50 ft; path length = 200 + 160 + 200 − 4 × 50 + 2 × 50 π/2 = 517.08 ft.
// E. Lane offset of a left curve: an arc of R = 100 (centre (0, 100), heading east at (0, 0)) offset 6 ft to the right: every point is
//    106 ft from the centre (a left curve's outside); a straight line offset by 6 ft moves 6 ft.
// F. Dijkstra on a small mocked OSM graph: a square block (A (0,0) – B (300,0) – C (300,300) – D (0,300)) plus a diagonal A–C service
//    road; from near A to near C: the diagonal 424.26 ft beats 600 ft; with the diagonal one-way C→A, the path still uses it (warning).
// G. Legacy: a route without mode computes as on main (numbers recorded from main's engine/route.js, 2026-11-17: L 502.4045, OT max
//    9.4691, turn OTs 6.1410, 8.7737, 9.4691); mode 'legacy' gives the same result.
import assert from 'node:assert/strict';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps', 'crane-pick', 'engine');
const W = loadShared('steps.js', 'boussinesq.js', ...['geo.js', 'model.js', 'osha.js', 'cranes.js', 'lift.js', 'elev.js', 'clear3d.js', 'ground.js', 'tandem.js', 'align.js', 'osm.js', 'route.js'].map(f => path.join(APP, f)));
const AL = W.CranePickAlign, OSM = W.CranePickOSM, RT = W.CranePickRoute, M = W.CranePickModel;
const pl = x => JSON.parse(JSON.stringify(x)), deq = (a, b, m) => assert.deepEqual(pl(a), pl(b), m);
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const P0 = { items: [], routeMarks: [], picks: [], setups: [], cranes: [], tandems: [] };
const rng = sd => { let s = sd; const u = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; return () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u()); };
const DEG = Math.PI / 180;

test('A. free least-squares circle: exact points, and noisy points of a known circle within 1 %', () => {
  const ex = []; for (let a = 0; a <= 90; a += 3) ex.push({ x: 200 * Math.cos(a * DEG), y: 200 * Math.sin(a * DEG) });
  const c0 = AL.fitCircle(ex); near(c0.R, 200, 1e-6); near(c0.c.x, 0, 1e-6); near(c0.c.y, 0, 1e-6);
  for (let sd = 1; sd <= 30; sd++) { const g = rng(sd * 7919), pts = []; for (let a = 0; a <= 90; a += 0.5) pts.push({ x: 200 * Math.cos(a * DEG) + 0.5 * g(), y: 200 * Math.sin(a * DEG) + 0.5 * g() });
    const c = AL.fitCircle(pts); assert.ok(Math.abs(c.R / 200 - 1) < 0.01, `seed ${sd}: R ${c.R}`); }
});

function tct(R, D, sig, sd) {
  const g = rng(sd), line = [], t = D * DEG, add = (x, y) => line.push({ x: x + sig * g(), y: y + sig * g() });
  for (let x = 0; x < 300; x += 3) add(x, 0);
  for (let a = 0; a <= D; a += 0.7) { const u = a * DEG; add(300 + R * Math.sin(u), R - R * Math.cos(u)); }
  const PT = { x: 300 + R * Math.sin(t), y: R - R * Math.cos(t) }; for (let s = 3; s <= 300; s += 3) add(PT.x + s * Math.cos(t), PT.y + s * Math.sin(t));
  return line;
}
test('B. tangent–curve–tangent segmentation: one curve, R within 1 %, Δ, PI (hand check)', () => {
  for (const sd of [1, 2, 3]) {
    const f = AL.fit(tct(250, 60, 0.3, sd * 101)); deq([...f.al.kind], ['end', 'curve', 'end']);
    near(f.al.rad[1], 250, 2.5, 'R'); near(f.al.pis[1].x, 444.3376, 2, 'PI x'); near(f.al.pis[1].y, 0, 2, 'PI y'); assert.ok(Math.abs(f.al.fit[1].Rls / 250 - 1) < 0.02, 'free circle');
    const r = M.normRoute({ id: 'b', pts: tct(250, 60, 0.3, sd * 101), mode: 'fit', al: f.al }), ev = RT.evaluate(r, P0, 'rt1');
    assert.equal(ev.turns.length, 1); near(Math.abs(ev.turns[0].D) / DEG, 60, 0.5, 'Δ'); near(ev.turns[0].Lc, ev.turns[0].r * Math.abs(ev.turns[0].D), 1e-9, 'L = R Δ'); near(ev.turns[0].Lc, 261.80, 3, 'L ≈ 250 π/3');
    assert.ok(ev.align.dev.max < 1.5, 'max deviation ' + ev.align.dev.max); assert.equal(ev.turns[0].kind, 'curve'); assert.match(ev.turns[0].steps[0].label, /^Curve 1: radius fitted to the line/);
  }
  // reverse curves (left R 200 Δ 40°, 120 ft tangent, right R 300 Δ 50°): two curves of the right signs and radii
  const line = [], seg = (x0, y0, th, L) => { for (let s = 0; s < L; s += 2) line.push({ x: x0 + s * Math.cos(th), y: y0 + s * Math.sin(th) }); return { x: x0 + L * Math.cos(th), y: y0 + L * Math.sin(th) }; };
  const arc = (p, th, R, D) => { const sg = Math.sign(D), c = { x: p.x - sg * R * Math.sin(th), y: p.y + sg * R * Math.cos(th) }; for (let a = 0; a < Math.abs(D); a += 1) { const u = th + sg * a * DEG; line.push({ x: c.x + sg * R * Math.sin(u), y: c.y - sg * R * Math.cos(u) }); } const u = th + D * DEG; return { x: c.x + sg * R * Math.sin(u), y: c.y - sg * R * Math.cos(u) }; };
  let p = seg(0, 0, 0, 250); p = arc(p, 0, 200, 40); p = seg(p.x, p.y, 40 * DEG, 120); p = arc(p, 40 * DEG, 300, -50); seg(p.x, p.y, -10 * DEG, 250); line.push(p);
  const f = AL.fit(line); deq([...f.al.kind], ['end', 'curve', 'curve', 'end']); near(f.al.rad[1], 200, 3, 'R1'); near(f.al.rad[2], 300, 4, 'R2');
});

test('C. many clicks along a curve: legacy = one turn per click; fitted = one curve with the real radius', () => {
  const pts = [{ x: -200, y: 0 }, { x: 0, y: 0 }]; for (let a = 10; a <= 90; a += 10) pts.push({ x: 150 * Math.sin(a * DEG), y: 150 - 150 * Math.cos(a * DEG) }); pts.push({ x: 150, y: 350 });
  const leg = RT.evaluate(M.normRoute({ id: 'c', pts }), P0, 'rt1'); assert.equal(leg.turns.length, 10); assert.ok(leg.turns.every(t => t.r === 50));
  const f = AL.fit(pts), r = M.normRoute({ id: 'c', pts, mode: 'fit', al: f.al }), ev = RT.evaluate(r, P0, 'rt1');
  assert.equal(ev.turns.length, 1); near(ev.turns[0].r, 150, 1.5, 'R (1 %)'); near(ev.turns[0].D / DEG, 90, 0.5);
  near(ev.turns[0].ss.OT, RT.steady(RT.vehOf(r), ev.turns[0].r).OT, 1e-12); assert.ok(ev.turns[0].ot > 0 && ev.turns[0].ot < ev.turns[0].ss.OT + 0.05, 'the simulated off-tracking on the fitted curve');
});

test('D. corners -> intersection turns at the clicked corners with the route default radius (hand check)', () => {
  const pts = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 160 }, { x: 400, y: 160 }], f = AL.fit(pts);
  deq([...f.al.kind], ['end', 'turn', 'turn', 'end']); deq(JSON.parse(JSON.stringify(f.al.pis)), pts);
  const ev = RT.evaluate(M.normRoute({ id: 'd', pts, mode: 'fit', al: f.al }), P0, 'rt1');
  near(ev.sim.pa.L, 200 + 160 + 200 - 4 * 50 + 2 * 50 * Math.PI / 2, 1e-9, 'path length'); deq(ev.turns.map(t => [t.kind, t.r, t.tag]), [['turn', 50, 'T1'], ['turn', 50, 'T2']]);
  // shared tangent too short for both: scaled in proportion (radii 150 and 50 on a 160 ft tangent: T 150 + 50 > 160 -> × 0.8)
  const al = JSON.parse(JSON.stringify(f.al)); al.rad = [null, 150, 50, null];
  const e2 = RT.evaluate(M.normRoute({ id: 'd', pts, mode: 'fit', al }), P0, 'rt1');
  near(e2.turns[0].r, 120, 1e-9); near(e2.turns[1].r, 40, 1e-9); assert.ok(e2.turns.every(t => t.reduced)); assert.ok(e2.flags.some(x => /^Intersection turn 1: the radius asked for \(150\.0 ft\) does not fit the tangents next to it; 120\.0 ft is used/.test(x.text)));
  assert.ok(e2.flags.some(x => x.level === 'stop' && /^Intersection turn 2: radius 40\.0 ft is tighter than the vehicle's minimum turning radius 45\.0 ft/.test(x.text)));
});

test('E. lane offset (right side) and stations', () => {
  const arc = []; for (let a = 0; a <= 90; a += 2) arc.push({ x: 100 * Math.sin(a * DEG), y: 100 - 100 * Math.cos(a * DEG) });
  const o = AL.offset(arc, 6); o.slice(1, -1).forEach(p => near(Math.hypot(p.x, p.y - 100), 106, 0.01, 'outside of a left curve'));
  near(Math.hypot(o[0].x, o[0].y - 100), 106, 0.01);
  const s = AL.offset([{ x: 0, y: 0 }, { x: 100, y: 0 }], 6); deq(JSON.parse(JSON.stringify(s)), [{ x: 0, y: -6 }, { x: 100, y: -6 }]);
  assert.equal(AL.sta(1234.567), '12+34.57'); assert.equal(AL.sta(5), '0+05.00'); assert.equal(AL.sta(0), '0+00.00');
});

// a mocked Overpass answer in a plain lat / lon frame (proj: 1° = 100,000 ft, for the test only)
const proj = (lat, lon) => ({ x: lon * 100000, y: lat * 100000 });
const ll = (x, y) => ({ lat: y / 100000, lon: x / 100000 });
const way = (id, nodes, xy, tags) => ({ type: 'way', id, nodes, geometry: xy.map(q => ll(q[0], q[1])), tags });
test('F. OSM: graph, snapping, Dijkstra on a small mocked graph, names, one-way warnings, footways ignored', () => {
  const J = { elements: [way(1, [1, 2, 3], [[0, 0], [300, 0], [300, 300]], { highway: 'residential', name: 'First St' }), way(2, [3, 4, 1], [[300, 300], [0, 300], [0, 0]], { highway: 'residential', name: 'Second St' }),
    way(3, [1, 3], [[0, 0], [300, 300]], { highway: 'service', name: 'Diagonal' }), way(4, [5, 6], [[0, 0], [300, 300]], { highway: 'footway', name: 'Path' })] };
  const g = OSM.graph(J, proj); assert.equal(g.n, 4); assert.equal(g.edges.length, 5);
  let r = OSM.route(g, [{ x: 10, y: -5 }, { x: 305, y: 290 }]); assert.ok(r.ok, r.why);
  near(r.L, 10 + Math.hypot(300, 300) + 10, 1e-6, 'along the diagonal'); deq(r.names.map(n => n.name), ['First St', 'Diagonal', 'First St']); assert.equal(r.against.length, 0);
  near(r.snaps[0].d, 5, 1e-9); near(r.snaps[1].d, 5, 1e-9);
  J.elements[2].tags.oneway = 'yes'; J.elements[2].nodes = [3, 1]; J.elements[2].geometry = [ll(300, 300), ll(0, 0)];   // one-way C -> A
  const g2 = OSM.graph(J, proj); r = OSM.route(g2, [{ x: 10, y: -5 }, { x: 305, y: 290 }]); assert.ok(r.ok);
  near(r.L, 20 + Math.hypot(300, 300), 1e-6, 'still the diagonal (one-way = warning only)'); assert.equal(r.against.length, 1); assert.equal(r.against[0].name, 'Diagonal'); near(r.against[0].s1 - r.against[0].s0, Math.hypot(300, 300), 1e-6);
  const d = OSM.dijkstra(g.adj, 'n1', 'n4'); near(d.d, 300, 1e-9);
  assert.equal(OSM.route(g, [{ x: 10, y: -500 }, { x: 305, y: 290 }]).ok, false, 'too far from every road');
  assert.match(OSM.route(g, [{ x: 10, y: -500 }, { x: 305, y: 290 }]).why, /point 1 is 500 ft from the nearest OpenStreetMap road \(limit 150 ft\)/);
  deq([OSM.oneway({ oneway: 'yes' }), OSM.oneway({ oneway: '-1' }), OSM.oneway({ junction: 'roundabout' }), OSM.oneway({ highway: 'motorway', oneway: 'no' }), OSM.oneway({})], [1, -1, 1, 0, 0]);
  const b = OSM.bboxOf([{ lat: 42.36, lng: -71.06 }], 0); deq(JSON.parse(JSON.stringify(b)), { s: 42.36, w: -71.06, n: 42.36, e: -71.06 });
  assert.match(OSM.query({ s: 1, w: 2, n: 3, e: 4 }), /^\[out:json\]\[timeout:25\];way\["highway"~"\^\(motorway\|.*\)\$"\]\(1,2,3,4\);out geom;$/);
  assert.ok(OSM.contains({ s: 0, w: 0, n: 2, e: 2 }, { s: 1, w: 1, n: 2, e: 2 }));
});

test('G. legacy routes compute as on main; mode "legacy" = no mode; normalize keeps the fitted fields only when present', () => {
  const r0 = { id: 'g', pts: [{ x: 0, y: 0 }, { x: 120, y: 10 }, { x: 220, y: 60 }, { x: 300, y: 160 }, { x: 330, y: 300 }], rad: [null, 80, null, 40, null], veh: { type: 'jeep', L1: 18, e: 1, Lj: 12, ej: 0.5, L2: 90, k: 0.6 }, load: { L: 110, r: 5, W: 90000 } };
  const ev = RT.evaluate(M.normRoute(r0), P0, 'rt1');
  near(ev.sim.pa.L, 502.4045361931985, 1e-9); near(ev.otMax, 9.469131078725871, 1e-9);
  [6.140997313745413, 8.773745692578602, 9.469131078725871].forEach((v, i) => near(ev.turns[i].ot, v, 1e-9, 'turn ' + (i + 1)));
  assert.equal(ev.flags[0].text, 'Turn 3: radius 40.0 ft is tighter than the vehicle\'s minimum turning radius 45.0 ft.'); assert.equal(ev.align, undefined);
  const ev2 = RT.evaluate(M.normRoute(Object.assign({}, r0, { mode: 'legacy' })), P0, 'rt1'); assert.equal(JSON.stringify(ev2), JSON.stringify(ev));
  deq(Object.keys(M.normRoute(r0)).filter(k => ['mode', 'al', 'src', 'lane'].includes(k)), [], 'an old route gains no field');
  const f = AL.fit(r0.pts), nr = M.normRoute(Object.assign({}, r0, { mode: 'fit', al: f.al, src: { kind: 'osm', at: '2026-11-17', names: [{ name: 'Main', s0: 0, s1: 10 }], cl: r0.pts }, lane: { on: true, w: 12 } }));
  assert.equal(nr.mode, 'fit'); assert.equal(nr.al.pis.length, f.al.pis.length); assert.equal(nr.src.kind, 'osm'); deq(JSON.parse(JSON.stringify(nr.lane)), { on: true, w: 12 });
  assert.equal(JSON.stringify(M.normRoute(JSON.parse(JSON.stringify(nr)))), JSON.stringify(nr), 'round trip');
  const eo = RT.evaluate(nr, P0, 'rt1'); assert.ok(eo.flags.some(x => x.level === 'info' && /from OpenStreetMap — not survey \(© OpenStreetMap contributors, fetched 2026-11-17\)/.test(x.text)));
});
