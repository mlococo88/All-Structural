/* apps/crane-pick/engine/roadsrc.js — where Snap to road gets its roads (window.CranePickRoadSrc). 2026-11-17 (engineer bug report:
   "Snap to road: no OpenStreetMap roads (offline or blocked)" on a real site while the OSM street tiles loaded).
   No DOM. The fetch function is passed in (ui/road.js passes window.fetch; the Node tests pass a mock), so every path is testable.
   1. Overpass API endpoints (public instances, OSM wiki "Overpass API" list, checked 2026-11-17 by web search; not reachable from the
      build session): tried in order, the one that last worked first, each with a short timeout; per endpoint a POST form body first
      (no CORS preflight), then GET ?data= (some proxies block POST). An endpoint typed in the settings is tried first.
   2. State road centrelines (ArcGIS REST layer "query": JSON envelope in WGS 84, outSR 4326, f=geojson then f=json), normalised into
      the Overpass JSON shape (ways with geometry, tags name / ref / oneway) so engine/osm.js builds the same road graph.
   3. Error classification: network / CORS (the browser does not say which), timeout, HTTP code, bad answer, server error.
   2026-11-17 (second bug report, Greenwood, Warwick RI: overpass-api.de "at capacity" -> timed out; then "no drivable MassDOT /
   MassGIS roads … 0 road segments"): the site is in RHODE ISLAND and the old "in Massachusetts" test was a latitude / longitude box
   that also covers RI and most of CT, so MassDOT was asked and rightly had no roads there. Now:
   - stateOf(lat, lng, zone): the state from the site's location (engine/states.js outlines, point in polygon), the project's State
     Plane zone deciding within 2 km of a border (the outlines are coarse) or just off the outlines; MA -> MassDOT / MassGIS,
     RI -> RIGIS / RIDOT, CT -> CTDOT; any other place -> no state source (OpenStreetMap only).
   - ArcGIS: an { error } answer (ArcGIS sends it with HTTP 200) is shown with its code / message; an answer with no road lines
     (0 features, or features without line geometry: a table or a wrong layer) looks up the layer and the service (?f=json), picks
     the polyline layer (geometryType esriGeometryPolyline, name like road / inventory / centerline / arc / street) and asks it once
     more with f=json; then the next layer of the state; per request the report says HTTP, error, feature count and layer name.
   - Overpass "busy" (HTTP 429 / 502 / 503 / 504 or a timeout): the same endpoint is asked again after 2, 4, 8 s (exponential backoff,
     at most 30 s per endpoint including the waits) before the next endpoint. sleep / now are injectable (tests).
   - diagnose(): one tiny request per source (status page, a one-way query; layer / service info, a 1-record query at the site centre):
     the raw outcome (HTTP code, time, the first 300 characters of the answer) for the engineer to screenshot. */
