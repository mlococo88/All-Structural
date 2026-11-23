#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), batch C (2026-11-15, display only): the tables the steel app has.
// Headless Chromium, file://, the CDN libraries from tests/libs.
//   1. Loads & LLDF: "Dead loads and distribution factors of every girder line": a row per girder line (5 on the new project), the line shown
//      marked; a § opens the Loads & LLDF tab with that girder type and line at the step (here G4's DF_M);
//   2. Analysis: the girder elevation, "Loads and factors used", "Reactions (unfactored, kip)" (DC1 = (w_g + w_DC1) L / 2 worked);
//   3. Report: the Detail choice "every station" lists every engine station in the Analysis table (63 rows); §1 has the girder elevations
//      as figures; the default detail as before;
//   4. 390 px: no sideways scroll; 0 console errors.
//   SHOTS=<dir> node tests/smoke/ps-bridge-tables.mjs
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/ps-bridge/index.html');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1600, vh: 1400 });
const shot = async (nm, full) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png'), fullPage: !!full }); } };
const tab = async t => { await p.click(`#tabBar [data-otab="${t}"]`); await p.waitForTimeout(800); };
const card = (title) => p.evaluate(t => { const c = [...document.querySelectorAll('#out section.sec')].find(s => s.querySelector('.secHead') && s.querySelector('.secHead').textContent.startsWith(t)); return c ? c.innerText : null; }, title);
try {
  await p.waitForSelector('#tabBar [data-otab]');
  await p.evaluate(() => { localStorage.clear(); const P = PSBModel.newProject(); localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  await p.reload(); await p.waitForSelector('#tabBar [data-otab]');
  await tab('sum'); await p.waitForSelector('#sum-table', { timeout: 30000 });
  // 1.
  await tab('lds');
  let t = await card('Dead loads and distribution factors of every girder line');
  assert.ok(t, 'card'); const rows = t.split('\n').filter(l => /^1\tG\d/.test(l)); assert.equal(rows.length, 5, t.slice(0, 400));
  assert.ok(rows.some(l => /G2 \(shown\)/.test(l)), 'the line shown marked');
  await p.click('#out a[data-sumgo^="1|5|lds|ld.dfm"]'); await p.waitForTimeout(800);
  let r = await p.evaluate(() => ({ line: document.querySelector('#tyOutL option:checked').value, step: !!document.getElementById('st-ld.dfm') && document.getElementById('st-ld.dfm').offsetParent !== null, tab: document.querySelector('#tabBar [aria-selected=true]').dataset.otab }));
  assert.deepEqual(r, { line: '5', step: true, tab: 'lds' });
  ok('Loads & LLDF: dead loads and LLDF of every girder line (5 rows, G2 shown marked); a § opened Exterior S1 on G5 at its DF_M step');
  await shot('tbl-loads');
  // 2.
  await p.selectOption('#tyOutL', '1'); await p.waitForTimeout(400); await p.selectOption('#tyOutT', { index: 0 }); await p.waitForTimeout(400);
  await tab('an');
  const used = await card('Loads and factors used'), rx = await card('Reactions (unfactored, kip)');
  assert.ok(used && /w_?g|DC1 girder/.test(used) && /DF/.test(used), used); assert.ok(rx && /Support 1 \(x = 0\.00 ft\)/.test(rx) && /DC1 at Support 1 = \(wg \+ wDC1\) L \/ 2/.test(rx.replace(/\s+/g, ' ')), rx);
  r = await p.evaluate(() => { const f = document.getElementById('anElev'); return f ? [...f.querySelectorAll('svg text')].map(x => x.textContent).join('|') : null; });
  assert.ok(r && /Span 1: L = 120\.00 ft/.test(r), r);
  ok('Analysis: girder elevation, "Loads and factors used", reactions per support with DC1 worked');
  await shot('tbl-analysis');
  // 3.
  await tab('rpt'); await p.waitForSelector('.rp-doc', { timeout: 60000 }); await p.waitForTimeout(800);
  const anRows = () => p.evaluate(() => { const s = [...document.querySelectorAll('.rp-doc h2, .rp-doc h3')].find(h => /Force effects along the girder/.test(h.textContent)); let e = s; while (e && !(e.tagName === 'TABLE' || (e.querySelector && e.querySelector('table')))) e = e.nextElementSibling; const tb = e && (e.tagName === 'TABLE' ? e : e.querySelector('table')); return tb ? tb.querySelectorAll('tbody tr').length : -1; });
  const n0 = await anRows();
  r = await p.evaluate(() => ({ figs: [...document.querySelectorAll('.rp-doc figcaption, .rp-doc .rp-fig-cap')].map(f => f.textContent).filter(t => /^Figure 2\.\d+: Girder elevation/.test(t)).length, detail: !!document.querySelector('[data-rpdetail="all"]') }));
  assert.ok(r.figs >= 1 && r.detail, JSON.stringify(r));
  await p.click('[data-rpdetail="all"]'); await p.waitForTimeout(2500);
  const n1 = await anRows();
  assert.ok(n0 > 0 && n0 < 63 && n1 === 63, `${n0} -> ${n1}`);
  await p.click('[data-rpdetail="tab"]'); await p.waitForTimeout(2000); assert.equal(await anRows(), n0);
  ok(`Report: §1 girder elevation figures (${r.figs}); Detail "every station": the Analysis table ${n0} -> 63 rows (every engine station), back to ${n0}`);
  await shot('tbl-report');
  // 4.
  await p.setViewportSize({ width: 390, height: 844 }); await tab('lds'); await p.waitForTimeout(400);
  const sx = await p.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth); assert.ok(sx <= 0, 'sideways ' + sx);
  await tab('an'); await p.waitForTimeout(400); assert.ok(await p.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth) <= 0);
  ok('390 px: Loads & LLDF and Analysis without sideways scroll');
  assert.deepEqual(errs, [], 'console errors: ' + errs.join(' | '));
  ok('0 console errors');
  console.log(`ps-bridge-tables: ${n} checks ok (0 console errors)`);
} catch (e) { console.error('FAIL', e && e.stack || e); console.error('console errors:', errs); process.exitCode = 1; }
finally { await b.close(); }
