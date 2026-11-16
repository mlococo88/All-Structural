/* apps/crane-pick/ui/route.js — the trucking route in the app (window.CranePickRouteUI). C6 (2026-11-16).
   Route input tab: routes drawn on the map (the steer-axle path, site entrance or last public road to the truck stop), their curve radii,
   the vehicle (tractor + semi / stretch trailer / steerable rear dolly / jeep + dolly), the load on it, axle loads (statics or entered),
   the tyre contact area, the pick it delivers to; route marks: overhead clearances (point or line), haul roads / mats, posted bridges.
   Map (Plan tab): each route's drawn line, its path with the curves, the swept path (union of the outlines every 2 ft), the load's
   corner traces, the vehicle at the chosen position (default: the truck stop), turn labels (off-tracking) and conflict markers; the
   selected route's vertices drag (live: the swept path and the flags follow every frame; one undo step per drag), "+" adds a vertex, a
   double-click removes one. Route output tab: per route the turns, conflicts, overhead clearances, axle loads, haul road, posted
   bridges, staging and every flag, with the worked steps (CLAUDE.md §6). Report §Route. Values: engine/route.js. */
(function () {
  'use strict';
  const A = window.CranePickApp, G = window.CranePickGeo, M = window.CranePickModel, RT = window.CranePickRoute, LF = window.CranePickLift, esc = A.esc;
  const MP = () => window.CranePickMap, L_ = () => window.L;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const fmt = (v, d) => isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const COL = { path: '#1D4ED8', swept: '#2563EB', load: '#7C3AED', overhead: '#B45309', haul: '#78716C', bridge: '#0E7490', stop: '#DC2626', warn: '#D97706', info: '#64748B' };
  let inEl = null, outEl = null, selR = null, selM = null, drawing = null, ghost = null, dragEnd = 0, outDirty = true;
  const layers = new Map();   // route id -> layer set;  mark id -> layer set (key 'm:' + id)
  let handles = [];
  const routeOf = id => (A.P.routes || []).find(r => r.id === id) || null;
  const markOf = id => (A.P.routeMarks || []).find(m => m.id === id) || null;
  /* ---------- evaluation (memoized for an unchanged state) ---------- */
  const memo = new Map();
  function evalRoute(r, live) {
    const P = A.P, key = JSON.stringify([r, P.items, P.routeMarks, P.picks, P.setups, (P.cranes || []).map(c => c.id + c.fp), P.lift, !!live]);
    if (memo.has(key)) return memo.get(key);
    const ev = RT.evaluate(r, P, 'rt' + ((P.routes || []).indexOf(r) + 1), live ? { step: 1 } : null);
    if (memo.size > 24) memo.clear(); memo.set(key, ev); return ev;
  }
  /* ---------- map layers ---------- */
  const lls = pts => pts.map(p => MP().toLL(p));
  function pathPts(sim) { return sim.dense.filter(q => q.s >= 0); }
  function vehAt(r, ev) {
    const sim = ev.sim; if (!sim.ok || !sim.samples.length) return null;
    const s = isNum(r.at) ? Math.min(r.at, sim.pa.L) : sim.pa.L; let best = sim.samples[sim.samples.length - 1];
    for (const q of sim.samples) { if (q.s >= s - 1e-9) { best = q; break; } } return best;
  }
  function removeLayer(key) { const g = layers.get(key); if (!g) return; g.all.forEach(x => x.remove()); layers.delete(key); }
  function drawRoute(r, live) {
    const m = MP() && MP().map; if (!m) return;
    removeLayer(r.id);
    const Lf = L_(), ev = evalRoute(r, live), on = r.id === selR, all = [];
    const add = x => { x.addTo(m); all.push(x); return x; };
    add(Lf.polyline(lls(r.pts), { color: COL.path, weight: on ? 2 : 1.5, dashArray: '4 6', opacity: 0.8, interactive: false }));
    if (ev.sim.ok) {
      const sw = RT.swept(ev.sim, live ? 3 : 2);
      add(Lf.polygon(sw.rings.map(lls), { stroke: false, fillColor: ev.worst === 'stop' ? COL.stop : COL.swept, fillOpacity: 0.18, fillRule: 'nonzero', interactive: false, className: 'crRtSwept' }));
      ['load0', 'load1', 'load2', 'load3'].forEach(k => { if (sw.traces[k]) add(Lf.polyline(lls(sw.traces[k]), { color: COL.load, weight: 1, opacity: 0.7, interactive: false })); });
      const pl = add(Lf.polyline(lls(pathPts(ev.sim)), { color: COL.path, weight: on ? 4 : 3, opacity: 0.9, className: 'crRtPath', bubblingMouseEvents: false }));
      pl.on('click', e => { if (MP().tool) return; Lf.DomEvent.stop(e); select(r.id); });
      pl.bindTooltip(`${esc(r.name)} · ${fmt(ev.sim.pa.L, 0)} ft · max off-tracking ${fmt(ev.otMax, 1)} ft`, { sticky: true, className: 'crName' });
      const q = vehAt(r, ev); if (q) q.parts.forEach(pp => add(Lf.polygon(lls(pp.poly), { color: pp.part === 'load' ? COL.load : '#0F172A', weight: 1.5, fillColor: pp.part === 'load' ? COL.load : '#fff', fillOpacity: pp.part === 'load' ? 0.35 : 0.6, interactive: false })));
      ev.turns.forEach(t => { const mid = RT.at(ev.sim.pa, (t.s0 + t.s1) / 2); const cls = t.flags.some(f => f.level === 'stop') ? 'stop' : t.flags.length ? 'warn' : 'ok';
        add(Lf.marker(MP().toLL(mid), { icon: Lf.divIcon({ className: 'crRtLbl', html: `<span class="rt-${cls}">T${t.n} r ${fmt(t.r, 0)} · OT ${fmt(t.ot, 1)} ft</span>`, iconSize: null, iconAnchor: [0, 0] }), interactive: false, keyboard: false })); });
      ev.flags.filter(f => isNum(f.s) && f.level !== 'info').forEach(f => { const p = RT.at(ev.sim.pa, f.s);
        add(Lf.marker(MP().toLL(p), { icon: Lf.divIcon({ className: 'crC3 crC3-' + f.level, html: '<span>!</span>', iconSize: [18, 18], iconAnchor: [9, 9] }), keyboard: false, title: f.text })); });
      if (ev.stage && ev.stage.cg) add(Lf.circleMarker(MP().toLL(ev.stage.cg), { radius: 5, color: COL.load, weight: 2, fillColor: '#fff', fillOpacity: 1, interactive: false }));
    }
    layers.set(r.id, { all, ev });
  }
  function drawMark(mk) {
    const m = MP() && MP().map; if (!m) return; removeLayer('m:' + mk.id);
    const Lf = L_(), all = [], c = COL[mk.type], on = mk.id === selM, add = x => { x.addTo(m); all.push(x); return x; };
    let main;
    if (mk.pts.length === 1) { const rr = isNum(mk.w) && mk.w > 0 ? mk.w : 2; main = add(Lf.circle(MP().toLL(mk.pts[0]), { radius: rr * 1200 / 3937, color: c, weight: on ? 3 : 2, fillOpacity: 0.3, bubblingMouseEvents: false })); }
    else { if (mk.type !== 'overhead') { const w = isNum(mk.w) && mk.w > 0 ? mk.w : mk.type === 'haul' ? 20 : 30; add(Lf.polygon(G.bufferRings(mk.pts, w / 2, 24).map(lls), { stroke: false, fillColor: c, fillOpacity: mk.type === 'haul' ? 0.22 : 0.14, fillRule: 'nonzero', interactive: false })); }
      main = add(Lf.polyline(lls(mk.pts), { color: c, weight: on ? 4 : 3, dashArray: mk.type === 'overhead' ? '2 5' : null, bubblingMouseEvents: false })); }
    const tip = mk.type === 'overhead' ? `${esc(mk.name)} · ${isNum(mk.h) ? fmt(mk.h, 2) + ' ft clear' : 'height not entered'}` : mk.type === 'bridge' ? `${esc(mk.name)} · ${postText(mk)}` : `${esc(mk.name)} · ${isNum(mk.qa) ? fmt(mk.qa, 0) + ' psf allowable' : 'allowable not entered'}`;
    main.bindTooltip(tip, { permanent: true, direction: 'center', className: 'crName', interactive: false });
    main.on('click', e => { if (MP().tool) return; L_().DomEvent.stop(e); selectMark(mk.id); });
    layers.set('m:' + mk.id, { all });
  }
  const postText = mk => { const p = mk.post || {}; const a = []; if (isNum(p.gross)) a.push(`${fmt(p.gross, 1)} t gross`); if (isNum(p.axle)) a.push(`${fmt(p.axle, 1)} t per axle`); if (isNum(p.tTons)) a.push(`${fmt(p.tTons, 1)} t ${p.tLabel || 'type'}`); return a.length ? a.join(', ') : 'posting not entered'; };
  function renderAll() {
    if (!MP() || !MP().map) return;
    [...layers.keys()].forEach(removeLayer);
    (A.P.routeMarks || []).forEach(drawMark); (A.P.routes || []).forEach(r => drawRoute(r));
    drawHandles();
  }
  /* ---------- handles: the selected route's or mark's vertices ---------- */
  const vIcon = cls => L_().divIcon({ className: 'crVx ' + cls, html: '<span></span>', iconSize: [14, 14], iconAnchor: [7, 7] });
  function clearHandles() { handles.forEach(h => h.remove()); handles = []; }
  function drawHandles() {
    clearHandles(); const m = MP() && MP().map; if (!m || drawing) return;
    const r = routeOf(selR), mk = markOf(selM), obj = r || mk; if (!obj) return;
    const Lf = L_(), min = r ? 2 : mk.type === 'overhead' ? 1 : 2;
    const redraw = live => { if (r) { drawRoute(r, live); liveTab(r, live); } else drawMark(mk); };
    obj.pts.forEach((p, i) => {
      const h = Lf.marker(MP().toLL(p), { icon: vIcon('crVxP crRtVx'), draggable: true, keyboard: false, zIndexOffset: 900, title: 'Drag to move this point; double-click to remove it' }).addTo(m);
      h.on('drag', () => { obj.pts[i] = MP().toFt(h.getLatLng()); MP().raf('route', () => { redraw(true); A.live('route', { id: obj.id }); }); });
      h.on('dragend', () => { dragEnd = Date.now(); A.update(null, 'route', { id: obj.id }); });
      h.on('dblclick', e => { L_().DomEvent.stop(e); if (obj.pts.length > min) A.update(() => { obj.pts.splice(i, 1); if (r) r.rad.splice(i, 1); }, 'route', { id: obj.id }); });
      h._crI = i; handles.push(h);
    });
    for (let i = 0; i < obj.pts.length - 1; i++) {
      const a = obj.pts[i], b = obj.pts[i + 1];
      const h = Lf.marker(MP().toLL({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }), { icon: vIcon('crVxM'), draggable: true, keyboard: false, zIndexOffset: 800, title: 'Drag to add a point here' }).addTo(m);
      let k = -1;
      h.on('dragstart', () => { k = i + 1; obj.pts.splice(k, 0, MP().toFt(h.getLatLng())); if (r) r.rad.splice(k, 0, null); });
      h.on('drag', () => { obj.pts[k] = MP().toFt(h.getLatLng()); MP().raf('route', () => { redraw(true); A.live('route', { id: obj.id }); }); });
      h.on('dragend', () => { dragEnd = Date.now(); A.update(null, 'route', { id: obj.id }); });
      handles.push(h);
    }
  }
  /* ---------- drawing a route or a mark ---------- */
  const TOOLS = { route: { label: 'Route', min: 2, tip: 'click the points from the site entrance (or the last public road) to the truck stop; double-click, Enter or Finish ends it' },
    ohPt: { label: 'Overhead clearance (point)', min: 1, max: 1, type: 'overhead', tip: 'click the sign, beam end or other overhead point' },
    ohLn: { label: 'Overhead clearance (line)', min: 2, type: 'overhead', tip: 'click along the overpass edge, sign gantry or wire' },
    haul: { label: 'Haul road / mats', min: 2, type: 'haul', tip: 'click along the haul road or mat run (its width is entered after)' },
    bridge: { label: 'Posted bridge', min: 2, type: 'bridge', tip: 'click along the bridge deck where the route crosses it' } };
  function setTool(k) {
    cancel(true); const t = TOOLS[k]; if (!t || !MP() || !MP().map) return;
    selR = null; selM = null; clearHandles();
    const tool = { cursor: 'crosshair', click: f => addPt(f), move: f => { if (drawing) { drawing.cur = f; ghostDraw(); } }, dbl: () => finish(), key: e => { if (e.key === 'Escape') { e.preventDefault(); cancel(); } else if (e.key === 'Enter') { e.preventDefault(); finish(); } else if (e.key === 'Backspace') { e.preventDefault(); drawing.pts.pop(); ghostDraw(); } }, end: () => { if (MP().tool === tool) cancel(true); } };
    MP().setTool(tool); drawing = { k, t, pts: [] }; A.showOTab('plan'); status(); drawTab();
  }
  function status() { if (!drawing) { MP().status(''); return; } MP().status(`<b>${esc(drawing.t.label)}:</b> ${esc(drawing.t.tip)}. Esc cancels. <button type="button" class="primary" data-rtb="finish">Finish</button><button type="button" data-rtb="cancel">Cancel</button>`); }
  function addPt(f) { if (!drawing) return; const l = drawing.pts[drawing.pts.length - 1]; if (l && Math.hypot(l.x - f.x, l.y - f.y) < 1e-6) return; drawing.pts.push(f); if (drawing.t.max && drawing.pts.length >= drawing.t.max) { finish(); return; } ghostDraw(); }
  function ghostDraw() {
    if (!drawing) return; const m = MP().map, Lf = L_(), pts = drawing.pts.slice(); if (drawing.cur) pts.push(drawing.cur);
    if (ghost) { ghost.remove(); ghost = null; } if (!pts.length) return;
    ghost = Lf.layerGroup().addTo(m); Lf.polyline(lls(pts), { color: COL.path, weight: 2, dashArray: '5 4', interactive: false }).addTo(ghost);
    drawing.pts.forEach(p => Lf.circleMarker(MP().toLL(p), { radius: 4, color: COL.path, fillColor: '#fff', fillOpacity: 1, weight: 2, interactive: false }).addTo(ghost));
  }
  function cancel(quiet) { if (ghost) { ghost.remove(); ghost = null; } const was = !!drawing; drawing = null; if (!quiet && MP()) MP().setTool(null); if (MP() && was) MP().status(''); if (was) drawTab(); }
  function finish() {
    if (!drawing) return; const d = drawing, pts = d.pts.slice();
    if (pts.length < d.t.min) { MP().status(`<b>${esc(d.t.label)}:</b> ${d.t.min} point${d.t.min > 1 ? 's are' : ' is'} needed. <button type="button" data-rtb="cancel">Cancel</button>`); return; }
    drawing = null; if (ghost) { ghost.remove(); ghost = null; } MP().setTool(null); MP().status('');
    if (d.k === 'route') {
      const prev = (A.P.routes || [])[A.P.routes.length - 1], n = (A.P.routes || []).length + 1;
      const r = M.normRoute(Object.assign({ name: `Route ${n}`, pts }, prev ? { veh: prev.veh, load: prev.load, tyre: prev.tyre, pickId: prev.pickId, rDef: prev.rDef } : { pickId: (A.P.picks[0] || {}).id || '' }));
      r.rad = pts.map(() => null);
      A.update(P => { P.routes.push(r); }, 'route', { id: r.id }); select(r.id);
    } else {
      const n = (A.P.routeMarks || []).filter(x => x.type === d.t.type).length + 1;
      const mk = M.normRouteMark({ type: d.t.type, name: `${M.MARK_TYPES[d.t.type]} ${n}`, pts });
      A.update(P => { P.routeMarks.push(mk); }, 'route', { id: mk.id }); selectMark(mk.id);
    }
  }
  function select(id) { selR = routeOf(id) ? id : null; selM = null; renderAll(); A.showITab('route'); drawTab(); }
  function selectMark(id) { selM = markOf(id) ? id : null; selR = null; renderAll(); A.showITab('route'); drawTab(); }
  /* ---------- the Route input tab ---------- */
  const numIn = (id, v, lbl, unit, hint) => `<div class="fRow"><label for="${id}">${lbl}</label><input type="text" inputmode="decimal" id="${id}" value="${v == null ? '' : v}" placeholder="${hint == null ? '' : hint}"><span class="unit">${unit}</span></div>`;
  const VFIELDS = [
    ['L1', 'Tractor wheelbase (steer axle to drive-group centre)', 'ft'], ['e', 'Kingpin ahead of the drive-group centre (+)', 'ft'], ['fo', 'Tractor front overhang (ahead of the steer axle)', 'ft'], ['ro', 'Tractor rear overhang (behind the drive group)', 'ft'], ['Wt', 'Tractor width', 'ft'],
    ['L2', 'Body wheelbase: kingpin (jeep bolster) to the rear group / dolly pivot', 'ft'], ['Wb', 'Trailer / dolly width', 'ft'], ['dF', 'Deck ahead of the kingpin', 'ft', 'semi'], ['dR', 'Deck behind the rear group', 'ft', 'semi'],
    ['Lj', 'Jeep: kingpin to its axle-group centre', 'ft', 'jeep'], ['ej', 'Jeep bolster ahead of its axle group (+)', 'ft', 'jeep'], ['Ld', 'Rear dolly length (drawn)', 'ft', 'dolly'], ['k', 'Rear dolly effective steering ratio k (δ = −k γ)', '0–1', 'dolly'], ['dmax', 'Rear dolly largest steer angle', 'deg', 'dolly'],
    ['Rmin', 'Minimum turning radius (steer-axle centre)', 'ft'], ['hDeck', 'Deck / bolster height above the road', 'ft']];
  const WFIELDS = [['Wtr', 'Tractor tare weight', 'lb'], ['xt', 'Tractor CG behind the steer axle', 'ft'], ['Wtl', 'Trailer tare weight', 'lb', 'semi'], ['xtl', 'Trailer CG behind the kingpin', 'ft', 'semi'], ['Wj', 'Jeep tare (at its axles)', 'lb', 'jeep'], ['Wd', 'Rear dolly tare (at its pivot)', 'lb', 'dolly'],
    ['nS', 'Steer axles', 'no.'], ['tS', 'Tyres per steer axle', 'no.'], ['nD', 'Drive axles', 'no.'], ['tD', 'Tyres per drive axle', 'no.'], ['nJ', 'Jeep axles', 'no.', 'jeep'], ['tJ', 'Tyres per jeep axle', 'no.', 'jeep'], ['nR', 'Rear group / dolly axles', 'no.'], ['tR', 'Tyres per rear axle', 'no.']];
  const LFIELDS = [['L', 'Load length', 'ft'], ['W', 'Load weight', 'lb'], ['B', 'Load width', 'ft'], ['r', 'Rear overhang behind the rear group / dolly pivot', 'ft'], ['cg', 'Load CG from its front end', 'ft', null, 'L / 2'], ['h', 'Load height above the deck', 'ft']];
  const showF = (v, f) => !f[3] || (f[3] === 'semi' ? !RT.steered(v) : f[3] === 'dolly' ? RT.steered(v) : RT.hasJeep(v));
  function liveBox(r, ev) {
    if (!ev.sim.ok) return `<div class="crOut bad" id="rtLive">${esc(ev.flags[0] ? ev.flags[0].text : 'not computed')}</div>`;
    const n = { stop: 0, warn: 0, info: 0 }; ev.flags.forEach(f => { n[f.level]++; });
    return `<div class="crOut${n.stop ? ' bad' : ''}" id="rtLive"><b>${fmt(ev.sim.pa.L, 0)} ft</b> · ${ev.turns.length} turn${ev.turns.length === 1 ? '' : 's'} · max off-tracking <b>${fmt(ev.otMax, 2)} ft</b> · gross ${fmt(ev.ax.gross, 0)} lb (${fmt(ev.ax.gross / RT.LB_PER_TON, 1)} t) · load top ${fmt(ev.oh.Htop, 2)} ft<br>
      <span class="lfDot lf-stop">●</span>${n.stop} stop <span class="lfDot lf-warn">●</span>${n.warn} warn <span class="lfDot lf-info">●</span>${n.info} info <a href="#" class="wk" data-ra="out">worked: Route tab</a>
      ${ev.flags.filter(f => f.level !== 'info').slice(0, 6).map(f => `<div class="note ${f.level === 'stop' ? 'warnT' : ''}">${esc(f.text)}</div>`).join('')}</div>`;
  }
  function liveTab(r, live) { if (!inEl || r.id !== selR) return; const b = inEl.querySelector('#rtLive'); if (b) b.outerHTML = liveBox(r, evalRoute(r, live)); const z = A.P.site.zone;
    inEl.querySelectorAll('[data-rvx]').forEach(i => { const p = r.pts[+i.dataset.rvx]; if (p && document.activeElement !== i) i.value = G.ftToNative(z, i.dataset.c === 'E' ? p.x : p.y).toFixed(2); }); }
  function routeHtml(r) {
    const ev = evalRoute(r), v = RT.vehOf(r), l = RT.loadOf(r), z = G.zone(A.P.site.zone), V = r.veh, Ld = r.load;
    const fld = (pre, src, defs, eff, list) => list.filter(f => showF(v, f)).map(f => numIn(pre + f[0], src[f[0]], f[1], f[2], f[4] != null ? f[4] : fmt(defs[f[0]], f[2] === 'lb' || f[2] === 'no.' ? 0 : 2))).join('');
    return `${liveBox(r, ev)}
      <div class="fRow"><label for="rtName">Name</label><input type="text" id="rtName" value="${esc(r.name)}"></div>
      <div class="fRow"><label for="rtPick">Delivers to pick</label><select id="rtPick"><option value="">— none —</option>${A.P.picks.map(k => `<option value="${k.id}" ${k.id === r.pickId ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select></div>
      ${numIn('rtRdef', r.rDef, 'Curve radius at the vertices (default)', 'ft')}${numIn('rtMargin', r.margin, 'Overhead margin required', 'ft', '1.00')}${numIn('rtTol', r.stageTol, 'Staging tolerance (load CG to pick point)', 'ft', '2.00')}
      <div class="fRow"><label for="rtAt">Show the vehicle at</label><input type="range" id="rtAt" min="0" max="${ev.sim.ok ? Math.ceil(ev.sim.pa.L) : 0}" step="1" value="${isNum(r.at) ? r.at : ev.sim.ok ? Math.ceil(ev.sim.pa.L) : 0}"><span class="unit" id="rtAtV">${isNum(r.at) ? fmt(r.at, 0) + ' ft' : 'the stop'}</span></div>
      <details class="crVxList"><summary>Points and curve radii (${esc(z.short)})</summary><div class="tscroll"><table class="tbl"><thead><tr><th>#</th><th>Easting</th><th>Northing</th><th>Radius (ft)</th></tr></thead><tbody>
        ${r.pts.map((p, i) => `<tr><td>${i + 1}</td><td><input type="text" inputmode="decimal" data-rvx="${i}" data-c="E" aria-label="Point ${i + 1} easting" value="${G.ftToNative(z.id, p.x).toFixed(2)}"></td><td><input type="text" inputmode="decimal" data-rvx="${i}" data-c="N" aria-label="Point ${i + 1} northing" value="${G.ftToNative(z.id, p.y).toFixed(2)}"></td>
          <td>${i > 0 && i < r.pts.length - 1 ? `<input type="text" inputmode="decimal" data-rrad="${i}" aria-label="Radius at point ${i + 1}" value="${r.rad[i] == null ? '' : r.rad[i]}" placeholder="${fmt(r.rDef, 0)}">` : '—'}</td></tr>`).join('')}</tbody></table></div></details>
      <h4 class="stH">Vehicle</h4>
      <div class="fRow"><label for="rtType">Type</label><select id="rtType">${Object.entries(RT.TYPES).map(([k, t]) => `<option value="${k}" ${v.type === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      ${fld('rv_', V, RT.VDEF, v, VFIELDS)}
      <details class="crVxList"><summary>Weights and axles</summary>${fld('rv_', V, RT.VDEF, v, WFIELDS)}
        <label class="note" style="display:block"><input type="checkbox" id="rtAxOn" ${r.axIn.on ? 'checked' : ''}> Use entered axle-group loads (weigh tickets, the hauler's calculation)</label>
        ${r.axIn.on ? numIn('ra_S', r.axIn.S, 'Steer axle', 'lb') + numIn('ra_D', r.axIn.D, 'Drive group', 'lb') + (RT.hasJeep(v) ? numIn('ra_J', r.axIn.J, 'Jeep group', 'lb') : '') + numIn('ra_R', r.axIn.R, 'Rear group / dolly', 'lb') : ''}
        ${numIn('rtTyre', r.tyre.A, 'Tyre contact area (each)', 'in²', '100')}</details>
      <h4 class="stH">Load on the trailer</h4>
      ${fld('rl_', Ld, RT.LDEF, l, LFIELDS)}
      <p class="note">The load's front is then ${fmt(l.L - v.L2 - l.r, 2)} ft ${l.L - v.L2 - l.r >= 0 ? 'ahead of' : 'behind'} the ${RT.hasJeep(v) ? 'jeep bolster' : 'kingpin'}. A C5 girder object will be linkable here when C5 is on main; until then enter the girder's length, weight and overhangs.</p>
      <div class="goRow"><button type="button" data-ra="zoom">Show on the map</button>${ev.stage && ev.stage.pick ? '<button type="button" data-ra="topick">Move the pick point to the load</button>' : ''}<button type="button" class="danger" data-ra="del">Delete route</button></div>`;
  }
  function markHtml(mk) {
    const m = mk.mat || {};
    let h = `<div class="fRow"><label>Type</label><span>${esc(M.MARK_TYPES[mk.type])}${mk.type === 'overhead' ? (mk.pts.length === 1 ? ' (point)' : ' (line)') : ''}</span></div><div class="fRow"><label for="mkName">Name</label><input type="text" id="mkName" value="${esc(mk.name)}"></div>`;
    if (mk.type === 'overhead') h += numIn('mk_h', mk.h, 'Clearance height above the road', 'ft') + (mk.pts.length === 1 ? numIn('mk_w', mk.w, 'Radius in plan', 'ft', '2') : '');
    if (mk.type === 'haul') h += numIn('mk_w', mk.w, 'Width of the haul road / mat run', 'ft', '20') + numIn('mk_qa', mk.qa, 'Allowable bearing pressure', 'psf')
      + `<div class="fRow"><label for="mk_mt">Mat</label><select id="mk_mt">${Object.entries(window.CranePickGround.MAT_TYPES).map(([k, t]) => `<option value="${k}" ${m.type === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`
      + (m.type && m.type !== 'none' ? numIn('mm_B', m.B, 'Mat width', 'ft') + numIn('mm_L', m.L, 'Mat length', 'ft') + numIn('mm_t', m.t, 'Mat thickness', 'in') + (m.type === 'timber' ? numIn('mm_Fb', m.Fb, "F_b' (adjusted)", 'psi') + numIn('mm_Fv', m.Fv, "F_v' (adjusted)", 'psi') : numIn('mm_Fy', m.Fy, 'F_y', 'ksi')) + numIn('mm_k', m.k, 'Spread (horizontal : 1 vertical)', ': 1', '1') : '');
    if (mk.type === 'bridge') { const p = mk.post || {}; h += numIn('mk_w', mk.w, 'Bridge width (on the route when the path is within w/2)', 'ft', '30') + numIn('mp_gross', p.gross, 'Posting: gross', 'tons') + numIn('mp_axle', p.axle, 'Posting: per axle', 'tons')
      + `<div class="fRow"><label for="mp_tLabel">Posting by vehicle type: type</label><input type="text" id="mp_tLabel" value="${esc(p.tLabel)}" placeholder="e.g. Type 3S2"></div>` + numIn('mp_tTons', p.tTons, 'Posting for that type', 'tons')
      + '<p class="note">Tons of 2,000 lb. Postings by vehicle type: enter the one that applies to this vehicle; the gross weight is compared with it.</p>'; }
    return h + `<div class="goRow"><button type="button" class="danger" data-ra="mdel">Delete</button></div>`;
  }
  function drawTab() {
    if (!inEl) return;
    const r = routeOf(selR), mk = markOf(selM), act = drawing ? drawing.k : '';
    inEl.innerHTML = `<div class="sec"><div class="secHead">Draw</div><div class="secBody"><div class="crTools">${Object.entries(TOOLS).map(([k, t]) => `<button type="button" class="tbBtn${act === k ? ' on' : ''}" data-rtool="${k}" title="${esc(t.tip)}">${esc(t.label)}</button>`).join('')}</div>
        <p class="note">The route is the path of the tractor's steer-axle centre; each bend becomes a curve of the radius given (no automatic road routing). Click a route to select it, then drag its points (the swept path and the flags follow live); "+" handles add a point, a double-click removes one.</p></div></div>
      ${r ? `<div class="sec" id="rtCard"><div class="secHead">Route: ${esc(r.name)}</div><div class="secBody">${routeHtml(r)}</div></div>` : ''}
      ${mk ? `<div class="sec" id="mkCard"><div class="secHead">${esc(M.MARK_TYPES[mk.type])}: ${esc(mk.name)}</div><div class="secBody">${markHtml(mk)}</div></div>` : ''}
      <div class="sec"><div class="secHead">Routes (${A.P.routes.length}) and marks (${A.P.routeMarks.length})</div><div class="secBody">
        ${A.P.routes.map(x => { const ev = evalRoute(x); return `<div class="itRow${x.id === selR ? ' on' : ''}"><button type="button" class="itSel" data-rsel="${x.id}"><span class="sw" style="background:${COL.path}"></span>${esc(x.name)}</button><span class="itSum">${ev.sim.ok ? fmt(ev.sim.pa.L, 0) + ' ft · ' + ev.flags.filter(f => f.level === 'stop').length + ' stop' : '—'}</span><button type="button" class="itDel" data-rdel="${x.id}" aria-label="Delete ${esc(x.name)}">×</button></div>`; }).join('')}
        ${A.P.routeMarks.map(x => `<div class="itRow${x.id === selM ? ' on' : ''}"><button type="button" class="itSel" data-msel="${x.id}"><span class="sw" style="background:${COL[x.type]}"></span>${esc(x.name)}</button><span class="itSum">${esc(M.MARK_TYPES[x.type])}</span><button type="button" class="itDel" data-mdel="${x.id}" aria-label="Delete ${esc(x.name)}">×</button></div>`).join('')}
        ${!A.P.routes.length && !A.P.routeMarks.length ? '<p class="note">No route yet: "Route", then click the points on the map.</p>' : ''}</div></div>`;
  }
  function onClick(e) {
    const t = e.target.closest('[data-rtool]'); if (t) { if (drawing && drawing.k === t.dataset.rtool) cancel(); else setTool(t.dataset.rtool); return; }
    const s = e.target.closest('[data-rsel]'); if (s) { select(s.dataset.rsel); zoom(); return; }
    const sm = e.target.closest('[data-msel]'); if (sm) { selectMark(sm.dataset.msel); return; }
    const d = e.target.closest('[data-rdel]'); if (d) { delRoute(d.dataset.rdel); return; }
    const dm = e.target.closest('[data-mdel]'); if (dm && dm.dataset.mdel) { delMark(dm.dataset.mdel); return; }
    const a = e.target.closest('[data-ra]'); if (!a) return; e.preventDefault();
    const r = routeOf(selR);
    if (a.dataset.ra === 'out') { A.showOTab('route'); setTimeout(() => { const x = document.getElementById('rt-' + selR); if (x) x.scrollIntoView({ block: 'start' }); }, 50); }
    if (a.dataset.ra === 'zoom') zoom();
    if (a.dataset.ra === 'del' && r) delRoute(r.id);
    if (a.dataset.ra === 'mdel' && selM) delMark(selM);
    if (a.dataset.ra === 'topick' && r) { const ev = evalRoute(r), k = ev.stage && ev.stage.pick; if (k) A.update(() => { k.pick = { x: ev.stage.cg.x, y: ev.stage.cg.y }; }, 'lifts', { id: k.id }); renderAll(); drawTab(); }
  }
  function zoom() { const r = routeOf(selR); if (r) { A.showOTab('plan'); MP().fit(r.pts); } }
  function onChange(e) {
    const t = e.target, r = routeOf(selR), mk = markOf(selM);
    const num = () => { if (t.value.trim() === '') { t.classList.remove('bad'); return null; } const v = G.parseNum(t.value); if (!isFinite(v)) { t.classList.add('bad'); return undefined; } t.classList.remove('bad'); return v; };
    const commit = fn => { A.update(fn, 'route', { id: (r || mk).id }); renderAll(); drawTab(); };
    if (r) {
      if (t.id === 'rtName') return commit(() => { r.name = t.value; });
      if (t.id === 'rtPick') return commit(() => { r.pickId = t.value; });
      if (t.id === 'rtType') return commit(() => { r.veh.type = t.value; });
      if (t.id === 'rtAxOn') return commit(() => { r.axIn.on = t.checked; });
      if (t.id === 'rtAt') { const v = +t.value; return commit(() => { r.at = v; }); }
      const v = num(); if (v === undefined) return;
      const nonneg = () => { if (v != null && v < 0) { t.classList.add('bad'); return false; } return true; };
      if (t.id === 'rtRdef') { if (v != null && !(v > 0)) { t.classList.add('bad'); return; } return commit(() => { r.rDef = v == null ? 50 : v; }); }
      if (t.id === 'rtMargin') { if (!nonneg()) return; return commit(() => { r.margin = v; }); }
      if (t.id === 'rtTol') { if (!nonneg()) return; return commit(() => { r.stageTol = v; }); }
      if (t.id === 'rtTyre') { if (v != null && !(v > 0)) { t.classList.add('bad'); return; } return commit(() => { r.tyre.A = v; }); }
      if (t.dataset.rrad) { if (v != null && !(v > 0)) { t.classList.add('bad'); return; } return commit(() => { r.rad[+t.dataset.rrad] = v; }); }
      if (t.dataset.rvx) { if (v == null) return; const i = +t.dataset.rvx, k = t.dataset.c === 'E' ? 'x' : 'y'; return commit(() => { r.pts[i] = Object.assign({}, r.pts[i], { [k]: G.nativeToFt(A.P.site.zone, v) }); }); }
      if (t.id.indexOf('rv_') === 0) { const k = t.id.slice(3); if (['e', 'ej', 'xt', 'xtl'].indexOf(k) < 0 && !nonneg()) return; if (k === 'k' && v != null && v > 1) { t.classList.add('bad'); return; } return commit(() => { r.veh[k] = v; }); }
      if (t.id.indexOf('rl_') === 0) { const k = t.id.slice(3); if (k !== 'r' && !nonneg()) return; return commit(() => { r.load[k] = v; }); }
      if (t.id.indexOf('ra_') === 0) { if (!nonneg()) return; return commit(() => { r.axIn[t.id.slice(3)] = v; }); }
    }
    if (mk) {
      if (t.id === 'mkName') return commit(() => { mk.name = t.value; });
      if (t.id === 'mk_mt') return commit(() => { mk.mat.type = t.value; });
      if (t.id === 'mp_tLabel') return commit(() => { mk.post.tLabel = t.value; });
      const v = num(); if (v === undefined) return; if (v != null && v < 0) { t.classList.add('bad'); return; }
      if (t.id.indexOf('mk_') === 0) return commit(() => { mk[t.id.slice(3)] = v; });
      if (t.id.indexOf('mm_') === 0) return commit(() => { mk.mat[t.id.slice(3)] = v; });
      if (t.id.indexOf('mp_') === 0) return commit(() => { mk.post[t.id.slice(3)] = v; });
    }
  }
  function onInput(e) { if (e.target.id === 'rtAt') { const r = routeOf(selR); if (!r) return; r.at = +e.target.value; const s = inEl.querySelector('#rtAtV'); if (s) s.textContent = fmt(r.at, 0) + ' ft'; MP().raf('routeAt', () => drawRoute(r)); } }
  function delRoute(id) { if (selR === id) { selR = null; clearHandles(); } A.update(P => { P.routes = P.routes.filter(r => r.id !== id); }, 'route'); removeLayer(id); drawTab(); }
  function delMark(id) { if (selM === id) { selM = null; clearHandles(); } A.update(P => { P.routeMarks = P.routeMarks.filter(m => m.id !== id); }, 'route'); removeLayer('m:' + id); renderAll(); drawTab(); }
  /* ---------- the Route output tab ---------- */
  const S = () => window.CranePickSite;
  const flagLi = f => `<li class="lf-${f.level}">${esc(f.text)}</li>`;
  const det = (id, title, steps, open) => steps && steps.length ? `<details class="crSteps" id="${id}"${open ? ' open' : ''}><summary>${esc(title)}: worked</summary>${S().steps(steps)}</details>` : '';
  function routeOut(r, i) {
    const ev = evalRoute(r), v = RT.vehOf(r), l = RT.loadOf(r), id = r.id;
    if (!ev.sim.ok) return `<div class="sec" id="rt-${id}"><div class="secHead">${esc(r.name)}</div><div class="secBody"><p class="note">${esc(ev.flags[0].text)}</p></div></div>`;
    const tRows = ev.turns.map(t => `<tr><td><a href="#rt-${id}-t${t.n}">T${t.n}</a></td><td class="n">${t.i + 1}</td><td class="n">${fmt(t.D * 180 / Math.PI, 1)}</td><td class="n">${fmt(t.r, 1)}${t.reduced ? ' *' : ''}</td><td class="n">${fmt(t.ot, 2)}</td><td class="n">${t.ss ? fmt(t.ss.OT, 2) : '—'}</td><td class="n">${fmt(t.Rin, 2)}</td><td class="n">${fmt(t.Rout, 2)}</td><td class="n">${fmt(t.Rout - t.Rin, 2)}</td><td>${t.flags.map(f => `<span class="lfDot lf-${f.level}">●</span>`).join('') || 'OK'}</td></tr>`).join('');
    const oh = ev.oh.list.map(o => `<tr><td><a href="#rt-${id}-oh-${o.id}">${esc(o.name)}</a></td><td>${o.kind === 'power' ? 'power line' : 'overhead'}</td><td class="n">${o.kind === 'power' ? fmt(o.hw, 2) : fmt(o.h, 2)}</td><td class="n">${fmt(o.Htop, 2)}</td><td class="n">${o.kind === 'power' ? fmt(o.d, 2) + ' (D_T ' + fmt(o.DT, 0) + ')' : fmt(o.c, 2)}</td><td>${o.flag ? `<span class="lfDot lf-${o.flag.level}">●</span>${esc(o.flag.level)}` : 'OK'}</td></tr>`).join('');
    const ax = ev.ax.groups.map(g => `<tr><td>${esc(g.label)}</td><td class="n">${fmt(g.load, 0)}</td><td class="n">${g.n}</td><td class="n">${fmt(g.perAxle, 0)}</td><td class="n">${fmt(g.perTyre, 0)}</td></tr>`).join('');
    const st = ev.stage;
    return `<div class="sec" id="rt-${id}"><div class="secHead">${esc(r.name)} — ${esc(RT.TYPES[v.type])}</div><div class="secBody">
      ${S().kv([['Length (steer-axle path)', fmt(ev.sim.pa.L, 1) + ' ft'], ['Max off-tracking', fmt(ev.otMax, 2) + ' ft'], ['Gross weight', `${fmt(ev.ax.gross, 0)} lb (${fmt(ev.ax.gross / RT.LB_PER_TON, 2)} t)`], ['Load top', fmt(ev.oh.Htop, 2) + ' ft'], ['Min. turning radius (input)', fmt(v.Rmin, 1) + ' ft'], ['Load', `${fmt(l.L, 1)} × ${fmt(l.B, 1)} ft, ${fmt(l.W, 0)} lb`]])}
      <h4 class="stH">Flags</h4>${ev.flags.length ? `<ul class="lfFlags">${ev.flags.map(flagLi).join('')}</ul>` : '<p class="note">None.</p>'}
      <h4 class="stH">Turns (swept path)</h4>${ev.turns.length ? `<div class="tscroll"><table class="tbl lfTbl"><thead><tr><th>Turn</th><th>At pt</th><th>Δ (°)</th><th>r (ft)</th><th>OT max (ft)</th><th>OT steady (ft)</th><th>R inside (ft)</th><th>R outside (ft)</th><th>Swept width (ft)</th><th></th></tr></thead><tbody>${tRows}</tbody></table></div>
        ${ev.turns.some(t => t.reduced) ? '<p class="note">* radius reduced to fit the drawn tangents.</p>' : ''}${ev.turns.map(t => det(`rt-${id}-t${t.n}`, `Turn ${t.n}`, t.steps)).join('')}` : '<p class="note">No bends: a straight route.</p>'}
      <p class="note">Method: ${esc(RT.REF.ot)}; RK4 integration every ${RT.STEP} ft of steer-axle travel; the outlines every 1 ft. Off-tracking = the distance of the ${RT.steered(v) ? 'rear dolly pivot' : 'trailer rear-group centre'} from the steer-axle path.</p>
      <h4 class="stH">Conflicts with the site</h4>${ev.conf.length ? `<ul class="lfFlags">${ev.conf.map(flagLi).join('')}</ul>` : '<p class="note">None: no obstruction, exclusion zone, crane footprint or power-line buffer reached.</p>'}
      <h4 class="stH">Overhead clearances</h4>${det(`rt-${id}-top`, 'Load top', ev.oh.top, false)}${oh ? `<div class="tscroll"><table class="tbl lfTbl"><thead><tr><th>Item</th><th>Kind</th><th>Height (ft)</th><th>Load top (ft)</th><th>Clearance (ft)</th><th></th></tr></thead><tbody>${oh}</tbody></table></div>${ev.oh.list.map(o => det(`rt-${id}-oh-${o.id}`, o.name, o.steps)).join('')}` : '<p class="note">Nothing overhead on the route.</p>'}
      <p class="note">Power lines: 29 CFR 1926.1411 Table T (travel, no load: up to 0.75 kV 4 ft; over 0.75 to 50 kV 6 ft; over 50 to 345 kV 10 ft; over 345 to 750 kV 16 ft; over 750 to 1,000 kV 20 ft; over 1,000 kV as set by the utility / RPE; paraphrased); a dedicated spotter within 20 ft (1926.1411(b)(4)). Applied to the haul vehicle and its load (engineer's instruction; 1926.1411 is written for equipment travelling without a load); engineer to confirm.</p>
      <h4 class="stH">Axle loads (${ev.ax.mode === 'entered' ? 'entered' : 'statics'})</h4><div class="tscroll"><table class="tbl lfTbl"><thead><tr><th>Group</th><th>Load (lb)</th><th>Axles</th><th>Per axle (lb)</th><th>Per tyre (lb)</th></tr></thead><tbody>${ax}<tr><td><b>Gross</b></td><td class="n"><b>${fmt(ev.ax.gross, 0)}</b></td><td></td><td></td><td></td></tr></tbody></table></div>${det(`rt-${id}-ax`, 'Axle loads', ev.ax.steps)}
      <h4 class="stH">Haul road bearing</h4>${ev.haul.filter(h => !h.flagOnly).length ? ev.haul.filter(h => !h.flagOnly).map(h => `<p class="note"><b>${esc(h.name)}</b>: heaviest tyre ${fmt(h.P, 0)} lb, q<sub>g</sub> = ${fmt(h.qg, 0)} psf${h.qa ? ` vs q<sub>a</sub> = ${fmt(h.qa, 0)} psf (${fmt(h.ratio * 100, 0)} %)` : ' (allowable not entered)'}</p>${det(`rt-${id}-h-${h.id}`, h.name, h.steps)}`).join('') : '<p class="note">The route does not use a drawn haul road / mat run.</p>'}
      <h4 class="stH">Posted bridges</h4>${ev.br.length ? ev.br.map(b => `<p class="note"><b>${esc(b.name)}</b>: ${b.checks.length ? b.checks.map(c => `${esc(c.what)} ${fmt(c.val, 2)} / ${fmt(c.limit, 2)} t`).join('; ') : 'no posting entered'} — ${b.ok ? 'OK' : '<b class="warnT">see flags</b>'}</p>${det(`rt-${id}-b-${b.id}`, b.name, b.steps)}`).join('') : '<p class="note">No posted bridge on the route.</p>'}
      <h4 class="stH">Staging (the truck stop)</h4><p class="note">Load CG at the stop: E ${fmt(G.ftToNative(A.P.site.zone, st.cg.x), 2)}, N ${fmt(G.ftToNative(A.P.site.zone, st.cg.y), 2)}; load axis azimuth ${fmt(st.az, 1)}°.${st.pick ? ` Pick "${esc(st.pick.name)}": offset ${fmt(st.off, 2)} ft${st.ev ? `, R = ${fmt(st.ev.R, 2)} ft, ${fmt(st.ev.pct, 1)} % of chart (${esc(LF.CLS[st.ev.cls])})` : ''}.` : ' No pick linked.'} Turnaround: information only${isNum(st.turnR) ? ` (outer front corner radius ${fmt(st.turnR, 1)} ft at R_min)` : ''}.</p>${det(`rt-${id}-sg`, 'Staging', st.steps)}
    </div></div>`;
  }
  function drawOut() {
    if (!outEl) return; outDirty = false;
    outEl.innerHTML = A.P.routes.length ? A.P.routes.map(routeOut).join('') : '<div class="ph">No trucking route yet: Route input tab → "Route", then click the points on the map.</div>';
  }
  /* ---------- Report §Route ---------- */
  function routeSvg(P, r, ev) {
    const pts = [].concat(...ev.sim.samples.map(q => q.parts.map(p => p.poly).flat())); if (!pts.length) return '';
    P.items.filter(i => i.type !== 'label').forEach(i => pts.push(...i.pts));
    let x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x)), y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
    const span = Math.max(x1 - x0, y1 - y0, 20), pad = span * 0.06; x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
    const Wd = 680, Ht = Math.max(240, Math.min(560, Wd * (y1 - y0) / Math.max(1e-9, x1 - x0))), k = Math.min(Wd / (x1 - x0), Ht / (y1 - y0));
    const X = x => ((x - x0) * k).toFixed(1), Y = y => (Ht - (y - y0) * k).toFixed(1), path = (ps, c) => ps.map((p, j) => (j ? 'L' : 'M') + X(p.x) + ' ' + Y(p.y)).join(' ') + (c ? ' Z' : '');
    const col = { obst: '#7C3AED', power: '#DC2626', util: '#059669', excl: '#D97706', dim: '#0F172A' };
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wd} ${Ht.toFixed(0)}" width="${Wd}" height="${Ht.toFixed(0)}" font-family="Arial, sans-serif" font-size="11"><rect width="100%" height="100%" fill="#fff" stroke="#94a3b8"/>`;
    P.items.filter(i => i.type !== 'label' && i.type !== 'dim').forEach(i => { const cl = i.type === 'obst' || i.type === 'excl' || (i.type === 'util' && i.closed); s += `<path d="${path(i.pts, cl)}" fill="${cl ? col[i.type] : 'none'}" fill-opacity="0.15" stroke="${col[i.type]}" stroke-width="1.5"/>`; });
    (P.routeMarks || []).forEach(m => { s += m.pts.length === 1 ? `<circle cx="${X(m.pts[0].x)}" cy="${Y(m.pts[0].y)}" r="4" fill="${COL[m.type]}"/>` : `<path d="${path(m.pts)}" fill="none" stroke="${COL[m.type]}" stroke-width="3" stroke-opacity="0.6"/>`; });
    const sw = RT.swept(ev.sim, 2); s += `<path d="${sw.rings.map(q => path(q, true)).join(' ')}" fill="${COL.swept}" fill-opacity="0.18" fill-rule="nonzero" stroke="none"/>`;
    s += `<path d="${path(ev.sim.dense.filter(q => q.s >= 0))}" fill="none" stroke="${COL.path}" stroke-width="2"/>`;
    ev.sim.samples[ev.sim.samples.length - 1].parts.forEach(pp => { s += `<path d="${path(pp.poly, true)}" fill="${pp.part === 'load' ? COL.load : '#fff'}" fill-opacity="${pp.part === 'load' ? 0.35 : 0.7}" stroke="#0f172a" stroke-width="1"/>`; });
    ev.turns.forEach(t => { const m = RT.at(ev.sim.pa, (t.s0 + t.s1) / 2); s += `<text x="${X(m.x)}" y="${Y(m.y)}" dy="-6" text-anchor="middle" fill="#0f172a">T${t.n}</text>`; });
    const nice = v => { const e = Math.pow(10, Math.floor(Math.log10(v))); return [1, 2, 5, 10].map(q => q * e).filter(q => q <= v).pop() || e; }, sb = nice((x1 - x0) / 4);
    s += `<g transform="translate(${Wd - 30},34)"><path d="M0 -22 L7 4 L0 -2 L-7 4 Z" fill="#0f172a"/><text y="18" text-anchor="middle" font-weight="bold">N</text></g>`;
    s += `<g transform="translate(14,${(Ht - 14).toFixed(0)})"><rect width="${(sb * k).toFixed(1)}" height="5" fill="#0f172a"/><text y="-4">${fmt(sb, 0)} ft</text></g></svg>`;
    return s;
  }
  window.CranePickReport && window.CranePickReport.add(P => {
    if (!(P.routes || []).length) return [];
    const subs = [];
    P.routes.forEach((r, i) => {
      const ev = evalRoute(r), v = RT.vehOf(r), l = RT.loadOf(r), items = [];
      if (!ev.sim.ok) { subs.push({ id: 'r' + i, key: 'route-' + i, title: r.name, items: [{ type: 'note', text: ev.flags[0].text }] }); return; }
      items.push({ type: 'figure', svg: routeSvg(P, r, ev), caption: `${r.name}: the steer-axle path, the swept path (outlines every 2 ft) and the vehicle at the truck stop (north up).` });
      items.push({ type: 'kv', rows: [['Vehicle', RT.TYPES[v.type]], ['Tractor', `L1 ${fmt(v.L1, 2)} ft, kingpin ${fmt(v.e, 2)} ft ahead of the drive group, width ${fmt(v.Wt, 2)} ft`], ['Body', `L2 ${fmt(v.L2, 2)} ft${RT.hasJeep(v) ? `, jeep ${fmt(v.Lj, 2)} ft (bolster ${fmt(v.ej, 2)} ft)` : ''}${RT.steered(v) ? `, rear dolly k = ${fmt(v.k, 2)}, δmax ${fmt(v.dmax, 0)}°` : ''}`],
        ['Load', `${fmt(l.L, 2)} ft × ${fmt(l.B, 2)} ft, ${fmt(l.W, 0)} lb, rear overhang ${fmt(l.r, 2)} ft, height ${fmt(l.h, 2)} ft on a ${fmt(v.hDeck, 2)} ft deck`], ['Min. turning radius', fmt(v.Rmin, 1) + ' ft'], ['Route length', fmt(ev.sim.pa.L, 1) + ' ft'], ['Max off-tracking', fmt(ev.otMax, 2) + ' ft'],
        ['Gross weight', `${fmt(ev.ax.gross, 0)} lb (${fmt(ev.ax.gross / RT.LB_PER_TON, 2)} t), axle loads by ${ev.ax.mode}`]] });
      items.push({ type: 'note', text: ev.flags.length ? 'Flags: ' + ev.flags.map(f => `[${f.level}] ${f.text}`).join(' ') : 'Flags: none.' });
      if (ev.turns.length) items.push({ type: 'table', head: ['Turn', 'Δ (°)', 'r (ft)', 'OT max (ft)', 'OT steady (ft)', 'R inside (ft)', 'R outside (ft)', 'Swept width (ft)'], rows: ev.turns.map(t => [`T${t.n}`, fmt(t.D * 180 / Math.PI, 1), fmt(t.r, 1) + (t.reduced ? ' *' : ''), fmt(t.ot, 2), t.ss ? fmt(t.ss.OT, 2) : '—', fmt(t.Rin, 2), fmt(t.Rout, 2), fmt(t.Rout - t.Rin, 2)]) });
      items.push({ type: 'note', text: `Swept path: ${RT.REF.ot}, paraphrased; the vehicle follows the drawn path (steer-axle centre) at low speed without tyre slip; outlines of the tractor, ${RT.steered(v) ? 'rear dolly' : 'trailer deck'} and load. Turns worked below.` });
      ev.turns.forEach(t => items.push({ type: 'steps', scope: 'route', title: `${r.name}: turn ${t.n}`, steps: t.steps }));
      if (ev.conf.length) items.push({ type: 'note', text: 'Conflicts: ' + ev.conf.map(f => f.text).join(' ') });
      items.push({ type: 'steps', scope: 'route', title: `${r.name}: load top`, steps: ev.oh.top });
      if (ev.oh.list.length) { items.push({ type: 'table', head: ['Item', 'Kind', 'Height (ft)', 'Clearance (ft)', 'Result'], rows: ev.oh.list.map(o => [o.name, o.kind === 'power' ? 'power line (Table T)' : 'overhead', fmt(o.kind === 'power' ? o.hw : o.h, 2), o.kind === 'power' ? `${fmt(o.d, 2)} vs D_T ${fmt(o.DT, 0)}` : fmt(o.c, 2), o.flag ? o.flag.level : 'OK']) });
        ev.oh.list.forEach(o => items.push({ type: 'steps', scope: 'route', title: `${r.name}: ${o.name}`, steps: o.steps })); }
      items.push({ type: 'table', head: ['Axle group', 'Load (lb)', 'Axles', 'Per axle (lb)', 'Per tyre (lb)'], rows: ev.ax.groups.map(g => [g.label, fmt(g.load, 0), String(g.n), fmt(g.perAxle, 0), fmt(g.perTyre, 0)]) });
      items.push({ type: 'steps', scope: 'route', title: `${r.name}: axle loads`, steps: ev.ax.steps });
      ev.haul.filter(h => !h.flagOnly).forEach(h => items.push({ type: 'steps', scope: 'route', title: `${r.name}: haul road ${h.name}`, steps: h.steps }));
      ev.br.forEach(b => items.push({ type: 'steps', scope: 'route', title: `${r.name}: posted bridge ${b.name}`, steps: b.steps }));
      items.push({ type: 'steps', scope: 'route', title: `${r.name}: staging`, steps: ev.stage.steps });
      subs.push({ id: 'r' + i, key: 'route-' + i, title: r.name, items });
    });
    return [{ id: 'route', key: 'route', title: 'Route', subs }];
  });
  /* ---------- wiring ---------- */
  A.inTab({ id: 'route', label: 'Route', build: p => { inEl = p; p.addEventListener('click', onClick); p.addEventListener('change', onChange); p.addEventListener('input', onInput); drawTab(); }, show: drawTab });
  A.outTab({ id: 'route', label: 'Route', before: 'site', build: p => { outEl = p; p.addEventListener('click', e => { const a = e.target.closest('a[href^="#rt-"]'); if (!a) return; e.preventDefault(); const x = document.getElementById(a.getAttribute('href').slice(1)); if (x) { if (x.tagName === 'DETAILS') x.open = true; x.scrollIntoView({ block: 'start' }); } }); }, show: () => { if (outDirty) drawOut(); } });
  const markOut = () => { outDirty = true; if (A.ui.otab === 'route') drawOut(); };
  A.on('project', () => { if (drawing) cancel(); if (selR && !routeOf(selR)) selR = null; if (selM && !markOf(selM)) selM = null; renderAll(); drawTab(); markOut(); });
  A.on('change', o => {
    if (o.kind === 'select' || o.kind === 'select-lift') return;
    markOut();
    if (o.kind === 'route' && Date.now() - dragEnd < 400) { const r = routeOf(o.id); if (r) { drawRoute(r); drawHandles(); } drawTab(); return; }   // a drag ended
    renderAll(); if (A.ui.itab === 'route' && o.kind !== 'route') drawTab();
  });
  A.on('live', o => { if (o && (o.kind === 'items' || o.kind === 'lifts')) { outDirty = true; (A.P.routes || []).forEach(r => drawRoute(r, true)); } });
  A.on('tab', id => { if (id === 'plan') setTimeout(renderAll, 0); });
  A.on('ready', () => { const st = document.getElementById('mbStatus'); if (st) st.addEventListener('click', e => { const b = e.target.closest('[data-rtb]'); if (!b) return; if (b.dataset.rtb === 'finish') finish(); else cancel(); }); });
  A.on('key', e => { if (drawing) return; if ((e.key === 'Delete') && (selR || selM)) { e.preventDefault(); if (selR) delRoute(selR); else delMark(selM); } else if (e.key === 'Escape' && (selR || selM)) { selR = null; selM = null; clearHandles(); renderAll(); drawTab(); } });
  window.CranePickRouteUI = { setTool, finish, cancel, select, selectMark, evalRoute, renderAll, get selected() { return { route: selR, mark: selM }; }, get drawing() { return drawing; }, layers, routeSvg };
})();
