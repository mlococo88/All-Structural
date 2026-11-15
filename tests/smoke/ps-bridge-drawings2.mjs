#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), item B: the Drawings tab, part 2 (ui/sheets.js elevation / strands / schedule, ui/drawings.js).
// Headless Chromium, file://, the CDN libraries from tests/libs.
//   1. a new project: each girder type's elevation and strand pattern sheets and the schedule are in the sheet list and index; each sheet's
//      preview holds its title, title block and key texts (CL BRG, hold-down dimensions from ℄ bearing and from the girder end, the sections
//      at ℄ bearing and at midspan, the schedule's header and one row per type); "Not in this set" is gone;
//   2. the index links of a girder sheet open the Girders & strands input tab and the Camber & deflection output tab;
//   3. Download DXF passes SharedDxf.validate with the part 2 layers (S-STRD, S-STRD-DRAPE, S-TBL); Print all sheets builds one page per sheet;
//   4. a box beam project with debonded rows and no draped strands: its strand pattern sheet names the debonded strands; no hold-down;
//   5. 390 px: no sideways scroll; psb2.* keys only; 0 console errors.
//   SHOTS=<dir> node tests/smoke/ps-bridge-drawings2.mjs   (screenshots dwg2-*.png when SHOTS is set)
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/ps-bridge/index.html');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000 });
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
const dwg = async () => { await p.click('#tabBar [data-otab="dwg"]'); await p.waitForSelector('.dwg-box svg', { timeout: 30000 }); await p.waitForTimeout(300); };
const seed = async fn => { await p.evaluate(fn); await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); };
const sheet = async id => { await p.selectOption('#dwg_sheet', id); await p.waitForTimeout(400); return p.evaluate(() => [...document.querySelectorAll('.dwg-box svg text')].map(t => t.textContent)); };
try {
  await p.waitForSelector('#tabBar [data-otab]');
  await seed(() => { localStorage.clear(); const P = PSBModel.newProject(); P.project.name = 'Girder sheets'; P.project.number = 'B-2'; localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  // 1.
  await dwg();
  let r = await p.evaluate(() => ({ opts: [...document.querySelectorAll('#dwg_sheet option')].map(o => o.value), miss: /Not in this set/.test(document.getElementById('out').innerText) }));
  assert.deepEqual(r.opts, ['cover', 'notes', 'sec', 'plan', 'elev0', 'strd0', 'elev1', 'strd1', 'sched', 'summ']); assert.equal(r.miss, false);   // batch H1: cover, notes, summary
  let t = await sheet('elev0');
  ['GIRDER INTERIOR S1: ELEVATION', '5 OF 10', 'CL BRG', 'MIDSPAN'].forEach(x => assert.ok(t.includes(x), x + ' | ' + t.slice(0, 30).join('|')));
  assert.ok(t.some(x => /^HOLD-DOWN .* FROM CL BRG$/.test(x)) && t.some(x => / FROM GIRDER END$/.test(x)) && t.some(x => /^CL BRG TO CL BRG 120'-0"$/.test(x)), 'the hold-down and span dimensions');
  assert.ok(t.some(x => /CAMBER AT MIDSPAN/.test(x)) && t.some(x => /DRAPED, Y END/.test(x)), 'camber and draped notes');
  ok('elevation sheet of Interior S1: CL BRG, midspan, hold-down from CL BRG and from the girder end (PS-13), CL BRG to CL BRG 120\'-0", camber');
  await shot('dwg2-elevation');
  t = await sheet('strd0');
  ['GIRDER INTERIOR S1: STRAND PATTERN', 'SECTION AT CL BEARING (GIRDER END)', 'SECTION AT MIDSPAN'].forEach(x => assert.ok(t.includes(x), x));
  assert.ok(t.some(x => /^Y END = /.test(x)) && t.some(x => /^Y MID = /.test(x)) && t.some(x => /^H = 6'-0"$/.test(x)), 'the y_end, y_mid and depth dimensions');
  assert.ok(t.some(x => /28 BONDED, 12 DRAPED \(40 STRANDS\)/.test(x)), 'the strand counts');
  ok('strand pattern sheet of Interior S1: the sections at CL bearing and midspan, Y END / Y MID / H dimensions, 28 bonded + 12 draped = 40');
  await shot('dwg2-strands');
  t = await sheet('sched');
  ['STRAND AND GIRDER SCHEDULE', 'TYPE', 'INTERIOR S1', 'EXTERIOR S1', 'PCI BT-72'].forEach(x => assert.ok(t.includes(x), x + ' | ' + t.slice(0, 40).join('|')));
  ok('schedule: header and one row per girder type');
  await shot('dwg2-schedule');
  // 2.
  await sheet('elev0');
  r = await p.evaluate(() => [...document.querySelectorAll('.dwg-idx tr[data-dsheet="elev0"] a')].map(a => a.dataset.dgo || a.dataset.dgi));
  assert.deepEqual(r, ['gird', 'camb', 'end']);
  await p.click('.dwg-idx tr[data-dsheet="elev0"] a[data-dgo="camb"]'); await p.waitForTimeout(500);
  assert.equal(await p.evaluate(() => document.querySelector('#tabBar [aria-selected=true]').dataset.otab), 'camb');
  await dwg(); await p.click('.dwg-idx tr[data-dsheet="strd0"] a[data-dgi="gird"]'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => document.querySelector('#inTabs [aria-selected=true]').dataset.itab), 'gird');
  ok('index links: Girders & strands input tab, Camber & deflection tab, End zone & hold-down tab');
  // 3.
  await dwg();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#dwg_dxf')]);
  const txt = fs.readFileSync(await dl.path(), 'utf8'), chk = await p.evaluate(x => { const c = SharedDxf.validate(x); return { ok: c.ok, errors: c.errors, layers: c.layers }; }, txt);
  assert.ok(chk.ok, chk.errors.join('; ')); ['S-STRD', 'S-STRD-DRAPE', 'S-TBL'].forEach(l => assert.ok(chk.layers.includes(l), l));
  ['GIRDER EXTERIOR S1: STRAND PATTERN', 'STRAND AND GIRDER SCHEDULE'].forEach(x => assert.ok(txt.includes(x), x));
  const pages = await p.evaluate(() => { let got = null; const o = SharedDxf.printSheets; SharedDxf.printSheets = l => { got = l.length; }; document.getElementById('dwg_printAll').click(); SharedDxf.printSheets = o; return got; });
  assert.equal(pages, 10);
  ok(`Download DXF: valid, layers ${chk.layers.join(', ')}; Print all sheets: ${pages} pages`);
  // 4. box beams, debonded, no draped strands
  await seed(() => { const P = PSBModel.newProject(); P.base.girder = 'AASHTO BIII-36 (39in)'; P.base.ts = 6; P.base.harp.n = 0; P.base.rows = [{ n: 16, y: 2, nd: 4, dbnd: 8 }, { n: 4, y: 37, nd: 0, dbnd: 0 }];
    P.xs.bays = [3, 3, 3, 3]; P.xs.ohL = 1.5; P.xs.ohR = 1.5; P.spans.lengths = [70]; localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  await dwg(); t = await sheet('strd0');
  assert.ok(t.some(x => /12 BONDED, 4 DEBONDED \(20 STRANDS\)/.test(x)) || t.some(x => /16 BONDED, 4 DEBONDED/.test(x)), 'debonded at the end: ' + t.filter(x => /BONDED/.test(x)).join('|'));
  t = await sheet('elev0'); assert.ok(!t.some(x => /^HOLD-DOWN .* FROM CL BRG$/.test(x)) && t.some(x => /4 DEBONDED 8\.00 FT/.test(x)), 'no hold-down; the debonded row named');
  ok('box beams with a debonded row and no draped strands: the end section names the debonded strands; the elevation has no hold-down');
  await shot('dwg2-box-strands');
  // 5.
  await p.setViewportSize({ width: 390, height: 844 }); await dwg();
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll');
  await shot('dwg2-390');
  const keys = await p.evaluate(() => Object.keys(localStorage)); keys.forEach(k => assert.ok(k.startsWith('psb2.'), k));
  assert.deepEqual(errs, []);
  ok('390 px: no sideways scroll; keys psb2.* only; 0 console errors');
  console.log(`ps-bridge-drawings2: ${n} checks ok (0 console errors)`);
} finally { await b.close(); }
