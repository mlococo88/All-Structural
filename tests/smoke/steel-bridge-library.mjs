#!/usr/bin/env node
// Browser check of the saved-project list, undo / redo and the Apply-defaults message (2026-11-01), apps/steel-bridge/index.html.
//   Save / Save as / Saved projects (open, rename, duplicate, delete), unsaved-changes warning, quota error path (setItem patched to throw),
//   the standard save controls (STDS-B, 2026-11-06: chip, card, Save as with Replace it, Ctrl+S, duplicate names listed as "(older, saved …)"),
//   an old autosave (sbd2.project.current only) still opening, Ctrl+Z / Ctrl+Y (60 steps), the Apply defaults message and its Undo.
//   SHOTS=<dir> node tests/smoke/steel-bridge-library.mjs   (screenshots at 1280 and 390 when SHOTS is set)
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';
import { makeGitHubMock } from '../engine/gh-mock.mjs';

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
// STDS-B (2026-11-06): the standard save controls (shared/projects-ui.js projectBar): header chip, Save, Saved projects…, the Project
// tab's "Save and open" card, the Save as dialog and the standard Saved projects dialog (dialog#sbdLibDlg)
const chip = () => p.$eval('[data-sp=chip]', e => e.innerText.replace(/\s+/g, ' ').trim());
const state = async () => { await p.evaluate(() => SharedProjectsUI.bars[0].refresh()); const c = await chip(); return /· not saved/.test(c) ? 'not saved' : /unsaved changes/.test(c) ? 'unsaved' : /· saved/.test(c) ? 'saved' : c; };
const saveAs = async (n, replace) => { await p.evaluate(() => SharedProjectsUI.bars[0].saveAs()); await p.waitForSelector('dialog.spSave[open]');
  await p.fill('dialog.spSave .spName', n); await p.click('dialog.spSave [data-sa=ok]'); if (replace) { assert.match(await p.$eval('dialog.spSave .spMsg', e => e.innerText), /already exists/); await p.click('dialog.spSave [data-sa=ok]'); }
  await p.waitForTimeout(150); };
