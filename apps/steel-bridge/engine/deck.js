/* apps/steel-bridge/engine/deck.js — transverse design of the concrete deck slab (window.SBDDeck). Classic script, no DOM.
   Created 2026-11-23 (DK; engineer request 2026-11-23: the deck design of the Prestressed Bridge Design app in the Steel Bridge app).
   Needs window.SharedDeck (shared/deck.js: the calculation, the same method and arithmetic as the Prestressed app's deck module),
   window.SharedSteps, window.SBDLoads (the cross-section and its dead loads), window.SBDOwners (through SBDLoads), loaded first.

   AASHTO LRFD 10th Ed. (2024): strip method 4.6.2.1, design section 4.6.2.1.6 (steel I-girder: one quarter of the top flange width from
   the girder centreline), live load Table A4-1, Strength I Table 3.4.1-1 with the owner's eta and HL-93 multiplier m (Project tab),
   flexural resistance 5.6.3.2 with phi of 5.5.4.2, overhang wheel 3.6.1.3.1 on the strip of Table 4.6.2.1.3-1, distribution
   reinforcement 9.7.3.2; since 2026-11-24 (DKTS / DKCR, engineer request) shrinkage and temperature reinforcement 5.10.6 (DK5) and crack
   control 5.6.7 of the transverse bars at Service I (DK6), worked in tsOf / crackAll below. Not checked (stated on the tab and in the
   report): the Extreme Event II collision cases of the overhang (A13.4), minimum reinforcement (5.6.3.3), maximum spacing 5.10.3.2.

   Inputs. Nothing the project already holds is asked again:
     girder spacings          xs.bays (Cross-section tab): each different spacing is designed, the largest M_u governs
     overhangs                xs.ohL, xs.ohR; the deck edge loads, sidewalks, wearing surface, overlays and added line loads of the Loads
                              module (SBDLoads.compute dead.per: position and weight of each, overrides included); the traffic face of the
                              live load (its ll.L.r / ll.R.r): the wheel is 1 ft inside it
     slab                     deck.ts (resistance), deck.tdeck (dead load), materials.concrete.fc, wc; rebar F_y materials.rebar.Fyr
     top flange width         the narrowest top flange of every girder type and plate segment (the largest negative moment)
     effective span (DD)      the distribution reinforcement (9.7.3.2) on S_eff of 9.7.2.3 = S - b_f/12 + (b_f - t_w)/24, S the smallest
                              spacing, b_f and t_w of the segment with the largest b_f + t_w (every girder type and segment; rolled shapes
                              by their equivalent plates): the shortest effective span, the largest percentage (conservative)
     owner rules              eta and m of SBDOwners.loadFactors (the loads module's lf)
   The module's own inputs, P.deckDesign (OPTIONAL; absent in every project saved before 2026-11-23, which reads as DEF: off):
     { on (false), barTop, barBot (area of one bar, in^2), sTop, sBot (spacing, in), coverT, coverB (clear cover, in),
       xnegAuto (true: b_f/4), xneg (entered design section, in),
       barLongTop, sLongTop, barLongBot, sLongBot (DKL, 2026-11-24: the LONGITUDINAL bars, parallel to the girders: area of one bar in^2 and
       spacing in; OPTIONAL and not in DEF: absent in every project saved before, which reads as "not entered"),
       exposure (DKCR, 2026-11-24: the crack control exposure condition of 5.6.7, 1 | 2; OPTIONAL and not in DEF: absent reads as Class 1) }
   DKTS / DKCR (2026-11-24): DK5 (5.10.6, every bar set entered: area and spacing; longitudinal sets not entered: not checked) and DK6
   (5.6.7 on the transverse bars, Service I) are always in checks (the transverse bars always exist), so the deck verdict of a project
   with the deck design on can change. checks of DK4 to DK6 carry dem / cap ({ sym (TeX), v, unit }: the demand and the limit).
   DKL (2026-11-24, engineer request "The deck is missing the transverse steel"): the bottom longitudinal bars, where entered, are checked
   against the required distribution reinforcement: DK4 A_s,d (9.7.3.2 on S_eff of 9.7.2.3) <= A_s,prov = 12 A_b / s. Not entered: no DK4,
   the checks and verdicts are those of before. The top longitudinal bars are drawn and reported only (not checked).
   Decision (pending engineer review): the module is OFF until switched on (old and new projects), as the Prestressed app's deck module;
   while it is off nothing is calculated and no result, Summary verdict or report section changes.

   calc(P) -> { on: false } | { on: true, err } | { on: true, D, in: {…}, bays: [{ S, lines, I, pos, neg }], gp, gn (governing bay index),
     oh: { L, R: { O, cap, side, name } }, go ('L' | 'R'), dist: { S, pct, As, Seff, bf, tw, at, pct0, E }, long: longBars(D) (+ bot.As, r, ok),
     ts: { tsOf() + sets }, crack: crackAll(),
     checks: [{ id, title, ref, r, Mu, phiMn, ok, loc, step }] (DK4: Mu, phiMn null; req, prov, unit; DK4 to DK6: dem, cap),
     warn: [text], steps }   (moments kip-ft per foot of deck) */
