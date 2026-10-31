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
         location takes the stretch to the mid-points of its neighbours (or opts.x0 / x1 per item; opts.flag: a labelled item gets a flag above its band). Draws vertical hatching in the web in
         the ratio colour, a row under the girder with the values, and a legend. green < 0.9, amber 0.9 to 1.0 (1.0 passes), red > 1.0 or NG: the classes of the tabs' own tables.
     G.ratioColor(ratio, ok) -> AutoCAD colour index (3 green, 2 amber, 1 red)
     G.chart(opts) -> C: a drafted XY plot (axes, grid layer, series, limit line). opts: { D (draw into an existing drawing, else a new
         one), at: [x, y] (lower left of the plot area), w, hgt (plot area size), h (text height), title, xlab, ylab, xr: [min, max], yr,
         xstep, ystep, series: [{ name, pts: [[x, y]], kind: 'line' | 'step' | 'bars' | 'points', color (AutoCAD index), lt }],
         cats: [labels] (bars: x = category number, 0-based), limits: [{ y, label, color }], vlines: [{ x, label, color }], fx, fy (formats) }
         C = { D, X(x), Y(y), pick(px, py) -> x, plot: [x0, y0, x1, y1], h, bottom }.
     G.mark(E, label, value) -> adds the selected-station layer (SEL) to E's drawing: used when the graphic is built for a given selection
     G.mount(el, build, opts) -> H: draws a graphic into el with a title, a Download DXF button, the zoom / pan viewer and a legend note.
         build() returns { D, title, file, note, pick(x, y) -> value, selMark(value) -> { x, y0, y1, segs: [[y0, y1] ...] (optional: one line per band), label }, readout(value) -> text }.
         opts: { key (keeps the zoom and pan across re-draws of the same view), height, selected, onSelect(value), onHover(value), print note }.
         Clicking (not dragging) a location calls opts.onSelect(pick(x, y)); H.select(value) moves the highlight without rebuilding
         (live overlay, not in the DXF); hovering shows readout(value) (mouse only).
         H = { select(v), viewer, el, graphic, dxf() }
     Text hierarchy and layout helpers (polish PR): G.TXT = { title 1.3, note 0.85, label 0.8, small 0.72, dim 0.72 } x the drawing's text height h (h is ELEVH = 2.4 % of the length
         for a girder elevation); no text is smaller than 0.72 h and the dimension text is G.TXT.dim x h (ticks scale with it). G.textW(s, hh) the Arial advance width; G.wrap(s, n) lines
         of at most n characters; G.stack(items, o) rows for left-aligned flags on leaders; G.declutter(items, o) free baselines for labels; G.mergeBands(items, { x0, x1 }) neighbours of
         one colour class as one band (ratioLayer opts.flag marks the band of the largest ratio); G.tightSvg(D, o) the static SVG cut to the drawn extents (Report figure).
         chart(): o.legend 'below' puts the legend in rows under the plot (automatic for long plots), o.legendExtra [{ text, arrow }], a line leaving the scale is cut at the top edge and
         shown by a dashed cap and an arrow; o.vlabel 'bottom'. mount(): the view is fitted to the drawing's drawn extents (getBBox) and the frame takes its aspect (200 px to 88 % of the window).
     G.download(graphic, name) saves the DXF (validated first). G.css() adds the styles (called by mount).
   Fix log: fixlog/steel-bridge.md. */
