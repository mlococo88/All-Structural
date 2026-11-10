/* apps/steel-bridge/ui/alonggfx.js — window.SBDAlongGfx: the screen graphics drawn along the girder in the data-viz style (option C; engineer's
   decision 2026-11-10: restyle every on-screen CAD-style graphic; family (b)). Classic script, display only: every number is one the tab already
   has (the result the tab passes in), shown with the digits of the old drawing or of the tab's table; nothing is computed here. Each graphic's
   Download DXF still exports its old SharedDxf drawing (the builder the caller passes in, unchanged): the same file, byte for byte.
   Needs ui/vizalong.js (SBDVizAlong), ui/vizkit.js (SBDVizKit), ui/graphics.js (SBDGraphics: mergeBands, download), engine/drawings.js (SBDDrawings.model:
   supports, field splices and cross-frames, as SBDGraphics.elevation), shared/dxf.js (frac), shared/units.js (fmt).

   API (slot = the element to draw into; o = what the tab passes to the old graphic; A = the old drawing's builder and the tab's selection)
     analysis(slot, o, A)     Analysis: elevation, moments and dead-load deflection. A = { build (the DXF drawing), getSel(), setSel(k) }
     flexure(slot, o, A)      Flexure: elevation coloured by the governing ratio. A = { build }
     flexChecks(slot, o, A)   Flexure: the stress checks (demand vs capacity, ksi) and the ratios of every check of the location. A = { build }
     constr(slot, o, A)       Constructibility: pours, ratio bands, M_DCc vs M_DC1, the pour table. A = { build }
     shear(slot, o), fatigue(slot, o), fatigueChart(slot, o), welds(slot, o), rating(slot, o)   the graphics of engine/tabgraphics-b.js (Shear & stiffeners, Fatigue & studs,
                              Welds, Rating): o = { P, gi, R (the tab's build() result), sel (its selection), onSel(value), build() (the old drawing: Download DXF), file }
     summarySpec(M, P, gi), summarySvg(M, P, gi, W)   the Report / Summary tab figure (governing check of each group along the girder) as a static SVG
     geo(P, gi)               the girder of the elevations: plates, supports, splices, cross-frames, deck (as SBDGraphics.elevation)
   Series switched off (chips) and nothing else are kept for the page session (S.hide); no storage.
   Fix log: fixlog/steel-bridge.md (SBVZB, 2026-11-10). */
