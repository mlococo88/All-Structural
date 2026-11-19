// Steel Bridge (apps/steel-bridge), engineer's approvals of 2026-11-19 (made-up bridges only: the app's built-in example with its skews,
// depth or concrete changed):
//  F1  the Fatigue & studs tab takes n from w_c for E_c (materials.concrete.wcE, OWN17), the project's K_1 and rounding, as every other tab;
//  F2/F3 the skew f_ℓ of C6.10.1 (AASHTO LRFD 10th Ed. p. 6-160) by the cross-frame layout (engine/framing.js flLayout), split between dead
//      and live load per location with the Strength I and Service II load factors (engine/flexure.js location); deck placement γ f_ℓ,skew;
//  F6  span-to-depth guidance (Art. 2.5.2.6.3, Table 2.5.2.6.3-1, p. 2-14): an informational note, never in a verdict;
//  SA4 applicability of the line-girder analysis (ported from the old app's SA4; I_S = w_g tanθ / L_s, Eq. 4.6.3.3.2-2, p. 4-72).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'engine/welds.js', 'engine/autodesign.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js',
  'ui/splices.js', 'ui/constructibility.js', 'ui/welds.js', 'report/data.js', 'report/builders.js', 'report/summary.js'].map(E));
const W = loadShared(...FILES);
const M = W.SBDModel, FR = W.SBDFraming, near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);
const skewed = (th, f) => { const P = M.defaultProject(); P.xs.skews = P.xs.skews.map(() => th); if (f) f(P); return P; };

test('F1: Fatigue & studs n from w_c for E_c (0.145 kcf), as the Section properties; hand check', () => {
  const P = M.defaultProject(); P.materials.concrete.wcE = 0.145;
  // E_c = 120,000 K_1 w_c² f′c^0.33 = 120,000(1)(0.145)²(4)^0.33 = 2523.0 × 1.58004 = 3986.4 ksi; n = 29,000/3986.4 = 7.274
  // (w_c = 0.150: E_c = 2700(1.58004) = 4266.1 ksi, n = 6.798: the value the Fatigue tab used before)
  const nE = 29000 / (120000 * 0.145 ** 2 * 4 ** 0.33), nW = 29000 / (120000 * 0.15 ** 2 * 4 ** 0.33);
  near(nE, 7.274, 0.001, 'n from w_c for E_c'); near(nW, 6.798, 0.001, 'n from w_c');
  const B = W.SBDFatigueUI.build({ P, g: 0, src: 'analysis' }); assert.ok(!B.err, B.err);
  near(B.FR.MR.n, nE, 1e-9, 'fatigue details'); near(B.SR.MR.n, nE, 1e-9, 'studs');
});

