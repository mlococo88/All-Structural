#!/usr/bin/env node
// LL & DL Distribution (lldf.html): the two-panel layout (LXL, 2026-11-01). Inputs in tabs on the left, results in tabs on the
// right; the page itself never scrolls in the two-panel layout (the KaTeX scroll trap fixed in Spread Footing PR #524: the panels
// are position:relative, the panels scroll, a page scroll by script is reset).
// Headless Chromium, file://:
//   1. layout: every input of the sheet sits in an input tab, every result card in an output tab, nothing is left on the hidden
//      sheet (#lxHome) but the title block's name, the emptied 1.0 card (its group headings) and the disclaimer; the Lever rule tab hides for a type without the lever rule;
//   2. at 1280x800, 1366x768 and 1920x1080: on every output tab the document is no taller than the window and its scroll stays 0;
//      the wheel scrolls the output panel down and back up to 0; the same for every input tab and the input panel;
//   3. the actions that scroll by script (Worked-in links, the Report tab's links back to the cards, [data-lxgo] links, a
//      scrollIntoView of a deep element, focus() on the last input, window.scrollTo) leave the document at 0, open the right tab
//      and both panels can be wheeled back to 0;
//   4. LXM (2026-11-02): the output tabs are Summary, LL worked steps, Lever rule, Dead load (3.6 results, then the 4D worked
//      steps), Applicability & notes, Report (the D11 Calc sheet tab and lldfBuildReport are retired); a remembered tab of before
//      (dlsteps, calc) opens its successor (dl, report); Ctrl+P prints the report from every tab (running header, page numbers)
//      and the tab shown before comes back;
//   5. touch: finger swipes scroll the output panel down and back up to 0; the document stays at 0;
//   6. below the 900 px breakpoint (390 px phone): the panels stack, the page scrolls normally and has no horizontal scroll;
//   7. inside index.html's frame (MCT Generator → LL & DL Distribution), at 1280x800: the same two-panel layout, the document of
//      the frame no taller than the frame, the output panel scrolls.
// A hidden absolutely positioned span (like KaTeX's MathML) is added at the bottom of each panel so check 2 also holds with
// KaTeX's spans in any state.
//   node tests/smoke/lldf-layout.mjs [--file <file>] [--shots <dir>] [--no-index]
import fs from 'fs';
import path from 'path';
import { openPage, resolveFile, REPO } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const TOOL = 'lldf.html';
const SRC = resolveFile(args.file || TOOL, TOOL);
if (args.shots) fs.mkdirSync(args.shots, { recursive: true });
const t0 = Date.now();
let failures = 0, checks = 0;
const check = (ok, msg) => { checks++; if (!ok) { failures++; console.log('  FAIL ' + msg); } };

async function open(vw, vh) {
  const o = await openPage(SRC.file, { vw, vh });
  await o.p.waitForSelector('#lxOutTabs .lx-tab[data-k="report"]');
  await o.p.waitForTimeout(1500);
  await o.p.evaluate(() => { for (const id of ['inputPanel', 'outputPanel']) { const s = document.createElement('span'); s.className = 'lxProbe';
    s.style.cssText = 'position:absolute;clip:rect(1px,1px,1px,1px);width:1px;height:1px;overflow:hidden;padding:0;border:0'; s.textContent = 'x'; document.getElementById(id).appendChild(s); } });
  return o;
}
const state = p => p.evaluate(() => { const se = document.scrollingElement, t = document.querySelector('.apphead').getBoundingClientRect();
  return { doc: se.scrollTop, docX: se.scrollLeft, over: se.scrollHeight - se.clientHeight, overX: se.scrollWidth - se.clientWidth,
    inp: document.getElementById('inputPanel').scrollTop, out: document.getElementById('outputPanel').scrollTop, headTop: Math.round(t.top), cur: window.LXL.cur() }; });
