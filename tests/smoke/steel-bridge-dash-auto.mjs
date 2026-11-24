#!/usr/bin/env node
// Browser smoke test of the left check summary's auto-refresh (SBAR, 2026-11-24; ui/dash.js kick), headless Chromium (tests/lib.mjs openPage):
//   1. Run all on the built-in project (one girder type, the seed). An input change (web depth D of segment 1): "Inputs changed — updating…"
//      shows on the column at once, nothing runs before AUTO_MS (1 s) of quiet; then the run starts by itself (no click).
//   2. A second change while that run is in progress stops it (the run counter); keys typed in an input then hold the next run off (each key
//      answered in < 250 ms, no run while typing); the run of the new state starts ~1 s after the last key; the column ends up to date (the
//      longest main-thread task, the girder analysis, is printed).
//   3. The values of the auto-refresh equal those of "Run all" on the same project (the page reloaded with the autosave, Run all clicked):
//      every cell of every girder (ratio, RF, status, check, location, step).
//   4. The "Auto-refresh" box off: kept in sbd2.dashAuto_v1 ('0'); an input change leaves the values out of date with "Run all" (no run).
//      On again ('1'). 5. A blocking input error: no run. 0 console errors.
//   node tests/smoke/steel-bridge-dash-auto.mjs [--shot <png>]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';
import { SBD_SEED } from './sbd-seed.mjs';

