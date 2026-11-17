#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick): "Align to map (2 points)" for plan sheets (engineer request 2026-11-17). Headless Chromium,
// file://, base map None (the "map" points are site grid points), the generated test sheet (tests/smoke/crane-fixtures.mjs: 2400 x 1600 px,
// the 100 ft dimension from pixel (600, 1200) to (1800, 1200)).
//   1. Add the sheet; "Align to map" from the notice; 4 real clicks (A on the sheet, A′ on the map, B on the sheet, B′ on the map) with
//      Backspace taking back the third; the sheet is faded while a map point is picked; numbered markers (2 styles) and dashed lines;
//      the sheet lands within 0.1 ft of A′ and B′ (s = 100 / 1200 ft/px, rotation 30°);
//   2. dragging the map marker B′ re-solves live (A still on A′, B on the new B′); Done = one undo step (Undo / Redo); the worked steps on
//      the Site tab and in the Report; an item drawn on the sheet moves with it;
//   3. Cancel / Esc leaves the project unchanged; Ctrl+Z while aligning takes back a click (not a project undo);
//   4. a locked sheet asks to unlock (No = nothing starts); a calibrated scale 10 % off: the choice "keep the calibrated scale" (kept);
//   5. 390 px with taps (a touch context): the 4-tap flow lands within 0.1 ft; no sideways scroll; 0 console errors on both pages.
//   SHOTS=<dir> node tests/smoke/crane-align.mjs
import path from 'path';
import fs from 'fs';
import os from 'os';
import assert from 'assert/strict';
import { openPage, REPO, libFor, BLANK_TILE } from '../lib.mjs';
import { makePlan } from './crane-fixtures.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/crane-pick/index.html');
const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'crane-align-'));
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const until = async (f, ms, w) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + w); await new Promise(r => setTimeout(r, 150)); } };
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 860, ls: { 'crane.ui': '{"base":"none","itab":"sheets"}' } });
let reply = [];
p.removeAllListeners('dialog'); p.on('dialog', async d => { const r = reply.shift(); if (r === false) await d.dismiss(); else await d.accept(); });
const PNG = path.join(TMP, 'plan.png');
const projS = pg => pg.evaluate(() => localStorage.getItem('crane.project.current'));
const projNV = async pg => { const o = JSON.parse(await projS(pg)); delete o.view; return JSON.stringify(o); };   // the map view is kept with the project but is not a change
const sheet = async (pg = p) => JSON.parse(await projS(pg)).sheets[0];
const shot = async (nm, pg = p) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
/* centre the map on a grid point at zoom z, then click (or tap) it */
const hitFt = async (pg, ft, tap, z = 23) => {
  const q = await pg.evaluate(([ft, z]) => { const m = CranePickMap.map, ll = CranePickMap.toLL(ft); m.setView(ll, z, { animate: false }); const c = m.latLngToContainerPoint(ll), r = m.getContainer().getBoundingClientRect(); return { x: r.x + c.x, y: r.y + c.y }; }, [ft, z]);
  if (tap) await pg.touchscreen.tap(q.x, q.y); else await pg.mouse.click(q.x, q.y); await pg.waitForTimeout(150);
};
const hitPx = async (pg, px, py, tap) => hitFt(pg, await pg.evaluate(([px, py]) => CranePickGeo.pxToFt(CranePickApp.P.sheets[0].place, px, py), [px, py]), tap);
const status = pg => pg.textContent('#mbStatus');
const lands = (pl, px, py) => p.evaluate(([pl, px, py]) => CranePickGeo.pxToFt(pl, px, py), [pl, px, py]);
/* targets: A′ 300 ft east / 200 ft north of the sheet's centre, B′ 100 ft from A′ at 30° CCW from grid east */
const targets = pg => pg.evaluate(() => { const s = CranePickApp.P.sheets[0], c = CranePickGeo.pxToFt(s.place, s.w / 2, s.h / 2), A = { x: c.x + 300, y: c.y + 200 };
  return [A, { x: A.x + 100 * Math.cos(Math.PI / 6), y: A.y + 100 * Math.sin(Math.PI / 6) }]; });
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(500);
  await makePlan(p, PNG);
  // 1. add, align from the notice, 4 clicks (+ Backspace)
  await p.setInputFiles('#shFile', PNG); await until(async () => !!(await sheet()), 5000, 'sheet added');
  await until(() => p.evaluate(() => !!document.querySelector('img.crSheet')), 5000, 'img');
  const pl0 = (await sheet()).place, [TA, TB] = await targets(p);
  await p.evaluate(() => CranePickApp.update(P => { P.items.push(CranePickModel.normItem({ id: 'it1', type: 'label', text: 'On the sheet', pts: [CranePickGeo.pxToFt(P.sheets[0].place, 1200, 800)] })); }, 'items'));   // an item drawn on the sheet
  await p.click('#notices button:has-text("Align to map")'); await p.waitForTimeout(150);
  assert.match(await status(p), /Align to map 1\/4: Click point A on the sheet/);
  assert.match(await p.textContent('[data-pane=sheets]'), /A on the sheet[\s\S]*A′ on the map[\s\S]*B on the sheet[\s\S]*B′ on the map/);
  await hitPx(p, 600, 1200);
  assert.match(await status(p), /2\/4: Click the same point A on the site grid/);
  assert.equal(await p.$eval('img.crSheet', e => e.style.opacity), '0.15', 'faded while a map point is picked');
  await hitFt(p, TA);
  assert.equal(await p.$eval('img.crSheet', e => e.style.opacity), '0.8', 'opacity back for the sheet click');
  await p.evaluate(() => CranePickSheets.fitSheet(CranePickApp.P.sheets[0].id)); await p.waitForTimeout(200);
  await hitPx(p, 1500, 300);   // a wrong B ...
  assert.match(await status(p), /4\/4/); await p.keyboard.press('Backspace'); await p.waitForTimeout(100);
  assert.match(await status(p), /3\/4: Click point B on the sheet/, 'Backspace took back the last click');
  await hitPx(p, 1800, 1200);
  await p.evaluate(([a, b]) => CranePickMap.fit([a, b, CranePickGeo.pxToFt(CranePickApp.P.sheets[0].place, 1200, 800)]), [TA, TB]); await p.waitForTimeout(150);
  await shot('align-step4-1280');
  assert.equal(await p.$$eval('.crAl.crAlS', a => a.length), 2); assert.equal(await p.$$eval('.crAl.crAlM', a => a.length), 1);
  assert.equal(await p.$$eval('path[stroke-dasharray="6 5"]', a => a.length), 1, 'dashed line A -> A′');
  await hitFt(p, TB);
  let pl = await p.evaluate(() => CranePickApp.P.sheets[0].place);
  let a = await lands(pl, 600, 1200), bb = await lands(pl, 1800, 1200);
  near(a.x, TA.x, 0.1, 'A x'); near(a.y, TA.y, 0.1, 'A y'); near(bb.x, TB.x, 0.1, 'B x'); near(bb.y, TB.y, 0.1, 'B y');
  near(pl.s, 1 / 12, 1e-4, 's'); near(pl.rot * 180 / Math.PI, 30, 0.05, 'rotation');
  assert.match(await status(p), /Aligned[\s\S]*ft per image px[\s\S]*rotation (29\.9|30\.0)\d+° CCW[\s\S]*sheet up → N (29|30)°[\s\S]*A–B: 1,(19\d|20\d)\.\d px on the sheet[\s\S]*100\.\d\d ft on the map/);
  assert.equal(await p.$$eval('.crAl', a => a.length), 4); assert.equal(await p.$$eval('path[stroke-dasharray="6 5"]', a => a.length), 2);
  assert.equal(await p.$eval('img.crSheet', e => e.style.opacity), '0.8');
  assert.deepEqual((await sheet()).place, pl0, 'not saved before Done');
  await p.evaluate(([a, b]) => CranePickMap.fit([a, b]), [TA, TB]); await p.waitForTimeout(200); await shot('align-solved-1280');
  ok(`4 clicks (Backspace took back a wrong B): the sheet faded for the map clicks; A lands ${Math.hypot(a.x - TA.x, a.y - TA.y).toFixed(3)} ft and B ${Math.hypot(bb.x - TB.x, bb.y - TB.y).toFixed(3)} ft from their targets; s = ${pl.s.toFixed(6)} ft/px, rotation ${(pl.rot * 180 / Math.PI).toFixed(3)}°`);

  // 2. drag the map marker B′, Done, undo / redo, worked steps, an item moves with the sheet
  const box = await p.$$eval('.crAl.crAlM span', a => a.map(e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
  await p.mouse.move(box[1].x, box[1].y); await p.mouse.down(); for (let k = 1; k <= 10; k++) await p.mouse.move(box[1].x + 4 * k, box[1].y + 2 * k); await p.mouse.up(); await p.waitForTimeout(250);
  const al = await p.evaluate(() => { const a = CranePickSheets.align; return { sp: a.sp, mp: a.mp }; });
  assert.ok(Math.hypot(al.mp[1].x - TB.x, al.mp[1].y - TB.y) > 1, 'B′ moved');
  pl = await p.evaluate(() => CranePickApp.P.sheets[0].place);
  a = await lands(pl, al.sp[0].px, al.sp[0].py); bb = await lands(pl, al.sp[1].px, al.sp[1].py);
  near(a.x, al.mp[0].x, 1e-6); near(a.y, al.mp[0].y, 1e-6); near(bb.x, al.mp[1].x, 1e-6, 'B on the dragged B′'); near(bb.y, al.mp[1].y, 1e-6);
  // the sheet marker A (its box hangs below-left of the point, so it can be grabbed under A′): re-picks A on the sheet; A still lands on A′
  const sb = await p.$$eval('.crAl.crAlS span', a => a.map(e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
  await p.mouse.move(sb[0].x, sb[0].y); await p.mouse.down(); for (let k = 1; k <= 10; k++) await p.mouse.move(sb[0].x - 3 * k, sb[0].y + 2 * k); await p.mouse.up(); await p.waitForTimeout(250);
  const al2 = await p.evaluate(() => { const a = CranePickSheets.align; return { sp: a.sp, mp: a.mp }; });
  assert.ok(Math.hypot(al2.sp[0].px - al.sp[0].px, al2.sp[0].py - al.sp[0].py) > 1, 'A re-picked on the sheet'); assert.deepEqual(al2.mp, al.mp);
  pl = await p.evaluate(() => CranePickApp.P.sheets[0].place); a = await lands(pl, al2.sp[0].px, al2.sp[0].py); near(a.x, al.mp[0].x, 1e-6, 'new A on A′'); near(a.y, al.mp[0].y, 1e-6);
  await p.keyboard.press('Backspace'); await p.waitForTimeout(100); await p.evaluate(([a, b]) => CranePickMap.fit([a, b]), [TA, TB]); await p.waitForTimeout(150);
  assert.match(await status(p), /4\/4/); await hitFt(p, al.mp[1]); al.sp = al2.sp; pl = await p.evaluate(() => CranePickApp.P.sheets[0].place);
  assert.match(await status(p), /Aligned/);
  const before = await projS(p), itBefore = JSON.parse(before).items.find(i => i.id === 'it1');
  await p.click('#alDone'); await p.waitForTimeout(250);
  let s = await sheet(); assert.equal(s.basis, 'align'); assert.deepEqual(s.place, pl); assert.equal(s.align.keep, 'pts');
  near(s.align.m2.x, al.mp[1].x, 1e-9); assert.equal(await p.$$eval('.crAl', a => a.length), 0, 'markers gone after Done'); assert.equal(await status(p), '');
  const it = JSON.parse(await projS(p)).items.find(i => i.id === 'it1'), itx = await p.evaluate(([o, nw, q]) => CranePickGeo.placementMove(o, nw)(q), [pl0, pl, itBefore.pts[0]]);
  near(it.pts[0].x, itx.x, 1e-6, 'item moved with the sheet'); near(it.pts[0].y, itx.y, 1e-6);
  assert.match(await p.textContent('[data-pane=sheets]'), /aligned to map/);
  await p.click('#tabBar [data-otab=site]'); await p.waitForTimeout(150);
  assert.match(await p.textContent('[data-opane=site]'), /aligned to the map \(two points: sheet → map\)[\s\S]*Align to map \(two points: sheet → map\)[\s\S]*Distance A–B on the sheet[\s\S]*Sheet scale from the two points[\s\S]*Sheet rotation[\s\S]*Grid y of sheet pixel \(0, 0\)/);
  await p.click('#tabBar [data-otab=rpt]'); await p.waitForSelector('#rptHost .rp-doc');
  assert.match(await p.textContent('#rptHost .rp-doc'), /Plan sheets[\s\S]*Align to map[\s\S]*Distance A′–B′ on the map/);
  assert.deepEqual(await p.evaluate(() => { const d = SharedReport.build(CranePickReport.model(CranePickApp.P)); return d.unresolved.concat(d.dup); }), []);
  await p.click('#tabBar [data-otab=plan]'); await p.waitForTimeout(450);
  await p.click('#bUndo'); await p.waitForTimeout(200); s = await sheet(); assert.deepEqual(s.place, pl0, 'one undo step back to the placement before'); assert.equal(s.basis, 'none');
  assert.deepEqual(JSON.parse(await projS(p)).items.find(i => i.id === 'it1').pts, itBefore.pts, 'the item back too');
  await p.waitForTimeout(450); await p.click('#bRedo'); await p.waitForTimeout(200); s = await sheet(); assert.deepEqual(s.place, pl); assert.equal(s.basis, 'align');
  await shot('align-done-1280');
  ok('dragging the map marker B′ re-solves live (A on A′, B on the new B′); dragging the sheet marker A re-picks A (still on A′); Backspace after the fourth click; Done = one undo step (Undo back to the placement before, Redo); the item on the sheet moved with it; worked steps on the Site tab and in the Report');

  // 3. cancel / Esc / Ctrl+Z while aligning
  let snap = await projNV(p);
  await p.click('[data-a=align]'); await hitPx(p, 600, 1200); await hitFt(p, { x: TA.x + 50, y: TA.y });
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100); assert.match(await status(p), /2\/4/, 'Ctrl+Z took back a click'); assert.equal(await projNV(p), snap, 'not a project undo');
  await hitFt(p, { x: TA.x + 50, y: TA.y }); await p.evaluate(() => CranePickSheets.fitSheet(CranePickApp.P.sheets[0].id)); await hitPx(p, 1800, 1200); await hitFt(p, { x: TA.x + 50, y: TA.y + 80 });
  assert.match(await status(p), /Aligned/); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  assert.equal(await projNV(p), snap, 'Esc: the project unchanged'); assert.deepEqual(await p.evaluate(() => CranePickApp.P.sheets[0].place), (await sheet()).place, 'the sheet back where it was');
  assert.equal(await p.$$eval('.crAl', a => a.length), 0);
  await p.click('[data-a=align]'); await hitPx(p, 600, 1200); await p.click('#alCancel'); await p.waitForTimeout(100); assert.equal(await projNV(p), snap, 'Cancel: unchanged'); assert.equal(await status(p), '');
  ok('Esc after four clicks and Cancel leave the project and the sheet unchanged; Ctrl+Z while aligning takes back the last click (no project undo)');

  // 4. locked sheet; calibrated scale 10 % off -> keep the calibrated scale
  await p.check('[data-t=locked]'); await p.waitForTimeout(100);
  reply = [false]; await p.click('[data-a=align]'); await p.waitForTimeout(100); assert.equal(await status(p), '', 'No: nothing starts');
  await p.evaluate(() => CranePickApp.update(() => { CranePickApp.P.sheets[0].cal = { p1: { px: 600, py: 1200 }, p2: { px: 1800, py: 1200 }, dist: 110 }; }, 'sheets'));
  reply = [true]; await p.click('[data-a=align]'); await p.waitForTimeout(100); assert.match(await status(p), /1\/4/);
  const [UA, UB] = await targets(p);
  await hitPx(p, 600, 1200); await hitFt(p, UA); await p.evaluate(() => CranePickSheets.fitSheet(CranePickApp.P.sheets[0].id)); await hitPx(p, 1800, 1200); await hitFt(p, UB);
  assert.match(await status(p), /10\.0 % less than the calibrated scale/);
  await p.check('input[name=alKeep][value=ref]'); await p.waitForTimeout(150);
  pl = await p.evaluate(() => CranePickApp.P.sheets[0].place); near(pl.s, 110 / 1200, 1e-4, 'calibrated scale kept'); near(pl.rot * 180 / Math.PI, 30, 0.1, "rotation (clicks at zoom 23)");
  const mid = await lands(pl, 1200, 1200); near(mid.x, (UA.x + UB.x) / 2, 0.1, 'about the A–B midpoint'); near(mid.y, (UA.y + UB.y) / 2, 0.1);
  await p.evaluate(([a, b]) => CranePickMap.fit([a, b]), [UA, UB]); await p.waitForTimeout(150); await shot('align-card-1280');
  await p.click('[data-a=alDone]'); await p.waitForTimeout(200); s = await sheet(); assert.equal(s.locked, false, 'unlocked'); assert.equal(s.align.keep, 'ref'); near(s.place.s, 110 / 1200, 1e-4);
  await p.click('#tabBar [data-otab=site]'); await p.waitForTimeout(150);
  assert.match(await p.textContent('[data-opane=site]'), /Scale calibration \(a check: the map alignment governs\)[\s\S]*Check against the calibrated \/ plan scale[\s\S]*Scale kept/);
  await p.click('#tabBar [data-otab=plan]');
  ok('a locked sheet asks to unlock (No: nothing starts; Yes: unlocked at Done); a calibration 10 % off is reported and "keep the calibrated scale" keeps it (rotation and position from the points, about the A–B midpoint)');
  assert.deepEqual(errs, []);

  // 5. 390 px, taps
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx2.route('**/*', r => { const u = r.request().url(); if (/^(file|data|about|blob):/.test(u)) return r.continue(); const f = libFor(u);
    if (f && fs.existsSync(f)) return r.fulfill({ path: f, headers: { 'Access-Control-Allow-Origin': '*' } }); if (/tile|arcgisonline|openstreetmap/.test(u)) return r.fulfill({ body: BLANK_TILE, contentType: 'image/png' }); if (/^https?:\/\/fonts\.(googleapis|gstatic)\.com/.test(u)) return r.fulfill({ body: '', contentType: 'text/css' }); return r.abort(); });
  const q = await ctx2.newPage(), errs2 = [];
  q.on('console', m => { if (m.type() === 'error') errs2.push(m.text().slice(0, 300)); }); q.on('pageerror', e => errs2.push('pageerror: ' + e.message));
  await q.goto('file://' + FILE); await q.evaluate(() => { localStorage.clear(); localStorage.setItem('crane.ui', '{"base":"none","itab":"sheets"}'); }); await q.reload();
  await q.waitForSelector('[data-sp=chip]'); await q.waitForTimeout(500);
  await q.setInputFiles('#shFile', PNG); await until(async () => !!(await sheet(q)), 5000, 'sheet (390)');
  const [VA, VB] = await targets(q);
  await q.evaluate(() => CranePickSheets.startAlign(CranePickApp.P.sheets[0].id)); await q.waitForTimeout(150);
  await q.evaluate(() => document.getElementById('map').scrollIntoView()); await q.waitForTimeout(150);
  await hitPx(q, 600, 1200, true); await hitFt(q, VA, true);
  await q.evaluate(() => CranePickSheets.fitSheet(CranePickApp.P.sheets[0].id)); await hitPx(q, 1800, 1200, true); await hitFt(q, VB, true);
  assert.match(await status(q), /Aligned/);
  await q.evaluate(([a, b]) => CranePickMap.fit([a, b]), [VA, VB]); await q.waitForTimeout(200); await shot('align-390', q);
  assert.ok(await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at 390 px');
  await q.tap('#alDone'); await q.waitForTimeout(200);
  const s2 = await sheet(q), a2 = await lands(s2.place, 600, 1200), b2 = await lands(s2.place, 1800, 1200);
  near(a2.x, VA.x, 0.1, '390 A'); near(a2.y, VA.y, 0.1); near(b2.x, VB.x, 0.1, '390 B'); near(b2.y, VB.y, 0.1); assert.equal(s2.basis, 'align');
  await q.evaluate(() => document.getElementById('inputPanel').scrollIntoView()); await q.waitForTimeout(100); await shot('align-390-card', q);
  assert.ok(await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errs2, []);
  ok(`390 px (touch): four taps and Done land A ${Math.hypot(a2.x - VA.x, a2.y - VA.y).toFixed(3)} ft and B ${Math.hypot(b2.x - VB.x, b2.y - VB.y).toFixed(3)} ft from their targets; no sideways scroll; 0 console errors on both pages`);
} finally { await b.close(); fs.rmSync(TMP, { recursive: true, force: true }); }
console.log(`crane-align: ${n} checks ok`);
