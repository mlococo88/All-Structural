#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), 2026-11-17: Snap to road (OpenStreetMap, Overpass API mocked) and the fitted route alignment.
// Headless Chromium, file://, base map None. No crane chart data; no network (the Overpass API is answered by a mock built here).
//   1. Snap to road: two clicks near a mocked road (Main Street: a 700 ft tangent, a 300 ft radius 60° left curve drawn by OSM nodes every
//      5°, a 400 ft tangent) -> the route follows the road; the curve table shows ONE curve with R within 2 % of 300 ft; road name,
//      attribution "© OpenStreetMap contributors" and "not survey" on the card and the map; editing the radius updates the off-tracking;
//      the radius handle and the PI drag (one undo step each);
//   2. a second snap onto a one-way side road (Mill Road, against its direction) -> an intersection turn at the junction and a one-way
//      warning; the roads come from this browser's cache (no second request);
//   3. Trace: a drag along a 200 ft radius quarter circle -> one fitted curve (R within 3 %);
//   4. offline (Overpass not answered) -> the clear message; drawing by clicks still works;
//      2026-11-17 (bug report): the status bar names the error type and the endpoint, with a "Test connection" link (the status page,
//      new tab); every Overpass endpoint was tried (POST, GET) and, in Massachusetts, the MassDOT / MassGIS layers;
//   4b. overpass-api.de refused, overpass.private.coffee answers -> the route snaps, "a fallback endpoint", remembered (crane.road) and
//      tried first next time; Road data: MassDOT / MassGIS (settings) with a mocked ArcGIS GeoJSON answer -> a MassDOT route labelled
//      "MassDOT / MassGIS … not survey" (card, flags, map attribution);
//   5. a legacy saved route (no mode) computes as before and its card says "each vertex is a turn"; Report §Route (curve table,
//      attribution); 390 px: no sideways scroll; 0 console errors (the refused request's own network error aside).
//   SHOTS=<dir> node tests/smoke/crane-road.mjs
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
const txt = sel => p.$eval(sel, e => (e.innerText || e.textContent).replace(/\s+/g, ' '));
const scr = q => p.evaluate(q => { const m = CranePickMap.map, cp = m.latLngToContainerPoint(CranePickMap.toLL(q)), r = m.getContainer().getBoundingClientRect(); return { x: r.x + cp.x, y: r.y + cp.y }; }, q);
const clickFt = async q => { const s = await scr(q); await p.mouse.click(s.x, s.y); await p.waitForTimeout(80); };
const evR = i => p.evaluate(i => { const r = CranePickApp.P.routes[i], ev = CranePickRouteUI.evalRoute(r); return { mode: r.mode || null, src: r.src || null, L: ev.sim.pa.L, ot: ev.otMax, turns: ev.turns.map(t => ({ kind: t.kind, r: t.r, D: t.D, ot: t.ot })), flags: ev.flags.map(f => f.level + ': ' + f.text), dev: ev.align ? ev.align.dev.max : null }; }, i);
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(400);
  await p.evaluate(() => CranePickMap.map.setZoom(18)); await p.waitForTimeout(200);
  const c = await p.evaluate(() => CranePickMap.toFt(CranePickMap.map.getCenter()));
  // the mocked OpenStreetMap ways (site ft about the map centre -> lat / lon through the app's own projection)
  const MOCK = await p.evaluate(c => {
    const ll = (x, y) => { const q = CranePickMap.toLL({ x: c.x + x, y: c.y + y }); return { lat: q.lat, lon: q.lng }; };
    const main = []; for (let x = -700; x < 0; x += 100) main.push([x, 0]);
    for (let a = 0; a <= 60; a += 5) { const t = a * Math.PI / 180; main.push([300 * Math.sin(t), 300 - 300 * Math.cos(t)]); }
    const t60 = Math.PI / 3, PT = [300 * Math.sin(t60), 300 - 300 * Math.cos(t60)]; for (let s = 100; s <= 400; s += 100) main.push([PT[0] + s * Math.cos(t60), PT[1] + s * Math.sin(t60)]);
    const mill = []; for (let y = 500; y >= 0; y -= 100) mill.push([-300, y]);   // listed north -> south, oneway=yes: southbound only
    const id = xy => xy[0] === -300 && xy[1] === 0 ? 4 : Math.round((xy[0] + 1000) * 10000 + xy[1] + 1000);
    const way = (wid, pts, tags) => ({ type: 'way', id: wid, nodes: pts.map(id), geometry: pts.map(q => ll(q[0], q[1])), tags });
    const foot = way(9, [[-650, -40], [400, -40]], { highway: 'footway', name: 'Riverside Path' });   // not drivable: ignored
    return { version: 0.6, generator: 'mock', osm3s: { copyright: 'The data included in this document is from www.openstreetmap.org. The data is made available under ODbL.' },
      elements: [way(1, main, { highway: 'primary', name: 'Main Street' }), way(2, mill, { highway: 'residential', name: 'Mill Road', oneway: 'yes' }), foot] };
  }, c);
  let calls = 0, lastBody = '';
  await p.route('https://overpass-api.de/**', async r => { calls++; lastBody = r.request().postData() || ''; await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(MOCK) }); });

  // 1. snap to road
  await p.click('[data-road=snap]'); assert.match(await p.textContent('#mbStatus'), /Snap to road:/);
  const t60 = Math.PI / 3, END = { x: c.x + 300 * Math.sin(t60) + 380 * Math.cos(t60) + 12, y: c.y + 300 - 300 * Math.cos(t60) + 380 * Math.sin(t60) - 8 };
  await clickFt({ x: c.x - 650, y: c.y + 14 }); await clickFt(END); await p.keyboard.press('Enter');
  await p.waitForFunction(() => CranePickApp.P.routes.length === 1, null, { timeout: 8000 }); await p.waitForTimeout(500);
  assert.equal(calls, 1); assert.match(decodeURIComponent(lastBody), /^data=\[out:json\].*way\["highway"~.*out geom;$/);
  let e = await evR(0); assert.equal(e.mode, 'fit'); assert.equal(e.src.kind, 'osm');
  const cv = e.turns.filter(t => t.kind === 'curve'); assert.equal(e.turns.length, 1, JSON.stringify(e.turns)); near(cv[0].r, 300, 6, 'fitted radius of the 300 ft road curve (2 %)'); near(cv[0].D * 180 / Math.PI, 60, 1, 'Δ 60°');
  assert.ok(e.dev < 2, 'max deviation ' + e.dev);
  const card = await txt('#rtCard'); assert.match(card, /Fitted alignment/); assert.match(card, /Roads: Main Street/); assert.match(card, /© OpenStreetMap contributors/); assert.match(card, /from OpenStreetMap — not survey/);
  assert.match(card, /1 curve, 0 intersection turns · smallest radius/); assert.match(await txt('#rtCurves'), /C1 .*curve/);
  assert.match(await p.$eval('.leaflet-control-attribution', x => x.textContent), /OpenStreetMap contributors.*not survey/);
  assert.ok(e.flags.some(f => /^info: Road geometry from OpenStreetMap — not survey/.test(f)));
  await shot('road-snap-map');
  ok(`snap to road: 2 clicks -> the route follows Main Street (${e.L.toFixed(0)} ft); one fitted curve R ${cv[0].r.toFixed(1)} ft (road 300 ft), Δ ${(cv[0].D * 180 / Math.PI).toFixed(2)}°, max deviation ${e.dev.toFixed(2)} ft; attribution + "not survey" on the card, the map and the flags`);
  // edit the radius in the curve table -> the off-tracking follows
  const ot0 = e.ot, live0 = await txt('#rtLive');
  await p.fill('[data-rarad]', '120'); await p.dispatchEvent('[data-rarad]', 'change'); await p.waitForTimeout(400);
  e = await evR(0); near(e.turns[0].r, 120, 1e-9); const ot1 = e.ot; assert.ok(e.ot > ot0 + 1, `off-tracking ${ot0} -> ${e.ot}`); assert.notEqual(await txt('#rtLive'), live0);
  assert.match(await txt('#rtLive'), new RegExp(`max off-tracking ${e.ot.toFixed(2)} ft`));
  await p.click('[data-ra=refit]'); await p.waitForTimeout(400); e = await evR(0); near(e.turns[0].r, cv[0].r, 1e-6, 'refit restores the fitted radius');
  // drag the curve's radius handle away from its PI (R grows), then the PI itself; one undo step each
  const rh = await p.$('.crVxR'); const bb = await rh.boundingBox(), R0 = e.turns[0].r;
  const PI = await p.evaluate(() => CranePickApp.P.routes[0].al.pis[1]), piS = await scr(PI);
  const hx = bb.x + bb.width / 2, hy = bb.y + bb.height / 2, ux = (hx - piS.x), uy = (hy - piS.y);
  await p.mouse.move(hx, hy); await p.mouse.down(); for (let k = 1; k <= 8; k++) { await p.mouse.move(hx + ux * 0.5 * k / 8, hy + uy * 0.5 * k / 8); await p.waitForTimeout(30); } await p.mouse.up(); await p.waitForTimeout(500);
  e = await evR(0); assert.ok(e.turns[0].r > R0 * 1.3, `radius handle: ${R0} -> ${e.turns[0].r}`); const Rh = e.turns[0].r;
  await p.mouse.move(piS.x, piS.y); await p.mouse.down(); for (let k = 1; k <= 6; k++) { await p.mouse.move(piS.x + 5 * k, piS.y); await p.waitForTimeout(30); } await p.mouse.up(); await p.waitForTimeout(500);
  const PI2 = await p.evaluate(() => CranePickApp.P.routes[0].al.pis[1]); assert.ok(Math.hypot(PI2.x - PI.x, PI2.y - PI.y) > 10, 'PI moved');
  assert.equal(await p.evaluate(() => CranePickApp.P.routes[0].al.edited), true);
  await p.click('#bUndo'); await p.waitForTimeout(400); const PI3 = await p.evaluate(() => CranePickApp.P.routes[0].al.pis[1]); near(PI3.x, PI.x, 1e-6, 'undo: PI back');
  await p.click('#bUndo'); await p.waitForTimeout(400); e = await evR(0); near(e.turns[0].r, R0, 1e-6, 'undo: radius back');
  await shot('road-edit');
  ok(`curve table: R 120 ft typed -> max off-tracking ${ot0.toFixed(2)} -> ${ot1.toFixed(2)} ft; and "Refit from the line" restores R ${e.turns[0].r.toFixed(1)} ft; the radius handle dragged out: R ${R0.toFixed(1)} -> ${Rh.toFixed(1)} ft; the PI dragged; one undo step each`);

  // 2. second snap: onto the one-way Mill Road (northbound = against): intersection turn, one-way warning, roads from the cache
  await p.click('[data-road=snap]'); await clickFt({ x: c.x - 650, y: c.y + 14 }); await clickFt({ x: c.x - 290, y: c.y + 350 }); await p.click('#mbStatus [data-rdb=finish]');
  await p.waitForFunction(() => CranePickApp.P.routes.length === 2, null, { timeout: 8000 }); await p.waitForTimeout(500);
  assert.equal(calls, 1, 'second snap: the roads from this browser\'s cache');
  e = await evR(1); assert.equal(e.turns.length, 1); assert.equal(e.turns[0].kind, 'turn'); near(e.turns[0].D * 180 / Math.PI, 90, 1, 'the junction turn, 90° left');
  assert.ok(e.flags.some(f => /^warn: The route travels against the one-way direction of Mill Road/.test(f)), e.flags.join(' | '));
  assert.match(await txt('#rdMsg'), /Snapped along Main Street → Mill Road.*cache/);
  assert.match(await txt('#rtCard'), /0 curves, 1 intersection turn/);
  await shot('road-turn-oneway');
  ok('second snap onto Mill Road: an intersection turn at the junction (90°, the route default radius), a one-way warning (against Mill Road), roads from the cache (1 request in all)');

  // 3. trace: a drag along a 200 ft radius quarter circle (zoom 19)
  await p.evaluate(q => CranePickMap.map.setView(CranePickMap.toLL(q), 19, { animate: false }), { x: c.x + 1200, y: c.y - 1200 }); await p.waitForTimeout(300);
  const o = { x: c.x + 1200 - 250, y: c.y - 1200 - 150 }, line = [];
  for (let x = 0; x < 150; x += 5) line.push({ x: o.x + x, y: o.y });
  for (let a = 0; a <= 90; a += 2) { const t = a * Math.PI / 180; line.push({ x: o.x + 150 + 200 * Math.sin(t), y: o.y + 200 - 200 * Math.cos(t) }); }
  for (let y = 5; y <= 120; y += 5) line.push({ x: o.x + 350, y: o.y + 200 + y });
  await p.click('[data-road=trace]'); const s0 = await scr(line[0]); await p.mouse.move(s0.x, s0.y); await p.mouse.down();
  for (const q of line.slice(1)) { const s = await scr(q); await p.mouse.move(s.x, s.y); }
  await p.mouse.up(); await p.waitForTimeout(600);
  assert.equal(await p.evaluate(() => CranePickApp.P.routes.length), 3);
  e = await evR(2); assert.equal(e.src.kind, 'trace'); const tc = e.turns.filter(t => t.kind === 'curve'); assert.equal(tc.length, 1, JSON.stringify(e.turns)); near(tc[0].r, 200, 6, 'traced curve radius (3 %)');
  await shot('road-trace');
  ok(`trace: one drag along a 200 ft radius quarter circle -> one fitted curve R ${tc[0].r.toFixed(1)} ft, Δ ${(tc[0].D * 180 / Math.PI).toFixed(1)}° (not ${line.length - 1} turns)`);

  // 4. offline: Overpass not answered (the test harness refuses it) in a new area
  await p.unroute('https://overpass-api.de/**');
  await p.evaluate(q => CranePickMap.map.setView(CranePickMap.toLL(q), 18, { animate: false }), { x: c.x + 9000, y: c.y }); await p.waitForTimeout(300);
  const net = [];
  p.on('request', q => { if (/overpass|massdot|arcgis\.com|mail\.ru/.test(q.url())) net.push(q.method() + ' ' + new URL(q.url()).host); });
  await p.click('[data-road=snap]'); await clickFt({ x: c.x + 8900, y: c.y }); await clickFt({ x: c.x + 9100, y: c.y + 50 }); await p.keyboard.press('Enter');
  await p.waitForFunction(() => /Could not get the roads/.test(document.getElementById('rdMsg').textContent), null, { timeout: 20000 });
  const bar = await txt('#mbStatus');
  assert.match(bar, /Snap to road: could not get the OpenStreetMap roads: network error: offline, the network \/ firewall blocks the server, or the answer had no CORS header \(the browser does not say which\) — overpass-api\.de POST; 2 more endpoints also failed; MassDOT \/ MassGIS also failed \(network error/);
  const tl = await p.$eval('#mbStatus a[data-rdtest=bar]', a => ({ href: a.href, t: a.target, txt: a.textContent }));
  assert.deepEqual(tl, { href: 'https://overpass-api.de/api/status', t: '_blank', txt: 'Test connection' });
  assert.deepEqual(net, ['POST overpass-api.de', 'GET overpass-api.de', 'POST overpass.private.coffee', 'GET overpass.private.coffee', 'POST maps.mail.ru', 'GET maps.mail.ru', 'GET gis.massdot.state.ma.us', 'GET services1.arcgis.com']);
  const rm = await txt('#rdMsg');
  assert.match(rm, /OpenStreetMap: overpass-api\.de POST \+ GET: network error \(offline, blocked, or no CORS header\); overpass\.private\.coffee POST \+ GET.*maps\.mail\.ru POST \+ GET.*MassDOT \/ MassGIS: gis\.massdot\.state\.ma\.us FeatureServer\/10 \(MassDOT Road Inventory 2024 .*\) f=geojson: network error.*services1\.arcgis\.com FeatureServer\/0 .* f=geojson: network error.*Test connection opens the server's status page.*Trace.*Route.*work offline/);
  assert.match(bar, /Tried: overpass-api\.de, overpass\.private\.coffee, maps\.mail\.ru\. Test connection Retry/);
  assert.equal(await p.$$eval('#rdMsg a[data-rdtest]', a => a.length), 5);
  await shot('road-fail-status');
  ok('failure: the status bar names the error type (network / CORS) and the endpoint (overpass-api.de POST; 2 more failed; MassDOT also failed) with a Test connection link to https://overpass-api.de/api/status (new tab); requests: 3 Overpass endpoints × POST + GET, then 2 MassDOT layers; the Route tab lists each and 5 Test links');
  await p.click('#mbStatus [data-rdb=clear]');
  assert.match(await txt('#rdMsg'), /Could not get the roads.*Trace.*Route.*work offline/);
  await p.click('[data-rtool=route]'); await clickFt({ x: c.x + 8900, y: c.y }); await clickFt({ x: c.x + 9100, y: c.y + 50 }); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => CranePickApp.P.routes.length), 4, 'a route drawn by clicks while offline');
  await shot('road-offline');
  ok('offline: the clear message in the Route tab; a route drawn by clicks still works');

  // 5. a legacy saved route: unchanged (the engine's legacy path), "each vertex is a turn"
  const L = await p.evaluate(c => { const r = CranePickModel.normRoute({ id: 'legacy1', name: 'Old route', pts: [[-220, -80], [-20, -80], [-20, 80], [180, 80]].map(([x, y]) => ({ x: c.x + x, y: c.y + y })), rad: [null, 60, null, null] });
    CranePickApp.update(P => { P.routes.push(r); }, 'route', { id: r.id }); CranePickRouteUI.select(r.id);
    const ev = CranePickRouteUI.evalRoute(CranePickApp.P.routes[4]), raw = CranePickRoute.evaluate(JSON.parse(JSON.stringify(r)), CranePickApp.P, 'rt5');
    return { mode: CranePickApp.P.routes[4].mode || null, ot: ev.otMax, ot2: raw.otMax, r: ev.turns.map(t => t.r), fitted: CranePickRoute.fitted(CranePickApp.P.routes[4]) }; }, c);
  await p.waitForTimeout(300);
  assert.equal(L.mode, null); assert.equal(L.fitted, false); assert.deepEqual(L.r, [60, 50]); near(L.ot, L.ot2, 1e-12);
  assert.equal(await p.$eval('#rtMode', s => s.value), 'legacy'); assert.match(await txt('#rtLive'), /2 turns · max off-tracking/);
  ok(`legacy saved route (no mode): 2 turns at its vertices (r 60, 50 ft), off-tracking ${L.ot.toFixed(3)} ft = the engine's legacy path; the card says "each vertex is a turn (legacy)"`);

  // 4b. a fallback endpoint answers; then MassDOT / MassGIS by choice (both mocked); a straight road along x at y0 in a new area
  const road = (X0, Y0, nm, ll) => p.evaluate(([c, X0, Y0, nm, ll]) => { const pts = []; for (let x = -400; x <= 400; x += 50) { const q = CranePickMap.toLL({ x: c.x + X0 + x, y: c.y + Y0 }); pts.push(ll ? [q.lng, q.lat] : { lat: q.lat, lon: q.lng }); }
    return ll ? { type: 'FeatureCollection', features: [{ type: 'Feature', id: 1, properties: { OBJECTID: 1, St_Name: nm, Oneway: null }, geometry: { type: 'LineString', coordinates: pts } }] }
      : { version: 0.6, elements: [{ type: 'way', id: 77, nodes: pts.map((_, i) => 7000 + i), geometry: pts, tags: { highway: 'tertiary', name: nm } }] }; }, [c, X0, Y0, nm, ll]);
  const OSM2 = await road(-9000, 0, 'Fallback Avenue', false); let coffee = 0;
  await p.route('https://overpass.private.coffee/**', async r => { coffee++; await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(OSM2) }); });
  await p.evaluate(q => CranePickMap.map.setView(CranePickMap.toLL(q), 18, { animate: false }), { x: c.x - 9000, y: c.y }); await p.waitForTimeout(300);
  net.length = 0; const nR = await p.evaluate(() => CranePickApp.P.routes.length);
  await p.click('[data-road=snap]'); await clickFt({ x: c.x - 9300, y: c.y + 10 }); await clickFt({ x: c.x - 8700, y: c.y - 10 }); await p.keyboard.press('Enter');
  await p.waitForFunction(n => CranePickApp.P.routes.length === n + 1, nR, { timeout: 15000 }); await p.waitForTimeout(300);
  assert.deepEqual(net, ['POST overpass-api.de', 'GET overpass-api.de', 'POST overpass.private.coffee']);
  assert.match(await txt('#rdMsg'), /Snapped along Fallback Avenue \((59\d|60\d) ft\)\. Roads from overpass\.private\.coffee \(a fallback endpoint\)\. © OpenStreetMap contributors; from OpenStreetMap — not survey\./);
  assert.equal(JSON.parse(await p.evaluate(() => localStorage.getItem('crane.road'))).lastOvp, 'https://overpass.private.coffee/api/interpreter');
  // the next area: the endpoint that worked is tried first
  await p.evaluate(q => CranePickMap.map.setView(CranePickMap.toLL(q), 18, { animate: false }), { x: c.x - 9000, y: c.y + 3000 }); await p.waitForTimeout(300);
  net.length = 0; await p.click('[data-road=snap]'); await clickFt({ x: c.x - 9100, y: c.y + 3000 }); await clickFt({ x: c.x - 8900, y: c.y + 3000 }); await p.keyboard.press('Enter');
  await p.waitForFunction(() => /no drivable|from the nearest/.test(document.getElementById('rdMsg').textContent), null, { timeout: 15000 });
  assert.deepEqual(net, ['POST overpass.private.coffee']);
  ok('fallback: overpass-api.de refused (POST, GET), overpass.private.coffee answered: the route snaps along Fallback Avenue, the Route tab says "a fallback endpoint"; remembered in crane.road and tried first in the next area');
  // MassDOT / MassGIS by choice (Road data settings), the mocked layer answers GeoJSON
  const MD = await road(-9000, -3000, 'SALEM STREET', true); let mdq = '';
  await p.route('https://gis.massdot.state.ma.us/**', async r => { mdq = r.request().url(); await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(MD) }); });
  await p.click('#rdSet > summary'); await p.selectOption('#rdSrc', 'state'); await p.click('[data-road=setSave]'); await p.waitForTimeout(200);
  assert.match(await txt('#rdMsg'), /Road data settings saved/); assert.equal(await p.$eval('#rdSet', d => d.open), true);
  await p.evaluate(q => CranePickMap.map.setView(CranePickMap.toLL(q), 18, { animate: false }), { x: c.x - 9000, y: c.y - 3000 }); await p.waitForTimeout(300);
  net.length = 0; await p.click('[data-road=snap]'); await clickFt({ x: c.x - 9300, y: c.y - 2990 }); await clickFt({ x: c.x - 8700, y: c.y - 3010 }); await p.keyboard.press('Enter');
  await p.waitForFunction(n => CranePickApp.P.routes.length === n + 2, nR, { timeout: 15000 }); await p.waitForTimeout(400);
  assert.deepEqual(net, ['GET gis.massdot.state.ma.us']); const mu = new URL(mdq);
  assert.equal(mu.pathname, '/arcgis/rest/services/Roads/RoadInventoryYearEndFiles/FeatureServer/10/query'); assert.equal(mu.searchParams.get('outSR'), '4326'); assert.equal(mu.searchParams.get('f'), 'geojson');
  const md = await p.evaluate(() => { const r = CranePickApp.P.routes[CranePickApp.P.routes.length - 1], ev = CranePickRouteUI.evalRoute(r); return { src: r.src, flags: ev.flags.map(f => f.level + ': ' + f.text) }; });
  assert.equal(md.src.data, 'massdot'); assert.equal(md.src.kind, 'osm'); assert.deepEqual(md.src.names.map(n => n.name), ['SALEM STREET']);
  assert.ok(md.flags.some(f => /^info: Road geometry from MassDOT \/ MassGIS road centrelines — not survey \(MassDOT \/ MassGIS, fetched/.test(f)), md.flags.join(' | '));
  const cardM = await txt('#rtCard'); assert.match(cardM, /MassDOT \/ MassGIS road centreline/); assert.match(cardM, /from MassDOT \/ MassGIS road centrelines — not survey/);
  assert.match(await p.$eval('.leaflet-control-attribution', x => x.textContent), /MassDOT \/ MassGIS, from MassDOT \/ MassGIS road centrelines — not survey/);
  assert.equal(await p.evaluate(() => CranePickModel.normRoute(JSON.parse(JSON.stringify(CranePickApp.P.routes[CranePickApp.P.routes.length - 1]))).src.data), 'massdot', 'saved and reloaded: src.data kept');
  await shot('road-massdot');
  ok('Road data: MassDOT / MassGIS (settings): one GET to the MassDOT Road Inventory layer query (outSR 4326, f=geojson); the route follows SALEM STREET; card, flag and map attribution "MassDOT / MassGIS … not survey"; src.data kept on reload');
  await p.click('[data-road=setReset]'); await p.waitForTimeout(150); assert.equal(JSON.parse(await p.evaluate(() => localStorage.getItem('crane.road'))).src, 'auto');

  // Report and the Route tab
  await p.click('#tabBar [data-otab=route]'); await p.waitForTimeout(400);
  const out = await txt('#out [data-opane=route]'); assert.match(out, /Alignment \(fitted\).*No\. Kind R \(ft\).*PC sta\..*C1 curve/); assert.match(out, /© OpenStreetMap contributors/);
  await shot('road-route-tab');
  await p.click('#tabBar [data-otab=rpt]'); await p.waitForTimeout(900);
  const rp = await p.$eval('#out [data-opane=rpt]', x => x.textContent.replace(/\s+/g, ' '));
  assert.match(rp, /Alignment: fitted to the OpenStreetMap road centreline.*© OpenStreetMap contributors, ODbL; from OpenStreetMap — not survey/); assert.match(rp, /PC sta\./); assert.ok(!/NaN|undefined|\[\[/.test(rp));
  await shot('road-report');
  await p.click('#tabBar [data-otab=dwg]'); await p.waitForTimeout(900);
  const dx = await p.evaluate(() => { let got = ''; const d0 = SharedDxf.download; SharedDxf.download = t => { got = t; }; document.getElementById('dwg_dxf').click(); SharedDxf.download = d0; return { t: got, ok: CranePickDrawingsUI.lastDxf.check.ok }; });
  assert.ok(dx.ok); assert.match(dx.t, /ROAD GEOMETRY FROM OPENSTREETMAP - NOT SURVEY\. \(C\) OPENSTREETMAP CONTRIBUTORS, ODBL\./); assert.match(dx.t, /\nC1 R 300\r?\n/);
  ok('Route tab: alignment section with the curve table and attribution; Report §Route: the fitted alignment note (attribution, "not survey") and the curve table; no NaN / undefined; the DXF route sheet: "C1 R 300" and the OpenStreetMap attribution');
  await p.click('#tabBar [data-otab=plan]'); await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(500);
  await p.click('#inTabs [data-itab=route]'); await p.evaluate(() => CranePickRouteUI.select(CranePickApp.P.routes[0].id)); await p.waitForTimeout(400);
  const sx = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); assert.ok(sx <= 0, 'no sideways scroll: ' + sx);
  await p.evaluate(() => document.getElementById('rtAlign').scrollIntoView()); await shot('road-390');
  assert.deepEqual(errs.filter(x => !/ERR_FAILED|net::/.test(x)), [], 'console errors');
  ok('390 px: no sideways scroll; 0 console errors');
  console.log(`crane-road: ${n} checks ok`);
} catch (e) { console.error(e); if (errs.length) console.error('console:', errs); process.exitCode = 1; } finally { await b.close(); }
