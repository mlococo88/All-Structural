/* apps/crane-pick/ui/road.js — the Route tab's "Snap to road" and "Trace" tools (window.CranePickRoadUI). 2026-11-17.
   Snap to road: the user clicks a start point, any via points and an end point near roads; Finish fetches the drivable OpenStreetMap
   ways in the box around them from the Overpass API (engine/osm.js: query, graph, Dijkstra), cached per browser (IndexedDB
   crane.osm.v1), and a new route follows the road centreline between the snapped points; ui/route.js fits its alignment.
   Trace: press and drag along the road on the aerial; on release the traced line becomes a new route (fitted the same way).
   Offline or a failed fetch: a clear message; Trace and Route (clicks) still work. Data © OpenStreetMap contributors (ODbL), labelled
   "from OpenStreetMap — not survey" wherever it is shown or printed (ui/route.js). */
(function () {
  'use strict';
  const A = window.CranePickApp, esc = A.esc, OSM = window.CranePickOSM, AL = window.CranePickAlign;
  const MP = () => window.CranePickMap, L_ = () => window.L, RUI = () => window.CranePickRouteUI;
  const DB = 'crane.osm.v1', STORE = 'roads', PAD_FT = 600, TIMEOUT_MS = 30000;
  let mode = null, pts = [], ghost = null, msg = '', busy = false, trace = null;
  const mem = new Map();   // bboxKey -> { id, bbox, at, json }
  /* ---------- the per-browser cache (IndexedDB; memory only when it is not available) ---------- */
  function db() { return new Promise((res, rej) => { if (!window.indexedDB) return rej(new Error('IndexedDB not available')); const q = indexedDB.open(DB, 1);
    q.onupgradeneeded = () => { const d = q.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' }); }; q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error || new Error('IndexedDB open failed')); }); }
  async function cacheFind(b) {
    const hit = [...mem.values()].filter(e => OSM.contains(e.bbox, b)).sort((x, y) => (y.at > x.at ? 1 : -1))[0]; if (hit) return hit;
    try { const d = await db(); const all = await new Promise((res, rej) => { const q = d.transaction(STORE, 'readonly').objectStore(STORE).getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); });
      const e = all.filter(x => x && x.bbox && OSM.contains(x.bbox, b)).sort((x, y) => (y.at > x.at ? 1 : -1))[0]; if (e) mem.set(e.id, e); return e || null; } catch (e) { return null; }
  }
  async function cachePut(e) { mem.set(e.id, e); try { const d = await db(); await new Promise((res, rej) => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(e); t.oncomplete = res; t.onerror = () => rej(t.error); }); return true; } catch (x) { return false; } }
  /* the roads in box b: the cache, else the Overpass API (POST, form body: no CORS preflight) */
  async function roads(b, fresh) {
    if (!fresh) { const c = await cacheFind(b); if (c) return Object.assign({ cached: true }, c); }
    const ac = window.AbortController ? new AbortController() : null, tm = ac ? setTimeout(() => ac.abort(), TIMEOUT_MS) : null;
    let r; try { r = await fetch(OSM.URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: OSM.body(b), signal: ac ? ac.signal : undefined, cache: 'no-store' }); }
    finally { if (tm) clearTimeout(tm); }
    if (!r.ok) throw Object.assign(new Error(r.status === 429 ? 'the Overpass API says too many requests (HTTP 429): wait a minute and try again' : r.status === 504 ? 'the Overpass API is busy (HTTP 504): try again shortly' : 'the Overpass API answered HTTP ' + r.status), { http: r.status });
    const json = await r.json(); if (!json || !Array.isArray(json.elements)) throw new Error('the Overpass API answer is not OSM JSON');
    const e = { id: OSM.bboxKey(b), bbox: b, at: new Date().toISOString(), json }; e.stored = await cachePut(e); return e;
  }
  const offText = e => `Could not get the OpenStreetMap roads (${e && e.http ? esc(e.message) : 'offline, blocked by the network, or no answer from the Overpass API' + (e && e.message ? ': ' + esc(e.message) : '')}). Snap to road needs the internet the first time for an area (then it is cached in this browser). Draw the route with <b>Trace</b> or <b>Route</b> (clicks) instead: they work offline.`;
  /* ---------- tools ---------- */
  function setMsg(h) { msg = h || ''; refresh(); }
  function status() {
    if (!MP()) return;
    if (mode === 'snap') MP().status(`<b>Snap to road:</b> click the start, any via points, then the end, near the roads (${pts.length} clicked). Enter or Finish fetches the OpenStreetMap roads. Esc cancels. <button type="button" class="primary" data-rdb="finish">Finish</button><button type="button" data-rdb="cancel">Cancel</button>`);
    else if (mode === 'trace') MP().status('<b>Trace:</b> press and drag along the road on the aerial (the steer-axle path); release to finish. Esc cancels. <button type="button" data-rdb="cancel">Cancel</button>');
  }
  function ghostDraw(cur) {
    const m = MP().map, Lf = L_(); if (ghost) { ghost.remove(); ghost = null; } const line = pts.slice(); if (cur) line.push(cur); if (!line.length) return;
    ghost = Lf.layerGroup().addTo(m); Lf.polyline(line.map(p => MP().toLL(p)), { color: '#0E7490', weight: 2, dashArray: mode === 'snap' ? '5 4' : null, interactive: false }).addTo(ghost);
    if (mode === 'snap') pts.forEach((p, i) => Lf.circleMarker(MP().toLL(p), { radius: 6, color: '#0E7490', fillColor: i === 0 ? '#059669' : '#fff', fillOpacity: 1, weight: 2, interactive: false, className: 'crRdPt' }).addTo(ghost));
  }
  function end(quiet) {
    const was = mode; mode = null; pts = []; if (ghost) { ghost.remove(); ghost = null; }
    if (trace) { trace.off(); trace = null; }
    if (MP() && MP().map && was) { if (!quiet) MP().setTool(null); MP().status(''); MP().map.dragging.enable(); }
    refresh();
  }
  function start(k) {
    if (!MP() || !MP().map) return; if (RUI()) RUI().cancel(true); end(true); setMsg('');
    mode = k; pts = []; A.showOTab('plan');
    if (k === 'snap') MP().setTool({ cursor: 'crosshair', click: f => { pts.push(f); ghostDraw(); status(); refresh(); }, move: f => { if (pts.length) ghostDraw(f); }, dbl: () => finishSnap(), key: keyOf, end: () => { if (mode === 'snap') { mode = null; pts = []; if (ghost) { ghost.remove(); ghost = null; } refresh(); } } });
    else { MP().setTool({ cursor: 'crosshair', key: keyOf, end: () => { if (mode === 'trace') { mode = null; pts = []; if (trace) { trace.off(); trace = null; } if (ghost) { ghost.remove(); ghost = null; } MP().map.dragging.enable(); refresh(); } } }); traceOn(); }
    status(); refresh();
  }
  const keyOf = e => { if (e.key === 'Escape') { e.preventDefault(); end(); } else if (e.key === 'Enter' && mode === 'snap') { e.preventDefault(); finishSnap(); } };
  function traceOn() {
    const m = MP().map, el = m.getContainer(); m.dragging.disable(); let down = false;
    const ft = ev => MP().toFt(m.mouseEventToLatLng(ev));
    const dn = ev => { if (ev.button !== 0 && ev.pointerType === 'mouse') return; if (ev.target.closest && ev.target.closest('.leaflet-control')) return; down = true; pts = [ft(ev)]; ev.preventDefault(); ev.stopPropagation(); try { el.setPointerCapture(ev.pointerId); } catch (x) { /* no capture */ } };
    const mv = ev => { if (!down) return; const p = ft(ev), l = pts[pts.length - 1]; if (Math.hypot(p.x - l.x, p.y - l.y) >= 1.5) { pts.push(p); MP().raf('trace', () => ghostDraw()); } ev.preventDefault(); };
    const up = ev => { if (!down) return; down = false; const p = ft(ev), l = pts[pts.length - 1]; if (Math.hypot(p.x - l.x, p.y - l.y) > 0.5) pts.push(p); finishTrace(); };
    el.addEventListener('pointerdown', dn, true); el.addEventListener('pointermove', mv, true); el.addEventListener('pointerup', up, true); el.style.touchAction = 'none';
    trace = { off: () => { el.removeEventListener('pointerdown', dn, true); el.removeEventListener('pointermove', mv, true); el.removeEventListener('pointerup', up, true); el.style.touchAction = ''; } };
  }
  function finishTrace() {
    const line = AL.simplify(pts, 0.25), L = line.reduce((s, p, i) => i ? s + Math.hypot(p.x - line[i - 1].x, p.y - line[i - 1].y) : 0, 0);
    end();
    if (line.length < 2 || L < 20) { setMsg('Trace: the line was shorter than 20 ft. Press and drag along the road.'); return; }
    RUI().addRoute(line, { src: { kind: 'trace' } });
  }
  async function finishSnap() {
    if (mode !== 'snap' || busy) return;
    if (pts.length < 2) { MP().status('<b>Snap to road:</b> click at least a start and an end point. <button type="button" data-rdb="cancel">Cancel</button>'); return; }
    const clicks = pts.slice(); end();
    const lls = clicks.map(p => { const ll = MP().toLL(p); return { lat: ll.lat, lng: ll.lng }; }), b = OSM.bboxOf(lls, PAD_FT);
    busy = true; setMsg('Getting the OpenStreetMap roads…');
    let e; try { e = await roads(b); } catch (x) { busy = false; setMsg(offText(x)); refresh(); MP().status(`<span class="warnT">Snap to road: no OpenStreetMap roads (offline or blocked).</span> <button type="button" data-rdb="clear">OK</button>`); return; }
    busy = false;
    const g = OSM.graph(e.json, (lat, lon) => MP().toFt({ lat, lng: lon })), res = OSM.route(g, clicks);
    if (!res.ok) { setMsg(`Snap to road: ${esc(res.why)}. ${g.edges.length} road segments in the area (${esc(OSM.ATTR)}).`); refresh(); return; }
    setMsg(`Snapped along ${res.names.map(n => esc(n.name)).join(' → ') || 'the roads'} (${Math.round(res.L)} ft${e.cached ? ', roads from this browser\'s cache of ' + esc(String(e.at).slice(0, 10)) : ''}${e.stored === false ? '; not cached: IndexedDB unavailable' : ''}). ${esc(OSM.ATTR)}; ${esc(OSM.NOT_SURVEY)}.`);
    RUI().addRoute(res.pts, { src: { kind: 'osm', at: e.at, names: res.names, against: res.against, cl: res.pts, snaps: res.snaps.map(s => ({ d: s.d, name: s.name })) }, lane: { on: false, w: null } });
  }
  /* ---------- the Route tab's buttons (ui/route.js renders html() in its Draw section and passes the clicks) ---------- */
  function html() {
    return `<div id="rdBox"><div class="crTools" id="rdTools"><button type="button" class="tbBtn${mode === 'snap' ? ' on' : ''}" data-road="snap" title="Click a start and an end point (and via points) near roads: the route follows the OpenStreetMap roads">Snap to road (OpenStreetMap)</button><button type="button" class="tbBtn${mode === 'trace' ? ' on' : ''}" data-road="trace" title="Press and drag along the road on the aerial">Trace</button></div>
      <div class="note" id="rdMsg"${msg || busy ? '' : ' hidden'}>${busy ? 'Getting the OpenStreetMap roads…' : msg}</div></div>`;
  }
  function click(el) { const k = el.dataset.road; if (mode === k) { end(); return; } start(k); }
  function refresh() { const t = document.getElementById('rdBox'); if (t) t.outerHTML = html(); }
  A.on('ready', () => { const st = document.getElementById('mbStatus'); if (st) st.addEventListener('click', e => { const b = e.target.closest('[data-rdb]'); if (!b) return; if (b.dataset.rdb === 'finish') finishSnap(); else if (b.dataset.rdb === 'clear') MP().status(''); else end(); }); });
  A.on('project', () => { if (mode) end(); });
  window.CranePickRoadUI = { html, click, start, end, finishSnap, roads, get mode() { return mode; }, get msg() { return msg; }, PAD_FT };
})();
