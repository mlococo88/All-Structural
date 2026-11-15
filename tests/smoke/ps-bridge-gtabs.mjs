#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html) batch G4 (2026-11-15), headless Chromium, file://: the Compare output tab (the old app's design sweep):
//   Run sweep (span): 5 rows, this design marked, the bar graphic; Vary = Girder section: one row per library section with the Strand fit
//   column; the choice kept in psb2.ui after a reload; nothing in the project changes.
//   Batch G6: the Nomenclature output tab: ≥ 80 rows with values; the search box filters ("transfer" → ℓ_t only); a § link opens the worked
//   step on its tab. 0 console errors.
//   node tests/smoke/ps-bridge-gtabs.mjs [--shots <dir>]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shots = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--shots'));
let n = 0; const ok = m => { n++; console.log('  ok  ', m); }; const t0 = Date.now();
const { b, p, errs } = await openPage(path.join(REPO, 'apps/ps-bridge/index.html'), { vw: 1400, vh: 1000 });
const ready = () => p.waitForFunction(() => window.PSBUiCompare && document.getElementById('out').innerText.length > 50, null, { timeout: 120000 });
try {
  await ready();
  const proj0 = await p.evaluate(() => localStorage.getItem('psb2.project.current'));
  await p.click('#tabBar [data-otab="cmp"]'); await p.waitForSelector('#cmpRun');
  assert.ok(await p.locator('#cmpNone').count()); ok('Compare tab: Vary, Run sweep, nothing run yet');
  await p.click('#cmpRun'); await p.waitForSelector('#cmpTbl');
  const r1 = await p.evaluate(() => ({ n: document.querySelectorAll('#cmpTbl tbody tr').length, cur: document.querySelector('#cmpTbl tr.sel td').textContent, bars: document.querySelectorAll('#gfx_cmp svg rect').length }));
  assert.equal(r1.n, 5); assert.match(r1.cur, /120\.0 ft \(this design\)/); assert.ok(r1.bars >= 5);
  ok(`span sweep: ${r1.n} rows, "${r1.cur}" marked, bar graphic drawn`);
  if (shots) await p.locator('#out').screenshot({ path: path.join(shots, 'G4-compare-span.png') });
  await p.selectOption('#o_cmpMode', 'girder'); await p.waitForTimeout(300);
  assert.ok(await p.locator('#cmpStale').count(), 'the span result marked as another mode');
  await p.click('#cmpRun'); await p.waitForFunction(() => document.querySelector('#cmpTbl th.lft:nth-last-child(2)') && /Strand fit/.test(document.querySelector('#cmpTbl thead').textContent), null, { timeout: 60000 });
  const r2 = await p.evaluate(() => ({ n: document.querySelectorAll('#cmpTbl tbody tr').length, nG: Object.keys(GIRDERS).filter(k => k !== 'Custom').length, fitBad: [...document.querySelectorAll('#cmpTbl tbody tr')].filter(t => /error/.test(t.children[t.children.length - 2].textContent)).length }));
  assert.equal(r2.n, r2.nG); assert.ok(r2.fitBad > 0);
  ok(`girder sweep: ${r2.n} sections, ${r2.fitBad} with strand-fit errors`);
  if (shots) await p.locator('#card-cmpres').screenshot({ path: path.join(shots, 'G4-compare-girder.png') });
  await p.reload(); await ready(); await p.click('#tabBar [data-otab="cmp"]'); await p.waitForSelector('#o_cmpMode');
  assert.equal(await p.inputValue('#o_cmpMode'), 'girder'); ok('Vary kept after a reload (psb2.ui)');
  assert.equal(await p.evaluate(() => localStorage.getItem('psb2.project.current')), proj0, 'the project is not changed'); ok('the project is not changed');
  await p.click('#tabBar [data-otab="nom"]'); await p.waitForSelector('#nmTbl');
  const nm = await p.evaluate(() => ({ n: document.querySelectorAll('#nmTbl tr[data-nm]').length, empty: [...document.querySelectorAll('#nmTbl tr[data-nm]')].filter(r => r.children[3].textContent.trim() === '—').map(r => r.children[1].textContent) }));
  assert.ok(nm.n >= 80, 'rows ' + nm.n); assert.deepEqual(nm.empty, []); ok(`Nomenclature: ${nm.n} symbols, each with a value`);
  if (shots) await p.locator('#card-nom').screenshot({ path: path.join(shots, 'G6-nomenclature.png') });
  await p.fill('#o_nmQ', 'transfer length'); await p.waitForTimeout(200);
  const vis = await p.evaluate(() => [...document.querySelectorAll('#nmTbl tr[data-nm]')].filter(r => !r.hidden).map(r => r.children[0].textContent));
  assert.deepEqual(vis, ['ℓt']); assert.match(await p.textContent('#nmCount'), /^1 of \d+ shown$/); ok('search "transfer length": ℓt only');
  if (shots) await p.locator('#card-nom').screenshot({ path: path.join(shots, 'G6-nomenclature-search.png') });
  await p.click('#nmTbl tr[data-nm]:not([hidden]) a.wk'); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => document.querySelector('#tabBar [aria-selected="true"]').dataset.otab), 'sec');
  assert.ok(await p.evaluate(() => { const li = document.getElementById('st-sec.lt'); return !!li && li.closest('details').open; })); ok('the § link opens the worked step sec.lt on the Section properties tab');
  assert.deepEqual(errs, []); ok('0 console errors');
  console.log(`ps-bridge-gtabs: ${n} checks passed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} finally { await b.close(); }
