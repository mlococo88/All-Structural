#!/usr/bin/env node
// Retired rebar calculator (RBRT, 2026-11-05): "ACI Rebar Development Length.html" is a redirect page to the Development & Splice tab of
// Concrete Beam Capacity. Checks, headless Chromium from file://: the redirect (?query kept, #dev, in a frame, one-time offer of the old
// data as .json when the suite is not seen in the same storage); the suite opens on the tab; the storage takeover (old projects listed;
// old last session opened, or kept as a "Recovered" project, once, with a notice; old keys unchanged); an Export JSON file written by
// the OLD standalone imports with identical inputs, factors and check summary; old saved projects give the old page's results.
//   node tests/smoke/rebar-redirect.mjs [--old <git ref of the last commit with the standalone tool, default f9ec0f9>]
import fs from 'fs'; import os from 'os'; import path from 'path'; import { execFileSync } from 'child_process';
import { openPage, diff, REPO } from '../lib.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const sha = execFileSync('git', ['-C', REPO, 'rev-parse', '--short', arg('old', 'f9ec0f9')], { encoding: 'utf8' }).trim();
const MAIN = path.join(os.tmpdir(), 'allstruct-tests', 'tree-' + sha);
if (!fs.existsSync(path.join(MAIN, '.done'))) { fs.mkdirSync(MAIN, { recursive: true }); execFileSync('sh', ['-c', `git -C "${REPO}" archive ${sha} | tar -x -C "${MAIN}"`]); fs.writeFileSync(path.join(MAIN, '.done'), sha); }
const WT = REPO, OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'allstruct-rbrt-'));
console.log('old standalone from ' + sha + '; files in ' + OUT);
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const OLD = path.join(MAIN, 'ACI Rebar Development Length.html'), RED = path.join(WT, 'ACI Rebar Development Length.html'), CBC = path.join(WT, 'Concrete Beam Capacity.html');
const devF = async p => { await p.waitForSelector('#suite-frame-dev', { state: 'attached' }); const f = await (await p.$('#suite-frame-dev')).contentFrame();
  await f.waitForFunction(() => typeof computeFactors === 'function' && document.getElementById('dashboard') && document.getElementById('dashboard').textContent.length > 20, null, { timeout: 30000 }); await p.waitForTimeout(800); return f; };
const res = f => f.evaluate(() => { const inp = readInputs(); const r = JSON.parse(JSON.stringify({ inp, f: computeFactors(inp) }, (k, v) => typeof v === 'number' && !isFinite(v) ? String(v) : v));
  const d = document.getElementById('dashboard').cloneNode(true); d.querySelectorAll('[data-sp]').forEach(x => x.remove()); delete r.inp.calcDate; return { ...r, dash: d.textContent.replace(/\s+/g, ' ') }; });
