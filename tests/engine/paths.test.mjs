// Paths PR (2026-10-30; engineer's decisions SB2-W1, SB2-W2, shared cache, Welds): every demand path takes the same brace points and f_ℓ.
// 1. One source: engine/framing.js design() gives the brace points (the Framing & bracing tab) and f_ℓ (entered, else from skew, C6.10.1) that the
//    Flexure, Constructibility and Rating builds use, with this project's analysis and with a hand-off file; an entry overrides the skew value.
// 2. The analysis cache (report/data.js install): switching between the output tabs runs no analysis again; results are not modified.
// 3. The report's Welds section (both scopes; the analysis and a hand-off file).
// 4. Hand check on a skewed girder (arithmetic in the comments).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'engine/welds.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js',
  'ui/splices.js', 'ui/constructibility.js', 'ui/welds.js', 'report/data.js', 'report/builders.js'].map(E));
const J = v => JSON.parse(JSON.stringify(v));
const payload = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/projects/st', f), 'utf8')).payload;
const katex = (() => { const c = loadShared(path.join(ROOT, 'tests/libs/katex@0.16.9/dist/katex.min.js')); return c.katex; })();

/* one realm, the cache installed as index.html does; raw analysis runs counted */
const W = loadShared(...FILES);
let runs = 0;
const RAW = W.SBDAnalysis.analyzeGirder;
W.SBDAnalysis.analyzeGirder = (P, gi, o) => { runs++; return RAW(P, gi, o); };
assert.equal(W.SBDReportData.install(), true); assert.equal(W.SBDReportData.install(), false, 'installed once');
/* the built-in project with every support skewed 28° (> 20°: f_ℓ from skew) */
const skewed = () => { const P = W.SBDModel.defaultProject(); P.xs.skews = P.xs.skews.map(() => 28); return P; };

test('One source of f_ℓ and brace points: Flexure, Constructibility and Rating (this project\'s analysis), built-in project skewed 28°', () => {
  for (const pos of ['interior', 'exterior']) {
    const P = skewed(); P.girders[0].position = pos;
    const D = W.SBDFraming.design(P, 0);
    // C6.10.1: interior 1.25(10) = 12.50 ksi; exterior 1.25(7.5) = 9.375 → 9.38 ksi (rounded to 0.01, as Preliminary sizing)
    assert.equal(D.fl, pos === 'interior' ? 12.5 : 9.38); assert.equal(D.flSrc, 'skew'); assert.ok(D.br && D.braces.length > 10);
    const F = W.SBDFlexureUI.build({ P, g: 0, src: 'analysis', method: 'auto' }), R = W.SBDRatingUI.build({ P, g: 0, src: 'analysis' }), C = W.SBDConstrUI.build({ P, g: 0, src: 'project' });
    assert.ok(!F.err && !R.err && !C.err, F.err || R.err || C.err);
    // F2/F3 (2026-11-19): every location takes the unfactored f_ℓ,skew of the layout at its station (D.flAt), split per load combination (sb-flskew-appl.test.mjs)
    assert.ok(F.rows.every(r => r.flSk === D.flAt(r.x)), 'Flexure f_ℓ,skew'); assert.ok(F.rows.some(r => r.flSk > 0) && F.rows.some(r => r.flSk === 0), 'regional');
    assert.ok(R.flex.rows.every(r => r.flSk === D.flAt(r.x)), 'Rating f_ℓ,skew'); assert.ok(C.rows.every(r => r.flC === D.fl), 'Constructibility f_ℓ');
    assert.deepEqual(J(F.D.braces), J(D.braces)); assert.deepEqual(J(R.flex.D.braces), J(D.braces)); assert.deepEqual(J(C.F.braces), J(D.braces));
    // every flexure location's unbraced segment lies between two of those brace points (both flexure results)
    const bs = new Set(D.braces.map(v => +v.toFixed(6)));
    [F, R.flex].forEach(G => G.rows.forEach(r => { if (r.seg) { assert.ok(bs.has(+r.seg.xa.toFixed(6)) && bs.has(+r.seg.xb.toFixed(6)), `${r.name} ${JSON.stringify(r.seg)}`); } }));
    assert.ok(W.SBDReportData.sameFlex(F, R.flex), 'the rating\'s flexure equals the Flexure tab\'s');
    assert.match(F.what, /Framing (&amp;|&) bracing tab/); assert.match(F.what, /from skew/);
    // entries override: Flexure (and so Rating) P.flexure.fl, Constructibility P.constr.flC; 0 / absent: back to skew
    P.flexure = { fl: 3 }; P.constr = { flC: 2 };
    const F2 = W.SBDFlexureUI.build({ P, g: 0, src: 'analysis', method: 'auto' }), R2 = W.SBDRatingUI.build({ P, g: 0, src: 'analysis' }), C2 = W.SBDConstrUI.build({ P, g: 0, src: 'project' });
    assert.ok(F2.rows.every(r => r.fl === 3) && R2.flex.rows.every(r => r.fl === 3) && C2.rows.every(r => r.flC === 2));
    assert.ok(F2.rows.every(r => r.flSv === 3 && r.flSk === undefined), 'an entry: the same value at Service II');
    P.flexure.fl = 0; P.constr.flC = 0; assert.ok(W.SBDFlexureUI.build({ P, g: 0, src: 'analysis', method: 'auto' }).rows.every(r => r.flSk === D.flAt(r.x)));
    assert.ok(W.SBDConstrUI.build({ P, g: 0, src: 'project' }).rows.every(r => r.flC === D.fl));
  }
  // the model: P.flexure.fl validated (a number ≥ 0) and kept through export / import
  const M = W.SBDModel, P = M.defaultProject(); P.flexure = { fl: 'x' }; assert.ok(M.validate(P).errors.some(e => e.path === 'flexure.fl'));
  P.flexure = { fl: -1 }; assert.ok(M.validate(P).errors.some(e => e.path === 'flexure.fl'));
  P.flexure = { fl: 4.5 }; assert.equal(M.validate(P).errors.length, 0); assert.equal(M.importJSON(M.exportJSON(P)).project.flexure.fl, 4.5);
});

