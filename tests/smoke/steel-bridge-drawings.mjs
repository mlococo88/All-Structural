#!/usr/bin/env node
// Browser smoke test of the Steel Bridge Drawings and 3D view tabs (apps/steel-bridge/index.html, ui/drawings.js, engine/sheets.js,
// ui/view3d.js), headless Chromium with three.js served from tests/libs (tests/lib.mjs openPage):
//   1. Drawings tab: the sheet set without results (sheets needing them listed as not generated), Calculate results, the full set
//      (splice, diagram, summary, reaction, fatigue, transition sheets), a sheet preview chosen from the index, Download DXF (the file
//      validated and saved);
//   2. 3D view: whole bridge with the Strength I moment fences and the splice plates; the single-girder close-up (bolts, zoom to a splice);
//      the shear diagram; 0 console errors.
//   node tests/smoke/steel-bridge-drawings.mjs
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const t0 = Date.now();
const { b, p, errs, blocked } = await openPage(path.join(REPO, 'apps/steel-bridge/index.html'), { vw: 1400, vh: 1000 });
try {
  await p.waitForSelector('#tabBar [data-otab="dwg"]');
  await p.click('#tabBar [data-otab="dwg"]');
  await p.waitForSelector('#dwg_calc');
  const s0 = await p.evaluate(() => ({ n: document.querySelectorAll('#dwg_sheet option').length, svg: !!document.querySelector('.dwg-box svg'), miss: /Not in this set/.test(document.querySelector('#out').innerText) }));
  assert.ok(s0.n >= 10 && s0.svg && s0.miss, JSON.stringify(s0));
  await p.click('#dwg_calc');
  await p.waitForFunction(() => /Results: calculated/.test(document.querySelector('#out').innerText), null, { timeout: 180000 });
  const s1 = await p.evaluate(() => ({ n: document.querySelectorAll('#dwg_sheet option').length, opts: [...document.querySelectorAll('#dwg_sheet option')].map(o => o.textContent) }));
  assert.equal(s1.n, 25, s1.opts.join(' | '));
  ['FIELD SPLICE FS1', 'ANALYSIS DIAGRAMS', 'DESIGN SUMMARY', 'BEARING REACTIONS', 'FATIGUE AND FRACTURE', 'FLANGE TRANSITION DETAILS', 'SHEAR CONNECTOR DETAILS'].forEach(t => assert.ok(s1.opts.some(o => o.includes(t)), t));
  // choose the FS1 sheet from the index; its preview has the bolt circles
  await p.click('.dwg-idx tr[data-dsheet^="spl"] td.lft');
  const s2 = await p.evaluate(() => ({ title: document.querySelector('#dwg_sheet').selectedOptions[0].textContent, circles: document.querySelectorAll('.dwg-box svg circle').length }));
  assert.ok(/FIELD SPLICE FS1/.test(s2.title) && s2.circles === 100, JSON.stringify(s2));
  // preview navigation (shared/dxf.js viewer): wheel zooms about the cursor without scrolling the page (also at fit), the drop-down follows,
  // drag pans, + zooms, double-click fits; text stays SVG text (vector)
  const vb = () => p.evaluate(() => document.querySelector('.dwg-box svg').getAttribute('viewBox'));
  await p.locator('.dwg-box').scrollIntoViewIfNeeded();
  const bx = await p.locator('.dwg-box svg').boundingBox(), cx = bx.x + bx.width * 0.3, cy = bx.y + bx.height * 0.3;
  const sy0 = await p.evaluate(() => document.querySelector('#outputPanel') ? document.querySelector('#outputPanel').scrollTop + window.scrollY : window.scrollY);
  const vb0 = await vb(); await p.mouse.move(cx, cy); for (let i = 0; i < 4; i++) await p.mouse.wheel(0, -240);
  await p.waitForTimeout(150);
  const z1 = await p.evaluate(() => ({ L: window.SBDDrawingsUI.viewer().level(), sel: document.querySelector('#dwg_z').selectedOptions[0].textContent, sy: document.querySelector('#outputPanel') ? document.querySelector('#outputPanel').scrollTop + window.scrollY : window.scrollY, text: document.querySelectorAll('.dwg-box svg text').length }));
  assert.ok(z1.L > 2 && z1.sel !== 'Fit' && z1.sy === sy0 && z1.text > 10, JSON.stringify(z1));
  // the point under the cursor stays put: the drawing point at (cx, cy) before and after another wheel step
  const ptAt = () => p.evaluate(([x, y]) => { const s = document.querySelector('.dwg-box svg'), q = s.createSVGPoint(); q.x = x; q.y = y; const r = q.matrixTransform(s.getScreenCTM().inverse()); return [r.x, r.y]; }, [cx, cy]);
  const pa = await ptAt(); await p.mouse.wheel(0, -120); await p.waitForTimeout(100); const pb = await ptAt();
  assert.ok(Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) < 1e-3 * Math.abs(pa[0] || 1) + 0.5, `zoom about the cursor: ${pa} vs ${pb}`);
  z1.L = await p.evaluate(() => window.SBDDrawingsUI.viewer().level());
  const vb1 = await vb(); await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx + 120, cy + 60, { steps: 4 }); await p.mouse.up();
  assert.notEqual(await vb(), vb1, 'drag pans');
  await p.click('.dwg-box [data-sdx="in"]'); const z2 = await p.evaluate(() => window.SBDDrawingsUI.viewer().level()); assert.ok(Math.abs(z2 / z1.L - 1.5) < 1e-6, `+ button ${z2}`);
  await p.selectOption('#dwg_z', '2'); assert.ok(Math.abs(await p.evaluate(() => window.SBDDrawingsUI.viewer().level()) - 2) < 1e-6, 'drop-down 200 %');
  await p.dblclick('.dwg-box svg', { position: { x: 50, y: 50 } });
  const z3 = await p.evaluate(() => ({ L: window.SBDDrawingsUI.viewer().level(), sel: document.querySelector('#dwg_z').selectedOptions[0].textContent }));
  assert.ok(Math.abs(z3.L - 1) < 1e-9 && z3.sel === 'Fit' && (await vb()) === vb0, JSON.stringify(z3));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#dwg_dxf')]);
  const fn = dl.suggestedFilename(), fp = await dl.path(), txt = (await import('fs')).readFileSync(fp, 'utf8');
  assert.ok(/_drawings\.dxf$/.test(fn) && /AC1009/.test(txt) && /S-TBLK/.test(txt) && txt.length > 1e6, `${fn} ${txt.length}`);
  // 3D view: moment fences and splice plates (results kept from the Drawings tab)
  await p.click('#tabBar [data-otab="3d"]');
  await p.waitForFunction(() => window.SBD3DUI && window.SBD3DUI.state().fences > 0, null, { timeout: 60000 });
  const v1 = await p.evaluate(() => ({ ...window.SBD3DUI.state(), tg: null, note: document.querySelector('#v3d-dg').textContent }));
  assert.ok(v1.fences === 10 && /Strength I/.test(v1.note), JSON.stringify(v1));   // 5 girders x (max, min)
  await p.selectOption('#v3d_mode', 'g2');
  await p.waitForFunction(() => window.SBD3DUI.state().mode === 'g2');
  const v2 = await p.evaluate(() => ({ ...window.SBD3DUI.state(), focus: [...document.querySelectorAll('#v3d_focus option')].map(o => o.textContent), stud: document.querySelector('[data-v3d="stud"]').checked, cam0: window.SBD3DUI.camera() }));
  assert.ok(v2.fences === 2 && v2.focus.includes('Field splice FS1') && v2.stud, JSON.stringify(v2).slice(0, 300));
  await p.selectOption('#v3d_focus', 's0');
  const cam = await p.evaluate(() => window.SBD3DUI.camera());
  assert.ok(Math.abs(cam.t[0] - v2.cam0.t[0]) > 100, 'zoom to FS1 moves the target');
  await p.selectOption('#v3d_dg', 'vStr');
  await p.waitForFunction(() => /Shear: Strength I/.test(document.querySelector('#v3d-dg').textContent));
  const shot = await p.locator('#v3d-host canvas').screenshot({ path: path.join(process.env.SHOT_DIR || '/tmp', 'sbd-3d-closeup.png') });
  assert.ok(shot.length > 10000);
  assert.deepEqual(errs, [], 'console errors');
  console.log(`ok  Drawings: ${s0.n} sheets without results, ${s1.n} with; FS1 preview ${s2.circles} bolts; wheel zoom to ${(z1.L * 100).toFixed(0)} % (page not scrolled), drag, +, drop-down, double-click fit; DXF ${fn} ${(txt.length / 1e6).toFixed(1)} MB. 3D: ${v1.fences} fences (whole bridge), close-up G2 ${v2.focus.length} targets, zoom to FS1; 0 console errors (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  if (blocked.size) console.log('    blocked requests:', [...blocked].join(', '));
} catch (e) {
  console.log('FAIL', e.message, '\n console errors:', errs.slice(0, 5)); process.exitCode = 1;
} finally { await b.close(); }
