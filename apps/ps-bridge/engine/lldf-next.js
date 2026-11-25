/* apps/ps-bridge/engine/lldf-next.js — NX-1: the live-load distribution factors of NEXT F beams, per stem (window.PSBLldfNext). Classic
   script, no DOM. Created 2026-11-25 (engineer-approved §4 change, fixlog/ps-bridge.md NX-1).

   AN ENGINE CHANGE MADE APP-SIDE (CLAUDE.md §4), as engine/lldf-fg.js (PS-35): the moved engine (engine/pbd-*.js, verbatim, frozen) is NOT
   edited. Its distFactors (pbd-lldf-flexure.js) takes a NEXT beam as ONE beam, the type (k) / (i) equations on the beam width (S = b_f / 12)
   and, for an exterior beam, the interior factor (no lever rule, no e, no rigid section). A NEXT F carries a cast-in-place deck on its
   flange: here each STEM is a type (k) stringer (precast concrete tee with a CIP deck, Table 4.6.2.2.1-1) and the two stems' factors are
   added to give the beam's factor. MassDOT LRFD Bridge Manual 3.5.4.3 describes this approach (context only; the owner of record may be
   another, e.g. RIDOT, whose BDM (April 2026) says nothing on it; fixlog NX-1).

   The equations (AASHTO LRFD 10th Ed. (2024); cited, not copied; S ft, L ft, t_s in, K_g in⁴, d_e ft):
     stem spacing      S = S_b / 2 (the stems at a uniform spacing across the bridge: S_b = the beam ℄ spacing of this line, inputs.S;
                       MassDOT 3.5.4.3 item 1 S_eq); N_st = 2 N_b stems
     K_g of a stem     e_g = h + t_h + t_s / 2 − y_b (the engine's), K_g,beam = n (I + A e_g²) (Eq. 4.6.2.2.1-1, n = E_c / E_c,deck),
                       K_g = K_g,beam / 2 (one stem with half the flange: half A and half I about the same centroid; NX-D2)
     interior stem     Table 4.6.2.2.2b-1, type (k): g_M1 = 0.06 + (S/14)^0.4 (S/L)^0.3 (K_g / 12 L t_s³)^0.1,
                       g_M2 = 0.075 + (S/9.5)^0.6 (S/L)^0.2 (K_g / 12 L t_s³)^0.1;  Table 4.6.2.2.3a-1: g_V1 = 0.36 + S/25,
                       g_V2 = 0.2 + S/12 − (S/35)²;  g_M,int = max(g_M1, g_M2), g_V,int = max(g_V1, g_V2) (multiple presence in them)
     exterior stem     (the outer stem of an exterior beam) d_e,st = d_e − c, c = stem ℄ to beam ℄ = 60 / 2 in = 2.5 ft (d_e: the app's, beam ℄ to
                       the traffic face; NX-D4);  candidates, each worked:
                         lever rule, one lane (4.6.2.2.2d, 4.6.2.2.3b; m = 1.2, Art. 3.6.1.1.2): hinge at the first interior stem, the
                           actual stem spacing S_lev = 2 c (MassDOT 3.5.4.3 item 2), wheels 2 ft and 8 ft inside the traffic face:
                           g_lever = 1.2 Σ 0.5 (S_lev + x_w) / S_lev, x_w = d_e,st − 2, d_e,st − 8 (x_w > −S_lev)
                         two or more lanes: g_M = e_M g_M2, e_M = 0.77 + d_e,st / 9.1 (Table 4.6.2.2.2d-1);  g_V = e_V g_V2,
                           e_V = 0.6 + d_e,st / 10 (Table 4.6.2.2.3b-1) (no m: it is in the equations)
                         rigid cross-section (Eq. C4.6.2.2.2d-1, 4.6.2.2.3b; NX-D3): the 2 N_b stems at their positions (beam lines ± c),
                           R = m (N_L / N_st + X_ext Σe / Σx²), e_j = X_ext + d_e,st − 5 − 12 j, m = 1.2, 1.0, 0.85, 0.65 (3.6.1.1.2),
                           the largest over 1 … N_L lanes (as the engine's I-girders)
                       g_M,ext = max(e_M g_M2, g_lever, R), g_V,ext = max(e_V g_V2, g_lever, R)
     per beam          interior beam g = 2 g_int;  exterior beam g = g_ext + g_int (the exterior stem and the interior stem of that beam);
                       the sum of the two stems' factors (MassDOT 3.5.4.3 item 3; NX-D1)
     skew              Table 4.6.2.2.2e-1: r_M = 1 − c₁ (tan θ)^1.5, c₁ = 0.25 (K_g / 12 L t_s³)^0.25 (S / L)^0.5 (θ < 30°: c₁ = 0; θ > 60°: 60°);
                       Table 4.6.2.2.3c-1: c_V = 1 + 0.20 (12 L t_s³ / K_g)^0.3 tan θ; the stem K_g and S; θ the engine's (the larger skew);
                       applied to the beam's factor (the same factor on both stems): DF_M = r_M g_M, DF_V = c_V g_V
     fatigue           the engine's fatigue factor (pbd-compute.js: interior m1 / 1.2, exterior max(lever, rigid1) / 1.2) gets the beam's
                       one-lane factors: m1 = 2 g_M1,st; lever = g_lever,st + g_M1,st; rigid1 = R₁,st + g_M1,st
   Not changed (the engine's result, byte for byte, with a design warning): NEXT D (the flange is the deck: MassDOT takes type (i) with its own
   K_g table, 3.7.6; RIDOT BDM 2.4.6.3 does not allow NEXT D without the State Bridge Engineer's approval; NX-D5) and a NEXT F with no
   topping (t_s = 0: K_g / 12 L t_s³ has no value). Every other shape: no change.
   The returned df keeps the engine's field names (what pbd-compute.js and the app's modules read): dfm, dfv, dfmRaw, dfvRaw (per beam), skM,
   skV, th, ext, Kg (the stem's), eg, m1, m2, v1, v2 (an INTERIOR beam's, 2 × the stem's), lever, rigid1 (per beam, one lane, see fatigue),
   eM, eV, rigid, rigidNL (the exterior stem's), isNext, Sf (= S_b), and nx = every stem value (steps(): the worked steps ld.nx.*).
   How: run(inp, inner) calls inner(inp) with the global distFactors wrapped for that call (restored after), as engine/lldf-fg.js does;
   engine/holddown.js compute uses it. kind(g), applies(inp, g), compute(inp, g, cp, df0), run, steps, card, xsCard, label. */
