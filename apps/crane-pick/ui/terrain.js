/* apps/crane-pick/ui/terrain.js — preliminary terrain from USGS 3DEP in the app (window.CranePickTerrainUI). C8 (2026-11-16).
   Engineer decision 2026-11-16: USGS 3DEP online ONLY (no survey import, no clicked spot elevations). Every value from it is labelled
   "preliminary terrain (USGS 3DEP, ~1–3 m)"; the Report states it is not adequate to certify crane levelness — survey data governs.
   Terrain input tab: "Fetch terrain for this site" (the map view or the site extent, a grid spacing; a request-size limit), the source
   and fetch date, "use terrain for ground elevations" (pad / pick / set ground when not entered: engine/elev.js setTerrain), the map
   layers (contours at an interval, slope colours), per crane setup the level tolerance (the crane manual's value), the blocking limit,
   the levelling datum and the grading pad, per route the maximum grade, grade base, load underside height and clearance margin.
   Terrain output tab: levelness per setup (ground under each float / track end, slopes, badge, blocking), pad cut / fill, route
   profiles (chart, grades per segment, crests / sags, the long-load clearance), each with its worked steps (CLAUDE.md §6). Map: contours,
   the slope overlay, a levelness badge per crane that follows every drag, the elevation under the cursor. Report §Terrain.
   Data: fetched in this browser from the USGS 3DEP ImageServer (getSamples, batches of points; EPQS for a few points when that fails),
   cached per browser in IndexedDB crane.terrain.v1 (never in the project: the project keeps the settings and what was used, with the
   fetch date). Offline: a clear message; everything else works. Values: engine/terrain.js. */
