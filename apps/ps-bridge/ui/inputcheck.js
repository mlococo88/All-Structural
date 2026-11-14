/* apps/ps-bridge/ui/inputcheck.js — the blocking input errors on the page (window.PSBInputCheckUI). Classic script; display only.
   COPY, to move to shared/ later (CLAUDE.md §3): apps/steel-bridge/ui/inputcheck.js at 28e1605 (SBINV, engineer's decision 2026-11-09:
   "Invalid input should be highlighted so the user can fix; results should not be displayed"), changed only in: namespace PSBInputCheckUI;
   fieldsOf finds a field by its data-path alone (else a row's inputs, else the nearest parent path: a list entry's input) (every input of this app carries one; no steel list inputs or output-tab fields); the cell
   of a table row is marked by its own data-path; no SBDInputCheck.NOTE. The list is engine/inputcheck.js collect(P); index.html calls:
     mark(errors, o)    every invalid field: red outline (input.bad) and its message beside it (.alert.err); a cell of a table: the cell
                        outlined, the message under the table. o = { P, ui, tabOf }.
     banner(errors, o)  "N inputs need fixing before results can be shown", each error a link (data-icgo = its index) to the input tab and
                        the field. blocked(errors, o): the banner and "Results not shown: fix the inputs above".
     dash(errors, o)    the same list for the check summary column.
     fieldsOf(path, o)  the page elements of a field; focus(e, o) scrolls to and focuses it (after its tab is drawn).
   Nothing is stored or computed here. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const q = (root, sel) => { try { return [...(root || document).querySelectorAll(sel)]; } catch (e) { return []; } };
  const qa = s => String(s).replace(/["\\]/g, '\\$&');
  function css() {
    if (document.getElementById('ic-css')) return;
    const st = document.createElement('style'); st.id = 'ic-css';
    st.textContent = `select.bad,input.bad{border-color:var(--fail)!important;background:#FEF2F2;outline:2px solid var(--fail);outline-offset:1px;}
      .alert.err.ic-msg{margin:2px 0 6px;padding:3px 8px;}
      .sli input.sli-in.ic-cell{border-color:#dc2626;background:rgba(220,38,38,.08);outline:2px solid #dc2626;outline-offset:0;}
      .inTabs button.has-err{border-color:var(--fail);color:#991B1B;}
      .inTabs button.has-err .inDot{display:inline-block;width:auto;height:auto;min-width:15px;padding:0 4px;border-radius:8px;color:#fff;font-size:7.5pt;font-weight:700;line-height:14px;text-align:center;vertical-align:1px;}
      .ic-banner ul{margin:4px 0 2px;padding-left:18px;} .ic-banner li{margin:2px 0;} .ic-banner a{color:#991B1B;} .ic-banner .ic-where{font-weight:600;}
      .ic-none{font-family:var(--font-ui);font-size:10pt;font-weight:600;color:#991B1B;margin:6px 0 12px;}
      #sbDashCol .ic-dash{margin:8px 0;} #sbDashCol .ic-dash ul{margin:4px 0;padding-left:14px;font-size:8.5pt;} #sbDashCol .ic-dash a{color:#991B1B;}
      @media print{.ic-banner a{color:#000;text-decoration:none;}}`;
    document.head.appendChild(st);
  }
  /* fieldsOf(path, o): the elements of a field (data-path), else the inputs of a row or group under it (e.g. a table) */
  function fieldsOf(path) {
    const p = String(path || ''), IP = '#inPanes ';
    let els = q(document, `${IP}[data-path="${qa(p)}"]`);
    if (!els.length) els = q(document, `${IP}[data-path^="${qa(p)}."]`);
    let up = p; while (!els.length && /\./.test(up)) { up = up.replace(/\.[^.]*$/, ''); els = q(document, `${IP}[data-path="${qa(up)}"]`); }   // a list entry (xs.bays.1): the list's input
    return els;
  }
  /* 2026-11-14: the list inputs as tables (ui/lists.js; the steel app's isList / cellIn): the hidden input is the field, its table follows
     it; a list entry's error (xs.bays.1) marks and focuses that row's cell */
  const LSEL = () => window.PSBListsUI ? window.PSBListsUI.LISTS.map(l => l[0]).join(',') : '';
  const isList = el => { const s = LSEL(); try { return !!(el && s && el.matches(s)); } catch (e) { return false; } };
  const cellIn = (el, i) => { const h = el && el.nextElementSibling; return h && h.querySelector ? h.querySelector(`tr[data-sli-r="${i}"] input.sli-in`) : null; };
  const cellOf = p => { const m = String(p || '').match(/\.(\d+)$/); return m ? +m[1] : null; };
  /* the field's label (the banner): its <label>, an aria-label, or the column head of its table cell */
  function labelOf(el) {
    if (!el) return '';
    const id = el.id, lb = id ? document.querySelector(`label[for="${qa(id)}"]`) : null;
    if (lb) return lb.textContent.trim();
    return el.getAttribute('aria-label') || '';
  }
  /* mark(errors, o): clears the previous marks, then marks every field of the list */
  function mark(errors, o) {
    css();
    q(document, '.ic-msg').forEach(n => n.remove());
    q(document, '.ic-bad').forEach(n => n.classList.remove('bad', 'ic-bad'));
    q(document, '#inPanes [data-path].bad').forEach(n => n.classList.remove('bad'));
    q(document, '.ic-cell').forEach(n => n.classList.remove('ic-cell'));
    const after = new Map();   // the node after which a message goes -> its messages
    const cells = [];
    errors.forEach(e => {
      const els = fieldsOf(e.path, o); if (!els.length) return;
      els.forEach(el => { el.classList.add('bad', 'ic-bad'); el.setAttribute('aria-invalid', 'true'); });
      const el = els[0], td = el.closest('td'), at = td ? (el.closest('.tscroll') || el.closest('table')) : (el.closest('.fRow') || el);
      if (!after.has(at)) after.set(at, []); after.get(at).push(e.msg);
      if (isList(el)) cells.push([el, cellOf(e.path)]);
    });
    // the list tables are bound after the page draws (ui/lists.js MutationObserver): their cells are marked once they exist
    if (cells.length) setTimeout(() => cells.forEach(([el, i]) => { const c = i != null ? cellIn(el, i) : null; if (c) c.classList.add('ic-cell'); }), 0);
    q(document, '#inPanes [aria-invalid]').forEach(n => { if (!n.classList.contains('bad')) n.removeAttribute('aria-invalid'); });
    after.forEach((msgs, at) => { const d = document.createElement('div'); d.className = 'alert err ic-msg'; d.setAttribute('role', 'alert');
      d.innerHTML = [...new Set(msgs)].map(esc).join('<br>'); at.insertAdjacentElement('afterend', d); });
  }
  /* where(e, o): "Tab › Field" for the banner */
  function where(e, o) {
    const tabName = t => { const b = document.querySelector(`#inTabs [data-itab="${t}"]`); return b ? b.firstChild && b.firstChild.nodeType === 3 ? b.firstChild.textContent.trim() : b.textContent.trim() : t; };
    const t = tabName(o.tabOf(e.path));
    const lb = labelOf(fieldsOf(e.path, o)[0]);
    return lb ? `${t} › ${lb}` : t;
  }
  function count(n) { return `${n} input${n === 1 ? ' needs' : 's need'} fixing before results can be shown`; }
  function banner(errors, o) {
    css();
    return `<div class="alert err ic-banner" role="alert" id="icBanner"><b>${count(errors.length)}</b><ul>${errors.map((e, i) => `<li><a href="#" data-icgo="${i}"><span class="ic-where">${esc(where(e, o))}</span>: ${esc(e.msg)}</a></li>`).join('')}</ul></div>`;
  }
  function blocked(errors, o) { return banner(errors, o) + '<p class="ic-none" id="icNone">Results not shown: fix the inputs above.</p>'; }
  /* dash(errors, o): the left check summary column while errors exist (no verdict, no values) */
  function dash(errors, o) {
    css();
    return `<div class="alert err ic-dash" role="alert"><b>${count(errors.length)}</b><ul>${errors.map((e, i) => `<li><a href="#" data-icgo="${i}">${esc(where(e, o))}: ${esc(e.msg)}</a></li>`).join('')}</ul><div>Results not shown: fix the inputs above.</div></div>`;
  }
  /* focus(e, o): scrolls to and focuses the field (its tab is drawn first by the page) */
  function focus(e, o) {
    const el = fieldsOf(e.path, o)[0]; if (!el) return false;
    const go = t => { if (!t) return; t.scrollIntoView({ block: 'center' }); try { t.focus({ preventScroll: true }); } catch (er) { t.focus(); } };
    // 2026-11-14: a list (a hidden input and its table): the row's cell when known, else the first cell (the steel app's focus)
    if (isList(el) || el.type === 'hidden' || el.offsetParent === null) { setTimeout(() => { const i = cellOf(e.path), c = (i != null && cellIn(el, i)) || (el.nextElementSibling && el.nextElementSibling.querySelector && el.nextElementSibling.querySelector('input.sli-in')) || el; go(c); }, 0); return true; }
    go(el); return true;
  }
  window.PSBInputCheckUI = { css, mark, banner, blocked, dash, fieldsOf, focus, labelOf, where };
})();