const lsAll = p => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
// STDS (2026-11-05): the suite tab has the standard save (no drop-down): its projects are listed and opened through Saved projects…
const listed = f => f.evaluate(() => { SharedProjectsUI.bars[0].dialog.show(); const n = [...document.querySelectorAll('dialog[open] [data-spa="open"]')].map(b => decodeURIComponent(b.dataset.n)); document.querySelectorAll('dialog[open]').forEach(x => x.close()); return n; });
const openIn = async (f, test) => { await f.evaluate(src => { const t = new RegExp(src); SharedProjectsUI.bars[0].dialog.show(); [...document.querySelectorAll('dialog[open] [data-spa="open"]')].find(b => t.test(decodeURIComponent(b.dataset.n))).click(); }, test); };
const oldReady = async p => { await p.waitForFunction(() => typeof computeFactors === 'function' && document.getElementById('dashboard').textContent.length > 20); await p.waitForTimeout(800); };
// an old-standalone state: change inputs in the OLD page, save as project "Pier 3 laps", read its storage and Export JSON
const S = await openPage(OLD, { vw: 1280, vh: 900 }); await oldReady(S.p);
await S.p.evaluate(() => { const set = (id, v) => { const e = document.getElementById(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
  set('projName', 'Pier 3 laps'); set('codeSel', 'AASHTO'); set('barSize', '9'); set('fc', '5000'); set('cb', '2.5'); set('topBar', true); set('epoxy', 'yes');
  document.getElementById('saveName').value = 'Pier 3 laps'; saveProject(); });
await S.p.waitForTimeout(600);
await S.p.evaluate(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }; set('fc', '6000'); set('barSize', '7'); });
await S.p.waitForTimeout(600);
const oldRes = await res(S.p);                    // the old page's last session (fc 6000, #7)
const [dl] = await Promise.all([S.p.waitForEvent('download'), S.p.evaluate(() => exportJSON())]);
const EXP = path.join(OUT, 'old-export.json'); await dl.saveAs(EXP);
const oldLS = await lsAll(S.p); await S.b.close();
const oldKeys = Object.keys(oldLS).sort(); console.log('old standalone wrote keys: ' + oldKeys.join(', '));
fs.writeFileSync(path.join(OUT, 'old-ls.json'), JSON.stringify(oldLS, null, 1));
// the old page's results for its saved project
const S2 = await openPage(OLD, { vw: 1280, vh: 900, ls: oldLS }); await oldReady(S2.p);
await S2.p.evaluate(() => { document.getElementById('projSelect').value = 'Pier 3 laps'; loadProject(); }); await S2.p.waitForTimeout(600);
const oldProjRes = await res(S2.p); await S2.b.close();

