/* apps/ps-bridge/ui/outkit.js — the pieces the output tabs share (window.PSBOutKit). Classic script; display only. Created 2026-11-12 (PR 2b-2).
   The steel app's output-tab style (apps/steel-bridge/ui/loads.js: cards, key-value grids, tables, worked steps grouped in topics with
   SharedSteps.groupsHTML, "§" links to a step), written for this app (not a copy of a steel file).
     ev(R, path, d, unit, div)  an engine value (÷ div for a unit change, e.g. 12: kip-in shown as kip-ft) on the tab: <span data-ev="path" data-d="d"> with the value of R at path, d decimals (thousands
                           grouped); tests/smoke/ps-bridge-skeleton.mjs checks every data-ev against computeAll on the page (values = engine values)
     val(R, path)          the value of R at a dotted path ('cp.Ic', 'diagrams.30.M_DC')
     fx(v, d)              the number as shown;  card(title, body, id);  kv(rows [[label, html]]);  wk(id, text, tab) a link to step id (on tab)
     steps(list, topics, open)  the worked steps in topics (SharedSteps.group / groupsHTML), each step <li id="st-<id>">
     after(el, open)       wires the topics (expand / collapse, § links) after the tab's HTML is set */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = () => window.SharedSteps;
  const val = (R, path) => String(path).split('.').reduce((o, k) => o == null ? o : o[k], R);
  const fx = (v, d) => typeof v === 'number' && isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/^-(0(\.0*)?)$/, '$1') : '—';
  const ev = (R, path, d, unit, div) => `<span data-ev="${esc(path)}" data-d="${d}"${div ? ` data-div="${div}"` : ''}>${fx(div ? val(R, path) / div : val(R, path), d)}</span>${unit ? ' ' + unit : ''}`;   // div: a unit change (12: kip-in shown in kip-ft)
  const card = (title, body, id) => `<section class="sec"${id ? ` id="${esc(id)}"` : ''}><div class="secHead">${title}</div><div class="secBody">${body}</div></section>`;
  const kv = rows => `<div class="kv">${rows.map(([l, h]) => `<div><span>${l}</span><span>${h}</span></div>`).join('')}</div>`;
  const wk = (id, text, tab) => `<a class="wk" href="#st-${esc(id)}"${tab ? ` data-gotab="${esc(tab)}"` : ''} title="Worked step">${text || '§'}</a>`;
  const stepLi = s => `<li id="st-${esc(s.id)}"><div class="lbl">${esc(s.label)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</div><div>${S().line(s, true)}</div>${s.note ? `<div class="nt">${esc(S().noteText(s.note))}</div>` : ''}</li>`;
  const steps = (list, topics, open) => S().groupsHTML(S().group(list, topics, { strip: false }), { open, item: stepLi });
  const after = (el, open) => S().wire(el, { onToggle: (k, on) => { if (on) open.add(k); else open.delete(k); } });
  window.PSBOutKit = { esc, val, fx, ev, card, kv, wk, stepLi, steps, after };
})();
