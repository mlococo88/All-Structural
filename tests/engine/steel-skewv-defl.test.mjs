// Steel Bridge Design (apps/steel-bridge), engineer's decisions of 2026-11-23. Made-up bridges only.
//   N3  the shear skew correction along the girder (xs.lldf.skewVx; AASHTO LRFD 10th Ed. Art. 4.6.2.2.3c): absent / 'whole' = the span's g_V at
//       every station, as before (pinned values of the code before the change); 'taper' = full at each support, linearly to 1.0 at mid-span,
//       on the HL-93 and the fatigue shear; reactions unchanged; exterior-only option; an entered g_V is not tapered; continuous spans.
//   N4  the live load deflection on the bridge stiffness shared equally (Art. 2.5.2.6.2): I_avg(x) = Σ I_n,j(x) / N_b. Equal girders: the
//       value of before (pinned); unequal exterior / interior girders: both lines the same deflection, = Δ(own I_n) × I_n / I_avg for a
//       prismatic simple span; stepped plates: the average per station.
//   F5  the stud edition note (text only): on the tab, above the steps and in the report; no stud result changes.
//   node tests/engine/run.mjs steel-skewv-defl
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const SB = path.join(ROOT, 'apps/steel-bridge');
const SK = /view3d|ui\/report|ui\/drawings|ui\/graphics|ui\/gfxa|ui\/tabgraphics|ui\/legacy|autodesign/;
const FILES = [...fs.readFileSync(path.join(SB, 'index.html'), 'utf8').matchAll(/(?:<script src="|^ *')((?!http)[^"'?]+\.js)["']/gm)].map(m => path.resolve(SB, m[1])).filter(f => !SK.test(f));
const J = o => JSON.parse(JSON.stringify(o)), js = JSON.stringify;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);
let W0 = null; const ctx = () => W0 || (W0 = loadShared(...FILES));

// a made-up simple span: 120 ft, 5 girders at 9.5 ft, one plate girder on every line, both supports skewed 30°
const SEC = { D: 54, tw: 0.5, topB: 16, topT: 1, botB: 18, botT: 1.5 };
function simple(M, skew) {
  const P = J(M.defaultProject()); P.spans = { lengths: [120], continuity: 'simple' };
  P.girders = [{ id: 'G1', label: 'G1', position: 'interior', beff: 114, segments: [{ x0: 0, x1: 120, ...SEC }] }];
  P.xs = M.defaultXs(P); P.xs.skews = [skew, skew]; return P;
}
const at = (R, x) => R.x.findIndex(v => Math.abs(v - x) < 1e-9);
const shearOf = R => js([R.ll.gVR, R.ll.gVL, R.ll.VRpos, R.ll.VRneg, R.ll.VLpos, R.ll.VLneg, R.fat.gVR, R.fat.gVL, R.fat.VRpos, R.fat.VRneg, R.fat.VLpos, R.fat.VLneg, R.llR.map(r => [r.gV, r.max, r.min])]);

test('N3 default: no setting and "Whole length" give the values of before (pinned); no new step, no warning', () => {
  const W = ctx(), M = W.SBDModel, AN = W.SBDAnalysis, P = simple(M, 30);
  assert.equal(P.xs.lldf.skewVx, undefined, 'a project saved before has no skewVx');
  const R = AN.analyzeGirder(P, 0), Q = J(P); Q.xs.lldf.skewVx = 'whole'; const Rw = AN.analyzeGirder(Q, 0);
  assert.equal(shearOf(R), shearOf(Rw), 'absent = whole, bit for bit');
  assert.equal(R.skV, null); assert.ok(!R.steps.some(s => /gVx/.test(s.id))); assert.equal(R.warnings.length, 0);
  // the values of the code before this change (origin/main 90e672d), pinned
  const i30 = at(R, 30), i60 = at(R, 60);
  assert.equal(R.df.spans[0].gV, 1.01588582027155); assert.equal(R.df.spans[0].fatV, 0.6824265412398829);
  [0, i30, i60].forEach(i => { assert.equal(R.ll.gVR[i], 1.01588582027155); assert.equal(R.fat.gVR[i], 0.6824265412398829); });
  near(R.ll.VRpos[0], 128.72492408473096, 1e-12, 'V at the support'); near(R.ll.VRpos[i30], 87.33773569514163, 1e-12, 'V at L/4'); near(R.ll.VRpos[i60], 50.82679943643287, 1e-12, 'V at L/2');
  near(R.fat.VRpos[i30] - R.fat.VRneg[i30], 40.913745897091026, 1e-12, 'fatigue range at L/4');
  const mod = AN.moduleOf(P, 0); assert.ok(!mod.R.regions[0].steps.some(s => /rVx/.test(s.id)), 'no taper step at the default');
});

