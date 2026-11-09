#!/usr/bin/env node
// Browser smoke test of the Field splices tab with custom values (SPERR, 2026-11-09; engineer: "I tried entering custom values in the field
// splice tab but nothing happened when I press Calculate"). apps/steel-bridge/index.html with the built-in project, headless Chromium
// (tests/lib.mjs openPage):
//   1. Demands "Custom (entered)" with an empty table: Calculate shows the message (before SPERR the tab stayed "out of date", nothing shown);
//      a row at the FS1 station gives results, and a changed value (M_DC1) changes them;
//   2. back to this project's analysis, "Keep these plates" (entered plates, auto-design off): every entered plate and bolt field of the
//      Splices input tab (top and bottom flange, web) and the bolt / basis settings, changed one at a time, change the result shown for FS1
//      and are saved in the project;
//   0 console errors.
//   node tests/smoke/steel-bridge-splices.mjs
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const t0 = Date.now();
const { b, p, errs, blocked } = await openPage(path.join(REPO, 'apps/steel-bridge/index.html'), { vw: 1400, vh: 1000 });
// AUTO (#1260): the tab runs itself; settle() waits until it is not out of date and no run is pending
const settle = (t = 240000) => p.waitForFunction(() => !document.querySelector('#out .alert.stale:not([hidden])') && !/Calculating|updating/.test((document.querySelector('#autoMsg') || {}).textContent || ''), null, { timeout: t });
const out = () => p.evaluate(() => { const o = document.getElementById('out'); return { text: o.textContent, list: [...o.querySelectorAll('.sp-list tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ')),
  err: [...o.querySelectorAll('.alert.err')].map(e => e.innerText).join(' | '), stale: !!o.querySelector('.alert.stale:not([hidden])') }; });
const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('sbd2.project.current') || '{}'));
const cell = async (id, v) => { const s = `#out [data-cd="${id}"]`; await p.fill(s, String(v)); await p.dispatchEvent(s, 'change'); await p.waitForTimeout(150); };
try {
  await p.waitForSelector('#tabBar [data-otab="spl"]');
  await p.click('#inTabs [data-itab="spl"]');
  await p.click('#tabBar [data-otab="spl"]');
  await settle();
  // 1. custom demands
  await p.selectOption('#sp_src', 'custom');
  await settle(30000);
  let o = await out();
  assert.ok(!o.stale, 'empty Custom table: the tab must not stay out of date after Calculate');
  assert.match(o.err, /Custom demands: No rows entered/, o.err);
  await cell('r:0:x', 82); await cell('r:0:M_DC1', 500); await cell('r:0:V_DC1', 50); await cell('r:0:M_LLpos', 1000); await cell('r:0:M_LLneg', -1000); await cell('r:0:V_LL', 80);
  await p.waitForTimeout(800); await settle();
  const c1 = await out();
  assert.equal(c1.list.length, 1, c1.list.join('\n')); assert.match(c1.text, /MDC1500\.0 kip-ft/);
  await cell('r:0:M_DC1', 2500); await p.waitForTimeout(800); await settle();
  const c2 = await out();
  assert.match(c2.text, /MDC12,?500\.0 kip-ft/); assert.notEqual(c1.list[0], c2.list[0], 'M_DC1 changed: the FS1 row must change');
  // a row error (no x) is shown after Calculate, not left "out of date"
  await cell('r:0:x', ''); await p.waitForTimeout(800); await settle(30000);
  o = await out(); assert.ok(!o.stale); assert.match(o.err, /Row 1: enter x/, o.err);
  // 2. entered plates and bolts
  await p.selectOption('#sp_src', 'analysis'); await settle();
  await p.click('#sp_keep'); await p.waitForTimeout(800); await settle();
  assert.equal((await saved()).splices.auto, false);
  const fs1 = async () => { const t = (await out()).text; return t.slice(t.indexOf('FS1 at 82.00 ft: demands and design')); };
  let prev = await fs1(); assert.ok(prev.length > 1000, 'FS1 detail shown');
  const PL = ['nl', 'g', 'g0', 'nr', 's', 'ef', 'ep', 'bo', 'to', 'bi', 'ti'], WB = ['h', 't', 'nr', 'sv', 'nc', 'sh', 'ew', 'ewp'];
  const paths = [...['top', 'bot'].flatMap(k => PL.map(f => `splices.plates.0.${k}.${f}`)), ...['top', 'bot'].map(k => `splices.plates.0.${k}.inner`), ...WB.map(f => `splices.plates.0.web.${f}`),
    'splices.code', 'splices.gP', 'splices.prs', 'splices.bolts.d', 'splices.bolts.gr', 'splices.bolts.thr', 'splices.bolts.cls', 'splices.bolts.prep', 'splices.bolts.gap', 'splices.bolts.minLines', 'splices.clr.cw', 'splices.clr.cv'];
  const done = [];
  for (const dp of paths) {
    const s = `#inPanes [data-path="${dp}"]`, el = await p.$(s); assert.ok(el, `input ${dp} drawn`);
    const tag = await el.evaluate(e => e.tagName);
    let nv;
    if (tag === 'SELECT') { nv = await el.evaluate(e => { const o = [...e.options].find(q => !q.selected && q.value !== ''); return o.value; }); await p.selectOption(s, nv); }
    else { const v0 = +(await p.inputValue(s)); nv = /\.(nl|nr|nc)$|minLines$/.test(dp) ? v0 + 1 : /clr\./.test(dp) ? v0 + 0.5 : /gap$/.test(dp) ? v0 + 0.25 : +(v0 * 1.25 + 0.125).toFixed(4); await p.fill(s, String(nv)); await p.dispatchEvent(s, 'change'); }
    await p.waitForTimeout(700); await settle();
    const now = await fs1();
    assert.notEqual(now, prev, `${dp} → ${nv}: the FS1 result did not change`);
    const sv = dp.split('.').reduce((a, k) => (a == null ? a : a[k]), await saved());
    assert.equal(String(sv), String(nv), `${dp} saved`);
    prev = now; done.push(dp.replace('splices.', ''));
  }
  assert.deepEqual(errs, [], 'console errors');
  console.log(`ok  Custom demands: empty table and row errors shown after Calculate; M_DC1 500 → 2500 kip-ft changes FS1 ("${c1.list[0].slice(0, 60)}…" → "${c2.list[0].slice(0, 60)}…")`);
  console.log(`ok  ${done.length} entered plate / bolt / basis fields each change the FS1 result and are saved; 0 console errors (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (blocked.size) console.log('    blocked requests:', [...blocked].join(', '));
} catch (e) {
  console.log('FAIL', e.message, '\n console errors:', errs.slice(0, 5)); process.exitCode = 1;
} finally { await b.close(); }
