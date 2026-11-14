// shared/boussinesq.js (window.SharedBoussinesq): vertical stress increase below a footing (2026-11-14, Spread Footing
// "Stress below footing (Boussinesq)"). Hand cases a reviewer can redo, closed form vs numerical integration, symmetry,
// superposition, the far-field point-load limit, an independent brute-force sum of point loads, and Spread Footing's own
// bearing solver (solveBearing, read from the tool at test time) feeding the partial-contact integration.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test, loadShared, ROOT } from './harness.mjs';

const ctx = loadShared('steps.js', 'boussinesq.js');
const S = ctx.SharedBoussinesq, SS = ctx.SharedSteps;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);
const rel = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(Math.abs(b), 1e-12), `${msg}: ${a} vs ${b} (rel ${tol})`);
const RECT = (B, L) => [[-B / 2, -L / 2], [B / 2, -L / 2], [B / 2, L / 2], [-B / 2, L / 2]];

test('point load: Boussinesq 3Pz³/(2πR⁵); under the load 3P/(2πz²)', () => {
  near(S.pointLoad(100, 0, 10), 3 * 100 / (2 * Math.PI * 100), 1e-12, 'r = 0');
  near(S.pointLoad(100, 10, 10), 3 * 100 * 1000 / (2 * Math.PI * Math.pow(200, 2.5)), 1e-12, 'r = z');
});

test('corner factor I(m, n): GEC 6 Fig. 5-11 chart readings and the limits', () => {
  // Readings from FHWA GEC 6 (2002) Fig. 5-11 (Newmark's chart), within the chart's reading accuracy
  for (const [m, n, f] of [[1, 1, 0.175], [2, 2, 0.232], [0.5, 0.5, 0.084], [1, 2, 0.200], [0.25, 0.25, 0.027], [3, 3, 0.244]]) near(S.cornerFactor(m, n), f, 0.002, `I(${m}, ${n})`);
  near(S.cornerFactor(1, 1), 0.1752215, 1e-6, 'I(1,1) to 7 places');
  near(S.cornerFactor(Infinity, Infinity), 0.25, 1e-15, 'I(∞, ∞)');
  near(S.cornerFactor(1e7, 1e7), 0.25, 1e-9, 'I(large, large)');
  near(S.cornerFactor(1e8, 1), S.cornerFactor(Infinity, 1), 1e-8, 'I(∞, 1): the strip limit');
  near(S.cornerFactor(0.5, 3), S.cornerFactor(3, 0.5), 1e-15, 'I(m, n) = I(n, m)');
  assert.equal(S.cornerFactor(0, 1), 0);
  // the atan2 branch: m²n² > m² + n² + 1 (e.g. m = n = 2) is continuous across m²n² = V
  const a = S.cornerFactor(1.553, 1.553), b = S.cornerFactor(1.554, 1.554); assert.ok(b > a && b - a < 1e-3, 'continuous across the branch');
});

test('hand check: square B = L = 10 ft, q = 3 ksf, centre at z = 5, 10, 20 ft and corner at z = 10 ft', () => {
  const q = 3, B = 10, L = 10;
  // centre: four 5 × 5 corner rectangles, m = n = 5/z
  near(S.uniformRect(q, B, L, 0, 0, 5), 4 * q * S.cornerFactor(1, 1), 1e-12, 'centre z = 5');
  near(S.uniformRect(q, B, L, 0, 0, 5), 2.1027, 5e-5, 'centre z = 5 = 2.1027 ksf (0.7009 q)');
  near(S.uniformRect(q, B, L, 0, 0, 10), 1.0083, 5e-5, 'centre z = 10 = 1.0083 ksf (0.3361 q)');
  near(S.uniformRect(q, B, L, 0, 0, 20), 0.3242, 5e-5, 'centre z = 20 = 0.3242 ksf (0.1081 q)');
  near(S.uniformRect(q, B, L, 5, 5, 10), 0.5257, 5e-5, 'corner z = 10 = q·I(1, 1) = 0.5257 ksf');
  // 2:1 (GEC 6 Eq. 5-17), centre, z = 10: 3·100/(20·20) = 0.75 ksf
  near(S.twoToOne(q * B * L, B, L, 10), 0.75, 1e-12, '2:1 at z = 10');
});

