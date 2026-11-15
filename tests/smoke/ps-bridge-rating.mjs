#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), E1 (2026-11-15): the Rating tab's rating at every station of the girder (engine/rating-along.js;
// ui/rating.js along(), alongAfter()). Headless Chromium, file://, the CDN libraries from tests/libs. A new project made two continuous spans
// of 110 ft (continuity on: the negative moment over the pier is rated).
//   1. the Rating tab: the governing card (four groups, the negative flexure among them), its rows = the lowest of the table of every location
//      by group, every RF the value of PSBRatingAlong for the cell shown; the chart drawn (#gfx_rtal svg);
//   2. a click on a row works it below the table (#rt_selwork, steps rt.sel.*: its RF = the row's); a § of the governing card opens its
//      worked step (rt.al.*); the check column's Rating chip = the lowest along the girder;
//   3. the Report: the Rating section's along-the-girder cards, the figure "Rating factor along the girder", the worked steps of the
//      governing locations; the keys written are psb2.* only; 0 console errors. SHOT=<dir> saves the tab and the Report section (scale 1).
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/ps-bridge/index.html'), SHOT = process.env.SHOT;
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000 });
const otab = t => p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t);
const until = async (f, ms, w) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + w); await new Promise(r => setTimeout(r, 200)); } };
try {
  await p.waitForSelector('#tabBar [data-otab]');
  await p.evaluate(() => { localStorage.clear(); const P = PSBModel.newProject(); P.project.name = 'Rating along the girder smoke'; P.spans = { lengths: [110, 110], continuity: 'composite' }; P.xs.skews = [0, 0, 0];
    localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(400);
  await otab('rt'); await until(() => p.evaluate(() => !!document.querySelector('#card-rtal')), 60000, 'the Rating tab');
  await until(() => p.evaluate(() => !!document.querySelector('#gfx_rtal svg')), 20000, 'the chart');
  // 1. the governing card and the table, against PSBRatingAlong of the cell shown (every type × line: the one whose rows match the table)
  const t = await p.evaluate(() => {
    const s0 = localStorage.getItem('psb2.project.current'), P = PSBModel.importJSON(s0).project;
    const cells = PSBBridge.hasTypes(P) ? PSBBridge.results(P, i => PSBHoldDown.compute(JSON.parse(JSON.stringify(i)))).cells : [{ R: PSBHoldDown.compute(PSBDesign.inputs(P)) }];
    const rows = [...document.querySelectorAll('#card-rtall tr[data-rti]')].map(tr => [...tr.children].map(td => td.textContent.trim()));
    const As = cells.map(c => PSBRatingAlong.of(c.R)).filter(A => A && A.rows.length === rows.length && A.rows.every((q, i) => rows[i][7] === (isFinite(q.inv) && q.inv !== null ? q.inv.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '—')));
    const gov = [...document.querySelectorAll('#card-rtal tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim()));
    const chip = document.querySelector('#sbDashCol [data-sdgrp="rt"] .sdVal');
    const all = cells.flatMap(c => PSBDashUI.RATING.rf.map(q => q[1](c.R))).filter(v => typeof v === 'number' && v < 99);
    return { n: rows.length, match: As.length, gov, A: As[0] ? Object.fromEntries(Object.entries(As[0].gov).map(([k, q]) => [k, q && q.inv.toFixed(3)])) : null, chip: chip && chip.textContent, want: Math.min(...all).toFixed(3),
      svg: !!document.querySelector('#gfx_rtal svg'), links: [...document.querySelectorAll('#card-rtal a.wk')].map(a => a.getAttribute('href')) };
  });
  assert.ok(t.n > 150, 'rows ' + t.n); assert.ok(t.match >= 1, 'the table is PSBRatingAlong of a cell');
  assert.equal(t.gov.length, 4, JSON.stringify(t.gov)); assert.match(t.gov[1][0], /Flexure, negative moment over the pier/);
  assert.equal(t.gov[0][4], t.A.flexP); assert.equal(t.gov[1][4], t.A.flexN); assert.equal(t.gov[2][4], t.A.shear); assert.equal(t.gov[3][4], t.A.s3);
  assert.equal(t.chip, t.want, 'the Rating chip: the lowest along the girder');
  ok(`Rating tab: ${t.n} locations, governing ${t.gov.map(r => r[0].split(' (')[0] + ' ' + r[4]).join(', ')}; chart drawn; chip ${t.chip}`);
  // 2. a row worked below the table; a governing § opens its step
  const r = await p.evaluate(() => { const tr = [...document.querySelectorAll('#card-rtall tr[data-rti]')].find(x => /negative/.test(x.children[1].textContent)) || document.querySelector('#card-rtall tr[data-rti]');
    tr.click(); const li = document.querySelector('#rt_selwork li[id="st-rt.sel.RFinv"], #rt_selwork li[id="st-rt.sel.RF"]');
    return { sel: tr.classList.contains('sel'), rf: tr.children[7].textContent.trim(), step: li ? li.textContent : null, name: tr.children[0].textContent.trim() }; });
  assert.ok(r.sel && r.step && r.step.includes(r.rf), JSON.stringify(r));
  ok(`a click on ${r.name} (negative flexure) works it below the table: RF ${r.rf}`);
  for (const h of t.links.slice(0, 4)) {
    await p.evaluate(h => document.querySelector(`#card-rtal a.wk[href="${h}"]`).click(), h); await p.waitForTimeout(250);
    assert.ok(await p.evaluate(h => { const el = document.getElementById(h.slice(1)); return !!el && el.offsetParent !== null; }, h), 'step shown ' + h);
  }
  ok(`the governing card's § links open their steps (${t.links.slice(0, 4).join(', ')})`);
  if (SHOT) { const el = await p.$('#card-rtal'); await p.evaluate(() => document.querySelector('#card-rtal').scrollIntoView()); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(SHOT, 'e1-rating-tab.png'), fullPage: true }); void el; }
  // 3. the Report
  await otab('rpt'); await until(() => p.evaluate(() => /Load rating along the girder: governing/.test((document.querySelector('.rp-doc') || {}).textContent || '')), 90000, 'the Report');
  const rp = await p.evaluate(() => { const d = document.querySelector('.rp-doc'), tx = d.textContent;
    return { fig: /Rating factor along the girder/.test(tx), steps: /Along the girder: negative flexure over the pier, governing location/.test(tx), s1: /Lowest RF along the girder/.test(tx), pend: /pending/i.test(tx), nan: /NaN|undefined/.test(tx) }; });
  assert.ok(rp.fig && rp.steps && rp.s1 && !rp.pend && !rp.nan, JSON.stringify(rp));
  ok('Report: §1 "Lowest RF along the girder", the Rating section\'s cards, figure and worked steps of the governing locations');
  if (SHOT) { await p.evaluate(() => { const h = [...document.querySelectorAll('.rp-doc h3, .rp-doc h4')].find(x => /Load rating along the girder: governing/.test(x.textContent)); if (h) h.scrollIntoView(); }); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(SHOT, 'e1-rating-report.png') }); }
  const keys = await p.evaluate(() => Object.keys(localStorage)); assert.ok(keys.every(k => /^psb2\./.test(k)), keys.join(','));
  assert.deepEqual(errs, []);
  ok('keys psb2.* only; 0 console errors');
  console.log(`\n${n} checks passed`);
} catch (e) { console.error(e); process.exitCode = 1; } finally { await b.close(); }
