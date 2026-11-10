/* apps/steel-bridge/ui/inputcheck.js — the blocking input errors on the page (window.SBDInputCheckUI). Classic script; display only.
   SBINV (2026-11-10; engineer's decision 2026-11-09: "Invalid input should be highlighted so the user can fix; results should not be
   displayed"). The list is engine/inputcheck.js collect(P); index.html calls:
     mark(errors, o)    every invalid field: red outline (input.bad, the app's existing mark) and its message beside it (.alert.err, the app's
                        alert style); a cell of a list or table: the cell outlined, the message under the table. o = { P, ui, tabOf }.
     banner(errors, o)  the banner at the top of the output panel: "N inputs need fixing before results can be shown", each error a link
                        (data-icgo = its index) to the input tab and the field. blocked(errors, o): the banner and "Results not shown: fix
                        the inputs above" (what every output tab shows instead of its results while an error exists).
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
  /* the output-tab fields (e.host): their element on the output tab */
  const HOST_EL = { 'rating.phiC': '#rt_phiC', 'rating.phiS': '#rt_phiS', 'welds.Fexx': '#wt_Fexx', 'welds.w': '#wt_w', 'welds.ground': '#wt_gr', 'constr.flC': '#cn_flC', 'flexure.fl': '#fx_fl' };
  /* fieldsOf(path, o): the elements of a field (input tabs: data-path, else the inputs drawn without one) */
  function fieldsOf(path, o) {
    const p = String(path || ''), ui = (o && o.ui) || {}, IP = '#inPanes ';
    let els = q(document, `${IP}[data-path="${qa(p)}"]`);
    if (els.length) return els;
    const ids = [];
    if (/^spans\.lengths\b/.test(p)) ids.push('#i_spans');
    else if (p === 'xs.bays') ids.push('[id="i_xs.bays"]');
    else if (p === 'xs.skews') ids.push('[id="i_xs.skews"]');
    else if (p === 'framing.splices') ids.push('#fr_spl', '#i_splx');
    else if (p === 'studs.splX') ids.push('[id="i_studs.splX"]');
    else { let m;
      if ((m = p.match(/^analysis\.fm\.(\w+)$/))) ids.push(`#an_fm_${m[1]}`);
      else if ((m = p.match(/^analysis\.(\w+)$/))) ids.push(`#an_a_${m[1]}`);
      else if ((m = p.match(/^girders\.(\d+)\.(loadsManual|dfManual)\.(\w+)$/)) && +m[1] === +ui.g) ids.push(`#an_${m[2] === 'loadsManual' ? 'l' : 'd'}_${m[3]}`); }
    ids.forEach(s => { els = els.concat(q(document, IP + s)); });
    if (!els.length && HOST_EL[p]) els = q(document, '#out ' + HOST_EL[p]);
    if (!els.length && /^demandSrc\./.test(p)) els = q(document, '#out select[id$="_src"]').slice(0, 1);
    if (!els.length) els = q(document, `${IP}[data-path^="${qa(p)}."]`);   // a row or group (e.g. a pitch zone): its inputs
    return els;
  }
  const LSEL = () => window.SBDListsUI ? window.SBDListsUI.LISTS.map(l => l[0]).join(',') : '';
  const isList = el => { const s = LSEL(); try { return !!(el && s && el.matches(s)); } catch (e) { return false; } };   // a list input (ui/lists.js: the table follows it)
  const cellIn = (el, i) => { const h = el && el.nextElementSibling; return h && h.querySelector ? h.querySelector(`tr[data-sli-r="${i}"] input.sli-in`) : null; };
  /* the field's label (the banner): its <label>, an aria-label, or the column head of its table cell */
  function labelOf(el) {
    if (!el) return '';
    const id = el.id, lb = id ? document.querySelector(`label[for="${qa(id)}"]`) : null;
    if (lb) return lb.textContent.trim();
    const td = el.closest('td'), tr = td && td.closest('tr'), tb = td && td.closest('table');
    if (td && tb) { const i = [...tr.children].indexOf(td), heads = tb.querySelectorAll('thead tr'), last = heads[heads.length - 1], th = last && last.children[i - (last.children.length < tr.children.length ? tr.children.length - last.children.length : 0)];
      const row = tr.parentNode ? [...tr.parentNode.children].indexOf(tr) + 1 : 0;
      return `row ${row}${th ? ', ' + th.textContent.replace(/\s+/g, ' ').trim() : ''}`; }
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
      els.forEach(el => el.classList.add('bad', 'ic-bad'));
      const el = els[0], td = el.closest('td'), at = td ? (el.closest('.tscroll') || el.closest('table')) : (el.closest('.fRow') || el);
      if (!after.has(at)) after.set(at, []); after.get(at).push((td ? labelOf(el) + ': ' : '') + e.msg);
      if (isList(el)) cells.push([el, e.cell]);
    });
    after.forEach((msgs, at) => { const d = document.createElement('div'); d.className = 'alert err ic-msg'; d.setAttribute('role', 'alert');
      d.innerHTML = [...new Set(msgs)].map(esc).join('<br>'); at.insertAdjacentElement('afterend', d); });
    // the list tables are bound after the page draws (ui/lists.js MutationObserver): their cells are marked once they exist
    if (cells.length) setTimeout(() => cells.forEach(([el, i]) => { const c = i != null ? cellIn(el, i) : null; if (c) c.classList.add('ic-cell'); }), 0);
  }
  /* where(e, o): "Tab › Field" for the banner */
  function where(e, o) {
    const tabName = t => { const b = document.querySelector(`#inTabs [data-itab="${t}"]`) || document.querySelector(`#tabBar [data-otab="${t}"]`); return b ? b.firstChild && b.firstChild.nodeType === 3 ? b.firstChild.textContent.trim() : b.textContent.trim() : t; };
    const t = e.host ? `${tabName(e.host)} output tab` : tabName(o.tabOf(e.path));
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
  /* focus(e, o): scrolls to and focuses the field (its tab is drawn first by the page); a list's row cell when known */
  function focus(e, o) {
    const els = fieldsOf(e.path, o), el = els[0]; if (!el) return false;
    const go = t => { if (!t) return; t.scrollIntoView({ block: 'center' }); try { t.focus({ preventScroll: true }); } catch (er) { t.focus(); } };
    if (isList(el) || el.type === 'hidden' || el.offsetParent === null) { setTimeout(() => { const c = (e.cell != null && cellIn(el, e.cell)) || (el.nextElementSibling && el.nextElementSibling.querySelector && el.nextElementSibling.querySelector('input.sli-in')) || el; go(c); }, 0); return true; }
    go(el); return true;
  }
  window.SBDInputCheckUI = { css, mark, banner, blocked, dash, fieldsOf, focus, labelOf, where };
})();
