#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), PR 3a: the bridge level — girder types on the girder lines of each span (engine/bridge.js,
// ui/types.js; docs/ps-bridge-plan.md §5 PR 3a; PS-8). Headless Chromium, file://, CDN libraries from tests/libs.
//   1. a new project (nothing stored): the Girder types card (Interior S1 on G2–G4, Exterior S1 on G1, G5); the type and line choice above
//      the output tabs; Exterior S1 on G5 chosen: every value shown (data-ev) = computeAll of that cell's inputs on the page;
//   2. "Entered values for: Exterior S1 only" (Materials tab): f′c 9.0 ksi is that type's own value (stored in types[1].ovr, the base
//      unchanged), marked "● Exterior S1" with reset; the Interior cell unchanged; reset returns it to the base;
//   3. the girder count 5 → 6: the lines re-assigned (G5 Exterior → Interior, G6 Exterior) with a notice; Undo puts N_b and the types back;
//   4. a project saved before PR 3a (no types; design G6 in span 2 of three spans): opens as type T1 on G6/S2, the values shown = the PR 2b
//      design's computeAll; the stored text is not rewritten by opening it; lines with no type listed;
//   8. PS-23: the d_e notice on the Loads & LLDF tab (entered 2.0 vs computed 1.5 / 2.5 ft), the Report assumptions, the dismissal kept
//      in the project (P.notices.de), shown again for a different difference, none where they match;
//   9. PR 3b: the Summary tab on five projects (single type, new, three types, three spans continuous, a line not checked): values and
//      weights = the engine's, counts = the check summary column's, the grid, a grid link opens its tab / type / line / step; Stop, Run all;
//  10. PS-25: the Report per girder type (governing line) and every girder line, the choice in psb2.ui, print, one-girder report;
//   5. 390 px: the Girders & strands tab and a result tab with the type / line bar and (PR 3b) the Summary tab without sideways scroll; 0 console errors; psb2.* keys only.
//   node tests/smoke/ps-bridge-types.mjs [--file <index.html>] [--shots <dir>]
import fs from 'fs';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const FILE = path.resolve(args.file || path.join(REPO, 'apps/ps-bridge/index.html'));
if (args.shots) fs.mkdirSync(args.shots, { recursive: true });
/* 2026-11-14: the span, skew and bay lists are tables of rows (ui/lists.js); the page's hidden input keeps the text: set it (the table follows) and commit */
const setList = (p, sel, text) => p.evaluate(([q, t]) => { const el = document.querySelector(q); el.value = t; el.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, text]);
let failures = 0, checks = 0;
const check = (ok, msg) => { checks++; if (!ok) { failures++; console.log('  FAIL ' + msg); } };
const lsSnap = p => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
const ready = async p => { await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(400); };
const stored = async p => JSON.parse((await lsSnap(p))['psb2.project.current'] || 'null');
const SEED = { 'psbeam.inputs.v1': '{"girder":"PCI BT-72","L":120}', 'sbd2.project.current': '{"schema":"sbd2.project"}' };
/* every engine value on the output panel = computeAll (+ PS-10) of PSBDesign.inputs(P) on the page (the cell shown) */
const evCheck = p => p.evaluate(() => {
  const s0 = localStorage.getItem('psb2.project.current'), P = s0 ? window.PSBModel.importJSON(s0).project : window.PSBModel.newProject(), R = window.PSBHoldDown.compute(window.PSBDesign.inputs(P));   // nothing stored yet: the new project the page opened
  const f = (v, d) => typeof v === 'number' && isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/^-(0(\.0*)?)$/, '$1') : '—';
  const bad = [], els = [...document.querySelectorAll('#out [data-ev]')];
  els.forEach(el => { let v = el.dataset.ev.split('.').reduce((o, k) => o == null ? o : o[k], R); if (el.dataset.div) v = v / +el.dataset.div;
    if (typeof v !== 'number' || el.textContent !== f(v, +el.dataset.d)) bad.push(`${el.dataset.ev}: ${el.textContent} vs ${v}`); });
  return { n: els.length, bad };
});

// 1. a new project
let o = await openPage(FILE, { vw: 1400, vh: 1000, ls: SEED }); let { p } = o;
await ready(p);
await p.click('#inTabs [data-itab="gird"]'); await p.waitForTimeout(200);
{ const t = (await p.textContent('#card-types')).replace(/\s+/g, ' ');
  check(/Span 1 \(L = 120\.00 ft\)/.test(t) && (await p.$$('#card-types [data-ty="label"]')).length === 2, 'types card: ' + t.slice(0, 160));
  const lab = await p.$$eval('#card-types [data-ty="label"]', e => e.map(x => x.value)); check(lab.join('|') === 'Interior S1|Exterior S1', 'labels ' + lab.join('|'));
  const on = await p.$$eval('#card-types [data-ty="line"]:checked', e => e.map(x => `${x.dataset.k}:${x.dataset.g}`)); check(on.join(' ') === '0:2 0:3 0:4 1:1 1:5', 'lines ' + on.join(' ')); }
await p.click('#tabBar [data-otab="flex"]'); await p.waitForTimeout(250);
check(!!(await p.$('#tyOutT')) && !!(await p.$('#tyOutL')), 'type and line choice above the output tab');
await p.selectOption('#tyOutT', { label: 'Exterior S1 (span 1)' }); await p.waitForTimeout(150); await p.selectOption('#tyOutL', '5'); await p.waitForTimeout(250);
{ const sv = await stored(p); check(sv.design.g === 5 && sv.design.s === 1, 'design shown G5/S1 ' + JSON.stringify(sv.design));
  check(/Girder type Exterior S1 on G5 \(Exterior\), span 1/.test(await p.textContent('#out')), 'note names the type and line');
  const r = await evCheck(p); check(r.n >= 20 && !r.bad.length, `Exterior on G5, Flexure: ${r.n} values, ${r.bad.slice(0, 3).join(' | ')}`);
  const pos = await p.evaluate(() => window.PSBDesign.inputs(window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project).loads.pos); check(pos === 'exterior', 'exterior position ' + pos); }
