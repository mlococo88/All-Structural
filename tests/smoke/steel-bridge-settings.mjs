#!/usr/bin/env node
// Browser smoke test of the Settings window of Steel Bridge Design (SET, 2026-11-26; apps/steel-bridge/ui/settings.js, display and layout only).
// apps/steel-bridge/index.html, headless Chromium (tests/lib.mjs openPage):
//   1. the gear button is in the header; a moved input's row is hidden on its tab (the card says where it went); a borderline input
//      (deck f'c) stays on its tab and is also in the window, both editing the same field;
//   2. open, edit a field, Save: the project value changed (autosave) and Undo reverts it, Redo puts it back; Cancel restores the values
//      from when the window opened (and leaves no undo step); Esc closes as Cancel; focus stays in the window (Tab, Shift+Tab);
//   3. an Auto design limit edited in the window reaches P.autodesign; the owner at the top edits ownerRules.owner;
//   4. links from the output tabs (Flexure γ Fatigue I, Analysis settings, Deflection limit) open the window at the right group and row;
//      an input error on a moved input: the banner link opens the window at it, the gear counts it;
//   5. phone width (390 px): the groups are top tabs, no sideways scroll; 0 console errors.
//   node tests/smoke/steel-bridge-settings.mjs [shotDir]   (shotDir: sb-settings.png, sb-settings-phone.png at deviceScaleFactor 2)
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shotDir = process.argv[2] || '';
const FILE = path.join(REPO, 'apps/steel-bridge/index.html');
const get = (p, k) => p.evaluate(k => k.split('.').reduce((o, q) => (o == null ? o : o[q]), JSON.parse(localStorage.getItem('sbd2.project.current'))), k);
const visible = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && e.offsetParent !== null; }, sel);
const isOpen = p => p.evaluate(() => window.SBDSettings.isOpen() && !document.getElementById('sbSet').hidden);
const group = p => p.$eval('#sbSet [aria-selected="true"][data-sbsg]', b => b.dataset.sbsg);
const setVal = async (p, sel, v) => { await p.fill(sel, String(v)); await p.press(sel, 'Tab'); await p.waitForTimeout(250); };
const id = s => `[id="sbs-${s}"]`;