// 1. redirect from file:// with ?query: forwards to the suite #dev keeping the query (suite seen in this storage, or no old data)
{ const R = await openPage(RED, { vw: 1280, vh: 900, ls: { 'rcsuite.rebar_autosave_v1': '{}' }, hash: '?job=12' });
  await R.p.waitForURL(/Concrete%20Beam%20Capacity\.html\?job=12#dev$/, { timeout: 15000 }).catch(() => {});
  ok(/Concrete%20Beam%20Capacity\.html\?job=12#dev$/.test(R.p.url()), 'redirect keeps ?query: lands on ' + R.p.url().split('/').pop());
  await R.b.close(); }
// in a frame it always forwards (no offer), even with old data and no suite key
{ const H = path.join(OUT, 'frame-host.html'); fs.writeFileSync(H, '<!doctype html><iframe id="x" src="' + encodeURI('file://' + RED) + '" style="width:900px;height:600px"></iframe>');
  const R = await openPage(H, { vw: 1280, vh: 900, ls: oldLS }); await R.p.waitForTimeout(5000);
  const u = R.p.frames().map(f => f.url()).find(u => /Capacity\.html#dev$/.test(u)); ok(!!u, 'in a frame: forwards to the suite #dev without the offer'); await R.b.close(); }
// redirect with the suite seen in this storage
{ const R = await openPage(RED, { vw: 1280, vh: 900, ls: { ...oldLS, 'rcsuite.rebar_autosave_v1': oldLS['rebar_aci_autosave_v1'] } });
  await R.p.waitForURL(/Capacity\.html#dev$/, { timeout: 15000 }).catch(() => {});
  ok(/Concrete%20Beam%20Capacity\.html#dev$/.test(R.p.url()), 'redirect, suite seen in same storage: forwards at once to ' + R.p.url().split('/').pop());
  const f = await devF(R.p);
  const act = await R.p.evaluate(() => [...document.querySelectorAll('.suite-tab')].filter(b => b.classList.contains('active') || b.getAttribute('aria-selected') === 'true').map(b => b.dataset.target));
  const vis = await R.p.evaluate(() => { const e = document.getElementById('suite-frame-dev'); return e.offsetWidth > 0 && e.offsetHeight > 0; });
  ok(act.join() === 'dev' && vis, 'suite opens on the Development & Splice tab (active: ' + act.join() + ', frame visible: ' + vis + ')');
  await R.p.screenshot({ path: path.join(OUT, 'suite-dev.png') });
  ok(!R.errs.filter(e => !/ERR_FAILED|Failed to load resource/.test(e)).length, 'no console errors: ' + R.errs.join(' | ').slice(0, 300)); await R.b.close(); }
// no storage at all: forwards
{ const R = await openPage(RED, { vw: 1280, vh: 900 }); await R.p.waitForURL(/#dev$/, { timeout: 15000 }).catch(() => {});
  ok(/Concrete%20Beam%20Capacity\.html#dev$/.test(R.p.url()), 'redirect, empty storage: forwards'); await R.b.close(); }
// separate storage (Firefox / Safari case, simulated: the old keys, the suite key absent): the one-time offer; downloads = old Export format
{ const R = await openPage(RED, { vw: 390, vh: 844, ls: oldLS }); await R.p.waitForTimeout(800);
  const shown = await R.p.evaluate(() => !document.getElementById('offer').hidden && [...document.querySelectorAll('#tbl td:first-child')].map(t => t.textContent));
  ok(shown && shown.length === 2, 'offer shown with ' + JSON.stringify(shown) + ' (no redirect yet: ' + R.p.url().split('/').pop() + ')');
  const sw = await R.p.evaluate(() => document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth + 1); ok(sw, 'offer page: no sideways scroll at 390 px');
  await R.p.screenshot({ path: path.join(OUT, 'offer-390.png'), fullPage: true });
  const [d1] = await Promise.all([R.p.waitForEvent('download'), R.p.click('#tbl tr:nth-child(1) button')]); const f1 = path.join(OUT, 'offer-last.json'); await d1.saveAs(f1);
  const [d2] = await Promise.all([R.p.waitForEvent('download'), R.p.click('#tbl tr:nth-child(2) button')]); const f2 = path.join(OUT, 'offer-proj.json'); await d2.saveAs(f2);
  ok(fs.readFileSync(f1, 'utf8') === fs.readFileSync(EXP, 'utf8').replace(/"currentTab": "[^"]*"/, m => m) && JSON.stringify(JSON.parse(fs.readFileSync(f1, 'utf8'))) === oldLS['rebar_aci_autosave_v1'], 'offer "Last session" file = the old autosave, as Export JSON writes it (' + d1.suggestedFilename() + ')');
  ok(JSON.stringify(JSON.parse(fs.readFileSync(f2, 'utf8'))) === JSON.stringify(JSON.parse(oldLS['rebar_aci_projects_v1'])['Pier 3 laps']), 'offer project file = the saved project (' + d2.suggestedFilename() + ')');
  const after = await lsAll(R.p); ok(Object.keys(after).filter(k => !(k in oldLS)).join() === 'rebar_aci_redirect_offered_v1' && oldKeys.every(k => after[k] === oldLS[k]), 'offer wrote only rebar_aci_redirect_offered_v1; old keys unchanged');
  await R.p.click('#go'); await R.p.waitForURL(/#dev$/, { timeout: 15000 }).catch(() => {}); ok(/#dev$/.test(R.p.url()), 'offer link opens the suite #dev');
  await R.b.close();
  const R2 = await openPage(RED, { vw: 1280, vh: 900, ls: { ...oldLS, rebar_aci_redirect_offered_v1: 'x' } }); await R2.p.waitForURL(/#dev$/, { timeout: 15000 }).catch(() => {});
  ok(/#dev$/.test(R2.p.url()), 'offer shown once: next time forwards'); await R2.b.close(); }
// in a frame: always forwards (no offer)
// 2. storage takeover in the suite
const cases = [
  ['A: suite never opened (no rcsuite autosave)', oldLS],
  ['B: suite autosave differs (default inputs)', null],
  ['C: suite autosave = the old session', { ...oldLS, 'rcsuite.rebar_autosave_v1': oldLS['rebar_aci_autosave_v1'] }]];
{ // B's suite autosave: the suite opened on empty storage, its own autosave
  const E = await openPage(CBC, { vw: 1280, vh: 900, hash: '#dev' }); await devF(E.p); const e = await lsAll(E.p); await E.b.close();
  cases[1][1] = { ...oldLS, 'rcsuite.rebar_autosave_v1': e['rcsuite.rebar_autosave_v1'] }; }
for (const [name, seed] of cases) {
  const C = await openPage(CBC, { vw: 1280, vh: 900, ls: seed, hash: '#dev' }); const f = await devF(C.p);
  const L = await lsAll(C.p), mig = JSON.parse(L['rcsuite.rebar_oldAutosaveMigrated_v1'] || 'null'), P = JSON.parse(L['rebar_aci_projects_v1']);
  const opts = await listed(f);
  const note = await f.evaluate(() => { const n = document.getElementById('rbOldNote'); return n ? n.innerText.replace(/\s+/g, ' ') : null; });
  const r = await res(f);
  console.log(`-- ${name}: marker ${JSON.stringify(mig)}; list ${JSON.stringify(opts)}; notice ${note ? '"' + note.slice(0, 160) + '…"' : 'none'}`);
  ok(opts.includes('Pier 3 laps'), name + ': the project saved in the old standalone is listed');
  ok(L['rebar_aci_autosave_v1'] === oldLS['rebar_aci_autosave_v1'], name + ': old autosave key kept unchanged');
  if (name[0] === 'A') { ok(mig.did === 'autosave' && !!note && !diff(r, oldRes).length, name + ': old session opened (results = old page\'s last session), notice shown'); await C.p.screenshot({ path: path.join(OUT, 'notice-A.png') }); }
  if (name[0] === 'B') { const k = Object.keys(P).find(n => /^Recovered from the standalone tool/.test(n));
    ok(mig.did === 'project' && k && JSON.stringify(P[k]) === oldLS['rebar_aci_autosave_v1'] && !!note, name + ': old session kept as project "' + k + '", notice shown');
    ok(L['rcsuite.rebar_autosave_v1'] === seed['rcsuite.rebar_autosave_v1'] || JSON.parse(L['rcsuite.rebar_autosave_v1']).inp.fc === JSON.parse(seed['rcsuite.rebar_autosave_v1']).inp.fc, name + ': the suite\'s own inputs not overwritten');
    await C.p.screenshot({ path: path.join(OUT, 'notice-B.png') });
    await openIn(f, '^Recovered'); await C.p.waitForTimeout(600);
    ok(!diff(await res(f), oldRes).length, name + ': the recovered project opens with the old page\'s results');
    // reload: once only; OK dismisses
    const L2 = await lsAll(C.p); await f.click('#rbOldNote button'); const L3 = await lsAll(C.p); await C.b.close();
    const C2 = await openPage(CBC, { vw: 1280, vh: 900, ls: L3, hash: '#dev' }); const f2 = await devF(C2.p); const L4 = await lsAll(C2.p);
    ok(Object.keys(JSON.parse(L4['rebar_aci_projects_v1'])).length === Object.keys(JSON.parse(L2['rebar_aci_projects_v1'])).length && !(await f2.$('#rbOldNote')), name + ': reopened: no second copy, notice gone after OK');
    await C2.b.close(); continue; }
  if (name[0] === 'C') ok(mig.did === 'none' && !note && Object.keys(P).length === 1, name + ': nothing added, no notice');
  // the old saved project opens with the old page's results
  await openIn(f, '^Pier 3 laps$'); await C.p.waitForTimeout(600);
  ok(!diff(await res(f), oldProjRes).length, name + ': "Pier 3 laps" opens with the same results as in the old standalone');
  await C.b.close();
}
// 3. the old exported JSON imports into the suite tab (empty storage)
{ const C = await openPage(CBC, { vw: 1280, vh: 900, hash: '#dev' }); const f = await devF(C.p);
  const before = await res(f); await (await f.$('#importFile')).setInputFiles(EXP); await C.p.waitForTimeout(1200);
  const r = await res(f); const d = diff(r, oldRes);
  ok(diff(before, oldRes).length > 0 && !d.length, 'old Export JSON (' + path.basename(EXP) + ') imports into the suite tab: inputs, factors and check summary identical to the old page (' + d.length + ' differences)');
  ok(r.inp.code === 'AASHTO' && r.inp.fc == 6000 && r.inp.barSize === '7', 'imported values: code ' + r.inp.code + ', f\'c ' + r.inp.fc + ', #' + r.inp.barSize);
  await C.b.close(); }
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
