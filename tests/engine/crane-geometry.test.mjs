// Crane Pick Analyzer (apps/crane-pick), 2026-11-17: the manufacturer GEOMETRY block (crane-pick.geometry.v1) — engine/cranes.js
// planDims takes its printed / derived values (never 'scaled' ones), engine/lift.js footprint puts the floats there (and at a drawn-only
// spread, flagged), engine/cranegfx.js draws it (axles, mats) and reports it (dimension check, float / support table, stake-out CSV,
// plan clearance dimensions). Node only, SYNTHETIC fake cranes (tests/smoke/crane-fake-*.json + a made-up geometry block below).
//   node tests/engine/run.mjs crane-geometry
// Hand checks:
//  G1 floats: geometry x_front 13 ft, x_rear 11 ft (printed), spread full 22 ft (printed), retracted 9 ft (SCALED: not used by the
//     engines), square float 2.5 ft. Rotation centre (1,000, 2,000), heading 90° (front = grid east): toGrid(lx, ly):
//     with heading 90°: x = X + lx·sin 90° − ly·cos 90° = X + lx, y = Y + lx·cos 90° + ly·sin 90° = Y + ly.
//     FL (13, 11) -> (1,013, 2,011); FR (13, −11) -> (1,013, 1,989); RL (−11, 11) -> (989, 2,011); RR (−11, −11) -> (989, 1,989).
//  G2 ground before / after (case A of crane-ground.test.mjs, the same weights; resultant X = 4.711864 ft, Y = 0, V = 118,000 lb):
//     before (dims: floats ±12 ft, spread 24): x̄ = 0, a = 12, u = 0.392655: front 29,500 (1 + u) = 41,083.33 lb, rear 17,916.67 lb.
//     after (geometry: 13 / 11, spread 22):   x̄ = (13 − 11)/2 = 1, a = (13 + 11)/2 = 12, u = (4.711864 − 1)/12 = 0.309322:
//       front 29,500 × 1.309322 = 38,625.00 lb each, rear 29,500 × 0.690678 = 20,375.00 lb each (Σ = 118,000).
//  G3 drawn-only spread 'mid' (geometry 15 ft, printed; the chart group is 'full'): floats at y = ±7.5, footprint.drawOnly, a 'spread'
//     stop flag in clearances; the ground supports stay at the chart's spread (b = 11).
//  G4 clearance dimension: an obstruction square 1,020 … 1,030 E, 2,005 … 2,015 N; the FL float square spans x 1,011.75 … 1,014.25:
//     nearest FL -> obstruction 1,020 − 1,014.25 = 5.75 ft; tail circle (16 ft, a 96-gon) to the corner (1,020, 2,005):
//     √(20² + 5²) − 16 = 20.6155 − 16 = 4.6155 ft (the 96-gon is within 0.01 ft).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps', 'crane-pick', 'engine');
const W = loadShared('steps.js', 'boussinesq.js', 'dxf.js', ...['geo', 'model', 'osha', 'cranes', 'lift', 'elev', 'ground', 'cranegfx'].map(f => path.join(APP, f + '.js')));
const K = W.CranePickCranes, LF = W.CranePickLift, GR = W.CranePickGround, CG = W.CranePickCraneGfx, M = W.CranePickModel;
const raw = n => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'smoke', `crane-fake-${n}.json`), 'utf8'));
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const E = (v, basis, ap) => ({ value: v, unit: 'ft', as_printed: ap || `${v} ft (fake)`, page: 2, basis: basis || 'printed' });
const GEO = { schema: 'crane-pick.geometry.v1', frame: 'fake', verify: 'fake',
  outriggers: { x_front: E(13), x_rear: E(11), spreads: { full: E(22), mid: E(15), retracted: E(9, 'scaled') }, float: { shape: 'square', size: E(2.5) } },
  carrier: { front: E(18), rear: E(16, 'derived'), width: E(9.5), axles: [E(8), E(3), E(-5, 'scaled')], tyre_d: E(4.8, 'scaled') },
  upper: { width: E(9, 'scaled'), cab: { side: 'right' } }, counterweight: { tail_radius: E(16), width: E(8.5, 'scaled'), depth: E(3, 'scaled') },
  boom_foot: { x: E(-6, 'scaled'), z: E(9, 'scaled') } };
