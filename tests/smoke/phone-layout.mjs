#!/usr/bin/env node
// Phone / tablet layout smoke test (PHN, 2026-11-02): at 390 px and 768 px wide the page never scrolls sideways, on load and
// after each of the tool's tabs is opened (wide tables, equations and tab bars scroll inside their own box instead).
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
};

const keys = args.tool ? String(args.tool).split(',') : Object.keys(TOOLS);
const widths = String(args.w || '390,768').split(',').map(Number);
let failures = 0;
const width = p => p.evaluate(() => { const se = document.scrollingElement; return { over: se.scrollWidth - se.clientWidth, x: se.scrollLeft }; });
for (const key of keys) {
  const T = TOOLS[key]; if (!T) { console.log(`unknown tool ${key}`); failures++; continue; }
  const src = resolveFile(args.file && keys.length === 1 ? args.file : T.file, T.file);
  for (const vw of widths) {
    const { b, p, errs } = await openPage(src.file, { vw, vh: vw < 500 ? 844 : 1024 });
    try {
      await p.waitForTimeout(T.wait || 2500);
      if (T.init) await T.init(p);
      const n = await p.$$eval(T.tabs, e => e.length);
      const res = [['(load)', await width(p)]];
      for (let i = 0; i < n; i++) {
        const name = await p.$$eval(T.tabs, (e, i) => { const t = e[i]; if (t.offsetParent !== null) t.click(); return (t.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30); }, i);
        await p.waitForTimeout(T.tabWait || 600);
        res.push([name, await width(p)]);
      }
      const bad = res.filter(([, r]) => r.over > 1);
      failures += bad.length;
      console.log(`${bad.length ? 'FAIL' : 'ok  '} ${key} ${vw}px  ${res.length} views${bad.length ? ': ' + bad.map(([t, r]) => `${t} scrolls ${r.over}px sideways`).join('; ') : ''}${errs.length ? `  (${errs.length} console errors)` : ''}`);
    } finally { await b.close(); }
  }
}
console.log(failures ? `${failures} failure(s)` : 'all passed');
process.exit(failures ? 1 : 0);
