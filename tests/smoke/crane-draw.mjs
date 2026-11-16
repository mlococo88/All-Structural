#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), C1-3: the site items. Headless Chromium, file://, CDN libraries from tests/libs, base map None.
//   1. the Draw bar (7 tools) and the Site items tab;
//   2. a power line drawn by clicks (Enter ends it): voltage -> 29 CFR 1926.1408 Table A clearance (13.8 kV 10 ft, 115 kV 15 ft, 345 kV 20 ft,
//      500 kV 25 ft, 765 kV 45 ft; not known 50 ft, "350 kV or less" 20 ft; 1,200 kV: entered by the user), drawn as a plan buffer;
//   3. an obstruction closed by a click on its first point (area = shoelace of the stored points), height; a dimension (2 clicks) with the
//      live distance / bearing while the cursor moves; utility line and area (kind, depth), exclusion zone, label;
//   4. dragging: a vertex handle (the computed values follow live, one undo step), the item body (desktop), the ✥ handle, a "+" handle adds
//      a point, a double-click removes one; vertex coordinates typed in the table; Delete key, × button, Undo;
//      drag updates are throttled to animation frames (live events <= frames);
//   5. a plan sheet georeferenced with "move the items drawn on it": the items on it keep their place on the sheet; a zone change keeps
//      every item at the same latitude / longitude;
//   6. Save / reload keeps the items; Site tab tables and worked steps; Report (site plan figure, OSHA note, steps; no unresolved keys, no NaN);
//   7. 390 px: no sideways scroll; drawing by taps; 0 console errors.
//   SHOTS=<dir> node tests/smoke/crane-draw.mjs
import path from 'path';
import fs from 'fs';
import os from 'os';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';
import { makePlan } from './crane-fixtures.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/crane-pick/index.html');
const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'crane-draw-'));
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 860, ls: { 'crane.ui': '{"base":"none","itab":"draw"}' } });
let reply = [];
p.removeAllListeners('dialog'); p.on('dialog', async d => { const r = reply.shift(); if (r === false) await d.dismiss(); else await d.accept(typeof r === 'string' ? r : undefined); });
const proj = () => p.evaluate(() => JSON.parse(localStorage.getItem('crane.project.current')));
const items = async () => (await proj()).items;
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
let box = null; const mapBox = async () => { box = await p.$eval('#map', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }); };
const c = async (x, y) => { await p.mouse.click(box.x + x, box.y + y); await p.waitForTimeout(60); };
const tool = async k => { await p.click(`#mapBar [data-tool=${k}]`); await p.waitForTimeout(60); };
const setF = async (sel, v) => { await p.fill(sel, String(v)); await p.dispatchEvent(sel, 'change'); await p.waitForTimeout(80); };
const scr = (pt) => p.evaluate(q => { const m = CranePickMap.map, cp = m.latLngToContainerPoint(CranePickMap.toLL(q)), r = m.getContainer().getBoundingClientRect(); return { x: r.x + cp.x, y: r.y + cp.y }; }, pt);
const clr = () => p.$eval('#itClr', e => e.textContent.replace(/\s+/g, ' '));
const settle = () => p.waitForTimeout(450);   // shared/projects.js history: 400 ms after an undo / redo the next change is not a step
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(400);
  await p.evaluate(() => CranePickMap.map.setZoom(19)); await p.waitForTimeout(200); await mapBox();
  // 1.
  assert.deepEqual(await p.$$eval('#mapBar [data-tool]', a => a.map(x => x.textContent.trim().replace(/^\S+\s/, ''))), ['Obstruction', 'Power line', 'Utility (line)', 'Utility (area)', 'Exclusion zone', 'Label', 'Dimension']);
  assert.deepEqual(await p.$$eval('#inTabs [data-itab]', a => a.map(x => x.textContent)), ['Project', 'Site & map', 'Plan sheets', 'Site items']);
  ok('Draw bar with 7 tools above the map; input tabs Project · Site & map · Plan sheets · Site items');

  // 2. power line and Table A
  await tool('power'); assert.match(await p.textContent('#mbStatus'), /Power line: click point 1/);
  await c(100, 120); await c(400, 160); await p.mouse.move(box.x + 650, box.y + 140); await p.waitForTimeout(100);
  assert.match(await p.textContent('#mbStatus'), /[\d,.]+ ft · [NS] \d+°\d\d′\d\d″ [EW] · total [\d,.]+ ft/);
  await c(700, 140); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  let it = (await items())[0]; assert.equal(it.type, 'power'); assert.equal(it.pts.length, 3); assert.equal(it.kv, null);
  assert.match(await clr(), /Dmin = 50 ft.*voltage not known/);
  for (const [kv, ft] of [[13.8, 10], [115, 15], [345, 20], [500, 25], [765, 45], [50, 10], [50.5, 15]]) { await setF('#itKv', kv); assert.match(await clr(), new RegExp(`Dmin = ${ft} ft`), kv + ' kV'); assert.match(await clr(), /1926\.1408 Table A/); }
  await setF('#itKv', ''); await p.check('#itLe350'); await p.dispatchEvent('#itLe350', 'change'); await p.waitForTimeout(80); assert.match(await clr(), /Dmin = 20 ft.*1926\.1408\(a\)\(2\)\(ii\)/);
  await setF('#itKv', 1200); assert.match(await clr(), /not set/); assert.ok(await p.$('#itClr.bad')); await setF('#itSetFt', 60); assert.match(await clr(), /Dmin = 60 ft/);
  await setF('#itKv', 13.8); assert.match(await clr(), /Dmin = 10 ft/);
  const rings = await p.evaluate(id => { const g = CranePickDraw.layers.get(id); return g.buf.getLatLngs().length; }, it.id); assert.equal(rings, 5, '3 vertex circles + 2 segment strips');
  const bufFt = await p.evaluate(id => { const g = CranePickDraw.layers.get(id), it = CranePickApp.P.items.find(i => i.id === id), ring = g.buf.getLatLngs()[0];   // the first vertex circle: radius = D_min
    return ring.map(ll => CranePickMap.toFt(ll)).map(q => Math.hypot(q.x - it.pts[0].x, q.y - it.pts[0].y)); }, it.id);
  bufFt.forEach(r => near(r, 10, 1e-6, 'buffer radius'));
  await setF('#itName', 'OH 13.8 kV (Eversource)');
  ok('power line by clicks (live distance / bearing while drawing); Table A: 13.8 → 10, 50 → 10, 50.5 → 15, 115 → 15, 345 → 20, 500 → 25, 765 → 45 ft; not known 50 ft; "≤ 350 kV" 20 ft; 1,200 kV needs the utility / RPE value; buffer radius = D_min');

  // 3. obstruction, dimension, utilities, exclusion zone, label
  await tool('obst'); await c(200, 300); await c(320, 300); await c(320, 420); await c(200, 420); await c(201, 301);   // the 5th click near the first point closes it
  it = (await items())[1]; assert.equal(it.type, 'obst'); assert.equal(it.pts.length, 4);
  const shoe = pts => Math.abs(pts.reduce((a, q, i) => { const r = pts[(i + 1) % pts.length]; return a + q.x * r.y - r.x * q.y; }, 0) / 2);
  assert.match(await p.textContent('#itMeas'), new RegExp('Area ' + shoe(it.pts).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })));
  await setF('#itHeight', 35); await setF('#itName', 'Pier 2');
  await tool('dim'); await c(150, 500); await p.mouse.move(box.x + 420, box.y + 540); await p.waitForTimeout(80); assert.match(await p.textContent('#mbStatus'), /ft · [NS] /); await c(500, 560);
  it = (await items())[2]; assert.equal(it.type, 'dim');
  const L = Math.hypot(it.pts[1].x - it.pts[0].x, it.pts[1].y - it.pts[0].y); assert.match(await p.textContent('#itMeas'), new RegExp('L = ' + L.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ft'));
  await tool('utilL'); await c(50, 620); await c(800, 650); await p.click('#mapBar [data-tb=finish]'); await p.waitForTimeout(100);
  await p.selectOption('#itKind', 'culvert'); await p.waitForTimeout(80); await setF('#itDepth', 6.5); await setF('#itSize', 8);
  await tool('utilA'); await c(560, 600); await c(700, 600); await c(700, 680); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  await setF('#itDepth', 4); await setF('#itName', 'Retaining wall footing');
  await tool('excl'); await c(450, 300); await c(600, 280); await c(620, 420); await p.mouse.dblclick(box.x + 480, box.y + 440); await p.waitForTimeout(150);
  await setF('#itReason', 'Route 6 travel lane');
  await tool('label'); await c(650, 520); await p.waitForTimeout(100); await setF('#itText', 'CRANE PAD (C2)');
  const all = await items(); assert.deepEqual(all.map(i => i.type), ['power', 'obst', 'dim', 'util', 'util', 'excl', 'label']);
  assert.equal(all[3].kind, 'culvert'); assert.equal(all[3].closed, false); assert.equal(all[3].depth, 6.5); assert.equal(all[4].closed, true); assert.equal(all[5].pts.length, 4); assert.equal(all[6].text, 'CRANE PAD (C2)');
  assert.equal(await p.$eval('.crLabel span', e => e.textContent), 'CRANE PAD (C2)');
  // the selected label is dragged by its text
  const lb0 = (await items())[6].pts[0], lt = await p.$eval('.crLabel span', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.move(lt.x, lt.y); await p.mouse.down(); for (let k = 1; k <= 6; k++) await p.mouse.move(lt.x + 5 * k, lt.y + 3 * k); await p.mouse.up(); await p.waitForTimeout(200);
  const lb1 = (await items())[6].pts[0]; assert.ok(Math.hypot(lb1.x - lb0.x, lb1.y - lb0.y) > 5, 'label dragged by its text'); assert.equal(await p.$$eval('.crItemMove', a => a.length), 0, 'no ✥ over a label');
  await shot('c1-draw-1280');
  ok('obstruction closed by a click on its first point (area = shoelace), dimension (live, then L), culvert line (depth, size), buried area, exclusion zone (double-click ends), label');

  // 4. dragging and editing
  const obst = all[1]; await p.click(`[data-sel="${obst.id}"]`); await p.waitForTimeout(200); await settle();
  const v0 = await scr(obst.pts[1]);
  let lives = 0, frames = 0; await p.evaluate(() => { window.__cr = { l: 0, f: 0, on: true }; CranePickApp.on('live', () => { window.__cr.l++; }); const tick = () => { if (!window.__cr.on) return; window.__cr.f++; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  const meas0 = await p.textContent('#itMeas');
  await p.mouse.move(v0.x, v0.y); await p.mouse.down(); for (let k = 1; k <= 20; k++) await p.mouse.move(v0.x + 3 * k, v0.y - 2 * k);
  await p.waitForTimeout(60); const measMid = await p.textContent('#itMeas'); await p.mouse.up(); await p.waitForTimeout(200);
  ({ l: lives, f: frames } = await p.evaluate(() => { window.__cr.on = false; return window.__cr; }));
  assert.notEqual(measMid, meas0, 'the area follows during the drag'); assert.ok(lives > 0 && lives <= frames + 1, `live updates ${lives} <= animation frames ${frames}`);
  let o1 = (await items())[1]; assert.ok(Math.hypot(o1.pts[1].x - obst.pts[1].x, o1.pts[1].y - obst.pts[1].y) > 10); assert.deepEqual(o1.pts[0], obst.pts[0]);
  await p.click('#bUndo'); await p.waitForTimeout(200); assert.deepEqual((await items())[1].pts, obst.pts, 'one undo step'); await settle();
  // the body (desktop)
  const ctr = await scr({ x: (obst.pts[0].x + obst.pts[2].x) / 2 + 15, y: (obst.pts[0].y + obst.pts[2].y) / 2 + 15 });
  await p.mouse.move(ctr.x, ctr.y); await p.mouse.down(); for (let k = 1; k <= 10; k++) await p.mouse.move(ctr.x + 8 * k, ctr.y + 4 * k); await p.mouse.up(); await p.waitForTimeout(200);
  o1 = (await items())[1]; const dx = o1.pts[0].x - obst.pts[0].x, dy = o1.pts[0].y - obst.pts[0].y; assert.ok(Math.hypot(dx, dy) > 5, 'moved by its body');   // the list click zoomed the map to the item: 80 px is about 15 ft
  o1.pts.forEach((q, i) => { near(q.x - obst.pts[i].x, dx, 1e-6); near(q.y - obst.pts[i].y, dy, 1e-6); });
  await p.click('#bUndo'); await p.waitForTimeout(200); assert.deepEqual((await items())[1].pts, obst.pts); await settle();
  // the ✥ handle
  const mv = await p.$eval('.crItemMove span', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.move(mv.x, mv.y); await p.mouse.down(); for (let k = 1; k <= 8; k++) await p.mouse.move(mv.x - 6 * k, mv.y + 5 * k); await p.mouse.up(); await p.waitForTimeout(200);
  o1 = (await items())[1]; assert.ok(Math.hypot(o1.pts[0].x - obst.pts[0].x, o1.pts[0].y - obst.pts[0].y) > 10, 'moved by the ✥ handle');
  await p.click('#bUndo'); await p.waitForTimeout(200); await settle();
  // "+" adds a vertex, double-click removes it
  const mid = await p.$eval('.crVxM span', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.move(mid.x, mid.y); await p.mouse.down(); for (let k = 1; k <= 6; k++) await p.mouse.move(mid.x, mid.y - 6 * k); await p.mouse.up(); await p.waitForTimeout(250);
  assert.equal((await items())[1].pts.length, 5, '"+" handle: a fifth point'); assert.equal(await p.evaluate(() => CranePickDraw.selected), obst.id, 'still selected after the drag'); await settle();
  const v5 = await scr((await items())[1].pts[1]); await p.mouse.dblclick(v5.x, v5.y); await p.waitForTimeout(250);
  assert.equal((await items())[1].pts.length, 4, 'double-click removes it'); assert.deepEqual((await items())[1].pts, obst.pts); await settle();
  // coordinates typed
  await p.fill('[data-vx="0"][data-c=E]', '775400.00'); await p.dispatchEvent('[data-vx="0"][data-c=E]', 'change'); await p.waitForTimeout(150);
  near((await items())[1].pts[0].x, 775400, 1e-9, 'typed easting'); await p.click('#bUndo'); await p.waitForTimeout(200); await settle();
  // delete: key, × button, undo
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('Delete'); await p.waitForTimeout(150);
  assert.equal((await items()).length, 6); await p.click('#bUndo'); await p.waitForTimeout(200); assert.equal((await items()).length, 7); await settle();
  await p.click(`[data-del="${all[6].id}"]`); await p.waitForTimeout(150); assert.equal((await items()).length, 6); await p.click('#bUndo'); await p.waitForTimeout(200); assert.equal((await items()).length, 7); await settle();
  ok(`vertex drag (values follow live; ${lives} redraws in ${frames} frames; one undo step), body drag, ✥ handle, "+" adds and double-click removes a point, typed coordinates, Delete key and × with Undo`);

  // 5. sheet georeference moves the items on it; zone change
  const PNG = path.join(TMP, 'plan.png'); await makePlan(p, PNG);
  await p.click('#inTabs [data-itab=sheets]'); await p.setInputFiles('#shFile', PNG); await p.waitForFunction(() => CranePickApp.P.sheets.length === 1);
  await p.click('[data-a=fit]'); await p.waitForTimeout(300);
  // a new obstruction drawn on the sheet: its points' sheet pixels
  await mapBox(); await tool('obst'); await c(box.w / 2 - 40, box.h / 2 - 40); await c(box.w / 2 + 40, box.h / 2 - 40); await c(box.w / 2 + 40, box.h / 2 + 40); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  const onSheet = (await items()).at(-1), pxOf = (pl, q) => p.evaluate(([pl, q]) => CranePickGeo.ftToPx(pl, q.x, q.y), [pl, q]);
  const sh0 = (await proj()).sheets[0], px0 = await Promise.all(onSheet.pts.map(q => pxOf(sh0.place, q)));
  const farBefore = (await items())[0].pts;
  await p.click('#inTabs [data-itab=sheets]'); await p.click('[data-a=geo]'); await p.waitForTimeout(100);
  const at = (px, py) => p.evaluate(([px, py]) => { const s = CranePickApp.P.sheets[0], m = CranePickMap.map, q = m.latLngToContainerPoint(CranePickMap.toLL(CranePickGeo.pxToFt(s.place, px, py))), r = m.getContainer().getBoundingClientRect(); return { x: r.x + q.x, y: r.y + q.y }; }, [px, py]);
  for (const [x, y] of [[600, 1200], [1800, 1200]]) { const q = await at(x, y); await p.mouse.click(q.x, q.y); await p.waitForTimeout(120); }
  await p.fill('#gE1', '780000'); await p.fill('#gN1', '2950000'); await p.fill('#gE2', '780086.6025'); await p.fill('#gN2', '2950050'); await p.click('[data-a=geoApply]'); await p.waitForTimeout(300);
  const sh1 = (await proj()).sheets[0], moved = (await items()).find(i => i.id === onSheet.id), px1 = await Promise.all(moved.pts.map(q => pxOf(sh1.place, q)));
  px1.forEach((q, i) => { near(q.px, px0[i].px, 1e-6, 'item keeps its sheet pixel'); near(q.py, px0[i].py, 1e-6); });
  assert.deepEqual((await items())[0].pts, farBefore, 'an item off the sheet stays');
  const nMoved = +(/(\d+) items? drawn on it moved with it/.exec(await p.textContent('#shGeo')) || [])[1];   // every item wholly on the sheet's (first, large) footprint
  assert.ok(nMoved >= 1 && nMoved < (await items()).length, 'moved ' + nMoved);
  const llOf = q => p.evaluate(q => { const r = CranePickGeo.ftToLl(proj4, CranePickApp.P.site.zone, q.x, q.y); return r; }, q);
  const ll0 = await llOf((await items())[1].pts[0]);
  await p.click('#inTabs [data-itab=site]'); await p.selectOption('#stZone', 'EPSG:26986'); await p.waitForTimeout(200);
  const ll1 = await llOf((await items())[1].pts[0]); near(ll1.lat, ll0.lat, 1e-9); near(ll1.lng, ll0.lng, 1e-9);
  await p.click('#inTabs [data-itab=draw]'); await p.click(`[data-sel="${(await items())[1].id}"]`); await p.waitForTimeout(100);
  assert.match(await p.textContent('#itCard'), /Coordinates \(MA Mainland \(m\), m\)/);
  await p.click('#bUndo'); await p.waitForTimeout(200); assert.equal((await proj()).site.zone, 'EPSG:2249'); await settle();
  ok('georeference with "move the items drawn on it": the items on the sheet keep their sheet pixels, one off the sheet stays; a zone change keeps every item at the same lat / long (coordinates shown in metres)');

  // 6. save / reload, Site, Report
  await p.click('#inTabs [data-itab=proj]'); await p.evaluate(() => SharedProjectsUI.bars[0].saveAs()); await p.waitForSelector('dialog.spSave[open]'); await p.fill('dialog.spSave .spName', 'Draw smoke'); await p.click('dialog.spSave [data-sa=ok]'); await p.waitForTimeout(200);
  const saved = JSON.parse(await p.evaluate(() => localStorage.getItem('crane.projects.v1')))['Draw smoke']; assert.equal(saved.items.length, 8);
  await p.reload(); await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(500);
  assert.equal((await items()).length, 8); assert.equal(await p.evaluate(() => CranePickDraw.layers.size), 8);
  await p.click('#tabBar [data-otab=site]'); await p.waitForTimeout(200);
  const st = await p.textContent('[data-opane=site]');
  assert.match(st, /Power line \(1\)[\s\S]*OH 13\.8 kV \(Eversource\)[\s\S]*13\.8[\s\S]*up to 50 kV[\s\S]*Minimum clearance \(OSHA\)[\s\S]*29 CFR 1926\.1408 Table A/);
  assert.match(st, /Dimension[\s\S]*Distance and bearing[\s\S]*Azimuth from grid north/); assert.match(st, /Pier 2[\s\S]*35\.0/);
  await p.click('#tabBar [data-otab=rpt]'); await p.waitForSelector('#rptHost .rp-doc');
  const rt = await p.textContent('#rptHost .rp-doc'); assert.match(rt, /Site items[\s\S]*Site plan[\s\S]*Power line[\s\S]*over 750 to 1,000 kV 45 ft/);
  assert.ok(await p.$('#rptHost .rp-doc svg path'), 'site plan figure');
  const bad = await p.evaluate(() => { const d = SharedReport.build(CranePickReport.model(CranePickApp.P)); return d.unresolved.concat(d.dup); }); assert.deepEqual(bad, []);
  assert.doesNotMatch(await p.evaluate(() => SharedReport.text(SharedReport.build(CranePickReport.model(CranePickApp.P)))), /NaN|undefined/);
  await shot('c1-report-items-1280');
  ok('Save and reload keep the 8 items; Site tab tables with worked steps (Table A clearance, dimension); Report: site plan figure, OSHA Table A note, steps (no unresolved keys, no NaN)');

  // 7. 390 px
  await p.click('#tabBar [data-otab=plan]'); await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at 390 px');
  await p.evaluate(() => CranePickMap.fit(CranePickApp.P.items.flatMap(i => i.pts))); await p.waitForTimeout(300); await mapBox();
  await tool('dim'); await c(60, 200); await c(300, 260); await p.waitForTimeout(150);
  assert.equal((await items()).length, 9); assert.equal((await items()).at(-1).type, 'dim');
  await shot('c1-draw-390');
  await p.evaluate(() => document.getElementById('inputPanel').scrollIntoView()); await p.waitForTimeout(100);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await shot('c1-items-390');
  assert.deepEqual(errs, []);
  ok('390 px: no sideways scroll, a dimension drawn by taps, the item panel below the map; 0 console errors');
} finally { await b.close(); fs.rmSync(TMP, { recursive: true, force: true }); }
console.log(`crane-draw: ${n} checks ok`);
