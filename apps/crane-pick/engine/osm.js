/* apps/crane-pick/engine/osm.js — roads from OpenStreetMap through the Overpass API: the query, the road graph, snapping, the shortest
   path along the roads (Dijkstra), the road names and one-way warnings along it (window.CranePickOSM). Classic script, no DOM, no
   fetch (ui/road.js fetches and caches). 2026-11-17.
   Data: © OpenStreetMap contributors, Open Database License (ODbL) 1.0 — https://www.openstreetmap.org/copyright. Wherever the data
   (or a route made from it) is shown or printed, ATTR is shown with it, and the geometry is labelled NOT_SURVEY.
   Overpass API (https://overpass-api.de/api/interpreter): POST, body "data=" + the URL-encoded query (a CORS "simple" request: form
   content type, no preflight). The query asks for the drivable highway=* ways in the box with their geometry ("out geom": each way
   has "nodes" (OSM node ids) and "geometry" [{ lat, lon }] of the same length, and "tags").
   Positions: lat / lon in, the site frame out through proj(lat, lon) -> { x, y } (grid ft). Graph distances: grid ft. */
(function () {
  'use strict';
  const URL = 'https://overpass-api.de/api/interpreter';
  const ATTR = '© OpenStreetMap contributors';
  const ATTR_URL = 'https://www.openstreetmap.org/copyright';
  const NOT_SURVEY = 'from OpenStreetMap — not survey';
  // drivable highway values (Decision pending engineer review: footways, paths, cycleways, steps, bridleways, platforms, proposed and
  // abandoned ways are left out; service roads, tracks and roads under construction are kept: a construction convoy may use them)
  const HW = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'service', 'track', 'living_street', 'road',
    'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link', 'construction', 'busway'];
  const FT_PER_DEG_LAT = 364000;   // ≈ 69.0 mi; only for padding the query box
  const isNum = v => typeof v === 'number' && isFinite(v);
  /* the query box around lat / lon points, padded by pad ft, rounded outward to 0.001° (so nearby requests share a cache entry) */
  function bboxOf(lls, padFt) {
    let s = 90, w = 180, n = -90, e = -180; lls.forEach(p => { s = Math.min(s, p.lat); n = Math.max(n, p.lat); w = Math.min(w, p.lng); e = Math.max(e, p.lng); });
    const dLat = (padFt || 0) / FT_PER_DEG_LAT, dLng = dLat / Math.max(0.2, Math.cos((s + n) / 2 * Math.PI / 180));
    const dn = v => Math.floor(v * 1000) / 1000, up = v => Math.ceil(v * 1000) / 1000;
    return { s: dn(s - dLat), w: dn(w - dLng), n: up(n + dLat), e: up(e + dLng) };
  }
  const bboxKey = b => [b.s, b.w, b.n, b.e].map(v => v.toFixed(3)).join(',');
  const contains = (a, b) => a.s <= b.s + 1e-9 && a.w <= b.w + 1e-9 && a.n >= b.n - 1e-9 && a.e >= b.e - 1e-9;
  function query(b) { return `[out:json][timeout:25];way["highway"~"^(${HW.join('|')})$"](${b.s},${b.w},${b.n},${b.e});out geom;`; }
  function body(b) { return 'data=' + encodeURIComponent(query(b)); }
  /* one-way: +1 along the way's node order, −1 against it, 0 both ways (oneway=yes/true/1, -1/reverse; roundabouts and motorways
     are one-way unless oneway=no) */
  function oneway(t) {
    t = t || {}; const o = String(t.oneway || '').toLowerCase();
    if (o === 'no' || o === 'false' || o === '0' || o === 'alternating' || o === 'reversible') return 0;
    if (o === 'yes' || o === 'true' || o === '1') return 1; if (o === '-1' || o === 'reverse') return -1;
    if (t.junction === 'roundabout' || t.junction === 'circular' || t.highway === 'motorway') return 1; return 0;
  }
  function wayName(t) { t = t || {}; return t.name || (t.ref ? t.ref : '') || `unnamed ${t.highway || 'road'}`; }
  /* graph(json, proj) -> { nodes: Map(key -> { x, y, lat, lon }), adj: Map(key -> [{ to, w, way, fwd }]), ways: Map(id -> { name, tags, ow }),
     edges: [{ a, b, way, k (index along the way) }], n }  — ways without geometry or with a highway value not drivable are skipped */
  function graph(json, proj) {
    const nodes = new Map(), adj = new Map(), ways = new Map(), edges = [];
    const els = (json && Array.isArray(json.elements)) ? json.elements : [];
    const link = (a, b, w, way, fwd) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push({ to: b, w, way, fwd }); };
    els.forEach(el => {
      if (!el || el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 2) return;
      const t = el.tags || {}; if (HW.indexOf(t.highway) < 0) return;
      const id = String(el.id), ow = oneway(t); ways.set(id, { name: wayName(t), tags: t, ow });
      const keys = el.geometry.map((g, i) => { if (!g || !isNum(g.lat) || !isNum(g.lon)) return null; const k = Array.isArray(el.nodes) && el.nodes[i] != null ? 'n' + el.nodes[i] : 'p' + g.lat.toFixed(7) + ',' + g.lon.toFixed(7);
        if (!nodes.has(k)) { const p = proj(g.lat, g.lon); nodes.set(k, { x: p.x, y: p.y, lat: g.lat, lon: g.lon }); } return k; });
      for (let i = 1; i < keys.length; i++) { const a = keys[i - 1], b = keys[i]; if (!a || !b || a === b) continue; const A = nodes.get(a), B = nodes.get(b), w = Math.hypot(B.x - A.x, B.y - A.y);
        link(a, b, w, id, true); link(b, a, w, id, false); edges.push({ a, b, way: id, k: i - 1 }); }
    });
    return { nodes, adj, ways, edges, n: nodes.size };
  }
  /* snap(g, p) -> the nearest point on a road: { e (edge), t (0 … 1 from a to b), q (the point), d (ft) } or null */
  function snap(g, p) {
    let best = null;
    g.edges.forEach(e => { const A = g.nodes.get(e.a), B = g.nodes.get(e.b), dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy; let t = L2 ? ((p.x - A.x) * dx + (p.y - A.y) * dy) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const q = { x: A.x + dx * t, y: A.y + dy * t }, d = Math.hypot(p.x - q.x, p.y - q.y); if (!best || d < best.d) best = { e, t, q, d }; });
    return best;
  }
  /* binary heap */
  function Heap() { const a = []; return { push(k, v) { a.push([k, v]); let i = a.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break; [a[i], a[j]] = [a[j], a[i]]; i = j; } },
    pop() { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } } return top; },
    get size() { return a.length; } }; }
  /* dijkstra(adj, from, to) -> { d, path: [keys], steps: [{ way, fwd }] } or null (one-way tags are not obeyed: warnings only) */
  function dijkstra(adj, from, to) {
    const D = new Map([[from, 0]]), prev = new Map(), done = new Set(), H = Heap(); H.push(0, from);
    while (H.size) { const [d, u] = H.pop(); if (done.has(u)) continue; done.add(u); if (u === to) break;
      (adj.get(u) || []).forEach(e => { const nd = d + e.w; if (!D.has(e.to) || nd < D.get(e.to) - 1e-12) { D.set(e.to, nd); prev.set(e.to, { u, e }); H.push(nd, e.to); } }); }
    if (!done.has(to)) return null;
    const path = [to], steps = []; let c = to; while (c !== from) { const p = prev.get(c); steps.unshift(p.e); path.unshift(p.u); c = p.u; }
    return { d: D.get(to), path, steps };
  }
  /* route(g, pts, o) -> { ok, why, pts (the road centreline from the first snapped point to the last), L, snaps: [{ d, q, name }],
     names: [{ name, s0, s1 }], against: [{ name, s0, s1 }] (one-way roads travelled against their direction) }
     pts: the start, any via points, the end (site frame); o.maxSnap (ft, default 150): farther from every road = not snapped */
  function route(g, pts, o) {
    const maxSnap = o && isNum(o.maxSnap) ? o.maxSnap : 150;
    if (!g || !g.edges.length) return { ok: false, why: 'no drivable OpenStreetMap roads in the area' };
    if (!pts || pts.length < 2) return { ok: false, why: 'click a start and an end point' };
    const sn = pts.map(p => snap(g, p));
    const far = sn.findIndex(s => !s || s.d > maxSnap); if (far >= 0) return { ok: false, why: `point ${far + 1} is ${sn[far] ? Math.round(sn[far].d) + ' ft' : 'too far'} from the nearest OpenStreetMap road (limit ${maxSnap} ft): click nearer a road` };
    const out = [], seq = [];   // seq: [{ p, way, fwd }] the travelled points with the way they are reached along
    for (let k = 0; k < sn.length - 1; k++) {
      const a = sn[k], b = sn[k + 1], adj = new Map(g.adj), S = 'v:s' + k, E = 'v:e' + k;
      const vlink = (m, x, y, w, way, fwd) => { const l = (m.get(x) || []).slice(); l.push({ to: y, w, way, fwd }); m.set(x, l); };
      const virt = (V, s, fromV) => { const A = g.nodes.get(s.e.a), B = g.nodes.get(s.e.b), L = Math.hypot(B.x - A.x, B.y - A.y);
        if (fromV) { vlink(adj, V, s.e.a, L * s.t, s.e.way, false); vlink(adj, V, s.e.b, L * (1 - s.t), s.e.way, true); }
        else { vlink(adj, s.e.a, V, L * s.t, s.e.way, true); vlink(adj, s.e.b, V, L * (1 - s.t), s.e.way, false); } };
      virt(S, a, true); virt(E, b, false);
      if (a.e === b.e) vlink(adj, S, E, Math.abs(b.t - a.t) * Math.hypot(g.nodes.get(a.e.b).x - g.nodes.get(a.e.a).x, g.nodes.get(a.e.b).y - g.nodes.get(a.e.a).y), a.e.way, b.t >= a.t);
      const r = dijkstra(adj, S, E); if (!r) return { ok: false, why: `points ${k + 1} and ${k + 2} are on roads that do not connect in the OpenStreetMap data of this area` };
      const ptOf = key => key === S ? a.q : key === E ? b.q : g.nodes.get(key);
      r.path.forEach((key, i) => { const p = ptOf(key); if (i === 0 && seq.length) return; seq.push({ p: { x: p.x, y: p.y }, way: i ? r.steps[i - 1].way : r.steps[0] ? r.steps[0].way : a.e.way, fwd: i ? r.steps[i - 1].fwd : true }); });
    }
    let s = 0; const names = [], against = [];
    seq.forEach((q, i) => {
      if (i) { const d = Math.hypot(q.p.x - seq[i - 1].p.x, q.p.y - seq[i - 1].p.y); if (d < 1e-6) return; s += d; }
      if (out.length && Math.hypot(q.p.x - out[out.length - 1].x, q.p.y - out[out.length - 1].y) < 1e-6) return;
      out.push(q.p); if (!i) return;
      const w = g.ways.get(q.way), nm = w ? w.name : 'road', s0 = s - Math.hypot(q.p.x - seq[i - 1].p.x, q.p.y - seq[i - 1].p.y);
      const last = names[names.length - 1]; if (last && last.name === nm) last.s1 = s; else names.push({ name: nm, s0, s1: s });
      const bad = w && w.ow && ((w.ow > 0) !== q.fwd); if (bad) { const la = against[against.length - 1]; if (la && la.name === nm && Math.abs(la.s1 - s0) < 1e-6) la.s1 = s; else against.push({ name: nm, s0, s1: s }); }
    });
    if (out.length < 2) return { ok: false, why: 'the snapped points are the same point on the road' };
    return { ok: true, pts: out, L: s, snaps: sn.map(x => ({ d: x.d, q: x.q, name: (g.ways.get(x.e.way) || {}).name })), names, against };
  }
  window.CranePickOSM = { URL, ATTR, ATTR_URL, NOT_SURVEY, HW, bboxOf, bboxKey, contains, query, body, oneway, wayName, graph, snap, dijkstra, route };
})();
