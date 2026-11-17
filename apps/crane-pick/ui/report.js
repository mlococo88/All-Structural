/* apps/crane-pick/ui/report.js — the Report output tab (C1, 2026-11-16): report/builders.js model in the shared viewer
   (shared/report.js), drawn when the tab is shown and again after a change. [[tab:name|text]] links open the app's tabs. */
(function () {
  'use strict';
  const A = window.CranePickApp;
  let el = null, dirty = true, closed = new Set(), view = null;
  function draw() {
    if (!el || !window.SharedReport) return; dirty = false;
    const m = window.CranePickReport.model(A.P);
    el.innerHTML = '<div class="rp-host" id="rptHost"></div>';
    view = SharedReport.mount(el.querySelector('#rptHost'), m, { closed, spy: true, onGoto: name => { const [k, id] = String(name).split(':'); if (k === 'item' && window.CranePickDraw) window.CranePickDraw.select(id, true); else if (k === 'in') A.showITab(id); else A.showOTab(k); } });
  }
  A.outTab({ id: 'rpt', label: 'Report', build: p => { el = p; }, show: () => { if (dirty || !view) draw(); } });
  const mark = () => { dirty = true; if (A.ui.otab === 'rpt') draw(); };
  A.on('project', mark); A.on('change', o => { if (o.kind !== 'select') mark(); });
  window.CranePickReportUI = { redraw: mark, get view() { return view; } };
})();