async function wheelBack(p) {
  for (const sel of ['#inputPanel', '#outputPanel']) {
    const r = await p.$eval(sel, e => { const b = e.getBoundingClientRect(); return { x: b.left + 4, y: b.top + b.height / 2 }; });
    await p.mouse.move(r.x, r.y);
    for (let k = 0; k < 40; k++) await p.mouse.wheel(0, -2500);
  }
  await p.waitForTimeout(300);
}
async function afterAction(p, label) {
  await p.waitForTimeout(1200);   // smooth scrolls finish
  const s = await state(p);
  check(s.doc === 0 && s.docX === 0, `${label}: document scroll ${s.doc}/${s.docX} (expected 0)`);
  await wheelBack(p);
  const s2 = await state(p);
  check(s2.doc === 0 && s2.inp === 0 && s2.out === 0 && s2.headTop >= 0, `${label}: after wheeling up doc ${s2.doc}, input ${s2.inp}, output ${s2.out}, header top ${s2.headTop}`);
  return s;
}
async function wheelPanel(p, sel, label) {
  const r = await p.$eval(sel, e => { const q = e.getBoundingClientRect(); return { x: q.left + 4, y: q.top + q.height / 2, max: e.scrollHeight - e.clientHeight }; });
  await p.mouse.move(r.x, r.y); for (let k = 0; k < 10; k++) await p.mouse.wheel(0, 1500); await p.waitForTimeout(300);
  const d = await state(p);
  check(r.max <= 0 || d[sel === '#outputPanel' ? 'out' : 'inp'] > 0, `${label}: wheel did not scroll ${sel} down`);
  await wheelBack(p);
  const u = await state(p);
  check(u.out === 0 && u.inp === 0 && u.doc === 0, `${label}: wheel back up: input ${u.inp}, output ${u.out}, doc ${u.doc}`);
}

