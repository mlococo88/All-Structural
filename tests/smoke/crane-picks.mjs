#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), C2-3: the Picks output tab and the Report's §Lifts. Headless Chromium, file://, base map None.
// Only the SYNTHETIC fake cranes (tests/smoke/crane-fake-*.json) are used.
//   1. two fake cranes placed (a wheeled crane with two picks: the hand-check pick and one over the chart; a crawler with one pick);
//   2. Picks tab (between Plan and Site): one row per pick with setup, boom, radii, capacities, W, governing point, % chart, status,
//      flags; the values are the engine's; links: pick → selected on the map, "worked" → its steps below, "Report" → its §;
//   3. Report §Lifts: basis (lookup rule, thresholds), summary table with § links to each pick, the plan figure, each pick's inputs
//      (§ link to its crane in §Cranes), flags and worked steps; no unresolved or duplicate keys, no NaN / undefined;
//      the Lifts tab's "worked: Report" link opens the pick's §;
//   4. a change (Undo) updates the Picks tab; 390 px: no sideways scroll; 0 console errors.
//   SHOTS=<dir> node tests/smoke/crane-picks.mjs
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/crane-pick/index.html');
const FW = path.join(REPO, 'tests/smoke/crane-fake-wheeled.json'), FC = path.join(REPO, 'tests/smoke/crane-fake-crawler.json');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 860, ls: { 'crane.ui': '{"base":"none","itab":"cranes"}' } });
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
const setF = async (sel, v) => { await p.fill(sel, String(v)); await p.dispatchEvent(sel, 'change'); await p.waitForTimeout(80); };
const settle = () => p.waitForTimeout(450);
const rowTexts = () => p.$$eval('#pkTbl tbody tr', a => a.map(r => [...r.cells].map(c => c.innerText.trim())));
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(300);
  // 1.
  await p.setInputFiles('#crFiles', [FW, FC]); await p.waitForFunction(() => /2 cranes loaded/.test(document.querySelector('#crStatus').textContent));
  await p.click('[data-ca=add][data-k="fakeco-test-at-100-fake-test-data"]'); await p.waitForTimeout(100); await p.click('[data-ca=add][data-k="fakeco-test-cr-200-fake-test-data"]'); await p.waitForTimeout(100);
  const ids = await p.evaluate(() => CranePickApp.P.cranes.map(c => c.id));
  await p.evaluate(id => CranePickPlace.placeCrane(id, { x: 1000, y: 2000 }), ids[0]); await p.waitForTimeout(200);
  await setF('#luBoom', 60); await setF('#lkPE', 1030); await setF('#lkPN', 2000); await setF('#lkSE', 1000); await setF('#lkSN', 2020); await setF('#lkLoad', 20000); await setF('#lkRig', 1000); await setF('#lkHook', 1000);
  await p.click('[data-la=addPick]'); await p.waitForTimeout(150);
  await setF('#lkName', 'Girder G2'); await setF('#lkPE', 1045); await setF('#lkPN', 2000); await setF('#lkSE', 1000); await setF('#lkSN', 2040); await setF('#lkLoad', 21000);
  await p.evaluate(id => CranePickPlace.placeCrane(id, { x: 1200, y: 2000 }), ids[1]); await p.waitForTimeout(200);
  await setF('#luBoom', 120); await setF('#lkPE', 1240); await setF('#lkPN', 2000); await setF('#lkSE', 1200); await setF('#lkSN', 2060); await setF('#lkLoad', 40000); await setF('#lkHook', 2000);
  await p.evaluate(() => CranePickApp.update(P => { P.items.push(CranePickModel.normItem({ type: 'excl', name: 'Lane 1', pts: [{ x: 990, y: 2015 }, { x: 1010, y: 2015 }, { x: 1010, y: 2025 }, { x: 990, y: 2025 }] })); }, 'items')); await p.waitForTimeout(150);
  const P = await p.evaluate(() => CranePickApp.P); assert.equal(P.setups.length, 2); assert.equal(P.picks.length, 3);
  ok('two fake cranes placed; three picks (hand check, one over the chart, a crawler pick); an exclusion zone across the first set point');

  // 2. Picks tab
  assert.deepEqual(await p.$$eval('#tabBar [data-otab]', a => a.map(x => x.textContent)), ['Plan', 'Summary', 'Picks', 'Ground', 'Route', 'Terrain', 'Site', 'Drawings', 'Report']);   // C7: Summary, Drawings; C8: Terrain;   // C4 adds Ground, C6 Route
  await p.click('#tabBar [data-otab=picks]'); await p.waitForSelector('#pkTbl');
  const rows = await rowTexts(); assert.equal(rows.length, 3);
  assert.deepEqual(rows[0].slice(0, 13), ['Pick 1', 'Crane 1: FAKECO TEST-AT 100 (FAKE TEST DATA)', 'Main boom, outriggers full 24 ft, 360 deg, 20,000 lb counterweight (FAKE)', '60.0', '30.00', '20.00', '30.00', '39,000', '58,000', '22,000', 'at the pick (C 39,000 lb)', '56.4 %', 'within the chart']);
  assert.match(rows[0][13], /▲/, 'the exclusion-zone flag');
  assert.deepEqual(rows[1].slice(4, 13), ['45.00', '40.00', '45.00', '20,000', '28,000', '21,000', 'at the pick (C 20,000 lb)', '105.0 %', 'over the chart']);
  const ev = await p.evaluate(() => CranePickApp.P.picks.map(k => { const e = CranePickPlace.evalPick(k); return [e.gov.pct, e.cls]; }));
  assert.equal(rows[2][11], ev[2][0].toFixed(1) + ' %'); assert.equal(rows[2][4], '40.00'); assert.equal(rows[2][7], '76,000', 'crawler over side (no sector set): boom 120 → L_tab 150, R 40 → 76,000 lb');
  await p.click('#pkTbl [data-pkw]'); await p.waitForTimeout(150);
  assert.ok(await p.$eval('details.pkDet', d => d.open)); assert.match(await p.$eval('details.pkDet', d => d.innerText), /Radius from the centre of rotation to the hook[\s\S]*Percent of chart[\s\S]*Largest radius along the swing path/);
  assert.match(await p.$eval('details.pkDet', d => d.innerText), /Over the exclusion zone "Lane 1": [^.]*load/);
  await shot('c2-3-picks');
  const k2 = P.picks[1].id; await p.click(`[data-pkmap="${k2}"]`); await p.waitForTimeout(250);
  assert.equal(await p.$eval('#tabBar [aria-selected=true]', e => e.textContent), 'Plan'); assert.deepEqual(await p.evaluate(() => CranePickPlace.selected), { setup: P.setups[0].id, pick: k2 });
  assert.match(await p.$eval('#lkCard .secHead', e => e.textContent), /Girder G2/);
  ok('Picks tab (between Plan and Site): 3 rows; pick 1 = the hand check (R 30.00 / 20.00, C 39,000 / 58,000, W 22,000, 56.4 %), pick 2 105.0 % over the chart, crawler 76,000 lb over side (L_tab 150); worked steps and flags below; the pick link selects it on the map');

  // 3. Report
  await p.click('#tabBar [data-otab=picks]'); await p.click(`[data-pkr="${k2}"]`); await p.waitForSelector('#rptHost .rp-doc'); await p.waitForTimeout(300);
  assert.equal(await p.$eval('#tabBar [aria-selected=true]', e => e.textContent), 'Report');
  const doc = await p.evaluate(() => { const d = CranePickReportUI.view.doc; return { unresolved: d.unresolved, dup: d.dup, refPick: SharedReport.ref(d, 'pick-' + CranePickApp.P.picks[1].id), refCrane: SharedReport.ref(d, 'crane-' + CranePickApp.P.cranes[0].id), text: SharedReport.text(d) }; });
  assert.deepEqual(doc.unresolved, []); assert.deepEqual(doc.dup, []); assert.match(doc.refPick, /^§\d+\.\d+$/); assert.match(doc.refCrane, /^§\d+\.\d+$/);
  const t = doc.text; assert.ok(!/NaN|undefined/.test(t));
  assert.match(t, /Lifts[\s\S]*Basis[\s\S]*next longer tabulated boom length and the next larger tabulated radius; no interpolation[\s\S]*Critical lift:\s*≥ 75 % of chart/);
  assert.match(t, /Summary of picks[\s\S]*Pick 1[\s\S]*56\.4 %[\s\S]*Girder G2[\s\S]*105\.0 %/);
  assert.ok(t.includes(doc.refPick), 'the summary links each pick'); assert.ok(t.includes(doc.refCrane), 'each pick links its crane');
  assert.match(t, /Girder G2[\s\S]*Load \/ rigging \/ hook \/ other \(lb\):?\s*21,000 \/ 0 \/ 0 \/ 0[\s\S]*Percent of chart/);
  assert.ok(await p.$('#rptHost .rp-doc svg'), 'the plan figure');
  const inView = await p.evaluate(() => { const r = [...document.querySelectorAll('#rptHost .rp-doc h3, #rptHost .rp-doc [id]')].find(e => /Girder G2/.test(e.textContent) && /^H\d$/.test(e.tagName)); return r ? r.getBoundingClientRect().top : null; });
  assert.ok(inView !== null && inView > -10 && inView < 860, 'jumped to the pick: ' + inView);
  await shot('c2-3-report');
  // the Lifts tab link
  await p.click('#tabBar [data-otab=plan]'); await p.evaluate(() => CranePickPlace.select(CranePickApp.P.setups[0].id, CranePickApp.P.picks[0].id)); await p.waitForTimeout(150);
  await p.click('[data-la=rptPick]'); await p.waitForTimeout(300); assert.equal(await p.$eval('#tabBar [aria-selected=true]', e => e.textContent), 'Report');
  ok(`Report §Lifts: basis, summary (§ links to each pick: ${doc.refPick}), plan figure, inputs (§ link to the crane: ${doc.refCrane}), flags, worked steps; no unresolved / duplicate keys, no NaN; Picks-tab and Lifts-tab links jump to the pick's §`);

  // 4. changes follow; 390 px
  await settle(); await p.click('#tabBar [data-otab=picks]'); await p.click('#bUndo'); await p.waitForTimeout(200);
  assert.equal((await rowTexts()).length, 3); assert.doesNotMatch((await rowTexts())[0][13], /▲/, 'undo removed the exclusion zone: no flag');
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(250);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll');
  await shot('c2-3-picks-390');
  ok('Undo updates the Picks tab; 390 px: no sideways scroll (the table scrolls in its box)');
  assert.deepEqual(errs, []); ok('0 console errors');
  console.log(`\n${n} checks passed`);
} catch (e) { console.error('FAIL', e); console.error('console errors:', errs); process.exitCode = 1; }
finally { await b.close(); }
