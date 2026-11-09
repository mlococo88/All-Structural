#!/usr/bin/env node
// Browser smoke test of the Deflection output tab (DEFL, 2026-11-09): apps/steel-bridge/index.html with the built-in project,
// headless Chromium (tests/lib.mjs openPage):
//   1. the tab is right after Analysis in the tab bar; selecting it runs it (output-tab auto-run, #df_calc) with no button press;
//   2. every LL deflection number and every dead-load deflection at the tenth points equals the engine's (SBDAnalysis.analyzeGirder
//      of the saved project, formatted as the tab formats it); the diagram has one line per component plus the total; the "every
//      station" view lists every analysis station; each § link has its worked step on the tab;
//   3. the Analysis tab keeps a one-line summary whose link opens the Deflection tab; its station table has no deflection view;
//   4. the girder selector changes the girder of the app (ui.g, as the Girders & plates tab);
//   5. old saved ui.otab values ('an', 'sec', an unknown value) still open; 'defl' is kept across a reload;
//   6. Report: built, has a "Deflection" section after "Analysis"; its link back opens the tab;
//   7. at 390 px: no page-level horizontal scroll, the tables scroll inside their cards.
//   0 console errors.   node tests/smoke/steel-bridge-deflection.mjs [--shots <dir>]
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const av = process.argv.slice(2), shots = av.includes('--shots') ? av[av.indexOf('--shots') + 1] : null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const FILE = path.join(REPO, 'apps/steel-bridge/index.html'), t0 = Date.now();
const settle = (p, t = 240000) => p.waitForFunction(() => !document.querySelector('#out .alert.stale:not([hidden])') && !/Calculating|updating/.test((document.querySelector('#autoMsg') || {}).textContent || '') && !/Calculating/.test(((document.querySelector('#out') || {}).innerText || '').slice(0, 400)), null, { timeout: t });

