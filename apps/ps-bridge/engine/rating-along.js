/* apps/ps-bridge/engine/rating-along.js — the HL-93 design-load rating at every analysis station of the girder (window.PSBRatingAlong).
   Classic script, no DOM. Created 2026-11-15 (batch E1, review finding O17: the Steel Bridge app rates every location, this app rated only
   the engine's governing stations and called it a screening). An app-side addition after computeAll, as engine/holddown.js: the frozen
   engine (engine/pbd-*.js) is not changed; every demand and capacity is the engine's own value at its own stations (R.flexFull, R.grid,
   R.diagrams, R.shearDiag, R.shear, R.cont, R.rating, R.shrRating, R.svcRating), and only the rating factor is formed here.

   Code: AASHTO Manual for Bridge Evaluation (MBE), 4th Edition (2026), Section 6, Part A (LRFR), the articles checked in that edition on
   2026-11-15 (paraphrased):
     - Art. 6A.4.2.1, Eq. 6A.4.2.1-1: RF = (C − γ_DC DC − γ_DW DW ± γ_P P) / (γ_LL (LL + IM)); Eq. 6A.4.2.1-2 C = φ_c φ_s φ R_n at the
       strength limit states, with the lower limit φ_c φ_s ≥ 0.85 (Eq. 6A.4.2.1-3); Eq. 6A.4.2.1-4 C = f_R at the service limit states. The
       rating is carried out at each applicable limit state and load effect, and the lowest value is the controlling rating factor (the
       basis of rating every station). Load modifiers η are not part of the rating equation (C6A.4.2.1): none is applied here (as the engine).
     - Table 6A.4.2.2-1 (prestressed concrete): Strength I γ_DC 1.25, γ_DW 1.50, γ_LL 1.75 inventory / 1.35 operating; Service III γ_DC =
       γ_DW = 1.00 with γ_LL of Table 6A.4.2.2-2 (0.8 for components rated without the refined losses and elastic gains: f_pe here has
       no elastic gains, as the engine).
     - Art. 6A.5.4.1: Strength I and Service III are checked for prestressed concrete components at the design-load rating; Service III
       is a design-level (inventory) check (C6A.5.4.1), so it has no operating value here; Strength I only for reinforced concrete (the
       continuity region over a pier, where the deck bars carry the negative moment: no Service III rating there).
     - Art. 6A.5.3: φ as in LRFD Art. 5.5.4.2 (the engine's φ of each capacity). Art. 6A.5.8: shear by the LRFD general procedure (the
       engine's MCFT φV_n at each station).
     - Art. 6A.5.10: temperature, creep and shrinkage effects need not typically be considered in the rating (the continuity restraint
       moments of LRFD 5.12.3.3 are not in the rating, as in the engine's own rating; they are in the design checks).
   The factors and capacities are those of the engine's rating (pbd-compute.js "Load rating (LRFR, MBE)"): φ_c φ_s = R.rating.phiCS
   (applied to flexure and to shear, as the engine), γ as above.

   What is rated, at every station (the engine's 61-point grid plus the transfer-length points; L = the design span):
     flexP  positive flexure, every station with a positive HL-93 moment: C = φ_c φ_s φM_n (R.flexFull φM_n, the strength check's),
            DC = M_g + M_DC1 + M_DC2, DW = M_DW, LL = M_LL+IM positive. The engine's own flexure rating is the lowest of these (the same
            stations and expression), so its governing value is unchanged.
     flexN  negative flexure (continuity on, R.cont): the stations of the half span next to an interior support (the region of the
            engine's continuity checks) with a negative HL-93 moment: C = φ_c φ_s φM_n,neg (R.cont.phiMnN: the pier section, the deck
            bars A_s in tension and the girder bottom flange in compression; the same section and bars over the region: no bar cut-off
            is an input, as the Flexure tab draws it). Each dead-load moment acts in the hogging sense or against it: one that adds to
            the negative moment takes γ_DC 1.25 / γ_DW 1.50, one that relieves it takes the LRFD minimum γ_p (10th Ed. Table 3.4.1-2:
            DC 0.90, DW 0.65), the noncomposite part (girder + DC1, simple span, always sagging) and DC2 each on its own.
     shear  every grid station from the critical section (the engine's first shear station past the bearing, LRFD 5.7.3.2) to its mirror:
            C = φ_c φ_s φV_n (R.shearDiag φV_n, the engine's shear capacity along the span), DC = |V_DC|, DW = |V_DW|, LL = the engine's
            HL-93 shear envelope magnitude at x; plus the engine's own governing shear section (R.shrRating) where it is not a grid
            station. The engine's shear rating is one of these rows, so the lowest can only be the same or lower.
     s3     Service III bottom-fibre tension, every grid station with live-load tension (f_LL > 1e-6 ksi; below, a round-off live load at a support): C = f_r, RF = (f_r + f_ps − f_DC − f_DW)/(0.8 f_LL),
            f_ps = P_e/A + P_e e/S_b, P_e = A_ps f_pe at the station, f_DC = (M_g + M_DC1)/S_b + M_DC2/S_bc, f_DW = M_DW/S_bc,
            f_LL = M_LL+/S_bc (the engine's svcRating expressions at each station). The engine's Service III rating is one of these rows.
   The legal / permit vehicles (entered factored M and V, with no station) stay where the engine rates them (Rating tab).

   API
     of(R) -> A | null      (memoised on R) A = { rows, gov: { flexP, flexN, shear, s3 } (the row with the lowest inventory RF of each),
                            inv (the lowest inventory row of all), opr (the lowest operating row: flexure and shear), phiCS, negNote }
       row = { i (index in rows), kind, x, name, C, DC, DW, LL, unit, inv, opr (null for s3), src ('grid' | 'engine'), parts }
     steps(A, row, prefix) -> SharedSteps steps that work the row (ids prefix + '.' + C | DC | DW | LL | RFinv | RFopr | …)
     govSteps(A) -> the steps of each group's governing row (ids rt.al.fp.*, rt.al.fn.*, rt.al.v.*, rt.al.s3.*)
     GROUPS: [[kind, title, step prefix]]; MBE (the edition string). Units: kip-ft, kip, ksi. */