if (args.shots) await p.screenshot({ path: path.join(args.shots, 'ps3a-1400-flex-exterior.png') });
// 2. a type's own value
await p.click('#inTabs [data-itab="mat"]'); await p.selectOption('#tyScope_mat', 'T2'); await p.waitForTimeout(200);
check(await p.$eval('[data-pane="mat"] .tyScope', e => e.classList.contains('on')), 'scope bar marked');
await p.fill('#i_base\\.mat\\.fc', '9'); await p.press('#i_base\\.mat\\.fc', 'Tab'); await p.waitForTimeout(250);
{ const sv = await stored(p); check(sv.types[1].ovr['mat.fc'] === 9 && sv.base.mat.fc === 8.5 && !Object.keys(sv.types[0].ovr).length, 'f′c 9 stored for Exterior S1 only ' + JSON.stringify(sv.types[1].ovr));
  const m = await p.textContent('#inPanes [data-pane="mat"]'); check(/● Exterior S1/.test(m), 'field marked ● Exterior S1');
  const fc = await p.evaluate(() => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project; return [window.PSBDesign.cellInputs(P, 1, 1).mat.fc, window.PSBDesign.cellInputs(P, 0, 2).mat.fc]; });
  check(fc[0] === 9 && fc[1] === 8.5, 'cells: Exterior 9, Interior 8.5 ' + fc);
  const r = await evCheck(p); check(r.n >= 20 && !r.bad.length, `Exterior on G5 with its own f′c: ${r.n} values ${r.bad.slice(0, 3).join(' | ')}`); }
if (args.shots) await p.screenshot({ path: path.join(args.shots, 'ps3a-1400-mat-scope.png') });
await p.selectOption('#tyScope_mat', ''); await p.waitForTimeout(150);
check(/own value in: Exterior S1/.test(await p.textContent('#inPanes [data-pane="mat"]')), 'base scope: the field names the type with its own value');
await p.selectOption('#tyScope_mat', 'T2'); await p.waitForTimeout(150);
await p.click('#inPanes [data-ty="reset"][data-key="mat.fc"]'); await p.waitForTimeout(200);
{ const sv = await stored(p); check(!('mat.fc' in sv.types[1].ovr), 'reset to the base'); }
await p.selectOption('#tyScope_mat', ''); await p.waitForTimeout(100);
// 3. the girder count
await p.click('#inTabs [data-itab="xsec"]'); await p.fill('#i_xs\\.nb', '6'); await p.press('#i_xs\\.nb', 'Tab'); await p.waitForTimeout(250);
{ const t = await p.textContent('#notices'), sv = await stored(p);
  check(/S1 G5: Exterior S1 → Interior S1/.test(t) && /S1 G6: no type → Exterior S1/.test(t), 'notice: ' + t);
  check(JSON.stringify(sv.types.map(q => q.lines)) === '[[2,3,4,5],[1,6]]', 'lines re-assigned ' + JSON.stringify(sv.types.map(q => q.lines)));
  await p.click('#notices .nUndo'); await p.waitForTimeout(250);
  const s2 = await stored(p); check(s2.xs.nb === 5 && JSON.stringify(s2.types.map(q => q.lines)) === '[[2,3,4],[1,5]]', 'Undo: N_b 5 and the lines back'); }
let ls = await lsSnap(p);
check(Object.keys(ls).every(k => k.startsWith('psb2.') || k in SEED), 'keys: ' + Object.keys(ls).join(', '));
Object.entries(SEED).forEach(([k, v]) => check(ls[k] === v, 'untouched ' + k));
check(!o.errs.length, 'console errors (new project): ' + o.errs.join(' | '));
await o.b.close();

// 4. a project saved before PR 3a
o = await openPage(FILE, { vw: 1400, vh: 1000, ls: SEED }); p = o.p; await ready(p);
const old = await p.evaluate(() => { const P = window.PSBModel.defaultProject(); P.spans = { lengths: [100, 125, 100], continuity: 'composite' };
  P.xs = { nb: 6, bays: [8.5, 8.5, 8.5, 8.5, 8.5], ohL: 2.5, ohR: 3.25, skews: [35, 35, 35, 35] }; P.design = { g: 6, s: 2 }; P.base.cont.restraint = true;
  const t = window.PSBModel.exportJSON(P); localStorage.setItem('psb2.project.current', t); return t; });
await p.reload(); await ready(p);
await p.click('#tabBar [data-otab="shear"]'); await p.waitForTimeout(400);
{ const r = await p.evaluate(() => { const P0 = JSON.parse(localStorage.getItem('psb2.project.current')), R = window.PSBHoldDown.compute(window.PSBDesign.one(P0));
    const f = (v, d) => typeof v === 'number' && isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/^-(0(\.0*)?)$/, '$1') : '—';
    const bad = [], els = [...document.querySelectorAll('#out [data-ev]')];
    els.forEach(el => { let v = el.dataset.ev.split('.').reduce((o, k) => o == null ? o : o[k], R); if (el.dataset.div) v = v / +el.dataset.div; if (el.textContent !== f(v, +el.dataset.d)) bad.push(el.dataset.ev); });
    return { n: els.length, bad, sel: document.querySelector('#tyOutT option:checked').textContent + ' / ' + document.querySelector('#tyOutL option:checked').textContent }; });
  check(r.n >= 20 && !r.bad.length && /Exterior S2/.test(r.sel) && /G6/.test(r.sel), `saved before 3a: ${r.sel}, ${r.n} values = the PR 2b design's, ${r.bad.slice(0, 3).join(' ')}`); }
check((await lsSnap(p))['psb2.project.current'] === old, 'opening did not rewrite the stored project');
await p.click('#inTabs [data-itab="gird"]'); await p.waitForTimeout(200);
check(/Lines G1, G2, G3, G4, G5, G6 of span 1 have no girder type/.test(await p.textContent('#card-types')) && !!(await p.$('[data-ty="fill"]')), 'unassigned lines listed with "Assign every line"');
await p.click('[data-ty="fill"]'); await p.waitForTimeout(400);
{ const sv = await stored(p); check(sv.types.length === 6 && !/have no girder type/.test(await p.textContent('#card-types')), 'every line assigned: ' + sv.types.map(t => t.label + ':' + t.lines.join('')).join(' ')); }
if (args.shots) await p.screenshot({ path: path.join(args.shots, 'ps3a-1400-types-card.png') });
check(!o.errs.length, 'console errors (saved before 3a): ' + o.errs.join(' | '));
await o.b.close();

