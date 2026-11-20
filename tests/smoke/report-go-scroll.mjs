#!/usr/bin/env node
// shared/report.js: a § link (contents entry, [[key]] link) ends with its target at the top of the reading area although the report
// above it is still being laid out (RGS, 2026-11-20). Headless Chromium, file://, a page made here that loads units.js, steps.js and
// report.js from the repository (or --dir <folder with a shared/ folder>, e.g. a checkout of origin/main to see the failure there).
// The report: 40 sections, each a figure 1400 px tall (the subsections are content-visibility:auto, 800 px placeholder), the
// target's section with a step list. Cases, each in the window and in a scroll container (overflow:auto, scroll-spy on):
//   toc:   the contents entry of §36 is clicked; its heading ends at the top (its scroll-margin-top below the container's top, ±2 px).
//   key:   a [[key]] link in §1 to a step in §38: that step ends at the top.
//   late:  the figure above the target in its subsection grows by 900 px 300 ms after the click (a late image / equation; a figure in a
//          subsection out of view would not move it: content-visibility holds that subsection's size): the target is at the top again.
//          Chromium's scroll anchoring already holds the target there, so this case (and user) turns it off (overflow-anchor:none, as
//          in a browser without it) to check the report's own re-scroll.
//   user:  as late, but the reader presses a key first: the report is not scrolled back (the target moves down with the growth).
//   node tests/smoke/report-go-scroll.mjs [--dir <folder>]
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { loadPlaywright, chromiumPath, REPO } from '../lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = path.resolve(arg('dir', REPO));
const src = f => pathToFileURL(path.join(DIR, 'shared', f)).href;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rgs-'));

const page = inner => `<!doctype html><html><head><meta charset="utf-8"><title>RGS</title>
<style>body{margin:0;font-family:Arial} ${inner ? '#sc{height:760px;overflow:auto;margin-top:40px;border:1px solid #888}' : ''}</style></head><body>
${inner ? '<div id="sc"><div id="host"></div></div>' : '<div id="host"></div>'}
<script src="${src('units.js')}"></script><script src="${src('steps.js')}"></script><script src="${src('report.js')}"></script>
<script>
  const fig = (i, h) => ({ type: 'figure', svg: '<div id="fig' + i + '" style="height:' + h + 'px;background:linear-gradient(#eef,#cce)"></div>', caption: 'Figure ' + i });
  const sections = [];
  for (let i = 1; i <= 40; i++) {
    const items = [fig(i, 1400)];
    if (i === 1) items.unshift({ type: 'note', text: 'The step: [[s38/k.x]].' });
    if (i === 38) items.push({ type: 'steps', scope: 's38', steps: [{ id: 'k.x', label: 'Length', sym: 'L', eq: '2 \\\\times 3', sub: '', value: 6, unit: 'ft', d: 1 }] });
    sections.push({ title: 'Section ' + i, subs: [{ title: 'Part ' + i, items }] });
  }
  window.V = SharedReport.mount(document.getElementById('host'), { title: 'T', sections }, { spy: ${inner ? 'true' : 'false'} });
</script></body></html>`;

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ executablePath: chromiumPath() });
try {
  for (const inner of [false, true]) {
    const f = path.join(tmp, inner ? 'inner.html' : 'window.html'); fs.writeFileSync(f, page(inner));
    for (const kind of ['toc', 'key', 'late', 'user']) {
      const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } }), p = await ctx.newPage(), errs = [];
      p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      await p.goto(pathToFileURL(f).href); await p.waitForFunction(() => window.V && document.querySelector('.rp-doc'));
      await p.waitForTimeout(200);
      // the target: §36's heading (toc) or the step of §38 (the others)
      const sel = kind === 'toc' ? null : '[data-rpjump]';
      const target = await p.evaluate(k => {
        if (k === 'toc') { const a = Array.from(document.querySelectorAll('.rp-toc a.rp-l1')).find(x => /^36\. /.test(x.textContent)); return a.dataset.rpto; }
        const st = document.querySelector('.rp-doc .rp-step'); return st && st.id; }, kind);
      if (!target) { ok(false, `${inner ? 'container' : 'window'} ${kind}: no target`); await ctx.close(); continue; }
      if (sel) await p.locator(sel).first().click();
      else await p.locator(`.rp-toc a[data-rpto="${target}"]`).click();
      if (kind === 'late' || kind === 'user') {
        await p.evaluate(() => { document.documentElement.style.overflowAnchor = 'none'; const sc = document.getElementById('sc'); if (sc) sc.style.overflowAnchor = 'none'; });
        await p.waitForTimeout(300);
        if (kind === 'user') await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' })));
        await p.evaluate(() => { document.getElementById('fig38').style.height = '2300px'; });
      }
      await p.waitForTimeout(1200);
      const r = await p.evaluate(id => {
        const el = document.getElementById(id), sc = document.getElementById('sc');
        const top = sc ? sc.getBoundingClientRect().top + sc.clientTop : 0, mt = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        const atEnd = sc ? sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1 : window.scrollY + innerHeight >= document.documentElement.scrollHeight - 1;
        return { off: el.getBoundingClientRect().top - top - mt, atEnd };
      }, target);
      const where = `${inner ? 'container' : 'window'} ${kind}`;
      if (kind === 'user') ok(r.off > 800, `${where}: not scrolled back after the reader's key (target ${r.off.toFixed(1)} px below the top; expected ~900)`);
      else ok(Math.abs(r.off) <= 2 && !r.atEnd, `${where}: target at the top of the reading area (off by ${r.off.toFixed(1)} px)`);
      ok(!errs.length, `${where}: no console errors${errs.length ? ': ' + errs.join(' | ') : ''}`);
      await ctx.close();
    }
  }
} finally { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(fail ? `${fail} FAILED` : 'all passed');
process.exit(fail ? 1 : 0);
