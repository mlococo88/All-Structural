/* apps/ps-bridge/ui/sheets.js — the drawing set of the Drawings tab, part 1: the typical section of each span and the framing plan, each on
   a sheet with its border and title block, as one DXF R12 entity list (window.PSBSheets). Classic script, no DOM. Display and export only:
   nothing here feeds a result. Created 2026-11-14 (PS Bridge catch-up to the Steel Bridge app, item 10, part 1). Part 2 (2026-11-14,
   item B): each girder type's elevation (strand rows, debonded lengths, draped profile, hold-down points from ℄ bearing and from the
   girder end, PS-13, camber) and strand pattern (sections at ℄ bearing and at midspan), and the strand and girder schedule (below).

   The geometry is not computed here: every position is read from the figures the app already draws (no second geometry):
     typical section  PSBXsFig.model(P, s) (ui/xsfig.js; the Loads & LLDF tab's and the Report's cross-section): the girder outlines and
                      voids at their offsets, deck, haunches, barriers / curbs / railings / sidewalks / fences / median, the traffic
                      faces at the d_e the engine uses (PSBDesign.deOf, PS-20);
     framing plan     PSBPlan.model(P) (ui/plan.js; the Bridge layout tab's plan): the girder lines, the skewed support lines, the
                      diaphragms and continuity diaphragms, the deck outline.
   The sheet frame (paper D 34 × 22 in or B 17 × 11 in; the smallest plot scale of the list at which the drawing fits; border, inner
   border, title block PROJECT, PROJECT NO., SHEET TITLE, SCALE, DESIGNED / CHECKED, SHEET n OF N; footer) is an adapted copy of the
   Steel Bridge app's sheet() (apps/steel-bridge/engine/sheets.js, anchor `function sheet(D, S, ox, C) {`) with its SCALES / SCALE_NAME /
   TXT (apps/steel-bridge/engine/drawings.js); COPY, to move to shared/ later (CLAUDE.md §3). Keep a fix to one in step with the other.

   build(P, opt) -> { D, sheets: [{ n, id, title, k, W, H, ox, i0, iC, i1, over, s }], miss: [[what, why]], errors }
     opt: { paper: 'D' | 'B', date ('YYYY-MM-DD'), half (the half-size print of paper D, as the steel app's), res(k, g) (part 2: the engine
     result of girder type k on line g, the page's cache; absent: computed here by the same call, PSBHoldDown.compute of cellInputs) }.
   Units: full size in inches (x across the bridge from the left deck edge, y up, in the section; x along the bridge from Abut. 1, y = −z
   across (G1 at the top), in the plan). */