// 1 + 4: layout, the output tabs, printing
{
  const { b, p, errs } = await open(1280, 800);
  try {
    const L = await p.evaluate(() => {
      const home = document.getElementById('lxHome');
      const ids = [...document.querySelectorAll('input[id],select[id]')].filter(e => !e.closest('#lldfReport') && !e.closest('.apphead') && !/^(bxGeomFile|projFile|refFile)$/.test(e.id));
      const where = e => e.closest('#lxHome') ? 'home' : e.closest('#inputPanel') ? 'in' : e.closest('#outputPanel') ? 'out' : 'other';
      const leftIn = ids.filter(e => where(e) === 'home').map(e => e.id);
      const outInputs = ids.filter(e => where(e) === 'out').map(e => e.id);
      const cards = ['summaryTable', 'derived', 'fig-xsec', 'steps', 'fig-lever', 'leverConfigs', 'mdDistTable', 'fig-mddist', 'dlSteps', 'applTable', 'notes', 'lldfRptView']
        .map(id => [id, (document.getElementById(id) || {}).closest ? where(document.getElementById(id)) : 'missing']);
      const homeText = [...home.children].filter(c => c.nodeType === 1 && c.textContent.trim()).map(c => c.className);
      return { leftIn, outInputs, cards, homeText, nIn: ids.filter(e => where(e) === 'in').length };
    });
    check(L.leftIn.length === 0, `inputs left on the hidden sheet: ${L.leftIn.join(', ')}`);
    check(L.nIn >= 50, `inputs in the input panel: ${L.nIn}`);
    check(L.outInputs.every(id => /^(memberSelect|truckSel)$/.test(id)), `inputs in the output panel other than the girder / truck pickers: ${L.outInputs.join(', ')}`);
    check(L.cards.every(c => c[1] === 'out'), `result cards not in an output tab: ${L.cards.filter(c => c[1] !== 'out').map(c => c.join(':')).join(', ')}`);
    check(L.homeText.join('|') === 'titleblock|section|disclaimer', `left on the hidden sheet: ${L.homeText.join(', ')}`);
    // LXM: the tabs; the Dead load tab holds the 3.6 results first, then the 4D worked steps
    const T = await p.evaluate(() => ({ out: [...document.querySelectorAll('#lxOutTabs .lx-tab')].map(b => b.dataset.k).join(','), build: typeof window.lldfBuildReport, rep: !!document.getElementById('lldfReport'),
      dl: (() => { const pn = document.getElementById('lxPane_out_dl'), a = document.getElementById('mdDistTable'), s = document.getElementById('dlSteps');
        return !!(pn && a && s && pn.contains(a) && pn.contains(s) && (a.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING)); })() }));
    check(T.out === 'summary,steps,lever,dl,appl,report' && T.build === 'undefined' && !T.rep && T.dl, `output tabs / Dead load tab: ${JSON.stringify(T)}`);
    // Ctrl+P from every output tab prints the report alone, with the running header and page numbers; the tab comes back after
    for (const t of await p.$$eval('#lxOutTabs .lx-tab', bs => bs.filter(x => !x.hidden).map(x => x.dataset.k))) {
      await p.click(`#lxOutTabs .lx-tab[data-k="${t}"]`); await p.waitForTimeout(t === 'report' ? 1200 : 400);
      await p.emulateMedia({ media: 'print' });
      await p.evaluate(() => { window.dispatchEvent(new Event('beforeprint')); });
      const pr = await p.evaluate(() => ({ rp: document.body.classList.contains('rp-printing'), len: ((document.getElementById('rp-print') || {}).innerText || '').length,
        page: /counter\(pages\)/.test((document.getElementById('rp-page') || {}).textContent || ''), shell: getComputedStyle(document.getElementById('sheet')).display }));
      await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      await p.emulateMedia({ media: 'screen' });
      const back = await p.evaluate(() => ({ cur: window.LXL.cur().out, rp: document.body.classList.contains('rp-printing') }));
      check(pr.rp && pr.len > 10000 && pr.page && pr.shell === 'none' && back.cur === t && !back.rp, `print from the ${t} tab prints the report and returns (${JSON.stringify({ pr, back })})`);
    }
    // Lever rule tab hides for a type without the lever rule (adjacent boxes, type f)
    await p.click('#lxOutTabs .lx-tab[data-k="lever"]'); await p.waitForTimeout(300);
    await p.selectOption('#bridgeType', 'f'); await p.waitForTimeout(500);
    const lv = await p.evaluate(() => ({ hidden: document.querySelector('#lxOutTabs .lx-tab[data-k="lever"]').hidden, cur: window.LXL.cur().out }));
    check(lv.hidden && lv.cur === 'summary', `type f: Lever rule tab hidden, Summary shown (${JSON.stringify(lv)})`);
    await p.selectOption('#bridgeType', 'k'); await p.waitForTimeout(500);
    check(!(await p.evaluate(() => document.querySelector('#lxOutTabs .lx-tab[data-k="lever"]').hidden)), 'type k: Lever rule tab shown again');
    check(errs.length === 0, `console errors: ${errs.slice(0, 3).join(' | ')}`);
  } finally { await b.close(); }
}

// 4: a tab remembered from before the merge (LXM): "dlsteps" opens Dead load, "calc" opens Report
for (const [old, want] of [['dlsteps', 'dl'], ['calc', 'report']]) {
  const o = await openPage(SRC.file, { vw: 1280, vh: 800, ls: { lldf_lxOutTab_v1: old } });
  try {
    await o.p.waitForSelector('#lxOutTabs .lx-tab[data-k="report"]'); await o.p.waitForTimeout(1500);
    const c = await o.p.evaluate(() => window.LXL.cur().out);
    check(c === want, `remembered output tab "${old}" opens ${c} (expected ${want})`);
    if (args.shots && old === 'dlsteps') {
      await o.p.screenshot({ path: path.join(args.shots, 'lldf-deadload-1280.png') });
      await o.p.evaluate(() => { const P = document.getElementById('outputPanel'), s = document.getElementById('mdDLSec'); P.scrollTop += s.getBoundingClientRect().top - P.getBoundingClientRect().top - 40; });
      await o.p.waitForTimeout(300); await o.p.screenshot({ path: path.join(args.shots, 'lldf-deadload-4d-1280.png') });
    }
    check(o.errs.length === 0, `remembered tab ${old}: console errors: ${o.errs.slice(0, 3).join(' | ')}`);
  } finally { await o.b.close(); }
}

