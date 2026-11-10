#!/usr/bin/env node
// Browser smoke test (SBINV, 2026-11-10; engineer 2026-11-09: "Invalid input should be highlighted so the user can fix; results should not be
// displayed"): apps/steel-bridge/index.html, headless Chromium (tests/lib.mjs openPage).
//   1. A left sidewalk fence load entered with its position left blank: the banner "1 input needs fixing …" on every output tab, the field
//      outlined with its message beside it, a count on the Cross-section input tab, no verdict / PASS / FAIL / ratio on the Summary, the left
//      check column, the Flexure tab or the Report (also in print), the hand-off send and Auto design refused; the banner link opens the
//      input tab and focuses the field.
//   2. The position entered: the errors clear and the Flexure and Summary results return, identical to the same project entered validly in
//      a fresh page.
//   3. A saved project with a negative girder spacing: it loads unchanged (CLAUDE.md §5), the spacing's list row is marked, results blocked.
//   4. A saved project with no span: the banner names the span lengths; the Bridge layout tab is marked; results blocked.
//   0 console errors.
//   node tests/smoke/steel-bridge-invalid.mjs [--shots <dir>]
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const ai = process.argv.indexOf('--shots'), SHOTS = ai > 0 ? process.argv[ai + 1] : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const FILE = path.join(REPO, 'apps/steel-bridge/index.html');
const t0 = Date.now(), allErrs = [];
const busy = () => !!document.querySelector('#out .alert.stale:not([hidden])') || /Calculating|updating|Running/.test(((document.querySelector('#autoMsg') || {}).textContent || '') + ((document.querySelector('#out .sum-run') || {}).textContent || ''));
async function settle(p) {
  await p.waitForFunction(b => !new Function('return (' + b + ')()')(), String(busy), { timeout: 400000 });
  let a = await p.evaluate(() => document.getElementById('out').innerText);
  for (let k = 0; k < 20; k++) { await p.waitForTimeout(500); const c = await p.evaluate(() => document.getElementById('out').innerText); if (c === a) break; a = c; }
  return a;
}
const tab = async (p, t) => { await p.click(`#tabBar [data-otab="${t}"]`); await p.waitForTimeout(250); };
const outText = p => p.evaluate(() => document.getElementById('out').innerText);
const VERDICT = /\b(PASS|FAIL|REVIEW)\b|\bD\/C\b|\bOK\b|\bNG\b/;
async function setField(p, sel, v) { await p.fill(sel, v); await p.press(sel, 'Tab'); await p.waitForTimeout(300); }
const blockedOut = async (p, what) => {
  const o = await p.evaluate(() => ({ t: document.getElementById('out').innerText, banner: !!document.getElementById('icBanner'), none: !!document.getElementById('icNone') }));
  assert.ok(o.banner && o.none, `${what}: the banner and "Results not shown"`);
  assert.match(o.t, /Results not shown: fix the inputs above\./, what);
  assert.doesNotMatch(o.t.replace(/^[\s\S]*?\n\n/, ''), VERDICT, `${what}: no verdict`);
  return o.t;
};
const sumCells = p => p.evaluate(() => { const st = window.SBDSummaryUI.state(); return JSON.stringify(st.list.map(G => G.cells)); });

