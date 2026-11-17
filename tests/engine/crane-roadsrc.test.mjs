// Crane Pick Analyzer (apps/crane-pick), 2026-11-17 (engineer bug report: "Snap to road: no OpenStreetMap roads (offline or blocked)"):
// engine/roadsrc.js — error classification, the Overpass endpoint fallback order (POST, then GET), timeouts, bad answers, and the
// MassDOT / MassGIS ArcGIS adapter (GeoJSON and Esri JSON, paging) feeding engine/osm.js's graph and route.
// Node only; no network: fetch is a mock built here. No chart data.
//   node tests/engine/run.mjs crane-roadsrc
//
// Hand checks:
// A. classify: TypeError "Failed to fetch" -> network; our timeout -> timeout; HTTP 429 / 405 -> http with the code; HTML -> json.
// B. Endpoint order: none typed, none remembered -> overpass-api.de, overpass.private.coffee, maps.mail.ru; typed X and last-worked
//    coffee -> X, coffee, de, vk (no duplicates).
// C. Fallback: de refuses both forms (network) -> coffee POST answers: the requests are de POST, de GET, coffee POST; the log says so.
// D. GET fallback: de POST -> HTTP 405, de GET -> answers. Timeout: de POST hangs -> after the timeout de GET is skipped, coffee answers.
// E. MassDOT: a 300 ft square block A (0,0) B (300,0) C (300,300) D (0,300) + diagonal A–C, as ArcGIS features (lat / lon, WGS 84);
//    f=geojson refused by the first layer ({ error }) -> f=json (Esri JSON paths) answers in two pages (exceededTransferLimit);
//    the diagonal "Oneway: TF" (digitised A -> C, traffic C -> A). Clicks 10 ft beyond A and beyond C snap onto A and C; the route
//    is the diagonal L = 300√2 = 424.26 ft (beats the 600 ft way round); one "against" warning of 424.26 ft; names from St_Name.
// 2026-11-17 (second bug report, Greenwood, Warwick RI: Overpass "at capacity", then "no drivable MassDOT / MassGIS roads, 0 road
// segments"):
// F. stateOf: Greenwood (41.7045 N, 71.4466 W) is in Rhode Island whatever the zone (the old box called it Massachusetts);
//    Wakefield MA, Hartford CT, New York (none); Pawcatuck CT (41.3776, -71.8336) sits ~0.4 km from the coarse RI outline: the
//    project's CT zone decides there (within 2 km of a border).
// G. ArcGIS { error } with HTTP 200 (code 499 Token Required) on every request: classified "the server reported an error: code 499:
//    Token Required", HTTP 200 in the report, not read as an empty answer.
// H. 0 features: the layer is a table; the service lists a point layer and the polyline "Road Inventory 2024" (layer 7): picked,
//    asked with f=json, its features route (the same block, diagonal 424.26 ft). A root without geometry types: the road-like layers
//    are looked up one by one.
// I. no polyline layer in the first service -> the second MassGIS service answers.
// J. Overpass 502, 502, 200 -> waits 2 s, 4 s (injected sleep), same endpoint; always 502 -> 4 tries (2 + 4 + 8 s), GET skipped,
//    next endpoint; a timeout (15 s, virtual clock) -> one retry after 2 s (15 + 2 + 15 > 30 s), then the next endpoint.
// K. Rhode Island: RIDOT MapServer refuses f=geojson -> f=json (NAME field) -> roads; no MassDOT request. Connecticut: Local Roads
//    + State Routes merged.
// L. diagnose at Greenwood: 3 Overpass endpoints × (status, one-way query) + RIDOT (layer info, service info, 1-record query) = 9
//    requests, the raw answers (HTTP, first 300 characters), no MassDOT request.
import assert from 'node:assert/strict';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps', 'crane-pick', 'engine');
const W = loadShared(path.join(APP, 'osm.js'), path.join(APP, 'states.js'), path.join(APP, 'roadsrc.js'));
Object.assign(W, { setTimeout, clearTimeout, AbortController });
const RS = W.CranePickRoadSrc, OSM = W.CranePickOSM;
const deq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const B = { s: 42.5, w: -71.07, n: 42.51, e: -71.06 };
const OSMJSON = { version: 0.6, elements: [{ type: 'way', id: 1, nodes: [1, 2], geometry: [{ lat: 42.501, lon: -71.065 }, { lat: 42.502, lon: -71.064 }], tags: { highway: 'residential', name: 'Main Street' } }] };
const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => typeof body === 'string' ? body : JSON.stringify(body) });
const netErr = () => { throw new TypeError('Failed to fetch'); };
/* a mock fetch: rules [(url, init) -> response | throws | 'hang'], every call recorded */
function mock(rule) {
  const calls = [];
  const f = (url, init) => { calls.push({ url, method: (init && init.method) || 'GET', body: init && init.body });
    return new Promise((res, rej) => { let r; try { r = rule(url, init || {}); } catch (e) { rej(e); return; }
      if (r === 'hang') { const sg = init && init.signal; if (sg) sg.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); }); return; } res(r); }); };
  return { f, calls };
}
const hostOf = u => /^https:\/\/([^/]+)/.exec(u)[1];