(function () {
  'use strict';
  const MBE = 'MBE 4th Ed. (2026)', A10 = 'AASHTO LRFD 10th Ed. ';
  const GROUPS = [['flexP', 'Flexure, positive moment (Strength I)', 'fp'], ['flexN', 'Flexure, negative moment over the pier (Strength I)', 'fn'],
    ['shear', 'Shear (Strength I)', 'v'], ['s3', 'Service III, bottom-fibre tension (inventory)', 's3']];
  const memo = new WeakMap();
  const fin = v => typeof v === 'number' && isFinite(v);
  const St = () => window.SharedSteps;

  function of(R) {
    if (!R || R.error || !R.rating || !R.flexFull) return null;
    if (memo.has(R)) return memo.get(R);
    let A = null; try { A = build(R); } catch (e) { A = null; }
    memo.set(R, A); return A;
  }

  function build(R) {
    const L = R.L, cs = R.rating.phiCS, rows = [];
    const nm = x => `x = ${x.toFixed(2)} ft (${(x / L).toFixed(3)} L)`;
    // ---- flexure, positive: the engine's own rating expression at each R.flexFull station (pbd-compute.js rateAt; same order of operations)
    R.flexFull.forEach(r => {
      const ll = r.mLLpos; if (!(ll > 1e-6) || !(r.phiMn > 0)) return;
      const Rn = r.phiMn / 12, DC = r.mSW + r.mDC1 + r.mDC2, DW = r.mDW, cap = cs * Rn - 1.25 * DC - 1.50 * DW;
      rows.push({ kind: 'flexP', x: r.x, name: nm(r.x), C: cs * Rn, DC, DW, LL: ll, unit: 'kip-ft', inv: cap / (1.75 * ll), opr: cap / (1.35 * ll), src: 'grid',
        parts: { Rn, mSW: r.mSW, mDC1: r.mDC1, mDC2: r.mDC2, cap } });
    });
    // ---- flexure, negative: continuity on (R.cont), the half span next to an interior support
    const c = R.cont, U = c && c.unit;
    let negNote = '';
    const hasNeg = R.flexFull.some(r => r.mLLneg < -1e-6);
    if (c && U && Array.isArray(U.spans)) {
      const nS = U.spans.length, near = x => (U.s > 1 && x <= L / 2 + 1e-9) || (U.s < nS && x >= L / 2 - 1e-9), Rn = c.phiMnN / 12;
      R.flexFull.forEach(r => {
        const ll = -r.mLLneg; if (!(ll > 1e-6) || !near(r.x)) return;
        const hNC = -(r.mSW + r.mDC1), h2 = -r.mDC2, hW = -r.mDW;   // hogging positive
        const gNC = hNC > 0 ? 1.25 : 0.90, g2 = h2 > 0 ? 1.25 : 0.90, gW = hW > 0 ? 1.50 : 0.65;
        const D = gNC * hNC + g2 * h2 + gW * hW, cap = cs * Rn - D;
        rows.push({ kind: 'flexN', x: r.x, name: nm(r.x), C: cs * Rn, DC: hNC + h2, DW: hW, LL: ll, unit: 'kip-ft', inv: cap / (1.75 * ll), opr: cap / (1.35 * ll), src: 'grid',
          parts: { Rn, hNC, h2, hW, gNC, g2, gW, D, cap, mSW: r.mSW, mDC1: r.mDC1 } });
      });
    } else if (hasNeg) negNote = 'The live load gives negative moments but continuity is off (Loads tab): no negative-moment capacity (deck bars) is entered, so the negative moment is not rated.';
    // ---- shear: grid stations from the critical section to its mirror (R.shearDiag φV_n; components from R.diagrams)
    const shN = (R.shear || []).filter(q => !q.isBearing), xc0 = shN.length ? Math.min(...shN.map(q => q.x)) : 0, xc1 = shN.length ? Math.max(...shN.map(q => q.x)) : L;
    const D = R.diagrams || [], SD = R.shearDiag || [], sym = !R.useExt && !R.fe;   // the simple-span built-in shear envelope is symmetric (|V| from the nearer support)
    const mirror = x => D.reduce((b, q, j) => Math.abs(q.x - (L - x)) < Math.abs(D[b].x - (L - x)) ? j : b, 0);
    const vll = j => Math.max(Math.abs(D[j].V_LLpos), Math.abs(D[j].V_LLneg));
    const sh = R.shrRating; let shOnGrid = false;
    D.forEach((dg, j) => {
      const x = dg.x; if (x < xc0 - 1e-9 || x > xc1 + 1e-9 || !SD[j]) return;
      const isEng = sh && Math.abs(x - sh.x) < 1e-9;
      if (isEng) shOnGrid = true;
      const phiVn = isEng ? sh.phiVn : SD[j].phiVn, VDC = isEng ? sh.VDC : Math.abs(dg.V_DC), VDW = isEng ? sh.VDW : Math.abs(dg.V_DW),
        VLL = isEng ? sh.VLL : (sym ? Math.max(vll(j), vll(mirror(x))) : vll(j));
      const cap = cs * phiVn - 1.25 * VDC - 1.50 * VDW;
      rows.push({ kind: 'shear', x, name: nm(x) + (isEng ? ': the engine\'s governing shear section' : ''), C: cs * phiVn, DC: VDC, DW: VDW, LL: VLL, unit: 'kip',
        inv: VLL > 1e-6 ? cap / (1.75 * VLL) : null, opr: VLL > 1e-6 ? cap / (1.35 * VLL) : null, src: isEng ? 'engine' : 'grid', parts: { phiVn, cap, eng: isEng } });
    });
    if (sh && !shOnGrid) {
      const cap = cs * sh.phiVn - 1.25 * sh.VDC - 1.50 * sh.VDW;
      rows.push({ kind: 'shear', x: sh.x, name: nm(sh.x) + ': the engine\'s governing shear section', C: cs * sh.phiVn, DC: sh.VDC, DW: sh.VDW, LL: sh.VLL, unit: 'kip',
        inv: sh.VLL > 1e-6 ? cap / (1.75 * sh.VLL) : null, opr: sh.VLL > 1e-6 ? cap / (1.35 * sh.VLL) : null, src: 'engine', parts: { phiVn: sh.phiVn, cap, eng: true } });
    }
    // ---- Service III: every grid station with live-load tension at the bottom fibre (the engine's svcRating expressions)
    const sv = R.svcRating, G = R.g, cp = R.cp, fr = sv ? sv.fr : NaN;
    (R.grid || []).forEach((q, j) => {
      const dg = D[j]; if (!dg || !sv) return;
      const isEng = q.x === sv.x;
      const fLL = isEng ? sv.fLL : q.Mll / cp.Sbc; if (!(fLL > 1e-6)) return;   // no live-load tension (1e-6 ksi: a round-off LL at a support, e.g. 1.6E-14, gives a meaningless RF)
      const Pe = q.Aps * R.fpe, fPS = isEng ? sv.fPS : Pe / G.A + Pe * q.e / G.Sb, fDC = isEng ? sv.fDC : (q.Mg + q.Mdk) / G.Sb + dg.M_DC2 * 12 / cp.Sbc, fDW = isEng ? sv.fDW : dg.M_DW * 12 / cp.Sbc;
      const inv = isEng ? sv.RF : (fr + fPS - 1.0 * fDC - 1.0 * fDW) / (0.8 * fLL);
      rows.push({ kind: 's3', x: q.x, name: nm(q.x) + (isEng ? ': the engine\'s governing Service III section' : ''), C: fr, DC: fDC, DW: fDW, LL: fLL, unit: 'ksi', inv, opr: null, src: isEng ? 'engine' : 'grid',
        parts: { fPS, Pe, Aps: q.Aps, e: q.e, Mnc: q.Mg + q.Mdk, M_DC2: dg.M_DC2, M_DW: dg.M_DW, Mll: q.Mll } });
    });
    const order = { flexP: 0, flexN: 1, shear: 2, s3: 3 };
    rows.sort((a, b) => a.x - b.x || order[a.kind] - order[b.kind]);
    rows.forEach((r, i) => { r.i = i; });
    const low = (list, k) => list.filter(r => fin(r[k])).reduce((b, r) => (!b || r[k] < b[k] ? r : b), null);
    const gov = {}; GROUPS.forEach(([k]) => { gov[k] = low(rows.filter(r => r.kind === k), 'inv'); });
    return { rows, gov, inv: low(rows, 'inv'), opr: low(rows.filter(r => r.kind !== 's3'), 'opr'), phiCS: cs, phiC: R.rating.phiC, phiS: R.rating.phiS, negNote, L, xc: [xc0, xc1], sec: { gA: G.A, gSb: G.Sb, Sbc: cp.Sbc } };
  }

  /* steps(A, q, prefix): the rating of row q worked out (equation, substituted values, result), its inputs named with the tab that works them */
  function steps(A, q, prefix) {
    const w = St().work(prefix), n = (x, d) => St().n(x, d), p = q.parts, cs = A.phiCS, at = `x = ${n(q.x, 2)} ft`;
    const csN = `φ_c φ_s = ${n(cs, 3)} (Condition and system factors above: φ_c = ${n(A.phiC, 2)}, φ_s = ${n(A.phiS, 2)}, MBE 4th Ed. Eq. 6A.4.2.1-3 lower limit 0.85; the engine caps the product at 1.00)`;
    const RF = (g, lbl, v) => ({ id: 'RF' + lbl, label: `${lbl === 'inv' ? 'Inventory' : 'Operating'} rating factor (γ_LL = ${g})`, sym: `RF_{${lbl}}`, value: v, unit: '', d: 3, ok: v >= 1, ref: `${MBE} Eq. 6A.4.2.1-1; Table 6A.4.2.2-1` });
    if (q.kind === 'flexP') {
      w.add({ id: 'C', label: `Capacity at ${at}: φ_c φ_s φM_n`, sym: 'C', eq: '\\phi_{c}\\phi_{s}\\,\\phi M_{n}', sub: `${n(cs, 3)}(${n(p.Rn, 1)})`, value: q.C, unit: 'kip-ft', d: 1, ref: `${MBE} Eq. 6A.4.2.1-2; Art. 6A.5.3`,
        note: `φM_n: the Strength I flexure check's at this station (Flexure tab; ${A10}5.6.3.2, φ by 5.5.4.2). ${csN}.` });
      w.add({ id: 'DC', label: 'Dead load, structural components (girder, DC1, DC2)', sym: 'M_{DC}', eq: 'M_{g} + M_{DC1} + M_{DC2}', sub: `${n(p.mSW, 1)} + ${n(p.mDC1, 1)} + ${n(p.mDC2, 1)}`, value: q.DC, unit: 'kip-ft', d: 1, note: 'Analysis tab (the engine\'s component moments at this station).' });
      w.add({ id: 'DW', label: 'Dead load, wearing surface', sym: 'M_{DW}', value: q.DW, unit: 'kip-ft', d: 1, note: 'Analysis tab.' });
      w.add({ id: 'LL', label: 'Live load, HL-93 positive moment with IM and DF', sym: 'M_{LL+IM}', value: q.LL, unit: 'kip-ft', d: 1, note: 'Analysis tab (the positive envelope).' });
      const e = '\\frac{C - \\gamma_{DC}M_{DC} - \\gamma_{DW}M_{DW}}{\\gamma_{LL}\\,M_{LL+IM}}', s = g => `\\frac{${n(q.C, 1)} - 1.25(${n(q.DC, 1)}) - 1.50(${n(q.DW, 1)})}{${g}(${n(q.LL, 1)})}`;
      w.add({ ...RF('1.75', 'inv', q.inv), eq: e, sub: s('1.75'), note: 'γ_DC = 1.25, γ_DW = 1.50, Strength I.' });
      w.add({ ...RF('1.35', 'opr', q.opr), eq: e, sub: s('1.35') });
    } else if (q.kind === 'flexN') {
      w.add({ id: 'C', label: `Capacity at ${at}: φ_c φ_s φM_n,neg`, sym: 'C', eq: '\\phi_{c}\\phi_{s}\\,\\phi M_{n,neg}', sub: `${n(cs, 3)}(${n(p.Rn, 1)})`, value: q.C, unit: 'kip-ft', d: 1, ref: `${MBE} Eq. 6A.4.2.1-2; Art. 6A.5.3`,
        note: `φM_n,neg: the pier section of the continuity check (Flexure tab, pier section: the deck bars A_s in tension, the girder bottom flange in compression; ${A10}5.6.3.2, φ by 5.5.4.2), taken over the region next to the pier (the same section and bars: no cut-off point is an input). ${csN}.` });
      w.add({ id: 'DCnc', label: 'Noncomposite dead load (girder + DC1, simple span), hogging sense', sym: 'M_{DC,nc}', eq: '-(M_{g} + M_{DC1})', sub: `-(${n(p.mSW, 1)} + ${n(p.mDC1, 1)})`, value: p.hNC, unit: 'kip-ft', d: 1,
        note: `Hogging positive. ${p.hNC > 0 ? 'Adds to the negative moment: γ_DC = 1.25.' : 'Relieves the negative moment: γ = 0.90, the minimum load factor for DC (' + A10 + 'Table 3.4.1-2).'}` });
      w.add({ id: 'DC2', label: 'Composite dead load DC2 (continuous unit), hogging sense', sym: 'M_{DC2}', eq: '-M_{DC2}', sub: `-(${n(-p.h2, 1)})`, value: p.h2, unit: 'kip-ft', d: 1,
        note: `${p.h2 > 0 ? 'Adds: γ_DC = 1.25.' : 'Relieves: γ = 0.90 (' + A10 + 'Table 3.4.1-2).'} Analysis tab.` });
      w.add({ id: 'DW', label: 'Wearing surface DW (continuous unit), hogging sense', sym: 'M_{DW}', eq: '-M_{DW}', sub: `-(${n(-p.hW, 1)})`, value: p.hW, unit: 'kip-ft', d: 1,
        note: `${p.hW > 0 ? 'Adds: γ_DW = 1.50.' : 'Relieves: γ = 0.65, the minimum load factor for DW (' + A10 + 'Table 3.4.1-2).'}` });
      w.add({ id: 'D', label: 'Factored dead load, hogging sense', sym: 'D_{u}', eq: '\\gamma_{nc}M_{DC,nc} + \\gamma_{2}M_{DC2} + \\gamma_{w}M_{DW}', sub: `${n(p.gNC, 2)}(${n(p.hNC, 1)}) + ${n(p.g2, 2)}(${n(p.h2, 1)}) + ${n(p.gW, 2)}(${n(p.hW, 1)})`, value: p.D, unit: 'kip-ft', d: 1, ref: `${MBE} Table 6A.4.2.2-1` });
      w.add({ id: 'LL', label: 'Live load, HL-93 negative moment with IM and DF (magnitude)', sym: 'M_{LL+IM}', value: q.LL, unit: 'kip-ft', d: 1, note: 'Analysis tab (the negative envelope on the continuous unit).' });
      const e = '\\frac{C - D_{u}}{\\gamma_{LL}\\,M_{LL+IM}}', s = g => `\\frac{${n(q.C, 1)} - (${n(p.D, 1)})}{${g}(${n(q.LL, 1)})}`;
      w.add({ ...RF('1.75', 'inv', q.inv), eq: e, sub: s('1.75'), note: 'The continuity restraint moments are not in the rating (MBE 4th Ed. Art. 6A.5.10, as the engine\'s rating).' });
      w.add({ ...RF('1.35', 'opr', q.opr), eq: e, sub: s('1.35') });
    } else if (q.kind === 'shear') {
      w.add({ id: 'C', label: `Capacity at ${at}: φ_c φ_s φV_n`, sym: 'C', eq: '\\phi_{c}\\phi_{s}\\,\\phi V_{n}', sub: `${n(cs, 3)}(${n(p.phiVn, 1)})`, value: q.C, unit: 'kip', d: 1, ref: `${MBE} Eq. 6A.4.2.1-2; Art. 6A.5.8`,
        note: `φV_n: the engine's general-procedure (MCFT) shear resistance at this station (${p.eng ? 'the Shear tab\'s governing section' : 'the Shear tab\'s chart of φV_n along the span'}; ${A10}5.7.3.3, 5.7.3.4.2). ${csN}; the engine applies φ_c φ_s to shear (MBE 4th Ed. Art. 6A.4.2.4 takes φ_s = 1.0 for shear: see the Rating tab note).` });
      w.add({ id: 'DC', label: 'Dead-load shear, structural components', sym: 'V_{DC}', eq: '\\left|V_{g} + V_{DC1} + V_{DC2}\\right|', value: q.DC, unit: 'kip', d: 1, note: 'Analysis tab.' });
      w.add({ id: 'DW', label: 'Dead-load shear, wearing surface', sym: 'V_{DW}', eq: '\\left|V_{DW}\\right|', value: q.DW, unit: 'kip', d: 1, note: 'Analysis tab.' });
      w.add({ id: 'LL', label: 'Live-load shear, HL-93 envelope with IM and DF', sym: 'V_{LL+IM}', value: q.LL, unit: 'kip', d: 1, note: 'Analysis tab (the larger magnitude of the two envelopes; a simple span: from the nearer support).' });
      const e = '\\frac{C - \\gamma_{DC}V_{DC} - \\gamma_{DW}V_{DW}}{\\gamma_{LL}\\,V_{LL+IM}}', s = g => `\\frac{${n(q.C, 1)} - 1.25(${n(q.DC, 1)}) - 1.50(${n(q.DW, 1)})}{${g}(${n(q.LL, 1)})}`;
      if (fin(q.inv)) { w.add({ ...RF('1.75', 'inv', q.inv), eq: e, sub: s('1.75') }); w.add({ ...RF('1.35', 'opr', q.opr), eq: e, sub: s('1.35') }); }
      else w.add({ id: 'RFinv', label: 'Inventory rating factor', sym: 'RF_{inv}', value: 'not applicable (no live-load shear)', unit: '' });
    } else {
      w.add({ id: 'fPS', label: `Prestress compression at the bottom fibre, ${at}`, sym: 'f_{ps}', eq: '\\frac{P_{e}}{A} + \\frac{P_{e}\\,e}{S_{b}}', sub: `\\frac{${n(p.Pe, 1)}}{${n(R0(A).gA, 1)}} + \\frac{${n(p.Pe, 1)}(${n(p.e, 3)})}{${n(R0(A).gSb, 0)}}`, value: p.fPS, unit: 'ksi', d: 3, ref: `${MBE} Art. 6A.5.4.1`,
        note: `P_e = A_ps f_pe = ${n(p.Aps, 3)} in² × f_pe (Losses tab); f_pe without the elastic gains (Stresses tab).` });
      w.add({ id: 'fDC', label: 'Bottom-fibre tension from DC', sym: 'f_{DC}', eq: '\\frac{M_{g} + M_{DC1}}{S_{b}} + \\frac{12\\,M_{DC2}}{S_{bc}}', sub: `\\frac{${n(p.Mnc, 0)}}{${n(R0(A).gSb, 0)}} + \\frac{12(${n(p.M_DC2, 1)})}{${n(R0(A).Sbc, 0)}}`, value: q.DC, unit: 'ksi', d: 3, note: 'M_g + M_DC1 in kip-in on the girder section; M_DC2 in kip-ft on the composite section (Analysis tab).' });
      w.add({ id: 'fDW', label: 'Bottom-fibre tension from DW', sym: 'f_{DW}', eq: '\\frac{12\\,M_{DW}}{S_{bc}}', sub: `\\frac{12(${n(p.M_DW, 1)})}{${n(R0(A).Sbc, 0)}}`, value: q.DW, unit: 'ksi', d: 3 });
      w.add({ id: 'fLL', label: 'Bottom-fibre tension from LL + IM (unfactored)', sym: 'f_{LL}', eq: '\\frac{M_{LL}}{S_{bc}}', sub: `\\frac{${n(p.Mll, 0)}}{${n(R0(A).Sbc, 0)}}`, value: q.LL, unit: 'ksi', d: 3, note: 'M_LL in kip-in (positive envelope, IM and DF).' });
      w.add({ id: 'fr', label: 'Allowable tension (the Service III limit)', sym: 'f_{R}', value: q.C, unit: 'ksi', d: 3, ref: `${MBE} Eq. 6A.4.2.1-4`, note: `The engine's Service III tension limit (Rating tab, Service III card; ${A10}Table 5.9.2.3.2b-1).` });
      w.add({ id: 'RF', label: 'Service III rating factor (γ_DC = γ_DW = 1.0, γ_LL = 0.8)', sym: 'RF_{SIII}', eq: '\\frac{f_{R} + f_{ps} - \\gamma_{DC}f_{DC} - \\gamma_{DW}f_{DW}}{\\gamma_{LL}\\,f_{LL}}', sub: `\\frac{${n(q.C, 3)} + ${n(p.fPS, 3)} - ${n(q.DC, 3)} - ${n(q.DW, 3)}}{0.8(${n(q.LL, 3)})}`, value: q.inv, unit: '', d: 3, ok: q.inv >= 1,
        ref: `${MBE} Eq. 6A.4.2.1-1; Tables 6A.4.2.2-1, 6A.4.2.2-2`, note: 'Not × φ_c φ_s (a service limit, φ = 1.0). An inventory-level check only (MBE 4th Ed. C6A.5.4.1).' });
    }
    return w.steps;
  }
  /* the section values the Service III steps substitute (A, S_b, S_bc) */
  const R0 = A => A.sec || {};
  function govSteps(A) {
    if (!A) return [];
    return [].concat(...GROUPS.map(([k, , pfx]) => (A.gov[k] ? steps(A, A.gov[k], 'rt.al.' + pfx) : [])));
  }
  window.PSBRatingAlong = { of, steps, govSteps, GROUPS, MBE };
})();
