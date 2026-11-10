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

  window.SBDAlongGfx = { geo, plates, platesCap, analysis, flexure, flexChecks, constr, clsG, _S: S };
})();
