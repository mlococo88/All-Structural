/* apps/steel-bridge/engine/rating.js — load rating of a steel I-girder by LRFR, the HL-93 design-load rating (window.SBDRating).
   Classic script, no DOM. Needs window.SharedSteps (shared/steps.js); the capacities come from engine/flexure.js and engine/shear.js
   results (SBDFlexure.location, SBDShear.location), so it needs SBDFlexure for F_crw (Service II web).

   Created 2026-10-29 (docs/REBUILD_PLAN.md §5, "Load rating"), from two references:
     - ST-Girder ("Steel Bridge Design.html", st-src block, computeAll "Load rating (LRFR, MBE) — station-based", and RatingTab): the
       method. RF = (C − γ_DC DC − γ_DW DW ± γ_P P)/(γ_LL (LL + IM)) (MBE Eq. 6A.4.2.1-1), C = φ_c φ_s φ R_n (Eq. 6A.4.2.1-2) with
       φ_c φ_s ≥ 0.85 (Eq. 6A.4.2.1-3) at the Strength limit state; design-load rating on HL-93, Strength I Inventory γ_LL = 1.75 and
       Operating 1.35, γ_DC = 1.25, γ_DW = 1.50 (Table 6A.4.2.2-1); flexure on a moment basis for a compact composite section in positive
       flexure, else on a stress basis per flange; shear; Service II (6A.6.4.2.2): RF = (f_R − γ_D f_D)/(γ_LL f_LL), f_R = 0.95 F_yf
       (composite) or 0.80 R_h F_yf (noncomposite), γ_D = 1.0, γ_LL = 1.30 Inventory, 1.00 Operating. Every station, the lowest RF governs.
       MBE 4th Ed. adoption (engineer standing rule 2026-11-10; deliberate differences from ST-Girder / GirderDetail, which keep the older form):
         - Service II f_R (Art. 6A.6.4.2.2, p. 6-66): 0.95 F_yf for composite sections, no R_h (before: 0.95 R_h F_yf); noncomposite unchanged;
         - shear (Art. 6A.4.2.4, p. 6-25): φ_s = 1.0 for shear at the Strength limit state, so C = φ_c φ_v V_n (before: φ_c φ_s φ_v V_n);
           flexure keeps φ_c φ_s (≥ 0.85).
       The utilities (MassDOT; GD54c, ST-Girder's default): the future allowance with DC, the existing with DW, where they add (no relief).
       No legal or permit loads (ST-Girder has none); added here on 2026-11-23, below.
     - GirderDetail's GS20 (OWN9): the owner's design rating target (inventory RF; and the fatigue RF = 1/ratio of GS17), reported only.
   The capacities are this app's unified 10th Ed. modules, as the engineer decided on 2026-10-29 (GirderDetail's methods are the truth):
   M_n, F_nc (6.10.8 with R_b, c_rw), App. A6 where it is the method in use (moment basis, M_nc and R_pt M_yt), V_n with the tension field
   (6.10.9), F_crw (Service II web, 6.10.4.2.2-4). Where a capacity depends on the load (F_crw through D_c), RF is the load factor at which
   the check reaches its limit (found by bisection), as GS20's quadratic does.
   The flange lateral bending f_ℓ of the design check is kept in the rating as a constant (the design check's value): M_u + f_ℓS_x/3,
   f_bu + f_ℓ/3, and f_f + f_ℓ/2 at Service II.

   Code: AASHTO Manual for Bridge Evaluation (MBE), 4th Edition (2026), Section 6A (engineer decision 2026-11-10; until then the 3rd Ed.,
   2018). The article, table and equation numbers used here (6A.4.2.1, Eqs. 6A.4.2.1-1 to -4, Tables 6A.4.2.2-1, 6A.4.2.3-1, 6A.4.2.4-1,
   6A.6.4.2.2) were checked in the 4th Ed. on 2026-11-10. Resistances: AASHTO LRFD 10th Ed. (2024). φ_f = φ_v = 1.0 (6.5.4.2).
   Units: moments kip-ft, shears kip, stresses ksi (the stress of each component positive when it acts as the live load does). */
