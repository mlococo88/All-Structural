#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), the demand source of each girder type (Loads tab, Demands card): batch D1 (2026-11-15), and NOMCT
// (2026-11-25, engineer's request "no MCT input or output": the MIDAS file source removed; a saved MIDAS file converted to the custom table
// when exact, else kept read only). Headless Chromium, file://, CDN libraries from tests/libs.
//   1. a new project: every type "This app's analysis"; the output tabs' source line (green) says so; no P.demands written; the source
//      choice is This app's analysis / Custom table only; no file input, no import guide, no MCT in the header;
//   2. a project saved with a MIDAS file the table holds exactly (tests/engine/psbridge-midas-cases.mjs, the MCT Generator's 3-span file,
//      span 1): opened, the one-time notice "… were imported from a file; they are now a custom table with the same values"; the Loads tab
//      shows the custom table with its rows and the converted note; the stored file kept with the next save; reopened: no notice again;
//   3. a project saved with a MIDAS file the table cannot hold exactly (the file's span 120 ft on a bridge span of 122 ft): the notice to
//      re-enter, the read-only card, the source "Imported demands (from an earlier version, read only)"; "Use this app's analysis": the
//      choice is gone, the stored values kept;
//   4. a custom table (paste of 3 rows from Excel), the engine's M_LL at midspan = 0.7 × the entered M+ (DF 0.7);
//   5. a demands file through Import JSON refused, the project unchanged;
//   6. no MCT / MIDAS in anything shown (text, titles, labels) on every input and output tab, for the converted, the kept and the table
//      designs; the Hand-offs card: "Send section properties to LL & DL", no capacity send;
//   7. 390 px: no horizontal page scroll on the Loads tab; 0 console errors.
//   Screenshots (deviceScaleFactor 1) with SHOTS=<dir>: ps-no-mct.png (the Loads tab's Demands card and the header), ps-midas-migrated.png.
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/ps-bridge/index.html');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs, dialogs } = await openPage(FILE, { vw: 1400, vh: 1000, dsf: 1 });   // dialogs recorded and accepted (tests/lib.mjs)
const proj = async () => JSON.parse(await p.evaluate(() => localStorage.getItem('psb2.project.current')));
const itab = t => p.evaluate(t => document.querySelector(`#inTabs [data-itab="${t}"]`).click(), t);
const otab = t => p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t);
const out = () => p.evaluate(() => document.getElementById('out').textContent);
const R = () => p.evaluate(() => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, i = window.PSBDesign.inputs(P), R = window.PSBHoldDown.compute(i);
  return { useExt: R.useExt, MLL: R.MLL, sel: R.ext && R.ext.sel, L: R.L }; });
