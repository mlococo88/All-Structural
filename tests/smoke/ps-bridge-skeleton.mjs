#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), PR 1 skeleton (docs/ps-bridge-plan.md §5). Headless Chromium, file://, CDN libraries from tests/libs.
//   1. 1400 x 1000: 0 console errors; the 9 input tabs and 17 output tabs of the plan; the check summary column, the input panel, the
//      splitter and the output panel side by side; every tab opens (placeholders) without an error;
//   2. an input change (span lengths "100, 125, 100", made continuous) is autosaved to psb2.project.current (5 girders, 4 support skews);
//      a reload shows it; localStorage holds psb2.* keys only, and a seeded psbeam.* / sbd2.* key is byte-identical;
//   3. an invalid input (a negative bay) marks its field, counts on its input tab, lists it on the output panel and in the check summary,
//      and its link opens the field; fixing it clears them; PR 2b: a girder-design (base) input saved, a blank f'c marked / counted /
//      blocking, an owner change setting its defaults, a strand row added / outside the girder / deleted, PS-28 a row that does not fit the shape, psbeam.* keys untouched;
//   4. an unreadable saved project is kept under psb2.project.unreadable.<time> and the page says so;
//   3c. PR 2b-2: Section properties, Loads & LLDF, Analysis for three designs: every shown engine value (data-ev) = computeAll on the page;
//      graphics and KaTeX steps drawn; a link to another tab's step; the station choice; an input error blocks the three tabs;
//   3d. PR 2c-1: Losses and Stresses on the same designs (values = computeAll, >= 2 graphics, KaTeX); the strand-pattern graphic on the
//      Girders & strands input tab (draped label, hold-down dimension); the check summary chips (ratio = the engine's, a chip opens the
//      worked step of its value on its tab); the stress station and stage choices;
//   3e. PR 2c-2: Flexure and Shear the same way (on the continuous design the pier section graphic too); their chips;
//   3f. PR 2d-1: End zone & hold-down and Camber & deflection the same way (>= 2 graphics each); their chips; the end-zone chip opens its step;
//   3g. PR 2d-2: Rating the same way on every design; Handling and Deck "off" (card, chip) until turned on, then the same way (>= 2 graphics
//      each) on a fourth design; their chips; the Rating chip (lowest inventory RF, not a check) opens its step; the handling stage choice;
//   3h. PR 2d-3 (PS-10): the hold-down box on the Owner rules tab (AASHTO: on by default); the End zone tab works the PS-10 check and its chip
//      lists it; the box off removes the check and the tab says it is not checked; saved in the project;
//   3i. PR 2e: the Report tab: 14 numbered sections in order, every number of the report = computeAll on the page as the tabs format it, every
//      worked step rendered with KaTeX (no error, no unresolved §), a "see §" link of the summary jumps to its step, an in-app tab link opens
//      the tab, a section left out (chip) is gone and the choice kept in psb2.ui only; Print report puts the whole report alone on the page
//      (window.print stubbed, print media emulated: the app hidden, every step shown) and Ctrl+P on the tab prints the report without the
//      app header and the output panel's notes; an input error blocks it;
//   3j. 2026-11-13: the owner's material limits: no chip for AASHTO; CTDOT: the "Materials (owner limits)" (now "Owner limits") chip FAILs f′ci 6.8 > 6.5 ksi (1.046),
//      counted in the column's totals (= every engine check), opens the Owner rules tab at the rule's row (engine values = computeAll),
//      and the Report's §1 counts and groups the same;
//   3l. 2026-11-13: RIDOT, continuity on: the girder age at continuity in the "Owner limits" chip (renamed from "Materials (owner limits)"),
//      counted, opening its Owner rules row; the Report §1 row in that group; the handling elevation in both stages in the Report, the
//      tab's stage kept; no figure wording of the screen controls;
//   3k. 2026-11-13: the Report's graphics: each result section holds its tab's graphics (the tab's own drawing), numbered Figure n.m,
//      static, the handling stage named, labels >= 10 px on the printed page; Print report prints every figure; on the phone the figures are
//      drawn at the screen width and print at 700 px;
//   3m. PR 2f: "From the old app": the old app's design on screen (with its bridge model), a shared project and the older list are listed; the
//      chosen one imported (asked first), the summary (results the same, the other stored design kept), the project saved, a result tab's values
//      = the old inputs computed; an old Export JSON through Import JSON; a MIDAS demands file refused; every old key byte-identical; 390 px;
//   5. 390 x 844 (phone): stacked panels, no splitter, no check summary column, no horizontal page scroll (the Report too); 0 console errors.
//   node tests/smoke/ps-bridge-skeleton.mjs [--file <index.html>] [--shots <dir>]
import fs from 'fs';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const FILE = path.resolve(args.file || path.join(REPO, 'apps/ps-bridge/index.html'));
if (args.shots) fs.mkdirSync(args.shots, { recursive: true });
let failures = 0, checks = 0;
const check = (ok, msg) => { checks++; if (!ok) { failures++; console.log('  FAIL ' + msg); } };
const lsSnap = p => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
const ready = async p => { await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(400); };
const SEED = { 'psbeam.inputs.v1': '{"girder":"PCI BT-72","L":120}', 'sbd2.project.current': '{"schema":"sbd2.project"}' };