test('One source with a hand-off file of this bridge (gd_builtin28_AASHTO_G2): Flexure, Constructibility and Rating', () => {
  const pl = payload('gd_builtin28_AASHTO_G2.json'), P = skewed();
  const D = W.SBDFraming.design(P, 0, { sup: pl.member.supports, line: 1, skews: pl.girderDetail.skew.bySupport, ext: false });
  assert.equal(D.fl, 12.5); assert.ok(D.br, 'same supports: this project\'s framing');
  const F = W.SBDFlexureUI.build({ P, g: 0, src: 'file', pl, plName: 'f', method: 'auto' }), R = W.SBDRatingUI.build({ P, g: 0, pl }), C = W.SBDConstrUI.build({ P, g: 0, pl });
  assert.ok(!F.err && !R.err && !C.err, F.err || R.err || C.err);
  assert.ok(F.rows.every(r => r.flSk === D.flAt(r.x)) && R.flex.rows.every(r => r.flSk === D.flAt(r.x)) && C.rows.every(r => r.flC === 12.5), 'f_ℓ (the rating took 0 before)');   // F3: by the layout
  assert.deepEqual(J(F.D.braces), J(D.braces)); assert.deepEqual(J(R.flex.D.braces), J(D.braces)); assert.deepEqual(J(C.F.braces), J(D.braces));
  assert.ok(W.SBDReportData.sameFlex(F, R.flex));
});

