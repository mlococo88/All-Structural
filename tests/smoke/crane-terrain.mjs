#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), C8: preliminary terrain (USGS 3DEP) in the app. Headless Chromium, file://, base map None. Only the
// SYNTHETIC fake crane (tests/smoke/crane-fake-wheeled.json). The USGS service is MOCKED (page routing): a made-up surface, flat (el.
// 100.00 ft) west of E 1,040 and rising 5 % eastward from there, answered in metres as getSamples does.
//   1. offline (the host not answered): "Fetch terrain for this site" -> the clear message; the rest of the app still works;
//   2. mocked: the fetch fills the grid (cached in IndexedDB), contours and the slope overlay are drawn, the cursor box shows the ground;
//   3. the crane's level badge is green on the flat, turns amber while it is dragged onto the slope (mid-drag), the Terrain tab's values
//      = the engine's; "use terrain": the crane pad = the levelling datum (heights);
//   4. a route across the slope: the profile chart and its grade (5 %); Report §Terrain (statement, no NaN); reload keeps the grid (cache);
//      390 px: no sideways scroll; 0 console errors.
//   SHOTS=<dir> node tests/smoke/crane-terrain.mjs
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/crane-pick/index.html');
const FW = path.join(REPO, 'tests/smoke/crane-fake-wheeled.json');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 960, ls: { 'crane.ui': '{"base":"none","itab":"cranes"}' } });
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
const setF = async (sel, v) => { await p.fill(sel, String(v)); await p.dispatchEvent(sel, 'change'); await p.waitForTimeout(80); };
const txt = sel => p.$eval(sel, e => (e.innerText || e.textContent).replace(/\s+/g, ' '));
const scr = q => p.evaluate(q => { const m = CranePickMap.map, cp = m.latLngToContainerPoint(CranePickMap.toLL(q)), r = m.getContainer().getBoundingClientRect(); return { x: r.x + cp.x, y: r.y + cp.y }; }, q);
const surf = (E) => E < 1040 ? 100 : 100 + 0.05 * (E - 1040);   // ft
let calls = 0, aff = null;
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(300);
  await p.setInputFiles('#crFiles', [FW]); await p.waitForFunction(() => /1 crane loaded/.test(document.querySelector('#crStatus').textContent));
  await p.click('[data-ca=add]'); await p.waitForTimeout(200);
  const cid = await p.evaluate(() => CranePickApp.P.cranes[0].id);
  await p.click(`[data-ca=place][data-id="${cid}"]`); await p.waitForTimeout(400);
  await setF('#luE', 1000); await setF('#luN', 2000); await setF('#luHead', 0); await setF('#luBoom', 60);
  await setF('#lkPE', 1000); await setF('#lkPN', 2030); await setF('#lkSE', 970); await setF('#lkSN', 2000);
  await p.evaluate(() => CranePickMap.fit([{ x: 900, y: 1900 }, { x: 1200, y: 2150 }])); await p.waitForTimeout(200);
  // the affine map lat/lng -> site frame near the crane (for the mock), from the page's own projection
  aff = await p.evaluate(() => { const o = CranePickMap.toLL({ x: 1000, y: 2000 }), d = 1e-4, fe = CranePickMap.toFt({ lat: o.lat, lng: o.lng + d }), fn = CranePickMap.toFt({ lat: o.lat + d, lng: o.lng }), f0 = CranePickMap.toFt(o);
    return { lat0: o.lat, lng0: o.lng, x0: f0.x, y0: f0.y, ex: (fe.x - f0.x) / d, ey: (fe.y - f0.y) / d, nx: (fn.x - f0.x) / d, ny: (fn.y - f0.y) / d, k: CranePickTerrain.FT_PER_M }; });
  await p.evaluate(() => { const it = CranePickModel.normItem({ type: 'label', text: 'East limit', pts: [{ x: 1250, y: 2150 }] }); CranePickApp.update(P => { P.items.push(it); }, 'items'); });   // the site extent reaches E 1,300
  // 1. offline
  await p.click('#inTabs [data-itab=terrain]'); await p.selectOption('#trExt', 'site'); await p.waitForTimeout(100);
  await p.click('#trFetch'); await p.waitForFunction(() => /Could not reach the USGS 3DEP elevation service/.test((document.querySelector('#trErr') || {}).textContent || ''), null, { timeout: 20000 });
  assert.match(await txt('#notices'), /Could not reach the USGS 3DEP elevation service.*everything else in the app still works/);
  await p.click('#tabBar [data-otab=picks]'); await p.waitForTimeout(200); assert.match(await txt('#pkTbl'), /Pick 1/); await p.click('#tabBar [data-otab=plan]');
  await shot('c8-offline');
  ok('offline: the clear message (notice and the Terrain tab); the Picks tab still works');

  // 2. mocked USGS getSamples
  await p.route('https://elevation.nationalmap.gov/**', async r => {
    calls++; const body = new URLSearchParams(r.request().postData() || ''), g = JSON.parse(body.get('geometry'));
    assert.equal(body.get('geometryType'), 'esriGeometryMultipoint'); assert.equal(g.spatialReference.wkid, 4326);
    const samples = g.points.map(([lng, lat], i) => { const E = aff.x0 + aff.ex * (lng - aff.lng0) + aff.nx * (lat - aff.lat0); return { location: { x: lng, y: lat }, locationId: i, value: String(surf(E) / aff.k), rasterId: 1, resolution: 1 }; });
    await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ samples }) });
  });
  await p.click('#trFetch'); await p.waitForFunction(() => CranePickTerrainUI.grid && CranePickApp.P.terrain.src, null, { timeout: 30000 }); await p.waitForTimeout(400);
  const src = await p.evaluate(() => CranePickApp.P.terrain.src); assert.ok(src.n > 100 && calls >= 1 && src.dx === 5 && src.nodata === 0, JSON.stringify(src) + ' calls ' + calls);
  assert.match(await txt('[data-pane=terrain]'), /USGS 3DEP.*Fetched.*cached/);
  near(await p.evaluate(() => CranePickTerrain.at(CranePickTerrainUI.grid, 1100, 2000)), 103, 0.01, 'grid at E 1100 = 103.00 (5 % above 1040)');
  assert.ok(await p.evaluate(() => !!CranePickTerrainUI.layers.c), 'contours drawn');
  await p.check('#trShowS'); await p.waitForTimeout(200); assert.ok(await p.evaluate(() => !!CranePickTerrainUI.layers.s), 'slope overlay drawn');
  const m = await scr({ x: 1100, y: 2050 }); await p.mouse.move(m.x, m.y); await p.waitForTimeout(150);
  assert.match(await txt('#crCoord'), /Ground el\. 10[23]\.\d\d ft NAVD 88 \(preliminary, USGS 3DEP\)/);
  await shot('c8-terrain-map');
  ok(`mocked getSamples (${calls} requests, ${src.n} points, 5 ft): grid = the made-up surface; contours and slope overlay drawn; cursor elevation`);

  // 3. the level badge while dragging onto the slope
  const badge = () => p.$eval('.lvb[data-lvb]', e => ({ cls: e.className, t: e.textContent }));
  let bd = await badge(); assert.match(bd.cls, /lvb-ok/); assert.match(bd.t, /Level 0\.00 %/);
  const cor = await scr({ x: 1000, y: 2000 }), to = await scr({ x: 1100, y: 2000 }); const seen = [];
  await p.mouse.move(cor.x, cor.y); await p.mouse.down();
  for (let i = 1; i <= 12; i++) { await p.mouse.move(cor.x + (to.x - cor.x) * i / 12, cor.y); await p.waitForTimeout(40); seen.push((await badge()).cls); }
  assert.ok(seen.some(c => /lvb-warn/.test(c)), 'the badge turns amber mid-drag: ' + seen.join(' '));
  await p.mouse.up(); await p.waitForTimeout(400);
  const e = await p.evaluate(() => { const u = CranePickApp.P.setups[0], r = CranePickTerrainUI.levelOf(u), ev = CranePickPlace.evalPick(CranePickApp.P.picks[0]); return { x: u.x, sMax: r.sMax, sL: r.sL, sT: r.sT, status: r.status, datum: r.datum, bMax: r.bMax, zp: ev.elev.pick.zp, flags: ev.flags.map(f => f.text) }; });
  near(e.x, 1100, 1, 'moved east'); near(Math.abs(e.sT), 5, 2e-3, 'transverse slope 5 % (heading 0: across = east-west)'); near(e.sL, 0, 2e-3, 's_L ≈ 0 (the mock maps lat / lng to E linearly)'); assert.equal(e.status, 'warn');
  near(e.zp, e.datum, 1e-9, 'use terrain: the crane pad = the levelling datum'); assert.ok(e.flags.some(f => /Crane levelness.*exceeds the level tolerance 1\.00 %/.test(f)));
  await p.click('#tabBar [data-otab=terrain]'); await p.waitForSelector('.trSetup');
  assert.match(await txt('.trSetup'), new RegExp(`s_?max ${e.sMax.toFixed(2)} % \\(tolerance 1\\.00 %\\)`));
  await p.click('.trSetup details summary'); await p.waitForTimeout(100); assert.match(await txt('.trSetup details'), /Maximum slope across the footprint.*Blocking/);
  await shot('c8-terrain-tab');
  await p.click('#tabBar [data-otab=plan]'); await p.waitForTimeout(200); await shot('c8-badge-slope');
  ok(`level badge green on the flat, amber mid-drag onto the 5 % slope; s_T ${e.sT.toFixed(2)} %, blocking ${(e.bMax * 12).toFixed(1)} in; pad = datum ${e.datum.toFixed(2)} ft; Terrain tab = engine`);

  // 4. route profile, Report, reload, 390 px
  await p.evaluate(() => { const r = CranePickModel.normRoute({ name: 'Haul road', pts: [{ x: 900, y: 2100 }, { x: 1200, y: 2100 }] }); CranePickApp.update(P => { P.routes.push(r); }, 'routes'); }); await p.waitForTimeout(300);
  await p.click('#tabBar [data-otab=terrain]'); await p.waitForSelector('.trRoute svg');
  const pr = await p.evaluate(() => { const q = CranePickTerrainUI.profileOf(CranePickApp.P.routes[0]); return { g: q.gov.g, sag: q.sag.map(x => x.s), crest: q.crest.length, clr: q.clr.min }; });
  assert.equal(pr.sag.length, 1); near(pr.sag[0], 140, 3, 'the sag (grade break 0 -> 5 %) at E 1,040 = sta. 140'); assert.equal(pr.crest, 0); assert.match(await txt('.trRoute'), /Sags: sta\. 14\d/);
  near(pr.g, 5, 2e-3, 'steepest grade 5 %'); assert.match(await txt('.trRoute'), /tangent 1.*5\.00/);
  await p.$eval('.trRoute', e => e.scrollIntoView({ block: 'start' })); await p.waitForTimeout(150); await shot('c8-route-profile');
  ok(`route profile: chart drawn, steepest grade ${pr.g.toFixed(2)} %, sag at sta. ${pr.sag[0].toFixed(0)}, least clearance ${pr.clr.toFixed(2)} ft`);
  await p.click('#tabBar [data-otab=rpt]'); await p.waitForTimeout(800);
  await p.evaluate(() => CranePickReportUI.view.jump('terrain')); await p.waitForTimeout(600);
  const rp = await txt('#out [data-opane=rpt]'); assert.match(rp, /Terrain.*not adequate to certify crane levelness.*survey data governs/); assert.ok(!/NaN|undefined/.test(rp));
  await shot('c8-report');
  await p.click('#tabBar [data-otab=picks]'); await p.waitForTimeout(300); assert.match(await txt('#pkTbl'), new RegExp(`Level \\(terrain\\).*${Math.abs(e.sMax).toFixed(2)} % · max block ${(e.bMax * 12).toFixed(1)} in`));
  await p.click('#tabBar [data-otab=summary]'); await p.waitForSelector('#smTbl'); assert.match(await txt('#smTbl'), new RegExp(`Level \\(terrain\\).*${Math.abs(e.sMax).toFixed(2)} % · block ${(e.bMax * 12).toFixed(1)} in`));
  assert.match(await txt('#smRoutes'), /Max grade · ground clearance \(terrain\).*5\.00 % · \d+\.\d\d ft/);
  ok('Report §Terrain: the statement, no NaN / undefined; Picks and Summary tables: the levelness column; Summary routes: max grade and ground clearance');
  await p.reload(); await p.waitForSelector('[data-sp=chip]'); await p.waitForFunction(() => !!CranePickTerrainUI.grid, null, { timeout: 15000 });
  assert.equal(await p.evaluate(() => CranePickApp.P.terrain.src.id), src.id); assert.match((await p.$eval('.lvb[data-lvb]', e => e.className)), /lvb-warn/);
  ok('reload: the grid comes back from this browser\'s cache (IndexedDB); the badge is drawn again');
  await p.setViewportSize({ width: 390, height: 860 }); await p.waitForTimeout(300); await p.click('#inTabs [data-itab=terrain]'); await p.click('#tabBar [data-otab=terrain]'); await p.waitForTimeout(300);
  const sw = await p.evaluate(() => document.scrollingElement.scrollWidth); assert.ok(sw <= 391, 'no sideways scroll at 390 px: ' + sw);
  await shot('c8-390');
  assert.deepEqual(errs.filter(x => !/ERR_FAILED|net::/.test(x)), [], 'console errors'); ok('390 px: no sideways scroll; 0 console errors');
  console.log(`\n${n} checks passed`);
} catch (e) { console.error(e); if (errs.length) console.error('console:', errs); process.exitCode = 1; }
finally { await b.close(); }
