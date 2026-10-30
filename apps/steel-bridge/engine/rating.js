/* apps/steel-bridge/engine/rating.js — load rating of a steel I-girder by LRFR, the HL-93 design-load rating (window.SBDRating).
   Classic script, no DOM. Needs window.SharedSteps (shared/steps.js); the capacities come from engine/flexure.js and engine/shear.js
   results (SBDFlexure.location, SBDShear.location), so it needs SBDFlexure for F_crw (Service II web).

   Created 2026-10-29 (docs/REBUILD_PLAN.md §5, "Load rating"), from two references:
     - ST-Girder ("Steel Bridge Design.html", st-src block, computeAll "Load rating (LRFR, MBE) — station-based", and RatingTab): the
       method. RF = (C − γ_DC DC − γ_DW DW ± γ_P P)/(γ_LL (LL + IM)) (MBE Eq. 6A.4.2.1-1), C = φ_c φ_s φ R_n (Eq. 6A.4.2.1-2) with
       φ_c φ_s ≥ 0.85 (Eq. 6A.4.2.1-3) at the Strength limit state; design-load rating on HL-93, Strength I Inventory γ_LL = 1.75 and
       Operating 1.35, γ_DC = 1.25, γ_DW = 1.50 (Table 6A.4.2.2-1); flexure on a moment basis for a compact composite section in positive
       flexure, else on a stress basis per flange; shear; Service II (6A.6.4.2.2): RF = (f_R − γ_D f_D)/(γ_LL f_LL), f_R = 0.95 R_h F_yf
       (composite; 0.80 R_h F_yf noncomposite), γ_D = 1.0, γ_LL = 1.30 Inventory, 1.00 Operating. Every station, the lowest RF governs.
       The utilities (MassDOT; GD54c, ST-Girder's default): the future allowance with DC, the existing with DW, where they add (no relief).
       No legal or permit loads (ST-Girder has none).
     - GirderDetail's GS20 (OWN9): the owner's design rating target (inventory RF; and the fatigue RF = 1/ratio of GS17), reported only.
   The capacities are this app's unified 10th Ed. modules, as the engineer decided on 2026-10-29 (GirderDetail's methods are the truth):
   M_n, F_nc (6.10.8 with R_b, c_rw), App. A6 where it is the method in use (moment basis, M_nc and R_pt M_yt), V_n with the tension field
   (6.10.9), F_crw (Service II web, 6.10.4.2.2-4). Where a capacity depends on the load (F_crw through D_c), RF is the load factor at which
   the check reaches its limit (found by bisection), as GS20's quadratic does.
   The flange lateral bending f_ℓ of the design check is kept in the rating as a constant (the design check's value): M_u + f_ℓS_x/3,
   f_bu + f_ℓ/3, and f_f + f_ℓ/2 at Service II.

   Code: AASHTO Manual for Bridge Evaluation (MBE), Section 6A. ST-Girder does not state the MBE edition; this engine cites the 3rd Ed.
   (2018), whose article and equation numbers used here (6A.4.2.1, Tables 6A.4.2.2-1, 6A.4.2.3-1, 6A.4.2.4-1, 6A.6.4.2.2) are those of
   the 2nd Ed. too. Resistances: AASHTO LRFD 10th Ed. (2024). φ_f = φ_v = 1.0 (6.5.4.2).
   Units: moments kip-ft, shears kip, stresses ksi (the stress of each component positive when it acts as the live load does). */
