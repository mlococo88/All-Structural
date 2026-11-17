// Crane Pick Analyzer (apps/crane-pick): "Align to map (2 points)" (engineer request 2026-11-17) — the 2-D similarity transform that
// takes two sheet points A, B (px) to two map points A′, B′ (grid ft): engine/geo.js align2() (the solve is georef()'s), its worked steps
// (engine/worked.js align()), the optional sheet.align field (engine/model.js normSheet) and reproject(). Node only.
//   node tests/engine/run.mjs crane
import assert from 'node:assert/strict';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps', 'crane-pick', 'engine');
const W = loadShared(path.join(ROOT, 'tests', 'libs', 'proj4@2.11.0', 'dist', 'proj4.js'), 'steps.js',
  path.join(APP, 'geo.js'), path.join(APP, 'osha.js'), path.join(APP, 'worked.js'), path.join(APP, 'model.js'));
const G = W.CranePickGeo, WK = W.CranePickWorked, M = W.CranePickModel;
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const D = Math.PI / 180;

test('align2 hand case: A(0,0) B(100,0) px -> A′(1000,2000) B′(1000,2050) ft: s 0.5, θ 90°, a third point', () => {
  // d_px = 100, L_m = 50 -> s = 50 / 100 = 0.5 ft/px. Sheet +x (A->B) is grid east in pixel axes "up positive": atan2(0, 100) = 0;
  // A′->B′ points grid north: atan2(50, 0) = 90° -> θ = 90° − 0 = 90°. o = A′ − s·R(90°)·(0, 0) = (1000, 2000).
  // Third point C = pixel (0, 40) (40 px DOWN the sheet, u = (0, −40)): R(90°)·(0, −40) = (40, 0) -> C′ = (1000 + 0.5·40, 2000) = (1020, 2000).
  // The sheet's up (pixel −y, u = (0, 1)) -> R(90°)·(0, 1) = (−1, 0): grid west, azimuth 270° = −θ.
  const r = G.align2({ px: 0, py: 0 }, { px: 100, py: 0 }, { x: 1000, y: 2000 }, { x: 1000, y: 2050 }, 1000, 800);
  near(r.s, 0.5, 1e-12, 's'); near(r.rot / D, 90, 1e-10, 'θ'); near(r.dpx, 100, 1e-12); near(r.dft, 50, 1e-12);
  near(r.place.x, 1000, 1e-9); near(r.place.y, 2000, 1e-9); near(r.upAz, 270, 1e-9, 'sheet up -> azimuth 270°');
  const A = G.pxToFt(r.place, 0, 0), B = G.pxToFt(r.place, 100, 0), C = G.pxToFt(r.place, 0, 40);
  near(A.x, 1000, 1e-9); near(A.y, 2000, 1e-9); near(B.x, 1000, 1e-9); near(B.y, 2050, 1e-9);
  near(C.x, 1020, 1e-9, 'C′ x'); near(C.y, 2000, 1e-9, 'C′ y');
  near(r.frac, 0.1, 1e-12, '100 px of a 1000 px sheet'); assert.equal(r.close, false);
});

test('align2: the "points too close" flag at 5 % of the sheet\'s longer side', () => {
  const m1 = { x: 0, y: 0 }, m2 = { x: 10, y: 0 };
  assert.equal(G.align2({ px: 0, py: 0 }, { px: 119, py: 0 }, m1, m2, 2400, 1600).close, true, '119 / 2400 = 4.96 %');
  assert.equal(G.align2({ px: 0, py: 0 }, { px: 120, py: 0 }, m1, m2, 2400, 1600).close, false, '120 / 2400 = 5 %');
  assert.equal(G.ALIGN_CLOSE, 0.05);
});

test('align2 round trip: random similarity transforms are recovered (scale, rotation, origin), any two points map exactly', () => {
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = 0; k < 200; k++) {
    const T = { x: 7e5 + rnd() * 1e5, y: 2.9e6 + rnd() * 1e5, s: 0.01 + rnd() * 2, rot: G.normRot((rnd() * 2 - 1) * Math.PI) };
    const p1 = { px: rnd() * 5000, py: rnd() * 3000 }, p2 = { px: rnd() * 5000, py: rnd() * 3000 };
    if (Math.hypot(p2.px - p1.px, p2.py - p1.py) < 10) continue;
    const r = G.align2(p1, p2, G.pxToFt(T, p1.px, p1.py), G.pxToFt(T, p2.px, p2.py), 5000, 3000);
    near(r.s, T.s, 1e-9 * T.s, 's'); near(G.normRot(r.rot - T.rot), 0, 1e-9, 'θ'); near(r.place.x, T.x, 1e-5); near(r.place.y, T.y, 1e-5);
    const q = { px: rnd() * 5000, py: rnd() * 3000 }, a = G.pxToFt(r.place, q.px, q.py), b = G.pxToFt(T, q.px, q.py);
    near(a.x, b.x, 1e-5); near(a.y, b.y, 1e-5);
    near(r.upAz, ((-T.rot / D) % 360 + 360) % 360, 1e-7, 'up azimuth = −θ');
    const back = G.ftToPx(r.place, a.x, a.y); near(back.px, q.px, 1e-6); near(back.py, q.py, 1e-6);
  }
  // rotation sign: sheet +x turned to grid NE (45° CCW), scale 2
  const r = G.align2({ px: 0, py: 0 }, { px: 10, py: 0 }, { x: 0, y: 0 }, { x: 20 / Math.SQRT2, y: 20 / Math.SQRT2 }, 100, 100);
  near(r.rot / D, 45, 1e-10); near(r.s, 2, 1e-12); near(r.upAz, 315, 1e-9);
});

