#!/usr/bin/env node
// Browser smoke test of the Steel Bridge app's Summary output tab (2026-11-09; ui/summary.js, report/summary.js), headless Chromium
// (tests/lib.mjs openPage), apps/steel-bridge/index.html:
//   1. Summary is the first output tab; selecting it runs every module (progress "Running … (k/n)…"), then "Up to date"; the verdict,
//      the per-girder table (one row per girder, a cell per column) and every cell's text equal the Summary's data (SBDSummaryUI.state()).
//   2. Each column's link opens its output tab with the girder selected and flashes the card / step that works the value.
//   3. Back to the Summary: shown at once (nothing runs). An input change while it is open: "Inputs changed — updating…", then runs.
//      Re-run all runs again.
//   4. A skewed three-span project with two plate girders: two rows; the G2 link selects G2 (ui.g).
//   5. An old saved ui.otab ('flex') still opens its tab; the Report's summary links to the Summary tab.
//   6. At 390 px: no page-level horizontal scroll (the table scrolls inside its card).
//   7. The cross-section and framing plan graphics (GFXS): side by side at 1440 px, stacked within 390 px, their links, printed.
//   0 console errors.
//   node tests/smoke/steel-bridge-summary.mjs [--shots <dir>]
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const ai = process.argv.indexOf('--shots'), SHOTS = ai > 0 ? process.argv[ai + 1] : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const shot = async (p, n, o) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + '.png'), ...(o || {}) }); };
const FILE = path.join(REPO, 'apps/steel-bridge/index.html');
const upToDate = p => p.waitForFunction(() => /Up to date/.test((document.querySelector('#out .sum-run') || {}).textContent || ''), null, { timeout: 300000 });
const t0 = Date.now(), allErrs = [];

/* the table's cells against the Summary's data (the text of each value) */
async function cellsMatch(p) {
  const r = await p.evaluate(() => {
    const st = window.SBDSummaryUI.state(), COLS = window.SBDSummary.COLS, U = window.SharedUnits, bad = [];
    st.list.forEach(G => COLS.forEach(c => { const q = G.cells[c.id], a = document.querySelector(`#sum-table a[data-sumgo="${G.gi}|${c.id}"]`);
      const want = q.st === 'notrun' ? 'not run' : q.st === 'na' ? 'n/a' : c.rf ? U.fmt(q.rf, 2) : isFinite(q.r) ? U.fmt(q.r, 3) : q.r === Infinity ? '∞' : q.r === -Infinity ? '−∞' : 'NaN';   // QA2: ∞ for Infinity (NaN only for a true NaN)
      if (!a || a.textContent !== want || !a.closest('td').classList.contains('s-' + q.st)) bad.push(`${G.label} ${c.id}: ${a && a.textContent} vs ${want}`); }));
    return { bad, rows: document.querySelectorAll('#sum-table tbody tr').length, n: st.list.length };
  });
  assert.deepEqual(r.bad, []); assert.equal(r.rows, r.n); return r;
}