(function () {
  'use strict';
  const MBE = 'AASHTO MBE 3rd Ed.', ED = 'AASHTO LRFD 10th Ed.';
  const St = () => window.SharedSteps;
  const n2 = x => St().n(x, 2), n3 = x => St().n(x, 3), g1 = x => St().g(x, 1);
  const NONE = Infinity;   // no live-load effect: no rating (shown as —)

  /* factors(over): MBE Table 6A.4.2.2-1, design-load rating. Strength I: γ_DC 1.25, γ_DW 1.50, γ_P 1.00, γ_LL 1.75 Inventory /
     1.35 Operating; Service II: γ_D 1.00, γ_LL 1.30 Inventory / 1.00 Operating. */
  function factors(over) { return { dc: 1.25, dw: 1.50, p: 1.00, inv: 1.75, opr: 1.35, sd: 1.00, sInv: 1.30, sOpr: 1.00, ...(over || {}) }; }
  /* phi(phiC, phiS): the condition factor φ_c (Table 6A.4.2.3-1) and system factor φ_s (Table 6A.4.2.4-1), 1.0 when not given;
     v = max(φ_c φ_s, 0.85) (Eq. 6A.4.2.1-3), applied to the Strength capacities (flexure and shear, as ST-Girder). */
  function phi(phiC, phiS) { const c = +phiC > 0 ? +phiC : 1, s = +phiS > 0 ? +phiS : 1, prod = c * s; return { phiC: c, phiS: s, prod, v: Math.max(prod, 0.85), floor: prod < 0.85 }; }

  /* rf(o): MBE Eq. 6A.4.2.1-1, RF = (C − γ_DC DC − γ_DW DW − γ_P P − F)/(γ_LL LL). o = { C, DC, DW, P (signed: + adds to the live-load
     effect), F (a constant demand already factored: the f_ℓ term), LL, gLL, gDC, gDW, gP }. No live-load effect (LL ≤ 1e-6): Infinity. */
  function rf(o) {
    const LL = +o.LL || 0; if (!(LL > 1e-6)) return NONE;
    const gDC = o.gDC != null ? o.gDC : 1.25, gDW = o.gDW != null ? o.gDW : 1.50, gP = o.gP != null ? o.gP : 1.00;
    return (o.C - gDC * (+o.DC || 0) - gDW * (+o.DW || 0) - gP * (+o.P || 0) - (+o.F || 0)) / (o.gLL * LL);
  }
  /* kAt(f, hi): the smallest k in [0, hi] where f(k) ≥ 0 (f increasing), by bisection to 1e-10; 0 when f(0) ≥ 0, hi when never */
  function kAt(f, hi) { if (f(0) >= 0) return 0; if (f(hi) < 0) return hi; let a = 0, b = hi; for (let i = 0; i < 80 && b - a > 1e-10; i++) { const m = (a + b) / 2; if (f(m) >= 0) b = m; else a = m; } return (a + b) / 2; }

  /* ---------- one rating ---------- */
  /* make(q, F, ph): q = { key, kind, lim ('Strength I' | 'Service II'), name, x, title, basis ('M' | 'f' | 'V'), unit, Rn, phiR (φ_f or φ_v),
     useCS (φ_c φ_s applies), RnSym, RnRef, RnStep, DC, DW, LL, F, Fnote, DCsym, DWsym, LLsym, parts, ref, quad (optional: k → margin,
     the load-dependent check) }. Adds C, inv, opr and the worked steps (lazy). */
  function make(q, G, ph) {
    const sv = q.lim === 'Service II', cs = q.useCS ? ph.v : 1;
    q.cs = cs; q.C = cs * q.phiR * q.Rn;
    const g = sv ? { dc: G.sd, dw: G.sd, inv: G.sInv, opr: G.sOpr } : { dc: G.dc, dw: G.dw, inv: G.inv, opr: G.opr };
    q.g = g;
    const one = gLL => q.quad ? (q.LL > 1e-6 ? kAt(k => q.quad(k * gLL), 100) : NONE) : rf({ C: q.C, DC: q.DC, DW: q.DW, F: q.F, LL: q.LL, gLL, gDC: g.dc, gDW: g.dw });
    q.inv = one(g.inv); q.opr = one(g.opr);
    Object.defineProperty(q, 'steps', { enumerable: false, configurable: true, get() { const s = worked(q, ph); Object.defineProperty(q, 'steps', { value: s, enumerable: false }); return s; } });
    return q;
  }
  function worked(q, ph) {
    const w = St().work('rt'), sv = q.lim === 'Service II', u = q.unit, d = u === 'ksi' ? 3 : 1, nf = u === 'ksi' ? n3 : g1, g = q.g;
    if (!sv && q.useCS) {
      w.add({ id: 'phiCS', label: 'Condition and system factors (Strength)', sym: '\\phi_{c}\\phi_{s}', eq: '\\max(\\phi_{c}\\phi_{s}, 0.85)', sub: `\\max(${n2(ph.phiC)}(${n2(ph.phiS)}), 0.85)`, value: ph.v, unit: '', d: 3,
        ref: `${MBE} Eq. 6A.4.2.1-3; Tables 6A.4.2.3-1, 6A.4.2.4-1`, note: ph.floor ? 'φ_cφ_s below 0.85: 0.85 is used (Eq. 6A.4.2.1-3).' : '' });
    }
    w.add({ id: 'Rn', label: q.RnLabel, sym: q.RnSym, eq: '', sub: '', value: q.Rn, unit: u, d, ref: q.RnRef, note: q.RnStep ? `Worked in the ${q.RnTab} steps below: see §${q.RnStep}.` : '' });
    w.add({ id: 'C', label: sv ? 'Service II limit stress' : 'Capacity', sym: sv ? 'f_{R}' : 'C', eq: sv ? q.RnSym : q.useCS ? `\\phi_{c}\\phi_{s}\\phi R_{n}` : '\\phi R_{n}',
      sub: sv ? nf(q.Rn) : q.useCS ? `${n3(q.cs)}(${n2(q.phiR)})(${nf(q.Rn)})` : `${n2(q.phiR)}(${nf(q.Rn)})`, value: q.C, unit: u, d, ref: sv ? `${MBE} Art. 6A.6.4.2.2; ${ED} Art. 6.10.4.2.2` : `${MBE} Eq. 6A.4.2.1-2` });
    (q.parts || []).forEach(p => w.add({ ...p, unit: p.unit != null ? p.unit : u, d: p.d != null ? p.d : d }));
    w.add({ id: 'DC', label: 'Dead load DC (components and attachments)', sym: q.DCsym || 'DC', eq: q.DCeq || '', sub: q.DCsub || '', value: q.DC, unit: u, d, note: q.DCnote || '' });
    w.add({ id: 'DW', label: 'Dead load DW (wearing surface and utilities)', sym: q.DWsym || 'DW', eq: q.DWeq || '', sub: q.DWsub || '', value: q.DW, unit: u, d, note: q.DWnote || '' });
    w.add({ id: 'LL', label: 'HL-93 live load with dynamic load allowance, per girder', sym: q.LLsym || '(LL + IM)', eq: '', sub: '', value: q.LL, unit: u, d, note: q.LLnote || '' });
    if (q.F) w.add({ id: 'F', label: 'Flange lateral bending term (constant, the design check\'s value)', sym: q.Fsym, eq: q.Feq || '', sub: q.Fsub || '', value: q.F, unit: u, d, note: q.Fnote || '' });
    const Ft = q.F ? ` - ${q.Fsym}` : '', Fs = q.F ? ` - ${nf(q.F)}` : '';
    [['inv', 'Inventory', g.inv], ['opr', 'Operating', g.opr]].forEach(([k, lab, gl]) => {
      if (q.quad) {
        w.add({ id: k, label: `${lab} rating factor, ${q.lim} (the capacity depends on the load: the load factor at which the check reaches its limit)`, sym: `RF_{${k === 'inv' ? 'inv' : 'op'}}`,
          eq: q.quadEq, sub: q.quadSub ? q.quadSub(q[k] * gl, gl) : '', value: isFinite(q[k]) ? q[k] : 'no live-load effect', unit: '', d: 3, ref: `${MBE} Eq. 6A.4.2.1-1, Table 6A.4.2.2-1${sv ? ', Art. 6A.6.4.2.2' : ''}` });
        return;
      }
      w.add({ id: k, label: `${lab} rating factor, ${q.lim}`, sym: `RF_{${k === 'inv' ? 'inv' : 'op'}}`,
        eq: `\\frac{${sv ? 'f_{R}' : 'C'} - \\gamma_{${sv ? 'D' : 'DC'}}${q.DCsym || 'DC'} - \\gamma_{${sv ? 'D' : 'DW'}}${q.DWsym || 'DW'}${Ft}}{\\gamma_{LL}${q.LLsym || '(LL + IM)'}}`,
        sub: q.LL > 1e-6 ? `\\frac{${nf(q.C)} - ${n2(g.dc)}(${nf(q.DC)}) - ${n2(g.dw)}(${nf(q.DW)})${Fs}}{${n2(gl)}(${nf(q.LL)})}` : '',
        value: isFinite(q[k]) ? q[k] : 'no live-load effect', unit: '', d: 3, ref: `${MBE} Eq. 6A.4.2.1-1, Table 6A.4.2.2-1${sv ? ', Art. 6A.6.4.2.2 (Eq. 6A.6.4.2.2-1)' : ''}` });
    });
    return w.steps;
  }

  /* where it adds (GD54c): a utility effect counts only when it acts as the live load does (no relief) */
  const adds = v => Math.max(+v || 0, 0);
  /* flA(am): the amplified f_ℓ of the design check (SBDFlexure.ampFl). With f_ℓ = 0 it is 0 even where f_bu ≥ F_cr (the amplification
     0 × ∞ is NaN there); with f_ℓ > 0 and f_bu ≥ F_cr the amplification is unbounded (Infinity: the RF is −∞, shown). */
  const flA = am => !am ? 0 : isFinite(am.fl) ? am.fl : (am.AF === Infinity && !(am.fl > 0) && !(am.fl < 0)) ? 0 : Infinity;

  /* ---------- flexure, Strength I ---------- */
  /* flexure(r, opt): r = SBDFlexure.location result (unfactored demands: r.factored false); opt = { G: factors(), phi: phi() }.
     Returns the rating rows of this location (empty when r is out of scope or factored). Moment basis (compact composite positive
     flexure: M_n; App. A6 in use: M_nc, R_pt M_yt): DC = s(M_DC1 + M_DC2) + UF where it adds, DW = s M_DW + UT where it adds, LL = |M_LL|
     (s = +1 positive, −1 negative flexure). Stress basis (noncompact positive: F_nc = R_bR_hF_yc and R_hF_yt; 6.10.8: F_nc and F_nt
     = R_hF_yt): each flange's stresses by stage, positive when acting as the live load does. */
  function flexure(r, opt) {
    const G = factors(opt && opt.G), ph = (opt && opt.phi) || phi(), out = [];
    if (r.factored) return out;
    const gs6 = (r.checks || []).find(c => c.id === 'GS6');
    if (r.p7 && (r.below || (gs6 && !gs6.inUse && /Out of scope/.test(gs6.na || '')))) return [{ key: 'oos', kind: 'flex', name: r.name, x: r.x, oos: true, inv: NaN, opr: NaN, lim: 'Strength I',
      title: 'Positive flexure: out of scope (PNA below the web, Table D6.1-1)' }];
    const s = r.pos ? 1 : -1, reg = r.pos ? 'positive' : 'negative', base = { name: r.name, x: r.x, region: r.region, lim: 'Strength I', useCS: true, phiR: 1.0 };
    const M = (a, b) => s * ((r[a] || 0) + (b ? r[b] || 0 : 0));
    const mDC = M('MDC1', 'MDC2') + adds(s * r.MUF), mDW = M('MDW') + adds(s * r.MUT), mLL = Math.abs(r.MLL);
    const ut = r.ut ? ' + M_{UF}' : '', utW = r.ut ? ' + M_{UT}' : '';
    const mParts = { DC: mDC, DW: mDW, LL: mLL, unit: 'kip-ft', basis: 'M', DCsym: 'M_{DC}', DWsym: 'M_{DW}', LLsym: 'M_{LL+IM}',
      DCeq: `${s < 0 ? '-' : ''}(M_{DC1} + M_{DC2})${ut}`, DCsub: `${s < 0 ? '-' : ''}(${g1(r.MDC1)} + ${g1(r.MDC2)})${r.ut ? ` + ${g1(adds(s * r.MUF))}` : ''}`,
      DWeq: `${s < 0 ? '-' : ''}M_{DW}${utW}`, DWsub: `${s < 0 ? '-' : ''}(${g1(r.MDW)})${r.ut ? ` + ${g1(adds(s * r.MUT))}` : ''}`,
      DCnote: r.ut ? 'The future utility allowance M_UF with DC where it adds (no relief; MassDOT utilities, ST-Girder GD54c).' : '', DWnote: r.ut ? 'The existing utilities M_UT with DW where they add.' : '',
      LLnote: `The ${reg} LL+IM envelope at the location.` };
    // stress of component X at flange f ('top' | 'bot'), positive when it acts as the live load does on that flange
    const st = (X, f, sg) => sg * (r.stg[X] ? r.stg[X][f] : 0);
    const stressRow = (key, f, Rn, RnSym, RnLabel, RnRef, RnStep, F, Fsym, Feq, Fsub, title, ref) => {
      const sg = Math.sign(r.stg.LL[f]) || (f === (r.pos ? 'top' : 'bot') ? -1 : 1);   // the flange's LL stress direction
      const DC = st('DC1', f, sg) + st('DC2', f, sg) + adds(st('UF', f, sg)), DW = st('DW', f, sg) + adds(st('UT', f, sg)), LL = Math.abs(r.stg.LL[f]);
      const fn = f === 'top' ? 'top' : 'bottom', T = f === 'top' ? 't' : 'b';
      return make({ ...base, key, kind: 'flex', basis: 'f', unit: 'ksi', title, ref, Rn, RnSym, RnLabel, RnRef, RnStep, RnTab: 'flexure', DC, DW, LL, F, Fsym, Feq, Fsub,
        DCsym: `f_{DC,${T}}`, DWsym: `f_{DW,${T}}`, LLsym: `f_{LL+IM,${T}}`,
        DCeq: `f_{DC1} + f_{DC2}${r.ut ? ' + f_{UF}' : ''}`, DCsub: `${n3(st('DC1', f, sg))} + ${n3(st('DC2', f, sg))}${r.ut ? ` + ${n3(adds(st('UF', f, sg)))}` : ''}`,
        DWeq: `f_{DW}${r.ut ? ' + f_{UT}' : ''}`, DWsub: r.ut ? `${n3(st('DW', f, sg))} + ${n3(adds(st('UT', f, sg)))}` : '',
        DCnote: `Stresses at the ${fn} of the steel, each on its own section (DC1 steel; DC2 and DW ${r.nc ? 'steel (noncomposite)' : r.pos ? 'long-term composite 3n' : 'steel + deck reinforcement'}), ${sg < 0 ? 'compression' : 'tension'} positive (the live-load direction).`,
        LLnote: `On the ${r.nc ? 'steel' : r.pos ? 'short-term composite n' : 'steel + deck reinforcement'} section.` }, G, ph);
    };
    if (r.p7) {   // composite, positive flexure
      if (r.compact) {
        const F = (r.fl || 0) * r.Sxt / 3 / 12;
        out.push(make({ ...base, key: 'mp', kind: 'flex', title: 'Positive flexure, compact section (moment basis)', ref: `${ED} Art. 6.10.7.1`, ...mParts,
          Rn: r.Mn, RnSym: 'M_{n}', RnLabel: 'Nominal flexural resistance, compact section (≤ 1.3R_hM_y in a continuous span)', RnRef: `${ED} Eqs. 6.10.7.1.2-1, -2, -3`, RnStep: 'fx.mn.ok', RnTab: 'flexure',
          F, Fsym: '\\frac{1}{3}f_{\\ell}S_{xt}', Fsub: F ? `\\frac{1}{3}(${n2(r.fl)})\\frac{${g1(r.Sxt)}}{12}` : '' }, G, ph));
      } else {
        out.push(stressRow('ncC', 'top', r.FncP, 'F_{nc}', 'Compression-flange resistance, noncompact section (R_b = 1.0)', `${ED} Eq. 6.10.7.2.2-1`, 'fx.Fnc', 0, '', '', '', 'Positive flexure, noncompact: compression flange (stress basis)', `${ED} Eq. 6.10.7.2.1-1`));
        out.push(stressRow('ncT', 'bot', r.Rh * r.tF.Fy, 'R_{h}F_{yt}', 'Tension-flange resistance, noncompact section', `${ED} Eq. 6.10.7.2.1-2`, 'fx.ncT.ok', (r.fl || 0) / 3, '\\frac{1}{3}f_{\\ell}', '', '', 'Positive flexure, noncompact: tension flange (stress basis)', `${ED} Eq. 6.10.7.2.1-2`));
      }
      return out;
    }
    // negative flexure (composite), or noncomposite in either region: the method in use
    const cf = r.pos ? 'top' : 'bot', tf = r.pos ? 'bot' : 'top';
    if (r.useA6) {
      const a = r.A6, Fc = flA(a.am) * a.Sxc / 3 / 12, Ft = r.nc ? r.tF.fl * a.Sxt / 3 / 12 : 0;
      out.push(make({ ...base, key: 'a6c', kind: 'flex', title: `${r.pos ? 'Positive' : 'Negative'} flexure, App. A6: compression flange (moment basis)`, ref: `${ED} Eq. A6.1.1-1`, ...mParts,
        Rn: a.Mnc, RnSym: 'M_{nc}', RnLabel: 'App. A6 compression-flange flexural resistance', RnRef: `${ED} Art. A6.3`, RnStep: 'fx.a6.Mnc', RnTab: 'flexure',
        F: Fc, Fsym: '\\frac{1}{3}f_{\\ell}S_{xc}', Fsub: Fc ? `\\frac{1}{3}(${n2(flA(a.am))})\\frac{${g1(a.Sxc)}}{12}` : '' }, G, ph));
      out.push(make({ ...base, key: 'a6t', kind: 'flex', title: `${r.pos ? 'Positive' : 'Negative'} flexure, App. A6: tension flange (moment basis)`, ref: `${ED} Eq. A6.1.2-1`, ...mParts,
        Rn: a.Mnt, RnSym: 'R_{pt}M_{yt}', RnLabel: 'App. A6 tension-flange flexural resistance', RnRef: `${ED} Art. A6.4`, RnStep: 'fx.a6t.ok', RnTab: 'flexure',
        F: Ft, Fsym: '\\frac{1}{3}f_{\\ell}S_{xt}', Fsub: Ft ? `\\frac{1}{3}(${n2(r.tF.fl)})\\frac{${g1(a.Sxt)}}{12}` : '' }, G, ph));
    } else {
      out.push(stressRow('fnc', cf, r.lt.Fnc, 'F_{nc}', 'Nominal compression-flange flexural resistance, min(FLB, LTB)', `${ED} Arts. 6.10.8.2.2, 6.10.8.2.3`, 'fx.Fnc', flA(r.am) / 3, '\\frac{1}{3}f_{\\ell}', '', '',
        `${r.pos ? 'Positive' : 'Negative'} flexure, 6.10.8: compression flange (stress basis)`, `${ED} Eq. 6.10.8.1.1-1`));
      out.push(stressRow('fnt', tf, r.Rh * r.tF.Fy, 'F_{nt} = R_{h}F_{yt}', 'Nominal tension-flange flexural resistance', `${ED} Eq. 6.10.8.3-1`, 'fx.fnt.ok', r.nc ? (r.tF.fl || 0) / 3 : 0, '\\frac{1}{3}f_{\\ell}', '', '',
        `${r.pos ? 'Positive' : 'Negative'} flexure, 6.10.8: tension flange (stress basis)`, `${ED} Eq. 6.10.8.1.${r.nc ? 2 : 3}-1`));
    }
    return out;
  }

  /* ---------- Service II (MBE 6A.6.4.2.2; LRFD 6.10.4.2.2) ---------- */
  /* service(r, opt): opt = { G, phi, mat: { Fyw } }; both flanges (Eqs. 6.10.4.2.2-1, -2; noncomposite -3) and, where 6.10.4.2.2 requires it, the web (Eq. -4:
     f_c ≤ F_crw, D_c from the Service II stresses: the RF is the load factor at which f_c = F_crw). γ_D = 1.0, φ_c φ_s not applied. */
  function service(r, opt) {
    const G = factors(opt && opt.G), ph = (opt && opt.phi) || phi(), out = [];
    if (r.factored) return out;
    const coef = r.nc ? 0.80 : 0.95, base = { name: r.name, x: r.x, region: r.region, lim: 'Service II', useCS: false, phiR: 1.0, basis: 'f', unit: 'ksi', kind: 'svc' };
    const mat = (opt && opt.mat) || {}, FyT = r.pos ? r.cF.Fy : r.tF.Fy, FyB = r.pos ? r.tF.Fy : r.cF.Fy;
    ['top', 'bot'].forEach(f => {
      const fl = r.stg.LL[f]; if (!(Math.abs(fl) > 1e-6)) return;
      const sg = Math.sign(fl), T = f === 'top' ? 't' : 'b', fn = f === 'top' ? 'top' : 'bottom', Fy = f === 'top' ? FyT : FyB;
      const s1 = X => sg * (r.stg[X] ? r.stg[X][f] : 0);
      const DC = s1('DC1') + s1('DC2') + adds(s1('UF')), DW = s1('DW') + adds(s1('UT')), flat = r.nc ? (f === 'top' ? Math.max(r.flT || 0, 0) : Math.max(r.fl || 0, 0)) : f === 'bot' ? Math.max(r.fl || 0, 0) : 0;
      out.push(make({ ...base, key: 'sv' + T, title: `Service II, ${fn} flange (permanent deformation)`, ref: `${ED} Eq. 6.10.4.2.2-${r.nc ? 3 : f === 'top' ? 1 : 2}`,
        Rn: coef * r.Rh * Fy, RnSym: `${coef.toFixed(2)}R_{h}F_{yf}`, RnLabel: `Service II flange stress limit (${r.nc ? 'noncomposite' : 'composite'})`, RnRef: `${ED} Eq. 6.10.4.2.2-${r.nc ? 3 : f === 'top' ? 1 : 2}`, RnStep: `fx.sv${f === 'top' ? 't' : 'b'}.ok`, RnTab: 'flexure',
        parts: [{ id: 'Rh', label: 'Hybrid factor and flange yield strength', sym: 'R_{h},\\ F_{yf}', eq: '', sub: `${n3(r.Rh)},\\ ${n2(Fy)}`, value: coef * r.Rh * Fy, unit: 'ksi', d: 3, ref: `${ED} Art. 6.10.1.10.1` }],
        DC, DW, LL: Math.abs(fl), F: flat / 2, Fsym: '\\frac{1}{2}f_{\\ell}', Fnote: 'f_ℓ at Service II as the design check GS12 takes it.',
        DCsym: `f_{DC,${T}}`, DWsym: `f_{DW,${T}}`, LLsym: `f_{LL+IM,${T}}`, DCeq: `f_{DC1} + f_{DC2}${r.ut ? ' + f_{UF}' : ''}`, DCsub: `${n3(s1('DC1'))} + ${n3(s1('DC2'))}${r.ut ? ` + ${n3(adds(s1('UF')))}` : ''}`,
        DWsub: r.ut ? `${n3(s1('DW'))} + ${n3(adds(s1('UT')))}` : '', DCnote: `Unfactored stresses at the ${fn} of the steel, ${sg < 0 ? 'compression' : 'tension'} positive (the live-load direction), each on its own section.` }, G, ph));
    });
    // web bend-buckling (GS13): not for a composite section in positive flexure with D/t_w ≤ 150
    if (!(r.p7 && r.D / r.tw <= 150) && window.SBDFlexure) {
      const FX = window.SBDFlexure, cK = r.pos ? 'top' : 'bot', d = r.d, Fyc = r.cF.Fy, Fyw = +mat.Fyw || r.cF.Fy;
      const perm = f => ['DC1', 'DC2', 'DW'].reduce((a, X) => a + r.stg[X][f], 0) + (r.stg.UT ? r.stg.UT[f] : 0) + (r.stg.UF ? (r.svU != null ? r.svU : 1) * r.stg.UF[f] : 0);
      const at = gl => { const top = perm('top') + gl * r.stg.LL.top, bot = perm('bot') + gl * r.stg.LL.bot, c = r.pos ? -top : -bot, t = r.pos ? bot : top, fc = Math.max(c, 0);
        const Dc = fc > 0 ? Math.max(fc / (fc + Math.abs(t)) * d - (r.pos ? r.topT : r.botT), 0) : 0, W = FX.fcrw(r.D, r.tw, Math.max(Dc, 1e-6), r.Rh, Fyc, Fyw, fc > 0 && t < 0);
        return { fc, Dc, F: W.F, k: W.k }; };
      const cLL = -r.stg.LL[cK];   // compression of the live load on the compression flange
      if (cLL > 1e-6) {
        const q0 = at(0), q1 = at(G.sInv);
        out.push(make({ ...base, key: 'web', title: 'Service II, web bend-buckling (f_c ≤ F_crw)', ref: `${ED} Eq. 6.10.4.2.2-4`, Rn: q1.F, RnSym: 'F_{crw}', RnLabel: `Web bend-buckling resistance at the Inventory Service II load (D_c = ${n3(q1.Dc)} in, k = ${n2(q1.k)}); it changes with the load through D_c`,
          RnRef: `${ED} Eq. 6.10.1.9.1-1`, RnStep: 'fx.web.ok', RnTab: 'flexure', DC: q0.fc, DW: 0, LL: cLL, quad: gl => { const q = at(gl); return q.fc - q.F; },
          DCsym: 'f_{c,D}', DCnote: 'The unfactored permanent compression in the compression flange (DC and DW together).', DWsym: '0', LLsym: 'f_{c,LL+IM}',
          quadEq: 'f_{c}(\\gamma_{LL}RF) = F_{crw}(D_{c}(\\gamma_{LL}RF))', quadSub: (gl, g0) => { const q = at(gl); return `f_{c} = ${n3(q.fc)},\\ F_{crw} = ${n3(q.F)}\\ \\text{at } \\gamma_{LL}RF = ${n2(g0)}(RF)`; } }, G, ph));
      }
    }
    return out;
  }

  /* ---------- shear, Strength I ---------- */
  /* shear(r, opt): r = SBDShear.location result (its V_n: V_cr in an end panel, the tension field elsewhere when stiffened);
     opt = { G, phi, cases }. C = φ_c φ_s φ_v V_n. cases (shearCases): the demands at the location in each direction of shear, each
     component as it acts in that direction (≥ 0: a permanent load that relieves is taken as 0, no relief); the lowest RF governs.
     Without cases: the location's magnitudes (DC = V_DC1 + V_DC2 + V_UF, DW = V_DW + V_UT, LL = the larger LL+IM envelope). */
  function shear(r, opt) {
    const G = factors(opt && opt.G), ph = (opt && opt.phi) || phi();
    const cases = (opt && opt.cases && opt.cases.length) ? opt.cases : [{ dir: 0, DC1: r.VDC1, DC2: r.VDC2, DW: r.VDW, UT: r.VUT || 0, UF: r.VUF || 0, LL: r.VLL }];
    const ut = cases.some(c => c.UT || c.UF);
    const rows = cases.map(c => make({ key: 'v', kind: 'shear', name: r.name, x: r.x, lim: 'Strength I', useCS: true, phiR: 1.0, basis: 'V', unit: 'kip', title: 'Shear', ref: `${ED} Art. 6.10.9`, dir: c.dir,
      Rn: r.sh.Vn, RnSym: 'V_{n}', RnLabel: `Nominal shear resistance (Eq. ${r.sh.eqn}${r.end ? ', end panel' : ''})`, RnRef: `${ED} Art. 6.10.9`, RnStep: 'sh.pan.Vn', RnTab: 'shear',
      DC: c.DC1 + c.DC2 + c.UF, DW: c.DW + c.UT, LL: c.LL, DCsym: 'V_{DC}', DWsym: 'V_{DW}', LLsym: 'V_{LL+IM}',
      DCeq: `V_{DC1} + V_{DC2}${ut ? ' + V_{UF}' : ''}`, DCsub: `${g1(c.DC1)} + ${g1(c.DC2)}${ut ? ` + ${g1(c.UF)}` : ''}`, DWeq: ut ? 'V_{DW} + V_{UT}' : '', DWsub: ut ? `${g1(c.DW)} + ${g1(c.UT)}` : '',
      DCnote: c.dir ? `Shear in the ${c.dir > 0 ? 'positive' : 'negative'} direction${c.st != null ? ` (station x = ${n3(c.st)} ft)` : ''}: each permanent load as it acts in that direction; one that relieves it is taken as 0 (no relief).` : 'Magnitudes at the location.',
      LLnote: c.dir ? 'The LL+IM shear envelope of the same direction.' : 'The larger of the positive and negative LL+IM shear envelopes at the location (magnitude).' }, G, ph));
    return rows.reduce((b, q) => (!b || q.inv < b.inv ? q : b), null);
  }
  /* shearCases(pl): the shear demands of a hand-off-shaped object (schema stgirder-external-demands, or this app's analysis in that shape)
     by direction. Returns at(x): for every station within 0.011 ft of x on the same side of every support (else the nearest station on
     that side), and each direction d = ±1 (the payload's sign convention): DC1, DC2 = d V_DC1, d V_DC2 when d(V_DC1 + V_DC2) > 0, else 0;
     DW, UT, UF = max(d V, 0); LL = V_LL,pos (d = +1) or −V_LL,neg (d = −1), plus V_PL when the payload gives the pedestrian load
     separately and not in LL (pedestrianInLL not true). */
  function shearCases(pl) {
    const S = (pl && pl.stations) || [], sup = ((pl && pl.member) || {}).supports || [], ped = !!pl && pl.pedestrianInLL === true, v = (s, k) => +s[k] || 0;
    const across = (a, b) => sup.some(q => (a - q) * (b - q) < -1e-12);
    return x => {
      let ids = S.filter(s => Math.abs(s.x - x) <= 0.011 + 1e-9 && !across(s.x, x));
      if (!ids.length) { const side = S.filter(s => !across(s.x, x)); if (side.length) ids = [side.reduce((b, s) => (Math.abs(s.x - x) < Math.abs(b.x - x) ? s : b))]; }
      const out = [];
      ids.forEach(s => [1, -1].forEach(d => {
        const on = d * (v(s, 'V_DC1') + v(s, 'V_DC2')) > 0;
        const LL = d > 0 ? Math.max(v(s, 'V_LLpos') + (ped ? 0 : v(s, 'V_PLpos')), 0) : Math.max(-(v(s, 'V_LLneg') + (ped ? 0 : v(s, 'V_PLneg'))), 0);
        out.push({ dir: d, st: +s.x, DC1: on ? d * v(s, 'V_DC1') : 0, DC2: on ? d * v(s, 'V_DC2') : 0, DW: Math.max(d * v(s, 'V_DW'), 0), UT: Math.max(d * v(s, 'V_UT'), 0), UF: Math.max(d * v(s, 'V_UF'), 0), LL }); }));
      return out; };
  }
  /* noDoublePL(pl): the payload for engine/flexure.js and engine/shear.js fromPayload, which add M_PL / V_PL to M_LL / V_LL: when
     pedestrianInLL is true the LL envelopes already include the pedestrian load (HANDOFF.md §4.9), so the M_PL / V_PL fields are left out
     (a copy; the payload itself is not changed). */
  function noDoublePL(pl) {
    if (!pl || pl.pedestrianInLL !== true) return pl;
    return { ...pl, stations: (pl.stations || []).map(s => { const o = { ...s }; ['M_PLpos', 'M_PLneg', 'V_PLpos', 'V_PLneg'].forEach(k => delete o[k]); return o; }) };
  }

  /* ---------- fatigue (GS20): RF = 1/ratio of the flange stress range check GS17 ---------- */
  function fatigue(item, where) {
    const rr = +item.r, q = { key: 'fat', kind: 'fat', name: where.name, x: where.x, lim: 'Fatigue', title: `Fatigue, ${item.loc}`, inv: rr > 0 ? 1 / rr : NONE, opr: NaN, r: rr };
    const w = St().work('rt'); w.add({ id: 'fat', label: 'Fatigue rating factor (GirderDetail GS20: 1/(ratio) of GS17 at its limit state)', sym: 'RF_{fat}', eq: '\\frac{1}{\\gamma(\\Delta f)/(\\Delta F)_{n}}', sub: `\\frac{1}{${n3(rr)}}`, value: q.inv, unit: '', d: 3, ref: `${MBE} Art. 6A.4.2 (as GirderDetail GS20); ${ED} Art. 6.6.1.2`, note: 'Reported for the owner\'s fatigue target only.' });
    Object.defineProperty(q, 'steps', { value: w.steps, enumerable: false }); return q;
  }

  /* ---------- the owner's design rating target (GS20, OWN9) ---------- */
  /* target(owner): the owner's rate.* rule that is not a pending reference: { rf, fat, kind, cite, text, pend: [pending vehicle refs] }, or null (AASHTO) */
  function target(owner) {
    const OW = window.SBDOwners; if (!OW || !owner || owner === 'AASHTO') return null;
    const rows = OW.rules(owner).filter(q => /^rate\./.test(q.id)), r = rows.find(q => q.kind !== 'pending-reference'); if (!r) return null;
    const v = r.value || {}, rf0 = +v.rf > 0 ? +v.rf : null;
    return { rf: rf0, fat: +v.fat > 0 ? +v.fat : rf0, kind: r.kind, cite: OW.cite(r), text: r.text || '', pend: rows.filter(q => q.kind === 'pending-reference').map(q => q.ref) };
  }

  /* ---------- a girder ---------- */
  /* girder(rows, opt): rows = every rating row of the girder; opt.owner. Returns { rows, gov: { inv, opr }, by: { flex+, flex−, shear,
     svc, fat }: the lowest Inventory row of each group, target, oos }. Fatigue rows count only against the owner's fatigue target. */
  function girder(rows, opt) {
    const ok = rows.filter(q => !q.oos && isFinite(q.inv)), str = ok.filter(q => q.kind !== 'fat'), low = (L, k) => L.reduce((b, q) => (isFinite(q[k]) && (!b || q[k] < b[k]) ? q : b), null);
    const grp = q => q.kind === 'flex' ? (q.region === 'pos' ? 'flexP' : 'flexN') : q.kind;
    const by = {}; ok.forEach(q => { const k = grp(q); if (!by[k] || q.inv < by[k].inv) by[k] = q; });
    const T = target(opt && opt.owner), gInv = low(str, 'inv'), gOpr = low(str, 'opr'), fat = by.fat || null;
    const res = { rows, gov: { inv: gInv, opr: gOpr }, by, target: T, oos: rows.some(q => q.oos) };
    if (T) { res.tgt = { inv: T.rf ? { need: T.rf, rf: gInv ? gInv.inv : NaN, pass: !!gInv && gInv.inv >= T.rf - 1e-9 } : null,
      fat: T.fat && fat ? { need: T.fat, rf: fat.inv, pass: fat.inv >= T.fat - 1e-9 } : null }; }
    return res;
  }

  window.SBDRating = { MBE, factors, phi, rf, kAt, flexure, service, shear, shearCases, noDoublePL, fatigue, target, girder };
})();
