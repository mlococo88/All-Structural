// apps/ps-bridge batch G1-G3 (2026-11-15). G1: the Section properties tab works the bare girder's weak-axis I_y, S_y and St-Venant torsion J (the
//   old app's Non-composite card rows and its "Weak-axis (lateral) inertia I_y & torsion J" derivation, O:6510-6621). The values are the
//   engine's weakAxisAndJ (engine/pbd-section.js; the psSection hand-off's Iweak / J): nothing new is computed. Checked: (1) the worked steps'
//   values = weakAxisAndJ and the hand-off payload, and each step's expression reproduces its value, for an I-girder, a NEXT and a box;
//   (2) the default BT-72 by hand; (3) the tab rows (with § links resolving to steps of the tab) and the Report §3; (4) R unchanged.
//   G2: the old app's P_jack hint (A_ps k_j f_pu) worked as A_ps f_pbt (default: 8.68 × 202.5 = 1,757.7 kip) and the e / A_ps chart's slot;
//   G3: the Analysis chart's series switched off at first (the old app's defaults) and the viewer's choices over them (ui.anHide).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'report.js', ...PBD,
  ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'handoffs', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['inputs', 'vizkit', 'vizalong', 'outkit', 'section', 'loads', 'analysis', 'strands', 'losses', 'stresses', 'flexure', 'shear', 'endzone', 'camber', 'handling', 'deck', 'rating', 'dash', 'summary', 'bridgedl'].map(n => path.join(APP, `ui/${n}.js`)),
  ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
const CASES = TAB_CASES(() => W.PSBModel.defaultProject());
const pick = re => Object.entries(CASES).find(([k]) => re.test(k))[1];

test('G1: the weak-axis / torsion steps are weakAxisAndJ (the hand-off values) and their expressions reproduce them (I-girder, NEXT, box)', () => {
  for (const P of [pick(/^default/), pick(/^NEXT/), pick(/^box/), pick(/^AASHTO Type IV/)]) {
    const inp = W.PSBDesign.inputs(P), R = W.PSBHoldDown.compute(inp), wj = W.weakAxisAndJ(R.g), S = W.PSBWorked.section(inp, R);
    const v = id => { const s = S.steps.find(q => q.id === 'sec.wk.' + id); assert.ok(s, inp.girder + ' step ' + id); return s.value; };
    assert.equal(v('Iy'), wj.Iweak); assert.equal(v('J'), wj.J); assert.equal(v('Sy'), wj.Sy);
    const H = W.PSBHandoffs && W.PSBHandoffs.psSection ? W.PSBHandoffs.psSection(inp, R, '2026-11-15T00:00:00Z') : null;
    if (H) { const c = H.payload || H.core || H; const f = JSON.stringify(c); assert.ok(f.includes(`"Iweak":${wj.Iweak}`) && f.includes(`"J":${wj.J}`), inp.girder + ': the hand-off sends the same'); }
    S.pairs.filter(p => /^sec\.wk\./.test(p.id)).forEach(p => assert.ok(Math.abs(p.shown - p.engine) <= 1e-9 * Math.max(1, Math.abs(p.engine)), `${inp.girder} ${p.id}: ${p.shown} vs ${p.engine}`));
    assert.ok(S.pairs.filter(p => /^sec\.wk\./.test(p.id)).length >= 3, inp.girder + ': pairs');
  }
});

test('G1: the default BT-72 by hand (t_tf = 3.5 + 2, t_bf = 6 + 4.5, h_w = 56 in; I_y = 50,344 in⁴, S_y = 2,397 in³, J = 13,383 in⁴)', () => {
  const P = W.PSBModel.defaultProject(), inp = W.PSBDesign.inputs(P), R = W.PSBHoldDown.compute(inp), S = W.PSBWorked.section(inp, R);
  const v = id => S.steps.find(q => q.id === 'sec.wk.' + id).value;
  assert.equal(inp.girder, 'PCI BT-72');
  const Iy = 5.5 * 42 ** 3 / 12 + 10.5 * 26 ** 3 / 12 + 56 * 6 ** 3 / 12;   // 33,957 + 15,379 + 1,008
  assert.equal(v('hw'), 56); assert.ok(Math.abs(v('Iy') - Iy) < 1e-9); assert.equal(Math.round(v('Iy')), 50344);
  assert.equal(Math.round(v('Sy')), Math.round(50344 / 21));
  const rj = (a, b) => a * b ** 3 * (1 / 3 - 0.21 * (b / a) * (1 - b ** 4 / (12 * a ** 4)));
  assert.equal(Math.round(v('Jtf')), 2137); assert.ok(Math.abs(v('Jtf') - rj(42, 5.5)) < 1e-9);
  assert.equal(Math.round(v('J')), 13383); assert.ok(Math.abs(v('J') - (rj(42, 5.5) + rj(26, 10.5) + rj(56, 6))) < 1e-9);
});

