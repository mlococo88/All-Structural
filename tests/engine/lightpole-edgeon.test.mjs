// "Light Pole and Sign Post.html", sign mode, LPEW (2026-11-19, engineer): the sign wind directions and the edge-on check of a
// rectangular post. Round and square posts: wind toward 0° and 180° only. A rectangular post (width B across the panel, depth d along
// the panel normal) adds wind toward 90° (edge-on): no panel force, the post drag on the depth face, bending about the y axis.
// Hand check (fixlog LPEW): 6 × 12 × 1/4 in post, panel 3 × 1.5 ft at 30 ft clearance, V 130 mph, Exp. C, K_d 0.90, G 0.85, C_f 2.0.
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { lpEngine, lpDefaultInp } from './lp-source.mjs';

const near = (a, b, abs, what) => assert.ok(Math.abs(a - b) <= abs, `${what}: ${a} vs ${b} (±${abs})`);
const rel = (a, b, r, what) => assert.ok(Math.abs(a - b) <= r * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
const RECT = { poleShape: 'rect', poleDiaTop: 6, poleDiaBase: 6, poleDepthTop: 12, poleDepthBase: 12, poleTwTop: 0.25, poleTwBase: 0.25 };
function hcInp(lp, over = {}) {
  const inp = lpDefaultInp(Object.assign({ mode: 'sign', signPosts: 1, poleTaper: false, V: 130, signB: 3, signS: 1.5, signClr: 30, signWt: 60,
    Kd: 0.9, cfPole: 2.0, tIce: 0, Vice: 0 }, RECT, over));
  inp.H = inp.signClr + inp.signS - (inp.pProj || 0);
  const seg = lp.call('poleSegments', inp); inp.__poleTotalW = seg.totalW;
  return { inp, seg };
}
const Kz = z => 2.01 * Math.pow(Math.max(z, 15) / 900, 2 / 9.5);   // Exp. C, z < 15 ft at 15 ft
const qKG = z => 0.00256 * Kz(z) * 1.0 * 0.9 * 130 * 130 * 0.85;     // q_z K_d G (psf)

test('LPEW: sign directions: round / square posts 0° and 180° only; a rectangular post 0°, 90° (edge-on), 180°', () => {
  const lp = lpEngine();
  for (const [shape, over, dirs] of [['round', { poleShape: 'round', poleDiaTop: 10, poleDiaBase: 10 }, [0, 180]],
    ['square', { poleShape: 'square', poleDiaTop: 8, poleDiaBase: 8, poleDepthTop: undefined }, [0, 180]], ['rect', {}, [0, 90, 180]]]) {
    const { inp } = hcInp(lp, over);
    const sw = lp.call('signWind', inp), pw = lp.call('poleWindNominal', inp), r = lp.call('evalSignCombo', 'L1', inp, pw, sw);
    assert.equal(JSON.stringify(r.dirs.map(d => d.phi)), JSON.stringify(dirs), shape);
    assert.equal(!!r.postEdge, shape === 'rect', shape + ' postEdge');
  }
});

test('LPEW hand check: edge-on drag on the 12 in face, 6 segments of 5 ft; F_d,1 = 28.095(2.0)(12/12)(5) = 280.95 lb; ΣF_d = 1,758.3 lb, ΣF_d z = 27,063 lb·ft', () => {
  const lp = lpEngine();
  const { inp } = hcInp(lp);
  const sw = lp.call('signWind', inp);
  assert.equal(sw.edge, true); assert.equal(sw.edgeWeak, true);
  assert.equal(sw.postStrips.length, 6);
  near(qKG(2.5), 28.095, 0.001, 'q_z K_d G at z ≤ 15 ft');
  let F = 0, M = 0;
  sw.postStrips.forEach((st, i) => { const z = 2.5 + 5 * i, Fd = qKG(z) * 2.0 * (12 / 12) * 5; rel(st.Fd, Fd, 1e-12, 'F_d,' + (i + 1)); F += Fd; M += Fd * z; });
  near(sw.postStrips[0].Fd, 280.95, 0.01, 'F_d,1');
  rel(sw.FpostD, F, 1e-12, 'ΣF_d'); rel(sw.MpostD, M, 1e-12, 'ΣF_d z');
  near(sw.FpostD, 1758.27, 0.01, 'F_drag,d'); near(sw.MpostD, 27063.0, 0.1, 'M_drag,d'); near(sw.zPostD, 15.392, 0.001, 'z_drag,d');
  rel(sw.FpostD, 2 * sw.Fpost, 1e-12, 'depth face = 2 × width face (12 / 6)');
});

test('LPEW hand check: 1.2D + 1.0W edge-on: V = 1,758.3 lb, M = 27,063 lb·ft, no panel share, no torsion; normal 0°: M = 21,580 lb·ft', () => {
  const lp = lpEngine();
  const { inp } = hcInp(lp);
  const sw = lp.call('signWind', inp), pw = lp.call('poleWindNominal', inp), r = lp.call('evalSignCombo', 'L1', inp, pw, sw);
  const e = r.postEdge[0];
  assert.equal(e.edge, true); assert.equal(e.phi, 90); assert.equal(e.case, 'edge-on');
  assert.equal(e.Fp, 0); assert.equal(e.T, 0);
  rel(e.P, sw.FpostD, 1e-12, 'V'); rel(e.M, sw.MpostD, 1e-12, 'M');
  near(r.postGovN[0].M, 21579.9, 0.1, 'normal M (0°/180°)');
  assert.equal(r.postGov[0].edge, true, 'edge-on has the larger moment');
});

test('LPEW hand check: weak-axis post check, H1-1b: S_y 18.852, Z_y 21.031 in³, b/t 45 slender, φM_ny = 0.9(50)(S_y)(33.716/45)² = 476.25 kip·in; ratio 0.733', () => {
  const lp = lpEngine();
  const { inp, seg } = hcInp(lp);
  const sw = lp.call('signWind', inp), pw = lp.call('poleWindNominal', inp), r = lp.call('evalSignCombo', 'L1', inp, pw, sw);
  const x = Object.assign({}, r.postEdge[0], { key: 'L1', name: '1.2D + 1.0W, edge-on (weak axis)' });
  const ps = lp.call('signPostStress', inp, seg, pw, x, sw), g = ps.govRow;
  assert.equal(ps.edge, true); assert.equal(ps.axis, 'y');
  // section: B 6, H 12, t 0.25: I_y = (12·6³ − 11.5·5.5³)/12 = 56.557 in⁴, S_y = I_y/3 = 18.852; Z_y = (12·36 − 11.5·30.25)/4 = 21.031
  near(g.Sy, 18.852, 0.001, 'S_y'); near(g.Zy, 21.031, 0.001, 'Z_y'); near(g.Dt, 45, 1e-9, 'b/t = (12 − 0.75)/0.25');
  const lr = 1.40 * Math.sqrt(29000 / 50), Mc = 0.9 * 50 * g.Sy * Math.pow(lr / 45, 2);
  near(Mc, 476.25, 0.01, 'φM_ny (hand)'); rel(g.Mcx, Mc, 1e-12, 'φM_ny (tool)');
  assert.equal(g.Mrx, 0); rel(g.Mry, g.M * 12 / 1000, 1e-12, 'M_ry');
  rel(g.M1, sw.MpostD, 1e-12, 'M_1 = M_drag,d'); rel(g.M, ps.B2 * g.M1, 1e-12, 'M_r = B_2 M_1');
  assert.ok(ps.B2 > 1.0 && ps.B2 < 1.05, 'B_2 ' + ps.B2);
  rel(g.fb, g.M * 12 / 1000 / g.Sy, 1e-12, 'f_by = M_ry / S_y');
  assert.equal(g.form, 'H1-1b');
  rel(g.ratio, g.prPc / 2 + (g.M * 12 / 1000) / Mc, 1e-12, 'H1-1b');
  near(g.ratio, 0.7326, 0.0005, 'ratio (edge-on)');
  // the normal case keeps the x axis (S_x 27.822): its record and ratio are those of the tool before LPEW
  const n = lp.call('signPostStress', inp, seg, pw, Object.assign({}, r.postGovN[0], { key: 'L1', name: '1.2D + 1.0W' }), sw);
  assert.ok(!n.edge); near(n.govRow.Sx, 27.822, 0.001, 'S_x'); near(n.govRow.ratio, 0.4023, 0.0005, 'ratio (normal)');
});

test('LPEW: the build-up of an edge-on record reconciles (post drag on the depth face only)', () => {
  const lp = lpEngine();
  const { inp } = hcInp(lp, { tIce: 1.0, Vice: 60, pProj: 2 });
  const sw = lp.call('signWind', inp), pw = lp.call('poleWindNominal', inp);
  for (const k of ['L1', 'L2', 'A1', 'A2']) {
    const r = lp.call('evalSignCombo', k, inp, pw, sw);
    const g = Object.assign({}, r.postEdge[0], { phi: 90, key: k, name: r.name }), b = lp.call('lppBmbSignPost', inp, sw, g, 0);
    assert.ok(b.ok, `${k}: ${b.M} vs ${b.env.M}`); assert.equal(b.rows.filter(x => x.key === 'panel').length, 0);
  }
});
