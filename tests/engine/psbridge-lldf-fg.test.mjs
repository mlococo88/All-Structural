// apps/ps-bridge PS-35 (engineer decision 2026-11-14): the live-load distribution factors of adjacent box beams and voided slabs, AASHTO
// LRFD 10th Ed. cross-section types (f) / (g) (engine/lldf-fg.js, an app-side override of the moved engine's distFactors; the engine files
// unchanged). Hand checks of the PR's §4 callout: (1) BI-36, 60 ft, no topping (type g), interior and exterior; (2) BIII-36, 60 ft, 6 in
// topping (type f: composite I and J); (3) SIV-48, 50 ft (voided slab: J of the outer cell; I outside the shear range: the larger of the shear
// and moment factors). (4) I-girders, NEXT and the solid slabs: byte-identical results (the harness B designs, a solid slab). (5) skew: the
// moment reduction with the smaller skew (none when the skews differ by more than 10°), the shear correction with the larger. (6) J: the
// girder type's entered value, then a library value, then the outline's; the J override saved per type; an old project loads unchanged.
// (7) out-of-range limits listed, in R.warns and on the Loads input tab; (8) the worked steps = the engine values (Loads & LLDF tab), the
// fatigue DF; the Report.
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const ENG = ['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`));
const UI = ['outkit', 'vizkit', 'section', 'loads', 'inputs'].map(n => path.join(APP, `ui/${n}.js`));
const W = loadShared('steps.js', ...PBD, ...ENG, ...UI, 'report.js', ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
const J = v => JSON.parse(JSON.stringify(v));
const near = (a, b, tol = 1e-9, m = '') => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${m} ${a} vs ${b}`);
const FG = W.PSBLldfFG;
/* a design: girder, topping, span, beams (bays: 3 ft for the 36 in series, 4 ft for 48 in), the design girder */
const proj = (girder, ts, L, nb, g, f) => { const P = W.PSBModel.defaultProject(); P.base.girder = girder; P.base.ts = ts; P.base.harp.n = 0; P.base.rows = [{ n: 10, y: 2, nd: 0, dbnd: 0 }];
  P.xs.nb = nb; P.xs.bays = Array(nb - 1).fill(/-48/.test(girder) ? 4 : 3); P.xs.ohL = P.xs.ohR = 1.5; P.spans.lengths = [L]; P.design = { g: g || 2, s: 1 }; if (f) f(P); return P; };
const run = P => { const inp = W.PSBDesign.inputs(P); return { inp, R: W.PSBHoldDown.compute(J(inp)) }; };
const engineOnly = inp => { const W0 = globalThis; return vm.runInContext('computeAll', W)(J(inp)); };

test('PS-35 (1) BI-36 (27in), 60 ft, no topping, 5 beams: type (g) by hand (J of the box cell, k, g_M, g_V); exterior e factors', () => {
  const { inp, R } = run(proj('AASHTO BI-36 (27in)', 0, 60, 5, 2)), f = R.df.fg;
  assert.equal(f.type, 'g'); assert.equal(f.Isrc, 'girder'); assert.equal(f.Jsrc, 'computed');
  // box cell: t_w = (35.5 − 25.5) / 2 = 5; t_b = t_t = 5.5; b0 = 30.5; h0 = 27 − 5.5 = 21.5; A0 = 655.75; Σ s/t = 2(30.5 / 5.5) + 2(21.5 / 5) = 19.690909
  near(f.jw.tw, 5); near(f.jw.tb, 5.5); near(f.jw.tt, 5.5); near(f.jw.b0, 30.5); near(f.jw.h0, 21.5); near(f.jw.A0, 655.75); near(f.jw.sum, 2 * 30.5 / 5.5 + 2 * 21.5 / 5);
  const Jh = 4 * 655.75 ** 2 / (2 * 30.5 / 5.5 + 2 * 21.5 / 5); near(f.J, Jh); near(Jh, 87351.59, 1e-6);
  const IJ = 49495 / Jh, k = 2.5 * 5 ** -0.2, b = 35.5, L = 60;
  near(f.k, k); near(k, 1.811949, 1e-6);
  const m1 = k * (b / (33.3 * L)) ** 0.5 * IJ ** 0.25, m2 = k * (b / 305) ** 0.6 * (b / (12 * L)) ** 0.2 * IJ ** 0.06;
  const v1 = (b / (130 * L)) ** 0.15 * IJ ** 0.05, v2 = (b / 156) ** 0.4 * (b / (12 * L)) ** 0.1 * IJ ** 0.05 * 1.0;
  near(R.df.m1, m1); near(R.df.m2, m2); near(R.df.v1, v1); near(R.df.v2, v2);
  near(R.dfm, Math.max(m1, m2)); near(R.dfv, Math.max(v1, v2)); near(R.dfm, 0.263925, 1e-5); near(R.dfv, 0.432897, 1e-5);
  // before (the moved engine's type (k), K_g / 12 L t_s³ with t_s = 0 guarded to 1e-6)
  const R0 = engineOnly(inp); near(R0.dfm, 2.017459, 1e-6); assert.ok(R0.dfm > 1.7);
  near(f.engine.dfm, R0.dfm);
  // exterior G1 (d_e = 2.0 ft): e_M1 = 1.125 + 2/30, e_M2 = 1.04 + 2/25, e_V1 = 1.25 + 2/20, e_V2 = 1 + ((2 + 35.5/12 − 2)/40)^0.5; 48/b → 1.0
  const X = run(proj('AASHTO BI-36 (27in)', 0, 60, 5, 1)).R, fx = X.df.fg;
  assert.equal(X.df.ext, true); near(fx.eM1, 1.125 + 2 / 30); near(fx.eM2, 1.04 + 2 / 25); near(fx.eV1, 1.35); near(fx.eV2, 1 + Math.sqrt((2 + 35.5 / 12 - 2) / 40)); near(fx.f48, 1);
  near(X.dfm, Math.max((1.125 + 2 / 30) * m1, 1.12 * m2)); near(X.dfv, Math.max(1.35 * v1, (1 + Math.sqrt((35.5 / 12) / 40)) * v2));
  assert.equal(X.df.lever, 0); assert.equal(X.df.rigid, 0); near(X.df.rigid1, (1.125 + 2 / 30) * m1);
  // fatigue: interior g_M1 / 1.2; exterior e_M1 g_M1 / 1.2
  near(R.fat.dfFat, m1 / 1.2); near(X.fat.dfFat, (1.125 + 2 / 30) * m1 / 1.2);
  assert.deepEqual(J(f.out), []); assert.ok(!R.warns.some(w => /PS-35/.test(w)));
});

test('PS-35 (2) BIII-36 (39in), 60 ft, 6 in topping: type (f), composite I_c and the cell J with the topping (n t_s on the top wall)', () => {
  const { R } = run(proj('AASHTO BIII-36 (39in)', 6, 60, 5, 2)), f = R.df.fg, cp = R.cp, n = cp.n;
  assert.equal(f.type, 'f'); assert.equal(f.Isrc, 'composite'); near(f.I, cp.Ic);
  const tw = 6, tb = 5.5, tt = 5.5, tT = tt + n * 6, yT = (tt * (39 - tt / 2) + n * 6 * (39 + 3)) / tT, b0 = 35.5 - 6, h0 = yT - tb / 2, A0 = b0 * h0, S = b0 / tT + b0 / tb + 2 * h0 / tw;
  near(f.jw.tw, tw); near(f.jw.tT, tT); near(f.jw.yT, yT); near(f.J, 4 * A0 * A0 / S);
  const IJ = cp.Ic / f.J, k = 2.5 * 5 ** -0.2, b = 35.5, L = 60;
  near(R.df.m2, k * (b / 305) ** 0.6 * (b / (12 * L)) ** 0.2 * IJ ** 0.06); near(R.dfm, Math.max(R.df.m1, R.df.m2));
  near(R.dfv, Math.max((b / (130 * L)) ** 0.15 * IJ ** 0.05, (b / 156) ** 0.4 * (b / (12 * L)) ** 0.1 * IJ ** 0.05));
});

test('PS-35 (3) SIV-48 (21in), 50 ft, 6 beams: the voided slab as one closed cell (plate voids); I < 40,000 in⁴: shear = max(shear eq., moment), flagged', () => {
  const { R } = run(proj('AASHTO SIV-48 (21in)', 0, 50, 6, 3)), f = R.df.fg;
  // voids Ø12 at ±14, Ø10 at 0 (y = 10.5): t_w = 23.75 − 14 − 6 = 3.75; t_b = t_t = 10.5 − 6 = 4.5; b0 = 43.75; h0 = 21 − 4.5 = 16.5
  near(f.jw.tw, 3.75); near(f.jw.tb, 4.5); near(f.jw.tt, 4.5); near(f.jw.b0, 43.75); near(f.jw.h0, 16.5);
  const S = 2 * 43.75 / 4.5 + 2 * 16.5 / 3.75, Jh = 4 * (43.75 * 16.5) ** 2 / S; near(f.J, Jh); near(Jh, 73799.3, 1e-5);
  const IJ = 33759 / Jh, k = 2.5 * 6 ** -0.2, b = 47.5, L = 50;
  const m1 = k * (b / (33.3 * L)) ** 0.5 * IJ ** 0.25, m2 = k * (b / 305) ** 0.6 * (b / (12 * L)) ** 0.2 * IJ ** 0.06;
  const v1 = (b / (130 * L)) ** 0.15 * IJ ** 0.05, v2 = (b / 156) ** 0.4 * (b / (12 * L)) ** 0.1 * IJ ** 0.05 * Math.max(b / 48, 1);
  near(R.dfm, Math.max(m1, m2)); assert.equal(f.IJout, true); near(R.dfv, Math.max(v1, v2, m1, m2));
  assert.deepEqual(J(f.out.map(o => o.key)), ['I']);
  assert.ok(R.warns.some(w => /^Live load distribution, type \(g\) adjacent voided slab equations \(PS-35\) used outside their range of applicability: I = 33,759 in⁴ is outside 40,000 ≤ I ≤ 610,000 in⁴/.test(w)), R.warns.join('|'));
});

test('PS-35 (4) I-girders, NEXT and solid deck slabs: results byte-identical with and without the override (every harness B design that is not a box; a solid slab)', () => {
  const C = TAB_CASES(() => W.PSBModel.defaultProject());
  const P = proj('Deck slab 18×48 (solid)', 0, 40, 6, 3); C['solid slab'] = P;
  let n = 0;
  for (const [name, Q] of Object.entries(C)) {
    const inp = W.PSBDesign.inputs(Q), g = W.girderGross(inp); if (FG.isFG(g)) continue; n++;
    const a = W.PSBHoldDown.compute(J(inp)), saved = W.PSBLldfFG; W.PSBLldfFG = undefined;
    let b; try { b = W.PSBHoldDown.compute(J(inp)); } finally { W.PSBLldfFG = saved; }
    assert.equal(JSON.stringify(a), JSON.stringify(b), name); assert.equal(a.df.fg, undefined, name);
  }
  assert.ok(n >= 15, 'designs ' + n);
});

test('PS-35 (5) skew: r_M = min(1.05 − 0.25 tan θ_M, 1) with the smaller skew (none when the skews differ by > 10°); c_V = 1 + (12 L / 90 d) √tan θ', () => {
  const t = d => Math.tan(d * Math.PI / 180);
  const a = run(proj('AASHTO BI-36 (27in)', 0, 60, 5, 2, P => { P.xs.skews = [25, 25]; })).R;
  near(a.df.skM, Math.min(1.05 - 0.25 * t(25), 1)); near(a.df.skV, 1 + 12 * 60 / (90 * 27) * Math.sqrt(t(25))); assert.equal(a.df.fg.thM, 25);
  const b = run(proj('AASHTO BI-36 (27in)', 0, 60, 5, 2, P => { P.xs.skews = [20, 28]; })), bi = b.inp, bR = b.R;
  assert.equal(bi.loads.skew, 28); assert.equal(bi.loads.skewLo, 20);
  near(bR.df.skM, Math.min(1.05 - 0.25 * t(20), 1)); near(bR.df.skV, 1 + 12 * 60 / (90 * 27) * Math.sqrt(t(28)));
  const c = run(proj('AASHTO BI-36 (27in)', 0, 60, 5, 2, P => { P.xs.skews = [0, 25]; })).R;
  assert.equal(c.df.skM, 1); assert.equal(c.df.fg.thM, 0); near(c.df.skV, 1 + 12 * 60 / (90 * 27) * Math.sqrt(t(25)));
  // the smaller skew is passed only for a box / voided slab with unequal skews: an I-girder's inputs unchanged
  const d = W.PSBDesign.inputs(proj('PCI BT-72', 8, 100, 5, 2, P => { P.xs.bays = [9, 9, 9, 9]; P.xs.skews = [0, 25]; }));
  assert.equal('skewLo' in d.loads, false);
  const e = W.PSBDesign.inputs(proj('AASHTO BI-36 (27in)', 0, 60, 5, 2)); assert.equal('skewLo' in e.loads, false);
  // d = 15 in (SII) is below 17 in: flagged only with a skew (the shear correction)
  assert.ok(!run(proj('AASHTO SII-36 (15in)', 0, 40, 6, 2)).R.df.fg.out.some(o => o.key === 'd'));
  assert.ok(run(proj('AASHTO SII-36 (15in)', 0, 40, 6, 2, P => { P.xs.skews = [15, 15]; })).R.df.fg.out.some(o => o.key === 'd'));
});

test('PS-35 (6) J: the type\'s entered value ("user/DOT value") over a library value over the outline; saved per type; an old project unchanged', () => {
  const P = proj('AASHTO BI-36 (27in)', 0, 60, 5, 2), base = run(P).R;
  const Q = J(P); Q.base.loads.Jfg = 120000; const u = run(Q).R;
  assert.equal(u.df.fg.Jsrc, 'user'); assert.equal(u.df.fg.J, 120000); near(u.df.fg.jw.J, base.df.fg.J);
  near(u.df.m1, base.df.fg.k * (35.5 / (33.3 * 60)) ** 0.5 * (49495 / 120000) ** 0.25);
  const Q2 = J(P); Q2.base.loads.Jfg = ''; assert.equal(run(Q2).R.df.fg.Jsrc, 'computed');
  // a library value (none today: the DOT sheets come later) takes precedence over the outline, not over the entered value
  const S = W.PSBSections, d0 = S.dotJ; S.dotJ = n => (n === 'AASHTO BI-36 (27in)' ? { J: 90000, src: 'test sheet' } : null);
  try { const l = run(P).R; assert.equal(l.df.fg.Jsrc, 'library'); assert.equal(l.df.fg.J, 90000); assert.equal(run(Q).R.df.fg.Jsrc, 'user'); }
  finally { S.dotJ = d0; }
  assert.equal(S.dotJ('AASHTO BI-36 (27in)'), null);
  // saved per girder type: a type's own J (T.ovr['loads.Jfg']); the other type keeps the outline's
  const T = W.PSBModel.newProject(); T.base.girder = 'AASHTO BI-36 (27in)'; T.base.ts = 0; T.base.harp.n = 0; T.base.rows = [{ n: 10, y: 2, nd: 0, dbnd: 0 }]; T.xs.bays = [3, 3, 3, 3]; T.spans.lengths = [60];
  const BR = W.PSBBridge, eff = BR.effBase(T, 0); eff.loads.Jfg = 100000; BR.setOvr(T, 0, eff);
  assert.equal(T.types[0].ovr['loads.Jfg'], 100000); assert.ok(!('Jfg' in T.base.loads));
  const T2 = W.PSBModel.importJSON(W.PSBModel.exportJSON(T)).project; assert.equal(T2.types[0].ovr['loads.Jfg'], 100000);
  const r0 = W.PSBHoldDown.compute(W.PSBDesign.cellInputs(T2, 0, BR.typeLines(T2, 0)[0])), r1 = W.PSBHoldDown.compute(W.PSBDesign.cellInputs(T2, 1, BR.typeLines(T2, 1)[0]));
  assert.equal(r0.df.fg.J, 100000); assert.equal(r1.df.fg.Jsrc, 'computed');
  // an old project (no Jfg anywhere) reads and saves unchanged
  const O = W.PSBModel.newProject(), s = W.PSBModel.exportJSON(O), O2 = W.PSBModel.importJSON(s).project; assert.equal(W.PSBModel.exportJSON(O2), s);
});

test('PS-35 (7) out of range: N_b < 5, L > 120, d_e > 2 listed with their limits, in R.warns, on the Loads input tab; the J field only for a box / voided slab', () => {
  const { R } = run(proj('AASHTO BI-36 (27in)', 0, 125, 4, 1, P => { P.base.loads.de = 2.5; P.xs.dl = undefined; }));
  const keys = J(R.df.fg.out.map(o => o.key)); assert.deepEqual(keys, ['L', 'Nb', 'de']);
  assert.match(R.df.fg.out[1].text, /^N_b = 4 is outside 5 ≤ N_b ≤ 20 \(Tables 4\.6\.2\.2\.2b-1, 4\.6\.2\.2\.3a-1\)$/);
  assert.ok(R.warns.some(w => /PS-35/.test(w) && /L = 125\.00 ft is outside 20 ≤ L ≤ 120 ft/.test(w) && /d_e = 2\.50 ft is above d_e ≤ 2\.0 ft/.test(w)));
  const P = proj('AASHTO BI-36 (27in)', 0, 125, 4, 2), html = W.PSBInputsUI.cards('loads', P);
  assert.ok(/data-path="base\.loads\.Jfg"/.test(html)); assert.ok(/id="fgInNote"/.test(html) && /Outside the range of applicability/.test(html) && /N_b = 4 is outside 5 ≤ N_b ≤ 20/.test(html), html.slice(html.indexOf('fglldf'), html.indexOf('fglldf') + 1500));
  const ok = W.PSBInputsUI.cards('loads', proj('AASHTO BI-36 (27in)', 0, 60, 5, 2)); assert.ok(/id="fgInNote"/.test(ok) && /Within the ranges of applicability/.test(ok));
  ['PCI BT-72', 'NEXT 36F', 'Deck slab 12×48 (solid)'].forEach(n => { const Q = W.PSBModel.defaultProject(); Q.base.girder = n; assert.ok(!/base\.loads\.Jfg/.test(W.PSBInputsUI.cards('loads', Q)), n); });
  // the input rule: blank or > 0
  const Q = proj('AASHTO BI-36 (27in)', 0, 60, 5, 2); Q.base.loads.Jfg = -5;
  assert.ok(W.PSBInputCheck.collect(Q).errors.some(e => e.path === 'base.loads.Jfg'));
});

test('PS-35 (8) the worked steps (Loads & LLDF) = the engine values, every derivation reproduces them; the tab and the Report show the (f)/(g) card', () => {
  const designs = [proj('AASHTO BI-36 (27in)', 0, 60, 5, 2), proj('AASHTO BI-36 (27in)', 0, 60, 5, 1, P => { P.xs.skews = [20, 28]; }), proj('AASHTO BIII-36 (39in)', 6, 60, 5, 2),
    proj('AASHTO SIV-48 (21in)', 0, 50, 6, 1, P => { P.xs.skews = [35, 35]; }), proj('AASHTO SII-36 (15in)', 4, 40, 8, 3, P => { P.base.loads.Jfg = 20000; })];
  for (const P of designs) {
    const { inp, R } = run(P), w = W.PSBWorked.loads(inp, R), ids = w.steps.map(s => s.id);
    ['ld.fgI', 'ld.Jc', 'ld.J', 'ld.IJ', 'ld.k', 'ld.m1', 'ld.m2', 'ld.v1', 'ld.v2', 'ld.dfmRaw', 'ld.dfvRaw', 'ld.skM', 'ld.skV', 'ld.dfm', 'ld.dfv'].forEach(id => assert.ok(ids.includes(id), id + ' ' + inp.girder));
    assert.ok(!ids.includes('ld.Kg') && !ids.includes('ld.lever') && !ids.includes('ld.rigid'), inp.girder);
    assert.ok(w.pairs.length >= 16, inp.girder);
    w.pairs.forEach(p => near(p.shown, p.engine, 1e-9, p.id));
    assert.equal(w.steps.find(s => s.id === 'ld.dfm').value, R.dfm);
    const html = W.PSBUiLoads.output({ P, inp, R, W: { loads: w }, ui: {} });
    assert.ok(/Live load distribution factors: (interior|exterior) (box beam|voided slab), type \([fg]\) \(PS-35\)/.test(html), inp.girder);
    assert.ok(!/this engine applies type \(k\)/.test(html));
    const fs = W.PSBWorkedStress.stresses(inp, R).steps.find(s => s.id === 'str.fat.df');
    if (fs && R.df.ext) assert.match(fs.sub || '', /\\frac\{.*\}\{1\.2\}/);
  }
  // the Report: the Loads & LLDF section carries the card and the worked J
  const B = W.PSBReportData.compute(designs[0], null), M = W.PSBReportBuild.model(B, {}), t = JSON.stringify(M);
  assert.ok(t.includes('type (g) (PS-35)') && t.includes('computed from outline'), 'report');
  // a solid slab keeps the engine's type (k) and its note
  const S = proj('Deck slab 18×48 (solid)', 0, 40, 6, 3), r = run(S), hs = W.PSBUiLoads.output({ P: S, inp: r.inp, R: r.R, W: { loads: W.PSBWorked.loads(r.inp, r.R) }, ui: {} });
  assert.ok(/this engine applies type \(k\)/.test(hs) || /type \(k\)/.test(hs));
});
