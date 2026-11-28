#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), item A: Auto design (engine/autodesign.js, ui/autodesign.js). Headless Chromium, file://, the CDN
// libraries from tests/libs.
//   1. the Auto design input tab: the settings (objective, the four variables Auto / Lock, the f′c / f′ci limits with the owner's values
//      grey) and Run; a setting change is saved in the project (P.autodesign) and is an undo step;
//   2. Run on a new project (two girder types; the current design fails the PS-10 hold-down check): progress, then the output tab lists
//      span 1's sections (the failing ones with their reason, the candidates #1 … with each type's strands, f′c / f′ci and governing check),
//      the current design's failing check, the selected candidate's checks with links; a check link opens its tab;
//   3. Apply: one undo step; each type's own inputs are the candidate's; the Summary then shows PASS for every check; the notice's Undo puts
//      back the project text exactly; Redo; Ctrl+Z / Ctrl+Y;
//   4. the run on a copy: a change during / after the run marks the result out of date and disables Apply;
//   5. 390 px: no sideways scroll; every key written is psb2.*; 0 console errors.
//   SHOTS=<dir> node tests/smoke/ps-bridge-autodesign.mjs   (screenshots auto-*.png when SHOTS is set)
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/ps-bridge/index.html');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000 });
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
const proj = () => p.evaluate(() => localStorage.getItem('psb2.project.current'));
const itab = t => p.evaluate(t => document.querySelector(`#inTabs [data-itab="${t}"]`).click(), t);
const otab = t => p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t);
const until = async (f, ms, w) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + w); await new Promise(r => setTimeout(r, 200)); } };
try {
  await p.waitForSelector('#tabBar [data-otab]');
  await p.evaluate(() => { localStorage.clear(); const P = PSBModel.newProject(); P.project.name = 'Auto design smoke'; localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(400);
  // 1. the input tab
  await itab('ad');
  let r = await p.evaluate(() => ({ vars: [...document.querySelectorAll('[data-ad^="vars."]')].map(s => s.dataset.ad + '=' + s.value), obj: document.getElementById('ad_objective').value,
    ph: document.getElementById('ad_fcHi').placeholder, run: !!document.getElementById('ad_run') }));
  assert.deepEqual(r.vars, ['vars.section=auto', 'vars.strands=auto', 'vars.drape=auto', 'vars.conc=auto']); assert.equal(r.obj, 'weight'); assert.equal(r.ph, '10.0'); assert.ok(r.run);
  await p.selectOption('#ad_objective', 'depth'); await p.waitForTimeout(150);
  assert.equal(JSON.parse(await proj()).autodesign.objective, 'depth');
  assert.equal(await p.$eval('#bUndo', e => e.disabled), false); await p.click('#bUndo'); await p.waitForTimeout(200);
  assert.equal((JSON.parse(await proj()).autodesign || {}).objective, undefined, 'Undo of the setting');
  ok('input tab: objective, the four variables (Auto), the owner f′c limit 10.0 grey, Run; a setting is saved in P.autodesign and is an undo step');
  await shot('auto-input');

  // 2. Run
  const P0 = await proj();
  await itab('ad'); await p.click('#ad_run');
  await until(() => p.evaluate(() => !!document.querySelector('#adHost .ad-bar') || !!document.querySelector('#ad-span-1')), 10000, 'progress');
  await until(() => p.evaluate(() => !!document.querySelector('#ad-span-1')), 120000, 'the results');
  assert.equal(await proj(), P0, 'the run changes nothing in the project');
  r = await p.evaluate(() => { const T = document.querySelector('#ad-span-1 table'); return { rows: [...T.querySelectorAll('tbody tr')].map(t => t.innerText.replace(/\s+/g, ' ')), sel: !!T.querySelector('input[type=radio]:checked'),
    cur: document.querySelector('#ad-span-1 .note').innerText, links: document.querySelectorAll('#ad-span-1 details a[data-gotab]').length, apply: !!document.getElementById('ad_apply'), dis: document.getElementById('ad_apply').disabled,
    log: !!document.querySelector('details.ad-log summary') }; });
  assert.ok(r.rows.some(t => /none: .*live-load deflection/.test(t)), 'a failing section with its reason');
  assert.ok(r.rows.some(t => /^#1 PCI BT-/.test(t.trim())), 'candidate #1: ' + r.rows.join(' / '));
  assert.ok(/Hold-down force \(PS-10\)/.test(r.cur), 'the current design\'s failing check'); assert.ok(r.sel && r.links > 10 && r.apply && !r.dis && r.log);
  ok(`Run: ${r.rows.length} sections listed (${r.rows.filter(t => /^#\d/.test(t.trim())).length} candidates); the current design fails Hold-down force (PS-10); the selected candidate's checks linked`);
  await shot('auto-results');
  // the depth objective was undone: lightest first; candidate #2 selected redraws the detail
  const det1 = await p.evaluate(() => document.querySelector('#ad-span-1 details').innerText.slice(0, 80));
  await p.click('#ad-span-1 input[data-adsel="1|1"]'); await p.waitForTimeout(200);
  assert.notEqual(await p.evaluate(() => document.querySelector('#ad-span-1 details').innerText.slice(0, 80)), det1, 'candidate #2 shown');
  await p.click('#ad-span-1 input[data-adsel="1|0"]'); await p.waitForTimeout(200);
  // a check link opens its tab, and back
  const lk = await p.evaluate(() => document.querySelector('#ad-span-1 details a[data-gotab]').dataset.gotab);
  await p.click('#ad-span-1 details a[data-gotab]'); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => document.querySelector('#tabBar [aria-selected=true]').dataset.otab), lk);
  await otab('ad'); await p.waitForSelector('#ad-span-1');
  ok(`candidate choice redraws its detail; a check link opens the ${lk} tab; the result is kept on return`);

  // 3. Apply
  const c1 = await p.evaluate(() => { const st = PSBAutoDesignUI.state(); const c = st.R.spans[0].cands[0]; return c.types.map(q => ({ k: q.k, girder: q.res.best.girder, N: q.res.best.N, fc: q.res.best.fc, fci: q.res.best.fci, rows: q.res.best.rows })); });
  await p.click('#ad_apply'); await p.waitForTimeout(500);
  const P1 = JSON.parse(await proj());
  c1.forEach(q => { const e = JSON.parse(JSON.stringify(P1.base)); Object.entries(P1.types[q.k].ovr).forEach(([k, v]) => { const ks = k.split('.'), last = ks.pop(); ks.reduce((a, x) => a[x] = a[x] || {}, e)[last] = v; });
    assert.equal(e.girder, q.girder); assert.equal(e.mat.fc, q.fc); assert.equal(e.mat.fci, q.fci); assert.deepEqual(e.rows, q.rows); });
  assert.ok(await p.evaluate(() => /Auto design applied/.test(document.getElementById('notices').innerText)), 'the notice');
  await otab('sum'); await until(() => p.evaluate(() => /PASS/.test((document.querySelector('.sum-badge') || {}).textContent || '')), 60000, 'Summary PASS');
  const vb = await p.evaluate(() => ({ badge: document.querySelector('.sum-badge').textContent, cnt: document.querySelector('.sum-cnt').innerText }));
  assert.equal(vb.badge.trim(), 'PASS'); assert.ok(/0 FAIL/.test(vb.cnt), vb.cnt);
  ok(`Apply: each type's inputs = its candidate (${c1.map(q => `${q.girder} N ${q.N}, f′c ${q.fc} / f′ci ${q.fci}`).join('; ')}); the Summary: ${vb.badge.trim()} (${vb.cnt.replace(/\s+/g, ' ')})`);
  await shot('auto-applied-summary');
  await p.click('#notices .nUndo'); await p.waitForTimeout(400);
  assert.equal(await proj(), P0, 'the notice\'s Undo: the project text before Apply exactly');
  await p.click('#bRedo'); await p.waitForTimeout(400); assert.deepEqual(JSON.parse(await proj()), P1, 'Redo');
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('Control+z'); await p.waitForTimeout(300); assert.equal(await proj(), P0, 'Ctrl+Z');
  await p.keyboard.press('Control+y'); await p.waitForTimeout(300); assert.deepEqual(JSON.parse(await proj()), P1, 'Ctrl+Y');
  ok('Apply is one undo step: the notice\'s Undo and Ctrl+Z give the project text before Apply exactly; Redo / Ctrl+Y the applied one');

  // 4. out of date
  await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
  await itab('ad'); await p.click('#ad_run'); await until(() => p.evaluate(() => !!document.querySelector('#ad-span-1')), 120000, 'the results again');
  await itab('proj'); await p.fill('#i_project\\.checker', 'XY'); await p.dispatchEvent('#i_project\\.checker', 'change'); await p.waitForTimeout(200);
  await otab('ad'); await p.waitForSelector('#ad-span-1');
  r = await p.evaluate(() => ({ stale: /The project changed since this run/.test(document.getElementById('adHost').innerText), dis: document.getElementById('ad_apply').disabled }));
  assert.ok(r.stale && r.dis);
  ok('a change after the run: "The project changed since this run", Apply disabled');

  // 4b. PSAD-A (2026-11-28): Refine and the target ratio on the input tab, saved in P.autodesign; the output names the mode and the target
  await itab('ad'); await p.selectOption('#ad_mode', 'refine'); await p.waitForTimeout(150);
  await p.fill('#ad_maxRatio', '0.95'); await p.dispatchEvent('#ad_maxRatio', 'change'); await p.waitForTimeout(150);
  r = await p.evaluate(() => JSON.parse(localStorage.getItem('psb2.project.current')).autodesign); assert.equal(r.mode, 'refine'); assert.equal(r.maxRatio, 0.95);
  await itab('ad'); await p.click('#ad_run'); await until(() => p.evaluate(() => !!document.querySelector('#ad-span-1') && !PSBAutoDesignUI.state().running), 180000, 'the Refine results');
  r = await p.evaluate(() => ({ txt: document.getElementById('adHost').innerText, head: document.querySelector('#ad-span-1 thead').innerText, rows: [...document.querySelectorAll('#ad-span-1 tbody tr')].map(t => t.innerText.replace(/\s+/g, ' ')) }));
  assert.ok(/Mode: Refine/.test(r.txt) && /target ratio 0\.95/.test(r.txt), 'the mode and the target named');
  assert.ok(/target 0\.95/.test(r.head) && /change from the entered design/.test(r.head), r.head);
  assert.ok(r.rows.length && r.rows.every(t => /PCI BT-72/.test(t)), 'Refine keeps the section: ' + r.rows.join(' / '));
  assert.ok(r.rows.some(t => /target 0\.95: /.test(t)), 'the governing check against the target in the column');
  ok(`Refine and target 0.95 set on the input tab (saved in P.autodesign); ${r.rows.length} designs on the current section, the target in the governing column`);
  await shot('auto-refine');

  // 5. phone width, keys, errors
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll');
  await shot('auto-390');
  const keys = await p.evaluate(() => Object.keys(localStorage)); keys.forEach(k => assert.ok(k.startsWith('psb2.'), k));
  assert.deepEqual(errs, []);
  ok('390 px: no sideways scroll; keys psb2.* only (' + keys.sort().join(', ') + '); 0 console errors');
  console.log(`ps-bridge-autodesign: ${n} checks ok (0 console errors)`);
} finally { await b.close(); }