// 6. PR 3a-2: every type on every line — unequal bays 8, 10, 10, 8 ft: S per line, the check summary over every type and line (named), the
//    Summary tab's table (a row per type and per line, weights and the bridge total), a ratio opens its tab with that type and line; the
//    Report's §1 table of every type and line; different end skews below 30° allowed, 30° or more with the DF computed an input error
o = await openPage(FILE, { vw: 1400, vh: 1000 }); p = o.p; await ready(p);
await p.click('#inTabs [data-itab="xsec"]'); await setList(p, '#i_xs\\.bays', '8, 10, 10, 8'); await p.waitForTimeout(400);
check(!/to fix/.test(await p.textContent('#sbDashCol')), 'unequal bays: no input error');
{ const r = await p.evaluate(() => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, BR = window.PSBBridge;
    const A = BR.results(P, i => window.PSBHoldDown.compute(JSON.parse(JSON.stringify(i)))), fl = A.cells.flatMap(c => c.R.checks.filter(q => q.n === 'Flexure').map(q => ({ r: q.r, g: c.g, lab: c.label })));
    const gov = fl.reduce((b, z) => !b || z.r > b.r ? z : b, null), chip = document.querySelector('#sbDashCol [data-sdgrp="flex"] .sdVal').textContent;
    return { S: A.cells.map(c => c.inp.S), gov, chip, n: A.n, W: A.W }; });
  check(r.S.join(',') === '9,10,9,8,8' && r.n === 5, 'S per line ' + r.S.join(','));
  check(r.chip === r.gov.r.toFixed(3), `flexure chip = the worst of every type and line ${r.chip} vs ${r.gov.r} (${r.gov.lab} G${r.gov.g})`);
  await p.click('#sbDashCol [data-sdgrp="flex"] .sdX'); check(/Flexure — (Interior|Exterior) S1 on G\d: /.test(await p.textContent('#sbDashCol')), 'chip list names the type and line');
  await p.click('#tabBar [data-otab="sum"]'); await p.waitForTimeout(300);
  const t = (await p.textContent('#sum-table')).replace(/\s+/g, ' ');   // PR 3b: the Summary tab's type × check-group table (ui/summary.js)
  check(/Interior S1/.test(t) && /on line G3/.test(t) && /Bridge total \(5 girder lines\)/.test(t) && t.includes(r.W.toFixed(1)), 'Summary table: types, lines, bridge total ' + r.W.toFixed(1));
  await p.click('#sum-table tr.sum-line a[data-sumgo^="0|3|flex|"]'); await p.waitForTimeout(300);
  check(await p.evaluate(() => document.querySelector('#tabBar [data-otab="flex"]').getAttribute('aria-selected') === 'true' && document.querySelector('#tyOutL option:checked').value === '3'), 'a ratio opens Flexure with Interior S1 on G3');
  const e = await evCheck(p); check(e.n >= 20 && !e.bad.length, `Interior on G3 (S = 10 ft): ${e.n} values ${e.bad.slice(0, 3).join(' | ')}`);
  if (args.shots) { await p.click('#tabBar [data-otab="sum"]'); await p.waitForTimeout(300); await p.screenshot({ path: path.join(args.shots, 'ps3a-1400-summary-types.png') }); }
  await p.click('#tabBar [data-otab="rpt"]'); await p.waitForSelector('.rp-doc .rp-step', { timeout: 60000 }); await p.waitForTimeout(200);
  const rp = await p.evaluate(() => { const s1 = document.querySelector('.rp-doc section[data-rpsec="rp-s1"]'); return s1 ? s1.textContent.replace(/\s+/g, ' ') : ''; });
  check(/Every girder type and line/.test(rp) && /2 girder types on 5 girder lines/.test(rp) && /each girder type on its governing line/.test(rp) && /Interior S1 on G3, span 1 \(§3–§14\)/.test(rp), "Report §1: every type and line; PS-25: Interior worked on its governing line G3 (S = 10 ft), §3–§14 " + rp.slice(rp.indexOf("This report works"), rp.indexOf("This report works") + 200)); }
// PS-19: the exterior rigid section on the real girder lines (8, 10, 10, 8 ft): Exterior S1 on G1, Loads & LLDF: X_ext 18, Σx² 848, R = DF_M 0.7821
await p.click('#tabBar [data-otab="lds"]'); await p.selectOption('#tyOutT', { label: 'Exterior S1 (span 1)' }); await p.waitForTimeout(150); await p.selectOption('#tyOutL', '1'); await p.waitForTimeout(300);
{ const r = await p.evaluate(() => ({ s: !!document.getElementById('st-ld.rigSx2'), x: !!document.getElementById('st-ld.rigXext'), dfm: (document.querySelector('#out .kv [data-ev="dfm"]') || document.querySelector('#out [data-ev="dfm"]') || {}).textContent }));
  check(r.s && r.x && /^0\.7\d/.test(r.dfm || ''), 'PS-19: the rigid-section steps on the real girder lines, DF_M ' + JSON.stringify(r));   // PS-20: d_e 1.5 ft from the barriers: R 0.7608
  const e = await evCheck(p); check(e.n >= 20 && !e.bad.length, `PS-19 Loads & LLDF values = computeAll + rigid: ${e.n} ${e.bad.slice(0, 3).join(' | ')}`); }
// PS-20: d_e of each exterior line from the cross-section (overhang − barrier face): right overhang 4 ft → G5 2.500 ft, G1 1.500 ft; the entered field hidden
await p.click('#inTabs [data-itab="xsec"]'); await p.fill('#i_xs\\.ohR', '4'); await p.press('#i_xs\\.ohR', 'Tab'); await p.waitForTimeout(300);
{ const t = (await p.textContent('#card-extll')).replace(/\s+/g, ' ');
  check(/G1 1\.500 ft/.test(t) && /G5 2\.500 ft/.test(t) && !(await p.$('#i_base\\.loads\\.de')), 'PS-20: d_e per exterior line ' + t.slice(0, 200));
  const de = await p.evaluate(() => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project; return [window.PSBDesign.cellInputs(P, 1, 1).loads.de, window.PSBDesign.cellInputs(P, 1, 5).loads.de]; });
  check(de[0] === 1.5 && de[1] === 2.5, 'PS-20: engine d_e per line ' + de); }
