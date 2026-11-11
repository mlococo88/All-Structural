#!/usr/bin/env node
// Bridge Substructure Loading (SubLoads): show the work on the tabs (SLWS, CLAUDE.md §6; display only):
//   - every load tab (Dead load, Earth loads, Live load, Braking and centrifugal, Wind, Temperature, Water and scour, Ice, Seismic,
//     Vessel collision, Vehicle collision, Combinations) ends with a "Worked steps" card for the selected unit whose steps are the Report's
//     own step objects (the same labels, equations, substitutions and values: slrModel), with a "see §n.m" link per topic that opens the
//     Report at that step, and a line at the top of the tab linking to the card;
//   - Combinations, Pier 1: Strength I P max worked as γ DC + γ DW + γ EV + γ_LL(LL + IM) = 1.25 · 1659.58 + … = 3494.2 kip (the Report's step);
//   - the card is not part of the tab HTML the Report's calculation package reads (no "Worked steps for this tab" in the Report);
//   - the Report's step labels and topic lines set M_t, M_l, V_t, V_l as subscripts on screen (no plain "M_t" left), its plain text unchanged;
//   - no card while an input is invalid; 390 px no sideways scroll; 0 console errors.
//   node tests/smoke/bsl-show-work.mjs [--shots <dir>]
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const FILE = process.env.BSL_FILE || path.join(REPO, 'Bridge Substructure Loading.html');
const SHOTS = (() => { const i = process.argv.indexOf('--shots'); return i > 0 ? process.argv[i + 1] : null; })();
let fails = 0;
const ok = async (m, f) => { try { await f(); console.log('  ok   ' + m); } catch (e) { fails++; console.log('  FAIL ' + m + ': ' + String(e.message).slice(0, 500)); } };
const ready = p => p.waitForFunction(() => typeof MODEL !== 'undefined' && MODEL && MODEL.G && window.SubLoadsWorked).then(() => p.waitForTimeout(700));
const errsAll = [];
const water = fs.readFileSync(path.join(REPO, 'tests', 'projects', 'bsl', 'water_wall.json'), 'utf8');

