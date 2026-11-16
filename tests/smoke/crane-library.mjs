#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), C2-1: the crane library and the project's cranes. Headless Chromium, file://, base map None.
// Only the SYNTHETIC cranes of tests/smoke/crane-fake-*.json are used (no manufacturer chart data is in this repository).
//   1. Cranes tab: "Load crane file(s)" (two fake files and one bad file): library list, messages (preliminary, not a crane file);
//   2. Add to project: the card (source document, revision, date, PRELIMINARY, terms, rating basis 85 % / 75 % of tipping from the notes,
//      fingerprint, plan dimensions, zone sectors, the phase-4 inputs); inputs stored in the project's crane copy; Undo / Redo;
//   3. "Load crane library from GitHub" (api.github.com mocked; the library repository Structural_References@crane-charts, folder
//      "Crane Load Charts/library/"): every request carries the Cloud sync token in the Authorization header only (never in a URL, a
//      body, the page text, the console, the library, the project or any other storage key); a 404 (wrong folder) gives a message;
//   4. Cloud sync to a PUBLIC repository: the Cranes tab warns, Save asks first (Cancel = not saved); after a check that says private
//      the project (with its chart data) is saved and uploaded;
//   5. crane editor: New crane from a pasted Excel chart (blanks, kip, capacity rising with radius flagged); editing a chart cell marks
//      the crane "edited here"; "Use the library copy" restores it;
//   6. reload keeps the project's cranes (autosave); Report §Cranes (source, revision, preliminary, rating basis, terms; no NaN);
//   7. 390 px: no sideways scroll on the Cranes tab and in the editor; 0 console errors.
//   SHOTS=<dir> node tests/smoke/crane-library.mjs
import path from 'path';
import fs from 'fs';
import os from 'os';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';
import { makeGitHubMock } from '../engine/gh-mock.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/crane-pick/index.html');
const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'crane-lib-'));
const FW = path.join(REPO, 'tests/smoke/crane-fake-wheeled.json'), FC = path.join(REPO, 'tests/smoke/crane-fake-crawler.json');
const BAD = path.join(TMP, 'not-a-crane.json'); fs.writeFileSync(BAD, '{"schema":"something-else"}');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const TOKEN = 'github_pat_CRANESMOKE000000000000wxyz';
const libGh = makeGitHubMock({ repo: 'Structural_References', branch: 'crane-charts', token: TOKEN });
const syncGh = makeGitHubMock({ repo: 'structural-projects', branch: 'main', token: TOKEN, isPrivate: false });
libGh.files.set('Crane Load Charts/library/fakeco-test-at-100.json', fs.readFileSync(FW, 'utf8'));
libGh.files.set('Crane Load Charts/library/fakeco-test-cr-200.json', fs.readFileSync(FC, 'utf8'));
libGh.files.set('Crane Load Charts/library/SCHEMA.md', '# schema (not a crane)');
libGh.files.set('Crane Load Charts/library/sub/ignored.json', '{}');
libGh.files.set('Crane Load Charts/other.json', '{}');
const SYNC = JSON.stringify({ owner: 'mlococo88', repo: 'structural-projects', branch: 'main', token: TOKEN, device: 'Smoke' });
const { b, ctx, p, errs } = await openPage(FILE, { vw: 1280, vh: 860, ls: { 'crane.ui': '{"base":"none","itab":"cranes"}' } });
const reqs = [];
await ctx.route('https://api.github.com/**', async r => { const q = r.request(), h = await q.allHeaders();
  reqs.push({ method: q.method(), url: q.url(), headers: h, body: q.postData() || '' });
  const gh = /\/repos\/mlococo88\/Structural_References/.test(q.url()) ? libGh : syncGh;
  const res = gh.handle(q.method(), q.url(), h, q.postData()); return r.fulfill({ status: res.status, headers: res.headers, body: res.body }); });