// 2 + 3: wheel and script scrolls at three window sizes
for (const [vw, vh] of [[1280, 800], [1366, 768], [1920, 1080]]) {
  console.log(`${vw}x${vh}  ${SRC.label}`);
  const { b, p, errs } = await open(vw, vh);
  try {
    const outs = await p.$$eval('#lxOutTabs .lx-tab', bs => bs.filter(x => !x.hidden).map(x => x.dataset.k));
    for (const t of outs) {
      await p.click(`#lxOutTabs .lx-tab[data-k="${t}"]`); await p.waitForTimeout(t === 'report' ? 1200 : 600);
      const s = await state(p);
      check(s.over <= 0 && s.doc === 0 && s.overX <= 0, `${t}: document taller / wider than the window by ${s.over} / ${s.overX} px, scroll ${s.doc}`);
      await wheelPanel(p, '#outputPanel', `output tab ${t}`);
    }
    const ins = await p.$$eval('#lxInTabs .lx-tab', bs => bs.map(x => x.dataset.k));
    for (const t of ins) { await p.click(`#lxInTabs .lx-tab[data-k="${t}"]`); await p.waitForTimeout(300); await wheelPanel(p, '#inputPanel', `input tab ${t}`); }
    // Worked-in links (summary caption, derived block): open the LL worked steps tab
    await p.click('#lxOutTabs .lx-tab[data-k="summary"]'); await p.waitForTimeout(400);
    const nWk = await p.$$eval('#lxPane_out_summary a.wkA', a => a.length);
    for (let i = 0; i < Math.min(nWk, 4); i++) {
      await p.click('#lxOutTabs .lx-tab[data-k="summary"]'); await p.waitForTimeout(300);
      await p.evaluate(i => { const P = document.getElementById('outputPanel'); P.scrollTop = P.scrollHeight; document.querySelectorAll('#lxPane_out_summary a.wkA')[i].click(); }, i);
      const s = await afterAction(p, `Worked-in link ${i}`);
      check(s.cur.out === 'steps', `Worked-in link ${i} opened the ${s.cur.out} tab (expected steps)`);
    }
    // DL Worked-in links land on their worked step (4D) in the same Dead load tab, in view in the output panel
    for (let i = 0; i < 3; i++) {
      await p.click('#lxOutTabs .lx-tab[data-k="dl"]'); await p.waitForTimeout(400);
      const lab = await p.evaluate(i => { const a = document.querySelectorAll('#lxPane_out_dl a.wkA[data-scope="dl"]')[i]; if (!a) return null; a.click(); return a.dataset.m; }, i);
      if (lab == null) break;
      await p.waitForTimeout(1200);
      const v = await p.evaluate(m => { const P = document.getElementById('outputPanel').getBoundingClientRect(); const cs = [...document.querySelectorAll('#dlSteps .calcstep')].find(c => (c.querySelector('.cs-title') || {}).textContent.indexOf(m) >= 0);
        const r = cs && cs.getBoundingClientRect(); return { found: !!cs, inView: !!r && r.top < P.bottom && r.bottom > P.top }; }, lab);
      const s = await afterAction(p, `DL Worked-in link ${i}`);
      check(s.cur.out === 'dl' && v.found && v.inView, `DL Worked-in link ${i} (${lab}) opened ${s.cur.out} (expected dl), step in view: ${JSON.stringify(v)}`);
    }
    // [data-lxgo] links (Roadway tab note)
    await p.click('#lxInTabs .lx-tab[data-k="roadway"]'); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('a[data-lxgo="fig-lever"]').click());
    { const s = await afterAction(p, 'Roadway → Lever rule link'); check(s.cur.out === 'lever', `Roadway note link opened ${s.cur.out} (expected lever)`); }
    // Report tab links back to the cards ([[tab:name|…]] → a.rp-go[data-rpgoto] → LLRP's gotoSheet): every distinct target
    await p.click('#lxOutTabs .lx-tab[data-k="report"]'); await p.waitForTimeout(1500);
    const GOTAB = { inputs: 'in', summary: 'summary', xsec: 'summary', steps: 'steps', lever: 'lever', dl: 'dl', dlsteps: 'dl', appl: 'appl', notes: 'appl' };
    const gos = await p.$$eval('#lldfRptView a.rp-go[data-rpgoto]', a => [...new Set(a.map(x => x.dataset.rpgoto))]);
    check(gos.length >= 4, `report links to the cards: ${gos.join(', ')}`);
    for (const g of gos) {
      await p.click('#lxOutTabs .lx-tab[data-k="report"]'); await p.waitForTimeout(600);
      await p.evaluate(g => { document.getElementById('outputPanel').scrollTop = 900; const a = [...document.querySelectorAll('#lldfRptView a.rp-go')].find(x => x.dataset.rpgoto === g); a.scrollIntoView({ block: 'center' }); a.click(); }, g);
      const s = await afterAction(p, `report link ${g}`);
      const want = /^member:/.test(g) ? 'steps' : GOTAB[g];
      if (want === 'in') check(s.cur.out !== 'report' && s.cur.in === 'bridge', `report link ${g} opened input ${s.cur.in} / output ${s.cur.out}`);
      else check(s.cur.out === want, `report link ${g} opened ${s.cur.out} (expected ${want})`);
    }
    await p.evaluate(() => { const e = document.querySelector('#outputPanel .lxProbe'); e.scrollIntoView({ block: 'start' }); }); await afterAction(p, 'scrollIntoView of the panel bottom');
    await p.evaluate(() => { const e = [...document.querySelectorAll('#inputPanel input')].filter(x => x.offsetParent).pop(); e.focus(); }); await afterAction(p, 'focus() on the last input');
    await p.evaluate(() => window.scrollTo(0, 400)); await afterAction(p, 'window.scrollTo(0,400)');
    if (args.shots) await p.screenshot({ path: path.join(args.shots, `lldf-layout-${vw}x${vh}.png`) });
    check(errs.length === 0, `console errors: ${errs.slice(0, 3).join(' | ')}`);
  } finally { await b.close(); }
}

