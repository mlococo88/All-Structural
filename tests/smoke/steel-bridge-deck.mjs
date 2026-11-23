#!/usr/bin/env node
// Steel Bridge Design (apps/steel-bridge/index.html), DK (2026-11-23): the deck design module (shared/deck.js, engine/deck.js, ui/deck.js).
// Headless Chromium, file://, a new (made-up default) project:
//   1. off by default: the Deck tab says so, the saved project has no deckDesign field, the Cross-section tab's card shows the switch only;
//   2. "Turn deck design on": three checks DK1–DK3 with the hand-checked values of tests/engine/sb-deck.test.mjs, the section figure,
//      the values used with links, the worked steps (KaTeX, 0 errors); a § link opens its topic;
//   3. the input card: bottom bars at 8 in changes DK1 to 0.974 at once; the project file now holds deckDesign; Undo brings 6 in back;
//   4. a failing design (top bars at 12 in) shows NG; switching the module off returns the off card and keeps the entered bars;
//   6. (part 2) the Summary tab's deck card and verdict counts, the left column chip, the Report section, summaries and bill of materials;
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

  // 6. part 2: Summary tab and left column, Report, Nomenclature (deck on: top #5 at 5 in, #6 bars → all pass)
  await otab('sum'); await p.waitForFunction(() => /Up to date/.test((document.querySelector('#out .sum-run') || {}).textContent || ''), null, { timeout: 600000 });
  const sm = await p.evaluate(() => ({ rows: [...document.querySelectorAll('#out #sum-deck tbody tr')].map(t => [...t.children].map(c => c.innerText.trim())), verd: document.querySelector('#out #sum-verdict .sum-verd').innerText, chip: (document.querySelector('#sbDash [data-sdgrp="Deck"]') || {}).innerText || '', cols: [...document.querySelectorAll('#out #sum-table thead th, #out table.sum-tbl thead th')].map(h => h.innerText) }));
  assert.equal(sm.rows.length, 3); assert.match(sm.rows[0][0], /^DK1 /); assert.ok(sm.rows.every(r => r[5] === 'PASS'), JSON.stringify(sm.rows)); assert.match(sm.chip, /Deck slab[\s\S]*PASS/);
  assert.ok(!sm.cols.some(c => /Deck/.test(c)), 'not a column of the girder table');
  const nPass = +(/(\d+) PASS/.exec(sm.verd) || [0, 0])[1];
  await itab('xsec'); await p.selectOption('#dk_on', 'false'); await p.waitForFunction(() => /Up to date/.test((document.querySelector('#out .sum-run') || {}).textContent || ''), null, { timeout: 600000 });
  const off = await p.evaluate(() => ({ card: !!document.querySelector('#out #sum-deck'), verd: document.querySelector('#out #sum-verdict .sum-verd').innerText, chip: !!document.querySelector('#sbDash [data-sdgrp="Deck"]') }));
  assert.equal(off.card, false); assert.equal(off.chip, false); assert.equal(+(/(\d+) PASS/.exec(off.verd) || [0, 0])[1], nPass - 3, 'three counts fewer with the deck design off');
  await p.selectOption('#dk_on', 'true'); await p.waitForSelector('#out #sum-deck');
  await p.evaluate(() => document.querySelector('#sbDash [data-sdgrp="Deck"] a').click()); await p.waitForSelector('#out tr[data-dkck="DK1"]');
  assert.equal(await p.evaluate(() => document.querySelector('#tabBar [aria-selected="true"]').dataset.otab), 'dk');
  await shot('sb-deck-4-summary-chip.png');
  ok(`Summary: deck card with DK1–DK3, counted once in the verdict (${nPass} PASS with, ${nPass - 3} without), left column chip opens the Deck tab; not a girder column`);
  await otab('rpt'); assert.equal(await p.locator('#out [data-rpinc="dk"]').count(), 1); await p.click('#rp_build'); await p.waitForSelector('.rp-doc .rp-step', { timeout: 300000 });
  const rp = await p.evaluate(() => ({ kErr: document.querySelectorAll('.rp-doc .katex-error').length, bad: document.querySelectorAll('.rp-doc .rp-bad').length, secs: [...document.querySelectorAll('.rp-doc .rp-h1')].map(h => h.textContent.trim()), text: document.querySelector('.rp-doc').innerText, tc: document.querySelector('.rp-doc').textContent, fig: document.querySelectorAll('.rp-doc svg.dk-fig').length }));
  assert.equal(rp.kErr, 0); assert.equal(rp.bad, 0, 'unresolved § references'); assert.equal(rp.secs.length, 19, rp.secs.join(' | '));
  const iD = rp.secs.findIndex(t => /Deck slab \(transverse design\)/.test(t)); assert.ok(iD > 0 && /rating/i.test(rp.secs[iD + 1]), rp.secs.join(' | '));
  ['DK2 Deck negative moment, top bars (Strength I)', 'Deck reinforcement (Deck tab; rebar, not in the steel totals)', 'Deck slab (bridge)'].forEach(t => assert.ok(rp.tc.includes(t), t)); assert.equal(rp.fig, 1);
  assert.ok(!/NaN|undefined|\[object/.test(rp.text));
  await p.evaluate(() => { const h = [...document.querySelectorAll('.rp-doc .rp-h1')].find(q => /Deck slab \(transverse/.test(q.textContent)); h.scrollIntoView(); }); await p.waitForTimeout(400); await shot('sb-deck-5-report.png');
  ok(`Report: 19 sections, "${rp.secs[iD]}" before the Rating, its figure, the deck rows in the summaries and the bill of materials; 0 KaTeX errors, 0 unresolved links`);

  // 5. other tabs, phone width, console
  await otab('sec'); await p.waitForFunction(() => { const a = document.querySelector('#out .alert.stale'); return a && a.hidden; }, null, { timeout: 120000 });
  assert.ok((await p.locator('#out').innerText()).length > 500);
  await p.setViewportSize({ width: 390, height: 800 }); await otab('dk'); await p.waitForTimeout(300);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways page scroll at 390 px');
  assert.deepEqual(errs, [], 'console errors');
  ok('Section properties still calculates; 390 px: no sideways page scroll; 0 console errors');
  console.log(`\nsteel-bridge-deck: ${n} checks passed`);
} catch (e) { console.error('FAIL', e); process.exitCode = 1; } finally { await b.close(); }
