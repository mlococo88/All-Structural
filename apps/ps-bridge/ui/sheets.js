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
      if (a.kind === 'bar') { const e = a.edge, i = a.inner, d = i - e, H = a.y1 - a.y0, y0 = a.y0; D.pline(lA, [[e, y0], [i, y0], [i - 0.25 * d, y0 + 0.25 * H], [e + 0.45 * d, y0 + H], [e, y0 + H]], true); }
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
      'BARRIER HEIGHT AND PROFILE, RAILING AND FENCE POST HEIGHTS: SCHEMATIC (THE WIDTHS, POSITIONS AND THICKNESSES ARE THE CROSS-SECTION TAB\'S INPUTS).',
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
      out.push({ k, label: T.label, span: T.span, lines, g, inp, R, L, oh, h: +R.g.h, girder: inp.girder, dia: num(inp.str.size) || 0.5, size: inp.str.size,
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

  /* build(P, opt): the sheets of part 1: the typical section of each span (one sheet; one per span when there are several spans) and
     the framing plan. A figure that cannot be drawn (its model's errors) is listed in miss. */
  function build(P, opt) {
    opt = opt || {}; const D = X_().drawing({ prefix: 'S-' }), errors = [], miss = [];
    const C = { P, date: opt.date || new Date().toISOString().slice(0, 10) }, list = [];
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
    let TM; try { TM = typeModels(P, opt); } catch (e) { TM = { types: [], miss: [['GIRDER SHEETS', String(e.message).toUpperCase()]] }; }
    TM.miss.forEach(q => miss.push(q));
    TM.types.forEach(t => {
      list.push({ id: `elev${t.k}`, title: `GIRDER ${t.label.toUpperCase()}: ELEVATION`, fn: elevation, c: { ...C, t }, kmin: 12 });
      list.push({ id: `strd${t.k}`, title: `GIRDER ${t.label.toUpperCase()}: STRAND PATTERN`, fn: strands, c: { ...C, t }, kmin: 2 });
    });
    const aw = (PAPER[opt.paper] || PAPER.D)[0] - 2.25;
    if (TM.types.length) list.push({ id: 'sched', title: 'STRAND AND GIRDER SCHEDULE', fn: schedule, c: { ...C, types: TM.types, aw }, kmin: 1 });
    if (!list.length) errors.push('Nothing to draw: ' + miss.map(q => q.join(': ')).join('; '));
    let ox = 0; const sheets = [];
    const wr = Math.floor(((PAPER[opt.paper] || PAPER.D)[0] - 2.25) * 0.8 / TXT);   // note characters per line: 80 % of the drawing width
    list.forEach((S, i) => { S.c.wrap = wr; const r = sheet(D, { ...S, paper: opt.paper || 'D', n: i + 1, of: list.length, half: !!opt.half }, ox, C); sheets.push(r); ox += r.W + 2 * r.k * 12; });
    return { D, sheets, miss, errors };
  }

  window.PSBSheets = { PAPER, SCALES, SCALE_NAME, TXT, build, sheet, section, plan, typeModels, elevation, strands, schedule };
})();
