#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), C1-2: plan-sheet underlays. Headless Chromium, file://, CDN libraries (Leaflet, proj4, pdf.js)
// from tests/libs, base map None (no tiles: the plan-sheet-only case).
//   1. Add a PNG plan sheet (tests/smoke/crane-fixtures.mjs): placed at the map centre, "scale not set"; the image is in IndexedDB
//      crane.sheets.v1, not in localStorage (the project keeps placement and calibration only); Undo / Redo of the add;
//   2. scale calibration by clicking two points on the map (the sheet's 100 ft dimension) and D = 100 ft: s = D / d_px about the
//      midpoint (the midpoint does not move); worked steps on the Site tab;
//   3. georeference by clicking two points and entering their State Plane coordinates (rotated 30°): the picked pixels land exactly on
//      the entered coordinates; scale ≈ 1/12 ft/px; the calibration is shown as a check;
//   4. dragging the move handle and the rotate handle (one undo step each), opacity, show / lock (lock hides the handles);
//   5. a reload restores the image from IndexedDB; Export JSON with / without images; an image missing from this browser: notice, outline,
//      "Reload image…" with the same file keeps the placement; Import JSON with images restores it;
//   6. a PDF (17 × 11 in) rendered with pdf.js (page, resolution), the plan's stated scale 1 in = 20 ft -> s = 20 · 17 / W_px;
//   7. Remove (asks; Undo brings it back) and Clean up unused images; the Report's Plan sheets section (no unresolved keys, no NaN);
//   8. 390 px: no sideways scroll; 0 console errors.
//   SHOTS=<dir> node tests/smoke/crane-sheets.mjs
import path from 'path';
import fs from 'fs';
import os from 'os';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';
import { makePlan, makePdf } from './crane-fixtures.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/crane-pick/index.html');
const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'crane-sheets-'));
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const until = async (f, ms, w) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + w); await new Promise(r => setTimeout(r, 150)); } };
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 860, ls: { 'crane.ui': '{"base":"none","itab":"sheets"}' } });
let reply = [];
p.removeAllListeners('dialog'); p.on('dialog', async d => { const r = reply.shift(); if (r === false) await d.dismiss(); else await d.accept(typeof r === 'string' ? r : undefined); });
const PNG = path.join(TMP, 'plan.png'), PDF = path.join(TMP, 'plan.pdf');
const proj = () => p.evaluate(() => JSON.parse(localStorage.getItem('crane.project.current')));
const sheet = async (i = 0) => (await proj()).sheets[i];
const idb = () => p.evaluate(() => CranePickSheetStore.list());
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
/* the page position of sheet pixel (px, py) */
const at = (px, py, i = 0) => p.evaluate(([px, py, i]) => { const s = CranePickApp.P.sheets[i], m = CranePickMap.map, c = m.latLngToContainerPoint(CranePickMap.toLL(CranePickGeo.pxToFt(s.place, px, py))), r = m.getContainer().getBoundingClientRect(); return { x: r.x + c.x, y: r.y + c.y }; }, [px, py, i]);
const clickPx = async (px, py) => { const q = await at(px, py); await p.mouse.click(q.x, q.y); await p.waitForTimeout(120); };
const dragEl = async (sel, dx, dy) => { const r = await p.$eval(sel, e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await p.mouse.move(r.x, r.y); await p.mouse.down(); for (let k = 1; k <= 12; k++) await p.mouse.move(r.x + dx * k / 12, r.y + dy * k / 12); await p.mouse.up(); await p.waitForTimeout(200); };
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(500);
  await makePlan(p, PNG); await makePdf(PDF);
  // 1. add a PNG
  assert.deepEqual((await p.$$eval('#inTabs [data-itab]', a => a.map(x => x.textContent))).slice(0, 3), ['Project', 'Site & map', 'Plan sheets']);
  await p.setInputFiles('#shFile', PNG); await until(async () => (await proj()).sheets.length === 1, 5000, 'sheet added');
  let s = await sheet(); assert.equal(s.w, 2400); assert.equal(s.h, 1600); assert.equal(s.basis, 'none'); assert.equal(s.kind, 'image');
  await until(() => p.evaluate(() => !!document.querySelector('img.crSheet')), 5000, 'img');
  assert.match(await p.textContent('[data-pane=sheets]'), /scale not set/);
  assert.equal((await idb()).length, 1); assert.equal((await idb())[0].id, s.id);
  const lsAll = await p.evaluate(() => Object.keys(localStorage).map(k => localStorage.getItem(k)).join(''));
  assert.ok(!lsAll.includes('data:image') && lsAll.length < 20000, 'no image data in localStorage (' + lsAll.length + ' chars)');
  assert.ok(await p.evaluate(() => { const s = CranePickApp.P.sheets[0], m = CranePickMap.map; return m.getBounds().contains(CranePickMap.toLL(CranePickGeo.pxToFt(s.place, s.w / 2, s.h / 2))); }), 'placed in view (at the map centre)');
  await p.click('#bUndo'); await p.waitForTimeout(150); assert.equal((await proj()).sheets.length, 0); assert.equal(await p.$$eval('img.crSheet', a => a.length), 0);
  await p.waitForTimeout(450); await p.click('#bRedo'); await p.waitForTimeout(250); assert.equal((await proj()).sheets.length, 1); assert.equal(await p.$$eval('img.crSheet', a => a.length), 1);
  ok('PNG added at the map centre ("scale not set"); the image in IndexedDB, not in localStorage; Undo / Redo of the add');

  // 2. calibration by clicks
  await p.click('[data-a=sel]').catch(() => {}); if (!(await p.$('[data-a=cal]'))) await p.click('[data-a=sel]');
  await p.click('[data-a=fit]'); await p.waitForTimeout(300);
  await p.click('[data-a=cal]'); assert.match(await p.textContent('#mbStatus'), /Scale calibration: click point 1 of 2/);
  await clickPx(600, 1200); await clickPx(1800, 1200);
  assert.match(await p.textContent('#mbStatus'), /Two points picked/);
  await p.fill('#calD', '100'); const midB = await p.evaluate(() => CranePickApp.P.sheets[0].place);
  await p.click('[data-a=calApply]'); await p.waitForTimeout(200);
  s = await sheet(); assert.equal(s.basis, 'cal'); assert.equal(s.cal.dist, 100);
  const dpx = Math.hypot(s.cal.p2.px - s.cal.p1.px, s.cal.p2.py - s.cal.p1.py); near(dpx, 1200, 6, 'picked about 1200 px apart');
  near(s.place.s, 100 / dpx, 1e-12, 's = D / d_px'); near(s.place.s, 1 / 12, 0.0005, 's ≈ 1/12 ft/px');
  const mpx = (s.cal.p1.px + s.cal.p2.px) / 2, mpy = (s.cal.p1.py + s.cal.p2.py) / 2;
  const m0 = await p.evaluate(([pl, x, y]) => CranePickGeo.pxToFt(pl, x, y), [midB, mpx, mpy]), m1 = await p.evaluate(([pl, x, y]) => CranePickGeo.pxToFt(pl, x, y), [s.place, mpx, mpy]);
  near(m0.x, m1.x, 1e-6); near(m0.y, m1.y, 1e-6);
  await p.click('#tabBar [data-otab=site]'); await p.waitForTimeout(150);
  const st = await p.textContent('[data-opane=site]'); assert.match(st, /Plan sheets[\s\S]*Scale calibration[\s\S]*Sheet scale/); assert.match(st, /calibrated \(two points, known distance\)/);
  await p.click('#tabBar [data-otab=plan]');
  ok(`calibration by two clicks on the 100 ft dimension: d_px = ${dpx.toFixed(1)}, s = D / d_px = ${s.place.s.toFixed(6)} ft/px about the fixed midpoint; worked on the Site tab`);

  // 3. georeference (rotated 30°)
  const E1 = 775000, N1 = 2956000, th = Math.PI / 6, E2 = E1 + 100 * Math.cos(th), N2 = N1 + 100 * Math.sin(th);
  await p.click('[data-a=fit]'); await p.waitForTimeout(300);   // the calibrated sheet is about 1/22 of its first size: zoom to it
  await p.click('[data-a=geo]'); await clickPx(600, 1200); await clickPx(1800, 1200);
  await p.fill('#gE1', String(E1)); await p.fill('#gN1', String(N1)); await p.fill('#gE2', E2.toFixed(4)); await p.fill('#gN2', N2.toFixed(4));
  await p.click('[data-a=geoApply]'); await p.waitForTimeout(300);
  s = await sheet(); assert.equal(s.basis, 'geo');
  const g1 = await p.evaluate(([pl, q]) => CranePickGeo.pxToFt(pl, q.px, q.py), [s.place, s.geo.p1]), g2 = await p.evaluate(([pl, q]) => CranePickGeo.pxToFt(pl, q.px, q.py), [s.place, s.geo.p2]);
  near(g1.x, E1, 1e-6, 'p1 E'); near(g1.y, N1, 1e-6, 'p1 N'); near(g2.x, +E2.toFixed(4), 1e-6); near(g2.y, +N2.toFixed(4), 1e-6);
  near(s.place.rot * 180 / Math.PI, 30, 0.4, 'rotation ≈ 30°'); near(s.place.s, 1 / 12, 0.0005);
  await p.click('#tabBar [data-otab=site]'); await p.waitForTimeout(150);
  assert.match(await p.textContent('[data-opane=site]'), /Georeference[\s\S]*Sheet rotation[\s\S]*Check against the scale calibration/);
  await p.click('#tabBar [data-otab=plan]'); await p.waitForTimeout(200); await shot('c1-sheet-georef-1280');
  ok(`georeference by two clicks and E/N (30° rotation): the picked pixels land exactly on the entered coordinates; rotation ${(s.place.rot * 180 / Math.PI).toFixed(3)}°; the calibration shown as a check`);

  // 4. handles, opacity, show / lock
  let pl0 = (await sheet()).place; await p.waitForTimeout(450);
  await dragEl('.crHandle.crMove span', 120, 60);
  let pl1 = (await sheet()).place; assert.ok(Math.hypot(pl1.x - pl0.x, pl1.y - pl0.y) > 1, 'moved'); assert.equal(pl1.rot, pl0.rot); assert.equal(pl1.s, pl0.s);
  await p.click('#bUndo'); await p.waitForTimeout(200); assert.deepEqual((await sheet()).place, pl0, 'one undo step');
  await p.waitForTimeout(450); await dragEl('.crHandle.crRot span', 150, 0);
  pl1 = (await sheet()).place; assert.ok(Math.abs(pl1.rot - pl0.rot) > 0.05, 'rotated'); near(pl1.s, pl0.s, 1e-12);
  const cA = await p.evaluate(([a, b]) => [CranePickGeo.pxToFt(a, 1200, 800), CranePickGeo.pxToFt(b, 1200, 800)], [pl0, pl1]); near(cA[0].x, cA[1].x, 1e-6); near(cA[0].y, cA[1].y, 1e-6);
  await p.click('#bUndo'); await p.waitForTimeout(200); assert.deepEqual((await sheet()).place, pl0);
  await p.$eval('#shOp', e => { e.value = '0.4'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(100);
  assert.equal((await sheet()).opacity, 0.4); assert.equal(await p.$eval('img.crSheet', e => e.style.opacity), '0.4');
  await p.check('[data-t=locked]'); await p.waitForTimeout(100); assert.equal(await p.$$eval('.crHandle', a => a.length), 0, 'locked: no handles'); assert.equal((await sheet()).locked, true);
  await p.uncheck('[data-t=visible]'); await p.waitForTimeout(100); assert.equal(await p.$eval('img.crSheet', e => e.style.display), 'none');
  await p.check('[data-t=visible]'); await p.uncheck('[data-t=locked]'); await p.waitForTimeout(100); assert.equal(await p.$$eval('.crHandle', a => a.length), 2);
  ok('move handle and rotate handle (about the centre) drag the sheet, one undo step each; opacity; lock hides the handles; show / hide');

  // 5. reload, export, missing image, reload image, import
  await p.reload(); await p.waitForSelector('[data-sp=chip]'); await until(() => p.evaluate(() => !!document.querySelector('img.crSheet')), 5000, 'img after reload');
  assert.equal(await p.evaluate(() => document.getElementById('notices').innerText.includes('not stored in this browser')), false);
  const [d1] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => CranePickProject.exportJSON('x'))]); const f1 = JSON.parse(fs.readFileSync(await d1.path(), 'utf8'));
  const sid = (await sheet()).id; assert.match(f1.images[sid], /^data:image\/png;base64,/); assert.equal(f1.project.sheets[0].id, sid);
  await p.uncheck('#shExp'); const [d2] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => CranePickProject.exportJSON('x'))]); assert.equal(JSON.parse(fs.readFileSync(await d2.path(), 'utf8')).images, undefined);
  await p.check('#shExp');
  const before = (await sheet()).place;
  await p.evaluate(id => CranePickSheetStore.del(id), sid); await p.reload(); await p.waitForSelector('[data-sp=chip]');
  await until(() => p.evaluate(() => document.getElementById('notices').innerText.includes('is not stored in this browser')), 5000, 'missing notice');
  assert.equal(await p.$$eval('img.crSheet', a => a.length), 0); assert.match(await p.textContent('[data-pane=sheets]'), /image missing/);
  await p.click('[data-a=sel]'); await p.evaluate(() => { const f = document.getElementById('shFile'); f.dataset.reload = CranePickApp.P.sheets[0].id; });
  await p.setInputFiles('#shFile', PNG); await until(() => p.evaluate(() => !!document.querySelector('img.crSheet')), 5000, 'reloaded img');
  assert.deepEqual((await sheet()).place, before, 'the same file: placement unchanged');
  await p.evaluate(id => CranePickSheetStore.del(id), sid); await p.reload(); await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(400);
  const imp = path.join(TMP, 'with-images.crane.json'); fs.writeFileSync(imp, JSON.stringify(f1));
  reply = [true]; await p.setInputFiles('#fImport', imp); await until(() => p.evaluate(() => !!document.querySelector('img.crSheet')), 5000, 'imported img');
  assert.equal((await idb()).length, 1); await p.waitForTimeout(200); assert.equal(await p.$('#shMissing'), null, 'the missing-image notice closes when the image is back');
  ok('reload restores the image from IndexedDB; Export JSON with / without images; a missing image: notice, outline, Reload image keeps the placement; Import JSON with images restores it');

  // 6. PDF
  await p.setInputFiles('#shFile', PDF); await until(() => p.evaluate(() => !!document.querySelector('[data-a=pdfGo]')), 15000, 'pdf panel');
  await p.selectOption('#pdRes', '3000'); await p.click('[data-a=pdfGo]'); await until(async () => (await proj()).sheets.length === 2, 15000, 'pdf sheet');
  s = await sheet(1); assert.equal(s.kind, 'pdf'); assert.equal(s.w, 3000); assert.equal(s.h, Math.round(3000 * 792 / 1224)); near(s.pageIn.w, 17, 1e-9); near(s.pageIn.h, 11, 1e-9);
  await p.fill('#plS', '20'); await p.click('[data-a=plan]'); await p.waitForTimeout(200);
  s = await sheet(1); assert.equal(s.basis, 'plan'); near(s.place.s, 20 * 17 / 3000, 1e-12, 's = S · W_in / W_px');
  await p.click('#tabBar [data-otab=site]'); await p.waitForTimeout(150); assert.match(await p.textContent('[data-opane=site]'), /Scale from the plan's stated scale[\s\S]*Page width/);
  await p.click('#tabBar [data-otab=plan]');
  ok(`PDF page rendered with pdf.js (3,000 px long side, 17 × 11 in); plan scale 1 in = 20 ft -> s = 20 × 17 / 3000 = ${(20 * 17 / 3000).toFixed(5)} ft/px`);

  // 7. remove, clean up, report
  reply = [true]; await p.click('[data-card] [data-a=del]'); await p.waitForTimeout(200); assert.equal((await proj()).sheets.length, 1);
  assert.equal((await idb()).length, 2, 'removed from the project; the image kept (Undo)');
  reply = [true]; await p.click('[data-a=clean]'); await until(async () => (await idb()).length === 1, 5000, 'clean up');
  await p.click('#tabBar [data-otab=rpt]'); await p.waitForSelector('#rptHost .rp-doc');
  assert.match(await p.textContent('#rptHost .rp-doc'), /Plan sheets[\s\S]*plan\.png[\s\S]*Georeference/);
  const bad = await p.evaluate(() => { const d = SharedReport.build(CranePickReport.model(CranePickApp.P)); return d.unresolved.concat(d.dup); }); assert.deepEqual(bad, []);
  assert.doesNotMatch(await p.evaluate(() => SharedReport.text(SharedReport.build(CranePickReport.model(CranePickApp.P)))), /NaN|undefined/);
  ok('Remove (asks; image kept for Undo); Clean up removes the image no project uses; Report section Plan sheets (no unresolved keys, no NaN)');

  // 8. 390 px
  await p.click('#tabBar [data-otab=plan]'); await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
  await p.evaluate(() => CranePickSheets.fitSheet(CranePickApp.P.sheets[0].id)); await p.waitForTimeout(300);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at 390 px');
  await shot('c1-sheet-390');
  await p.evaluate(() => document.getElementById('inputPanel').scrollIntoView()); await p.waitForTimeout(100);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errs, []);
  ok('390 px: no sideways scroll; 0 console errors');
} finally { await b.close(); fs.rmSync(TMP, { recursive: true, force: true }); }
console.log(`crane-sheets: ${n} checks ok`);
