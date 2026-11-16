#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), C5: girder lifts (tandem) in the app. Headless Chromium, file://, base map None. Only the
// SYNTHETIC fake crane (tests/smoke/crane-fake-wheeled.json) is used.
//   1. two setups of the fake crane (80 ft boom, pad 100) at (1,000, 2,000) and (1,100, 2,000); "New tandem lift", the girder and hooks
//      typed in (the hand case of tests/engine/crane-tandem.test.mjs: L 60, W 40,000, CG 28, hooks 10 / 50 + 2,000 each → W1 24,000,
//      W2 20,000; pick (1,050, 1,980) el. 105, set (1,050, 2,000) el. 120): governing crane 1 88.9 % / crane 2 74.1 % at step 0,
//      the tandem-limit flag; the card equals the engine;
//   2. drag the CG handle and a lifting point on the map: both cranes' live labels change mid-drag (= the engine), one undo step each;
//   3. the scrubber: the last step R 30.00, 64.86 % / 54.05 %; the elevation and the map follow; Play;
//   4. ground: the C4 weights on the crane card values → each crane's float loads; a pipe 25 ft deep midway between the cranes → the both-cranes sum;
//   5. Picks tab rows per crane; Report §Tandem lifts (no unresolved keys, no NaN); undo / redo; reload; 390 px; 0 console errors.
//   SHOTS=<dir> node tests/smoke/crane-tandem.mjs
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/crane-pick/index.html');
const FW = path.join(REPO, 'tests/smoke/crane-fake-wheeled.json');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 900, ls: { 'crane.ui': '{"base":"none","itab":"cranes"}' } });
const proj = () => p.evaluate(() => JSON.parse(localStorage.getItem('crane.project.current')));
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
const setF = async (sel, v) => { await p.fill(sel, String(v)); await p.dispatchEvent(sel, 'change'); await p.waitForTimeout(60); };
const txt = sel => p.$eval(sel, e => (e.innerText || e.textContent).replace(/\s+/g, ' '));
const scr = q => p.evaluate(q => { const m = CranePickMap.map, cp = m.latLngToContainerPoint(CranePickMap.toLL(q)), r = m.getContainer().getBoundingClientRect(); return { x: r.x + cp.x, y: r.y + cp.y }; }, q);
const eng = () => p.evaluate(() => { const t = CranePickApp.P.tandems[0], r = CranePickTandemUI.evalT(t), j = CranePickTandemUI.step, q = r.steps[j];
  return { Wh: r.sh.Wh, xcg: r.sh.ob.xcg, gov: r.gov.map(g => ({ i: g.i, pct: g.c.pct })), n: r.steps.length, j, cur: q.cr.map(c => ({ R: c.R, C: c.C, pct: c.pct })), flags: r.flags.map(f => f.text),
    ground: r.ground ? { cr: r.ground.cr.map(g => ({ mode: g.mode, W: g.W, max: g.mode === 'none' ? null : g.max.map(m => m.load) })), pair: r.ground.pair.map(d => ({ ds: d.ds, parts: d.parts })) } : null }; });
