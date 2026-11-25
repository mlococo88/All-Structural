/* apps/steel-bridge/ui/report.js — the Report output tab (window.SBDReportUI): the calculation report of the selected girder in the
   shared viewer (shared/report.js: navigation tree, section numbers, collapse / expand, search, print), built from every module's own
   result (report/data.js) by report/builders.js. Classic script; needs SharedReport, SBDReportData, SBDReportBuild and every module.

   Choices: the sections (chips), the detail ('gov': the governing location of each check group worked; 'all': every station, its
   steps opened on demand) and the demand source (this project's analysis, or a hand-off file). The sections and the detail are kept
   with the page's tab choices (ctx.opts, saved by index.html under its UI key); the source and the file are not saved. The report is
   built on demand (Build report: the analysis takes a few seconds) and marked out of date when the project changes.

   Scope (added 2026-10-30, report wiring PR; kept in ctx.opts.scope): 'girder' (the selected girder's detailed report, as before) or
   'all' (every girder: the governing ratio of each check group per girder, the controlling girder marked; report/builders.js allModel;
   since 2026-11-23 with the Executive summary first, the Summary tab's verdict of the bridge, and the steel bill of materials last).
   The every-girder report runs each girder's report in turn (one girder per timer tick, with progress) with this project's analysis;
   each girder's summary rows are kept by project state and girder (S.rows), and its analysis in report/data.js's cache, so the
   selected girder's report afterwards, or a second every-girder build with nothing changed, does not run the analyses again.

   RPX (2026-11-23; engineer 2026-11-23: the Report extras of the Prestressed Bridge app, apps/ps-bridge/ui/report.js figures()), display
   only: figures(B, inc) draws the graphics of each included output tab off screen, with the tab's own drawing code and the module result
   the report already holds (B.flex, B.shear, …: the result the tab itself draws), takes each card's figure (its title, the series shown,
   legend and captions; the screen controls left out) and gives report/builders.js { <section key>: [{ caption, svg }] }, which puts them
   last in the section and numbers them "Figure n.m". Drawn once per built report (S.figs, kept with S.B). The 3D view tab's "Capture for
   the Report" (ui/view3d.js snapshot) goes to the Project and owner section, with a note when the inputs changed after the capture.
   No drawing code here; no value is computed.

   render(host, ctx), ctx = { P, g, opts (object kept by the page: { inc: { key: bool }, detail, scope }), save(), goto(tab) } */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = { src: 'analysis', pl: null, plName: '', B: null, key: '', err: '', busy: false, closed: new Set(), A: null, aKey: '', prog: '', rows: new Map(), run: 0 };
  const keyOf = ctx => JSON.stringify([ctx.P, ctx.g, S.src, S.plName]);
  const allKey = ctx => JSON.stringify([ctx.base || ctx.P]);   // SB-2 PR 2: ctx.base, the project itself (ctx.P: the type on the line chosen)
  const rowKey = (P, gi) => JSON.stringify([P, gi]);   // one girder's summary rows (this project's analysis)
  const secOf = P => (window.SBDReportBuild.sectionsOf ? window.SBDReportBuild.sectionsOf(P) : window.SBDReportBuild.SECTIONS);   // DK (2026-11-23): + "Deck slab" where the project has the deck design on
  const incOf = (o, P) => { const SEC = secOf(P), inc = {}; SEC.forEach(([k]) => { inc[k] = !(o.inc && o.inc[k] === false); }); return inc; };

  /* ---------- RPX: the tabs' graphics as report figures ---------- */
  const PW = 700;   // the width the graphics are drawn at (px): the printed text width
  const plainA = el => { el.querySelectorAll('a').forEach(a => { const sp = document.createElement('span'); sp.innerHTML = a.innerHTML; a.replaceWith(sp); }); return el; };
  const STATIC = [[/; click a (station|location|panel|row|splice|detail) to select it\./gi, '.'], [/\s*Click a (station|location|panel|row|splice|detail)[^.]*\./gi, ''], [/\s*Point at[^.]*\./gi, ''], [/the tables? below/g, 'the tables of this section'], [/the tables? above/g, 'the tables of this section']];
  const still = h => STATIC.reduce((t, [re, w]) => t.replace(re, w), h);
  const text = h => { const d = document.createElement('div'); d.innerHTML = h; d.querySelectorAll('sub').forEach(q => { q.textContent = `$_{${q.textContent.replace(/[${}]/g, '')}}$`; }); return d.textContent.replace(/\s+/g, ' ').trim(); };   // a subscript as the report's notation
  /* one graphic card as drawn: { caption, svg } (the figure with the series shown, the legend and the captions; controls, read-out and the DXF note left out) */
  function one(card) {
    const h3 = card.querySelector('.vk-hd h3'), sm = h3 && h3.querySelector('small'), t = h3 ? h3.cloneNode(true) : null; if (t && t.querySelector('small')) t.querySelector('small').remove();
    const seg = card.querySelector('.vk-seg button[aria-pressed="true"]');
    const fig = card.querySelector('.vk-fig'); if (!fig || !fig.querySelector('svg')) return null;
    const f = plainA(fig.cloneNode(true)); f.querySelectorAll('.va-hov, button, select, input').forEach(n => n.remove()); f.removeAttribute('style');
    const chips = [...card.querySelectorAll(':scope > .vk-chips')].map(c => { const on = [...c.querySelectorAll('button[aria-pressed="true"]')]; if (!on.length) return '';
      return `<div class="va-leg"><span><b>Shown:</b></span>${on.map(b => `<span>${b.innerHTML}</span>`).join('')}</div>`; }).join('');
    const extra = chips + [...card.querySelectorAll(':scope > .va-leg, :scope > .vk-cap')].map(n => { const c = plainA(n.cloneNode(true)); c.classList.remove('vk-pr'); return still(c.outerHTML); }).join('');
    const cap = (t ? still(text(t.innerHTML)) : 'Graphic') + (sm ? ` (${still(text(sm.innerHTML))})` : '') + (seg ? `; shown: ${seg.textContent.trim()}` : '');
    return { caption: cap, svg: `<div class="vk rp-vk"><div class="vk-fig">${f.innerHTML}</div>${extra}</div>` };
  }
  const grab = host => [...host.querySelectorAll('.vk.va-card, .vk.vk-det, .vk#secc')].map(one).filter(Boolean);   // #secc: the Section properties card (ui/gfxa.js section)
  /* the drawing calls of the tabs (the same calls, with the bundle's results; sel null = the tab's default) */
  const slots = n => n.map(x => `<div data-gfxb="${x}"></div>`).join('');
  const DRAW = {
    sec: (h, B) => { const A = window.SBDGfxA, S0 = B.sec; if (!A || !S0 || !S0.cards) return [];
      return [].concat(...S0.cards.slice(0, 12).map(cd => { h.innerHTML = '<div id="gfx_sec"></div>'; A.section(h.firstChild, { P: B.P, R: { c: cd.c, s: cd.seg, nr: S0.nr, lf: S0.lf, g: B.girder, beff: S0.beff }, seg: cd.i + 1 });
        return grab(h).map(q => ({ ...q, caption: `${q.caption}; segment ${cd.i + 1}, ${cd.region === 'neg' ? 'negative' : 'positive'} flexure` })); })); },
    loads: (h, B) => { const A = window.SBDGfxA, R = B.loads; if (!A || !R || !R.dead) return []; const AN = window.SBDAnalysis, lg = Math.min(AN ? AN.lineOf(B.P, B.girder) : 0, R.dead.N - 1);
      h.innerHTML = '<div id="gfx_ld"></div>'; A.loads(h.firstChild, { P: B.P, R, lg, lr: 0 }); return grab(h); },
    an: (h, B) => { const A = window.SBDGfxA; if (!A || !B.an || B.src === 'file') return []; h.innerHTML = '<div id="gfx_an"></div>'; A.analysis(h.firstChild, { P: B.P, gi: B.g, R: B.an }); return grab(h); },
    flex: (h, B) => { const A = window.SBDGfxA; if (!A || !B.flex) return []; h.innerHTML = '<div id="gfx_fx"></div>'; A.flexure(h.firstChild, { P: B.P, gi: B.g, R: B.flex, sel: null, onSelect() {} }); return grab(h); },
    cn: (h, B) => { const A = window.SBDGfxA; if (!A || !B.cn || !B.cn.rows) return []; h.innerHTML = '<div id="gfx_cn"></div>'; A.constr(h.firstChild, { P: B.P, gi: B.g, R: B.cn, sel: null, onSelect() {} }); return grab(h); },
    shear: (h, B, T, c) => { if (!T || !B.shear) return []; h.innerHTML = slots(['shear', 'shear-detail', 'shear-bearing']); T.shear(h, c, B.shear, null, null); return grab(h); },
    fat: (h, B, T, c) => { if (!T || !B.fat) return []; h.innerHTML = slots(['fatigue', 'fatigue-chart']); T.fatigue(h, c, B.fat, null, null); return grab(h); },
    frm: (h, B, T, c) => { const F = window.SBDFramingUI; if (!T || !B.frm || B.frm.err || (F && F.isDia && F.isDia(B.P))) return []; h.innerHTML = slots(['crossframe']); T.crossframe(h, c, B.frm); return grab(h); },
    wd: (h, B, T, c) => { if (!T || !B.wd) return []; h.innerHTML = slots(['welds', 'weld-detail']); T.welds(h, c, B.wd, null, null); return grab(h); },
    rt: (h, B, T, c) => { if (!T || !B.rating) return []; h.innerHTML = slots(['rating']); T.rating(h, c, B.rating, null, null); return grab(h); }
  };
  function figures(B) {
    const out = {};
    if (typeof document === 'undefined' || !B || !window.SBDVizKit || !window.SBDVizAlong) return out;
    const host = document.createElement('div'); host.setAttribute('aria-hidden', 'true'); host.style.cssText = `position:absolute;left:-30000px;top:0;width:${PW}px;visibility:hidden;pointer-events:none;`;
    document.body.appendChild(host);
    const T = window.SBDTabGfxBUI, keep = T && T.handles ? { ...T.handles } : null, c = { P: B.P, g: B.g };
    try { Object.keys(DRAW).forEach(k => { try { const L = DRAW[k](host, B, T, c); if (L && L.length) out[k] = L; } catch (e) { console.warn('report figure', k, e); } host.innerHTML = ''; }); }
    finally { host.remove(); if (T && keep) T.handles = keep; }   // the tabs' own mounted graphics (tests read them) stay as they were
    return out;
  }
  /* the 3D view captured for the Report (ui/view3d.js): stale when the project changed after the capture */
  function snap3d(ctx) {
    const q = window.SBD3DUI && window.SBD3DUI.snapshot ? window.SBD3DUI.snapshot() : null; if (!q) return null;
    return { png: q.png, at: q.at, meta: q.meta, stale: !!q.key && q.key !== JSON.stringify(ctx.base || ctx.P) };
  }

  function controls(ctx, built) {
    const o = ctx.opts, inc = incOf(o, ctx.base || ctx.P), SEC = secOf(ctx.base || ctx.P), opt = (v, t, cur) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${t}</option>`;
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
    if (S.figB !== S.B) { S.figs = {}; try { S.figs = figures(S.B); } catch (e) { console.warn(e); } S.figB = S.B; }   // RPX: the tabs' graphics, drawn once per built report
    const M = window.SBDReportBuild.model(S.B, { detail: o.detail, include: incOf(o, ctx.base || ctx.P), figures: S.figs, snap3d: snap3d(ctx) });
    const tb = document.getElementById('tabBar');
    window.SharedReport.mount(box, M, { controls: controls(ctx, true), closed: S.closed, stick: tb ? tb.offsetHeight : 0, onGoto: t => { if (ctx.goto) ctx.goto(t); } });
    if (bar) box.insertAdjacentHTML('afterbegin', bar);
    wire();
    if (window.SBDReportReview) window.SBDReportReview.attach(box, ctx);   // review tools (ui/rpreview.js, 2026-11-19): contents sidebar, markup, reviewed copy
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
    if (window.SBDReportReview) window.SBDReportReview.attach(box, ctx);   // review tools (ui/rpreview.js)
  }
  /* one girder after the other, one per timer tick (the page stays responsive and shows the progress); a girder whose rows are kept
     for this project state is not run again */
  function buildAll(host, ctx) {
    // SB-2 PR 2 (2026-11-12): one column per girder type on each of its lines (report/summary.js units; a type on one line: as before)
    const P0 = ctx.base || ctx.P, US = window.SBDSummary.units(P0), n = US.length, list = [], run = ++S.run, t0 = Date.now();
    S.busy = true; S.err = ''; S.prog = `Building the report of every girder: girder 1 of ${n}…`; render(host, ctx);
    const step = k => {
      if (run !== S.run) return;
      if (k >= n) { S.A = list; S.aKey = allKey(ctx); S.busy = false; S.prog = ''; S.secs = (Date.now() - t0) / 1000; render(host, ctx); return; }
      const { gi, j, P } = US[k], g = P.girders[gi], many = US.filter(q => q.gi === gi).length > 1, lab = (g.label || g.id || `G${gi + 1}`) + (many ? ` on G${j + 1}` : '');
      try {
        let e = S.rows.get(rowKey(P, gi));
        if (!e) { const B = window.SBDReportData.compute(P, gi, { src: 'analysis' }), r = window.SBDReportBuild.govRows(B); e = { rows: r.rows, err: r.err, sum: r.sum, bom: r.bom }; S.rows.set(rowKey(P, gi), e); }
        list.push({ gi, j, label: lab, rows: e.rows, err: e.err, sum: e.sum, bom: e.bom });   // sum, bom (2026-11-23): the Executive summary and the bill of materials of the every-girder report
      } catch (er) { list.push({ gi, label: lab, rows: [], err: { all: 'Report error: ' + (er && er.message) } }); }
      if (S.rows.size > 4 * n + 8) S.rows.delete(S.rows.keys().next().value);
      S.prog = `Building the report of every girder: girder ${Math.min(k + 2, n)} of ${n}…`; render(host, ctx);
      setTimeout(() => step(k + 1), 30);
    };
    setTimeout(() => step(0), 30);
  }
  function build(host, ctx) {
    if (S.src === 'file' && !S.pl) { alert('Choose a hand-off file (GirderDetail → ST-Girder demands, .json).'); return; }
    S.busy = true; S.err = ''; render(host, ctx);
    setTimeout(() => {
      try { S.B = window.SBDReportData.compute(ctx.P, ctx.g, { src: S.src, pl: S.pl, plName: S.plName }); if (S.B.err.all) S.err = S.B.err.all;
        else if (S.src === 'analysis' && !S.B.custom && window.SBDReportBuild.govRows) { const r = window.SBDReportBuild.govRows(S.B); S.rows.set(rowKey(ctx.P, ctx.g), { rows: r.rows, err: r.err, sum: r.sum, bom: r.bom }); } }
      catch (e) { S.B = null; S.err = 'Report error: ' + (e && e.message); }
      S.key = keyOf(ctx); S.busy = false; render(host, ctx);
    }, 30);
  }

  window.SBDReportUI = { render, figures, state: S };
})();
