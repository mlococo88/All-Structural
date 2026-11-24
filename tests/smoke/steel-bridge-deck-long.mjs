#!/usr/bin/env node
// Steel Bridge Design (apps/steel-bridge/index.html), DKL (2026-11-24, engineer: "The deck is missing the transverse steel"): the Deck tab's
// section draws the transverse bars as lines and the longitudinal bars (new optional inputs) as circles; check DK4 (9.7.3.2).
// Headless Chromium, file://, a new (made-up default) project:
//   1. deck on, no longitudinal bars: DK1–DK3 as before, the DK4 row says "not checked", the figure has no circle, the transverse bars are lines;
//   2. the card's longitudinal inputs: top #4 at 12 in, bottom #5 at 8 in -> DK4 0.893 OK (0.4154 / 0.465), circles in the figure, the § link
//      opens its worked step; the saved project holds the four keys; #5 at 9 in -> 1.005 NG;
//   3. blank again: the keys are removed (as a project saved before), DK4 "not checked"; 0 KaTeX errors, 0 console errors.
//   node tests/smoke/steel-bridge-deck-long.mjs        (SBD_SHOT_DIR=<folder>: screenshots sb-deck-long-fig.png, sb-deck-long-check.png)
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/steel-bridge/index.html'), SHOT = process.env.SBD_SHOT_DIR || '';
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1500, vh: 1100, ...(SHOT ? { dsf: 2 } : {}) });
try {
  await p.waitForFunction(() => window.SBDDeckUI && window.SBDDeck && document.querySelector('#inTabs [data-itab="proj"]') && document.getElementById('out').innerText.length > 20, null, { timeout: 120000 });
  const otab = async t => { await p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t); await p.waitForTimeout(250); };
  const itab = async t => { await p.evaluate(t => document.querySelector(`#inTabs [data-itab="${t}"]`).click(), t); await p.waitForTimeout(150); };
  const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('sbd2.project.current') || 'null'));
  const row = id => p.evaluate(id => { const r = document.querySelector(`#out tr[data-dkck="${id}"]`); return r ? [...r.children].map(c => c.innerText.trim()) : null; }, id);
  const setIn = async (id, v) => { await p.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]); await p.waitForTimeout(300); };
  const fig = () => p.evaluate(() => { const s = document.querySelector('#out #dk-fig svg'); return { circ: s.querySelectorAll('circle').length, top: s.querySelectorAll('circle[data-dkbar="top-long"]').length, bot: s.querySelectorAll('circle[data-dkbar="bot-long"]').length,
    lines: s.querySelectorAll('line[data-dkbar$="-tr"]').length, txt: s.textContent }; });

  // 1. on, no longitudinal bars
  await otab('dk'); await p.click('#dk_turnOn'); await p.waitForSelector('#out tr[data-dkck="DK3"]');
  assert.equal((await row('DK1'))[4], '0.744'); assert.equal((await row('DK2'))[4], '0.916'); assert.equal((await row('DK3'))[4], '0.733');
  assert.equal(await row('DK4'), null); assert.match((await row('DK4-none'))[1], /Not checked: bottom longitudinal bars not entered/);
  let F = await fig(); assert.equal(F.circ, 0); assert.equal(F.lines, 2); assert.match(F.txt, /top transverse #5 @ 6\.00 in/); assert.match(F.txt, /bottom transverse #5 @ 6\.00 in/); assert.match(F.txt, /Longitudinal bars not entered/);
  assert.match(await p.locator('#out #dk-gov').innerText(), /all checks OK/);
  ok('on, no longitudinal bars: DK1–DK3 as before, DK4 "not checked", transverse bars as two lines, no circle');

  // 2. the longitudinal bars
  await itab('xsec');
  assert.equal(await p.locator('#dk_barLongBot').inputValue(), ''); assert.equal(await p.locator('#dk_sLongBot').inputValue(), '');
  await setIn('dk_barLongTop', '0.2'); await setIn('dk_sLongTop', '12'); await setIn('dk_barLongBot', '0.31'); await setIn('dk_sLongBot', '8');
  let r4 = await row('DK4'); assert.ok(r4, 'DK4 row'); assert.match(r4[0], /^DK4 Deck distribution reinforcement, bottom longitudinal bars/);
  assert.match(r4[2], /0\.415/); assert.match(r4[3], /0\.465/); assert.deepEqual([r4[4], r4[5]], ['0.893', 'OK']); assert.equal(await row('DK4-none'), null);
  F = await fig(); assert.ok(F.top > 5 && F.bot > F.top && F.circ === F.top + F.bot, JSON.stringify(F)); assert.equal(F.lines, 2);
  assert.match(F.txt, /Longitudinal bars \(circles, inside the transverse bars\): top #4 at 12\.00 in; bottom #5 at 8\.00 in/);
  let S = await saved(); if (S) { const D = S.deckDesign; assert.deepEqual([D.barLongTop, D.sLongTop, D.barLongBot, D.sLongBot], [0.2, 12, 0.31, 8]); }
  await p.evaluate(() => document.querySelector('#out tr[data-dkck="DK4"] a[href^="#st-"]').click()); await p.waitForTimeout(250);
  assert.equal(await p.evaluate(() => document.querySelector('#out details.sg-t[data-sgk="dist"]').open), true);
  assert.match(await p.evaluate(() => document.getElementById('st-dk.distR').innerText), /0\.415.*0\.465.*0\.893/s);
  assert.match(await p.evaluate(() => document.getElementById('st-dk.distProv').innerText), /0\.465/);
  assert.equal(await p.evaluate(() => document.querySelectorAll('#out .katex-error').length), 0);
  if (SHOT) {
    await p.evaluate(() => document.querySelector('#out #dk-fig').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
    await p.locator('#out #dk-fig svg').screenshot({ path: path.join(SHOT, 'sb-deck-long-fig.png') });
    await p.evaluate(() => document.querySelector('#out #dk-gov').scrollIntoView({ block: 'start' })); await p.waitForTimeout(200);
    await p.locator('#out #dk-gov').screenshot({ path: path.join(SHOT, 'sb-deck-long-check.png') });
  }
  await setIn('dk_sLongBot', '9'); r4 = await row('DK4'); assert.deepEqual([r4[4], r4[5]], ['1.005', 'NG']); assert.match(await p.locator('#out #dk-gov').innerText(), /DK4.*1 check NG/s);
  ok('longitudinal bars: DK4 0.893 OK at #5 @ 8 in, 1.005 NG at 9 in; circles for them only; § opens the worked step; saved in deckDesign');

  // 3. blank again
  await setIn('dk_barLongBot', ''); await setIn('dk_sLongBot', ''); await setIn('dk_barLongTop', ''); await setIn('dk_sLongTop', '');
  S = await saved(); if (S) ['barLongTop', 'sLongTop', 'barLongBot', 'sLongBot'].forEach(k => assert.equal(k in S.deckDesign, false, k));
  assert.equal(await row('DK4'), null); assert.ok(await row('DK4-none')); F = await fig(); assert.equal(F.circ, 0);
  assert.match(await p.locator('#out #dk-gov').innerText(), /all checks OK/);
  assert.deepEqual(errs, [], 'console errors');
  ok('blank again: keys removed (as a project saved before), DK4 not checked, no circle; 0 console errors');
  console.log(`\nsteel-bridge-deck-long: ${n} checks passed`);
} catch (e) { console.error('FAIL', e); process.exitCode = 1; } finally { await b.close(); }