test('F3: skew f_ℓ by the cross-frame layout (C6.10.1): contiguous / near supports / whole span / parallel / ≤ 20° / no framing', () => {
  // interior girder, normal frames, contiguous arrangement, 28°: 10 ksi only at the discontinuous (near-support) frames, 0 elsewhere
  let P = skewed(28), L = FR.flLayout(P, 1, null, false); const dI = L.braces.filter(q => q.v > 0);
  assert.ok(dI.length > 0 && dI.length < L.braces.length / 3, 'some, not all'); assert.ok(dI.every(q => q.v === 10 && q.disc)); assert.equal(L.fMax, 10);
  assert.equal(L.at(180), 0, 'mid span 2: contiguous lines'); assert.equal(L.at(dI[0].x), 10);
  // exterior girder line 0, same layout: 7.5 ksi at its discontinuous frames
  const Le = FR.flLayout(P, 0, null, true); assert.ok(Le.braces.filter(q => q.v > 0).every(q => q.v === 7.5));
  // staggered: discontinuous over the whole span: interior 10 at every intermediate frame, exterior 2.0
  P = skewed(28, Q => { Q.framing.arrange = 'staggered'; });
  const Ls = FR.flLayout(P, 1, null, false), Lse = FR.flLayout(P, 0, null, true);
  assert.ok(Ls.braces.filter(q => q.v === 10).length >= Ls.braces.length - 6, 'about every intermediate frame (bearings 0)'); assert.ok(Ls.braces.filter(q => q.v > 0).length > 3 * dI.length); assert.equal(Lse.fMax, 2.0); assert.ok(Lse.braces.filter(q => q.v > 0).every(q => q.v === 2.0));
  // stated in design(): constructibility γ f0 = 1.25(10) = 12.50 interior; 1.25(2.0) = 2.50 exterior staggered (was 1.25(7.5) = 9.38)
  P.girders[0].position = 'exterior'; P.girders[0].line = 0; const De = FR.design(P, 0); assert.equal(De.fl, 2.5); assert.equal(De.flS.f0, 2.0);
  // parallel to the skew set by hand at 28°: contiguous lines everywhere: 0 (was 12.50)
  P = skewed(28, Q => { Q.framing.orient = 'parallel'; }); assert.equal(FR.flLayout(P, 1, null, false).fMax, 0); assert.equal(FR.design(P, 0).fl, 0);
  // 15° (≤ 20°): none; no framing: 10 / 7.5 over the whole girder as before
  assert.equal(FR.design(skewed(15), 0).flS.f0, 0);
  P = skewed(28, Q => { delete Q.framing; }); const D0 = FR.design(P, 0); assert.equal(D0.flS.lay, null); assert.equal(D0.flAt(180), 10); assert.equal(D0.fl, 12.5);
});

test('F2/F3: made-up 26.9° bridge, interior girder: f_ℓ split between DL and LL; Service II GS12 and Strength I f_ℓ, hand check at x = 110.01 ft', () => {
  const P = skewed(26.9), F = W.SBDFlexureUI.build({ P, g: 0, src: 'analysis', method: 'auto' }); assert.ok(!F.err, F.err);
  const r = F.rows.find(q => Math.abs(q.x - 110.01) < 1e-6); assert.ok(r && r.flSk === 10);
  // unfactored bottom-of-steel stresses (ksi): |f_DC1| 12.767, |f_DC2| 2.017, |f_DW| 1.671, |f_LL+IM| 10.838; Σ = 27.293
  near(r.flp.a.DC1, 12.767, 0.001, 'DC1'); near(r.flp.a.DC2, 2.017, 0.001, 'DC2'); near(r.flp.a.DW, 1.671, 0.001, 'DW'); near(r.flp.a.LL, 10.838, 0.001, 'LL');
  // Strength I: 10(1.25·12.767 + 1.25·2.017 + 1.50·1.671 + 1.75·10.838)/27.293 = 10(39.953)/27.293 = 14.64 ksi (before 1.25·10 = 12.50)
  near(r.fl, 14.639, 0.002, 'Strength I f_ℓ');
  // Service II: 10(12.767 + 2.017 + 1.671 + 1.30·10.838)/27.293 = 10(30.544)/27.293 = 11.19 ksi (before 12.50)
  near(r.flSv, 11.191, 0.002, 'Service II f_ℓ');
  const c = r.checks.find(q => q.id === 'GS12' && q.key === 'svb');
  // GS12 bottom: |f_f| + f_ℓ/2 = 30.544 + 11.191/2 = 36.14 ksi ≤ 0.95(1.0)(50) = 47.50 (ratio 0.761; before 30.544 + 12.50/2 = 36.79, 0.775)
  near(c.demand, Math.abs(r.svc.bot) + r.flSv / 2, 1e-9, 'GS12 uses f_ℓ,SII'); near(c.demand, 36.140, 0.002, 'GS12 demand'); near(c.capacity, 47.5, 1e-9, 'cap');
  // a location between two contiguous frames: no skew f_ℓ (C6.10.1: need not be considered there)
  assert.ok(F.rows.some(q => q.flSk === 0 && !q.checks.some(k => k.id === 'GS10')));
  // deck placement: γ f_ℓ,skew = 1.25(10) = 12.50 ksi (largest on the girder, as DC)
  const C = W.SBDConstrUI.build({ P, g: 0, src: 'project' }); assert.ok(!C.err, C.err); assert.ok(C.rows.every(q => q.flC === 12.5));
});