test('align2: degenerate points are rejected (same sheet point, same map point, < 1 px, < 0.01 ft, not numbers)', () => {
  const a = { px: 10, py: 10 }, m1 = { x: 0, y: 0 }, m2 = { x: 50, y: 0 };
  assert.equal(G.align2(a, { px: 10, py: 10 }, m1, m2, 100, 100), null, 'same sheet point');
  assert.equal(G.align2(a, { px: 10.5, py: 10.5 }, m1, m2, 100, 100), null, '0.71 px < 1 px');
  assert.equal(G.align2(a, { px: 90, py: 10 }, m1, { x: 0, y: 0 }, 100, 100), null, 'same map point');
  assert.equal(G.align2(a, { px: 90, py: 10 }, m1, { x: 0.005, y: 0.005 }, 100, 100), null, '0.007 ft < 0.01 ft');
  assert.equal(G.align2(a, { px: 90, py: NaN }, m1, m2, 100, 100), null, 'NaN');
  assert.equal(G.align2(a, null, m1, m2, 100, 100), null, 'missing');
  assert.ok(G.align2(a, { px: 11, py: 10 }, m1, { x: 0.01, y: 0 }, 100, 100), '1 px and 0.01 ft: accepted');
});

test('align worked steps (hand case) and the kept reference scale; KaTeX of every step', async () => {
  const sheet = { w: 2400, h: 1600, align: { p1: { px: 0, py: 0 }, p2: { px: 100, py: 0 }, m1: { x: 1000, y: 2000 }, m2: { x: 1000, y: 2050 }, keep: 'pts' } };
  const w = WK.align(sheet, 'sh1.al'), v = id => w.steps.find(s => s.id === 'sh1.al.' + id).value;
  near(v('dpx'), 100, 1e-12); near(v('Lm'), 50, 1e-12); near(v('s'), 0.5, 1e-12); near(v('rot'), 90, 1e-10); near(v('ox'), 1000, 1e-9); near(v('oy'), 2000, 1e-9);
  assert.equal(w.chk, null);
  // reference scale 0.55 ft/px (a calibration): (0.55 − 0.5) / 0.5 = +10 %; kept: A, B miss by |50 − 0.55·100| / 2 = 2.50 ft each
  const w2 = WK.align(Object.assign({}, sheet, { align: Object.assign({}, sheet.align, { keep: 'ref' }) }), 'sh1.al', 0.55);
  near(w2.chk, 0.1, 1e-12); assert.match(w2.steps.find(s => s.id === 'sh1.al.keep').note, /2\.50 ft/);
  assert.equal(WK.align({ w: 10, h: 10 }, 'x'), null);
  const { createRequire } = await import('node:module');
  const katex = createRequire(import.meta.url)(path.join(ROOT, 'tests/libs/katex@0.16.9/dist/katex.min.js'));
  const parse = t => katex.renderToString(t, { ...W.SharedSteps.katexOpt, throwOnError: true, strict: 'error' });
  let k = 0;
  for (const s of w2.steps) { for (const f of ['sym', 'eq', 'sub']) if (s[f]) { parse(s[f]); k++; } if (s.unit) { parse(W.SharedSteps.unitTeX(s.unit)); k++; }
    assert.ok(!/NaN|undefined/.test(W.SharedSteps.toText([s])), s.id); }
  assert.ok(k > 15, String(k));
});

test('saved data: sheet.align is optional (older projects read unchanged), kept and checked by normSheet; reproject moves its map points', () => {
  const old = { id: 's1', name: 'Old', w: 100, h: 50, place: { x: 1, y: 2, s: 0.1, rot: 0 }, basis: 'geo' };
  const n0 = M.normSheet(old); assert.equal('align' in n0, false, 'no align field added to an older sheet'); assert.equal(n0.basis, 'geo');
  const al = { p1: { px: 1, py: 2 }, p2: { px: 90, py: 40 }, m1: { x: 10, y: 20 }, m2: { x: 30, y: 25 }, keep: 'ref' };
  const n1 = M.normSheet(Object.assign({}, old, { basis: 'align', align: al })); assert.deepEqual(JSON.parse(JSON.stringify(n1.align)), al); assert.equal(n1.basis, 'align');
  assert.equal('align' in M.normSheet(Object.assign({}, old, { align: { p1: al.p1 } })), false, 'an incomplete align is dropped');
  assert.equal(M.normSheet(Object.assign({}, old, { align: Object.assign({}, al, { keep: 'x' }) })).align.keep, 'pts');
  assert.ok(M.BASIS.align && M.BASIS.geo && M.BASIS.cal && M.BASIS.plan && M.BASIS.none);
  // reproject: the sheet keeps its place on the ground; the map points move with it (pixel A still lands on A′)
  const P = M.normalize({ format: M.FORMAT, site: { zone: 'EPSG:2249' }, sheets: [] });
  const A2 = { x: 775000, y: 2956000 }, B2 = { x: 775100, y: 2956050 }, r = G.align2({ px: 100, py: 100 }, { px: 1300, py: 700 }, A2, B2, 2400, 1600);
  P.sheets = [M.normSheet({ id: 's2', name: 'S', w: 2400, h: 1600, place: r.place, basis: 'align', align: { p1: { px: 100, py: 100 }, p2: { px: 1300, py: 700 }, m1: A2, m2: B2 } })];
  const Q = G.reproject(W.proj4, P, 'EPSG:2234'), s = Q.sheets[0], a = G.pxToFt(s.place, 100, 100), b = G.pxToFt(s.place, 1300, 700);
  near(a.x, s.align.m1.x, 0.01); near(a.y, s.align.m1.y, 0.01); near(b.x, s.align.m2.x, 0.01); near(b.y, s.align.m2.y, 0.01);
  assert.ok(Math.abs(s.align.m1.x - A2.x) > 1000, 'the map points were converted to the new zone');
});
