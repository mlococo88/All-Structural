#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), C1-1: the app shell, the map, save / open / undo, GitHub sync. Headless Chromium, file://, CDN
// libraries from tests/libs, map tiles answered with a blank tile (tests/lib.mjs); api.github.com routed to the in-memory GitHub of
// tests/engine/gh-mock.mjs (nothing reaches the network).
//   1. the shell: header (title, "LIFT-PLANNING AID", project chip, Undo / Redo), input tabs, output tabs Plan / Site / Report; the map
//      (Leaflet) with zoom, base-layer control, scale bar (feet), the coordinate box (latitude / longitude and MA Mainland State Plane);
//   2. base maps: Satellite asks Esri World Imagery tiles (attribution Esri), Street asks OpenStreetMap (attribution OpenStreetMap
//      contributors), None asks none (blank grid); the choice is kept per browser (crane.ui), not in the project;
//   3. cursor coordinates = proj4 of the point under the cursor; go to latitude / longitude; go to a State Plane coordinate (RI zone);
//      the zone choice is a project input (undoable);
//   4. title block: an edit is autosaved, "unsaved changes", Undo / Redo (buttons and Ctrl+Z / Ctrl+Y); map moves are not undo steps;
//   5. Save as, Ctrl+S, Saved projects (open asks on unsaved changes, rename, duplicate, delete), New, reload keeps the open project;
//   6. Export JSON = { format: 'crane-pick.project', version: 1, project }; Import JSON opens it;
//   7. Cloud sync: off = no request; set up -> uploads projects/crane-pick/<name>.json = the tool's file; the token only in the
//      Authorization header (not in a URL, the page, the console, an exported file, a project or a key but bridgeSuite.v1.githubSync);
//   8. every key the page wrote starts with "crane." (or is the shared sync setting); other tools' keys unchanged;
//   9. offline tiles: a notice over the map ("Map tiles are not loading") with "Use no base map";
//  10. Site and Report tabs (the lift-planning-aid statement; the report model has no unresolved or duplicate keys);
//  11. 390 px: the map first and full width, the inputs below, no sideways scroll; 0 console errors.
//   SHOTS=<dir> node tests/smoke/crane-shell.mjs
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';
import { makeGitHubMock } from '../engine/gh-mock.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/crane-pick/index.html');
const TOKEN = 'github_pat_SMOKECRANE0000000000abcd';
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const until = async (f, ms, w) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + w); await new Promise(r => setTimeout(r, 150)); } };
const OTHER = { 'psb2.project.current': '{"x":1}', 'sfd_projects': '{"a":{"b":2}}' };
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 860, ls: OTHER });
const consoleAll = []; p.on('console', m => consoleAll.push(m.text()));
const dl = []; let reply = [];
p.removeAllListeners('dialog');
p.on('dialog', async d => { dl.push(d.type() + ': ' + d.message().slice(0, 200)); const r = reply.shift(); if (r === false) await d.dismiss(); else await d.accept(typeof r === 'string' ? r : undefined); });
const gh = makeGitHubMock({ token: TOKEN }), tiles = [], other = [];
await p.route('https://api.github.com/**', async r => { const x = r.request(); const res = gh.handle(x.method(), x.url(), await x.allHeaders(), x.postData()); return r.fulfill({ status: res.status, headers: res.headers, body: res.body }); });
p.on('request', r => { const u = r.url(); if (/arcgisonline|openstreetmap/.test(u)) tiles.push(u); else if (!/^(file|data|blob|about):/.test(u) && !u.startsWith('https://api.github.com/') && !/cdnjs|jsdelivr|unpkg/.test(u)) other.push(u); });
const ls = k => p.evaluate(k => localStorage.getItem(k), k);
const keys = () => p.evaluate(() => Object.keys(localStorage).sort());
const proj = async () => JSON.parse(await ls('crane.project.current'));
const chip = () => p.$eval('[data-sp=chip]', e => e.innerText.replace(/\s+/g, ' ').trim());
const state = async () => { await p.evaluate(() => SharedProjectsUI.bars[0].refresh()); const c = await chip(); return /· not saved/.test(c) ? 'not saved' : /unsaved changes/.test(c) ? 'unsaved' : /· saved/.test(c) ? 'saved' : c; };
const itab = id => p.click(`#inTabs [data-itab="${id}"]`);
const otab = id => p.click(`#tabBar [data-otab="${id}"]`);
const setTb = async (k, v) => { await itab('proj'); await p.fill('#tb_' + k, v); await p.dispatchEvent('#tb_' + k, 'change'); await p.waitForTimeout(80); };
const saveAs = async (nm, replace) => { await p.evaluate(() => SharedProjectsUI.bars[0].saveAs()); await p.waitForSelector('dialog.spSave[open]');
  await p.fill('dialog.spSave .spName', nm); await p.click('dialog.spSave [data-sa=ok]');
  if (replace) { await p.click('dialog.spSave [data-sa=ok]'); } await p.waitForTimeout(150); };
