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
check(/not run/.test(await p.textContent('#sbDashCol')), 'check summary: not run');
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
ls = await lsSnap(p);
check(Object.keys(ls).every(k => k.startsWith('psb2.') || k in SEED || k === '__seeded'), 'keys after edits: ' + Object.keys(ls).join(', '));
Object.entries(SEED).forEach(([k, v]) => check(ls[k] === v, 'untouched after edits ' + k));
check(!o.errs.length, 'console errors (1400 px): ' + o.errs.join(' | '));
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
await p.click('#inTabs [data-itab="proj"]');
if (args.shots) await p.screenshot({ path: path.join(args.shots, 'ps-bridge-390.png'), fullPage: true });
check(!o.errs.length, 'console errors (390 px): ' + o.errs.join(' | '));
await o.b.close();
console.log(`${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
