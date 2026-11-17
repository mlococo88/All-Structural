/* apps/crane-pick/ui/road.js — the Route tab's "Snap to road" and "Trace" tools (window.CranePickRoadUI). 2026-11-17.
   Snap to road: the user clicks a start point, any via points and an end point near roads; Finish fetches the drivable OpenStreetMap
   ways in the box around them from the Overpass API (engine/osm.js: query, graph, Dijkstra), cached per browser (IndexedDB
   crane.osm.v1), and a new route follows the road centreline between the snapped points; ui/route.js fits its alignment.
   Trace: press and drag along the road on the aerial; on release the traced line becomes a new route (fitted the same way).
   Offline or a failed fetch: a clear message; Trace and Route (clicks) still work. Data © OpenStreetMap contributors (ODbL), labelled
   "from OpenStreetMap — not survey" wherever it is shown or printed (ui/route.js).
   2026-11-17 (engineer bug report: "no OpenStreetMap roads (offline or blocked)" on a real site): the roads come through
   engine/roadsrc.js: several Overpass endpoints (POST, then GET), each with a short timeout, the one that worked remembered; in
   Massachusetts the MassDOT / MassGIS road centrelines when OpenStreetMap fails (or by choice). A failure names the error type, the
   endpoint and gives a "Test connection" link (the server's status page in a new tab) in the status bar and the Route tab.
   Settings (Road data settings, per browser, localStorage crane.road): the source, an Overpass endpoint and a MassDOT layer URL. */
