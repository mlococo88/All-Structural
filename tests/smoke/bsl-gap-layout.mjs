#!/usr/bin/env node
// Bridge Substructure Loading (SubLoads): layout parity with the Abutment Calculator (SLGP, 2026-11-11; display only):
//   - check summary column (#slDashCol) from 1200 px: collapsed by default below 1800 px (the Combinations table still fits at 1440 px),
//     open at 1920 px; « / » toggles and is remembered in subloads_dashCollapsed_v1; hidden below 1200 px and in print;
//   - its governing forces are the Combinations tab's envelope (combine(k).env at the lowest resultant level), a click opens the
//     Combinations tab for that unit; the input-check line turns FAIL with an invalid input and the values are withheld;
//   - input tabs I-1 to I-12 (SLIT: the four panes split by topic; every field in exactly one tab, the input-check counts and links follow
//     the field), sections I-n.m; output tabs "1 · Summary" … in the order and names of before;
//   - the grab bar: drag widens the input pane and stores subloads_splitRatio_v1, the width survives a reload, Enter / double-click
//     resets (key removed, 360 px); no generic localStorage key is written;
//   - Input ID: XXXXXXXX-XXXX in the header, the same after a reload and after visiting every input tab, different after an input
//     change and back again after undoing it; in the Report title block;
//   - 390 px: no sideways scroll, no column, no bar; 0 console errors.
//   node tests/smoke/bsl-gap-layout.mjs [--shots <dir>]
import assert from 'assert/strict';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const FILE = process.env.BSL_FILE || path.join(REPO, 'Bridge Substructure Loading.html');
const SHOTS = (() => { const i = process.argv.indexOf('--shots'); return i > 0 ? process.argv[i + 1] : null; })();
let fails = 0;
const ok = async (m, f) => { try { await f(); console.log('  ok   ' + m); } catch (e) { fails++; console.log('  FAIL ' + m + ': ' + String(e.message).slice(0, 400)); } };
const ready = p => p.waitForFunction(() => typeof MODEL !== 'undefined' && MODEL && MODEL.G && window.SubLoadsLayout).then(() => p.waitForTimeout(700));
const allErrs = [];