// 1. desktop
let o = await openPage(FILE, { vw: 1400, vh: 1000, ls: SEED }); let { p } = o;
await ready(p);
const itabs = await p.$$eval('#inTabs [data-itab]', b => b.map(x => x.textContent));
check(itabs.join('|') === 'Project|Bridge layout|Cross-section|Girders & strands|Materials|Diaphragms / deck|Loads|Owner rules|Auto design', 'input tabs: ' + itabs.join('|'));
const otabs = await p.$$eval('#tabBar [data-otab]', b => b.map(x => x.textContent));
check(otabs.length === 17 && otabs[0] === 'Summary' && otabs.includes('End zone & hold-down') && otabs.at(-1) === '3D view', 'output tabs: ' + otabs.join('|'));
const lay = await p.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(); return { d: r('sbDashCol'), i: r('inputPanel'), s: r('sbSplit'), o: r('outputPanel'), x: document.scrollingElement.scrollWidth - innerWidth }; });
check(lay.d.width >= 230 && lay.d.right <= lay.i.left + 1 && lay.i.right <= lay.s.left + 1 && lay.s.right <= lay.o.left + 1 && lay.o.width > 600 && lay.x <= 0, 'side-by-side layout ' + JSON.stringify(lay));
check(/Handling\s*off/.test(await p.textContent('#sbDashCol')) && /Deck\s*off/.test(await p.textContent('#sbDashCol')), 'check summary: Handling and Deck off');
if (args.shots) await p.screenshot({ path: path.join(args.shots, 'ps-bridge-1400.png') });
for (const t of ['proj', 'layout', 'xsec', 'gird', 'mat', 'dd', 'loads', 'own', 'ad']) { await p.click(`#inTabs [data-itab="${t}"]`); check(await p.isVisible(`#inPanes [data-pane="${t}"]`), 'input tab ' + t); }
for (let i = 0; i < otabs.length; i++) { await p.click(`#tabBar [data-otab]:nth-child(${i + 1})`); check((await p.textContent('#out')).length > 50, 'output tab ' + otabs[i]); }
// 2. edit, autosave, reload
await p.click('#inTabs [data-itab="layout"]');
await p.fill('#i_spans\\.lengths', '100, 125, 100'); await p.press('#i_spans\\.lengths', 'Tab');
await p.selectOption('#i_spans\\.continuity', 'composite');
let ls = await lsSnap(p), sv = JSON.parse(ls['psb2.project.current'] || 'null');
check(sv && sv.spans.lengths.join() === '100,125,100' && sv.spans.continuity === 'composite' && sv.xs.skews.length === 4, 'autosaved ' + JSON.stringify(sv && sv.spans));
check(Object.keys(ls).every(k => k.startsWith('psb2.') || k in SEED || k === '__seeded'), 'keys: ' + Object.keys(ls).join(', '));
Object.entries(SEED).forEach(([k, v]) => check(ls[k] === v, 'untouched ' + k));
await p.reload(); await ready(p);
check((await p.inputValue('#i_spans\\.lengths')) === '100, 125, 100', 'reload keeps the spans');
// 3. invalid input (model): a negative bay (PR 3a-2: unequal bays are no longer an input error)
await p.click('#inTabs [data-itab="xsec"]');
await p.fill('#i_xs\\.bays', '9, -2, 9, 9'); await p.press('#i_xs\\.bays', 'Tab');
check(await p.$eval('#i_xs\\.bays', e => e.classList.contains('bad')), 'bad field marked');
check((await p.textContent('#inTabs [data-itab="xsec"] .inDot')) === '1', 'tab count ' + await p.textContent('#inTabs [data-itab="xsec"] .inDot'));
check(/Bay 2 spacing must be a positive number/.test(await p.textContent('#out')) && /1 to fix/.test(await p.textContent('#sbDashCol')), 'errors listed');
check(/Results not shown/.test(await p.textContent('#out')), 'results blocked');
await p.click('#inTabs [data-itab="proj"]'); await p.click('#out [data-icgo="0"]');
check(await p.isVisible('#inPanes [data-pane="xsec"]') && await p.evaluate(() => document.activeElement && document.activeElement.id === 'i_xs.bays'), 'error link opens the field');
await p.fill('#i_xs\\.bays', '9, 9, 9, 9'); await p.press('#i_xs\\.bays', 'Tab');
check(!(await p.$eval('#i_xs\\.bays', e => e.classList.contains('bad'))) && !/to fix/.test(await p.textContent('#sbDashCol')), 'fixed');
// 3b. PR 2b: a girder-design input (base) is saved; a blank f'c is marked with its message, counted on Materials, blocks results; the
// owner change sets an input still at its default to the owner's default (RIDOT: H 80 %) and says so
await p.click('#inTabs [data-itab="mat"]');
await p.fill('#i_base\\.mat\\.fc', ''); await p.press('#i_base\\.mat\\.fc', 'Tab');
check(await p.$eval('#i_base\\.mat\\.fc', e => e.classList.contains('bad')) && /is blank: enter a value/.test(await p.textContent('#inPanes')), 'base field marked with its message');
check((await p.textContent('#inTabs [data-itab="mat"] .inDot')) === '1' && /Materials › f/.test(await p.textContent('#out')), 'base error counted and listed');
await p.fill('#i_base\\.mat\\.fc', '9'); await p.press('#i_base\\.mat\\.fc', 'Tab');
ls = await lsSnap(p); sv = JSON.parse(ls['psb2.project.current']);
check(sv.base.mat.fc === 9 && !/to fix/.test(await p.textContent('#sbDashCol')), 'base input saved: ' + sv.base.mat.fc);
await p.click('#inTabs [data-itab="own"]'); await p.selectOption('#i_base\\.owner', 'RIDOT');
ls = await lsSnap(p); sv = JSON.parse(ls['psb2.project.current']);
check(sv.base.owner === 'RIDOT' && sv.base.mat.H === 80 && /mat\.H 70 → 80/.test(await p.textContent('#notices')), 'owner defaults set: ' + sv.base.mat.H);
check(await p.isVisible('#i_base\\.opt\\.etaR'), 'owner question shown');
// PS-22 (engineer decision, 2026-11-13): the notice is an inline banner between the tab bar and the tab content (in the page flow, below the
// tab bar, the content pushed down), it stays when other output tabs are opened, and goes only with its Close button
{ const pl = async () => p.evaluate(() => { const n = document.querySelector('#notices .notice'), tb = document.getElementById('tabBar').getBoundingClientRect(), o = document.getElementById('out').getBoundingClientRect();
    if (!n) return null; const r = n.getBoundingClientRect(), pos = getComputedStyle(n).position, box = getComputedStyle(document.getElementById('notices')).position;
    return { inFlow: pos === 'static' && box === 'static', below: r.top >= tb.bottom - 0.5, pushed: o.top >= r.bottom - 0.5, next: n.parentElement.nextElementSibling.id, prev: n.parentElement.previousElementSibling.id }; });
  const a = await pl(); check(a && a.inFlow && a.below && a.pushed && a.prev === 'tabBar' && a.next === 'out', 'notice inline below the tab bar, content pushed down: ' + JSON.stringify(a));
  await p.click('#tabBar [data-otab="lds"]'); await p.waitForTimeout(150); await p.click('#tabBar [data-otab="sum"]'); await p.waitForTimeout(150);
  const b = await pl(); check(b && b.below && b.pushed && /mat\.H 70 → 80/.test(await p.textContent('#notices')), 'the notice stays across tab clicks until closed'); }
await p.click('#notices .nClose');
check((await p.$$('#notices .notice')).length === 0, 'Close removes the notice');
await p.click('#inTabs [data-itab="gird"]'); await p.click('[data-act="add"][data-tbl="base.rows"]');
ls = await lsSnap(p); sv = JSON.parse(ls['psb2.project.current']);
check(sv.base.rows.length === 4 && sv.base.rows[3].y === 8, 'strand row added');
await p.fill('[data-path="base.rows.3.y"]', '90'); await p.press('[data-path="base.rows.3.y"]', 'Tab');
check(await p.$eval('[data-path="base.rows.3.y"]', e => e.classList.contains('bad')) && /not inside the girder/.test(await p.textContent('#inPanes')), 'row outside the girder marked');
await p.click('[data-act="del"][data-tbl="base.rows"][data-i="3"]');
check(!/to fix/.test(await p.textContent('#sbDashCol')), 'row deleted, no errors');
// PS-28 (engineer decision 2026-11-14): a row that does not fit the shape (16 strands on the BT-72's 26 in bottom flange: x = ±15 in) is a
// blocking input error naming the row: the count outlined with its message, counted on the tab, listed in the check summary; the Report shows
// no results; the project keeps the value; 10 again clears it
await p.fill('[data-path="base.rows.0.n"]', '16'); await p.press('[data-path="base.rows.0.n"]', 'Tab');
{ const t = await p.textContent('#inPanes');
  check(await p.$eval('[data-path="base.rows.0.n"]', e => e.classList.contains('bad')) && /row 1: 16 strands at y = 2 in do not fit the PCI BT-72: the strand at x = -15 in is outside the concrete outline/.test(t), 'PS-28: a row that does not fit marked with its message');
  check((await p.textContent('#inTabs [data-itab="gird"] .inDot')) === '1' && /do not fit the PCI BT-72/.test(await p.textContent('#sbDashCol')) && /to fix/.test(await p.textContent('#sbDashCol')), 'PS-28: counted on the tab and listed in the check summary');
  ls = await lsSnap(p); sv = JSON.parse(ls['psb2.project.current']); check(sv.base.rows[0].n === 16, 'PS-28: the entered count kept: ' + sv.base.rows[0].n);
  await p.click('#tabBar [data-otab="rpt"]'); await p.waitForTimeout(200);
  check(!!(await p.$('#out #icNone')) && !(await p.$('#rptHost')) && /do not fit the PCI BT-72/.test(await p.textContent('#out')), 'PS-28: the Report blocked with the error listed');
  await p.click('#tabBar [data-otab="sum"]'); await p.waitForTimeout(150); await p.click('#inTabs [data-itab="gird"]'); }
await p.fill('[data-path="base.rows.0.n"]', '10'); await p.press('[data-path="base.rows.0.n"]', 'Tab');
check(!/to fix/.test(await p.textContent('#sbDashCol')) && !(await p.$eval('[data-path="base.rows.0.n"]', e => e.classList.contains('bad'))), 'PS-28: 10 strands fit again, no errors');
await p.click('#inTabs [data-itab="gird"]'); await p.waitForTimeout(200);
{ const t = (await p.textContent('#gfx_strands_in')).replace(/\s+/g, ' ');
  check(/draped/.test(t) && /0\.400 L/.test(t) && /hold-down/.test(t), 'strand pattern on the input tab: draped, hold-down at frac x L: ' + t.slice(0, 200)); }
