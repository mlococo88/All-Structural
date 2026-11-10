#!/usr/bin/env node
// Browser smoke test of "+ Add splice station" on the Splices input tab (SPADD, 2026-11-09). apps/steel-bridge/index.html with the built-in
// project, headless Chromium (tests/lib.mjs openPage):
//   1. the Field splices tab auto-designs FS1; "Plates and bolts: Entered below" shows "None entered." and the add control;
//   2. "+ Add splice station" adds the FS1 row of this girder, prefilled with the auto-designed plates: the saved row has the stored format of
//      "Keep these plates" ({ x, g, top, bot, web }, numbers) and the FS1 result with the row ("entered") equals the auto-designed one;
//   3. an edited plate value is saved and changes FS1; × removes the row ("None entered." again, FS1 back on the built-in plates);
//   4. on a new page (no run yet) the row is prefilled with GirderDetail's built-in plates (engine/splices.js DEF);
//   0 console errors. A screenshot of the control: SHOT=<file.png> node tests/smoke/steel-bridge-splice-addrow.mjs
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const t0 = Date.now(), FILE = path.join(REPO, 'apps/steel-bridge/index.html');
const settle = (p, t = 240000) => p.waitForFunction(() => !document.querySelector('#out .alert.stale:not([hidden])') && !/Calculating|updating/.test((document.querySelector('#autoMsg') || {}).textContent || ''), null, { timeout: t });
const saved = p => p.evaluate(() => JSON.parse(localStorage.getItem('sbd2.project.current') || '{}'));
const fs1 = async p => (await p.evaluate(() => [...document.querySelectorAll('#out .sp-list tbody tr')].map(r => r.innerText.replace(/\s+/g, ' '))))[0] || '';
const allErrs = [];
const one = async (fn) => { const o = await openPage(FILE, { vw: 1400, vh: 1000 }); try { await o.p.waitForSelector('#tabBar [data-otab="spl"]'); await o.p.click('#inTabs [data-itab="spl"]'); await fn(o.p); allErrs.push(...o.errs); } finally { await o.b.close(); } };
const entered = async p => { await p.selectOption('#inPanes [data-path="splices.auto"]', 'false'); await p.waitForSelector('#inPanes [data-spladd]'); };
let msg = [];
try {
  await one(async p => {
    await p.click('#tabBar [data-otab="spl"]'); await settle(p);
    const auto = await fs1(p); assert.match(auto, /FS1.*auto:/, auto);
    assert.equal(await p.locator('#inPanes [data-spladd]').count(), 0, 'no add control while auto-design is on');
    await entered(p); await settle(p);
    assert.match(await p.locator('#inPanes').innerText(), /None entered\./);
    const opts = await p.$$eval('#i_spladd option', os => os.map(o => o.textContent));
    assert.ok(opts.length >= 1 && /^FS1 at/.test(opts[0]), opts.join(' | '));
    await p.selectOption('#i_spladd', { index: 0 }); await p.click('#inPanes [data-spladd]'); await p.waitForTimeout(300); await settle(p);
    const sv = await saved(p), row = sv.splices.plates[0];
    assert.equal(sv.splices.plates.length, 1); assert.deepEqual(Object.keys(row), ['x', 'g', 'top', 'bot', 'web']); assert.equal(row.g, 0); assert.equal(row.x, sv.framing.splices[0]);
    for (const k of ['top', 'bot', 'web']) for (const [f, v] of Object.entries(row[k])) assert.ok(typeof v === 'number' || typeof v === 'boolean', `${k}.${f} ${JSON.stringify(v)}`);
    const DEF = await p.evaluate(() => window.SBDSplices.DEF);
    assert.notDeepEqual({ top: row.top, bot: row.bot, web: row.web }, { top: DEF.top, bot: DEF.bot, web: DEF.web }, 'the auto-design, not the built-in plates');
    const withRow = await fs1(p); assert.match(withRow, /entered:/, withRow);
    assert.equal(withRow.replace('entered:', 'auto:'), auto, 'FS1 with the added row must equal the auto-designed FS1');
    // the FS1 option is gone; other stations stay
    const opts2 = await p.$$eval('#i_spladd option', os => os.map(o => o.textContent)); assert.ok(!opts2.some(o => /^FS1 at/.test(o)), opts2.join(' | '));
    if (process.env.SHOT) { const c = p.locator('#inPanes section.sec', { hasText: 'Entered plates and bolts' }).first(); await c.scrollIntoViewIfNeeded(); await c.screenshot({ path: process.env.SHOT }); }
    // 3. edit one value, then remove the row
    const s = '#inPanes [data-path="splices.plates.0.bot.to"]', v0 = +(await p.inputValue(s));
    await p.fill(s, String(v0 + 0.125)); await p.dispatchEvent(s, 'change'); await p.waitForTimeout(800); await settle(p);
    assert.equal(String((await saved(p)).splices.plates[0].bot.to), String(v0 + 0.125)); assert.notEqual(await fs1(p), withRow, 'edited t_o changes FS1');
    await p.click('#inPanes [data-spldel="0"]'); await p.waitForTimeout(800); await settle(p);
    assert.deepEqual((await saved(p)).splices.plates, []); assert.match(await p.locator('#inPanes').innerText(), /None entered\./);
    const builtIn = await fs1(p); assert.match(builtIn, /FS1.*built-in:/, builtIn);   // "Entered below" with no entry: the built-in plates (not auto-designed)
    msg.push(`ok  auto-designed FS1 copied by "+ Add splice station": "${withRow.slice(0, 90)}…" (equals the auto-designed result); t_o edit saved and changes FS1; × removes the row`);
  });
  await one(async p => {
    await entered(p);
    await p.click('#inPanes [data-spladd]'); await p.waitForTimeout(300);
    const sv = await saved(p), row = sv.splices.plates[0], DEF = await p.evaluate(() => window.SBDSplices.DEF);
    assert.deepEqual({ top: row.top, bot: row.bot, web: row.web }, { top: DEF.top, bot: DEF.bot, web: DEF.web });
    msg.push('ok  no run yet: the row is prefilled with the built-in plates (engine/splices.js DEF)');
  });
  assert.deepEqual(allErrs, [], 'console errors');
  for (const m of msg) console.log(m);
  console.log(`ok  0 console errors (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} catch (e) {
  console.log('FAIL', e.message, '\n console errors:', allErrs.slice(0, 5)); process.exitCode = 1;
}
