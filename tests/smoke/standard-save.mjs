#!/usr/bin/env node
// The standard save controls (shared/projects-ui.js projectBar + the standard Saved projects dialog, STDS, 2026-11-05), headless,
// offline, on the test page tests/smoke/standard-save-fixture.html (a minimal tool over a mapStore list). api.github.com is routed
// to the in-memory GitHub of tests/engine/gh-mock.mjs; nothing reaches the network.
//   1. sync off: no request, no key but the tool's own; chip "not saved"; header order chip · Undo · Redo · Save · Saved projects… · Print;
//   2. Ctrl+S with no open name = Save as (GitHub option disabled while sync is off); saved -> chip "saved", status line;
//   3. an input change -> "unsaved changes"; Ctrl+S saves to the open name without a question (no dialog, no alert);
//   4. Save as an existing name: blocked with "Replace it"; another name is saved; Ctrl+Shift+S opens Save as;
//   5. Save as "File on this computer": the tool's Export JSON path, the list unchanged;
//   6. the dialog: one table (Name / Last saved / Size / This browser / Open Rename Duplicate Export Delete), filter, row Export
//      (= the stored item as JSON), Open asks when there are unsaved changes, Delete asks;
//   7. sync on: Save as defaults to "This browser and GitHub"; "This browser only" is not uploaded (status "this browser only",
//      Upload sends it); a GitHub-only project is a row of the same table with Open / Download / Delete from GitHub;
//   8. reload: the open project is found again by its content; 390 px: no sideways scroll (page and dialog); no console errors.
//   node tests/smoke/standard-save.mjs [--shots <dir>]
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';
import { makeGitHubMock } from '../engine/gh-mock.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SHOTS = arg('shots', process.env.SHOTS);
const FILE = path.join(REPO, 'tests/smoke/standard-save-fixture.html');
const TOKEN = 'github_pat_SMOKE0000000000000000wxyz';
const until = async (f, ms = 10000, what = '') => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + what); await new Promise(r => setTimeout(r, 150)); } };
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const shot = async (p, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, name + '.png') }); } };

const gh = makeGitHubMock({ token: TOKEN });
const { b, ctx, p, errs } = await openPage(FILE, { vw: 1280, vh: 800 });
await p.route('https://api.github.com/**', async route => { const r = route.request(); const res = gh.handle(r.method(), r.url(), await r.allHeaders(), r.postData()); return route.fulfill({ status: res.status, headers: res.headers, body: res.body }); });
const asked = []; p.removeAllListeners('dialog'); p.on('dialog', async d => { asked.push(d.type() + ': ' + d.message()); await d.accept(); });
const keys = () => p.evaluate(() => Object.keys(localStorage).sort());
const list = () => p.evaluate(() => JSON.parse(localStorage.getItem('fixt_projects') || '{}'));
const chip = () => p.evaluate(() => document.querySelector('[data-sp=chip]').innerText.replace(/\s+/g, ' ').trim());
const setSpan = async v => { await p.fill('#span', String(v)); await p.dispatchEvent('#span', 'change'); await p.waitForTimeout(350); };
const saOpen = () => p.evaluate(() => !!document.querySelector('dialog.spSave[open]'));

