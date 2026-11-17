/* apps/crane-pick/ui/place.js — crane setups and picks on the map, live capacity (window.CranePickPlace). C2-2 (2026-11-16).
   Map: each setup is drawn to scale from its crane's plan dimensions (engine/lift.js footprint: carrier / carbody, crawler tracks or the
   outrigger beams and floats at the chart's spread, tail-swing circle, centre of rotation) and can be dragged (✥ on the centre of
   rotation) and rotated (↻ handle ahead of the carrier: the carrier heading). Each pick has a pick point (P) and a set point (S), both
   draggable, the boom lines from the centre of rotation, the swing path (shortest way by default) and live labels at the hook (radius,
   chart capacity, % of chart). Every drag updates the values once per animation frame (CranePickMap.raf) and is one undo step when it
   ends. Lifts input tab: the settings (thresholds, interpolation), the setups (chart group, boom length, mode, heading, position) and
   the picks (load, rigging, hook block, other deductions, swing direction, points) with the live card: results, plan-clearance flags and
   the worked steps (CLAUDE.md §6). */
(function () {
  'use strict';
  const A = window.CranePickApp, G = window.CranePickGeo, K = window.CranePickCranes, LF = window.CranePickLift, M = window.CranePickModel, esc = A.esc;
  const MP = () => window.CranePickMap, L_ = () => window.L;
  const fmt = (v, d) => (typeof v === 'number' && isFinite(v)) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const COLS = { ok: '#059669', caution: '#D97706', critical: '#EA580C', over: '#DC2626', np: '#DC2626' };
  let el = null, selU = null, selK = null, dragEnd = 0, stepsOpen = false, elevOpen = false;
  const layers = new Map();   // setup id -> { parts..., picks: Map(pick id -> layers) }
  const setupOf = id => (A.P.setups || []).find(u => u.id === id) || null;
  const pickOf = id => (A.P.picks || []).find(k => k.id === id) || null;
  const craneOf = u => { const c = u && A.P.cranes.find(x => x.id === u.craneId); return c ? c.def : null; };
  const picksOf = u => A.P.picks.filter(k => k.setupId === u.id);
  const S = () => LF.settingsOf(A.P);
  /* evaluate one pick (engine) */
  /* the evaluation of a pick is memoized for an unchanged state (a drag frame calls it for the map, the card and the lists; C3-2's 3D
     checks made it worth it): the key is the pick, its setup, the settings and a revision bumped by every change of the project */
  let rev = 0; const memo = new Map();
  function evalPick(k) {
    const u0 = setupOf(k.setupId), key = JSON.stringify([k, u0, A.P.lift, rev]); if (memo.has(key)) return memo.get(key);
    const ev = evalPick0(k); if (memo.size > 64) memo.clear(); memo.set(key, ev); return ev;
  }
  function evalPick0(k) {
    const u = setupOf(k.setupId), c = craneOf(u); if (!u || !c) return null;
    const ev = LF.evaluate(c, u, k, S(), 'k');
    const c3 = !!(window.CranePickElev && window.CranePickClear);
    ev.flags = LF.clearances(c, u, ev, A.P.items, { skip3d: c3 });
    if (window.CranePickElev) { ev.elev = window.CranePickElev.evaluate(c, u, k, ev, 'k.el'); ev.flags = ev.flags.concat(ev.elev.flags); }   // C3-1: heights
    if (c3) { ev.c3 = window.CranePickClear.check(c, u, k, ev, A.P.items, S(), 'k.c3'); ev.flags = ev.c3.flags.concat(ev.flags); }   // C3-2: 3D clearances (the plan-only power / exclusion / tail / boom-over flags replaced)
    if (window.CranePickGround) { ev.ground = window.CranePickGround.evaluate(c, u, k, A.P, 'k.gr'); ev.flags = ev.flags.concat(ev.ground.flags || []); }   // C4: float / track loads, mats, bearing, stress at depth
    if (window.CranePickTerrainUI) { ev.level = window.CranePickTerrainUI.levelOf(u); if (ev.level && ev.level.ok) ev.flags = ev.flags.concat(ev.level.flags || []); }   // C8: crane levelness on the preliminary terrain (USGS 3DEP)
    // QA 2026-11-17: a pick without its load reads "0.0 %, within the chart" (W = rigging + hook block + other only): say so (a check flag;
    // nothing computed changes). Decision (pending engineer review): a check (amber) flag, not a stop.
    if (!(typeof k.load === 'number' && k.load > 0)) ev.flags.unshift({ level: 'warn', text: `Load not entered: W = ${ev.W.toLocaleString('en-US')} lb (rigging, hook block and other deductions only), so the % of chart and the float / track loads are for an empty hook. Enter the load on the Lifts tab.` });
    return ev;
  }
  /* ---------- placing ---------- */
  function defaults(c) {
    const gs = K.groups(c); const gr = gs.find(g => g.configs['360'] && /outriggers-full|crawler/.test(g.configs['360'].support || '')) || gs[0];
    const cfg = gr ? (gr.configs['360'] || gr.configs[gr.zones[0]]) : null, ch = cfg && cfg.chart;
    const R = ch && ch.radii_ft.length ? ch.radii_ft[Math.floor(ch.radii_ft.length / 3)] : 30;
    return { group: gr ? gr.key : '', boom: ch && ch.boom_lengths_ft.length ? ch.boom_lengths_ft[0] : null, R };
  }
  function placeCrane(craneId, at) {
    const c = A.P.cranes.find(x => x.id === craneId); if (!c) return null;
    if (!MP() || !MP().map) { A.notice('The map is not available (the map libraries did not load).', 'err'); return null; }
    const ctr = at || MP().toFt(MP().map.getCenter()), d = defaults(c.def), n = A.P.setups.length + 1;
    const u = M.normSetup({ name: `Crane ${n}: ${K.name(c.def)}`, craneId, x: ctr.x, y: ctr.y, heading: 0, group: d.group, boom: d.boom });
    const k = M.normPick({ name: `Pick ${A.P.picks.length + 1}`, setupId: u.id, pick: { x: ctr.x + d.R, y: ctr.y }, set: { x: ctr.x, y: ctr.y + d.R }, load: null, rigging: null, hook: null, ded: null, swing: 'short' });
    A.update(P => { P.setups.push(u); P.picks.push(k); }, 'setups', { id: u.id });
    selU = u.id; selK = k.id; A.showOTab('plan'); A.showITab('lifts'); renderAll(); drawTab();
    MP().fit([{ x: ctr.x - d.R * 1.4, y: ctr.y - d.R * 1.4 }, { x: ctr.x + d.R * 1.4, y: ctr.y + d.R * 1.4 }]);
    return u.id;
  }
  function addPick(uid) {
    const u = setupOf(uid); if (!u) return; const d = defaults(craneOf(u)), h = (u.heading || 0) * Math.PI / 180;
    const k = M.normPick({ name: `Pick ${A.P.picks.length + 1}`, setupId: uid, pick: { x: u.x + d.R * Math.sin(h + Math.PI / 2), y: u.y + d.R * Math.cos(h + Math.PI / 2) }, set: { x: u.x + d.R * Math.sin(h), y: u.y + d.R * Math.cos(h) }, swing: 'short' });
    A.update(P => { P.picks.push(k); }, 'picks', { id: k.id }); selK = k.id; renderAll(); drawTab();
  }
  function delSetup(uid) { A.update(P => { P.setups = P.setups.filter(u => u.id !== uid); P.picks = P.picks.filter(k => k.setupId !== uid); }, 'setups'); if (selU === uid) { selU = null; selK = null; } renderAll(); drawTab(); }
  function delPick(kid) { A.update(P => { P.picks = P.picks.filter(k => k.id !== kid); }, 'picks'); if (selK === kid) selK = null; renderAll(); drawTab(); }
  /* ---------- map ---------- */
  const lls = pts => pts.map(p => MP().toLL(p));
  const hIcon = (cls, txt, tip) => L_().divIcon({ className: 'crHandle ' + cls, html: `<span title="${esc(tip)}">${txt}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
  function headPos(u, fp) { const f = fp.dims.body ? fp.dims.body.front : (fp.dims.crawler && fp.dims.crawler.length ? fp.dims.crawler.length / 2 : 10); return LF.toGrid(u, f + 6, 0); }
  function labelIcon(e, what) {
    const c = e.cls, t = e.look.ok ? `R ${fmt(e.R, 1)} ft<br>C ${fmt(e.C, 0)} lb · <b>${fmt(e.pct, 1)} %</b>` : `R ${fmt(e.R, 1)} ft<br><b>not permitted</b>`;
    return L_().divIcon({ className: 'crLiftLbl', html: `<span class="lv lv-${c}"><i>${what}</i> ${t}</span>`, iconSize: null, iconAnchor: [-14, 12] });
  }
  function removeSetupLayers(id) { const g = layers.get(id); if (!g) return; g.all.forEach(x => x.remove()); g.picks.forEach(pk => pk.all.forEach(x => x.remove())); layers.delete(id); }
  function renderAll() {
    if (!MP() || !MP().map) return;
    [...layers.keys()].forEach(removeSetupLayers);
    (A.P.setups || []).forEach(u => { if (craneOf(u)) layers.set(u.id, makeSetup(u)); });
  }
  /* 2026-11-17 (engineer request A): the crane symbol on the map (engine/cranegfx.js, the same geometry as the Drawings / DXF). The engine
     footprint layers above stay (body, tracks, floats, beams: clickable, and what the checks use); the symbol adds the rest, one multi-
     polygon and one multi-polyline per group (a fixed number of Leaflet layers, so a drag only moves points). The upperworks and boom turn
     to the setup's selected pick, else its first pick (the boom to the pick point, the load L × W at the hook); a setup without a pick
     shows the upperworks over the carrier front, no boom. Small zoom (tail-swing radius under 40 px on the screen): "simple" detail. */
  const CG = () => window.CranePickCraneGfx;
  const SYM_G = ['carrier', 'outrigger', 'upper', 'cwt', 'boom', 'hook', 'load'];
  function symOpt(u) {
    const ks = picksOf(u), k = ks.find(x => x.id === selK) || ks[0], m = MP().map, c = craneOf(u);
    const tail = (c && K.planDims(c).tail) || 15, lat = m ? m.getCenter().lat : 40, ftPx = 156543.03392804097 * Math.cos(lat * Math.PI / 180) / Math.pow(2, m ? m.getZoom() : 18) / 0.3048006;
    const e = k && k.elev, load = e && e.L > 0 && e.W > 0 ? { L: e.L, W: e.W } : null;
    return { hook: k ? k.pick : null, load, detail: tail / ftPx >= 40 ? 'full' : 'simple', labels: false };
  }
  function symGeo(u) {
    const c = craneOf(u), out = {}; SYM_G.forEach(g => { out[g] = { cl: [], op: [] }; }); if (!c || !CG()) return out;
    let s; try { s = CG().symbol(c, u, symOpt(u)); } catch (e) { console.error(e); return out; }
    s.parts.forEach(q => { if (q.src === 'fp' || !out[q.g]) return; if (q.closed) out[q.g].cl.push([lls(q.pts)]); else out[q.g].op.push(lls(q.pts)); });
    return out;
  }
  const SYM_STYLE = { carrier: ['#1E3A5F', '#64748B', 0.35], outrigger: ['#0E7490', '#0E7490', 0.45], upper: ['#166534', '#22C55E', 0.3], cwt: ['#5B21B6', '#7C3AED', 0.45], boom: ['#0F172A', '#CBD5E1', 0.55], hook: ['#B91C1C', '#DC2626', 0.6], load: ['#B91C1C', '#F87171', 0.25] };
  function makeSym(u, add, col) {
    const Lf = L_(), geo = symGeo(u), o = {};
    SYM_G.forEach(g => { const [st, fc, fo] = SYM_STYLE[g]; o[g] = { pg: add(Lf.polygon(geo[g].cl, { color: st, weight: 1.2, fillColor: fc, fillOpacity: fo, interactive: false, className: 'crSym crSym-' + g })),
      pl: add(Lf.polyline(geo[g].op, { color: st, weight: 1, interactive: false, className: 'crSym crSym-' + g })) }; });
    void col; return o;
  }
  function placeSym(u, o) { if (!o) return; const geo = symGeo(u); SYM_G.forEach(g => { o[g].pg.setLatLngs(geo[g].cl); o[g].pl.setLatLngs(geo[g].op); }); }
  function makeSetup(u) {
    const Lf = L_(), m = MP().map, c = craneOf(u), fp = LF.footprint(c, u), on = u.id === selU, col = on ? '#1E3A8A' : '#334155';
    const g = { all: [], picks: new Map(), fpn: fp.tracks.length + fp.floats.length + (fp.body ? 1 : 0) };
    const add = x => { x.addTo(m); g.all.push(x); return x; };
    const opt = { color: col, weight: on ? 2.5 : 1.8, fillColor: '#64748B', fillOpacity: 0.28, className: 'crCrane', bubblingMouseEvents: false };
    g.tail = isFinite(fp.tail) ? add(Lf.polygon(lls(LF.circle(u, fp.tail, 64)), { color: '#7C3AED', weight: 1.4, dashArray: '6 5', fill: false, interactive: false })) : null;
    g.body = fp.body ? add(Lf.polygon(lls(fp.body), opt)) : null;
    g.tracks = fp.tracks.map(t => add(Lf.polygon(lls(t), Object.assign({}, opt, { fillOpacity: 0.5 }))));
    g.beams = fp.beams.length ? add(Lf.polyline(fp.beams.map(lls), { color: col, weight: 3, interactive: false })) : null;
    g.floats = fp.floats.map(f => add(Lf.polygon(lls(f), Object.assign({}, opt, { fillColor: '#F59E0B', fillOpacity: 0.7 }))));
    g.front = add(Lf.polyline(lls([LF.toGrid(u, 0, 0), headPos(u, fp)]), { color: col, weight: 1.5, dashArray: '2 4', interactive: false }));
    g.sym = makeSym(u, add, col);   // 2026-11-17: the crane symbol (engine/cranegfx.js): axles / wheels / tracks, outrigger beams, the upperworks turned to the pick, boom, hook, load
    [g.body].concat(g.tracks, g.floats).filter(Boolean).forEach(x => x.on('click', () => select(u.id, null)));
    g.cor = add(Lf.marker(MP().toLL(u), { icon: hIcon('crCor', '✥', 'Drag to move the crane (centre of rotation)'), draggable: true, keyboard: false, zIndexOffset: 1000 }));
    g.cor.bindTooltip(esc(u.name), { direction: 'bottom', offset: [0, 14], className: 'crName' });
    g.head = add(Lf.marker(MP().toLL(headPos(u, fp)), { icon: hIcon('crRot', '↻', 'Drag to rotate the carrier (heading)'), draggable: true, keyboard: false, zIndexOffset: 1150 }));
    g.cor.on('click', () => select(u.id, null)); g.head.on('click', () => select(u.id, null));
    g.cor.on('drag', () => { const f = MP().toFt(g.cor.getLatLng()); u.x = f.x; u.y = f.y; liveSetup(u, 'cor'); });
    g.head.on('drag', () => { const f = MP().toFt(g.head.getLatLng()); if (Math.hypot(f.x - u.x, f.y - u.y) > 0.5) u.heading = G.azimuth(u, f); liveSetup(u, 'head'); });
    [g.cor, g.head].forEach(h => h.on('dragend', () => { dragEnd = Date.now(); A.update(null, 'lifts', { id: u.id }); placeSetup(u); }));
    picksOf(u).forEach(k => g.picks.set(k.id, makePick(u, k)));
    return g;
  }
  function makePick(u, k) {
    const Lf = L_(), m = MP().map, on = k.id === selK, pk = { all: [] }, add = x => { x.addTo(m); pk.all.push(x); return x; };
    pk.path = add(Lf.polyline([], { color: '#2563EB', weight: on ? 4 : 2.5, opacity: 0.85, interactive: false }));
    pk.bp = add(Lf.polyline([], { color: '#0F172A', weight: on ? 3 : 2, interactive: false }));
    pk.bs = add(Lf.polyline([], { color: '#0F172A', weight: 1.5, dashArray: '6 4', interactive: false }));
    pk.gov = add(Lf.circleMarker([0, 0], { radius: 6, color: '#DC2626', weight: 2, fill: false, interactive: false }));
    pk.c3 = add(Lf.layerGroup());   // C3-2: the 3D clearance flags (closest points, red / amber)
    const mk = (pos, t, tip) => add(Lf.marker(MP().toLL(pos), { icon: L_().divIcon({ className: 'crPt crPt' + t, html: `<span title="${esc(tip)}">${t}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] }), draggable: true, keyboard: false, zIndexOffset: 1100 }));
    pk.pm = mk(k.pick, 'P', `${k.name}: pick point (drag)`); pk.sm = mk(k.set, 'S', `${k.name}: set point (drag)`);
    pk.lp = add(Lf.marker([0, 0], { icon: Lf.divIcon({ className: 'crLiftLbl', html: '' }), interactive: false, keyboard: false, zIndexOffset: 1200 }));
    pk.ls = add(Lf.marker([0, 0], { icon: Lf.divIcon({ className: 'crLiftLbl', html: '' }), interactive: false, keyboard: false, zIndexOffset: 1200 }));
    pk.pm.on('drag', () => { k.pick = MP().toFt(pk.pm.getLatLng()); livePick(u, k); }); pk.sm.on('drag', () => { k.set = MP().toFt(pk.sm.getLatLng()); livePick(u, k); });
    [pk.pm, pk.sm].forEach(x => { x.on('dragend', () => { dragEnd = Date.now(); A.update(null, 'lifts', { id: k.id }); }); x.on('click', () => select(u.id, k.id)); });
    placePick(u, k, pk);
    return pk;
  }
  /* geometry and labels only (a drag in progress) */
  function placePick(u, k, pk) {
    const ev = evalPick(k); if (!ev) return null;
    pk.ev = ev;
    pk.path.setLatLngs(lls(ev.path.pts)); pk.path.setStyle({ color: COLS[ev.cls] || '#2563EB' });
    pk.bp.setLatLngs(lls([u, k.pick])); pk.bs.setLatLngs(lls([u, k.set]));
    if (ev.gov) pk.gov.setLatLng(MP().toLL(ev.gov.p));
    pk.gov.setStyle({ opacity: ev.gov && ev.gov !== ev.pick && ev.govWhere.indexOf('swing') >= 0 ? 1 : 0 });
    if (!(pk.pm.dragging && pk.pm.dragging._draggable && pk.pm.dragging._draggable._moving)) pk.pm.setLatLng(MP().toLL(k.pick));
    if (!(pk.sm.dragging && pk.sm.dragging._draggable && pk.sm.dragging._draggable._moving)) pk.sm.setLatLng(MP().toLL(k.set));
    drawC3(pk, ev);
    pk.lp.setLatLng(MP().toLL(k.pick)); pk.lp.setIcon(labelIcon(ev.pick, 'P')); pk.ls.setLatLng(MP().toLL(k.set)); pk.ls.setIcon(labelIcon(ev.set, 'S'));
    return ev;
  }
  /* C3-2: each red / amber 3D clearance: a marker at the closest point of the crane / load and a dashed line to the item's closest point */
  function drawC3(pk, ev) {
    pk.c3.clearLayers(); const Lf = L_();
    ((ev.c3 && ev.c3.flags) || []).filter(f => f.p && f.level !== 'info').forEach(f => {
      const col = f.level === 'stop' ? '#DC2626' : '#D97706', a = MP().toLL(f.p), b = MP().toLL(f.q);
      Lf.polyline([a, b], { color: col, weight: 2, dashArray: '3 3', interactive: false }).addTo(pk.c3);
      Lf.marker(a, { icon: Lf.divIcon({ className: 'crC3 crC3-' + f.level, html: `<span title="${esc(f.text)}">${f.level === 'stop' ? '!' : '▲'}</span>`, iconSize: [18, 18], iconAnchor: [9, 9] }), keyboard: false, zIndexOffset: 1050 }).addTo(pk.c3);
    });
  }
  function placeSetup(u) {
    const g = layers.get(u.id); if (!g) return; const c = craneOf(u), fp = LF.footprint(c, u);
    if (g.fpn !== fp.tracks.length + fp.floats.length + (fp.body ? 1 : 0)) { removeSetupLayers(u.id); layers.set(u.id, makeSetup(u)); return; }
    if (g.tail) g.tail.setLatLngs(lls(LF.circle(u, fp.tail, 64)));
    if (g.body && fp.body) g.body.setLatLngs(lls(fp.body));
    g.tracks.forEach((t, i) => t.setLatLngs(lls(fp.tracks[i]))); g.floats.forEach((t, i) => t.setLatLngs(lls(fp.floats[i])));
    if (g.beams) g.beams.setLatLngs(fp.beams.map(lls));
    g.front.setLatLngs(lls([LF.toGrid(u, 0, 0), headPos(u, fp)]));
    placeSym(u, g.sym);
    const mv = h => h.dragging && h.dragging._draggable && h.dragging._draggable._moving;
    if (!mv(g.cor)) g.cor.setLatLng(MP().toLL(u)); if (!mv(g.head)) g.head.setLatLng(MP().toLL(headPos(u, fp)));
    picksOf(u).forEach(k => { const pk = g.picks.get(k.id); if (pk) placePick(u, k, pk); });
  }
  function liveSetup(u, why) { MP().raf('lift', () => { placeSetup(u); A.live('lifts', { id: u.id, why }); liveCard(); liveSetupFields(u); }); }
  function livePick(u, k) { MP().raf('lift', () => { const g = layers.get(u.id), pk = g && g.picks.get(k.id); if (pk) placePick(u, k, pk); if (g) placeSym(u, g.sym); A.live('lifts', { id: k.id }); liveCard(); livePickFields(k); }); }
  /* ---------- selection ---------- */
  function select(uid, kid) {
    const was = [selU, selK]; selU = uid; selK = kid || (uid && uid !== was[0] ? (picksOf(setupOf(uid))[0] || {}).id || null : was[1]);
    if (selK && pickOf(selK) && pickOf(selK).setupId !== selU) selK = null;
    renderAll(); drawTab(); A.showITab('lifts'); A.emit('change', { kind: 'select-lift', id: selK || selU });
  }
  /* ---------- the Lifts tab ---------- */
  const numIn = (id, v, lbl, unit, o) => `<div class="fRow"><label for="${id}">${lbl}</label><input type="text" inputmode="decimal" id="${id}" value="${v == null ? '' : esc(String(v))}"${o && o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o && o.dis ? ' disabled' : ''}><span class="unit">${unit}</span></div>`;
  const cl = e => `<span class="lv lv-${e.cls}">${esc(LF.CLS[e.cls])}</span>`;
  function resHtml(k) {
    const ev = evalPick(k); if (!ev) return '<p class="note">The crane of this setup is not in the project.</p>';
    const s = S(), pt = (e, nm) => `<tr><td>${nm}</td><td class="n">${fmt(e.R, 2)}</td><td>${e.cfg ? esc(K.ZONES[e.cfg.zone] || e.cfg.zone) + (ev.chs.zoned ? ` (θ ${fmt(e.theta, 1)}°)` : '') : '—'}</td><td class="n">${e.look.ok ? fmt(e.look.Ltab, 1) + ' / ' + fmt(e.look.Rtab, 1) : '—'}</td><td class="n">${e.look.ok ? fmt(e.C, 0) : 'not permitted'}</td><td class="n">${e.look.ok ? fmt(e.pct, 1) : '—'}</td><td>${cl(e)}</td></tr>`;
    const notes = [].concat(ev.pick.look.notes || [], ev.set.look.notes || [], ev.gov.look.notes || []).filter((x, i, a) => a.indexOf(x) === i);
    const why = [ev.pick, ev.set, ev.gov].filter(e => !e.look.ok).map(e => e.look.why).filter((x, i, a) => a.indexOf(x) === i);
    const flags = ev.flags || [];
    return `<div class="crOut${ev.cls === 'over' || ev.cls === 'np' ? ' bad' : ''}" id="lfRes"><b>${esc(k.name)}: ${ev.cls === 'np' ? 'not permitted' : fmt(ev.gov.pct, 1) + ' % of chart'}</b> ${cl(ev.gov)} <span class="note">governing ${esc(ev.govWhere)}</span>
      <div class="tscroll"><table class="tbl lfTbl"><thead><tr><th></th><th>R (ft)</th><th>Zone</th><th>L / R tab (ft)</th><th>C (lb)</th><th>% chart</th><th></th></tr></thead><tbody>${pt(ev.pick, 'Pick')}${pt(ev.set, 'Set')}${pt(ev.gov, 'Governing')}</tbody></table></div>
      <div class="note">W = ${fmt(ev.W, 0)} lb · swing ${fmt(Math.abs(ev.path.d), 1)}° ${ev.path.d >= 0 ? 'clockwise' : 'counter-clockwise'} · R<sub>max</sub> = ${fmt(ev.path.Rmax, 2)} ft · boom ${fmt(setupOf(k.setupId).boom, 1)} ft · thresholds: caution ≥ ${s.caution} %, critical lift ≥ ${s.critical} %, limit ${s.limit} % · chart rated at ${esc(ev.pick.cfg ? K.ratingBasis(ev.pick.cfg, craneOf(setupOf(k.setupId))).text : '—')}</div>
      ${why.length ? `<div class="note warnT">Not permitted: ${why.map(esc).join('; ')}.</div>` : ''}${notes.length ? `<div class="note">${notes.map(esc).join(' ')}</div>` : ''}
      ${!ev.W ? '<div class="note warnT">Enter the load, rigging and hook block weights.</div>' : ''}${heightsHtml(ev)}
      ${flags.length ? `<ul class="lfFlags">${flags.map(f => `<li class="lf-${f.level}">${esc(f.text)}</li>`).join('')}</ul>` : '<div class="note">Clearances: no flags (power lines, exclusion zones, obstructions drawn on the Site items tab).</div>'}
      <details class="crSteps" id="lfSteps"${stepsOpen ? ' open' : ''}><summary>Worked steps</summary>${stepsHtml(ev)}</details></div>`;
  }
  function stepsHtml(ev) {
    const sx = window.CranePickSite ? window.CranePickSite.steps : (l => l.map(x => esc(x.label)).join('<br>'));
    return `<div class="note"><b>Total load</b></div>${sx(ev.Wsteps)}<div class="note"><b>Pick point</b></div>${sx(ev.pick.steps)}<div class="note"><b>Set point</b></div>${sx(ev.set.steps)}
      <div class="note"><b>Swing path</b></div>${sx(ev.path.steps)}${ev.govWhere.indexOf('swing') >= 0 ? `<div class="note"><b>Governing point (${esc(ev.govWhere)})</b></div>${sx(ev.gov.steps)}` : ''}${elevSteps(ev, sx)}`;
  }
  /* C3-1: heights (engine/elev.js): the live card line and the worked steps (crane geometry, pick, set, travel) */
  function elevSteps(ev, sx) {
    const h = ev.elev; if (!h) return '';
    return `<div class="note" id="lfElSteps"><b>Heights: crane geometry</b></div>${sx(h.geoSteps)}<div class="note"><b>Heights at the pick</b></div>${sx(h.pick.steps)}<div class="note"><b>Heights at the set</b></div>${sx(h.set.steps)}<div class="note"><b>Heights during the swing</b></div>${sx(h.trav.steps.concat(h.swing.steps))}`
      + ((ev.c3 && ev.c3.results) || []).map(r => `<div class="note"><b>3D clearance: ${esc(r.name)}</b></div>${sx(r.steps)}`).join('');
  }
  function heightsHtml(ev) {
    const h = ev.elev; if (!h) return '';
    const th = p => isFinite(p.ang.theta) && p.ang.theta != null ? fmt(p.ang.theta, 1) + '°' + (p.ang.used === 'chart' ? ' (chart)' : '') : '—', m = v => v == null ? '—' : v === -Infinity ? 'not reachable' : fmt(v, 2) + ' ft';
    return `<div class="note" id="lfHeights">Heights: boom angle ${th(h.pick)} at the pick / ${th(h.set)} at the set · tip el. ${fmt(h.pick.zTip, 2)} / ${fmt(h.set.zTip, 2)} ft · hook el. ${fmt(h.pick.zHk, 2)} / ${fmt(h.set.zHk, 2)} ft · load bottom el. ${fmt(h.pick.zLb, 2)} / ${fmt(h.set.zLb, 2)} ft (travel ${fmt(h.trav.z, 2)}) · hook reach margin ${m(h.pick.margin)} / ${m(h.set.margin)} / swing ${m(h.swing.min)}</div>`;
  }
  function liveCard() { if (!el) return; const k = pickOf(selK), x = el.querySelector('#lfLive'); if (k && x) x.innerHTML = resHtml(k); }
  function liveSetupFields(u) {
    if (!el || u.id !== selU) return; const z = A.P.site.zone, f = (id, v) => { const i = el.querySelector(id); if (i && document.activeElement !== i) i.value = v; };
    f('#luE', G.ftToNative(z, u.x).toFixed(2)); f('#luN', G.ftToNative(z, u.y).toFixed(2)); f('#luHead', (+u.heading).toFixed(1));
  }
  function livePickFields(k) {
    if (!el || k.id !== selK) return; const z = A.P.site.zone, f = (id, v) => { const i = el.querySelector(id); if (i && document.activeElement !== i) i.value = v; };
    f('#lkPE', G.ftToNative(z, k.pick.x).toFixed(2)); f('#lkPN', G.ftToNative(z, k.pick.y).toFixed(2)); f('#lkSE', G.ftToNative(z, k.set.x).toFixed(2)); f('#lkSN', G.ftToNative(z, k.set.y).toFixed(2));
  }
  function setupHtml(u) {
    const c = craneOf(u), gs = c ? K.groups(c) : [], gr = gs.find(g => g.key === u.group) || gs[0], z = G.zone(A.P.site.zone), un = z.unit === 'm' ? 'm' : 'ft';
    const cfgs = gr ? Object.values(gr.configs) : [], booms = [...new Set([].concat(...cfgs.map(g => g.chart.boom_lengths_ft)))].sort((a, b) => a - b);
    const modes = [...new Set([].concat(...cfgs.map(g => g.chart.column_modes || [])).join(',').split(',').filter(Boolean))];
    const p = c ? K.planDims(c) : null, any = gr && (gr.configs['360'] || gr.configs[gr.zones[0]]), sk = any && p ? K.spreadKey(any, p) : null;
    const sec = c && c.app_inputs && c.app_inputs.sectors || {};
    return `<div class="sec" id="luCard"><div class="secHead">Setup: ${esc(u.name)}</div><div class="secBody">
      <div class="fRow"><label for="luName">Name</label><input type="text" id="luName" value="${esc(u.name)}"></div>
      <div class="fRow"><label>Crane</label><span>${c ? esc(K.name(c)) + (c.preliminary ? ' <span class="chip chipW">PRELIMINARY</span>' : '') : '<span class="warnT">not in the project</span>'}</span></div>
      <div class="fRow"><label for="luGroup">Chart</label><select id="luGroup">${gs.map(g => `<option value="${esc(g.key)}"${gr && g.key === gr.key ? ' selected' : ''}>${esc(g.label)} [${g.zones.map(x => K.ZONES[x]).join(', ')}]</option>`).join('')}</select></div>
      ${gr && gr.zones.some(x => x !== '360') ? `<p class="note">Zone charts: ${gr.zones.map(x => esc(K.ZONES[x])).join(', ')}. Sectors (Cranes tab): over front ±${sec.front != null ? sec.front + '°' : ' not set'}, over rear ±${sec.rear != null ? sec.rear + '°' : ' not set'}; outside them: over side${gr.configs['360'] ? ' (the 360° chart)' : ''}.</p>` : ''}
      ${numIn('luBoom', u.boom, 'Boom length', 'ft', { ph: 'ft' })}<p class="note">Tabulated: ${booms.map(b => fmt(b, b % 1 ? 1 : 0)).join(', ') || '—'} ft (a length between them reads the next longer column).</p>
      ${modes.length ? `<div class="fRow"><label for="luMode">Telescoping mode</label><select id="luMode"><option value="">lowest of the columns</option>${modes.map(x => `<option${u.mode === x ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></div>` : ''}
      <div class="fRow"><label>Support</label><span>${esc(any ? any.support || '—' : '—')}${sk ? ` (spread ${esc(sk)} ${fmt(p.outr.spreads[sk], 2)} ft drawn)` : ''}</span></div>
      ${numIn('luPad', u.pad, 'Crane pad elevation', 'ft', { ph: 'not entered: 0.00 (datum)' })}
      ${numIn('luHead', (+u.heading).toFixed(1), 'Carrier heading', '° (az.)')}${numIn('luE', G.ftToNative(z.id, u.x).toFixed(2), 'Rotation E', un)}${numIn('luN', G.ftToNative(z.id, u.y).toFixed(2), 'Rotation N', un)}
      <p class="note">On the map: drag ✥ to move the crane, ↻ to turn it.</p>
      <div class="goRow"><button type="button" data-la="addPick">Add a pick</button><button type="button" data-la="zoomU">Show on the map</button><button type="button" class="danger" data-la="delU">Remove setup</button></div>
      <div class="itGrp"><div class="itGrpH">Picks (${picksOf(u).length})</div>${picksOf(u).map(k => `<div class="itRow${k.id === selK ? ' on' : ''}"><button type="button" class="itSel" data-selk="${k.id}">${esc(k.name)}</button><span class="itSum">${sumText(k)}</span><button type="button" class="itDel" data-delk="${k.id}" aria-label="Delete ${esc(k.name)}">×</button></div>`).join('')}</div></div></div>`;
  }
  function sumText(k) { const ev = evalPick(k); return ev ? (ev.cls === 'np' ? 'not permitted' : fmt(ev.gov.pct, 1) + ' %') : ''; }
  function pickHtml(k) {
    const u = setupOf(k.setupId), c = craneOf(u), hb = c ? K.hookBlocks(c) : [], z = G.zone(A.P.site.zone), un = z.unit === 'm' ? 'm' : 'ft';
    const hsel = hb.findIndex(h => h.lb === k.hook && h.label === k.hookLabel);
    return `<div class="sec" id="lkCard"><div class="secHead">Pick: ${esc(k.name)}</div><div class="secBody">
      <div class="fRow"><label for="lkName">Name</label><input type="text" id="lkName" value="${esc(k.name)}"></div>
      ${numIn('lkLoad', k.load, 'Load', 'lb')}${numIn('lkRig', k.rigging, 'Rigging (slings, spreader…)', 'lb')}
      <div class="fRow"><label for="lkHookSel">Hook block</label><select id="lkHookSel"><option value="">entered below</option>${hb.map((h, i) => `<option value="${i}"${i === hsel ? ' selected' : ''}>${esc(h.label)} (${fmt(h.lb, 0)} lb)</option>`).join('')}</select></div>
      ${numIn('lkHook', k.hook, 'Hook block weight', 'lb')}${numIn('lkDed', k.ded, 'Other deductions', 'lb', { ph: 'per the chart notes' })}
      <div class="fRow"><label for="lkDedNote">What they are</label><input type="text" id="lkDedNote" value="${esc(k.dedNote)}" placeholder="e.g. stowed jib, headache ball"></div>
      ${c && (c.configs || []).length ? `<p class="note">Chart deductions: ${esc([...new Set((c.configs || []).map(g => g.deductions && g.deductions.rule).filter(Boolean))].join(' / ') || 'not stated')}</p>` : ''}
      <div class="fRow"><label>Swing</label><span id="lkSwing">${[['short', 'shortest'], ['cw', 'clockwise'], ['ccw', 'counter-clockwise']].map(([v, t]) => `<label style="margin-right:8px"><input type="radio" name="lkSwing" value="${v}"${k.swing === v ? ' checked' : ''}> ${t}</label>`).join('')}</span></div>
      ${heightsIn(k, u)}
      ${numIn('lkPE', G.ftToNative(z.id, k.pick.x).toFixed(2), 'Pick E', un)}${numIn('lkPN', G.ftToNative(z.id, k.pick.y).toFixed(2), 'Pick N', un)}${numIn('lkSE', G.ftToNative(z.id, k.set.x).toFixed(2), 'Set E', un)}${numIn('lkSN', G.ftToNative(z.id, k.set.y).toFixed(2), 'Set N', un)}
      <div id="lfLive">${resHtml(k)}</div>
      <div class="goRow"><a href="#" class="wk" data-la="picksTab">all picks: Picks tab</a> <a href="#" class="wk" data-la="rptPick">worked: Report</a></div></div></div>`;
  }
  /* C3-1: the pick's heights (pick.elev; engine/elev.js). Elevations in ft whatever the zone's plan unit. */
  function heightsIn(k, u) {
    const E = window.CranePickElev ? window.CranePickElev.el0(k) : (k.elev || {}), pad = u && u.pad != null ? fmt(u.pad, 2) : '0.00';
    return `<details class="crSteps" id="lkElev"${elevOpen ? ' open' : ''}><summary>Heights (elevation, hook reach; ft)</summary>
      ${numIn('lkPg', E.pg, 'Ground el. at the pick', 'ft', { ph: 'pad ' + pad })}${numIn('lkPh', E.ph, 'Load bottom above that ground', 'ft', { ph: '0' })}
      ${numIn('lkSg', E.sg, 'Ground el. at the set', 'ft', { ph: 'pad ' + pad })}${numIn('lkSh', E.sh, 'Load bottom above that ground', 'ft', { ph: '0 (e.g. bearing seat height)' })}
      ${numIn('lkLH', E.H, 'Load height H', 'ft', { ph: '0' })}${numIn('lkLL', E.L, 'Load length L', 'ft', { ph: '0 (3D, C3-2)' })}${numIn('lkLW', E.W, 'Load width W', 'ft', { ph: '0 (3D, C3-2)' })}
      ${numIn('lkRigH', E.rig, 'Rigging height (hook to load top)', 'ft', { ph: '0' })}${numIn('lkBlk', E.blk, 'Hook block height (hook to block top)', 'ft', { ph: '0' })}
      ${numIn('lkTrav', E.trav, 'Load bottom el. during the swing', 'ft', { ph: 'higher of pick / set' })}</details>`;
  }
  function drawTab() {
    if (!el) return;
    if (selU && !setupOf(selU)) selU = null; if (selK && !pickOf(selK)) selK = null;
    const s = S(), u = setupOf(selU), k = pickOf(selK);
    const anyInterp = (A.P.setups || []).some(x => { const c = craneOf(x); return c && LF.chartsOf(c, x).gr && Object.values(LF.chartsOf(c, x).gr.configs).some(K.interpPermitted); });
    el.innerHTML = `<div class="sec"><div class="secHead">Lift settings (project)</div><div class="secBody">
        ${numIn('lsCaution', s.caution, 'Caution at (% of chart)', '%')}${numIn('lsCritical', s.critical, 'Critical lift at (% of chart)', '%')}${numIn('lsLimit', s.limit, 'Limit (% of chart)', '%')}
        <label class="note" style="display:block"><input type="checkbox" id="lsInterp"${s.interp ? ' checked' : ''}${anyInterp || s.interp ? '' : ' disabled'}> Linear interpolation between tabulated radii where the chart notes permit it${anyInterp ? '' : ' (no chart in use permits it)'}</label>
        <p class="note">Default (conservative): no interpolation: the next longer tabulated boom length and the next larger tabulated radius; outside the chart = not permitted. Each chart's rating basis (% of tipping) is on the Cranes tab.</p>
        <div class="fRow"><label for="lsPath">Path model</label><select id="lsPath"><option value="uniform"${s.path === 'uniform' ? ' selected' : ''}>uniform: radius changes with the swing angle (default)</option><option value="luff"${s.path === 'luff' ? ' selected' : ''}>luff at the pick, then swing at the set radius</option></select></div>
        ${numIn('lsObst', s.obstClr, 'Clearance to obstructions', 'ft')}
        <p class="note">3D clearances: power lines to 29 CFR 1926.1408 D_min (boom, load line, load, counterweight); obstructions: contact red, closer than the clearance above amber; exclusion zones in plan.</p></div></div>
      <div class="sec"><div class="secHead">Crane setups (${A.P.setups.length})</div><div class="secBody">
        ${A.P.cranes.length ? `<div class="goRow"><select id="luNew" aria-label="Crane to place">${A.P.cranes.map(c => `<option value="${c.id}">${esc(K.name(c.def))}</option>`).join('')}</select><button type="button" class="primary" data-la="place">Place at the map centre</button></div>` : '<p class="note">Add a crane to the project first (Cranes tab).</p>'}
        ${A.P.setups.map(x => `<div class="itRow${x.id === selU ? ' on' : ''}"><button type="button" class="itSel" data-selu="${x.id}">${esc(x.name)}</button><span class="itSum">${picksOf(x).length} pick${picksOf(x).length === 1 ? '' : 's'}</span><button type="button" class="itDel" data-delu="${x.id}" aria-label="Remove ${esc(x.name)}">×</button></div>`).join('')}</div></div>
      ${u ? setupHtml(u) : ''}${k ? pickHtml(k) : ''}`;
  }
  function onClick(e) {
    const t = e.target.closest('[data-la],[data-selu],[data-delu],[data-selk],[data-delk]'); if (!t) return;
    if (t.dataset.selu) { select(t.dataset.selu, null); return; }
    if (t.dataset.delu) { delSetup(t.dataset.delu); return; }
    if (t.dataset.selk) { select(selU, t.dataset.selk); return; }
    if (t.dataset.delk) { delPick(t.dataset.delk); return; }
    const a = t.dataset.la;
    if (a === 'place') placeCrane(el.querySelector('#luNew').value);
    else if (a === 'addPick') addPick(selU);
    else if (a === 'delU') delSetup(selU);
    else if (a === 'zoomU') zoomTo(selU);
    else if (a === 'picksTab') { e.preventDefault(); A.showOTab(window.CranePickPicks ? 'picks' : 'plan'); }
    else if (a === 'rptPick') { e.preventDefault(); if (window.CranePickPicks && selK) window.CranePickPicks.gotoReport(selK); }
  }
  function zoomTo(uid) { const u = setupOf(uid); if (!u) return; A.showOTab('plan'); const pts = [u].concat(...picksOf(u).map(k => [k.pick, k.set])); const r = Math.max(30, ...pts.map(p => G.dist(u, p))); MP().fit([{ x: u.x - r, y: u.y - r }, { x: u.x + r, y: u.y + r }]); }
  function onChange(e) {
    const t = e.target, u = setupOf(selU), k = pickOf(selK), z = A.P.site.zone;
    const num = () => { if (t.value.trim() === '') return null; const v = G.parseNum(t.value); if (!isFinite(v)) { t.classList.add('bad'); return undefined; } t.classList.remove('bad'); return v; };
    const up = (fn, kind, id) => { A.update(fn, kind, { id }); renderAll(); drawTab(); };
    if (t.id === 'lsCaution' || t.id === 'lsCritical' || t.id === 'lsLimit') { const v = num(); if (v === undefined || v === null || !(v > 0 && v <= 200)) { t.classList.add('bad'); return; } up(P => { P.lift[{ lsCaution: 'caution', lsCritical: 'critical', lsLimit: 'limit' }[t.id]] = v; }, 'lifts'); return; }
    if (t.id === 'lsInterp') { up(P => { P.lift.interp = t.checked; }, 'lifts'); return; }
    if (t.id === 'lsPath') { up(P => { P.lift.path = t.value === 'luff' ? 'luff' : 'uniform'; }, 'lifts'); return; }   // C3-2
    if (t.id === 'lsObst') { const v = num(); if (v === undefined || v === null || v < 0) { t.classList.add('bad'); return; } up(P => { P.lift.obstClr = v; }, 'lifts'); return; }
    if (u) {
      if (t.id === 'luName') return up(() => { u.name = t.value || 'Crane setup'; }, 'setups', u.id);
      if (t.id === 'luGroup') return up(() => { u.group = t.value; u.mode = null; }, 'setups', u.id);
      if (t.id === 'luMode') return up(() => { u.mode = t.value || null; }, 'setups', u.id);
      if (t.id === 'luBoom') { const v = num(); if (v === undefined || (v !== null && v <= 0)) { t.classList.add('bad'); return; } return up(() => { u.boom = v; }, 'setups', u.id); }
      if (t.id === 'luPad') { const v = num(); if (v === undefined) return; return up(() => { u.pad = v; }, 'setups', u.id); }
      if (t.id === 'luHead') { const v = num(); if (v == null) { t.classList.add('bad'); return; } return up(() => { u.heading = ((v % 360) + 360) % 360; }, 'setups', u.id); }
      if (t.id === 'luE' || t.id === 'luN') { const v = num(); if (v == null) { t.classList.add('bad'); return; } return up(() => { u[t.id === 'luE' ? 'x' : 'y'] = G.nativeToFt(z, v); }, 'setups', u.id); }
    }
    if (k) {
      if (t.id === 'lkName') return up(() => { k.name = t.value || 'Pick'; }, 'picks', k.id);
      const w = { lkLoad: 'load', lkRig: 'rigging', lkHook: 'hook', lkDed: 'ded' }[t.id];
      if (w) { const v = num(); if (v === undefined || (v !== null && v < 0)) { t.classList.add('bad'); return; } return up(() => { k[w] = v; if (w === 'hook') k.hookLabel = v == null ? '' : 'entered'; }, 'picks', k.id); }
      if (t.id === 'lkHookSel') { const c = craneOf(setupOf(k.setupId)), h = c && K.hookBlocks(c)[+t.value]; if (t.value === '' || !h) return; return up(() => { k.hook = h.lb; k.hookLabel = h.label; }, 'picks', k.id); }
      if (t.id === 'lkDedNote') return up(() => { k.dedNote = t.value; }, 'picks', k.id);
      const h = { lkPg: 'pg', lkPh: 'ph', lkSg: 'sg', lkSh: 'sh', lkLH: 'H', lkLL: 'L', lkLW: 'W', lkRigH: 'rig', lkBlk: 'blk', lkTrav: 'trav' }[t.id];   // C3-1
      if (h) { const v = num(); if (v === undefined || (v !== null && v < 0 && ['pg', 'sg', 'trav'].indexOf(h) < 0)) { t.classList.add('bad'); return; } return up(() => { k.elev = Object.assign({}, k.elev, { [h]: v }); }, 'picks', k.id); }
      if (t.name === 'lkSwing') return up(() => { k.swing = t.value; }, 'picks', k.id);
      const c = { lkPE: ['pick', 'x'], lkPN: ['pick', 'y'], lkSE: ['set', 'x'], lkSN: ['set', 'y'] }[t.id];
      if (c) { const v = num(); if (v == null) { t.classList.add('bad'); return; } return up(() => { k[c[0]] = Object.assign({}, k[c[0]], { [c[1]]: G.nativeToFt(z, v) }); }, 'picks', k.id); }
    }
  }
  /* ---------- wiring ---------- */
  function build(p) { el = p; p.addEventListener('click', onClick); p.addEventListener('change', onChange); p.addEventListener('toggle', e => { if (e.target.id === 'lfSteps') stepsOpen = e.target.open; if (e.target.id === 'lkElev') elevOpen = e.target.open; }, true); drawTab(); }
  A.inTab({ id: 'lifts', label: 'Lifts', build, show: drawTab });
  A.on('project', () => { rev++; renderAll(); drawTab(); });
  ['change', 'live'].forEach(e => A.on(e, o => { if (!(o && o.kind === 'lifts')) rev++; }));   // pick / setup drags change the memo key themselves
  A.on('change', o => {
    if (['lifts', 'setups', 'picks', 'cranes', 'items', 'site'].indexOf(o.kind) < 0) return;
    if (o.kind === 'lifts' && Date.now() - dragEnd < 400) { (A.P.setups || []).forEach(placeSetup); drawTab(); return; }   // a drag ended: geometry is in place
    renderAll(); drawTab();
  });
  A.on('live', o => { if (o.kind === 'items') (A.P.setups || []).forEach(u => { const g = layers.get(u.id); if (g) picksOf(u).forEach(k => { const pk = g.picks.get(k.id); if (pk) placePick(u, k, pk); }); }); });
  A.on('tab', id => { if (id === 'plan') setTimeout(() => (A.P.setups || []).forEach(placeSetup), 0); });
  A.on('ready', () => { const m = MP() && MP().map; if (m) m.on('zoomend', () => (A.P.setups || []).forEach(u => { const g = layers.get(u.id); if (g) placeSym(u, g.sym); })); });   // detail by zoom
  window.CranePickPlace = { placeCrane, addPick, select, evalPick, delSetup, delPick, renderAll, layers, get selected() { return { setup: selU, pick: selK }; } };
})();
