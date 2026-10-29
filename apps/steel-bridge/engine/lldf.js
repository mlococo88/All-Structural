/* apps/steel-bridge/engine/lldf.js — live-load distribution factors for steel I-girders with a concrete deck, cross-section
   type (a) (window.SBDLldf). Classic script, no DOM. Needs window.SharedLLDF (shared/lldf.js), window.SharedSteps and
   window.SBDSections, loaded first.

   A thin adapter (2026-10-29, fixlog/steel-bridge.md): the distribution factors come from shared/lldf.js, the engine of lldf.html
   (the suite's verified LLDF tool): geometry, skewFactors, empiricalInterior, leverConfig, leverAll, rigidMethod, memberDF. This file
   maps the app's regions (span and pier, K_g from the girder's plates) to SharedLLDF's input, maps the results back to the fields
   the app and its tests use, and writes the worked steps (shared/steps.js format). What stays here, as GirderDetail has it
   (Steel Bridge Design.html, LLDF and DLs module): K_g per region (KgOf, the length-weighted option), the region list (bridgeDef),
   the shear-skew option for exterior girders only, the exterior "not less than interior" policy, negative skews read as no skew
   (open item SB2-O23), the range checks (DF1).

   Engineer's decision 2026-10-29 (SB2-O19): the factors follow lldf.html where GirderDetail differed: (1) exterior fatigue
   factor = max(one-lane lever rule, one-lane rigid cross-section)/1.2 (4.6.2.2.2d); (2) no moment skew reduction for a span
   whose two support lines differ by more than 10° (4.6.2.2.2e, per span: SharedLLDF.momentSkewNoReduction); (3) with S > 16 ft
   or N_b = 3 the multi-lane lever rule is the governing of 2 … N_L trucks (leverMulti); (4) the lever rule also tests the exact
   kink positions.

   Units: spacings, overhangs, traffic faces, span lengths ft; slab thickness, plates, haunch in; K_g in^4; skew degrees.
   Code: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), Art. 4.6.2.2 (approximate method), cross-section (a). */