const lib = async () => { await p.evaluate(() => { const d = document.getElementById('sbdLibDlg'); if (d && d.open) d.close(); }); await p.click('[data-sp=hlib]'); await p.waitForSelector('#sbdLibDlg[open] .spBody'); await p.waitForTimeout(100); };
const rowBtn = (txt, a) => p.click(`#sbdLibDlg tbody tr:has-text("${txt}") [data-spa=${a}]`);
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(500);
  assert.equal(await state(), 'not saved');
  assert.equal(await p.evaluate(() => [...document.querySelectorAll('#hdrBtns button')].map(b => b.textContent.replace(/Ctrl\+S/, '').trim()).join('|').replace(/^Project:.*?\|/, 'chip|')), 'chip|Undo|Redo|Save|Saved projects…', 'header: chip · Undo · Redo · Save · Saved projects…');
  assert.equal(await p.evaluate(() => [...document.querySelectorAll('[data-pane=proj] .sec')][0].querySelector('.secHead').textContent), 'Save and open');
  assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('[data-sp=card] button')].map(b => b.textContent.replace(/Ctrl\+(Shift\+)?S/, '').trim())), ['Save', 'Save as…', 'Saved projects…', 'New', 'Export JSON', 'Import JSON', 'From old app']);
  // 1. edit, Save (no name yet: Save as), list
  await setIn('project.name', 'Route 9 over Mill River'); await setIn('project.number', 'B-1234');
  await p.click('[data-sp=hsave]'); await p.waitForSelector('dialog.spSave[open]');
  assert.equal(await p.$eval('dialog.spSave .spName', e => e.value), 'Route 9 over Mill River', 'Save as offers the project name'); await p.click('dialog.spSave [data-sa=ok]'); await p.waitForTimeout(150);
  assert.equal(await state(), 'saved'); assert.match(await chip(), /Route 9 over Mill River/);
  let idx = JSON.parse(await ls('sbd2.lib.index')); assert.equal(idx.items.length, 1); assert.equal(idx.items[0].number, 'B-1234');
  // an edit makes it unsaved; Save (and Ctrl+S) overwrite without asking
  await setIn('project.checker', 'first revision'); assert.equal(await state(), 'unsaved');
  reply = []; const n0 = dl.length; await p.click('[data-sp=hsave]'); assert.equal(dl.length, n0, 'Save of a linked project asks nothing');
  await p.waitForTimeout(100); assert.equal((await proj()).project.checker, 'first revision'); assert.equal(await state(), 'saved');
  await setIn('project.checker', 'first revision b'); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('Control+s'); await p.waitForTimeout(150);
  assert.equal(await state(), 'saved'); assert.equal(dl.length, n0, 'Ctrl+S asks nothing'); assert.equal(JSON.parse(await ls('sbd2.lib.index')).items.length, 1);
  await setIn('project.checker', 'first revision'); await p.click('[data-sp=hsave]');
  // 2. Save as: a second project; a name in use is not overwritten without "Replace it"
  await saveAs('Route 9 alt'); idx = JSON.parse(await ls('sbd2.lib.index')); assert.equal(idx.items.length, 2);
  assert.equal((await proj()).project.name, 'Route 9 alt'); assert.equal(await p.$eval('#i_project\\.name', e => e.value), 'Route 9 alt');
  await saveAs('Route 9 over Mill River', true); idx = JSON.parse(await ls('sbd2.lib.index')); assert.equal(idx.items.length, 2, 'Replace it: no new duplicate name');
  assert.equal(idx.items.filter(i => i.name === 'Route 9 over Mill River').length, 1);
  await p.evaluate(() => SharedProjectsUI.bars[0].dialog.el.close());
  // put the first one back (open it, change, save), then reopen alt
  await lib(); await rowBtn('Mill River', 'open'); await setIn('project.checker', 'first revision'); await p.click('[data-sp=hsave]');
  await lib(); await rowBtn('Route 9 alt', 'open'); assert.equal((await proj()).project.name, 'Route 9 alt');
  // 3. open the first from the list with an unsaved change: warned
  await setIn('project.checker', 'alt only'); reply = [false];
  await lib(); await shot('lib-list-1280');
  const rows = await p.$$eval('#sbdLibDlg tbody tr', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
  assert.equal(rows.length, 2); assert.match(rows.join('|'), /Route 9 over Mill River.*(EST|EDT)/);
  await rowBtn('Mill River', 'open');
  assert.ok(dl.at(-1).startsWith('confirm: The project on screen has unsaved changes'), dl.at(-1));
  assert.equal((await proj()).project.name, 'Route 9 alt', 'cancelled: still the open project'); assert.equal(await p.$eval('#sbdLibDlg', d => d.open), true);
  reply = [true]; await rowBtn('Mill River', 'open');
  assert.equal((await proj()).project.name, 'Route 9 over Mill River'); assert.equal((await proj()).project.checker, 'first revision'); assert.equal(await state(), 'saved');
  // the project's name field renames the item on Save (as before); a name of another saved project is refused
  await setIn('project.name', 'Route 9 alt'); reply = [true]; await p.click('[data-sp=hsave]'); assert.match(dl.at(-1), /alert: Not saved: the project name/);
  assert.equal(JSON.parse(await ls('sbd2.lib.index')).items.filter(i => i.name === 'Route 9 alt').length, 1);
  await setIn('project.name', 'Route 9 over Mill River');
  // 4. rename, duplicate, delete
  await lib(); reply = ['Mill River (renamed)']; await rowBtn('Mill River', 'rename');
  assert.equal((await proj()).project.name, 'Mill River (renamed)'); assert.equal(await state(), 'saved');
  reply = ['Copy of Mill']; await rowBtn('renamed', 'dup');
  idx = JSON.parse(await ls('sbd2.lib.index')); assert.equal(idx.items.length, 3);
  reply = [false]; await rowBtn('Copy of Mill', 'del'); assert.equal(JSON.parse(await ls('sbd2.lib.index')).items.length, 3, 'delete cancelled');
  reply = [true]; await rowBtn('Copy of Mill', 'del'); assert.equal(JSON.parse(await ls('sbd2.lib.index')).items.length, 2);
  // 4b. duplicate names kept from before (engine/library.js allows them): every item is listed; the older one under "(older, saved …)"
  await p.evaluate(() => { const q = SBDModel.defaultProject(); q.project.name = 'Route 9 alt'; q.project.checker = 'old dup'; SBDLibrary.save(localStorage, q, null, { now: '2026-10-01T15:00:00Z' }); });
  await lib(); const dn = await p.$$eval('#sbdLibDlg tbody tr td:first-child', r => r.map(x => x.innerText.trim()));
  assert.ok(dn.includes('Route 9 alt') && dn.some(n => /^Route 9 alt \(older, saved Oct 1, 2026, 11:00 AM EDT\)$/.test(n)), dn.join(' | '));
  reply = [true]; await rowBtn('(older', 'open'); assert.equal((await proj()).project.checker, 'old dup'); assert.equal(await state(), 'saved');
  assert.match(await chip(), /older, saved/);
  reply = ['Route 9 alt (2010 plans)']; await lib(); await rowBtn('(older', 'rename');
  assert.equal((await proj()).project.name, 'Route 9 alt (2010 plans)'); idx = JSON.parse(await ls('sbd2.lib.index')); assert.equal(idx.items.length, 3);
  await lib(); reply = [true]; await rowBtn('2010 plans', 'del'); await shot('lib-list-2-1280'); await p.evaluate(() => document.getElementById('sbdLibDlg').close());
  await lib(); await rowBtn('Mill River', 'open'); await p.evaluate(() => document.getElementById('sbdLibDlg').open && document.getElementById('sbdLibDlg').close());
  // 5. quota: the write throws; message, nothing lost
  await setIn('project.checker', 'before the quota');
  await p.evaluate(() => { const o = Storage.prototype.setItem; window.__setItem = o; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('sbd2.lib.')) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } return o.call(this, k, v); }; });
  const before = await ls('sbd2.lib.index'); reply = [true]; await p.click('[data-sp=hsave]');
  const msg = dl.at(-1); assert.match(msg, /^alert: The project was not saved/); assert.match(msg, /storage is full/);
  assert.equal(await ls('sbd2.lib.index'), before); assert.equal((await proj()).project.checker, 'before the quota'); assert.equal(await state(), 'unsaved');
  await p.evaluate(() => { Storage.prototype.setItem = window.__setItem; }); await p.click('[data-sp=hsave]'); assert.equal(await state(), 'saved');
  // 6. reload: the link survives
  await p.reload(); await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(400); assert.equal(await state(), 'saved'); assert.match(await chip(), /Mill River \(renamed\)/);
  // 7. old autosave only (no sbd2.lib.* keys) still opens
  const old = await ls('sbd2.project.current');
  await p.evaluate(o => { for (const k of Object.keys(localStorage)) if (k.startsWith('sbd2.lib.')) localStorage.removeItem(k); localStorage.setItem('sbd2.project.current', o); }, old);
  await p.reload(); await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(400);
  assert.equal(await p.$eval('#i_project\\.name', e => e.value), 'Mill River (renamed)'); assert.equal(await state(), 'not saved'); assert.deepEqual(errs, []);
  // 7b. unsaved work restored from the autosave: Open / New ask first (askUnsaved: 'always'), New is the default project
  reply = [false]; await p.click('[data-sp=new]'); assert.match(dl.at(-1), /^confirm: The project on screen has unsaved changes/); assert.equal((await proj()).project.name, 'Mill River (renamed)');
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
  // 10. phone width: no sideways scroll
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(300); assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at 390 px');
  await lib(); await shot('lib-list-390'); assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await p.evaluate(() => document.getElementById('sbdLibDlg').close());
  await p.click('[data-xsact=ownDef]').catch(() => {}); await shot('main-390');
  assert.deepEqual(errs, []);
} finally { await b.close(); }
// 11. GitHub sync with duplicate names (STDS-B): the older item is listed, "not synced"; only the newest of a name is uploaded; deleting
//     the newest while an older one keeps the name does not offer to delete the GitHub file; Rename gives the older one its own file
{ const TOKEN = 'github_pat_SMOKE0000000000000000wxyz', gh = makeGitHubMock({ token: TOKEN }), F = n => `projects/steel-bridge-app/${n}.json`;
  const s = await openPage(FILE, { vw: 1280, vh: 900, ls: { 'bridgeSuite.v1.githubSync': JSON.stringify({ owner: 'mlococo88', repo: 'structural-projects', branch: 'main', token: TOKEN, device: 'Smoke' }) } });
  const q = s.p, sdl = []; q.removeAllListeners('dialog'); q.on('dialog', async d => { sdl.push(d.type() + ': ' + d.message().slice(0, 160)); await d.accept(d.type() === 'prompt' ? 'Dup B' : undefined); });
  await q.route('https://api.github.com/**', async r => { const x = r.request(); const res = gh.handle(x.method(), x.url(), await x.allHeaders(), x.postData()); return r.fulfill({ status: res.status, headers: res.headers, body: res.body }); });
  const until = async (f, ms, w) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + w); await new Promise(r => setTimeout(r, 150)); } };
  try {
    await q.waitForSelector('[data-sp=chip]');
    await q.evaluate(() => { const L = SBDLibrary, M = SBDModel; const a = M.defaultProject(); a.project.name = 'Dup'; a.project.checker = 'old'; L.save(localStorage, a, null, { now: '2026-10-01T15:00:00Z' });
      const c = M.defaultProject(); c.project.name = 'Dup'; c.project.checker = 'new'; L.save(localStorage, c, null, { now: '2026-10-02T15:00:00Z' }); });
    await q.click('[data-sp=hlib]'); await q.waitForSelector('#sbdLibDlg[open]');   // saved after sync was set up: uploaded in the background
    await until(() => gh.files.has(F('Dup')), 15000, 'upload of Dup');
    assert.equal(JSON.parse(gh.files.get(F('Dup'))).project.checker, 'new', 'the newest of the name is the GitHub file'); assert.equal(gh.files.size, 1);
    await q.evaluate(() => SharedProjectsUI.bars[0].dialog.refresh()); await q.waitForTimeout(300);
    assert.match(await q.$eval('#sbdLibDlg tbody tr:has-text("(older") ', e => e.innerText), /not synced: a newer saved project has the same name/);
    await q.click('#sbdLibDlg tbody tr:has-text("(older") [data-spa=rename]'); await until(() => gh.files.has(F('Dup B')), 15000, 'upload after Rename');
    assert.equal(JSON.parse(gh.files.get(F('Dup B'))).project.checker, 'old');
    // a second older one; delete the newest: the name is still in the list, so no "Also delete from GitHub" question
    await q.evaluate(() => { const c = SBDModel.defaultProject(); c.project.name = 'Dup'; c.project.checker = 'older'; SBDLibrary.save(localStorage, c, null, { now: '2026-09-01T15:00:00Z' }); });
    await q.evaluate(() => SharedProjectsUI.bars[0].dialog.refresh()); await q.waitForTimeout(200); sdl.length = 0;
    await q.click('#sbdLibDlg tbody tr[data-name="Dup"] [data-spa=del]'); await q.waitForTimeout(800);
    assert.ok(sdl.length === 1 && /^confirm: Delete the saved project "Dup"/.test(sdl[0]), sdl.join(' | '));
    assert.ok(gh.files.has(F('Dup')), 'the GitHub file is kept');
    assert.deepEqual(s.errs, []); console.log('ok  sync with duplicate names: newest uploaded, older "not synced", Rename uploads it, delete keeps the GitHub file while the name is in use');
  } finally { await s.b.close(); }
}
console.log('steel-bridge-library: ok (0 console errors)');
