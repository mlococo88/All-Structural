/* apps/crane-pick/engine/roadsrc.js — where Snap to road gets its roads (window.CranePickRoadSrc). 2026-11-17 (engineer bug report:
   "Snap to road: no OpenStreetMap roads (offline or blocked)" on a real site while the OSM street tiles loaded).
   No DOM. The fetch function is passed in (ui/road.js passes window.fetch; the Node tests pass a mock), so every path is testable.
   1. Overpass API endpoints (public instances, OSM wiki "Overpass API" list, checked 2026-11-17 by web search; not reachable from the
      build session): tried in order, the one that last worked first, each with a short timeout; per endpoint a POST form body first
      (no CORS preflight), then GET ?data= (some proxies block POST). An endpoint typed in the settings is tried first.
   2. MassDOT / MassGIS road centrelines (Massachusetts only): an ArcGIS REST layer "query" (envelope in WGS 84, outSR 4326, f=geojson,
      Esri JSON also read), normalised into the Overpass JSON shape (ways with geometry, tags name / ref / oneway) so engine/osm.js
      builds the same road graph.
   3. Error classification: network / CORS (the browser does not say which), timeout, HTTP code, bad answer, server error. */
(function () {
  'use strict';
  const OVERPASS = [
    { id: 'de', url: 'https://overpass-api.de/api/interpreter', status: 'https://overpass-api.de/api/status', name: 'overpass-api.de (FOSSGIS, the main instance)' },
    { id: 'coffee', url: 'https://overpass.private.coffee/api/interpreter', status: 'https://overpass.private.coffee/api/status', name: 'overpass.private.coffee (formerly overpass.kumi.systems)' },
    { id: 'vk', url: 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', status: 'https://maps.mail.ru/osm/tools/overpass/api/status', name: 'maps.mail.ru (VK Maps)' }
  ];
  // MassDOT Road Inventory 2024 (MassDOT's own ArcGIS Server; display field St_Name, Oneway FT / TF), then the MassGIS-MassDOT Roads
  // hosted layer (ArcGIS Online). Found by web search 2026-11-17; not reachable from the build session (Decision pending engineer review).
  const MASSDOT = [
    { id: 'massdot', url: 'https://gis.massdot.state.ma.us/arcgis/rest/services/Roads/RoadInventoryYearEndFiles/FeatureServer/10', name: 'MassDOT Road Inventory 2024 (gis.massdot.state.ma.us)' },
    { id: 'massgis', url: 'https://services1.arcgis.com/hGdibHYSPO59RG1h/ArcGIS/rest/services/MassDOTRoads_gdb/FeatureServer/0', name: 'MassGIS-MassDOT Roads (services1.arcgis.com)' }
  ];
  const TIMEOUT_MS = 15000, MAX_PAGES = 10;
  // Massachusetts, a box around the state (also takes in strips of RI / CT / NY / NH / VT: the layer then has no roads there, and says so)
  const MA = { s: 41.18, w: -73.51, n: 42.89, e: -69.86 };
  const inMA = (lat, lng) => lat >= MA.s && lat <= MA.n && lng >= MA.w && lng <= MA.e;
  const host = u => { const m = /^https?:\/\/([^/?#]+)/i.exec(String(u || '')); return m ? m[1] : String(u || ''); };
  const validUrl = u => /^https:\/\/[^\s/?#]+\.[^\s/?#]+\/\S*$/i.test(String(u || '').trim());
  /* the status (Test connection) URL of an endpoint: Overpass ".../api/interpreter" -> ".../api/status"; an ArcGIS layer -> its JSON */
  function statusUrl(u) { u = String(u || '').trim(); const m = /^(.*\/api)\/interpreter\/?$/.exec(u); if (m) return m[1] + '/status'; if (/\/(FeatureServer|MapServer)\/\d+\/?$/i.test(u)) return u.replace(/\/$/, '') + '?f=pjson'; return u; }
  /* the Overpass endpoints in the order tried: the one typed in the settings, the one that last worked, then the list */
  function overpassOrder(custom, last) {
    const out = [], add = (u, name) => { u = String(u || '').trim(); if (!validUrl(u) || out.some(e => e.url === u)) return; const k = OVERPASS.find(e => e.url === u); out.push(k ? Object.assign({}, k) : { id: 'custom', url: u, status: statusUrl(u), name: name || host(u) }); };
    add(custom, host(custom) + ' (settings)'); add(last); OVERPASS.forEach(e => add(e.url)); return out;
  }
  function massdotOrder(custom, last) {
    const out = [], add = (u, name) => { u = String(u || '').trim().replace(/\/query\/?$/i, '').replace(/\/$/, ''); if (!validUrl(u + '/') || out.some(e => e.url === u)) return; const k = MASSDOT.find(e => e.url === u); out.push(k ? Object.assign({}, k) : { id: 'custom', url: u, name: name || host(u) }); };
    add(custom, host(custom) + ' (settings)'); add(last); MASSDOT.forEach(e => add(e.url)); return out.map(e => Object.assign(e, { status: statusUrl(e.url) }));
  }
  /* the requests for one source: Overpass POST then GET per endpoint; ArcGIS GET (a query URL) */
  function overpassAttempts(eps, q) {
    const out = []; eps.forEach(e => { out.push({ ep: e, how: 'POST', url: e.url, init: { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) } });
      out.push({ ep: e, how: 'GET', url: e.url + '?data=' + encodeURIComponent(q), init: { method: 'GET' } }); }); return out;
  }
  function arcgisQueryUrl(base, b, f, offset) {
    const p = [['where', '1=1'], ['geometry', [b.w, b.s, b.e, b.n].join(',')], ['geometryType', 'esriGeometryEnvelope'], ['inSR', '4326'], ['spatialRel', 'esriSpatialRelIntersects'],
      ['outFields', '*'], ['returnGeometry', 'true'], ['outSR', '4326'], ['f', f || 'geojson']];
    if (offset) p.push(['resultOffset', String(offset)]);
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
  /* one attempt with a timeout; check(json) throws an error object or returns the json */
  async function one(fetchFn, a, ms, check) {
    const ac = typeof AbortController === 'function' ? new AbortController() : null;
    let tm = null; const timer = new Promise((_, rej) => { tm = setTimeout(() => { if (ac) ac.abort(); rej({ kind: 'timeout' }); }, ms); });
    try {
      const r = await Promise.race([fetchFn(a.url, Object.assign({ cache: 'no-store', signal: ac ? ac.signal : undefined }, a.init)), timer]);
      if (!r || !r.ok) throw { http: r ? r.status : 0 };
      let txt; try { txt = await Promise.race([r.text(), timer]); } catch (e) { throw e && e.kind ? e : { kind: 'json', detail: 'could not read the answer' }; }
      let json; try { json = JSON.parse(txt); } catch (e) { throw { kind: 'json', detail: String(txt || '').trim().slice(0, 40).replace(/\s+/g, ' ') || 'empty answer' }; }
      return check(json);
    } finally { clearTimeout(tm); }
  }
  /* run(attempts, fetchFn, check, o) -> { ok: true, json, used, log } | { ok: false, log }: the attempts in order until one works; after a
     timeout or an HTTP 429 / 5xx the same endpoint's other forms are skipped (the server, not the form, is the problem) */
  async function run(attempts, fetchFn, check, o) {
    const ms = (o && o.timeoutMs) || TIMEOUT_MS, log = [], skip = new Set();
    for (const a of attempts) {
      if (skip.has(a.ep.url)) continue;
      try { const json = await one(fetchFn, a, ms, check); log.push({ ep: a.ep, how: a.how, ok: true }); return { ok: true, json, used: a, log }; }
      catch (x) { const c = classify(x, ms); log.push({ ep: a.ep, how: a.how, ok: false, kind: c.kind, code: c.code, text: c.text, brief: c.brief || c.text });
        if (c.kind === 'timeout' || (c.kind === 'http' && (c.code === 429 || c.code >= 500))) skip.add(a.ep.url); if (o && o.onTry) o.onTry(log); }
    }
    return { ok: false, log };
  }
  /* Overpass: the JSON must carry elements[]; a runtime error with no elements (remark) is a server error */
  function checkOverpass(j) {
    if (!j || !Array.isArray(j.elements)) throw { kind: 'json', detail: 'no "elements"' };
    if (!j.elements.length && j.remark && /error/i.test(j.remark)) throw { kind: 'server', detail: String(j.remark).slice(0, 120) };
    return j;
  }
  async function fetchOverpass(b, fetchFn, o) {
    o = o || {}; const OSM = o.OSM || (typeof window !== 'undefined' && window.CranePickOSM), eps = overpassOrder(o.custom, o.last);
    const r = await run(overpassAttempts(eps, OSM.query(b)), fetchFn, checkOverpass, o); r.src = 'osm'; r.eps = eps; return r;
  }
  /* ArcGIS: an { error } object (HTTP 200) is a server error; GeoJSON (features[].geometry LineString / MultiLineString) or Esri JSON
     (features[].geometry.paths) */
  function checkArcgis(j) {
    if (j && j.error) throw { kind: 'server', detail: [j.error.code, j.error.message].filter(Boolean).join(' ').slice(0, 120) };
    if (!j || !Array.isArray(j.features)) throw { kind: 'json', detail: 'no "features"' };
    return j;
  }
  const exceeded = j => !!(j && (j.exceededTransferLimit || (j.properties && j.properties.exceededTransferLimit)));
  /* fetchMassDOT(b, fetchFn, o): per layer, f=geojson then f=json; pages while the server says the transfer limit was exceeded */
  async function fetchMassDOT(b, fetchFn, o) {
    o = o || {}; const eps = massdotOrder(o.custom, o.last), log = [];
    for (const e of eps) {
      for (const f of ['geojson', 'json']) {
        const feats = []; let off = 0, page = 0, res = null;
        for (; page < MAX_PAGES; page++) {
          res = await run([{ ep: e, how: 'GET f=' + f + (off ? ' offset ' + off : ''), url: arcgisQueryUrl(e.url, b, f, off), init: { method: 'GET' } }], fetchFn, checkArcgis, o);
          log.push(...res.log); if (!res.ok) break;
          feats.push(...res.json.features); if (!exceeded(res.json) || !res.json.features.length) break; off += res.json.features.length;
        }
        if (res && res.ok) { const json = toOverpass({ features: feats }); return { ok: true, json, used: res.used, log, src: 'massdot', eps, more: page >= MAX_PAGES }; }
        const last = log[log.length - 1]; if (last && last.kind !== 'server' && last.kind !== 'json') break;   // f=json only helps when the server refused f=geojson
      }
    }
    return { ok: false, log, src: 'massdot', eps };
  }
  /* ArcGIS features -> Overpass-shaped ways: { elements: [{ type: 'way', id, geometry: [{ lat, lon }], tags: { highway: 'road', name,
     ref, oneway, src } }] }. Fields read case-insensitively: name St_Name / STREET_NAME / STREETNAME / STREET_NAM; route RT_NUMBER /
     Route_Number; one-way Oneway FT (with the line's digitising direction) -> yes, TF -> -1 (MassDOT Road Inventory). No node ids: the
     graph joins ways at identical end coordinates (to 1e-7°). */
  function field(a, names) { if (!a) return null; const k = Object.keys(a); for (const n of names) { const f = k.find(x => x.toLowerCase() === n); if (f != null && a[f] != null && String(a[f]).trim() !== '' && String(a[f]).trim() !== '0') return String(a[f]).trim(); } return null; }
  function toOverpass(j) {
    const els = []; let n = 0;
    (j && Array.isArray(j.features) ? j.features : []).forEach((f, i) => {
      if (!f) return; const a = f.properties || f.attributes || {}, g = f.geometry || {};
      let lines = [];
      if (g.type === 'LineString') lines = [g.coordinates]; else if (g.type === 'MultiLineString') lines = g.coordinates; else if (Array.isArray(g.paths)) lines = g.paths;
      const name = field(a, ['st_name', 'street_name', 'streetname', 'street_nam', 'stname']), ref = field(a, ['rt_number', 'route_number', 'rtnumber']);
      const ow = String(field(a, ['oneway']) || '').toUpperCase(), oid = field(a, ['objectid', 'fid', 'objectid_1']) || f.id || i;
      (lines || []).forEach((ln, k) => {
        if (!Array.isArray(ln) || ln.length < 2) return;
        const geometry = ln.filter(c => Array.isArray(c) && isFinite(c[0]) && isFinite(c[1])).map(c => ({ lat: +c[1], lon: +c[0] })); if (geometry.length < 2) return;
        const tags = { highway: 'road', src: 'massdot' }; if (name) tags.name = name; if (ref) tags.ref = ref; if (ow === 'FT') tags.oneway = 'yes'; else if (ow === 'TF') tags.oneway = '-1';
        els.push({ type: 'way', id: 'm' + oid + (lines.length > 1 ? '_' + k : ''), geometry, tags }); n++;
      });
    });
    return { elements: els, n };
  }
  /* summary(log) -> short: the first endpoint's error (and how many more failed); full: one line per endpoint and error ("host POST + GET:
     network error (…)"); first: the first failed attempt */
  function summary(log) {
    const bad = (log || []).filter(l => !l.ok); if (!bad.length) return { short: '', full: [] };
    const first = bad[0], hosts = [...new Set(bad.map(l => host(l.ep.url)))], grp = [];
    bad.forEach(l => { const h = host(l.ep.url), t = l.brief || l.text, g = grp.find(x => x.h === h && x.t === t); if (g) g.how.push(l.how); else grp.push({ h, t, how: [l.how] }); });
    return { short: `${first.text} — ${host(first.ep.url)} ${first.how}${hosts.length > 1 ? `; ${hosts.length - 1} more endpoint${hosts.length > 2 ? 's' : ''} also failed` : ''}`, full: grp.map(g => `${g.h} ${g.how.join(' + ')}: ${g.t}`), first };
  }
  window.CranePickRoadSrc = { OVERPASS, MASSDOT, MA, TIMEOUT_MS, MAX_PAGES, inMA, host, validUrl, statusUrl, overpassOrder, massdotOrder, overpassAttempts, arcgisQueryUrl,
    classify, run, checkOverpass, checkArcgis, fetchOverpass, fetchMassDOT, toOverpass, summary };
})();
