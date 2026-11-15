#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), ADB (2026-11-15): the Report's Auto design basis (§2, its last subsection; report/builders.js
// adSub, ui/autodesign.js basis()). Headless Chromium, file://, the CDN libraries from tests/libs. New project (two girder types).
//   1. before a run: the Report's §2 ends with "Auto design basis" saying no auto design was run (one note);
//   2. Run: the output tab's link "… Report, §2 … Auto design basis" opens the Report at that subsection; it says the run is shown, not
//      applied, and lists the objective, the rules and the selected candidate;
//   3. Apply: the subsection says it was applied; each candidate check's "see §" link jumps to its worked step; an input change marks it
//      changed since;
//   4. display only: the run and the Report change nothing in the project text but Apply; the keys written are psb2.* and the same set as
//      before; 0 console errors. SHOT=<png> saves the subsection (device scale 1).
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/ps-bridge/index.html'), SHOT = process.env.SHOT;
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000 });
const proj = () => p.evaluate(() => localStorage.getItem('psb2.project.current'));
const itab = t => p.evaluate(t => document.querySelector(`#inTabs [data-itab="${t}"]`).click(), t);
const otab = t => p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t);
const until = async (f, ms, w) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + w); await new Promise(r => setTimeout(r, 200)); } };
const adb = () => p.evaluate(() => { const h = [...document.querySelectorAll('.rp-doc h3.rp-h2')].find(x => /Auto design basis/.test(x.textContent)); if (!h) return null;
  const s = h.closest('.rp-sub'), r = h.getBoundingClientRect(); return { n: h.textContent.trim().split(' ')[0], text: s.innerText, inView: r.top >= -2 && r.top < window.innerHeight, id: h.id }; });
try {
  await p.waitForSelector('#tabBar [data-otab]');
  await p.evaluate(() => { localStorage.clear(); const P = PSBModel.newProject(); P.project.name = 'Auto design basis smoke'; localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(400);
  const keys0 = (await p.evaluate(() => Object.keys(localStorage))).sort();
  // 1. no run
  await otab('rpt'); await until(() => adb(), 60000, 'the Report');
  let a = await adb();
  assert.ok(/^2\.\d+$/.test(a.n), a.n); assert.ok(/No auto design was run in this page view: nothing in this report comes from an auto design/.test(a.text), a.text);
  assert.ok(a.text.split('\n').filter(Boolean).length <= 3, 'short: ' + a.text);
  ok(`before a run: §${a.n} Auto design basis: no auto design was run (one note)`);
  // 2. Run, then the output tab's link
  const P0 = await proj();
  await itab('ad'); await p.click('#ad_run');
  await until(() => p.evaluate(() => !!document.querySelector('#ad-span-1')), 120000, 'the results');
  await p.click('#adHost a[href="#rp:rs.adb"]'); await p.waitForTimeout(600);
  assert.equal(await p.evaluate(() => document.querySelector('#tabBar [aria-selected=true]').dataset.otab), 'rpt');
  a = await adb(); assert.ok(a.inView, 'the subsection in view');
  assert.ok(/Shown on the Auto design output tab, not applied/.test(a.text), 'shown');
  ['Objective and variables', 'Order of preference', 'Sections searched', 'Strand pattern rules', 'Drape rules', 'f′c and f′ci grids and limits', 'Selected candidate and its governing check', 'AASHTO LRFD 10th Ed. Art. 5.4.2.1', 'Governing check']
    .forEach(t => assert.ok(a.text.includes(t), t));
  assert.ok(!/pending/i.test(a.text));
  assert.equal(await proj(), P0, 'the run and the Report change nothing');
  ok(`Run: the output tab's link opens the Report at §${a.n} (in view): shown, not applied; objective, sections, strand / drape / f′c rules, the selected candidate`);
  // 3. Apply
  await otab('ad'); await p.waitForSelector('#ad_apply'); await p.click('#ad_apply'); await p.waitForTimeout(600);
  await p.click('#adHost a[href="#rp:rs.adb"]'); await p.waitForTimeout(800);
  a = await adb(); assert.ok(a.inView && /Applied in this page view/.test(a.text) && !/has changed since/.test(a.text), 'applied: ' + a.text.slice(0, 300));
  const L = await p.evaluate(id => { const s = document.getElementById(id).closest('.rp-sub'); return [...s.querySelectorAll('table')].filter(t => /^Check/.test(t.rows[0].cells[0].textContent))
    .map(t => [...t.querySelectorAll('tbody tr')].map(r => r.cells[4].innerText.trim())); }, a.id);
  const all = L.flat(); assert.ok(all.length > 10 && all.filter(t => /^see §\d+\.\d+/.test(t)).length >= all.length * 0.8, JSON.stringify(all.slice(0, 6)));
  const before = await p.evaluate(() => document.getElementById('outputPanel').scrollTop);
  await p.evaluate(id => { const s = document.getElementById(id).closest('.rp-sub'); [...s.querySelectorAll('table')].find(t => /^Check/.test(t.rows[0].cells[0].textContent)).querySelector('tbody tr a').click(); }, a.id);
  await p.waitForTimeout(600);
  assert.notEqual(await p.evaluate(() => document.getElementById('outputPanel').scrollTop), before, 'the link moved to its step');
  ok(`Apply: §${a.n} says applied; ${all.length} candidate checks, ${all.filter(t => /^see §/.test(t)).length} with a "see §" link; a link jumps to its step`);
  if (SHOT) { await p.click('#adHost a[href="#rp:rs.adb"]').catch(() => {}); await otab('ad'); await p.click('#adHost a[href="#rp:rs.adb"]'); await p.waitForTimeout(800);
    fs.mkdirSync(path.dirname(SHOT), { recursive: true }); const el = await p.$(`#${a.id}`); const s = await el.evaluateHandle(h => h.closest('.rp-sub'));
    await s.asElement().screenshot({ path: SHOT }); console.log('       (screenshot ' + SHOT + ')'); }
  // an input change: changed since
  await itab('proj'); await p.fill('#i_project\\.checker', 'XY'); await p.dispatchEvent('#i_project\\.checker', 'change'); await p.waitForTimeout(300);
  await otab('rpt'); await until(() => adb(), 60000, 'the Report again'); a = await adb();
  assert.ok(/The project has changed since the run was applied/.test(a.text));
  ok('an input change after Apply: "The project has changed since the run was applied"');
  // 4. keys, errors
  const keys = (await p.evaluate(() => Object.keys(localStorage))).sort();
  keys.forEach(k => assert.ok(k.startsWith('psb2.') && (keys0.includes(k) || k === 'psb2.ui'), 'a key the page had, or its UI key: ' + k));
  assert.deepEqual(errs, []);
  ok(`keys psb2.* only (${keys.join(', ')}); 0 console errors`);
  console.log(`ps-bridge-adbasis: ${n} checks ok (0 console errors)`);
} finally { await b.close(); }
