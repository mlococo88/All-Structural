/* apps/steel-bridge/engine/constructibility.js — constructibility of a steel I-girder during deck placement, AASHTO LRFD
   10th Ed. Art. 6.10.3 (window.SBDConstr). Classic script, no DOM. Needs (loaded first): shared/steps.js, engine/sections.js,
   engine/flexure.js (ltbFnc, ampFl, fcrw, feAt, feCb, feNpr, feGe, feGeA, feGov), engine/shear.js (webShear, panelSteps).

   Created 2026-10-29 (docs/REBUILD_PLAN.md §5; engineer's decision SB2-O10: constructibility lives in this module, with the
   construction-stage loads). Ported from GirderDetail ("Steel Bridge Design.html"), arithmetic copied operation for operation:
     - Girder section module GM.gs.compute (anchor `// constructibility (steel section)`): M_c, the flange that M_c compresses,
       D_c of the steel section, R_h, C_b for deck placement, F_nc (6.10.8.2, R_b = 1.0), the nonprismatic deck-placement unbraced
       length (anchor `// nonprismatic deck-placement unbraced length (CB2`), f_ℓ amplification, F_crw, V_u of deck placement,
       the web shear resistance (webShear);
     - GM.gs.checks GS14 (compression flange: yielding Eq. 6.10.3.2.1-1, flexural resistance Eq. -2), GS15 (web bend-buckling
       Eq. 6.10.3.2.1-3; tension flange Eq. 6.10.3.2.2-1), GS16 (web shear Eq. 6.10.3.3-1);
     - gsGov kinds 'Ct' / 'Cb' (the governing section of a nonprismatic deck-placement unbraced length, NPG);
     - Preliminary sizing's row builder (gsRow, anchor `// C_b for deck placement (CB1`): L_b,C, C_b,C and nprC from the
       deck-placement moment M_c = 1.25M_DCc + 1.5M_CL (M_DC1 where M_DCc is not given; SBCON 2026-11-10, was 1.25M_DC1 + 1.5M_CL
       as GirderDetail) of the unbraced segment(s) containing the location (bracingC);
     - the hand-off of the deck-placement result (gdStConstr): the governing item per span of each group (compression top
       flange, compression bottom flange, tension flange, shear) and, for an exterior girder, the Deck overhang module rows at
       the largest 1.25M_DC1 + 1.5M_CL of each span;
     - the Deck overhang module GM.oh (compute, checks OH1–OH5): lateral bending f_ℓ of the exterior girder's flanges from the
       overhang brackets (C6.10.3.4). Kept because it is a girder check (docs/REBUILD_PLAN.md §5: the deck overhang design itself
       is out of scope).
   M_c = γ_DC M_DCc + γ_CL M_CL with γ_DC = 1.25, γ_CL = 1.50 (3.4.2.1, GirderDetail's defaults); M_DCc = the noncomposite moment
   envelope of the deck placement sequence (6.10.3.4.1; engine/analysis.js seq.MDCc), or M_DC1 where it is not given (0 or blank,
   as GirderDetail). Every check on the noncomposite steel section (6.10.1.1.1a). φ_f = φ_v = 1.0. A noncomposite girder (no deck)
   is checked the same way: the steel section under its DC1 and the construction live load (M_DCc = M_DC1, no pour sequence).

   Units: x ft; plates in; M kip-ft; V kip; stresses ksi; L_b ft (L_b in inches where stated). E = 29,000 ksi. */
