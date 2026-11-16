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
  function build(paper, half) { const c = ctx(); const B = window.CranePickDrawSet.build(A.P, c, { paper, half }); B.ctx = c; return B; }
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
        <button type="button" id="dwg_print1">Print sheet</button><button type="button" id="dwg_printAll">Print all sheets (${sh.length})</button></div>
      <p class="note"><b>Lift-planning aid:</b> the crane manufacturer's load charts and instructions, the lift plan and the site checks govern; every sheet says so. ${esc(SharedDxf.PRINT_NOTE)}${paper === 'B' ? '' : ' Paper D prints half size on 11 × 17 (each sheet at half its stated scale; the title block says so).'}</p>
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
    viewer = SharedDxf.viewer(el.querySelector('.dwg-box'), SharedDxf.toSVG(B.D, { i0: cur.i0, i1: cur.i1, bg: '#fff', title: cur.title }), { height: '68vh', level: z, onchange: sync });
  }
  function set(k, v) { st()[k] = v; A.saveUi(); draw(); }
  function prt(all) {
    const u = st(), paper = u.paper === 'B' ? 'B' : 'D'; let B;
    try { B = paper === 'D' ? build('D', true) : (lastBuild || build('B')); } catch (e) { A.notice('The sheets could not be drawn: ' + esc(e.message), 'err'); return null; }
    const list = all ? B.sheets : B.sheets.filter(s => s.id === u.sheet);
    const r = SharedDxf.printSheets((list.length ? list : B.sheets.slice(0, 1)).map(s => ({ svg: SharedDxf.sheetSVG(B.D, s), title: s.title })), { paper: window.CranePickDrawSet.PAPER.B });
    api.lastPrint = r; return r;
  }
  function download() {
    const B = lastBuild || build(st().paper === 'B' ? 'B' : 'D'), txt = B.D.toDXF({ ltscale: 1 }), chk = SharedDxf.validate(txt);
    api.lastDxf = { text: txt, check: chk };
    if (!chk.ok) { A.notice('The DXF file failed its structure check: ' + esc(chk.errors.slice(0, 6).join('; ')), 'err'); return; }
    SharedDxf.download(txt, `${((A.P.title && A.P.title.name) || 'crane-lift-plan').replace(/[^\w.-]+/g, '_')}_lift_plan.dxf`);
  }
  function onClick(e) {
    const t = e.target;
    if (t.id === 'dwg_dxf') return download();
    if (t.id === 'dwg_print1') return prt(false);
    if (t.id === 'dwg_printAll') return prt(true);
    const a = t.closest('[data-dgo],[data-dgi],[data-dgr]');
    if (a) { e.preventDefault(); if (a.dataset.dgo) A.showOTab(a.dataset.dgo); else if (a.dataset.dgi) A.showITab(a.dataset.dgi); else gotoReport(a.dataset.dgr); return; }
    const tr = t.closest('[data-dsheet]'); if (tr) set('sheet', tr.dataset.dsheet);
  }
  function onChange(e) {
    const t = e.target;
    if (t.id === 'dwg_paper') set('paper', t.value); else if (t.id === 'dwg_sheet') set('sheet', t.value);
    else if (t.id === 'dwg_z' && t.value !== 'c') { st().z = +t.value; A.saveUi(); if (viewer) viewer.set(+t.value); }
  }
  function css() {
    if (document.getElementById('dwg-css')) return; const s = document.createElement('style'); s.id = 'dwg-css';
    s.textContent = '.dwg-box{border:1px solid var(--line);background:#fff;} .dwg-bar{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin:4px 0 8px;font-size:9pt;} .dwg-bar select{width:auto;max-width:100%;} .dwg-idx tr{cursor:pointer;} .dwg-idx tr.on{background:#eef4ff;}';
    document.head.appendChild(s);
  }
  /* show(sheetId): open the tab at a sheet (the Summary tab's links) */
  function show(id) { if (id) { st().sheet = id; A.saveUi(); } dirty = true; A.showOTab('dwg'); }
  A.outTab({ id: 'dwg', label: 'Drawings', before: 'rpt', build: p => { el = p; css(); p.addEventListener('click', onClick); p.addEventListener('change', onChange); }, show: () => { if (dirty) draw(); } });
  const mark = () => { dirty = true; if (A.ui.otab === 'dwg') draw(); };
  A.on('project', mark); A.on('change', o => { if (o.kind !== 'select' && o.kind !== 'select-lift') mark(); });
  const api = { redraw: mark, show, build, print: prt, download, lastPrint: null, lastDxf: null, get viewer() { return viewer; }, get last() { return lastBuild; } };
  window.CranePickDrawingsUI = api;
})();