if (args.shots) { await p.click('#tabBar [data-otab="loss"]'); await p.waitForTimeout(300); await p.screenshot({ path: path.join(args.shots, 'ps-bridge-1400-gird-loss.png') }); }
ls = await lsSnap(p);
check(Object.keys(ls).every(k => k.startsWith('psb2.') || k in SEED || k === '__seeded'), 'keys after edits: ' + Object.keys(ls).join(', '));
Object.entries(SEED).forEach(([k, v]) => check(ls[k] === v, 'untouched after edits ' + k));
check(!o.errs.length, 'console errors (1400 px): ' + o.errs.join(' | '));
await o.b.close();
o = await openPage(FILE, { vw: 1400, vh: 1000, ls: SEED }); p = o.p; await ready(p);
// 3c. PR 2b-2: the Section properties, Loads & LLDF and Analysis tabs, three designs: every engine value shown (data-ev) equals computeAll of
// the design inputs, evaluated on the page; the graphics are drawn; the worked steps are KaTeX; links to a step of another tab open it
const evCheck = async () => p.evaluate(() => {
  const s0 = localStorage.getItem('psb2.project.current'), P = s0 ? window.PSBModel.importJSON(s0).project : window.PSBModel.newProject(), R = window.PSBHoldDown.compute(window.PSBDesign.inputs(P));
  const f = (v, d) => typeof v === 'number' && isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/^-(0(\.0*)?)$/, '$1') : '—';
  const bad = [], els = [...document.querySelectorAll('#out [data-ev]')];
  els.forEach(el => { let v = el.dataset.ev.split('.').reduce((o, k) => o == null ? o : o[k], R); if (el.dataset.div) v = v / +el.dataset.div;
    if (typeof v !== 'number' || el.textContent !== f(v, +el.dataset.d)) bad.push(`${el.dataset.ev}: ${el.textContent} vs ${v}`); });
  return { n: els.length, bad, svg: document.querySelectorAll('#out svg').length, katex: document.querySelectorAll('#out .katex').length };
});
const DESIGNS = [['default', null], ['continuous, exterior G1 in span 2, restraint', async () => {
    await p.click('#inTabs [data-itab="layout"]'); await p.fill('#i_spans\\.lengths', '100, 125, 100'); await p.press('#i_spans\\.lengths', 'Tab');
    await p.selectOption('#i_spans\\.continuity', 'composite'); await p.selectOption('#i_base\\.cont\\.restraint', 'true');
    // PR 3a-1: the new spans got copies of span 1's girder types (notice); the type and line are chosen above the output tabs
    while (await p.isVisible('#notices .nClose')) await p.click('#notices .nClose');
    await p.click('#tabBar [data-otab="sec"]'); await p.selectOption('#tyOutT', { label: 'Exterior S2 (span 2)' }); await p.selectOption('#tyOutL', '1'); }],
  ['NEXT 36F, skew 35 deg, one span', async () => {
    await p.click('#inTabs [data-itab="layout"]'); await p.fill('#i_spans\\.lengths', '90'); await p.press('#i_spans\\.lengths', 'Tab'); await p.fill('#i_xs\\.skews', '35, 35'); await p.press('#i_xs\\.skews', 'Tab');
    await p.click('#inTabs [data-itab="xsec"]'); await p.fill('#i_xs\\.bays', '10, 10, 10, 10'); await p.press('#i_xs\\.bays', 'Tab');
    await p.click('#inTabs [data-itab="gird"]'); await p.selectOption('#i_base\\.girder', 'NEXT 36F'); await p.fill('#i_base\\.harp\\.n', '0'); await p.press('#i_base\\.harp\\.n', 'Tab'); }],
  ['handling and deck on, BT-72, one span', async () => {
    await p.click('#inTabs [data-itab="gird"]'); await p.selectOption('#i_base\\.girder', 'PCI BT-72'); await p.fill('#i_base\\.harp\\.n', '12'); await p.press('#i_base\\.harp\\.n', 'Tab');
    await p.click('#inTabs [data-itab="loads"]'); await p.selectOption('#i_base\\.handling\\.on', 'true');
    await p.click('#inTabs [data-itab="dd"]'); await p.selectOption('#i_base\\.deck\\.on', 'true'); }]];
for (const [lab, setup] of DESIGNS) {
  if (setup) await setup();
  check(!/to fix/.test(await p.textContent('#sbDashCol')), `${lab}: no input error`);
  const on = /handling and deck on/.test(lab);
  if (!on) for (const t of ['hand', 'deck']) { await p.click(`#tabBar [data-otab="${t}"]`); await p.waitForTimeout(150);
    check(/are off|is off/.test(await p.textContent('#out')) && !(await p.$('#out [data-ev]')) && !!(await p.$('#out a[data-goin]')), `${lab} / ${t}: off, with the link to its input`); }
  for (const t of on ? ['hand', 'deck', 'rt'] : ['sec', 'lds', 'an', 'loss', 'str', 'flex', 'shear', 'end', 'camb', 'rt']) {
    await p.click(`#tabBar [data-otab="${t}"]`); await p.waitForTimeout(250);
    const r = await evCheck();
    check(r.n >= 20 && !r.bad.length, `${lab} / ${t}: ${r.n} values, mismatches ${r.bad.slice(0, 5).join(' | ')}`);
    check(r.svg >= (['loss', 'str', 'end', 'camb', 'hand', 'deck', 'rt'].includes(t) ? 2 : 1) && r.katex >= 5 && (t !== 'flex' || !/continuous/.test(lab) || r.svg >= 2), `${lab} / ${t}: graphic ${r.svg}, KaTeX ${r.katex}`);
    if (args.shots && ['loss', 'str', 'flex', 'shear', 'end', 'camb', 'hand', 'deck', 'rt'].includes(t)) await p.screenshot({ path: path.join(args.shots, `ps-bridge-1400-${t}-${lab.split(',')[0].replace(/[^A-Za-z0-9]+/g, '_')}.png`) });
  }
  // the check summary column: a chip per built group with the engine's governing ratio
  const dash = await p.evaluate(() => { const s0 = localStorage.getItem('psb2.project.current'), P = s0 ? window.PSBModel.importJSON(s0).project : window.PSBModel.newProject(), R = window.PSBHoldDown.compute(window.PSBDesign.inputs(P));
    // PR 3a-2: each chip governs over every girder type × line (PSBBridge.results)
    const A = window.PSBBridge.hasTypes(P) ? window.PSBBridge.results(P, i => window.PSBHoldDown.compute(JSON.parse(JSON.stringify(i)))) : { cells: [{ R }] };
    const grp = window.PSBDashUI.GROUPS.filter(g => g.checks), bad = [];
    grp.forEach(g => { const cs = A.cells.flatMap(z => g.checks.map(q => z.R.checks.find(c => c.n === q[0]))).filter(Boolean); if (!cs.length) return; const gov = cs.reduce((b, c) => c.r > b.r ? c : b);
      const el = document.querySelector(`#sbDashCol [data-sdgrp="${g.id}"] .sdVal`); if (!el || el.textContent !== gov.r.toFixed(3)) bad.push(`${g.id}: ${el && el.textContent} vs ${gov.r}`); });
    return { n: grp.length, bad }; });
  check(!dash.bad.length, `${lab}: check summary chips ${dash.bad.join(' | ')}`);
  // PR 2d-2: the Rating chip = the lowest HL-93 inventory RF of the engine
  const rc = await p.evaluate(() => { const s0 = localStorage.getItem('psb2.project.current'), P = s0 ? window.PSBModel.importJSON(s0).project : window.PSBModel.newProject(), R = window.PSBHoldDown.compute(window.PSBDesign.inputs(P));
    const A = window.PSBBridge.hasTypes(P) ? window.PSBBridge.results(P, i => window.PSBHoldDown.compute(JSON.parse(JSON.stringify(i)))) : { cells: [{ R }] };   // PR 3a-2: the lowest over every type × line
    const v = A.cells.flatMap(z => window.PSBDashUI.RATING.rf.map(q => q[1](z.R))).filter(x => x < 99), el = document.querySelector('#sbDashCol [data-sdgrp="rt"] .sdVal'); return { want: Math.min(...v).toFixed(3), got: el && el.textContent }; });
  check(rc.want === rc.got, `${lab}: rating chip ${rc.got} vs ${rc.want}`);
}
// PR 2d-2: the handling stage choice; the Rating chip opens its step; the Handling chip opens its step
await p.click('#tabBar [data-otab="hand"]'); await p.click('#hnElFig [data-vkseg="haul"]');
check(await p.evaluate(() => document.querySelector('#hnElFig [data-vkseg="haul"]').getAttribute('aria-pressed') === 'true' && /hauling/.test(document.querySelector('#hnElFig svg').getAttribute('aria-label'))), 'handling stage choice');
await p.click('#tabBar [data-otab="sum"]'); await p.click('#sbDashCol [data-sdgrp="rt"] .sdMain');
check(await p.evaluate(() => document.querySelector('#tabBar [data-otab="rt"]').getAttribute('aria-selected') === 'true' && [...document.querySelectorAll('#out details[open] li[id^="st-rt."]')].length > 0), 'rating chip opens the Rating tab and the step');
await p.click('#tabBar [data-otab="sum"]'); await p.click('#sbDashCol [data-sdgrp="hand"] .sdMain');
check(await p.evaluate(() => document.querySelector('#tabBar [data-otab="hand"]').getAttribute('aria-selected') === 'true' && [...document.querySelectorAll('#out details[open] li[id^="st-hn."]')].length > 0), 'handling chip opens the Handling tab and the step');
await p.click('#tabBar [data-otab="lds"]'); await p.click('#out a.wk[data-gotab="sec"]');
check(await p.evaluate(() => { const el = document.getElementById('st-sec.g.wsw'); return !!el && el.closest('details').open && document.querySelector('#tabBar [data-otab="sec"]').getAttribute('aria-selected') === 'true'; }), 'link to a step of another tab opens it');
await p.click('#tabBar [data-otab="an"]'); await p.selectOption('#o_anSel', '0');
check(/x = 0\.00 ft/.test(await p.textContent('#out')), 'station choice');
// PR 2c-1: a chip opens the worked step of its value; the stress station and the stage; the strand-pattern graphic on the input tab
await p.click('#tabBar [data-otab="sum"]'); await p.click('#sbDashCol [data-sdgrp="srv"] .sdMain');
check(await p.evaluate(() => document.querySelector('#tabBar [data-otab="str"]').getAttribute('aria-selected') === 'true' && [...document.querySelectorAll('#out details[open] li[id^="st-st."]')].length > 0), 'chip opens the Stresses tab and the step');
await p.click('#sbDashCol [data-sdgrp="rel"] .sdX'); check((await p.$$('#sbDashCol [data-sdgrp="rel"] .sdList li')).length >= 2, 'chip lists its checks');
await p.selectOption('#o_stSel', '0'); check(/selected station x = 0\.00 ft/.test(await p.textContent('#out')), 'stress station choice');
await p.click('#stSecFig [data-vkseg="s2"]'); check(await p.evaluate(() => /s2Top/.test(document.querySelector('#stSecFig h3').textContent)), 'stress stage choice');
if (args.shots) { await p.click('#tabBar [data-otab="str"]'); await p.waitForTimeout(300); await p.screenshot({ path: path.join(args.shots, 'ps-bridge-1400-gird-str.png') }); }
// PR 2d-1: the End zone chip opens the worked step of the splitting ratio
await p.click('#tabBar [data-otab="sum"]'); await p.click('#sbDashCol [data-sdgrp="end"] .sdMain');
check(await p.evaluate(() => document.querySelector('#tabBar [data-otab="end"]').getAttribute('aria-selected') === 'true' && [...document.querySelectorAll('#out details[open] li[id^="st-ez."]')].length > 0), 'chip opens the End zone tab and the step');
check(!!(await p.$('#sbDashCol [data-sdgrp="camb"] .sdVal')), 'camber chip');
// PR 2d-3 (PS-10): the hold-down box (AASHTO, default on), the check on the End zone tab and in its chip; off removes it
await p.click('#inTabs [data-itab="own"]');
check(await p.isVisible('#i_base\\.opt\\.hdCheck') && (await p.inputValue('#i_base\\.opt\\.hdCheck')) === 'true' && (await p.inputValue('#i_base\\.opt\\.hdFrac')) === '0.75', 'PS-10 box on, 0.75');
await p.click('#tabBar [data-otab="end"]'); await p.waitForTimeout(250);
{ const r = await p.evaluate(() => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, R = window.PSBHoldDown.compute(window.PSBDesign.inputs(P));
    return { has: !!(R.ps10 && !R.ps10.off), F: R.ps10 && R.ps10.Ftot, t: document.getElementById('out').textContent, step: !!document.getElementById('st-ez.hd.F'), ev: !!document.querySelector('#out [data-ev="ps10.Ftot"]') }; });
  check(r.has && r.step && r.ev && /PS-10/.test(r.t), 'PS-10 check worked on the End zone tab'); }
