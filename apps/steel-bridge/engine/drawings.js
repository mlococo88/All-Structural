/* apps/steel-bridge/engine/drawings.js — the geometry the drawings and the 3D view show, and the three drawings: framing plan, girder
   elevation, typical cross-section (window.SBDDrawings). Classic script, no DOM. Display and export only: nothing here feeds a result.
   Needs (loaded first, read at call time): shared/dxf.js (SharedDxf), engine/model.js, engine/framing.js (SBDFraming), engine/stiffeners.js
   (SBDStiffeners); engine/loads.js (SBDLoads) for the barriers, curbs, sidewalks, median and wearing surface on the cross-section;
   engine/crossframes.js (SBDCrossframes) for the diaphragm option.

   Ported 2026-10-30 from GirderDetail ("Steel Bridge Design.html"):
     - dxfPlan (anchor `function dxfPlan(D, C) {`): framing plan, girders, top flanges, support lines with skew, cross-frames, RIDOT stepped
       lines, connection plates, bearing and intermediate stiffeners, field splices, dimensions, framing tables;
     - dxfElev (anchor `function dxfElev(D, C) {`): girder elevation with plate changes, stiffeners, splices, stud zones, bearings,
       dimensions and the plate schedule;
     - dxfSection and dxfApp (anchors `function dxfSection(D, C) {`, `function dxfApp(D, xL, xR, yTop) {`), with dfFoot / dfApp
       (anchors `function dfFoot(R) {`, `function dfApp(R) {`): typical cross-section with the deck, haunch, girders and appurtenances,
       dimensions and general notes;
     - dxfTable, dxfNotes, dxfTag (helpers).
   Added 2026-10-30 (SB2-DW5): opt.k (draw at a given plot scale: the sheets of engine/sheets.js choose it) and opt.RS (the results of
   engine/sheets.js results()): the top splice plates on the plan (GirderDetail dxfPlan) and the splice plates and web bolts on the
   elevation, from the Field splices design (splR, splElev). The sheets with border and title block, the moment envelope, camber,
   weld symbols, quantities and the detail sheets are in engine/sheets.js. Sheet references ("SEE SHEET ...") are left out of the tags.

   Geometry (model()): GirderDetail draws one set of plates for every girder at the same stations. Here each cross-section girder i takes
   the plates of the plate girder that loads it (girders[j].line = i; else the first girder of the same position, exterior for G1 and
   G_nb, interior otherwise; else the first girder), and the plate, stiffener, stud and splice stations (analysis stations, ft, along the
   centerline spans) are mapped to the girder's own stations with SBDFraming.toG (proportionally within each span; the same stations when
   the girder's spans equal the centerline spans, i.e. all supports equally skewed). Decision recorded in fixlog/steel-bridge.md (SB2-DW1).

   Units: plan stations and spacings ft; drawings full size in inches (DXF units inches, $INSUNITS 1); plates in. */
