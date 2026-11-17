#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), 2026-11-17: the route / girder geometry link, the height stack-up and the vehicle-and-load
// drawing. Headless Chromium, file://, base map None. No crane chart data (a girder lift with no cranes is enough for the load).
//   1. a route linked to a girder lift, the vehicle a steerable rear dolly with L2 from the load: the route card shows
//      L2 = L − a_F − r (girder 120 ft: 112 ft), the Route tab "Vehicle and load" figures render, their dimensions = the engine's;
//   2. the girder shortened to 100 ft (Girder lifts data): L2 → 92 ft and the off-tracking changes (card, figures, engine);
//      L2 "entered" overrides it;
//   3. height stack-up: blocking typed → the card's "Height of the load top above the road" line, the overhead clearance changes;
//      a vehicle height above the load top → the overhead flag uses it (stop);
//   4. semi with the girder: deck length and the overhang / cab-reach flags; the project rear-overhang limit;
//   5. Report §Route has the two figures and the geometry steps; the Drawings vehicle sheet renders; the map vehicle has its tyres;
//   6. 390 px: no page-wide horizontal scroll; 0 console errors.
//   SHOTS=<dir> node tests/smoke/crane-truck.mjs
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/crane-pick/index.html');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 960, ls: { 'crane.ui': '{"base":"none","itab":"route"}' } });
const shot = async (nm, sel) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); if (sel) { const e = await p.$(sel); if (e) { await e.screenshot({ path: path.join(SHOTS, nm + '.png') }); return; } } await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); };
const setF = async (sel, v) => { await p.fill(sel, String(v)); await p.dispatchEvent(sel, 'change'); await p.waitForTimeout(150); };
const txt = sel => p.$eval(sel, e => (e.innerText || e.textContent).replace(/\s+/g, ' '));
const eng = () => p.evaluate(() => { const r = CranePickApp.P.routes[0], ev = CranePickRouteUI.evalRoute(r); return { L2: ev.sim.v.L2, src: ev.sim.v.L2src, ot: ev.otMax, LT: ev.oh.LT, H: ev.oh.Htop, Lov: ev.geo.Lov, f: ev.ax.f, ax: ev.ax.groups.map(g => [g.k, g.load]), oh: ev.oh.list.map(o => ({ c: o.c, lvl: o.flag && o.flag.level })), geo: ev.flags.filter(f => f.kind === 'geo').map(f => f.level + ': ' + f.text) }; });
const figDims = sel => p.$$eval(sel + ' [data-v]', es => Object.fromEntries(es.map(e => [e.dataset.v, +e.dataset.val])));
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(400);
  const c = await p.evaluate(() => CranePickMap.toFt(CranePickMap.map.getCenter()));
  await p.evaluate(c => { const M = CranePickModel;
    CranePickApp.update(P => {
      P.tandems.push(M.normTandem({ id: 't1', name: 'G4', type: 'single', girder: { L: 120, W: 90000, H: 7, B: 2 }, pick: { x: c.x + 300, y: c.y + 200, h: 90 } }));
      const r = M.normRoute({ id: 'r1', name: 'Route 1', pts: [{ x: c.x - 250, y: c.y - 60 }, { x: c.x + 50, y: c.y - 60 }, { x: c.x + 50, y: c.y + 240 }], rad: [null, 140, null], tandemId: 't1',
        veh: { type: 'dolly', L2src: 'load', Rmin: 45 }, load: { r: 5, fF: 3 } });
      r.src = { kind: 'click', at: '', names: [], against: [], cl: [], snaps: [] }; P.routes.push(r);
      P.routeMarks.push(M.normRouteMark({ id: 'm1', type: 'overhead', name: 'Sign bridge', pts: [{ x: c.x - 150, y: c.y - 90 }, { x: c.x - 150, y: c.y - 30 }], h: 14 }));
    }, 'route'); CranePickRouteUI.select('r1'); }, c);
  await p.waitForTimeout(500);
  // 1. L2 from the girder, the card, the Route tab figures = the engine
  let e = await eng(); near(e.L2, 112, 1e-9, 'L2 = 120 − 3 − 5'); assert.equal(e.src, 'load');
  assert.match(await txt('#rtGeo'), /L2 = L − aF − r = 120\.00 − 3\.00 − 5\.00 = 112\.00 ft \(from the load: girder of "G4"\)/);
  assert.equal(await p.$eval('#rtL2src', s => s.value), 'load'); assert.equal(await p.$('#rv_L2'), null, 'no L2 input while it comes from the load');
  assert.match(await txt('#rtHeight'), /Height of the load top above the road = deck 5\.00 \+ blocking 0\.00 \+ load 7\.00 = 12\.00 ft/);
  await shot('truck-card', '#rtCard');
  await p.click('#rtCard [data-ra=veh]'); await p.waitForTimeout(500);
  assert.equal(await p.evaluate(() => CranePickApp.ui.otab), 'route');
  const sel = '#rt-r1-veh'; await p.waitForSelector(sel + ' svg.tgFig');
  let d = await figDims(sel); near(d.L2, e.L2, 1e-9, 'figure L2'); near(d.L, 120, 1e-9, 'figure L'); near(d.LT, e.LT, 1e-9, 'figure load top'); near(d.Lov, e.Lov, 1e-9, 'figure overall'); near(d.f, e.f, 1e-9, 'figure aF');
  e.ax.forEach(([k, v]) => near(d['ax' + k], v, 1e-6, 'axle group ' + k));
  assert.equal(await p.$$eval(sel + ' svg.tgFig', s => s.length), 2, 'plan and side elevation'); assert.ok(await p.$(sel + ' .tg-scale'), 'scale bar');
  const tyres = await p.$$eval(sel + ' svg.tgFig:first-of-type .tg-tyre', x => x.length); assert.ok(tyres >= 12, 'tyres ' + tyres);
  await shot('truck-routetab', sel);
  ok(`dolly, L2 from the girder: 120 − 3 − 5 = ${e.L2} ft (card, select "from the load", no L2 input); Route tab plan + side to scale: dimensions = engine (L2, L, a_F, load top ${e.LT}, overall ${e.Lov.toFixed(2)} ft, axle groups), ${tyres} tyres`);

  // 2. the girder shortened → L2 and the off-tracking follow; "entered" overrides
  const ot0 = e.ot;
  await p.evaluate(() => CranePickApp.update(P => { P.tandems[0].girder.L = 100; }, 'tandem')); await p.waitForTimeout(400);
  await p.evaluate(() => { CranePickApp.showITab('route'); CranePickRouteUI.select('r1'); }); await p.waitForTimeout(300);
  e = await eng(); near(e.L2, 92, 1e-9, 'L2 after 100 ft'); assert.ok(Math.abs(e.ot - ot0) > 1, `off-tracking ${ot0} → ${e.ot}`);
  assert.match(await txt('#rtGeo'), /100\.00 − 3\.00 − 5\.00 = 92\.00 ft/); assert.match(await txt('#rtLive'), new RegExp('max off-tracking ' + e.ot.toFixed(2).replace('.', '\\.') + ' ft'));
  await p.evaluate(() => CranePickApp.showOTab('route')); await p.waitForTimeout(300); d = await figDims(sel); near(d.L2, 92, 1e-9, 'figure L2 after');
  await p.selectOption('#rtL2src', 'entered'); await p.waitForTimeout(300); await setF('#rv_L2', 70); e = await eng(); near(e.L2, 70, 0, 'entered'); assert.equal(e.src, 'entered');
  await p.selectOption('#rtL2src', 'load'); await p.waitForTimeout(300); e = await eng(); near(e.L2, 92, 1e-9, 'back to the load');
  ok(`girder 120 → 100 ft: L2 112 → 92 ft, max off-tracking ${ot0.toFixed(2)} → ${e.ot.toFixed(2)} ft (card, figure, engine); L2 "entered" 70 ft overrides it`);

  // 3. height stack-up
  let o = e.oh[0]; near(o.c, 14 - 12, 1e-9, 'clearance before blocking');
  await setF('#rl_hB', 0.75); e = await eng(); near(e.LT, 12.75, 1e-9); near(e.oh[0].c, 1.25, 1e-9);
  assert.match(await txt('#rtHeight'), /deck 5\.00 \+ blocking 0\.75 \+ load 7\.00 = 12\.75 ft · vehicle height not entered/);
  await setF('#rv_hV', 14.5); e = await eng(); near(e.H, 14.5, 1e-9); near(e.oh[0].c, -0.5, 1e-9); assert.equal(e.oh[0].lvl, 'stop');
  assert.match(await txt('#rtHeight'), /overhead checks use max\(vehicle 14\.50, load top 12\.75\) = 14\.50 ft/); assert.match(await txt('#rtLive'), /the vehicle top \(14\.50 ft\) is 0\.50 ft above the clearance/);
  await setF('#rv_hV', ''); e = await eng(); near(e.H, 12.75, 1e-9);
  ok('height stack-up: blocking 0.75 → load top 12.75 ft (card line), clearance 2.00 → 1.25 ft; vehicle height 14.50 → the overhead check uses it (stop, "vehicle top"); cleared → back');

  // 4. semi: deck fit, front reach, the project rear-overhang limit
  await p.selectOption('#rtType', 'semi'); await p.waitForTimeout(300); await setF('#rv_L2', '');
  e = await eng(); near(e.L2, 40, 0, 'semi: the default L2');
  assert.ok(e.geo.some(t => /^info: The load \(100\.00 ft\) overhangs the 47\.00 ft deck by 52\.00 ft at the front and by 1\.00 ft at the rear/.test(t)), e.geo.join(' | '));
  assert.ok(e.geo.some(t => /^warn: The load front \(55\.00 ft ahead of the kingpin\) reaches the back of the cab/.test(t)), e.geo.join(' | '));
  await setF('#rv_L2', 80); await setF('#rl_r', 16); e = await eng();
  assert.ok(e.geo.some(t => /^warn: Rear overhang 12\.00 ft beyond the rear of the deck is more than the project limit 10\.00 ft \(default\)/.test(t)), e.geo.join(' | '));
  await setF('#rtOhRear', 15); e = await eng(); assert.ok(!e.geo.some(t => /Rear overhang/.test(t)), 'project limit 15');
  assert.equal(await p.evaluate(() => CranePickApp.P.routeSet.ohRear), 15);
  ok('semi with the 100 ft girder: deck 47 ft (overhang 52 / 1 ft, info), load front reaches the cab (warn: cab assumed); L2 80, r 16: rear overhang 12 > 10 ft (warn); project limit 15 ft clears it');
  await setF('#rv_L2', 60); await setF('#rl_r', 4);

  // 5. Report, Drawings, the map vehicle
  await p.click('#tabBar [data-otab=rpt]'); await p.waitForTimeout(900);
  const rp = await p.$eval('#out [data-opane=rpt]', x => x.textContent.replace(/\s+/g, ' '));
  assert.match(rp, /Route 1: vehicle and load in plan, to scale/); assert.match(rp, /Route 1: side elevation, to scale/); assert.match(rp, /Route 1: vehicle and load geometry/); assert.match(rp, /Load top above the road \(deck \+ blocking \+ load\)/);
  assert.ok(!/NaN|undefined|\[\[/.test(rp), 'no NaN / undefined / unresolved keys'); assert.ok((await p.$$('#out [data-opane=rpt] svg.tgFig')).length >= 2, 'report figures');
  await shot('truck-report', '#out [data-opane=rpt] svg.tgFig');
  await p.click('#tabBar [data-otab=dwg]'); await p.waitForSelector('#dwg_sheet');
  const ids = await p.$$eval('#dwg_sheet option', o => o.map(x => x.value)); assert.ok(ids.indexOf('routeveh-0') === ids.indexOf('route-0') + 1, ids.join());
  await p.selectOption('#dwg_sheet', 'routeveh-0'); await p.waitForTimeout(300);
  const sv = await p.$eval('.dwg-box svg', s => s.textContent); assert.match(sv, /VEHICLE AND LOAD/); assert.match(sv, /L2 60\.00 FT/); assert.match(sv, /LOAD TOP 12\.75 FT/); assert.match(sv, /0 - |10 FT|20 FT/);
  await shot('truck-sheet', '.dwg-box');
  const rs = await p.$eval('#dwg_sheet', s => { s.value = 'route-0'; s.dispatchEvent(new Event('change')); return true; }); await p.waitForTimeout(300); assert.match(await p.$eval('.dwg-box svg', s => s.textContent), /VEHICLE AND LOAD/);
  await p.click('#tabBar [data-otab=plan]'); await p.waitForTimeout(500);
  const mv = await p.evaluate(() => { const g = CranePickRouteUI.layers.get('r1'); return { veh: g.all.filter(x => x.options && /crRtVeh/.test(x.options.className || '')).length, tyre: g.all.filter(x => x.options && x.options.className === 'crRtTyre').length }; });
  assert.ok(mv.veh >= 3 && mv.tyre === 1, JSON.stringify(mv));
  await p.evaluate(() => { const r = CranePickApp.P.routes[0], ev = CranePickRouteUI.evalRoute(r), q = ev.sim.samples[ev.sim.samples.length - 1]; CranePickMap.map.setView(CranePickMap.toLL(q.p.H), 19); }); await p.waitForTimeout(400);
  await shot('truck-map');
  ok(`Report §Route: plan + side figures and the geometry steps (no NaN); Drawings: "route-0" then "routeveh-0" (VEHICLE AND LOAD, L2 60.00, load top 12.75, scale bar; the route sheet points to it); map vehicle: ${mv.veh} outlines + tyres`);

  // 6. 390 px, console
  await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => CranePickApp.showOTab('route')); await p.waitForTimeout(500);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth); assert.ok(sw <= 392, 'scrollWidth ' + sw);
  await shot('truck-390');
  assert.deepEqual(errs, []);
  ok('390 px: no sideways scroll; 0 console errors');
  console.log(`crane-truck: ${n} checks ok`);
} catch (err) { console.error(err); console.error('console errors:', errs); process.exitCode = 1; } finally { await b.close(); }