{ // 1440 px
  const o = await openPage(FILE, { vw: 1440, vh: 900 }), { p } = o; allErrs.push(o.errs);
  try {
    await ready(p);
    await ok('1440 px: column shown collapsed (42 px), the Combinations table fits (Pier 1 and Abut. 1)', async () => {
      const r = await p.evaluate(async () => { const c = document.getElementById('slDashCol'), w = c.getBoundingClientRect().width, out = [];
        for (const k of [1, 0]) { P.ui.sel = k; showTab('combo'); await new Promise(r => setTimeout(r, 250)); const t = document.querySelector('#tab-combo .tscroll .tbl.cmb').parentElement; out.push(t.scrollWidth - t.clientWidth); }
        return { w, coll: document.body.classList.contains('slDashColl'), out }; });
      assert.equal(r.coll, true); assert.ok(Math.abs(r.w - 42) < 1.5, 'width ' + r.w); assert.deepEqual(r.out, [0, 0]);
    });
    await ok('tabs numbered in the old order and names; input tabs I-1 to I-4; sections I-3.1 …', async () => {
      const r = await p.evaluate(() => ({ t: [...document.querySelectorAll('#tab-bar .tab-btn')].map(b => b.textContent.trim()), i: [...document.querySelectorAll('#itabs .itab')].map(b => b.textContent.trim()), s: [...document.querySelectorAll('#sidebar .sec-h .ino')].map(x => x.textContent) }));
      const names = ['Summary', 'Geometry', '3D', 'Dead load', 'Earth loads', 'Live load', 'Braking and centrifugal', 'Wind', 'Force distribution', 'Combinations', 'Temperature', 'Water and scour', 'Ice', 'Seismic', 'Vessel collision', 'Vehicle collision', 'Drawings', 'Manual', 'Report'];
      assert.deepEqual(r.t, names.map((n, i) => `${i + 1} ·${n}`));
      assert.deepEqual(r.i, ['I-1Project', 'I-2Bridge', 'I-3Reactions', 'I-4Units', 'I-5Live load', 'I-6Wind', 'I-7Temperature', 'I-8Water and ice', 'I-9Earth loads', 'I-10Seismic', 'I-11Collision', 'I-12Factors and analysis']);
      assert.ok(r.s.length >= 4 && r.s.every((x, i) => x === `I-4.${i + 1}`), r.s.join(','));
    });
    await ok('SLIT: twelve input tabs; every field of every tab (each unit) is in the tab its path belongs to; every input field of the four old panes is in exactly one tab', async () => {
      const r = await p.evaluate(() => { const seen = {}, bad = [], old = new Set();
        for (const pane of ['project', 'bridge', 'units', 'rx']) for (let k = 0; k < P.units.length; k++) { P.ui.sel = k; document.querySelector(`.itab[data-pane="${pane}"]`).click(); }
        for (const b of document.querySelectorAll('#itabs .itab')) for (let k = 0; k < P.units.length; k++) { P.ui.sel = k; b.click();
          document.querySelectorAll('#sidebar [data-k]').forEach(x => { const t = b.dataset.pane, pp = x.dataset.k.replace(/^units\.\d+\./, 'units.K.') + '|' + k; if (slTabOfPath(x.dataset.k) !== t) bad.push(t + ':' + x.dataset.k); (seen[pp] = seen[pp] || new Set()).add(t); }); }
        P.ui.sel = 1; document.querySelector('.itab[data-pane="units"]').click();
        return { bad, multi: Object.entries(seen).filter(([, v]) => v.size > 1).map(([k, v]) => k + ':' + [...v]), n: Object.keys(seen).length }; });
      assert.deepEqual(r.bad, []); assert.deepEqual(r.multi, []); assert.ok(r.n > 200, 'fields ' + r.n);
    });
    await ok('SLIT: an invalid wind speed counts on I-6 Wind (not Bridge), its link opens the Wind tab with the field focused; a vessel speed error counts on I-11 for Pier 1', async () => {
      const r = await p.evaluate(async () => { const v0 = P.br.V, cv0 = JSON.stringify(P.units[1].cv); P.br.V = -5; fillCol(P.units[1]); P.units[1].cv.on = 'yes'; P.units[1].cv.mhw = 108; P.units[1].cv.Vs = -2; recompute(); buildSide(); await new Promise(r => setTimeout(r, 300));
        const badge = t => { const q = document.querySelector(`.itab[data-pane="${t}"] .ic-n`); return q ? +q.textContent : 0; };
        const b = { wind: badge('wind'), bridge: badge('bridge'), coll: badge('coll'), units: badge('units') };
        showTab('summary'); await new Promise(r => setTimeout(r, 200)); const links = [...document.querySelectorAll('#tab-summary [data-icgo]')];
        const lw = links.find(a => /Wind speed/.test(a.textContent)); lw.click(); await new Promise(r => setTimeout(r, 200));
        const w = { itab: P.ui.itab, focus: document.activeElement && document.activeElement.dataset.k };
        P.ui.sel = 0; showTab('summary'); await new Promise(r => setTimeout(r, 200)); const lc = [...document.querySelectorAll('#tab-summary [data-icgo]')].find(a => /speed V|Impact speed/i.test(a.textContent) && !/Wind/.test(a.textContent)); lc.click(); await new Promise(r => setTimeout(r, 200));
        const c = { itab: P.ui.itab, sel: P.ui.sel, focus: document.activeElement && document.activeElement.dataset.k };
        P.br.V = v0; P.units[1].cv = JSON.parse(cv0); recompute(); P.ui.itab = 'units'; buildSide(); await new Promise(r => setTimeout(r, 300));
        return { b, w, c, after: badge('wind') + badge('coll') }; });
      assert.deepEqual(r.b, { wind: 1, bridge: 0, coll: 1, units: 0 }); assert.deepEqual(r.w, { itab: 'wind', focus: 'br.V' }); assert.deepEqual(r.c, { itab: 'coll', sel: 1, focus: 'units.1.cv.Vs' }); assert.equal(r.after, 0);
    });
    await ok('SLIT: a unit button on Water and ice keeps that tab; an old saved P.ui.itab ("bridge") opens the Bridge tab', async () => {
      const r = await p.evaluate(async () => { document.querySelector('.itab[data-pane="water"]').click(); document.querySelector('#sidebar .unit-pick [data-unit="2"]').click(); await new Promise(r => setTimeout(r, 100));
        const a = { itab: P.ui.itab, sel: P.ui.sel }; P.ui.itab = 'bridge'; buildSide(); const b = document.querySelector('.itab.active').dataset.pane; P.ui.sel = 1; P.ui.itab = 'units'; buildSide(); return { a, b }; });
      assert.deepEqual(r.a, { itab: 'water', sel: 2 }); assert.equal(r.b, 'bridge');
    });
    await ok('« opens the column (stored "0"); the values are the envelope of combine(k) at the lowest level; a click opens Combinations', async () => {
      const r = await p.evaluate(async () => { document.getElementById('slDashTgl').click(); await new Promise(r => setTimeout(r, 300));
        const lines = [...document.querySelectorAll('#slDash .slCh')].filter(c => /^u\d+$/.test(c.dataset.key));
        const exp = P.units.map((u, k) => { const r = unitRes(k), C = combine(k), defs = r.UM.defs, lev = ['bridge seat', 'top of footing', 'bottom of footing'].filter(l => defs.some(d => d.grp === 'Resultant' && d.label === 'Axial, ' + l)).pop(); const q = defs.findIndex(d => d.grp === 'Resultant' && d.label === 'Axial, ' + lev); return 'P ' + fv(C.env.max[q], defs[q].u); });
        const got = lines.map(c => c.querySelector('.slChR').textContent);
        lines[2].click(); await new Promise(r => setTimeout(r, 300));
        return { key: localStorage.getItem('subloads_dashCollapsed_v1'), w: document.getElementById('slDashCol').getBoundingClientRect().width, exp, got, tab: P.ui.tab, sel: P.ui.sel };
      });
      assert.equal(r.key, '0'); assert.ok(r.w > 200, 'width ' + r.w); assert.deepEqual(r.got, r.exp); assert.equal(r.tab, 'combo'); assert.equal(r.sel, 2);
      assert.deepEqual(r.got, ['P 2,540.7', 'P 3,494.2', 'P 3,346.0', 'P 2,541.1']);
    });
    await ok('grab bar: drag +120 px stores subloads_splitRatio_v1 and widens the input pane; kept after a reload; Enter resets to 360 px', async () => {
      const bar = await p.locator('#slSplit').boundingBox(); const w0 = await p.evaluate(() => document.querySelector('.side').getBoundingClientRect().width);
      await p.mouse.move(bar.x + 3, bar.y + 100); await p.mouse.down(); await p.mouse.move(bar.x + 60, bar.y + 100, { steps: 4 }); await p.mouse.move(bar.x + 123, bar.y + 100, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(200);
      const r = await p.evaluate(() => ({ w: document.querySelector('.side').getBoundingClientRect().width, k: localStorage.getItem('subloads_splitRatio_v1') }));
      assert.ok(Math.abs(r.w - (w0 + 120)) < 3, `${w0} -> ${r.w}`); assert.ok(+r.k > 0.02 && +r.k < 0.98, 'key ' + r.k);
      await p.reload(); await ready(p);
      const w2 = await p.evaluate(() => document.querySelector('.side').getBoundingClientRect().width); assert.ok(Math.abs(w2 - r.w) < 3, `reload ${w2} vs ${r.w}`);
      await p.focus('#slSplit'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
      const r3 = await p.evaluate(() => ({ w: document.querySelector('.side').getBoundingClientRect().width, k: localStorage.getItem('subloads_splitRatio_v1') }));
      assert.ok(Math.abs(r3.w - 360) < 1, 'reset ' + r3.w); assert.equal(r3.k, null);
      await p.keyboard.press('ArrowRight'); await p.waitForTimeout(100); const w4 = await p.evaluate(() => document.querySelector('.side').getBoundingClientRect().width); assert.ok(Math.abs(w4 - 376) < 1.5, 'arrow ' + w4);
      await p.keyboard.press('Enter');
    });
    await ok('Input ID: same after a reload and after every input tab is drawn; changes with an input and returns when it is undone; in the Report title block', async () => {
      const id0 = await p.evaluate(() => document.querySelector('#slInputId b').textContent); assert.match(id0, /^[0-9A-F]{8}-[0-9A-F]{4}$/);
      const id1 = await p.evaluate(async () => { for (const t of ['project', 'bridge', 'rx', 'units']) { document.querySelector(`.itab[data-pane="${t}"]`).click(); await new Promise(r => setTimeout(r, 120)); } return document.querySelector('#slInputId b').textContent; });
      assert.equal(id1, id0);
      await p.waitForTimeout(600); await p.reload(); await ready(p);
      assert.equal(await p.evaluate(() => document.querySelector('#slInputId b').textContent), id0);
      const r = await p.evaluate(async () => { const i = document.querySelector('#sidebar [data-k$=".hb"]'); const v = i.value; i.value = '5'; i.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 500));
        const a = document.querySelector('#slInputId b').textContent; i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 500)); return { a, b: document.querySelector('#slInputId b').textContent }; });
      assert.notEqual(r.a, id0); assert.equal(r.b, id0);
      const rpt = await p.evaluate(async () => { showTab('report'); for (let i = 0; i < 40 && !SLR.doc; i++) await new Promise(r => setTimeout(r, 250)); await new Promise(r => setTimeout(r, 300)); return SharedReport.text(SLR.doc); });
      assert.ok(rpt.includes('Input ID: ' + id0), 'report title block');
      await p.evaluate(() => showTab('summary'));
    });
    await ok('input error: the input check line FAILs, the forces are withheld; fixed: back', async () => {
      const r = await p.evaluate(async () => { const i = document.querySelector('#sidebar [data-k$=".hb"]'); const v = i.value; i.value = '-3'; i.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 600));
        const bad = { cls: document.querySelector('#slDash [data-key="ic"]').className, n: document.querySelectorAll('#slDash [data-key^="u"]').length, cnt: document.getElementById('slDashCnt').textContent };
        i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 600));
        return { bad, n2: document.querySelectorAll('#slDash [data-key^="u"]').length }; });
      assert.match(r.bad.cls, /fail/); assert.equal(r.bad.n, 0); assert.match(r.bad.cnt, /INVALID/); assert.equal(r.n2, 4);
    });
    await ok('only tool-prefixed keys written (no generic key)', async () => {
      const keys = await p.evaluate(() => Object.keys(localStorage)); assert.ok(keys.every(k => /^subloads_|^bridgeSuite\.|^bx|^SharedProjects|^sp_/.test(k)), keys.join(','));
    });
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'slgp_1440.png') });
  } finally { await o.b.close(); }
}
{ // 1920 px: open by default
  const o = await openPage(FILE, { vw: 1920, vh: 1080 }), { p } = o; allErrs.push(o.errs);
  try { await ready(p);
    await ok('1920 px: column open (280 px) with no stored choice', async () => { const r = await p.evaluate(() => ({ c: document.body.classList.contains('slDashColl'), w: document.getElementById('slDashCol').getBoundingClientRect().width })); assert.equal(r.c, false); assert.ok(Math.abs(r.w - 280) < 1.5, 'w ' + r.w); });
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'slgp_1920.png') });
  } finally { await o.b.close(); }
}
{ // 390 px
  const o = await openPage(FILE, { vw: 390, vh: 844 }), { p } = o; allErrs.push(o.errs);
  try { await ready(p);
    await ok('390 px: no sideways scroll, no column, no bar; the Input ID shown', async () => { const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth - document.documentElement.clientWidth, c: getComputedStyle(document.getElementById('slDashCol')).display, s: getComputedStyle(document.getElementById('slSplit')).display, id: document.getElementById('slInputId').getBoundingClientRect().width }));
      assert.equal(r.sw, 0); assert.equal(r.c, 'none'); assert.equal(r.s, 'none'); assert.ok(r.id > 0); });
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'slgp_390.png'), fullPage: false });
  } finally { await o.b.close(); }
}
await ok('0 console errors', () => assert.deepEqual(allErrs.flat(), []));
if (fails) { console.log(`${fails} failure(s)`); process.exit(1); }
console.log('all passed');
