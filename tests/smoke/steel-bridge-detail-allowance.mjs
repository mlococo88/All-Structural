#!/usr/bin/env node
// Browser smoke test of the girder steel detail allowance on the Loads input tab (SBALLOW, 2026-11-24). apps/steel-bridge/index.html with
// the built-in project (xs.allow 5 %), headless Chromium (tests/lib.mjs openPage):
//   1. Analysis settings: no editable steelAllowPct box (the loads module supplies the allowance); the value used, read-only (disabled),
//      5, with its source and a link to the entry;
//   2. xs.allow = 3 ("Wearing surface, forms and steel"): the read-only value follows (3); saved analysis.steelAllowPct unchanged;
//   3. the link opens the Settings window (SET, 2026-11-26: the field moved there) at Superimposed dead load, the field in view; 0 console errors.
//   node tests/smoke/steel-bridge-detail-allowance.mjs [screenshot.png]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shot = process.argv[2] || '';
const FILE = path.join(REPO, 'apps/steel-bridge/index.html');
const saved = p => p.evaluate(() => JSON.parse(localStorage.getItem('sbd2.project.current') || '{}'));
const A = await openPage(FILE, { vw: 1440, vh: 1000, dsf: shot ? 2 : undefined });
try {
  const p = A.p;
  await p.waitForSelector('#tabBar [data-otab="loads"]');
  await p.click('#inTabs [data-itab="loads"]'); await p.waitForSelector('#an_a_steelAllowPct_used');
  const S0 = (await saved(p)).analysis || {};
  // 1.
  assert.equal(await p.$('#inPanes #an_a_steelAllowPct'), null, 'no editable box while the loads module gives the allowance');
  assert.equal(await p.inputValue('#an_a_steelAllowPct_used'), '5'); assert.ok(await p.isDisabled('#an_a_steelAllowPct_used'));
  let note = await p.evaluate(() => document.getElementById('an_a_steelAllowPct_used').closest('.fRow').nextElementSibling.textContent);
  assert.match(note, /used by the analysis of this girder: 5\.0 %, from the loads module: Steel detail allowance/);
  // 2.
  // SET (2026-11-26): the Steel detail allowance moved to the Settings window (Superimposed dead load); the window's copy edits the same input
  const s = '[id="sbs-i_xs.allow"]'; await p.click('#sbGear'); await p.click('[data-sbsg="sdl"]'); await p.fill(s, '3'); await p.dispatchEvent(s, 'change'); await p.waitForTimeout(400); await p.click('#sbSetSave');
  await p.waitForSelector('#an_a_steelAllowPct_used'); assert.equal(await p.inputValue('#an_a_steelAllowPct_used'), '3');
  const P1 = await saved(p); assert.equal(P1.xs.allow, 3); assert.equal((P1.analysis || {}).steelAllowPct, S0.steelAllowPct, 'analysis.steelAllowPct unchanged');
  if (shot) { const el = await p.$('#an-settings'); await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: shot }); console.log(`  screenshot ${shot}`); }
  // 3.
  await p.click('#an-settings a[data-sbset="xs.allow"]'); await p.waitForTimeout(300);   // SET (2026-11-26): the field moved to the Settings window; the link opens it there
  const vis = await p.evaluate(() => { const e = document.getElementById('sbs-i_xs.allow'), r = e.getBoundingClientRect(), q = document.getElementById('sbSetPane').getBoundingClientRect(); return { open: window.SBDSettings.isOpen(), g: document.querySelector('#sbSet [aria-selected="true"]').dataset.sbsg, inView: r.top >= q.top && r.bottom <= q.bottom }; });
  assert.equal(vis.open, true); assert.equal(vis.g, 'sdl'); assert.ok(vis.inView, 'the Steel detail allowance field in view');
  assert.deepEqual(A.errs, [], "console errors");
  console.log('PASS steel-bridge-detail-allowance: read-only allowance 5 -> 3 with its link; saved settings unchanged; 0 console errors');
} finally { await A.b.close(); }
