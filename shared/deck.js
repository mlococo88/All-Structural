/* shared/deck.js — transverse design of a concrete deck slab on girders by the strip method (window.SharedDeck).
   Classic script, no DOM. Created 2026-11-23 for the Steel Bridge Design app (apps/steel-bridge/engine/deck.js), engineer request
   2026-11-23: "the Steel tool gets the deck design the Prestressed tool has".

   SAME METHOD AND ARITHMETIC AS THE PRESTRESSED BRIDGE DESIGN DECK MODULE (apps/ps-bridge/engine/pbd-handling-deck.js: deckTableA4,
   deckDesignSection, deckCalc), operation for operation: tests/engine/deck-parity.test.mjs runs both on made-up decks and requires every
   value to be identical. The Prestressed app is NOT wired to this file (its engine is a frozen copy); a later PR can move it here.
   What the method is (and is not), as the Prestressed module:
     interior bays   dead load by the continuous-slab coefficients w S^2/11 (positive) and w S^2/10 (negative), S = the girder spacing
                     centre to centre; live load + IM from AASHTO LRFD 10th Ed. Table A4-1 (multiple presence and the 33 % dynamic load
                     allowance are in the tabulated values), interpolated on S and on the distance of the negative-moment design section
                     from the girder centreline (Art. 4.6.2.1.6); Strength I (Table 3.4.1-1: 1.25 DC, 1.50 DW, 1.75 LL+IM) with the
                     owner's load modifier eta and HL-93 multiplier m; rectangular-section flexural resistance per foot (Art. 5.6.3.2,
                     5.6.2.2) with phi from the net tensile strain (Art. 5.5.4.2: 0.75 at 0.002 to 0.90 at 0.005).
     overhang        gravity only: slab, barrier / curb / railing and wearing surface about the exterior girder centreline, one 16 kip
                     wheel 1 ft from the traffic face (Art. 3.6.1.3.1) on the strip 45.0 + 10.0 X in (Table 4.6.2.1.3-1) with IM 1.33
                     (Art. 3.6.2) and multiple presence 1.20 (Art. 3.6.1.1.2); the top bars of the negative moment.
     distribution    bottom bars parallel to the girders: min(220 / sqrt(S), 67) percent of the positive-moment steel (Art. 9.7.3.2),
                     S in ft. strip() and distPct(S) keep the Prestressed module's S = the girder spacing (the parity test of the raw
                     module); the tools use distEff() (DD, 2026-11-24, engineer request "Please fix the deck distribution steel"): S = the
                     effective span length of Art. 9.7.2.3, slab on steel or concrete girders: the distance between the flange tips plus one
                     flange overhang (extreme flange tip to the face of the web, fillets disregarded):
                       S_eff = S - b_f/12 + (b_f - t_w)/24  (ft; S the girder spacing ft, b_f the top flange width in, t_w the web thickness in).
     NOT checked     the Extreme Event II vehicular-collision cases of the overhang (A13.4), crack control (5.6.7), minimum reinforcement
                     (5.6.3.3), shrinkage and temperature steel (5.10.6), the empirical design (9.7.2), fatigue, development of the bars.
   The numbers of Table A4-1 are held as data (kip-ft/ft), the same values as the Prestressed module's table (the parity test compares the
   two tables entry by entry). No specification text is reproduced.

   Units: S, overhang, positions ft; thicknesses, covers, bar spacing, design-section distance in; bar area in^2; f'c, fy ksi; unit weight
   kcf; area loads ksf; line loads klf (per foot along the bridge); moments kip-ft per foot of deck.

   API (plain numbers in, plain objects out):
     tableA4(S, x)            -> { Mpos, Mneg, S, Sused, x, xUsed, below, above, outOfRange, xClamped, d: { r0, r1, row, j, f, gf, X } }
     designSection(kind, b)   -> { x, rule }   kind 'steel' (b_f/4), 'precast' (b_tf/3 <= 15 in), 'box' (b/2); b = flange width (in); 0..24 in
     interior(o)              -> o = { S, wDC, wDW (ksf), xneg (in), eta, mLL }: the bay moments and Strength I M_u (+ and -)
     capacity(o)              -> o = { barA, sp, cover, ts, fc, fy, Mu }: A_s, d, a, c, eps_t, phi, M_n, phi M_n, ratio
     overhang(o)              -> o = { oh, face (edge to the traffic face, ft), wSlab (ksf), DC: [load], DW: [load], PL: [load], eta, mLL };
                                 load = { w (klf), x (ft from the deck edge) } or { q (ksf), x0, x1 (ft from the deck edge) }, name optional
     distPct(S)               -> percent of the positive-moment steel, min(220 / sqrt(S), 67)
     effSpan(S, bf, tw)       -> { S, bf, tw, ok, clear (S - b_f/12), ohF ((b_f - t_w)/24), Seff } (ft); ok false (Seff NaN) without a valid b_f, t_w
     distEff(o)               -> o = { S, bf, tw }: effSpan + { pct, pct0 (= distPct(S), the girder spacing, before DD), capped (pct = 67),
                                 why ('' | 'geometry' | 'nonpositive') }. Without a valid b_f and t_w, or S_eff <= 0: pct = 67, the upper limit
                                 (conservative: a shorter span can only raise the percentage up to 67)
     strip(inp)               -> the whole design of one deck as the Prestressed module's deckCalc (same field names), inp = { S, ts, tsLoad,
                                 fc, fy, wc (kcf, dead load), wsFut (ksf), xneg (in), barTop, sTop, coverT, barBot, sBot, coverB, oh (ft),
                                 bBar (in), wBar (klf), eta, mLL }
     steps.interior / steps.capacity / steps.overhang / steps.dist (w, …)   the worked steps (shared/steps.js format; needs SharedSteps)
   Tests: tests/engine/deck.test.mjs (hand checks), tests/engine/deck-parity.test.mjs (the Prestressed module). Log: fixlog/shared-deck.md. */
