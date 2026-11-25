/* apps/ps-bridge/ui/demands.js — the demand source of each girder type on the page (window.PSBDemandsUI). Classic script; display and input
   only (the data and its rules: engine/demands.js). Created 2026-11-15 (batch D1): the old app's MIDAS import ("Prestressed Bridge Design.html"
   O:5862-5895 banner, span picker, "use built-in analysis", O:5362-5440 import guide, O:6225-6243 DF / m per effect) with the Steel Bridge
   app's source choice (apps/steel-bridge/ui/flexure.js "Demands" select, ui/analysis.js srcBar, ui/demands.js the custom table):
     card(P, ui)        the Loads tab's "Demands" card: the source of the girder type in scope (This app's analysis / Custom table; the
                        kept imported demands of an earlier version, read only, while the type uses them) and the table or the kept values;
                        in the base scope a list of every type's source
   NOMCT (2026-11-25, engineer's request "no MCT input or output"): the MIDAS file source (file input, span picker, import guide, its notes)
   is removed; a project saved with it is converted on open (engine/demands.js migrate) or shows the kept values read only.
     srcBar(P)          the line at the top of the output tabs naming the demands of the type shown (the Steel Bridge app's srcBar)
     onChange(el, P, ui, ctx) / onClick(e, P, ui, ctx)  true when handled; ctx = { changed(), toast(text, undo), redraw() }
   Nothing is calculated here. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DM = () => window.PSBDemands, B = () => window.PSBBridge;
  const fx = (v, d) => (typeof v === 'number' && isFinite(v) ? v.toFixed(d) : (v === '' || v == null ? '' : isFinite(+v) ? (+v).toFixed(d) : esc(v)));
  const LBL = { app: 'This app\'s analysis (built-in)', table: 'Custom table (entered)', midas: 'Imported demands (from an earlier version, read only)' };
  const box = (body, ref) => `<section class="sec" id="card-dem"><div class="secHead">Demands: DC2, DW and LL+IM <span class="secRef">${esc(ref || 'composite stage, per girder type')}</span></div><div class="secBody">${body}</div></section>`;
  /* the type in scope (the Loads tab's "Entered values for"), else null (base scope) */
  function typeOf(P, ui) { const k = window.PSBTypesUI ? window.PSBTypesUI.scopeOf(P, ui) : -1; return k >= 0 ? P.types[k] : null; }
  /* the type the output tabs show */
  function shownType(P) { const b = B(); if (!b) return null; if (b.hasTypes(P)) { const c = b.shown(P); return c ? P.types[c.k] : null; } return b.types(P)[0]; }
  function card(P, ui) {
    const D = DM(), b = B(); if (!D || !b) return '';
    const T = b.hasTypes(P) ? typeOf(P, ui) : b.types(P)[0];
    if (!T) {   // base scope: every type's source, a link to set it
      const rows = b.types(P).map(t => { const d = D.describe(P, t); return `<tr><td class="lft">${esc(t.label)}</td><td>${t.span}</td><td class="lft">${esc(d.what)}</td><td><button type="button" class="btn sm" data-dm="scope" data-id="${esc(t.id)}">Set for ${esc(t.label)}</button></td></tr>`; }).join('');
      return box(`<p class="note">Each girder type takes its composite-stage demands (DC2, DW and LL+IM) from this app's analysis or a custom table. Choose a type under "Entered values for" above to set its source.</p>
        <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Girder type</th><th>Span</th><th class="lft">Demands</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="note">The girder self-weight and DC1 are always computed by this app on the non-composite girder.</p>`);
    }
    const src = D.srcOf(P, T.id), id = T.id;
    let h = `<div class="fRow"><label for="dm_src">Demands of ${esc(T.label)} (span ${T.span})</label><select id="dm_src" data-dm="src" data-path="demands.${esc(id)}.src">${D.choices(P, id).map(v => `<option value="${v}"${v === src ? ' selected' : ''}>${LBL[v]}</option>`).join('')}</select></div>`;
    if (src === 'app') h += `<p class="note">DC2, DW and the live load (HL-93 × the distribution factors; on the continuous unit when the bridge is made continuous) are computed by this app (Loads &amp; LLDF and Analysis tabs).</p>`;
    if (src === 'midas') h += keptBody(P, T);
    if (src === 'table') h += tableBody(P, T);
    const w = warnsOf(P, T);   // the demand warnings of this type (engine/demands.js checks; not blocking)
    if (w.length) h += `<div class="alert" id="dmWarn" role="status"><b>Check</b><ul>${w.map(m => `<li>${esc(m)}</li>`).join('')}</ul></div>`;
    return box(h);
  }
  /* keptBody(P, T) (NOMCT): the imported demands kept from an earlier version, read only: what they are and the notice to re-enter them */
  function keptBody(P, T) {
    const D = DM(), e = D.entry(P, T.id) || {}, f = e.midas && e.midas.file;
    let h = `<div class="alert" id="dmKept" role="status"><b>Imported demands kept from an earlier version (read only)</b> for ${esc(T.label)}: they could not be converted to a custom table with exactly the same values, so the design still uses them as stored. Re-enter the demands as a custom table or choose this app's analysis (the source above). <button type="button" class="btn sm" data-dm="app">Use this app's analysis</button></div>`;
    if (!D.isFile(f)) return h;
    const x = D.external(P, T), q = x && x._selSpan, L = (P.spans.lengths || [])[T.span - 1];
    h += `<p class="note">${f.stations.length} stations stored · LL type <b>${esc(f.liveLoadType || '—')}</b>. The stored live load includes the dynamic load allowance (impact); the DF and m per effect below are applied to it. This app computes the non-composite loads itself (girder self-weight + DC1 on the non-composite section); the stored values supply DC2, DW and LL+IM.`
      + (q ? ` Span used: <b>span ${q.idx}</b> of the imported member (${fx(q.x0, 0)}–${fx(q.x1, 0)} ft), length <b>${fx(q.len, 2)} ft</b>, re-zeroed to its left bearing; span ${T.span} of the bridge: L = ${fx(L, 2)} ft (Bridge layout tab).` : '') + '</p>';
    return h + valuesTable(x, P, T);
  }
  /* valuesTable(x): the imported values of the span the engine reads (as read, the file's sign), each linked to where it is combined */
  function valuesTable(x, P, T) {
    const D = DM(), L = (P.spans.lengths || [])[T.span - 1], S = x ? D.slice(x, L) : null; if (!S) return '';
    const C = D.COLS.slice(1);
    return `<details class="dmVals" id="dmVals"><summary>Stored values of the span used (${S.st.length} stations, as stored; moments kip-ft, shears kip with the opposite sign to this app's)</summary>
      <div class="tscroll"><table class="tbl"><thead><tr><th>x member<br>ft</th><th>x span<br>ft</th>${C.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>
      ${S.st.map(s => `<tr><td>${fx(+s.x, 2)}</td><td>${fx(s.xr, 2)}</td>${C.map(c => `<td>${fx(+s[c[0]] || 0, c[0][0] === 'M' ? 1 : 2)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="note">The engine interpolates these linearly at its stations (Analysis tab, force effects table), takes the shears with the opposite sign (this app: + at the left support under gravity; the + LL branch from the stored −) and multiplies the LL+IM by DF × m per effect (worked on the <a href="#" data-gotab="lds">Loads &amp; LLDF tab</a>). Combined in Strength I, Service I and III at each station (<a href="#" data-gotab="an">Analysis tab</a>, worked steps "Moments at midspan" and "Interior support").</p></details>`;
  }
  function tableBody(P, T) {
    const D = DM(), rows = D.tableRows(P, T.id), C = D.COLS, L = (P.spans.lengths || [])[T.span - 1];
    const cell = (r, j, c) => `<td><input type="number" step="any" data-dm="cell" data-j="${j}" data-c="${c[0]}" data-path="demands.${esc(T.id)}.table.${j}.${c[0]}" value="${r[c[0]] === '' || r[c[0]] == null ? '' : esc(r[c[0]])}" aria-label="${esc(c[0])}, row ${j + 1}" style="width:5.5em"></td>`;
    const cv = (D.entry(P, T.id) || {}).converted;   // NOMCT: a table converted on open from the imported demands of an earlier version
    return (cv ? `<p class="note" id="dmConverted">These rows were imported from a file in an earlier version${cv.at ? ` (converted ${esc(String(cv.at).replace('T', ' ').slice(0, 16))})` : ''}; they hold the same values, so the design is unchanged. They can be edited like any custom table.</p>` : '')
      + `<p class="note">Per girder, unfactored, at stations x of span ${T.span} (0 to ${fx(L, 2)} ft from its left bearing): moments kip-ft (sagging +), shears kip in this app's sign (+ at the left support under gravity load); LL+IM with impact (the DF and m per effect below are applied to it; 1.0 when it is per girder already). A blank cell is 0. Include both bearings; the engine interpolates linearly between rows. Paste from Excel into any cell (columns in this order).</p>
      <div class="tscroll" data-path="demands.${esc(T.id)}.table"><table class="tbl" id="dmTable"><thead><tr>${C.map(c => `<th>${c[1]}<br>${c[2]}</th>`).join('')}<th></th></tr></thead><tbody>
      ${rows.map((r, j) => `<tr>${C.map(c => cell(r, j, c)).join('')}<td><button type="button" class="btn sm" data-dm="del" data-j="${j}" aria-label="delete row ${j + 1}">✕</button></td></tr>`).join('')}</tbody></table></div>
      <div><button type="button" class="btn sm" data-dm="add">Add row</button>${rows.length ? '' : ' <button type="button" class="btn sm" data-dm="seed">Start with the two bearings</button>'}</div>`;
  }
  const warnsOf = (P, T) => DM().checks(P).warnings.filter(x => x.scope === T.id).map(x => x.msg);
  /* srcBar(P): the output tabs' source line (the Steel Bridge app's srcBar): green for this app's analysis, blue for entered / imported */
  function srcBar(P) {
    const D = DM(), T = shownType(P); if (!D || !T) return '';
    const d = D.describe(P, T), ex = d.src !== 'app', w = ex ? warnsOf(P, T) : [];
    return `<div class="srcBar${w.length ? ' warn' : ex ? ' ex' : ''}" role="status" id="dmSrcBar"><span>Demands:</span> <b>${esc(d.what)}</b> <span class="srcWhy">(${esc(d.detail)}; ${d.src === 'app' ? 'the default' : 'as chosen'}: <a href="#" data-goin="loads">Loads tab, Demands card</a>${ex ? '; combined on the <a href="#" data-gotab="an">Analysis tab</a>' : ''})</span>${w.length ? `<div class="srcWhy">Check: ${w.map(esc).join(' ')}</div>` : ''}</div>`;
  }
  const idOf = (P, ui) => { const b = B(), T = b.hasTypes(P) ? typeOf(P, ui) : b.types(P)[0]; return T; };
  function onChange(el, P, ui, ctx) {
    const a = el.dataset.dm; if (!a) return false;
    const T = idOf(P, ui); if (!T) return true;
    if (a === 'src') { const v = el.value; if (v === 'app' && !DM().entry(P, T.id)) return true; DM().setSrc(P, T.id, v);
      if (v === 'table' && !DM().tableRows(P, T.id).length) seed(P, T);
      ctx.changed(); return true; }
    if (a === 'cell') { const rows = JSON.parse(JSON.stringify(DM().tableRows(P, T.id))), j = +el.dataset.j, c = el.dataset.c; if (!rows[j]) return true;
      rows[j][c] = el.value.trim() === '' ? '' : Number(el.value); DM().setTable(P, T.id, rows); ctx.changed(); return true; }
    return true;
  }
  function seed(P, T) { const L = (P.spans.lengths || [])[T.span - 1]; const z = x => Object.assign({ x }, ...DM().COLS.slice(1).map(c => ({ [c[0]]: '' })));
    DM().setTable(P, T.id, [z(0), z(isFinite(+L) ? +L : '')]); }
  function onClick(e, P, ui, ctx) {
    const t = e.target.closest('[data-dm]'); if (!t || t.tagName === 'SELECT' || t.tagName === 'INPUT') return false;
    const a = t.dataset.dm; e.preventDefault();
    if (a === 'scope') { ui.scope = t.dataset.id; ctx.redraw(); return true; }
    const T = idOf(P, ui); if (!T) return true;
    if (a === 'app') { DM().setSrc(P, T.id, 'app'); ctx.changed(); ctx.toast(`${T.label}: demands from this app's analysis (the imported values stay in the saved project; Undo returns them).`, true); return true; }
    const rows = JSON.parse(JSON.stringify(DM().tableRows(P, T.id)));
    if (a === 'add') { rows.push(Object.assign({}, ...DM().COLS.map(c => ({ [c[0]]: '' })))); DM().setTable(P, T.id, rows); ctx.changed(); return true; }
    if (a === 'del') { rows.splice(+t.dataset.j, 1); DM().setTable(P, T.id, rows); ctx.changed(); return true; }
    if (a === 'seed') { seed(P, T); ctx.changed(); return true; }
    return true;
  }
  /* onPaste(e, P, ui, ctx): rows pasted from Excel (tab-separated) into the table from the cell pasted into */
  function onPaste(e, P, ui, ctx) {
    const el = e.target; if (!el || el.dataset.dm !== 'cell') return false;
    const txt = (e.clipboardData && e.clipboardData.getData('text')) || ''; if (!/[\t\n]/.test(txt)) return false;
    e.preventDefault();
    const T = idOf(P, ui); if (!T) return true;
    const C = DM().COLS.map(c => c[0]), j0 = +el.dataset.j, c0 = C.indexOf(el.dataset.c), rows = JSON.parse(JSON.stringify(DM().tableRows(P, T.id)));
    txt.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '').forEach((line, i) => {
      const j = j0 + i; if (!rows[j]) rows[j] = Object.assign({}, ...C.map(c => ({ [c]: '' })));
      line.split('\t').forEach((v, m) => { const c = C[c0 + m]; if (!c) return; const s = v.trim().replace(/,/g, ''); rows[j][c] = s === '' ? '' : Number(s); });
    });
    DM().setTable(P, T.id, rows); ctx.changed(); return true;
  }
  window.PSBDemandsUI = { card, srcBar, onChange, onClick, onPaste, shownType };
})();
