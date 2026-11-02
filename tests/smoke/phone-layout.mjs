#!/usr/bin/env node
// Phone / tablet layout smoke test (PHN, 2026-11-02): at 390 px and 768 px wide the page never scrolls sideways, on load and
// after each of the tool's tabs is opened (wide tables, equations and tab bars scroll inside their own box instead), and every
// visible tab button lies inside the window or inside a box that scrolls sideways (a page that clips its content instead of
// scrolling, e.g. a fixed full-window app box with overflow:hidden, hides tabs without widening the page; added 2026-11-02).
// Headless Chromium, file://, CDN libraries from tests/libs where the pinned version is there (others are blocked: the check
// is about the page width, which a missing library does not widen).
//   node tests/smoke/phone-layout.mjs [--tool <key>[,<key>…]] [--file <file>] [--w 390,768]
//   keys: see TOOLS below (default: all). --file: another copy of the tool's file (one tool only).
import { openPage, resolveFile } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }

// file: the tool; tabs: selector of the buttons that switch its tabs / views; init(p): optional set-up after load
const TOOLS = {
  smd: { file: 'Shear and Moment Diagrams.html', tabs: '#smdViewTabs button',
    init: async p => { await p.selectOption('#tplSel', '3s'); await p.waitForTimeout(2000); } },
  asce7: { file: 'ASCE7-16 Load Generator.html', tabs: '#tabs .tab', tabWait: 900 },
  mlg: { file: 'Moving Load Generator.html', tabs: '#mlgInTabs button, #mlgOutTabs button', wait: 4000, tabWait: 1000 },
  arch: { file: 'Stone Masonry Arch Load Rating.html', tabs: '[id^=inTab_], #tabs [data-tab]', wait: 6000, tabWait: 1200 },
  gusset: { file: 'Gusset Plate Rating.html', tabs: '.itab[data-pane], #tab-bar .tab-btn', wait: 4000, tabWait: 1000 },
  rwall: { file: 'Retaining Wall Designer.html', tabs: '.itab[data-pane], .tab-bar .tab-btn', wait: 4000, tabWait: 1000 },
  bsl: { file: 'Bridge Substructure Loading.html', tabs: '.itab[data-pane], #tab-bar .tab-btn', wait: 4000, tabWait: 1000 },
  sbeam: { file: 'Steel Beam Design - AISC 15th.html', tabs: '#sbdInTabs .sbdInTab, #tabBar button', wait: 4000, tabWait: 1000 },
  cbc: { file: 'Concrete Beam Capacity.html', tabs: '.suite-tab', wait: 6000, tabWait: 1500 },
  aci: { file: 'ACI Rebar Development Length.html', tabs: '[role=tab], .tab-btn, .itab, .tab, [data-tab]', wait: 3000, tabWait: 600 },   // the frames' own tabs: see the PHN fixlog entry (checked once by hand)
};

const keys = args.tool ? String(args.tool).split(',') : Object.keys(TOOLS);
const widths = String(args.w || '390,768').split(',').map(Number);
let failures = 0;
const width = (p, sel) => p.evaluate(sel => { const se = document.scrollingElement, vw = document.documentElement.clientWidth;
  const scrolls = e => { for (let a = e.parentElement; a; a = a.parentElement) if (/(auto|scroll)/.test(getComputedStyle(a).overflowX)) return true; return false; };
  const cut = [...document.querySelectorAll(sel)].filter(t => { const r = t.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && !scrolls(t); })
    .map(t => (t.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 20));
  let over = se.scrollWidth - se.clientWidth;   // a visible same-origin frame (srcdoc tabs, e.g. Concrete Beam Capacity) counts as a page too
  for (const f of document.querySelectorAll('iframe')) { if (!f.offsetWidth) continue; try { const fe = f.contentDocument.scrollingElement; over = Math.max(over, fe.scrollWidth - fe.clientWidth); } catch (e) {} }
  return { over, x: se.scrollLeft, cut }; }, sel);
for (const key of keys) {
  const T = TOOLS[key]; if (!T) { console.log(`unknown tool ${key}`); failures++; continue; }
  const src = resolveFile(args.file && keys.length === 1 ? args.file : T.file, T.file);
  for (const vw of widths) {
    const { b, p, errs } = await openPage(src.file, { vw, vh: vw < 500 ? 844 : 1024 });
    try {
      await p.waitForTimeout(T.wait || 2500);
      if (T.init) await T.init(p);
      const n = await p.$$eval(T.tabs, e => e.length);
      const res = [['(load)', await width(p, T.tabs)]];
      for (let i = 0; i < n; i++) {
        const name = await p.$$eval(T.tabs, (e, i) => { const t = e[i]; if (t.offsetParent !== null) t.click(); return (t.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30); }, i);
        await p.waitForTimeout(T.tabWait || 600);
        res.push([name, await width(p, T.tabs)]);
      }
      const bad = res.filter(([, r]) => r.over > 1 || r.cut.length);
      failures += bad.length;
      console.log(`${bad.length ? 'FAIL' : 'ok  '} ${key} ${vw}px  ${res.length} views${bad.length ? ': ' + bad.map(([t, r]) => r.over > 1 ? `${t} scrolls ${r.over}px sideways` : `${t}: tab(s) cut off at the right edge: ${r.cut.join(', ')}`).join('; ') : ''}${errs.length ? `  (${errs.length} console errors)` : ''}`);
    } finally { await b.close(); }
  }
}
console.log(failures ? `${failures} failure(s)` : 'all passed');
process.exit(failures ? 1 : 0);
