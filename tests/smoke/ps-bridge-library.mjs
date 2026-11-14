#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), PR 5: saved projects and GitHub sync (shared/projects-ui.js projectBar over engine/library.js,
// shared/github-sync.js with tool 'ps-bridge-app'). Headless Chromium, file://, CDN libraries from tests/libs; api.github.com is routed to
// the in-memory GitHub of tests/engine/gh-mock.mjs (nothing reaches the network).
//   1. an existing user's open project (psb2.project.current only, as saved before PR 5) opens unchanged: the same inputs, the autosave text
//      byte-identical, the chip "not saved"; the header has the chip; the Project tab's "Save and open" card: Save, Save as…, Saved projects…,
//      New, Export JSON, Import JSON; the "From the old app" card still below;
//   2. Ctrl+S with no saved name: Save as (name offered) -> saved; an edit -> "unsaved changes"; Ctrl+S saves without a question;
//   3. Save as a second project; a name in use asks "Replace it"; Saved projects…: Open with unsaved changes asks first (Cancel keeps the
//      project), OK opens it; Rename (the open project's name follows), Duplicate, Delete (Cancel keeps it, OK deletes);
//   4. New with unsaved changes asks first; Import JSON asks first; a reload keeps the saved link (chip "saved");
//   5. Export JSON: the downloaded text = the stored item text = M.exportJSON of the open project (format unchanged);
//   6. every key the page added is psb2.* (the seeded psbeam.* / sbd2.* / bridgeSuite.v1.projects keys byte-identical);
//   7. Cloud sync: off = no request; set up in the Cloud sync dialog (token typed there only) -> Test connection; a saved project is uploaded
//      to projects/ps-bridge-app/<name>.json = the stored item text; the token only in the Authorization header to api.github.com: not in a
//      URL, the page text, a console message, an exported file, a project or any key but bridgeSuite.v1.githubSync;
//   8. 390 px: no sideways scroll; 0 console errors.
//   SHOTS=<dir> node tests/smoke/ps-bridge-library.mjs   (screenshots when SHOTS is set)
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';
import { makeGitHubMock } from '../engine/gh-mock.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/ps-bridge/index.html');
const TOKEN = 'github_pat_SMOKEPSB000000000000qrst';
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const until = async (f, ms, w) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + w); await new Promise(r => setTimeout(r, 150)); } };

// an existing user's project, as the app saved it before PR 5 (psb2.project.current only): made by the app itself in a first page, edited
const OLD = { 'psbeam.inputs.v1': '{"girder":"PCI BT-72"}', 'sbd2.project.current': '{"x":1}', 'bridgeSuite.v1.projects': '{"a":1}' };
let seeded;
{ const s = await openPage(FILE, { vw: 1280, vh: 900 });
  try { await s.p.waitForSelector('#inTabs [data-itab]');
    seeded = await s.p.evaluate(() => { const P = PSBModel.newProject(); P.project.name = 'Existing bridge'; P.project.number = 'B-77'; P.spans.lengths = [96]; P.xs.nb = 6; P.xs.bays = [8, 8, 8, 8, 8];
      return PSBModel.exportJSON(PSBModel.importJSON(PSBModel.exportJSON(P)).project); });
    assert.deepEqual(s.errs, []);
  } finally { await s.b.close(); } }

