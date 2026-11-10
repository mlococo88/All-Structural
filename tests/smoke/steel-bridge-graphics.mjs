#!/usr/bin/env node
// Browser smoke test of the output-tab graphics (ui/graphics.js, window.SBDGraphics), headless Chromium (tests/lib.mjs openPage):
// PR 1 (helper): a graphic mounted on the app page with the built-in project: the SVG appears with the layers, the wheel zooms,
// a click selects (onSelect) and moves the highlight, a drag does not select, double-click fits, Download DXF produces a valid file;
// SECC: the Section properties graphic (ui/vizkit.js style): load-case buttons update the tiles, the axis and the stress values (steel +10.78 / −9.04 ksi);
// SECN: the negative region: steel (DC1) and steel + rebar (DC2, DW, LL) under −1000 kip-ft (−6.66 / +7.88, bars −8.42 / −7.54 ksi), deck hatched and cracked;
// SBVZB: the Analysis, Flexure and Constructibility graphics (ui/vizalong.js style): read-out, click select, chips, resize, no zoom buttons;
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
  // AUTO (2026-11-09): an output tab runs itself when selected; settle() waits until it is no longer out of date and no run is pending
  const settle = (t = 240000) => p.waitForFunction(() => !document.querySelector('#out .alert.stale:not([hidden])') && !/Calculating|updating/.test((document.querySelector('#autoMsg') || {}).textContent || '') && !/Calculating/.test(((document.querySelector('#out') || {}).innerText || '').slice(0, 400)), null, { timeout: t });
  const tab = async (k) => { await p.click(`#tabBar [data-otab="${k}"]`); await p.waitForTimeout(150); };
  const zoomOk = async (sel) => { await p.locator(`${sel} .sdx-view`).first().scrollIntoViewIfNeeded(); const bx = await p.locator(`${sel} .sdx-view`).first().boundingBox(); const vb0 = await p.evaluate(s => document.querySelector(s + ' svg').getAttribute('viewBox'), sel);
    await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await p.mouse.wheel(0, -500); await p.waitForTimeout(100);
    assert.notEqual(await p.evaluate(s => document.querySelector(s + ' svg').getAttribute('viewBox'), sel), vb0, `${sel}: wheel zoom`); await p.dblclick(`${sel} svg`); };
  const print = async (name) => { if (!SHOTS) return; await p.emulateMedia({ media: 'print' }); await p.screenshot({ path: path.join(SHOTS, name + '-print.png'), fullPage: false }); await p.emulateMedia({ media: 'screen' }); };
  const chk = async (name, sel, minTexts) => { await p.waitForSelector(sel + ' svg', { timeout: 180000 }); const n = await p.evaluate(s => document.querySelectorAll(s + ' svg text').length, sel); assert.ok(n >= minTexts, `${name}: ${n} texts`); await p.locator(`${sel} .sdx-view`).first().scrollIntoViewIfNeeded(); await shot(name); await print(name); await zoomOk(sel); return n; };
  // Section properties
  // SECC (2026-11-10): the Section properties graphic is the data-viz style (ui/vizkit.js): a segmented control for the load case (buttons, aria-pressed),
  // six tiles, the selected case's ENA drawn and labelled, the stress badges, chips for the other axes, hover / tap read-out, Download DXF = the line drawing
  await tab('sec'); await settle(); await p.waitForSelector('#gfx_sec .vk svg', { timeout: 180000 });
  const secState = () => p.evaluate(() => { const r = document.querySelector('#gfx_sec .vk'); return { pressed: [...r.querySelectorAll('[data-vkseg]')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.vkseg),
    tiles: [...r.querySelectorAll('.vk-tile b')].map(b => b.textContent.trim()), pill: (r.querySelector('svg text.pillt') || {}).textContent, badges: [...r.querySelectorAll('svg text.vc, svg text.vt')].map(t => t.textContent).sort(),
    others: r.querySelectorAll('svg line.naoth').length, chips: [...r.querySelectorAll('[data-vkchip]')].map(b => [b.dataset.vkchip, b.getAttribute('aria-pressed'), b.disabled]) }; });
  const EXP = { steel: { yb: '28.213', I: '37,472', top: '+10.78', bot: '−9.04', last: '63.75', badges: ['+10.78', '−9.04'] },
    '3n': { yb: '44.565', I: '79,056', top: '+2.63', bot: '−6.76', last: '+0.20', badges: ['+0.14', '+0.20', '+2.63', '−6.76'] },
    n: { yb: '55.100', I: '106,168', top: '+0.77', bot: '−6.23', last: '+0.28', badges: ['+0.15', '+0.28', '+0.77', '−6.23'] } };
  for (const cs of ['steel', '3n', 'n', 'steel']) { await p.click(`#gfx_sec [data-vkseg="${cs}"]`); await p.waitForTimeout(150); const st = await secState(), e = EXP[cs];
    assert.deepEqual(st.pressed, [cs], `section ${cs}: segmented control`); assert.deepEqual([st.tiles[0], st.tiles[1], st.tiles[3], st.tiles[4], st.tiles[5]], [e.yb, e.I, e.top, e.bot, e.last], `section ${cs}: tiles ${st.tiles}`);
    assert.equal(st.pill, `ȳ = ${e.yb} in`, `section ${cs}: the selected axis`); assert.deepEqual(st.badges, e.badges.slice().sort(), `section ${cs}: stress values`);
    assert.ok(st.chips.some(([k, pr, dis]) => k === cs && pr === 'true' && dis), `section ${cs}: its chip pressed`); await shot('tab-section-' + cs); await print('tab-section-' + cs); }
  // the case stays when the tab is drawn again (same state as the former selector); chips toggle the other axes
  await p.click('#gfx_sec [data-vkseg="3n"]'); await tab('flex'); await tab('sec'); await p.waitForSelector('#gfx_sec .vk svg', { timeout: 180000 }); assert.deepEqual((await secState()).pressed, ['3n'], 'section: case kept');
  await p.click('#gfx_sec [data-vkchip="pna"]'); await p.click('#gfx_sec [data-vkchip="steel"]'); let st = await secState(); assert.equal(st.others, 2, 'chips: two other axes drawn');
  assert.deepEqual(st.chips.filter(q => q[1] === 'true').map(q => q[0]).sort(), ['3n', 'pna', 'steel']); await p.click('#gfx_sec [data-vkchip="pna"]'); assert.equal((await secState()).others, 1, 'chip off');
  // hover and tap (click) read-out: y and f(y) on the 3n section
  { await p.locator('#gfx_sec .vk-fig svg').scrollIntoViewIfNeeded(); const bx = await p.locator('#gfx_sec .vk-fig svg').boundingBox();
    await p.mouse.move(bx.x + bx.width * 0.4, bx.y + bx.height * 0.7); await p.waitForTimeout(100); const rd = await p.textContent('#gfx_sec .vk-read'); assert.match(rd, /^y = [\d.]+ in · steel · f = [+−][\d.]+ ksi$/, 'hover read-out: ' + rd);
    assert.ok(await p.evaluate(() => document.querySelector('#gfx_sec .vk-hov').style.display !== 'none'), 'hover tip shown');
    await p.mouse.move(bx.x + 2, bx.y + bx.height + 40); await p.mouse.click(bx.x + bx.width * 0.4, bx.y + bx.height * 0.5); assert.match(await p.textContent('#gfx_sec .vk-read'), /^y = .* f = /, 'tap/click read-out'); }
  // Download DXF: the line drawing (layers of secGraphic), valid
  { const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#gfx_sec [data-secdxf]')]); const txt = fs.readFileSync(await dl.path(), 'utf8'); assert.ok(/S-STRESS-C/.test(txt) && /S-NA-3N/.test(txt) && /EOF/.test(txt), 'section DXF'); }
  // the width follows the panel (resize / sbd2:panelresize)
  { const w0 = await p.evaluate(() => document.querySelector('#gfx_sec svg').viewBox.baseVal.width); await p.setViewportSize({ width: 1100, height: 1000 }); await p.waitForTimeout(300);
    const w1 = await p.evaluate(() => document.querySelector('#gfx_sec svg').viewBox.baseVal.width); assert.notEqual(w1, w0, 'section redrawn at the new width'); await p.setViewportSize({ width: 1400, height: 1000 }); await p.waitForTimeout(300); }
  // SECN (engineer decision 2026-11-10): negative-flexure region: the buttons are the region's sections (steel DC1; steel + rebar DC2, DW, LL), under −1000 kip-ft:
  // top flange and bars in tension (orange, −), bottom flange in compression (blue, +); bar stresses badged; the deck hatched and cracked, no deck stress
  { await p.selectOption('#o_region', 'neg'); await settle(); await p.waitForSelector('#gfx_sec .vk svg', { timeout: 180000 });
    assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('#gfx_sec [data-vkseg]')].map(b => b.dataset.vkseg + ': ' + b.textContent)), ['steel: Steel (DC1)', 'cr: Steel + rebar (DC2, DW, LL)'], 'negative region: buttons');
    const NEG = { steel: { yb: '28.213', I: '37,472', top: '−10.78', bot: '+9.04', last: '63.75', badges: ['+9.04', '−10.78'] }, cr: { yb: '33.535', I: '51,050', top: '−6.66', bot: '+7.88', last: '−8.42', badges: ['+7.88', '−6.66', '−7.54', '−8.42'] } };
    for (const cs of ['cr', 'steel', 'cr']) { await p.click(`#gfx_sec [data-vkseg="${cs}"]`); await p.waitForTimeout(150); const st = await secState(), e = NEG[cs];
      assert.deepEqual(st.pressed, [cs]); assert.deepEqual([st.tiles[0], st.tiles[1], st.tiles[3], st.tiles[4], st.tiles[5]], [e.yb, e.I, e.top, e.bot, e.last], `negative ${cs}: tiles ${st.tiles}`);
      assert.deepEqual(st.badges, e.badges.slice().sort(), `negative ${cs}: stress values`);
      const tone = await p.evaluate(() => [...document.querySelectorAll('#gfx_sec svg text.vt')].map(t => t.textContent)); assert.ok(tone.every(t => t.startsWith('−')), 'tension badges are the orange ones');
      assert.equal(await p.evaluate(() => document.querySelectorAll('#gfx_sec svg [style*="vk-sgh"]').length), 2, 'deck and haunch hatched');
      assert.ok(await p.evaluate(() => document.querySelectorAll('#gfx_sec svg .crk').length >= 2), 'deck cracks');
      assert.equal(await p.evaluate(() => document.querySelectorAll('#gfx_sec svg .gpt').length), cs === 'cr' ? 2 : 0, `negative ${cs}: bar stems`);
      assert.match(await p.textContent('#gfx_sec .vk'), /not effective in negative flexure/); assert.match(await p.textContent('#gfx_sec .vk'), /6\.10\.1\.1\.1c/); await shot('tab-section-neg-' + cs); }
    { const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#gfx_sec [data-secdxf]')]); assert.ok(/EOF/.test(fs.readFileSync(await dl.path(), 'utf8')), 'negative-region DXF (unchanged drawing)'); }
    await p.selectOption('#o_region', 'pos'); await settle(); await p.waitForSelector('#gfx_sec .vk svg', { timeout: 180000 }); }
  assert.deepEqual(errs, [], 'console errors (section)');
  // Loads & LLDF
  await tab('loads'); await settle(); await chk('tab-loads', '#gfx_ld', 15);
  const cases = await p.evaluate(() => [...document.querySelectorAll('#gfx_ld_c option')].map(o => o.value)); assert.ok(cases.length >= 2, 'LLDF cases ' + cases);
  await p.selectOption('#gfx_ld_c', cases[cases.length - 1]); await p.waitForTimeout(150); await chk('tab-loads-case', '#gfx_ld', 15);
  // SBVZB (2026-11-10): Analysis, Flexure and Constructibility graphics in the data-viz style (ui/vizalong.js, ui/alonggfx.js): a card fitted to its width (no
  // zoom buttons), hover / tap read-out, click selects the tab's location, series chips, Download DXF = the old drawing (tests/smoke/steel-bridge-dxf-unchanged.mjs)
  const chkV = async (name, sel, minTexts) => { await p.waitForSelector(sel + ' .va-card svg', { timeout: 180000 }); const n = await p.evaluate(s => document.querySelectorAll(s + ' .va-card svg text').length, sel); assert.ok(n >= minTexts, `${name}: ${n} texts`);
    assert.equal(await p.$(sel + ' .sdx-btns'), null, `${name}: no zoom buttons`); assert.ok(await p.$(sel + ' [data-vadxf]'), `${name}: Download DXF`); await p.locator(`${sel} .va-card svg`).first().scrollIntoViewIfNeeded(); await shot(name); await print(name); return n; };
  const svgBox = async sel => { await p.locator(`${sel} .vk-fig svg`).first().scrollIntoViewIfNeeded(); return p.locator(`${sel} .vk-fig svg`).first().boundingBox(); };
  // Analysis (a few seconds)
  await tab('an'); await settle(); await chkV('tab-analysis', '#gfx_an', 30);
  const st0 = await p.evaluate(() => document.querySelector('#gfx_an select').value);
  { const bx = await svgBox('#gfx_an'); await p.mouse.move(bx.x + bx.width * 0.5, bx.y + bx.height * 0.45); await p.waitForTimeout(100);
    assert.match(await p.textContent('#gfx_an .vk-read'), /^x = [\d.]+ ft · camber -?[\d.]+ in · web .* · MDC1 -?[\d.]+, MDC2 .* kip-ft$/, 'Analysis: hover read-out');
    await p.mouse.click(bx.x + bx.width * 0.7, bx.y + bx.height * 0.3); await p.waitForTimeout(150); }
  assert.notEqual(await p.evaluate(() => document.querySelector('#gfx_an select').value), st0, 'Analysis: click selected a station (the selector follows)');
  { const n0 = await p.evaluate(() => document.querySelectorAll('#gfx_an svg polyline.s0').length); await p.click('#gfx_an [data-vkchip="anM:dc1"]'); await p.waitForTimeout(150);
    assert.equal(await p.evaluate(() => document.querySelectorAll('#gfx_an svg polyline.s0').length), n0 - 1, 'Analysis: the M_DC1 chip hides its line'); await p.click('#gfx_an [data-vkchip="anM:dc1"]'); await p.waitForTimeout(150);
    const w0 = await p.evaluate(() => document.querySelector('#gfx_an svg').viewBox.baseVal.width); await p.setViewportSize({ width: 1100, height: 1000 }); await p.waitForTimeout(300);
    assert.notEqual(await p.evaluate(() => document.querySelector('#gfx_an svg').viewBox.baseVal.width), w0, 'Analysis: redrawn at the new width'); await p.setViewportSize({ width: 1400, height: 1000 }); await p.waitForTimeout(300); }
  // Flexure
  await tab('flex'); await settle(); await chkV('tab-flexure', '#gfx_fx .gfx-a', 20); await p.waitForSelector('#gfx_fx .gfx-b .va-card svg'); await p.waitForSelector('#gfx_fx .gfx-c svg'); await shot('tab-flexure-b');
  assert.ok((await p.evaluate(() => document.querySelectorAll('#gfx_fx .gfx-b svg rect').length)) > 6, 'Flexure: stress-check bars');
  const rows = await p.evaluate(() => document.querySelectorAll('#out .fx-list tr[data-fx]').length), sel0 = await p.evaluate(() => [...document.querySelectorAll('#out .fx-list tr')].findIndex(r => r.classList.contains('sel')));
  if (rows > 1) { const fb = await svgBox('#gfx_fx .gfx-a'); await p.mouse.click(fb.x + fb.width * 0.12, fb.y + fb.height * 0.4); await p.waitForTimeout(250);
    const sel1 = await p.evaluate(() => [...document.querySelectorAll('#out .fx-list tr')].findIndex(r => r.classList.contains('sel'))); assert.notEqual(sel1, sel0, `Flexure: click selected another row (${sel0} to ${sel1})`); }
  // Constructibility
  await tab('cn'); await settle(); await chkV('tab-constructibility', '#gfx_cn .gfx-a', 20); assert.match(await p.textContent('#gfx_cn .gfx-b .note'), /Overhang brackets apply to exterior girders; select G1 or Gn\./, 'interior girder: a note, no empty bracket frame (QA2)'); await shot('tab-constructibility-b');
  assert.ok(await p.$('#gfx_cn .gfx-a table.va-tb'), 'Constructibility: the pour table');
  // click-select on the Constructibility graphic: a click selects the location (the table's row follows, the blue line moves); another click, another row
  { const selRow = () => p.evaluate(() => [...document.querySelectorAll('#out tr[data-cnsel]')].findIndex(r => r.classList.contains('sel'))), sel0 = await selRow();
    let cb = await svgBox('#gfx_cn .gfx-a'); await p.mouse.click(cb.x + cb.width * 0.9, cb.y + cb.height * 0.4); await p.waitForTimeout(450); const sel1 = await selRow(); assert.notEqual(sel1, sel0, `Constructibility: a click selected another row (${sel0} to ${sel1})`);
    assert.equal(await p.evaluate(() => document.querySelectorAll('#gfx_cn .gfx-a svg line.selx').length), 1, 'Constructibility: the selected-location line');
    cb = await svgBox('#gfx_cn .gfx-a'); await p.mouse.click(cb.x + cb.width * 0.2, cb.y + cb.height * 0.4); await p.waitForTimeout(450); const sel2 = await selRow(); assert.notEqual(sel2, sel1, `Constructibility: a second click selected another row (${sel1} to ${sel2})`);
    cb = await svgBox('#gfx_cn .gfx-a'); await p.mouse.move(cb.x + cb.width * 0.5, cb.y + cb.height * 0.4); await p.waitForTimeout(100);
    const rd = await p.evaluate(() => document.querySelector('#gfx_cn .gfx-a .vk-read').textContent); assert.match(rd, /Mc = /, 'Constructibility: readout of the location (M<sub>c</sub>, QA2)'); assert.ok(await p.$('#gfx_cn .gfx-a .vk-read sub'), 'readout subscript'); }
  assert.deepEqual(errs, [], 'console errors (tabs)');
  // phone width: the graphics fit, no horizontal page scroll
  await p.setViewportSize({ width: 390, height: 800 }); await tab('flex'); await p.waitForSelector('#gfx_fx .gfx-a svg'); await p.waitForTimeout(300);
  const ov = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, w: document.querySelector('#gfx_fx .gfx-a .va-card').getBoundingClientRect().width })); assert.ok(ov.sw <= ov.cw + 2, 'phone width: no horizontal scroll ' + JSON.stringify(ov));
  await shot('tab-flexure-phone');
  assert.deepEqual(errs, [], 'console errors');
  console.log(`ok  graphics (helper and the five tabs; Section properties: 3 cases, tiles, chips, read-out, DXF, resize; Analysis, Flexure, Constructibility in the data-viz style: read-out, click select, chips, resize): ${i0.texts} texts, ${i0.lines} lines; wheel zoom, click select (${sel.sel[0].toFixed(1)} ft), drag pan, double-click fit, DXF download`);
  if (blocked.size) console.log('    blocked requests:', [...blocked].join(', '));
} catch (e) {
  console.log('FAIL', e.message, '\n console errors:', errs.slice(0, 5)); await shot('FAIL'); process.exitCode = 1;
} finally { await b.close(); }
