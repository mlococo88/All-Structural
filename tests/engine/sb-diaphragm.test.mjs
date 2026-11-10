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