// 5: touch
{
  const { b, p } = await open(1280, 800);
  try {
    await p.click('#lxOutTabs .lx-tab[data-k="steps"]'); await p.waitForTimeout(800);
    const c = await p.context().newCDPSession(p);
    const r = await p.$eval('#outputPanel', e => { const b = e.getBoundingClientRect(); return { x: b.left + 20, y: b.top + b.height / 2 }; });
    const swipe = async dy => { const y = r.y - dy / 2; await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y }] });
      for (let k = 1; k <= 20; k++) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r.x, y: y + dy * k / 20 }] }); await p.waitForTimeout(16); }
      await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(600); };
    await swipe(-300); const d = await state(p);
    check(d.out > 0 && d.doc === 0, `touch: swipe down: output ${d.out}, doc ${d.doc}`);
    for (let k = 0; k < 40; k++) { await swipe(400); const s = await state(p); if (s.out === 0) break; }
    const u = await state(p);
    check(u.out === 0 && u.doc === 0 && u.headTop >= 0, `touch: swipe back up: output ${u.out}, doc ${u.doc}, header top ${u.headTop}`);
  } finally { await b.close(); }
}

// 6: phone width: stacked, the page scrolls, no horizontal scroll on any tab
{
  const { b, p, errs } = await open(390, 844);
  try {
    const lay = await p.evaluate(() => { const i = document.getElementById('inputPanel').getBoundingClientRect(), o = document.getElementById('outputPanel').getBoundingClientRect(); return { stacked: o.top >= i.bottom - 1, w: Math.round(o.width) }; });
    check(lay.stacked && lay.w >= 360, `390 px: panels stacked, output width ${lay.w}`);
    for (const t of await p.$$eval('#lxOutTabs .lx-tab', bs => bs.filter(x => !x.hidden).map(x => x.dataset.k))) {
      await p.click(`#lxOutTabs .lx-tab[data-k="${t}"]`); await p.waitForTimeout(t === 'report' ? 1200 : 400);
      const s = await state(p); check(s.overX <= 0, `390 px, ${t}: page wider than the window by ${s.overX} px`);
    }
    await p.evaluate(() => window.scrollTo(0, 600)); await p.waitForTimeout(300);
    const s = await state(p); check(s.doc > 0, `390 px: page scroll ${s.doc} (expected > 0, the page scrolls normally there)`);
    if (args.shots) { await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: path.join(args.shots, 'lldf-layout-390.png') });
      for (const t of ['dl', 'report']) { await p.click(`#lxOutTabs .lx-tab[data-k="${t}"]`); await p.waitForTimeout(t === 'report' ? 1200 : 500);
        await p.evaluate(() => document.getElementById('outputPanel').scrollIntoView({ block: 'start' })); await p.waitForTimeout(300);
        await p.screenshot({ path: path.join(args.shots, `lldf-${t}-390.png`) }); } }
    check(errs.length === 0, `390 px console errors: ${errs.slice(0, 3).join(' | ')}`);
  } finally { await b.close(); }
}

