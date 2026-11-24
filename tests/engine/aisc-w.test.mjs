// shared/aisc-w.js (window.SharedAiscW): the AISC W shapes as data (2026-11-23, rolled-beam girders of Steel Bridge Design).
//   1. the table is the W table of "Steel Beam Design - AISC 15th.html" (AISC Shapes Database v16.0), value for value (the copies are
//      kept in step, CLAUDE.md §3: a change in one file without the other fails here);
//   2. every row is cross-checked against its own dimensions, to catch a typo in a dimension or a property:
//        plates plus fillets: A_f = 2 b_f t_f + (d - 2 t_f) t_w + 4 (1 - pi/4) r^2,  r = k_des - t_f (the fillet as a quarter-circle
//        spandrel of radius r in each web-flange corner; its centroid 0.2234 r from the corner),
//        I_f = 2 [b_f t_f^3/12 + b_f t_f ((d - t_f)/2)^2] + t_w (d - 2 t_f)^3/12 + 4 (1 - pi/4) r^2 ((d - 2 t_f)/2 - 0.2234 r)^2
//      tolerance (stated): A_f within 1.0 % and I_f within 1.2 % of the tabulated A and I_x (the tabulated dimensions are rounded to
//      3 figures; the largest differences found are 0.73 % and 0.97 %);
//      the three plates alone (no fillets), as Steel Bridge Design takes a rolled shape: A_3/A between 0.970 and 1.006, I_3/I_x between
//      0.955 and 1.008 (found: 0.9728 to 1.0052 and 0.9593 to 1.0071);
//      nominal weight W against A x 490/144: within 1.6 % (found: -1.45 % to +0.95 %);
//   3. hand case W36X135 (AISC Manual Table 1-1: d 35.6, b_f 12.0, t_f 0.790, t_w 0.600, k_des 1.54, A 39.9, I_x 7800, 135 lb/ft).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const A = loadShared('aisc-w.js').SharedAiscW;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('table: 289 W shapes, names unique, lookup by any spelling, groups by nominal depth', () => {
  assert.equal(A.ROWS.length, 289);
  assert.equal(new Set(A.names()).size, 289);
  assert.ok(A.ROWS.every(r => r.length === A.COLS.length && /^W\d+(\.\d+)?X\d+(\.\d+)?$/.test(r[0]) && r.slice(1).every(v => typeof v === 'number' && v > 0)));
  assert.equal(A.get('w 36 x 135').name, 'W36X135');
  assert.equal(A.get('W36x135').nom, 36);
  assert.equal(A.get('W99X999'), null); assert.equal(A.get(null), null); assert.equal(A.get(36), null);
  const G = A.groups();
  assert.deepEqual(Array.from(G, g => g.nom), [44, 40, 36, 33, 30, 27, 24, 21, 18, 16, 14, 12, 10, 8, 6, 5, 4]);
  assert.equal(G.reduce((a, g) => a + g.names.length, 0), 289);
  // nominal weight in the name = W
  A.names().forEach(n => near(+n.split('X')[1], A.get(n).W, 1e-9, n + ' weight in the name'));
});

test('same values as the W table of Steel Beam Design - AISC 15th.html (AISC Shapes Database v16.0)', () => {
  const t = fs.readFileSync(path.join(ROOT, 'Steel Beam Design - AISC 15th.html'), 'utf8');
  assert.match(t, /const DBVER="AISC Shapes Database v16\.0";/); assert.equal(A.VERSION, 'AISC Shapes Database v16.0');
  const keys = JSON.parse(/const DBKEYS=(\{.*?\});/.exec(t)[1]).I, i0 = t.indexOf('const DB={W:[['), i1 = t.indexOf(']],M:[[', i0);
  const W = JSON.parse(t.slice(i0 + 'const DB={W:'.length, i1 + 2)), col = { name: 'lbl', W: 'Wt' };
  assert.equal(W.length, A.ROWS.length);
  W.forEach((r, i) => A.COLS.forEach((c, j) => assert.equal(A.ROWS[i][j], r[keys.indexOf(col[c] || c)], `${r[0]} ${c}`)));
});