test('Shared analysis cache: switching between the output tabs runs no analysis again', () => {
  const P = W.SBDModel.defaultProject(); P.deck.haunch += 0.125;   // a project state no earlier test analysed
  const n0 = runs, tabs = [
    () => W.SBDRatingUI.build({ P, g: 0, src: 'analysis' }), () => W.SBDFlexureUI.build({ P, g: 0, src: 'analysis', method: 'auto' }), () => W.SBDShearUI.build({ P, g: 0, src: 'analysis' }),
    () => W.SBDFatigueUI.build({ P, g: 0, src: 'analysis' }), () => W.SBDWeldsUI.build({ P, g: 0, src: 'analysis' }), () => W.SBDConstrUI.build({ P, g: 0, src: 'project' }),
    () => W.SBDFramingUI.build({ P, g: 0 }), () => W.SBDAnalysis.analyzeGirder(P, 0)];
  tabs.forEach(t => { const r = t(); assert.ok(!(r && r.err), r && r.err); });
  assert.equal(runs - n0, 2, 'one full analysis and one dead-load analysis for this project state');
  const n1 = runs; for (let k = 0; k < 3; k++) tabs.forEach(t => t());
  assert.equal(runs, n1, 'switching tabs again: cache hits only');
  W.SBDReportData.compute(P, 0); assert.equal(runs, n1, 'the report too');
  P.flexure = { fl: 3 }; W.SBDShearUI.build({ P, g: 0, src: 'analysis' }); assert.equal(runs, n1, 'f_ℓ entered (P.flexure) is not in the analysis key'); delete P.flexure;
  // the cached result was not modified by any tab
  assert.equal(JSON.stringify(W.SBDAnalysis.analyzeGirder(P, 0)), JSON.stringify(RAW(P, 0)));
  // a change to the project: a new analysis
  P.deck.haunch += 0.125; W.SBDShearUI.build({ P, g: 0, src: 'analysis' }); assert.equal(runs, n1 + 1);
});