const A = await openPage(FILE, { vw: 1440, vh: 1000, dsf: 2 });
const p = A.p;
try {
  await p.waitForSelector('#tabBar [data-otab="loads"]'); await p.waitForTimeout(1500);
  // 1. the gear, the hidden rows, the borderline input in both places
  assert.ok(await visible(p, '#hdrBtns #sbGear'), 'gear button in the header');
  await p.click('#inTabs [data-itab="loads"]'); await p.waitForTimeout(300);
  assert.equal(await visible(p, '[id="i_xs.lldf.gap"]'), false, 'a moved input is not shown on its tab');
  assert.ok(await p.$('#inPanes [id="i_xs.lldf.gap"]'), 'the moved input is still drawn (hidden) on its tab');
  assert.match((await p.$$eval('#inPanes [data-pane="loads"] .sbs-ph', L => L.map(e => e.textContent))).join(' | '), /Settings › Live-load distribution/, 'the card says where it went');
  await p.click('#inTabs [data-itab="mat"]'); await p.waitForTimeout(300);
  assert.ok(await visible(p, '[id="i_materials.concrete.fc"]'), 'f′c (borderline) stays on the Materials tab');
  assert.equal(await visible(p, '[id="i_materials.Es"]'), false, 'E_s moved');
  const n0 = await p.evaluate(() => window.SBDSettings.ENTRIES.length);
  assert.ok(n0 >= 110, `${n0} entries`);

  // 2. open, edit, Save, Undo, Redo
  await p.click('#sbGear'); await p.waitForTimeout(400);
  assert.ok(await isOpen(p), 'opens');
  assert.ok(await visible(p, `#sbSetOwner ${id('i_ownerRules.owner')}`), 'the owner at the top');
  assert.equal(await p.$eval('#app', e => e.inert), true, 'the page behind is inert');
  await p.click('[data-sbsg="lldf"]'); await p.waitForTimeout(300);
  const gap0 = Number(await p.$eval('#inPanes [id="i_xs.lldf.gap"]', e => e.value)), fc0 = Number(await p.$eval('#inPanes [id="i_materials.concrete.fc"]', e => e.value));
  await setVal(p, id('i_xs.lldf.gap'), 5.5);
  assert.equal(await get(p, 'xs.lldf.gap'), 5.5, 'the edit reached the project (autosave)');
  assert.equal(await p.$eval('#inPanes [id="i_xs.lldf.gap"]', e => e.value), '5.5', 'the tab input follows');
  assert.ok(await isOpen(p), 'still open after the edit');
  assert.equal(await p.$eval(id('i_xs.lldf.gap'), e => e.value), '5.5', 'the copy shows the new value after the redraw');
  await p.click('#sbSetSave'); await p.waitForTimeout(300);
  assert.equal(await isOpen(p), false, 'Save closes');
  assert.equal(await get(p, 'xs.lldf.gap'), 5.5, 'Save keeps the edit');
  await p.click('#bUndo'); await p.waitForTimeout(300);
  assert.equal(await get(p, 'xs.lldf.gap'), gap0, 'Undo reverts the Settings edit');
  await p.click('#bRedo'); await p.waitForTimeout(300);
  assert.equal(await get(p, 'xs.lldf.gap'), 5.5, 'Redo');
  // borderline: f'c edited in the window, the Materials tab shows it
  await p.click('#sbGear'); await p.waitForTimeout(300); await p.click('[data-sbsg="mat"]'); await p.waitForTimeout(300);
  await setVal(p, id('i_materials.concrete.fc'), 5);
  assert.equal(await get(p, 'materials.concrete.fc'), 5);
  assert.equal(await p.$eval('#inPanes [id="i_materials.concrete.fc"]', e => e.value), '5', 'the tab shows the borderline value');
  await p.click('#sbSetSave'); await p.waitForTimeout(300);
  // Cancel: back to the values when the window opened, no undo step left
  const undoN = async () => p.evaluate(() => document.getElementById('bUndo').disabled);
  await p.click('#sbGear'); await p.waitForTimeout(300); await p.click('[data-sbsg="lldf"]'); await p.waitForTimeout(200);
  await setVal(p, id('i_xs.lldf.gap'), 7);
  await p.selectOption(id('i_xs.lldf.kg'), 'avg'); await p.waitForTimeout(250);
  assert.equal(await get(p, 'xs.lldf.gap'), 7); assert.equal(await get(p, 'xs.lldf.kg'), 'avg');
  await p.click('#sbSetCancel'); await p.waitForTimeout(300);
  assert.equal(await get(p, 'xs.lldf.gap'), 5.5, 'Cancel restores'); assert.notEqual(await get(p, 'xs.lldf.kg'), 'avg', 'Cancel restores the select');
  assert.equal(await undoN(), false);
  await p.click('#bUndo'); await p.waitForTimeout(300);
  assert.equal(await get(p, 'materials.concrete.fc'), fc0, 'after Cancel, Undo reverts the step before the window opened (no step left from it)');
  await p.click('#bRedo'); await p.waitForTimeout(300);
  // Esc = Cancel; the focus stays in the window
  await p.click('#sbGear'); await p.waitForTimeout(300); await p.click('[data-sbsg="det"]'); await p.waitForTimeout(200);
  await setVal(p, id('i_framing.supClear'), 9);
  assert.equal(await get(p, 'framing.supClear'), 9);
  for (let i = 0; i < 60; i++) await p.keyboard.press('Tab');
  assert.ok(await p.evaluate(() => document.getElementById('sbSet').contains(document.activeElement)), 'Tab stays in the window');
  for (let i = 0; i < 5; i++) await p.keyboard.press('Shift+Tab');
  assert.ok(await p.evaluate(() => document.getElementById('sbSet').contains(document.activeElement)), 'Shift+Tab stays in the window');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  assert.equal(await isOpen(p), false, 'Esc closes'); assert.notEqual(await get(p, 'framing.supClear'), 9, 'Esc = Cancel');
  assert.equal(await p.evaluate(() => document.activeElement && document.activeElement.id), 'sbGear', 'the focus goes back to the gear');

  // 3. Auto design and the owner
  await p.click('#sbGear'); await p.waitForTimeout(300); await p.click('[data-sbsg="ad"]'); await p.waitForTimeout(300);
  await setVal(p, id('topN'), 7); await p.waitForTimeout(200);
  assert.equal(String(await get(p, 'autodesign.topN')), '7', 'Auto design: designs to list');
  await p.selectOption(`#sbSetOwner ${id('i_ownerRules.owner')}`, 'MassDOT'); await p.waitForTimeout(400);
  assert.equal(await get(p, 'ownerRules.owner'), 'MassDOT', 'the owner at the top');
  assert.match(await p.$eval('#sbSetOwner', e => e.textContent), /MassDOT/);
  assert.equal(await p.$eval('#sbSetReset', e => e.disabled), false, 'Reset to owner defaults offered for MassDOT');
  if (shotDir) { await p.click('[data-sbsg="anl"]'); await p.waitForTimeout(300); await p.screenshot({ path: path.join(shotDir, 'sb-settings.png') }); }
  await p.click('#sbSetCancel'); await p.waitForTimeout(300);
  assert.equal(await get(p, 'ownerRules.owner'), 'AASHTO', 'Cancel restores the owner');

  // 4. links from the output tabs
  const link = async (tab, sel, g, row) => {
    await p.click(`#tabBar [data-otab="${tab}"]`); await p.waitForSelector(`#out ${sel}`, { timeout: 60000 });
    await p.click(`#out ${sel}`); await p.waitForTimeout(400);
    assert.ok(await isOpen(p), `${tab}: ${sel} opens Settings`); assert.equal(await group(p), g, `${tab}: group ${g}`);
    if (row) assert.ok(await p.$(`#sbSet .sbs-row[data-sbsk="${row}"]`), `${tab}: row ${row}`);
    await p.click('#sbSetSave'); await p.waitForTimeout(300);
  };
  await link('an', '[data-sbset="anl"]', 'anl');
  await link('flex', '[data-sbset="fatigue.gam.fI"]', 'anl', 'fatigue.gam.fI');
  await link('defl', '[data-sbset="analysis.deflLimit"]', 'anl', 'analysis.deflLimit');
  await link('wt', '[data-gofld="fatigue.gam.fI"]', 'anl', 'fatigue.gam.fI');
  // the placeholder line on a tab
  await p.click('#inTabs [data-itab="fs"]'); await p.waitForTimeout(300);
  await p.click('#inPanes [data-pane="fs"] .sbs-ph a'); await p.waitForTimeout(300);
  assert.ok(await isOpen(p)); await p.click('#sbSetSave'); await p.waitForTimeout(200);
  // an error on a moved input: the gear counts it, the banner link opens the window at it
  await p.click('#sbGear'); await p.waitForTimeout(300); await p.click('[data-sbsg="sdl"]'); await p.waitForTimeout(200);
  await setVal(p, id('i_xs.wcA'), -1);
  await p.click('#sbSetSave'); await p.waitForTimeout(400);
  assert.equal(await p.$eval('#sbGear', e => e.classList.contains('has-err')), true, 'the gear shows the error');
  await p.click('#tabBar [data-otab="sec"]'); await p.waitForTimeout(300);
  const ic = await p.$$eval('#out [data-icgo]', L => L.map(a => a.textContent));
  assert.ok(ic.some(t => /^Settings ›/.test(t)), `the banner names Settings: ${ic.join(' | ')}`);
  await p.click('#out [data-icgo]'); await p.waitForTimeout(400);
  assert.ok(await isOpen(p)); assert.equal(await group(p), 'sdl');
  assert.ok(await p.evaluate(() => document.activeElement && document.activeElement.id === 'sbs-i_xs.wcA'), 'the field is focused');
  await p.click('#sbSetSave'); await p.waitForTimeout(200);
  await p.click('#bUndo'); await p.waitForTimeout(300);
  assert.equal(await p.$eval('#sbGear', e => e.classList.contains('has-err')), false, 'fixed by Undo');
} finally { /* closed below */ }

