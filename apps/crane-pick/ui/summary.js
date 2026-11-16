/* apps/crane-pick/ui/summary.js — the Summary output tab: every lift of the project in one table (window.CranePickSummaryUI). C7 (2026-11-16).
   One row per crane of each lift (single picks, girder lifts one crane or tandem): the governing % of chart, status, where it governs, the
   closest 3D clearance, the largest float / track load and bearing ratio, the flags; then the trucking routes (C6): the worst flag, gross
   weight, largest off-tracking, least overhead clearance, the lift each delivers to. Links: the lift on the map, where it is worked (Picks /
   Girder lifts / Route tab), its Report § and its drawing sheet (CLAUDE.md §6). Values: ui/drawset.js summary (the engine values through
   the page's evaluations), the same rows as the cover sheet and Report §1. */
(function () {
  'use strict';
  const A = window.CranePickApp, esc = A.esc;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const fmt = (v, d) => isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  let el = null, dirty = true;
  const ctx = () => ({ evalPick: k => (window.CranePickPlace ? window.CranePickPlace.evalPick(k) : null), evalT: t => (window.CranePickTandemUI ? window.CranePickTandemUI.evalT(t) : null),
    evalRoute: r => (window.CranePickRouteUI ? window.CranePickRouteUI.evalRoute(r) : null) });
  function gotoReport(key) { A.showOTab('rpt'); const j = () => { const v = window.CranePickReportUI && window.CranePickReportUI.view; if (v && v.jump) v.jump(key); }; setTimeout(j, 60); setTimeout(j, 160); setTimeout(j, 420); }
  const sheetId = r => r.kind === 'pick' ? 'lift-' + r.id : r.kind === 'tandem' ? 'tlift-' + r.id : 'route-' + r.i;
  function links(r) {
    return `<a href="#" data-sm="map" data-k="${r.kind}" data-id="${esc(r.id)}">map</a> · <a href="#" data-sm="work" data-k="${r.kind}" data-id="${esc(r.id)}">worked</a> · <a href="#" data-sm="rpt" data-key="${esc(r.key)}">Report</a> · <a href="#" data-sm="dwg" data-sheet="${esc(sheetId(r))}">drawing</a>`;
  }
  function draw() {
    if (!el || !window.CranePickDrawSet) return; dirty = false;
    const DS = window.CranePickDrawSet; let S; try { S = DS.summary(A.P, ctx()); } catch (e) { console.error(e); el.innerHTML = `<div class="sec"><div class="secBody"><p class="warnT">${esc(e.message)}</p></div></div>`; return; }
    const L = S.filter(r => r.kind !== 'route'), R = S.filter(r => r.kind === 'route'), s = window.CranePickLift.settingsOf(A.P), tl = (A.P.lift && A.P.lift.tandem) || 75;
    if (!S.length) { el.innerHTML = '<div class="sec"><div class="secHead">Summary</div><div class="secBody"><p class="note">No lift yet: place a crane (Cranes or Lifts tab) or add a girder lift (Girder lifts tab).</p></div></div>'; return; }
    const rows = []; L.forEach(r => {
      if (r.missing) { rows.push(`<tr data-lift="${esc(r.id)}"><td>${esc(r.name)}</td><td colspan="8" class="warnT">${esc(r.missing)}</td><td>${links(r)}</td></tr>`); return; }
      r.cranes.forEach((c, i) => rows.push(`<tr data-lift="${esc(r.id)}"><td>${i ? '' : esc(r.name)}</td><td>${r.kind === 'pick' ? 'single pick' : r.single ? 'girder lift, one crane' : 'tandem, crane ' + (i + 1)}: ${esc(c.setup)}</td>
        <td class="n">${c.pct == null ? 'n.p.' : fmt(c.pct, 1) + ' %'}</td><td><span class="lv lv-${c.cls}">${esc(c.clsText)}</span></td><td>${esc(c.where)}</td>
        <td>${i ? '' : esc(DS.clrText(r.clr, r.single))}</td><td class="n">${i ? '' : esc(DS.grText(r.ground))}</td><td class="n${r.ground && r.ground.ratio > 1 ? ' ng' : ''}">${i ? '' : r.ground && r.ground.ratio != null ? fmt(r.ground.ratio, 2) : '—'}</td>
        <td>${i ? '' : r.flags.stop || r.flags.warn ? `<span class="lfDot lf-stop">${r.flags.stop} ■</span> <span class="lfDot lf-warn">${r.flags.warn} ▲</span>` : 'none'}</td><td>${i ? '' : links(r)}</td></tr>`)); });
    const rrows = R.map(r => `<tr data-route="${esc(r.id)}"><td>${esc(r.name)}</td><td>${r.to ? esc(r.to.name) : '—'}</td>${r.missing ? `<td colspan="5" class="warnT">${esc(r.missing)}</td>` : `<td>${r.worst === 'ok' ? 'none' : `<span class="lfDot lf-${r.worst}">${esc(r.worst)}</span>`}</td>
      <td class="n">${fmt(r.gross, 0)}</td><td class="n">${fmt(r.otMax, 2)}</td><td>${r.oh ? esc(r.oh.text) : '—'}</td><td>${r.flags.stop} stop, ${r.flags.warn} check</td>`}<td>${links(r)}</td></tr>`).join('');
    el.innerHTML = `<div class="sec"><div class="secHead">Summary of every lift (${L.length})</div><div class="secBody">
      <p class="note">Governing % of chart per crane: single picks against the lift thresholds (caution ≥ ${s.caution} %, critical ≥ ${s.critical} %, limit ${s.limit} %), tandem lifts against the tandem limit ${fmt(tl, 0)} % per crane. Closest clearance: the smallest margin over its requirement (power lines D − D_min, obstructions D − ${fmt(s.obstClr, 2)} ft). Ground: the largest float / track load and bearing ratio of the lift. Every value is worked where the "worked" and "Report" links go. <b>Lift-planning aid.</b></p>
      <div class="tscroll"><table class="tbl" id="smTbl"><thead><tr><th>Lift</th><th>Type: crane setup</th><th>% chart</th><th>Status</th><th>Governing</th><th>Closest clearance</th><th>Max float / track load</th><th>Bearing ratio</th><th>Flags</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table></div></div></div>
      ${R.length ? `<div class="sec"><div class="secHead">Trucking routes (${R.length})</div><div class="secBody"><div class="tscroll"><table class="tbl" id="smRoutes"><thead><tr><th>Route</th><th>Delivers to</th><th>Worst flag</th><th>Gross (lb)</th><th>Max off-tracking (ft)</th><th>Least overhead clearance</th><th>Flags</th><th></th></tr></thead><tbody>${rrows}</tbody></table></div></div></div>` : ''}`;
  }
  function onClick(e) {
    const a = e.target.closest('[data-sm]'); if (!a) return; e.preventDefault(); const k = a.dataset.k, id = a.dataset.id, P = A.P;
    if (a.dataset.sm === 'rpt') return gotoReport(a.dataset.key);
    if (a.dataset.sm === 'dwg') return window.CranePickDrawingsUI && window.CranePickDrawingsUI.show(a.dataset.sheet);
    if (k === 'pick') { const pk = P.picks.find(x => x.id === id); if (!pk) return;
      if (a.dataset.sm === 'map') { A.showOTab('plan'); if (window.CranePickPlace) window.CranePickPlace.select(pk.setupId, pk.id); }
      else { A.showOTab('picks'); setTimeout(() => { const d = document.getElementById('pk-' + id); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } }, 30); } return; }
    if (k === 'tandem') { A.showITab('tandem'); if (a.dataset.sm === 'map') A.showOTab('plan'); if (window.CranePickTandemUI) window.CranePickTandemUI.select(id); return; }
    if (k === 'route') { A.showITab('route'); if (a.dataset.sm === 'map') { A.showOTab('plan'); if (window.CranePickRouteUI) window.CranePickRouteUI.select(id); } else A.showOTab('route'); }
  }
  A.outTab({ id: 'summary', label: 'Summary', before: 'picks', build: p => { el = p; p.addEventListener('click', onClick); }, show: () => { if (dirty) draw(); } });
  const mark = () => { dirty = true; if (A.ui.otab === 'summary') draw(); };
  A.on('project', mark); A.on('change', o => { if (o.kind !== 'select' && o.kind !== 'select-lift') mark(); });
  window.CranePickSummaryUI = { redraw: mark };
})();
