/* apps/steel-bridge/ui/graphics.js — graphics for the output tabs in the Drawings-tab format (window.SBDGraphics). Classic script.
   Display and export only: nothing here computes a result; a tab hands in the numbers its own tables show.
   Needs (read at call time): shared/dxf.js (SharedDxf: entities, SVG preview, zoom / pan viewer, DXF), engine/drawings.js (SBDDrawings.model:
   the plates, supports, splices and cross-frame stations of the drawings).

   Engineer's requirement (2026-10-30): "I love the format of the drawing in the Drawings output tab. Use that for graphics on the other
   tabs." Every graphic is a SharedDxf drawing (same layers S-..., colours, text style, dimensions) drawn by the same preview renderer
   (wheel zoom at the cursor, drag pan, pinch, double-click fit, + / - / Fit buttons) and can be downloaded as DXF. Ratio colours,
   highlights and the selected station are extra layers. Charts use the same drafted look: axes, grid on its own layer, same text.

   Units: the graphic's own drawing units; elevations are in inches (stations in ft x 12), so dimensions read in feet-inches.
   Text is generous (2 % of the long side): rely on zoom.

   API
     G.elevation(P, gi, opts) -> E: girder gi (index in P.girders) in elevation, in the analysis stations of the tab's results.
         Draws: supports, plate segments (flanges, web, deck line), plate breaks with sizes, cross-frame lines (CF), field splices
         (FS), span dimensions, and a stations axis with ticks and labels. opts: { G (a SBDDrawings.model(P) already built), vex (vertical
         exaggeration; default so the girder reads), h (text height), deck (draw the deck line, default true), axis (default true) }.
         E = { D (SharedDxf drawing: add your own entities), G, gi, L0, L1 (ft), X(ft) -> drawing x, Yweb(ft) -> y of the web top,
               yB (web bottom), yTop, h, k, vex, ly (layers: p w st s b d t axis grid sel), stations: { sup, plates, splices, cf } (ft),
               alloc(height) -> y of the top of a new row under everything drawn so far (moves the low edge down),
               layer(name, color, ltype), pick(x, y) -> station in ft, errors: [] }
     G.ratioLayer(E, items, opts) -> { legend, cols }: colours the girder by ratio. items: [{ x (ft), ratio, ok (false = NG), label }]; each
         location takes the stretch to the mid-points of its neighbours (or opts.x0 / x1 per item). Draws vertical hatching in the web in
         the ratio colour, a row under the girder with the values, and a legend. green < 0.8, amber 0.8 to 1.0, red > 1.0 or NG.
     G.ratioColor(ratio, ok) -> AutoCAD colour index (3 green, 2 amber, 1 red)
     G.chart(opts) -> C: a drafted XY plot (axes, grid layer, series, limit line). opts: { D (draw into an existing drawing, else a new
         one), at: [x, y] (lower left of the plot area), w, hgt (plot area size), h (text height), title, xlab, ylab, xr: [min, max], yr,
         xstep, ystep, series: [{ name, pts: [[x, y]], kind: 'line' | 'step' | 'bars' | 'points', color (AutoCAD index), lt }],
         cats: [labels] (bars: x = category number, 0-based), limits: [{ y, label, color }], vlines: [{ x, label, color }], fx, fy (formats) }
         C = { D, X(x), Y(y), pick(px, py) -> x, plot: [x0, y0, x1, y1], h, bottom }.
     G.mark(E, label, value) -> adds the selected-station layer (SEL) to E's drawing: used when the graphic is built for a given selection
     G.mount(el, build, opts) -> H: draws a graphic into el with a title, a Download DXF button, the zoom / pan viewer and a legend note.
         build() returns { D, title, file, note, pick(x, y) -> value, selMark(value) -> { x, y0, y1, label }, readout(value) -> text }.
         opts: { key (keeps the zoom and pan across re-draws of the same view), height, selected, onSelect(value), onHover(value), print note }.
         Clicking (not dragging) a location calls opts.onSelect(pick(x, y)); H.select(value) moves the highlight without rebuilding
         (live overlay, not in the DXF); hovering shows readout(value) (mouse only).
         H = { select(v), viewer, el, graphic, dxf() }
     G.download(graphic, name) saves the DXF (validated first). G.css() adds the styles (called by mount).
   Fix log: fixlog/steel-bridge.md. */
