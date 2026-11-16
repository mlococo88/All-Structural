#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), C4: ground and supports in the app. Headless Chromium, file://, base map None. Only the SYNTHETIC
// fake crane (tests/smoke/crane-fake-wheeled.json) is used.
//   1. crane card: the C4 inputs (boom weight / CG, counterweight radius, gross weight); before the weights: the estimate label;
//   2. hand check A of tests/engine/crane-ground.test.mjs typed in (heading 90°, pick 30 ft east = over the front): Ground tab
//      "entered data", FL 41.08 kip at θ 0°; timber mat 4 × 4 ft × 12 in, q_a 4 ksf: q_g = 41,083.33/14.231407 + 50 = 2,936.81 psf
//      (ratio 0.73); a water main 3 ft deep under FL → Δσ_z in the table (= the engine's); the worked steps;
//   3. the map: pressure areas under the floats and the float-load labels; dragging the pick point changes the labels mid-drag;
//   4. Report §Ground (no unresolved keys, no NaN); reload keeps the inputs; 390 px; 0 console errors.
//   SHOTS=<dir> node tests/smoke/crane-ground.mjs
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
const scr = q => p.evaluate(q => { const m = CranePickMap.map, cp = m.latLngToContainerPoint(CranePickMap.toLL(q)), r = m.getContainer().getBoundingClientRect(); return { x: r.x + cp.x, y: r.y + cp.y }; }, q);
const engine = () => p.evaluate(() => { const g = CranePickPlace.evalPick(CranePickApp.P.picks[0]).ground; if (g.mode === 'none') return { mode: g.mode }; return { mode: g.mode, max: g.max.map(m => ({ id: m.id, load: m.load, theta: m.theta })), qg: g.bear.map(x => x.qg), ratio: g.bear.map(x => x.ratio), depth: g.depth.map(d => d.ds) }; });
const labels = () => p.$$eval('.crGrLbl [data-gl]', a => a.map(x => x.textContent));
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(300);
  await p.setInputFiles('#crFiles', [FW]); await p.waitForFunction(() => /1 crane loaded/.test(document.querySelector('#crStatus').textContent));
  await p.click('[data-ca=add]'); await p.waitForTimeout(200);
  const cid = await p.evaluate(() => CranePickApp.P.cranes[0].id);
  assert.match(await txt(`#crCard-${cid}`), /For outrigger \/ track loads \(Ground\)/);
  assert.equal(await p.getAttribute(`#cr_cwR_${cid}`, 'placeholder'), '15.00 (tail swing, assumed)');
  await p.click(`[data-ca=place][data-id="${cid}"]`); await p.waitForTimeout(400);
  await setF('#luE', 1000); await setF('#luN', 2000); await setF('#luHead', 90); await setF('#luBoom', 60);
  await setF('#lkPE', 1030); await setF('#lkPN', 2000); await setF('#lkSE', 1000); await setF('#lkSN', 1970);
  await setF('#lkLoad', 20000); await setF('#lkRig', 1000); await setF('#lkHook', 1000);
  // 1. no weights: not computed; gross weight only: the estimate
  assert.equal((await engine()).mode, 'none');
  await p.click('#inTabs [data-itab=cranes]'); await setF(`#cr_grLb_${cid}`, 76000);
  let e = await engine(); assert.equal(e.mode, 'estimate'); near(e.max[0].load, 107000, 0.05, 'the bound at the pick (engine test)');
  await p.click('#tabBar [data-otab=ground]'); await p.waitForSelector('.grPick');
  assert.match(await txt('.grPick'), /estimate — verify with the manufacturer's outrigger calculator/);
  ok('crane card C4 inputs (counterweight radius: tail swing assumed); nothing entered: not computed; gross weight 76,000 lb: the estimate, labelled, FL 107.00 kip');

  // 2. the hand check
  await p.click('#inTabs [data-itab=cranes]');
  for (const [k, v] of [['caLb', 40000], ['caCg', 0], ['upLb', 30000], ['upCg', 0], ['boLb', 6000], ['cwR', 10]]) await setF(`#cr_${k}_${cid}`, v);
  let P = await proj(); assert.deepEqual(P.cranes[0].def.app_inputs.ph4, { grossLb: 76000, carrierLb: 40000, carrierCg: 0, upperLb: 30000, upperCg: 0, boomLb: 6000, cwRad: 10 });
  await p.evaluate(() => CranePickApp.update(P => { P.items.push(CranePickModel.normItem({ type: 'util', name: 'Water main', kind: 'utility', depth: 3, pts: [{ x: 1012, y: 2004 }, { x: 1012, y: 2060 }] })); }, 'items'));
  await p.click('#inTabs [data-itab=ground]'); await p.waitForTimeout(150);
  const uid = await p.evaluate(() => CranePickApp.P.setups[0].id);
  await p.selectOption(`[data-gu="${uid}"] select[data-f=qaUnit]`, 'ksf'); await p.dispatchEvent(`[data-gu="${uid}"] select[data-f=qaUnit]`, 'change'); await p.waitForTimeout(100);
  await setF(`#grQa_${uid}`, 4);
  await p.selectOption(`#grMt_${uid}`, 'timber'); await p.waitForTimeout(150);
  for (const [k, v] of [['grB_', 4], ['grL_', 4], ['grT_', 12], ['grFb_', 1200], ['grFv_', 150]]) await setF('#' + k + uid, v);
  const iid = await p.evaluate(() => CranePickApp.P.items[0].id); await setF(`#grCap_${iid}`, 2500);
  P = await proj(); assert.deepEqual(P.setups[0].ground, { mat: { type: 'timber', B: 4, L: 4, t: 12, Fb: 1200, Fv: 150, E: null, Fy: null, gamma: null, k: null }, qa: 4000, qaUnit: 'ksf' }); assert.deepEqual(P.ground, { caps: { [iid]: 2500 } });
  e = await engine(); assert.equal(e.mode, 'rigid');
  near(e.max[0].load, 41083.33, 0.01, 'FL'); assert.equal(e.max[0].theta, 0); near(e.qg[0], 41083.333333 / 14.231407 + 50, 0.01, 'q_g FL'); near(e.ratio[0], (41083.333333 / 14.231407 + 50) / 4000, 1e-4);
  await p.click('#tabBar [data-otab=ground]'); await p.waitForSelector('.grTbl');
  const row = await p.$$eval('.grTbl tbody tr', r => [...r[0].querySelectorAll('td')].map(td => td.innerText.trim()));
  assert.deepEqual(row.slice(0, 6), ['FL (front left)', '41.08', '0°', '30.00', '2,937 / 2.94', '0.73']);
  assert.match(await txt('.grPick'), /entered data/);
  const dz = await p.$$eval('.grDz tbody tr td', t => t.map(x => x.innerText.trim()));
  assert.equal(dz[0], 'Water main'); assert.equal(dz[1], '3.00'); assert.equal(dz[2], Math.round(e.depth[0]).toLocaleString('en-US')); assert.equal(dz[4], '2,500');
  await p.click('.grPick details.crSteps summary'); await p.waitForTimeout(150);
  const st = await txt('.grPick details.crSteps');
  for (const rx of [/Governing slew angle/, /Total vertical load/, /Resultant position, x/, /float load \(all four floats in contact/, /Effective bearing width/, /Mat bending moment/, /Allowable moment per foot \(timber/, /Ground bearing ratio/, /Stress at depth: Water main/, /Corner rectangle/]) assert.match(st, rx);
  assert.ok(!/NaN|undefined/.test(st));
  await shot('c4-ground-tab');
  ok(`hand check A: entered data, FL 41.08 kip at θ 0°, timber mat 4 × 4 ft × 12 in: q_g 2,937 psf / 2.94 ksf, ratio 0.73 (q_a 4 ksf); water main 3 ft deep: Δσ_z ${Math.round(e.depth[0])} psf; worked steps`);

  // 3. the map: areas and labels; drag the pick point
  await p.click('#tabBar [data-otab=plan]'); await p.waitForTimeout(300);
  await p.evaluate(() => { const u = CranePickApp.P.setups[0]; CranePickMap.fit([{ x: u.x - 45, y: u.y - 45 }, { x: u.x + 45, y: u.y + 45 }]); }); await p.waitForTimeout(450);
  let L0 = await labels(); assert.equal(L0.length, 4); assert.match(L0[0], /^FL 41\.1 k · 2\.94 ksf \(0\.73\)$/);
  assert.ok((await p.$$('.leaflet-crGround-pane path.crGrArea')).length >= 8, 'mat areas and floats drawn');
  const a = await scr({ x: 1030, y: 2000 }), c0 = await scr({ x: 1030, y: 2012 });
  await p.mouse.move(a.x, a.y); await p.mouse.down(); let mid = null;
  for (let i = 1; i <= 12; i++) { await p.mouse.move(a.x + (c0.x - a.x) * i / 12, a.y + (c0.y - a.y) * i / 12); if (i === 8) { await p.waitForTimeout(60); mid = await labels(); const em = await engine(); assert.match(mid[0], new RegExp('^FL ' + (em.max[0].load / 1000).toFixed(1).replace('.', '\\.') + ' k')); } }
  await p.mouse.up(); await p.waitForTimeout(300);
  assert.notDeepEqual(mid, L0, 'labels change mid-drag'); const L1 = await labels(); assert.notDeepEqual(L1, L0);
  await shot('c4-ground-map');
  await p.waitForTimeout(400); await p.click('#bUndo'); await p.waitForTimeout(300); assert.deepEqual(await labels(), L0, 'one undo step');
  ok(`map: pressure areas under the floats and mats, labels "${L0[0]}"; the labels follow the pick drag mid-drag ("${mid[0]}"); one undo step`);

  // 4. Report, reload, 390 px
  await p.click('#tabBar [data-otab=rpt]'); await p.waitForSelector('#rptHost .rp-doc'); await p.waitForTimeout(300);
  const doc = await p.evaluate(() => { const d = CranePickReportUI.view.doc; return { unresolved: d.unresolved, dup: d.dup, text: SharedReport.text(d) }; });
  assert.deepEqual(doc.unresolved, []); assert.deepEqual(doc.dup, []); assert.ok(!/NaN|undefined/.test(doc.text));
  assert.match(doc.text, /Ground[\s\S]*Basis[\s\S]*rigid-body statics[\s\S]*Summary[\s\S]*Pick 1[\s\S]*entered data[\s\S]*Governing support: front right/);   // FR governs at θ 45° (45.88 kip)
  await shot('c4-ground-report');
  await p.reload(); await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(400);
  P = await proj(); assert.equal(P.setups[0].ground.mat.t, 12); assert.equal(P.ground.caps[iid], 2500);
  await p.setViewportSize({ width: 390, height: 800 }); await p.click('#tabBar [data-otab=ground]'); await p.click('#inTabs [data-itab=ground]'); await p.waitForTimeout(300);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll');
  ok('Report §Ground (basis, summary, the pick with its steps; no unresolved keys, no NaN); reload keeps the inputs; 390 px: no sideways scroll');
  assert.deepEqual(errs, []); ok('0 console errors');
  console.log(`\n${n} checks passed`);
} catch (e) { console.error('FAIL', e); console.error('console errors:', errs); process.exitCode = 1; }
finally { await b.close(); }
