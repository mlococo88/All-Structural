#!/usr/bin/env node
// Browser smoke test of the Steel Bridge app's remaining fatigue life (MBE 4th Ed. Section 7; 2026-11-10), headless Chromium (tests/lib.mjs openPage):
//   1. A fresh project: the Fatigue & studs input tab shows "Evaluate remaining fatigue life" (no evaluation; the project has no fatigue.ev).
//   2. The button turns it on with the defaults ; the fields and the basis note show.
//   3. Fatigue & studs output tab, Example demands, Calculate: the "Remaining fatigue life" section, the Category E gusset finite with
//      Y_REM = 58.1 years, OK; its row opens the worked steps with the remaining-life topic. An entered value (g = 0) changes Y_REM to 86.3.
//   4. Summary and left column notes name the evaluation; the Report (Build) has the remaining-life subsection.
//   5. 390 px: no page-level horizontal scroll on the input and output tabs. 0 console errors.
//   node tests/smoke/steel-bridge-fatlife.mjs
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const t0 = Date.now();
// the tab runs itself when its results are out of date (#1260); else Calculate
const calc = async () => { await p.waitForTimeout(300); if (await p.$eval('#fa_calc', e => !!e.offsetParent).catch(() => false)) await p.click('#fa_calc'); await p.waitForFunction(() => document.getElementById('fa-ev') && !document.querySelector('#out .alert.stale:not([hidden])'), null, { timeout: 120000 }); };
const { b, p, errs } = await openPage(path.join(REPO, 'apps/steel-bridge/index.html'), { vw: 1440, vh: 1000 });
try {
  await p.click('#inTabs [data-itab="fs"]');
  await p.waitForSelector('#fev_on');
  console.log('  ok   fresh project: "Evaluate remaining fatigue life" shown, no evaluation');
  await p.click('#fev_on');
  await p.waitForSelector('[data-path="fatigue.ev.yearOpen"]');
  assert.match(await p.evaluate(() => document.querySelector('#inPanes [data-pane="fs"]').textContent), /MBE 4th Ed\. \(2026\) Section 7/);
  console.log('  ok   turned on: defaults, fields and basis note shown');
  await p.click('#tabBar [data-otab="fat"]');
  await p.waitForSelector('#fa_src'); await p.selectOption('#fa_src', 'example');
  await calc();
  const row = await p.evaluate(() => { const tr = [...document.querySelectorAll('#fa-ev tbody tr')].find(t => /gusset/.test(t.textContent)); return [...tr.cells].map(c => c.textContent.trim()); });
  assert.equal(row[6], 'finite'); assert.equal(row[8], '58.1'); assert.equal(row[9], 'OK');
  await p.evaluate(() => [...document.querySelectorAll('#fa-ev tbody tr')].find(t => /gusset/.test(t.textContent)).click());
  await p.waitForFunction(() => /Remaining fatigue life \(MBE 4th Ed\. Section 7\)/.test(document.getElementById('out').textContent) && /N_\{?av|Nav|initially available/.test(document.getElementById('out').textContent));
  console.log(`  ok   output tab: Category E gusset ${row.slice(6).join(' / ')}; its steps shown`);
  await p.click('#inTabs [data-itab="fs"]'); await p.fill('#i_fatigue\\.ev\\.g', '0'); await p.$eval('#i_fatigue\\.ev\\.g', e => e.blur());
  await p.click('#tabBar [data-otab="fat"]'); await calc();
  const y0 = await p.evaluate(() => [...[...document.querySelectorAll('#fa-ev tbody tr')].find(t => /gusset/.test(t.textContent)).cells][8].textContent.trim());
  assert.equal(y0, '86.3'); console.log('  ok   g = 0 entered: Y_REM 86.3 years');
  // Summary and the left column
  await p.click('#tabBar [data-otab="sum"]');
  await p.waitForFunction(() => /remaining fatigue life \(FA6, MBE 4th Ed\. Section 7/.test(document.getElementById('out').textContent), null, { timeout: 60000 });
  assert.match(await p.evaluate(() => document.getElementById('sbDashCol').textContent), /remaining fatigue life \(FA6, MBE 4th Ed\. Section 7\)/);
  console.log('  ok   Summary and left column notes');
  // Report
  await p.click('#tabBar [data-otab="rpt"]'); await p.waitForSelector('#rp_build'); await p.click('#rp_build');
  await p.waitForFunction(() => /Remaining fatigue life \(FA5, FA6; MBE 4th Ed\. Section 7\)/.test(document.getElementById('out').textContent), null, { timeout: 300000 });
  console.log('  ok   Report: remaining-life subsection');
  // 390 px
  await p.setViewportSize({ width: 390, height: 900 });
  for (const t of ['fat', 'rpt']) { await p.click(`#tabBar [data-otab="${t}"]`); await p.waitForTimeout(400); const w = await p.evaluate(() => document.documentElement.scrollWidth); assert.ok(w <= 390, `${t}: ${w} px`); }
  await p.click('#inTabs [data-itab="fs"]'); await p.waitForTimeout(300); assert.ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, 'input tab');
  console.log('  ok   390 px: no page-level horizontal scroll');
  assert.deepEqual(errs, [], 'console errors');
  console.log(`steel-bridge-fatlife: all passed, 0 console errors (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
} catch (e) { console.error('FAIL', e.message, errs); process.exitCode = 1; } finally { await b.close(); }