await p.click('#inTabs [data-itab="layout"]'); await setList(p, '#i_xs\\.skews', '10, 20'); await p.waitForTimeout(300);
check(!/to fix/.test(await p.textContent('#sbDashCol')), 'skews 10, 20: allowed');
await setList(p, '#i_xs\\.skews', '20, 35'); await p.waitForTimeout(300);
check(/larger is 30° or more/.test(await p.textContent('#sbDashCol')), 'skews 20, 35 with the DF computed: input error');
check(!o.errs.length, 'console errors (3a-2): ' + o.errs.join(' | '));
await o.b.close();

// 7. PR 3a-3: DC2 / DW distributed (a new project): the Cross-section card (Typical AASHTO equal share for an AASHTO project, PS-21; barriers 0.30 klf, 25 psf) with its line table
//    (PS-21: AASHTO project, equal share) 0.12 on every line and DW 0.195; the Loads & LLDF tab's line table and steps (dl.*) for the line shown; the DC2 field
//    of the Loads tab hidden; "Entered per girder type" brings back the entered values (0.30 / 0.25)
o = await openPage(FILE, { vw: 1400, vh: 1000 }); p = o.p; await ready(p);
await p.click('#inTabs [data-itab="xsec"]'); await p.waitForTimeout(200);
{ const t = (await p.textContent('#card-dl')).replace(/\s+/g, ' ');
  check(/(0\.1200\s*){5}/.test(t) && /(0\.1950\s*){5}/.test(t), 'Cross-section: DC2 / DW per line ' + t.slice(-200));
  await p.click('#tabBar [data-otab="lds"]'); await p.waitForTimeout(300);
  const r = await p.evaluate(() => ({ dc2: (document.querySelector('#out [data-ev="wBar"]') || {}).textContent, dw: (document.querySelector('#out [data-ev="wDW"]') || {}).textContent, st: !!document.getElementById('st-dl.G2.DC2'), lt: /distributed to every girder line/.test(document.getElementById('out').textContent) }));
  check(r.dc2 === '0.120' && r.dw === '0.195' && r.st && r.lt, 'Loads & LLDF: G2 DC2 0.120 (AASHTO equal share, PS-21), DW 0.195 (the tile, 3 decimals), the line table and the steps ' + JSON.stringify(r));
  const e = await evCheck(p); check(e.n >= 20 && !e.bad.length, `Loads & LLDF values = computeAll: ${e.n} ${e.bad.slice(0, 3).join(' | ')}`);
  if (args.shots) await p.screenshot({ path: path.join(args.shots, 'ps3a-1400-lds-distributed.png') });
  await p.click('#inTabs [data-itab="loads"]'); check(!(await p.$('#i_base\\.loads\\.wBar')), 'Loads tab: no entered DC2 while distributed');
  await p.click('#inTabs [data-itab="xsec"]'); await p.selectOption('#i_xs\\.dl\\.mode', 'entered'); await p.waitForTimeout(300);
  const r2 = await p.evaluate(() => (document.querySelector('#out [data-ev="wBar"]') || {}).textContent); check(r2 === '0.300', 'entered: DC2 0.300 ' + r2);
  await p.selectOption('#i_xs\\.dl\\.mode', 'distributed'); await p.waitForTimeout(200);
  await p.fill('#i_xs\\.dl\\.barL\\.w', '-1'); await p.press('#i_xs\\.dl\\.barL\\.w', 'Tab'); await p.waitForTimeout(200);
  check(/Left barrier weight must be zero or a positive number/.test(await p.textContent('#sbDashCol')), 'a negative barrier weight is an input error'); }
check(!o.errs.length, 'console errors (3a-3): ' + o.errs.join(' | '));
await o.b.close();

// 8. PS-23 (engineer decision 2026-11-13): the entered d_e (2.0 ft) differs from the d_e computed from the cross-section (PS-20): overhangs
//    3 / 4 ft, barriers 1.5 ft → a banner on the Loads & LLDF tab (PS-22 style, in the flow) naming G1 2.0 → 1.5 and G5 2.0 → 2.5 ft and
//    that the DF use the computed value; the Report's assumptions list it; Close keeps the dismissal in the project (P.notices.de; no new
//    key), a reload does not show it again, the Report still lists it; overhangs 3.5 / 3.5 (computed 2.0 = entered): no banner, no note.
//    PS-24: a fresh project enters the computed d_e (1.5 ft): no banner; the PS-23 case is a project saved before PS-24 (entered 2.0 ft)
o = await openPage(FILE, { vw: 1400, vh: 1000, ls: SEED }); p = o.p; await ready(p);
await p.click('#tabBar [data-otab="lds"]'); await p.waitForTimeout(300);
check(!(await p.$('#deNotice')) && await p.evaluate(() => window.PSBModel.newProject().base.loads.de) === 1.5, 'PS-24: a fresh project: entered d_e 1.5 ft, no d_e banner');
await p.evaluate(() => { const P = window.PSBModel.newProject(); P.base.loads.de = 2.0; localStorage.setItem('psb2.project.current', window.PSBModel.exportJSON(P)); });   // saved before PS-24
await p.reload(); await ready(p);
{ const DE = /G1: entered 2\.0 ft, computed 1\.5 ft \(left overhang\); G5: entered 2\.0 ft, computed 2\.5 ft \(right overhang\)\. The live-load distribution factors use the computed d\s*e\./;
  await p.click('#inTabs [data-itab="xsec"]'); await p.fill('#i_xs\\.ohR', '4'); await p.press('#i_xs\\.ohR', 'Tab'); await p.waitForTimeout(300);
  await p.click('#tabBar [data-otab="lds"]'); await p.waitForTimeout(300);
  const a = await p.evaluate(() => { const n = document.getElementById('deNotice'), tb = document.getElementById('tabBar').getBoundingClientRect(); if (!n) return null; const r = n.getBoundingClientRect();
    return { t: n.textContent.replace(/\s+/g, ' '), pos: getComputedStyle(n).position, below: r.top >= tb.bottom - 0.5 }; });
  check(a && DE.test(a.t) && a.pos === 'static' && a.below, 'Loads & LLDF: the d_e notice inline: ' + JSON.stringify(a));
  const e = await evCheck(p); check(e.n >= 20 && !e.bad.length, `Loads & LLDF values = computeAll with the notice: ${e.n} ${e.bad.slice(0, 3).join(' | ')}`);
  await p.click('#tabBar [data-otab="sec"]'); await p.waitForTimeout(250); check(!(await p.$('#deNotice')), 'the notice only on the Loads & LLDF tab');
  await p.click('#tabBar [data-otab="rpt"]'); await p.waitForTimeout(1500);
  check(DE.test((await p.textContent('#out')).replace(/\s+/g, ' ')), 'Report: the assumptions list the difference');
  await p.click('#tabBar [data-otab="lds"]'); await p.waitForTimeout(300); await p.click('#deNotice [data-dedismiss]'); await p.waitForTimeout(300);
  const sv = await stored(p); check(!(await p.$('#deNotice')) && sv.notices && sv.notices.de === 'G1:2>1.5;G5:2>2.5', 'Close: dismissed for this project ' + JSON.stringify(sv.notices));
  await p.reload(); await ready(p); await p.click('#tabBar [data-otab="lds"]'); await p.waitForTimeout(300);
  check(!(await p.$('#deNotice')), 'after a reload: not shown again');
  await p.click('#tabBar [data-otab="rpt"]'); await p.waitForTimeout(1500);
  check(DE.test((await p.textContent('#out')).replace(/\s+/g, ' ')), 'Report: still listed after the dismissal');
  await p.click('#inTabs [data-itab="xsec"]'); await p.fill('#i_xs\\.ohL', '3.25'); await p.press('#i_xs\\.ohL', 'Tab'); await p.waitForTimeout(300);
  await p.click('#tabBar [data-otab="lds"]'); await p.waitForTimeout(300);
  check(/G1: entered 2\.0 ft, computed 1\.75 ft/.test(await p.textContent('#out')) && !!(await p.$('#deNotice')), 'a different difference: shown again');
  await p.fill('#i_xs\\.ohL', '3.5'); await p.press('#i_xs\\.ohL', 'Tab'); await p.fill('#i_xs\\.ohR', '3.5'); await p.press('#i_xs\\.ohR', 'Tab'); await p.waitForTimeout(300);
  check(!(await p.$('#deNotice')), 'overhangs 3.5 / 3.5 (computed 2.0 = entered): no notice');
  await p.click('#tabBar [data-otab="rpt"]'); await p.waitForTimeout(1500);
  check(!/the entered d\s*e differs/.test((await p.textContent('#out')).replace(/\s+/g, ' ')), 'Report: no note where they match');
  const ls = await lsSnap(p); check(Object.keys(ls).every(k => k.startsWith('psb2.') || k in SEED), 'keys (PS-23): ' + Object.keys(ls).join(', ')); }
