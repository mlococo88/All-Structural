/* apps/steel-bridge/ui/lists.js — the list inputs as tables, one box per value (window.SBDListsUI). Classic script.
   LIST (2026-11-02, engineer decision: no comma-separated inputs). Uses shared/list-input.js (window.SharedListInput).

   The input modules keep drawing their own <input> for each list, with the same id, data attributes and value text as
   before, and keep reading it in their own 'change' handlers. This file finds those inputs whenever they are drawn (a
   MutationObserver on the page) and binds a table to each (SharedListInput.bindInput): the input stays, hidden, as the
   text the module reads; a table edit writes the rows back in the module's own format and fires the input's 'input'; when
   the focus leaves the table, its 'change' fires (the commit), as the old box committed on blur. Nothing is stored here:
   the project keeps its fields and formats (arrays stay arrays, text stays text). */
(function () {
  'use strict';
  const W = window;
  const num1 = /[,;\s]+/;                       // one number per row: the modules split at commas, semicolons or spaces
  const st = (label, unit, o) => Object.assign({ label, unit, width: '6.5em' }, o || {});
  /* selector -> { label (the table's name), columns, format } (format as bindInput: rowSplit, colSplit, rowSep, colSep) */
  const LISTS = [
    ['#i_spans', { label: 'Span lengths', columns: [st('L', 'ft', { min: 0, minExclusive: true })], rowSplit: num1 }],
    ['[id="i_xs.bays"]', { label: 'Girder spacings, left to right', columns: [st('S', 'ft', { min: 0, minExclusive: true })], rowSplit: num1 }],
    ['[id="i_xs.skews"]', { label: 'Support skews, one per support line', columns: [st('Skew', '°')], rowSplit: num1 }],
    ['#fr_spl', { label: 'Field splices', columns: [st('Station', 'ft', { min: 0, minExclusive: true })], rowSplit: num1 }],
    ['#i_splx', { label: 'Field splice stations', columns: [st('Station', 'ft', { min: 0, minExclusive: true })], rowSplit: num1 }],
    ['[id="i_studs.splX"]', { label: 'Field splice stations (no studs over the plates)', columns: [st('Station', 'ft', { min: 0, minExclusive: true })], rowSplit: num1 }],
    // girders[i].loadsManual.xf: "20:1.5, 40:1.5" (ui/analysis.js reads split(/[,;]/) then split(':'))
    ['#an_l_xf', { label: 'Cross-frame point loads', columns: [st('x', 'ft'), st('P', 'kip')], rowSplit: /[,;]/, colSplit: ':', colSep: ':' }],
    // P.analysis.seqCustom: "0-80, 140-220" (engine/analysis.js reads split(/[,;]/) then split('-'))
    ['#an_a_seqCustom', { label: 'Pours', columns: [st('From', 'ft', { min: 0 }), st('To', 'ft', { min: 0 })], rowSplit: /[,;]/, colSplit: '-', colSep: '-' }],
    // P.autodesign.vars[...].win: "70-90, 135-150" (engine/splplace.js windows() also reads "70 to 90" and "70–90")
    ['#ad_win', { label: 'Station windows', columns: [st('From', 'ft', { min: 0 }), st('To', 'ft', { min: 0 })], rowSplit: /[,;]+/, colSplit: /\s*(?:-|–|to)\s*/, colSep: '-' }]
  ];
  const SEL = LISTS.map(l => l[0]).join(',');

  function bind(el, cfg) {
    if (el._sli || !W.SharedListInput) return;
    let was = el.value;
    const parse = cfg.colSplit ? (t => W.SharedListInput.fromText(t, { rowSplit: cfg.rowSplit, colSplit: cfg.colSplit, ncol: cfg.columns.length })) : undefined;
    const ctl = W.SharedListInput.bindInput(el, Object.assign({ events: ['input'], parse }, cfg));
    ctl.el.addEventListener('focusout', () => setTimeout(() => {   // after the event: a redraw (Enter, ×) moves the focus within the table
      if (!ctl.el.isConnected || ctl.el.contains(document.activeElement)) return;
      if (el.value !== was) { was = el.value; el.dispatchEvent(new Event('change', { bubbles: true })); }
    }, 0));
    el._sli = ctl;
  }
  function upgrade(root) {
    (root || document).querySelectorAll(SEL).forEach(el => { const l = LISTS.find(q => el.matches(q[0])); if (l) bind(el, l[1]); });
  }
  function start() {
    if (!W.SharedListInput || typeof MutationObserver === 'undefined') return;
    const s = document.createElement('style');
    s.textContent = '.bad + [data-sli="host"] .sli{outline:1px solid #dc2626;outline-offset:2px;}';   // the module's error mark, on the table
    document.head.appendChild(s);
    upgrade(document);
    new MutationObserver(ms => { if (ms.some(m => m.addedNodes.length && !(m.target.closest && m.target.closest('.rp')))) upgrade(document); }).observe(document.body, { childList: true, subtree: true });   // RSX (2026-11-09): not for nodes added inside the report viewer (search marks and status, lazy items): it holds no list input
  }
  if (typeof document === 'undefined') { /* no page (Node test harness): nothing to bind */ }
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  W.SBDListsUI = { LISTS, upgrade };
})();