test('AASHTO LRFD 10th Fig. 10.6.2.4.1-1(b) (square footing): the 0.2q and 0.1q isobars cross the centreline near 1.25B and 2B', () => {
  const depth = f => { let lo = 0.01, hi = 50; for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (S.uniformRect(1, 1, 1, 0, 0, m) > f) lo = m; else hi = m; } return lo; };
  const z2 = depth(0.2), z1 = depth(0.1);
  assert.ok(z2 > 1.1 && z2 < 1.5, `0.2q at ${z2}B`);
  assert.ok(z1 > 1.9 && z1 < 2.3, `0.1q at ${z1}B`);
});

test('symmetry: uniform and linear loads about both axes; square: x ↔ y', () => {
  for (const [x, y, z] of [[1.3, 2.2, 3], [6, 0.5, 2], [-7, 8, 12], [2.4, -1.1, 0.2]]) {
    const u = S.uniformRect(2, 8, 12, x, y, z);
    near(S.uniformRect(2, 8, 12, -x, y, z), u, 1e-12, 'mirror x'); near(S.uniformRect(2, 8, 12, x, -y, z), u, 1e-12, 'mirror y');
    near(S.uniformRect(2, 10, 10, x, y, z), S.uniformRect(2, 10, 10, y, x, z), 1e-12, 'square x ↔ y');
    // linear: q0 + gx·x: the antisymmetric part changes sign with x → Δσ(x) + Δσ(−x) = 2·q0·I_u(x)
    const ld = { B: 8, L: 12, q0: 2, gx: 0.15, gy: 0 };
    near(S.linearRect(ld, x, y, z).value + S.linearRect(ld, -x, y, z).value, 2 * S.uniformRect(2, 8, 12, x, y, z), 1e-12, 'linear antisymmetry');
  }
});

test('superposition: the footing split into two halves gives the whole (closed form and numeric)', () => {
  const B = 10, L = 6;
  for (const [x, y, z] of [[0, 0, 3], [4, 1, 1.5], [9, -5, 7], [-2.5, 0, 0.4]]) {
    // halves [−5, 0] and [0, 5] in x: shifted centred rectangles of width 5
    const h = S.uniformRect(1, 5, L, x + 2.5, y, z) + S.uniformRect(1, 5, L, x - 2.5, y, z);
    near(h, S.uniformRect(1, B, L, x, y, z), 1e-12, 'uniform halves');
    const p = S.polygonLinear([[-5, -3], [0, -3], [0, 3], [-5, 3]], 2, 0.3, -0.2, x, y, z) + S.polygonLinear([[0, -3], [5, -3], [5, 3], [0, 3]], 2, 0.3, -0.2, x, y, z);
    rel(p, S.linearRect({ B, L, q0: 2, gx: 0.3, gy: -0.2 }, x, y, z).value, 1e-7, 'linear halves (numeric) = whole (closed form)');
  }
});

test('numerical integration (polygon) reproduces the closed forms on the rectangle: uniform < 0.5 % (actually < 1e-6), linear < 1e-6', () => {
  const B = 10, L = 7, q0 = 3, gx = 0.25, gy = -0.12;
  let worst = 0, n = 0;
  for (const x of [-9, -5, -4.9, -2, 0, 1.7, 4.99, 5, 5.01, 8]) for (const y of [-6, -3.5, 0, 1, 3.4, 5]) for (const z of [0, 0.02, 0.5, 2, 5, 10, 40]) {
    const cu = S.uniformRect(q0, B, L, x, y, z), nu = S.polygonLinear(RECT(B, L), q0, 0, 0, x, y, z);
    const cl = S.linearRect({ B, L, q0, gx, gy }, x, y, z).value, nl = S.polygonLinear(RECT(B, L), q0, gx, gy, x, y, z);
    worst = Math.max(worst, Math.abs(nu - cu) / q0, Math.abs(nl - cl) / q0); n++;
    assert.ok(Math.abs(nu - cu) <= 0.005 * Math.max(cu, 1e-3 * q0), `uniform ${x},${y},${z}: ${nu} vs ${cu}`);
  }
  assert.ok(worst < 1e-6, 'worst |numeric − closed form| / q = ' + worst + ' over ' + n + ' points');
});