await p.click('#sbDashCol [data-sdgrp="end"] .sdX'); check(/Hold-down force \(PS-10\)/.test(await p.textContent('#sbDashCol')), 'PS-10 in the End zone chip');
await p.click('#inTabs [data-itab="own"]'); await p.selectOption('#i_base\\.opt\\.hdCheck', 'false'); await p.click('#tabBar [data-otab="end"]'); await p.waitForTimeout(250);
check(/not checked for AASHTO/.test(await p.textContent('#out')) && !(await p.$('#out [data-ev^="ps10."]')) && !/PS-10\)/.test(await p.textContent('#sbDashCol')) && JSON.parse((await lsSnap(p))['psb2.project.current']).base.opt.hdCheck === false, 'PS-10 box off: no check, saved');
await p.click('#inTabs [data-itab="own"]'); await p.selectOption('#i_base\\.opt\\.hdCheck', 'true');
// PR 2e: the Report tab
{ await p.click('#tabBar [data-otab="rpt"]'); await p.waitForSelector('.rp-doc .rp-step', { timeout: 60000 });
  const r = await p.evaluate(() => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, R = window.PSBHoldDown.compute(window.PSBDesign.inputs(P)), M = window.PSBReportUI.state.M;
    const at = (o, q) => q.split('.').reduce((a, k) => a == null ? a : a[k], o), fx = window.PSBOutKit.fx;
    // PS-25: the page's first project has two girder types: each worked on its governing line (units), each value = its unit's computeAll
    const U = window.PSBReportData.compute(P, null, 'gov').units.map(u => window.PSBHoldDown.compute(JSON.parse(JSON.stringify(u.inp)))), Rv = v => v.u != null ? U[v.u] : R;
    const bad = M.vals.filter(v => v.text !== fx(v.div ? at(Rv(v), v.path) / v.div : at(Rv(v), v.path), v.d)).map(v => v.path);
    const nSt = M.sections.reduce((a, s) => a + s.subs.reduce((b, q) => b + q.items.filter(i => i.type === 'steps').reduce((c, i) => c + i.steps.length, 0), 0), 0);
    return { secs: [...document.querySelectorAll('.rp-doc .rp-h1')].map(h => h.textContent.trim()), vals: M.vals.length, bad, nSt, steps: document.querySelectorAll('.rp-doc .rp-step').length,
      kErr: document.querySelectorAll('.rp-doc .katex-error').length, unres: document.querySelectorAll('.rp-doc .rp-bad').length, katex: document.querySelectorAll('.rp-doc .rp-step .katex').length,
      text: /NaN|undefined|\[object/.test(document.querySelector('.rp-doc').innerText), see: document.querySelectorAll('.rp-doc .rp-see').length }; });
  check(r.secs.length === 26 && /^1\. Summary of checks/.test(r.secs[0]) && /^3\. Section properties: Interior S1 on G2, span 1$/.test(r.secs[2]) && /^14\. Rating: Interior S1 on G2, span 1$/.test(r.secs[13])
    && /^15\. Section properties: Exterior S1 on G1, span 1$/.test(r.secs[14]) && /^26\. Rating: Exterior S1 on G1, span 1$/.test(r.secs[25]), 'report sections (PS-25: per girder type, its governing line): ' + r.secs.join(' | '));
  check(r.vals > 1000 && !r.bad.length, `report values = computeAll (${r.vals}; differ: ${r.bad.slice(0, 5).join(', ')})`);
  check(r.steps === r.nSt && r.steps > 200 && r.katex > 200 && !r.kErr && !r.unres && !r.text && r.see > 100, 'report steps, KaTeX, § links ' + JSON.stringify({ ...r, secs: undefined, bad: undefined }));
  // 2026-11-13: the graphics of each result tab in its section (the tab's own drawing), numbered Figure n.m by the section, static (no
  // read-out, no controls), the handling stage named; labels at least 10 px on the printed page (drawn at 700 px = the printed width)
  const FIGQ = () => p.evaluate(() => { const secs = [...document.querySelectorAll('.rp-doc section.rp-sec')], out = { per: {}, bad: [], n: 0, small: [], caps: [] };
    secs.forEach(sec => { const h = sec.querySelector('.rp-h1'), n = parseInt(h.textContent, 10), title = h.textContent.replace(/^\d+\.\s*/, '').replace(/: \S+ S\d+ on G\d+, span \d+$/, ''); let m = 0;   // PS-25: the unit in the heading
      sec.querySelectorAll('.rp-fig').forEach(f => { m++; out.n++; const cap = f.querySelector('figcaption').textContent; out.caps.push(cap); if (!cap.startsWith(`Figure ${n}.${m}: `)) out.bad.push(cap.slice(0, 40));
        if (!f.querySelector('svg') || f.querySelector('button, select, input, .va-hov, .vk-read')) out.bad.push('static ' + cap.slice(0, 30));
        const box = f.querySelector('.rp-fig-prn') || f;
        box.querySelectorAll('svg').forEach(svg => { const vb = svg.viewBox.baseVal, vbW = (vb && vb.width) || svg.getBoundingClientRect().width, wa = svg.getAttribute('width'), sc = Math.min(wa && /^[\d.]+$/.test(wa) ? +wa : vbW, 700) / vbW;
          if (vbW > 702) out.bad.push('wider than the page ' + cap.slice(0, 30));
          svg.querySelectorAll('text').forEach(t => { if (!t.textContent.trim()) return; const e = parseFloat(getComputedStyle(t).fontSize) * sc; if (e < 9.95) out.small.push(`${cap.slice(0, 12)} "${t.textContent.slice(0, 20)}" ${e.toFixed(1)}`); }); }); });
      out.per[title] = (out.per[title] || 0) + m; });
    return out; });
  { const f = await FIGQ(), want = ['Section properties', 'Loads & LLDF', 'Analysis', 'Prestress losses', 'Stresses', 'Flexure', 'Shear', 'End zone & hold-down', 'Camber & deflection', 'Handling', 'Deck', 'Rating'];
    check(f.n >= 20 && !f.bad.length && !f.small.length && want.every(t => f.per[t.toUpperCase()] >= 1 || f.per[t] >= 1) && !f.per['Summary of checks'.toUpperCase()] && !f.per['Summary of checks'], 'report figures: every result section, numbered, static, labels >= 10 px printed ' + JSON.stringify({ n: f.n, per: f.per, bad: f.bad.slice(0, 5), small: f.small.slice(0, 5) }));
    check(f.caps.some(c => /Girder on its supports.*shown: Stage: Lifting/.test(c)) && f.caps.some(c => /Strand pattern/.test(c)) && f.caps.some(c => /Deck section/.test(c)) && f.caps.some(c => /Camber/.test(c)) && f.caps.some(c => /Rated sections/.test(c)), 'report figures: handling elevation with its stage, strand pattern, deck section, camber, rating locations ' + f.caps.filter(c => /supports/.test(c)).join(' | '));
    // 2026-11-13: the handling elevation in both stages, Lifting then Hauling (the tab was left on Hauling above), and the tab's stage kept;
    // no caption speaks of the screen controls or of a table above (the Report's tables follow its figures)
    const hi = f.caps.findIndex(c => /Girder on its supports/.test(c));
    check(hi >= 0 && /shown: Stage: Lifting$/.test(f.caps[hi]) && /^Figure 12\.3: Girder on its supports.*shown: Stage: Hauling$/.test(f.caps[hi + 1] || '') && /^Figure 12\.2: /.test(f.caps[hi]) && f.caps.filter(c => /Girder on its supports/.test(c)).length === 4, 'report: handling elevation, Lifting and Hauling ' + JSON.stringify(f.caps.slice(hi, hi + 2)));
    const words = await p.evaluate(() => [...document.querySelectorAll('.rp-doc .rp-fig')].map(x => x.textContent).filter(t => /click|\btap\b|point at|hover|button|select it|\bShow\b|table above/i.test(t)).map(t => t.slice(0, 60)));
    check(!words.length, 'report figures: no wording of the screen controls ' + JSON.stringify(words));
    if (args.shots) { await p.evaluate(() => { const f = [...document.querySelectorAll('.rp-doc .rp-fig')].find(x => /Strand pattern/.test(x.textContent)); f.scrollIntoView({ block: 'start' }); }); await p.waitForTimeout(200); await p.screenshot({ path: path.join(args.shots, 'ps-bridge-1400-report-figure.png') }); } }
  const j = await p.evaluate(() => { const a = [...document.querySelectorAll('.rp-doc section[data-rpsec="rp-s1"] .rp-see')].find(x => (document.getElementById(x.getAttribute('href').slice(1)) || { classList: { contains: () => false } }).classList.contains('rp-step')), id = a.getAttribute('href').slice(1); a.click(); const el = document.getElementById(id), b = el.getBoundingClientRect(); return { id, step: el.classList.contains('rp-step'), inView: b.top >= -2 && b.top < innerHeight }; });
  check(j.step && j.inView, 'summary "see §" link jumps to its step ' + JSON.stringify(j));
  if (args.shots) { await p.evaluate(() => document.querySelector('.rp-doc section[data-rpsec="rp-s1"]').scrollIntoView()); await p.waitForTimeout(200); await p.screenshot({ path: path.join(args.shots, 'ps-bridge-1400-report.png') }); }
  await p.click('.rp-doc a.rp-go[data-rpgoto="str"]'); check(await p.evaluate(() => document.querySelector('#tabBar [data-otab="str"]').getAttribute('aria-selected') === 'true'), 'report tab link opens the Stresses tab');
  await p.click('#tabBar [data-otab="rpt"]'); await p.waitForSelector('.rp-doc .rp-step');
  await p.uncheck('[data-rpinc="loss"]'); await p.waitForSelector('.rp-doc .rp-step');
  const off = await p.evaluate(() => ({ secs: [...document.querySelectorAll('.rp-doc .rp-h1')].map(h => h.textContent), ui: JSON.parse(localStorage.getItem('psb2.ui')), unres: document.querySelectorAll('.rp-doc .rp-bad').length, proj: JSON.parse(localStorage.getItem('psb2.project.current')) }));
  check(off.secs.length === 24 && !off.secs.some(t => /Prestress losses/.test(t)) && off.ui.rpt.inc.loss === false && !off.unres && !('rpt' in off.proj), 'section left out, kept in psb2.ui (not in the project)');
  await p.check('[data-rpinc="loss"]'); await p.waitForSelector('.rp-doc .rp-step');
  // print: the viewer's Print report button (the whole report alone), then Ctrl+P on the tab (the report without the app)
  await p.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await p.click('[data-rpact="print"]'); await p.waitForFunction(() => window.__printed > 0); await p.emulateMedia({ media: 'print' });
  const pr = await p.evaluate(() => { const vis = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0, box = document.getElementById('rp-print');
    return { box: vis(box), app: vis(document.getElementById('app')), steps: box.querySelectorAll('.rp-step').length, hidden: [...box.querySelectorAll('.rp-step')].filter(x => !vis(x)).length, kErr: box.querySelectorAll('.katex-error').length }; });
  check(pr.box && !pr.app && pr.steps === r.steps && !pr.hidden && !pr.kErr, 'Print report: the report alone ' + JSON.stringify(pr));
  { const pf = await p.evaluate(() => { const box = document.getElementById('rp-print'), figs = [...box.querySelectorAll('.rp-fig')];
      return { n: figs.length, shown: figs.filter(f => [...f.querySelectorAll('svg')].some(s => s.getBoundingClientRect().width > 100)).length, doc: document.querySelectorAll('#rptHost .rp-doc .rp-fig').length }; });
    check(pf.n === pf.doc && pf.shown === pf.n && pf.n >= 20, 'Print report: every figure printed ' + JSON.stringify(pf));
    if (args.shots) { await p.evaluate(() => { const f = [...document.querySelectorAll('#rp-print .rp-fig')].find(x => /Girder on its supports/.test(x.textContent)); if (f) f.scrollIntoView({ block: 'start' }); }); await p.waitForTimeout(200); await p.screenshot({ path: path.join(args.shots, 'ps-bridge-1400-report-print.png') }); } }
  await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  check(!(await p.evaluate(() => document.body.classList.contains('rp-printing'))), 'after print');
  await p.emulateMedia({ media: 'print' });
  const cp = await p.evaluate(() => { const vis = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
    return { hdr: vis(document.getElementById('hdr')), notes: [...document.querySelectorAll('#out > .alert')].some(vis), doc: vis(document.querySelector('.rp-doc')), bar: vis(document.querySelector('#out .rp-bar')), dash: vis(document.getElementById('sbDashCol')) }; });
  check(!cp.hdr && !cp.notes && cp.doc && !cp.bar && !cp.dash, 'Ctrl+P on the Report tab: the report only ' + JSON.stringify(cp));
  await p.emulateMedia({ media: 'screen' });
  await p.click('#tabBar [data-otab="hand"]'); await p.waitForTimeout(200);
  check(await p.evaluate(() => document.querySelector('#hnElFig [data-vkseg="haul"]').getAttribute('aria-pressed') === 'true' && /hauling/.test(document.querySelector('#hnElFig svg').getAttribute('aria-label'))), 'the Handling tab keeps its stage (Hauling) after the Report'); }
