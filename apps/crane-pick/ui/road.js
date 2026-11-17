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
   Settings (Road data settings, per browser, localStorage crane.road): the source, an Overpass endpoint and a MassDOT layer URL.
   2026-11-17 (second bug report, Greenwood, Warwick RI): the state road source follows the site's state (engine/roadsrc.js stateOf:
   location, the project's State Plane zone near a border): MassDOT / MassGIS (MA), RIGIS / RIDOT (RI), CTDOT (CT), none elsewhere;
   Road data: Automatic (OpenStreetMap, then the state roads) / OpenStreetMap only / State roads only (a saved 'massdot' reads as
   State roads); a layer URL per state. Overpass busy -> backoff (the status bar counts down the waits); the state source reports each
   request (HTTP, error, features, layer); Retry in the status bar; Diagnose road data (one tiny request per source, the raw answer). */
(function () {
  'use strict';
  const A = window.CranePickApp, esc = A.esc, OSM = window.CranePickOSM, AL = window.CranePickAlign, RS = window.CranePickRoadSrc, M = window.CranePickModel;
  const MP = () => window.CranePickMap, L_ = () => window.L, RUI = () => window.CranePickRouteUI;
  // 2026-11-17: the query box padding 600 -> 400 ft (a lighter Overpass query; Decision pending engineer review)
  const DB = 'crane.osm.v1', STORE = 'roads', PAD_FT = 400;
  let mode = null, pts = [], ghost = null, msg = '', busy = false, busyText = '', trace = null, setOpen = false, lastSnap = null, diagBusy = false;
  /* ---------- the road data settings (localStorage crane.road, per browser): { src: 'auto' | 'osm' | 'state', ovp, md, ri, ct (URLs
     typed; '' = the defaults), lastOvp, lastMd, lastRi, lastCt (the endpoints that last worked) }. 2026-11-17: src 'massdot' (saved by
     the first version) reads as 'state'; ri / ct / lastRi / lastCt added (absent = defaults): no other change of the format ---------- */
  const SRCS = [['auto', 'Automatic: OpenStreetMap; the state road centrelines (MA, RI, CT) if OpenStreetMap fails'], ['osm', 'OpenStreetMap (Overpass API) only'], ['state', 'State roads only (by the site\'s state: MassDOT / MassGIS, RIGIS / RIDOT, CTDOT)']];
  function settings() { let o = null; try { o = JSON.parse(A.LS.getItem(M.KEYS.road) || 'null'); } catch (e) { o = null; } o = o && typeof o === 'object' ? o : {};
    const u = v => (typeof v === 'string' && RS.validUrl(v)) ? v.trim() : '', src = o.src === 'massdot' ? 'state' : o.src;
    return { src: SRCS.some(x => x[0] === src) ? src : 'auto', ovp: u(o.ovp), md: u(o.md), ri: u(o.ri), ct: u(o.ct), lastOvp: u(o.lastOvp), lastMd: u(o.lastMd), lastRi: u(o.lastRi), lastCt: u(o.lastCt) }; }
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
  /* the roads in box b (centre ll): the sources in order (settings; Automatic = OpenStreetMap, then the state source of the site),
     each from this browser's cache, else fetched (engine/roadsrc.js). Resolves { src, json, at, ep, how, cached, stored, fails, reps,
     layer, state } or rejects { fails, order, mode, state } */
  const zoneOf = () => (A.P && A.P.site && A.P.site.zone) || '';
  function orderOf(st, ll) {
    const so = RS.stateOf(ll.lat, ll.lng, zoneOf()), d = RS.dataOf(so.st);
    return { so, order: st.src === 'osm' ? ['osm'] : st.src === 'state' ? (d ? [d] : []) : d ? ['osm', d] : ['osm'] };
  }
  async function roads(b, fresh, ll) {
    const st = settings(), oo = orderOf(st, ll || { lat: (b.s + b.n) / 2, lng: (b.w + b.e) / 2 }), order = oo.order;
    if (!fresh) for (const sx of order) { const c = await cacheFind(b, sx); if (c) return Object.assign({ cached: true, src: sx, fails: [], state: oo.so }, c); }
    const fails = [];
    for (const sx of order) {
      const nm = srcName(sx);
      const onTry = log => { const l = log[log.length - 1]; if (l && !l.ok && !l.wait) { busyText = `Getting the ${esc(nm)} roads… ${esc(RS.host(l.ep.url))} ${esc(l.how)}: ${esc(l.kind)}; trying the next one…`; refresh(); } };
      const onWait = (a, w, k, n) => { busyText = `Getting the ${esc(nm)} roads… ${esc(RS.host(a.ep.url))} is busy: asking again in ${w / 1000} s (retry ${k} of ${n})…`; refresh(); if (MP()) MP().status(`<b>Snap to road:</b> ${busyText}`); };
      let r;
      if (sx === 'osm') r = await RS.fetchOverpass(b, fetchFn, { custom: st.ovp, last: st.lastOvp, onTry, onWait });
      else { const S = RS.STATES[RS.stOfData(sx)]; busyText = `Getting the ${esc(nm)} roads…`; refresh(); r = await RS.fetchState(b, fetchFn, { st: S.st, custom: st[S.set], last: st[S.last], onTry }); }
      if (r.ok) {
        const s2 = settings(); if (sx === 'osm') s2.lastOvp = r.used.ep.url; else s2[RS.STATES[RS.stOfData(sx)].last] = r.used.ep.url; saveSettings(s2);
        const e = { id: (sx === 'osm' ? '' : sx + ':') + OSM.bboxKey(b), src: sx, bbox: b, at: new Date().toISOString(), json: r.json, ep: r.used.ep.url, how: r.used.how };
        if (r.layer) e.layer = r.layer;
        e.stored = await cachePut(e); return Object.assign({ fails, more: !!r.more, reps: r.reps || null, state: oo.so }, e);
      }
      fails.push(r);
    }
    throw { fails, order, mode: st.src, state: oo.so };
  }
  const srcName = sx => sx === 'osm' || !sx ? 'OpenStreetMap' : OSM.srcInfo(sx).label;
  /* the failure, short (status bar) and in full (Route tab): per source the error of each endpoint tried, Test connection links */
  function testLinks(f) { return [...new Map((f.eps || []).map(e => [e.status, e])).values()].map(e => `<a href="${esc(e.status)}" target="_blank" rel="noopener" data-rdtest="${esc(e.id)}">Test connection: ${esc(RS.host(e.url))}</a>`).join(' · '); }
  /* one failed source in a line: Overpass the error per endpoint; a state source each request (HTTP, error, features, layer) */
  const failLines = f => f.src === 'osm' ? RS.summary(f.log).full.map(esc).join('; ') : (f.reps && f.reps.length ? f.reps.map(r => esc(RS.repText(r))).join('<br>&nbsp;&nbsp;') : esc(f.why || 'no layer to ask'));
  const failBrief = f => f.src === 'osm' ? ((RS.summary(f.log).first) || {}).brief || '' : f.empty ? 'no road lines in the answer' : (((RS.summary(f.log).first) || {}).brief || f.why || '');
  const stateNote = so => so && so.note ? ` (${esc(so.note)})` : '';
  function failText(x) {
    const fails = (x && x.fails) || [];
    if (!fails.length) return x && x.order ? { bar: `Snap to road: no state road source for this place${stateNote(x.state)}. Choose <b>Road data: Automatic</b> or <b>OpenStreetMap</b> in Road data settings. <button type="button" data-rdb="retry">Retry</button>`, full: `No state road source for this place${stateNote(x.state)}: Road data is set to State roads only (Massachusetts, Rhode Island, Connecticut). Choose <b>Automatic</b> or <b>OpenStreetMap</b> in Road data settings, or draw the route with <b>Trace</b> or <b>Route</b> (clicks).` }
      : { bar: `Snap to road: ${esc(String((x && x.message) || x))}`, full: offText(x) };
    const f0 = fails[0], s0 = RS.summary(f0.log), first = s0.first ? s0.first.ep : (f0.eps || [])[0] || { status: '#' };
    const head = f0.src === 'osm' ? esc(s0.short) : failBrief(f0) + (f0.reps && f0.reps.length ? ' — ' + esc(RS.repText(f0.reps[f0.reps.length - 1])) : '');
    const tried = f0.src === 'osm' && s0.hosts && s0.hosts.length ? ` Tried: ${s0.hosts.map(esc).join(', ')}.` : '';
    const bar = `Snap to road: could not get the ${esc(srcName(f0.src))} roads: ${head}${fails.length > 1 ? `; ${esc(srcName(fails[1].src))} also failed (${esc(failBrief(fails[1]))})` : ''}.${tried} <a href="${esc(first.status)}" target="_blank" rel="noopener" data-rdtest="bar">Test connection</a> <button type="button" data-rdb="retry">Retry</button>`;
    const full = `Could not get the roads (each server tried, in order)${stateNote(x.state)}:${fails.map(f => `<br><b>${esc(srcName(f.src))}</b>: ${failLines(f)}.<br>${testLinks(f)}`).join('')}
      <br><b>Test connection</b> opens the server's status page in a new tab: if it does not open there either, this network blocks that server (ask IT to allow it, or put a reachable mirror in <b>Road data settings</b>); if it opens but Snap to road still fails, the server refused this page (busy, rate limit or CORS). <b>Retry</b> asks again; <b>Diagnose road data</b> shows each server's raw answer.${x.order && x.order.length === 1 && x.order[0] === 'osm' && x.state && x.state.st ? ` <b>Road data: Automatic</b> also tries the ${esc(srcName(RS.dataOf(x.state.st)))} road centrelines.` : ''} Snap to road needs the internet the first time for an area (then it is cached in this browser). Draw the route with <b>Trace</b> or <b>Route</b> (clicks) instead: they work offline.`;
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
    const clicks = pts.slice(); end(); return snapRoads(clicks, false);
  }
  /* the roads for the clicked points, then the route (Retry: the same clicks, the cache skipped) */
  async function snapRoads(clicks, fresh) {
    if (busy) return;
    const lls = clicks.map(p => { const ll = MP().toLL(p); return { lat: ll.lat, lng: ll.lng }; }), b = OSM.bboxOf(lls, PAD_FT);
    const c0 = MP().toLL({ x: clicks.reduce((t, p) => t + p.x, 0) / clicks.length, y: clicks.reduce((t, p) => t + p.y, 0) / clicks.length });
    lastSnap = { clicks: clicks.slice(), ll: { lat: c0.lat, lng: c0.lng } };
    busy = true; busyText = ''; setMsg('Getting the roads…'); MP().status('<b>Snap to road:</b> getting the roads…');
    let e; try { e = await roads(b, !!fresh, { lat: c0.lat, lng: c0.lng }); } catch (x) { busy = false; const t = failText(x); setMsg(t.full); refresh(); MP().status(`<span class="warnT">${t.bar}</span> <button type="button" data-rdb="clear">OK</button>`); return; }
    busy = false; MP().status('');
    const SI = OSM.srcInfo(e.src), g = OSM.graph(e.json, (lat, lon) => MP().toFt({ lat, lng: lon })), res = OSM.route(g, clicks, { label: SI.label });
    const first0 = e.src === 'osm' ? RS.OVERPASS[0].url : ((RS.STATES[RS.stOfData(e.src)] || {}).layers || [{}])[0].url;
    const via = e.cached ? '' : ` from ${esc(RS.host(e.ep))}${e.layer ? ` layer ${esc(RS.layerTail(e.layer.url))} "${esc(e.layer.name)}"` : ''}${e.fails.length ? ` (${e.fails.map(f => `${esc(srcName(f.src))} failed: ${esc(failBrief(f))}`).join('; ')})` : RS.host(e.ep) !== RS.host(first0) ? ' (a fallback endpoint)' : ''}${e.more ? '; the area has more roads than were fetched' : ''}`;
    const reps = !e.cached && e.reps && e.reps.length > 1 ? `<br>${esc(SI.label)} requests: ${e.reps.map(r => esc(RS.repText(r))).join('<br>&nbsp;&nbsp;')}` : '';
    if (!res.ok) { setMsg(`Snap to road: ${esc(res.why)}. ${g.edges.length} road segments in the area (${esc(SI.ATTR)}${via}).${stateNote(e.state)}${reps}`); refresh(); MP().status(`<span class="warnT">Snap to road: ${esc(res.why)}.</span> <button type="button" data-rdb="retry">Retry</button> <button type="button" data-rdb="clear">OK</button>`); return; }
    setMsg(`Snapped along ${res.names.map(n => esc(n.name)).join(' → ') || 'the roads'} (${Math.round(res.L)} ft${e.cached ? ', roads from this browser\'s cache of ' + esc(String(e.at).slice(0, 10)) : ''}${e.stored === false ? '; not cached: IndexedDB unavailable' : ''}). Roads${via}. ${esc(SI.ATTR)}; ${esc(SI.NOT_SURVEY)}.${e.cached ? '' : stateNote(e.state)}${reps}`);
    const src = { kind: 'osm', at: e.at, names: res.names, against: res.against, cl: res.pts, snaps: res.snaps.map(s => ({ d: s.d, name: s.name })) }; if (e.src && e.src !== 'osm') src.data = e.src;
    RUI().addRoute(res.pts, { src, lane: { on: false, w: null } });
  }
  /* ---------- the Route tab's buttons (ui/route.js renders html() in its Draw section and passes the clicks) ---------- */
  function setHtml() {
    const st = settings(), last = [st.lastOvp, st.lastMd, st.lastRi, st.lastCt].filter(Boolean).map(u => esc(RS.host(u))).join(', ');
    const tl = [...RS.OVERPASS, ...RS.STATES.MA.layers, ...RS.STATES.RI.layers, ...RS.STATES.CT.layers].map(e => `<a href="${esc(RS.statusUrl(e.url))}" target="_blank" rel="noopener">${esc(RS.host(e.url))}</a>`).join(' · ');
    return `<details class="crVxList" id="rdSet"${setOpen ? ' open' : ''}><summary>Road data settings</summary>
      <div class="fRow"><label for="rdSrc">Road data</label><select id="rdSrc">${SRCS.map(([k, l]) => `<option value="${k}"${st.src === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div class="fRow"><label for="rdOvp">Road data endpoint (Overpass API, advanced)</label><input id="rdOvp" type="url" spellcheck="false" value="${esc(st.ovp)}" placeholder="${esc(RS.OVERPASS[0].url)}"></div>
      ${['MA', 'RI', 'CT'].map(k => { const S = RS.STATES[k], id = 'rd' + S.set[0].toUpperCase() + S.set.slice(1); return `<div class="fRow"><label for="${id}">${esc(S.name)}: ${esc(S.label)} road layer URL (ArcGIS REST, advanced)</label><input id="${id}" type="url" spellcheck="false" value="${esc(st[S.set])}" placeholder="${esc(S.layers[0].url)}"></div>`; }).join('')}
      <div class="goRow"><button type="button" data-road="setSave">Save settings</button><button type="button" data-road="setReset">Defaults</button></div>
      <p class="note">An endpoint typed here is tried first, then the one that last worked${last ? ` (${last})` : ''}, then ${RS.OVERPASS.map(e => esc(RS.host(e.url))).join(', ')} (Overpass, POST then GET, ${Math.round(RS.TIMEOUT_MS / 1000)} s each; a busy server is asked again after 2, 4, 8 s, at most 30 s); then the road centrelines of the site's state (by its location; near a border, the project's State Plane zone): MassDOT / MassGIS, RIGIS / RIDOT or CTDOT. A layer with no road lines is looked up and the service's road (polyline) layer used. Test connection (opens the server's status page in a new tab): ${tl}.</p></details>`;
  }
  function html() {
    return `<div id="rdBox"><div class="crTools" id="rdTools"><button type="button" class="tbBtn${mode === 'snap' ? ' on' : ''}" data-road="snap" title="Click a start and an end point (and via points) near roads: the route follows the OpenStreetMap roads">Snap to road (OpenStreetMap)</button><button type="button" class="tbBtn${mode === 'trace' ? ' on' : ''}" data-road="trace" title="Press and drag along the road on the aerial">Trace</button></div>
      <div class="goRow"><button type="button" data-road="diag" title="One tiny request to each road server (Overpass; the state road layer) and its raw answer: HTTP code and the first 300 characters"${diagBusy ? ' disabled' : ''}>${diagBusy ? 'Diagnosing…' : 'Diagnose road data'}</button>${lastSnap && !busy ? '<button type="button" data-road="retry" title="Fetch the roads for the last Snap to road points again (not from the cache)">Retry snap</button>' : ''}</div>
      <div class="note" id="rdMsg"${msg || busy ? '' : ' hidden'}>${busy ? (busyText || 'Getting the roads…') : msg}</div>${setHtml()}</div>`;
  }
  function setAct(k) {
    const g = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    if (k === 'setReset') { const o = settings(); saveSettings({ src: 'auto', ovp: '', md: '', ri: '', ct: '', lastOvp: o.lastOvp, lastMd: o.lastMd, lastRi: o.lastRi, lastCt: o.lastCt }); setOpen = true; setMsg('Road data settings: defaults restored.'); return; }
    const ovp = g('rdOvp'), md = g('rdMd'), ri = g('rdRi'), ct = g('rdCt'), bad = [[ovp, 'Road data endpoint'], [md, 'Massachusetts road layer URL'], [ri, 'Rhode Island road layer URL'], [ct, 'Connecticut road layer URL']].filter(([u]) => u && !RS.validUrl(u));
    setOpen = true; if (bad.length) { setMsg(`<span class="warnT">${bad.map(x => esc(x[1])).join(' and ')}: enter a full https:// address (or leave it blank for the defaults). Not saved.</span>`); return; }
    const o = settings(); o.src = g('rdSrc') || 'auto'; o.ovp = ovp; o.md = md; o.ri = ri; o.ct = ct;
    setMsg(saveSettings(o) ? 'Road data settings saved (this browser).' : '<span class="warnT">Road data settings could not be saved (browser storage unavailable).</span>');
  }
  /* Diagnose road data: one tiny request per source at the last snap centre (else the map centre); the raw outcome, to screenshot */
  async function diagnose() {
    if (diagBusy || !MP() || !MP().map) return; diagBusy = true;
    const c = lastSnap ? lastSnap.ll : (() => { const q = MP().map.getCenter(); return { lat: q.lat, lng: q.lng }; })(), st = settings();
    setMsg(`Diagnose road data: asking each server at ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}…`);
    let out; try { out = await RS.diagnose(fetchFn, c, { zone: zoneOf(), ovp: st.ovp, lastOvp: st.lastOvp, urls: st }); } catch (x) { diagBusy = false; setMsg(`Diagnose road data: ${esc(String((x && x.message) || x))}`); return; }
    diagBusy = false;
    const so = out.state || {}, when = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    setMsg(`<b>Diagnose road data</b> (${esc(when)}; site ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}; state: ${esc(so.st ? RS.STATES[so.st].name + ' (' + RS.STATES[so.st].label + ', by ' + so.by + ')' : 'none')}${so.note ? '; ' + esc(so.note) : ''}; zone ${esc(zoneOf())}):
      <div class="crDiag" id="rdDiag" style="font-family:ui-monospace,Consolas,monospace;font-size:11px;white-space:pre-wrap;word-break:break-all;max-height:22em;overflow:auto;border:1px solid var(--line,#ccc);padding:4px;margin-top:4px">${out.map(r => `<div data-rddiag="${esc(r.label)}"><b>${esc(r.src)} · ${esc(r.label)}</b>: ${r.http != null ? 'HTTP ' + r.http : esc(r.err)} · ${r.ms} ms\n${esc(r.url)}${r.body ? '\n' + esc(r.body) : ''}</div>`).join('')}</div>
      Screenshot this list for IT or the developer. HTTP 200 with a body = the server answered this page; an "error" in an ArcGIS body = the layer refused the request; "network error" = blocked, offline or no CORS header.`);
  }
  function click(el) { const k = el.dataset.road; if (k === 'setSave' || k === 'setReset') { setAct(k); return; } if (k === 'diag') { diagnose(); return; } if (k === 'retry') { retry(); return; } if (mode === k) { end(); return; } start(k); }
  function retry() { if (!lastSnap || busy) return; snapRoads(lastSnap.clicks, true); }
  function refresh() { const t = document.getElementById('rdBox'); if (t) t.outerHTML = html(); }
  document.addEventListener('toggle', e => { if (e.target && e.target.id === 'rdSet') setOpen = e.target.open; }, true);
  A.on('ready', () => { const st = document.getElementById('mbStatus'); if (st) st.addEventListener('click', e => { const b = e.target.closest('[data-rdb]'); if (!b) return; if (b.dataset.rdb === 'finish') finishSnap(); else if (b.dataset.rdb === 'clear') MP().status(''); else if (b.dataset.rdb === 'retry') retry(); else end(); }); });
  A.on('project', () => { if (mode) end(); });
  window.CranePickRoadUI = { html, click, start, end, finishSnap, snapRoads, retry, diagnose, roads, settings, failText, orderOf, get mode() { return mode; }, get msg() { return msg; }, get lastSnap() { return lastSnap; }, PAD_FT };
})();
