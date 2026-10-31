/* apps/steel-bridge/engine/sheets.js — the drawing set: every sheet GirderDetail exports, each with its border and title block
   (window.SBDSheets). Classic script, no DOM. Display and export only: nothing here feeds a result.
   Needs (loaded first, read at call time): shared/dxf.js, engine/drawings.js (SBDDrawings: geometry, plan, elevation, section, table,
   notes, tag), engine/framing.js, engine/flexure.js (envelopeStrI, factors), engine/crossframes.js, engine/constructibility.js (OH_DEF),
   engine/fatigue.js (DET), engine/welds.js (wMinFor), engine/analysis.js (settings); for results(): report/data.js (SBDReportData),
   report/builders.js (SBDReportBuild) and ui/welds.js (SBDWeldsUI.build), as the Report tab.

   Ported 2026-10-30 from GirderDetail ("Steel Bridge Design.html", the R12 sheet set of its DXF export), item SB2-DW5:
     sheets and title block      dxfSheet, dxfBuild (anchors `function dxfSheet(D, S, drawFn, ctx, ox) {`, `function dxfBuild(lay) {`):
                                 paper D 34 x 22 in (or B 17 x 11), drawing area 31.75 x 17.45 in, the smallest plot scale of the list
                                 (not below the sheet's minimum) at which the sheet fits; border, inner border, title block cells
                                 PROJECT, PROJECT NO., SHEET TITLE, SCALE, DESIGNED / CHECKED, SHEET n OF N, footer;
     cover and sheet index       dxfCover;   erection diagram, shipping pieces, work points   dxfErect;
     elevation with the Strength I moment envelope, plate schedule, camber tables and diagram   dxfElev (one and all girders);
     typical section, general notes, weld symbols, quantities   dxfSection;   field splice   dxfSplice;
     analysis diagrams   dxfPlot, dxfLab, dxfDiag;   design summary   dxfSummary;   bearing reactions   dxfReac;
     fatigue and fracture   dxfFat;   deck overhang   dxfOH;   bearing stiffeners   dxfBS;   cross-frame or diaphragm   dxfCF;
     transverse stiffeners and connection plates   dxfTS;   shear connectors   dxfSC;   standard details and staging notes   dxfStd;
     flange transitions   dxfWT;   weld symbol   dxfWeld.
   Differences (decisions recorded in fixlog/steel-bridge.md, SB2-DW6 to DW12):
     - the sheets are drawn in model space, each with its border and title block at its plot scale (GirderDetail's R12 format); its
       "layouts" format (paper-space layouts with viewports) was written by ezdxf running in the browser (Pyodide), which this app does
       not load, and DXF R12 has a single paper space (SB2-DW6);
     - every girder line gets its own elevation and camber (the plates of the plate girder that loads it, SB2-DW1); results per plate
       girder (one analysis per plate girder, mapped to each girder's own stations as the drawings do, SB2-DW2);
     - analysis diagrams: moments, shears, dead-load deflections; the flange-stress plots are left out (the app works the flange stresses
       at its check locations, not along the girder) (SB2-DW8);
     - bearing reactions: DC1, DC2, DW, LL+IM and their service sums; the jacking and seismic columns are left out (not worked in this
       app) (SB2-DW9);
     - quantities: from the plates, stiffeners, splices and studs of this project (GirderDetail: Design all's cost list) (SB2-DW10).

   Units: drawings full size in inches; stations ft; forces kip, kip-ft; deflections in. */
