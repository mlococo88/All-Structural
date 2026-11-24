#!/usr/bin/env node
// Browser smoke test (UNSTF, 2026-11-24; ui/shear.js inputs): the Stiffeners input tab with an unstiffened web — Steel Bridge Design, built-in project:
//   1. Stiffened: every stiffener input enabled, no "Not used" note. Per-bay entries set (Set this girder's bays) and spacing "per bay".
//   2. Web → Unstiffened: Stiffener spacing, d_o/D, the per-bay table and its Set/Reset button disabled (greyed: a disabled fieldset, opacity),
//      the one-line note shown; still enabled: Web, Intermediate cross-frames at most, Type A and Type B plates, grades, bearing stiffeners.
//      The saved project (sbd2.project.current) is unchanged except stiffeners.layout.web; a click on the disabled button changes nothing.
//   3. The Shear & stiffeners results (panels, stations, stiffeners, bearings: ratios and statuses) with the web unstiffened equal those computed
//      directly by the module (SBDShearUI.build) on the same project; the hidden entries play no part: changing them in the project (d_o/D,
//      the bays) gives the same results.
//   4. Web → Stiffened: every field enabled again with its values (mode, d_o/D, the bays) intact. 5. A field with an input error (d_o/D blank)
//      stays enabled while unstiffened so that it can be fixed. 0 console errors.
//   node tests/smoke/steel-bridge-unstiffened.mjs [--shot <png>]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';
import { SBD_SEED } from './sbd-seed.mjs';

const si = process.argv.indexOf('--shot'), SHOT = si > 0 ? process.argv[si + 1] : null;
const t0 = Date.now();
const { b, p, errs } = await openPage(path.join(REPO, 'apps/steel-bridge/index.html'), { vw: 1440, vh: 1400, ls: { ...SBD_SEED }, dsf: SHOT ? 2 : undefined });
const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('sbd2.project.current')));
const dis = sel => p.$eval(sel, e => e.disabled || !!e.closest('fieldset[disabled]'));
const F = id => `[id="i_${id}"]`;
const OFF = [F('stiffeners.layout.mode'), F('stiffeners.layout.doRatio'), '#stf_fill', '[data-path="stiffeners.layout.bays.0.n"]'];
const ON = [F('stiffeners.layout.web'), F('stiffeners.layout.frames.Lb'), F('stiffeners.transverse.gS'), F('stiffeners.transverse.types.A.bt'), F('stiffeners.transverse.types.A.tp'),
  F('stiffeners.transverse.types.B.bt'), F('stiffeners.transverse.types.B.tp'), F('stiffeners.bearing.types.A.bt'), F('stiffeners.bearing.types.B.tp'), F('stiffeners.bearing.ed')];
// the module's results for girder 0, as numbers and statuses (no HTML)
const results = () => p.evaluate(() => { const P = JSON.parse(localStorage.getItem('sbd2.project.current')), R = window.SBDShearUI.build({ P, g: 0 });
  if (R.err) return { err: R.err }; const r = x => (typeof x === 'number' ? +x.toFixed(9) : x);
  return { pan: R.panels.rows.map(q => [r(q.p), r(q.q), r(q.d), q.end, q.stiff, r(q.r)]), st: R.stations.map(s => s.checks.map(c => [c.id, r(c.ratio), c.inUse])),
    ts: R.TS ? R.TS.rows.map(x => [x.type, r(x.x)]) : null, tsC: (R.tsC || []).map(c => [c.id, c.items.map(i => [r(i.r), i.st])]), bsC: (R.bsC || []).map(c => [c.id, c.items.map(i => [r(i.r), i.st])]) }; });
