#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), WIDE (engineer, 2026-11-25): "Widen inputs" and the input figures opened enlarged (ui/widein.js).
// Headless Chromium, file://, the CDN libraries from tests/libs. A new project, the splitter dragged before (psb2.splitRatio_v1 = 0.45):
//   1. "⤢ Widen inputs" (aria-pressed): the input panel over the whole width of #main; the output panel's content, the splitter and the
//      check summary column hidden; window "resize" and "psb2:panelresize" fired; the Strands sub-tab draws the strand pattern and the
//      editor larger; "⤡ Back to outputs": every width as before (the dragged splitter width), --sbIn and psb2.splitRatio_v1 unchanged,
//      no storage written by the toggle;
//   2. a link from the inputs to an output tab (data-gotab, the Plan card's "3D view") turns wide mode off first;
//   3. below 900 px the button is not shown; print hides it;
//   4. the strand pattern clicked: a dialog with the figure at the dialog's size, no id twice in the page; Escape closes it, emptied;
//      the plan by Enter on the focused figure, closed by a click on the backdrop; the strand editor's "⤢ Enlarge" opens its view,
//      Close closes it, and the editor still edits (a strand clicked opens its row). 0 console errors.
//   node tests/smoke/ps-bridge-wide.mjs [--shots <dir>]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shots = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--shots'));
let n = 0; const ok = m => { n++; console.log('  ok  ', m); }; const t0 = Date.now();
const { b, p, errs } = await openPage(path.join(REPO, 'apps/ps-bridge/index.html'), { vw: 1500, vh: 900, ls: { 'psb2.splitRatio_v1': '0.4500', 'psb2.ui': JSON.stringify({ itab: 'gird', otab: 'sum', gsub: 'str' }) } });
const geo = () => p.evaluate(() => { const w = id => Math.round(document.getElementById(id).getBoundingClientRect().width * 10) / 10, vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; };
  return { main: w('main'), inp: w('inputPanel'), out: w('outputPanel'), dash: w('sbDashCol'), split: w('sbSplit'), outVis: vis('out'), tabBarVis: vis('tabBar'), dashVis: vis('sbDashCol'), splitVis: vis('sbSplit'), sbIn: document.getElementById('main').style.getPropertyValue('--sbIn') }; });
