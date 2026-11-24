#!/usr/bin/env node
// Browser smoke test of the rolled-beam (W-shape) girder segments of Steel Bridge Design (ROLL, 2026-11-23; engine/rolled.js,
// shared/aisc-w.js). apps/steel-bridge/index.html, headless Chromium (tests/lib.mjs openPage):
//   1. the built-in project: the Girders & plates tab has the "Section type" card on Plate girder; nothing is written to the project
//      (no shape field, the saved text is the built-in project's);
//   2. Rolled shape: the search filters the list (grouped by nominal depth, each option with d, b_f and the weight); picking W36X135
//      writes the shape and its three plates (D 34.02, t_w 0.6, 12 x 0.79 flanges), the plate fields turn read-only, the card shows the
//      tabulated and the three-plate values; Undo puts the plates back; Plate girder removes the shape and keeps the plates;
//   3. a made-up 60 ft simple span of W36X135 (the hand-check bridge of tests/engine/sb-rolled.test.mjs): Section properties names the
//      shape and works the tabulated values and the three plates; Welds is "not applicable"; the Summary overview and the Report name the
//      shape; the Nomenclature lists k_des; Auto design says it sizes plates only;
//   4. a saved shape name that is not in the list: a warning on the card, the stored plates kept and editable, results computed;
//   5. 0 console errors.
//   node tests/smoke/steel-bridge-rolled.mjs [shotDir]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shotDir = process.argv[2] || '';
const FILE = path.join(REPO, 'apps/steel-bridge/index.html');
const settle = (p, t = 240000) => p.waitForFunction(() => !document.querySelector('#out .alert.stale:not([hidden])') && !/Calculating|updating/.test((document.querySelector('#autoMsg') || {}).textContent || ''), null, { timeout: t });
const saved = p => p.evaluate(() => JSON.parse(localStorage.getItem('sbd2.project.current') || '{}'));
const outTab = async (p, k) => { await p.click(`#tabBar [data-otab="${k}"]`); await settle(p); await p.waitForTimeout(300); return p.evaluate(() => document.getElementById('out').innerText); };
const shot = async (p, name, sel) => { if (!shotDir) return; if (sel) await p.evaluate(s => { const e = document.querySelector(s); if (e) e.scrollIntoView({ block: 'start' }); }, sel); await p.waitForTimeout(300); await p.screenshot({ path: path.join(shotDir, name) }); };
const allErrs = [];
const mark = s => { if (process.env.SB_TRACE) console.log('  ..', s, new Date().toISOString().slice(11, 19)); };

