#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), C3-3: the 3D view (ui/view3d.js) with three.js r128 + OrbitControls served from tests/libs.
// Headless Chromium, file://, base map None. Only the SYNTHETIC fake crane (tests/smoke/crane-fake-wheeled.json) is used.
//   1. the dock's "3D" button loads three.js (the pinned CDN URLs, served from tests/libs) and draws the scene: site items (a power line
//      with its D_min tube, an obstruction, an exclusion zone), the crane, the boom at the pick, the swing envelope, a red flag;
//   2. orbit (a mouse drag on the canvas) moves the camera and renders again;
//   3. dragging the pick point on the plan: the 3D boom follows mid-drag; Undo / Redo update it;
//   4. the Report shows the 3D snapshot (no unresolved keys, no NaN);
//   5. 390 px: no sideways scroll; 0 console errors; 6. WebGL not available (getContext patched in a second page): the message.
//   SHOTS=<dir> node tests/smoke/crane-3d.mjs
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/crane-pick/index.html');
const FW = path.join(REPO, 'tests/smoke/crane-fake-wheeled.json');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const shot = async (p, nm) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
const scrOf = p => q => p.evaluate(q => { const m = CranePickMap.map, cp = m.latLngToContainerPoint(CranePickMap.toLL(q)), r = m.getContainer().getBoundingClientRect(); return { x: r.x + cp.x, y: r.y + cp.y }; }, q);
const boomPos = p => p.evaluate(() => { let b = null; CranePickView3D.scene.traverse(o => { if (o.userData.boom) b = o; }); return b ? { x: b.position.x, y: b.position.y, z: b.position.z } : null; });
const count = p => p.evaluate(() => { const c = {}; CranePickView3D.scene.traverse(o => Object.keys(o.userData || {}).forEach(k => { const v = o.userData[k]; const key = k === 'flag' ? 'flag-' + v : k; c[key] = (c[key] || 0) + 1; })); return c; });
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 900, ls: { 'crane.ui': '{"base":"none","itab":"cranes"}' } });
let b2 = null;
try {
  const itabOf = sel => /^#lu|^\[data-la=(addPick|delU|zoomU)\]/.test(sel) ? 'cranes' : /^#(lk|ls|lf|tl)|lkSwing|^\[data-(la|ta)=/.test(sel) ? 'lifts' : null;   // 2026-11-17: setups on Cranes & setups, picks / girder lifts on Lifts
  const goTab = async sel => { const t = itabOf(sel); if (t) await p.evaluate(t => { if (CranePickApp.ui.itab !== t) CranePickApp.showITab(t); }, t); };
  const setF = async (sel, v) => { await goTab(sel); await p.fill(sel, String(v)); await p.dispatchEvent(sel, 'change'); await p.waitForTimeout(80); };
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(300);
  await p.setInputFiles('#crFiles', [FW]); await p.waitForFunction(() => /1 crane loaded/.test(document.querySelector('#crStatus').textContent));
  await p.click('[data-ca=add]'); await p.waitForTimeout(150); await p.click('[data-ca=place]'); await p.waitForTimeout(400);
  await setF('#luE', 1000); await setF('#luN', 2000); await setF('#luBoom', 60); await setF('#luPad', 100);
  await goTab('[data-la=addPick]'); await p.click('[data-la=addPick]'); await p.waitForTimeout(150);   /* 2026-11-17: Add setup makes no pick */ await setF('#lkPE', 1030); await setF('#lkPN', 2000); await setF('#lkSE', 1000); await setF('#lkSN', 2020); await setF('#lkLoad', 20000);
  await goTab('#lkElev summary'); await p.click('#lkElev summary'); await p.waitForTimeout(80);
  for (const [id, v] of [['#lkPg', 98], ['#lkPh', 4], ['#lkSh', 20], ['#lkLH', 6], ['#lkRigH', 12], ['#lkBlk', 5], ['#lkLL', 40], ['#lkLW', 4]]) await setF(id, v);
  await p.evaluate(() => CranePickApp.update(P => { const N = CranePickModel.normItem;
    P.items.push(N({ type: 'power', name: 'OH 115 kV', kv: 115, height: 50, gradeEl: 100, pts: [{ x: 1040, y: 1900 }, { x: 1040, y: 2100 }] }), N({ type: 'obst', name: 'Pier', height: 8, gradeEl: 100, pts: [{ x: 960, y: 2010 }, { x: 975, y: 2010 }, { x: 975, y: 2030 }, { x: 960, y: 2030 }] }),
      N({ type: 'excl', name: 'Lane', pts: [{ x: 980, y: 1960 }, { x: 1000, y: 1960 }, { x: 1000, y: 1970 }, { x: 980, y: 1970 }] })); }, 'items'));
  await p.evaluate(() => CranePickPlace.select(CranePickApp.P.setups[0].id, CranePickApp.P.picks[0].id)); await p.waitForTimeout(150);
  await p.evaluate(() => { const u = CranePickApp.P.setups[0]; CranePickMap.fit([{ x: u.x - 50, y: u.y - 50 }, { x: u.x + 50, y: u.y + 50 }]); }); await p.waitForTimeout(400);
  // 1. 3D
  await p.click('[data-elmode="3d"]'); await p.waitForSelector('#v3Canvas', { timeout: 15000 }); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => typeof THREE !== 'undefined' && THREE.REVISION), '128'); assert.ok(await p.evaluate(() => !!THREE.OrbitControls));
  const c1 = await count(p); assert.deepEqual([c1.boom, c1.envelope, c1.tube, c1.cw, c1.load, c1['flag-stop'] >= 1], [1, 1, 1, 1, 1, true], JSON.stringify(c1));
  const st = await p.evaluate(() => CranePickView3D.state); assert.ok(st.frames >= 1 && st.site >= 4 && !st.failed, JSON.stringify(st));
  const px = await p.evaluate(() => { const c = document.getElementById('v3Canvas'), g = c.getContext('webgl2') || c.getContext('webgl'), d = new Uint8Array(4 * 64); g.readPixels(Math.floor(c.width / 2) - 32, Math.floor(c.height / 2), 64, 1, g.RGBA, g.UNSIGNED_BYTE, d); return new Set([...d].filter((v, i) => i % 4 === 0)).size; });
  assert.ok(px > 1, 'the canvas shows something (' + px + ' colours along a row)');
  // the boom from the foot pin to the tip (world: x east, y up, z south; origin = the rotation centre at the pad): its middle
  const bp = await boomPos(p); near(bp.x, (2 + 30) / 2, 1e-3); near(bp.y, (8 + 60.4772) / 2, 1e-3); near(bp.z, 0, 1e-6);
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('crane.ui')).elev.mode), '3d');
  await shot(p, 'c3-3-3d');
  ok(`3D: three.js r128 + OrbitControls from tests/libs; boom (middle at x ${bp.x.toFixed(2)}, el. +${bp.y.toFixed(2)}), swing envelope, D_min tube, counterweight, load, red flag; the canvas is drawn`);

  // 2. orbit
  const cam0 = await p.evaluate(() => CranePickView3D.camera.position.toArray()), f0 = (await p.evaluate(() => CranePickView3D.state)).frames;
  const cb = await p.$eval('#v3Canvas', c => { const r = c.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.move(cb.x, cb.y); await p.mouse.down(); for (let i = 1; i <= 8; i++) await p.mouse.move(cb.x + i * 12, cb.y + i * 3); await p.mouse.up(); await p.waitForTimeout(150);
  const cam1 = await p.evaluate(() => CranePickView3D.camera.position.toArray()), f1 = (await p.evaluate(() => CranePickView3D.state)).frames;
  assert.ok(Math.hypot(cam1[0] - cam0[0], cam1[2] - cam0[2]) > 1, 'the camera orbited'); assert.ok(f1 > f0, 'rendered again');
  ok(`orbit: the camera moved, ${f1 - f0} renders`);

  // 3. drag the pick point on the plan: the boom follows
  const scr = scrOf(p), a = await scr({ x: 1030, y: 2000 }), c0 = await scr({ x: 1030, y: 2010 });
  await p.mouse.move(a.x, a.y); await p.mouse.down();
  for (let i = 1; i <= 10; i++) { await p.mouse.move(a.x, a.y + (c0.y - a.y) * i / 10); if (i === 5) { await p.waitForTimeout(60); const m = await boomPos(p), k = await p.evaluate(() => CranePickApp.P.picks[0].pick); const Rk = Math.hypot(k.x - 1000, k.y - 2000); near(m.z, -((k.y - 2000) + 2 * (k.y - 2000) / Rk) / 2, 1e-3, 'the boom (foot pin → tip, middle) follows mid-drag'); } }
  await p.mouse.up(); await p.waitForTimeout(300);
  const after = await boomPos(p); assert.ok(after.z < -1, 'the boom turned north: ' + after.z);
  await p.waitForTimeout(450); await p.click('#bUndo'); await p.waitForTimeout(300); near((await boomPos(p)).z, 0, 1e-6, 'undo'); await p.waitForTimeout(450); await p.click('#bRedo'); await p.waitForTimeout(300); near((await boomPos(p)).z, after.z, 1e-6, 'redo');
  await p.waitForTimeout(450); await p.click('#bUndo'); await p.waitForTimeout(300);
  ok('the pick point dragged on the plan: the 3D boom follows mid-drag; Undo / Redo');

  // 4. Report
  await p.click('#tabBar [data-otab=rpt]'); await p.waitForSelector('#rptHost .rp-doc'); await p.waitForTimeout(300);
  const doc = await p.evaluate(() => { const d = CranePickReportUI.view.doc; return { unresolved: d.unresolved, dup: d.dup, text: SharedReport.text(d) }; });
  assert.deepEqual(doc.unresolved, []); assert.deepEqual(doc.dup, []); assert.ok(!/NaN|undefined/.test(doc.text)); assert.match(doc.text, /3D view[\s\S]*as last shown on the screen/);
  assert.ok(await p.$('#rptHost .rp-doc svg image[href^="data:image/png"]'), 'the snapshot');
  ok('Report: the 3D snapshot (as last shown), no unresolved keys, no NaN');

  // 5. 390 px
  await p.click('#tabBar [data-otab=plan]'); await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(400);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll');
  await shot(p, 'c3-3-390');
  ok('390 px: no sideways scroll');
  assert.deepEqual(errs, []); ok('0 console errors');

  // 6. no WebGL
  const o2 = await openPage(FILE, { vw: 1000, vh: 800, ls: { 'crane.ui': '{"base":"none","itab":"lifts","elev":{"open":true,"mode":"2d"}}' } }); b2 = o2.b; const q = o2.p;
  await q.waitForSelector('[data-sp=chip]'); await q.evaluate(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, o) { return /webgl/.test(t) ? null : g.call(this, t, o); }; });
  await q.click('[data-elmode="3d"]'); await q.waitForSelector('#v3Msg'); await q.waitForFunction(() => /WebGL is not available/.test(document.querySelector('#v3Msg').textContent), null, { timeout: 15000 });
  assert.deepEqual(o2.errs, []);
  ok('WebGL not available: the dock says so (the elevation view and the checks still work); 0 console errors');
  console.log(`\n${n} checks passed`);
} catch (e) { console.error('FAIL', e); console.error('console errors:', errs); process.exitCode = 1; }
finally { await b.close(); if (b2) await b2.close(); }
