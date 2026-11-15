#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html) batch G (2026-11-15), the old app's features still missing, headless Chromium, file://:
//   G1 the Section properties tab: the bare girder's weak-axis I_y, S_y and St-Venant J rows (= the engine's weakAxisAndJ, the psSection
//      hand-off's Iweak / J), each § link opens its worked step in topic "Weak axis and torsion (bare girder)".
//   G2 the e / effective A_ps chart along the span on the Section properties tab (two rows, 63 stations); P_jack = 1,758 kip with its step.
//   G3 the Analysis chart: 11 moment and 10 shear series chips (the old app's), the added ones off at first; a chip switched on stays on
//      after a reload (psb2.ui anHide). 0 console errors.
//   node tests/smoke/ps-bridge-gfeatures.mjs [--shots <dir>] [--part g1,...]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shots = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--shots'));
const parts = (i => i > 0 ? process.argv[i + 1].split(',') : null)(process.argv.indexOf('--part'));
const on = k => !parts || parts.includes(k);
let n = 0; const ok = m => { n++; console.log('  ok  ', m); }; const t0 = Date.now();
const { b, p, errs } = await openPage(path.join(REPO, 'apps/ps-bridge/index.html'), { vw: 1400, vh: 1000 });
const tab = async k => { await p.click(`#tabBar [data-otab="${k}"]`); await p.waitForFunction(k => document.querySelector(`#tabBar [data-otab="${k}"]`).getAttribute('aria-selected') === 'true', k); await p.waitForTimeout(300); };
try {
  await p.waitForFunction(() => window.PSBUiSection && document.getElementById('out').innerText.length > 50, null, { timeout: 120000 });
  if (on('g1')) {
    await tab('sec');
    const v = await p.evaluate(() => { const P = PSBModel.load(localStorage).project, inp = PSBDesign.inputs(P), R = computeAll(inp), w = weakAxisAndJ(R.g);
      const f = x => x.toLocaleString('en-US', { maximumFractionDigits: 0 });
      return { w, Iy: document.getElementById('sec-Iy').textContent, Sy: document.getElementById('sec-Sy').textContent, J: document.getElementById('sec-J').textContent, f: [f(w.Iweak), f(w.Sy), f(w.J)] }; });
    assert.deepEqual([v.Iy, v.Sy, v.J], v.f); assert.deepEqual([v.Iy, v.Sy, v.J], ['50,344', '2,397', '13,383']);
    ok(`I_y ${v.Iy} in⁴, S_y ${v.Sy} in³, J ${v.J} in⁴ on the Section properties tab (= weakAxisAndJ)`);
    await p.click('a.wk[href="#st-sec.wk.J"]'); await p.waitForTimeout(300);
    assert.ok(await p.evaluate(() => { const li = document.getElementById('st-sec.wk.J'); return !!li && li.closest('details').open && /Weak axis and torsion/.test(li.closest('details').querySelector('summary').textContent); }));
    ok('the J § link opens its worked step (topic "Weak axis and torsion (bare girder)")');
    if (shots) { await p.evaluate(() => document.getElementById('st-sec.wk.J').scrollIntoView({ block: 'center' })); await p.locator('details.sg-t[data-sgk="wk"]').screenshot({ path: path.join(shots, 'G1-weak-steps.png') });
      await p.locator('#card-gross').screenshot({ path: path.join(shots, 'G1-gross-card.png') }); }
  }
  if (on('g2')) {
    await tab('sec'); await p.waitForSelector('#gfx_secE svg');
    const c = await p.evaluate(() => ({ rows: document.querySelectorAll("#gfx_secE svg polyline").length, t: document.querySelector('#gfx_secE').closest('.sec').querySelector('.secHead').textContent, pj: document.getElementById('sec-Pj').textContent }));
    assert.match(c.t, /Eccentricity and effective strands along the span/); assert.ok(c.rows >= 2, 'two series drawn'); assert.equal(c.pj, '1,758');
    ok(`the e / A_ps chart drawn (${c.rows} paths); P_jack ${c.pj} kip`);
    if (shots) await p.locator('#gfx_secE').screenshot({ path: path.join(shots, 'G2-ecc-chart.png') });
  }
  if (on('g3')) {
    await tab('an'); await p.waitForSelector('#gfx_an .vk-chips');
    const chips = () => p.evaluate(() => [...document.querySelectorAll('#gfx_an .vk-chips')].map(c => [...c.querySelectorAll('button')].map(b => (b.getAttribute('aria-pressed') === 'true' ? '+' : '-') + b.textContent.trim())));
    const c0 = await chips(); assert.equal(c0[0].length, 11); assert.equal(c0[1].length, 10);
    assert.deepEqual(c0[0].map(t => t[0]).join(''), '---++++++--'); assert.deepEqual(c0[1].map(t => t[0]).join(''), '---+-++++-');
    ok(`11 moment and 10 shear series; shown at first: ${c0[0].filter(t => t[0] === '+').join(' ')}`);
    await p.locator('#gfx_an .vk-chips').first().locator('button').first().click(); await p.waitForTimeout(300);
    await p.reload(); await p.waitForFunction(() => window.PSBUiSection && document.getElementById('out').innerText.length > 50, null, { timeout: 120000 });
    await tab('an'); await p.waitForSelector('#gfx_an .vk-chips');
    const c1 = await chips(); assert.equal(c1[0][0][0], '+', 'M_g kept on after a reload');
    ok('M_g switched on is kept after a reload (psb2.ui)');
    if (shots) await p.locator('#gfx_an').screenshot({ path: path.join(shots, 'G3-analysis-chart.png') });
    await p.locator('#gfx_an .vk-chips').first().locator('button').first().click(); await p.waitForTimeout(200);
  }
  assert.deepEqual(errs, []); ok('0 console errors');
  console.log(`ps-bridge-gfeatures: ${n} checks passed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} finally { await b.close(); }
