// "Light Pole and Sign Post.html" LPLS (2026-11-23): the per-source rows of the Loading sub-tab "Forces at the base" (display
// only) sum exactly to the engine's totals. For every combination and wind direction (pole) and every combination, direction and
// post (sign): Σ γ × (unfactored load-case rows) + the combination's own cable pulls = evalComboDir / evalSignComboDir V, N, M and
// T; the same at grade with a shaft projection (lppGradeDir); the Dead load table's N_D is the D total; and building the rows
// never changes an engine result.
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { lpEngine, lpDefaultInp } from './lp-source.mjs';

const KEYS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'A1', 'A2', 'A3', 'A4', 'A5'], Q = ['Vx', 'Vy', 'N', 'Mx', 'My', 'T'];
const FIXS = [{ hf: 35, th: 0, a: 6, epa: 1.6, aIce: 1.6, tIce: 0.5, W: 55 }, { hf: 30, th: 45, a: 8, epa: 2.4, aIce: 2.4, tIce: 0.5, W: 70, armD: 3.5 },
  { hf: 35, th: 200, a: 4, epa: 1.2, aIce: 1.2, tIce: 0.5, W: 40, armD: 2.375 }];
const CABS = [{ hc: 32, th: 15, L: 80, s: 4, D: 0.75, g: 0.35 }, { hc: 30, th: 135, L: 60, s: 3, D: 0.5, g: 0.25 }, { hc: 28, th: 250, L: 90, s: 5, D: 0.75, g: 0.35 }];
const near = (a, b, scale) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(scale === undefined ? b : scale));
function pole(lp, over, fixs, cabs) {
  const inp = lpDefaultInp(over); inp.DLaxial = (inp.DL || 0) + 300;
  const comps = cabs.map(c => lp.call('cableComponents', c, inp)), fxs = fixs.map(x => lp.call('fixtureComponents', x, inp)), pw = lp.call('poleWindNominal', inp);
  return { inp, comps, fxs, pw };
}
const VARIANTS = [
  ['default pole, 3 fixtures (2 arms), 3 cables (sag)', {}, FIXS, CABS],
  ['stiff cables, 1 in ice (map basis)', { cableMethod: 'stiff', tIce: 1.0, iceBasis: 'map', iceIi: 1.25 }, FIXS, CABS],
  ['no cables, no ice', { tIce: 0 }, FIXS, []],
  ['rectangular pole (mast wind by direction), 1 fixture, 1 cable', { poleShape: 'rect', poleDiaTop: 8, poleDiaBase: 8, poleDepthTop: 6, poleDepthBase: 6, poleTaper: false }, FIXS.slice(0, 1), CABS.slice(0, 1)],
  ['bare pole', {}, [], []],
  ['shaft projection p = 2 ft', { pProj: 2, b: 2.5 }, FIXS, CABS],
];
for (const [name, over, fixs, cabs] of VARIANTS) test(`LPLS pole: Σ γ × source rows = engine V, N, M, T, every combination and direction: ${name}`, () => {
  const lp = lpEngine(), { inp, comps, fxs, pw } = pole(lp, over, fixs, cabs);
  const sp = inp.pProj > 0 ? lp.call('lppShaftProj', inp) : null; let n = 0;
  for (const phi of [0, 90, 180, 270]) {
    const rows = lp.call('lppSrcPole', inp, comps, fxs, pw, phi), tot = lp.call('lppSrcTot', rows);
    // rows of one load case only carry that case; reference rows (cable pull of one source alone) are not in the totals
    assert.ok(rows.every(r => r.ref ? r.k === 'ref' : ['D', 'W', 'Di', 'Wi'].includes(r.k)));
    for (const k of KEYS) {
      const r = lp.call('evalComboDir', k, inp, comps, fxs, pw, phi), before = JSON.stringify([r.Vx, r.Vy, r.Mx, r.My, r.axial, r.Tz]);
      const pull = lp.call('lppSrcPull', r), c = lp.call('lppSrcComb', tot, r.factors, pull);
      const eng = { Vx: r.Vx, Vy: r.Vy, N: r.axial, Mx: r.Mx, My: r.My, T: r.Tz }, sV = Math.max(r.P, 1), sM = Math.max(r.M, 1);
      for (const q of Q) assert.ok(near(c[q], eng[q], q[0] === 'M' || q === 'T' ? sM : q === 'N' ? r.axial : sV), `${k} @ ${phi} ${q}: rows ${c[q]} vs engine ${eng[q]}`);
      assert.ok(near(c.V, r.P) && near(c.M, r.M), `${k} @ ${phi}: resultants`);
      assert.equal(JSON.stringify([r.Vx, r.Vy, r.Mx, r.My, r.axial, r.Tz]), before);
      if (sp) {   // at grade: M + V·p, + the projection's weight, ice and wind (lppGradeDir, B = 1)
        const g = lp.call('lppGradeDir', r, r.factors, sp, 1), G = lp.call('lppSrcGrade', rows, sp, phi), tG = lp.call('lppSrcTot', G);
        const pg = Object.assign({}, pull, { Mx: pull.Mx + pull.Vx * sp.p, My: pull.My + pull.Vy * sp.p }), cg = lp.call('lppSrcComb', tG, r.factors, pg);
        assert.ok(near(cg.Vx, g.Vx, sV) && near(cg.Vy, g.Vy, sV) && near(cg.N, g.axial) && near(cg.Mx, g.Mx, sM) && near(cg.My, g.My, sM), `${k} @ ${phi}: grade`);
        assert.ok(near(cg.M, g.M) && near(cg.V, g.P));
      }
      n++;
    }
  }
  assert.equal(n, KEYS.length * 4);
});
test('LPLS pole hand check: one fixture θ 0°, a 6 ft, no cables, wind toward 0°: the rows are W, F_w at h, the mast ΣF_i z_i; 1.4D gives N = 1.4 N_D', () => {
  const lp = lpEngine(), { inp, comps, fxs, pw } = pole(lp, {}, FIXS.slice(0, 1), []);
  const rows = lp.call('lppSrcPole', inp, comps, fxs, pw, 0), tot = lp.call('lppSrcTot', rows);
  assert.ok(near(tot.D.N, inp.DLaxial + 55) && near(tot.D.Mx, 55 * 6) && near(tot.D.My, 0, 1));
  assert.ok(near(tot.W.Vx, fxs[0].Fw + pw.Fpole) && near(tot.W.Mx, fxs[0].Fw * 35 + pw.Mpole) && near(tot.W.Vy, 0, 1));
  const r = lp.call('evalComboDir', 'L6', inp, comps, fxs, pw, 0);
  assert.ok(near(r.axial, 1.4 * tot.D.N) && near(r.M, 1.4 * 330));
  const r1 = lp.call('evalComboDir', 'L1', inp, comps, fxs, pw, 0);
  assert.ok(near(r1.M, 1.2 * 330 + 1.0 * (fxs[0].Fw * 35 + pw.Mpole)));
});
test('LPLS sign: Σ γ × source rows = engine V, N, M, T for every combination, direction and post (monopost, two posts, Case C, projection, rectangular post edge-on)', () => {
  const lp = lpEngine();
  const SIGNS = [{ signPosts: 1 }, { signPosts: 2, signB: 16, signS: 5 }, { signPosts: 2, signB: 40, signS: 3, signClr: 8, signSpacing: 20 }, { signPosts: 1, pProj: 2 }, { signPosts: 1, tIce: 1.0 },
    { signPosts: 2, signB: 4, signS: 2, signClr: 20, signSpacing: 3, poleShape: 'rect', poleDiaTop: 6, poleDiaBase: 6, poleDepthTop: 12, poleDepthBase: 12, tIce: 1.0, pProj: 2 }];
  let n = 0;
  for (const s of SIGNS) {
    const inp = lpDefaultInp(Object.assign({ mode: 'sign', H: 16, poleTaper: false, poleDiaBase: 6.0, poleTwBase: 0.1875 }, s));
    inp.H = inp.signClr + inp.signS - (inp.pProj || 0); inp.__poleTotalW = 250;
    const sw = lp.call('signWind', inp), pw = lp.call('poleWindNominal', inp), sp = inp.pProj > 0 ? lp.call('lppShaftProj', inp) : null;
    for (const k of KEYS) {
      const r = lp.call('evalSignCombo', k, inp, pw, sw), f = r.factors;
      for (const dr of r.dirs) dr.posts.forEach((pd, p) => {
        const rows = lp.call('lppSrcSign', inp, sw, p, dr.phi, pd.edge ? 'A' : pd.case), c = lp.call('lppSrcComb', lp.call('lppSrcTot', rows), f, null);
        const tag = `${JSON.stringify(s)} ${k} @ ${dr.phi} post ${p + 1} case ${pd.case}`;
        assert.ok(near(c.Vx, pd.P) && near(c.Mx, pd.M) && near(c.N, pd.axial) && near(c.T, pd.T, Math.max(1, pd.M)), `${tag}: ${[c.Vx, c.Mx, c.N, c.T]} vs ${[pd.P, pd.M, pd.axial, pd.T]}`);
        assert.equal(rows.meta.case, pd.case);
        if (sp) { const g = lp.call('lppGradePost', Object.assign({}, pd, { phi: dr.phi }), k, sp, 1), cg = lp.call('lppSrcComb', lp.call('lppSrcTot', lp.call('lppSrcGrade', rows, sp, 0)), f, null);
          assert.ok(near(cg.Vx, g.P) && near(cg.Mx, g.M) && near(cg.N, g.axial), `${tag}: grade`); }
        n++;
      });
    }
  }
  assert.equal(n, 11 * (2 + 4 + 4 + 2 + 2 + 6));   // combinations × Σ(posts × directions)
});
