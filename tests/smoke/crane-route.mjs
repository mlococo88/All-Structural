#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), C6: the trucking route in the app. Headless Chromium, file://, base map None. No crane chart data.
//   1. Route tab: draw a route by clicks (4 points, Enter ends it): the live card (length, turns, max off-tracking, gross weight), the
//      swept path on the map; the values are the engine's (CranePickRoute.evaluate);
//   2. an obstruction inside turn 1 (Site items, added through the app) -> a stop flag; dragging the turn's vertex away clears it: the
//      swept path and the live card change during the drag (live), one undo step at the end; Undo brings the flag back;
//   3. route marks drawn with the tools: an overhead line across the route (clearance height typed) and a posted bridge; the Route output
//      tab (turns table with the worked steps, overhead table, axle loads, bridge, staging); a power line crossing (Table T, spotter);
//   4. Report §Route (figure, tables, worked steps; no NaN / undefined); reload keeps the route; 390 px: no sideways scroll; 0 console errors.
//   SHOTS=<dir> node tests/smoke/crane-route.mjs
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/crane-pick/index.html');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 960, ls: { 'crane.ui': '{"base":"none","itab":"route"}' } });
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
const setF = async (sel, v) => { await p.fill(sel, String(v)); await p.dispatchEvent(sel, 'change'); await p.waitForTimeout(120); };
const txt = sel => p.$eval(sel, e => (e.innerText || e.textContent).replace(/\s+/g, ' '));
const scr = q => p.evaluate(q => { const m = CranePickMap.map, cp = m.latLngToContainerPoint(CranePickMap.toLL(q)), r = m.getContainer().getBoundingClientRect(); return { x: r.x + cp.x, y: r.y + cp.y }; }, q);
const clickFt = async q => { const s = await scr(q); await p.mouse.click(s.x, s.y); await p.waitForTimeout(80); };
const engine = () => p.evaluate(() => { const r = CranePickApp.P.routes[0], ev = CranePickRouteUI.evalRoute(r); return { L: ev.sim.pa.L, ot: ev.otMax, gross: ev.ax.gross, stop: ev.flags.filter(f => f.level === 'stop').map(f => f.text), turns: ev.turns.map(t => ({ r: t.r, ot: t.ot })) }; });
const swept = () => p.evaluate(() => { const g = CranePickRouteUI.layers.get(CranePickApp.P.routes[0].id); const pg = g.all.find(x => x.options && x.options.className === 'crRtSwept'); return JSON.stringify(pg.getLatLngs()[0][0]); });
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(400);
  await p.evaluate(() => CranePickMap.map.setZoom(19)); await p.waitForTimeout(200);
  const c = await p.evaluate(() => CranePickMap.toFt(CranePickMap.map.getCenter()));
  const P0 = [[-220, -80], [-20, -80], [-20, 80], [180, 80]].map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy }));
  // 1. draw
  await p.click('[data-rtool=route]'); assert.match(await p.textContent('#mbStatus'), /Route:/);
  for (const q of P0) await clickFt(q);
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  let R = (await p.evaluate(() => CranePickApp.P.routes))[0]; assert.equal(R.pts.length, 4);
  // 2026-11-17: a new route is a fitted alignment: the 4 clicks' corners are 2 intersection turns (r 50 ft default) = the same path; the
  // rest of this smoke checks the legacy mode ("each vertex is a turn"), unchanged since C6
  const fitOt = await p.evaluate(() => CranePickRouteUI.evalRoute(CranePickApp.P.routes[0]).otMax);
  assert.equal(R.mode, 'fit'); assert.match(await txt('#rtLive'), new RegExp(`0 curves \\+ 2 intersection turns \\(fitted alignment\\) · max off-tracking ${fitOt.toFixed(2)} ft`));
  await p.selectOption('#rtMode', 'legacy'); await p.waitForTimeout(300); R = (await p.evaluate(() => CranePickApp.P.routes))[0]; assert.equal(R.mode, 'legacy');
  let e = await engine(); assert.equal(e.turns.length, 2); near(e.turns[0].r, 50, 1e-9, 'default curve radius'); near(e.gross, 75000, 1e-6, 'default vehicle and load: 75,000 lb');
  assert.match(await txt('#rtLive'), new RegExp(`2 turns · max off-tracking ${e.ot.toFixed(2)} ft · gross 75,000 lb`));
  assert.ok(await p.$('.crRtSwept'), 'swept path drawn'); assert.equal((await p.$$('.crRtLbl')).length, 2, 'two turn labels');
  await shot('c6-route-map');
  near(e.ot, fitOt, 1e-9, 'fitted (2 intersection turns) = legacy (2 vertices) for these clicks');
  ok(`route drawn by 4 clicks: fitted = 2 intersection turns; switched to legacy: ${e.L.toFixed(1)} ft, 2 turns (r 50 ft default), max off-tracking ${e.ot.toFixed(2)} ft (= fitted), gross 75,000 lb; swept path and turn labels on the map`);

  // 2. obstruction inside turn 1, drag the vertex away
  await p.evaluate(q => { const it = CranePickModel.normItem({ type: 'obst', name: 'Pier 1', height: 20, pts: [{ x: q.x - 22, y: q.y + 14 }, { x: q.x - 14, y: q.y + 14 }, { x: q.x - 14, y: q.y + 22 }, { x: q.x - 22, y: q.y + 22 }] }); CranePickApp.update(P => { P.items.push(it); }, 'items'); }, P0[1]);
  await p.waitForTimeout(300); await p.click('#inTabs [data-itab=route]'); await p.evaluate(() => CranePickRouteUI.select(CranePickApp.P.routes[0].id)); await p.waitForTimeout(300);
  e = await engine(); assert.ok(e.stop.some(s => /obstruction "Pier 1"/.test(s)), e.stop.join(' | '));
  assert.match(await txt('#rtLive'), /meets the obstruction "Pier 1"/);
  const steps0 = await p.evaluate(() => CranePickApp.history ? CranePickApp.history.canUndo && CranePickApp.history.canUndo() : null);
  const pre = (await p.evaluate(() => CranePickApp.P.routes))[0].pts[1];
  const sw0 = await swept(), live0 = await txt('#rtLive');
  const h = await scr(P0[1]); await p.mouse.move(h.x, h.y); await p.mouse.down();
  const to = await scr({ x: P0[1].x + 60, y: P0[1].y });
  for (let k = 1; k <= 10; k++) { await p.mouse.move(h.x + (to.x - h.x) * k / 10, h.y + (to.y - h.y) * k / 10); await p.waitForTimeout(40); }
  const swMid = await swept(), liveMid = await txt('#rtLive');
  assert.notEqual(swMid, sw0, 'the swept path moves during the drag'); assert.notEqual(liveMid, live0, 'the live card follows the drag');
  await p.mouse.up(); await p.waitForTimeout(500);
  e = await engine(); assert.ok(!e.stop.some(s => /Pier 1/.test(s)), 'the conflict is gone after the drag');
  R = (await p.evaluate(() => CranePickApp.P.routes))[0]; near(R.pts[1].x, P0[1].x + 60, 1.5); near(R.pts[1].y, P0[1].y, 1.5);
  await p.click('#bUndo'); await p.waitForTimeout(500);
  R = (await p.evaluate(() => CranePickApp.P.routes))[0]; near(R.pts[1].x, pre.x, 1e-6, 'one undo step restores the vertex'); near(R.pts[1].y, pre.y, 1e-6); e = await engine(); assert.ok(e.stop.some(s => /Pier 1/.test(s)));
  await p.click('#bRedo'); await p.waitForTimeout(500); void steps0;
  ok('obstruction inside turn 1 -> stop flag; dragging the vertex: the swept path and the live card change mid-drag, the flag clears; one undo step brings it back (redo)');

  // 3. marks and the Route tab
  await p.evaluate(() => CranePickRouteUI.select(CranePickApp.P.routes[0].id)); await p.waitForTimeout(200);
  await p.click('[data-rtool=ohLn]'); await clickFt({ x: c.x - 120, y: c.y - 100 }); await clickFt({ x: c.x - 120, y: c.y - 60 }); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  await setF('#mkName', 'Sign bridge'); await setF('#mk_h', 11.5);
  await p.click('[data-rtool=bridge]'); await clickFt({ x: c.x + 60, y: c.y + 80 }); await clickFt({ x: c.x + 120, y: c.y + 80 }); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  await setF('#mk_w', 30); await setF('#mp_gross', 36);
  await p.evaluate(q => { const it = CranePickModel.normItem({ type: 'power', name: 'OH 13.8 kV', kv: 13.8, height: 24, pts: [{ x: q.x + 100, y: q.y + 40 }, { x: q.x + 100, y: q.y + 140 }] }); CranePickApp.update(P => { P.items.push(it); }, 'items'); }, c);
  await p.waitForTimeout(300);
  await p.click('#tabBar [data-otab=route]'); await p.waitForTimeout(400);
  const out = await txt('#out [data-opane=route]');
  assert.match(out, /Turns \(swept path\).*T1.*T2/); assert.match(out, /Sign bridge.*overhead.*11\.50.*11\.00.*0\.50.*warn/);
  assert.match(out, /OH 13\.8 kV.*power line.*24\.00.*\(D_T 6\).*warn/); assert.match(out, /Posted bridge "Posted bridge 1": gross posting 36\.0 t exceeded \(37\.50 t\)/);
  assert.match(out, /Axle loads \(statics\).*Steer axle.*13,431.*Drive group.*35,194.*Trailer rear group.*26,375/);
  assert.match(out, /Conflicts with the site The vehicle \/ load passes within the plan buffer of "OH 13.8 kV"/);
  await p.click('#out [data-opane=route] a[href$="-t1"]'); await p.waitForTimeout(200);
  assert.ok(await p.$eval('#out details[id$="-t1"]', d => d.open)); assert.match(await txt('#out details[id$="-t1"]'), /Steady-state off-tracking.*Max off-tracking in the turn.*Inside radius/);
  await shot('c6-route-tab');
  ok('overhead line (11.50 ft: 0.50 ft over an 11.00 ft load top, warn), posted bridge (36 t < 37.50 t: stop), power line (Table T 6 ft, spotter); Route tab tables, turn link opens its worked steps');

  // C5 link: the load from a girder lift, staging at its pick pose
  await p.evaluate(() => { const t = CranePickModel.normTandem({ name: 'G3 tandem', girder: { L: 60, W: 52000, H: 5.5, B: 2 }, pick: { x: 0, y: 0, h: 0 } }); CranePickApp.update(P => { P.tandems.push(t); }, 'tandem'); });
  await p.click('#inTabs [data-itab=route]'); await p.evaluate(() => CranePickRouteUI.select(CranePickApp.P.routes[0].id)); await p.waitForTimeout(300);
  await p.selectOption('#rtTandem', { label: 'G3 tandem' }); await p.waitForTimeout(400);
  assert.match(await txt('#rtCard'), /From the girder object of "G3 tandem": L = 60\.00 ft, W = 52,000 lb, width 2\.00 ft, depth 5\.50 ft, CG 30\.00 ft from the front end/);
  e = await engine(); near(e.gross, 75000 - 40000 + 52000, 1e-6, 'gross with the girder');
  assert.match(await txt('#rtLive'), /Staging: the girder on the truck is [\d,.]+ ft and/);
  await p.click('[data-ra=totandem]'); await p.waitForTimeout(400);
  const st = await p.evaluate(() => { const ev = CranePickRouteUI.evalRoute(CranePickApp.P.routes[0]); return { off: ev.stage.off, dh: ev.stage.dh, pose: CranePickApp.P.tandems[0].pick }; });
  near(st.off, 0, 1e-6); near(st.dh, 0, 1e-6);
  await shot('c6-route-girder');
  ok('C5 link: the route\'s load from the girder lift (L, W, width, depth, CG), the gross follows; staging offset shown; "Move the pick pose" puts the lift\'s pick pose on the girder on the truck (0 ft, 0°)');

  // 4. Report, reload, 390 px
  await p.click('#tabBar [data-otab=rpt]'); await p.waitForTimeout(900);
  const rp = await p.$eval('#out [data-opane=rpt]', e => e.textContent.replace(/\s+/g, ' '));   // textContent: every section, open or closed
  assert.match(rp, /Route/); assert.match(rp, /Route 1: turn 1/); assert.match(rp, /Route 1: axle loads/); assert.match(rp, /Route 1: staging/); assert.ok(!/NaN|undefined|\[\[/.test(rp), 'no NaN / undefined / unresolved keys');
  assert.ok(await p.$('#out [data-opane=rpt] svg'), 'figure');
  await shot('c6-route-report');
  await p.reload(); await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(500);
  const after = await p.evaluate(() => ({ n: CranePickApp.P.routes.length, m: CranePickApp.P.routeMarks.length, h: CranePickApp.P.routeMarks[0].h }));
  assert.deepEqual(after, { n: 1, m: 2, h: 11.5 });
  await p.click('#tabBar [data-otab=plan]'); await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(500);
  await p.click('#inTabs [data-itab=route]'); await p.evaluate(() => CranePickRouteUI.select(CranePickApp.P.routes[0].id)); await p.waitForTimeout(400);
  const sx = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); assert.ok(sx <= 0, 'no sideways scroll: ' + sx);
  await p.evaluate(() => document.getElementById('rtCard').scrollIntoView()); await shot('c6-route-390');
  assert.deepEqual(errs, []);
  ok('Report §Route (figure, turns, axle loads; no NaN / undefined); reload keeps the route and the marks; 390 px: no sideways scroll; 0 console errors');
  console.log(`crane-route: ${n} checks ok`);
} finally { await b.close(); }