// 2026-11-13: the owner's material limits in the check summary ("Materials (owner limits)", counted in the totals; opens the Owner rules
// table at its row, where the engine's value, limit and ratio are shown) and the Report's §1 the same; CTDOT f′ci 6.8 > 6.5 ksi FAILs, 1.046
{ check(!(await p.$('#sbDashCol [data-sdgrp="mat"]')), 'AASHTO: no Materials chip');
  await p.click('#inTabs [data-itab="own"]'); await p.selectOption('#i_base\\.owner', 'CTDOT'); await p.waitForTimeout(300); while (await p.isVisible('#notices .nClose')) await p.click('#notices .nClose');
  const d = await p.evaluate(() => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, R = window.PSBHoldDown.compute(window.PSBDesign.inputs(P));
    const N = new Set(window.PSBDashUI.GROUPS.flatMap(g => g.checks.map(q => q[0]))), c = R.checks.find(q => q.n === 'Release strength f′ci (CTDOT 5.9.1.2)');
    // PR 3a-2: the column counts one per girder type per check (its worst line, SB-5)
    const A = window.PSBBridge.results(P, i => window.PSBHoldDown.compute(JSON.parse(JSON.stringify(i)))), cs = A.types.flatMap(t => Object.values(t.gov).map(v => v.c).filter(q => N.has(q.n)));
    const f = (v, d) => typeof v === 'number' && isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
    const ev = [...document.querySelectorAll('#inPanes [data-pane="own"] [data-ev]')], bad = ev.filter(el => { let v = el.dataset.ev.split('.').reduce((o, k) => o == null ? o : o[k], R); return el.textContent !== f(v, +el.dataset.d); }).map(el => el.dataset.ev);
    const chip = document.querySelector('#sbDashCol [data-sdgrp="mat"]'), F = document.querySelector('#sbDashHead .sdF'), Pp = document.querySelector('#sbDashHead .sdP');
    return { c, all: cs.length, rAll: R.checks.length, rF: R.checks.filter(q => !q.pass).length, n: cs.length, nF: cs.filter(q => !q.pass).length, chip: chip && chip.className, val: chip && chip.querySelector('.sdVal').textContent, st: chip && chip.querySelector('.sdSt').textContent,
      F: F ? parseInt(F.textContent, 10) : 0, Pn: Pp ? parseInt(Pp.textContent, 10) : 0, ev: ev.length, bad, row: (document.getElementById('own-rule-fci.range') || {}).textContent || '' }; });
  check(d.c && d.c.v === 6.8 && d.c.lim === 6.5 && !d.c.pass && /sd-fail/.test(d.chip) && d.val === '1.046' && d.st === 'FAIL', 'Materials chip: CTDOT f′ci FAIL 1.046 ' + JSON.stringify({ chip: d.chip, val: d.val, st: d.st }));
  check(d.n === d.all && d.F === d.nF && d.F + d.Pn === d.n, `column totals count the material checks: ${d.F} FAIL + ${d.Pn} PASS of ${d.n} (${d.all} engine checks)`);
  check(d.ev >= 10 && !d.bad.length && /6\.80/.test(d.row) && /6\.50/.test(d.row) && /1\.046/.test(d.row) && /FAIL/.test(d.row), 'Owner rules table: the engine values (data-ev = computeAll) ' + JSON.stringify({ ev: d.ev, bad: d.bad, row: d.row.slice(0, 200) }));
  await p.click('#inTabs [data-itab="proj"]'); await p.click('#sbDashCol [data-sdgrp="mat"] .sdMain'); await p.waitForTimeout(200);
  const g = await p.evaluate(() => { const el = document.getElementById('own-rule-fci.range'), b = el && el.getBoundingClientRect(), pn = document.getElementById('inputPanel').getBoundingClientRect();
    return { vis: !document.querySelector('#inPanes [data-pane="own"]').hidden, row: !!el, inView: !!b && b.top >= pn.top - 2 && b.bottom <= pn.bottom + 2, flash: !!el && el.classList.contains('sdFlash') }; });
  check(g.vis && g.row && g.inView && g.flash, 'Materials chip opens the Owner rules tab at the f′ci row ' + JSON.stringify(g));
  await p.click('#sbDashCol [data-sdgrp="mat"] .sdX'); check(/Girder f′c \(CTDOT 5\.9\.1\.2\)[^:]*: 0\.850/.test(await p.textContent('#sbDashCol')) && /Release strength f′ci \(CTDOT 5\.9\.1\.2\)[^:]*: 1\.046/.test(await p.textContent('#sbDashCol')), 'Materials chip lists both CTDOT checks');
  if (args.shots) await p.screenshot({ path: path.join(args.shots, 'ps-bridge-1400-materials-chip.png') });
  await p.click('#tabBar [data-otab="rpt"]'); await p.waitForSelector('.rp-doc .rp-step', { timeout: 60000 });
  const r = await p.evaluate(() => { const s1 = document.querySelector('.rp-doc section[data-rpsec="rp-s1"]'), rows = [...([...s1.querySelectorAll('table')].find(t => (t.querySelector('th') || {}).textContent === 'Group') || s1).querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim()));
    return { lead: s1.textContent, nF: rows.filter(r => r[7] === 'FAIL').length, mat: rows.filter(r => r[0] === 'Owner limits').map(r => r[1] + ' ' + r[6] + ' ' + r[7]) }; });
  check(r.nF === d.rF && new RegExp(`FAIL: ${d.rF} of ${d.rAll} checks`).test(r.lead) && r.mat.some(t => /f′ci \(CTDOT 5\.9\.1\.2\) 1\.046 FAIL/.test(t)) && r.mat.length === 2 && !/Not in the check summary column/.test(r.lead), 'Report §1 = the column ' + JSON.stringify(r.mat) + ' ' + r.nF);
  await p.click('#inTabs [data-itab="own"]'); await p.selectOption('#i_base\\.owner', 'AASHTO'); await p.waitForTimeout(300); while (await p.isVisible('#notices .nClose')) await p.click('#notices .nClose'); }