// The seed is written once, then the page is reloaded (not openPage's ls seed: its init script re-seeds on every navigation where Chromium
// has not kept the tab's sessionStorage across a file:// reload, which it sometimes does not; step 4's reload then put the old autosave
// back, and the chip rightly said "unsaved changes": the flaky 'unsaved' !== 'saved').
const SEED = { ...OLD, 'psb2.project.current': seeded };
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 900 });
await p.waitForSelector('#inTabs [data-itab]');
await p.evaluate(o => { localStorage.clear(); for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); }, SEED);
await p.reload();
const consoleAll = []; p.on('console', m => consoleAll.push(m.text()));
const dl = []; let reply = [];   // dialogs seen; replies: prompt text / true / false in order (default: accept)
p.removeAllListeners('dialog');
p.on('dialog', async d => { dl.push(d.type() + ': ' + d.message().slice(0, 200)); const r = reply.shift(); if (r === false) await d.dismiss(); else await d.accept(typeof r === 'string' ? r : undefined); });
const gh = makeGitHubMock({ token: TOKEN }), other = [];
await p.route('https://api.github.com/**', async r => { const x = r.request(); const res = gh.handle(x.method(), x.url(), await x.allHeaders(), x.postData()); return r.fulfill({ status: res.status, headers: res.headers, body: res.body }); });
p.on('request', r => { const u = r.url(); if (!/^(file|data|blob|about):/.test(u) && !u.startsWith('https://api.github.com/') && !/cdnjs|jsdelivr/.test(u)) other.push(u); });
const ls = k => p.evaluate(k => localStorage.getItem(k), k);
const keys = () => p.evaluate(() => Object.keys(localStorage).sort());
const proj = async () => JSON.parse(await ls('psb2.project.current'));
const projTab = () => p.evaluate(() => { const t = document.querySelector('#inTabs [data-itab="proj"]'); t && t.click(); });
const setIn = async (pth, v) => { await projTab(); const sel = `#i_${pth.replace(/\./g, '\\.')}`; await p.fill(sel, String(v)); await p.dispatchEvent(sel, 'change'); };
const chip = () => p.$eval('[data-sp=chip]', e => e.innerText.replace(/\s+/g, ' ').trim());
const state = async () => { await p.evaluate(() => SharedProjectsUI.bars[0].refresh()); const c = await chip(); return /· not saved/.test(c) ? 'not saved' : /unsaved changes/.test(c) ? 'unsaved' : /· saved/.test(c) ? 'saved' : c; };
const saveAs = async (nm, replace) => { await p.evaluate(() => SharedProjectsUI.bars[0].saveAs()); await p.waitForSelector('dialog.spSave[open]');
  await p.fill('dialog.spSave .spName', nm); await p.click('dialog.spSave [data-sa=ok]');
  if (replace) { assert.match(await p.$eval('dialog.spSave .spMsg', e => e.innerText), /already exists/); await p.click('dialog.spSave [data-sa=ok]'); }
  await p.waitForTimeout(150); };