(function () {
  'use strict';
  const MBE = 'AASHTO MBE 4th Ed. (2026)', ED = 'AASHTO LRFD 10th Ed.';
  const St = () => window.SharedSteps;
  const n2 = x => St().n(x, 2), n3 = x => St().n(x, 3), g1 = x => St().g(x, 1);
  const NONE = Infinity;   // no live-load effect: no rating (shown as —)

  /* factors(over): MBE Table 6A.4.2.2-1, design-load rating. Strength I: γ_DC 1.25, γ_DW 1.50, γ_P 1.00, γ_LL 1.75 Inventory /
     1.35 Operating; Service II: γ_D 1.00, γ_LL 1.30 Inventory / 1.00 Operating. */
  function factors(over) { return { dc: 1.25, dw: 1.50, p: 1.00, inv: 1.75, opr: 1.35, sd: 1.00, sInv: 1.30, sOpr: 1.00, ...(over || {}) }; }
  /* phi(phiC, phiS): the condition factor φ_c (Table 6A.4.2.3-1) and system factor φ_s (Table 6A.4.2.4-1), 1.0 when not given;
     v = max(φ_c φ_s, 0.85) (Eq. 6A.4.2.1-3), applied to the Strength flexure capacities; vV = max(φ_c(1.0), 0.85), the shear capacities
     (MBE 4th Ed. Art. 6A.4.2.4, p. 6-25: φ_s = 1.0 for shear at the Strength limit state; before 2026-11-10 shear took v, as ST-Girder). */
  function phi(phiC, phiS) { const c = +phiC > 0 ? +phiC : 1, s = +phiS > 0 ? +phiS : 1, prod = c * s; return { phiC: c, phiS: s, prod, v: Math.max(prod, 0.85), floor: prod < 0.85, vV: Math.max(c, 0.85), floorV: c < 0.85 }; }

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
    const sv = q.lim === 'Service II', cs = q.useCS ? (q.kind === 'shear' ? (ph.vV != null ? ph.vV : Math.max(ph.phiC, 0.85)) : ph.v) : 1;   // shear: φ_s = 1.0 (MBE 6A.4.2.4)
    q.cs = cs; q.C = cs * q.phiR * q.Rn;
    const g = sv ? { dc: G.sd, dw: G.sd, inv: G.sInv, opr: G.sOpr } : { dc: G.dc, dw: G.dw, inv: G.inv, opr: G.opr };
    q.g = g;
    if (G.one) { q.one = G.one; q.gRef = sv ? G.sRef : G.gRef; q.gStep = sv ? { note: G.sNote || '' } : G.gStep || null; }   // legal and permit loads (2026-11-23): one rating factor (inv = opr = it), its γ_LL reference
    const one = gLL => q.quad ? (q.LL > 1e-6 ? kAt(k => q.quad(k * gLL), 100) : NONE) : rf({ C: q.C, DC: q.DC, DW: q.DW, F: q.F, LL: q.LL, gLL, gDC: g.dc, gDW: g.dw });
    q.inv = one(g.inv); q.opr = one(g.opr);
    Object.defineProperty(q, 'steps', { enumerable: false, configurable: true, get() { const s = worked(q, ph); Object.defineProperty(q, 'steps', { value: s, enumerable: false }); return s; } });
    return q;
  }
  function worked(q, ph) {
    const w = St().work('rt'), sv = q.lim === 'Service II', u = q.unit, d = u === 'ksi' ? 3 : 1, nf = u === 'ksi' ? n3 : g1, g = q.g;
    if (!sv && q.useCS && q.kind === 'shear') {
      w.add({ id: 'phiCS', label: 'Condition and system factors (Strength, shear: φ_s = 1.0)', sym: '\\phi_{c}\\phi_{s}', eq: '\\max(\\phi_{c}(1.0), 0.85)', sub: `\\max(${n2(ph.phiC)}(1.00), 0.85)`, value: q.cs, unit: '', d: 3,
        ref: `${MBE} Art. 6A.4.2.4 (p. 6-25); Eq. 6A.4.2.1-3; Table 6A.4.2.3-1`, note: `The system factor is taken as 1.0 for shear at the Strength limit state (MBE 4th Ed. Art. 6A.4.2.4); the entered φ_s = ${n2(ph.phiS)} applies to flexure only.` });
    } else if (!sv && q.useCS) {
      w.add({ id: 'phiCS', label: 'Condition and system factors (Strength)', sym: '\\phi_{c}\\phi_{s}', eq: '\\max(\\phi_{c}\\phi_{s}, 0.85)', sub: `\\max(${n2(ph.phiC)}(${n2(ph.phiS)}), 0.85)`, value: ph.v, unit: '', d: 3,
        ref: `${MBE} Eq. 6A.4.2.1-3; Tables 6A.4.2.3-1, 6A.4.2.4-1`, note: ph.floor ? 'φ_cφ_s below 0.85: 0.85 is used (Eq. 6A.4.2.1-3).' : '' });
    }
    w.add({ id: 'Rn', label: q.RnLabel, sym: q.RnSym, eq: '', sub: '', value: q.Rn, unit: u, d, ref: q.RnRef, note: q.RnStep ? `Worked in the ${q.RnTab} steps below: see §${q.RnStep}.` : '' });
    w.add(Object.assign({ id: 'C', label: sv ? 'Service II limit stress' : 'Capacity', sym: sv ? 'f_{R}' : 'C', eq: sv ? q.RnSym : q.useCS ? `\\phi_{c}\\phi_{s}\\phi R_{n}` : '\\phi R_{n}',
      sub: sv ? (q.RnSub || nf(q.Rn)) : q.useCS ? `${n3(q.cs)}(${n2(q.phiR)})(${nf(q.Rn)})` : `${n2(q.phiR)}(${nf(q.Rn)})`, value: q.C, unit: u, d, ref: sv ? `${MBE} Art. 6A.6.4.2.2 (p. 6-66); ${ED} Art. 6.10.4.2.2` : `${MBE} Eq. 6A.4.2.1-2` }, sv && q.CNote ? { note: q.CNote } : {}));
    (q.parts || []).forEach(p => w.add({ ...p, unit: p.unit != null ? p.unit : u, d: p.d != null ? p.d : d }));
    w.add({ id: 'DC', label: 'Dead load DC (components and attachments)', sym: q.DCsym || 'DC', eq: q.DCeq || '', sub: q.DCsub || '', value: q.DC, unit: u, d, note: q.DCnote || '' });
    w.add({ id: 'DW', label: 'Dead load DW (wearing surface and utilities)', sym: q.DWsym || 'DW', eq: q.DWeq || '', sub: q.DWsub || '', value: q.DW, unit: u, d, note: q.DWnote || '' });
    (typeof q.vehParts === 'function' ? q.vehParts() : []).forEach(p => w.add(p));   // a rating vehicle: its per-lane effect, IM and distribution factor (ui/rating.js)
    w.add({ id: 'LL', label: q.LLlabel || 'HL-93 live load with dynamic load allowance, per girder', sym: q.LLsym || '(LL + IM)', eq: '', sub: '', value: q.LL, unit: u, d, note: q.LLnote || '' });
    if (q.F) w.add({ id: 'F', label: 'Flange lateral bending term (constant, the design check\'s value)', sym: q.Fsym, eq: q.Feq || '', sub: q.Fsub || '', value: q.F, unit: u, d, note: q.Fnote || '' });
    const Ft = q.F ? ` - ${q.Fsym}` : '', Fs = q.F ? ` - ${nf(q.F)}` : '';
    // a legal or permit load: its live-load factor (the table, the ADTT interpolation), then one rating factor
    const gT = q.one ? x => St().n(x, 4).replace(/(\.\d\d)0+$/, '$1') : n2;
    if (q.one) w.add({ id: 'gLL', label: `Live-load factor, ${q.lim}`, sym: '\\gamma_{LL}', eq: (q.gStep && q.gStep.eq) || '', sub: (q.gStep && q.gStep.sub) || '', value: g.inv, unit: '', d: 4, ref: q.gRef, note: (q.gStep && q.gStep.note) || '' });
    (q.one ? [['inv', q.one, g.inv]] : [['inv', 'Inventory', g.inv], ['opr', 'Operating', g.opr]]).forEach(([k, lab, gl]) => {
      const sym = q.one ? 'RF' : `RF_{${k === 'inv' ? 'inv' : 'op'}}`, tab = 'Table 6A.4.2.2-1';
      if (q.quad) {
        w.add({ id: k, label: `${lab} rating factor, ${q.lim} (the capacity depends on the load: the load factor at which the check reaches its limit)`, sym,
          eq: q.quadEq, sub: q.quadSub ? q.quadSub(q[k] * gl, gl) : '', value: isFinite(q[k]) ? q[k] : 'no live-load effect', unit: '', d: 3, ref: `${MBE} Eq. 6A.4.2.1-1, ${tab}${sv ? ', Art. 6A.6.4.2.2' : ''}` });
        return;
      }
      w.add({ id: k, label: `${lab} rating factor, ${q.lim}`, sym,
        eq: `\\frac{${sv ? 'f_{R}' : 'C'} - \\gamma_{${sv ? 'D' : 'DC'}}${q.DCsym || 'DC'} - \\gamma_{${sv ? 'D' : 'DW'}}${q.DWsym || 'DW'}${Ft}}{\\gamma_{LL}${q.LLsym || '(LL + IM)'}}`,
        sub: q.LL > 1e-6 ? `\\frac{${nf(q.C)} - ${n2(g.dc)}(${nf(q.DC)}) - ${n2(g.dw)}(${nf(q.DW)})${Fs}}{${gT(gl)}(${nf(q.LL)})}` : '',
        value: isFinite(q[k]) ? q[k] : 'no live-load effect', unit: '', d: 3, ref: `${MBE} Eq. 6A.4.2.1-1, ${tab}${sv ? ', Art. 6A.6.4.2.2 (Eq. 6A.4.2.1-4)' : ''}` });
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
    const s = r.pos ? 1 : -1, reg = r.pos ? 'positive' : 'negative', base = { name: r.name, x: r.x, region: r.region, lim: (opt && opt.lim) || 'Strength I', useCS: true, phiR: 1.0, ...(opt && opt.LLlabel ? { LLlabel: opt.LLlabel } : {}) };
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
     f_c ≤ F_crw, D_c from the Service II stresses: the RF is the load factor at which f_c = F_crw). γ_D = 1.0, φ_c φ_s not applied.
     Flange limit f_R (MBE 4th Ed. Art. 6A.6.4.2.2, p. 6-66): 0.95 F_yf composite (negative flexure of continuous spans included), 0.80 R_h F_yf
     noncomposite. Before 2026-11-10: 0.95 R_h F_yf composite (LRFD Eqs. 6.10.4.2.2-1, -2 and ST-Girder); the same where R_h = 1.0. */
  function service(r, opt) {
    const G = factors(opt && opt.G), ph = (opt && opt.phi) || phi(), out = [];
    if (r.factored) return out;
    const coef = r.nc ? 0.80 : 0.95, base = { name: r.name, x: r.x, region: r.region, lim: 'Service II', useCS: false, phiR: 1.0, basis: 'f', unit: 'ksi', kind: 'svc', ...(opt && opt.LLlabel ? { LLlabel: opt.LLlabel } : {}) };
    const mat = (opt && opt.mat) || {}, FyT = r.pos ? r.cF.Fy : r.tF.Fy, FyB = r.pos ? r.tF.Fy : r.cF.Fy;
    ['top', 'bot'].forEach(f => {
      const fl = r.stg.LL[f]; if (!(Math.abs(fl) > 1e-6)) return;
      const sg = Math.sign(fl), T = f === 'top' ? 't' : 'b', fn = f === 'top' ? 'top' : 'bottom', Fy = f === 'top' ? FyT : FyB;
      const s1 = X => sg * (r.stg[X] ? r.stg[X][f] : 0);
      const DC = s1('DC1') + s1('DC2') + adds(s1('UF')), DW = s1('DW') + adds(s1('UT')), flSv = r.flSv != null ? r.flSv : r.fl, flat = r.nc ? (f === 'top' ? Math.max(r.flT || 0, 0) : Math.max(flSv || 0, 0)) : f === 'bot' ? Math.max(flSv || 0, 0) : 0;   // F2 (2026-11-19): f_ℓ at Service II (engine/flexure.js r.flSv), as GS12
      out.push(make({ ...base, key: 'sv' + T, title: `Service II, ${fn} flange (permanent deformation)`, ref: `${ED} Eq. 6.10.4.2.2-${r.nc ? 3 : f === 'top' ? 1 : 2}`,
        Rn: r.nc ? coef * r.Rh * Fy : coef * Fy, RnSym: r.nc ? `${coef.toFixed(2)}R_{h}F_{yf}` : `${coef.toFixed(2)}F_{yf}`, RnSub: r.nc ? `${coef.toFixed(2)}(${n3(r.Rh)})(${n2(Fy)})` : `${coef.toFixed(2)}(${n2(Fy)})`,
        RnLabel: `Service II flange stress limit f_R (${r.nc ? 'noncomposite: 0.80R_hF_yf' : 'composite: 0.95F_yf, no R_h'}; MBE 4th Ed. Art. 6A.6.4.2.2)`, RnRef: `${MBE} Art. 6A.6.4.2.2 (p. 6-66)`, RnStep: `fx.sv${f === 'top' ? 't' : 'b'}.ok`, RnTab: 'flexure',
        CNote: r.nc ? '' : `MBE 4th Ed. Art. 6A.6.4.2.2 sets f_R = 0.95F_yf for composite sections, including negative flexure of continuous spans, without the hybrid factor of LRFD Eqs. 6.10.4.2.2-1 and -2 (R_h = ${n3(r.Rh)} here${Math.abs(r.Rh - 1) > 1e-12 ? '; the Flexure tab\'s design check keeps 0.95R_hF_yf' : ', so the limit equals the design check\'s'}).`,
        parts: [{ id: 'Rh', label: r.nc ? 'Hybrid factor and flange yield strength' : 'Flange yield strength (R_h not applied, composite)', sym: r.nc ? 'R_{h},\\ F_{yf}' : 'F_{yf}', eq: '', sub: r.nc ? `${n3(r.Rh)},\\ ${n2(Fy)}` : n2(Fy), value: r.nc ? coef * r.Rh * Fy : coef * Fy, unit: 'ksi', d: 3, ref: r.nc ? `${ED} Art. 6.10.1.10.1` : `${MBE} Art. 6A.6.4.2.2` }],
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
     opt = { G, phi, cases }. C = φ_c φ_v V_n: φ_s = 1.0 for shear (MBE 4th Ed. Art. 6A.4.2.4, p. 6-25; before 2026-11-10 C = φ_c φ_s φ_v V_n). cases (shearCases): the demands at the location in each direction of shear, each
     component as it acts in that direction (≥ 0: a permanent load that relieves is taken as 0, no relief); the lowest RF governs.
     Without cases: the location's magnitudes (DC = V_DC1 + V_DC2 + V_UF, DW = V_DW + V_UT, LL = the larger LL+IM envelope). */
  function shear(r, opt) {
    const G = factors(opt && opt.G), ph = (opt && opt.phi) || phi();
    const cases = (opt && opt.cases && opt.cases.length) ? opt.cases : [{ dir: 0, DC1: r.VDC1, DC2: r.VDC2, DW: r.VDW, UT: r.VUT || 0, UF: r.VUF || 0, LL: r.VLL }];
    const ut = cases.some(c => c.UT || c.UF);
    const rows = cases.map(c => make({ key: 'v', kind: 'shear', name: r.name, x: r.x, lim: (opt && opt.lim) || 'Strength I', ...(opt && opt.LLlabel ? { LLlabel: opt.LLlabel } : {}), useCS: true, phiR: 1.0, basis: 'V', unit: 'kip', title: 'Shear', ref: `${ED} Art. 6.10.9`, dir: c.dir,
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
    // SB2-R2 guard: an RF of −∞ (amplification undefined, f_l > 0 with f_bu ≥ F_cr) or NaN (an error, flagged q.err) governs; +∞ (NONE: no
    // live-load effect) is no rating. Before: isFinite dropped −∞ and NaN.
    const rk = v => (Number.isNaN(v) ? -Infinity : v), use = v => v !== NONE && v !== undefined;
    rows.forEach(q => { if (!q.oos && (Number.isNaN(q.inv) || (q.kind !== 'fat' && Number.isNaN(q.opr)))) q.err = 'error: rating factor is NaN (calculation error; see the worked steps)'; });
    const ok = rows.filter(q => !q.oos && use(q.inv)), str = ok.filter(q => q.kind !== 'fat'), low = (L, k) => L.reduce((b, q) => (use(q[k]) && (!b || rk(q[k]) < rk(b[k])) ? q : b), null);
    const grp = q => q.kind === 'flex' ? (q.region === 'pos' ? 'flexP' : 'flexN') : q.kind;
    const by = {}; ok.forEach(q => { const k = grp(q); if (!by[k] || rk(q.inv) < rk(by[k].inv)) by[k] = q; });
    const T = target(opt && opt.owner), gInv = low(str, 'inv'), gOpr = low(str, 'opr'), fat = by.fat || null;
    const res = { rows, gov: { inv: gInv, opr: gOpr }, by, target: T, oos: rows.some(q => q.oos) };
    if (T) { res.tgt = { inv: T.rf ? { need: T.rf, rf: gInv ? gInv.inv : NaN, pass: !!gInv && rk(gInv.inv) >= T.rf - 1e-9 } : null,
      fat: T.fat && fat ? { need: T.fat, rf: fat.inv, pass: fat.inv >= T.fat - 1e-9 } : null }; }
    return res;
  }

  /* ---------- legal-load and permit rating (2026-11-23) ----------
     The same rating equation (MBE Eq. 6A.4.2.1-1), capacities, φ_c, φ_s and dead-load factors as the design-load rating; one rating factor per
     vehicle (no Inventory / Operating levels). What differs is the live load (each selected vehicle run on the line-girder model, engine/analysis.js
     R.vehicle), its dynamic load allowance, its distribution factor and γ_LL:
       legal loads (Type 3, 3S2, 3-3; SU4 to SU7; owner legal vehicles): Strength I, γ_LL by ADTT (one direction) from Tables 6A.4.4.2.3a-1 and
         6A.4.4.2.3b-1: 1.30 at ADTT ≤ 1000, 1.45 at ADTT ≥ 5000 or unknown, linear between; Service II γ_LL 1.30 (Table 6A.4.2.2-1); the governing (one or more lanes) distribution factor; IM 33 % unless entered
         (Art. 6A.4.4.3);
       lane-type legal load model (Figs. D6A-4, D6A-5; Art. 6A.4.4.2.1a): 75 % of Type 3-3 + 0.2 klf (no IM on the lane load, Art. 6A.4.4.3), two
         such trucks for negative moment and interior reactions (the MBE figure spaces them 30 ft; the shared engine searches 30 ft and more, which
         includes the MBE case); its effects are used for negative moment (continuous girders, every span length), for the shear at the stations of
         the negative-moment regions around the piers (the interior reactions; decision pending engineer review), and for every effect in spans
         longer than 200 ft; rated load and posting with W = 80 kip (Arts. 6A.4.4.4, 6A.8.3);
       emergency vehicles EV2, EV3 (FAST Act; FHWA memorandum of 2016-11-03; the MBE 4th Ed. does not cover them): γ_LL from the legal-load table (the conservative default, ≥ 1.30) or
         1.30 (the FHWA memorandum) by the engineer's choice; decision pending engineer review;
       permit loads: Strength II, γ_LL from Table 6A.4.5.4.2a-1 by permit type: routine or annual (by ADTT and GVW / AL) with the design
         (multi-lane) factor; special or limited-crossing permits with the one-lane factor without the multiple presence factor (Art. 6A.4.5.4.2b:
         this app's fatigue factors, g_1 / 1.2) and γ_LL 1.40 (multiple trips, fewer than 100 crossings, mixed with traffic), 1.20 (single trip,
         mixed with traffic), 1.10 (single trip, escorted, no other vehicle on the bridge); Service II γ_LL 1.00 (Table 6A.4.2.2-1) with the design
         distribution factor for every permit that mixes with traffic and the one-lane factor only for the escorted permit (C6A.6.4.2.2); IM 33 %
         unless entered (Art. 6A.4.5.5); a 0.2 klf lane load on top of the permit vehicle (no IM) where Art. 6A.4.5.4.1 asks for it (permitLane,
         vehicleLL).
     Posting (Art. 6A.8.3, Eq. 6A.8.3-1): safe posting load = (W / 0.7)(RF − 0.3) for 0.3 < RF < 1.0 of a legal load.
     Verified against the MBE 4th Ed. (2026) text, 2026-11-23 (fixlog/steel-bridge.md, MBV): Tables 6A.4.2.2-1, 6A.4.4.2.3a-1, 6A.4.4.2.3b-1,
     6A.4.5.4.2a-1; Arts. 6A.4.4.2.1a, 6A.4.4.3, 6A.4.4.4, 6A.4.5.4.1, 6A.4.5.4.2a, 6A.4.5.4.2b, 6A.4.5.5, 6A.4.5.6, 6A.6.4.2, 6A.8.3; Figs. D6A-1 to
     D6A-5 and D6A-7. */
  /* gammaLegal(adtt): generalized live-load factor of legal loads, MBE Tables 6A.4.4.2.3a-1 / -3b-1 (ADTT one direction; unknown: 1.45) */
  function gammaLegal(adtt) { const A = +adtt; if (adtt == null || adtt === '' || !(A >= 0)) return 1.45; if (A >= 5000) return 1.45; if (A <= 1000) return 1.30; return 1.30 + (1.45 - 1.30) * (A - 1000) / (5000 - 1000); }
  /* weightRatio(axles): GVW (kip), AL (ft, front to rear axle), GVW / AL (kip/ft; null with fewer than two axles); axles [[P, spacing]…] */
  function weightRatio(axles) { const ax = axles || [], gvw = ax.reduce((a, q) => a + (+q[0] || 0), 0), AL = ax.slice(1).reduce((a, q) => a + (+q[1] || 0), 0); return { gvw, AL, wr: ax.length > 1 && AL > 0 ? gvw / AL : null }; }
  const PERMIT_ROUTINE = [[5000, [1.40, 1.35, 1.30]], [1000, [1.35, 1.25, 1.20]], [100, [1.30, 1.20, 1.15]]];   // Table 6A.4.5.4.2a-1: ADTT rows; GVW/AL ≤ 2.0 | 2.0–3.0 | ≥ 3.0 kip/ft
  /* df: the distribution factor at Strength II (Table 6A.4.5.4.2a-1, Arts. 6A.4.5.4.2a, 6A.4.5.4.2b); dfS: at Service II (C6A.6.4.2.2: the LRFD
     design factors for a permit that mixes with traffic; the one-lane factor only for an escorted permit with no other vehicle on the bridge);
     mixed: other vehicles may be on the bridge (the 0.2 klf lane load of Art. 6A.4.5.4.1 stands for them; C6A.4.5.4.1: not needed when the
     permit excludes other loads) */
  const PERMIT_TYPES = [
    { id: 'routine', df: 'multi', dfS: 'multi', mixed: true, label: 'Routine or annual: unlimited crossings, mixed with traffic (two or more lanes)' },
    { id: 'multi', df: 'one', dfS: 'multi', mixed: true, gam: 1.40, label: 'Special or limited crossing: multiple trips (fewer than 100 crossings), mixed with traffic (one lane)' },
    { id: 'trip-mixed', df: 'one', dfS: 'multi', mixed: true, gam: 1.20, label: 'Special or limited crossing: single trip, mixed with traffic (one lane)' },
    { id: 'trip-escort', df: 'one', dfS: 'one', mixed: false, gam: 1.10, label: 'Special or limited crossing: single trip, escorted, no other vehicle on the bridge (one lane)' }];
  /* gammaPermit(type, adtt, wr): MBE Table 6A.4.5.4.2a-1. Routine: the column by GVW/AL (not interpolated between columns: the lower column, the
     larger factor; no ratio: the ≤ 2.0 column), the row by ADTT (linear between 100, 1000 and 5000; unknown: the ≥ 5000 row). Special: the fixed
     value of its type, for every ADTT. Every value read against the 4th Ed. table, 2026-11-23 (verified: true). The table's columns are
     GVW/AL below 2.0, between 2.0 and 3.0, above 3.0: a ratio of exactly 2.0 takes the first column and exactly 3.0 the third (the table does not
     say; open item). Returns { g, df ('multi' | 'one'), col, verified } */
  function gammaPermit(type, adtt, wr) {
    const T = PERMIT_TYPES.find(t => t.id === type) || PERMIT_TYPES[0];
    if (T.id !== 'routine') return { g: T.gam, df: 'one', col: null, verified: true };
    const col = (wr == null || !(wr > 2.0)) ? 0 : (wr < 3.0 ? 1 : 2), R = PERMIT_ROUTINE.map(([a, f]) => [a, f[col]]), A = (adtt == null || adtt === '' || !(+adtt >= 0)) ? 5000 : +adtt;
    let g; if (A >= R[0][0]) g = R[0][1]; else if (A <= R[2][0]) g = R[2][1]; else { const [hi, lo] = A >= R[1][0] ? [R[0], R[1]] : [R[1], R[2]]; g = lo[1] + (hi[1] - lo[1]) * (A - lo[0]) / (hi[0] - lo[0]); }
    return { g, df: 'multi', col, verified: true };
  }
  /* LANE_W: the equivalent truck weight (kip) of the lane-type legal load model for the rated load and the posting equation (MBE Arts. 6A.4.4.4,
     6A.8.3): 80 kip = 40 tons, whatever the 75 % axles add up to */
  const LANE_W = 80;
  /* the vehicles offered (keys of shared/vehicles.js presets), by group; short: the name used in tables */
  const VEH_GROUPS = [
    { id: 'legal', title: 'AASHTO legal loads (MBE Figs. D6A-1 to D6A-3)', keys: ['Type3', 'Type3S2', 'Type3-3'] },
    { id: 'lane', title: 'Lane-type legal load model (MBE Art. 6A.4.4.2.1a; Figs. D6A-4, D6A-5)', keys: ['Legal-Lane'] },
    { id: 'shv', title: 'Specialized hauling vehicles (MBE Art. 6A.4.4.2.1b; Fig. D6A-7)', keys: ['SU4', 'SU5', 'SU6', 'SU7'] },
    { id: 'ev', title: 'Emergency vehicles (FAST Act; FHWA memorandum 2016-11-03)', keys: ['EV2', 'EV3'] },
    { id: 'owner', title: 'Owner legal vehicles', keys: ['H20-Legal', 'RIPTA'] }];
  const VEH_SHORT = { Type3: 'Type 3', Type3S2: 'Type 3S2', 'Type3-3': 'Type 3-3', 'Legal-Lane': 'Lane-type legal model', SU4: 'SU4', SU5: 'SU5', SU6: 'SU6', SU7: 'SU7', EV2: 'EV2', EV3: 'EV3', 'H20-Legal': 'Legal H20', RIPTA: 'RIPTA bus', 'CT-TLC': 'CT-TLC' };
  const PERMIT_KEYS = ['CT-TLC', 'Type3', 'Type3S2', 'Type3-3', 'SU4', 'SU5', 'SU6', 'SU7', 'EV2', 'EV3', 'H20-Legal', 'RIPTA'];
  /* parseAxles(text): a user axle train "P@s, P@s, …" (kip at the spacing in ft from the axle before; the first spacing is 0 and may be left
     out: "12, 12@15, 12@4"). Returns { axles [[P, s]…] } or { err } */
  function parseAxles(text) {
    const parts = String(text == null ? '' : text).split(/[,;\n]+/).map(t => t.trim()).filter(Boolean); if (!parts.length) return { err: 'Enter the axle train: load@spacing, … (kip, ft), e.g. 12@0, 20@12, 20@4.5.' };
    const axles = [];
    for (let i = 0; i < parts.length; i++) { const m = /^([0-9.]+)\s*(?:@\s*([0-9.]+))?$/.exec(parts[i]); if (!m) return { err: `Axle ${i + 1} ("${parts[i]}") is not load@spacing (kip, ft).` };
      const Pk = +m[1], sp = m[2] != null ? +m[2] : 0; if (!(Pk > 0)) return { err: `Axle ${i + 1}: the load must be more than 0.` }; if (i > 0 && !(sp > 0)) return { err: `Axle ${i + 1}: the spacing from the axle before must be more than 0.` };
      axles.push([Pk, i === 0 ? 0 : sp]); }
    if (axles.length > 40) return { err: 'At most 40 axles.' };
    return { axles };
  }
  /* vehicleList(veh, presets, opt): the vehicles to rate from the saved choice veh = P.rating.veh { on: [keys], imL, imP (percent; blank 33),
     evG ('legal' | 'fhwa'), permit: { key ('' none | preset key | 'custom'), type, gam ('' = table), axles (text), name } }; presets =
     SharedVehicles.build().presets; opt = { adtt }. Each: { key, id, cat, label, short, axles, udl, multi, neglect, W (kip), tons, im, lim,
     G (factors() override: γ_LL Strength and Service II, one RF), gam, gamS, gRef, df ('multi' | 'one'), post (posting applies), notes [] }.
     Nothing chosen (veh absent, or nothing ticked and no permit vehicle): an empty list. */
  function vehicleList(veh, presets, opt) {
    const V = veh || {}, on = Array.isArray(V.on) ? V.on : [], adtt = opt && opt.adtt, out = { list: [], err: [] };
    const im = v => (v !== '' && v != null && +v >= 0 ? +v : 33), gL = gammaLegal(adtt), aTxt = adtt == null || adtt === '' || !(+adtt >= 0) ? 'ADTT unknown' : `ADTT ${n2(+adtt).replace(/\.00$/, '')}`;
    const tabL = `${MBE} Table 6A.4.4.2.3a-1`, tabS = `${MBE} Table 6A.4.4.2.3b-1`, Wof = ax => ax.reduce((a, q) => a + q[0], 0);
    VEH_GROUPS.forEach(Gp => Gp.keys.forEach(key => { const p = presets[key]; if (!p || !on.includes(key)) return;
      const ev = Gp.id === 'ev', fh = ev && V.evG === 'fhwa', g = fh ? 1.30 : gL, lane = Gp.id === 'lane', W = Wof(p.axles);
      const gRef = fh ? 'FHWA memorandum, Load Rating for the FAST Act Emergency Vehicles (2016-11-03): γ_LL = 1.30' : `${Gp.id === 'shv' ? tabS : tabL} (${aTxt})${ev ? '; the legal-load factor is used for the emergency vehicle (conservative default)' : ''}`;
      const itp = !fh && +adtt > 1000 && +adtt < 5000, gStep = itp ? { eq: '1.30 + (1.45 - 1.30)\\frac{ADTT - 1000}{5000 - 1000}', sub: `1.30 + 0.15\\frac{${Math.round(+adtt)} - 1000}{4000}`, note: 'Linear between ADTT 1000 (1.30) and 5000 (1.45); ADTT one direction, from the Fatigue & studs inputs.' }
        : { note: fh ? 'FHWA memorandum, Load Rating for the FAST Act Emergency Vehicles (2016-11-03).' : 'ADTT one direction, from the Fatigue & studs inputs: 1.30 at ADTT ≤ 1000, 1.45 at ADTT ≥ 5000 or unknown.' };
      if (ev && !fh) gStep.note += ' The legal-load factor is used for the emergency vehicle (conservative default; the FHWA memorandum of 2016-11-03 gives 1.30).';
      const cite = fh ? 'FHWA memorandum (2016-11-03)' : Gp.id === 'shv' ? tabS : tabL;
      out.list.push({ key, id: key, cat: Gp.id, label: p.label, short: VEH_SHORT[key] || key, axles: p.axles.map(a => [...a]), udl: { ...p.udl }, multi: { ...p.multi }, neglect: !!p.neglect, W, tons: lane ? LANE_W / 2 : W / 2, Weq: lane ? LANE_W : null, im: im(V.imL), lim: 'Strength I',
        gam: g, gamS: 1.30, gRef, df: 'multi', post: Gp.id === 'legal' || Gp.id === 'shv' || lane, kind: 'Legal load',
        G: { inv: g, opr: g, sInv: 1.30, sOpr: 1.30, one: lane ? 'Legal load (lane-type model)' : ev ? 'Emergency vehicle' : 'Legal load', gRef: cite, gStep, sRef: `${MBE} Table 6A.4.2.2-1`, sNote: 'Steel, Service II, legal load: 1.30.' } }); }));
    const Pm = V.permit || {};
    if (Pm.key) {
      let ax = null, label = '', short = '', udl = { mode: 'none', w: 0, gap: 0, trunc: false }, neglect = true, imDef = null;
      if (Pm.key === 'custom') { const q = parseAxles(Pm.axles); if (q.err) out.err.push('Permit vehicle (entered axle train): ' + q.err); else { ax = q.axles; short = String(Pm.name || '').trim() || 'Permit vehicle (entered)'; label = `${short}: ${ax.map(a => `${a[0]}@${a[1]}`).join(', ')} (kip @ ft)`; } }
      else if (presets[Pm.key]) { const p = presets[Pm.key]; ax = p.axles.map(a => [...a]); label = p.label; short = VEH_SHORT[Pm.key] || Pm.key; neglect = !!p.neglect; if (p.imp && p.imp.method === 'const' && p.imp.val === 1) imDef = 0; }
      else out.err.push(`Permit vehicle "${Pm.key}" is not in shared/vehicles.js.`);
      if (ax) { const wr = weightRatio(ax), T = gammaPermit(Pm.type, adtt, wr.wr), ent = Pm.gam !== '' && Pm.gam != null && +Pm.gam > 0, g = ent ? +Pm.gam : T.g, ty = PERMIT_TYPES.find(t => t.id === Pm.type) || PERMIT_TYPES[0];
        const gRef = ent ? `γ_LL entered (${MBE} Table 6A.4.5.4.2a-1 gives ${n2(T.g)} for this permit type)` : T.df === 'multi' ? `${MBE} Table 6A.4.5.4.2a-1, routine or annual (${aTxt}; GVW/AL = ${wr.wr == null ? 'n/a' : n2(wr.wr)} kip/ft, column ${['≤ 2.0', '2.0 to 3.0', '≥ 3.0'][T.col]})`
          : `${MBE} Table 6A.4.5.4.2a-1, special or limited crossing (${ty.id === 'multi' ? 'multiple trips, fewer than 100 crossings' : ty.id === 'trip-mixed' ? 'single trip, mixed with traffic' : 'single trip, escorted, no other vehicle on the bridge'})`;
        const imP = V.imP !== '' && V.imP != null && +V.imP >= 0 ? +V.imP : imDef != null ? imDef : 33;
        out.list.push({ key: 'permit:' + Pm.key, id: Pm.key, cat: 'permit', label, short: `Permit: ${short}`, axles: ax, udl, multi: { on: false }, neglect, W: wr.gvw, tons: wr.gvw / 2, im: imP, imPreset: imDef, lim: 'Strength II', gam: g, gamS: 1.00, gRef, df: T.df, dfS: ty.dfS, mixed: ty.mixed, post: false, kind: 'Permit load',
          ptype: ty, wr, verified: ent ? null : T.verified,
          G: { inv: g, opr: g, sInv: 1.00, sOpr: 1.00, one: 'Permit load', gRef: `${MBE} Table 6A.4.5.4.2a-1`, gStep: { note: `${gRef.replace(MBE + ' ', '')}. ` + (ent ? 'Entered by the engineer.' : T.df === 'multi' ? 'Routine or annual permits: the column by GVW/AL (not interpolated between columns), the row by ADTT (linear between 100, 1000 and 5000; one direction, from the Fatigue & studs inputs).' : 'Special or limited-crossing permit: one value for every ADTT; rated at Strength II with the one-lane distribution factor without the multiple presence factor.') }, sRef: `${MBE} Table 6A.4.2.2-1`, sNote: `Steel, Service II, permit load: 1.00 (an optional check in the table). Distribution factor at Service II: ${ty.dfS === 'one' ? 'one lane without the multiple presence factor (escorted permit, no other vehicle on the bridge)' : 'the design factor (the permit mixes with traffic)'} (MBE C6A.6.4.2.2).` } }); }
    }
    return out;
  }
  /* vehicleLL(R, run, v): the LL+IM of vehicle v per girder at the stations of the analysis R (engine/analysis.js analyzeGirder), from its per-lane
     envelopes run (R.vehicle(...)): × the distribution factors of R: v.df 'multi' the design factors (R.ll.gM, gVR, gVL: the governing of one and
     of two or more lanes loaded, the shear skew correction as the design uses it), 'one' the one-lane factors without the multiple presence factor
     (R.fat.gM, gVR, gVL: g_1 / 1.2). The lane-type model (v.cat 'lane') is masked to where MBE 6A.4.4.2.1a calls for it: negative moment where the
     girder is continuous; shear at the stations of the pier regions (R.region ≥ 1) where continuous; every effect at stations of a span longer than
     200 ft. runLane (a permit vehicle, optional; given only when permitLane() says the lane load applies): the same vehicle run with a 0.2 klf lane
     load on top (MBE Art. 6A.4.5.4.1: closely leading and following vehicles), used for negative moment where the girder is continuous, for the
     shear at the stations of the pier regions (R.region ≥ 1: between the points of contraflexure over the interior supports) where continuous,
     and for every effect at stations of a span longer than 200 ft (the MBE names spans of 200 to 300 ft; kept above 300 ft, conservative).
     Returns { ll: { Mpos, Mneg, VRpos, VRneg, VLpos, VLneg }, g: { M, VR, VL }, per (the per-lane values used), at (their governing cases),
     withLane (true where the lane-load run is used), applies (any effect kept), over200 [span…] } */
  function vehicleLL(R, run, v, runLane) {
    const src = v.df === 'one' ? R.fat : R.ll, g = { M: src.gM, VR: src.gVR, VL: src.gVL }, N = R.x.length, sup = R.sup, ns = sup.length - 1;
    const long = k => k >= 0 && k < ns && sup[k + 1] - sup[k] > 200 + 1e-9, spansAt = x => { const o = []; for (let k = 0; k < ns; k++) if (x >= sup[k] - 1e-6 && x <= sup[k + 1] + 1e-6) o.push(k); return o; };
    const lane = v.cat === 'lane', far = R.x.map(x => spansAt(x).some(long)), big = far.map(b => !lane || b), pier = R.x.map((_, i) => !lane || (!!R.cont && R.region && R.region[i] >= 1));
    // a permit vehicle with the 0.2 klf lane load (runLane; MBE 6A.4.5.4.1): negative moment where continuous, the shear of the pier regions where
    // continuous (added 2026-11-23, MBV: the article lists the shear between the points of contraflexure over the interior supports), every effect
    // in a span over 200 ft
    const inPier = i => !!R.cont && !!R.region && R.region[i] >= 1;
    const useL = (key, i) => !!runLane && (far[i] || (key === 'Mmin' && !!R.cont) || (key.charAt(0) === 'V' && inPier(i))), per = {}, at = {}, wl = {};
    ['Mmax', 'Mmin', 'VRmax', 'VRmin', 'VLmax', 'VLmin'].forEach(key => { per[key] = []; at[key] = []; wl[key] = [];
      for (let i = 0; i < N; i++) { const L = useL(key, i), q = L ? runLane : run; per[key].push(q.perLane[key][i]); at[key].push(q.at ? q.at[key][i] : null); wl[key].push(L); } });
    const mk = (key, gk, keep) => per[key].map((val, i) => (keep(i) ? g[gk][i] * val : 0));
    const ll = { Mpos: mk('Mmax', 'M', i => big[i]), Mneg: mk('Mmin', 'M', i => !lane || big[i] || !!R.cont), VRpos: mk('VRmax', 'VR', i => big[i] || pier[i]), VRneg: mk('VRmin', 'VR', i => big[i] || pier[i]),
      VLpos: mk('VLmax', 'VL', i => big[i] || pier[i]), VLneg: mk('VLmin', 'VL', i => big[i] || pier[i]) };
    const over200 = []; for (let k = 0; k < ns; k++) if (long(k)) over200.push(k + 1);
    return { ll, g, per, at, withLane: wl, applies: !lane || !!R.cont || over200.length > 0, over200 };
  }
  /* laneModelNeeded(spans, cont): does MBE 6A.4.4.2.1a call for the lane-type legal load model on this girder (a span over 200 ft, or continuous) */
  function laneModelNeeded(spans, cont) { return (!!cont && spans.length > 1) || spans.some(L => L > 200 + 1e-9); }
  /* permitLane(v, adtt, spans, cont): is the 0.2 klf lane load of MBE Art. 6A.4.5.4.1 run with permit vehicle v? Required for bridges with an ADTT
     above 500 (one direction; unknown ADTT: taken as above 500), for every effect of spans over 200 ft and for negative moment, shear between the
     points of contraflexure and reactions at the interior supports of continuous spans; not needed for a permit that excludes other vehicles from
     the bridge (C6A.4.5.4.1: the escorted type, v.mixed false). Returns { on, why (plain text) } */
  function permitLane(v, adtt, spans, cont) {
    if (!v || v.cat !== 'permit') return { on: false, why: '' };
    if (!laneModelNeeded(spans, cont)) return { on: false, why: 'No 0.2 klf lane load with the permit vehicle: simple spans of 200 ft or less (MBE Art. 6A.4.5.4.1).' };
    if (v.mixed === false) return { on: false, why: 'No 0.2 klf lane load with the permit vehicle: the escorted permit excludes other vehicles from the bridge (MBE C6A.4.5.4.1).' };
    const known = adtt != null && adtt !== '' && +adtt >= 0;
    if (known && !(+adtt > 500)) return { on: false, why: `No 0.2 klf lane load with the permit vehicle: ADTT ${Math.round(+adtt)} (one direction) is not above 500 (MBE Art. 6A.4.5.4.1).` };
    return { on: true, why: `A 0.2 klf lane load (no IM) is on top of the permit vehicle for negative moment and the shear of the pier regions of continuous spans and for every effect in spans over 200 ft: ${known ? `ADTT ${Math.round(+adtt)} (one direction) is above 500` : 'ADTT unknown, taken as above 500'} (MBE Art. 6A.4.5.4.1).` };
  }
  /* posting(W, RF): MBE Eq. 6A.8.3-1 for a legal load of weight W (tons): RF ≥ 1 none; 0.3 < RF < 1: (W/0.7)(RF − 0.3); RF ≤ 0.3: the equation
     does not apply (6A.8.3: consider closing the bridge) */
  function posting(W, RF) { if (!(RF < 1 - 1e-9) && !Number.isNaN(RF)) return { st: 'ok' }; if (!(RF > 0.3)) return { st: 'close' }; return { st: 'post', P: W / 0.7 * (RF - 0.3) }; }
  /* vehTarget(owner, id): the owner's rating target of a legal / permit vehicle (OWN9; engine/owners.js rate.*): RIDOT 3.4.1.2 every rating
     vehicle RF ≥ 1.10; CTDOT V1B legal, permit and emergency vehicles RF ≥ 1.20, the CT-TLC paving train RF ≥ 1.10; else none. Reported only. */
  function vehTarget(owner, id) { const T = target(owner); if (!T || !T.rf) return null; return { need: owner === 'CTDOT' && id === 'CT-TLC' ? 1.10 : T.rf, cite: T.cite }; }

  /* BASIS: the MBE 4th Ed. basis notes shown on the Rating tab, the Summary tab, the left summary column and the Report (§6 / #1284;
     plain text, HTML-safe). */
  const BASIS = {
    svc: 'Service II flange limit f_R = 0.95F_yf for composite sections (negative flexure included; no hybrid factor R_h) and 0.80R_hF_yf for noncomposite sections (MBE 4th Ed. Art. 6A.6.4.2.2, p. 6-66).',
    shear: 'Shear at the Strength limit state takes the system factor φ_s = 1.0 (MBE 4th Ed. Art. 6A.4.2.4, p. 6-25): C = φ_cφ_vV_n; the entered φ_s applies to flexure (C = φ_cφ_sφ_fR_n, φ_cφ_s ≥ 0.85, Eq. 6A.4.2.1-3).' };
  BASIS.short = 'Rating per MBE 4th Ed. (2026): Service II f_R = 0.95F_yf composite, 0.80R_hF_yf noncomposite (6A.6.4.2.2); φ_s = 1.0 on shear (6A.4.2.4).';
  window.SBDRating = { MBE, BASIS, factors, phi, rf, kAt, flexure, service, shear, shearCases, noDoublePL, fatigue, target, girder,
    gammaLegal, gammaPermit, weightRatio, parseAxles, vehicleList, vehicleLL, laneModelNeeded, permitLane, LANE_W, posting, vehTarget, VEH_GROUPS, VEH_SHORT, PERMIT_TYPES, PERMIT_KEYS };
})();
