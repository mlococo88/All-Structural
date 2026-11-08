#!/usr/bin/env node
// GitHub sync of the saved projects (shared/github-sync.js, GHS, 2026-11-05), whole flow in the page, headless, offline:
// api.github.com is routed (Playwright page.route) to the in-memory GitHub of tests/engine/gh-mock.mjs; nothing reaches the network.
// Steps (Spread Footing, the pilot tool, unless --tool names another entry of TOOLS):
//   1. sync off: no request to api.github.com, no new storage key, the dialog says "off";
//   2. set up in the "Cloud sync (GitHub)" dialog: Test connection, token masked (never in the page text, a URL or the console);
//   3. first connect: "Upload all" -> every saved project on GitHub, in the tool's Export JSON format (compared with a real Export);
//   4. a new save (the tool's own Save button) and an update (Overwrite: PUT with the file's sha) are uploaded in the background;
//   5. changed on GitHub and here -> both kept ("<name> (conflict <device> <date>)"), a notice shown, status "conflict";
//   6. a project on GitHub only: listed, Open loads it into the tool (and into the browser's list);
//   7. offline: the save waits ("waiting to upload") and goes when GitHub is reachable again;
//   8. delete in the dialog asks about GitHub; Cancel keeps the GitHub file; "Delete from GitHub" deletes it (explicit only);
//   9. the tool's own list key: the items the tool wrote are unchanged; 390 px: the page does not scroll sideways.
//   node tests/smoke/github-sync.mjs [--tool spreadfooting] [--shots <dir>]
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';
import { makeGitHubMock, gitBlobSha } from '../engine/gh-mock.mjs';
import { stdSave } from './project-library.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SHOTS = arg('shots', process.env.SHOTS);
const TOKEN = 'github_pat_SMOKE0000000000000000wxyz';

// Each tool: file, list key, folder name on GitHub, save(p, name) through the tool's own Save path, change(p) one input change,
// overwrite(p, name) the tool's own save over an existing name, opened(p) the name of the open project, exportText(p) the text of
// the tool's Export JSON for the open project.
const TOOLS = {
  spreadfooting: {
    file: 'Spread Footing.html', list: 'sfd_projects', folder: 'spread-footing',
    ready: p => p.waitForFunction(() => typeof R !== 'undefined' && R),
    // STDS (2026-11-05): Save as through the standard save controls; overwrite = Save as an existing name + "Replace it"
    save: async (p, n) => { await stdSave(p, n); },
    overwrite: async (p, n) => { await stdSave(p, n); },
    change: async p => { await p.evaluate(() => { const i = document.querySelector('#inputPanel input[type=number][data-path]'); i.value = String((Number(i.value) || 0) + 0.5); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(600); },
    opened: p => p.evaluate(() => window.SFPL.pb.current() || ''),
    openBtn: p => p.evaluate(() => window.SFPL.dlg.show()),
    exportText: async p => { const [d] = await Promise.all([p.waitForEvent('download'), p.click('#btnExport')]); return fs.readFileSync(await d.path(), 'utf8'); },
    result: p => p.evaluate(() => JSON.stringify(R, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v)))
  }
};

const T = TOOLS[arg('tool', 'spreadfooting')]; if (!T) throw new Error('unknown --tool');
const until = async (f, ms = 15000, what = '') => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + what); await new Promise(r => setTimeout(r, 150)); } };
const pathOf = n => `projects/${T.folder}/${n.replace(/[^A-Za-z0-9 _\-.(),+&'!~=@]/g, c => encodeURIComponent(c))}.json`;
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };

const gh = makeGitHubMock({ token: TOKEN });
const { b, p, errs, dialogs, blocked } = await openPage(path.join(REPO, T.file));
const consoleAll = []; p.on('console', m => consoleAll.push(m.text()));
const other = [];
await p.route('https://api.github.com/**', async route => {
  const r = route.request();
  if (gh.offline) return route.abort('internetdisconnected');
  const res = gh.handle(r.method(), r.url(), await r.allHeaders(), r.postData());
  return route.fulfill({ status: res.status, headers: res.headers, body: res.body });
});
p.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('https://api.github.com/')) other.push(r.url()); });
await T.ready(p);
// answers for confirm(): a queue (empty = OK, as openPage does)
await p.evaluate(() => { window.__ans = []; const c = window.confirm; window.confirm = m => { (window.__asked = window.__asked || []).push(m); return window.__ans.length ? window.__ans.shift() : true; }; });
const keys = () => p.evaluate(() => Object.keys(localStorage).sort());
const ls = k => p.evaluate(k => localStorage.getItem(k), k);
const dlgText = () => p.evaluate(() => document.getElementById('spLibDlg').innerText);
const statusOf = nm => p.evaluate(nm => { const d = document.getElementById('spLibDlg'); const ob = [...d.querySelectorAll('[data-spa=open]')].find(x => decodeURIComponent(x.dataset.n) === nm); const s = ob && ob.closest('tr').querySelector('[data-gh-status]'); return s ? s.dataset.ghStatus : null; }, nm);
const closeDlg = () => p.evaluate(() => { document.querySelectorAll('dialog[open]').forEach(d => d.close()); });