(function () {
  'use strict';
  const OVERPASS = [
    { id: 'de', url: 'https://overpass-api.de/api/interpreter', status: 'https://overpass-api.de/api/status', name: 'overpass-api.de (FOSSGIS, the main instance)' },
    { id: 'coffee', url: 'https://overpass.private.coffee/api/interpreter', status: 'https://overpass.private.coffee/api/status', name: 'overpass.private.coffee (formerly overpass.kumi.systems)' },
    { id: 'vk', url: 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', status: 'https://maps.mail.ru/osm/tools/overpass/api/status', name: 'maps.mail.ru (VK Maps)' }
  ];
  /* the state road-centreline sources (found by web search 2026-11-17; none reachable from the build session: Decision pending
     engineer review). Each layer URL is editable in Road data settings; a wrong layer index is corrected by the layer look-up.
     MA: MassDOT Road Inventory 2024 (MassDOT's own ArcGIS Server; St_Name, Oneway FT / TF), then MassGIS-MassDOT Roads (ArcGIS Online).
     RI: RIDOT Road Centerlines (RI enterprise GIS, a MapServer; layer 0 assumed, looked up when it has no lines).
     CT: CTDOT Datamart "State Routes and Local Roads": layer 1 Local Roads, also layer 0 State Routes (both asked, merged). */
  const STATES = {
    MA: { st: 'MA', name: 'Massachusetts', data: 'massdot', label: 'MassDOT / MassGIS', set: 'md', last: 'lastMd', layers: [
      { id: 'massdot', url: 'https://gis.massdot.state.ma.us/arcgis/rest/services/Roads/RoadInventoryYearEndFiles/FeatureServer/10', name: 'MassDOT Road Inventory 2024 (gis.massdot.state.ma.us)' },
      { id: 'massgis', url: 'https://services1.arcgis.com/hGdibHYSPO59RG1h/ArcGIS/rest/services/MassDOTRoads_gdb/FeatureServer/0', name: 'MassGIS-MassDOT Roads (services1.arcgis.com)' }] },
    RI: { st: 'RI', name: 'Rhode Island', data: 'ri', label: 'RIGIS / RIDOT', set: 'ri', last: 'lastRi', layers: [
      { id: 'ridot', url: 'https://risegis.ri.gov/hosting/rest/services/RIDOT/Road_Centerlines/MapServer/0', name: 'RIDOT Road Centerlines (risegis.ri.gov)' }] },
    CT: { st: 'CT', name: 'Connecticut', data: 'ct', label: 'CTDOT / CT DEEP', set: 'ct', last: 'lastCt', layers: [
      { id: 'ctdot', url: 'https://gisportal.dot.ct.gov/server/rest/services/Datamart/State_Routes_and_Local_Roads/FeatureServer/1', name: 'CTDOT Local Roads + State Routes (gisportal.dot.ct.gov)',
        also: ['https://gisportal.dot.ct.gov/server/rest/services/Datamart/State_Routes_and_Local_Roads/FeatureServer/0'] }] }
  };
  const MASSDOT = STATES.MA.layers;
  const dataOf = st => (STATES[st] || {}).data || null;
  const stOfData = d => Object.keys(STATES).find(k => STATES[k].data === d) || null;
  // the State Plane zones of engine/geo.js -> their state
  const ZONE_STATE = { 'EPSG:2249': 'MA', 'EPSG:26986': 'MA', 'EPSG:3438': 'RI', 'EPSG:2234': 'CT' };
  const TIMEOUT_MS = 15000, MAX_PAGES = 10, BORDER_KM = 2, NEAR_KM = 5;
  const BACKOFF = { delays: [2000, 4000, 8000], budget: 30000, codes: [429, 502, 503, 504] };
  const host = u => { const m = /^https?:\/\/([^/?#]+)/i.exec(String(u || '')); return m ? m[1] : String(u || ''); };
  const validUrl = u => /^https:\/\/[^\s/?#]+\.[^\s/?#]+\/\S*$/i.test(String(u || '').trim());
  /* ---------- which state: point in polygon (engine/states.js), the zone near a border ---------- */
  function inRing(x, y, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
  /* the distance (km) from lat / lng to a state's outline (a local flat frame: 111.32 km per degree of latitude) */
  function distKm(lat, lng, rings) {
    const ky = 111.32, kx = ky * Math.cos(lat * Math.PI / 180); let best = Infinity;
    (rings || []).forEach(r => { for (let i = 1; i < r.length; i++) { const ax = (r[i - 1][0] - lng) * kx, ay = (r[i - 1][1] - lat) * ky, bx = (r[i][0] - lng) * kx, by = (r[i][1] - lat) * ky, dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      let t = L2 ? -(ax * dx + ay * dy) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; const d = Math.hypot(ax + dx * t, ay + dy * t); if (d < best) best = d; } });
    return best;
  }
  /* stateOf(lat, lng, zone, S) -> { st ('MA' | 'RI' | 'CT' | null), by ('location' | 'zone' | 'none'), note } */
  function stateOf(lat, lng, zone, S) {
    S = S || (typeof window !== 'undefined' && window.CranePickStates) || {};
    const z = ZONE_STATE[zone] || null, nm = k => (STATES[k] || {}).name || k;
    const poly = Object.keys(STATES).find(k => (S[k] || []).some(r => inRing(lng, lat, r))) || null;
    const dz = z && S[z] ? distKm(lat, lng, S[z]) : Infinity;
    if (poly && (!z || poly === z)) return { st: poly, by: 'location', note: '' };
    if (poly) return dz <= BORDER_KM ? { st: z, by: 'zone', note: `near the ${nm(poly)} – ${nm(z)} border: the project's State Plane zone (${nm(z)}) decides` }
      : { st: poly, by: 'location', note: `the site is in ${nm(poly)} (the project's State Plane zone is ${nm(z)})` };
    if (z && dz <= NEAR_KM) return { st: z, by: 'zone', note: '' };
    return { st: null, by: 'none', note: 'the site is not in Massachusetts, Rhode Island or Connecticut: no state road source' };
  }
  /* the status (Test connection) URL of an endpoint: Overpass ".../api/interpreter" -> ".../api/status"; an ArcGIS layer -> its JSON */
  function statusUrl(u) { u = String(u || '').trim(); const m = /^(.*\/api)\/interpreter\/?$/.exec(u); if (m) return m[1] + '/status'; if (/\/(FeatureServer|MapServer)\/\d+\/?$/i.test(u)) return u.replace(/\/$/, '') + '?f=pjson'; return u; }
  /* the service root of a layer URL (".../FeatureServer/10" -> ".../FeatureServer") */
  const serviceOf = u => String(u || '').replace(/\/$/, '').replace(/\/\d+$/, '');
  const layerTail = u => { const m = /\/((?:FeatureServer|MapServer)\/\d+)\/?$/i.exec(String(u || '')); return m ? m[1] : host(u); };
  /* the Overpass endpoints in the order tried: the one typed in the settings, the one that last worked, then the list */
  function overpassOrder(custom, last) {
    const out = [], add = (u, name) => { u = String(u || '').trim(); if (!validUrl(u) || out.some(e => e.url === u)) return; const k = OVERPASS.find(e => e.url === u); out.push(k ? Object.assign({}, k) : { id: 'custom', url: u, status: statusUrl(u), name: name || host(u) }); };
    add(custom, host(custom) + ' (settings)'); add(last); OVERPASS.forEach(e => add(e.url)); return out;
  }
  /* the layers of a state in the order tried: the one typed in the settings, the one that last worked, then the list */
  function stateOrder(st, custom, last) {
    const S = STATES[st]; if (!S) return [];
    const out = [], add = (u, name) => { u = String(u || '').trim().replace(/\/query\/?$/i, '').replace(/\/$/, ''); if (!validUrl(u + '/') || out.some(e => e.url === u)) return; const k = S.layers.find(e => e.url === u); out.push(k ? Object.assign({}, k) : { id: 'custom', url: u, name: name || host(u) }); };
    add(custom, host(custom) + ' (settings)'); add(last); S.layers.forEach(e => add(e.url)); return out.map(e => Object.assign(e, { status: statusUrl(e.url) }));
  }
  const massdotOrder = (custom, last) => stateOrder('MA', custom, last);
  /* the requests for one source: Overpass POST then GET per endpoint; ArcGIS GET (a query URL) */
  function overpassAttempts(eps, q) {
    const out = []; eps.forEach(e => { out.push({ ep: e, how: 'POST', url: e.url, init: { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) } });
      out.push({ ep: e, how: 'GET', url: e.url + '?data=' + encodeURIComponent(q), init: { method: 'GET' } }); }); return out;
  }
  /* the query URL: the envelope as JSON with its spatial reference (WGS 84), so the server cannot misread it */
  function arcgisQueryUrl(base, b, f, offset, extra) {
    const env = JSON.stringify({ xmin: b.w, ymin: b.s, xmax: b.e, ymax: b.n, spatialReference: { wkid: 4326 } });
    const p = [['where', '1=1'], ['geometry', env], ['geometryType', 'esriGeometryEnvelope'], ['inSR', '4326'], ['spatialRel', 'esriSpatialRelIntersects'],
      ['outFields', '*'], ['returnGeometry', 'true'], ['outSR', '4326'], ['f', f || 'geojson']];
    if (offset) p.push(['resultOffset', String(offset)]);
    (extra || []).forEach(x => p.push(x));
    return String(base).replace(/\/$/, '') + '/query?' + p.map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  }
  /* classify(x) -> { kind, text }: x is a thrown error (fetch rejects with a TypeError for a network / CORS failure, an AbortError on our
     timeout) or an error we made ({ http }, { kind: 'json' | 'server' | 'empty' }) */
  function classify(x, ms) {
    x = x || {}; const s = isFinite(ms) ? Math.round(ms / 1000) : null;
    if (x.kind === 'timeout' || x.name === 'AbortError' || x.name === 'TimeoutError') return { kind: 'timeout', text: `timed out${s ? ' after ' + s + ' s' : ''} (no answer: the server is busy or the network holds the request)` };
    if (x.http) { const c = x.http; return { kind: 'http', code: c, text: `HTTP ${c} ${c === 429 ? '(too many requests: the server limits use; wait a minute)' : c === 504 || c === 503 || c === 502 ? '(the server is busy or down)' : c === 403 ? '(forbidden: refused by the server or by a proxy / firewall)' : c === 405 ? '(method not allowed: a proxy may block POST)' : c === 400 ? '(bad request)' : c === 404 ? '(not found: check the URL)' : ''}`.trim() }; }
    if (x.kind === 'json') return { kind: 'json', text: 'the answer is not the expected JSON' + (x.detail ? ' (' + x.detail + ')' : '') + ' (a proxy / login page in its place?)' };
    if (x.kind === 'server') return { kind: 'server', text: 'the server reported an error' + (x.detail ? ': ' + x.detail : '') };
    if (x.kind === 'empty') return { kind: 'empty', text: x.detail || 'no roads in the answer' };
    if (x.name === 'TypeError' || /fetch|network|cors|load failed/i.test(String(x.message || ''))) return { kind: 'network', text: 'network error: offline, the network / firewall blocks the server, or the answer had no CORS header (the browser does not say which)', brief: 'network error (offline, blocked, or no CORS header)' };
    return { kind: 'other', text: String(x.message || x) };
  }
  /* an { error: { code, message, details } } answer (ArcGIS sends it with HTTP 200; any JSON is checked) -> a server error */
  function errOf(j) { if (!j || typeof j !== 'object' || !j.error) return null; const e = j.error; if (typeof e !== 'object') return { kind: 'server', detail: String(e).slice(0, 160) };
    const d = Array.isArray(e.details) ? e.details.filter(Boolean).join(' ') : ''; return { kind: 'server', detail: [e.code != null ? 'code ' + e.code : '', e.message, d].filter(Boolean).join(': ').slice(0, 160), code: e.code }; }
  /* one attempt with a timeout; check(json) throws an error object or returns the json. Resolves { v, status } */
  async function one(fetchFn, a, ms, check) {
    const ac = typeof AbortController === 'function' ? new AbortController() : null;
    let tm = null; const timer = new Promise((_, rej) => { tm = setTimeout(() => { if (ac) ac.abort(); rej({ kind: 'timeout' }); }, ms); });
    try {
      const r = await Promise.race([fetchFn(a.url, Object.assign({ cache: 'no-store', signal: ac ? ac.signal : undefined }, a.init)), timer]);
      if (!r || !r.ok) throw { http: r ? r.status : 0 };
      let txt; try { txt = await Promise.race([r.text(), timer]); } catch (e) { throw e && e.kind ? Object.assign(e, { status: r.status }) : { kind: 'json', detail: 'could not read the answer', status: r.status }; }
      let json; try { json = JSON.parse(txt); } catch (e) { throw { kind: 'json', detail: String(txt || '').trim().slice(0, 40).replace(/\s+/g, ' ') || 'empty answer', status: r.status }; }
      try { return { v: check(json), status: r.status }; } catch (e) { if (e && typeof e === 'object') e.status = r.status; throw e; }
    } finally { clearTimeout(tm); }
  }
  const sleepDefault = ms => new Promise(res => setTimeout(res, ms));
  /* run(attempts, fetchFn, check, o) -> { ok: true, json, used, log } | { ok: false, log }: the attempts in order until one works.
     A "busy" answer (timeout, HTTP 429 / 502 / 503 / 504): with o.backoff the same attempt again after 2, 4, 8 s while the time on
     that endpoint stays within 30 s; then (and after any other HTTP 5xx) the same endpoint's other forms are skipped (the server,
     not the form, is the problem). Log entries: { ep, how, ok, kind, code, http, text, brief, wait (ms before the next try) } */
  async function run(attempts, fetchFn, check, o) {
    o = o || {}; const ms = o.timeoutMs || TIMEOUT_MS, log = [], skip = new Set(), bo = o.backoff || null;
    const sleep = o.sleep || sleepDefault, now = o.now || (() => Date.now()), t0 = new Map();
    for (const a of attempts) {
      if (skip.has(a.ep.url)) continue;
      if (!t0.has(a.ep.url)) t0.set(a.ep.url, now());
      for (let k = 0; ;) {
        try { const r = await one(fetchFn, a, ms, check); log.push({ ep: a.ep, how: a.how, ok: true, http: r.status }); return { ok: true, json: r.v, used: a, log }; }
        catch (x) {
          const c = classify(x, ms), busy = c.kind === 'timeout' || (c.kind === 'http' && BACKOFF.codes.indexOf(c.code) >= 0);
          const l = { ep: a.ep, how: a.how, ok: false, kind: c.kind, code: c.code, http: c.code || (x && x.status) || null, text: c.text, brief: c.brief || c.text }; log.push(l);
          if (busy && bo && k < bo.delays.length && (now() - t0.get(a.ep.url)) + bo.delays[k] <= bo.budget) {
            l.wait = bo.delays[k++]; if (o.onTry) o.onTry(log); if (o.onWait) o.onWait(a, l.wait, k, bo.delays.length); await sleep(l.wait); continue; }
          if (busy || (c.kind === 'http' && c.code >= 500)) skip.add(a.ep.url);
          if (o.onTry) o.onTry(log); break;
        }
      }
    }
    return { ok: false, log };
  }
  /* Overpass: the JSON must carry elements[]; a runtime error with no elements (remark) is a server error */
  function checkOverpass(j) {
    const er = errOf(j); if (er) throw er;
    if (!j || !Array.isArray(j.elements)) throw { kind: 'json', detail: 'no "elements"' };
    if (!j.elements.length && j.remark && /error/i.test(j.remark)) throw { kind: 'server', detail: String(j.remark).slice(0, 120) };
    return j;
  }
  /* fetchOverpass(b, fetchFn, o): every endpoint with the backoff (o.backoff: false = none; an object = other delays) */
  async function fetchOverpass(b, fetchFn, o) {
    o = o || {}; const OSM = o.OSM || (typeof window !== 'undefined' && window.CranePickOSM), eps = overpassOrder(o.custom, o.last);
    const opt = Object.assign({}, o, { backoff: o.backoff === false ? null : (o.backoff || BACKOFF) });
    const r = await run(overpassAttempts(eps, OSM.query(b)), fetchFn, checkOverpass, opt); r.src = 'osm'; r.eps = eps; return r;
  }
  /* ArcGIS: an { error } object (HTTP 200) is a server error; GeoJSON (features[].geometry LineString / MultiLineString) or Esri JSON
     (features[].geometry.paths) */
  function checkArcgis(j) {
    const er = errOf(j); if (er) throw er;
    if (!j || !Array.isArray(j.features)) throw { kind: 'json', detail: 'no "features"' };
    return j;
  }
  /* layer / service info (?f=json): any object without { error } */
  function checkInfo(j) { const er = errOf(j); if (er) throw er; if (!j || typeof j !== 'object') throw { kind: 'json', detail: 'not an object' }; return j; }
  const exceeded = j => !!(j && (j.exceededTransferLimit || (j.properties && j.properties.exceededTransferLimit)));
  const ROADY = /road|inventory|centerline|centreline|street|arc|route|rdwy|roadway/i;
  /* pickLayer(svc, root, metas, cur) -> { url, name, why } | null: the polyline layer of the service (root.layers; metas: { id -> layer
     info } for servers whose root lists no geometry types). Ranked: a road-like name, then the current layer, then the lowest id. */
  function pickLayer(svc, root, metas, cur) {
    const all = [].concat(root && Array.isArray(root.layers) ? root.layers : []).map(l => Object.assign({}, l, (metas || {})[l.id] || {}));
    const lines = all.filter(l => l && l.geometryType === 'esriGeometryPolyline' && String(l.type || 'Feature Layer') !== 'Table');
    if (!lines.length) return null;
    const cid = (/\/(\d+)\/?$/.exec(String(cur || '')) || [])[1], score = l => (ROADY.test(l.name || '') ? 4 : 0) + (String(l.id) === cid ? 1 : 0);
    lines.sort((a, b) => score(b) - score(a) || a.id - b.id); const l = lines[0];
    return { url: svc + '/' + l.id, name: l.name || ('layer ' + l.id), why: `"${l.name || 'layer ' + l.id}" (layer ${l.id}, polyline${ROADY.test(l.name || '') ? ', road-like name' : ''})` };
  }
  const noBackoff = o => Object.assign({}, o, { backoff: null });
  /* queryLayer: one layer, one format, paged while the server says the transfer limit was exceeded (≤ MAX_PAGES) */
  async function queryLayer(url, b, f, fetchFn, o, ep, log) {
    const feats = []; let off = 0, page = 0, res = null;
    for (; page < MAX_PAGES; page++) {
      res = await run([{ ep, how: 'GET ' + layerTail(url) + ' f=' + f + (off ? ' offset ' + off : ''), url: arcgisQueryUrl(url, b, f, off), init: { method: 'GET' } }], fetchFn, checkArcgis, noBackoff(o));
      log.push(...res.log); if (!res.ok) break;
      feats.push(...res.json.features); if (!exceeded(res.json) || !res.json.features.length) break; off += res.json.features.length;
    }
    const last = res ? res.log[res.log.length - 1] : null;
    return { ok: !!(res && res.ok), feats, lines: res && res.ok ? toOverpass({ features: feats }).n : 0, more: page >= MAX_PAGES, used: res && res.used, last };
  }
  const repQ = (url, name, f, q) => ({ what: 'query', url, layer: layerTail(url), name: name || '', f, http: q.last ? q.last.http : null, ok: q.ok, err: q.ok ? '' : (q.last ? q.last.text : ''), n: q.feats.length, lines: q.lines, kind: q.ok ? '' : (q.last ? q.last.kind : '') });
  const repI = (what, url, r) => { const l = r.log[r.log.length - 1] || {}, j = r.ok ? r.json : null;
    return { what, url, layer: what === 'service info' ? host(url) : layerTail(url), http: l.http || null, ok: r.ok, err: r.ok ? '' : l.text, name: j && j.name ? String(j.name) : '', type: j && j.type ? String(j.type) : '', geom: j && j.geometryType ? String(j.geometryType) : '', kind: r.ok ? '' : l.kind,
      layers: j && Array.isArray(j.layers) ? j.layers.map(x => `${x.id} ${x.name || ''}${x.geometryType ? ' (' + String(x.geometryType).replace('esriGeometry', '') + ')' : ''}`).slice(0, 12) : null }; };
  const info = (url, how, e, fetchFn, o) => run([{ ep: e, how, url: url + '?f=json', init: { method: 'GET' } }], fetchFn, checkInfo, noBackoff(o));
  /* fetchState(b, fetchFn, o): o.st 'MA' | 'RI' | 'CT'. Per layer of the state: f=geojson, then f=json (when the server refused
     geojson); no road lines -> the layer and service info, the polyline layer picked, asked once more with f=json; then the next
     layer. Resolves { ok, json, used, log, reps (one per request: what, layer, name, f, HTTP, error, features, lines), layer: { url, name },
     src: the data id ('massdot' | 'ri' | 'ct'), st, eps, more } or { ok: false, log, reps, empty (every layer answered, no roads) } */
  async function fetchState(b, fetchFn, o) {
    o = o || {}; const st = o.st || 'MA', S = STATES[st], eps = stateOrder(st, o.custom, o.last), log = [], reps = [];
    const base = { src: S ? S.data : null, st, eps };
    if (!S) return Object.assign({ ok: false, log, reps, why: 'no state road source for this place' }, base);
    const done = (q, url, name, f) => ({ ok: true, json: toOverpass({ features: q.feats }), used: q.used, log, reps, layer: { url, name: name || layerTail(url) }, more: q.more, f });
    let answered = 0;
    for (const e of eps) {
      let res = null, dead = false;
      for (const f of ['geojson', 'json']) {
        const q = await queryLayer(e.url, b, f, fetchFn, o, e, log); reps.push(repQ(e.url, e.name, f, q));
        if (q.ok && q.lines > 0) { res = done(q, e.url, e.name, f); break; }
        if (q.ok) { answered++; break; }   // an answer, but no road lines: look the layer up
        if (q.last && (q.last.kind === 'network' || q.last.kind === 'timeout')) { dead = true; break; }   // the server is not reachable: next layer
        if (q.last && q.last.kind === 'http' && q.last.code !== 400 && q.last.code !== 404) { dead = true; break; }
      }
      if (!res && !dead) {   // the layer and the service: pick the polyline layer, ask it once more with f=json
        const mi = await info(e.url, 'GET ' + layerTail(e.url) + ' info', e, fetchFn, o); log.push(...mi.log); reps.push(repI('layer info', e.url, mi));
        const svc = serviceOf(e.url), ri = await info(svc, 'GET service info', e, fetchFn, o); log.push(...ri.log); reps.push(repI('service info', svc, ri));
        const metas = {}, cid = (/\/(\d+)$/.exec(e.url) || [])[1]; if (mi.ok && cid != null) metas[cid] = { geometryType: mi.json.geometryType, type: mi.json.type, name: mi.json.name };
        if (ri.ok && Array.isArray(ri.json.layers)) {   // a root that lists no geometry types (older servers): look up the road-like layers (≤ 4)
          const need = ri.json.layers.filter(l => l && !l.geometryType && !metas[l.id]).sort((a, c) => (ROADY.test(c.name || '') ? 1 : 0) - (ROADY.test(a.name || '') ? 1 : 0)).slice(0, 4);
          for (const l of need) { const u = svc + '/' + l.id, r = await info(u, 'GET ' + layerTail(u) + ' info', e, fetchFn, o); log.push(...r.log); reps.push(repI('layer info', u, r)); if (r.ok) metas[l.id] = { geometryType: r.json.geometryType, type: r.json.type, name: r.json.name }; }
        }
        const root = ri.ok && Array.isArray(ri.json.layers) ? ri.json : (mi.ok && cid != null ? { layers: [{ id: +cid, name: mi.json.name }] } : null), pk = pickLayer(svc, root, metas, e.url);
        if (pk) {
          const q = await queryLayer(pk.url, b, 'json', fetchFn, o, e, log), rp = repQ(pk.url, pk.name, 'json', q); rp.picked = pk.why; reps.push(rp);
          if (q.ok && q.lines > 0) res = done(q, pk.url, pk.name, 'json'); else if (q.ok) answered++;
        } else reps.push({ what: 'pick', url: svc, layer: host(svc), ok: false, err: 'no polyline layer found in the service', n: 0, lines: 0 });
      }
      if (res) {   // companion layers (CT: State Routes with Local Roads), merged; a failure is reported, not fatal
        const feats = [];
        for (const u of (e.also || [])) { const q = await queryLayer(u, b, res.f, fetchFn, o, e, log); reps.push(Object.assign(repQ(u, '', res.f, q), { also: true })); if (q.ok) feats.push(...q.feats); }
        if (feats.length) { const extra = toOverpass({ features: feats }, 'x'); res.json.elements.push(...extra.elements); res.json.n += extra.n; }
        return Object.assign(res, base);
      }
    }
    return Object.assign({ ok: false, log, reps, empty: answered > 0 }, base);
  }
  const fetchMassDOT = (b, fetchFn, o) => fetchState(b, fetchFn, Object.assign({}, o, { st: 'MA' }));
  /* ArcGIS features -> Overpass-shaped ways: { elements: [{ type: 'way', id, geometry: [{ lat, lon }], tags: { highway: 'road', name,
     ref, oneway, src } }] }. Fields read case-insensitively: name St_Name / STREET_NAME / STREETNAME / STREET_NAM / STNAME / ROAD_NAME /
     ROADNAME / RD_NAME / FULLNAME / FULL_NAME / NAME; route RT_NUMBER / Route_Number / RTNUMBER / ROUTE_NUM; one-way Oneway FT (with
     the line's digitising direction) -> yes, TF -> -1 (MassDOT Road Inventory; no other one-way coding is read: no warnings). No node
     ids: the graph joins ways at identical end coordinates (to 1e-7°). pre: the way id prefix ('m'). */
  function field(a, names) { if (!a) return null; const k = Object.keys(a); for (const n of names) { const f = k.find(x => x.toLowerCase() === n); if (f != null && a[f] != null && String(a[f]).trim() !== '' && String(a[f]).trim() !== '0') return String(a[f]).trim(); } return null; }
  function toOverpass(j, pre) {
    const els = []; let n = 0;
    (j && Array.isArray(j.features) ? j.features : []).forEach((f, i) => {
      if (!f) return; const a = f.properties || f.attributes || {}, g = f.geometry || {};
      let lines = [];
      if (g.type === 'LineString') lines = [g.coordinates]; else if (g.type === 'MultiLineString') lines = g.coordinates; else if (Array.isArray(g.paths)) lines = g.paths;
      const name = field(a, ['st_name', 'street_name', 'streetname', 'street_nam', 'stname', 'road_name', 'roadname', 'rd_name', 'fullname', 'full_name', 'name']), ref = field(a, ['rt_number', 'route_number', 'rtnumber', 'route_num']);
      const ow = String(field(a, ['oneway']) || '').toUpperCase(), oid = field(a, ['objectid', 'fid', 'objectid_1']) || f.id || i;
      (lines || []).forEach((ln, k) => {
        if (!Array.isArray(ln) || ln.length < 2) return;
        const geometry = ln.filter(c => Array.isArray(c) && isFinite(c[0]) && isFinite(c[1])).map(c => ({ lat: +c[1], lon: +c[0] })); if (geometry.length < 2) return;
        const tags = { highway: 'road', src: 'massdot' }; if (name) tags.name = name; if (ref) tags.ref = ref; if (ow === 'FT') tags.oneway = 'yes'; else if (ow === 'TF') tags.oneway = '-1';
        els.push({ type: 'way', id: (pre || 'm') + oid + (lines.length > 1 ? '_' + k : ''), geometry, tags }); n++;
      });
    });
    return { elements: els, n };
  }
  /* summary(log) -> short: the first endpoint's error (and how many more failed); full: one line per endpoint and error ("host POST + GET:
     network error (…)", "(3 tries, backoff 2 + 4 s)" when it was asked again); first: the first failed attempt; hosts: those tried */
  function summary(log) {
    const bad = (log || []).filter(l => !l.ok); if (!bad.length) return { short: '', full: [], hosts: [] };
    const first = bad[0], hosts = [...new Set(bad.map(l => host(l.ep.url)))], grp = [];
    bad.forEach(l => { const h = host(l.ep.url), t = l.brief || l.text, g = grp.find(x => x.h === h && x.t === t); if (g) { if (g.how.indexOf(l.how) < 0) g.how.push(l.how); g.n++; if (l.wait) g.w.push(l.wait); } else grp.push({ h, t, how: [l.how], n: 1, w: l.wait ? [l.wait] : [] }); });
    const tries = g => g.n > g.how.length ? ` (${g.n} tries${g.w.length ? ', backoff ' + g.w.map(w => w / 1000).join(' + ') + ' s' : ''})` : '';
    return { short: `${first.text} — ${host(first.ep.url)} ${first.how}${tries(grp[0])}${hosts.length > 1 ? `; ${hosts.length - 1} more endpoint${hosts.length > 2 ? 's' : ''} also failed` : ''}`, full: grp.map(g => `${g.h} ${g.how.join(' + ')}${tries(g)}: ${g.t}`), first, hosts };
  }
  /* repText(rep) -> one line of the per-request report of a state source */
  function repText(r) {
    const head = r.what === 'query' ? `${r.also ? 'also ' : ''}${r.picked ? 'picked ' + r.picked + ': ' : ''}${host(r.url)} ${r.layer}${r.name && !r.picked ? ' (' + r.name + ')' : ''} f=${r.f}` : r.what === 'pick' ? `${r.layer}` : `${host(r.url)} ${r.what === 'service info' ? 'service' : r.layer} info`;
    const body = !r.ok ? (r.http ? `HTTP ${r.http}, ` : '') + (r.err || 'failed') : r.what === 'query' ? `HTTP ${r.http || 200}, ${r.n} feature${r.n === 1 ? '' : 's'}, ${r.lines} road line${r.lines === 1 ? '' : 's'}`
      : `HTTP ${r.http || 200}${r.name ? ', "' + r.name + '"' : ''}${r.type ? ', ' + r.type : ''}${r.geom ? ', ' + r.geom.replace('esriGeometry', '') : ''}${r.layers ? ', layers: ' + r.layers.join('; ') : ''}`;
    return `${head}: ${body}`;
  }
  /* ---------- diagnose: one tiny request per source; the raw outcome ---------- */
  async function raw(fetchFn, url, ms) {
    const t0 = Date.now(), ac = typeof AbortController === 'function' ? new AbortController() : null; let tm = null;
    const timer = new Promise((_, rej) => { tm = setTimeout(() => { if (ac) ac.abort(); rej({ kind: 'timeout' }); }, ms); });
    try { const r = await Promise.race([fetchFn(url, { method: 'GET', cache: 'no-store', signal: ac ? ac.signal : undefined }), timer]);
      let t = ''; try { t = String(await Promise.race([r.text(), timer])); } catch (e) { t = '(could not read the answer)'; }
      return { http: r.status, ok: !!r.ok, ms: Date.now() - t0, body: t.replace(/\s+/g, ' ').trim().slice(0, 300), err: '' };
    } catch (x) { const c = classify(x, ms); return { http: null, ok: false, ms: Date.now() - t0, err: c.text, body: '' }; } finally { clearTimeout(tm); }
  }
  /* diagnose(fetchFn, ll, o) -> [{ src, label, url, http, ok, ms, body (first 300 characters), err }] (+ .state): per Overpass endpoint
     its status page and a one-way query within 30 m of the site centre (out ids, 1 way); per layer of the site's state its info, its
     service info and a 1-record query in a 0.001° box at the centre. o: { zone, ovp, lastOvp, urls (the settings), timeoutMs, S } */
  async function diagnose(fetchFn, ll, o) {
    o = o || {}; const ms = o.timeoutMs || 10000, jobs = [], lat = +(+ll.lat).toFixed(6), lng = +(+ll.lng).toFixed(6), urls = o.urls || {};
    const q = `[out:json][timeout:10];way["highway"](around:30,${lat},${lng});out ids 1;`;
    overpassOrder(o.ovp, o.lastOvp).forEach(e => { jobs.push({ src: 'OpenStreetMap', label: host(e.url) + ' status', url: e.status }); jobs.push({ src: 'OpenStreetMap', label: host(e.url) + ' one-way query', url: e.url + '?data=' + encodeURIComponent(q) }); });
    const so = stateOf(lat, lng, o.zone, o.S), S = STATES[so.st];
    if (S) { const d = 0.0005, b = { s: lat - d, w: lng - d, n: lat + d, e: lng + d };
      stateOrder(so.st, urls[S.set], urls[S.last]).forEach(e => { jobs.push({ src: S.label, label: host(e.url) + ' ' + layerTail(e.url) + ' info', url: e.url + '?f=json' }); jobs.push({ src: S.label, label: host(e.url) + ' service info', url: serviceOf(e.url) + '?f=json' });
        jobs.push({ src: S.label, label: host(e.url) + ' ' + layerTail(e.url) + ' 1-record query', url: arcgisQueryUrl(e.url, b, 'json', 0, [['resultRecordCount', '1']]) }); }); }
    const out = await Promise.all(jobs.map(j => raw(fetchFn, j.url, ms).then(r => Object.assign({}, j, r))));
    out.state = so; return out;
  }
  window.CranePickRoadSrc = { OVERPASS, STATES, MASSDOT, ZONE_STATE, TIMEOUT_MS, MAX_PAGES, BACKOFF, BORDER_KM, host, validUrl, statusUrl, serviceOf, layerTail, inRing, distKm, stateOf, dataOf, stOfData,
    overpassOrder, stateOrder, massdotOrder, overpassAttempts, arcgisQueryUrl, classify, errOf, run, checkOverpass, checkArcgis, checkInfo, pickLayer, queryLayer, fetchOverpass, fetchState, fetchMassDOT,
    toOverpass, summary, repText, diagnose };
})();
