#!/usr/bin/env node
// Steel Bridge Design (apps/steel-bridge/index.html), DKTS / DKCR (2026-11-24, engineer request): deck checks DK5 (shrinkage and temperature
// reinforcement, AASHTO LRFD 10th Ed. Art. 5.10.6) and DK6 (crack control of the transverse bars, Art. 5.6.7, Service I).
// DKDC (2026-11-24, engineer decision): the top bars' d_c and h are measured within the structural slab (the sacrificial wearing surface
// excluded); before, the default project's DK6 was 1.075 NG (s_max 5.58 in).
// Headless Chromium, file://, a new (made-up default) project:
//   1. deck on: the checks table has DK5 and DK6 with their demand and limit (not '—'); DK6 = 0.833 OK (negative moment, top bars, bar
//      stress 29.98 / 36.00 ksi; s / s_max = 6 / 7.53 = 0.797); DK2 governs, all OK; the DK5 and DK6 tables; the § link of DK6 opens its step;
//   2. the exposure input: Class 2 lowers s_max (DK6 ratio up, NG), saved as deckDesign.exposure = 2; top bars at 5 in -> DK6 OK;
//   3. 0 KaTeX errors, 0 console errors.
//   node tests/smoke/steel-bridge-deck-tscrack.mjs     (SBD_SHOT=<file.png>: the checks table with an expanded crack control step, dsf 2)
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/steel-bridge/index.html'), SHOT = process.env.SBD_SHOT || '';
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1500, vh: SHOT ? 3400 : 1100, ...(SHOT ? { dsf: 2 } : {}) });
try {
  await p.waitForFunction(() => window.SBDDeckUI && window.SBDDeck && document.querySelector('#inTabs [data-itab="proj"]') && document.getElementById('out').innerText.length > 20, null, { timeout: 120000 });
  const otab = async t => { await p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t); await p.waitForTimeout(250); };
  const itab = async t => { await p.evaluate(t => document.querySelector(`#inTabs [data-itab="${t}"]`).click(), t); await p.waitForTimeout(150); };
  const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('sbd2.project.current') || 'null'));
  const row = id => p.evaluate(id => { const r = document.querySelector(`#out tr[data-dkck="${id}"]`); return r ? [...r.children].map(c => c.innerText.trim()) : null; }, id);
  const setIn = async (id, v) => { await p.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]); await p.waitForTimeout(300); };

  // 1. on
  await otab('dk'); await p.click('#dk_turnOn'); await p.waitForSelector('#out tr[data-dkck="DK6"]');
  const r5 = await row('DK5'), r6 = await row('DK6');
  assert.match(r5[0], /^DK5 Deck shrinkage and temperature reinforcement/); assert.match(r5[2], /6\.00\s*in$/); assert.match(r5[3], /18\.00\s*in$/); assert.deepEqual([r5[4], r5[5]], ['0.333', 'OK']);
  assert.match(r6[0], /^DK6 Deck crack control/); assert.match(r6[1], /^Negative moment at the design section, top bars/); assert.match(r6[1], /\(bar stress\)/); assert.match(r6[2], /29\.98\s*ksi$/); assert.match(r6[3], /36\.00\s*ksi$/); assert.deepEqual([r6[4], r6[5]], ['0.833', 'OK']);
  assert.match(await p.locator('#out #dk-gov').innerText(), /Governing: DK2[\s\S]*all checks OK/);
  assert.equal(await p.locator('#out #dk-ts tr[data-dkts="tl-none"]').count(), 1); assert.match(await p.locator('#out #dk-ts').innerText(), /Not checked: bars not entered/);
  assert.equal(await p.locator('#out #dk-cr tr[data-dkcr]').count(), 4);
  await p.evaluate(() => document.querySelector('#out tr[data-dkck="DK6"] a[href^="#st-"]').click()); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => document.querySelector('#out details.sg-t[data-sgk="crn1"]').open), true, 'the § link opens the topic of its step');
  assert.match(await p.evaluate(() => document.getElementById('st-dk.crn1.fl').innerText), /29\.98.*36\.00/s);
  assert.match(await p.evaluate(() => document.getElementById('st-dk.crn1.s').innerText), /6\.00.*7\.53/s);
  assert.match(await p.evaluate(() => document.getElementById('st-dk.crn1.dc').innerText), /2\.814/);
  assert.equal(await p.evaluate(() => document.querySelectorAll('#out .katex-error').length), 0);
  if (SHOT) {
    // the checks table and the expanded worked steps of DK6's governing case, side by side in one picture (display only: a copy of the open
    // topic placed under the table for the screenshot, removed after)
    await p.evaluate(() => { const g = document.getElementById('dk-gov'), d = document.querySelector('#out details.sg-t[data-sgk="crn1"]'), w = document.createElement('div');
      w.id = 'shotwrap'; g.parentNode.insertBefore(w, g); w.appendChild(g); const c = d.cloneNode(true); c.open = true; c.style.marginTop = '8px'; w.appendChild(c); w.scrollIntoView({ block: 'start' }); });
    await p.waitForTimeout(300); await p.locator('#shotwrap').screenshot({ path: SHOT });
    await p.evaluate(() => { const w = document.getElementById('shotwrap'); w.parentNode.insertBefore(document.getElementById('dk-gov'), w); w.remove(); });
  }
  ok('on: DK5 0.333 OK and DK6 0.833 OK (top bars, bar stress; s_max 7.53 in) with demand / limit cells; DK5 / DK6 tables; § opens the DK6 step; 0 KaTeX errors');

  // 2. exposure and spacing
  await itab('xsec'); assert.equal(await p.locator('#dk_exposure').inputValue(), '1');
  await p.selectOption('#dk_exposure', '2'); await p.waitForTimeout(400);
  let q = await row('DK6'); assert.ok(+q[4] > 1, q.join('|')); assert.equal(q[5], 'NG', q.join('|')); assert.match(q[1], /Class 2/);
  let S = await saved(); if (S) assert.equal(S.deckDesign.exposure, 2);
  await p.selectOption('#dk_exposure', '1'); await p.waitForTimeout(300); await setIn('dk_sTop', '5');
  q = await row('DK6'); assert.equal(q[5], 'OK', q.join('|'));
  ok(`exposure Class 2: DK6 ratio up and saved (exposure 2); top bars at 5 in: DK6 ${q[4]} OK`);
  assert.deepEqual(errs, [], 'console errors');
  console.log(`\nsteel-bridge-deck-tscrack: ${n} checks passed`);
} catch (e) { console.error('FAIL', e); process.exitCode = 1; } finally { await b.close(); }