(function () {
  'use strict';
  const VA = () => window.SBDVizAlong, GR = () => window.SBDGraphics, U = () => window.SharedUnits;
  const fin = v => typeof v === 'number' && isFinite(v);
  const nf = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 2 : d) : '—');
  const nz = (v, d) => nf(v, d).replace(/^-(0(\.0+)?)$/, '$1');   // as ui/gfxa.js: never −0.0
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = { hide: {} };
  const nearest = (xs, ft) => { let b = 0; xs.forEach((x, i) => { if (Math.abs(x - ft) < Math.abs(xs[b] - ft)) b = i; }); return b; };   // as ui/gfxa.js
  /* the ratio class of SBDGraphics.ratioColor (green < 0.9, amber 0.9 to 1.0 (1.0 passes), red > 1.0, not finite or NG) */
  const clsG = (r, ok) => (ok === false || !fin(r) || r > 1 + 1e-9 ? 'ng' : r >= 0.9 ? 'hi' : 'ok');

  /* the girder of SBDGraphics.elevation: plates of P.girders[gi], supports, field splices and the girder's cross-frames from SBDDrawings.model(P) */
  function geo(P, gi) {
    const G = window.SBDDrawings.model(P); if (G.errors && G.errors.length) return { errors: G.errors.slice() };
    const pg = P.girders[gi] || P.girders[0], segs = (pg.segments || []).filter(s => fin(+s.x0) && fin(+s.x1) && +s.x1 > +s.x0)
      .map(s => ({ x0: +s.x0, x1: +s.x1, D: +s.D, tw: +s.tw, topB: +s.topB, topT: +s.topT, botB: +s.botB, botT: +s.botT })).sort((a, b) => a.x0 - b.x0);
    if (!segs.length) return { errors: ['The girder has no plate segment.'] };
    const xi = Math.max(0, G.girders.findIndex(q => q.pg === gi)), cf = [...(G.girders[xi] ? G.girders[xi].ints : [])].sort((a, b) => a - b);
    return { errors: [], segs, L0: Math.min(...segs.map(s => s.x0)), L1: Math.max(...segs.map(s => s.x1)), sup: G.sup.slice(), spl: (G.splices || []).slice(), cf, deck: G.deck && G.deck.ts > 0 ? { ts: +G.deck.ts } : null };
  }
  /* the plates at x, as the old elevation's labels (SharedDxf.frac sizes) */
  function plates(g, x) {
    const s = g.segs.find(q => x >= q.x0 - 1e-9 && x <= q.x1 + 1e-9) || g.segs[g.segs.length - 1], F = window.SharedDxf.frac;
    return `web ${F(s.D)} × ${F(s.tw)}, flanges ${F(s.topB)} × ${F(s.topT)} top, ${F(s.botB)} × ${F(s.botT)} bottom`;
  }
  /* the plate segments in words (screen and print: the old elevation's plate labels; the read-out has the plates at the pointer) */
  function platesCap(g) {
    const F = window.SharedDxf.frac;
    return `<p class="vk-cap">Plate segments (x, ft): ${g.segs.map(s => `${nf(s.x0, 2)} to ${nf(s.x1, 2)}: web ${F(s.D)} × ${F(s.tw)}, top flange ${F(s.topB)} × ${F(s.topT)}, bottom flange ${F(s.botB)} × ${F(s.botT)}`).join('; ')}.</p>`;
  }
  const fail = (slot, msg) => { slot.innerHTML = `<div class="note">${esc(msg)}</div>`; return null; };
  /* chips: one group per chart; html with a line sample of the series */
  const chipGroup = (key, label, list) => ({ label, items: list.map(q => ({ key: key + ':' + q.key, html: `${VA().swatch(q.ci, q.dash)} ${q.html}`, on: !(S.hide[key] || {})[q.key] })) });
  const onChip = k => { const [g, s] = k.split(':'), h = S.hide[g] = S.hide[g] || {}; h[s] = !h[s]; };
  const prLegend = list => `<p class="vk-cap vk-pr">${list.map(q => `${VA().swatch(q.ci, q.dash)} ${q.html}`).join(' &nbsp; ')}</p>`;
  const NOTE_EL = 'The elevation is not to scale vertically (web depth exaggerated; flanges and deck drawn at a legible thickness): S = support, FS = field splice, dashed lines in the web = cross-frames; the plate sizes are in the read-out.';

  /* ================= Analysis ================= */
  function analysis(slot, o, A) {
    const R = o.R, P = o.P, g = geo(P, o.gi); if (g.errors.length) return fail(slot, g.errors.join(' '));
    const s = R.st, ll = R.ll, n = R.x.length, sel = () => Math.min(A.getSel(), n - 1);
    const MS = [{ key: 'dc1', html: 'M<sub>DC1</sub>', ci: 0, a: s.DC1.M }, { key: 'dc2', html: 'M<sub>DC2</sub>', ci: 2, a: s.DC2.M }, { key: 'dw', html: 'M<sub>DW</sub>', ci: 3, a: s.DW.M },
      ...(ll ? [{ key: 'llp', html: 'M<sub>LL+IM</sub> max', ci: 1, a: ll.Mpos }, { key: 'lln', html: 'M<sub>LL+IM</sub> min', ci: 1, dash: '5 3', a: ll.Mneg }] : [])];
    const CS = [{ key: 'tot', html: 'total (camber)', ci: 0, a: R.camber.total }, { key: 'stl', html: 'steel + CF', ci: 1, a: R.camber.steel }, { key: 'wet', html: 'wet deck', ci: 3, a: R.camber.wet }, { key: 'sd', html: 'DC2 + DW', ci: 2, a: R.camber.sd }];
    const ser = (L, sign) => L.map(q => ({ key: q.key, ci: q.ci, dash: q.dash, pts: R.x.map((x, i) => [x, sign * q.a[i]]) }));
    // the read-out: the old one (x, the three dead-load moments, LL+IM min / max, camber), on two lines
    const at = x => { const k = nearest(R.x, x); return [`x = ${nf(R.x[k], 2)} ft · camber ${nz(R.camber.total[k], 3)} in · ${plates(g, R.x[k])}`,
      `M_DC1 ${nz(s.DC1.M[k], 1)}, M_DC2 ${nz(s.DC2.M[k], 1)}, M_DW ${nz(s.DW.M[k], 1)}${ll ? `, M_LL+IM ${nz(ll.Mneg[k], 0)} / ${nz(ll.Mpos[k], 0)}` : ''} kip-ft`]; };
    const opts = R.x.map((x, i) => `<option value="${i}"${i === sel() ? ' selected' : ''}>x = ${nf(x, 2)} ft</option>`).join('');
    const gl = P.girders[o.gi] || {};
    let H = null;
    const re = () => { const sl = slot.querySelector('#gfx_an_c'); if (sl) sl.value = String(sel()); if (H) H.redraw(); };
    H = VA().mount(slot, { key: 'an', title: 'Girder elevation, moments and deflection', sub: `Girder ${esc(gl.label || gl.id || '')} · diagrams on the stations of the elevation`,
      controls: `<div class="fRow" style="margin:0 0 4px"><label for="gfx_an_c" style="min-width:0">Station</label><select id="gfx_an_c" style="width:auto">${opts}</select></div>`,
      draw: W => VA().render({ L0: g.L0, L1: g.L1, sup: R.sup || g.sup, sel: R.x[sel()], selLabel: `x = ${nf(R.x[sel()], 2)} ft`, aria: 'Girder elevation with the moment and deflection diagrams', rows: [
        { kind: 'elev', geo: g },
        { kind: 'chart', key: 'M', label: 'Moments, kip-ft (unfactored, per girder)', unit: 'kip-ft', series: ser(MS, 1), hidden: S.hide.anM },
        { kind: 'chart', key: 'C', label: 'Dead-load deflection, in (downward drawn down; camber = total, upward)', unit: 'in', series: ser(CS, -1), hidden: S.hide.anC, h: W < 600 ? 110 : 140 }] }, W),
      at, pickX: x => nearest(R.x, x), snap: x => R.x[nearest(R.x, x)], onSelect: k => { A.setSel(k); re(); },
      chips: () => [chipGroup('anM', 'Moments', MS), chipGroup('anC', 'Deflection', CS)], onChip,
      hint: 'Point at (or tap) the graphic to read the station; click or tap to select it.',
      caption: prLegend(MS) + prLegend(CS) + `<p class="vk-cap">Stations, moments and deflections are the Analysis tab's results (the station table below); click (or tap) a location to select it. Deflection is drawn downward (the camber values with their sign changed); the camber is the total, upward.</p>`,
      notes: platesCap(g) + `<p class="vk-note">${NOTE_EL}</p>`, dxf: A.build, file: 'analysis-elevation' });
    const sl = slot.querySelector('#gfx_an_c'); if (sl) sl.addEventListener('change', () => { A.setSel(+sl.value); re(); });
    return H;
  }

  /* ================= Flexure ================= */
  /* the bands of the old ratio layer: SBDGraphics.mergeBands of the governing ratio of each location (the same items), coloured as SBDGraphics.ratioColor */
  function bandsOf(items, g) {
    return GR().mergeBands(items, { x0: g.L0, x1: g.L1 }).map(b => { const pv = b.ok === false || !fin(b.ratio) ? 'NG' : nf(b.ratio, 2); return { x: b.x, x0: b.x0, x1: b.x1, cls: clsG(b.ratio, b.ok), text: pv, label: b.label }; });
  }
  function flexure(slot, o, A) {
    const R = o.R, P = o.P, g = geo(P, o.gi); if (g.errors.length) return fail(slot, g.errors.join(' '));
    const rows = R.rows, xr = rows.map(r => (fin(r.x) ? r.x : NaN)), sel = Math.min(o.sel || 0, rows.length - 1);
    const items = rows.map((q, i) => ({ x: fin(q.x) ? Math.max(g.L0, Math.min(g.L1, q.x)) : g.L0, ratio: q.gov ? q.gov.ratio : NaN, ok: q.gov ? !(q.gov.ng && !fin(q.gov.ratio)) : false, label: `Governs (row ${i + 1})` }));
    const bands = bandsOf(items, g), top = bands.find(b => b.label);
    const rd = k => [rows[k].name, rows[k].gov ? `${rows[k].gov.id} ratio ${fin(rows[k].gov.ratio) ? nf(rows[k].gov.ratio, 3) : 'NG'}` : 'no check'];
    const xs = xr.map(v => (fin(v) ? v : 1e9));
    return VA().mount(slot, { key: 'fx', title: 'Girder elevation coloured by governing ratio', sub: 'Governing check of each location of the results table',
      draw: W => VA().render({ L0: g.L0, L1: g.L1, sup: g.sup, sel: fin(xr[sel]) ? xr[sel] : null, selLabel: rows[sel].name, aria: 'Girder elevation coloured by the governing flexure ratio', rows: [
        { kind: 'elev', geo: g, fill: bands },
        { kind: 'band', label: 'Flexure: governing ratio (neighbours of one colour class merged; the band shows its largest)', items: bands, flag: top ? { x: top.x, text: `${top.label}: ${top.text}`, cls: 'gov' } : null }] }, W),
      at: x => { const k = nearest(xs, x), [a, b] = rd(k); return [`${a} · ${plates(g, fin(xr[k]) ? xr[k] : x)}`, b]; },
      pickX: x => nearest(xs, x), snap: x => { const k = nearest(xs, x); return fin(xr[k]) ? xr[k] : x; }, onSelect: k => o.onSelect && o.onSelect(k),
      legend: VA().legend('ratio'), hint: 'Point at (or tap) a band to read its location; click or tap to select it.',
      caption: `<p class="vk-cap">One band per location of the results table (the stretch to the mid-points of its neighbours); neighbouring bands of one colour class are merged and show their largest ratio; the flag marks the largest of all. Numbers are the table rows. Green below 0.90, amber 0.90 to 1.00, red above 1.00 or NG (the classes of the table).</p>`,
      notes: platesCap(g) + `<p class="vk-note">${NOTE_EL}</p>`, dxf: A.build, file: 'flexure-elevation' });
  }
  /* the stress checks of the selected location: the flange checks in ksi (demand vs capacity) and the ratio of every check, 1.0 marked */
  function flexChecks(slot, o, A) {
    const R = o.R, rows = R.rows, r = rows[Math.min(o.sel || 0, rows.length - 1)], Uf = (v, d) => (U() ? U().fmt(v, d) : nf(v, d));
    const flangeCk = (r.checks || []).filter(q => q.unit === 'ksi' && fin(q.demand) && fin(q.capacity) && q.inUse !== false), rt = (r.checks || []).filter(q => fin(q.ratio));
    const lab = q => [`${q.id}${q.key ? ' (' + q.key + ')' : ''}`, `${fin(q.demand) ? `demand ${Uf(q.demand, 2)} ${q.unit || ''}, capacity ${Uf(q.capacity, 2)} ${q.unit || ''}, ` : ''}ratio ${fin(q.ratio) ? Uf(q.ratio, 3) : '—'}`];
    return VA().mount(slot, { key: 'fxb', title: `Stress checks at ${esc(r.name)}`, sub: 'Demand and capacity of the checks in ksi; the ratio of every check, 1.0 marked',
      draw: W => VA().hbars({ aria: `Stress checks at ${r.name}`, panels: [
        { label: 'Demand vs capacity, ksi', unit: 'ksi', fx: v => nf(v, 0), items: flangeCk.map(q => ({ id: q.id, key: q.key, lab: lab(q), bars: [{ v: q.demand, ci: 0, text: nf(q.demand, 0) }, { v: q.capacity, ci: 1, text: nf(q.capacity, 0) }] })) },
        { label: 'Check ratios (all checks of the location)', fx: v => nf(v, 1), limit: { v: 1, label: 'ratio = 1.0' }, items: rt.map(q => ({ id: q.id, key: q.key, lab: lab(q), bars: [{ v: q.ratio, cls: clsG(q.ratio, true), text: nf(q.ratio, 2) }] })) }] }, W),
      legend: `<span>${barSw(0)}demand</span><span>${barSw(1)}capacity</span><span><i class="va-sw c-ok"></i><i class="va-sw c-hi"></i><i class="va-sw c-ng"></i>ratio below 0.90 / 0.90 to 1.00 / above 1.00</span>`,
      hint: 'Point at (or tap) a check to read its demand, capacity and ratio.',
      caption: `<p class="vk-cap">Demand and capacity of the checks of the location table in ksi (for example f<sub>bu</sub> + f<sub>ℓ</sub>/3 against φ<sub>f</sub>F<sub>nc</sub>), rounded to whole ksi on the bars; the ratio of every check of the location, to 2 decimals (3 in the table and the read-out). Bars start at zero.</p>`,
      dxf: A.build, file: 'flexure-checks' });
  }
  const barSw = ci => `<svg class="va va-mini" viewBox="0 0 24 8" aria-hidden="true"><rect x="1" y="1" width="22" height="6" class="bar${ci}"/></svg>`;

  /* ================= Constructibility ================= */
  function constr(slot, o, A) {
    const R = o.R, P = o.P, g = geo(P, o.gi); if (g.errors.length) return fail(slot, g.errors.join(' '));
    const rows = R.rows, xr = rows.map(q => q.x), sel = Math.min(o.sel || 0, rows.length - 1), AR = R.F && R.F.AR, sq = AR && AR.seq;
    const items = rows.map((q, i) => ({ x: q.x, ratio: q.gov ? q.gov.ratio : NaN, ok: q.gov ? !(q.gov.ng && !fin(q.gov.ratio)) : false, label: `Governs (row ${i + 1})` }));
    const bands = bandsOf(items, g), top = bands.find(b => b.label);
    const MS = sq && AR.x ? [{ key: 'mc', html: 'M<sub>DCc</sub> (pour sequence)', ci: 4, a: sq.MDCc }, { key: 'm1', html: 'M<sub>DC1</sub> (deck at once)', ci: 0, dash: '5 3', a: AR.st.DC1.M }] : [];
    const at = x => { const k = nearest(xr, x); return [`${rows[k].name} · ${plates(g, xr[k])}`, `M_c = ${nf(rows[k].Mc, 1)} kip-ft${rows[k].gov ? `; ${rows[k].gov.id} ratio ${fin(rows[k].gov.ratio) ? nf(rows[k].gov.ratio, 3) : 'NG'}` : ''}`]; };
    const table = sq ? `<table class="va-tb"><caption>Deck placement sequence: pours in the order placed (the pours over the elevation)</caption><thead><tr><th>Pour (order)</th><th>From, ft</th><th>To, ft</th><th>Length, ft</th></tr></thead><tbody>${sq.pours.map((p, k) => `<tr><td>${k + 1}</td><td>${nf(p.a, 1)}</td><td>${nf(p.b, 1)}</td><td>${nf(p.b - p.a, 1)}</td></tr>`).join('')}</tbody></table>` : '';
    return VA().mount(slot, { key: 'cn', title: 'Deck pour sequence and moment envelope',
      sub: sq ? 'Pours in order over the elevation; bands = governing deck-placement ratio (merged where the colour class is the same); M<sub>DCc</sub> envelope' : 'No pour sequence (simple spans, noncomposite or the sequence is off): M<sub>DC1</sub> is used',
      draw: W => VA().render({ L0: g.L0, L1: g.L1, sup: (AR && AR.sup) || g.sup, sel: xr[sel], selLabel: rows[sel].name, aria: 'Deck pour sequence, deck-placement ratio and moment envelope', rows: [
        { kind: 'elev', geo: g, fill: bands, above: sq ? [{ t: 'boxes', items: sq.pours.map((p, k) => ({ x0: p.a, x1: p.b, texts: [`Pour ${k + 1}`, String(k + 1)] })) }] : [] },
        { kind: 'band', label: 'Deck placement: governing ratio', items: bands, flag: top ? { x: top.x, text: `${top.label}: ${top.text}`, cls: 'gov' } : null },
        MS.length ? { kind: 'chart', key: 'M', label: 'M_DCc envelope vs M_DC1, kip-ft', unit: 'kip-ft', series: MS.map(q => ({ key: q.key, ci: q.ci, dash: q.dash, pts: AR.x.map((x, i) => [x, q.a[i]]) })), hidden: S.hide.cnM } : null] }, W),
      at, pickX: x => nearest(xr, x), snap: x => xr[nearest(xr, x)], onSelect: k => o.onSelect && o.onSelect(k),
      chips: () => (MS.length ? [chipGroup('cnM', 'Envelope', MS)] : []), onChip, legend: VA().legend('ratio'), hint: 'Point at (or tap) the graphic to read a location; click or tap to select it.',
      caption: (MS.length ? prLegend(MS) : '') + table + `<p class="vk-cap">Pours, M<sub>DCc</sub> and M<sub>DC1</sub> are the Analysis results the checks use (Analysis tab, deck placement sequence); the band row is the governing deck-placement ratio at each location of the table (green below 0.90, amber 0.90 to 1.00, red above 1.00 or NG). Click (or tap) a location to select it.</p>`,
      notes: platesCap(g) + `<p class="vk-note">${NOTE_EL}</p>`, dxf: A.build, file: 'constructibility-pours' });
  }


  /* ================= family (b), second half: Shear, Fatigue, Welds, Rating, the Report summary (the results of engine/tabgraphics-b.js's graphics) =================
     o = { P, gi, R (the tab's build() result), sel (the tab's selection { k, i }, or the Rating row index), onSel(value), build() (the old drawing: Download DXF) } */
  const TB = () => window.SBDTabGfxB;
  const f1 = v => (+v).toFixed(1), f2 = v => (+v).toFixed(2), f3 = v => (+v).toFixed(3);   // the digits of engine/tabgraphics-b.js
  const txt = s => (TB() ? TB().asc(s) : String(s == null ? '' : s));   // a result's text without TeX (as the old drawing; not upper case)
  const supName = (k, n) => (k === 0 ? 'Abut. 1' : k === n - 1 ? 'Abut. 2' : `Pier ${k}`);
  const segAtG = (g, x) => g.segs.find(s => x >= s.x0 - 1e-9 && x < s.x1 - 1e-9) || (x < g.segs[0].x0 ? g.segs[0] : g.segs[g.segs.length - 1]);
  const legendMore = items => items.map(([cls, t]) => `<span><i class="${cls}"></i>${t}</span>`).join('');
  const atPlates = g => x => [`x = ${nf(x, 1)} ft`, plates(g, x)];

  /* Shear & stiffeners (old: engine/tabgraphics-b.js shear()) */
  function shear(slot, o) {
    const R = o.R, P = o.P, TX = TB(), rc = TX.ratioClass, gi = Math.min(o.gi != null ? o.gi : Math.max(0, (R.gm.gNo || 1) - 1), P.girders.length - 1), g = geo(P, gi); if (g.errors.length) return fail(slot, g.errors.join(' '));
    const G = TX.geoProject(P, gi), has = R.gm.dem, rows = R.panels.rows, gov = R.panels.gov, sel = o.sel || {}, tx = TX._internal.tsStations(R);
    // the panel fills: one per run of neighbouring panels of one colour class (no fill without a shear envelope), as the old drawing
    const fill = []; if (has) { let run = null; rows.forEach(q => { const c = rc(q.r); if (run && run.cls === c && Math.abs(run.x1 - q.p) < 1e-6) run.x1 = q.q; else { if (run) fill.push(run); run = { x0: q.p, x1: q.q, cls: c }; } }); if (run) fill.push(run); }
    const stiff = [], areas = [], flags = [], marksTxt = [];
    rows.forEach(q => { areas.push({ x0: q.p, x1: q.q, reg: { v: { k: 'pan', i: q.i }, pri: 4, lab: [`Panel ${f2(q.p)} to ${f2(q.q)} ft${q.end ? ' (end)' : ''}`, `d_o = ${f2(q.d)} in = ${f2(q.d / R.D)}D${has ? `, V_u/φ_v V_n = ${f3(q.r)}` : ''}`] } });
      if (has && (rc(q.r) !== 'ok' || q === gov)) marksTxt.push({ x0: q.p, x1: q.q, text: f2(q.r), cls: rc(q.r) }); });
    R.TS && R.TS.rows.forEach((r, i) => { const x = tx[i]; if (!fin(x)) return; const nm = `${r.type === 'B' ? 'CP' : 'TS'}${i + 1}`, isG = R.tsGov && R.tsGov.i === i, isS = sel.k === 'ts' && sel.i === i; stiff.push({ x, kind: r.type === 'B' ? 'cp' : 'ts' });
      areas.push({ x0: x, x1: x, pad: 4, reg: { v: { k: 'ts', i }, pri: 0, lab: [`${nm}: ${txt(r.name)}`, `type ${r.type}`] } });
      if (isG || isS) flags.push({ x, y: 'top', text: `${nm}${isG ? ` governs ${f3(R.tsGov.it.r)}` : ' selected'}`, cls: isG ? 'gov' : 'sel', reg: { v: { k: 'ts', i }, pri: 0, lab: [`${nm}: ${txt(r.name)}`, `type ${r.type}`] } }); });
    R.BS && R.BS.rows.forEach((r, k) => { const x = G.sup[k]; if (x == null) return; const isG = R.bsGov && R.bsGov.i === k, isS = sel.k === 'bs' && sel.i === k, lab = [txt(r.name), isG ? `governs ${f3(R.bsGov.it.r)}` : 'bearing stiffener'];
      stiff.push({ x, kind: 'bs' }); areas.push({ x0: x, x1: x, pad: 6, reg: { v: { k: 'bs', i: k }, pri: -1, lab } });
      flags.push({ x, y: 'top', text: `BS${k + 1}${isG ? ` governs ${f3(R.bsGov.it.r)}` : ''}`, cls: isG ? 'gov' : isS ? 'sel' : '', reg: { v: { k: 'bs', i: k }, pri: -1, lab } }); });
    if (has && gov) flags.push({ x: (gov.p + gov.q) / 2, y: 'top', text: `Panel governs ${f3(gov.r)}`, cls: 'gov' });
    // the stiffener spacing over the girder: runs of equal d_o between the panel joints, n @ d_o (d_o/D) where it fits (the old dimension texts)
    const dims = []; { const xs = [...new Set(rows.flatMap(q => [q.p, q.q]).map(x => +x.toFixed(4)))].sort((a, b) => a - b), ft = v => window.SharedDxf.fmtFtIn(v * 12);
      for (let j = 0; j < xs.length - 1;) { const dd = xs[j + 1] - xs[j]; let k = j + 1; while (k < xs.length - 1 && Math.abs((xs[k + 1] - xs[k]) - dd) < 1e-3) k++; const n = k - j;
        dims.push({ x0: xs[j], x1: xs[k], texts: [`${n > 1 ? n + ' @ ' : ''}${ft(dd)} (${f2(dd * 12 / R.D)}D)`, `${n > 1 ? n + ' @ ' : ''}${ft(dd)}`, `${n > 1 ? n + '@' : ''}${f2(dd * 12 / R.D)}D`] }); j = k; } }
    // the stations: cells coloured by each station's governing ratio (runs of one class drawn as one cell), a click area per station
    const st = R.stations, xs = st.map(s => s.x), runs = [], sareas = []; let run = null, selBox = null;
    st.forEach((s, i) => { const x = xs[i], a = Math.max(0, i ? (xs[i - 1] + x) / 2 : x - 0.5), b = Math.min(G.L, i < st.length - 1 ? (x + xs[i + 1]) / 2 : x + 0.5), c = rc(s.gov ? s.gov.ratio : NaN); if (b <= a) return;
      if (run && run.cls === c && Math.abs(run.x1 - a) < 1e-6) run.x1 = b; else { if (run) runs.push(run); run = { x0: a, x1: b, cls: c }; }
      if (sel.k === 'loc' && sel.i === i) selBox = { x0: a, x1: b };
      sareas.push({ x0: a, x1: b, reg: { v: { k: 'loc', i }, pri: 2, lab: [txt(s.name), s.gov ? `${s.gov.id} ${f3(s.gov.ratio)}` : ''] } }); }); if (run) runs.push(run);
    const sg = R.stGov ? { x: R.stGov.x != null ? R.stGov.x : xs[st.indexOf(R.stGov)], text: `${R.stGov.gov.id} ${f3(R.stGov.gov.ratio)}`, cls: 'gov' } : null;
    const boxes = []; if (has && gov) boxes.push({ x0: gov.p, x1: gov.q, cls: 'gov' }); if (sel.k === 'pan') { const q = rows.find(r => r.i === sel.i); if (q) boxes.push({ x0: q.p, x1: q.q, cls: 'sel' }); }
    const gl = P.girders[gi] || {};
    return VA().mount(slot, { key: 'shear', title: 'Shear and stiffener layout', sub: `Girder ${esc(gl.label || `G${gi + 1}`)} · web panels filled by V<sub>u</sub> / (φ<sub>v</sub>V<sub>n</sub>), 6.10.9${has ? '' : ' · no shear envelope from this source (panel resistance only)'}`,
      draw: W => VA().render({ L0: g.L0, L1: g.L1, sup: g.sup, aria: 'Girder elevation with the web panels coloured by the shear ratio and the stiffener layout', rows: [
        { kind: 'elev', geo: g, fill, stiff, boxes, areas, webText: false, webLabels: marksTxt, above: [{ t: 'dims', items: dims }, { t: 'flags', items: flags }] },
        { kind: 'band', label: 'Stations (GS11, GS16, GS18): governing ratio at each', items: runs, areas: sareas, selBox, flag: sg }] }, W),
      at: atPlates(g), onSelect: v => o.onSel && o.onSel(v),
      legend: VA().legend('ratio') + legendMore([['va-st cp', 'connection plate (CP)'], ['va-st ts', 'intermediate stiffener (TS)'], ['va-st bs', 'bearing stiffener (BS)']]) + VA().legend('marks'),
      hint: 'Point at (or tap) a panel, stiffener, bearing or station to read it; click or tap to select it in the tables below.',
      caption: `<p class="vk-cap">Each web panel is filled in the colour of its shear ratio V<sub>u</sub>/(φ<sub>v</sub>V<sub>n</sub>) (green below 0.90, amber 0.90 to 1.00, red above 1.00; the ratio is written where it is not green, or governs); neighbouring panels of one class are one fill. Above the girder: the stiffener spacing, n @ d<sub>o</sub> (d<sub>o</sub>/D) where it fits, and the bearing stiffeners BS1… with the governing items. The station row is the governing ratio of GS11, GS16 and GS18 at each station. The stiffener details below are to scale.</p>`,
      notes: platesCap(g) + `<p class="vk-note">${NOTE_EL}</p>`, dxf: o.build, file: o.file });
  }

  /* Fatigue & studs: details and stud zones (old: engine/tabgraphics-b.js fatigue()) */
  const FLOC = { bfo: s => -s.botT, bfi: () => 0, wb: (s, r) => +r.yo || 0, wt: (s, r) => s.D - (+r.yo || 0), tfi: s => s.D, tfo: s => s.D + s.topT, y: (s, r) => (+r.yo || 0) - s.botT };   // engine FLOC with no exaggeration (in from the bottom of the web)
  function fatigue(slot, o) {
    const R = o.R, P = o.P, TX = TB(), rc = TX.ratioClass, gi = o.gi || 0, g = geo(P, gi); if (g.errors.length) return fail(slot, g.errors.join(' '));
    const sel = o.sel || {}, fa1 = R.FC ? (R.FC.find(c => c.id === 'FA1') || { items: [] }).items : [], rows = R.FR && !R.FR.errors.length ? R.FR.rows : [];
    const marks = [], up = [], dn = [];
    rows.forEach((r, i) => { const x = +r.x, s = segAtG(g, Math.min(Math.max(x, 1e-6), g.L1 - 1e-6)), y = (FLOC[r.loc] || FLOC.bfo)(s, r), q = fa1[i], rat = r.exempt ? NaN : q ? q.r : NaN, cls = r.exempt ? 'na' : rc(rat);
      const reg = { v: { k: 'fa', i }, pri: 0, lab: [`F${i + 1} ${txt(r.name)}`, r.exempt ? 'exempt (FA2)' : `FA1: γ(Δf)/(ΔF)_n = ${f3(rat)}`] };
      marks.push({ x, y, cls, sel: sel.k === 'fa' && sel.i === i, reg }); (y > s.D / 2 ? up : dn).push({ x, y, text: `F${i + 1} ${r.exempt ? 'exempt' : f2(rat)}`, cls, reg }); });
    const zs = R.SR && !R.SR.errors.length ? R.SR.zones : [], sc1 = R.SCC ? (R.SCC.find(c => c.id === 'SC1') || { items: [] }).items : [];
    const cells = zs.map((z, i) => { const r = sc1[i] ? sc1[i].r : NaN, n = TX.studCount(z); return { x0: z.x1, x1: z.x2, cls: rc(r), top: `${z.nr}@${+(+z.p).toFixed(1)}`, bottom: `${n}`, sel: sel.k === 'sc',
      reg: { v: { k: 'sc', i: 0 }, pri: 1, lab: [`Stud zone ${f2(z.x1)} to ${f2(z.x2)} ft`, `${z.nr} @ ${f2(z.p)} in = ${n} studs, SC1 ${f3(r)}`] } }; });
    const tot = zs.reduce((s2, z) => s2 + TX.studCount(z), 0), gl = P.girders[gi] || {};
    return VA().mount(slot, { key: 'fatigue', title: 'Fatigue details and stud zones', sub: `Girder ${esc(gl.label || 'G1')} · F1… = the fatigue details of the table, ratio γ(Δf)/(ΔF)<sub>n</sub> (FA1); stud pitch zones (6.10.10) coloured by SC1`,
      draw: W => VA().render({ L0: g.L0, L1: g.L1, sup: g.sup, aria: 'Girder elevation with the fatigue details and the stud pitch zones', rows: [
        { kind: 'elev', geo: g, marks, above: [{ t: 'flags', items: up }, zs.length ? { t: 'cells', label: 'Shear stud pitch zones (6.10.10): rows @ pitch (in) above, count below; colour = SC1 fatigue ratio', items: cells, note: `Total ${tot} studs` } : null], below: [{ t: 'flags', items: dn }] }] }, W),
      at: atPlates(g), onSelect: v => o.onSel && o.onSel(v),
      legend: VA().legend('ratio') + legendMore([['va-dot mk-ok', 'fatigue detail (colour = FA1 ratio)'], ['va-dot mk-na', 'exempt (FA2)']]) + VA().legend('marks').replace(/<span><i class="va-dot r-gov"><\/i>governing<\/span>/, ''),
      hint: 'Point at (or tap) a detail or a stud zone to read it; click or tap to select it in the tables below.',
      caption: `<p class="vk-cap">Each fatigue detail of the table is marked at its station and its height on the section (flange or web), coloured by its FA1 ratio γ(Δf)/(ΔF)<sub>n</sub> (grey: exempt, FA2); details in the upper half of the web are labelled above the girder, the others below. The stud pitch zones run along the top flange: rows @ pitch (in) above each zone, the stud count below; colour = SC1.${zs.length ? '' : ' No stud zones in these results.'}</p>`,
      notes: platesCap(g) + `<p class="vk-note">${NOTE_EL}</p>`, dxf: o.build, file: o.file });
  }
  /* Fatigue & studs: γ(Δf) and (ΔF)_n of each detail along the girder (old: engine/tabgraphics-b.js fatigueChart()) */
  function fatigueChart(slot, o) {
    const R = o.R, P = o.P, TX = TB(), rc = TX.ratioClass, gi = o.gi || 0, G = TX.geoProject(P, gi), sel = o.sel || {};
    const rows = R.FR && !R.FR.errors.length ? R.FR.rows : [], fa1 = R.FC ? (R.FC.find(c => c.id === 'FA1') || { items: [] }).items : [], cl = i => (rows[i].exempt ? 'na' : rc(fa1[i] ? fa1[i].r : NaN));
    const SS = [{ key: 'res', html: '(ΔF)<sub>n</sub> resistance', ci: 1 }, { key: 'dem', html: 'γ(Δf) demand (colour = FA1 ratio)', ci: 0 }], w = G.L / 160;
    const lab = (r, i) => [`F${i + 1} ${txt(r.name)}`, `γ(Δf) ${f2(r.dem)} / (ΔF)_n ${f2(r.res)} ksi`];
    return VA().mount(slot, { key: 'fatigue-chart', title: 'Fatigue stress range along the girder', sub: `Girder ${esc((P.girders[gi] || {}).label || 'G1')} · γ(Δf) vs the nominal resistance (ΔF)<sub>n</sub> of each detail`,
      draw: W => VA().render({ L0: 0, L1: G.L, sup: G.sup, axisTitle: 'Station along the girder, ft', aria: 'Fatigue stress range and resistance of each detail along the girder', rows: [
        { kind: 'chart', key: 'f', label: 'Stress range, ksi', h: W < 600 ? 150 : 200, supNames: G.sup.map((x, k) => supName(k, G.sup.length)), hidden: S.hide.fc,
          series: [{ key: 'res', kind: 'points', hollow: true, ci: 1, pts: rows.filter(r => fin(r.res)).map(r => [+r.x, r.res]) }, { key: 'dem', kind: 'points', ci: 0, pts: rows.map((r, i) => (fin(r.dem) ? [+r.x, r.dem, cl(i)] : null)).filter(Boolean) }],
          links: rows.filter(r => fin(r.res) && fin(r.dem)).map(r => ({ x: +r.x, y0: r.dem, y1: r.res })), labels: rows.map((r, i) => ({ x: +r.x, y: Math.max(r.dem || 0, r.res || 0), text: `F${i + 1}` })),
          rings: sel.k === 'fa' && rows[sel.i] && fin(rows[sel.i].dem) ? [{ x: +rows[sel.i].x, y: rows[sel.i].dem }] : [],
          regs: rows.map((r, i) => ({ x0: +r.x - w, x1: +r.x + w, y0v: Math.min(r.dem || 0, r.res || 0), y1v: Math.max(r.dem || 0, r.res || 0), v: { k: 'fa', i }, pri: 0, lab: lab(r, i) })) }] }, W),
      at: x => { if (!rows.length) return null; const k = nearest(rows.map(r => +r.x), x); return lab(rows[k], k); }, onSelect: v => o.onSel && o.onSel(v),
      chips: () => [chipGroup('fc', 'Show', SS)].map(q => ({ ...q, items: q.items.map(it => ({ ...it, html: it.html.replace(/<svg[\s\S]*?<\/svg>/, it.key.endsWith('res') ? '<i class="va-dot" style="border:2px solid #2563EB"></i>' : '<i class="va-dot mk-ok"></i>') })) })), onChip,
      legend: VA().legend('ratio').replace(/va-sw/g, 'va-dot').replace(/c-(ok|hi|ng)/g, 'mk-$1') + legendMore([['va-dot mk-na', 'exempt (FA2)'], ['va-dot r-sel', 'selected']]),
      hint: 'Point at (or tap) a detail to read its stress range and resistance; click or tap to select it.',
      caption: `<p class="vk-cap vk-pr">Hollow circle: (ΔF)<sub>n</sub> resistance; filled: γ(Δf) demand (grey below 0.90, dark grey 0.90 to 1.00, black above 1.00, white exempt).</p><p class="vk-cap">Each detail F1… of the table at its station: the demand γ(Δf) (filled, coloured by the FA1 ratio) and the resistance (ΔF)<sub>n</sub> (hollow), joined by a dashed line; ksi.</p>`,
      dxf: o.build, file: o.file });
  }

  /* Welds: locations on the elevation (old: engine/tabgraphics-b.js welds()) */
  const maxRatio = (C, pre) => { let m = NaN; C.forEach(c => c.items.forEach(it => { if (it.step && it.step.startsWith(pre) && typeof it.r === 'number' && (!fin(m) || it.r > m || Number.isNaN(it.r))) m = it.r; })); return m; };   // as engine/tabgraphics-b.js
  function welds(slot, o) {
    const B = o.R, P = o.P, TX = TB(), rc = TX.ratioClass, gi = o.gi || 0, g = geo(P, gi); if (g.errors.length) return fail(slot, g.errors.join(' '));
    const G = TX.geoProject(P, gi), R = B.R, sel = o.sel || {}, marks = [], up = [], dn = [], F = window.SharedDxf.frac;
    R.fw.forEach(r => { const x = TX.parseX(r.name, G.sup); if (!fin(x)) return; const xc = Math.min(Math.max(x, g.L0), g.L1), rat = maxRatio(B.C, `wf${r.i}.`), cls = rc(rat), dx = /right/.test(r.name) ? 7 : /left/.test(r.name) ? -7 : 0;
      const reg = { v: { k: 'fw', i: r.i }, pri: 0, lab: [`W${r.i + 1} ${txt(r.name)}`, `w = ${F(r.w)}", ratio ${f3(rat)}`] };
      marks.push({ x: xc, dx, y: 'mid', cls, sel: sel.k === 'fw' && sel.i === r.i, reg }); up.push({ x: xc, dx, y: 'mid', text: `W${r.i + 1} ${F(r.w)}"`, cls, reg }); });
    R.tr.forEach(r => { const x = TX.parseX(r.name, G.sup); if (!fin(x)) return; const isTop = /^Top/i.test(r.name), rat = maxRatio(B.C, `wt${r.i}.`), cls = rc(rat), s = segAtG(g, Math.min(Math.max(x, 1e-6), g.L1 - 1e-6)), y = isTop ? s.D + s.topT / 2 : -s.botT / 2;
      const reg = { v: { k: 'tr', i: r.i }, pri: 0, lab: [`T${r.i + 1} ${txt(r.name)}`, `ratio ${f3(rat)}`] };
      marks.push({ x, y, shape: 'diamond', cls, sel: sel.k === 'tr' && sel.i === r.i, reg }); (isTop ? up : dn).push({ x, y, text: `T${r.i + 1} ${r.cat}`, cls, reg }); });
    return VA().mount(slot, { key: 'welds', title: 'Weld locations', sub: `Girder ${esc((P.girders[gi] || {}).label || 'G1')} · flange-to-web fillet welds, both sides, full length; the checked locations coloured by their largest ratio`,
      draw: W => VA().render({ L0: g.L0, L1: g.L1, sup: g.sup, aria: 'Girder elevation with the weld locations', rows: [{ kind: 'elev', geo: g, welds: true, marks, above: [{ t: 'flags', items: up }], below: [{ t: 'flags', items: dn }] }] }, W),
      at: atPlates(g), onSelect: v => o.onSel && o.onSel(v),
      legend: VA().legend('ratio') + legendMore([['va-st wl', 'flange-to-web fillet weld'], ['va-dot mk-ok', 'W = flange-to-web weld check'], ['va-dot mk-ok" style="border-radius:0;transform:rotate(45deg) scale(.8)', 'T = shop flange transition'], ['va-dot r-sel', 'selected']]),
      hint: 'Point at (or tap) a weld location to read it; click or tap to select it in the tables below.',
      caption: `<p class="vk-cap">The flange-to-web fillet welds (orange lines along both flanges) and the locations checked: W1… flange-to-web weld checks (circles, labelled with the weld size) and T1… shop flange transitions (diamonds on their flange, labelled with the detail category), coloured by the largest ratio of their checks (green below 0.90, amber 0.90 to 1.00, red above 1.00).</p>`,
      notes: platesCap(g) + `<p class="vk-note">${NOTE_EL}</p>`, dxf: o.build, file: o.file });
  }

  /* Rating: RF along the girder (old: engine/tabgraphics-b.js ratingChart(); the same RF of each station (the smallest of the rows there), the same capped scale) */
  function rfSeries(rows, kind, key) { const m = new Map(); rows.forEach(r => { if (r.kind !== kind || !fin(r.x)) return; const v = r[key]; if (v == null || Number.isNaN(v)) return; const k = +r.x.toFixed(3); m.set(k, Math.min(m.has(k) ? m.get(k) : Infinity, v)); }); return [...m.entries()].sort((a, b) => a[0] - b[0]); }
  function rating(slot, o) {
    const B = o.R, P = o.P, TX = TB(), gi = o.gi || 0, sup = B.pl && B.pl.member && B.pl.member.supports ? B.pl.member.supports : TX.geoProject(P, gi).sup, Lg = sup[sup.length - 1], cap = 5;
    const SS = [{ key: 'if', html: 'Inventory, flexure', ci: 0, kind: 'flex', w: 'inv' }, { key: 'is', html: 'Inventory, shear', ci: 2, kind: 'shear', w: 'inv' }, { key: 'of', html: 'Operating, flexure', ci: 0, dash: '6 3', kind: 'flex', w: 'opr' }, { key: 'os', html: 'Operating, shear', ci: 2, dash: '6 3', kind: 'shear', w: 'opr' }];
    const data = SS.map(q => rfSeries(B.rows, q.kind, q.w)); let ymax = 0; data.forEach(s => s.forEach(p => { if (fin(p[1])) ymax = Math.max(ymax, Math.min(p[1], cap)); })); ymax = Math.max(2, Math.ceil(ymax * 1.05 * 2) / 2);
    const govs = ['inv', 'opr'].map(k => { const q = B.sum && B.sum.gov && B.sum.gov[k]; return q && fin(q.x) && fin(q[k]) ? { x: q.x, y: Math.min(Math.max(q[k], 0), ymax), text: `${k === 'inv' ? 'Inventory' : 'Operating'} RF ${f2(q[k])} at ${f1(q.x)} ft` } : null; }).filter(Boolean);
    // the click areas: one per station, the row with the smallest Inventory RF there (flexure or shear), as the old graphic
    const best = new Map(); B.rows.forEach((r, i) => { if ((r.kind !== 'flex' && r.kind !== 'shear') || !fin(r.x) || r.oos) return; const k = +r.x.toFixed(3), v = fin(r.inv) ? r.inv : Infinity; if (!best.has(k) || v < best.get(k).v) best.set(k, { v, i }); });
    const xs = [...best.keys()].sort((a, b) => a - b), regs = xs.map((x, j) => { const r = B.rows[best.get(x).i]; return { x0: j ? (xs[j - 1] + x) / 2 : 0, x1: j < xs.length - 1 ? (x + xs[j + 1]) / 2 : Lg, v: { k: 'rt', i: best.get(x).i }, pri: 3,
      lab: [`${txt(r.name)}: ${txt(r.title)}`, `Inventory ${fin(r.inv) ? f2(r.inv) : '-'}, Operating ${fin(r.opr) ? f2(r.opr) : '-'}`] }; });
    const sr = o.sel != null && B.rows[o.sel] && fin(B.rows[o.sel].x) ? B.rows[o.sel] : null;
    return VA().mount(slot, { key: 'rating', title: 'Rating factor along the girder', sub: `Girder ${esc((P.girders[gi] || {}).label || 'G1')} · load rating (LRFR), Inventory and Operating, flexure and shear`,
      draw: W => VA().render({ L0: 0, L1: Lg, sup, axisTitle: 'Station along the girder, ft', sel: sr ? sr.x : null, selLabel: sr ? txt(sr.name) : '', aria: 'Load rating factors along the girder', rows: [
        { kind: 'chart', key: 'rf', label: 'Rating factor RF', h: W < 600 ? 160 : 220, yr: [0, ymax], ystep: ymax > 6 ? 1 : 0.5, cap: ymax, supNames: sup.map((x, k) => supName(k, sup.length)), hidden: S.hide.rt,
          series: SS.map((q, k) => ({ key: q.key, ci: q.ci, dash: q.dash, pts: data[k] })), limits: [{ y: 1, label: 'RF = 1.0' }], gov: govs, govLabels: govs, regs }] }, W),
      at: () => null, onSelect: v => o.onSel && o.onSel(v), chips: () => [chipGroup('rt', 'Show', SS)], onChip,
      legend: legendMore([['va-dot r-gov', 'governing (smallest RF)']]), hint: 'Point at (or tap) the chart to read the rating factors at a station; click or tap to select its row.',
      caption: prLegend(SS) + `<p class="vk-cap">The RF of each station is the smallest of the rows there (the governing check), Inventory solid and Operating dashed. The scale is capped at RF ${ymax}; a value above it is shown by an arrow and a dashed cap at the top edge. RF = 1.0 marked; the governing Inventory and Operating ratings are circled.</p>`,
      dxf: o.build, file: o.file });
  }

  /* Report summary (static figure: the Report and the Summary tab; old: engine/tabgraphics-b.js summary(), drawn with SBDGraphics.tightSvg) */
  const MODS = { Analysis: 'AN', Flexure: 'FLEX', 'Shear & stiffeners': 'SHEAR', 'Fatigue & studs': 'FAT', 'Cross-frames': 'XF', 'Field splices': 'SPL', Welds: 'WELD', Rating: 'RATING', Constructibility: 'CONSTR' };   // as engine/tabgraphics-b.js
  const sumLabel = q => { const t = TB().asc(q.check), id = /\b(GS\d+|TS\d+|CP\d+|BS\d+|FA\d+|SC\d+|CF\d+|FW\d|TR\d|BF\d|TF\d|WS\d|SA\d+|DT\d+|MT\d)\b/.exec(t), inv = /^Inventory/i.test(t) ? 'INV' : /^Operating/i.test(t) ? 'OPR' : '';
    return `${MODS[q.mod] || TB().asc(q.mod).toUpperCase().slice(0, 8)} ${inv || (id ? id[1] : /^Panel/i.test(t) ? 'PANEL' : t.toUpperCase().slice(0, 10))}`; };   // as engine/tabgraphics-b.js sumLabel
  function summarySpec(M, P, gi) {
    const TX = TB(), rc = TX.ratioClass, g = geo(P, gi || 0); if (g.errors.length) return null;
    const G = TX.geoProject(P, gi || 0), rows = M.gov || [], n = G.sup.length;
    const regionOf = (x, name) => { const t = String(name || ''); let m = /Abut\. (\d)/i.exec(t); if (m) return { k: 'sup', i: +m[1] === 1 ? 0 : n - 1 }; m = /Pier (\d)/i.exec(t); if (m && +m[1] < n) return { k: 'sup', i: +m[1] }; if (!fin(x)) return null;
      for (let k = 0; k < n - 1; k++) if (x <= G.sup[k + 1] + 1e-6) return { k: 'span', i: k }; return { k: 'span', i: n - 2 }; };
    const buckets = new Map(), gen = []; rows.forEach(q => { const x0 = TX.parseX(q.loc, G.sup), x = fin(x0) ? x0 : TX.parseX(q.check, G.sup), rg = regionOf(x, fin(x0) ? q.loc : q.check); if (!rg) { gen.push(q); return; } const key = rg.k + rg.i; if (!buckets.has(key)) buckets.set(key, { rg, rows: [] }); buckets.get(key).rows.push({ q, x }); });
    const items = []; for (let k = 0; k < n - 1; k++) { const b = buckets.get('span' + k); if (!b) continue; const rs = b.rows.map(q2 => (q2.q.rf != null ? (fin(q2.q.rf) && q2.q.rf > 0 ? 1 / q2.q.rf : Infinity) : q2.q.r)).filter(v => fin(v) || v === Infinity);
      if (rs.length) { const r = Math.max(...rs), ok = r <= 1 + 1e-9; items.push({ x0: G.sup[k], x1: G.sup[k + 1], cls: clsG(r, ok), text: `Span ${k + 1}: ${ok === false || !fin(r) ? 'NG' : nf(r, 2)}` }); } }
    const marks = [], flags = [];
    [...buckets.values()].forEach(b => { const xc = b.rg.k === 'sup' ? G.sup[b.rg.i] : (G.sup[b.rg.i] + G.sup[b.rg.i + 1]) / 2;
      b.rows.forEach(q2 => { const q = q2.q, v = q.rf != null ? `RF ${fin(q.rf) ? f2(q.rf) : '-'}` : f3(q.r), cls = q.rf != null ? (!fin(q.rf) ? 'na' : rc(q.rf > 0 ? 1 / q.rf : Infinity)) : rc(q.r), xo = fin(q2.x) ? q2.x : xc;
        marks.push({ x: xo, y: 'top', cls }); flags.push({ x: xo, y: 'top', text: `${sumLabel(q)} ${v}`, cls }); }); });
    return { L0: g.L0, L1: g.L1, sup: g.sup, axis: true, aria: 'Governing check of each group along the girder', rows: [
      { kind: 'elev', geo: g, marks: marks.map(q => ({ ...q, small: true })), above: [{ t: 'flags', items: flags }] },
      items.length ? { kind: 'band', label: 'Worst check of the span (a rating factor counts as 1 / RF)', items } : null,
      gen.length ? { kind: 'text', lines: gen.map(q => `${sumLabel(q)}: ${TB().asc(q.check).slice(0, 70)} ${q.rf != null ? `RF ${fin(q.rf) ? f2(q.rf) : '-'}` : f3(q.r)}`) } : null] };
  }
  /* the summary figure as a static SVG (style inside: prints grey / hatched) and its caption line; '' when it cannot be drawn */
  function summarySvg(M, P, gi, W) { try { const sp = summarySpec(M, P, gi); return sp ? VA().staticSvg(sp, W || 760) : ''; } catch (e) { return ''; } }

  window.SBDAlongGfx = { shear, fatigue, fatigueChart, welds, rating, summarySpec, summarySvg, geo, plates, platesCap, analysis, flexure, flexChecks, constr, clsG, _S: S };
})();