(function () {
  'use strict';
  const X_ = () => window.SharedDxf;
  const PAPER = { D: [34, 22], B: [17, 11] };
  // from apps/steel-bridge/engine/drawings.js (SCALES, SCALE_NAME, TXT)
  const SCALES = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 120, 240, 360, 480, 600, 720, 960, 1200];
  const SCALE_NAME = { 1: 'FULL SIZE', 2: '6" = 1\'-0"', 3: '4" = 1\'-0"', 4: '3" = 1\'-0"', 6: '2" = 1\'-0"', 8: '1 1/2" = 1\'-0"', 12: '1" = 1\'-0"', 16: '3/4" = 1\'-0"', 24: '1/2" = 1\'-0"',
    32: '3/8" = 1\'-0"', 48: '1/4" = 1\'-0"', 64: '3/16" = 1\'-0"', 96: '1/8" = 1\'-0"', 120: '1" = 10\'-0"', 240: '1" = 20\'-0"', 360: '1" = 30\'-0"', 480: '1" = 40\'-0"', 600: '1" = 50\'-0"',
    720: '1" = 60\'-0"', 960: '1" = 80\'-0"', 1200: '1" = 100\'-0"' };
  const TXT = 0.10;   // plotted text height, in
  const f2 = (v, d) => (+v).toFixed(d == null ? 2 : d), scaleName = k => SCALE_NAME[k] || `1:${k}`;
  const KIND = { i: 'I-GIRDER', next: 'NEXT BEAM', box: 'BOX BEAM', deck: 'DECK SLAB' };

  /* wrap(lines, n): the note lines broken at spaces to at most n characters (the paper's drawing width at the text height) */
  const wrap = (lines, n) => [].concat(...lines.map(t => { const o = []; let cur = ''; String(t).split(' ').forEach(w => { if (cur && (cur + ' ' + w).length > n) { o.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }); if (cur) o.push(cur); return o; }));
  /* typical section of span C.s (PSBXsFig.model) */
  function section(D, C) {
    const m = C.xs, h = D.h;
    const lG = D.layer('GRDR', 7), lV = D.layer('GRDR-VOID', 8), lK = D.layer('DECK', 8), lA = D.layer('APPR', 30), lC = D.layer('CNTR', 1, 'CENTER'), lD = D.layer('DIMS', 2), lT = D.layer('TEXT', 7), lF = D.layer('FACE', 3, 'DASHED');
    const cen = D.ltype('CENTER'), dsh = D.ltype('DASHED');
    D.rect(lK, 0, m.yD, m.Wd, m.yTop);
    m.haunch.forEach(q => D.rect(lK, q.x0, q.y0, q.x1, q.y1));
    m.app.forEach(a => {
      if (a.kind === 'bar' && a.geo) D.pline(lA, a.poly, true);   // GEOM (2026-11-24): a Geometry-mode barrier, its own outline (ui/xsfig.js)
      else if (a.kind === 'bar') { const e = a.edge, i = a.inner, d = i - e, H = a.y1 - a.y0, y0 = a.y0; D.pline(lA, [[e, y0], [i, y0], [i - 0.25 * d, y0 + 0.25 * H], [e + 0.45 * d, y0 + H], [e, y0 + H]], true); }
      else D.rect(lA, a.x0, a.y0, a.x1, a.y1);
    });
    const yLow = Math.min(...m.girders.map(q => q.yBot), m.yD);
    m.girders.forEach(q => {
      D.pline(lG, q.poly, true);
      q.voids.forEach(v => { if (v.type === 'rect') D.rect(lV, v.x - v.w / 2, v.y - v.h / 2, v.x + v.w / 2, v.y + v.h / 2); else D.circle(lV, v.x, v.y, v.d / 2); });
      D.line(lC, q.x, q.yBot - 1.5 * h, q.x, m.yTop + 1.5 * h, cen);
      D.text(lT, q.x, yLow - 2.4 * h, h, `G${q.g}`, 1);
      D.text(lT, q.x, yLow - 3.8 * h, 0.8 * h, `${q.label}: ${q.girder}`, 1);
    });
    m.missing.forEach(q => { D.line(lC, q.x, yLow, q.x, m.yTop + 1.5 * h, cen); D.text(lT, q.x, yLow - 2.4 * h, h, `G${q.g} (NO TYPE)`, 1); });
    // dimensions: the girder spacing chain (overhangs, bays) and the deck width below; d_e of the exterior lines above the deck
    const xs = [0, ...m.off, m.Wd], yDim = yLow - 6 * h;
    D.chainH(lD, xs, yDim, yLow);
    D.dimH(lD, 0, m.Wd, yDim - 3 * h, yLow, 'DECK <>');
    const yA = Math.max(m.yTop, ...m.app.map(a => a.y1));
    m.faces.forEach(f => { D.line(lF, f.x, m.yTop, f.x, yA + 1.5 * h, dsh);
      if (Math.abs(f.x - f.xg) > 1e-6) D.dimH(lD, Math.min(f.x, f.xg), Math.max(f.x, f.xg), yA + 3 * h, m.yTop, `DE = ${f.de < 0 ? '-' : ''}<>`); });
    D.text(lT, m.Wd + 2 * h, m.yTop - 0.5 * h, h, `DECK T = ${f2(m.ts, 2)} IN`, 0);
    if (m.haunch.length) D.text(lT, m.Wd + 2 * h, m.yTop - 2 * h, h, `HAUNCH ${f2(Math.max(...m.haunch.map(q => q.y1 - q.y0)), 2)} IN`, 0);
    // the notes under the section
    const notes = [`TYPICAL SECTION${C.ns > 1 ? `, SPAN ${C.s}` : ''} (LOOKING AHEAD). GIRDER OUTLINES AND VOIDS FROM THE GIRDER LIBRARY; DECK FROM EDGE TO EDGE.`,
      m.app.some(a => a.kind === 'bar' && a.geo) ? 'BARRIER ENTERED BY ITS GEOMETRY: DRAWN TO ITS OUTLINE (CROSS-SECTION TAB). OTHER BARRIER HEIGHT AND PROFILE, RAILING AND FENCE POST HEIGHTS: SCHEMATIC.'   // GEOM
        : 'BARRIER HEIGHT AND PROFILE, RAILING AND FENCE POST HEIGHTS: SCHEMATIC (THE WIDTHS, POSITIONS AND THICKNESSES ARE THE CROSS-SECTION TAB\'S INPUTS).',
      `DE: EXTERIOR GIRDER CL TO THE TRAFFIC FACE, AS THE LIVE LOAD DISTRIBUTION USES IT (${m.faces.map(f => `G${f.g} ${f2(f.de, 3)} FT, ${f.src.toUpperCase()}`).join('; ')}). WORKED: LOADS & LLDF TAB.`];
    wrap(notes, C.wrap).forEach((t, i) => D.text(lT, 0, yDim - (7 + 1.8 * i) * h, h, t, 0));
  }

  /* framing plan (PSBPlan.model): x along the bridge, y = −z (G1 at the top) */
  function plan(D, C) {
    const m = C.pl, h = D.h, Y = z => -z, pt = p => [p[0], Y(p[1])];
    const lG = D.layer('GRDR', 7), lK = D.layer('DECK', 8), lS = D.layer('SUPP', 4, 'HIDDEN'), lX = D.layer('DIAP', 5), lC = D.layer('CNTR', 1, 'CENTER'), lD = D.layer('DIMS', 2), lT = D.layer('TEXT', 7);
    const hid = D.ltype('HIDDEN'), cen = D.ltype('CENTER');
    D.pline(lK, m.deck.map(pt), true);
    m.supports.forEach(q => { const a = pt(q.a), b = pt(q.b); D.line(lS, a[0], a[1], b[0], b[1], hid);
      D.text(lT, a[0], a[1] + 1.2 * h, h, q.name.toUpperCase(), 1); D.text(lT, b[0], b[1] - 2.2 * h, h, `SKEW ${f2(q.skew, 2)}%%d`, 1); });
    m.cont.forEach(c => { const a = pt(c.p), b = pt(c.q); D.line(lX, a[0], a[1], b[0], b[1]); D.text(lT, (a[0] + b[0]) / 2 + 0.8 * h, (a[1] + b[1]) / 2, 0.8 * h, 'CONTINUITY DIAPHRAGM', 0, 90); });
    m.dia.forEach(d => { const a = pt(d.p), b = pt(d.q); D.line(lX, a[0], a[1], b[0], b[1]); });
    m.girders.forEach(q => { const y = Y(q.z); D.line(lG, q.x0, y, q.x1, y); });
    m.missing.forEach(q => { const y = Y(q.z); D.line(lC, q.xa, y, q.xb, y, cen); });
    const xL = Math.min(...m.supports.map(q => Math.min(q.a[0], q.b[0]))), xR = Math.max(...m.supports.map(q => Math.max(q.a[0], q.b[0])));
    m.ys.forEach((z, i) => D.text(lT, xL - 1.5 * h, Y(z) - 0.5 * h, h, `G${i + 1}`, 2));
    // the spans along the bridge centreline above the plan; the bays and overhangs at the right end
    const yTop = Y(m.zL), zc = (m.ys[0] + m.ys[m.nb - 1]) / 2;
    m.spans.forEach((L, i) => D.dimH(lD, m.supports[i].st, m.supports[i + 1].st, yTop + 5 * h, Y(zc), `SPAN ${i + 1}: <>`));
    if (m.spans.length > 1) D.dimH(lD, m.supports[0].st, m.supports[m.spans.length].st, yTop + 8 * h, Y(zc), 'TOTAL <>');
    D.chainV(lD, [Y(m.zR), ...m.ys.slice().reverse().map(Y), Y(m.zL)], xR + 5 * h, xR);
    D.dimV(lD, Y(m.zR), Y(m.zL), xR + 9 * h, xR, 'DECK <>');
    const yN = Y(m.zR) - 6 * h;
    const notes = [`FRAMING PLAN. GIRDER LINES CL BEARING TO CL BEARING (AND THE GIRDER ENDS PAST THE ABUTMENT BEARINGS); SUPPORT LINES AT THEIR SKEW (STATIONS ON THE LINE MIDWAY BETWEEN G1 AND G${m.nb}).`,
      `DIAPHRAGMS AT THEIR ENTERED DISTANCE FROM EACH LINE'S LEFT CL BEARING, IN THE BAYS NEXT TO A LINE WHOSE TYPE HAS THEM (NONE BETWEEN ADJACENT UNITS)${m.cont.length ? '; CONTINUITY DIAPHRAGMS ON THE PIER LINES (SPANS MADE CONTINUOUS)' : ''}.`,
      `GIRDER TYPES: ${(m.types || []).map(t => `${t.label} (SPAN ${t.span})`).join(', ')}.`];
    wrap(notes, C.wrap).forEach((t, i) => D.text(lT, xL, yN - 1.8 * i * h, h, t, 0));
  }

  /* ---------- part 2 (2026-11-14, item B): the girder sheets of each girder type and the strand / girder schedule ----------
     Every position and value is read from what the app already computes and draws (no second geometry, no calculation):
       the girder type's engine result on its first line (opt.res(k, g): the page's cached PSBHoldDown.compute of PSBDesign.cellInputs; the
       strand pattern, the draped profile and the girder do not depend on the line; the camber at release and erection do not either):
       outline halfPolygon(R.g) mirrored and voids sectionVoids(R.g) (the engine's, as the input check and ui/strands.js draw them); the
       strand positions PSBStrandGfx.pattern(R, end) (ui/strands.js, the single source of the drawn positions, PS-27); the rows, draped
       strands and hold-down points R.ss (as the Summary elevation, ui/sumelev.js); L = R.L; the girder end past ℄ bearing opt.endOh;
       the camber R.cam (Camber & deflection tab); the girder weight w_sw × (L + 2 e_end / 12) (PSBBridge.results' W). */
  const num = v => parseFloat(String(v));
  function typeModels(P, opt) {
    const BR = window.PSBBridge, DS = window.PSBDesign, out = [], miss = [];
    const resOf = opt.res || ((k, g) => window.PSBHoldDown.compute(JSON.parse(JSON.stringify(DS.cellInputs(P, k, g)))));
    BR.types(P).forEach((T, k) => {
      const lines = BR.typeLines(P, k); if (!lines.length) return;
      const g = lines[0]; let inp, R; try { inp = DS.cellInputs(P, k, g); R = resOf(k, g); } catch (e) { R = { error: e.message }; }
      if (!R || R.error) { miss.push([`GIRDER ${T.label.toUpperCase()}`, `NO RESULT ON G${g}: ${String((R && R.error) || '').toUpperCase()}`]); return; }
      const ss = R.ss, oh = +((inp.opt && inp.opt.endOh) || 0), L = +R.L;
      out.push({ k, T, label: T.label, span: T.span, lines, g, inp, R, L, oh, h: +R.g.h, girder: inp.girder, dia: num(inp.str.size) || 0.5, size: inp.str.size,
        rows: ss.rows.map(r => ({ y: +r.y, n: +r.n, nd: +r.nd || 0, dbnd: +r.dbnd || 0 })), nh: +ss.nh || 0, N: ss.Ntot,
        hp: ss.nh > 0 ? { frac: +ss.hp.frac, a: +ss.hp.frac * L, yEnd: +ss.hp.yEnd, yMid: +ss.hp.yMid } : null,
        cam: R.cam, fc: +inp.mat.fc, fci: +inp.mat.fci, W: R.g.wsw * (L + 2 * oh / 12) });
    });
    return { types: out, miss };
  }
  const outlineOf = g => { const hp = halfPolygon(g); return hp.concat(hp.slice().reverse().map(p => [-p[0], p[1]])); };
  /* the strand pattern sheet: the section at ℄ bearing (the girder end) and at midspan, true scale */
  function strands(D, C) {
    const m = C.t, h = D.h, R = m.R, poly = outlineOf(R.g), vs = sectionVoids(R.g), r = m.dia / 2;
    const lG = D.layer('GRDR', 7), lV = D.layer('GRDR-VOID', 8), lS = D.layer('STRD', 1), lB = D.layer('STRD-DEBOND', 30), lH = D.layer('STRD-DRAPE', 6), lC = D.layer('CNTR', 1, 'CENTER'), lD = D.layer('DIMS', 2), lT = D.layer('TEXT', 7);
    const cen = D.ltype('CENTER'), xm = Math.max(...poly.map(p => Math.abs(p[0]))), gap = 2 * xm + Math.max(30, 14 * h);
    [true, false].forEach((end, j) => {
      const ox = j * gap, P2 = poly.map(p => [p[0] + ox, p[1]]);
      D.pline(lG, P2, true);
      vs.forEach(v => { if (v.type === 'rect') D.rect(lV, ox + v.x - v.w / 2, v.y - v.h / 2, ox + v.x + v.w / 2, v.y + v.h / 2); else D.circle(lV, ox + v.x, v.y, v.d / 2); });
      D.line(lC, ox, -2 * h, ox, m.h + 2 * h, cen);
      const pts = window.PSBStrandGfx.pattern(R, end);
      pts.forEach(q => { const x = ox + q.x;
        if (q.kind === 'd') { D.circle(lB, x, q.y, r); D.line(lB, x - r, q.y - r, x + r, q.y + r); D.line(lB, x - r, q.y + r, x + r, q.y - r); }
        else if (q.kind === 'h') { D.circle(lH, x, q.y, r); D.circle(lH, x, q.y, r / 3); }
        else { D.circle(lS, x, q.y, r); D.circle(lS, x, q.y, r / 2); } });
      // dimensions: the straight rows from the soffit (chain), the draped centroid, the depth
      const ys = [...new Set(m.rows.map(q => q.y))].sort((a, b) => a - b), xl = ox - xm - 3 * h, xr = ox + xm + 3 * h;
      if (ys.length) D.chainV(lD, [0, ...ys], xl, ox - xm);
      if (m.hp) { const cg = end ? m.hp.yEnd : m.hp.yMid; D.dimV(lD, 0, cg, xl - 4 * h, ox, `${end ? 'Y END' : 'Y MID'} = <>`); }
      D.dimV(lD, 0, m.h, xr, ox + xm, 'H = <>');
      D.dimH(lD, ox - xm, ox + xm, -4 * h, 0);
      D.text(lT, ox, -7.5 * h, 1.2 * h, end ? 'SECTION AT CL BEARING (GIRDER END)' : 'SECTION AT MIDSPAN', 1);
      const nS = pts.filter(q => q.kind === 's').length, nD = pts.filter(q => q.kind === 'd').length, nH = pts.filter(q => q.kind === 'h').length;
      D.text(lT, ox, -9.3 * h, h, `${nS} BONDED${nD ? `, ${nD} DEBONDED` : ''}${nH ? `, ${nH} DRAPED` : ''} (${m.N} STRANDS)`, 1);
    });
    const yN = -12 * h, notes = [`STRAND PATTERN OF GIRDER TYPE ${m.label.toUpperCase()} (SPAN ${m.span}, LINES ${m.lines.map(g => 'G' + g).join(', ')}): ${m.girder.toUpperCase()}, ${String(m.size).toUpperCase()} STRANDS ON A 2 IN GRID.`,
      `STRAIGHT ROWS (COUNT AT Y FROM THE SOFFIT): ${m.rows.map(q => `${q.n} AT ${f2(q.y)} IN${q.nd ? ` (${q.nd} DEBONDED ${f2(q.dbnd)} FT)` : ''}`).join('; ')}.${m.hp ? ` DRAPED: ${m.nh} STRANDS, CENTROID ${f2(m.hp.yEnd)} IN AT CL BEARING AND ${f2(m.hp.yMid)} IN BETWEEN THE HOLD-DOWN POINTS.` : ' NO DRAPED STRANDS.'}`,
      'SYMBOLS: BONDED STRAND (DOUBLE CIRCLE), DEBONDED AT THIS SECTION (CIRCLE WITH X), DRAPED STRAND (CIRCLE WITH DOT). OUTLINE AND VOIDS FROM THE GIRDER LIBRARY; STRAND POSITIONS AS THE GIRDERS & STRANDS TAB DRAWS THEM.',
      `F'C = ${f2(m.fc)} KSI, F'CI = ${f2(m.fci)} KSI. WORKED: LOSSES, STRESSES AND END ZONE & HOLD-DOWN TABS.`];
    wrap(notes, C.wrap).forEach((t, i) => D.text(lT, -xm, yN - 1.8 * i * h, h, t, 0));
  }
  /* the girder elevation sheet: true length, the depth exaggerated (×ex, noted); ℄ bearings, the strand rows (debonded lengths), the draped
     profile with the hold-down points dimensioned from ℄ bearing and from the girder end (PS-13), the camber */
  function elevation(D, C) {
    const m = C.t, h = D.h, oh = m.oh, Li = m.L * 12, Lg = Li + 2 * oh, ex = Math.max(1, Math.round(Lg / (5 * m.h))), Y = y => y * ex, X = x => oh + x * 12;
    const lG = D.layer('GRDR', 7), lS = D.layer('STRD', 1), lB = D.layer('STRD-DEBOND', 30), lH = D.layer('STRD-DRAPE', 6), lC = D.layer('CNTR', 1, 'CENTER'), lD = D.layer('DIMS', 2), lT = D.layer('TEXT', 7);
    const cen = D.ltype('CENTER'), dsh = D.ltype('DASHED'), H = Y(m.h);
    D.rect(lG, 0, 0, Lg, H);
    [oh, oh + Li].forEach(x => { D.line(lC, x, -3 * h, x, H + 3 * h, cen); D.text(lT, x, H + 3.6 * h, h, 'CL BRG', 1); });
    D.line(lC, Lg / 2, -1.5 * h, Lg / 2, H + 1.5 * h, cen); D.text(lT, Lg / 2, H + 2 * h, 0.8 * h, 'MIDSPAN', 1);
    m.rows.forEach(q => { D.line(lS, 0, Y(q.y), Lg, Y(q.y));
      if (q.nd > 0 && q.dbnd > 0) [[0, X(q.dbnd)], [X(m.L - q.dbnd), Lg]].forEach(([a, b]) => D.line(lB, a, Y(q.y) + 0.15 * h, b, Y(q.y) + 0.15 * h, dsh));
      D.text(lT, Lg + 1.5 * h, Y(q.y) - 0.4 * h, 0.8 * h, `${q.n} AT ${f2(q.y)} IN${q.nd ? `, ${q.nd} DEBONDED ${f2(q.dbnd)} FT` : ''}`, 0); });
    if (m.hp) { const a = m.hp.a, ye = Y(m.hp.yEnd), ym = Y(m.hp.yMid), sl = (ym - ye) / (a * 12);
      D.pline(lH, [[0, ye + sl * (-oh)], [X(0), ye], [X(a), ym], [X(m.L - a), ym], [X(m.L), ye], [Lg, ye + sl * (-oh)]], false);
      [a, m.L - a].forEach(x => D.circle(lH, X(x), ym, 0.5 * h));
      D.text(lT, -1.5 * h, ye - 0.4 * h, 0.8 * h, `${m.nh} DRAPED, Y END ${f2(m.hp.yEnd)} IN`, 2);
      D.text(lT, Lg / 2, ym + 1.2 * h, 0.8 * h, `Y MID ${f2(m.hp.yMid)} IN`, 1);
      D.dimH(lD, X(0), X(a), -5 * h, 0, 'HOLD-DOWN <> FROM CL BRG');
      D.dimH(lD, 0, X(a), -8 * h, 0, '<> FROM GIRDER END'); }
    D.dimH(lD, X(0), X(m.L), -11 * h, 0, 'CL BRG TO CL BRG <>');
    D.dimH(lD, 0, Lg, -14 * h, 0, 'GIRDER <>');
    const c = m.cam || {}, cm = v => typeof v === 'number' && isFinite(v) ? `${f2(v)} IN ${v >= 0 ? 'UP' : 'DOWN'}` : '-';
    const notes = [`GIRDER ELEVATION, TYPE ${m.label.toUpperCase()} (SPAN ${m.span}, LINES ${m.lines.map(g => 'G' + g).join(', ')}): ${m.girder.toUpperCase()}, H = ${f2(m.h)} IN. TRUE LENGTH; VERTICAL SCALE X ${ex} (THE DEPTH AND THE STRAND HEIGHTS DRAWN ${ex} TIMES).`,
      `${m.N} STRANDS ${String(m.size).toUpperCase()}: ${m.N - m.nh} STRAIGHT${m.hp ? `, ${m.nh} DRAPED WITH TWO HOLD-DOWN POINTS AT ${f2(m.hp.frac, 3)} L = ${f2(m.hp.a)} FT FROM EACH CL BEARING (${f2(m.hp.a + oh / 12)} FT FROM EACH GIRDER END), SYMMETRIC ABOUT MIDSPAN` : ''}. DEBONDED LENGTHS DASHED.`,
      `CAMBER AT MIDSPAN (G${m.g}): AT RELEASE ${cm(c.rel)}, AT ERECTION ${cm(c.erect)}, AFTER THE DECK ${cm(c.afterDeck)}, BEAM SEAT ${cm(c.seat)}, FINAL ${cm(c.final)}. WORKED: CAMBER & DEFLECTION TAB.`,
      `GIRDER WEIGHT ${f2(m.W, 1)} KIP (W_SW X GIRDER LENGTH). HOLD-DOWN FORCE AND DEVELOPMENT: END ZONE & HOLD-DOWN TAB.`];
    wrap(notes, C.wrap).forEach((t, i) => D.text(lT, 0, -18 * h - 1.8 * i * h, h, t, 0));
  }
  /* the strand and girder schedule: one row per girder type (drawn in plotted inches × the scale; fitted to the paper's width) */
  function schedule(D, C) {
    const k = D.k, lT = D.layer('TEXT', 7), lL = D.layer('TBL', 8), TT = C.types;
    const cols = [['TYPE', 11], ['SPAN', 4], ['LINES', 10], ['SECTION', 18], ['L (FT)', 7], ['STRANDS', 9], ['STRAIGHT ROWS (N AT Y IN)', 26], ['DEBONDED (N, FT)', 14],
      ['DRAPED (N, Y END / Y MID IN)', 18], ['HOLD-DOWN FROM CL BRG / END (FT)', 18], ["F'C / F'CI (KSI)", 13], ['CAMBER REL. / ERECT. (IN)', 15], ['WEIGHT (KIP)', 9]];
    const U = 0.14, nat = cols.reduce((a, q) => a + q[1], 0) * U, f = Math.min(1, C.aw / nat), th = 0.14 * f * k, cw = cols.map(q => q[1] * U * f * k), rh = 0.45 * f * k;   // U: in per character at 0.14 in text
    const rows = TT.map(m => [m.label, String(m.span), m.lines.map(g => 'G' + g).join(' '), m.girder, f2(m.L), `${m.N} ${String(m.size).replace(/\s*in$/i, '"')}`,
      m.rows.map(q => `${q.n}@${f2(q.y)}`).join(', '), m.rows.filter(q => q.nd > 0 && q.dbnd > 0).map(q => `${q.nd}x${f2(q.dbnd)}`).join(', ') || '-',
      m.hp ? `${m.nh}, ${f2(m.hp.yEnd)} / ${f2(m.hp.yMid)}` : '-', m.hp ? `${f2(m.hp.a)} / ${f2(m.hp.a + m.oh / 12)}` : '-', `${f2(m.fc)} / ${f2(m.fci)}`,
      `${f2(m.cam.rel)} / ${f2(m.cam.erect)}`, f2(m.W, 1)]);
    const W = cw.reduce((a, b) => a + b, 0), nR = rows.length + 1;
    for (let i = 0; i <= nR; i++) D.line(lL, 0, -i * rh, W, -i * rh);
    let x = 0; D.line(lL, 0, 0, 0, -nR * rh); cw.forEach(w => { x += w; D.line(lL, x, 0, x, -nR * rh); });
    [cols.map(q => q[0]), ...rows].forEach((r, i) => { let xx = 0; r.forEach((t, j) => { const mx = Math.floor(cw[j] / (0.75 * th)); D.text(lT, xx + 0.4 * th, -(i + 1) * rh + 0.35 * rh, th, String(t).toUpperCase().slice(0, Math.max(3, mx)), 0); xx += cw[j]; }); });
    D.text(lT, 0, 0.5 * rh, 1.4 * th, 'STRAND AND GIRDER SCHEDULE', 0);
    const notes = ['ONE ROW PER GIRDER TYPE (EACH TYPE IS THE SAME GIRDER ON EVERY LINE LISTED). L: CL BEARING TO CL BEARING. HOLD-DOWN: THE TWO POINTS ARE SYMMETRIC ABOUT MIDSPAN, MEASURED FROM EACH CL BEARING AND FROM EACH GIRDER END (PS-13).',
      'CAMBER AT MIDSPAN AT RELEASE AND AT ERECTION, UPWARD POSITIVE (CAMBER & DEFLECTION TAB). WEIGHT: ONE GIRDER, W_SW X GIRDER LENGTH. STRANDS AND ROWS: GIRDERS & STRANDS TAB; F\'C / F\'CI: MATERIALS TAB.'];
    wrap(notes, Math.floor(W / k / (0.12 * f))).forEach((t, i) => D.text(lT, 0, -(nR + 1.5 + 1.8 * i) * rh, th, t, 0));
  }

  /* ---------- part 3 (2026-11-15, batch H): the sheets of tables and notes (cover and sheet index, general notes, design summary, …) ----------
     The steel app's block sheets (apps/steel-bridge/engine/sheets.js blockDraw / blockBox / blockPages / pageFn, SBTXT, and its table() and
     notes() of apps/steel-bridge/engine/drawings.js): COPY, to move to shared/ later (CLAUDE.md §3); keep a fix to one in step with the other.
     A block is { t: 'table', title, cols, rows } | { t: 'notes', title, lines, wc } | { t: 'head', lines: [[size × h, text]] }. The blocks of a
     sheet flow top-down in columns over the drawing area; a table taller than the area is continued ("(CONTINUED)"); blocks past the area's
     width go on the next sheet of the set (" (2 OF n)"). Nothing is calculated: each cell is a value of the model or the engine, formatted. */
  const asc = s => String(s == null ? '' : s).replace(/²/g, '2').replace(/³/g, '3').replace(/⁴/g, '4').replace(/≤/g, 'MAX.').replace(/≥/g, 'MIN.').replace(/<=/g, 'MAX.').replace(/>=/g, 'MIN.').replace(/√/g, 'SQRT ').replace(/φ/g, 'PHI ')
    .replace(/Δ/g, 'DELTA ').replace(/[·•]/g, '-').replace(/…/g, '...').replace(/[ₐ-ₜ]/g, '');
  function table(D, lL, lT, x, y, cols, rows, title) {
    const h = D.h, ch = h * 0.8, rh = 1.5 * h; let yy = y; const S = v => X_().str(asc(v == null ? '' : v)).toUpperCase();
    if (title) { D.text(lT, x, yy, h, S(title)); yy -= 1.7 * h; }
    const w = cols.map((c, i) => Math.max(S(c).length, ...rows.map(r => S(r[i]).length)) * ch * 0.95 + 2 * ch), W = w.reduce((a, b) => a + b, 0), xs = [x];
    w.forEach(v => xs.push(xs[xs.length - 1] + v));
    const top = yy + 0.2 * h; D.line(lL, x, top, x + W, top); const hy = yy - rh; cols.forEach((c, i) => D.text(lT, xs[i] + ch * 0.6, yy - 1.05 * h, ch, S(c))); D.line(lL, x, hy, x + W, hy);
    rows.forEach((r, j) => { const ry = hy - (j + 1) * rh; r.forEach((c, i) => D.text(lT, xs[i] + ch * 0.6, ry + 0.45 * h, ch, S(c))); D.line(lL, x, ry, x + W, ry); });
    const bot = hy - rows.length * rh; xs.forEach(xv => D.line(lL, xv, top, xv, bot));
    return { w: W, y: bot - 1.2 * h };
  }
  function notesBlk(D, lT, x, y, title, lines, wc) {
    const h = D.h; wc = wc || 90; if (title) D.text(lT, x, y, h, X_().str(asc(title)).toUpperCase()); let yy = y - (title ? 1.8 * h : 0);
    lines.forEach((s, i) => { const out = wrap([X_().str(asc(s)).toUpperCase()], wc);
      out.forEach((ln, j) => { D.text(lT, x + (j ? 2.2 * h : 0), yy, h * 0.8, j ? ln : `${i + 1}. ${ln}`); yy -= 1.35 * h; }); yy -= 0.3 * h; });
    return yy;
  }
  function headBlk(D, lT, x, y, lines) { let yy = y; lines.forEach(([sz, t]) => { D.text(lT, x, yy, sz * D.h, X_().str(asc(t)).toUpperCase()); yy -= (sz + 0.7) * D.h; }); return yy; }
  const blockDraw = (D, b, x, y) => { const lT = D.layer('TEXT', 7), lL = D.layer('TBL', 8);
    return b.t === 'notes' ? notesBlk(D, lT, x, y, b.title, b.lines, b.wc) : b.t === 'head' ? headBlk(D, lT, x, y, b.lines) : table(D, lL, lT, x, y, b.cols, b.rows, b.title); };
  function blockBox(b) { const D = X_().drawing({ prefix: 'S-' }); D.k = 1; D.h = TXT; blockDraw(D, b, 0, 0); return D.bbox(0); }   // plotted inches, origin (0, 0)
  /* blockPages(blocks, aw, ah): the pages [[{ b, x, y }]] of the blocks in the drawing area aw × ah (plotted inches; x, y the block's origin
     from the area's top left). A block { …, page: true } starts a new page. */
  function blockPages(blocks, aw, ah) {
    const gapY = 0.25, gapX = 0.5, list = [];
    blocks.forEach(b => { if (b.t !== 'table') { list.push(b); return; } let rows = b.rows, first = true;
      if (!rows.length) { list.push(b); return; }
      while (rows.length) { let n = rows.length; const part = m => ({ ...b, page: first && b.page, title: first ? b.title : `${b.title} (CONTINUED)`, rows: rows.slice(0, m) }); const H = m => { const q = blockBox(part(m)); return q[3] - q[1]; };
        while (n > 1 && H(n) > ah) n--; list.push(part(n)); rows = rows.slice(n); first = false; } });
    const pages = [[]]; let cx = 0, cy = 0, cw = 0;
    list.forEach(b => { const q = blockBox(b), w = q[2] - q[0], hh = q[3] - q[1];
      if (b.page && pages[pages.length - 1].length) { pages.push([]); cx = 0; cy = 0; cw = 0; }
      if (cy > 0 && cy + hh > ah) { cx += cw + gapX; cy = 0; cw = 0; }
      if (cx > 0 && cx + w > aw) { pages.push([]); cx = 0; cy = 0; cw = 0; }
      pages[pages.length - 1].push({ b, x: cx - q[0], y: -cy - q[3] }); cy += hh + gapY; cw = Math.max(cw, w); });
    return pages;
  }
  const pageFn = items => (D, C) => items.forEach(p => blockDraw(D, p.b, p.x * D.k, p.y * D.k));
  const f1 = v => typeof v === 'number' && isFinite(v) ? v.toFixed(1) : '-', fN = (v, d) => typeof v === 'number' && isFinite(v) ? v.toFixed(d) : '-';
  const ED = 'AASHTO LRFD BRIDGE DESIGN SPECIFICATIONS, 10TH ED. (2024)', MBE = 'AASHTO MANUAL FOR BRIDGE EVALUATION (MBE), 4TH ED. (2026), LRFR';

  /* the cover: the project, the bridge, the owner; the sheet index (C.list: [n, title]), the sheets not in this set (C.miss), revisions */
  const ownersOf = TM => [...new Set(TM.types.map(t => window.PBD && window.PBD.ownerOf ? window.PBD.ownerOf(t.inp) : (t.inp.owner || 'AASHTO')))];
  function coverBlocks(P, TM, list, miss, date) {
    const pj = P.project || {}, L = (P.spans && P.spans.lengths) || [], sk = (P.xs && P.xs.skews) || [], nb = P.xs && P.xs.nb;
    const ow = window.PBD && window.PBD.OWN_RULES ? window.PBD.OWN_RULES.owners : {}, owners = ownersOf(TM);
    const head = { t: 'head', lines: [[3, pj.name || 'BRIDGE'], [1.6, 'PRESTRESSED CONCRETE GIRDER SUPERSTRUCTURE'],
      [1, `${L.length} SPAN${L.length > 1 ? 'S' : ''} (${L.map(v => f2(+v)).join(' + ')} FT)${L.length > 1 ? (P.spans.continuity === 'composite' ? ', MADE CONTINUOUS' : ', SIMPLE SPANS') : ''}`],
      [1, `${nb} GIRDER LINES, SKEW ${sk.map(v => f2(+v)).join(' / ')} DEG.`],
      ...(pj.number ? [[1, `PROJECT NO. ${pj.number}`]] : []), ...(pj.owner ? [[1, `OWNER / CLIENT: ${pj.owner}`]] : []),
      [1, `DESIGN RULES: ${owners.map(o => o === 'AASHTO' || !ow[o] ? 'AASHTO LRFD 10TH ED. (NO OWNER RULES)' : ow[o].manual).join('; ')}`]] };
    return [head, { t: 'table', title: 'SHEET INDEX', cols: ['SHEET', 'TITLE'], rows: list.map(([n, t]) => [String(n), t]) },
      ...(miss.length ? [{ t: 'table', title: 'DRAWINGS NOT IN THIS SET', cols: ['NOT GENERATED', 'REASON'], rows: miss.map(q => [q[0], String(q[1]).slice(0, 90)]) }] : []),
      { t: 'table', title: 'REVISIONS', cols: ['REV.', 'DATE', 'DESCRIPTION', 'BY'], rows: [['0', date, 'ISSUED FROM PRESTRESSED BRIDGE DESIGN (NEW APP)', pj.designer || ''], ['', '', '', ''], ['', '', '', ''], ['', '', '', '']] }];
  }
  /* general notes: the specifications and editions the app applies (named, not quoted), the owner rules, the materials and loads entered
     (each girder type's own values: its effective inputs, PSBDesign.cellInputs on its first line, as the girder sheets) */
  function notesModel(P, TM) {
    const pj = P.project || {}, dl = (P.xs && P.xs.dl) || {}, OWN = window.PBD && window.PBD.OWN_RULES, BRD = window.PSBBridgeDL;
    const T = TM.types, owners = ownersOf(TM);
    const lines = [`DESIGN SPECIFICATION: ${ED}, WITH THE LOAD AND RESISTANCE FACTORS OF THOSE SPECIFICATIONS AS THE ENGINE APPLIES THEM (WORKED ON THE OUTPUT TABS).`,
      `LOAD RATING: ${MBE} (RATING TAB).`,
      ...owners.filter(o => o !== 'AASHTO' && OWN && OWN.owners[o]).map(o => `OWNER RULES: ${OWN.owners[o].manual} (WRITTEN TO AASHTO LRFD ${OWN.owners[o].aashto}); THIS DESIGN APPLIES THE AASHTO LRFD 10TH ED. WITH THE OWNER'S RULES ON TOP (OWNER RULES TAB).`),
      ...(owners.every(o => o === 'AASHTO') ? ['OWNER RULES: NONE (AASHTO).'] : []),
      ...(pj.owner ? [`OWNER / CLIENT: ${pj.owner}.`] : []),
      `LIVE LOAD: HL-93${T.some(t => t.inp.loads && t.inp.loads.llAuto === false) ? ' (ENTERED MOMENT AND SHEAR ON SOME GIRDER TYPES: LOADS TAB)' : ''}${T.some(t => +(t.inp.opt && t.inp.opt.llMult) > 0 && +t.inp.opt.llMult !== 1) ? `, DESIGN LOAD MULTIPLIER ${[...new Set(T.map(t => f2(+(t.inp.opt.llMult || 1))))].join(' / ')} ON LL+IM` : ''}; DISTRIBUTION FACTORS ${T.every(t => t.inp.loads.dfAuto !== false) ? 'BY THE AASHTO EQUATIONS' : 'AS ENTERED OR BY THE AASHTO EQUATIONS (LOADS TAB)'} (LOADS & LLDF TAB).`,
      `DEAD LOADS: GIRDER SELF-WEIGHT, DECK AND HAUNCH (DC1); BARRIERS ${f2(+((dl.barL || {}).w) || 0)} / ${f2(+((dl.barR || {}).w) || 0)} KLF (LEFT / RIGHT, DC2); FUTURE WEARING SURFACE ${f1(+dl.fws)} PSF (DW)${dl.mode === 'distributed' && BRD && BRD.METHODS && BRD.METHODS[dl.method] ? `; DC2 AND DW DISTRIBUTED: ${BRD.METHODS[dl.method]}` : dl.mode === 'distributed' ? '' : '; DC2 AND DW ENTERED PER GIRDER (LOADS TAB)'}.`,
      `SPANS: ${P.spans.lengths.length > 1 && P.spans.continuity === 'composite' ? 'PRECAST GIRDERS ON SIMPLE SPANS FOR THE GIRDER AND DECK WEIGHT, MADE CONTINUOUS FOR THE COMPOSITE LOADS (CONTINUITY DIAPHRAGMS AT THE PIERS)' : 'SIMPLE SPANS FOR ALL LOADS'}.`,
      `PRESTRESS LOSSES: ${[...new Set(T.map(t => t.inp.opt.lossMethod === 'approx' ? 'APPROXIMATE LUMP-SUM ESTIMATE' : 'REFINED ESTIMATE'))].join(' / ')}; RELATIVE HUMIDITY ${[...new Set(T.map(t => f1(+t.inp.mat.H)))].join(' / ')} % (LOSSES TAB).`,
      `SERVICE III TENSION LIMIT: ${[...new Set(T.map(t => t.inp.opt.corrosion === 'severe' ? 'SEVERE CORROSION EXPOSURE' : 'MODERATE CORROSION EXPOSURE'))].join(' / ')} (STRESSES TAB).`,
      'PRESTRESSING STRAND: SEVEN-WIRE, LOW RELAXATION; SIZE, F_PU, JACKING STRESS AND E_P OF EACH GIRDER TYPE IN THE TABLE.',
      "CONCRETE AND REINFORCING STEEL OF EACH GIRDER TYPE IN THE TABLE (MATERIALS AND GIRDERS & STRANDS TABS): STRENGTHS IN KSI; W: THE UNIT WEIGHTS FOR DEAD LOAD, KCF; FY: STIRRUPS / BOTTOM BARS / SPLITTING STEEL (/ DECK BARS WHEN THE DECK IS DESIGNED).",
      'CAMBER MULTIPLIERS: PCI DESIGN HANDBOOK (CAMBER & DEFLECTION TAB).',
      'ALL DIMENSIONS TO BE VERIFIED AGAINST THE CONTRACT DRAWINGS. GENERATED BY PRESTRESSED BRIDGE DESIGN (NEW APP).'];
    const rows = T.map(t => { const m = t.inp.mat, s = t.inp.str, o = t.inp.opt, dk = t.inp.deck || {};
      return [t.label, String(t.span), t.girder, f2(+m.fc), f2(+m.fci), f2(+m.fcd), `${fN(+m.wcLoad, 3)} / ${fN(+m.wcdLoad, 3)}`, String(s.size).replace(/\s*in$/i, '"'), f1(+s.fpu), f2(+s.jack), String(Math.round(+s.Ep)),
        `${f1(+o.fy)} / ${f1(+o.longFy)} / ${f1(+o.splitFy)}${dk.on ? ` / ${f1(+dk.fyd)}` : ''}`]; });
    return [{ t: 'notes', title: 'GENERAL NOTES', lines, wc: 100 },
      { t: 'table', title: 'MATERIALS BY GIRDER TYPE (UNITS: SEE THE NOTES)',
        cols: ['TYPE', 'SPAN', 'SECTION', "F'C", "F'CI", "F'C DECK", 'W GIRDER / DECK', 'STRAND', 'F_PU', 'F_PJ / F_PU', 'E_P', 'FY'], rows }];
  }
  /* the design summary: per girder type the governing check of each check group over its lines and the lowest HL-93 inventory RF (the
     Summary tab's "Governing check of each group, per girder type", PSBSummaryUI.model over PSBBridge.results: the engine's values) */
  const ST = q => !q.pass ? 'FAIL' : !(typeof q.r === 'number' && isFinite(q.r)) ? 'REVIEW' : 'PASS';
  function summaryRows(P, A) {
    const M = window.PSBSummaryUI.model(P, A), rows = [];
    M.types.forEach(T => { const ln = T.lines.map(z => 'G' + z.c.g).join(' ');
      M.used.forEach(gp => { const z = T.groups[gp.id]; if (!z) return; const q = z.q;
        rows.push([T.label, String(T.span), ln, gp.name, q.n, 'G' + z.g, z.gp.input ? '-' : fN(q.loc, 2), fN(q.v, 3), fN(q.lim, 3), q.u || '', fN(q.r, 3), ST(q)]); });
      if (T.rf) rows.push([T.label, String(T.span), ln, 'Rating (HL-93 inventory)', T.rf.n, 'G' + T.rf.g, '-', '-', '-', 'RF', fN(T.rf.v, 3), T.rf.v >= 1 ? 'RF 1.0 OR MORE' : 'RF UNDER 1.0']); });
    return { M, rows };
  }
  function summaryBlocks(P, A) {
    const { M, rows } = summaryRows(P, A);
    return [{ t: 'head', lines: [[1.6, 'DESIGN SUMMARY'], [1, `${M.nF ? `FAIL: ${M.nF} CHECK${M.nF > 1 ? 'S' : ''} OVER 1.0` : 'PASS'}; ${M.n} GIRDER LINE${M.n === 1 ? '' : 'S'} CHECKED`]] },
      { t: 'notes', title: '', wc: 100, lines: [`${ED}. ONE ROW PER GIRDER TYPE AND CHECK GROUP: THE CHECK WITH THE LARGEST RATIO (DEMAND / LIMIT, THE ENGINE'S) OVER THE TYPE'S LINES, ITS LINE AND STATION X FROM THE LEFT CL BEARING. A RATIO UP TO 1.0 PASSES.`,
        'RATING: THE LOWEST HL-93 INVENTORY RATING FACTOR OF THE TYPE (FLEXURE, SHEAR, SERVICE III; NOT A CHECK); AN RF OF 1.0 OR MORE PASSES. THE FAIL COUNT ABOVE: ONE PER GIRDER TYPE PER CHECK, ITS WORST LINE.',
        'WORKED: THE OUTPUT TAB OF EACH GROUP (STRESSES, FLEXURE, SHEAR, END ZONE & HOLD-DOWN, CAMBER & DEFLECTION, HANDLING, DECK, RATING); THE SUMMARY TAB LINKS EACH VALUE TO ITS STEP.'] },
      { t: 'table', title: 'GOVERNING CHECK OF EACH CHECK GROUP PER GIRDER TYPE',
        cols: ['TYPE', 'SPAN', 'LINES', 'GROUP', 'GOVERNING CHECK', 'LINE', 'X (FT)', 'DEMAND', 'LIMIT', 'UNIT', 'RATIO / RF', 'STATUS'], rows }];
  }

  /* ---------- batch H2 (2026-11-15): bearing reactions, analysis diagrams ---------- */
  const f3 = v => (+v).toFixed(3), supN = (k, ns) => k === 0 ? 'ABUT. 1' : k === ns ? 'ABUT. 2' : `PIER ${k}`;
  /* the bearing reactions of every girder line at every support: PSBHandoffs.srAll(P, A.cells) (the hand-off to Bridge Substructure
     Loading, bridgeSuite.v1.superReactions allGirders; each span the girder type on the line, its engine's own end reactions, a pier the sum of
     the two spans' ends) — the values sent, unfactored, kip, + up; at a pier also each span's end share (srAll's shares) */
  function reacBlocks(P, A) {
    const r = window.PSBHandoffs.srAll(P, A.cells); if (!r || r.error) throw new Error(r ? r.error : 'no reactions');
    const S = r.payload.supports, ns = S.length - 1, rows = [], sh = [];   // the hand-off's values: srAll rounds to 0.001 kip, shown so
    S[0].girders.forEach((_, i) => S.forEach((s, k) => { const g = s.girders[i]; rows.push([g.label, supN(k, ns), f2(s.x), f3(g.DC1), f3(g.DC2), f3(g.DW)]); }));
    if (ns > 1) S[0].girders.forEach((_, i) => { for (let k = 1; k < ns; k++) r.shares[k][i].slice().sort((a, b) => a.s - b.s).forEach(q => sh.push([`G${i + 1}`, supN(k, ns), `SPAN ${q.s} ${q.end === 'right' ? 'RIGHT' : 'LEFT'} END`, f3(q.DC1), f3(q.DC2), f3(q.DW)])); });
    const cont = P.spans.lengths.length > 1 && P.spans.continuity === 'composite', ext = A.cells.some(c => c.R && c.R.useExt);
    return [{ t: 'head', lines: [[1.6, 'BEARING REACTIONS'], [1, 'EVERY GIRDER LINE AT EVERY SUPPORT; UNFACTORED, KIP, + UP']] },
      { t: 'notes', title: '', wc: 100, lines: ['DC1: GIRDER SELF-WEIGHT, DECK AND HAUNCH, OTHER NON-COMPOSITE DC AND THE DIAPHRAGM POINT LOADS, ON THE SIMPLE SPAN. DC2: BARRIERS AND OTHER SUPERIMPOSED DC. DW: WEARING SURFACE.',
        cont ? 'MADE CONTINUOUS: DC2 AND DW ARE EACH SPAN\'S END SHEARS ON THE CONTINUOUS UNIT, AS REACTIONS; DC1 ON THE SIMPLE SPAN.' : 'SIMPLE SPANS: EACH SPAN\'S TWO END REACTIONS.',
        ...(ext ? ['A GIRDER TYPE WITH ENTERED DEMANDS: ITS DC2 AND DW ARE THE ENTERED SHEARS AT THE TWO ENDS OF THE SPAN USED, AS REACTIONS.'] : []),
        ...(ns > 1 ? ['AT A PIER: THE SUM OF THE END REACTIONS OF THE TWO SPANS ON IT (EACH SPAN\'S SHARE IN THE SECOND TABLE).'] : []),
        'LIVE LOAD NOT LISTED (BRIDGE SUBSTRUCTURE LOADING COMPUTES ITS OWN). THESE ARE THE VALUES THE PROJECT TAB SENDS TO BRIDGE SUBSTRUCTURE LOADING; EACH LINE\'S ARE WORKED ON THE ANALYSIS TAB (REACTIONS) WITH THAT TYPE AND LINE.'] },
      { t: 'table', title: 'BEARING REACTIONS PER GIRDER LINE (KIP)', cols: ['GIRDER', 'SUPPORT', 'X (FT)', 'DC1', 'DC2', 'DW'], rows },
      ...(sh.length ? [{ t: 'table', title: 'PIER REACTIONS: EACH SPAN\'S END (KIP)', cols: ['GIRDER', 'SUPPORT', 'FROM', 'DC1', 'DC2', 'DW'], rows: sh }] : [])];
  }
  /* the analysis diagrams of a girder type on its first line (the Analysis tab's envelopes, R.diagrams at the engine's stations): moments
     girder + DC1, DC2, DW, LL+IM (+/−), Strength I (max / min); shears DC, DW, LL+IM (+/−), Strength I (max / min). Adapted from the steel
     app's dxfPlot / dxfLab / dxfDiag (apps/steel-bridge/engine/sheets.js plot, lab, diag); COPY. The demand source of the type named
     (PSBDemands.describe: this app's analysis, a custom table, a MIDAS file). Vertical: the largest value of each plot 1.1 in at plot scale. */
  function plot(D, l, y0, xs, series, title, unit, marks, amp) {
    amp = amp || 1.1; const h = D.h, X = x => x * 12, mx = Math.max(1e-6, ...series.flatMap(s => s.ys.map(Math.abs))), vs = amp * D.k / mx, x0 = X(xs[0]), x1 = X(xs[xs.length - 1]), ax = D.layer('DIAG-AXIS', 7), lT = D.layer('TEXT', 7);
    D.line(ax, x0, y0, x1, y0); (marks || []).forEach(x => D.line(ax, X(x), y0 - (amp + 0.1) * D.k, X(x), y0 + (amp + 0.1) * D.k, D.ltype('CENTER')));
    series.forEach(s => D.pline(s.l || l, xs.map((x, i) => [X(x), y0 + s.ys[i] * vs]), false, s.lt ? D.ltype(s.lt) : undefined));
    D.text(lT, x0, y0 + (amp + 0.15) * D.k + 0.5 * h, h, `${title} (${unit}; VERTICAL 1 IN. = ${(mx / amp).toFixed(0)} ${unit} AT PLOT SCALE)`);
    return { vs, mx };
  }
  const lab = (D, l, xs, ys, y0, vs, idx, fmt) => { const h = D.h; idx.forEach(i => { const v = ys[i]; if (!(Math.abs(v) > 1e-6)) return; D.text(l, xs[i] * 12, y0 + v * vs + (v >= 0 ? 0.3 : -1.1) * h, h * 0.6, fmt(v), 1); }); };
  function diag(D, C) {
    const m = C.t, R = m.R, Dg = R.diagrams, xs = Dg.map(r => +r.x), L = +R.L, h = D.h, k = D.k, amp = C.amp || 1.1, gap = (2 * amp + 1.0) * k, near = x => xs.reduce((b, q, i) => Math.abs(q - x) < Math.abs(xs[b] - x) ? i : b, 0);
    const t10 = [...new Set(Array.from({ length: 11 }, (_, i) => near(i * L / 10)))], col = f => Dg.map(r => +r[f] || 0);
    const Ly = { dc: D.layer('DIAG-DC', 7), dw: D.layer('DIAG-DW', 3), ll: D.layer('DIAG-LL', 4), st: D.layer('DIAG-STR', 1), t: D.layer('TEXT', 7) };
    const key = (yy, s) => D.text(Ly.t, xs[xs.length - 1] * 12, yy + (amp + 0.15) * k + 2 * h, h * 0.7, s, 2);
    const MgD = Dg.map(r => (+r.M_g || 0) + (+r.M_DC1 || 0));   // girder + DC1 drawn as one curve (the Analysis tab's M_g and M_DC1 columns; the plot only)
    const f0 = v => (+v).toFixed(0), f1v = v => (+v).toFixed(1), neg = col('M_StrI_neg').some(v => v < -1e-6); let y = 0;
    const pm = plot(D, Ly.dc, y, xs, [{ ys: MgD, l: Ly.dc }, { ys: col('M_DC2'), l: Ly.dw, lt: 'DASHED' }, { ys: col('M_DW'), l: Ly.dw }, { ys: col('M_LLpos'), l: Ly.ll }, { ys: col('M_LLneg'), l: Ly.ll, lt: 'HIDDEN' }, { ys: col('M_StrI_pos'), l: Ly.st }, { ys: col('M_StrI_neg'), l: Ly.st, lt: 'HIDDEN' }],
      'MOMENT ENVELOPES', 'KIP-FT', [0, L], amp);
    key(y, 'WHITE GIRDER + DC1 / GREEN DC2 (DASHED), DW / CYAN LL+IM (+/-) / RED STRENGTH I (DASHED = MIN.)'); lab(D, Ly.t, xs, col('M_StrI_pos'), y, pm.vs, t10, f0);
    if (neg) lab(D, Ly.t, xs, col('M_StrI_neg'), y, pm.vs, [0, xs.length - 1], f0);
    y -= gap;
    const pv = plot(D, Ly.dc, y, xs, [{ ys: col('V_DC'), l: Ly.dc }, { ys: col('V_DW'), l: Ly.dw }, { ys: col('V_LLpos'), l: Ly.ll }, { ys: col('V_LLneg'), l: Ly.ll, lt: 'HIDDEN' }, { ys: col('V_StrI_pos'), l: Ly.st }, { ys: col('V_StrI_neg'), l: Ly.st, lt: 'HIDDEN' }],
      'SHEAR ENVELOPES', 'KIP', [0, L], amp);
    key(y, 'WHITE DC / GREEN DW / CYAN LL+IM (+/-) / RED STRENGTH I (DASHED = MIN.)'); lab(D, Ly.t, xs, col('V_StrI_pos'), y, pv.vs, [0], f1v); lab(D, Ly.t, xs, col('V_StrI_neg'), y, pv.vs, [xs.length - 1], f1v);
    const ds = window.PSBDemands && window.PSBDemands.describe ? window.PSBDemands.describe(C.P, m.T) : null;
    const notes = [`ANALYSIS DIAGRAMS OF GIRDER TYPE ${m.label.toUpperCase()} (SPAN ${m.span}) ON LINE G${m.g}, L = ${f2(L)} FT CL BEARING TO CL BEARING, AT THE ENGINE'S ${xs.length} STATIONS (THE ANALYSIS TAB'S FORCE EFFECTS PER GIRDER, SAGGING +). LABELS: STRENGTH I MAX. AT THE TENTH POINTS${neg ? ', MIN. AT THE ENDS' : ''}; THE SHEARS AT THE ENDS.`,
      `DEMANDS: ${ds ? `${ds.what} (${ds.detail})` : 'THIS APP\'S ANALYSIS'}${R.useExt ? '; DC2, DW AND LL+IM FROM THE IMPORTED FILE, THE GIRDER AND DC1 COMPUTED BY THIS APP ON THE SIMPLE SPAN' : R.fe ? '; GIRDER AND DC1 ON THE SIMPLE SPAN, DC2, DW AND LL+IM ON THE CONTINUOUS UNIT' : ''}.`,
      'STRENGTH I AS THE ANALYSIS TAB (AASHTO LRFD 10TH ED. TABLE 3.4.1-1; DC = GIRDER + DC1 + DC2). WORKED: ANALYSIS TAB (MOMENTS AT MIDSPAN, SHEARS AT THE SUPPORT); THE OTHER LINES OF THIS TYPE: THE ANALYSIS TAB WITH THAT LINE.'];
    wrap(notes.map(t => X_().str(asc(t)).toUpperCase()), C.wrap).forEach((t, i) => D.text(Ly.t, 0, y - (amp + 0.4) * k - 1.8 * i * h, h * 0.8, t, 0));
  }

  /* ---------- batch H3 (2026-11-15): camber and haunch, end zone reinforcement, diaphragms, deck ---------- */
  const fx3 = v => fN(v, 3), udn = v => typeof v === 'number' && isFinite(v) ? (v >= 0 ? 'UP' : 'DOWN') : '';
  /* tables drawn under a figure: the steel table() at (x, y) one below the other; returns the y under the last */
  const tablesAt = (D, x, y, list) => { const lL = D.layer('TBL', 8), lT = D.layer('TEXT', 7); list.forEach(q => { y = table(D, lL, lT, x, y, q.cols, q.rows, q.title).y - 0.6 * D.h; }); return y; };
  /* columns of tables side by side from (x, y): each column's tables one below the other; returns the y under the lowest */
  const tableCols = (D, x, y, cols) => { let yb = y, xx = x; cols.forEach(list => { const i0 = D.mark(); yb = Math.min(yb, tablesAt(D, xx, y, list)); const b = D.bbox(i0); xx = b[2] + 4 * D.h; }); return yb; };
  /* camber and haunch of a girder type on its first line (the Camber & deflection tab): the camber at erection, deck placement (haunch /
     screed) and the beam seats and the haunch build-up at the tenth points (R.haunch, plotted and tabulated), the net camber at midspan by
     stage and its components (R.cam). Nothing computed here. */
  function camber(D, C) {
    const m = C.t, R = m.R, Hn = R.haunch || [], c = R.cam || {}, xs = Hn.map(r => +r.x), L = +R.L, h = D.h, k = D.k, amp = C.amp || 1.1, lT = D.layer('TEXT', 7);
    const Ly = { er: D.layer('CAMB-ERECT', 4), dk: D.layer('CAMB-DECK', 3), st: D.layer('CAMB-SEAT', 6), hb: D.layer('HAUNCH', 1) };
    const pc = plot(D, Ly.er, 0, xs, [{ ys: Hn.map(r => +r.camErect), l: Ly.er }, { ys: Hn.map(r => +r.camDeck), l: Ly.dk }, { ys: Hn.map(r => +r.camSeat), l: Ly.st, lt: 'DASHED' }, { ys: Hn.map(r => +r.buildup), l: Ly.hb }],
      'CAMBER AND HAUNCH BUILD-UP ALONG THE GIRDER', 'IN', [0, L], amp);
    D.text(lT, xs[xs.length - 1] * 12, (amp + 0.15) * k + 2 * h, h * 0.7, 'CYAN ERECTION / GREEN DECK PLACEMENT (HAUNCH) / MAGENTA BEAM SEAT (DASHED) / RED HAUNCH BUILD-UP (+ UP)', 2);
    const mid = Hn.findIndex(r => Math.abs(r.x - L / 2) < 1e-6) >= 0 ? Hn.findIndex(r => Math.abs(r.x - L / 2) < 1e-6) : Math.floor(Hn.length / 2);
    lab(D, lT, xs, Hn.map(r => +r.buildup), 0, pc.vs, [0, mid, Hn.length - 1], v => (+v).toFixed(2));
    lab(D, lT, xs, Hn.map(r => +r.camErect), 0, pc.vs, [mid], v => (+v).toFixed(2));
    const stg = [['RELEASE', c.rel], ['ERECTION', c.erect], ['DECK PLACEMENT', c.afterDeck], ['BEAM SEAT', c.seat], ['FINAL', c.final]];
    const cmp = [['PRESTRESS', c.dPS, 'UP'], ['SELF-WEIGHT', c.dSW, 'DOWN'], ['DECK + HAUNCH', c.dDK, 'DOWN'], ...(c.dDia > 1e-4 ? [['DIAPHRAGMS', c.dDia, 'DOWN']] : []), ['DC2 + DW', c.dSD, 'DOWN'], ['LL + IM', c.dLL, 'DOWN'], ['LL LIMIT', c.llLim, '']];
    const y1 = tableCols(D, 0, -(amp + 1.0) * k, [[
      { title: 'CAMBER AND HAUNCH AT THE TENTH POINTS (IN)', cols: ['X (FT)', 'SHAPE', 'ERECTION', 'DECK (HAUNCH)', 'SEAT', 'BUILD-UP'], rows: Hn.map(r => [fN(r.x, 1), fx3(r.par), fx3(r.camErect), fx3(r.camDeck), fx3(r.camSeat), fN(r.buildup, 2)]) }],
      [{ title: 'CAMBER AT MIDSPAN (IN)', cols: ['STAGE', 'CAMBER', ''], rows: stg.map(([a, v]) => [a, fx3(v), udn(v)]) }],
      [{ title: 'COMPONENTS AT MIDSPAN (IN)', cols: ['DEFLECTION', 'MAGNITUDE', ''], rows: cmp.map(([a, v, d]) => [a, fx3(v), d]) }]]);
    const notes = [`CAMBER AND HAUNCH OF GIRDER TYPE ${m.label.toUpperCase()} (SPAN ${m.span}) ON LINE G${m.g}, L = ${f2(L)} FT. HAUNCH BUILD-UP AT THE CL BEARINGS ${fN(Hn[0] && Hn[0].buildup, 2)} AND ${fN(Hn[Hn.length - 1] && Hn[Hn.length - 1].buildup, 2)} IN, AT MIDSPAN ${fN(Hn[mid] && Hn[mid].buildup, 2)} IN (THE ENTERED HAUNCH ${f2(m.inp.th)} IN PLUS THE RESIDUAL DECK-PLACEMENT CAMBER, AS THE CAMBER & DEFLECTION TAB).`,
      'X FROM THE LEFT CL BEARING; SHAPE: THE SHAPE FACTOR OF THE CAMBER ALONG THE GIRDER; ERECTION, DECK (HAUNCH AND SCREED), SEAT (BEAM SEATS): THE CAMBER AT EACH STAGE (+ UP); FINAL: LONG-TERM. CAMBER MULTIPLIERS: PCI DESIGN HANDBOOK, AS ENTERED ON THE MATERIALS TAB. THE BEAM SEATS USE THE BEAM-SEAT CAMBER. CHECK THE MINIMUM HAUNCH AT MIDSPAN AND THE MAXIMUM AT THE BEARINGS AGAINST THE FABRICATOR\'S TOLERANCE. WORKED: CAMBER & DEFLECTION TAB; OTHER LINES OF THIS TYPE: THAT TAB WITH THAT LINE.'];
    wrap(notes.map(t => X_().str(asc(t)).toUpperCase()), C.wrap).forEach((t, i) => D.text(lT, 0, y1 - 1.0 * h - 1.8 * i * h, h * 0.8, t, 0));
  }
  /* end zone reinforcement of a girder type (the End zone & hold-down tab, R of its first line): the girder end in elevation (true scale,
     schematic depth lines), the splitting steel zone h/4 from the end (R.splitZone) with the legs provided (opt.splitN × splitAv =
     R.AsSplitProv against R.AsSplit), the confinement bars at R.conf.s from the end (R.conf.n bars, provided extent (n − 1)s = R.conf.provExt
     against 1.5d = R.conf.reqExt), ℄ bearing at e_end, the release tension steel (R.relSteel); the checks R.checks. Bar positions schematic. */
  function endzone(D, C) {
    const m = C.t, R = m.R, o = m.inp.opt, cf = R.conf || {}, h = D.h, H = +R.g.h, oh = m.oh, lT = D.layer('TEXT', 7), lG = D.layer('GRDR', 7), lZ = D.layer('ZONE', 30, 'DASHED'), lB = D.layer('REBAR', 1), lD = D.layer('DIMS', 2), lC = D.layer('CNTR', 1, 'CENTER');
    const ext = Math.max(+R.splitZone || 0, cf.exempt ? 0 : (+cf.provExt || 0), cf.exempt ? 0 : (+cf.reqExt || 0), oh) + Math.max(H, 24), cen = D.ltype('CENTER'), dsh = D.ltype('DASHED');
    D.pline(lG, [[ext, 0], [0, 0], [0, H], [ext, H]], false);
    D.pline(lG, [[ext, H], [ext - 2, 0.6 * H], [ext + 2, 0.4 * H], [ext, 0]], false);   // break line
    if (oh > 0) { D.line(lC, oh, -3 * h, oh, H + 3 * h, cen); D.text(lT, oh, H + 3.6 * h, h, 'CL BRG', 1); D.dimH(lD, 0, oh, H + 6 * h, H, 'E_END = <>'); }
    const zs = +R.splitZone || 0;
    if (zs > 0) { D.rect(lZ, 0, 0, zs, H, dsh); D.dimH(lD, 0, zs, -4 * h, 0, `SPLITTING ZONE ${R.splitDir === 'width' ? 'W' : 'H'}/4 = <>`);
      D.text(lT, zs / 2, H / 2, 0.8 * h, `${fN(+o.splitN, 0)} X ${fN(+o.splitAv, 2)} IN2`, 1, 90); }
    if (!cf.exempt && +cf.n > 0 && +cf.s > 0) { const xs = Array.from({ length: Math.round(+cf.n) }, (_, i) => i * +cf.s), yb = Math.min(0.25 * H, 12);
      xs.forEach(x => D.line(lB, x, 0.15 * yb, x, yb));
      D.chainH(lD, xs, -8 * h, 0); D.dimH(lD, 0, +cf.reqExt, -12 * h, 0, 'REQUIRED 1.5D = <>'); }
    const ck = n => { const q = R.checks.find(c => typeof n === 'string' ? c.n === n : n.test(c.n)); return q ? [q.n, fx3(q.v), fx3(q.lim), q.u || '', fx3(q.r), ST(q)] : null; };
    const rows = [ck('Splitting steel (5.9.4.4)'), ck('Confinement steel (5.9.4.4.2)'), ck('Release tens. steel (5.9.2.3.1b)')].filter(Boolean);
    const y1 = tableCols(D, 0, -16 * h, [[
      { title: 'SPLITTING / BURSTING STEEL (5.9.4.4.1)', cols: ['ITEM', 'VALUE', 'UNIT'], rows: [['REQUIRED RESISTANCE (4 % OF THE PRESTRESS AT TRANSFER)', fN(R.splitDem, 1), 'KIP'], ['AS REQUIRED', fN(R.AsSplit, 2), 'IN2'],
        ['LEGS X AREA PROVIDED', `${fN(+o.splitN, 0)} X ${fN(+o.splitAv, 2)} = ${fN(R.AsSplitProv, 2)}`, 'IN2'], ['ZONE FROM THE MEMBER END', fN(R.splitZone, 1), 'IN'], ['ORIENTATION', R.splitDir === 'width' ? 'HORIZONTAL' : 'VERTICAL', ''], ['STEEL F_Y', fN(+o.splitFy, 1), 'KSI']] },
      { title: 'CONFINEMENT STEEL (5.9.4.4.2)', cols: ['ITEM', 'VALUE', 'UNIT'], rows: cf.exempt ? [['NOT REQUIRED', String(cf.why || ''), '']] : [['BAR', `NO. ${fN(cf.barNo, 0)} AT ${fN(cf.s, 2)}`, 'IN'], ['BARS FROM EACH END', fN(cf.n, 0), ''], ['EXTENT PROVIDED (N - 1) S', fN(cf.provExt, 1), 'IN'], ['EXTENT REQUIRED 1.5D', fN(cf.reqExt, 1), 'IN']] }], [
      ...(o.relBondedReinf && R.relSteel ? [{ title: 'BONDED RELEASE TENSION STEEL (5.9.2.3.1B)', cols: ['ITEM', 'VALUE', 'UNIT'], rows: [['GOVERNING', `${R.relSteel.where}, X = ${fN(R.relSteel.x, 2)} FT`, ''], ['AS REQUIRED', fN(R.relSteel.AsReq, 2), 'IN2'], ['AS PROVIDED', fN(R.relSteel.AsProv, 2), 'IN2']] }] : []),
      { title: 'CHECKS (THE ENGINE\'S)', cols: ['CHECK', 'DEMAND', 'LIMIT', 'UNIT', 'RATIO', 'STATUS'], rows }]]);
    const notes = [`END ZONE REINFORCEMENT OF GIRDER TYPE ${m.label.toUpperCase()} (SPAN ${m.span}, LINES ${m.lines.map(g => 'G' + g).join(', ')}): ${m.girder.toUpperCase()}, H = ${f2(H)} IN; BOTH ENDS ALIKE. AASHTO LRFD 10TH ED. 5.9.4.4.`,
      'THE GIRDER END IN ELEVATION AT TRUE SCALE; THE SPLITTING ZONE DASHED, THE CONFINEMENT BARS AT THEIR SPACING FROM THE END IN THE BOTTOM FLANGE (BAR POSITIONS AND HEIGHTS SCHEMATIC; THE BARS SHAPED TO ENCLOSE THE STRANDS ON THE REINFORCEMENT DETAIL).',
      'ENTERED: GIRDERS & STRANDS TAB (SPLITTING AND CONFINEMENT STEEL). WORKED: END ZONE & HOLD-DOWN TAB.'];
    wrap(notes.map(t => X_().str(asc(t)).toUpperCase()), C.wrap).forEach((t, i) => D.text(lT, 0, y1 - h - 1.8 * i * h, h * 0.8, t, 0));
  }
  /* diaphragms: each girder type's diaphragms at their entered distance a from the left ℄ bearing (inp.loads.diaph) and weight P on the
     girder (DC1), as the framing plan draws them in the bays (PSBPlan.model dia); the continuity diaphragms on the pier lines. Geometry as
     the app has it (no diaphragm section is an input). */
  function diaphragms(D, C) {
    const h = D.h, TT = C.types, lT = D.layer('TEXT', 7), lG = D.layer('GRDR', 7), lX = D.layer('DIAP', 5), lD = D.layer('DIMS', 2), lC = D.layer('CNTR', 1, 'CENTER'), cen = D.ltype('CENTER');
    let y = 0;
    TT.forEach(m => { const dd = (m.inp.loads.diaph || []).filter(d => +d.a >= 0 && +d.a <= m.L), Li = m.L * 12;
      D.line(lG, 0, y, Li, y); [0, Li].forEach(x => D.line(lC, x, y - 2 * h, x, y + 2 * h, cen));
      dd.forEach(d => D.line(lX, +d.a * 12, y - 1.2 * h, +d.a * 12, y + 1.2 * h));
      if (dd.length) D.chainH(lD, [0, ...dd.map(d => +d.a * 12).sort((a, b) => a - b), Li], y - 3.5 * h, y); else D.dimH(lD, 0, Li, y - 3.5 * h, y, 'CL BRG TO CL BRG <>');
      D.text(lT, 0, y + 2.6 * h, h, X_().str(`GIRDER TYPE ${m.label.toUpperCase()} (SPAN ${m.span}, LINES ${m.lines.map(g => 'G' + g).join(', ')}): ${dd.length ? `${dd.length} DIAPHRAGM${dd.length > 1 ? 'S' : ''}` : 'NO DIAPHRAGMS'}`), 0);
      y -= 9 * h; });
    const y1 = y + 4 * h;
    const notes = ['DIAPHRAGMS AT THEIR ENTERED DISTANCE FROM EACH LINE\'S LEFT CL BEARING, IN THE BAYS NEXT TO A LINE WHOSE TYPE HAS THEM, PARALLEL TO THE SUPPORTS (FRAMING PLAN; NONE BETWEEN ADJACENT UNITS). THE WEIGHT P IS THE DC1 POINT LOAD ON THE GIRDER (LOADS & LLDF TAB).',
      'THE DIAPHRAGM SECTION, MATERIAL AND CONNECTION ARE NOT INPUTS OF THIS APP: DETAIL THEM ON THE CONTRACT DRAWINGS. ENTERED: DIAPHRAGMS / DECK TAB. SCHEDULE: THE NEXT SHEET.'];
    wrap(notes, C.wrap).forEach((t, i) => D.text(lT, 0, y1 - h - 1.8 * i * h, h * 0.8, t, 0));
  }
  function diaphBlocks(TT, pl) {
    const rows = [], cont = pl && pl.cont ? pl.cont : [];
    TT.forEach(m => (m.inp.loads.diaph || []).filter(d => +d.a >= 0 && +d.a <= m.L).forEach((d, i) => rows.push([m.label, String(m.span), m.lines.map(g => 'G' + g).join(' '), String(i + 1), f2(+d.a), f2(m.L - +d.a), f2(+d.P)])));
    return [{ t: 'head', lines: [[1.6, 'DIAPHRAGM SCHEDULE']] },
      { t: 'table', title: 'INTERMEDIATE DIAPHRAGMS PER GIRDER TYPE', cols: ['TYPE', 'SPAN', 'LINES', 'NO.', 'A FROM LEFT CL BRG (FT)', 'FROM RIGHT CL BRG (FT)', 'WEIGHT ON THE GIRDER P (KIP, DC1)'], rows: rows.length ? rows : [['NONE', '', '', '', '', '', '']] },
      ...(cont.length ? [{ t: 'table', title: 'CONTINUITY DIAPHRAGMS', cols: ['SUPPORT', 'NOTE'], rows: [...new Set(cont.map(c => c.k))].map(kk => [`PIER ${kk}`, 'ON THE PIER LINE, THE SPANS MADE CONTINUOUS FOR COMPOSITE LOADS (FRAMING PLAN)']) }] : []),
      { t: 'notes', title: '', wc: 100, lines: ['A: THE ENTERED DISTANCE FROM THE LEFT CL BEARING OF EACH LINE OF THE TYPE; FROM THE RIGHT CL BEARING: L - A. P: THE DC1 POINT LOAD ON THE GIRDER (DIAPHRAGMS / DECK TAB; LOADS & LLDF TAB).'] }];
  }
  /* deck reinforcement and overhang (the Deck tab, the strip method: R.deck of the exterior line's girder type, and a table of every type's
     results): the deck from the left edge over G1 into the first bay (true scale): thickness R.deck.ts, overhang R.deck.oh, girder spacing
     R.deck.Ls, the bars at their effective depths R.deck.pos.dEff / neg.dEff, the negative-moment design section R.deck.xneg from ℄ G1, the
     barrier base width R.deck.bBar (its height schematic) */
  function deck(D, C) {
    const m = C.t, Dk = m.R.deck, h = D.h, ts = +Dk.ts, oh = +Dk.oh * 12, S = +Dk.Ls * 12, x1 = S + Math.min(S / 2, 36), bb = +Dk.bBar;
    const lK = D.layer('DECK', 8), lA = D.layer('APPR', 30), lB = D.layer('REBAR', 1), lD = D.layer('DIMS', 2), lT = D.layer('TEXT', 7), lC = D.layer('CNTR', 1, 'CENTER'), cen = D.ltype('CENTER'), dsh = D.ltype('DASHED');
    D.pline(lK, [[x1, 0], [-oh, 0], [-oh, ts], [x1, ts]], false); D.pline(lK, [[x1, ts], [x1 - 1, 0.6 * ts], [x1 + 1, 0.4 * ts], [x1, 0]], false);
    if (bb > 0) D.rect(lA, -oh, ts, -oh + bb, ts + 3 * ts);
    [0, S].forEach((x, i) => { D.line(lC, x, -4 * h, x, ts + 4 * ts, cen); D.text(lT, x, -5.5 * h, h, `CL G${i + 1}`, 1); });
    const yT = ts - +Dk.neg.dEff, yB = ts - +Dk.pos.dEff;
    D.line(lB, -oh + 1.5, yT, x1, yT); D.line(lB, -oh + 1.5, yB, x1, yB);
    D.text(lT, x1 + 2 * h, yT - 0.4 * h, 0.8 * h, `TOP BARS ${fN(+m.inp.deck.barTop, 2)} IN2 AT ${fN(+m.inp.deck.sTop, 2)} IN`, 0);
    D.text(lT, x1 + 2 * h, yB - 0.4 * h, 0.8 * h, `BOTTOM BARS ${fN(+m.inp.deck.barBot, 2)} IN2 AT ${fN(+m.inp.deck.sBot, 2)} IN`, 0);
    D.dimH(lD, -oh, 0, ts + 6 * ts, ts, 'OVERHANG <>'); D.dimH(lD, 0, S, ts + 6 * ts, ts, 'S = <>');
    if (bb > 0) D.dimH(lD, -oh, -oh + bb, ts + 4.5 * ts, ts + 3 * ts, 'BARRIER <>');
    D.dimV(lD, 0, ts, x1 + 22 * h, x1, 'T = <>'); D.dimV(lD, yT, ts, -oh - 3 * h, -oh, 'D TOP = <>'); D.dimV(lD, yB, ts, -oh - 7 * h, -oh, 'D BOT = <>');
    if (+Dk.xneg > 0) { D.line(lD, +Dk.xneg, -1.5 * h, +Dk.xneg, ts + 1.5 * h, dsh); D.dimH(lD, 0, +Dk.xneg, -2.5 * h, 0, 'NEG. DESIGN SECTION <>'); }
    const rows = C.types.filter(t => t.R.deck).map(t => { const q = t.R.deck, ck = n => t.R.checks.find(c => c.n === n);
      return [t.label, String(t.span), f2(+q.Ls), fN(q.Mu_pos, 2), fN(q.pos.phiMn, 2), fx3((ck('Deck +M') || {}).r), fN(q.Mu_neg, 2), fN(q.neg.phiMn, 2), fx3((ck('Deck −M') || {}).r), fN(q.Mu_oh, 2), fN(q.ohCap.phiMn, 2), fx3((ck('Deck overhang') || {}).r), `${fN(q.distPct, 0)} %`]; });
    const y1 = tablesAt(D, -oh, -9 * h, [{ title: 'DECK DESIGN BY GIRDER TYPE (STRIP METHOD; K-FT/FT)', cols: ['TYPE', 'SPAN', 'S (FT)', 'MU +', 'PHI MN +', 'RATIO', 'MU -', 'PHI MN -', 'RATIO', 'MU OVERHANG', 'PHI MN', 'RATIO', 'DIST. STEEL'], rows }]);
    const notes = [`DECK OVER GIRDER TYPE ${m.label.toUpperCase()} (G${m.g}, THE EXTERIOR LINE): TRANSVERSE DESIGN BY THE EQUIVALENT-STRIP METHOD (AASHTO LRFD 10TH ED. 4.6.2.1, TABLE A4-1; DISTRIBUTION STEEL 9.7.3.2) AS THE DECK TAB. DECK F'C ${fN(+Dk.fcd, 2)} KSI, F_Y ${fN(+Dk.fy, 1)} KSI.`,
      'TRUE SCALE; THE BARS AT THEIR EFFECTIVE DEPTHS (THE ENGINE\'S), THE BARRIER HEIGHT SCHEMATIC. ENTERED: DIAPHRAGMS / DECK TAB. WORKED: DECK TAB.'];
    wrap(notes, C.wrap).forEach((t, i) => D.text(lT, -oh, y1 - h - 1.8 * i * h, h * 0.8, X_().str(t), 0));
  }

  /* one sheet (adapted copy of the steel app's sheet()): the smallest plot scale (not below S.kmin) at which the drawing fits the drawing
     area; the drawing placed top left at x offset ox; border, inner border and title block at the plot scale */
  function sheet(D, S, ox, C) {
    const [pw, ph] = PAPER[S.paper] || PAPER.D, aw = pw - 2.25, ah = ph - 4.55, i0 = D.mark(); let k = null, b = null;
    for (const kk of SCALES) { if (kk < (S.kmin || 1)) continue; D.E.length = i0; D.k = kk; D.h = TXT * kk; S.fn(D, S.c); b = D.bbox(i0); if (!isFinite(b[0])) b = [0, 0, 0, 0]; if ((b[2] - b[0]) / kk <= aw && (b[3] - b[1]) / kk <= ah) { k = kk; break; } }
    const over = !k; if (!k) k = D.k;
    const W = pw * k, H = ph * k; D.move(i0, ox + 1.25 * k - b[0], H - 1.0 * k - b[3]); const iC = D.mark();
    const pj = C.P.project || {}, cells = [[0.75, 'PROJECT', pj.name || ''], [9, 'PROJECT NO.', pj.number || ''], [13, 'SHEET TITLE', S.title], [24, 'SCALE', scaleName(k) + (S.half ? ' (HALF SIZE)' : '')], [28, 'DESIGNED / CHECKED', `${pj.designer || '-'} / ${pj.checker || '-'}`], [31, 'SHEET', `${S.n} OF ${S.of}`]];
    const tb = D.layer('TBLK', 7), bd = D.layer('BRDR', 7);
    if (!S.half) X_().sheetBorder(D, bd, ox, W, H, k); D.rect(bd, ox + 0.75 * k, 0.5 * k, ox + W - 0.5 * k, H - 0.5 * k);
    const ty = 0.5 * k, th = 2.6 * k, x1 = ox + W - 0.5 * k; D.line(tb, ox + 0.75 * k, ty + th, x1, ty + th);
    const sx = pw / 34; cells.forEach(([cx, lb, val], i) => { const xx = ox + cx * k * sx; if (i) D.line(tb, xx, ty, xx, ty + th); D.text(tb, xx + 0.15 * k, ty + th - 0.35 * k, 0.1 * k, lb); D.text(tb, xx + 0.15 * k, ty + 1.0 * k, 0.18 * k, String(val).toUpperCase()); });
    D.text(tb, ox + 0.9 * k, ty + 0.25 * k, 0.08 * k, `GENERATED BY PRESTRESSED BRIDGE DESIGN (NEW APP) ${C.date}. FULL-SIZE GEOMETRY IN INCHES; PLOT THIS SHEET AT ${k === 1 ? 'FULL SIZE' : '1:' + k} (${scaleName(k)}).`
      + (S.half ? ` HALF-SIZE PRINT ON 11 X 17: THE SCALES SHOWN ARE FOR THE FULL-SIZE ${pw} X ${ph} SHEET; THIS PRINT IS AT 1:${2 * k}.` : ''));
    return { n: S.n, title: S.title, id: S.id, s: S.c.s, k, W, H, ox, i0, iC, i1: D.mark(), over, paper: S.paper };
  }

  /* build(P, opt): the drawing set. Part 1: the typical section of each span (one sheet; one per span when there are several spans) and
     the framing plan; part 2: each girder type's elevation and strand pattern, the schedule; part 3 (batch H1): the cover and sheet index
     first, the general notes second, the design summary last (opt.all(): PSBBridge.results of every girder type on every line, the page's
     cache; absent: computed here by the same call). A figure that cannot be drawn (its model's errors) is listed in miss. */
  function build(P, opt) {
    opt = opt || {}; const D = X_().drawing({ prefix: 'S-' }), errors = [], miss = [];
    const C = { P, date: opt.date || new Date().toISOString().slice(0, 10) }, list = [];
    const [pw, ph] = PAPER[opt.paper] || PAPER.D, aw = pw - 2.25, ah = ph - 4.55;
    const memo = new Map(), resI = inp => { const key = JSON.stringify(inp); if (!memo.has(key)) { let R; try { R = window.PSBHoldDown.compute(JSON.parse(key)); } catch (e) { R = { error: e.message }; } memo.set(key, R); } return memo.get(key); };
    const o2 = { ...opt, res: opt.res || ((k, g) => resI(window.PSBDesign.cellInputs(P, k, g))) };
    /* the sheets of a list of blocks: one sheet, or "(i OF n)" when they need more */
    const addBlocks = (id, title, blocks) => { const pg = blockPages(blocks, aw, ah);
      pg.forEach((items, i) => list.push({ id: i ? `${id}${i + 1}` : id, title: pg.length > 1 ? `${title} (${i + 1} OF ${pg.length})` : title, fn: pageFn(items), c: { ...C }, kmin: 1 })); };
    const ns = (P.spans && P.spans.lengths || []).length;
    for (let s = 1; s <= Math.max(ns, 1); s++) {
      let xs; try { xs = window.PSBXsFig.model(P, s); } catch (e) { xs = { errors: [e.message] }; }
      if (xs.errors && xs.errors.length) { miss.push([`TYPICAL SECTION${ns > 1 ? `, SPAN ${s}` : ''}`, xs.errors.join(' ').toUpperCase()]); continue; }
      list.push({ id: ns > 1 ? `sec${s}` : 'sec', title: ns > 1 ? `TYPICAL SECTION, SPAN ${s}` : 'TYPICAL SECTION', fn: section, c: { ...C, xs, s, ns }, kmin: 12 });
    }
    let pl; try { pl = window.PSBPlan.model(P); } catch (e) { pl = { errors: [e.message] }; }
    if (pl.errors && pl.errors.length) miss.push(['FRAMING PLAN', pl.errors.join(' ').toUpperCase()]);
    else list.push({ id: 'plan', title: 'FRAMING PLAN', fn: plan, c: { ...C, pl }, kmin: 48 });
    // part 2 (item B): each girder type's elevation and strand pattern, then the schedule of every type
    let TM; try { TM = typeModels(P, o2); } catch (e) { TM = { types: [], miss: [['GIRDER SHEETS', String(e.message).toUpperCase()]] }; }
    TM.miss.forEach(q => miss.push(q));
    TM.types.forEach(t => {
      list.push({ id: `elev${t.k}`, title: `GIRDER ${t.label.toUpperCase()}: ELEVATION`, fn: elevation, c: { ...C, t }, kmin: 12 });
      list.push({ id: `strd${t.k}`, title: `GIRDER ${t.label.toUpperCase()}: STRAND PATTERN`, fn: strands, c: { ...C, t }, kmin: 2 });
    });
    if (TM.types.length) list.push({ id: 'sched', title: 'STRAND AND GIRDER SCHEDULE', fn: schedule, c: { ...C, types: TM.types, aw }, kmin: 1 });
    // batch H3: each girder type's camber / haunch and end zone; the diaphragms; the deck (the exterior line's type, when the deck is designed)
    const amp = opt.paper === 'B' ? 0.7 : 1.1;
    TM.types.forEach(t => { if (t.R.haunch && t.R.haunch.length) list.push({ id: `camb${t.k}`, title: `GIRDER ${t.label.toUpperCase()}: CAMBER AND HAUNCH`, fn: camber, c: { ...C, t, amp }, kmin: 24 }); else miss.push([`GIRDER ${t.label.toUpperCase()}: CAMBER AND HAUNCH`, 'NO HAUNCH TABLE IN THE ENGINE RESULT']); });
    TM.types.forEach(t => list.push({ id: `endz${t.k}`, title: `GIRDER ${t.label.toUpperCase()}: END ZONE REINFORCEMENT`, fn: endzone, c: { ...C, t }, kmin: 4 }));
    if (TM.types.some(t => (t.inp.loads.diaph || []).some(d => +d.P > 0 || +d.a > 0)) || (pl && pl.cont && pl.cont.length)) { list.push({ id: 'diaph', title: 'DIAPHRAGM DETAILS', fn: diaphragms, c: { ...C, types: TM.types }, kmin: 24 }); addBlocks('diapht', 'DIAPHRAGM SCHEDULE', diaphBlocks(TM.types, pl && !pl.errors.length ? pl : null)); }
    else if (TM.types.length) miss.push(['DIAPHRAGM DETAILS', 'NO DIAPHRAGMS ENTERED (DIAPHRAGMS / DECK TAB) AND NO CONTINUITY DIAPHRAGMS']);
    { const ex = TM.types.find(t => t.R.deck && t.lines.includes(1)) || TM.types.find(t => t.R.deck);
      if (ex) list.push({ id: 'deck', title: 'DECK REINFORCEMENT AND OVERHANG', fn: deck, c: { ...C, t: ex, types: TM.types }, kmin: 4 });
      else if (TM.types.length) miss.push(['DECK REINFORCEMENT AND OVERHANG', 'DECK DESIGN OFF (DIAPHRAGMS / DECK TAB)']); }
    // batch H2: each girder type's analysis diagrams; batch H1/H2: the bearing reactions and the design summary (every type on every line)
    TM.types.forEach(t => list.push({ id: `diag${t.k}`, title: `GIRDER ${t.label.toUpperCase()}: ANALYSIS DIAGRAMS`, fn: diag, c: { ...C, t, amp }, kmin: 48 }));
    if (TM.types.length) { let A = null, why = '';
      try { A = (opt.all && opt.all()) || window.PSBBridge.results(P, resI); } catch (e) { why = e.message; }
      const ok = A && A.cells && A.cells.length;
      if (ok && window.PSBHandoffs && window.PSBHandoffs.srAll) { try { addBlocks('reac', 'BEARING REACTIONS', reacBlocks(P, A)); } catch (e) { miss.push(['BEARING REACTIONS', String(e.message).toUpperCase()]); } }
      else miss.push(['BEARING REACTIONS', (why || 'NO RESULTS OF EVERY GIRDER TYPE ON EVERY LINE').toUpperCase()]);
      if (ok && window.PSBSummaryUI) { try { addBlocks('summ', 'DESIGN SUMMARY', summaryBlocks(P, A)); } catch (e) { miss.push(['DESIGN SUMMARY', String(e.message).toUpperCase()]); } }
      else miss.push(['DESIGN SUMMARY', (why || 'NO RESULTS OF EVERY GIRDER TYPE ON EVERY LINE').toUpperCase()]); }
    if (!list.length) errors.push('Nothing to draw: ' + miss.map(q => q.join(': ')).join('; '));
    // the general notes (second) and the cover with the sheet index (first): the cover's own sheets counted in the index
    const head = [];
    const notesL = []; if (TM.types.length) { const pg = blockPages(notesModel(P, TM), aw, ah); pg.forEach((items, i) => notesL.push({ id: i ? `notes${i + 1}` : 'notes', title: pg.length > 1 ? `GENERAL NOTES (${i + 1} OF ${pg.length})` : 'GENERAL NOTES', fn: pageFn(items), c: { ...C }, kmin: 1 })); }
    let nC = 1, cpg = null;
    for (let it = 0; it < 5; it++) {
      const titles = [...Array.from({ length: nC }, (_, i) => nC > 1 ? `COVER AND SHEET INDEX (${i + 1} OF ${nC})` : 'COVER AND SHEET INDEX'), ...notesL.map(q => q.title), ...list.map(q => q.title)];
      cpg = blockPages(coverBlocks(P, TM, titles.map((t, i) => [i + 1, t]), miss, C.date), aw, ah); if (cpg.length === nC) break; nC = cpg.length;
    }
    cpg.forEach((items, i) => head.push({ id: i ? `cover${i + 1}` : 'cover', title: cpg.length > 1 ? `COVER AND SHEET INDEX (${i + 1} OF ${cpg.length})` : 'COVER AND SHEET INDEX', fn: pageFn(items), c: { ...C }, kmin: 1 }));
    const all = errors.length ? list : [...head, ...notesL, ...list];
    let ox = 0; const sheets = [];
    const wr = Math.floor(aw * 0.8 / TXT);   // note characters per line: 80 % of the drawing width
    all.forEach((S, i) => { S.c.wrap = wr; const r = sheet(D, { ...S, paper: opt.paper || 'D', n: i + 1, of: all.length, half: !!opt.half }, ox, C); sheets.push(r); ox += r.W + 2 * r.k * 12; });
    return { D, sheets, miss, errors };
  }

  window.PSBSheets = { PAPER, SCALES, SCALE_NAME, TXT, build, sheet, section, plan, typeModels, elevation, strands, schedule,
    blockPages, blockBox, coverBlocks, notesModel, summaryRows, summaryBlocks, reacBlocks, diag, plot, camber, endzone, diaphragms, diaphBlocks, deck };
})();