(function () {
  'use strict';
  const A = window.CranePickApp, esc = A.esc, OSM = window.CranePickOSM, AL = window.CranePickAlign, RS = window.CranePickRoadSrc, M = window.CranePickModel;
  const MP = () => window.CranePickMap, L_ = () => window.L, RUI = () => window.CranePickRouteUI;
  const DB = 'crane.osm.v1', STORE = 'roads', PAD_FT = 600;
  let mode = null, pts = [], ghost = null, msg = '', busy = false, busyText = '', trace = null, setOpen = false;
  /* ---------- the road data settings (localStorage crane.road, per browser): { src: 'auto' | 'osm' | 'massdot', ovp, md (URLs typed;
     '' = the defaults), lastOvp, lastMd (the endpoints that last worked) } ---------- */
  const SRCS = [['auto', 'Automatic: OpenStreetMap; in Massachusetts MassDOT / MassGIS if OpenStreetMap fails'], ['osm', 'OpenStreetMap (Overpass API) only'], ['massdot', 'MassDOT / MassGIS road centrelines (Massachusetts only)']];
  function settings() { let o = null; try { o = JSON.parse(A.LS.getItem(M.KEYS.road) || 'null'); } catch (e) { o = null; } o = o && typeof o === 'object' ? o : {};
    const u = v => (typeof v === 'string' && RS.validUrl(v)) ? v.trim() : '';
    return { src: SRCS.some(x => x[0] === o.src) ? o.src : 'auto', ovp: u(o.ovp), md: u(o.md), lastOvp: u(o.lastOvp), lastMd: u(o.lastMd) }; }
  function saveSettings(o) { try { A.LS.setItem(M.KEYS.road, JSON.stringify(o)); return true; } catch (e) { return false; } }
  const fetchFn = (u, i) => window.fetch(u, i);
  const mem = new Map();   // bboxKey -> { id, bbox, at, json }
  /* ---------- the per-browser cache (IndexedDB; memory only when it is not available) ---------- */
  function db() { return new Promise((res, rej) => { if (!window.indexedDB) return rej(new Error('IndexedDB not available')); const q = indexedDB.open(DB, 1);
    q.onupgradeneeded = () => { const d = q.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' }); }; q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error || new Error('IndexedDB open failed')); }); }
  const srcOfE = e => (e && e.src) || 'osm';   // entries cached before 2026-11-17 carry no src: OpenStreetMap
  async function cacheFind(b, sx) {
    sx = sx || 'osm';
    const hit = [...mem.values()].filter(e => srcOfE(e) === sx && OSM.contains(e.bbox, b)).sort((x, y) => (y.at > x.at ? 1 : -1))[0]; if (hit) return hit;
    try { const d = await db(); const all = await new Promise((res, rej) => { const q = d.transaction(STORE, 'readonly').objectStore(STORE).getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); });
      const e = all.filter(x => x && x.bbox && srcOfE(x) === sx && OSM.contains(x.bbox, b)).sort((x, y) => (y.at > x.at ? 1 : -1))[0]; if (e) mem.set(e.id, e); return e || null; } catch (e) { return null; }
  }
  async function cachePut(e) { mem.set(e.id, e); try { const d = await db(); await new Promise((res, rej) => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(e); t.oncomplete = res; t.onerror = () => rej(t.error); }); return true; } catch (x) { return false; } }
  /* the roads in box b (centre ll): the sources in order (settings; Automatic adds MassDOT in Massachusetts), each from this browser's
     cache, else fetched (engine/roadsrc.js). Resolves { src, json, at, ep, how, cached, stored, fails } or rejects { fails, order } */
  function orderOf(st, ll) { return st.src === 'osm' ? ['osm'] : st.src === 'massdot' ? ['massdot'] : RS.inMA(ll.lat, ll.lng) ? ['osm', 'massdot'] : ['osm']; }
  async function roads(b, fresh, ll) {
    const st = settings(), order = orderOf(st, ll || { lat: (b.s + b.n) / 2, lng: (b.w + b.e) / 2 });
    if (!fresh) for (const sx of order) { const c = await cacheFind(b, sx); if (c) return Object.assign({ cached: true, src: sx, fails: [] }, c); }
    const fails = [];
    for (const sx of order) {
      const onTry = log => { const l = log[log.length - 1]; if (l && !l.ok) { busyText = `Getting the ${sx === 'osm' ? 'OpenStreetMap' : 'MassDOT / MassGIS'} roads… ${esc(RS.host(l.ep.url))} ${esc(l.how)}: ${esc(l.kind)}; trying the next one…`; refresh(); } };
      const r = sx === 'osm' ? await RS.fetchOverpass(b, fetchFn, { custom: st.ovp, last: st.lastOvp, onTry }) : await RS.fetchMassDOT(b, fetchFn, { custom: st.md, last: st.lastMd, onTry });
      if (r.ok) {
        const s2 = settings(); if (sx === 'osm') s2.lastOvp = r.used.ep.url; else s2.lastMd = r.used.ep.url; saveSettings(s2);
        const e = { id: (sx === 'osm' ? '' : sx + ':') + OSM.bboxKey(b), src: sx, bbox: b, at: new Date().toISOString(), json: r.json, ep: r.used.ep.url, how: r.used.how };
        e.stored = await cachePut(e); return Object.assign({ fails, more: !!r.more }, e);
      }
      fails.push(r);
    }
    throw { fails, order, mode: st.src };
  }
  const srcName = sx => sx === 'massdot' ? 'MassDOT / MassGIS' : 'OpenStreetMap';
  /* the failure, short (status bar) and in full (Route tab): per source the error of each endpoint tried, Test connection links */
  function testLinks(f) { return [...new Map(f.eps.map(e => [e.status, e])).values()].map(e => `<a href="${esc(e.status)}" target="_blank" rel="noopener" data-rdtest="${esc(e.id)}">Test connection: ${esc(RS.host(e.url))}</a>`).join(' · '); }
  function failText(x) {
    const fails = (x && x.fails) || []; if (!fails.length) return { bar: `Snap to road: ${esc(String((x && x.message) || x))}`, full: offText(x) };
    const f0 = fails[0], s0 = RS.summary(f0.log), first = s0.first ? s0.first.ep : f0.eps[0];
    const bar = `Snap to road: could not get the ${srcName(f0.src)} roads: ${esc(s0.short)}${fails.length > 1 ? `; ${srcName(fails[1].src)} also failed (${esc(((RS.summary(fails[1].log).first) || {}).brief || '')})` : ''}. <a href="${esc(first.status)}" target="_blank" rel="noopener" data-rdtest="bar">Test connection</a>`;
    const full = `Could not get the roads (each server tried, in order):${fails.map(f => `<br><b>${srcName(f.src)}</b>: ${RS.summary(f.log).full.map(esc).join('; ')}.<br>${testLinks(f)}`).join('')}
      <br><b>Test connection</b> opens the server's status page in a new tab: if it does not open there either, this network blocks that server (ask IT to allow it, or put a reachable mirror in <b>Road data settings</b>); if it opens but Snap to road still fails, the server refused this page (busy, rate limit or CORS).${x.order && x.order.indexOf('massdot') < 0 ? ' In Massachusetts, <b>Road data: MassDOT / MassGIS</b> is another source.' : ''} Snap to road needs the internet the first time for an area (then it is cached in this browser). Draw the route with <b>Trace</b> or <b>Route</b> (clicks) instead: they work offline.`;
    return { bar, full };
  }
  const offText = e => `Could not get the roads (${esc(String((e && e.message) || e || 'unknown error'))}). Draw the route with <b>Trace</b> or <b>Route</b> (clicks) instead: they work offline.`;
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
    const c0 = MP().toLL({ x: clicks.reduce((t, p) => t + p.x, 0) / clicks.length, y: clicks.reduce((t, p) => t + p.y, 0) / clicks.length });
    busy = true; busyText = ''; setMsg('Getting the roads…');
    let e; try { e = await roads(b, false, { lat: c0.lat, lng: c0.lng }); } catch (x) { busy = false; const t = failText(x); setMsg(t.full); refresh(); MP().status(`<span class="warnT">${t.bar}</span> <button type="button" data-rdb="clear">OK</button>`); return; }
    busy = false;
    const SI = OSM.srcInfo(e.src), g = OSM.graph(e.json, (lat, lon) => MP().toFt({ lat, lng: lon })), res = OSM.route(g, clicks, { label: SI.label });
    const via = e.cached ? '' : ` from ${esc(RS.host(e.ep))}${e.fails.length ? ` (${e.fails.map(f => `${srcName(f.src)} failed: ${esc(((RS.summary(f.log).first) || {}).brief || '')}`).join('; ')})` : RS.host(e.ep) !== RS.host((e.src === 'osm' ? RS.OVERPASS : RS.MASSDOT)[0].url) ? ' (a fallback endpoint)' : ''}${e.more ? '; the area has more roads than were fetched' : ''}`;
    if (!res.ok) { setMsg(`Snap to road: ${esc(res.why)}. ${g.edges.length} road segments in the area (${esc(SI.ATTR)}${via}).`); refresh(); return; }
    setMsg(`Snapped along ${res.names.map(n => esc(n.name)).join(' → ') || 'the roads'} (${Math.round(res.L)} ft${e.cached ? ', roads from this browser\'s cache of ' + esc(String(e.at).slice(0, 10)) : ''}${e.stored === false ? '; not cached: IndexedDB unavailable' : ''}). Roads${via}. ${esc(SI.ATTR)}; ${esc(SI.NOT_SURVEY)}.`);
    const src = { kind: 'osm', at: e.at, names: res.names, against: res.against, cl: res.pts, snaps: res.snaps.map(s => ({ d: s.d, name: s.name })) }; if (e.src === 'massdot') src.data = 'massdot';
    RUI().addRoute(res.pts, { src, lane: { on: false, w: null } });
  }
  /* ---------- the Route tab's buttons (ui/route.js renders html() in its Draw section and passes the clicks) ---------- */
  function setHtml() {
    const st = settings(), last = [st.lastOvp, st.lastMd].filter(Boolean).map(u => esc(RS.host(u))).join(', ');
    const tl = [...RS.OVERPASS, ...RS.MASSDOT].map(e => `<a href="${esc(RS.statusUrl(e.url))}" target="_blank" rel="noopener">${esc(RS.host(e.url))}</a>`).join(' · ');
    return `<details class="crVxList" id="rdSet"${setOpen ? ' open' : ''}><summary>Road data settings</summary>
      <div class="fRow"><label for="rdSrc">Road data</label><select id="rdSrc">${SRCS.map(([k, l]) => `<option value="${k}"${st.src === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div class="fRow"><label for="rdOvp">Road data endpoint (Overpass API, advanced)</label><input id="rdOvp" type="url" spellcheck="false" value="${esc(st.ovp)}" placeholder="${esc(RS.OVERPASS[0].url)}"></div>
      <div class="fRow"><label for="rdMd">MassDOT road layer URL (ArcGIS REST, advanced)</label><input id="rdMd" type="url" spellcheck="false" value="${esc(st.md)}" placeholder="${esc(RS.MASSDOT[0].url)}"></div>
      <div class="goRow"><button type="button" data-road="setSave">Save settings</button><button type="button" data-road="setReset">Defaults</button></div>
      <p class="note">An endpoint typed here is tried first, then the one that last worked${last ? ` (${last})` : ''}, then ${RS.OVERPASS.map(e => esc(RS.host(e.url))).join(', ')} (Overpass, POST then GET, ${Math.round(RS.TIMEOUT_MS / 1000)} s each); in Massachusetts then the MassDOT / MassGIS layers. Test connection (opens the server's status page in a new tab): ${tl}.</p></details>`;
  }
  function html() {
    return `<div id="rdBox"><div class="crTools" id="rdTools"><button type="button" class="tbBtn${mode === 'snap' ? ' on' : ''}" data-road="snap" title="Click a start and an end point (and via points) near roads: the route follows the OpenStreetMap roads">Snap to road (OpenStreetMap)</button><button type="button" class="tbBtn${mode === 'trace' ? ' on' : ''}" data-road="trace" title="Press and drag along the road on the aerial">Trace</button></div>
      <div class="note" id="rdMsg"${msg || busy ? '' : ' hidden'}>${busy ? (busyText || 'Getting the roads…') : msg}</div>${setHtml()}</div>`;
  }
  function setAct(k) {
    const g = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    if (k === 'setReset') { const o = settings(); saveSettings({ src: 'auto', ovp: '', md: '', lastOvp: o.lastOvp, lastMd: o.lastMd }); setOpen = true; setMsg('Road data settings: defaults restored.'); return; }
    const ovp = g('rdOvp'), md = g('rdMd'), bad = [[ovp, 'Road data endpoint'], [md, 'MassDOT road layer URL']].filter(([u]) => u && !RS.validUrl(u));
    setOpen = true; if (bad.length) { setMsg(`<span class="warnT">${bad.map(x => esc(x[1])).join(' and ')}: enter a full https:// address (or leave it blank for the defaults). Not saved.</span>`); return; }
    const o = settings(); o.src = g('rdSrc') || 'auto'; o.ovp = ovp; o.md = md;
    setMsg(saveSettings(o) ? 'Road data settings saved (this browser).' : '<span class="warnT">Road data settings could not be saved (browser storage unavailable).</span>');
  }
  function click(el) { const k = el.dataset.road; if (k === 'setSave' || k === 'setReset') { setAct(k); return; } if (mode === k) { end(); return; } start(k); }
  function refresh() { const t = document.getElementById('rdBox'); if (t) t.outerHTML = html(); }
  document.addEventListener('toggle', e => { if (e.target && e.target.id === 'rdSet') setOpen = e.target.open; }, true);
  A.on('ready', () => { const st = document.getElementById('mbStatus'); if (st) st.addEventListener('click', e => { const b = e.target.closest('[data-rdb]'); if (!b) return; if (b.dataset.rdb === 'finish') finishSnap(); else if (b.dataset.rdb === 'clear') MP().status(''); else end(); }); });
  A.on('project', () => { if (mode) end(); });
  window.CranePickRoadUI = { html, click, start, end, finishSnap, roads, settings, failText, get mode() { return mode; }, get msg() { return msg; }, PAD_FT };
})();