test('independent check: a brute-force sum of point loads (midpoint rule) matches the closed forms (< 0.5 %)', () => {
  const B = 10, L = 6, q0 = 3, gx = 0.3, gy = 0.1, N = 300, dx = B / N, dy = L / N;
  for (const [x, y, z] of [[0, 0, 4], [5, 3, 6], [8, -2, 3], [2, 1, 10]]) {
    let su = 0, sl = 0;
    for (let i = 0; i < N; i++) { const xi = -B / 2 + (i + 0.5) * dx; for (let j = 0; j < N; j++) { const yj = -L / 2 + (j + 0.5) * dy;
      const k = S.pointLoad(dx * dy, Math.hypot(xi - x, yj - y), z); su += q0 * k; sl += (q0 + gx * xi + gy * yj) * k; } }
    rel(su, S.uniformRect(q0, B, L, x, y, z), 0.005, `uniform ${x},${y},${z}`);
    rel(sl, S.linearRect({ B, L, q0, gx, gy }, x, y, z).value, 0.005, `linear ${x},${y},${z}`);
  }
});

test('far field: Δσ → the point-load value of the total load (z = 200B, < 0.1 %)', () => {
  const B = 10, L = 6, q = 2, z = 2000;
  rel(S.uniformRect(q, B, L, 0, 0, z), S.pointLoad(q * B * L, 0, z), 1e-3, 'uniform, below the centre');
  rel(S.uniformRect(q, B, L, 300, -200, z), S.pointLoad(q * B * L, Math.hypot(300, 200), z), 1e-3, 'uniform, off the centre');
  rel(S.polygonLinear([[-5, -3], [5, -3], [5, 0], [-5, 3]], q, 0.1, 0, 0, 0, z), S.pointLoad(q * 45 + 0.1 * 45 * (-5 / 9), 0, z), 1e-3, 'polygon: trapezoid of area 45 ft², centroid x = −5/9 ft, load 2·45 + 0.1·(−25) = 87.5');
});

