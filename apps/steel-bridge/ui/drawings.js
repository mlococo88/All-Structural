/* apps/steel-bridge/ui/drawings.js — the "Drawings" output tab (window.SBDDrawingsUI): the drawing set (engine/sheets.js: every sheet
   GirderDetail exports, each with its border and title block) as SVG previews and one DXF file (R12, shared/dxf.js). Classic script.
   Display and export only. Needs SharedDxf, SharedUnits, SBDDrawings, SBDSheets and the engines they read.

   Replaces GirderDetail's DXF export, which ran the Python library ezdxf in the browser (Pyodide, a download of about 10 MB on first use;
   docs/REBUILD_PLAN.md §5 "Libraries"): the previews are drawn from the same entity list as the file (SharedDxf.toSVG), so the preview is
   the file.

   Results: the sheets that show results (field splices, analysis diagrams, moment envelope and camber, design summary, reactions,
   fatigue, flange transitions, stud zones when none are entered) take them from the same functions as their tabs (SBDSheets.results:
   report/data.js and ui/welds.js), calculated on demand ("Calculate results": one analysis per plate girder, about 15 s each) and kept
   until the project changes (not saved). The 3D view's diagrams and splice plates read the same results (results(P) below).

   render(host, ctx), ctx = { P, g, ui, saveUi, goto(tab) }; results(P) -> the kept results of P or null; calc(P) -> computes them. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d) => window.SharedUnits.fmt(x, d);
  const S = { key: '', RS: null, err: '' };
  const ZOOM = [[1, 'Fit'], [2, '200 %'], [4, '400 %'], [8, '800 %']];
  /* the tab where each sheet's content is worked (CLAUDE.md §6: link to the derivation) */
  const SRC = { plan: ['cf', 'Cross-frames'], erect: ['an', 'Analysis (detail allowance)'], elev: ['an', 'Analysis (camber)'], sec: ['loads', 'Cross-section & loads'], spl: ['spl', 'Field splices'], diag: ['an', 'Analysis'],
    summ: ['rpt', 'Report (summary)'], reac: ['an', 'Analysis (reactions)'], fat: ['fat', 'Fatigue & studs'], oh: ['cn', 'Constructibility'], bs: ['shear', 'Shear & stiffeners'], cf: ['cf', 'Cross-frames'],
    ts: ['shear', 'Shear & stiffeners'], sc: ['fat', 'Fatigue & studs'], wt: ['wt', 'Welds'] };
  const srcOf = id => SRC[id] || SRC[id.replace(/\d.*$/, '').replace(/^gelev$/, 'elev').replace(/^spl.*/, 'spl')] || (/^gelev/.test(id) ? SRC.elev : /^spl/.test(id) ? SRC.spl : /^diag/.test(id) ? SRC.diag : null);

  function css() {
    if (document.getElementById('dwg-css')) return;
    const st = document.createElement('style'); st.id = 'dwg-css';
    st.textContent = `.dwg-box{border:1px solid var(--line);background:#fff;} .dwg-bar{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin:4px 0 8px;font-family:var(--font-ui);font-size:9pt;}
      .dwg-bar select{width:auto;} .dwg-idx td,.dwg-idx th{padding:2px 6px;} .dwg-idx tr.on{background:#eef4ff;} .dwg-idx tr{cursor:pointer;}`;
    document.head.appendChild(st);
  }
  const keyOf = P => JSON.stringify(P);
  const results = P => (S.RS && S.key === keyOf(P) ? S.RS : null);
  function model(P, RS) {
    const ent = (P.studs && P.studs.zones) || [];
    let zones = null; if (!ent.length && RS) for (const pg of RS.pgs) { const F = RS.pg[pg].fat; if (F && F.SR && F.SR.zones && F.SR.zones.length) { zones = F.SR.zones.map(q => ({ x1: q.x1, x2: q.x2, nr: q.nr, p: q.p })); break; } }
    return window.SBDDrawings.model(P, zones ? { studZones: zones } : {});
  }
  function calc(P) {
    S.err = ''; S.RS = null;
    try { const G = window.SBDDrawings.model(P); if (G.errors.length) throw new Error(G.errors.join(' ')); S.RS = window.SBDSheets.results(P, G); }
    catch (e) { S.err = e.message; }
    S.key = keyOf(P); return S.RS;
  }

  function render(host, ctx) {
    css(); const P = ctx.P, ui = ctx.ui; ui.dwg = ui.dwg || {};
    const RS = results(P), stale = !RS && S.key && S.key !== keyOf(P);
    let G; try { G = model(P, RS); } catch (e) { G = { errors: [`The drawings could not be built: ${e.message}`] }; }
    if (G.errors.length) { host.innerHTML = `<section class="sec"><div class="secHead">Drawings</div><div class="secBody"><div class="alert err">${G.errors.map(esc).join('<br>')}</div><p class="note">The drawings need the cross-section (Cross-section &amp; loads tab) and the framing (Framing tab).</p></div></section>`; return; }
    const paper = ui.dwg.paper === 'B' ? 'B' : 'D', z = ZOOM.some(q => q[0] === ui.dwg.z) ? ui.dwg.z : 1;
    let B; try { B = window.SBDSheets.build(G, RS, { paper }); } catch (e) { host.innerHTML = `<div class="alert err">The drawings could not be drawn: ${esc(e.message)}</div>`; return; }
    const sh = B.sheets, cur = sh.find(s => s.id === ui.dwg.sheet) || sh[0], SN = window.SBDDrawings.SCALE_NAME;
    const nInt = G.frames.filter(f => f.type !== 'sup').length, nEnd = G.frames.length - nInt, spc = G.ys.slice(1).map((y, i) => y - G.ys[i]), pgs = [...new Set(G.girders.map(g => g.pg))];
    const link = (id, t) => `<a class="wk" href="#" data-dgo="${id}">${esc(t)}</a>`;
    let h = `<section class="sec"><div class="secHead">Drawings (DXF R12): ${sh.length} sheets</div><div class="secBody">
      <div class="dwg-bar">${RS ? `<span>Results: calculated (${pgs.length} plate girder${pgs.length > 1 ? 's' : ''})</span><button type="button" id="dwg_calc">Recalculate</button>`
        : `<button type="button" class="primary" id="dwg_calc">Calculate results</button><span class="note" style="margin:0">${stale ? 'The project changed: results out of date. ' : ''}One analysis per plate girder (${pgs.length}), about 15 s each; needed for the splice, analysis, summary, reactions, fatigue, camber, stud and flange transition sheets.</span>`}
        ${S.err ? `<span class="nt">${esc(S.err)}</span>` : ''}</div>
      <div class="dwg-bar"><label for="dwg_paper">Paper</label><select id="dwg_paper"><option value="D"${paper === 'D' ? ' selected' : ''}>D, 34 × 22 in</option><option value="B"${paper === 'B' ? ' selected' : ''}>B, 17 × 11 in</option></select>
        <label for="dwg_sheet">Sheet</label><select id="dwg_sheet">${sh.map(s => `<option value="${esc(s.id)}"${s === cur ? ' selected' : ''}>${s.n}. ${esc(s.title)}</option>`).join('')}</select>
        <label for="dwg_z">Preview</label><select id="dwg_z">${ZOOM.map(([k, l]) => `<option value="${k}"${k === z ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <button type="button" class="primary" id="dwg_dxf">Download DXF (${sh.length} sheets)</button></div>
      <div class="kv"><div><span>Girders</span><span>${G.nb}</span></div><div><span>Spacing (ft)</span><span>${spc.map(v => fmt(v, 2)).join(', ')}</span></div>
        <div><span>Cross-frames, intermediate / end</span><span>${nInt} / ${nEnd} ${link('cf', 'Cross-frames tab')}</span></div>
        <div><span>Field splices (ft)</span><span>${G.splices.length ? G.splices.map(v => fmt(v, 2)).join(', ') : 'none'}</span></div></div>
      ${G.warnings.length ? `<div class="alert">${G.warnings.map(esc).join('<br>')}</div>` : ''}
      <p class="note">One DXF file (AutoCAD R12, model space, full size in inches): each sheet is drawn at its plot scale inside its border and title block (paper ${paper === 'D' ? 'D, 34 × 22' : 'B, 17 × 11'} in), side by side, GirderDetail's sheet layout; plot each sheet at its scale. Layers S-GRDR…, S-XFRM…, S-DIMS…, S-TBLK, S-BRDR; dimensions are DIMENSION entities. The previews are drawn from the same entities as the file. Display only: every value is worked on the tab linked in the index.</p></div></section>`;
    h += `<section class="sec"><div class="secHead">${esc(cur.n + '. ' + cur.title)} <span style="font-weight:400;text-transform:none">· scale ${esc(SN[cur.k] || '1:' + cur.k)}${cur.over ? ' · does not fit the sheet even at the largest scale' : ''}</span></div><div class="secBody">
      <div class="dwg-box" data-dwg="${esc(cur.id)}"></div><p class="note">Wheel: zoom about the cursor · drag: pan · pinch and two-finger drag on a touch screen · double-click or double-tap: fit.</p></div></section>`;
    h += `<section class="sec"><div class="secHead">Sheet index</div><div class="secBody"><div class="tscroll"><table class="tbl dwg-idx"><thead><tr><th>No.</th><th class="lft">Title</th><th>Scale</th><th class="lft">Worked on</th></tr></thead><tbody>
      ${sh.map(s => { const w = srcOf(s.id); return `<tr data-dsheet="${esc(s.id)}"${s === cur ? ' class="on"' : ''}><td>${s.n}</td><td class="lft">${esc(s.title)}</td><td>${esc(SN[s.k] || '1:' + s.k)}</td><td class="lft">${w ? link(w[0], w[1] + ' tab') : '—'}</td></tr>`; }).join('')}</tbody></table></div>
      ${B.miss.length ? `<p class="note"><b>Not in this set:</b> ${B.miss.map(([w, r]) => `${esc(w)} (${esc(r.toLowerCase())})`).join('; ')}.</p>` : ''}</div></section>`;
    // quantities, with the weld metal worked (CLAUDE.md §6)
    const Q = B.Q, gam = window.SBDSheets.GAM, fr = v => window.SharedDxf.frac(v);
    h += `<section class="sec" id="dwg-q"><div class="secHead">Quantities (typical section sheet)</div><div class="secBody"><div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Item</th><th>Quantity</th><th>Unit</th></tr></thead><tbody>
      ${Q.rows.map(r => `<tr><td class="lft">${esc(r[0].toLowerCase())}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">Girder plates: Σ L × (b<sub>top</sub>t<sub>top</sub> + b<sub>bot</sub>t<sub>bot</sub> + D t<sub>w</sub>) × 490/1728 lb/in³ over every plate segment of every girder line (its own length). Studs: per zone ⌊L/p + 1⌋ × studs per row. Bolts: per splice 4 n<sub>rows</sub> n<sub>lines</sub> per flange + 2 × web bolts (Field splices tab).</p>
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Weld</th><th>w (in)</th><th>Lines</th><th>Length (ft)</th><th class="lft">Weld metal = w²/2 × L × γ</th></tr></thead><tbody>
      ${Q.welds.map(q => `<tr><td class="lft">${esc(q.k.toLowerCase())}</td><td>${fr(q.w)}</td><td>${q.lines}</td><td>${fmt(q.Lft, 1)}</td><td class="lft">(${fmt(q.w, 4)})²/2 × ${fmt(q.L, 1)} in × ${fmt(gam, 5)} lb/in³ = <b>${fmt(q.wt, 1)} lb</b></td></tr>`).join('')}</tbody></table></div>
      <p class="note">Fillet weld sizes: flange-to-web as the Welds tab (entered size, else the minimum of Table 6.13.3.4-1 for the thickest plate, ${'AASHTO LRFD 10th Ed.'}); stiffeners and connection plates the w of their types (Shear &amp; stiffeners inputs). Welded lengths: stiffener D − clip − gap, connection plate D − 2 clips (+ 2 × (b − clip) to each flange), bearing stiffener D − 2 clips.</p></div></section>`;
    host.innerHTML = h;
    // the preview: pan and zoom (shared/dxf.js viewer); the Preview drop-down synced with the wheel, drag, pinch and buttons
    const zs = host.querySelector('#dwg_z'), sync = L => { const m = ZOOM.find(q => Math.abs(q[0] - L) < 0.005); let c = zs.querySelector('option[data-custom]');
      if (m) { zs.value = String(m[0]); if (c) c.hidden = true; return; }
      if (!c) { c = document.createElement('option'); c.dataset.custom = '1'; c.value = 'c'; zs.appendChild(c); } c.hidden = false; c.textContent = `${Math.round(L * 100)} %`; zs.value = 'c'; };
    const VW = window.SharedDxf.viewer(host.querySelector('.dwg-box'), window.SharedDxf.toSVG(B.D, { i0: cur.i0, i1: cur.i1, bg: '#fff', title: cur.title }), { height: '72vh', level: z, onchange: sync });
    S.viewer = VW;
    const set = (k, v) => { ui.dwg[k] = v; ctx.saveUi && ctx.saveUi(); render(host, ctx); };
    host.querySelector('#dwg_paper').addEventListener('change', e => set('paper', e.target.value));
    host.querySelector('#dwg_sheet').addEventListener('change', e => set('sheet', e.target.value));
    zs.addEventListener('change', e => { if (e.target.value === 'c') return; ui.dwg.z = +e.target.value; ctx.saveUi && ctx.saveUi(); VW.set(+e.target.value); });
    host.querySelectorAll('[data-dsheet]').forEach(tr => tr.addEventListener('click', e => { if (e.target.closest('a')) return; set('sheet', tr.dataset.dsheet); }));
    host.querySelectorAll('[data-dgo]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); ctx.goto && ctx.goto(a.dataset.dgo); }));
    host.querySelector('#dwg_dxf').addEventListener('click', () => {
      const txt = B.D.toDXF({ ltscale: 1 }), chk = window.SharedDxf.validate(txt);
      if (!chk.ok) { alert(`The DXF file failed its structure check:\n${chk.errors.slice(0, 8).join('\n')}`); return; }
      window.SharedDxf.download(txt, `${((P.project && P.project.name) || 'steel-bridge').replace(/[^\w.-]+/g, '_')}_drawings.dxf`);
    });
    const cb = host.querySelector('#dwg_calc');
    cb.addEventListener('click', () => { cb.disabled = true; cb.textContent = 'Calculating…'; setTimeout(() => { calc(P); render(host, ctx); }, 30); });
  }

  window.SBDDrawingsUI = { render, results, calc, viewer: () => S.viewer };
})();