(function () {
  'use strict';
  const X_ = () => window.SharedDxf;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const TXT = 0.10;   // SBDDrawings.TXT: plotted text height; D.k = h / TXT keeps the linetypes the Drawings tab's
  /* the text hierarchy of every tab graphic, in units of the drawing's text height h (h is a fixed fraction of the drawing's long side: ELEVH for the girder elevations):
     title, notes (subtitles, remarks), labels (the usual text) and small labels, dimension text (never larger than a label) */
  const TXT_ = { title: 1.3, note: 0.85, label: 0.8, small: 0.72, dim: 0.72 };
  const ELEVH = 0.024;   // text height of a girder elevation as a fraction of its length (long thin drawings: text legible at fit in a frame the width of the page)
  const MINTXT = 0.72;   // smallest text height as a fraction of the drawing's text height h
  const COL = { green: 3, amber: 2, red: 1, ok: 3, sel: 5, gray: 8, light: 9, plate: 4, web: 5, stiff: 30 };

  /* a new drawing at text height h (drawing units): the linetypes scaled to the text, as the Drawings tab does */
  function newDrawing(h, prefix) {
    const D = X_().drawing({ prefix: prefix == null ? 'S-' : prefix }); D.h = h; D.k = h / TXT;
    // no text smaller than MINTXT of the drawing's text height (engineer's rule: readable at the page width without zooming); every text of every graphic is made by D.text
    const text0 = D.text; D.text = (l, x, y, hh, s2, j, rot) => text0(l, x, y, Math.max(hh, MINTXT * h), s2, j, rot);
    // dimensions: their text is TXT.dim * h (no larger than the labels) and their ticks, extension lines and offsets scale with it (the dimension style scales with D.k)
    const dim0 = D.dim; D.dim = (l, p1, p2, b, ang, txt) => { const h0 = D.h, k0 = D.k; D.h = h0 * TXT_.dim; D.k = k0 * TXT_.dim; try { return dim0(l, p1, p2, b, ang, txt); } finally { D.h = h0; D.k = k0; } };
    return D;
  }
  /* textW(s, hh): the width of a text of height hh as the preview draws it (Arial advance widths; the shared bbox() estimates 0.9 of the height per character, too wide) */
  const AW = ('278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278' + ' 556'.repeat(10) + ' 278 278 584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611'
    + ' 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 556 500 722 500 500 500 334 260 334 584').split(' ').map(Number);   // ASCII 32..126
  const textW = (s2, hh) => { let w = 0; String(s2 == null ? '' : s2).replace(/%%[dcp]/g, 'o').split('').forEach(c => { const k = c.charCodeAt(0) - 32; w += k >= 0 && k < AW.length ? AW[k] : 600; }); return w / 1000 * hh; };
  /* stack(items, o): rows for labels set left-aligned at their anchor x (items: [{ x, w }], w the text width). The rightmost label takes row 0; each label to its left takes
     the lowest row where it does not touch a label already there (clearance o.gap), so a vertical leader at its x crosses no other label. Returns the rows in the order of items. */
  function stack(items, o) {
    const gap = (o && o.gap) || 0, rows = [], out = [];
    items.map((q, i) => i).sort((a, b) => items[b].x - items[a].x || a - b).forEach(i => { const q = items[i]; let r = 0;
      for (; ; r++) { const R = rows[r] || (rows[r] = []); if (R.every(b => q.x + q.w + gap <= b.x || q.x >= b.x + b.w + gap)) { R.push(q); out[i] = r; break; } } });
    return out;
  }
  /* declutter(items, o): baselines for labels [{ x, y, w, hh }] set left-aligned at x, each at the lowest baseline from y (o.dir -1: highest down from y) in steps of 1.25 hh
     where its box touches no label placed before it (the rightmost first) and none of the boxes o.obst ([x0, y0, x1, y1]); returns the baselines in the order of items */
  function declutter(items, o) {
    o = o || {}; const gap = o.gap || 0, dir = o.dir || 1, placed = (o.obst || []).slice(), out = [];
    items.map((q, i) => i).sort((a, b) => items[b].x - items[a].x || a - b).forEach(i => { const q = items[i];
      for (let k = 0; k < 400; k++) { const yb = q.y + dir * k * 1.25 * q.hh, bx = [q.x, yb - 0.1 * q.hh, q.x + q.w, yb + 0.85 * q.hh];
        if (k === 399 || placed.every(b => bx[2] + gap <= b[0] || bx[0] >= b[2] + gap || bx[3] <= b[1] || bx[1] >= b[3])) { placed.push(bx); out[i] = yb; break; } } });
    return out;
  }
  /* wrap(s, n): the words of s in lines of at most n characters */
  function wrap(s, n) { const out = []; let cur = ''; String(s == null ? '' : s).split(/\s+/).forEach(w => { if (cur && (cur + ' ' + w).length > n) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }); if (cur) out.push(cur); return out; }
  /* nice step for a range split in about n parts */
  function niceStep(range, n) {
    const raw = Math.abs(range) / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw || 1))), m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }
  const ratioColor = (r, ok) => (ok === false || !fin(r) || r > 1 + 1e-9 ? COL.red : r >= 0.9 ? COL.amber : COL.green);
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
    const h = opts.h || Math.max(len, 8 * Dmax) * ELEVH, D = newDrawing(h);
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
      // plate sizes: a label that does not fit its segment is turned (web), staggered one row (flanges) or left out; the Drawings tab has every size
      const tw0 = (str, hh) => textW(str, hh), wl = `${X_().frac(+s.D)} x ${X_().frac(+s.tw)} WEB`, hw = h * 0.72, cx = (a + b) / 2;
      // the web label sits in the widest stretch of the segment clear of the bearings (their stiffener marks and labels are on the web)
      let gaps = [[a, b]]; sup.forEach(x => { const c = X(x), r0 = 1.6 * h; gaps = gaps.flatMap(([p, q]) => (c + r0 <= p || c - r0 >= q ? [[p, q]] : [[p, c - r0], [c + r0, q]].filter(w => w[1] > w[0]))); });
      const gp = gaps.reduce((m, w) => (w[1] - w[0] > m[1] - m[0] ? w : m), gaps[0] || [a, a]), gx = (gp[0] + gp[1]) / 2;
      if (tw0(wl, hw) <= (gp[1] - gp[0]) * 0.96) D.text(ly.t, gx, yB + d * 0.5, hw, wl, 1); else if (tw0(wl, hw) <= d * 0.9 && gp[1] - gp[0] > 1.2 * hw) D.text(ly.t, gx + hw * 0.35, yB + d * 0.5 - tw0(wl, hw) / 2, hw, wl, 0, 90);
      const tl = `${X_().frac(+s.topB)} x ${X_().frac(+s.topT)}`, bl = `${X_().frac(+s.botB)} x ${X_().frac(+s.botT)}`, st2 = tw0(tl, hw) > (b - a) * 0.96 ? (k % 2 ? 1 : 0) : 0;
      if (tw0(tl, hw) <= (b - a) * 0.96 * (st2 ? 2 : 1)) D.text(ly.t, cx, yB + d + +s.topT * vex + (0.4 + 1.1 * st2) * h, hw, tl, 1);
      if (tw0(bl, hw) <= (b - a) * 0.96 * (st2 ? 2 : 1)) D.text(ly.t, cx, yB - +s.botT * vex - (1.0 + 1.1 * st2) * h, hw, bl, 1); });
    // cross-frame lines (CF) and field splices (FS)
    cf.forEach(x => { if (x < L0 - 1e-6 || x > L1 + 1e-6) return; D.line(ly.cf, X(x), yB - bmax, X(x), yB + E.Yweb(x) + tmax, D.ltype('CENTER')); });
    if (cf.length) D.text(ly.t, X(cf[Math.floor(cf.length / 2)]) + 0.3 * h, yB + E.Yweb(cf[Math.floor(cf.length / 2)]) * 0.2, h * 0.6, 'CF', 0);
    spl.forEach((x, k) => { D.line(ly.s, X(x), yB - bmax - h, X(x), yB + E.Yweb(x) + tmax + h); D.text(ly.t, X(x), yB + E.Yweb(x) + tmax + 1.6 * h, h * 0.8, `FS${k + 1}`, 1); });
    // supports (bearings as triangles) with the support number
    sup.forEach((x, k) => { const tb = segAt(x).botT * vex; D.pline(ly.b, [[X(x), yB - tb], [X(x) - h * 0.9, yB - tb - h * 1.6], [X(x) + h * 0.9, yB - tb - h * 1.6]], true); D.text(ly.t, X(x), yB - tb - h * 2.9, h * 0.7, `S${k + 1}`, 1); });
    // span dimensions
    let low = yB - bmax - 4.6 * h;
    sup.slice(1).forEach((x, k) => D.dimH(ly.d, X(sup[k]), X(x), low, low + 1.0 * h, `SPAN ${k + 1} = <>`));
    low -= 3.2 * h; let axisY = low;
    // stations axis: ticks at a nice step, grid ticks on the GRID layer
    if (opts.axis !== false) {
      const st = niceStep(L1 - L0, 10), t0 = Math.ceil(L0 / st - 1e-9) * st; D.line(ly.axis, X(L0), low, X(L1), low);
      for (let t = t0; t <= L1 + 1e-9; t += st) { D.line(ly.axis, X(t), low, X(t), low - 0.5 * h); D.text(ly.t, X(t), low - 1.7 * h, h * 0.8, nf(t, st < 1 ? 1 : 0), 1);
        D.line(ly.grid, X(t), low, X(t), yB - bmax - 0.2 * h, D.ltype('DASHED')); }
      D.text(ly.t, X(L1), low - 3.2 * h, h * 0.8, 'STATION, FT (FROM CL BRG. ABUT. 1)', 2); low -= 5.4 * h;
    }
    let lowEdge = low; const elTop = E.yTop;   // the elevation band of the selected-station line: from the stations axis up to the top of the elevation
    E.bands = [];   // the plot bands [y0, y1] added under the elevation (E.band): the selected-station line is drawn in these, not through the tables and legends between them
    E.band = (y0, y1) => { if (fin(y0) && fin(y1)) E.bands.push([Math.min(y0, y1), Math.max(y0, y1)]); };
    E.alloc = height => { const top = lowEdge - 0.6 * h; lowEdge = top - height; return top; };
    E.pick = (x, y) => Math.max(L0, Math.min(L1, x / 12));
    // title and subtitle above everything drawn (E.yTop); the subtitle is wrapped to the width of the girder
    E.title = (t, sub) => { const nch = Math.max(30, Math.floor(len / (0.8 * h * 0.6))), ls = sub ? wrap(sub, nch) : [], y0 = E.yTop + 4.2 * h;
      ls.forEach((q, i) => D.text(ly.t, X(L0), y0 + (ls.length - 1 - i) * 1.1 * h, h * 0.8, q)); D.text(ly.t, X(L0), y0 + ls.length * 1.1 * h + 0.4 * h, h * 1.3, t); };
    let selLow = null; E.freeze = () => { selLow = lowEdge; };   // the selected-station line runs down to here (not through tables drawn under the diagrams)
    // the label of the selected station sits to the right of its line; where a field splice tag (FSk, centred on its splice, just above the web) falls under that label, the line (and the label with it) is carried up above the tag
    E.selMark = ft => { let top = elTop + 1.7 * h; const lw = textW(`STA ${nf(ft, 1)} FT`, h * 0.9), lx0 = X(ft) + 0.8 * h, lx1 = lx0 + lw;
      spl.forEach((x, k) => { const fw = textW(`FS${k + 1}`, h * 0.8) / 2 + 0.3 * h, tagTop = yB + E.Yweb(x) + tmax + 1.6 * h + 0.8 * h; if (X(x) + fw > lx0 && X(x) - fw < lx1 && tagTop + 0.3 * h > top) top = tagTop + 0.3 * h; });
      const segs = [[axisY, top], ...E.bands.map(b => [b[0] - 0.3 * h, b[1] + 0.3 * h])];
      return { x: X(ft), y0: Math.min(...segs.map(q => q[0])), y1: top, segs, label: `STA ${nf(ft, 1)} FT` }; };
    return E;
  }

  /* ratio layer (green < 0.9, amber 0.9 to 1.0 (1.0 passes), red > 1.0 or NG: the classes of the tabs' own tables) */
  function ratioLayer(E, items, opts) {
    opts = opts || {}; if (!E || !E.D || !items || !items.length) return { legend: [], cols: [] };
    const D = E.D, h = E.h, X = E.X, its = items.filter(q => fin(q.x)).slice().sort((a, b) => a.x - b.x), cols = [];
    const lay = {}; [[COL.green, 'RATIO-OK'], [COL.amber, 'RATIO-WARN'], [COL.red, 'RATIO-NG']].forEach(([c, n]) => { lay[c] = D.layer(n, c); });
    const yb = E.yB, row = E.alloc(3.4 * h), txt = E.ly.t;
    its.forEach((q, i) => {
      const a = fin(q.x0) ? q.x0 : i ? (its[i - 1].x + q.x) / 2 : E.L0, b = fin(q.x1) ? q.x1 : i < its.length - 1 ? (q.x + its[i + 1].x) / 2 : E.L1, c = ratioColor(q.ratio, q.ok), l = lay[c];
      cols.push({ x: q.x, color: c, x0: a, x1: b });
      if (opts.hatch !== false) { const sp = 1.1 * h; for (let x = X(a) + sp / 2; x < X(b); x += sp) { const ft = x / 12; D.line(l, x, yb + 0.02 * h, x, yb + E.Yweb(ft) - 0.02 * h); } }
      D.rect(l, X(a), row - 2.0 * h, X(b), row); D.line(l, X(q.x), row, X(q.x), row + (q.label && opts.flag ? 1.6 : 0.5) * h);
      const bw = X(b) - X(a), pv = q.ok === false || !fin(q.ratio) ? 'NG' : nf(q.ratio, 2);
      if (bw > textW(pv, 0.8 * h) + 0.6 * h) D.text(txt, X((a + b) / 2), row - 1.3 * h, h * 0.8, pv, 1);
      if (q.label && opts.flag) D.text(txt, X(q.x) + 0.3 * h, row + 0.9 * h, h * 0.8, `${q.label}: ${pv}`, 0);   // opts.flag: the label is the flag of a marked (governing) band, on a leader
      else if (q.label && bw > textW(String(q.label), 0.72 * h) + 0.6 * h) D.text(txt, X(q.x), row + 0.7 * h, h * 0.72, q.label, 1);
    });
    // legend (in the drawing, so it is in the DXF): at the left of the row
    const lg = [[COL.green, '< 0.90'], [COL.amber, '0.90 TO 1.00'], [COL.red, '> 1.00 OR NG']], y = row - 2.0 * h - 2.2 * h; let x = X(E.L0);
    const wh = (opts.what || 'RATIO') + ':'; D.text(txt, x, y, h * 0.8, wh); x += textW(wh, 0.8 * h) + 1.6 * h;
    lg.forEach(([c, t]) => { D.rect(lay[c], x, y - 0.1 * h, x + 1.4 * h, y + 0.9 * h); D.text(txt, x + 1.9 * h, y, h * 0.8, t); x += 1.9 * h + textW(t, 0.8 * h) + 1.6 * h; });
    E.alloc(2.6 * h);
    return { legend: lg.map(q => q[1]), cols };
  }

  /* mergeBands(items, o): the ratio items [{ x, ratio, ok, label }] with neighbours of the same colour class made one band (x0, x1 = its edges, the mid-points to the neighbours of the
     other class, o.x0 / o.x1 at the ends); a band is placed at (and takes the ratio of) its largest item, and only the band of the largest ratio keeps its label. For ratioLayer. */
  function mergeBands(items, o) {
    const its = items.filter(q => fin(q.x)).slice().sort((a, b) => a.x - b.x); if (!its.length) return [];
    const rv = q => (fin(q.ratio) ? q.ratio : Infinity), edge = i => (i <= 0 ? o.x0 : i >= its.length ? o.x1 : (its[i - 1].x + its[i].x) / 2), gs = [];
    its.forEach((q, i) => { const c = ratioColor(q.ratio, q.ok), g = gs[gs.length - 1]; if (g && g.c === c) { g.last = i; if (rv(q) > rv(g.gov)) g.gov = q; } else gs.push({ c, first: i, last: i, gov: q }); });
    const top = gs.reduce((m, g) => (rv(g.gov) > rv(m.gov) ? g : m), gs[0]);
    return gs.map(g => ({ x: g.gov.x, x0: edge(g.first), x1: edge(g.last + 1), ratio: g.gov.ratio, ok: g.gov.ok, label: g === top ? g.gov.label : '' }));
  }
  /* the selected-station layer in the drawing itself (for a graphic built for a given selection) */
  function mark(E, label, ft) {
    if (!E || !E.D || !fin(ft)) return; const m = E.selMark(ft), D = E.D, l = E.ly.sel;
    (m.segs || [[m.y0, m.y1]]).forEach(q => D.line(l, m.x, q[0], m.x, q[1])); D.pline(l, [[m.x, m.y1 - 0.4 * E.h], [m.x - 0.5 * E.h, m.y1 + 0.3 * E.h], [m.x + 0.5 * E.h, m.y1 + 0.3 * E.h]], true);
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
    let ysT = o.ystep || niceStep(yr[1] - yr[0], 5); while (ysT / (yr[1] - yr[0]) * hg < 1.7 * 0.8 * h && ysT < (yr[1] - yr[0])) ysT = niceStep(ysT * 1.9, 1);   // tick labels at least a line and a half apart
    const xsT = o.xstep || niceStep(xr[1] - xr[0], 8);
    for (let t = Math.ceil(yr[0] / ysT - 1e-9) * ysT; t <= yr[1] + 1e-9; t += ysT) { D.line(ly.grid, x0, Y(t), x0 + w, Y(t)); D.line(ly.axis, x0 - 0.4 * h, Y(t), x0, Y(t)); D.text(ly.t, x0 - 0.8 * h, Y(t) - 0.3 * h, 0.8 * h, fy(t), 2); }
    if (cats) cats.forEach((c, i) => { D.line(ly.axis, X(i), y0, X(i), y0 - 0.4 * h); D.text(ly.t, X(i), y0 - 1.6 * h, 0.8 * h, c, 1); });
    else for (let t = Math.ceil(xr[0] / xsT - 1e-9) * xsT; t <= xr[1] + 1e-9; t += xsT) { D.line(ly.grid, X(t), y0, X(t), y0 + hg); D.line(ly.axis, X(t), y0, X(t), y0 - 0.4 * h); D.text(ly.t, X(t), y0 - 1.6 * h, 0.8 * h, fx(t), 1); }
    D.rect(ly.axis, x0, y0, x0 + w, y0 + hg);
    if (yr[0] < 0 && yr[1] > 0) D.line(ly.axis, x0, Y(0), x0 + w, Y(0));
    // series
    const nS = S.filter(s => s.kind === 'bars').length, ent = []; let bi = 0;
    S.forEach((s, i) => { const l = D.layer('CHART-S' + (i + 1), s.color || [5, 1, 3, 30, 6, 4][i % 6], s.lt), pts = s.pts.filter(p => fin(p[0]) && fin(p[1]));
      if (s.kind === 'bars') { const bw = 0.7 / Math.max(1, nS) * (w / (xr[1] - xr[0])), off = (bi - (nS - 1) / 2) * bw; bi++;
        pts.forEach(p => { const xa = X(p[0]) + off - bw / 2, xb = xa + bw, ya = Y(cl(0)), yb = Y(cl(p[1])); D.rect(l, xa, Math.min(ya, yb), xb, Math.max(ya, yb)); D.text(ly.t, (xa + xb) / 2, Math.max(ya, yb) + 0.4 * h, 0.7 * h, fy(p[1]), 1); }); }
      else if (s.kind === 'points') pts.forEach(p => { D.circle(l, X(p[0]), Y(cl(p[1])), 0.35 * h); });
      else if (s.kind === 'step') { const q = []; pts.forEach((p, j) => { if (j) q.push([X(p[0]), Y(cl(pts[j - 1][1]))]); q.push([X(p[0]), Y(cl(p[1]))]); }); if (q.length > 1) D.pline(l, q, false); }
      else if (pts.length > 1) {
        // a line that leaves the scale (above yr[1]) is cut at the top edge; the part outside is shown by a dashed cap along the edge with an arrow up (not a flat run at the edge)
        const top = yr[1], inn = p => p[1] <= top, run = [], caps = []; let capA = null, cur = [];
        pts.forEach((p, j) => { const q = pts[j - 1], pin = inn(p), qin = j ? inn(q) : null;
          if (!j) { if (pin) cur = [[X(p[0]), Y(cl(p[1]))]]; else capA = p[0]; return; }
          if (qin && pin) cur.push([X(p[0]), Y(cl(p[1]))]);
          else if (qin && !pin) { const xc = q[0] + (top - q[1]) / (p[1] - q[1]) * (p[0] - q[0]); cur.push([X(xc), Y(top)]); run.push(cur); cur = []; capA = xc; }
          else if (!qin && pin) { const xc = q[0] + (top - q[1]) / (p[1] - q[1]) * (p[0] - q[0]); caps.push([capA, xc]); capA = null; cur = [[X(xc), Y(top)], [X(p[0]), Y(cl(p[1]))]]; } });
        if (cur.length) run.push(cur); if (capA != null) caps.push([capA, pts[pts.length - 1][0]]);
        run.forEach(q => { if (q.length > 1) D.pline(l, q, false); });
        caps.forEach(([a, b]) => { const xa = X(a), xb = X(b), yy = Y(top); if (xb - xa > 0.3 * h) D.line(l, xa, yy - 0.45 * h, xb, yy - 0.45 * h, D.ltype('DASHED'));
          [(xa + xb) / 2].forEach(xm => D.pline(l, [[xm, yy], [xm - 0.5 * h, yy - 1.1 * h], [xm + 0.5 * h, yy - 1.1 * h]], true)); }); }
      if (s.name) { ent.push({ l, name: s.name, ltype: s.lt }); } });
    // the legend: at the right of the plot, or (long plots) in a row under it, wrapping; o.legendExtra: [{ text, arrow }] further entries (an arrow glyph for the capped scale)
    (o.legendExtra || []).forEach(q => ent.push({ l: ly.axis, name: q.text, arrow: q.arrow }));
    const lgBelow = o.legend ? o.legend === 'below' : ent.length && (3.1 * h + Math.max(...ent.map(q => textW(q.name, 0.8 * h)))) > 0.12 * w; let bottom = y0 - 4.4 * h;
    if (lgBelow) { let lx = x0, ry = y0 - 5.8 * h; ent.forEach(q => { const wi = 3.1 * h + textW(q.name, Math.max(0.8 * h, MINTXT * D.h)) + 2 * h; if (lx > x0 && lx + wi > x0 + w) { lx = x0; ry -= 1.5 * h; }
        if (q.arrow) D.pline(q.l, [[lx + 1.25 * h, ry + 0.9 * h], [lx + 0.75 * h, ry - 0.1 * h], [lx + 1.75 * h, ry - 0.1 * h]], true); else D.line(q.l, lx, ry + 0.3 * h, lx + 2.5 * h, ry + 0.3 * h, q.ltype ? D.ltype(q.ltype) : undefined);
        D.text(ly.t, lx + 3.1 * h, ry, 0.8 * h, q.name); lx += wi; }); bottom = ry - 1.0 * h; }
    else ent.forEach((q, k) => { const lx = x0 + w + 1.0 * h, ly2 = y0 + hg - (1.2 + 1.5 * k) * h; if (q.arrow) D.pline(q.l, [[lx + 1.25 * h, ly2 + 0.9 * h], [lx + 0.75 * h, ly2 - 0.1 * h], [lx + 1.75 * h, ly2 - 0.1 * h]], true); else D.line(q.l, lx, ly2 + 0.3 * h, lx + 2.5 * h, ly2 + 0.3 * h, q.ltype ? D.ltype(q.ltype) : undefined); D.text(ly.t, lx + 3.1 * h, ly2, 0.8 * h, q.name); });
    (o.limits || []).forEach(q => { if (!fin(q.y) || q.y < yr[0] || q.y > yr[1]) return; const l = q.color ? D.layer('CHART-LIMIT' + q.color, q.color, 'DASHED') : ly.lim; D.line(l, x0, Y(q.y), x0 + w, Y(q.y), D.ltype('DASHED')); if (q.label) D.text(l, x0 + 0.5 * h, Y(q.y) + 0.4 * h, 0.8 * h, q.label); });
    (o.vlines || []).forEach(q => { if (!fin(q.x)) return; D.line(ly.v, X(q.x), y0, X(q.x), y0 + hg, D.ltype('CENTER')); if (q.label) D.text(ly.v, X(q.x) + 0.3 * h, o.vlabel === 'bottom' ? y0 + 0.5 * h : y0 + hg - 1.2 * h, 0.7 * h, q.label); });
    if (o.title) D.text(ly.t, x0, y0 + hg + 1.2 * h, 1.1 * h, o.title);
    if (o.xlab) D.text(ly.t, x0 + w, y0 - 3.2 * h, 0.8 * h, o.xlab, 2);
    if (o.ylab) D.text(ly.t, x0 - 5.2 * h, y0 + hg / 2, 0.8 * h, o.ylab, 1, 90);
    return { D, X, Y, plot: [x0, y0, x0 + w, y0 + hg], h, bottom, xr, yr, pick: (px) => xr[0] + (px - x0) / w * (xr[1] - xr[0]), title: o.title, file: o.file || 'chart' };
  }

  /* ---------- DOM: the viewer with title, readout, Download DXF ---------- */
  function css() {
    if (typeof document === 'undefined' || document.getElementById('sbg-css')) return;
    const st = document.createElement('style'); st.id = 'sbg-css';
    st.textContent = `.sbg{margin:0 0 10px;} .sbg-bar{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center;margin:2px 0 4px;font-family:var(--font-ui,Arial,sans-serif);font-size:9pt;}
      .sbg-bar b{font-size:10pt;} .sbg-read{flex:1 1 200px;color:#17212b;min-height:1.2em;} .sbg-box{border:1px solid var(--line,#c8d0da);background:#fff;} .sbg-note{font-size:8.5pt;color:#556;margin:2px 0 0;}
      .sbg-sel{pointer-events:none;} .sbg-hint{display:none;font-size:8.5pt;color:#556;margin:2px 0 0;font-family:var(--font-ui,Arial,sans-serif);} @media (max-width:700px){.sbg-hint{display:block;}}
      @media print{.sbg-hint{display:none!important} .sbg-box .sdx-view{height:auto!important;overflow:visible!important} .sdx-btns,.sbg-bar button{display:none!important} .sbg{break-inside:avoid} .sbg-box{border-color:#999}}`;
    document.head.appendChild(st);
  }
  /* measureFit(svg): [x, y, w, h], the viewBox that holds exactly what the SVG draws (the browser's own getBBox, text as drawn) plus a margin of 1.5 % of the long
     side; null when it cannot be measured (no DOM): the shared preview's own window is then used */
  function measureFit(svg) {
    if (typeof document === 'undefined' || !document.body) return null; let t = null;
    try {
      t = document.createElement('div'); t.style.cssText = 'position:absolute;left:-20000px;top:0;width:1200px;height:900px;visibility:hidden;pointer-events:none'; t.innerHTML = svg;
      document.body.appendChild(t); const bb = t.querySelector('svg').getBBox(); if (!(bb.width > 0 && bb.height > 0)) return null;
      const m = 0.015 * Math.max(bb.width, bb.height), r = [bb.x - m, bb.y - m, bb.width + 2 * m, bb.height + 2 * m]; return r.every(Number.isFinite) ? r : null;
    } catch (e) { return null; } finally { if (t && t.parentNode) t.parentNode.removeChild(t); }
  }
  /* tightSvg(D, o): the SVG preview of drawing D (SharedDxf.toSVG with o) with its viewBox cut to the extents of what is drawn, the text measured with the Arial advance widths
     (not the shared bbox()'s estimate of 0.9 of the height per character) plus 1.5 % margin: for the static figures of the report, where nothing can be measured in a browser */
  function tightSvg(D, o) {
    const Xd = X_(), svg = Xd.toSVG(D, o), i0 = (o && o.i0) || 0, i1 = o && o.i1 != null ? o.i1 : D.E.length, b = D.bbox(i0, i1); if (!isFinite(b[0])) return svg;
    const pad = o && o.pad != null ? o.pad : 0.02 * Math.max(b[2] - b[0], b[3] - b[1]), x0 = b[0] - pad, y1 = b[3] + pad; let ex = [Infinity, Infinity, -Infinity, -Infinity];
    const a = (x, y) => { if (fin(x) && fin(y)) { ex = [Math.min(ex[0], x), Math.min(ex[1], y), Math.max(ex[2], x), Math.max(ex[3], y)]; } };
    const txt = e => { const w = textW(e.s, e.hh), r = (e.rot || 0) * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r), sh = e.j === 2 ? -w : e.j === 1 ? -w / 2 : 0, ax = e.pts[0][0], ay = e.pts[0][1];
      [[sh, -0.2 * e.hh], [sh + w, -0.2 * e.hh], [sh + w, 0.85 * e.hh], [sh, 0.85 * e.hh]].forEach(([u, v]) => a(ax + u * c - v * sn, ay + u * sn + v * c)); };
    D.E.slice(i0, i1).forEach(e => { if (e.t === 'TEXT') txt(e); else if (e.t === 'DIM') Xd.dimGeo(e).g.forEach(q => (q.t === 'TEXT' ? txt(q) : q.pts.forEach(p => a(p[0], p[1])))); else if (e.t === 'CIRCLE' || e.t === 'ARC') { a(e.pts[0][0] - e.r, e.pts[0][1] - e.r); a(e.pts[0][0] + e.r, e.pts[0][1] + e.r); } else e.pts.forEach(p => a(p[0], p[1])); });
    if (!fin(ex[0])) return svg; const m = 0.015 * Math.max(ex[2] - ex[0], ex[3] - ex[1]), vb = [ex[0] - m - x0, y1 - (ex[3] + m), ex[2] - ex[0] + 2 * m, ex[3] - ex[1] + 2 * m];
    return svg.replace(/viewBox="[^"]*"/, 'viewBox="' + vb.map(v => +v.toFixed(3)).join(' ') + '"');
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
    el.innerHTML = `<div class="sbg"><div class="sbg-bar"><b>${esc(g.title || '')}</b><span class="sbg-read" aria-live="polite"></span><button type="button" data-sbg="dxf">Download DXF</button></div><div class="sbg-box"></div><p class="sbg-hint">Pinch or double-tap to zoom; drag to pan.</p>${g.note ? `<p class="sbg-note">${esc(g.note)}</p>` : ''}</div>`;
    const read = el.querySelector('.sbg-read'), box = el.querySelector('.sbg-box');
    const H = { graphic: g, dxf: () => D.toDXF({ ltscale: 1 }) };
    let svg = X_().toSVG(D, { title: g.title }); const mobile = window.innerWidth < 700;
    // fit to the drawing: the extents the browser measures (the text as drawn, not the shared bbox's wide estimate of 0.9 of the height per character) plus a small margin;
    // the frame takes the shape of that window (height from the aspect, between 200 px and the maximum), so the fit view fills the frame width
    const fit = measureFit(svg);
    if (fit) svg = svg.replace(/viewBox="[^"]*"/, `viewBox="${fit.map(v => +v.toFixed(3)).join(' ')}"`);
    const bw0 = fit ? fit[2] : b[2] - b[0] + 2 * pad, bh0 = fit ? fit[3] : b[3] - b[1] + 2 * pad, cw = el.clientWidth || 900, maxPx = (opts.maxVh || (mobile ? 62 : 88)) / 100 * (window.innerHeight || 800);
    const VW = H.viewer = X_().viewer(box, svg, { height: opts.height || `${Math.round(Math.max(200, Math.min(maxPx, cw * bh0 / bw0 + 4)))}px` });
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
    // phone width: start at a reading scale (the smaller text of the figure at 9 px or more, at most 8 x), at the top left of the drawing, and pan from there; the desktop view
    // and the print are unchanged (the full view is restored for printing)
    if (mobile && !(kp && kp.base === base && kp.vb !== base)) { try {
      const v0 = base.split(/\s+/).map(Number), r = sv.getBoundingClientRect(), fs = [...sv.querySelectorAll('text')].map(t => +t.getAttribute('font-size')).filter(q => q > 0).sort((a, b) => a - b);
      if (r.width > 0 && r.height > 0 && fs.length) { const k = Math.max(v0[2] / r.width, v0[3] / r.height), f = Math.min(8, 9 * k / fs[Math.floor(fs.length * 0.15)]);
        if (f > 1.05) { VW.zoom(f, r.left, r.top); const bv = sv.getAttribute('viewBox'); H.phoneView = bv;
          let cur = null; window.addEventListener('beforeprint', () => { if (sv.isConnected) { cur = sv.getAttribute('viewBox'); sv.setAttribute('viewBox', base); } }); window.addEventListener('afterprint', () => { if (sv.isConnected && cur) sv.setAttribute('viewBox', cur); }); } }
    } catch (e) { /* the view is just fit */ } }
    new MutationObserver(save).observe(sv, { attributes: true, attributeFilter: ['viewBox'] });
    // selected-station overlay (live, not in the DXF)
    const ov = document.createElementNS(ns, 'g'); ov.setAttribute('class', 'sbg-sel'); sv.appendChild(ov);
    const sw = Math.max(b[2] - b[0], b[3] - b[1]) / 1500;
    H.select = v => {
      ov.innerHTML = ''; if (v == null || !g.selMark) return; const m = g.selMark(v); if (!m || !fin(m.x)) return;
      const X = m.x - ox, y1 = oy - m.y1, e = (t, a) => { const n = document.createElementNS(ns, t); Object.keys(a).forEach(k => n.setAttribute(k, a[k])); return n; };
      (m.segs || [[m.y0, m.y1]]).forEach(q => ov.appendChild(e('line', { x1: X, x2: X, y1: oy - q[0], y2: oy - q[1], stroke: '#1f4fc4', 'stroke-width': sw * 3, 'stroke-opacity': 0.75 })));
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

  window.SBDGraphics = { elevation, ratioLayer, ratioColor, chart, mark, mount, download, css, newDrawing, niceStep, mergeBands, tightSvg, TXT: TXT_, wrap, textW, stack, declutter, COL };
})();