{
  const o = await openPage(FILE, { vw: 1440, vh: 1000 }), { p } = o; errsAll.push(o.errs);
  try {
    await ready(p);
    for (const [name, proj] of [['default', null], ['water_wall', water]]) {
      if (proj) await p.evaluate(j => openProject(JSON.parse(j), 'water_wall.json'), proj);
      await ok(`${name}: every load tab and unit has its card, the Report's steps one for one, a "see §" per topic and the top link`, async () => {
        const r = await p.evaluate(async () => { const bad = [], seen = {};
          for (const t of ['dl', 'earth', 'll', 'brce', 'wind', 'temp', 'water', 'ice', 'eq', 'cv', 'ct', 'combo']) for (let k = 0; k < P.units.length; k++) {
            P.ui.sel = k; showTab(t); await new Promise(r => setTimeout(r, 20)); const T = SubLoadsWorked.topicsFor(t, k), c = document.querySelector(`#tab-${t} .slw-card`);
            const want = T.reduce((a, x) => a + x.steps.length, 0); if (!want) { if (c) bad.push(`${t}/${k}: card without topics`); continue; }
            seen[t] = (seen[t] || 0) + 1;
            if (!c) { bad.push(`${t}/${k}: no card`); continue; }
            const li = c.querySelectorAll('ol.steps li'), see = c.querySelectorAll('[data-slw-rpt]'), top = document.querySelector(`#tab-${t} > .slw-top [data-slw-jump]`);
            if (li.length !== want) bad.push(`${t}/${k}: ${li.length} steps vs ${want}`); if (see.length !== T.length) bad.push(`${t}/${k}: ${see.length} links vs ${T.length}`); if (!top) bad.push(`${t}/${k}: no top link`);
            T.forEach((x, i) => x.steps.forEach((s, j) => { const txt = SharedSteps.line(s, false); if (typeof s.value === 'number' && !li[T.slice(0, i).reduce((a, y) => a + y.steps.length, 0) + j].textContent.includes(SharedSteps.fmt(s.value, s.d))) bad.push(`${t}/${k}: step ${s.id} value`); }));
          }
          return { bad, seen }; });
        assert.deepEqual(r.bad, []); ['dl', 'll', 'brce', 'wind', 'temp', 'combo', 'earth'].forEach(t => assert.ok(r.seen[t] > 0, 'no card on ' + t));
        if (name === 'water_wall') ['water', 'ice', 'cv'].forEach(t => assert.ok(r.seen[t] > 0, 'no card on ' + t));
      });
    }
    await p.evaluate(() => { P = defP(); syncSupports(); buildTabs(); buildSide(); recompute(); });
    await ok('Combinations, Pier 1: Strength I P max = 1.25 · 1659.58 + 1.50 · 145.70 + 1.35 · 248.60 + 1.75 · 494.59 = 3494.2 kip; "see §5.3" opens the Report at it', async () => {
      const r = await p.evaluate(async () => { P.ui.sel = 1; showTab('combo'); await new Promise(r => setTimeout(r, 100)); const c = document.querySelector('#tab-combo .slw-card'), li = c.querySelector('ol.steps li').textContent.replace(/\s+/g, ' ');
        const a = c.querySelector('[data-slw-rpt]'); const see = a.textContent; a.click(); for (let i = 0; i < 40 && !SLR.doc; i++) await new Promise(r => setTimeout(r, 250)); await new Promise(r => setTimeout(r, 400));
        return { li, see, tab: document.querySelector('.tab-btn.active').dataset.tab }; });
      assert.match(r.li, /Strength I, maximum/); assert.match(r.li, /1\.25 ?[·⋅] ?1659\.58/); assert.match(r.li, /3494\.2/); assert.equal(r.see, 'see §5.3'); assert.equal(r.tab, 'report');
    });
    await ok('Report: labels with M_t / M_l / V_t / V_l as subscripts (none plain on screen); plain text keeps "M_t"; no tab card in the Report', async () => {
      const r = await p.evaluate(async () => { const T = document.getElementById('tab-report'); await new Promise(r => setTimeout(r, 300));
        const plain = [...T.querySelectorAll('.rp-d, .rp-tt, .rp-tsum')].map(n => { const c = n.cloneNode(true); c.querySelectorAll('.katex').forEach(k => k.remove()); return c.textContent; }).filter(t => /\b[MV]_[tl]\b/.test(t));
        const txt = SharedReport.text(SLR.doc); return { plain: plain.length, subs: T.querySelectorAll('.slSubT sub').length, txtMt: /M_t/.test(txt), card: /Worked steps for this tab|The steps the Report prints for this tab/.test(txt) }; });
      assert.equal(r.plain, 0); assert.ok(r.subs > 50, 'subs ' + r.subs); assert.equal(r.txtMt, true); assert.equal(r.card, false);
    });
    await ok('an invalid input: no card (results blocked); fixed: back', async () => {
      const r = await p.evaluate(async () => { P.ui.sel = 1; P.ui.itab = 'units'; buildSide(); showTab('combo'); const i = document.querySelector('#sidebar [data-k="units.1.cap.b"]'); i.value = '-1'; i.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 600));
        const a = !!document.querySelector('#tab-combo .slw-card'); i.value = '4.5'; i.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 600)); return { a, b: !!document.querySelector('#tab-combo .slw-card') }; });
      assert.deepEqual(r, { a: false, b: true });
    });
    if (SHOTS) { await p.evaluate(() => { P.ui.sel = 1; showTab('combo'); const d = document.querySelector('#tab-combo .slw-card details.sg-t'); d.open = true; d.scrollIntoView({ block: 'start' }); }); await p.waitForTimeout(300); await p.screenshot({ path: path.join(SHOTS, 'slws_combo_1440.png') }); }
  } finally { await o.b.close(); }
}
{
  const o = await openPage(FILE, { vw: 390, vh: 844 }), { p } = o; errsAll.push(o.errs);
  try { await ready(p);
    await ok('390 px: the Combinations and Wind cards open, no sideways scroll', async () => {
      const r = await p.evaluate(async () => { const out = []; for (const t of ['combo', 'wind']) { P.ui.sel = 1; showTab(t); await new Promise(r => setTimeout(r, 100)); document.querySelectorAll(`#tab-${t} .slw-card details.sg-t`).forEach(d => { d.open = true; }); await new Promise(r => setTimeout(r, 100)); out.push(document.documentElement.scrollWidth - document.documentElement.clientWidth); } return out; });
      assert.deepEqual(r, [0, 0]); });
    if (SHOTS) { await p.evaluate(() => { const d = document.querySelector('#tab-wind .slw-card'); d.scrollIntoView({ block: 'start' }); }); await p.waitForTimeout(200); await p.screenshot({ path: path.join(SHOTS, 'slws_wind_390.png') }); }
  } finally { await o.b.close(); }
}
await ok('0 console errors', () => assert.deepEqual(errsAll.flat(), []));
if (fails) { console.log(`${fails} failure(s)`); process.exit(1); }
console.log('all passed');