// --- 1. sync off
await T.save(p, 'Footing A'); await T.change(p); await T.save(p, 'Footing B');
const rawOwn = await ls(T.list); const keys0 = await keys();
await T.openBtn(p); await p.waitForTimeout(3500);
assert.match(await dlgText(), /Cloud sync \(GitHub\): off/); assert.equal(gh.log.length, 0); assert.deepEqual(await keys(), keys0);
assert.ok(!keys0.some(k => k.startsWith('bridgeSuite.v1.githubSync')));
ok('sync off: no request, no new key, the dialog says "off"');

// --- 2. set up
await p.click('#spLibDlg [data-gh=setup]'); await p.waitForSelector('#spGhDlg[open]');
await p.fill('#spGhToken', TOKEN); await p.fill('#spGhDevice', 'Smoke PC');
await p.click('#spGhDlg [data-gh=test]'); await until(() => p.evaluate(() => /Connected to|Not connected/.test(document.querySelector('#spGhDlg .spGhRes').textContent)), 10000, 'test connection');
const res = await p.evaluate(() => document.querySelector('#spGhDlg .spGhRes').textContent);
assert.match(res, /Connected to mlococo88\/structural-projects/); assert.match(res, /private/); assert.match(res, /Branch "main" found/);
assert.equal(await p.inputValue('#spGhToken'), ''); assert.match(await p.getAttribute('#spGhToken', 'placeholder'), /saved: github_pat_•+wxyz/);
assert.ok(gh.log.every(l => l.method === 'GET'));
ok('set up: Test connection reads the repository and branch (GET only); the token field is emptied and shown masked');
if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, 'ghs-settings.png') }); }
await p.click('#spGhDlg [data-gh=close]');

// --- 3. first connect: Upload all
await until(() => p.evaluate(() => !!document.querySelector('#spLibDlg [data-ghx=upall]')), 8000, 'first-connect offer');
assert.match(await dlgText(), /upload the 2 projects saved in this browser/);
await p.click('#spLibDlg [data-ghx=upall]');
await until(() => gh.files.size === 2, 10000, 'upload all');
await until(async () => (await statusOf('Footing A')) === 'synced' && (await statusOf('Footing B')) === 'synced', 8000, 'synced status');
assert.equal(await ls(T.list), rawOwn);   // the tool's list is untouched
ok('first connect: Upload all -> both on GitHub; status synced; the tool\'s list unchanged');
if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'ghs-dialog-synced.png') });
// the file is the tool's Export JSON
await p.click('#spLibDlg [data-spa=open][data-n="Footing%20A"]'); await p.waitForTimeout(800);
const exp = await T.exportText(p);
assert.equal(gh.files.get(pathOf('Footing A')), exp);
ok('the GitHub file is byte-identical to the tool\'s own Export JSON of that project');

// --- 4. new save and update (sha)
await T.change(p); await T.save(p, 'Footing C');
await until(() => gh.files.has(pathOf('Footing C')), 10000, 'background upload of a new save');
const shaA = gitBlobSha(gh.files.get(pathOf('Footing A')));
await T.change(p); await T.overwrite(p, 'Footing A');
await until(() => gitBlobSha(gh.files.get(pathOf('Footing A'))) !== shaA, 10000, 'update');
const put = gh.log.filter(l => l.method === 'PUT' && l.url.includes('Footing%20A')).at(-1); assert.equal(JSON.parse(put.body).sha, shaA);
assert.equal(gh.files.get(pathOf('Footing A')), JSON.stringify(JSON.parse(await ls(T.list))['Footing A'], null, 1));
ok('a new save and an Overwrite are uploaded in the background; the update carries the file\'s sha');

// --- 5. conflict
const theirs = JSON.stringify(Object.assign(JSON.parse(gh.files.get(pathOf('Footing B'))), { meta: { project: 'edited on another device' } }), null, 1);
gh.setRemote(pathOf('Footing B'), theirs);
await T.change(p); await T.overwrite(p, 'Footing B');
await until(() => [...gh.files.keys()].some(k => k.includes('Footing B (conflict Smoke PC')), 10000, 'conflict copy');
assert.equal(gh.files.get(pathOf('Footing B')), theirs);
const own = JSON.parse(await ls(T.list)); const cn = Object.keys(own).find(k => k.startsWith('Footing B (conflict Smoke PC '));
assert.ok(cn); assert.deepEqual(own[cn], own['Footing B']);
assert.match(await p.evaluate(() => (document.querySelector('[data-sp=gh-toast]') || {}).textContent || ''), /Both are kept/);
await T.openBtn(p); await until(async () => (await statusOf('Footing B')) === 'conflict', 8000, 'conflict status');
ok(`changed on GitHub and here: GitHub's file kept, ours saved as "${cn}" here and on GitHub, notice shown, status conflict`);

