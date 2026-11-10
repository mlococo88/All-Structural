#!/usr/bin/env node
// Bridge Substructure Loading (SubLoads) layout (SLLAY, 2026-11-10; display only, no computed value changes):
//   - the output tabs wrap onto rows: no tab off-screen at 1440 and 390 px wide;
//   - no horizontal page scroll at 390 px;
//   - the output fills the pane at 1920 px (no blank right margin over 40 px);
//   - Combinations (Pier 1 and Abut. 1): the last column is inside the table's box at 1440 px (no scrolling needed), the page does
//     not scroll sideways, the effect labels are on one line, and the label column is sticky;
//   - Bridge pane Supports table: inside the sidebar, the Superstructure select wide enough for its longest option;
//   - the "Send/receive data" line on the Bridge and Reactions panes is 16 px in from the sidebar edge;
//   - Wind tab: wind on live load WL as a table;
//   - Geometry plan and elevation: label text 10 px or more at 1440 px and no two labels overlap (bounding boxes);
//   - Report §8.1: M_t as a subscript (M<sub>t</sub>), not "M_t";
//   - 0 console errors.
//   node tests/smoke/bsl-layout.mjs
import assert from 'assert/strict';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'Bridge Substructure Loading.html');
let fails = 0;
const ok = (c, m) => { try { c(); console.log('  ok  ' + m); } catch (e) { fails++; console.log('  FAIL ' + m + ': ' + String(e.message).slice(0, 300)); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function measure(vw, vh) {
  const { b, p, errs } = await openPage(FILE, { vw, vh });
  try {
    await p.waitForFunction(() => typeof MODEL !== 'undefined' && MODEL && MODEL.G); await sleep(500);
    const m = await p.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms)), W = document.documentElement.clientWidth;
      const tb = document.getElementById('tab-bar'), tbr = tb.getBoundingClientRect();
      const off = [...document.querySelectorAll('.tab-btn')].filter(x => { const r = x.getBoundingClientRect(); return r.width === 0 || r.left < tbr.left - 0.5 || r.right > Math.min(W, tbr.right) + 0.5; }).map(x => x.textContent);
      const combo = [];
      for (const k of [1, 0]) {
        P.ui.sel = k; showTab('combo'); await sleep(250);
        const pan = document.getElementById('tab-combo'), tbl = pan.querySelector('.tscroll .tbl.cmb'), sc = tbl.parentElement, ths = tbl.querySelectorAll('thead th');
        const lr = ths[ths.length - 1].getBoundingClientRect(), br = sc.getBoundingClientRect();
        const lbl = [...tbl.querySelectorAll('tbody tr')].filter(r => r.cells.length > 1).map(r => r.cells[0]);
        combo.push({ k, lastRight: lr.right, boxRight: br.right, scrollW: sc.scrollWidth, clientW: sc.clientWidth,
          lblWrap: lbl.filter(c => { const r = document.createRange(); r.selectNodeContents(c); const tops = [...r.getClientRects()].map(q => q.top).sort((x, y) => x - y); return tops.length && tops[tops.length - 1] - tops[0] > 10; }).length,   // a second line is 18 px or more lower; a subscript a few px
          sticky: getComputedStyle(lbl[0]).position, pageScroll: document.documentElement.scrollWidth - W });
      }
      const pr = document.getElementById('tab-combo').getBoundingClientRect(), tpr = document.getElementById('tab-panels'), cs = getComputedStyle(tpr);
      const blank = tpr.getBoundingClientRect().right - (parseFloat(cs.paddingRight) || 0) - (tpr.offsetWidth - tpr.clientWidth) - pr.right;
      showTab('wind'); await sleep(250);
      const wl = [...document.querySelectorAll('#tab-wind h3')].find(h => /Wind on live load/.test(h.textContent));
      const wlTable = !!(wl && wl.nextElementSibling && wl.nextElementSibling.tagName === 'TABLE' && wl.nextElementSibling.rows.length >= 3);
      showTab('geometry'); await sleep(300);
      const svgs = [...document.querySelectorAll('#tab-geometry svg.dwg-geo')].map(s => { const ts = [...s.querySelectorAll('text')], rs = ts.map(t => t.getBoundingClientRect()), fs = ts.map(t => +t.getAttribute('font-size') * t.getScreenCTM().a);
        const ov = []; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], c = rs[j]; if (Math.min(a.right, c.right) - Math.max(a.left, c.left) > 1 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 1) ov.push(ts[i].textContent + ' / ' + ts[j].textContent); }
        return { n: ts.length, minFs: Math.min(...fs), ov }; });
      const side = document.querySelector('.sidebar'), sr = side.getBoundingClientRect(), ho = {};
      document.querySelector('.itab[data-pane=bridge]').click(); await sleep(250);
      const sel = [...document.querySelectorAll('select[data-k^="br.joint"]')], cv = document.createElement('canvas').getContext('2d');
      const selFit = sel.map(s => { const c = getComputedStyle(s); cv.font = c.fontWeight + ' ' + c.fontSize + ' ' + c.fontFamily; const need = Math.max(...[...s.options].map(o => cv.measureText(o.text).width)) + parseFloat(c.paddingLeft) + parseFloat(c.paddingRight) + 16; return { w: s.clientWidth, need: Math.ceil(need) }; });
      const mt = sel.length ? sel[0].closest('table').getBoundingClientRect() : null;
      const hoB = document.querySelector('.sidebar [data-ho-link]'); ho.bridge = hoB ? hoB.getBoundingClientRect().left - sr.left : null;
      document.querySelector('.itab[data-pane=rx]').click(); await sleep(250);
      const hoR = document.querySelector('.sidebar [data-ho-link]'); ho.rx = hoR ? hoR.getBoundingClientRect().left - sr.left : null;
      const hdr = document.querySelector('header').getBoundingClientRect().height;
      return { W, off, combo, blank, wlTable, svgs, selFit, mini: mt ? { left: mt.left - sr.left, right: sr.right - mt.right } : null, ho, hdr, pageScroll: document.documentElement.scrollWidth - W };
    });
    let rpt = null;
    if (vw === 1440) rpt = await p.evaluate(async () => { showTab('report'); await new Promise(r => setTimeout(r, 2500)); const h = [...document.querySelectorAll('#tab-report h3')].find(x => /^8\.1 /.test(x.textContent)); if (!h) return null; const t = h.parentElement.querySelector('table'); return { html: t ? t.innerHTML : '', text: t ? t.innerText : '' }; });
    return { m, rpt, errs };
  } finally { await b.close(); }
}

