#!/usr/bin/env node
// Browser smoke test of the Settings window of the PS Bridge app (SET, 2026-11-26; apps/ps-bridge/ui/settings.js, display and layout only).
// apps/ps-bridge/index.html, headless Chromium (tests/lib.mjs openPage):
//   1. the gear button; a moved input's row hidden on its tab (the card says where it went); a borderline input (deck f′c) stays on its tab
//      and is in the window too; no Detailing standards group;
//   2. open, edit, Save: the project value changed (autosave), Undo reverts it, Redo; Cancel restores the values from when the window
//      opened (no undo step left); Esc = Cancel; focus stays in the window;
//   3. a per-girder-type value: the window shows the app's "Entered values for" selector; with a girder type chosen, an edit becomes that
//      type's own value (the base design unchanged), as on the Loads tab; the owner at the top; an Auto design limit;
//   4. links (End zone hold-down limit, Losses loss method) open the window at the group and row; an input error on a moved input: the
//      banner link opens the window at it, the gear counts it;
//   5. phone width (390 px): top tabs, no sideways scroll; 0 console errors.
//   node tests/smoke/ps-bridge-settings.mjs [shotDir]   (shotDir: ps-settings.png, ps-settings-phone.png at deviceScaleFactor 2)
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shotDir = process.argv[2] || '';
const FILE = path.join(REPO, 'apps/ps-bridge/index.html');
const proj = p => p.evaluate(() => window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project);
const owner = p => p.evaluate(() => window.PBD.ownerOf(window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project.base));
const get = async (p, k) => k.split('.').reduce((o, q) => (o == null ? o : o[q]), await proj(p));
const visible = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && e.offsetParent !== null; }, sel);
const isOpen = p => p.evaluate(() => window.PSBSettings.isOpen() && !document.getElementById('psSet').hidden);
const group = p => p.$eval('#psSet [aria-selected="true"][data-pssg]', b => b.dataset.pssg);
const setVal = async (p, sel, v) => { await p.fill(sel, String(v)); await p.press(sel, 'Tab'); await p.waitForTimeout(400); };
const id = s => `[id="pss-${s}"]`;
const open = async (p, g) => { await p.click('#psGear'); await p.waitForTimeout(300); if (g) { await p.click(`[data-pssg="${g}"]`); await p.waitForTimeout(300); } };