// 7: inside index.html's frame
if (!args['no-index'] && !args.file) {
  const o = await openPage(path.join(REPO, 'index.html'), { vw: 1280, vh: 800 });
  try {
    await o.p.waitForTimeout(2500);
    const btn = await o.p.$('button[title^="Live-load distribution factors"]');
    check(!!btn, 'index.html: the LL & DL Distribution button');
    if (btn) {
      await btn.click(); await o.p.waitForTimeout(3500);
      const f = o.p.frames().find(x => /lldf\.html/.test(x.url()));
      check(!!f, 'index.html frames lldf.html');
      if (f) {
        const s = await f.evaluate(() => { const se = document.scrollingElement, i = document.getElementById('inputPanel').getBoundingClientRect(), O = document.getElementById('outputPanel');
          return { vw: innerWidth, vh: innerHeight, over: se.scrollHeight - se.clientHeight, overX: se.scrollWidth - se.clientWidth, inW: Math.round(i.width), outH: O.clientHeight, outMax: O.scrollHeight - O.clientHeight, side: O.getBoundingClientRect().left > i.right - 1 }; });
        check(s.over <= 0 && s.overX <= 0 && s.side && s.inW >= 360 && s.outMax > 0, `index.html frame ${s.vw}x${s.vh}: two panels side by side, document fits (${JSON.stringify(s)})`);
        await f.evaluate(() => { document.getElementById('outputPanel').scrollTop = 600; });
        const t = await f.evaluate(() => ({ out: document.getElementById('outputPanel').scrollTop, doc: document.scrollingElement.scrollTop }));
        check(t.out > 0 && t.doc === 0, `index.html frame: the output panel scrolls (${JSON.stringify(t)})`);
        if (args.shots) await o.p.screenshot({ path: path.join(args.shots, 'lldf-in-index-1280.png') });
      }
    }
  } finally { await o.b.close(); }
}

console.log(failures ? `FAIL: ${failures} of ${checks} check(s) failed` : `PASS (${checks} checks)`, `(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
process.exit(failures ? 1 : 0);