test('N3 tapered: r_V(x) = 1 + (r_V − 1)(1 − x/(L/2)); support, quarter point, mid-span; HL-93 and fatigue shear; reactions unchanged', () => {
  const W = ctx(), M = W.SBDModel, AN = W.SBDAnalysis, P = simple(M, 30), Q = J(P); Q.xs.lldf.skewVx = 'taper';
  const R0 = AN.analyzeGirder(P, 0), R = AN.analyzeGirder(Q, 0), D = R.df.spans[0], c = D.rV;
  // hand: Table 4.6.2.2.3c-1, r_V = 1 + 0.20 (12 L t_s³ / K_g)^0.3 tan θ
  const mod = AN.moduleOf(Q, 0), rg = mod.R.regions[0];
  near(c, 1 + 0.20 * Math.pow(12 * 120 * 8 ** 3 / rg.Kg, 0.3) * Math.tan(30 * Math.PI / 180), 1e-12, 'r_V by hand');
  near(c, 1.1066376344430533, 1e-12, 'r_V'); assert.equal(D.rVf, c);
  assert.equal(D.gV, R0.df.spans[0].gV, 'the support factor is unchanged');
  const i30 = at(R, 30), i60 = at(R, 60), i90 = at(R, 90), iN = R.x.length - 1, g0 = D.gV / c;
  near(g0, 0.9179931972789116, 1e-12, 'g_V without the skew correction');
  assert.equal(R.ll.gVR[0], D.gV); near(R.ll.gVL[iN], D.gV, 1e-15, 'full at the far support');
  near(R.ll.gVR[i30], g0 * (1 + (c - 1) * 0.5), 1e-14, 'quarter point'); near(R.ll.gVR[i30], 0.9669395087752308, 1e-12, 'quarter point (pinned)');
  near(R.ll.gVR[i60], g0, 1e-14, 'mid-span: 1.0'); near(R.ll.gVR[i90], R.ll.gVR[i30], 1e-14, 'symmetric');
  R.x.forEach((x, i) => { const t = Math.min(x, 120 - x) / 60, e = g0 * (1 + (c - 1) * (1 - t)); near(R.ll.gVR[i], e, 1e-13, `g_V(x) at ${x}`); near(R.fat.gVR[i], D.fatV / c * (1 + (c - 1) * (1 - t)), 1e-13, `g_fat,V(x) at ${x}`);
    near(R.ll.VRpos[i], R.ll.gVR[i] * R.ll.perLane.VRmax[i], 1e-14, 'V = g_V(x) V_HL93'); assert.ok(R.ll.VRpos[i] <= R0.ll.VRpos[i] + 1e-12, 'never above the whole-length value'); });
  near(R.ll.VRpos[i30], 83.12972340536, 1e-12, 'V_LL+IM at L/4, tapered (before 87.338)');
  near(R.fat.VRpos[i30] - R.fat.VRneg[i30], 38.942484057227006, 1e-12, 'fatigue shear range at L/4, tapered (before 40.914)');
  assert.equal(js(R.llR.map(r => [r.gV, r.max, r.min])), js(R0.llR.map(r => [r.gV, r.max, r.min])), 'reactions: the support value');
  assert.equal(js([R.ll.Mpos, R.ll.Mneg, R.fat.Mpos, R.lld.map(q => q.d), R.camber.total]), js([R0.ll.Mpos, R0.ll.Mneg, R0.fat.Mpos, R0.lld.map(q => q.d), R0.camber.total]), 'moments, deflection, camber unchanged');
  // the worked steps: the loads module's r_V(x) and the analysis' factor at the station
  const sx = rg.steps.find(s => s.id === 'df.s0.rVx'); near(sx.value, 1 + (c - 1) / 2, 1e-14, 'step df.s0.rVx'); assert.match(sx.ref, /4\.6\.2\.2\.3c/);
  const s1 = R.steps.find(s => s.id === 'an.gVx.s1'), s2 = R.steps.find(s => s.id === 'an.gVx.V.s1'), s3 = R.steps.find(s => s.id === 'an.gVx.fat.s1');
  assert.equal(s1.value, R.ll.gVR[i30]); assert.equal(s2.value, R.ll.VRpos[i30]); assert.equal(s3.value, R.fat.VRpos[i30] - R.fat.VRneg[i30]);
  assert.match(s1.eq, /r_\{V\} - 1/); assert.match(s1.ref, /10th Ed\. Art\. 4\.6\.2\.2\.3c/);
  // the modules take the tapered shear: the shear tab's and the stud / fatigue payloads are the analysis' station values
  const sh = W.SBDShearUI.fromAnalysis(Q, 0), sh0 = W.SBDShearUI.fromAnalysis(P, 0), st = sh.pl.stations.find(q => Math.abs(q.x - 30) < 1e-9), st0 = sh0.pl.stations.find(q => Math.abs(q.x - 30) < 1e-9);
  near(Math.max(Math.abs(st.V_LLpos), Math.abs(st.V_LLneg)) / Math.max(Math.abs(st0.V_LLpos), Math.abs(st0.V_LLneg)), (1 + (c - 1) / 2) / c, 1e-12, 'shear tab demand at L/4');
  assert.equal(sh.pl.reactions[0].LL, sh0.pl.reactions[0].LL, 'bearing reaction unchanged');
  const fa = W.SBDFatigueUI.fromAnalysis(Q, 0), fa0 = W.SBDFatigueUI.fromAnalysis(P, 0), f1 = fa.pl.stations.find(q => Math.abs(q.x - 30) < 1e-9), f0 = fa0.pl.stations.find(q => Math.abs(q.x - 30) < 1e-9);
  near((f1.V_FATpos - f1.V_FATneg) / (f0.V_FATpos - f0.V_FATneg), (1 + (c - 1) / 2) / c, 1e-12, 'stud fatigue shear range at L/4');
  console.log(`  r_V ${c.toFixed(4)}: g_V support ${D.gV.toFixed(4)}, L/4 ${R.ll.gVR[i30].toFixed(4)}, L/2 ${R.ll.gVR[i60].toFixed(4)}; V_LL+IM at L/4 ${R0.ll.VRpos[i30].toFixed(2)} -> ${R.ll.VRpos[i30].toFixed(2)} kip; V_f at L/4 ${(R0.fat.VRpos[i30] - R0.fat.VRneg[i30]).toFixed(2)} -> ${(R.fat.VRpos[i30] - R.fat.VRneg[i30]).toFixed(2)} kip`);
});