test('every shape: tabulated A, I_x and W against its own plate dimensions (plates plus fillets; three plates)', () => {
  const lim = { Af: [1, 1], If: [1, 1], A3: [1, 1], I3: [1, 1], W: [1, 1] }, up = (k, v) => { lim[k][0] = Math.min(lim[k][0], v); lim[k][1] = Math.max(lim[k][1], v); };
  A.names().forEach(n => { const s = A.get(n), hw = s.d - 2 * s.tf, r = s.kdes - s.tf;
    assert.ok(r > 0 && hw > 0, n);
    const A3 = 2 * s.bf * s.tf + hw * s.tw, I3 = 2 * (s.bf * s.tf ** 3 / 12 + s.bf * s.tf * ((s.d - s.tf) / 2) ** 2) + s.tw * hw ** 3 / 12;
    const af = (1 - Math.PI / 4) * r * r, Af = A3 + 4 * af, If = I3 + 4 * af * (hw / 2 - 0.2234 * r) ** 2;
    near(Af / s.A, 1, 0.010, `${n}: plates + fillets area ${Af.toFixed(2)} against A ${s.A}`);
    near(If / s.Ix, 1, 0.012, `${n}: plates + fillets inertia ${If.toFixed(1)} against I_x ${s.Ix}`);
    assert.ok(A3 / s.A > 0.970 && A3 / s.A < 1.006, `${n}: three-plate area ratio ${A3 / s.A}`);
    assert.ok(I3 / s.Ix > 0.955 && I3 / s.Ix < 1.008, `${n}: three-plate inertia ratio ${I3 / s.Ix}`);
    near(s.W / (s.A * 490 / 144), 1, 0.016, `${n}: nominal weight against A x 490/144`);
    // S_x = I_x / (d/2) and b_f > t_w, t_f > 0: gross typos
    near(s.Sx / (s.Ix / (s.d / 2)), 1, 0.012, `${n}: S_x against 2 I_x / d`);
    assert.ok(s.Zx > s.Sx && s.bf > s.tw && s.d > 2 * s.kdes, n);
    up('Af', Af / s.A); up('If', If / s.Ix); up('A3', A3 / s.A); up('I3', I3 / s.Ix); up('W', s.W / (s.A * 490 / 144)); });
  // the ranges quoted in engine/rolled.js and the fix log
  near(lim.A3[0], 0.9728, 5e-4, 'A_3/A min'); near(lim.A3[1], 1.0052, 5e-4, 'A_3/A max'); near(lim.I3[0], 0.9593, 5e-4, 'I_3/I_x min'); near(lim.I3[1], 1.0071, 5e-4, 'I_3/I_x max');
});

test('hand case W36X135', () => {
  const s = A.get('W36X135');
  assert.deepEqual([s.W, s.A, s.d, s.bf, s.tf, s.tw, s.kdes, s.Ix, s.Sx, s.Zx], [135, 39.9, 35.6, 12, 0.79, 0.6, 1.54, 7800, 439, 509]);
  // three plates: A_3 = 2(12)(0.79) + (35.6 - 1.58)(0.6) = 18.96 + 20.412 = 39.372 in^2 (98.7 % of 39.9)
  near(2 * 12 * 0.79 + 34.02 * 0.6, 39.372, 1e-9, 'A_3');
  // fillets: r = 1.54 - 0.79 = 0.75 in; 4 (1 - pi/4)(0.75)^2 = 0.483 in^2; A_f = 39.855 in^2 (99.9 % of 39.9)
  near(39.372 + 4 * (1 - Math.PI / 4) * 0.75 ** 2, 39.855, 1e-3, 'A_f');
});