{ // 1–2
  const { b, p, errs, dialogs } = await openPage(FILE, { vw: 1440, vh: 1000 });
  try {
    await p.waitForSelector('#inTabs [data-itab="xsec"]');
    await p.click('#inTabs [data-itab="xsec"]');
    await setField(p, '[id="i_xs.sidewalks.L.w"]', '6');
    await setField(p, '[id="i_xs.sidewalks.L.fence"]', '0.05');
    // banner, field, tab marker
    const s = await p.evaluate(() => ({ banner: document.getElementById('icBanner') && document.getElementById('icBanner').innerText,
      bad: [...document.querySelectorAll('#inPanes .bad')].map(e => e.dataset.path), msg: [...document.querySelectorAll('#inPanes .ic-msg')].map(e => e.innerText),
      tabs: [...document.querySelectorAll('#inTabs button.has-err')].map(b => [b.dataset.itab, b.querySelector('.inDot').textContent]),
      dash: document.getElementById('sbDashCol').innerText }));
    assert.match(s.banner, /^1 input needs fixing before results can be shown/);
    assert.match(s.banner, /Cross-section › Left fence from deck edge: Left sidewalk railing or fence: its position from the deck edge must be on the left sidewalk/);
    assert.deepEqual(s.bad, ['xs.sidewalks.L.fenceX']);
    assert.equal(s.msg.length, 1); assert.match(s.msg[0], /its position from the deck edge/);
    assert.deepEqual(s.tabs, [['xsec', '1']]);
    assert.match(s.dash, /1 input needs fixing/); assert.doesNotMatch(s.dash, /\b(PASS|FAIL|REVIEW)\b|D\/C/, 'left column: no verdict');
    if (SHOTS) { await p.locator('[id="i_xs.sidewalks.L.fenceX"]').scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(SHOTS, 'invalid-1440.png') }); }
    // every output tab blocked (the Summary, Flexure and Report among them)
    const tabs = await p.evaluate(() => [...document.querySelectorAll('#tabBar [data-otab]')].map(b => b.dataset.otab));
    for (const t of tabs) { await tab(p, t); await blockedOut(p, t); }
    await tab(p, 'sum'); await p.waitForTimeout(1500); await blockedOut(p, 'Summary after a wait');
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'invalid-summary-1440.png') });
    await tab(p, 'rpt'); await p.emulateMedia({ media: 'print' });
    const pr = await p.evaluate(() => document.getElementById('outputPanel').innerText);
    await p.emulateMedia({ media: 'screen' });
    assert.match(pr, /1 input needs fixing/); assert.doesNotMatch(pr, VERDICT, 'Report print: the error list only');
    // hand-off and Auto design refused
    await p.click('#inTabs [data-itab="proj"]'); dialogs.length = 0;
    await p.click('[data-ho="subSend"]'); await p.waitForTimeout(300);
    assert.ok(dialogs.length === 1 && /^Nothing was sent: 1 input needs fixing first/.test(dialogs[0]), 'hand-off refused: ' + dialogs[0]);
    await p.click('[data-ho="subFile"]'); await p.waitForTimeout(300);
    assert.ok(dialogs.length === 2 && /^Nothing was exported/.test(dialogs[1]), 'export refused');
    await p.click('#inTabs [data-itab="ad"]'); await p.waitForSelector('#ad_run');
    assert.ok(await p.evaluate(() => document.getElementById('ad_run').disabled), 'Auto design: Run off');
    assert.match(await p.textContent('#ad_blocked'), /Auto design cannot run: 1 input needs fixing first/);
    // the banner link: the input tab, the field focused
    await tab(p, 'flex'); await p.click('#out [data-icgo="0"]'); await p.waitForTimeout(300);
    assert.deepEqual(await p.evaluate(() => [document.activeElement.dataset.path, document.querySelector('#inTabs [aria-selected="true"]').dataset.itab]), ['xs.sidewalks.L.fenceX', 'xsec']);
    // fixed: the errors clear and the results return
    await setField(p, '[id="i_xs.sidewalks.L.fenceX"]', '3');
    assert.deepEqual(await p.evaluate(() => [document.querySelectorAll('.bad,.ic-msg,#inTabs .has-err,#icBanner').length, window.SBDInputCheck.collect(JSON.parse(localStorage.getItem('sbd2.project.current'))).errors.length]), [0, 0]);
    const flexA = await settle(p);
    assert.match(flexA, VERDICT, 'Flexure results after the fix');
    await p.click('#inTabs [data-itab="ad"]');
    assert.ok(!(await p.evaluate(() => document.getElementById('ad_run').disabled)), 'Auto design: Run on again');
    await tab(p, 'sum'); await settle(p); const sumA = await sumCells(p);
    allErrs.push(...errs);
    // 2: the same project entered validly in a fresh page
    const q = await openPage(FILE, { vw: 1440, vh: 1000 });
    try {
      await q.p.waitForSelector('#inTabs [data-itab="xsec"]'); await q.p.click('#inTabs [data-itab="xsec"]');
      await setField(q.p, '[id="i_xs.sidewalks.L.w"]', '6'); await setField(q.p, '[id="i_xs.sidewalks.L.fenceX"]', '3'); await setField(q.p, '[id="i_xs.sidewalks.L.fence"]', '0.05');
      await tab(q.p, 'flex'); const flexB = await settle(q.p);
      assert.equal(flexA, flexB, 'Flexure: identical to the project entered validly');
      await tab(q.p, 'sum'); await settle(q.p); assert.equal(sumA, await sumCells(q.p), 'Summary: identical to the project entered validly');
      allErrs.push(...q.errs);
    } finally { await q.b.close(); }
    console.log('  ok   fence load with a blank position: banner, field, tab count, every output tab blocked, print, hand-off and Auto design refused; fixed: results identical to a valid entry');
  } finally { await b.close(); }
}