const A = await openPage(FILE, { vw: 1440, vh: 1000, dsf: 2 });
const p = A.p;
try {
  await p.waitForSelector('#inTabs [data-itab]'); await p.waitForTimeout(2500);
  // 1.
  assert.ok(await visible(p, '#hdrBtns #psGear'), 'gear button in the header');
  await p.click('#inTabs [data-itab="own"]'); await p.waitForTimeout(300);
  assert.equal(await visible(p, '[id="i_base.opt.corrosion"]'), false, 'a moved input is not shown on its tab');
  assert.ok(await p.$('#inPanes [id="i_base.opt.corrosion"]'), 'still drawn (hidden) on its tab');
  assert.match((await p.$$eval('#inPanes [data-pane="own"] .pss-ph', L => L.map(e => e.textContent))).join(' | '), /Settings › Owner and load modifiers/);
  assert.ok(await visible(p, '[id="i_base.owner"]'), 'the owner stays on the Owner rules tab');
  await p.click('#inTabs [data-itab="mat"]'); await p.waitForTimeout(300);
  assert.ok(await visible(p, '[id="i_base.mat.fcd"]'), 'deck f′c (borderline) stays on the Materials tab');
  assert.equal(await visible(p, '[id="i_base.str.Ep"]'), false, 'E_p moved');
  assert.equal(await p.evaluate(() => window.PSBSettings.GROUPS.some(G => G.id === 'det')), false, 'no Detailing standards group');

  // 2. edit, Save, Undo, Redo; Cancel; Esc
  await open(p, 'own');
  assert.ok(await isOpen(p)); assert.ok(await visible(p, `#psSetOwner ${id('i_base.owner')}`), 'the owner at the top');
  const rc0 = await p.$eval('#inPanes [id="i_base.opt.relCfac"]', e => (e.value === '' ? '' : Number(e.value)));   // the value on screen (nothing is stored before the first change)
  await setVal(p, id('i_base.opt.relCfac'), 0.62);
  assert.equal(await get(p, 'base.opt.relCfac'), 0.62, 'the edit reached the project (autosave)');
  assert.equal(await p.$eval('#inPanes [id="i_base.opt.relCfac"]', e => e.value), '0.62');
  await p.click('#psSetSave'); await p.waitForTimeout(300);
  assert.equal(await isOpen(p), false);
  await p.click('#bUndo'); await p.waitForTimeout(400);
  assert.equal(await get(p, 'base.opt.relCfac'), rc0, 'Undo reverts');
  await p.click('#bRedo'); await p.waitForTimeout(400);
  assert.equal(await get(p, 'base.opt.relCfac'), 0.62, 'Redo');
  await open(p, 'lldf');
  await p.selectOption('#psSet [data-lo="skewV"]', 'ext'); await p.waitForTimeout(400);
  assert.equal(await get(p, 'xs.lldf.skewV'), 'ext');
  await p.click('#psSetCancel'); await p.waitForTimeout(400);
  assert.notEqual(await get(p, 'xs.lldf.skewV'), 'ext', 'Cancel restores');
  await p.click('#bUndo'); await p.waitForTimeout(400);
  assert.equal(await get(p, 'base.opt.relCfac'), rc0, 'after Cancel, Undo reverts the step before the window opened');
  await p.click('#bRedo'); await p.waitForTimeout(400);
  await open(p, 'mat');
  await setVal(p, id('i_base.str.Ep'), 28000);
  assert.equal(await get(p, 'base.str.Ep'), 28000);
  for (let i = 0; i < 50; i++) await p.keyboard.press('Tab');
  assert.ok(await p.evaluate(() => document.getElementById('psSet').contains(document.activeElement)), 'Tab stays in the window');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  assert.equal(await isOpen(p), false, 'Esc closes'); assert.notEqual(await get(p, 'base.str.Ep'), 28000, 'Esc = Cancel');

  // 3. per girder type, the owner, Auto design (the per-type edit made with the Owner rules tab open behind; the owner with Materials open)
  await p.click('#inTabs [data-itab="own"]'); await p.waitForTimeout(300);
  await open(p, 'anl');
  const hasTypes = !!(await p.$(`#psSet ${id('tyScope_mat')}`));
  if (hasTypes) {
    const t = await p.$eval(`#psSet ${id('tyScope_mat')}`, s => [...s.options].map(o => o.value).filter(Boolean)[0]);
    const base0 = await get(p, 'base.opt.gLLs3');
    await p.selectOption(`#psSet ${id('tyScope_mat')}`, t); await p.waitForTimeout(500);
    assert.equal(await p.$eval('#inPanes [id="tyScope_loads"]', s => s.value), t, 'the same "Entered values for" choice as the tabs');
    await setVal(p, id('i_base.opt.gLLs3'), 0.95);
    const r = await p.evaluate(t => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, k = P.types.findIndex(q => q.id === t);
      return { base: P.base.opt.gLLs3, eff: window.PSBBridge.effBase(P, k).opt.gLLs3 }; }, t);
    assert.equal(r.eff, 0.95, "the girder type's own value"); assert.equal(r.base, base0, 'the base design unchanged');
    if (shotDir) await p.screenshot({ path: path.join(shotDir, 'ps-settings.png') });
    await p.click('#psSetCancel'); await p.waitForTimeout(400);
  } else if (shotDir) { await p.screenshot({ path: path.join(shotDir, 'ps-settings.png') }); await p.click('#psSetSave'); }
  await p.click('#inTabs [data-itab="mat"]'); await p.waitForTimeout(300);
  await open(p, 'ad');
  await setVal(p, id('ad_topN'), 4);
  assert.equal(String(await get(p, 'autodesign.topN')), '4', 'Auto design: sections to list');
  await p.selectOption(`#psSetOwner ${id('i_base.owner')}`, 'MassDOT'); await p.waitForTimeout(500);
  assert.equal(await owner(p), 'MassDOT', 'the owner at the top');
  await p.click('#psSetCancel'); await p.waitForTimeout(400);
  assert.notEqual(await owner(p), 'MassDOT', 'Cancel restores the owner');

  // 4. links and the error banner
  const link = async (tab, sel, g, row) => {
    await p.click(`#tabBar [data-otab="${tab}"]`); await p.waitForSelector(`#out ${sel}`, { timeout: 120000 });
    await p.click(`#out ${sel}`); await p.waitForTimeout(400);
    assert.ok(await isOpen(p), `${tab}: opens Settings`); assert.equal(await group(p), g, `${tab}: group ${g}`);
    if (row) assert.ok(await p.$(`#psSet .pss-row[data-pssk="${row}"]`), `${tab}: row ${row}`);
    await p.click('#psSetSave'); await p.waitForTimeout(300);
  };
  await link('loss', '[data-psset="base.opt.lossMethod"]', 'anl', 'base.opt.lossMethod');
  await link('sec', '[data-psset="comp"]', 'comp');
  await open(p, 'own');
  await setVal(p, id('i_base.opt.relCfac'), -1);
  await p.click('#psSetSave'); await p.waitForTimeout(500);
  assert.equal(await p.$eval('#psGear', e => e.classList.contains('has-err')), true, 'the gear shows the error');
  const L = await p.$$eval('[data-icgo]', l => l.map(a => a.textContent));
  assert.ok(L.some(t => /Settings ›/.test(t)), `the banner names Settings: ${L.join(' | ')}`);
  await p.click('[data-icgo]'); await p.waitForTimeout(500);
  assert.ok(await isOpen(p)); assert.equal(await group(p), 'own');
  await p.click('#psSetSave'); await p.waitForTimeout(300);
  await p.click('#bUndo'); await p.waitForTimeout(500);
  assert.equal(await p.$eval('#psGear', e => e.classList.contains('has-err')), false, 'fixed by Undo');
} finally { /* closed below */ }

// 5. phone width
const B = await openPage(FILE, { vw: 390, vh: 844, dsf: 2 });
try {
  const q = B.p; await q.waitForSelector('#inTabs [data-itab]'); await q.waitForTimeout(2500);
  await q.click('#psGear'); await q.waitForTimeout(400);
  assert.equal(await q.$eval('#psSetSide', e => getComputedStyle(e).display), 'flex', 'top tabs on a phone');
  await q.click('[data-pssg="sdl"]'); await q.waitForTimeout(300);
  const r = await q.$eval('#psSet', e => { const b = e.getBoundingClientRect(); return [b.left, b.width]; }), pw = await q.$eval('#psSetPane', e => [e.scrollWidth, e.clientWidth]);
  assert.ok(r[0] >= 0 && r[1] <= 390, `fits ${r}`); assert.ok(pw[0] <= pw[1] + 1, `no sideways scroll ${pw}`);
  if (shotDir) await q.screenshot({ path: path.join(shotDir, 'ps-settings-phone.png') });
  await q.keyboard.press('Escape');
  assert.deepEqual(B.errs, [], 'phone: console errors');
} finally { await B.b.close(); }
assert.deepEqual(A.errs, [], 'console errors');
await A.b.close();
console.log('ps-bridge-settings: ok');