// --- 6. GitHub only -> Open
const remote = JSON.parse(gh.files.get(pathOf('Footing C'))); remote.meta = Object.assign({}, remote.meta, { project: 'Remote job' });
gh.setRemote(pathOf('Remote job'), JSON.stringify(remote, null, 1));
await p.click('#spLibDlg [data-ghx=refresh]');
await until(() => p.evaluate(() => !!document.querySelector('#spLibDlg [data-ghx=open][data-n="Remote%20job"]')), 8000, 'cloud-only row');
assert.match(await dlgText(), /on GitHub only/i);   // STDS: a row of the one table (status "on GitHub only")
await p.click('#spLibDlg [data-ghx=open][data-n="Remote%20job"]'); await p.waitForTimeout(1200);
assert.equal(await T.opened(p), 'Remote job'); assert.deepEqual(JSON.parse(await ls(T.list))['Remote job'], remote);
assert.equal(await p.evaluate(() => state.meta.project), 'Remote job');
ok('a project on GitHub only is listed; Open downloads it into the list and opens it in the tool');

// --- 7. offline queue
gh.offline = true; await T.change(p); await T.save(p, 'Offline save');
await T.openBtn(p); await until(async () => /waiting to upload/.test(await dlgText()), 10000, 'waiting');
assert.ok(!gh.files.has(pathOf('Offline save')));
gh.offline = false; await p.click('#spLibDlg [data-ghx=refresh]');
await until(() => gh.files.has(pathOf('Offline save')), 15000, 'queued upload after reconnect');
ok('offline: the save waits ("waiting to upload") and is uploaded when GitHub is reachable again');

// --- 8. delete: explicit only
await p.evaluate(() => { window.__ans = [true, false]; });   // delete here: OK; also delete on GitHub: Cancel
await p.click('#spLibDlg [data-spa=del][data-n="Footing%20C"]'); await p.waitForTimeout(800);
assert.ok(!JSON.parse(await ls(T.list))['Footing C']); assert.ok(gh.files.has(pathOf('Footing C')));
assert.match((await p.evaluate(() => window.__asked)).at(-1), /Also delete "Footing C" from GitHub/);
await until(() => p.evaluate(() => !!document.querySelector('#spLibDlg [data-ghx=delcloud][data-n="Footing%20C"]')), 5000, 'cloud-only after delete');
assert.equal(gh.log.filter(l => l.method === 'DELETE').length, 0);
await p.evaluate(() => { window.__ans = [true]; }); await p.click('#spLibDlg [data-ghx=delcloud][data-n="Footing%20C"]');
await until(() => !gh.files.has(pathOf('Footing C')), 8000, 'cloud delete'); assert.equal(gh.log.filter(l => l.method === 'DELETE').length, 1);
ok('deleting in the dialog asks about GitHub; Cancel keeps the GitHub file; "Delete from GitHub" deletes it');

// --- 9. the token, the tool's data, 390 px
for (const l of gh.log) { assert.ok(l.url.startsWith('https://api.github.com/repos/mlococo88/structural-projects')); assert.ok(!l.url.includes(TOKEN)); assert.equal(l.auth, `Bearer ${TOKEN}`); }
assert.ok(!(await p.evaluate(() => document.body.innerText)).includes(TOKEN)); assert.ok(!consoleAll.some(t => t.includes(TOKEN)));
for (const k of await keys()) if (k !== 'bridgeSuite.v1.githubSync') assert.ok(!(await ls(k) || '').includes(TOKEN), k);
for (const t of gh.files.values()) assert.ok(!t.includes(TOKEN));
assert.equal(other.length, 0, other.join(' '));
ok('the token: only in the Authorization header to api.github.com; not in a URL, the page text, the console, a project file or another key');
const fin = JSON.parse(await ls(T.list)), first = JSON.parse(rawOwn);
assert.equal(typeof fin, 'object'); assert.ok(Object.values(fin).every(v => v && typeof v === 'object' && v.geom && v.soil));
assert.ok(Object.keys(first).every(k => k in fin));
assert.deepEqual((await keys()).filter(k => !keys0.includes(k) && !/^bridgeSuite\.v1\.githubSync\.(deviceId|live|presence\.)/.test(k)).sort(), ['bridgeSuite.v1.githubSync', `bridgeSuite.v1.githubSync.tool.${T.folder}`]);   // LIVE (2026-11-08): besides its own keys (.deviceId, .presence.<tool>)
ok('the tool\'s list key keeps its format ({ name: state }); the only new keys are bridgeSuite.v1.githubSync and .tool.' + T.folder);
await p.setViewportSize({ width: 390, height: 800 }); await T.openBtn(p); await p.waitForTimeout(1500);
const sw = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); assert.ok(sw[0] <= sw[1], sw.join(' > '));
if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'ghs-dialog-390.png') });
ok('390 px: the dialog with the GitHub column does not make the page scroll sideways');
await closeDlg();
const offlineErrs = errs.filter(e => /ERR_INTERNET_DISCONNECTED/.test(e)), realErrs = errs.filter(e => !/ERR_INTERNET_DISCONNECTED/.test(e));
assert.deepEqual(realErrs, [], realErrs.join('\n'));
ok(`no console errors (besides ${offlineErrs.length} "internet disconnected" from the offline step; ${dialogs.length} alert / confirm answered)`);
await b.close();
console.log(`\nALL PASS (${n} checks)`);
