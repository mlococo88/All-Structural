#!/usr/bin/env node
// Browser smoke test of the paths PR (2026-10-30): apps/steel-bridge/index.html with the built-in project, headless Chromium
// (tests/lib.mjs openPage):
//   1. one analysis cache for every output tab: Flexure, Rating, Shear & stiffeners, Fatigue & studs and Welds calculate on one
//      full analysis (report/data.js cache: one entry), Constructibility adds the dead-load run; switching back runs nothing;
//   2. the Welds tab has the demand line and the source selector; f_ℓ entered on the Flexure tab is saved (P.flexure.fl);
//   3. the Report tab (selected girder) has the Welds section.
//   0 console errors, 0 .katex-error.
//   node tests/smoke/steel-bridge-paths.mjs
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const t0 = Date.now();
const { b, p, errs, blocked } = await openPage(path.join(REPO, 'apps/steel-bridge/index.html'), { vw: 1400, vh: 1000 });
try {
  await p.waitForSelector('#tabBar [data-otab="flex"]');
  assert.equal(await p.evaluate(() => window.SBDAnalysis.analyzeGirder.cached === true), true, 'the cache is installed');
  const size = () => p.evaluate(() => window.SBDReportData.cache.size);
  const calc = async (tab, btn, sel) => { await p.click(`#tabBar [data-otab="${tab}"]`); await p.click(btn); await p.waitForSelector(sel, { timeout: 180000, state: 'attached' }); const er = await p.$eval('#out', o => (o.querySelector('.alert.err') || {}).textContent || ''); assert.equal(er, '', tab + ': ' + er); };
  const t1 = Date.now(); await calc('flex', '#fx_calc', '#out .fx-list tr[data-fx]'); const tFlex = Date.now() - t1;
  assert.equal(await size(), 1);
  const t2 = Date.now();
  await calc('rt', '#rt_calc', '#out .rt-box'); await calc('shear', '#sh_calc', '#out .alert.stale[hidden]'); await calc('fat', '#fa_calc', '#out .alert.stale[hidden]'); await calc('wt', '#wt_calc', '#out .alert.stale[hidden]');
  const tOthers = Date.now() - t2;
  assert.equal(await size(), 1, 'Rating, Shear, Fatigue and Welds took the cached analysis');
  await calc('cn', '#cn_calc', '#out .cn-list'); assert.equal(await size(), 2, 'Constructibility: the dead-load analysis');
  await calc('flex', '#fx_calc', '#out .fx-list tr[data-fx]'); assert.equal(await size(), 2, 'back to Flexure: no new analysis');
  // Welds: the demand line and the selector
  await p.click('#tabBar [data-otab="wt"]');
  const wbar = await p.evaluate(() => ({ bar: document.querySelector('#out .srcBar').innerText.trim(), opts: [...document.querySelectorAll('#wt_src option')].map(o => o.value) }));
  assert.match(wbar.bar, /^Demands: This project's analysis/); assert.deepEqual(wbar.opts, ['analysis', 'file']);
  // Flexure: f_ℓ entered is saved
  await p.click('#tabBar [data-otab="flex"]');
  await p.fill('#fx_fl', '2.5'); await p.dispatchEvent('#fx_fl', 'change'); await p.waitForTimeout(300);
  const fl = await p.evaluate(() => (JSON.parse(localStorage.getItem('sbd2.project.current') || '{}').flexure || {}).fl);
  assert.equal(fl, 2.5);
  await p.fill('#fx_fl', ''); await p.dispatchEvent('#fx_fl', 'change'); await p.waitForTimeout(300);
  // Report (selected girder): the Welds section
  await p.click('#tabBar [data-otab="rpt"]');
  if (await p.$('#rp_scope')) await p.selectOption('#rp_scope', 'girder');
  await p.click('#rp_build');
  await p.waitForSelector('.rp-doc .rp-h1', { timeout: 180000 });
  const rp = await p.evaluate(() => ({ secs: [...document.querySelectorAll('.rp-doc .rp-h1')].map(h => h.textContent.trim()), kErr: document.querySelectorAll('.rp-doc .katex-error').length, text: document.querySelector('.rp-doc').innerText }));
  assert.ok(rp.secs.some(s => /Welds/.test(s)), rp.secs.join(' | ')); assert.equal(rp.kErr, 0); assert.ok(!/NaN|undefined|\[object/.test(rp.text), 'bad text');
  assert.equal(await size(), 2, 'the report took the cached analyses');
  assert.deepEqual(errs, [], 'console errors');
  console.log(`ok  cache: Flexure ${(tFlex / 1000).toFixed(1)} s (one analysis), then Rating + Shear + Fatigue + Welds ${(tOthers / 1000).toFixed(1)} s with no analysis; Welds line "${wbar.bar.replace(/\s+/g, ' ')}"; f_ℓ saved ${fl}; report sections: ${rp.secs.length} incl. Welds; 0 console errors (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (blocked.size) console.log('    blocked requests:', [...blocked].join(', '));
} catch (e) {
  console.log('FAIL', e.message, '\n console errors:', errs.slice(0, 5)); process.exitCode = 1;
} finally { await b.close(); }
