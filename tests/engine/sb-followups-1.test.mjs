// Steel Bridge (apps/steel-bridge), follow-ups of PR #1644 (2026-11-19; made-up bridges only: the app's built-in example, changed where stated):
//  SBSW  the Loads tab and the Report work the haunch, SIP forms and DC1 with each plate segment's top flange, as the analysis takes them (A2;
//        display only: the analysis is unchanged);
//  SBEQ  the stud fatigue steps cite the 10th Ed. equation numbers: F_fat = F_rc/w Eq. 6.10.10.1.2-6 (was -4), V_fat Eq. -4 (was -3), V_sr Eq. -3
//        (was -2) (citation only);
//  SBCA  Constructibility (bracingC) takes the unbraced segment on the location's own side, as the design checks since A3 (SBDFlexure.sideSegs).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'engine/welds.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js',
  'ui/splices.js', 'ui/constructibility.js', 'ui/welds.js', 'report/data.js', 'report/builders.js'].map(E));
const W = loadShared(...FILES);
const M = W.SBDModel, near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`), J = o => JSON.parse(JSON.stringify(o));

test('SBSW: Loads tab haunch, SIP and DC1 per top flange width equal the analysis (built-in example, b_f 16 / 18 in); hand check', () => {
  const P = M.defaultProject(), R = W.SBDUiLoads.calc(P, 0); assert.ok(!(R.errors && R.errors.length));
  const AR = W.SBDAnalysis.analyzeGirder(P, 0, { ll: false }), j = W.SBDAnalysis.lineOf(P, P.girders[0]), D = R.dead, rows = R.segDC1[j];
  // two widths: 16 in (= b_f,0, segments 0–88, 128–232, 272–360) and 18 in (88–128, 232–272)
  assert.deepEqual(J(rows.map(r => [r.topB, r.base, r.xr.length])), [[16, true, 3], [18, false, 2]]);
  const r = rows[1];
  // the analysis's Δw over each 18 in segment, exactly (same expressions)
  AR.wetCorr.forEach(c => assert.equal(r.w, c.w));
  // hand check: haunch (2/12)(18/12)(0.150) = 0.0375 klf (b_f,0: 0.0333 klf); SIP: −15/1000 × 2 bays × (2/12)/2 = −0.0025 klf
  near(r.haunch, 2 / 12 * 18 / 12 * 0.150, 1e-12, 'haunch'); near(D.haunch[j], 2 / 12 * 16 / 12 * 0.150, 1e-12, 'haunch b_f,0');
  near(r.sip, D.sip[j] - 0.0025, 1e-12, 'SIP'); near(r.dc1, D.dc1[j] + 0.0016667, 1e-6, 'DC1');
  // the worked steps: one haunch, SIP and DC1 step for the 18 in width, values as the table, after the line's DC1 step
  const st = id => D.steps.find(s => s.id === id), g = `G${j + 1}`;
  assert.equal(st(`dl.${g}.haunch.b1`).value, r.haunch); assert.equal(st(`dl.${g}.sip.b1`).value, r.sip); assert.equal(st(`dl.${g}.DC1.b1`).value, r.dc1);
  const ids = D.steps.map(s => s.id); assert.ok(ids.indexOf(`dl.${g}.DC1.b1`) > ids.indexOf(`dl.${g}.DC1`));
  // display only: the dead loads used elsewhere are unchanged
  assert.equal(W.SBDLoads.girder(R, j).DC1, D.dc1[j]);
  // the tab shows the table with links to these steps; the report's Loads section has the table
  const h = W.SBDUiLoads.output(R, { lg: j }, []); assert.ok(h.includes('id="ld-segdc1"') && h.includes(`#st-dl.${g}.DC1.b1`));
  // equal flanges: no rows, no steps
  const Q = M.defaultProject(); Q.girders[0].segments.forEach(s => { s.topB = 16; }); const RQ = W.SBDUiLoads.calc(Q, 0);
  assert.ok(RQ.segDC1.every(L => L.every(q => q.base))); assert.ok(!RQ.dead.steps.some(s => /\.b\d+$/.test(s.id)));
});