test('partial contact, uniaxial (triangular pressure): numeric over the clipped area = closed form on the contact rectangle', () => {
  // B = L = 10, P = 300 kip, e_x = 2.5 ft (6e/B = 1.5 > 1): contact 3(B/2 − e) = 7.5 ft, q_max = 2P/(3(B/2 − e)L) = 8 ksf at x = +5
  const B = 10, L = 10, gx = 8 / 7.5, q0 = 8 - gx * 5;   // q = 0 at x = −2.5
  const poly = S.clipContact(B, L, q0, gx, 0);
  near(poly.reduce((a, p, i) => a + p[0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * p[1], 0) / 2, 75, 1e-9, 'contact area 7.5 × 10');
  for (const [x, y, z] of [[5, 0, 5], [0, 0, 5], [1.25, 0, 10], [-4, 3, 2], [5, 5, 0.5]]) {
    const xc = 1.25, closed = S.linearRect({ B: 7.5, L, q0: q0 + gx * xc, gx, gy: 0 }, x - xc, y, z).value;
    rel(S.stress({ B, L, q0, gx, gy: 0, mode: 'partial' }, x, y, z).value, closed, 1e-6, `${x},${y},${z}`);
  }
  // statics: the far-field value carries the total load P = 300 kip
  rel(S.stress({ B, L, q0, gx, gy: 0, mode: 'partial' }, 0, 0, 5000).value, S.pointLoad(300, 0, 5000), 2e-3, 'far field = P');
});

test('net basis: the overburden removed over B × L is subtracted (uniform q − q_sur gives (q − q_sur)·I_u)', () => {
  const r = S.stress({ B: 10, L: 10, q0: 3.48, gx: 0, gy: 0, qsub: 0.48 }, 0, 0, 10);
  near(r.value, 3 * 4 * S.cornerFactor(0.5, 0.5), 1e-12, 'net = 3 ksf');
  near(r.sub, 0.48 * 4 * S.cornerFactor(0.5, 0.5), 1e-12, 'removed');
  assert.equal(r.method, 'uniform');
  assert.equal(S.stress({ B: 10, L: 10, q0: 3, gx: 0.1, gy: 0 }, 1, 1, 1).method, 'linear');
});

test('Spread Footing solveBearing (read from the tool): biaxial partial contact, the integration carries P, matches a full-contact closed form and the brute force', () => {
  const html = fs.readFileSync(path.join(ROOT, 'Spread Footing.html'), 'utf8');
  const grab = name => { const i = html.indexOf('function ' + name + '('); assert.ok(i > 0, name); let d = 0, k = html.indexOf('{', i);
    for (; k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}') { d--; if (!d) break; } } return html.slice(i, k + 1); };
  const c = {}; vm.createContext(c); vm.runInContext(grab('solve3') + '\n' + grab('solveBearing'), c);
  // full contact: P = 300 kip, e_x = 1 ft on 10 × 10 (the PR's eccentric hand check)
  const f = c.solveBearing(300, 1, 0, 10, 10);
  assert.equal(f.mode, 'full'); near(f.plane.q0, 3, 1e-12, 'q0'); near(f.plane.gx, 0.36, 1e-12, 'gx');
  const r1 = S.stress({ B: 10, L: 10, q0: f.plane.q0, gx: f.plane.gx, gy: f.plane.gy, mode: 'full' }, 5, 0, 5);
  near(r1.value, 1.561, 5e-4, 'eccentric hand check: below the high edge (5, 0), z = 5 ft');
  near(S.stress({ B: 10, L: 10, q0: 3, gx: 0.36, gy: 0 }, 0, 0, 5).value, 2.1027, 5e-5, 'below the centre: as uniform (J_u = 0)');
  // biaxial partial contact
  const p = c.solveBearing(400, 1.6, 1.2, 10, 8);
  assert.equal(p.mode, 'partial');
  const ld = { B: 10, L: 8, q0: p.plane.q0, gx: p.plane.gx, gy: p.plane.gy, mode: 'partial', poly: p.contactPoly };
  const mine = S.clipContact(10, 8, p.plane.q0, p.plane.gx, p.plane.gy);
  assert.equal(mine.length, p.contactPoly.length, 'same contact polygon as the tool');
  mine.forEach((v, i) => { near(v[0], p.contactPoly[i][0], 1e-12, 'x'); near(v[1], p.contactPoly[i][1], 1e-12, 'y'); });
  rel(S.stress(ld, 0, 0, 8000).value, S.pointLoad(400, 0, 8000), 2e-3, 'far field = P (the solver equilibrates P on the contact area)');
  // brute force over the footing with max(0, plane)
  const N = 300, dx = 10 / N, dy = 8 / N;
  for (const [x, y, z] of [[3, 2, 4], [0, 0, 6], [-4, -3, 3]]) {
    let s = 0; for (let i = 0; i < N; i++) { const xi = -5 + (i + 0.5) * dx; for (let j = 0; j < N; j++) { const yj = -4 + (j + 0.5) * dy;
      const q = Math.max(0, p.plane.q0 + p.plane.gx * xi + p.plane.gy * yj); if (q > 0) s += q * S.pointLoad(dx * dy, Math.hypot(xi - x, yj - y), z); } }
    rel(S.stress(ld, x, y, z).value, s, 0.005, `brute force ${x},${y},${z}`);
  }
});

test('worked point query (querySteps): the steps reproduce the value and are valid SharedSteps steps', () => {
  for (const [ld, x, y, z, basis] of [
    [{ B: 10, L: 10, q0: 3.48, gx: 0, gy: 0, qsub: 0.48 }, 0, 0, 10, 'net'],
    [{ B: 10, L: 10, q0: 3, gx: 0.36, gy: 0 }, 5, 0, 5, 'gross'],
    [{ B: 10, L: 10, q0: 8 - 8 / 7.5 * 5, gx: 8 / 7.5, gy: 0, mode: 'partial' }, 2, 1, 3, 'gross']]) {
    const q = S.querySteps(ld, x, y, z, { basis, qRef: 3 });
    const st = q.steps.map(o => SS.step(o));
    const last = st.find(s => s.id === 'bq.ds');
    near(last.value, S.stress(ld, x, y, z).value, 1e-12, 'Δσ_z step');
    const Iu = st.find(s => s.id === 'bq.Iu'); near(Iu.value, S.rectTerms(ld.B, ld.L, x, y, z).I, 1e-15, 'I_u step');
    near(st.find(s => s.id === 'bq.rat').value, last.value / 3, 1e-12, 'ratio');
  }
});
