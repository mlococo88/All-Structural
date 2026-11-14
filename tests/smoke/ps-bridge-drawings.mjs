#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), item 10 part 1: the Drawings tab (ui/drawings.js over ui/sheets.js and shared/dxf.js). Headless
// Chromium, file://, the CDN libraries from tests/libs.
//   1. a new project: the tab shows the sheet set (typical section, framing plan), the preview (SVG of the sheet with its title block),
//      the sheet index with its links; "Not in this set" names part 2;
//   2. a three-span continuous project with a curb and a sidewalk: one typical section per span + the plan; choosing a sheet in the
//      index draws it; paper B changes the scale; the choices are kept in psb2.ui (ui.dwg) after a reload;
//   3. Download DXF: the file passes SharedDxf.validate, its name from the project name, its sheets' titles in it;
//   4. the index links open the Loads & LLDF output tab and the Bridge layout input tab;
//   5. 390 px: no sideways scroll; every key written is psb2.*; 0 console errors.
//   SHOTS=<dir> node tests/smoke/ps-bridge-drawings.mjs   (screenshots pr10-*.png when SHOTS is set)
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/ps-bridge/index.html');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000 });
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
const dwg = async () => { await p.click('#tabBar [data-otab="dwg"]'); await p.waitForSelector('.dwg-box svg', { timeout: 20000 }); await p.waitForTimeout(300); };
const seed = async fn => { await p.evaluate(fn); await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); };
try {
  await p.waitForSelector('#tabBar [data-otab]');
  await seed(() => { localStorage.clear(); const P = PSBModel.newProject(); P.project.name = 'Route 9 over the Mill River'; P.project.number = 'B-123'; localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  // 1. a new project
  await dwg();
  let r = await p.evaluate(() => ({ opts: [...document.querySelectorAll('#dwg_sheet option')].map(o => o.textContent), idx: document.querySelectorAll('.dwg-idx tbody tr').length,
    txt: [...document.querySelectorAll('.dwg-box svg text')].map(t => t.textContent), miss: (document.querySelector('#out').innerText.match(/Not in this set:[^\n]*/) || [''])[0],
    links: [...document.querySelectorAll('.dwg-idx a')].map(a => a.dataset.dgo || a.dataset.dgi) }));
  assert.deepEqual(r.opts, ['1. TYPICAL SECTION', '2. FRAMING PLAN']); assert.equal(r.idx, 2);
  ['TYPICAL SECTION', '1 OF 2', 'ROUTE 9 OVER THE MILL RIVER', 'B-123', 'G1', 'G5'].forEach(t => assert.ok(r.txt.includes(t), t + ' in ' + r.txt.slice(0, 40).join('|')));
  assert.match(r.miss, /part 2/i); assert.deepEqual(r.links, ['lds', 'xsec', 'layout']);
  ok('a new project: typical section and framing plan, the preview with its title block, the index with its links, part 2 listed');
  await shot('pr10-dwg-section');
  await p.click('.dwg-idx tr[data-dsheet="plan"] td.lft'); await p.waitForTimeout(300);
  r = await p.evaluate(() => ({ sel: document.querySelector('#dwg_sheet').value, txt: [...document.querySelectorAll('.dwg-box svg text')].map(t => t.textContent) }));
  assert.equal(r.sel, 'plan'); ['FRAMING PLAN', '2 OF 2', 'ABUT. 1', 'ABUT. 2'].forEach(t => assert.ok(r.txt.includes(t), t));
  ok('the index row draws its sheet (the framing plan: Abut. 1, Abut. 2)');
  await shot('pr10-dwg-plan');

  // 2. three spans, continuous, skewed, curb and sidewalk
  await seed(() => { const P = PSBModel.newProject(); P.project.name = 'Three spans'; P.spans.lengths = [80, 110, 80]; P.spans.continuity = 'composite'; P.xs.skews = [15, 15, 15, 15];
    P.types = PSBBridge.newTypes(P); PSBBridge.syncSpans(P); Object.assign(P.xs.dl.barL, { type: 'curb', cw: 12, ch: 10, rw: 0.05, rp: 1 }); P.xs.dl.swR = { w: 6, t: 12 };
    localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  await dwg();
  r = await p.evaluate(() => [...document.querySelectorAll('#dwg_sheet option')].map(o => o.textContent));
  assert.deepEqual(r, ['1. TYPICAL SECTION, SPAN 1', '2. TYPICAL SECTION, SPAN 2', '3. TYPICAL SECTION, SPAN 3', '4. FRAMING PLAN']);
  const scale = () => p.evaluate(() => document.querySelector('.dwg-box').closest('.sec').querySelector('.secHead').textContent);
  await p.selectOption('#dwg_sheet', 'plan'); await p.waitForTimeout(300); const sD = await scale();
  await p.selectOption('#dwg_paper', 'B'); await p.waitForTimeout(300); const sB = await scale();
  assert.notEqual(sD, sB); assert.match(sB, /FRAMING PLAN/);
  await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForSelector('.dwg-box svg', { timeout: 20000 });
  assert.deepEqual(await p.evaluate(() => [document.querySelector('#dwg_paper').value, document.querySelector('#dwg_sheet').value, JSON.parse(localStorage.getItem('psb2.ui')).dwg.paper]), ['B', 'plan', 'B']);
  ok(`three spans: a section per span + the plan; paper B changes the scale (${sD.split('·')[1].trim()} -> ${sB.split('·')[1].trim()}); kept after a reload (psb2.ui)`);
  await shot('pr10-dwg-plan-3span-B');

  // 3. Download DXF
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#dwg_dxf')]);
  const f = await dl.path(), txt = fs.readFileSync(f, 'utf8'), chk = await p.evaluate(t => { const c = SharedDxf.validate(t); return { ok: c.ok, errors: c.errors, layers: c.layers }; }, txt);
  assert.equal(dl.suggestedFilename(), 'Three_spans_drawings.dxf'); assert.ok(chk.ok, chk.errors.join('; '));
  ['TYPICAL SECTION, SPAN 2', 'FRAMING PLAN', 'S-TBLK', 'S-GRDR'].forEach(t => assert.ok(txt.includes(t), t));
  ok('Download DXF: Three_spans_drawings.dxf passes the structure check (layers ' + chk.layers.join(', ') + ')');

  // 4. the links
  await p.click('.dwg-idx a[data-dgi="layout"]'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => document.querySelector('#inTabs [aria-selected=true]').dataset.itab), 'layout');
  await p.click('.dwg-idx a[data-dgo="lds"]'); await p.waitForTimeout(500);
  assert.equal(await p.evaluate(() => document.querySelector('#tabBar [aria-selected=true]').dataset.otab), 'lds');
  ok('the index links: the Bridge layout input tab, the Loads & LLDF output tab');

  // 5. phone width, keys, errors
  await p.setViewportSize({ width: 390, height: 844 }); await dwg();
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll');
  await shot('pr10-dwg-390');
  const keys = await p.evaluate(() => Object.keys(localStorage)); keys.forEach(k => assert.ok(k.startsWith('psb2.'), k));
  assert.deepEqual(errs, []);
  ok('390 px: no sideways scroll; keys psb2.* only (' + keys.sort().join(', ') + '); 0 console errors');
  console.log(`ps-bridge-drawings: ${n} checks ok (0 console errors)`);
} finally { await b.close(); }