test('N3 tapered: exterior-only option, no skew, an entered g_V (not tapered, with a warning), continuous spans', () => {
  const W = ctx(), M = W.SBDModel, AN = W.SBDAnalysis;
  // exterior girders only: the interior girder has r_V = 1, nothing to taper
  const P = simple(M, 30); P.xs.lldf.skewVx = 'taper'; P.xs.lldf.skewV = 'ext'; const Pw = J(P); delete Pw.xs.lldf.skewVx;
  const Ri = AN.analyzeGirder(P, 0), Ri0 = AN.analyzeGirder(Pw, 0); assert.equal(Ri.df.spans[0].rV, 1); assert.equal(shearOf(Ri), shearOf(Ri0), 'interior, exterior-only: unchanged');
  const Pe = J(P); Pe.girders[0].position = 'exterior'; Pe.girders[0].line = 0; const Pe0 = J(Pe); delete Pe0.xs.lldf.skewVx;
  const Re = AN.analyzeGirder(Pe, 0), Re0 = AN.analyzeGirder(Pe0, 0), i60 = at(Re, 60); assert.ok(Re.df.spans[0].rV > 1.1); near(Re.ll.gVR[i60], Re0.ll.gVR[i60] / Re.df.spans[0].rV, 1e-14, 'exterior at mid-span');
  // no skew: nothing changes
  const Z = simple(M, 0); const Z1 = J(Z); Z1.xs.lldf.skewVx = 'taper'; assert.equal(shearOf(AN.analyzeGirder(Z, 0)), shearOf(AN.analyzeGirder(Z1, 0)), 'no skew: unchanged');
  // an entered g_V: its skew correction is not known, so it is not tapered (the conservative reading), with a warning and a step
  const E = simple(M, 30); E.xs.lldf.skewVx = 'taper'; E.girders[0].dfOverride = true; E.girders[0].dfManual = { gV: 0.95 };
  const Rm = AN.analyzeGirder(E, 0); assert.equal(Rm.df.spans[0].rV, null); assert.ok(Rm.ll.gVR.every(v => v === 0.95), 'entered g_V at every station');
  assert.ok(Rm.warnings.some(w => /tapered/.test(w))); assert.ok(Rm.steps.some(s => s.id === 'an.gVx.na.s1'));
  assert.ok(Rm.fat.gVR[at(Rm, 60)] < Rm.df.spans[0].fatV, 'the module\'s fatigue factor is still tapered');
  // continuous, two spans 100 + 140 ft, skews 20°, 20°, 40°: per span, full at every support (both sides of the pier), 1.0 at each mid-span
  const C = J(M.defaultProject()); C.spans = { lengths: [100, 140], continuity: 'continuous' }; C.girders = [{ id: 'G1', label: 'G1', position: 'interior', beff: 114, segments: [{ x0: 0, x1: 240, ...SEC }] }];
  C.xs = M.defaultXs(C); C.xs.skews = [20, 20, 40]; const C1 = J(C); C1.xs.lldf.skewVx = 'taper';
  const R0 = AN.analyzeGirder(C, 0), R = AN.analyzeGirder(C1, 0), D = R.df.spans, ip = R.supIdx[1];
  assert.ok(D[1].rV > D[0].rV && D[0].rV > 1, 'span 2 has the larger skew');
  assert.equal(R.ll.gVL[ip], D[0].gV, 'left of the pier: span 1 support value'); assert.equal(R.ll.gVR[ip], D[1].gV, 'right of the pier: span 2 support value');
  near(R.ll.gVR[at(R, 50)], D[0].gV / D[0].rV, 1e-14, 'span 1 mid-span'); near(R.ll.gVR[at(R, 170)], D[1].gV / D[1].rV, 1e-14, 'span 2 mid-span');
  near(R.ll.gVR[at(R, 135)], D[1].gV * (1 + (D[1].rV - 1) * 0.5) / D[1].rV, 1e-13, 'span 2 quarter point');
  assert.equal(js(R.llR.map(r => [r.gV, r.max, r.min])), js(R0.llR.map(r => [r.gV, r.max, r.min])), 'reactions unchanged (continuous)');
  assert.equal(js([R.ll.Mpos, R.ll.Mneg]), js([R0.ll.Mpos, R0.ll.Mneg]));
  assert.ok(R.steps.some(s => s.id === 'an.gVx.s2'));
});

