/* apps/ps-bridge/ui/legacy.js — the Project tab's "From the old app" card and the import summary (window.PSBLegacyUI).
   Created 2026-11-13 (docs/ps-bridge-plan.md §5 PR 2f). The data work is engine/legacy.js (PSBLegacy: scan, fromText, convert, verify):
   read only, the old app's keys are never written. This file draws the list of the old app's saved designs, imports the one chosen (or an
   old-app JSON file) into the open project (asks first, as Import JSON and New do), and shows what was imported, what is kept but not used yet,
   what differs and what was not imported (P.legacy.summary, kept in the project).
     card(P)               the HTML of the card (and of the summary when the project was imported)
     onClick(e, ctx)       a click on the card; true = handled. ctx = { store, replace(P), gotoOut(tab), redraw(), pickFile() }
     importText(text, fileName, ctx)   an old-app file (Import JSON of an old file comes here too)
   No storage of its own (the list is read again on each "Find"). */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KIND = { autosave: 'Design on screen (autosave)', project: 'Shared Bridge Suite project', library: 'Older project list', file: 'File' };
  const S = { list: null, sel: '', busy: false };
  const LG = () => window.PSBLegacy;
  const fm = (v, d) => typeof v === 'number' && isFinite(v) ? v.toFixed(d) : (v == null || v === '' ? '—' : esc(v));

  function listHtml() {
    if (!S.list) return '';
    const it = S.list.items;
    let h = S.list.notes.map(n => `<div class="alert">${esc(n)}</div>`).join('');
    if (!it.length) return h + '<p class="note" id="lgNone">No saved design of the old app was found in this browser. In Firefox and Safari each file has its own storage, so this app cannot see the old app\'s data there: open the old app, use its Export JSON, and import that file here.</p>';
    h += `<div class="tscroll"><table class="tbl" id="lgList"><thead><tr><th></th><th class="lft">Where</th><th class="lft">Name</th><th class="lft">Saved</th><th class="lft">Contents</th></tr></thead><tbody>${it.map(x => {
      const d = LG().describe(x);
      const what = [d.girder ? esc(d.girder) : '', typeof +d.L === 'number' && isFinite(+d.L) && d.L !== '' ? `L = ${fm(+d.L, 1)} ft` : '', d.cells ? `bridge model ${d.spans} span${d.spans === 1 ? '' : 's'} × ${esc(d.nGirders)} girders, ${d.cells} design${d.cells === 1 ? '' : 's'} stored` : '', d.ext ? 'MIDAS demands' : '',
        x.kind === 'project' && x.apps ? `with ${x.apps.filter(a => a !== 'psbeam' && a !== 'psbeamBridge').map(esc).join(', ') || 'no other app'}` : ''].filter(Boolean).join('; ');
      return `<tr data-lgrow="${esc(x.id)}"><td><input type="radio" name="lgPick" id="lg_${esc(x.id)}" value="${esc(x.id)}"${S.sel === x.id ? ' checked' : ''} aria-label="Choose ${esc(x.label)}"></td><td class="lft"><label for="lg_${esc(x.id)}">${esc(KIND[x.kind])}${x.current ? ' (open in the old app)' : ''}</label></td><td class="lft">${esc(x.kind === 'autosave' ? (x.name || '—') : x.label)}</td><td class="lft">${esc(x.savedAt ? LG().lt(x.savedAt) : '—')}</td><td class="lft">${what}<div class="note">${esc(x.key)}</div></td></tr>`;
    }).join('')}</tbody></table></div>
      <div class="fRow"><button type="button" class="primary" data-lg="imp"${S.sel ? '' : ' disabled'}>Import the chosen design</button><span class="note">It replaces the open project here (export it first to keep it). One design at a time.</span></div>`;
    return h;
  }
  const GROUPS = [['diff', 'Differences from the old app'], ['err', 'Input errors in this app'], ['kept', 'Kept in the project, not used yet'], ['mig', 'Read as the old app reads older saved designs'],
    ['note', 'Notes'], ['not', 'Not imported']];
  function summaryHtml(P) {
    const L = P && P.legacy; if (!L || !L.summary) return '';
    const it = L.summary.items || [], r = L.summary.results;
    let verdict = '';
    if (!r) verdict = '<div class="alert">The results were not compared on import.</div>';
    else if (r.error) verdict = `<div class="alert err" role="alert"><b>Results:</b> the old app's engine could not compute the old design (${esc(r.error)}).</div>`;
    else if (r.same) verdict = `<div class="srcBar" id="lgRes"><b>Results: the same as the old app.</b> Computed both ways on import — the old saved inputs, as the old app reads them, and this project — with the old app's engine (moved unchanged): every value the same (${r.nChecks} checks), and the same engine warnings.</div>`;
    else if (r.values) verdict = `<div class="srcBar warn" id="lgRes"><b>Results: every value the same as the old app</b> (${r.nChecks} checks, computed both ways on import).${r.record ? '' : ` The record of how the continuous unit was found differs (${r.recDiffs.map(esc).join(', ')}): see the notes.`}${r.warns ? '' : ` Engine warnings differ: ${r.warnDiffs.map(w => '“' + esc(w) + '”').join('; ')}.`}</div>`;
    else verdict = `<div class="alert err" role="alert" id="lgRes"><b>Results differ from the old app's</b> (computed both ways on import), first at: ${r.diffs.map(esc).join(', ')}. The reasons are listed under "Differences from the old app". Check this design in the old app.</div>`;
    // PS-31: the old design used one of the old library's box beams / voided slabs: corrected after the import (engine/sections.js migrate)
    const SC = window.PSBSections, its = SC ? SC.items(P) : [];
    if (its.length) verdict += `<div class="alert err" role="alert" id="lgSec"><b>Section corrected after the import (${esc(SC.tags(P))}): the results of this project differ from the old app's.</b> The comparison above is of the import, with the old app's section values. ${its.map(x => esc(SC.text(x))).join(' ')}</div>`;
    const ps10 = r && r.ps10 ? `<li>New in this app (not in the old app): the PS-10 hold-down force check for ${esc(r.ps10.owner)} (on, limit ${fm(r.ps10.frac, 2)} W; Owner rules tab): ratio ${fm(r.ps10.r, 3)} ${r.ps10.pass ? 'PASS' : 'FAIL'}, worked on the <a href="#" data-lggo="end">End zone &amp; hold-down</a> tab. It adds one check to the old app's list.</li>` : '';
    const sec = (k, t) => { const q = it.filter(x => x.kind === k); return q.length ? `<p class="note"><b>${t}</b></p><ul class="note">${q.map(x => `<li>${esc(x.text)}</li>`).join('')}</ul>` : ''; };
    return `<section class="sec" id="lgSum"><div class="secHead">Imported from the old app</div><div class="secBody">${verdict}
      <p class="note"><b>Imported</b></p><ul class="note">${it.filter(x => x.kind === 'src' || x.kind === 'ok').map(x => `<li>${esc(x.text)}</li>`).join('')}${ps10}</ul>
      ${GROUPS.map(([k, t]) => sec(k, t)).join('')}
      <p class="note">The old data as read is kept with this project (its import record); nothing of it was discarded. Imported ${esc(LG().lt(L.importedAt))} (local time).</p></div></section>`;
  }
  function card(P) {
    return `<section class="sec" id="lgCard"><div class="secHead">From the old app (Prestressed Bridge Design)</div><div class="secBody">
      <p class="note">Imports a design of the old <a href="../../Prestressed%20Bridge%20Design.html">Prestressed Bridge Design</a> into this project: its girder design, span, spacing, girder count, position, overhang, skew and continuity. Read only: the old app's saved data is never changed, and the old app keeps working.</p>
      <div class="fRow"><button type="button" data-lg="scan" title="List the designs the old app saved in this browser">Find the old app's designs</button><button type="button" data-lg="file" title="An old-app Export JSON file">Import an old-app JSON file…</button></div>
      <div id="lgListHost">${listHtml()}</div></div></section>` + summaryHtml(P);
  }
  function doImport(src, ctx) {
    const name = src.name || src.label || 'the design';
    if (!confirm(`Import "${name}" from the old app? It replaces the open project here (export it first to keep it). The old app's data is not changed.`)) return;
    const c = LG().convert(src);
    if (!c.ok) { alert(c.error); return; }
    try { LG().verify(c); } catch (e) { c.summary.results = { error: String(e && e.message) }; }
    S.list = null; S.sel = '';
    ctx.replace(c.project);
    const el = document.getElementById('lgSum'); if (el) el.scrollIntoView({ block: 'start' });
  }
  function importText(text, fileName, ctx) {
    const r = LG().fromText(text, fileName);
    if (!r.ok) { alert(r.error); return; }
    doImport(r.src, ctx);
  }
  function onClick(e, ctx) {
    const go = e.target.closest('[data-lggo]'); if (go) { e.preventDefault(); ctx.gotoOut(go.dataset.lggo); return true; }
    const pick = e.target.closest('input[name="lgPick"]');
    if (pick) { S.sel = pick.value; const b = document.querySelector('[data-lg="imp"]'); if (b) b.disabled = false; return true; }
    const b = e.target.closest('[data-lg]'); if (!b) return false;
    const a = b.dataset.lg;
    if (a === 'scan') { S.list = LG().scan(ctx.store); S.sel = S.list.items.length === 1 ? S.list.items[0].id : ''; const h = document.getElementById('lgListHost'); if (h) h.innerHTML = listHtml(); }
    else if (a === 'file') ctx.pickFile();
    else if (a === 'imp') { const x = S.list && S.list.items.find(q => q.id === S.sel); if (x) doImport(x, ctx); }
    return true;
  }
  window.PSBLegacyUI = { card, onClick, importText, state: S };
})();
