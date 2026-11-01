#!/usr/bin/env node
// Steel Bridge (apps/steel-bridge/index.html): the page itself never scrolls in the two-panel screen layout (SBSC, 2026-11-01).
// Regression test for the bug found in Spread Footing (SFSC, fixlog/Spread Footing.md): with html,body{overflow:hidden} and two
// scrolling panels, absolutely positioned descendants (KaTeX's hidden span.katex-mathml) whose containing block is the page make
// the document taller than the window; a scrollIntoView / focus / link jump then scrolls the page, which has no scroll bar, and the
// header and the top of both panels can't be scrolled back. Here #inputPanel and #outputPanel are position:relative, so they
// contain and clip those spans; this test keeps it that way.
// Headless Chromium, file://, real KaTeX 0.16.9 and three.js r128 from tests/libs (tests/lib.mjs openPage), at 1280x800, 1366x768
// and 1920x1080:
//   1. every output tab (calculated with its own button, Report built): the document is no taller (or wider) than the window, its
//      scroll stays 0, and the wheel scrolls the output panel down and back up to 0;
//   2. every input tab: the same for the input panel;
//   3. every link that scrolls by script, on every output tab (grouped-steps "see §" / "see work" links, the step links of the
//      Fatigue, Cross-frames, Rating, Welds, Shear, Auto design and Drawings tabs, the input-tab and output-tab links, the Report
//      "see §" and section links), each clicked with the output panel scrolled to the bottom: the document stays at 0 and both
//      panels can be wheeled back to 0 with the header on screen;
//   4. a scrollIntoView of a deep element, a focus() on the last input, window.scrollTo(0,400): the same;
//   5. 3D view: after a drag on the canvas, the wheel beside it still scrolls the panel;
//   6. touch: finger swipes scroll the output panel down and, after a link, back up to 0; the document stays at 0;
//   7. below the 900 px breakpoint (single-column layout) the page still scrolls normally.
// A hidden absolutely positioned span (as KaTeX's MathML) is also added at the bottom of each panel.
//   node tests/smoke/steel-bridge-scroll.mjs [--file <index.html>] [--shots <dir>] [--quick]
//   --quick: 1280x800 only
import fs from 'fs';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const FILE = path.resolve(args.file || path.join(REPO, 'apps/steel-bridge/index.html'));
if (args.shots) fs.mkdirSync(args.shots, { recursive: true });
const t0 = Date.now();
let failures = 0, actions = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL ' + msg); } };
// links that scroll by script (one selector per kind; up to 2 of each kind are clicked on every tab)
const LINKS = ['a.wk', 'a[href^="#st-"]', '[data-go]', '[data-cfgo]', '[data-rtgo]', '[data-wt]', '[data-adgo]', '[data-dgo]', '[data-goto]', '[data-gotab]', '[data-goin]', '[data-gofld]', '.rp-see', '[data-rpgoto]', '.rp-toc a'];

async function open(vw, vh) {
  const o = await openPage(FILE, { vw, vh });
  await o.p.waitForSelector('#tabBar [data-otab]');
  await o.p.waitForTimeout(1500);
  await o.p.evaluate(() => { for (const id of ['inputPanel', 'outputPanel']) { const s = document.createElement('span'); s.className = 'sbscProbe';
    s.style.cssText = 'position:absolute;clip:rect(1px,1px,1px,1px);width:1px;height:1px;overflow:hidden;padding:0;border:0'; s.textContent = 'x'; document.getElementById(id).appendChild(s); } });
  return o;
}
const state = p => p.evaluate(() => { const se = document.scrollingElement, h = document.getElementById('hdr').getBoundingClientRect();
  return { katex: !!window.katex, doc: se.scrollTop, docX: se.scrollLeft, over: se.scrollHeight - se.clientHeight, overX: se.scrollWidth - se.clientWidth,
    inp: document.getElementById('inputPanel').scrollTop, out: document.getElementById('outputPanel').scrollTop, hdrTop: Math.round(h.top) }; });