test('Report: the Welds section (selected girder, both detail levels; every girder; a hand-off file)', () => {
  const P = W.SBDModel.defaultProject(), B = W.SBDReportData.compute(P, 0);
  assert.equal(JSON.stringify(B.err), '{}'); assert.ok(B.wd && B.wd.R.fw.length > 0);
  const tex = new Set(), grab = t => String(t == null ? '' : t).replace(/\$([^$]+)\$/g, (m, x) => { tex.add(x); return m; });
  for (const detail of ['gov', 'all']) {
    const M = W.SBDReportBuild.model(B, { detail }), doc = W.SharedReport.build(M), s = M.sections.find(q => q.id === 'wd');
    assert.ok(s, 'Welds section'); assert.deepEqual(J(doc.unresolved), []); assert.deepEqual(J(doc.dup), []);
    const g = M.gov.filter(q => q.mod === 'Welds'); assert.equal(g.length, 3);
    g.forEach(q => { assert.ok(q.key && doc.index.has(q.key), q.check); });
    // the governing values are the Welds tab's (its build); the strength checks (FW1, FW2) first, not FW4 at 1.000 (2026-11-01)
    assert.equal(JSON.stringify(g.map(q => q.grp)), JSON.stringify(['Welds: strength (FW1, FW2)', 'Welds: fatigue (FW3, TR1)', 'Welds: detailing limits (FW4, TR2–TR4)']));
    const fw = B.wd.C.filter(c => /^FW[12]$/.test(c.id)).flatMap(c => c.items).filter(it => typeof it.r === 'number' && isFinite(it.r)).reduce((m, it) => Math.max(m, it.r), -Infinity);
    assert.equal(g[0].r, fw);
    s.subs.forEach(q => q.items.forEach(it => { grab(it.text); (it.head || []).forEach(grab); (it.rows || []).forEach(r => (Array.isArray(r) ? r : r.cells).forEach(c => grab(c && typeof c === 'object' ? c.t : c))); }));
    assert.ok(!/NaN|undefined|\[object/.test(W.SharedReport.text(doc)));
  }
  tex.forEach(t => assert.doesNotThrow(() => katex.renderToString(t, { throwOnError: true, strict: 'ignore' }), t));
  // every girder: the Welds groups are in the summary
  const list = P.girders.map((g, gi) => { const Bg = W.SBDReportData.compute(P, gi), r = W.SBDReportBuild.govRows(Bg); return { gi, label: g.label, rows: r.rows, err: r.err, B: Bg }; });
  const AM = W.SBDReportBuild.allModel(P, list), d2 = W.SharedReport.build(AM);
  assert.deepEqual(J(d2.unresolved), []); ['Welds: strength (FW1, FW2)', 'Welds: fatigue (FW3, TR1)', 'Welds: detailing limits (FW4, TR2–TR4)'].forEach(k => assert.ok(AM.ctl.get(k), k));
  // a hand-off file: the Welds tab's file source
  const pl = payload('gd_builtin_AASHTO_G1.json'), BF = W.SBDReportData.compute(P, 0, { src: 'file', pl, plName: 'gd_builtin_AASHTO_G1.json' });
  assert.ok(BF.wd && !BF.err.wd, BF.err.wd); assert.equal(BF.wd.src, 'file');
  const WF = W.SBDWeldsUI.build({ P, g: 0, pl }); assert.equal(JSON.stringify(WF.C.map(c => c.items.map(it => it.r))), JSON.stringify(BF.wd.C.map(c => c.items.map(it => it.r))));
  const MF = W.SBDReportBuild.model(BF, { detail: 'gov' }), dF = W.SharedReport.build(MF); assert.deepEqual(J(dF.unresolved), []); assert.ok(MF.sections.some(q => q.id === 'wd'));
  console.log(`       Welds: ${B.wd.R.fw.length} weld locations, ${B.wd.R.tr.length} transitions; governing ${list[0].rows.filter(q => q.mod === 'Welds').map(q => `${q.check} ${q.r.toFixed(3)}`).join('; ')}`);
});

test('Hand check (SB2-W1): built-in project skewed 28°, G1 interior, x = 44 ft (span 1, positive flexure), this project\'s analysis', () => {
  // f_ℓ from skew (C6.10.1): largest support skew 28° > 20°, interior girder: f_ℓ = 1.25(10.00) = 12.50 ksi (before: 0 on this path)
  const P = skewed(), A = W.SBDRatingUI.fromAnalysis(P, 0);
  const F = W.SBDFlexureUI.build({ P, g: 0, src: 'analysis', an: A, method: 'auto' }), F0 = W.SBDFlexureUI.build({ P, g: 0, src: 'analysis', an: A, method: 'auto', fl: 1e-12 });
  const r = F.rows.find(q => Math.abs(q.x - 44) < 1e-6), r0 = F0.rows.find(q => Math.abs(q.x - 44) < 1e-6), ck = (row, id, t) => row.checks.find(c => c.id === id && (!t || t.test(c.title)));
  // F3 (2026-11-19, C6.10.1 p. 6-160): x = 44 ft lies between two contiguous cross-frames (normal frames, contiguous lines): the skew estimate need not
  // be considered there: f_ℓ = 0 (before 2026-11-19: 1.25(10) = 12.50 ksi everywhere; GS12 32.942 ksi 0.6935, GS6 0.5839, GS10 0.4167)
  assert.equal(r.flSk, 0); assert.equal(r.fl, 0); assert.equal(r.flSv, 0);
  // GS12, Service II bottom flange (Eq. 6.10.4.2.2-2): f_f + f_ℓ/2 = 26.692 + 0 = 26.692 ≤ 0.95(1.0)(50) = 47.50 ksi → 0.5619 (f_f with the cross-frame weights in DC1, SB2-A6)
  const s = ck(r, 'GS12', /bottom/), s0 = ck(r0, 'GS12', /bottom/);
  assert.ok(Math.abs(s0.demand - 26.6923) < 1e-3 && Math.abs(s.demand - s0.demand) < 1e-9 && s.capacity === 47.5, `${s0.demand} ${s.demand}`);
  assert.ok(Math.abs(s.ratio - 0.5619) < 1e-4);
  // GS6, compact section (Eq. 6.10.7.1.1-1): M_u = 4,998.44 kip-ft ≤ φ_fM_n = 9,616.14 kip-ft → 0.5198; no GS10 (f_ℓ = 0)
  const g6 = ck(r, 'GS6'); assert.ok(Math.abs(g6.ratio - 0.5198) < 1e-4, `${g6.ratio}`); assert.equal(ck(r, 'GS10'), undefined);
  // a location next to a discontinuous frame takes 10 ksi, split per combination (hand check in sb-flskew-appl.test.mjs)
  assert.ok(F.rows.some(q => q.flSk === 10 && q.fl > 10 && q.flSv > 10 && q.flSv < q.fl));
});