const R = {};
for (const [vw, vh] of [[1440, 900], [1920, 1080], [390, 844]]) {
  const { m, rpt, errs } = await measure(vw, vh); R[vw] = m;
  console.log(`${vw} px`);
  if (vw !== 1920) ok(() => assert.deepEqual(m.off, []), `no output tab off-screen (${m.off.join(', ') || 'none'})`);
  ok(() => assert.ok(m.pageScroll <= 0, `page scrolls sideways by ${m.pageScroll} px`), 'no horizontal page scroll');
  if (vw === 1920) ok(() => assert.ok(m.blank <= 40, `${Math.round(m.blank)} px blank right of the output`), `output fills the width (blank right margin ${Math.round(m.blank)} px)`);
  m.combo.forEach(c => {
    if (vw !== 390) ok(() => { assert.ok(c.lastRight <= c.boxRight + 0.5, `last column right ${c.lastRight} > box right ${c.boxRight}`); assert.ok(c.scrollW <= c.clientW + 1, `table box scrolls ${c.scrollW} > ${c.clientW}`); }, `Combinations unit ${c.k}: last column visible without scrolling`);
    ok(() => { assert.equal(c.pageScroll <= 0, true); assert.equal(c.lblWrap, 0, `${c.lblWrap} labels wrap`); assert.equal(c.sticky, 'sticky'); }, `Combinations unit ${c.k}: labels on one line, sticky label column, no page scroll`);
  });
  ok(() => { assert.ok(m.selFit.length >= 1); m.selFit.forEach(s => assert.ok(s.w >= s.need, `select ${s.w} px < ${s.need} px`)); assert.ok(m.mini.left >= 0 && m.mini.right >= 0, 'Supports table outside the sidebar'); }, 'Bridge pane Supports: select not truncated, table inside the sidebar');
  ok(() => { assert.ok(m.ho.bridge >= 15, `Bridge ${m.ho.bridge}`); assert.ok(m.ho.rx >= 15, `Reactions ${m.ho.rx}`); }, `Send/receive data line padded (Bridge ${m.ho.bridge}, Reactions ${m.ho.rx} px)`);
  ok(() => assert.ok(m.wlTable), 'Wind tab: WL as a table');
  ok(() => { assert.equal(m.svgs.length, 2); m.svgs.forEach(s => assert.deepEqual(s.ov, [])); }, 'Geometry plan and elevation: no label overlaps');
  if (vw === 1440) ok(() => m.svgs.forEach(s => assert.ok(s.minFs >= 10, `label ${s.minFs.toFixed(1)} px`)), `Geometry labels 10 px or more (${m.svgs.map(s => s.minFs.toFixed(1)).join(', ')} px)`);
  if (vw === 390) ok(() => assert.ok(m.hdr <= 100, `header ${m.hdr} px`), `phone header compact (${Math.round(m.hdr)} px)`);
  if (rpt) ok(() => { assert.match(rpt.html, /M<sub>t<\/sub>, bottom of footing/); assert.doesNotMatch(rpt.text, /\bM_t\b/); }, 'Report §8.1: M_t set as a subscript');
  ok(() => assert.deepEqual(errs, []), '0 console errors');
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