(function () {
  'use strict';
  const A = window.CranePickApp, T = window.CranePickTerrain, G = window.CranePickGeo, M = window.CranePickModel, esc = A.esc;
  const MP = () => window.CranePickMap, L_ = () => window.L, EL = () => window.CranePickElev, GR = () => window.CranePickGround, RT = () => window.CranePickRoute;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const fmt = (v, d) => isNum(v) ? (Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';   // no "−0.00"
  const LBL = T.LABEL, STATUS = { ok: 'level', warn: 'level it', stop: 'grade / check', none: 'no terrain' };
  let inEl = null, outEl = null, dirty = true, busy = false, prog = '', lastErr = '', openSteps = new Set();
  const grids = new Map();   // fetch id -> grid (engine/terrain.js)
  const PT = () => A.P.terrain || M.normTerrain(null);
  const cur = () => { const s = PT().src; return s ? grids.get(s.id) || null : null; };
  const showC = () => A.ui.trC !== false, showS = () => A.ui.trS === true;
  /* ---------- the cache (IndexedDB crane.terrain.v1, store "grid") ---------- */
  const DB = M.KEYS.terrainDb || 'crane.terrain.v1';
  function db() { return new Promise((res, rej) => { if (!window.indexedDB) return rej(new Error('IndexedDB not available')); const q = indexedDB.open(DB, 1); q.onupgradeneeded = () => { const d = q.result; if (!d.objectStoreNames.contains('grid')) d.createObjectStore('grid', { keyPath: 'id' }); }; q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
  async function cachePut(rec) {
    const d = await db(); await new Promise((res, rej) => { const tr = d.transaction('grid', 'readwrite'), s = tr.objectStore('grid'); s.put(rec);
      const all = s.getAll(); all.onsuccess = () => { const old = (all.result || []).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(12); old.forEach(o => s.delete(o.id)); };   // keep the 12 latest fetches
      tr.oncomplete = res; tr.onerror = () => rej(tr.error); }); d.close();
  }
  async function cacheGet(id) { const d = await db(); const r = await new Promise((res, rej) => { const q = d.transaction('grid').objectStore('grid').get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); d.close(); return r; }
  let loading = null;
  function ensure() {
    const s = PT().src; if (!s || grids.has(s.id) || loading === s.id) return;
    loading = s.id;
    cacheGet(s.id).then(r => { loading = null; if (r && r.z) { grids.set(s.id, T.makeGrid(r, Array.from(r.z), { at: r.at, res: r.res })); changed(); } else { lastErr = `The terrain fetched on ${s.at.slice(0, 10)} is not in this browser's cache: fetch it again (Terrain tab).`; changed(); } })
      .catch(e => { loading = null; lastErr = 'The terrain cache of this browser could not be read (' + e.message + '): fetch the terrain again.'; changed(); });
  }
  /* ---------- the elevation provider (engine/elev.js) ---------- */
  const craneOf = u => { const c = u && A.P.cranes.find(x => x.id === u.craneId); return c ? c.def : null; };
  const lvlMemo = new Map();
  function levelOf(u) {
    const g = cur(); if (!g || !u) return null; const c = craneOf(u); if (!c) return null;
    const key = JSON.stringify([PT().src.id, u.x, u.y, u.heading, u.group, u.boom, u.mode, u.lvl, u.craneId, (A.P.cranes.find(x => x.id === u.craneId) || {}).fp]);
    if (lvlMemo.has(key)) return lvlMemo.get(key);
    const S = GR().supports(c, u), l = u.lvl || {}, r = T.level(S, u, g, { tol: l.tol, maxBlk: l.maxBlk, datum: l.datum }, 'tr.' + u.id);
    if (lvlMemo.size > 200) lvlMemo.clear(); lvlMemo.set(key, r); return r;
  }
  const provider = {
    pad: u => { const r = levelOf(u); if (r && r.ok) return r.datum; const g = cur(); return g ? T.at(g, u.x, u.y) : null; },
    ground: (x, y) => { const g = cur(); return g ? T.at(g, x, y) : null; },
    depthPad: u => { const r = levelOf(u); if (r && r.ok) return r.zLo; const g = cur(); return g ? T.at(g, u.x, u.y) : null; }
  };
  function wire() { EL() && EL().setTerrain(PT().use && cur() ? provider : null); }
  function changed() { wire(); A.emit('change', { kind: 'terrain' }); }
  /* ---------- fetching ---------- */
  function siteExt() {
    const P = A.P, pts = []; const add = (q, r) => { if (q && isFinite(q.x) && isFinite(q.y)) { r = r || 0; pts.push({ x: q.x - r, y: q.y - r }, { x: q.x + r, y: q.y + r }); } };
    P.setups.forEach(u => add(u, 60)); P.picks.forEach(k => { add(k.pick, 10); add(k.set, 10); }); P.items.forEach(it => it.pts.forEach(q => add(q))); (P.routes || []).forEach(r => r.pts.forEach(q => add(q, 30)));
    (P.tandems || []).forEach(t => { add(t.pick, 60); add(t.set, 60); });
    if (!pts.length) return null; const xs = pts.map(q => q.x), ys = pts.map(q => q.y), m = 50;
    return { x0: Math.min(...xs) - m, y0: Math.min(...ys) - m, x1: Math.max(...xs) + m, y1: Math.max(...ys) + m };
  }
  function viewExt() { const m = MP() && MP().map; if (!m) return null; const b = m.getBounds(), c = [b.getSouthWest(), b.getNorthEast(), b.getNorthWest(), b.getSouthEast()].map(ll => MP().toFt(ll)); const xs = c.map(q => q.x), ys = c.map(q => q.y); return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }; }
  async function post(body, ms) {
    const ac = window.AbortController ? new AbortController() : null, t = ac ? setTimeout(() => ac.abort(), ms || 45000) : null;
    try { const r = await fetch(T.SERVICE, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: ac ? ac.signal : undefined, cache: 'no-store' });
      if (!r.ok) throw Object.assign(new Error('USGS service answered HTTP ' + r.status), { http: true }); return await r.json(); }
    finally { if (t) clearTimeout(t); }
  }
  async function fetchTerrain() {
    if (busy) return; const P = A.P, tr = PT();
    if (!window.proj4 || !MP() || !MP().map) { lastErr = 'The map libraries did not load: the terrain needs the map (proj4js) to place the points.'; drawIn(); return; }
    const ext = tr.ext === 'site' ? (siteExt() || viewExt()) : viewExt(); if (!ext) return;
    const spec = T.gridSpec(ext, tr.spacing), pts = T.nodes(spec), lls = pts.map(q => G.ftToLl(window.proj4, P.site.zone, q.x, q.y));
    busy = true; lastErr = ''; prog = `Fetching ${spec.n.toLocaleString('en-US')} points…`; drawIn();
    const m = new Array(spec.n).fill(NaN), B = T.LIM.batch, jobs = []; let done = 0, res = null, svc = '3DEP ImageServer getSamples (bilinear)';
    for (let i = 0; i < pts.length; i += B) jobs.push(i);
    try {
      let k = 0;
      const worker = async () => { while (k < jobs.length) { const i0 = jobs[k++], part = lls.slice(i0, i0 + B), j = await post(T.samplesBody(part)), r = T.parseSamples(j, part.length);
        r.m.forEach((v, q) => { m[i0 + q] = v; }); if (isNum(r.res)) res = res == null ? r.res : Math.min(res, r.res); done += part.length; prog = `Fetching… ${Math.round(100 * done / spec.n)} % (${done.toLocaleString('en-US')} of ${spec.n.toLocaleString('en-US')} points)`; drawProg(); } };
      await Promise.all([worker(), worker(), worker()]);
    } catch (e) {
      if (spec.n <= T.LIM.epqsMax && !e.http) {   // a few points: EPQS one by one (asked in Feet)
        try { prog = 'getSamples failed; trying EPQS point by point…'; drawProg(); svc = 'EPQS (point query, feet)';
          for (let i = 0; i < lls.length; i++) { const r = await fetch(T.epqsUrl(lls[i]), { cache: 'no-store' }); const v = T.parseEpqs(await r.json()); m[i] = isNum(v) ? v / T.FT_PER_M : NaN; }
        } catch (e2) { return fail(e2); }
      } else return fail(e);
    }
    const z = m.map(v => isNum(v) ? v * T.FT_PER_M : NaN), id = 'tr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at = new Date().toISOString();
    const g = T.makeGrid(spec, z, { at, res }); grids.set(id, g);
    try { await cachePut({ id, at, svc, x0: spec.x0, y0: spec.y0, dx: spec.dx, nx: spec.nx, ny: spec.ny, z, res, zone: P.site.zone }); } catch (e) { lastErr = 'Fetched, but not cached in this browser (' + e.message + '): it is lost on reload.'; }
    busy = false; prog = ''; const nf = document.getElementById('trFail'); if (nf) nf.remove();
    if (g.nodata === g.z.length) { lastErr = 'The USGS service returned no elevations here (outside the 3DEP coverage?).'; drawIn(); return; }
    A.update(P2 => { P2.terrain = Object.assign(M.normTerrain(P2.terrain), { use: true, src: { id, at, svc, x0: spec.x0, y0: spec.y0, dx: spec.dx, nx: spec.nx, ny: spec.ny, n: spec.n, nodata: g.nodata, res, zmin: g.zmin, zmax: g.zmax, zone: P2.site.zone, asked: spec.asked } }); }, 'terrain');
    if (spec.grown) A.notice(`Terrain: the grid spacing was increased from ${fmt(spec.asked, 2)} to ${fmt(spec.dx, 2)} ft to stay within ${T.LIM.maxPts.toLocaleString('en-US')} points. Zoom in or choose "site extent" for a finer grid.`, 'warn', { id: 'trGrown' });
  }
  function fail(e) {
    busy = false; prog = '';
    const off = (typeof navigator !== 'undefined' && navigator.onLine === false) || e.name === 'TypeError' || e.name === 'AbortError';
    lastErr = off ? 'Could not reach the USGS 3DEP elevation service (offline, blocked by the network, or no answer). Terrain is optional: everything else in the app still works; fetch again when online.' : 'Terrain not fetched: ' + e.message;
    drawIn(); A.notice(esc(lastErr), 'warn', { id: 'trFail' }); return null;
  }
  /* ---------- map ---------- */
  const layers = { c: null, s: null, badges: new Map() };
  let rend = null;
  function pane() { const m = MP().map; if (!m.getPane('crTerrain')) { const p = m.createPane('crTerrain'); p.style.zIndex = 350; p.style.pointerEvents = 'none'; } if (!rend) rend = L_().canvas({ pane: 'crTerrain', padding: 0.3 }); return 'crTerrain'; }
  function clearMap() { if (layers.c) { layers.c.remove(); layers.c = null; } if (layers.s) { layers.s.remove(); layers.s = null; } }
  function drawMap() {
    clearMap(); const g = cur(); if (!g || !MP() || !MP().map || !window.L) return; const Lf = L_(), pn = pane(), m = MP().map;
    if (showS()) {
      const ll = []; for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) ll.push(MP().toLL({ x: g.x0 + i * g.dx, y: g.y0 + j * g.dx }));
      const N = (i, j) => ll[j * g.nx + i], rings = T.SLOPE_CLASSES.map(() => []);
      for (let j = 0; j < g.ny - 1; j++) for (let i = 0; i < g.nx - 1; i++) { const s = T.cellSlope(g, i, j); if (s == null) continue; rings[T.slopeClass(s)].push([N(i, j), N(i + 1, j), N(i + 1, j + 1), N(i, j + 1)]); }
      layers.s = Lf.layerGroup(rings.map((r, k) => r.length ? Lf.polygon(r, { pane: pn, renderer: rend, stroke: false, fillColor: T.SLOPE_CLASSES[k].col, fillOpacity: 0.38, interactive: false, className: 'crTrSlope' }) : null).filter(Boolean)).addTo(m);
    }
    if (showC()) {
      const c = T.contours(g, PT().contour), parts = [];
      c.levels.forEach(l => { parts.push(Lf.polyline(l.segs.map(s => s.map(q => MP().toLL(q))), { pane: pn, renderer: rend, color: l.major ? '#7C2D12' : '#B45309', weight: l.major ? 1.6 : 0.8, opacity: 0.85, interactive: false, className: 'crTrCont' }));
        if (l.major) { const s = l.segs[Math.floor(l.segs.length / 2)]; parts.push(Lf.marker(MP().toLL({ x: (s[0].x + s[1].x) / 2, y: (s[0].y + s[1].y) / 2 }), { pane: 'crTerrain', interactive: false, keyboard: false, icon: Lf.divIcon({ className: 'crTrCl', iconSize: null, html: `<span>${fmt(l.z, PT().contour < 1 ? 1 : 0)}</span>` }) })); } });
      layers.c = Lf.layerGroup(parts).addTo(m);
    }
  }
  function badge(u) {
    const old = layers.badges.get(u.id); if (old) { old.remove(); layers.badges.delete(u.id); }
    if (!MP() || !MP().map || !window.L) return; const r = levelOf(u); if (!r) return;
    const Lf = L_(), cls = r.status === 'ok' ? 'ok' : r.status === 'warn' ? 'warn' : 'stop';
    const txt = r.ok ? `Level ${fmt(r.sMax, 2)} %${r.sMax > r.tol ? ` · block ${fmt(r.bMax * 12, 1)} in` : ''}` : 'Level: ' + (r.status === 'none' ? 'no terrain' : 'terrain missing');
    const mk = Lf.marker(MP().toLL(u), { pane: 'markerPane', interactive: false, keyboard: false, zIndexOffset: 1400, icon: Lf.divIcon({ className: 'crLvl', iconSize: null, iconAnchor: [-16, 34], html: `<span class="lvb lvb-${cls}" data-lvb="${esc(u.id)}" title="${esc(LBL)}">${esc(txt)}</span>` }) }).addTo(MP().map);
    layers.badges.set(u.id, mk);
  }
  function badges() { [...layers.badges.keys()].forEach(id => { if (!A.P.setups.some(u => u.id === id)) { layers.badges.get(id).remove(); layers.badges.delete(id); } }); A.P.setups.forEach(badge); }
  /* cursor elevation (ui/map.js coordinates box) */
  function coordHtml(ll) { const g = cur(); if (!g || !ll || !MP()) return ''; const q = MP().toFt(ll), z = T.at(g, q.x, q.y); return `<br><b>Ground</b> ${z == null ? 'outside the terrain grid' : 'el. ' + fmt(z, 2) + ' ft NAVD 88'} <span class="crTrTag">(preliminary, USGS 3DEP)</span>`; }
  /* ---------- the Terrain input tab ---------- */
  const numIn = (id, v, lbl, unit, ph, data) => `<div class="fRow"><label for="${id}">${lbl}</label><input type="text" inputmode="decimal" id="${id}"${data || ''} value="${v == null ? '' : esc(String(v))}" placeholder="${esc(ph || '')}"><span class="unit">${unit}</span></div>`;
  function srcText() {
    const s = PT().src; if (!s) return '<p class="note">No terrain fetched for this project yet.</p>';
    const g = cur();
    return `<div class="kv"><div><span>Source</span><span>USGS 3DEP — ${esc(s.svc || 'ImageServer getSamples')}</span></div><div><span>Fetched</span><span>${esc(s.at.replace('T', ' ').slice(0, 16))} UTC</span></div>
      <div><span>Grid</span><span>${s.nx} × ${s.ny} = ${s.n.toLocaleString('en-US')} points at ${fmt(s.dx, 2)} ft</span></div><div><span>Native resolution</span><span>${s.res ? fmt(s.res, 2) + ' m' : 'not reported'}</span></div>
      <div><span>Ground el. range</span><span>${fmt(s.zmin, 2)} – ${fmt(s.zmax, 2)} ft</span></div><div><span>No data</span><span>${s.nodata} points</span></div><div><span>Vertical datum</span><span>${esc(T.DATUM)}</span></div>
      <div><span>In this browser</span><span>${g ? 'cached' : loading ? 'loading…' : '<span class="warnT">not cached: fetch again</span>'}</span></div></div>`;
  }
  function drawProg() { const e = inEl && inEl.querySelector('#trProg'); if (e) e.textContent = prog; }
  function drawIn() {
    if (!inEl) return; const P = A.P, t = PT(), g = cur();
    inEl.innerHTML = `<div class="sec"><div class="secHead">Terrain (USGS 3DEP)</div><div class="secBody">
      <p class="note"><span class="chip chipW">${esc(LBL)}</span> ${esc(T.CERT)}</p>
      <div class="fRow"><label for="trExt">Area</label><select id="trExt"><option value="view"${t.ext === 'view' ? ' selected' : ''}>the map view</option><option value="site"${t.ext === 'site' ? ' selected' : ''}>the site extent (cranes, picks, items, routes + 50 ft)</option></select></div>
      <div class="fRow"><label for="trSp">Grid spacing</label><select id="trSp">${[[3.28, '3.28 ft (≈ 1 m, native)'], [5, '5 ft (default)'], [10, '10 ft'], [20, '20 ft']].map(([v, l]) => `<option value="${v}"${Math.abs(t.spacing - v) < 1e-6 ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <p class="note">At most ${T.LIM.maxPts.toLocaleString('en-US')} points per fetch (${T.LIM.batch} per request; the spacing grows when the area needs more). The elevations are fetched by this browser from elevation.nationalmap.gov and kept in this browser only (IndexedDB); the project keeps the settings and the fetch date.</p>
      <div class="fRow"><button type="button" class="primary" id="trFetch"${busy ? ' disabled' : ''}>Fetch terrain for this site</button><span id="trProg" class="note">${esc(prog)}</span></div>
      ${lastErr ? `<p class="note warnT" id="trErr">${esc(lastErr)}</p>` : ''}
      ${srcText()}
      <label class="note" style="display:block"><input type="checkbox" id="trUse"${t.use ? ' checked' : ''}${t.src ? '' : ' disabled'}> Use terrain for ground elevations: crane pad (the levelling datum under the crane), pick and set ground, and the depth of buried items — when not entered (an entered value overrides). The pad elevations are then in NAVD 88.</label>
      </div></div>
      <div class="sec"><div class="secHead">Map</div><div class="secBody">
      <label class="note" style="display:block"><input type="checkbox" id="trShowC"${showC() ? ' checked' : ''}> Contours</label>${numIn('trCi', t.contour, 'Contour interval', 'ft', '1', '')}
      <label class="note" style="display:block"><input type="checkbox" id="trShowS"${showS() ? ' checked' : ''}> Slope colours: ${T.SLOPE_CLASSES.map(c => `<span class="sw" style="background:${c.col}"></span>${esc(c.label)}`).join(' ')}</label>
      <p class="note">The ground elevation under the cursor is shown in the coordinates box.</p></div></div>
      ${P.setups.map(u => { const l = u.lvl || {}; return `<div class="sec"><div class="secHead">${esc(u.name)}</div><div class="secBody" data-tu="${esc(u.id)}">
        ${numIn('trTol_' + u.id, l.tol, 'Level tolerance', '%', '1 (enter the crane manual\'s requirement)', ' data-f="tol"')}
        ${numIn('trBl_' + u.id, l.maxBlk == null ? null : l.maxBlk * 12, 'Blocking limit', 'in', '24 (assumed: the cribbing plan / manual)', ' data-f="maxBlk"')}
        ${numIn('trDt_' + u.id, l.datum, 'Levelling datum', 'ft', 'the highest support', ' data-f="datum"')}
        ${numIn('trPB_' + u.id, l.padB, 'Grading pad length (along the carrier)', 'ft', String(fmt(padDef(u).B, 1)), ' data-f="padB"')}
        ${numIn('trPW_' + u.id, l.padW, 'Grading pad width', 'ft', String(fmt(padDef(u).W, 1)), ' data-f="padW"')}
        ${numIn('trPE_' + u.id, l.padEl, 'Grading pad elevation', 'ft', 'the mean ground', ' data-f="padEl"')}
        <p class="note crLvlLive" data-lvl="${esc(u.id)}">${liveText(u)}</p></div></div>`; }).join('')}
      ${(P.routes || []).map(r => { const q = r.grade || {}; return `<div class="sec"><div class="secHead">Route: ${esc(r.name)}</div><div class="secBody" data-tr="${esc(r.id)}">
        ${numIn('trGm_' + r.id, q.max, 'Maximum grade', '%', String(T.DEF.maxGrade) + ' (assumed: enter the hauler\'s limit)', ' data-f="max"')}
        ${numIn('trGb_' + r.id, q.base, 'Grade base length', 'ft', String(T.DEF.base), ' data-f="base"')}
        ${numIn('trHu_' + r.id, q.hu, 'Load / deck underside above the ground at its supports', 'ft', 'deck height, blocking not added (−1 ft on a trailer deck)', ' data-f="hu"')}
        ${numIn('trCl_' + r.id, q.clr, 'Ground clearance margin', 'ft', String(T.DEF.clr), ' data-f="clr"')}</div></div>`; }).join('')}
      ${g ? '' : P.setups.length || (P.routes || []).length ? '<p class="note">Fetch terrain to see the levelness, pad grading and route profiles (Terrain output tab).</p>' : ''}`;
  }
  function padDef(u) {
    const c = craneOf(u), S = c && GR() ? GR().supports(c, u) : null, m = 4;
    if (S && S.ok && S.kind === 'crawler') return { B: S.Lt + m, W: S.g + S.s + m }; if (S && S.ok) return { B: S.xF + S.xR + S.f + m, W: 2 * S.b + S.f + m }; return { B: 30, W: 30 };
  }
  function liveText(u) { const r = levelOf(u); if (!r) return cur() ? 'Levelness: the crane\'s supports are not known.' : ''; if (!r.ok) return `<span class="lvb lvb-stop">${esc(r.text)}</span>`;
    return `<span class="lvb lvb-${r.status}">${esc(STATUS[r.status])}</span> s<sub>L</sub> ${fmt(r.sL, 2)} %, s<sub>T</sub> ${fmt(r.sT, 2)} %, s<sub>max</sub> ${fmt(r.sMax, 2)} % (tolerance ${fmt(r.tol, 2)} %); blocking ${r.pts.map(q => `${q.id} ${fmt(q.blk * 12, 1)}`).join(', ')} in (${esc(r.fromD)}) <a href="#" data-tgo="${esc(u.id)}">worked</a>`; }
  function onInChange(e) {
    const t = e.target, num = (signed) => { if (t.value.trim() === '') return null; const v = G.parseNum(t.value); if (!isFinite(v) || (!signed && v < 0)) { t.classList.add('bad'); return undefined; } t.classList.remove('bad'); return v; };
    if (t.id === 'trExt') return A.update(P => { P.terrain = Object.assign(M.normTerrain(P.terrain), { ext: t.value }); }, 'terrain');
    if (t.id === 'trSp') return A.update(P => { P.terrain = Object.assign(M.normTerrain(P.terrain), { spacing: +t.value }); }, 'terrain');
    if (t.id === 'trUse') { A.update(P => { P.terrain = Object.assign(M.normTerrain(P.terrain), { use: t.checked }); }, 'terrain'); return; }
    if (t.id === 'trCi') { const v = num(); if (v === undefined || v === 0) return; return A.update(P => { P.terrain = Object.assign(M.normTerrain(P.terrain), { contour: v || 1 }); }, 'terrain'); }
    if (t.id === 'trShowC') { A.ui.trC = t.checked; A.saveUi(); drawMap(); return; }
    if (t.id === 'trShowS') { A.ui.trS = t.checked; A.saveUi(); drawMap(); return; }
    const bu = t.closest('[data-tu]'), br = t.closest('[data-tr]'), f = t.dataset.f; if (!f) return;
    const v = num(f === 'datum' || f === 'padEl'); if (v === undefined) return;
    if (bu) { const u = A.P.setups.find(x => x.id === bu.dataset.tu); if (!u) return; A.update(() => { u.lvl = M.normLvl(Object.assign({}, u.lvl, { [f]: f === 'maxBlk' && v != null ? v / 12 : v })); }, 'terrain', { id: u.id }); return; }
    if (br) { const r = (A.P.routes || []).find(x => x.id === br.dataset.tr); if (!r) return; A.update(() => { r.grade = M.normGrade(Object.assign({}, r.grade, { [f]: v })); }, 'terrain', { id: r.id }); }
  }
  /* ---------- results ---------- */
  function padOf(u) { const g = cur(); if (!g) return null; const l = u.lvl || {}, d = padDef(u); return T.padGrade(g, u, { B: l.padB || d.B, W: l.padW || d.W, el: l.padEl }, 'tg.' + u.id); }
  const profMemo = new Map();
  function profileOf(r) {
    const g = cur(); if (!g || !RT()) return null; const key = JSON.stringify([PT().src.id, r, (A.P.tandems || []).find(t => t.id === r.tandemId) || null]);
    if (profMemo.has(key)) return profMemo.get(key); const p = T.profile(RT(), r, A.P, g, r.grade || {}, 'tp.' + r.id); if (profMemo.size > 30) profMemo.clear(); profMemo.set(key, p); return p;
  }
  function profSvg(p, r) {
    const W = 760, H = 230, l = 56, rt = 12, tp = 14, bt = 34, st = p.st.filter(q => isNum(q.z)); if (st.length < 2) return '';
    const c = p.clr, zs = st.map(q => q.z).concat(c.min != null ? [c.zR + p.hu, c.zH + p.hu] : []), z0 = Math.min(...zs) - 1, z1 = Math.max(...zs) + 1;
    const X = s => l + (W - l - rt) * s / p.L, Y = z => tp + (H - tp - bt) * (1 - (z - z0) / (z1 - z0));
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Arial" font-size="10" role="img" aria-label="${esc(r.name)} ground profile">`;
    const nT = 5; for (let k = 0; k <= nT; k++) { const z = z0 + (z1 - z0) * k / nT; s += `<line x1="${l}" x2="${W - rt}" y1="${Y(z).toFixed(1)}" y2="${Y(z).toFixed(1)}" stroke="#e2e8f0"/><text x="${l - 4}" y="${(Y(z) + 3).toFixed(1)}" text-anchor="end">${fmt(z, 1)}</text>`; }
    const sStep = p.L > 600 ? 100 : p.L > 250 ? 50 : 25; for (let sx = 0; sx <= p.L + 1e-9; sx += sStep) s += `<text x="${X(sx).toFixed(1)}" y="${H - bt + 14}" text-anchor="middle">${fmt(sx, 0)}</text>`;
    s += `<text x="${(W / 2).toFixed(0)}" y="${H - 6}" text-anchor="middle">station along the route (ft)</text><text transform="translate(12,${(H / 2).toFixed(0)}) rotate(-90)" text-anchor="middle">el. (ft, NAVD 88)</text>`;
    p.segs.filter(x => x.over).forEach(x => { s += `<rect x="${X(x.s0).toFixed(1)}" y="${tp}" width="${(X(x.s1) - X(x.s0)).toFixed(1)}" height="${H - tp - bt}" fill="#FEE2E2" opacity="0.6"/>`; });
    s += `<polyline fill="none" stroke="#78350F" stroke-width="1.8" points="${st.map(q => X(q.s).toFixed(1) + ',' + Y(q.z).toFixed(1)).join(' ')}"/>`;
    if (c.min != null) { const lo = c.sR - Math.max(p.V.r, 0), hi = c.sH + Math.max(p.V.f, 0), ln = sg => c.zR + p.hu + (c.zH - c.zR) * (sg - c.sR) / p.V.L2, col = c.min < 0 ? '#DC2626' : c.min < p.clrM ? '#D97706' : '#2563EB';
      s += `<line x1="${X(lo).toFixed(1)}" y1="${Y(ln(lo)).toFixed(1)}" x2="${X(hi).toFixed(1)}" y2="${Y(ln(hi)).toFixed(1)}" stroke="${col}" stroke-width="2.2"/>`;
      [c.sR, c.sH].forEach(sx => { s += `<line x1="${X(sx).toFixed(1)}" x2="${X(sx).toFixed(1)}" y1="${Y(ln(sx)).toFixed(1)}" y2="${Y(sx === c.sR ? c.zR : c.zH).toFixed(1)}" stroke="${col}" stroke-width="1.5"/>`; });
      s += `<circle cx="${X(c.sg).toFixed(1)}" cy="${Y(c.zg).toFixed(1)}" r="3.5" fill="${col}"/><text x="${X(c.sg).toFixed(1)}" y="${(Y(ln(c.sg)) - 6).toFixed(1)}" text-anchor="middle" fill="${col}">c_min ${fmt(c.min, 2)} ft</text>`; }
    p.crest.forEach(q => { s += `<text x="${X(q.s).toFixed(1)}" y="${(Y(q.z) - 8).toFixed(1)}" text-anchor="middle" fill="#7C2D12">▲ crest</text>`; });
    p.sag.forEach(q => { s += `<text x="${X(q.s).toFixed(1)}" y="${(Y(q.z) + 14).toFixed(1)}" text-anchor="middle" fill="#1E3A8A">▼ sag</text>`; });
    return s + `<rect x="${l}" y="${tp}" width="${W - l - rt}" height="${H - tp - bt}" fill="none" stroke="#94A3B8"/></svg>`;
  }
  const sx = l => window.CranePickSite.steps(l);
  const det = (id, title, html) => `<details class="crSteps" data-ts="${esc(id)}" id="${esc(id)}"${openSteps.has(id) ? ' open' : ''}><summary>${esc(title)}</summary>${html}</details>`;
  function setupHtml(u) {
    const r = levelOf(u), pg = padOf(u);
    if (!r) return `<div class="sec"><div class="secHead">${esc(u.name)}</div><div class="secBody"><p class="note">The crane or its supports are not known.</p></div></div>`;
    return `<div class="sec trSetup" id="trs-${esc(u.id)}"><div class="secHead">${esc(u.name)}</div><div class="secBody">
      ${r.ok ? `<p class="note"><span class="lvb lvb-${r.status}">${esc(STATUS[r.status])}</span> ${esc(r.text)}. <span class="chip chipW">${esc(LBL)}</span></p>
      <div class="tscroll"><table class="tbl trLvTbl"><thead><tr><th>${r.kind === 'crawler' ? 'Track end' : 'Float'}</th><th>E (ft)</th><th>N (ft)</th><th>Ground el. (ft)</th><th>Blocking (ft)</th><th>Blocking (in)</th></tr></thead><tbody>
        ${r.pts.map(q => `<tr><td>${q.id} (${esc(q.name)})</td><td class="n">${fmt(q.x, 2)}</td><td class="n">${fmt(q.y, 2)}</td><td class="n">${fmt(q.z, 2)}</td><td class="n${q.blk > r.maxBlk || q.blk < -1e-9 ? ' ng' : ''}">${fmt(q.blk, 2)}</td><td class="n">${fmt(q.blk * 12, 1)}</td></tr>`).join('')}</tbody></table></div>
      <div class="kv"><div><span>s<sub>L</sub> longitudinal</span><span>${fmt(r.sL, 2)} %</span></div><div><span>s<sub>T</sub> transverse</span><span>${fmt(r.sT, 2)} %</span></div><div><span>s<sub>max</sub></span><span>${fmt(r.sMax, 2)} % (tolerance ${fmt(r.tol, 2)} %)</span></div>
        <div><span>Levelling datum</span><span>${fmt(r.datum, 2)} ft (${esc(r.fromD)})</span></div><div><span>Blocking limit</span><span>${fmt(r.maxBlk * 12, 1)} in</span></div><div><span>Twist ±</span><span>${fmt(r.tw, 2)} ft</span></div></div>
      ${PT().use && u.pad == null ? `<p class="note">Crane pad elevation used for the heights (Lifts, §Elevations): ${fmt(r.datum, 2)} ft (the levelling datum; cribbing at the highest support not added). Stress at depth (Ground): the lowest support ground ${fmt(r.zLo, 2)} ft.</p>` : ''}
      ${det('trl-' + u.id, 'Worked steps: levelness and blocking', sx(r.steps))}` : `<p class="note warnT">${esc(r.text)}</p>`}
      ${pg && pg.n ? `<h4 class="stH">Pad grading (level pad ${fmt(pg.B, 1)} × ${fmt(pg.W, 1)} ft at el. ${fmt(pg.el, 2)} ft)</h4><div class="kv"><div><span>Cut</span><span>${fmt(pg.cutCy, 1)} cy (${fmt(pg.cut, 0)} ft³)</span></div><div><span>Fill</span><span>${fmt(pg.fillCy, 1)} cy (${fmt(pg.fill, 0)} ft³)</span></div><div><span>Mean existing ground</span><span>${fmt(pg.mean, 2)} ft</span></div></div>
        ${pg.miss ? `<p class="note warnT">${pg.miss} pad cells outside the terrain grid were left out.</p>` : ''}${det('trp-' + u.id, 'Worked steps: pad grading', sx(pg.steps))}` : ''}
      </div></div>`;
  }
  function routeHtml(r) {
    const p = profileOf(r); if (!p) return '';
    if (!p.ok) return `<div class="sec"><div class="secHead">Route: ${esc(r.name)}</div><div class="secBody"><p class="note warnT">${esc(p.why)}</p></div></div>`;
    return `<div class="sec trRoute" id="trr-${esc(r.id)}"><div class="secHead">Route: ${esc(r.name)} — ground profile</div><div class="secBody">
      <p class="note"><span class="chip chipW">${esc(LBL)}</span> Profile along the steer-axle path (${fmt(p.L, 1)} ft, every ${fmt(p.ds, 2)} ft); grade over ${fmt(p.base, 0)} ft; maximum grade ${fmt(p.maxG, 2)} %.</p>
      <div class="tscroll trProf">${profSvg(p, r)}</div>
      <div class="tscroll"><table class="tbl"><thead><tr><th>Segment</th><th>Sta. (ft)</th><th>Max grade (%)</th><th>at sta.</th><th></th></tr></thead><tbody>
        ${p.segs.map(x => `<tr><td>${x.type === 'arc' ? 'curve' : 'tangent'} ${x.i}</td><td class="n">${fmt(x.s0, 0)}–${fmt(x.s1, 0)}</td><td class="n${x.over ? ' ng' : ''}">${fmt(x.g, 2)}</td><td class="n">${fmt(x.at, 0)}</td><td>${x.over ? 'over the maximum' : ''}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">Crests: ${p.crest.length ? p.crest.map(q => `sta. ${fmt(q.s, 0)} (el. ${fmt(q.z, 2)}, ${fmt(q.gIn, 2)} % → ${fmt(q.gOut, 2)} %)`).join('; ') : 'none'}. Sags: ${p.sag.length ? p.sag.map(q => `sta. ${fmt(q.s, 0)} (el. ${fmt(q.z, 2)}, ${fmt(q.gIn, 2)} % → ${fmt(q.gOut, 2)} %)`).join('; ') : 'none'}.</p>
      <p class="note">Long-load ground clearance: ${p.clr.min == null ? 'not computed (terrain missing)' : `least ${fmt(p.clr.min, 2)} ft (${esc(p.clr.where)}, sta. ${fmt(p.clr.sg, 1)}) vs margin ${fmt(p.clrM, 2)} ft; h<sub>u</sub> ${fmt(p.hu, 2)} ft (${esc(p.huFrom)})`}.</p>
      ${p.flags.length ? `<ul class="lfFlags">${p.flags.map(f => `<li class="lf-${f.level}">${esc(f.text)}</li>`).join('')}</ul>` : ''}
      ${det('trq-' + r.id, 'Worked steps: grade and clearance', sx(p.steps))}</div></div>`;
  }
  function drawOut() {
    if (!outEl) return; dirty = false; const P = A.P, g = cur();
    const head = `<div class="sec"><div class="secHead">Terrain</div><div class="secBody"><p class="note"><span class="chip chipW">${esc(LBL)}</span> ${esc(T.CERT)} Vertical datum ${esc(T.DATUM)}. <a href="#" data-tgo="in">Terrain inputs</a> · <a href="#" data-tgo="rpt">Report §Terrain</a></p>
      ${g ? '' : `<p class="note warnT">${PT().src ? esc(lastErr || 'The terrain is loading from this browser\'s cache…') : 'No terrain fetched: Terrain input tab, "Fetch terrain for this site".'}</p>`}</div></div>`;
    outEl.innerHTML = head + (g ? P.setups.map(setupHtml).join('') + (P.routes || []).map(routeHtml).join('') : '');
  }
  /* ---------- Report ---------- */
  window.CranePickReport && window.CranePickReport.add(P => {
    const s = PT().src; if (!s) return [];
    const g = cur(), subs = [{ id: 'basis', key: 'terrain-basis', title: 'Basis', items: [{ type: 'note', warn: true, text: T.CERT + ' Every terrain value in this report is ' + LBL + '.' },
      { type: 'kv', rows: [['Source', `USGS The National Map, 3D Elevation Program (3DEP) — ${s.svc || 'ImageServer getSamples'}; fetched ${s.at.replace('T', ' ').slice(0, 16)} UTC`], ['Grid', `${s.nx} × ${s.ny} = ${s.n} points at ${fmt(s.dx, 2)} ft (site frame); ${s.nodata} without data; native resolution ${s.res ? fmt(s.res, 2) + ' m' : 'not reported'}`],
        ['Vertical datum', T.DATUM + '; 1 m = 3937/1200 ftUS. With "use terrain" on, the crane pad, pick and set ground elevations not entered are in this datum.'], ['Use terrain for ground elevations', PT().use ? 'on (entered values override)' : 'off'],
        ['Surface', 'bilinear interpolation in the grid cell: z = (1 − t)(1 − u)z00 + t(1 − u)z10 + (1 − t)u z01 + t u z11'],
        ['Levelness', 'ground under each float (track ends for crawlers); s_L = 100 [(front pair mean) − (rear pair mean)] / (x_F + x_R or L_t); s_T = 100 [(left mean) − (right mean)] / 2b; s_max = √(s_L² + s_T²) (the least-squares plane through the four points) vs the level tolerance (the crane manual\'s value, entered; default 1 %); blocking b_i = z_datum − z_i, the datum the highest support unless chosen; badge green s_max ≤ tolerance, amber above it, red when a blocking exceeds the limit (default 24 in, assumed) or terrain is missing'],
        ['Pad grading', 'grid method: the ground at each cell centre of the pad (cells ≤ the terrain spacing and ≤ 1/10 of the pad side); V_fill = Σ a·max(z_pad − z_i, 0), V_cut = Σ a·max(z_i − z_pad, 0); bank volumes, no shrink / swell, side slopes not included'],
        ['Route grades', 'the ground profile along the steer-axle path; grade = Δz over the base length ℓ_g (default 20 ft) centred on each station; crests / sags at the grade breaks: A = g(s + ℓ_g/2) − g(s − ℓ_g/2), |A| ≥ 2 % (crest A < 0, sag A > 0), at the largest |A| of each run'],
        ['Long-load clearance', 'the load / deck underside is a straight line h_u above the ground at its two supports (kingpin or jeep bolster, and the rear axle group / dolly), extended over the front and rear overhangs; at every position along the profile, clearance = line − ground over crests between the supports and at the overhang ends over sags; off-tracking and suspension travel not included']] }] }];
    if (!g) subs.push({ id: 'miss', title: 'Terrain not available', items: [{ type: 'note', warn: true, text: 'The terrain grid is not in this browser\'s cache: no terrain results. Fetch it again (Terrain tab).' }] });
    else {
      P.setups.forEach(u => { const r = levelOf(u), pg = padOf(u); if (!r) return; const items = [];
        if (!r.ok) items.push({ type: 'note', warn: true, text: r.text });
        else { items.push({ type: 'note', warn: r.status !== 'ok', text: `Levelness (${LBL}): ${r.text}. Lift results: §Lifts; crane: §Cranes.` });
          items.push({ type: 'table', head: [r.kind === 'crawler' ? 'Track end' : 'Float', 'E (ft)', 'N (ft)', 'Ground el. (ft)', 'Blocking (ft)', 'Blocking (in)'], rows: r.pts.map(q => [q.id + ' (' + q.name + ')', { t: fmt(q.x, 2), n: true }, { t: fmt(q.y, 2), n: true }, { t: fmt(q.z, 2), n: true }, { t: fmt(q.blk, 2), n: true, cls: q.blk > r.maxBlk ? 'ng' : '' }, { t: fmt(q.blk * 12, 1), n: true }]) });
          items.push({ type: 'kv', rows: [['s_L / s_T / s_max', `${fmt(r.sL, 2)} / ${fmt(r.sT, 2)} / ${fmt(r.sMax, 2)} %`], ['Level tolerance', fmt(r.tol, 2) + ' % (the crane manual\'s requirement, entered)'], ['Levelling datum', `${fmt(r.datum, 2)} ft (${r.fromD})`], ['Blocking limit', fmt(r.maxBlk * 12, 1) + ' in']] });
          items.push({ type: 'steps', scope: 'trs-' + u.id, title: 'Levelness and blocking', steps: r.steps }); }
        if (pg && pg.n) { items.push({ type: 'kv', rows: [['Pad', `${fmt(pg.B, 1)} × ${fmt(pg.W, 1)} ft at el. ${fmt(pg.el, 2)} ft (${pg.from})`], ['Cut / fill', `${fmt(pg.cutCy, 1)} / ${fmt(pg.fillCy, 1)} cy`]] }); items.push({ type: 'steps', scope: 'trs-' + u.id, title: 'Pad grading', steps: pg.steps }); }
        subs.push({ id: 'u-' + u.id, key: 'trs-' + u.id, title: u.name, ref: r.ok ? STATUS[r.status] : '', items }); });
      (P.routes || []).forEach(r => { const p = profileOf(r); if (!p || !p.ok) return; const items = [{ type: 'figure', svg: profSvg(p, r), caption: `${r.name}: ground profile (${LBL}), the load / deck underside at the governing position, crests / sags; segments over the maximum grade shaded.` },
        { type: 'table', head: ['Segment', 'Sta. (ft)', 'Max grade (%)', 'at sta. (ft)'], rows: p.segs.map(x => [(x.type === 'arc' ? 'curve ' : 'tangent ') + x.i, fmt(x.s0, 0) + '–' + fmt(x.s1, 0), { t: fmt(x.g, 2), n: true, cls: x.over ? 'ng' : '' }, { t: fmt(x.at, 0), n: true }]) },
        { type: 'kv', rows: [['Crests', p.crest.map(q => `sta. ${fmt(q.s, 0)} (el. ${fmt(q.z, 2)})`).join('; ') || 'none'], ['Sags', p.sag.map(q => `sta. ${fmt(q.s, 0)} (el. ${fmt(q.z, 2)})`).join('; ') || 'none'], ['Least ground clearance', p.clr.min == null ? 'not computed' : `${fmt(p.clr.min, 2)} ft (${p.clr.where}, sta. ${fmt(p.clr.sg, 1)}); margin ${fmt(p.clrM, 2)} ft; h_u ${fmt(p.hu, 2)} ft (${p.huFrom})`]] }];
        if (p.flags.length) items.push({ type: 'note', warn: true, text: p.flags.map(f => f.text).join(' ') });
        items.push({ type: 'steps', scope: 'trr-' + r.id, title: 'Grade and clearance', steps: p.steps }); subs.push({ id: 'r-' + r.id, key: 'trr-' + r.id, title: 'Route: ' + r.name, items }); });
    }
    return [{ id: 'terrain', key: 'terrain', title: 'Terrain', subs }];
  });
  function gotoReport(id) { A.showOTab('rpt'); const j = () => { const v = window.CranePickReportUI && window.CranePickReportUI.view; if (v && v.jump) v.jump(id || 'terrain'); }; setTimeout(j, 60); setTimeout(j, 160); setTimeout(j, 420); }
  /* ---------- wiring ---------- */
  function onClick(e) {
    if (e.target.id === 'trFetch') { fetchTerrain(); return; }
    const a = e.target.closest('[data-tgo]'); if (!a) return; e.preventDefault(); const v = a.dataset.tgo;
    if (v === 'in') A.showITab('terrain'); else if (v === 'rpt') gotoReport(); else { A.showOTab('terrain'); openSteps.add('trl-' + v); drawOut(); const d = document.getElementById('trl-' + v); if (d) d.scrollIntoView({ block: 'nearest' }); }
  }
  A.inTab({ id: 'terrain', label: 'Terrain', build: p => { inEl = p; p.addEventListener('change', onInChange); p.addEventListener('click', onClick); }, show: () => { ensure(); drawIn(); } });
  A.outTab({ id: 'terrain', label: 'Terrain', before: 'site', build: p => { outEl = p; p.addEventListener('click', onClick); p.addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.ts) { if (d.open) openSteps.add(d.dataset.ts); else openSteps.delete(d.dataset.ts); } }, true); }, show: () => { ensure(); if (dirty) drawOut(); } });
  const mark = () => { dirty = true; if (A.ui.otab === 'terrain') drawOut(); };
  let mapKey = '';
  function refreshMap() { const k = JSON.stringify([PT().src && PT().src.id, !!cur(), PT().contour, showC(), showS(), A.P.site.zone]); if (k !== mapKey) { mapKey = k; drawMap(); } badges(); }
  A.on('project', () => { lvlMemo.clear(); profMemo.clear(); ensure(); wire(); mark(); setTimeout(refreshMap, 0); if (A.ui.itab === 'terrain') drawIn(); });
  A.on('change', o => { if (o.kind === 'select' || o.kind === 'select-lift') return; wire(); mark(); setTimeout(refreshMap, 0); if (A.ui.itab === 'terrain' && (o.kind !== 'terrain' || !o.id)) drawIn(); else if (A.ui.itab === 'terrain') A.P.setups.forEach(u => { const e = inEl.querySelector(`[data-lvl="${u.id}"]`); if (e) e.innerHTML = liveText(u); }); });
  A.on('live', o => { if (!o || o.kind !== 'lifts') return; dirty = true; const fr = MP() && MP().raf; const run = () => { A.P.setups.forEach(badge); if (A.ui.itab === 'terrain' && inEl) A.P.setups.forEach(u => { const e = inEl.querySelector(`[data-lvl="${u.id}"]`); if (e) e.innerHTML = liveText(u); }); if (A.ui.otab === 'terrain') drawOut(); }; if (fr) fr('terrainLive', run); else run(); });
  A.on('tab', id => { if (id === 'plan') setTimeout(refreshMap, 0); });
  A.on('ready', () => { if (MP()) MP().coordExtra = coordHtml; });
  window.CranePickTerrainUI = { levelOf, padOf, profileOf, fetchTerrain, get grid() { return cur(); }, grids, redraw: mark, drawMap, badges, coordHtml, gotoReport, profSvg, STATUS, get layers() { return layers; }, _setGrid: (id, g) => { grids.set(id, g); changed(); } };
})();