const si = process.argv.indexOf('--shot'), SHOT = si > 0 ? process.argv[si + 1] : null;
const t0 = Date.now();
const FILE = path.join(REPO, 'apps/steel-bridge/index.html');
const { b, p, errs } = await openPage(FILE, { vw: 1440, vh: 1000, ls: { ...SBD_SEED }, dsf: SHOT ? 2 : undefined });
const st = () => p.evaluate(() => { const s = window.SBDSummaryUI.state(); return { busy: s.busy, prog: s.prog, pk: s.pk, run: !!s.list.length && s.list.every(G => G && Object.values(G.cells).every(q => q.st !== 'notrun')) }; });
const cells = () => p.evaluate(() => JSON.stringify(window.SBDSummaryUI.state().list.map(G => Object.fromEntries(Object.entries(G.cells).map(([k, q]) => [k, { r: q.r, rf: q.rf, st: q.st, check: q.check, loc: q.loc, step: q.step, ln: q.ln }])))));
const dashTxt = () => p.evaluate(() => document.getElementById('sbDashCol').innerText);
const D0 = '[data-path="girders.0.segments.0.D"]';
const busyAt = () => p.evaluate(() => window.__bs);
async function setD(v) { await p.click('#inTabs [data-itab="gird"]'); await p.fill(D0, String(v)); await p.$eval(D0, e => e.blur()); }
try {
  await p.waitForSelector('#sbDashCol .sdChip');
  // 1
  await p.click('#sbDashRun');
  await p.waitForFunction(() => { const s = window.SBDSummaryUI.state(); return !s.busy && s.list.length && s.list.every(G => G && Object.values(G.cells).every(q => q.st !== 'notrun')); }, null, { timeout: 600000, polling: 250 });
  const before = await cells();
  const D = await p.$eval(D0, e => +e.value);
  // counts the module runs (the result is the engine's own); __at(n, f): f once the n-th module of the run has returned (before the next tick)
  await p.evaluate(() => { window.__calls = []; const S = window.SBDSummary, r0 = S.run; S.run = function () { try { return r0.apply(this, arguments); } finally { window.__calls.push(Date.now()); const h = window.__hook; if (h && window.__calls.length === h.n) { window.__hook = null; setTimeout(h.f, 0); } } };
    window.__bs = 0; window.SBDSummaryUI.subscribe(s => { if (s.busy && !window.__bs) window.__bs = Date.now(); }); });
  await setD(D + 2);
  const tC = Date.now();
  await p.waitForFunction(() => /Inputs changed — updating…/.test(document.getElementById('sbDashCol').innerText), null, { timeout: 2000 });
  assert.equal((await st()).busy, false, 'nothing runs during the wait');
  await p.waitForFunction(() => window.SBDSummaryUI.state().busy, null, { timeout: 70000, polling: 50 });
  const tStart = await busyAt() - tC;   // the page's own time of the start (the wait above can end after the analysis' block)
  assert.ok(tStart >= 900, `the run starts after ~1 s of quiet (${tStart} ms)`);
  console.log(`  ok   an input change: "Inputs changed — updating…" at once; the run started by itself after ${tStart} ms (open tab first)`);
  // 2: a change during the run stops it; typing holds the next run off (keys answered at once); the run starts in the pause after
  // (the change is made from the page between the run's 2nd and 3rd module, so that the run is in progress)
  await p.evaluate(([D0, v]) => { window.__chg = 0; window.__hook = { n: window.__calls.length + 2, f: () => { const e = document.querySelector(D0); e.value = String(v); window.__busyAtChg = window.SBDSummaryUI.state().busy; window.__chg = Date.now(); window.__bs = 0; e.dispatchEvent(new Event('change', { bubbles: true })); } }; }, [D0, D + 4]);
  const b1 = await busyAt();
  await p.waitForFunction(() => window.__chg && /updating/.test(document.getElementById('sbDashCol').innerText) && !window.SBDSummaryUI.state().busy, null, { timeout: 120000, polling: 20 });
  const t1 = await p.evaluate(() => window.__chg), busy1 = await p.evaluate(() => window.__busyAtChg);
  assert.ok(busy1, 'the change was made during the run');
  await p.evaluate(() => { window.__lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration))).observe({ type: 'longtask', buffered: false }); } catch (e) { /* not supported */ } });
  const T0 = '[data-path="girders.0.segments.0.tw"]', lat = [];
  await p.focus(T0);
  for (let i = 0; i < 12; i++) { const a = Date.now(); await p.keyboard.press(i % 2 ? 'Backspace' : '1'); lat.push(Date.now() - a); assert.equal((await st()).busy, false, 'no run while typing'); await p.waitForTimeout(300); }
  const tType = Date.now() - 300;   // the last key
  await p.waitForFunction(() => window.SBDSummaryUI.state().busy, null, { timeout: 70000, polling: 50 });
  const quiet = await busyAt() - tType;
  const cl = await p.evaluate(([b1, t1, b2]) => ({ first: window.__calls.filter(t => t >= b1 && t <= t1).length, gap: window.__calls.filter(t => t > t1 && t < b2).length }), [b1, t1, await busyAt()]);
  assert.equal(cl.first, 2);
  assert.equal(cl.gap, 0, 'no module of the stopped run after the change');
  await p.$eval(T0, e => e.blur());   // value unchanged: no change event
  await p.waitForFunction(() => { const s = window.SBDSummaryUI.state(); return !s.busy && s.list.length && s.list.every(G => G && Object.values(G.cells).every(q => q.st !== 'notrun')); }, null, { timeout: 600000, polling: 250 });
  const fin = await p.evaluate(() => ({ txt: document.getElementById('sbDashCol').innerText }));
  assert.doesNotMatch(fin.txt, /out of date|updating/, 'the column is up to date');
  let auto = await cells();
  assert.notEqual(auto, before, 'the values follow the change');
  const lt = await p.evaluate(() => window.__lt.slice());
  const maxLt = lt.length ? Math.max(...lt) : 0;
  assert.ok(Math.max(...lat) < 250, 'keys answered while typing: ' + lat.join(', '));
  console.log(`  ok   a change during the run (after its module ${cl.first} of 8): no module of it after the change; 12 keys over 3.6 s held the next run off (key latency ${Math.min(...lat)}–${Math.max(...lat)} ms); it started ${quiet} ms after the last key; longest main-thread task ${maxLt.toFixed(0)} ms (${lt.length} over 50 ms: the girder analysis, one call, as Run all)`);
  if (SHOT) { await setD(D + 4.5); await p.waitForFunction(() => /updating/.test(document.getElementById('sbDashCol').innerText), null, { timeout: 2000, polling: 20 }); await p.locator('#sbDashCol').screenshot({ path: SHOT });
    await p.waitForFunction(() => { const s = window.SBDSummaryUI.state(); return !s.busy && s.list.length && s.list.every(G => G && Object.values(G.cells).every(q => q.st !== 'notrun')); }, null, { timeout: 600000, polling: 250 }); auto = await cells(); }
  // 3: equal to Run all on the same project
  const autoPk = (await st()).pk;
  await p.evaluate(() => localStorage.setItem('sbd2.dashAuto_v1', '0'));   // the reloaded page must not refresh by itself before the click
  await p.reload(); await p.waitForSelector('#sbDashCol .sdChip');
  assert.equal(await p.evaluate(() => JSON.stringify(window.SBDSummaryUI.state().list)), '[]');
  await p.click('#sbDashRun');
  await p.waitForFunction(() => { const s = window.SBDSummaryUI.state(); return !s.busy && s.list.length && s.list.every(G => G && Object.values(G.cells).every(q => q.st !== 'notrun')); }, null, { timeout: 600000, polling: 250 });
  assert.equal((await st()).pk, autoPk, 'the same project state');
  const manual = await cells();
  assert.equal(manual, auto, 'auto-refresh values = Run all values');
  console.log(`  ok   the auto-refresh values equal Run all's on the same project (${JSON.parse(auto).reduce((a, G) => a + Object.keys(G).length, 0)} cells)`);
  // 4: off
  assert.equal(await p.$eval('#sbDashAuto', e => e.checked), false);
  await setD(D + 2);
  await p.waitForTimeout(2500);
  assert.equal((await st()).busy, false); assert.match(await dashTxt(), /Inputs changed: values out of date\. Run all/);
  await p.check('#sbDashAuto'); assert.equal(await p.evaluate(() => localStorage.getItem('sbd2.dashAuto_v1')), '1');
  await p.waitForFunction(() => window.SBDSummaryUI.state().busy, null, { timeout: 70000, polling: 50 });   // turned on: the values out of date run
  await p.waitForFunction(() => { const s = window.SBDSummaryUI.state(); return !s.busy && s.list.length && s.list.every(G => G && Object.values(G.cells).every(q => q.st !== 'notrun')); }, null, { timeout: 600000, polling: 250 });
  console.log('  ok   Auto-refresh off (sbd2.dashAuto_v1 = 0): no run, "Run all" shown; on again: the values run');
  // 5: a blocking input error
  await setD(-5);
  await p.waitForTimeout(2500);
  assert.equal((await st()).busy, false, 'no run while an input error blocks');
  assert.match(await dashTxt(), /to fix|needs fixing/);
  await setD(D);
  await p.waitForFunction(() => window.SBDSummaryUI.state().busy, null, { timeout: 70000, polling: 50 });
  console.log('  ok   a blocking input error: no run; fixed: the run starts');
  assert.deepEqual(errs, [], 'console errors');
  console.log(`steel-bridge-dash-auto: all passed, 0 console errors (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
} finally { await b.close(); }