test('N3: skewTaper and the input drop-down (two options; no "end region only")', () => {
  const W = ctx(), AN = W.SBDAnalysis;
  assert.equal(AN.skewTaper(1.2, 0, 0, 100), 1); near(AN.skewTaper(1.2, 25, 0, 100), 1.1 / 1.2, 1e-15, 'quarter'); near(AN.skewTaper(1.2, 50, 0, 100), 1 / 1.2, 1e-15, 'mid'); near(AN.skewTaper(1.2, 175, 100, 100), 1.1 / 1.2, 1e-15, 'second span');
  assert.equal(AN.skewTaper(1, 30, 0, 100), 1); assert.equal(AN.skewTaper(null, 30, 0, 100), 1);
  const src = fs.readFileSync(path.join(SB, 'ui/loads.js'), 'utf8'), m = /h\.sel\('xs\.lldf\.skewVx', '[^']+', (\[\[.*?\]\])/.exec(src);
  assert.ok(m, 'the drop-down'); assert.equal(m[1], "[['whole', 'Whole length'], ['taper', 'Tapered: full at the support, 1.0 at mid-span']]");
  assert.match(src, /4\.6\.2\.2\.3c/);
});

test('N4 equal girders: the live load deflection of before (pinned); the step shows ΣEI, N_L, m, N_b', () => {
  const W = ctx(), M = W.SBDModel, AN = W.SBDAnalysis, P = simple(M, 0), R = AN.analyzeGirder(P, 0), q = R.lld[0];
  // the values of the code before this change (origin/main 90e672d)
  assert.equal(q.d, 0.948737218027179); assert.equal(q.perLane, 1.860269054955253); assert.equal(q.gD, 0.51); assert.equal(q.x, 60);
  assert.equal(R.bEI.same, true); assert.equal(q.EI.Iavg, q.EI.Iown); near(q.EI.sumI, 5 * q.EI.Iown, 1e-14, 'ΣI = 5 I_n');
  // hand: truck 32 k at mid-span, 32 k and 8 k 14 ft either side, IM 33 %: Δ = Σ P b (3L² − 4b²) / (48 EI); the engine's governing position is within 1 %
  const EI = 29000 * q.EI.Iown, hand = 1.33 * 1728 * (32 * 120 ** 3 / 48 + (32 + 8) * 46 * (3 * 120 ** 2 - 4 * 46 ** 2) / 48) / EI;
  near(q.perLane, hand, 0.01, 'per-lane truck deflection by hand');
  const sE = R.steps.find(s => s.id === 'an.defl.EI1'), sg = R.steps.find(s => s.id === 'an.defl.g1'), sL = R.steps.find(s => s.id === 'an.defl.LL1');
  near(sE.value, EI, 1e-14, 'EI_avg'); assert.match(sE.ref, /2\.5\.2\.6\.2/); assert.match(sE.note, /ΣEI/);
  assert.equal(sg.value, 0.51); assert.equal(js(q.dP), js({ NL: 3, m: 0.85, Nb: 5 })); near(q.gD, 0.85 * 3 / 5, 1e-15, 'g_Δ = m N_L / N_b');
  assert.equal(sL.value, q.d);
  // the built-in project (one plate girder on every line): as before
  const B = AN.analyzeGirder(J(M.defaultProject()), 0); assert.equal(B.bEI.same, true);
  assert.equal(js(B.lld.map(v => v.d)), js([0.5118229718471313, 0.7004827489040156, 0.5118229717918087]), 'built-in project: unchanged');
});

