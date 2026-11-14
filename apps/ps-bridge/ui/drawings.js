/* apps/ps-bridge/ui/drawings.js — the "Drawings" output tab, part 1 (window.PSBDrawingsUI): the typical section of each span and the
   framing plan (ui/sheets.js, PSBSheets.build: each sheet with its border and title block) as SVG previews and one DXF file (R12,
   shared/dxf.js), with Print sheet / Print all sheets. Classic script. Display and export only. Created 2026-11-14 (PS Bridge catch-up
   to the Steel Bridge app, item 10, part 1). The Steel Bridge app's Drawings tab (apps/steel-bridge/ui/drawings.js) is the reference:
   the same bar (Paper, Sheet, Preview, Download DXF, Print sheet, Print all sheets), the preview drawn from the same entity list as the
   file (SharedDxf.toSVG: the preview is the file), the sheet index with the tab where each sheet's content is worked. No results are
   needed (part 1 is geometry only), so there is no "Calculate results".

   render(host, ctx), ctx = { P, ui, saveUi, goto(output tab), goin(input tab) }; the choices are kept in ui.dwg { paper, sheet, z }
   (psb2.ui, per browser; nothing in the project). */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ZOOM = [[1, 'Fit'], [2, '200 %'], [4, '400 %'], [8, '800 %']];
  const S = { viewer: null };
  /* where each sheet's content is entered and worked (CLAUDE.md §6: link to the derivation): [kind, tab, text] */
  const SRC = { sec: [['out', 'lds', 'Loads & LLDF tab (cross-section, d_e)'], ['in', 'xsec', 'Cross-section input tab']], plan: [['in', 'layout', 'Bridge layout input tab (framing plan)']] };
  const srcOf = id => SRC[id.replace(/\d+$/, '')] || [];

  function css() {
    if (document.getElementById('dwg-css')) return;
    const st = document.createElement('style'); st.id = 'dwg-css';
    st.textContent = `.dwg-box{border:1px solid var(--line);background:#fff;} .dwg-bar{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin:4px 0 8px;font-family:var(--font-ui);font-size:9pt;}
      .dwg-bar select{width:auto;} .dwg-idx td,.dwg-idx th{padding:2px 6px;} .dwg-idx tr.on{background:#eef4ff;} .dwg-idx tr{cursor:pointer;}`;
    document.head.appendChild(st);
  }
  function render(host, ctx) {
    css(); const P = ctx.P, ui = ctx.ui; ui.dwg = ui.dwg || {};
    const paper = ui.dwg.paper === 'B' ? 'B' : 'D', z = ZOOM.some(q => q[0] === ui.dwg.z) ? ui.dwg.z : 1, SH = window.PSBSheets;
    let B; try { B = SH.build(P, { paper }); } catch (e) { host.innerHTML = `<div class="alert err" role="alert">The drawings could not be drawn: ${esc(e.message)}</div>`; return; }
    if (B.errors.length) { host.innerHTML = `<section class="sec"><div class="secHead">Drawings</div><div class="secBody"><div class="alert err">${B.errors.map(esc).join('<br>')}</div><p class="note">The drawings need the girder types on the girder lines (Girders &amp; strands tab), the cross-section and the bridge layout.</p></div></section>`; return; }
    const sh = B.sheets, cur = sh.find(s => s.id === ui.dwg.sheet) || sh[0];
    const link = (w) => `<a class="wk" href="#" data-dg${w[0] === 'out' ? 'o' : 'i'}="${esc(w[1])}">${esc(w[2])}</a>`;
    let h = `<section class="sec"><div class="secHead">Drawings (DXF R12): ${sh.length} sheet${sh.length > 1 ? 's' : ''}, part 1</div><div class="secBody">
      <div class="dwg-bar"><label for="dwg_paper">Paper</label><select id="dwg_paper"><option value="D"${paper === 'D' ? ' selected' : ''}>D, 34 × 22 in</option><option value="B"${paper === 'B' ? ' selected' : ''}>B, 17 × 11 in</option></select>
        <label for="dwg_sheet">Sheet</label><select id="dwg_sheet">${sh.map(s => `<option value="${esc(s.id)}"${s === cur ? ' selected' : ''}>${s.n}. ${esc(s.title)}</option>`).join('')}</select>
        <label for="dwg_z">Preview</label><select id="dwg_z">${ZOOM.map(([k, l]) => `<option value="${k}"${k === z ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <button type="button" class="primary" id="dwg_dxf">Download DXF (${sh.length} sheet${sh.length > 1 ? 's' : ''})</button>
        <button type="button" id="dwg_print1" title="Print the sheet shown on one 11 x 17 in landscape page${paper === 'B' ? ' at its plot scale' : ', half size'}">Print sheet</button>
        <button type="button" id="dwg_printAll" title="Print every sheet, one 11 x 17 in landscape page each${paper === 'B' ? ', at its plot scale' : ', half size'}">Print all sheets (${sh.length})</button></div>
      <p class="note">${esc(window.SharedDxf.PRINT_NOTE)}${paper === 'B' ? '' : ' Paper D (34 × 22 in): the sheets print <b>half size</b> on 11 × 17, each at half its stated scale; the printed scale cell says "(HALF SIZE)" and the note under the title block gives the printed scale. Choose paper B above for 11 × 17 sheets at full scale.'}</p>
      <p class="note">One DXF file (AutoCAD R12, model space, full size in inches): each sheet drawn at its plot scale inside its border and title block (paper ${paper === 'D' ? 'D, 34 × 22' : 'B, 17 × 11'} in), side by side, as the Steel Bridge app's drawing set; plot each sheet at its scale. Layers S-GRDR, S-GRDR-VOID, S-DECK, S-APPR, S-SUPP, S-DIAP, S-CNTR, S-FACE, S-DIMS, S-TEXT, S-TBLK, S-BRDR; dimensions are DIMENSION entities. The previews are drawn from the same entities as the file. Every position is the app's own figure geometry: the cross-section of the Loads &amp; LLDF tab and the framing plan of the Bridge layout tab.</p></div></section>`;
    h += `<section class="sec"><div class="secHead">${esc(cur.n + '. ' + cur.title)} <span style="font-weight:400;text-transform:none">· scale ${esc(SH.SCALE_NAME[cur.k] || '1:' + cur.k)}${cur.over ? ' · does not fit the sheet even at the largest scale' : ''}</span></div><div class="secBody">
      <div class="dwg-box" data-dwg="${esc(cur.id)}"></div><p class="note">Wheel: zoom about the cursor · drag: pan · pinch and two-finger drag on a touch screen · double-click or double-tap: fit.</p></div></section>`;
    h += `<section class="sec"><div class="secHead">Sheet index</div><div class="secBody"><div class="tscroll"><table class="tbl dwg-idx"><thead><tr><th>No.</th><th class="lft">Title</th><th>Scale</th><th class="lft">Entered and worked on</th></tr></thead><tbody>
      ${sh.map(s => `<tr data-dsheet="${esc(s.id)}"${s === cur ? ' class="on"' : ''}><td>${s.n}</td><td class="lft">${esc(s.title)}</td><td>${esc(SH.SCALE_NAME[s.k] || '1:' + s.k)}</td><td class="lft">${srcOf(s.id).map(link).join(' · ') || '—'}</td></tr>`).join('')}</tbody></table></div>
      ${B.miss.length ? `<p class="note"><b>Not in this set:</b> ${B.miss.map(([w, r]) => `${esc(w.toLowerCase())} (${esc(r.toLowerCase())})`).join('; ')}.</p>` : ''}</div></section>`;
    host.innerHTML = h;
    const zs = host.querySelector('#dwg_z'), sync = L => { const m = ZOOM.find(q => Math.abs(q[0] - L) < 0.005); let c = zs.querySelector('option[data-custom]');
      if (m) { zs.value = String(m[0]); if (c) c.hidden = true; return; }
      if (!c) { c = document.createElement('option'); c.dataset.custom = '1'; c.value = 'c'; zs.appendChild(c); } c.hidden = false; c.textContent = `${Math.round(L * 100)} %`; zs.value = 'c'; };
    S.viewer = window.SharedDxf.viewer(host.querySelector('.dwg-box'), window.SharedDxf.toSVG(B.D, { i0: cur.i0, i1: cur.i1, bg: '#fff', title: cur.title }), { height: '72vh', level: z, onchange: sync });
    const set = (k, v) => { ui.dwg[k] = v; ctx.saveUi && ctx.saveUi(); render(host, ctx); };
    host.querySelector('#dwg_paper').addEventListener('change', e => set('paper', e.target.value));
    host.querySelector('#dwg_sheet').addEventListener('change', e => set('sheet', e.target.value));
    zs.addEventListener('change', e => { if (e.target.value === 'c') return; ui.dwg.z = +e.target.value; ctx.saveUi && ctx.saveUi(); S.viewer.set(+e.target.value); });
    host.querySelectorAll('[data-dsheet]').forEach(tr => tr.addEventListener('click', e => { if (e.target.closest('a')) return; set('sheet', tr.dataset.dsheet); }));
    host.querySelectorAll('[data-dgo]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); ctx.goto && ctx.goto(a.dataset.dgo); }));
    host.querySelectorAll('[data-dgi]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); ctx.goin && ctx.goin(a.dataset.dgi); }));
    host.querySelector('#dwg_dxf').addEventListener('click', () => {
      const txt = B.D.toDXF({ ltscale: 1 }), chk = window.SharedDxf.validate(txt);
      if (!chk.ok) { alert(`The DXF file failed its structure check:\n${chk.errors.slice(0, 8).join('\n')}`); return; }
      window.SharedDxf.download(txt, `${((P.project && P.project.name) || 'ps-bridge').replace(/[^\w.-]+/g, '_')}_drawings.dxf`);
    });
    /* Print sheet / Print all sheets on 11 x 17 landscape pages (SharedDxf.printSheets; the steel app's SBPS-3): paper B at the plot scale;
       paper D half size, built for the print with opt.half */
    const prt = all => {
      let PB = B; if (paper === 'D') { try { PB = SH.build(P, { paper: 'D', half: true }); } catch (e) { alert(`The sheets could not be drawn: ${e.message}`); return; } }
      const list = all ? PB.sheets : PB.sheets.filter(s => s.id === cur.id);
      window.SharedDxf.printSheets((list.length ? list : PB.sheets.slice(0, 1)).map(s => ({ svg: window.SharedDxf.sheetSVG(PB.D, s), title: s.title })), { paper: SH.PAPER.B });
    };
    host.querySelector('#dwg_print1').addEventListener('click', () => prt(false));
    host.querySelector('#dwg_printAll').addEventListener('click', () => prt(true));
  }
  window.PSBDrawingsUI = { render, viewer: () => S.viewer };
})();