(function () {
  'use strict';
  const ED = 'AASHTO LRFD 10th Ed.';
  const St = () => window.SharedSteps;
  const n2 = x => St().n(x, 2), n3 = x => St().n(x, 3), n4 = x => St().n(x, 4), g0 = x => St().g(x, 0);
  const sum = a => a.reduce((s, x) => s + x, 0);   // GirderDetail sum()

  const SL = () => window.SharedLLDF;
  /* multiple presence factor m, Table 3.6.1.1.2-1 (SharedLLDF.multiplePresence) */
  const MPF = n => SL().multiplePresence(n);
  /* ranges of applicability, Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1 (GirderDetail DF_RNG; the same limits as SharedLLDF.RANGES) */
  const RANGE = { S: [3.5, 16.0, 'ft', 'Average beam spacing S'], L: [20, 240, 'ft', 'Span length L'], ts: [4.5, 12.0, 'in', 'Slab thickness t_s'], Nb: [4, Infinity, '', 'Number of beams N_b'], Kg: [10000, 7000000, 'in⁴', 'Stiffness parameter K_g'] };
  /* simplified K_g terms, Table 4.6.2.2.1-3, type (a): (Kg/12Lts³)^0.1, (Kg/12Lts³)^0.25, (12Lts³/Kg)^0.3 (SharedLLDF.KG_SIMPLE) */
  const SIMPLE = { m: 1.02, c1: 1.03, v: 0.97 };

  /* lp(p): SharedLLDF's input (lldf.html's readInputs form) for this app's region input p: { Nb, spacings, OL, OR, rL, rR, L, ts,
     gap (ft, the same gap between every pair of trucks), simple (K_g terms of Table 4.6.2.2.1-3), thM, thV (moment and shear skew) }.
     type 'a': steel I-girders with a concrete deck. */
  const lp = p => ({ type: 'a', Nb: p.Nb, spacings: p.spacings, OL: p.OL, OR: p.OR, rL: p.rL, rR: p.rR, L: p.L, ts: p.ts,
    skew: p.thM != null ? p.thM : 0, skewV: p.thV != null ? p.thV : 0, truckGaps: new Array(64).fill(p.gap), kgSimple: !!p.simple });

  /* geometry(p): girder positions and the roadway (SharedLLDF.geometry). p: { Nb, spacings [ft], OL, OR (overhangs, ft), rL, rR
     (deck edge to the live-load traffic face, ft) }. N_L, Art. 3.6.1.1.1: INT(w/12), a 20–24 ft roadway two lanes of w/2. */
  function geometry(p) { return SL().geometry(p); }
  function geometrySteps(p, geo) {
    const w = St().work('df.geo');
    w.add({ id: 'Wdeck', label: 'Deck width, out to out', sym: 'W', eq: 'o_{L} + \\sum S + o_{R}', sub: `${n2(p.OL)} + ${n2(geo.beamW)} + ${n2(p.OR)}`, value: geo.Wdeck, unit: 'ft', d: 2 });
    w.add({ id: 'w', label: 'Clear roadway width between the live-load traffic faces', sym: 'w', eq: 'W - r_{L} - r_{R}', sub: `${n2(geo.Wdeck)} - ${n2(p.rL)} - ${n2(p.rR)}`, value: geo.roadway, unit: 'ft', d: 2, ref: `${ED} Art. 3.6.1.1.1` });
    w.add({ id: 'NL', label: 'Number of design lanes', sym: 'N_{L}', eq: geo.twoHalf ? '2\\ \\text{(20 ft} \\le w \\le \\text{24 ft)}' : '\\text{INT}(w/12)', sub: geo.twoHalf ? '' : `\\text{INT}(${n2(geo.roadway)}/12)`, value: geo.NL, unit: '', d: 0, ref: `${ED} Art. 3.6.1.1.1`,
      note: geo.twoHalf ? `Two lanes, each half the roadway: ${n2(geo.laneW)} ft.` : '' });
    w.add({ id: 'Savg', label: 'Average girder spacing', sym: 'S_{avg}', eq: '\\frac{\\sum S}{N_{b} - 1}', sub: `\\frac{${n2(geo.beamW)}}{${p.Nb} - 1}`, value: geo.Savg, unit: 'ft', d: 3 });
    w.add({ id: 'deL', label: 'Distance d_e, left exterior girder web to the traffic face', sym: 'd_{e,L}', eq: 'o_{L} - r_{L}', sub: `${n2(p.OL)} - ${n2(p.rL)}`, value: geo.deL, unit: 'ft', d: 2, ref: `${ED} Table 4.6.2.2.2d-1` });
    w.add({ id: 'deR', label: 'Distance d_e, right exterior girder web to the traffic face', sym: 'd_{e,R}', eq: 'o_{R} - r_{R}', sub: `${n2(p.OR)} - ${n2(p.rR)}`, value: geo.deR, unit: 'ft', d: 2, ref: `${ED} Table 4.6.2.2.2d-1` });
    w.add({ id: 'sumX2', label: 'Sum of the squared girder offsets from the girder-group centroid', sym: '\\sum x^{2}', eq: '\\sum (x_{i} - \\bar{x})^{2}', sub: geo.xrel.map(x => `(${n2(x)})^{2}`).join(' + '), value: geo.sumX2, unit: 'ft^{2}', d: 2, ref: `${ED} Eq. C4.6.2.2.2d-1` });
    return w.steps;
  }
  const typeOf = (p, j) => (j === 0 || j === p.Nb - 1) ? 'ext' : 'int';
  const spacingOf = (p, j) => j === 0 ? p.spacings[0] : j === p.Nb - 1 ? p.spacings[p.spacings.length - 1] : (p.spacings[j - 1] + p.spacings[j]) / 2;

  /* momentSkew(rg, skews): the region's skews for Tables 4.6.2.2.2e-1 / 4.6.2.2.3c-1 (deg, signed). Moment: the smaller skew of the
     region's support lines (GirderDetail), none (4.6.2.2.2e, engineer's decisions 2026-10-29) for a span whose two support lines
     differ by more than 10° (SharedLLDF.momentSkewNoReduction) and for a pier region if either adjacent span's two support lines do
     (SharedLLDF.momentSkewNoReductionPier; skews: every support line of the bridge); shear: the larger. A negative value counts as no
     skew, as GirderDetail (open item SB2-O23; lldf.html reads |θ|). */
  function momentSkew(rg, skews) {
    const skA = rg.skA, skB = rg.skB, thMin = Math.min(skA, skB), thMax = Math.max(skA, skB), K = Array.isArray(skews) ? skews.map(v => +v || 0) : null;
    let noRed, dTh;
    if (rg.kind === 'sup' && K && K.length > rg.i) { const pv = rg.i > 0 ? K[rg.i - 1] : null, nx = rg.i + 1 < K.length ? K[rg.i + 1] : null, pr = K[rg.i];
      noRed = SL().momentSkewNoReductionPier(pv, pr, nx); dTh = Math.max(pv != null ? Math.abs(pr - pv) : 0, nx != null ? Math.abs(nx - pr) : 0); }
    else { noRed = SL().momentSkewNoReduction(skA, skB); dTh = Math.abs(skA - skB); }
    return { thMin, noRed, dTh, thM: noRed ? 0 : Math.max(0, thMin), thV: Math.max(0, thMax) };
  }
  /* skew(p, geo, Kg): SharedLLDF.skewFactors (beam-slab rows: moment reduction 30° ≤ θ ≤ 60° (θ > 60°: 60°), shear correction).
     p.thM, p.thV from momentSkew. Returns SharedLLDF's object plus thM, thV, tanM, noRed, dTh, thMin. */
  function skew(p, geo, Kg) {
    const s = SL().skewFactors(lp(p), geo, Kg);
    return { ...s, thM: p.thM, thV: p.thV, tanM: s.tan || 0, tanV: s.tanV || 0, noRed: !!p.noRed, dTh: p.dTh || 0, thMin: p.thMin != null ? p.thMin : p.thM };
  }
  function skewSteps(w, p, sk, Kg) {
    const kt = p.simple ? `${SIMPLE.c1}` : `\\left(\\frac{${g0(Kg)}}{12(${n2(p.L)})(${n2(p.ts)})^{3}}\\right)^{0.25}`;
    if (sk.noRed) w.add({ id: 'noRed', label: p.pier ? 'An adjacent span\'s support lines differ by more than 10°: no moment skew reduction for this pier region' : 'Support lines of this span differ by more than 10°: no moment skew reduction', sym: '|\\theta_{A} - \\theta_{B}|', eq: '', sub: '', value: sk.dTh, unit: '^{\\circ}', d: 2, ref: `${ED} Art. 4.6.2.2.2e`,
      note: `The smaller skew θ = ${n2(sk.thMin)}° is not used for the moment (engineer's decisions 2026-10-29: per span; a pier region if either adjacent span differs).` });
    if (Math.min(sk.thM, 60) >= 30) {
      w.add({ id: 'c1', label: 'Skew coefficient c_1 for moment', sym: 'c_{1}', eq: '0.25\\left(\\frac{K_{g}}{12Lt_{s}^{3}}\\right)^{0.25}\\left(\\frac{S}{L}\\right)^{0.5}', sub: `0.25${kt}\\left(\\frac{${n3(p.geoSavg)}}{${n2(p.L)}}\\right)^{0.5}`, value: sk.c1, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.2e-1` });
      w.add({ id: 'scfM', label: 'Skew reduction factor for moment', sym: 'r_{M}', eq: '1 - c_{1}(\\tan\\theta)^{1.5}', sub: `1 - ${n4(sk.c1)}(\\tan ${n2(Math.min(sk.thM, 60))}^{\\circ})^{1.5}`, value: sk.scfM, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.2e-1`, note: sk.thM > 60 ? 'θ > 60°: θ = 60° used.' : '' });
    } else w.add({ id: 'scfM', label: 'Skew reduction factor for moment', sym: 'r_{M}', eq: '1.0', sub: '', value: sk.scfM, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.2e-1`, note: sk.noRed ? 'No reduction (Art. 4.6.2.2.2e).' : `θ = ${n2(sk.thM)}° < 30°: no reduction.` });
    if (Math.min(sk.thV, 60) > 0) {
      const vt = p.simple ? `${SIMPLE.v}` : `\\left(\\frac{12(${n2(p.L)})(${n2(p.ts)})^{3}}{${g0(Kg)}}\\right)^{0.3}`;
      w.add({ id: 'scfV', label: 'Skew correction factor for shear (obtuse corner)', sym: 'r_{V}', eq: '1 + 0.20\\left(\\frac{12Lt_{s}^{3}}{K_{g}}\\right)^{0.3}\\tan\\theta', sub: `1 + 0.20${vt}\\tan ${n2(Math.min(sk.thV, 60))}^{\\circ}`, value: sk.scfV, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.3c-1` });
    } else w.add({ id: 'scfV', label: 'Skew correction factor for shear', sym: 'r_{V}', eq: '1.0', sub: '', value: sk.scfV, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.3c-1`, note: 'No skew.' });
  }
  /* emp(Kg, L, ts, S, simple): the interior-girder equations (SharedLLDF.empiricalInterior). Moment, Table 4.6.2.2.2b-1; shear,
     Table 4.6.2.2.3a-1. */
  function emp(Kg, L, ts, S, simple) { return SL().empiricalInterior(Kg, L, ts, S, simple); }
  function empSteps(w, e, S, L, ts, Kg, simple) {
    w.add({ id: 'kterm', label: 'Stiffness term', sym: '\\left(\\frac{K_{g}}{12Lt_{s}^{3}}\\right)^{0.1}', eq: simple ? '1.02\\ \\text{(Table 4.6.2.2.1-3)}' : '', sub: simple ? '' : `\\left(\\frac{${g0(Kg)}}{12(${n2(L)})(${n2(ts)})^{3}}\\right)^{0.1}`, value: e.kterm, unit: '', d: 4, ref: simple ? `${ED} Table 4.6.2.2.1-3` : `${ED} Table 4.6.2.2.2b-1` });
    w.add({ id: 'mom1', label: 'Interior moment equation, one lane loaded', sym: 'g_{M,1}', eq: '0.06 + \\left(\\frac{S}{14}\\right)^{0.4}\\left(\\frac{S}{L}\\right)^{0.3}\\left(\\frac{K_{g}}{12Lt_{s}^{3}}\\right)^{0.1}', sub: `0.06 + \\left(\\frac{${n3(S)}}{14}\\right)^{0.4}\\left(\\frac{${n3(S)}}{${n2(L)}}\\right)^{0.3}(${n4(e.kterm)})`, value: e.mom1, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.2b-1` });
    w.add({ id: 'mom2', label: 'Interior moment equation, two or more lanes loaded', sym: 'g_{M,2}', eq: '0.075 + \\left(\\frac{S}{9.5}\\right)^{0.6}\\left(\\frac{S}{L}\\right)^{0.2}\\left(\\frac{K_{g}}{12Lt_{s}^{3}}\\right)^{0.1}', sub: `0.075 + \\left(\\frac{${n3(S)}}{9.5}\\right)^{0.6}\\left(\\frac{${n3(S)}}{${n2(L)}}\\right)^{0.2}(${n4(e.kterm)})`, value: e.mom2, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.2b-1` });
    w.add({ id: 'shr1', label: 'Interior shear equation, one lane loaded', sym: 'g_{V,1}', eq: '0.36 + \\frac{S}{25}', sub: `0.36 + \\frac{${n3(S)}}{25}`, value: e.shr1, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.3a-1` });
    w.add({ id: 'shr2', label: 'Interior shear equation, two or more lanes loaded', sym: 'g_{V,2}', eq: '0.2 + \\frac{S}{12} - \\left(\\frac{S}{35}\\right)^{2}', sub: `0.2 + \\frac{${n3(S)}}{12} - \\left(\\frac{${n3(S)}}{35}\\right)^{2}`, value: e.shr2, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.3a-1` });
  }

  /* lever rule (SharedLLDF leverContribution, leverConfig, leverAll, leverMulti): deck hinged over the girders; a train of N trucks
     (6 ft between wheel lines, gaps ≥ 4 ft between trucks, 3.6.1.3.1), outer wheels ≥ 2 ft from the traffic faces, moved on a
     0.25 ft grid and to the exact positions where a wheel is over a girder line (the kinks of R(s)) and the end of travel.
     Each result also carries c: the influence ordinate of every wheel line at the governing position (for the worked steps). */
  const leverC = (pos, Nb, j, uw) => SL().leverContribution(pos, Nb, j, uw);
  const withC = (p, geo, j, L) => L ? { ...L, c: L.wheels.map(u => leverC(SL().girderU(p, geo), p.Nb, j, u)) } : L;
  function lever(p, geo, j, N) { const q = lp(p); return withC(q, geo, j, SL().leverConfig(q, geo, j, N)); }
  function leverAll(p, geo, j) { const q = lp(p), r = SL().leverAll(q, geo, j), cfgs = r.cfgs.map(c => withC(q, geo, j, c)); return { cfgs, gov: r.gov ? cfgs[r.cfgs.indexOf(r.gov)] : null }; }
  function leverMulti(p, geo, j) { const q = lp(p); return withC(q, geo, j, SL().leverMulti(q, geo, j)); }
  function leverSteps(w, id, L, what) {
    if (!L) return;
    w.add({ id: id + '.R', label: `Lever rule, ${L.N} truck${L.N > 1 ? 's' : ''} (${what}): girder reaction per wheel load pair, wheels at ${L.wheels.map(n2).join(', ')} ft from the left deck edge`, sym: 'R', eq: '\\sum 0.5c_{i}', sub: L.c.map(c => `0.5(${n3(c)})`).join(' + '), value: L.R, unit: 'lanes', d: 4, ref: `${ED} Art. 4.6.2.2.1, C4.6.2.2.1` });
    w.add({ id: id + '.g', label: `Lever rule with the multiple presence factor, ${L.N} lane${L.N > 1 ? 's' : ''}`, sym: 'g', eq: 'mR', sub: `${n2(L.m)}(${n4(L.R)})`, value: L.df, unit: '', d: 4, ref: `${ED} Table 3.6.1.1.2-1` });
  }
  /* rigid cross-section, Eq. C4.6.2.2.2d-1: R = N_L/N_b + X_ext Σe / Σx², g = m R (SharedLLDF.rigidMethod) */
  function rigid(p, geo, side) { return SL().rigidMethod(lp(p), geo, side); }
  function rigidSteps(w, rig, Nb) {
    rig.trials.forEach(t => {
      w.add({ id: `rig${t.n}.R`, label: `Rigid cross-section, ${t.n} lane${t.n > 1 ? 's' : ''} loaded (lane resultants ${rig.ecc.slice(0, t.n).map(n2).join(', ')} ft from the centroid)`, sym: 'R', eq: '\\frac{N_{L}}{N_{b}} + \\frac{X_{ext}\\sum e}{\\sum x^{2}}', sub: `\\frac{${t.n}}{${Nb}} + \\frac{${n2(rig.Xext)}(${n2(t.sumE)})}{${n2(rig.sumX2)}}`, value: t.R, unit: '', d: 4, ref: `${ED} Eq. C4.6.2.2.2d-1` });
      w.add({ id: `rig${t.n}.g`, label: `Rigid cross-section with the multiple presence factor, ${t.n} lane${t.n > 1 ? 's' : ''}`, sym: 'g', eq: 'mR', sub: `${n2(t.m)}(${n4(t.R)})`, value: t.g, unit: '', d: 4, ref: `${ED} Art. 4.6.2.2.2d, Table 3.6.1.1.2-1` });
    });
    w.add({ id: 'rig', label: 'Rigid cross-section, governing', sym: 'g_{rigid}', eq: '\\max(g)', sub: rig.trials.map(t => n4(t.g)).join(',\\ '), value: rig.g, unit: '', d: 4, ref: `${ED} Art. 4.6.2.2.2d`, note: `${rig.nLoaded} lane${rig.nLoaded > 1 ? 's' : ''} loaded governs.` });
  }

  /* member(p, geo, Kg, sk, j): the factors of girder j (0-based): SharedLLDF.memberDF (lldf.html memberDF, type (a)), mapped to
     { j, label, type, S, emp, alt, r: { mom1, mom2, shr1, shr2 }, gM, gV, fatM, fatV, method, … }. Interior: equations (S > 16 ft:
     lever rule; N_b = 3: moment the lesser of the equation and the lever rule, shear the lever rule; multi-lane lever rule = the
     governing of 2 … N_L trucks). Exterior: one lane lever rule; two or more lanes e × interior (d_e ≥ −1.0 ft), not less than the
     rigid cross-section value. Skew factors on every value. Fatigue: one-lane value / 1.2; exterior one-lane value = max(lever
     rule, rigid cross-section with one lane) (4.6.2.2.2d). sk: skew() (with scfV = 1 for the shear-skew option). */
  function member(p, geo, Kg, sk, j, w) {
    const q = lp(p), md = SL().memberDF(q, geo, Kg, sk, j), type = md.type, S = md.S, label = 'G' + (j + 1), e = md.emp, n3b = p.Nb === 3, tooWide = !!md.tooWide;
    if (w) { w.add({ id: 'S', label: type === 'int' ? 'Girder spacing (average of the two adjacent bays)' : 'Girder spacing (the adjacent bay)', sym: 'S', eq: '', sub: '', value: S, unit: 'ft', d: 3 }); empSteps(w, e, S, p.L, p.ts, Kg, p.simple); }
    if (type === 'int') {
      const lv = md.lvUsed || md.n3info, alt = lv ? { l1: withC(q, geo, j, lv.lv1), l2: withC(q, geo, j, lv.lv2), why: tooWide ? 'S > 16 ft: lever rule' : 'N_b = 3: moment lesser of equation and lever rule; shear by lever rule' } : null;
      let mom1 = e.mom1, mom2 = e.mom2, shr1 = e.shr1, shr2 = e.shr2;   // the factors before the skew factors (as memberDF forms them)
      if (tooWide) { mom1 = shr1 = alt.l1 ? alt.l1.df : 0; mom2 = shr2 = alt.l2 ? alt.l2.df : 0; }
      else if (n3b) { mom1 = Math.min(mom1, alt.l1 ? alt.l1.df : mom1); mom2 = Math.min(mom2, alt.l2 ? alt.l2.df : mom2); shr1 = alt.l1 ? alt.l1.df : shr1; shr2 = alt.l2 ? alt.l2.df : shr2; }
      const o = { j, label, type, S, emp: e, alt, r: { ...md.r }, gM: md.gM, gV: md.gV, fatM: md.fatM, fatV: md.fatV, method: tooWide ? 'lever rule (S > 16 ft)' : n3b ? 'N_b = 3 rules' : 'equations' };
      if (w) memberSteps(w, o, sk, alt, mom1, mom2, shr1, shr2);
      return o;
    }
    const side = md.side, de0 = side === 'L' ? geo.deL : geo.deR, lv = md.lvUsed || md.n3info;
    const alt = lv ? { l2: withC(q, geo, j, lv.lv2), why: tooWide ? 'S > 16 ft: lever rule' : 'N_b = 3' } : null;
    const r = { mom1: md.r.momExt1, mom2: md.r.momExt2, shr1: md.r.shrExt1, shr2: md.r.shrExt2 }, rig = md.rig;
    const l1 = md.lever1 ? md.lever1.df : 0, rig1 = rig.trials && rig.trials.length ? rig.trials[0].g : 0;
    const base = r.mom1 >= r.mom2 ? 'lever rule, one lane' : rig.g > md.mE ? 'rigid cross-section' : 'e-factor';
    const o = { j, label, type, S, side, de0, de: md.de, emp: e, lever1: withC(q, geo, j, md.lever1), eM: md.eM, eV: md.eV, mE: md.mE, vE: md.vE, rig, alt, r, gM: md.gM, gV: md.gV,
      fatM: md.fatM, fatV: md.fatV, rig1, fat1: Math.max(l1, rig1), fatOneM: md.fatOneM, fatOneV: md.fatOneV, method: base };
    if (w) extSteps(w, o, sk, p.Nb);
    return o;
  }
  function memberSteps(w, o, sk, alt, mom1, mom2, shr1, shr2) {
    if (alt) { leverSteps(w, 'lev1', alt.l1, 'one lane'); leverSteps(w, 'lev2', alt.l2, 'two or more lanes, the governing number of trucks'); }
    const why = alt ? alt.why : '';
    w.add({ id: 'gM1', label: 'Moment, one lane loaded, with the skew reduction', sym: 'g_{M,1}', eq: alt ? 'g_{1}r_{M}' : 'g_{M,1}r_{M}', sub: `${n4(mom1)}(${n4(sk.scfM)})`, value: o.r.mom1, unit: '', d: 4, ref: `${ED} Tables 4.6.2.2.2b-1, 4.6.2.2.2e-1`, note: why });
    w.add({ id: 'gM2', label: 'Moment, two or more lanes loaded, with the skew reduction', sym: 'g_{M,2}', eq: alt ? 'g_{2}r_{M}' : 'g_{M,2}r_{M}', sub: `${n4(mom2)}(${n4(sk.scfM)})`, value: o.r.mom2, unit: '', d: 4, ref: `${ED} Tables 4.6.2.2.2b-1, 4.6.2.2.2e-1` });
    w.add({ id: 'gV1', label: 'Shear, one lane loaded, with the skew correction', sym: 'g_{V,1}', eq: alt ? 'g_{1}r_{V}' : 'g_{V,1}r_{V}', sub: `${n4(shr1)}(${n4(sk.scfV)})`, value: o.r.shr1, unit: '', d: 4, ref: `${ED} Tables 4.6.2.2.3a-1, 4.6.2.2.3c-1` });
    w.add({ id: 'gV2', label: 'Shear, two or more lanes loaded, with the skew correction', sym: 'g_{V,2}', eq: alt ? 'g_{2}r_{V}' : 'g_{V,2}r_{V}', sub: `${n4(shr2)}(${n4(sk.scfV)})`, value: o.r.shr2, unit: '', d: 4, ref: `${ED} Tables 4.6.2.2.3a-1, 4.6.2.2.3c-1` });
    finalSteps(w, o);
  }
  function extSteps(w, o, sk, Nb) {
    leverSteps(w, 'lev1', o.lever1, 'one lane');
    w.add({ id: 'de', label: 'd_e used in the e-factors', sym: 'd_{e}', eq: '\\max(d_{e}, -1.0)', sub: `\\max(${n2(o.de0)}, -1.0)`, value: o.de, unit: 'ft', d: 2, ref: `${ED} Table 4.6.2.2.2d-1`, note: o.de0 > 5.5 + 1e-9 ? 'd_e > 5.5 ft: outside the range of applicability.' : '' });
    w.add({ id: 'eM', label: 'Correction factor e for moment', sym: 'e', eq: '0.77 + \\frac{d_{e}}{9.1}', sub: `0.77 + \\frac{${n2(o.de)}}{9.1}`, value: o.eM, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.2d-1` });
    w.add({ id: 'eV', label: 'Correction factor e for shear', sym: 'e', eq: '0.60 + \\frac{d_{e}}{10}', sub: `0.60 + \\frac{${n2(o.de)}}{10}`, value: o.eV, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.3b-1` });
    if (o.alt) leverSteps(w, 'lev2', o.alt.l2, 'two or more lanes, the governing number of trucks');
    w.add({ id: 'mE', label: o.alt ? `Moment, two or more lanes (${o.alt.why})` : 'Moment, two or more lanes: e × interior equation', sym: 'g_{M,2}', eq: o.alt ? '' : 'e\\,g_{M,2,int}', sub: o.alt ? '' : `${n4(o.eM)}(${n4(o.emp.mom2)})`, value: o.mE, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.2d-1` });
    w.add({ id: 'vE', label: o.alt ? `Shear, two or more lanes (${o.alt.why})` : 'Shear, two or more lanes: e × interior equation', sym: 'g_{V,2}', eq: o.alt ? '' : 'e\\,g_{V,2,int}', sub: o.alt ? '' : `${n4(o.eV)}(${n4(o.emp.shr2)})`, value: o.vE, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.3b-1` });
    rigidSteps(w, o.rig, Nb);
    const l1 = o.lever1 ? o.lever1.df : 0;
    w.add({ id: 'gM1', label: 'Moment, one lane: lever rule, with the skew reduction', sym: 'g_{M,1}', eq: 'g_{lever,1}r_{M}', sub: `${n4(l1)}(${n4(sk.scfM)})`, value: o.r.mom1, unit: '', d: 4, ref: `${ED} Tables 4.6.2.2.2d-1, 4.6.2.2.2e-1` });
    w.add({ id: 'gM2', label: 'Moment, two or more lanes: not less than the rigid cross-section, with the skew reduction', sym: 'g_{M,2}', eq: '\\max(g_{M,2}, g_{rigid})r_{M}', sub: `\\max(${n4(o.mE)}, ${n4(o.rig.g)})(${n4(sk.scfM)})`, value: o.r.mom2, unit: '', d: 4, ref: `${ED} Art. 4.6.2.2.2d, Table 4.6.2.2.2e-1` });
    w.add({ id: 'gV1', label: 'Shear, one lane: lever rule, with the skew correction', sym: 'g_{V,1}', eq: 'g_{lever,1}r_{V}', sub: `${n4(l1)}(${n4(sk.scfV)})`, value: o.r.shr1, unit: '', d: 4, ref: `${ED} Tables 4.6.2.2.3b-1, 4.6.2.2.3c-1` });
    w.add({ id: 'gV2', label: 'Shear, two or more lanes: not less than the rigid cross-section, with the skew correction', sym: 'g_{V,2}', eq: '\\max(g_{V,2}, g_{rigid})r_{V}', sub: `\\max(${n4(o.vE)}, ${n4(o.rig.g)})(${n4(sk.scfV)})`, value: o.r.shr2, unit: '', d: 4, ref: `${ED} Art. 4.6.2.2.2d, Table 4.6.2.2.3c-1` });
    finalSteps(w, o);
  }
  function finalSteps(w, o) {
    w.add({ id: 'gM', label: `${o.label}: live-load distribution factor for moment (${o.method})`, sym: 'g_{M}', eq: '\\max(g_{M,1}, g_{M,2})', sub: `\\max(${n4(o.r.mom1)}, ${n4(o.r.mom2)})`, value: o.gM, unit: '', d: 4, ref: `${ED} Art. 4.6.2.2.2` });
    w.add({ id: 'gV', label: `${o.label}: live-load distribution factor for shear`, sym: 'g_{V}', eq: '\\max(g_{V,1}, g_{V,2})', sub: `\\max(${n4(o.r.shr1)}, ${n4(o.r.shr2)})`, value: o.gV, unit: '', d: 4, ref: `${ED} Art. 4.6.2.2.3` });
    if (o.type === 'ext') {   // 4.6.2.2.2d: the exterior factor not less than the rigid cross-section value, also for fatigue (one lane)
      const sM = o.fatOneM / (o.fat1 || 1), l1 = o.lever1 ? o.lever1.df : 0;
      w.add({ id: 'fat1', label: `${o.label}: one-lane factor for fatigue: the larger of the lever rule and the rigid cross-section with one lane loaded`, sym: 'g_{1}', eq: '\\max(g_{lever,1}, g_{rigid,1})', sub: `\\max(${n4(l1)}, ${n4(o.rig1)})`, value: o.fat1, unit: '', d: 4, ref: `${ED} Art. 4.6.2.2.2d, Eq. C4.6.2.2.2d-1`,
        note: o.rig1 > l1 + 1e-9 ? 'The rigid cross-section governs (it exceeds the one-lane lever rule).' : 'The lever rule governs.' });
      w.add({ id: 'fatM', label: `${o.label}: fatigue factor for moment (one lane, multiple presence 1.2 removed)`, sym: 'g_{fat,M}', eq: '\\frac{g_{1}r_{M}}{1.2}', sub: `\\frac{${n4(o.fat1)}(${n4(sM)})}{1.2}`, value: o.fatM, unit: '', d: 4, ref: `${ED} Art. 3.6.1.4.3b, C3.6.1.1.2, Art. 4.6.2.2.2d` });
      w.add({ id: 'fatV', label: `${o.label}: fatigue factor for shear`, sym: 'g_{fat,V}', eq: '\\frac{g_{1}r_{V}}{1.2}', sub: `\\frac{${n4(o.fat1)}(${n4(o.fatOneV / (o.fat1 || 1))})}{1.2}`, value: o.fatV, unit: '', d: 4, ref: `${ED} Art. 3.6.1.4.3b, C3.6.1.1.2, Art. 4.6.2.2.2d` });
      return;
    }
    w.add({ id: 'fatM', label: `${o.label}: fatigue factor for moment (one lane, multiple presence 1.2 removed)`, sym: 'g_{fat,M}', eq: '\\frac{g_{M,1}}{1.2}', sub: `\\frac{${n4(o.r.mom1)}}{1.2}`, value: o.fatM, unit: '', d: 4, ref: `${ED} Art. 3.6.1.4.3b, C3.6.1.1.2` });
    w.add({ id: 'fatV', label: `${o.label}: fatigue factor for shear`, sym: 'g_{fat,V}', eq: '\\frac{g_{V,1}}{1.2}', sub: `\\frac{${n4(o.r.shr1)}}{1.2}`, value: o.fatV, unit: '', d: 4, ref: `${ED} Art. 3.6.1.4.3b, C3.6.1.1.2` });
  }

  /* Kg(s, n, hP, ts): longitudinal stiffness parameter, Eq. 4.6.2.2.1-1: K_g = n(I + A e_g²), e_g = (d − ȳ) + haunch + t_s/2
     (GirderDetail KgOf). s: steel section { A, yb, I, d } (SBDSections steel core); hP the haunch in the composite properties
     (0 under the owner rule OWN8). */
  function Kg(s, n, hP, ts) { const eg = (s.d - s.yb) + hP + ts / 2; return { eg, Kg: n * (s.I + s.A * eg * eg) }; }
  const steelOf = sec => window.SBDSections.steelCore(sec);

  /* compute(input): every region (span and pier) and every girder.
     input: { Nb, spacings [ft], OL, OR, rL, rR (ft), ts (structural slab, in), haunchP (haunch in the composite properties, in),
              n (modular ratio), gap (ft, ≥ 4), kg: 'max' | 'avg' | 'simple', skewV: 'all' | 'ext', extMin: 'yes' | 'no',
              skews (deg, every support line, for the pier rule of 4.6.2.2.2e), regions: [{ id, i, kind: 'span' | 'sup', label, L (ft), skA, skB (support skews, deg), sec: plates { D, tw, topB, topT, botB, botT },
                          segs: [{ L, sec }] (the plate pieces of the region, for kg 'avg') }] }
     Returns { geo, regions: [{ …region, s, eg, Kg, KgAvg, pp, geo, sk, members, lever, mD, gDef, steps }], steps (geometry) }. */
  function compute(q) {
    const base = { Nb: q.Nb, spacings: q.spacings, OL: q.OL, OR: q.OR, rL: q.rL, rR: q.rR, fL: q.fL, fR: q.fR, ts: q.ts, gap: q.gap, simple: q.kg === 'simple' };
    const KgOf = s => Kg(s, q.n, q.haunchP, q.ts);
    const regions = q.regions.map(rg => {
      const s = steelOf(rg.sec), k0 = KgOf(s), eg = k0.eg; let Kgv = k0.Kg, KgAvg = null;
      if (rg.segs && rg.segs.length) { const Lt = sum(rg.segs.map(x => x.L)); KgAvg = { parts: rg.segs.map(x => ({ L: x.L, sec: x.sec, Kg: KgOf(steelOf(x.sec)).Kg })), Lt }; KgAvg.Kg = sum(KgAvg.parts.map(x => x.L * x.Kg)) / Lt; if (q.kg === 'avg') Kgv = KgAvg.Kg; }
      const ms = momentSkew(rg, q.skews), pp = { ...base, L: rg.L, skewM: Math.min(rg.skA, rg.skB), skewV: Math.max(rg.skA, rg.skB), ...ms }, geo = geometry(pp), sk = skew(pp, geo, Kgv);   // ms: 4.6.2.2.2e per span / pier
      const w = St().work('df.' + rg.id);
      w.add({ id: 'eg', label: `${rg.label}: distance between the centers of gravity of the girder and the deck`, sym: 'e_{g}', eq: '(d - \\bar{y}) + h + \\frac{t_{s}}{2}', sub: `(${n3(s.d)} - ${n3(s.yb)}) + ${n2(q.haunchP)} + \\frac{${n2(q.ts)}}{2}`, value: eg, unit: 'in', d: 3, ref: `${ED} Art. 4.6.2.2.1`, note: q.haunchNote || '' });
      w.add({ id: 'Kg0', label: `${rg.label}: longitudinal stiffness parameter at the region's section`, sym: 'K_{g}', eq: 'n(I + Ae_{g}^{2})', sub: `${n3(q.n)}(${g0(s.I)} + ${n2(s.A)}(${n3(eg)})^{2})`, value: k0.Kg, unit: 'in^{4}', d: 0, ref: `${ED} Eq. 4.6.2.2.1-1` });
      if (KgAvg) w.add({ id: 'KgAvg', label: `${rg.label}: length-weighted K_g of the plate pieces`, sym: 'K_{g,avg}', eq: '\\frac{\\sum L_{i}K_{g,i}}{\\sum L_{i}}', sub: `\\frac{${KgAvg.parts.map(x => `${n2(x.L)}(${g0(x.Kg)})`).join(' + ')}}{${n2(KgAvg.Lt)}}`, value: KgAvg.Kg, unit: 'in^{4}', d: 0, ref: `${ED} Art. 4.6.2.2.1` });
      w.add({ id: 'Kg', label: `${rg.label}: K_g used`, sym: 'K_{g}', eq: q.kg === 'avg' && KgAvg ? 'K_{g,avg}' : 'K_{g}', sub: '', value: Kgv, unit: 'in^{4}', d: 0, note: q.kg === 'simple' ? 'Simplified K_g terms of Table 4.6.2.2.1-3 used in the equations.' : '' });
      skewSteps(w, { ...pp, geoSavg: geo.Savg, pier: rg.kind === 'sup' }, sk, Kgv);
      const members = []; for (let j = 0; j < q.Nb; j++) { const mw = St().work(`df.${rg.id}.G${j + 1}`);
        members.push(member(pp, geo, Kgv, q.skewV === 'ext' && typeOf(pp, j) === 'int' ? { ...sk, scfV: 1 } : sk, j, mw)); members[j].steps = mw.steps; }
      if (q.extMin === 'yes') { const ints = members.filter(m => m.type === 'int'); if (ints.length) { const iM = Math.max(...ints.map(m => m.gM)), iV = Math.max(...ints.map(m => m.gV));
        members.filter(m => m.type === 'ext').forEach(m => { if (iM > m.gM) { m.gM = iM; m.policyM = true; } if (iV > m.gV) { m.gV = iV; m.policyV = true; } if (m.policyM || m.policyV) { m.method += ', raised to interior (policy)';
          m.steps.push(St().step({ id: `df.${rg.id}.G${m.j + 1}.policy`, label: `${m.label}: exterior factors not less than the interior (owner / engineer policy)`, sym: 'g_{M}, g_{V}', eq: '\\max(g_{ext}, g_{int})', sub: '', value: `${n4(m.gM)}, ${n4(m.gV)}`, unit: '', d: 4 })); } }); } }
      const lev = members.map((m, j) => leverAll(pp, geo, j)), mD = MPF(geo.NL), gDef = geo.NL * mD / q.Nb;
      w.add({ id: 'gDef', label: `${rg.label}: deflection distribution factor (all lanes loaded, all girders equal)`, sym: 'g_{\\Delta}', eq: '\\frac{N_{L}m}{N_{b}}', sub: `\\frac{${geo.NL}(${n2(mD)})}{${q.Nb}}`, value: gDef, unit: '', d: 4, ref: `${ED} Art. 2.5.2.6.2` });
      return { ...rg, s, eg, Kg: Kgv, KgAvg, pp, geo, sk, members, lever: lev, mD, gDef, steps: w.steps };
    });
    const geo0 = regions.length ? regions[0].geo : geometry({ ...base, L: 1, skewM: 0, skewV: 0 });
    return { regions, geo: geo0, steps: geometrySteps(base, geo0) };
  }

  /* range checks (GirderDetail check DF1): [{ region, key, value, lo, hi, ok }] */
  function ranges(R, ts, Nb) {
    const out = [];
    R.regions.forEach(rg => { const g = rg.geo, v = { S: g.Savg, L: rg.L, ts, Nb, Kg: rg.Kg };
      Object.entries(RANGE).forEach(([k, [lo, hi, u, nm]]) => { const x = v[k]; out.push({ region: rg.label, key: k, name: nm, unit: u, value: x, lo, hi, ok: x >= lo - 1e-9 && x <= hi + 1e-9 }); });
      [['left', g.deL], ['right', g.deR]].forEach(([sd, de]) => out.push({ region: rg.label, key: 'de', name: `d_e ${sd}`, unit: 'ft', value: de, lo: -1.0, hi: 5.5, ok: de >= -1.0 - 1e-9 && de <= 5.5 + 1e-9 })); });
    return out;
  }

  /* regions(spans, cont, skews, segments, x): the span and pier regions of GirderDetail's bridge hand-off (Preliminary sizing
     bridgeDef): span i from support i to i + 1, its section at station x[i] (default mid-span; GirderDetail: the station of the
     largest positive moment of Preliminary sizing's analysis), its plate pieces between the supports; pier i (continuous only):
     L the average of the adjacent spans, its section at the support − 0.01 ft, its pieces from 0.2 of each adjacent span.
     segments: [{ x0, x1, D, tw, topB, topT, botB, botT }] (ft from the left end, in). */
  function regions(spans, cont, skews, segments, xs) {
    const sup = [0]; spans.forEach(L => sup.push(sup[sup.length - 1] + L));
    const secAt = x => { const s = segments.find(q => x >= q.x0 - 1e-9 && x <= q.x1 + 1e-9) || segments[segments.length - 1]; return { D: s.D, tw: s.tw, topB: s.topB, topT: s.topT, botB: s.botB, botT: s.botT }; };
    const segs = (a0, a1) => { const br = new Set([a0, a1]); segments.forEach(r => [r.x0, r.x1].forEach(v => { if (v > a0 + 1e-6 && v < a1 - 1e-6) br.add(v); }));
      const pts = [...br].sort((a, b) => a - b), out = []; for (let k = 0; k < pts.length - 1; k++) { const L = pts[k + 1] - pts[k]; if (L > 1e-6) out.push({ L: +L.toFixed(3), sec: secAt((pts[k] + pts[k + 1]) / 2) }); } return out; };
    const out = [], nSp = spans.length, sk = i => +(skews && skews[i]) || 0;
    for (let i = 0; i < nSp; i++) { const x0 = sup[i], x1 = sup[i + 1], x = xs && isFinite(xs[i]) ? xs[i] : (x0 + x1) / 2;
      out.push({ id: 's' + i, kind: 'span', i, label: `Span ${i + 1}`, L: +(x1 - x0).toFixed(3), x: +x.toFixed(2), sec: secAt(x), segs: segs(x0, x1), skA: sk(i), skB: sk(i + 1) }); }
    if (cont) for (let i = 1; i < nSp; i++) { const x = sup[i];
      out.push({ id: 'p' + i, kind: 'sup', i, label: `Pier ${i}`, L: +(((sup[i] - sup[i - 1]) + (sup[i + 1] - sup[i])) / 2).toFixed(3), x: +x.toFixed(2), sec: secAt(x - 0.01), segs: segs(x - 0.2 * (sup[i] - sup[i - 1]), x + 0.2 * (sup[i + 1] - sup[i])), skA: sk(i), skB: sk(i) }); }
    return out;
  }

  window.SBDLldf = { MPF, RANGE, SIMPLE, geometry, typeOf, spacingOf, momentSkew, skew, emp, leverC, lever, leverAll, leverMulti, rigid, member, Kg, compute, ranges, regions };
})();