(function () {
  'use strict';
  const ES = 29000, ED = 'AASHTO LRFD 10th Ed.';
  const St = () => window.SharedSteps, SEC = () => window.SBDSections, FX = () => window.SBDFlexure, SH = () => window.SBDShear;
  const n2 = x => St().n(x, 2), n3 = x => St().n(x, 3), n4 = x => St().n(x, 4), g0 = x => St().g(x, 0);
  const nf = x => Math.abs(x * 100 - Math.round(x * 100)) < 1e-9 ? n2(x) : n4(x);   // a load factor: 2 decimals, 4 when × η (ETAC)
  const pa = x => `(${n2(x)})`;
  const r1 = v => +(+v).toFixed(1), r2 = v => +(+v).toFixed(2), r3 = v => +(+v).toFixed(3);
  const okv = (dem, cap) => (cap >= dem - 1e-9 ? 'OK' : 'NG');

  /* factors(over): deck placement load factors (GirderDetail's Girder section gam.cdc, gam.ccl): γ_DC 1.25 on M_DCc (or M_DC1), 1.50 on the
     construction live load (AASHTO LRFD 10th Ed. 3.4.2.1). */
  // FONE (2026-11-01): the one source of the deck placement factors; engine/shear.js factors(), the Cross-frames bracing M_u and the Splices
  // tab take them from here. factorsOwner(lf, over) (ETAC, engineer decision 2026-11-01): × the owner's η (lf.etaC = η, SBDOwners.loadFactors;
  // 3.4.2.1 evaluates construction at the Strength limit state, Eq. 1.3.2.1-2); m is not applied (HL-93 only). projFactors(P): the project's
  // (P.ownerRules). The overhang bracket factors (OH1–OH5) are these too (since 2026-11-01; P.constr.oh.gam is kept in the file, unused).
  function factors(over) { return { cdc: 1.25, ccl: 1.50, ...(over || {}) }; }
  function factorsOwner(lf, over) { const G = factors(over), e = lf && +lf.etaC > 0 ? +lf.etaC : 1; return { ...G, cdc: G.cdc * e, ccl: G.ccl * e, eta: e, base: { cdc: G.cdc, ccl: G.ccl } }; }
  function lfOf(P) { const O = window.SBDOwners, own = (P && P.ownerRules) || {}; return O ? O.loadFactors(own.owner || 'AASHTO', own.eta, ((P && P.xs) || {}).nb || 0) : null; }
  function projFactors(P) { return factorsOwner(lfOf(P)); }
  const etaNote = G => G && G.eta && G.eta !== 1 ? ` Owner η = ${n3(G.eta)} on both (3.4.2.1 at the Strength limit state, Eq. 1.3.2.1-2; engineer decision 2026-11-01; m not applied): γ_DC = ${n2(G.base.cdc)}(${n3(G.eta)}) = ${n4(G.cdc)}, γ_CL = ${n2(G.base.ccl)}(${n3(G.eta)}) = ${n4(G.ccl)}.` : '';
  const fAt = (M, sec, y) => -M * 12 * (y - sec.yb) / sec.I;   // tension +
  const plates = q => ({ D: q.D, tw: q.tw, topB: q.topB, topT: q.topT, botB: q.botB, botT: q.botT });
  const rhOf = (s, q, mat) => SEC().hybrid(plates(q), s, { Fyt: mat.Fyt, Fyb: mat.Fyb, Fyw: mat.Fyw }, 'cn').Rh;   // GirderDetail rhFactor on the steel section
  /* the M_DCc rule of GirderDetail: used when it is a number other than 0 (blank, 0 or missing: M_DC1) */
  const useDCc = v => v !== '' && v != null && isFinite(+v) && +v !== 0;
  const CB_MIN = 1.0;   // SBCB (engineer decision 2026-11-10): the lower bound of C_b for deck placement and the overhang checks (6.10.8.2.3b, C6.10.8.2.3b)
  const SIDE0 = 0.01;   // SBTS: an opposite-sign side of the pour envelope smaller than 0.01 kip-ft is taken as none (round-off; no second case)

  /* gsGovC(o, r, kind, X): GirderDetail gsGov, kinds 'Ct' / 'Cb' (deck placement, top / bottom flange): f_bu, D_c and R_h of the
     governing section of a nonprismatic deck-placement unbraced length (o = nprC.G: x, plates, MDC1, MCL, MDCc there). */
  // SBTS (2026-11-10): o.side (a side diagram of the pour envelope, bracingC opt.side): its M_DCc as recorded, 0 included
  function gsGovC(o, r, kind, X) {
    const pl = ['topB', 'topT', 'botB', 'botT', 'tw'], mk = ['MDC1', 'MCL'];
    if (!o || typeof o !== 'object' || !pl.every(k => +o[k] > 0) || !mk.every(k => o[k] !== '' && o[k] != null && isFinite(+o[k]))) return null;
    const q = { ...r, topB: +o.topB, topT: +o.topT, botB: +o.botB, botT: +o.botT, tw: +o.tw }, s = SEC().steelCore(plates(q)), x = o.x != null && isFinite(+o.x) ? +o.x : null;
    const up = kind === 'Ct', MD = o.side && o.MDCc !== '' && o.MDCc != null && isFinite(+o.MDCc) ? +o.MDCc : useDCc(o.MDCc) ? +o.MDCc : +o.MDC1, MCL = +o.MCL, G = X.G, Mc = G.cdc * MD + G.ccl * MCL;
    const f = -fAt(Mc, s, up ? s.d : 0), S = up ? s.I / (s.d - s.yb) : s.I / s.yb;
    return { kind, x, q, MD, MDc: MD !== +o.MDC1, MCL, gdc: G.cdc, gcl: G.ccl, Mc, S, f, Dc: Math.max(up ? s.d - q.topT - s.yb : s.yb - q.botT, 0), Rb: 1, Rh: rhOf(s, q, X.mat) };
  }

  /* ---------- one location ---------- */
  /* location(L, prj)
     L = { name, x (ft, optional), plates: { D, tw, topB, topT, botB, botT },
           M: { DC1, DCc (the pour-sequence envelope; 0 / blank: DC1 is used), CL } (unfactored, kip-ft, signed),
           V: { DC1, CL } (unfactored magnitudes, kip),
           LbC (ft, the deck-placement unbraced length), CbC (C_b for deck placement; 0 / blank: Cb), Cb (default 1),
           nprC (optional, Preliminary sizing's nonprismatic data for the flange M_c compresses: { kind: 'simp' | 'ge', fl, b, t, k, Ir, why, A, G }),
           flC (ksi, first-order f_ℓ during deck placement, default 0), do (in, transverse stiffener spacing, 0 = unstiffened), end (end panel) }
     prj = { mat: { Fyt, Fyb, Fyw }, G: factors() }
     Returns the row (GirderDetail's field names: Mc, con, conC, conT, DcC, RhC, CbCu, ltC, amC, webC, VuC, sh) with checks [{ id, key,
     title, demand, capacity, ratio, ok, ref, unit, step }], gov (largest ratio) and the worked steps (lazy).
     SBTS (engineer decision 2026-11-10, items 1 and 3; AASHTO LRFD 10th Ed. 6.10.3.2, 6.10.3.4.1, 6.10.1.6, 6.10.8.2.3): L.side (+1 / −1)
     names the sign case of L.M.DCc, and L.alt = { side, DCc, LbC, CbC, nprC, seg, cbParts, kParts, mSrc } the other sign case at the same
     location (the largest deck-placement moment of the opposite sign, with its own C_b / γ_e data from bracingC(side)). Both cases are
     checked, each with its own flange in compression, f_bu, f_ℓ amplification and F_nc; the row returned is the governing case (largest
     governing ratio; the case of L.side on a tie), with .cases = [L.side case, L.alt case] and .alt = the other one. Without L.alt: one case,
     as before. */
  function location(L, prj) {
    const A = L.alt && typeof L.alt === 'object' && (A0 => A0.side === 1 || A0.side === -1)(L.alt) ? L.alt : null, r0 = locCase(L, prj);
    if (!A) return r0;
    const r1 = locCase({ ...L, ...A, M: { ...(L.M || {}), DCc: A.DCc }, alt: null }, prj), gr = FX().gr, g1 = gr(r1.gov) > gr(r0.gov), R = g1 ? r1 : r0, O = g1 ? r0 : r1;
    [r0, r1].forEach(q => { q.cases = [r0, r1]; q.alt = q === R ? O : R; q.caseGov = q === R; });
    return R;
  }
  function locCase(L, prj) {
    const G = factors(prj.G), p = plates(L.plates), mat = prj.mat, Fyt = mat.Fyt, Fyb = mat.Fyb, Fyw = mat.Fyw, M = L.M || {}, V = L.V || {}, num = v => +v || 0;
    const s = SEC().steelCore(p), d = s.d;
    const r = { name: L.name, x: L.x, ...p, MDC1: num(M.DC1), MDCc: useDCc(M.DCc) ? +M.DCc : 0, MCL: num(M.CL), VDC1: num(V.DC1), VCL: num(V.CL),
      LbC: +L.LbC, CbC: +L.CbC || 0, Cb: L.Cb != null && +L.Cb > 0 ? +L.Cb : 1, flC: num(L.flC), do: num(L.do), end: !!L.end, s, d, G, mat,
      seg: L.seg || null, cbParts: L.cbParts || null, kParts: L.kParts || null, mSrc: L.mSrc || null, side: L.side === 1 || L.side === -1 ? L.side : 0 };   // SBCON: bracingC's C_b and K parts, for the worked steps
    // constructibility (steel section)
    r.Mc = G.cdc * (r.MDCc !== 0 ? r.MDCc : r.MDC1) + G.ccl * r.MCL; const up = r.Mc >= 0; r.con = { top: fAt(r.Mc, s, d), bot: fAt(r.Mc, s, 0), up };
    r.conC = up ? { lab: 'top', b: r.topB, t: r.topT, Fy: Fyt, f: Math.max(-r.con.top, 0) } : { lab: 'bottom', b: r.botB, t: r.botT, Fy: Fyb, f: Math.max(-r.con.bot, 0) };
    r.conT = up ? { lab: 'bottom', Fy: Fyb, f: Math.max(r.con.bot, 0) } : { lab: 'top', Fy: Fyt, f: Math.max(r.con.top, 0) };
    r.DcC = up ? (d - r.topT) - s.yb : s.yb - r.botT; r.RhC = rhOf(s, r, mat);
    // C_b for deck placement (CB1): Eq. 6.10.8.2.3b-1 from the deck-placement moments; C_b where blank. SBCB (engineer decision 2026-11-10;
    // AASHTO LRFD 10th Ed. 6.10.8.2.3b, C6.10.8.2.3b): not taken below 1.0 (was used as given, e.g. 0.648 from |M| of a flange in tension)
    r.CbRaw = r.CbC > 0 ? r.CbC : r.Cb; r.CbCu = Math.max(CB_MIN, r.CbRaw);
    const LTB = FX().ltbFnc;
    r.ltC = LTB({ bfc: r.conC.b, tfc: r.conC.t, Dc: Math.max(r.DcC, 1e-6), tw: r.tw, Lb: r.LbC * 12, Cb: r.CbCu, Rb: 1, Rh: r.RhC, Fyc: r.conC.Fy, Fyw });
    // nonprismatic deck-placement unbraced length (CB2): nprC for the flange M_c compresses (steel section)
    { const nC = L.nprC, ok = nC && typeof nC === 'object' && nC.fl === r.conC.lab && (nC.kind === 'simp' || nC.kind === 'ge') && +nC.b > 0 && +nC.t > 0, b = ok ? +nC.b : 0, t = ok ? +nC.t : 0, LbiC = r.LbC * 12;
      if (ok && nC.kind === 'simp') { const m = LTB({ bfc: b, tfc: t, Dc: Math.max(r.DcC, 1e-6), tw: r.tw, Lb: LbiC, Cb: r.CbCu, Rb: 1, Rh: r.RhC, Fyc: r.conC.Fy, Fyw });
        r.ltC = { ...r.ltC, rt: m.rt, Lp: m.Lp, Lr: m.Lr, Fcr: m.Fcr, LTB: m.LTB, Fnc: Math.min(r.ltC.FLB, m.LTB), npr: { kind: 'simp', b, t, Ir: +nC.Ir || null } }; }
      else if (ok) { const sS = SEC().steelCore(plates(up ? { ...r, topB: b, topT: t } : { ...r, botB: b, botT: t })), fS = -fAt(r.Mc, sS, up ? sS.d : 0), DcS = Math.max(up ? sS.d - t - sS.yb : sS.yb - t, 1e-6), rtS = b / Math.sqrt(12 * (1 + DcS * r.tw / (3 * b * t)));
        const gR = nC.A, gA = gR && typeof gR === 'object' && gR.m === 'A' && +gR.ge > 0 ? gR : null;   // App. D6.6.2 Method A
        const gv = gsGovC(nC.G, r, up ? 'Ct' : 'Cb', { G, mat });   // NPG: the governing section (R_b = 1.0: the largest deck-placement f_bu in L_b)
        // SBGE (engineer decision 2026-11-10; AASHTO LRFD 10th Ed. 6.10.8.2.3c, C6.10.8.2.3c, App. D6.6): γ_e of the conservative bound passed directly
        // from bracingC (nC.gB = min over the sections j of the L_b of F_e,j/f_max,j, from the factored moments this check uses), no longer rebuilt here
        // as F_e,s/(K f_s). Was: K = f_max/f_x at the nearest station, K = 1 where f_x ≤ 0 (blank k), i.e. γ_e = F_e,s/f_s (unconservative near an
        // inflection). A row without nC.gB (a hand-made row): K as given where k ≥ 1 and f_s > 0; otherwise (f_x ≤ 0 / k blank, or f_s ≤ 0) f_max is taken
        // as the larger of f_bu,gov and f_s, the largest stress known in the L_b (conservative). No compression at all: F_e,s.
        const gB = !gA && nC.gB && typeof nC.gB === 'object' && +nC.gB.ge > 0 ? nC.gB : null;
        const kOk = +nC.k > 0, K = kOk ? Math.max(1, +nC.k) : 1, FeS = Math.PI ** 2 * ES / (LbiC / rtS) ** 2, fbu = Math.max(gv ? gv.f : r.conC.f, 0), fmx = Math.max(fbu, fS);
        const gm = gA ? 'A' : gB ? 'bound' : kOk && fS > 0 ? 'K' : fmx > 0 ? 'fmax' : 'none';
        const ge = gm === 'A' ? +gA.ge : gm === 'bound' ? +gB.ge : gm === 'K' ? FeS / (K * fS) : gm === 'fmax' ? FeS / fmx : null, Fe = ge != null && fbu > 0 ? ge * fbu : FeS, rtE = LbiC / Math.PI * Math.sqrt(Fe / ES);
        const m = LTB({ bfc: r.conC.b, tfc: r.conC.t, Dc: Math.max(r.DcC, 1e-6), tw: r.tw, Lb: LbiC, Cb: 1, Rb: 1, Rh: gv ? gv.Rh : r.RhC, Fyc: r.conC.Fy, Fyw, rt: rtE }); r.CbCu = 1;
        r.ltC = { ...r.ltC, rt: m.rt, Lp: m.Lp, Lr: m.Lr, Fcr: m.Fcr, LTB: m.LTB, Fnc: Math.min(r.ltC.FLB, m.LTB), npr: { kind: 'ge', b, t, K, fS, rtS, FeS, ge, gm, gB, fmx, fbu, gv, Fe, rtE, Ir: +nC.Ir || null, A: gA, bw: gR && typeof gR === 'object' && gR.m === 'bound' ? String(gR.why || '') : null } }; } }
    r.amC = FX().ampFl(r.flC, r.conC.f, r.conC.Fy, r.ltC.Lp, r.LbC * 12, r.CbCu, 1, r.ltC.Fcr); r.webC = FX().fcrw(r.D, r.tw, Math.max(r.DcC, 1e-6), r.RhC, r.conC.Fy, Fyw);
    r.VuC = G.cdc * r.VDC1 + G.ccl * r.VCL;
    r.flgA = r.botB * r.botT + r.topB * r.topT; r.sh = SH().webShear(r.D, r.tw, Fyw, r.do, r.flgA, r.end);
    // checks (GM.gs.checks GS14, GS15, GS16)
    const ck = o => ({ ratio: o.demand / o.capacity, ok: o.capacity >= o.demand - 1e-9, inUse: true, unit: 'ksi', ...o });
    const f = r.conC.f, cf = r.conC.lab, tl = r.conT.lab;
    r.checks = [
      ck({ id: 'GS14', key: 'yield', title: `Deck placement, ${cf} flange (compression) yielding, f_bu + f_ℓ ≤ φ_fR_hF_yc`, ref: `${ED} Eq. 6.10.3.2.1-1`, demand: f + r.amC.fl, capacity: r.RhC * r.conC.Fy, step: 'cn.yield.ok', ...(r.amC.und ? { ng: FX().AMP_NG } : {}) }),
      ck({ id: 'GS14', key: 'buckling', title: `Deck placement, ${cf} flange (compression) flexural resistance, f_bu + f_ℓ/3 ≤ φ_fF_nc`, ref: `${ED} Eq. 6.10.3.2.1-2; 6.10.8.2.2, 6.10.8.2.3`, demand: f + r.amC.fl / 3, capacity: r.ltC.Fnc, step: 'cn.buck.ok', ...(r.amC.und ? { ng: FX().AMP_NG } : {}) }),
      ck({ id: 'GS15', key: 'web', title: 'Deck placement, web bend-buckling, f_bu ≤ φ_fF_crw', ref: `${ED} Eq. 6.10.3.2.1-3; 6.10.1.9.1`, demand: f, capacity: r.webC.F, step: 'cn.web.ok' }),
      ck({ id: 'GS15', key: 'tension', title: `Deck placement, ${tl} flange (tension), f_bu + f_ℓ ≤ φ_fR_hF_yt`, ref: `${ED} Eq. 6.10.3.2.2-1`, demand: r.conT.f + r.flC, capacity: r.RhC * r.conT.Fy, step: 'cn.tens.ok' }),
      ck({ id: 'GS16', key: 'shear', title: 'Deck placement, web shear, V_u ≤ φ_vV_cr', ref: `${ED} Eq. 6.10.3.3-1`, demand: r.VuC, capacity: r.sh.Vcr, unit: 'kip', step: 'cn.sh.ok' })];
    r.gov = FX().govern(r.checks);   // SB2-R2: guard (NaN / ∞ fail and govern)
    Object.defineProperty(r, 'steps', { enumerable: false, configurable: true, get() { const st = worked(r); Object.defineProperty(r, 'steps', { value: st, enumerable: false }); return st; } });
    return r;
  }

  /* worked(r): the steps of one location (ids cn.*), then the steel section's (sec.s.*) */
  function worked(r) {
    const w = St().work('cn'), G = r.G, s = r.s, cF = r.conC, tF = r.conT, lt = r.ltC, up = r.con.up, tbl = `${ED} Art. 3.4.2.1`;
    const seq = r.MDCc !== 0, sN = q => (q.side > 0 ? 'positive' : 'negative');
    // SBTS (2026-11-10): the sign case of this row and, where both signs occur, the other case and which governs (6.10.3.4.1)
    const csN = !(seq && r.side) ? '' : ` M_DCc of this case: the ${sN(r)}-side envelope, the largest ${sN(r)} noncomposite moment of the deck placement sequence here (M_DC1 and every pour stage).`
      + (r.cases ? ` Both signs occur here and both are checked: ${r.cases.map(q => `${sN(q)} case M_c = ${n2(q.Mc)} kip-ft, ${q.gov ? `${q.gov.id} ratio ${n3(q.gov.ratio)}` : 'no check'}`).join('; ')}. The ${sN(r.caseGov ? r : r.alt)} case governs and is the one reported for this location.` : ` No pour stage gives a ${r.side > 0 ? 'negative' : 'positive'} moment here: one case.`);
    w.add({ id: 'Mc', label: `Deck placement factored moment, noncomposite steel section${seq && r.side ? ` (${sN(r)}-moment case)` : ''}`, sym: 'M_{c}', eq: `\\gamma_{DC}M_{${seq ? 'DCc' : 'DC1'}} + \\gamma_{CL}M_{CL}`, sub: `${nf(G.cdc)}${pa(seq ? r.MDCc : r.MDC1)} + ${nf(G.ccl)}${pa(r.MCL)}`, value: r.Mc, unit: 'kip-ft', d: 1, ref: tbl,
      note: (seq ? `M_DCc: the noncomposite moment envelope of the deck placement sequence (Art. 6.10.3.4.1; Analysis tab, an.seq.MDCc); M_DC1 with the deck cast at once = ${n2(r.MDC1)} kip-ft.${csN}` : 'M_DC1: steel and the whole wet deck on the steel section (no pour sequence given).') + etaNote(G) });
    ['top', 'bot'].forEach(k => w.add({ id: 'f.' + k, label: `Stress, ${k === 'top' ? 'top' : 'bottom'} of steel (tension +)`, sym: `f_{${k}}`, eq: '\\frac{-M_{c}(12)(y - \\bar{y})}{I}', sub: `\\frac{-${pa(r.Mc)}(12)(${n3(k === 'top' ? r.d : 0)} - ${n3(s.yb)})}{${g0(s.I)}}`, value: r.con[k], unit: 'ksi', d: 2, ref: `${ED} Art. 6.10.1.1.1a`, note: 'Steel section: see sec.s.yb, sec.s.I.' }));
    w.add({ id: 'fbu', label: `Compression flange: the ${cF.lab} flange (M_c ${up ? '≥' : '<'} 0)`, sym: 'f_{bu}', eq: `\\max(-f_{${up ? 'top' : 'bot'}}, 0)`, sub: n2(-r.con[up ? 'top' : 'bot']), value: cF.f, unit: 'ksi', d: 2, ref: `${ED} Art. 6.10.3.2.1`, note: 'Stress at the extreme fiber of the flange (conservative).' });
    w.add({ id: 'Dc', label: 'Depth of the web in compression, steel section', sym: 'D_{c}', eq: up ? '(d - t_{ft}) - \\bar{y}' : '\\bar{y} - t_{fb}', sub: up ? `(${n3(r.d)} - ${n3(r.topT)}) - ${n3(s.yb)}` : `${n3(s.yb)} - ${n3(r.botT)}`, value: r.DcC, unit: 'in', d: 3, ref: `${ED} App. D6.3.1` });
    w.add({ id: 'Rh', label: 'Hybrid factor, steel section', sym: 'R_{h}', eq: '', sub: '', value: r.RhC, unit: '', d: 3, ref: `${ED} Art. 6.10.1.10.1` });
    // SBCON (2026-11-10): C_b worked from bracingC's parts, with the moments used (the M_c this check uses: M_DCc where given)
    const geK = lt.npr && lt.npr.kind === 'ge', cbP = !geK && r.cbParts && r.CbC > 0 ? r.cbParts : null, mN = r.mSrc === 'DCc' ? 'M_DCc' : 'M_DC1';
    const mUsed = r.mSrc ? ` Moments over the unbraced segment${r.seg ? ` ${n2(r.seg.xa)} to ${n2(r.seg.xb)} ft` : ''}: 1.25${mN} + 1.50M_CL (${r.mSrc === 'DCc' ? r.side ? `the ${sN(r)}-side envelope of M_DCc at every station of the unbraced length, one moment diagram of this sign case, as M_c of this check (cn.Mc)` : 'the pour-sequence envelope M_DCc, as M_c of this check (cn.Mc)' : 'no pour sequence: M_DC1'}; a common factor such as the owner's η does not change C_b or K).` : '';
    // SBCB (2026-11-10): C_b = max(1.0, Eq. 6.10.8.2.3b-1), the value before the bound worked and stated
    const cbLow = !geK && r.CbRaw < CB_MIN - 1e-12, cb0 = cbP && cbP.Cb0 != null ? cbP.Cb0 : r.CbRaw;
    w.add({ id: 'Cb', label: geK ? 'Moment gradient modifier: nonprismatic unbraced length' : 'Moment gradient modifier for deck placement (from the deck-placement moments of the unbraced length)', sym: 'C_{b}', eq: geK ? '1.0' : cbP ? '\\max\\left(1.0,\\ \\frac{12.5M_{max}}{2.5M_{max} + 3M_{A} + 4M_{B} + 3M_{C}}\\right)' : cbLow ? '\\max(1.0,\\ C_{b,given})' : '',
      sub: cbP ? `\\max\\left(1.0,\\ \\frac{12.5(${n2(cbP.Mx)})}{2.5(${n2(cbP.Mx)}) + 3(${n2(cbP.MA)}) + 4(${n2(cbP.MB)}) + 3(${n2(cbP.MC)})} = ${n3(cb0)}\\right)` : cbLow ? `\\max(1.0,\\ ${n3(r.CbRaw)})` : '', value: r.CbCu, unit: '', d: 3, ref: geK ? `${ED} Eq. 6.10.8.2.3c-1` : `${ED} Eq. 6.10.8.2.3b-1; C6.10.8.2.3b`,
      note: `L_b = ${n2(r.LbC)} ft (deck-placement unbraced length).${cbP ? ` M_max: the largest moment compressing the ${cF.lab} flange; M_A, M_B, M_C: |M| at the quarter points (kip-ft); C_b rounded to 3 decimals.` : ''}${geK ? '' : ` C_b is not taken below 1.0 (engineer decision 2026-11-10; C6.10.8.2.3b: 1.0 is the base value for a constant moment and may conservatively be used in any case)${cbLow || (cbP && cb0 < CB_MIN) ? `: Eq. 6.10.8.2.3b-1 gives ${n3(cb0)} here, so 1.0 is used` : ''}.`}${geK ? '' : mUsed}` });
    w.add({ id: 'Fyr', label: 'Compression-flange stress at the onset of nominal yielding', sym: 'F_{yr}', eq: '\\max(\\min(0.7F_{yc}, F_{yw}), 0.5F_{yc})', sub: `\\max(\\min(0.7(${n2(cF.Fy)}), ${n2(r.mat.Fyw)}), 0.5(${n2(cF.Fy)}))`, value: lt.Fyr, unit: 'ksi', d: 2, ref: `${ED} Art. 6.10.8.2.2` });
    w.add({ id: 'FLB', label: `Flange local buckling (λ_f = b_fc/2t_fc = ${n2(lt.lf)}, λ_pf = ${n2(lt.lpf)}, λ_rf = ${n2(lt.lrf)})`, sym: 'F_{nc,FLB}', eq: lt.lf <= lt.lpf ? 'R_{b}R_{h}F_{yc}' : '\\left[1 - \\left(1 - \\frac{F_{yr}}{R_{h}F_{yc}}\\right)\\frac{\\lambda_{f} - \\lambda_{pf}}{\\lambda_{rf} - \\lambda_{pf}}\\right]R_{b}R_{h}F_{yc}',
      sub: lt.lf <= lt.lpf ? `1.0(${n3(r.RhC)})(${n2(cF.Fy)})` : `\\left[1 - \\left(1 - \\frac{${n2(lt.Fyr)}}{${n3(r.RhC)}(${n2(cF.Fy)})}\\right)\\frac{${n2(lt.lf)} - ${n2(lt.lpf)}}{${n2(lt.lrf)} - ${n2(lt.lpf)}}\\right](1.0)(${n3(r.RhC)})(${n2(cF.Fy)})`, value: lt.FLB, unit: 'ksi', d: 3, ref: `${ED} Eqs. 6.10.8.2.2-1, -2`, note: 'R_b = 1.0 for deck placement (6.10.3.2.1).' });
    if (lt.npr && lt.npr.kind === 'ge') { const q = lt.npr;
      if (q.gv) w.add({ id: 'gov', label: `Governing section of the nonprismatic unbraced length${q.gv.x != null ? ` (x = ${n2(q.gv.x)} ft)` : ''}`, sym: 'f_{bu,gov}', eq: '\\frac{|M_{c}|(12)}{S}', sub: `M_{c} = ${n2(q.gv.gdc)}${pa(q.gv.MD)} + ${n2(q.gv.gcl)}${pa(q.gv.MCL)} = ${n2(q.gv.Mc)};\\ \\frac{${n2(Math.abs(q.gv.Mc))}(12)}{${g0(q.gv.S)}}`, value: q.gv.f, unit: 'ksi', d: 3, ref: `${ED} Art. 6.10.8.2.3c`, note: `${q.gv.MDc ? r.side ? `M_DCc of the ${sN(r)}-side envelope (this case, as cn.Mc)` : 'M_DCc (the pour-sequence envelope, as cn.Mc)' : 'M_DC1'} and M_CL at that section. R_h of that section ${n3(q.gv.Rh)}; R_b = 1.0.` });
      // SBGE (2026-11-10): the bound γ_e as passed (min_j F_e,j/f_max,j); the K form only for a hand-made row without it; the f_max form where K is not usable
      const gEq = q.gm === 'A' ? '\\frac{\\chi C_{be}}{(M_{u}/M_{e1})_{max}}' : q.gm === 'bound' ? '\\min_{j}\\frac{F_{e,j}}{f_{max,j}},\\ F_{e,j} = \\frac{\\pi^{2}E}{(L_{b}/r_{t,j})^{2}}' : q.gm === 'K' ? '\\frac{F_{e,s}}{Kf_{s}}' : '\\frac{F_{e,s}}{\\max(f_{bu,gov}, f_{s})}';
      const gSub = q.gm === 'A' ? `\\frac{${n4(+q.A.chi)}(${n3(+q.A.Cbe)})}{${n4(+q.A.rm)}}` : q.gm === 'bound' ? `\\frac{\\pi^{2}(29{,}000)/(${n2(r.LbC * 12)}/${n4(+q.gB.rt)})^{2}}{${n3(+q.gB.fm)}} = \\frac{${n2(+q.gB.Fe)}}{${n3(+q.gB.fm)}}` : q.gm === 'K' ? `\\frac{${n2(q.FeS)}}{${n3(q.K)}(${n2(q.fS)})}` : q.gm === 'fmax' ? `\\frac{${n2(q.FeS)}}{\\max(${n2(q.fbu)}, ${n2(q.fS)})}` : '';
      const gNote = q.gm === 'bound' ? `Section j${q.gB.x0 != null ? ` (${n2(+q.gB.x0)} to ${n2(+q.gB.x1)} ft of the unbraced length)` : ''}, ${cF.lab} flange ${n2(q.b)} × ${n3(q.t)}, r_t,j = ${n4(+q.gB.rt)} in: each section is taken as prismatic over the whole L_b at its largest compression stress f_max,j, from the moments of this check (M_c); the smallest ratio governs (γ_e rounded to 4 decimals). γ_e belongs to the unbraced length and is not rebuilt from the stress at this location, so f_x ≤ 0 or near 0 here does not enter (C6.10.8.2.3c).${mUsed}`
        : q.gm === 'K' && r.kParts ? `K = f_max/f_x = ${n3(r.kParts.fm)}/${n3(r.kParts.fx)} (f_max: the largest stress in the ${cF.lab} flange over L_b; f_x: at the analysis station x = ${n2(r.kParts.x)} ft; K ≥ 1, 3 decimals), f_s at this location.${mUsed}`
        : q.gm === 'K' ? 'K as given with the row (K ≥ 1), f_s at this location.'
        : q.gm === 'fmax' ? 'No γ_e given and K = f_max/f_x not usable (f_x ≤ 0 or not given, or f_s ≤ 0): f_max taken as the larger of f_bu,gov and f_s, the largest stress known in the unbraced length (conservative; was K = 1).' : '';
      w.add({ id: 'ge', label: q.gm === 'A' ? 'γ_e by App. D6.6.2 Method A (Preliminary sizing)' : 'γ_e, conservative bound', sym: '\\gamma_{e}', eq: gEq, sub: gSub, value: q.ge, unit: '', d: 4, ref: q.gm === 'A' ? `${ED} Eq. D6.6.2-1` : `${ED} Art. 6.10.8.2.3c, C6.10.8.2.3c; App. D6.6`,
        note: [q.bw ? 'Outside the D6.6.2.2 step limit: ' + q.bw + '.' : '', gNote].filter(Boolean).join(' ') });
      w.add({ id: 'Fe', label: 'Elastic LTB stress of the nonprismatic unbraced length', sym: 'F_{e}', eq: '\\gamma_{e}f_{bu,gov}', sub: `${n4(q.ge)}(${n2(q.fbu)})`, value: q.Fe, unit: 'ksi', d: 3, ref: `${ED} Eq. 6.10.8.2.3c-2` });
      w.add({ id: 'rtE', label: 'Equivalent radius of gyration', sym: 'r_{t}', eq: '\\frac{L_{b}}{\\pi}\\sqrt{\\frac{F_{e}}{E}}', sub: `\\frac{${n2(r.LbC * 12)}}{\\pi}\\sqrt{\\frac{${n2(q.Fe)}}{29{,}000}}`, value: lt.rt, unit: 'in', d: 4, ref: `${ED} Eq. 6.10.8.2.3c-3` });
    } else w.add({ id: 'rt', label: `Effective radius of gyration for LTB${lt.npr ? ` (nonprismatic: 6.10.8.2.3c simplification, flange ${n2(lt.npr.b)} × ${n3(lt.npr.t)})` : ''}`, sym: 'r_{t}', eq: '\\frac{b_{fc}}{\\sqrt{12\\left(1 + \\frac{D_{c}t_{w}}{3b_{fc}t_{fc}}\\right)}}', sub: `\\frac{${n2(lt.npr ? lt.npr.b : cF.b)}}{\\sqrt{12\\left(1 + \\frac{${n3(Math.max(r.DcC, 1e-6))}(${n4(r.tw)})}{3(${n2(lt.npr ? lt.npr.b : cF.b)})(${n3(lt.npr ? lt.npr.t : cF.t)})}\\right)}}`, value: lt.rt, unit: 'in', d: 4, ref: `${ED} Eq. 6.10.8.2.3-9` });
    w.add({ id: 'Lp', label: 'Limiting unbraced length, L_p', sym: 'L_{p}', eq: '1.1r_{t}\\sqrt{\\frac{E}{F_{yc}}}', sub: `1.1(${n4(lt.rt)})\\sqrt{\\frac{29{,}000}{${n2(cF.Fy)}}}`, value: lt.Lp, unit: 'in', d: 2, ref: `${ED} Eq. 6.10.8.2.3-4` });
    w.add({ id: 'Lr', label: 'Limiting unbraced length, L_r', sym: 'L_{r}', eq: '\\pi r_{t}\\sqrt{\\frac{E}{F_{yr}}}', sub: `\\pi(${n4(lt.rt)})\\sqrt{\\frac{29{,}000}{${n2(lt.Fyr)}}}`, value: lt.Lr, unit: 'in', d: 2, ref: `${ED} Eq. 6.10.8.2.3-5` });
    const Lb = r.LbC * 12, cap = r.RhC * cF.Fy;
    w.add({ id: 'LTB', label: `Lateral-torsional buckling (L_b = ${n2(Lb)} in ${Lb <= lt.Lp ? '≤ L_p' : Lb <= lt.Lr ? 'between L_p and L_r' : '> L_r'})`, sym: 'F_{nc,LTB}',
      eq: Lb <= lt.Lp ? 'R_{b}R_{h}F_{yc}' : Lb <= lt.Lr ? 'C_{b}\\left[1 - \\left(1 - \\frac{F_{yr}}{R_{h}F_{yc}}\\right)\\frac{L_{b} - L_{p}}{L_{r} - L_{p}}\\right]R_{b}R_{h}F_{yc} \\le R_{b}R_{h}F_{yc}' : 'F_{cr} = \\frac{C_{b}R_{b}\\pi^{2}E}{(L_{b}/r_{t})^{2}} \\le R_{b}R_{h}F_{yc}',
      sub: Lb <= lt.Lp ? n2(cap) : Lb <= lt.Lr ? `${n3(r.CbCu)}\\left[1 - \\left(1 - \\frac{${n2(lt.Fyr)}}{${n2(cap)}}\\right)\\frac{${n2(Lb)} - ${n2(lt.Lp)}}{${n2(lt.Lr)} - ${n2(lt.Lp)}}\\right](${n2(cap)})` : `\\frac{${n3(r.CbCu)}(1.0)\\pi^{2}(29{,}000)}{(${n2(Lb)}/${n4(lt.rt)})^{2}} = ${n2(lt.Fcr)}`,
      value: lt.LTB, unit: 'ksi', d: 3, ref: `${ED} Eqs. 6.10.8.2.3-1, -2, -3, -8` });
    w.add({ id: 'Fnc', label: 'Nominal flexural resistance of the compression flange', sym: 'F_{nc}', eq: '\\min(F_{nc,FLB}, F_{nc,LTB})', sub: `\\min(${n2(lt.FLB)}, ${n2(lt.LTB)})`, value: lt.Fnc, unit: 'ksi', d: 3, ref: `${ED} Art. 6.10.8.2` });
    w.add({ id: 'fl', label: r.amC.req ? 'Compression-flange lateral bending, amplified' : 'Compression-flange lateral bending (first order; amplification not required)', sym: 'f_{\\ell}', eq: r.amC.req ? '\\frac{0.85}{1 - f_{bu}/F_{cr}}f_{\\ell1} \\ge f_{\\ell1}' : 'f_{\\ell1}', sub: r.amC.req ? `${isFinite(r.amC.AF) ? n3(r.amC.AF) : '\\infty'}(${n2(r.flC)})` : n2(r.flC), value: r.amC.fl, unit: 'ksi', d: 3, ref: `${ED} Eqs. 6.10.1.6-4, -5`,
      note: `L_b ${r.amC.req ? '>' : '≤'} 1.2L_p√(C_bR_b/(f_bu/F_yc)) = ${n2(r.amC.lim)} in. First-order f_ℓ during deck placement as entered, else from skew (C6.10.1; Constructibility tab); the overhang-bracket f_ℓ of an exterior girder is checked in OH1–OH5.` });
    const c = r.checks, dem = k => c.find(q => q.key === k);
    let q = dem('yield'); w.add({ id: 'yield.ok', label: `GS14, ${cF.lab} flange yielding`, sym: 'f_{bu} + f_{\\ell}', eq: '\\le \\phi_{f}R_{h}F_{yc}', sub: `${n2(cF.f)} + ${n2(r.amC.fl)} = ${n2(q.demand)} \\le 1.0(${n3(r.RhC)})(${n2(cF.Fy)}) = ${n2(q.capacity)}`, value: okv(q.demand, q.capacity), unit: '', ref: `${ED} Eq. 6.10.3.2.1-1`, ok: q.ok, note: `Ratio ${n3(q.ratio)}. Applied to every web (conservative for compact and noncompact webs; GirderDetail).` });
    q = dem('buckling'); w.add({ id: 'buck.ok', label: `GS14, ${cF.lab} flange flexural resistance`, sym: 'f_{bu} + \\frac{f_{\\ell}}{3}', eq: '\\le \\phi_{f}F_{nc}', sub: `${n2(cF.f)} + \\frac{${n2(r.amC.fl)}}{3} = ${n2(q.demand)} \\le ${n2(q.capacity)}`, value: okv(q.demand, q.capacity), unit: '', ref: `${ED} Eq. 6.10.3.2.1-2`, ok: q.ok, note: `Ratio ${n3(q.ratio)}.` });
    w.add({ id: 'k', label: r.webC.both ? 'Bend-buckling coefficient: D_c > D, both web edges in compression' : 'Bend-buckling coefficient', sym: 'k', eq: r.webC.both ? '7.2' : '\\frac{9}{(D_{c}/D)^{2}}', sub: r.webC.both ? '' : `\\frac{9}{(${n3(Math.max(r.DcC, 1e-6))}/${n3(r.D)})^{2}}`, value: r.webC.k, unit: '', d: 3, ref: `${ED} Eq. 6.10.1.9.1-2` });
    w.add({ id: 'Fcrw', label: 'Nominal web bend-buckling resistance', sym: 'F_{crw}', eq: '\\frac{0.9Ek}{(D/t_{w})^{2}} \\le \\min(R_{h}F_{yc}, \\frac{F_{yw}}{0.7})', sub: `\\frac{0.9(29{,}000)(${n3(r.webC.k)})}{(${n3(r.D)}/${n4(r.tw)})^{2}} = ${n2(r.webC.Fe)};\\ \\min(${n2(r.RhC * cF.Fy)}, ${n2(r.mat.Fyw / 0.7)})`, value: r.webC.F, unit: 'ksi', d: 3, ref: `${ED} Eq. 6.10.1.9.1-1` });
    q = dem('web'); w.add({ id: 'web.ok', label: 'GS15, web bend-buckling', sym: 'f_{bu}', eq: '\\le \\phi_{f}F_{crw}', sub: `${n2(q.demand)} \\le ${n2(q.capacity)}`, value: okv(q.demand, q.capacity), unit: '', ref: `${ED} Eq. 6.10.3.2.1-3`, ok: q.ok, note: `Ratio ${n3(q.ratio)}.` });
    q = dem('tension'); w.add({ id: 'tens.ok', label: `GS15, ${tF.lab} flange (tension) yielding`, sym: 'f_{bu} + f_{\\ell}', eq: '\\le \\phi_{f}R_{h}F_{yt}', sub: `${n2(tF.f)} + ${n2(r.flC)} = ${n2(q.demand)} \\le 1.0(${n3(r.RhC)})(${n2(tF.Fy)}) = ${n2(q.capacity)}`, value: okv(q.demand, q.capacity), unit: '', ref: `${ED} Eq. 6.10.3.2.2-1`, ok: q.ok, note: `Ratio ${n3(q.ratio)}. f_ℓ of the tension flange: the entered first-order value (no amplification for a tension flange).` });
    w.add({ id: 'Vu', label: 'Deck placement factored shear', sym: 'V_{u}', eq: '\\gamma_{DC}V_{DC1} + \\gamma_{CL}V_{CL}', sub: `${nf(G.cdc)}(${n2(r.VDC1)}) + ${nf(G.ccl)}(${n2(r.VCL)})`, value: r.VuC, unit: 'kip', d: 2, ref: tbl, note: 'V_DC1: steel and the whole wet deck (GirderDetail GS16).' + etaNote(G) });
    const ws = St().work('cn.sh'); SH().panelSteps(ws, 'p', r.sh, { D: r.D, tw: r.tw, Fyw: r.mat.Fyw, doIn: r.do, end: r.end, flgA: r.flgA }); w.take(ws.steps.filter(z => !/\.(rat|Vn)$/.test(z.id)));
    q = dem('shear'); w.add({ id: 'sh.ok', label: 'GS16, web shear during deck placement (no tension-field action)', sym: 'V_{u}', eq: '\\le \\phi_{v}V_{cr} = \\phi_{v}CV_{p}', sub: `${n2(q.demand)} \\le 1.0(${n4(r.sh.C)})(${n2(r.sh.Vp)}) = ${n2(q.capacity)}`, value: okv(q.demand, q.capacity), unit: '', ref: `${ED} Eq. 6.10.3.3-1`, ok: q.ok, note: `Ratio ${n3(q.ratio)}.` });
    return w.steps;
  }

  /* ---------- unbraced length for deck placement (Preliminary sizing gsRow, CB1 / CB2 / SKX / NPG) ---------- */
  /* bracingC(x, env, opt): L_b,C, C_b,C and nprC of the location at x, from the deck-placement moment M_c = 1.25M_DCc + 1.5M_CL that
     location() checks (M_DC1 where M_DCc is not given: useDCc) of the unbraced segment(s) containing x, for the flange M_c compresses
     there (steel section). SBCON (engineer decision 2026-11-10): was 1.25M_DC1 + 1.5M_CL always (Preliminary sizing's T.Mc); GirderDetail
     keeps that (a deliberate difference).
     env = { xs, MDC1, MCL, MDCc (optional) } at the analysis stations; opt = { braces (ft: bearings and cross-frames), L (girder length),
     secAt(x) -> plates, D, impl (optional fe* functions, for the parity test), G (the check's factors prj.G, so that the γ_e passed in nprC.gB
     is on the factored basis of f_bu; SBGE 2026-11-10; default factors()) }. Returns { LbC, CbC, nprC, seg, cbParts, kParts, mSrc }. */
  function bracingC(x, env, opt) {
    const F = FX(), I = opt.impl || {}, feCb_ = I.feCb || F.feCb, feNpr_ = I.feNpr || F.feNpr, feGe_ = I.feGe || F.feGe, feGeA_ = I.feGeA || F.feGeA, feGov_ = I.feGov || F.feGov, feAt_ = I.feAt || F.feAt;
    // FONE (2026-11-01): γ from factors(), was 1.25, 1.5. SBCON (engineer decision 2026-11-10; AASHTO LRFD 10th Ed. 6.10.8.2.3c, C6.10.8.2.3c):
    // M_DCc where location() uses it (useDCc), so that the flange in compression, C_b (Eq. 6.10.8.2.3b-1) and the γ_e of a nonprismatic L_b
    // (K = f_max/f_x) come from the moments the check uses; was M_DC1 always (GirderDetail keeps M_DC1: a deliberate difference)
    // SBTS (engineer decision 2026-11-10, item 3; AASHTO LRFD 10th Ed. 6.10.8.2.3b, 6.10.8.2.3c and C6.10.8.2.3c): opt.side = +1 / −1 takes
    // the positive-side / negative-side envelope of the pour stages (env.MDCp = max(M_DC1, envPr), env.MDCn = min(M_DC1, envNr) at every
    // station; fromAnalysis), one consistent moment diagram of one sign case over the unbraced length, for the check of that sign. Was the
    // station-by-station M_DCc, which takes the positive side at one station and the negative side at the next (not one load case).
    const sd = !env.Mc && (opt.side === 1 || opt.side === -1) && env.MDCp && env.MDCn ? opt.side : 0, MS = sd > 0 ? env.MDCp : sd < 0 ? env.MDCn : null;
    const xs = env.xs, N = xs.length, Lend = opt.L, C0 = opt.G || factors(), dcc = xs.map((_, k) => !env.Mc && (MS ? true : !!env.MDCc && useDCc(env.MDCc[k])));
    const Mc = env.Mc || xs.map((_, k) => C0.cdc * (MS ? +MS[k] : dcc[k] ? +env.MDCc[k] : env.MDC1[k]) + C0.ccl * env.MCL[k]);
    const bp = [...new Set(opt.braces.map(v => +(+v).toFixed(3)))].sort((p1, p2) => p1 - p2).filter((v, k, arr) => k === 0 || v - arr[k - 1] > 0.25);
    const ib = bp.findIndex(v => Math.abs(v - x) < 0.25), Lg = bp[bp.length - 1], segs = [];
    if (ib >= 0) { if (ib > 0) segs.push([bp[ib - 1], bp[ib]]); if (ib < bp.length - 1) segs.push([bp[ib], bp[ib + 1]]); }
    else segs.push([[...bp].reverse().find(v => v < x) ?? 0, bp.find(v => v > x) ?? Lg]);
    const node = q => { let b = 0; xs.forEach((v, i) => { if (Math.abs(v - q) < Math.abs(xs[b] - q)) b = i; }); return b; }, i = node(x);
    const secAt = q => opt.secAt(Math.min(Math.max(q, 1e-6), Lend - 1e-6)), s = secAt(x);
    const stP = q => { const d = q.D + q.topT + q.botT, parts = [[q.botB * q.botT, q.botT / 2, q.botB * q.botT ** 3 / 12], [q.D * q.tw, q.botT + q.D / 2, q.tw * q.D ** 3 / 12], [q.topB * q.topT, d - q.topT / 2, q.topB * q.topT ** 3 / 12]];
      const A = parts.reduce((a, p) => a + p[0], 0), yb = parts.reduce((a, p) => a + p[0] * p[1], 0) / A; return { A, yb, d, I: parts.reduce((a, p) => a + p[2] + p[0] * (p[1] - yb) ** 2, 0) }; };
    const sgC = Mc[i] >= 0 ? 1 : -1, kb = sgC > 0 ? 'topB' : 'botB', kt = sgC > 0 ? 'topT' : 'botT', fCon = (q, k) => { const p = stP(q); return sgC * Mc[k] * 12 * (sgC > 0 ? p.d - p.yb : p.yb) / p.I; };
    const rtC = q => { const p = stP(q); return q[kb] / Math.sqrt(12 * (1 + (sgC > 0 ? p.d - p.yb - q.topT : p.yb - q.botT) * q.tw / (3 * q[kb] * q[kt]))); };
    const geSeg = (np, p0, p1, LbIn, rtF, fF) => { const ks = []; for (let k = 0; k < N; k++) if (xs[k] >= p0 - 1e-6 && xs[k] <= p1 + 1e-6) ks.push(k);
      const A = feGeA_(np.pcs, np.tr, p0, p1, LbIn, opt.D, xs, rtF, fF), mA = !!(A && A.ok); return { A, mA, G: mA ? A : feGe_(np.pcs, LbIn, rtF, fF, ks) }; };
    const byGe = (u, v) => u.ge && v.ge && u.ge.G && v.ge.G ? u.ge.G.g - v.ge.G.g : null;
    // SBCB (2026-11-10): Cb = max(1.0, Eq. 6.10.8.2.3b-1) for the segment choice and C_b,C; Cb0 as the equation gives it, for the worked step
    const cC = segs.map(([p0, p1]) => { const L = p1 - p0, n2_ = feNpr_(p0, p1, secAt, q => sgC * feAt_(xs, Mc, q)); return { p0, p1, L, n2: n2_, Cb: n2_.kind === 'ge' ? 1 : Math.max(CB_MIN, feCb_(xs, Mc, p0, p1, sgC)), Cb0: n2_.kind === 'ge' ? 1 : feCb_(xs, Mc, p0, p1, sgC), ge: n2_.kind === 'ge' ? geSeg(n2_, p0, p1, L * 12, rtC, fCon) : null }; })
      .sort((u, v) => byGe(u, v) ?? v.L / v.Cb - u.L / u.Cb)[0], CbC = cC ? cC.Cb : 1, LbCN = cC ? cC.L : opt.sp;
    const geRec = A => !A ? '' : A.ok ? { m: 'A', ge: +A.g.toFixed(4), Cbe: r3(A.Cbe), chi: +A.chi.toFixed(4), dS: r3(A.dS), rm: +A.rm.toFixed(4), rA: +A.rA.toFixed(4), rB: +A.rB.toFixed(4), rC: +A.rC.toFixed(4), sA: A.sA ? 1 : 0, sB: A.sB ? 1 : 0, sC: A.sC ? 1 : 0, xm: r2(A.xm), Fe1: r2(A.Fe1), fm: r2(A.fm), Imx: r3(A.Imx) } : { m: 'bound', why: A.why, Imx: r3(A.Imx) };
    const govRec = gv => { if (!gv) return ''; const at = A => A[gv.i] * (1 - gv.t) + A[gv.i + 1] * gv.t, o = { x: r2(gv.x), topB: gv.s.topB, topT: gv.s.topT, botB: gv.s.botB, botT: gv.s.botT, tw: gv.s.tw };
      [['MDC1', 'MDC1'], ['MCL', 'MCL'], ['MDCc', MS ? (sd > 0 ? 'MDCp' : 'MDCn') : 'MDCc']].forEach(([k, a]) => { if (env[a]) o[k] = r1(at(env[a])); }); if (MS) o.side = sd; return o; };   // SBTS: the side's M_DCc
    let nprC = ''; if (cC && cC.n2.kind === 'simp') nprC = { kind: 'simp', fl: sgC > 0 ? 'top' : 'bottom', b: cC.n2.big[kb], t: cC.n2.big[kt], Ir: r3(cC.n2.Ir) };
    else if (cC && cC.n2.kind === 'ge') { const { A, mA, G } = cC.ge, fr = G ? fCon(G.s, i) : 0;
      nprC = { kind: 'ge', fl: sgC > 0 ? 'top' : 'bottom', b: G ? G.s[kb] : s[kb], t: G ? G.s[kt] : s[kt], k: G && fr > 0 && !mA ? r3(Math.max(1, G.fm / fr)) : '', Ir: r3(cC.n2.Ir), why: cC.n2.why, A: geRec(A),
        // SBGE (2026-11-10): the bound γ_e itself (feGe: F_e,j = π²E/(L_b/r_t,j)² over f_max,j, the section j with the smallest ratio), for location()
        ...(G && !mA ? { gB: { ge: +G.g.toFixed(4), Fe: r2(G.Fe), fm: r3(G.fm), rt: +G.rt.toFixed(4), x0: r2(cC.n2.pcs[G.j].x0), x1: r2(cC.n2.pcs[G.j].x1) } } : {}),
        ...(G ? { G: govRec(feGov_(cC.n2.pcs, xs, () => 1, fCon)) } : {}) }; }
    // SBCON (2026-11-10, show the work): the moments used (mSrc: 'DCc' where M_DCc is used at a station of the segment, else 'DC1'), the
    // C_b parts (Eq. 6.10.8.2.3b-1, as feCb) of a prismatic / simplified segment and K = f_max/f_x of the conservative γ_e bound
    let cbParts = null, kParts = null, mSrc = 'DC1';
    if (cC) { for (let k = 0; k < N; k++) if (dcc[k] && xs[k] >= cC.p0 - 1e-6 && xs[k] <= cC.p1 + 1e-6) { mSrc = 'DCc'; break; }
      if (cC.n2.kind !== 'ge') { const at = q => feAt_(xs, Mc, q), L0 = cC.p1 - cC.p0; let Mx = 0; for (let k = 0; k <= 40; k++) Mx = Math.max(Mx, sgC * at(cC.p0 + L0 * k / 40));
        if (Mx > 0) { const q = f => Math.abs(at(cC.p0 + L0 * f)); cbParts = { Mx, MA: q(0.25), MB: q(0.5), MC: q(0.75), Cb0: +cC.Cb0.toFixed(3) }; } }   // SBCB: Cb0 before the 1.0 bound
      else if (cC.ge.G && !cC.ge.mA) kParts = { fm: cC.ge.G.fm, fx: fCon(cC.ge.G.s, i), x: xs[i] }; }
    return { LbC: r2(LbCN), CbC: +CbC.toFixed(3), nprC, seg: cC ? { xa: cC.p0, xb: cC.p1 } : null, cbParts, kParts, mSrc, side: sd };
  }

  /* notes(seq, sides): the assumptions of the deck-placement LTB data (engineer's rule 2026-11-10: every assumption is a note on the tab card and
     in the Report section), plain text; seq: the pour sequence is in use (M_DCc); sides: both sides of the pour envelope are known (this
     project's analysis; SBTS 2026-11-10), so both signs are checked. One source for ui/constructibility.js and report/builders.js. */
  function notes(seq, sides) {
    const M = seq ? 'M_DCc (the pour-sequence envelope)' : 'M_DC1 (no pour sequence)', two = !!(seq && sides);
    return [
      ...(two ? [
        'Both signs of the deck-placement moment (engineer decision 2026-11-10): at every location the largest positive and the largest negative noncomposite moment of the deck placement sequence are both checked (6.10.3.4.1: the girder is checked for the moments of the pour sequence; each extreme is taken over M_DC1 with the deck cast at once and every pour stage). Each case is M_c = γ_DC M_DCc + γ_CL M_CL with the construction live load as given at the location, and each has its own flange in compression, f_bu, amplified f_ℓ (6.10.1.6) and F_nc in GS14 and GS15 (6.10.3.2). The case with the larger ratio governs and is the one reported; both count for the span results. A location where the pour stages give one sign only (the other side smaller than 0.01 kip-ft) has one case. Where M_CL outweighs a small pour moment a case\'s M_c can take the other sign; its flange in compression then follows M_c.',
        'Basis of C_b and γ_e (engineer decision 2026-11-10): each sign case takes C_b (Eq. 6.10.8.2.3b-1) and, for a nonprismatic unbraced length, the conservative γ_e bound from its own moment diagram over the whole unbraced length: the positive-side envelope (at every station the larger of M_DC1 and the largest pour-stage moment) for the positive case, the negative-side envelope (the smaller of M_DC1 and the most negative pour-stage moment) for the negative case, factored as the check (γ_DC M_DCc + γ_CL M_CL). Each diagram belongs to one sign case at every station, so the moment gradient in C_b and the stresses that γ_e scales come from the moments that case checks (6.10.8.2.3b: M_max, M_A, M_B and M_C are taken from the envelope values that give the largest compression in the flange considered, or the least tension where it is never in compression, which is what each side envelope gives for its flange; C6.10.8.2.3b: C_b accounts for the moment gradient between brace points; 6.10.8.2.3c and C6.10.8.2.3c: γ_e scales the design stresses at the governing section of the moments checked; App. D6.6). Formerly the station-by-station M_DCc envelope was used, which takes the positive side at one station and the negative side at the next near an inflection point of M_DC1 and so is not one load case. The diagram of a single pour stage was not used: no single stage gives the largest moment of either sign everywhere in the unbraced length.']
        : [`C_b and γ_e: taken from the same factored moments this check uses, M_c = γ_DC ${M} + γ_CL M_CL, over the unbraced length. The flange in compression, C_b (Eq. 6.10.8.2.3b-1), and for a nonprismatic unbraced length the ratio K = f_max/f_x and the stress f_s of the conservative γ_e bound all come from that one moment diagram, so γ_e scales the design stresses at the governing section of the moments checked (AASHTO LRFD 10th Ed. 6.10.8.2.3c and C6.10.8.2.3c; App. D6.6).`]),
      'γ_e of a nonprismatic unbraced length, where App. D6.6.2 Method A does not apply: the conservative bound, the smallest over the sections of the unbraced length of F_e,j/f_max,j, each section taken as prismatic over the whole unbraced length at its largest compression stress f_max,j from the moments this check uses (6.10.8.2.3c, C6.10.8.2.3c: γ_e is one factor for the whole unbraced length that scales the stresses at the governing section; App. D6.6). It is computed once for the unbraced length and passed to every location in it, so a location where the flange stress is zero, near zero or of the other sign (f_x ≤ 0) does not change it. Only where no γ_e is available and K = f_max/f_x cannot be used is f_max taken as the largest stress known in the unbraced length (conservative; formerly K = 1 there, which was unconservative).',
      ...(seq && !sides ? ['One M_DCc value per station (a hand-off file or entered rows): only the envelope value of each station is given, not both sides of the pour envelope, so each location is checked for the sign of that value, and C_b and γ_e come from that M_DCc over the unbraced length. Near an inflection point of M_DC1 a smaller pour moment of the opposite sign is not in the data and is not checked; with this project\'s analysis as the source both signs are checked (6.10.3.4.1).'] : []),
      ...(seq ? [two
        ? 'Differs from GirderDetail (Steel Bridge Design.html): with a pour sequence GirderDetail checks one M_DCc value per station (the side of the sign of M_DC1) and takes the compression flange, C_b and K from M_DC1; this app checks both signs of the pour envelope, each with C_b and γ_e from its own side of the envelope (6.10.3.4.1; 6.10.8.2.3c and C6.10.8.2.3c). Near inflection points and wherever M_DCc differs from M_DC1 over an unbraced length the two tools give different C_b, F_nc and ratios.'
        : 'Differs from GirderDetail (Steel Bridge Design.html): with a pour sequence GirderDetail takes the compression flange, C_b and K of the deck-placement check from M_DC1 while it checks M_DCc; this app takes them from M_DCc, the moments it checks (6.10.8.2.3c and C6.10.8.2.3c: γ_e scales the stresses of the one moment diagram checked). Where M_DCc differs from M_DC1 over an unbraced length the two tools give different C_b, F_nc and ratios.'] : []),
      'C_b by Eq. 6.10.8.2.3b-1 is not taken below 1.0 (engineer decision 2026-11-10), for deck placement and for the overhang checks. M_max is the largest moment compressing the flange in the unbraced length and M_A, M_B, M_C the absolute values of the deck-placement moment at the quarter points (6.10.8.2.3b), so where the flange is in tension over part of the unbraced length the equation can give less than 1.0. C6.10.8.2.3b gives 1.0 as the base value of C_b for a constant moment and allows 1.0 conservatively in any case (except the unusual cases it names), so a value below 1.0 is not used: C_b = max(1.0, Eq. 6.10.8.2.3b-1), in F_nc (6.10.8.2.3), in the choice of the governing segment and in the f_ℓ amplification limit (6.10.1.6). An overhang C_b entered below 1.0 is raised to 1.0.'];
  }

  /* ---------- deck overhang brackets, exterior girder (GirderDetail GM.oh) ---------- */
  /* GirderDetail's Deck overhang module inputs (GM.oh.def): bracket a, h_b (in); deck width carried wOH (in), overhang thickness tOH (in),
     w_c (kcf), forms qForm (ksf), screed rail, railing, walkway (klf), construction LL qCL (ksf) over bCL (in), finishing machine Pfm (kip
     per bracket); R_h, C_b of the module; γ_DC, γ construction. */
  const OH_DEF = { Rh: 1.0, Cb: 1.0, gam: { dc: 1.25, cl: 1.50 }, a: 36, hb: 54, wOH: 30, tOH: 9, wc: 0.150, qForm: 0.010, wScreed: 0.085, wRail: 0.025, wWalk: 0.125, qCL: 0.020, bCL: 30, Pfm: 3.0 };
  /* ohFill(project, gi): "Fill from cross-section" (GirderDetail XS11, SB2-C2; a button with a confirmation, never automatic): the bracket
     deck geometry from the Cross-section inputs. Deck width carried by the brackets w_OH = 12·overhang − b_tf/2 (in, to 0.01; the
     overhang from the exterior girder centerline to the deck edge, the side with the larger overhang, left when equal; b_tf the narrowest
     top flange of this girder: the widest deck strip outside the flange), overhang deck thickness t_OH = the total deck thickness
     (deck.tdeck: the structural slab plus the integral wearing surface, all placed on the brackets; GirderDetail takes t_s, its bridge
     data having no wearing thickness), w_c = the deck concrete unit weight. Returns { vals: { wOH, tOH, wc }, sd, oh, bf, why, steps } or { err }. */
  function ohFill(P, gi) {
    const xs = P.xs, g = P.girders[gi], d = P.deck || {}, c = (P.materials || {}).concrete || {};
    if (!xs || !(xs.ohL >= 0) || !(xs.ohR >= 0)) return { err: 'No cross-section: enter the overhangs on the Cross-section tab.' };
    if (!g || !g.segments || !g.segments.length) return { err: 'No girder plates.' };
    const sd = +xs.ohR > +xs.ohL + 1e-9 ? 'R' : 'L', oh = sd === 'L' ? +xs.ohL : +xs.ohR, bf = Math.min(...g.segments.map(s => +s.topB));
    const raw = Math.max(oh * 12 - bf / 2, 0), wOH = Math.round(raw * 100) / 100, tOH = +d.tdeck > 0 ? +d.tdeck : +d.ts, wc = +c.wc;
    const w = St().work('oh.fill'), side = sd === 'L' ? 'left' : 'right';
    w.add({ id: 'wOH', label: `Deck width carried by the brackets (${side} overhang ${n2(oh)} ft, narrowest top flange ${n2(bf)} in)`, sym: 'w_{OH}', eq: '12\\,OH - \\frac{b_{tf}}{2}', sub: `12(${n2(oh)}) - \\frac{${n2(bf)}}{2}`, value: wOH, unit: 'in', d: 2,
      ref: 'C6.10.3.4', note: 'Overhang: exterior girder centerline to the deck edge (Cross-section tab), the larger side. Rounded to 0.01 in.' });
    w.add({ id: 'tOH', label: 'Overhang deck thickness (total deck thickness)', sym: 't_{OH}', eq: 't_{deck}', sub: '', value: tOH, unit: 'in', d: 2, note: 'Structural slab and integral wearing surface, all placed on the brackets; no overhang thickening in the project data.' });
    w.add({ id: 'wc', label: 'Deck concrete unit weight', sym: 'w_{c}', eq: '', sub: '', value: wc, unit: 'kcf', d: 3, ref: 'Table 3.5.1-1' });
    const why = { wOH: `${side} overhang ${n2(oh)} ft × 12 − ${n2(bf)}/2 in (the narrowest top flange)`, tOH: 'the total deck thickness (slab + integral wearing surface)', wc: 'the deck concrete unit weight' };
    return { vals: { wOH, tOH, wc }, sd, oh, bf, why, steps: w.steps };
  }

  /* ohLoads(p): the factored bracket load w_u (klf), its horizontal flange force F_ℓ = w_u a/h_b (klf) and the finishing machine
     P_ℓ = γ P_fm a/h_b (kip) (GM.oh.compute). p.loads = { wu, Fl, Pl } gives them directly (a hand-off's stored values). */
  function ohLoads(p) {
    const q = { ...OH_DEF, ...(p || {}), gam: { ...OH_DEF.gam, ...((p || {}).gam || {}) } }, gd = +q.gam.dc, gc = +q.gam.cl, tana = +q.a / +q.hb;
    const L = { deck: +q.wc * +q.tOH / 12 * +q.wOH / 12, form: +q.qForm * +q.wOH / 12, screed: +q.wScreed, rail: +q.wRail, walk: +q.wWalk, cll: +q.qCL * +q.bCL / 12 };
    let wu = gd * L.deck + gc * (L.form + L.screed + L.rail + L.walk + L.cll), Fl = wu * tana, Pl = gc * +q.Pfm * tana;
    if (q.loads) { wu = +q.loads.wu; Fl = +q.loads.Fl; Pl = +q.loads.Pl; }
    return { p: q, gd, gc, tana, L, wu, Fl, Pl, given: !!q.loads };
  }
  /* overhang(rows, p, mat): GM.oh.compute and GM.oh.checks. rows = [{ name, x, D, tw, topB, topT, botB, botT, Lb (ft), MDC1, MCL }];
     mat = { Fyf (flanges), Fyw }. Returns { ...ohLoads, rows (each with checks OH1–OH5 and its steps), Rh, Cb, Fyf, Fyw, errors }. */
  function overhang(rows, p, mat) {
    const B = ohLoads(p), q = B.p, errors = [];
    ['Rh', 'Cb', 'a', 'hb', 'wc'].forEach(k => { if (!(+q[k] > 0)) errors.push(`"${k}" must be positive.`); });
    ['wOH', 'tOH', 'qForm', 'wScreed', 'wRail', 'wWalk', 'qCL', 'bCL', 'Pfm'].forEach(k => { if (!(+q[k] >= 0)) errors.push(`"${k}" must be zero or positive.`); });
    if (!rows.length) errors.push('No location.');
    if (errors.length) return { errors };
    // SBCB (2026-11-10): C_b ≥ 1.0 (an entered value below 1.0 is raised to 1.0; 6.10.8.2.3b, C6.10.8.2.3b)
    const Fyf = mat.Fyf, Fyw = mat.Fyw, Rh = +q.Rh, Cb = Math.max(CB_MIN, +q.Cb), gd = B.gd, gc = B.gc, Fl = B.Fl, Pl = B.Pl;
    const out = rows.map(r0 => { const r = { ...r0 }, s = SEC().steelCore(plates(r)), Mu = gd * r.MDC1 + gc * r.MCL; r.s = s; r.Mu = Mu;
      r.fTop = -Mu * 12 * (s.d - s.yb) / s.I; r.fBot = Mu * 12 * s.yb / s.I;       // extreme fibers, tension +
      const pos = Mu >= 0, c = pos ? { b: r.topB, t: r.topT, f: -r.fTop, lab: 'top' } : { b: r.botB, t: r.botT, f: -r.fBot, lab: 'bottom' }, tf = pos ? { b: r.botB, t: r.botT, f: r.fBot, lab: 'bottom' } : { b: r.topB, t: r.topT, f: r.fTop, lab: 'top' };
      r.c = c; r.tf = tf; r.Dc = pos ? (s.d - r.topT) - s.yb : s.yb - r.botT;
      const LbIn = r.Lb * 12; r.Ml = Fl * r.Lb ** 2 / 12 * 12 + Pl * LbIn / 8; [c, tf].forEach(f => { f.S = f.t * f.b ** 2 / 6; f.fl1 = r.Ml / f.S; });
      r.rt = c.b / Math.sqrt(12 * (1 + r.Dc * r.tw / (3 * c.b * c.t)));
      r.Fyr = Math.max(Math.min(0.7 * Fyf, Fyw), 0.5 * Fyf);
      r.lf = c.b / (2 * c.t); r.lpf = 0.38 * Math.sqrt(ES / Fyf); r.lrf = 0.56 * Math.sqrt(ES / r.Fyr);
      r.FncF = r.lf <= r.lpf ? Rh * Fyf : (1 - (1 - r.Fyr / (Rh * Fyf)) * (r.lf - r.lpf) / (r.lrf - r.lpf)) * Rh * Fyf;
      r.Lp = 1.1 * r.rt * Math.sqrt(ES / Fyf); r.Lr = Math.PI * r.rt * Math.sqrt(ES / r.Fyr); r.Fcr = Cb * Math.PI ** 2 * ES / (LbIn / r.rt) ** 2;
      r.FncL = LbIn <= r.Lp ? Rh * Fyf : LbIn <= r.Lr ? Math.min(Cb * (1 - (1 - r.Fyr / (Rh * Fyf)) * (LbIn - r.Lp) / (r.Lr - r.Lp)) * Rh * Fyf, Rh * Fyf) : Math.min(r.Fcr, Rh * Fyf);
      r.Fnc = Math.min(r.FncF, r.FncL);
      r.fbu = Math.max(c.f, 0); r.ampReq = LbIn > 1.2 * r.Lp * Math.sqrt(Cb / Math.max(r.fbu / Fyf, 1e-9));
      r.AF = r.ampReq ? (r.fbu < r.Fcr ? Math.max(0.85 / (1 - r.fbu / r.Fcr), 1) : Infinity) : 1; c.fl = c.fl1 === 0 ? 0 : c.fl1 * r.AF; tf.fl = tf.fl1; r.und = r.AF === Infinity && c.fl1 !== 0;   // SB2-R2
      r.k = 9 / (r.Dc / r.D) ** 2; r.Fcrw = Math.min(0.9 * ES * r.k / (r.D / r.tw) ** 2, Rh * Fyf, Fyw / 0.7); r.LbIn = LbIn;
      // checks OH1–OH5 (GM.oh.checks)
      const ck = o => ({ ratio: o.demand / o.capacity, ok: o.capacity >= o.demand - 1e-9, inUse: true, unit: 'ksi', ...o }), fb = Math.max(tf.f, 0);
      r.checks = [ck({ id: 'OH1', key: 'yield', flange: c.lab, title: `Overhang brackets, ${c.lab} flange (compression) yielding, f_bu + f_ℓ ≤ φ_fR_hF_yc`, ref: `${ED} Eq. 6.10.3.2.1-1`, demand: r.fbu + c.fl, capacity: Rh * Fyf, step: 'oh.yield.ok', ...(r.und ? { ng: FX().AMP_NG } : {}) }),
        ck({ id: 'OH2', key: 'buckling', flange: c.lab, title: `Overhang brackets, ${c.lab} flange flexural resistance, f_bu + f_ℓ/3 ≤ φ_fF_nc`, ref: `${ED} Eq. 6.10.3.2.1-2; 6.10.8.2.2, 6.10.8.2.3`, demand: r.fbu + c.fl / 3, capacity: r.Fnc, step: 'oh.buck.ok', ...(r.und ? { ng: FX().AMP_NG } : {}) }),
        ck({ id: 'OH3', key: 'web', title: 'Overhang brackets, web bend-buckling, f_bu ≤ φ_fF_crw', ref: `${ED} Eq. 6.10.3.2.1-3; 6.10.1.9.1`, demand: r.fbu, capacity: r.Fcrw, step: 'oh.web.ok' }),
        ck({ id: 'OH4', key: 'tension', flange: tf.lab, title: `Overhang brackets, ${tf.lab} flange (tension) yielding, f_bu + f_ℓ ≤ φ_fR_hF_yt`, ref: `${ED} Eq. 6.10.3.2.2-1`, demand: fb + tf.fl, capacity: Rh * Fyf, step: 'oh.tens.ok' }),
        ...[c, tf].map(f => ck({ id: 'OH5', key: 'fl.' + f.lab, flange: f.lab, title: `Flange lateral bending, ${f.lab} flange, f_ℓ ≤ 0.6F_yf`, ref: `${ED} Eq. 6.10.1.6-1`, demand: f.fl, capacity: 0.6 * Fyf, step: `oh.fl.${f.lab}.ok`, ...(r.und && f === c ? { ng: FX().AMP_NG } : {}) }))];
      r.gov = FX().govern(r.checks);   // SB2-R2
      return r; });
    const R = { ...B, errors: [], rows: out, Rh, Cb, CbIn: +q.Cb, Fyf, Fyw };   // SBCB: CbIn as entered
    out.forEach(r => Object.defineProperty(r, 'steps', { enumerable: false, configurable: true, get() { const st = ohWorked(R, r); Object.defineProperty(r, 'steps', { value: st, enumerable: false }); return st; } }));
    return R;
  }
  function ohWorked(R, r) {
    const w = St().work('oh'), L = R.L, c = r.c, tf = r.tf, s = r.s, ref = `${ED} Art. C6.10.3.4`;
    if (!R.given) {
      w.add({ id: 'wu', label: 'Factored load on the overhang brackets (deck × γ_DC; forms, screed rail, railing, walkway and construction LL × γ construction)', sym: 'w_{u}', eq: '\\gamma_{DC}w_{deck} + \\gamma_{CL}(w_{form} + w_{screed} + w_{rail} + w_{walk} + w_{CLL})',
        sub: `${nf(R.gd)}(${n4(L.deck)}) + ${nf(R.gc)}(${n4(L.form)} + ${n4(L.screed)} + ${n4(L.rail)} + ${n4(L.walk)} + ${n4(L.cll)})`, value: R.wu, unit: 'kip/ft', d: 4, ref: `${ED} Art. 3.4.2.1`,
        note: `γ_DC, γ_CL: the deck placement factors of the Constructibility tab (with the owner's η; one source since 2026-11-01). w_deck = w_c t_OH b_OH = ${n3(R.p.wc)}(${n2(R.p.tOH)}/12)(${n2(R.p.wOH)}/12); w_form = q_form b_OH; w_CLL = q_CL b_CL = ${n3(R.p.qCL)}(${n2(R.p.bCL)}/12).` });
      w.add({ id: 'Fl', label: 'Horizontal flange force from the brackets, distributed', sym: 'F_{\\ell}', eq: 'w_{u}\\frac{a}{h_{b}}', sub: `${n4(R.wu)}\\frac{${n2(R.p.a)}}{${n2(R.p.hb)}}`, value: R.Fl, unit: 'kip/ft', d: 4, ref });
      w.add({ id: 'Pl', label: 'Horizontal flange force from the finishing machine', sym: 'P_{\\ell}', eq: '\\gamma_{CL}P_{fm}\\frac{a}{h_{b}}', sub: `${nf(R.gc)}(${n2(R.p.Pfm)})\\frac{${n2(R.p.a)}}{${n2(R.p.hb)}}`, value: R.Pl, unit: 'kip', d: 4, ref });
    } else {
      w.add({ id: 'Fl', label: 'Horizontal flange force from the brackets, distributed (as given)', sym: 'F_{\\ell}', eq: '', sub: '', value: R.Fl, unit: 'kip/ft', d: 4, ref });
      w.add({ id: 'Pl', label: 'Horizontal flange force from the finishing machine (as given)', sym: 'P_{\\ell}', eq: '', sub: '', value: R.Pl, unit: 'kip', d: 4, ref });
    }
    w.add({ id: 'Mu', label: 'Vertical bending, steel section', sym: 'M_{u}', eq: '\\gamma_{DC}M_{DC1} + \\gamma_{CL}M_{CL}', sub: `${nf(R.gd)}${pa(r.MDC1)} + ${nf(R.gc)}${pa(r.MCL)}`, value: r.Mu, unit: 'kip-ft', d: 1, ref: `${ED} Art. 3.4.2.1`, note: 'M_DC1 with the whole deck cast at once (GirderDetail Deck overhang module).' });
    w.add({ id: 'fbu', label: `Compression flange: the ${c.lab} flange (extreme fiber)`, sym: 'f_{bu}', eq: '\\frac{|M_{u}|(12)c}{I}', sub: `\\frac{${n2(Math.abs(r.Mu))}(12)(${n3(c.lab === 'top' ? s.d - s.yb : s.yb)})}{${g0(s.I)}}`, value: r.fbu, unit: 'ksi', d: 3, ref: `${ED} Art. 6.10.1.1.1a` });
    w.add({ id: 'Ml', label: 'Flange lateral bending moment (bracing at the cross-frames; distributed load plus the finishing machine at midpoint)', sym: 'M_{\\ell}', eq: '\\frac{F_{\\ell}L_{b}^{2}}{12}(12) + \\frac{P_{\\ell}L_{b}}{8}', sub: `\\frac{${n4(R.Fl)}(${n2(r.Lb)})^{2}}{12}(12) + \\frac{${n4(R.Pl)}(${n2(r.LbIn)})}{8}`, value: r.Ml, unit: 'kip-in', d: 2, ref });
    [c, tf].forEach(f => w.add({ id: 'fl1.' + f.lab, label: `First-order lateral bending stress, ${f.lab} flange`, sym: `f_{\\ell1,${f.lab}}`, eq: '\\frac{M_{\\ell}}{t_{f}b_{f}^{2}/6}', sub: `\\frac{${n2(r.Ml)}}{${n3(f.t)}(${n2(f.b)})^{2}/6}`, value: f.fl1, unit: 'ksi', d: 3, ref: `${ED} Art. C6.10.1.6` }));
    w.add({ id: 'Dc', label: 'Depth of the web in compression, steel section', sym: 'D_{c}', eq: '', sub: '', value: r.Dc, unit: 'in', d: 3, ref: `${ED} App. D6.3.1` });
    w.add({ id: 'rt', label: 'Effective radius of gyration for LTB', sym: 'r_{t}', eq: '\\frac{b_{fc}}{\\sqrt{12\\left(1 + \\frac{D_{c}t_{w}}{3b_{fc}t_{fc}}\\right)}}', sub: `\\frac{${n2(c.b)}}{\\sqrt{12\\left(1 + \\frac{${n3(r.Dc)}(${n4(r.tw)})}{3(${n2(c.b)})(${n3(c.t)})}\\right)}}`, value: r.rt, unit: 'in', d: 4, ref: `${ED} Eq. 6.10.8.2.3-9` });
    w.add({ id: 'FLB', label: `Flange local buckling (λ_f = ${n2(r.lf)}, λ_pf = ${n2(r.lpf)}, λ_rf = ${n2(r.lrf)}; F_yr = ${n2(r.Fyr)} ksi)`, sym: 'F_{nc,FLB}', eq: '', sub: '', value: r.FncF, unit: 'ksi', d: 3, ref: `${ED} Eqs. 6.10.8.2.2-1, -2`, note: 'R_b = 1.0 (6.10.3.2.1).' });
    w.add({ id: 'LTB', label: `Lateral-torsional buckling (L_p = ${n2(r.Lp)} in, L_r = ${n2(r.Lr)} in, L_b = ${n2(r.LbIn)} in, C_b = ${n2(R.Cb)}${R.CbIn < CB_MIN ? `, entered ${n2(R.CbIn)} raised to 1.0: C_b is not taken below 1.0, C6.10.8.2.3b` : ''})`, sym: 'F_{nc,LTB}', eq: '', sub: '', value: r.FncL, unit: 'ksi', d: 3, ref: `${ED} Eqs. 6.10.8.2.3-1, -2, -3` });
    w.add({ id: 'AF', label: r.ampReq ? 'Amplification of the compression-flange f_ℓ' : 'Amplification of the compression-flange f_ℓ: not required', sym: 'AF', eq: r.ampReq ? '\\frac{0.85}{1 - f_{bu}/F_{cr}} \\ge 1.0' : '1.0', sub: r.ampReq ? `\\frac{0.85}{1 - ${n2(r.fbu)}/${n2(r.Fcr)}}` : '', value: r.AF, unit: '', d: 4, ref: `${ED} Eq. 6.10.1.6-4`, note: 'No amplification of the tension flange.' });
    w.add({ id: 'k', label: 'Bend-buckling coefficient', sym: 'k', eq: '\\frac{9}{(D_{c}/D)^{2}}', sub: `\\frac{9}{(${n3(r.Dc)}/${n3(r.D)})^{2}}`, value: r.k, unit: '', d: 3, ref: `${ED} Eq. 6.10.1.9.1-2` });
    w.add({ id: 'Fcrw', label: 'Web bend-buckling resistance', sym: 'F_{crw}', eq: '\\frac{0.9Ek}{(D/t_{w})^{2}} \\le \\min(R_{h}F_{yc}, \\frac{F_{yw}}{0.7})', sub: `\\frac{0.9(29{,}000)(${n3(r.k)})}{(${n3(r.D)}/${n4(r.tw)})^{2}}`, value: r.Fcrw, unit: 'ksi', d: 3, ref: `${ED} Eq. 6.10.1.9.1-1` });
    r.checks.forEach(k => w.add({ id: k.step.replace(/^oh\./, ''), label: `${k.id}: ${k.title}`, sym: '', eq: '', sub: `${n2(k.demand)} \\le ${n2(k.capacity)}`, value: okv(k.demand, k.capacity), unit: '', ref: k.ref, ok: k.ok, note: `Ratio ${n3(k.ratio)}.` }));
    return w.steps;
  }

  /* ---------- a girder ---------- */
  /* girder(locs, prj, opt): every location; per span the governing item of each group as GirderDetail's hand-off (gdStConstr): the
     compression top flange (GS14 yield / buckling, GS15 web where M_c compresses the top), the compression bottom flange (the same where it
     compresses the bottom), the tension flange (GS15), shear (GS16). opt = { supports (ft), oh: { rows, p, mat } (exterior girder) }. */
  function girder(locs, prj, opt) {
    opt = opt || {};
    const rows = locs.map(L => location(L, prj)), sup = opt.supports || null, spans = [];
    const spOf = x => { if (!sup || x == null) return 1; let k = 0; while (k < sup.length - 2 && x > sup[k + 1] + 1e-9) k++; return k + 1; };
    const gr = FX().gr, best = {}, put = (sp, k, o) => { const b = best[sp] = best[sp] || {}; if (!b[k] || gr(b[k]) < gr(o)) b[k] = o; };
    // SBTS (2026-11-10): both sign cases of a location (r.cases) count for the span's governing items, each under its own flange in
    // compression; o.row is the location's reported row, o.cs the case the check belongs to (o.cs !== o.row: the other, non-governing case)
    rows.forEach(r => { const sp = spOf(r.x); (r.cases || [r]).forEach(q => { const cf = q.conC.lab === 'top' ? 'top' : 'bot';
      q.checks.forEach(c => { const o = { ratio: c.ratio, row: r, check: c, cs: q };
        if (c.id === 'GS16') put(sp, 'shear', o); else if (c.key === 'tension') put(sp, 'tens', o); else put(sp, cf, o); }); }); });
    const nS = sup ? sup.length - 1 : 1;
    for (let k = 1; k <= nS; k++) { const b = best[k] || {}; spans.push({ span: k, top: b.top || null, bot: b.bot || null, tens: b.tens || null, shear: b.shear || null }); }
    let oh = null;
    if (opt.oh && opt.oh.rows && opt.oh.rows.length) { oh = overhang(opt.oh.rows, opt.oh.p, opt.oh.mat);
      if (!oh.errors.length) oh.rows.forEach(r => { const sp = r.span || spOf(r.x), b = spans[sp - 1]; if (!b) return;
        r.checks.forEach(c => { const key = c.id === 'OH5' ? 'ohfl' : 'oh'; if (!b[key] || gr(b[key]) < gr(c)) b[key] = { ratio: c.ratio, row: r, check: c }; }); }); }
    let gov = null; rows.forEach(r => { if (r.gov && (!gov || gr(r.gov) > gr(gov.gov))) gov = r; });
    let govAll = gov ? { ratio: gov.gov.ratio, row: gov, check: gov.gov } : null;
    if (oh && !oh.errors.length) oh.rows.forEach(r => { if (r.gov && (!govAll || gr(r.gov) > gr(govAll))) govAll = { ratio: r.gov.ratio, row: r, check: r.gov, oh: true }; });
    return { rows, spans, oh, gov, govAll };
  }

  /* ohRowsAt(sup, env, locs): the Deck overhang rows of an exterior girder as GirderDetail's hand-off places them (gdStConstr): in each span
     the station with the largest 1.25M_DC1 + 1.5M_CL strictly inside the span (the first one on a tie), the check location nearest to it
     (the first on a tie), with that location's plates, deck-placement L_b and M_DC1, M_CL. */
  function ohRowsAt(sup, env, locs) {
    const C0 = factors(), out = [], Mc = env.xs.map((_, i) => C0.cdc * env.MDC1[i] + C0.ccl * env.MCL[i]);   // FONE: was 1.25, 1.5
    sup.slice(1).forEach((x1, k) => { const x0 = sup[k]; let im = -1; env.xs.forEach((x, i) => { if (x > x0 && x < x1 && (im < 0 || Mc[i] > Mc[im])) im = i; }); if (im < 0) return;
      const xm = env.xs[im], L = locs.reduce((b, q) => Math.abs(+q.x - xm) < Math.abs(+b.x - xm) ? q : b, locs[0]);
      out.push({ name: `Span ${k + 1}, largest deck-placement moment (x = ${(+L.x).toFixed(2)} ft)`, span: k + 1, x: +L.x, ...plates(L.plates), Lb: L.LbC, MDC1: L.M.DC1, MCL: L.M.CL }); });
    return out;
  }

  /* ---------- check locations ---------- */
  /* the stations GirderDetail's "Check at any location" checks: every station; both sides (±0.01 ft) of each plate change and interior
     support; 0.01 ft inside the ends (as engine/flexure.js fromPayload) */
  function stationList(xs, sup, chg, Lend) {
    const list = [], add = x => { if (!list.some(o => Math.abs(o - x) < 0.005)) list.push(x); };
    const stations = x => { const c = chg.find(q => Math.abs(q - x) < 0.011); if (c != null && c > 0.02 && c < Lend - 0.02) return [c - 0.01, c + 0.01];
      const sp = sup.find(v => Math.abs(v - x) < 0.011); if (sp != null) return [sp < 0.02 ? 0.01 : sp > Lend - 0.02 ? Lend - 0.01 : sp - 0.01]; return [Math.min(Math.max(x, 0.01), Lend - 0.01)]; };
    xs.forEach(x => stations(x).forEach(add)); sup.slice(1, -1).forEach(v => add(v + 0.01)); list.sort((a, b) => a - b);
    return list;
  }

  /* fromPayload(pl, opt): the deck-placement check locations of a GirderDetail → ST-Girder hand-off (schema stgirder-external-demands, S2-8):
     every station GirderDetail's Check at any location checks; M_DC1, M_DCc (the payload's pour-sequence envelope; absent: M_DC1), M_CL
     linear between the payload stations; V_DC1, V_CL the largest magnitudes within 0.011 ft (engine/shear.js demands().at); L_b,C, C_b,C,
     nprC from bracingC() with brace points every ≤ L_b of the payload in each span (as engine/flexure.js fromPayload; SB2-O9); d_o and the
     end-panel flag as engine/shear.js fromPayload. opt = { G, Lb, braces, flC, MDCc: false (use M_DC1 only), impl, oh (bracket inputs;
     default the payload's stored girderDetail.checks.constr.oh.inputs: w_u, F_ℓ, P_ℓ as given) }.
     Returns { prj, locs, env, supports, braces, oh: { rows, p, mat } | null, ext }. */
  function fromPayload(pl, opt) {
    opt = opt || {};
    const g = pl.girderDetail || {}, m = g.materials || {}, S = pl.stations || [], zones = (pl.section || {}).zones || [], sup = (pl.member || {}).supports || [], Lend = sup[sup.length - 1];
    const xs = S.map(s => +s.x), arr = k => S.map(s => +s[k] || 0), hasDCc = opt.MDCc !== false && S.some(s => s.M_DCc !== undefined);
    const env = { xs, MDC1: arr('M_DC1'), MCL: arr('M_CL'), ...(hasDCc ? { MDCc: arr('M_DCc') } : {}) };
    const zAt = x => { const z = zones.find(q => x >= q.startX - 1e-9 && x < q.endX) || zones[zones.length - 1]; return { D: z.web.depth, tw: z.web.thickness, topB: z.topFlange.width, topT: z.topFlange.thickness, botB: z.botFlange.width, botT: z.botFlange.thickness }; };
    const chg = zones.slice(0, -1).map(z => z.endX).filter(x => { const a = zAt(x - 0.01), b = zAt(x + 0.01); return ['D', 'tw', 'topB', 'topT', 'botB', 'botT'].some(k => a[k] !== b[k]); });
    const list = stationList(opt.xs || xs, sup, chg, Lend);
    const Lb = opt.Lb != null ? opt.Lb : (g.bracing && g.bracing.Lb) || 25;
    const braces = opt.braces || (() => { const b = []; sup.slice(0, -1).forEach((x0, k) => { const x1 = sup[k + 1], n = Math.max(1, Math.ceil((x1 - x0) / Lb - 1e-9)); for (let j = 0; j < n; j++) b.push(x0 + (x1 - x0) * j / n); }); b.push(Lend); return b; })();
    const dem = SH().demands(pl), ts = ((g.details || {}).transverseStiffener || {}), doIn = opt.do != null ? +opt.do : (ts.spacings && +ts.spacings[0]) || 0, doFt = doIn / 12, cont = sup.length > 2, ends = cont ? [sup[0], sup[sup.length - 1]] : sup;
    const mat = { Fyt: +m.Fyf || 50, Fyb: +m.Fyf || 50, Fyw: +m.Fyw || 50 }, prj = { mat, G: opt.lf ? factorsOwner(opt.lf, opt.G) : factors(opt.G) };   // ETAC: opt.lf, the project's owner η (the app passes it)
    const at = A => x => FX().feAt(xs, A, x), D = Math.max(...zones.map(z => z.web.depth));
    const locs = list.map(x => { const br = bracingC(x, env, { braces, L: Lend, secAt: zAt, D: zAt(x).D, impl: opt.impl, sp: Lb, G: prj.G }), v = dem.at(x);
      return { name: `x = ${x.toFixed(2)} ft`, x, plates: zAt(x), M: { DC1: at(env.MDC1)(x), DCc: hasDCc ? at(env.MDCc)(x) : 0, CL: at(env.MCL)(x) }, V: { DC1: v.DC1, CL: v.CL },
        LbC: br.LbC, CbC: br.CbC, Cb: 1, nprC: br.nprC, seg: br.seg, cbParts: br.cbParts, kParts: br.kParts, mSrc: br.mSrc, flC: opt.flC || 0, do: doIn, end: doIn > 0 && ends.some(s => Math.abs(x - s) <= doFt + 1e-6) }; });
    const ext = g.position === 'exterior', st = ((g.checks || {}).constr || {}).oh;
    const ohP = opt.oh ? { ...opt.oh, gam: { dc: prj.G.cdc, cl: prj.G.ccl } } : (st && st.inputs ? { Rh: st.inputs.Rh, Cb: st.inputs.Cb, gam: { dc: st.inputs.gDC, cl: st.inputs.gCL }, a: st.inputs.a, hb: st.inputs.hb, loads: { wu: st.inputs.wu, Fl: st.inputs.Fl, Pl: st.inputs.Pl } } : { gam: { dc: prj.G.cdc, cl: prj.G.ccl } });   // ETAC: the bracket factors = the deck placement factors (a file's stored loads as given)
    const oh = ext ? { rows: ohRowsAt(sup, env, locs), p: ohP, mat: { Fyf: st && st.inputs && +st.inputs.Fy || mat.Fyt, Fyw: mat.Fyw } } : null;
    return { prj, locs, env, supports: sup, braces, oh, ext, Lb, D };
  }

  /* fromAnalysis(P, gi, AR, opt): the deck-placement check locations of girder gi of an sbd2 project from its analysis (engine/analysis.js
     analyzeGirder; opt.ll = false is enough): every analysis station, both sides of each plate change and interior support, 0.01 ft inside
     the ends; M_DC1 (st.DC1), M_DCc (seq.MDCc where the pour sequence ran; else M_DC1), M_CL (st.CL) linear between stations; V_DC1, V_CL
     at a station the shear just left (VL) of it for a location left of the station, just right (VR) for one right of it, the larger
     magnitude at the station itself; braces: bearings + the cross-frames (P.stiffeners.layout.frames: at, or every ≤ L_b); d_o and the end
     flag from the stiffener layout (engine/stiffeners.js girderBays, bayPanels: the panel containing x). opt = { flC, oh }.
     Returns as fromPayload. */
  function fromAnalysis(P, gi, AR, opt) {
    opt = opt || {};
    const g = P.girders[gi], GR = (window.SBDModel && window.SBDModel.GRADES) || {}, ms = P.materials.steel || {}, Fy = k => (GR[ms[k]] || {}).Fy || 50;
    const mat = { Fyt: Fy('top'), Fyb: Fy('bot'), Fyw: Fy('web') }, prj = { mat, G: opt.G ? factors(opt.G) : projFactors(P) };   // ETAC (2026-11-01): the project's factors with the owner's η (was factors(): no η)
    const xs = AR.x, sup = AR.sup, Lend = AR.Lt, segs = g.segments;
    const zAt = x => { const s = segs.find(q => x >= q.x0 - 1e-9 && x < q.x1) || segs[segs.length - 1]; return plates(s); };
    const chg = segs.slice(0, -1).map(s => s.x1).filter(x => { const a = zAt(x - 0.01), b = zAt(x + 0.01); return ['D', 'tw', 'topB', 'topT', 'botB', 'botT'].some(k => a[k] !== b[k]); });
    const list = stationList(xs, sup, chg, Lend);
    const st = AR.st, MDCc = AR.seq ? AR.seq.MDCc : null;
    // SBTS (engineer decision 2026-11-10, items 1 and 3; AASHTO LRFD 10th Ed. 6.10.3.4.1, 6.10.3.2): the two sides of the pour envelope at
    // every station, MDCp = max(M_DC1, envPr) and MDCn = min(M_DC1, envNr), the pour-stage envelopes before their clip at 0 (seq.MDCc is MDCp
    // where M_DC1 ≥ 0, else MDCn: identical values there). MDCp is the moment with the largest compression in the top flange at the station,
    // or the smallest tension where it is never in compression (6.10.8.2.3b, M_A, M_B, M_C, M_max); MDCn likewise for the bottom flange. Only
    // with this project's analysis (seq.envPr / envNr); a hand-off file or entered rows give one M_DCc per station (one case, as before).
    const Q = AR.seq || {}, okA = A => Array.isArray(A) && A.length === xs.length, sides = !!(MDCc && okA(Q.envPr) && okA(Q.envNr));
    const env = { xs, MDC1: st.DC1.M, MCL: st.CL.M, ...(MDCc ? { MDCc } : {}),
      ...(sides ? { MDCp: xs.map((_, i) => Math.max(st.DC1.M[i], Q.envPr[i])), MDCn: xs.map((_, i) => Math.min(st.DC1.M[i], Q.envNr[i])) } : {}) };
    const ly = (P.stiffeners || {}).layout || {}, fr = ly.frames || {}, SB = window.SBDStiffeners;
    const ints = Array.isArray(fr.at) ? fr.at.map(Number) : SB ? SB.framesDefault(sup, +fr.Lb || 25) : [];
    const braces = opt && opt.braces ? opt.braces : [...sup, ...ints];   // opt.braces: the project's framing (engine/framing.js forGirder; SB2-O9)
    const D = Math.max(...segs.map(s => s.D)), cont = AR.cont;
    const pans = SB ? SB.girderBays(ly, D, sup, cont, sup, ints, gi + 1).flatMap(SB.bayPanels) : [];
    const panelAt = x => pans.find(q => x >= q.p - 1e-9 && x <= q.q + 1e-9) || null;
    const near = x => { let b = 0; xs.forEach((v, i) => { if (Math.abs(v - x) < Math.abs(xs[b] - x)) b = i; }); return b; };
    const vAt = (S, x) => { const i = near(x), d = x - xs[i]; if (Math.abs(d) > 0.02) { const t = Math.max(0, Math.min(1, d > 0 ? d / (xs[i + 1] - xs[i]) : 1 + d / (xs[i] - xs[i - 1]))), a = d > 0 ? i : i - 1; return Math.abs(S.VR[a] * (1 - t) + S.VL[a + 1] * t); }
      return d < -1e-9 ? Math.abs(S.VL[i]) : d > 1e-9 ? Math.abs(S.VR[i]) : Math.max(Math.abs(S.VL[i]), Math.abs(S.VR[i])); };
    const at = A => x => FX().feAt(xs, A, x), Lb = +fr.Lb || 25;
    // SBTS: at each location the sign case of M_DC1 there (sd; its side value as M_DCc, the value seq.MDCc gives at a station) and, where the
    // other side is of the opposite sign (beyond SIDE0 kip-ft, round-off), the opposite-sign case (alt) with its own bracingC data from that side's diagram
    const brOf = (x, side) => bracingC(x, env, { braces, L: Lend, secAt: zAt, D: zAt(x).D, sp: Lb, G: prj.G, ...(side ? { side } : {}) });
    const brF = br => ({ LbC: br.LbC, CbC: br.CbC, nprC: br.nprC, seg: br.seg, cbParts: br.cbParts, kParts: br.kParts, mSrc: br.mSrc });
    const locs = list.map(x => { const pn = panelAt(x), MD = at(env.MDC1)(x), sd = sides ? (MD >= 0 ? 1 : -1) : 0, br = brOf(x, sd);
      const vP = sides ? at(env.MDCp)(x) : 0, vN = sides ? at(env.MDCn)(x) : 0, vA = sd > 0 ? vN : vP, alt = sd && sd * vA < -SIDE0 ? { side: -sd, DCc: vA, ...brF(brOf(x, -sd)) } : null;
      return { name: `x = ${x.toFixed(2)} ft`, x, plates: zAt(x), M: { DC1: MD, DCc: sd ? (sd > 0 ? vP : vN) : MDCc ? at(MDCc)(x) : 0, CL: at(env.MCL)(x) }, V: { DC1: vAt(st.DC1, x), CL: vAt(st.CL, x) },
        Cb: 1, ...brF(br), ...(sd ? { side: sd } : {}), ...(alt ? { alt } : {}), flC: opt.flC || 0, do: pn ? pn.d : 0, end: pn ? pn.end : false }; });
    const ext = g.position === 'exterior';
    const oh = ext ? { rows: ohRowsAt(sup, env, locs), p: { ...(opt.oh || (P.constr && P.constr.oh) || {}), gam: { dc: prj.G.cdc, cl: prj.G.ccl } }, mat: { Fyf: Math.min(mat.Fyt, mat.Fyb), Fyw: mat.Fyw } } : null;   // ETAC: bracket γ = the deck placement factors (one source; P.constr.oh.gam kept, unused)
    return { prj, locs, env, supports: sup, braces, oh, ext, Lb, D, seq: !!MDCc, sides };
  }

  window.SBDConstr = { ES, OH_DEF, notes, ohFill, factors, factorsOwner, lfOf, projFactors, gsGovC, location, bracingC, ohLoads, overhang, girder, ohRowsAt, stationList, fromPayload, fromAnalysis };
})();