(function () {
  'use strict';
  const X_ = () => window.SharedDxf, DW = () => window.SBDDrawings;
  const f0 = v => (+v).toFixed(0), f2 = v => (+v).toFixed(2);
  const frac = v => X_().frac(v), dIn = v => X_().fmtIn(v), dFI = v => X_().fmtFtIn(v), str = s => X_().str(s);
  const PAPER = { D: [34, 22], B: [17, 11] };
  const GAM = 490 / 1728;   // steel, lb/in^3 (490 pcf; the analysis's 3.4028 lb/ft per in^2, SB2-A2)
  const nm = v => (v === '' || v == null ? NaN : +v);
  const ED = 'AASHTO LRFD 10TH ED.';
  const supName = (k, n) => k === 0 ? 'ABUT. 1' : k === n - 1 ? 'ABUT. 2' : `PIER ${k}`;
  /* TeX of a check title as plain text (SharedSteps.toText; $ removed) */
  const plain = s => { const S = window.SharedSteps, t = S && S.toText ? String(s || '').replace(/\$([^$]*)\$/g, (m, q) => S.toText(q)) : String(s || ''); return t.replace(/\$/g, ''); };

  /* ---------- results the sheets read (the same functions as the tabs) ---------- */
  /* results(P, G): per plate girder used by a girder line (G.girders[i].pg): { B (report/data.js compute: an, spl, fat, cn, shear, flex,
     rating), an, spl, fat, gov (report/builders.js summary rows), wt (ui/welds.js build), err }. The analysis of each plate girder runs
     once (analyzeGirder memoised for this call, as report/data.js does). */
  function results(P, G) {
    const AN = window.SBDAnalysis, out = { pg: {}, pgs: [] };
    const pgs = [...new Set(G.girders.map(g => g.pg))]; out.pgs = pgs;
    const orig = AN && AN.analyzeGirder, memo = new Map();
    if (AN) AN.analyzeGirder = (P_, gi, o) => { if (P_ !== P) return orig(P_, gi, o); const k = gi + '|' + JSON.stringify(o || {}); if (!memo.has(k)) memo.set(k, orig(P_, gi, o)); return memo.get(k); };
    try {
      pgs.forEach(pg => { const r = { pg, err: {} };
        try { const B = window.SBDReportData.compute(P, pg); r.B = B; Object.assign(r.err, B.err); r.an = B.an || null; r.spl = B.spl || null; r.fat = B.fat || null;
          try { r.gov = window.SBDReportBuild.model(B).gov; } catch (e) { r.err.sum = e.message; } } catch (e) { r.err.all = e.message; }
        try { const w = window.SBDWeldsUI.build({ P, g: pg }); if (w.err) r.err.wt = w.err; else r.wt = w; } catch (e) { r.err.wt = e.message; }
        out.pg[pg] = r; });
    } finally { if (AN) AN.analyzeGirder = orig; }
    return out;
  }
  const resOf = (C, g) => (C.RS && C.RS.pg && C.RS.pg[g.pg]) || null;
  const toOwn = (G, i, x) => window.SBDFraming.toG(G.FR, i, G.sup, x);
  const linesOf = (G, pg) => G.girders.filter(g => g.pg === pg).map(g => g.label);
  /* linear interpolation of arr at x on the stations xs */
  function at(xs, arr, x) { let i = 0; while (i < xs.length - 2 && xs[i + 1] < x - 1e-9) i++; const t = Math.max(0, Math.min(1, (x - xs[i]) / ((xs[i + 1] - xs[i]) || 1))); return arr[i] * (1 - t) + arr[i + 1] * t; }
  /* tenth points of each span on the analysis stations (centerline spans) */
  const tenths = sup => { const out = []; for (let k = 0; k < sup.length - 1; k++) for (let q = 0; q <= 10; q++) { if (k > 0 && q === 0) continue; out.push({ k, q, x: sup[k] + q / 10 * (sup[k + 1] - sup[k]) }); } return out; };
  const ptName = t => `SPAN ${t.k + 1} ${t.q === 0 ? '0.0L' : t.q === 10 ? '1.0L' : '0.' + t.q + 'L'}`;
  /* the envelopes of an analysis result A (engine/analysis.js): Strength I with engine/flexure.js envelopeStrI and the Flexure tab's factors
     (AASHTO LRFD 10th Ed. Table 3.4.1-1), applied to moments and to the shears just left and right of each station. sb-ped-owner PR
     (2026-10-30): with the project P, the owner load rules η, m (OWN6/OWN7, factorsOwner, as engine/flexure.js and GirderDetail) and LL+IM
     with the pedestrian load once (SBDAnalysis.llPL), m kept off the pedestrian part (GD45: LL + PL − PL + PL/m). */
  function env(A, P) {
    const FX = window.SBDFlexure, OW = window.SBDOwners, own = (P && P.ownerRules) || null, lf = OW && own ? OW.loadFactors(own.owner, own.eta, ((P.xs || {}).nb) || 0) : null;
    const G = lf && FX.factorsOwner ? FX.factorsOwner(lf) : FX.factors(), st = A.st, N = A.x.length, z = A.x.map(() => 0), u = o => (o ? o : null);
    const Lq = A.ll && window.SBDAnalysis && window.SBDAnalysis.llPL ? window.SBDAnalysis.llPL(A) : A.ll, Q = Lq && Lq.pl, mO = +G.m > 0 ? +G.m : 1;
    const ll = !Lq ? null : !Q || mO === 1 ? Lq : Object.fromEntries(['Mpos', 'Mneg', 'VLpos', 'VLneg', 'VRpos', 'VRneg'].map(k => [k, Lq[k].map((v, i) => v - Q[k][i] + Q[k][i] / mO)]));
    const comb = (i, k, LLp, LLn) => FX.envelopeStrI({ DC1: st.DC1[k][i], DC2: st.DC2[k][i], DW: st.DW[k][i], LLp, LLn, UT: u(st.UT) ? st.UT[k][i] : 0, UF: u(st.UF) ? st.UF[k][i] : 0 }, G);
    const M = A.x.map((_, i) => comb(i, 'M', ll ? ll.Mpos[i] : 0, ll ? ll.Mneg[i] : 0));
    const VL = A.x.map((_, i) => comb(i, 'VL', ll ? ll.VLpos[i] : 0, ll ? ll.VLneg[i] : 0)), VR = A.x.map((_, i) => comb(i, 'VR', ll ? ll.VRpos[i] : 0, ll ? ll.VRneg[i] : 0));
    const two = a => A.x.flatMap((_, i) => [a.L[i], a.R[i]]), xv = A.x.flatMap(x => [x, x]);
    const V = { x: xv, DC: two({ L: st.DC1.VL.map((v, i) => v + st.DC2.VL[i]), R: st.DC1.VR.map((v, i) => v + st.DC2.VR[i]) }), DW: two({ L: st.DW.VL, R: st.DW.VR }),
      LLp: Lq ? two({ L: Lq.VLpos, R: Lq.VRpos }) : xv.map(() => 0), LLn: Lq ? two({ L: Lq.VLneg, R: Lq.VRneg }) : xv.map(() => 0), Sx: two({ L: VL.map(q => q.max), R: VR.map(q => q.max) }), Sn: two({ L: VL.map(q => q.min), R: VR.map(q => q.min) }) };
    return { x: A.x, N, G, Mp: M.map(q => q.max), Mn: M.map(q => q.min), MDC1: st.DC1.M, MSD: st.DC2.M.map((v, i) => v + st.DW.M[i]), LLp: Lq ? Lq.Mpos : z, LLn: Lq ? Lq.Mneg : z,   // unfactored LL+IM (+ PL) as shown; ll: the m-adjusted values the combinations use
     
      FMp: A.fat ? A.fat.Mpos : z, FMn: A.fat ? A.fat.Mneg : z, MSv: A.x.map((_, i) => st.DC1.M[i] + st.DC2.M[i] + st.DW.M[i] + G.sll * (ll ? ll.Mpos[i] : 0)), MSvN: A.x.map((_, i) => st.DC1.M[i] + st.DC2.M[i] + st.DW.M[i] + G.sll * (ll ? ll.Mneg[i] : 0)), V };
  }

  /* ---------- quantities (SB2-DW10): plates, stiffeners, splices, studs, welds of this project ---------- */
  /* weld size of a plate segment as the Welds tab takes it (engine/welds.js fromDemands): the entered size, else the minimum for the
     thickest of the flanges and the web (Table 6.13.3.4-1) */
  const fwSize = (P, s) => { const w = (P.welds || {}).w; return w === '' || w == null ? window.SBDWelds.wMinFor(Math.max(s.topT, s.botT, s.tw)) : +w; };
  function quantities(G, RS) {
    const P = G.P, T = ((G.stf || {}).transverse || {}).types || {}, Bt = ((G.stf || {}).bearing || {}).types || {}, rows = [], welds = [];
    let lb = 0, nCp = 0, nSt = 0, nBs = 0, nSpl = 0, nBolt = 0, nStud = 0, okBolt = true;
    const fw = new Map(), add = (k, w, lines, L) => { const key = `${k}|${w}`, q = fw.get(key) || { k, w, lines, L: 0 }; q.L += lines * L; fw.set(key, q); };   // L: total weld length (lines x welded length), in
    const zonesOf = g => (P.studs && P.studs.zones && P.studs.zones.length) ? P.studs.zones : ((resOf({ RS }, g) || {}).fat || {}).SR ? resOf({ RS }, g).fat.SR.zones : [];
    G.girders.forEach(g => {
      g.segs.forEach(s => { const L = (s.s1 - s.s0) * 12; lb += L * (s.topB * s.topT + s.botB * s.botT + s.D * s.tw) * GAM; add('FLANGE-TO-WEB FILLET WELDS (2 PER FLANGE)', fwSize(P, s), 4, L); });
      const D = g.Dmax, cp = T.B || { bt: 6, tp: 0.5, w: 0.25, c: 1, sides: '1' }, ts = T.A || cp, sd = t => (String(t.sides) === '2' ? 2 : 1);
      nCp += g.cps.length; add('CONNECTION PLATE-TO-WEB FILLET WELDS', +cp.w || 0.25, 2, g.cps.length * (D - 2 * (+cp.c || 1))); add('CONNECTION PLATE-TO-FLANGE FILLET WELDS', +cp.w || 0.25, 4, g.cps.length * Math.max(0, (+cp.bt || 6) - (+cp.c || 1)));
      nSt += g.stiff.length * sd(ts); add('INTERMEDIATE STIFFENER-TO-WEB FILLET WELDS', +ts.w || 0.25, 2, g.stiff.length * sd(ts) * (D - (+ts.c || 1) - (+ts.gap || 0)));
      g.bear.forEach((b, k) => { const t = (k === 0 || k === g.bear.length - 1 ? Bt.A : Bt.B) || { np: 1, bt: 7, c: 1, w: 0.3125, conn: 'milled' }, n = 2 * Math.max(1, Math.round(+t.np || 1)); nBs += n;
        add('BEARING STIFFENER-TO-WEB FILLET WELDS', +t.w || 0.3125, 2, n * (D - 2 * (+t.c || 1))); if (t.conn === 'weld') add('BEARING STIFFENER-TO-BOTTOM FLANGE FILLET WELDS', +t.w || 0.3125, 2, n * Math.max(0, (+t.bt || 7) - (+t.c || 1))); });
      nSpl += g.spl.length; g.spl.forEach((_, k) => { const R = DW().splR(RS, g, k); if (!R) { okBolt = false; return; } nBolt += ['top', 'bot'].reduce((a, f) => a + 4 * R.fl[f].nr * R.fl[f].nl, 0) + 2 * R.web.bolts.length; });
      zonesOf(g).forEach(z => { const x1 = Math.max(nm(z.x1), 0), x2 = Math.min(nm(z.x2), G.sup[G.sup.length - 1]); if (!(x2 > x1) || !(+z.p > 0)) return; const L = (toOwn(G, g.i, x2) - toOwn(G, g.i, x1)) * 12; nStud += Math.floor(L / +z.p + 1) * Math.max(1, +z.nr || 1); });
    });
    const tr = []; (RS ? RS.pgs : []).forEach(pg => { const w = RS.pg[pg].wt; if (w) w.R.tr.forEach(r => G.girders.filter(g => g.pg === pg).forEach(() => tr.push(r))); });
    rows.push(['GIRDER PLATES, STRUCTURAL STEEL (NO DETAIL ALLOWANCE)', f0(lb), 'LB'], ['CONNECTION PLATES', String(nCp), 'EA'], ['INTERMEDIATE TRANSVERSE STIFFENERS', String(nSt), 'EA'], ['BEARING STIFFENER PLATES', String(nBs), 'EA'],
      ['FIELD SPLICES (ALL GIRDERS)', String(nSpl), 'EA']);
    if (nSpl) rows.push(['H.S. BOLTS AT FIELD SPLICES', okBolt ? String(nBolt) : 'SPLICES NOT DESIGNED', okBolt ? 'EA' : '']);
    rows.push(['SHEAR STUDS', String(nStud), 'EA']); if (RS) rows.push(['SHOP FLANGE BUTT SPLICES (CJP)', String(tr.length), 'EA']);
    [...fw.values()].filter(q => q.L > 1e-9).forEach(q => welds.push({ ...q, Lft: q.L / 12, wt: q.w * q.w / 2 * q.L * GAM }));
    return { rows, welds, lb, nStud, nBolt, nSpl, tr };
  }

  /* ---------- weld symbol (GirderDetail dxfWeld): leader to (x, y), reference line, fillet triangle(s) or CJP groove, size ---------- */
  function weld(D, l, x, y, size, both, type, note, dir) {
    type = type || 'fillet'; dir = dir || 1; const h = D.h, rx = x + dir * 3 * h, ry = y + 3 * h, L = 5 * h, x1 = rx + dir * L;
    D.line(l, x, y, rx, ry); D.line(l, rx, ry, x1, ry); D.line(l, x, y, x + dir * 0.6 * h, y + 0.3 * h); D.line(l, x, y, x + dir * 0.3 * h, y + 0.6 * h);
    const mx = rx + dir * L * 0.55, s = 0.8 * h;
    const sym = up => type === 'cjp' ? D.pline(l, [[mx - s / 2, ry + up * s], [mx, ry], [mx + s / 2, ry + up * s]], false) : D.pline(l, [[mx, ry], [mx, ry + up * s], [mx + s, ry]], true);
    sym(-1); if (both) sym(1); if (size) D.text(l, mx - (dir > 0 ? 1.2 : -1.2) * h, ry - 1.2 * h, h * 0.75, size, 2);
    if (note) D.text(l, dir > 0 ? x1 + 0.4 * h : x1 - 0.4 * h, ry - 0.35 * h, h * 0.7, note, dir > 0 ? 0 : 2);
  }
  const sheetNo = (C, pre) => { const i = C.list.findIndex(t => t.startsWith(pre)); return i >= 0 ? `SHEET ${i + 1}` : ''; };

  /* ---------- cover and sheet index (dxfCover) ---------- */
  function cover(D, C) {
    const h = D.h, l = D.layer('ANNO-TEXT', 7), tb = D.layer('TABL', 7), G = C.G, pj = C.P.project || {}, T = DW().table;
    D.text(l, 0, 0, 3 * h, str(pj.name || 'BRIDGE').toUpperCase()); D.text(l, 0, -4 * h, 1.6 * h, 'STEEL GIRDER SUPERSTRUCTURE');
    D.text(l, 0, -6.5 * h, h, `${G.spans.length} SPAN${G.spans.length > 1 ? 'S' : ''} (${G.spans.map(f2).join(' + ')} FT), ${G.nb} GIRDERS, SKEW ${G.skews.map(f2).join(' / ')} DEG.`);
    { const cl = window.SBDModel && window.SBDModel.clientName ? window.SBDModel.clientName(C.P) : ''; if (cl) D.text(l, 0, -8.3 * h, h, 'CLIENT / OWNER: ' + str(cl).toUpperCase()); }   // blank for AASHTO with no client name: the sheet is unchanged
    const t = T(D, tb, 0, -10 * h, ['SHEET', 'TITLE'], C.list.map((s, i) => [String(i + 1), s]), 'SHEET INDEX');
    if (C.miss.length) T(D, tb, 0, t.y - 2 * h, ['NOT GENERATED', 'REASON'], C.miss, 'DRAWINGS NOT IN THIS SET');
    T(D, tb, t.w + 10 * h, -10 * h, ['REV.', 'DATE', 'DESCRIPTION', 'BY'], [['0', C.date, 'ISSUED FROM STEEL BRIDGE DESIGN', str(pj.designer || '')], ['', '', '', ''], ['', '', '', ''], ['', '', '', '']], 'REVISIONS');
  }

  /* ---------- erection diagram, shipping pieces, girder layout (dxfErect) ---------- */
  const wtAt = (S, a, b) => S.reduce((v, s) => v + Math.max(0, Math.min(b, s.s1) - Math.max(a, s.s0)) * 12 * (s.topB * s.topT + s.botB * s.botT + s.D * s.tw), 0) * GAM / 1000;
  function erect(D, C) {
    const G = C.G, FR = G.FR, h = D.h, ly = { g: D.layer('GRDR-CNTR', 8), b: D.layer('BRNG-CNTR', 8), s: D.layer('SPLC', 1), t: D.layer('ANNO-TEXT', 7), tb: D.layer('TABL', 7) }, cl = D.ltype('CENTER'), X = x => x * 12, Y = y => y * 12, nb = G.nb, T = DW().table;
    G.sup.forEach((_, k) => D.line(ly.b, X(FR.xb(k, 0)), Y(G.ys[0]) - 2 * h, X(FR.xb(k, nb - 1)), Y(G.ys[nb - 1]) + 2 * h, cl));
    const allow = +(window.SBDAnalysis ? window.SBDAnalysis.settings(C.P).steelAllowPct : 0) || 0, Lc = n => String.fromCharCode(65 + n), pcs = [];
    G.girders.forEach((g, i) => { const S = g.segs, beg = S[0].s0, end = S[S.length - 1].s1, cuts = [beg, ...g.spl, end];
      D.line(ly.g, X(g.x0 + beg), Y(g.y), X(g.x0 + end), Y(g.y));
      for (let q = 0; q < cuts.length - 1; q++) { const mk = `${g.label}-${Lc(q)}`, w = wtAt(S, cuts[q], cuts[q + 1]); pcs.push([mk, g.label, dFI(X(cuts[q] - beg)), dFI(X(cuts[q + 1] - beg)), dFI(X(cuts[q + 1] - cuts[q])), f2(w), f2(w * (1 + allow / 100))]);
        D.text(ly.t, X(g.x0 + (cuts[q] + cuts[q + 1]) / 2), Y(g.y) + 0.5 * h, h * 0.9, mk, 1); }
      g.spl.forEach((s, k) => { D.line(ly.s, X(g.x0 + s), Y(g.y) - h, X(g.x0 + s), Y(g.y) + h); if (i === nb - 1) D.text(ly.t, X(g.x0 + s), Y(g.y) + 2 * h, h * 0.9, `FS${k + 1}`, 1); }); });
    const xr = Math.min(...G.sup.map((_, k) => Math.min(X(FR.xb(k, 0)), X(FR.xb(k, nb - 1))))), BW = DW().bwName(G);
    D.text(ly.t, xr, Y(G.ys[nb - 1]) + 7 * h, 1.6 * h, 'ERECTION DIAGRAM');
    D.text(ly.t, xr, Y(G.ys[nb - 1]) + 5.3 * h, 0.8 * h, `PIECE MARKS SHOWN. SUGGESTED SEQUENCE: SET THE PIECES OF ADJACENT GIRDERS IN PAIRS, INSTALL ${BW}S BETWEEN THEM, AND COMPLETE FIELD SPLICES BEFORE RELEASING THE CRANE; ERECTION PLAN BY THE CONTRACTOR.`);
    const y = Y(0) - 6 * h, heavy = Math.max(...pcs.map(p => +p[5]));
    const T1 = T(D, ly.tb, xr, y, ['MARK', 'GIRDER', 'FROM', 'TO', 'LENGTH', 'PLATES (KIP)', `WITH ${f0(allow)}% DETAIL ALLOWANCE (KIP)`], pcs.map(p => +p[5] === heavy ? [...p.slice(0, 6), p[6] + ' (HEAVIEST)'] : p), 'SHIPPING PIECES (STATIONS FROM GIRDER END; STEEL AT 490 PCF; ALLOWANCE OF THE ANALYSIS TAB)');
    const tot = G.girders.map(g => [g.label, f2(pcs.filter(p => p[1] === g.label).reduce((a, p) => a + +p[5], 0))]);
    const T2 = T(D, ly.tb, xr + T1.w + 8 * h, y, ['GIRDER', 'PLATE WEIGHT (KIP)'], [...tot, ['TOTAL', f2(tot.reduce((a, r) => a + +r[1], 0))]], 'STEEL BY GIRDER');
    const x00 = FR.xb(0, 0), wp = [];
    G.girders.forEach(g => { const S = g.segs, pts = [['BEG. GIRDER', g.x0 + S[0].s0], ...g.bear.map((b, k) => [`CL BRG. ${supName(k, g.bear.length)}`, g.x0 + b]), ...g.spl.map((s, k) => [`FS${k + 1}`, g.x0 + s]), ['END GIRDER', g.x0 + S[S.length - 1].s1]].sort((a, b) => a[1] - b[1]);
      pts.forEach(([n, x]) => wp.push([g.label, n, f2(x - x00), f2(g.y)])); });
    T(D, ly.tb, xr, Math.min(T1.y, T2.y) - 2 * h, ['GIRDER', 'POINT', 'X (FT)', 'Y (FT)'], wp, `GIRDER LAYOUT: WORK POINTS ON GIRDER CL (ORIGIN AT CL BRG. ABUT. 1, G1; X ALONG GIRDERS, Y TOWARD G${nb})`);
    return pcs;
  }

  /* ---------- girder elevation with the moment envelope, plate schedule and camber (DW.elevation + dxfElev) ---------- */
  function elev(D, C) {
    const G = C.G, gi = C.gi, one = C.one, g = G.girders[gi], h = D.h, X = x => x * 12, T = DW().table, i0 = D.mark();
    DW().elevation(G, D, gi, { k: D.k, RS: C.RS });
    const ly = { t: D.layer('ANNO-TEXT', 7), tb: D.layer('TABL', 7), cb: D.layer('CAMB', 1), m: D.layer('DIAG-STR', 1), a: D.layer('DIAG-AXIS', 7) };
    let y = D.bbox(i0)[1] - 4 * h;
    const r = resOf(C, g), A = r && r.an;
    if (!A) { D.text(ly.t, 0, y, h, 'MOMENT ENVELOPE AND CAMBER: RESULTS NOT CALCULATED (DRAWINGS TAB, CALCULATE RESULTS).'); return; }
    // Strength I moment envelope of this girder (its plate girder's analysis at the girder's own stations)
    if (A.ll) { const E = env(A, C.P), xs = A.x.map(x => toOwn(G, gi, x)), mx = Math.max(1e-6, ...E.Mp.map(Math.abs), ...E.Mn.map(Math.abs)), vs = 1.1 * D.k / mx, y0 = y - 1.4 * D.k - 2 * h;
      D.line(ly.a, X(xs[0]), y0, X(xs[xs.length - 1]), y0); D.pline(ly.m, xs.map((x, i) => [X(x), y0 + E.Mp[i] * vs]), false); D.pline(ly.m, xs.map((x, i) => [X(x), y0 + E.Mn[i] * vs]), false, D.ltype('HIDDEN'));
      tenths(A.sup).forEach(t => { const v = at(A.x, E.Mp, t.x); if (Math.abs(v) > 1) D.text(ly.t, X(toOwn(G, gi, t.x)), y0 + v * vs + 0.3 * h, h * 0.6, f0(v), 1); });
      A.sup.slice(1, -1).forEach(sx => { const v = at(A.x, E.Mn, sx); if (Math.abs(v) > 1) D.text(ly.t, X(toOwn(G, gi, sx)), y0 + v * vs - 1.1 * h, h * 0.6, f0(v), 1); });
      D.text(ly.t, 0, y0 + 1.25 * D.k + 0.5 * h, h, `STRENGTH I MOMENT ENVELOPE, ${g.label} (KIP-FT; MAX. SOLID, MIN. DASHED; VERTICAL 1 IN. = ${f0(mx / 1.1)} KIP-FT). FULL DIAGRAMS: ${sheetNo(C, 'ANALYSIS DIAGRAMS')}`);
      y = y0 - 1.25 * D.k - 3 * h; }
    // camber tables: total dead-load deflection of every girder at the tenth points (each girder's plate girder), components of this girder
    const tn = tenths(A.sup), cam = gg => { const q = resOf(C, gg); return q && q.an ? q.an.camber : null; };
    let T2 = { w: -6 * h, y };
    if (!one) T2 = T(D, ly.tb, 0, y, ['POINT', 'FROM BRG. (CL SPANS)', ...G.girders.map(q => q.label)], tn.map(t => [ptName(t), dFI(X(t.x - A.sup[0])), ...G.girders.map(q => { const c = cam(q); return c ? f2(at(c.x, c.total, t.x)) : '-'; })]),
      'TOTAL DEAD LOAD DEFLECTION (IN, DOWNWARD) = CAMBER, EXCLUDING VERTICAL PROFILE; EACH GIRDER AT THE SAME FRACTION OF ITS SPAN');
    const c = A.camber, cols = ['POINT', 'STEEL', 'DECK, HAUNCH, FORMS', 'DC2 + DW', ...(c.ut ? ['UTILITIES'] : []), 'TOTAL'];
    const T3 = T(D, ly.tb, one ? 0 : T2.w + 6 * h, y, cols, tn.map(t => [ptName(t), f2(at(c.x, c.steel, t.x)), f2(at(c.x, c.wet, t.x)), f2(at(c.x, c.sd, t.x)), ...(c.ut ? [f2(at(c.x, c.ut, t.x))] : []), f2(at(c.x, c.total, t.x))]),
      `DEAD LOAD DEFLECTION COMPONENTS, ${g.label} (IN; ANALYSIS TAB)`);
    // camber diagram (largest ordinate plotted at 1.5 in)
    const list = one ? [g] : G.girders, mxC = Math.max(1e-6, ...list.map(q => { const cq = cam(q); return cq ? Math.max(...cq.total.map(Math.abs)) : 0; })), vs = 1.5 * D.k / mxC, yD = Math.min(T2.y, T3.y) - 6 * h - 1.5 * D.k;
    D.text(ly.t, 0, yD + 1.5 * D.k + 3.2 * h, h, `CAMBER DIAGRAM, ${one ? g.label : 'ALL GIRDERS'} (ORDINATES x${f0(vs)}; VALUES FOR ${g.label})`);
    const xo = x => one ? X(toOwn(G, gi, x)) : X(x - A.sup[0]);
    D.line(ly.cb, xo(c.x[0]), yD, xo(c.x[c.x.length - 1]), yD);
    list.forEach(q => { const cq = cam(q); if (cq) D.pline(ly.cb, cq.x.map((x, i) => [xo(x), yD + cq.total[i] * vs]), false); });
    tn.forEach(t => { const x = xo(t.x), v = at(c.x, c.total, t.x); D.line(ly.cb, x, yD, x, yD + v * vs); if (Math.abs(v) > 0.005) D.text(ly.t, x, yD + v * vs + 0.5 * h, h * 0.6, f2(v), 1); });
  }

  /* ---------- typical section, general notes, weld symbols, quantities (DW.section + dxfSection) ---------- */
  function section(D, C) {
    const G = C.G, h = D.h, i0 = D.mark(); DW().section(G, D, { k: D.k });
    const lt = D.layer('ANNO-TEXT', 7), sec = G.girders.map(g => g.segs[0]), tTop = Math.max(...sec.map(s => s.topT)), j = Math.min(1, G.nb - 1), s = sec[j], x = G.ys[j] * 12;
    const yt = -(tTop - s.topT), w = fwSize(C.P, s);
    weld(D, lt, x + s.tw / 2, yt - s.topT, dIn(w), true, 'fillet', 'FLANGE-TO-WEB, TOP'); weld(D, lt, x + s.tw / 2, yt - s.topT - s.D, dIn(w), true, 'fillet', 'FLANGE-TO-WEB, BOT.');
    const b = D.bbox(i0), Q = quantities(G, C.RS), T = DW().table, tb = D.layer('TABL', 7);
    const T1 = T(D, tb, b[2] + 8 * h, b[3], ['ITEM', 'QUANTITY', 'UNIT'], Q.rows, 'ESTIMATED QUANTITIES (WHOLE BRIDGE)');
    T(D, tb, b[2] + 8 * h, T1.y - 2 * h, ['WELD', 'SIZE', 'LINES', 'LENGTH (FT)', 'WELD METAL (LB)'], Q.welds.map(q => [q.k, dIn(q.w), String(q.lines), f0(q.Lft), f0(q.wt)]).concat([['TOTAL', '', '', f0(Q.welds.reduce((a, q) => a + q.Lft, 0)), f0(Q.welds.reduce((a, q) => a + q.wt, 0))]]),
      'WELD QUANTITIES (WHOLE BRIDGE): FILLET WELD METAL = w^2/2 x LENGTH x 490 PCF; LENGTH = LINES x WELDED LENGTH');
    return Q;
  }

  /* ---------- field splice (dxfSplice) ---------- */
  function splice(D, C) {
    const R = C.R, h = D.h, ly = { g: D.layer('GRDR', 5), p: D.layer('GRDR-PLAT', 4), bo: D.layer('BOLT', 2), hd: D.layer('HIDN', 8), t: D.layer('ANNO-TEXT', 7), c: D.layer('CNTR', 8), d: D.layer('DIMS', 7) }, hid = D.ltype('HIDDEN'), cl = D.ltype('CENTER');
    const F = R.fl, W = R.web, gap = R.gap, Dm = R.D, SL = R.secL, SR = R.secR, rb = (R.bolt.dh || 1) / 2, note = (x, y, s) => D.text(ly.t, x, y, h * 0.8, s);
    const half = Math.max(F.top.Lpl, F.bot.Lpl, gap + 2 * (W.ew + (W.ncw - 1) * W.sh + W.ewp)) / 2 + 8, tT = Math.max(SL.topT, SR.topT), tB = Math.max(SL.botT, SR.botT);
    let yP = 0;
    ['top', 'bot'].forEach(key => { const f = F[key], bw = Math.max(f.bL, f.bR), cy = yP - bw / 2 - 5 * h;
      D.rect(ly.g, -half, cy - f.bL / 2, -gap / 2, cy + f.bL / 2); D.rect(ly.g, gap / 2, cy - f.bR / 2, half, cy + f.bR / 2); D.rect(ly.p, -f.Lpl / 2, cy - f.bo / 2, f.Lpl / 2, cy + f.bo / 2);
      if (f.inner) [1, -1].forEach(sg => D.rect(ly.hd, -f.Lpl / 2, cy + sg * Math.min(f.yiO, f.yiI), f.Lpl / 2, cy + sg * Math.max(f.yiO, f.yiI), hid));
      const bx = []; for (const sd of [-1, 1]) for (let r = 0; r < f.nr; r++) bx.push(sd * (gap / 2 + f.ef + r * f.s)); const by = []; for (let q = 0; q < f.nl; q++) by.push(f.g0 + q * f.g, -(f.g0 + q * f.g));
      bx.forEach(x => by.forEach(y => D.circle(ly.bo, x, cy + y, rb)));
      D.line(ly.c, -half - 2 * h, cy, half + 2 * h, cy, cl); D.line(ly.c, 0, cy - bw / 2 - 2 * h, 0, cy + bw / 2 + 2 * h, cl);
      D.chainH(ly.d, bx, cy + bw / 2 + 2 * h, cy + f.bo / 2); D.text(ly.t, 0, cy - bw / 2 - 1.6 * h, h * 0.7, `${dFI(gap)} GAP`, 1); D.dimH(ly.d, -f.Lpl / 2, f.Lpl / 2, cy + bw / 2 + 5 * h, cy + f.bo / 2, 'SPLICE PL. <>');
      D.chainV(ly.d, by.map(v => cy + v), half + 3 * h, f.Lpl / 2); D.dimV(ly.d, cy - f.bo / 2, cy + f.bo / 2, half + 6 * h, f.Lpl / 2, 'PL. <>');
      D.text(ly.t, -half, cy + bw / 2 + 6.8 * h, h, `${key === 'top' ? 'TOP' : 'BOTTOM'} FLANGE SPLICE - PLAN`);
      note(half + 9 * h, cy + 0.6 * h, `${bx.length * by.length} - ${dIn(2 * rb - 0.0625)} DIA. H.S. BOLTS`); note(half + 9 * h, cy - 3.9 * h, `END DIST. ${dFI(f.Lpl / 2 - (gap / 2 + f.ef + (f.nr - 1) * f.s))}, EDGE DIST. ${dFI(f.bo / 2 - (f.g0 + (f.nl - 1) * f.g))} (TYP.)`);
      note(half + 9 * h, cy - 0.9 * h, `OUTER PL. ${dIn(f.bo)} x ${dIn(f.to)} x ${dFI(f.Lpl)}`); if (f.inner) note(half + 9 * h, cy - 2.4 * h, `INNER PLS. 2 - ${dIn(Math.abs(f.yiO - f.yiI))} x ${dIn(f.ti)} x ${dFI(f.Lpl)}`);
      yP = cy - bw / 2 - 5 * h; });
    const yE = yP - (Dm + tT + F.top.to + 8 * h);
    ['L', 'R'].forEach(sd => { const s = sd === 'L' ? SL : SR, x0 = sd === 'L' ? -half : gap / 2, x1 = sd === 'L' ? -gap / 2 : half;
      D.rect(ly.g, x0, yE + Dm, x1, yE + Dm + s.topT); D.line(ly.g, x0, yE, x1, yE); D.line(ly.g, x0, yE + Dm, x1, yE + Dm); D.line(ly.g, sd === 'L' ? x1 : x0, yE, sd === 'L' ? x1 : x0, yE + Dm); D.rect(ly.g, x0, yE - s.botT, x1, yE); });
    D.rect(ly.p, -F.top.Lpl / 2, yE + Dm + tT, F.top.Lpl / 2, yE + Dm + tT + F.top.to); if (F.top.inner) D.rect(ly.p, -F.top.Lpl / 2, yE + Dm - F.top.ti, F.top.Lpl / 2, yE + Dm);
    D.rect(ly.p, -F.bot.Lpl / 2, yE - tB - F.bot.to, F.bot.Lpl / 2, yE - tB); if (F.bot.inner) D.rect(ly.p, -F.bot.Lpl / 2, yE, F.bot.Lpl / 2, yE + F.bot.ti);
    [['top', SL.topT, SR.topT], ['bot', SL.botT, SR.botT]].forEach(([key, tl, tr]) => { const f = F[key], tf = Math.abs(tl - tr); if (!(tf > 1e-6) || !f.fillSide) return;
      const tThin = Math.min(tl, tr), tMax = Math.max(tl, tr), xa = f.fillSide === 'L' ? -f.Lpl / 2 : gap / 2, xb = f.fillSide === 'L' ? -gap / 2 : f.Lpl / 2, ya = key === 'top' ? yE + Dm + tThin : yE - tMax, yb = key === 'top' ? yE + Dm + tMax : yE - tThin;
      D.rect(ly.p, xa, ya, xb, yb); D.text(ly.t, -half - 2 * h, (ya + yb) / 2 - h * 0.4, h * 0.8, `${key === 'top' ? 'TOP' : 'BOT.'} FILL PL. ${dIn(Math.min(f.bo, f.fillSide === 'L' ? f.bL : f.bR))} x ${dIn(tf)} x ${dFI(Math.abs(xb - xa))}`, 2); });
    const wpL = gap + 2 * (W.ew + (W.ncw - 1) * W.sh + W.ewp), yWc = yE + Dm / 2; D.rect(ly.p, -wpL / 2, yWc - W.hw / 2, wpL / 2, yWc + W.hw / 2);
    const wx = [...new Set(W.bolts.flatMap(b => [-1, 1].map(sd => +(sd * (gap / 2 + W.xbar) + b.dx).toFixed(4))))], wy = [...new Set(W.bolts.map(b => +(yWc + b.dy).toFixed(4)))];
    W.bolts.forEach(b => [-1, 1].forEach(sd => D.circle(ly.bo, sd * (gap / 2 + W.xbar) + b.dx, yWc + b.dy, rb)));
    D.line(ly.c, 0, yE - tB - F.bot.to - 3 * h, 0, yE + Dm + tT + F.top.to + 3 * h, cl);
    D.chainV(ly.d, wy, wpL / 2 + 3 * h, wpL / 2); D.dimV(ly.d, yWc - W.hw / 2, yWc + W.hw / 2, wpL / 2 + 6 * h, wpL / 2, 'WEB PL. <>');
    D.chainH(ly.d, wx, yE - tB - F.bot.to - 3 * h, yWc - W.hw / 2); D.dimH(ly.d, -wpL / 2, wpL / 2, yE - tB - F.bot.to - 6 * h, yWc - W.hw / 2, 'WEB PL. <>');
    D.dimV(ly.d, yE, yE + Dm, -half - 3 * h, -half, 'D = <>');
    D.text(ly.t, -half, yE + Dm + tT + F.top.to + 5 * h, h, 'ELEVATION');
    note(half + 3 * h, yWc + 0.8 * h, `WEB PLS. 2 - ${dIn(W.hw)} x ${dIn(W.twp)} x ${dFI(wpL)}`); note(half + 3 * h, yWc - 0.8 * h, `${2 * W.bolts.length} - ${dIn(2 * rb - 0.0625)} DIA. H.S. BOLTS`);
    D.text(ly.t, -half, 6 * h, h * 1.6, `FIELD SPLICE ${C.name}`);
    D.text(ly.t, -half, 4.2 * h, h * 0.8, `DESIGNED ON THE FIELD SPLICES TAB (${ED} 6.13.6.1); ${C.lines}. FLANGE PLATES AND BOLTS AS SHOWN; FILL PLATES PER 6.13.6.1.5.`);
  }

  /* ---------- analysis diagrams (dxfPlot, dxfLab, dxfDiag) ---------- */
  function plot(D, l, y0, xs, series, title, unit, marks) {
    const h = D.h, X = x => x * 12, mx = Math.max(1e-6, ...series.flatMap(s => s.ys.map(Math.abs))), vs = 1.1 * D.k / mx, x0 = X(xs[0]), x1 = X(xs[xs.length - 1]), ax = D.layer('DIAG-AXIS', 7);
    D.line(ax, x0, y0, x1, y0); (marks || []).forEach(x => D.line(ax, X(x), y0 - 1.2 * D.k, X(x), y0 + 1.2 * D.k, D.ltype('CENTER')));
    series.forEach(s => D.pline(s.l || l, xs.map((x, i) => [X(x), y0 + s.ys[i] * vs]), false, s.lt ? D.ltype(s.lt) : undefined));
    D.text(D.layer('ANNO-TEXT', 7), x0, y0 + 1.25 * D.k + 0.5 * h, h, `${title} (${unit}; VERTICAL 1 IN. = ${f0(mx / 1.1)} ${unit} AT PLOT SCALE)`);
    return { vs, mx };
  }
  const lab = (D, l, xs, ys, y0, vs, idx, fmt) => { const h = D.h; idx.forEach(i => { const v = ys[i]; if (!(Math.abs(v) > 1e-6)) return; D.text(l, xs[i] * 12, y0 + v * vs + (v >= 0 ? 0.3 : -1.1) * h, h * 0.6, fmt(v), 1); }); };
  function diag(D, C) {
    const A = C.A, E = env(A, C.P), h = D.h, k = D.k, gap = 3.4 * k, xs = A.x, sup = A.sup, near = x => xs.reduce((b, q, i) => Math.abs(q - x) < Math.abs(xs[b] - x) ? i : b, 0), t10 = tenths(sup).map(t => near(t.x));
    const L = { dc: D.layer('DIAG-DC', 7), dw: D.layer('DIAG-DW', 3), ll: D.layer('DIAG-LL', 4), st: D.layer('DIAG-STR', 1), t: D.layer('ANNO-TEXT', 7) };
    const key = (yy, s) => D.text(L.t, xs[xs.length - 1] * 12, yy + 1.25 * k + 0.5 * h, h * 0.7, s, 2); let y = 0;
    const pm = plot(D, L.dc, y, xs, [{ ys: E.MDC1, l: L.dc }, { ys: E.MSD, l: L.dw }, { ys: E.LLp, l: L.ll }, { ys: E.LLn, l: L.ll, lt: 'HIDDEN' }, { ys: E.Mp, l: L.st }, { ys: E.Mn, l: L.st, lt: 'HIDDEN' }],
      `${C.name} MOMENT ENVELOPES: DC1, DC2 + DW, LL+IM${A.pl ? ' + PL' : ''} (+/-), STRENGTH I (MAX/MIN)${E.G.own && (E.G.own.eta !== 1 || E.G.own.m !== 1) ? ` WITH ETA = ${E.G.own.eta.toFixed(3)}, M = ${E.G.own.m.toFixed(2)} (NOT ON PL)` : ''}`, 'KIP-FT', sup);
    key(y, 'WHITE DC1 / GREEN DC2+DW / CYAN LL+IM / RED STRENGTH I (DASHED = MIN.)'); lab(D, L.t, xs, E.Mp, y, pm.vs, t10, f0); lab(D, L.t, xs, E.Mn, y, pm.vs, sup.map(near), f0);
    y -= gap; const V = E.V, vi = [];
    sup.forEach(s => { const i = near(s); if (i > 0) vi.push(2 * i); if (i < xs.length - 1) vi.push(2 * i + 1); });
    const ps = plot(D, L.dc, y, V.x, [{ ys: V.DC, l: L.dc }, { ys: V.DW, l: L.dw }, { ys: V.LLp, l: L.ll }, { ys: V.LLn, l: L.ll, lt: 'HIDDEN' }, { ys: V.Sx, l: L.st }, { ys: V.Sn, l: L.st, lt: 'HIDDEN' }],
      `${C.name} SHEAR ENVELOPES: DC1 + DC2, DW, LL+IM (+/-), STRENGTH I (MAX/MIN)`, 'KIP', sup);
    key(y, 'WHITE DC / GREEN DW / CYAN LL+IM / RED STRENGTH I (DASHED = MIN.)'); lab(D, L.t, V.x, V.Sx, y, ps.vs, vi, f0); lab(D, L.t, V.x, V.Sn, y, ps.vs, vi, f0);
    y -= gap; const c = A.camber, neg = a => a.map(v => -v);
    const pd = plot(D, L.dc, y, c.x, [{ ys: neg(c.steel), l: L.dc }, { ys: neg(c.steel.map((v, i) => v + c.wet[i])), l: L.dw }, { ys: neg(c.total), l: L.st }], `${C.name} DEAD LOAD DEFLECTION (DOWNWARD): STEEL, + DECK, TOTAL`, 'IN', sup);
    key(y, 'WHITE STEEL / GREEN + DECK / RED TOTAL'); lab(D, L.t, c.x, neg(c.total), y, pd.vs, t10, v => f2(-v));
    D.text(L.t, 0, y - 1.6 * k, h * 0.8, `LIVE LOAD DEFLECTION: SEE CHECK SA3 ON THE ANALYSIS TAB. STRENGTH I = ${E.G.dc}(DC) + ${E.G.dw}(DW) + ${E.G.ll}(LL+IM) (MIN. ${E.G.dcMin}, ${E.G.dwMin}; ${ED} TABLE 3.4.1-1, AS THE FLEXURE TAB). SOLID = MAXIMUM, DASHED = MINIMUM; CENTER LINES = SUPPORTS.`);
    D.text(L.t, 0, y - 1.6 * k - 1.4 * h, h * 0.8, 'FLANGE STRESSES ALONG THE GIRDER ARE NOT PLOTTED: THEY ARE WORKED AT THE CHECK LOCATIONS ON THE FLEXURE AND RATING TABS.');
  }

  /* ---------- design summary (dxfSummary): the Report tab's summary of governing ratios ---------- */
  function summary(D, C) {
    const h = D.h, tb = D.layer('TABL', 7), l = D.layer('ANNO-TEXT', 7), G = C.G, rows = [];
    D.text(l, 0, 3 * h, 1.6 * h, 'DESIGN SUMMARY');
    C.RS.pgs.forEach(pg => { const r = C.RS.pg[pg]; (r.gov || []).forEach(q => rows.push([linesOf(G, pg).join(', '), str(q.mod).toUpperCase(), str(plain(q.check)).toUpperCase().slice(0, 70), str(q.loc || '').toUpperCase().slice(0, 40),
      q.rf != null ? `RF ${isFinite(q.rf) ? f2(q.rf) : '-'}` : isFinite(q.r) ? f2(q.r) : '-', q.rf != null ? (isFinite(q.rf) && q.rf >= 1 - 1e-9 ? 'OK' : 'RF < 1') : q.status === 'warn' ? 'WARNING' : isFinite(q.r) && q.r <= 1 + 1e-9 ? 'OK' : 'NG'])); });
    DW().table(D, tb, 0, 0, ['GIRDERS', 'MODULE', 'CHECK', 'GOVERNING LOCATION', 'RATIO / RF', 'STATUS'], rows, `GOVERNING DEMAND / CAPACITY OF EACH CHECK GROUP (REPORT TAB SUMMARY; RATIO OK <= 1.0, RF OK >= 1.0; ${ED})`);
  }

  /* ---------- bearing reactions (dxfReac) ---------- */
  function reac(D, C) {
    const h = D.h, tb = D.layer('TABL', 7), l = D.layer('ANNO-TEXT', 7), G = C.G, rows = [];
    G.girders.forEach(g => { const r = resOf(C, g), A = r && r.an; if (!A) return; const st = A.st, n = A.sup.length;
      A.sup.forEach((_, k) => { const lp = A.llR ? A.llR[k].max : 0, ln = A.llR ? A.llR[k].min : 0, p = st.DC1.R[k] + st.DC2.R[k] + st.DW.R[k], mx = p + lp, mn = p + ln;
        rows.push([g.label, supName(k, n), f2(st.DC1.R[k]), f2(st.DC2.R[k]), f2(st.DW.R[k]), f2(lp), f2(ln), f2(mx), f2(mn) + (mn < 0 ? ' UPLIFT' : '')]); }); });
    D.text(l, 0, 3 * h, 1.6 * h, 'BEARING REACTIONS');
    DW().table(D, tb, 0, 0, ['GIRDER', 'SUPPORT', 'DC1', 'DC2', 'DW', 'LL+IM MAX', 'LL+IM MIN', 'SERVICE MAX', 'SERVICE MIN'], rows,
      'UNFACTORED REACTIONS PER GIRDER (KIP; ANALYSIS TAB). LL+IM INCLUDES THE DISTRIBUTION FACTOR AND DYNAMIC LOAD ALLOWANCE; SERVICE = DC1 + DC2 + DW + LL+IM.');
  }

  /* ---------- fatigue and fracture (dxfFat) ---------- */
  function fat(D, C) {
    const h = D.h, tb = D.layer('TABL', 7), l = D.layer('ANNO-TEXT', 7), G = C.G, grp = {}, DET = (window.SBDFatigue && window.SBDFatigue.DET) || [];
    C.RS.pgs.forEach(pg => { const F = C.RS.pg[pg].fat, rows = (F && F.FR && F.FR.rows) || []; rows.forEach(r => { const k = `${r.det}|${r.cat}`; (grp[k] = grp[k] || { det: r.det, cat: r.cat, n: 0, ex: r.name }).n++; }); });
    D.text(l, 0, 3 * h, 1.6 * h, 'FATIGUE AND FRACTURE');
    const T = DW().table(D, tb, 0, 0, ['DETAIL', 'CATEGORY', 'NO. OF LOCATIONS', 'EXAMPLE LOCATION'], Object.values(grp).map(q => { const d = DET.find(e => e[0] === q.det); return [str(d ? d[2] : q.det).toUpperCase().slice(0, 70), str(q.cat), String(q.n), str(q.ex || '').toUpperCase().slice(0, 70)]; }),
      'FATIGUE DETAIL CATEGORIES (AASHTO LRFD TABLE 6.6.1.2.3-1), FROM THE FATIGUE & STUDS TAB');
    const nstm = G.nb <= 2 ? 'NSTM' : 'NOT NSTM (LOAD-PATH REDUNDANT)', BW = DW().bwName(G);
    DW().table(D, tb, 0, T.y - 2 * h, ['MEMBER / COMPONENT', 'TENSION ZONES', 'FRACTURE CLASSIFICATION', 'CHARPY V-NOTCH'], [['GIRDER FLANGES AND WEB', 'POSITIVE MOMENT: BOTTOM FL.; NEGATIVE: TOP FL.', nstm, 'TABLE 6.6.2.1-2, PROJECT TEMP. ZONE'],
      ['SPLICE PLATES, FILLERS', 'AS FOR THE GIRDER', nstm, 'AS FOR THE GIRDER'], [`${BW}S, STIFFENERS, CONNECTION PLATES`, '-', 'NOT NSTM', 'TABLE 6.6.2.1-2, NON-NSTM']], 'FRACTURE CRITICALITY AND TOUGHNESS');
  }

  /* ---------- deck overhang (dxfOH) ---------- */
  function overhang(D, C) {
    const G = C.G, h = D.h, o = { ...((window.SBDConstr || {}).OH_DEF || {}), ...((C.P.constr && C.P.constr.oh) || {}) }, s = G.girders[0].segs[0], dk = G.deck;
    const ly = { g: D.layer('GRDR', 5), dk: D.layer('DECK', 7), br: D.layer('TEMP-BRKT', 6), d: D.layer('DIMS', 7), t: D.layer('ANNO-TEXT', 7), c: D.layer('CNTR', 8) }, cl = D.ltype('CENTER');
    const tf = { b: s.topB, t: s.topT }, bf = { b: s.botB, t: s.botT }, tw = s.tw, Dm = s.D, ts = dk.ts, hh = dk.haunch, oh = dk.ohL * 12, a = +o.a || 36, hb0 = +o.hb || 54, hb = Math.min(hb0, Dm + tf.t), tOH = +o.tOH || ts;
    D.rect(ly.g, -tf.b / 2, -tf.t, tf.b / 2, 0); D.rect(ly.g, -tw / 2, -tf.t - Dm, tw / 2, -tf.t); D.rect(ly.g, -bf.b / 2, -tf.t - Dm - bf.t, bf.b / 2, -tf.t - Dm);
    D.pline(ly.dk, [[-oh, hh], [48, hh], [48, hh + ts], [-oh, hh + tOH]], false); D.line(ly.dk, -oh, hh, -oh, hh + tOH); D.line(ly.dk, -tf.b / 2, 0, -tf.b / 2, hh);
    D.line(ly.br, -tw / 2, -tf.t - hb, -tw / 2 - a, hh - 0.01); D.line(ly.br, -tw / 2 - a, hh, -tw / 2, hh); D.line(ly.c, 0, hh + ts + 2 * h, 0, -tf.t - Dm - bf.t - 2 * h, cl);
    D.dimH(ly.d, -oh, 0, hh + ts + 3 * h, hh + tOH, 'OVERHANG <>'); D.dimH(ly.d, -tw / 2 - a, -tw / 2, -tf.t - hb - 3 * h, -tf.t - hb, 'a = <>'); D.dimV(ly.d, -tf.t - hb, hh, -tw / 2 - a - 3 * h, -tw / 2 - a, 'hb = <>');
    D.text(ly.t, -oh, hh + ts + 7 * h, 1.3 * h, 'DECK OVERHANG AND TEMPORARY BRACKET (EXTERIOR GIRDER G1)');
    if (hb0 > Dm + tf.t + 1e-6) D.text(D.layer('ANNO-FLAG', 1), -oh, hh + ts + 9 * h, h, `CHECK: THE BRACKET VERTICAL PROJECTION ON THE CONSTRUCTIBILITY TAB (hb = ${dFI(hb0)}) EXCEEDS THE GIRDER DEPTH (${dFI(Dm + tf.t)}); BRACKET SHOWN AT THE BOTTOM OF THE WEB. UPDATE hb AND RECHECK.`);
    D.text(ly.t, -oh, hh + ts + 5.4 * h, 0.8 * h, `DESIGN LOADS (CONSTRUCTIBILITY TAB): FORMS ${f2(+o.qForm || 0)} KSF, SCREED ${f2(+o.wScreed || 0)} KLF, RAIL ${f2(+o.wRail || 0)} KLF, WALKWAY ${f2(+o.wWalk || 0)} KLF, CONSTR. LL ${f2(+o.qCL || 0)} KSF, FINISHING MACHINE ${f2(+o.Pfm || 0)} KIP. BRACKETS BY THE CONTRACTOR.`);
  }

  /* ---------- bearing stiffeners (dxfBS) ---------- */
  function bs(D, C) {
    const G = C.G, h = D.h, ly = { g: D.layer('GRDR', 5), st: D.layer('GRDR-STIF', 30), d: D.layer('DIMS', 7), t: D.layer('ANNO-TEXT', 7), c: D.layer('CNTR', 8) }, cl = D.ltype('CENTER'), g0 = G.girders[0], types = ((G.stf || {}).bearing || {}).types || {};
    let x0 = 0; const used = G.sup.length > 2 ? ['A', 'B'] : ['A'];
    used.forEach(ty => { const t = types[ty]; if (!t) return; const kb = ty === 'A' ? 0 : 1, s = DW().segAt(g0.segs, g0.bear[kb]), Dm = s.D, tw = s.tw, bft = s.topB, bfb = s.botB, tfb = s.botT, tft = s.topT, c = +t.c || 0, bt = +t.bt, tp = +t.tp, np = Math.max(1, Math.round(+t.np || 1));
      const yb = 0, yw0 = tfb, yw1 = tfb + Dm; D.rect(ly.g, x0 - bfb / 2, yb, x0 + bfb / 2, yw0); D.rect(ly.g, x0 - tw / 2, yw0, x0 + tw / 2, yw1); D.rect(ly.g, x0 - bft / 2, yw1, x0 + bft / 2, yw1 + tft);
      [-1, 1].forEach(sg => { const xi = x0 + sg * tw / 2, xo = x0 + sg * (tw / 2 + bt); D.pline(ly.st, [[xi, yw0 + c], [xi + sg * c, yw0], [xo, yw0], [xo, yw1], [xi + sg * c, yw1], [xi, yw1 - c]], true); });
      D.line(ly.c, x0, yb - 2 * h, x0, yw1 + tft + 2 * h, cl);
      D.dimH(ly.d, x0 + tw / 2, x0 + tw / 2 + bt, yw1 + tft + 3 * h, yw1, 'b = <>'); D.dimH(ly.d, x0 - bfb / 2, x0 + bfb / 2, yb - 3 * h, yb);
      D.dimV(ly.d, yw0, yw1, x0 + bfb / 2 + 3 * h, x0 + tw / 2 + bt, 'D = <>'); if (c > 0) D.dimV(ly.d, yw0, yw0 + c, x0 - tw / 2 - bt - 3 * h, x0 - tw / 2, 'CLIP <>');
      D.text(ly.t, x0 - bfb / 2, yw1 + tft + 8 * h, h * 1.3, `BEARING STIFFENER TYPE ${ty}`);
      D.text(ly.t, x0 - bfb / 2, yw1 + tft + 6.2 * h, h * 0.8, `${np} PAIR${np > 1 ? 'S' : ''} PL. ${dIn(bt)} x ${dIn(tp)}${np > 1 ? ` @ ${dIn(+t.sp)}` : ''}, ${t.conn === 'weld' ? 'FILLET WELDED' : 'MILL TO BEAR'} TO BOT. FL., ${dIn(+t.w || 0.3125)} FILLET WELDS TO WEB`);
      weld(D, ly.t, x0 + tw / 2, yw0 + Dm * 0.6, dIn(+t.w || 0.3125), true, 'fillet', 'TYP.');
      D.text(ly.t, x0 - bfb / 2, yb - 6 * h, h * 0.8, str(`${t.name || ''} (${ty === 'A' ? 'ABUTMENTS' : 'PIERS'}; STIFFENERS TAB)`).toUpperCase()); x0 += Math.max(bfb, bft) + 2 * bt + 40 * h; });
  }

  /* ---------- cross-frame or diaphragm (dxfCF) ---------- */
  function cf(D, C) {
    const G = C.G, CF = window.SBDCrossframes, I = CF.inputsOf(C.P), p = I.p, E = CF.envOf(C.P), s0 = G.girders[0].segs[0], h = D.h;
    const ly = { g: D.layer('GRDR', 5), x: D.layer('XFRM', 3), cp: D.layer('GRDR-STIF', 30), bo: D.layer('BOLT', 2), d: D.layer('DIMS', 7), t: D.layer('ANNO-TEXT', 7), c: D.layer('CNTR', 8) }, cl = D.ltype('CENTER');
    const S = +p.S, hh = +p.h, tf = { b: s0.topB, t: s0.topT }, bf = { b: s0.botB, t: s0.botT }, Dm = s0.D, Dt = Dm + tf.t + bf.t, yb = (Dt - hh) / 2, yt = yb + hh, tw = s0.tw, cn = p.conn || {}, rb = (+cn.d || 0.875) / 2 + 0.0625;
    const cpts = (q, x0, sg, y0, y1) => [[x0 + sg * q.tw / 2, y0 + q.c], [x0 + sg * (q.tw / 2 + q.c), y0], [x0 + sg * (q.tw / 2 + q.bs), y0], [x0 + sg * (q.tw / 2 + q.bs), y1], [x0 + sg * (q.tw / 2 + q.c), y1], [x0 + sg * q.tw / 2, y1 - q.c]];   // GirderDetail cfCPpts
    const cp = CF.cfCP(p, false, E), cpD = { ...cp, tw }, cpN = `CONNECTION PLATES ${dIn(cp.bs)} x ${dIn(cp.tp)} WELDED TO WEB, CORNER CLIPS ${dIn(cp.c)}`, cpE = CF.cfCP(p, true, E), cpED = { ...cpE, tw };
    let R = null; try { R = CF.compute(p, E); if (R.errors && R.errors.length) R = null; } catch (e) { R = null; }
    [0, S].forEach(x => { D.rect(ly.g, x - bf.b / 2, 0, x + bf.b / 2, bf.t); D.rect(ly.g, x - tw / 2, bf.t, x + tw / 2, bf.t + Dm); D.rect(ly.g, x - tf.b / 2, bf.t + Dm, x + tf.b / 2, Dt);
      D.pline(ly.cp, cpts(cpD, x, x === 0 ? 1 : -1, bf.t, bf.t + Dm), true); D.line(ly.c, x, -2 * h, x, Dt + 2 * h, cl); });
    const dOn = CF.cfDiaOn(p), th = Math.max(...G.skews.map(v => Math.abs(v))), Se = S / Math.cos(th * Math.PI / 180), ox = S + tf.b + 30 * h;
    const skA = G.skews.map(v => Math.abs(v)), mix = skA.some(v => v !== th), thT = mix ? `DRAWN ALONG THE LARGEST SKEW, ${f2(th)} DEG.` : `ALONG ${f2(th)} DEG. SKEW`;
    const skN = mix ? `GIRDER SPACING ALONG SKEW AT EACH BEARING LINE: ${skA.map((v, k) => `${supName(k, skA.length)} ${dIn(S / Math.cos(v * Math.PI / 180))} (${f2(v)} DEG.)`).join('; ')}.` : '';
    const gird = x => { D.rect(ly.g, ox + x - bf.b / 2, 0, ox + x + bf.b / 2, bf.t); D.rect(ly.g, ox + x - tw / 2, bf.t, ox + x + tw / 2, bf.t + Dm); D.rect(ly.g, ox + x - tf.b / 2, bf.t + Dm, ox + x + tf.b / 2, Dt); };
    if (dOn) {
      const q = p.dia, Xs = CF.cfDiaSec(q), g = CF.cfDiaGap(q), y0 = (Dt - Xs.d) / 2, y1 = y0 + Xs.d, ec = +q.ecc || 3.5, nbl = Math.max(2, Math.round(+q.nb || 2)), sp = +q.pitch || 3;
      D.rect(ly.x, g, y0, S - g, y1); D.line(ly.x, g, y0 + Xs.tf, S - g, y0 + Xs.tf); D.line(ly.x, g, y1 - Xs.tf, S - g, y1 - Xs.tf); D.line(ly.c, 0, Dt / 2, S, Dt / 2, cl);
      [ec, S - ec].forEach(x => { for (let i = 0; i < nbl; i++) D.circle(ly.bo, x, Dt / 2 + (i - (nbl - 1) / 2) * sp, rb); });
      D.text(ly.t, S / 2 - 12 * h, y1 + 1.2 * h, h * 0.8, Xs.nm_); D.dimH(ly.d, 0, S, Dt + 4 * h, Dt, 'GIRDER SPACING <>'); D.dimV(ly.d, y0, y1, S + tf.b / 2 + 4 * h, S, 'DIAPHRAGM <>'); D.dimV(ly.d, 0, y0, S + tf.b / 2 + 4 * h, S); D.dimH(ly.d, 0, ec, y0 - 3 * h, y0, '<>');
      D.text(ly.t, 0, Dt + 8 * h, h * 1.3, `INTERMEDIATE DIAPHRAGM (${Xs.chS ? 'CHANNEL' : 'ROLLED W'})`);
      const qe = CF.cfDiaEnd(q), Xe = CF.cfDiaSec(qe), ge = CF.cfDiaGap(qe), e0 = (Dt - Xe.d) / 2, e1 = e0 + Xe.d, ece = +qe.ecc || 3.5, nbe = Math.max(2, Math.round(+qe.nb || 2)), spe = +qe.pitch || 3;
      [0, Se].forEach(x => { gird(x); D.pline(ly.cp, cpts(cpED, ox + x, x ? -1 : 1, bf.t, bf.t + Dm), true); });
      D.rect(ly.x, ox + ge, e0, ox + Se - ge, e1); D.line(ly.x, ox + ge, e0 + Xe.tf, ox + Se - ge, e0 + Xe.tf); D.line(ly.x, ox + ge, e1 - Xe.tf, ox + Se - ge, e1 - Xe.tf); D.line(ly.c, ox, Dt / 2, ox + Se, Dt / 2, cl);
      [ece, Se - ece].forEach(x => { for (let i = 0; i < nbe; i++) D.circle(ly.bo, ox + x, Dt / 2 + (i - (nbe - 1) / 2) * spe, rb); });
      D.text(ly.t, ox + Se / 2 - 12 * h, e1 + 1.2 * h, h * 0.8, Xe.nm_); D.dimV(ly.d, e0, e1, ox + Se + tf.b / 2 + 4 * h, ox + Se, 'DIAPHRAGM <>');
      D.dimH(ly.d, ox, ox + Se, Dt + 4 * h, Dt, 'ALONG SKEW <>'); D.text(ly.t, ox, Dt + 8 * h, h * 1.3, `END DIAPHRAGM AT BEARINGS (${Xe.chS ? 'CHANNEL' : 'ROLLED W'}, ${thT})`); if (skN) D.text(ly.t, ox, -8.8 * h, h * 0.8, skN);
      D.text(ly.t, ox, -6 * h, h * 0.8, `END DIAPHRAGM ${Xe.nm_} ASTM A709 GR. ${qe.gr || 50}; WEB BOLTED WITH ${nbe} - ${dIn(+cn.d || 0.875)} DIA. H.S. BOLTS EACH END IN ONE ROW @ ${dIn(spe)}, ${dIn(ece)} FROM GIRDER WEB; CENTERED ON GIRDER DEPTH; ${cpE.src === 'bs' ? `BEARING STIFFENERS ${dIn(cpE.bs)} x ${dIn(cpE.tp)} SERVE AS CONNECTION PLATES, CORNER CLIPS ${dIn(cpE.c)} (SKEWED OR BENT PLATES PER DESIGN).` : `BEARING STIFFENERS SERVE AS CONNECTION PLATES (SKEWED OR BENT PLATES PER DESIGN; DRAWN AT ${dIn(cpE.bs)} x ${dIn(cpE.tp)}).`}`);
      const Fe = R ? CF.cfDiaFit(R, qe, cpE, bf.t, tf.t) : null; if (Fe && Fe.bad.length) D.text(ly.t, ox, -7.4 * h, h * 0.8, `CHECK END DIAPHRAGM CONNECTION GEOMETRY: ${Fe.bad.join('; ')}.`.toUpperCase());
      D.text(ly.t, 0, -4 * h, h * 0.8, `DIAPHRAGM ${Xs.nm_} ASTM A709 GR. ${q.gr || 50}; WEB BOLTED TO CONNECTION PLATE WITH ${nbl} - ${dIn(+cn.d || 0.875)} DIA. H.S. BOLTS EACH END IN ONE ROW @ ${dIn(sp)}, ${dIn(ec)} FROM GIRDER WEB; CENTERED ON GIRDER DEPTH; COPE FLANGES AS REQUIRED; ${cpN}; DIAPHRAGM END ${dIn(g)} FROM GIRDER WEB CL.`);
      const Fi = R ? CF.cfDiaFit(R, q, cp, bf.t, tf.t) : null; if (Fi && Fi.bad.length) D.text(ly.t, 0, -5.4 * h, h * 0.8, `CHECK CONNECTION GEOMETRY: ${Fi.bad.join('; ')}.`.toUpperCase());
      return;
    }
    const memb = p.type === 'Kb' || p.type === 'K' ? [['top', [0, yt], [S, yt]], ['bot', [0, yb], [S, yb]], ['diag', [0, yt], [S / 2, yb]], ['diag', [S, yt], [S / 2, yb]]]
      : p.type === 'Kt' ? [['bot', [0, yb], [S, yb]], ['top', [0, yt], [S, yt]], ['diag', [0, yb], [S / 2, yt]], ['diag', [S, yb], [S / 2, yt]]] : [['bot', [0, yb], [S, yb]], ['top', [0, yt], [S, yt]], ['diag', [0, yb], [S, yt]], ['diag', [0, yt], [S, yb]]];
    memb.forEach(([k, a, b]) => { const mm = p.mem[k] || {}, L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], nv = [-u[1], u[0]], w = +mm.b1 || 4;
      const a2 = [a[0] + u[0] * (tw / 2 + 1.5), a[1] + u[1] * (tw / 2 + 1.5)], b2 = [b[0] - u[0] * (b[0] === S / 2 ? 0 : tw / 2 + 1.5), b[1] - u[1] * (b[0] === S / 2 ? 0 : tw / 2 + 1.5)];
      D.line(ly.c, a[0], a[1], b[0], b[1], cl); [0.5, -0.5].forEach(f => D.line(ly.x, a2[0] + nv[0] * w * f, a2[1] + nv[1] * w * f, b2[0] + nv[0] * w * f, b2[1] + nv[1] * w * f));
      const n = Math.max(1, +cn.n || 2); [a2].concat(b[0] === S / 2 ? [] : [b2]).forEach((q, e) => { const sgn = e ? -1 : 1; for (let i = 0; i < n; i++) D.circle(ly.bo, q[0] + sgn * u[0] * ((+cn.e || 1.5) + i * (+cn.s || 3)), q[1] + sgn * u[1] * ((+cn.e || 1.5) + i * (+cn.s || 3)), rb); });
      const mid = [(a[0] + b[0]) / 2 + nv[0] * (w / 2 + 1.2 * h), (a[1] + b[1]) / 2 + nv[1] * (w / 2 + 1.2 * h)], ang = Math.atan2(u[1], u[0]) * 180 / Math.PI; D.text(ly.t, mid[0], mid[1], h * 0.8, mm.sec || '', 1, ang > 90 || ang < -90 ? ang + 180 : ang); });
    D.dimH(ly.d, 0, S, Dt + 4 * h, Dt, 'GIRDER SPACING <>'); D.dimV(ly.d, yb, yt, S + tf.b / 2 + 4 * h, S, 'WORK PT. <>'); D.dimV(ly.d, 0, yb, S + tf.b / 2 + 4 * h, S);
    D.text(ly.t, 0, Dt + 8 * h, h * 1.3, `INTERMEDIATE CROSS-FRAME (TYPE ${/^K/.test(p.type) ? 'K' : 'X'})`);
    [0, Se].forEach(x => { gird(x); D.rect(ly.cp, ox + x + (x ? -1 : 1) * (tw / 2), bf.t, ox + x + (x ? -1 : 1) * (tw / 2 + 0.75), bf.t + Dm); });
    [[[0, yt], [Se, yt]], [[0, yb], [Se, yb]], [[0, yb], [Se, yt]], [[0, yt], [Se, yb]]].forEach(([a, b]) => D.line(ly.x, ox + a[0], a[1], ox + b[0], b[1]));
    D.dimH(ly.d, ox, ox + Se, Dt + 4 * h, Dt, 'ALONG SKEW <>'); D.text(ly.t, ox, Dt + 8 * h, h * 1.3, `END CROSS-FRAME AT BEARINGS (${thT})`); if (skN) D.text(ly.t, ox, -5.4 * h, h * 0.8, skN);
    D.text(ly.t, ox, -4 * h, h * 0.8, 'MEMBERS PER THE CROSS-FRAME DESIGN; BEARING STIFFENERS SERVE AS CONNECTION PLATES (SKEWED OR BENT PLATES PER DESIGN).');
    const cx = 0, cy = -18 * h, n = Math.max(1, +cn.n || 2), sp = +cn.s || 3, e0 = +cn.e || 1.5, Lc = e0 * 2 + (n - 1) * sp + 4, mm = p.mem.diag || {};
    D.rect(ly.cp, cx, cy - Lc / 2 - 3, cx + 0.625, cy + Lc / 2 + 3); D.rect(ly.x, cx + 0.625, cy - (+mm.b1 || 4) / 2, cx + 0.625 + Lc + 6, cy + (+mm.b1 || 4) / 2);
    const bx = [...Array(n)].map((_, i) => cx + 0.625 + e0 + i * sp); bx.forEach(x => D.circle(ly.bo, x, cy, rb));
    D.chainH(ly.d, [cx + 0.625, ...bx], cy + (+mm.b1 || 4) / 2 + 3 * h, cy + (+mm.b1 || 4) / 2);
    D.text(ly.t, cx, cy + Lc / 2 + 3 + 4 * h, h * 1.1, 'TYPICAL CONNECTION (MEMBER TO CONNECTION PLATE)'); D.text(ly.t, cx + Lc + 10, cy - 0.4 * h, h * 0.8, `${mm.sec || ''}: ${n} - ${dIn(+cn.d || 0.875)} DIA. H.S. BOLTS @ ${dIn(sp)}, EDGE ${dIn(e0)}${+cn.tg ? `; GUSSET ${dIn(+cn.tg)}` : ''}`);
    D.text(ly.t, 0, -4 * h, h * 0.8, `MEMBERS ASTM A709 GR. ${p.gA}; ${cn.n || 2} - ${dIn(+cn.d || 0.875)} DIA. H.S. BOLTS EACH END @ ${dIn(+cn.s || 3)}, EDGE ${dIn(+cn.e || 1.5)}; ${cpN}.`);
  }

  /* ---------- transverse stiffeners and connection plates (dxfTS) ---------- */
  function ts(D, C) {
    const G = C.G, h = D.h, ly = { g: D.layer('GRDR', 5), st: D.layer('GRDR-STIF', 30), d: D.layer('DIMS', 7), t: D.layer('ANNO-TEXT', 7), c: D.layer('CNTR', 8) }, cl = D.ltype('CENTER'), T = ((G.stf || {}).transverse || {}).types || {};
    let x0 = 0;
    const loc = role => { for (const g of G.girders) { const xs = role === 'cp' ? g.cps.map(q => q.s) : g.stiff; if (xs.length) return DW().segAt(g.segs, xs[0]); } return null; };
    Object.entries(T).forEach(([ty, t]) => { const s = loc(t.role); if (!s || !(+t.bt > 0)) return;
      const Dm = s.D, tw = s.tw, bfc = s.topB, tfc = s.topT, bft = s.botB, tft = s.botT, c = +t.c || 1, gp = t.role === 'cp' ? 0 : (+t.gap || 4 * tw), yw0 = tft, yw1 = tft + Dm, bt = +t.bt, two = String(t.sides) === '2';
      D.rect(ly.g, x0 - bft / 2, 0, x0 + bft / 2, tft); D.rect(ly.g, x0 - tw / 2, yw0, x0 + tw / 2, yw1); D.rect(ly.g, x0 - bfc / 2, yw1, x0 + bfc / 2, yw1 + tfc);
      (two ? [-1, 1] : [1]).forEach(sg => { const xi = x0 + sg * tw / 2, xo = x0 + sg * (tw / 2 + bt); D.pline(ly.st, [[xi, yw0 + gp + (gp ? 0 : c)], [gp ? xi : xi + sg * c, yw0 + gp], [xo, yw0 + gp], [xo, yw1], [xi + sg * c, yw1], [xi, yw1 - c]], true); });
      D.line(ly.c, x0, -2 * h, x0, yw1 + tfc + 2 * h, cl); weld(D, ly.t, x0 + tw / 2, yw0 + Dm * 0.6, dIn(+t.w || 0.3125), two, 'fillet', 'TYP.');
      D.dimH(ly.d, x0 + tw / 2, x0 + tw / 2 + bt, yw1 + tfc + 3 * h, yw1, 'b = <>'); if (gp > 0) D.dimV(ly.d, yw0, yw0 + gp, x0 + tw / 2 + bt + 3 * h, x0 + tw / 2 + bt, 'GAP <>');
      D.dimV(ly.d, yw0, yw1, x0 - bfc / 2 - 3 * h, x0 - tw / 2, 'D = <>');
      D.text(ly.t, x0 - bfc / 2, yw1 + tfc + 7.5 * h, h * 1.3, `${t.role === 'cp' ? 'CONNECTION PLATE' : 'TRANSVERSE STIFFENER'} TYPE ${ty}`);
      D.text(ly.t, x0 - bfc / 2, yw1 + tfc + 5.8 * h, h * 0.8, `PL. ${dIn(bt)} x ${dIn(+t.tp)}, ${two ? 'BOTH SIDES' : 'ONE SIDE'}; ${dIn(+t.w || 0.3125)} FILLET WELDS; ${t.role === 'cp' ? 'WELDED OR BOLTED TO BOTH FLANGES' : 'TIGHT FIT TO COMP. FLANGE, CLIP 1" CORNERS'}`);
      x0 += Math.max(bfc, bft) + 2 * bt + 40 * h; });
  }

  /* ---------- shear studs (dxfSC) ---------- */
  function studZones(C) { const P = C.P; if (P.studs && P.studs.zones && P.studs.zones.length) return { z: P.studs.zones, src: 'FATIGUE & STUDS INPUT TAB' };
    for (const pg of (C.RS ? C.RS.pgs : [])) { const F = C.RS.pg[pg].fat; if (F && F.SR && F.SR.zones && F.SR.zones.length) return { z: F.SR.zones, src: `FATIGUE & STUDS TAB, ${linesOf(C.G, pg).join(', ')}` }; } return null; }
  function sc(D, C) {
    const G = C.G, h = D.h, ly = { g: D.layer('GRDR', 5), s: D.layer('STUD', 2), dk: D.layer('DECK', 7), d: D.layer('DIMS', 7), t: D.layer('ANNO-TEXT', 7), tb: D.layer('TABL', 7) }, Z = studZones(C), s0 = G.girders[Math.min(1, G.nb - 1)].segs[0];
    const z0 = Z.z[0] || { nr: 3, p: 12 }, bt = s0.topB, tt = s0.topT, d = +((C.P.studs || {}).d) || 0.875, hs = +((C.P.studs || {}).h) || 6, n = +z0.nr || 3, dk = { ts: G.deck.ts, hh: G.deck.haunch };
    D.rect(ly.g, -bt / 2, -tt, bt / 2, 0); D.rect(ly.g, -s0.tw / 2, -tt - 8, s0.tw / 2, -tt); D.rect(ly.dk, -bt / 2 - 12, dk.hh, bt / 2 + 12, dk.hh + dk.ts); D.line(ly.dk, -bt / 2, 0, -bt / 2, dk.hh); D.line(ly.dk, bt / 2, 0, bt / 2, dk.hh);
    const sp = n > 1 ? Math.min(4 * d * 1.5, (bt - 2 * 1.5) / (n - 1)) : 0, xs = [...Array(n)].map((_, i) => (i - (n - 1) / 2) * sp);
    xs.forEach(x => { D.rect(ly.s, x - d / 2, 0, x + d / 2, hs - 0.375); D.rect(ly.s, x - d * 0.8, hs - 0.375, x + d * 0.8, hs); });
    if (n > 1) D.chainH(ly.d, [-bt / 2, ...xs, bt / 2], -tt - 3 * h, -tt); D.dimV(ly.d, 0, hs, bt / 2 + 12 + 3 * h, xs[xs.length - 1], 'STUD <>'); D.dimV(ly.d, dk.hh, dk.hh + dk.ts, -bt / 2 - 12 - 3 * h, -bt / 2 - 12, 'DECK <>');
    D.text(ly.t, -bt / 2 - 12, dk.hh + dk.ts + 5 * h, h * 1.3, 'SHEAR CONNECTOR DETAIL'); D.text(ly.t, -bt / 2 - 12, dk.hh + dk.ts + 3.4 * h, h * 0.8, `${dIn(d)} DIA. x ${dIn(hs)} HEADED STUDS; ${n} PER ROW SHOWN; SEE PITCH TABLE`);
    DW().table(D, ly.tb, bt / 2 + 12 + 10 * h, dk.hh + dk.ts + 5 * h, ['ZONE', 'FROM (FT)', 'TO (FT)', 'STUDS/ROW', 'PITCH', 'STUDS'], Z.z.map((z, i) => [str(z.name || `ZONE ${i + 1}`).toUpperCase(), f2(+z.x1), f2(+z.x2), String(z.nr), dIn(+z.p), String(Math.floor((+z.x2 - +z.x1) * 12 / +z.p + 1) * +z.nr)]),
      `STUD PITCH ZONES (PER GIRDER; STATIONS ALONG THE CENTERLINE SPANS; ${Z.src})`);
  }

  /* ---------- standard details (dxfStd) ---------- */
  function std(D, C) {
    const G = C.G, h = D.h, s0 = G.girders[0].segs[0], ly = { p: D.layer('GRDR-PLAT', 4), g: D.layer('GRDR', 5), d: D.layer('DIMS', 7), t: D.layer('ANNO-TEXT', 7), tb: D.layer('TABL', 7), bo: D.layer('BOLT', 2), c: D.layer('CNTR', 8) };
    const db = +(((C.P.splices || {}).bolts || {}).d) || 0.875, tw = s0.tw, sd = +((C.P.studs || {}).d) || 0.875, shh = +((C.P.studs || {}).h) || 6, Wmax = 30 * D.k, NT = DW().notes, BW = DW().bwName(G); let cx = 0, cy = 0, rowH = 0;
    const atG = fn => { const i0 = D.mark(); fn(); const b = D.bbox(i0), w = b[2] - b[0], hh2 = b[3] - b[1]; if (cx > 0 && cx + w > Wmax) { cx = 0; cy -= rowH + 4 * h; rowH = 0; } D.move(i0, cx - b[0], cy - b[3]); cx += w + 6 * h; rowH = Math.max(rowH, hh2); };
    const title = (s, n) => { D.text(ly.t, 0, 0, h * 1.2, s); if (n) D.text(ly.t, 0, -1.6 * h, h * 0.75, n); };
    atG(() => { title('1. BOLT HOLES AND EDGE DISTANCES', 'AASHTO LRFD 6.13.2.6'); const E = { 0.625: 0.875, 0.75: 1, 0.875: 1.125, 1: 1.25, 1.125: 1.5, 1.25: 1.625, 1.375: 1.75 };
      DW().table(D, ly.tb, 0, -4 * h, ['BOLT DIA.', 'STD. HOLE', 'MIN. EDGE', 'MIN. SPACING (3d)'], Object.entries(E).map(([d, e]) => [dIn(+d) + (Math.abs(+d - db) < 1e-6 ? ' (THIS DESIGN)' : ''), dIn(+d + 0.0625), dIn(e), dIn(3 * +d)]), ''); });
    atG(() => { title('2. STIFFENER CLIP AND WELD TERMINATION', 'AASHTO LRFD 6.10.11.1.1'); const Dv = 20, c = 1.5 * tw + 1;
      D.rect(ly.g, -8, -1.25, 8, 0); D.rect(ly.g, -tw / 2, 0, tw / 2, Dv); D.pline(ly.p, [[tw / 2, c], [tw / 2 + c, 0], [tw / 2 + 6, 0], [tw / 2 + 6, Dv], [tw / 2, Dv]], false);
      const e1 = Math.min(6 * tw, 4); D.dimV(ly.d, 0, 4 * tw, tw / 2 + 8, tw / 2, `4tw = ${dIn(4 * tw)} MIN.`); D.dimV(ly.d, 0, e1, tw / 2 + 14, tw / 2, `MAX. ${dIn(e1)}`);
      NT(D, ly.t, -8, -4 * h, '', ['WEB-TO-STIFFENER WELD STOPS BETWEEN 4tw AND THE LESSER OF 6tw AND 4 IN. FROM THE FLANGE-TO-WEB WELD TOE (TENSION FLANGE).'], 46); });
    atG(() => { title('3. CONNECTION PLATE AT TENSION FLANGE', 'AASHTO LRFD 6.6.1.3.1'); D.rect(ly.g, -8, -1.25, 8, 0); D.rect(ly.g, -tw / 2, 0, tw / 2, 20); D.rect(ly.p, tw / 2, 0, tw / 2 + 6, 20);
      NT(D, ly.t, -8, -4 * h, '', ['CONNECTION PLATES ATTACHED TO BOTH FLANGES: WELDED OR BOLTED TO THE TENSION FLANGE TO RESIST 20 KIPS LATERAL FORCE (STRAIGHT, NONSKEWED BRIDGES) OR PER REFINED ANALYSIS.'], 46); });
    atG(() => { title('4. SHEAR STUDS', 'AASHTO LRFD 6.10.10.1'); const bf = s0.topB, n = 3, s = 4 * sd; D.rect(ly.g, -bf / 2, -1, bf / 2, 0); [...Array(n)].forEach((_, i) => { const x = (i - 1) * s; D.rect(ly.p, x - sd / 2, 0, x + sd / 2, shh); });
      D.dimH(ly.d, -s, 0, shh + 2 * h, shh, `4d = ${dIn(4 * sd)} MIN.`); D.dimH(ly.d, s + sd / 2, bf / 2, -3 * h, 0, '1" MIN. CLEAR');
      D.text(ly.t, -bf / 2, -6 * h, h * 0.75, `${dIn(sd)} DIA. x ${dIn(shh)} STUDS: PITCH NOT LESS THAN 6d = ${dIn(6 * sd)}; MAXIMUM PITCH PER 6.10.10.1.2; PENETRATE 2 IN. MIN. INTO THE DECK; HEIGHT-TO-DIAMETER 4 MIN.`); });
    atG(() => { title('5. FLANGE TRANSITIONS', 'AASHTO/AWS D1.5'); D.pline(ly.p, [[-20, -0.6], [0, -0.6], [2.5, -1], [20, -1], [20, 1], [2.5, 1], [0, 0.6], [-20, 0.6]], true);
      D.pline(ly.p, [[-20, -14], [0, -14], [10, -16], [20, -16], [20, -4], [10, -4], [0, -6], [-20, -6]], true);
      NT(D, ly.t, -20, -20, '', ['THICKNESS AND WIDTH TRANSITIONS: 1 IN 2.5 MAX. SLOPE; CJP GROOVE WELD GROUND FLUSH AND SMOOTH IN THE DIRECTION OF STRESS; TRANSITION ON THE THICKER PLATE.'], 46); });
    atG(() => { title('6. SPLICE FILLER PLATES', 'AASHTO LRFD 6.13.6.1.5'); D.rect(ly.g, -20, 0, -0.25, 1); D.rect(ly.g, 0.25, 0, 20, 1.5); D.rect(ly.p, -12, 1, -0.25, 1.5); D.rect(ly.p, -12, 1.5, 12, 2.1);
      NT(D, ly.t, -20, -3 * h, '', ['FILLERS 1/4 IN. OR MORE: BOLT SHEAR REDUCED BY R = (1 + g)/(1 + 2g), OR FILLERS DEVELOPED. FILLERS NOT MORE THAN TWO PLIES. SAME MATERIAL AS THE FLANGE.'], 46); });
    atG(() => { title('7. CAMBER MEASUREMENT', ''); D.pline(ly.g, [...Array(21)].map((_, i) => [i * 3, Math.sin(i / 20 * Math.PI) * 6]), false); D.line(ly.c, 0, 0, 60, 0, D.ltype('CENTER')); D.dimV(ly.d, 0, 6, 30, 30, 'CAMBER');
      NT(D, ly.t, 0, -4 * h, '', ['CAMBER MEASURED FROM THE CHORD BETWEEN BEARINGS WITH THE GIRDER IN THE NO-LOAD CONDITION (WEB VERTICAL, NOT SUPPORTED BETWEEN BEARINGS). TABULATED CAMBER PLUS VERTICAL PROFILE.'], 46); });
    atG(() => { title('8. BEARING STIFFENERS AT SKEWED SUPPORTS', 'OPTIONS'); D.rect(ly.g, -20, -0.28, 20, 0.28); D.rect(ly.p, -0.4, 0.28, 0.4, 7); D.rect(ly.p, -0.4, -7, 0.4, -0.28);
      const a = Math.max(...G.skews.map(Math.abs)) * Math.PI / 180; D.line(ly.c, -10 * Math.sin(a), -10 * Math.cos(a), 10 * Math.sin(a), 10 * Math.cos(a), D.ltype('CENTER'));
      NT(D, ly.t, -20, -10, '', [`A: NORMAL TO THE WEB (SHOWN), PREFERRED WHERE THE SKEW IS 20 DEG. OR LESS. B: PARALLEL TO THE BEARING LINE FOR LARGER SKEWS (THIS BRIDGE ${f2(a * 180 / Math.PI)} DEG.).`], 46); });
    atG(() => { title('9. WELD SYMBOLS', 'AWS A2.4'); weld(D, ly.t, 0, 0, '5/16', false, 'fillet', 'FILLET, ARROW SIDE'); weld(D, ly.t, 0, -8 * h, '5/16', true, 'fillet', 'FILLET, BOTH SIDES'); weld(D, ly.t, 0, -16 * h, '', false, 'cjp', 'CJP GROOVE'); });
    const i0 = D.mark(); NT(D, ly.t, 0, 0, 'CONSTRUCTION STAGING NOTES (TYPICAL; VERIFY FOR THE PROJECT)', [`ERECT GIRDERS IN PAIRS WITH ${BW}S INSTALLED BEFORE RELEASE; COMPLETE FIELD SPLICES TO FULL TENSION BEFORE PLACING DECK FORMS.`,
      `DO NOT REMOVE ${BW}S OR TEMPORARY BRACING UNTIL THE DECK HAS REACHED 75 PERCENT OF f'c.`, 'PLACE THE DECK IN THE SEQUENCE SHOWN ON THE PLANS (POSITIVE MOMENT REGIONS FIRST); GIRDERS ACT NONCOMPOSITE UNTIL THE DECK CURES.',
      'OVERHANG BRACKETS BY THE CONTRACTOR, DESIGNED FOR THE LOADS ON THE DECK OVERHANG SHEET; CHECK EXTERIOR GIRDER ROTATION.'], 110);
    const b = D.bbox(i0); D.move(i0, -b[0], cy - rowH - 5 * h - b[3]);
  }

  /* ---------- flange transitions (dxfWT): one detail per distinct transition, its locations listed ---------- */
  function trGroups(C) { const grp = {};
    C.RS.pgs.forEach(pg => { const w = C.RS.pg[pg].wt; if (!w) return; const ln = linesOf(C.G, pg).join(', ');
      w.R.tr.forEach(r => { const key = [r.fl, r.b1, r.t1, r.b2, r.t2, r.Lt, r.Lw, r.ground].join('|'); (grp[key] = grp[key] || { r, locs: [] }).locs.push(`${ln}: ${r.name}`); }); });
    return Object.values(grp); }
  function wt(D, C) {
    const h = D.h, ly = { p: D.layer('GRDR-PLAT', 4), w: D.layer('WELD', 1), d: D.layer('DIMS', 7), t: D.layer('ANNO-TEXT', 7), c: D.layer('CNTR', 8) }, cl = D.ltype('CENTER');
    let gx = 0, gy = 0, rowH = 0, col = 0;
    trGroups(C).forEach(({ r, locs }) => { const i0 = D.mark(), b1 = +r.b1, b2 = +r.b2, t1 = +r.t1, t2 = +r.t2, Lt = +r.Lt || 2.5 * Math.abs(t2 - t1), Lw = r.wType === 'taper' ? (+r.Lw || 2.5 * Math.abs(b2 - b1) / 2) : 0, L0 = 24;
      D.pline(ly.p, [[-L0, -t1 / 2], [0, -t1 / 2], [Lt, -t2 / 2], [Lt + L0, -t2 / 2], [Lt + L0, t2 / 2], [Lt, t2 / 2], [0, t1 / 2], [-L0, t1 / 2]], true);
      D.line(ly.w, -0.01, -t1 / 2 - 1, -0.01, t1 / 2 + 1); weld(D, ly.t, 0, t1 / 2, '', true, 'cjp', r.ground === 'no' ? 'CJP' : 'CJP, GRIND FLUSH', -1);
      D.dimH(ly.d, 0, Lt, t2 / 2 + 3 * h, t2 / 2, 'TAPER <>'); D.dimV(ly.d, -t1 / 2, t1 / 2, -L0 - 3 * h, -L0, `${dIn(t1)}`); D.dimV(ly.d, -t2 / 2, t2 / 2, Lt + L0 + 3 * h, Lt + L0, `${dIn(t2)}`);
      const yp = -t2 / 2 - 8 * h - Math.max(b1, b2) / 2;
      if (Lw > 0) { D.pline(ly.p, [[-L0, yp - b1 / 2], [0, yp - b1 / 2], [Lw, yp - b2 / 2], [Lw + L0, yp - b2 / 2], [Lw + L0, yp + b2 / 2], [Lw, yp + b2 / 2], [0, yp + b1 / 2], [-L0, yp + b1 / 2]], true);
        D.dimH(ly.d, 0, Lw, yp - Math.max(b1, b2) / 2 - 3 * h, yp - b1 / 2, 'WIDTH TAPER <>'); D.dimV(ly.d, yp - b1 / 2, yp + b1 / 2, -L0 - 3 * h, -L0); D.dimV(ly.d, yp - b2 / 2, yp + b2 / 2, Lw + L0 + 3 * h, Lw + L0); }
      D.line(ly.c, -L0 - 2 * h, 0, Lt + L0 + 2 * h, 0, cl);
      D.text(ly.t, -L0, t2 / 2 + 7 * h, h * 1.3, `${r.fl === 'top' ? 'TOP' : 'BOTTOM'} FLANGE TRANSITION (${locs.length} LOCATION${locs.length > 1 ? 'S' : ''})`);
      DW().notes(D, ly.t, -L0, Lw > 0 ? yp - Math.max(b1, b2) / 2 - 6 * h : -Math.max(t1, t2) / 2 - 5 * h, 'LOCATIONS', locs.map(q => str(q).toUpperCase()), 60);
      D.text(ly.t, -L0, t2 / 2 + 5.4 * h, h * 0.8, `CJP GROOVE WELD, ${r.ground === 'no' ? 'AS WELDED' : 'GROUND FLUSH, SMOOTH IN DIRECTION OF STRESS'}; 1:2.5 MAX. SLOPE. ${dIn(b1)} x ${dIn(t1)} TO ${dIn(b2)} x ${dIn(t2)} (WELDS TAB)`);
      const bb = D.bbox(i0); D.move(i0, gx - bb[0], gy - bb[3]); rowH = Math.max(rowH, bb[3] - bb[1]); gx += (bb[2] - bb[0]) + 8 * h;
      if (++col === 3) { col = 0; gx = 0; gy -= rowH + 8 * h; rowH = 0; } });
  }

  /* ---------- sheets (dxfSheet, dxfBuild) ---------- */
  const scaleName = k => DW().SCALE_NAME[k] || `1:${k}`;
  /* one sheet: the smallest plot scale (not below S.kmin) at which the drawing fits the drawing area; the drawing placed top left in
     the sheet at x offset ox; border, inner border and title block at the plot scale */
  function sheet(D, S, ox, C) {
    const [pw, ph] = PAPER[S.paper] || PAPER.D, aw = pw - 2.25, ah = ph - 4.55, i0 = D.mark(), SC = DW().SCALES; let k = null, b = null;
    for (const kk of SC) { if (kk < (S.kmin || 1)) continue; D.E.length = i0; D.k = kk; D.h = (S.txt || DW().TXT) * kk; S.fn(D, S.c); b = D.bbox(i0); if (!isFinite(b[0])) b = [0, 0, 0, 0]; if ((b[2] - b[0]) / kk <= aw && (b[3] - b[1]) / kk <= ah) { k = kk; break; } }
    const over = !k; if (!k) k = D.k;
    const W = pw * k, H = ph * k; D.move(i0, ox + 1.25 * k - b[0], H - 1.0 * k - b[3]); const iC = D.mark();
    const pj = C.P.project || {}, cells = [[0.75, 'PROJECT', pj.name || ''], [9, 'PROJECT NO.', pj.number || ''], [13, 'SHEET TITLE', S.title], [24, 'SCALE', scaleName(k)], [28, 'DESIGNED / CHECKED', `${pj.designer || '-'} / ${pj.checker || '-'}`], [31, 'SHEET', `${S.n} OF ${S.of}`]];
    const tb = D.layer('TBLK', 7), bd = D.layer('BRDR', 7);
    D.rect(bd, ox, 0, ox + W, H); D.rect(bd, ox + 0.75 * k, 0.5 * k, ox + W - 0.5 * k, H - 0.5 * k);
    const ty = 0.5 * k, th = 2.6 * k, x1 = ox + W - 0.5 * k; D.line(tb, ox + 0.75 * k, ty + th, x1, ty + th);
    const sx = pw / 34; cells.forEach(([cx, lb, val], i) => { const xx = ox + cx * k * sx; if (i) D.line(tb, xx, ty, xx, ty + th); D.text(tb, xx + 0.15 * k, ty + th - 0.35 * k, 0.1 * k, lb); D.text(tb, xx + 0.15 * k, ty + 1.0 * k, 0.18 * k, String(val).toUpperCase()); });
    D.text(tb, ox + 0.9 * k, ty + 0.25 * k, 0.08 * k, `GENERATED BY STEEL BRIDGE DESIGN ${C.date}. FULL-SIZE GEOMETRY IN INCHES; PLOT THIS SHEET AT ${k === 1 ? 'FULL SIZE' : '1:' + k} (${scaleName(k)}).`);
    return { n: S.n, title: S.title, id: S.id, k, W, H, ox, i0, iC, i1: D.mark(), over, paper: S.paper };
  }

  /* build(G, RS, opt): the sheet set of model G (SBDDrawings.model) with the results RS (results(); null: the sheets that need them are
     listed as not generated). opt: { paper: 'D' | 'B', date ('YYYY-MM-DD', default today), prefix ('S-'), only: [ids] }.
     Returns { D, sheets: [{ n, id, title, k, W, H, ox, i0, iC (title block start), i1, over }], miss: [[what, why]], Q (quantities) } */
  function build(G, RS, opt) {
    opt = opt || {}; const P = G.P, D = X_().drawing({ prefix: opt.prefix == null ? 'S-' : opt.prefix });
    const C = { G, RS, P, o: opt, list: [], miss: [], date: opt.date || new Date().toISOString().slice(0, 10) }, list = [], skip = (w, why) => C.miss.push([w, why]);
    const add = (id, title, fn, c, kmin) => list.push({ id, title, fn, c: { ...C, ...(c || {}) }, kmin });
    const NOR = 'RESULTS NOT CALCULATED (DRAWINGS TAB: CALCULATE RESULTS)', anOk = pg => RS && RS.pg[pg] && RS.pg[pg].an;
    add('cover', 'COVER AND SHEET INDEX', cover, {}, 1);
    add('plan', 'FRAMING PLAN', (D_, C_) => DW().plan(G, D_, { k: D_.k, RS }), {}, 48);
    add('erect', 'ERECTION DIAGRAM AND GIRDER LAYOUT', erect, {}, 48);
    add('elev', 'GIRDER ELEVATION AND CAMBER', elev, { gi: 0, one: false }, 48);
    G.girders.forEach(g => add(`gelev${g.i + 1}`, `GIRDER ${g.label} ELEVATION`, elev, { gi: g.i, one: true }, 48));
    add('sec', 'TYPICAL SECTION AND NOTES', section, {}, 12);
    if (G.splices.length) {
      if (!RS) skip('FIELD SPLICE', NOR);
      else RS.pgs.forEach(pg => { const r = RS.pg[pg], L = (r.spl && r.spl.list) || [], ln = linesOf(G, pg);
        if (!r.spl) { skip(`FIELD SPLICES ${ln.join(', ')}`, str(r.err.spl || r.err.an || 'NOT DESIGNED').toUpperCase()); return; }
        L.forEach((s, k) => { if (s.R && s.R.fl && !(s.R.errors && s.R.errors.length)) add(`spl${pg}_${k}`, `FIELD SPLICE FS${k + 1} (${ln.join(', ')})`, splice, { R: s.R, name: `FS${k + 1} AT ${f2(s.x)} FT`, lines: `GIRDERS ${ln.join(', ')}` }, 3);
          else skip(`FIELD SPLICE FS${k + 1} (${ln.join(', ')})`, str((s.R && s.R.errors || []).join(' ') || 'NOT DESIGNED').toUpperCase().slice(0, 80)); }); });
    } else skip('FIELD SPLICE', 'NO FIELD SPLICES IN THE FRAMING');
    if (!RS) skip('ANALYSIS DIAGRAMS', NOR);
    else RS.pgs.forEach(pg => { const ln = linesOf(G, pg), ext = G.girders.some(g => g.pg === pg && g.ext);
      if (anOk(pg)) add(`diag${pg}`, `ANALYSIS DIAGRAMS ${ln.join(', ')} (${ext ? 'EXTERIOR' : 'INTERIOR'})`, diag, { A: RS.pg[pg].an, name: ln.join(', ') }, 48); else skip(`ANALYSIS DIAGRAMS ${ln.join(', ')}`, str(RS.pg[pg].err.an || RS.pg[pg].err.all || 'NO ANALYSIS').toUpperCase().slice(0, 80)); });
    if (RS && RS.pgs.some(pg => (RS.pg[pg].gov || []).length)) add('summ', 'DESIGN SUMMARY', summary, {}, 1); else skip('DESIGN SUMMARY', RS ? 'NO CHECK RESULTS' : NOR);
    if (RS && RS.pgs.some(anOk)) add('reac', 'BEARING REACTIONS', reac, {}, 1); else skip('BEARING REACTIONS', RS ? 'THE STRUCTURAL ANALYSIS HAS INPUT ERRORS' : NOR);
    if (RS && RS.pgs.some(pg => RS.pg[pg].fat && RS.pg[pg].fat.FR && (RS.pg[pg].fat.FR.rows || []).length)) add('fat', 'FATIGUE AND FRACTURE', fat, {}, 1); else skip('FATIGUE AND FRACTURE', RS ? 'NO FATIGUE DETAILS' : NOR);
    if (G.deck.ohL > 0) add('oh', 'DECK OVERHANG', overhang, {}, 4); else skip('DECK OVERHANG', 'NO LEFT DECK OVERHANG');
    if (((G.stf || {}).bearing || {}).types) add('bs', 'BEARING STIFFENER DETAILS', bs, {}, 4); else skip('BEARING STIFFENER DETAILS', 'NO BEARING STIFFENER TYPES');
    if (window.SBDCrossframes && G.nb > 1) add('cf', G.cf.dia ? 'DIAPHRAGM DETAILS' : 'CROSS-FRAME DETAILS', cf, {}, 4); else skip('CROSS-FRAME DETAILS', 'ONE GIRDER');
    if (G.girders.some(g => g.cps.length || g.stiff.length)) add('ts', 'STIFFENER AND CONNECTION PLATE DETAILS', ts, {}, 4); else skip('STIFFENER AND CONNECTION PLATE DETAILS', 'NO CONNECTION PLATES OR STIFFENERS');
    if (studZones(C)) add('sc', 'SHEAR CONNECTOR DETAILS', sc, {}, 3); else skip('SHEAR CONNECTOR DETAILS', RS ? 'NO STUD PITCH ZONES' : `NO STUD PITCH ZONES ENTERED; ${NOR}`);
    add('std', 'STANDARD DETAILS AND STAGING NOTES', std, {}, 3);
    if (!RS) skip('FLANGE TRANSITION DETAILS', NOR); else if (trGroups(C).length) add('wt', 'FLANGE TRANSITION DETAILS', wt, {}, 3); else skip('FLANGE TRANSITION DETAILS', 'NO SHOP FLANGE TRANSITIONS');
    const only = opt.only ? list.filter(s => opt.only.includes(s.id)) : list;
    only.forEach(s => C.list.push(s.title));
    let ox = 0; const sheets = [];
    only.forEach((S, i) => { const r = sheet(D, { ...S, paper: opt.paper || 'D', n: i + 1, of: only.length }, ox, C); sheets.push(r); ox += r.W + 2 * r.k * 12; });
    return { D, sheets, miss: C.miss, Q: quantities(G, RS) };
  }

  window.SBDSheets = { PAPER, GAM, results, env, tenths, at, quantities, weld, build, sheet, fwSize };
})();