const ctrlS = async () => { await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('Control+s'); await p.waitForTimeout(150); };
const lib = async () => { await p.evaluate(() => { const d = document.getElementById('crLibDlg'); if (d && d.open) d.close(); }); await p.click('[data-sp=chip]'); await p.click('[data-sp=card] [data-sp=lib]'); await p.waitForSelector('#crLibDlg[open] .spBody'); await p.waitForTimeout(100); };
const closeDlgs = () => p.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
const rowBtn = (txt, a) => p.click(`#crLibDlg tbody tr:has-text("${txt}") [data-spa=${a}]`);
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
const center = () => p.evaluate(() => { const c = CranePickMap.map.getCenter(); return { lat: c.lat, lng: c.lng }; });
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForSelector('#map .leaflet-tile-pane', { state: 'attached' }); await p.waitForTimeout(600);
  // 1. shell
  assert.match(await p.textContent('#hdr h1'), /Crane Pick Analyzer\s*LIFT-PLANNING AID/);
  assert.deepEqual((await p.$$eval('#inTabs [data-itab]', a => a.map(x => x.textContent))).slice(0, 2), ['Project', 'Site & map']);
  assert.deepEqual(await p.$$eval('#tabBar [data-otab]', a => a.map(x => x.textContent)), ['Plan', 'Summary', 'Crane', 'Picks', 'Ground', 'Route', 'Terrain', 'Site', 'Drawings', 'Manual', 'Report']);   // C7: Summary, Drawings; C8: Terrain; C9: Crane; Manual (2026-11-17);   // C2-3 adds Picks, C4 Ground, C6 Route
  assert.equal(await p.evaluate(() => [...document.querySelectorAll('#hdrBtns [data-sp]')].map(b => b.dataset.sp).join()), 'chip');
  assert.ok(await p.$('#bUndo[disabled]') && await p.$('#bRedo[disabled]'));
  assert.ok(await p.$('.leaflet-control-zoom') && await p.$('.leaflet-control-layers') && await p.$('.leaflet-control-scale'));
  assert.match(await p.textContent('.leaflet-control-scale'), /ft|mi/);
  assert.match(await p.textContent('#crCoord'), /Center 42\.3601\d*° N, 71\.0589\d*° W.*E [\d,]+\.\d\d · N [\d,]+\.\d\d ftUS, MA Mainland$/);
  assert.equal(await state(), 'not saved');
  ok('shell: header (title, LIFT-PLANNING AID, chip, Undo / Redo), tabs, map with zoom, layers, scale bar (ft), coordinate box (lat/long and MA State Plane)');
  await shot('c1-shell-1280');

  // 2. base maps
  await until(() => p.evaluate(() => [...document.querySelectorAll('#map img.leaflet-tile')].some(i => i.src.includes('World_Imagery/MapServer/tile/'))), 5000, 'esri tiles');
  assert.match(await p.textContent('.leaflet-control-attribution'), /Esri.*Maxar.*Earthstar Geographics/);
  await itab('site'); await p.check('input[name=stBase][value=street]'); await p.waitForTimeout(400);
  assert.ok(tiles.some(u => u.startsWith('https://tile.openstreetmap.org/')), 'OSM tiles'); assert.match(await p.textContent('.leaflet-control-attribution'), /OpenStreetMap contributors/);
  assert.doesNotMatch(await p.textContent('.leaflet-control-attribution'), /Esri/);
  const t0 = tiles.length; await p.check('input[name=stBase][value=none]'); await p.waitForTimeout(400);
  assert.equal(tiles.length, t0, 'None: no tile request'); assert.ok(await p.$('#map.blank'));
  assert.equal(JSON.parse(await ls('crane.ui')).base, 'none'); assert.equal((await proj()).base, undefined, 'not in the project');
  await p.check('input[name=stBase][value=sat]'); await p.waitForTimeout(200);
  ok('base maps: Satellite = Esri World Imagery (attribution), Street = OpenStreetMap (attribution), None = no tiles (blank grid); kept in crane.ui');

  // 3. coordinates and go to
  const box = await p.$eval('#map', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p.mouse.move(box.x + 300, box.y + 200); await p.waitForTimeout(150);
  const exp = await p.evaluate(() => { const ll = CranePickMap.map.containerPointToLatLng([300, 200]); const r = proj4(CranePickGeo.WGS, CranePickGeo.zone('EPSG:2249').def, [ll.lng, ll.lat]);
    const f = (v, d) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); return `Cursor ${f(ll.lat, 6)}° N, ${f(-ll.lng, 6)}° W E ${f(r[0], 2)} · N ${f(r[1], 2)} ftUS`; });
  const cur = (await p.$eval('#crCoord', e => e.innerText.replace(/\s+/g, ' ').replace(/, MA Mainland$/, '')));
  assert.equal(cur, exp, 'the cursor coordinates = proj4 of the point under the cursor');
  await p.fill('#goLat', '41 49 26.4 N'); await p.fill('#goLng', '71.4128'); await p.click('#goLL'); await p.waitForTimeout(200);
  let c = await center(); assert.ok(Math.abs(c.lat - (41 + 49 / 60 + 26.4 / 3600)) < 1e-9 && Math.abs(c.lng + 71.4128) < 1e-9, JSON.stringify(c));
  assert.match(await p.textContent('#goMsg'), /west longitude assumed/);
  await p.selectOption('#stZone', 'EPSG:3438'); await p.waitForTimeout(150);
  assert.equal((await proj()).site.zone, 'EPSG:3438'); assert.match(await p.textContent('#goGridLbl'), /Rhode Island \(ftUS\), US survey feet/);
  const en = await p.evaluate(() => { const r = proj4(CranePickGeo.WGS, CranePickGeo.zone('EPSG:3438').def, [-71.5, 41.7]); return r; });
  await p.fill('#goE', en[0].toFixed(3)); await p.fill('#goN', en[1].toFixed(3)); await p.click('#goEN'); await p.waitForTimeout(200);
  c = await center(); assert.ok(Math.abs(c.lat - 41.7) < 1e-7 && Math.abs(c.lng + 71.5) < 1e-7, JSON.stringify(c));
  assert.match(await p.textContent('#crCoord'), /Rhode Island/);
  await p.evaluate(() => document.activeElement.blur()); await p.click('#bUndo'); await p.waitForTimeout(150);
  assert.equal((await proj()).site.zone, 'EPSG:2249', 'Undo: the zone back (a map move was no step)'); assert.equal(await p.$eval('#stZone', e => e.value), 'EPSG:2249');
  ok('cursor coordinates = proj4 of the point under the cursor; go to lat/long (DMS) and to a RI State Plane coordinate; the zone is an undoable input; map moves are not steps');

  // 4. title block, undo / redo (after an undo, shared/projects.js history takes the next 400 ms as settling, not as a step)
  await p.waitForTimeout(500);
  await setTb('name', 'Route 6 over the Taunton River'); await setTb('number', 'BR-0123');
  assert.equal((await proj()).title.name, 'Route 6 over the Taunton River'); assert.equal(await state(), 'not saved');
  await p.click('#bUndo'); await p.waitForTimeout(100); assert.equal((await proj()).title.number, '');
  await p.click('#bRedo'); await p.waitForTimeout(100); assert.equal((await proj()).title.number, 'BR-0123'); assert.equal(await p.inputValue('#tb_number'), 'BR-0123');
  await p.evaluate(() => document.activeElement.blur()); await p.keyboard.press('Control+z'); await p.waitForTimeout(100); assert.equal((await proj()).title.number, '');
  await p.keyboard.press('Control+y'); await p.waitForTimeout(100); assert.equal((await proj()).title.number, 'BR-0123');
  await p.fill('#prjNotes', 'Pick the 120 ft girders from the north approach.'); await p.dispatchEvent('#prjNotes', 'change');
  assert.equal((await proj()).notes, 'Pick the 120 ft girders from the north approach.');
  ok('title block and notes autosaved; Undo / Redo by buttons and Ctrl+Z / Ctrl+Y');

  // 5. saved projects
  await ctrlS(); await p.waitForSelector('dialog.spSave[open]');
  assert.equal(await p.$eval('dialog.spSave .spName', e => e.value), 'Route 6 over the Taunton River'); await p.click('dialog.spSave [data-sa=ok]'); await p.waitForTimeout(200);
  assert.equal(await state(), 'saved'); let list = JSON.parse(await ls('crane.projects.v1'));
  assert.deepEqual(Object.keys(list), ['Route 6 over the Taunton River']); assert.ok(list['Route 6 over the Taunton River'].savedAt);
  assert.equal(await ls('crane.open'), 'Route 6 over the Taunton River');
  await setTb('checker', 'J. Engineer'); assert.equal(await state(), 'unsaved');
  const nd = dl.length; await ctrlS(); assert.equal(dl.length, nd); assert.equal(await state(), 'saved');
  assert.equal(JSON.parse(await ls('crane.projects.v1'))['Route 6 over the Taunton River'].title.checker, 'J. Engineer');
  await saveAs('Alt crane position'); assert.equal(Object.keys(JSON.parse(await ls('crane.projects.v1'))).length, 2);
  await setTb('rev', 'B'); assert.equal(await state(), 'unsaved');
  await lib(); reply = [false]; await rowBtn('Route 6', 'open'); await p.waitForTimeout(100);
  assert.match(dl.at(-1), /^confirm: The project on screen has unsaved changes/); assert.equal((await proj()).title.rev, 'B');
  reply = [true]; await rowBtn('Route 6', 'open'); await p.waitForTimeout(200);
  assert.equal((await proj()).title.rev, ''); assert.equal(await state(), 'saved'); assert.equal(await p.inputValue('#tb_checker'), 'J. Engineer');
  await lib(); await shot('c1-library-1280');
  reply = ['Alt position (renamed)']; await rowBtn('Alt crane', 'rename'); await p.waitForTimeout(150);
  reply = ['Copy']; await rowBtn('renamed', 'dup'); await p.waitForTimeout(150); assert.equal(Object.keys(JSON.parse(await ls('crane.projects.v1'))).length, 3);
  reply = [true]; await rowBtn('Copy', 'del'); await p.waitForTimeout(150); assert.deepEqual(Object.keys(JSON.parse(await ls('crane.projects.v1'))).sort(), ['Alt position (renamed)', 'Route 6 over the Taunton River']);
  await closeDlgs();
  await p.reload(); await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(500);
  assert.equal(await state(), 'saved'); assert.match(await chip(), /Route 6 over the Taunton River/);
  reply = [true]; await p.click('[data-sp=card] [data-sp=new]'); await p.waitForTimeout(200);
  assert.equal((await proj()).title.name, 'New crane pick'); assert.equal(await state(), 'not saved'); assert.equal(await ls('crane.open'), '');
  await lib(); reply = [true]; await rowBtn('Route 6', 'open'); await p.waitForTimeout(200); await closeDlgs();
  ok('Save as (name offered), Ctrl+S, open asks on unsaved changes, rename, duplicate, delete, reload keeps the open project, New');

  // 6. Export / Import JSON
  const [d1] = await Promise.all([p.waitForEvent('download'), p.click('[data-sp=card] [data-sp=export]')]);
  const exp1 = fs.readFileSync(await d1.path(), 'utf8'), ef = JSON.parse(exp1);
  assert.equal(d1.suggestedFilename(), 'Route_6_over_the_Taunton_River.crane.json'); assert.equal(ef.format, 'crane-pick.project'); assert.equal(ef.version, 1);
  assert.equal(ef.project.title.number, 'BR-0123'); assert.equal(ef.images, undefined);
  ef.project.title.name = 'Imported pick'; const tmp = path.join(process.env.TMPDIR || '/tmp', 'crane-import.json'); fs.writeFileSync(tmp, JSON.stringify(ef));
  reply = [true]; await p.setInputFiles('#fImport', tmp); await p.waitForTimeout(300);
  assert.equal((await proj()).title.name, 'Imported pick'); assert.equal(await state(), 'not saved');
  ok('Export JSON = { format: "crane-pick.project", version: 1, project }; Import JSON opens it');

  // 7. Cloud sync
  await lib(); reply = [true]; await rowBtn('Route 6', 'open'); await p.waitForTimeout(200);
  await lib(); await p.waitForTimeout(1200);
  assert.match(await p.evaluate(() => document.getElementById('crLibDlg').innerText), /Cloud sync \(GitHub\): off/); assert.equal(gh.log.length, 0, 'sync off: no request');
  await p.click('#crLibDlg [data-gh=setup]'); await p.waitForSelector('#spGhDlg[open]');
  await p.fill('#spGhToken', TOKEN); await p.fill('#spGhDevice', 'Smoke PC');
  await p.click('#spGhDlg [data-gh=test]'); await until(() => p.evaluate(() => /Connected to|Not connected/.test(document.querySelector('#spGhDlg .spGhRes').textContent)), 10000, 'test connection');
  assert.match(await p.evaluate(() => document.querySelector('#spGhDlg .spGhRes').textContent), /Connected to/);
  await p.click('#spGhDlg [data-gh=close]');
  await until(() => p.evaluate(() => !!document.querySelector('#crLibDlg [data-ghx=upall]')), 10000, 'first-connect offer');
  await p.click('#crLibDlg [data-ghx=upall]');
  const F = 'projects/crane-pick/Route 6 over the Taunton River.json';
  await until(() => gh.files.has(F), 15000, 'upload');
  const item = JSON.parse(await ls('crane.projects.v1'))['Route 6 over the Taunton River'];
  assert.equal(gh.files.get(F), JSON.stringify({ format: 'crane-pick.project', version: 1, project: item }, null, 1), 'the GitHub file = the tool\'s file of the stored item');
  await closeDlgs(); await setTb('client', 'MassDOT'); await ctrlS();
  await until(() => JSON.parse(gh.files.get(F)).project.title.client === 'MassDOT', 15000, 'upload after Ctrl+S');
  const [d2] = await Promise.all([p.waitForEvent('download'), p.click('[data-sp=card] [data-sp=export]')]); const exp2 = fs.readFileSync(await d2.path(), 'utf8');
  for (const l of gh.log) { assert.ok(l.url.startsWith('https://api.github.com/repos/'), l.url); assert.ok(!l.url.includes(TOKEN)); assert.equal(l.auth, `Bearer ${TOKEN}`); }
  assert.ok(!(await p.evaluate(() => document.body.innerText)).includes(TOKEN)); assert.ok(!consoleAll.some(t => t.includes(TOKEN)));
  assert.ok(!exp1.includes(TOKEN) && !exp2.includes(TOKEN));
  for (const k of await keys()) if (k !== 'bridgeSuite.v1.githubSync') assert.ok(!((await ls(k)) || '').includes(TOKEN), k);
  for (const t of gh.files.values()) assert.ok(!t.includes(TOKEN));
  ok('Cloud sync: off = no request; set up; uploads projects/crane-pick/<name>.json = the tool\'s file; the token only in the Authorization header');

  // 8. keys
  const ks = await keys(), mine = ks.filter(k => !(k in OTHER));
  mine.forEach(k => assert.ok(k.startsWith('crane.') || k === 'bridgeSuite.v1.githubSync' || /^bridgeSuite\.v1\.githubSync\.(deviceId|live|tool\.crane-pick|presence\.crane-pick)$/.test(k), 'key ' + k));
  for (const [k, v] of Object.entries(OTHER)) assert.equal(await ls(k), v, k);
  ok('keys written: ' + mine.join(', ') + '; other tools\' keys unchanged');

  // 9. offline tiles
  assert.deepEqual(errs, [], 'no console error before the offline-tile step'); const e9 = errs.length;
  await p.route(/arcgisonline|openstreetmap/, r => r.abort());
  await p.evaluate(() => { CranePickMap.setBase('street'); CranePickMap.map.setZoom(CranePickMap.map.getZoom() - 1); });
  await until(() => p.evaluate(() => !document.getElementById('mapMsg').hidden), 8000, 'offline notice');
  assert.match(await p.textContent('#mapMsg'), /Map tiles are not loading/);
  await p.click('#mmNone'); await p.waitForTimeout(150); assert.ok(await p.evaluate(() => document.getElementById('mapMsg').hidden)); assert.equal(JSON.parse(await ls('crane.ui')).base, 'none');
  await p.unroute(/arcgisonline|openstreetmap/);
  ok('offline tiles: a notice over the map with "Use no base map" (then a blank grid)');

  // 10. Site and Report
  await otab('site'); await p.waitForTimeout(150);
  assert.match(await p.textContent('[data-opane=site]'), /Route 6 over the Taunton River[\s\S]*BR-0123[\s\S]*Lift-planning aid/);
  await otab('rpt'); await p.waitForSelector('#rptHost .rp-doc');
  const rt = await p.textContent('#rptHost .rp-doc'); assert.match(rt, /Lift-planning aid\. This report supports the lift plan/); assert.match(rt, /Massachusetts Mainland \(ftUS\), EPSG:2249/);
  const bad = await p.evaluate(() => { const d = SharedReport.build(CranePickReport.model(CranePickApp.P)); return d.unresolved.concat(d.dup); }); assert.deepEqual(bad, []);
  assert.doesNotMatch(await p.evaluate(() => SharedReport.text(SharedReport.build(CranePickReport.model(CranePickApp.P)))), /NaN|undefined/);
  await shot('c1-report-1280');
  ok('Site tab (project, coordinate system, statement); Report (statement, zone; no unresolved / duplicate keys, no NaN / undefined)');

  // 11. 390 px
  await otab('plan'); await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at 390 px: ' + await p.evaluate(() => document.documentElement.scrollWidth));
  const lay = await p.evaluate(() => { const m = document.getElementById('map').getBoundingClientRect(), i = document.getElementById('inputPanel').getBoundingClientRect(); return { mw: m.width, mt: m.top, it: i.top }; });
  assert.ok(lay.mw >= 389 && lay.mt < lay.it, JSON.stringify(lay));
  await shot('c1-shell-390');
  await lib(); assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await closeDlgs();
  await otab('rpt'); await p.waitForTimeout(200); assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'report at 390 px');
  assert.equal(other.length, 0, other.join(' '));
  assert.deepEqual(errs.slice(e9).filter(e => !/^Failed to load resource: net::ERR_FAILED$/.test(e)), [], 'only the aborted tiles of step 9');
  ok('390 px: the map first and full width, inputs below, no sideways scroll; no other network request; 0 console errors (besides the aborted tiles of step 9)');
} finally { await b.close(); }
console.log(`crane-shell: ${n} checks ok`);
