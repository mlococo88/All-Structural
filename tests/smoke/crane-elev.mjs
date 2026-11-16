#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), C3-1: heights (engine/elev.js) in the app. Headless Chromium, file://, base map None. Only the
// SYNTHETIC fake crane (tests/smoke/crane-fake-wheeled.json) is used.
//   1. the crane card's "Elevation geometry": the file's values (boom-foot pin 8 ft high, 2 ft ahead; counterweight 4 / 10 ft) as
//      placeholders, the assumptions listed (head allowance, boom width); head allowance entered 3 ft (one undo step); the editor's section;
//   2. the hand check of tests/engine/crane-elev.test.mjs typed in (pad 100, pick ground 98 / load bottom 4, set load bottom 20, H 6,
//      rigging 12, block 5): live card heights 61.0° / 72.0° (chart), tip 160.48 / 165.06, hook 120.00 / 138.00, load bottom 102.00 /
//      120.00 (travel 120.00), hook reach 32.48 / 19.06 / swing 14.48 ft; the worked steps;
//   3. dragging the pick point: the heights follow mid-drag (= the engine's), one undo step;
//   4. a set the hook cannot reach (load bottom 60 ft) → a red flag; Undo;
//   5. Picks tab columns and the Report (§Cranes elevation geometry, the pick's heights and steps; no unresolved keys, no NaN);
//   6. reload keeps the inputs; 390 px: no sideways scroll; 0 console errors.
//   SHOTS=<dir> node tests/smoke/crane-elev.mjs
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/crane-pick/index.html');
const FW = path.join(REPO, 'tests/smoke/crane-fake-wheeled.json');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 860, ls: { 'crane.ui': '{"base":"none","itab":"cranes"}' } });
const proj = () => p.evaluate(() => JSON.parse(localStorage.getItem('crane.project.current')));
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
const setF = async (sel, v) => { await p.fill(sel, String(v)); await p.dispatchEvent(sel, 'change'); await p.waitForTimeout(80); };
const txt = sel => p.$eval(sel, e => (e.innerText || e.textContent).replace(/\s+/g, ' '));
const settle = () => p.waitForTimeout(450);
const scr = q => p.evaluate(q => { const m = CranePickMap.map, cp = m.latLngToContainerPoint(CranePickMap.toLL(q)), r = m.getContainer().getBoundingClientRect(); return { x: r.x + cp.x, y: r.y + cp.y }; }, q);
const engine = () => p.evaluate(() => { const ev = CranePickPlace.evalPick(CranePickApp.P.picks[0]), h = ev.elev; return { R: ev.pick.R, th: h.pick.ang.theta, tip: h.pick.zTip, m: h.pick.margin, sw: h.swing.min, flags: ev.flags.map(f => f.level + ':' + f.text) }; });
const f2 = v => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(300);
  // 1. crane card
  await p.setInputFiles('#crFiles', [FW]); await p.waitForFunction(() => /1 crane loaded/.test(document.querySelector('#crStatus').textContent));
  await p.click('[data-ca=add]'); await p.waitForTimeout(200);
  const cid = await p.evaluate(() => CranePickApp.P.cranes[0].id);
  const card = await txt(`#crCard-${cid}`);
  assert.match(card, /Elevation geometry \(heights, hook reach, 3D clearances; above the crane pad\): boom-foot pin 2\.00 ft ahead of rotation \(crane file; Edit… to change\), tail swing 15\.00 ft, maximum boom angle 80\.0° \(file\)/);
  assert.equal(await p.getAttribute(`#cr_gfH_${cid}`, 'placeholder'), '8.00 (file)'); assert.equal(await p.getAttribute(`#cr_gcb_${cid}`, 'placeholder'), '4.00 (file)'); assert.equal(await p.getAttribute(`#cr_ghd_${cid}`, 'placeholder'), 'assumed');
  assert.match(card, /Assumed \(not in the file, not entered\): head allowance 0 ft[^.]*; boom section width 0 ft/);
  await setF(`#cr_ghd_${cid}`, 3); let P = await proj(); assert.deepEqual(P.cranes[0].def.app_inputs.geom, { head: 3 });
  assert.doesNotMatch(await txt(`#crCard-${cid}`), /head allowance 0 ft/);
  await p.click(`[data-ca=edit][data-id="${cid}"]`); await p.waitForSelector('dialog.crDlg[open]');
  assert.match(await txt('dialog.crDlg'), /ELEVATION GEOMETRY \(HEIGHTS, 3D CLEARANCES\)/i); assert.equal(await p.inputValue('#ceGhd'), '3'); assert.equal(await p.getAttribute('#ceGfH', 'placeholder'), '8 (file)');
  await p.click('dialog.crDlg [data-ce=close]'); await p.waitForTimeout(100);
  ok('crane card: elevation geometry from the file (pin 8 ft high, 2 ft ahead, counterweight 4 ft, max 80°), the assumptions listed; head allowance 3 ft entered; the editor shows it');

  // 2. hand check
  await p.click(`[data-ca=place][data-id="${cid}"]`); await p.waitForTimeout(400);
  await setF('#luE', 1000); await setF('#luN', 2000); await setF('#luHead', 0); await setF('#luBoom', 60); await setF('#luPad', 100);
  await setF('#lkPE', 1030); await setF('#lkPN', 2000); await setF('#lkSE', 1000); await setF('#lkSN', 2020); await setF('#lkLoad', 20000);
  await p.click('#lkElev summary'); await p.waitForTimeout(80);
  for (const [id, v] of [['#lkPg', 98], ['#lkPh', 4], ['#lkSh', 20], ['#lkLH', 6], ['#lkRigH', 12], ['#lkBlk', 5], ['#lkLL', 40], ['#lkLW', 4]]) await setF(id, v);
  P = await proj(); assert.deepEqual(P.picks[0].elev, { pg: 98, sg: null, trav: null, ph: 4, sh: 20, rig: 12, blk: 5, L: 40, W: 4, H: 6 }); assert.equal(P.setups[0].pad, 100);
  assert.equal(await txt('#lfHeights'), 'Heights: boom angle 61.0° (chart) at the pick / 72.0° (chart) at the set · tip el. 160.48 / 165.06 ft · hook el. 120.00 / 138.00 ft · load bottom el. 102.00 / 120.00 ft (travel 120.00) · hook reach margin 32.48 ft / 19.06 ft / swing 14.48 ft');
  await p.click('#lfSteps summary'); await p.waitForTimeout(100);
  const st = await txt('#lfSteps');
  for (const rx of [/Heights: crane geometry/, /Boom angle from the geometry \(straight boom, foot pin to tip pin\)/, /Loaded boom angle printed in the chart at L and R/, /Boom-tip \(head sheave\) pin elevation/, /Hook reach margin/, /Heights during the swing/, /Load bottom elevation during the swing \(not entered: the higher of the pick and the set\)/]) assert.match(st, rx);
  assert.ok(!/NaN|undefined/.test(st));
  assert.match(await txt('#lfRes'), /chart's loaded boom angle 61\.0° is used \(geometric 62\.2°\)/);
  await shot('c3-1-heights');
  ok('hand check: θ 61° / 72° (chart; geometric 62.2° shown), tip 160.48 / 165.06 ft, hook 120.00 / 138.00, load bottom 102.00 / 120.00, travel 120.00, hook reach 32.48 / 19.06 / swing 14.48 ft; worked steps');

  // 3. drag the pick point
  await p.evaluate(() => { const u = CranePickApp.P.setups[0]; CranePickMap.fit([{ x: u.x - 45, y: u.y - 45 }, { x: u.x + 45, y: u.y + 45 }]); }); await settle();
  const a = await scr({ x: 1030, y: 2000 }), c0 = await scr({ x: 1040, y: 2000 });
  await p.mouse.move(a.x, a.y); await p.mouse.down();
  for (let i = 1; i <= 12; i++) { await p.mouse.move(a.x + (c0.x - a.x) * i / 12, a.y); if (i === 6) { await p.waitForTimeout(40); const e = await engine(); assert.ok(e.R > 31 && e.R < 39, 'mid-drag R ' + e.R); assert.match(await txt('#lfHeights'), new RegExp('tip el\\. ' + f2(e.tip).replace('.', '\\.') + ' /')); } }
  await p.mouse.up(); await p.waitForTimeout(250);
  const e1 = await engine(); near(e1.R, 40, 0.6); assert.ok(e1.tip < 160.48, 'the tip is lower at a larger radius');
  await settle(); await p.click('#bUndo'); await p.waitForTimeout(200); near((await engine()).tip, 160.4772, 1e-3, 'one undo step');
  ok(`pick point dragged: the heights follow mid-drag (tip el. = the engine's), dropped at R ${e1.R.toFixed(1)} ft (tip ${e1.tip.toFixed(2)} ft); one undo step`);

  // 4. a set the hook cannot reach
  await setF('#lkSh', 60); let e = await engine();
  assert.ok(e.flags.some(f => /^stop:At the set: the hook cannot reach \(hook reach margin −?-?20\.94 ft\)/.test(f)), e.flags.join(' | '));
  assert.ok(await p.$('.lfFlags li.lf-stop')); assert.match(await txt('#lfHeights'), /hook reach margin 32\.48 ft \/ -20\.94 ft/);
  await settle(); await p.click('#bUndo'); await p.waitForTimeout(200); e = await engine(); assert.ok(!e.flags.some(f => /cannot reach/.test(f)));
  ok('a set the hook cannot reach (block top 183 > 165.06 − 3): red flag, margin −20.94 ft; Undo clears it');

  // 5. Picks tab and Report
  await p.click('#tabBar [data-otab=picks]'); await p.waitForSelector('#pkTbl');
  const row = await p.$$eval('#pkTbl tbody tr', r => [...r[0].querySelectorAll('td')].map(td => td.innerText.trim()));
  assert.deepEqual(row.slice(14, 17), ['61.0 / 72.0', '160.48 / 165.06', '14.48']);
  await p.click('#pkTbl [data-pkw]'); await p.waitForTimeout(150); assert.match(await p.$eval('details.pkDet', d => d.innerText), /Heights at the pick[\s\S]*Boom-tip \(head sheave\) pin elevation[\s\S]*Heights during the swing/);
  await p.click('#tabBar [data-otab=rpt]'); await p.waitForSelector('#rptHost .rp-doc'); await p.waitForTimeout(300);
  const doc = await p.evaluate(() => { const d = CranePickReportUI.view.doc; return { unresolved: d.unresolved, dup: d.dup, text: SharedReport.text(d) }; });
  assert.deepEqual(doc.unresolved, []); assert.deepEqual(doc.dup, []); assert.ok(!/NaN|undefined/.test(doc.text));
  assert.match(doc.text, /Boom-foot pin height above the pad \(ft\):?\s*8\.00 \(crane file\)[\s\S]*Head allowance \(ft\):?\s*3\.00 \(entered\)[\s\S]*Boom section width \(ft\):?\s*0\.00 \(assumed\)/);
  assert.match(doc.text, /Heights \(C3-1\): boom angle θ = acos\(\(R − e\)\/L\)/);
  assert.match(doc.text, /Pick 1[\s\S]*Crane pad elevation \(ft\):?\s*100\.00[\s\S]*Hook reach margin, lowest \(ft\):?\s*14\.48[\s\S]*Heights at the pick[\s\S]*Boom-tip \(head sheave\) pin elevation/);
  await shot('c3-1-report');
  ok('Picks tab: θ 61.0 / 72.0, tip 160.48 / 165.06, hook reach min 14.48; worked steps below; Report: §Cranes elevation geometry (file / entered / assumed), the basis, the pick\'s heights and steps; no unresolved keys, no NaN');

  // 6. reload, 390 px
  await p.reload(); await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(400);
  P = await proj(); assert.equal(P.setups[0].pad, 100); assert.equal(P.picks[0].elev.rig, 12); assert.equal(P.cranes[0].def.app_inputs.geom.head, 3);
  await p.setViewportSize({ width: 390, height: 800 }); await p.click('#tabBar [data-otab=plan]'); await p.click('#inTabs [data-itab=lifts]'); await p.waitForTimeout(300);
  await p.evaluate(() => CranePickPlace.select(CranePickApp.P.setups[0].id, CranePickApp.P.picks[0].id)); await p.waitForTimeout(200);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll');
  await shot('c3-1-390');
  ok('reload keeps the pad, the pick heights and the crane geometry; 390 px: no sideways scroll');
  assert.deepEqual(errs, []); ok('0 console errors');
  console.log(`\n${n} checks passed`);
} catch (e) { console.error('FAIL', e); console.error('console errors:', errs); process.exitCode = 1; }
finally { await b.close(); }
