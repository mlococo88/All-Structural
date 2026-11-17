#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), 2026-11-17 (second Snap to road bug report, Greenwood, Warwick RI: overpass-api.de "at
// capacity" -> "OpenStreetMap failed: timed out after 15 s", then "Snap to road: no drivable MassDOT / MassGIS roads … 0 road
// segments"): the site's state picks the state road source; Overpass backoff; the ArcGIS layer look-up; Retry; Diagnose road data.
// Headless Chromium, file://, base map None, the project's zone left at the default (MA Mainland, as the engineer's project may be).
// No network: every road server is a mock built here (Overpass 502 "at capacity", RIDOT, MassDOT counted: must stay 0).
//   1. Greenwood RI (41.7045 N, 71.4466 W): Overpass answers 502 "at capacity" on every endpoint (backoff waits shortened for the
//      test) -> the status bar counts the backoff; then RIGIS / RIDOT (not MassDOT): its layer 0 answers 0 features (the engineer's
//      "0 road segments" situation), the layer look-up picks the polyline layer 2 "Road Centerlines", f=json -> the route follows POST
//      RD; the Route tab lists each RIDOT request (HTTP, features, layer); the route is labelled "RIGIS / RIDOT … not survey";
//      0 MassDOT requests.
//   2. Everything fails in a new area -> status bar "Tried: overpass-api.de, overpass.private.coffee, maps.mail.ru" and Retry; the
//      server comes back -> Retry (status bar) snaps the same clicks.
//   3. Diagnose road data: 9 raw answers (3 Overpass × status + one-way query; RIDOT layer info, service info, 1-record query), the
//      502 body, no MassDOT request.
//   4. A saved Road data "massdot" (first version) reads as "State roads"; 390 px: no sideways scroll; 0 console errors.
//   SHOTS=<dir> node tests/smoke/crane-road-states.mjs
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
const J = { 'Access-Control-Allow-Origin': '*' };
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => CranePickApp.P.site.zone), 'EPSG:2249', 'the zone left at the default (MA)');
  await p.evaluate(() => { CranePickMap.map.setView([41.7045, -71.4466], 18, { animate: false }); CranePickRoadSrc.BACKOFF.delays = [150, 300, 600]; });   // the test's waits (the app: 2, 4, 8 s)
  await p.waitForTimeout(300);
  const c = await p.evaluate(() => CranePickMap.toFt(CranePickMap.map.getCenter()));
  // the mocked roads: POST RD along x (east-west) through the centre, as Esri JSON of the RIDOT layer 2
  const road = (X0, Y0, nm) => p.evaluate(([c, X0, Y0, nm]) => { const pts = []; for (let x = -400; x <= 400; x += 50) { const q = CranePickMap.toLL({ x: c.x + X0 + x, y: c.y + Y0 }); pts.push([q.lng, q.lat]); }
    return { features: [{ attributes: { OBJECTID: 11, NAME: nm }, geometry: { paths: [pts] } }] }; }, [c, X0, Y0, nm]);
  const RD = await road(0, 0, 'POST RD');
  const net = [], md = []; let ovpOk = false;
  p.on('request', q => { const u = q.url(); if (/overpass|mail\.ru|risegis|massdot|arcgis\.com/.test(u)) net.push(q.method() + ' ' + new URL(u).host + new URL(u).pathname.replace(/.*\/(MapServer|interpreter|status)/, '/$1')); if (/massdot|services1\.arcgis\.com/.test(u)) md.push(u); });
  const busy = '502 Gateway Timeout — This Overpass API server is currently at capacity. Retry your request using exponential backoff.';
  const OVP = await p.evaluate(c => { const pts = []; for (let x = -400; x <= 400; x += 50) { const q = CranePickMap.toLL({ x: c.x + x, y: c.y + 6000 }); pts.push({ lat: q.lat, lon: q.lng }); }
    return { version: 0.6, elements: [{ type: 'way', id: 501, nodes: pts.map((_, i) => 9000 + i), geometry: pts, tags: { highway: 'secondary', name: 'Greene Street' } }] }; }, c);
  for (const h of ['https://overpass-api.de/**', 'https://overpass.private.coffee/**', 'https://maps.mail.ru/**'])
    await p.route(h, r => ovpOk && /private\.coffee/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'application/json', headers: J, body: JSON.stringify(OVP) }) : r.fulfill({ status: 502, contentType: 'text/plain', headers: J, body: busy }));
  let ridot = true;
  await p.route('https://risegis.ri.gov/**', r => { if (!ridot) return r.abort(); const u = new URL(r.request().url()), pth = u.pathname;
    const body = /\/MapServer\/0\/query$/.test(pth) ? { features: [] } : /\/MapServer\/0$/.test(pth) ? { id: 0, name: 'Road Centerlines (labels)', type: 'Annotation Layer' }
      : /\/MapServer$/.test(pth) ? { layers: [{ id: 0, name: 'Road Centerlines (labels)' }, { id: 1, name: 'Mile Points', geometryType: 'esriGeometryPoint' }, { id: 2, name: 'Road Centerlines', geometryType: 'esriGeometryPolyline' }] }
      : /\/MapServer\/2\/query$/.test(pth) ? RD : { error: { code: 400, message: 'Invalid URL' } };
    return r.fulfill({ status: 200, contentType: 'application/json', headers: J, body: JSON.stringify(body) }); });

  // 1. Greenwood RI: Overpass busy everywhere (backoff), then RIDOT: 0 features -> layer look-up -> roads
  await p.click('[data-road=snap]'); await clickFt({ x: c.x - 300, y: c.y + 12 }); await clickFt({ x: c.x + 300, y: c.y - 10 }); await p.keyboard.press('Enter');
  await p.waitForFunction(() => /is busy: asking again in/.test(document.getElementById('mbStatus').textContent), null, { timeout: 8000 });
  assert.match(await txt('#mbStatus'), /Snap to road: Getting the OpenStreetMap roads… overpass-api\.de is busy: asking again in 0\.\d+ s \(retry \d of 3\)/);
  await shot('road-states-backoff');
  await p.waitForFunction(() => CranePickApp.P.routes.length === 1, null, { timeout: 30000 }); await p.waitForTimeout(400);
  const ov = net.filter(x => /overpass|mail\.ru/.test(x));
  assert.deepEqual(ov, [...Array(4).fill('POST overpass-api.de/interpreter'), ...Array(4).fill('POST overpass.private.coffee/interpreter'), ...Array(4).fill('POST maps.mail.ru/interpreter')], 'each endpoint: 4 tries (backoff), GET skipped');
  assert.deepEqual(net.filter(x => /risegis/.test(x)), ['GET risegis.ri.gov/MapServer/0/query', 'GET risegis.ri.gov/MapServer/0', 'GET risegis.ri.gov/MapServer', 'GET risegis.ri.gov/MapServer/2/query']);
  assert.deepEqual(md, [], 'an RI site: no MassDOT / MassGIS request');
  const rm = await txt('#rdMsg');
  assert.match(rm, /^Snapped along POST RD \((59\d|60\d) ft\)\. Roads from risegis\.ri\.gov layer MapServer\/2 "Road Centerlines" \(OpenStreetMap failed: HTTP 502 \(the server is busy or down\)\)\. RIGIS \/ RIDOT; from RIGIS \/ RIDOT road centrelines — not survey\. \(the site is in Rhode Island \(the project's State Plane zone is Massachusetts\)\)/);
  assert.match(rm, /RIGIS \/ RIDOT requests: risegis\.ri\.gov MapServer\/0 \(RIDOT Road Centerlines \(risegis\.ri\.gov\)\) f=geojson: HTTP 200, 0 features, 0 road lines risegis\.ri\.gov MapServer\/0 info: HTTP 200, "Road Centerlines \(labels\)", Annotation Layer risegis\.ri\.gov service info: HTTP 200, layers: 0 Road Centerlines \(labels\); 1 Mile Points \(Point\); 2 Road Centerlines \(Polyline\) picked "Road Centerlines" \(layer 2, polyline, road-like name\): risegis\.ri\.gov MapServer\/2 f=json: HTTP 200, 1 feature, 1 road line/);
  const r0 = await p.evaluate(() => { const r = CranePickApp.P.routes[0], ev = CranePickRouteUI.evalRoute(r); return { src: r.src, L: ev.sim.pa.L, flags: ev.flags.map(f => f.level + ': ' + f.text) }; });
  assert.equal(r0.src.data, 'ri'); assert.deepEqual(r0.src.names.map(x => x.name), ['POST RD']); near(r0.L, 600, 12, 'route length');
  assert.ok(r0.flags.some(f => /^info: Road geometry from RIGIS \/ RIDOT road centrelines — not survey/.test(f)), r0.flags.join(' | '));
  assert.match(await txt('#rtCard'), /RIGIS \/ RIDOT road centreline.*from RIGIS \/ RIDOT road centrelines — not survey/);
  assert.match(await p.$eval('.leaflet-control-attribution', x => x.textContent), /RIGIS \/ RIDOT, from RIGIS \/ RIDOT road centrelines — not survey/);
  assert.equal(await p.evaluate(() => CranePickModel.normRoute(JSON.parse(JSON.stringify(CranePickApp.P.routes[0]))).src.data), 'ri', 'saved and reloaded: src.data kept');
  await shot('road-states-ri');
  ok(`Greenwood RI, zone left at MA: Overpass 502 "at capacity" -> 4 tries per endpoint (backoff counted down in the status bar), the 3 endpoints named; then RIGIS / RIDOT (0 MassDOT requests): layer 0 answered 0 features, the look-up picked layer 2 "Road Centerlines" (polyline), f=json -> POST RD (${r0.L.toFixed(0)} ft), each request listed; labelled RIGIS / RIDOT … not survey`);

  // 2. everything fails in a new area -> Tried … + Retry; the server comes back -> Retry snaps the same clicks
  ridot = false; await p.evaluate(q => CranePickMap.map.setView(CranePickMap.toLL(q), 18, { animate: false }), { x: c.x, y: c.y + 6000 }); await p.waitForTimeout(300);
  await p.click('[data-road=snap]'); await clickFt({ x: c.x - 300, y: c.y + 6010 }); await clickFt({ x: c.x + 300, y: c.y + 5990 }); await p.keyboard.press('Enter');
  await p.waitForFunction(() => /Could not get the roads/.test(document.getElementById('rdMsg').textContent), null, { timeout: 30000 });
  const bar = await txt('#mbStatus');
  assert.match(bar, /^Snap to road: could not get the OpenStreetMap roads: HTTP 502 \(the server is busy or down\) — overpass-api\.de POST \(4 tries, backoff 0\.15 \+ 0\.3 \+ 0\.6 s\); 2 more endpoints also failed; RIGIS \/ RIDOT also failed \(network error \(offline, blocked, or no CORS header\)\)\. Tried: overpass-api\.de, overpass\.private\.coffee, maps\.mail\.ru\. Test connection Retry/);
  assert.match(await txt('#rdMsg'), /RIGIS \/ RIDOT: risegis\.ri\.gov MapServer\/0 \(RIDOT Road Centerlines \(risegis\.ri\.gov\)\) f=geojson: network error/);
  await shot('road-states-fail');
  ovpOk = true; const nR = await p.evaluate(() => CranePickApp.P.routes.length);
  await p.click('#mbStatus [data-rdb=retry]');
  await p.waitForFunction(n => CranePickApp.P.routes.length === n + 1, nR, { timeout: 30000 }); await p.waitForTimeout(300);
  assert.match(await txt('#rdMsg'), /^Snapped along Greene Street .*Roads from overpass\.private\.coffee/);
  assert.equal(await txt('#mbStatus'), '');
  assert.deepEqual(md, []);
  ok('all servers failing: the status bar names the error, the backoff, the 3 endpoints tried and RIDOT, with Test connection and Retry; the server back -> Retry snapped the same clicks along Greene Street (overpass.private.coffee)');

  // 3. Diagnose road data
  ridot = true; ovpOk = false; await p.click('[data-road=diag]');
  await p.waitForFunction(() => document.querySelectorAll('#rdDiag [data-rddiag]').length === 9, null, { timeout: 20000 });
  const dg = await p.$$eval('#rdDiag [data-rddiag]', a => a.map(x => x.textContent));
  assert.match(dg[0], /^OpenStreetMap · overpass\.private\.coffee status: HTTP 502/, 'the endpoint that last worked first');
  const de = dg.find(x => /^OpenStreetMap · overpass-api\.de status/.test(x));
  assert.match(de, /^OpenStreetMap · overpass-api\.de status: HTTP 502 · \d+ ms\nhttps:\/\/overpass-api\.de\/api\/status\n502 Gateway Timeout — This Overpass API server is currently at capacity/);
  assert.match(dg.find(x => /overpass-api\.de one-way/.test(x)), /^OpenStreetMap · overpass-api\.de one-way query: HTTP 502 · \d+ ms\nhttps:\/\/overpass-api\.de\/api\/interpreter\?data=/);
  assert.match(dg[6], /^RIGIS \/ RIDOT · risegis\.ri\.gov MapServer\/0 info: HTTP 200 [\s\S]*\n\{"id":0,"name":"Road Centerlines \(labels\)","type":"Annotation Layer"\}$/);
  assert.match(dg[8], /^RIGIS \/ RIDOT · risegis\.ri\.gov MapServer\/0 1-record query: HTTP 200 [\s\S]*resultRecordCount=1[\s\S]*\n\{"features":\[\]\}$/);
  assert.match(await txt('#rdMsg'), /Diagnose road data \(.* UTC; site 41\.7\d+, -71\.44\d+ \(the last snap\); state: Rhode Island \(RIGIS \/ RIDOT, by location\); the site is in Rhode Island \(the project's State Plane zone is Massachusetts\); zone EPSG:2249\)/);
  assert.deepEqual(md, [], 'diagnose at an RI site: no MassDOT request');
  await shot('road-states-diagnose');
  ok('Diagnose road data: 9 raw answers (HTTP, time, URL, first 300 characters): Overpass 502 "at capacity" bodies, the RIDOT layer / service info and the 1-record query; the state and zone stated; no MassDOT request');

  // 4. a saved Road data "massdot" (first version) reads as State roads; settings fields per state
  await p.evaluate(() => { localStorage.setItem('crane.road', JSON.stringify({ src: 'massdot', md: '', lastOvp: '' })); });
  assert.equal(await p.evaluate(() => CranePickRoadUI.settings().src), 'state');
  await p.click('[data-road=diag]'); await p.waitForTimeout(50); await p.waitForFunction(() => !document.querySelector('[data-road=diag]').disabled, null, { timeout: 20000 });
  await p.click('#rdSet > summary'); await p.waitForTimeout(100);
  assert.equal(await p.$eval('#rdSrc', s => s.value), 'state'); assert.deepEqual(await p.$$eval('#rdSet input[type=url]', a => a.map(x => x.id)), ['rdOvp', 'rdMd', 'rdRi', 'rdCt']);
  assert.match(await txt('#rdSet'), /Rhode Island: RIGIS \/ RIDOT road layer URL/);
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
  const sx = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); assert.ok(sx <= 0, 'no sideways scroll: ' + sx);
  await shot('road-states-390');
  assert.deepEqual(errs.filter(x => !/ERR_FAILED|net::|status of 502/.test(x)), [], 'console errors');
  ok('a saved Road data "massdot" reads as State roads; a layer URL per state (MA, RI, CT); 390 px: no sideways scroll; 0 console errors (the mocked 502 answers and the refused request aside)');
  console.log(`crane-road-states: ${n} checks ok`);
} catch (e) { console.error(e); if (errs.length) console.error('console:', errs); process.exitCode = 1; } finally { await b.close(); }
