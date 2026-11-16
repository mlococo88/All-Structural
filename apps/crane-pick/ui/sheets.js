/* apps/crane-pick/ui/sheets.js — plan-sheet underlays (window.CranePickSheets). C1-2 (2026-11-16).
   A PNG / JPG, or a PDF page rendered with pdf.js 3.11.174 (loaded on first use from jsDelivr, pinned; isEvalSupported false), is placed
   on the map under the drawn items. Its placement (engine/geo.js: grid ft of pixel (0, 0), ft per pixel, rotation) is set by
   - dragging its move handle (and its rotate handle) while it is not locked,
   - scale calibration: two points picked on the sheet and the real distance between them (s = D / d_px, about their midpoint),
   - the plan's stated scale on a PDF's page size (s = S · W_in / W_px; to be checked with a known dimension),
   - georeference: two points picked on the sheet and their State Plane coordinates (scale, rotation, position; optionally the items
     drawn on the sheet move with it).
   The image is kept in IndexedDB (ui/sheetstore.js); the project keeps the placement and calibration. A sheet whose image is not in this
   browser (a project from GitHub or another computer) shows its outline and asks for the file again; the calibration is kept.
   Drawn as an <img> in its own map pane with a CSS matrix from three corners (updated per animation frame while dragging). */
(function () {
  'use strict';
  const A = window.CranePickApp, G = window.CranePickGeo, M = window.CranePickModel, ST = window.CranePickSheetStore, W = window.CranePickWorked, esc = A.esc;
  const MP = () => window.CranePickMap;
  const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js', PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  const BIG = 15 * 1024 * 1024;
  const urls = new Map();     // sheet id -> object URL | null (not in this browser) ; absent = not looked up yet
  const lay = new Map();      // sheet id -> { img, foot (L.polygon) }
  let el = null, pane = null, sel = null, pick = null, pend = null, handles = [], missingTold = new Set(), memTold = false;
  const sheetOf = id => A.P.sheets.find(s => s.id === id) || null;
  const fmt = (v, d) => Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const deg = r => r * 180 / Math.PI;
  /* ---------- images ---------- */
  function lookUp(id) {
    if (urls.has(id)) return; urls.set(id, undefined);
    ST.get(id).then(rec => { urls.set(id, rec && rec.blob ? URL.createObjectURL(rec.blob) : null); sync(); drawTab(); tellMissing(); });
  }
  function tellMissing() {
    if (!A.P.sheets.some(s => urls.get(s.id) === null)) { const o = document.getElementById('shMissing'); if (o) o.remove(); }
    const miss = A.P.sheets.filter(s => urls.get(s.id) === null && !missingTold.has(s.id)); if (!miss.length) return;
    miss.forEach(s => missingTold.add(s.id));
    A.notice(`Plan sheet${miss.length > 1 ? 's' : ''} ${miss.map(s => '"' + esc(s.name) + '"').join(', ')} ${miss.length > 1 ? 'are' : 'is'} not stored in this browser (a project opened from GitHub, a file without images, or another computer): load the file again on the Plan sheets tab (Reload image…). The placement and calibration are kept.`, 'warn',
      { id: 'shMissing', buttons: [{ label: 'Plan sheets tab', run: () => A.showITab('sheets') }] });
  }
  async function dims(blob) {
    if (window.createImageBitmap) { try { const b = await createImageBitmap(blob); const r = { w: b.width, h: b.height }; b.close && b.close(); return r; } catch (e) { /* below */ } }
    return new Promise((res, rej) => { const u = URL.createObjectURL(blob), i = new Image(); i.onload = () => { res({ w: i.naturalWidth, h: i.naturalHeight }); URL.revokeObjectURL(u); }; i.onerror = () => { URL.revokeObjectURL(u); rej(new Error('the image could not be read')); }; i.src = u; });
  }
  let pdfP = null;
  function pdfLib() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfP) return pdfP;
    pdfP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = PDFJS; s.onload = () => { if (!window.pdfjsLib) { rej(new Error('pdf.js did not load')); return; } window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; res(window.pdfjsLib); };
      s.onerror = () => { pdfP = null; rej(new Error('pdf.js could not be loaded from cdn.jsdelivr.net (no internet?). Save the PDF page as PNG or JPG and load that instead')); }; document.head.appendChild(s); });
    return pdfP;
  }
  /* ---------- the map layers ---------- */
  function ensurePane() {
    const m = MP() && MP().map; if (!m) return null;
    if (!pane) {
      pane = m.createPane('crSheets'); pane.style.zIndex = 250; pane.style.pointerEvents = 'none';
      m.on('zoomanim', e => A.P.sheets.forEach(s => position(s, e)));
      m.on('zoomend viewreset', () => A.P.sheets.forEach(s => position(s)));
    }
    return m;
  }
  function corners(s) { return [[0, 0], [s.w, 0], [s.w, s.h], [0, s.h]].map(([x, y]) => MP().toLL(G.pxToFt(s.place, x, y))); }
  function position(s, anim) {
    const L = lay.get(s.id), m = MP().map; if (!L || !m) return;
    const c = corners(s); L.foot.setLatLngs(c);
    if (!L.img) return;
    const pt = anim ? ll => m._latLngToNewLayerPoint(ll, anim.zoom, anim.center) : ll => m.latLngToLayerPoint(ll);
    const p0 = pt(c[0]), px = pt(c[1]), py = pt(c[3]);
    const a = { x: (px.x - p0.x) / s.w, y: (px.y - p0.y) / s.w }, b = { x: (py.x - p0.x) / s.h, y: (py.y - p0.y) / s.h };
    L.img.style.transform = `matrix(${a.x},${a.y},${b.x},${b.y},${p0.x},${p0.y})`;
  }
  function sync() {
    const m = ensurePane(); if (!m) return;
    const Lf = window.L, ids = new Set(A.P.sheets.map(s => s.id));
    [...lay.keys()].forEach(id => { if (!ids.has(id)) { const L = lay.get(id); if (L.img) L.img.remove(); L.foot.remove(); lay.delete(id); } });
    A.P.sheets.forEach((s, i) => {
      lookUp(s.id);
      let L = lay.get(s.id);
      if (!L) { L = { img: null, foot: Lf.polygon([], { interactive: false, weight: 1.5, fill: false }).addTo(m) }; lay.set(s.id, L); }
      const u = urls.get(s.id);
      if (u && !L.img) { const im = document.createElement('img'); im.className = 'crSheet leaflet-image-layer leaflet-zoom-animated'; im.alt = ''; im.draggable = false; im.src = u; im.dataset.sheet = s.id; pane.appendChild(im); L.img = im; }
      if (L.img) { L.img.style.width = s.w + 'px'; L.img.style.height = s.h + 'px'; L.img.style.opacity = String(s.opacity); L.img.style.display = s.visible ? '' : 'none'; L.img.style.zIndex = String(i + 1); }
      const on = s.id === sel, miss = u === null;
      L.foot.setStyle({ color: on ? '#2563EB' : miss ? '#B45309' : '#64748B', dashArray: on ? null : '6 4', opacity: s.visible || on ? 0.9 : 0.35, weight: on ? 2 : 1.5,
        fill: miss, fillColor: '#FDE68A', fillOpacity: miss ? 0.25 : 0 });
      position(s);
    });
    drawHandles();
  }
  /* ---------- handles: move (centre) and rotate (above the top edge) ---------- */
  const hIcon = (cls, t, title) => window.L.divIcon({ className: 'crHandle ' + cls, html: `<span title="${title}">${t}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
  function clearHandles() { handles.forEach(h => h.remove()); handles = []; }
  function drawHandles() {
    clearHandles();
    const s = sheetOf(sel), m = MP() && MP().map; if (!s || !m || s.locked || !s.visible || pick) return;
    const Lf = window.L, cpx = { px: s.w / 2, py: s.h / 2 };
    const cen = Lf.marker(MP().toLL(G.pxToFt(s.place, cpx.px, cpx.py)), { icon: hIcon('crMove', '✥', 'Drag to move the sheet'), draggable: true, keyboard: false, zIndexOffset: 1000 }).addTo(m);
    const rpx = () => ({ px: s.w / 2, py: -Math.max(s.h * 0.08, 40) });
    const rot = Lf.marker(MP().toLL(G.pxToFt(s.place, rpx().px, rpx().py)), { icon: hIcon('crRot', '⟳', 'Drag to rotate the sheet about its centre'), draggable: true, keyboard: false, zIndexOffset: 1000 }).addTo(m);
    let p0 = null, f0 = null, a0 = 0;
    cen.on('dragstart', () => { p0 = Object.assign({}, s.place); f0 = MP().toFt(cen.getLatLng()); });
    cen.on('drag', () => { const f = MP().toFt(cen.getLatLng()); s.place.x = p0.x + f.x - f0.x; s.place.y = p0.y + f.y - f0.y;
      MP().raf('sheet', () => { position(s); rot.setLatLng(MP().toLL(G.pxToFt(s.place, rpx().px, rpx().py))); A.live('sheets', { id: s.id }); }); });
    cen.on('dragend', () => { A.update(null, 'sheets', { id: s.id }); });
    const cft = () => G.pxToFt(s.place, cpx.px, cpx.py);
    rot.on('dragstart', () => { p0 = Object.assign({}, s.place); const c = cft(), f = MP().toFt(rot.getLatLng()); a0 = Math.atan2(f.y - c.y, f.x - c.x); });
    rot.on('drag', () => { const c = G.pxToFt(p0, cpx.px, cpx.py), f = MP().toFt(rot.getLatLng()), a = Math.atan2(f.y - c.y, f.x - c.x);
      Object.assign(s.place, G.rotateAbout(p0, G.normRot(p0.rot + a - a0), cpx.px, cpx.py));
      MP().raf('sheet', () => { position(s); A.live('sheets', { id: s.id }); }); });
    rot.on('dragend', () => { A.update(null, 'sheets', { id: s.id }); drawHandles(); });
    handles.push(cen, rot);
  }
  /* ---------- picking points on a sheet (calibration, georeference) ---------- */
  function startPick(id, mode) {
    const s = sheetOf(id); if (!s || !MP().map) return;
    pick = { id, mode, pts: [], marks: [] }; sel = id; clearHandles();
    A.showOTab('plan');
    MP().setTool({ cursor: 'crosshair',
      click: ft => { if (!pick || pick.pts.length >= 2) return; const q = G.ftToPx(s.place, ft.x, ft.y); pick.pts.push({ px: q.px, py: q.py });
        const mk = window.L.circleMarker(MP().toLL(ft), { radius: 6, color: '#DC2626', weight: 2, fillColor: '#fff', fillOpacity: 1, interactive: false }).addTo(MP().map);
        mk.bindTooltip(String(pick.pts.length), { permanent: true, direction: 'right', className: 'crPickTip' }); pick.marks.push(mk);
        status(); drawTab(); },
      key: e => { if (e.key === 'Escape') endPick(); },
      end: () => { if (pick) pick.marks.forEach(m => m.remove()); pick = null; MP().status(''); drawHandles(); } });
    status(); drawTab();
  }
  function endPick() { MP().setTool(null); drawTab(); }
  function status() {
    if (!pick) return; const n = pick.pts.length, what = pick.mode === 'cal' ? 'two points a known distance apart' : 'two points whose State Plane coordinates you know';
    MP().status(n < 2 ? `<b>${pick.mode === 'cal' ? 'Scale calibration' : 'Georeference'}:</b> click point ${n + 1} of 2 on the sheet (${what}; zoom in for precision). <button type="button" id="pkCancel">Cancel</button>`
      : `<b>Two points picked.</b> Enter the ${pick.mode === 'cal' ? 'real distance' : 'coordinates'} on the Plan sheets tab. <button type="button" id="pkCancel">Cancel</button>`);
    const b = document.getElementById('pkCancel'); if (b) b.onclick = endPick;
    if (n >= 2) A.showITab('sheets');
  }
  /* ---------- actions ---------- */
  function applyCal(id, dist) {
    const s = sheetOf(id); if (!s || !pick || pick.pts.length < 2) return;
    const [p1, p2] = pick.pts, r = G.calScale(p1, p2, dist); if (!(r.s > 0)) { A.notice('Enter a real distance greater than 0 and pick two different points.', 'err'); return; }
    const geo = !!s.geo;
    A.update(() => { s.cal = { p1, p2, dist }; if (!geo) { s.place = G.rescaleAbout(s.place, r.s, (p1.px + p2.px) / 2, (p1.py + p2.py) / 2); s.basis = 'cal'; } }, 'sheets', { id });
    endPick();
    if (geo) A.notice(`"${esc(s.name)}" is georeferenced, so its scale was not changed: the calibration is kept as a check (Site tab).`);
  }
  function applyGeo(id, g1n, g2n, moveItems) {
    const s = sheetOf(id); if (!s || !pick || pick.pts.length < 2) return;
    const z = A.P.site.zone, ft = q => ({ x: G.nativeToFt(z, q.E), y: G.nativeToFt(z, q.N) });
    const r = G.georef(pick.pts[0], pick.pts[1], ft(g1n), ft(g2n)); if (!r) { A.notice('Pick two different points and enter two different coordinates.', 'err'); return; }
    const old = Object.assign({}, s.place), now = { x: r.x, y: r.y, s: r.s, rot: r.rot }, foot = [[0, 0], [s.w, 0], [s.w, s.h], [0, s.h]].map(([x, y]) => G.pxToFt(old, x, y));
    let moved = 0;
    A.update(P => {
      if (moveItems) { const mv = G.placementMove(old, now); (P.items || []).forEach(it => { if (it.pts.every(p => G.inside(p, foot))) { it.pts = it.pts.map(mv); moved++; } }); }
      s.place = now; s.geo = { p1: pick.pts[0], p2: pick.pts[1], g1: g1n, g2: g2n }; s.basis = 'geo';
    }, 'sheets', { id });
    endPick(); fitSheet(id);
    A.notice(`"${esc(s.name)}" georeferenced: scale ${fmt(r.s, 5)} ft/px, rotation ${fmt(deg(r.rot), 3)}°.${moveItems ? ` ${moved} item${moved === 1 ? '' : 's'} drawn on it moved with it.` : ''}`, '', { id: 'shGeo' });
  }
  function applyPlanScale(id, S) {
    const s = sheetOf(id); if (!s || !s.pageIn || !(S > 0)) return;
    if (s.geo) { A.notice(`"${esc(s.name)}" is georeferenced; its scale comes from the georeference.`, 'warn'); return; }
    A.update(() => { s.planScale = S; s.place = G.rescaleAbout(s.place, S * s.pageIn.w / s.w, s.w / 2, s.h / 2); s.basis = 'plan'; s.cal = null; }, 'sheets', { id });
  }
  function fitSheet(id) { const s = sheetOf(id); if (s) MP().fit([[0, 0], [s.w, s.h], [s.w, 0], [0, s.h]].map(([x, y]) => G.pxToFt(s.place, x, y))); }
  function initialPlace(w, h) {
    const m = MP() && MP().map; let c = { x: 0, y: 0 }, span = 400;
    if (m) { const b = m.getBounds(), a = MP().toFt(b.getSouthWest()), e = MP().toFt(b.getNorthEast()); c = MP().toFt(m.getCenter()); span = Math.max(50, Math.min(Math.abs(e.x - a.x), Math.abs(e.y - a.y) * w / h)); }
    const s = 0.8 * span / w; return { x: c.x - s * w / 2, y: c.y + s * h / 2, s, rot: 0 };
  }
  async function addImage(blob, o) {
    let d; try { d = await dims(blob); } catch (e) { A.notice(esc(e.message) + '. Nothing was added.', 'err'); return; }
    const id = o.id || M.uid('s'), rec = { id, blob, type: blob.type || 'image/png', name: o.name, w: d.w, h: d.h, size: blob.size, at: new Date().toISOString() };
    const put = await ST.put(rec);
    if (!put.ok) { A.notice(`The image could not be stored in this browser (${esc(put.message || put.error)}). It is shown for this session only.`, 'warn'); }
    if (put.memory && !memTold) { memTold = true; A.notice('This browser does not keep images for pages opened from files (IndexedDB is not available, e.g. a private window): plan sheets last for this session only. Their placement is saved; load them again next time.', 'warn'); }
    if (urls.get(id)) URL.revokeObjectURL(urls.get(id));
    urls.set(id, URL.createObjectURL(blob));
    if (blob.size > BIG) A.notice(`"${esc(o.name)}" is large (${fmt(blob.size / 1048576, 1)} MB). It is kept in this browser's IndexedDB, not in the saved-project list; Export JSON with images will be large too. A lower resolution is usually enough.`, 'warn');
    if (o.reload) {
      const s = sheetOf(id); if (!s) return;
      if (s.w !== d.w || s.h !== d.h) {
        const k = d.w / s.w;   // the same ground size: the pixels scale, the scale per pixel scales inversely
        A.update(() => { s.place = Object.assign({}, s.place, { s: s.place.s / k }); const sc = p => ({ px: p.px * k, py: p.py * k });
          if (s.cal) { s.cal.p1 = sc(s.cal.p1); s.cal.p2 = sc(s.cal.p2); } if (s.geo) { s.geo.p1 = sc(s.geo.p1); s.geo.p2 = sc(s.geo.p2); } s.w = d.w; s.h = d.h; }, 'sheets', { id });
        A.notice(`"${esc(s.name)}" reloaded at a different size (${d.w} × ${d.h} px): the sheet keeps its place and size on the ground. Check it against a known point.`, 'warn');
      } else { sync(); drawTab(); }
      tellMissing(); return;
    }
    const sheet = M.normSheet({ id, name: o.name, kind: o.kind || 'image', page: o.page || 1, w: d.w, h: d.h, place: initialPlace(d.w, d.h), opacity: 0.8, pageIn: o.pageIn || null });
    sel = id;
    A.update(P => { P.sheets.push(sheet); }, 'sheets', { id });
    A.notice(`"${esc(o.name)}" placed at the map centre. Set its scale: calibrate with two points and a known distance${o.pageIn ? ', or enter the plan\'s stated scale' : ''}, or georeference it with two State Plane points.`, '', { id: 'shPlaced' });
  }
  async function onFile(file, reloadId) {
    if (!file) return;
    if (/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)) {
      let lib; try { lib = await pdfLib(); } catch (e) { A.notice(esc(e.message) + '.', 'err'); return; }
      try { const buf = await file.arrayBuffer(); const doc = await lib.getDocument({ data: buf, isEvalSupported: false }).promise; pend = { doc, name: file.name, reloadId, n: doc.numPages }; drawTab(); if (pend.n === 1 && reloadId) renderPdf(1, 5000); }
      catch (e) { A.notice('The PDF could not be read (' + esc(e.message) + ').', 'err'); }
      return;
    }
    if (!/^image\/(png|jpeg)$/i.test(file.type) && !/\.(png|jpe?g)$/i.test(file.name)) { A.notice('Load a PNG, JPG or PDF file.', 'err'); return; }
    await addImage(file, { name: file.name, id: reloadId, reload: !!reloadId });
  }
  async function renderPdf(page, longest) {
    if (!pend) return; const P0 = pend; pend = Object.assign({}, P0, { busy: true }); drawTab();
    try {
      const pg = await P0.doc.getPage(page), v1 = pg.getViewport({ scale: 1 }), k = longest / Math.max(v1.width, v1.height), v = pg.getViewport({ scale: k });
      const c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height);
      const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: cx, viewport: v }).promise;
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      c.width = c.height = 0; pend = null;
      const pageIn = { w: v1.width / 72, h: v1.height / 72 };
      if (P0.reloadId) { const s = sheetOf(P0.reloadId); if (s) await addImage(blob, { name: s.name, id: s.id, reload: true }); }
      else await addImage(blob, { name: P0.name + (P0.n > 1 ? ` (page ${page})` : ''), kind: 'pdf', page, pageIn });
    } catch (e) { pend = null; A.notice('The PDF page could not be rendered (' + esc(e.message) + ').', 'err'); }
    drawTab();
  }
  function remove(id) {
    const s = sheetOf(id); if (!s || !confirm(`Remove the plan sheet "${s.name}" from this project? (Undo brings it back.)`)) return;
    if (sel === id) sel = null; if (pick && pick.id === id) endPick();
    A.update(P => { P.sheets = P.sheets.filter(x => x.id !== id); }, 'sheets');
  }
  /* images used by the open project, the autosave and every saved project */
  function usedIds() {
    const ids = new Set(A.P.sheets.map(s => s.id)), add = p => { try { (p && p.sheets || []).forEach(s => s && s.id && ids.add(s.id)); } catch (e) { /* ignore */ } };
    try { add(JSON.parse(A.LS.getItem(M.KEYS.current) || 'null')); } catch (e) { /* none */ }
    try { const m = JSON.parse(A.LS.getItem(M.KEYS.list) || '{}'); Object.values(m || {}).forEach(add); } catch (e) { /* unreadable list: keep everything */ return null; }
    return ids;
  }
  async function cleanUp() {
    const used = usedIds(); if (!used) { A.notice('The saved-project list could not be read, so no image was removed.', 'warn'); return; }
    const all = await ST.list(), gone = all.filter(r => !used.has(r.id));
    if (!gone.length) { A.notice('Every stored plan-sheet image is used by the open project, the autosave or a saved project.'); return; }
    if (!confirm(`Remove ${gone.length} plan-sheet image${gone.length > 1 ? 's' : ''} (${fmt(gone.reduce((a, r) => a + (r.size || 0), 0) / 1048576, 1)} MB) that no saved project, autosave or open project uses?`)) return;
    for (const r of gone) await ST.del(r.id);
    A.notice(`${gone.length} unused image${gone.length > 1 ? 's' : ''} removed.`); drawTab();
  }
  /* Export JSON with the images (ui/project.js): { id: data URL } of the open project's sheets, when chosen */
  function imagesFor(P) {
    if (A.ui.expImages === false) return Promise.resolve(null);
    return Promise.all(P.sheets.map(s => ST.get(s.id).then(r => r && r.blob ? new Promise(res => { const fr = new FileReader(); fr.onload = () => res([s.id, String(fr.result)]); fr.onerror = () => res(null); fr.readAsDataURL(r.blob); }) : null)))
      .then(a => { const o = {}; a.filter(Boolean).forEach(([k, v]) => { o[k] = v; }); return o; });
  }
  async function afterImport(res) {
    const imgs = res.images || {}; let n = 0;
    for (const s of res.project.sheets) {
      const d = imgs[s.id]; if (typeof d !== 'string') continue;
      const m = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(d); if (!m) continue;
      const bin = atob(m[2]), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const blob = new Blob([u8], { type: m[1] });
      await ST.put({ id: s.id, blob, type: m[1], name: s.name, w: s.w, h: s.h, size: blob.size, at: new Date().toISOString() });
      if (urls.get(s.id)) URL.revokeObjectURL(urls.get(s.id)); urls.delete(s.id); missingTold.delete(s.id); n++;
    }
    if (n) { sync(); drawTab(); tellMissing(); }
  }
  /* ---------- the Plan sheets tab ---------- */
  function build(p) {
    el = p;
    p.addEventListener('click', onClick); p.addEventListener('change', onChange); p.addEventListener('input', onInput);
    drawTab();
  }
  function basisChip(s) {
    const b = s.basis || 'none', cls = b === 'none' ? 'chipW' : 'chipOk';
    return `<span class="chip ${cls}" title="${esc(M.BASIS[b])}">${b === 'none' ? 'scale not set' : b === 'plan' ? 'plan scale' : b === 'cal' ? 'calibrated' : 'georeferenced'}</span>`;
  }
  function card(s) {
    const on = s.id === sel, u = urls.get(s.id), miss = u === null, z = G.zone(A.P.site.zone), unit = z.unit === 'm' ? 'm' : 'ft';
    const pk = pick && pick.id === s.id ? pick : null;
    let body = '';
    if (on) {
      const sc = s.place.s, inch = s.pageIn ? sc * s.w / s.pageIn.w : null;
      body = `<div class="fRow"><label>Image</label><span>${fmt(s.w, 0)} × ${fmt(s.h, 0)} px${s.kind === 'pdf' ? ` · PDF page ${s.page}${s.pageIn ? ` (${fmt(s.pageIn.w, 2)} × ${fmt(s.pageIn.h, 2)} in)` : ''}` : ''}${miss ? ' · <b class="warnT">image not in this browser</b>' : ''}</span></div>
        <div class="fRow"><label>Scale</label><span>${fmt(sc, 5)} ft/px${inch ? ` · 1 in on the page = ${fmt(inch, 2)} ft` : ''} · ${esc(M.BASIS[s.basis || 'none'])}</span></div>
        <div class="fRow"><label for="shOp">Opacity</label><input type="range" id="shOp" min="0.05" max="1" step="0.05" value="${s.opacity}" data-sh="${s.id}"><span class="unit">${Math.round(s.opacity * 100)} %</span></div>
        <div class="fRow"><label for="shRot">Rotation</label><input type="number" id="shRot" step="0.1" value="${fmt(deg(s.place.rot), 3).replace(/,/g, '')}" data-sh="${s.id}"><span class="unit">° CCW</span></div>
        <div class="shBlk"><b>Scale calibration</b> <span class="note">two points a known distance apart (s = D / d<sub>px</sub>)</span>
          ${pk && pk.mode === 'cal' ? (pk.pts.length < 2 ? `<p class="note">Click point ${pk.pts.length + 1} of 2 on the map. <button type="button" data-a="cancel">Cancel</button></p>`
            : `<p class="note">d<sub>px</sub> = ${fmt(G.calScale(pk.pts[0], pk.pts[1], 1).dpx, 1)} px (now ${fmt(G.calScale(pk.pts[0], pk.pts[1], 1).dpx * sc, 2)} ft)</p>
               <div class="goRow"><label for="calD">Real distance D</label><input type="text" id="calD" inputmode="decimal" value="${s.cal ? s.cal.dist : ''}"><span class="unit">ft</span><button type="button" class="primary" data-a="calApply" data-id="${s.id}">${s.geo ? 'Record as a check' : 'Apply'}</button><button type="button" data-a="cancel">Cancel</button></div>`)
            : `<div class="goRow"><button type="button" data-a="cal" data-id="${s.id}" ${miss ? 'disabled' : ''}>Pick two points…</button>${s.cal ? `<span class="note">last: D = ${fmt(s.cal.dist, 2)} ft</span>` : ''}</div>`}</div>
        ${s.pageIn ? `<div class="shBlk"><b>Plan's stated scale</b> <span class="note">full-size PDF only; check with a known dimension</span>
          <div class="goRow"><label for="plS">1 in =</label><input type="text" id="plS" inputmode="decimal" value="${s.planScale || ''}"><span class="unit">ft</span><button type="button" data-a="plan" data-id="${s.id}">Apply</button></div></div>` : ''}
        <div class="shBlk"><b>Georeference</b> <span class="note">two points with State Plane coordinates (${esc(z.short)}, ${unit}): scale, rotation, position</span>
          ${pk && pk.mode === 'geo' ? (pk.pts.length < 2 ? `<p class="note">Click point ${pk.pts.length + 1} of 2 on the map. <button type="button" data-a="cancel">Cancel</button></p>`
            : `<div class="goRow"><span>Point 1</span><input type="text" id="gE1" placeholder="Easting" aria-label="Point 1 easting" value="${s.geo ? s.geo.g1.E : ''}"><input type="text" id="gN1" placeholder="Northing" aria-label="Point 1 northing" value="${s.geo ? s.geo.g1.N : ''}"></div>
               <div class="goRow"><span>Point 2</span><input type="text" id="gE2" placeholder="Easting" aria-label="Point 2 easting" value="${s.geo ? s.geo.g2.E : ''}"><input type="text" id="gN2" placeholder="Northing" aria-label="Point 2 northing" value="${s.geo ? s.geo.g2.N : ''}"></div>
               <label class="note" style="display:block"><input type="checkbox" id="gMove" checked> Move the items drawn on this sheet with it</label>
               <div class="goRow"><button type="button" class="primary" data-a="geoApply" data-id="${s.id}">Apply</button><button type="button" data-a="cancel">Cancel</button></div>`)
            : `<div class="goRow"><button type="button" data-a="geo" data-id="${s.id}" ${miss ? 'disabled' : ''}>Pick two points…</button>${s.geo ? '<span class="note">georeferenced</span>' : ''}</div>`}</div>
        <div class="goRow"><button type="button" data-a="fit" data-id="${s.id}">Show on the map</button><button type="button" data-a="reload" data-id="${s.id}">${miss ? 'Reload image…' : 'Replace image…'}</button><button type="button" data-a="del" data-id="${s.id}" class="danger">Remove</button>
          <a href="#" class="wk" data-a="worked" data-id="${s.id}">worked: Site tab</a></div>`;
    }
    return `<div class="shCard${on ? ' on' : ''}" data-card="${s.id}"><div class="shHead"><button type="button" class="shName" data-a="sel" data-id="${s.id}" aria-expanded="${on}">${esc(s.name)}</button>${basisChip(s)}${miss ? '<span class="chip chipW">image missing</span>' : ''}
      <label class="shTg"><input type="checkbox" data-t="visible" data-sh="${s.id}" ${s.visible ? 'checked' : ''}> show</label><label class="shTg"><input type="checkbox" data-t="locked" data-sh="${s.id}" ${s.locked ? 'checked' : ''}> lock</label></div>${body}</div>`;
  }
  function drawTab() {
    if (!el) return;
    const sh = A.P.sheets;
    const pd = pend ? `<div class="shBlk"><b>${esc(pend.name)}</b>${pend.busy ? '<p class="note">Rendering…</p>' : `<div class="goRow"><label for="pdPage">Page</label><select id="pdPage">${Array.from({ length: pend.n }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}</select>
        <label for="pdRes">Resolution</label><select id="pdRes"><option value="3000">3,000 px (long side)</option><option value="5000" selected>5,000 px</option><option value="7000">7,000 px</option></select></div>
        <div class="goRow"><button type="button" class="primary" data-a="pdfGo">Render and place</button><button type="button" data-a="pdfNo">Cancel</button></div>`}</div>` : '';
    el.innerHTML = `<div class="sec"><div class="secHead">Plan sheets</div><div class="secBody">
        <div class="goRow"><button type="button" class="primary" data-a="add">Add plan sheet…</button><span class="note">PNG, JPG or PDF</span></div>
        <input type="file" id="shFile" accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf" hidden>${pd}
        ${sh.length ? sh.map(card).join('') : '<p class="note">No plan sheet yet. A sheet lies under the drawn items; with no base map (offline) it is the whole site plan.</p>'}</div></div>
      <div class="sec"><div class="secHead">Images in this browser</div><div class="secBody"><p class="note" id="shUse">…</p>
        <label class="note" style="display:block"><input type="checkbox" id="shExp" ${A.ui.expImages === false ? '' : 'checked'}> Include the plan-sheet images in Export JSON (a larger file that opens complete on another computer)</label>
        <div class="goRow"><button type="button" data-a="clean">Clean up unused images…</button></div>
        <p class="note">The images are kept in this browser (IndexedDB), not in the saved-project list or on GitHub: a project opened elsewhere asks for its sheets again.</p></div></div>`;
    ST.list().then(all => { const u = el.querySelector('#shUse'); if (u) u.textContent = `${all.length} image${all.length === 1 ? '' : 's'}, ${fmt(all.reduce((a, r) => a + (r.size || 0), 0) / 1048576, 1)} MB.`; });
  }
  function onClick(e) {
    const b = e.target.closest('[data-a]'); if (!b) return; const id = b.dataset.id, a = b.dataset.a;
    if (a === 'worked') e.preventDefault();
    if (a === 'add' || a === 'reload') { const f = el.querySelector('#shFile'); f.dataset.reload = a === 'reload' ? id : ''; f.click(); return; }
    if (a === 'sel') { sel = sel === id ? null : id; if (pick && pick.id !== sel) endPick(); sync(); drawTab(); return; }
    if (a === 'cal' || a === 'geo') { startPick(id, a); return; }
    if (a === 'cancel') { endPick(); return; }
    if (a === 'calApply') { const d = G.parseNum(el.querySelector('#calD').value); if (!(d > 0)) { el.querySelector('#calD').classList.add('bad'); return; } applyCal(id, d); return; }
    if (a === 'geoApply') { const v = k => G.parseNum(el.querySelector('#' + k).value), q = { E1: v('gE1'), N1: v('gN1'), E2: v('gE2'), N2: v('gN2') };
      const bad = Object.keys(q).filter(k => !isFinite(q[k])); el.querySelectorAll('#gE1,#gN1,#gE2,#gN2').forEach(i => i.classList.toggle('bad', bad.includes(i.id.slice(1))));
      if (bad.length) return; applyGeo(id, { E: q.E1, N: q.N1 }, { E: q.E2, N: q.N2 }, el.querySelector('#gMove').checked); return; }
    if (a === 'plan') { const S = G.parseNum(el.querySelector('#plS').value); if (!(S > 0)) { el.querySelector('#plS').classList.add('bad'); return; } applyPlanScale(id, S); return; }
    if (a === 'fit') { A.showOTab('plan'); fitSheet(id); return; }
    if (a === 'del') { remove(id); return; }
    if (a === 'worked') { A.showOTab('site'); setTimeout(() => { const t = document.getElementById('site-sh-' + id); if (t) t.scrollIntoView({ block: 'start' }); }, 50); return; }
    if (a === 'pdfGo') { renderPdf(+el.querySelector('#pdPage').value, +el.querySelector('#pdRes').value); return; }
    if (a === 'pdfNo') { pend = null; drawTab(); return; }
    if (a === 'clean') { cleanUp(); return; }
  }
  function onChange(e) {
    const t = e.target;
    if (t.id === 'shFile') { const f = t.files && t.files[0], r = t.dataset.reload || ''; t.value = ''; onFile(f, r || null); return; }
    if (t.id === 'shExp') { A.ui.expImages = t.checked; A.saveUi(); return; }
    const s = sheetOf(t.dataset.sh); if (!s) return;
    if (t.dataset.t) { const k = t.dataset.t; A.update(() => { s[k] = t.checked; }, 'sheets', { id: s.id }); return; }
    if (t.id === 'shOp') { A.update(() => { s.opacity = +t.value; }, 'sheets', { id: s.id }); return; }
    if (t.id === 'shRot') { const v = G.parseNum(t.value); if (!isFinite(v)) { t.classList.add('bad'); return; } A.update(() => { s.place = G.rotateAbout(s.place, G.normRot(v * Math.PI / 180), s.w / 2, s.h / 2); }, 'sheets', { id: s.id }); }
  }
  function onInput(e) {   // the opacity slider shows at once; the undo step is taken on change
    const t = e.target; if (t.id !== 'shOp') return; const s = sheetOf(t.dataset.sh); if (!s) return; s.opacity = +t.value; const L = lay.get(s.id); if (L && L.img) L.img.style.opacity = t.value;
    if (t.nextElementSibling) t.nextElementSibling.textContent = Math.round(s.opacity * 100) + ' %';
  }
  /* ---------- Site tab and Report ---------- */
  function sheetSteps(s, pre) {
    const z = A.P.site.zone, out = [];
    const c = W.cal(s, pre + '.cal'); if (c) out.push({ title: s.geo ? 'Scale calibration (a check: the georeference governs)' : 'Scale calibration', steps: c.steps });
    const p = W.planScale(s, pre + '.plan'); if (p && s.basis === 'plan') out.push({ title: 'Scale from the plan\'s stated scale', steps: p.steps });
    const g = W.geo(s, z, pre + '.geo'); if (g) out.push({ title: 'Georeference', steps: g.steps });
    return out;
  }
  window.CranePickSite && window.CranePickSite.section(P => {
    if (!P.sheets.length) return '';
    return `<div class="sec"><div class="secHead">Plan sheets</div><div class="secBody"><div class="tscroll"><table class="tbl"><thead><tr><th>Sheet</th><th>Image</th><th>Scale (ft/px)</th><th>Rotation</th><th>Scale set by</th><th>In this browser</th></tr></thead><tbody>
      ${P.sheets.map(s => `<tr><td>${esc(s.name)}</td><td class="n">${fmt(s.w, 0)} × ${fmt(s.h, 0)} px</td><td class="n">${fmt(s.place.s, 5)}</td><td class="n">${fmt(deg(s.place.rot), 3)}°</td><td>${esc(M.BASIS[s.basis || 'none'])}</td><td>${urls.get(s.id) === null ? '<b class="warnT">no: load it again</b>' : 'yes'}</td></tr>`).join('')}</tbody></table></div>
      ${P.sheets.map((s, i) => { const parts = sheetSteps(s, 'sh' + (i + 1)); return parts.length ? `<div id="site-sh-${s.id}"><h4 class="stH">${esc(s.name)}</h4>${parts.map(q => `<div class="note"><b>${esc(q.title)}</b></div>${window.CranePickSite.steps(q.steps)}`).join('')}</div>` : ''; }).join('')}
      </div></div>`;
  });
  window.CranePickReport && window.CranePickReport.add(P => {
    if (!P.sheets.length) return [];
    return [{ id: 'sheets', key: 'sheets', title: 'Plan sheets', subs: P.sheets.map((s, i) => ({ id: 'sh' + (i + 1), key: 'sh-' + s.id, title: s.name, items: [
      { type: 'kv', rows: [['Image', `${fmt(s.w, 0)} × ${fmt(s.h, 0)} px${s.kind === 'pdf' ? `, PDF page ${s.page}` : ''}`], ['Scale', `${fmt(s.place.s, 5)} ft/px`], ['Rotation', `${fmt(deg(s.place.rot), 3)}° counter-clockwise from grid east`],
        ['Scale set by', M.BASIS[s.basis || 'none']], ['Pixel (0, 0) at', `x ${fmt(s.place.x, 2)} ft, y ${fmt(s.place.y, 2)} ft (grid)`]] },
      ...(s.basis === 'none' ? [{ type: 'note', warn: true, text: 'The scale of this sheet has not been set (placed by hand): distances read from it are not reliable.' }] : []),
      ...sheetSteps(s, 'sh' + (i + 1)).map(q => ({ type: 'steps', scope: 'sheets', title: q.title, steps: q.steps }))
    ] })) }];
  });
  /* ---------- wiring ---------- */
  A.inTab({ id: 'sheets', label: 'Plan sheets', build });
  A.on('project', () => { if (pick) endPick(); if (sel && !sheetOf(sel)) sel = null; sync(); drawTab(); setTimeout(tellMissing, 0); });
  A.on('change', o => { if (o.kind === 'sheets' || o.kind === 'site') { sync(); if (!(o.kind === 'sheets' && o.live)) drawTab(); } });
  A.on('live', o => { if (o.kind === 'sheets') { /* drawn by the handle itself */ } });
  A.on('ready', () => { if (window.CranePickProject) window.CranePickProject.setImages(imagesFor, afterImport); });
  A.on('tab', id => { if (id === 'plan') setTimeout(sync, 0); });
  window.CranePickSheets = { sync, select: id => { sel = id; sync(); drawTab(); }, get selected() { return sel; }, startPick, endPick, get pick() { return pick; }, urls, applyCal, applyGeo, applyPlanScale, fitSheet, cleanUp, onFile };
})();
