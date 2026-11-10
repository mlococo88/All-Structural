#!/usr/bin/env node
// Abutment calculator: independently scrolling input / output panels and equation lines without stray scroll bars (ABSC, 2026-11-10).
//   node tests/smoke/abutment-panel-scroll.mjs [file]   (default: abutment_calculator.html in this tree)
// 1. 1440 px: the page does not scroll (body overflow hidden, document = window height); the input column, the output column and the
//    summary column each scroll on their own; scrolling one leaves the others and the page alone; the input tab strip stays stuck at the
//    top of the input column; switching input tab from far down shows the new pane from its top.
// 2. Navigation scrolls the output column, never the page: a summary-chip click (Eccentricity -> panel o-ecc), a "Tab 2 §2.3" xlink,
//    a Report link (abrGoto with and without a card). The target ends inside the output column's view.
// 3. Summary column collapse («) and re-open still work.
// 4. Stray scroll bars: on every output tab, the Report (all sections open) and every input pane, default and piled project, at 1440
//    and 1920 px, no element with overflow auto/scroll has scrollHeight > clientHeight + 1 or scrollWidth > clientWidth + 1, apart
//    from the scroll columns themselves and the Assumptions textarea (true overflow: its text is longer than the box).
//    No equation line has its glyphs cut by overflow-y hidden.
// 5. 390 px (stacked layout): the page scrolls as before, the columns are not scroll boxes, no horizontal page scroll.
// 6. No console errors.
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.resolve(REPO, process.argv[2] || 'abutment_calculator.html');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const ready = p => p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });

const census = () => {
  const out = [];
  for (const e of document.querySelectorAll('body *')) {
    if (!e.getClientRects().length) continue;
    const cs = getComputedStyle(e);
    const ox = /auto|scroll/.test(cs.overflowX), oy = /auto|scroll/.test(cs.overflowY);
    if (!ox && !oy) continue;
    if (e.matches('.col-in,.col-out,#abDashCol,textarea#assumptions')) continue;
    const y = oy && e.scrollHeight > e.clientHeight + 1, x = ox && e.scrollWidth > e.clientWidth + 1;
    if (x || y) out.push((e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]) + (x ? ' x' : '') + (y ? ' y' : '') + ' "' + (e.textContent || '').slice(0, 40) + '"');
  }
  for (const n of document.querySelectorAll('.eq-line')) {
    if (!n.clientWidth) continue;
    const b = n.getBoundingClientRect(); let t = 1e9, bt = -1e9;
    n.querySelectorAll('.katex-html *').forEach(c => { const r = c.getBoundingClientRect(); if (!r.height || !r.width) return; t = Math.min(t, r.top); bt = Math.max(bt, r.bottom); });
    if (t < b.top - 0.5 || bt > b.bottom + 0.5) out.push('clipped equation "' + n.textContent.slice(0, 40) + '"');
  }
  return out;
};
// the target is in the output column and shown in its visible box (gotoPanel centres the card: a card taller than the column starts above it)
const inOut = sel => { const P = document.querySelector('.col-out'), e = document.querySelector(sel); if (!P || !e) return 'missing ' + sel;
  const p = P.getBoundingClientRect(), r = e.getBoundingClientRect(), mid = (r.top + r.bottom) / 2;
  const ok = P.contains(e) && (r.height <= p.height ? r.top >= p.top - 2 && r.bottom <= p.bottom + 2 : r.top <= p.top && r.bottom >= p.bottom) && Math.abs(mid - (p.top + p.bottom) / 2) < 40;
  return ok ? true : `card ${r.top.toFixed(0)}..${r.bottom.toFixed(0)}, column ${p.top.toFixed(0)}..${p.bottom.toFixed(0)}`; };

