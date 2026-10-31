/* apps/steel-bridge/engine/tabgraphics-b.js — the graphics of the output tabs Shear & stiffeners, Fatigue & studs, Cross-frames, Welds,
   Field splices, Rating and the Report summary (window.SBDTabGfxB). Classic script, no DOM. Presentation only: nothing here changes or
   recomputes a result; every function draws the results its tab already built (the tab's own build() output) as entities of the SAME
   drawing pipeline as the Drawings tab (shared/dxf.js SharedDxf: layers S-GRDR…, S-GRDR-PLAT, S-GRDR-STIF, S-DIMS, S-ANNO-TEXT, the same
   dimension and text entities), so the SVG preview renderer and the DXF writer treat them like any drawing. Ratio colours and
   highlights are extra layers (S-RATIO-OK, -HI, -NG, S-SEL, S-GOV, S-GRID).

   Every function returns { id, title, D (SharedDxf drawing), i0, i1 (its entities), regions, note }; regions = [{ k, i, x0, y0, x1, y1 }]
   in drawing coordinates (y up): the clickable areas, k and i being the tab's own selection (e.g. the Shear tab's { k: 'pan', i }).
   Drawings are full size in inches (elevations: 1 ft along the girder = 12 in; vertical exaggeration opt.vex, printed on the drawing);
   text heights are generous (about 1/70 of the length) so that the drawing reads at fit.

   API (each takes the tab's result R and the project P; see each function):
     shear(R, P, opt), shearDetail(R, P, opt),       Shear & stiffeners: panels filled (solid) by shear ratio, stiffener layout and spacing; the transverse
       shearBearing(R, P, opt)                         stiffener at a location (panels to scale, plan section) and the bearing stiffener (section, effective column)
     fatigue(R, P, opt), fatigueChart(R, P, opt)     Fatigue & studs: details coloured by FA1, stud zones; Δf vs (ΔF)n along the girder
     crossframe(B, P, opt)                           Cross-frames: X / K elevation sketch, members labelled, governing group highlighted
     welds(B, P, opt), weldDetail(B, P, opt)         Welds: weld locations on the elevation coloured by ratio; fillet weld size detail
     splice(s, opt)                                  Field splices: plan of the flange splice and web splice elevation, governing group
     ratingChart(B, P, opt)                          Rating: RF along the girder (Inventory and Operating, flexure and shear), RF = 1.0
     summary(M, P, opt)                              Report summary: small elevation, governing check per region
   Helpers exposed for the tests: geoOf, ratioClass, hatch. */
