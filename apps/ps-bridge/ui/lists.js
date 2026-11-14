/* apps/ps-bridge/ui/lists.js — the list inputs as tables, one box per value (window.PSBListsUI). Classic script.
   Created 2026-11-14 (PS Bridge catch-up to the Steel Bridge app, item 3: "row inputs for spans and skews, replacing the comma text
   fields"). COPY of apps/steel-bridge/ui/lists.js (LIST, 2026-11-02, the engineer's decision: no comma-separated inputs) with this app's
   list inputs, to move to shared/ later (CLAUDE.md §3). Uses shared/list-input.js (window.SharedListInput).

   The page (index.html list()) keeps drawing its own <input data-kind="list"> for each list, with the same id, data attributes and value
   text ("100, 125") as before, and keeps reading it in its own 'change' handler (parseList: split at commas, semicolons or spaces, Number).
   This file finds those inputs whenever they are drawn (a MutationObserver on the page) and binds a table to each
   (SharedListInput.bindInput): the input stays, hidden, as the text the page reads; a table edit writes the rows back as "a, b, c" and
   fires the input's 'input'; when the focus leaves the table, its 'change' fires (the commit), as the old box committed on blur. Nothing
   is stored here: the project keeps its fields and formats (spans.lengths, xs.skews and xs.bays stay arrays of numbers). */
(function () {
  'use strict';
  const W = window;
  const num1 = /[,;\s]+/;                       // one number per row: the page splits at commas, semicolons or spaces
  const st = (label, unit, o) => Object.assign({ label, unit, width: '6.5em' }, o || {});
  /* selector -> { label (the table's name), columns, format } (format as bindInput: rowSplit, colSplit, rowSep, colSep) */
  const LISTS = [
    ['[id="i_spans.lengths"]', { label: 'Span lengths, left to right', columns: [st('L', 'ft', { min: 0, minExclusive: true })], rowSplit: num1 }],
    ['[id="i_xs.skews"]', { label: 'Support skews, one per support line', columns: [st('Skew', '°', { min: -90, max: 90, minExclusive: true, maxExclusive: true })], rowSplit: num1 }],
    ['[id="i_xs.bays"]', { label: 'Girder spacings, left to right', columns: [st('S', 'ft', { min: 0, minExclusive: true })], rowSplit: num1 }]
  ];
  const SEL = LISTS.map(l => l[0]).join(',');

  function bind(el, cfg) {
    if (el._sli || !W.SharedListInput) return;
    let was = el.value;
    const parse = cfg.colSplit ? (t => W.SharedListInput.fromText(t, { rowSplit: cfg.rowSplit, colSplit: cfg.colSplit, ncol: cfg.columns.length })) : undefined;
    const ctl = W.SharedListInput.bindInput(el, Object.assign({ events: ['input'], parse }, cfg));
    ctl.el.addEventListener('focusout', () => setTimeout(() => {   // after the event: a redraw (Enter, ×) moves the focus within the table
      if (ctl.el.isConnected && ctl.el.contains(document.activeElement)) return;
      if (el.value === was) return; was = el.value;
      // one change from the steel copy: when the page was redrawn before this ran (a click on an input tab redraws every pane), the edit is
      // committed through the input of the same id drawn in its place (else it was lost)
      let t = el; if (!el.isConnected) { t = document.getElementById(el.id); if (!t) return; t.value = el.value; }
      t.dispatchEvent(new Event('change', { bubbles: true }));
    }, 0));
    el._sli = ctl;
  }
  function upgrade(root) {
    (root || document).querySelectorAll(SEL).forEach(el => { const l = LISTS.find(q => el.matches(q[0])); if (l) bind(el, l[1]); });
  }
  function start() {
    if (!W.SharedListInput || typeof MutationObserver === 'undefined') return;
    const s = document.createElement('style');
    s.textContent = '.bad + [data-sli="host"] .sli{outline:1px solid #dc2626;outline-offset:2px;}';   // the page's error mark, on the table
    document.head.appendChild(s);
    upgrade(document);
    new MutationObserver(ms => { if (ms.some(m => m.addedNodes.length && !(m.target.closest && m.target.closest('.rp')))) upgrade(document); }).observe(document.body, { childList: true, subtree: true });   // not for nodes added inside the report viewer
  }
  if (typeof document === 'undefined') { /* no page (Node test harness): nothing to bind */ }
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  W.PSBListsUI = { LISTS, upgrade };
})();
