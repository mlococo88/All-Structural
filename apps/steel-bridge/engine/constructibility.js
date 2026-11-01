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
       deck-placement moment M_c = 1.25M_DC1 + 1.5M_CL of the unbraced segment(s) containing the location (bracingC);
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
  const pa = x => `(${n2(x)})`;
  const r1 = v => +(+v).toFixed(1), r2 = v => +(+v).toFixed(2), r3 = v => +(+v).toFixed(3);
  const okv = (dem, cap) => (cap >= dem - 1e-9 ? 'OK' : 'NG');

  /* factors(over): deck placement load factors (GirderDetail's Girder section gam.cdc, gam.ccl): γ_DC 1.25 on M_DCc (or M_DC1), 1.50 on the
     construction live load (AASHTO LRFD 10th Ed. 3.4.2.1). */
  // FONE (2026-11-01): the one source of the deck placement factors; engine/shear.js factors(), the Cross-frames bracing M_u and the Splices
  // tab take them from here. No owner η or m (the owner load rules OWN6–OWN8, 2026-10-15: η on the Strength limit states of the permanent
  // structure and m on HL-93 only; not on deck placement).
  function factors(over) { return { cdc: 1.25, ccl: 1.50, ...(over || {}) }; }
  const fAt = (M, sec, y) => -M * 12 * (y - sec.yb) / sec.I;   // tension +
  const plates = q => ({ D: q.D, tw: q.tw, topB: q.topB, topT: q.topT, botB: q.botB, botT: q.botT });
  const rhOf = (s, q, mat) => SEC().hybrid(plates(q), s, { Fyt: mat.Fyt, Fyb: mat.Fyb, Fyw: mat.Fyw }, 'cn').Rh;   // GirderDetail rhFactor on the steel section
  /* the M_DCc rule of GirderDetail: used when it is a number other than 0 (blank, 0 or missing: M_DC1) */
  const useDCc = v => v !== '' && v != null && isFinite(+v) && +v !== 0;

  /* gsGovC(o, r, kind, X): GirderDetail gsGov, kinds 'Ct' / 'Cb' (deck placement, top / bottom flange): f_bu, D_c and R_h of the
     governing section of a nonprismatic deck-placement unbraced length (o = nprC.G: x, plates, MDC1, MCL, MDCc there). */
  function gsGovC(o, r, kind, X) {
    const pl = ['topB', 'topT', 'botB', 'botT', 'tw'], mk = ['MDC1', 'MCL'];
    if (!o || typeof o !== 'object' || !pl.every(k => +o[k] > 0) || !mk.every(k => o[k] !== '' && o[k] != null && isFinite(+o[k]))) return null;
    const q = { ...r, topB: +o.topB, topT: +o.topT, botB: +o.botB, botT: +o.botT, tw: +o.tw }, s = SEC().steelCore(plates(q)), x = o.x != null && isFinite(+o.x) ? +o.x : null;
    const up = kind === 'Ct', MD = useDCc(o.MDCc) ? +o.MDCc : +o.MDC1, MCL = +o.MCL, G = X.G, Mc = G.cdc * MD + G.ccl * MCL;
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
     title, demand, capacity, ratio, ok, ref, unit, step }], gov (largest ratio) and the worked steps (lazy). */
  function location(L, prj) {
    const G = factors(prj.G), p = plates(L.plates), mat = prj.mat, Fyt = mat.Fyt, Fyb = mat.Fyb, Fyw = mat.Fyw, M = L.M || {}, V = L.V || {}, num = v => +v || 0;
    const s = SEC().steelCore(p), d = s.d;
    const r = { name: L.name, x: L.x, ...p, MDC1: num(M.DC1), MDCc: useDCc(M.DCc) ? +M.DCc : 0, MCL: num(M.CL), VDC1: num(V.DC1), VCL: num(V.CL),
      LbC: +L.LbC, CbC: +L.CbC || 0, Cb: L.Cb != null && +L.Cb > 0 ? +L.Cb : 1, flC: num(L.flC), do: num(L.do), end: !!L.end, s, d, G, mat };
    // constructibility (steel section)
    r.Mc = G.cdc * (r.MDCc !== 0 ? r.MDCc : r.MDC1) + G.ccl * r.MCL; const up = r.Mc >= 0; r.con = { top: fAt(r.Mc, s, d), bot: fAt(r.Mc, s, 0), up };
    r.conC = up ? { lab: 'top', b: r.topB, t: r.topT, Fy: Fyt, f: Math.max(-r.con.top, 0) } : { lab: 'bottom', b: r.botB, t: r.botT, Fy: Fyb, f: Math.max(-r.con.bot, 0) };
    r.conT = up ? { lab: 'bottom', Fy: Fyb, f: Math.max(r.con.bot, 0) } : { lab: 'top', Fy: Fyt, f: Math.max(r.con.top, 0) };
    r.DcC = up ? (d - r.topT) - s.yb : s.yb - r.botT; r.RhC = rhOf(s, r, mat);
    r.CbCu = r.CbC > 0 ? r.CbC : r.Cb;   // C_b for deck placement (CB1): Eq. 6.10.8.2.3b-1 from the deck-placement moments; C_b where blank
    const LTB = FX().ltbFnc;
    r.ltC = LTB({ bfc: r.conC.b, tfc: r.conC.t, Dc: Math.max(r.DcC, 1e-6), tw: r.tw, Lb: r.LbC * 12, Cb: r.CbCu, Rb: 1, Rh: r.RhC, Fyc: r.conC.Fy, Fyw });
    // nonprismatic deck-placement unbraced length (CB2): nprC for the flange M_c compresses (steel section)
    { const nC = L.nprC, ok = nC && typeof nC === 'object' && nC.fl === r.conC.lab && (nC.kind === 'simp' || nC.kind === 'ge') && +nC.b > 0 && +nC.t > 0, b = ok ? +nC.b : 0, t = ok ? +nC.t : 0, LbiC = r.LbC * 12;
      if (ok && nC.kind === 'simp') { const m = LTB({ bfc: b, tfc: t, Dc: Math.max(r.DcC, 1e-6), tw: r.tw, Lb: LbiC, Cb: r.CbCu, Rb: 1, Rh: r.RhC, Fyc: r.conC.Fy, Fyw });
        r.ltC = { ...r.ltC, rt: m.rt, Lp: m.Lp, Lr: m.Lr, Fcr: m.Fcr, LTB: m.LTB, Fnc: Math.min(r.ltC.FLB, m.LTB), npr: { kind: 'simp', b, t, Ir: +nC.Ir || null } }; }
      else if (ok) { const sS = SEC().steelCore(plates(up ? { ...r, topB: b, topT: t } : { ...r, botB: b, botT: t })), fS = -fAt(r.Mc, sS, up ? sS.d : 0), DcS = Math.max(up ? sS.d - t - sS.yb : sS.yb - t, 1e-6), rtS = b / Math.sqrt(12 * (1 + DcS * r.tw / (3 * b * t)));
        const gR = nC.A, gA = gR && typeof gR === 'object' && gR.m === 'A' && +gR.ge > 0 ? gR : null;   // App. D6.6.2 Method A
        const gv = gsGovC(nC.G, r, up ? 'Ct' : 'Cb', { G, mat });   // NPG: the governing section (R_b = 1.0: the largest deck-placement f_bu in L_b)
        const K = +nC.k > 0 ? Math.max(1, +nC.k) : 1, FeS = Math.PI ** 2 * ES / (LbiC / rtS) ** 2, fbu = Math.max(gv ? gv.f : r.conC.f, 0), ge = gA ? +gA.ge : fS > 0 ? FeS / (K * fS) : null, Fe = ge != null && fbu > 0 ? ge * fbu : FeS, rtE = LbiC / Math.PI * Math.sqrt(Fe / ES);
        const m = LTB({ bfc: r.conC.b, tfc: r.conC.t, Dc: Math.max(r.DcC, 1e-6), tw: r.tw, Lb: LbiC, Cb: 1, Rb: 1, Rh: gv ? gv.Rh : r.RhC, Fyc: r.conC.Fy, Fyw, rt: rtE }); r.CbCu = 1;
        r.ltC = { ...r.ltC, rt: m.rt, Lp: m.Lp, Lr: m.Lr, Fcr: m.Fcr, LTB: m.LTB, Fnc: Math.min(r.ltC.FLB, m.LTB), npr: { kind: 'ge', b, t, K, fS, rtS, FeS, ge, fbu, gv, Fe, rtE, Ir: +nC.Ir || null, A: gA, bw: gR && typeof gR === 'object' && gR.m === 'bound' ? String(gR.why || '') : null } }; } }
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
    const seq = r.MDCc !== 0;
    w.add({ id: 'Mc', label: 'Deck placement factored moment, noncomposite steel section', sym: 'M_{c}', eq: `\\gamma_{DC}M_{${seq ? 'DCc' : 'DC1'}} + \\gamma_{CL}M_{CL}`, sub: `${n2(G.cdc)}${pa(seq ? r.MDCc : r.MDC1)} + ${n2(G.ccl)}${pa(r.MCL)}`, value: r.Mc, unit: 'kip-ft', d: 1, ref: tbl,
      note: seq ? `M_DCc: the noncomposite moment envelope of the deck placement sequence (Art. 6.10.3.4.1; Analysis tab, an.seq.MDCc); M_DC1 with the deck cast at once = ${n2(r.MDC1)} kip-ft.` : 'M_DC1: steel and the whole wet deck on the steel section (no pour sequence given).' });
    ['top', 'bot'].forEach(k => w.add({ id: 'f.' + k, label: `Stress, ${k === 'top' ? 'top' : 'bottom'} of steel (tension +)`, sym: `f_{${k}}`, eq: '\\frac{-M_{c}(12)(y - \\bar{y})}{I}', sub: `\\frac{-${pa(r.Mc)}(12)(${n3(k === 'top' ? r.d : 0)} - ${n3(s.yb)})}{${g0(s.I)}}`, value: r.con[k], unit: 'ksi', d: 2, ref: `${ED} Art. 6.10.1.1.1a`, note: 'Steel section: see sec.s.yb, sec.s.I.' }));
    w.add({ id: 'fbu', label: `Compression flange: the ${cF.lab} flange (M_c ${up ? '≥' : '<'} 0)`, sym: 'f_{bu}', eq: `\\max(-f_{${up ? 'top' : 'bot'}}, 0)`, sub: n2(-r.con[up ? 'top' : 'bot']), value: cF.f, unit: 'ksi', d: 2, ref: `${ED} Art. 6.10.3.2.1`, note: 'Stress at the extreme fiber of the flange (conservative).' });
    w.add({ id: 'Dc', label: 'Depth of the web in compression, steel section', sym: 'D_{c}', eq: up ? '(d - t_{ft}) - \\bar{y}' : '\\bar{y} - t_{fb}', sub: up ? `(${n3(r.d)} - ${n3(r.topT)}) - ${n3(s.yb)}` : `${n3(s.yb)} - ${n3(r.botT)}`, value: r.DcC, unit: 'in', d: 3, ref: `${ED} App. D6.3.1` });
    w.add({ id: 'Rh', label: 'Hybrid factor, steel section', sym: 'R_{h}', eq: '', sub: '', value: r.RhC, unit: '', d: 3, ref: `${ED} Art. 6.10.1.10.1` });
    w.add({ id: 'Cb', label: lt.npr && lt.npr.kind === 'ge' ? 'Moment gradient modifier: nonprismatic unbraced length' : 'Moment gradient modifier for deck placement (from the deck-placement moments of the unbraced length)', sym: 'C_{b}', eq: lt.npr && lt.npr.kind === 'ge' ? '1.0' : '', sub: '', value: r.CbCu, unit: '', d: 3, ref: lt.npr && lt.npr.kind === 'ge' ? `${ED} Eq. 6.10.8.2.3c-1` : `${ED} Eq. 6.10.8.2.3b-1`, note: `L_b = ${n2(r.LbC)} ft (deck-placement unbraced length).` });
    w.add({ id: 'Fyr', label: 'Compression-flange stress at the onset of nominal yielding', sym: 'F_{yr}', eq: '\\max(\\min(0.7F_{yc}, F_{yw}), 0.5F_{yc})', sub: `\\max(\\min(0.7(${n2(cF.Fy)}), ${n2(r.mat.Fyw)}), 0.5(${n2(cF.Fy)}))`, value: lt.Fyr, unit: 'ksi', d: 2, ref: `${ED} Art. 6.10.8.2.2` });
    w.add({ id: 'FLB', label: `Flange local buckling (λ_f = b_fc/2t_fc = ${n2(lt.lf)}, λ_pf = ${n2(lt.lpf)}, λ_rf = ${n2(lt.lrf)})`, sym: 'F_{nc,FLB}', eq: lt.lf <= lt.lpf ? 'R_{b}R_{h}F_{yc}' : '\\left[1 - \\left(1 - \\frac{F_{yr}}{R_{h}F_{yc}}\\right)\\frac{\\lambda_{f} - \\lambda_{pf}}{\\lambda_{rf} - \\lambda_{pf}}\\right]R_{b}R_{h}F_{yc}',
      sub: lt.lf <= lt.lpf ? `1.0(${n3(r.RhC)})(${n2(cF.Fy)})` : `\\left[1 - \\left(1 - \\frac{${n2(lt.Fyr)}}{${n3(r.RhC)}(${n2(cF.Fy)})}\\right)\\frac{${n2(lt.lf)} - ${n2(lt.lpf)}}{${n2(lt.lrf)} - ${n2(lt.lpf)}}\\right](1.0)(${n3(r.RhC)})(${n2(cF.Fy)})`, value: lt.FLB, unit: 'ksi', d: 3, ref: `${ED} Eqs. 6.10.8.2.2-1, -2`, note: 'R_b = 1.0 for deck placement (6.10.3.2.1).' });
    if (lt.npr && lt.npr.kind === 'ge') { const q = lt.npr;
      if (q.gv) w.add({ id: 'gov', label: `Governing section of the nonprismatic unbraced length${q.gv.x != null ? ` (x = ${n2(q.gv.x)} ft)` : ''}`, sym: 'f_{bu,gov}', eq: '\\frac{|M_{c}|(12)}{S}', sub: `M_{c} = ${n2(q.gv.gdc)}${pa(q.gv.MD)} + ${n2(q.gv.gcl)}${pa(q.gv.MCL)} = ${n2(q.gv.Mc)};\\ \\frac{${n2(Math.abs(q.gv.Mc))}(12)}{${g0(q.gv.S)}}`, value: q.gv.f, unit: 'ksi', d: 3, ref: `${ED} Art. 6.10.8.2.3c`, note: `R_h of that section ${n3(q.gv.Rh)}; R_b = 1.0.` });
      w.add({ id: 'ge', label: q.A ? 'γ_e by App. D6.6.2 Method A (Preliminary sizing)' : 'γ_e, conservative bound', sym: '\\gamma_{e}', eq: q.A ? '\\frac{\\chi C_{be}}{(M_{u}/M_{e1})_{max}}' : '\\frac{F_{e,s}}{Kf_{s}}', sub: q.A ? `\\frac{${n4(+q.A.chi)}(${n3(+q.A.Cbe)})}{${n4(+q.A.rm)}}` : `\\frac{${n2(q.FeS)}}{${n3(q.K)}(${n2(q.fS)})}`, value: q.ge, unit: '', d: 4, ref: q.A ? `${ED} Eq. D6.6.2-1` : `${ED} Art. 6.10.8.2.3c`, note: q.bw ? 'Outside the D6.6.2.2 step limit: ' + q.bw : '' });
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
    w.add({ id: 'Vu', label: 'Deck placement factored shear', sym: 'V_{u}', eq: '\\gamma_{DC}V_{DC1} + \\gamma_{CL}V_{CL}', sub: `${n2(G.cdc)}(${n2(r.VDC1)}) + ${n2(G.ccl)}(${n2(r.VCL)})`, value: r.VuC, unit: 'kip', d: 2, ref: tbl, note: 'V_DC1: steel and the whole wet deck (GirderDetail GS16).' });
    const ws = St().work('cn.sh'); SH().panelSteps(ws, 'p', r.sh, { D: r.D, tw: r.tw, Fyw: r.mat.Fyw, doIn: r.do, end: r.end, flgA: r.flgA }); w.take(ws.steps.filter(z => !/\.(rat|Vn)$/.test(z.id)));
    q = dem('shear'); w.add({ id: 'sh.ok', label: 'GS16, web shear during deck placement (no tension-field action)', sym: 'V_{u}', eq: '\\le \\phi_{v}V_{cr} = \\phi_{v}CV_{p}', sub: `${n2(q.demand)} \\le 1.0(${n4(r.sh.C)})(${n2(r.sh.Vp)}) = ${n2(q.capacity)}`, value: okv(q.demand, q.capacity), unit: '', ref: `${ED} Eq. 6.10.3.3-1`, ok: q.ok, note: `Ratio ${n3(q.ratio)}.` });
    return w.steps;
  }

  /* ---------- unbraced length for deck placement (Preliminary sizing gsRow, CB1 / CB2 / SKX / NPG) ---------- */
  /* bracingC(x, env, opt): L_b,C, C_b,C and nprC of the location at x, from the deck-placement moment M_c = 1.25M_DC1 + 1.5M_CL
     (Preliminary sizing's T.Mc) of the unbraced segment(s) containing x, for the flange M_c compresses there (steel section).
     env = { xs, MDC1, MCL, MDCc (optional) } at the analysis stations; opt = { braces (ft: bearings and cross-frames), L (girder length),
     secAt(x) -> plates, D, impl (optional fe* functions, for the parity test) }. Returns { LbC, CbC, nprC, seg }. */
  function bracingC(x, env, opt) {
    const F = FX(), I = opt.impl || {}, feCb_ = I.feCb || F.feCb, feNpr_ = I.feNpr || F.feNpr, feGe_ = I.feGe || F.feGe, feGeA_ = I.feGeA || F.feGeA, feGov_ = I.feGov || F.feGov, feAt_ = I.feAt || F.feAt;
    const xs = env.xs, N = xs.length, Lend = opt.L, C0 = factors(), Mc = env.Mc || xs.map((_, k) => C0.cdc * env.MDC1[k] + C0.ccl * env.MCL[k]);   // FONE (2026-11-01): γ from factors(), was 1.25, 1.5
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
    const cC = segs.map(([p0, p1]) => { const L = p1 - p0, n2_ = feNpr_(p0, p1, secAt, q => sgC * feAt_(xs, Mc, q)); return { p0, p1, L, n2: n2_, Cb: n2_.kind === 'ge' ? 1 : feCb_(xs, Mc, p0, p1, sgC), ge: n2_.kind === 'ge' ? geSeg(n2_, p0, p1, L * 12, rtC, fCon) : null }; })
      .sort((u, v) => byGe(u, v) ?? v.L / v.Cb - u.L / u.Cb)[0], CbC = cC ? cC.Cb : 1, LbCN = cC ? cC.L : opt.sp;
    const geRec = A => !A ? '' : A.ok ? { m: 'A', ge: +A.g.toFixed(4), Cbe: r3(A.Cbe), chi: +A.chi.toFixed(4), dS: r3(A.dS), rm: +A.rm.toFixed(4), rA: +A.rA.toFixed(4), rB: +A.rB.toFixed(4), rC: +A.rC.toFixed(4), sA: A.sA ? 1 : 0, sB: A.sB ? 1 : 0, sC: A.sC ? 1 : 0, xm: r2(A.xm), Fe1: r2(A.Fe1), fm: r2(A.fm), Imx: r3(A.Imx) } : { m: 'bound', why: A.why, Imx: r3(A.Imx) };
    const govRec = gv => { if (!gv) return ''; const at = A => A[gv.i] * (1 - gv.t) + A[gv.i + 1] * gv.t, o = { x: r2(gv.x), topB: gv.s.topB, topT: gv.s.topT, botB: gv.s.botB, botT: gv.s.botT, tw: gv.s.tw };
      [['MDC1', 'MDC1'], ['MCL', 'MCL'], ['MDCc', 'MDCc']].forEach(([k, a]) => { if (env[a]) o[k] = r1(at(env[a])); }); return o; };
    let nprC = ''; if (cC && cC.n2.kind === 'simp') nprC = { kind: 'simp', fl: sgC > 0 ? 'top' : 'bottom', b: cC.n2.big[kb], t: cC.n2.big[kt], Ir: r3(cC.n2.Ir) };
    else if (cC && cC.n2.kind === 'ge') { const { A, mA, G } = cC.ge, fr = G ? fCon(G.s, i) : 0;
      nprC = { kind: 'ge', fl: sgC > 0 ? 'top' : 'bottom', b: G ? G.s[kb] : s[kb], t: G ? G.s[kt] : s[kt], k: G && fr > 0 && !mA ? r3(Math.max(1, G.fm / fr)) : '', Ir: r3(cC.n2.Ir), why: cC.n2.why, A: geRec(A),
        ...(G ? { G: govRec(feGov_(cC.n2.pcs, xs, () => 1, fCon)) } : {}) }; }
    return { LbC: r2(LbCN), CbC: +CbC.toFixed(3), nprC, seg: cC ? { xa: cC.p0, xb: cC.p1 } : null };
  }

  /* ---------- deck overhang brackets, exterior girder (GirderDetail GM.oh) ---------- */
  /* GirderDetail's Deck overhang module inputs (GM.oh.def): bracket a, h_b (in); deck width carried wOH (in), overhang thickness tOH (in),
     w_c (kcf), forms qForm (ksf), screed rail, railing, walkway (klf), construction LL qCL (ksf) over bCL (in), finishing machine Pfm (kip
     per bracket); R_h, C_b of the module; γ_DC, γ construction. */
  const OH_DEF = { Rh: 1.0, Cb: 1.0, gam: { dc: 1.25, cl: 1.50 }, a: 36, hb: 54, wOH: 30, tOH: 9, wc: 0.150, qForm: 0.010, wScreed: 0.085, wRail: 0.025, wWalk: 0.125, qCL: 0.020, bCL: 30, Pfm: 3.0 };
  /* ohFill(project, gi): "Fill from cross-section" (GirderDetail XS11, SB2-C2; a button with a confirmation, never automatic): the bracket
     deck geometry from the Cross-section & loads inputs. Deck width carried by the brackets w_OH = 12·overhang − b_tf/2 (in, to 0.01; the
     overhang from the exterior girder centerline to the deck edge, the side with the larger overhang, left when equal; b_tf the narrowest
     top flange of this girder: the widest deck strip outside the flange), overhang deck thickness t_OH = the total deck thickness
     (deck.tdeck: the structural slab plus the integral wearing surface, all placed on the brackets; GirderDetail takes t_s, its bridge
     data having no wearing thickness), w_c = the deck concrete unit weight. Returns { vals: { wOH, tOH, wc }, sd, oh, bf, why, steps } or { err }. */
  function ohFill(P, gi) {
    const xs = P.xs, g = P.girders[gi], d = P.deck || {}, c = (P.materials || {}).concrete || {};
    if (!xs || !(xs.ohL >= 0) || !(xs.ohR >= 0)) return { err: 'No cross-section: enter the overhangs on the Cross-section & loads tab.' };
    if (!g || !g.segments || !g.segments.length) return { err: 'No girder plates.' };
    const sd = +xs.ohR > +xs.ohL + 1e-9 ? 'R' : 'L', oh = sd === 'L' ? +xs.ohL : +xs.ohR, bf = Math.min(...g.segments.map(s => +s.topB));
    const raw = Math.max(oh * 12 - bf / 2, 0), wOH = Math.round(raw * 100) / 100, tOH = +d.tdeck > 0 ? +d.tdeck : +d.ts, wc = +c.wc;
    const w = St().work('oh.fill'), side = sd === 'L' ? 'left' : 'right';
    w.add({ id: 'wOH', label: `Deck width carried by the brackets (${side} overhang ${n2(oh)} ft, narrowest top flange ${n2(bf)} in)`, sym: 'w_{OH}', eq: '12\\,OH - \\frac{b_{tf}}{2}', sub: `12(${n2(oh)}) - \\frac{${n2(bf)}}{2}`, value: wOH, unit: 'in', d: 2,
      ref: 'C6.10.3.4', note: 'Overhang: exterior girder centerline to the deck edge (Cross-section & loads tab), the larger side. Rounded to 0.01 in.' });
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
    const Fyf = mat.Fyf, Fyw = mat.Fyw, Rh = +q.Rh, Cb = +q.Cb, gd = B.gd, gc = B.gc, Fl = B.Fl, Pl = B.Pl;
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
    const R = { ...B, errors: [], rows: out, Rh, Cb, Fyf, Fyw };
    out.forEach(r => Object.defineProperty(r, 'steps', { enumerable: false, configurable: true, get() { const st = ohWorked(R, r); Object.defineProperty(r, 'steps', { value: st, enumerable: false }); return st; } }));
    return R;
  }
  function ohWorked(R, r) {
    const w = St().work('oh'), L = R.L, c = r.c, tf = r.tf, s = r.s, ref = `${ED} Art. C6.10.3.4`;
    if (!R.given) {
      w.add({ id: 'wu', label: 'Factored load on the overhang brackets (deck × γ_DC; forms, screed rail, railing, walkway and construction LL × γ construction)', sym: 'w_{u}', eq: '\\gamma_{DC}w_{deck} + \\gamma_{CL}(w_{form} + w_{screed} + w_{rail} + w_{walk} + w_{CLL})',
        sub: `${n2(R.gd)}(${n4(L.deck)}) + ${n2(R.gc)}(${n4(L.form)} + ${n4(L.screed)} + ${n4(L.rail)} + ${n4(L.walk)} + ${n4(L.cll)})`, value: R.wu, unit: 'kip/ft', d: 4, ref: `${ED} Art. 3.4.2.1`,
        note: `w_deck = w_c t_OH b_OH = ${n3(R.p.wc)}(${n2(R.p.tOH)}/12)(${n2(R.p.wOH)}/12); w_form = q_form b_OH; w_CLL = q_CL b_CL = ${n3(R.p.qCL)}(${n2(R.p.bCL)}/12).` });
      w.add({ id: 'Fl', label: 'Horizontal flange force from the brackets, distributed', sym: 'F_{\\ell}', eq: 'w_{u}\\frac{a}{h_{b}}', sub: `${n4(R.wu)}\\frac{${n2(R.p.a)}}{${n2(R.p.hb)}}`, value: R.Fl, unit: 'kip/ft', d: 4, ref });
      w.add({ id: 'Pl', label: 'Horizontal flange force from the finishing machine', sym: 'P_{\\ell}', eq: '\\gamma_{CL}P_{fm}\\frac{a}{h_{b}}', sub: `${n2(R.gc)}(${n2(R.p.Pfm)})\\frac{${n2(R.p.a)}}{${n2(R.p.hb)}}`, value: R.Pl, unit: 'kip', d: 4, ref });
    } else {
      w.add({ id: 'Fl', label: 'Horizontal flange force from the brackets, distributed (as given)', sym: 'F_{\\ell}', eq: '', sub: '', value: R.Fl, unit: 'kip/ft', d: 4, ref });
      w.add({ id: 'Pl', label: 'Horizontal flange force from the finishing machine (as given)', sym: 'P_{\\ell}', eq: '', sub: '', value: R.Pl, unit: 'kip', d: 4, ref });
    }
    w.add({ id: 'Mu', label: 'Vertical bending, steel section', sym: 'M_{u}', eq: '\\gamma_{DC}M_{DC1} + \\gamma_{CL}M_{CL}', sub: `${n2(R.gd)}${pa(r.MDC1)} + ${n2(R.gc)}${pa(r.MCL)}`, value: r.Mu, unit: 'kip-ft', d: 1, ref: `${ED} Art. 3.4.2.1`, note: 'M_DC1 with the whole deck cast at once (GirderDetail Deck overhang module).' });
    w.add({ id: 'fbu', label: `Compression flange: the ${c.lab} flange (extreme fiber)`, sym: 'f_{bu}', eq: '\\frac{|M_{u}|(12)c}{I}', sub: `\\frac{${n2(Math.abs(r.Mu))}(12)(${n3(c.lab === 'top' ? s.d - s.yb : s.yb)})}{${g0(s.I)}}`, value: r.fbu, unit: 'ksi', d: 3, ref: `${ED} Art. 6.10.1.1.1a` });
    w.add({ id: 'Ml', label: 'Flange lateral bending moment (bracing at the cross-frames; distributed load plus the finishing machine at midpoint)', sym: 'M_{\\ell}', eq: '\\frac{F_{\\ell}L_{b}^{2}}{12}(12) + \\frac{P_{\\ell}L_{b}}{8}', sub: `\\frac{${n4(R.Fl)}(${n2(r.Lb)})^{2}}{12}(12) + \\frac{${n4(R.Pl)}(${n2(r.LbIn)})}{8}`, value: r.Ml, unit: 'kip-in', d: 2, ref });
    [c, tf].forEach(f => w.add({ id: 'fl1.' + f.lab, label: `First-order lateral bending stress, ${f.lab} flange`, sym: `f_{\\ell1,${f.lab}}`, eq: '\\frac{M_{\\ell}}{t_{f}b_{f}^{2}/6}', sub: `\\frac{${n2(r.Ml)}}{${n3(f.t)}(${n2(f.b)})^{2}/6}`, value: f.fl1, unit: 'ksi', d: 3, ref: `${ED} Art. C6.10.1.6` }));
    w.add({ id: 'Dc', label: 'Depth of the web in compression, steel section', sym: 'D_{c}', eq: '', sub: '', value: r.Dc, unit: 'in', d: 3, ref: `${ED} App. D6.3.1` });
    w.add({ id: 'rt', label: 'Effective radius of gyration for LTB', sym: 'r_{t}', eq: '\\frac{b_{fc}}{\\sqrt{12\\left(1 + \\frac{D_{c}t_{w}}{3b_{fc}t_{fc}}\\right)}}', sub: `\\frac{${n2(c.b)}}{\\sqrt{12\\left(1 + \\frac{${n3(r.Dc)}(${n4(r.tw)})}{3(${n2(c.b)})(${n3(c.t)})}\\right)}}`, value: r.rt, unit: 'in', d: 4, ref: `${ED} Eq. 6.10.8.2.3-9` });
    w.add({ id: 'FLB', label: `Flange local buckling (λ_f = ${n2(r.lf)}, λ_pf = ${n2(r.lpf)}, λ_rf = ${n2(r.lrf)}; F_yr = ${n2(r.Fyr)} ksi)`, sym: 'F_{nc,FLB}', eq: '', sub: '', value: r.FncF, unit: 'ksi', d: 3, ref: `${ED} Eqs. 6.10.8.2.2-1, -2`, note: 'R_b = 1.0 (6.10.3.2.1).' });
    w.add({ id: 'LTB', label: `Lateral-torsional buckling (L_p = ${n2(r.Lp)} in, L_r = ${n2(r.Lr)} in, L_b = ${n2(r.LbIn)} in, C_b = ${n2(R.Cb)})`, sym: 'F_{nc,LTB}', eq: '', sub: '', value: r.FncL, unit: 'ksi', d: 3, ref: `${ED} Eqs. 6.10.8.2.3-1, -2, -3` });
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
    rows.forEach(r => { const sp = spOf(r.x), cf = r.conC.lab === 'top' ? 'top' : 'bot';
      r.checks.forEach(c => { const o = { ratio: c.ratio, row: r, check: c };
        if (c.id === 'GS16') put(sp, 'shear', o); else if (c.key === 'tension') put(sp, 'tens', o); else put(sp, cf, o); }); });
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
    const mat = { Fyt: +m.Fyf || 50, Fyb: +m.Fyf || 50, Fyw: +m.Fyw || 50 }, prj = { mat, G: factors(opt.G) };
    const at = A => x => FX().feAt(xs, A, x), D = Math.max(...zones.map(z => z.web.depth));
    const locs = list.map(x => { const br = bracingC(x, env, { braces, L: Lend, secAt: zAt, D: zAt(x).D, impl: opt.impl, sp: Lb }), v = dem.at(x);
      return { name: `x = ${x.toFixed(2)} ft`, x, plates: zAt(x), M: { DC1: at(env.MDC1)(x), DCc: hasDCc ? at(env.MDCc)(x) : 0, CL: at(env.MCL)(x) }, V: { DC1: v.DC1, CL: v.CL },
        LbC: br.LbC, CbC: br.CbC, Cb: 1, nprC: br.nprC, seg: br.seg, flC: opt.flC || 0, do: doIn, end: doIn > 0 && ends.some(s => Math.abs(x - s) <= doFt + 1e-6) }; });
    const ext = g.position === 'exterior', st = ((g.checks || {}).constr || {}).oh;
    const ohP = opt.oh || (st && st.inputs ? { Rh: st.inputs.Rh, Cb: st.inputs.Cb, gam: { dc: st.inputs.gDC, cl: st.inputs.gCL }, a: st.inputs.a, hb: st.inputs.hb, loads: { wu: st.inputs.wu, Fl: st.inputs.Fl, Pl: st.inputs.Pl } } : {});
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
    const mat = { Fyt: Fy('top'), Fyb: Fy('bot'), Fyw: Fy('web') }, prj = { mat, G: factors(opt.G) };
    const xs = AR.x, sup = AR.sup, Lend = AR.Lt, segs = g.segments;
    const zAt = x => { const s = segs.find(q => x >= q.x0 - 1e-9 && x < q.x1) || segs[segs.length - 1]; return plates(s); };
    const chg = segs.slice(0, -1).map(s => s.x1).filter(x => { const a = zAt(x - 0.01), b = zAt(x + 0.01); return ['D', 'tw', 'topB', 'topT', 'botB', 'botT'].some(k => a[k] !== b[k]); });
    const list = stationList(xs, sup, chg, Lend);
    const st = AR.st, MDCc = AR.seq ? AR.seq.MDCc : null;
    const env = { xs, MDC1: st.DC1.M, MCL: st.CL.M, ...(MDCc ? { MDCc } : {}) };
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
    const locs = list.map(x => { const br = bracingC(x, env, { braces, L: Lend, secAt: zAt, D: zAt(x).D, sp: Lb }), pn = panelAt(x);
      return { name: `x = ${x.toFixed(2)} ft`, x, plates: zAt(x), M: { DC1: at(env.MDC1)(x), DCc: MDCc ? at(MDCc)(x) : 0, CL: at(env.MCL)(x) }, V: { DC1: vAt(st.DC1, x), CL: vAt(st.CL, x) },
        LbC: br.LbC, CbC: br.CbC, Cb: 1, nprC: br.nprC, seg: br.seg, flC: opt.flC || 0, do: pn ? pn.d : 0, end: pn ? pn.end : false }; });
    const ext = g.position === 'exterior';
    const oh = ext ? { rows: ohRowsAt(sup, env, locs), p: opt.oh || (P.constr && P.constr.oh) || {}, mat: { Fyf: Math.min(mat.Fyt, mat.Fyb), Fyw: mat.Fyw } } : null;
    return { prj, locs, env, supports: sup, braces, oh, ext, Lb, D, seq: !!MDCc };
  }

  window.SBDConstr = { ES, OH_DEF, ohFill, factors, gsGovC, location, bracingC, ohLoads, overhang, girder, ohRowsAt, stationList, fromPayload, fromAnalysis };
})();
