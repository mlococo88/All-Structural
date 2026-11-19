// Steel Bridge Report additions (2026-11-19, engineer's request; report and presentation only, no calculation change): Executive summary (verdict,
// governing D/C, a row per check group, the items not in the verdict), Basis of design, distribution factor sketches, steel bill of materials,
// design-point headers, Sign-off and revisions. Made-up bridges only (the app's built-in example, changed where stated).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js', 'dxf.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'engine/autodesign.js', 'engine/drawings.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js',
  'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js', 'engine/sheets.js', 'ui/deflection.js', 'ui/graphics.js', 'ui/gfxa.js', 'report/data.js', 'report/builders.js'].map(E));
const W = loadShared(...FILES);
const M = W.SBDModel, J = v => JSON.parse(JSON.stringify(v));
const build = P => { const B = W.SBDReportData.compute(P, 0), Md = W.SBDReportBuild.model(B, { detail: 'gov' }), doc = W.SharedReport.build(Md); return { B, Md, doc, txt: W.SharedReport.text(doc) }; };
let base = null; const get = () => (base = base || build(M.defaultProject()));

test('sections: Executive summary and Basis of design first, the module sections in their order, bill of materials and sign-off last; every link resolves', () => {
  const { Md, doc } = get();
  assert.equal(Md.sections.map(s => s.id).join(' '), 'exec basis sum proj loads an defl sec flex shear fat cn frm spl wd rt bom sign');
  assert.deepEqual(J(doc.unresolved), []);
});

test('Executive summary: a row for every check group of the Summary section (none dropped), the verdict and the items not in the verdict', () => {
  const { Md, txt } = get(), ex = Md.sections.find(s => s.id === 'exec'), tb = ex.subs[0].items.filter(i => i && i.type === 'table');
  const rows = tb[0].rows.map(r => r.cells), groups = Md.gov.filter(q => q.mod !== 'Flexure').map(q => q.grp);
  groups.forEach(g => assert.ok(rows.some(c => c[0] === g), `check group ${g} in the executive summary`));
  ['Flexure, Strength I, positive moment (M+)', 'Flexure, Strength I, negative moment (M−)', 'Flexure, Service II (GS12, GS13)'].forEach(t => assert.ok(rows.some(c => c[0] === t), t));
  // the built-in example fails GS7 (1.229) and the Inventory RF (0.61): FAIL; the governing D/C is the largest ratio of the table
  assert.match(ex.subs[0].items[0].svg, />FAIL</); const top = Math.max(...Md.gov.filter(q => q.rf == null && isFinite(q.r)).map(q => q.r));
  assert.match(txt, new RegExp(`Governing D/C: ${top.toFixed(3).replace('.', '\\.')}`));
  // not in the verdict: the span-to-depth guidance (optional) and the warnings, listed with their values
  assert.ok(tb[1] && tb[1].rows.some(r => /Span-to-depth/.test(r[0])) && tb[1].rows.some(r => r[0] === 'Warning'));
});

test('Executive summary: a girder that passes every check but is below the optional depth guidance reads PASS WITH NOTES, never PASS', () => {
  const P = M.defaultProject(); P.girders[0].segments.forEach(s => { s.D = 36; });   // made-up shallow girder
  const { Md } = build(P), ex = Md.sections.find(s => s.id === 'exec'), svg = ex.subs[0].items[0].svg, fails = Md.gov.some(q => (q.rf != null ? q.rf < 1 : q.r > 1));
  assert.ok(fails ? />FAIL</.test(svg) : />PASS WITH NOTES</.test(svg), svg.slice(0, 200));
  const nv = ex.subs[0].items.filter(i => i && i.type === 'table')[1]; assert.ok(nv.rows.some(r => /Span-to-depth/.test(r[0]) && r[1] === 'below optional AASHTO depth guidance'));
});

test('Basis of design: specification, materials (E_c, n as the sections), factors, combinations, IM, ADTT_SL and the analysis applicability', () => {
  const { Md, txt } = get(), P = M.defaultProject(), MR = W.SBDSections.modularRatio(4, 0.15, 1, 'exact');
  const i = txt.indexOf('Basis of design'), t = txt.slice(i, txt.indexOf('Summary of governing ratios'));
  // E_c = 120,000(1)(0.150)²(4)^0.33 = 4266 ksi; n = 6.798; ADTT_SL = 0.85(2000) = 1700
  assert.match(t, /E_c: 4266 ksi/); assert.ok(Math.abs(MR.n - 6.798) < 1e-3); assert.match(t, /6\.798/); assert.match(t, /0\.85\(2000\) = 1700/);
  assert.match(t, /Strength I \| 1\.250 \/ 0\.900 \| 1\.500 \/ 0\.650 \| 1\.750/); assert.match(t, /Service II \| 1\.00 \| 1\.00 \| 1\.300/); assert.match(t, /33 %/); assert.match(t, /Applicability \(SA4\): within the limits/);
});

test('Steel bill of materials: hand check of the first segment and the girder total (built-in example)', () => {
  const { txt } = get(), t = txt.slice(txt.indexOf('Steel bill of materials'));
  // segment 1: A = 60(0.5625) + 16(0.75) + 16(1.125) = 33.75 + 12 + 18 = 63.75 in²; w = 63.75 × 490/144 = 216.93 lb/ft; W = 216.93(88)/1000 = 19.090 kip
  assert.match(t, /G1 \| 1 \| 0\.00–88\.00 \| [^|]+\| 63\.750 \| 216\.93 \| 88\.00 \| 19\.090/);
  // segment 2: A = 33.75 + 18(1.5) + 18(2.0) = 96.75 in²; w = 329.22 lb/ft; W = 13.169 kip; girder: 2(19.090) + 2(13.169) + 22.560 = 87.077 kip
  assert.match(t, /96\.750 \| 329\.22 \| 40\.00 \| 13\.169/); assert.match(t, /G1 \| 87\.077 \|/); assert.match(t, /not checked and not in this total/);
});

test('Distribution factor sketches, design-point header, sign-off', () => {
  const { Md, txt } = get(), ld = Md.sections.find(s => s.id === 'loads'), dk = ld.subs.find(q => q.id === 'dfsk');
  assert.ok(dk && dk.items.length >= 2 && dk.items.every(i => i.type === 'figure' && /<svg/.test(i.svg)) && dk.items.some(i => /Lever rule/.test(i.caption)));
  assert.match(txt, /Station: x = 250\.01 ft\nSpan, x\/L: span 3, x\/L = 0\.000\nPlates \(in\): web 60\.000 × 0\.5625; top 18\.000 × 1\.5000; bottom 18\.000 × 2\.0000\nUnbraced length L_b, C_b: 24\.20 ft \(250\.00 to 274\.20 ft\)/);
  assert.match(txt, /Sign-off and revision history/); assert.match(txt, /Approved by/);
});

test('report only: the new sections change no result and write nothing into the project', () => {
  const P = M.defaultProject(), B = W.SBDReportData.compute(P, 0), s0 = JSON.stringify(P);   // the module builds (unchanged) fill their defaults first
  W.SBDReportBuild.model(B, { detail: 'gov' }); assert.equal(JSON.stringify(P), s0, 'exec, basis, bom, sign, the sketches and the headers write nothing');
  const F = W.SBDFlexureUI.build({ P, g: 0, src: 'analysis', method: 'auto' }); assert.equal(F.gov.gov.ratio, B.flex.gov.gov.ratio);
});
