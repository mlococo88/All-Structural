#!/usr/bin/env node
// Home page GitHub status and "Sync all to GitHub" (tools.html, HSP PR 2, 2026-11-05), headless Chromium, file://, one browser profile,
// api.github.com routed to the in-memory GitHub of tests/engine/gh-mock.mjs (nothing reaches the network):
//   1. sync off: every tool of tests/smoke/home-projects.mjs FOLDER saves two projects through its own Save; no request is made;
//   2. sync set up (the shared setting); GitHub already holds a different "HSP A" for Spread Footing (changed on another device) and a
//      "HSP remote" (GitHub only). tools.html#projects checks GitHub with ONE request: "this browser only" for every project,
//      "conflict" and "on GitHub only" for those two; no write to storage while only looking;
//   3. "Sync all to GitHub…" (confirm) -> every project on GitHub; the Spread Footing conflict keeps both (copy "(conflict …)" here
//      and on GitHub, GitHub's "HSP A" not overwritten); statuses "synced";
//   4. each tool opened afterwards, with sync on: its own Saved projects dialog shows "synced" for every project (Spread Footing:
//      conflict / on GitHub only as on the home page), no first-sync offer, and after its 3 s background check NO upload: the file
//      the home page uploaded is byte-identical to the file the tool itself makes (same git blob sha);
//   5. a project changed on GitHub afterwards -> "GitHub newer" on the home page; Sync all again uploads nothing and overwrites nothing;
//   6. the token only in the Authorization header (never in a URL or the page text); 390 px; no console errors on the home page.
//   node tests/smoke/home-sync.mjs [--tool asce7,spreadfooting,...] [--shots <dir>]   (spreadfooting is always included)
import path from 'path';
import { openPage, REPO } from '../lib.mjs';
import { makeGitHubMock, gitBlobSha } from '../engine/gh-mock.mjs';
import { FOLDER, NAMES, toolPage } from './home-projects.mjs';
import { openSavedList } from './project-library.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SHOTS = arg('shots', process.env.SHOTS);
// entries with sync: false in shared/project-registry.js (listed on the home page, synced only by the tool itself): not part of this test
const NOSYNC = new Set(['pile']);   // Pile Designer (STDS-P, 2026-11-06): IndexedDB; the home page sees only its name mirror
const list = [...new Set(['spreadfooting', ...arg('tool', Object.keys(FOLDER).filter(k => !NOSYNC.has(k)).join(',')).split(',')])];
const TOKEN = 'github_pat_SMOKE0000000000000000wxyz';
const SET = JSON.stringify({ owner: 'mlococo88', repo: 'structural-projects', branch: 'main', token: TOKEN, device: 'Home' });
const safe = n => n.replace(/[^A-Za-z0-9 _\-.(),+&'!~=@]/g, c => [...Buffer.from(c, 'utf8')].map(b => '%' + b.toString(16).toUpperCase().padStart(2, '0')).join('')).replace(/^[ .]|[ .]$/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const P = (f, n) => `projects/${f}/${safe(n)}.json`;
const until = async (f, ms, what) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + what); await new Promise(r => setTimeout(r, 150)); } };
let failed = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) failed++; return c; };