const store = () => p.evaluate(() => Object.keys(localStorage).sort().filter(k => k !== 'psb2.ui').map(k => k + '=' + localStorage.getItem(k)));
const dups = () => p.evaluate(() => { const c = {}; document.querySelectorAll('[id]').forEach(e => { c[e.id] = (c[e.id] || 0) + 1; }); return Object.keys(c).filter(k => c[k] > 1).sort(); });
const pressed = () => p.evaluate(() => document.getElementById('bWide').getAttribute('aria-pressed'));
try {
  await p.waitForFunction(() => window.PSBWideIn && document.getElementById('out').innerText.length > 50 && document.querySelector('#gfx_strands_in svg'), null, { timeout: 120000 });
  // 1.
  const g0 = await geo(), s0 = await store(), f0 = await p.evaluate(() => [document.querySelector('#gfx_strands_in svg').getBoundingClientRect().width, document.querySelector('#strandEditHost svg').getBoundingClientRect().width]);
  assert.ok(g0.outVis && g0.dashVis && g0.splitVis && g0.sbIn, 'the side-by-side layout with a dragged splitter ' + JSON.stringify(g0));
  assert.equal(await pressed(), 'false'); assert.match(await p.textContent('#bWide'), /Widen inputs/);
  await p.evaluate(() => { window.__ev = { pr: 0, rs: 0 }; window.addEventListener('psb2:panelresize', () => window.__ev.pr++); window.addEventListener('resize', () => window.__ev.rs++); });
  await p.click('#bWide'); await p.waitForTimeout(600);
  const g1 = await geo(), ev1 = await p.evaluate(() => window.__ev);
  assert.equal(await pressed(), 'true'); assert.match(await p.textContent('#bWide'), /Back to outputs/);
  assert.ok(!g1.outVis && !g1.tabBarVis && !g1.dashVis && !g1.splitVis, 'outputs, summary column and splitter hidden ' + JSON.stringify(g1));
  assert.ok(Math.abs(g1.inp - g1.main) < 1, `input panel ${g1.inp} = #main ${g1.main}`);
  assert.ok(ev1.pr >= 1 && ev1.rs >= 1, 'resize events ' + JSON.stringify(ev1));
  await p.waitForSelector('#gfx_strands_in svg'); await p.waitForTimeout(300);
  const f1 = await p.evaluate(() => [document.querySelector('#gfx_strands_in svg').getBoundingClientRect().width, document.querySelector('#strandEditHost svg').getBoundingClientRect().width]);
  assert.ok(f1[0] > f0[0] * 1.3 && f1[1] >= f0[1], `figures larger: strand pattern ${f0[0]} → ${f1[0]} px, editor ${f0[1]} → ${f1[1]} px`);
  if (shots) await p.screenshot({ path: path.join(shots, 'ps-wide-strands.png') });
  ok(`Widen inputs: the input panel ${g0.inp} → ${g1.inp} px (all of #main); outputs, check summary and splitter hidden; ${ev1.pr} psb2:panelresize, ${ev1.rs} resize; strand pattern ${Math.round(f0[0])} → ${Math.round(f1[0])} px`);
  await p.click('#bWide'); await p.waitForTimeout(600);
  const g2 = await geo();
  assert.deepEqual(g2, g0, 'the layout as before'); assert.deepEqual(await store(), s0, 'no storage written by the toggle (psb2.splitRatio_v1 kept)');
  assert.equal(await pressed(), 'false');
  ok(`Back to outputs: every width as before (input ${g2.inp}, output ${g2.out}, --sbIn ${g2.sbIn}); psb2.splitRatio_v1 and every key unchanged`);
  // 2.
  await p.click('#bWide'); await p.click('#inTabs [data-itab="layout"]'); await p.waitForSelector('#psbPlan a[data-gotab="3d"]');
  await p.click('#psbPlan a[data-gotab="3d"]'); await p.waitForTimeout(500);
  assert.equal(await pressed(), 'false'); assert.equal(await p.evaluate(() => document.querySelector('#tabBar [aria-selected="true"]').dataset.otab), '3d');
  assert.deepEqual(await geo(), g0);
  ok('a link from the inputs to an output tab (Plan card → 3D view): wide mode off first, the tab shown, the layout as before');
  // 3.
  await p.emulateMedia({ media: 'print' }); assert.equal(await p.evaluate(() => getComputedStyle(document.getElementById('inTabRow')).display), 'none'); assert.equal(await p.isVisible('#bWide'), false); await p.emulateMedia({ media: 'screen' });
  await p.setViewportSize({ width: 800, height: 900 }); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => getComputedStyle(document.getElementById('bWide')).display), 'none');
  await p.setViewportSize({ width: 1500, height: 900 }); await p.waitForTimeout(300);
  ok('not shown below 900 px (stacked panels) nor in print');
  // 4. the figures enlarged
  await p.click('#tabBar [data-otab="sum"]'); await p.click('#inTabs [data-itab="gird"]'); await p.click('#gSubs [data-gsub="str"]'); await p.waitForSelector('#gfx_strands_in svg');
  const d0 = await dups();
  await p.click('#gfx_strands_in .vk-fig svg, #gfx_strands_in svg', { position: { x: 30, y: 30 } }); await p.waitForSelector('#figZoomDlg[open]');
  const o1 = await p.evaluate(() => { const d = document.getElementById('figZoomDlg'), s = d.querySelector('#figZoomBody svg'); return { ttl: d.querySelector('#figZoomTtl').textContent, n: d.querySelectorAll('#figZoomBody svg').length, w: s.getBoundingClientRect().width, src: document.querySelector('#gfx_strands_in svg').getBoundingClientRect().width }; });
  assert.equal(o1.ttl, 'Strand pattern'); assert.ok(o1.n >= 1 && o1.w > o1.src * 1.5, 'drawn larger ' + JSON.stringify(o1));
  assert.deepEqual(await dups(), d0, 'no id twice (beyond those before)');
  if (shots) await p.screenshot({ path: path.join(shots, 'ps-fig-overlay.png') });
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => document.getElementById('figZoomDlg').open), false);
  assert.equal(await p.evaluate(() => document.querySelectorAll('#figZoomBody *, [id^="fz"]').length), 0, 'emptied, no copied id left');
  ok(`the strand pattern clicked: a dialog, the figure ${Math.round(o1.src)} → ${Math.round(o1.w)} px, no duplicate id; Escape closes it, emptied`);
  await p.click('#inTabs [data-itab="layout"]'); await p.waitForSelector('#gfx_plan svg');
  const dl = await dups(); await p.focus('#gfx_plan'); await p.keyboard.press('Enter'); await p.waitForSelector('#figZoomDlg[open]');
  assert.equal(await p.textContent('#figZoomTtl'), 'Plan'); assert.deepEqual(await dups(), dl, 'no id twice');
  await p.mouse.click(8, 450); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => document.getElementById('figZoomDlg').open), false, 'a click on the backdrop closes it');
  ok('the plan: Enter on the focused figure opens it; a click on the backdrop closes it');
  await p.click('#inTabs [data-itab="gird"]'); await p.waitForSelector('#card-strandEdit [data-figzoom-for]');
  await p.click('#card-strandEdit [data-figzoom-for]'); await p.waitForSelector('#figZoomDlg[open]');
  assert.match(await p.textContent('#figZoomTtl'), /Edit strands on the section/); assert.ok(await p.evaluate(() => document.querySelectorAll('#figZoomBody svg').length >= 1));
  await p.click('#figZoomClose'); await p.waitForTimeout(200); assert.equal(await p.evaluate(() => document.getElementById('figZoomDlg').open), false);
  const i0 = await p.evaluate(() => PSBModel.load(localStorage).project.base.rows.findIndex(r => r.y === 2));
  await p.click(`#strandEditHost circle[data-se="pick"][data-ri="${i0}"]`); await p.waitForSelector('#seRow');
  assert.match(await p.textContent('#seRow'), /Row \d+: \d+ strands at y = 2 in/);
  ok('the strand editor: "⤢ Enlarge" opens its view, Close closes it; a strand clicked still opens its row (editable)');
  assert.deepEqual(errs, []); ok('0 console errors');
} finally { await b.close(); }
console.log(`\nps-bridge-wide: ${n} checks passed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