check(!o.errs.length, 'console errors (PS-23): ' + o.errs.join(' | '));
await o.b.close();

// 9. PR 3b: the Summary tab (ui/summary.js) on four projects written on the page and reopened (file://): one girder type on every line,
//    Interior + Exterior (a new project), three types with their own inputs on unequal bays, three spans made continuous (15 cells: the
//    chunked run, Stop / Run all / Re-run all), two spans with a line not checked. Each: the verdict counts = the check summary column's;
//    every number (data-sv) = computeAll (+ PS-10) of that type × line on the page; every weight; the grid's rows × spans; a grid link opens
//    its tab with that type and line and its worked step revealed; 0 console errors; screenshots 1400 px.
const sumCheck = (p, tag) => p.evaluate(() => {
  const s0 = localStorage.getItem('psb2.project.current'), P = s0 ? window.PSBModel.importJSON(s0).project : window.PSBModel.newProject(), BR = window.PSBBridge, D = window.PSBDesign, I = new Map();
  BR.cells(P).forEach(c => { const inp = D.cellInputs(P, c.k, c.g); I.set(`${c.k}|${c.g}`, { c, inp, R: window.PSBHoldDown.compute(JSON.parse(JSON.stringify(inp))) }); });
  const at = (R, q) => q.split('.').reduce((o, k) => o == null ? o : o[k], R), f = (v, d) => typeof v === 'number' && isFinite(v) ? v.toFixed(d) : '—', bad = [];
  const sv = [...document.querySelectorAll('#out [data-sv]')]; sv.forEach(el => { const [k, g, q] = el.dataset.sv.split('|'), x = I.get(`${k}|${g}`); const v = x && at(x.R, q);
    if (!x || el.textContent !== f(v, /\.loc$/.test(q) ? 2 : 3)) bad.push(`${el.dataset.sv}: ${el.textContent} vs ${v}`); });
  const wOf = x => x.R.g.wsw * (x.inp.L + 2 * (+x.inp.opt.endOh || 0) / 12);
  const sw = [...document.querySelectorAll('#out [data-sw]')]; sw.forEach(el => { const [k, g] = el.dataset.sw.split('|'), xs = [...I.values()].filter(x => (k === '' || x.c.k === +k) && (g === '' || x.c.g === +g));
    if (!xs.length || el.textContent !== xs.reduce((a, x) => a + wOf(x), 0).toFixed(1)) bad.push(`W ${el.dataset.sw}: ${el.textContent}`); });
  const cnt = s => { const m = (document.querySelector(s) || {}).textContent || ''; return [(m.match(/(\d+) FAIL/) || [])[1], (m.match(/(\d+) PASS/) || [])[1]].join('/'); };
  const rows = document.querySelectorAll('#sum-grid tbody tr').length, cols = document.querySelectorAll('#sum-grid thead th').length - 1;
  return { nv: sv.length, nw: sw.length, bad, sum: cnt('#sum-verdict .sum-cnt'), dash: cnt('#sbDashCol .sdC'), rows, cols, nb: P.xs.nb, ns: P.spans.lengths.length,
    nc: (document.querySelector('#sum-grid') || { textContent: '' }).textContent.split('not checked').length - 1, un: BR.unassigned(P).length, up: /Up to date/.test(document.getElementById('sumRunMsg').textContent) };
});
const write = (p, fn) => p.evaluate(fn);
o = await openPage(FILE, { vw: 1400, vh: 1000 }); p = o.p; await ready(p);
const SUMP = {
  single: () => { const P = window.PSBModel.newProject(); P.types = [{ id: 'T1', label: 'All S1', span: 1, lines: [1, 2, 3, 4, 5], ovr: {} }]; localStorage.setItem('psb2.project.current', window.PSBModel.exportJSON(P)); },
  multi: () => { const B = window.PSBBridge, P = window.PSBModel.newProject(); P.xs.bays = [8, 10, 10, 8]; P.types[1].ovr = { 'mat.fc': 9 }; const k = B.addType(P, 0, { label: 'G3 own' }); P.types[k].ovr = { 'mat.fc': 7 }; B.assignLine(P, k, 3);
    localStorage.setItem('psb2.project.current', window.PSBModel.exportJSON(P)); },
  cont3: () => { const P = window.PSBModel.newProject(); P.spans.lengths = [100, 120, 100]; P.spans.continuity = 'composite'; P.xs.skews = [0, 0, 0, 0]; window.PSBBridge.syncSpans(P); localStorage.setItem('psb2.project.current', window.PSBModel.exportJSON(P)); },
  cont2un: () => { const P = window.PSBModel.newProject(); P.spans.lengths = [90, 90]; P.spans.continuity = 'composite'; P.xs.skews = [0, 0, 0]; window.PSBBridge.syncSpans(P); P.types.find(t => t.span === 2 && /Exterior/.test(t.label)).lines = [1];
    localStorage.setItem('psb2.project.current', window.PSBModel.exportJSON(P)); }
};
for (const [tag, fn] of [['new', null], ...Object.entries(SUMP)]) {
  if (fn) { await write(p, fn); await p.reload(); await ready(p); }
  await p.click('#tabBar [data-otab="sum"]'); await p.waitForFunction(() => /Up to date/.test((document.getElementById('sumRunMsg') || {}).textContent || ''), null, { timeout: 30000 }); await p.waitForTimeout(150);
  const r = await sumCheck(p, tag);
  check(r.up && r.nv >= 30 && r.nw >= 3 && !r.bad.length, `3b ${tag}: ${r.nv} values, ${r.nw} weights = the engine's ${r.bad.slice(0, 3).join(' | ')}`);
  check(r.sum === r.dash && /^\d+\/\d+$/.test(r.sum), `3b ${tag}: verdict counts = the check summary column's (${r.sum} vs ${r.dash})`);
  check(r.rows === r.nb && r.cols === r.ns && r.nc === r.un, `3b ${tag}: grid ${r.rows} lines × ${r.cols} spans, ${r.nc} not checked (${r.un})`);
  if (args.shots) { await p.screenshot({ path: path.join(args.shots, `ps3b-1400-summary-${tag}.png`) });
    await p.evaluate(() => { const op = document.getElementById('outputPanel'), g = document.getElementById('sum-grid'); op.scrollTop += g.getBoundingClientRect().top - document.getElementById('tabBar').getBoundingClientRect().bottom - 8; });
    await p.screenshot({ path: path.join(args.shots, `ps3b-1400-summary-${tag}-grid.png`) }); }
  // a grid link: the last line of the last span that has a type → its tab with that type and line, the step revealed
  const ln = await p.evaluate(() => { const a = [...document.querySelectorAll('#sum-grid a[data-sumgo]')].filter(x => !x.dataset.sumgo.endsWith('|1')).pop(); a.click(); return a.dataset.sumgo; });
  await p.waitForTimeout(400);
  const [k, g, tab, st] = ln.split('|');
  const q = await p.evaluate(([tab, st]) => { const el = document.getElementById('st-' + st); return { sel: document.querySelector(`#tabBar [data-otab="${tab}"]`).getAttribute('aria-selected'), line: (document.querySelector('#tyOutL option:checked') || {}).value,
    type: (document.querySelector('#tyOutT option:checked') || {}).value, step: !!el && el.offsetParent !== null }; }, [tab, st]);
  check(q.sel === 'true' && q.line === g && q.type === k && q.step, `3b ${tag}: grid link ${ln} opens ${tab} with type ${k} on G${g}, step ${st} shown ` + JSON.stringify(q));
  const e = await evCheck(p); check(!e.bad.length, `3b ${tag}: the tab's values = that cell's computeAll ${e.bad.slice(0, 2).join(' | ')}`);
}
// the chunked run: Re-run all then Stop at once (before the first cell): "Stopped", the check summary says so; Run all → up to date, same values
await p.click('#tabBar [data-otab="sum"]'); await p.waitForTimeout(200);
{ const before = await p.evaluate(() => [...document.querySelectorAll('#out [data-sv]')].map(e => e.dataset.sv + '=' + e.textContent).join(';'));
  await p.evaluate(() => { document.querySelector('[data-sumrun="rerun"]').click(); document.querySelector('#out [data-sumrun="stop"]').click(); });
  await p.waitForTimeout(200);
  const s = await p.evaluate(() => ({ msg: document.getElementById('sumRunMsg').textContent, dash: document.querySelector('#sbDashCol .sdRun').textContent, grid: !!document.getElementById('sum-grid') }));
  check(/Stopped: \d+ of 9 /.test(s.msg) && /Stopped/.test(s.dash) && !s.grid, '3b: Stop → stopped, no grid, the check summary says so ' + JSON.stringify(s));
  await p.click('#out [data-sumrun="run"]');
  await p.waitForFunction(() => /Up to date/.test((document.getElementById('sumRunMsg') || {}).textContent || ''), null, { timeout: 30000 });
  const after = await p.evaluate(() => [...document.querySelectorAll('#out [data-sv]')].map(e => e.dataset.sv + '=' + e.textContent).join(';'));
  check(after === before && after.length > 100, '3b: Run all → up to date, the same values');
  // while running: the check summary column shows the run
  await p.evaluate(() => document.querySelector('[data-sumrun="rerun"]').click());
  const d = await p.evaluate(() => document.querySelector('#sbDashCol .sdRun').textContent);
  check(/Running every girder type × line \(\d+ \/ 9\)/.test(d), '3b: the check summary during the run: ' + d);
  await p.waitForFunction(() => /Up to date/.test((document.getElementById('sumRunMsg') || {}).textContent || ''), null, { timeout: 30000 }); }
