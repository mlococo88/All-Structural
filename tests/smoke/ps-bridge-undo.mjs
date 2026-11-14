#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), PR 6: Undo / Redo in the header (the steel app's: 100 steps, Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z, in memory
// only). Headless Chromium, file://, CDN libraries from tests/libs.
//   1. header order chip · Undo · Redo; both disabled on open;
//   2. a span change: the Analysis tab's results change; Undo (button, Ctrl+Z) puts back the project and the results exactly (the tab's text
//      and the autosave); Redo (button, Ctrl+Y, Ctrl+Shift+Z) the changed ones;
//   3. text being typed in a field (no change event yet): Ctrl+Z is the browser's own undo of that field, not the app's;
//   4. 105 changes: 100 undo steps kept (back to the 5th), then Undo disabled;
//   5. the girder count change notice (PR 3a-1): its Undo = one step of the history (the count and the re-assigned types together, the
//      project text before the change exactly), then Redo; a later change removes the notice's Undo; the header Undo does the same step;
//   6. with the standard save (PR 5): Save, change, Undo -> the chip says "saved" again; opening a saved project or New starts a new history;
//   7. the history is not stored (no key added); 0 console errors.
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/ps-bridge/index.html');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000 });
const ls = k => p.evaluate(k => localStorage.getItem(k), k);
const proj = async () => JSON.parse(await ls('psb2.project.current'));
const keys = () => p.evaluate(() => Object.keys(localStorage).sort());
const itab = t => p.evaluate(t => document.querySelector(`#inTabs [data-itab="${t}"]`).click(), t);
const otab = t => p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t);
const setIn = async (tab, pth, v) => { await itab(tab); const sel = `#i_${pth.replace(/\./g, '\\.')}`; await p.fill(sel, String(v)); await p.dispatchEvent(sel, 'change'); await p.waitForTimeout(60); };
// a list input (spans, skews, bays) is a table over a hidden text input (ui/lists.js): its text set and its change fired, as the skeleton smoke
const setList = async (tab, pth, v) => { await itab(tab); await p.evaluate(([q, t]) => { const el = document.querySelector(q); el.value = t; el.dispatchEvent(new Event('change', { bubbles: true })); }, [`[id="i_${pth}"]`, String(v)]); await p.waitForTimeout(60); };
const out = () => p.evaluate(() => document.getElementById('out').innerText);
const dis = id => p.$eval('#' + id, e => e.disabled);
const blur = () => p.evaluate(() => document.activeElement && document.activeElement.blur());
const until = async (f, ms, w) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + w); await new Promise(r => setTimeout(r, 100)); } };
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(500);
  // 1.
  assert.equal(await p.evaluate(() => [...document.querySelectorAll('#hdrBtns button')].map(x => x.dataset.sp || x.id).join()), 'chip,bUndo,bRedo');
  assert.equal(await dis('bUndo'), true); assert.equal(await dis('bRedo'), true);
  ok('header: chip · Undo · Redo; both disabled on open');
  // 2. results follow Undo / Redo
  await setIn('proj', 'project.checker', 'start');   // a first change, so the autosave holds the project (a new project is written on its first change)
  await otab('an'); await until(async () => /kip/.test(await out()), 20000, 'Analysis results');
  const t0 = await proj(), outA = await out();
  await setList('layout', 'spans.lengths', '100'); await until(async () => (await out()) !== outA && /kip/.test(await out()), 20000, 'new results');
  const outB = await out(), t1 = await proj(); assert.equal(t1.spans.lengths.join(), '100'); assert.notEqual(outB, outA);
  assert.equal(await dis('bUndo'), false);
  await p.click('#bUndo'); await p.waitForTimeout(200);
  assert.deepEqual(await proj(), t0); assert.equal(await out(), outA, 'Undo: the Analysis tab shows the results of the project before');
  assert.equal(await p.$eval('#i_spans\\.lengths', e => e.value), '120'); assert.equal(await dis('bRedo'), false);
  await p.click('#bRedo'); await p.waitForTimeout(200); assert.deepEqual(await proj(), t1); assert.equal(await out(), outB, 'Redo: the changed results');
  await blur(); await p.keyboard.press('Control+z'); await p.waitForTimeout(200); assert.deepEqual(await proj(), t0); assert.equal(await out(), outA);
  await p.keyboard.press('Control+y'); await p.waitForTimeout(200); assert.deepEqual(await proj(), t1);
  await p.keyboard.press('Control+z'); await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(200); assert.deepEqual(await proj(), t1); assert.equal(await out(), outB);
  ok('Undo / Redo (buttons, Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z): the project and the Analysis tab\'s results exactly before / after');
  // 3. typing in a field keeps the browser's own undo
  await itab('proj'); const und0 = await p.evaluate(() => document.getElementById('bUndo').disabled);
  await p.click('#i_project\\.notes'); await p.keyboard.type('abc'); await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
  assert.deepEqual(await proj(), t1, 'the app did not undo (the span change is still there)'); assert.notEqual(await p.$eval('#i_project\\.notes', e => e.value), 'abc', 'the browser undid the typing');
  assert.equal(await p.evaluate(() => document.getElementById('bUndo').disabled), und0);
  await blur(); await p.waitForTimeout(100);
  ok('typing in a field: Ctrl+Z is the field\'s own undo, not the app\'s');
  // 4. 100 steps
  await otab('sum');
  for (let i = 1; i <= 105; i++) { await p.fill('#i_project\\.checker', 'n' + i); await p.dispatchEvent('#i_project\\.checker', 'change'); }
  assert.equal((await proj()).project.checker, 'n105');
  let k = 0; while (!(await dis('bUndo')) && k < 200) { await p.click('#bUndo'); k++; }
  assert.equal(k, 100, 'undo steps kept'); assert.equal((await proj()).project.checker, 'n5'); assert.equal(await p.$eval('#i_project\\.checker', e => e.value), 'n5');
  for (let i = 0; i < 100; i++) await p.click('#bRedo');
  assert.equal((await proj()).project.checker, 'n105'); assert.equal(await dis('bRedo'), true);
  ok('105 changes: 100 undo steps kept (back to n5), Redo all the way');
  // 5. the girder count notice's Undo is one step of the history
  const keys0 = await keys(), pre = await ls('psb2.project.current');
  await setIn('xsec', 'xs.nb', '6'); await p.waitForTimeout(200);
  const post = await ls('psb2.project.current'); assert.equal(JSON.parse(post).xs.nb, 6);
  assert.match(await p.$eval('#notices', e => e.innerText), /Girder count 5 → 6/); assert.ok(await p.$('#notices .nUndo'));
  await p.click('#notices .nUndo'); await p.waitForTimeout(200);
  assert.equal(await ls('psb2.project.current'), pre, 'the notice\'s Undo: the project text before the change exactly'); assert.equal(await dis('bRedo'), false);
  await p.click('#bRedo'); await p.waitForTimeout(200); assert.equal(await ls('psb2.project.current'), post, 'Redo after the notice\'s Undo');
  await p.click('#bUndo'); await p.waitForTimeout(200); assert.equal(await ls('psb2.project.current'), pre, 'the header Undo: the same one step');
  await setIn('xsec', 'xs.nb', '6'); await p.waitForTimeout(200); assert.ok(await p.$('#notices .nUndo'));
  await setIn('proj', 'project.checker', 'after nb'); assert.equal(await p.$('#notices .nUndo'), null, 'a later change removes the notice\'s Undo');
  await p.click('#bUndo'); await p.click('#bUndo'); await p.waitForTimeout(200); assert.equal(await ls('psb2.project.current'), pre);
  ok('the girder count notice: its Undo = one history step (count + types), Redo works after it; a later change removes it');
  // 6. with the standard save
  await p.evaluate(() => SharedProjectsUI.bars[0].saveAs()); await p.waitForSelector('dialog.spSave[open]'); await p.fill('dialog.spSave .spName', 'Undo test'); await p.click('dialog.spSave [data-sa=ok]'); await p.waitForTimeout(200);
  const chipSt = async () => { await p.evaluate(() => SharedProjectsUI.bars[0].refresh()); return p.$eval('[data-sp=chip]', e => e.innerText.replace(/\s+/g, ' ')); };
  assert.match(await chipSt(), /· saved/);
  await setIn('proj', 'project.checker', 'edited'); assert.match(await chipSt(), /unsaved changes/);
  await p.click('#bUndo'); await p.waitForTimeout(150); assert.match(await chipSt(), /· saved/, 'Undo back to the saved text: "saved"');
  await p.evaluate(() => { window.confirm = () => true; }); await p.click('[data-sp=card] [data-sp=new]'); await p.waitForTimeout(300);
  assert.equal(await dis('bUndo'), true); assert.equal(await dis('bRedo'), true); assert.equal((await proj()).project.name, 'New prestressed bridge');
  await setIn('proj', 'project.checker', 'x'); assert.equal(await dis('bUndo'), false);
  await p.evaluate(() => SharedProjectsUI.bars[0].dialog.show()); await p.click('#psbLibDlg tbody tr:has-text("Undo test") [data-spa=open]'); await p.waitForTimeout(300);
  assert.equal(await dis('bUndo'), true, 'opening a saved project starts a new history'); assert.equal((await proj()).project.name, 'Undo test');
  await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
  ok('Undo back to the saved text shows "saved"; New and opening a saved project start a new history');
  // 7.
  assert.deepEqual((await keys()).filter(x => !keys0.includes(x) && !x.startsWith('psb2.lib.')), [], 'no key for the history');
  assert.deepEqual(errs, []);
  ok('the history is not stored (no key added); 0 console errors');
} finally { await b.close(); }
console.log(`ps-bridge-undo: ${n} checks ok (0 console errors)`);
