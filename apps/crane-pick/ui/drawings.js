/* apps/crane-pick/ui/drawings.js — the Drawings output tab of the Crane Pick Analyzer (window.CranePickDrawingsUI). C7 (2026-11-16).
   Modelled on the bridge apps' Drawings tabs (apps/ps-bridge/ui/drawings.js, apps/steel-bridge/ui/drawings.js): Paper D or B, the sheet
   shown with pan / zoom (SharedDxf.viewer; the preview is drawn from the same entity list as the file), Download DXF (one R12 file, every
   sheet side by side, checked by SharedDxf.validate first), Print sheet / Print all sheets (SharedDxf.printSheets, 11 × 17 landscape: paper
   B at its plot scale, paper D half size), and the sheet index with links to where each sheet's values are entered and worked (CLAUDE.md §6).
   The sheets: ui/drawset.js (CranePickDrawSet.build) from the page's own evaluations (CranePickPlace.evalPick, CranePickTandemUI.evalT,
   CranePickRouteUI.evalRoute) and the Report's § numbers. Display and export only. The choices are kept in crane.ui (dwg: { paper, sheet,
   z }; per browser, nothing in the project). */
(function () {
  'use strict';
  const A = window.CranePickApp, esc = A.esc;
  const ZOOM = [[1, 'Fit'], [2, '200 %'], [4, '400 %'], [8, '800 %']];
  let el = null, dirty = true, viewer = null, lastBuild = null;
  /* the build context: the page's evaluations and the Report's numbering (for "REPORT SEC. x.y" on the sheets) */
  function ctx() {
    let doc = null; try { if (window.SharedReport && window.CranePickReport) doc = SharedReport.build(window.CranePickReport.model(A.P)); } catch (e) { console.error(e); }
    return { evalPick: k => (window.CranePickPlace ? window.CranePickPlace.evalPick(k) : null), evalT: t => (window.CranePickTandemUI ? window.CranePickTandemUI.evalT(t) : null),
      evalRoute: r => (window.CranePickRouteUI ? window.CranePickRouteUI.evalRoute(r) : null), sections: window.CranePickElevView ? window.CranePickElevView.sections : null,
      ref: key => (doc && key ? SharedReport.ref(doc, key) : null), doc };
  }
  function build(paper, half) { const c = ctx(); const B = window.CranePickDrawSet.build(A.P, c, { paper, half, aerial: st().aerial !== false && !!window.CranePickAerial }); B.ctx = c; return B; }
  /* 2026-11-17: the aerial sheets (ui/aerial.js): the image of a sheet's plan window, requested once per window and scale (cached for the
     page), drawn under the sheet in the preview and the print; the DXF gets the PNG + world file as separate downloads */
  const AE = () => window.CranePickAerial;
  const aerialOf = s => (s && s.aerial && AE() ? AE().request(s.aerial.w, A.P.site.zone, s.k) : null);
  function withAerial(svg, s, vb) { const a = aerialOf(s); if (!a) return svg; if (a.status === 'loading') AE().onDone(a, () => { if (A.ui.otab === 'dwg' && el && el.isConnected) { dirty = true; draw(); } }); return AE().inject(svg, s, a, vb); }
  const st = () => { A.ui.dwg = Object.assign({ paper: 'D', sheet: 'cover', z: 1 }, A.ui.dwg || {}); return A.ui.dwg; };
  function gotoReport(key) { A.showOTab('rpt'); const j = () => { const v = window.CranePickReportUI && window.CranePickReportUI.view; if (v && v.jump) v.jump(key); }; setTimeout(j, 60); setTimeout(j, 160); setTimeout(j, 420); }
  function draw() {
    if (!el || !window.SharedDxf || !window.CranePickDrawSet) return; dirty = false;
    const u = st(), paper = u.paper === 'B' ? 'B' : 'D', z = ZOOM.some(q => q[0] === u.z) ? u.z : 1;
    let B; try { B = build(paper); } catch (e) { console.error(e); el.innerHTML = `<div class="sec"><div class="secHead">Drawings</div><div class="secBody"><p class="warnT">The drawings could not be drawn: ${esc(e.message)}</p></div></div>`; return; }
    lastBuild = B; const sh = B.sheets, cur = sh.find(s => s.id === u.sheet) || sh[0], ref = B.ctx.ref;
    const link = w => w[0] === 'rpt' ? `<a href="#" data-dgr="${esc(w[1])}">${esc(w[2].replace(/§\S*/, '') + (ref(w[1]) || '§'))}</a>` : `<a href="#" data-dg${w[0] === 'out' ? 'o' : 'i'}="${esc(w[1])}">${esc(w[2])}</a>`;
    el.innerHTML = `<div class="sec"><div class="secHead">Lift-plan drawings (DXF R12): ${sh.length} sheet${sh.length === 1 ? '' : 's'}</div><div class="secBody">
      <div class="dwg-bar"><label for="dwg_paper">Paper</label><select id="dwg_paper"><option value="D"${paper === 'D' ? ' selected' : ''}>D, 34 × 22 in</option><option value="B"${paper === 'B' ? ' selected' : ''}>B, 17 × 11 in</option></select>
        <label for="dwg_sheet">Sheet</label><select id="dwg_sheet">${sh.map(s => `<option value="${esc(s.id)}"${s === cur ? ' selected' : ''}>${s.n}. ${esc(s.title)}</option>`).join('')}</select>
        <label for="dwg_z">Preview</label><select id="dwg_z">${ZOOM.map(([k, l]) => `<option value="${k}"${k === z ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <button type="button" class="primary" id="dwg_dxf">Download DXF (${sh.length} sheet${sh.length === 1 ? '' : 's'})</button>
        <button type="button" id="dwg_print1">Print sheet</button><button type="button" id="dwg_printAll">Print all sheets (${sh.length})</button>
        <label class="dwg-chk"><input type="checkbox" id="dwg_aerial"${u.aerial !== false ? ' checked' : ''}> Aerial site-plan sheets</label>
        ${cur.aerial ? `<button type="button" id="dwg_aerPng"${(() => { const a = aerialOf(cur); return a && a.url ? '' : ' disabled'; })()}>Download aerial image (PNG + world file)</button><button type="button" id="dwg_aerGrid" class="linkish"${(() => { const a = aerialOf(cur); return a && a.url ? '' : ' disabled'; })()}>World file in State Plane coordinates</button>` : ''}</div>
      <p class="note"><b>Lift-planning aid:</b> the crane manufacturer's load charts and instructions, the lift plan and the site checks govern; every sheet says so. ${esc(SharedDxf.PRINT_NOTE)}${paper === 'B' ? '' : ' Paper D prints half size on 11 × 17 (each sheet at half its stated scale; the title block says so).'}</p>
      ${cur.aerial ? `<p class="note" id="dwg_aerNote">${esc(AE().NOTE)} ${esc(AE().ATTR)}. ${(() => { const a = aerialOf(cur); return !a ? '' : a.status === 'loading' ? 'Loading the imagery…' : a.status === 'fail' ? `<span class="warnT">Aerial not available — the sheet prints without the background (${esc(a.why)}).</span>` : `Zoom ${a.z}, ${a.nOk} of ${a.n} tiles, ${a.wpx} × ${a.hpx} px at ${a.s.toFixed(2)} ft per pixel; placement residual ${a.resid.toFixed(3)} ft (one affine fit per image).${a.status === 'partial' ? ' <span class="warnT">' + esc(a.why) + '.</span>' : ''}`; })()} The DXF (R12) has no images: <b>Download aerial image</b> saves the PNG and its world file (.pgw) in this DXF's coordinates (inches, as placed on this sheet): in CAD, attach the PNG with its world file and it lands under the sheet's plan. The State Plane world file places the same PNG in grid coordinates (rename it to the PNG's name for GIS / civil base files).</p>` : ''}
      <p class="note">One DXF file (AutoCAD R12, model space, full size in inches: 1 ft = 12 units), each sheet at its plot scale inside its border and title block, side by side. Plans to scale, grid north up, State Plane grid ticks; elevations to the same scale. Every value on a sheet is the app's engine value (the Picks, Girder lifts, Ground and Route tabs and the Report, linked in the index below).</p>
      ${B.errors.length ? `<p class="warnT">${B.errors.map(esc).join('<br>')}</p>` : ''}</div></div>
      <div class="sec"><div class="secHead">${esc(cur.n + '. ' + cur.title)} <span style="font-weight:400;text-transform:none">· scale ${esc(window.CranePickDrawSet.SCALE_NAME[cur.k] || '1:' + cur.k)}${cur.over ? ' · does not fit the sheet even at the largest scale' : ''}</span></div><div class="secBody">
        <div class="dwg-box" data-dwg="${esc(cur.id)}"></div><p class="note">Wheel: zoom about the cursor · drag: pan · pinch on a touch screen · double-click: fit.</p></div></div>
      <div class="sec"><div class="secHead">Sheet index</div><div class="secBody"><div class="tscroll"><table class="tbl dwg-idx" id="dwgIdx"><thead><tr><th>No.</th><th>Title</th><th>Scale</th><th>Entered and worked on</th></tr></thead><tbody>
        ${sh.map(s => `<tr data-dsheet="${esc(s.id)}"${s === cur ? ' class="on"' : ''}><td>${s.n}</td><td>${esc(s.title)}</td><td>${esc(window.CranePickDrawSet.SCALE_NAME[s.k] || '1:' + s.k)}</td><td>${(s.src || []).map(link).join(' · ') || '—'}</td></tr>`).join('')}</tbody></table></div>
        ${B.miss.length ? `<p class="note"><b>Not in this set:</b> ${B.miss.map(([w, r]) => `${esc(String(w).toLowerCase())} (${esc(String(r).toLowerCase())})`).join('; ')}.</p>` : ''}</div></div>`;
    const zs = el.querySelector('#dwg_z'), sync = L => { const m = ZOOM.find(q => Math.abs(q[0] - L) < 0.005); let c = zs.querySelector('option[data-custom]');
      if (m) { zs.value = String(m[0]); if (c) c.hidden = true; return; }
      if (!c) { c = document.createElement('option'); c.dataset.custom = '1'; c.value = 'c'; zs.appendChild(c); } c.hidden = false; c.textContent = `${Math.round(L * 100)} %`; zs.value = 'c'; };
    let svg = SharedDxf.toSVG(B.D, { i0: cur.i0, i1: cur.i1, bg: '#fff', title: cur.title });
    if (cur.aerial) { const b = SharedDxf.bbox(B.D.E, cur.i0, cur.i1), pad = 0.02 * Math.max(b[2] - b[0], b[3] - b[1]); svg = withAerial(svg, cur, { x0: b[0] - pad, y1: b[3] + pad }); }
    viewer = SharedDxf.viewer(el.querySelector('.dwg-box'), svg, { height: '68vh', level: z, onchange: sync });
  }
  function set(k, v) { st()[k] = v; A.saveUi(); draw(); }
  function prt(all) {
    const u = st(), paper = u.paper === 'B' ? 'B' : 'D'; let B;
    try { B = paper === 'D' ? build('D', true) : (lastBuild || build('B')); } catch (e) { A.notice('The sheets could not be drawn: ' + esc(e.message), 'err'); return null; }
    const list0 = all ? B.sheets : B.sheets.filter(s => s.id === u.sheet), list = list0.length ? list0 : B.sheets.slice(0, 1);
    const go = () => { const r = SharedDxf.printSheets(list.map(s => ({ svg: s.aerial ? withAerial(SharedDxf.sheetSVG(B.D, s), s) : SharedDxf.sheetSVG(B.D, s), title: s.title })), { paper: window.CranePickDrawSet.PAPER.B }); api.lastPrint = r; return r; };
    // the aerial images first (a sheet whose imagery fails prints without it, with the note); at most 25 s
    const wait = list.map(aerialOf).filter(a => a && a.status === 'loading');
    if (!wait.length) return go();
    A.notice('Loading the aerial imagery for the print…', 'info');
    api.printing = Promise.race([Promise.all(wait.map(a => a.promise)), new Promise(ok => setTimeout(ok, 25000))]).then(go); return null;
  }
  function download() {
    const B = lastBuild || build(st().paper === 'B' ? 'B' : 'D'), txt = B.D.toDXF({ ltscale: 1 }), chk = SharedDxf.validate(txt);
    api.lastDxf = { text: txt, check: chk };
    if (!chk.ok) { A.notice('The DXF file failed its structure check: ' + esc(chk.errors.slice(0, 6).join('; ')), 'err'); return; }
    SharedDxf.download(txt, `${((A.P.title && A.P.title.name) || 'crane-lift-plan').replace(/[^\w.-]+/g, '_')}_lift_plan.dxf`);
  }
  /* the aerial image of the current sheet and its world file (DXF coordinates), or the State Plane world file */
  function aerialDownload(grid) {
    const B = lastBuild; if (!B) return null; const cur = B.sheets.find(s => s.id === st().sheet); if (!cur || !cur.aerial) return null;
    const f = AE().files(aerialOf(cur), cur, A.P.site.zone); if (!f) { A.notice('The aerial image is not available (offline, or the tile server is blocked).', 'err'); return null; }
    const base = `${((A.P.title && A.P.title.name) || 'crane-lift-plan').replace(/[^\w.-]+/g, '_')}_${cur.id}`;
    if (grid) AE().saveText(f.pgwGrid, base + '_stateplane.pgw'); else { AE().save(f.png, base + '.png'); AE().saveText(f.pgw, base + '.pgw'); }
    api.lastAerial = Object.assign({ base, grid: !!grid }, f); return f;
  }
  function onClick(e) {
    const t = e.target;
    if (t.id === 'dwg_dxf') return download();
    if (t.id === 'dwg_print1') return prt(false);
    if (t.id === 'dwg_printAll') return prt(true);
    if (t.id === 'dwg_aerPng' || t.id === 'dwg_aerGrid') return aerialDownload(t.id === 'dwg_aerGrid');
    const a = t.closest('[data-dgo],[data-dgi],[data-dgr]');
    if (a) { e.preventDefault(); if (a.dataset.dgo) A.showOTab(a.dataset.dgo); else if (a.dataset.dgi) A.showITab(a.dataset.dgi); else gotoReport(a.dataset.dgr); return; }
    const tr = t.closest('[data-dsheet]'); if (tr) set('sheet', tr.dataset.dsheet);
  }
  function onChange(e) {
    const t = e.target;
    if (t.id === 'dwg_aerial') { set('aerial', t.checked); return; }
    if (t.id === 'dwg_paper') set('paper', t.value); else if (t.id === 'dwg_sheet') set('sheet', t.value);
    else if (t.id === 'dwg_z' && t.value !== 'c') { st().z = +t.value; A.saveUi(); if (viewer) viewer.set(+t.value); }
  }
  function css() {
    if (document.getElementById('dwg-css')) return; const s = document.createElement('style'); s.id = 'dwg-css';
    s.textContent = '.dwg-box{border:1px solid var(--line);background:#fff;} .dwg-bar{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin:4px 0 8px;font-size:9pt;} .dwg-bar select{width:auto;max-width:100%;} .dwg-chk{display:inline-flex;gap:4px;align-items:center;} .dwg-idx tr{cursor:pointer;} .dwg-idx tr.on{background:#eef4ff;}';
    document.head.appendChild(s);
  }
  /* show(sheetId): open the tab at a sheet (the Summary tab's links) */
  function show(id) { if (id) { st().sheet = id; A.saveUi(); } dirty = true; A.showOTab('dwg'); }
  A.outTab({ id: 'dwg', label: 'Drawings', before: 'rpt', build: p => { el = p; css(); p.addEventListener('click', onClick); p.addEventListener('change', onChange); }, show: () => { if (dirty) draw(); } });
  const mark = () => { dirty = true; if (A.ui.otab === 'dwg') draw(); };
  A.on('project', mark); A.on('change', o => { if (o.kind !== 'select' && o.kind !== 'select-lift') mark(); });
  /* the Report's §Site plan (aerial): the whole-site aerial plan (ui/drawset.js aerialPlan) as a figure, the imagery under it */
  const rctx = () => ({ evalPick: k => (window.CranePickPlace ? window.CranePickPlace.evalPick(k) : null), evalT: t => (window.CranePickTandemUI ? window.CranePickTandemUI.evalT(t) : null),
    evalRoute: r => (window.CranePickRouteUI ? window.CranePickRouteUI.evalRoute(r) : null) });
  window.CranePickReport && window.CranePickReport.add(P => {
    const DS = window.CranePickDrawSet; if (!DS || !AE() || !(P.setups || []).length) return [];
    const c = rctx(), w = DS.siteWindow(P, c); if (!w) return [];
    const D = SharedDxf.drawing({ prefix: 'C-' }); D.k = Math.max(1, Math.round((w.x1 - w.x0) * 12 / 6.5)); D.h = DS.TXT * D.k;
    const C = { P, ae: { P, w, ctx: c, title: 'SITE PLAN - AERIAL' } }; DS.aerialPlan(D, C);
    const a = AE().request(w, P.site.zone, D.k);
    if (a.status === 'loading') AE().onDone(a, () => { if (window.CranePickReportUI) window.CranePickReportUI.redraw(); });
    const b = SharedDxf.bbox(D.E, 0, D.E.length), pad = 0.02 * Math.max(b[2] - b[0], b[3] - b[1]);
    const svg = AE().inject(SharedDxf.toSVG(D, { bg: '#fff', title: 'Site plan - aerial', width: 680 }), { aerial: C.aerial }, a, { x0: b[0] - pad, y1: b[3] + pad });
    const stx = a.status === 'loading' ? 'The imagery is loading (the figure is redrawn when it arrives).' : a.status === 'fail' ? `Aerial not available — the figure is shown without the background (${a.why}).` : `Imagery tiles at zoom ${a.z} (${a.nOk} of ${a.n}); placement residual ${a.resid.toFixed(3)} ft.`;
    return [{ id: 'aerial', key: 'aerial', title: 'Site plan (aerial)', subs: [{ id: 'aes', key: 'aerial-site', title: 'Site plan on the aerial background', items: [
      { type: 'figure', svg, caption: `Site plan on the aerial background (grid north up, to scale): site items, power-line D_min buffers, crane symbols, booms, swing paths, girder poses, routes. ${AE().ATTR}. Imagery date varies; not survey.` },
      { type: 'note', text: `${AE().NOTE} ${stx} The crane symbols are schematic (assumed dimensions on the crane cards, [[cranes]]); the checks use the engines' footprints, radii and heights ([[lifts]]). Drawings: "SITE PLAN - AERIAL" sheets; the DXF has no images (R12): the PNG and its world file are separate downloads.` }] }] }];
  });
  /* the Plan tab's "Print plan view": the map's current view as one 11 × 17 sheet (ui/drawset.js buildView) on the aerial background */
  function printView() {
    const MP = window.CranePickMap, m = MP && MP.map, DS = window.CranePickDrawSet; if (!m || !DS || !AE()) return null;
    const bb = m.getBounds(), cs = [bb.getNorthWest(), bb.getNorthEast(), bb.getSouthWest(), bb.getSouthEast()].map(ll => MP.toFt(ll));
    const w = { x0: Math.min(...cs.map(p => p.x)), x1: Math.max(...cs.map(p => p.x)), y0: Math.min(...cs.map(p => p.y)), y1: Math.max(...cs.map(p => p.y)) };
    const V = DS.buildView(A.P, rctx(), w, { paper: 'B', title: 'PLAN VIEW (MAP)' }), s = V.sheets[0], a = aerialOf(s);
    const go = () => { const r = SharedDxf.printSheets([{ svg: withAerial(SharedDxf.sheetSVG(V.D, s), s), title: s.title }], { paper: DS.PAPER.B }); api.lastPrint = r; api.lastView = { w, k: s.k, a }; return r; };
    if (!a || a.status !== 'loading') return go();
    A.notice('Loading the aerial imagery for the print…', 'info');
    api.printing = Promise.race([a.promise, new Promise(ok => setTimeout(ok, 25000))]).then(go); return null;
  }
  A.on('ready', () => { const MP = window.CranePickMap, L = window.L; if (!MP || !MP.map || !L) return;
    const Ctl = L.Control.extend({ onAdd: () => { const d = L.DomUtil.create('div', 'leaflet-bar crPrintView'); d.innerHTML = '<a href="#" role="button" id="crPrintView" title="Print plan view: the map\'s current view on one 11 × 17 sheet, aerial background, every overlay, north arrow, scale bar" aria-label="Print plan view">⎙</a>';
      L.DomEvent.disableClickPropagation(d); d.firstChild.addEventListener('click', e => { e.preventDefault(); printView(); }); return d; } });
    new Ctl({ position: 'topleft' }).addTo(MP.map); });
  const api = { redraw: mark, show, build, print: prt, printView, download, aerialDownload, lastView: null, lastPrint: null, lastDxf: null, lastAerial: null, printing: null, get viewer() { return viewer; }, get last() { return lastBuild; } };
  window.CranePickDrawingsUI = api;
})();