const until = async (f, ms, w) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + w); await new Promise(r => setTimeout(r, 100)); } };
const notices = () => p.evaluate(() => (document.getElementById('notices') || {}).innerText || '');
const change = (id, v) => p.evaluate(([id, v]) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
// the MIDAS fixtures, built in the page with its own model (the cases file is plain code: harness B evaluates it the same way)
const CASES_SRC = fs.readFileSync(path.join(REPO, 'tests/engine/psbridge-midas-cases.mjs'), 'utf8').replace(/^export /gm, '');
const FIX = { 'ps/midas_3span.json': JSON.parse(fs.readFileSync(path.join(REPO, 'tests/projects/ps/midas_3span.json'), 'utf8')), 'ext/mct_psbeam_selfweight_excluded.json': JSON.parse(fs.readFileSync(path.join(REPO, 'tests/projects/ext/mct_psbeam_selfweight_excluded.json'), 'utf8')) };
const savedProject = (which) => p.evaluate(([src, fix, which]) => {
  (0, eval)(src + '\nwindow.__MC = MIDAS_CASES; window.__MF = midasFixtures;');
  const F = window.__MF(rel => JSON.parse(JSON.stringify(fix[rel]))), C = window.__MC(() => window.PSBModel.defaultProject(), F);
  let P;
  if (which === 'kept') { P = window.PSBModel.defaultProject(); P.spans.lengths = [122]; P.demands = { T1: { src: 'midas', midas: { file: F.simple, name: 'simple120.json', at: '2026-11-15T12:00:00.000Z' } } }; }
  else P = C[which];
  window.PSBBridge.migrate(P);   // the girder types (as importJSON makes them); the demands as an earlier version saved them
  return JSON.stringify(P);
}, [CASES_SRC, FIX, which]);
const openSaved = async text => { await p.evaluate(t => { localStorage.setItem('psb2.project.current', t); }, text); await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(500); };
// every input and output tab: the text shown and the title / aria-label / placeholder / alt attributes
const ITABS = () => p.$$eval('#inTabs [data-itab]', bs => bs.map(x => x.dataset.itab)), OTABS = () => p.$$eval('#tabBar [data-otab]', bs => bs.map(x => x.dataset.otab));
const shown = () => p.evaluate(() => { const at = [...document.querySelectorAll('[title],[aria-label],[placeholder],[alt]')].map(e => ['title', 'aria-label', 'placeholder', 'alt'].map(a => e.getAttribute(a) || '').join(' '));
  return document.body.innerText + '\n' + at.join('\n') + '\n' + document.title; });
async function noMct(tag) {
  const bad = [];
  const chk = async where => { const t = await shown(), m = /mct|midas/i.exec(t); if (m) bad.push(`${where}: "${t.slice(Math.max(0, m.index - 70), m.index + 50).replace(/\s+/g, ' ')}"`); };
  for (const t of await ITABS()) { await itab(t); await p.waitForTimeout(150); await chk('input tab ' + t); }
  for (const t of await OTABS()) { await otab(t); await p.waitForTimeout(t === 'rpt' || t === 'sum' ? 2500 : 600); await chk('output tab ' + t); }
  // the Loads tab with each girder type in scope (the Demands card of that type)
  await itab('loads'); const ids = await p.$$eval('#tyScope_loads option', o => o.map(x => x.value).filter(Boolean)).catch(() => []);
  for (const id of ids) { await p.selectOption('#tyScope_loads', id); await p.waitForTimeout(250); await chk('Loads tab, type ' + id); }
  if (ids.length) await p.selectOption('#tyScope_loads', '');
  assert.deepEqual(bad, [], tag);
}
try {
  await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(400);
  // 1.
  await change('i_project.checker', 'd1');
  await itab('loads'); await p.waitForSelector('#card-dem');
  assert.match(await p.$eval('#card-dem', e => e.innerText), /This app's analysis/);
  await otab('an'); await until(async () => /kip/.test(await out()), 20000, 'Analysis');
  assert.match(await p.$eval('#dmSrcBar', e => e.innerText), /Demands: This app's analysis/); assert.equal(await p.$eval('#dmSrcBar', e => e.classList.contains('ex')), false);
  const before = await R(); assert.equal(before.useExt, false); assert.equal('demands' in await proj(), false);
  const T1 = (await proj()).types[0];
  await itab('loads'); await p.selectOption('#tyScope_loads', T1.id); await p.waitForSelector('#dm_src');
  assert.deepEqual(await p.$$eval('#dm_src option', o => o.map(x => x.value)), ['app', 'table']);
  assert.equal(await p.locator('#fDemands').count(), 0); assert.equal(await p.locator('[data-dm="guide"]').count(), 0); assert.equal(await p.locator('#bMct').count(), 0);
  assert.ok(!/mct|midas/i.test(await p.innerText('#hdr')));
  if (process.env.SHOTS) { await p.evaluate(() => document.getElementById('card-dem').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(process.env.SHOTS, 'ps-no-mct.png') }); }
  await p.selectOption('#tyScope_loads', '');
  ok('new project: this app\'s analysis; the source line (green); no P.demands; the choice This app / Custom table only; no file input, guide or MCT header button');
  // 2. a saved MIDAS file the custom table holds exactly
  const tConv = await savedProject('MIDAS 110/140/110 (MCT Generator file), span 1, exterior G1, made continuous, m 1.2');
  await openSaved(tConv);
  await until(async () => /were imported from a file; they are now a custom table with the same values/.test(await notices()), 10000, 'the migration notice');
  assert.ok(!/mct|midas/i.test(await notices()), 'the notice names no MCT');
  if (process.env.SHOTS) await p.screenshot({ path: path.join(process.env.SHOTS, 'ps-midas-migrated.png') });
  const PC = JSON.parse(tConv), TC = PC.types.find(t => t.id in PC.demands) || PC.types[0];
  await itab('loads'); await p.selectOption('#tyScope_loads', TC.id); await p.waitForSelector('#dmTable');
  assert.equal(await p.$eval('#dm_src', e => e.value), 'table'); assert.ok(await p.$('#dmConverted'), 'the converted note');
  const nRows = await p.$$eval('#dmTable tbody tr', r => r.length); assert.ok(nRows >= 10, 'rows ' + nRows);
  const rc = await R(); assert.equal(rc.useExt, true); assert.equal(rc.sel.idx, 1);
  await change('i_project.checker', 'd2');
  const S2 = await proj(); assert.equal(S2.demands[TC.id].src, 'table'); assert.deepEqual(S2.demands[TC.id].midas, PC.demands[TC.id].midas, 'the stored file kept'); assert.equal(S2.demands[TC.id].table.rows.length, nRows);
  await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(600);
  assert.ok(!/were imported from a file/.test(await notices()), 'no notice the second time');
  ok(`saved MIDAS file (exact): the notice once; the custom table (${nRows} rows) with the converted note; the stored file kept`);
  await noMct('converted design'); ok('converted design: no MCT / MIDAS on any input or output tab');
  // 3. a saved MIDAS file the table cannot hold exactly: kept read only
  const tKept = await savedProject('kept'); await openSaved(tKept);
  await until(async () => /kept from an earlier version/.test(await notices()), 10000, 'the kept notice');
  const PK = JSON.parse(tKept), TK = PK.types[0];
  await itab('loads'); await p.selectOption('#tyScope_loads', TK.id); await p.waitForSelector('#dmKept');
  assert.equal(await p.$eval('#dm_src', e => e.value), 'midas');
  assert.deepEqual(await p.$$eval('#dm_src option', o => o.map(x => x.textContent)), ['This app\'s analysis (built-in)', 'Custom table (entered)', 'Imported demands (from an earlier version, read only)']);
  assert.match(await p.$eval('#dmKept', e => e.innerText), /Re-enter the demands as a custom table or choose this app's analysis/);
  assert.match(await p.$eval('#card-dem', e => e.innerText), /span 1 of the imported demands is 120\.00 ft long but span 1 of the bridge is 122\.00 ft/);
  await noMct('kept design'); ok('kept design: the notice, the read-only card; no MCT / MIDAS on any input or output tab');
  await itab('loads'); await p.selectOption('#tyScope_loads', TK.id); await p.waitForSelector('#dmKept');
  await p.click('#dmKept [data-dm="app"]'); await p.waitForTimeout(400);
  assert.deepEqual(await p.$$eval('#dm_src option', o => o.map(x => x.value)), ['app', 'table'], 'not offered again');
  const SK = await proj(); assert.equal(SK.demands[TK.id].src, 'app'); assert.deepEqual(SK.demands[TK.id].midas, PK.demands[TK.id].midas, 'kept');
  ok('"Use this app\'s analysis": the read-only source is no longer offered; the stored values kept');
  // 4. custom table (paste from Excel)
  await itab('layout'); await change('i_spans.lengths', '110'); await p.waitForTimeout(300);
  await itab('loads'); await p.selectOption('#tyScope_loads', TK.id); await p.waitForSelector('#dm_src');
  await p.selectOption('#dm_src', 'table'); await p.waitForSelector('#dmTable');
  await p.evaluate(() => { const el = document.querySelector('#dmTable input[data-j="0"][data-c="x"]'); const dt = new DataTransfer();
    dt.setData('text/plain', '0\t0\t0\t0\t0\t20\t15\t110\t-10\n55\t500\t400\t3000\t0\t0\t0\t60\t-60\n110\t0\t0\t0\t0\t-20\t-15\t10\t-110');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  await p.waitForTimeout(300);
  await change('i_base.loads.extDFpos', '0.7'); await p.waitForTimeout(300);
  const P5 = await proj(); assert.equal(P5.demands[TK.id].table.rows.length, 3);
  const r5 = await R(); assert.equal(r5.useExt, true); assert.ok(Math.abs(r5.MLL - 0.7 * 3000) < 1e-9, 'M_LL = 0.7 × 3000: ' + r5.MLL);
  ok('custom table: 3 rows pasted from Excel; M_LL at midspan = 0.7 × 3000 = 2100 kip-ft');
  await noMct('custom table design'); ok('custom table design: no MCT / MIDAS on any input or output tab');
  // the Hand-offs card: the section properties for LL & DL only; no capacity send
  await itab('proj'); await p.waitForSelector('#psbHo');
  assert.equal(await p.innerText('#psbHo [data-ho="secSend"]'), 'Send section properties to LL & DL'); assert.equal(await p.locator('#psbHo [data-ho="capSend"]').count(), 0);
  assert.ok(!/MCT/i.test(await p.getAttribute('#psbHo [data-ho="secSend"]', 'title')));
  ok('Hand-offs card: "Send section properties to LL & DL" (LL & DL in its tooltip); no capacity send');
  // 5. a demands file through Import JSON refused
  const t6 = JSON.stringify(await proj()), n6 = dialogs.length, dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'psbd1-')), fM = path.join(dir, 'mct.json');
  fs.writeFileSync(fM, JSON.stringify(FIX['ext/mct_psbeam_selfweight_excluded.json']));
  await p.setInputFiles('#fImport', fM); await until(async () => dialogs.length > n6, 5000, 'alert');
  assert.match(dialogs[dialogs.length - 1], /demands file of the old app \(psbeam-external-demands\), not a design: this app does not import demands files/); assert.ok(!/mct|midas/i.test(dialogs[dialogs.length - 1]));
  assert.equal(JSON.stringify(await proj()), t6); fs.rmSync(dir, { recursive: true, force: true });
  ok('a demands file through Import JSON refused (no MCT / MIDAS in the message), the project unchanged');
  // 7. 390 px
  await p.setViewportSize({ width: 390, height: 900 }); await itab('loads'); await p.waitForTimeout(300);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal page scroll');
  assert.deepEqual(errs, []);
  ok('390 px: no horizontal page scroll; 0 console errors');
  console.log(`\nps-bridge-demands: ${n} checks passed`);
} catch (e) { console.error('FAIL', e && e.stack || e); console.error(errs.join('\n')); process.exitCode = 1; }
finally { await b.close(); }
