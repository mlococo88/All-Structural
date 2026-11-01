/* apps/steel-bridge/ui/report.js — the Report output tab (window.SBDReportUI): the calculation report of the selected girder in the
   shared viewer (shared/report.js: navigation tree, section numbers, collapse / expand, search, print), built from every module's own
   result (report/data.js) by report/builders.js. Classic script; needs SharedReport, SBDReportData, SBDReportBuild and every module.

   Choices: the sections (chips), the detail ('gov': the governing location of each check group worked; 'all': every station, its
   steps opened on demand) and the demand source (this project's analysis, or a hand-off file). The sections and the detail are kept
   with the page's tab choices (ctx.opts, saved by index.html under its UI key); the source and the file are not saved. The report is
   built on demand (Build report: the analysis takes a few seconds) and marked out of date when the project changes.

   Scope (added 2026-10-30, report wiring PR; kept in ctx.opts.scope): 'girder' (the selected girder's detailed report, as before) or
   'all' (every girder: the governing ratio of each check group per girder, the controlling girder marked; report/builders.js allModel).
   The every-girder report runs each girder's report in turn (one girder per timer tick, with progress) with this project's analysis;
   each girder's summary rows are kept by project state and girder (S.rows), and its analysis in report/data.js's cache, so the
   selected girder's report afterwards, or a second every-girder build with nothing changed, does not run the analyses again.

   render(host, ctx), ctx = { P, g, opts (object kept by the page: { inc: { key: bool }, detail, scope }), save(), goto(tab) } */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = { src: 'analysis', pl: null, plName: '', B: null, key: '', err: '', busy: false, closed: new Set(), A: null, aKey: '', prog: '', rows: new Map(), run: 0 };
  const keyOf = ctx => JSON.stringify([ctx.P, ctx.g, S.src, S.plName]);
  const allKey = ctx => JSON.stringify([ctx.P]);
  const rowKey = (P, gi) => JSON.stringify([P, gi]);   // one girder's summary rows (this project's analysis)
  const incOf = o => { const SEC = window.SBDReportBuild.SECTIONS, inc = {}; SEC.forEach(([k]) => { inc[k] = !(o.inc && o.inc[k] === false); }); return inc; };

  function controls(ctx, built) {
    const o = ctx.opts, inc = incOf(o), SEC = window.SBDReportBuild.SECTIONS, opt = (v, t, cur) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${t}</option>`;
    const sc = `<label>Scope <select id="rp_scope">${opt('girder', 'Selected girder (detailed report)', o.scope)}${opt('all', 'Every girder (governing ratios)', o.scope)}</select></label>`;
    if (o.scope === 'all') return `${sc} <span class="note">Demands: this project's analysis of each girder. Each girder's analysis takes a few seconds; results are kept until the project changes.</span>
      <button type="button" id="rp_build"${built ? '' : ' class="primary"'}>${built ? 'Rebuild' : 'Build report'}</button>`;
    return `${sc}<div class="rp-chips" role="group" aria-label="Report sections">${SEC.map(([k, t]) => `<label class="rp-chip"><input type="checkbox" data-rpinc="${k}"${inc[k] ? ' checked' : ''}>${esc(t)}</label>`).join('')}</div>
      <label>Detail <select id="rp_detail">${opt('gov', 'Governing location of each check', o.detail)}${opt('all', 'Every station (steps open on demand)', o.detail)}</select></label>
      <label>Demands <select id="rp_src">${opt('analysis', "This project's analysis", S.src)}${opt('tabs', "Each tab's choice (Custom where entered; else this project's analysis)", S.src)}${opt('file', 'Hand-off file (GirderDetail → ST-Girder)', S.src)}</select></label>
      ${S.src === 'file' ? `<input type="file" id="rp_file" accept=".json,application/json" aria-label="Hand-off file"><span class="note">${esc(S.plName)}</span>` : ''}
      <button type="button" id="rp_build"${built ? '' : ' class="primary"'}>${built ? 'Rebuild' : 'Build report'}</button>`;
  }

  function render(host, ctx) {
    const o = ctx.opts || {}; if (o.detail !== 'all') o.detail = 'gov'; if (o.scope !== 'all') o.scope = 'girder';
    if (o.scope === 'all') return renderAll(host, ctx);
    const stale = !S.B || S.key !== keyOf(ctx);
    if (window.SharedReport) window.SharedReport.css();
    host.innerHTML = '<div class="rp-host"></div>';
    const box = host.firstChild, P = ctx.P, g = P.girders[ctx.g] || P.girders[0];
    const wire = () => {
      box.querySelectorAll('[data-rpinc]').forEach(el => el.addEventListener('change', () => { o.inc = o.inc || {}; o.inc[el.dataset.rpinc] = el.checked; if (ctx.save) ctx.save(); render(host, ctx); }));
      const on = (id, ev, f) => { const el = box.querySelector('#' + id); if (el) el.addEventListener(ev, f); };
      on('rp_detail', 'change', e => { o.detail = e.target.value; if (ctx.save) ctx.save(); S.busy = true; render(host, ctx); setTimeout(() => { S.busy = false; render(host, ctx); }, 30); });
      on('rp_src', 'change', e => { S.src = e.target.value; render(host, ctx); });
      on('rp_scope', 'change', e => { o.scope = e.target.value; if (ctx.save) ctx.save(); render(host, ctx); });
      on('rp_build', 'click', () => build(host, ctx));
      on('rp_file', 'change', e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
        rd.onload = () => { try { const j = JSON.parse(String(rd.result)), ck = window.SBDDemandFile.check(j); if (!ck.ok) throw new Error(ck.error); const pl = ck.pl;   // B1: GirderDetail hand-offs only (engine/demandfile.js)
          S.pl = pl; S.plName = f.name; } catch (er) { alert('Cannot read this file: ' + er.message); /* nothing changed: the previous file, if any, stays */ } render(host, ctx); };
        rd.readAsText(f); });
    };
    const AUI = window.SBDAnalysisUI, AN = window.SBDAnalysis;
    const bar = AUI && AUI.srcBar ? AUI.srcBar({ src: S.src, auto: S.src === 'analysis', rd: AN && AN.ready ? AN.ready(P, P.girders[ctx.g] ? ctx.g : 0) : null, g: g.label || g.id, plName: S.plName }) : '';
    if (S.busy) { box.innerHTML = `<div class="alert">Building the report of ${esc(g.label || g.id)}… (the analysis takes a few seconds)</div>`; return; }
    if (stale || S.err) {
      box.innerHTML = `${bar}<div class="rp"><div class="rp-bar">${controls(ctx, false)}</div></div>
        ${S.err ? `<div class="alert err">${esc(S.err)}</div>` : ''}<div class="alert stale"><span>${S.B ? 'The report is out of date: inputs changed.' : 'The report has not been built.'} It shows ${esc(g.label || g.id)} (choose the girder on the Girders &amp; plates tab), every module calculated as on its own tab.</span></div>`;
      if (!window.SharedReport) box.insertAdjacentHTML('beforeend', '<div class="alert err">shared/report.js is not loaded.</div>');
      wire(); return;
    }
    const M = window.SBDReportBuild.model(S.B, { detail: o.detail, include: incOf(o) });
    const tb = document.getElementById('tabBar');
    window.SharedReport.mount(box, M, { controls: controls(ctx, true), closed: S.closed, stick: tb ? tb.offsetHeight : 0, onGoto: t => { if (ctx.goto) ctx.goto(t); } });
    if (bar) box.insertAdjacentHTML('afterbegin', bar);
    wire();
  }

  /* ---------- every girder ---------- */
  function renderAll(host, ctx) {
    const o = ctx.opts, P = ctx.P, stale = !S.A || S.aKey !== allKey(ctx);
    if (window.SharedReport) window.SharedReport.css();
    host.innerHTML = '<div class="rp-host"></div>';
    const box = host.firstChild;
    const wire = () => {
      const on = (id, ev, f) => { const el = box.querySelector('#' + id); if (el) el.addEventListener(ev, f); };
      on('rp_scope', 'change', e => { o.scope = e.target.value; if (ctx.save) ctx.save(); render(host, ctx); });
      on('rp_build', 'click', () => buildAll(host, ctx));
    };
    if (S.busy) { box.innerHTML = `<div class="alert">${esc(S.prog || 'Building the report of every girder…')}</div>`; return; }
    if (stale || S.err) {
      box.innerHTML = `<div class="rp"><div class="rp-bar">${controls(ctx, false)}</div></div>${S.err ? `<div class="alert err">${esc(S.err)}</div>` : ''}
        <div class="alert stale"><span>${S.A ? 'The every-girder report is out of date: inputs changed.' : 'The every-girder report has not been built.'} It covers the ${P.girders.length} girder(s) of the Girders &amp; plates tab, each with this project's analysis, every module calculated as on its own tab.</span></div>`;
      wire(); return;
    }
    const M = window.SBDReportBuild.allModel(P, S.A);
    const tb = document.getElementById('tabBar');
    window.SharedReport.mount(box, M, { controls: controls(ctx, true), closed: S.closed, stick: tb ? tb.offsetHeight : 0, onGoto: t => { if (ctx.goto) ctx.goto(t); } });
    wire();
  }
  /* one girder after the other, one per timer tick (the page stays responsive and shows the progress); a girder whose rows are kept
     for this project state is not run again */
  function buildAll(host, ctx) {
    const P = ctx.P, n = P.girders.length, list = [], run = ++S.run, t0 = Date.now();
    S.busy = true; S.err = ''; S.prog = `Building the report of every girder: girder 1 of ${n}…`; render(host, ctx);
    const step = gi => {
      if (run !== S.run) return;
      if (gi >= n) { S.A = list; S.aKey = allKey(ctx); S.busy = false; S.prog = ''; S.secs = (Date.now() - t0) / 1000; render(host, ctx); return; }
      const g = P.girders[gi], lab = g.label || g.id || `G${gi + 1}`;
      try {
        let e = S.rows.get(rowKey(P, gi));
        if (!e) { const B = window.SBDReportData.compute(P, gi, { src: 'analysis' }), r = window.SBDReportBuild.govRows(B); e = { rows: r.rows, err: r.err }; S.rows.set(rowKey(P, gi), e); }
        list.push({ gi, label: lab, rows: e.rows, err: e.err });
      } catch (er) { list.push({ gi, label: lab, rows: [], err: { all: 'Report error: ' + (er && er.message) } }); }
      if (S.rows.size > 4 * n + 8) S.rows.delete(S.rows.keys().next().value);
      S.prog = `Building the report of every girder: girder ${Math.min(gi + 2, n)} of ${n}…`; render(host, ctx);
      setTimeout(() => step(gi + 1), 30);
    };
    setTimeout(() => step(0), 30);
  }
  function build(host, ctx) {
    if (S.src === 'file' && !S.pl) { alert('Choose a hand-off file (GirderDetail → ST-Girder demands, .json).'); return; }
    S.busy = true; S.err = ''; render(host, ctx);
    setTimeout(() => {
      try { S.B = window.SBDReportData.compute(ctx.P, ctx.g, { src: S.src, pl: S.pl, plName: S.plName }); if (S.B.err.all) S.err = S.B.err.all;
        else if (S.src === 'analysis' && !S.B.custom && window.SBDReportBuild.govRows) { const r = window.SBDReportBuild.govRows(S.B); S.rows.set(rowKey(ctx.P, ctx.g), { rows: r.rows, err: r.err }); } }
      catch (e) { S.B = null; S.err = 'Report error: ' + (e && e.message); }
      S.key = keyOf(ctx); S.busy = false; render(host, ctx);
    }, 30);
  }

  window.SBDReportUI = { render };
})();