check(!o.errs.length, 'console errors (3b): ' + o.errs.join(' | '));
await o.b.close();

// 10. PS-25 (engineer decision 2026-11-13): the Report works each girder type on its governing line (default), numbered per type, the
//     type and line in each heading; "Worked sections: every girder line" works every type × line; the choice kept in psb2.ui (not in the
//     project); §1's "see §" of a line go to its type's sections; Print report prints every unit's sections, steps and figures; a project
//     with one girder type on one line: no unit headings (the one-girder report).
o = await openPage(FILE, { vw: 1400, vh: 1000 }); p = o.p; await ready(p);
const RPQ = () => p.evaluate(() => ({ secs: [...document.querySelectorAll('.rp-doc .rp-h1')].map(h => h.textContent.trim()), unres: document.querySelectorAll('.rp-doc .rp-bad').length,
  steps: document.querySelectorAll('.rp-doc .rp-step').length, nSt: window.PSBReportUI.state.M.sections.reduce((a, s) => a + s.subs.reduce((b, q) => b + q.items.filter(i => i.type === 'steps').reduce((c, i) => c + i.steps.length, 0), 0), 0),
  kErr: document.querySelectorAll('.rp-doc .katex-error').length, gov: (document.querySelector('[data-rpworked="gov"]') || {}).checked, all: (document.querySelector('[data-rpworked="all"]') || {}).checked,
  ui: JSON.parse(localStorage.getItem('psb2.ui') || '{}'), proj: localStorage.getItem('psb2.project.current') }));
