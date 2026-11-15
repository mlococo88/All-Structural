#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), batch D1 (2026-11-15): the demand source of each girder type (Loads tab, Demands card; the old app's
// MIDAS import and the Steel Bridge app's source choice). Headless Chromium, file://, CDN libraries from tests/libs.
//   1. a new project: every type "This app's analysis"; the output tabs' source line (green) says so; no P.demands written;
//   2. Interior S1 in scope: source "MIDAS file", the file chosen (the MCT Generator's 3-span file): the bridge-span question (accepted: one
//      Undo step with the file), the banner, the span picker (span 1 of 3), the imported values (details); the Analysis tab's source line
//      (blue), "Imported demands" card and the worked steps of the imported DC2 / DW / LL; the Loads & LLDF tab's "Live load from the
//      imported demands"; the DF / m per effect card on the Loads tab; the Summary's checks computed;
//   3. span 2 chosen: the engine reads the file's span 2 (an input warning: its length against the bridge span 1); Undo puts span 1 back;
//      (batch D2) the Analysis tab's views of the member: span 2 and the entire beam (the file's stations, Strength I as the old app's view),
//      "Design span 2 →" (one Undo step); the Report keeps the design span;
//   4. "✕ use this app's analysis": the results equal those before the import (the file kept with the type); the import guide opens;
//   5. a custom table (paste of 3 rows from Excel), the engine's M_LL at midspan = 0.7 × the entered M+ (DF 0.7);
//   6. a factored file refused (alert, project unchanged); a MIDAS file through Import JSON refused with the Loads-tab pointer;
//   7. 390 px: no horizontal page scroll on the Loads tab; 0 console errors.
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/ps-bridge/index.html');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs, dialogs } = await openPage(FILE, { vw: 1400, vh: 1000 });   // dialogs recorded and accepted (tests/lib.mjs)
const proj = async () => JSON.parse(await p.evaluate(() => localStorage.getItem('psb2.project.current')));
const itab = t => p.evaluate(t => document.querySelector(`#inTabs [data-itab="${t}"]`).click(), t);
const otab = t => p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t);
const out = () => p.evaluate(() => document.getElementById('out').textContent);
const R = () => p.evaluate(() => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, i = window.PSBDesign.inputs(P), R = window.PSBHoldDown.compute(i);
  return { useExt: R.useExt, MLL: R.MLL, sel: R.ext && R.ext.sel, L: R.L, checks: R.checks.map(c => [c.n, c.r]) }; });