{ // 1–3: default project
  const { b, p, errs } = await openPage(FILE, { vw: 1440, vh: 1000 });
  try {
    assert.equal(await p.evaluate(() => document.querySelector('#tabBar [data-otab]').dataset.otab), 'sum', 'Summary is the first output tab');
    const s0 = Date.now();
    await p.click('#tabBar [data-otab="sum"]');
    await p.waitForFunction(() => /Running .*\(\d+\/\d+\)/.test((document.querySelector('#out .sum-run') || {}).textContent || ''), null, { timeout: 10000 });
    await upToDate(p); const runS = (Date.now() - s0) / 1000;
    const v = await p.evaluate(() => ({ badge: document.querySelector('.sum-badge').textContent, gov: document.querySelector('.sum-gov').innerText, run: document.querySelector('.sum-run').innerText }));
    assert.equal(v.badge, 'FAIL'); assert.match(v.gov, /^Governing: Flexure, Strength I, girder G1, x = 249\.99 ft: GS7 .*D\/C 1\.229/);
    await cellsMatch(p);
    console.log(`  ok   default project: ${runS.toFixed(1)} s to "Up to date" (${v.run.split('\n')[0]}); ${v.gov.split('\n')[0].slice(0, 120)}`);
    await shot(p, 'sum-default-1440');
    // 2. each column's link
    const cols = await p.evaluate(() => window.SBDSummary.COLS.map(c => [c.id, c.tab]));
    for (const [id, tab] of cols) {
      await p.click('#tabBar [data-otab="sum"]'); await upToDate(p);
      await p.click(`#sum-table a[data-sumgo="0|${id}"]`);
      await p.waitForFunction(t => document.querySelector('#tabBar [aria-selected="true"]').dataset.otab === t && document.querySelector('#out .sum-flash'), tab, { timeout: 60000 });
      if (id === 'flexStr') await shot(p, 'link-flexure');
    }
    console.log(`  ok   ${cols.length} column links open their tab and flash the card that works the value`);
    // 3. back: at once; input change; Re-run all
    await p.click('#tabBar [data-otab="sum"]');
    assert.match(await p.evaluate(() => document.querySelector('#out .sum-run').innerText), /Up to date/, 'shown at once');
    await p.click('#inTabs [data-itab="mat"]'); await p.fill('#i_materials\\.concrete\\.fc', '4.5'); await p.$eval('#i_materials\\.concrete\\.fc', e => e.blur());   // the browser's own change event
    // the page is busy during the girder analysis (one computation): wait for the run's status, or a new "Up to date"
    await p.waitForFunction(() => /Inputs changed|Running/.test(document.querySelector('#out .sum-run').innerText) || !window.SBDSummaryUI.state().busy && /"fc":4\.5/.test(window.SBDSummaryUI.state().pk) && window.SBDSummaryUI.state().secs != null, null, { timeout: 60000 });
    await upToDate(p);
    await p.evaluate(() => { window.__sumRuns = 0; window.SBDSummaryUI.subscribe(s => { if (s.busy) window.__sumRuns++; }); });
    await p.click('#sum_rerun'); await upToDate(p); assert.ok(await p.evaluate(() => window.__sumRuns > 0), 'Re-run all ran');
    await cellsMatch(p);
    console.log('  ok   cached at once; an input change re-runs; Re-run all');
    // 5. the Report's summary links to the Summary tab
    await p.click('#tabBar [data-otab="rpt"]'); await p.click('#rp_build'); await p.waitForSelector('.rp-doc a[data-rpgoto="sum"]', { timeout: 120000 });
    await p.click('.rp-doc a[data-rpgoto="sum"]'); await p.waitForFunction(() => document.querySelector('#tabBar [aria-selected="true"]').dataset.otab === 'sum');
    console.log('  ok   the Report links to the Summary tab');
    allErrs.push(...errs);
  } finally { await b.close(); }
}

{ // 4: skewed three-span, two girders (saved as the open project, then the page reloaded); 6: phone
  const { b, p, errs } = await openPage(FILE, { vw: 1440, vh: 1000 });
  try {
    await p.evaluate(() => { const M = window.SBDModel, P = M.defaultProject(); P.project.name = 'Summary smoke: skewed';
      P.spans.lengths = [100, 130, 100]; P.xs.skews = [35, 30, 30, 35];
      const pos = { D: 60, tw: 0.5625, topB: 16, topT: 0.75, botB: 18, botT: 1.25 }, neg = { D: 60, tw: 0.5625, topB: 18, topT: 1.5, botB: 18, botT: 2 };
      const segs = () => [{ x0: 0, x1: 80, ...pos }, { x0: 80, x1: 120, ...neg }, { x0: 120, x1: 210, ...pos }, { x0: 210, x1: 250, ...neg }, { x0: 250, x1: 330, ...pos }];
      P.girders = [{ id: 'G1', label: 'G1', position: 'exterior', beff: 102, segments: segs() }, { id: 'G2', label: 'G2', position: 'interior', beff: 114, segments: segs() }];
      P.framing.splices = [70, 165, 260]; M.save(localStorage, P); localStorage.setItem(M.KEYS.ui, JSON.stringify({ otab: 'sum' })); });
    await p.reload();
    const s0 = Date.now(); await upToDate(p); const runS = (Date.now() - s0) / 1000;
    const r = await cellsMatch(p); assert.equal(r.n, 2);
    // SBCON (2026-11-10): Constructibility finite on both girders (was ∞, shown "NaN": F_nc 0.91 ksi at G1 x = 130.00, 0.16 ksi at G2 x = 70.00);
    // both now govern on GS15 tension at x = 100.01 ft (engine values 0.5129, 0.6392)
    const cn = await p.evaluate(() => window.SBDSummaryUI.state().list.map(G => G.cells.cn.r));
    assert.ok(cn.every(v => isFinite(v)), `Constructibility finite: ${cn}`); assert.deepEqual(cn.map(v => +v.toFixed(3)), [0.513, 0.639], `Constructibility G1, G2: ${cn}`);
    await shot(p, 'sum-skewed-1440');
    await p.click('#sum-table a[data-sumgo="1|shear"]');
    await p.waitForFunction(() => document.querySelector('#tabBar [aria-selected="true"]').dataset.otab === 'shear' && document.querySelector('#out .sum-flash'), null, { timeout: 60000 });
    assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('sbd2.ui')).g), 1, 'the G2 link selects G2');
    console.log(`  ok   skewed three-span, two girders: ${runS.toFixed(1)} s; the G2 link selects G2`);
    // 6. phone
    await p.click('#tabBar [data-otab="sum"]'); await upToDate(p);
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
    const ph = await p.evaluate(() => { const t = document.querySelector('#sum-table .tscroll'); return { sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, w: innerWidth, tw: t.scrollWidth, cw: t.clientWidth }; });
    assert.ok(ph.sw <= ph.w && ph.bw <= ph.w, `page scrolls sideways at 390 px: ${JSON.stringify(ph)}`); assert.ok(ph.tw > ph.cw, 'the table scrolls inside its card');
    await p.evaluate(() => document.getElementById('sum-verdict').scrollIntoView()); await shot(p, 'sum-phone-390');
    await p.evaluate(() => document.getElementById('sum-table').scrollIntoView()); await shot(p, 'sum-phone-390-table');
    console.log(`  ok   390 px: no page-level horizontal scroll (page ${ph.sw} px; table ${ph.tw} px in a ${ph.cw} px card)`);
    allErrs.push(...errs);
  } finally { await b.close(); }
}

