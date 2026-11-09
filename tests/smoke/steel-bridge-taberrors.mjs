#!/usr/bin/env node
// Browser smoke test (SPERR2, 2026-11-09): an output-tab Calculate that ends in an error shows its message instead of leaving the tab
// "out of date" (#1263 fixed the Field splices tab; this is the same fix on the Flexure, Shear & stiffeners, Fatigue, Rating, Welds and
// Constructibility tabs). apps/steel-bridge/index.html with the built-in project, headless Chromium (tests/lib.mjs openPage). On each tab:
//   1. the default demands give results (no error);
//   2. demands "Custom (entered)" with the empty Custom table: after the auto-run (#1260) the tab is not out of date, the status is not
//      "Calculating…", and the error message is shown;
//   3. back to the tab's first source: results again.
//   0 console errors.
//   node tests/smoke/steel-bridge-taberrors.mjs
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const t0 = Date.now();
const { b, p, errs, blocked } = await openPage(path.join(REPO, 'apps/steel-bridge/index.html'), { vw: 1400, vh: 1000 });
const busy = () => !!document.querySelector('#out .alert.stale:not([hidden])') || /Calculating|updating/.test((document.querySelector('#autoMsg') || {}).textContent || '');
const settle = (t = 240000) => p.waitForFunction(busy => !new Function('return (' + busy + ')()')(), String(busy), { timeout: t });
const out = () => p.evaluate(() => { const o = document.getElementById('out'); return { err: [...o.querySelectorAll('.alert.err')].map(e => e.innerText).join(' | '),
  stale: !!o.querySelector('.alert.stale:not([hidden])'), auto: (document.querySelector('#autoMsg') || {}).textContent || '', n: o.textContent.length }; });
// tab, its demand-source select, the expected message with the empty Custom table
const TABS = [
  ['flex', 'fx_src', /No rows entered/],
  ['shear', 'sh_src', /No rows entered/],
  ['fat', 'fa_src', /No rows entered/],
  ['rt', 'rt_src', /No rows entered/],
  ['wt', 'wt_src', /No rows entered/],
  ['cn', 'cn_src', /No rows entered/],
];
const done = [];
try {
  await p.waitForSelector('#tabBar [data-otab="flex"]');
  for (const [t, sel, re] of TABS) {
    await p.click(`#tabBar [data-otab="${t}"]`);
    await p.waitForSelector(`#out #${sel}`); await settle();
    const src0 = await p.inputValue(`#out #${sel}`);
    let o = await out();
    assert.ok(!o.stale && !o.err, `${t}: default source ${src0} must give results (${o.err})`);
    await p.selectOption(`#out #${sel}`, 'custom');
    await p.waitForTimeout(300);
    await settle(60000);
    o = await out();
    assert.ok(!o.stale, `${t}: empty Custom table: the tab must not stay out of date`);
    assert.ok(!/Calculating/.test(o.auto), `${t}: the status must not stay on "Calculating…"`);
    assert.ok(o.err, `${t}: the error message must be shown`);
    assert.match(o.err, re, `${t}: ${o.err}`);
    const msg = o.err;
    await p.selectOption(`#out #${sel}`, src0); await p.waitForTimeout(300); await settle();
    o = await out(); assert.ok(!o.stale && !o.err, `${t}: back to ${src0}: results again (${o.err})`);
    done.push(`${t}: ${msg.slice(0, 120)}`);
  }
  assert.deepEqual(errs, [], 'console errors');
  for (const d of done) console.log('ok ', d);
  console.log(`ok  ${done.length} tabs show the Calculate error instead of "out of date"; 0 console errors (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (blocked.size) console.log('    blocked requests:', [...blocked].join(', '));
} catch (e) {
  console.log('FAIL', e.message, '\n console errors:', errs.slice(0, 5)); process.exitCode = 1;
} finally { await b.close(); }
