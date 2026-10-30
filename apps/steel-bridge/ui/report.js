/* apps/steel-bridge/ui/report.js — the Report output tab (window.SBDReportUI): the calculation report of the selected girder in the
   shared viewer (shared/report.js: navigation tree, section numbers, collapse / expand, search, print), built from every module's own
   result (report/data.js) by report/builders.js. Classic script; needs SharedReport, SBDReportData, SBDReportBuild and every module.

   Choices: the sections (chips), the detail ('gov': the governing location of each check group worked; 'all': every station, its
   steps opened on demand) and the demand source (this project's analysis, or a hand-off file). The sections and the detail are kept
   with the page's tab choices (ctx.opts, saved by index.html under its UI key); the source and the file are not saved. The report is
   built on demand (Build report: the analysis takes a few seconds) and marked out of date when the project changes.

   render(host, ctx), ctx = { P, g, opts (object kept by the page: { inc: { key: bool }, detail }), save(), goto(tab) } */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = { src: 'analysis', pl: null, plName: '', B: null, key: '', err: '', busy: false, closed: new Set() };
  const keyOf = ctx => JSON.stringify([ctx.P, ctx.g, S.src, S.plName]);
  const incOf = o => { const SEC = window.SBDReportBuild.SECTIONS, inc = {}; SEC.forEach(([k]) => { inc[k] = !(o.inc && o.inc[k] === false); }); return inc; };

  function controls(ctx, built) {
    const o = ctx.opts, inc = incOf(o), SEC = window.SBDReportBuild.SECTIONS, opt = (v, t, cur) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${t}</option>`;
    return `<div class="rp-chips" role="group" aria-label="Report sections">${SEC.map(([k, t]) => `<label class="rp-chip"><input type="checkbox" data-rpinc="${k}"${inc[k] ? ' checked' : ''}>${esc(t)}</label>`).join('')}</div>
      <label>Detail <select id="rp_detail">${opt('gov', 'Governing location of each check', o.detail)}${opt('all', 'Every station (steps open on demand)', o.detail)}</select></label>
      <label>Demands <select id="rp_src">${opt('analysis', "This project's analysis", S.src)}${opt('file', 'Hand-off file (GirderDetail → ST-Girder)', S.src)}</select></label>
      ${S.src === 'file' ? `<input type="file" id="rp_file" accept=".json,application/json" aria-label="Hand-off file"><span class="note">${esc(S.plName)}</span>` : ''}
      <button type="button" id="rp_build"${built ? '' : ' class="primary"'}>${built ? 'Rebuild' : 'Build report'}</button>`;
  }

  function render(host, ctx) {
    const o = ctx.opts || {}; if (o.detail !== 'all') o.detail = 'gov';
    const stale = !S.B || S.key !== keyOf(ctx);
    if (window.SharedReport) window.SharedReport.css();
    host.innerHTML = '<div class="rp-host"></div>';
    const box = host.firstChild, P = ctx.P, g = P.girders[ctx.g] || P.girders[0];
    const wire = () => {
      box.querySelectorAll('[data-rpinc]').forEach(el => el.addEventListener('change', () => { o.inc = o.inc || {}; o.inc[el.dataset.rpinc] = el.checked; if (ctx.save) ctx.save(); render(host, ctx); }));
      const on = (id, ev, f) => { const el = box.querySelector('#' + id); if (el) el.addEventListener(ev, f); };
      on('rp_detail', 'change', e => { o.detail = e.target.value; if (ctx.save) ctx.save(); S.busy = true; render(host, ctx); setTimeout(() => { S.busy = false; render(host, ctx); }, 30); });
      on('rp_src', 'change', e => { S.src = e.target.value; render(host, ctx); });
      on('rp_build', 'click', () => build(host, ctx));
      on('rp_file', 'change', e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
        rd.onload = () => { try { const j = JSON.parse(String(rd.result)), pl = j.payload || j; if (!pl || pl._schema !== 'stgirder-external-demands' || !Array.isArray(pl.stations)) throw new Error('not a GirderDetail → ST-Girder hand-off file (schema stgirder-external-demands)');
          S.pl = pl; S.plName = f.name; } catch (er) { S.pl = null; S.plName = ''; alert('Cannot read this file: ' + er.message); } render(host, ctx); };
        rd.readAsText(f); });
    };
    if (S.busy) { box.innerHTML = `<div class="alert">Building the report of ${esc(g.label || g.id)}… (the analysis takes a few seconds)</div>`; return; }
    if (stale || S.err) {
      box.innerHTML = `<div class="rp"><div class="rp-bar">${controls(ctx, false)}</div></div>
        ${S.err ? `<div class="alert err">${esc(S.err)}</div>` : ''}<div class="alert stale"><span>${S.B ? 'The report is out of date: inputs changed.' : 'The report has not been built.'} It shows ${esc(g.label || g.id)} (choose the girder on the Girders &amp; plates tab), every module calculated as on its own tab.</span></div>`;
      if (!window.SharedReport) box.insertAdjacentHTML('beforeend', '<div class="alert err">shared/report.js is not loaded.</div>');
      wire(); return;
    }
    const M = window.SBDReportBuild.model(S.B, { detail: o.detail, include: incOf(o) });
    const tb = document.getElementById('tabBar');
    window.SharedReport.mount(box, M, { controls: controls(ctx, true), closed: S.closed, stick: tb ? tb.offsetHeight : 0, onGoto: t => { if (ctx.goto) ctx.goto(t); } });
    wire();
  }
  function build(host, ctx) {
    if (S.src === 'file' && !S.pl) { alert('Choose a hand-off file (GirderDetail → ST-Girder demands, .json).'); return; }
    S.busy = true; S.err = ''; render(host, ctx);
    setTimeout(() => {
      try { S.B = window.SBDReportData.compute(ctx.P, ctx.g, { src: S.src, pl: S.pl, plName: S.plName }); if (S.B.err.all) S.err = S.B.err.all; }
      catch (e) { S.B = null; S.err = 'Report error: ' + (e && e.message); }
      S.key = keyOf(ctx); S.busy = false; render(host, ctx);
    }, 30);
  }

  window.SBDReportUI = { render };
})();