(function () {
  'use strict';
  const X_ = () => window.SharedDxf;
  const fin = v => typeof v === 'number' && isFinite(v);
  /* the ratio bands of SBDGraphics.ratioColor (green < 0.9, amber 0.9 to 1.0 (1.0 passes), red > 1.0 or NG: the tables' own classes): the same colours on every tab graphic */
  const rcls = r => (Number.isNaN(r) || r === Infinity ? 'ng' : !fin(r) ? 'na' : r > 1 + 1e-9 ? 'ng' : r >= 0.9 ? 'hi' : 'ok');
  /* width of a text of height hh in a drawing of text height h as the preview draws it (SBDGraphics.textW; the smallest text is 0.72 h as SBDGraphics.newDrawing makes it) */
  const TW = (str, hh, h) => { const g = window.SBDGraphics, q = Math.max(hh, 0.72 * (h || 0)); return g && g.textW ? g.textW(str, q) : String(str).length * q * 0.62; };
  const frac = v => X_().frac(v), dIn = v => `${X_().frac(v)}"`;   // sizes to the nearest 1/16 in (plate and weld sizes, as GirderDetail's frac)
  const f1 = v => (+v).toFixed(1), f2 = v => (+v).toFixed(2), f3 = v => (+v).toFixed(3);
  /* text of a result (a check title with TeX or Greek letters) as plain upper-case drafting text: the preview and the DXF both show it as written */
  const GREEK = { '\\phi': 'PHI', '\\gamma': 'GAMMA', '\\Delta': 'D', '\\ell': 'l', '\\le': '<=', '\\ge': '>=', '\\eta': 'ETA', '\\sigma': 'SIGMA', '\\lambda': 'LAMBDA', '\\rho': 'RHO' };
  const asc = s => String(s == null ? '' : s).replace(/\$([^$]*)\$/g, (m, t) => t.replace(/\\[A-Za-z]+/g, c => GREEK[c] || '').replace(/[{}\\]/g, '')).replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/[φΦ]/g, 'PHI').replace(/γ/g, 'GAMMA').replace(/[ΔδΔ]/g, 'D').replace(/ℓ/g, 'l').replace(/×/g, 'x').replace(/[–−—]/g, '-').replace(/[′’]/g, "'").replace(/∞/g, 'INF').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();
  const up = s => asc(s).toUpperCase();

  /* ---------- the drawing, its layers and the common pieces ---------- */
  const layersOf = D => ({ p: D.layer('GRDR-PLAT', 4), w: D.layer('GRDR', 5), st: D.layer('GRDR-STIF', 30), s: D.layer('SPLC', 1), b: D.layer('BRNG', 8), sc: D.layer('STUD', 2), d: D.layer('DIMS', 7), t: D.layer('ANNO-TEXT', 7),
    c: D.layer('CNTR', 8), bolt: D.layer('BOLT', 2), pl: D.layer('SPLC-PLAT', 1), dk: D.layer('DECK', 7), ok: D.layer('RATIO-OK', 3), hi: D.layer('RATIO-WARN', 2), ng: D.layer('RATIO-NG', 1), na: D.layer('RATIO-NA', 9),
    sel: D.layer('SEL', 5), gov: D.layer('GOV', 6), grid: D.layer('GRID', 9) });
  /* a stand-alone drawing (the detail sketches) at text height h: as SBDGraphics.newDrawing */
  function newDrawing(h) { const GR = window.SBDGraphics, D = GR ? GR.newDrawing(h) : X_().drawing({ prefix: 'S-' }); D.h = h; D.k = h / 0.1; return { D, L: layersOf(D) }; }
  /* 45° lines filling the rectangle (the preview has no fills: the ratio colour is a hatch on its own layer, which the DXF carries too) */
  function hatch(D, l, x0, y0, x1, y1, sp) {
    const w = x1 - x0, hh = y1 - y0; if (!(w > 0 && hh > 0)) return;
    sp = Math.max(sp || hh / 5, (w + hh) / 260);
    for (let c = -hh; c < w; c += sp) {
      let ax = x0 + c, ay = y0, bx = x0 + c + hh, by = y1;
      if (ax < x0) { ay += x0 - ax; ax = x0; } if (bx > x1) { by -= bx - x1; bx = x1; }
      if (bx - ax > 1e-6) D.line(l, ax, ay, bx, by);
    }
  }
  /* ratioSolid: the ratio colour of a rectangle as an outline and a solid fill (SharedDxf solid) on the layer of its class (Shear & stiffeners, 2026-10-31: the
     engineer found the hatching confusing; the preview draws solids translucent behind every line and text) */
  function ratioSolid(D, L, r, x0, y0, x1, y1) { const l = L[rcls(r)]; D.rect(l, x0, y0, x1, y1); if (rcls(r) !== 'na') D.solid(l, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]); return l; }
  /* the ratio colour of a rectangle: outline and hatch on the layer of its class */
  function ratioFill(D, L, r, x0, y0, x1, y1, sp) { const l = L[rcls(r)]; D.rect(l, x0, y0, x1, y1); if (rcls(r) !== 'na') hatch(D, l, x0, y0, x1, y1, sp); return l; }
  /* text that fits: horizontal when the width allows, else turned 90°, else skipped */
  function fitText(D, l, cx, cy, w, hgt, s, hh) {
    const tw = String(s).length * hh * 0.9;
    if (tw <= w * 0.96) { D.text(l, cx, cy - hh / 2, hh, s, 1); return true; }
    if (tw <= hgt * 0.96 && hh <= w * 0.9) { D.text(l, cx + hh / 2, cy - tw / 2, hh, s, 0, 90); return true; }
    return false;
  }
  function scaleBar(D, L, x, y, ft, h) {
    const len = ft * 12; D.line(L.t, x, y, x + len, y); for (let i = 0; i <= 2; i++) D.line(L.t, x + len * i / 2, y, x + len * i / 2, y + 0.5 * h);
    D.text(L.t, x, y - 1.4 * h, h * 0.8, '0', 1); D.text(L.t, x + len / 2, y - 1.4 * h, h * 0.8, `${ft / 2}`, 1); D.text(L.t, x + len, y - 1.4 * h, h * 0.8, `${ft} FT`, 1);
  }
  /* the legend row: swatch and text per item, from x, or ending at o.right (the girder's end), so that it never runs past the drawing; returns its width */
  const legend = (D, L, x, y, h, items, o) => { const w = items.map(([, txt]) => 2 * h + TW(txt, h * 0.85, h) + 1.6 * h), tot = w.reduce((a, b) => a + b, 0) - 1.6 * h; let xx = o && o.right != null ? o.right - tot : x;
    items.forEach(([lay, txt, shape], i) => { if (shape === 'circle') D.circle(lay, xx + 0.8 * h, y + 0.5 * h, 0.6 * h); else if (shape === 'diamond') D.pline(lay, [[xx + 0.8 * h, y + 1.2 * h], [xx + 1.5 * h, y + 0.5 * h], [xx + 0.8 * h, y - 0.2 * h], [xx + 0.1 * h, y + 0.5 * h]], true);
      else if (shape === 'line') D.line(lay, xx + 0.8 * h, y - 0.2 * h, xx + 0.8 * h, y + 1.2 * h);
      else if (shape === 'dash') [0, 1, 2].forEach(k => D.line(lay, xx + 0.8 * h, y - 0.2 * h + k * 0.5 * h, xx + 0.8 * h, y + 0.1 * h + k * 0.5 * h));
      else if (shape === 'pair') [0.5, 1.1].forEach(u => D.line(lay, xx + u * h, y - 0.2 * h, xx + u * h, y + 1.2 * h));
      else { D.rect(lay, xx, y - 0.1 * h, xx + 1.6 * h, y + 1.1 * h); if (o && o.solid) D.solid(lay, [[xx, y - 0.1 * h], [xx + 1.6 * h, y - 0.1 * h], [xx + 1.6 * h, y + 1.1 * h], [xx, y + 1.1 * h]]); else hatch(D, lay, xx, y - 0.1 * h, xx + 1.6 * h, y + 1.1 * h, 0.5 * h); } D.text(L.t, xx + 2 * h, y, h * 0.85, txt); xx += w[i]; }); return tot; };
  const RLEG = L => [[L.ok, 'RATIO < 0.90'], [L.hi, '0.90 TO 1.00'], [L.ng, 'RATIO > 1.00 OR NG']];
  const MLEG = L => [[L.gov, 'GOVERNING ITEM', 'circle'], [L.sel, 'SELECTED ITEM', 'circle']];   // the two kinds of marker the graphics draw besides the colour bands
  const base = (id, title, D, i0, regions, note) => ({ id, title, D, i0, i1: D.mark(), regions: regions || [], note: note || '' });

  /* ---------- the girder: plates and supports from the project ---------- */
  /* geoOf(sup, segs): { sup (ft), L (ft), segs: [{ x0, x1 (ft), D, tw, topB, topT, botB, botT }] } */
  function geoOf(sup, segs) { const S = segs.map(s => ({ x0: +s.x0, x1: +s.x1, D: +s.D, tw: +s.tw, topB: +s.topB, topT: +s.topT, botB: +s.botB, botT: +s.botT })).sort((a, b) => a.x0 - b.x0); return { sup: sup.map(Number), L: sup[sup.length - 1], segs: S }; }
  function geoProject(P, gi) {
    const sup = [0]; (P.spans.lengths || []).forEach(L => sup.push(+(sup[sup.length - 1] + +L).toFixed(6)));
    const g = (P.girders || [])[gi] || (P.girders || [])[0]; return geoOf(sup, g.segments);
  }
  const segAt = (G, x) => G.segs.find(s => x >= s.x0 - 1e-9 && x < s.x1 - 1e-9) || (x < G.segs[0].x0 ? G.segs[0] : G.segs[G.segs.length - 1]);
  const supName = (k, n) => (k === 0 ? 'ABUT. 1' : k === n - 1 ? 'ABUT. 2' : `PIER ${k}`);

  /* frame(P, opt): the girder elevation of SBDGraphics.elevation (the Drawings elevation: plates and plate sizes, supports, splices, cross-frame lines, span
     dimensions, station axis), with this file's layers and helpers: { D, L (layers), G (plates and supports of the project), F } where F = { E, X(ft),
     v (vertical exaggeration), h (text height), yB (web bottom), yTop, Dw(ft) (web height there), tT, tB (flange thicknesses), alloc(height) (a row below
     everything drawn: its top y), title(t, sub) }. opt.gi: the girder (index in P.girders). */
  function frame(P, opt) {
    opt = opt || {}; const GR = window.SBDGraphics; if (!GR) throw new Error('ui/graphics.js (SBDGraphics) is not loaded.');
    const gi = opt.gi || 0, E = GR.elevation(P, gi, { vex: opt.vex, h: opt.h }); if (E.errors && E.errors.length) throw new Error(E.errors.join(' '));
    const G = geoProject(P, gi), D = E.D, L = layersOf(D), v = E.vex;
    const F = { E, gi, X: E.X, v, h: E.h, yB: E.yB, Dw: x => E.Yweb(x), tT: x => segAt(G, x).topT * v, tB: x => segAt(G, x).botT * v, alloc: n => E.alloc(n), title: (t, sub) => E.title(t, sub),
      get yTop() { return E.yTop; }, set yTop(y) { E.yTop = y; } };
    return { D, L, G, F };
  }

  /* ====================================================================================================== */
  /* Shear & stiffeners                                                                                      */
  /* ====================================================================================================== */
  /* x of each intermediate stiffener / connection plate row of R.TS (the layout's panel joints, as SBDStiffeners.stiffenerRows finds them) */
  function tsStations(R) {
    const SB = window.SBDStiffeners, out = []; if (!R.TS || !R.TS.rows) return out;
    if (R.gm.dem && SB) { const pans = R.bays.flatMap(SB.bayPanels); for (let j = 0; j < pans.length - 1; j++) if (Math.abs(pans[j + 1].p - pans[j].q) <= 0.01) out.push(pans[j].q); if (out.length === R.TS.rows.length) return out; }
    return R.TS.rows.map(r => { const m = /at ([\d.]+) ft/.exec(r.name || ''); return m ? +m[1] : NaN; });
  }
  /* shear(R, P, opt): the girder elevation with the stiffener layout, each web panel filled (solid) in the colour of its shear ratio V_u/(φ_v V_n)
     (R.panels.rows[i].r), the stiffeners by kind (connection plates solid, intermediate stiffeners dashed, bearing stiffeners double, as GirderDetail's
     elevation sheet dxfElev), their spacing dimensioned above the girder where the text fits (n @ d_o, d_o/D), a strip with the ratio of every station,
     and the governing items flagged. Clicks: pan, loc, ts, bs. opt.gi: the girder; opt.sel: the tab's selection { k, i }.
     2026-10-31 (stiffener tab PR): solid fills instead of hatching; spacing dimensions and stiffener tags; the bearing labels left the web. */
  function shear(R, P, opt) {
    opt = opt || {}; const gi0 = opt.gi != null ? opt.gi : Math.max(0, (R.gm.gNo || 1) - 1), { D, L, G, F } = frame(P, { gi: Math.min(gi0, P.girders.length - 1) }), h = F.h, X = F.X, reg = [], sel = opt.sel || {};
    const has = R.gm.dem, rows = R.panels.rows, gov = R.panels.gov, hid = D.ltype('HIDDEN');
    // the panels: one solid fill per run of neighbouring panels of the same colour class and web depth (no fill where there is no shear envelope)
    if (has) { const dep = q => Math.min(F.Dw(q.p + 1e-6), F.Dw(q.q - 1e-6)); let run = null; const flush = () => { if (run) ratioSolid(D, L, run.r, X(run.p), F.yB, X(run.q), F.yB + run.d); run = null; };
      rows.forEach(q => { const d = dep(q), c = rcls(q.r); if (run && run.c === c && Math.abs(run.d - d) < 1e-6 && Math.abs(run.q - q.p) < 1e-6) run.q = q.q; else { flush(); run = { p: q.p, q: q.q, d, c, r: q.r }; } }); flush(); }
    rows.forEach(q => { const a = X(q.p), b = X(q.q), d = Math.min(F.Dw(q.p + 1e-6), F.Dw(q.q - 1e-6)), r = has ? q.r : NaN, hh = h * Math.min(0.9, (b - a) * 0.5 / (h * 1.2));
      const show = has && (rcls(r) !== 'ok' || q === gov);
      if (show && hh > 0.35 * h) fitText(D, L.t, (a + b) / 2, F.yB + d * 0.2, b - a, d * 0.4, f2(r), hh);
      if (sel.k === 'pan' && sel.i === q.i) D.rect(L.sel, a - 0.12 * h, F.yB - 0.12 * h, b + 0.12 * h, F.yB + d + 0.12 * h);
      reg.push({ k: 'pan', i: q.i, x0: a, y0: F.yB, x1: b, y1: F.yB + d, lab: `PANEL ${f2(q.p)}-${f2(q.q)} FT${q.end ? ' (END)' : ''}, d_o = ${f2(q.d)} IN = ${f2(q.d / R.D)}D${has ? `, V_u/PHI V_n = ${f3(q.r)}` : ''}` }); });
    // stiffeners: connection plates (Type B) solid, intermediate stiffeners (Type A) dashed; bearing stiffeners a pair of lines at each support
    const tx = tsStations(R);
    R.TS && R.TS.rows.forEach((r, i) => { const x = tx[i]; if (!fin(x)) return; const d = F.Dw(x); D.line(L.st, X(x), F.yB, X(x), F.yB + d, r.type === 'B' ? undefined : hid); });
    R.BS && R.BS.rows.forEach((r, k) => { const x = G.sup[k]; if (x == null) return; const d = F.Dw(Math.min(x, G.L - 1e-6)); [-1, 1].forEach(sg => D.line(L.st, X(x) + sg * 0.35 * h, F.yB, X(x) + sg * 0.35 * h, F.yB + d)); });
    // above the girder, rows from the top of the elevation up: the spacing dimensions, the stiffener tags, the governing flags
    let top = Math.max(F.yTop, F.yB + Math.max(...G.segs.map(q => q.D * F.v)) + 2.6 * h) + 2.4 * h;
    // 1. spacing: the joints of the panels (supports and stiffeners) in runs of equal d_o; text n @ d_o (d_o/D) where it fits, staggered on two rows
    { const xs = [...new Set(rows.flatMap(q => [q.p, q.q]).map(x => +x.toFixed(4)))].sort((a, b) => a - b), runs = [];
      for (let j = 0; j < xs.length - 1;) { const dd = xs[j + 1] - xs[j]; let k = j + 1; while (k < xs.length - 1 && Math.abs((xs[k + 1] - xs[k]) - dd) < 1e-3) k++; runs.push({ a: xs[j], b: xs[k], n: k - j, d: dd }); j = k; }
      const hh = 0.72 * h, ft = v => X_().fmtFtIn(v * 12), yr = top + 1.2 * h;
      runs.forEach(q => { const room = (X(q.b) - X(q.a)) * 0.94;   // the text stays within its own run (the neighbours' extension lines are at its ends)
        const tries = [`${q.n > 1 ? q.n + ' @ ' : ''}${ft(q.d)} (${f2(q.d * 12 / R.D)}D)`, `${q.n > 1 ? q.n + ' @ ' : ''}${ft(q.d)}`, `${q.n > 1 ? q.n + '@' : ''}${f2(q.d * 12 / R.D)}D`], txt = tries.find(t => TW(t, hh, h) <= room) || ' ';
        D.dimH(L.d, X(q.a), X(q.b), yr, F.yTop + 0.4 * h, txt); });
      top = yr + 1.8 * h; }
    // 2. tags of the bearing stiffeners, the governing / selected stiffener and the governing panel: flags on leaders (SBDGraphics.stack rows)
    const gl = [], yW = x => F.yB + F.Dw(Math.min(Math.max(x, 1e-6), G.L - 1e-6));
    R.BS && R.BS.rows.forEach((r, k) => { const x = G.sup[k]; if (x == null) return; const isG = R.bsGov && R.bsGov.i === k, isS = sel.k === 'bs' && sel.i === k;
      gl.push({ x: X(x), y: yW(x), txt: `BS${k + 1}${isG ? ` GOVERNS ${f3(R.bsGov.it.r)}` : ''}`, lay: isG ? L.gov : isS ? L.sel : L.t });
      reg.push({ k: 'bs', i: k, x0: X(x) - 0.6 * h, y0: F.yB, x1: X(x) + 0.6 * h, y1: F.yB + F.Dw(Math.min(x, G.L - 1e-6)), lab: up(r.name) }); });
    R.TS && R.TS.rows.forEach((r, i) => { const x = tx[i]; if (!fin(x)) return; const isG = R.tsGov && R.tsGov.i === i, isS = sel.k === 'ts' && sel.i === i, nm = `${r.type === 'B' ? 'CP' : 'TS'}${i + 1}`;
      if (isG || isS) gl.push({ x: X(x), y: yW(x), txt: `${nm}${isG ? ` GOVERNS ${f3(R.tsGov.it.r)}` : ' SELECTED'}`, lay: isG ? L.gov : L.sel });
      reg.push({ k: 'ts', i, x0: X(x) - 0.25 * h, y0: F.yB, x1: X(x) + 0.25 * h, y1: F.yB + F.Dw(x), lab: `${nm}: ${up(r.name)} (TYPE ${r.type})` }); });
    if (has && gov) { const xm = (gov.p + gov.q) / 2; D.rect(L.gov, X(gov.p) + 0.2 * h, F.yB + 0.2 * h, X(gov.q) - 0.2 * h, F.yB + F.Dw(xm) - 0.2 * h); gl.push({ x: X(xm), y: yW(xm), txt: `PANEL GOVERNS ${f3(gov.r)}`, lay: L.gov }); }
    gl.sort((a, b) => a.x - b.x); top += stackRows(D, L.t, gl, top, h, 0.8 * h);
    // the stations: a strip of cells coloured by each station's governing ratio (click: that station)
    const rowTop = F.alloc(10 * h), yS = rowTop - 3 * h, st = R.stations, xs = st.map(s => s.x);
    D.text(L.t, 0, rowTop - 0.6 * h, h * 0.8, 'STATIONS (GS11, GS16, GS18): GOVERNING RATIO AT EACH');
    { let run = null; const flush = () => { if (run) { const l = L[run.c]; D.rect(l, X(run.a), yS, X(run.b), yS + 1.6 * h); if (run.c !== 'na') D.solid(l, [[X(run.a), yS], [X(run.b), yS], [X(run.b), yS + 1.6 * h], [X(run.a), yS + 1.6 * h]]); } run = null; };   // one cell per run of the same colour class
      st.forEach((s, i) => { const x = xs[i], a = Math.max(0, i ? (xs[i - 1] + x) / 2 : x - 0.5), b = Math.min(G.L, i < st.length - 1 ? (x + xs[i + 1]) / 2 : x + 0.5), c = rcls(s.gov ? s.gov.ratio : NaN); if (b <= a) return;
        if (run && run.c === c && Math.abs(run.b - a) < 1e-6) run.b = b; else { flush(); run = { a, b, c }; } }); flush(); }
    st.forEach((s, i) => { const x = xs[i], a = i ? (xs[i - 1] + x) / 2 : x - 0.5, b = i < st.length - 1 ? (x + xs[i + 1]) / 2 : x + 0.5, a1 = Math.max(0, a), b1 = Math.min(G.L, b);
      if (b1 <= a1) return;
      if (sel.k === 'loc' && sel.i === i) D.rect(L.sel, X(a1) - 0.1 * h, yS - 0.3 * h, X(b1) + 0.1 * h, yS + 1.9 * h);
      reg.push({ k: 'loc', i, x0: X(a1), y0: yS - 0.3 * h, x1: X(b1), y1: yS + 1.9 * h, lab: `${up(s.name)}${s.gov ? `, ${s.gov.id} ${f3(s.gov.ratio)}` : ''}` }); });
    if (R.stGov) { const x = X(R.stGov.x != null ? R.stGov.x : xs[st.indexOf(R.stGov)]); D.line(L.gov, x, yS - 0.3 * h, x, yS - 2.2 * h); D.text(L.gov, x, yS - 4 * h, h * 0.8, `${R.stGov.gov.id} ${f3(R.stGov.gov.ratio)}`, 1); }
    // legends: ratio colours (solid swatches), the stiffener kinds (line samples), the markers
    const yL = F.alloc(12.4 * h) - 2.4 * h; scaleBar(D, L, 0, yL, Math.max(10, Math.round(G.L / 6 / 10) * 10), h); legend(D, L, 0, yL, h, RLEG(L), { right: X(G.L), solid: true });
    legend(D, L, 0, yL - 3.8 * h, h, [[L.st, 'CONNECTION PLATE (CP)', 'line'], [L.st, 'INTERMEDIATE STIFFENER (TS)', 'dash'], [L.st, 'BEARING STIFFENER (BS)', 'pair']], { right: X(G.L) });
    legend(D, L, 0, yL - 7.6 * h, h, MLEG(L), { right: X(G.L) });
    F.yTop = top; const lab = (P.girders[gi0] || {}).label || `G${gi0 + 1}`;
    F.title(`GIRDER ${lab}: SHEAR AND STIFFENER LAYOUT`, `WEB PANELS FILLED BY V_u / (PHI_v V_n), 6.10.9; ${has ? '' : 'NO SHEAR ENVELOPE FROM THIS SOURCE (PANEL RESISTANCE ONLY); '}STIFFENER SPACING ABOVE: n @ d_o (d_o/D) WHERE IT FITS; VERT. EXAG. x${F.v.toFixed(1)} (THE STIFFENER DETAILS BELOW ARE TO SCALE); CLICK A PANEL, STIFFENER OR BEARING FOR ITS WORK`);
    return base('shear', 'Shear and stiffener layout', D, 0, reg);
  }

  /* stackLv(items, h, hh): the rows (0 = nearest the girder) of flags [{ x, y (the mark the leader starts from), txt }] set left-aligned at their x (SBDGraphics.stack: the rightmost
     lowest, so no label touches another and no leader crosses a label), and how many rows: { lv, n } */
  function stackLv(items, h, hh) { const lv = items.length ? window.SBDGraphics.stack(items.map(q => ({ x: q.x, w: TW(q.txt, hh, h) + 0.6 * h })), { gap: 0.5 * h }) : []; return { lv, n: lv.length ? Math.max(...lv) + 1 : 0 }; }
  /* stackDraw(D, lay, items, S, y0, h, hh, dir): the flags on a leader each, row r at y0 + dir * 1.5 h r (dir 1: above the marks, -1: below); q.lay overrides the layer. Returns the height used. */
  function stackDraw(D, lay, items, S, y0, h, hh, dir) {
    items.forEach((q, i) => { const yy = y0 + (dir || 1) * S.lv[i] * 1.5 * h; D.line(q.lay || lay, q.x, q.y, q.x, dir < 0 ? yy + 0.9 * h : yy + 0.9 * h); D.text(q.lay || lay, q.x + 0.3 * h, yy, hh, q.txt, 0); }); return S.n * 1.5 * h + 0.6 * h;
  }
  const stackRows = (D, lay, items, y0, h, hh) => stackDraw(D, lay, items, stackLv(items, h, hh), y0, h, hh, 1);
  /* notes(D, l, x, y, txt, n, hh, j): the text wrapped to lines of at most n characters, stacked downward from y; returns the y under the last line */
  const notes = (D, l, x, y, txt, n, hh, j) => { const ls = window.SBDGraphics.wrap(txt, n); ls.forEach((q, i) => D.text(l, x, y - i * 1.35 * hh, hh, q, j || 0)); return y - ls.length * 1.35 * hh; };
  /* a zig-zag break mark across a width at height y */
  const brk = (D, l, x0, x1, y, h) => { const n = 6, pts = []; for (let i = 0; i <= n; i++) pts.push([x0 + (x1 - x0) * i / n, y + (i % 2 ? 0.5 : -0.5) * h * (i === 0 || i === n ? 0 : 1)]); D.pline(l, pts, false); };
  /* a vertical break mark (zig-zag) along a height at x */
  const brkV = (D, l, x, y0, y1, h) => { const n = 6, pts = []; for (let i = 0; i <= n; i++) pts.push([x + (i % 2 ? 0.5 : -0.5) * h * (i === 0 || i === n ? 0 : 1), y0 + (y1 - y0) * i / n]); D.pline(l, pts, false); };
  /* a fillet weld triangle (leg w) at the corner (x, y) opening toward (sx, sy) */
  const filletTri = (D, l, x, y, sx, sy, w) => D.pline(l, [[x, y], [x + sx * w, y], [x, y + sy * w]], true);
  /* the largest ratio of a stiffener row's checks (as the tab's tables: the transverse row's largest check ratio; the bearing row's largest of R_u/(R_sb)_r, R_u/P_r, R_u/R_r) */
  const tsRowRatio = (R, i) => { let m = NaN; const r = R.TS.rows[i]; (R.tsC || []).forEach(c => c.items.forEach(it => { if (it.loc.startsWith(`${r.name} (Type ${r.type})`) && fin(it.r) && !(m >= it.r)) m = it.r; })); return m; };
  const bsRowRatio = r => Math.max(r.Ru / r.Rsb, r.Ru / r.Pr, r.Ru / r.Rweld);
  const pick = (rows, fn, idx) => rows.reduce((b, r, i) => (idx(r, i) && (b < 0 || fn(i) > fn(b)) ? i : b), -1);

  /* shearDetail(R, P, opt): the transverse stiffener (or connection plate) at one location, after GirderDetail's stiffener drawings (tsElevSVG
     "web panel elevation, to scale", the Drawings tab's stiffener plan): A the two web panels beside it in elevation TO SCALE (true inches: web,
     flanges, the stiffener and its neighbours, d_o1 / d_o2 dimensioned with d_o/D, D, the weld cutoff g; each panel filled in the colour of its
     shear ratio V_u/(φ_v V_n) of TS4), B a plan section through the plate (enlarged; sizes in true inches). opt.i: the row of R.TS (default: the
     governing row, or with opt.ts a type letter, the row of that type with the largest ratio). 2026-10-31 (stiffener tab PR): replaced the
     sketches "not to scale along the web". */
  function shearDetail(R, P, opt) {
    opt = opt || {}; const rows = (R.TS && !R.TS.errors.length && R.TS.rows) || [];
    let i = opt.i != null && rows[opt.i] ? opt.i : opt.ts ? pick(rows, k => tsRowRatio(R, k), r => r.type === opt.ts) : R.tsGov ? R.tsGov.i : 0; if (!(i >= 0) || !rows[i]) i = 0;
    const r = rows[i];
    if (!r) { const { D, L } = newDrawing(2.4); D.text(L.t, 0, 0, 2.4, 'NO TRANSVERSE STIFFENER OR CONNECTION PLATE IN THE LAYOUT'); return base('shearDetail', 'Transverse stiffener', D, 0, []); }
    const t = r.t, Dw = r.D, tw = r.tw, tfc = r.tfc || 0.75, tft = r.tft || 0.75, h = Math.max(1.6, Math.min(4, (r.do1 + r.do2 + 12) / 52)), { D, L } = newDrawing(h);
    const nm = `${r.type === 'B' ? 'CP' : 'TS'}${i + 1}`, cp = t.role === 'cp', hid = D.ltype('HIDDEN'), x1 = r.do1, x2 = r.do1 + r.do2, e0 = -8, e1 = x2 + 8;
    // ---- A: elevation to scale (x along the girder from the stiffener before, y up from the bottom of the web)
    [[0, x1, r.p1], [x1, x2, r.p2]].forEach(([a, b, q], k) => { const rr = q && q.phVn > 0 ? q.Vu / q.phVn : NaN; ratioSolid(D, L, rr, a, 0, b, Dw);
      const cx = (a + b) / 2, lines = [`PANEL ${k + 1}${q && q.end ? ' (END PANEL)' : ''}`, `d_o/D = ${f2((b - a) / Dw)}`, fin(rr) ? `V_u/PHI_v V_n = ${f3(rr)}` : ''].filter(Boolean);
      lines.forEach((s, j) => { const hh = Math.min(0.9 * h, (b - a) * 0.9 / Math.max(1, s.length * 0.6)); D.text(L.t, cx, Dw * 0.62 - j * 1.5 * h, hh, s, 1); }); });
    D.rect(L.p, e0, Dw, e1, Dw + tfc); D.rect(L.p, e0, -tft, e1, 0); D.line(L.w, e0, 0, e1, 0); D.line(L.w, e0, Dw, e1, Dw);
    brkV(D, L.w, e0, -tft - 1, Dw + tfc + 1, h); brkV(D, L.w, e1, -tft - 1, Dw + tfc + 1, h);
    // the stiffeners at the ends of the two panels (their own kind is not known here: outlines only) and the stiffener of this row, true thickness
    [0, x2].forEach(x => D.rect(L.st, x - t.tp / 2, 0, x + t.tp / 2, Dw, hid));
    const yb = cp ? 0 : t.gap; D.rect(L.st, x1 - t.tp / 2, yb, x1 + t.tp / 2, Dw); D.solid(L.st, [[x1 - t.tp / 2, yb], [x1 + t.tp / 2, yb], [x1 + t.tp / 2, Dw], [x1 - t.tp / 2, Dw]]);
    D.text(L.t, x1 + t.tp / 2 + 0.5 * h, Dw - 1.6 * h, h * 0.8, nm, 0);
    // dimensions: d_o1, d_o2 above the top flange (with d_o/D), D at the left, g at the stiffener foot
    D.dimH(L.d, 0, x1, Dw + tfc + 3 * h, Dw + tfc, `d_o1 = ${f2(r.do1)}" (${f2(r.do1 / Dw)}D)`); D.dimH(L.d, x1, x2, Dw + tfc + 3 * h, Dw + tfc, `d_o2 = ${f2(r.do2)}" (${f2(r.do2 / Dw)}D)`);
    D.dimV(L.d, 0, Dw, e0 - 3 * h, e0, `D = ${dIn(Dw)}`);
    if (!cp && t.gap > 0) { D.line(L.d, x1 + t.tp / 2 + 0.4 * h, t.gap, x1 + t.tp / 2 + 2.6 * h, t.gap); D.text(L.d, x1 + t.tp / 2 + 0.8 * h, t.gap + 0.5 * h, h * 0.72, `g = ${dIn(t.gap)} (WELD CUTOFF)`, 0); }
    D.text(L.t, e0, Dw + tfc + 8 * h, h * 1.1, `A  ${up(r.name)} (${nm}, TYPE ${r.type}): WEB PANELS, ELEVATION TO SCALE`);
    let y = notes(D, L.t, e0, -tft - 3 * h, `${cp ? 'CONNECTION PLATE, WELDED TO BOTH FLANGES' : `INTERMEDIATE STIFFENER: TIGHT FIT AT THE COMPRESSION FLANGE, WEB WELD STOPS g = ${dIn(t.gap)} SHORT OF THE TENSION FLANGE`}; ${+t.sides === 2 ? 'PAIR' : 'ONE PLATE'} ${frac(t.bt)} x ${frac(t.tp)}; WEB ${dIn(Dw)} x ${dIn(tw)}; PANELS FILLED BY V_u/(PHI_v V_n) OF TS4 (6.10.9.3); DASHED: THE NEIGHBOURING STIFFENERS. I_t = ${f2(r.It)} IN^4, I_req = ${f2(r.Ireq)} IN^4.`, Math.max(40, Math.floor((e1 - e0) / (0.85 * h * 0.62))), 0.85 * h);
    // ---- B: plan section through the plate, enlarged k times (sizes in true inches)
    const sides = +t.sides === 2 ? 2 : 1, k = Math.max(1, Math.min(8, Math.round(0.45 * Dw / (2 * t.bt + tw)))), bx = e1 + 10 * h, by = Dw * 0.5, fb = Math.max(r.bfc || 0, 2 * t.bt + tw + 2) * k, half = 0.55 * fb, s = v => v * k;
    D.rect(L.p, bx - half, by - s(tw) / 2, bx + half, by + s(tw) / 2); D.rect(L.p, bx - half, by - fb / 2, bx + half, by + fb / 2, hid);
    [1, -1].slice(0, sides).forEach(sg => { const ya = sg > 0 ? by + s(tw) / 2 : by - s(tw) / 2 - s(t.bt), yz = ya + s(t.bt); D.rect(L.st, bx - s(t.tp) / 2, ya, bx + s(t.tp) / 2, yz); D.solid(L.st, [[bx - s(t.tp) / 2, ya], [bx + s(t.tp) / 2, ya], [bx + s(t.tp) / 2, yz], [bx - s(t.tp) / 2, yz]]);
      [-1, 1].forEach(sx => filletTri(D, L.s, bx + sx * s(t.tp) / 2, sg > 0 ? by + s(tw) / 2 : by - s(tw) / 2, sx, sg, s(t.w))); });
    D.dimV(L.d, by + s(tw) / 2, by + s(tw) / 2 + s(t.bt), bx + half + 2.5 * h, bx + s(t.tp) / 2, `b_t = ${dIn(t.bt)}`);
    D.text(L.t, bx - s(t.tp) / 2 - 0.6 * h, by + s(tw) / 2 + s(t.bt) - 1.2 * h, h * 0.75, `PL ${frac(t.bt)} x ${frac(t.tp)} (t_p = ${dIn(t.tp)})`, 2);
    D.text(L.t, bx + half + 1.0 * h, by - s(tw) / 2 - 1.6 * h, h * 0.75, `WEB t_w = ${dIn(tw)}`, 0);
    D.text(L.t, bx - half, by + fb / 2 + 6 * h, h * 1.1, `B  PLAN SECTION (ENLARGED x${k})`);
    notes(D, L.t, bx - half, by - fb / 2 - 2 * h, `FILLET WELD ${dIn(t.w)} TO THE WEB, BOTH SIDES OF THE PLATE${cp ? `; ${dIn(t.wf)} TO THE FLANGES` : ''}; FLANGE OUTLINE DASHED`, 30, 0.8 * h);
    return base('shearDetail', `Transverse stiffener ${nm}`, D, 0, []);
  }

  /* shearBearing(R, P, opt): the bearing stiffener at one bearing, after GirderDetail's Bearing stiffeners drawings (bsSectionSVG "section at the
     bearing, to scale", bsPlanSVG "effective column, to scale"): C the girder section at the bearing TO SCALE (flanges, web, the plate pair with
     its clips, the bearing; the plates filled in the colour of the row's largest ratio), D the plan section at mid-depth through the stiffeners
     (enlarged; sizes in true inches) with the effective column of 6.10.11.2.4 filled in the colour of R_u/P_r and its web strips dimensioned
     from the result (9t_w, s_end, L_w, A). opt.i: the row of R.BS (default the governing one; opt.bs a type letter: the row of that type with the
     largest ratio). Added 2026-10-31 (stiffener tab PR). */
  function shearBearing(R, P, opt) {
    opt = opt || {}; const rows = R.BS.rows || [];
    let i = opt.i != null && rows[opt.i] ? opt.i : opt.bs ? pick(rows, k => bsRowRatio(rows[k]), r => r.type === opt.bs) : R.bsGov ? R.bsGov.i : 0; if (!(i >= 0) || !rows[i]) i = 0;
    const r = rows[i];
    if (!r) { const { D, L } = newDrawing(2.4); D.text(L.t, 0, 0, 2.4, 'NO BEARING STIFFENER'); return base('shearBearing', 'Bearing stiffener', D, 0, []); }
    const t = R.BS.types[r.type], Dw = R.D, tw = r.tw, tfb = r.tfb || 1, bfb = r.bfb, bft = r.bft || bfb, sp0 = R.gm.sup || [], xs0 = R.gm.dem && sp0[i] != null ? Math.min(Math.max(sp0[i], 0.01), sp0[sp0.length - 1] - 0.01) : null;
    const tft = xs0 != null && R.gm.zAt(xs0).topT > 0 ? R.gm.zAt(xs0).topT : 0.75;   // the top flange at the bearing (drawing only; GirderDetail's bsSectionSVG draws 0.75 in)
    const h = Math.max(1.4, Math.min(4, (Dw + 6) / 30)), { D, L } = newDrawing(h), c = t.c || 0, nm = `BS${i + 1}`;
    // ---- C: section at the bearing, to scale (x across the girder, web centre at 0; y up from the bottom of the web)
    D.rect(L.p, -bft / 2, Dw, bft / 2, Dw + tft); D.rect(L.p, -tw / 2, 0, tw / 2, Dw); D.rect(L.p, -bfb / 2, -tfb, bfb / 2, 0);
    D.rect(L.b, -bfb / 2 - 1, -tfb - 3, bfb / 2 + 1, -tfb);
    const rr = bsRowRatio(r);
    [1, -1].forEach(sg => { const xi = sg * tw / 2, xo = sg * (tw / 2 + t.bt), pts = [[xi, c], [xi + sg * c, 0], [xo, 0], [xo, Dw], [xi + sg * c, Dw], [xi, Dw - c]];
      D.pline(L.st, pts, true); const l = L[rcls(rr)]; if (rcls(rr) !== 'na') D.solid(l, [[xi + sg * c, 0], [xo, 0], [xo, Dw], [xi + sg * c, Dw]]); });   // the fill: the plate clear of its clips
    D.dimH(L.d, tw / 2, tw / 2 + t.bt, Dw + tft + 2.6 * h, Dw, `b_t = ${dIn(t.bt)}`);
    D.dimV(L.d, 0, Dw, -Math.max(bft, bfb) / 2 - 3 * h, -tw / 2 - t.bt, `D = ${dIn(Dw)}`);
    D.text(L.t, bfb / 2 + 1.6 * h, -tfb - 2.4, h * 0.75, 'BEARING', 0);
    const xn = Math.max(bft, bfb) / 2 + 2 * h, nw = Math.max(...[`${'X'.repeat(30)}`].map(q => TW(q, 0.8 * h, h)));   // the notes column: 34 characters
    let y = notes(D, L.t, xn, Dw - 1.5 * h, `${t.np} PAIR${t.np > 1 ? 'S' : ''} OF PLATES ${frac(t.bt)} x ${frac(t.tp)}, ONE EACH SIDE OF THE WEB; CLIP ${dIn(c)} AT THE FLANGE-TO-WEB WELDS; FILLET WELDS ${dIn(t.w)} TO THE WEB; ${({ milled: 'MILLED TO BEAR ON THE BOTTOM FLANGE', cjp: 'CJP GROOVE WELD TO THE BOTTOM FLANGE', fillet: 'FILLET WELDS TO THE BOTTOM FLANGE (NOT PERMITTED)' })[t.conn] || ''}; WEB ${dIn(tw)}; BOTTOM FLANGE ${frac(bfb)} x ${frac(tfb)}.`, 34, 0.8 * h);
    y = notes(D, L.t, xn, y - 1.2 * h, `R_u = ${f1(r.Ru)} KIP; BEARING (R_sb)_r = ${f1(r.Rsb)}; COLUMN P_r = ${f1(r.Pr)}; WELDS R_r = ${f1(r.Rweld)} KIP; LARGEST RATIO ${f3(rr)} (PLATES FILLED IN ITS COLOUR).`, 34, 0.8 * h);
    D.text(L.t, -Math.max(bft, bfb) / 2 - 3 * h, Dw + tft + 7 * h, h * 1.1, `C  ${up(r.name)} (${nm}, TYPE ${r.type}): SECTION AT THE BEARING, TO SCALE`);
    // ---- D: plan section at mid-depth, the effective column (x along the girder, the stiffener group centred at 0), enlarged k times
    const grp = (t.np - 1) * t.sp + t.tp, L0 = -(r.strip9 + grp / 2), L1 = grp / 2 + r.sEnd, k = Math.max(1, Math.min(8, Math.round(30 * h / Math.max(1, L1 - L0 + 12)))), s = v => v * k;
    const ox = xn + nw + 6 * h, oy = Dw * 0.55, X = v => ox + s(v - (L0 - 6)), Y = v => oy + s(v), xmax = r.ed > 0 ? grp / 2 - t.tp / 2 + r.ed : L1 + 6;
    const cr = r.Ru / r.Pr, cl = L[rcls(cr)];
    D.rect(cl, X(L0), Y(-tw / 2), X(L1), Y(tw / 2)); if (rcls(cr) !== 'na') D.solid(cl, [[X(L0), Y(-tw / 2)], [X(L1), Y(-tw / 2)], [X(L1), Y(tw / 2)], [X(L0), Y(tw / 2)]]);
    D.line(L.w, X(L0 - 6), Y(-tw / 2), X(xmax), Y(-tw / 2)); D.line(L.w, X(L0 - 6), Y(tw / 2), X(xmax), Y(tw / 2)); brkV(D, L.w, X(L0 - 6), Y(-tw / 2) - 1.2 * h, Y(tw / 2) + 1.2 * h, h);
    if (r.ed > 0) { D.line(L.w, X(xmax), Y(-t.bt - tw / 2 - 1), X(xmax), Y(t.bt + tw / 2 + 1)); D.text(L.t, X(xmax) + 0.6 * h, Y(t.bt + tw / 2) - 0.4 * h, h * 0.75, 'GIRDER END', 0); }
    else brkV(D, L.w, X(xmax), Y(-tw / 2) - 1.2 * h, Y(tw / 2) + 1.2 * h, h);
    for (let q = 0; q < t.np; q++) { const xc = -grp / 2 + t.tp / 2 + q * t.sp;
      [1, -1].forEach(sg => { const ya = sg > 0 ? tw / 2 : -tw / 2 - t.bt, P4 = [[X(xc - t.tp / 2), Y(ya)], [X(xc + t.tp / 2), Y(ya)], [X(xc + t.tp / 2), Y(ya + t.bt)], [X(xc - t.tp / 2), Y(ya + t.bt)]]; D.pline(L.st, P4, true); if (rcls(cr) !== 'na') D.solid(cl, P4); }); }
    const yd = Y(-tw / 2 - t.bt) - 3 * h;
    D.dimH(L.d, X(L0), X(-grp / 2), yd, Y(-tw / 2), `9t_w = ${f2(r.strip9)}"`);
    if (t.np > 1) D.dimH(L.d, X(-grp / 2 + t.tp / 2), X(-grp / 2 + t.tp / 2 + (t.np - 1) * t.sp), yd - 3 * h, Y(-tw / 2 - t.bt), `${t.np - 1} @ ${f2(t.sp)}"`);
    D.dimH(L.d, X(grp / 2), X(L1), yd, Y(-tw / 2), `${f2(r.sEnd)}"`);
    D.dimH(L.d, X(L0), X(L1), yd - (t.np > 1 ? 6 : 3) * h, Y(-tw / 2), `EFFECTIVE COLUMN ${f2(r.Ltot)}", A = ${f2(r.A)} IN^2`);
    D.text(L.t, X(L0 - 6), Y(t.bt + tw / 2) + 3.2 * h, h * 1.1, `D  EFFECTIVE COLUMN, PLAN AT MID-DEPTH (ENLARGED x${k})`);
    notes(D, L.t, X(L0 - 6), yd - (t.np > 1 ? 9 : 6) * h, `FILLED: THE EFFECTIVE COLUMN OF 6.10.11.2.4 (PLATES AND WEB STRIPS), IN THE COLOUR OF R_u/P_r = ${f3(cr)}; WEB STRIPS FROM THE RESULT (9t_w EACH SIDE, s_end TO THE GIRDER END).`, 60, 0.8 * h);
    return base('shearBearing', `Bearing stiffener ${nm}`, D, 0, []);
  }

  const niceStep = (a, b, n) => { const raw = (b - a) / n || 1, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
  /* a drafted chart over the girder length (SBDGraphics.chart: axes, grid layer, series, limit line): plot area as wide as the girder in inches */
  const chartOver = (o) => { const GR = window.SBDGraphics; if (!GR) throw new Error('ui/graphics.js (SBDGraphics) is not loaded.'); return GR.chart(o); };

  /* x (ft) of a location named in text (Welds, Report rows): "x = 88.00 ft", "at 88.00 ft", "Abut. 1", "Pier 2" */
  function parseX(txt, sup) {
    const t = String(txt || ''); let m = /x = (-?[\d.]+) ft/.exec(t) || /\bat (-?[\d.]+) ft/.exec(t); if (m) return +m[1];
    m = /Panel (-?[\d.]+)\D+?(-?[\d.]+) ft/.exec(t); if (m) return (+m[1] + +m[2]) / 2;
    m = /\bSpan (\d+)/i.exec(t); if (m && +m[1] >= 1 && sup[+m[1]] != null) return (sup[+m[1] - 1] + sup[+m[1]]) / 2;
    m = /Abut\. (\d)/i.exec(t); if (m) return +m[1] === 1 ? sup[0] : sup[sup.length - 1]; m = /Pier (\d)/i.exec(t); if (m && sup[+m[1]] != null) return sup[+m[1]]; return NaN;
  }

  /* ====================================================================================================== */
  /* Fatigue & studs                                                                                         */
  /* ====================================================================================================== */
  const FLOC = { bfo: (F, s, v) => -s.botT * v, bfi: () => 0, wb: (F, s, v, r) => (+r.yo || 0) * v, wt: (F, s, v, r) => s.D * v - (+r.yo || 0) * v, tfi: (F, s, v) => s.D * v, tfo: (F, s, v) => s.D * v + s.topT * v, y: (F, s, v, r) => (+r.yo || 0) * v - s.botT * v };
  /* the number of studs in a pitch zone (as the Drawings quantities, engine/sheets.js: ⌊L/p + 1⌋ × studs per row) */
  const studCount = z => (z.p > 0 ? (Math.floor(((z.x2 - z.x1) * 12) / z.p + 1e-9) + 1) * z.nr : 0);
  /* fatigue(R, P, opt): elevation with every fatigue detail of R.FR.rows marked at its station and height and coloured by its FA1 ratio, and the
     stud pitch zones (pitch, rows, count) along the top flange coloured by SC1. Clicks: fa (detail), sc (zones). opt.gi: the girder. */
  function fatigue(R, P, opt) {
    opt = opt || {}; const { D, L, G, F } = frame(P, { gi: opt.gi || 0 }), h = F.h, X = F.X, v = F.v, reg = [], sel = opt.sel || {};
    const fa1 = R.FC ? (R.FC.find(c => c.id === 'FA1') || { items: [] }).items : [], rows = R.FR && !R.FR.errors.length ? R.FR.rows : [];
    // the detail labels: left-aligned flags on a leader at the detail's x, in stacked rows (rightmost lowest) so that neither the labels nor the leaders touch each other:
    // details in the upper half of the web take rows above the girder, the others rows under the station axis
    const GRX = window.SBDGraphics, tw = (str, hh) => GRX.textW(str, hh), hl = h * 0.8, ent = rows.map((r, i) => { const s = segAt(G, Math.min(Math.max(+r.x, 1e-6), G.L - 1e-6)), y = (FLOC[r.loc] || FLOC.bfo)(F, s, v, r), q = fa1[i], rat = r.exempt ? NaN : q ? q.r : NaN, txt = `F${i + 1} ${r.exempt ? 'EXEMPT' : f2(rat)}`;
      return { i, r, y, x: X(+r.x), rat, txt, top: y > s.D * v / 2, w: tw(txt, Math.max(hl, 0.72 * h)) + 0.5 * h }; });
    const rowsOf = grp => { const g = ent.filter(q => q.top === grp), lv = GRX.stack(g.map(q => ({ x: q.x, w: q.w })), { gap: 0.4 * h }); g.forEach((q, k) => { q.lvl = lv[k]; }); return g.length ? Math.max(...lv) + 1 : 0; };
    const nTop = rowsOf(true), nBot = rowsOf(false), rowB = F.alloc((2.2 + 1.5 * nBot) * h), yTopL = F.yTop + 3 * h;
    ent.forEach(q => { const { i, r, y, x, rat } = q, lay = r.exempt ? L.na : L[rcls(rat)];
      D.circle(lay, x, F.yB + y, 0.55 * h);
      const yl = q.top ? yTopL + q.lvl * 1.5 * h : rowB - (1.4 + q.lvl * 1.5) * h;   // baseline of the label
      D.line(lay, x, F.yB + y + (q.top ? 0.9 : -0.9) * h, x, q.top ? yl + 0.9 * h : yl + 0.9 * h);
      D.text(lay, x + 0.3 * h, yl, hl, q.txt, 0);
      if (sel.k === 'fa' && sel.i === i) D.circle(L.sel, x, F.yB + y, 1.5 * h);
      reg.push({ k: 'fa', i, x0: x - 1.1 * h, y0: F.yB + y - 1.1 * h, x1: x + 1.1 * h, y1: F.yB + y + 1.1 * h, lab: `F${i + 1} ${up(r.name)}${r.exempt ? ' (EXEMPT)' : `: ${f3(rat)}`}` }); });
    // stud zones: a band above the labels: pitch, rows and stud count; colour by SC1 of the zone
    const zs = R.SR && !R.SR.errors.length ? R.SR.zones : [], sc1 = R.SCC ? (R.SCC.find(c => c.id === 'SC1') || { items: [] }).items : [], yS = yTopL + (nTop * 1.5 + 2.6) * h;
    D.text(L.t, 0, yS + 5.6 * h, h * 0.8, 'SHEAR STUD PITCH ZONES (6.10.10): ROWS @ PITCH (IN) ABOVE; COUNT BELOW; COLOUR = SC1 FATIGUE RATIO');
    zs.forEach((z, i) => { const a = X(z.x1), b = X(z.x2), r = sc1[i] ? sc1[i].r : NaN, n = studCount(z); ratioSolid(D, L, r, a, yS, b, yS + 2 * h); D.line(L.sc, a, yS - 0.5 * h, a, yS + 2.5 * h);
      const lab = `${z.nr}@${+(+z.p).toFixed(1)}`, cl = `${n}`, hs = Math.max(0.75 * h, 0.72 * h), st = i % 2;   // narrow zones: the labels alternate between two rows, or are left out when even that is too narrow
      if (tw(lab, hs) <= (b - a) * (st || tw(lab, hs) > (b - a) * 0.96 ? 1.9 : 0.96)) D.text(L.t, (a + b) / 2, yS + (2.6 + 1.3 * (tw(lab, hs) > (b - a) * 0.96 ? st : 0)) * h, hs, lab, 1);
      if (tw(cl, hs) <= (b - a) * (st || tw(cl, hs) > (b - a) * 0.96 ? 1.9 : 0.96)) D.text(L.t, (a + b) / 2, yS - (1.6 + 1.3 * (tw(cl, hs) > (b - a) * 0.96 ? st : 0)) * h, hs, cl, 1);
      if (sel.k === 'sc') D.rect(L.sel, a, yS - 0.2 * h, b, yS + 2.2 * h);
      reg.push({ k: 'sc', i: 0, x0: a, y0: yS - 0.5 * h, x1: b, y1: yS + 3.4 * h, lab: `STUD ZONE ${f2(z.x1)}-${f2(z.x2)} FT: ${z.nr} @ ${f2(z.p)} IN = ${n} STUDS, SC1 ${f3(r)}` }); });
    if (zs.length) { D.line(L.sc, X(zs[zs.length - 1].x2), yS - 0.5 * h, X(zs[zs.length - 1].x2), yS + 2.5 * h); D.text(L.t, X(G.L), yS - 3.2 * h - 1.3 * h, h * 0.8, `TOTAL ${zs.reduce((s, z) => s + studCount(z), 0)} STUDS`, 2); } else D.text(L.t, 0, yS, h * 0.8, 'NO STUD ZONES IN THESE RESULTS.');
    const yL = F.alloc(8.6 * h) - 2.4 * h; legend(D, L, 0, yL, h, RLEG(L), { right: X(G.L), solid: true }); scaleBar(D, L, 0, yL, Math.max(10, Math.round(G.L / 6 / 10) * 10), h); legend(D, L, 0, yL - 3.8 * h, h, [[L.t, 'FATIGUE DETAIL (COLOUR = FA1 RATIO)', 'circle'], [L.na, 'EXEMPT (FA2)', 'circle'], [L.sel, 'SELECTED', 'circle']], { right: X(G.L) });
    F.yTop = yS + 7.4 * h;
    F.title(`GIRDER ${(P.girders[opt.gi || 0] || {}).label || 'G1'}: FATIGUE DETAILS AND STUD ZONES`, `F1.. = THE FATIGUE DETAILS OF THE TABLE (RATIO = GAMMA(DELTA f) / (DELTA F)_n, FA1); VERT. EXAG. x${v.toFixed(1)}; PLATES OF THE PROJECT`);
    return base('fatigue', 'Fatigue details and stud zones', D, 0, reg);
  }
  /* fatigueChart(R, P, opt): γ(Δf) and (ΔF)_n of each detail along the girder (SBDGraphics.chart); marker colour = FA1 ratio. Click: fa. */
  function fatigueChart(R, P, opt) {
    opt = opt || {}; const G = geoProject(P, opt.gi || 0), Lin = G.L * 12, h = Lin * 0.024, rows = R.FR && !R.FR.errors.length ? R.FR.rows : [], fa1 = R.FC ? (R.FC.find(c => c.id === 'FA1') || { items: [] }).items : [];
    let ymax = 0; rows.forEach(r => { if (fin(r.dem)) ymax = Math.max(ymax, r.dem); if (fin(r.res)) ymax = Math.max(ymax, r.res); }); const ys = niceStep(0, ymax * 1.1 || 1, 5); ymax = Math.ceil(ymax * 1.45 / ys) * ys || 1;
    const byC = { ok: [], hi: [], ng: [], na: [] }; rows.forEach((r, i) => { if (fin(r.dem)) byC[r.exempt ? 'na' : rcls(fa1[i] ? fa1[i].r : NaN)].push([+r.x * 12, r.dem]); });
    const C = chartOver({ at: [0, 0], w: Lin, hgt: Lin * 0.16, h, xr: [0, Lin], yr: [0, ymax], ystep: ys, xstep: niceStep(0, G.L, 10) * 12, fx: v => String(Math.round(v / 12)), fy: v => (+v.toFixed(2)).toString(), file: 'fatigue-chart',
 xlab: 'STATION ALONG THE GIRDER (FT)', ylab: 'STRESS RANGE (KSI)',
      legend: 'below', vlabel: 'bottom', series: [{ name: '(DF)n RESISTANCE', kind: 'points', pts: rows.filter(r => fin(r.res)).map(r => [+r.x * 12, r.res]), color: 5 }, { name: 'gamma(Df) < 0.9 (DF)n', kind: 'points', pts: byC.ok, color: 3 }, { name: '0.9 TO 1.0 (DF)n', kind: 'points', pts: byC.hi, color: 2 },
        { name: '> 1.0 (NG)', kind: 'points', pts: byC.ng, color: 1 }, { name: 'EXEMPT (FA2)', kind: 'points', pts: byC.na, color: 9 }], vlines: G.sup.map((x, k) => ({ x: x * 12, label: supName(k, G.sup.length) })) });
    const D = C.D, L = layersOf(D), reg = [], hh = C.h;
    // the detail labels F1.. sit above their points, set left-aligned in the lowest free place (SBDGraphics.declutter), on a leader when lifted
    const lab = rows.map((r, i) => ({ x: C.X(+r.x * 12) + 0.2 * hh, y: C.Y(Math.max(r.dem || 0, r.res || 0)) + 0.9 * hh, w: TW(`F${i + 1}`, hh * 0.8, hh) + 0.4 * hh, hh: Math.max(hh * 0.8, 0.72 * hh) })), by = window.SBDGraphics.declutter(lab, { gap: 0.3 * hh });
    D.text(L.t, 0, Math.max(C.plot[3], ...by.map((q, i) => q + 0.9 * lab[i].hh)) + 1.2 * hh, hh * 1.1, `GIRDER ${(P.girders[opt.gi || 0] || {}).label || 'G1'}: FATIGUE STRESS RANGE gamma(Df) vs NOMINAL RESISTANCE (DF)n`);   // above the highest label
    rows.forEach((r, i) => { const x = C.X(+r.x * 12); if (fin(r.res) && fin(r.dem)) D.line(L.c, x, C.Y(r.dem), x, C.Y(r.res), D.ltype('DASHED')); D.text(L.t, lab[i].x, by[i], lab[i].hh, `F${i + 1}`, 0); if (by[i] > lab[i].y + 0.1 * hh) D.line(L.t, x, lab[i].y - 0.9 * hh, x, by[i]);
      if (opt.sel && opt.sel.k === 'fa' && opt.sel.i === i) D.circle(L.sel, x, C.Y(r.dem), 1.4 * hh);
      const ya = C.Y(Math.min(r.dem || 0, r.res || 0)), yb = C.Y(Math.max(r.dem || 0, r.res || 0)); reg.push({ k: 'fa', i, x0: x - 0.55 * hh, y0: Math.max(C.plot[1], ya - 0.8 * hh), x1: x + 0.55 * hh, y1: Math.min(C.plot[3], yb + 0.8 * hh), lab: `F${i + 1} ${up(r.name)}: GAMMA(DF) ${f2(r.dem)} / (DF)n ${f2(r.res)} KSI` }); });
    return base('fatigueChart', 'Fatigue stress range along the girder', D, 0, reg);
  }

  /* ====================================================================================================== */
  /* Cross-frames                                                                                            */
  /* ====================================================================================================== */
  /* crossframe(B, P, opt): B = SBDFramingUI.build() result: the frame of one bay (members of B.R.frames at the work points B.R.N) between two
     girder webs, labelled (name, section, largest T / C over the load combinations); the group that governs (B's governing check: its step
     cf.top / cf.bot / cf.diag) highlighted. */
  function crossframe(B, P, opt) {
    opt = opt || {}; const R = B.R, N = R.N, I = B.I.p, { D, L } = newDrawing(4.6), h = D.h, S = I.S, dg = I.dg, hw = I.h, ox = 0, oy = 0;
    if (!N || !R.frames) return base('crossframe', 'Cross-frame', D, 0, []);
    const gov = (() => { let g = null; (B.C || []).forEach(c => c.items.forEach(it => { if (fin(it.r) && (it.st === 'pass' || it.st === 'fail') && (!g || it.r > g.it.r)) g = { c, it }; })); return g; })();
    const grp = gov && /^cf\.(top|bot|diag)\b/.exec(gov.it.step || '') ? /^cf\.(top|bot|diag)\b/.exec(gov.it.step)[1] : null, nodeY = n => oy + N[n][1], nodeX = n => ox + N[n][0];
    // the girder webs and flanges at each end (depth dg), the deck line at the top
    const flg = (x, ) => { D.rect(L.p, x - 8, oy + (hw - dg) / 2 + dg, x + 8, oy + (hw - dg) / 2 + dg + 1); };
    [0, S].forEach((x, k) => { const y0 = oy + (hw - dg) / 2; D.line(L.w, ox + x, y0, ox + x, y0 + dg); D.rect(L.p, ox + x - 8, y0 + dg, ox + x + 8, y0 + dg + 1.1); D.rect(L.p, ox + x - 8, y0 - 1.1, ox + x + 8, y0); D.text(L.t, ox + x + (k ? -10 : 10), y0 - 3.4 * h, h * 0.9, `G${(B.line || 0) + k + 1}`, k ? 2 : 0); });   // inside the bay: the dimension's extension lines run down the girder centre lines
    D.line(L.dk, ox - 16, oy + (hw - dg) / 2 + dg + 1.1, ox + S + 16, oy + (hw - dg) / 2 + dg + 1.1);
    const rowsT = [], DT = window.SBDDrawings;
    R.frames.forEach((e, i) => { const a = [nodeX(e.a), nodeY(e.a)], b = [nodeX(e.b), nodeY(e.b)], on = grp === e.k, lay = on ? L.gov : L.st, mx = (R.combos || []).reduce((m, c) => ({ T: Math.max(m.T, c.f[i].T), C: Math.max(m.C, c.f[i].Cc) }), { T: 0, C: 0 });
      D.line(lay, a[0], a[1], b[0], b[1]); if (on) { const dx = b[1] - a[1], dy = a[0] - b[0], n = Math.hypot(dx, dy) || 1, o = 0.5; D.line(lay, a[0] + dx / n * o, a[1] + dy / n * o, b[0] + dx / n * o, b[1] + dy / n * o); D.line(lay, a[0] - dx / n * o, a[1] - dy / n * o, b[0] - dx / n * o, b[1] - dy / n * o); }
      const t = e.k === 'diag' ? 0.27 : 0.5, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], side = e.k === 'top' ? 1 : e.k === 'bot' ? -1 : 0, ln = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nrm = [(b[1] - a[1]) / ln, -(b[0] - a[0]) / ln], sg = nrm[0] >= 0 ? 1 : -1,
        q = side ? [p[0], p[1] + side * 2.2 * h] : [p[0] + sg * nrm[0] * 2.2 * h, p[1] + sg * nrm[1] * 2.2 * h], tl = on ? L.gov : L.t;   // the number circle sits beside the member, on a short leader
      if (side) D.line(tl, p[0], p[1], q[0], q[1] - side * 1.1 * h); else D.line(tl, p[0], p[1], q[0] - sg * nrm[0] * 1.1 * h, q[1] - sg * nrm[1] * 1.1 * h); D.circle(tl, q[0], q[1], 1.1 * h); D.text(tl, q[0], q[1] - 0.45 * h, h * 0.9, `${i + 1}`, 1);
      rowsT.push([`${i + 1}`, up(e.lbl), asc((R.mem && R.mem[e.k] && R.mem[e.k].name) || ''), f1(e.L), f1(mx.T), f1(mx.C), on ? 'GOVERNS' : '']); });
        D.dimH(L.d, ox, ox + S, oy + (hw - dg) / 2 - 8 * h, oy + (hw - dg) / 2, 'S = <>'); D.dimV(L.d, oy, oy + hw, ox - 14, ox, 'h = <>');
    if (DT && DT.table) DT.table(D, L.t, ox, oy + (hw - dg) / 2 - 14 * h, ['NO.', 'MEMBER', 'SECTION', 'L (IN)', 'T (KIP)', 'C (KIP)', ''], rowsT, 'MEMBERS (LARGEST FACTORED FORCES OF THE COMBINATIONS)');
    D.text(L.t, ox, oy + hw + (dg - hw) / 2 + 10 * h, h * 1.5, `CROSS-FRAME ELEVATION, TYPE ${I.type}${opt.dia ? ' (DIAPHRAGM IN USE: SEE THE DIAPHRAGM CHECKS)' : ''}`);
    D.text(L.t, ox, oy + hw + (dg - hw) / 2 + 7.4 * h, h * 0.8, `LOOKING ALONG THE GIRDERS; WORK-POINT DEPTH h = ${f2(hw)} IN, GIRDER DEPTH d = ${f2(dg)} IN, S = ${f2(S)} IN.`);
    D.text(gov && grp ? L.gov : L.t, ox, oy + hw + (dg - hw) / 2 + 5.2 * h, h * 0.9, gov ? `GOVERNING CHECK: ${gov.c.id} ${up(gov.it.loc)}, RATIO ${f3(gov.it.r)}${grp ? ' (MEMBERS HIGHLIGHTED)' : ' (NOT A MEMBER CHECK)'}` : 'NO GOVERNING CHECK');
    return base('crossframe', 'Cross-frame elevation', D, 0, []);
  }

  /* ====================================================================================================== */
  /* Welds                                                                                                   */
  /* ====================================================================================================== */
  const maxRatio = (C, pre) => { let m = NaN; C.forEach(c => c.items.forEach(it => { if (it.step && it.step.startsWith(pre) && typeof it.r === 'number' && (!fin(m) || it.r > m || Number.isNaN(it.r))) m = it.r; })); return m; };
  /* welds(B, P, opt): B = SBDWeldsUI.build() result. The elevation with the flange-to-web fillet welds (both flanges) and the weld locations: the
     checked locations R.fw (circle) and the shop flange transitions R.tr (diamond) at their stations, coloured by the largest ratio of their checks.
     Clicks: fw, tr. */
  function welds(B, P, opt) {
    opt = opt || {}; const { D, L, G, F } = frame(P, { gi: opt.gi || 0 }), h = F.h, X = F.X, v = F.v, reg = [], sel = opt.sel || {}, R = B.R, top = F.yTop + 3 * h, ups = [], dns = [], hl = h * 0.75;
    const wl = D.layer('WELD', 30); G.segs.forEach(s => { const d = s.D * v; [0, d].forEach(y => { D.line(wl, X(s.x0), F.yB + y + 0.35 * h * (y ? -1 : 1), X(s.x1), F.yB + y + 0.35 * h * (y ? -1 : 1)); D.line(wl, X(s.x0), F.yB + y, X(s.x1), F.yB + y); }); });
    // the weld marks; their labels are flags in stacked rows (above the girder, or under the station axis for the bottom flange), set below
    const mk = [];
    R.fw.forEach(r => { const x = parseX(r.name, G.sup); if (!fin(x)) return; const xx = Math.min(Math.max(X(x), 0), X(G.L)), s = segAt(G, Math.min(Math.max(x, 1e-6), G.L - 1e-6)), rat = maxRatio(B.C, `wf${r.i}.`), lay = L[rcls(rat)], off = (/right/.test(r.name) ? 1 : /left/.test(r.name) ? -1 : 0) * 0.9 * h, y = F.yB + s.D * v / 2;
      D.circle(lay, xx + off, y, 0.6 * h); ups.push({ x: xx + off, y: y + 0.9 * h, txt: `W${r.i + 1} ${frac(r.w)}"`, lay });
      if (sel.k === 'fw' && sel.i === r.i) D.circle(L.sel, xx + off, y, 1.6 * h);
      mk.push({ k: 'fw', i: r.i, x: xx + off, y0: F.yB, y: y + 0.9 * h, rat, name: r.name, w: r.w }); });
    R.tr.forEach(r => { const x = parseX(r.name, G.sup); if (!fin(x)) return; const xx = X(x), isTop = /^Top/i.test(r.name), rat = maxRatio(B.C, `wt${r.i}.`), lay = L[rcls(rat)], s = segAt(G, Math.min(Math.max(x, 1e-6), G.L - 1e-6)), y = isTop ? F.yB + s.D * v + s.topT * v / 2 : F.yB - s.botT * v / 2;
      D.pline(lay, [[xx, y + 0.9 * h], [xx + 0.9 * h, y], [xx, y - 0.9 * h], [xx - 0.9 * h, y]], true); (isTop ? ups : dns).push({ x: xx, y: y + (isTop ? 0.9 : -0.9) * h, txt: `T${r.i + 1} ${r.cat}`, lay });
      if (sel.k === 'tr' && sel.i === r.i) D.circle(L.sel, xx, y, 1.6 * h);
      mk.push({ k: 'tr', i: r.i, x: xx, y, rat, name: r.name }); });
    const Su = stackLv(ups, h, hl), Sd = stackLv(dns, h, hl); stackDraw(D, L.t, ups, Su, top, h, hl, 1);
    mk.forEach(q => reg.push(q.k === 'fw' ? { k: 'fw', i: q.i, x0: q.x - 0.5 * h, y0: q.y - 1.45 * h, x1: q.x + 0.5 * h, y1: q.y - 0.35 * h, lab: `W${q.i + 1} ${up(q.name)}: w = ${dIn(q.w)}, RATIO ${f3(q.rat)}` }
      : { k: 'tr', i: q.i, x0: q.x - 0.8 * h, y0: q.y - 1.0 * h, x1: q.x + 0.8 * h, y1: q.y + 1.0 * h, lab: `T${q.i + 1} ${up(q.name)}: RATIO ${f3(q.rat)}` }));
    const rowB = F.alloc((2.2 + 1.5 * Sd.n) * h); stackDraw(D, L.t, dns, Sd, rowB - 1.4 * h, h, hl, -1);
    const yT0 = F.alloc(9 * h) - 2.4 * h; legend(D, L, 0, yT0, h, RLEG(L), { right: X(G.L) }); scaleBar(D, L, 0, yT0, Math.max(10, Math.round(G.L / 6 / 10) * 10), h);
    const yM = yT0 - 4 * h, t1 = 'W = FLANGE-TO-WEB WELD CHECK', x2 = 2.6 * h + TW(t1, h * 0.85, h) + 3 * h; D.circle(L.t, 0.8 * h, yM + 0.5 * h, 0.6 * h); D.text(L.t, 2.6 * h, yM, h * 0.85, t1);
    D.pline(L.t, [[x2, yM + 1.4 * h], [x2 + 1.2 * h, yM + 0.3 * h], [x2, yM - 0.8 * h], [x2 - 1.2 * h, yM + 0.3 * h]], true); D.text(L.t, x2 + 1.8 * h, yM, h * 0.85, 'T = SHOP FLANGE TRANSITION'); const x3 = x2 + 1.8 * h + TW('T = SHOP FLANGE TRANSITION', h * 0.85, h) + 3 * h; D.circle(L.sel, x3, yM + 0.5 * h, 0.6 * h); D.text(L.t, x3 + 1.2 * h, yM, h * 0.85, 'SELECTED');
    F.yTop = top + Su.n * 1.5 * h;
    F.title(`GIRDER ${(P.girders[opt.gi || 0] || {}).label || 'G1'}: WELD LOCATIONS`, `FILLET WELDS FLANGE-TO-WEB, BOTH SIDES, FULL LENGTH (ORANGE); LOCATIONS CHECKED FW1-FW4 AND TR1-TR4, COLOUR = LARGEST RATIO; VERT. EXAG. x${v.toFixed(1)}`);
    return base('welds', 'Weld locations', D, 0, reg);
  }
  /* weldDetail(B, P, opt): the flange-to-web fillet weld of location opt.i (default the governing one): the T-section of the flange and web with the
     fillet size w on both sides of the web and the minimum size of Table 6.13.3.4-1 (wmin), both flanges; the demand per inch and the resistance */
  function weldDetail(B, P, opt) {
    opt = opt || {}; const R = B.R, { D, L } = newDrawing(2.2), h = D.h; let r = R.fw.find(q => q.i === opt.i);
    if (!r) { let best = null; B.C.forEach(c => c.items.forEach(it => { const m = /^wf(\d+)\./.exec(it.step || ''); if (m && typeof it.r === 'number' && (!best || it.r > best.r)) best = { r: it.r, i: +m[1] }; })); r = R.fw.find(q => q.i === (best ? best.i : 0)) || R.fw[0]; }
    const SC = 6, part = (x0, y0, flb, flt, wmin, vu, tag) => {   // the T joint at x SC (sizes are drawn SC times larger; the text gives the true sizes)
      const fw = 44, cx = x0 + fw / 2, tf = flt * SC, tw = r.tw * SC, w = r.w * SC, dw = 26; D.text(L.t, x0, y0 + tf + 8 * h, h * 1.1, tag);
      D.rect(L.p, x0, y0, x0 + fw, y0 + tf); brk(D, L.p, x0, x0, y0, 0); D.rect(L.w, cx - tw / 2, y0 - dw, cx + tw / 2, y0);
      [-1, 1].forEach(sg => { const x = cx + sg * tw / 2; D.pline(L.s, [[x, y0], [x + sg * w, y0], [x, y0 - w]], true); });
      D.dimH(L.d, x0, x0 + fw, y0 + tf + 3 * h, y0 + tf, `b_f = ${dIn(flb)} (BROKEN)`); D.dimV(L.d, y0, y0 + tf, x0 - 2.6 * h, x0, `t_f = ${dIn(flt)}`); D.dimH(L.d, cx - tw / 2, cx + tw / 2, y0 - dw - 2.6 * h, y0 - dw, `t_w = ${dIn(r.tw)}`);
      D.dimH(L.d, cx + tw / 2, cx + tw / 2 + w, y0 - w - 3 * h, y0 - w, `w = ${dIn(r.w)}`);
      D.text(L.t, x0, y0 - dw - 7 * h, h * 0.85, `MIN. SIZE (TABLE 6.13.3.4-1): ${dIn(wmin)}; USED w = ${dIn(r.w)}`); D.text(L.t, x0, y0 - dw - 9 * h, h * 0.85, `v_u = ${f3(vu)} KIP/IN; R_r = ${f3(r.Rw)} KIP/IN`); };
    part(0, 0, r.topB, r.topT, r.wminT, r.vuT, `TOP FLANGE-TO-WEB WELD, ${up(r.name)}`);
    part(70, 0, r.botB, r.botT, r.wminB, r.vuB, 'BOTTOM FLANGE-TO-WEB WELD');
    notes(D, L.t, 0, -50, `TWO FILLET WELDS (ONE EACH SIDE OF THE WEB) PER FLANGE; THE SKETCH IS DRAWN ${SC} TIMES LARGER THAN THE PLATES (SIZES AS DIMENSIONED), NOT TO SCALE ALONG THE WEB.`, 64, h * 0.8);
    return base('weldDetail', 'Weld size detail', D, 0, []);
  }

  /* ====================================================================================================== */
  /* Field splices                                                                                           */
  /* ====================================================================================================== */
  /* the plate / bolt group a check belongs to: 'top' (TF…), 'bot' (BF…), 'web' (WS…) and the plate side (inner / outer) when its item names it */
  function spliceGroup(gov) { if (!gov) return null; const id = gov.c.id, m = /^(TF|BF|WS)/.exec(id); if (!m) return null; const loc = gov.it.loc || ''; return { g: m[1] === 'TF' ? 'top' : m[1] === 'BF' ? 'bot' : 'web', inner: /inner/i.test(loc), outer: /outer/i.test(loc), id, loc, r: gov.it.r }; }
  /* splice(s, opt): s = one of SBDSplicesUI's splice list entries (s.R: the design, s.CK the checks, s.gov the governing item). The top flange plan, the web
     splice elevation and the bottom flange plan on one drawing, the governing plate and bolt group highlighted (S-GOV) */
  /* the largest strength ratio among the bolt, plate and web checks (the rule of ui/splices.js strGov: TF1,2,4,5, BF1,2,4,5, WS1,2,4,5) */
  function strGov(CK) { let b = null; (CK || []).filter(c => /^(TF|BF)[1245]$|^WS[1245]$/.test(c.id)).forEach(c => c.items.forEach(it => { if (it.r != null && (isFinite(it.r) || (typeof it.r === 'number' && it.st === 'fail')) && (!b || (x => isFinite(x) ? x : Infinity)(it.r) > (x => isFinite(x) ? x : Infinity)(b.it.r))) b = { c, it }; })); return b; }
  function splice(s, opt) {
    opt = opt || {}; const R = s.R, { D, L } = newDrawing(3.4), h = D.h; if (!R || (R.errors && R.errors.length) || !R.fl) return base('splice', 'Field splice', D, 0, []);
    const gov = spliceGroup(opt.gov || strGov(s.CK)), gap = R.gap, W = R.web, rb = (R.bolt.dh || R.bolt.d + 0.0625) / 2, hl = g => gov && gov.g === g;
    const Lw = 2 * (W.ew + (W.ncw - 1) * W.sh + W.ewp) + gap, Lf = Math.max(R.fl.top.Lpl, R.fl.bot.Lpl, Lw), cx = Lf / 2 + 6, ctr = (x0, y0, x1, y1, on) => { D.rect(on ? L.gov : L.pl, x0, y0, x1, y1); if (on) D.rect(L.gov, x0 - 0.25, y0 - 0.25, x1 + 0.25, y1 + 0.25); };
    const plan = (F, key, y0, tag) => {   // plan of one flange splice, centre line at y0 + fw/2
      const fw = Math.max(F.bL, F.bR), cy = y0 + fw / 2, on = hl(key); D.text(L.t, 0, y0 + fw + 2 * h, h, tag);
      D.rect(L.p, cx - gap / 2 - (Lf / 2 + 2), cy - F.bL / 2, cx - gap / 2, cy + F.bL / 2); D.rect(L.p, cx + gap / 2, cy - F.bR / 2, cx + gap / 2 + (Lf / 2 + 2), cy + F.bR / 2);
      ctr(cx - F.Lpl / 2, cy - F.bo / 2, cx + F.Lpl / 2, cy + F.bo / 2, on && !gov.inner);
      if (F.inner) { const hid = D.ltype('HIDDEN'); [-1, 1].forEach(sg => D.rect(on && gov.inner ? L.gov : L.pl, cx - F.Lpl / 2, sg > 0 ? cy + F.yiI : cy - F.yiO, cx + F.Lpl / 2, sg > 0 ? cy + F.yiO : cy - F.yiI, hid)); }
      [-1, 1].forEach(sd => { for (let j = 0; j < F.nr; j++) for (let l = 0; l < F.nl; l++) [-1, 1].forEach(sy => D.circle(on ? L.gov : L.bolt, cx + sd * (gap / 2 + F.ef + j * F.s), cy + sy * (F.g0 + l * F.g), rb)); });
      D.line(L.c, 0, cy, cx * 2, cy, D.ltype('CENTER')); D.dimH(L.d, cx - F.Lpl / 2, cx + F.Lpl / 2, y0 - 2.5 * h, y0, `PL ${frac(F.bo)} x ${frac(F.to)} x <>`);
      notes(D, L.t, cx + F.Lpl / 2 + 3, cy + 1.2 * h, `${F.nl} LINES EACH SIDE x ${F.nr} ROWS, ${dIn(F.s)} PITCH${F.inner ? `; 2 INNER PL ${frac(F.bi)} x ${frac(F.ti)}` : ''}`, 24, h * 0.8);
      return fw; };
    const D0 = R.D, yWeb = 0, yTop = yWeb + D0 + 22 + 0;   // web elevation at the bottom of the layout; top flange plan above it
    // bottom flange plan below the web, top above
    const webY0 = 34, fwB = Math.max(R.fl.bot.bL, R.fl.bot.bR);
    D.rect(L.p, cx - gap / 2 - (Lf / 2 + 2), webY0, cx - gap / 2, webY0 + D0); D.rect(L.p, cx + gap / 2, webY0, cx + gap / 2 + (Lf / 2 + 2), webY0 + D0);
    const on = hl('web'), py = webY0 + (D0 - W.hw) / 2; ctr(cx - Lw / 2, py, cx + Lw / 2, py + W.hw, on);
    W.bolts.forEach(b => [-1, 1].forEach(sd => D.circle(on ? L.gov : L.bolt, cx + sd * (gap / 2 + W.xbar) + b.dx, py + W.hw / 2 + b.dy, rb)));
    D.text(L.t, 0, webY0 + D0 + 2 * h, h, `WEB SPLICE (ELEVATION)${on ? ': GOVERNS' : ''}`); notes(D, L.t, cx + Lw / 2 + 3, webY0 + D0 / 2 + 1.2 * h, `2 PL ${frac(W.hw)} x ${frac(W.twp)}; ${W.nrw} ROWS x ${W.ncw} COL. EACH SIDE`, 24, h * 0.8);
    D.dimV(L.d, py, py + W.hw, cx - Lw / 2 - 5 * h, cx - Lw / 2, `PL <>`); D.dimH(L.d, cx - gap / 2, cx + gap / 2, webY0 - 2.6 * h, webY0, `GAP <>`);
    // two columns: the web splice elevation at the left; the flange plans at its right (top plan above the bottom plan), so the sketch is wide rather than tall
    const dx = Lf + 12 + 48, yB0 = webY0 + 4, yT0 = yB0 + Math.max(R.fl.bot.bL, R.fl.bot.bR) + 12 * h;
    const b0 = D.E.length; plan(R.fl.bot, 'bot', 0, `BOTTOM FLANGE SPLICE (PLAN)${hl('bot') ? ': GOVERNS' : ''}`); D.move(b0, dx, yB0);
    const t0 = D.E.length; plan(R.fl.top, 'top', 0, `TOP FLANGE SPLICE (PLAN)${hl('top') ? ': GOVERNS' : ''}`); D.move(t0, dx, yT0);
    const ty = Math.max(webY0 + D0 + 6 * h, yT0 + Math.max(R.fl.top.bL, R.fl.top.bR) + 6 * h);
    D.text(L.t, 0, ty + 2.4 * h + 1.4 * h, h * 1.3, `${up(s.name || 'FIELD SPLICE')}`);
    notes(D, gov ? L.gov : L.t, 0, ty, gov ? `GOVERNING STRENGTH CHECK: ${gov.id} ${up(gov.loc)}, RATIO ${f3(gov.r)} (HIGHLIGHTED)` : 'NO STRENGTH CHECK GOVERNS', 60, h * 0.9);
    D.text(L.t, 0, -8 * h, h * 0.8, `BOLTS ${frac(R.bolt.d)} IN, ${(s.p && s.p.bolts && s.p.bolts.gr) || ''}; SKETCH TO SCALE IN INCHES`);
    return base('splice', 'Field splice', D, 0, []);
  }

  /* ====================================================================================================== */
  /* Rating                                                                                                  */
  /* ====================================================================================================== */
  /* the RF of one kind of row along the girder: min at each station (the load-rating factor of the governing check there) */
  function rfSeries(rows, kind, key) { const m = new Map(); rows.forEach(r => { if (r.kind !== kind || !fin(r.x)) return; const v = r[key]; if (v == null || Number.isNaN(v)) return; const k = +r.x.toFixed(3); m.set(k, Math.min(m.has(k) ? m.get(k) : Infinity, v)); }); return [...m.entries()].sort((a, b) => a[0] - b[0]); }
  /* ratingChart(B, P, opt): B = SBDRatingUI.build() result: RF along the girder (SBDGraphics.chart), Inventory and Operating, flexure and shear, RF = 1.0
     marked (the governing rows of B.sum circled). Values above opt.cap (default 5) are drawn at the top edge. */
  function ratingChart(B, P, opt) {
    opt = opt || {}; const sup = B.pl && B.pl.member && B.pl.member.supports ? B.pl.member.supports : geoProject(P, opt.gi || 0).sup, Lg = sup[sup.length - 1], Lin = Lg * 12, h = Lin * 0.024;
    const cap = opt.cap || 5, ser = [['flex', 'inv', 5, undefined, 'INVENTORY, FLEXURE'], ['shear', 'inv', 3, undefined, 'INVENTORY, SHEAR'], ['flex', 'opr', 5, 'DASHED', 'OPERATING, FLEXURE'], ['shear', 'opr', 3, 'DASHED', 'OPERATING, SHEAR']];
    const data = ser.map(q => rfSeries(B.rows, q[0], q[1])); let ymax = 0; data.forEach(s => s.forEach(p => { if (fin(p[1])) ymax = Math.max(ymax, Math.min(p[1], cap)); })); ymax = Math.max(2, Math.ceil(ymax * 1.05 * 2) / 2);
    const C = chartOver({ at: [0, 0], w: Lin, hgt: Lin * 0.16, h, xr: [0, Lg], yr: [0, ymax], ystep: ymax > 6 ? 1 : 0.5, xstep: niceStep(0, Lg, 10), file: 'rating-chart', xlab: 'STATION ALONG THE GIRDER (FT)', ylab: 'RATING FACTOR RF',
      title: `GIRDER ${(P.girders[opt.gi || 0] || {}).label || 'G1'}: LOAD RATING FACTOR ALONG THE GIRDER (LRFR)`, vlines: sup.map((x, k) => ({ x, label: supName(k, sup.length) })), limits: [{ y: 1, label: 'RF = 1.0', color: 1 }], legend: 'below', legendExtra: [{ text: `SCALE CAPPED AT RF ${ymax}: ARROW AND DASHED CAP = VALUE ABOVE THE SCALE`, arrow: true }],
      series: ser.map((q, k) => ({ name: q[4], kind: 'line', pts: data[k], color: q[2], lt: q[3] })) });
    const D = C.D, L = layersOf(D), hh = C.h;
    const gl = []; ['inv', 'opr'].forEach(k => { const g = B.sum && B.sum.gov && B.sum.gov[k]; if (g && fin(g.x) && fin(g[k])) { const yy = C.Y(Math.min(Math.max(g[k], 0), ymax)); D.circle(L.gov, C.X(g.x), yy, 1.1 * hh); const txt = `${k === 'inv' ? 'INV' : 'OPR'} RF ${f2(g[k])} AT ${f1(g.x)} FT`; gl.push({ x: C.X(g.x) + 1.4 * hh, y: yy + 0.6 * hh, w: TW(txt, hh * 0.85, hh) + 0.4 * hh, hh: hh * 0.85, txt }); } });
    window.SBDGraphics.declutter(gl, { gap: 0.3 * hh }).forEach((yb, i) => D.text(L.gov, gl[i].x, yb, gl[i].hh, gl[i].txt, 0));
    // click regions: one band per station, selecting the row with the smallest Inventory RF there (flexure or shear): the Rating tab's S.sel is a row index
    const best = new Map(); B.rows.forEach((r, i) => { if ((r.kind !== 'flex' && r.kind !== 'shear') || !fin(r.x) || r.oos) return; const k = +r.x.toFixed(3), v = fin(r.inv) ? r.inv : Infinity; if (!best.has(k) || v < best.get(k).v) best.set(k, { v, i }); });
    const xs = [...best.keys()].sort((a, b) => a - b), reg = [];
    xs.forEach((x, j) => { const a = j ? (xs[j - 1] + x) / 2 : 0, b = j < xs.length - 1 ? (x + xs[j + 1]) / 2 : Lg, r = B.rows[best.get(x).i];
      reg.push({ k: 'rt', i: best.get(x).i, x0: C.X(a), y0: C.plot[1], x1: C.X(b), y1: C.plot[3], lab: `${up(r.name)}: ${up(r.title)}: INV ${fin(r.inv) ? f2(r.inv) : '-'}, OPR ${fin(r.opr) ? f2(r.opr) : '-'}` }); });
    if (opt.sel != null && B.rows[opt.sel] && fin(B.rows[opt.sel].x)) { const x = C.X(B.rows[opt.sel].x); D.line(L.sel, x, C.plot[1], x, C.plot[3]); D.circle(L.sel, x, C.plot[1], 0.6 * hh); }
    return base('ratingChart', 'Rating factor along the girder', D, 0, reg, `The scale is capped at RF ${ymax}; a value above it is shown by an arrow and a dashed cap at the top edge.`);
  }

  /* ====================================================================================================== */
  /* Report summary                                                                                          */
  /* ====================================================================================================== */
  const MODS = { Analysis: 'AN', Flexure: 'FLEX', 'Shear & stiffeners': 'SHEAR', 'Fatigue & studs': 'FAT', 'Cross-frames': 'XF', 'Field splices': 'SPL', Welds: 'WELD', Rating: 'RATING', Constructibility: 'CONSTR' };
  const sumLabel = q => { const t = asc(q.check), id = /\b(GS\d+|TS\d+|CP\d+|BS\d+|FA\d+|SC\d+|CF\d+|FW\d|TR\d|BF\d|TF\d|WS\d|SA\d+|DT\d+|MT\d)\b/.exec(t), inv = /^Inventory/i.test(t) ? 'INV' : /^Operating/i.test(t) ? 'OPR' : '';
    return `${MODS[q.mod] || up(q.mod).slice(0, 8)} ${inv || (id ? id[1] : /^Panel/i.test(t) ? 'PANEL' : up(t).slice(0, 10))}`; };
  /* summary(M, P, opt): M = SBDReportBuild.model() result (its gov rows: the governing check of each group with its location). A small elevation with
     the regions (each span, each support) and, above it, the governing checks whose location lies in the region, with their ratio (RF for rating) */
  function summary(M, P, opt) {
    opt = opt || {}; const { D, L, G, F } = frame(P, { gi: opt.gi || 0 }), h = F.h, X = F.X, reg = [], rows = M.gov || [], n = G.sup.length, GR = window.SBDGraphics;
    const regionOf = (x, name) => { const t = String(name || ''); let m = /Abut\. (\d)/i.exec(t); if (m) return { k: 'sup', i: +m[1] === 1 ? 0 : n - 1 }; m = /Pier (\d)/i.exec(t); if (m && +m[1] < n) return { k: 'sup', i: +m[1] }; if (!fin(x)) return null;
      for (let k = 0; k < n - 1; k++) if (x <= G.sup[k + 1] + 1e-6) return { k: 'span', i: k }; return { k: 'span', i: n - 2 }; };
    const buckets = new Map(), gen = []; rows.forEach(q => { const x0 = parseX(q.loc, G.sup), x = fin(x0) ? x0 : parseX(q.check, G.sup), rg = regionOf(x, fin(x0) ? q.loc : q.check); if (!rg) { gen.push(q); return; } const key = rg.k + rg.i; if (!buckets.has(key)) buckets.set(key, { rg, rows: [] }); buckets.get(key).rows.push({ q, x }); });
    // region bands: SBDGraphics.ratioLayer, one item per span: the largest ratio of its governing checks (a rating factor counts as 1 / RF)
    const items = []; for (let k = 0; k < n - 1; k++) { const b = buckets.get('span' + k); if (!b) continue; const rs = b.rows.map(o => (o.q.rf != null ? (fin(o.q.rf) && o.q.rf > 0 ? 1 / o.q.rf : Infinity) : o.q.r)).filter(v => fin(v) || v === Infinity);
      if (rs.length) { const r = Math.max(...rs); items.push({ x: (G.sup[k] + G.sup[k + 1]) / 2, x0: G.sup[k], x1: G.sup[k + 1], ratio: r, ok: r <= 1 + 1e-9, label: `SPAN ${k + 1}` }); } }
    if (GR && items.length) GR.ratioLayer(F.E, items, { hatch: false, what: 'WORST CHECK OF THE SPAN' });
    // the governing checks: flags above the girder, one per check at its location, in stacked rows (the rightmost lowest) on leaders from a small mark on the web
    const top = F.yTop + 3 * h, fl = [], hl = h * 0.8;
    [...buckets.values()].forEach(b => { const xc = b.rg.k === 'sup' ? G.sup[b.rg.i] : (G.sup[b.rg.i] + G.sup[b.rg.i + 1]) / 2;
      b.rows.forEach(o => { const q = o.q, v = q.rf != null ? `RF ${fin(q.rf) ? f2(q.rf) : '-'}` : f3(q.r), cl = q.rf != null ? (!fin(q.rf) ? 'na' : rcls(q.rf > 0 ? 1 / q.rf : Infinity)) : rcls(q.r), xo = fin(o.x) ? o.x : xc, xx = X(xo), yw = F.yB + F.Dw(Math.min(Math.max(xo, 1e-6), G.L - 1e-6));
        D.circle(L[cl], xx, yw, 0.4 * h); fl.push({ x: xx, y: yw + 0.4 * h, txt: `${sumLabel(q)} ${v}`, lay: L[cl], q, v, yw }); }); });
    const S = stackLv(fl, h, hl); stackDraw(D, L.t, fl, S, top, h, hl, 1);
    fl.forEach((o, i) => reg.push({ k: o.q.key || 'chk', i: 0, x0: o.x - 0.6 * h, y0: o.yw, x1: o.x + TW(o.txt, hl, h), y1: top + S.lv[i] * 1.5 * h + h, lab: `${sumLabel(o.q)}: ${up(o.q.check).slice(0, 80)} ${o.v}` }));
    const yG = F.alloc(Math.max(2, gen.length) * 1.6 * h + 4 * h) - 2 * h; gen.forEach((q, i) => D.text(L.t, 0, yG - i * 1.5 * h, h * 0.8, `${sumLabel(q)}: ${up(q.check).slice(0, 70)} ${q.rf != null ? `RF ${fin(q.rf) ? f2(q.rf) : '-'}` : f3(q.r)}`));
    const yL = F.alloc(5 * h) - 2.4 * h; scaleBar(D, L, 0, yL, Math.max(10, Math.round(G.L / 6 / 10) * 10), h);
    F.yTop = top + S.n * 1.5 * h;
    F.title(`GIRDER ${(P.girders[opt.gi || 0] || {}).label || 'G1'}: GOVERNING CHECKS BY REGION`, `EACH LABEL: THE GOVERNING CHECK OF A GROUP (SUMMARY TABLE) AT ITS LOCATION; RATIO <= 1.0 OK; RATING FACTORS RF >= 1.0 OK; VERT. EXAG. x${F.v.toFixed(1)}`);
    return base('summary', 'Governing checks by region', D, 0, reg);
  }

  window.SBDTabGfxB = { asc, strGov, geoOf, geoProject, ratioClass: rcls, hatch, parseX, studCount, shear, shearDetail, shearBearing, fatigue, fatigueChart, crossframe, welds, weldDetail, splice, ratingChart, summary, _internal: { newDrawing, frame, ratioFill, fitText, scaleBar, legend, base, RLEG, segAt, supName, tsStations } };
})();
