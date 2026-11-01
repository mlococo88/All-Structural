#!/usr/bin/env node
// Browser check of the saved-project list, undo / redo and the Apply-defaults message (2026-11-01), apps/steel-bridge/index.html.
//   Save / Save as / Saved projects (open, rename, duplicate, delete), unsaved-changes warning, quota error path (setItem patched to throw),
//   an old autosave (sbd2.project.current only) still opening, Ctrl+Z / Ctrl+Y (60 steps), the Apply defaults message and its Undo.
//   SHOTS=<dir> node tests/smoke/steel-bridge-library.mjs   (screenshots at 1280 and 390 when SHOTS is set)
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/steel-bridge/index.html');
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 900 });
const dl = []; let reply = [];   // dialogs seen; replies: prompt text / true / false in order (default: accept)
p.removeAllListeners('dialog');
p.on('dialog', async d => { dl.push(d.type() + ': ' + d.message().slice(0, 160)); const r = reply.shift(); if (r === false) await d.dismiss(); else await d.accept(typeof r === 'string' ? r : undefined); });
const ls = k => p.evaluate(k => localStorage.getItem(k), k);
const proj = async () => JSON.parse(await ls('sbd2.project.current'));
const setIn = async (path_, v) => { await p.evaluate(() => { const t = document.querySelector('[data-itab="proj"]'); t && t.click(); }); await p.fill(`#i_${path_.replace(/\./g, '\\.')}`, String(v)); await p.dispatchEvent(`#i_${path_.replace(/\./g, '\\.')}`, 'change'); };
const shot = async n => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + '.png') }); };
const state = () => p.$eval('#saveState', e => e.textContent);
try {
  await p.waitForSelector('#bSave'); await p.waitForTimeout(500);
  assert.equal(await state(), 'Not saved to the project list');
  // 1. edit, Save (prompt for a name), list
  await setIn('project.name', 'Route 9 over Mill River'); await setIn('project.number', 'B-1234');
  reply = ['Route 9 over Mill River']; await p.click('#bSave');
  assert.equal(await state(), 'Saved "Route 9 over Mill River"'); await p.waitForTimeout(2700); assert.equal(await state(), 'Saved');
  let idx = JSON.parse(await ls('sbd2.lib.index')); assert.equal(idx.items.length, 1); assert.equal(idx.items[0].number, 'B-1234');
  // an edit makes it unsaved; Save overwrites without asking
  await setIn('project.checker', 'first revision'); assert.equal(await state(), 'Unsaved changes');
  reply = []; const n0 = dl.length; await p.click('#bSave'); assert.equal(dl.length, n0, 'Save of a linked project asks nothing');
  await p.waitForTimeout(100); assert.equal((await proj()).project.checker, 'first revision');
  // 2. Save as: a second project
  reply = ['Route 9 alt']; await p.click('#bSaveAs'); idx = JSON.parse(await ls('sbd2.lib.index')); assert.equal(idx.items.length, 2);
  assert.equal((await proj()).project.name, 'Route 9 alt');
  // 3. open the first from the list with an unsaved change: warned
  await setIn('project.checker', 'alt only'); reply = [false];
  await p.click('#bLib'); await p.waitForSelector('#libDlg[open] table.tbl'); await shot('lib-list-1280');
  const rows = await p.$$eval('#libBody tbody tr', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
  assert.equal(rows.length, 2); assert.match(rows.join('|'), /Route 9 over Mill River.*B-1234.*(EST|EDT)/);
  await p.click('#libBody tr:has-text("Mill River") [data-lib=open]');
  assert.ok(dl.at(-1).startsWith('confirm: The open project has changes'), dl.at(-1));
  assert.equal((await proj()).project.name, 'Route 9 alt', 'cancelled: still the open project'); assert.equal(await p.$eval('#libDlg', d => d.open), true);
  reply = [true]; await p.click('#libBody tr:has-text("Mill River") [data-lib=open]');
  assert.equal((await proj()).project.name, 'Route 9 over Mill River'); assert.equal((await proj()).project.checker, 'first revision'); assert.equal(await state(), 'Saved');
  // 4. rename, duplicate, delete
  await p.click('#bLib'); reply = ['Mill River (renamed)']; await p.click('#libBody tr:has-text("Mill River") [data-lib=rename]');
  assert.equal((await proj()).project.name, 'Mill River (renamed)'); assert.equal(await state(), 'Saved');
  reply = ['Copy of Mill']; await p.click('#libBody tr:has-text("renamed") [data-lib=dup]');
  idx = JSON.parse(await ls('sbd2.lib.index')); assert.equal(idx.items.length, 3);
  reply = [false]; await p.click('#libBody tr:has-text("Copy of Mill") [data-lib=del]'); assert.equal(JSON.parse(await ls('sbd2.lib.index')).items.length, 3, 'delete cancelled');
  reply = [true]; await p.click('#libBody tr:has-text("Copy of Mill") [data-lib=del]'); assert.equal(JSON.parse(await ls('sbd2.lib.index')).items.length, 2);
  await shot('lib-list-2-1280'); await p.click('#libClose');
  // 5. quota: the write throws; message, nothing lost
  await setIn('project.checker', 'before the quota'); 
  await p.evaluate(() => { const o = Storage.prototype.setItem; window.__setItem = o; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('sbd2.lib.')) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } return o.call(this, k, v); }; });
  const before = await ls('sbd2.lib.index'); await p.click('#bSave');
  const msg = await p.$eval('#toast', t => t.innerText); assert.match(msg, /Not saved/); assert.match(msg, /storage is full/); await shot('quota-1280');
  assert.equal(await ls('sbd2.lib.index'), before); assert.equal((await proj()).project.checker, 'before the quota'); assert.equal(await state(), 'Unsaved changes');
  await p.evaluate(() => { Storage.prototype.setItem = window.__setItem; }); await p.click('#tClose'); await p.click('#bSave'); assert.match(await state(), /^Saved/);
  // 6. reload: the link survives
  await p.reload(); await p.waitForSelector('#bSave'); await p.waitForTimeout(400); assert.equal(await state(), 'Saved');
  // 7. old autosave only (no sbd2.lib.* keys) still opens
  const old = await ls('sbd2.project.current');
  await p.evaluate(o => { for (const k of Object.keys(localStorage)) if (k.startsWith('sbd2.lib.')) localStorage.removeItem(k); localStorage.setItem('sbd2.project.current', o); }, old);
  await p.reload(); await p.waitForSelector('#bSave'); await p.waitForTimeout(400);
  assert.equal(await p.$eval('#projName', e => e.textContent), 'Mill River (renamed)'); assert.equal(await state(), 'Not saved to the project list'); assert.deepEqual(errs, []);
  // 8. undo / redo: 60 steps
  await p.evaluate(() => document.querySelector('[data-itab="proj"]').click());
  for (let i = 1; i <= 60; i++) { await p.fill('#i_project\\.checker', 'n' + i); await p.dispatchEvent('#i_project\\.checker', 'change'); }
  assert.equal((await proj()).project.checker, 'n60');
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  for (let i = 0; i < 55; i++) await p.keyboard.press('Control+z');
  assert.equal((await proj()).project.checker, 'n5'); assert.equal(await p.$eval('#i_project\\.checker', e => e.value), 'n5');
  await p.keyboard.press('Control+y'); await p.keyboard.press('Control+Shift+z'); assert.equal((await proj()).project.checker, 'n7');
  await p.click('#bUndo'); assert.equal((await proj()).project.checker, 'n6'); await p.click('#bRedo'); assert.equal((await proj()).project.checker, 'n7');
  for (let i = 0; i < 60; i++) { if (await p.$eval('#bUndo', e => e.disabled)) break; await p.click('#bUndo'); }
  assert.ok((await proj()).project.checker !== 'n1', 'went back past n1 to the loaded project'); assert.equal(await p.$eval('#bUndo', e => e.disabled), true);
  // 9. Apply defaults (CTDOT): message + undo
  await p.fill('#i_ownerRules\\.owner', ''.padEnd(0)).catch(() => {}); await p.selectOption('#i_ownerRules\\.owner', 'CTDOT'); await p.waitForTimeout(200);
  const pre = await proj(); await p.click('[data-xsact=ownDef]'); await p.waitForTimeout(200);
  const t = await p.$eval('#toast', e => e.innerText); assert.match(t, /CTDOT defaults applied: 3 inputs changed/); assert.match(t, /Future wearing surface: 25 → 38\.75 psf/); assert.match(t, /Dead load distribution/);
  assert.equal((await proj()).xs.ws.psf, 38.75); await shot('ownerdef-1280');
  await p.click('#tUndo'); const post = await proj(); assert.equal(post.xs.ws.psf, pre.xs.ws.psf); assert.equal(post.xs.dlMethod, pre.xs.dlMethod); assert.equal(await p.$eval('#toast', e => e.hidden), true);
  await p.click('[data-xsact=ownDef]'); await p.waitForTimeout(100); await p.click('[data-xsact=ownDef]'); await p.waitForTimeout(100);
  assert.match(await p.$eval('#toast', e => e.innerText), /no input changed/);
  // 10. phone width
  await p.setViewportSize({ width: 390, height: 800 }); await p.click('#bLib'); await p.waitForSelector('#libDlg[open]'); await shot('lib-list-390'); await p.click('#libClose');
  await p.click('[data-xsact=ownDef]').catch(() => {}); await shot('main-390');
  assert.deepEqual(errs, []); console.log('steel-bridge-library: ok (0 console errors)');
} finally { await b.close(); }