// ---- 1-3: 1440 px layout and navigation
{
  const o = await openPage(FILE, { vw: 1440, vh: 900 }); const p = o.p; await ready(p);
  await p.evaluate(() => activateTab('tab-stab')); await p.waitForTimeout(400);
  const L = await p.evaluate(() => { const ci = document.querySelector('.col-in'), co = document.querySelector('.col-out'), d = document.getElementById('abDashCol');
    return { body: getComputedStyle(document.body).overflowY, docH: document.documentElement.scrollHeight, winH: innerHeight,
      ci: [getComputedStyle(ci).overflowY, ci.scrollHeight > ci.clientHeight], co: [getComputedStyle(co).overflowY, co.scrollHeight > co.clientHeight],
      d: [getComputedStyle(d).overflowY, d.scrollHeight > d.clientHeight], coBottom: co.getBoundingClientRect().bottom }; });
  check(L.body === 'hidden' && L.docH <= L.winH, `page does not scroll (body ${L.body}, document ${L.docH} / window ${L.winH})`);
  check(L.ci[0] === 'auto' && L.ci[1] && L.co[0] === 'auto' && L.co[1], `input and output columns are scroll boxes with content to scroll (${JSON.stringify([L.ci, L.co])})`);
  check(L.d[0] === 'auto' && L.d[1], 'summary column scrolls on its own');
  check(Math.abs(L.coBottom - L.winH) <= 2, `output column fills the window height (bottom ${L.coBottom})`);
  const S1 = await p.evaluate(async () => { const ci = document.querySelector('.col-in'), co = document.querySelector('.col-out'), d = document.getElementById('abDashCol');
    co.scrollTop = 1500; await new Promise(r => setTimeout(r, 100)); const a = [co.scrollTop, ci.scrollTop, d.scrollTop, scrollY];
    ci.scrollTop = 900; await new Promise(r => setTimeout(r, 100)); const b = [co.scrollTop, ci.scrollTop, d.scrollTop, scrollY];
    const bar = document.getElementById('abutInTabs'), stuck = Math.abs(bar.getBoundingClientRect().top - ci.getBoundingClientRect().top) <= 1;
    return { a, b, stuck }; });
  check(S1.a[0] === 1500 && S1.a[1] === 0 && S1.a[2] === 0 && S1.a[3] === 0, `output column scrolls alone (${S1.a})`);
  check(S1.b[0] === 1500 && S1.b[1] === 900 && S1.b[3] === 0, `input column scrolls alone (${S1.b})`);
  check(S1.stuck, 'input tab strip stays stuck at the top of the input column');
  await p.click('#abutInTab_found'); await p.waitForTimeout(200);
  check(await p.evaluate(() => document.querySelector('.col-in').scrollTop === 0 && scrollY === 0), 'input tab switch from far down shows the new pane from its top (page not scrolled)');

  // summary chip -> o-ecc (Stability tab), from another tab and the output column scrolled away
  await p.evaluate(() => { activateTab('tab-loads'); document.querySelector('.col-out').scrollTop = 0; });
  const ci0 = await p.evaluate(() => document.querySelector('.col-in').scrollTop);
  await p.evaluate(() => [...document.querySelectorAll('#abDash .abCh')].find(c => /^Eccentricity/.test(c.querySelector('.abChN').textContent)).click());
  await p.waitForTimeout(1200);
  const c1 = await p.evaluate(inOut, '#tab-stab .panel[data-cid="o-ecc"]');
  check(c1 === true && await p.evaluate(() => scrollY === 0 && document.querySelector('#tab-stab').classList.contains('active')), `summary chip scrolls the output column to the card (${c1})`);
  check(await p.evaluate(ci => document.querySelector('.col-in').scrollTop === ci, ci0), 'summary chip leaves the input column alone');
  // "Tab 2 §2.3" xlink in the Stability tab
  const xj = await p.evaluate(() => { const x = [...document.querySelectorAll('#tab-stab .xlink[data-jump]')].find(x => x.dataset.jump.startsWith('tab-comb|')); if (!x) return null; x.click(); return x.dataset.jump; });
  await p.waitForTimeout(1200);
  const c2 = xj ? await p.evaluate(inOut, `#tab-comb .panel[data-cid="${xj.split('|')[1]}"]`) : 'no Tab 2 link found';
  check(c2 === true && await p.evaluate(() => scrollY === 0), `"Tab 2 §2.x" link scrolls the output column to ${xj} (${c2})`);
  // Report links (abrGoto): a card, and a tab without a card (tab bar at the top of the output column)
  await p.evaluate(() => activateTab('tab-rpt')); await p.waitForTimeout(1500);
  const rl = await p.evaluate(() => { const a = document.querySelector('#tab-rpt .rp-go'); if (!a) return null; return a.outerHTML.slice(0, 120); });
  await p.evaluate(() => abrGoto('tab-stab~o-ecc')); await p.waitForTimeout(1200);
  const c3 = await p.evaluate(inOut, '#tab-stab .panel[data-cid="o-ecc"]');
  check(c3 === true && await p.evaluate(() => scrollY === 0), `Report link to a card scrolls the output column (${c3}; report has links: ${!!rl})`);
  await p.evaluate(() => { document.querySelector('.col-out').scrollTop = 2000; abrGoto('tab-found'); }); await p.waitForTimeout(400);
  const c4 = await p.evaluate(() => { const P = document.querySelector('.col-out'), b = document.getElementById('tabbar');   /* or scrolled to the end of a short tab */
    return (Math.abs(b.getBoundingClientRect().top - P.getBoundingClientRect().top) <= 2 || (P.scrollTop >= P.scrollHeight - P.clientHeight - 1 && b.getBoundingClientRect().top > P.getBoundingClientRect().top)) && P.scrollTop < 2000 && scrollY === 0; });
  check(c4, 'Report link to a tab scrolls the output column to the tab bar');
  // collapse / re-open the summary column
  await p.click('#abDashTgl'); await p.waitForTimeout(300);
  const w1 = await p.evaluate(() => [document.body.classList.contains('abDashColl'), document.getElementById('abDashCol').getBoundingClientRect().width]);
  await p.click('#abDashTgl'); await p.waitForTimeout(300);
  const w2 = await p.evaluate(() => [document.body.classList.contains('abDashColl'), document.getElementById('abDashCol').getBoundingClientRect().width]);
  check(w1[0] && w1[1] <= 44 && !w2[0] && w2[1] > 200, `summary column collapses and re-opens (${w1} / ${w2})`);
  check(!o.errs.length, 'no console errors at 1440 px ' + JSON.stringify(o.errs));
  await o.b.close();
}