const labels = () => p.$$eval('.tgLbl .lv', a => a.map(x => x.innerText.replace(/\s+/g, ' ').trim()));
const lblOf = c => `R ${c.R.toFixed(1)} ft`;
async function drag(from, to, mid) {
  const a = await scr(from), z = await scr(to); await p.mouse.move(a.x, a.y); await p.mouse.down(); let m = null;
  for (let i = 1; i <= 10; i++) { await p.mouse.move(a.x + (z.x - a.x) * i / 10, a.y + (z.y - a.y) * i / 10); if (i === 6 && mid) { await p.waitForTimeout(60); m = await mid(); } }
  await p.mouse.up(); await p.waitForTimeout(300); return m;
}
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(300);
  await p.setInputFiles('#crFiles', [FW]); await p.waitForFunction(() => /1 crane loaded/.test(document.querySelector('#crStatus').textContent));
  await p.click('[data-ca=add]'); await p.waitForTimeout(200);
  await p.evaluate(() => { const K = CranePickCranes, c = CranePickApp.P.cranes[0], g = K.groups(c.def).find(g => Object.values(g.configs).some(x => x.id === 'or-full-360')).key;
    CranePickApp.update(P => { [1000, 1100].forEach((x, i) => P.setups.push(CranePickModel.normSetup({ name: 'Crane ' + (i + 1), craneId: c.id, x, y: 2000, heading: 0, group: g, boom: 80, pad: 100 }))); }, 'setups'); });
  await p.click('#inTabs [data-itab=tandem]'); await p.waitForTimeout(150);
  await p.click('[data-ta=newT]'); await p.waitForTimeout(300);
  for (const [s, v] of [['#tlL', 60], ['#tlW', 40000], ['#tlCg', 28], ['#tlH', 6], ['#tlH0s', 10], ['#tlH0rig', 1000], ['#tlH0hook', 1000], ['#tlH0rigH', 10], ['#tlH0blk', 4],
    ['#tlH1s', 50], ['#tlH1rig', 1000], ['#tlH1hook', 1000], ['#tlH1rigH', 10], ['#tlH1blk', 4], ['#tlPE', 1050], ['#tlPN', 1980], ['#tlPH', 90], ['#tlPZ', 105], ['#tlSE', 1050], ['#tlSN', 2000], ['#tlSH', 90], ['#tlSZ', 120]]) await setF(s, v);
  let P = await proj(); assert.equal(P.tandems.length, 1); assert.deepEqual(P.tandems[0].slots, [P.setups[0].id, P.setups[1].id]); assert.deepEqual(P.tandems[0].girder.L, 60);
  let e = await eng();
  assert.deepEqual(e.Wh, [24000, 20000]); assert.equal(e.n, 50); assert.equal(e.gov[0].i, 0); near(e.gov[0].pct, 88.888889, 1e-5); near(e.gov[1].pct, 74.074074, 1e-5);
  assert.ok(e.flags.some(f => /Crane 1: 88\.9 % of chart at step 0 .*≥ the tandem limit 75 %/.test(f)));
  const gov = await p.$$eval('#tlGov tbody tr', r => r.map(x => [...x.querySelectorAll('td')].map(t => t.innerText.trim())));
  assert.deepEqual(gov.map(r => [r[0], r[1], r[3], r[4], r[5], r[6]]), [['Crane 1', '0', '36.06', '27,000', '24,000', '88.9'], ['Crane 2', '0', '36.06', '27,000', '20,000', '74.1']]);
  const share = await p.$$eval('#tlShare tbody tr', r => r.map(x => [...x.querySelectorAll('td')].map(t => t.innerText.trim())));
  assert.deepEqual(share, [['Crane 1', '10.00', '22,000', '24,000'], ['Crane 2', '50.00', '18,000', '20,000']]);
  await p.evaluate(() => CranePickMap.fit([{ x: 960, y: 1930 }, { x: 1140, y: 2070 }])); await p.waitForTimeout(400);
  let L0 = await labels(); assert.equal(L0.length, 2); assert.match(L0[0], /^C1 R 36\.1 ft C 27,000 lb · 88\.9 %$/);
  await shot('c5-tandem-card');
  ok('two setups, "New tandem lift", the hand case typed in: W hook 24,000 / 20,000 lb (share 22,000 / 18,000), 50 steps, governing step 0: 88.9 % / 74.1 % (tandem limit flag on crane 1); map labels');

  // 2. drag the CG along the girder (at the pick pose: heading 90°, end A west; CG 28 → 38, x = 1,020 + 38 = 1,058) and lifting point 2
  const mid1 = await drag({ x: 1020 + 28, y: 1980 }, { x: 1020 + 38, y: 1980 }, async () => ({ L: await labels(), e: await eng() }));
  assert.notDeepEqual(mid1.L, L0, 'labels change mid-drag'); assert.ok(mid1.e.xcg > 28.5, String(mid1.e.xcg));
  assert.ok(mid1.L[0].includes(lblOf(mid1.e.cur[0])) && mid1.L[1].includes(lblOf(mid1.e.cur[1])), JSON.stringify(mid1.L));
  assert.ok(mid1.L[0].includes(mid1.e.cur[0].pct.toFixed(1) + ' %') && mid1.L[1].includes(mid1.e.cur[1].pct.toFixed(1) + ' %'), JSON.stringify(mid1));
  e = await eng(); P = await proj(); near(P.tandems[0].girder.cg, 38, 0.6, 'CG dragged to ~38');
  const R1 = 40000 * (50 - e.xcg) / 40; near(e.Wh[0], R1 + 2000, 1e-6); near(e.Wh[1], 40000 - R1 + 2000, 1e-6);
  assert.ok(e.Wh[0] < 24000 && e.Wh[1] > 20000, 'moving the CG toward hook 2 moves load to crane 2');
  await p.waitForTimeout(450); await p.click('#bUndo'); await p.waitForTimeout(300); e = await eng(); assert.equal(e.xcg, 28, 'one undo step'); assert.deepEqual(await labels(), L0);
  await p.click('#bRedo'); await p.waitForTimeout(300); e = await eng(); assert.ok(e.xcg > 28.5); await p.click('#bUndo'); await p.waitForTimeout(300);
  const mid2 = await drag({ x: 1020 + 50, y: 1980 }, { x: 1020 + 44, y: 1980 }, async () => ({ L: await labels(), e: await eng() }));
  assert.notDeepEqual(mid2.L, L0); e = await eng(); P = await proj(); const x2 = P.tandems[0].hooks[1].s; near(x2, 44, 0.6);
  const R1b = 40000 * (x2 - 28) / (x2 - 10); near(e.Wh[0], R1b + 2000, 1e-6, 'R1 = W (x2 − x_cg)/(x2 − x1)');
  await shot('c5-tandem-drag');
  await p.waitForTimeout(450); await p.click('#bUndo'); await p.waitForTimeout(300); e = await eng(); assert.deepEqual(e.Wh, [24000, 20000]);
  ok(`drag the CG (x_cg → ${mid1.e.xcg.toFixed(2)} mid-drag) and lifting point 2 (→ ${x2.toFixed(2)} ft): both cranes' labels and hook loads change live (R1 = W (x2 − x_cg)/(x2 − x1)); one undo step each; redo`);

  // 3. the scrubber
  await p.fill('#tlScrub', '49'); await p.dispatchEvent('#tlScrub', 'input'); await p.waitForTimeout(200);
  e = await eng(); assert.equal(e.j, 49); near(e.cur[0].R, 30, 1e-9); near(e.cur[0].pct, 24000 / 370, 1e-6); near(e.cur[1].pct, 20000 / 370, 1e-6);
  const stepRow = await p.$$eval('#tlStep tbody tr', r => r.map(x => [...x.querySelectorAll('td')].map(t => t.innerText.trim())));
  assert.deepEqual(stepRow.map(r => [r[1], r[3], r[4]]), [['30.00', '37,000', '64.9'], ['30.00', '37,000', '54.1']]);
  assert.match(await txt('#tlWhere'), /lowering at the set, girder bottom el\. 120\.00|at the set/);
  assert.match(await txt('#tlElev'), /C1 tip 182\.7/);
  L0 = await labels(); assert.match(L0[0], /R 30\.0 ft C 37,000 lb · 64\.9 %/);
  await p.click('#tlPlay'); await p.waitForTimeout(100); await p.click('#tlPlay');
  await p.fill('#tlScrub', '32'); await p.dispatchEvent('#tlScrub', 'input'); await p.waitForTimeout(150); e = await eng(); near(e.cur[0].R, Math.sqrt(1000), 1e-9); near(e.cur[0].pct, 88.888889, 1e-5);
  // the dock under the map: the elevation of both cranes at this step, then the 3D view (both booms and the girder)
  assert.match(await txt('#elSvg'), /C1 tip 182\.0 C1 hook 136\.0 · R 31\.6 · 88\.9 % C2 tip 182\.0 C2 hook 136\.0 · R 31\.6 · 74\.1 % Tandem lift 1, step 32/); assert.match(await txt('#elInfo'), /Tandem lift 1, step 32/);
  await shot('c5-tandem-scrub');
  await p.click('[data-elmode="3d"]'); await p.waitForSelector('#v3Canvas', { timeout: 15000 }); await p.waitForTimeout(400);
  const c3 = await p.evaluate(() => { const c = {}; CranePickView3D.scene.traverse(o => Object.keys(o.userData || {}).forEach(k => { const key = k + ':' + o.userData[k]; c[key] = (c[key] || 0) + 1; })); return c; });
  assert.ok(c3['girder:true'] === 1 && c3['tboom:1'] === 1 && c3['tboom:2'] === 1, JSON.stringify(c3));
  await shot('c5-tandem-3d');
  await p.click('[data-elmode="2d"]'); await p.waitForTimeout(200);
  ok('scrubber: step 49 R 30.00 ft, C 37,000 lb, 64.9 % / 54.1 %, elevation (tip 182.7), map labels; step 32 R 31.62 (88.9 %, the hand-checked step); Play / Stop; the dock: elevation of both cranes at the step, 3D with both booms and the girder');

  // 4. ground: the C4 weights (hand check A of crane-ground) and a pipe between the cranes
  await p.evaluate(() => CranePickApp.update(P => { P.cranes[0].def.app_inputs = Object.assign({}, P.cranes[0].def.app_inputs, { ph4: { carrierLb: 40000, carrierCg: 0, upperLb: 30000, upperCg: 0, boomLb: 6000, cwRad: 10 } });
    P.items.push(CranePickModel.normItem({ type: 'util', name: 'Water main', kind: 'utility', depth: 25, pts: [{ x: 1050, y: 1950 }, { x: 1050, y: 2050 }] })); }, 'cranes'));
  await p.waitForTimeout(200); await p.click('#inTabs [data-itab=tandem]'); await p.waitForTimeout(150);
  e = await eng(); assert.deepEqual(e.ground.cr.map(g => [g.mode, g.W]), [['rigid', 24000], ['rigid', 20000]]);
  assert.equal(e.ground.pair.length, 1); near(e.ground.pair[0].ds, e.ground.pair[0].parts[0] + e.ground.pair[0].parts[1], 1e-9); assert.ok(e.ground.pair[0].parts.every(v => v > 0));
  await p.click('#tlGround summary'); await p.waitForTimeout(150);
  assert.match(await txt('#tlGround'), /Crane 1: ground .*24,000 lb.*entered data.*Crane 2: ground .*20,000 lb/);
  const pr = await p.$$eval('#tlGrPair tbody tr td', t => t.map(x => x.innerText.trim())); assert.equal(pr[0], 'Water main'); assert.equal(pr[3], Math.round(e.ground.pair[0].ds).toLocaleString('en-US'));
  await shot('c5-tandem-ground');
  ok(`ground: each crane its own hook load (24,000 / 20,000 lb, rigid body); a water main between them: Δσ_z ${pr[1]} + ${pr[2]} = ${pr[3]} psf (both cranes)`);

  // 5. Picks tab, Report, reload, 390 px
  await p.click('#tabBar [data-otab=picks]'); await p.waitForSelector('#tgTbl');
  const pk = await p.$$eval('#tgTbl tbody tr', r => r.map(x => [...x.querySelectorAll('td')].map(t => t.innerText.trim())));
  assert.equal(pk.length, 2); assert.deepEqual(pk.map(r => [r[1], r[4], r[9]]), [['1', '24,000', '88.9 %'], ['2', '20,000', '74.1 %']]);
  await p.click('#tabBar [data-otab=rpt]'); await p.waitForSelector('#rptHost .rp-doc'); await p.waitForTimeout(300);
  const doc = await p.evaluate(() => { const d = CranePickReportUI.view.doc; return { unresolved: d.unresolved, dup: d.dup, text: SharedReport.text(d) }; });
  assert.deepEqual(doc.unresolved, []); assert.deepEqual(doc.dup, []); assert.ok(!/NaN|undefined/.test(doc.text));
  assert.match(doc.text, /Tandem lifts[\s\S]*Basis[\s\S]*Load share[\s\S]*Summary[\s\S]*Tandem lift 1[\s\S]*Girder share at crane 1[\s\S]*Crane 1: governing step 0[\s\S]*Crane–crane distance[\s\S]*Stress at depth, both cranes: Water main/);
  await shot('c5-tandem-report');
  await p.reload(); await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(400);
  P = await proj(); assert.equal(P.tandems[0].hooks[1].s, 50); assert.equal(P.tandems[0].girder.cg, 28);
  await p.setViewportSize({ width: 390, height: 800 }); await p.click('#inTabs [data-itab=tandem]'); await p.waitForTimeout(200);
  await p.click('[data-tasel-t]'); await p.waitForTimeout(300);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll');
  await shot('c5-tandem-390');
  ok('Picks tab rows per crane; Report §Tandem lifts (basis, summary, load share, governing steps, crane–crane, both-cranes stress at depth; no unresolved keys, no NaN); reload; 390 px: no sideways scroll');
  assert.deepEqual(errs, []); ok('0 console errors');
  console.log(`\n${n} checks passed`);
} catch (e) { console.error('FAIL', e); console.error('console errors:', errs); process.exitCode = 1; }
finally { await b.close(); }