test('N4 unequal exterior / interior girders: both deflect equally on I_avg = Σ I_n / N_b; before: each on its own I_n', () => {
  const W = ctx(), M = W.SBDModel, AN = W.SBDAnalysis, P = simple(M, 0);
  P.girders[0].lines = [1, 2, 3]; P.girders[0].line = 1;
  P.girders.push({ id: 'G2', label: 'Ext', position: 'exterior', line: 0, lines: [0, 4], beff: 96, segments: [{ x0: 0, x1: 120, D: 54, tw: 0.5, topB: 16, topT: 1, botB: 20, botT: 2 }] });
  const Ri = AN.analyzeGirder(P, 0), Re = AN.analyzeGirder(P, 1), S = AN.analyzeGirder(simple(M, 0), 0), qi = Ri.lld[0], qe = Re.lld[0];
  const Ii = qi.EI.Iown, Ie = qe.EI.Iown, Iavg = (2 * Ie + 3 * Ii) / 5;
  near(Ii, 106701.04335475632, 1e-12, 'interior I_n'); near(Ie, 130248.8324544378, 1e-12, 'exterior I_n'); near(qi.EI.Iavg, Iavg, 1e-14, 'I_avg'); near(Iavg, 116120.1589946289, 1e-12, 'I_avg (pinned)');
  assert.equal(qi.EI.Iavg, qe.EI.Iavg); assert.equal(Ri.bEI.same, false);
  // a prismatic simple span: Δ ∝ 1/I, so Δ = Δ(own I_n) × I_n / I_avg
  near(qi.perLane, S.lld[0].perLane * Ii / Iavg, 1e-7, 'per lane on I_avg'); near(qi.d, 0.948737218027179 * Ii / Iavg, 1e-7, 'Δ_LL interior'); near(qi.d, 0.8717801611429381, 1e-9, 'Δ_LL (pinned)');
  near(qe.d, qi.d, 1e-12, 'exterior = interior: all girders deflect equally'); assert.equal(qi.gD, 0.51); assert.equal(qe.gD, 0.51);
  const before = { int: 0.51 * S.lld[0].perLane, ext: 0.51 * S.lld[0].perLane * Ii / Ie };
  assert.ok(qi.d < before.int && qe.d > before.ext, 'interior goes down, exterior goes up');
  // only the deflection changes: shears, moments, reactions and camber keep each girder's own stiffness (statically determinate here: equal to the single-type run)
  assert.equal(js([Ri.ll.Mpos, Ri.ll.VRpos, Ri.llR.map(r => r.max)]), js([S.ll.Mpos, S.ll.VRpos, S.llR.map(r => r.max)]));
  const sE = Ri.steps.find(s => s.id === 'an.defl.EI1'); near(sE.value, 29000 * Iavg, 1e-14, 'step EI_avg'); assert.match(sE.sub, /2\(130\{,\}249\) \+ 3\(106\{,\}701\)/); assert.match(sE.sub, /\{5\}$/);
  console.log(`  I_n interior ${Ii.toFixed(0)}, exterior ${Ie.toFixed(0)}, I_avg ${Iavg.toFixed(0)} in^4; Δ_LL before: interior ${before.int.toFixed(3)}, exterior ${before.ext.toFixed(3)} in; now both ${qi.d.toFixed(3)} in`);
});

