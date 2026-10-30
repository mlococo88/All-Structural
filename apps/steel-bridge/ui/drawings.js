/* apps/steel-bridge/ui/drawings.js — the "Drawings" output tab (window.SBDDrawingsUI): framing plan, girder elevation and typical
   cross-section as SVG previews and one DXF file (R12, shared/dxf.js) with the three drawings. Classic script. Display and export only.
   Needs SharedDxf, SharedUnits, SBDDrawings (engine/drawings.js) and the engines it reads; SBDFatigueUI (ui/fatigue.js) only for the
   optional stud zones from the analysis.

   Replaces GirderDetail's DXF export, which ran the Python library ezdxf in the browser (Pyodide, a download of about 10 MB on first use;
   docs/REBUILD_PLAN.md §5 "Libraries"): the previews are drawn from the same entity list as the file (SharedDxf.toSVG), so the preview is
   the file.

   Stud pitch zones: the zones entered on the Fatigue & studs input tab; with none entered, the button "Stud zones from the analysis" takes the
   zones the Fatigue & studs tab makes from this project's analysis (span tenths, about 15 s; kept until the inputs change, not saved).

   render(host, ctx), ctx = { P, g, ui, saveUi, goto(tab) }. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d) => window.SharedUnits.fmt(x, d);
  const S = { zKey: '', zones: null, zErr: '' };
  const ZOOM = [[1, 'Fit'], [2, '200 %'], [4, '400 %'], [8, '800 %']];

  function css() {
    if (document.getElementById('dwg-css')) return;
    const st = document.createElement('style'); st.id = 'dwg-css';
    st.textContent = `.dwg-box{overflow:auto;border:1px solid var(--line);background:#fff;max-height:70vh;-webkit-overflow-scrolling:touch;}
      .dwg-box svg{display:block;height:auto;} .dwg-bar{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin:4px 0 8px;font-family:var(--font-ui);font-size:9pt;}
      .dwg-bar select{width:auto;}`;
    document.head.appendChild(st);
  }
  const zonesKey = P => JSON.stringify([P.spans, P.girders, P.xs, P.deck, P.materials, P.studs, P.fatigue, P.framing, P.analysis, P.ownerRules]);

  function render(host, ctx) {
    css(); const P = ctx.P, ui = ctx.ui; ui.dwg = ui.dwg || {};
    const ent = (P.studs && P.studs.zones) || [], useA = !ent.length && S.zones && S.zKey === zonesKey(P);
    let G; try { G = window.SBDDrawings.model(P, useA ? { studZones: S.zones } : {}); } catch (e) { G = { errors: [`The drawings could not be built: ${e.message}`] }; }
    if (G.errors.length) { host.innerHTML = `<section class="sec"><div class="secHead">Drawings</div><div class="secBody"><div class="alert err">${G.errors.map(esc).join('<br>')}</div><p class="note">The drawings need the cross-section (Cross-section &amp; loads tab) and the framing (Framing tab).</p></div></section>`; return; }
    const FRM = window.SBDFraming, auto = FRM.lineOf(P, P.girders[ctx.g] || P.girders[0]), gi = Number.isInteger(ui.dwg.gi) && ui.dwg.gi >= 0 && ui.dwg.gi < G.nb ? ui.dwg.gi : Math.min(auto, G.nb - 1);
    const z = ZOOM.some(q => q[0] === ui.dwg.z) ? ui.dwg.z : 1;
    let A; try { A = window.SBDDrawings.all(G, { gi }); } catch (e) { host.innerHTML = `<div class="alert err">The drawings could not be drawn: ${esc(e.message)}</div>`; return; }
    const SN = window.SBDDrawings.SCALE_NAME, view = v => window.SharedDxf.toSVG(A.D, { i0: v.i0, i1: v.i1, bg: '#fff', title: v.title });
    const sizeOf = v => { const b = A.D.bbox(v.i0, v.i1); return { w: (b[2] - b[0]) / v.k, h: (b[3] - b[1]) / v.k }; };
    const g = G.girders[gi], nInt = G.frames.filter(f => f.type !== 'sup').length, nEnd = G.frames.length - nInt;
    const spc = G.ys.slice(1).map((y, i) => y - G.ys[i]);
    let h = `<section class="sec"><div class="secHead">Drawings (DXF R12)</div><div class="secBody">
      <div class="dwg-bar"><label for="dwg_gi">Girder elevation</label><select id="dwg_gi">${G.girders.map(q => `<option value="${q.i}"${q.i === gi ? ' selected' : ''}>${q.label}${q.ext ? ' (exterior)' : ''}${q.i === auto ? ' (this plate girder)' : ''}</option>`).join('')}</select>
        <label for="dwg_z">Preview</label><select id="dwg_z">${ZOOM.map(([k, l]) => `<option value="${k}"${k === z ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <button type="button" class="primary" id="dwg_dxf">Download DXF</button></div>
      <div class="kv"><div><span>Girders</span><span>${G.nb}</span></div><div><span>Spacing (ft)</span><span>${spc.map(v => fmt(v, 2)).join(', ')}</span></div>
        <div><span>Cross-frames, intermediate / end</span><span>${nInt} / ${nEnd} <a class="wk" href="#" data-dgo="cf">Cross-frames tab</a></span></div>
        <div><span>Field splices (ft)</span><span>${G.splices.length ? G.splices.map(v => fmt(v, 2)).join(', ') : 'none'}</span></div>
        <div><span>Plate segments, ${esc(g.label)}</span><span>${g.segs.length}</span></div><div><span>Stud pitch zones</span><span>${ent.length ? `${ent.length} entered` : useA ? `${S.zones.length} from the analysis` : 'none'}</span></div></div>
      ${!ent.length && !useA ? `<p class="note">No stud pitch zones are entered (Fatigue &amp; studs input tab). <button type="button" id="dwg_zones">Stud zones from the analysis</button> (runs the analysis, about 15 s)${S.zErr ? ` <span class="nt">${esc(S.zErr)}</span>` : ''}</p>` : ''}
      ${G.warnings.length ? `<div class="alert">${G.warnings.map(esc).join('<br>')}</div>` : ''}
      <p class="note">One DXF file (AutoCAD R12, model space, full size in inches) with the three drawings below, each at its own plot scale; layers S-GRDR…, S-XFRM…, S-DIMS…; dimensions are DIMENSION entities. The previews are drawn from the same entities as the file. Display only: stations from the Framing tab (cross-frames, worked on the Cross-frames tab), plates from the Girders &amp; plates tab, stiffeners from the Stiffeners tab, deck and appurtenances from the Cross-section &amp; loads tab.</p></div></section>`;
    A.views.forEach(v => { const s = sizeOf(v);
      h += `<section class="sec"><div class="secHead">${esc(v.title)} <span style="font-weight:400;text-transform:none">· scale ${esc(SN[v.k])} (${fmt(s.w, 1)} × ${fmt(s.h, 1)} in plotted)</span></div><div class="secBody"><div class="dwg-box" data-dwg="${v.id}"><div style="width:${100 * z}%">${view(v)}</div></div></div></section>`; });
    host.innerHTML = h;
    host.querySelectorAll('.dwg-box svg').forEach(s => { s.style.width = '100%'; });
    host.querySelector('#dwg_gi').addEventListener('change', e => { ui.dwg.gi = +e.target.value; ctx.saveUi && ctx.saveUi(); render(host, ctx); });
    host.querySelector('#dwg_z').addEventListener('change', e => { ui.dwg.z = +e.target.value; ctx.saveUi && ctx.saveUi(); render(host, ctx); });
    host.querySelectorAll('[data-dgo]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); ctx.goto && ctx.goto(a.dataset.dgo); }));
    host.querySelector('#dwg_dxf').addEventListener('click', () => {
      const txt = A.D.toDXF({ ltscale: 1 }), chk = window.SharedDxf.validate(txt);
      if (!chk.ok) { alert(`The DXF file failed its structure check:\n${chk.errors.slice(0, 8).join('\n')}`); return; }
      window.SharedDxf.download(txt, `${((P.project && P.project.name) || 'steel-bridge').replace(/[^\w.-]+/g, '_')}_drawings.dxf`);
    });
    const zb = host.querySelector('#dwg_zones');
    if (zb) zb.addEventListener('click', () => { zb.disabled = true; zb.textContent = 'Running the analysis…';
      setTimeout(() => { try { const B = window.SBDFatigueUI.build({ P, g: ctx.g || 0 }); if (B.err || !B.SR || B.SR.errors.length) { S.zErr = B.err || (B.SR ? B.SR.errors.join(' ') : 'no zones'); S.zones = null; }
        else { S.zones = B.SR.zones.map(q => ({ x1: q.x1, x2: q.x2, nr: q.nr, p: q.p })); S.zKey = zonesKey(P); S.zErr = ''; } } catch (e) { S.zErr = e.message; } render(host, ctx); }, 30); });
  }

  window.SBDDrawingsUI = { render };
})();
