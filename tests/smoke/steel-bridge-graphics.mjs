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
  await p.evaluate(() => document.getElementById('gtest').remove());
  // PR 2: each tab's graphic appears, the wheel zooms it, a click selects a location (Flexure, Constructibility, Analysis)
  const tab = async (k) => { await p.click(`#tabBar [data-otab="${k}"]`); await p.waitForTimeout(150); };
  const zoomOk = async (sel) => { await p.locator(`${sel} .sdx-view`).first().scrollIntoViewIfNeeded(); const bx = await p.locator(`${sel} .sdx-view`).first().boundingBox(); const vb0 = await p.evaluate(s => document.querySelector(s + ' svg').getAttribute('viewBox'), sel);
    await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await p.mouse.wheel(0, -500); await p.waitForTimeout(100);
    assert.notEqual(await p.evaluate(s => document.querySelector(s + ' svg').getAttribute('viewBox'), sel), vb0, `${sel}: wheel zoom`); await p.dblclick(`${sel} svg`); };
  const print = async (name) => { if (!SHOTS) return; await p.emulateMedia({ media: 'print' }); await p.screenshot({ path: path.join(SHOTS, name + '-print.png'), fullPage: false }); await p.emulateMedia({ media: 'screen' }); };
  const chk = async (name, sel, minTexts) => { await p.waitForSelector(sel + ' svg', { timeout: 180000 }); const n = await p.evaluate(s => document.querySelectorAll(s + ' svg text').length, sel); assert.ok(n >= minTexts, `${name}: ${n} texts`); await p.locator(`${sel} .sdx-view`).first().scrollIntoViewIfNeeded(); await shot(name); await print(name); await zoomOk(sel); return n; };
  // Section properties
  await tab('sec'); if (await p.isVisible('#bCalc')) await p.click('#bCalc'); await chk('tab-section', '#gfx_sec', 15);
  await p.selectOption('#gfx_sec_c', '3n'); await p.waitForTimeout(150); await chk('tab-section-3n', '#gfx_sec', 15);
  // Loads & LLDF
  await tab('loads'); if (await p.isVisible('#bCalc')) await p.click('#bCalc'); await chk('tab-loads', '#gfx_ld', 15);
  const cases = await p.evaluate(() => [...document.querySelectorAll('#gfx_ld_c option')].map(o => o.value)); assert.ok(cases.length >= 2, 'LLDF cases ' + cases);
  await p.selectOption('#gfx_ld_c', cases[cases.length - 1]); await p.waitForTimeout(150); await chk('tab-loads-case', '#gfx_ld', 15);
  // Analysis (a few seconds)
  await tab('an'); if (await p.isVisible('#anCalc')) await p.click('#anCalc'); await chk('tab-analysis', '#gfx_an', 30);
  const st0 = await p.evaluate(() => document.querySelector('#gfx_an select').value);
  await p.locator('#gfx_an .sdx-view').scrollIntoViewIfNeeded(); const bx = await p.locator('#gfx_an .sdx-view').boundingBox(); await p.mouse.click(bx.x + bx.width * 0.7, bx.y + bx.height * 0.3); await p.waitForTimeout(150);
  assert.notEqual(await p.evaluate(() => document.querySelector('#gfx_an select').value), st0, 'Analysis: click selected a station (the selector follows)');
  // Flexure
  await tab('flex'); if (await p.isVisible('#fx_calc')) await p.click('#fx_calc'); await chk('tab-flexure', '#gfx_fx .gfx-a', 30); await p.waitForSelector('#gfx_fx .gfx-b svg'); await p.waitForSelector('#gfx_fx .gfx-c svg'); await shot('tab-flexure-b');
  const rows = await p.evaluate(() => document.querySelectorAll('#out .fx-list tr[data-fx]').length), sel0 = await p.evaluate(() => [...document.querySelectorAll('#out .fx-list tr')].findIndex(r => r.classList.contains('sel')));
  await p.locator('#gfx_fx .gfx-a .sdx-view').scrollIntoViewIfNeeded(); const fb = await p.locator('#gfx_fx .gfx-a .sdx-view').boundingBox();
  if (rows > 1) { await p.mouse.click(fb.x + fb.width * 0.12, fb.y + fb.height * 0.4); await p.waitForTimeout(250);
    const sel1 = await p.evaluate(() => [...document.querySelectorAll('#out .fx-list tr')].findIndex(r => r.classList.contains('sel'))); assert.notEqual(sel1, sel0, `Flexure: click selected another row (${sel0} to ${sel1})`); }
  // Constructibility
  await tab('cn'); if (await p.isVisible('#cn_calc')) await p.click('#cn_calc'); await chk('tab-constructibility', '#gfx_cn .gfx-a', 30); await p.waitForSelector('#gfx_cn .gfx-b svg'); await shot('tab-constructibility-b');
  // click-select on the Constructibility graphic: a click on the band row / elevation selects the location (the table's row follows, the blue line moves); another click, another row
  { const selRow = () => p.evaluate(() => [...document.querySelectorAll('#out tr[data-cnsel]')].findIndex(r => r.classList.contains('sel'))), sel0 = await selRow();
    await p.locator('#gfx_cn .gfx-a .sdx-view').scrollIntoViewIfNeeded(); let cb = await p.locator('#gfx_cn .gfx-a .sdx-view').boundingBox();
    await p.mouse.click(cb.x + cb.width * 0.9, cb.y + cb.height * 0.4); await p.waitForTimeout(450); const sel1 = await selRow(); assert.notEqual(sel1, sel0, `Constructibility: a click selected another row (${sel0} to ${sel1})`);
    assert.equal(await p.evaluate(() => document.querySelectorAll('#gfx_cn .gfx-a .sbg-sel line').length), 1, 'Constructibility: the selected-location line is drawn');
    await p.locator('#gfx_cn .gfx-a .sdx-view').scrollIntoViewIfNeeded(); cb = await p.locator('#gfx_cn .gfx-a .sdx-view').boundingBox();
    await p.mouse.click(cb.x + cb.width * 0.2, cb.y + cb.height * 0.4); await p.waitForTimeout(450); const sel2 = await selRow(); assert.notEqual(sel2, sel1, `Constructibility: a second click selected another row (${sel1} to ${sel2})`);
    const rd = await p.evaluate(() => document.querySelector('#gfx_cn .gfx-a .sbg-read').textContent); assert.match(rd, /M_c = /, 'Constructibility: readout of the selected location'); }
  assert.deepEqual(errs, [], 'console errors (tabs)');
  // phone width: the graphics fit, no horizontal page scroll
  await p.setViewportSize({ width: 390, height: 800 }); await tab('flex'); await p.waitForSelector('#gfx_fx .gfx-a svg'); await p.waitForTimeout(300);
  const ov = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, w: document.querySelector('#gfx_fx .gfx-a .sdx-view').getBoundingClientRect().width })); assert.ok(ov.sw <= ov.cw + 2, 'phone width: no horizontal scroll ' + JSON.stringify(ov));
  await shot('tab-flexure-phone');
  assert.deepEqual(errs, [], 'console errors');
  console.log(`ok  graphics (helper and the five tabs): ${i0.texts} texts, ${i0.lines} lines; wheel zoom, click select (${sel.sel[0].toFixed(1)} ft), drag pan, double-click fit, DXF download`);
  if (blocked.size) console.log('    blocked requests:', [...blocked].join(', '));
} catch (e) {
  console.log('FAIL', e.message, '\n console errors:', errs.slice(0, 5)); await shot('FAIL'); process.exitCode = 1;
} finally { await b.close(); }