let { b, p, errs, blocked } = await openPage(FILE, { vw: 1400, vh: 1000 });
try {
  await p.waitForSelector('#tabBar [data-otab="defl"]');
  const order = await p.$$eval('#tabBar [data-otab]', bs => bs.map(x => x.dataset.otab));
  assert.equal(order[order.indexOf('an') + 1], 'defl', order.join(' '));
  await p.click('#tabBar [data-otab="defl"]'); await settle(p);
  await p.waitForSelector('#df-ll table', { timeout: 240000 });
  // 2. the engine's numbers
  const r = await p.evaluate(() => {
    const P = JSON.parse(localStorage.getItem('sbd2.project.current') || 'null') || window.SBDModel.defaultProject(), R = window.SBDAnalysis.analyzeGirder(P, 0), U = window.SharedUnits, f = (x, d) => U.fmt(x, d), out = { bad: [] };
    const llRows = [...document.querySelectorAll('#df-ll tbody tr')].map(tr => [...tr.cells].map(td => td.innerText.replace(/\s*§\s*$/, '').trim()));
    R.lld.forEach((q, k) => { const c = llRows[k]; const want = [String(k + 1), f(q.L, 2), f(q.x, 2), f(q.gD, 3), f(q.perLane, 3), null, f(q.d, 3), `L/${q.ratio} = ${f(q.lim, 3)}`, ...(q.limP ? [null] : []), f(q.d / q.lim, 3)];
      want.forEach((w, j) => { if (w != null && c[j] !== w) out.bad.push(`LL span ${k + 1} col ${j}: ${c[j]} vs ${w}`); }); });
    out.ll = R.lld.map(q => ({ k: q.k + 1, d: q.d, lim: q.lim, ratio: q.ratio, status: q.status }));
    const c = R.camber, comps = ['steel', 'wet', 'sd', ...(c.ut ? ['ut'] : []), 'total'], SH = window.SBDSheets, pts = SH.tenths(R.sup);
    const rows = [...document.querySelectorAll('#df-dl .tscroll')[1].querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(td => td.innerText.trim()));
    if (rows.length !== pts.length) out.bad.push(`tenth rows ${rows.length} vs ${pts.length}`);
    pts.forEach((t, i) => comps.forEach((k, j) => { const w = f(SH.at(c.x, c[k], t.x), 3), node = c.x.findIndex(v => Math.abs(v - t.x) < 1e-6);
      if (rows[i] && rows[i][2 + j] !== w) out.bad.push(`tenth ${i} ${k}: ${rows[i][2 + j]} vs ${w}`);
      if (node >= 0 && w !== f(c[k][node], 3)) out.bad.push(`tenth ${i} ${k}: not the station value`); }));
    out.mid = R.spans.map((L, k) => { const t = pts.find(q => q.k === k && q.q === 5); return { k: k + 1, x: t.x, total: SH.at(c.x, c.total, t.x) }; });
    out.lines = document.querySelectorAll('#df-dl svg polyline').length; out.comps = comps.length;
    out.links = [...document.querySelectorAll('#out a.wk')].map(a => a.getAttribute('href')).filter(h => !document.getElementById(h.slice(1)));
    out.kErr = document.querySelectorAll('#out .katex-error').length; out.n = c.x.length;
    return out;
  });
  assert.deepEqual(r.bad, []); assert.equal(r.lines, r.comps, 'one line per component + total'); assert.deepEqual(r.links, [], 'every § link has its step on the tab'); assert.equal(r.kErr, 0);
  console.log('  default project: ' + r.ll.map(q => `span ${q.k}: Δ_LL ${q.d.toFixed(3)} in vs L/${q.ratio} = ${q.lim.toFixed(3)} in (D/C ${(q.d / q.lim).toFixed(3)}, ${q.status})`).join('; '));
  console.log('  camber at midspan: ' + r.mid.map(m => `span ${m.k} (x = ${m.x.toFixed(1)} ft) ${m.total.toFixed(3)} in`).join('; '));
  if (shots) { await p.screenshot({ path: path.join(shots, 'deflection-desktop.png'), fullPage: false }); await p.$eval('#df-dl', e => e.scrollIntoView()); await p.screenshot({ path: path.join(shots, 'deflection-desktop-camber.png') }); }
  await p.selectOption('#df_view', 'all');
  assert.equal(await p.$$eval('#df-dl .tscroll', t => t[1].querySelectorAll('tbody tr').length), r.n, 'every station');
  await p.selectOption('#df_view', 't10');
  // 3. Analysis: one line, its link
  await p.click('#tabBar [data-otab="an"]'); await settle(p); await p.waitForSelector('#an-defl', { timeout: 240000 });
  const an = await p.evaluate(() => ({ t: document.querySelector('#an-defl').innerText, d: !!document.querySelector('#an_view option[value="D"]'), card: [...document.querySelectorAll('#out .secHead')].some(h => /Live load deflection/i.test(h.textContent)) }));
  assert.match(an.t, /Δ\s*LL\s*\/\s*Δ\s*lim = 0\.\d{3}/); assert.ok(!an.d && !an.card, 'deflection moved off the Analysis tab');
  await p.click('#an-defl a[data-gotab="defl"]'); await settle(p);
  assert.equal(await p.evaluate(() => document.querySelector('#tabBar [aria-selected="true"]').dataset.otab), 'defl');
  // 4. girder selector
  const ng = await p.$$eval('#df_g option', o => o.length);
  if (ng > 1) { await p.selectOption('#df_g', '1'); await settle(p); await p.waitForSelector('#df-ll table', { timeout: 240000 });
    const g = await p.evaluate(() => ({ ui: JSON.parse(localStorage.getItem('sbd2.ui')).g, inp: (document.getElementById('i__g') || {}).value, sel: document.getElementById('df_g').value }));
    assert.equal(g.ui, 1); assert.equal(g.sel, '1'); if (g.inp != null) assert.equal(g.inp, '1');
    await p.selectOption('#df_g', '0'); await settle(p); await p.waitForSelector('#df-ll table', { timeout: 240000 }); }
  // 6. Report
  await p.click('#tabBar [data-otab="rpt"]'); await p.click('#rp_build'); await p.waitForSelector('.rp-doc .rp-h1', { timeout: 240000 });
  const secs = await p.$$eval('.rp-doc .rp-h1', h => h.map(x => x.textContent.trim()));
  const ia = secs.findIndex(s => /Analysis$/.test(s)), idf = secs.findIndex(s => /Deflection$/.test(s));
  assert.ok(ia >= 0 && idf === ia + 1, secs.join(' | '));
  assert.equal(await p.$$eval('.rp-doc .katex-error', e => e.length), 0);
  // 5. ui.otab kept across a reload; old values still open
  await p.click('#tabBar [data-otab="defl"]'); await settle(p);
  await p.reload(); await p.waitForSelector('#tabBar [data-otab="defl"][aria-selected="true"]'); await settle(p); await p.waitForSelector('#df-ll table', { timeout: 240000 });
  for (const o of ['an', 'sec', 'nosuchtab']) {
    await p.evaluate(o => { const u = JSON.parse(localStorage.getItem('sbd2.ui')); u.otab = o; localStorage.setItem('sbd2.ui', JSON.stringify(u)); }, o);
    await p.reload(); await p.waitForFunction(() => document.querySelector('#out') && document.querySelector('#out').children.length > 0, null, { timeout: 60000 }); await settle(p);
    const sel = await p.evaluate(() => (document.querySelector('#tabBar [aria-selected="true"]') || {}).dataset || {});
    if (o !== 'nosuchtab') assert.equal(sel.otab, o, `saved ui.otab ${o}`);
  }
  assert.deepEqual(errs, [], 'console errors');
} finally { await b.close(); }

// 7. phone layout: 390 px
({ b, p, errs } = await openPage(FILE, { vw: 390, vh: 844 }));
try {
  await p.waitForSelector('#tabBar [data-otab="defl"]');
  await p.click('#tabBar [data-otab="defl"]'); await settle(p); await p.waitForSelector('#df-ll table', { timeout: 240000 });
  const m = await p.evaluate(() => { const se = document.scrollingElement; window.scrollTo(400, 0);
    return { sw: se.scrollWidth, cw: se.clientWidth, x: window.scrollX, cards: [...document.querySelectorAll('#out .sec')].map(s => s.getBoundingClientRect().right).filter(r => r > window.innerWidth + 1).length,
      inner: [...document.querySelectorAll('#out .tscroll')].some(t => t.scrollWidth > t.clientWidth) }; });
  assert.ok(m.sw <= m.cw && m.x === 0, `page scrolls sideways at 390 px: ${JSON.stringify(m)}`); assert.equal(m.cards, 0, 'a card wider than the screen'); assert.ok(m.inner, 'the wide tables scroll inside their cards');
  if (shots) { await p.$eval('#df-ll', e => e.scrollIntoView()); await p.screenshot({ path: path.join(shots, 'deflection-390.png'), fullPage: false }); await p.$eval('#df-dl', e => e.scrollIntoView()); await p.screenshot({ path: path.join(shots, 'deflection-390-camber.png') }); }
  assert.deepEqual(errs, [], 'console errors (390 px)');
} finally { await b.close(); }
if (blocked.size) console.log('  blocked: ' + [...blocked].join(', '));
console.log(`steel-bridge-deflection: OK (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
