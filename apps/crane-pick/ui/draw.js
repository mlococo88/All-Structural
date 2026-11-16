/* apps/crane-pick/ui/draw.js — the site items: drawing, selecting, dragging, editing (window.CranePickDraw). C1-3 (2026-11-16).
   Item types (engine/model.js TYPES): obstruction (polygon, height), power line (polyline, voltage -> OSHA 29 CFR 1926.1408 Table A
   minimum clearance, drawn as a plan buffer), buried utility / culvert / wall (polyline or polygon, depth to top / top elevation, size),
   exclusion zone (polygon), text label (point), dimension (two points: distance and bearing, live).
   Drawing: pick a tool (map toolbar or the Site items tab), click the points; double-click, Enter, "Finish" or a click on the first point
   ends a line or area; Backspace removes the last point; Esc cancels. A label is one click, a dimension two.
   Editing: click an item to select it: vertex handles (drag; double-click removes a vertex), "+" handles between vertices (drag to add one),
   a move handle (drag the whole item; on a desktop the item itself can be dragged too); the Site items tab edits the properties and the
   vertex coordinates; Delete removes it. Every finished drag or edit is one undo step; while dragging, the map is redrawn once per
   animation frame and the computed values (length, area, clearance buffer, dimension) follow live. */
(function () {
  'use strict';
  const A = window.CranePickApp, G = window.CranePickGeo, M = window.CranePickModel, W = window.CranePickWorked, esc = A.esc;
  const MP = () => window.CranePickMap;
  const TOOLS = [
    { k: 'obst', type: 'obst', label: 'Obstruction', icon: '▰', geom: 'polygon', tip: 'Obstruction (area): building, pier, tree line… with its height' },
    { k: 'power', type: 'power', label: 'Power line', icon: 'ϟ', geom: 'polyline', tip: 'Overhead power line with its voltage: the OSHA minimum clearance is drawn around it' },
    { k: 'utilL', type: 'util', label: 'Utility (line)', icon: '┅', geom: 'polyline', tip: 'Buried utility, culvert or wall along a line, with its depth' },
    { k: 'utilA', type: 'util', label: 'Utility (area)', icon: '▭', geom: 'polygon', tip: 'Buried structure, culvert or wall as an area, with its depth' },
    { k: 'excl', type: 'excl', label: 'Exclusion zone', icon: '⛔', geom: 'polygon', tip: 'Area the crane, load or outriggers must stay out of' },
    { k: 'label', type: 'label', label: 'Label', icon: 'T', geom: 'point', tip: 'Text label' },
    { k: 'dim', type: 'dim', label: 'Dimension', icon: '↔', geom: 'dim', tip: 'Dimension: distance and bearing between two points' }
  ];
  const COL = { obst: '#7C3AED', power: '#DC2626', util: '#059669', culvert: '#0E7490', wall: '#57534E', other: '#64748B', excl: '#D97706', dim: '#0F172A', label: '#0F172A' };
  const colorOf = it => it.type === 'util' ? (COL[it.kind] || COL.util) : COL[it.type];
  const fmt = (v, d) => (typeof v === 'number' && isFinite(v)) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  let el = null, sel = null, drawing = null, layers = new Map(), handles = [], body = null, dragEnd = 0;   // dragEnd: when the last drag ended (its click is not a deselect)
  const itemOf = id => A.P.items.find(i => i.id === id) || null;
  const closed = it => it.type === 'obst' || it.type === 'excl' || (it.type === 'util' && it.closed);
  /* ---------- computed values (engine) ---------- */
  function clearance(it) { return window.CranePickOSHA.clearance({ kv: it.kv, le350: it.le350, setFt: it.setFt }, 'it'); }
  function summary(it) {
    if (it.type === 'label') return '';
    if (it.type === 'dim') { const d = W.dim(it.pts[0], it.pts[1], 'x'); return `${fmt(d.L, 2)} ft · ${d.bearing}`; }
    if (closed(it)) return `${fmt(G.area(it.pts), 0)} ft²`;
    const L = G.polyLength(it.pts), c = it.type === 'power' ? clearance(it) : null;
    return `${fmt(L, 1)} ft` + (c ? ` · clearance ${isFinite(c.ft) ? fmt(c.ft, 0) + ' ft' : 'not set'}` : '');
  }
  /* ---------- map layers ---------- */
  const L_ = () => window.L;
  const lls = pts => pts.map(p => MP().toLL(p));
  function labelIcon(it) { return L_().divIcon({ className: 'crLabel', html: `<span style="font-size:${it.size}px">${esc(it.text)}</span>`, iconSize: null, iconAnchor: [0, 0] }); }
  function dimIcon(it) { const d = W.dim(it.pts[0], it.pts[1], 'x'); return L_().divIcon({ className: 'crDimTxt', html: `<span>${fmt(d.L, 2)} ft<br><small>${esc(d.bearing)}</small></span>`, iconSize: null, iconAnchor: [0, 0] }); }
  function bufferLL(it) { const c = clearance(it); return isFinite(c.ft) && c.ft > 0 ? G.bufferRings(it.pts, c.ft, 36).map(lls) : []; }
  function nameTip(it) { const n = it.name || M.TYPES[it.type].label; return it.type === 'power' ? `${esc(n)} · ${it.kv != null ? fmt(it.kv, it.kv % 1 ? 1 : 0) + ' kV' : 'kV not known'}` : it.type === 'obst' && it.height != null ? `${esc(n)} · ${fmt(it.height, 1)} ft high` : esc(n); }
  function makeLayer(it) {
    const Lf = L_(), m = MP().map, on = it.id === sel, c = colorOf(it), o = { color: c, weight: on ? 4 : 2.5, className: 'crItem', bubblingMouseEvents: false };
    const g = { main: null, extra: [] };
    if (it.type === 'label') {   // a selected label is dragged by its text (no ✥ handle over it)
      g.main = Lf.marker(MP().toLL(it.pts[0]), { icon: labelIcon(it), keyboard: false, bubblingMouseEvents: false, draggable: on, zIndexOffset: on ? 900 : 0 });
      if (on) { g.main.on('drag', () => { it.pts[0] = MP().toFt(g.main.getLatLng()); MP().raf('item', () => { A.live('items', { id: it.id }); liveProps(it); }); });
        g.main.on('dragend', () => { dragEnd = Date.now(); A.update(null, 'items', { id: it.id }); }); }
    }
    else if (it.type === 'dim') {
      g.main = Lf.polyline(lls(it.pts), Object.assign(o, { weight: on ? 3 : 2 }));
      g.extra.push(Lf.marker(MP().toLL({ x: (it.pts[0].x + it.pts[1].x) / 2, y: (it.pts[0].y + it.pts[1].y) / 2 }), { icon: dimIcon(it), interactive: false, keyboard: false }));
      it.pts.forEach(p => g.extra.push(Lf.circleMarker(MP().toLL(p), { radius: 3, color: c, fillColor: c, fillOpacity: 1, interactive: false })));
    } else if (closed(it)) g.main = Lf.polygon(lls(it.pts), Object.assign(o, { fillColor: c, fillOpacity: it.type === 'excl' ? 0.22 : 0.18, dashArray: it.type === 'excl' || it.type === 'util' ? '8 5' : null }));
    else g.main = Lf.polyline(lls(it.pts), Object.assign(o, { dashArray: it.type === 'util' ? '12 6 3 6' : null, weight: it.type === 'power' ? (on ? 4 : 3) : o.weight }));
    if (it.type === 'power') { const b = Lf.polygon(bufferLL(it), { stroke: false, fillColor: c, fillOpacity: 0.16, fillRule: 'nonzero', interactive: false }); g.extra.unshift(b); g.buf = b; }
    if (it.type !== 'label' && it.type !== 'dim') g.main.bindTooltip(nameTip(it), { permanent: true, direction: 'center', className: 'crName', interactive: false });
    g.extra.forEach(x => x.addTo(m)); g.main.addTo(m);
    g.main.on('click', e => { const t = MP().tool; if (t && t.click && drawing) { t.click(MP().toFt(e.latlng), e); return; } if (MP().tool && !drawing) return; select(it.id); });
    g.main.on('mousedown', e => { if (it.id === sel && !drawing && !MP().tool && e.originalEvent && e.originalEvent.button === 0 && !e.originalEvent.touches && it.type !== 'label') startBody(it, e); });
    return g;
  }
  function removeLayer(id) { const g = layers.get(id); if (!g) return; g.main.remove(); g.extra.forEach(x => x.remove()); layers.delete(id); }
  /* geometry only (a drag in progress): no new layers */
  function place(it) {
    const g = layers.get(it.id); if (!g) return;
    if (it.type === 'label') g.main.setLatLng(MP().toLL(it.pts[0]));
    else g.main.setLatLngs(lls(it.pts));
    if (g.buf) g.buf.setLatLngs(bufferLL(it));
    if (it.type === 'dim') { g.extra[0].setLatLng(MP().toLL({ x: (it.pts[0].x + it.pts[1].x) / 2, y: (it.pts[0].y + it.pts[1].y) / 2 })); g.extra[0].setIcon(dimIcon(it)); g.extra[1].setLatLng(MP().toLL(it.pts[0])); g.extra[2].setLatLng(MP().toLL(it.pts[1])); }
  }
  function renderAll() {
    if (!MP() || !MP().map) return;
    [...layers.keys()].forEach(removeLayer);
    A.P.items.forEach(it => layers.set(it.id, makeLayer(it)));
    drawHandles();
  }
  function renderOne(id) { const it = itemOf(id); removeLayer(id); if (it) layers.set(id, makeLayer(it)); }
  /* ---------- selection and handles ---------- */
  const vIcon = cls => L_().divIcon({ className: 'crVx ' + cls, html: '<span></span>', iconSize: [14, 14], iconAnchor: [7, 7] });
  function clearHandles() { handles.forEach(h => h.remove()); handles = []; }
  function drawHandles() {
    clearHandles();
    const it = itemOf(sel), m = MP() && MP().map; if (!it || !m || drawing) return;
    const Lf = L_(), T = M.TYPES[it.type], cl = closed(it);
    const live = () => MP().raf('item', () => { place(it); moveHandles(it); A.live('items', { id: it.id }); liveProps(it); });
    const done = () => { dragEnd = Date.now(); A.update(null, 'items', { id: it.id }); };
    it.pts.forEach((p, i) => {
      if (it.type === 'label') return;
      const h = Lf.marker(MP().toLL(p), { icon: vIcon('crVxP'), draggable: true, keyboard: false, zIndexOffset: 900, title: 'Drag to move this point; double-click to remove it' }).addTo(m);
      h.on('drag', () => { it.pts[i] = MP().toFt(h.getLatLng()); live(); }); h.on('dragend', done);
      h.on('dblclick', e => { L_().DomEvent.stop(e); if (it.pts.length > T.min && !T.max) { A.update(() => { it.pts.splice(i, 1); }, 'items', { id: it.id }); } });
      h._crKind = 'v'; h._crI = i; handles.push(h);
    });
    if (it.type !== 'label' && !T.max) {   // "+" between vertices (and closing edge of an area): drag to add a vertex
      const n = it.pts.length, segs = cl ? n : n - 1;
      for (let i = 0; i < segs; i++) {
        const a = it.pts[i], b = it.pts[(i + 1) % n];
        const h = Lf.marker(MP().toLL({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }), { icon: vIcon('crVxM'), draggable: true, keyboard: false, zIndexOffset: 800, title: 'Drag to add a point here' }).addTo(m);
        let k = -1;
        h.on('dragstart', () => { k = i + 1; it.pts.splice(k, 0, MP().toFt(h.getLatLng())); });
        h.on('drag', () => { it.pts[k] = MP().toFt(h.getLatLng()); MP().raf('item', () => { place(it); A.live('items', { id: it.id }); liveProps(it); }); });
        h.on('dragend', () => { done(); drawHandles(); });
        h._crKind = 'm'; h._crI = i; handles.push(h);
      }
    }
    if (it.type === 'label') return;   // dragged by its text
    const c = G.centroid(it.pts, cl);
    const mv = Lf.marker(MP().toLL(c), { icon: L_().divIcon({ className: 'crHandle crMove crItemMove', html: '<span title="Drag to move the item">✥</span>', iconSize: [26, 26], iconAnchor: [13, 13] }), draggable: true, keyboard: false, zIndexOffset: 1000 }).addTo(m);
    let p0 = null, f0 = null;
    mv.on('dragstart', () => { p0 = it.pts.map(p => ({ x: p.x, y: p.y })); f0 = MP().toFt(mv.getLatLng()); });
    mv.on('drag', () => { const f = MP().toFt(mv.getLatLng()), dx = f.x - f0.x, dy = f.y - f0.y; it.pts = p0.map(p => ({ x: p.x + dx, y: p.y + dy })); live(); });
    mv.on('dragend', () => { done(); });
    mv._crKind = 'c'; handles.push(mv);
  }
  function moveHandles(it) {   // during a drag: the other handles follow
    const n = it.pts.length, cl = closed(it);
    handles.forEach(h => {
      if (h.dragging && h.dragging._draggable && h.dragging._draggable._moving) return;
      if (h._crKind === 'v' && it.pts[h._crI]) h.setLatLng(MP().toLL(it.pts[h._crI]));
      else if (h._crKind === 'm') { const a = it.pts[h._crI], b = it.pts[(h._crI + 1) % n]; if (a && b) h.setLatLng(MP().toLL({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })); }
      else if (h._crKind === 'c') h.setLatLng(MP().toLL(it.type === 'label' ? it.pts[0] : G.centroid(it.pts, cl)));
    });
  }
  /* desktop: drag the selected item by its body */
  function startBody(it, e) {
    const m = MP().map; L_().DomEvent.stop(e.originalEvent); m.dragging.disable();
    const f0 = MP().toFt(e.latlng), p0 = it.pts.map(p => ({ x: p.x, y: p.y })); let movedAny = false;
    body = { it };
    const mvh = ev => { const f = MP().toFt(ev.latlng), dx = f.x - f0.x, dy = f.y - f0.y; movedAny = movedAny || Math.hypot(dx, dy) > 0; it.pts = p0.map(p => ({ x: p.x + dx, y: p.y + dy }));
      MP().raf('item', () => { place(it); moveHandles(it); A.live('items', { id: it.id }); liveProps(it); }); };
    const up = () => { dragEnd = Date.now(); m.off('mousemove', mvh); m.off('mouseup', up); document.removeEventListener('mouseup', up); m.dragging.enable(); body = null; if (movedAny) A.update(null, 'items', { id: it.id }); };
    m.on('mousemove', mvh); m.on('mouseup', up); document.addEventListener('mouseup', up);
  }
  function select(id, zoom) {
    if (drawing) return;
    const was = sel; sel = id && itemOf(id) ? id : null;
    if (sel && sel === was && !zoom) { A.showITab('draw'); return; }   // already selected: keep its handles (a double-click on a point needs them)
    if (was && was !== sel) renderOne(was);
    if (sel) renderOne(sel);
    drawHandles(); drawTab();
    if (sel) { A.showITab('draw'); if (zoom) { const it = itemOf(sel); A.showOTab('plan'); MP().fit(it.pts.length > 1 ? it.pts : [{ x: it.pts[0].x - 30, y: it.pts[0].y - 30 }, { x: it.pts[0].x + 30, y: it.pts[0].y + 30 }]); } }
    A.emit('change', { kind: 'select', id: sel });
  }
  /* ---------- drawing ---------- */
  let ghost = null;
  function setTool(k) {
    if (drawing) cancel(true);
    const t = TOOLS.find(x => x.k === k);
    if (!t || !MP() || !MP().map) { MP() && MP().setTool(null); bar(); return; }
    if (sel) { const w = sel; sel = null; renderOne(w); clearHandles(); }
    const tool = { cursor: 'crosshair', click: addPt, move: f => { if (drawing) { drawing.cur = f; ghostDraw(); } }, dbl: () => finish(), key: onKey, end: () => { if (MP().tool === tool) cancel(true); } };
    MP().setTool(tool);   // ends the tool before it (a sheet's point picking)
    drawing = { t, pts: [] };
    MP().map.getContainer().classList.add('crDrawing');
    A.showOTab('plan'); bar(); drawTab();
  }
  function addPt(f, e) {
    if (!drawing) return;
    const t = drawing.t, pts = drawing.pts;
    if (t.geom === 'polygon' && pts.length >= 3 && e && e.containerPoint) {   // a click on the first point closes the area
      const c0 = MP().map.latLngToContainerPoint(MP().toLL(pts[0])); if (c0.distanceTo(e.containerPoint) < 10) { finish(); return; }
    }
    const last = pts[pts.length - 1]; if (last && Math.hypot(last.x - f.x, last.y - f.y) < 1e-6) return;
    pts.push(f);
    if (t.geom === 'point' || (t.geom === 'dim' && pts.length === 2)) { finish(); return; }
    ghostDraw(); bar();
  }
  function ghostDraw() {
    if (!drawing) return; const m = MP().map, Lf = L_(), pts = drawing.pts.slice(); if (drawing.cur) pts.push(drawing.cur);
    if (ghost) { ghost.remove(); ghost = null; }
    if (!pts.length) return;
    const c = COL[drawing.t.type] || '#0F172A';
    ghost = Lf.layerGroup().addTo(m);
    (drawing.t.geom === 'polygon' && pts.length > 2 ? Lf.polygon(lls(pts), { color: c, weight: 2, dashArray: '5 4', fillOpacity: 0.08, interactive: false }) : Lf.polyline(lls(pts), { color: c, weight: 2, dashArray: '5 4', interactive: false })).addTo(ghost);
    drawing.pts.forEach(p => Lf.circleMarker(MP().toLL(p), { radius: 4, color: c, fillColor: '#fff', fillOpacity: 1, weight: 2, interactive: false }).addTo(ghost));
    if (drawing.cur && drawing.pts.length) { const a = drawing.pts[drawing.pts.length - 1], d = W.dim(a, drawing.cur, 'g'); MP().status(statusText() + `<br><span class="crLive">${fmt(d.L, 2)} ft · ${esc(d.bearing)}${drawing.pts.length > 1 ? ` · total ${fmt(G.polyLength(drawing.pts.concat([drawing.cur])), 1)} ft` : ''}</span>`); }
  }
  function statusText() {
    if (!drawing) return ''; const t = drawing.t, n = drawing.pts.length;
    const what = t.geom === 'point' ? 'click where the label goes' : t.geom === 'dim' ? `click point ${n + 1} of 2` : `click point ${n + 1}${t.geom === 'polygon' ? ' (a click on the first point closes the area)' : ''}; double-click, Enter or Finish ends it; Backspace removes the last point`;
    return `<b>${esc(t.label)}:</b> ${what}. Esc cancels.`;
  }
  function onKey(e) {
    if (!drawing) return;
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    else if (e.key === 'Enter') { e.preventDefault(); finish(); }
    else if (e.key === 'Backspace') { e.preventDefault(); drawing.pts.pop(); ghostDraw(); bar(); }
  }
  function cancel(quiet) {
    if (ghost) { ghost.remove(); ghost = null; }
    const was = !!drawing; drawing = null;
    if (MP() && MP().map) MP().map.getContainer().classList.remove('crDrawing');
    if (!quiet && MP()) MP().setTool(null);
    if (MP()) MP().status('');
    if (was) { bar(); drawTab(); }
  }
  function finish() {
    if (!drawing) return;
    const t = drawing.t, pts = drawing.pts.slice(), T = M.TYPES[t.type];
    const need = t.geom === 'polygon' ? 3 : T.min;
    if (pts.length < need) { MP().status(statusText() + `<br><span class="crLive">${need} points are needed.</span>`); return; }
    const n = A.P.items.filter(i => i.type === t.type).length + 1;
    const base = { obst: 'Obstruction', power: 'Power line', util: t.geom === 'polygon' ? 'Buried structure' : 'Utility', excl: 'Exclusion zone', label: 'Label', dim: 'Dimension' }[t.type];
    const it = M.normItem({ type: t.type, name: `${base} ${n}`, pts, closed: t.type === 'util' && t.geom === 'polygon', text: 'Label', size: 14 });
    drawing = null; if (ghost) { ghost.remove(); ghost = null; }
    MP().map.getContainer().classList.remove('crDrawing'); MP().setTool(null); MP().status('');
    A.update(P => { P.items.push(it); }, 'items', { id: it.id });
    select(it.id); bar();
    setTimeout(() => { const f = el && el.querySelector(it.type === 'label' ? '#itText' : '#itName'); if (f) { f.focus(); f.select && f.select(); } }, 0);
  }
  /* ---------- toolbar on the map ---------- */
  function bar() {
    const b = MP() && MP().bar(); if (!b) return;
    const act = drawing ? drawing.t.k : '';
    b.innerHTML = `<span class="tbLbl">Draw:</span>${TOOLS.map(t => `<button type="button" class="tbBtn${act === t.k ? ' on' : ''}" data-tool="${t.k}" title="${esc(t.tip)}" aria-pressed="${act === t.k}"><span aria-hidden="true">${t.icon}</span> ${esc(t.label)}</button>`).join('')}`
      + (drawing ? `<span class="tbSep"></span>${drawing.t.geom === 'polyline' || drawing.t.geom === 'polygon' ? '<button type="button" class="primary" data-tb="finish">Finish</button><button type="button" data-tb="back">Undo point</button>' : ''}<button type="button" data-tb="cancel">Cancel</button>` : '');
    if (drawing) MP().status(statusText());
  }
  function onBar(e) {
    const b = e.target.closest('[data-tool],[data-tb]'); if (!b) return;
    if (b.dataset.tool) { setTool(drawing && drawing.t.k === b.dataset.tool ? null : b.dataset.tool); return; }
    if (b.dataset.tb === 'finish') finish(); else if (b.dataset.tb === 'back') { if (drawing) { drawing.pts.pop(); ghostDraw(); bar(); } } else if (b.dataset.tb === 'cancel') { cancel(); }
  }
  /* ---------- the Site items tab ---------- */
  const numIn = (id, v, lbl, unit, hint) => `<div class="fRow"><label for="${id}">${lbl}</label><input type="text" inputmode="decimal" id="${id}" value="${v == null ? '' : v}" placeholder="${hint || ''}"><span class="unit">${unit}</span></div>`;
  function propsHtml(it) {
    const T = M.TYPES[it.type], z = G.zone(A.P.site.zone), u = z.unit === 'm' ? 'm' : 'ft';
    let h = `<div class="fRow"><label>Type</label><span>${esc(T.label)}${it.type === 'util' ? (it.closed ? ' (area)' : ' (line)') : ''}</span></div>
      <div class="fRow"><label for="itName">Name</label><input type="text" id="itName" value="${esc(it.name)}"></div>`;
    if (it.type === 'obst') h += numIn('itHeight', it.height, 'Height above grade', 'ft') + numIn('itTopEl', it.topEl, 'Top elevation', 'ft', 'optional') + numIn('itGrade', it.gradeEl, 'Grade elevation', 'ft', 'the crane pad');
    if (it.type === 'power') {
      const c = clearance(it);
      h += numIn('itKv', it.kv, 'Voltage', 'kV', 'from the utility') + `<label class="note" style="display:block"><input type="checkbox" id="itLe350" ${it.le350 ? 'checked' : ''} ${it.kv != null ? 'disabled' : ''}> Voltage not known; the utility says 350 kV or less</label>`
        + (it.kv > 1000 ? numIn('itSetFt', it.setFt, 'Clearance set by the utility / RPE', 'ft') : '')
        + numIn('itHeight', it.height, 'Lowest wire above grade', 'ft', 'not known: checked as a vertical plane') + numIn('itGrade', it.gradeEl, 'Grade elevation', 'ft', 'the crane pad')
        + numIn('itSag', it.sag, 'Sag allowance (wire lower by)', 'ft', '0') + numIn('itSway', it.sway, 'Sway allowance (sideways)', 'ft', '0')
        + `<div class="crOut${c.ok ? '' : ' bad'}" id="itClr"><b>Minimum clearance D<sub>min</sub> = ${isFinite(c.ft) ? fmt(c.ft, c.ft % 1 ? 1 : 0) + ' ft' : 'not set'}</b> <span class="note">${esc(c.basis)}</span><br><span class="note">${esc(c.note)} The buffer drawn is the plan (horizontal) distance; any part of the crane, load line or load must stay outside it in 3D. ${esc(c.ref)}.</span> <a href="#" class="wk" data-a="worked">worked: Site tab</a></div>`;
    }
    if (it.type === 'util') h += `<div class="fRow"><label for="itKind">Kind</label><select id="itKind">${Object.entries(M.UTIL_KINDS).map(([k, v]) => `<option value="${k}" ${it.kind === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>`
      + numIn('itDepth', it.depth, 'Depth to top below grade', 'ft') + numIn('itTopEl', it.topEl, 'Top elevation', 'ft', 'optional') + numIn('itSize', it.size, 'Size (diameter / width)', 'ft', 'optional')
      + '<p class="note">For the stress-at-depth checks under outriggers and mats (phase C4).</p>';
    if (it.type === 'excl') h += `<div class="fRow"><label for="itReason">Reason</label><input type="text" id="itReason" value="${esc(it.reason)}" placeholder="e.g. traffic lane, wetland, swing radius"></div>`;
    if (it.type === 'label') h += `<div class="fRow"><label for="itText">Text</label><input type="text" id="itText" value="${esc(it.text)}"></div>` + numIn('itSize', it.size, 'Text size', 'px');
    if (it.type !== 'label') h += `<div class="crOut" id="itMeas">${measHtml(it)}</div>`;
    h += `<details class="crVxList"${it.pts.length <= 4 ? ' open' : ''}><summary>Coordinates (${esc(z.short)}, ${u})</summary><div class="tscroll"><table class="tbl"><thead><tr><th>#</th><th>Easting</th><th>Northing</th></tr></thead><tbody>
      ${it.pts.map((p, i) => `<tr><td>${i + 1}</td><td><input type="text" inputmode="decimal" data-vx="${i}" data-c="E" aria-label="Point ${i + 1} easting" value="${G.ftToNative(z.id, p.x).toFixed(2)}"></td><td><input type="text" inputmode="decimal" data-vx="${i}" data-c="N" aria-label="Point ${i + 1} northing" value="${G.ftToNative(z.id, p.y).toFixed(2)}"></td></tr>`).join('')}</tbody></table></div></details>
      <div class="goRow"><button type="button" data-a="zoom">Show on the map</button><button type="button" class="danger" data-a="del">Delete</button></div>`;
    return h;
  }
  function measHtml(it) {
    if (it.type === 'dim') { const d = W.dim(it.pts[0], it.pts[1], 'x'); return `<b>L = ${fmt(d.L, 2)} ft</b>, bearing ${esc(d.bearing)} (azimuth ${fmt(d.az, 4)}°) <a href="#" class="wk" data-a="worked">worked: Site tab</a>`; }
    if (closed(it)) return `Area ${fmt(G.area(it.pts), 1)} ft² · perimeter ${fmt(G.perimeter(it.pts), 1)} ft <a href="#" class="wk" data-a="worked">worked: Site tab</a>`;
    return `Length ${fmt(G.polyLength(it.pts), 1)} ft <a href="#" class="wk" data-a="worked">worked: Site tab</a>`;
  }
  function liveProps(it) {   // during a drag: the computed values in the tab follow
    if (!el || it.id !== sel) return; const m = el.querySelector('#itMeas'); if (m) m.innerHTML = measHtml(it);
    const z = A.P.site.zone; el.querySelectorAll('[data-vx]').forEach(i => { const p = it.pts[+i.dataset.vx]; if (p && document.activeElement !== i) i.value = G.ftToNative(z, i.dataset.c === 'E' ? p.x : p.y).toFixed(2); });
  }
  function drawTab() {
    if (!el) return;
    const it = itemOf(sel), act = drawing ? drawing.t.k : '';
    const groups = Object.keys(M.TYPES).map(t => [t, A.P.items.filter(i => i.type === t)]).filter(g => g[1].length);
    el.innerHTML = `<div class="sec"><div class="secHead">Draw</div><div class="secBody"><div class="crTools">${TOOLS.map(t => `<button type="button" class="tbBtn${act === t.k ? ' on' : ''}" data-tool="${t.k}" title="${esc(t.tip)}"><span aria-hidden="true">${t.icon}</span> ${esc(t.label)}</button>`).join('')}</div>
        <p class="note">Click the points on the map; double-click or Enter ends a line or area. Click an item to select it, then drag its points, its ✥ handle${'ontouchstart' in window ? '' : ' or the item itself'} (a label: its text); double-click a point to remove it.</p></div></div>
      ${it ? `<div class="sec" id="itCard"><div class="secHead">Selected: ${esc(it.name || M.TYPES[it.type].label)}</div><div class="secBody">${propsHtml(it)}</div></div>` : ''}
      <div class="sec"><div class="secHead">Site items (${A.P.items.length})</div><div class="secBody">${groups.length ? groups.map(([t, list]) => `<div class="itGrp"><div class="itGrpH">${esc(M.TYPES[t].label)} (${list.length})</div>
        ${list.map(i => `<div class="itRow${i.id === sel ? ' on' : ''}"><button type="button" class="itSel" data-sel="${i.id}"><span class="sw" style="background:${colorOf(i)}"></span>${esc(i.type === 'label' ? i.text : i.name || M.TYPES[i.type].label)}</button><span class="itSum">${esc(summary(i))}</span><button type="button" class="itDel" data-del="${i.id}" title="Delete" aria-label="Delete ${esc(i.name)}">×</button></div>`).join('')}</div>`).join('') : '<p class="note">Nothing drawn yet.</p>'}</div></div>`;
  }
  function onTabClick(e) {
    const t = e.target.closest('[data-tool]'); if (t) { setTool(drawing && drawing.t.k === t.dataset.tool ? null : t.dataset.tool); return; }
    const s = e.target.closest('[data-sel]'); if (s) { select(s.dataset.sel, true); return; }
    const d = e.target.closest('[data-del]'); if (d) { del(d.dataset.del); return; }
    const a = e.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'worked') { e.preventDefault(); A.showOTab('site'); setTimeout(() => { const x = document.getElementById('site-it-' + sel); if (x) x.scrollIntoView({ block: 'start' }); }, 50); }
    if (a.dataset.a === 'zoom') select(sel, true);
    if (a.dataset.a === 'del') del(sel);
  }
  function onTabChange(e) {
    const it = itemOf(sel), t = e.target; if (!it) return;
    const num = () => { const v = G.parseNum(t.value); if (t.value.trim() === '') return null; if (!isFinite(v)) { t.classList.add('bad'); return undefined; } t.classList.remove('bad'); return v; };
    const set = (k, v) => { if (v === undefined) return; A.update(() => { it[k] = v; }, 'items', { id: it.id }); renderOne(it.id); drawHandles(); drawTab(); };
    if (t.id === 'itName') set('name', t.value);
    else if (t.id === 'itText') set('text', t.value || 'Label');
    else if (t.id === 'itReason') set('reason', t.value);
    else if (t.id === 'itKind') set('kind', t.value);
    else if (t.id === 'itLe350') set('le350', t.checked);
    else if (t.id === 'itKv') { const v = num(); if (v !== undefined && v !== null && v <= 0) { t.classList.add('bad'); return; } set('kv', v); }
    else if (['itHeight', 'itTopEl', 'itDepth', 'itSetFt', 'itGrade', 'itSag', 'itSway'].includes(t.id)) { const v = num(); if (v !== undefined && v !== null && v < 0 && t.id !== 'itTopEl' && t.id !== 'itGrade') { t.classList.add('bad'); return; } set({ itHeight: 'height', itTopEl: 'topEl', itDepth: 'depth', itSetFt: 'setFt', itGrade: 'gradeEl', itSag: 'sag', itSway: 'sway' }[t.id], v); }
    else if (t.id === 'itSize') { const v = num(); if (v === undefined) return; if (it.type === 'label') set('size', Math.max(8, Math.min(48, v || 14))); else set('size', v); }
    else if (t.dataset.vx != null) {
      const v = G.parseNum(t.value); if (!isFinite(v)) { t.classList.add('bad'); return; }
      const i = +t.dataset.vx, k = t.dataset.c === 'E' ? 'x' : 'y', ft = G.nativeToFt(A.P.site.zone, v);
      A.update(() => { it.pts[i] = Object.assign({}, it.pts[i], { [k]: ft }); }, 'items', { id: it.id }); place(it); drawHandles(); liveProps(it);
    }
  }
  function del(id) {
    const it = itemOf(id); if (!it) return;
    if (sel === id) { sel = null; clearHandles(); }
    A.update(P => { P.items = P.items.filter(i => i.id !== id); }, 'items');
    removeLayer(id); drawTab();
  }
  /* ---------- Site tab and Report ---------- */
  const typeRows = {
    obst: i => [i.name, fmt(i.height, 1), fmt(i.topEl, 2), fmt(G.area(i.pts), 1), fmt(G.perimeter(i.pts), 1)],
    power: i => { const c = clearance(i); return [i.name, i.kv != null ? fmt(i.kv, i.kv % 1 ? 1 : 0) : (i.le350 ? 'not known (≤ 350)' : 'not known'), c.band || c.basis, isFinite(c.ft) ? fmt(c.ft, c.ft % 1 ? 1 : 0) : 'not set', fmt(G.polyLength(i.pts), 1), fmt(i.height, 1)]; },
    util: i => [i.name, M.UTIL_KINDS[i.kind], i.closed ? 'area' : 'line', fmt(i.depth, 2), fmt(i.topEl, 2), fmt(i.size, 2), i.closed ? fmt(G.area(i.pts), 1) + ' ft²' : fmt(G.polyLength(i.pts), 1) + ' ft'],
    excl: i => [i.name, i.reason || '—', fmt(G.area(i.pts), 1), fmt(G.perimeter(i.pts), 1)],
    label: i => [i.text, `E ${fmt(G.ftToNative(A.P.site.zone, i.pts[0].x), 2)}, N ${fmt(G.ftToNative(A.P.site.zone, i.pts[0].y), 2)}`],
    dim: i => { const d = W.dim(i.pts[0], i.pts[1], 'x'); return [i.name, fmt(d.L, 2), d.bearing, fmt(d.az, 4)]; }
  };
  const typeHead = { obst: ['Name', 'Height (ft)', 'Top el. (ft)', 'Area (ft²)', 'Perimeter (ft)'], power: ['Name', 'Voltage (kV)', 'Table A row / basis', 'D_min (ft)', 'Length (ft)', 'Lowest wire (ft)'],
    util: ['Name', 'Kind', 'Shape', 'Depth to top (ft)', 'Top el. (ft)', 'Size (ft)', 'Length / area'], excl: ['Name', 'Reason', 'Area (ft²)', 'Perimeter (ft)'], label: ['Text', 'Position'], dim: ['Name', 'L (ft)', 'Bearing (grid)', 'Azimuth (°)'] };
  function itemSteps(i, pre) {
    if (i.type === 'label') return [];
    const out = [];
    if (i.type === 'power') out.push({ title: 'Minimum clearance (OSHA)', steps: clearance(i).steps.map(s => Object.assign({}, s, { id: pre + '.' + s.id })) });
    if (i.type === 'dim') out.push({ title: 'Distance and bearing', steps: W.dim(i.pts[0], i.pts[1], pre + '.dim').steps });
    else out.push({ title: closed(i) ? 'Area and perimeter' : 'Length', steps: W.shape(i.pts, closed(i), pre + '.geom').steps });
    return out;
  }
  const OSHA_NOTE = 'Power lines: 29 CFR 1926.1408 Table A (minimum clearance distances, paraphrased): up to 50 kV 10 ft; over 50 to 200 kV 15 ft; over 200 to 350 kV 20 ft; over 350 to 500 kV 25 ft; over 500 to 750 kV 35 ft; over 750 to 1,000 kV 45 ft; over 1,000 kV as set by the utility owner/operator or a registered professional engineer qualified in electrical transmission and distribution. The value after "to" is included in its row. Table A needs the line\'s voltage from the utility; without it, 1926.1408(a)(2)(ii) keeps everything 20 ft from a line of up to 350 kV and 1926.1409 makes that 50 ft over 350 kV (this tool: 50 ft unless the user states 350 kV or less). The plan buffer is the horizontal distance only; the clearance applies to any part of the equipment, load line or load.';
  window.CranePickSite && window.CranePickSite.section(P => {
    if (!P.items.length) return '<div class="sec"><div class="secHead">Site items</div><div class="secBody"><p class="note">Nothing drawn yet (Site items tab, or the Draw bar above the map).</p></div></div>';
    const S = window.CranePickSite;
    return `<div class="sec"><div class="secHead">Site items</div><div class="secBody">` + Object.keys(M.TYPES).map(t => {
      const list = P.items.filter(i => i.type === t); if (!list.length) return '';
      return `<h4 class="stH">${esc(M.TYPES[t].label)} (${list.length})</h4><div class="tscroll"><table class="tbl"><thead><tr>${typeHead[t].map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
        ${list.map(i => `<tr>${typeRows[t](i).map((c, k) => `<td${k && /^[\d,.\-—]+$/.test(String(c)) ? ' class="n"' : ''}>${k === 0 ? `<a href="#" data-goitem="${i.id}">${esc(c)}</a>` : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        ${list.map((i, k) => { const parts = itemSteps(i, `${t}${k + 1}`); return parts.length ? `<details class="crSteps" id="site-it-${i.id}"${t === 'power' || t === 'dim' ? ' open' : ''}><summary>${esc(i.name || M.TYPES[t].label)}: worked</summary>${parts.map(q => `<div class="note"><b>${esc(q.title)}</b></div>${S.steps(q.steps)}`).join('')}</details>` : ''; }).join('')}`;
    }).join('') + (P.items.some(i => i.type === 'power') ? `<p class="note">${esc(OSHA_NOTE)}</p>` : '') + '</div></div>';
  });
  /* the site plan as an SVG (Report figure): items in the grid frame, north up, with a scale bar */
  function planSvg(P) {
    const pts = []; P.items.forEach(i => { pts.push(...i.pts); if (i.type === 'power') { const c = clearance(i); if (isFinite(c.ft)) i.pts.forEach(p => { pts.push({ x: p.x - c.ft, y: p.y - c.ft }, { x: p.x + c.ft, y: p.y + c.ft }); }); } });
    if (!pts.length) return '';
    let x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x)), y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
    const span = Math.max(x1 - x0, y1 - y0, 20); const pad = span * 0.08; x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
    const Wd = 680, Ht = Math.max(240, Math.min(520, Wd * (y1 - y0) / Math.max(1e-9, x1 - x0))), k = Math.min(Wd / (x1 - x0), Ht / (y1 - y0));
    const X = x => ((x - x0) * k).toFixed(1), Y = y => (Ht - (y - y0) * k).toFixed(1), path = (ps, c) => ps.map((p, i) => (i ? 'L' : 'M') + X(p.x) + ' ' + Y(p.y)).join(' ') + (c ? ' Z' : '');
    const nice = v => { const e = Math.pow(10, Math.floor(Math.log10(v))); return [1, 2, 5, 10].map(m => m * e).filter(m => m <= v).pop() || e; }, sb = nice((x1 - x0) / 4);
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wd} ${Ht.toFixed(0)}" width="${Wd}" height="${Ht.toFixed(0)}" font-family="Arial, sans-serif" font-size="11"><rect width="100%" height="100%" fill="#fff" stroke="#94a3b8"/>`;
    P.items.forEach(i => { const c = colorOf(i);
      if (i.type === 'power') { const cl = clearance(i); if (isFinite(cl.ft)) s += `<path d="${G.bufferRings(i.pts, cl.ft, 36).map(r => path(r, true)).join(' ')}" fill="${c}" fill-opacity="0.15" fill-rule="nonzero" stroke="none"/>`; }
      if (i.type === 'label') { s += `<text x="${X(i.pts[0].x)}" y="${Y(i.pts[0].y)}" font-size="${Math.min(16, i.size)}" fill="#0f172a">${esc(i.text)}</text>`; return; }
      const cl = closed(i); s += `<path d="${path(i.pts, cl)}" fill="${cl ? c : 'none'}" fill-opacity="${cl ? 0.18 : 0}" stroke="${c}" stroke-width="${i.type === 'power' ? 2.5 : 1.8}"${i.type === 'util' || i.type === 'excl' ? ' stroke-dasharray="7 4"' : ''}/>`;
      const m = i.type === 'dim' ? { x: (i.pts[0].x + i.pts[1].x) / 2, y: (i.pts[0].y + i.pts[1].y) / 2 } : G.centroid(i.pts, cl);
      s += `<text x="${X(m.x)}" y="${Y(m.y)}" text-anchor="middle" dy="-4" fill="#0f172a">${esc(i.type === 'dim' ? fmt(G.dist(i.pts[0], i.pts[1]), 1) + ' ft' : i.name)}</text>`; });
    s += `<g transform="translate(${Wd - 30},34)"><path d="M0 -22 L7 4 L0 -2 L-7 4 Z" fill="#0f172a"/><text y="18" text-anchor="middle" font-weight="bold">N</text><text y="30" text-anchor="middle" font-size="9">(grid)</text></g>`;
    s += `<g transform="translate(14,${(Ht - 14).toFixed(0)})"><rect width="${(sb * k).toFixed(1)}" height="5" fill="#0f172a"/><text y="-4">${fmt(sb, 0)} ft</text></g></svg>`;
    return s;
  }
  window.CranePickReport && window.CranePickReport.add(P => {
    if (!P.items.length) return [];
    const subs = [{ id: 'plan', key: 'items-plan', title: 'Site plan', items: [{ type: 'figure', svg: planSvg(P), caption: 'Site items in the State Plane grid (north up). Power-line buffers: the OSHA minimum clearance in plan.' }] }];
    Object.keys(M.TYPES).forEach(t => {
      const list = P.items.filter(i => i.type === t); if (!list.length) return;
      const items = [{ type: 'table', head: typeHead[t], rows: list.map(i => typeRows[t](i).map(String)) }];
      if (t === 'power') items.push({ type: 'note', text: OSHA_NOTE });
      list.forEach((i, k) => itemSteps(i, `${t}${k + 1}`).forEach(q => items.push({ type: 'steps', scope: 'items', title: `${i.name || M.TYPES[t].label}: ${q.title}`, steps: q.steps })));
      subs.push({ id: t, key: 'items-' + t, title: M.TYPES[t].label + (list.length > 1 ? 's' : ''), items });
    });
    return [{ id: 'items', key: 'items', title: 'Site items', subs }];
  });
  /* ---------- wiring ---------- */
  function build(p) { el = p; p.addEventListener('click', onTabClick); p.addEventListener('change', onTabChange); drawTab(); }
  A.inTab({ id: 'draw', label: 'Site items', build });
  A.on('ready', () => { const b = MP() && MP().bar(); if (b) b.addEventListener('click', onBar); bar(); });
  A.on('project', () => { if (drawing) cancel(); if (sel && !itemOf(sel)) sel = null; renderAll(); drawTab(); });
  A.on('change', o => {
    if (o.kind === 'items') { if (sel && !itemOf(sel)) sel = null; if (!body) { const ids = new Set(A.P.items.map(i => i.id)); [...layers.keys()].forEach(id => { if (!ids.has(id)) removeLayer(id); });
      A.P.items.forEach(i => { if (!layers.has(i.id) || i.id === o.id) renderOne(i.id); else place(i); }); drawHandles(); } drawTab(); }
    else if (o.kind === 'site' || o.kind === 'sheets') { A.P.items.forEach(place); drawHandles(); if (o.kind === 'site') drawTab(); }
  });
  A.on('key', e => {
    if (drawing) return;   // the drawing tool's own keys (ui/map.js passes them)
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); del(sel); }
    else if (e.key === 'Escape' && sel) select(null);
  });
  A.on('tab', id => { if (id === 'plan' && MP() && MP().map) setTimeout(() => { A.P.items.forEach(place); drawHandles(); }, 0); });
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('[data-goitem]'); if (!a) return; e.preventDefault(); select(a.dataset.goitem, true); });
  /* a click on the empty map clears the selection */
  A.on('ready', () => { const m = MP() && MP().map; if (m) m.on('click', e => { const t = e.originalEvent && e.originalEvent.target;
    if (t && t.closest && t.closest('.leaflet-marker-icon')) return;   // a click on a handle or a label is not a click on the empty map
    if (!e._crTool && !MP().tool && !drawing && sel && Date.now() - dragEnd > 500) select(null); }); });
  window.CranePickDraw = { TOOLS, setTool, finish, cancel, select, del, get selected() { return sel; }, get drawing() { return drawing; }, renderAll, planSvg, summary, layers };
})();