test('SBEQ: the stud fatigue steps cite Eq. 6.10.10.1.2-6 (F_rc/w), -4 (V_fat), -3 (V_sr), -1 (pitch) of the 10th Ed.', () => {
  const p = J(W.SBDStuds.DEFAULT); p.skew = 'yes';
  const R = W.SBDStuds.compute(p, { fat: { B: W.SBDFatigue.supports({ ok: true, spans: [110], cont: false }) } }), S = W.SBDStuds.steps(R), ref = id => (S.find(s => s.id === id) || {}).ref || '';
  assert.match(ref('sc.Ffat'), /Eq\. 6\.10\.10\.1\.2-6\b/); assert.match(ref('scz0.Ffat'), /Eq\. 6\.10\.10\.1\.2-6\b/);
  assert.match(ref('scz0.Vfat'), /Eq\. 6\.10\.10\.1\.2-4\b/); assert.match(ref('scz0.Vsr'), /Eq\. 6\.10\.10\.1\.2-3\b/); assert.match(ref('scz0.preq'), /Eq\. 6\.10\.10\.1\.2-1\b/);
  assert.ok(!S.some(s => s.id.endsWith('.Ffat') && /6\.10\.10\.1\.2-4\b/.test(s.ref || '')), 'no F_fat step cites -4');
});

test('SBCA: Constructibility takes the unbraced segment on the location\'s own side (made-up girder, braces 0 | 20 | 45 | 60 ft)', () => {
  const C = W.SBDConstr, F = W.SBDFlexure, xs = Array.from({ length: 61 }, (_, i) => i);
  const env = { xs, MDC1: xs.map(() => 1000), MCL: xs.map(() => 0) }, pl = { D: 48, tw: 0.5, topB: 14, topT: 0.75, botB: 16, botT: 1 };
  const opt = { braces: [0, 20, 45, 60], L: 60, secAt: () => pl, D: 48, sp: 25 }, at = x => C.bracingC(x, env, opt);
  // left of the brace at 45: the segment 20–45 (L_b = 25 ft); right: 45–60 (15 ft); at the brace itself: the governing of both (25 ft).
  // Before: 45.1 took both segments and the governing one, 20–45 (L_b = 25 ft); after: 45–60, L_b = 15 ft.
  assert.deepEqual([at(44.9).LbC, at(45.1).LbC, at(45).LbC], [25, 15, 25]);
  assert.deepEqual(J(at(45.1).seg), { xa: 45, xb: 60 });
  // the same rule as the design checks (one helper)
  assert.deepEqual(J(F.sideSegs([0, 20, 45, 60], 45.1)), [[45, 60]]); assert.deepEqual(J(F.sideSegs([0, 20, 45, 60], 45)), [[20, 45], [45, 60]]);
});

test('SBCA: built-in example, deck placement at x = 109.99 ft (left of the pier at 110) takes 90.20–110 ft; hand check', () => {
  const P = M.defaultProject(), R = W.SBDConstrUI.build({ P, g: 0, src: 'project' }); assert.ok(!R.err, R.err);
  const r = R.rows.find(q => Math.abs(q.x - 109.99) < 1e-6), q = R.rows.find(q2 => Math.abs(q2.x - 110.01) < 1e-6);
  // after: L_b = 110 − 90.20 = 19.80 ft, C_b = 1.377 (before 23.33 ft, the segment 110–133.33, C_b = 1.00); 110.01 keeps 110–133.33
  near(r.LbC, 19.8, 1e-9, 'L_b'); near(r.CbC, 1.377, 1e-9, 'C_b'); near(r.seg.xa, 90.2, 1e-9, 'x_a'); near(q.LbC, 23.33, 1e-9, 'L_b right');
  // F_nc (6.10.8.2.3, prismatic 18 × 2 in flange, r_t = 4.865 in, L_p = 128.88 in, L_r = 439.93 in, L_b = 237.6 in: inelastic):
  // 1.377[1 − 0.3(237.6 − 128.88)/(439.93 − 128.88)]50 = 61.6 > 50 → 50 ksi; GS14 19.183/50 = 0.384 (before 19.183/33.755 = 0.568)
  const gs14 = r.checks.filter(c => c.id === 'GS14'); near(Math.max(...gs14.map(c => c.ratio)), 19.183 / 50, 2e-4, 'GS14');
  // the girder's governing deck-placement ratio is unchanged, GS14 0.5917 (now at 250.01 ft, right of the pier at 250)
  near(R.gov.gov.ratio, 0.5917, 5e-5, 'governing'); near(R.gov.x, 250.01, 1e-9, 'governing x');
});