(function () {
  'use strict';
  const X_ = () => window.SharedDxf;
  const nm = v => (v === '' || v == null ? NaN : +v);
  const f0 = v => (+v).toFixed(0), f2 = v => (+v).toFixed(2), f3 = v => (+v).toFixed(3);
  const frac = v => X_().frac(v), dIn = v => X_().fmtIn(v), dFI = v => X_().fmtFtIn(v);
  /* the plot scales offered (GirderDetail DXF_SC): 1" = k" */
  const SCALES = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 120, 240, 360, 480, 600, 720, 960, 1200];
  const SCALE_NAME = { 1: 'FULL SIZE', 2: '6" = 1\'-0"', 3: '4" = 1\'-0"', 4: '3" = 1\'-0"', 6: '2" = 1\'-0"', 8: '1 1/2" = 1\'-0"', 12: '1" = 1\'-0"', 16: '3/4" = 1\'-0"', 24: '1/2" = 1\'-0"',
    32: '3/8" = 1\'-0"', 48: '1/4" = 1\'-0"', 64: '3/16" = 1\'-0"', 96: '1/8" = 1\'-0"', 120: '1" = 10\'-0"', 240: '1" = 20\'-0"', 360: '1" = 30\'-0"', 480: '1" = 40\'-0"', 600: '1" = 50\'-0"',
    720: '1" = 60\'-0"', 960: '1" = 80\'-0"', 1200: '1" = 100\'-0"' };
  /* the smallest plot scale at which `len` inches fits `paper` inches */
  const scaleFor = (len, paper) => SCALES.find(k => len / k <= paper) || SCALES[SCALES.length - 1];
  const TXT = 0.10;   // plotted text height, in (GirderDetail DXF_DEF.txt)

  /* plate girder (index in P.girders) of cross-section girder i of nb */
  function plateGirderOf(P, i, nb) {
    const G = P.girders || [], ext = i === 0 || i === nb - 1;
    let j = G.findIndex(g => Number.isInteger(g.line) && g.line === i); if (j >= 0) return j;
    j = G.findIndex(g => !Number.isInteger(g.line) && (g.position === 'exterior') === ext); if (j >= 0) return j;
    return 0;
  }

  /* the appurtenance footprints across the deck (GirderDetail dfFoot + dfApp): x in ft from the left deck edge, base y0 and height h in
     inches above the deck top; barrier 34 in and railing / fence 42 in high are schematic (sch). R = SBDLoads.compute(...) */
  const APP_H = { bar: 34, rail: 42 };
  function appOf(R) {
    const b = R.b, dl = R.p.dl, D = R.dead, Wd = D.Wd, byId = id => D.per.find(L => L.id === id), out = [];
    const sw = { L: nm(dl.swL) > 0 ? nm(dl.swL) : 0, R: nm(dl.swR) > 0 ? nm(dl.swR) : 0 }, swT = { L: nm(dl.swThkL), R: nm(dl.swThkR) };
    const medW = nm(dl.medW) > 0 ? nm(dl.medW) : 0, med = { w: medW, t: nm(dl.medThk), x0: Wd / 2 - medW / 2, x1: Wd / 2 + medW / 2, joint: dl.medJoint === 'yes' };
    const ed = {}; ['L', 'R'].forEach(sd => { const e = b.edge && b.edge[sd];
      ed[sd] = e && e.mode === 'curb' ? { curb: true, cw: e.cw > 0 && e.ch > 0 ? e.cw / 12 : 0, ch: e.cw > 0 && e.ch > 0 ? e.ch : 0, rp: e.rp } : { curb: false, w: e && e.mode === 'barrier' ? (e.bw > 0 ? e.bw : 0) : b.barrier > 0 ? b.barrier : 0 }; });
    const surf = x => { for (const sd of ['L', 'R']) if (sw[sd] && (sd === 'L' ? x <= sw.L + 1e-9 : x >= Wd - sw.R - 1e-9)) return swT[sd]; if (med.w && x >= med.x0 - 1e-9 && x <= med.x1 + 1e-9) return med.t; return 0; };
    ['L', 'R'].forEach(sd => { if (!sw[sd]) return; const a = sd === 'L' ? 0 : Wd - sw[sd]; out.push({ k: 'sw', sd, x0: a, x1: a + sw[sd], y0: 0, h: swT[sd], L: byId('sw' + sd) }); });
    if (med.w) out.push({ k: 'med', x0: med.x0, x1: med.x1, y0: 0, h: med.t, joint: med.joint, L: byId('med') });
    ['L', 'R'].forEach(sd => { const e = ed[sd], y0 = sw[sd] ? swT[sd] : 0, X0 = w => sd === 'L' ? [0, w] : [Wd - w, Wd];
      if (!e.curb) { if (e.w > 0) { const [x0, x1] = X0(e.w); out.push({ k: 'bar', sd, x0, x1, y0, h: APP_H.bar, sch: true, L: byId('bar' + sd) }); } return; }
      if (e.cw > 0) { const [x0, x1] = X0(e.cw); out.push({ k: 'curb', sd, x0, x1, y0, h: e.ch, L: byId('curb' + sd) }); }
      const rl = byId('rail' + sd); if (rl) out.push({ k: 'rail', sd, x: rl.x, y0: e.cw > 0 && e.rp <= e.cw + 1e-9 ? y0 + e.ch : surf(rl.x), h: APP_H.rail, sch: true, L: rl }); });
    ['L', 'R'].forEach(sd => { const L = byId('fence' + sd); if (L) out.push({ k: 'fence', sd, x: L.x, y0: surf(L.x), h: APP_H.rail, sch: true, L }); });
    const ws = byId('ws'); if (ws) out.push({ k: 'ws', x0: ws.x0, x1: ws.x1, y0: 0, h: ws.thk > 0 ? ws.thk : 0, L: ws });
    D.per.filter(L => /^ovl\d/.test(L.id)).forEach(L => out.push({ k: 'ovl', x0: L.x0, x1: L.x1, y0: 0, h: L.thk > 0 ? L.thk : 0, L }));
    return { Wd, items: out };
  }

  /* model(P, opt): the drawing geometry of project P. opt.studZones: pitch zones [{ x1, x2 (analysis stations, ft), nr, p (in) }] (default
     P.studs.zones). Returns { errors } or { errors: [], warnings, nb, ys, sup, spans, skews, cont, splices, FR, frames, orient, girders,
     deck, app, xs, cf, stf, mat, P }. girders[i] = { i, label, y, x0, bear (own stations, ft), pg (plate girder index), ext, segs: [{ s0,
     s1 (own ft), x0, x1 (analysis ft), D, tw, topB, topT, botB, botT }], cps: [{ s, side (+1 toward G(i+1), −1 toward G(i−1)) }],
     stiff: [own ft], studs: [{ s0, s1, nr, p }], spl: [own ft], Dmax, tTmax, tBmax }. */
  function model(P, opt) {
    opt = opt || {};
    const FRM = window.SBDFraming, SB = window.SBDStiffeners, M = window.SBDModel;
    if (!FRM) return { errors: ['The framing engine is not loaded.'] };
    const L = FRM.compute(P); if (L.errors.length) return { errors: L.errors.map(e => `Framing: ${e}`) };
    const FR = L.FR, m = L.m, nb = m.nb, sup = m.sup, warnings = [];
    if (!(P.girders || []).length || !(P.girders[0].segments || []).length) return { errors: ['The project has no plate girder (Girders & plates tab).'] };
    const st = P.stiffeners || (M ? M.defaultStiffeners() : null), ly = (st && st.layout) || { web: 'unstiffened' };
    const zones0 = opt.studZones || ((P.studs || {}).zones) || [];
    const girders = FR.girders.map((g, i) => {
      const pg = plateGirderOf(P, i, nb), G = P.girders[pg], toG = x => FRM.toG(FR, i, sup, x), toX = s => FRM.toX(FR, i, sup, s);
      const segs = G.segments.map(s => ({ s0: toG(s.x0), s1: toG(s.x1), x0: s.x0, x1: s.x1, D: s.D, tw: s.tw, topB: s.topB, topT: s.topT, botB: s.botB, botT: s.botT }));
      const cps = g.pts.filter(q => q.f.type !== 'sup').map(q => ({ s: q.s, side: q.side === 'R' ? 1 : -1 })).sort((a, b) => a.s - b.s);
      const ints = [...new Set(cps.map(q => +toX(q.s).toFixed(3)))].sort((a, b) => a - b), Dmax = Math.max(...segs.map(s => s.D));
      let stiff = [];
      if (SB && ly.web !== 'unstiffened') { try { stiff = SB.girderBays(ly, Dmax, sup, m.cont, sup, ints, pg + 1).flatMap(B => SB.bayX(B)).map(toG); } catch (e) { warnings.push(`G${i + 1}: stiffener layout not drawn (${e.message}).`); } }
      const studs = zones0.filter(z => nm(z.x2) > nm(z.x1)).map(z => ({ s0: toG(+z.x1), s1: toG(+z.x2), nr: +z.nr, p: +z.p }));
      return { i, label: `G${i + 1}`, y: g.y, x0: g.x0, bear: g.bear.slice(), pg, ext: i === 0 || i === nb - 1, segs, cps, stiff, studs, spl: m.splices.map(toG), splX: m.splices.slice(), Dmax,
        tTmax: Math.max(...segs.map(s => s.topT)), tBmax: Math.max(...segs.map(s => s.botT)), ints };
    });
    const xs = P.xs || (M ? M.defaultXs(P) : {}), d = P.deck || {};
    const deck = { ts: +d.ts || 0, tdeck: +d.tdeck || +d.ts || 0, haunch: +d.haunch || 0, ohL: +xs.ohL || 0, ohR: +xs.ohR || 0, composite: d.composite !== false };
    deck.Wd = FR.ys[nb - 1] + deck.ohL + deck.ohR;
    let app = null;
    if (window.SBDLoads) { try { const LD = window.SBDLoads, q = LD.fromModel(P, { girder: 0 }), R = LD.compute(q.b, q.p);
      if (!R.errors.length) { app = appOf(R); if (Math.abs(app.Wd - deck.Wd) > 0.01) { warnings.push('The loads cross-section deck width differs from the framing: appurtenances not drawn.'); app = null; } }
      else warnings.push(`Appurtenances not drawn: ${R.errors.join(' ')}`); } catch (e) { warnings.push(`Appurtenances not drawn (${e.message}).`); } }
    const cf = P.crossframes || (M ? M.defaultCrossframes() : {}), CFm = window.SBDCrossframes;
    const dia = CFm && CFm.cfDiaOn(cf) ? { int: CFm.cfDiaSec(cf.dia), end: CFm.cfDiaSec(CFm.cfDiaEnd(cf.dia)), gap: CFm.cfDiaGap(cf.dia) } : null;
    const GR = (M && M.GRADES) || {}, mt = (P.materials || {}).steel || {};
    return { errors: [], warnings, nb, ys: FR.ys.slice(), sup: sup.slice(), spans: m.spans.slice(), skews: m.skews.slice(), cont: m.cont, splices: m.splices.slice(), FR, frames: FR.frames, orient: FR.orient,
      girders, deck, app, xs, cf: { type: cf.type || 'X', h: nm(cf.h), dia }, stf: st, mat: { top: mt.top, bot: mt.bot, web: mt.web, fc: ((P.materials || {}).concrete || {}).fc, GR }, P };
  }

  /* ---------- helpers (GirderDetail dxfTable, dxfNotes, dxfTag) ---------- */
  function table(D, l, x, y, cols, rows, title) {
    const h = D.h, ch = h * 0.8, rh = 1.5 * h; let yy = y;
    if (title) { D.text(l, x, yy, h, title); yy -= 1.7 * h; }
    const w = cols.map((c, i) => Math.max(String(c).length, ...rows.map(r => String(r[i] == null ? '' : r[i]).length)) * ch * 0.95 + 2 * ch), W = w.reduce((a, b) => a + b, 0), xs = [x];
    w.forEach(v => xs.push(xs[xs.length - 1] + v));
    const top = yy + 0.2 * h; D.line(l, x, top, x + W, top); const hy = yy - rh; cols.forEach((c, i) => D.text(l, xs[i] + ch * 0.6, yy - 1.05 * h, ch, c)); D.line(l, x, hy, x + W, hy);
    rows.forEach((r, j) => { const ry = hy - (j + 1) * rh; r.forEach((c, i) => D.text(l, xs[i] + ch * 0.6, ry + 0.45 * h, ch, c == null ? '' : c)); D.line(l, x, ry, x + W, ry); });
    const bot = hy - rows.length * rh; xs.forEach(xv => D.line(l, xv, top, xv, bot));
    return { w: Math.max(W, title ? X_().str(title).length * h * 0.95 : 0), y: bot - 1.2 * h };
  }
  function notes(D, l, x, y, title, lines, wchars) {
    const h = D.h; wchars = wchars || 70; D.text(l, x, y, h, title); let yy = y - 1.8 * h;
    lines.forEach((s, i) => { const words = X_().str(s).split(' '), out = []; let cur = '';
      words.forEach(w => { if ((cur + ' ' + w).trim().length > wchars) { out.push(cur.trim()); cur = w; } else cur += ' ' + w; }); out.push(cur.trim());
      out.forEach((ln, j) => { D.text(l, x + (j ? 2.2 * h : 0), yy, h * 0.8, j ? ln : `${i + 1}. ${ln}`); yy -= 1.35 * h; }); yy -= 0.3 * h; });
    return yy;
  }
  function tag(D, l, x, y, t, note, dx, dy) {
    dx = dx == null ? 1 : dx; dy = dy == null ? 1 : dy; const h = D.h, r = 1.1 * h, cx = x + dx * 4 * h, cy = y + dy * 4 * h;
    D.line(l, x, y, cx - dx * r * 0.7, cy - dy * r * 0.7); D.circle(l, cx, cy, r); D.text(l, cx, cy - 0.45 * h, h * 0.9, t, 1);
    if (note) D.text(l, cx + dx * (r + 0.6 * h), cy - 0.4 * h, h * 0.75, note, dx < 0 ? 2 : 0);
  }
  const segAt = (segs, s) => segs.find(q => s >= q.s0 - 1e-9 && s <= q.s1 + 1e-9) || segs[segs.length - 1];
  /* the field splice design (engine/splices.js girder(), Field splices tab) of splice k of girder g; RS = SBDSheets.results() (the results
     of g's plate girder); null when not calculated or not designed (SB2-DW5) */
  function splR(RS, g, k) {
    const r = RS && RS.pg && RS.pg[g.pg], L = r && r.spl && r.spl.list; if (!L) return null;
    const x = (g.splX || [])[k], q = L.find(s => x != null && Math.abs(s.x - x) < 1e-6) || null;
    return q && q.R && q.R.fl && !(q.R.errors && q.R.errors.length) ? q.R : null;
  }
  /* splice plates and bolts on the elevation (SB2-DW5): outer flange plates (inner plates hidden), the bolt rows of the flanges as ticks,
     the web plate with every web bolt; centered on the splice station xc; vertical exaggeration v */
  function splElev(D, R, xc, yB, sL, sR, v, h) {
    if (!R) return; const lp = D.layer('SPLC-PLAT', 1), lb = D.layer('BOLT', 2), hid = D.ltype('HIDDEN'), F = R.fl, W = R.web, gap = R.gap, rb = (R.bolt.dh || 1) / 2;
    const Dw = R.D * v, tT = Math.max(sL.topT, sR.topT) * v, tB = Math.max(sL.botT, sR.botT) * v, yTo = yB + Dw + tT + F.top.to * v, yBo = yB - tB - F.bot.to * v;
    D.rect(lp, xc - F.top.Lpl / 2, yB + Dw + tT, xc + F.top.Lpl / 2, yTo); D.rect(lp, xc - F.bot.Lpl / 2, yBo, xc + F.bot.Lpl / 2, yB - tB);
    if (F.top.inner) D.rect(lp, xc - F.top.Lpl / 2, yB + Dw - F.top.ti * v, xc + F.top.Lpl / 2, yB + Dw, hid);
    if (F.bot.inner) D.rect(lp, xc - F.bot.Lpl / 2, yB, xc + F.bot.Lpl / 2, yB + F.bot.ti * v, hid);
    [['top', yTo, 1], ['bot', yBo, -1]].forEach(([k, y, s]) => { const f = F[k];
      for (const sd of [-1, 1]) for (let r = 0; r < f.nr; r++) { const x = xc + sd * (gap / 2 + f.ef + r * f.s); D.line(lb, x, y, x, y + s * 0.6 * h); } });
    const wpL = gap + 2 * (W.ew + (W.ncw - 1) * W.sh + W.ewp), yc = yB + Dw / 2; D.rect(lp, xc - wpL / 2, yc - W.hw * v / 2, xc + wpL / 2, yc + W.hw * v / 2);
    W.bolts.forEach(b => [-1, 1].forEach(sd => D.circle(lb, xc + sd * (gap / 2 + W.xbar) + b.dx, yc + b.dy * v, rb)));
  }
  const bwName = G => (window.SBDCrossframes && G.cf.dia ? 'DIAPHRAGM' : 'CROSS-FRAME');
  const brgType = (G, k) => { const B = ((G.stf || {}).bearing || {}).types || {}; return (k === 0 || k === G.sup.length - 1 ? B.A : B.B) || { np: 1, bt: 7, tp: 0.75, sp: 0 }; };
  const tsType = (G, r) => (((G.stf || {}).transverse || {}).types || {})[r] || { bt: 6, tp: 0.5 };

  /* ---------- 1: framing plan (GirderDetail dxfPlan) ---------- */
  function plan(G, D, opt) {
    opt = opt || {};
    const FR = G.FR, nb = G.nb, wid = G.ys[nb - 1], Lx = Math.max(...G.girders.map(g => g.x0 + g.bear[g.bear.length - 1])) - Math.min(...G.girders.map(g => g.x0));
    D.k = opt.k || scaleFor(Lx * 12 * 1.15, 30); D.h = TXT * D.k; const h = D.h, i0 = D.mark();
    const ly = { g: D.layer('GRDR', 5), b: D.layer('BRNG-CNTR', 8), x: D.layer('XFRM', 3), xe: D.layer('XFRM-END', 6), s: D.layer('SPLC', 1), d: D.layer('DIMS', 7), t: D.layer('ANNO-TEXT', 7), tb: D.layer('TABL', 7) };
    const cl = D.ltype('CENTER'), X = x => x * 12, Y = y => y * 12, sup = G.sup, BW = bwName(G);
    sup.forEach((xs, k) => { const ax = X(FR.xb(k, 0)), ay = Y(G.ys[0]), bx = X(FR.xb(k, nb - 1)), by = Y(wid), L = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / L, uy = (by - ay) / L, ex = 3 * h;
      D.line(ly.b, ax - ux * ex, ay - uy * ex, bx + ux * ex, by + uy * ex, cl);
      D.line(ly.b, bx + ux * ex, by + uy * ex, bx + ux * ex, Y(wid) + 10 * h, cl); D.text(ly.t, bx + ux * ex, Y(wid) + 10.6 * h, h, k === 0 ? 'CL BRG. ABUT. 1' : k === sup.length - 1 ? 'CL BRG. ABUT. 2' : `CL PIER ${k}`, 1);
      D.text(ly.t, ax - ux * ex * 1.6, ay - uy * ex * 1.6 - 1.2 * h, h * 0.8, `SKEW ${f2(G.skews[k])}%%d`, 1); });
    FR.frames.forEach(f => D.line(f.type === 'sup' ? ly.xe : ly.x, X(f.xa), Y(G.ys[f.bay]), X(f.xc), Y(G.ys[f.bay + 1])));
    // RIDOT stepped (GirderDetail 2026-10-19): CL roadway, W.P.s, the intermediate lines parallel to CL of bearings, spacing along CL roadway
    if (FR.orient && FR.orient.some(o => o.stp)) { const yc = Y(FR.yc), lxl = D.layer('XFRM-LINE', 3);
      D.line(ly.b, X(sup[0]) - 6 * h, yc, X(sup[sup.length - 1]) + 6 * h, yc, cl); D.text(ly.t, X(sup[sup.length - 1]) + 7 * h, yc - h / 2, h, 'CL ROADWAY');
      sup.forEach(x => D.text(ly.t, X(x) + 0.6 * h, yc - 1.8 * h, h * 0.8, 'W.P.'));
      FR.orient.forEach(o => { if (!o.stp) return; const k = o.k, Lc = o.stp.Lc, at = (t, i) => { const f = t / Lc; return (1 - f) * FR.xb(k, i) + f * FR.xb(k + 1, i); };
        o.stp.ln.forEach(t => D.line(lxl, X(at(t, 0)), Y(G.ys[0]), X(at(t, nb - 1)), Y(G.ys[nb - 1]), cl));
        D.chainH(ly.d, [sup[k], ...o.stp.ln.map(t => sup[k] + t), sup[k + 1]].map(X), yc + 2 * h, yc); });
      D.text(ly.t, Math.min(...sup.map((_, k) => Math.min(X(FR.xb(k, 0)), X(FR.xb(k, nb - 1))))), Y(wid) + 16 * h, h * 0.75, `INTERMEDIATE ${BW} LINES PARALLEL TO CL OF BEARINGS (TYP.), ONE NORMAL TO THE GIRDERS IN EACH BAY. SPACING MEASURED ALONG CL ROADWAY. W.P. = CL ROADWAY ON CL BEARING.`); }
    const lf = D.layer('GRDR-FLNG', 5), lst = D.layer('GRDR-STIF', 30), lbr = D.layer('BRNG', 8), gcl = D.layer('GRDR-CNTR', 8), cp = tsType(G, 'B'), ts = tsType(G, 'A');
    G.girders.forEach((g, i) => { const gy = Y(g.y), S = g.segs;
      S.forEach((s, k) => { const x0 = X(g.x0 + s.s0), x1 = X(g.x0 + s.s1), hb = s.topB / 2; D.line(lf, x0, gy - hb, x1, gy - hb); D.line(lf, x0, gy + hb, x1, gy + hb);
        const bj = k ? Math.max(hb, S[k - 1].topB / 2) : hb; D.line(lf, x0, gy - bj, x0, gy + bj); if (k === S.length - 1) D.line(lf, x1, gy - hb, x1, gy + hb); });
      g.cps.forEach(q => { const x = X(g.x0 + q.s); D.rect(lst, x - cp.tp / 2, gy, x + cp.tp / 2, gy + q.side * (cp.bt + 0.3)); });
      g.bear.forEach((b, k) => { const bs = brgType(G, k), xc = X(g.x0 + b), sp = +bs.sp || 0, np = Math.max(1, Math.round(+bs.np || 1)), grp = (np - 1) * sp;
        for (let q = 0; q < np; q++) { const x = xc - grp / 2 + q * sp; [-1, 1].forEach(sg => D.rect(lst, x - bs.tp / 2, gy, x + bs.tp / 2, gy + sg * (bs.bt + 0.3))); }
        D.rect(lbr, xc - 0.6 * h, gy - 0.6 * h, xc + 0.6 * h, gy + 0.6 * h); });
      const sg = i === 0 ? 1 : -1; g.stiff.forEach(s => D.rect(lst, X(g.x0 + s) - ts.tp / 2, gy, X(g.x0 + s) + ts.tp / 2, gy + sg * (ts.bt + 0.3)));
      D.line(gcl, X(g.x0), gy, X(g.x0 + g.bear[g.bear.length - 1]), gy, cl); D.text(ly.t, X(g.x0 + g.bear[g.bear.length - 1]) + 2 * h, gy - h / 2, h, g.label);
      g.spl.forEach(s => D.line(ly.s, X(g.x0 + s), gy - h * 0.8, X(g.x0 + s), gy + h * 0.8));
      g.spl.forEach((s, k) => { const R = splR(opt.RS, g, k); if (R) D.rect(D.layer('SPLC-PLAT', 1), X(g.x0 + s) - R.fl.top.Lpl / 2, gy - R.fl.top.bo / 2, X(g.x0 + s) + R.fl.top.Lpl / 2, gy + R.fl.top.bo / 2); }); });
    // dimensions: girder spacing, cross-frames along G1 and Gn, splices along Gn, spans along G1
    const xMin = Math.min(...sup.map((_, k) => Math.min(X(FR.xb(k, 0)), X(FR.xb(k, nb - 1))))), g0 = G.girders[0], gN = G.girders[nb - 1];
    D.chainV(ly.d, G.ys.map(Y), xMin - 4 * h, X(g0.x0) - h); D.dimV(ly.d, Y(0), Y(wid), xMin - 8 * h, null, '<> CL-CL EXT. GIRDERS');
    D.chainH(ly.d, [...g0.bear.map(b => X(g0.x0 + b)), ...g0.cps.filter(q => q.side > 0).map(q => X(g0.x0 + q.s))], Y(0) - 3 * h, Y(0));
    D.chainH(ly.d, [...gN.bear.map(b => X(gN.x0 + b)), ...gN.cps.filter(q => q.side < 0).map(q => X(gN.x0 + q.s))], Y(wid) + 3 * h, Y(wid));
    if (gN.spl.length) { D.chainH(ly.d, [X(gN.x0 + gN.bear[0]), ...gN.spl.map(s => X(gN.x0 + s)), X(gN.x0 + gN.bear[gN.bear.length - 1])], Y(wid) + 6 * h, Y(wid));
      gN.spl.forEach((s, k) => D.text(ly.t, X(gN.x0 + s), Y(wid) + 8.4 * h, h * 0.8, `FS${k + 1}`, 1)); }
    G.spans.forEach((_, k) => D.dimH(ly.d, X(g0.x0 + g0.bear[k]), X(g0.x0 + g0.bear[k + 1]), Y(0) - 6 * h, Y(0), `SPAN ${k + 1} = <> (G1)`));
    { const f = FR.frames.find(q => q.type !== 'sup' && q.bay === 0), fe = FR.frames.find(q => q.type === 'sup' && q.bay === 0);
      if (f) tag(D, ly.t, X((f.xa + f.xc) / 2), Y((G.ys[0] + G.ys[1]) / 2), 'X', `INTERMEDIATE ${BW}`);
      if (fe) tag(D, ly.t, X((fe.xa + fe.xc) / 2), Y((G.ys[0] + G.ys[1]) / 2), 'E', `END ${BW}`, -1, 1); }
    D.text(ly.t, xMin, Y(wid) + 14 * h, h * 1.6, 'FRAMING PLAN');
    D.text(ly.t, xMin, Y(wid) + 12.4 * h, h * 0.75, `TOP FLANGES, CONNECTION PLATES, BEARING STIFFENERS AND INTERMEDIATE STIFFENERS SHOWN TO SCALE. SQUARE = BEARING. SCALE ${SCALE_NAME[D.k]} WHEN PLOTTED.`);
    g0.segs.forEach(s => D.text(ly.t, X(g0.x0 + (s.s0 + s.s1) / 2), Y(g0.y) + s.topB / 2 + 0.8 * h, h * 0.7, `TOP FL. ${frac(s.topB)} x ${frac(s.topT)}`, 1));
    // framing data tables
    const y = Y(0) - 10 * h, rows = G.girders.map(g => [g.label, ...G.spans.map((_, k) => dFI(X(g.bear[k + 1] - g.bear[k]))), dFI(X(g.bear[g.bear.length - 1] - g.bear[0])), ...g.spl.map(s => dFI(X(s - g.bear[0]))), String(g.cps.length)]);
    const t1 = table(D, ly.tb, xMin, y, ['GIRDER', ...G.spans.map((_, k) => `SPAN ${k + 1}`), 'TOTAL', ...G.splices.map((_, k) => `FS${k + 1} FROM BRG.`), BW === 'DIAPHRAGM' ? 'INT. DIAPHRAGMS' : 'INT. X-FRAMES'], rows, 'GIRDER LENGTHS ALONG GIRDER CL (CL BRG. TO CL BRG.) AND FIELD SPLICE LOCATIONS');
    table(D, ly.tb, xMin, t1.y - h, ['GIRDER', `INTERMEDIATE ${BW} LOCATIONS FROM CL BRG. ABUT. 1, ALONG GIRDER`], G.girders.flatMap(g => { const L = g.cps.map(q => dFI(X(q.s - g.bear[0]))), out = []; for (let i = 0; i < Math.max(1, L.length); i += 12) out.push([i ? '' : g.label, L.slice(i, i + 12).join(', ')]); return out; }), `${BW} LOCATIONS`);
    return { id: 'plan', title: 'Framing plan', i0, i1: D.mark(), k: D.k, h: D.h };
  }

  /* ---------- 2: girder elevation (GirderDetail dxfElev) ---------- */
  function elevation(G, D, gi, opt) {
    opt = opt || {}; const g = G.girders[gi] || G.girders[0], v = +opt.vex || 1, S = g.segs, Lg = Math.max(S[S.length - 1].s1, g.bear[g.bear.length - 1]);
    D.k = opt.k || scaleFor(Lg * 12 * 1.1, 30); D.h = TXT * D.k; const h = D.h, i0 = D.mark();
    const ly = { p: D.layer('GRDR-PLAT', 4), w: D.layer('GRDR', 5), st: D.layer('GRDR-STIF', 30), s: D.layer('SPLC', 1), b: D.layer('BRNG', 8), sc: D.layer('STUD', 2), d: D.layer('DIMS', 7), t: D.layer('ANNO-TEXT', 7), tb: D.layer('TABL', 7) };
    const X = x => x * 12, Dw = s => s.D * v, tmax = g.tTmax * v, bmax = g.tBmax * v, yTop = Math.max(...S.map(Dw)), yB = 0;
    S.forEach(s => { D.rect(ly.p, X(s.s0), yB + Dw(s), X(s.s1), yB + Dw(s) + s.topT * v); D.text(ly.t, X((s.s0 + s.s1) / 2), yTop + tmax + 0.6 * h, h * 0.8, `TOP FL. ${frac(s.topB)} x ${frac(s.topT)}`, 1); });
    S.forEach(s => { D.rect(ly.p, X(s.s0), yB - s.botT * v, X(s.s1), yB); D.text(ly.t, X((s.s0 + s.s1) / 2), yB - bmax - 1.6 * h, h * 0.8, `BOT. FL. ${frac(s.botB)} x ${frac(s.botT)}`, 1); });
    S.forEach((s, k) => { D.line(ly.w, X(s.s0), yB, X(s.s1), yB); D.line(ly.w, X(s.s0), yB + Dw(s), X(s.s1), yB + Dw(s));
      const dPrev = k ? Dw(S[k - 1]) : 0; D.line(ly.w, X(s.s0), yB, X(s.s0), yB + Math.max(Dw(s), dPrev)); if (k === S.length - 1) D.line(ly.w, X(s.s1), yB, X(s.s1), yB + Dw(s));
      if (k === 0 || s.tw !== S[k - 1].tw || s.D !== S[k - 1].D) D.text(ly.t, X((s.s0 + s.s1) / 2), yB + Dw(s) * 0.3, h * 0.8, `WEB ${frac(s.D)} x ${frac(s.tw)}`, 1); });
    const Dat = s => Dw(segAt(S, s));
    // stiffeners: connection plates at the cross-frames, bearing stiffeners at the bearings, intermediate stiffeners
    const cps = [...new Set(g.cps.map(q => +q.s.toFixed(4)))];
    cps.forEach(x => D.line(ly.st, X(x), yB, X(x), yB + Dat(x))); if (cps.length) D.text(ly.t, X(cps[0]) + 0.4 * h, yB + Dat(cps[0]) * 0.6, h * 0.7, 'CONN. PL. (TYP.)');
    g.bear.forEach((bx, k) => { const bs = brgType(G, k), sp = +bs.sp || 0, np = Math.max(1, Math.round(+bs.np || 1)), grp = (np - 1) * sp;
      for (let q = 0; q < np; q++) { const x = X(bx) - grp / 2 + q * sp; [-1, 1].forEach(sg => D.line(ly.st, x + sg * (+bs.tp || 0.75) / 2, yB, x + sg * (+bs.tp || 0.75) / 2, yB + Dat(bx))); } });
    if (g.stiff.length) { const hid = D.ltype('HIDDEN'); g.stiff.forEach(x => D.line(ly.st, X(x), yB + Dat(x) * 0.06, X(x), yB + Dat(x), hid));
      D.text(ly.t, X(g.stiff[0]) + 0.4 * h, yB + Dat(g.stiff[0]) * 0.4, h * 0.7, 'TRANS. STIFF. AS SHOWN (TYP.)'); }
    // stud zones
    const yS = yTop + tmax + 4 * h;
    g.studs.forEach(z => { const x1 = X(z.s0), x2 = X(z.s1); D.line(ly.sc, x1, yS, x2, yS); D.line(ly.sc, x1, yS - 0.4 * h, x1, yS + 0.4 * h); D.line(ly.sc, x2, yS - 0.4 * h, x2, yS + 0.4 * h);
      D.text(ly.t, (x1 + x2) / 2, yS + 0.4 * h, h * 0.75, `${z.nr} STUDS @ ${dIn(z.p)}`, 1); });
    if (!g.studs.length) D.text(ly.t, 0, yS, h * 0.75, 'STUD PITCH ZONES: NONE ENTERED (FATIGUE & STUDS INPUT TAB).');
    g.spl.forEach((s, k) => { D.line(ly.s, X(s), yB - bmax - h, X(s), yB + yTop + tmax + h); D.text(ly.t, X(s), yB + yTop + tmax + 6.6 * h, h * 0.8, `FS${k + 1}`, 1); });
    g.spl.forEach((s, k) => splElev(D, splR(opt.RS, g, k), X(s), yB, segAt(S, s - 1e-6), segAt(S, s + 1e-6), v, h));
    g.bear.forEach(bx => { const tb = segAt(S, bx).botT * v; D.pline(ly.b, [[X(bx), yB - tb], [X(bx) - h * 0.7, yB - tb - h * 1.2], [X(bx) + h * 0.7, yB - tb - h * 1.2]], true); });
    // dimensions
    const brk = list => [0, ...list].filter((x, k, a) => k === 0 || Math.abs(x - a[k - 1]) > 1e-6);
    const topBrk = S.slice(0, -1).filter((s, k) => s.topB !== S[k + 1].topB || s.topT !== S[k + 1].topT).map(s => X(s.s1)), botBrk = S.slice(0, -1).filter((s, k) => s.botB !== S[k + 1].botB || s.botT !== S[k + 1].botT).map(s => X(s.s1));
    D.chainH(ly.d, brk([...topBrk, X(S[S.length - 1].s1)]), yB + yTop + tmax + 9 * h, yB + yTop + tmax);
    D.chainH(ly.d, [X(g.bear[0]), ...g.spl.map(X), X(g.bear[g.bear.length - 1])], yB + yTop + tmax + 12 * h, yB + yTop);
    D.chainH(ly.d, brk([...botBrk, X(S[S.length - 1].s1)]), yB - bmax - 4.5 * h, yB - bmax);
    G.spans.forEach((_, k) => D.dimH(ly.d, X(g.bear[k]), X(g.bear[k + 1]), yB - bmax - 7.5 * h, yB - bmax - 1.4 * h, `SPAN ${k + 1} = <>`));
    D.dimV(ly.d, yB, yB + Dw(S[0]), -4 * h, 0, v === 1 ? 'D = <>' : `D = ${dIn(S[0].D)}`);
    if (cps.length) tag(D, ly.t, X(cps[0]), yB + Dat(cps[0]) * 0.5, 'A', 'CONN. PL.', 1, -1);
    tag(D, ly.t, X(g.bear[0]), yB + Dat(g.bear[0]) * 0.5, 'B', 'BRG. STIFF.', 1, 1);
    g.spl.forEach((sx, k) => tag(D, ly.t, X(sx), yB - bmax, `${k + 1}`, `FS${k + 1}`, 1, -1));
    D.text(ly.t, 0, yB + yTop + tmax + 16 * h, h * 1.6, `GIRDER ${g.label} ELEVATION (${g.ext ? 'EXTERIOR' : 'INTERIOR'}; PLATES OF ${String((G.P.girders[g.pg] || {}).label || '').toUpperCase() || 'GIRDER ' + (g.pg + 1)})${v !== 1 ? ` - VERTICAL SCALE x${v}` : ''}`);
    D.text(ly.t, 0, yB + yTop + tmax + 14.2 * h, h * 0.8, `STEEL: TOP FLANGE ${G.mat.top}, WEB ${G.mat.web}, BOTTOM FLANGE ${G.mat.bot}. CONNECTION PLATES AT ${bwName(G)}S; BEARING STIFFENERS AT BEARINGS. STATIONS FROM CL BRG. ABUT. 1 ALONG THE GIRDER. SCALE ${SCALE_NAME[D.k]} WHEN PLOTTED.`);
    // plate schedule
    const sched = []; [['TOP FLANGE', s => [s.topB, s.topT], G.mat.top], ['WEB', s => [s.D, s.tw], G.mat.web], ['BOTTOM FLANGE', s => [s.botB, s.botT], G.mat.bot]].forEach(([n, fz, gr]) => {
      let run = null; S.forEach(s => { const z = fz(s); if (run && run.z[0] === z[0] && run.z[1] === z[1]) run.s1 = s.s1; else { if (run) sched.push(run); run = { n, z, s0: s.s0, s1: s.s1, gr }; } }); if (run) sched.push(run); });
    table(D, ly.tb, 0, yB - bmax - 12 * h, ['PLATE', 'FROM', 'TO', 'LENGTH', 'SIZE (IN)', 'GRADE'], sched.map(r => [r.n, dFI(X(r.s0)), dFI(X(r.s1)), dFI(X(r.s1 - r.s0)), `${frac(r.z[0])} x ${frac(r.z[1])}`, r.gr]), 'PLATE SCHEDULE (STATIONS FROM CL BRG. ABUT. 1, ALONG THE GIRDER)');
    return { id: 'elev', title: `Girder ${g.label} elevation`, i0, i1: D.mark(), k: D.k, h: D.h, gi: g.i };
  }

  /* ---------- 3: typical cross-section (GirderDetail dxfSection + dxfApp) ---------- */
  function section(G, D, opt) {
    opt = opt || {}; const dk = G.deck, nb = G.nb, xg = G.ys.map(y => y * 12), W = xg[nb - 1], xL = -dk.ohL * 12, xR = W + dk.ohR * 12;
    D.k = opt.k || scaleFor((xR - xL) * 1.3, 30); D.h = TXT * D.k; const h = D.h, i0 = D.mark();
    const ly = { g: D.layer('GRDR', 5), dk: D.layer('DECK', 7), d: D.layer('DIMS', 7), t: D.layer('ANNO-TEXT', 7), c: D.layer('CNTR', 8) }, cl = D.ltype('CENTER');
    const ts = dk.ts, hh = dk.haunch, sec = G.girders.map(g => g.segs[0]), tTop = Math.max(...sec.map(s => s.topT)), yT = 0;
    D.rect(ly.dk, xL, yT + hh, xR, yT + hh + ts);
    const yA = appDraw(G, D, xL, xR, yT + hh + ts), yDk = yT + hh + ts + yA;
    let yBot = 0;
    xg.forEach((x, i) => { const s = sec[i], yt = yT - (tTop - s.topT), yb = yt - s.topT - s.D - s.botT; yBot = Math.min(yBot, yb);
      D.rect(ly.g, x - s.topB / 2, yt - s.topT, x + s.topB / 2, yt); D.rect(ly.g, x - s.tw / 2, yt - s.topT - s.D, x + s.tw / 2, yt - s.topT); D.rect(ly.g, x - s.botB / 2, yb, x + s.botB / 2, yt - s.topT - s.D);
      D.line(ly.dk, x - s.topB / 2, yt, x - s.topB / 2, yT + hh); D.line(ly.dk, x + s.topB / 2, yt, x + s.topB / 2, yT + hh); });
    xg.forEach((x, i) => { D.line(ly.c, x, yT + hh + ts + 2 * h, x, yBot - 2 * h, cl); D.text(ly.t, x, yBot - 3.8 * h, h, G.girders[i].label, 1); });
    D.chainH(ly.d, [xL, ...xg, xR], yDk + 4 * h, yT + hh + ts); D.dimH(ly.d, xL, xR, yDk + 7 * h, yT + hh + ts, '<> OUT-TO-OUT OF DECK');
    D.dimV(ly.d, yT + hh, yT + hh + ts, xR + 3 * h, xR, 'DECK <>'); if (hh > 0) D.dimV(ly.d, yT, yT + hh, xL - 3 * h, -sec[0].topB / 2, 'HAUNCH <>');
    const s0 = sec[0], yb0 = yT - (tTop - s0.topT) - s0.topT - s0.D - s0.botT;
    D.dimV(ly.d, yb0, yT - (tTop - s0.topT), -s0.topB / 2 - 4 * h, -s0.botB / 2, 'GIRDER <>'); D.dimV(ly.d, yb0 + s0.botT, yb0 + s0.botT + s0.D, s0.topB / 2 + 3 * h, s0.tw / 2, 'WEB <>');
    D.dimH(ly.d, -s0.botB / 2, s0.botB / 2, yBot - 7.5 * h, yb0, `BOT. FL. ${dIn(s0.botB)} x ${dIn(s0.botT)}`);
    D.text(ly.t, xL, yDk + 11 * h, h * 1.6, 'TYPICAL CROSS-SECTION');
    D.text(ly.t, xL, yDk + 9.3 * h, h * 0.8, `SECTION AT CL BRG. ABUT. 1 (FIRST PLATE SEGMENT OF EACH GIRDER); SEE THE PLATE SCHEDULE FOR OTHER PLATES. SCALE ${SCALE_NAME[D.k]} WHEN PLOTTED.`);
    // general notes (GirderDetail dxfSection; the data of this project)
    const P = G.P, bo = (P.splices || {}).bolts || {}, sc = P.studs || {};
    const lines = ['DESIGN SPECIFICATION: AASHTO LRFD BRIDGE DESIGN SPECIFICATIONS, 10TH EDITION (2024). LIVE LOAD: HL-93.',
      `STRUCTURAL STEEL: ASTM A709 GRADE ${G.mat.top} TOP FLANGE, ${G.mat.web} WEB, ${G.mat.bot} BOTTOM FLANGE. CHARPY V-NOTCH TESTING PER AASHTO LRFD TABLE 6.6.2.1-2 FOR THE PROJECT TEMPERATURE ZONE.`,
      nb <= 2 ? 'GIRDER TENSION FLANGES AND WEB TENSION ZONES ARE NONREDUNDANT STEEL TENSION MEMBERS (NSTM): FABRICATE UNDER THE FRACTURE CONTROL PLAN OF AASHTO/AWS D1.5 CLAUSE 12.' : `THE BRIDGE HAS ${nb} GIRDERS AND IS LOAD-PATH REDUNDANT; THERE ARE NO NONREDUNDANT STEEL TENSION MEMBERS (NSTM).`,
      `HIGH-STRENGTH BOLTS: ASTM F3125 GRADE ${X_().str(bo.gr || 'A325')}, ${frac(+bo.d || 0.875)} IN. DIAMETER, SLIP-CRITICAL CONNECTIONS WITH CLASS ${X_().str(bo.cls || 'B')} FAYING SURFACES.`,
      `SHEAR CONNECTORS: ${frac(+sc.d || 0.875)} IN. DIAMETER x ${frac(+sc.h || 6)} IN. HEADED STUDS, ASTM A108, AASHTO/AWS D1.5.`,
      `DECK: ${frac(ts)} IN. STRUCTURAL CONCRETE${dk.tdeck > ts + 1e-9 ? ` (${frac(dk.tdeck)} IN. TOTAL)` : ''}, f'c = ${f2(+G.mat.fc || 0)} KSI, HAUNCH ${frac(hh)} IN.${dk.composite ? '' : ' NONCOMPOSITE.'}`,
      'WELDING: AASHTO/AWS D1.5 BRIDGE WELDING CODE. FLANGE BUTT SPLICES CJP, GROUND FLUSH AND SMOOTH IN THE DIRECTION OF STRESS.',
      'ALL DIMENSIONS TO BE VERIFIED AGAINST THE CONTRACT DRAWINGS. GENERATED BY STEEL BRIDGE DESIGN (NEW).'];
    if (G.app && G.app.items.some(a => a.sch)) lines.push('BARRIER, RAILING AND FENCE SHAPES AND HEIGHTS ARE SCHEMATIC.');
    notes(D, ly.t, xL, yBot - 12 * h, 'GENERAL NOTES', lines, 90);
    return { id: 'sec', title: 'Typical cross-section', i0, i1: D.mark(), k: D.k, h: D.h };
  }
  /* appurtenances on the section (GirderDetail dxfApp); returns the height used above the deck top */
  function appDraw(G, D, xL, xR, yTop) {
    const A = G.app ? G.app.items : []; if (!A.length) return 0;
    const h = D.h, X = x => xL + x * 12, ly = { b: D.layer('DECK-BARR', 8), c: D.layer('DECK-CURB', 8), r: D.layer('DECK-RAIL', 1), s: D.layer('DECK-SDWK', 9), m: D.layer('DECK-MEDN', 9), w: D.layer('DECK-WSRF', 3), t: D.layer('ANNO-TEXT', 7), d: D.layer('DIMS', 7) };
    const kl = L => L ? ` (${f3(L.plf)} KLF ${L.cat}${L.ovr ? ', OVERRIDE' : ''})` : '', labs = []; let top = 0, ovY = 0, nW = 0;
    A.forEach(a => { const y0 = yTop + a.y0;
      if (a.k === 'sw' || a.k === 'med' || a.k === 'curb') { D.rect(a.k === 'sw' ? ly.s : a.k === 'med' ? ly.m : ly.c, X(a.x0), y0, X(a.x1), y0 + a.h);
        if (a.k === 'med' && a.joint) D.line(ly.m, X((a.x0 + a.x1) / 2), y0 + a.h + h, X((a.x0 + a.x1) / 2), yTop - 1.5 * h, D.ltype('HIDDEN'));
        labs.push({ x: X((a.x0 + a.x1) / 2), y: y0 + a.h, s: a.k === 'sw' ? `${a.sd === 'L' ? 'LEFT' : 'RIGHT'} SIDEWALK ${dFI((a.x1 - a.x0) * 12)} x ${dIn(a.h)}${kl(a.L)}` : a.k === 'med' ? `RAISED MEDIAN ${dFI((a.x1 - a.x0) * 12)} x ${dIn(a.h)}${kl(a.L)}${a.joint ? ', LONGIT. JOINT' : ''}` : `CURB ${dIn((a.x1 - a.x0) * 12)} x ${dIn(a.h)}${kl(a.L)}` }); }
      else if (a.k === 'bar') { const w = (a.x1 - a.x0) * 12, s = a.sd === 'L' ? 1 : -1, x0 = a.sd === 'L' ? X(a.x0) : X(a.x1), P_ = (f, g) => [x0 + s * f * w, y0 + g * a.h];
        D.pline(ly.b, [P_(0, 0), P_(0, 1), P_(0.42, 1), P_(0.62, 0.3), P_(1, 0.12), P_(1, 0)], true);
        labs.push({ x: X((a.x0 + a.x1) / 2), y: y0 + a.h, s: `BARRIER ${dFI(w)} AT DECK${kl(a.L)}, SHAPE AND HEIGHT SCHEMATIC` }); }
      else if (a.k === 'rail' || a.k === 'fence') { const x = X(a.x); D.line(ly.r, x, y0, x, y0 + a.h); D.line(ly.r, x - 3, y0 + a.h - 1.5, x + 3, y0 + a.h - 1.5); D.line(ly.r, x - 3, y0 + a.h * 0.55, x + 3, y0 + a.h * 0.55);
        labs.push({ x, y: y0 + a.h, s: `${a.k === 'rail' ? 'RAILING' : 'SIDEWALK RAILING OR FENCE'} AT ${dFI((a.sd === 'L' ? a.x : G.app.Wd - a.x) * 12)} FROM DECK EDGE${kl(a.L)}, HEIGHT SCHEMATIC` }); }
      else { const t = a.h > 0 ? a.h : 0, yb = yTop + ovY, x0 = X(a.x0), x1 = X(a.x1), q = a.L && a.L.q != null ? a.L.q : a.L ? a.L.plf * 1000 / (a.x1 - a.x0) : 0;
        if (t > 0) { D.rect(ly.w, x0, yb, x1, yb + t); ovY += t; } else { D.line(ly.w, x0, yb + 0.5, x1, yb + 0.5, D.ltype('HIDDEN')); ovY += 0.5; }
        labs.push({ x: x0 + (0.2 + 0.06 * nW++) * (x1 - x0), y: yb + Math.max(t, 0.5), s: `${a.k === 'ws' ? 'FUTURE WEARING SURFACE' : X_().str(a.L.desc).toUpperCase()} ${t > 0 ? `${dIn(t)} x ${f0(a.L.gam * 1000)} PCF = ` : ''}${Math.abs(q - Math.round(q)) < 0.05 ? f0(q) : q.toFixed(1)} PSF${kl(a.L)}${t > 0 ? '' : ', THICKNESS NOT SET (LINE ONLY)'}` }); }
      top = Math.max(top, a.y0 + (a.h || 0)); });
    const xs = [xL, xR]; A.forEach(a => { if (a.x0 != null && a.k !== 'ws' && a.k !== 'ovl') xs.push(X(a.x0), X(a.x1)); else if (a.x != null) xs.push(X(a.x)); });
    const yC = yTop + top + 1.5 * h; D.chainH(ly.d, xs, yC, yTop);
    const th = h * 0.7, mid = (xL + xR) / 2, Lh = labs.filter(q => q.x < mid).sort((p, q) => p.x - q.x), Rh = labs.filter(q => q.x >= mid).sort((p, q) => q.x - p.x), tw = q => q.s.length * th * 0.95 + th;
    const clash = Lh.length && Rh.length && Math.max(...Lh.map(q => q.x + tw(q))) > Math.min(...Rh.map(q => q.x - tw(q))), off = clash ? Lh.length : 0, nr = clash ? Lh.length + Rh.length : Math.max(Lh.length, Rh.length);
    [Lh, Rh].forEach((Gr, s) => Gr.forEach((q, i) => { const yl = yC + 2.2 * h + (Gr.length - 1 - i + (s ? off : 0)) * 2.1 * th; D.line(ly.t, q.x, q.y, q.x, yl + 0.4 * th); D.line(ly.t, q.x, yl + 0.4 * th, q.x + (s ? -0.6 : 0.6) * th, yl + 0.4 * th); D.text(ly.t, q.x + (s ? -0.8 : 0.8) * th, yl, th, q.s, s ? 2 : 0); }));
    return top + 1.5 * h + 2.2 * h + nr * 2.1 * th + h;
  }

  /* all(G, opt): the three drawings in one model space (plan at the origin, the elevation of girder opt.gi below it, the section below
     that), each at its own scale. Returns { D (SharedDxf drawing), views: [{ id, title, i0, i1, k, h }] }. */
  function all(G, opt) {
    opt = opt || {}; const D = X_().drawing({ prefix: opt.prefix == null ? 'S-' : opt.prefix }), views = [];
    const place = v => { if (views.length) { const p = views[views.length - 1], bp = D.bbox(p.i0, p.i1), b = D.bbox(v.i0, v.i1); if (isFinite(b[0])) D.move(v.i0, bp[0] - b[0], bp[1] - 4 * p.h - b[3]); } views.push(v); };
    place(plan(G, D, opt)); place(elevation(G, D, opt.gi || 0, opt)); place(section(G, D, opt));
    return { D, views };
  }
  /* dxf(G, opt): the DXF text of all() */
  function dxf(G, opt) { const A = all(G, opt); return A.D.toDXF({ ltscale: 1 }); }

  window.SBDDrawings = { SCALES, SCALE_NAME, TXT, scaleFor, plateGirderOf, appOf, model, plan, elevation, section, all, dxf, table, notes, tag, segAt, splR, brgType, tsType, bwName };
})();