const ctrlS = async () => { await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('Control+s'); await p.waitForTimeout(150); };
const lib = async () => { await p.evaluate(() => { const d = document.getElementById('psbLibDlg'); if (d && d.open) d.close(); }); await p.click('[data-sp=chip]'); await p.click('[data-sp=card] [data-sp=lib]'); await p.waitForSelector('#psbLibDlg[open] .spBody'); await p.waitForTimeout(100); };
const closeDlgs = () => p.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
const rowBtn = (txt, a) => p.click(`#psbLibDlg tbody tr:has-text("${txt}") [data-spa=${a}]`);
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(600);
  // 1. the existing user's project
  assert.equal(await ls('psb2.project.current'), seeded, 'the autosave text is byte-identical after the page opened');
  await projTab();
  assert.equal(await p.$eval('#i_project\\.name', e => e.value), 'Existing bridge'); assert.equal(await p.$eval('#i_project\\.number', e => e.value), 'B-77');
  assert.equal((await proj()).spans.lengths.join(), '96'); assert.equal((await proj()).xs.nb, 6);
  assert.equal(await state(), 'not saved'); assert.match(await chip(), /Existing bridge/);
  for (const [k, v] of Object.entries(OLD)) assert.equal(await ls(k), v, k);
  ok('an existing user\'s open project (psb2.project.current only) opens unchanged, byte-identical; chip "not saved"');
  assert.equal(await p.evaluate(() => [...document.querySelectorAll('#hdrBtns [data-sp]')].map(b => b.dataset.sp).join()), 'chip', 'header: the chip');
  assert.equal(await p.evaluate(() => [...document.querySelectorAll('[data-pane=proj] .sec')][0].querySelector('.secHead').textContent), 'Save and open');
  assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('[data-sp=card] button')].map(b => b.textContent.replace(/Ctrl\+(Shift\+)?S/, '').trim())), ['Save', 'Save as…', 'Saved projects…', 'New', 'Export JSON', 'Import JSON']);
  assert.ok(await p.$('#lgCard'), 'the "From the old app" card is still on the Project tab');
  await p.evaluate(() => { const t = document.querySelector('[data-itab="xsec"]'); t && t.click(); }); await p.click('[data-sp=chip]');
  assert.equal(await p.evaluate(() => { const t = document.querySelector('#inTabs [aria-selected=true]'); const c = document.querySelector('[data-sp=card]'); return (t && t.dataset.itab) + '|' + !!(c && c.offsetParent); }), 'proj|true', 'the chip opens the Project tab with the card');
  ok('header chip; the "Save and open" card: Save, Save as…, Saved projects…, New, Export JSON, Import JSON; "From the old app" kept');
  await shot('psb-card-1280');

  // 2. Ctrl+S with no saved name: Save as
  await setIn('project.name', 'Route 2 over the Pawcatuck');
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('Control+s'); await p.waitForSelector('dialog.spSave[open]');
  assert.equal(await p.$eval('dialog.spSave .spName', e => e.value), 'Route 2 over the Pawcatuck', 'Save as offers the project name'); await p.click('dialog.spSave [data-sa=ok]'); await p.waitForTimeout(200);
  assert.equal(await state(), 'saved'); assert.match(await chip(), /Route 2 over the Pawcatuck/);
  let idx = JSON.parse(await ls('psb2.lib.index')); assert.equal(idx.schema, 'psb2.library'); assert.equal(idx.items.length, 1); assert.equal(idx.items[0].number, 'B-77');
  const id1 = idx.items[0].id; assert.equal(JSON.parse(await ls('psb2.lib.current')).id, id1);
  assert.equal(await ls('psb2.lib.p.' + id1), await ls('psb2.project.current'), 'the stored item = the autosave text (both M.exportJSON)');
  await setIn('project.checker', 'first revision'); assert.equal(await state(), 'unsaved');
  const n0 = dl.length; await ctrlS(); assert.equal(dl.length, n0, 'Ctrl+S of a saved project asks nothing');
  assert.equal(await state(), 'saved'); assert.equal(JSON.parse(await ls('psb2.lib.p.' + id1)).project.checker, 'first revision');
  ok('Ctrl+S: Save as with the name offered, then saved; an edit shows "unsaved changes"; Ctrl+S saves without a question');

  // 3. Save as, Replace it, Saved projects…: open (asks first), rename, duplicate, delete
  await saveAs('Route 2 alt'); idx = JSON.parse(await ls('psb2.lib.index')); assert.equal(idx.items.length, 2);
  assert.equal((await proj()).project.name, 'Route 2 alt'); assert.equal(await p.$eval('#i_project\\.name', e => e.value), 'Route 2 alt');
  await saveAs('Route 2 over the Pawcatuck', true); idx = JSON.parse(await ls('psb2.lib.index')); assert.equal(idx.items.length, 2, 'Replace it: no duplicate name');
  await closeDlgs();
  await lib(); await rowBtn('Route 2 alt', 'open'); await p.waitForTimeout(200);
  await setIn('project.checker', 'alt only'); assert.equal(await state(), 'unsaved');
  await lib(); await shot('psb-lib-1280');
  const rows = await p.$$eval('#psbLibDlg tbody tr', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
  assert.ok(rows.length >= 1 && /(EST|EDT)/.test(rows.join('|')), rows.join(' | '));
  reply = [false]; await rowBtn('Route 2 alt', 'open'); await p.waitForTimeout(100);
  assert.ok(dl.at(-1).startsWith('confirm: The project on screen has unsaved changes'), dl.at(-1));
  assert.equal((await proj()).project.checker, 'alt only', 'cancelled: the project on screen kept');
  reply = [true]; await rowBtn('Route 2 alt', 'open'); await p.waitForTimeout(200);
  assert.equal((await proj()).project.checker, 'first revision'); assert.equal(await state(), 'saved');
  ok('Save as; a name in use asks "Replace it"; Open with unsaved changes asks first (Cancel keeps them), OK opens the saved project');
  await lib(); reply = ['Route 2 alt (renamed)']; await rowBtn('Route 2 alt', 'rename'); await p.waitForTimeout(200);
  assert.equal((await proj()).project.name, 'Route 2 alt (renamed)'); assert.equal(await p.$eval('#i_project\\.name', e => e.value), 'Route 2 alt (renamed)'); assert.equal(await state(), 'saved');
  reply = ['Copy of alt']; await rowBtn('renamed', 'dup'); await p.waitForTimeout(200);
  idx = JSON.parse(await ls('psb2.lib.index')); assert.equal(idx.items.length, 3);
  reply = [false]; await rowBtn('Copy of alt', 'del'); await p.waitForTimeout(100); assert.match(dl.at(-1), /^confirm: Delete/); assert.equal(JSON.parse(await ls('psb2.lib.index')).items.length, 3, 'delete cancelled');
  reply = [true]; await rowBtn('Copy of alt', 'del'); await p.waitForTimeout(200); assert.equal(JSON.parse(await ls('psb2.lib.index')).items.length, 2);
  await closeDlgs();
  ok('Rename (the open project\'s name follows), Duplicate, Delete (asks; Cancel keeps it, OK deletes)');

  // 4. New / Import ask first on unsaved changes; reload keeps the link
  await setIn('project.checker', 'not saved yet');
  reply = [false]; await p.click('[data-sp=card] [data-sp=new]'); await p.waitForTimeout(100);
  assert.match(dl.at(-1), /^confirm: The project on screen has unsaved changes/); assert.equal((await proj()).project.checker, 'not saved yet');
  reply = [false]; await p.click('#bImport'); await p.waitForTimeout(100); assert.match(dl.at(-1), /^confirm: The project on screen has unsaved changes/);
  await ctrlS(); assert.equal(await state(), 'saved');
  await p.reload(); await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(500);
  assert.equal(await state(), 'saved'); assert.match(await chip(), /Route 2 alt \(renamed\)/);
  reply = [true]; await p.click('[data-sp=card] [data-sp=new]'); await p.waitForTimeout(300);
  assert.equal((await proj()).project.name, 'New prestressed bridge'); assert.equal(await state(), 'not saved'); assert.equal(await ls('psb2.lib.current'), null);
  await lib(); reply = [true]; await rowBtn('renamed', 'open'); await p.waitForTimeout(300); await closeDlgs();
  assert.equal(await state(), 'saved');
  ok('New and Import JSON ask first on unsaved changes; a reload keeps the saved link; New is "not saved"');

  // 5. Export JSON: the same text as the stored item
  const [dn] = await Promise.all([p.waitForEvent('download'), p.click('#bExport')]);
  const exp = fs.readFileSync(await dn.path(), 'utf8'), cid = JSON.parse(await ls('psb2.lib.current')).id;
  assert.equal(dn.suggestedFilename(), 'Route_2_alt_renamed_.psb2.json');
  assert.equal(exp, await ls('psb2.lib.p.' + cid), 'Export JSON = the stored item text'); assert.equal(exp, await p.evaluate(() => PSBModel.exportJSON(JSON.parse(localStorage.getItem('psb2.project.current')))));
  assert.equal(JSON.parse(exp).schema, 'psb2.project');
  ok('Export JSON: the downloaded file = the saved item text = M.exportJSON (format unchanged)');

  // 6. keys: every key the page added is psb2.*
  const ks = await keys();
  for (const k of ks) if (!(k in OLD)) assert.ok(k.startsWith('psb2.'), 'a key without the psb2. prefix: ' + k);
  for (const [k, v] of Object.entries(OLD)) assert.equal(await ls(k), v, k);
  assert.ok(ks.includes('psb2.lib.index') && ks.includes('psb2.lib.current') && ks.some(k => k.startsWith('psb2.lib.p.')));
  ok('every key the page added is psb2.* (' + ks.filter(k => k.startsWith('psb2.')).join(', ').replace(/psb2\.lib\.p\.\w+/g, 'psb2.lib.p.<id>') + '); other tools\' keys byte-identical');

  // 7. Cloud sync
  await lib(); await p.waitForTimeout(1500);
  assert.match(await p.evaluate(() => document.getElementById('psbLibDlg').innerText), /Cloud sync \(GitHub\): off/); assert.equal(gh.log.length, 0, 'sync off: no request');
  await p.click('#psbLibDlg [data-gh=setup]'); await p.waitForSelector('#spGhDlg[open]');
  await p.fill('#spGhToken', TOKEN); await p.fill('#spGhDevice', 'Smoke PC');
  await p.click('#spGhDlg [data-gh=test]'); await until(() => p.evaluate(() => /Connected to|Not connected/.test(document.querySelector('#spGhDlg .spGhRes').textContent)), 10000, 'test connection');
  assert.match(await p.evaluate(() => document.querySelector('#spGhDlg .spGhRes').textContent), /Connected to mlococo88\/structural-projects/);
  assert.equal(await p.inputValue('#spGhToken'), ''); await shot('psb-cloud-1280');
  await p.click('#spGhDlg [data-gh=close]');
  await until(() => p.evaluate(() => !!document.querySelector('#psbLibDlg [data-ghx=upall]')), 10000, 'first-connect offer');
  await p.click('#psbLibDlg [data-ghx=upall]');
  const F = 'projects/ps-bridge-app/Route 2 alt (renamed).json';
  await until(() => gh.files.has(F), 15000, 'upload'); assert.equal(gh.files.get(F), await ls('psb2.lib.p.' + cid), 'the GitHub file = the stored item text');
  assert.ok([...gh.files.keys()].filter(k => !k.includes('/.presence/')).every(k => k.startsWith('projects/ps-bridge-app/')), [...gh.files.keys()].join());
  await closeDlgs(); await setIn('project.checker', 'cloud edit'); await ctrlS();
  await until(() => JSON.parse(gh.files.get(F)).project.checker === 'cloud edit', 15000, 'upload after Ctrl+S');
  ok('Cloud sync: off = no request; set up in its dialog; Upload all and Save upload projects/ps-bridge-app/<name>.json = the stored item text');
  const [dn2] = await Promise.all([p.waitForEvent('download'), p.click('#bExport')]); const exp2 = fs.readFileSync(await dn2.path(), 'utf8');
  for (const l of gh.log) { assert.ok(l.url.startsWith('https://api.github.com/repos/mlococo88/structural-projects'), l.url); assert.ok(!l.url.includes(TOKEN)); assert.equal(l.auth, `Bearer ${TOKEN}`); }
  assert.ok(!(await p.evaluate(() => document.body.innerText)).includes(TOKEN)); assert.ok(!consoleAll.some(t => t.includes(TOKEN)), 'the token in a console message');
  assert.ok(!exp2.includes(TOKEN) && !exp.includes(TOKEN), 'the token in an exported file');
  for (const k of await keys()) if (k !== 'bridgeSuite.v1.githubSync') assert.ok(!((await ls(k)) || '').includes(TOKEN), k);
  for (const t of gh.files.values()) assert.ok(!t.includes(TOKEN));
  assert.equal(other.length, 0, other.join(' '));
  const ghKeys = (await keys()).filter(k => !(k in OLD) && !k.startsWith('psb2.'));
  ghKeys.forEach(k => assert.ok(k === 'bridgeSuite.v1.githubSync' || /^bridgeSuite\.v1\.githubSync\.(deviceId|live|tool\.ps-bridge-app|presence\.ps-bridge-app)$/.test(k), k));
  ok('the token: only in the Authorization header to api.github.com; not in a URL, the page text, the console, an exported file, a project or another key; '
    + 'sync keys (shared/github-sync.js, set up only): ' + ghKeys.join(', '));

  // 8. phone width
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(300);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at 390 px');
  await lib(); assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await shot('psb-lib-390'); await closeDlgs();
  assert.deepEqual(errs, []);
  ok('390 px: no sideways scroll; 0 console errors');
} finally { await b.close(); }
console.log(`ps-bridge-library: ${n} checks ok (0 console errors)`);
