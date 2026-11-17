/* apps/crane-pick/ui/picks.js — the Picks output tab and the Report's §Lifts (window.CranePickPicks). C2-3 (2026-11-16).
   Picks tab: one row per pick (crane setup, chart, boom, radii at the pick, the set and the largest on the swing, capacities, total
   load, % of chart, governing point, class, plan flags) with links to the pick on the map, to its worked steps below the table and to
   its Report subsection; then each pick's flags and worked steps (CLAUDE.md §6). Report §Lifts: the lookup rule and the thresholds, the
   summary table (§ links to each pick), a plan figure of every setup and pick, and per pick: the inputs, the result, the plan flags and
   the worked steps (pick, set, swing path, governing point), with § links to its crane (§Cranes). Values: engine/lift.js through
   CranePickPlace.evalPick (the same numbers as the map and the Lifts tab). */
(function () {
  'use strict';
  const A = window.CranePickApp, G = window.CranePickGeo, K = window.CranePickCranes, LF = window.CranePickLift, esc = A.esc;
  const PL = () => window.CranePickPlace;
  const fmt = (v, d) => (typeof v === 'number' && isFinite(v)) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const COLS = { ok: '#059669', caution: '#D97706', critical: '#EA580C', over: '#DC2626', np: '#DC2626' };
  let el = null, dirty = true;
  const setupOf = id => A.P.setups.find(u => u.id === id) || null;
  const craneOf = u => { const c = u && A.P.cranes.find(x => x.id === u.craneId); return c || null; };
  function rows(P) {
    return P.picks.map(k => { const u = P.setups.find(x => x.id === k.setupId), c = u && P.cranes.find(x => x.id === u.craneId); const ev = u && c ? PL().evalPick(k) : null; return { k, u, c, ev }; });
  }
  const res = ev => ev.cls === 'np' ? 'not permitted' : fmt(ev.gov.pct, 1) + ' %';
  const capOf = e => e.look.ok ? fmt(e.C, 0) : 'n.p.';
  const chartOf = (ev, c) => { const ids = [...new Set([ev.pick, ev.set, ev.gov].map(e => e.cfg && e.cfg.id).filter(Boolean))]; return ids.map(id => { const g = c.def.configs.find(x => x.id === id); return g ? (g.label || g.id) : id; }).join(' / ') || '—'; };
  /* ---------- the tab ---------- */
  function draw() {
    if (!el) return; dirty = false;
    const P = A.P, s = LF.settingsOf(P), R = rows(P);
    const tg = window.CranePickTandemUI ? window.CranePickTandemUI.picksHtml() : '';   // C5: girder lifts, one row per crane
    if (!R.length) { el.innerHTML = '<div class="sec"><div class="secHead">Picks</div><div class="secBody"><p class="note">No pick yet: add a crane to the project (Cranes tab), then "Place on the map" (or the Lifts tab).</p></div></div>' + tg; return; }
    el.innerHTML = `<div class="sec"><div class="secHead">Picks (${R.length})</div><div class="secBody">
      <p class="note">Capacity: the chart value at the next longer tabulated boom length and the next larger tabulated radius (no interpolation${s.interp ? '; linear interpolation between radii where the chart notes permit it is ON' : ''}); outside the chart = not permitted. Thresholds: caution ≥ ${s.caution} %, critical lift ≥ ${s.critical} %, limit ${s.limit} % of chart. Swing: the radius changes uniformly with the swing angle. Clearances: in plan (footprint) and in 3D along the path (boom, load line, load, counterweight; C3-2), with the worked steps per pick.</p>
      <div class="tscroll"><table class="tbl" id="pkTbl"><thead><tr><th>Pick</th><th>Crane setup</th><th>Chart</th><th>Boom (ft)</th><th>R pick (ft)</th><th>R set (ft)</th><th>R max (ft)</th><th>C pick (lb)</th><th>C set (lb)</th><th>W (lb)</th><th>Governing</th><th>% chart</th><th>Status</th><th>Flags</th><th>θ pick / set (°)</th><th>Tip el. pick / set (ft)</th><th>Hook reach min (ft)</th><th>Level (terrain)</th><th>Closest 3D</th><th></th></tr></thead><tbody>
      ${R.map(({ k, u, c, ev }) => ev ? `<tr data-pk="${k.id}"><td><a href="#" data-pkmap="${k.id}">${esc(k.name)}</a></td><td>${esc(u.name)}</td><td>${esc(chartOf(ev, c))}</td><td class="n">${fmt(u.boom, 1)}</td><td class="n">${fmt(ev.pick.R, 2)}</td><td class="n">${fmt(ev.set.R, 2)}</td><td class="n">${fmt(ev.path.Rmax, 2)}</td>
        <td class="n">${capOf(ev.pick)}</td><td class="n">${capOf(ev.set)}</td><td class="n">${fmt(ev.W, 0)}</td><td>${esc(ev.govWhere)}${ev.gov.look.ok ? ` (C ${fmt(ev.gov.C, 0)} lb)` : ''}</td><td class="n">${res(ev)}</td><td><span class="lv lv-${ev.cls}">${esc(LF.CLS[ev.cls])}</span></td>
        <td>${ev.flags.length ? ev.flags.map(f => `<span class="lfDot lf-${f.level}" title="${esc(f.text)}">${f.level === 'stop' ? '■' : f.level === 'warn' ? '▲' : '•'}</span>`).join('') : '—'}</td>
        <td class="n">${elv(ev).th}</td><td class="n">${elv(ev).tip}</td><td class="n">${elv(ev).m}</td><td>${lvlCell(ev)}</td><td>${esc(c3Text(ev))}</td>
        <td><a href="#" data-pkw="${k.id}">worked</a> · <a href="#" data-pkr="${k.id}">Report</a></td></tr>` : `<tr><td>${esc(k.name)}</td><td colspan="19" class="warnT">The setup or its crane is missing.</td></tr>`).join('')}</tbody></table></div></div></div>
      ${R.filter(r => r.ev).map(({ k, u, c, ev }) => `<details class="crSteps pkDet" id="pk-${k.id}"><summary>${esc(k.name)} (${esc(u.name)}): ${res(ev)}, ${esc(LF.CLS[ev.cls])}: worked steps</summary>
        <div class="note">Crane: ${esc(K.name(c.def))}${c.def.preliminary ? ' (PRELIMINARY document)' : ''}; chart: ${esc(chartOf(ev, c))}; rating basis ${esc(ev.pick.cfg ? K.ratingBasis(ev.pick.cfg, c.def).text : '—')}.</div>
        ${ev.flags.length ? `<ul class="lfFlags">${ev.flags.map(f => `<li class="lf-${f.level}">${esc(f.text)}</li>`).join('')}</ul>` : ''}
        ${stepsHtml(ev)}</details>`).join('')}${tg}`;
  }
  function stepsHtml(ev) {
    const sx = window.CranePickSite.steps;
    return `<div class="note"><b>Total load</b></div>${sx(ev.Wsteps)}<div class="note"><b>Pick point</b></div>${sx(ev.pick.steps)}<div class="note"><b>Set point</b></div>${sx(ev.set.steps)}
      <div class="note"><b>Swing path</b></div>${sx(ev.path.steps)}${ev.govWhere.indexOf('swing') >= 0 ? `<div class="note"><b>Governing point (${esc(ev.govWhere)})</b></div>${sx(ev.gov.steps)}` : ''}
      ${ev.elev ? elevGroups(ev).map(([t, l]) => `<div class="note"><b>${esc(t)}</b></div>${sx(l)}`).join('') : ''}
      ${ev.c3 ? ev.c3.results.map(r => `<div class="note"><b>3D clearance: ${esc(r.name)}</b></div>${sx(r.steps)}`).join('') : ''}`;
  }
  /* C8: levelness on the preliminary terrain (ui/terrain.js; worked on the Terrain tab, Report §Terrain) */
  const lvlText = ev => { const l = ev.level; return !l ? '—' : !l.ok ? 'terrain missing' : `${fmt(l.sMax, 2)} % · max block ${fmt(l.bMax * 12, 1)} in`; };
  const lvlCell = ev => { const l = ev.level; if (!l) return '—'; return `<a href="#" data-pklv="${esc(l.ok ? 'ok' : 'x')}" class="lvb lvb-${l.ok ? l.status : 'stop'}" title="preliminary terrain (USGS 3DEP, ~1–3 m): Terrain tab">${esc(lvlText(ev))}</a>`; };
  /* C3-1: heights (engine/elev.js) — the table cells and the worked-step groups (tab and Report) */
  function elv(ev) {
    const h = ev.elev; if (!h) return { th: '—', tip: '—', m: '—' };
    const t = p => p.ang && p.ang.theta != null ? fmt(p.ang.theta, 1) : '—', ms = [h.pick.margin, h.set.margin, h.swing.min].filter(v => v != null);
    const m = ms.length ? Math.min(...ms) : null;
    return { th: `${t(h.pick)} / ${t(h.set)}`, tip: `${fmt(h.pick.zTip, 2)} / ${fmt(h.set.zTip, 2)}`, m: m == null ? '—' : m === -Infinity ? 'not reachable' : fmt(m, 2), mv: m };
  }
  /* C3-2: the governing 3D clearance of a pick (the smallest margin over the requirement: power D − D_min, obstruction D − clearance) */
  function c3Gov(ev) { const rs = (ev.c3 && ev.c3.results || []).filter(r => r.type !== 'excl' && r.known !== false || r.type === 'power'); if (!rs.length) return null;
    const req = r => r.type === 'power' ? (isFinite(r.D) ? r.D : 0) : (r.req || 0); return rs.reduce((a, b) => (b.gov.d - req(b)) < (a.gov.d - req(a)) ? b : a); }
  function c3Text(ev) { const r = c3Gov(ev); if (!r) return '—'; const C = window.CranePickClear.COMP;
    return `${r.name}: ${fmt(r.gov.d, 1)} ft (${C[r.gov.comp]})${r.type === 'power' && isFinite(r.D) ? (r.gov.d < r.D ? ' < ' : ' ≥ ') + 'D_min ' + fmt(r.D, 0) : ''}`; }
  const elevGroups = ev => [['Heights: crane geometry', ev.elev.geoSteps], ['Heights at the pick', ev.elev.pick.steps], ['Heights at the set', ev.elev.set.steps], ['Heights during the swing', ev.elev.trav.steps.concat(ev.elev.swing.steps)]];
  function onClick(e) {
    const lv = e.target.closest('[data-pklv]'); if (lv) { e.preventDefault(); A.showOTab('terrain'); return; }   // C8: the levelness is worked on the Terrain tab
    const m = e.target.closest('[data-pkmap],[data-pkw],[data-pkr]'); if (!m) return; e.preventDefault();
    if (m.dataset.pkmap) { const k = A.P.picks.find(x => x.id === m.dataset.pkmap); if (k) { A.showOTab('plan'); PL().select(k.setupId, k.id); zoom(k); } }
    else if (m.dataset.pkw) { const d = el.querySelector('#pk-' + m.dataset.pkw); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } }
    else if (m.dataset.pkr) gotoReport(m.dataset.pkr);
  }
  function zoom(k) { const u = setupOf(k.setupId); if (!u) return; const r = Math.max(30, G.dist(u, k.pick), G.dist(u, k.set)) * 1.2; window.CranePickMap.fit([{ x: u.x - r, y: u.y - r }, { x: u.x + r, y: u.y + r }]); }
  /* the shared viewer fills its lazy parts as they scroll into view, which can push the target down after the jump: jump again once
     they are filled (C3-1: the longer pick subsections made that visible) */
  function gotoReport(id) { A.showOTab('rpt'); const j = () => { const v = window.CranePickReportUI && window.CranePickReportUI.view; if (v && v.jump) v.jump('pick-' + id); }; setTimeout(j, 60); setTimeout(j, 160); setTimeout(j, 420); }
  /* ---------- Report ---------- */
  /* the lifts in plan (Report figure): setups to scale, tail-swing circles, swing paths, P / S, the site items around them */
  function liftSvg(P) {
    const R = rows(P).filter(r => r.ev); if (!R.length) return '';
    const pts = [], fps = P.setups.filter(u => craneOf(u)).map(u => { const f = LF.footprint(craneOf(u).def, u); pts.push(u); if (isFinite(f.tail)) pts.push({ x: u.x - f.tail, y: u.y - f.tail }, { x: u.x + f.tail, y: u.y + f.tail }); [].concat(f.body ? [f.body] : [], f.tracks, f.floats).forEach(q => pts.push(...q)); return { u, f }; });
    R.forEach(r => pts.push(...r.ev.path.pts));
    let x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x)), y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
    const span = Math.max(x1 - x0, y1 - y0, 40), pad = span * 0.12; x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
    const Wd = 680, Ht = Math.max(260, Math.min(560, Wd * (y1 - y0) / Math.max(1e-9, x1 - x0))), k = Math.min(Wd / (x1 - x0), Ht / (y1 - y0));
    const X = x => ((x - x0) * k).toFixed(1), Y = y => (Ht - (y - y0) * k).toFixed(1), path = (ps, c) => ps.map((p, i) => (i ? 'L' : 'M') + X(p.x) + ' ' + Y(p.y)).join(' ') + (c ? ' Z' : '');
    const inBox = p => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
    const nice = v => { const e = Math.pow(10, Math.floor(Math.log10(v))); return [1, 2, 5, 10].map(m => m * e).filter(m => m <= v).pop() || e; }, sb = nice((x1 - x0) / 4);
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wd} ${Ht.toFixed(0)}" width="${Wd}" height="${Ht.toFixed(0)}" font-family="Arial, sans-serif" font-size="11"><defs><clipPath id="lfClip"><rect width="${Wd}" height="${Ht.toFixed(0)}"/></clipPath></defs><rect width="100%" height="100%" fill="#fff" stroke="#94a3b8"/><g clip-path="url(#lfClip)">`;
    P.items.filter(i => i.pts.some(inBox) || i.type === 'power').forEach(i => {
      if (i.type === 'power') { const c = window.CranePickOSHA.clearance({ kv: i.kv, le350: i.le350, setFt: i.setFt }); if (isFinite(c.ft)) s += `<path d="${G.bufferRings(i.pts, c.ft, 36).map(r => path(r, true)).join(' ')}" fill="#DC2626" fill-opacity="0.12" stroke="none"/>`; s += `<path d="${path(i.pts)}" fill="none" stroke="#DC2626" stroke-width="2"/>`; return; }
      if (i.type === 'obst' || i.type === 'excl') s += `<path d="${path(i.pts, true)}" fill="${i.type === 'obst' ? '#7C3AED' : '#D97706'}" fill-opacity="0.15" stroke="${i.type === 'obst' ? '#7C3AED' : '#D97706'}" stroke-width="1.2"${i.type === 'excl' ? ' stroke-dasharray="6 4"' : ''}/>`;
    });
    fps.forEach(({ u, f }) => {
      if (isFinite(f.tail)) s += `<circle cx="${X(u.x)}" cy="${Y(u.y)}" r="${(f.tail * k).toFixed(1)}" fill="none" stroke="#7C3AED" stroke-dasharray="5 4"/>`;
      [].concat(f.body ? [f.body] : [], f.tracks).forEach(q => { s += `<path d="${path(q, true)}" fill="#64748B" fill-opacity="0.3" stroke="#1E3A5F" stroke-width="1.2"/>`; });
      f.beams.forEach(bm => { s += `<path d="${path(bm)}" stroke="#1E3A5F" stroke-width="2" fill="none"/>`; }); f.floats.forEach(q => { s += `<path d="${path(q, true)}" fill="#F59E0B" stroke="#1E3A5F"/>`; });
      s += `<circle cx="${X(u.x)}" cy="${Y(u.y)}" r="3" fill="#0F172A"/><text x="${X(u.x)}" y="${Y(u.y)}" dx="5" dy="14" fill="#0F172A">${esc(u.name)}</text>`;
    });
    R.forEach(({ k: pk, u, ev }) => {
      s += `<path d="${path([u, pk.pick])}" stroke="#0F172A" stroke-width="1.4" fill="none"/><path d="${path([u, pk.set])}" stroke="#0F172A" stroke-width="1" stroke-dasharray="5 3" fill="none"/>`;
      s += `<path d="${path(ev.path.pts)}" stroke="${COLS[ev.cls]}" stroke-width="2.5" fill="none"/>`;
      [['P', pk.pick, ev.pick, '#2563EB'], ['S', pk.set, ev.set, '#059669']].forEach(([t, q, e, c]) => {
        s += `<circle cx="${X(q.x)}" cy="${Y(q.y)}" r="8" fill="${c}"/><text x="${X(q.x)}" y="${Y(q.y)}" dy="4" text-anchor="middle" fill="#fff" font-weight="bold">${t}</text>`;
        s += `<text x="${X(q.x)}" y="${Y(q.y)}" dx="11" dy="-4" fill="#0F172A">${esc(pk.name)} ${t}: R ${fmt(e.R, 1)} ft, ${e.look.ok ? fmt(e.pct, 1) + ' %' : 'n.p.'}</text>`; });
    });
    s += `</g><g transform="translate(${Wd - 30},34)"><path d="M0 -22 L7 4 L0 -2 L-7 4 Z" fill="#0f172a"/><text y="18" text-anchor="middle" font-weight="bold">N</text><text y="30" text-anchor="middle" font-size="9">(grid)</text></g>`;
    s += `<g transform="translate(14,${(Ht - 14).toFixed(0)})"><rect width="${(sb * k).toFixed(1)}" height="5" fill="#0f172a"/><text y="-4">${fmt(sb, 0)} ft</text></g></svg>`;
    return s;
  }
  window.CranePickReport && window.CranePickReport.add(P => {
    const R = rows(P); if (!R.length) return [];
    const s = LF.settingsOf(P), z = G.zone(P.site.zone), un = z.unit === 'm' ? 'm' : 'ft', E = v => fmt(G.ftToNative(z.id, v), 2);
    const subs = [
      { id: 'rule', key: 'lift-rule', title: 'Basis', items: [
        { type: 'kv', rows: [['Chart capacity', 'the chart value at the next longer tabulated boom length and the next larger tabulated radius; no interpolation' + (s.interp ? ' (linear interpolation between radii where the chart notes permit it: ON)' : '')],
          ['Outside the chart', 'not permitted (radius below the smallest or beyond the largest tabulated radius, boom longer than the longest, blank cell)'],
          ['Total load W', 'load + rigging + hook block + other deductions (chart capacities are gross)'], ['Percent of chart', 'W / C × 100'],
          ['Caution', `≥ ${s.caution} % of chart`], ['Critical lift', `≥ ${s.critical} % of chart`], ['Limit', `${s.limit} % of chart`]] },
        { type: 'note', text: 'Swing path: about the centre of rotation from the pick to the set in the chosen direction, the radius changing uniformly with the swing angle; checked every degree and at each zone boundary; the governing point has the highest % of chart. Zones: from the slew angle relative to the carrier heading and the sectors entered for the crane ([[cranes]]). Footprint clearances are checked in plan (the carrier / tracks / floats on the ground).' },
        { type: 'note', text: `3D clearances (C3-2): along the path (${s.path === 'luff' ? 'luff at the pick, then swing at the set radius' : 'the radius changing uniformly with the swing angle'}; hoisting at the pick and lowering at the set included), the boom (foot pin to tip, a cylinder of half the boom section width), the load line (load top to tip), the load (a vertical cylinder of radius √(L² + W²)/2 from its bottom to its top) and the counterweight (the tail-swing cylinder between its bottom and top) against: power lines (each span a prism: the span ± sway in plan, from the lowest wire less the sag to the lowest wire; not entered: a vertical plane), D ≥ D_min of 29 CFR 1926.1408 Table A; obstructions (prism up to the top), contact red, closer than ${fmt(s.obstClr, 2)} ft amber; exclusion zones in plan. Every degree, refined to the closest point.` },
        { type: 'note', text: 'Heights (C3-1): boom angle θ = acos((R − e)/L) from the geometry, or the chart\'s printed (loaded) boom angle where the config prints one (it governs; both shown when they differ); tip pin z_tip = z_pad + h_f + L sin θ, plumb above the hook; load bottom z_lb = z_g + h_b; hook z_hk = z_lb + H + h_r; block top z_bk = z_hk + h_bk; hook reach margin m = z_tip − H_hd − z_bk ≥ 0 at the pick, the set and along the swing at the travel height. Crane geometry not in the file and not entered is assumed (listed in [[cranes]]): the lowest boom.' }] },
      { id: 'sum', key: 'lift-summary', title: 'Summary of picks', items: [
        { type: 'table', head: ['Pick', 'Crane setup', 'Boom (ft)', 'R pick (ft)', 'R set (ft)', 'R max (ft)', 'W (lb)', 'C governing (lb)', '% chart', 'Status', 'Governing', 'Flags', 'Hook reach min (ft)', 'Level / blocking (terrain)'], wide: true,
          rows: R.filter(r => r.ev).map(({ k, u, ev }) => ({ cells: [{ t: k.name, key: 'pick-' + k.id }, u.name, { t: fmt(u.boom, 1), n: true }, { t: fmt(ev.pick.R, 2), n: true }, { t: fmt(ev.set.R, 2), n: true }, { t: fmt(ev.path.Rmax, 2), n: true }, { t: fmt(ev.W, 0), n: true },
            { t: ev.gov.look.ok ? fmt(ev.gov.C, 0) : 'n.p.', n: true }, { t: res(ev), n: true, cls: ev.cls === 'ok' ? 'ok' : ev.cls === 'caution' ? 'hi' : 'ng' }, LF.CLS[ev.cls], ev.govWhere, String(ev.flags.length || '—'), { t: elv(ev).m, n: true, cls: elv(ev).mv != null && elv(ev).mv < 0 ? 'ng' : '' }, { t: lvlText(ev), key: ev.level && ev.level.ok ? 'trs-' + u.id : undefined, cls: ev.level && ev.level.ok ? (ev.level.status === 'ok' ? 'ok' : ev.level.status === 'warn' ? 'hi' : 'ng') : '' }] })) },
        { type: 'figure', svg: liftSvg(P), caption: 'Crane setups and picks in plan (State Plane grid, north up): footprint to scale, tail-swing circle (dashed), boom lines to the pick (solid) and the set (dashed), swing path coloured by status, power-line D_min buffers.' }] }];
    R.filter(r => r.ev).forEach(({ k, u, c, ev }) => {
      const items = [{ type: 'kv', rows: [['Crane', K.name(c.def) + (c.def.preliminary ? ' (PRELIMINARY document)' : ''), 'crane-' + c.id], ['Setup', u.name], ['Chart', chartOf(ev, c)], ['Rating basis', ev.pick.cfg ? K.ratingBasis(ev.pick.cfg, c.def).text : '—'],
        ['Boom length (ft)', fmt(u.boom, 1)], ['Carrier heading (az.)', fmt(u.heading, 1) + '°'], [`Rotation centre E / N (${un})`, `${E(u.x)} / ${E(u.y)}`], [`Pick E / N (${un})`, `${E(k.pick.x)} / ${E(k.pick.y)}`], [`Set E / N (${un})`, `${E(k.set.x)} / ${E(k.set.y)}`],
        ['Load / rigging / hook / other (lb)', `${fmt(k.load || 0, 0)} / ${fmt(k.rigging || 0, 0)} / ${fmt(k.hook || 0, 0)}${k.hookLabel ? ' (' + k.hookLabel + ')' : ''} / ${fmt(k.ded || 0, 0)}${k.dedNote ? ' (' + k.dedNote + ')' : ''}`],
        ['Swing', `${fmt(Math.abs(ev.path.d), 1)}° ${ev.path.d >= 0 ? 'clockwise' : 'counter-clockwise'} (${k.swing === 'short' ? 'shortest' : 'chosen'})`],
        ['Result', `${res(ev)} of chart, ${LF.CLS[ev.cls]}, governing ${ev.govWhere}`]] }];
      if (ev.flags.length) items.push({ type: 'note', warn: ev.flags.some(f => f.level !== 'info'), text: 'Plan flags: ' + ev.flags.map(f => f.text).join(' ') });
      const notes = [].concat(ev.pick.look.notes, ev.set.look.notes, ev.gov.look.notes, [ev.pick, ev.set, ev.gov].filter(e => !e.look.ok).map(e => 'Not permitted: ' + e.look.why + '.')).filter((x, i, a) => x && a.indexOf(x) === i);
      if (notes.length) items.push({ type: 'note', warn: ev.cls === 'np', text: notes.join(' ') });
      const sc = 'pk-' + k.id;
      items.push({ type: 'steps', scope: sc, title: 'Total load', steps: ev.Wsteps }, { type: 'steps', scope: sc, title: 'Pick point', steps: ev.pick.steps }, { type: 'steps', scope: sc, title: 'Set point', steps: ev.set.steps },
        { type: 'steps', scope: sc, title: 'Swing path', steps: ev.path.steps });
      if (ev.govWhere.indexOf('swing') >= 0) items.push({ type: 'steps', scope: sc, title: `Governing point (${ev.govWhere})`, steps: ev.gov.steps });
      if (ev.elev) {   // C3-1: heights
        const h = ev.elev, E = window.CranePickElev.el0(k);
        items.push({ type: 'kv', rows: [['Crane pad elevation (ft)', u.pad == null ? '0.00 (not entered: the datum)' : fmt(u.pad, 2)], ['Ground el. pick / set (ft)', `${fmt(h.pick.zg, 2)} / ${fmt(h.set.zg, 2)}`], ['Load bottom above ground pick / set (ft)', `${fmt(h.pick.hb, 2)} / ${fmt(h.set.hb, 2)}`],
          ['Load L × W × H (ft)', `${fmt(E.L || 0, 2)} × ${fmt(E.W || 0, 2)} × ${fmt(E.H || 0, 2)}`], ['Rigging height / hook block height (ft)', `${fmt(h.pick.hr, 2)} / ${fmt(h.pick.hbk, 2)}`], ['Travel (load bottom during the swing, ft)', fmt(h.trav.z, 2) + (h.trav.entered ? '' : ' (higher of the pick and the set)')],
          ['Boom angle pick / set (°)', elv(ev).th], ['Tip el. pick / set (ft)', elv(ev).tip], ['Hook reach margin, lowest (ft)', elv(ev).m]] });
        elevGroups(ev).forEach(([t, l]) => items.push({ type: 'steps', scope: sc, title: t, steps: l }));
      }
      if (ev.c3 && ev.c3.results.length) {   // C3-2: 3D clearances
        const C = window.CranePickClear.COMP;
        items.push({ type: 'table', head: ['Item', 'Required (ft)', 'Closest (ft)', 'Component', 'Where', 'Boom / line / load / cwt (ft)', 'Result'], wide: true,
          rows: ev.c3.results.map(r => [r.name, r.type === 'power' ? (isFinite(r.D) ? fmt(r.D, 0) + ' (D_min)' : 'not set') : r.type === 'obst' ? fmt(r.req, 2) : 'outside (plan)', { t: fmt(r.gov.d, 2), n: true, cls: r.level === 'stop' ? 'ng' : r.level === 'warn' ? 'hi' : 'ok' }, C[r.gov.comp], r.where,
            ['boom', 'line', 'load', 'cw'].map(x => { const q = r.comps.find(y => y.comp === x); return q ? fmt(q.d, 1) : '—'; }).join(' / '), r.level === 'stop' ? 'NOT OK' : r.level === 'warn' ? 'check' : 'OK'] ) });
        ev.c3.results.forEach(r => items.push({ type: 'steps', scope: sc, title: '3D clearance: ' + r.name, steps: r.steps }));
      }
      subs.push({ id: 'p-' + k.id, key: 'pick-' + k.id, title: k.name, ref: res(ev), items });
    });
    return [{ id: 'lifts', key: 'lifts', title: 'Lifts', subs }];
  });
  /* ---------- wiring ---------- */
  function build(p) { el = p; p.addEventListener('click', onClick); }
  A.outTab({ id: 'picks', label: 'Picks', before: 'site', build, show: () => { if (dirty) draw(); } });
  const mark = () => { dirty = true; if (A.ui.otab === 'picks') draw(); };
  A.on('project', mark); A.on('change', o => { if (o.kind !== 'select' && o.kind !== 'select-lift') mark(); });
  window.CranePickPicks = { redraw: mark, liftSvg, gotoReport, rows };
})();