const rptOpen = async () => { await p.click('#tabBar [data-otab="rpt"]'); await p.waitForSelector('.rp-doc .rp-step', { timeout: 120000 }); await p.waitForTimeout(300); };
await rptOpen();
{ const r = await RPQ();
  check(r.gov && !r.all && r.secs.length === 26 && /^3\. Section properties: Interior S1 on G2, span 1$/.test(r.secs[2]) && /^15\. Section properties: Exterior S1 on G1, span 1$/.test(r.secs[14]) && /^26\. Rating: Exterior S1 on G1, span 1$/.test(r.secs[25]) && !r.unres && !r.kErr && r.steps === r.nSt,
    'PS-25 default: each type on its governing line, §3–§14 Interior, §15–§26 Exterior ' + JSON.stringify({ n: r.secs.length, unres: r.unres, steps: r.steps, nSt: r.nSt }));
  // §1: the grid row of G5 (Exterior S1) points to Exterior's End zone section §22; a click jumps there
  const j = await p.evaluate(() => { const s1 = document.querySelector('.rp-doc section[data-rpsec="rp-s1"]'), tr = [...s1.querySelectorAll('table tbody tr')].find(t => t.children[0].textContent.trim() === 'G5');
    const a = tr && tr.querySelector('a[href^="#"]'); if (!a) return null; const id = a.getAttribute('href').slice(1); a.click(); const el = document.getElementById(id), b = el.getBoundingClientRect();
    return { text: a.textContent, h: (el.closest('section.rp-sec') || el).querySelector('.rp-h1').textContent, inView: b.top >= -2 && b.top < innerHeight }; });
  check(j && j.text === '§22' && /^22\. End zone & hold-down: Exterior S1 on G1, span 1$/.test(j.h) && j.inView, 'PS-25: §1 grid G5 → its type\'s section §22 ' + JSON.stringify(j));
  if (args.shots) { await p.evaluate(() => document.querySelector('.rp-doc section[data-rpsec="rp-s1"]').scrollIntoView()); await p.waitForTimeout(200); await p.screenshot({ path: path.join(args.shots, 'ps25-1400-report-s1.png') });
    await p.evaluate(() => [...document.querySelectorAll('.rp-doc .rp-h1')][14].scrollIntoView()); await p.waitForTimeout(200); await p.screenshot({ path: path.join(args.shots, 'ps25-1400-report-exterior.png') }); } }
// every girder line: 2 + 12 × 5 sections; kept in psb2.ui, the project untouched; again after a reload
{ const proj0 = (await RPQ()).proj;
  await p.check('[data-rpworked="all"]'); await p.waitForFunction(() => document.querySelectorAll('.rp-doc .rp-h1').length === 62, null, { timeout: 120000 }); await p.waitForTimeout(300);
  const r = await RPQ(), want = ['Interior S1 on G2', 'Interior S1 on G3', 'Interior S1 on G4', 'Exterior S1 on G1', 'Exterior S1 on G5'];
  check(r.all && want.every((t, i) => r.secs[2 + 12 * i].endsWith(`: ${t}, span 1`) && r.secs[2 + 12 * i].startsWith(`${3 + 12 * i}. Section properties`)) && !r.unres && !r.kErr && r.steps === r.nSt, 'PS-25 every girder line: 62 sections in type and line order ' + JSON.stringify({ n: r.secs.length, unres: r.unres }));
  check(r.ui.rpt && r.ui.rpt.worked === 'all' && r.proj === proj0 && Object.keys(await lsSnap(p)).every(k => k.startsWith('psb2.')), 'PS-25: the choice in psb2.ui (rpt.worked), the project not changed, no new key');
  // print: Print report (the whole report alone) has every unit's sections, steps and figures
  await p.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await p.click('[data-rpact="print"]'); await p.waitForFunction(() => window.__printed > 0); await p.emulateMedia({ media: 'print' });
  const pr = await p.evaluate(() => { const vis = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0, box = document.getElementById('rp-print');
    return { box: vis(box), app: vis(document.getElementById('app')), h: [...box.querySelectorAll('.rp-h1')].filter(vis).length, steps: box.querySelectorAll('.rp-step').length, hidden: [...box.querySelectorAll('.rp-step')].filter(x => !vis(x)).length,
      figs: box.querySelectorAll('.rp-fig').length, docFigs: document.querySelectorAll('#rptHost .rp-doc .rp-fig').length, ext: [...box.querySelectorAll('.rp-h1')].filter(h => /Exterior S1 on G5, span 1$/.test(h.textContent)).length }; });
  check(pr.box && !pr.app && pr.h === 62 && pr.steps === r.steps && !pr.hidden && pr.figs === pr.docFigs && pr.figs >= 60 && pr.ext === 12, 'PS-25 print: every unit printed (headings, steps, figures) ' + JSON.stringify(pr));
  await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await p.reload(); await ready(p); await rptOpen(); await p.waitForFunction(() => document.querySelectorAll('.rp-doc .rp-h1').length === 62, null, { timeout: 120000 });
  check((await RPQ()).all, 'PS-25: the choice kept after a reload');
  await p.check('[data-rpworked="gov"]'); await p.waitForFunction(() => document.querySelectorAll('.rp-doc .rp-h1').length === 26, null, { timeout: 120000 }); }
