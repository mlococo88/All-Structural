#!/usr/bin/env node
// Spread Footing: the page itself never scrolls in the two-panel screen layout (SFSC, 2026-11-01).
// Engineer: "sometimes if I scroll down it won't let me scroll up, I have to refresh the page". Cause: absolutely positioned
// descendants of the panels (KaTeX's hidden MathML spans) escaped .main's overflow clip and made the document taller than the
// window; a scrollIntoView (Worked-in links, input-tab links, report links) or window.scrollTo (report tab links) then scrolled
// the page, which has no scroll bar (body overflow:hidden), so the header and the top of both panels stayed out of reach.
// Headless Chromium, file://, at 1280x800, 1366x768 and 1920x1080:
//   1. after every output tab is opened the document is no taller than the window and its scroll stays 0;
//   2. the wheel scrolls each panel down and back up to 0 on every tab;
//   3. the actions that scroll by script (Worked-in links, input-tab links, report "see §" and tab links, sfrGoto, a
//      scrollIntoView of a deep element, a focus() below the fold, window.scrollTo) leave the document at 0 and both
//      panels can be wheeled back to 0; the title row stays on screen;
//   4. 3D tab: after a drag on the canvas, the wheel beside the canvas still scrolls the panel;
//   5. touch: finger swipes scroll the output panel down and, after a Worked-in link, back up to 0; the document stays at 0;
//   6. below the 900 px breakpoint (single-column layout) the page still scrolls normally (the reset is not active).
// A hidden absolutely positioned span (like KaTeX's MathML) is added at the bottom of each panel, so the check also holds when
// the CDN libraries are not available offline (tests/libs does not have the versions this tool pins).
//   node tests/smoke/spread-footing-scroll.mjs [--file <file>] [--libs <dir>] [--shots <dir>]
//   --file: default the working-tree file; another copy must sit next to a shared/ folder (it loads shared/*.js)
//   --libs: a folder with katex/dist/, plotly/plotly.min.js and three/build/three.min.js for the versions the tool pins (optional)
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { openPage, resolveFile } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const TOOL = 'Spread Footing.html';
const SRC = resolveFile(args.file || TOOL, TOOL);
const LIBS = args.libs || process.env.SF_LIBS || '';
if (args.shots) fs.mkdirSync(args.shots, { recursive: true });
const t0 = Date.now();
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL ' + msg); } };

