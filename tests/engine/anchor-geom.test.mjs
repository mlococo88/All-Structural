// shared/anchor-geom.js (window.SharedAnchorGeom): exact circle geometry for the Base Plate & Anchor Designer
// bolt-circle pattern and circular pier (2026-11-01). Closed-form checks a reviewer can redo by hand.
import assert from 'node:assert/strict';
import { test, loadShared } from './harness.mjs';

const G = loadShared('anchor-geom.js').SharedAnchorGeom;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('circlePoints: 4 bolts at 45° on BC = 12√2 are the 2×2 grid at ±6 in', () => {
  const P = G.circlePoints(4, 12 * Math.SQRT2, 45);
  const want = [[6, 6], [-6, 6], [-6, -6], [6, -6]];
  P.forEach((p, i) => { near(p.x, want[i][0], 1e-12, 'x' + i); near(p.y, want[i][1], 1e-12, 'y' + i); });
  // 8 bolts at 22.5° on BC 20: first point (10cos22.5°, 10sin22.5°) = (9.2388, 3.8268)
  const Q = G.circlePoints(8, 20, 22.5); near(Q[0].x, 9.238795, 1e-6, 'x'); near(Q[0].y, 3.826834, 1e-6, 'y');
  assert.equal(G.circlePoints(6, 16, 0)[0].y, 0);
});

test('rectDiscArea: whole disc, half disc, quarter, inner square, a thin strip', () => {
  const R = 18;
  near(G.rectDiscArea(-50, 50, -50, 50, 0, 0, R), Math.PI * R * R, 1e-9, 'whole disc 1017.876');
  near(G.rectDiscArea(0, 50, -50, 50, 0, 0, R), Math.PI * R * R / 2, 1e-9, 'half');
  near(G.rectDiscArea(0, 50, 0, 50, 0, 0, R), Math.PI * R * R / 4, 1e-9, 'quarter');
  near(G.rectDiscArea(-10, 10, -10, 10, 0, 0, R), 400, 1e-9, 'square inside');
  // inscribed square of side R√2 has area 2R² (corners on the circle)
  near(G.rectDiscArea(-R / Math.SQRT2, R / Math.SQRT2, -R / Math.SQRT2, R / Math.SQRT2, 0, 0, R), 2 * R * R, 1e-9, 'inscribed');
  // circular segment beyond x = 12: R²acos(d/R) − d·sqrt(R² − d²), d = 12 → 324·0.841069 − 12·13.416408 = 111.5089
  const seg = R * R * Math.acos(12 / R) - 12 * Math.sqrt(R * R - 144);
  near(G.rectDiscArea(12, 40, -40, 40, 0, 0, R), seg, 1e-9, 'segment');
  near(seg, 111.5089, 1e-3, 'segment value');
  // off-centre disc: same as shifting the rectangle
  near(G.rectDiscArea(5, 30, -3, 40, 5, -3, R), Math.PI * R * R / 4 * 2 / 2, 1e-9, 'shifted quarter-of-half');
  // numerical check against a fine grid on an awkward rectangle
  const [x1, x2, y1, y2] = [-7.3, 16.1, 4.2, 30];
  let g = 0; const N = 2000, dx = (x2 - x1) / N, dy = (y2 - y1) / N;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const x = x1 + (i + 0.5) * dx, y = y1 + (j + 0.5) * dy; if (x * x + y * y < R * R) g += dx * dy; }
  near(G.rectDiscArea(x1, x2, y1, y2, 0, 0, R), g, 0.05, 'grid');
});

test('unionRectsDiscArea: overlapping squares of two tension bolts clipped by a Ø36 pier', () => {
  // C1 geometry with h_ef' = 8: tension bolts (6, ±6), squares 1.5h_ef' = 12 each way → [−6,18]×[−18,6] ∪ [−6,18]×[−6,18]
  const sq = [[-6, 18, -18, 6], [-6, 18, -6, 18]];
  const u = G.unionRectsDiscArea(sq, 0, 0, 18);
  // union = [−6,18]×[−18,18] ∩ disc = half disc + strip −6 < x < 0: 508.938 + 2∫₀⁶ sqrt(324 − u²)du
  const strip = 2 * (0.5 * (6 * Math.sqrt(324 - 36) + 324 * Math.asin(6 / 18)));
  near(u.area, Math.PI * 324 / 2 + strip, 1e-9, 'union ∩ disc');
  near(u.area, 508.938 + 211.930, 2e-3, 'value 720.868 (strip = 6·16.9706 + 324·asin(1/3) = 101.823 + 110.107)');
  // all four bolts, squares 12 each way → [−18,18]² ⊇ disc → the full disc 1017.876 in²
  const all = [[-18, 6, -18, 6], [-6, 18, -18, 6], [-18, 6, -6, 18], [-6, 18, -6, 18]];
  near(G.unionRectsDiscArea(all, 0, 0, 18).area, Math.PI * 324, 1e-9, 'four squares');
});

test('edge distances to a circle: ray, radial, support, tangent edge', () => {
  near(G.rayToCircle(6, 6, 1, 0, 0, 0, 18), Math.sqrt(324 - 36) - 6, 1e-12, 'ray (6,6)→+x = 10.9706');
  near(G.radialEdge(6, 6, 0, 0, 18), 18 - 6 * Math.SQRT2, 1e-12, 'radial 9.5147');
  const pts = G.circlePoints(4, 12 * Math.SQRT2, 45);
  near(G.supportEdge(pts, 1, 0, 0, 0, 18), 12, 1e-12, 'support along +x: 18 − 6');
  near(G.supportEdge(pts, Math.SQRT1_2, Math.SQRT1_2, 0, 0, 18), 18 - 6 * Math.SQRT2, 1e-12, 'support on the diagonal');
  const t = G.tangentEdge(6, 6, 1, 0, 0, 0, 18);
  // E = (16.9706, 6), n = E/18, c = 18 − (6·16.9706 + 6·6)/18 = 18 − 7.6569 = 10.3431
  near(t.c, 18 - (6 * Math.sqrt(288) + 36) / 18, 1e-12, 'tangent-edge c');
  assert.ok(t.c <= t.ray + 1e-12);
  const t0 = G.tangentEdge(0, 0, 0, 1, 0, 0, 18); near(t0.c, 18, 1e-12, 'centre'); near(t0.cosB, 1, 1e-12, 'normal');
});
