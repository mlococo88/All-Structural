#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), C3-2: 3D clearances in the app. Headless Chromium, file://, base map None. Only the SYNTHETIC
// fake crane (tests/smoke/crane-fake-wheeled.json) is used. The cases are the hand checks of tests/engine/crane-clear3d.test.mjs.
//   1. a 115 kV line 10 ft east of the pick, lowest wire 50 ft above grade 100 (el. 150): red flag, the load line 10.0 ft < D_min 15 ft,
//      a red marker and a dashed line on the map; the worked steps (Table A, wire elevation, envelope, √(Δx² + Δy² + Δz²), D ≥ D_min);
//   2. the item's inputs (grade, lowest wire, sag, sway) on the Site items tab: wire 200 ft → no red flag, the true minimum reported;
//      sway 3 ft at 50 ft → 7.0 ft;
//   3. dragging the pick point toward the line: the flags and the map markers follow mid-drag; one undo step;
//   4. the path model setting (uniform / luff then swing): an exclusion zone the uniform path crosses and the luff path does not;
//      Undo / Redo of the setting;
//   5. an obstruction under the swing (top 125 > the travel height 120): red; the obstruction-clearance setting;
//   6. Picks tab "Closest 3D", Report §Lifts (3D basis, the table and the steps; no unresolved keys, no NaN);
//   7. 390 px: no sideways scroll; 0 console errors. The elevation dock (C3-2): the section at the pick and the set, live mid-drag;
//      Report §Elevations.
//   SHOTS=<dir> node tests/smoke/crane-clear3d.mjs
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/crane-pick/index.html');
const FW = path.join(REPO, 'tests/smoke/crane-fake-wheeled.json');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 860, ls: { 'crane.ui': '{"base":"none","itab":"cranes"}' } });
const proj = () => p.evaluate(() => JSON.parse(localStorage.getItem('crane.project.current')));
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
const setF = async (sel, v) => { await p.fill(sel, String(v)); await p.dispatchEvent(sel, 'change'); await p.waitForTimeout(80); };
const txt = sel => p.$eval(sel, e => (e.innerText || e.textContent).replace(/\s+/g, ' '));
const settle = () => p.waitForTimeout(450);
const scr = q => p.evaluate(q => { const m = CranePickMap.map, cp = m.latLngToContainerPoint(CranePickMap.toLL(q)), r = m.getContainer().getBoundingClientRect(); return { x: r.x + cp.x, y: r.y + cp.y }; }, q);
const c3 = () => p.evaluate(() => { const ev = CranePickPlace.evalPick(CranePickApp.P.picks[0]); return { res: ev.c3.results.map(r => ({ name: r.name, d: r.gov.d, comp: r.gov.comp, level: r.level, where: r.where, comps: Object.fromEntries(r.comps.map(c => [c.comp, c.d])) })), flags: ev.c3.flags.map(f => f.level + ':' + f.text) }; });
const marks = () => p.$$eval('.crC3', a => a.map(x => x.className.match(/crC3-(\w+)/)[1]));
const sel = async id => { await p.evaluate(id => CranePickDraw.select(id, true), id); await p.waitForTimeout(150); };
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(300);
  await p.setInputFiles('#crFiles', [FW]); await p.waitForFunction(() => /1 crane loaded/.test(document.querySelector('#crStatus').textContent));
  await p.click('[data-ca=add]'); await p.waitForTimeout(150); await p.click('[data-ca=place]'); await p.waitForTimeout(400);
  await setF('#luE', 1000); await setF('#luN', 2000); await setF('#luBoom', 60); await setF('#luPad', 100);
  await setF('#lkPE', 1030); await setF('#lkPN', 2000); await setF('#lkSE', 1000); await setF('#lkSN', 2020); await setF('#lkLoad', 20000);
  await p.click('#lkElev summary'); await p.waitForTimeout(80);
  for (const [id, v] of [['#lkPg', 98], ['#lkPh', 4], ['#lkSh', 20], ['#lkLH', 6], ['#lkRigH', 12], ['#lkBlk', 5], ['#lkLL', 40], ['#lkLW', 4]]) await setF(id, v);
  // 1. power line
  await p.evaluate(() => CranePickApp.update(P => { P.items.push(CranePickModel.normItem({ id: 'pl1', type: 'power', name: 'OH 115 kV', kv: 115, height: 50, gradeEl: 100, pts: [{ x: 1040, y: 1900 }, { x: 1040, y: 2100 }] })); }, 'items')); await p.waitForTimeout(200);
  await p.evaluate(() => CranePickPlace.select(CranePickApp.P.setups[0].id, CranePickApp.P.picks[0].id)); await p.waitForTimeout(150);
  await p.evaluate(() => { const u = CranePickApp.P.setups[0]; CranePickMap.fit([{ x: u.x - 50, y: u.y - 50 }, { x: u.x + 50, y: u.y + 50 }]); }); await settle();
  let r = await c3(); near(r.res[0].d, 10, 1e-9); assert.equal(r.res[0].comp, 'line'); assert.equal(r.res[0].level, 'stop'); near(r.res[0].comps.boom, 13.76, 0.01);
  assert.match(await txt('#lfRes'), /The load line comes within 10\.0 ft of "OH 115 kV" in 3D \(at the pick \(hoisting\)\) < D_min = 15 ft/); assert.ok(await p.$('.lfFlags li.lf-stop'));
  assert.deepEqual(await marks(), ['stop']);
  await p.click('#lfSteps summary'); await p.waitForTimeout(100);
  const st = await txt('#lfSteps');
  assert.match(st, /3D clearance: OH 115 kV[\s\S]*Minimum clearance, 115 kV \(over 50 to 200 kV\)[\s\S]*Lowest wire elevation[\s\S]*150\.00[\s\S]*Conductor envelope[\s\S]*Closest 3D distance: load line to "OH 115 kV"[\s\S]*OSHA minimum clearance in 3D[\s\S]*NOT OK/);
  assert.ok(!/NaN|undefined/.test(st));
  // the elevation dock under the map: the section at the pick (boom, load line, load, the wire with its D_min tube), dimensioned
  assert.ok(await p.$('#elevDock svg .crElBoom') && await p.$('#elevDock svg .crElWire') && await p.$('#elevDock svg .crElTube') && await p.$('#elevDock svg .crElLoad'));
  const es = await txt('#elevDock svg'); assert.match(es, /tip el\. 160\.48/); assert.match(es, /θ 61\.0° \(chart\)/); assert.match(es, /OH 115 kV: wire el\. 150\.00, D_min 15 ft/); assert.match(es, /R 30\.00 ft/); assert.match(es, /load bottom el\. 102\.00/);
  await p.selectOption('#elWhich', 'set'); await p.waitForTimeout(150); assert.match(await txt('#elevDock svg'), /tip el\. 165\.06[\s\S]*at the set/); await p.selectOption('#elWhich', 'pick'); await p.waitForTimeout(150);
  await shot('c3-2-power');
  ok('115 kV line, wire el. 150: red, the load line 10.0 ft < D_min 15 ft (boom 13.76 ft), a red marker on the map; worked steps (Table A, z_w, envelope, √(Δx² + Δy² + Δz²), D ≥ D_min)');

  // 2. the item's inputs
  await sel('pl1'); await p.click('#inTabs [data-itab=items]').catch(() => {}); await p.waitForTimeout(150);
  for (const id of ['#itGrade', '#itSag', '#itSway']) assert.ok(await p.$(id), id);
  await setF('#itHeight', 200); r = await c3(); assert.equal(r.res[0].level, 'info'); assert.ok(r.res[0].d > 130 && r.res[0].d < 139.88); assert.deepEqual(await marks(), []);
  assert.ok(r.flags[0].startsWith('info:"OH 115 kV": closest'));
  await setF('#itHeight', 50); await setF('#itSway', 3); r = await c3(); near(r.res[0].d, 7, 1e-9);
  let P = await proj(); assert.deepEqual([P.items[0].height, P.items[0].sway, P.items[0].gradeEl, P.items[0].sag], [50, 3, 100, null]);
  ok('Site items tab: grade, lowest wire, sag, sway; wire at 200 ft: no red flag, the true minimum reported (info); sway 3 ft: 7.0 ft');

  // 3. drag the pick point toward the line
  await p.evaluate(() => CranePickPlace.select(CranePickApp.P.setups[0].id, CranePickApp.P.picks[0].id)); await p.waitForTimeout(150); await settle();
  const a = await scr({ x: 1030, y: 2000 }), c0 = await scr({ x: 1034, y: 2000 });
  await p.mouse.move(a.x, a.y); await p.mouse.down();
  for (let i = 1; i <= 10; i++) { await p.mouse.move(a.x + (c0.x - a.x) * i / 10, a.y); if (i === 5) { await p.waitForTimeout(40); const mid = await c3(); assert.ok(mid.res[0].d < 7, 'closer mid-drag: ' + mid.res[0].d); assert.deepEqual(await marks(), ['stop']); assert.match(await txt('#lfRes'), new RegExp('within ' + mid.res[0].d.toFixed(1).replace('.', '\\.') + ' ft of "OH 115 kV"'));
    const mR = await p.evaluate(() => { const k = CranePickApp.P.picks[0]; return Math.hypot(k.pick.x - 1000, k.pick.y - 2000); }); assert.match(await txt('#elevDock svg'), new RegExp('R ' + mR.toFixed(2).replace('.', '\\.') + ' ft'), 'the elevation follows mid-drag'); } }
  await p.mouse.up(); await p.waitForTimeout(250);
  await settle(); await p.click('#bUndo'); await p.waitForTimeout(200); near((await c3()).res[0].d, 7, 1e-9, 'one undo step');
  ok('pick point dragged toward the line: the 3D distance, the card and the map marker follow mid-drag; one undo step');

  // 4. path model
  await p.evaluate(() => CranePickApp.update(P => { P.items = [CranePickModel.normItem({ id: 'ex1', type: 'excl', name: 'Lane', pts: [{ x: 1016, y: 2016 }, { x: 1019, y: 2016 }, { x: 1019, y: 2019 }, { x: 1016, y: 2019 }] })]; P.picks[0].elev.L = null; P.picks[0].elev.W = null; }, 'items')); await p.waitForTimeout(200);
  r = await c3(); assert.equal(r.res[0].comps.load, 0); assert.match(r.flags.join('|'), /Over the exclusion zone "Lane": boom, load line, load/);
  await p.selectOption('#lsPath', 'luff'); await p.dispatchEvent('#lsPath', 'change'); await p.waitForTimeout(200);
  P = await proj(); assert.equal(P.lift.path, 'luff'); r = await c3(); near(r.res[0].comps.load, Math.hypot(16, 16) - 20, 1e-6); assert.doesNotMatch(r.flags.join('|'), /load \(/);
  assert.match(await txt('#lfSteps'), /Path model \(project setting\): luff at the pick, then swing at the set radius/);
  await settle(); await p.click('#bUndo'); await p.waitForTimeout(200); assert.equal((await proj()).lift.path, 'uniform'); assert.equal(await p.inputValue('#lsPath'), 'uniform');
  await settle(); await p.click('#bRedo'); await p.waitForTimeout(200); assert.equal((await proj()).lift.path, 'luff');
  await settle(); await p.click('#bUndo'); await p.waitForTimeout(200);
  ok('path model: the uniform path takes the load over the exclusion zone (0 ft), luff-then-swing passes 2.63 ft from it (√(16² + 16²) − 20); Undo / Redo');

  // 5. obstruction
  await p.evaluate(() => CranePickApp.update(P => { P.items = [CranePickModel.normItem({ id: 'ob1', type: 'obst', name: 'Pier', height: 25, gradeEl: 100, pts: [{ x: 1015, y: 2010 }, { x: 1025, y: 2010 }, { x: 1025, y: 2020 }, { x: 1015, y: 2020 }] })]; }, 'items')); await p.waitForTimeout(200);
  r = await c3(); assert.equal(r.res[0].level, 'stop'); assert.equal(r.res[0].d, 0); assert.match(r.flags[0], /meets the obstruction "Pier"/);
  await sel('ob1'); await setF('#itHeight', 10); r = await c3(); assert.equal(r.res[0].level, 'ok'); near(r.res[0].d, Math.sqrt(325) - 15, 1e-9, 'counterweight');
  await p.evaluate(() => CranePickPlace.select(CranePickApp.P.setups[0].id, CranePickApp.P.picks[0].id)); await p.waitForTimeout(150);
  await setF('#lsObst', 5); r = await c3(); assert.equal(r.res[0].level, 'warn'); assert.deepEqual(await marks(), ['warn']); assert.match(r.flags[0], /counterweight \(tail swing\) comes within 3\.03 ft of the obstruction "Pier"/);
  ok('obstruction: top 125 above the travel height 120 → contact (red); 10 ft high → the counterweight 3.03 ft governs (OK at 2 ft, amber at 5 ft: a project setting)');

  // 6. Picks tab and Report
  await p.evaluate(() => CranePickApp.update(P => { P.items.push(CranePickModel.normItem({ id: 'pl1', type: 'power', name: 'OH 115 kV', kv: 115, height: 50, gradeEl: 100, pts: [{ x: 1040, y: 1900 }, { x: 1040, y: 2100 }] })); }, 'items')); await p.waitForTimeout(200);
  await p.click('#tabBar [data-otab=picks]'); await p.waitForSelector('#pkTbl');
  const row = await p.$$eval('#pkTbl tbody tr', r => [...r[0].querySelectorAll('td')].map(td => td.innerText.trim()));
  assert.equal(row[18], 'OH 115 kV: 10.0 ft (load line) < D_min 15');   // C8: the Level (terrain) column before it
  await p.click('#tabBar [data-otab=rpt]'); await p.waitForSelector('#rptHost .rp-doc'); await p.waitForTimeout(300);
  const doc = await p.evaluate(() => { const d = CranePickReportUI.view.doc; return { unresolved: d.unresolved, dup: d.dup, text: SharedReport.text(d) }; });
  assert.deepEqual(doc.unresolved, []); assert.deepEqual(doc.dup, []); assert.ok(!/NaN|undefined/.test(doc.text));
  assert.match(doc.text, /3D clearances \(C3-2\): along the path/);
  assert.match(doc.text, /OH 115 kV[\s\S]*15 \(D_min\)[\s\S]*10\.00[\s\S]*load line[\s\S]*at the pick \(hoisting\)[\s\S]*NOT OK/);
  assert.match(doc.text, /3D clearance: OH 115 kV[\s\S]*Closest 3D distance/); assert.match(doc.text, /Elevations[\s\S]*Elevation at the pick \(to scale\)/);
  assert.ok(await p.$$eval('#rptHost .rp-doc svg.crElevSvg', a => a.length) >= 2, 'the elevation figures');
  await shot('c3-2-report');
  ok('Picks tab "Closest 3D": OH 115 kV 10.0 ft (load line) < D_min 15; Report: the 3D basis, the table, the steps; no unresolved keys, no NaN');

  // 7. 390 px
  await p.setViewportSize({ width: 390, height: 800 }); await p.click('#tabBar [data-otab=plan]'); await p.click('#inTabs [data-itab=lifts]'); await p.waitForTimeout(300);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll');
  await shot('c3-2-390');
  ok('390 px: no sideways scroll');
  assert.deepEqual(errs, []); ok('0 console errors');
  console.log(`\n${n} checks passed`);
} catch (e) { console.error('FAIL', e); console.error('console errors:', errs); process.exitCode = 1; }
finally { await b.close(); }