(function () {
  'use strict';
  const X_ = () => window.SharedDxf;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const TXT = 0.10;   // SBDDrawings.TXT: plotted text height; D.k = h / TXT keeps the linetypes the Drawings tab's
  const COL = { green: 3, amber: 2, red: 1, ok: 3, sel: 5, gray: 8, light: 9, plate: 4, web: 5, stiff: 30 };

  /* a new drawing at text height h (drawing units): the linetypes scaled to the text, as the Drawings tab does */
  function newDrawing(h, prefix) { const D = X_().drawing({ prefix: prefix == null ? 'S-' : prefix }); D.h = h; D.k = h / TXT; return D; }
  /* nice step for a range split in about n parts */
  function niceStep(range, n) {
    const raw = Math.abs(range) / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw || 1))), m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }
  const ratioColor = (r, ok) => (ok === false || !fin(r) || r > 1 + 1e-9 ? COL.red : r >= 0.8 ? COL.amber : COL.green);
  const nf = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 2 : d) : '—');

  /* ---------- the girder elevation frame ---------- */
  function elevation(P, gi, opts) {
    opts = opts || {}; const DW = window.SBDDrawings, E = { errors: [] };
    const G = opts.G || DW.model(P); E.G = G;
    if (G.errors && G.errors.length) { E.errors = G.errors.slice(); return E; }
    const pg = P.girders[gi] || P.girders[0], segs = (pg.segments || []).filter(s => fin(+s.x0) && fin(+s.x1) && +s.x1 > +s.x0);
    if (!segs.length) { E.errors = ['The girder has no plate segment.']; return E; }
    const L0 = Math.min(...segs.map(s => +s.x0)), L1 = Math.max(...segs.map(s => +s.x1)), sup = G.sup.slice(), spl = (G.splices || []).slice();
    const xi = Math.max(0, G.girders.findIndex(q => q.pg === gi)), cf = [...(G.girders[xi] ? G.girders[xi].ints : [])].sort((a, b) => a - b);
    const Dmax = Math.max(...segs.map(s => +s.D)), len = (L1 - L0) * 12;
    const h = opts.h || Math.max(len, 8 * Dmax) * 0.02, D = newDrawing(h);
    const vex = opts.vex || Math.max(1, Math.min(6, Math.round(len / 14 / Dmax * 2) / 2));
    Object.assign(E, { D, gi, L0, L1, h, k: D.k, vex, stations: { sup, plates: segs.slice(1).map(s => +s.x0), splices: spl, cf } });
    const ly = E.ly = { p: D.layer('GRDR-PLAT', COL.plate), w: D.layer('GRDR', COL.web), st: D.layer('GRDR-STIF', COL.stiff), s: D.layer('SPLC', 1), b: D.layer('BRNG', 8), d: D.layer('DIMS', 7), t: D.layer('ANNO-TEXT', 7),
      axis: D.layer('AXIS', 7), grid: D.layer('GRID', COL.light), sel: D.layer('SEL', COL.sel), cf: D.layer('XFRM', 3), dk: D.layer('DECK', 7) };
    E.layer = (n, c, lt) => D.layer(n, c, lt);
    const X = E.X = ft => ft * 12, Dw = s => +s.D * vex, yB = E.yB = 0;
    const segAt = ft => segs.find(s => ft >= +s.x0 - 1e-9 && ft <= +s.x1 + 1e-9) || segs[segs.length - 1];
    E.Yweb = ft => Dw(segAt(ft));
    const tmax = Math.max(...segs.map(s => +s.topT)) * vex, bmax = Math.max(...segs.map(s => +s.botT)) * vex, yTop = E.yTop = Math.max(...segs.map(Dw)) + tmax;
    // deck line (the deck slab and haunch over the girder, schematic)
    if (opts.deck !== false && G.deck && G.deck.ts > 0) { const yf = Math.max(...segs.map(Dw)) + tmax, hh = (G.deck.haunch || 0) * vex; D.rect(ly.dk, X(L0), yf + hh, X(L1), yf + hh + G.deck.ts * vex, D.ltype('DASHED')); E.yTop = yf + hh + G.deck.ts * vex; }
    // plates: flanges and web, with the plate break sizes (as the Drawings tab's elevation)
    segs.forEach((s, k) => { const a = X(+s.x0), b = X(+s.x1), d = Dw(s);
      D.rect(ly.p, a, yB + d, b, yB + d + +s.topT * vex); D.rect(ly.p, a, yB - +s.botT * vex, b, yB);
      D.line(ly.w, a, yB, b, yB); D.line(ly.w, a, yB + d, b, yB + d);
      const dp = k ? Dw(segs[k - 1]) : 0; D.line(ly.w, a, yB, a, yB + Math.max(d, dp)); if (k === segs.length - 1) D.line(ly.w, b, yB, b, yB + d);
      if (k) { D.line(ly.p, a, yB - bmax - 0.5 * h, a, yB + Math.max(d, dp) + tmax + 0.5 * h, D.ltype('HIDDEN')); }
      D.text(ly.t, (a + b) / 2, yB + d * 0.5, h * 0.7, `${X_().frac(+s.D)} x ${X_().frac(+s.tw)} WEB`, 1);
      D.text(ly.t, (a + b) / 2, yB + d + +s.topT * vex + 0.4 * h, h * 0.6, `${X_().frac(+s.topB)} x ${X_().frac(+s.topT)}`, 1);
      D.text(ly.t, (a + b) / 2, yB - +s.botT * vex - 1.0 * h, h * 0.6, `${X_().frac(+s.botB)} x ${X_().frac(+s.botT)}`, 1); });
    // cross-frame lines (CF) and field splices (FS)
    cf.forEach(x => { if (x < L0 - 1e-6 || x > L1 + 1e-6) return; D.line(ly.cf, X(x), yB - bmax, X(x), yB + E.Yweb(x) + tmax, D.ltype('CENTER')); });
    if (cf.length) D.text(ly.t, X(cf[Math.floor(cf.length / 2)]) + 0.3 * h, yB + E.Yweb(cf[Math.floor(cf.length / 2)]) * 0.2, h * 0.6, 'CF', 0);
    spl.forEach((x, k) => { D.line(ly.s, X(x), yB - bmax - h, X(x), yB + E.Yweb(x) + tmax + h); D.text(ly.t, X(x), yB + E.Yweb(x) + tmax + 1.6 * h, h * 0.8, `FS${k + 1}`, 1); });
    // supports (bearings as triangles) with the support number
    sup.forEach((x, k) => { const tb = segAt(x).botT * vex; D.pline(ly.b, [[X(x), yB - tb], [X(x) - h * 0.9, yB - tb - h * 1.6], [X(x) + h * 0.9, yB - tb - h * 1.6]], true); D.text(ly.t, X(x), yB - tb - h * 2.9, h * 0.7, `S${k + 1}`, 1); });
    // span dimensions
    let low = yB - bmax - 4.6 * h;
    sup.slice(1).forEach((x, k) => D.dimH(ly.d, X(sup[k]), X(x), low, low + 1.0 * h, `SPAN ${k + 1} = <>`));
    low -= 3.2 * h;
    // stations axis: ticks at a nice step, grid ticks on the GRID layer
    if (opts.axis !== false) {
      const st = niceStep(L1 - L0, 10), t0 = Math.ceil(L0 / st - 1e-9) * st; D.line(ly.axis, X(L0), low, X(L1), low);
      for (let t = t0; t <= L1 + 1e-9; t += st) { D.line(ly.axis, X(t), low, X(t), low - 0.5 * h); D.text(ly.t, X(t), low - 1.7 * h, h * 0.8, nf(t, st < 1 ? 1 : 0), 1);
        D.line(ly.grid, X(t), low, X(t), yB - bmax - 0.2 * h, D.ltype('DASHED')); }
      D.text(ly.t, X(L1), low - 3.2 * h, h * 0.8, 'STATION, FT (FROM CL BRG. ABUT. 1, ALONG THE CENTERLINE SPANS)', 2); low -= 4.4 * h;
    }
    let lowEdge = low;
    E.alloc = height => { const top = lowEdge - 0.6 * h; lowEdge = top - height; return top; };
    E.pick = (x, y) => Math.max(L0, Math.min(L1, x / 12));
    E.title = (t, sub) => { D.text(ly.t, X(L0), E.yTop + 12 * h, h * 1.5, t); if (sub) D.text(ly.t, X(L0), E.yTop + 9.8 * h, h * 0.8, sub); };
    E.selMark = ft => ({ x: X(ft), y0: lowEdge, y1: E.yTop + 6.8 * h, label: `STA ${nf(ft, 1)} FT` });
    return E;
  }

  /* ratio layer (green < 0.8, amber 0.8 to 1.0, red > 1.0 or NG) */
  function ratioLayer(E, items, opts) {
    opts = opts || {}; if (!E || !E.D || !items || !items.length) return { legend: [], cols: [] };
    const D = E.D, h = E.h, X = E.X, its = items.filter(q => fin(q.x)).slice().sort((a, b) => a.x - b.x), cols = [];
    const lay = {}; [[COL.green, 'RATIO-OK'], [COL.amber, 'RATIO-WARN'], [COL.red, 'RATIO-NG']].forEach(([c, n]) => { lay[c] = D.layer(n, c); });
    const yb = E.yB, row = E.alloc(3.4 * h), txt = E.ly.t;
    its.forEach((q, i) => {
      const a = fin(q.x0) ? q.x0 : i ? (its[i - 1].x + q.x) / 2 : E.L0, b = fin(q.x1) ? q.x1 : i < its.length - 1 ? (q.x + its[i + 1].x) / 2 : E.L1, c = ratioColor(q.ratio, q.ok), l = lay[c];
      cols.push({ x: q.x, color: c, x0: a, x1: b });
      if (opts.hatch !== false) { const sp = 1.1 * h; for (let x = X(a) + sp / 2; x < X(b); x += sp) { const ft = x / 12; D.line(l, x, yb + 0.02 * h, x, yb + E.Yweb(ft) - 0.02 * h); } }
      D.rect(l, X(a), row - 2.0 * h, X(b), row); D.line(l, X(q.x), row, X(q.x), row + 0.5 * h);
      const bw = X(b) - X(a), pv = q.ok === false || !fin(q.ratio) ? 'NG' : nf(q.ratio, 2);
      if (bw > pv.length * 0.8 * h * 0.9 + h) D.text(txt, X((a + b) / 2), row - 1.3 * h, h * 0.8, pv, 1);
      if (q.label && bw > (String(q.label).length + 1) * 0.6 * h) D.text(txt, X(q.x), row + 0.7 * h, h * 0.6, q.label, 1);
    });
    // legend (in the drawing, so it is in the DXF): at the left of the row
    const lg = [[COL.green, '< 0.80'], [COL.amber, '0.80 TO 1.00'], [COL.red, '> 1.00 OR NG']], y = row - 2.0 * h - 2.2 * h; let x = X(E.L0);
    const wh = (opts.what || 'RATIO') + ':'; D.text(txt, x, y, h * 0.8, wh); x += h * (wh.length * 0.75 + 2);
    lg.forEach(([c, t]) => { D.rect(lay[c], x, y - 0.1 * h, x + 1.4 * h, y + 0.9 * h); D.text(txt, x + 1.9 * h, y, h * 0.8, t); x += h * (2.6 + t.length * 0.85); });
    E.alloc(2.6 * h);
    return { legend: lg.map(q => q[1]), cols };
  }

  /* the selected-station layer in the drawing itself (for a graphic built for a given selection) */
  function mark(E, label, ft) {
    if (!E || !E.D || !fin(ft)) return; const m = E.selMark(ft), D = E.D, l = E.ly.sel;
    D.line(l, m.x, m.y0, m.x, m.y1); D.pline(l, [[m.x, m.y1 - 0.4 * E.h], [m.x - 0.5 * E.h, m.y1 + 0.3 * E.h], [m.x + 0.5 * E.h, m.y1 + 0.3 * E.h]], true);
    D.text(l, m.x + 0.8 * E.h, m.y1 + 0.2 * E.h, E.h * 0.9, label || m.label);
  }

  /* ---------- drafted XY chart ---------- */
  function chart(o) {
    o = o || {}; const h = o.h || 2.2, D = o.D || newDrawing(h), at = o.at || [0, 0], w = o.w || 100, hg = o.hgt || 50, S = o.series || [], cats = o.cats;
    D.h = D.h || h;
    const ly = { axis: D.layer('AXIS', 7), grid: D.layer('GRID', COL.light), t: D.layer('ANNO-TEXT', 7), lim: D.layer('CHART-LIMIT', 1, 'DASHED'), v: D.layer('CHART-VLINE', 8) };
    let xs = [], ys = []; S.forEach(s => s.pts.forEach(p => { if (fin(p[0]) && fin(p[1])) { xs.push(p[0]); ys.push(p[1]); } }));
    (o.limits || []).forEach(q => { if (fin(q.y)) ys.push(q.y); });
    let xr = o.xr || (cats ? [-0.5, cats.length - 0.5] : xs.length ? [Math.min(...xs), Math.max(...xs)] : [0, 1]);
    let yr = o.yr; if (!yr) { let lo = Math.min(0, ...(ys.length ? ys : [0])), hi = Math.max(...(ys.length ? ys : [1]), lo + 1e-9); const st = niceStep(hi - lo, 5); yr = [Math.floor(lo / st) * st, Math.ceil(hi / st - 1e-9) * st]; if (yr[1] <= yr[0]) yr[1] = yr[0] + st; }
    if (xr[1] <= xr[0]) xr = [xr[0], xr[0] + 1];
    const x0 = at[0], y0 = at[1], X = x => x0 + (x - xr[0]) / (xr[1] - xr[0]) * w, Y = y => y0 + (y - yr[0]) / (yr[1] - yr[0]) * hg, cl = (y) => Math.max(yr[0], Math.min(yr[1], y));
    const fx = o.fx || (v => nf(v, 0)), fy = o.fy || (v => nf(v, 2));
    // grid and tick labels
    const ysT = o.ystep || niceStep(yr[1] - yr[0], 5), xsT = o.xstep || niceStep(xr[1] - xr[0], 8);
    for (let t = Math.ceil(yr[0] / ysT - 1e-9) * ysT; t <= yr[1] + 1e-9; t += ysT) { D.line(ly.grid, x0, Y(t), x0 + w, Y(t)); D.line(ly.axis, x0 - 0.4 * h, Y(t), x0, Y(t)); D.text(ly.t, x0 - 0.8 * h, Y(t) - 0.3 * h, 0.8 * h, fy(t), 2); }
    if (cats) cats.forEach((c, i) => { D.line(ly.axis, X(i), y0, X(i), y0 - 0.4 * h); D.text(ly.t, X(i), y0 - 1.6 * h, 0.8 * h, c, 1); });
    else for (let t = Math.ceil(xr[0] / xsT - 1e-9) * xsT; t <= xr[1] + 1e-9; t += xsT) { D.line(ly.grid, X(t), y0, X(t), y0 + hg); D.line(ly.axis, X(t), y0, X(t), y0 - 0.4 * h); D.text(ly.t, X(t), y0 - 1.6 * h, 0.8 * h, fx(t), 1); }
    D.rect(ly.axis, x0, y0, x0 + w, y0 + hg);
    if (yr[0] < 0 && yr[1] > 0) D.line(ly.axis, x0, Y(0), x0 + w, Y(0));
    // series
    const nS = S.filter(s => s.kind === 'bars').length; let bi = 0, ky = 0;
    S.forEach((s, i) => { const l = D.layer('CHART-S' + (i + 1), s.color || [5, 1, 3, 30, 6, 4][i % 6], s.lt), pts = s.pts.filter(p => fin(p[0]) && fin(p[1]));
      if (s.kind === 'bars') { const bw = 0.7 / Math.max(1, nS) * (w / (xr[1] - xr[0])), off = (bi - (nS - 1) / 2) * bw; bi++;
        pts.forEach(p => { const xa = X(p[0]) + off - bw / 2, xb = xa + bw, ya = Y(cl(0)), yb = Y(cl(p[1])); D.rect(l, xa, Math.min(ya, yb), xb, Math.max(ya, yb)); D.text(ly.t, (xa + xb) / 2, Math.max(ya, yb) + 0.4 * h, 0.7 * h, fy(p[1]), 1); }); }
      else if (s.kind === 'points') pts.forEach(p => { D.circle(l, X(p[0]), Y(cl(p[1])), 0.35 * h); });
      else if (s.kind === 'step') { const q = []; pts.forEach((p, j) => { if (j) q.push([X(p[0]), Y(cl(pts[j - 1][1]))]); q.push([X(p[0]), Y(cl(p[1]))]); }); if (q.length > 1) D.pline(l, q, false); }
      else if (pts.length > 1) D.pline(l, pts.map(p => [X(p[0]), Y(cl(p[1]))]), false);
      if (s.name) { const lx = x0 + w + 1.0 * h, ly2 = y0 + hg - (1.2 + 1.5 * ky++) * h; D.line(l, lx, ly2 + 0.3 * h, lx + 2.5 * h, ly2 + 0.3 * h); D.text(ly.t, lx + 3.1 * h, ly2, 0.8 * h, s.name); } });
    (o.limits || []).forEach(q => { if (!fin(q.y) || q.y < yr[0] || q.y > yr[1]) return; const l = q.color ? D.layer('CHART-LIMIT' + q.color, q.color, 'DASHED') : ly.lim; D.line(l, x0, Y(q.y), x0 + w, Y(q.y), D.ltype('DASHED')); if (q.label) D.text(l, x0 + 0.5 * h, Y(q.y) + 0.4 * h, 0.8 * h, q.label); });
    (o.vlines || []).forEach(q => { if (!fin(q.x)) return; D.line(ly.v, X(q.x), y0, X(q.x), y0 + hg, D.ltype('CENTER')); if (q.label) D.text(ly.v, X(q.x) + 0.3 * h, y0 + hg - 1.2 * h, 0.7 * h, q.label); });
    if (o.title) D.text(ly.t, x0, y0 + hg + 1.2 * h, 1.1 * h, o.title);
    if (o.xlab) D.text(ly.t, x0 + w, y0 - 3.2 * h, 0.8 * h, o.xlab, 2);
    if (o.ylab) D.text(ly.t, x0 - 5.2 * h, y0 + hg / 2, 0.8 * h, o.ylab, 1, 90);
    return { D, X, Y, plot: [x0, y0, x0 + w, y0 + hg], h, bottom: y0 - 4.4 * h, xr, yr, pick: (px) => xr[0] + (px - x0) / w * (xr[1] - xr[0]), title: o.title, file: o.file || 'chart' };
  }

  /* ---------- DOM: the viewer with title, readout, Download DXF ---------- */
  function css() {
    if (typeof document === 'undefined' || document.getElementById('sbg-css')) return;
    const st = document.createElement('style'); st.id = 'sbg-css';
    st.textContent = `.sbg{margin:0 0 10px;} .sbg-bar{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center;margin:2px 0 4px;font-family:var(--font-ui,Arial,sans-serif);font-size:9pt;}
      .sbg-bar b{font-size:10pt;} .sbg-read{flex:1 1 200px;color:#17212b;min-height:1.2em;} .sbg-box{border:1px solid var(--line,#c8d0da);background:#fff;} .sbg-note{font-size:8.5pt;color:#556;margin:2px 0 0;}
      .sbg-sel{pointer-events:none;} @media print{.sbg-box .sdx-view{height:auto!important;overflow:visible!important} .sdx-btns,.sbg-bar button{display:none!important} .sbg{break-inside:avoid} .sbg-box{border-color:#999}}`;
    document.head.appendChild(st);
  }
  const KEEP = {};   // opts.key -> { base: viewBox at fit, vb: [x, y, w, h] }

  function download(g, name) {
    const txt = g.D.toDXF({ ltscale: 1 }), chk = X_().validate(txt);
    if (!chk.ok) { alert(`The DXF file failed its structure check:\n${chk.errors.slice(0, 8).join('\n')}`); return false; }
    X_().download(txt, `${String(name || g.file || 'graphic').replace(/[^\w.-]+/g, '_')}.dxf`); return true;
  }

  function mount(el, build, opts) {
    opts = opts || {}; css(); let g;
    try { g = build(); } catch (e) { el.innerHTML = `<div class="alert err">The graphic could not be drawn: ${esc(e.message)}</div>`; return null; }
    if (!g || !g.D || (g.errors && g.errors.length)) { el.innerHTML = `<div class="note">${esc(g && g.errors ? g.errors.join(' ') : 'No graphic.')}</div>`; return null; }
    const D = g.D, b = D.bbox(), pad = 0.02 * Math.max(b[2] - b[0], b[3] - b[1]), ox = b[0] - pad, oy = b[3] + pad;   // toSVG's mapping
    el.innerHTML = `<div class="sbg"><div class="sbg-bar"><b>${esc(g.title || '')}</b><span class="sbg-read" aria-live="polite"></span><button type="button" data-sbg="dxf">Download DXF</button></div><div class="sbg-box"></div>${g.note ? `<p class="sbg-note">${esc(g.note)}</p>` : ''}</div>`;
    const read = el.querySelector('.sbg-read'), box = el.querySelector('.sbg-box');
    const H = { graphic: g, dxf: () => D.toDXF({ ltscale: 1 }) };
    const svg = X_().toSVG(D, { bg: '#fff', title: g.title }), mobile = window.innerWidth < 700;
    const bw0 = b[2] - b[0] + 2 * pad, bh0 = b[3] - b[1] + 2 * pad, cw = el.clientWidth || 900, maxPx = (opts.maxVh || (mobile ? 50 : 62)) / 100 * (window.innerHeight || 800);   // the box takes the drawing's shape
    const VW = H.viewer = X_().viewer(box, svg, { height: opts.height || `${Math.round(Math.max(180, Math.min(maxPx, cw * bh0 / bw0 + 4)))}px` });
    const sv = H.el = VW.el, ns = 'http://www.w3.org/2000/svg';
    // restore the zoom and pan of the same view (same fit box), by zooming about a chosen point (the viewer's API has no pan)
    const base = sv.getAttribute('viewBox'), kp = opts.key && KEEP[opts.key];
    const save = () => { if (opts.key) KEEP[opts.key] = { base, vb: sv.getAttribute('viewBox') }; };
    if (kp && kp.base === base && kp.vb !== base) { try {
      const v0 = base.split(/\s+/).map(Number), t = kp.vb.split(/\s+/).map(Number), f = v0[2] / t[2], r = sv.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && f > 1.0001) { const k = Math.max(v0[2] / r.width, v0[3] / r.height), gx = v0[0] - (r.width * k - v0[2]) / 2, gy = v0[1] - (r.height * k - v0[3]) / 2,
          px = (t[0] - v0[0] / f) / (1 - 1 / f), py = (t[1] - v0[1] / f) / (1 - 1 / f);
        VW.zoom(f, r.left + (px - gx) / k, r.top + (py - gy) / k); }
    } catch (e) { /* the view is just fit */ } }
    new MutationObserver(save).observe(sv, { attributes: true, attributeFilter: ['viewBox'] });
    // selected-station overlay (live, not in the DXF)
    const ov = document.createElementNS(ns, 'g'); ov.setAttribute('class', 'sbg-sel'); sv.appendChild(ov);
    const sw = Math.max(b[2] - b[0], b[3] - b[1]) / 1500;
    H.select = v => {
      ov.innerHTML = ''; if (v == null || !g.selMark) return; const m = g.selMark(v); if (!m || !fin(m.x)) return;
      const X = m.x - ox, y0 = oy - m.y0, y1 = oy - m.y1, e = (t, a) => { const n = document.createElementNS(ns, t); Object.keys(a).forEach(k => n.setAttribute(k, a[k])); return n; };
      ov.appendChild(e('line', { x1: X, x2: X, y1: y0, y2: y1, stroke: '#1f4fc4', 'stroke-width': sw * 3, 'stroke-opacity': 0.75 }));
      if (m.label) { const t = e('text', { x: X + sw * 8, y: y1 - sw * 4, 'font-size': (D.h || 2) * 0.9, fill: '#1f4fc4', 'font-weight': 700 }); t.textContent = m.label; ov.appendChild(t); }
    };
    if (opts.selected != null) H.select(opts.selected);
    // click (not drag) to select; hover for the readout (mouse)
    const at = ev => { const m = sv.getScreenCTM(); if (!m) return null; const p = sv.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; const q = p.matrixTransform(m.inverse()); return [q.x + ox, oy - q.y]; };
    let down = null; const show = v => { read.textContent = v != null && g.readout ? g.readout(v) : (opts.selected != null && g.readout ? g.readout(opts.selected) : ''); };
    sv.addEventListener('pointerdown', ev => { down = { x: ev.clientX, y: ev.clientY, t: Date.now() }; });
    sv.addEventListener('pointerup', ev => { if (!down || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 5 || Date.now() - down.t > 600) { down = null; return; } down = null;
      const p = at(ev); if (!p || !g.pick) return; const v = g.pick(p[0], p[1]); if (v == null) return; H.select(v); opts.selected = v; show(v); if (opts.onSelect) opts.onSelect(v); });
    sv.addEventListener('pointermove', ev => { if (ev.pointerType !== 'mouse' || ev.buttons) return; const p = at(ev); if (!p || !g.pick) return; const v = g.pick(p[0], p[1]); show(v); if (opts.onHover) opts.onHover(v); });
    sv.addEventListener('pointerleave', () => show(null));
    el.querySelector('[data-sbg="dxf"]').addEventListener('click', () => download(g, opts.file || g.file || g.title));
    show(null); H.sel = () => opts.selected;
    return H;
  }

  window.SBDGraphics = { elevation, ratioLayer, ratioColor, chart, mark, mount, download, css, newDrawing, niceStep, COL };
})();
