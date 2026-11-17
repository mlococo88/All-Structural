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
import assert from 'node:assert/strict';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps', 'crane-pick', 'engine');
const W = loadShared(path.join(APP, 'osm.js'), path.join(APP, 'roadsrc.js'));
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
  assert.ok(RS.inMA(42.506, -71.066), 'Wakefield, MA'); assert.ok(!RS.inMA(40.71, -74.0), 'New York City');
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
  assert.match(s.short, /^network error: .* — overpass-api\.de POST; 2 more endpoints also failed$/); assert.equal(s.full.length, 6);
});

test('D. GET fallback after HTTP 405; a timeout skips that endpoint\'s GET; bad JSON moves on', async () => {
  let m = mock((url, i) => i.method === 'POST' ? resp(405, 'Method Not Allowed') : resp(200, OSMJSON));
  let r = await RS.fetchOverpass(B, m.f, { OSM, timeoutMs: 2000 });
  assert.equal(r.ok, true); assert.equal(hostOf(r.used.url), 'overpass-api.de'); assert.equal(r.used.how, 'GET'); assert.equal(r.log[0].code, 405);
  m = mock(url => hostOf(url) === 'overpass-api.de' ? 'hang' : resp(200, OSMJSON));
  const t0 = Date.now(); r = await RS.fetchOverpass(B, m.f, { OSM, timeoutMs: 60 });
  assert.equal(r.ok, true); assert.ok(Date.now() - t0 < 1500); deq(m.calls.map(c => hostOf(c.url) + ' ' + c.method), ['overpass-api.de POST', 'overpass.private.coffee POST']);
  assert.equal(r.log[0].kind, 'timeout');
  m = mock(url => hostOf(url) === 'overpass-api.de' ? resp(200, '<html><body>Web filter: sign in</body></html>') : resp(200, OSMJSON));
  r = await RS.fetchOverpass(B, m.f, { OSM, timeoutMs: 2000 }); assert.equal(r.ok, true); assert.equal(r.log[0].kind, 'json'); assert.match(r.log[0].text, /<html><body>Web filter/);
  m = mock(url => hostOf(url) === 'overpass-api.de' ? resp(200, { elements: [], remark: 'runtime error: Query timed out in "query" at line 1' }) : resp(200, OSMJSON));
  r = await RS.fetchOverpass(B, m.f, { OSM, timeoutMs: 2000 }); assert.equal(r.ok, true); assert.equal(r.log[0].kind, 'server');
  // HTTP 429 on de: its GET is skipped (the server, not the form)
  m = mock(url => hostOf(url) === 'overpass-api.de' ? resp(429, 'Too Many Requests') : resp(200, OSMJSON));
  r = await RS.fetchOverpass(B, m.f, { OSM, timeoutMs: 2000 }); deq(m.calls.map(c => hostOf(c.url) + ' ' + c.method), ['overpass-api.de POST', 'overpass.private.coffee POST']);
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
  assert.equal(u0.searchParams.get('geometry'), [B.w, B.s, B.e, B.n].join(',')); assert.equal(u0.searchParams.get('geometryType'), 'esriGeometryEnvelope');
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
