/* apps/crane-pick/ui/map.js — the Plan output tab: the Leaflet map (window.CranePickMap). C1 (2026-11-16).
   Base layers: Esri World Imagery (satellite), OpenStreetMap (street), None (a blank grid: the plan-sheet-only mode, and what the map
   shows when tiles cannot load, e.g. offline). Scale bar (Leaflet, feet / miles), cursor coordinates in latitude / longitude and in the
   project's State Plane zone (engine/geo.js through proj4), "go to" a latitude / longitude or a State Plane coordinate (no geocoder).
   Positions of the project are in the site frame (grid ftUS, engine/geo.js); toLL / toFt convert for Leaflet.
   Tools (ui/draw.js, ui/sheets.js) take the map's clicks through setTool(tool): tool = { click(ft, ev), move(ft, ev), dbl(ft, ev),
   key(ev), cursor }. raf(key, fn) runs fn once in the next animation frame (drag updates). */
(function () {
  'use strict';
  const A = window.CranePickApp, G = window.CranePickGeo, esc = A.esc;
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const ATTR_ESRI = 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';
  const ATTR_OSM = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
  const BASES = { sat: 'Satellite (Esri World Imagery)', street: 'Street (OpenStreetMap)', none: 'None (plan sheet only)' };
  let map = null, layers = {}, base = null, coordEl = null, tool = null, ok = false, tileErr = 0, tileOk = 0, goMark = null, last = null;
  const zoneId = () => A.P.site.zone;
  const toLL = p => { const r = G.ftToLl(window.proj4, zoneId(), p.x, p.y); return window.L.latLng(r.lat, r.lng); };
  const toFt = ll => G.llToFt(window.proj4, zoneId(), ll.lat, ll.lng);
  const frames = new Map();
  function raf(key, fn) { if (frames.has(key)) { frames.get(key).fn = fn; return; } const o = { fn }; frames.set(key, o); requestAnimationFrame(() => { frames.delete(key); o.fn(); }); }
  const fmt = (v, d) => Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  function llText(ll) { return `${fmt(Math.abs(ll.lat), 6)}° ${ll.lat >= 0 ? 'N' : 'S'}, ${fmt(Math.abs(ll.lng), 6)}° ${ll.lng >= 0 ? 'E' : 'W'}`; }
  function gridText(ll) { const z = G.zone(zoneId()), n = G.llToNative(window.proj4, z.id, ll.lat, ll.lng); return `E ${fmt(n.E, 2)} · N ${fmt(n.N, 2)} ${z.unit}, ${z.short.replace(/\s*\(.*\)$/, '')}`; }
  function showCoord(ll, what) { if (!coordEl || !ll) return; coordEl.innerHTML = `<b>${what}</b> ${esc(llText(ll))}<br>${esc(gridText(ll))}`; }
  function msg(html) { const m = document.getElementById('mapMsg'); if (!m) return; m.hidden = !html; m.innerHTML = html || ''; }
  function setBase(k, quiet) {
    if (!BASES[k]) k = 'sat';
    A.ui.base = k; A.saveUi();
    if (!map) return;
    Object.keys(layers).forEach(n => { if (n !== k && map.hasLayer(layers[n])) map.removeLayer(layers[n]); });
    if (!map.hasLayer(layers[k])) layers[k].addTo(map);
    base = k; tileErr = 0; tileOk = 0; msg('');
    document.getElementById('map').classList.toggle('blank', k === 'none');
    if (!quiet) A.emit('base', k);
  }
  function build(el) {
    el.innerHTML = `<div id="planPane"><div id="mapBar"></div>
      <div id="mapWrap"><div id="map" role="application" aria-label="Site plan map"></div><div id="mapMsg" hidden></div><div id="mbStatus" role="status" aria-live="polite"></div></div></div>`;
    if (!window.L || !window.proj4) {
      document.getElementById('map').classList.add('blank');
      msg('The map libraries (Leaflet, proj4js) did not load: they come from unpkg.com / cdnjs.cloudflare.com and need the internet the first time. The Project, Site and Report tabs still work.');
      return;
    }
    const L = window.L;
    map = L.map('map', { maxZoom: 23, minZoom: 3, zoomControl: true, boxZoom: true, doubleClickZoom: false, worldCopyJump: false, zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 90 });
    layers.sat = L.tileLayer(ESRI, { maxZoom: 23, maxNativeZoom: 19, attribution: ATTR_ESRI });
    layers.street = L.tileLayer(OSM, { maxZoom: 23, maxNativeZoom: 19, attribution: ATTR_OSM });
    layers.none = L.layerGroup();
    ['sat', 'street'].forEach(k => {
      layers[k].on('tileerror', () => { if (base !== k) return; tileErr++; if (tileErr >= 4 && !tileOk) msg('Map tiles are not loading (offline, or the tile server is blocked). The plan sheet and the drawing tools work without them; <button type="button" id="mmNone">Use no base map</button>'); });
      layers[k].on('tileload', () => { if (base !== k) return; tileOk++; if (tileOk === 1) msg(''); });
    });
    const ctl = L.control.layers({ [BASES.sat]: layers.sat, [BASES.street]: layers.street, [BASES.none]: layers.none }, null, { position: 'topright', collapsed: true }).addTo(map);
    map.on('baselayerchange', e => { const k = Object.keys(BASES).find(n => BASES[n] === e.name); if (k && k !== base) setBase(k); });
    L.control.scale({ imperial: true, metric: false, maxWidth: 160, position: 'bottomright' }).addTo(map);
    const Coord = L.Control.extend({ onAdd: () => { const d = L.DomUtil.create('div', 'crCoord'); d.id = 'crCoord'; L.DomEvent.disableClickPropagation(d); return d; } });
    new Coord({ position: 'bottomleft' }).addTo(map); coordEl = document.getElementById('crCoord');
    map.on('mousemove', e => { last = e.latlng; raf('coord', () => { showCoord(last, 'Cursor'); if (tool && tool.move) tool.move(toFt(last), e); }); });
    map.on('mouseout', () => showCoord(map.getCenter(), 'Center'));
    map.on('moveend', () => { const c = map.getCenter(); if (!last) showCoord(c, 'Center'); A.viewChanged({ lat: c.lat, lng: c.lng, z: map.getZoom() }); });
    map.on('click', e => { if (tool && tool.click) { e._crTool = true; tool.click(toFt(e.latlng), e); } });   // _crTool: the click was a tool's (no deselect)
    map.on('dblclick', e => { if (tool && tool.dbl) tool.dbl(toFt(e.latlng), e); });
    document.getElementById('mapMsg').addEventListener('click', e => { if (e.target.id === 'mmNone') setBase('none'); });
    // the map's box changes with the notices above it and the panels beside it: keep Leaflet's size in step (clicks land where they are drawn)
    if (window.ResizeObserver) new ResizeObserver(() => map.invalidateSize({ pan: false })).observe(document.getElementById('map'));
    ok = true; setBase(A.ui.base || 'sat', true); void ctl;
  }
  function home() { const z = G.zone(zoneId()); return { lat: z.home.lat, lng: z.home.lng, z: 16 }; }
  function setView(v) { if (!map) return; v = v || home(); map.setView([v.lat, v.lng], v.z || 17, { animate: false }); showCoord(map.getCenter(), 'Center'); }
  function goTo(lat, lng, z) {
    if (!map) return false; const L = window.L;
    map.setView([lat, lng], z || Math.max(map.getZoom(), 18), { animate: false });
    if (goMark) goMark.remove();
    goMark = L.circleMarker([lat, lng], { radius: 9, color: '#DC2626', weight: 3, fill: false, interactive: false }).addTo(map);
    setTimeout(() => { if (goMark) { goMark.remove(); goMark = null; } }, 8000);
    return true;
  }
  /* fit(points) -> the map shows all the given site-frame points */
  function fit(pts) { if (!map || !pts.length) return false; const b = window.L.latLngBounds(pts.map(toLL)); map.fitBounds(b.pad(0.15), { animate: false, maxZoom: 21 }); return true; }
  function setTool(t) {
    if (tool && tool.end) tool.end();
    tool = t || null;
    if (map) { map.getContainer().style.cursor = tool && tool.cursor || ''; map.getContainer().classList.toggle('crTool', !!tool); }   // crTool: the items let clicks through to the tool
  }
  function status(html) { const s = document.getElementById('mbStatus'); if (s) s.innerHTML = html || ''; }
  A.outTab({ id: 'plan', label: 'Plan', build, show: () => { if (map) setTimeout(() => map.invalidateSize(), 0); } });
  A.on('project', () => { if (map) { setView(A.P.view); } });
  A.on('change', o => { if (o.kind === 'site' && map && last) showCoord(last, 'Cursor'); });
  A.on('key', e => { if (tool && tool.key) tool.key(e); });
  window.CranePickMap = { get map() { return map; }, get ok() { return ok; }, toLL, toFt, raf, setBase, get base() { return base; }, BASES, goTo, fit, setView, home, setTool,
    get tool() { return tool; }, status, llText, gridText, bar: () => document.getElementById('mapBar') };
})();