async function open(vw, vh) {
  const o = await openPage(SRC.file, { vw, vh });
  if (LIBS) {
    const MAP = { 'cdn.jsdelivr.net/npm/katex@0.16.11/dist/': 'katex/dist/', 'cdn.plot.ly/plotly-2.35.2.min.js': 'plotly/plotly.min.js', 'cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js': 'three/build/three.min.js' };
    await o.ctx.route(/cdn\.(jsdelivr\.net|plot\.ly)/, r => {
      const k = r.request().url().replace(/^https?:\/\//, '').split('?')[0];
      for (const [pre, loc] of Object.entries(MAP)) {
        const f = k === pre ? path.join(LIBS, loc) : pre.endsWith('/') && k.startsWith(pre) ? path.join(LIBS, loc, k.slice(pre.length)) : null;
        if (f && fs.existsSync(f)) return r.fulfill({ path: f, contentType: f.endsWith('.css') ? 'text/css' : 'application/javascript' });
      }
      return r.fallback();
    });
    o.errs.length = 0; await o.p.reload();
  }
  await o.p.waitForSelector('#tabbar button[data-tab="tab-report"]');
  await o.p.waitForTimeout(2500);
  // hidden absolutely positioned spans at the bottom of both panels (as KaTeX's MathML)
  await o.p.evaluate(() => { for (const id of ['inputPanel', 'outputPanel']) { const s = document.createElement('span'); s.className = 'sfscProbe';
    s.style.cssText = 'position:absolute;clip:rect(1px,1px,1px,1px);width:1px;height:1px;overflow:hidden;padding:0;border:0'; s.textContent = 'x'; document.getElementById(id).appendChild(s); } });
  return o;
}
const state = p => p.evaluate(() => { const se = document.scrollingElement, t = document.querySelector('.wrap').getBoundingClientRect();
  return { doc: se.scrollTop, docX: se.scrollLeft, over: se.scrollHeight - se.clientHeight, inp: document.getElementById('inputPanel').scrollTop, out: document.getElementById('outputPanel').scrollTop, wrapTop: Math.round(t.top) }; });
async function wheelBack(p, vw, vh) {   // wheel both panels back up to the top, from points beside any drawing / 3D canvas
  for (const sel of ['#inputPanel', '#outputPanel']) {
    const r = await p.$eval(sel, e => { const b = e.getBoundingClientRect(); return { x: b.left + 4, y: b.top + b.height / 2 }; });
    await p.mouse.move(r.x, r.y);
    for (let k = 0; k < 40; k++) await p.mouse.wheel(0, -2000);
  }
  await p.waitForTimeout(300);
}
async function afterAction(p, vw, vh, label) {
  await p.waitForTimeout(1300);   // smooth scrolls finish
  const s = await state(p);
  check(s.doc === 0 && s.docX === 0, `${label}: document scroll ${s.doc}/${s.docX} (expected 0)`);
  await wheelBack(p, vw, vh);
  const s2 = await state(p);
  check(s2.doc === 0 && s2.inp === 0 && s2.out === 0 && s2.wrapTop >= 0, `${label}: after wheeling up doc ${s2.doc}, input ${s2.inp}, output ${s2.out}, title row top ${s2.wrapTop}`);
  return s;
}

for (const [vw, vh] of [[1280, 800], [1366, 768], [1920, 1080]]) {
  console.log(`${vw}x${vh}  ${SRC.label}`);
  const { b, p, errs } = await open(vw, vh);
  try {
    const tabs = await p.$$eval('#tabbar button', bs => bs.map(x => x.dataset.tab));
    // 1 + 2: every tab, wheel down and back up in the output panel (beside the canvas / drawing), then the input panel
    for (const t of tabs) {
      await p.click(`#tabbar button[data-tab="${t}"]`); await p.waitForTimeout(800);
      const s = await state(p);
      check(s.over <= 0 && s.doc === 0, `${t}: document taller than the window by ${s.over} px, scroll ${s.doc}`);
      const r = await p.$eval('#outputPanel', e => { const q = e.getBoundingClientRect(); return { x: q.left + 4, y: q.top + q.height / 2, max: e.scrollHeight - e.clientHeight }; });
      await p.mouse.move(r.x, r.y); for (let k = 0; k < 10; k++) await p.mouse.wheel(0, 1500); await p.waitForTimeout(300);
      const d = await state(p);
      check(r.max <= 0 || d.out > 0, `${t}: wheel did not scroll the output panel down`);
      await wheelBack(p, vw, vh);
      const u = await state(p);
      check(u.out === 0 && u.doc === 0, `${t}: wheel back up: output ${u.out}, doc ${u.doc}`);
    }
    // 3: actions that scroll by script
    await p.click('#tabbar button[data-tab="tab-footdes"]'); await p.waitForTimeout(800);
    const nWk = await p.$$eval('a.wkA', a => a.filter(x => x.offsetParent).length);
    for (let i = 0; i < Math.min(nWk, 4); i++) {
      await p.evaluate(i => { const P = document.getElementById('outputPanel'); P.scrollTop = P.scrollHeight; [...document.querySelectorAll('a.wkA')].filter(x => x.offsetParent)[i].click(); }, i);
      await afterAction(p, vw, vh, `Worked-in link ${i}`);
      await p.click('#tabbar button[data-tab="tab-footdes"]'); await p.waitForTimeout(400);
    }
    const nIn = await p.$$eval('a.sfdInA', a => a.length);
    if (nIn) { await p.evaluate(() => { const a = document.querySelector('a.sfdInA'); a.click(); }); await afterAction(p, vw, vh, 'input-tab link'); }
    for (const g of ['stab', 'footdes', 'in-reinf', 'combos']) { await p.evaluate(g => { document.getElementById('outputPanel').scrollTop = 900; sfrGoto(g); }, g); await afterAction(p, vw, vh, `sfrGoto('${g}')`); }
    await p.click('#tabbar button[data-tab="tab-report"]'); await p.waitForTimeout(1500);
    const nSee = await p.$$eval('#tab-report a[href^="#"]', a => a.filter(x => x.offsetParent).length);
    for (let i = 0; i < Math.min(nSee, 3); i++) { await p.evaluate(i => [...document.querySelectorAll('#tab-report a[href^="#"]')].filter(x => x.offsetParent)[i].click(), i); await afterAction(p, vw, vh, `report link ${i}`); }
    await p.evaluate(() => { const e = document.querySelector('#outputPanel .sfscProbe'); e.scrollIntoView({ block: 'start' }); }); await afterAction(p, vw, vh, 'scrollIntoView of the panel bottom');
    await p.evaluate(() => { const e = [...document.querySelectorAll('#inputPanel input')].pop(); e.focus(); }); await afterAction(p, vw, vh, 'focus() on the last input');
    await p.evaluate(() => window.scrollTo(0, 400)); await afterAction(p, vw, vh, 'window.scrollTo(0,400)');
    // 4: 3D tab: drag on the canvas, then wheel beside it
    await p.click('#tabbar button[data-tab="tab-3d"]'); await p.waitForTimeout(1200);
    const cv = await p.$('#tab-3d canvas');
    if (cv) {
      const q = await cv.boundingBox(); await p.mouse.move(q.x + q.width / 2, q.y + 100); await p.mouse.down(); await p.mouse.move(q.x + q.width / 2 + 60, q.y + 140); await p.mouse.up();
      const r = await p.$eval('#outputPanel', e => { const b = e.getBoundingClientRect(); return { x: b.left + 4, y: b.top + b.height / 2, max: e.scrollHeight - e.clientHeight }; });
      await p.mouse.move(r.x, r.y); for (let k = 0; k < 5; k++) await p.mouse.wheel(0, 1500); await p.waitForTimeout(300);
      const d = await state(p); check(r.max <= 0 || d.out > 0, '3D tab: wheel beside the canvas after a drag did not scroll the panel');
      await afterAction(p, vw, vh, '3D tab after a canvas drag');
    }
    if (args.shots) await p.screenshot({ path: path.join(args.shots, `sf-scroll-${vw}x${vh}.png`) });
    const e = errs.filter(x => !/ERR_FAILED|is not defined|ERR_INTERNET|net::/.test(x) || LIBS);
    check(e.length === 0, `console errors: ${e.slice(0, 3).join(' | ')}`);
  } finally { await b.close(); }
}

// 5: touch: finger swipes on the output panel (CDP touch events), after a link has scrolled by script
{
  const { b, p } = await open(1280, 800);
  try {
    await p.click('#tabbar button[data-tab="tab-stab"]'); await p.waitForTimeout(800);
    const c = await p.context().newCDPSession(p);
    const r = await p.$eval('#outputPanel', e => { const b = e.getBoundingClientRect(); return { x: b.left + 20, y: b.top + b.height / 2 }; });
    const swipe = async dy => { const y = r.y - dy / 2; await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y }] });
      for (let k = 1; k <= 20; k++) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r.x, y: y + dy * k / 20 }] }); await p.waitForTimeout(16); }
      await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(600); };
    await swipe(-300); const d = await state(p);
    check(d.out > 0 && d.doc === 0, `touch: swipe down: output ${d.out}, doc ${d.doc}`);
    await p.evaluate(() => { const a = [...document.querySelectorAll('a.wkA')].filter(x => x.offsetParent)[0]; if (a) a.click(); }); await p.waitForTimeout(1300);
    for (let k = 0; k < 40; k++) { await swipe(400); const s = await state(p); if (s.out === 0) break; }
    const u = await state(p);
    check(u.out === 0 && u.doc === 0 && u.wrapTop >= 0, `touch: swipe back up: output ${u.out}, doc ${u.doc}, title row top ${u.wrapTop}`);
  } finally { await b.close(); }
}

// 6: single-column layout (below 900 px): the page scrolls and is not reset
{
  const { b, p } = await open(800, 900);
  try {
    await p.evaluate(() => window.scrollTo(0, 600)); await p.waitForTimeout(400);
    const s = await state(p); check(s.doc > 0, `single-column layout: page scroll ${s.doc} (expected > 0, the page scrolls normally there)`);
  } finally { await b.close(); }
}

console.log(failures ? `FAIL: ${failures} check(s) failed` : 'PASS', `(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
process.exit(failures ? 1 : 0);
