#!/usr/bin/env node
// Browser smoke test of the output-tab graphics (ui/graphics.js, window.SBDGraphics), headless Chromium (tests/lib.mjs openPage):
// PR 1 (helper): a graphic mounted on the app page with the built-in project: the SVG appears with the layers, the wheel zooms,
// a click selects (onSelect) and moves the highlight, a drag does not select, double-click fits, Download DXF produces a valid file;
// 0 console errors. Screenshots into the folder SHOTS when it is set.
//   node tests/smoke/steel-bridge-graphics.mjs
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS || '';
const { b, p, errs, blocked } = await openPage(path.join(REPO, 'apps/steel-bridge/index.html'), { vw: 1400, vh: 1000 });
const shot = async (name) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, name + '.png') }); };
try {
  await p.waitForSelector('#tabBar [data-otab="dwg"]');
  await p.evaluate(() => {
    const host = document.createElement('div'); host.id = 'gtest'; host.style.cssText = 'position:fixed;left:0;top:0;width:1100px;background:#fff;z-index:9999;padding:8px';
    document.body.appendChild(host);
    const P = window.SBDModel.defaultProject();
    window.__sel = []; const build = () => { const E = window.SBDGraphics.elevation(P, 0); E.title('GIRDER G1 ELEVATION', 'GRAPHICS HELPER TEST');
      window.SBDGraphics.ratioLayer(E, [{ x: 0, ratio: 0.4 }, { x: 55, ratio: 0.85 }, { x: 110, ratio: 1.2 }, { x: 180, ratio: 0.5 }, { x: 250, ratio: 0.99 }, { x: 360, ratio: 0.2 }], { what: 'FLEXURE' });
      return { D: E.D, title: 'Girder G1 elevation', file: 'test', pick: E.pick, selMark: E.selMark, readout: v => `Station ${v.toFixed(1)} ft` }; };
    window.__H = window.SBDGraphics.mount(host, build, { key: 'test', onSelect: v => window.__sel.push(v) });
  });
  await p.waitForSelector('#gtest svg');
  const info = () => p.evaluate(() => ({ vb: document.querySelector('#gtest svg').getAttribute('viewBox'), texts: document.querySelectorAll('#gtest svg text').length, lines: document.querySelectorAll('#gtest svg line,#gtest svg polyline,#gtest svg polygon').length }));
  const i0 = await info(); assert.ok(i0.texts > 20 && i0.lines > 100, JSON.stringify(i0));
  const box = await p.locator('#gtest .sdx-view').boundingBox();
  // wheel zoom about the cursor
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.wheel(0, -600); await p.waitForTimeout(100);
  const i1 = await info(); assert.notEqual(i1.vb, i0.vb, 'wheel zoom changed the view'); assert.ok(+i1.vb.split(' ')[2] < +i0.vb.split(' ')[2]);
  // a click selects, the overlay is drawn; a drag does not select
  await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(100);
  const sel = await p.evaluate(() => ({ sel: window.__sel.slice(), ov: document.querySelectorAll('#gtest .sbg-sel line').length, rd: document.querySelector('#gtest .sbg-read').textContent }));
  assert.equal(sel.sel.length, 1); assert.ok(sel.sel[0] > 0 && sel.sel[0] < 360); assert.equal(sel.ov, 1); assert.match(sel.rd, /^Station /);
  await p.mouse.move(box.x + 300, box.y + 300); await p.mouse.down(); await p.mouse.move(box.x + 380, box.y + 330, { steps: 4 }); await p.mouse.up();
  assert.equal(await p.evaluate(() => window.__sel.length), 1, 'a drag does not select');
  assert.notEqual((await info()).vb, i1.vb, 'drag pans');
  // select from outside (the tab's selector) moves the highlight without rebuilding
  await p.evaluate(() => window.__H.select(250)); assert.equal(await p.evaluate(() => document.querySelectorAll('#gtest .sbg-sel line').length), 1);
  await shot('helper-zoomed');
  // double-click fits; Download DXF: a valid file
  await p.mouse.dblclick(box.x + 200, box.y + 200); await p.waitForTimeout(100); assert.equal((await info()).vb, i0.vb, 'double-click fits');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#gtest [data-sbg="dxf"]')]); const f = await dl.path(); const txt = fs.readFileSync(f, 'utf8');
  assert.ok(/SECTION/.test(txt) && /EOF/.test(txt) && /S-RATIO-NG/.test(txt), 'DXF has the ratio layers');
  await shot('helper-fit');
  assert.deepEqual(errs, [], 'console errors');
  console.log(`ok  graphics helper: ${i0.texts} texts, ${i0.lines} lines; wheel zoom, click select (${sel.sel[0].toFixed(1)} ft), drag pan, double-click fit, DXF download`);
  if (blocked.size) console.log('    blocked requests:', [...blocked].join(', '));
} catch (e) {
  console.log('FAIL', e.message, '\n console errors:', errs.slice(0, 5)); await shot('FAIL'); process.exitCode = 1;
} finally { await b.close(); }
