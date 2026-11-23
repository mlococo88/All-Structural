#!/usr/bin/env node
// Steel Bridge Design (apps/steel-bridge/index.html), DK (2026-11-23): the deck design module (shared/deck.js, engine/deck.js, ui/deck.js).
// Headless Chromium, file://, a new (made-up default) project:
//   1. off by default: the Deck tab says so, the saved project has no deckDesign field, the Cross-section tab's card shows the switch only;
//   2. "Turn deck design on": three checks DK1–DK3 with the hand-checked values of tests/engine/sb-deck.test.mjs, the section figure,
//      the values used with links, the worked steps (KaTeX, 0 errors); a § link opens its topic;
//   3. the input card: bottom bars at 8 in changes DK1 to 0.974 at once; the project file now holds deckDesign; Undo brings 6 in back;
//   4. a failing design (top bars at 12 in) shows NG; switching the module off returns the off card and keeps the entered bars;
//   5. the other tabs are as before (the Section properties tab still calculates); 390 px wide: no sideways page scroll; 0 console errors.
//   node tests/smoke/steel-bridge-deck.mjs        (SBD_SHOT_DIR=<folder>: screenshots)
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/steel-bridge/index.html'), SHOT = process.env.SBD_SHOT_DIR || '';
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1500, vh: 1100, ...(SHOT ? { dsf: 2 } : {}) });
const shot = async f => { if (SHOT) await p.screenshot({ path: path.join(SHOT, f) }); };
try {
  await p.waitForFunction(() => window.SBDDeckUI && window.SBDDeck && window.SharedDeck && document.querySelector('#inTabs [data-itab="proj"]') && document.getElementById('out').innerText.length > 20, null, { timeout: 120000 });
  const otab = async t => { await p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t); await p.waitForTimeout(250); };
  const itab = async t => { await p.evaluate(t => document.querySelector(`#inTabs [data-itab="${t}"]`).click(), t); await p.waitForTimeout(150); };
  const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('sbd2.project.current') || 'null'));
  const row = id => p.evaluate(id => [...document.querySelector(`#out tr[data-dkck="${id}"]`).children].map(c => c.innerText.trim()), id);
  const setIn = async (id, v) => { await p.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]); await p.waitForTimeout(300); };

  // 1. off by default
  assert.equal(await p.locator('#tabBar [data-otab="dk"]').innerText(), 'Deck');
  await otab('dk');
  assert.match(await p.locator('#out #dk-off').innerText(), /Deck design is off for this project/);
  assert.equal(await p.locator('#out tr[data-dkck]').count(), 0);
  await itab('xsec');
  assert.equal(await p.locator('#dkIn [data-dk]').count(), 1, 'only the switch while off'); assert.equal(await p.locator('#dk_on').inputValue(), 'false');
  await itab('mat'); await setIn('i_materials.concrete.fc', '4');   // an unrelated input saves the project
  let S = await saved(); if (S) assert.equal('deckDesign' in S, false, 'no deckDesign field written while off');
  await shot('sb-deck-1-off.png');
  ok('off by default: the Deck tab says so, only the switch on the Cross-section tab, no deckDesign field in the saved project');

  // 2. on
  await p.click('#dk_turnOn'); await p.waitForSelector('#out tr[data-dkck="DK3"]');
  let r1 = await row('DK1'), r2 = await row('DK2'), r3 = await row('DK3');
  assert.deepEqual([r1[2], r1[4], r1[5]], ['12.93', '0.744', 'OK']); assert.deepEqual([r2[2], r2[3], r2[4], r2[5]], ['12.08', '13.20', '0.916', 'OK']); assert.deepEqual([r3[2], r3[3], r3[4], r3[5]], ['9.67', '13.20', '0.733', 'OK']);
  assert.match(r1[1], /S = 9\.50 ft/); assert.match(r1[7], /AASHTO LRFD 10th Ed\./);
  const txt = await p.locator('#out').innerText();
  assert.match(txt, /Not checked here: the Extreme Event II vehicular-collision cases of the overhang \(A13\.4/); assert.match(txt, /67\.0 % of the positive-moment steel = 0\.415 in²\/ft/);
  assert.equal(await p.locator('#out #dk-fig svg').count(), 1); assert.match(await p.locator('#out #dk-fig svg').innerHTML(), /16 kip wheel, X = 0\.75 ft/);
  assert.equal(await p.evaluate(() => document.querySelectorAll('#out .katex-error').length), 0);
  const topics = await p.evaluate(() => [...document.querySelectorAll('#out details.sg-t')].map(d => d.dataset.sgk)); assert.deepEqual(topics, ['b1', 'pos', 'neg', 'ohL', 'ohR', 'dist']);
  assert.ok(await p.evaluate(() => document.querySelectorAll('#out details.sg-t .katex').length) > 40, 'steps rendered with KaTeX');
  await p.evaluate(() => document.querySelector('#out tr[data-dkck="DK2"] a[href^="#st-"]').click()); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => document.querySelector('#out details.sg-t[data-sgk="neg"]').open), true, 'the § link opens the topic of its step');
  assert.match(await p.evaluate(() => document.getElementById('st-dk.neg.r').innerText), /12\.084.*13\.197.*0\.916/s);
  assert.equal(await p.locator('#dkIn [data-dk]').count(), 8, 'the card shows the bars, covers and design section when on');
  await shot('sb-deck-2-on.png');
  await p.evaluate(() => { document.querySelectorAll('#out details.sg-t').forEach(d => { d.open = /^(b1|pos)$/.test(d.dataset.sgk); }); document.getElementById('dk-steps').scrollIntoView(); }); await p.waitForTimeout(300);
  await shot('sb-deck-3-steps.png');
  ok('on: DK1 0.744, DK2 0.916, DK3 0.733 (hand-checked values), figure, values used, 6 step topics in KaTeX with 0 errors, § link opens its step');

  // 3. the input card
  await itab('xsec'); await setIn('dk_sBot', '8');
  r1 = await row('DK1'); assert.deepEqual([r1[3], r1[4]], ['13.27', '0.974']);
  S = await saved(); if (S) { const D = S.deckDesign; assert.equal(D.on, true); assert.equal(D.sBot, 8); }
  await p.click('#bUndo'); await p.waitForTimeout(300); r1 = await row('DK1'); assert.equal(r1[4], '0.744'); assert.equal(await p.locator('#dk_sBot').inputValue(), '6');
  ok('input card: bottom bars at 8 in → DK1 0.974 at once and saved with the project; Undo restores 6 in');

  // 4. NG, and off again
  await setIn('dk_sTop', '12'); r2 = await row('DK2'); assert.equal(r2[5], 'NG'); assert.ok(+r2[4] > 1);
  assert.match(await p.locator('#out #dk-gov').innerText(), /2 checks NG|1 check NG/);
  await setIn('dk_sTop', '0'); assert.match(await p.locator('#out .alert.err').innerText(), /Top bar spacing must be greater than 0/);
  await setIn('dk_sTop', '5'); await setIn('dk_barTop', '0.44');
  await p.selectOption('#dk_on', 'false'); await p.waitForTimeout(300);
  assert.match(await p.locator('#out #dk-off').innerText(), /Deck design is off/); assert.equal(await p.locator('#dkIn [data-dk]').count(), 1);
  S = await saved(); if (S) { const D = S.deckDesign; assert.equal(D.on, false); assert.equal(D.sTop, 5); assert.equal(D.barTop, 0.44); }
  await p.selectOption('#dk_on', 'true'); await p.waitForSelector('#out tr[data-dkck="DK2"]'); assert.equal(await p.locator('#dk_sTop').inputValue(), '5');
  ok('a failing design shows NG; an input error is reported; off returns the off card and keeps the entered bars');

  // 5. other tabs, phone width, console
  await otab('sec'); await p.waitForFunction(() => { const a = document.querySelector('#out .alert.stale'); return a && a.hidden; }, null, { timeout: 120000 });
  assert.ok((await p.locator('#out').innerText()).length > 500);
  await p.setViewportSize({ width: 390, height: 800 }); await otab('dk'); await p.waitForTimeout(300);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways page scroll at 390 px');
  assert.deepEqual(errs, [], 'console errors');
  ok('Section properties still calculates; 390 px: no sideways page scroll; 0 console errors');
  console.log(`\nsteel-bridge-deck: ${n} checks passed`);
} catch (e) { console.error('FAIL', e); process.exitCode = 1; } finally { await b.close(); }