(function () {
  'use strict';
  const ED = 'AASHTO LRFD 10th Ed. ';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* Table A4-1 as data: [S (ft), +M, -M at 0, 3, 6, 9, 12, 18, 24 in from the girder centreline], kip-ft/ft, S = 4 ft to 15 ft by 0.25 ft. */
  const A4_X = [0, 3, 6, 9, 12, 18, 24];
  const A4 = [
    [4.00, 4.68, 2.68, 2.07, 1.74, 1.60, 1.50, 1.34, 1.25],
    [4.25, 4.66, 2.73, 2.25, 1.95, 1.74, 1.57, 1.33, 1.20],
    [4.50, 4.63, 3.00, 2.58, 2.19, 1.90, 1.65, 1.32, 1.18],
    [4.75, 4.64, 3.38, 2.90, 2.43, 2.07, 1.74, 1.29, 1.20],
    [5.00, 4.65, 3.74, 3.20, 2.66, 2.24, 1.83, 1.26, 1.12],
    [5.25, 4.67, 4.06, 3.47, 2.89, 2.41, 1.95, 1.28, 0.98],
    [5.50, 4.71, 4.36, 3.73, 3.11, 2.58, 2.07, 1.30, 0.99],
    [5.75, 4.77, 4.63, 3.97, 3.31, 2.73, 2.19, 1.32, 1.02],
    [6.00, 4.83, 4.88, 4.19, 3.50, 2.88, 2.31, 1.39, 1.07],
    [6.25, 4.91, 5.10, 4.39, 3.68, 3.02, 2.42, 1.45, 1.13],
    [6.50, 5.00, 5.31, 4.57, 3.84, 3.15, 2.53, 1.50, 1.20],
    [6.75, 5.10, 5.50, 4.74, 3.99, 3.27, 2.64, 1.58, 1.28],
    [7.00, 5.21, 5.98, 5.17, 4.36, 3.56, 2.84, 1.63, 1.37],
    [7.25, 5.32, 6.13, 5.31, 4.49, 3.68, 2.96, 1.65, 1.51],
    [7.50, 5.44, 6.26, 5.43, 4.61, 3.78, 3.15, 1.88, 1.72],
    [7.75, 5.56, 6.38, 5.54, 4.71, 3.88, 3.30, 2.21, 1.94],
    [8.00, 5.69, 6.48, 5.65, 4.81, 3.98, 3.43, 2.49, 2.16],
    [8.25, 5.83, 6.58, 5.74, 4.90, 4.06, 3.53, 2.74, 2.37],
    [8.50, 5.99, 6.66, 5.82, 4.98, 4.14, 3.61, 2.96, 2.58],
    [8.75, 6.14, 6.74, 5.90, 5.06, 4.22, 3.67, 3.15, 2.79],
    [9.00, 6.29, 6.81, 5.97, 5.13, 4.28, 3.71, 3.31, 3.00],
    [9.25, 6.44, 6.87, 6.03, 5.19, 4.40, 3.82, 3.47, 3.20],
    [9.50, 6.59, 7.15, 6.31, 5.46, 4.66, 4.04, 3.68, 3.39],
    [9.75, 6.74, 7.51, 6.65, 5.80, 4.94, 4.21, 3.89, 3.58],
    [10.00, 6.89, 7.85, 6.99, 6.13, 5.26, 4.41, 4.09, 3.77],
    [10.25, 7.03, 8.19, 7.32, 6.45, 5.58, 4.71, 4.29, 3.96],
    [10.50, 7.17, 8.52, 7.64, 6.77, 5.89, 5.02, 4.48, 4.15],
    [10.75, 7.32, 8.83, 7.95, 7.08, 6.20, 5.32, 4.68, 4.34],
    [11.00, 7.46, 9.14, 8.26, 7.38, 6.50, 5.62, 4.86, 4.52],
    [11.25, 7.60, 9.44, 8.56, 7.68, 6.80, 5.91, 5.04, 4.70],
    [11.50, 7.74, 9.72, 8.84, 7.96, 7.08, 6.20, 5.22, 4.87],
    [11.75, 7.88, 10.01, 9.12, 8.24, 7.36, 6.47, 5.40, 5.05],
    [12.00, 8.01, 10.28, 9.40, 8.51, 7.63, 6.74, 5.56, 5.21],
    [12.25, 8.15, 10.55, 9.67, 8.78, 7.90, 7.02, 5.75, 5.38],
    [12.50, 8.28, 10.81, 9.93, 9.04, 8.16, 7.28, 5.97, 5.54],
    [12.75, 8.41, 11.06, 10.18, 9.30, 8.42, 7.54, 6.18, 5.70],
    [13.00, 8.54, 11.31, 10.43, 9.55, 8.67, 7.79, 6.38, 5.86],
    [13.25, 8.66, 11.55, 10.67, 9.80, 8.92, 8.04, 6.59, 6.01],
    [13.50, 8.78, 11.79, 10.91, 10.03, 9.16, 8.28, 6.79, 6.16],
    [13.75, 8.90, 12.02, 11.14, 10.27, 9.40, 8.52, 6.99, 6.30],
    [14.00, 9.02, 12.24, 11.37, 10.50, 9.63, 8.76, 7.18, 6.45],
    [14.25, 9.14, 12.46, 11.59, 10.72, 9.85, 8.99, 7.38, 6.58],
    [14.50, 9.25, 12.67, 11.81, 10.94, 10.08, 9.21, 7.57, 6.72],
    [14.75, 9.36, 12.88, 12.02, 11.16, 10.30, 9.44, 7.76, 6.86],
    [15.00, 9.47, 13.09, 12.23, 11.37, 10.51, 9.65, 7.94, 7.02]];

  /* tableA4(S, x): the tabulated moments interpolated on S (rows 0.25 ft apart), then the negative moment on x (columns 0 to 24 in).
     S below 4 ft uses the 4 ft row, above 15 ft the 15 ft row (flags below / above); x above 24 in uses 24 in (xClamped). */
  function tableA4(S, x) {
    const Sn = +S || 0, Sc = clamp(Sn, 4, 15), below = Sn < 4, above = Sn > 15;
    const t = (Sc - 4) / 0.25;
    const i0 = clamp(Math.floor(t), 0, A4.length - 1), i1 = Math.min(i0 + 1, A4.length - 1), f = t - i0;
    const row = A4[i0].map((v, k) => v + (A4[i1][k] - v) * f);
    const xn = +x || 0, xc = clamp(xn, 0, 24);
    let j = 0; while (j < A4_X.length - 2 && xc > A4_X[j + 1]) j++;
    const gf = (xc - A4_X[j]) / (A4_X[j + 1] - A4_X[j]);
    const Mneg = row[2 + j] + (row[3 + j] - row[2 + j]) * gf;
    return { Mpos: row[1], Mneg, S: Sn, Sused: Sc, x: xn, xUsed: xc, below, above, outOfRange: below || above, xClamped: xn > 24,
      d: { r0: A4[i0].slice(), r1: A4[i1].slice(), row, j, f, gf, X: [A4_X[j], A4_X[j + 1]] } };
  }

  /* designSection(kind, b): distance from the girder centreline to the negative-moment design section, in (Art. 4.6.2.1.6), kept within
     the 0 to 24 in of Table A4-1. 'steel': one quarter of the flange width; 'precast': one third of the flange width, not over 15 in;
     'box': the face of the support (half the width). */
  function designSection(kind, b) {
    const w = +b || 0;
    if (kind === 'box') return { x: clamp(w / 2, 0, 24), rule: 'closed box → face of support (b/2)' };
    if (kind === 'steel') return { x: clamp(w / 4, 0, 24), rule: 'steel I-girder → b_f/4' };
    return { x: clamp(Math.min(w / 3, 15), 0, 24), rule: 'precast I / open box → b_tf/3 ≤ 15 in' };
  }

  /* interior(o): one interior bay per foot of deck. */
  function interior(o) {
    const S = o.S, wDC = o.wDC, wDW = o.wDW, eta = o.eta == null ? 1 : o.eta, mLL = o.mLL == null ? 1 : o.mLL;
    const Ls = S;
    const MDC_neg = wDC * Ls * Ls / 10, MDC_pos = wDC * Ls * Ls / 11;
    const MDW_neg = wDW * Ls * Ls / 10, MDW_pos = wDW * Ls * Ls / 11;
    const T = tableA4(S, o.xneg), MLL_pos = T.Mpos, MLL_neg = T.Mneg;
    const SWpos = 26 + 6.6 * S, SWneg = 48 + 3.0 * S;   // Table 4.6.2.1.3-1 strip widths, in: reference only (the live load is Table A4-1's)
    const Mu_pos = eta * (1.25 * MDC_pos + 1.50 * MDW_pos + 1.75 * (mLL * MLL_pos));
    const Mu_neg = eta * (1.25 * MDC_neg + 1.50 * MDW_neg + 1.75 * (mLL * MLL_neg));
    return { S, Ls, wDC, wDW, xneg: o.xneg, eta, mLL, MDC_pos, MDC_neg, MDW_pos, MDW_neg, MDL_pos: MDC_pos + MDW_pos, MDL_neg: MDC_neg + MDW_neg,
      A4: T, MLL_pos, MLL_neg, SWpos, SWneg, Mu_pos, Mu_neg };
  }

  /* capacity(o): singly reinforced rectangular section, b = 12 in. d to the bar centroid with the equivalent bar diameter sqrt(4 A_b / pi).
     A bar spacing of 0 or less credits no steel. */
  function capacity(o) {
    const barA = o.barA, sp = o.sp, cover = o.cover, ts = o.ts, fcd = o.fc, fy = o.fy, Mu = o.Mu;
    const As = (+sp > 0) ? barA * 12 / sp : 0;
    const dbar = Math.sqrt(barA * 4 / Math.PI);
    const dEff = ts - cover - dbar / 2;
    const a = As * fy / (0.85 * fcd * 12);
    const b1 = clamp(0.85 - 0.05 * (fcd - 4), 0.65, 0.85);
    const c = a / b1, et = 0.003 * (dEff / c - 1);
    const phi = clamp(0.75 + 0.15 * (et - 0.002) / 0.003, 0.75, 0.9);
    const Mn = As * fy * (dEff - a / 2) / 12;
    return { As, dbar, dEff, a, c, et, phi, Mn, phiMn: phi * Mn, Mu, dc: Mu / (phi * Mn), ok: Mu <= phi * Mn, b1, barA, sp, cover, ts, fc: fcd, fy };
  }

  /* moment of one load about the support at `oh` from the deck edge (the part of the load outside the support) */
  function loadM(L, oh) {
    if (L.q != null) { const a = clamp(Math.min(L.x0, L.x1), 0, oh), b = clamp(Math.max(L.x0, L.x1), 0, oh);
      return L.q * (Math.pow(Math.max(oh - a, 0), 2) - Math.pow(Math.max(oh - b, 0), 2)) / 2; }
    return L.w * Math.max(oh - L.x, 0);
  }
  /* overhang(o): the cantilever about the exterior girder centreline, per foot of deck. The wheel and the pedestrian load are taken together. */
  function overhang(o) {
    const oh = o.oh, face = o.face, wSlab = o.wSlab, eta = o.eta == null ? 1 : o.eta, mLL = o.mLL == null ? 1 : o.mLL;
    const part = L => ({ ...L, M: loadM(L, oh) });
    const DC = (o.DC || []).map(part), DW = (o.DW || []).map(part), PL = (o.PL || []).map(part);
    const Xoh = Math.max(oh - face - 1.0, 0);
    const SWoh = 45.0 + 10.0 * Xoh;
    const Mslab = wSlab * oh * oh / 2;
    let MohDC = Mslab; DC.forEach(L => { MohDC = MohDC + L.M; });
    let MohDW = 0; DW.forEach(L => { MohDW = MohDW + L.M; });
    let MohPL = 0; PL.forEach(L => { MohPL = MohPL + L.M; });
    const MohLL = 1.33 * 1.2 * 16 * Xoh / (SWoh / 12);
    const Mu_oh = eta * (1.25 * MohDC + 1.50 * MohDW + 1.75 * (mLL * Math.max(MohLL, 0) + MohPL));
    return { oh, face, wSlab, eta, mLL, Xoh, SWoh, Mslab, DC, DW, PL, MohDC, MohDW, MohDL: MohDC + MohDW, MohLL, MohPL, Mu_oh };
  }

  const distPct = S => Math.min(220 / Math.sqrt(S), 67);
  /* DD (2026-11-24): the effective span length of AASHTO LRFD 10th Ed. Art. 9.7.2.3 (slab supported on steel or concrete girders), the S of
     Art. 9.7.3.2: the clear distance between the flange tips, S - b_f/12, plus one flange overhang from the extreme flange tip to the face of
     the web, (b_f - t_w)/2 in = (b_f - t_w)/24 ft. b_f, t_w in; S, S_eff ft. 220/sqrt(S) = 67 at S = (220/67)^2 = 10.78 ft (SCAP). */
  const SCAP = Math.pow(220 / 67, 2);
  function effSpan(S, bf, tw) {
    const Sn = +S, b = +bf, t = +tw;
    const ok = isFinite(Sn) && Sn > 0 && isFinite(b) && b > 0 && isFinite(t) && t > 0 && t <= b;
    if (!ok) return { S: Sn, bf: b, tw: t, ok: false, clear: NaN, ohF: NaN, Seff: NaN };
    const clear = Sn - b / 12, ohF = (b - t) / 24, Seff = clear + ohF;
    return { S: Sn, bf: b, tw: t, ok: true, clear, ohF, Seff };
  }
  function distEff(o) {
    const E = effSpan(o.S, o.bf, o.tw), why = !E.ok ? 'geometry' : !(E.Seff > 0) ? 'nonpositive' : '';
    const pct = why ? 67 : distPct(E.Seff);
    return { ...E, pct, pct0: distPct(E.S), capped: pct === 67, why };
  }

  /* strip(inp): the whole deck design with the Prestressed module's inputs and result names (deckCalc). */
  function strip(inp) {
    const S = inp.S, ts = inp.ts, tsLoad = inp.tsLoad == null ? ts : inp.tsLoad, eta = inp.eta == null ? 1 : inp.eta, mLL = inp.mLL == null ? 1 : inp.mLL;
    const wDLslab = tsLoad / 12 * inp.wc, wDLws = +inp.wsFut;
    const I = interior({ S, wDC: wDLslab, wDW: wDLws, xneg: inp.xneg, eta, mLL });
    const cap = (barA, sp, cover, Mu) => capacity({ barA, sp, cover, ts, fc: inp.fc, fy: inp.fy, Mu });
    const pos = cap(+inp.barBot, +inp.sBot, +inp.coverB, I.Mu_pos), neg = cap(+inp.barTop, +inp.sTop, +inp.coverT, I.Mu_neg);
    const oh = +inp.oh, bBar = Math.max(+inp.bBar || 0, 0), bBarF = bBar / 12, Pbar = Math.max(+inp.wBar || 0, 0);
    const O = overhang({ oh, face: bBarF, wSlab: wDLslab, DC: [{ w: Pbar, x: bBarF / 2, name: 'Barrier' }], DW: [{ q: wDLws, x0: bBarF, x1: oh, name: 'Wearing surface' }], eta, mLL });
    const ohCap = cap(+inp.barTop, +inp.sTop, +inp.coverT, O.Mu_oh);
    return { wDLslab, wDLws, Ls: I.Ls, SWpos: I.SWpos, SWneg: I.SWneg, MDL_pos: I.MDL_pos, MDL_neg: I.MDL_neg, MLL_pos: I.MLL_pos, MLL_neg: I.MLL_neg, Mu_pos: I.Mu_pos, Mu_neg: I.Mu_neg,
      MDC_pos: I.MDC_pos, MDC_neg: I.MDC_neg, MDW_pos: I.MDW_pos, MDW_neg: I.MDW_neg, A4: I.A4, xneg: inp.xneg,
      pos, neg, oh, bBar, Pbar, Xoh: O.Xoh, SWoh: O.SWoh, MohDC: O.MohDC, MohDW: O.MohDW, MohDL: O.MohDL, MohLL: O.MohLL, Mu_oh: O.Mu_oh, ohCap, distPct: distPct(S), fcd: inp.fc, fy: inp.fy, ts,
      ...((eta !== 1 || mLL !== 1) ? { own: { eta, mLL } } : {}), interior: I, overhang: O };
  }

  /* ---------- worked steps (shared/steps.js): equation -> values -> result, the values those of the functions above ---------- */
  const St = () => window.SharedSteps;
  const own = r => (r.eta !== 1 || r.mLL !== 1);
  /* the Strength I expression with the owner's eta and m when either is not 1 */
  function muStep(r, id, label, sym, sfx, MDC, MDW, MLL, Mu, extra) {
    const n = St().n, o = own(r), eE = o ? '\\eta\\,\\left[' : '', eC = o ? '\\right]' : '', mE = o && r.mLL !== 1 ? 'm\\,' : '';
    const eV = o ? `${n(r.eta, 3)}\\,\\left[` : '', mV = o && r.mLL !== 1 ? `${n(r.mLL, 2)}\\,` : '';
    const pe = extra ? ` + ${extra.sym}` : '', pv = extra ? ` + ${n(extra.v, 3)}` : '';
    return { id, label, sym, eq: `${eE}1.25\\,M_{DC${sfx}} + 1.50\\,M_{DW${sfx}} + 1.75\\,${extra ? '\\left(' : ''}${mE}M_{LL${sfx}}${pe}${extra ? '\\right)' : ''}${eC}`,
      sub: `${eV}1.25(${n(MDC, 3)}) + 1.50(${n(MDW, 3)}) + 1.75(${mV}${n(MLL, 3)}${pv})${eC}`, value: Mu, unit: 'kip-ft/ft', d: 3, ref: ED + 'Table 3.4.1-1',
      note: o ? 'η and the owner\'s multiplier m on HL-93 (owner rules).' : '' };
  }
  const steps = {
    /* interior(w, r, o): r = interior(); o = { tL (dead-load slab thickness, in), wc (kcf), wDCnote, wDWsub (TeX of how w_DW is made), wDWnote,
       xs: { kind: 'steel' | 'precast' | 'box' | 'entered', b (in), xent, note } } */
    interior(w, r, o) {
      const n = St().n, S = r.S, T = r.A4, d = T.d;
      w.add({ id: 'wDC', label: 'Slab weight per square foot (DC)', sym: 'w_{DC}', eq: '\\frac{t}{12}\\,w_{c}', sub: `\\frac{${n(o.tL, 2)}}{12}(${n(o.wc, 3)})`, value: r.wDC, unit: 'ksf', d: 4, ref: ED + 'Art. 3.5.1', note: o.wDCnote || '' });
      w.add({ id: 'wDW', label: 'Wearing surface (DW)', sym: 'w_{DW}', eq: '', sub: o.wDWsub || '', value: r.wDW, unit: 'ksf', d: 4, ref: ED + 'Art. 3.5.1', note: o.wDWnote || '' });
      w.add({ id: 'MDCp', label: 'Slab moment, positive (continuous slab)', sym: 'M_{DC,pos}', eq: '\\frac{w_{DC}S^{2}}{11}', sub: `\\frac{${n(r.wDC, 4)}(${n(S, 3)})^{2}}{11}`, value: r.MDC_pos, unit: 'kip-ft/ft', d: 3, ref: 'Continuous-beam coefficient', note: 'S = the girder spacing, centre to centre.' });
      w.add({ id: 'MDWp', label: 'Wearing-surface moment, positive', sym: 'M_{DW,pos}', eq: '\\frac{w_{DW}S^{2}}{11}', sub: `\\frac{${n(r.wDW, 4)}(${n(S, 3)})^{2}}{11}`, value: r.MDW_pos, unit: 'kip-ft/ft', d: 3, ref: 'Continuous-beam coefficient' });
      w.add({ id: 'MDCn', label: 'Slab moment, negative', sym: 'M_{DC,neg}', eq: '\\frac{w_{DC}S^{2}}{10}', sub: `\\frac{${n(r.wDC, 4)}(${n(S, 3)})^{2}}{10}`, value: r.MDC_neg, unit: 'kip-ft/ft', d: 3, ref: 'Continuous-beam coefficient' });
      w.add({ id: 'MDWn', label: 'Wearing-surface moment, negative', sym: 'M_{DW,neg}', eq: '\\frac{w_{DW}S^{2}}{10}', sub: `\\frac{${n(r.wDW, 4)}(${n(S, 3)})^{2}}{10}`, value: r.MDW_neg, unit: 'kip-ft/ft', d: 3, ref: 'Continuous-beam coefficient' });
      const xs = o.xs || { kind: 'entered', xent: r.xneg }, b = +xs.b || 0, R6 = ED + 'Art. 4.6.2.1.6';
      if (xs.kind === 'steel') w.add({ id: 'xneg', label: 'Negative-moment design section from the girder centreline (steel I-girder: one quarter of the flange width)', sym: 'x', eq: '\\frac{b_{f}}{4}', sub: `\\frac{${n(b, 2)}}{4}`, value: r.xneg, unit: 'in', d: 2, ref: R6, note: xs.note || 'Kept within 0 to 24 in (Table A4-1).' });
      else if (xs.kind === 'box') w.add({ id: 'xneg', label: 'Negative-moment design section (closed box: the face of the support)', sym: 'x', eq: '\\frac{b}{2}', sub: `\\frac{${n(b, 2)}}{2}`, value: r.xneg, unit: 'in', d: 2, ref: R6, note: xs.note || 'Kept within 0 to 24 in (Table A4-1).' });
      else if (xs.kind === 'precast') w.add({ id: 'xneg', label: 'Negative-moment design section (precast I / open box: one third of the flange width, not more than 15 in)', sym: 'x', eq: '\\min\\left(\\frac{b_{tf}}{3},\\ 15\\right)', sub: `\\min\\left(\\frac{${n(b, 2)}}{3},\\ 15\\right)`, value: r.xneg, unit: 'in', d: 2, ref: R6, note: xs.note || '' });
      else w.add({ id: 'xneg', label: 'Negative-moment design section from the girder centreline (entered, 0 to 24 in)', sym: 'x', eq: '\\min(\\max(x_{ent}, 0), 24)', sub: `\\min(\\max(${n(+xs.xent || 0, 2)}, 0), 24)`, value: r.xneg, unit: 'in', d: 2, ref: R6, note: xs.note || '' });
      const Am = T.outOfRange ? (T.below ? ' S is below 4 ft: the 4 ft row is used.' : ' S is above 15 ft: the 15 ft row is used; a refined analysis is required.') : '';
      w.add({ id: 'MLLp', label: 'Live load + IM, positive (Table A4-1, interpolated on S)', sym: 'M_{LL,pos}', eq: 'M_{+}(S_{0}) + \\left(M_{+}(S_{1}) - M_{+}(S_{0})\\right)\\frac{S - S_{0}}{0.25}',
        sub: `${n(d.r0[1], 2)} + (${n(d.r1[1], 2)} - ${n(d.r0[1], 2)})\\frac{${n(T.Sused, 3)} - ${n(d.r0[0], 2)}}{0.25}`, value: r.MLL_pos, unit: 'kip-ft/ft', d: 3, ref: ED + 'Table A4-1',
        note: `Rows S_0 = ${n(d.r0[0], 2)} ft and S_1 = ${n(d.r1[0], 2)} ft. The tabulated values include the multiple presence factors and the 33 % dynamic load allowance: no further IM.${Am}` });
      w.add({ id: 'MLLn', label: 'Live load + IM, negative at the design section (Table A4-1, interpolated on S, then on x)', sym: 'M_{LL,neg}', eq: 'M_{-}(x_{j}) + \\left(M_{-}(x_{j+1}) - M_{-}(x_{j})\\right)\\frac{x - x_{j}}{x_{j+1} - x_{j}}',
        sub: `${n(d.row[2 + d.j], 3)} + (${n(d.row[3 + d.j], 3)} - ${n(d.row[2 + d.j], 3)})\\frac{${n(T.xUsed, 2)} - ${d.X[0]}}{${d.X[1]} - ${d.X[0]}}`, value: r.MLL_neg, unit: 'kip-ft/ft', d: 3, ref: ED + 'Table A4-1',
        note: `Columns x_j = ${d.X[0]} in and x_j+1 = ${d.X[1]} in of the row interpolated at S = ${n(T.Sused, 3)} ft.${T.xClamped ? ' x is above 24 in: 24 in is used.' : ''}` });
      w.add(muStep(r, 'Mup', 'Factored positive moment, Strength I', 'M_{u,pos}', ',pos', r.MDC_pos, r.MDW_pos, r.MLL_pos, r.Mu_pos));
      w.add(muStep(r, 'Mun', 'Factored negative moment, Strength I', 'M_{u,neg}', ',neg', r.MDC_neg, r.MDW_neg, r.MLL_neg, r.Mu_neg));
    },
    /* capacity(w, key, name, c, o): c = capacity(); key 'pos' | 'neg' | 'oh'; o = { muSym, check (text after the label of the ratio step), short: true (phi M_n and the ratio only) } */
    capacity(w, key, name, c, o) {
      const n = St().n; o = o || {};
      if (!o.short) {
        w.add({ id: key + '.As', label: `${name}: steel area per foot`, sym: 'A_{s}', eq: '\\frac{12\\,A_{b}}{s}', sub: `\\frac{12(${n(c.barA, 2)})}{${n(c.sp, 2)}}`, value: c.As, unit: 'in^{2}/ft', d: 3, note: c.sp > 0 ? '' : 'Spacing 0: no steel is credited (an input error).' });
        w.add({ id: key + '.d', label: `${name}: effective depth`, sym: 'd', eq: 't_{s} - c_{c} - \\frac{d_{b}}{2}', sub: `${n(c.ts, 2)} - ${n(c.cover, 2)} - \\frac{${n(c.dbar, 3)}}{2}`, value: c.dEff, unit: 'in', d: 2, note: `d_b = √(4A_b/π) = ${n(c.dbar, 3)} in, the equivalent bar diameter; c_c the clear cover.` });
        w.add({ id: key + '.a', label: `${name}: depth of the compression block`, sym: 'a', eq: '\\frac{A_{s}\\,f_{y}}{0.85\\,f^{\\prime}_{c}\\,(12)}', sub: `\\frac{${n(c.As, 3)}(${n(c.fy, 0)})}{0.85(${n(c.fc, 2)})(12)}`, value: c.a, unit: 'in', d: 3, ref: ED + 'Art. 5.6.3.1.1, 5.6.2.2' });
        w.add({ id: key + '.c', label: `${name}: neutral axis depth`, sym: 'c', eq: '\\frac{a}{\\beta_{1}}', sub: `\\frac{${n(c.a, 3)}}{${n(c.b1, 3)}}`, value: c.c, unit: 'in', d: 3, ref: ED + 'Art. 5.6.2.2', note: `β_1 = 0.85 − 0.05(f′_c − 4), within 0.65 to 0.85: ${n(c.b1, 3)}.` });
        w.add({ id: key + '.et', label: `${name}: net tensile strain`, sym: '\\varepsilon_{t}', eq: '0.003\\left(\\frac{d}{c} - 1\\right)', sub: `0.003\\left(\\frac{${n(c.dEff, 3)}}{${n(c.c, 3)}} - 1\\right)`, value: c.et, unit: '', d: 5, ref: ED + 'Art. 5.6.2.1' });
        w.add({ id: key + '.phi', label: `${name}: resistance factor (nonprestressed)`, sym: '\\phi', eq: '0.75 + 0.15\\,\\frac{\\varepsilon_{t} - 0.002}{0.003}', sub: `0.75 + 0.15\\,\\frac{${n(c.et, 5)} - 0.002}{0.003}`, value: c.phi, unit: '', d: 3, ref: ED + 'Art. 5.5.4.2', note: 'Within 0.75 (compression-controlled) to 0.90 (tension-controlled).' });
        w.add({ id: key + '.Mn', label: `${name}: nominal resistance`, sym: 'M_{n}', eq: '\\frac{A_{s}\\,f_{y}(d - a/2)}{12}', sub: `\\frac{${n(c.As, 3)}(${n(c.fy, 0)})(${n(c.dEff, 3)} - ${n(c.a, 3)}/2)}{12}`, value: c.Mn, unit: 'kip-ft/ft', d: 3, ref: ED + 'Eq. 5.6.3.2.3-1' });
      }
      w.add({ id: key + '.phiMn', label: `${name}: factored resistance`, sym: '\\phi M_{n}', eq: '\\phi\\,M_{n}', sub: `${n(c.phi, 3)}(${n(c.Mn, 3)})`, value: c.phiMn, unit: 'kip-ft/ft', d: 3, ref: ED + 'Art. 5.6.3.2.1', note: o.short ? (o.shortNote || 'The same bars, cover and depth as the negative moment.') : '' });
      w.add({ id: key + '.r', label: `${o.check || name}`, sym: `${o.muSym || 'M_{u}'} \\le \\phi M_{n}`, eq: '', sub: `${n(c.Mu, 3)} ${c.ok ? '\\le' : '\\gt'} ${n(c.phiMn, 3)}`, value: c.dc, unit: '', d: 3, ref: ED + 'Art. 5.6.3.2.1', ok: c.ok });
    },
    /* overhang(w, r, o): r = overhang(); o = { ohNote, faceNote, slabNote } */
    overhang(w, r, o) {
      const n = St().n; o = o || {};
      const term = L => (L.q != null ? `\\frac{${n(L.q, 4)}\\left[(${n(Math.max(r.oh - Math.min(Math.max(Math.min(L.x0, L.x1), 0), r.oh), 0), 3)})^{2} - (${n(Math.max(r.oh - Math.min(Math.max(Math.max(L.x0, L.x1), 0), r.oh), 0), 3)})^{2}\\right]}{2}`
        : `${n(L.w, 3)}(${n(Math.max(r.oh - L.x, 0), 3)})`);
      const names = A => A.map(L => `${L.name || 'load'}: ${L.q != null ? `${n(L.q, 4)} ksf from ${n(Math.min(L.x0, L.x1), 2)} to ${n(Math.max(L.x0, L.x1), 2)} ft` : `${n(L.w, 3)} klf at ${n(L.x, 2)} ft`} from the deck edge, M = ${n(L.M, 3)}`).join('; ');
      w.add({ id: 'X', label: 'Overhang: wheel 1 ft from the traffic face, distance to the girder centreline', sym: 'X', eq: '\\max\\left(o_{h} - x_{f} - 1.0,\\ 0\\right)', sub: `\\max\\left(${n(r.oh, 3)} - ${n(r.face, 3)} - 1.0,\\ 0\\right)`, value: r.Xoh, unit: 'ft', d: 3, ref: ED + 'Art. 3.6.1.3.1',
        note: o.faceNote || 'o_h = the deck overhang from the exterior girder centreline, x_f = the deck edge to the traffic face.' });
      w.add({ id: 'SWoh', label: 'Overhang: equivalent strip width', sym: 'SW_{oh}', eq: '45.0 + 10.0\\,X', sub: `45.0 + 10.0(${n(r.Xoh, 3)})`, value: r.SWoh, unit: 'in', d: 1, ref: ED + 'Table 4.6.2.1.3-1' });
      w.add({ id: 'MohDC', label: 'Overhang: slab and attached dead load moment (DC)', sym: 'M_{DC,oh}', eq: '\\frac{w_{DC}\\,o_{h}^{2}}{2} + \\sum w_{i}\\,(o_{h} - x_{i})', sub: [`\\frac{${n(r.wSlab, 4)}(${n(r.oh, 3)})^{2}}{2}`].concat(r.DC.map(term)).join(' + '), value: r.MohDC, unit: 'kip-ft/ft', d: 3, ref: 'Statics',
        note: (r.DC.length ? names(r.DC) + '. ' : '') + (o.slabNote || 'Each load at its distance from the girder centreline; a load inside the girder centreline has no arm.') });
      w.add({ id: 'MohDW', label: 'Overhang: wearing-surface moment (DW)', sym: 'M_{DW,oh}', eq: '\\sum \\frac{q_{i}\\left[(o_{h} - x_{0})^{2} - (o_{h} - x_{1})^{2}\\right]}{2}', sub: r.DW.length ? r.DW.map(term).join(' + ') : '0', value: r.MohDW, unit: 'kip-ft/ft', d: 4, ref: 'Statics',
        note: r.DW.length ? names(r.DW) + '.' : 'No wearing surface on the overhang.' });
      w.add({ id: 'MohLL', label: 'Overhang: wheel moment on the strip (16 kip wheel, IM 1.33, multiple presence 1.20)', sym: 'M_{LL,oh}', eq: '\\frac{1.33(1.20)(16)\\,X}{SW_{oh}/12}', sub: `\\frac{1.33(1.20)(16)(${n(r.Xoh, 3)})}{${n(r.SWoh, 1)}/12}`, value: r.MohLL, unit: 'kip-ft/ft', d: 3, ref: ED + 'Art. 3.6.1.2.2, 3.6.2, 3.6.1.1.2' });
      if (r.PL.length) w.add({ id: 'MohPL', label: 'Overhang: pedestrian load moment', sym: 'M_{PL,oh}', eq: '\\sum \\frac{q_{i}\\left[(o_{h} - x_{0})^{2} - (o_{h} - x_{1})^{2}\\right]}{2}', sub: r.PL.map(term).join(' + '), value: r.MohPL, unit: 'kip-ft/ft', d: 3, ref: ED + 'Art. 3.6.1.6',
        note: names(r.PL) + '. Taken with the wheel; no dynamic load allowance, no multiple presence factor and no owner multiplier on the pedestrian load.' });
      w.add({ ...muStep(r, 'Muoh', 'Overhang: factored moment, Strength I (gravity loads only)', 'M_{u,oh}', ',oh', r.MohDC, r.MohDW, Math.max(r.MohLL, 0), r.Mu_oh, r.PL.length ? { sym: 'M_{PL,oh}', v: r.MohPL } : null),
        note: 'The Extreme Event II vehicular-collision cases (A13.4) need a barrier-specific analysis: not checked here.' + (own(r) ? ' η and the owner\'s multiplier m on HL-93 (owner rules).' : '') });
    },
    /* dist(w, S, pct, o): o = { As (the positive-moment steel, in^2/ft), note, eff (a distEff() result: the effective span of Art. 9.7.2.3
       is worked first and the percentage uses it; DD 2026-11-24), effNote, sym: { bf, tw } (TeX names of the flange width and web thickness) } */
    dist(w, S, pct, o) {
      const n = St().n; o = o || {};
      const E = o.eff;
      if (E) {
        const sb = (o.sym && o.sym.bf) || 'b_{f}', st = (o.sym && o.sym.tw) || 't_{w}';
        if (E.ok) w.add({ id: 'distSe', label: 'Effective span length of the slab: the distance between the flange tips plus one flange overhang (flange tip to the face of the web)', sym: 'S_{eff}',
          eq: `S - \\frac{${sb}}{12} + \\frac{${sb} - ${st}}{24}`, sub: `${n(E.S, 3)} - \\frac{${n(E.bf, 3)}}{12} + \\frac{${n(E.bf, 3)} - ${n(E.tw, 4)}}{24}`, value: E.Seff, unit: 'ft', d: 3,
          ref: ED + 'Art. 9.7.2.3, 9.7.3.2', note: (o.effNote ? o.effNote + ' ' : '') + 'S the girder spacing (ft); flange width and web thickness in inches; fillets disregarded.' + (E.why === 'nonpositive' ? ' S_eff is not positive (check the inputs): the 67 % upper limit is used.' : '') });
        const cap = !!E.why;
        w.add({ id: 'dist', label: 'Distribution reinforcement, percent of the positive-moment steel', sym: 'p_{d}', eq: cap ? '67' : '\\min\\left(\\frac{220}{\\sqrt{S_{eff}}},\\ 67\\right)',
          sub: cap ? '67' : `\\min\\left(\\frac{220}{\\sqrt{${n(E.Seff, 3)}}},\\ 67\\right)`, value: pct, unit: '', d: 1, ref: ED + 'Art. 9.7.3.2',
          note: o.note || (cap ? 'No flange width and web thickness for the effective span: the upper limit of 67 % is used (conservative).' : 'S_eff in ft (Art. 9.7.2.3). Bottom bars parallel to the girders.') });
        if (o.As != null) w.add({ id: 'distAs', label: 'Distribution reinforcement, area per foot of deck width', sym: 'A_{s,d}', eq: '\\frac{p_{d}}{100}\\,A_{s,pos}', sub: `\\frac{${n(pct, 1)}}{100}(${n(o.As, 3)})`, value: pct / 100 * o.As, unit: 'in^{2}/ft', d: 3, ref: ED + 'Art. 9.7.3.2' });
        return;
      }
      w.add({ id: 'dist', label: 'Distribution reinforcement, percent of the positive-moment steel', sym: 'p_{d}', eq: '\\min\\left(\\frac{220}{\\sqrt{S}},\\ 67\\right)', sub: `\\min\\left(\\frac{220}{\\sqrt{${n(S, 3)}}},\\ 67\\right)`, value: pct, unit: '', d: 1, ref: ED + 'Art. 9.7.3.2',
        note: o.note || 'S in ft, taken as the girder spacing. Bottom bars parallel to the girders.' });
      if (o.As != null) w.add({ id: 'distAs', label: 'Distribution reinforcement, area per foot of deck width', sym: 'A_{s,d}', eq: '\\frac{p_{d}}{100}\\,A_{s,pos}', sub: `\\frac{${n(pct, 1)}}{100}(${n(o.As, 3)})`, value: pct / 100 * o.As, unit: 'in^{2}/ft', d: 3, ref: ED + 'Art. 9.7.3.2' });
    }
  };

  window.SharedDeck = { A4_X, A4, tableA4, designSection, interior, capacity, overhang, distPct, SCAP, effSpan, distEff, strip, steps, clamp };
})();