// 5. phone width
const B = await openPage(FILE, { vw: 390, vh: 844, dsf: 2 });
try {
  const q = B.p; await q.waitForSelector('#tabBar [data-otab="loads"]'); await q.waitForTimeout(1500);
  await q.click('#sbGear'); await q.waitForTimeout(400);
  assert.equal(await q.$eval('#sbSetSide', e => getComputedStyle(e).display), 'flex', 'top tabs on a phone');
  const r = await q.$eval('#sbSet', e => { const b = e.getBoundingClientRect(); return [b.left, b.width, e.scrollWidth, e.clientWidth]; });
  assert.ok(r[0] >= 0 && r[1] <= 390 && r[2] <= r[3] + 1, `fits the screen ${r}`);
  await q.click('[data-sbsg="sdl"]'); await q.waitForTimeout(300);
  const pw = await q.$eval('#sbSetPane', e => [e.scrollWidth, e.clientWidth]);
  assert.ok(pw[0] <= pw[1] + 1, `pane does not scroll sideways ${pw}`);
  if (shotDir) await q.screenshot({ path: path.join(shotDir, 'sb-settings-phone.png') });
  await q.keyboard.press('Escape'); await q.waitForTimeout(200);
  assert.deepEqual(B.errs, [], 'phone: console errors');
} finally { await B.b.close(); }
assert.deepEqual(A.errs, [], 'console errors');
await A.b.close();
console.log('steel-bridge-settings: ok');