const WH0 = K.parse(raw('wheeled')).crane, WHG = K.parse(Object.assign(raw('wheeled'), { geometry: GEO })).crane;
const grp = (c, id) => K.groups(c).find(g => Object.values(g.configs).some(x => x.id === id)).key;
const U = o => Object.assign({ x: 1000, y: 2000, heading: 90, group: grp(WH0, 'or-full-360'), boom: 60, mode: null, pad: 100 }, o);
const withPh = (c, ph) => { const d = JSON.parse(JSON.stringify(c)); d.app_inputs = Object.assign({}, d.app_inputs, { ph4: ph }); return d; };
const PH_A = { carrierLb: 40000, carrierCg: 0, upperLb: 30000, upperCg: 0, boomLb: 6000, cwRad: 10 };

test('G1 planDims: geometry printed / derived values replace the dims; scaled ones are never used; provenance geometry.*', () => {
  const p = K.planDims(WHG), p0 = K.planDims(WH0);
  assert.equal(p.geometry, true); assert.equal(p0.geometry, undefined);
  assert.equal(p.outr.xFront, 13); assert.equal(p.outr.xRear, 11); assert.equal(p.outr.spreads.full, 22); assert.equal(p.outr.spreads.mid, 15);
  assert.equal(p.outr.spreads.retracted, undefined, 'scaled spread not used'); assert.equal(p.outr.float, 2.5); assert.equal(p.outr.floatShape, 'square');
  assert.equal(JSON.stringify(p.body), JSON.stringify({ front: 18, rear: 16, width: 9.5 })); assert.equal(p.tail, 16);
  assert.equal(p.src['outr.xFront'].key, 'geometry.outriggers.x_front'); assert.equal(p.src['outr.xFront'].page, 2); assert.equal(p.src['body.rear'].basis, 'derived');
  // app_inputs.plan still overrides
  const o = JSON.parse(JSON.stringify(WHG)); o.app_inputs.plan = { outr: { xFront: 14 } }; assert.equal(K.planDims(o).outr.xFront, 14);
  // a wrong schema is ignored
  const bad = JSON.parse(JSON.stringify(WHG)); bad.geometry.schema = 'x'; assert.equal(K.planDims(bad).outr.xFront, 12);
});
test('G1 footprint: float centres at the geometry positions (hand check), square floats, ids FL FR RL RR', () => {
  const fp = LF.footprint(WHG, U());
  const want = { FL: [1013, 2011], FR: [1013, 1989], RL: [989, 2011], RR: [989, 1989] };
  assert.equal(JSON.stringify(fp.floatC.map(q => q.id)), JSON.stringify(['FL', 'FR', 'RL', 'RR']));
  fp.floatC.forEach(q => { near(q.x, want[q.id][0], 1e-9, q.id + ' x'); near(q.y, want[q.id][1], 1e-9, q.id + ' y'); assert.equal(q.shape, 'square'); });
  assert.equal(fp.floats[0].length, 4, 'square float polygon'); assert.equal(fp.drawOnly, false); assert.equal(fp.spread, 'full');
  const t = CG.floatTable(WHG, U(), 'EPSG:2249', null); assert.equal(t.length, 4); near(t[0].lx, 13, 1e-12); near(t[0].ly, 11, 1e-12); near(t[0].E, 1013, 1e-9); near(t[0].N, 2011, 1e-9);
});
test('G2 ground: float loads before (dims) and after (geometry) — hand check', () => {
  const run = c => { const d = withPh(c, PH_A), u = U({ heading: 0 }), S = GR.supports(d, u), inp = GR.inputsOf(d, u); return { S, r: GR.rigidAt(inp, S, 0, 30, 22000) }; };
  const b = run(WH0), a = run(WHG);
  near(b.r.V, 118000, 1e-6); near(b.r.X, 4.711864, 1e-6);
  near(b.r.load[0], 41083.33, 0.01, 'before front'); near(b.r.load[2], 17916.67, 0.01, 'before rear');
  assert.equal(a.S.xF, 13); assert.equal(a.S.xR, 11); assert.equal(a.S.b, 11); assert.equal(a.S.f, 2.5);
  near(a.r.load[0], 38625.00, 0.01, 'after front'); near(a.r.load[1], 38625.00, 0.01); near(a.r.load[2], 20375.00, 0.01, 'after rear'); near(a.r.load.reduce((s, v) => s + v, 0), 118000, 1e-6);
});
test('G3 drawn-only spread: floats drawn at the mid spread, flagged; supports stay at the chart spread', () => {
  const u = U({ spread: 'mid' }), fp = LF.footprint(WHG, u);
  assert.equal(fp.spread, 'mid'); assert.equal(fp.chartSpread, 'full'); assert.equal(fp.drawOnly, true);
  near(fp.floatC[0].ly, 7.5, 1e-12); near(fp.floatC[1].ly, -7.5, 1e-12);
  const ev = { path: { pts: [{ x: 1030, y: 2000 }] } }, cl = LF.clearances(WHG, u, ev, []);
  assert.ok(cl.some(f => f.kind === 'spread' && f.level === 'stop'));
  assert.equal(GR.supports(WHG, u).b, 11, 'ground at the chart spread');
  assert.equal(LF.footprint(WHG, U({ spread: 'retracted' })).drawOnly, false, 'a scaled (not used) spread is not offered');
  assert.equal(M.normSetup(U({ spread: 'mid' })).spread, 'mid'); assert.equal(M.normSetup(U()).spread, '');
});
test('G4 drawing: axles from the geometry (any basis), cab side, mats to scale, clearance dimension (hand check), dimension check', () => {
  const D = CG.dims(WHG); assert.equal(JSON.stringify(D.axles), JSON.stringify([8, 3, -5])); assert.equal(D.from.axles, 'file'); assert.equal(D.tyre.d, 4.8); assert.equal(D.upper.width, 9); assert.ok(D.cab.b0 < 0, 'cab right');
  assert.equal(D.mfrFoot.x, -6);
  const u = U({ ground: { mat: { type: 'timber', B: 4, L: 6, t: 12 } } }), sy = CG.symbol(WHG, u, {}), mats = sy.parts.filter(q => q.g === 'mat');
  assert.equal(mats.length, 4); const xs = mats[0].pts.map(p => p.x), ys = mats[0].pts.map(p => p.y);
  near(Math.max(...xs) - Math.min(...xs), 4, 1e-9, 'B along the carrier (heading 90: grid x)'); near(Math.max(...ys) - Math.min(...ys), 6, 1e-9, 'L across');
  const obst = { id: 'o1', type: 'obst', name: 'shed', pts: [{ x: 1020, y: 2005 }, { x: 1030, y: 2005 }, { x: 1030, y: 2015 }, { x: 1020, y: 2015 }] };
  const cd = CG.clearDims(WHG, U(), [obst]), fl = cd.find(r => r.from === 'FL');
  near(fl.d, 5.75, 1e-9, 'FL to the shed'); assert.ok(cd.find(r => r.from === 'TAIL'));
  const tl = cd.find(r => r.from === 'TAIL'); near(tl.d, 4.6155, 0.01, 'tail circle (16 ft) to the shed corner');
  const rows = CG.dimCheck(WHG, U()), r = rows.find(x => /Front float/.test(x.item));
  assert.equal(r.mfr, 13); assert.equal(r.ok, true); assert.equal(r.page, 2);
  assert.ok(rows.some(x => /Boom-foot/.test(x.item) && x.mfr === -6));
});
test('G5 crawler mats (count, width along the track) and stake-out CSV', () => {
  const CR = K.parse(raw('crawler')).crane, u = { x: 0, y: 0, heading: 0, group: K.groups(CR)[0].key, ground: { mat: { type: 'timber', B: 5, t: 12, w: 4, n: 6 } } };
  const m = CG.matsOf(CR, u, LF.footprint(CR, u)); assert.equal(m.rects.length, 12, '6 per track × 2');
  const P = { site: { zone: 'EPSG:2249' }, setups: [Object.assign({ id: 'u1', name: 'S1', craneId: 'c1' }, U())], picks: [{ id: 'k1', name: 'K1', setupId: 'u1', pick: { x: 1030, y: 2000 }, set: { x: 1000, y: 2030 } }] };
  const csv = CG.stakeoutCsv(P, null, () => WHG).trim().split('\r\n');
  assert.equal(csv.length, 1 + 1 + 4 + 2); assert.match(csv[1], /^"S1 CR"/); assert.match(csv[2], /"S1 FL".*1013\.000,2011\.000/);
});