const A = await openPage(FILE, { vw: 1440, vh: 1000, dsf: 2 });
let rolled = null;
try {
  const p = A.p;
  await p.waitForSelector('#tabBar [data-otab="loads"]');
  await p.click('#inTabs [data-itab="gird"]');
  // 1. the built-in project is a plate girder
  assert.equal(await p.inputValue('#rl_type'), 'plate');
  assert.equal(await p.$$eval('#rl_shape', L => L.length), 0);
  const built = await p.evaluate(() => JSON.stringify(window.SBDModel.defaultProject().girders));
  assert.ok(!/"shape"/.test(built));
  assert.equal(await p.$$eval('#inPanes input.rl-ro', L => L.length), 0);
  // 2. rolled shape on segment 1
  await p.selectOption('#rl_type', 'rolled'); await p.waitForSelector('#rl_shape');
  let P = await saved(p); assert.ok(!P.girders || !JSON.stringify(P.girders).includes('shape'), 'nothing written before a shape is picked');
  const groups = await p.$$eval('#rl_shape optgroup', L => L.map(g => g.label));
  assert.equal(groups.length, 17); assert.equal(groups[2], 'W36: nominal depth 36 in');
  assert.equal(await p.$$eval('#rl_shape option', L => L.length), 290);
  await p.fill('#rl_find', 'x135'); await p.waitForTimeout(200);
  const found = await p.$$eval('#rl_shape option', L => L.map(o => o.textContent).filter(t => /^W/.test(t)));
  assert.deepEqual(found, ['W36X135 · d 35.6 in · b_f 12 in · 135 lb/ft']);
  await p.selectOption('#rl_shape', 'W36X135'); await p.waitForTimeout(400);
  P = await saved(p);
  assert.deepEqual(P.girders[0].segments[0], { x0: 0, x1: 88, D: 34.02, tw: 0.6, topB: 12, topT: 0.79, botB: 12, botT: 0.79, shape: 'W36X135' });
  assert.equal(P.girders[0].segments[1].shape, undefined); assert.equal(P.girders[0].segments[1].D, 60);
  assert.equal(await p.$$eval('#inPanes input.rl-ro', L => L.filter(i => i.readOnly).length), 6, 'the six plate fields of segment 1 are read-only');
  assert.equal(await p.$eval('#inPanes [data-path="girders.0.segments.0.x1"]', i => i.readOnly), false);
  const card = await p.$eval('#rl_tbl', t => t.innerText);
  assert.match(card, /W36X135/); assert.match(card, /Tabulated \(AISC Shapes Database v16\.0\)\s+35\.600\s+12\.000\s+0\.790\s+0\.600\s+39\.90\s+7,?800\s+135\.0/);
  assert.match(card, /Three plates used in the checks \(web D = d − 2tf = 34\.0200 in\)[\s\S]*39\.37\s+7,?713\s+134\.0/); assert.match(card, /Three plates \/ tabulated\s+0\.987\s+0\.989/);
  await shot(p, 'sb-rolled-1-picker.png', '#rl_type');
  mark('picked');
  // the built-in girder is hybrid-free (50W): no error; the Section properties tab of segment 1 names the shape
  const sec = await outTab(p, 'sec');
  assert.match(sec, /segment 1 \(x = 0\.00 to 88\.00 ft\): rolled shape W36X135, as three plates/);
  assert.match(sec, /Rolled shape: tabulated values and the three plates used/);
  mark('sec');
  // Undo: the plates of before; Redo; then Plate girder keeps the plates and removes the name
  await p.click('#bUndo'); await p.waitForTimeout(300); P = await saved(p);
  assert.deepEqual(P.girders[0].segments[0], { x0: 0, x1: 88, D: 60, tw: 0.5625, topB: 16, topT: 0.75, botB: 16, botT: 1.125 });
  await p.click('#bRedo'); await p.waitForTimeout(300); P = await saved(p); assert.equal(P.girders[0].segments[0].shape, 'W36X135');
  await p.selectOption('#rl_type', 'plate'); await p.waitForTimeout(300); P = await saved(p);
  assert.deepEqual(P.girders[0].segments[0], { x0: 0, x1: 88, D: 34.02, tw: 0.6, topB: 12, topT: 0.79, botB: 12, botT: 0.79 });
  assert.equal(await p.$$eval('#inPanes input.rl-ro', L => L.length), 0);
  mark('undo/plate');
  // 3. the hand-check bridge, built from the app's own default project
  rolled = await p.evaluate(() => { const M = window.SBDModel, Q = M.defaultProject(); Q.project.name = 'Rolled beam smoke: 60 ft simple span';
    Q.spans = { lengths: [60], continuity: 'simple' }; Q.xs = M.defaultXs(Q); Q.xs.bays = [8, 8, 8, 8]; Q.xs.ohL = 3; Q.xs.ohR = 3;
    Q.girders = [{ id: 'G1', label: 'G1', position: 'interior', beff: 96, segments: [{ x0: 0, x1: 60 }] }]; window.SBDRolled.apply(Q.girders[0].segments[0], 'W36X135');
    Q.framing.splices = []; ['A', 'B'].forEach(k => { Q.stiffeners.bearing.types[k].bt = 5.5; }); return Q; });
  mark('A built'); allErrs.push(...A.errs);
} finally { await A.b.close(); }
mark('A closed');