/* a saved project (the autosave), opened by a reload */
async function savedCase(name, edit, check) {
  const { b, p, errs } = await openPage(FILE, { vw: 1440, vh: 1000 });
  try {
    await p.waitForSelector('#inTabs [data-itab="xsec"]');
    const saved = await p.evaluate(src => { const M = window.SBDModel, P = M.defaultProject(); new Function('P', src)(P); M.save(localStorage, P); localStorage.setItem(M.KEYS.ui, JSON.stringify({ otab: 'sum', itab: 'proj' })); return localStorage.getItem(M.KEYS.current); }, edit);
    await p.reload(); await p.waitForSelector('#icBanner');
    await blockedOut(p, name + ': Summary');
    await check(p);
    assert.equal(await p.evaluate(() => localStorage.getItem('sbd2.project.current')), saved, name + ': the saved project is unchanged');
    allErrs.push(...errs);
  } finally { await b.close(); }
}
await savedCase('negative girder spacing', 'P.xs.bays[1] = -3;', async p => {
  const s = await p.evaluate(() => ({ banner: document.getElementById('icBanner').innerText, tabs: [...document.querySelectorAll('#inTabs button.has-err')].map(b => b.dataset.itab) }));
  assert.match(s.banner, /Cross-section › Girder spacings: Girder spacing 2 must be a positive number\./); assert.deepEqual(s.tabs, ['xsec']);
  await p.click('#out [data-icgo="0"]'); await p.waitForTimeout(300);
  const c = await p.evaluate(() => ({ cell: [...document.querySelectorAll('.sli input.ic-cell')].map(i => i.closest('tr').getAttribute('data-sli-r')), act: document.activeElement.closest('tr') && document.activeElement.closest('tr').getAttribute('data-sli-r') }));
  assert.deepEqual(c, { cell: ['1'], act: '1' }, 'the row of spacing 2 marked and focused');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'invalid-spacing-1440.png') });
  console.log('  ok   saved project, negative girder spacing: loads unchanged; its list row marked and focused; results blocked');
});
await savedCase('missing span', 'P.spans.lengths = [];', async p => {
  const s = await p.evaluate(() => ({ banner: document.getElementById('icBanner').innerText, tabs: [...document.querySelectorAll('#inTabs button.has-err')].map(b => b.dataset.itab) }));
  assert.match(s.banner, /Bridge layout › Span lengths: Enter at least one span\./); assert.ok(s.tabs.includes('layout'), s.tabs.join());
  for (const t of ['flex', 'rpt', 'dwg', '3d']) { await tab(p, t); await blockedOut(p, 'missing span: ' + t); }
  console.log('  ok   saved project, no span: loads unchanged; Span lengths named, Bridge layout tab marked; results blocked');
});

{ // phone width: the banner and the marked field (screenshots)
  const { b, p, errs } = await openPage(FILE, { vw: 390, vh: 844 });
  try {
    await p.waitForSelector('#inTabs [data-itab="xsec"]'); await p.click('#inTabs [data-itab="xsec"]');
    await setField(p, '[id="i_xs.sidewalks.L.w"]', '6'); await setField(p, '[id="i_xs.sidewalks.L.fence"]', '0.05');
    await tab(p, 'sum');
    const sw = await p.evaluate(() => document.documentElement.scrollWidth); assert.ok(sw <= 391, 'no sideways scroll at 390 px: ' + sw);
    if (SHOTS) { await p.locator('#icBanner').scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(SHOTS, 'invalid-summary-390.png') });
      await p.click('#out [data-icgo="0"]'); await p.waitForTimeout(400); await p.screenshot({ path: path.join(SHOTS, 'invalid-field-390.png') });
      await p.locator('#inTabs').scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(SHOTS, 'invalid-tabs-390.png') }); }
    allErrs.push(...errs);
    console.log('  ok   390 px: no sideways scroll');
  } finally { await b.close(); }
}
assert.deepEqual(allErrs, [], 'console errors');
console.log(`ok  invalid inputs block every result; 0 console errors (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