// an input error blocks every result tab
await p.click('#inTabs [data-itab="mat"]'); await p.fill('#i_base\\.mat\\.fci', '-1'); await p.press('#i_base\\.mat\\.fci', 'Tab');
for (const t of ['sec', 'lds', 'an', 'loss', 'str', 'flex', 'shear', 'end', 'camb', 'hand', 'deck', 'rt', 'rpt']) { await p.click(`#tabBar [data-otab="${t}"]`); check(/Results not shown/.test(await p.textContent('#out')) && !(await p.$('#out [data-ev]')) && !(await p.$('#out .rp-doc')), 'blocked ' + t); }
await p.fill('#i_base\\.mat\\.fci', '6.8'); await p.press('#i_base\\.mat\\.fci', 'Tab');
check(!o.errs.length, 'console errors (result tabs): ' + o.errs.join(' | '));
await o.b.close();
// 3l. 2026-11-13: the RIDOT girder age at continuity (RIDOT 5.6.3.3, continuity on) in the "Owner limits" chip: t_d = 60 < 90 days FAILs (1.500),
// counted in the totals, opens the Owner rules tab at its row (engine values), the Report's §1 row in group Owner limits, no "not in the column" note
o = await openPage(FILE, { vw: 1400, vh: 1000 }); p = o.p; await ready(p);
await p.evaluate(() => { const P = window.PSBModel.defaultProject(); P.base.owner = 'RIDOT'; P.spans = { lengths: [110, 110], continuity: 'composite' }; P.xs.skews = [0, 0, 0]; P.base.mat.td = 60;
  localStorage.setItem('psb2.project.current', window.PSBModel.exportJSON(P)); });
