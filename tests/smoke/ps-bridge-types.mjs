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
//   5. 390 px: the Girders & strands tab and a result tab with the type / line bar without sideways scroll; 0 console errors; psb2.* keys only.
//   node tests/smoke/ps-bridge-types.mjs [--file <index.html>] [--shots <dir>]
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
const stored = async p => JSON.parse((await lsSnap(p))['psb2.project.current'] || 'null');
const SEED = { 'psbeam.inputs.v1': '{"girder":"PCI BT-72","L":120}', 'sbd2.project.current': '{"schema":"sbd2.project"}' };
/* every engine value on the output panel = computeAll (+ PS-10) of PSBDesign.inputs(P) on the page (the cell shown) */
const evCheck = p => p.evaluate(() => {
  const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, R = window.PSBHoldDown.compute(window.PSBDesign.inputs(P));
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
{ const t = await p.textContent('#toast'), sv = await stored(p);
  check(/S1 G5: Exterior S1 → Interior S1/.test(t) && /S1 G6: no type → Exterior S1/.test(t), 'notice: ' + t);
  check(JSON.stringify(sv.types.map(q => q.lines)) === '[[2,3,4,5],[1,6]]', 'lines re-assigned ' + JSON.stringify(sv.types.map(q => q.lines)));
  await p.click('#tUndo'); await p.waitForTimeout(250);
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

// 5. phone
o = await openPage(FILE, { vw: 390, vh: 844 }); p = o.p; await ready(p);
await p.click('#inTabs [data-itab="gird"]'); await p.waitForTimeout(200);
check(await p.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth) <= 0, 'phone: Girders & strands without sideways scroll');
await p.click('#tabBar [data-otab="str"]'); await p.waitForTimeout(300);
check(await p.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth) <= 0 && await p.isVisible('#tyOutT'), 'phone: Stresses with the type / line bar without sideways scroll');
if (args.shots) await p.screenshot({ path: path.join(args.shots, 'ps3a-390-gird.png'), fullPage: false });
check(!o.errs.length, 'console errors (390 px): ' + o.errs.join(' | '));
await o.b.close();
console.log(`${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