// 1
await p.waitForTimeout(400);
assert.match(await chip(), /Project: Bridge 1 · not saved/);
const order = await p.evaluate(() => [...document.getElementById('hdr').children].map(e => e.id || e.dataset.sp || e.tagName));
assert.deepEqual(order, ['H1', 'chip', 'undo', 'redo', 'hsave', 'hlib', 'print']);
const card = await p.evaluate(() => [...document.querySelectorAll('#cardBody .spRow')].map(r => [...r.children].map(b => b.textContent.replace(/Ctrl.*$/, '').trim())));
assert.deepEqual(card, [['Save', 'Save as…', 'Saved projects…', 'New'], ['Export JSON', 'Import JSON'], ['Compare…']]);
ok('sync off: chip "not saved"; header chip · Undo · Redo · Save · Saved projects… · Print; card rows Save / Save as… / Saved projects… / New, Export / Import JSON, extras');
// 2
await p.keyboard.press('Control+s'); await until(saOpen, 3000, 'Save as on Ctrl+S');
assert.equal(await p.evaluate(() => document.querySelector('dialog.spSave input[value=cloud]').disabled), true);
assert.equal(await p.evaluate(() => document.querySelector('dialog.spSave input[value=local]').checked), true);
await shot(p, 'std-saveas-off');
await p.fill('dialog.spSave .spName', 'Job A'); await p.click('dialog.spSave [data-sa=ok]'); await p.waitForTimeout(300);
assert.deepEqual(await list(), { 'Job A': { span: 40, title: 'Bridge 1' } });
assert.match(await chip(), /Project: Job A · saved/);
assert.match(await p.evaluate(() => document.querySelector('.spStat').innerText), /Job A — saved \(\d+:\d\d [AP]M\)\. In this browser ✓/);
assert.equal(gh.log.length, 0); assert.deepEqual((await keys()).filter(k => !k.startsWith('fixt_')), []);
ok('Ctrl+S with no open name opens Save as (GitHub disabled while sync is off); saved: chip "saved"; no request, no other key');
// 3
await setSpan(50); assert.match(await chip(), /Job A · unsaved changes/);
const a0 = asked.length; await p.keyboard.press('Control+s'); await p.waitForTimeout(300);
assert.equal(await saOpen(), false); assert.equal(asked.length, a0);
assert.equal((await list())['Job A'].span, 50); assert.match(await chip(), /Job A · saved/);
await setSpan(60); await p.click('[data-sp=hsave]'); await p.waitForTimeout(200); assert.equal((await list())['Job A'].span, 60);
ok('a change -> "unsaved changes"; Ctrl+S and the header Save save to the open name with no question');
// 4
await p.keyboard.press('Control+Shift+s'); await until(saOpen, 3000, 'Ctrl+Shift+S');
await p.fill('dialog.spSave .spName', 'Job B'); await p.click('dialog.spSave [data-sa=ok]'); await p.waitForTimeout(200);
await setSpan(70);
await p.keyboard.press('Control+Shift+s'); await until(saOpen, 3000);
await p.fill('dialog.spSave .spName', 'Job A'); await p.click('dialog.spSave [data-sa=ok]'); await p.waitForTimeout(200);
assert.equal(await saOpen(), true); assert.match(await p.evaluate(() => document.querySelector('dialog.spSave .spWarn').textContent), /already exists/);
assert.equal(await p.evaluate(() => document.querySelector('dialog.spSave [data-sa=ok]').textContent), 'Replace it');
assert.equal((await list())['Job A'].span, 60);
await shot(p, 'std-saveas-exists');
await p.fill('dialog.spSave .spName', 'Job C'); await p.click('dialog.spSave [data-sa=ok]'); await p.waitForTimeout(200);
assert.equal((await list())['Job C'].span, 70); assert.equal((await list())['Job A'].span, 60);
await p.keyboard.press('Control+Shift+s'); await until(saOpen, 3000); await p.fill('dialog.spSave .spName', 'Job A');
await p.click('dialog.spSave [data-sa=ok]'); await p.click('dialog.spSave [data-sa=ok]'); await p.waitForTimeout(200);
assert.equal((await list())['Job A'].span, 70); assert.match(await chip(), /Job A · saved/);
ok('Save as an existing name is blocked ("Replace it"); another name saves; Replace it overwrites; Ctrl+Shift+S opens Save as');
// 5
const L5 = JSON.stringify(await list());
await p.keyboard.press('Control+Shift+s'); await until(saOpen, 3000); await p.fill('dialog.spSave .spName', 'To file');
await p.check('dialog.spSave input[value=file]');
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('dialog.spSave [data-sa=ok]')]);
assert.equal(dl.suggestedFilename(), 'To file.json'); assert.deepEqual(JSON.parse(fs.readFileSync(await dl.path(), 'utf8')), { span: 70, title: 'Bridge 1' });
assert.equal(JSON.stringify(await list()), L5);
ok('Save as "File on this computer": the tool\'s Export JSON (download), the list unchanged');
// 6
await p.click('[data-sp=hlib]'); await p.waitForSelector('#fixtLib[open]');
assert.match(await p.evaluate(() => document.querySelector('#fixtLib .spHead strong').textContent), /Saved projects — Fixture tool/);
const heads = await p.evaluate(() => [...document.querySelectorAll('#fixtLib thead th')].map(t => t.textContent));
assert.deepEqual(heads, ['Name', 'Last saved (Eastern)', 'Size', 'This browser', '']);
const acts = await p.evaluate(() => [...document.querySelector('#fixtLib tbody tr .spAct').children].map(b => b.textContent));
assert.deepEqual(acts, ['Open', 'Rename', 'Duplicate', 'Export', 'Delete']);
await p.fill('#fixtLib .spFilter', 'job b'); const vis = await p.evaluate(() => [...document.querySelectorAll('#fixtLib tbody tr')].filter(t => t.style.display !== 'none').map(t => decodeURIComponent(t.dataset.name)));
assert.deepEqual(vis, ['Job B']); await p.fill('#fixtLib .spFilter', '');
await shot(p, 'std-dialog-off');
const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#fixtLib [data-spa=export][data-n="Job%20B"]')]);
assert.equal(fs.readFileSync(await dl2.path(), 'utf8'), JSON.stringify((await list())['Job B'], null, 1));
await p.evaluate(() => document.querySelector('#fixtLib').close());
await setSpan(99);
const a6 = asked.length; await p.click('[data-sp=hlib]'); await p.click('#fixtLib [data-spa=open][data-n="Job%20B"]'); await p.waitForTimeout(300);
assert.match(asked[a6] || '', /unsaved changes/); assert.equal(await p.inputValue('#span'), '60'); assert.match(await chip(), /Job B · saved/);
await p.click('[data-sp=hlib]'); const a7 = asked.length; await p.click('#fixtLib [data-spa=del][data-n="Job%20C"]'); await p.waitForTimeout(200);
assert.match(asked[a7] || '', /Delete the saved project "Job C"/); assert.ok(!('Job C' in await list()));
await p.evaluate(() => document.querySelector('#fixtLib').close());
ok('dialog: title, one table, Open Rename Duplicate Export Delete, filter, Export = stored item; Open asks on unsaved changes; Delete asks');
// 7 sync on
await p.evaluate(t => localStorage.setItem('bridgeSuite.v1.githubSync', JSON.stringify({ owner: 'mlococo88', repo: 'structural-projects', branch: 'main', token: t, device: 'Smoke' })), TOKEN);
gh.setRemote('projects/fixture-tool/From laptop.json', JSON.stringify({ span: 33, title: 'Laptop' }, null, 1));
await p.click('[data-sp=hlib]'); await until(() => p.evaluate(() => !!document.querySelector('#fixtLib [data-ghx=upall]')), 8000, 'first sync offer');
await p.click('#fixtLib [data-ghx=upall]'); await until(() => gh.files.has('projects/fixture-tool/Job A.json') && gh.files.has('projects/fixture-tool/Job B.json'), 8000, 'upload all');
await until(() => p.evaluate(() => !!document.querySelector('#fixtLib tr[data-name="From%20laptop"] [data-ghx=get]')), 8000, 'GitHub-only row');
const heads2 = await p.evaluate(() => [...document.querySelectorAll('#fixtLib thead th')].map(t => t.textContent));
assert.deepEqual(heads2, ['Name', 'Last saved (Eastern)', 'Size', 'This browser', 'GitHub', '']);
assert.equal(await p.evaluate(() => document.querySelectorAll('#fixtLib table').length), 1);
const gro = await p.evaluate(() => [...document.querySelector('#fixtLib tr[data-name="From%20laptop"] .spAct').children].map(b => b.textContent));
assert.deepEqual(gro, ['Open', 'Download', 'Delete from GitHub']);
await shot(p, 'std-dialog-sync');
await p.evaluate(() => document.querySelector('#fixtLib').close());
await p.keyboard.press('Control+Shift+s'); await until(saOpen, 3000);
assert.equal(await p.evaluate(() => document.querySelector('dialog.spSave input[value=cloud]').checked), true);
await shot(p, 'std-saveas-sync');
await p.fill('dialog.spSave .spName', 'Only here'); await p.check('dialog.spSave input[value=local]'); await p.click('dialog.spSave [data-sa=ok]');
await p.waitForTimeout(4000);
assert.ok(!gh.files.has('projects/fixture-tool/Only here.json'));
await p.click('[data-sp=hlib]'); await until(() => p.evaluate(() => { const s = document.querySelector('#fixtLib tr[data-name="Only%20here"] [data-gh-status]'); return s && s.dataset.ghStatus === 'local'; }), 8000, 'held status');
await p.click('#fixtLib [data-ghx=up][data-n="Only%20here"]'); await until(() => gh.files.has('projects/fixture-tool/Only here.json'), 8000, 'Upload');
await p.click('#fixtLib [data-ghx=open][data-n="From%20laptop"]'); await until(async () => (await p.inputValue('#span')) === '33', 8000, 'open GitHub-only');
await until(async () => /From laptop · saved GitHub ✓/.test(await chip()), 5000, 'chip after GitHub open');
ok('sync on: GitHub-only rows in the same table (Open / Download / Delete from GitHub); Save as defaults to GitHub; "This browser only" not uploaded until Upload; chip GitHub badge');
// 8
await setSpan(41); await p.keyboard.press('Control+s'); await p.waitForTimeout(200);
await p.reload(); await p.waitForTimeout(600);
assert.match(await chip(), /From laptop · saved/);
await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(300);
assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page 390');
await shot(p, 'std-page-390');
await p.click('[data-sp=hlib]'); await p.waitForSelector('#fixtLib[open]'); await p.waitForTimeout(1500);
assert.ok(await p.evaluate(() => { const d = document.querySelector('#fixtLib'); return d.scrollWidth <= d.clientWidth + 1; }), 'dialog 390');
await shot(p, 'std-dialog-390');
assert.equal(errs.length, 0, errs.join(' | '));
const k8 = await keys(); assert.deepEqual(k8.filter(k => !k.startsWith('fixt_')), ['bridgeSuite.v1.githubSync', 'bridgeSuite.v1.githubSync.tool.fixture-tool']);
ok('reload: the open project found again by content; 390 px: page and dialog do not scroll sideways; no console errors; sync keys only');
await b.close();
console.log(`\nALL PASS (${n} steps)`);