test('A. classify: network / timeout / HTTP / bad JSON / server', () => {
  let c = RS.classify(new TypeError('Failed to fetch')); assert.equal(c.kind, 'network'); assert.match(c.text, /network error: offline, the network \/ firewall blocks the server, or the answer had no CORS header/);
  c = RS.classify({ kind: 'timeout' }, 15000); assert.equal(c.kind, 'timeout'); assert.match(c.text, /timed out after 15 s/);
  c = RS.classify(Object.assign(new Error('x'), { name: 'AbortError' })); assert.equal(c.kind, 'timeout');
  c = RS.classify({ http: 429 }); assert.equal(c.kind, 'http'); assert.equal(c.code, 429); assert.match(c.text, /^HTTP 429 \(too many requests/);
  c = RS.classify({ http: 405 }); assert.match(c.text, /^HTTP 405 \(method not allowed: a proxy may block POST\)/);
  c = RS.classify({ kind: 'json', detail: '<html>' }); assert.equal(c.kind, 'json'); assert.match(c.text, /not the expected JSON \(<html>\)/);
  c = RS.classify({ kind: 'server', detail: 'runtime error: Query timed out' }); assert.equal(c.kind, 'server');
  // status (Test connection) URLs
  assert.equal(RS.statusUrl('https://overpass-api.de/api/interpreter'), 'https://overpass-api.de/api/status');
  assert.equal(RS.statusUrl(RS.MASSDOT[0].url), RS.MASSDOT[0].url + '?f=pjson');
});

test('B. endpoint order: the typed endpoint, the one that last worked, then the list (no duplicates)', () => {
  deq(RS.overpassOrder('', '').map(e => hostOf(e.url)), ['overpass-api.de', 'overpass.private.coffee', 'maps.mail.ru']);
  const o = RS.overpassOrder('https://overpass.example.org/api/interpreter', 'https://overpass.private.coffee/api/interpreter');
  deq(o.map(e => hostOf(e.url)), ['overpass.example.org', 'overpass.private.coffee', 'overpass-api.de', 'maps.mail.ru']);
  assert.equal(o[0].status, 'https://overpass.example.org/api/status'); assert.match(o[0].name, /settings/);
  deq(RS.overpassOrder('not a url', '').map(e => hostOf(e.url)), ['overpass-api.de', 'overpass.private.coffee', 'maps.mail.ru'], 'an invalid URL is ignored');
  deq(RS.massdotOrder('', '').map(e => hostOf(e.url)), ['gis.massdot.state.ma.us', 'services1.arcgis.com']);
  assert.equal(RS.massdotOrder(RS.MASSDOT[1].url + '/query', '')[0].url, RS.MASSDOT[1].url, 'a pasted /query URL is trimmed to the layer');
  deq(RS.stateOrder('RI', '', '').map(e => hostOf(e.url)), ['risegis.ri.gov']); deq(RS.stateOrder('CT', '', '').map(e => hostOf(e.url)), ['gisportal.dot.ct.gov']); deq(RS.stateOrder('NY', '', ''), []);
});

test('C. fallback: the first endpoint fails (network, both forms), the second answers OSM JSON', async () => {
  const m = mock(url => hostOf(url) === 'overpass-api.de' ? netErr() : resp(200, OSMJSON));
  const r = await RS.fetchOverpass(B, m.f, { OSM, timeoutMs: 2000 });
  assert.equal(r.ok, true); assert.equal(r.json.elements.length, 1); assert.equal(hostOf(r.used.url), 'overpass.private.coffee'); assert.equal(r.used.how, 'POST');
  deq(m.calls.map(c => hostOf(c.url) + ' ' + c.method), ['overpass-api.de POST', 'overpass-api.de GET', 'overpass.private.coffee POST']);
  assert.equal(m.calls[0].body, OSM.body(B), 'POST: the form body data=<query>, as before');
  assert.equal(decodeURIComponent(m.calls[1].url.split('?data=')[1]), OSM.query(B), 'GET carries the same query');
  deq(r.log.map(l => [l.how, l.ok, l.kind || '']), [['POST', false, 'network'], ['GET', false, 'network'], ['POST', true, '']]);
  // every endpoint refuses: ok false, the summary names the first endpoint and counts the others
  const m2 = mock(() => netErr()), r2 = await RS.fetchOverpass(B, m2.f, { OSM, timeoutMs: 2000 });
  assert.equal(r2.ok, false); assert.equal(m2.calls.length, 6); const s = RS.summary(r2.log);
  assert.match(s.short, /^network error: .* — overpass-api\.de POST; 2 more endpoints also failed$/); deq(s.full, ['overpass-api.de POST + GET: network error (offline, blocked, or no CORS header)', 'overpass.private.coffee POST + GET: network error (offline, blocked, or no CORS header)', 'maps.mail.ru POST + GET: network error (offline, blocked, or no CORS header)']);
});

test('D. GET fallback after HTTP 405; a timeout skips that endpoint\'s GET; bad JSON moves on', async () => {
  let m = mock((url, i) => i.method === 'POST' ? resp(405, 'Method Not Allowed') : resp(200, OSMJSON));
  let r = await RS.fetchOverpass(B, m.f, { OSM, timeoutMs: 2000 });
  assert.equal(r.ok, true); assert.equal(hostOf(r.used.url), 'overpass-api.de'); assert.equal(r.used.how, 'GET'); assert.equal(r.log[0].code, 405);
  m = mock(url => hostOf(url) === 'overpass-api.de' ? 'hang' : resp(200, OSMJSON));
  const t0 = Date.now(); r = await RS.fetchOverpass(B, m.f, { OSM, timeoutMs: 60, backoff: false });
  assert.equal(r.ok, true); assert.ok(Date.now() - t0 < 1500); deq(m.calls.map(c => hostOf(c.url) + ' ' + c.method), ['overpass-api.de POST', 'overpass.private.coffee POST']);
  assert.equal(r.log[0].kind, 'timeout');
  m = mock(url => hostOf(url) === 'overpass-api.de' ? resp(200, '<html><body>Web filter: sign in</body></html>') : resp(200, OSMJSON));
  r = await RS.fetchOverpass(B, m.f, { OSM, timeoutMs: 2000 }); assert.equal(r.ok, true); assert.equal(r.log[0].kind, 'json'); assert.match(r.log[0].text, /<html><body>Web filter/);
  m = mock(url => hostOf(url) === 'overpass-api.de' ? resp(200, { elements: [], remark: 'runtime error: Query timed out in "query" at line 1' }) : resp(200, OSMJSON));
  r = await RS.fetchOverpass(B, m.f, { OSM, timeoutMs: 2000 }); assert.equal(r.ok, true); assert.equal(r.log[0].kind, 'server');
  // HTTP 429 on de (no backoff): its GET is skipped (the server, not the form)
  m = mock(url => hostOf(url) === 'overpass-api.de' ? resp(429, 'Too Many Requests') : resp(200, OSMJSON));
  r = await RS.fetchOverpass(B, m.f, { OSM, timeoutMs: 2000, backoff: false }); deq(m.calls.map(c => hostOf(c.url) + ' ' + c.method), ['overpass-api.de POST', 'overpass.private.coffee POST']);
});

/* the MassDOT block: local ft <-> lat / lon about (42.5, -71.065) (a plain equirectangular frame, the same both ways) */
const LAT0 = 42.5, LON0 = -71.065, FT = 364000, CS = Math.cos(LAT0 * Math.PI / 180);
const toLL = (x, y) => [LON0 + x / (FT * CS), LAT0 + y / FT];
const proj = (lat, lon) => ({ x: (lon - LON0) * FT * CS, y: (lat - LAT0) * FT });
test('E. MassDOT / MassGIS adapter: f=geojson refused -> Esri JSON in two pages -> graph -> route along the diagonal (one-way warning)', async () => {
  const A = [0, 0], Bp = [300, 0], C = [300, 300], D = [0, 300];
  const esri = (id, pts, a) => ({ attributes: Object.assign({ OBJECTID: id }, a), geometry: { paths: [pts.map(p => toLL(p[0], p[1]))] } });
  const f1 = [esri(1, [A, Bp], { St_Name: 'South Street', Oneway: null }), esri(2, [Bp, C], { St_Name: 'East Street' })];
  const f2 = [esri(3, [C, D], { St_Name: 'North Street' }), esri(4, [D, A], { St_Name: 'West Street' }), esri(5, [A, C], { St_Name: 'Diagonal Road', Oneway: 'TF', RT_NUMBER: '0' })];
  const m = mock(url => {
    const q = new URL(url), f = q.searchParams.get('f'), off = +(q.searchParams.get('resultOffset') || 0);
    if (hostOf(url) !== 'gis.massdot.state.ma.us') return netErr();
    if (f === 'geojson') return resp(200, { error: { code: 400, message: 'Invalid or missing input parameters.' } });
    return resp(200, off ? { features: f2 } : { features: f1, exceededTransferLimit: true });
  });
  const r = await RS.fetchMassDOT(B, m.f, { timeoutMs: 2000 });
  assert.equal(r.ok, true); assert.equal(r.src, 'massdot');
  const u0 = new URL(m.calls[0].url); assert.match(m.calls[0].url, /\/FeatureServer\/10\/query\?/);
  deq(JSON.parse(u0.searchParams.get('geometry')), { xmin: B.w, ymin: B.s, xmax: B.e, ymax: B.n, spatialReference: { wkid: 4326 } }, 'the envelope as JSON with its spatial reference'); assert.equal(u0.searchParams.get('geometryType'), 'esriGeometryEnvelope');
  assert.equal(u0.searchParams.get('inSR'), '4326'); assert.equal(u0.searchParams.get('outSR'), '4326'); assert.equal(u0.searchParams.get('f'), 'geojson');
  deq(m.calls.map(c => new URL(c.url).searchParams.get('f') + ' ' + (new URL(c.url).searchParams.get('resultOffset') || 0)), ['geojson 0', 'json 0', 'json 2']);
  assert.equal(r.json.elements.length, 5); const dg = r.json.elements[4]; assert.equal(dg.tags.name, 'Diagonal Road'); assert.equal(dg.tags.oneway, '-1'); assert.equal(dg.tags.ref, undefined, 'route number 0 = not a numbered route');
  const g = OSM.graph(r.json, proj); assert.equal(g.n, 4, 'the ways join at their shared end coordinates'); assert.equal(g.edges.length, 5);
  const res = OSM.route(g, [{ x: -7.0711, y: -7.0711 }, { x: 307.0711, y: 307.0711 }], { label: 'MassDOT / MassGIS' });
  assert.equal(res.ok, true, res.why); near(res.L, 300 * Math.SQRT2, 0.05, 'snapped A -> C along the diagonal (the snaps are on the nodes)');
  deq(res.names.map(n => n.name), ['Diagonal Road']); assert.equal(res.against.length, 1); near(res.against[0].s1 - res.against[0].s0, 424.26, 0.05);
  assert.equal(OSM.srcInfo({ kind: 'osm', data: 'massdot' }).ATTR, 'MassDOT / MassGIS'); assert.match(OSM.srcInfo({ kind: 'osm', data: 'massdot' }).NOT_SURVEY, /not survey/);
  assert.equal(OSM.srcInfo({ kind: 'osm' }).ATTR, '© OpenStreetMap contributors');
  // GeoJSON (MultiLineString, lower-case fields) from the second layer when the first is unreachable
  const gj = { type: 'FeatureCollection', features: [{ type: 'Feature', id: 7, properties: { street_name: 'Water Street', oneway: 'FT' }, geometry: { type: 'MultiLineString', coordinates: [[toLL(0, 0), toLL(100, 0)], [toLL(100, 0), toLL(200, 0)]] } }] };
  const m2 = mock(url => hostOf(url) === 'services1.arcgis.com' ? resp(200, gj) : netErr()), r2 = await RS.fetchMassDOT(B, m2.f, { timeoutMs: 2000 });
  assert.equal(r2.ok, true); assert.equal(r2.json.elements.length, 2); assert.equal(r2.json.elements[0].tags.oneway, 'yes'); assert.equal(r2.json.elements[0].tags.name, 'Water Street');
  deq(m2.calls.map(c => hostOf(c.url)), ['gis.massdot.state.ma.us', 'services1.arcgis.com'], 'a network error skips f=json on that layer');
  const g2 = OSM.graph(r2.json, proj), rr = OSM.route(g2, [{ x: 10, y: 5 }, { x: 190, y: -5 }]); assert.equal(rr.ok, true); near(rr.L, 180, 1e-6); assert.equal(rr.against.length, 0);
});

const GREEN = { lat: 41.7045, lng: -71.4466 };
test('F. stateOf: the site\'s state from its location; the zone decides near a border', () => {
  let so = RS.stateOf(GREEN.lat, GREEN.lng, 'EPSG:2249'); assert.equal(so.st, 'RI'); assert.equal(so.by, 'location'); assert.match(so.note, /the site is in Rhode Island \(the project's State Plane zone is Massachusetts\)/);
  so = RS.stateOf(GREEN.lat, GREEN.lng, 'EPSG:3438'); assert.equal(so.st, 'RI'); assert.equal(so.note, '');
  assert.equal(RS.stateOf(42.506, -71.066, 'EPSG:2249').st, 'MA'); assert.equal(RS.stateOf(42.506, -71.066, 'EPSG:3438').st, 'MA', 'Wakefield MA with an RI zone: MA (8x km from RI)');
  assert.equal(RS.stateOf(41.7658, -72.6734, 'EPSG:2234').st, 'CT'); assert.equal(RS.stateOf(42.3601, -71.0589, 'EPSG:26986').st, 'MA');
  so = RS.stateOf(40.71, -74.0, 'EPSG:2249'); assert.equal(so.st, null); assert.match(so.note, /not in Massachusetts, Rhode Island or Connecticut/);
  so = RS.stateOf(41.3776, -71.8336, 'EPSG:2234'); assert.equal(so.st, 'CT'); assert.equal(so.by, 'zone'); assert.match(so.note, /border/);
  assert.ok(RS.distKm(41.3776, -71.8336, W.CranePickStates.CT) < 2);
  assert.equal(RS.dataOf('RI'), 'ri'); assert.equal(RS.stOfData('massdot'), 'MA'); assert.equal(OSM.srcInfo({ kind: 'osm', data: 'ri' }).ATTR, 'RIGIS / RIDOT'); assert.equal(OSM.srcInfo('ct').label, 'CTDOT / CT DEEP');
});

test('G. ArcGIS { error } with HTTP 200: classified and reported (not an empty answer)', async () => {
  const m = mock(() => resp(200, { error: { code: 499, message: 'Token Required', details: [] } }));
  const r = await RS.fetchMassDOT(B, m.f, { timeoutMs: 2000 });
  assert.equal(r.ok, false); assert.equal(r.empty, false);
  const q0 = r.reps[0]; assert.equal(q0.what, 'query'); assert.equal(q0.http, 200); assert.equal(q0.kind, 'server');
  assert.equal(RS.repText(q0), 'gis.massdot.state.ma.us FeatureServer/10 (MassDOT Road Inventory 2024 (gis.massdot.state.ma.us)) f=geojson: HTTP 200, the server reported an error: code 499: Token Required');
  assert.equal(RS.errOf({ error: { code: 400, message: 'Invalid URL' } }).detail, 'code 400: Invalid URL');
  assert.throws(() => RS.checkOverpass({ error: { code: 1, message: 'x' } }), e => e.kind === 'server');
  // every request of both layers was tried and reported: geojson, json, layer info, service info, then the same on services1
  deq(m.calls.map(c => hostOf(c.url) + ' ' + (new URL(c.url).pathname.split('/').slice(-2).join('/')) + ' ' + new URL(c.url).searchParams.get('f')),
    ['gis.massdot.state.ma.us 10/query geojson', 'gis.massdot.state.ma.us 10/query json', 'gis.massdot.state.ma.us FeatureServer/10 json', 'gis.massdot.state.ma.us RoadInventoryYearEndFiles/FeatureServer json',
     'services1.arcgis.com 0/query geojson', 'services1.arcgis.com 0/query json', 'services1.arcgis.com FeatureServer/0 json', 'services1.arcgis.com MassDOTRoads_gdb/FeatureServer json']);
});

const esriF = (id, pts, a) => ({ attributes: Object.assign({ OBJECTID: id }, a), geometry: { paths: [pts.map(p => toLL(p[0], p[1]))] } });
const BLOCK = (nmKey) => { const A = [0, 0], Bp = [300, 0], C = [300, 300], D = [0, 300], k = nmKey || 'St_Name';
  return [esriF(1, [A, Bp], { [k]: 'South Street' }), esriF(2, [Bp, C], { [k]: 'East Street' }), esriF(3, [C, D], { [k]: 'North Street' }), esriF(4, [D, A], { [k]: 'West Street' }), esriF(5, [A, C], { [k]: 'Diagonal Road' })]; };
test('H. 0 features -> layer + service info -> the polyline layer picked -> f=json -> roads -> route', async () => {
  const SVC = 'https://gis.massdot.state.ma.us/arcgis/rest/services/Roads/RoadInventoryYearEndFiles/FeatureServer';
  const m = mock(url => { const u = new URL(url), pth = u.pathname, f = u.searchParams.get('f');
    if (hostOf(url) !== 'gis.massdot.state.ma.us') return netErr();
    if (/\/10\/query$/.test(pth)) return resp(200, f === 'geojson' ? { type: 'FeatureCollection', features: [] } : { features: [] });
    if (/\/FeatureServer\/10$/.test(pth)) return resp(200, { id: 10, name: 'RoadInventory2024_Attributes', type: 'Table' });
    if (/\/FeatureServer$/.test(pth)) return resp(200, { layers: [{ id: 3, name: 'Mile Markers', geometryType: 'esriGeometryPoint' }, { id: 7, name: 'Road Inventory 2024', geometryType: 'esriGeometryPolyline' }, { id: 8, name: 'Town Boundaries', geometryType: 'esriGeometryPolyline' }], tables: [{ id: 10, name: 'RoadInventory2024_Attributes' }] });
    if (/\/7\/query$/.test(pth)) return resp(200, { features: BLOCK() });
    return resp(404, 'not found'); });
  const r = await RS.fetchMassDOT(B, m.f, { timeoutMs: 2000 });
  assert.equal(r.ok, true); assert.equal(r.src, 'massdot'); deq(r.layer, { url: SVC + '/7', name: 'Road Inventory 2024' });
  deq(m.calls.map(c => new URL(c.url).pathname.replace(/.*FeatureServer/, 'FS') + ' ' + new URL(c.url).searchParams.get('f')), ['FS/10/query geojson', 'FS/10 json', 'FS json', 'FS/7/query json']);
  deq(r.reps.map(RS.repText), ['gis.massdot.state.ma.us FeatureServer/10 (MassDOT Road Inventory 2024 (gis.massdot.state.ma.us)) f=geojson: HTTP 200, 0 features, 0 road lines',
    'gis.massdot.state.ma.us FeatureServer/10 info: HTTP 200, "RoadInventory2024_Attributes", Table',
    'gis.massdot.state.ma.us service info: HTTP 200, layers: 3 Mile Markers (Point); 7 Road Inventory 2024 (Polyline); 8 Town Boundaries (Polyline)',
    'picked "Road Inventory 2024" (layer 7, polyline, road-like name): gis.massdot.state.ma.us FeatureServer/7 f=json: HTTP 200, 5 features, 5 road lines']);
  const g = OSM.graph(r.json, proj), res = OSM.route(g, [{ x: -7.0711, y: -7.0711 }, { x: 307.0711, y: 307.0711 }], { label: 'MassDOT / MassGIS' });
  assert.equal(res.ok, true, res.why); near(res.L, 300 * Math.SQRT2, 0.05, 'A -> C along the diagonal'); deq(res.names.map(n => n.name), ['Diagonal Road']);
  // a root that lists no geometry types: the road-like layers are looked up (layer info each)
  const m2 = mock(url => { const pth = new URL(url).pathname;
    if (/\/10\/query$/.test(pth)) return resp(200, { features: [{ attributes: { OBJECTID: 1 }, geometry: null }] });   // features without geometry
    if (/\/FeatureServer\/10$/.test(pth)) return resp(200, { id: 10, name: 'Attributes', type: 'Table' });
    if (/\/FeatureServer$/.test(pth)) return resp(200, { layers: [{ id: 2, name: 'Bridges' }, { id: 5, name: 'Roads Arcs' }] });
    if (/\/FeatureServer\/5$/.test(pth)) return resp(200, { id: 5, name: 'Roads Arcs', type: 'Feature Layer', geometryType: 'esriGeometryPolyline' });
    if (/\/FeatureServer\/2$/.test(pth)) return resp(200, { id: 2, name: 'Bridges', type: 'Feature Layer', geometryType: 'esriGeometryPoint' });
    if (/\/5\/query$/.test(pth)) return resp(200, { features: BLOCK() });
    return netErr(); });
  const r2 = await RS.fetchMassDOT(B, m2.f, { timeoutMs: 2000 });
  assert.equal(r2.ok, true); assert.equal(r2.layer.name, 'Roads Arcs'); assert.equal(r2.json.elements.length, 5);
  assert.equal(RS.repText(r2.reps[0]), 'gis.massdot.state.ma.us FeatureServer/10 (MassDOT Road Inventory 2024 (gis.massdot.state.ma.us)) f=geojson: HTTP 200, 1 feature, 0 road lines');
});

test('I. no polyline layer in the first service -> the second MassGIS service answers', async () => {
  const gj = { type: 'FeatureCollection', features: [{ type: 'Feature', id: 7, properties: { STREET_NAME: 'POST ROAD' }, geometry: { type: 'LineString', coordinates: [toLL(0, 0), toLL(200, 0)] } }] };
  const m = mock(url => { const pth = new URL(url).pathname;
    if (hostOf(url) === 'services1.arcgis.com') return resp(200, gj);
    if (/query$/.test(pth)) return resp(200, { features: [] });
    if (/\/FeatureServer\/10$/.test(pth)) return resp(200, { id: 10, name: 'Attributes', type: 'Table' });
    return resp(200, { layers: [{ id: 1, name: 'Mile Markers', geometryType: 'esriGeometryPoint' }] }); });
  const r = await RS.fetchMassDOT(B, m.f, { timeoutMs: 2000 });
  assert.equal(r.ok, true); assert.equal(hostOf(r.used.url), 'services1.arcgis.com'); assert.equal(r.json.elements[0].tags.name, 'POST ROAD');
  assert.ok(r.reps.some(x => x.what === 'pick' && /no polyline layer found/.test(RS.repText(x))), r.reps.map(RS.repText).join(' | '));
  // nothing anywhere: ok false, empty (every layer answered)
  const m2 = mock(url => /query$/.test(new URL(url).pathname) ? resp(200, { features: [] }) : resp(200, { layers: [] }));
  const r2 = await RS.fetchMassDOT(B, m2.f, { timeoutMs: 2000 }); assert.equal(r2.ok, false); assert.equal(r2.empty, true);
});

test('J. Overpass busy: exponential backoff on the same endpoint (injected sleep / clock), then the next endpoint', async () => {
  let clock = 0; const waits = [], sleep = async ms => { waits.push(ms); clock += ms; }, now = () => clock;
  let n = 0; let m = mock(url => hostOf(url) === 'overpass-api.de' ? (++n <= 2 ? resp(502, '502 Gateway Timeout — This Overpass API server is currently at capacity') : resp(200, OSMJSON)) : resp(200, OSMJSON));
  let r = await RS.fetchOverpass(B, m.f, { OSM, timeoutMs: 2000, sleep, now });
  assert.equal(r.ok, true); assert.equal(hostOf(r.used.url), 'overpass-api.de'); deq(waits, [2000, 4000]);
  deq(m.calls.map(c => hostOf(c.url) + ' ' + c.method), ['overpass-api.de POST', 'overpass-api.de POST', 'overpass-api.de POST']);
  deq(r.log.map(l => [l.ok, l.http, l.wait || 0]), [[false, 502, 2000], [false, 502, 4000], [true, 200, 0]]);
  // always 502: 4 tries (waits 2 + 4 + 8 s = 14 s; the next, 16 s, is not in the list), GET skipped, then coffee answers
  waits.length = 0; clock = 0; m = mock(url => hostOf(url) === 'overpass-api.de' ? resp(502, 'at capacity') : resp(200, OSMJSON));
  r = await RS.fetchOverpass(B, m.f, { OSM, timeoutMs: 2000, sleep, now });
  assert.equal(r.ok, true); assert.equal(hostOf(r.used.url), 'overpass.private.coffee'); deq(waits, [2000, 4000, 8000]);
  deq(m.calls.map(c => hostOf(c.url) + ' ' + c.method), ['overpass-api.de POST', 'overpass-api.de POST', 'overpass-api.de POST', 'overpass-api.de POST', 'overpass.private.coffee POST']);
  deq(RS.summary(r.log).full, ['overpass-api.de POST (4 tries, backoff 2 + 4 + 8 s): HTTP 502 (the server is busy or down)']);
  // a timeout (each try 15 s on the virtual clock): one retry after 2 s (15 + 2 = 17 ≤ 30; 32 + 4 > 30), then the next endpoint
  waits.length = 0; clock = 0; m = mock(url => { if (hostOf(url) === 'overpass-api.de') { clock += 15000; return 'hang'; } return resp(200, OSMJSON); });
  r = await RS.fetchOverpass(B, m.f, { OSM, timeoutMs: 40, sleep, now });
  assert.equal(r.ok, true); deq(waits, [2000]); deq(m.calls.map(c => hostOf(c.url) + ' ' + c.method), ['overpass-api.de POST', 'overpass-api.de POST', 'overpass.private.coffee POST']);
  // every endpoint busy: all three tried, each with the backoff; the summary names them
  waits.length = 0; clock = 0; m = mock(() => resp(504, 'Gateway Timeout'));
  r = await RS.fetchOverpass(B, m.f, { OSM, timeoutMs: 2000, sleep, now });
  assert.equal(r.ok, false); deq(waits, [2000, 4000, 8000, 2000, 4000, 8000, 2000, 4000, 8000]); deq(RS.summary(r.log).hosts, ['overpass-api.de', 'overpass.private.coffee', 'maps.mail.ru']);
  assert.match(RS.summary(r.log).short, /^HTTP 504 \(the server is busy or down\) — overpass-api\.de POST \(4 tries, backoff 2 \+ 4 \+ 8 s\); 2 more endpoints also failed$/);
  // the lighter query: parking aisles and drive-throughs left out, [timeout:25]
  assert.match(OSM.query(B), /^\[out:json\]\[timeout:25\];way\["highway"~"\^\(motorway\|.*\)\$"\]\["service"!~"\^\(parking_aisle\|drive-through\)\$"\]\(42\.5,-71\.07,42\.51,-71\.06\);out geom;$/);
});

test('K. Rhode Island: RIDOT (f=geojson refused -> f=json) and never MassDOT; Connecticut: Local Roads + State Routes merged', async () => {
  const m = mock(url => { if (hostOf(url) !== 'risegis.ri.gov') return netErr(); const f = new URL(url).searchParams.get('f');
    return resp(200, f === 'geojson' ? { error: { code: 400, message: "Invalid or missing input parameters. 'geojson' format is not supported" } } : { features: BLOCK('NAME') }); });
  const r = await RS.fetchState(B, m.f, { st: 'RI', timeoutMs: 2000 });
  assert.equal(r.ok, true); assert.equal(r.src, 'ri'); assert.equal(r.json.elements[4].tags.name, 'Diagonal Road');
  assert.ok(m.calls.every(c => hostOf(c.url) === 'risegis.ri.gov'), 'RI: no MassDOT request'); assert.equal(m.calls.length, 2);
  assert.match(m.calls[0].url, /^https:\/\/risegis\.ri\.gov\/hosting\/rest\/services\/RIDOT\/Road_Centerlines\/MapServer\/0\/query\?/);
  const local = { features: [esriF(1, [[0, 0], [100, 0]], { ROAD_NAME: 'Local Lane' })] }, state = { features: [esriF(1, [[100, 0], [200, 0]], { ROAD_NAME: 'Route 2' })] };
  const m2 = mock(url => /\/FeatureServer\/1\/query/.test(url) ? resp(200, local) : /\/FeatureServer\/0\/query/.test(url) ? resp(200, state) : netErr());
  const r2 = await RS.fetchState(B, m2.f, { st: 'CT', timeoutMs: 2000 });
  assert.equal(r2.ok, true); assert.equal(r2.src, 'ct'); deq(r2.json.elements.map(e => e.tags.name), ['Local Lane', 'Route 2']); deq(r2.json.elements.map(e => e.id), ['m1', 'x1']);
  const g = OSM.graph(r2.json, proj); assert.equal(g.n, 3, 'joined at the shared end'); near(OSM.route(g, [{ x: 5, y: 0 }, { x: 195, y: 0 }]).L, 190, 1e-6);
});

test('L. diagnose: one tiny request per source, the raw outcome (HTTP, first 300 characters)', async () => {
  const long = 'x'.repeat(400);
  const m = mock(url => hostOf(url) === 'overpass-api.de' ? resp(502, '502 Gateway Timeout — This Overpass API server is currently at capacity. ' + long) : hostOf(url) === 'maps.mail.ru' ? netErr() : hostOf(url) === 'risegis.ri.gov' ? resp(200, { error: { code: 498, message: 'Invalid token' } }) : resp(200, 'Connected as: 1234 ' + long));
  const out = await RS.diagnose(m.f, GREEN, { zone: 'EPSG:2249', timeoutMs: 2000 });
  assert.equal(out.state.st, 'RI'); assert.equal(out.length, 9); assert.ok(!m.calls.some(c => /massdot|services1\.arcgis/.test(c.url)), 'no MassDOT request for an RI site');
  deq(out.map(o => o.label), ['overpass-api.de status', 'overpass-api.de one-way query', 'overpass.private.coffee status', 'overpass.private.coffee one-way query', 'maps.mail.ru status', 'maps.mail.ru one-way query',
    'risegis.ri.gov MapServer/0 info', 'risegis.ri.gov service info', 'risegis.ri.gov MapServer/0 1-record query']);
  assert.equal(out[0].http, 502); assert.equal(out[0].body.length, 300); assert.match(out[0].body, /^502 Gateway Timeout — This Overpass API server is currently at capacity/);
  assert.equal(out[4].http, null); assert.match(out[4].err, /^network error/);
  assert.equal(out[8].http, 200); assert.equal(out[8].body, '{"error":{"code":498,"message":"Invalid token"}}');
  const q = new URL(out[8].url); assert.equal(q.searchParams.get('resultRecordCount'), '1'); assert.equal(q.searchParams.get('f'), 'json');
  assert.equal(decodeURIComponent(out[1].url.split('?data=')[1]), '[out:json][timeout:10];way["highway"](around:30,41.7045,-71.4466);out ids 1;');
});