// ---- 4: stray scroll bars
for (const vw of [1440, 1920]) for (const piled of [false, true]) {
  const o = await openPage(FILE, { vw, vh: 1000 }); const p = o.p; await ready(p);
  if (piled) await p.evaluate(() => { S.fnd.branch = 'pile'; recalcAll(); });
  const tabs = await p.evaluate(() => TABS.map(t => t[0])), ins = await p.evaluate(() => ABUT_IN_TABS.map(t => t[0]));
  const bad = [];
  for (const t of tabs) {
    await p.evaluate(t => activateTab(t), t); await p.waitForTimeout(t === 'tab-rpt' ? 1500 : 350);
    if (t === 'tab-rpt') {
      await p.evaluate(() => document.querySelectorAll('#tab-rpt details').forEach(d => d.open = true)); await p.waitForTimeout(600);
      await p.evaluate(async () => { const P = document.querySelector('.col-out'); for (let i = 0; i < 80; i++) { P.scrollTop += 600; await new Promise(r => setTimeout(r, 25)); } });
    }
    (await p.evaluate(census)).forEach(x => bad.push(t + ': ' + x));
  }
  for (const k of ins) { await p.evaluate(k => abutSetInTab(k, false), k); await p.waitForTimeout(120); (await p.evaluate(census)).forEach(x => bad.push('input ' + k + ': ' + x)); }
  check(!bad.length, `${vw} px ${piled ? 'piled' : 'default'} project: ${bad.length} stray scroll bars / clipped equations` + (bad.length ? '\n     ' + bad.slice(0, 12).join('\n     ') : ''));
  check(!o.errs.length, `no console errors (${vw} px ${piled ? 'piled' : 'default'}) ` + JSON.stringify(o.errs));
  await o.b.close();
}

// ---- 5: 390 px, stacked: one page scroll as before
{
  const o = await openPage(FILE, { vw: 390, vh: 844 }); const p = o.p; await ready(p);
  const r = await p.evaluate(() => ({ body: getComputedStyle(document.body).overflowY, docH: document.documentElement.scrollHeight, winH: innerHeight,
    co: getComputedStyle(document.querySelector('.col-out')).overflowY, ci: getComputedStyle(document.querySelector('.col-in')).overflowY,
    hx: document.documentElement.scrollWidth - innerWidth }));
  check(r.body !== 'hidden' && r.docH > r.winH * 3 && r.co === 'visible' && r.ci === 'visible', `390 px: the page scrolls, the columns are not scroll boxes (${JSON.stringify(r)})`);
  check(r.hx <= 0, `390 px: no horizontal page scroll (${r.hx})`);
  await p.evaluate(() => [...document.querySelectorAll('.dash-item')].find(n => n.dataset.anchor === 'o-ecc')?.click()); await p.waitForTimeout(1200);
  const y = await p.evaluate(() => { const e = document.querySelector('#tab-stab .panel[data-cid="o-ecc"]'), t = e.getBoundingClientRect().top; return [scrollY, t > -5 && t < innerHeight]; });
  check(y[0] > 0 && y[1], `390 px: a dashboard chip scrolls the page to the card (${y})`);
  check(!o.errs.length, 'no console errors at 390 px ' + JSON.stringify(o.errs));
  await o.b.close();
}
console.log(fails ? `${fails} FAILED` : 'all passed');
assert.equal(fails, 0);