const gh = makeGitHubMock({ token: TOKEN });
const { b, ctx, p: home, errs } = await openPage(path.join(REPO, 'tools.html'), { vw: 1280, vh: 900 });
await ctx.route('https://api.github.com/**', async r => { const q = r.request(); const res = gh.handle(q.method(), q.url(), await q.allHeaders(), q.postData()); return r.fulfill({ status: res.status, headers: res.headers, body: res.body }); });
const terrs = [];
// 1. sync off: the tools save
for (const key of list) {
  try { const { page, p, T } = await toolPage(ctx, key, terrs); for (const n of NAMES) await T.save(p, n); await p.waitForTimeout(300); await page.close(); }
  catch (e) { ok(false, `${key}: ${String(e.message || e).slice(0, 300)}`); }
}
ok(gh.log.length === 0, `sync off: the tools saved ${list.length * 2} projects with no request to GitHub`);
// 2. set up; GitHub holds a different "HSP A" for Spread Footing and a GitHub-only project
const SF = FOLDER.spreadfooting, OTHER = '{\n "from": "another device"\n}';
gh.setRemote(P(SF, 'HSP A'), OTHER); gh.setRemote(P(SF, 'HSP remote'), '{\n "remote": 1\n}');
await home.evaluate(s => localStorage.setItem('bridgeSuite.v1.githubSync', s), SET);
const snap = () => home.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
const keys0 = await snap();
await home.goto('file://' + path.join(REPO, 'tools.html') + '#projects'); await home.reload();
const idle = () => until(() => home.evaluate(() => { const b = document.getElementById('spCheck'); return b && !b.disabled && !/working/.test(document.getElementById('spBar').textContent); }), 30000, 'home page idle').catch(e => { throw e; });
await idle();
const status = () => home.evaluate(() => Object.fromEntries([...document.querySelectorAll('#spOut .spG[data-tool]')].map(g => [g.dataset.tool,
  Object.fromEntries([...g.querySelectorAll('li')].map(li => [li.dataset.name, (li.querySelector('[data-gh-status]') || {}).dataset?.ghStatus || null]))])));
