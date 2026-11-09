#!/usr/bin/env node
// Browser smoke test of the Steel Bridge app's left check summary column (2026-11-09; ui/dash.js), headless Chromium (tests/lib.mjs openPage):
//   1. 1440 px: the column is at the far left (left of the input panel), 240 px; 11 chips, all "not run" on a fresh page; the input
//      panel keeps a third of the rest.
//   2. A chip of a module not run (Shear) runs it and opens its tab with the girder selected; the card that works the value flashes.
//   3. "Run all": the header (verdict, max D/C, governing check) and every chip equal the Summary's data (SBDSummary.overall / grpStat);
//      ▸ opens the per-girder values; the Flexure chip opens the Flexure tab and flashes the card.
//   4. An input change: the values stay, marked out of date.
//   5. « shrinks it to 42 px, kept in sbd2.dashCollapsed_v1 across a reload; » opens it again.
//   6. 1600 px: 280 px. 1199 px: not shown, the input panel 33 % as before. Print: not shown. 0 console errors.
//   node tests/smoke/steel-bridge-dash.mjs [--shots <dir>]
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const ai = process.argv.indexOf('--shots'), SHOTS = ai > 0 ? process.argv[ai + 1] : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const shot = async (p, n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + '.png') }); };
const t0 = Date.now();
const { b, p, errs } = await openPage(path.join(REPO, 'apps/steel-bridge/index.html'), { vw: 1440, vh: 1000 });
const W = () => p.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(); return { dash: r('sbDashCol').width, dashL: r('sbDashCol').left, inL: r('inputPanel').left, inp: r('inputPanel').width, out: r('outputPanel').width, app: r('app').width }; });
const flashed = tab => p.waitForFunction(t => document.querySelector('#tabBar [aria-selected="true"]').dataset.otab === t && document.querySelector('#out .sum-flash'), tab, { timeout: 120000 });
try {
  // 1
  await p.waitForSelector('#sbDashCol .sdChip');
  let w = await W(); assert.equal(w.dash, 240); assert.ok(w.dashL < w.inL, 'the column is left of the input panel'); assert.ok(Math.abs(w.inp - (w.app - 240) * 0.33) < 2, JSON.stringify(w));
  const c0 = await p.evaluate(() => [...document.querySelectorAll('#sbDashCol .sdChip')].map(c => [c.dataset.sdgrp, c.querySelector('.sdVal').textContent]));
  assert.deepEqual(c0.map(c => c[0]), ['Flexure', 'Shear', 'Stiffeners', 'Fatigue', 'Studs', 'Constructibility', 'Cross-frames', 'Field splices', 'Welds', 'Deflection', 'Rating']);
  assert.ok(c0.every(c => c[1] === 'not run'), JSON.stringify(c0));
  await shot(p, 'dash-notrun-1440');
  console.log(`  ok   1440 px: column ${w.dash} px at the far left, input panel ${w.inp.toFixed(0)} px, output ${w.out.toFixed(0)} px; 11 chips "not run"`);
  // 2
  await p.click('#sbDashCol [data-sdgrp="Shear"] .sdMain');
  await flashed('shear');
  await p.waitForFunction(() => /PASS|FAIL|REVIEW/.test(document.querySelector('#sbDashCol [data-sdgrp="Shear"] .sdSt').textContent));
  assert.equal(await p.evaluate(() => document.querySelector('#sbDashCol [data-sdgrp="Flexure"] .sdVal').textContent), 'not run', 'only the module clicked ran');
  console.log('  ok   a chip not run: runs its module, opens the Shear tab, flashes the card');
  // 3
  await p.click('#sbDashRun');
  await p.waitForFunction(() => { const s = window.SBDSummaryUI.state(); return !s.busy && s.list.length && Object.values(s.list[0].cells).every(q => q.st !== 'notrun'); }, null, { timeout: 300000 });
  await p.waitForTimeout(200);
  const m = await p.evaluate(() => { const st = window.SBDSummaryUI.state(), S = window.SBDSummary, ov = S.overall(null, st.list), U = window.SharedUnits, bad = [];
    S.GROUPS.forEach(g => { const z = S.grpStat(st.list, g), el = document.querySelector(`#sbDashCol [data-sdgrp="${g}"]`), q = z.gov;
      const want = q ? `${q.c.rf ? 'RF ' + U.fmt(q.q.rf, 2) : U.fmt(q.q.r, 3)} · ${q.G.label}` : 'n/a';
      if (el.querySelector('.sdVal').textContent !== want || !el.classList.contains('sd-' + z.st)) bad.push(`${g}: ${el.querySelector('.sdVal').textContent} vs ${want}`); });
    return { bad, verd: document.querySelector('#sbDashCol .sdVerd').textContent, gov: document.querySelector('#sbDashCol .sdGov').textContent, top: U.fmt(ov.top.q.r, 3), n: ov.n }; });
  assert.deepEqual(m.bad, []); assert.match(m.verd, new RegExp(`^FAIL · max D/C ${m.top}`)); assert.match(m.gov, /Flexure, Strength I, G1: D\/C 1\.229/);
  assert.match(await p.evaluate(() => document.querySelector('#sbDashHead .sdC').textContent), new RegExp(`^${m.n.fail} FAIL`));
  await p.click('#sbDashCol [data-sdx="Flexure"]'); assert.equal(await p.evaluate(() => document.querySelectorAll('#sbDashCol [data-sdgrp="Flexure"] .sdList li').length), 3);
  await shot(p, 'dash-1440');
  await p.click('#sbDashCol [data-sdgrp="Flexure"] .sdMain'); await flashed('flex');
  await shot(p, 'dash-click-flexure');
  console.log(`  ok   Run all: header "${m.verd.trim()}", ${m.gov.trim()}; 11 chips equal the Summary's data; Flexure chip → Flexure tab, card flashed`);
  // 4
  await p.click('#inTabs [data-itab="mat"]'); await p.fill('#i_materials\\.concrete\\.fc', '4.5'); await p.$eval('#i_materials\\.concrete\\.fc', e => e.blur());
  await p.waitForFunction(() => /out of date/.test(document.querySelector('#sbDashCol').textContent));
  assert.notEqual(await p.evaluate(() => document.querySelector('#sbDashCol [data-sdgrp="Flexure"] .sdVal').textContent), 'not run');
  console.log('  ok   an input change: the values stay, marked out of date');
  // 5
  await p.click('#sbDashTgl'); w = await W(); assert.equal(w.dash, 42); assert.equal(await p.evaluate(() => localStorage.getItem('sbd2.dashCollapsed_v1')), '1');
  await p.reload(); await p.waitForSelector('#sbDashTgl'); w = await W(); assert.equal(w.dash, 42, 'kept across a reload');
  await shot(p, 'dash-collapsed-1440');
  await p.click('#sbDashTgl'); w = await W(); assert.equal(w.dash, 240); assert.equal(await p.evaluate(() => localStorage.getItem('sbd2.dashCollapsed_v1')), '0');
  console.log('  ok   « shrinks to 42 px (kept in sbd2.dashCollapsed_v1 across a reload); » opens it');
  // 6
  await p.setViewportSize({ width: 1600, height: 1000 }); await p.waitForTimeout(150); w = await W(); assert.equal(w.dash, 280);
  await p.setViewportSize({ width: 1200, height: 900 }); await p.waitForTimeout(150); w = await W(); assert.equal(w.dash, 240); await shot(p, 'dash-1200');
  const w1200 = w;
  await p.setViewportSize({ width: 1199, height: 900 }); await p.waitForTimeout(150); w = await W(); assert.equal(w.dash, 0); assert.ok(Math.abs(w.inp - w.app * 0.33) < 2, JSON.stringify(w));
  await p.setViewportSize({ width: 1440, height: 1000 }); await p.emulateMedia({ media: 'print' }); assert.equal(await p.evaluate(() => getComputedStyle(document.getElementById('sbDashCol')).display), 'none'); await p.emulateMedia({ media: 'screen' });
  console.log(`  ok   1600 px: 280 px; 1200 px: 240 px (input ${w1200.inp.toFixed(0)} px, output ${w1200.out.toFixed(0)} px); 1199 px: not shown; print: not shown`);
  assert.deepEqual(errs, [], 'console errors');
  console.log(`steel-bridge-dash: all passed, 0 console errors (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
} finally { await b.close(); }
