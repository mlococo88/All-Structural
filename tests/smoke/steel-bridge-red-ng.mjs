#!/usr/bin/env node
// Browser smoke test of the Steel Bridge app (SBNG, 2026-11-24; display only): on every output tab with check items, the worked step that a failing
// check links to is red with an "NG" tag (li.no.ng), a warning's amber with "Warning" (li.no.wn), as #1692 (SBDFH) did on the Cross-frames /
// Diaphragms tab; a step whose ok flag is false but that no failing check links to (a test that only selects a case) stays grey (li.no).
// Headless Chromium (tests/lib.mjs openPage), apps/steel-bridge/index.html, made-up bridges only:
//   thin:    the built-in project with every flange 40 % thinner and 4 in narrower (≥ 12 in) and the webs 1/8 in thinner (≥ 7/16 in)
//   shallow: the built-in project with every web 40 % shallower (≥ 30 in)
// Deck tab (SBNG-DK, 2026-11-24): deck design on with a made-up failing deck (#4 bars at 18 in, #3 longitudinal bars at 18 / 24 in).
// For each tab: the step ids marked ng / wn, the grey steps; a marked step must exist; 0 console errors, 0 KaTeX errors.
//   node tests/smoke/steel-bridge-red-ng.mjs [--tabs flex,fat] [--file <index.html>] [--shots <dir>] [--dump <json>]   (--dump: every step's text, for a main-vs-branch diff)
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const SHOTS = arg('shots'), DUMP = arg('dump'), FILE = arg('file') || path.join(REPO, 'apps/steel-bridge/index.html'), t0 = Date.now(), allErrs = [], dump = {};
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const TABS = arg('tabs') ? arg('tabs').split(',') : ['flex', 'shear', 'fat', 'cn', 'rt', 'wt', 'spl', 'defl', 'an', 'cf', 'dk'];   // --tabs: some of them
const BTN = { flex: '#fx_calc', shear: '#sh_calc', an: '#anCalc', defl: '#df_calc', fat: '#fa_calc', cn: '#cn_calc', spl: '#sp_calc', rt: '#rt_calc', wt: '#wt_calc' };
const variant = { thin: P => { P.girders.forEach(g => g.segments.forEach(s => { s.tw = Math.max(0.4375, s.tw - 0.125); s.botT = Math.max(0.75, s.botT * 0.6); s.topT = Math.max(0.625, s.topT * 0.6); s.botB = Math.max(12, s.botB - 4); s.topB = Math.max(12, s.topB - 4); })); },
  shallow: P => { P.girders.forEach(g => g.segments.forEach(s => { s.D = Math.max(30, s.D * 0.6); })); } };
const seen = {};
for (const vn of Object.keys(variant)) for (const tab of TABS) {
  const { b, p, errs } = await openPage(FILE, { vw: 1440, vh: 1400, dsf: SHOTS ? 2 : undefined, timeout: 90000 });
  try {
    await p.evaluate(([src, tab]) => { const M = window.SBDModel, P = M.defaultProject(); (new Function('P', src))(P); P.project.name = 'Made-up bridge';
      if (tab === 'dk') P.deckDesign = { on: true, sBot: 18, sTop: 18, barTop: 0.2, barBot: 0.2, barLongBot: 0.11, sLongBot: 18, barLongTop: 0.11, sLongTop: 24 };   // SBNG-DK: a made-up failing deck (DK1 to DK6 NG)
      M.save(localStorage, P); localStorage.setItem(M.KEYS.ui, JSON.stringify({ otab: tab, itab: 'proj' })); }, [`(${variant[vn].toString()})(P)`, tab]);
    await p.reload(); await p.waitForTimeout(1500);
    if (BTN[tab]) { for (let k = 0; k < 120; k++) { const st = await p.evaluate(s => { const b = document.querySelector('#out ' + s); return b && b.offsetParent ? 'btn' : document.querySelector('#out .steps li') ? 'done' : 'wait'; }, BTN[tab]);
      if (st === 'done') break; if (st === 'btn') await p.click('#out ' + BTN[tab]).catch(() => {}); await p.waitForTimeout(1000); } }
    await p.waitForSelector('#out .steps li', { state: 'attached', timeout: 120000 }); await p.waitForTimeout(800);
    const collect = () => p.evaluate(() => { const L = [...document.querySelectorAll('#out .steps li[id^="st-"]')];
      return { ng: L.filter(l => l.classList.contains('ng')).map(l => l.id.slice(3)), wn: L.filter(l => l.classList.contains('wn')).map(l => l.id.slice(3)),
        grey: L.filter(l => l.classList.contains('no') && !l.classList.contains('ng') && !l.classList.contains('wn')).map(l => l.id.slice(3)),
        tags: document.querySelectorAll('#out .steps .ngTag').length, kx: document.querySelectorAll('#out .katex-error').length,
        steps: L.map(l => [l.id, l.innerText.replace(/^(NG|Warning)\s+/, '').replace(/\s+/g, ' ').trim()]) }; });
    let r = await collect();
    // select the first row of the tab's tables with a red cell (a failing check), as a user would (the same on main and here, for --dump)
    { const hit = await p.evaluate(() => { const ROW = '[data-sh],[data-fx],[data-fa],[data-rt],[data-wt],[data-sp],[data-cnsel],[data-ohsel]';
        const td = [...document.querySelectorAll('#out td.fx-ng, #out td.cn-ng, #out td.sp-ng')].find(c => c.closest(ROW)); if (!td) return false; td.closest(ROW).click(); return true; });
      if (hit) { await p.waitForTimeout(3000); r = await collect(); } }
    assert.equal(r.tags, r.ng.length + r.wn.length, `${vn} ${tab}: one tag per marked step`); assert.equal(r.kx, 0, `${vn} ${tab}: KaTeX errors`);
    dump[vn + '/' + tab] = r.steps; seen[vn + '/' + tab] = { ng: r.ng, wn: r.wn, grey: r.grey.length };
    if (SHOTS && r.ng.length && !fs.existsSync(path.join(SHOTS, `sb-red-ng-${tab}.png`))) { const el = await p.$(`#out [id="st-${r.ng[0]}"]`);
      const d = await el.evaluateHandle(e => e.closest('details.sg-t') || e.closest('.steps')); await d.evaluate(e => { if (e.tagName === 'DETAILS') e.open = true; });
      await p.waitForTimeout(300); await d.scrollIntoViewIfNeeded(); await d.screenshot({ path: path.join(SHOTS, `sb-red-ng-${tab}.png`) }); }
    console.log(`  ok   ${vn} ${tab}: ${r.ng.length} NG [${r.ng.slice(0, 4).join(', ')}${r.ng.length > 4 ? ', …' : ''}], ${r.wn.length} warning [${r.wn.slice(0, 3).join(', ')}], ${r.grey.length} grey (case selection), ${r.steps.length} steps`);
    allErrs.push(...errs.map(e => `${vn} ${tab}: ${e}`));
  } finally { await b.close(); }
}
if (DUMP) fs.writeFileSync(DUMP, JSON.stringify(dump));
assert.deepEqual(allErrs, [], 'console errors');
// the thin bridge fails flexure (GS7), the stiffeners and the splices: each of these tabs marks a failing step red
for (const k of ['thin/flex', 'thin/shear', 'thin/spl', 'thin/dk'].filter(k => seen[k] || !arg('tabs'))) assert.ok(seen[k] && seen[k].ng.length, `${k}: a red NG step`);
console.log(`steel-bridge-red-ng: all checks passed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