test('G1: the Section properties tab shows I_y, S_y and J with § links to its own steps; the Report §3 has them; R unchanged', () => {
  for (const P of [W.PSBModel.defaultProject(), pick(/^box/)]) {
    const B = W.PSBReportData.compute(P, null); assert.equal(B.err, '');
    const R0 = JSON.stringify(B.R), wj = W.weakAxisAndJ(B.R.g);
    const html = W.PSBUiSection.output({ P: B.P, inp: B.inp, R: B.R, W: B.W, ui: {} });
    const f0 = x => x.toLocaleString('en-US', { maximumFractionDigits: 0 });
    assert.ok(html.includes(`<span id="sec-Iy">${f0(wj.Iweak)}</span> in⁴`) && html.includes(`<span id="sec-J">${f0(wj.J)}</span> in⁴`) && html.includes(`<span id="sec-Sy">${f0(wj.Sy)}</span> in³`));
    for (const id of ['sec.wk.Iy', 'sec.wk.Sy', 'sec.wk.J']) { assert.ok(html.includes(`href="#st-${id}"`), 'link ' + id); assert.ok(html.includes(`id="st-${id}"`), 'step ' + id); }
    assert.ok(/Weak axis and torsion \(bare girder\)/.test(html));
    const M = W.PSBReportBuild.model(B), doc = W.SharedReport.build(M), T = W.SharedReport.text(doc);
    assert.ok(T.includes('Weak-axis I') && T.includes('St-Venant torsion J (bare girder)') && T.includes(f0(wj.J)), 'Report §3');
    assert.deepEqual(JSON.parse(JSON.stringify(doc.unresolved)), [], 'links resolve');
    assert.equal(JSON.stringify(B.R), R0, 'R unchanged');
  }
});

test('G2: P_jack = A_ps f_pbt (default: 40 × 0.217 = 8.68 in², f_pbt = 0.75 × 270 = 202.5 ksi, P_jack = 1,757.7 kip) on the tab with its step; the e / A_ps chart slot', () => {
  const P = W.PSBModel.defaultProject(), B = W.PSBReportData.compute(P, null), R = B.R, S = B.W.section;
  const s = S.steps.find(q => q.id === 'sec.Pj'); assert.ok(s);
  assert.equal(R.ss.Aps, 8.68); assert.equal(R.fpbt, 202.5); assert.ok(Math.abs(s.value - 1757.7) < 1e-9);
  assert.ok(Math.abs(s.value - R.ss.Aps * B.inp.str.jack * B.inp.str.fpu) < 1e-9, 'the old app\'s A_ps k_j f_pu');
  const html = W.PSBUiSection.output({ P: B.P, inp: B.inp, R, W: B.W, ui: {} });
  assert.ok(html.includes('<span id="sec-Pj">1,758</span> kip') && html.includes('href="#st-sec.Pj"') && html.includes('id="st-sec.Pj"'));
  assert.ok(html.includes('id="gfx_secE"'), 'the chart slot');
  assert.ok(R.grid.length > 60 && R.grid.every(r => Number.isFinite(r.e) && Number.isFinite(r.Aps)), 'R.grid e, Aps');
  assert.equal(R.grid[0].Aps, 0); assert.equal(R.grid.find(r => Math.abs(r.x - R.L / 2) < 1e-9).Aps, 8.68);
});

test('G3: the Analysis chart: the old app\'s added series off at first, the viewer\'s choice kept over them', () => {
  const A = W.PSBUiAnalysis;
  assert.deepEqual(JSON.parse(JSON.stringify(A.hiddenOf({}, 'M'))), { g: true, dc1: true, dc2: true, s1: true, s3: true });
  assert.deepEqual(JSON.parse(JSON.stringify(A.hiddenOf(null, 'V'))), { g: true, dc1: true, dc2: true, dw: true, s1: true });
  assert.deepEqual(JSON.parse(JSON.stringify(A.hiddenOf({ anHide: { M: { g: false, dc: true } } }, 'M'))), { g: false, dc1: true, dc2: true, s1: true, s3: true, dc: true });
  const src = (A.after + '');
  for (const f of ['M_g', 'M_DC1', 'M_DC2', 'M_DC', 'M_DW', 'M_LLpos', 'M_LLneg', 'M_StrI_pos', 'M_StrI_neg', 'M_SrvI_pos', 'M_SrvIII_pos', 'V_g', 'V_DC1', 'V_DC2', 'V_DC', 'V_DW', 'V_LLpos', 'V_LLneg', 'V_StrI_pos', 'V_StrI_neg', 'V_SrvI_pos'])
    assert.ok(src.includes(`f: '${f}'`), f);
});