await p.reload(); await ready(p);
{ const N = 'Girder age at continuity (RIDOT 5.6.3.3)';
  const d = await p.evaluate(N => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, R = window.PSBHoldDown.compute(window.PSBDesign.inputs(P)), c = R.checks.find(q => q.n === N);
    const chip = document.querySelector('#sbDashCol [data-sdgrp="mat"]'), F = document.querySelector('#sbDashHead .sdF'), Pp = document.querySelector('#sbDashHead .sdP');
    return { c, all: R.checks.length, nF: R.checks.filter(q => !q.pass).length, name: chip && chip.querySelector('.sdName').textContent, cls: chip && chip.className, val: chip && chip.querySelector('.sdVal').textContent,
      F: F ? parseInt(F.textContent, 10) : 0, Pn: Pp ? parseInt(Pp.textContent, 10) : 0 }; }, N);
  check(d.c && d.c.v === 60 && d.c.lim === 90 && !d.c.pass && d.name === 'Owner limits' && /sd-fail/.test(d.cls) && d.val === '1.500', 'Owner limits chip: RIDOT girder age 60 < 90 days FAIL 1.500 ' + JSON.stringify({ name: d.name, val: d.val }));
  check(d.F === d.nF && d.F + d.Pn === d.all, `column totals count the age check: ${d.F} FAIL + ${d.Pn} PASS of ${d.all}`);
  await p.click('#sbDashCol [data-sdgrp="mat"] .sdX'); check((await p.textContent('#sbDashCol')).includes(N + ': 1.500'), 'Owner limits chip lists the age check');
  await p.click('#sbDashCol [data-sdgrp="mat"] .sdList a[data-sdown="own|own-rule-cont.age"]'); await p.waitForTimeout(200);
  const g = await p.evaluate(() => { const el = document.getElementById('own-rule-cont.age'), b = el && el.getBoundingClientRect(), pn = document.getElementById('inputPanel').getBoundingClientRect();
    const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, RR = window.PSBHoldDown.compute(window.PSBDesign.inputs(P)), fx = window.PSBOutKit.fx;
    const ev = el ? [...el.querySelectorAll('[data-ev]')] : [], bad = ev.filter(e => e.textContent !== fx(e.dataset.ev.split('.').reduce((o, k) => o == null ? o : o[k], RR), +e.dataset.d)).map(e => e.dataset.ev);
    return { vis: !document.querySelector('#inPanes [data-pane="own"]').hidden, row: el ? el.textContent : '', ev: ev.length, bad, inView: !!b && b.top >= pn.top - 2 && b.bottom <= pn.bottom + 2 }; });
  check(g.vis && g.inView && g.ev === 5 && !g.bad.length && /= 60 days; governing minimum 90 days; ratio = 90 \/ 60 = 1\.500 FAIL/.test(g.row), 'the age check opens the Owner rules tab at its row ' + JSON.stringify(g));
  await p.click('#tabBar [data-otab="rpt"]'); await p.waitForSelector('.rp-doc .rp-step', { timeout: 60000 });
  const r = await p.evaluate(N => { const s1 = document.querySelector('.rp-doc section[data-rpsec="rp-s1"]'), rows = [...([...s1.querySelectorAll('table')].find(t => (t.querySelector('th') || {}).textContent === 'Group') || s1).querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim()));
    const row = rows.find(q => q[1] === N); return { row, nF: rows.filter(q => q[7] === 'FAIL').length, note: /Not in the check summary column/.test(s1.textContent) }; }, N);
  check(r.row && r.row[0] === 'Owner limits' && r.row[6] === '1.500' && r.row[7] === 'FAIL' && /see/.test(r.row[8]) && r.nF === d.F && !r.note, 'Report §1: the age check in Owner limits, no "not in the column" note ' + JSON.stringify(r));
  if (args.shots) { await p.click('#inTabs [data-itab="own"]'); await p.waitForTimeout(150); await p.evaluate(() => document.getElementById('own-rule-cont.age').scrollIntoView({ block: 'center' })); await p.screenshot({ path: path.join(args.shots, 'ps-bridge-1400-owner-limits-age.png') }); }
  check(!o.errs.length, 'console errors (RIDOT continuity age): ' + o.errs.join(' | ')); }
await o.b.close();
// 3m. PR 2f: "From the old app" (engine/legacy.js, ui/legacy.js): the old app's saved designs listed and imported, read only
{ // old data as the old app keeps it: the design on screen (an AASHTO Type IV exterior girder, 85 ft, 4 girders at 8.5 ft, skew 10°) with its
  // bridge model (one more stored design), a shared Bridge Suite project and the older project list
  const OLD = JSON.parse(JSON.stringify(await (async () => { const q = await openPage(FILE, { vw: 1400, vh: 1000 }); await ready(q.p);
    const d = await q.p.evaluate(() => { const i = JSON.parse(JSON.stringify(mergeInputs(null))); i.girder = 'AASHTO Type IV'; i.L = 85; i.S = 8.5; i.nGirders = 4; i.loads.pos = 'exterior'; i.loads.skew = 10;
      i.proj = { name: 'Old bridge A', girderId: 'G1 (Exterior)', by: 'ABC', date: '2026-10-01', job: '1234' }; i.harp.yEnd = 44; return i; }); await q.b.close(); return d; })()));
  const br = { v: 1, mode: 'pl', title: {}, spans: [85], nGirders: 4, S: 8.5, sel: { g: 1, s: 1 }, designs: { 'G1/S1': OLD, 'G2/S1': Object.assign({}, OLD, { loads: Object.assign({}, OLD.loads, { pos: 'interior' }) }) }, projId: null };
  const shared = Object.assign({}, OLD, { L: 95, proj: Object.assign({}, OLD.proj, { name: 'Shared C' }) });
  const OLDLS = { 'psbeam.inputs.v1': JSON.stringify(OLD), 'psbeam.bridge.v1': JSON.stringify(br), 'psbeam.ui.v1': '{"tab":"losses"}',
    'bridgeSuite.v1.projects': JSON.stringify({ bp_9: { name: 'Shared C', savedAt: '2026-11-02T12:00:00Z', slices: { psbeam: shared, mct: { x: 1 } } } }),
    'psbeam.projects.v1': JSON.stringify({ q1: { name: 'Older D', savedAt: '2026-09-01T00:00:00Z', inp: Object.assign({}, OLD, { L: 70 }) } }) };
  o = await openPage(FILE, { vw: 1400, vh: 1000, ls: OLDLS }); p = o.p; await ready(p);
  await p.click('#inTabs [data-itab="proj"]');
  check(await p.isVisible('#lgCard') && !(await p.$('#lgSum')), 'Project tab: the "From the old app" card, no import record yet');
  await p.click('[data-lg="scan"]');
  const rows = await p.$$eval('#lgList tbody tr', t => t.map(r => r.textContent));
  check(rows.length === 3 && /Design on screen/.test(rows[0]) && /bridge model 1 span × 4 girders, 2 designs stored/.test(rows[0]) && /Shared Bridge Suite project/.test(rows[1]) && /with mct/.test(rows[1]) && /Older project list/.test(rows[2]), 'the old designs listed: ' + rows.map(r => r.slice(0, 60)).join(' | '));
  check(await p.$eval('[data-lg="imp"]', b => b.disabled), 'Import disabled until a design is chosen');
  await p.check('input[name="lgPick"][value="autosave"]'); await p.click('[data-lg="imp"]'); await p.waitForSelector('#lgSum', { timeout: 60000 });
  check(o.dialogs.some(d => /Import "Old bridge A" from the old app\? It replaces the open project/.test(d)), 'asked first: ' + o.dialogs.join(' | '));
  const sm = await p.textContent('#lgSum'), P2 = await p.evaluate(() => JSON.parse(localStorage.getItem('psb2.project.current')));
  check(/Results: the same as the old app/.test(sm) && /psbeam\.inputs\.v1 \+ psbeam\.bridge\.v1/.test(sm) && /1 other girder × span design \(G2\/S1\) kept in the project and restored as girder types on their lines/.test(sm) && /Not imported/.test(sm), 'import summary: ' + sm.slice(0, 300));
  check(P2.project.name === 'Old bridge A' && P2.project.number === '1234' && P2.spans.lengths.join() === '85' && P2.xs.nb === 4 && P2.xs.bays.join() === '8.5,8.5,8.5' && P2.xs.skews.join() === '10,10' && P2.design.g === 1 && P2.base.girder === 'AASHTO Type IV' && P2.legacy && P2.legacy.bridge.designs['G2/S1'], 'imported project saved ' + JSON.stringify({ n: P2.project.name, s: P2.spans, xs: P2.xs, d: P2.design }));
  // PR 3a-4 (PS-17): the old model's other design G2/S1 restored as a girder type on its line, computed the same as the old app
  check(/Restored from the old app's bridge model \(PS-17\): 1 more girder × span design \(G2\/S1\)/.test(sm) && /1 of 1 compute the same as the old app/.test(sm)
    && Array.isArray(P2.types) && P2.types.some(t => t.label === 'Interior S1 (old G2)' && t.lines.join() === '2') && P2.legacy.restored && P2.legacy.restored.cells[0].same === true, 'restored: ' + JSON.stringify(P2.types));
  check(/Restored from the old app's bridge model/.test(await p.textContent('#notices')) && await p.evaluate(() => { const n = document.querySelector('#notices .notice'); return !!n && n.getBoundingClientRect().top >= document.getElementById('tabBar').getBoundingClientRect().bottom - 0.5; }), 'the restore notice shown (inline, below the tab bar, PS-22)');
  while (await p.isVisible('#notices .nClose')) await p.click('#notices .nClose');
  // the imported design's results: the old inputs computed = the shown values (computeAll of the page on the old inputs)
  await p.click('#tabBar [data-otab="flex"]'); await p.waitForTimeout(400);
  const fv = await p.evaluate(OLD => { const R = computeAll(JSON.parse(JSON.stringify(OLD))), fx = window.PSBOutKit.fx, at = (o, q) => q.split('.').reduce((a, k) => a == null ? a : a[k], o);
    const ev = [...document.querySelectorAll('#out [data-ev]')].filter(e => !/^ps10\./.test(e.dataset.ev)); return { n: ev.length, bad: ev.filter(e => e.textContent !== fx(e.dataset.div ? at(R, e.dataset.ev) / +e.dataset.div : at(R, e.dataset.ev), +e.dataset.d)).map(e => e.dataset.ev).slice(0, 5) }; }, OLD);
  check(fv.n > 20 && !fv.bad.length, 'Flexure tab of the imported design = the old inputs computed ' + JSON.stringify(fv));
  if (args.shots) { await p.click('#inTabs [data-itab="proj"]'); await p.evaluate(() => document.getElementById('lgCard').scrollIntoView({ block: 'start' })); await p.screenshot({ path: path.join(args.shots, 'ps-bridge-2f-import-1400.png') }); }
  // an old Export JSON file through Import JSON; a MIDAS demands file refused
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'psb2f-')), f1 = path.join(dir, 'Old_bridge_E.json'), f2 = path.join(dir, 'midas.json');
  fs.writeFileSync(f1, JSON.stringify(Object.assign({}, OLD, { L: 77, proj: Object.assign({}, OLD.proj, { name: 'Old bridge E' }) }), null, 1));
  fs.writeFileSync(f2, JSON.stringify({ _schema: 'psbeam-external-demands', stations: [{ x: 0 }] }));
  await p.setInputFiles('#fImport', f1); await p.waitForFunction(() => /Old_bridge_E\.json/.test((document.getElementById('lgSum') || {}).textContent || ''), null, { timeout: 60000 });
  check(/Results: the same as the old app/.test(await p.textContent('#lgSum')) && (await p.evaluate(() => JSON.parse(localStorage.getItem('psb2.project.current')).spans.lengths.join())) === '77', 'old Export JSON imported by Import JSON');
  await p.setInputFiles('#fImport', f2); await p.waitForTimeout(300);
  check(o.dialogs.some(d => /MIDAS demands file of the old app, not a design/.test(d)) && (await p.evaluate(() => JSON.parse(localStorage.getItem('psb2.project.current')).spans.lengths.join())) === '77', 'MIDAS demands file refused, project unchanged');
  fs.rmSync(dir, { recursive: true, force: true });
  ls = await lsSnap(p);
  Object.entries(OLDLS).forEach(([k, v]) => check(ls[k] === v, 'old key untouched after import: ' + k));
  check(Object.keys(ls).every(k => k.startsWith('psb2.') || k in OLDLS || k === '__seeded'), 'keys written: psb2.* only ' + Object.keys(ls).join(', '));
  check(!o.errs.length, 'console errors (From the old app): ' + o.errs.join(' | '));
  await o.b.close();
  // 390 px: the list and the summary without sideways scroll
  o = await openPage(FILE, { vw: 390, vh: 844, ls: OLDLS }); p = o.p; await ready(p);
  await p.click('#inTabs [data-itab="proj"]'); await p.click('[data-lg="scan"]');
  check(await p.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth) <= 0, 'phone: the old designs list without sideways scroll');
  await p.check('input[name="lgPick"][value="reg:bp_9"]'); await p.click('[data-lg="imp"]'); await p.waitForSelector('#lgSum', { timeout: 60000 });
  check(await p.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth) <= 0 && /Shared C/.test(await p.inputValue('#i_project\\.name')), 'phone: the shared project imported, summary without sideways scroll');
  if (args.shots) { await p.evaluate(() => document.getElementById('lgSum').scrollIntoView({ block: 'start' })); await p.screenshot({ path: path.join(args.shots, 'ps-bridge-2f-import-390.png') }); }
  ls = await lsSnap(p); Object.entries(OLDLS).forEach(([k, v]) => check(ls[k] === v, 'phone: old key untouched ' + k));
  check(!o.errs.length, 'console errors (390 px, From the old app): ' + o.errs.join(' | '));
  await o.b.close(); }