{ // 5: an old saved ui.otab opens its tab
  const { b, p, errs } = await openPage(FILE, { vw: 1200, vh: 900, ls: { 'sbd2.ui': JSON.stringify({ itab: 'proj', otab: 'flex', g: 0 }) } });
  try {
    await p.waitForSelector('#out #fx_src');
    assert.equal(await p.evaluate(() => document.querySelector('#tabBar [aria-selected="true"]').dataset.otab), 'flex');
    console.log('  ok   an old saved ui.otab (flex) opens its tab');
    allErrs.push(...errs);
  } finally { await b.close(); }
}

{ // 7 (GFXS): the cross-section and framing plan graphics: the app's own drawings, side by side from 1200 px, stacked and fitting at 390 px,
  //   links to the input tabs where they are edited and the tabs where they are drawn, printed
  const { b, p, errs } = await openPage(FILE, { vw: 1440, vh: 1000, ls: { 'sbd2.ui': JSON.stringify({ otab: 'sum' }) } });
  try {
    await p.waitForSelector('#sum-xs svg'); await p.waitForSelector('#sum-plan svg');
    const g = await p.evaluate(() => { const a = document.getElementById('sum-xs').getBoundingClientRect(), c = document.getElementById('sum-plan').getBoundingClientRect(), v = document.getElementById('sum-verdict').getBoundingClientRect(), o = document.getElementById('sum-project').getBoundingClientRect();
      return { side: Math.abs(a.top - c.top) < 2 && c.left > a.right - 1, nearTop: a.top > v.top && a.top < o.top, txt: document.getElementById('sum-xs').textContent };});
    assert.ok(g.side, 'side by side at 1440 px'); assert.ok(g.nearTop, 'after the verdict, before the overview'); assert.match(g.txt, /TYPICAL CROSS-SECTION/);
    await p.evaluate(() => document.getElementById('sum-gfx').scrollIntoView()); await shot(p, 'gfx-1440');
    await p.click('#sum-xs [data-sumin="xsec"]'); assert.equal(await p.evaluate(() => document.querySelector('#inTabs [aria-selected="true"]').dataset.itab), 'xsec');
    await p.click('#sum-plan [data-sumin="framing"]'); assert.equal(await p.evaluate(() => document.querySelector('#inTabs [aria-selected="true"]').dataset.itab), 'framing');
    await p.click('#sum-xs [data-sumtab="dwg"]'); await p.waitForFunction(() => document.querySelector('#tabBar [aria-selected="true"]').dataset.otab === 'dwg');
    await p.click('#tabBar [data-otab="sum"]'); await p.waitForSelector('#sum-plan svg');
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
    const ph = await p.evaluate(() => { const a = document.getElementById('sum-xs').getBoundingClientRect(), c = document.getElementById('sum-plan').getBoundingClientRect();
      return { stacked: c.top >= a.bottom - 1, sw: document.documentElement.scrollWidth, w: innerWidth, over: [...document.querySelectorAll('#sum-gfx svg')].some(s => s.getBoundingClientRect().right > innerWidth) }; });
    assert.ok(ph.stacked && ph.sw <= ph.w && !ph.over, JSON.stringify(ph));
    await p.evaluate(() => document.getElementById('sum-gfx').scrollIntoView()); await shot(p, 'gfx-390');
    await p.emulateMedia({ media: 'print' });
    assert.ok(await p.evaluate(() => getComputedStyle(document.getElementById('sum-gfx')).display !== 'none' && document.querySelectorAll('#sum-gfx svg').length === 2));
    await p.emulateMedia({ media: 'screen' });
    console.log('  ok   cross-section and framing plan: side by side at 1440 px, stacked within 390 px, links to Cross-section / Framing & bracing / Drawings, printed');
    allErrs.push(...errs);
  } finally { await b.close(); }
}

assert.deepEqual(allErrs, [], 'console errors');
console.log(`steel-bridge-summary: all passed, 0 console errors (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
