/* apps/ps-bridge/ui/types.js — the girder types on the page (window.PSBTypesUI). Classic script; display and input only.
   Created 2026-11-13 (PR 3a-1, docs/ps-bridge-plan.md §5; engineer decision PS-8), the Steel Bridge app's girder-type pattern (SB-2:
   apps/steel-bridge/index.html "Girder types" card, the type and line choice above the output tabs; written for this app):
     card(P, ui)           the Girders & strands tab's "Girder types" card: per span its types (label, the lines as check boxes, Copy, Delete,
                           Add type, "Edit its inputs"), the lines with no type ("Assign every line"), the inputs each type has of its own
     scopeBar(P, ui, tab)  "Entered values for: every girder type (the base design) | <type> only" above the girder inputs (Girders & strands,
                           Materials, Loads tabs); ui.scope = the type id ('' = the base design)
     outBar(P)             "Results of girder type … on line …" above the output tabs (writes P.design = the line and span shown, as the
                           design girder choice of PR 2b did)
     mark(root, P, ui)     the fields a type has of its own: "● <type>" and a reset link (type scope); "own value in: …" (base scope)
     onChange(el, P, ui) / onClick(e, P, ui)  → { note } when handled (the page then saves and redraws), else null
   Nothing is calculated here; the assignments are engine/bridge.js functions. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const B = () => window.PSBBridge, F = () => window.PSBFields;
  const SCOPED = ['gird', 'mat', 'loads'];
  const fmt = (x, d) => typeof x === 'number' && isFinite(x) ? x.toFixed(d) : '—';
  const box = (id, title, ref, body) => `<section class="sec" id="card-${id}"><div class="secHead">${title}${ref ? ` <span class="secRef">${esc(ref)}</span>` : ''}</div><div class="secBody">${body}</div></section>`;
  /* the label of an override key (the field's label from engine/fields.js, else the key) */
  function keyLabel(key) {
    const f = F(), p = 'base.' + key, t = f.TABLES[p];
    if (t) return t.title;
    const hit = f.CARDS.flatMap(c => c.fields).find(q => q.p === p);
    return hit ? f.plain(hit.l) : key;
  }
  /* scopeOf(P, ui): the type index of ui.scope (-1: the base design) */
  function scopeOf(P, ui) { if (!ui || !ui.scope || !B().hasTypes(P)) return -1; return P.types.findIndex(t => t.id === ui.scope); }
  function card(P, ui) {
    const BR = B(); if (!BR.hasTypes(P)) return '';
    const nb = P.xs.nb, ns = P.spans.lengths.length, T = P.types, sh = BR.shown(P);
    let h = '';
    for (let s = 1; s <= ns; s++) {
      const ks = BR.spanTypes(P, s), LT = BR.lineTypes(P, s);
      const rows = ks.map(k => {
        const t = T[k], L = BR.typeLines(P, k), own = Object.keys(t.ovr);
        const boxes = Array.from({ length: nb }, (_, i) => { const g = i + 1, on = L.includes(g), two = LT[g] && LT[g].length > 1;
          return `<label class="tyLn${g === 1 || g === nb ? ' ext' : ''}"><input type="checkbox" data-ty="line" data-k="${k}" data-g="${g}" data-path="types.${k}.lines"${on ? ' checked' : ''}${on && !two ? ' disabled title="A line keeps a type: tick it in another type to move it there"' : ` title="${on ? 'Untick: this line has two types' : `Assign G${g} of span ${s} to ${esc(t.label)}`}"`} aria-label="${esc(`${t.label}, line G${g}`)}">G${g}</label>`; }).join('');
        return `<div class="tyRow${sh && sh.k === k ? ' tyShown' : ''}"><div class="tyHead"><input type="text" data-ty="label" data-k="${k}" data-path="types.${k}" value="${esc(t.label)}" aria-label="Name of girder type ${k + 1}"><span class="tyLines">${boxes}</span></div>
          <div class="tyAct"><span class="note">Own inputs: ${own.length ? `${own.length} (${esc(own.slice(0, 4).map(keyLabel).join(', '))}${own.length > 4 ? ', …' : ''})` : 'none (the base design)'}</span>
            <button type="button" data-ty="edit" data-k="${k}" title="Show this type's inputs on the Girders & strands, Materials and Loads tabs">Edit its inputs</button>
            <button type="button" data-ty="copy" data-k="${k}" title="A new type of this span, a copy of this one (no lines yet)">Copy</button>
            <button type="button" data-ty="del" data-k="${k}"${ks.length < 2 ? ' disabled title="The only type of the span"' : ` title="Delete this type; its lines go to ${esc(T[ks.find(j => j !== k)].label)}"`}>Delete</button></div></div>`;
      }).join('');
      const un = LT.map((t, g) => g >= 1 && !t.length ? g : 0).filter(Boolean);
      h += `<h4 class="tySpan">Span ${s} (L = ${fmt(+P.spans.lengths[s - 1], 2)} ft)</h4>${rows || '<p class="note">No girder type in this span.</p>'}
        ${un.length ? `<p class="note" style="color:var(--fail)"><b>Lines ${un.map(g => 'G' + g).join(', ')} of span ${s} have no girder type, so they are not checked.</b></p>` : ''}`;
    }
    const un = BR.unassigned(P), gone = T.filter(t => t.span > ns);
    return box('types', 'Girder types', 'interior and exterior per span, a type per line (PS-8)', h
      + `<div class="fRow"><button type="button" data-ty="add" title="A new girder type in each span chosen below">Add type to span</button><select data-ty="addspan" aria-label="Span of the new type">${Array.from({ length: ns }, (_, i) => `<option value="${i + 1}">Span ${i + 1}</option>`).join('')}</select>
        ${un.length ? `<button type="button" data-ty="fill" title="Each line with no type takes the type of its span with the same position (exterior G1 and G${nb}, else interior); a new type where the span has none">Assign every line (${un.length})</button>` : ''}</div>
      ${gone.length ? `<p class="note">Kept in the project, not checked (their span is beyond the ${ns} span${ns > 1 ? 's' : ''}): ${gone.map(t => esc(t.label)).join(', ')}. They come back if the span count grows.</p>` : ''}
      <p class="note">Each girder type is one girder design of its span: the base design (every input tab) with the inputs it has of its own ("Edit its inputs"). It is checked on every line ticked here with that line's span, spacing, position, overhang and skew (Loads &amp; LLDF); the worst line governs (PR 3a-2). Every girder of a span has the same shape (PS-8): a shape entered for one type is entered for every type of its span. A per-girder design is a type on one line.</p>`);
  }
  /* the cell the output tabs show, its values from the bridge (as the design girder card of PR 2b) */
  function shownCard(P) {
    const BR = B(), D = window.PSBDesign, c = BR.shown(P); if (!c) return '';
    if (D.checks(P).errors.length || window.PSBModel.validate(P).errors.length) return '';
    const TABN = { layout: 'Bridge layout', xsec: 'Cross-section', gird: 'Girders & strands' };
    let dv = []; try { dv = D.driven(P); } catch (e) { dv = []; }
    return box('design', `Shown on the output tabs: ${esc(P.types[c.k].label)} on line G${c.g}, span ${c.s}`, 'chosen above the output tabs', `<div class="kv">${dv.map(q => `<div><span>${esc(q.label)}</span><span data-dv="${esc(q.key)}">${esc(typeof q.value === 'number' ? fmt(q.value, q.d == null ? 2 : q.d) : String(q.value))}${q.unit ? ' ' + esc(q.unit) : ''} <a href="#" data-goin="${q.where}" title="Entered on the ${esc(TABN[q.where])} tab">${esc(TABN[q.where])}</a></span></div>`).join('')}</div>
      <p class="note">The bridge gives each girder type on each line these values (the old app's "Preliminary designer" bridge values, PBD.applyBridge, plus continuity, skew and the overhang).</p>`);
  }
  function scopeBar(P, ui, tab) {
    const BR = B(); if (!BR.hasTypes(P) || !SCOPED.includes(tab)) return '';
    const k = scopeOf(P, ui), T = P.types;
    return `<div class="tyScope${k >= 0 ? ' on' : ''}"><label for="tyScope_${tab}">Entered values for</label> <select id="tyScope_${tab}" data-ty="scope"><option value="">every girder type (the base design)</option>${T.map((t, j) => `<option value="${esc(t.id)}"${j === k ? ' selected' : ''}>${esc(t.label)} only (span ${t.span}${BR.typeLines(P, j).length ? `, ${BR.typeLines(P, j).map(g => 'G' + g).join(' ')}` : ', no line'})</option>`).join('')}</select>
      <span class="note">${k >= 0 ? `Edits here are ${esc(T[k].label)}'s own values (marked ●; "reset" returns a field to the base design). The bridge values (span, spacing, position) stay the line's.` : 'Edits here apply to every girder type, but a field a type has of its own (listed on the Girders & strands tab).'}</span></div>`;
  }
  function outBar(P) {
    const BR = B(); if (!BR.hasTypes(P)) return '';
    const c = BR.shown(P), C = BR.cells(P); if (!c || !C.length) return '';
    const ks = [...new Set(C.map(q => q.k))], lines = BR.typeLines(P, c.k);
    return `<div class="tyOut"><label for="tyOutT">Results of girder type</label> <select id="tyOutT" data-ty="otype">${ks.map(k => `<option value="${k}"${k === c.k ? ' selected' : ''}>${esc(P.types[k].label)} (span ${P.types[k].span})</option>`).join('')}</select>
      <label for="tyOutL">on line</label> <select id="tyOutL" data-ty="oline">${lines.map(g => `<option value="${g}"${g === c.g ? ' selected' : ''}>G${g} (${g === 1 || g === P.xs.nb ? 'exterior' : 'interior'})</option>`).join('')}</select>
      <a href="#" data-goin="gird" title="The girder types and their lines (Girders & strands tab)">Girder types</a></div>`;
  }
  /* mark(root, P, ui): the fields a type has of its own */
  function mark(root, P, ui) {
    const BR = B(); if (!root || !BR.hasTypes(P)) return;
    const k = scopeOf(P, ui), seen = new Set();
    root.querySelectorAll('[data-path^="base."]').forEach(el => {
      const key = BR.ovrKeyOf(el.dataset.path), box = el.closest('.fRow') || el.closest('.sec'); if (!box) return;
      if (seen.has(box)) return;
      if (k >= 0) {
        if (!Object.prototype.hasOwnProperty.call(P.types[k].ovr, key)) return;
        seen.add(box);
        const m = document.createElement('span'); m.className = 'tyMark'; m.innerHTML = `● ${esc(P.types[k].label)} <a href="#" data-ty="reset" data-k="${k}" data-key="${esc(key)}" title="Return this field to the base design's value">reset</a>`;
        (box.classList.contains('fRow') ? box : box.querySelector('.secHead')).appendChild(m);
      } else {
        const own = P.types.filter(t => Object.prototype.hasOwnProperty.call(t.ovr, key)); if (!own.length) return;
        seen.add(box);
        const m = document.createElement('span'); m.className = 'tyMark base'; m.textContent = `own value in: ${own.map(t => t.label).join(', ')}`;
        (box.classList.contains('fRow') ? box : box.querySelector('.secHead')).appendChild(m);
      }
    });
  }
  /* onChange(el, P, ui): a control of this file changed */
  function onChange(el, P, ui) {
    const BR = B(), t = el.dataset.ty; if (!t) return null;
    if (t === 'scope') { ui.scope = el.value; return { ui: true }; }
    if (t === 'label') { const T = P.types[+el.dataset.k]; if (!T) return null; T.label = el.value.trim() || T.label; return { note: '' }; }
    if (t === 'line') { const k = +el.dataset.k, g = +el.dataset.g, T = P.types[k]; if (!T) return null;
      if (el.checked) BR.assignLine(P, k, g); else T.lines = T.lines.filter(q => q !== g);
      return { note: '' }; }
    if (t === 'otype') { const k = +el.value, L = BR.typeLines(P, k), c = BR.shown(P); if (!L.length) return null;
      P.design = { g: L.includes(c && c.g) ? c.g : L[0], s: P.types[k].span }; return { note: '' }; }
    if (t === 'oline') { const c = BR.shown(P); if (!c) return null; P.design = { g: +el.value, s: c.s }; return { note: '' }; }
    if (t === 'addspan') return { ui: true, keep: true };
    return null;
  }
  function onClick(e, P, ui) {
    const BR = B(), b = e.target.closest('[data-ty]'); if (!b || b.tagName === 'SELECT' || (b.tagName === 'INPUT')) return null;
    const t = b.dataset.ty, k = +b.dataset.k; e.preventDefault();
    if (t === 'edit') { ui.scope = P.types[k].id; return { ui: true, note: `Showing ${P.types[k].label}'s inputs: the Girders & strands, Materials and Loads tabs now edit this type only.` }; }
    if (t === 'copy') { const j = BR.addType(P, k, { label: `${P.types[k].label} copy` }); return { note: `${P.types[j].label}: a new type of span ${P.types[j].span}, a copy of ${P.types[k].label} (no line yet: tick its lines).` }; }
    if (t === 'del') { const ks = BR.spanTypes(P, P.types[k].span), to = ks.find(j => j !== k); if (to == null) return null;
      const lab = P.types[k].label, toLab = P.types[to].label, L = BR.typeLines(P, k);
      if (!confirm(`Delete girder type ${lab}? Its own inputs are removed${L.length ? `; its lines ${L.map(g => 'G' + g).join(', ')} go to ${toLab}` : ''}.`)) return { cancel: true };
      if (ui.scope === P.types[k].id) ui.scope = '';
      BR.deleteType(P, k, to); return { note: `${lab} deleted${L.length ? `; lines ${L.map(g => 'G' + g).join(', ')} now ${toLab}` : ''}.` }; }
    if (t === 'add') { const sEl = document.querySelector('[data-ty="addspan"]'), s = sEl ? +sEl.value : 1, ks = BR.spanTypes(P, s);
      const j = ks.length ? BR.addType(P, ks[0], { label: `Type ${P.types.length + 1} S${s}` }) : (P.types.push({ id: BR.nextId(P), label: `Type ${P.types.length + 1} S${s}`, span: s, lines: [], ovr: {} }) - 1);
      return { note: `${P.types[j].label}: a new type of span ${s}${ks.length ? `, a copy of ${P.types[ks[0]].label}` : ''} (no line yet: tick its lines).` }; }
    if (t === 'fill') { const ch = BR.fill(P); return { note: ch.length ? `Assigned: ${ch.map(q => `G${q.g}/S${q.s} → ${q.label}${q.created ? ' (new type)' : ''}`).join('; ')}.` : '' }; }
    if (t === 'reset') { BR.resetKey(P, k, b.dataset.key); return { note: '' }; }
    return null;
  }
  /* summaryCard (PR 3a-2) moved to ui/summary.js (PR 3b: the Summary tab's type × check-group table, with the girder × span grid) */
  window.PSBTypesUI = { SCOPED, card, shownCard, scopeBar, outBar, mark, onChange, onClick, scopeOf, keyLabel };
})();