let st = await status();
const trees = gh.log.filter(l => /\/git\/trees\//.test(l.url)).length;
ok(trees === 1 && gh.log.length === 1, `opening the panel checks GitHub with one request (${gh.log.length} request(s), ${trees} tree)`);
ok(await snap() === keys0, 'looking only: nothing written to storage');
ok(list.every(k => FOLDER[k] === SF || NAMES.every(n => st[FOLDER[k]] && st[FOLDER[k]][n] === 'local')), 'before Sync all: every project "this browser only"');
ok(st[SF] && st[SF]['HSP A'] === 'conflict' && st[SF]['HSP remote'] === 'cloud' && st[SF][NAMES[1]] === 'local', 'Spread Footing: "HSP A" conflict, "HSP remote" on GitHub only (' + JSON.stringify(st[SF]) + ')');
if (SHOTS) await home.screenshot({ path: path.join(SHOTS, 'home-sync-before.png') });
// 3. Sync all
await home.click('#spSyncAll'); await home.waitForTimeout(300); await idle();
st = await status();
const bar = await home.textContent('#spBar');
const want = list.flatMap(k => NAMES.map(n => P(FOLDER[k], n))).filter(x => x !== P(SF, 'HSP A'));
ok(want.every(x => gh.files.has(x)), `Sync all: every project on GitHub (${want.filter(x => gh.files.has(x)).length} / ${want.length})`);
ok(gh.files.get(P(SF, 'HSP A')) === OTHER, 'the GitHub "HSP A" changed elsewhere is not overwritten');
const copy = Object.keys(st[SF] || {}).find(n => /^HSP A \(conflict Home \d{4}-\d\d-\d\d \d{4}\)$/.test(n));
ok(copy && gh.files.has(P(SF, copy)) && st[SF][copy] === 'synced', 'conflict: our version kept as "' + copy + '" here and on GitHub');
ok(list.every(k => NAMES.every(n => FOLDER[k] === SF && n === 'HSP A' ? st[SF][n] === 'conflict' : st[FOLDER[k]][n] === 'synced')), 'after Sync all: every project "synced" (Spread Footing "HSP A": conflict)');
ok(/Sync all: \d+ files? uploaded/.test(bar) && /conflict/i.test(bar), 'the bar reports the uploads and the conflict: ' + bar.replace(/\s+/g, ' ').slice(0, 300));
ok(!gh.log.some(l => l.method === 'DELETE' && !l.url.includes('/.presence/')), 'nothing deleted on GitHub');
if (SHOTS) await home.screenshot({ path: path.join(SHOTS, 'home-sync-after.png') });
// 4. each tool afterwards: its own dialog says synced; no upload by the tool
for (const key of list) {
  const L0 = gh.log.length, f = FOLDER[key];
  try {
    const { page, p, T } = await toolPage(ctx, key, terrs);
    if (T.ui) await T.ui.open(p); else await openSavedList(p);   // HDRS: no header Saved projects… (project-library.mjs openSavedList)
    await p.waitForTimeout(4500);   // the dialog's check (flush + list) and one 3 s background check of the tool
    const r = await p.evaluate(() => ({ st: [...document.querySelectorAll('dialog[open] [data-gh-status], #lib_panel [data-gh-status]')].map(e => e.dataset.ghStatus).sort(), ask: !!document.querySelector('dialog[open] [data-sp=gh-ask]') }));
    const puts = gh.log.slice(L0).filter(l => l.method !== 'GET' && !l.url.includes('/.presence/'));   // LIVE (2026-11-08): presence heartbeats are not project uploads
    const exp = f === SF ? ['cloud', 'conflict', 'synced', 'synced'] : r.st.length >= 2 ? r.st.map(() => 'synced') : ['synced', 'synced'];   // Bridge Geometry: its 5 example bridges too
    ok(JSON.stringify(r.st) === JSON.stringify(exp) && !r.ask && !puts.length, `${key}: the tool's own dialog shows ${r.st.join(', ')}; no first-sync offer; no upload by the tool (${puts.length} writes): its file = the home page's file`);
    await page.close();
  } catch (e) { ok(false, `${key}: ${String(e.message || e).slice(0, 300)}`); }
}
// byte identity, stated directly: the blob sha the tool records for each project = the sha of the file on GitHub
const bk = await home.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('bridgeSuite.v1.githubSync.tool.')).map(k => [k.slice(31), JSON.parse(localStorage.getItem(k))])));
ok(list.every(k => NAMES.every(n => (FOLDER[k] === SF && n === 'HSP A') || (bk[FOLDER[k]] && bk[FOLDER[k]].base[n] && bk[FOLDER[k]].base[n].l === gitBlobSha(gh.files.get(P(FOLDER[k], n)))))), 'every file on GitHub has the git sha of the text each tool makes (bookkeeping l = sha of the file)');
// 5. changed on GitHub afterwards -> GitHub newer; Sync all again writes nothing
const k1 = FOLDER[list.find(k => k !== 'spreadfooting') || 'spreadfooting'];
gh.setRemote(P(k1, NAMES[1]), '{\n "newer": true\n}');
await home.click('#spCheck'); await home.waitForTimeout(300); await idle();
st = await status(); ok(st[k1][NAMES[1]] === 'cloud-newer', `${k1}: changed on GitHub -> "GitHub newer"`);
const L1 = gh.log.length; await home.click('#spSyncAll'); await home.waitForTimeout(300); await idle();
ok(!gh.log.slice(L1).some(l => l.method !== 'GET' && !l.url.includes('/.presence/')) && gh.files.get(P(k1, NAMES[1])) === '{\n "newer": true\n}', 'Sync all again: nothing uploaded, the newer GitHub file is not overwritten');
// 6. token, layout, errors
ok(gh.log.every(l => l.auth === `Bearer ${TOKEN}` && !l.url.includes(TOKEN)) && !(await home.evaluate(() => document.body.innerText)).includes(TOKEN.slice(11)), 'token only in the Authorization header, never in a URL or the page');
await home.setViewportSize({ width: 390, height: 800 }); await home.waitForTimeout(300);
ok(await home.evaluate(() => document.documentElement.scrollWidth <= 390), '390 px: no sideways scroll');
if (SHOTS) { await home.evaluate(() => document.getElementById('projects').scrollIntoView()); await home.screenshot({ path: path.join(SHOTS, 'home-sync-390.png') }); }
ok(!errs.length, 'no console errors on the home page' + (errs.length ? ': ' + errs.join(' | ') : ''));
ok(!terrs.length, 'no console errors in the tools' + (terrs.length ? ': ' + terrs.join(' | ').slice(0, 600) : ''));
await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS'); process.exit(failed ? 1 : 0);