async function wheelBack(p) {   // both panels back to the top, the wheel at a point beside any drawing / canvas (left edge of the panel)
  for (const sel of ['#inputPanel', '#outputPanel']) {
    const r = await p.$eval(sel, e => { const b = e.getBoundingClientRect(); return { x: b.left + 4, y: b.top + b.height / 2 }; });
    await p.mouse.move(r.x, r.y);
    for (let k = 0; k < 400; k++) { await p.mouse.wheel(0, -3000); if (k % 8 === 7 && await p.$eval(sel, e => e.scrollTop === 0)) break; }
  }
  await p.waitForTimeout(250);
}
async function afterAction(p, label) {
  actions++;
  await p.waitForTimeout(900);   // smooth scrolls finish
  const s = await state(p);
  check(s.doc === 0 && s.docX === 0, `${label}: document scroll ${s.doc}/${s.docX} (expected 0)`);
  await wheelBack(p);
  const s2 = await state(p);
  check(s2.doc === 0 && s2.inp === 0 && s2.out === 0 && s2.hdrTop >= 0, `${label}: after wheeling up doc ${s2.doc}, input ${s2.inp}, output ${s2.out}, header top ${s2.hdrTop}`);
}
async function showTab(p, t) {
  await p.click(`#tabBar [data-otab="${t}"]`); await p.waitForTimeout(t === 'ad' || t === 'rpt' ? 2500 : 900);
  // calculate the tab (its own "Calculate" / "Run analysis" button) so its results and worked steps are on screen
  for (let k = 0; k < 3; k++) {
    const bt = await p.$('#out .alert.stale:not([hidden]) button.primary');
    if (!bt || !(await bt.isVisible())) break;
    await bt.click();
    await p.waitForFunction(() => { const x = document.querySelector('#out .alert.stale:not([hidden]) button.primary'); return !x || !x.offsetParent; }, null, { timeout: 180000 }).catch(() => {});
    await p.waitForTimeout(600);
  }
  if (t === 'rpt' && await p.$('#rp_build')) { await p.click('#rp_build'); await p.waitForSelector('.rp-doc .rp-step', { timeout: 180000 }); await p.waitForTimeout(500); }
}

const SIZES = args.quick ? [[1280, 800]] : [[1280, 800], [1366, 768], [1920, 1080]];
for (const [vw, vh] of SIZES) {
  console.log(`${vw}x${vh}  ${path.relative(REPO, FILE)}`);
  const { b, p, errs } = await open(vw, vh);
  try {
    const otabs = await p.$$eval('#tabBar [data-otab]', bs => bs.map(x => x.dataset.otab));
    const itabs = await p.$$eval('#inTabs [data-itab]', bs => bs.map(x => x.dataset.itab));
    let nLinks = 0;
    for (const t of otabs) {
      // 1. the tab, the wheel down and back up in the output panel
      await showTab(p, t);
      const s = await state(p);
      check(s.katex, `${t}: KaTeX not loaded`);
      check(s.over <= 0 && s.overX <= 0 && s.doc === 0, `${t}: document larger than the window by ${s.over} / ${s.overX} px, scroll ${s.doc}`);
      const r = await p.$eval('#outputPanel', e => { const q = e.getBoundingClientRect(); return { x: q.left + 4, y: q.top + q.height / 2, max: e.scrollHeight - e.clientHeight }; });
      await p.mouse.move(r.x, r.y); for (let k = 0; k < 10; k++) await p.mouse.wheel(0, 1500); await p.waitForTimeout(250);
      const d = await state(p);
      check(r.max <= 0 || d.out > 0, `${t}: the wheel did not scroll the output panel down`);
      check(d.doc === 0, `${t}: wheel down scrolled the document ${d.doc}`);
      await wheelBack(p);
      const u = await state(p);
      check(u.out === 0 && u.doc === 0, `${t}: wheel back up: output ${u.out}, doc ${u.doc}`);
      // 3. links that scroll by script, each clicked with the output panel at the bottom
      for (const sel of LINKS) {
        const n = await p.evaluate(sel => [...document.querySelectorAll('#out ' + sel)].filter(x => x.offsetParent).length, sel);
        for (let i = 0; i < Math.min(n, 2); i++) {
          const ok = await p.evaluate(([sel, i]) => { const P = document.getElementById('outputPanel'); P.scrollTop = P.scrollHeight;
            const a = [...document.querySelectorAll('#out ' + sel)].filter(x => x.offsetParent)[i]; if (!a) return false; a.click(); return true; }, [sel, i]);
          if (!ok) continue;
          nLinks++; await afterAction(p, `${t}: link ${sel} #${i}`);
          const cur = await p.$eval('#tabBar [aria-selected="true"]', x => x.dataset.otab).catch(() => t);
          if (cur !== t) await showTab(p, t);
        }
      }
    }
    // 2. every input tab: the wheel down and back up in the input panel
    for (const t of itabs) {
      await p.click(`#inTabs [data-itab="${t}"]`); await p.waitForTimeout(400);
      const s = await state(p);
      check(s.over <= 0 && s.overX <= 0 && s.doc === 0, `input tab ${t}: document larger than the window by ${s.over} / ${s.overX} px, scroll ${s.doc}`);
      const r = await p.$eval('#inputPanel', e => { const q = e.getBoundingClientRect(); return { x: q.left + 4, y: q.top + q.height / 2, max: e.scrollHeight - e.clientHeight }; });
      await p.mouse.move(r.x, r.y); for (let k = 0; k < 8; k++) await p.mouse.wheel(0, 1500); await p.waitForTimeout(250);
      const d = await state(p);
      check(r.max <= 0 || d.inp > 0, `input tab ${t}: the wheel did not scroll the input panel down`);
      await wheelBack(p);
      const u = await state(p);
      check(u.inp === 0 && u.doc === 0, `input tab ${t}: wheel back up: input ${u.inp}, doc ${u.doc}`);
    }
    // 4. script scrolls
    await showTab(p, 'rpt');
    await p.evaluate(() => document.querySelector('#outputPanel .sbscProbe').scrollIntoView({ block: 'start' })); await afterAction(p, 'scrollIntoView of the output panel bottom');
    await p.evaluate(() => { const e = [...document.querySelectorAll('.rp-doc .rp-step')].pop(); if (e) e.scrollIntoView({ block: 'end' }); }); await afterAction(p, 'scrollIntoView of the last report step');
    await p.evaluate(() => { const e = [...document.querySelectorAll('#inputPanel input')].pop(); if (e) e.focus(); }); await afterAction(p, 'focus() on the last input');
    await p.evaluate(() => window.scrollTo(0, 400)); await afterAction(p, 'window.scrollTo(0,400)');
    // 5. 3D view: drag on the canvas, then the wheel beside it
    await showTab(p, '3d'); await p.waitForTimeout(1200);
    const cv = await p.$('#out canvas');
    check(!!cv, '3D view: no canvas');
    if (cv) {
      const q = await cv.boundingBox(); await p.mouse.move(q.x + q.width / 2, q.y + 100); await p.mouse.down(); await p.mouse.move(q.x + q.width / 2 + 60, q.y + 140); await p.mouse.up();
      const r = await p.$eval('#outputPanel', e => { const b = e.getBoundingClientRect(); return { x: b.left + 4, y: b.top + b.height / 2, max: e.scrollHeight - e.clientHeight }; });
      await p.mouse.move(r.x, r.y); for (let k = 0; k < 5; k++) await p.mouse.wheel(0, 1500); await p.waitForTimeout(250);
      const d = await state(p); check(r.max <= 0 || d.out > 0, '3D view: the wheel beside the canvas after a drag did not scroll the panel');
      await afterAction(p, '3D view after a canvas drag');
    }
    if (args.shots) { await showTab(p, 'flex'); await p.screenshot({ path: path.join(args.shots, `sb-scroll-${vw}x${vh}.png`) }); }
    check(errs.length === 0, `console errors: ${errs.slice(0, 3).join(' | ')}`);
    console.log(`  ${otabs.length} output tabs, ${itabs.length} input tabs, ${nLinks} links clicked`);
  } finally { await b.close(); }
}