async function setSel(sel, v) { await p.selectOption(sel, v); await p.waitForTimeout(300); }
try {
  await p.waitForSelector('#inTabs [data-itab="stf"]');
  await p.click('#inTabs [data-itab="stf"]'); await p.waitForSelector(F('stiffeners.layout.web'));
  // 1
  if (await p.$eval(F('stiffeners.layout.web'), e => e.value) !== 'stiffened') await setSel(F('stiffeners.layout.web'), 'stiffened');
  await p.click('#stf_fill'); await p.waitForTimeout(300);
  await setSel(F('stiffeners.layout.mode'), 'bays');
  await p.fill('[data-path="stiffeners.layout.bays.0.n"]', '3'); await p.press('[data-path="stiffeners.layout.bays.0.n"]', 'Tab'); await p.waitForTimeout(300);
  for (const s of [...OFF, ...ON]) assert.equal(await dis(s), false, 'stiffened: enabled ' + s);
  assert.equal(await p.$$eval('.stfOffNote', e => e.length), 0);
  const P1 = await saved(); assert.equal(P1.stiffeners.layout.mode, 'bays'); assert.ok(P1.stiffeners.layout.bays.length > 1); assert.equal(P1.stiffeners.layout.bays[0].n, 3);
  console.log(`  ok   stiffened: all enabled; ${P1.stiffeners.layout.bays.length} bays entered, spacing per bay`);
  // 2
  await setSel(F('stiffeners.layout.web'), 'unstiffened');
  for (const s of OFF) assert.equal(await dis(s), true, 'unstiffened: disabled ' + s);
  for (const s of ON) assert.equal(await dis(s), false, 'unstiffened: still enabled ' + s);
  const notes = await p.$$eval('.stfOffNote', e => e.map(x => x.textContent));
  assert.equal(notes.filter(t => t === 'Not used: the web is unstiffened; only the connection plates at the cross-frames bound the panels. Entries are kept for when you switch back to Stiffened.').length, 2, notes.join(' | '));
  assert.equal(await p.$eval('fieldset.stfOff[disabled]', e => getComputedStyle(e).opacity), '0.5');
  const P2 = await saved(); assert.equal(P2.stiffeners.layout.web, 'unstiffened');
  assert.deepEqual({ ...P2.stiffeners, layout: { ...P2.stiffeners.layout, web: 'stiffened' } }, P1.stiffeners, 'only the web changed');
  await p.click('#stf_fill', { force: true }).catch(() => {}); await p.waitForTimeout(300);
  assert.deepEqual(await saved(), P2, 'a click on the disabled button changes nothing');
  if (SHOT) {   // the two cards (layout, per-bay), the panel unclipped for the picture only (a reload afterwards restores the page)
    await p.evaluate(() => { const ip = document.getElementById('inputPanel'); ip.style.overflow = 'visible'; ip.style.maxHeight = 'none'; ip.style.height = 'auto'; });
    const secs = await p.$$('#inPanes section.sec:visible'), a = await secs[0].boundingBox(), c = await secs[1].boundingBox();
    await p.screenshot({ path: SHOT, fullPage: true, clip: { x: a.x, y: a.y, width: Math.max(a.width, c.width), height: c.y + c.height - a.y } });
    await p.reload(); await p.waitForSelector('#inTabs [data-itab="stf"]'); await p.click('#inTabs [data-itab="stf"]'); await p.waitForSelector(F('stiffeners.layout.web')); }
  console.log(`  ok   unstiffened: ${OFF.length} inputs disabled (greyed), ${ON.length} still enabled, the note shown; saved project: only the web changed`);
  // 3
  const R0 = await results(); assert.ok(!R0.err, R0.err);
  assert.ok(!R0.ts || R0.ts.every(t => t[0] === 'B'), 'connection plates only');
  const R1 = await p.evaluate(() => { const P = JSON.parse(localStorage.getItem('sbd2.project.current')); P.stiffeners.layout.doRatio = 0.5; P.stiffeners.layout.mode = 'uniform'; P.stiffeners.layout.bays = [];
    P.stiffeners.transverse.types.A.bt = 3; const R = window.SBDShearUI.build({ P, g: 0 }); return JSON.stringify([R.panels.rows.map(q => [q.p, q.q, q.r]), R.stations.map(s => s.checks.map(c => c.ratio))]); });
  const R0s = await p.evaluate(() => { const P = JSON.parse(localStorage.getItem('sbd2.project.current')); const R = window.SBDShearUI.build({ P, g: 0 }); return JSON.stringify([R.panels.rows.map(q => [q.p, q.q, q.r]), R.stations.map(s => s.checks.map(c => c.ratio))]); });
  assert.equal(R1, R0s, 'the hidden entries play no part in the results');
  console.log(`  ok   unstiffened results: ${R0.pan.length} panels, ${R0.st.length} stations, ${R0.ts ? R0.ts.length : 0} connection plates; the same with other d_o/D, mode, bays and Type A b_t`);
  // 4
  await setSel(F('stiffeners.layout.web'), 'stiffened');
  for (const s of [...OFF, ...ON]) assert.equal(await dis(s), false, 'stiffened again: enabled ' + s);
  assert.equal(await p.$eval(F('stiffeners.layout.mode'), e => e.value), 'bays');
  assert.equal(await p.$eval('[data-path="stiffeners.layout.bays.0.n"]', e => e.value), '3');
  assert.deepEqual((await saved()).stiffeners, P1.stiffeners, 'values intact');
  console.log('  ok   stiffened again: all enabled, mode, d_o/D and the bays intact');
  // 5: a field with an input error stays enabled while unstiffened (engine/model.js still checks it), so it can be fixed
  await p.fill(F('stiffeners.layout.doRatio'), ''); await p.press(F('stiffeners.layout.doRatio'), 'Tab'); await p.waitForTimeout(300);
  await setSel(F('stiffeners.layout.web'), 'unstiffened');
  assert.equal(await dis(F('stiffeners.layout.doRatio')), false, 'in error: enabled'); assert.equal(await dis('#stf_fill'), true);
  await p.fill(F('stiffeners.layout.doRatio'), '1'); await p.press(F('stiffeners.layout.doRatio'), 'Tab'); await p.waitForTimeout(300);
  await p.click('#inTabs [data-itab="mat"]'); await p.click('#inTabs [data-itab="stf"]'); await p.waitForSelector(F('stiffeners.layout.doRatio'));
  assert.equal(await dis(F('stiffeners.layout.doRatio')), true, 'fixed: disabled again (the next time the tab is drawn)');
  console.log('  ok   an input error on d_o/D keeps it enabled while unstiffened; fixed, it is greyed again when the tab is next drawn');
  assert.deepEqual(errs, [], 'console errors');
  console.log(`steel-bridge-unstiffened: all passed, 0 console errors (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
} finally { await b.close(); }
