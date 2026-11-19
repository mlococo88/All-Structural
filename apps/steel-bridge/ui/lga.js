/* apps/steel-bridge/ui/lga.js — the "Import MIDAS (.lga)" and "Export to MIDAS (.lga)" buttons, their dialogs and the help text
   (window.SBDLgaUI). Added 2026-11-19 (fixlog/steel-bridge.md, LGA). The mapping is engine/lga.js (window.SBDLga); this file only reads
   the file (FileReader: works from file://), asks, downloads (a Blob link) and shows the reports. Nothing is stored in browser storage.
   init(ctx): ctx = { getP: () => project, dirty: () => unsaved changes?, loadNew: project => open it as a new project,
                      replace: project => replace the open project (one undo step), calc: () => calculate }. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let ctx = null, dlg = null;
  const CSS = `#lgaDlg{border:1px solid #94A3B8;border-radius:8px;padding:12px 16px;width:min(980px,94vw);max-height:88vh;overflow:auto;font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-size:10pt;color:#0F172A;}
#lgaDlg::backdrop{background:rgba(15,23,42,.45);} #lgaDlg h2{font-size:13pt;margin:0 0 6px;} #lgaDlg h3{font-size:10.5pt;margin:12px 0 4px;}
#lgaDlg .lgaBtns{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;margin-top:10px;position:sticky;bottom:-12px;background:#fff;padding:6px 0;}
#lgaDlg .lgaScroll{overflow-x:auto;} #lgaDlg table{border-collapse:collapse;width:100%;font-size:9pt;} #lgaDlg td,#lgaDlg th{border:1px solid #E4E7EB;padding:3px 5px;text-align:left;vertical-align:top;}
#lgaDlg th{background:#F1F3F5;} #lgaDlg .lgaConv{color:#475569;font-size:8.5pt;} #lgaDlg ul{margin:4px 0;padding-left:18px;} #lgaDlg li{margin:2px 0;}
#lgaDlg .lgaWarn{border-left:4px solid #B45309;background:#FFFBEB;padding:4px 8px;margin:4px 0;} #lgaDlg .lgaInfo{border-left:4px solid #1E3A5F;background:#EFF6FF;padding:4px 8px;margin:4px 0;}
#lgaDlg .lgaErr{border-left:4px solid #DC2626;background:#FEF2F2;padding:4px 8px;margin:4px 0;} #lgaDlg label.lgaOpt{display:flex;gap:8px;align-items:flex-start;margin:6px 0;}
#lgaDlg code{font-size:9pt;} #lgaDlg .lgaCount{color:#475569;font-size:9pt;}`;

  function ensureDlg() {
    if (dlg) return dlg;
    const st = document.createElement('style'); st.id = 'lgaCss'; st.textContent = CSS; document.head.appendChild(st);
    dlg = document.createElement('dialog'); dlg.id = 'lgaDlg'; dlg.setAttribute('aria-labelledby', 'lgaTitle'); document.body.appendChild(dlg);
    dlg.addEventListener('click', e => { const b = e.target.closest('[data-lga]'); if (!b) return; const a = b.dataset.lga;
      if (a === 'close') dlg.close(); else if (a === 'help') showHelp(); else if (dlg._act && dlg._act[a]) dlg._act[a](b); });
    return dlg;
  }
  function open(html, act) { const d = ensureDlg(); d.innerHTML = html; d._act = act || {}; if (!d.open) d.showModal(); d.scrollTop = 0; const f = d.querySelector('[data-lga-focus]') || d.querySelector('button'); if (f) f.focus(); }
  function download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' })); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  /* ---------- import ---------- */
  let fileIn = null;
  function pickFile() {
    if (!fileIn) { fileIn = document.createElement('input'); fileIn.type = 'file'; fileIn.accept = '.lga,application/json,.json'; fileIn.hidden = true; fileIn.id = 'fLga'; document.body.appendChild(fileIn);
      fileIn.addEventListener('change', () => { const f = fileIn.files[0]; if (!f) return; const rd = new FileReader();
        rd.onload = () => { fileIn.value = ''; let obj; try { obj = JSON.parse(String(rd.result)); } catch (e) { alert('Not a MIDAS .lga file (not JSON): ' + e.message); return; }
          if (!obj || obj.app !== 'Line Girder Analysis' || !obj.project) { alert('Not a MIDAS Line Girder Analysis (.lga) file. Nothing was changed.'); return; }
          askMode(obj, f.name); };
        rd.readAsText(f); }); }
    fileIn.click();
  }
  function askMode(obj, fileName) {
    const L = obj.project || {};
    open(`<h2 id="lgaTitle">Import MIDAS (.lga)</h2>
      <p><b>${esc(fileName)}</b>: ${esc(L.project_name || 'no name')}, ${esc((L.span_lengths || []).length)} span(s) (${esc((L.span_lengths || []).join(', '))} ft), ${esc(L.num_girders)} girders.</p>
      <p>Import as a <b>new project</b> (the open project is replaced; save it first to keep it), or <b>into the open project</b>: the inputs the file has replace the open project's, every other input of the open project is kept (one Undo step).</p>
      <div class="lgaBtns"><button type="button" data-lga="help">Help</button><button type="button" data-lga="close">Cancel</button><button type="button" data-lga="cur">Into the open project</button><button type="button" class="primary" data-lga="new" data-lga-focus>New project</button></div>`,
      { new: () => run(obj, fileName, false), cur: () => run(obj, fileName, true) });
  }
  function run(obj, fileName, into) {
    const LG = window.SBDLga;
    if (!into && ctx.dirty && ctx.dirty() && !confirm('The project on screen has unsaved changes. Import the .lga file as a new project anyway? (Cancel, then Save, keeps them.)')) return;
    const r = LG.fromLga(obj, { base: into ? ctx.getP() : null, fileName });
    if (!r.ok) { open(`<h2 id="lgaTitle">Import MIDAS (.lga)</h2><div class="lgaErr">${esc(r.error)}</div><div class="lgaBtns"><button type="button" data-lga="close" data-lga-focus>Close</button></div>`); return; }
    if (into) ctx.replace(r.project); else ctx.loadNew(r.project);
    try { if (ctx.calc) ctx.calc(); } catch (e) { /* the page shows its own message */ }
    showReport(r.report, fileName);
  }
  function showReport(R, fileName) {
    const LG = window.SBDLga, rows = R.mapped.map(m => `<tr><td>${esc(m.sec)}</td><td><code>${esc(m.lga)}</code></td><td>${esc(m.from)}</td><td>${esc(m.app)}</td><td>${esc(m.to)}${m.conv ? `<div class="lgaConv">${esc(m.conv)}</div>` : ''}</td></tr>`).join('');
    const ign = R.ignored.map(q => `<tr><td><code>${esc(q.lga)}</code></td><td>${esc(q.value)}</td><td>${esc(q.why)}</td></tr>`).join('');
    const conv = R.mapped.filter(m => m.conv);
    open(`<h2 id="lgaTitle">MIDAS .lga import report</h2>
      <p class="lgaCount">${esc(fileName)} (format ${esc(R.file.version)}, MIDAS ${esc(R.file.app_version)}, saved ${esc(R.file.saved)}): ${R.mapped.length} mapped, ${R.incons.length} inconsistenc${R.incons.length === 1 ? 'y' : 'ies'}, ${R.ignored.length} not supported or ignored. The bridge was generated; check it before use.</p>
      ${R.errors && R.errors.length ? `<div class="lgaErr"><b>Input errors after the import</b> (fix them on the input tabs):<ul>${R.errors.map(e => `<li>${esc(e.msg)}</li>`).join('')}</ul></div>` : ''}
      ${R.info.length ? `<h3>Notes</h3>${R.info.map(t => `<div class="lgaInfo">${esc(t)}</div>`).join('')}` : ''}
      <h3>Inconsistencies found in the file</h3>${R.incons.length ? R.incons.map(q => `<div class="lgaWarn"><b>${esc(q.what)}.</b> ${esc(q.detail)}</div>`).join('') : '<p>None found.</p>'}
      <h3>Conversions (MIDAS and the app define these differently)</h3><ul>${conv.map(m => `<li><code>${esc(m.lga)}</code>: ${esc(m.conv)}</li>`).join('')}</ul>
      <h3>Fields mapped (MIDAS value → app input)</h3><div class="lgaScroll"><table><thead><tr><th>Group</th><th>MIDAS field</th><th>MIDAS value</th><th>App input</th><th>App value</th></tr></thead><tbody>${rows}</tbody></table></div>
      <h3>Not supported or ignored</h3><div class="lgaScroll"><table><thead><tr><th>MIDAS field</th><th>Value</th><th>Why</th></tr></thead><tbody>${ign}</tbody></table></div>
      <div class="lgaBtns"><button type="button" data-lga="help">Help</button><button type="button" data-lga="txt">Download report (.txt)</button><button type="button" class="primary" data-lga="close" data-lga-focus>Close</button></div>`,
      { txt: () => download(String(fileName || 'midas').replace(/\.lga$/i, '') + '-import-report.txt', LG.reportText(R, 'MIDAS .lga import report: ' + fileName), 'text/plain') });
  }

  /* ---------- export ---------- */
  function askExport() {
    open(`<h2 id="lgaTitle">Export to MIDAS (.lga)</h2>
      <p>Writes a MIDAS Civil NX Line Girder Analysis file of the open project (all 141 fields of the format; MIDAS defaults for what the app does not model).</p>
      <label class="lgaOpt"><input type="checkbox" id="lgaO1" checked><span><b>Distribution factors as user-defined</b> (lldf_mode user): MIDAS uses the app's live load distribution factors.</span></label>
      <label class="lgaOpt"><input type="checkbox" id="lgaO2" checked><span><b>Modular ratio n written explicitly</b> (n_override on): MIDAS uses the app's n.</span></label>
      <label class="lgaOpt"><input type="checkbox" id="lgaO3" checked><span><b>Dead-load distribution as Custom percentages</b> equal to the app's split of DC1, DC2 and DW.</span></label>
      <div class="lgaBtns"><button type="button" data-lga="help">Help</button><button type="button" data-lga="close">Cancel</button><button type="button" class="primary" data-lga="go" data-lga-focus>Export</button></div>`,
      { go: () => doExport({ lldfUser: dlg.querySelector('#lgaO1').checked, nExplicit: dlg.querySelector('#lgaO2').checked, dlCustom: dlg.querySelector('#lgaO3').checked }) });
  }
  function doExport(opt) {
    const LG = window.SBDLga, P = ctx.getP();
    let c; try { c = LG.exportCalc(P); } catch (e) { c = { errors: [e.message] }; }
    const r = c.errors && c.errors.length ? { ok: false, error: 'The project cannot be exported until its input errors are fixed: ' + c.errors.join(' ') } : LG.toLga(P, opt, c);
    if (!r.ok) { open(`<h2 id="lgaTitle">Export to MIDAS (.lga)</h2><div class="lgaErr">${esc(r.error)}</div><div class="lgaBtns"><button type="button" data-lga="close" data-lga-focus>Close</button></div>`); return; }
    download(r.name, r.text);
    const S = r.summary, li = a => a.map(t => `<li>${esc(t)}</li>`).join('');
    open(`<h2 id="lgaTitle">Exported: ${esc(r.name)}</h2>
      <p class="lgaCount">The file was downloaded. Open it in MIDAS Civil NX (Line Girder Analysis) and check the model before use.</p>
      ${S.info.length ? `<h3>Notes</h3>${S.info.map(t => `<div class="lgaInfo">${esc(t)}</div>`).join('')}` : ''}
      <h3>Approximations</h3>${S.approx.length ? S.approx.map(t => `<div class="lgaWarn">${esc(t)}</div>`).join('') : '<p>None.</p>'}
      <h3>What was written</h3><ul>${li(S.written)}</ul>
      <div class="lgaBtns"><button type="button" data-lga="help">Help</button><button type="button" data-lga="again">Download again</button><button type="button" class="primary" data-lga="close" data-lga-focus>Close</button></div>`,
      { again: () => download(r.name, r.text) });
  }

  /* ---------- help (the manual section for the MIDAS import and export) ---------- */
  function showHelp() {
    open(`<h2 id="lgaTitle">MIDAS Line Girder Analysis (.lga): import and export</h2>
      <h3>What it does</h3>
      <p><b>Import MIDAS (.lga)</b> (Project tab, Save and open) reads a MIDAS Civil NX Line Girder Analysis project file and builds the bridge in this app: spans, girders and spacing, overhangs, skew, barriers, deck, haunch, deck reinforcement, plates of every girder (girders with the same plates and position become one girder type), steel and concrete, dead loads, IM, ADTT and detail category, user distribution factors, cross-frames, field splices, transverse stiffeners, studs and the deck pour sequence. A report lists every field mapped (MIDAS value → app input, with the conversion), every field not supported or ignored, and the inconsistencies found inside the file. Import as a new project, or into the open project (its other inputs are kept; one Undo step).</p>
      <p><b>Export to MIDAS (.lga)</b> writes the open project as a .lga file named after the project, with all 141 fields of the format. A summary lists what was written and every approximation.</p>
      <h3>Conversions</h3><ul>
        <li>Haunch: MIDAS measures from the <b>top of the web</b> to the deck soffit; the app from the <b>top of the steel</b>. App haunch = d_haunch − the thickest top flange.</li>
        <li>Deck: t_deck = the structural slab; t_deck + t_wear_integral = the total deck thickness (the wearing surface is dead load only).</li>
        <li>Deck rebar: bar area at a spacing → A_r = whole bars in the interior girder's b_eff × bar area; centroid = cover + half the bar.</li>
        <li>ADTT_SL = p × ADTT (p from the number of lanes, Table 3.6.1.4.2-1).</li>
        <li>n (or E_c) from MIDAS → the app's "w_c for E_c" giving the same n.</li>
        <li>User LLDF: g = max(1 lane, 2+ lanes); fatigue = 1 lane / 1.2. On export, 1 lane = the app's fatigue factor × 1.2 and 2+ lanes = its governing factor.</li>
        <li>Loads per girder (w_misc, w_utilities) → bridge totals shared equally; ksf → psf.</li></ul>
      <h3>Export options</h3><ul>
        <li><b>Distribution factors as user-defined</b> (default on): MIDAS uses the app's factors (largest of the spans and piers per girder position).</li>
        <li><b>n written explicitly</b> (default on): MIDAS uses the app's modular ratio.</li>
        <li><b>Dead-load distribution as Custom percentages</b> (default on): MIDAS shares DC1, DC2 and DW as the app does (deck by tributary width).</li></ul>
      <h3>Limits</h3><ul>
        <li>One deck reinforcement, one stud layout and one set of field splices for the bridge; one skew, spacing and overhang in MIDAS (averages or the largest are written, and said so).</li>
        <li>Curved girders, tee stiffeners, stiffener zones with a length, bearing-stiffener entries, MIDAS load combinations other than Strength I, Service II and Fatigue I / II, resistance factors and design points are not imported (listed in the report).</li>
        <li>MIDAS fields the app does not model are kept from an imported file and written back on export. midas_url is never stored and is written empty.</li>
        <li>Multi-span files: the span-by-span fields follow the structure of a single-span MIDAS sample; they are unverified until a multi-span MIDAS file is checked.</li></ul>
      <div class="lgaBtns"><button type="button" class="primary" data-lga="close" data-lga-focus>Close</button></div>`);
  }

  function init(c) {
    ctx = c;
    // delegated: the two buttons live in the Project tab's "Save and open" card, detached from the page until that tab is drawn
    document.addEventListener('click', e => { const t = e.target && e.target.closest ? e.target.closest('#bLgaIn, #bLgaOut') : null; if (!t) return; if (t.id === 'bLgaIn') pickFile(); else askExport(); });
  }
  window.SBDLgaUI = { init, showHelp, showReport, importObject: (obj, name, into) => run(obj, name || 'file.lga', !!into), exportNow: doExport };
})();