// 4. unreadable saved project
o = await openPage(FILE, { vw: 1400, vh: 1000, ls: { 'psb2.project.current': '{broken' } }); p = o.p; await ready(p);
ls = await lsSnap(p);
check(Object.keys(ls).some(k => k.startsWith('psb2.project.unreadable.') && ls[k] === '{broken') && ls['psb2.project.current'] === '{broken', 'backup kept, original untouched');
check(/could not be read/.test(await p.textContent('#out')), 'note shown');
check(!o.errs.length, 'console errors (unreadable): ' + o.errs.join(' | '));
await o.b.close();
// 5. phone
o = await openPage(FILE, { vw: 390, vh: 844 }); p = o.p; await ready(p);
const ph = await p.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(), cs = id => getComputedStyle(document.getElementById(id)).display;
  return { dash: cs('sbDashCol'), split: cs('sbSplit'), i: r('inputPanel'), o: r('outputPanel'), x: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth }; });
check(ph.dash === 'none' && ph.split === 'none' && ph.i.width <= 390 && ph.o.top >= ph.i.bottom - 1 && ph.x <= 0, 'phone layout ' + JSON.stringify(ph));
for (const t of ['layout', 'xsec', 'gird', 'mat', 'dd', 'loads', 'own']) { await p.click(`#inTabs [data-itab="${t}"]`); check(await p.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth) <= 0, 'no sideways scroll on ' + t); }
await p.click('#inTabs [data-itab="loads"]'); await p.selectOption('#i_base\\.handling\\.on', 'true'); await p.click('#inTabs [data-itab="dd"]'); await p.selectOption('#i_base\\.deck\\.on', 'true');
for (const t of ['sec', 'lds', 'an', 'loss', 'str', 'flex', 'shear', 'end', 'camb', 'hand', 'deck', 'rt']) { await p.click(`#tabBar [data-otab="${t}"]`); await p.waitForTimeout(300); check(await p.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth) <= 0 && (await p.$$('#out svg')).length >= 1, 'phone: no sideways scroll, graphic on ' + t); }
await p.click('#tabBar [data-otab="rpt"]'); await p.waitForSelector('.rp-doc .rp-step', { timeout: 60000 }); await p.waitForTimeout(300);
check(await p.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth) <= 0 && (await p.$$('.rp-doc .rp-h1')).length === 26, 'phone: the Report without sideways scroll');
{ const ph = await p.evaluate(() => { const figs = [...document.querySelectorAll('.rp-doc .rp-fig')], vis = el => !!el && getComputedStyle(el).display !== 'none';
    return { n: figs.length, scr: figs.filter(f => vis(f.querySelector('.rp-fig-scr')) && !vis(f.querySelector('.rp-fig-prn'))).length, wide: figs.filter(f => f.getBoundingClientRect().right > innerWidth + 1).length,
      vb: [...document.querySelectorAll('.rp-doc .rp-fig-scr svg')].map(s => s.viewBox.baseVal && s.viewBox.baseVal.width).filter(w => w > 0) }; });
  check(ph.n >= 12 && ph.scr === ph.n && !ph.wide && ph.vb.length && Math.max(...ph.vb) < 700, 'phone: the Report figures drawn at the screen width (the 700 px ones for print) ' + JSON.stringify({ ...ph, vb: ph.vb.slice(0, 4) }));
  if (args.shots) { await p.evaluate(() => { const f = [...document.querySelectorAll('.rp-doc .rp-fig')].find(x => /Strand pattern|Composite section/.test(x.textContent)); if (f) f.scrollIntoView({ block: 'start' }); }); await p.waitForTimeout(200); await p.screenshot({ path: path.join(args.shots, 'ps-bridge-390-report-figure.png') }); }
  await p.emulateMedia({ media: 'print' });
  check(await p.evaluate(() => [...document.querySelectorAll('.rp-doc .rp-fig')].every(f => getComputedStyle(f.querySelector('.rp-fig-prn')).display !== 'none' && getComputedStyle(f.querySelector('.rp-fig-scr')).display === 'none')), 'phone: print uses the 700 px figures');
  await p.emulateMedia({ media: 'screen' }); }
if (args.shots) await p.screenshot({ path: path.join(args.shots, 'ps-bridge-390-report.png') });
await p.click('#inTabs [data-itab="gird"]'); await p.waitForTimeout(300); check(await p.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth) <= 0 && (await p.$$('#gfx_strands_in svg')).length >= 3, 'phone: strand pattern without sideways scroll');
await p.click('#inTabs [data-itab="proj"]');
if (args.shots) { await p.click('#tabBar [data-otab="str"]'); await p.waitForTimeout(300); await p.screenshot({ path: path.join(args.shots, 'ps-bridge-390-str.png'), fullPage: true }); }
if (args.shots) await p.screenshot({ path: path.join(args.shots, 'ps-bridge-390.png'), fullPage: true });
check(!o.errs.length, 'console errors (390 px): ' + o.errs.join(' | '));
await o.b.close();
console.log(`${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