test('N4 stepped plates and continuous spans: the average stiffness per station; the plate girder rule of the Drawings; lines of the Deflection tab equal', () => {
  const W = ctx(), M = W.SBDModel, AN = W.SBDAnalysis, P = J(M.defaultProject());
  const e = J(P.girders[0]); e.id = 'GE'; e.label = 'GE'; e.position = 'exterior'; e.beff = 96; e.line = 0; e.segments.forEach(s => { s.botT += 0.5; });
  e.segments = [{ ...e.segments[0], x1: 70 }, { ...e.segments[0], x0: 70, x1: 88, botB: 20 }, ...e.segments.slice(1)]; P.girders.push(e); P.analysis.crack = '15';
  const nb = 5; for (let j = 0; j < nb; j++) assert.equal(AN.plateOfLine(P, j, nb), W.SBDDrawings ? W.SBDDrawings.plateGirderOf(P, j, nb) : (j === 0 ? 1 : 0), `line ${j + 1}`);
  const R0 = AN.analyzeGirder(P, 0), R1 = AN.analyzeGirder(P, 1);
  assert.equal(js(R0.bEI.types.map(t => [t.gi, t.lines])), js([[1, [0]], [0, [1, 2, 3, 4]]]));
  // the averaged stiffness intervals: every cut of both girders, I_avg = (1 × I_GE + 4 × I_G1) / 5 at the interval's middle
  const IAt = (sb, x) => sb.find(r => x >= r[0] && x <= r[1])[2];
  assert.ok(R0.bEI.sb.some(r => Math.abs(r[0] - 70) < 1e-9), 'the exterior girder\'s plate change at 70 ft is a cut');
  R0.bEI.sb.forEach(r => { const xm = (r[0] + r[1]) / 2; near(r[2], (IAt(R1.sb.cn, xm) + 4 * IAt(R0.sb.cn, xm)) / 5, 1e-13, `I_avg at ${xm}`); });
  assert.equal(js(R0.bEI.sb), js(R1.bEI.sb), 'one bridge stiffness for both girders (same cracked zones here)');
  R0.lld.forEach((q, k) => near(R1.lld[k].d, q.d, 1e-9, `span ${k + 1}: both girders the same deflection`));
  assert.equal(js(R0.lld.map(q => +q.d.toFixed(6))), js([0.532611, 0.776007, 0.533607]), 'Δ_LL on the bridge stiffness');
  if (W.SBDDeflectionUI) { const d = [...Array(nb)].map((_, j) => W.SBDDeflectionUI.lineRun(P, j).R.lld[1].d); d.forEach(v => near(v, d[0], 1e-9, 'every girder line of the Deflection tab')); }
});

test('F5: the stud edition note (text only) on the tab and in the report; stud results unchanged', () => {
  const W = ctx(), M = W.SBDModel, U = W.SBDFatigueUI, P = J(M.defaultProject());
  for (const t of [U.SC_ED, U.SC_ED_TXT]) { assert.match(t, /AASHTO LRFD 10th Ed\. \(2024\) only/); assert.match(t, /9th Ed\./); assert.match(t, /6\.10\.10\.2/); assert.match(t, /6\.10\.10\.1\.2/); assert.match(t, /6\.10\.10\.4, 6\.5\.4\.2/); assert.match(t, /Basis of design/); }
  const src = fs.readFileSync(path.join(SB, 'ui/fatigue.js'), 'utf8'); assert.match(src, /id="sc-edition"/); assert.match(src, /id="sc-edition-steps"/);
  const B = W.SBDReportData.compute(P, 0, { src: 'analysis' }), Mr = W.SBDReportBuild.model(B, { detail: 'gov' });
  const F = Mr.sections.find(s => s.id === 'fat'), sc = F.subs.find(q => q.id === 'sc'); assert.equal(sc.items[0].type, 'note'); assert.equal(sc.items[0].text, U.SC_ED_TXT);
  const bs = Mr.sections.find(s => s.id === 'basis'), kv = bs.subs.find(q => q.id === 'spec').items[0]; assert.ok(js(kv).includes('10th Ed. provisions only (Art. 6.10.10)'));
  assert.equal(W.SharedReport.build(Mr).unresolved.length, 0);
});
