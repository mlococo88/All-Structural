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
     shear(R, P, opt), shearDetail(R, P, opt)        Shear & stiffeners: panels coloured by shear ratio, stiffener layout; stiffener sketches
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
  const rcls = r => (Number.isNaN(r) || r === Infinity ? 'ng' : !fin(r) ? 'na' : r > 1 + 1e-9 ? 'ng' : r >= 0.9 ? 'hi' : 'ok');
  const frac = v => X_().frac(v), dIn = v => `${X_().frac(v)}"`;   // sizes to the nearest 1/16 in (plate and weld sizes, as GirderDetail's frac)
  const f1 = v => (+v).toFixed(1), f2 = v => (+v).toFixed(2), f3 = v => (+v).toFixed(3);
  /* text of a result (a check title with TeX or Greek letters) as plain upper-case drafting text: the preview and the DXF both show it as written */
  const GREEK = { '\\phi': 'PHI', '\\gamma': 'GAMMA', '\\Delta': 'D', '\\ell': 'l', '\\le': '<=', '\\ge': '>=', '\\eta': 'ETA', '\\sigma': 'SIGMA', '\\lambda': 'LAMBDA', '\\rho': 'RHO' };
  const asc = s => String(s == null ? '' : s).replace(/\$([^$]*)\$/g, (m, t) => t.replace(/\\[A-Za-z]+/g, c => GREEK[c] || '').replace(/[{}\\]/g, '')).replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/[φΦ]/g, 'PHI').replace(/γ/g, 'GAMMA').replace(/[ΔδΔ]/g, 'D').replace(/ℓ/g, 'l').replace(/×/g, 'x').replace(/[–−—]/g, '-').replace(/[′’]/g, "'").replace(/∞/g, 'INF').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();
  const up = s => asc(s).toUpperCase();

  /* ---------- the drawing, its layers and the common pieces ---------- */
  function newDrawing(h) {
    const D = X_().drawing({ prefix: 'S-' }); D.h = h; D.k = h / 0.1;   // D.k: dimension ticks and linetypes scale with the text (Drawings: h = 0.10 k)
    const L = { p: D.layer('GRDR-PLAT', 4), w: D.layer('GRDR', 5), st: D.layer('GRDR-STIF', 30), s: D.layer('SPLC', 1), b: D.layer('BRNG', 8), sc: D.layer('STUD', 2), d: D.layer('DIMS', 7), t: D.layer('ANNO-TEXT', 7),
      c: D.layer('CNTR', 8), bolt: D.layer('BOLT', 2), pl: D.layer('SPLC-PLAT', 1), dk: D.layer('DECK', 7), ok: D.layer('RATIO-OK', 3), hi: D.layer('RATIO-HI', 2), ng: D.layer('RATIO-NG', 1), na: D.layer('RATIO-NA', 9),
      sel: D.layer('SEL', 30), gov: D.layer('GOV', 6), grid: D.layer('GRID', 9), ax: D.layer('CHART-AXIS', 7), s1: D.layer('CHART-1', 5), s2: D.layer('CHART-2', 3), s3: D.layer('CHART-3', 30), s4: D.layer('CHART-4', 6) };
    return { D, L };
  }
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
  const legend = (D, L, x, y, h, items) => { let xx = x; items.forEach(([lay, txt]) => { D.rect(lay, xx, y - 0.1 * h, xx + 1.6 * h, y + 1.1 * h); hatch(D, lay, xx, y - 0.1 * h, xx + 1.6 * h, y + 1.1 * h, 0.5 * h); D.text(L.t, xx + 2 * h, y, h * 0.85, txt); xx += (2.6 + txt.length * 0.82) * h; }); };
  const RLEG = (L, ratio) => [[L.ok, ratio ? 'RATIO < 0.90' : 'RF >= 1.10'], [L.hi, ratio ? '0.90 TO 1.00' : '1.00 TO 1.10'], [L.ng, ratio ? 'RATIO > 1.00 (NG)' : 'RF < 1.00 (NG)']];
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

  /* the elevation of the girder (Drawings elevation: plates, web, supports, span dimensions) with room above for marks and below for the
     station strip. Returns the frame { X, v, h, yB, Dw(x), tT(x), tB(x), yTop, yBot, Lin } */
  function elevation(D, L, G, opt) {
    opt = opt || {}; const Lin = G.L * 12, Dmax = Math.max(...G.segs.map(s => s.D));
    const h = opt.h || Math.max(8, Lin / 70), v = opt.vex || Math.max(1, Math.min(10, Lin / (9 * Dmax)));
    D.h = h; D.k = h / 0.1;
    const X = x => x * 12, S = G.segs, Dw = x => segAt(G, x).D * v, tT = x => segAt(G, x).topT * v, tB = x => segAt(G, x).botT * v, yB = 0;
    const tmax = Math.max(...S.map(s => s.topT)) * v, bmax = Math.max(...S.map(s => s.botT)) * v, yTop = Dmax * v + tmax;
    S.forEach(s => { const a = X(s.x0), b = X(s.x1), d = s.D * v;
      D.rect(L.p, a, yB + d, b, yB + d + s.topT * v); D.rect(L.p, a, yB - s.botT * v, b, yB);
      D.line(L.w, a, yB, b, yB); D.line(L.w, a, yB + d, b, yB + d); });
    S.forEach((s, k) => { const d = s.D * v, dp = k ? S[k - 1].D * v : 0; D.line(L.w, X(s.x0), yB, X(s.x0), yB + Math.max(d, dp)); if (k === S.length - 1) D.line(L.w, X(s.x1), yB, X(s.x1), yB + d); });
    G.sup.forEach((x, k) => { const t = tB(Math.min(x, G.L - 1e-6)); D.pline(L.b, [[X(x), yB - t], [X(x) - h * 0.8, yB - t - h * 1.4], [X(x) + h * 0.8, yB - t - h * 1.4]], true);
      D.text(L.t, X(x), yB - bmax - 3.4 * h, h * 0.8, supName(k, G.sup.length), 1); });
    G.sup.slice(1).forEach((x, k) => D.dimH(L.d, X(G.sup[k]), X(x), yB - bmax - 6.6 * h, yB - bmax - 1.6 * h, `SPAN ${k + 1} = <>`));
    return { X, v, h, yB, Dw, tT, tB, yTop, yBot: yB - bmax, tmax, bmax, Lin, Dmax };
  }
  const titleText = (D, L, F, title, sub) => { D.text(L.t, 0, F.yTop + 9 * F.h, F.h * 1.6, title); if (sub) D.text(L.t, 0, F.yTop + 6.6 * F.h, F.h * 0.8, sub); };

  /* ====================================================================================================== */
  /* Shear & stiffeners                                                                                      */
  /* ====================================================================================================== */
  /* the girder of a Shear-tab result: the plate changes and zAt of the demand source in use (R.gm) */
  function shearGeo(R) {
    const gm = R.gm, L = gm.sup[gm.sup.length - 1], br = [0, ...gm.chg.filter(x => x > 0 && x < L), L], segs = [];
    for (let i = 0; i < br.length - 1; i++) { const z = gm.zAt((br[i] + br[i + 1]) / 2); segs.push({ x0: br[i], x1: br[i + 1], D: z.D, tw: z.tw, topB: z.topB, topT: z.topT, botB: z.botB, botT: z.botT }); }
    return geoOf(gm.sup, segs);
  }
  /* x of each intermediate stiffener / connection plate row of R.TS (the layout's panel joints, as SBDStiffeners.stiffenerRows finds them) */
  function tsStations(R) {
    const SB = window.SBDStiffeners, out = []; if (!R.TS || !R.TS.rows) return out;
    if (R.gm.dem && SB) { const pans = R.bays.flatMap(SB.bayPanels); for (let j = 0; j < pans.length - 1; j++) if (Math.abs(pans[j + 1].p - pans[j].q) <= 0.01) out.push(pans[j].q); if (out.length === R.TS.rows.length) return out; }
    return R.TS.rows.map(r => { const m = /at ([\d.]+) ft/.exec(r.name || ''); return m ? +m[1] : NaN; });
  }
  /* shear(R, P, opt): the girder elevation with the stiffener layout, each web panel coloured by its shear ratio V_u/(φ_v V_n) (R.panels.rows[i].r),
     bearing stiffeners, a strip with the ratio of every station, and the governing items marked. Clicks: pan, loc, ts, bs. */
  function shear(R, P, opt) {
    opt = opt || {}; const G = shearGeo(R), { D, L } = newDrawing(1), F = elevation(D, L, G, opt), i0 = 0, h = F.h, X = F.X, v = F.v, reg = [], sel = opt.sel || {};
    const has = R.gm.dem, rows = R.panels.rows, gov = R.panels.gov, yS = F.yBot - 16 * h;
    // the panels: colour by ratio (or the plain panel width and d_o where there is no shear envelope)
    rows.forEach(q => { const a = X(q.p), b = X(q.q), d = Math.min(F.Dw(q.p + 1e-6), F.Dw(q.q - 1e-6)), r = has ? q.r : NaN, hh = h * Math.min(0.9, (b - a) * 0.5 / (h * 1.2));
      const show = has && (rcls(r) !== 'ok' || q === gov || (b - a) > 6.5 * h);
      if (has) ratioFill(D, L, r, a, F.yB, b, F.yB + d, Math.max(d / 3, (b - a) / 2));
      if (show && hh > 0.35 * h) fitText(D, L.t, (a + b) / 2, F.yB + d / 2, b - a, d, f2(r), hh);
      if (sel.k === 'pan' && sel.i === q.i) D.rect(L.sel, a - 0.12 * h, F.yB - 0.12 * h, b + 0.12 * h, F.yB + d + 0.12 * h);
      reg.push({ k: 'pan', i: q.i, x0: a, y0: F.yB, x1: b, y1: F.yB + d }); });
    if (has && gov) { const a = X(gov.p), b = X(gov.q), d = F.Dw((gov.p + gov.q) / 2); D.rect(L.gov, a + 0.2 * h, F.yB + 0.2 * h, b - 0.2 * h, F.yB + d - 0.2 * h); D.text(L.gov, (a + b) / 2, F.yB + d + F.tT((gov.p + gov.q) / 2) + 1.2 * h, h * 0.9, `GOVERNS: ${f3(gov.r)}`, 1); }
    // stiffeners: connection plates (Type B) solid, intermediate stiffeners (Type A) hidden, as the Drawings elevation
    const tx = tsStations(R), hid = D.ltype('HIDDEN');
    R.TS && R.TS.rows.forEach((r, i) => { const x = tx[i]; if (!fin(x)) return; const d = F.Dw(x); D.line(L.st, X(x), F.yB, X(x), F.yB + d, r.type === 'B' ? undefined : hid);
      if (sel.k === 'ts' && sel.i === i) D.circle(L.sel, X(x), F.yB + d + 1.6 * h, 0.8 * h);
      if (R.tsGov && R.tsGov.i === i) { D.circle(L.gov, X(x), F.yB + d + 1.6 * h, 0.8 * h); D.text(L.gov, X(x), F.yB + d + 3 * h, h * 0.8, `${r.type === 'B' ? 'CP' : 'TS'} ${f3(R.tsGov.it.r)}`, 1); }
      reg.push({ k: 'ts', i, x0: X(x) - 0.5 * h, y0: F.yB, x1: X(x) + 0.5 * h, y1: F.yB + d + 1.8 * h }); });
    R.BS && R.BS.rows.forEach((r, k) => { const x = G.sup[k]; if (x == null) return; const d = F.Dw(Math.min(x, G.L - 1e-6)), tp = 0.75;
      [-1, 1].forEach(sg => D.line(L.st, X(x) + sg * tp, F.yB, X(x) + sg * tp, F.yB + d)); D.text(L.t, X(x), F.yB + d + F.tT(Math.min(x, G.L - 1e-6)) + 0.6 * h, h * 0.75, `BS${k + 1} (${r.type})`, k === 0 ? 0 : k === G.sup.length - 1 ? 2 : 1);
      if (R.bsGov && R.bsGov.i === k) { D.circle(L.gov, X(x), F.yB + d + 3.4 * h, 0.8 * h); D.text(L.gov, X(x), F.yB + d + 4.6 * h, h * 0.8, `BS ${f3(R.bsGov.it.r)}`, k === 0 ? 0 : 1); }
      if (sel.k === 'bs' && sel.i === k) D.circle(L.sel, X(x), F.yB + d + 3.4 * h, 0.8 * h);
      reg.push({ k: 'bs', i: k, x0: X(x) - 1.5 * h, y0: F.yB, x1: X(x) + 1.5 * h, y1: F.yB + d + 1.8 * h }); });
    // the stations: a strip of cells coloured by each station's governing ratio (click: that station)
    D.text(L.t, 0, yS + 2.4 * h, h * 0.8, 'STATIONS (GS11, GS16, GS18): GOVERNING RATIO AT EACH');
    const st = R.stations, xs = st.map(s => s.x);
    st.forEach((s, i) => { const x = xs[i], a = i ? (xs[i - 1] + x) / 2 : x - 0.5, b = i < st.length - 1 ? (x + xs[i + 1]) / 2 : x + 0.5, r = s.gov ? s.gov.ratio : NaN, a1 = Math.max(0, a), b1 = Math.min(G.L, b);
      if (b1 <= a1) return; D.rect(L[rcls(r)], X(a1), yS, X(b1), yS + 1.6 * h); if (rcls(r) !== 'na') hatch(D, L[rcls(r)], X(a1), yS, X(b1), yS + 1.6 * h, 0.4 * h);
      if (sel.k === 'loc' && sel.i === i) D.rect(L.sel, X(a1) - 0.1 * h, yS - 0.3 * h, X(b1) + 0.1 * h, yS + 1.9 * h);
      reg.push({ k: 'loc', i, x0: X(a1), y0: yS - 0.3 * h, x1: X(b1), y1: yS + 1.9 * h }); });
    if (R.stGov) { const x = X(R.stGov.x != null ? R.stGov.x : xs[st.indexOf(R.stGov)]); D.line(L.gov, x, yS - 0.3 * h, x, yS - 2.2 * h); D.text(L.gov, x, yS - 4 * h, h * 0.8, `${R.stGov.gov.id} ${f3(R.stGov.gov.ratio)}`, 1); }
    scaleBar(D, L, 0, yS - 8 * h, Math.max(10, Math.round(G.L / 6 / 10) * 10), h);
    legend(D, L, X(G.L) * 0.4, yS - 8.2 * h, h, RLEG(L, true));
    titleText(D, L, F, `GIRDER ${P && P.girders && P.girders[(R.gm.gNo || 1) - 1] ? (P.girders[(R.gm.gNo || 1) - 1].label || 'G' + R.gm.gNo) : 'G' + R.gm.gNo}: SHEAR AND STIFFENER LAYOUT`,
      `WEB PANELS COLOURED BY V_u / (PHI_v V_n), 6.10.9; ${has ? '' : 'NO SHEAR ENVELOPE FROM THIS SOURCE (PANEL RESISTANCE ONLY); '}VERT. EXAG. x${v.toFixed(1)}; STIFFENERS: SOLID = CONNECTION PLATE, DASHED = INTERMEDIATE STIFFENER`);
    return base('shear', 'Shear and stiffener layout', D, i0, reg);
  }

  /* a zig-zag break mark across a width at height y */
  const brk = (D, l, x0, x1, y, h) => { const n = 6, pts = []; for (let i = 0; i <= n; i++) pts.push([x0 + (x1 - x0) * i / n, y + (i % 2 ? 0.5 : -0.5) * h * (i === 0 || i === n ? 0 : 1)]); D.pline(l, pts, false); };
  /* a fillet weld triangle (leg w) at the corner (x, y) opening toward (sx, sy) */
  const filletTri = (D, l, x, y, sx, sy, w) => D.pline(l, [[x, y], [x + sx * w, y], [x, y + sy * w]], true);

  /* shearDetail(R, P, opt): the stiffener sketches of the stiffener inputs (P.stiffeners types) on the plates of the girder, in true inches with
     breaks: row 1 a transverse stiffener / connection plate (plan section across the web, elevation of its ends), row 2 a bearing stiffener.
     opt.ts / opt.bs: the type letters shown (default those of the governing items of R). */
  function shearDetail(R, P, opt) {
    opt = opt || {}; const st = P.stiffeners, { D, L } = newDrawing(1.5), h = D.h;
    const tsT = opt.ts || (R.tsGov && R.TS.rows[R.tsGov.i] ? R.TS.rows[R.tsGov.i].type : 'A'), bsT = opt.bs || (R.bsGov && R.BS.rows[R.bsGov.i] ? R.BS.rows[R.bsGov.i].type : (R.BS.rows[0] || {}).type || 'A');
    const T = st.transverse.types[tsT] || st.transverse.types.A, B = st.bearing.types[bsT] || st.bearing.types.A, Dw = R.D, z = R.gm.zAt(R.gm.sup[1] || 1);
    const tw = z.tw, tf = z.topT, bf = z.topB, tfb = z.botT, bfb = z.botB, sides = +T.sides === 2 ? 2 : 1, bt = +T.bt || 6, tp = +T.tp || 0.5, w = +T.w || 0.25, gap = +T.gap || 0, cl = +T.c || 0, wf = +T.wf || 0;
    const np = Math.max(1, Math.round(+B.np || 1)), sp = +B.sp || 0, bb = +B.bt || 7, bp = +B.tp || 0.75, bw = +B.w || 0.25, bc = +B.c || 0, hid = D.ltype('HIDDEN'), cen = D.ltype('CENTER');
    const Y1 = 62, Y2 = 0, XA = 0, XB = 60;   // row bases (plan sections) and the columns
    // ---- plan sections: web a horizontal bar, flange outline hidden, plates standing on the web faces
    const plan = (x0, y0, fb, plates, ttl, lines) => {   // plates: [{ xc, w, t }] (x centre, thickness), bt = outstand
      D.text(L.t, x0, y0 + 24, h * 1.2, ttl); const cx = x0 + 15, yc = y0 + 9;
      D.rect(L.p, cx - 13, yc - tw / 2, cx + 13, yc + tw / 2); D.rect(L.p, cx - 13, yc - fb / 2, cx + 13, yc + fb / 2, hid); D.text(L.t, cx + 13.6, yc + fb / 2 - 1.2 * h, h * 0.8, 'FLANGE'); D.text(L.t, cx + 13.6, yc - 0.4 * h, h * 0.8, 'WEB');
      D.line(L.c, cx, yc - fb / 2 - 2, cx, yc + fb / 2 + 2, cen); plates(cx, yc); lines.forEach((s, i) => D.text(L.t, x0, y0 - 2.2 - i * 1.5 * h, h * 0.85, s)); return { cx, yc };
    };
    plan(XA, Y1, bf, (cx, yc) => { [1, -1].slice(0, sides).forEach(sg => { const y0 = sg > 0 ? yc + tw / 2 : yc - tw / 2 - bt, y1 = sg > 0 ? yc + tw / 2 + bt : yc - tw / 2; D.rect(L.st, cx - tp / 2, y0, cx + tp / 2, y1);
      [-1, 1].forEach(sx => filletTri(D, L.s, cx + sx * tp / 2, sg > 0 ? yc + tw / 2 : yc - tw / 2, sx, -sg, w)); });
      const sg = 1; D.dimV(L.d, yc + tw / 2, yc + tw / 2 + bt, cx + 6, cx + tp / 2, `b_t = ${dIn(bt)}`); D.dimH(L.d, cx - tp / 2, cx + tp / 2, yc + tw / 2 + bt + 2.6, yc + tw / 2 + bt, `t_p = ${dIn(tp)}`); D.dimV(L.d, yc - tw / 2, yc + tw / 2, cx - 9, cx - 8, `t_w = ${dIn(tw)}`); },
    `A  TRANSVERSE STIFFENER, TYPE ${tsT}: PLAN SECTION`, [`${sides === 2 ? 'PAIR OF PLATES, BOTH SIDES OF THE WEB' : 'PLATE ON ONE SIDE OF THE WEB'}`, `FILLET WELD TO WEB ${dIn(w)} (BOTH SIDES OF THE PLATE)`]);
    plan(XA, Y2, bfb, (cx, yc) => { const grp = (np - 1) * sp; for (let q = 0; q < np; q++) { const xq = cx - grp / 2 + q * sp; [1, -1].forEach(sg => { D.rect(L.st, xq - bp / 2, sg > 0 ? yc + tw / 2 : yc - tw / 2 - bb, xq + bp / 2, sg > 0 ? yc + tw / 2 + bb : yc - tw / 2);
      [-1, 1].forEach(sx => filletTri(D, L.s, xq + sx * bp / 2, sg > 0 ? yc + tw / 2 : yc - tw / 2, sx, -sg, bw)); }); }
      D.dimV(L.d, yc + tw / 2, yc + tw / 2 + bb, cx + grp / 2 + 6, cx + grp / 2 + bp / 2, `b_t = ${dIn(bb)}`); D.dimH(L.d, cx + grp / 2 - bp / 2, cx + grp / 2 + bp / 2, yc + tw / 2 + bb + 2.6, yc + tw / 2 + bb, `t_p = ${dIn(bp)}`);
      if (np > 1) D.dimH(L.d, cx - grp / 2, cx - grp / 2 + sp, yc - tw / 2 - bb - 3, yc - tw / 2 - bb, `${dIn(sp)} C-C`); },
    `C  BEARING STIFFENER, TYPE ${bsT}: PLAN SECTION`, [`${np} PAIR${np > 1 ? 'S' : ''} OF PLATES, ${frac(bb)} x ${frac(bp)} EACH; FILLET WELD TO WEB ${dIn(bw)}`, ({ milled: 'MILLED TO BEAR ON THE BOTTOM FLANGE', cjp: 'CJP GROOVE WELD TO THE BOTTOM FLANGE', fillet: 'FILLET WELDS ONLY TO THE BOTTOM FLANGE' })[B.conn] || '']);
    // ---- elevations: web, flange, plate, with a break
    const elev = (x0, y0, ttl, tFl, bBot, body, lines) => {   // top part: flange then web down to the break
      D.text(L.t, x0, y0 + 24, h * 1.2, ttl); const wx0 = x0 + 4, wx1 = x0 + 30, yb = y0 + 3, yt = y0 + 18;
      D.rect(L.p, wx0 - 2, yt, wx1 + 2, yt + Math.max(tFl, 0.6)); D.line(L.w, wx0, yb, wx0, yt); D.line(L.w, wx1, yb, wx1, yt); brk(D, L.w, wx0, wx1, yb, h * 0.8); D.text(L.t, wx1 + 2.5, yt + 0.2, h * 0.8, 'FLANGE'); body(wx0, wx1, yb, yt);
      lines.forEach((s, i) => D.text(L.t, x0, y0 - 2.2 - i * 1.5 * h, h * 0.85, s)); };
    elev(XB, Y1, `B  TYPE ${tsT}: ELEVATION (TOP OF THE WEB; BROKEN)`, tf, 0, (wx0, wx1, yb, yt) => {
      const xc = (wx0 + wx1) / 2, sx0 = xc - bt / 2, sx1 = xc + bt / 2, c = tsT === 'A' ? 0 : Math.min(cl, bt / 2);
      D.pline(L.st, [[sx0 + c, yt], [sx1 - c, yt], [sx1, yt - c], [sx1, yb], [sx0, yb], [sx0, yt - c]], true);
      D.text(L.t, sx1 + 2, yt - 3.2 * h, h * 0.8, `${dIn(w)} FILLET TO WEB`); [sx0, sx1].forEach(x => D.line(L.s, x, yt - (tsT === 'A' ? 0 : c), x, yb));
      if (tsT === 'B') { D.dimH(L.d, sx0, sx0 + c, yt + 2.8, yt, `CLIP ${dIn(cl)}`); D.text(L.t, sx1 + 2, yt - 1.6 * h, h * 0.8, `${dIn(wf)} FILLET TO THE FLANGE`); }
      D.dimH(L.d, sx0, sx1, yb - 2.4, yb, `b_t = ${dIn(bt)}`); },
    tsT === 'A' ? [`WEB D = ${dIn(Dw)}`, `STIFFENER-TO-WEB WELD STOPS ${dIn(gap)} SHORT OF THE TENSION FLANGE (LOWER END, NOT SHOWN)`] : [`WEB D = ${dIn(Dw)}`, 'CONNECTION PLATE WELDED TO THE FLANGES AND THE WEB']);
    elev(XB, Y2, `D  BEARING STIFFENER, TYPE ${bsT}: ELEVATION (BOTTOM OF THE WEB; BROKEN)`, 0, tfb, (wx0, wx1, yb, yt) => {
      // the bottom flange at the foot, the break at the top: mirror of the plan above (drawn upside down: flange at yb)
      D.rect(L.p, wx0 - 2, yb - Math.max(tfb, 0.6), wx1 + 2, yb); D.text(L.t, wx1 + 2.5, yb - 0.8, h * 0.8, 'BOTTOM FLANGE');
      D.line(L.w, wx0, yb, wx0, yt); D.line(L.w, wx1, yb, wx1, yt); brk(D, L.w, wx0, wx1, yt, h * 0.8);
      const xc = (wx0 + wx1) / 2, grp = (np - 1) * sp, c = Math.min(bc, bb);
      for (let q = 0; q < np; q++) { const xq = xc - grp / 2 + q * sp; D.pline(L.st, [[xq - bb / 2, yt - 1], [xq + bb / 2, yt - 1], [xq + bb / 2, yb + c], [xq + bb / 2 - c, yb], [xq - bb / 2 + c, yb], [xq - bb / 2, yb + c]], true); }
      D.dimH(L.d, xc - grp / 2 - bb / 2, xc - grp / 2 - bb / 2 + c, yb - Math.max(tfb, 0.6) - 3, yb, `CLIP ${dIn(bc)}`);
      D.text(L.t, wx1 + 2.5, yb + 3 * h, h * 0.8, `${dIn(bw)} FILLET TO WEB`); },
    [`${np} PAIR${np > 1 ? 'S' : ''}, EACH PLATE ${frac(bb)} x ${frac(bp)}; ${({ milled: 'MILLED TO BEAR', cjp: 'CJP GROOVE WELD', fillet: 'FILLET WELDS' })[B.conn] || ''}`]);
    D.text(L.t, 0, -16, h * 0.8, `DRAWN FROM THE STIFFENER INPUTS (STIFFENERS TAB): TRANSVERSE TYPE ${tsT} ${T.name || ''}, BEARING TYPE ${bsT} ${B.name || ''}; THE GIRDER PLATES t_w = ${dIn(tw)}; SKETCHES IN INCHES, NOT TO SCALE ALONG THE WEB.`);
    return base('shearDetail', 'Stiffener details', D, 0, []);
  }

  /* ====================================================================================================== */
  /* Charts in the drawing style (drafted axes, gridlines on their own layer, the same text)                */
  /* ====================================================================================================== */
  const niceStep = (a, b, n) => { const raw = (b - a) / n || 1, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
  /* chartFrame(D, L, c): axes box at (c.x0, c.y0) of c.w × c.hgt drawing inches for the ranges c.xr, c.yr; returns { sx, sy } (data -> drawing).
     c: { x0, y0, w, hgt, xr, yr, xStep, yStep, xLab, yLab, title, h, xFmt, yFmt, vlines: [x] (dashed, e.g. supports) } */
  function chartFrame(D, L, c) {
    const h = c.h, sx = x => c.x0 + (x - c.xr[0]) / (c.xr[1] - c.xr[0]) * c.w, sy = y => c.y0 + (y - c.yr[0]) / (c.yr[1] - c.yr[0]) * c.hgt, xs = c.xStep || niceStep(c.xr[0], c.xr[1], 8), ys = c.yStep || niceStep(c.yr[0], c.yr[1], 5), hid = D.ltype('HIDDEN');
    for (let y = Math.ceil(c.yr[0] / ys - 1e-9) * ys; y <= c.yr[1] + 1e-9; y += ys) { D.line(L.grid, c.x0, sy(y), c.x0 + c.w, sy(y)); D.text(L.t, c.x0 - 0.8 * h, sy(y) - 0.3 * h, h * 0.8, (c.yFmt || (v => +v.toFixed(2)))(y), 2); }
    for (let x = Math.ceil(c.xr[0] / xs - 1e-9) * xs; x <= c.xr[1] + 1e-9; x += xs) { D.line(L.grid, sx(x), c.y0, sx(x), c.y0 + c.hgt); D.text(L.t, sx(x), c.y0 - 1.6 * h, h * 0.8, (c.xFmt || (v => +v.toFixed(2)))(x), 1); }
    (c.vlines || []).forEach(x => D.line(L.c, sx(x), c.y0, sx(x), c.y0 + c.hgt, hid));
    D.rect(L.ax, c.x0, c.y0, c.x0 + c.w, c.y0 + c.hgt);
    D.text(L.t, c.x0 + c.w / 2, c.y0 - 3.4 * h, h * 0.85, c.xLab || '', 1); D.text(L.t, c.x0 - 4.2 * h, c.y0 + c.hgt / 2, h * 0.85, c.yLab || '', 1, 90);
    if (c.title) D.text(L.t, c.x0, c.y0 + c.hgt + 1.2 * h, h * 1.2, c.title);
    return { sx, sy };
  }
  const polyline = (D, l, pts, lt) => { if (pts.length > 1) D.pline(l, pts, false, lt); };
  const legendLines = (D, L, x, y, h, items) => { let xx = x; items.forEach(([lay, lt, txt]) => { D.line(lay, xx, y + 0.35 * h, xx + 2.4 * h, y + 0.35 * h, lt); D.text(L.t, xx + 3 * h, y, h * 0.85, txt); xx += (4 + txt.length * 0.82) * h; }); };

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
     stud pitch zones (pitch, rows, count) along the top flange coloured by SC1. Clicks: fa (detail), sc (zones). */
  function fatigue(R, P, opt) {
    opt = opt || {}; const G = geoProject(P, opt.gi || 0), { D, L } = newDrawing(1), F = elevation(D, L, G, opt), h = F.h, X = F.X, v = F.v, reg = [], sel = opt.sel || {};
    const fa1 = R.FC ? (R.FC.find(c => c.id === 'FA1') || { items: [] }).items : [], rows = R.FR && !R.FR.errors.length ? R.FR.rows : [];
    rows.forEach((r, i) => { const s = segAt(G, +r.x), y = (FLOC[r.loc] || FLOC.bfo)(F, s, v, r), x = X(+r.x), q = fa1[i], rat = r.exempt ? NaN : q ? q.r : NaN, lay = r.exempt ? L.na : L[rcls(rat)], lvl = (i % 3), top = y > s.D * v / 2;
      D.circle(lay, x, F.yB + y, 0.9 * h); D.circle(lay, x, F.yB + y, 0.5 * h); D.circle(lay, x, F.yB + y, 0.15 * h);
      const yl = top ? F.yTop + (3.2 + lvl * 1.5) * h + 2.4 * h : F.yBot - (3.5 + lvl * 1.5) * h - 8 * h;   // leader up (top flange / upper web) or down (bottom flange)
      const ye = top ? Math.max(F.yTop, F.yB + y) : Math.min(F.yBot - 1.6 * h, F.yB + y); D.line(lay, x, F.yB + y + (top ? 0.9 : -0.9) * h, x, yl + (top ? -0.3 : 1.1) * h);
      D.text(lay, x, yl + (top ? 0 : 0), h * 0.8, `F${i + 1} ${r.exempt ? 'EXEMPT' : f2(rat)}`, 1);
      if (sel.k === 'fa' && sel.i === i) D.circle(L.sel, x, F.yB + y, 1.5 * h);
      reg.push({ k: 'fa', i, x0: x - 1.2 * h, y0: Math.min(F.yB + y, yl) - 1.4 * h, x1: x + 1.2 * h, y1: Math.max(F.yB + y, yl) + 1.2 * h }); });
    // stud zones: a band on the top flange: pitch, rows and stud count; colour by SC1 of the zone
    const zs = R.SR && !R.SR.errors.length ? R.SR.zones : [], sc1 = R.SCC ? (R.SCC.find(c => c.id === 'SC1') || { items: [] }).items : [], yS = F.yTop + 14 * h;
    D.text(L.t, 0, yS + 3.2 * h, h * 0.8, 'SHEAR STUD PITCH ZONES (6.10.10): ROWS @ PITCH = COUNT; COLOUR = SC1 FATIGUE RATIO');
    zs.forEach((z, i) => { const a = X(z.x1), b = X(z.x2), r = sc1[i] ? sc1[i].r : NaN, n = studCount(z); ratioFill(D, L, r, a, yS, b, yS + 2 * h, 0.7 * h); D.line(L.sc, a, yS - 0.5 * h, a, yS + 2.5 * h);
      const lab = `${z.nr}@${+(+z.p).toFixed(1)}`, hh = Math.min(0.75 * h, (b - a) / (lab.length * 0.9) * 0.95); if (hh >= 0.3 * h) D.text(L.t, (a + b) / 2, yS + 2.6 * h, hh, lab, 1);
      const cl = `${n}`, hc = Math.min(0.75 * h, (b - a) / (cl.length * 0.9) * 0.95); if (hc >= 0.3 * h) D.text(L.t, (a + b) / 2, yS - 1.6 * h, hc, cl, 1);
      if (sel.k === 'sc') D.rect(L.sel, a, yS - 0.2 * h, b, yS + 2.2 * h);
      reg.push({ k: 'sc', i: 0, x0: a, y0: yS - 0.5 * h, x1: b, y1: yS + 3.4 * h }); });
    if (zs.length) { D.line(L.sc, X(zs[zs.length - 1].x2), yS - 0.5 * h, X(zs[zs.length - 1].x2), yS + 2.5 * h); D.text(L.t, X(G.L) + 1.5 * h, yS, h * 0.8, `TOTAL ${zs.reduce((s, z) => s + studCount(z), 0)} STUDS`); } else D.text(L.t, 0, yS, h * 0.8, 'NO STUD ZONES IN THESE RESULTS.');
    legend(D, L, X(G.L) * 0.35, F.yBot - 16 * h, h, RLEG(L, true)); scaleBar(D, L, 0, F.yBot - 16 * h, Math.max(10, Math.round(G.L / 6 / 10) * 10), h);
    D.text(L.t, 0, yS + 8 * h, h * 1.6, `GIRDER ${(P.girders[opt.gi || 0] || {}).label || 'G1'}: FATIGUE DETAILS AND STUD ZONES`);
    D.text(L.t, 0, yS + 5.8 * h, h * 0.8, `F1.. = THE FATIGUE DETAILS OF THE TABLE (RATIO = GAMMA(DELTA f) / (DELTA F)_n, FA1); VERT. EXAG. x${v.toFixed(1)}; PLATES OF THE PROJECT`);
    return base('fatigue', 'Fatigue details and stud zones', D, 0, reg);
  }
  /* fatigueChart(R, P, opt): γ(Δf) and (ΔF)_n of each detail along the girder, in the drawing style; marker colour = FA1 ratio */
  function fatigueChart(R, P, opt) {
    opt = opt || {}; const G = geoProject(P, opt.gi || 0), { D, L } = newDrawing(1), h = Math.max(8, G.L * 12 / 70); D.h = h; D.k = h / 0.1;
    const rows = R.FR && !R.FR.errors.length ? R.FR.rows : [], fa1 = R.FC ? (R.FC.find(c => c.id === 'FA1') || { items: [] }).items : [], Lin = G.L * 12;
    let ymax = 0; rows.forEach(r => { if (fin(r.dem)) ymax = Math.max(ymax, r.dem); if (fin(r.res)) ymax = Math.max(ymax, r.res); }); const ys = niceStep(0, ymax * 1.1 || 1, 5); ymax = Math.ceil(ymax * 1.1 / ys) * ys || 1;
    const cw = Lin, ch = Lin / 4, fr = chartFrame(D, L, { x0: 0, y0: 0, w: cw, hgt: ch, xr: [0, G.L], yr: [0, ymax], yStep: ys, xStep: niceStep(0, G.L, 10), h, xLab: 'STATION ALONG THE GIRDER (FT)', yLab: 'STRESS RANGE (KSI)', title: `GIRDER ${(P.girders[opt.gi || 0] || {}).label || 'G1'}: FATIGUE STRESS RANGE gamma(Df) vs NOMINAL RESISTANCE (DF)n`, vlines: G.sup }), reg = [];
    rows.forEach((r, i) => { const x = fr.sx(+r.x), rat = r.exempt ? NaN : fa1[i] ? fa1[i].r : NaN, lay = r.exempt ? L.na : L[rcls(rat)];
      if (fin(r.res)) { D.line(L.s2, x - 1.1 * h, fr.sy(r.res), x + 1.1 * h, fr.sy(r.res)); D.line(L.s2, x, fr.sy(r.res), x, fr.sy(r.dem), D.ltype('DASHED')); }
      if (fin(r.dem)) { D.circle(lay, x, fr.sy(r.dem), 0.8 * h); D.circle(lay, x, fr.sy(r.dem), 0.4 * h); }
      D.text(L.t, x, fr.sy(Math.max(r.dem || 0, r.res || 0)) + 1.2 * h, h * 0.75, `F${i + 1}`, 1);
      if (opt.sel && opt.sel.k === 'fa' && opt.sel.i === i) D.circle(L.sel, x, fr.sy(r.dem), 1.4 * h);
      reg.push({ k: 'fa', i, x0: x - 1.4 * h, y0: 0, x1: x + 1.4 * h, y1: ch }); });
    legendLines(D, L, 0, ch + 4.2 * h, h, [[L.s2, undefined, '(DF)n NOMINAL RESISTANCE'], [L.ok, undefined, 'gamma(Df) <= 0.9 (DF)n'], [L.hi, undefined, '0.9 TO 1.0'], [L.ng, undefined, '> 1.0 (NG)']]);
    return base('fatigueChart', 'Fatigue stress range along the girder', D, 0, reg);
  }

  /* ====================================================================================================== */
  /* Cross-frames                                                                                            */
  /* ====================================================================================================== */
  /* crossframe(B, P, opt): B = SBDFramingUI.build() result: the frame of one bay (members of B.R.frames at the work points B.R.N) between two
     girder webs, labelled (name, section, largest T / C over the load combinations); the group that governs (B's governing check: its step
     cf.top / cf.bot / cf.diag) highlighted. */
  function crossframe(B, P, opt) {
    opt = opt || {}; const R = B.R, N = R.N, I = B.I.p, { D, L } = newDrawing(4), h = D.h, S = I.S, dg = I.dg, hw = I.h, ox = 0, oy = 0;
    if (!N || !R.frames) return base('crossframe', 'Cross-frame', D, 0, []);
    const gov = (() => { let g = null; (B.C || []).forEach(c => c.items.forEach(it => { if (fin(it.r) && (it.st === 'pass' || it.st === 'fail') && (!g || it.r > g.it.r)) g = { c, it }; })); return g; })();
    const grp = gov && /^cf\.(top|bot|diag)\b/.exec(gov.it.step || '') ? /^cf\.(top|bot|diag)\b/.exec(gov.it.step)[1] : null, nodeY = n => oy + N[n][1], nodeX = n => ox + N[n][0];
    // the girder webs and flanges at each end (depth dg), the deck line at the top
    const flg = (x, ) => { D.rect(L.p, x - 8, oy + (hw - dg) / 2 + dg, x + 8, oy + (hw - dg) / 2 + dg + 1); };
    [0, S].forEach((x, k) => { const y0 = oy + (hw - dg) / 2; D.line(L.w, ox + x, y0, ox + x, y0 + dg); D.rect(L.p, ox + x - 8, y0 + dg, ox + x + 8, y0 + dg + 1.1); D.rect(L.p, ox + x - 8, y0 - 1.1, ox + x + 8, y0); D.text(L.t, ox + x, y0 - 4 * h, h * 0.9, `G${(B.line || 0) + k + 1}`, 1); });
    D.line(L.dk, ox - 16, oy + (hw - dg) / 2 + dg + 1.1, ox + S + 16, oy + (hw - dg) / 2 + dg + 1.1);
    const rowsT = [], DT = window.SBDDrawings;
    R.frames.forEach((e, i) => { const a = [nodeX(e.a), nodeY(e.a)], b = [nodeX(e.b), nodeY(e.b)], on = grp === e.k, lay = on ? L.gov : L.st, mx = (R.combos || []).reduce((m, c) => ({ T: Math.max(m.T, c.f[i].T), C: Math.max(m.C, c.f[i].Cc) }), { T: 0, C: 0 });
      D.line(lay, a[0], a[1], b[0], b[1]); if (on) { const dx = b[1] - a[1], dy = a[0] - b[0], n = Math.hypot(dx, dy) || 1, o = 0.5; D.line(lay, a[0] + dx / n * o, a[1] + dy / n * o, b[0] + dx / n * o, b[1] + dy / n * o); D.line(lay, a[0] - dx / n * o, a[1] - dy / n * o, b[0] - dx / n * o, b[1] - dy / n * o); }
      const t = e.k === 'diag' ? 0.27 : 0.5, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], side = e.k === 'top' ? 1 : e.k === 'bot' ? -1 : 0, q = [p[0], p[1] + side * 2.2 * h], tl = on ? L.gov : L.t;
      if (side) D.line(tl, p[0], p[1], q[0], q[1] - side * 1.1 * h); D.circle(tl, q[0], q[1], 1.1 * h); D.text(tl, q[0], q[1] - 0.45 * h, h * 0.9, `${i + 1}`, 1);
      rowsT.push([`${i + 1}`, up(e.lbl), asc((R.mem && R.mem[e.k] && R.mem[e.k].name) || ''), f1(e.L), f1(mx.T), f1(mx.C), on ? 'GOVERNS' : '']); });
    Object.keys(N).forEach(n => D.circle(L.t, nodeX(n), nodeY(n), 0.5));
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
    opt = opt || {}; const G = geoProject(P, opt.gi || 0), { D, L } = newDrawing(1), F = elevation(D, L, G, opt), h = F.h, X = F.X, v = F.v, reg = [], sel = opt.sel || {}, R = B.R;
    const wl = D.layer('WELD', 30); G.segs.forEach(s => { const d = s.D * v; [0, d].forEach(y => { D.line(wl, X(s.x0), F.yB + y + 0.35 * h * (y ? -1 : 1), X(s.x1), F.yB + y + 0.35 * h * (y ? -1 : 1)); D.line(wl, X(s.x0), F.yB + y, X(s.x1), F.yB + y); }); });
    R.fw.forEach((r, k) => { const x = parseX(r.name, G.sup); if (!fin(x)) return; const xx = Math.min(Math.max(X(x), 0), X(G.L)), s = segAt(G, Math.min(Math.max(x, 1e-6), G.L - 1e-6)), rat = maxRatio(B.C, `wf${r.i}.`), lay = L[rcls(rat)], off = (/right/.test(r.name) ? 1 : /left/.test(r.name) ? -1 : 0) * 0.9 * h, lvl = k % 3, y = F.yB + s.D * v / 2;
      D.circle(lay, xx + off, y, 0.9 * h); D.circle(lay, xx + off, y, 0.45 * h); D.line(lay, xx + off, y + 0.9 * h, xx + off, F.yTop + (3 + lvl * 1.6) * h); D.text(lay, xx + off, F.yTop + (3.3 + lvl * 1.6) * h, h * 0.75, `W${r.i + 1} ${frac(r.w)}"`, 1);
      if (sel.k === 'fw' && sel.i === r.i) D.circle(L.sel, xx + off, y, 1.6 * h);
      reg.push({ k: 'fw', i: r.i, x0: xx + off - 1.2 * h, y0: F.yB, x1: xx + off + 1.2 * h, y1: F.yTop + 5 * h }); });
    R.tr.forEach((r, k) => { const x = parseX(r.name, G.sup); if (!fin(x)) return; const xx = X(x), top = /^Top/i.test(r.name), rat = maxRatio(B.C, `wt${r.i}.`), lay = L[rcls(rat)], s = segAt(G, Math.min(Math.max(x, 1e-6), G.L - 1e-6)), y = top ? F.yB + s.D * v + s.topT * v / 2 : F.yB - s.botT * v / 2;
      D.pline(lay, [[xx, y + 0.9 * h], [xx + 0.9 * h, y], [xx, y - 0.9 * h], [xx - 0.9 * h, y]], true); D.text(lay, xx, top ? y + 1.6 * h + (k % 2) * 1.3 * h : y - 2.6 * h - (k % 2) * 1.3 * h, h * 0.75, `T${r.i + 1} ${r.cat}`, 1);
      if (sel.k === 'tr' && sel.i === r.i) D.circle(L.sel, xx, y, 1.6 * h);
      reg.push({ k: 'tr', i: r.i, x0: xx - 1.2 * h, y0: y - 1.4 * h, x1: xx + 1.2 * h, y1: y + 1.4 * h }); });
    const yT0 = F.yBot - 14 * h; legend(D, L, X(G.L) * 0.35, yT0, h, RLEG(L, true)); scaleBar(D, L, 0, yT0, Math.max(10, Math.round(G.L / 6 / 10) * 10), h);
    const yM = yT0 - 5 * h, xM = X(G.L) * 0.35; D.circle(L.t, xM, yM + 0.5 * h, 0.8 * h); D.text(L.t, xM + 1.6 * h, yM, h * 0.85, 'W = FLANGE-TO-WEB WELD CHECK'); D.pline(L.t, [[xM + 36 * h, yM + 1.4 * h], [xM + 37.2 * h, yM + 0.3 * h], [xM + 36 * h, yM - 0.8 * h], [xM + 34.8 * h, yM + 0.3 * h]], true); D.text(L.t, xM + 38.4 * h, yM, h * 0.85, 'T = SHOP FLANGE TRANSITION');
    D.text(L.t, 0, F.yTop + 12 * h, h * 1.6, `GIRDER ${(P.girders[opt.gi || 0] || {}).label || 'G1'}: WELD LOCATIONS`);
    D.text(L.t, 0, F.yTop + 9.6 * h, h * 0.8, `FILLET WELDS FLANGE-TO-WEB, BOTH SIDES, FULL LENGTH (ORANGE); LOCATIONS CHECKED FW1-FW4 AND TR1-TR4, COLOUR = LARGEST RATIO; VERT. EXAG. x${v.toFixed(1)}`);
    return base('welds', 'Weld locations', D, 0, reg);
  }
  /* weldDetail(B, P, opt): the flange-to-web fillet weld of location opt.i (default the governing one): the T-section of the flange and web with the
     fillet size w on both sides of the web and the minimum size of Table 6.13.3.4-1 (wmin), both flanges; the demand per inch and the resistance */
  function weldDetail(B, P, opt) {
    opt = opt || {}; const R = B.R, { D, L } = newDrawing(1.4), h = D.h; let r = R.fw.find(q => q.i === opt.i);
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
    D.text(L.t, 0, -48, h * 0.8, `TWO FILLET WELDS (ONE EACH SIDE OF THE WEB) PER FLANGE; THE SKETCH IS DRAWN ${SC} TIMES LARGER THAN THE PLATES (SIZES AS DIMENSIONED), NOT TO SCALE ALONG THE WEB.`);
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
    opt = opt || {}; const R = s.R, { D, L } = newDrawing(2.2), h = D.h; if (!R || (R.errors && R.errors.length) || !R.fl) return base('splice', 'Field splice', D, 0, []);
    const gov = spliceGroup(opt.gov || strGov(s.CK)), gap = R.gap, W = R.web, rb = (R.bolt.dh || R.bolt.d + 0.0625) / 2, hl = g => gov && gov.g === g;
    const Lw = 2 * (W.ew + (W.ncw - 1) * W.sh + W.ewp) + gap, Lf = Math.max(R.fl.top.Lpl, R.fl.bot.Lpl, Lw), cx = Lf / 2 + 6, ctr = (x0, y0, x1, y1, on) => { D.rect(on ? L.gov : L.pl, x0, y0, x1, y1); if (on) D.rect(L.gov, x0 - 0.25, y0 - 0.25, x1 + 0.25, y1 + 0.25); };
    const plan = (F, key, y0, tag) => {   // plan of one flange splice, centre line at y0 + fw/2
      const fw = Math.max(F.bL, F.bR), cy = y0 + fw / 2, on = hl(key); D.text(L.t, 0, y0 + fw + 2 * h, h, tag);
      D.rect(L.p, cx - gap / 2 - (Lf / 2 + 2), cy - F.bL / 2, cx - gap / 2, cy + F.bL / 2); D.rect(L.p, cx + gap / 2, cy - F.bR / 2, cx + gap / 2 + (Lf / 2 + 2), cy + F.bR / 2);
      ctr(cx - F.Lpl / 2, cy - F.bo / 2, cx + F.Lpl / 2, cy + F.bo / 2, on && !gov.inner);
      if (F.inner) { const hid = D.ltype('HIDDEN'); [-1, 1].forEach(sg => D.rect(on && gov.inner ? L.gov : L.pl, cx - F.Lpl / 2, sg > 0 ? cy + F.yiI : cy - F.yiO, cx + F.Lpl / 2, sg > 0 ? cy + F.yiO : cy - F.yiI, hid)); }
      [-1, 1].forEach(sd => { for (let j = 0; j < F.nr; j++) for (let l = 0; l < F.nl; l++) [-1, 1].forEach(sy => D.circle(on ? L.gov : L.bolt, cx + sd * (gap / 2 + F.ef + j * F.s), cy + sy * (F.g0 + l * F.g), rb)); });
      D.line(L.c, 0, cy, cx * 2, cy, D.ltype('CENTER')); D.dimH(L.d, cx - F.Lpl / 2, cx + F.Lpl / 2, y0 - 2.5 * h, y0, `PL ${frac(F.bo)} x ${frac(F.to)} x <>`);
      D.text(L.t, cx + F.Lpl / 2 + 3, cy, h * 0.8, `${F.nl} LINES EACH SIDE x ${F.nr} ROWS, ${dIn(F.s)} PITCH${F.inner ? `; 2 INNER PL ${frac(F.bi)} x ${frac(F.ti)}` : ''}`);
      return fw; };
    const D0 = R.D, yWeb = 0, yTop = yWeb + D0 + 22 + 0;   // web elevation at the bottom of the layout; top flange plan above it
    // bottom flange plan below the web, top above
    const webY0 = 34, fwB = Math.max(R.fl.bot.bL, R.fl.bot.bR);
    plan(R.fl.bot, 'bot', 0, `BOTTOM FLANGE SPLICE (PLAN)${hl('bot') ? ': GOVERNS' : ''}`);
    D.rect(L.p, cx - gap / 2 - (Lf / 2 + 2), webY0, cx - gap / 2, webY0 + D0); D.rect(L.p, cx + gap / 2, webY0, cx + gap / 2 + (Lf / 2 + 2), webY0 + D0);
    const on = hl('web'), py = webY0 + (D0 - W.hw) / 2; ctr(cx - Lw / 2, py, cx + Lw / 2, py + W.hw, on);
    W.bolts.forEach(b => [-1, 1].forEach(sd => D.circle(on ? L.gov : L.bolt, cx + sd * (gap / 2 + W.xbar) + b.dx, py + W.hw / 2 + b.dy, rb)));
    D.text(L.t, 0, webY0 + D0 + 2 * h, h, `WEB SPLICE (ELEVATION)${on ? ': GOVERNS' : ''}`); D.text(L.t, cx + Lw / 2 + 3, webY0 + D0 / 2, h * 0.8, `2 PL ${frac(W.hw)} x ${frac(W.twp)}; ${W.nrw} ROWS x ${W.ncw} COL. EACH SIDE`);
    D.dimV(L.d, py, py + W.hw, cx - Lw / 2 - 5 * h, cx - Lw / 2, `PL <>`); D.dimH(L.d, cx - gap / 2, cx + gap / 2, webY0 - 2.6 * h, webY0, `GAP <>`);
    const topY = webY0 + D0 + 8 * h; plan(R.fl.top, 'top', topY, `TOP FLANGE SPLICE (PLAN)${hl('top') ? ': GOVERNS' : ''}`);
    const ty = topY + Math.max(R.fl.top.bL, R.fl.top.bR) + 8 * h;
    D.text(L.t, 0, ty + 2.4 * h, h * 1.5, `${up(s.name || 'FIELD SPLICE')}`);
    D.text(gov ? L.gov : L.t, 0, ty, h * 0.9, gov ? `GOVERNING STRENGTH CHECK: ${gov.id} ${up(gov.loc)}, RATIO ${f3(gov.r)} (HIGHLIGHTED)` : 'NO STRENGTH CHECK GOVERNS');
    D.text(L.t, 0, -8 * h, h * 0.8, `BOLTS ${frac(R.bolt.d)} IN, ${(s.p && s.p.bolts && s.p.bolts.gr) || ''}; SKETCH TO SCALE IN INCHES`);
    return base('splice', 'Field splice', D, 0, []);
  }

  /* ====================================================================================================== */
  /* Rating                                                                                                  */
  /* ====================================================================================================== */
  /* the RF of one kind of row along the girder: min at each station (the load-rating factor of the governing check there) */
  function rfSeries(rows, kind, key) { const m = new Map(); rows.forEach(r => { if (r.kind !== kind || !fin(r.x)) return; const v = r[key]; if (v == null || Number.isNaN(v)) return; const k = +r.x.toFixed(3); m.set(k, Math.min(m.has(k) ? m.get(k) : Infinity, v)); }); return [...m.entries()].sort((a, b) => a[0] - b[0]); }
  /* ratingChart(B, P, opt): B = SBDRatingUI.build() result: RF along the girder, Inventory and Operating, flexure and shear, RF = 1.0 marked (the governing
     rows of B.sum marked). Values above opt.cap (default 5) are drawn at the top edge. Clicks: none (row index of the governing row is in note). */
  function ratingChart(B, P, opt) {
    opt = opt || {}; const sup = B.pl && B.pl.member && B.pl.member.supports ? B.pl.member.supports : geoProject(P, opt.gi || 0).sup, Lg = sup[sup.length - 1], { D, L } = newDrawing(1), h = Math.max(8, Lg * 12 / 70); D.h = h; D.k = h / 0.1;
    const cap = opt.cap || 5, ser = [['flex', 'inv', L.s1, undefined, 'INVENTORY, FLEXURE'], ['shear', 'inv', L.s2, undefined, 'INVENTORY, SHEAR'], ['flex', 'opr', L.s1, D.ltype('DASHED'), 'OPERATING, FLEXURE'], ['shear', 'opr', L.s2, D.ltype('DASHED'), 'OPERATING, SHEAR']];
    const data = ser.map(q => rfSeries(B.rows, q[0], q[1])); let ymax = 0; data.forEach(s => s.forEach(p => { if (fin(p[1])) ymax = Math.max(ymax, Math.min(p[1], cap)); })); ymax = Math.max(2, Math.ceil(ymax * 1.05 * 2) / 2);
    const Lin = Lg * 12, fr = chartFrame(D, L, { x0: 0, y0: 0, w: Lin, hgt: Lin / 4, xr: [0, Lg], yr: [0, ymax], yStep: ymax > 6 ? 1 : 0.5, xStep: niceStep(0, Lg, 10), h, xLab: 'STATION ALONG THE GIRDER (FT)', yLab: 'RATING FACTOR RF', title: `GIRDER ${(P.girders[opt.gi || 0] || {}).label || 'G1'}: LOAD RATING FACTOR ALONG THE GIRDER (LRFR)`, vlines: sup });
    ser.forEach((q, k) => polyline(D, q[2], data[k].map(p => [fr.sx(p[0]), fr.sy(Math.min(Math.max(p[1], 0), ymax))]), q[3]));
    D.line(L.ng, 0, fr.sy(1), Lin, fr.sy(1)); D.line(L.ng, 0, fr.sy(1) + 0.25 * h, Lin, fr.sy(1) + 0.25 * h); D.text(L.ng, Lin + 1.4 * h, fr.sy(1) - 0.3 * h, h * 0.9, 'RF = 1.0');
    ['inv', 'opr'].forEach(k => { const g = B.sum && B.sum.gov && B.sum.gov[k]; if (g && fin(g.x) && fin(g[k])) { D.circle(L.gov, fr.sx(g.x), fr.sy(Math.min(g[k], ymax)), 1.1 * h); D.text(L.gov, fr.sx(g.x), fr.sy(Math.min(g[k], ymax)) + (k === 'inv' ? -2.6 : 1.6) * h, h * 0.85, `${k === 'inv' ? 'INV' : 'OPR'} RF ${f2(g[k])} AT ${f1(g.x)} FT`, 1); } });
    legendLines(D, L, 0, Lin / 4 + 5 * h, h, ser.map(q => [q[2], q[3], q[4]]).concat([[L.ng, undefined, 'RF = 1.0']]));
    return base('ratingChart', 'Rating factor along the girder', D, 0, [], `Values above RF ${cap} are drawn at the top edge.`);
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
    opt = opt || {}; const G = geoProject(P, opt.gi || 0), { D, L } = newDrawing(1), F = elevation(D, L, G, opt), h = F.h, X = F.X, reg = [], rows = M.gov || [], n = G.sup.length;
    const regionOf = (x, name) => { const t = String(name || ''); let m = /Abut\. (\d)/i.exec(t); if (m) return { k: 'sup', i: +m[1] === 1 ? 0 : n - 1 }; m = /Pier (\d)/i.exec(t); if (m && +m[1] < n) return { k: 'sup', i: +m[1] }; if (!fin(x)) return null;
      for (let k = 0; k < n - 1; k++) if (x <= G.sup[k + 1] + 1e-6) return { k: 'span', i: k }; return { k: 'span', i: n - 2 }; };
    const buckets = new Map(), gen = []; rows.forEach(q => { const x0 = parseX(q.loc, G.sup), x = fin(x0) ? x0 : parseX(q.check, G.sup), rg = regionOf(x, fin(x0) ? q.loc : q.check); if (!rg) { gen.push(q); return; } const key = rg.k + rg.i; if (!buckets.has(key)) buckets.set(key, { rg, rows: [] }); buckets.get(key).rows.push({ q, x }); });
    // region bands under the web: span bars coloured by the largest ratio in the span
    const yR = F.yBot - 12 * h;
    for (let k = 0; k < n - 1; k++) { const b = buckets.get('span' + k), rs = b ? b.rows.filter(o => o.q.rf == null && fin(o.q.r)).map(o => o.q.r) : [], rf = b ? b.rows.filter(o => o.q.rf != null && fin(o.q.rf)).map(o => o.q.rf) : [], r = rs.length ? Math.max(...rs) : NaN, bad = rf.some(v => v < 1 - 1e-9) || r > 1 + 1e-9, hi = rf.some(v => v < 1.1) || r >= 0.9;
      const cl = rs.length || rf.length ? (bad ? 'ng' : hi ? 'hi' : 'ok') : 'na'; const a = X(G.sup[k]), z = X(G.sup[k + 1]); D.rect(L[cl], a, yR, z, yR + 2 * h); if (cl !== 'na') hatch(D, L[cl], a, yR, z, yR + 2 * h, 0.7 * h); D.text(L.t, (a + z) / 2, yR - 2 * h, h * 0.85, `SPAN ${k + 1}`, 1); }
    // the governing checks: a column of text above the girder per region, ordered by station
    const top = F.yTop + 4 * h; let maxLines = 0;
    [...buckets.values()].sort((a, b) => (a.rg.k === 'sup' ? G.sup[a.rg.i] : (G.sup[a.rg.i] + G.sup[a.rg.i + 1]) / 2) - (b.rg.k === 'sup' ? G.sup[b.rg.i] : (G.sup[b.rg.i] + G.sup[b.rg.i + 1]) / 2)).forEach((b, bi) => {
      const xc = b.rg.k === 'sup' ? G.sup[b.rg.i] : (G.sup[b.rg.i] + G.sup[b.rg.i + 1]) / 2; b.rows.sort((p, q) => (q.q.rf != null ? 1 / (q.q.rf || 1e-9) : q.q.r) - (p.q.rf != null ? 1 / (p.q.rf || 1e-9) : p.q.r)); maxLines = Math.max(maxLines, b.rows.length);
      b.rows.forEach((o, li) => { const q = o.q, v = q.rf != null ? `RF ${fin(q.rf) ? f2(q.rf) : '-'}` : f3(q.r), cl = q.rf != null ? (!fin(q.rf) ? 'na' : q.rf < 1 - 1e-9 ? 'ng' : q.rf < 1.1 ? 'hi' : 'ok') : rcls(q.r), xx = fin(o.x) ? X(o.x) : X(xc), yy = top + (2 + li * 1.5 + (bi % 2) * 0) * h;
        D.line(L[cl], xx, F.yB + F.Dw(Math.min(Math.max(o.x, 1e-6), G.L - 1e-6)) * 1, xx, yy - 0.2 * h); D.circle(L[cl], xx, F.yB + F.Dw(Math.min(Math.max(o.x, 1e-6), G.L - 1e-6)), 0.5 * h);
        D.text(L[cl], xx, yy, h * 0.75, `${sumLabel(q)} ${v}`, 1); }); });
    gen.forEach((q, i) => D.text(L.t, 0, yR - 12 * h - i * 1.5 * h, h * 0.8, `${sumLabel(q)}: ${up(q.check).slice(0, 70)} ${q.rf != null ? `RF ${fin(q.rf) ? f2(q.rf) : '-'}` : f3(q.r)}`));
    legend(D, L, X(G.L) * 0.4, yR - 6 * h, h, RLEG(L, true)); scaleBar(D, L, 0, yR - 6 * h, Math.max(10, Math.round(G.L / 6 / 10) * 10), h);
    titleText(D, L, { ...F, yTop: F.yTop + 6 * h + maxLines * 1.5 * h }, `GIRDER ${(P.girders[opt.gi || 0] || {}).label || 'G1'}: GOVERNING CHECKS BY REGION`, `EACH LABEL: THE GOVERNING CHECK OF A GROUP (SUMMARY TABLE) AT ITS LOCATION; RATIO <= 1.0 OK; RATING FACTORS RF >= 1.0 OK; VERT. EXAG. x${F.v.toFixed(1)}`);
    return base('summary', 'Governing checks by region', D, 0, reg);
  }

  window.SBDTabGfxB = { asc, strGov, geoOf, geoProject, ratioClass: rcls, hatch, parseX, studCount, shear, shearDetail, fatigue, fatigueChart, crossframe, welds, weldDetail, splice, ratingChart, summary, _internal: { newDrawing, elevation, ratioFill, fitText, scaleBar, legend, base, titleText, RLEG, segAt, supName, tsStations, shearGeo } };
})();
