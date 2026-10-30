#!/usr/bin/env node
// Browser smoke test of the report wiring (2026-10-30): apps/steel-bridge/index.html with the built-in project, headless Chromium
// (tests/lib.mjs openPage):
//   1. the Flexure, Shear & stiffeners, Fatigue & studs, Constructibility and Rating tabs open on "This project's analysis" (the
//      default for a complete project), named in the line at the top of each tab; the Flexure tab calculates with it;
//   2. Constructibility: f_ℓ during deck placement is written to the saved project (P.constr.flC);
//   3. Report tab, scope "Every girder": builds, shows the summary of every girder; back to "Selected girder".
//   0 console errors, 0 .katex-error.
//   node tests/smoke/steel-bridge-wiring.mjs
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const t0 = Date.now();
const { b, p, errs, blocked } = await openPage(path.join(REPO, 'apps/steel-bridge/index.html'), { vw: 1400, vh: 1000 });
try {
  await p.waitForSelector('#tabBar [data-otab="flex"]');
  const bars = {};
  for (const t of ['flex', 'shear', 'fat', 'cn', 'rt']) {
    await p.click(`#tabBar [data-otab="${t}"]`); await p.waitForSelector('#out .srcBar');
    bars[t] = await p.evaluate(() => document.querySelector('#out .srcBar').innerText.trim());
    assert.match(bars[t], /^Demands: This project's analysis/, `${t}: ${bars[t]}`); assert.match(bars[t], /the default/, `${t}: ${bars[t]}`);
  }
  // Flexure with this project's analysis
  await p.click('#tabBar [data-otab="flex"]');
  assert.equal(await p.evaluate(() => document.getElementById('fx_src').value), 'analysis');
  await p.click('#fx_calc');
  await p.waitForSelector('#out .fx-list tr[data-fx]', { timeout: 120000 });
  const fx = await p.evaluate(() => ({ rows: document.querySelectorAll('#out .fx-list tr[data-fx]').length, note: [...document.querySelectorAll('#out .secBody .note')].map(n => n.innerText).join(' | '), kErr: document.querySelectorAll('#out .katex-error').length }));
  assert.ok(fx.rows > 100, `${fx.rows} flexure locations`); assert.match(fx.note, /This project's analysis of G1/); assert.equal(fx.kErr, 0);
  // choosing the example keeps it, and the line says so
  await p.selectOption('#fx_src', 'example');
  assert.match(await p.evaluate(() => document.querySelector('#out .srcBar').innerText), /Example.*as chosen below/s);
  // Constructibility f_ℓ saved with the project
  await p.click('#tabBar [data-otab="cn"]');
  await p.fill('#cn_flC', '1.5'); await p.dispatchEvent('#cn_flC', 'change'); await p.waitForTimeout(300);
  const fl = await p.evaluate(() => { const j = JSON.parse(localStorage.getItem('sbd2.project.current') || '{}'); return { saved: (j.constr || {}).flC, shown: document.getElementById('cn_flC').value }; });
  assert.equal(fl.saved, 1.5, JSON.stringify(fl)); assert.equal(fl.shown, '1.5');
  // Report: every girder
  await p.click('#tabBar [data-otab="rpt"]');
  await p.selectOption('#rp_scope', 'all');
  await p.click('#rp_build');
  await p.waitForSelector('.rp-doc .rp-tbl', { timeout: 180000 });
  const rp = await p.evaluate(() => ({ secs: [...document.querySelectorAll('.rp-doc .rp-h1')].map(h => h.textContent.trim()), kErr: document.querySelectorAll('.rp-doc .katex-error').length,
    rows: document.querySelectorAll('.rp-doc .rp-tbl')[0].querySelectorAll('tbody tr').length, text: document.querySelector('.rp-doc').innerText }));
  assert.equal(rp.kErr, 0); assert.ok(rp.rows >= 12, `${rp.rows} check groups`); assert.match(rp.secs[0], /Summary of every girder/); assert.match(rp.text, /Controlling girder: G1/);
  assert.ok(!/NaN|undefined|\[object/.test(rp.text), 'bad text');
  await p.selectOption('#rp_scope', 'girder'); await p.waitForSelector('#rp_detail');
  assert.deepEqual(errs, [], 'console errors');
  console.log(`ok  sources: ${Object.entries(bars).map(([k, v]) => `${k} "${v.replace(/\s+/g, ' ').slice(0, 60)}…"`).join('; ')}`);
  console.log(`ok  Flexure (analysis) ${fx.rows} locations; constructibility f_ℓ saved ${fl.saved}; every-girder report ${rp.rows} check groups; 0 console errors, 0 katex errors (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (blocked.size) console.log('    blocked requests:', [...blocked].join(', '));
} catch (e) {
  console.log('FAIL', e.message, '\n console errors:', errs.slice(0, 5)); process.exitCode = 1;
} finally { await b.close(); }
