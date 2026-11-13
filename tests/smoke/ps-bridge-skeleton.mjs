#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), PR 1 skeleton (docs/ps-bridge-plan.md §5). Headless Chromium, file://, CDN libraries from tests/libs.
//   1. 1400 x 1000: 0 console errors; the 9 input tabs and 17 output tabs of the plan; the check summary column, the input panel, the
//      splitter and the output panel side by side; every tab opens (placeholders) without an error;
//   2. an input change (span lengths "100, 125, 100", made continuous) is autosaved to psb2.project.current (5 girders, 4 support skews);
//      a reload shows it; localStorage holds psb2.* keys only, and a seeded psbeam.* / sbd2.* key is byte-identical;
//   3. an invalid input (a negative bay) marks its field, counts on its input tab, lists it on the output panel and in the check summary,
//      and its link opens the field; fixing it clears them; PR 2b: a girder-design (base) input saved, a blank f'c marked / counted /
//      blocking, an owner change setting its defaults, a strand row added / outside the girder / deleted, psbeam.* keys untouched;
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
//   5. 390 x 844 (phone): stacked panels, no splitter, no check summary column, no horizontal page scroll; 0 console errors.
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
// 3. invalid input (model): a negative bay; the PR 2b limit (unequal bays) is listed with it
await p.click('#inTabs [data-itab="xsec"]');
await p.fill('#i_xs\\.bays', '9, -2, 9, 9'); await p.press('#i_xs\\.bays', 'Tab');
check(await p.$eval('#i_xs\\.bays', e => e.classList.contains('bad')), 'bad field marked');
check((await p.textContent('#inTabs [data-itab="xsec"] .inDot')) === '2', 'tab count ' + await p.textContent('#inTabs [data-itab="xsec"] .inDot'));
check(/Bay 2 spacing must be a positive number/.test(await p.textContent('#out')) && /Unequal bays/.test(await p.textContent('#out')) && /2 to fix/.test(await p.textContent('#sbDashCol')), 'errors listed');
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
check(sv.base.owner === 'RIDOT' && sv.base.mat.H === 80 && /mat\.H 70 → 80/.test(await p.textContent('#toast')), 'owner defaults set: ' + sv.base.mat.H);
check(await p.isVisible('#i_base\\.opt\\.etaR'), 'owner question shown');
await p.click('#tClose');
await p.click('#inTabs [data-itab="gird"]'); await p.click('[data-act="add"][data-tbl="base.rows"]');
ls = await lsSnap(p); sv = JSON.parse(ls['psb2.project.current']);
check(sv.base.rows.length === 4 && sv.base.rows[3].y === 8, 'strand row added');
await p.fill('[data-path="base.rows.3.y"]', '90'); await p.press('[data-path="base.rows.3.y"]', 'Tab');
check(await p.$eval('[data-path="base.rows.3.y"]', e => e.classList.contains('bad')) && /not inside the girder/.test(await p.textContent('#inPanes')), 'row outside the girder marked');
await p.click('[data-act="del"][data-tbl="base.rows"][data-i="3"]');
check(!/to fix/.test(await p.textContent('#sbDashCol')), 'row deleted, no errors');
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
  const s0 = localStorage.getItem('psb2.project.current'), P = s0 ? window.PSBModel.importJSON(s0).project : window.PSBModel.defaultProject(), R = computeAll(window.PSBDesign.inputs(P));
  const f = (v, d) => typeof v === 'number' && isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/^-(0(\.0*)?)$/, '$1') : '—';
  const bad = [], els = [...document.querySelectorAll('#out [data-ev]')];
  els.forEach(el => { let v = el.dataset.ev.split('.').reduce((o, k) => o == null ? o : o[k], R); if (el.dataset.div) v = v / +el.dataset.div;
    if (typeof v !== 'number' || el.textContent !== f(v, +el.dataset.d)) bad.push(`${el.dataset.ev}: ${el.textContent} vs ${v}`); });
  return { n: els.length, bad, svg: document.querySelectorAll('#out svg').length, katex: document.querySelectorAll('#out .katex').length };
});
const DESIGNS = [['default', null], ['continuous, exterior G1 in span 2, restraint', async () => {
    await p.click('#inTabs [data-itab="layout"]'); await p.fill('#i_spans\\.lengths', '100, 125, 100'); await p.press('#i_spans\\.lengths', 'Tab');
    await p.selectOption('#i_spans\\.continuity', 'composite'); await p.selectOption('#i_base\\.cont\\.restraint', 'true');
    await p.click('#inTabs [data-itab="gird"]'); await p.selectOption('#i_design\\.s', '2'); await p.selectOption('#i_design\\.g', '1'); }],
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
  const dash = await p.evaluate(() => { const s0 = localStorage.getItem('psb2.project.current'), P = s0 ? window.PSBModel.importJSON(s0).project : window.PSBModel.defaultProject(), R = computeAll(window.PSBDesign.inputs(P));
    const grp = window.PSBDashUI.GROUPS.filter(g => g.checks), bad = [];
    grp.forEach(g => { const cs = g.checks.map(q => R.checks.find(c => c.n === q[0])).filter(Boolean); if (!cs.length) return; const gov = cs.reduce((b, c) => c.r > b.r ? c : b);
      const el = document.querySelector(`#sbDashCol [data-sdgrp="${g.id}"] .sdVal`); if (!el || el.textContent !== gov.r.toFixed(3)) bad.push(`${g.id}: ${el && el.textContent} vs ${gov.r}`); });
    return { n: grp.length, bad }; });
  check(!dash.bad.length, `${lab}: check summary chips ${dash.bad.join(' | ')}`);
  // PR 2d-2: the Rating chip = the lowest HL-93 inventory RF of the engine
  const rc = await p.evaluate(() => { const s0 = localStorage.getItem('psb2.project.current'), P = s0 ? window.PSBModel.importJSON(s0).project : window.PSBModel.defaultProject(), R = computeAll(window.PSBDesign.inputs(P));
    const v = window.PSBDashUI.RATING.rf.map(q => q[1](R)).filter(x => x < 99), el = document.querySelector('#sbDashCol [data-sdgrp="rt"] .sdVal'); return { want: Math.min(...v).toFixed(3), got: el && el.textContent }; });
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
// an input error blocks every result tab
await p.click('#inTabs [data-itab="mat"]'); await p.fill('#i_base\\.mat\\.fci', '-1'); await p.press('#i_base\\.mat\\.fci', 'Tab');
for (const t of ['sec', 'lds', 'an', 'loss', 'str', 'flex', 'shear', 'end', 'camb', 'hand', 'deck', 'rt']) { await p.click(`#tabBar [data-otab="${t}"]`); check(/Results not shown/.test(await p.textContent('#out')) && !(await p.$('#out [data-ev]')), 'blocked ' + t); }
await p.fill('#i_base\\.mat\\.fci', '6.8'); await p.press('#i_base\\.mat\\.fci', 'Tab');
check(!o.errs.length, 'console errors (result tabs): ' + o.errs.join(' | '));
await o.b.close();
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
await p.click('#inTabs [data-itab="gird"]'); await p.waitForTimeout(300); check(await p.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth) <= 0 && (await p.$$('#gfx_strands_in svg')).length >= 3, 'phone: strand pattern without sideways scroll');
await p.click('#inTabs [data-itab="proj"]');
if (args.shots) { await p.click('#tabBar [data-otab="str"]'); await p.waitForTimeout(300); await p.screenshot({ path: path.join(args.shots, 'ps-bridge-390-str.png'), fullPage: true }); }
if (args.shots) await p.screenshot({ path: path.join(args.shots, 'ps-bridge-390.png'), fullPage: true });
check(!o.errs.length, 'console errors (390 px): ' + o.errs.join(' | '));
await o.b.close();
console.log(`${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
