/* apps/ps-bridge/ui/report.js — the Report output tab (window.PSBReportUI): the calculation report of the design girder in the shared
   viewer (shared/report.js: navigation tree, section numbers, collapse / expand, search, Print), built by report/builders.js from the
   page's own result (report/data.js). Classic script. Created 2026-11-13 (PR 2e).
   ADAPTED COPY, to move to shared/ later (CLAUDE.md §3): apps/steel-bridge/ui/report.js at e02c618 (window.SBDReportUI): the section chips
   (kept with the page's tab choices, ctx.opts.inc, saved by index.html under its UI key psb2.ui as the steel app keeps them under its own),
   the viewer mounted with the controls in its bar, [[tab:…]] links to the app's tabs, print by the viewer's Print button (the whole report
   alone on the page) or Ctrl+P on the tab (index.html CSS: the report only). Not copied: the steel app's scope (every girder), detail
   (every station) and demand source (hand-off file) choices, and its Build button: the PS engine result is the page's own (computed once
   per input state), so the report is built when the tab opens and rebuilt when the inputs change.

   render(host, ctx), ctx = { P, rc (index.html result(): { inp, R, W }), opts (object kept by the page: { inc: { key: bool } }), save(),
   goto(tab), goin(tab) }. Display only. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = { closed: new Set(), key: '', M: null };
  const incOf = o => { const inc = {}; window.PSBReportBuild.SECTIONS.forEach(([k]) => { inc[k] = !(o.inc && o.inc[k] === false); }); return inc; };
  function controls(o) {
    const inc = incOf(o);
    return `<div class="rp-chips" role="group" aria-label="Report sections">${window.PSBReportBuild.SECTIONS.map(([k, t]) => `<label class="rp-chip"><input type="checkbox" data-rpinc="${k}"${inc[k] ? ' checked' : ''}>${esc(t)}</label>`).join('')}</div>`;
  }
  function render(host, ctx) {
    const o = ctx.opts || {};
    if (window.SharedReport) window.SharedReport.css();
    host.innerHTML = '<div class="rp-host"></div>';
    const box = host.firstChild;
    if (!window.SharedReport) { box.innerHTML = '<div class="alert err">shared/report.js is not loaded.</div>'; return null; }
    const B = window.PSBReportData.compute(ctx.P, ctx.rc);
    if (B.err) { box.innerHTML = `<div class="alert err" role="alert">The report cannot be built: ${esc(B.err)}</div>`; return null; }
    const inc = incOf(o), key = JSON.stringify([ctx.rc && ctx.rc.key, inc]);
    // the model is kept while the inputs and the sections chosen are the same (the result object of the page is the same)
    if (S.key !== key || !S.M) { S.M = window.PSBReportBuild.model(B, { include: inc }); S.key = key; }
    const tb = document.getElementById('tabBar');
    const V = window.SharedReport.mount(box, S.M, { controls: controls(o), closed: S.closed, stick: tb ? tb.offsetHeight : 0, spy: true,
      onGoto: t => { if (/^in:/.test(t)) { if (ctx.goin) ctx.goin(t.slice(3)); } else if (ctx.goto) ctx.goto(t); } });
    box.querySelectorAll('[data-rpinc]').forEach(el => el.addEventListener('change', () => { o.inc = o.inc || {}; o.inc[el.dataset.rpinc] = el.checked; if (ctx.save) ctx.save(); render(host, ctx); }));
    return V;
  }
  window.PSBReportUI = { render, state: S };
})();