const until = async (f, ms, w) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + w); await new Promise(r => setTimeout(r, 100)); } };
const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'psbd1-'));
const mct = JSON.parse(fs.readFileSync(path.join(REPO, 'tests/projects/ext/mct_psbeam_selfweight_excluded.json'), 'utf8'));
const fM = path.join(dir, 'mct.json'), fF = path.join(dir, 'factored.json');
fs.writeFileSync(fM, JSON.stringify(mct)); fs.writeFileSync(fF, JSON.stringify(Object.assign({}, mct, { factored: true })));
try {
  await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(400);
  // 1.
  await p.evaluate(() => { const el = document.getElementById('i_project.checker'); el.value = 'd1'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await itab('loads'); await p.waitForSelector('#card-dem');
  assert.match(await p.$eval('#card-dem', e => e.innerText), /This app's analysis/);
  await otab('an'); await until(async () => /kip/.test(await out()), 20000, 'Analysis');
  assert.match(await p.$eval('#dmSrcBar', e => e.innerText), /Demands: This app's analysis/); assert.equal(await p.$eval('#dmSrcBar', e => e.classList.contains('ex')), false);
  const before = await R(); assert.equal(before.useExt, false); assert.equal('demands' in await proj(), false);
  ok('new project: every type on this app\'s analysis; the source line (green) on the output tabs; no P.demands written');
  // 2. Interior S1: a MIDAS file (the bridge first given three spans, not the file's, and made continuous)
  await itab('layout'); await p.evaluate(() => { const el = document.querySelector('[id="i_spans.lengths"]'); el.value = '100, 130, 100'; el.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(300);
  await p.selectOption('[id="i_spans.continuity"]', 'composite'); await p.waitForTimeout(300); await itab('loads');
  const P0 = await proj(), T1 = P0.types[0];
  await p.selectOption('#tyScope_loads', T1.id); await p.waitForSelector('#dm_src');
  await p.selectOption('#dm_src', 'midas'); await p.waitForSelector('#card-dem [data-dm="file"]');
  await p.setInputFiles('#fDemands', fM); await until(async () => !!(await p.$('#dmBanner')), 10000, 'banner');
  assert.ok(dialogs.some(d => /differ from the bridge's/.test(d)), 'span question'); const P1 = await proj();
  assert.deepEqual(P1.spans.lengths, [110, 140, 110]); assert.equal(P1.demands[T1.id].src, 'midas'); assert.equal(P1.demands[T1.id].midas.name, 'mct.json');
  assert.match(await p.$eval('#dmBanner', e => e.innerText), /Running on MIDAS demands[\s\S]*62 stations[\s\S]*Span 1: 0–110 ft/);
  assert.equal(await p.$$eval('.dmSpans button', bs => bs.length), 3); assert.equal(await p.$eval('.dmSpans button[aria-pressed="true"]', e => e.dataset.i), '1');
  await p.click('#dmVals summary'); assert.ok(await p.$eval('#dmVals table', t => t.rows.length > 10));
  assert.ok(await p.$('#card-extll'), 'DF / m per effect card');
  const r1 = await R(); assert.equal(r1.useExt, true); assert.equal(r1.sel.idx, 1); assert.equal(r1.L, 110);
  await otab('an'); await until(async () => !!(await p.$('#anImported')), 20000, 'Imported demands card');
  assert.match(await p.$eval('#dmSrcBar', e => e.innerText), /Demands: MIDAS file mct\.json[\s\S]*span 1/); assert.equal(await p.$eval('#dmSrcBar', e => e.classList.contains('ex')), true);
  assert.match(await out(), /DC2 moment at midspan \(imported/); assert.match(await out(), /Live load moment \(LL\+IM\) at midspan, positive envelope \(imported\)/);
  await otab('lds'); await until(async () => /Live load from the imported demands/.test(await out()), 20000, 'imported LL card');
  await otab('sum'); await until(async () => /PASS|FAIL/.test(await out()), 60000, 'Summary');
  ok('MIDAS file for Interior S1: bridge spans set on the question, banner, span picker, imported values; Analysis / Loads & LLDF imported cards and steps; DF / m card; Summary computed');
  // 3. span 2 of the file for span 1 of the bridge: a warning, the engine reads span 2; Undo
  await itab('loads'); await p.click('.dmSpans button[data-i="2"]'); await p.waitForTimeout(300);
  const r2 = await R(); assert.equal(r2.sel.idx, 2);
  assert.ok(await p.evaluate(() => window.PSBInputCheck.collect(window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project).warnings.some(w => /MIDAS span 2 is 140\.00 ft long but span 1/.test(w.msg))));
  assert.match(await p.$eval('#dmWarn', e => e.textContent), /MIDAS span 2 is 140\.00 ft long/, 'the warning on the card');
  await otab('an'); await p.waitForTimeout(300); assert.equal(await p.$eval('#dmSrcBar', e => e.classList.contains('warn')), true); assert.match(await p.$eval('#dmSrcBar', e => e.textContent), /Check: .*140\.00 ft long/);
  await itab('loads');
  await p.click('#bUndo'); await p.waitForTimeout(300); assert.equal((await R()).sel.idx, 1);
  ok('span 2 chosen: the engine reads it, with the length warning; Undo returns span 1');
  // 3b (batch D2): the Analysis tab's views of the imported member (the old app's "View span"): span 2, the entire beam, "Design span 2 →"
  await otab('an'); await p.waitForSelector('#o_dmView');
  assert.equal(await p.$$eval('#o_dmView option', o => o.map(x => x.value).join()), 'design,s1,s2,s3,all');
  await p.selectOption('#o_dmView', 's2'); await p.waitForSelector('#anViewTbl');
  const v2 = await p.evaluate(() => [...document.querySelectorAll('#anViewTbl tbody tr')].map(tr => +tr.children[0].textContent.replace(/,/g, '')));
  assert.ok(v2.length > 5 && v2[0] >= 110 && v2[0] < 115 && v2[v2.length - 1] > 240 && v2[v2.length - 1] <= 250, 'span 2 stations ' + v2.join());
  assert.ok(await p.$('#gfx_dmview svg'), 'view chart');
  if (process.env.SHOTS) await p.screenshot({ path: path.join(process.env.SHOTS, 'D2-analysis-view-span2.png') }); assert.match(await out(), /Worked: Mu\+ at x = /);
  // Strength I of the view = the old app's: η(1.25(M_DC1 + M_DC2) + 1.50 M_DW + 1.75 m M_LL+) of the file's row (AASHTO: η = m = 1)
  const row = mct.stations.find(s => s.x === 180) || mct.stations.find(s => s.x > 110 && s.x < 250);
  const Mu = 1.25 * (row.M_DC1 + row.M_DC2) + 1.5 * row.M_DW + 1.75 * row.M_LLpos;
  const shown = await p.evaluate(x => { const tr = [...document.querySelectorAll('#anViewTbl tbody tr')].find(t => +t.children[0].textContent.replace(/,/g, '') === x); return tr ? +tr.children[6].textContent.replace(/,/g, '').replace(/\u2212/g, '-') : NaN; }, row.x);
  assert.ok(Math.abs(shown - Mu) <= 0.5, `M_u+ at ${row.x}: ${shown} vs ${Mu}`);
  await p.selectOption('#o_dmView', 'all'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => document.querySelectorAll('#anViewTbl tbody tr').length), mct.stations.length);
  await p.selectOption('#o_dmView', 's2'); await p.waitForSelector('[data-dmdesign="2"]'); await p.click('[data-dmdesign="2"]'); await p.waitForTimeout(400);
  assert.equal((await R()).sel.idx, 2); assert.equal(await p.$eval('#o_dmView', e => e.value), 'design');
  await p.click('#bUndo'); await p.waitForTimeout(300); assert.equal((await R()).sel.idx, 1);
  const rpt = await p.evaluate(() => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, B = window.PSBReportData.compute(P, null);
    return window.PSBUiAnalysis.output({ P, inp: B.inp, R: B.R, W: B.W, ui: {} }); });
  assert.ok(!/anViewBar/.test(rpt) && /Imported demands of the span/.test(rpt), 'the Report keeps the design span');
  await p.selectOption('#o_dmView', 'design');
  ok('Analysis: view span 2 (the file\'s stations, Strength I as the old app) and the entire beam; "Design span 2 →" = one Undo step; the Report on the design span');
  // 4. back to this app's analysis
  await p.click('#card-dem [data-dm="app"]'); await p.waitForTimeout(300);
  const P4 = await proj(); assert.equal(P4.demands[T1.id].src, 'app'); assert.ok(P4.demands[T1.id].midas.file, 'file kept');
  const r4 = await R(); assert.equal(r4.useExt, false);
  await p.click('#card-dem a[data-dm="guide"]'); await p.waitForSelector('#dmGuide[open]'); assert.match(await p.$eval('#dmGuide', e => e.innerText), /Who computes what/); await p.click('#dmGuideClose');
  ok('"use this app\'s analysis": built-in results again, the file kept; the import guide opens and closes');
  // 5. custom table (paste from Excel)
  await p.selectOption('#dm_src', 'table'); await p.waitForSelector('#dmTable');
  await p.evaluate(() => { const el = document.querySelector('#dmTable input[data-j="0"][data-c="x"]'); const dt = new DataTransfer();
    dt.setData('text/plain', '0\t0\t0\t0\t0\t20\t15\t110\t-10\n55\t500\t400\t3000\t0\t0\t0\t60\t-60\n110\t0\t0\t0\t0\t-20\t-15\t10\t-110');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const el = document.getElementById('i_base.loads.extDFpos'); el.value = '0.7'; el.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(300);
  const P5 = await proj(); assert.equal(P5.demands[T1.id].table.rows.length, 3);
  const r5 = await R(); assert.equal(r5.useExt, true); assert.ok(Math.abs(r5.MLL - 0.7 * 3000) < 1e-9, 'M_LL = 0.7 × 3000: ' + r5.MLL);
  ok('custom table: 3 rows pasted from Excel; M_LL at midspan = 0.7 × 3000 = 2100 kip-ft');
  // 6. refused files
  await p.selectOption('#dm_src', 'midas'); await p.waitForTimeout(200); const t6 = JSON.stringify(await proj()); const nd = dialogs.length;
  await p.setInputFiles('#fDemands', fF); await until(async () => dialogs.length > nd, 5000, 'alert');
  assert.match(dialogs[dialogs.length - 1], /factored demands/); assert.equal(JSON.stringify(await proj()), t6);
  await itab('proj'); const n6 = dialogs.length; await p.setInputFiles('#fImport', fM); await until(async () => dialogs.length > n6, 5000, 'alert');
  assert.match(dialogs[dialogs.length - 1], /MIDAS demands file of the old app, not a design: load it for a girder type on the Loads tab/);
  ok('a factored file refused (project unchanged); a MIDAS file through Import JSON points to the Loads tab');
  // 7. 390 px
  await p.setViewportSize({ width: 390, height: 900 }); await itab('loads'); await p.waitForTimeout(300);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal page scroll');
  const shots = process.env.SHOTS; if (shots) { await p.setViewportSize({ width: 1400, height: 1000 }); await itab('loads'); await p.selectOption('#dm_src', 'midas'); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(shots, 'D1-loads-demands-card.png'), fullPage: false }); await otab('an'); await p.waitForTimeout(800);
    const el = await p.$('#anImported'); if (el) await el.scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(shots, 'D1-analysis-imported.png') }); }
  assert.deepEqual(errs, []);
  ok('390 px: no horizontal page scroll; 0 console errors');
  console.log(`\nps-bridge-demands: ${n} checks passed`);
} catch (e) { console.error('FAIL', e && e.stack || e); console.error(errs.join('\n')); process.exitCode = 1; }
finally { await b.close(); }
