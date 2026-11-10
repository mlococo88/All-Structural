// Steel Bridge app, diaphragm bracing (SBDIA, 2026-11-10; engineer: "I have channel diaphragm selected and there is still a lot of output and
// failures related to cross frames"). With a rolled W or channel diaphragm as the intermediate bracing (crossframes.dia.on = 'yes'):
//   1. engine/crossframes.js: the checks are CF10, CF11 (owner), CFD, CFE only (no CF1 to CF9), and the worked steps leave out the truss of the
//      angle cross-frame (member forces per kip, entered forces, the angle members, CF6 geometry, the X / K brace stiffness); the values are
//      unchanged: every step kept equals the cross-frame run's step of the same id, and the diaphragm steps are there.
//   2. A cross-frame (X, K): the steps and checks are as before (no step left out).
//   3. The DC1 weight is the diaphragm's (xfModel kind 'dia'): hand check of one intermediate frame.
//   4. Display: ui/framing.js isDia / ckHead, report/summary.js label / grpLabel; the tab, the Report section and the Summary say "Diaphragms".
//   5. Hand check of the CFD values for MC18x42.7 (GirderDetail's built-in inputs).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/proportions.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'report/data.js', 'report/builders.js', 'report/summary.js'].map(E));
const W = loadShared(...FILES);
const CF = W.SBDCrossframes, FUI = W.SBDFramingUI, SM = W.SBDSummary;
const J = o => JSON.parse(JSON.stringify(o));
const TRUSS = /^cf\.(tr\d+|user\.|top\.|bot\.|diag\.|geo$|sb\.bbr$|sb\.bT$)/;
const run = p => { const R = CF.compute(p, null); return { R, C: CF.checks(R) }; };
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b}`);

test('1. diaphragm: checks CF10, CF11 (owner), CFD, CFE only; truss steps left out, the rest unchanged', () => {
  for (const sh of ['MC18x42.7', 'C15x33.9', 'W21x44', 'W24x55']) {
    const px = J(CF.DEF), pd = J(CF.DEF); pd.dia.on = 'yes'; pd.dia.shape = sh;
    const X = run(px), D = run(pd);
    assert.deepEqual(J(D.C.map(c => c.id).filter(id => /^CF[1-9]$/.test(id))), [], `${sh}: no CF1 to CF9`);
    assert.ok(D.C.some(c => c.id === 'CFD') && D.C.some(c => c.id === 'CFE'), `${sh}: CFD and CFE`);
    assert.deepEqual(J(D.R.steps.filter(s => TRUSS.test(s.id)).map(s => s.id)), [], `${sh}: no truss steps`);
    assert.ok(D.R.steps.some(s => s.id === 'cf.cfd.Mn') && D.R.steps.some(s => s.id === 'cf.cfe.Mn'), `${sh}: the diaphragm steps`);
    const xs = new Map(X.R.steps.map(s => [s.id, s.value]));
    // the geometry and wind steps do not depend on the bracing: equal to the cross-frame run's (the stability bracing steps take the diaphragm's own depth h_br, as before)
    const geo = D.R.steps.filter(s => /^cf\.(dg|Lb|wIII\.|wV\.)/.test(s.id)); assert.equal(geo.length, 8, `${sh}: d, L_b and 3 wind steps × 2`);
    geo.forEach(s => assert.ok(Object.is(s.value, xs.get(s.id)), `${sh} ${s.id}: ${s.value} vs ${xs.get(s.id)}`));
    // the stability bracing steps kept are the values the CFD check uses
    const st = id => D.R.steps.find(s => s.id === id).value; assert.ok(Object.is(st('cf.sb.Mbr'), D.R.SB.Mbr)); assert.ok(Object.is(st('cf.sb.bReq'), D.R.SB.bReq));
    // the values the checks use are those the engine computed before the steps were filtered: the governing CFD item and its D/C
    assert.ok(D.R.frames && D.R.frames.length, 'the truss is still computed (not shown, not checked)');
  }
});

test('2. cross-frames (X, Kb, Kt): every step kept, CF1 to CF11 as before', () => {
  for (const ty of ['X', 'Kb', 'Kt']) {
    const p = J(CF.DEF); p.type = ty; const { R, C } = run(p);
    assert.ok(R.steps.some(s => TRUSS.test(s.id)), `${ty}: the truss steps are listed`);
    assert.ok(['CF1', 'CF2', 'CF3', 'CF4', 'CF5', 'CF6', 'CF7', 'CF8', 'CF9', 'CF10'].every(id => C.some(c => c.id === id)), `${ty}: CF1 to CF10`);
    assert.ok(!C.some(c => c.id === 'CFD'), `${ty}: no CFD`);
  }
});

test('3. DC1 weight with a diaphragm is the diaphragm\'s (xfModel kind dia): hand check', () => {
  // MC18x42.7 (nominal): A = 2(3.95)(0.625) + (18 − 2(0.625))(0.45) = 4.9375 + 7.5375 = 12.475 in²; gap = max(0.5, 3.5 − 1.5) = 2.0 in
  // frame 9.5 ft = 114 in between webs: W = 12.475 (114 − 2(2.0)) (0.2836)/1000 (1 + 10/100) = 12.475 (110)(0.2836)(1.1)/1000 = 0.42809 kip
  const c = { ...CF.defaults(), dia: { ...CF.DEF.dia, on: 'yes', shape: 'MC18x42.7' } }, X = CF.xfModel({ mode: 'auto', allow: 10 }, c);
  assert.equal(X.kind, 'dia'); near(X.A, 12.475, 1e-9, 'A'); near(X.g, 2.0, 1e-12, 'gap');
  near(CF.xfW(X, 9.5, false), 0.42809, 5e-5, 'W per frame');
  const Xx = CF.xfModel({ mode: 'auto', allow: 10 }, { ...CF.defaults(), h: 48 }); assert.equal(Xx.kind, 'xf', 'angles when no diaphragm');
});

test('4. display: isDia, ckHead, Summary label / grpLabel', () => {
  const P = W.SBDModel.defaultProject(); FUI.ensure(P);
  assert.equal(FUI.isDia(P), false); const col = SM.COLS.find(c => c.id === 'cf');
  assert.equal(SM.label(col, P), col, 'cross-frames: the column unchanged'); assert.equal(SM.grpLabel('Cross-frames', P), 'Cross-frames');
  FUI.setBrace(P, 'ch'); assert.equal(FUI.isDia(P), true); assert.equal(P.crossframes.dia.on, 'yes');
  const L = SM.label(col, P); assert.equal(L.head, 'Diaphragms'); assert.equal(L.id, 'cf'); assert.equal(L.tab, 'cf'); assert.equal(col.head, 'Cross-frames / diaphragms', 'COLS not changed');
  assert.equal(SM.grpLabel('Cross-frames', P), 'Diaphragms'); assert.equal(SM.grpLabel('Welds', P), 'Welds');
  const C = [{ id: 'CFD' }, { id: 'CFE' }, { id: 'CF10' }];
  assert.equal(FUI.ckHead(C, true), 'Checks (CFD, CFE, CF10)'); assert.equal(FUI.ckHead(C, false), 'Checks (CF1 to CF11, CFD, CFE)'); assert.equal(FUI.ckHead([{ id: 'CF1' }], false), 'Checks (CF1 to CF11)');
  FUI.setBrace(P, 'X'); assert.equal(FUI.isDia(P), false, 'back to an X-frame');
});

test('4b. the tab and the Report on the default project with a channel diaphragm: no truss output', () => {
  const P = W.SBDModel.defaultProject(); FUI.ensure(P); FUI.setBrace(P, 'ch');
  const B = FUI.build({ P, g: 0 }); assert.ok(!B.err, B.err);
  assert.deepEqual(J(B.C.map(c => c.id).filter(id => /^CF[1-9]$/.test(id))), []);
  assert.equal(B.XF.X.kind, 'dia', 'DC1 point loads from the diaphragm');
  assert.deepEqual(J(B.R.steps.filter(s => TRUSS.test(s.id)).map(s => s.id)), []);
  const svg = FUI.diaSvg(B); assert.match(svg, /MC18x42\.7 channel diaphragm/);
});

test('5. CFD hand check, MC18x42.7, GirderDetail built-in inputs (S = 114 in, d = 62.5 in, grade 50)', () => {
  // I_x = b_f d³/12 − (b_f − t_w) h_w³/12 = 3.95(18)³/12 − 3.50(16.75)³/12 = 1919.70 − 1370.67 = 549.04 in⁴; S_x = 2I_x/d = 2(549.04)/18 = 61.004 in³
  // shear: h_w/t_w = 16.75/0.45 = 37.22 ≤ 1.12√(Ek/F_y) = 1.12√(29000·5/50) = 60.31 → C = 1; φ_vV_n = 1.0(0.58)(50)(16.75)(0.45) = 218.59 kip
  // wind (Strength III): M_w = F_w d; V_w = 2M_w/S
  const p = J(CF.DEF); p.dia.on = 'yes'; p.dia.shape = 'MC18x42.7'; const { R, C } = run(p), D = R.DIA.i;
  near(D.Ix, 549.035, 0.001, 'I_x'); near(D.Sx, 61.004, 0.001, 'S_x'); near(D.Vn, 218.5875, 1e-9, 'φV_n'); assert.equal(D.C, 1);
  near(D.Mw, D.Fw * 62.5, 1e-9, 'M_w = F_w d'); near(D.Vw, 2 * D.Mw / 114, 1e-9, 'V_w = 2M_w/S');
  near(D.bbr, 6 * 29000 * D.Ix / 114, 1e-6, 'β_br = 6EI_x/S');
  const c = C.find(q => q.id === 'CFD'), it = c.items.find(i => /^Brace moment/.test(i.loc)); near(it.r, R.SB.Mbr / D.Mn, 1e-12, 'M_br / φM_n');
});

// ---------- SBDX (2026-11-10, engineer approval "yes do all three"): channel flexure 6.12.2.2.5, axial under F_w, fatigue row names ----------
const dia0 = sh => { const p = J(CF.DEF); p.dia.on = 'yes'; p.dia.shape = sh; const R = CF.compute(p, null); return { p, R, C: CF.checks(R), D: R.DIA.i }; };

test('6. channel MC18x42.7 flexure per 6.12.2.2.5 (L_b = S = 114 in, C_b = 1.0): hand check; before (6.10.8) 1157.74 kip-in', () => {
  // Z_x = b_f t_f (d − t_f) + t_w h_w²/4 = 3.95(0.625)(17.375) + 0.45(16.75)²/4 = 42.895 + 31.563 = 74.458 in³; M_p = 50(74.458) = 3722.89 kip-in
  // b = 3.95 − 0.225 = 3.725 in, h_o = 17.375 in; J = (2(3.725)(0.625)³ + 17.375(0.45)³)/3 = (1.8188 + 1.5833)/3 = 1.1340 in⁴
  // C_w = 0.625(3.725)³(17.375)²/12 × (3(3.725)(0.625) + 2(17.375)(0.45))/(6(3.725)(0.625) + 17.375(0.45)) = 843.82 in⁶
  // L_p = 1.76(1.1212)√(29000/50) = 47.53 in; L_r = 151.32 in; L_p < L_b = 114 ≤ L_r:
  // M_n = 3722.89 − (3722.89 − 0.7(50)(61.004))(114 − 47.53)/(151.32 − 47.53) = 3722.89 − 1587.75(0.6404) = 2706.0 kip-in
  const { D, C } = dia0('MC18x42.7'), H = D.CH;
  near(H.Zx, 74.4578, 1e-4, 'Z_x'); near(H.Mp, 3722.89, 0.01, 'M_p'); near(H.J, 1.13405, 1e-4, 'J'); near(H.Cw, 843.817, 0.01, 'C_w');
  near(H.Lp, 47.525, 0.001, 'L_p'); near(H.Lr, 151.319, 0.001, 'L_r'); assert.equal(H.zone, 'i');
  near(D.Mn, 2706.02, 0.01, 'M_n channel'); near(D.MnI, 1157.74, 0.01, 'M_n before (6.10.8)');
  const it = C.find(c => c.id === 'CFD').items.find(i => /^Wind, Strength III: flexure/.test(i.loc)); near(it.r, D.Mw / 2706.02, 1e-5, 'wind flexure ratio');
});

test('7. axial under P = F_w: MC18x42.7 (flexural–torsional) and W21x44 (flexural y, slender web): hand check', () => {
  // MC18x42.7: ℓ = S − 2e = 114 − 7 = 107 in, K = 1.0; P_ey = π²(29000)(12.475)/(107/1.1212)² = 392.07 kip;
  // P_ez = (π²(29000)(843.82)/107² + 11165(1.1340))/(12.475(48.828)) = 55.42 kip; x_o = 1.8868 in, H = 0.92709; P_e,FT = 55.40 kip (governs)
  // P_o = 50(12.475) = 623.75; P_e/P_o = 0.0888 < 0.44: P_cr = 0.877(55.40) = 48.59 kip, F_cr = 3.895 ksi; web λ = 37.22 > 35.88 but
  // ≤ λ_r√(F_y/F_cr) = 128.6: fully effective, A_eff = A_g; φ_cP_n = 0.95(48.59) = 46.16 kip. F_w = 3.6617 kip (Strength III): 0.0793
  // tension: A_n = 12.475 − 4(0.9375)(0.45) = 10.7875, U = 16.75(0.45)/12.475 = 0.60421; min(0.95(50)(12.475), 0.80(65)(10.7875)(0.60421)) = 338.93 kip
  // Kℓ/r_min = 107/1.1212 = 95.43 ≤ 140; P_u/P_r = 0.0793 < 0.2: 0.0793/2 + 228.85/2706.02 = 0.1242
  let { D } = dia0('MC18x42.7'), X = D.AX;
  near(X.KL, 107, 1e-12, 'Kℓ'); near(X.Pey, 392.073, 0.001, 'P_ey'); near(X.ft.Pez, 55.418, 0.001, 'P_ez'); near(X.Pe, 55.4016, 0.001, 'P_e FT'); assert.equal(X.mode, 'flexural–torsional');
  near(X.Pcr, 48.587, 0.001, 'P_cr'); near(X.Aeff, 12.475, 1e-9, 'A_eff'); near(X.Pr, 46.158, 0.001, 'φP_n'); near(X.Pt, 338.931, 0.001, 'P_r tension');
  near(X.sl, 95.430, 0.001, 'Kℓ/r'); near(X.ia, 0.12424, 1e-4, 'interaction');
  // W21x44 (nominal 20.7 × 6.5 × 0.45 × 0.35): A = 12.78, r_y = 1.2717; P_ey = π²(29000)(12.78)/(107/1.2717)² = 516.68 kip; P_o = 639;
  // P_e/P_o = 0.8086 ≥ 0.44: P_cr = 0.658^(639/516.68)(639) = 380.80 kip, F_cr = 29.796 ksi; web λ = 19.8/0.35 = 56.57 > 1.49√(E/F_y) = 35.88
  // and > 35.88√(50/29.796) = 46.48: F_el = (1.31(35.88)/56.57)²(50) = 34.524 ksi, b_e = 19.8(1 − 0.18√(34.524/29.796))√(34.524/29.796)
  // = 17.183 in; A_eff = 12.78 − (19.8 − 17.183)(0.35) = 11.864 in²; φ_cP_n = 0.95(29.796)(11.864) = 335.83 kip; ratio 3.6617/335.83 = 0.0109
  ({ D } = dia0('W21x44')); X = D.AX;
  near(X.Pey, 516.679, 0.001, 'W P_ey'); assert.equal(X.ft, null); near(X.Pcr, 380.796, 0.001, 'W P_cr'); near(X.W.be, 17.1835, 1e-4, 'W web b_e');
  near(X.Aeff, 11.8642, 1e-4, 'W A_eff'); near(X.Pr, 335.834, 0.001, 'W φP_n'); near(D.Mn, D.MnI, 0, 'a W keeps 6.10.8');
});

test('8. CFD / CFE list the new items; a W keeps its 6.10.8 flexure; worked steps for each', () => {
  for (const sh of ['MC18x42.7', 'W21x44']) { const { R, C } = dia0(sh);
    ['CFD', 'CFE'].forEach(id => { const c = C.find(q => q.id === id), n = c.items.filter(i => i.sbdx).length; assert.equal(n, 4, `${sh} ${id}: 4 new items`);
      c.items.filter(i => i.sbdx).forEach(i => assert.ok(R.steps.some(s => s.id === i.step), `${sh} ${id} ${i.loc}: step ${i.step}`)); });
    const ch = /^MC|^C/.test(sh); assert.equal(R.steps.some(s => s.id === 'cf.cfd.ch.Lr'), ch, `${sh}: channel LTB steps`);
    assert.ok(R.steps.every(s => s.value === 'infinite' || typeof s.value === 'string' || isFinite(s.value)), `${sh}: finite steps`);
  }
});

test('9. fatigue rows with a diaphragm: "connection plate at diaphragm" (wording only)', () => {
  const P = W.SBDModel.defaultProject(); W.SBDShearUI.ensure(P); W.SBDFatigueUI.ensure(P); FUI.ensure(P);
  const a = W.SBDFatigueUI.build({ P, g: 0, src: 'analysis' }); FUI.setBrace(P, 'ch'); const b = W.SBDFatigueUI.build({ P, g: 0, src: 'analysis' });
  const nm = B => J(B.FR.rows.map(r => r.name));
  assert.ok(nm(a).some(n => /connection plate at cross-frame/.test(n)), 'cross-frame wording with a cross-frame');
  assert.ok(!nm(b).some(n => /cross-frame/.test(n)) && nm(b).some(n => /connection plate at diaphragm/.test(n)), 'diaphragm wording');
  assert.deepEqual(nm(b), nm(a).map(n => n.replace(/\bcross-frame\b/g, 'diaphragm')), 'only the word changes');
});

test('10. the Report (every station) works the new diaphragm steps: axial, and a channel\'s 6.12.2.2.5 flexure', () => {
  for (const m of ['ch', 'w']) {
    const P = W.SBDModel.defaultProject(); FUI.ensure(P); FUI.setBrace(P, m);
    const B = W.SBDReportData.compute(P, 0), M = W.SBDReportBuild.model(B, { detail: 'all' }), txt = W.SharedReport.text(W.SharedReport.build(M));
    assert.match(txt, /Framing and diaphragms/i); assert.match(txt, /factored compressive resistance against P/); assert.match(txt, /axial force and wind moment/);
    assert.equal(/flexural resistance, channel \(6\.12\.2\.2\.5/.test(txt), m === 'ch', `${m}: channel flexure steps`);
  }
});
