#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), C2-2: crane placement and live capacity. Headless Chromium, file://, base map None. Only the
// SYNTHETIC fake crane (tests/smoke/crane-fake-wheeled.json) is used.
//   1. fake crane loaded from a file, added, "Place on the map": a setup drawn to scale (carrier, 4 floats at the full spread, tail-swing
//      circle, ✥ and ↻ handles) with a first pick (P, S, boom lines, swing path, live labels); the setup card under its crane (Cranes & setups tab);
//   2. the hand-check case typed in (rotation E/N, boom 60 ft, pick +30 ft E, set +20 ft N, W = 20,000 + 1,000 + hook block 1,000 lb from
//      the crane's list): R 30.00 ft → C 39,000 lb → 56.4 %; set 20.00 ft → 58,000 lb → 37.9 %; the map labels and the live card agree;
//   3. dragging the pick point: the label and the live card change during the drag (values = the engine's for the dragged position),
//      live updates ≤ animation frames, one undo step; Undo / Redo;
//   4. dragging the crane (✥) and rotating it (↻): radius and heading follow; the floats move with it;
//   5. thresholds (caution / critical / limit) and the label colour; over the chart; outside the chart = "not permitted";
//   6. the chart group (on rubber: no floats drawn), interpolation setting (the fake notes permit it), clockwise swing;
//   7. plan clearance: a 115 kV line 10 ft from the pick point → a red flag (D_min 15 ft); dragging the pick away clears it;
//   8. worked steps; save / reload keeps setups and picks; 390 px: no sideways scroll; 0 console errors.
//   SHOTS=<dir> node tests/smoke/crane-place.mjs
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
const itabOf = sel => /^#lu|^\[data-la=(addPick|delU|zoomU)\]/.test(sel) ? 'cranes' : /^#(lk|ls|lf|tl)|lkSwing|^\[data-(la|ta)=/.test(sel) ? 'lifts' : null;   // 2026-11-17: setups on Cranes & setups, picks / girder lifts on Lifts
const goTab = async sel => { const t = itabOf(sel); if (t) await p.evaluate(t => { if (CranePickApp.ui.itab !== t) CranePickApp.showITab(t); }, t); };
const setF = async (sel, v) => { await goTab(sel); await p.fill(sel, String(v)); await p.dispatchEvent(sel, 'change'); await p.waitForTimeout(80); };
const txt = sel => p.$eval(sel, e => (e.innerText || e.textContent).replace(/\s+/g, ' '));
const settle = () => p.waitForTimeout(450);
const scr = q => p.evaluate(q => { const m = CranePickMap.map, cp = m.latLngToContainerPoint(CranePickMap.toLL(q)), r = m.getContainer().getBoundingClientRect(); return { x: r.x + cp.x, y: r.y + cp.y }; }, q);
const labels = () => p.$$eval('.crLiftLbl .lv', a => a.map(x => x.innerText.replace(/\s+/g, ' ').trim()));
const engine = () => p.evaluate(() => { const k = CranePickApp.P.picks[0], ev = CranePickPlace.evalPick(k); return { R: ev.pick.R, C: ev.pick.C, pct: ev.pick.pct, cls: ev.cls, sR: ev.set.R, gpct: ev.gov && ev.gov.pct, flags: ev.flags.map(f => f.level + ':' + f.text) }; });
const f1 = v => v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(300);
  // 1.
  await p.setInputFiles('#crFiles', [FW]); await p.waitForFunction(() => /1 crane loaded/.test(document.querySelector('#crStatus').textContent));
  await p.click('[data-ca=add]'); await p.waitForTimeout(150); await p.click('[data-ca=place]'); await p.waitForTimeout(400);
  let P = await proj(); assert.equal(P.setups.length, 1); assert.equal(P.picks.length, 1); assert.equal(P.picks[0].setupId, P.setups[0].id);
  assert.equal(await p.$eval('#inTabs [aria-selected=true]', e => e.textContent), 'Cranes & setups'); assert.ok(await p.$('.crSetups #luCard'), 'the new setup\'s card opens under its crane');
  assert.equal(await p.$$eval('.crHandle.crCor', a => a.length), 1); assert.equal(await p.$$eval('.crHandle.crRot', a => a.length), 1);
  assert.equal(await p.$$eval('.crPtP', a => a.length), 1); assert.equal(await p.$$eval('.crPtS', a => a.length), 1); assert.equal((await labels()).length, 2);
  const g = await p.evaluate(() => { const g = CranePickPlace.layers.values().next().value; return { floats: g.floats.length, body: !!g.body, tail: !!g.tail, beams: !!g.beams }; });
  assert.deepEqual(g, { floats: 4, body: true, tail: true, beams: true });
  ok('Place on the map: setup drawn to scale (carrier, beams, 4 floats, tail-swing circle, ✥ / ↻) with a first pick (P, S, path, 2 live labels); the setup card opens under its crane (Cranes & setups tab)');

  // 2. the hand check
  await setF('#luE', 1000); await setF('#luN', 2000); await setF('#luHead', 0); await setF('#luBoom', 60);
  await setF('#lkPE', 1030); await setF('#lkPN', 2000); await setF('#lkSE', 1000); await setF('#lkSN', 2020);
  await setF('#lkLoad', '20,000'); await setF('#lkRig', 1000); await goTab('#lkHookSel'); await p.selectOption('#lkHookSel', '0'); await p.waitForTimeout(100);
  P = await proj(); assert.deepEqual([P.picks[0].hook, P.picks[0].hookLabel], [1000, 'FAKE 50 t block']);
  await p.evaluate(() => CranePickPlace.select(CranePickApp.P.setups[0].id, CranePickApp.P.picks[0].id)); await p.waitForTimeout(150);
  await p.evaluate(() => { const u = CranePickApp.P.setups[0]; CranePickMap.fit([{ x: u.x - 45, y: u.y - 45 }, { x: u.x + 45, y: u.y + 45 }]); }); await p.waitForTimeout(200);
  assert.deepEqual(await labels(), ['P R 30.0 ft C 39,000 lb · 56.4 %', 'S R 20.0 ft C 58,000 lb · 37.9 %']);
  let card = await txt('#lfRes');
  assert.match(card, /Pick 1: 56\.4 % of chart within the chart governing at the pick/); assert.match(card, /Pick 30\.00 360° 60\.0 \/ 30\.0 39,000 56\.4/); assert.match(card, /Set 20\.00 360° 60\.0 \/ 20\.0 58,000 37\.9/);
  assert.match(card, /W = 22,000 lb · swing 90\.0° counter-clockwise · Rmax = 30\.00 ft · boom 60\.0 ft/); assert.match(card, /85 % of tipping/);
  await shot('c2-2-place');
  ok('hand check: R 30.00 ft → L_tab 60 / R_tab 30 → C 39,000 lb, W 22,000 lb (hook block from the crane list) → 56.4 %; set 20.00 ft → 58,000 lb → 37.9 %; labels and card agree');

  // 3. drag the pick point
  await settle();
  const a = await scr({ x: 1030, y: 2000 }), c0 = await scr({ x: 1045, y: 2000 });
  await p.evaluate(() => { window.__live = 0; window.__frames = 0; CranePickApp.on('live', o => { if (o.kind === 'lifts') window.__live++; }); (function f() { window.__frames++; window.__raf = requestAnimationFrame(f); })(); });
  await p.mouse.move(a.x, a.y); await p.mouse.down();
  for (let i = 1; i <= 20; i++) { await p.mouse.move(a.x + (c0.x - a.x) * i / 20, a.y); if (i === 10) {
    const mid = await engine(), lb = await labels(); assert.ok(mid.R > 33 && mid.R < 40, 'mid-drag radius ' + mid.R);
    assert.equal(lb[0], mid.C ? `P R ${f1(mid.R)} ft C ${mid.C.toLocaleString('en-US')} lb · ${f1(mid.pct)} %` : `P R ${f1(mid.R)} ft not permitted`);
    assert.match(await txt('#lfRes'), new RegExp('Pick ' + mid.R.toFixed(2).replace('.', '\\.'))); } }
  await p.mouse.up(); await p.waitForTimeout(250);
  const live = await p.evaluate(() => { cancelAnimationFrame(window.__raf); return [window.__live, window.__frames]; });
  assert.ok(live[0] >= 3 && live[0] <= live[1], 'live updates ≤ frames: ' + live);
  let e1 = await engine(); near(e1.R, 45, 0.6, 'dropped at about 45 ft'); assert.equal(e1.C, 20000, 'R_tab 50 at 60 ft');
  P = await proj(); near(Math.hypot(P.picks[0].pick.x - 1000, P.picks[0].pick.y - 2000), e1.R, 1e-6, 'stored = shown');
  assert.equal((await labels())[0], `P R ${f1(e1.R)} ft C 20,000 lb · 110.0 %`); assert.ok(await p.$('.crLiftLbl .lv-over'));
  assert.match(await txt('#lfRes'), /110\.0 % of chart over the chart/);
  await settle(); await p.click('#bUndo'); await p.waitForTimeout(200); P = await proj(); near(P.picks[0].pick.x, 1030, 1e-6, 'undo: one step'); assert.equal((await labels())[0], 'P R 30.0 ft C 39,000 lb · 56.4 %');
  await settle(); await p.click('#bRedo'); await p.waitForTimeout(200); near((await engine()).R, e1.R, 1e-9, 'redo');
  await settle(); await p.click('#bUndo'); await p.waitForTimeout(200);
  ok(`pick point dragged: label and live card follow mid-drag (engine values), ${live[0]} live updates in ${live[1]} frames, stored = shown; one undo step; Undo / Redo`);

  // 4. move and rotate the crane
  await settle();
  let cor = await scr({ x: 1000, y: 2000 }), to = await scr({ x: 1000, y: 1990 });
  await p.mouse.move(cor.x, cor.y); await p.mouse.down(); for (let i = 1; i <= 10; i++) await p.mouse.move(cor.x, cor.y + (to.y - cor.y) * i / 10); await p.mouse.up(); await p.waitForTimeout(250);
  P = await proj(); near(P.setups[0].y, 1990, 0.5, 'moved 10 ft south'); const e2 = await engine(); near(e2.R, Math.hypot(1030 - P.setups[0].x, 2000 - P.setups[0].y), 1e-6); near(e2.sR, 2020 - P.setups[0].y, 0.01);
  const fl = await p.evaluate(() => CranePickPlace.layers.values().next().value.floats.map(f => CranePickMap.toFt(f.getLatLngs()[0][0])));
  assert.ok(fl.every(q => Math.abs(q.y - P.setups[0].y) < 14), 'the floats moved with the crane');
  const hd = await p.evaluate(() => { const h = CranePickPlace.layers.values().next().value.head.getLatLng(); return CranePickMap.toFt(h); });
  const hs = await scr(hd), tgt = await scr({ x: P.setups[0].x + 40, y: P.setups[0].y });   // turn it to face east
  await p.mouse.move(hs.x, hs.y); await p.mouse.down(); for (let i = 1; i <= 12; i++) await p.mouse.move(hs.x + (tgt.x - hs.x) * i / 12, hs.y + (tgt.y - hs.y) * i / 12); await p.mouse.up(); await p.waitForTimeout(250);
  P = await proj(); near(P.setups[0].heading, 90, 1.5, 'heading east'); near(+(await p.inputValue('#luHead')), P.setups[0].heading, 0.06);
  const body = await p.evaluate(() => CranePickPlace.layers.values().next().value.body.getLatLngs()[0].map(ll => CranePickMap.toFt(ll)));
  near(Math.max(...body.map(q => q.x)) - P.setups[0].x, 26, 0.5, 'the carrier front (26 ft) now points east');
  await settle(); await p.click('#bUndo'); await p.waitForTimeout(150); await settle(); await p.click('#bUndo'); await p.waitForTimeout(150);
  P = await proj(); near(P.setups[0].heading, 0, 1e-9); near(P.setups[0].y, 2000, 1e-6, 'two undo steps: rotate, move');
  ok('crane dragged by ✥ (radii follow; floats move with it) and rotated by ↻ (heading ≈ 90°, carrier front east); each one undo step');

  // 5. thresholds
  await setF('#lkLoad', 28000); assert.ok(await p.$('.crLiftLbl .lv-critical'), '30,000 / 39,000 = 76.9 % ≥ 75 %'); assert.match(await txt('#lfRes'), /76\.9 % of chart critical lift/);
  await setF('#lsCaution', 60); await setF('#lsCritical', 90); assert.match(await txt('#lfRes'), /76\.9 % of chart caution/); assert.ok(await p.$('.crLiftLbl .lv-caution'));
  await setF('#lsCaution', 75); await setF('#lsCritical', 75); await setF('#lkLoad', 20000);
  P = await proj(); assert.deepEqual(P.lift, { caution: 75, critical: 75, limit: 100, interp: false, path: 'uniform', obstClr: 2, tandem: 75 });   // path, obstClr: C3-2; tandem: C5
  await setF('#lkSN', 2075); assert.equal((await labels())[1], 'S R 75.0 ft not permitted'); assert.match(await txt('#lfRes'), /not permitted.*beyond the largest tabulated radius/);
  await setF('#lkSN', 2020);
  ok('thresholds are project inputs: 76.9 % = critical lift (≥ 75 %), caution with 60 / 90 %; R 75 ft beyond the chart = not permitted');

  // 6. chart group, interpolation, swing direction
  await setF('#lkPE', 1025); assert.equal((await engine()).C, 39000, 'R 25 → R_tab 30');
  assert.equal(await p.$eval('#lsInterp', e => e.disabled), false); await goTab('#lsInterp'); await p.check('#lsInterp'); await p.dispatchEvent('#lsInterp', 'change'); await p.waitForTimeout(150);
  assert.equal((await engine()).C, 48500, 'interpolated 58,000 + (39,000 − 58,000)(5 / 10)'); assert.match(await p.$eval('#lfSteps', e => e.textContent), /Linear interpolation/);
  await goTab('#lsInterp'); await p.uncheck('#lsInterp'); await p.dispatchEvent('#lsInterp', 'change'); await p.waitForTimeout(100); await setF('#lkPE', 1030);
  await goTab('input[name=lkSwing][value=cw]'); await p.check('input[name=lkSwing][value=cw]'); await p.dispatchEvent('input[name=lkSwing][value=cw]', 'change'); await p.waitForTimeout(150);
  assert.match(await txt('#lfRes'), /swing 270\.0° clockwise/); await goTab('input[name=lkSwing][value=short]'); await p.check('input[name=lkSwing][value=short]'); await p.dispatchEvent('input[name=lkSwing][value=short]', 'change'); await p.waitForTimeout(100);
  const rub = await p.$$eval('#luGroup option', a => a.find(o => /on rubber/.test(o.textContent)).value);
  await goTab('#luGroup'); await p.selectOption('#luGroup', rub); await p.waitForTimeout(200); await setF('#luBoom', 40);
  assert.equal(await p.evaluate(() => CranePickPlace.layers.values().next().value.floats.length), 0, 'on rubber: no floats');
  assert.match(await txt('#luCard'), /Zone charts: 360°, over front/);
  await goTab('#luGroup'); await p.selectOption('#luGroup', await p.$$eval('#luGroup option', a => a[0].value)); await p.waitForTimeout(150); await setF('#luBoom', 60);
  ok('interpolation (notes permit it) 39,000 → 48,500 lb at R 25 ft; clockwise swing 270°; chart group on rubber: no floats, zone charts listed');

  // 7. plan clearance to a power line
  await p.evaluate(() => CranePickApp.update(P => { P.items.push(CranePickModel.normItem({ type: 'power', name: 'OH 115 kV', kv: 115, pts: [{ x: 1040, y: 1900 }, { x: 1040, y: 2100 }] })); }, 'items')); await p.waitForTimeout(200);
  // C3-2: the 3D check replaces the plan buffer flag; the wire height is not entered, so the line is a vertical plane (the plan distance)
  let e3 = await engine(); assert.ok(e3.flags.some(f => /^stop:The boom comes within 10\.0 ft of "OH 115 kV" in 3D \(at the pick \(hoisting\)\) < D_min = 15 ft/.test(f)), e3.flags.join('|'));
  assert.match(await txt('#lfRes'), /within 10\.0 ft of "OH 115 kV" in 3D/); assert.ok(await p.$('.lfFlags li.lf-stop'));
  await setF('#lkPE', 1020); e3 = await engine(); assert.ok(!e3.flags.some(f => /^stop:.*OH 115/.test(f)), 'clear at 20 ft: ' + e3.flags.join(' | ')); assert.ok(e3.flags.some(f => /^info:"OH 115 kV": closest 20\.0 ft in 3D/.test(f)), 'the true minimum is reported'); assert.equal(await p.$('.lfFlags li.lf-stop'), null);
  await setF('#lkPE', 1030);
  ok('power-line clearance: a 115 kV line 10 ft from the pick (height not entered: a vertical plane) → red flag (D_min 15 ft, closest 10.0 ft, 3D check of C3-2); moving the pick 10 ft clears it');

  // 8. steps, save / reload, 390 px
  await p.click('#lfSteps summary'); await p.waitForTimeout(100);
  const st = await txt('#lfSteps'); for (const rx of [/Total load/, /Radius from the centre of rotation to the hook/, /Next longer tabulated boom length/, /Next larger tabulated radius/, /Chart capacity at L_tab and R_tab/, /Percent of chart/, /Largest radius along the swing path/]) assert.match(st, rx);
  assert.ok(!/NaN|undefined/.test(st));
  await shot('c2-2-steps');
  await p.reload(); await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(400);
  P = await proj(); assert.equal(P.setups.length, 1); assert.equal(P.picks.length, 1); assert.equal((await labels()).length, 2);
  await p.setViewportSize({ width: 390, height: 800 }); await p.click('#inTabs [data-itab=lifts]'); await p.waitForTimeout(300);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll');
  await shot('c2-2-390');
  ok('worked steps (W, R, L_tab, R_tab, C, %, R_max); reload keeps setups and picks; 390 px: no sideways scroll');
  assert.deepEqual(errs, []); ok('0 console errors');
  console.log(`\n${n} checks passed`);
} catch (e) { console.error('FAIL', e); console.error('console errors:', errs); process.exitCode = 1; }
finally { await b.close(); }