const B = await openPage(FILE, { vw: 1440, vh: 1000, dsf: 2, ls: { 'sbd2.project.current': JSON.stringify(rolled), 'sbd2.ui': JSON.stringify({ itab: 'gird', otab: 'sec' }) } });
try {
  const p = B.p;
  await p.waitForSelector('#tabBar [data-otab="loads"]');
  mark('B open'); assert.equal(await p.inputValue('#rl_type'), 'rolled'); assert.equal(await p.inputValue('#rl_shape'), 'W36X135'); mark('B card');
  assert.equal(await p.$eval('#rl_type', e => e.closest('.secBody').querySelectorAll('.alert').length), 0, 'no warning on the Section type card');
  const sec = await outTab(p, 'sec');
  assert.match(sec, /rolled shape W36X135, as three plates/);
  mark('B sec text');
  // open the rolled topic: the tabulated values and the ratio
  await p.evaluate(() => { const d = document.querySelector('#out details[data-sgk="roll"]'); if (d) d.open = true; });
  const work = await p.$eval('#out details[data-sgk="roll"]', d => d.innerText);
  assert.match(work, /Rolled shape W36X135: depth \(tabulated\)/); assert.match(work, /AISC Shapes Database v16\.0, W36X135/); assert.match(work, /Three-plate moment of inertia over the tabulated value/);
  await shot(p, 'sb-rolled-2-section.png', '#out details[data-sgk="roll"]');
  mark('B sec'); const an = await outTab(p, 'an'); assert.match(an, /rolled shape W36X135/);
  const wt = await outTab(p, 'wt'); assert.match(wt, /Welds: not applicable to G1\. Every weld location is on a rolled shape \(W36X135\)/);
  const flex = await outTab(p, 'flex'); assert.ok(!/Input errors/.test(flex));
  const shear = await outTab(p, 'shear'); assert.match(shear, /591\.9/);
  mark('B tabs');
  // Summary: the overview names the shape
  await p.click('#tabBar [data-otab="sum"]'); await p.waitForFunction(() => /Up to date/.test((document.querySelector('.sum-run') || {}).textContent || ''), null, { timeout: 600000 });
  const sum = await p.evaluate(() => document.getElementById('out').innerText);
  assert.match(sum, /G1 \(interior[^)]*; rolled shape W36X135\)/);
  await shot(p, 'sb-rolled-3-summary.png', '#sum-project');
  mark('B summary');
  // Report
  await p.click('#tabBar [data-otab="rpt"]'); await p.click('#rp_build'); await p.waitForSelector('.rp-doc .rp-tbl', { timeout: 600000 });
  const rpt = await p.evaluate(() => document.querySelector('.rp-doc').textContent);
  assert.match(rpt, /Rolled shapes \(AISC Shapes Database v16\.0\): W36X135\. Each is checked as its equivalent three plates/);
  assert.match(rpt, /positive flexure, rolled shape W36X135/);
  assert.match(rpt, /W36X135 \(rolled shape; d 35\.600/);
  mark('B report');
  // Drawings: the sheets build; the elevation and the plate schedule name the shape
  const dwg = await p.evaluate(() => { const Q = JSON.parse(localStorage.getItem('sbd2.project.current')), B = window.SBDSheets.build(window.SBDDrawings.model(Q), null, { paper: 'D' }), txt = B.D.toDXF({ ltscale: 1 });
    return { n: B.sheets.length, ok: window.SharedDxf.validate(txt).ok !== false, txt }; });
  assert.ok(dwg.n >= 8, 'sheets built: ' + dwg.n);
  assert.match(dwg.txt, /W36X135 \(ROLLED SHAPE\)/); assert.match(dwg.txt, /^ROLLED SHAPE\r?$/m, 'plate schedule row'); assert.match(dwg.txt, /^W36X135\r?$/m); assert.ok(!/FLANGE-TO-WEB FILLET WELDS/.test(dwg.txt), 'no flange-to-web weld quantity'); assert.ok(!/TOP FL\. 12/.test(dwg.txt));
  await p.click('#tabBar [data-otab="dwg"]'); await p.waitForSelector('.dwg-box svg', { timeout: 600000 });
  mark('B drawings');
  // Nomenclature: the symbols of the rolled steps
  const nm = await outTab(p, 'nm'); assert.match(nm, /Flange face to the web toe of the fillet/);
  // Auto design: plates only
  await p.click('#inTabs [data-itab="ad"]'); await p.waitForSelector('#ad_rolled');
  assert.match(await p.$eval('#ad_rolled', e => e.innerText), /Auto design sizes plate girders and does not run while a girder type it would size has a rolled shape \(G1/);
  await p.click('#ad_run'); await p.waitForTimeout(300);
  assert.ok(B.dialogs.some(d => /Auto design sizes plate girders\. G1.* has a rolled shape/.test(d)), 'Run Auto design explains and does not run');
  mark('B ad');
  // 4. a shape name that is not in the list
  await p.evaluate(() => { const Q = JSON.parse(localStorage.getItem('sbd2.project.current')); Q.girders[0].segments[0].shape = 'W37X999'; localStorage.setItem('sbd2.project.current', JSON.stringify(Q)); });
  await p.reload(); await p.waitForSelector('#tabBar [data-otab="loads"]'); await p.click('#inTabs [data-itab="gird"]');
  const warn = await p.$eval('#rl_type', e => e.closest('.secBody').innerText);
  assert.match(warn, /the rolled shape "W37X999" is not in the W-shape list/); assert.match(warn, /The stored plate sizes are used, as a plate girder/);
  assert.equal(await p.$$eval('#inPanes input.rl-ro', L => L.length), 0, 'the plates are editable again');
  const P2 = await saved(p); assert.deepEqual(P2.girders[0].segments[0], { x0: 0, x1: 60, D: 34.02, tw: 0.6, topB: 12, topT: 0.79, botB: 12, botT: 0.79, shape: 'W37X999' });
  const sec2 = await outTab(p, 'sec'); assert.ok(!/rolled shape W3/.test(sec2)); assert.match(sec2, /39\.37/);
  allErrs.push(...B.errs);
} finally { await B.b.close(); }

assert.deepEqual(allErrs, [], 'console errors: ' + allErrs.join(' | '));
console.log('ok   steel-bridge-rolled: picker, three plates, read-only fields, Section properties, Welds n/a, Summary, Report, Nomenclature, unknown shape fallback; 0 console errors');
