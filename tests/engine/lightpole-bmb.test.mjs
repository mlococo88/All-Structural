// "Light Pole and Sign Post.html" LPBM (2026-11-19): the base moment build-up (display only) reconciles with the engine's own
// base moment. For every combination and wind direction (pole) and every combination, post and case (sign), the build-up from
// the component values (Σ γ·M per load case as vectors, + the combination's cable pulls) and the sum of the combination's own
// terms both equal evalComboDir / evalSignCombo M to floating-point rounding, and the build-up never changes a result.
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { lpEngine, lpDefaultInp } from './lp-source.mjs';

const rel = (a, b) => Math.abs(a - b) / Math.max(1, Math.abs(b));
const KEYS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'A1', 'A2', 'A3', 'A4', 'A5'];
const FIXS = [{ hf: 35, th: 0, a: 6, epa: 1.6, aIce: 1.6, tIce: 0.5, W: 55 }, { hf: 30, th: 45, a: 8, epa: 2.4, aIce: 2.4, tIce: 0.5, W: 70, armD: 3.5 },
  { hf: 35, th: 200, a: 4, epa: 1.2, aIce: 1.2, tIce: 0.5, W: 40, armD: 2.375 }];
const CABS = [{ hc: 32, th: 15, L: 80, s: 4, D: 0.75, g: 0.35 }, { hc: 30, th: 135, L: 60, s: 3, D: 0.5, g: 0.25 }, { hc: 28, th: 250, L: 90, s: 5, D: 0.75, g: 0.35 }];
function pole(lp, over, fixs, cabs) {
  const inp = lpDefaultInp(over); inp.DLaxial = (inp.DL || 0) + 300;   // as calc(): misc + pole self-weight (any value: axial only)
  const comps = cabs.map(c => lp.call('cableComponents', c, inp)), fxs = fixs.map(x => lp.call('fixtureComponents', x, inp)), pw = lp.call('poleWindNominal', inp);
  return { inp, comps, fxs, pw };
}
const VARIANTS = [
  ['default pole, 3 fixtures, 3 cables (sag)', {}, FIXS, CABS],
  ['stiff cables, 1 in ice', { cableMethod: 'stiff', tIce: 1.0 }, FIXS, CABS],
  ['no cables', {}, FIXS, []],
  ['rectangular pole (direction-dependent mast wind)', { poleShape: 'rect', poleDiaTop: 8, poleDiaBase: 8, poleDepthTop: 6, poleDepthBase: 6, poleTaper: false }, FIXS.slice(0, 1), CABS.slice(0, 1)],
  ['bare pole', {}, [], []],
];
for (const [name, over, fixs, cabs] of VARIANTS) test(`LPBM pole build-up = engine M, every combination and direction: ${name}`, () => {
  const lp = lpEngine(), { inp, comps, fxs, pw } = pole(lp, over, fixs, cabs);
  let n = 0;
  for (const k of KEYS) for (const phi of [0, 90, 180, 270]) {
    const r = lp.call('evalComboDir', k, inp, comps, fxs, pw, phi), b = lp.call('lppBmbPole', inp, comps, fxs, pw, r);
    assert.ok(rel(b.M, r.M) < 1e-12, `${k} @ ${phi}: build-up ${b.M} vs engine ${r.M}`);
    assert.ok(rel(b.Mu, r.M) < 1e-12, `${k} @ ${phi}: Σ terms ${b.Mu} vs engine ${r.M}`);
    assert.ok(Math.abs(b.X - r.Mx) <= 1e-9 * Math.max(1, r.M) && Math.abs(b.Y - r.My) <= 1e-9 * Math.max(1, r.M), `${k} @ ${phi}: components`);
    assert.equal(b.ok, true); n++;
  }
  assert.equal(n, KEYS.length * 4);
});
test('LPBM pole: the governing combination of evalCombo (the envelope row) reconciles; the build-up leaves the engine result unchanged', () => {
  const lp = lpEngine(), { inp, comps, fxs, pw } = pole(lp, {}, FIXS, CABS);
  for (const k of KEYS) {
    const g = lp.call('evalCombo', k, inp, comps, fxs, pw), before = JSON.stringify([g.M, g.Mx, g.My, g.P, g.axial]);
    const b = lp.call('lppBmbPole', inp, comps, fxs, pw, g);
    assert.equal(b.ok, true, k); assert.equal(b.env.M, g.M); assert.equal(JSON.stringify([g.M, g.Mx, g.My, g.P, g.axial]), before);
  }
});
test('LPBM pole hand check: one fixture θ 0°, a 6 ft, no cables, 1.2D + 1.0W, wind toward 0°: M_u = 1.2·55·6 + 1.0(F_w·35 + M_pole)', () => {
  const lp = lpEngine(), { inp, comps, fxs, pw } = pole(lp, {}, FIXS.slice(0, 1), []);
  const r = lp.call('evalComboDir', 'L1', inp, comps, fxs, pw, 0), b = lp.call('lppBmbPole', inp, comps, fxs, pw, r);
  const hand = 1.2 * 55 * 6 + 1.0 * (fxs[0].Fw * 35 + pw.Mpole);   // all three along +x
  assert.ok(Math.abs(b.M - hand) < 1e-9 && Math.abs(r.M - hand) < 1e-9, `${b.M} vs ${hand}`);
  assert.ok(Math.abs(b.tot.D.x - 330) < 1e-9 && Math.abs(b.tot.W.x - (fxs[0].Fw * 35 + pw.Mpole)) < 1e-9, 'case totals');
  // F_w = 51.39 lb (fixlog Case 1): M_W ≈ 51.39·35 + M_pole; worked lines name the factors and the result
  const tex = lp.call('lppBmbWorkedTex', b, 'M_u').join(' ');
  assert.match(tex, /M_\{u,x\} = 1\.2\\,M_\{x,D\} \+ 1\.0\\,M_\{x,W\}/);
});
test('LPBM sign: every combination, post and case reconciles (monopost, two posts, Case C, projection)', () => {
  const lp = lpEngine();
  const SIGNS = [{ signPosts: 1 }, { signPosts: 2, signB: 16, signS: 5 }, { signPosts: 2, signB: 40, signS: 3, signClr: 8, signSpacing: 20 }, { signPosts: 1, pProj: 2 }];
  for (const s of SIGNS) {
    const inp = lpDefaultInp(Object.assign({ mode: 'sign', H: 16, poleTaper: false, poleDiaBase: 6.0, poleTwBase: 0.1875 }, s));
    inp.H = inp.signClr + inp.signS - (inp.pProj || 0); inp.__poleTotalW = 250;
    const sw = lp.call('signWind', inp), pw = lp.call('poleWindNominal', inp);
    for (const k of KEYS) {
      const r = lp.call('evalSignCombo', k, inp, pw, sw);
      for (const dr of r.dirs) dr.posts.forEach((pd, p) => {
        const g = Object.assign({}, pd, { phi: dr.phi, key: k, name: r.name }), b = lp.call('lppBmbSignPost', inp, sw, g, p);
        assert.ok(rel(b.M, pd.M) < 1e-12 && rel(b.Mu, pd.M) < 1e-12, `${JSON.stringify(s)} ${k} @ ${dr.phi} post ${p + 1}: ${b.M} vs ${pd.M}`);
      });
    }
  }
});
