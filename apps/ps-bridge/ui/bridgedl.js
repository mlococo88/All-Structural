/* apps/ps-bridge/ui/bridgedl.js — the Cross-section tab's card "Barriers, sidewalks and wearing surface (DC2, DW to each girder)" and the
   Loads & LLDF tab's table of every line (window.PSBBridgeDLUI). Classic script; display and input only. Created 2026-11-13 (PR 3a-3, PS-9).
   The inputs are P.xs.dl (engine/bridge-dl.js); every number in the line table is dead()'s (PSBBridgeDL.distribute), worked in its steps
   (ids dl.*, on the Loads & LLDF tab and in the Report).
     card(P)               the input card (the mode, the method, the barriers, the sidewalks, the wearing surface, the added line loads)
     lineTable(P, g)       the table of DC2 and DW of every girder line (the line g shown marked), with the step links
     onChange(el, P) / onClick(e, P)  → true when handled (the page then saves and redraws) */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DL = () => window.PSBBridgeDL;
  const get = (o, p) => p.split('.').reduce((q, k) => q == null ? q : q[k], o);
  const fx = (v, d) => typeof v === 'number' && isFinite(v) ? v.toFixed(d) : '—';
  const box = (id, title, ref, body) => `<section class="sec" id="card-${id}"><div class="secHead">${title}${ref ? ` <span class="secRef">${esc(ref)}</span>` : ''}</div><div class="secBody">${body}</div></section>`;
  const num = (P, path, label, unit, tip) => { const v = get(P, path); return `<div class="fRow"><label for="i_${path}" title="${esc(tip || '')}">${label}</label><input type="number" step="any" id="i_${path}" data-path="${path}" data-dl="num" value="${esc(v == null || (typeof v === 'number' && isNaN(v)) ? '' : v)}" title="${esc(tip || '')}"><span class="unit">${unit}</span></div>`; };
  const sel = (P, path, label, opts, tip) => `<div class="fRow"><label for="i_${path}" title="${esc(tip || '')}">${label}</label><select id="i_${path}" data-path="${path}" data-dl="sel" title="${esc(tip || '')}">${opts.map(([v, t]) => `<option value="${esc(v)}"${String(get(P, path)) === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
  function card(P) {
    const q = (P.xs && P.xs.dl) || {}, on = DL().on(P);
    let h = `<div class="fRow"><label for="i_xs.dl.mode" title="Distributed: DC2 and DW of each girder line from the loads below (the Steel Bridge app's method). Entered: the values entered per girder type on the Loads tab (the old app's way).">DC2 and DW per girder</label><select id="i_xs.dl.mode" data-path="xs.dl.mode" data-dl="mode">
      <option value="distributed"${on ? ' selected' : ''}>Distributed to each girder line (below)</option><option value="entered"${on ? '' : ' selected'}>Entered per girder type (Loads tab)</option></select></div>`;
    if (!on) return box('dl', 'Barriers, sidewalks and wearing surface (DC2, DW)', 'AASHTO LRFD 10th Ed. 3.5.1, 4.6.2.2.1', h + '<p class="note">DC2 and DW are the values entered per girder type on the <a href="#" data-goin="loads">Loads tab</a> (as the old app). "Distributed" computes them for each girder line from the barriers, sidewalks and wearing surface (the Steel Bridge app\'s method, PS-9).</p>');
    h += sel(P, 'xs.dl.method', 'Distribution method', Object.entries(DL().METHODS), 'How the barrier, sidewalk and added DC2 loads go to the girders; the wearing surface always equally (the Steel Bridge app).');
    ['L', 'R'].forEach(s => { const side = s === 'L' ? 'Left' : 'Right';
      h += num(P, `xs.dl.bar${s}.w`, `${side} barrier weight`, 'klf', 'DC2 line load at half the barrier width from the deck edge') + num(P, `xs.dl.bar${s}.bw`, `${side} barrier width (deck edge to traffic face)`, 'ft', 'Also the start of the wearing surface');
      h += num(P, `xs.dl.sw${s}.w`, `${side} sidewalk width`, 'ft', 'Sidewalk slab from the deck edge (DC2, deck concrete for loads); 0 = none') + (+((q['sw' + s] || {}).w) > 0 ? num(P, `xs.dl.sw${s}.t`, `${side} sidewalk thickness`, 'in', '') : ''); });
    h += num(P, 'xs.dl.fws', 'Future wearing surface (DW)', 'psf', 'Between the traffic faces (barrier or sidewalk), distributed equally to every girder');
    const rows = (q.extra || []).map((r, i) => `<tr><td>${i + 1}</td><td><input type="text" data-path="xs.dl.extra.${i}.name" data-dl="text" value="${esc(r.name || '')}" style="width:110px;text-align:left" aria-label="Added line load ${i + 1}, name"></td>
      <td><select data-path="xs.dl.extra.${i}.cat" data-dl="sel" aria-label="Added line load ${i + 1}, category">${['DC2', 'DW'].map(c => `<option${r.cat === c ? ' selected' : ''}>${c}</option>`).join('')}</select></td>
      <td><input type="number" step="any" data-path="xs.dl.extra.${i}.x" data-dl="num" value="${esc(r.x)}" aria-label="Added line load ${i + 1}, x"></td><td><input type="number" step="any" data-path="xs.dl.extra.${i}.plf" data-dl="num" value="${esc(r.plf)}" aria-label="Added line load ${i + 1}, w"></td>
      <td><button type="button" data-dlact="del" data-i="${i}" aria-label="Delete added line load ${i + 1}">✕</button></td></tr>`).join('');
    h += `<div class="tscroll"><table class="tbl"><thead><tr><th>#</th><th>Added line load</th><th>Category</th><th>x from the left deck edge<br><span class="unit">ft</span></th><th>w<br><span class="unit">klf</span></th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="lft note">None.</td></tr>'}</tbody></table></div>
      <button type="button" data-dlact="add">Add line load</button>`;
    const R = DL().distribute(P);
    if (R) h += `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Line</th>${R.dc2.map((_, i) => `<th>G${i + 1}</th>`).join('')}</tr></thead><tbody>
      <tr><td class="lft">DC2 (klf)</td>${R.dc2.map(v => `<td>${fx(v, 4)}</td>`).join('')}</tr><tr><td class="lft">DW (klf)</td>${R.dw.map(v => `<td>${fx(v, 4)}</td>`).join('')}</tr></tbody></table></div>`;
    return box('dl', 'Barriers, sidewalks and wearing surface (DC2, DW to each girder)', 'AASHTO LRFD 10th Ed. 3.5.1, 4.6.2.2.1; the Steel Bridge app\'s method', h
      + '<p class="note">Each girder line\'s DC2 and DW (the table) are its engine inputs, worked step by step on the Loads &amp; LLDF tab (§ links) and in the Report. The deck slab and haunch (DC1) stay the girder\'s tributary width. The deck design (Diaphragms / deck tab) keeps its own barrier weight and wearing surface.</p>');
  }
  function lineTable(P, g, k) {
    const R = DL().distribute(P); if (!R) return '';
    const per = R.per;
    const head = `<tr><th class="lft">Load (category, distribution)</th><th>w (klf)</th>${R.dc2.map((_, i) => `<th${i + 1 === g ? ' class="tyG"' : ''}>G${i + 1}</th>`).join('')}</tr>`;
    const rows = per.map(L => `<tr><td class="lft">${esc(L.desc)} (${L.cat}, ${esc(DL().DIST[L.dist] || L.dist)})</td><td>${fx(L.plf, 4)} ${k.wk('dl.load.' + L.id)}</td>${L.r.map((v, i) => `<td${i + 1 === g ? ' class="tyG"' : ''}>${fx(v, 4)}</td>`).join('')}</tr>`).join('');
    const tot = (lab, a, id) => `<tr><td class="lft"><b>${lab}</b></td><td></td>${a.map((v, i) => `<td${i + 1 === g ? ' class="tyG"' : ''}><b>${fx(v, 4)}</b>${i + 1 === g ? ' ' + k.wk(`dl.G${g}.${id}`) : ''}</td>`).join('')}</tr>`;
    return k.card(`DC2 and DW distributed to every girder line (${esc(DL().METHODS[P.xs.dl.method] || P.xs.dl.method)})`, `<div class="tscroll"><table class="tbl"><thead>${head}</thead><tbody>${rows}${tot('DC2', R.dc2, 'DC2')}${tot('DW', R.dw, 'DW')}</tbody></table></div>
      <p class="note">The Steel Bridge app's dead-load distribution (PS-9): each line load from the <a href="#" data-goin="xsec">Cross-section tab</a> to the girders by the method (the wearing surface equally), x̄ = ${fx(R.xbar, 3)} ft from the left deck edge. The girder shown, G${g}, takes DC2 = ${fx(R.dc2[g - 1], 4)} klf and DW = ${fx(R.dw[g - 1], 4)} klf as its engine inputs (worked below).</p>`);
  }
  function onChange(el, P) {
    const t = el.dataset.dl; if (!t) return false;
    const path = el.dataset.path;
    if (t === 'mode') { if (el.value === 'distributed') { if (!P.xs.dl) P.xs.dl = DL().defaults(P); P.xs.dl.mode = 'distributed'; } else if (P.xs.dl) P.xs.dl.mode = 'entered'; return true; }
    const ks = path.split('.'), last = ks.pop(), o = ks.reduce((a, k) => (a[k] == null ? (a[k] = {}) : a[k]), P);
    o[last] = t === 'num' ? (el.value.trim() === '' ? NaN : Number(el.value)) : el.value;
    return true;
  }
  function onClick(e, P) {
    const b = e.target.closest('[data-dlact]'); if (!b || !P.xs.dl) return false;
    const L = P.xs.dl.extra = Array.isArray(P.xs.dl.extra) ? P.xs.dl.extra : [];
    if (b.dataset.dlact === 'add') L.push({ name: `Added load ${L.length + 1}`, cat: 'DC2', x: 0, plf: 0 }); else L.splice(+b.dataset.i, 1);
    return true;
  }
  window.PSBBridgeDLUI = { card, lineTable, onChange, onClick };
})();