// PS-26 (engineer decision 2026-11-13): RIDOT, the Exterior type's own f′c 9.0 ksi: §2's Owner rules table has one "Applied here" column per
// girder type (its f′c, limit and ratio), each heading's "see §" goes to that type's sections; the in-app Owner rules tab keeps one column (the
// type shown) with the same cell as that type's column; §1 Key quantities "DF_M / DF_V (see §)" goes to the Moment distribution factor step
await p.evaluate(() => { const P = window.PSBModel.newProject(); P.base.owner = 'RIDOT'; P.types[1].ovr = { 'mat.fc': 9 }; localStorage.setItem('psb2.project.current', window.PSBModel.exportJSON(P)); });
await p.reload(); await ready(p); await rptOpen();
{ const r = await p.evaluate(() => { const s2 = document.querySelector('.rp-doc section[data-rpsec="rp-s2"]'), tb = [...s2.querySelectorAll('table')].find(t => /Applied here/.test(t.querySelector('thead') ? t.querySelector('thead').textContent : ''));
    if (!tb) return null; const th = [...tb.querySelectorAll('thead th')].map(x => x.textContent.trim()), fc = [...tb.querySelectorAll('tbody tr')].find(tr => /minimum compressive strength 5000 psi/.test(tr.textContent));
    const a = tb.querySelectorAll('thead th')[4].querySelector('a[href^="#"]'), id = a && a.getAttribute('href').slice(1); if (a) a.click(); const el = id && document.getElementById(id);
    return { th, fc: fc ? [...fc.children].slice(3).map(x => x.textContent.trim()) : null, bad: document.querySelectorAll('.rp-doc .rp-bad').length, jump: el ? (el.closest('section.rp-sec') || el).querySelector('.rp-h1').textContent : '' }; });
  check(r && r.th.length === 5 && /^Applied here: Interior S1 on G\d, span 1 \(see §3–§14\)$/.test(r.th[3]) && /^Applied here: Exterior S1 on G\d, span 1 \(see §15–§26\)$/.test(r.th[4])
    && /f′c = 8\.50 ksi.*ratio = 5\.00 \/ 8\.50 = 0\.588 PASS/.test(r.fc[0]) && /f′c = 9\.00 ksi.*ratio = 5\.00 \/ 9\.00 = 0\.556 PASS/.test(r.fc[1]) && !r.bad && /^15\. Section properties: Exterior S1/.test(r.jump), 'PS-26: §2 one column per girder type ' + JSON.stringify(r));
  const k = await p.evaluate(() => { const s1 = document.querySelector('.rp-doc section[data-rpsec="rp-s1"]'), row = [...s1.querySelectorAll('.rp-kv > div, tr, .rp-kvr')].filter(x => /^DF/.test(x.textContent.trim())).map(x => x.querySelector('a[href^="#"]')).filter(Boolean);
    return row.map(a => { const el = document.getElementById(a.getAttribute('href').slice(1)); return el ? el.textContent.replace(/\s+/g, ' ').slice(0, 60) : null; }); });
  check(k.length === 2 && k.every(t => t && /Moment distribution factor/.test(t)), 'PS-26: §1 Key quantities DF link → the Moment distribution factor step ' + JSON.stringify(k));
  await p.click('#inTabs [data-itab="own"]'); await p.waitForTimeout(250);
  const t = await p.evaluate(() => { const tr = document.getElementById('own-rule-fc.min'); return tr ? { n: tr.children.length, c: tr.children[3].textContent.replace(/\s+/g, ' ').trim() } : null; });
  const rat = x => (/= (\d+\.\d+) ksi; governing minimum (\d+\.\d+) ksi; ratio = .* = (\d\.\d+) (PASS|FAIL)/.exec(x || '') || []).slice(1).join(' ');   // (the tab's <br>: no space before f′c)
  check(t && t.n === 4 && rat(t.c) && r && r.fc.some(x => rat(x) === rat(t.c)), 'PS-26: the Owner rules tab: one column, the cell of the type shown ' + JSON.stringify(t));
  if (args.shots) { await p.click('#tabBar [data-otab="rpt"]'); await p.waitForTimeout(400); await p.evaluate(() => { const t = [...document.querySelectorAll('.rp-doc section[data-rpsec="rp-s2"] table')].find(x => /Applied here/.test(x.textContent)); t.scrollIntoView(); window.scrollBy(0, -260); }); await p.waitForTimeout(200); await p.screenshot({ path: path.join(args.shots, 'ps26-1400-report-s2.png') }); } }
// one girder type on one line: the one-girder report (14 sections, no unit headings, no choice shown)
await p.evaluate(() => { const P = window.PSBModel.newProject(); P.types = [{ id: 'T1', label: 'One S1', span: 1, lines: [2], ovr: {} }]; localStorage.setItem('psb2.project.current', window.PSBModel.exportJSON(P)); });
await p.reload(); await ready(p); await rptOpen();
{ const r = await RPQ(); check(r.secs.length === 14 && /^3\. Section properties/.test(r.secs[2]) && !r.secs.some(t => / on G\d+, span \d+$/.test(t)) && !(await p.$('[data-rpworked]')) && !r.unres, 'PS-25: one girder type on one line: the one-girder report ' + r.secs.slice(0, 3).join(' | ')); }
check(!o.errs.length, 'console errors (PS-25): ' + o.errs.join(' | '));
await o.b.close();

// 5. phone
o = await openPage(FILE, { vw: 390, vh: 844 }); p = o.p; await ready(p);
await p.click('#inTabs [data-itab="gird"]'); await p.waitForTimeout(200);
check(await p.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth) <= 0, 'phone: Girders & strands without sideways scroll');
await p.click('#tabBar [data-otab="str"]'); await p.waitForTimeout(300);
check(await p.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth) <= 0 && await p.isVisible('#tyOutT'), 'phone: Stresses with the type / line bar without sideways scroll');
if (args.shots) await p.screenshot({ path: path.join(args.shots, 'ps3a-390-gird.png'), fullPage: false });
await p.click('#tabBar [data-otab="sum"]'); await p.waitForTimeout(400);   // PR 3b: the Summary tab at 390 px
check(await p.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth) <= 0 && await p.isVisible('#sum-grid') && await p.isVisible('#sum-table'), 'phone: Summary (grid and table) without sideways scroll');
if (args.shots) { await p.screenshot({ path: path.join(args.shots, 'ps3b-390-summary.png'), fullPage: false }); await p.evaluate(() => document.getElementById('sum-grid').scrollIntoView()); await p.screenshot({ path: path.join(args.shots, 'ps3b-390-summary-grid.png'), fullPage: false }); }
check(!o.errs.length, 'console errors (390 px): ' + o.errs.join(' | '));
await o.b.close();
console.log(`${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