(function () {
  'use strict';
  const DEF = { on: false, barTop: 0.31, sTop: 6, coverT: 2.5, barBot: 0.31, sBot: 6, coverB: 1.0, xnegAuto: true, xneg: 0 };
  const BARS = [['#3', 0.11], ['#4', 0.20], ['#5', 0.31], ['#6', 0.44], ['#7', 0.60], ['#8', 0.79], ['#9', 1.00], ['#10', 1.27], ['#11', 1.56]];   // ASTM A615 bar areas, in^2
  const ED = 'AASHTO LRFD 10th Ed. ';
  const SD = () => window.SharedDeck, St = () => window.SharedSteps;
  const inputs = P => ({ ...DEF, ...((P && P.deckDesign && typeof P.deckDesign === 'object') ? P.deckDesign : {}) });
  const isOn = P => !!(P && P.deckDesign && P.deckDesign.on === true);
  const barName = A => { const b = BARS.find(q => Math.abs(q[1] - A) < 1e-9); return b ? b[0] : `${St().fmt(A, 2)} in²`; };
  const fin = v => typeof v === 'number' && isFinite(v);
  /* longBars(D): the longitudinal bars (DKL) { top, bot: null | { A, s, db }, topPart, botPart (one of the two entered, the other not) } */
  const LONG = [['top', 'barLongTop', 'sLongTop'], ['bot', 'barLongBot', 'sLongBot']];
  function longBars(D) {
    const o = {}; LONG.forEach(([k, a, sp]) => { const A = +D[a], s = +D[sp], okA = fin(A) && A > 0, okS = fin(s) && s > 0;
      o[k] = okA && okS ? { A, s, db: Math.sqrt(4 * A / Math.PI) } : null; o[k + 'Part'] = !o[k] && (okA || okS); });
    return o;
  }
  const META = new WeakMap();   // steps list -> its result (the topics' titles)

  /* loadsOf(P): the loads module's cross-section (no change to P) */
  function loadsOf(P) {
    const LD = window.SBDLoads, q = LD.fromModel(P, { girder: 0 });
    return LD.compute(q.b, q.p);
  }
  /* sideLoads(R, sd): the loads of the Loads module on the overhang of side 'L' | 'R', positions measured from that side's deck edge.
     DC: categories DC1, DC2 and UF (factor 1.25); DW: DW and UT (factor 1.50); PL: the pedestrian load. */
  function sideLoads(R, sd) {
    const Wd = R.dead.Wd, oh = sd === 'L' ? +R.b.ohL : +R.b.ohR, fx = x => (sd === 'L' ? x : Wd - x), out = { DC: [], DW: [], PL: [] };
    R.dead.per.forEach(L => {
      const grp = L.cat === 'DW' || L.cat === 'UT' ? 'DW' : L.cat === 'PL' ? 'PL' : 'DC';
      let q = null;
      if (L.def && L.def.kind === 'ped' && L.def.w > 0) q = { q: L.plf / L.def.w, x0: fx(L.x - L.def.w / 2), x1: fx(L.x + L.def.w / 2) };
      else if (L.x0 != null && L.x1 != null && L.x1 > L.x0) q = { q: L.plfAuto === undefined && L.def && L.def.kind === 'area' ? L.def.q / 1000 : L.plf / (L.x1 - L.x0), x0: fx(L.x0), x1: fx(L.x1) };
      else q = { w: L.plf, x: fx(L.x) };
      if (q.q != null) { const a = Math.min(q.x0, q.x1), b = Math.max(q.x0, q.x1); q.x0 = a; q.x1 = b; if (!(a < oh - 1e-9)) return; }
      else if (!(q.x < oh - 1e-9) || q.x < -1e-9) return;
      out[grp].push({ ...q, name: L.desc || L.id, id: L.id, cat: L.cat });
    });
    return { oh, ...out };
  }

  /* ---------- DKTS (2026-11-24): shrinkage and temperature reinforcement, AASHTO LRFD 10th Ed. Art. 5.10.6 (engineer request 2026-11-24) ----------
     Bars on each face and in each direction: A_s >= 1.30 b h / (2 (b + h) f_y) per foot (Eq. 5.10.6-1), within 0.11 to 0.60 in^2/ft
     (Eq. 5.10.6-2); f_y not over 75 ksi; b the least width of the component (the deck width out-to-out), h its least thickness (the total
     deck thickness as cast, t_L). Spacing: components over 36 in thick 12 in (walls and footings over 18 in are not decks); otherwise
     3.0 times the thickness and 18.0 in. Engineer decision 2026-11-24 (confirmed): s_max = min(3h, 18 in), the lesser of the two (the 9th Ed.
     reading; the 10th Ed. words "3.0 times the component thickness but not less than 18.0 in" can also be read as max(3h, 18 in), which
     allows more for decks thicker than 6 in). The faces exempted by the article (faces whose smaller dimension is 18 in or less) are the
     deck edges, not the top and bottom faces. Sets: the top and bottom transverse bars (always), the top and bottom longitudinal bars
     where entered (DKL); a longitudinal set not entered: "not checked". */
  const TS_SETS = [['tt', 'Top transverse bars', 'barTop', 'sTop'], ['bt', 'Bottom transverse bars', 'barBot', 'sBot'], ['tl', 'Top longitudinal bars', 'long.top'], ['bl', 'Bottom longitudinal bars', 'long.bot']];
  function tsOf(h, b, fy) {
    const fyU = Math.min(fy, 75), eq = 1.30 * b * h / (2 * (b + h) * fyU), A = Math.min(Math.max(eq, 0.11), 0.60), s3 = 3 * h, smax = h > 36 ? 12 : Math.min(s3, 18);
    return { h, b, fy, fyU, eq, A, s3, smax, lo: eq < 0.11, hi: eq > 0.60 };
  }
  function tsSets(D, LB, T) {
    return TS_SETS.map(([k, name, a, sp]) => { let A, s;
      if (a === 'long.top' || a === 'long.bot') { const q = LB[a.slice(5)]; if (!q) return { k, name, on: false }; A = q.A; s = q.s; } else { A = +D[a]; s = +D[sp]; }
      const As = 12 * A / s, rA = T.A / As, rs = s / T.smax;
      return { k, name, on: true, A, s, As, rA, rs, r: Math.max(rA, rs), ok: T.A <= As && s <= T.smax, by: rA >= rs ? 'area' : 'spacing' }; });
  }
  function tsSteps(steps, T, sets) {
    const w = St().work('dk.ts'), n = St().n, R = ED + 'Art. 5.10.6';
    w.add({ id: 'h', label: 'Shrinkage and temperature: least thickness of the deck (the total deck thickness as cast)', sym: 'h', eq: 't_{L}', sub: n(T.h, 2), value: T.h, unit: 'in', d: 2, ref: R, note: 'Structural slab plus the dead-load-only (integral wearing) thickness, Cross-section tab, Deck.' });
    w.add({ id: 'b', label: 'Shrinkage and temperature: least width of the deck (out-to-out width)', sym: 'b', eq: '12\\,W_{d}', sub: `12(${n(T.b / 12, 3)})`, value: T.b, unit: 'in', d: 1, ref: R, note: 'W_d the deck width out-to-out (ft), as the Loads & LLDF module.' });
    w.add({ id: 'fy', label: 'Shrinkage and temperature: yield strength used (not over 75 ksi)', sym: 'f_{y}', eq: '\\min(F_{yr},\\ 75)', sub: `\\min(${n(T.fy, 1)},\\ 75)`, value: T.fyU, unit: 'ksi', d: 1, ref: R });
    w.add({ id: 'eq', label: 'Shrinkage and temperature: area per foot, each face and each direction', sym: 'A_{s,eq}', eq: '\\frac{1.30\\,b\\,h}{2\\,(b + h)\\,f_{y}}', sub: `\\frac{1.30(${n(T.b, 1)})(${n(T.h, 2)})}{2(${n(T.b, 1)} + ${n(T.h, 2)})(${n(T.fyU, 1)})}`, value: T.eq, unit: 'in^{2}/ft', d: 4, ref: ED + 'Eq. 5.10.6-1' });
    w.add({ id: 'A', label: 'Shrinkage and temperature: area required per foot (within 0.11 to 0.60 in²/ft)', sym: 'A_{s,T\\&S}', eq: '\\min(\\max(A_{s,eq},\\ 0.11),\\ 0.60)', sub: `\\min(\\max(${n(T.eq, 4)},\\ 0.11),\\ 0.60)`, value: T.A, unit: 'in^{2}/ft', d: 3, ref: ED + 'Eq. 5.10.6-2',
      note: T.lo ? 'The lower bound 0.11 in²/ft governs.' : T.hi ? 'The upper bound 0.60 in²/ft governs.' : '' });
    w.add({ id: 'smax', label: 'Shrinkage and temperature: maximum spacing', sym: 's_{max}', eq: T.h > 36 ? '12.0' : '\\min(3.0\\,h,\\ 18.0)', sub: T.h > 36 ? '12.0' : `\\min(3.0(${n(T.h, 2)}),\\ 18.0)`, value: T.smax, unit: 'in', d: 2, ref: R,
      note: 'Engineer decision 2026-11-24 (confirmed): the lesser of 3.0h and 18.0 in. The 10th Ed. wording ("3.0 times the component thickness but not less than 18.0 in") can also be read as the larger, ' + `max(3h, 18) = ${St().fmt(Math.max(T.s3, 18), 2)} in here.` });
    sets.forEach(q => { if (!q.on) return; const p = q.k + '.';
      w.add({ id: p + 'As', label: `${q.name} (${barName(q.A)} at ${St().fmt(q.s, 2)} in): area provided per foot`, sym: 'A_{s}', eq: '\\frac{12\\,A_{b}}{s}', sub: `\\frac{12(${n(q.A, 2)})}{${n(q.s, 2)}}`, value: q.As, unit: 'in^{2}/ft', d: 3, ref: R });
      w.add({ id: p + 'rA', label: `DK5 ${q.name}: area`, sym: 'A_{s,T\\&S} \\le A_{s}', eq: '', sub: `${n(T.A, 3)} ${T.A <= q.As ? '\\le' : '\\gt'} ${n(q.As, 3)}`, value: q.rA, unit: '', d: 3, ref: R, ok: T.A <= q.As, note: 'Ratio A_s,T&S / A_s.' });
      w.add({ id: p + 'rs', label: `DK5 ${q.name}: spacing`, sym: 's \\le s_{max}', eq: '', sub: `${n(q.s, 2)} ${q.s <= T.smax ? '\\le' : '\\gt'} ${n(T.smax, 2)}`, value: q.rs, unit: '', d: 3, ref: R, ok: q.s <= T.smax, note: 'Ratio s / s_max.' }); });
    steps.push(...w.steps);
  }
  function tsCheck(T, sets) {
    const on = sets.filter(q => q.on), g = on.reduce((a, q) => (q.r > a.r ? q : a)), miss = sets.filter(q => !q.on).map(q => q.name.toLowerCase());
    const byA = g.by === 'area';
    return { id: 'DK5', title: 'Deck shrinkage and temperature reinforcement (each face, each direction)', ref: ED + 'Art. 5.10.6', r: g.r, Mu: null, phiMn: null, ok: on.every(q => q.ok),
      loc: `${g.name} ${barName(g.A)} at ${St().fmt(g.s, 2)} in (${byA ? 'area' : 'spacing'})${miss.length ? `; ${miss.join(', ')}: not checked (bars not entered)` : ''}`,
      dem: byA ? { sym: 'A_{s,T\\&S}', v: T.A, unit: 'in²/ft' } : { sym: 's', v: g.s, unit: 'in' }, cap: byA ? { sym: 'A_{s}', v: g.As, unit: 'in²/ft' } : { sym: 's_{max}', v: T.smax, unit: 'in' },
      step: `dk.ts.${g.k}.${byA ? 'rA' : 'rs'}`, miss };
  }

  /* ---------- DKCR (2026-11-24): crack control by distribution of reinforcement, AASHTO LRFD 10th Ed. Art. 5.6.7 (engineer request) ----------
     On the transverse bars: positive moment of each interior bay (bottom bars), negative moment of each bay at the design section and the
     two overhangs (top bars). Service I (Table 3.4.1-1: 1.0 DC, 1.0 DW, 1.0 LL+IM; eta = 1.0 at the service limit state, Art. 1.3.3 to
     1.3.5) with the module's unfactored moments (Table A4-1 includes multiple presence and the dynamic load allowance; the overhang wheel
     with IM 1.33 and multiple presence 1.20; a pedestrian load with the wheel, as Strength I). Decision (pending engineer review): the
     owner's HL-93 multiplier m is applied to the Service I live load too (conservative).
     Applies where the tension on the gross section exceeds 0.8 f_r (f_r = 0.24 lambda sqrt(f'c), Art. 5.4.2.6; lambda = 7.5 w_c within 0.75
     to 1.0, Art. 5.4.2.8), f_t = M_s / (12 t_s^2 / 6) on the structural slab. Then: f_ss from the cracked transformed section of the 12 in
     strip (k = sqrt(2 rho n + (rho n)^2) - rho n, j = 1 - k/3, f_ss = 12 M_s / (A_s j d), d and A_s as DK1 to DK3, n = 29,000 / E_c,
     E_c = 120,000 K_1 w_c^2 f'c^0.33 Eq. 5.4.2.4-1); f_ss <= 0.60 f_y (checked); beta_s = 1 + d_c / (0.7 (h - d_c)) (Eq. 5.6.7-2);
     s <= 700 gamma_e / (beta_s f_ss) - 2 d_c (Eq. 5.6.7-1), gamma_e 1.00 (Class 1) or 0.75 (Class 2, input exposure).
     d_c and h, measured within the structural slab t_s (the clear covers c_t, c_b are measured from the faces of t_s, as the effective
     depth d = t_s - c - d_b/2 of DK1 to DK3): bottom bars d_c = c_b + d_b/2, h = t_s (Decision pending engineer review: the dead-load-only
     layer, on the compression face, is left out); top bars d_c = c_t + d_b/2, h = t_s (Engineer decision 2026-11-24: exclude the
     sacrificial wearing surface t_L - t_s, as strength does; PR #1698 had d_c = (t_L - t_s) + c_t + d_b/2, h = t_L). So h - d_c = d, the
     depth of the cracked-section f_ss. The commentary's d_c limit of 2.0 in plus the bar radius for large covers is not used. */
  const GAM = { 1: 1.00, 2: 0.75 };
  const expoOf = D => (+D.exposure === 2 ? 2 : 1);
  function crackAll(o) {
    const D = o.D, cls = expoOf(D), ge = GAM[cls], Ec = 120000 * o.K1 * o.wcE * o.wcE * Math.pow(o.fc, 0.33), nr = 29000 / Ec;
    const lam = Math.min(1, Math.max(0.75, 7.5 * o.wcE)), fr = 0.24 * lam * Math.sqrt(o.fc), mLL = o.mLL;
    const common = { cls, ge, Ec, n: nr, lam, fr, wcE: o.wcE, K1: o.K1, fc: o.fc, fy: o.fy, ts: o.ts, tL: o.tL, mLL, lim: 0.6 * o.fy };
    const one = (key, name, top, c, M) => {
      const db = c.dbar, A = c.As, d = c.dEff, s = c.sp, Ms = M.DC + M.DW + mLL * M.LL + (M.PL || 0), hg = o.ts, Sg = 12 * hg * hg / 6, ft = 12 * Ms / Sg, app = ft > 0.8 * fr;
      const dc = c.cover + db / 2, h = o.ts;   // DKDC (engineer decision 2026-11-24): top bars too, within t_s (the sacrificial wearing surface excluded)
      const q = { key, name, top, M, Ms, hg, Sg, ft, app, dc, h, db, A, d, s, cover: c.cover, barA: c.barA };
      if (!app) return { ...q, r: 0, ok: true, by: 'na' };
      const rho = A / (12 * d), rn = rho * nr, k = Math.sqrt(2 * rn + rn * rn) - rn, j = 1 - k / 3, fss = 12 * Ms / (A * j * d), bs = 1 + dc / (0.7 * (h - dc));
      const smax = 700 * ge / (bs * fss) - 2 * dc, rS = smax > 0 ? s / smax : Infinity, rF = fss / common.lim;
      return { ...q, rho, rn, k, j, fss, bs, smax, rS, rF, r: Math.max(rS, rF), ok: smax > 0 && s <= smax && fss <= common.lim, by: rS >= rF ? 'spacing' : 'stress' };
    };
    const cases = [];
    const many = o.bays.length > 1, sx = q => (many ? ` [S = ${St().fmt(q.S, 2)} ft]` : '');
    o.bays.forEach((q, i) => { const I = q.I, P0 = one(`crp${i + 1}`, `Positive moment, bottom bars, ${q.name}`, false, q.pos, { DC: I.MDC_pos, DW: I.MDW_pos, LL: I.MLL_pos }); P0.bay = i; P0.lab = 'Crack control, positive moment' + sx(q); cases.push(P0); });
    o.bays.forEach((q, i) => { const I = q.I, N0 = one(`crn${i + 1}`, `Negative moment at the design section, top bars, ${q.name}`, true, q.neg, { DC: I.MDC_neg, DW: I.MDW_neg, LL: I.MLL_neg }); N0.bay = i; N0.lab = 'Crack control, negative moment' + sx(q); cases.push(N0); });
    ['L', 'R'].forEach(sd => { const q = o.oh[sd], O = q.O; cases.push({ ...one(`croh${sd}`, `${q.name}, top bars`, true, q.cap, { DC: O.MohDC, DW: O.MohDW, LL: Math.max(O.MohLL, 0), PL: O.MohPL }), side: sd, lab: `Crack control, ${q.name.toLowerCase()}` }); });
    const g = cases.reduce((a, q) => (q.r > a.r ? q : a), cases[0]);
    return { ...common, cases, g };
  }
  function crackSteps(steps, C) {
    const n = St().n, R = ED + 'Art. 5.6.7';
    { const w = St().work('dk.cr');
      w.add({ id: 'ge', label: `Crack control: exposure factor (Class ${C.cls} exposure condition)`, sym: '\\gamma_{e}', eq: '', sub: '', value: C.ge, unit: '', d: 2, ref: ED + 'Eq. 5.6.7-1',
        note: 'Cross-section tab, Deck design, "Crack control exposure": Class 1 = 1.00 (the default; Decision pending engineer review: many owners take decks as Class 2), Class 2 = 0.75.' });
      w.add({ id: 'Ec', label: 'Crack control: modulus of elasticity of the deck concrete', sym: 'E_{c}', eq: '120{,}000\\,K_{1}\\,w_{c}^{2}\\,(f^{\\prime}_{c})^{0.33}', sub: `120{,}000(${n(C.K1, 2)})(${n(C.wcE, 3)})^{2}(${n(C.fc, 2)})^{0.33}`, value: C.Ec, unit: 'ksi', d: 0, ref: ED + 'Eq. 5.4.2.4-1', note: 'w_c for E_c (Materials tab).' });
      w.add({ id: 'n', label: 'Crack control: modular ratio of the bars', sym: 'n', eq: '\\frac{E_{s}}{E_{c}}', sub: `\\frac{29{,}000}{${n(C.Ec, 0)}}`, value: C.n, unit: '', d: 3, ref: ED + 'Art. 5.4.3.2', note: 'Not rounded.' });
      w.add({ id: 'lam', label: 'Crack control: concrete density modification factor', sym: '\\lambda', eq: '\\min(\\max(7.5\\,w_{c},\\ 0.75),\\ 1.0)', sub: `\\min(\\max(7.5(${n(C.wcE, 3)}),\\ 0.75),\\ 1.0)`, value: C.lam, unit: '', d: 3, ref: ED + 'Art. 5.4.2.8' });
      w.add({ id: 'fr', label: 'Crack control: modulus of rupture', sym: 'f_{r}', eq: '0.24\\,\\lambda\\sqrt{f^{\\prime}_{c}}', sub: `0.24(${n(C.lam, 3)})\\sqrt{${n(C.fc, 2)}}`, value: C.fr, unit: 'ksi', d: 4, ref: ED + 'Art. 5.4.2.6' });
      w.add({ id: 'lim', label: 'Crack control: limit on the bar stress at the service limit state', sym: '0.60\\,f_{y}', eq: '0.60\\,F_{yr}', sub: `0.60(${n(C.fy, 1)})`, value: C.lim, unit: 'ksi', d: 2, ref: R });
      steps.push(...w.steps); }
    C.cases.forEach(q => { const w = St().work('dk.' + q.key), M = q.M, nm = q.lab, mE = C.mLL !== 1 ? 'm\\,' : '', mV = C.mLL !== 1 ? `${n(C.mLL, 2)}` : '';
      const pl = M.PL ? ' + M_{PL}' : '', plV = M.PL ? ` + ${n(M.PL, 3)}` : '';
      w.add({ id: 'Ms', label: `${nm}: Service I moment`, sym: 'M_{s}', eq: `M_{DC} + M_{DW} + ${mE}M_{LL+IM}${pl}`, sub: `${n(M.DC, 3)} + ${n(M.DW, 3)} + ${mV ? mV + '(' + n(M.LL, 3) + ')' : n(M.LL, 3)}${plV}`, value: q.Ms, unit: 'kip-ft/ft', d: 3, ref: ED + 'Table 3.4.1-1 (Service I)',
        note: `The unfactored moments of the Strength I steps (DC, DW, LL+IM${M.PL ? ', PL' : ''}) at 1.0; η = 1.0 at the service limit state (Art. 1.3.3 to 1.3.5).${q.side ? ' The wheel with IM 1.33 and multiple presence 1.20.' : ' Table A4-1 includes multiple presence and the dynamic load allowance.'}${C.mLL !== 1 ? ' m = the owner\'s HL-93 multiplier (Decision pending engineer review: applied at Service I too).' : ''}` });
      w.add({ id: 'ft', label: `${nm}: tension on the gross section of the structural slab`, sym: 'f_{t}', eq: '\\frac{12\\,M_{s}}{12\\,t_{s}^{2}/6}', sub: `\\frac{12(${n(q.Ms, 3)})}{12(${n(q.hg, 2)})^{2}/6}`, value: q.ft, unit: 'ksi', d: 4, ref: R });
      w.add({ id: 'app', label: `${nm}: crack control applies where f_t exceeds 0.8 f_r`, sym: '\\frac{f_{t}}{0.8\\,f_{r}}', eq: '', sub: `\\frac{${n(q.ft, 4)}}{0.8(${n(C.fr, 4)})}`, value: q.ft / (0.8 * C.fr), unit: '', d: 3, ref: R,
        note: q.app ? `Over 1 (f_t = ${St().fmt(q.ft, 4)} ksi > 0.8 f_r = ${St().fmt(0.8 * C.fr, 4)} ksi): applies, checked below.` : `Not over 1 (f_t = ${St().fmt(q.ft, 4)} ksi ≤ 0.8 f_r = ${St().fmt(0.8 * C.fr, 4)} ksi): does not apply, the section is not expected to crack at Service I.` });
      if (q.app) {
        w.add({ id: 'rho', label: `${nm}: reinforcement ratio of the 12 in strip`, sym: '\\rho', eq: '\\frac{A_{s}}{12\\,d}', sub: `\\frac{${n(q.A, 3)}}{12(${n(q.d, 3)})}`, value: q.rho, unit: '', d: 5, ref: 'Cracked transformed section', note: `A_s and d as the Strength I check (${q.top ? 'top' : 'bottom'} bars).` });
        w.add({ id: 'k', label: `${nm}: neutral axis depth ratio, cracked section`, sym: 'k', eq: '\\sqrt{2\\rho n + (\\rho n)^{2}} - \\rho n', sub: `\\sqrt{2(${n(q.rn, 5)}) + (${n(q.rn, 5)})^{2}} - ${n(q.rn, 5)}`, value: q.k, unit: '', d: 4, ref: 'Cracked transformed section', note: `ρn = ${n(q.rho, 5)}(${n(C.n, 3)}) = ${n(q.rn, 5)}.` });
        w.add({ id: 'j', label: `${nm}: lever arm ratio`, sym: 'j', eq: '1 - \\frac{k}{3}', sub: `1 - \\frac{${n(q.k, 4)}}{3}`, value: q.j, unit: '', d: 4, ref: 'Cracked transformed section' });
        w.add({ id: 'fss', label: `${nm}: bar stress at Service I`, sym: 'f_{ss}', eq: '\\frac{12\\,M_{s}}{A_{s}\\,j\\,d}', sub: `\\frac{12(${n(q.Ms, 3)})}{${n(q.A, 3)}(${n(q.j, 4)})(${n(q.d, 3)})}`, value: q.fss, unit: 'ksi', d: 2, ref: R });
        w.add({ id: 'fl', label: `DK6 ${nm}: bar stress not over 0.60 f_y`, sym: 'f_{ss} \\le 0.60\\,f_{y}', eq: '', sub: `${n(q.fss, 2)} ${q.fss <= C.lim ? '\\le' : '\\gt'} ${n(C.lim, 2)}`, value: q.rF, unit: '', d: 3, ref: R, ok: q.fss <= C.lim, note: 'Ratio f_ss / 0.60 f_y.' });
        w.add({ id: 'dc', label: `${nm}: tension face to the centre of the ${q.top ? 'top' : 'bottom'} bars`, sym: 'd_{c}', eq: q.top ? 'c_{t} + \\frac{d_{b}}{2}' : 'c_{b} + \\frac{d_{b}}{2}', sub: `${n(q.cover, 2)} + \\frac{${n(q.db, 3)}}{2}`, value: q.dc, unit: 'in', d: 3, ref: R,
          note: q.top ? `From the top of the structural slab t_s: the clear cover of the top bars plus half the bar diameter. Engineer decision 2026-11-24: exclude the sacrificial wearing surface${C.tL - C.ts > 1e-9 ? ` (t_L − t_s = ${St().fmt(C.tL - C.ts, 2)} in)` : ''}, as the Strength I depth d does.` : 'The clear cover of the bottom bars plus half the bar diameter.' });
        w.add({ id: 'h', label: `${nm}: overall thickness`, sym: 'h', eq: 't_{s}', sub: n(q.h, 2), value: q.h, unit: 'in', d: 2, ref: R, note: q.top ? 'The structural slab (Engineer decision 2026-11-24: the sacrificial wearing surface is excluded); h − d_c = d, the depth used for f_ss.' : 'The structural slab (Decision pending engineer review: the dead-load-only layer on the compression face is left out, conservative).' });
        w.add({ id: 'bs', label: `${nm}: strain ratio, tension face to the bars`, sym: '\\beta_{s}', eq: '1 + \\frac{d_{c}}{0.7\\,(h - d_{c})}', sub: `1 + \\frac{${n(q.dc, 3)}}{0.7(${n(q.h, 2)} - ${n(q.dc, 3)})}`, value: q.bs, unit: '', d: 4, ref: ED + 'Eq. 5.6.7-2' });
        w.add({ id: 'smax', label: `${nm}: maximum bar spacing for crack control`, sym: 's_{max}', eq: '\\frac{700\\,\\gamma_{e}}{\\beta_{s}\\,f_{ss}} - 2\\,d_{c}', sub: `\\frac{700(${n(C.ge, 2)})}{${n(q.bs, 4)}(${n(q.fss, 2)})} - 2(${n(q.dc, 3)})`, value: q.smax, unit: 'in', d: 2, ref: ED + 'Eq. 5.6.7-1' });
        w.add({ id: 's', label: `DK6 ${nm}: bar spacing`, sym: 's \\le s_{max}', eq: '', sub: `${n(q.s, 2)} ${q.smax > 0 && q.s <= q.smax ? '\\le' : '\\gt'} ${n(q.smax, 2)}`, value: q.rS, unit: '', d: 3, ref: ED + 'Eq. 5.6.7-1', ok: q.smax > 0 && q.s <= q.smax,
          note: q.smax > 0 ? 'Ratio s / s_max.' : 's_max is not positive: no spacing satisfies Eq. 5.6.7-1 (NG).' });
      }
      steps.push(...w.steps); });
  }
  function crackCheck(C) {
    const g = C.g, any = C.cases.some(q => q.app);
    if (!any) return { id: 'DK6', title: 'Deck crack control, transverse bars (Service I)', ref: ED + 'Art. 5.6.7', r: 0, Mu: null, phiMn: null, ok: true, loc: 'Not required: f_t ≤ 0.8 f_r in every case', dem: null, cap: null, step: `dk.${g.key}.app` };
    const bS = g.by === 'spacing';
    return { id: 'DK6', title: 'Deck crack control, transverse bars (Service I)', ref: ED + 'Art. 5.6.7, Eq. 5.6.7-1', r: g.r, Mu: null, phiMn: null, ok: C.cases.every(q => q.ok),
      loc: `${g.name}: ${barName(g.barA)} at ${St().fmt(g.s, 2)} in (${bS ? 'spacing' : 'bar stress'}), Class ${C.cls}`,
      dem: bS ? { sym: 's', v: g.s, unit: 'in' } : { sym: 'f_{ss}', v: g.fss, unit: 'ksi' }, cap: bS ? { sym: 's_{max}', v: g.smax, unit: 'in' } : { sym: '0.60 f_{y}', v: C.lim, unit: 'ksi' },
      step: `dk.${g.key}.${bS ? 's' : 'fl'}` };
  }

  function calc(P) {
    const D = inputs(P);
    if (!D.on) return { on: false, D };
    let R; try { R = loadsOf(P); } catch (e) { return { on: true, D, err: 'The cross-section and loads could not be computed: ' + (e && e.message) }; }
    if (R.errors && R.errors.length) return { on: true, D, err: 'Cross-section and loads: ' + R.errors.map(e => e.msg || e).join(' ') };
    const b = R.b, dead = R.dead, lf = R.lf || { eta: 1, m: 1 }, S = SD();
    const ts = +b.tsDeck, tL = ts + (+b.tsac || 0), wc = +dead.uc, fc = +b.fc, fy = +(((P.materials || {}).rebar || {}).Fyr);
    const bad = [];
    [['barTop', 'Top bar area'], ['barBot', 'Bottom bar area'], ['sTop', 'Top bar spacing'], ['sBot', 'Bottom bar spacing']].forEach(([k, t]) => { if (!(fin(+D[k]) && +D[k] > 0)) bad.push(`${t} must be greater than 0.`); });
    [['coverT', 'Top cover'], ['coverB', 'Bottom cover']].forEach(([k, t]) => { if (!(fin(+D[k]) && +D[k] >= 0)) bad.push(`${t} must be zero or positive.`); });
    if (D.xnegAuto === false && !(fin(+D.xneg) && +D.xneg >= 0)) bad.push('The design section distance must be zero or positive.');
    if (!(fy > 0)) bad.push('Rebar F_yr (Materials tab) must be positive.');
    if (!(ts > 0 && fc > 0 && wc > 0)) bad.push('The slab thickness, f′_c and w_c must be positive.');
    if (bad.length) return { on: true, D, err: 'Deck design inputs: ' + bad.join(' ') };
    const eta = +lf.eta || 1, mLL = +lf.m || 1;
    const wDC = tL / 12 * wc;
    // wearing surface and overlays on the roadway (the Loads module's area loads of category DW), ksf
    const dwA = dead.per.filter(L => L.cat === 'DW' && L.x0 != null && L.x1 > L.x0).map(L => ({ name: L.desc || L.id, q: L.plfAuto === undefined && L.def && L.def.kind === 'area' ? L.def.q / 1000 : L.plf / (L.x1 - L.x0) }));
    let wDW = 0; dwA.forEach(a => { wDW = wDW + a.q; });
    // design section (4.6.2.1.6): the narrowest top flange of the bridge
    let bf = Infinity, bfAt = ''; (P.girders || []).forEach(g => (g.segments || []).forEach((s, i) => { if (+s.topB > 0 && +s.topB < bf) { bf = +s.topB; bfAt = `${g.label || g.id}, segment ${i + 1}`; } }));
    if (!fin(bf)) bf = 0;
    const auto = D.xnegAuto !== false, xneg = auto ? S.designSection('steel', bf).x : S.clamp(+D.xneg || 0, 0, 24);
    // the bays: one design per different spacing
    const groups = []; (b.bays || []).forEach((s, i) => { const g = groups.find(q => Math.abs(q.S - s) < 1e-9); if (g) g.lines.push(i); else groups.push({ S: +s, lines: [i] }); });
    const cap = (top, Mu) => S.capacity({ barA: +(top ? D.barTop : D.barBot), sp: +(top ? D.sTop : D.sBot), cover: +(top ? D.coverT : D.coverB), ts, fc, fy, Mu });
    const bays = groups.map(g => { const I = S.interior({ S: g.S, wDC, wDW, xneg, eta, mLL }); return { S: g.S, lines: g.lines, I, pos: cap(false, I.Mu_pos), neg: cap(true, I.Mu_neg),
      name: `S = ${St().fmt(g.S, 2)} ft (${g.lines.length > 1 ? 'bays' : 'bay'} ${g.lines.map(i => `G${i + 1}–G${i + 2}`).join(', ')})` }; });
    let gp = 0, gn = 0; bays.forEach((q, k) => { if (q.I.Mu_pos > bays[gp].I.Mu_pos) gp = k; if (q.I.Mu_neg > bays[gn].I.Mu_neg) gn = k; });
    // the overhangs
    const oh = {}; ['L', 'R'].forEach(sd => { const L = sideLoads(R, sd), face = +((R.ll || {})[sd] || {}).r || 0;
      const O = S.overhang({ oh: L.oh, face, wSlab: wDC, DC: L.DC, DW: L.DW, PL: L.PL, eta, mLL });
      oh[sd] = { side: sd, name: sd === 'L' ? 'Left overhang' : 'Right overhang', O, cap: cap(true, O.Mu_oh), faceBy: ((R.ll || {})[sd] || {}).by || '' }; });
    const go = oh.R.O.Mu_oh > oh.L.O.Mu_oh ? 'R' : 'L';
    // distribution reinforcement: the smallest spacing gives the largest percentage. DD (2026-11-24, engineer request "Please fix the deck
    // distribution steel"): S of Art. 9.7.3.2 is the effective span of Art. 9.7.2.3, S_eff = S - b_f/12 + (b_f - t_w)/24, with the segment of
    // the largest b_f + t_w of the bridge (the shortest effective span: the largest percentage). Before: S = the smallest girder spacing.
    let fw = null; (P.girders || []).forEach(g => (g.segments || []).forEach((s, i) => { const bq = +s.topB, tq = +s.tw;
      if (bq > 0 && tq > 0 && (!fw || bq + tq > fw.bf + fw.tw)) fw = { bf: bq, tw: tq, at: `${g.label || g.id}, segment ${i + 1}` }; }));
    const Smin = Math.min(...bays.map(q => q.S)), DE = S.distEff({ S: Smin, bf: fw ? fw.bf : NaN, tw: fw ? fw.tw : NaN }), pct = DE.pct;
    const dist = { S: Smin, pct, As: pct / 100 * bays[gp].pos.As, Seff: DE.Seff, bf: DE.bf, tw: DE.tw, at: fw ? fw.at : '', pct0: DE.pct0, E: DE };
    // DKL: the longitudinal bars; DK4 where the bottom ones are entered (A_s,prov = 12 A_b / s, in^2/ft; ratio A_s,d / A_s,prov)
    const LB = longBars(D);
    if (LB.bot) { const q = LB.bot; q.As = 12 * q.A / q.s; q.r = dist.As / q.As; q.ok = dist.As <= q.As; }
    // DKTS (2026-11-24): shrinkage and temperature reinforcement (5.10.6) of each bar set entered; DKCR: crack control (5.6.7) of the transverse bars
    const mc = (P.materials || {}).concrete || {}, TS = tsOf(tL, 12 * (+dead.Wd || 0), fy), sets = tsSets(D, LB, TS);
    const CR = crackAll({ bays, oh, D, ts, tL, fc, fy, mLL, wcE: +mc.wcE > 0 ? +mc.wcE : +mc.wc > 0 ? +mc.wc : wc, K1: +mc.K1 > 0 ? +mc.K1 : 1 });
    // worked steps
    const steps = [], many = bays.length > 1;
    const xs = auto ? { kind: 'steel', b: bf, note: `The narrowest top flange of the bridge (${bfAt}): the design section nearest the girder centreline, the largest negative moment. Kept within 0 to 24 in (Table A4-1).` } : { kind: 'entered', xent: +D.xneg, note: 'Entered on the Cross-section tab (Deck design).' };
    const wDWsub = dwA.length > 1 ? dwA.map(a => St().n(a.q, 4)).join(' + ') : '';
    bays.forEach((q, k) => { const w = St().work('dk.b' + (k + 1));
      S.steps.interior(w, q.I, { tL, wc, wDCnote: `t = the total deck thickness (Cross-section tab: structural slab ${St().fmt(ts, 2)} in${tL - ts > 1e-9 ? ` + ${St().fmt(tL - ts, 2)} in dead load only` : ''}); w_c the deck concrete (Materials tab).`,
        wDWsub, wDWnote: dwA.length ? `${dwA.map(a => a.name).join(' + ')} (Loads tab), as the Loads & LLDF module.` : 'No wearing surface or overlay (Loads tab).', xs });
      if (k !== gp) S.steps.capacity(w, 'pos', 'Positive moment, bottom bars', q.pos, { short: true, shortNote: 'The same bars as the governing bay.', muSym: 'M_{u,pos}', check: `DK1 Positive moment, ${q.name}` });
      if (k !== gn) S.steps.capacity(w, 'neg', 'Negative moment, top bars', q.neg, { short: true, shortNote: 'The same bars as the governing bay.', muSym: 'M_{u,neg}', check: `DK2 Negative moment, ${q.name}` });
      w.steps.forEach(s => { if (many) s.label = `${s.label} [S = ${St().fmt(q.S, 2)} ft]`; steps.push(s); }); });
    { const w = St().work('dk');
      S.steps.capacity(w, 'pos', 'Positive moment, bottom bars', bays[gp].pos, { muSym: 'M_{u,pos}', check: `DK1 Positive moment, bottom bars${many ? `, governing ${bays[gp].name}` : ''}` });
      S.steps.capacity(w, 'neg', 'Negative moment, top bars', bays[gn].neg, { muSym: 'M_{u,neg}', check: `DK2 Negative moment, top bars${many ? `, governing ${bays[gn].name}` : ''}` });
      steps.push(...w.steps); }
    ['L', 'R'].forEach(sd => { const q = oh[sd], w = St().work('dk.oh' + sd);
      S.steps.overhang(w, q.O, { faceNote: `o_h = the ${sd === 'L' ? 'left' : 'right'} overhang, exterior girder centreline to the deck edge (Cross-section tab); x_f = the deck edge to the traffic face${q.faceBy ? ` (${q.faceBy})` : ''}, as the Loads & LLDF module.` });
      S.steps.capacity(w, 'cap', `${q.name}, top bars`, q.cap, { short: true, muSym: 'M_{u,oh}', check: `DK3 ${q.name}, top bars` });
      w.steps.forEach(s => { s.label = s.label.replace(/^Overhang:/, q.name + ':'); steps.push(s); }); });
    { const w = St().work('dk'); S.steps.dist(w, Smin, pct, { As: bays[gp].pos.As, eff: DE,
        effNote: `S = ${St().fmt(Smin, 2)} ft${many ? ', the smallest spacing' : ''}; b_f and t_w of ${fw ? fw.at : '—'}${fw ? ' (the largest b_f + t_w of the bridge)' : ''}: the shortest effective span, the largest percentage.` });
      if (LB.bot) { const q = LB.bot, n = St().n;
        w.add({ id: 'distProv', label: `Bottom longitudinal bars (${barName(q.A)} at ${St().fmt(q.s, 2)} in): steel area provided per foot of deck width`, sym: 'A_{s,prov}', eq: '\\frac{12\\,A_{b}}{s_{L}}', sub: `\\frac{12(${n(q.A, 2)})}{${n(q.s, 2)}}`,
          value: q.As, unit: 'in^{2}/ft', d: 3, ref: ED + 'Art. 9.7.3.2', note: 'A_b the area of one bottom longitudinal bar, s_L their spacing (Cross-section tab, Deck design).' });
        w.add({ id: 'distR', label: 'DK4 Distribution reinforcement: bottom longitudinal bars provided', sym: 'A_{s,d} \\le A_{s,prov}', eq: '', sub: `${n(dist.As, 3)} ${q.ok ? '\\le' : '\\gt'} ${n(q.As, 3)}`,
          value: q.r, unit: '', d: 3, ref: ED + 'Art. 9.7.3.2, 9.7.2.3', ok: q.ok, note: 'Ratio A_s,d / A_s,prov; A_s,d the required distribution reinforcement above.' }); }
      steps.push(...w.steps); }
    tsSteps(steps, TS, sets);
    crackSteps(steps, CR);
    const checks = [
      { id: 'DK1', title: 'Deck positive moment, bottom bars (Strength I)', ref: ED + 'Art. 4.6.2.1, Table A4-1, 5.6.3.2', r: bays[gp].pos.dc, Mu: bays[gp].pos.Mu, phiMn: bays[gp].pos.phiMn, ok: bays[gp].pos.ok, loc: bays[gp].name, step: 'dk.pos.r' },
      { id: 'DK2', title: 'Deck negative moment, top bars (Strength I)', ref: ED + 'Art. 4.6.2.1.6, Table A4-1, 5.6.3.2', r: bays[gn].neg.dc, Mu: bays[gn].neg.Mu, phiMn: bays[gn].neg.phiMn, ok: bays[gn].neg.ok, loc: bays[gn].name, step: 'dk.neg.r' },
      { id: 'DK3', title: 'Deck overhang, top bars (Strength I, gravity loads)', ref: ED + 'Art. 3.6.1.3.1, Table 4.6.2.1.3-1, 5.6.3.2', r: oh[go].cap.dc, Mu: oh[go].cap.Mu, phiMn: oh[go].cap.phiMn, ok: oh[go].cap.ok, loc: oh[go].name, step: `dk.oh${go}.cap.r` }];
    // DKL: DK4 only where the bottom longitudinal bars are entered (a project without them: DK1 to DK3, as before). Not a moment check:
    // Mu / phiMn null; req / prov the areas (in^2/ft).
    if (LB.bot) checks.push({ id: 'DK4', title: 'Deck distribution reinforcement, bottom longitudinal bars', ref: ED + 'Art. 9.7.3.2, 9.7.2.3', r: LB.bot.r, Mu: null, phiMn: null, req: dist.As, prov: LB.bot.As, unit: 'in²/ft',
      ok: LB.bot.ok, loc: `Bottom longitudinal bars ${barName(LB.bot.A)} at ${St().fmt(LB.bot.s, 2)} in`, step: 'dk.distR', dem: { sym: 'A_{s,d}', v: dist.As, unit: 'in²/ft' }, cap: { sym: 'A_{s,prov}', v: LB.bot.As, unit: 'in²/ft' } });
    checks.push(tsCheck(TS, sets), crackCheck(CR));   // DKTS / DKCR (2026-11-24): DK5 and DK6, always (the transverse bars always exist)
    const warn = [];
    if (LB.topPart) warn.push('Top longitudinal bars: enter both the bar size and a spacing greater than 0 (Cross-section tab, Deck design); they are not drawn.');
    if (LB.botPart) warn.push('Bottom longitudinal bars: enter both the bar size and a spacing greater than 0 (Cross-section tab, Deck design); DK4 is not checked.');
    bays.forEach(q => { if (q.I.A4.below) warn.push(`${q.name}: the spacing is below the 4 ft of Table A4-1; the 4 ft row is used.`); if (q.I.A4.above) warn.push(`${q.name}: the spacing is above the 15 ft of Table A4-1; the 15 ft row is used and a refined analysis is required.`); });
    if (!auto && +D.xneg > 24) warn.push('The entered design section is beyond the 24 in of Table A4-1; 24 in is used.');
    // DK review (2026-11-23): the assumptions of Table A4-1 (AASHTO LRFD 10th Ed. Appendix A4): at least three parallel girders, at least 14.0 ft
    // between the exterior girder centrelines, overhangs within the cases the table was developed for (21.0 in to the smaller of 0.625 S and
    // 6.0 ft, S of the exterior bay on that side). Warnings only: no value or verdict changes.
    { const nbays = (b.bays || []).length, Wx = (b.bays || []).reduce((a, s) => a + (+s || 0), 0), A41 = `${ED}Appendix A4`;
      if (nbays + 1 < 3) warn.push(`${nbays + 1} girders: Table A4-1 is for decks on at least three parallel girders (${A41}); a refined analysis is required.`);
      if (Wx < 14 - 1e-9) warn.push(`${St().fmt(Wx, 2)} ft between the exterior girder centrelines: Table A4-1 is for at least 14.0 ft (${A41}).`);
      ['L', 'R'].forEach(sd => { const Sx = +(sd === 'L' ? b.bays[0] : b.bays[nbays - 1]) || 0, lim = Math.min(0.625 * Sx, 6.0), o = sd === 'L' ? +b.ohL : +b.ohR;
        if (nbays && o > lim + 1e-9) warn.push(`${sd === 'L' ? 'Left' : 'Right'} overhang ${St().fmt(o, 2)} ft is more than the smaller of 0.625 S = ${St().fmt(0.625 * Sx, 2)} ft and 6.0 ft: outside the range of Table A4-1 (${A41}); the interior-bay moments next to that girder may not apply.`);
        if (nbays && o < 21 / 12 - 1e-9) warn.push(`${sd === 'L' ? 'Left' : 'Right'} overhang ${St().fmt(o, 2)} ft is less than the 21.0 in (1.75 ft) of Table A4-1 (${A41}); the interior-bay moments next to that girder may not apply.`); }); }
    const inBay = dead.per.filter(L => /^(sw[LR]|med|fence[LR]|u\d+)$/.test(L.id || '') && L.cat !== 'PL' && (L.x1 != null ? Math.max(L.x0, L.x1) > +b.ohL + 1e-9 && Math.min(L.x0, L.x1) < dead.Wd - +b.ohR - 1e-9 : L.x > +b.ohL + 1e-9 && L.x < dead.Wd - +b.ohR - 1e-9));
    if (inBay.length) warn.push(`Loads between the exterior girders that the interior strip moments do not include (slab and wearing surface only): ${inBay.map(L => L.desc || L.id).join(', ')}. Check their effect on the deck separately.`);
    const out = { on: true, D, in: { ts, tL, wc, fc, fy, wDC, wDW, dwA, bf, bfAt, xneg, auto, eta, mLL, owner: lf.o || '', Wd: dead.Wd, ohL: +b.ohL, ohR: +b.ohR }, bays, gp, gn, oh, go, dist, long: LB, ts: { ...TS, sets }, crack: CR, checks, warn, steps };
    META.set(steps, out);
    return out;
  }

  /* topics(R): the topics of the worked steps (SharedSteps.group; ids with the leading 'dk.' stripped) */
  const A = '10th Ed. ';
  function topics(R) {
    const T = [];
    ((R && R.bays) || []).forEach((q, k) => T.push({ key: 'b' + (k + 1), title: `Interior bays, ${q.name}: moments per foot`, ref: A + 'Art. 4.6.2.1, 4.6.2.1.6, Table A4-1, Table 3.4.1-1', ids: new RegExp(`^b${k + 1}\\.`), res: /\.Mun$/ }));
    if (!T.length) T.push({ key: 'b', title: 'Interior bays: moments per foot', ref: A + 'Art. 4.6.2.1, Table A4-1', ids: /^b\d+\./ });
    T.push({ key: 'pos', title: 'DK1 Positive moment: bottom bars', ref: A + 'Art. 5.6.3.2, 5.5.4.2', ids: /^pos\./ },
      { key: 'neg', title: 'DK2 Negative moment: top bars', ref: A + 'Art. 5.6.3.2, 5.5.4.2', ids: /^neg\./ },
      { key: 'ohL', title: 'DK3 Left overhang (gravity loads)', ref: A + 'Art. 3.6.1.3.1, Table 4.6.2.1.3-1', ids: /^ohL\./ },
      { key: 'ohR', title: 'DK3 Right overhang (gravity loads)', ref: A + 'Art. 3.6.1.3.1, Table 4.6.2.1.3-1', ids: /^ohR\./ },
      { key: 'dist', title: R && R.long && R.long.bot ? 'DK4 Distribution reinforcement: bottom longitudinal bars' : 'Distribution reinforcement', ref: A + 'Art. 9.7.3.2', ids: /^dist/ },
      { key: 'ts', title: 'DK5 Shrinkage and temperature reinforcement', ref: A + 'Art. 5.10.6', ids: /^ts\./ },
      { key: 'cr', title: 'DK6 Crack control: exposure, concrete, stress limit', ref: A + 'Art. 5.6.7, 5.4.2.4, 5.4.2.6', ids: /^cr\./ });
    ((R && R.crack && R.crack.cases) || []).forEach(q => T.push({ key: q.key, title: `DK6 Crack control: ${q.name}`, ref: A + 'Art. 5.6.7', ids: new RegExp(`^${q.key}\\.`) }));
    return T;
  }
  const metaOf = list => META.get(list) || null;
  window.SBDDeck = { DEF, BARS, LONG, TS_SETS, GAM, expoOf, tsOf, inputs, isOn, barName, longBars, calc, sideLoads, topics, metaOf };
})();