(function () {
  'use strict';
  const W = () => (typeof window !== 'undefined' ? window : globalThis);
  const A10 = 'AASHTO LRFD 10th Ed. ', MPF = [1.2, 1.0, 0.85, 0.65], RAD = Math.PI / 180;
  const cl = (v, a, b) => Math.min(Math.max(v, a), b), isNum = v => typeof v === 'number' && isFinite(v);
  /* kind(g): 'F' (a NEXT F, or the old library's NEXT xxF, or a custom NEXT), 'D' (a MassDOT NEXT D), null (not a NEXT) */
  function kind(g) {
    if (!g || !g.isNext) return null;
    const S = W().PSBSections, m = S && S.mdOf ? S.mdOf(g) : null;
    if (m && m[1] && m[1].src && m[1].src.fam === 'nextd') return 'D';
    if (typeof g.std === 'string' && /NEXT \d+D\b/.test(g.std)) return 'D';
    return 'F';
  }
  /* applies(inp, g): the per-stem factors are used (a NEXT F with a cast-in-place deck, t_s > 0) */
  const applies = (inp, g) => kind(g) === 'F' && +inp.ts > 0;
  /* stems(inp, Nb, Sb, c): the stem positions (ft) and the exterior stem's index: the beam lines (inputs.rigidX for unequal bays, else equal
     at S_b) ± c; the exterior stem the outer stem of the exterior line (equal bays: G1's) */
  function stems(inp, Nb, Sb, c) {
    const q = inp.rigidX, X = q && Array.isArray(q.x) && q.x.length === Nb ? q.x.slice() : Array.from({ length: Nb }, (_, i) => i * Sb);
    const gi = q && Number.isInteger(q.g) && q.g === Nb ? Nb - 1 : 0, xs = [];
    X.forEach(x => { xs.push(x - c, x + c); });
    return { X, xs, ext: gi === 0 ? 0 : xs.length - 1, beam: gi };
  }
  /* compute(inp, g, cp, df0): the per-stem result in the engine's distFactors shape (df0: the engine's own, kept in nx.engine) */
  function compute(inp, g, cp, df0) {
    const ld = inp.loads || {}, Sb = +inp.S, L = +inp.L, ts = +inp.ts, Nb = Math.max(2, Math.round(+inp.nGirders || 2)), Nst = 2 * Nb;
    const S = Sb / 2, cIn = (g.next && +g.next.stemCC > 0 ? +g.next.stemCC : 60) / 2, c = cIn / 12;
    const th = cl(+ld.skew || 0, 0, 60), tanT = Math.tan(th * RAD);
    const nE = cp.Ecg / Math.max(cp.Ecd, 1e-6), eg = (g.h + (+inp.th || 0) + ts / 2) - g.yb, KgB = nE * (g.I + g.A * eg * eg), Kg = KgB / 2;
    const kr = Kg / (12 * L * ts * ts * ts), kgt = Math.pow(kr, 0.1);
    const m1 = 0.06 + Math.pow(S / 14, 0.4) * Math.pow(S / L, 0.3) * kgt, m2 = 0.075 + Math.pow(S / 9.5, 0.6) * Math.pow(S / L, 0.2) * kgt;
    const v1 = 0.36 + S / 25, v2 = 0.2 + S / 12 - Math.pow(S / 35, 2), gMi = Math.max(m1, m2), gVi = Math.max(v1, v2);
    const c1 = th < 30 ? 0 : 0.25 * Math.pow(kr, 0.25) * Math.pow(S / L, 0.5), skM = 1 - c1 * Math.pow(tanT, 1.5), skV = 1 + 0.20 * Math.pow(1 / kr, 0.3) * tanT;
    const ext = ld.pos === 'exterior';
    const nx = { kind: 'F', Sb, S, Nb, Nst, L, ts, c, cIn, th, tanT, n: nE, h: g.h, thH: +inp.th || 0, yb: g.yb, A: g.A, I: g.I, eg, KgB, Kg, kr, kgt,
      m1, m2, v1, v2, gMi, gVi, c1, skM, skV, ext, NL: cl(Math.round(+ld.NL || 1), 1, 4),
      engine: { dfm: df0.dfm, dfv: df0.dfv, m1: df0.m1, m2: df0.m2, v1: df0.v1, v2: df0.v2, Kg: df0.Kg, Sf: df0.Sf, skM: df0.skM, skV: df0.skV } };
    let gM, gV, lever1, rigid1 = 0;
    if (ext) {
      const de = +ld.de || 0, deSt = de - c, Slev = 2 * c;
      const terms = [deSt - 2, deSt - 8].map(x => ({ x, on: x > -Slev, ord: (Slev + x) / Slev }));
      const R0 = terms.reduce((a, t) => a + (t.on ? 0.5 * t.ord : 0), 0), lever = 1.2 * R0;
      const eM = 0.77 + deSt / 9.1, eV = 0.6 + deSt / 10, eMg = eM * m2, eVg = eV * v2;
      const P = stems(inp, Nb, Sb, c), xbar = P.xs.reduce((a, v) => a + v, 0) / Nst, Xext = Math.abs(P.xs[P.ext] - xbar);
      const sumX2 = P.xs.reduce((a, v) => a + (v - xbar) * (v - xbar), 0), trials = [];
      let rigid = 0, rigidNL = 0;
      for (let NL = 1; NL <= nx.NL; NL++) {
        let sumE = 0; for (let j = 0; j < NL; j++) sumE += Xext + deSt - 5 - 12 * j;
        const r = MPF[NL - 1] * (NL / Nst + Xext * sumE / sumX2); trials.push({ NL, sumE, m: MPF[NL - 1], r });
        if (NL === 1) rigid1 = r;
        if (r > rigid) { rigid = r; rigidNL = NL; }
      }
      const gMe = Math.max(eMg, lever, rigid), gVe = Math.max(eVg, lever, rigid);
      const govM = gMe === eMg ? 'e' : gMe === lever ? 'lever' : 'rigid', govV = gVe === eVg ? 'e' : gVe === lever ? 'lever' : 'rigid';
      Object.assign(nx, { de, deSt, Slev, terms, R0, lever, eM, eV, eMg, eVg, X: P.X, xs: P.xs, extIdx: P.ext, xbar, Xext, sumX2, trials, rigid, rigidNL, rigid1, gMe, gVe, govM, govV });
      gM = gMe + gMi; gV = gVe + gVi; lever1 = lever + m1;
    } else { gM = 2 * gMi; gV = 2 * gVi; lever1 = 0; }
    nx.gM = gM; nx.gV = gV;
    return { Kg, eg, kgt, kgOmitted: false, m1: 2 * m1, m2: 2 * m2, v1: 2 * v1, v2: 2 * v2, skM, skV, th, ext,
      lever: ext ? lever1 : 0, eM: ext ? nx.eM : 0, eV: ext ? nx.eV : 0, rigid: ext ? nx.rigid : 0, rigidNL: ext ? nx.rigidNL : 0, rigid1: ext ? rigid1 + m1 : 0,
      dfmRaw: gM, dfvRaw: gV, dfm: gM * skM, dfv: gV * skV, isNext: true, Sf: Sb, nx };
  }
  /* warnText(inp, g): the design warning of a NEXT that keeps the engine's whole-beam factors ('' otherwise) */
  function warnText(inp, g) {
    const k = kind(g); if (!k || (inp.loads && inp.loads.dfAuto === false)) return '';
    if (k === 'D') return 'Live load distribution, NEXT D (NX-D5): the per-stem factors of NX-1 are not applied to a NEXT D (its flange is the deck; MassDOT LRFD Bridge Manual 3.5.4.3 takes type (i) with the K_g of its 3.7.6; RIDOT BDM 2.4.6.3 allows a NEXT D only with the State Bridge Engineer\'s approval): the engine\'s whole-beam factors are used, the exterior beam with the interior factor. Check the factors (or enter them on the Loads tab).';
    if (!(+inp.ts > 0)) return 'Live load distribution, NEXT F without a cast-in-place deck (t_s = 0): the per-stem type (k) factors of NX-1 need the deck thickness (K_g / 12 L t_s³), so the engine\'s whole-beam factors are used, the exterior beam with the interior factor. Check the factors (or enter them on the Loads tab).';
    return '';
  }
  /* run(inp, inner): inner(inp) with the global distFactors giving the per-stem factors for a NEXT F with a deck; the NEXT D / no-deck warning */
  function run(inp, inner) {
    const w = W(), orig = w.distFactors;
    w.distFactors = function (i, g, cp) { const df = orig(i, g, cp); return applies(i, g) ? compute(i, g, cp, df) : df; };
    let R; try { R = inner(inp); } finally { w.distFactors = orig; }
    if (R && !R.error && R.g && Array.isArray(R.warns)) { const t = warnText(inp, R.g); if (t) R.warns.push(t); }
    return R;
  }
  /* label(R): the method text of the every-line table ('' when not per stem) */
  const label = R => { const q = R && R.df && R.df.nx; return q ? (q.ext ? 'NEXT F per stem (k): exterior stem (lever, e, rigid) + interior stem' : 'NEXT F per stem (k): 2 × interior stem') : ''; };

  /* steps(add, inp, R, h): the worked steps (kit 'ld': ids ld.nx.* and ld.dfmRaw, dfvRaw, c1, skM, skV); h = { n, g, par } */
  function steps(add, inp, R, h) {
    const df = R.df, q = df.nx, n = h.n, g = h.g, par = h.par, L = q.L, ts = q.ts, S = q.S, T = A10 + 'Table ';
    const kTx = `\\left(\\frac{${g(q.Kg, 0)}}{12(${n(L, 2)})(${n(ts, 2)})^{3}}\\right)`;
    add({ id: 'nx.Sb', label: 'NEXT F: girder (beam ℄) spacing of this line', sym: 'S_{b}', value: q.Sb, unit: 'ft', d: 3, note: 'The beam ℄ spacing of this girder line (Cross-section tab; an interior line: the mean of its two bays).' });
    add({ id: 'nx.S', label: 'NEXT F: stem spacing (stems at a uniform spacing; each stem a type (k) stringer)', sym: 'S', eq: '\\frac{S_{b}}{2}', sub: `\\frac{${n(q.Sb, 3)}}{2}`, value: S, unit: 'ft', d: 3, ref: A10 + 'Table 4.6.2.2.1-1, type (k)',
      note: 'Two stems per beam. A NEXT F carries a cast-in-place deck on its flange: each stem is taken as a precast tee with a CIP deck, type (k), not the whole beam as type (i). MassDOT LRFD Bridge Manual 3.5.4.3 (S_eq = S_b / 2) as context.' }, q.Sb / 2);
    add({ id: 'nx.Nst', label: 'NEXT F: number of stems (stringers)', sym: 'N_{st}', eq: '2\\,N_{b}', sub: `2(${q.Nb})`, value: q.Nst, unit: '', d: 0 }, 2 * q.Nb);
    add({ id: 'nx.eg', label: 'Distance between the beam and deck centroids', sym: 'e_{g}', eq: 'h + t_{h} + \\frac{t_{s}}{2} - y_{b}', sub: `${n(q.h, 2)} + ${n(q.thH, 2)} + \\frac{${n(ts, 2)}}{2} - ${n(q.yb, 3)}`, value: q.eg, unit: 'in', d: 3, ref: A10 + '4.6.2.2.1' }, q.h + q.thH + ts / 2 - q.yb);
    add({ id: 'nx.Kgb', label: 'Longitudinal stiffness parameter of the whole beam', sym: 'K_{g,beam}', eq: 'n(I + A\\,e_{g}^{2})', sub: `${n(q.n, 4)}(${g(q.I, 0)} + ${n(q.A, 1)}(${n(q.eg, 3)})^{2})`, value: q.KgB, unit: 'in^{4}', d: 0, ref: A10 + 'Eq. 4.6.2.2.1-1',
      note: 'n = E_c / E_c,deck; A and I of the noncomposite beam (Section properties tab).' }, q.n * (q.I + q.A * q.eg * q.eg));
    add({ id: 'nx.Kg', label: 'Longitudinal stiffness parameter of one stem (used in the equations)', sym: 'K_{g}', eq: '\\frac{K_{g,beam}}{2}', sub: `\\frac{${g(q.KgB, 0)}}{2}`, value: q.Kg, unit: 'in^{4}', d: 0, ref: A10 + 'Eq. 4.6.2.2.1-1',
      note: `One stem with half the flange: half of A and of I, about the same centroid, so the same e_g (NX-D2). The whole-beam K_g would make the K_g term (to the power 0.1) 2^0.1 = 1.072 times larger.` }, q.KgB / 2);
    add({ id: 'nx.m1', label: 'Interior stem: moment DF, one lane loaded', sym: 'g_{M1}', eq: '0.06 + \\left(\\frac{S}{14}\\right)^{0.4}\\left(\\frac{S}{L}\\right)^{0.3}\\left(\\frac{K_{g}}{12\\,L\\,t_{s}^{3}}\\right)^{0.1}',
      sub: `0.06 + \\left(\\frac{${n(S, 3)}}{14}\\right)^{0.4}\\left(\\frac{${n(S, 3)}}{${n(L, 2)}}\\right)^{0.3}${kTx}^{0.1}`, value: q.m1, unit: 'lanes/stem', d: 4, ref: T + '4.6.2.2.2b-1, type (k)' },
      0.06 + Math.pow(S / 14, 0.4) * Math.pow(S / L, 0.3) * Math.pow(q.Kg / (12 * L * ts ** 3), 0.1));
    add({ id: 'nx.m2', label: 'Interior stem: moment DF, two or more lanes loaded', sym: 'g_{M2}', eq: '0.075 + \\left(\\frac{S}{9.5}\\right)^{0.6}\\left(\\frac{S}{L}\\right)^{0.2}\\left(\\frac{K_{g}}{12\\,L\\,t_{s}^{3}}\\right)^{0.1}',
      sub: `0.075 + \\left(\\frac{${n(S, 3)}}{9.5}\\right)^{0.6}\\left(\\frac{${n(S, 3)}}{${n(L, 2)}}\\right)^{0.2}${kTx}^{0.1}`, value: q.m2, unit: 'lanes/stem', d: 4, ref: T + '4.6.2.2.2b-1, type (k)' },
      0.075 + Math.pow(S / 9.5, 0.6) * Math.pow(S / L, 0.2) * Math.pow(q.Kg / (12 * L * ts ** 3), 0.1));
    add({ id: 'nx.v1', label: 'Interior stem: shear DF, one lane loaded', sym: 'g_{V1}', eq: '0.36 + \\frac{S}{25}', sub: `0.36 + \\frac{${n(S, 3)}}{25}`, value: q.v1, unit: 'lanes/stem', d: 4, ref: T + '4.6.2.2.3a-1, type (k)' }, 0.36 + S / 25);
    add({ id: 'nx.v2', label: 'Interior stem: shear DF, two or more lanes loaded', sym: 'g_{V2}', eq: '0.2 + \\frac{S}{12} - \\left(\\frac{S}{35}\\right)^{2}', sub: `0.2 + \\frac{${n(S, 3)}}{12} - \\left(\\frac{${n(S, 3)}}{35}\\right)^{2}`, value: q.v2, unit: 'lanes/stem', d: 4, ref: T + '4.6.2.2.3a-1, type (k)' }, 0.2 + S / 12 - Math.pow(S / 35, 2));
    add({ id: 'nx.gMi', label: 'Interior stem: moment DF before skew', sym: 'g_{M,int}', eq: '\\max(g_{M1}, g_{M2})', sub: `\\max(${n(q.m1, 4)}, ${n(q.m2, 4)})`, value: q.gMi, unit: 'lanes/stem', d: 4, note: 'The multiple presence factor is in the equations (Art. 3.6.1.1.2): not applied again.' }, Math.max(q.m1, q.m2));
    add({ id: 'nx.gVi', label: 'Interior stem: shear DF before skew', sym: 'g_{V,int}', eq: '\\max(g_{V1}, g_{V2})', sub: `\\max(${n(q.v1, 4)}, ${n(q.v2, 4)})`, value: q.gVi, unit: 'lanes/stem', d: 4 }, Math.max(q.v1, q.v2));
    if (q.ext) {
      add({ id: 'nx.de', label: 'Exterior stem: its ℄ to the traffic face', sym: 'd_{e,st}', eq: 'd_{e} - c', sub: `${n(q.de, 3)} - ${n(q.c, 3)}`, value: q.deSt, unit: 'ft', d: 3, ref: A10 + '4.6.2.2.1 (d_e)',
        note: `d_e = ${n(q.de, 3)} ft from the beam ℄ (the app's d_e, Design girder card / Cross-section tab); c = ${n(q.cIn, 1)} in = ${n(q.c, 3)} ft from the beam ℄ to the exterior stem ℄ (stems ${n(2 * q.cIn, 0)} in apart; NX-D4).` }, q.de - q.c);
      const on = q.terms.filter(t => t.on);
      add({ id: 'nx.lever', label: 'Exterior stem, one lane: lever rule, hinge at the first interior stem (m = 1.2)', sym: 'g_{lever}', eq: '1.2\\sum \\frac{0.5(S_{lev} + x_{w})}{S_{lev}}',
        sub: `1.2\\left(${on.map(t => `\\frac{0.5(${n(q.Slev, 3)} + ${par(t.x, 3)})}{${n(q.Slev, 3)}}`).join(' + ') || '0'}\\right)`, value: q.lever, unit: 'lanes/stem', d: 4, ref: A10 + '4.6.2.2.2d, 4.6.2.2.3b, 3.6.1.1.2',
        note: `S_lev = ${n(q.Slev, 3)} ft, the actual spacing of the beam's two stems; wheels 2 ft and 8 ft inside the traffic face: x_w = d_e,st − 2 = ${n(q.terms[0].x, 3)} ft and d_e,st − 8 = ${n(q.terms[1].x, 3)} ft from the exterior stem (outboard +)${q.terms[1].on ? '' : '; the second wheel is past the hinge (not counted)'}. m = 1.2 (one lane) is applied to the lever rule.` },
        1.2 * on.reduce((a, t) => a + 0.5 * (q.Slev + t.x) / q.Slev, 0));
      add({ id: 'nx.eM', label: 'Exterior stem: correction factor, moment', sym: 'e_{M}', eq: '0.77 + \\frac{d_{e,st}}{9.1}', sub: `0.77 + \\frac{${par(q.deSt, 3)}}{9.1}`, value: q.eM, unit: '', d: 4, ref: T + '4.6.2.2.2d-1, type (k)' }, 0.77 + q.deSt / 9.1);
      add({ id: 'nx.eMg', label: 'Exterior stem, two or more lanes: moment', sym: 'e_{M}\\,g_{M2}', eq: 'e_{M}\\,g_{M2}', sub: `${n(q.eM, 4)}(${n(q.m2, 4)})`, value: q.eMg, unit: 'lanes/stem', d: 4, note: 'g_M2 of the stem (step g_M2 above); no multiple presence factor (in the equation).' }, q.eM * q.m2);
      add({ id: 'nx.eV', label: 'Exterior stem: correction factor, shear', sym: 'e_{V}', eq: '0.6 + \\frac{d_{e,st}}{10}', sub: `0.6 + \\frac{${par(q.deSt, 3)}}{10}`, value: q.eV, unit: '', d: 4, ref: T + '4.6.2.2.3b-1, type (k)' }, 0.6 + q.deSt / 10);
      add({ id: 'nx.eVg', label: 'Exterior stem, two or more lanes: shear', sym: 'e_{V}\\,g_{V2}', eq: 'e_{V}\\,g_{V2}', sub: `${n(q.eV, 4)}(${n(q.v2, 4)})`, value: q.eVg, unit: 'lanes/stem', d: 4 }, q.eV * q.v2);
      add({ id: 'nx.xbar', label: 'Rigid section: centroid of the stems from the first beam line', sym: '\\bar{x}', eq: '\\frac{\\sum x_{i}}{N_{st}}', sub: `\\frac{${q.xs.map(v => par(v, 2)).join(' + ')}}{${q.Nst}}`, value: q.xbar, unit: 'ft', d: 3, ref: A10 + 'C4.6.2.2.2d',
        note: `Stems at each beam line ± c = ${n(q.c, 3)} ft (beam lines ${q.X.map(v => n(v, 2)).join(', ')} ft).` }, q.xs.reduce((a, v) => a + v, 0) / q.xs.length);
      add({ id: 'nx.Xext', label: 'Rigid section: exterior stem from the centroid', sym: 'X_{ext}', eq: '|x_{ext} - \\bar{x}|', sub: `|${par(q.xs[q.extIdx], 3)} - ${n(q.xbar, 3)}|`, value: q.Xext, unit: 'ft', d: 3 }, Math.abs(q.xs[q.extIdx] - q.xbar));
      add({ id: 'nx.Sx2', label: 'Rigid section: sum of the squared stem offsets', sym: '\\sum x^{2}', eq: '\\sum (x_{i} - \\bar{x})^{2}', sub: q.xs.map(v => `(${n(v - q.xbar, 3)})^{2}`).join(' + '), value: q.sumX2, unit: 'ft^{2}', d: 2 }, q.xs.reduce((a, v) => a + (v - q.xbar) * (v - q.xbar), 0));
      q.trials.forEach(t => add({ id: 'nx.R' + t.NL, label: `Rigid section, ${t.NL} lane${t.NL > 1 ? 's' : ''} loaded (m = ${n(t.m, 2)})`, sym: `R_{${t.NL}}`, eq: 'm\\left(\\frac{N_{L}}{N_{st}} + \\frac{X_{ext}\\sum e}{\\sum x^{2}}\\right)',
        sub: `${n(t.m, 2)}\\left(\\frac{${t.NL}}{${q.Nst}} + \\frac{${n(q.Xext, 3)}(${n(t.sumE, 3)})}{${n(q.sumX2, 2)}}\\right)`, value: t.r, unit: 'lanes/stem', d: 4, ref: A10 + 'Eq. C4.6.2.2.2d-1, Table 3.6.1.1.2-1',
        note: `Σe = Σ (X_ext + d_e,st − 5 − 12 j), j = 0 … ${t.NL - 1}: ${n(t.sumE, 3)} ft. The multiple presence factor m is applied (Art. 3.6.1.1.2).` }, t.m * (t.NL / q.Nst + q.Xext * t.sumE / q.sumX2)));
      add({ id: 'nx.rigid', label: `Exterior stem: rigid cross-section, the largest (${q.rigidNL} lane${q.rigidNL === 1 ? '' : 's'})`, sym: 'R', eq: `\\max(${q.trials.map(t => `R_{${t.NL}}`).join(',\\ ')})`, sub: `\\max(${q.trials.map(t => n(t.r, 4)).join(',\\ ')})`, value: q.rigid, unit: 'lanes/stem', d: 4,
        note: 'NX-D3: the rigid-section check is applied to the NEXT stems, as to the app\'s I-girders (Art. 4.6.2.2.2d makes it mandatory for steel beam-slab bridges with diaphragms; MassDOT 3.5.4.3 item 2 has the "pile cap analogy" investigated).' }, Math.max(...q.trials.map(t => t.r)));
      const gnm = { e: 'e_{M}g_{M2}', lever: 'g_{lever}', rigid: 'R' }, gnv = { e: 'e_{V}g_{V2}', lever: 'g_{lever}', rigid: 'R' };
      add({ id: 'nx.gMe', label: 'Exterior stem: moment DF before skew (governing candidate)', sym: 'g_{M,ext}', eq: '\\max(e_{M}\\,g_{M2},\\ g_{lever},\\ R)', sub: `\\max(${n(q.eMg, 4)},\\ ${n(q.lever, 4)},\\ ${n(q.rigid, 4)})`, value: q.gMe, unit: 'lanes/stem', d: 4,
        note: `Governs: ${gnm[q.govM].replace(/[{}_]/g, '')}.` }, Math.max(q.eMg, q.lever, q.rigid));
      add({ id: 'nx.gVe', label: 'Exterior stem: shear DF before skew (governing candidate)', sym: 'g_{V,ext}', eq: '\\max(e_{V}\\,g_{V2},\\ g_{lever},\\ R)', sub: `\\max(${n(q.eVg, 4)},\\ ${n(q.lever, 4)},\\ ${n(q.rigid, 4)})`, value: q.gVe, unit: 'lanes/stem', d: 4,
        note: `Governs: ${gnv[q.govV].replace(/[{}_]/g, '')}.` }, Math.max(q.eVg, q.lever, q.rigid));
      add({ id: 'dfmRaw', label: 'Exterior NEXT beam: moment DF before skew (exterior stem + interior stem)', sym: 'g_{M}', eq: 'g_{M,ext} + g_{M,int}', sub: `${n(q.gMe, 4)} + ${n(q.gMi, 4)}`, value: df.dfmRaw, unit: 'lanes', d: 4, note: 'NX-D1: the beam\'s factor is the sum of its two stems\' factors (MassDOT 3.5.4.3 item 3).' }, q.gMe + q.gMi);
      add({ id: 'dfvRaw', label: 'Exterior NEXT beam: shear DF before skew (exterior stem + interior stem)', sym: 'g_{V}', eq: 'g_{V,ext} + g_{V,int}', sub: `${n(q.gVe, 4)} + ${n(q.gVi, 4)}`, value: df.dfvRaw, unit: 'lanes', d: 4 }, q.gVe + q.gVi);
    } else {
      add({ id: 'dfmRaw', label: 'Interior NEXT beam: moment DF before skew (two interior stems)', sym: 'g_{M}', eq: '2\\,g_{M,int}', sub: `2(${n(q.gMi, 4)})`, value: df.dfmRaw, unit: 'lanes', d: 4, note: 'NX-D1: the beam\'s factor is the sum of its two stems\' factors (MassDOT 3.5.4.3 item 3).' }, 2 * q.gMi);
      add({ id: 'dfvRaw', label: 'Interior NEXT beam: shear DF before skew (two interior stems)', sym: 'g_{V}', eq: '2\\,g_{V,int}', sub: `2(${n(q.gVi, 4)})`, value: df.dfvRaw, unit: 'lanes', d: 4 }, 2 * q.gVi);
    }
    if (q.th >= 30) add({ id: 'c1', label: 'Skew coefficient c₁ (stem K_g and S)', sym: 'c_{1}', eq: '0.25\\left(\\frac{K_{g}}{12\\,L\\,t_{s}^{3}}\\right)^{0.25}\\left(\\frac{S}{L}\\right)^{0.5}', sub: `0.25${kTx}^{0.25}\\left(\\frac{${n(S, 3)}}{${n(L, 2)}}\\right)^{0.5}`, value: q.c1, unit: '', d: 4, ref: T + '4.6.2.2.2e-1' },
      0.25 * Math.pow(q.Kg / (12 * L * ts ** 3), 0.25) * Math.pow(S / L, 0.5));
    add({ id: 'skM', label: `Skew reduction, moment (θ = ${n(q.th, 1)}°)`, sym: 'r_{M}', eq: '1 - c_{1}(\\tan\\theta)^{1.5}', sub: `1 - ${n(q.c1, 4)}(${n(q.tanT, 4)})^{1.5}`, value: df.skM, unit: '', d: 4, ref: T + '4.6.2.2.2e-1', note: q.th < 30 ? 'θ < 30°: c_1 = 0, no reduction.' : 'The same factor on both stems: applied to the beam\'s factor.' }, 1 - q.c1 * Math.pow(q.tanT, 1.5));
    add({ id: 'skV', label: `Skew correction, shear (θ = ${n(q.th, 1)}°)`, sym: 'c_{V}', eq: '1 + 0.20\\left(\\frac{12\\,L\\,t_{s}^{3}}{K_{g}}\\right)^{0.3}\\tan\\theta', sub: `1 + 0.20\\left(\\frac{12(${n(L, 2)})(${n(ts, 2)})^{3}}{${g(q.Kg, 0)}}\\right)^{0.3}(${n(q.tanT, 4)})`, value: df.skV, unit: '', d: 4, ref: T + '4.6.2.2.3c-1',
      note: 'The stem K_g; applied to the whole span as the engine applies it to every girder.' }, 1 + 0.2 * Math.pow(12 * L * ts ** 3 / q.Kg, 0.3) * q.tanT);
  }

  /* card(ctx): the Loads & LLDF tab's distribution card of a NEXT F (HTML; R.df.nx): the stems, the exterior candidates, the beam's factor */
  function card(ctx) {
    const { R, inp } = ctx, k = window.PSBOutKit, ev = (p, d, u) => k.ev(R, p, d, u), wk = k.wk, df = R.df, q = df.nx, ext = q.ext, fx = (v, d) => k.fx(v, d);
    const lr = window.PSBLldfOpt && window.PSBLldfOpt.label ? window.PSBLldfOpt.label(R) : '';
    const gv = (key, a) => (key === a ? ' style="font-weight:700;background:#eef6ee"' : '');
    const stemTbl = `<div class="tscroll"><table class="tbl" id="nxStems"><thead><tr><th class="lft">Stem of this beam</th><th class="lft">Equations</th><th>g<sub>M</sub> (lanes / stem)</th><th>g<sub>V</sub> (lanes / stem)</th></tr></thead><tbody>
      ${ext ? `<tr><td class="lft">Exterior stem (outer)</td><td class="lft">the governing of the candidates below</td><td>${ev('df.nx.gMe', 4)} ${wk('ld.nx.gMe')}</td><td>${ev('df.nx.gVe', 4)} ${wk('ld.nx.gVe')}</td></tr>
        <tr><td class="lft">Interior stem (inner)</td><td class="lft">interior, Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1</td><td>${ev('df.nx.gMi', 4)} ${wk('ld.nx.gMi')}</td><td>${ev('df.nx.gVi', 4)} ${wk('ld.nx.gVi')}</td></tr>`
        : `<tr><td class="lft">Both stems (interior)</td><td class="lft">interior, Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1</td><td>${ev('df.nx.gMi', 4)} ${wk('ld.nx.gMi')}</td><td>${ev('df.nx.gVi', 4)} ${wk('ld.nx.gVi')}</td></tr>`}
      <tr><td class="lft"><b>This beam, before skew</b></td><td class="lft">${ext ? 'exterior stem + interior stem' : '2 × interior stem'} (NX-D1)</td><td><b>${ev('df.dfmRaw', 4)}</b> ${wk('ld.dfmRaw')}</td><td><b>${ev('df.dfvRaw', 4)}</b> ${wk('ld.dfvRaw')}</td></tr></tbody></table></div>`;
    const cand = ext ? `<div class="tscroll"><table class="tbl" id="nxCand"><thead><tr><th class="lft">Exterior stem: candidate</th><th class="lft">Multiple presence</th><th>Moment</th><th>Shear</th></tr></thead><tbody>
      <tr><td class="lft">Lever rule, one lane (hinge at the first interior stem, S<sub>lev</sub> = ${fx(q.Slev, 3)} ft)</td><td class="lft">m = 1.2 applied</td><td${gv('lever', q.govM)}>${ev('df.nx.lever', 4)} ${wk('ld.nx.lever')}</td><td${gv('lever', q.govV)}>${ev('df.nx.lever', 4)} ${wk('ld.nx.lever')}</td></tr>
      <tr><td class="lft">Two or more lanes: e × g<sub>2</sub> (e<sub>M</sub> = ${fx(q.eM, 4)}, e<sub>V</sub> = ${fx(q.eV, 4)})</td><td class="lft">in the equations</td><td${gv('e', q.govM)}>${ev('df.nx.eMg', 4)} ${wk('ld.nx.eMg')}</td><td${gv('e', q.govV)}>${ev('df.nx.eVg', 4)} ${wk('ld.nx.eVg')}</td></tr>
      <tr><td class="lft">Rigid cross-section, ${q.rigidNL} lane${q.rigidNL === 1 ? '' : 's'} (of 1 to N<sub>L</sub> = ${q.NL}; NX-D3)</td><td class="lft">m = ${fx(MPF[q.rigidNL - 1] || 1, 2)} applied</td><td${gv('rigid', q.govM)}>${ev('df.nx.rigid', 4)} ${wk('ld.nx.rigid')}</td><td${gv('rigid', q.govV)}>${ev('df.nx.rigid', 4)} ${wk('ld.nx.rigid')}</td></tr>
      <tr><td class="lft"><b>Governing (shaded)</b></td><td></td><td><b>${ev('df.nx.gMe', 4)}</b></td><td><b>${ev('df.nx.gVe', 4)}</b></td></tr></tbody></table></div>` : '';
    const rows = [['Cross-section type (Table 4.6.2.2.1-1)', '(k) per stem: precast tee stem with a cast-in-place deck (NEXT F)'],
      ['Beam spacing S<sub>b</sub> / stem spacing S / stems N<sub>st</sub>', `${ev('df.nx.Sb', 3, 'ft')} / ${ev('df.nx.S', 3, 'ft')} ${wk('ld.nx.S')} / ${q.Nst} ${wk('ld.nx.Nst')}`],
      ['K<sub>g</sub>: beam / one stem (used)', `${ev('df.nx.KgB', 0, 'in⁴')} ${wk('ld.nx.Kgb')} / <b>${ev('df.nx.Kg', 0, 'in⁴')}</b> ${wk('ld.nx.Kg')}`],
      ['Interior stem g<sub>M</sub>: one lane / two or more', `${ev('df.nx.m1', 4)} / ${ev('df.nx.m2', 4)} ${wk('ld.nx.m1')}`], ['Interior stem g<sub>V</sub>: one lane / two or more', `${ev('df.nx.v1', 4)} / ${ev('df.nx.v2', 4)} ${wk('ld.nx.v1')}`],
      ...(ext ? [['Exterior stem d<sub>e,st</sub> (beam d<sub>e</sub> − c)', `${ev('df.nx.deSt', 3, 'ft')} ${wk('ld.nx.de')}`]] : []),
      ['Skew θ', ev('df.th', 1, '°')], ['Moment skew reduction r<sub>M</sub>', `${ev('df.skM', 4)} ${wk('ld.skM')}`], ['Shear skew correction c<sub>V</sub>', `${ev('df.skV', 4)} ${wk('ld.skV')}`],
      ...(lr ? [['Distribution options', k.esc(lr)]] : []),
      ['DF<sub>M</sub> used (this beam)', `<b>${ev('dfm', 4, 'lanes')}</b> ${wk('ld.dfm')}`], ['DF<sub>V</sub> used (this beam)', `<b>${ev('dfv', 4, 'lanes')}</b> ${wk('ld.dfv')}`],
      ['M<sub>LL+IM</sub> per girder, midspan', `<b>${ev('MLL', 1, 'kip-ft')}</b> ${wk('ld.MLL')}`], ['V<sub>LL+IM</sub> per girder, support', `<b>${ev('VLL', 2, 'kip')}</b> ${wk('ld.VLL')}`]];
    return k.card(`Live load distribution factors: ${ext ? 'exterior' : 'interior'} NEXT F beam, per stem (NX-1)`, k.kv(rows) + stemTbl + cand
      + `<p class="note" id="nxNote">${inp.loads.dfAuto ? `Each stem is a type (k) stringer at the uniform stem spacing S = S<sub>b</sub> / 2 (AASHTO LRFD 10th Ed. Tables 4.6.2.2.2b-1, 4.6.2.2.2d-1, 4.6.2.2.3a-1, 4.6.2.2.3b-1; skew 4.6.2.2.2e, 4.6.2.2.3c); the beam's factor is the sum of its two stems'. ${ext ? 'The exterior stem takes the largest of the lever rule (one lane, m = 1.2), e × g of two or more lanes and the rigid cross-section (with m); the inner stem the interior equations. ' : 'An interior beam: two interior stems. '}The moved engine's whole-beam factors are not used (DF<sub>M</sub> ${fx(q.engine.dfm, 4)}, DF<sub>V</sub> ${fx(q.engine.dfv, 4)}: types (i)/(j) on the beam width, the exterior beam with the interior factor). MassDOT LRFD Bridge Manual 3.5.4.3 describes this per-stem method (context).` : 'Distribution factors entered on the Loads tab (the per-stem values are shown for reference).'} Which factor each girder line takes: <a href="#" data-goin="xsec">Cross-section tab</a>; position and skew from the bridge (<a href="#" data-goin="gird@card-design">Design girder card</a>).</p>`);
  }
  /* xsCard(P, resOf): the Cross-section tab's card for a bridge with NEXT F lines: each girder line, the rule of its factor and its DF_M /
     DF_V (resOf(k, g): the engine result of girder type k on line g, or null), each linked to its worked step (HTML; '' without a NEXT F) */
  function xsCard(P, resOf) {
    const BR = W().PSBBridge, D = W().PSBDesign; if (!BR || !D || !BR.hasTypes(P)) return '';
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]), fx = (v, d) => (isNum(v) ? (+v).toFixed(d) : '—');
    const rows = []; let any = false;
    BR.cells(P).slice().sort((a, b) => a.s - b.s || a.g - b.g).forEach(c => {
      let R = null; try { R = resOf ? resOf(c.k, c.g) : null; } catch (e) { R = null; }
      let g = null; try { const i = D.cellInputs(P, c.k, c.g); g = typeof girderGross === 'function' ? girderGross(i) : null; } catch (e) { g = null; }
      if (kind(g) !== 'F') return; any = true;
      const ext = c.g === 1 || c.g === P.xs.nb, q = R && !R.error && R.df ? R.df.nx : null, lab = (P.types[c.k] || {}).label || '';
      const rule = q ? (ext ? 'exterior stem (largest of lever rule, e × g, rigid section) + interior stem' : '2 × interior stem') : R && R.useExt ? 'imported live load' : 'engine whole-beam factor (see the Loads &amp; LLDF tab)';
      const go = st => `<a class="wk" href="#" data-sumgo="${c.k}|${c.g}|lds|${st}|" title="Worked: Loads &amp; LLDF tab with this girder type and line">§</a>`;
      rows.push(`<tr><td>${c.s}</td><td class="lft">G${c.g} (${ext ? 'exterior' : 'interior'})</td><td class="lft">${esc(lab)}</td><td class="lft">${rule}</td><td>${R && !R.error ? fx(R.dfm, 4) + ' ' + go('ld.dfm') : '—'}</td><td>${R && !R.error ? fx(R.dfv, 4) + ' ' + go('ld.dfv') : '—'}</td></tr>`);
    });
    if (!any) return '';
    return `<section class="sec" id="card-nxlines"><div class="secHead">Live-load distribution of each NEXT F line (per stem) <span class="secRef">AASHTO LRFD 10th Ed. 4.6.2.2, type (k) per stem</span></div><div class="secBody">
      <div class="tscroll"><table class="tbl" id="nxLines"><thead><tr><th>Span</th><th class="lft">Line</th><th class="lft">Girder type</th><th class="lft">The line's factor (2 stems per beam)</th><th>DF<sub>M</sub></th><th>DF<sub>V</sub></th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
      <p class="note">Each NEXT F beam is two type (k) stems at the stem spacing S = S<sub>b</sub> / 2; its factor is the sum of its stems' (NX-1). An exterior line (G1, G${P.xs.nb}) takes its exterior stem's governing candidate plus its interior stem's factor; an interior line twice the interior stem's. DF in lanes per beam, after the skew factors and any distribution option. § opens the worked steps (Loads &amp; LLDF tab) with that type and line.</p></div></section>`;
  }
  W().PSBLldfNext = { kind, applies, compute, warnText, run, label, steps, card, xsCard };
})();
