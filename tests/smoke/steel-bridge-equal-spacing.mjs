#!/usr/bin/env node
// Browser smoke test of the equal girder spacing option (EQSP, 2026-11-09; engineer: "allow an option to set the exterior girder spacing and
// then allow the girders to be equally spaced"; definition 2026-11-09: S = W_cc / (N_b − 1), W_cc = ℄ to ℄ of the exterior girders).
// apps/steel-bridge/index.html with the built-in project, headless Chromium (tests/lib.mjs openPage):
//   1. the built-in project opens in Individual mode (the per-bay table drawn, no spMode saved);
//   2. Equal: W_cc starts at Σ bays = 38 ft (S = 9.5 ft, the same bays); N_b = 4 recomputes S = 38/3; W_cc = 40 -> S = 13.333 ft written into
//      xs.bays, the step worked on screen, the deck width out to out shown; the per-bay table hidden;
//   3. the Loads & LLDF, Analysis, Flexure and Cross-frames tabs of this project = those of a project opened in Individual mode with the
//      same spacings entered (no spMode, no W_cc); the report works S;
//   4. back to Individual: the bays are kept as editable entries;
//   5. W_cc = 0 -> error; W_cc = 60 (S = 20 ft > 16 ft) -> the LLDF range warning; 0 console errors.
//   node tests/smoke/steel-bridge-equal-spacing.mjs [shotDir]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shotDir = process.argv[2] || '';
const FILE = path.join(REPO, 'apps/steel-bridge/index.html');
const settle = (p, t = 240000) => p.waitForFunction(() => !document.querySelector('#out .alert.stale:not([hidden])') && !/Calculating|updating/.test((document.querySelector('#autoMsg') || {}).textContent || ''), null, { timeout: t });
const saved = p => p.evaluate(() => JSON.parse(localStorage.getItem('sbd2.project.current') || '{}'));
const setv = async (p, dp, v) => { const s = `#inPanes [data-path="${dp}"]`; await p.fill(s, String(v)); await p.dispatchEvent(s, 'change'); await p.waitForTimeout(200); };
const tabText = async (p, k) => { await p.click(`#tabBar [data-otab="${k}"]`); await settle(p); await p.waitForTimeout(300); return p.evaluate(() => document.getElementById('out').innerText); };
const OUT = ['loads', 'an', 'flex', 'cf'];
const allErrs = [];

