#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), batch H: the Drawings tab's added sheets (ui/sheets.js, ui/drawings.js). Headless Chromium,
// file://, the CDN libraries from tests/libs.
//   1. a new project: every sheet of the set renders (an SVG preview with its title and "n OF N"); the cover lists every sheet;
//   2. H1: the general notes (editions, materials table), the design summary (one row per girder type and check group, the Summary tab's
//      values); the index links of the notes (Materials input tab) and of the summary (Summary output tab);
//   2b. H2: the analysis diagrams (titles, demand source), the bearing reactions (the Analysis tab's reactions of the line shown on it);
//   3. Download DXF passes SharedDxf.validate and holds the new sheets' titles; Print all sheets builds one page per sheet;
//   4. paper B: the set still renders (block sheets continued as "(i OF n)" when they need more room);
//   5. 0 console errors.
//   SHOTS=<dir> node tests/smoke/ps-bridge-drawings3.mjs   (screenshots h-*.png when SHOTS is set)
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/ps-bridge/index.html');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000 });
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
const dwg = async () => { await p.click('#tabBar [data-otab="dwg"]'); await p.waitForSelector('.dwg-box svg', { timeout: 60000 }); await p.waitForTimeout(300); };
const seed = async fn => { await p.evaluate(fn); await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); };
const sheet = async id => { await p.selectOption('#dwg_sheet', id); await p.waitForSelector('.dwg-box svg', { timeout: 30000 }); await p.waitForTimeout(250); return p.evaluate(() => [...document.querySelectorAll('.dwg-box svg text')].map(t => t.textContent)); };
const ids = () => p.evaluate(() => [...document.querySelectorAll('#dwg_sheet option')].map(o => [o.value, o.textContent]));
try {
  let r;
  await p.waitForSelector('#tabBar [data-otab]');
  await seed(() => { localStorage.clear(); const P = PSBModel.newProject(); P.project.name = 'Batch H sheets'; P.project.number = 'H-1'; P.project.owner = 'Town of Example'; localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  // 1. every sheet renders
  await dwg();
  const L = await ids(), N = L.length;
  for (const [id, lab] of L) { const t = await sheet(id), title = lab.replace(/^\d+\.\s*/, ''), no = +lab.split('.')[0];
    assert.ok(t.includes(title) && t.includes(`${no} OF ${N}`), `${id}: ${title}, ${no} OF ${N}`); }
  let t = await sheet('cover');
  L.forEach(([, lab]) => assert.ok(t.includes(lab.replace(/^\d+\.\s*/, '')), 'cover index: ' + lab));
  ok(`every sheet renders with its title and "n OF ${N}"; the cover lists all ${N}`);
  await shot('h1-cover');
  // 2. H1: notes and summary
  t = await sheet('notes');
  assert.ok(t.some(x => /10TH ED\. \(2024\)/.test(x)) && t.some(x => /4TH ED\. \(2026\)/.test(x)), 'editions');
  ['MATERIALS BY GIRDER TYPE (UNITS: SEE THE NOTES)', 'INTERIOR S1', 'EXTERIOR S1', '8.50', '6.80'].forEach(x => assert.ok(t.includes(x), x));
  await shot('h1-notes');
  t = await sheet('summ');
  ['DESIGN SUMMARY', 'GOVERNING CHECK OF EACH CHECK GROUP PER GIRDER TYPE', 'FLEXURE', 'SHEAR', 'RATING (HL-93 INVENTORY)'].forEach(x => assert.ok(t.includes(x), x));
  // the Summary tab's governing flexure ratio of the first type = the sheet's
  await p.click('#tabBar [data-otab="sum"]'); await p.waitForSelector('#sum-checks', { timeout: 60000 });
  const sumR = await p.evaluate(() => [...document.querySelectorAll('#sum-checks details')].map(d => [d.querySelector('summary b').textContent, [...d.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim()))]));
  await dwg(); t = await sheet('summ');
  sumR.forEach(([lab, rows]) => rows.forEach(r => assert.ok(t.includes(r[7]), `${lab} ${r[0]}: ratio ${r[7]} on the sheet`)));
  ok(`notes: the editions and each type's materials; summary: ${sumR.reduce((a, q) => a + q[1].length, 0)} governing ratios = the Summary tab's`);
  await shot('h1-summary');
  r = await p.evaluate(() => ({ n: [...document.querySelectorAll('.dwg-idx tr[data-dsheet="notes"] a')].map(a => a.dataset.dgi), s: [...document.querySelectorAll('.dwg-idx tr[data-dsheet="summ"] a')].map(a => a.dataset.dgo) }));
  assert.deepEqual(r, { n: ['proj', 'mat', 'loads', 'own'], s: ['sum'] });
  await p.click('.dwg-idx tr[data-dsheet="summ"] a[data-dgo="sum"]'); await p.waitForTimeout(500);
  assert.equal(await p.evaluate(() => document.querySelector('#tabBar [aria-selected=true]').dataset.otab), 'sum');
  ok('index links: the notes to the Project / Materials / Loads / Owner rules input tabs, the summary to the Summary tab');
  // 2b. H2: the analysis diagrams and the bearing reactions; the reactions of the line the Analysis tab shows = the sheet's
  t = await sheet('diag0');
  ['GIRDER INTERIOR S1: ANALYSIS DIAGRAMS'].forEach(x => assert.ok(t.includes(x), x)); assert.ok(t.some(x => /^MOMENT ENVELOPES/.test(x)) && t.some(x => /^SHEAR ENVELOPES/.test(x)) && t.some(x => /^DEMANDS: THIS APP'S ANALYSIS/.test(x)), 'diagram titles');
  await shot('h2-diagrams');
  await p.click('#tabBar [data-otab="an"]'); await p.waitForTimeout(800);
  const an = await p.evaluate(() => { const c = [...document.querySelectorAll('.card, section')].find(e => /Reactions \(unfactored, kip\)/.test(e.textContent) && e.querySelector('tbody'));
    return { g: (document.querySelector('#out').innerText.match(/girder line \((G\d+)/) || [])[1], rows: [...c.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim())) }; });
  await dwg(); t = await sheet('reac');
  assert.ok(t.includes('BEARING REACTIONS PER GIRDER LINE (KIP)'), 'reactions table');
  an.rows.forEach(r => [1, 2, 3].forEach(j => assert.ok(t.includes(r[j]), `reaction ${r[0]} ${r[j]} on the sheet`)));
  ok(`analysis diagrams sheet; bearing reactions: the Analysis tab's ${an.rows.length} support rows (${an.g || 'the line shown'}) on the sheet`);
  await shot('h2-reactions');
  r = await p.evaluate(() => ({ d: [...document.querySelectorAll('.dwg-idx tr[data-dsheet="diag0"] a')].map(a => a.dataset.dgo || a.dataset.dgi), r: [...document.querySelectorAll('.dwg-idx tr[data-dsheet="reac"] a')].map(a => a.dataset.dgo || a.dataset.dgi) }));
  assert.deepEqual(r, { d: ['an', 'loads'], r: ['an', 'proj'] });
  ok('index links: the diagrams and the reactions to the Analysis tab');
  // 3. DXF and Print all
  await dwg();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#dwg_dxf')]);
  const txt = fs.readFileSync(await dl.path(), 'utf8'), chk = await p.evaluate(x => { const c = SharedDxf.validate(x); return { ok: c.ok, errors: c.errors }; }, txt);
  assert.ok(chk.ok, chk.errors.join('; ')); ['COVER AND SHEET INDEX', 'GENERAL NOTES', 'DESIGN SUMMARY', 'BEARING REACTIONS', 'ANALYSIS DIAGRAMS', 'S-DIAG-STR'].forEach(x => assert.ok(txt.includes(x), x));
  const pages = await p.evaluate(() => { let got = null; const o = SharedDxf.printSheets; SharedDxf.printSheets = l => { got = l.length; }; document.getElementById('dwg_printAll').click(); SharedDxf.printSheets = o; return got; });
  assert.equal(pages, N);
  ok(`Download DXF valid with the new sheets; Print all sheets: ${pages} pages`);
  // 4. paper B
  await p.selectOption('#dwg_paper', 'B'); await p.waitForTimeout(500);
  const LB = await ids();
  for (const [id, lab] of LB.filter(([id]) => /^(cover|notes|summ)/.test(id))) { const tt = await sheet(id); assert.ok(tt.includes(lab.replace(/^\d+\.\s*/, '')), id); }
  ok(`paper B: ${LB.length} sheets (${LB.filter(([id]) => /^(cover|notes|summ)/.test(id)).map(q => q[0]).join(', ')} rendered)`);
  await shot('h1-summary-B');
  await p.selectOption('#dwg_paper', 'D'); await p.waitForTimeout(300);
  assert.deepEqual(errs, []);
  ok('0 console errors');
  console.log(`ps-bridge-drawings3: ${n} checks ok (0 console errors)`);
} finally { await b.close(); }