// 6. touch: finger swipes on the output panel (CDP touch events), after a link has scrolled by script
{
  const { b, p } = await open(1280, 800);
  try {
    await showTab(p, 'cf');
    const c = await p.context().newCDPSession(p);
    const r = await p.$eval('#outputPanel', e => { const b = e.getBoundingClientRect(); return { x: b.left + 20, y: b.top + b.height / 2 }; });
    const swipe = async dy => { const y = r.y - dy / 2; await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y }] });
      for (let k = 1; k <= 20; k++) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r.x, y: y + dy * k / 20 }] }); await p.waitForTimeout(16); }
      await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(500); };
    await swipe(-300); const d = await state(p);
    check(d.out > 0 && d.doc === 0, `touch: swipe down: output ${d.out}, doc ${d.doc}`);
    await p.evaluate(() => { const a = [...document.querySelectorAll('#out a[href^="#st-"]')].filter(x => x.offsetParent).pop(); if (a) a.click(); }); await p.waitForTimeout(1000);
    for (let k = 0; k < 60; k++) { await swipe(400); const s = await state(p); if (s.out === 0) break; }
    const u = await state(p);
    check(u.out === 0 && u.doc === 0 && u.hdrTop >= 0, `touch: swipe back up: output ${u.out}, doc ${u.doc}, header top ${u.hdrTop}`);
  } finally { await b.close(); }
}

// 7. single-column layout (below 900 px): the page scrolls and is not reset
{
  const { b, p } = await open(390, 844);
  try {
    await p.evaluate(() => window.scrollTo(0, 600)); await p.waitForTimeout(400);
    const s = await state(p); check(s.doc > 0, `single-column layout: page scroll ${s.doc} (expected > 0, the page scrolls normally there)`);
    if (args.shots) { await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: path.join(args.shots, 'sb-scroll-390x844.png') }); }
  } finally { await b.close(); }
}

console.log(failures ? `FAIL: ${failures} check(s) failed` : 'PASS', `(${actions} scripted scroll actions, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
process.exit(failures ? 1 : 0);