const A = await openPage(FILE, { vw: 1440, vh: 1000 });
let ind = null;
try {
  const p = A.p;
  await p.waitForSelector('#tabBar [data-otab="loads"]');
  await p.click('#inTabs [data-itab="xsec"]');
  // 1. Individual by default
  assert.equal(await p.inputValue('#inPanes [data-path="xs.spMode"]'), 'individual');
  assert.ok(await p.$('#inPanes [id="i_xs.bays"]'), 'per-bay spacings drawn');
  assert.equal(await p.$('#inPanes [data-path="xs.Wcc"]'), null);
  // 2. Equal
  await p.selectOption('#inPanes [data-path="xs.spMode"]', 'equal'); await p.waitForTimeout(300);
  let P = await saved(p); assert.equal(P.xs.spMode, 'equal'); assert.equal(P.xs.Wcc, 38); assert.deepEqual(P.xs.bays, [9.5, 9.5, 9.5, 9.5]);
  assert.equal(await p.$('#inPanes [id="i_xs.bays"]'), null, 'per-bay spacings hidden in Equal mode');
  await setv(p, 'xs.nb', 4); P = await saved(p); assert.equal(P.xs.bays.length, 3); P.xs.bays.forEach(v => assert.ok(Math.abs(v - 38 / 3) < 1e-12));
  await setv(p, 'xs.Wcc', 40); P = await saved(p); assert.deepEqual(P.xs.bays, [40 / 3, 40 / 3, 40 / 3]);
  const card = await p.evaluate(() => document.querySelector('#inPanes [data-path="xs.Wcc"]').closest('.secBody').innerText);
  assert.match(card, /13\.333/); assert.match(card, /Deck width out to out = ohL \+ Wcc \+ ohR = 3\.25 \+ 40\.00 \+ 3\.25 = 46\.50 ft/);
  if (shotDir) { await p.evaluate(() => document.querySelector('#inPanes [data-path="xs.Wcc"]').scrollIntoView({ block: 'center' })); await p.screenshot({ path: path.join(shotDir, 'equal-1440.png') }); }
  // 3. outputs, then the same spacings in Individual mode in a fresh page
  const eqOut = {}; for (const k of OUT) eqOut[k] = await tabText(p, k);
  const rpt = await tabText(p, 'rpt'); assert.match(rpt, /Girder spacing \(girders equally spaced\)/); assert.match(rpt, /13\.333/);
  ind = JSON.parse(JSON.stringify(P)); delete ind.xs.spMode; delete ind.xs.Wcc;
  const B = await openPage(FILE, { vw: 1440, vh: 1000, ls: { 'sbd2.project.current': JSON.stringify(ind), 'sbd2.ui': JSON.stringify({ itab: 'xsec', otab: 'loads' }) } });
  try {
    await B.p.waitForSelector('#tabBar [data-otab="loads"]');
    assert.equal(await B.p.inputValue('#inPanes [data-path="xs.spMode"]'), 'individual');
    for (const k of OUT) assert.equal(await tabText(B.p, k), eqOut[k], `${k} tab: Equal mode = Individual mode with the same spacings`);
    allErrs.push(...B.errs);
  } finally { await B.b.close(); }
  // 4. back to Individual: the bays kept, editable
  await p.selectOption('#inPanes [data-path="xs.spMode"]', 'individual'); await p.waitForTimeout(300);
  P = await saved(p); assert.equal(P.xs.spMode, 'individual'); assert.deepEqual(P.xs.bays, [40 / 3, 40 / 3, 40 / 3]);
  assert.ok(await p.$('#inPanes [id="i_xs.bays"]'), 'per-bay spacings drawn again');
  // 5. validation
  await p.selectOption('#inPanes [data-path="xs.spMode"]', 'equal'); await p.waitForTimeout(300);
  P = await saved(p); assert.ok(Math.abs(P.xs.Wcc - 40) < 1e-9);
  await setv(p, 'xs.Wcc', 0);
  assert.ok(await p.evaluate(() => document.querySelector('#inPanes [data-path="xs.Wcc"]').classList.contains('bad')), 'W_cc = 0 marked');
  assert.match(await p.evaluate(() => document.querySelector('#inPanes [data-path="xs.Wcc"]').closest('.secBody').innerText), /must be positive/);
  await setv(p, 'xs.Wcc', 60);
  assert.match(await p.evaluate(() => document.querySelector('#inPanes [data-path="xs.Wcc"]').closest('.secBody').innerText), /S = 20\.000 ft is outside the range of applicability/);
  allErrs.push(...A.errs);
} finally { await A.b.close(); }
if (shotDir) {   // 390 px
  const C = await openPage(FILE, { vw: 390, vh: 900, ls: { 'sbd2.project.current': JSON.stringify(Object.assign(ind, { xs: Object.assign(ind.xs, { spMode: 'equal', Wcc: 40 }) })), 'sbd2.ui': JSON.stringify({ itab: 'xsec' }) } });
  try { await C.p.waitForSelector('#inPanes [data-path="xs.Wcc"]'); await C.p.evaluate(() => document.querySelector('#inPanes [data-path="xs.Wcc"]').scrollIntoView({ block: 'center' }));
    await C.p.waitForTimeout(300); await C.p.screenshot({ path: path.join(shotDir, 'equal-390.png') }); allErrs.push(...C.errs); } finally { await C.b.close(); }
}
assert.deepEqual(allErrs, [], 'console errors');
console.log('ok steel-bridge-equal-spacing');