test('F6: span-to-depth guidance flags a made-up shallow girder, not the normal one; informational only (verdict unchanged)', () => {
  const P = M.defaultProject(), A = W.SBDAutoDesign;
  // normal: continuous, L = 140 ft: d_o = 60 + 0.75 + 1.125 + 2 + 8.5 = 72.375 ≥ 0.032(140)(12) = 53.76; d_s = 61.875 ≥ 0.027(140)(12) = 45.36
  const n = A.depthFlag(P, 0); assert.equal(n.flagged, false); near(n.dO, 72.375, 1e-9, 'd_o'); near(n.G.needO, 53.76, 1e-9, '0.032L');
  // shallow: D = 36 in everywhere: d_s = 36 + 0.75 + 1.125 = 37.875 < 45.36 and d_o = 48.375 < 53.76: flagged
  const S = M.defaultProject(); S.girders[0].segments.forEach(s => { s.D = 36; }); const f = A.depthFlag(S, 0);
  assert.equal(f.flagged, true); near(f.ds, 37.875, 1e-9, 'd_s'); assert.ok(f.rows.every(q => !q.ok)); assert.match(f.text, /below optional AASHTO depth guidance/);
  // the Auto design depth rule (I-beam portion row) uses the same need: 0.027(140)(12) = 45.36 in
  near(A.depthGuide([110, 140, 110], true).needI, 45.36, 1e-9, 'depthGuide');
  // not a column, chip, ratio or verdict count: overall() of a girder summary with and without the note
  const SM = W.SBDSummary, G = { gi: 0, label: 'G1', cells: { flexStr: { st: 'pass', r: 0.8, tab: 'flex' } }, warn: [], err: {} };
  const a = SM.overall(S, [G]), b = SM.overall(S, [{ ...G, depth: f }]); assert.deepEqual(JSON.parse(JSON.stringify(a.n)), JSON.parse(JSON.stringify(b.n))); assert.equal(a.verdict, b.verdict);
  assert.ok(!SM.COLS.some(c => /depth/i.test(c.id)));
});

test('SA4: applicability of the line-girder analysis: no skew (nothing), 25° short wide span (I_S 0.41: WARNING), 65° (FAIL)', () => {
  const AN = W.SBDAnalysis;
  let A = AN.applicability(M.defaultProject()); assert.equal(A.level, 'ok');
  // made-up simple span 43 ft, 5 girders at 9.5 ft (w_g = 38 ft), 25°: I_S = 38 tan25° / 43 = 38(0.46631)/43 = 0.412 > 0.30
  const P = M.defaultProject(); P.spans.lengths = [43]; P.spans.continuity = 'simple'; P.xs.skews = [25, 25];
  P.girders[0].segments = [{ ...P.girders[0].segments[0], x0: 0, x1: 43, D: 24 }];
  A = AN.applicability(P); near(A.Is[0].Is, 0.412, 0.001, 'I_S'); near(A.wg, 38, 1e-9, 'w_g');
  assert.equal(A.items.find(q => q.id === 'Is0').level, 'warn'); assert.ok(A.items.some(q => q.id === 'sk20' && q.level === 'note'));
  assert.notEqual(A.level, 'ok'); assert.ok(A.steps.some(t => t.id === 'ap.Is0' && /tan/.test(t.sub)));
  const Q = M.defaultProject(); Q.xs.skews = Q.xs.skews.map(() => 65); A = AN.applicability(Q); assert.equal(A.level, 'fail'); assert.equal(A.items.find(q => q.id === 'skew60').level, 'fail');
});
