// apps/ps-bridge NX-1 (engineer-approved §4 change, 2026-11-25): the live-load distribution factors of NEXT F beams per stem, each stem a
// type (k) stringer of AASHTO LRFD 10th Ed. Table 4.6.2.2.1-1 (engine/lldf-next.js, an app-side override of the moved engine's distFactors;
// the engine files unchanged). Hand checks of the PR's §4 callout on the test project (4 NEXT 24F, 40 ft out to out, 45 ft span, d_e 3.833
// ft, mountable sidewalks, N_L 3, RIDOT): (1) interior beam, moment and shear, skew 0; (2) exterior beam: the three exterior-stem
// candidates (lever rule, e × g, rigid section), the governing one, plus the interior stem; (3) skew 35°: r_M and c_V with the stem K_g;
// (4) fatigue; (5) every other shape, NEXT D and a NEXT F without a deck: results byte-identical with and without the module, over the
// harness B designs (every girder line), the recorded and the 600 seeded parity cases; (6) the applicability items are the stem values,
// out-of-range FAIL with its warning; (7) unequal bays: the stems at the real beam lines; (8) the worked steps = the engine values, the
// Loads & LLDF card, the Cross-section tab card and the Report text.
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';
import { recordedCases, seededCases } from './psbridge-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const ENG = nx => ['sections', 'model', 'rigid', 'lldf-fg', ...(nx ? ['lldf-next'] : []), 'lldf-opt', 'ut', 'pl', 'applicability', 'deckdist', 'holddown', 'pierblock', 'demands', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`));
const UI = ['outkit', 'vizkit', 'bridgedl', 'xsfig', 'section', 'loads', 'inputs'].map(n => path.join(APP, `ui/${n}.js`));
const W = loadShared('steps.js', 'deck.js', ...PBD, ...ENG(true), ...UI, 'report.js', ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
const W0 = loadShared('steps.js', 'deck.js', ...PBD, ...ENG(false));   // the same app without engine/lldf-next.js (= before NX-1)
const J = v => JSON.parse(JSON.stringify(v));
const near = (a, b, tol = 1e-9, m = '') => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${m} ${a} vs ${b}`);
const C = v => typeof v === 'number' ? (Object.is(v, -0) ? '-0' : String(v)) : v === null || typeof v !== 'object' ? (typeof v === 'function' ? '' : JSON.stringify(v))
  : Array.isArray(v) ? '[' + v.map(C).join(',') + ']' : '{' + Object.keys(v).filter(k => typeof v[k] !== 'function').map(k => JSON.stringify(k) + ':' + C(v[k])).join(',') + '}';
const hash = R => crypto.createHash('sha256').update(C(R)).digest('hex');

/* the test project (built here from scratch): 4 NEXT 24F at 10 ft (b_f = 120 in), overhangs 5 ft (40 ft out to out), 45 ft simple span,
   barriers 14 in wide (d_e = 5 − 14/12 = 3.8333 ft), 5 ft sidewalks 8 in thick (mountable: the traffic face stays the barrier's), 8 in CIP
   deck, N_L = 3, RIDOT; 24 × 0.6 in strands (12 at 2.875 in, 12 at 4.875 in, 2 of each row debonded 5 ft), stirrups 0.40 in² at 9 in,
   release steel 4.0 in² (every check passes, before and after); Interior type on G2, G3, Exterior type on G1, G4 */
function project(Wx, f) {
  const P = Wx.PSBModel.newProject();
  P.spans.lengths = [45]; P.xs.nb = 4; P.xs.bays = [10, 10, 10]; P.xs.ohL = 5; P.xs.ohR = 5; P.xs.skews = [0, 0];
  P.base.girder = 'NEXT 24F'; P.base.ts = 8; P.base.harp.n = 0; P.base.loads.NL = 3; P.base.owner = 'RIDOT';
  P.base.rows = [{ n: 12, y: 2.875, nd: 2, dbnd: 5 }, { n: 12, y: 4.875, nd: 2, dbnd: 5 }]; P.base.opt.stirAv = 0.4; P.base.opt.sEnd = 9; P.base.opt.sInt = 9; P.base.opt.relAs = 4;
  P.xs.dl.barL.bw = 14 / 12; P.xs.dl.barR.bw = 14 / 12; P.xs.dl.swL = { w: 5, t: 8 }; P.xs.dl.swR = { w: 5, t: 8 };
  P.types[0].lines = [2, 3]; P.types[1].lines = [1, 4]; P.design = { g: 2, s: 1 };
  if (f) f(P);
  return P;
}
const cell = (Wx, P, g) => { const k = P.types.findIndex(t => t.lines.includes(g)), inp = Wx.PSBDesign.cellInputs(P, k, g); return { inp, R: Wx.PSBHoldDown.compute(J(inp)) }; };

/* the hand values (worked in the PR's §4 callout, by hand from the inputs): section of a NEXT 24F at 120 in (half way between the tabulated
   96 and 144 in): A = 1,068 in², I = 56,032 in⁴, y_b = 15.52 in; n = E_c / E_c,deck (f'c 8.5 ksi, w_c 0.145; deck 4.0 ksi, 0.150) */
function hand(n, th) {
  const S = 5, L = 45, ts = 8, eg = 24 + 2 + 4 - 15.52, KgB = n * (56032 + 1068 * eg * eg), Kg = KgB / 2, kr = Kg / (12 * L * ts ** 3);
  const m1 = 0.06 + (S / 14) ** 0.4 * (S / L) ** 0.3 * kr ** 0.1, m2 = 0.075 + (S / 9.5) ** 0.6 * (S / L) ** 0.2 * kr ** 0.1, v1 = 0.36 + S / 25, v2 = 0.2 + S / 12 - (S / 35) ** 2;
  const t = Math.tan(th * Math.PI / 180), c1 = th < 30 ? 0 : 0.25 * kr ** 0.25 * (S / L) ** 0.5, rM = 1 - c1 * t ** 1.5, cV = 1 + 0.2 * (1 / kr) ** 0.3 * t;
  const deSt = (5 - 14 / 12) - 2.5, lever = 1.2 * 0.5 * (5 + deSt - 2) / 5;   // the second wheel (d_e,st − 8 = −6.67 ft) is past the hinge 5 ft away
  const eM = 0.77 + deSt / 9.1, eV = 0.6 + deSt / 10;
  // the rigid section: stems at −2.5, 2.5, …, 32.5 ft; x̄ = 15; X_ext = 17.5; Σx² = 2(17.5² + 12.5² + 7.5² + 2.5²) = 1,050
  const R = [1, 2, 3].map(NL => { let se = 0; for (let j = 0; j < NL; j++) se += 17.5 + deSt - 5 - 12 * j; return [1.2, 1.0, 0.85][NL - 1] * (NL / 8 + 17.5 * se / 1050); });
  const rigid = Math.max(...R), gMi = Math.max(m1, m2), gVi = Math.max(v1, v2), gMe = Math.max(eM * m2, lever, rigid), gVe = Math.max(eV * v2, lever, rigid);
  return { eg, KgB, Kg, kr, m1, m2, v1, v2, c1, rM, cV, deSt, lever, eM, eV, R, rigid, gMi, gVi, gMe, gVe,
    int: { dfm: 2 * gMi * rM, dfv: 2 * gVi * cV, fat: 2 * m1 / 1.2 }, ext: { dfm: (gMe + gMi) * rM, dfv: (gVe + gVi) * cV, fat: (Math.max(lever, R[0]) + m1) / 1.2 } };
}

test('NX-1 (1)(2) the test project, skew 0: interior and exterior beams, moment and shear, by hand; before = the engine\'s 0.8533 / 0.9517 on every line', () => {
  const P = project(W), I = cell(W, P, 2), E = cell(W, P, 1), E4 = cell(W, P, 4), q = I.R.df.nx, x = E.R.df.nx;
  assert.equal(I.inp.loads.pos, 'interior'); assert.equal(E.inp.loads.pos, 'exterior'); near(E.inp.loads.de, 5 - 14 / 12); assert.equal(E.inp.loads.NL, 3);
  near(I.R.g.A, 1068); near(I.R.g.I, 56032); near(I.R.g.yb, 15.52); near(I.R.g.btf, 120);
  const h = hand(I.R.cp.Ecg / I.R.cp.Ecd, 0);
  near(q.S, 5); assert.equal(q.Nst, 8); near(q.eg, 14.48); near(q.KgB, h.KgB); near(q.Kg, h.Kg); near(q.Kg, 167744.35, 1e-6);
  near(q.m1, h.m1); near(q.m2, h.m2); near(q.v1, 0.56); near(q.v2, h.v2); near(q.m1, 0.385959, 1e-5); near(q.m2, 0.492059, 1e-5); near(q.v2, 0.596259, 1e-5);
  // interior beam = 2 × the interior stem
  near(I.R.dfm, h.int.dfm); near(I.R.dfv, h.int.dfv); near(I.R.dfm, 0.984118, 1e-5); near(I.R.dfv, 1.192517, 1e-5);
  // exterior: d_e,st = 3.8333 − 2.5 = 1.3333 ft; lever 1.2 × 0.5 × 0.86667 = 0.52; e_M g_M2 = 0.91652 × 0.49206 = 0.45098; R (2 lanes) 0.51111
  near(x.deSt, 4 / 3); near(x.lever, 0.52); near(x.eM, h.eM); near(x.eMg, h.eM * h.m2); near(x.eV, h.eV); near(x.eVg, h.eV * h.v2);
  near(x.xbar, 15); near(x.Xext, 17.5); near(x.sumX2, 1050); x.trials.forEach((t, i) => near(t.r, h.R[i])); near(x.rigid, 0.511111, 1e-5); assert.equal(x.rigidNL, 2);
  assert.equal(x.govM, 'lever'); assert.equal(x.govV, 'lever'); near(x.gMe, 0.52); near(x.gVe, 0.52);
  near(E.R.dfm, h.ext.dfm); near(E.R.dfv, h.ext.dfv); near(E.R.dfm, 1.012059, 1e-5); near(E.R.dfv, 1.116259, 1e-5);
  assert.equal(C(Object.assign(J(E4.R), { warns: 0 })), C(Object.assign(J(E.R), { warns: 0 })), 'G4 = G1 (symmetric)');
  // before: the moved engine's whole-beam types (i)/(j) on the beam width, the exterior beam with the interior factor
  [I, E].forEach(c => { near(c.R.df.nx.engine.dfm, 0.853260, 1e-5); near(c.R.df.nx.engine.dfv, 0.951701, 1e-5); });
  const B = cell(W0, project(W0), 1).R; near(B.dfm, 0.853260, 1e-5); near(B.dfv, 0.951701, 1e-5);
  // the moment and shear the checks take: DF × the lane values (× the RIDOT HL-93 multiplier in the combinations, unchanged)
  near(I.R.MLL, I.R.dfm * I.R.hl.M); near(E.R.VLL, E.R.dfv * E.R.hl.V);
  assert.deepEqual(J(I.R.warns.filter(w => /NX-|NEXT/.test(w))), []);
});

test('NX-1 (3) skew 35°: r_M = 1 − c₁ (tan θ)^1.5 and c_V = 1 + 0.20 (12 L t_s³ / K_g)^0.3 tan θ with the stem K_g and S', () => {
  const P = project(W, Q => { Q.xs.skews = [35, 35]; }), I = cell(W, P, 2).R, E = cell(W, P, 1).R, h = hand(I.cp.Ecg / I.cp.Ecd, 35);
  near(I.df.nx.c1, h.c1); near(I.df.skM, h.rM); near(I.df.skV, h.cV); near(h.c1, 0.073547, 1e-4); near(h.rM, 0.956906, 1e-5); near(h.cV, 1.162690, 1e-5);
  near(I.dfm, h.int.dfm); near(I.dfv, h.int.dfv); near(E.dfm, h.ext.dfm); near(E.dfv, h.ext.dfv);
  near(I.dfm, 0.941714, 1e-5); near(I.dfv, 1.386520, 1e-5); near(E.dfm, 0.968450, 1e-5); near(E.dfv, 1.297866, 1e-5);
  // 15° (the RIDOT BDM Table 5-1 limit for NEXT F): no moment reduction (θ < 30°), the shear correction applies
  const F = cell(W, project(W, Q => { Q.xs.skews = [15, 15]; }), 2).R; assert.equal(F.df.skM, 1); near(F.df.skV, 1 + 0.2 * (1 / h.kr) ** 0.3 * Math.tan(15 * Math.PI / 180));
});

test('NX-1 (4) fatigue: the beam\'s one-lane factor ÷ 1.2: interior 2 g_M1,st; exterior max(g_lever, R₁) of the exterior stem + g_M1 of the interior stem', () => {
  const P = project(W), I = cell(W, P, 2).R, E = cell(W, P, 1).R, h = hand(I.cp.Ecg / I.cp.Ecd, 0);
  near(I.fat.dfFat, h.int.fat); near(E.fat.dfFat, h.ext.fat); near(I.fat.dfFat, 0.643264, 1e-5); near(E.fat.dfFat, 0.754966, 1e-5);
  near(I.df.m1, 2 * h.m1); near(E.df.lever, 0.52 + h.m1); near(E.df.rigid1, h.R[0] + h.m1);
});

test('NX-1 (5) every other shape, NEXT D and a NEXT F without a deck: results byte-identical with and without the module (hashes)', () => {
  let n = 0, nx = 0; const D = [];
  // the harness B designs, every girder line of each
  for (const [name, P0] of Object.entries(TAB_CASES(() => W.PSBModel.defaultProject()))) {
    const P1 = W.PSBModel.importJSON(W.PSBModel.exportJSON(P0)).project; W.PSBBridge.fill(P1);
    for (const c of W.PSBBridge.cells(P1)) {
      const inp = W.PSBDesign.cellInputs(P1, c.k, c.g), g = W.girderGross(J(inp)), a = W.PSBHoldDown.compute(J(inp)), b = W0.PSBHoldDown.compute(J(inp));
      if (W.PSBLldfNext.applies(inp, g)) { nx++; assert.ok(a.df.nx && !b.df.nx, name); D.push(`${name} G${c.g}: DF_M ${b.dfm} -> ${a.dfm}`); continue; }
      n++; assert.equal(hash(a), hash(b), `${name} G${c.g}`);
    }
  }
  // the recorded old-app cases and the 600 seeded parity cases (the engine inputs as the old app reads them)
  const merge = vm.runInContext('mergeInputs', W);
  for (const cs of [...recordedCases(), ...seededCases(600)]) {
    const inp = merge(cs.saved ? J(cs.saved) : null); let g = null; try { g = W.girderGross(J(inp)); } catch (e) { g = null; }
    let a, b; try { a = W.PSBHoldDown.compute(J(inp)); } catch (e) { a = { threw: String(e.message) }; } try { b = W0.PSBHoldDown.compute(J(inp)); } catch (e) { b = { threw: String(e.message) }; }
    if (g && W.PSBLldfNext.applies(inp, g) && !a.threw && !a.error) { nx++; assert.ok(a.df.nx, cs.name); continue; }
    n++; assert.equal(hash(a), hash(b), cs.name);
  }
  assert.ok(n >= 600, 'designs unchanged ' + n); assert.ok(nx >= 10, 'NEXT F designs changed ' + nx);
  // NEXT D (MassDOT) and a NEXT F without a deck: the engine's values, a design warning
  ['MassDOT NEXT 28D', 'NEXT 24F'].forEach(gn => {
    const P = project(W, Q => { Q.base.girder = gn; Q.base.ts = 0; if (/D$/.test(gn)) { Q.xs.bays = [9.1, 9.1, 9.1]; } });
    const a = cell(W, P, 1), b = cell(W0, J(P), 1);
    assert.equal(a.R.df.nx, undefined, gn); assert.equal(C(Object.assign(J(a.R), { warns: 0 })), C(Object.assign(J(b.R), { warns: 0 })), gn);
    assert.ok(a.R.warns.some(w => (/D$/.test(gn) ? /NX-D5/ : /without a cast-in-place deck/).test(w)), gn + ' warning');
  });
});

test('NX-1 (6) applicability: the stem values (S = 5, N_st = 8, stem K_g, d_e,st); t_s = 4 in below 4.5 in: FAIL with its warning', () => {
  const E = cell(W, project(W), 1).R, it = k => E.ap.items.find(q => q.key === k);
  assert.equal(E.ap.kind, 'NEXT F per stem, type (k)'); near(it('S').value, 5); assert.equal(it('Nb').value, 8); near(it('Kg').value, E.df.nx.Kg); near(it('de').value, 4 / 3); assert.equal(E.ap.level, 'ok');
  const F = cell(W, project(W, Q => { Q.base.ts = 4; }), 2).R;
  assert.equal(F.ap.level, 'fail'); assert.deepEqual(J(F.ap.bad.map(q => q.key)), ['ts']);
  assert.ok(F.warns.some(w => /NEXT F per stem, type \(k\)/.test(w) && /t_s = 4/.test(w)), F.warns.join('|'));
  assert.ok(F.checks.some(c => c.n === W.PSBApplic.NAME && !c.pass));
});

test('NX-1 (7) unequal bays (9.5 / 10 / 10.5 ft): the stems at the real beam lines ± 2.5 ft (the rigid section); S = S_b / 2 of the line', () => {
  const P = project(W, Q => { Q.xs.bays = [9.5, 10, 10.5]; Q.xs.ohR = 5.5; }), E = cell(W, P, 4).R.df.nx, I = cell(W, P, 2).R.df.nx;
  assert.deepEqual(J(E.X), [0, 9.5, 19.5, 30]); near(E.Sb, 10.5); near(E.S, 5.25); near(I.Sb, 9.75); near(I.S, 4.875);
  const xs = [0, 9.5, 19.5, 30].flatMap(x => [x - 2.5, x + 2.5]), xb = xs.reduce((a, v) => a + v, 0) / 8;
  near(E.xbar, xb); near(E.Xext, 32.5 - xb); near(E.sumX2, xs.reduce((a, v) => a + (v - xb) ** 2, 0));
});

test('NX-1 (8) worked steps = engine values (interior, exterior, skew 35°); the Loads & LLDF card; the Cross-section tab card; the Report text', () => {
  for (const [g, sk] of [[2, 0], [1, 0], [1, 35], [2, 35]]) {
    const P = project(W, Q => { Q.xs.skews = [sk, sk]; }), { inp, R } = cell(W, P, g), L = W.PSBWorked.loads(inp, R);
    const ids = L.steps.map(s => s.id); assert.equal(new Set(ids).size, ids.length, 'unique ids');
    ['ld.nx.S', 'ld.nx.Kg', 'ld.nx.m2', 'ld.nx.gMi', 'ld.dfmRaw', 'ld.dfvRaw', 'ld.skM', 'ld.skV', 'ld.dfm', 'ld.dfv', ...(g === 1 ? ['ld.nx.lever', 'ld.nx.eMg', 'ld.nx.R2', 'ld.nx.rigid', 'ld.nx.gMe', 'ld.nx.gVe'] : [])].forEach(id => assert.ok(ids.includes(id), id));
    assert.ok(!ids.includes('ld.Sf') && !ids.includes('ld.lever'), 'not the whole-beam steps');
    L.pairs.forEach(p => assert.ok(Math.abs(p.shown - p.engine) <= 1e-9 * Math.max(1, Math.abs(p.engine)), `${p.id}: ${p.shown} vs ${p.engine}`));
    assert.equal(L.steps.find(s => s.id === 'ld.dfm').value, R.dfm);
    const F = W.PSBWorkedStress.stresses(inp, R), fs = F.steps.find(s => s.id === 'st.fat.df'); assert.ok(fs && /NEXT F/.test(fs.label)); F.pairs.filter(p => p.id === 'st.fat.df').forEach(p => near(p.shown, p.engine));
    const html = W.PSBUiLoads.output({ P, inp, R, W: { loads: L }, ui: {} });
    assert.ok(/per stem \(NX-1\)/.test(html) && /id="nxStems"/.test(html)); assert.equal(/id="nxCand"/.test(html), g === 1);
    assert.ok(/href="#st-ld\.nx\.gMi"/.test(html) && /href="#st-ld\.dfm"/.test(html));
  }
  // the Cross-section tab: each line's rule and factors, linked
  const P = project(W), x = W.PSBLldfNext.xsCard(P, (k, g) => W.PSBHoldDown.compute(J(W.PSBDesign.cellInputs(P, k, g))));
  assert.ok(/id="nxLines"/.test(x)); assert.equal((x.match(/<tr><td>1<\/td>/g) || []).length, 4);
  assert.ok(/G1 \(exterior\)<\/td><td class="lft">Exterior S1<\/td><td class="lft">exterior stem/.test(x) && /G2 \(interior\)<\/td><td class="lft">Interior S1<\/td><td class="lft">2 × interior stem/.test(x));
  assert.ok(/1\.0121 <a class="wk" href="#" data-sumgo="1\|1\|lds\|ld\.dfm\|"/.test(x) && /0\.9841 <a class="wk"/.test(x), x);
  const Q = W.PSBModel.newProject(); assert.equal(W.PSBLldfNext.xsCard(Q, null), '', 'no NEXT F: no card');
  // the Report: the assumption note and the distribution factor row
  assert.match(vm.runInContext('PSBLldfNext.label', W)(cell(W, P, 1).R), /exterior stem \(lever, e, rigid\) \+ interior stem/);
});

test('NX-1 (9) the Report of the test project: the assumption note, the DF row, the worked steps; no "pending" wording; every value = the engine', () => {
  const WR = loadShared('steps.js', 'report.js', 'deck.js', ...PBD, ...ENG(true),
    ...['inputs', 'vizkit', 'vizalong', 'outkit', 'bridgedl', 'xsfig', 'section', 'loads', 'analysis', 'strands', 'losses', 'stresses', 'flexure', 'shear', 'endzone', 'camber', 'handling', 'deck', 'rating', 'dash'].map(n => path.join(APP, `ui/${n}.js`)),
    ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
  for (const g of [1, 2]) {
    const P = project(WR, Q => { Q.design = { g, s: 1 }; }), B = WR.PSBReportData.compute(P, null); assert.equal(B.err, '');
    assert.ok(B.R.df.nx, 'per stem'); assert.equal(B.R.df.nx.ext, g === 1);
    const M = WR.PSBReportBuild.model(B), doc = WR.SharedReport.build(M), T = WR.SharedReport.text(doc);
    assert.deepEqual(J(doc.unresolved), []); assert.ok(!/pending/i.test(T), (T.match(/.{0,80}pending.{0,40}/i) || [''])[0]); assert.ok(!/NaN|undefined|\[object/.test(T));
    assert.match(T, /Live-load distribution \(NX-1\): NEXT F, each stem a type \(k\) stringer/); assert.match(T, /NEXT F per stem as type \(k\), two stems per beam/);
    const at = (R, p) => p.split('.').reduce((o, k) => o == null ? o : o[k], R);
    M.vals.forEach(v => { const x = at(B.R, v.path); assert.equal(typeof x, 'number', v.path); assert.equal(v.text, WR.PSBOutKit.fx(v.div ? x / v.div : x, v.d), v.path); });
    const lds = M.sections.find(s => s.id === 'lds'), st = [].concat(...lds.subs.map(q => [].concat(...q.items.filter(i => i.type === 'steps').map(i => i.steps)))).map(s => s.id);
    ['ld.nx.S', 'ld.nx.Kg', 'ld.nx.gMi', 'ld.dfmRaw', 'ld.dfm', ...(g === 1 ? ['ld.nx.lever', 'ld.nx.rigid', 'ld.nx.gMe'] : [])].forEach(id => assert.ok(st.includes(id), id));
  }
});

test('NX-O1 (engineer 2026-11-26): d_e,st below −1.0 ft is limited to −1.0 ft in e_M and e_V (4.6.2.2.2d); a warning, not an applicability FAIL', () => {
  // overhangs 2.0 ft, barriers 14 in, no sidewalks: d_e = 2.0 − 14/12 = 0.8333 ft, d_e,st = 0.8333 − 2.5 = −1.6667 ft
  const P = project(W, Q => { Q.xs.ohL = 2; Q.xs.ohR = 2; Q.xs.dl.swL = { w: 0, t: 0 }; Q.xs.dl.swR = { w: 0, t: 0 }; }), { inp, R } = cell(W, P, 1), q = R.df.nx;
  near(inp.loads.de, 2 - 14 / 12, 1e-9, 'd_e'); near(q.deSt, 2 - 14 / 12 - 2.5, 1e-9, 'd_e,st'); assert.equal(q.deLim, true); assert.equal(q.deE, -1);
  // by hand: e_M = 0.77 + (−1.0)/9.1 = 0.66011 (was 0.77 − 1.6667/9.1 = 0.58685), e_V = 0.6 − 0.1 = 0.5 (was 0.43333)
  near(q.eM, 0.77 - 1 / 9.1, 1e-12, 'e_M'); near(q.eV, 0.5, 1e-12, 'e_V'); near(q.eMg, q.eM * q.m2, 1e-12); near(q.eVg, q.eV * q.v2, 1e-12);
  assert.equal(q.eM.toFixed(5), '0.66011'); assert.equal(q.eV.toFixed(5), '0.50000');
  // the lever rule and the rigid section keep the actual d_e,st: x_w = d_e,st − 2 = −3.667 ft (S_lev 5 ft): 1.2(0.5)(5 − 3.667)/5 = 0.16000
  near(q.lever, 1.2 * 0.5 * (5 + q.deSt - 2) / 5, 1e-12, 'lever'); near(q.terms[0].x, q.deSt - 2, 1e-12);
  assert.equal(q.govM, 'rigid'); assert.equal(q.govV, 'rigid');   // the rigid section governs here (0.41111), so DF_M, DF_V are those before the limit
  const it = R.ap.items.find(x => x.key === 'de'); assert.equal(it.ok, false); assert.equal(it.level, 'warn');
  assert.notEqual(R.ap.level, 'fail'); assert.ok(!R.checks.some(c => c.n === W.PSBApplic.NAME), 'no applicability FAIL check');
  assert.ok(R.warns.includes(W.PSBLldfNext.deWarn(q)) && /limited to −1\.0 ft in the correction factors e_M and e_V/.test(W.PSBLldfNext.deWarn(q)));
  const steps = W.PSBWorked.loads(inp, R).steps, s = id => steps.find(x => x.id === id);
  assert.ok(s('ld.nx.deLim') && Object.is(s('ld.nx.deLim').value, -1)); assert.ok(Object.is(s('ld.nx.eM').value, q.eM) && Object.is(s('ld.nx.eV').value, q.eV));
  // d_e,st ≥ −1.0 ft (the test project, 1.333 ft): no limit, no warning, no step
  const E = cell(W, project(W), 1).R; assert.equal(E.df.nx.deLim, false); assert.ok(!E.warns.some(w => /NEXT F exterior stem: d_e,st/.test(w)));
  assert.ok(!W.PSBWorked.loads(cell(W, project(W), 1).inp, E).steps.some(x => x.id === 'ld.nx.deLim'));
});

test('NX-O3 (engineer 2026-11-26): RIDOT, a NEXT F and a support skew above 15° (RIDOT BDM Table 5-1): one design warning', () => {
  const sk = d => cell(W, project(W, Q => { Q.xs.skews = [d, d]; }), 2).R, has = R => R.warns.filter(w => /^RIDOT BDM Table 5-1/.test(w));
  assert.equal(has(sk(15)).length, 0, '15° (the limit)'); assert.equal(has(sk(0)).length, 0);
  const R = sk(20), w = has(R); assert.equal(w.length, 1); assert.ok(/support skews up to 15°; this span's support skew is 20\.0°/.test(w[0]), w[0]);
  const R0 = cell(W, project(W, Q => { Q.xs.skews = [20, 20]; Q.base.owner = 'AASHTO'; }), 2).R; assert.equal(has(R0).length, 0, 'not RIDOT');
});

test('NX-O2 (engineer 2026-11-26): dead loads per stem (each NEXT stem a stringer), each beam the sum of its two stems; RIDOT / MassDOT / AASHTO by hand', () => {
  const P = m => project(W, Q => { Q.xs.dl.method = m; }), D = m => W.PSBBridgeDL.distribute(P(m));
  // the stems at the beam lines ± 2.5 ft: 2.5, 7.5, …, 37.5 ft from the left deck edge; x̄ = 20 ft; Σc² = 2(17.5² + 12.5² + 7.5² + 2.5²) = 1,050 ft²
  const R = D('ridot'); assert.deepEqual(J(R.stems.ub), [2.5, 7.5, 12.5, 17.5, 22.5, 27.5, 32.5, 37.5]); assert.equal(R.stems.N, 8); assert.equal(R.N, 4); near(R.stems.S2, 1050);
  // RIDOT 60/40 per stem: the left barrier 0.30 klf: 0.6 P to the outer stem of G1, 0.4 P over the 6 stems that are not the outer stems
  // G1 = 0.18 + 0.02 + (right barrier) 0.02 = 0.22 +  sidewalks (0.5 klf each: 0.30 + 0.0333 + 0.0333) = 0.36667 → DC2 0.58667 (was 0.48); G2 = 4 × 0.02 + 4 × 0.03333 = 0.21333 (was 0.32)
  near(R.dc2[0], 0.18 + 0.02 + 0.02 + 0.3 + 0.5 * 0.4 / 6 * 2, 1e-12, 'RIDOT G1'); near(R.dc2[1], 4 * 0.02 + 4 * 0.5 * 0.4 / 6, 1e-12, 'RIDOT G2');
  assert.equal(R.dc2[0].toFixed(4), '0.5867'); assert.equal(R.dc2[1].toFixed(4), '0.2133'); near(R.dc2.reduce((a, v) => a + v, 0), 2 * 0.3 + 2 * 0.5, 1e-12, 'the total kept');
  R.per.forEach(L => L.r.forEach((v, b) => near(v, L.rSt[2 * b] + L.rSt[2 * b + 1], 1e-15, L.id)));   // each beam = its two stems
  // MassDOT pile cap per stem: the left sidewalk 0.5 klf at x = 2.5 (e = −17.5): stems 1, 2 of G1: 0.5/8 + 0.5(17.5)(17.5)/1050 = 0.20833, 0.0625 + 0.5(17.5)(12.5)/1050 = 0.16667 → G1 0.375 (was 0.125 + 0.5(17.5)(15)/500 = 0.3875)
  const M = D('massdot'), sw = M.per.find(L => L.id === 'swL'); near(sw.rSt[0], 0.0625 + 0.5 * 17.5 * 17.5 / 1050, 1e-12); near(sw.rSt[1], 0.0625 + 0.5 * 17.5 * 12.5 / 1050, 1e-12); near(sw.r[0], 0.375, 1e-12);
  // AASHTO: equally to all stems = P / (2 N_b) per stem, P / N_b per beam: as before
  const A = D('aashto'); A.dc2.forEach(v => near(v, 0.4, 1e-12, 'AASHTO equal')); A.dw.forEach(v => near(v, 0.75 / 4, 1e-12));
  // the engine inputs and the Strength I moment: G1 RIDOT ΔM_DC2 = (0.58667 − 0.48)(45²)/8 = 27.0 k-ft, ΔM_u = 1.25(27.0) = 33.75 k-ft
  const Q = P('ridot'), c1 = cell(W, Q, 1); near(c1.inp.loads.wBar, R.dc2[0], 1e-12); const Md = r => r.diagrams.reduce((b, q) => Math.abs(q.x - 22.5) < Math.abs(b.x - 22.5) ? q : b).M_DC2;
  near(Md(c1.R), R.dc2[0] * 45 ** 2 / 8, 1e-9, 'M_DC2 at midspan');
  // the steps: each stem's share, and the beam's = stem 1 + stem 2
  const st = W.PSBBridgeDL.stepsFor(Q, 1), s = id => st.find(x => x.id === id);
  ['dl.G1.st1.DC2', 'dl.G1.st2.DC2', 'dl.G1.DC2', 'dl.G1.st1.barL', 'dl.G1.barL'].forEach(id => assert.ok(s(id), id));
  near(s('dl.G1.DC2').value, s('dl.G1.st1.DC2').value + s('dl.G1.st2.DC2').value, 1e-15); near(s('dl.G1.DC2').value, R.dc2[0], 1e-15);
  assert.ok(/G1, left, outer stem/.test(s('dl.G1.st1.DC2').label) && /sum of its two stems/.test(s('dl.G1.DC2').label));
  // any other girder: per girder line, as before (no stems)
  const B = W.PSBModel.newProject(); B.xs.dl = W.PSBBridgeDL.defaults(B); B.xs.dl.mode = 'distributed'; const RB = W.PSBBridgeDL.distribute(B); assert.ok(RB && !RB.stems && !RB.nx && RB.N === B.xs.nb);
});

test('NX-O2: the deck slab (DC1) of a NEXT beam on its two stems\' tributary width (was the flange width b_f); interior and a deck edge at the flange edge: unchanged', () => {
  // overhangs 6 ft: G1 stems: left 6 ft (to the deck edge), right 10/2 = 5 ft: 11 ft = 132 in (b_f = 120 in): w_deck = 132(8)/144(0.150) = 1.100 klf (was 120(8)/144(0.150) = 1.000)
  const P = project(W, Q => { Q.xs.ohL = 6; Q.xs.ohR = 6; }), e = cell(W, P, 1), i = cell(W, P, 2);
  assert.deepEqual(J(e.inp.nxDL), { c: 2.5, a: 6, b: 5, trib: 11 }); near(e.R.cp.wdkW, 132, 1e-12); near(e.R.cp.wdkDeck, 132 * 8 / 144 * 0.150, 1e-12); assert.equal(e.R.cp.wdkDeck.toFixed(3), '1.100');
  near(e.R.cp.nxB, 120, 1e-12, 'the engine\'s b_f kept'); near(e.R.cp.wdk, e.R.cp.wdkDeck + e.R.cp.wdkHaunch, 1e-12);
  near(i.R.cp.wdkW, 120, 1e-12, 'interior: 5 + 5 ft = 10 ft = b_f'); assert.equal(i.R.cp.wdkDeck.toFixed(3), '1.000');
  const st = W.PSBWorked.loads(e.inp, e.R).steps.find(x => x.id === 'ld.wdeck'); assert.ok(st && /per stem \(NX-O2/.test(st.note) && Object.is(st.value, e.R.cp.wdkDeck), st && st.note);
  // the section properties and b_eff unchanged
  const P5 = project(W), e5 = cell(W, P5, 1); assert.equal(e5.R.cp.Ic, e.R.cp.Ic); assert.equal(e5.R.cp.beff, e.R.cp.beff); near(e5.R.cp.wdkW, 120, 1e-12, 'G1 with 5 ft: 5 + 5 = b_f');
});