let reply = [], seen = [];
p.removeAllListeners('dialog'); p.on('dialog', async d => { seen.push(d.message()); const r = reply.shift(); if (r === false) await d.dismiss(); else await d.accept(typeof r === 'string' ? r : undefined); });
const logs = []; p.on('console', m => logs.push(m.text()));
const proj = () => p.evaluate(() => JSON.parse(localStorage.getItem('crane.project.current')));
const lib = () => p.evaluate(() => JSON.parse(localStorage.getItem('crane.library.v1') || '{"cranes":{}}'));
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
const setF = async (sel, v) => { await p.fill(sel, String(v)); await p.dispatchEvent(sel, 'change'); await p.waitForTimeout(80); };
const txt = sel => p.$eval(sel, e => (e.innerText || e.textContent).replace(/\s+/g, ' '));
const settle = () => p.waitForTimeout(450);
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(300);
  // 1.
  assert.deepEqual(await p.$$eval('#inTabs [data-itab]', a => a.map(x => x.textContent)), ['Project', 'Site & map', 'Plan sheets', 'Site items', 'Cranes', 'Lifts', 'Ground', 'Girder lifts', 'Route', 'Terrain']);   // C4 adds Ground, C5 Girder lifts, C6 Route (list updated in C7: it failed on main since C5), C8 Terrain
  assert.match(await txt('[data-pane=cranes]'), /The library is empty/);
  await p.setInputFiles('#crFiles', [FW, FC, BAD]); await p.waitForFunction(() => /Files: 2 cranes loaded/.test(document.querySelector('#crStatus').textContent));
  let L = await lib(); assert.deepEqual(Object.keys(L.cranes).sort(), ['fakeco-test-at-100-fake-test-data', 'fakeco-test-cr-200-fake-test-data']);
  assert.equal(L.cranes['fakeco-test-at-100-fake-test-data'].src.from, 'file');
  const msgs = await p.$eval('#crLoadMsgs', e => e.textContent.replace(/\s+/g, ' ')); assert.match(msgs, /not-a-crane\.json: not a crane file: schema "something-else"/); assert.match(msgs, /PRELIMINARY/);
  assert.match(await txt('#crStatus'), /1 not loaded/);
  ok('Load crane file(s): 2 fake cranes in the library (crane.library.v1), a bad file is refused with its reason, warnings listed');

  // 2.
  await p.click('[data-ca=add][data-k="fakeco-test-at-100-fake-test-data"]'); await p.waitForTimeout(150);
  let P = await proj(); assert.equal(P.cranes.length, 1); assert.equal(P.cranes[0].def.model, 'TEST-AT 100 (FAKE TEST DATA)'); assert.equal(P.cranes[0].def.configs.length, 5, 'the whole crane is copied');
  const card = await txt('.crCard');
  for (const rx of [/FAKECO TEST-AT 100/, /PRELIMINARY/, /Source document FAKECO test chart TC-1/, /Revision T1/, /Date 2026-11-16/, /Terms: FAKE TEST DATA/, /85 % of tipping \(chart notes\)/, /75 % of tipping \(chart notes\)/,
    /notes: interpolation between radii permitted/, /Over-front half-angle/, /tail swing 15\.00 ft/, /spreads full 24\.00, mid 16\.00 ft/, /For outrigger \/ track loads \(Ground\)/, /Upperworks weight/, /Carrier weight/, /Float size/, /Chart data fingerprint [0-9a-f]{8}/, /Preliminary document/])
    assert.match(card, rx);
  assert.equal(await p.$eval('[data-cr][data-k=flt]', e => e.placeholder), '2 (file)');
  const cid = P.cranes[0].id;
  await setF(`#cr_upLb_${cid}`, '45,000'); await setF(`#cr_upCg_${cid}`, -3.5); await setF(`#cr_secF_${cid}`, 10); await setF(`#cr_flt_${cid}`, 'abc');
  assert.ok(await p.$(`#cr_flt_${cid}.bad`));
  P = await proj(); assert.deepEqual(P.cranes[0].def.app_inputs, { ph4: { upperLb: 45000, upperCg: -3.5 }, sectors: { front: 10 } });
  await p.click('[data-ca=add][data-k="fakeco-test-cr-200-fake-test-data"]'); await p.waitForTimeout(150);
  const rb = `[data-rb="rear-150k"]`; assert.equal(await p.$(rb), null, 'the crawler notes state 75 %: no input');
  await settle(); await p.click('#bUndo'); await p.waitForTimeout(150); assert.equal((await proj()).cranes.length, 1);
  await settle(); await p.click('#bRedo'); await p.waitForTimeout(150); assert.equal((await proj()).cranes.length, 2);
  assert.match(await txt('[data-pane=cranes] .secHead >> nth=1'), /Cranes in this project \(2\)/i);
  await shot('c2-1-cranes');
  ok('Add to project: the whole crane copied into the project; card shows source, revision, date, PRELIMINARY, terms, rating basis (notes), fingerprint, plan dims, zone sectors, phase-4 inputs; Undo / Redo');

  // 3. GitHub library (mocked)
  await p.click('[data-ca=gh]'); await p.waitForTimeout(150); assert.match(await txt('#crStatus'), /No GitHub token in this browser/);
  await p.evaluate(s => localStorage.setItem('bridgeSuite.v1.githubSync', s), SYNC);
  await p.evaluate(() => { localStorage.removeItem('crane.library.v1'); CranePickCraneUI.redraw(); });
  await p.click('[data-ca=gh]'); await p.waitForFunction(() => /GitHub library: 2 cranes loaded/.test(document.querySelector('#crStatus').textContent));
  L = await lib(); assert.equal(Object.keys(L.cranes).length, 2); const e0 = L.cranes['fakeco-test-at-100-fake-test-data'];
  assert.deepEqual([e0.src.from, e0.src.repo, e0.src.path], ['github', 'mlococo88/Structural_References@crane-charts', 'Crane Load Charts/library/fakeco-test-at-100.json']);
  const libReqs = reqs.filter(r => /Structural_References/.test(r.url));
  assert.ok(libReqs.length >= 3, 'the tree and two files');
  assert.ok(libReqs.every(r => r.headers.authorization === 'Bearer ' + TOKEN), 'the token in the Authorization header');
  assert.ok(reqs.every(r => !r.url.includes(TOKEN) && !r.body.includes(TOKEN) && Object.entries(r.headers).every(([k, v]) => k === 'authorization' || !String(v).includes(TOKEN))), 'the token nowhere else in a request');
  assert.ok(!libReqs.some(r => /SCHEMA\.md|ignored\.json|other\.json/.test(decodeURIComponent(r.url))), 'only the .json files directly in the folder');
  // settings: a wrong folder -> 404-free tree, no files -> message; the defaults restore
  await p.click('#crSrc summary'); await p.fill('#crSrcFolder', 'Nope/'); await p.click('[data-ca=srcSave]'); await p.waitForTimeout(80);
  assert.deepEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('crane.libsrc'))), { owner: 'mlococo88', repo: 'Structural_References', branch: 'crane-charts', folder: 'Nope/' });
  await p.click('[data-ca=gh]'); await p.waitForFunction(() => /No \.json crane files in "Nope"/.test(document.querySelector('#crStatus').textContent));
  await p.fill('#crSrcBranch', 'missing'); await p.click('[data-ca=srcSave]'); await p.click('[data-ca=gh]'); await p.waitForFunction(() => /GitHub: Not found on GitHub/.test(document.querySelector('#crStatus').textContent));
  assert.match(await txt('#crStatus'), /Contents: Read/);
  const k404 = errs.findIndex(e => /status of 404/.test(e)); if (k404 >= 0) errs.splice(k404, 1);   // the browser logs the (intended) 404 of the missing branch
  await p.click('[data-ca=srcReset]'); await p.waitForTimeout(80); assert.equal(await p.inputValue('#crSrcFolder'), 'Crane Load Charts/library/');
  ok('Load crane library from GitHub (mocked): tree + each .json directly in the folder; token only in the Authorization header; settings (crane.libsrc) editable; empty folder and 404 messages');

  // 4. Cloud sync to a PUBLIC repository
  await p.click('[data-ca=check]'); await p.waitForFunction(() => /PUBLIC/.test((document.querySelector('#crSync') || {}).textContent || ''));
  assert.deepEqual(await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('crane.syncCheck')); return [v.owner, v.repo, v.private]; }), ['mlococo88', 'structural-projects', false]);
  assert.ok(await p.$('#crSync.bad'));
  await p.click('#inTabs [data-itab=proj]');
  reply = [false]; seen = [];
  await p.evaluate(() => SharedProjectsUI.bars[0].saveAs()); await p.waitForSelector('dialog.spSave[open]'); await p.fill('dialog.spSave .spName', 'Crane lib smoke'); await p.click('dialog.spSave [data-sa=ok]'); await p.waitForTimeout(300);
  assert.match(seen[0] || '', /structural-projects is a PUBLIC repository.*crane chart data/s); assert.match(seen[1] || '', /Not saved/);
  assert.equal(await p.evaluate(() => localStorage.getItem('crane.projects.v1')), null, 'not saved');
  assert.ok(!syncGh.files.size, 'nothing uploaded');
  await p.evaluate(() => { localStorage.setItem('crane.syncCheck', JSON.stringify({ owner: 'mlococo88', repo: 'structural-projects', private: true, at: new Date().toISOString() })); });
  seen = [];
  await p.evaluate(() => SharedProjectsUI.bars[0].saveAs()); await p.waitForSelector('dialog.spSave[open]'); await p.fill('dialog.spSave .spName', 'Crane lib smoke'); await p.click('dialog.spSave [data-sa=ok]');
  await p.waitForFunction(() => !!JSON.parse(localStorage.getItem('crane.projects.v1') || '{}')['Crane lib smoke']); assert.deepEqual(seen, [], 'a private repository: no question');
  for (let k = 0; k < 40 && !syncGh.files.size; k++) await p.waitForTimeout(250);
  const up = [...syncGh.files.entries()].find(([k]) => /^projects\/crane-pick\/Crane lib smoke\.json$/.test(k));
  assert.ok(up, 'uploaded: ' + [...syncGh.files.keys()].join()); assert.match(up[1], /FAKECO test chart TC-1/, 'the GitHub copy carries the crane (chart data)');
  ok('Cloud sync to a PUBLIC repository: the Cranes tab warns (crane.syncCheck), Save asks first and Cancel does not save; once the repository is private the project uploads with its chart data');

  // 5. editor
  await p.click('#inTabs [data-itab=cranes]'); await p.click('[data-ca=new]'); await p.waitForSelector('dialog#crEdit[open]');
  await setF('#ceMake', 'FAKECO'); await setF('#ceModel', 'PASTE-1 (FAKE)'); await setF('#ceDoc', 'fake pasted chart'); await setF('#ceRev', 'P1');
  await p.fill('#ceChart', 'R \\ L\t40\t60\n10\t50\t45\n20\t30\t46\n30\t\t20\n'); await p.selectOption('#ceUnit', 'kip'); await p.click('[data-ce=read]'); await p.waitForTimeout(100);
  assert.match(await txt('#ceChartMsg'), /Chart read\..*increases with radius.*L 60 ft: 45,000 → 46,000 lb at R 20 ft/);
  assert.equal(await p.$$eval('.crPrev td.crInc', a => a.length), 1); assert.equal(await p.$$eval('.crPrev td.crBlank', a => a.length), 1);
  await setF('#ceNotes', 'FAKE. Not exceeding 75% of tipping.');
  await p.click('[data-ce=save]'); await p.waitForTimeout(200);
  P = await proj(); const pasted = P.cranes.find(c => c.def.model === 'PASTE-1 (FAKE)'); assert.ok(pasted);
  assert.deepEqual(pasted.def.configs[0].chart.capacity_lb, [[50000, 45000], [30000, 46000], [null, 20000]]); assert.equal(pasted.src.from, 'paste'); assert.ok(pasted.def.app_inputs.edited);
  assert.ok((await lib()).cranes['fakeco-paste-1-fake']);
  // edit a chart cell of the fake wheeled crane
  const wid = P.cranes.find(c => /TEST-AT/.test(c.def.model)).id;
  await p.click(`[data-ca=edit][data-id="${wid}"]`); await p.waitForSelector('dialog#crEdit[open]');
  const t0 = await p.inputValue('#ceChart'); await p.fill('#ceChart', t0.replace('\n20\t60000\t', '\n20\t59000\t')); await p.click('[data-ce=save]'); await p.waitForTimeout(200);
  P = await proj(); const w2 = P.cranes.find(c => c.id === wid); assert.equal(w2.def.configs[0].chart.capacity_lb[2][0], 59000); assert.ok(w2.def.app_inputs.edited); assert.deepEqual(w2.def.app_inputs.ph4, { upperLb: 45000, upperCg: -3.5 }, 'inputs kept');
  assert.match(await txt(`#crCard-${wid}`), /edited here.*library copy differs/);
  await p.click(`[data-ca=upd][data-id="${wid}"]`); await p.waitForTimeout(150);
  P = await proj(); const w3 = P.cranes.find(c => c.id === wid); assert.equal(w3.def.configs[0].chart.capacity_lb[2][0], 60000); assert.ok(!w3.def.app_inputs.edited); assert.deepEqual(w3.def.app_inputs.sectors, { front: 10 });
  // an editor error blocks the save
  await p.click(`[data-ca=edit][data-id="${wid}"]`); await p.waitForSelector('dialog#crEdit[open]'); await setF('#ceMake', '');
  await p.click('[data-ce=save]'); await p.waitForTimeout(100); assert.match(await txt('#ceMsgs'), /make and model are required/); await p.click('.crDlgHead [data-ce=close]');
  ok('editor: a chart pasted from Excel (kip × 1,000, blanks, a rising value flagged) makes a new crane; an edited cell marks "edited here"; "Use the library copy" restores it; errors block a save');

  // 6. reload, Report
  await p.reload(); await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(300);
  assert.equal((await p.evaluate(() => CranePickApp.P.cranes.length)), 3);
  await p.click('#tabBar [data-otab=rpt]'); await p.waitForSelector('#rptHost .rp-doc'); await p.waitForTimeout(200);
  const rt = await p.textContent('#rptHost .rp-doc');
  assert.match(rt, /Cranes[\s\S]*FAKECO TEST-AT 100[\s\S]*Source document[\s\S]*FAKECO test chart TC-1[\s\S]*Revision[\s\S]*T1[\s\S]*Preliminary document[\s\S]*YES[\s\S]*Terms of the source: FAKE TEST DATA[\s\S]*85 % of tipping/);
  assert.match(rt, /Working-area sectors \(entered\): over front ±10°/); assert.match(rt, /Upperworks weight \(lb\)\s*45,000/);
  assert.ok(!/NaN|undefined/.test(rt));
  await shot('c2-1-report');
  ok('reload keeps the 3 project cranes; Report §Cranes: source, revision, preliminary, terms, rating basis, sectors, phase-4 inputs');

  // token: nowhere but the sync settings key; nowhere in the page or the console
  const store = await p.evaluate(() => Object.keys(localStorage).filter(k => k !== 'bridgeSuite.v1.githubSync').map(k => localStorage.getItem(k)).join('\n'));
  assert.ok(!store.includes(TOKEN), 'no other storage key holds the token'); assert.ok(!(await p.content()).includes(TOKEN)); assert.ok(!logs.join('\n').includes(TOKEN));
  ok('the token is in no other storage key, not in the page, not in the console');

  // 7. 390 px
  await p.setViewportSize({ width: 390, height: 800 }); await p.click('#tabBar [data-otab=plan]'); await p.click('#inTabs [data-itab=cranes]'); await p.waitForTimeout(200);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll (Cranes tab)');
  await p.evaluate(() => document.querySelector('.crCard').scrollIntoView()); await shot('c2-1-cranes-390');
  await p.click(`[data-ca=edit][data-id="${wid}"]`); await p.waitForSelector('dialog#crEdit[open]');
  assert.ok(await p.$eval('dialog#crEdit', d => d.getBoundingClientRect().right <= window.innerWidth + 1 && d.scrollWidth <= d.clientWidth + 1), 'the editor fits');
  await shot('c2-1-editor-390'); await p.click('.crDlgHead [data-ce=close]');
  ok('390 px: no sideways scroll; the editor fits the screen');
  assert.deepEqual(errs, []); ok('0 console errors');
  console.log(`\n${n} checks passed`);
} catch (e) { console.error('FAIL', e); console.error('console errors:', errs); process.exitCode = 1; }
finally { await b.close(); fs.rmSync(TMP, { recursive: true, force: true }); }
