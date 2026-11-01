/* apps/steel-bridge/engine/shear.js — web shear of a steel I-girder, AASHTO LRFD 10th Ed. Art. 6.10.9, with the special fatigue
   requirement for webs 6.10.5.3 and the deck-placement web shear 6.10.3.3 (window.SBDShear). Classic script, no DOM.
   Needs window.SharedSteps (shared/steps.js), loaded first.

   Ported 2026-10-29 from GirderDetail ("Steel Bridge Design.html"):
     - webShear(D, tw, Fyw, doIn, flgA, end) (anchor `function webShear(`), with A610_shearC and A610_Vp (anchor
       `function A610_shearC(`): stiffened when d_o <= 3D (interior) or d_o <= 1.5D (end panel), else unstiffened (k = 5);
       end panels V_n = CV_p; interior stiffened panels with tension-field action (Eq. 6.10.9.3.2-2, or -8 when
       2Dt_w/(b_fc t_fc + b_ft t_ft) > 2.5);
     - Preliminary sizing's tsVn (anchor `function tsVn(`): the same equations with the tension field optional, per panel;
     - Girder section module GM.gs: the shear lines of compute() (V_u, V_u of the web panel VuP, V_u of deck placement VuC,
       r.sh, V_u of the special fatigue loading VuF) and the checks GS11 (6.10.9), GS16 (6.10.3.3) and GS18 (6.10.5.3);
     - Preliminary sizing's Strength I shear per element (VuE in the analysis: minimum factors where a permanent load relieves
       the extreme) for the largest V_u in a panel.
   Arithmetic copied operation for operation; tests/engine/shear.test.mjs checks it against GirderDetail's own functions in Node.

   End panels (S2-4, #455; engineer decision 2026-10-22, GirderDetail's method): V_n = V_cr = CV_p (6.10.9.3.3) only in the
   panel next to an abutment bearing, or next to any bearing of a simple span (C6.10.9.3.3). A panel next to an interior pier
   is an interior panel and uses the tension field. The end flag comes from the stiffener layout (engine/stiffeners.js).

   Units: shears kip, plates and d_o in, stations ft, stresses ksi. φ_v = 1.0 (6.5.4.2). E = 29,000 ksi (as GirderDetail). */
(function () {
  'use strict';
  const ES = 29000, ED = 'AASHTO LRFD 10th Ed.', PHIV = 1.0;
  const St = () => window.SharedSteps;
  const n2 = x => St().n(x, 2), n3 = x => St().n(x, 3), n4 = x => St().n(x, 4), g1 = x => St().g(x, 1);

  /* ---------- nominal resistance (GirderDetail, unchanged) ---------- */
  /* shearC(lam, r, E, k, Fyw): C, the ratio of the shear-buckling resistance to the shear yield strength, Eqs. 6.10.9.3.2-4 to -6
     (lam = D/t_w, r = √(Ek/F_yw)). */
  function shearC(lam, r, E, k, Fyw) { return lam <= 1.12 * r ? 1 : lam <= 1.40 * r ? 1.12 * r / lam : 1.57 / lam ** 2 * (E * k / Fyw); }
  /* plasticShear(Fyw, D, tw): V_p = 0.58F_ywDt_w, Eq. 6.10.9.3.2-3. */
  function plasticShear(Fyw, D, tw) { return 0.58 * Fyw * D * tw; }
  /* webShear: GirderDetail's webShear (Transverse stiffeners TS4, Girder section GS11). doIn = 0: no stiffener (unstiffened).
     flgA = b_fc t_fc + b_ft t_ft (in^2). Returns { k, C, Vp, Vn, Vcr, stiff, eqn, rat, lam }. */
  function webShear(D, tw, Fyw, doIn, flgA, end) {
    const stiff = doIn > 0 && doIn <= (end ? 1.5 : 3) * D + 1e-9, k = stiff ? 5 + 5 / (doIn / D) ** 2 : 5, lam = D / tw, r = Math.sqrt(ES * k / Fyw);
    const C = shearC(lam, r, ES, k, Fyw), Vp = plasticShear(Fyw, D, tw);
    let Vn, eqn, rat = 2 * D * tw / flgA;
    if (!stiff || end) { Vn = C * Vp; eqn = end && stiff ? '6.10.9.3.3-1' : '6.10.9.2-1'; }
    else { const dD = doIn / D; Vn = rat <= 2.5 ? Vp * (C + 0.87 * (1 - C) / Math.sqrt(1 + dD ** 2)) : Vp * (C + 0.87 * (1 - C) / (Math.sqrt(1 + dD ** 2) + dD)); eqn = rat <= 2.5 ? '6.10.9.3.2-2' : '6.10.9.3.2-8'; }
    return { k, C, Vp, Vn, Vcr: C * Vp, stiff, eqn, rat, lam };
  }
  /* tsVn: Preliminary sizing's per-panel resistance (TB1): as webShear, with the tension field optional (tfa false: V_n = CV_p). */
  function tsVn(D, tw, Fyw, dIn, end, rat, tfa) {
    const stiff = dIn > 0 && dIn <= (end ? 1.5 : 3) * D + 1e-9, k = stiff ? 5 + 5 / (dIn / D) ** 2 : 5, lam = D / tw, r = Math.sqrt(ES * k / Fyw);
    const C = shearC(lam, r, ES, k, Fyw), Vp = plasticShear(Fyw, D, tw), o = { k, C, Vp, lam, stiff, end: !!end, tfa: false, tf: 0, d: dIn };
    if (!stiff) return { ...o, Vn: C * Vp, eq: '6.10.9.2-1' };
    if (end) return { ...o, Vn: C * Vp, eq: '6.10.9.3.3-1' };
    if (!tfa) return { ...o, Vn: C * Vp, eq: '6.10.9.3.2, V_cr = CV_p (no tension field)' };
    const dD = dIn / D, eq2 = rat <= 2.5, tf = eq2 ? 0.87 * (1 - C) / Math.sqrt(1 + dD ** 2) : 0.87 * (1 - C) / (Math.sqrt(1 + dD ** 2) + dD);
    return { ...o, Vn: Vp * (C + tf), tfa: true, tf, rat, eq: eq2 ? '6.10.9.3.2-2' : '6.10.9.3.2-8' };
  }

  /* ---------- worked steps of one panel ---------- */
  /* panelSteps(w, id, o): the steps of webShear / tsVn result o for the panel (D, tw, Fyw, doIn, end, flgA). Returns the step id of V_n. */
  function panelSteps(w, id, o, a) {
    const { D, tw, Fyw, doIn, end } = a, lim = (end ? 1.5 : 3) * D, r = Math.sqrt(ES * o.k / Fyw);
    w.add({ id: id + '.st', label: `Stiffened or unstiffened panel (${end ? 'end panel: d_o ≤ 1.5D' : 'interior panel: d_o ≤ 3D'})`, sym: 'd_{o}', eq: doIn > 0 ? `d_{o} ${o.stiff ? '\\le' : '\\gt'} ${end ? '1.5' : '3'}D` : '\\text{no transverse stiffener}', sub: doIn > 0 ? `${n2(doIn)} ${o.stiff ? '\\le' : '\\gt'} ${n2(lim)}` : '', value: o.stiff ? 'stiffened' : 'unstiffened', unit: '', d: 0, ref: `${ED} Art. 6.10.9.1${end ? ', 6.10.9.3.3' : ''}`, note: end ? 'End panel: the panel next to an abutment bearing or a bearing of a simple span (C6.10.9.3.3; S2-4).' : '' });
    w.add({ id: id + '.k', label: 'Shear-buckling coefficient', sym: 'k', eq: o.stiff ? '5 + \\frac{5}{(d_{o}/D)^{2}}' : '5', sub: o.stiff ? `5 + \\frac{5}{(${n2(doIn)}/${n2(D)})^{2}}` : '5', value: o.k, unit: '', d: 3, ref: o.stiff ? `${ED} Eq. 6.10.9.3.2-7` : `${ED} Art. 6.10.9.2` });
    const cs = o.lam <= 1.12 * r ? 1 : o.lam <= 1.40 * r ? 2 : 3;
    w.add({ id: id + '.C', label: `Ratio of shear-buckling resistance to shear yield strength (D/t_w = ${n2(o.lam)}, 1.12√(Ek/F_yw) = ${n2(1.12 * r)}, 1.40√(Ek/F_yw) = ${n2(1.40 * r)})`, sym: 'C',
      eq: cs === 1 ? '1.0' : cs === 2 ? '\\frac{1.12}{D/t_{w}}\\sqrt{\\frac{Ek}{F_{yw}}}' : '\\frac{1.57}{(D/t_{w})^{2}}\\left(\\frac{Ek}{F_{yw}}\\right)',
      sub: cs === 1 ? '' : cs === 2 ? `\\frac{1.12}{${n2(o.lam)}}\\sqrt{\\frac{29{,}000(${n3(o.k)})}{${n2(Fyw)}}}` : `\\frac{1.57}{(${n2(o.lam)})^{2}}\\left(\\frac{29{,}000(${n3(o.k)})}{${n2(Fyw)}}\\right)`,
      value: o.C, unit: '', d: 4, ref: `${ED} Eq. 6.10.9.3.2-${cs + 3}` });
    w.add({ id: id + '.Vp', label: 'Plastic shear force', sym: 'V_{p}', eq: '0.58F_{yw}Dt_{w}', sub: `0.58(${n2(Fyw)})(${n2(D)})(${n4(tw)})`, value: o.Vp, unit: 'kip', d: 2, ref: `${ED} Eq. 6.10.9.3.2-3` });
    w.add({ id: id + '.Vcr', label: 'Shear-buckling resistance', sym: 'V_{cr}', eq: 'CV_{p}', sub: `${n4(o.C)}(${n2(o.Vp)})`, value: o.C * o.Vp, unit: 'kip', d: 2, ref: `${ED} Eq. 6.10.9.3.3-1` });
    const tf = o.stiff && !end && (o.tfa === undefined || o.tfa);
    if (tf) {
      const dD = doIn / D, eq2 = o.rat <= 2.5;
      w.add({ id: id + '.rat', label: 'Section proportion for the tension field', sym: '\\frac{2Dt_{w}}{b_{fc}t_{fc} + b_{ft}t_{ft}}', eq: '', sub: `\\frac{2(${n2(D)})(${n4(tw)})}{${n2(a.flgA)}}`, value: o.rat, unit: '', d: 3, ref: `${ED} Eq. 6.10.9.3.2-1`,
        note: eq2 ? '≤ 2.5: Eq. 6.10.9.3.2-2 (full tension field).' : '> 2.5: Eq. 6.10.9.3.2-8.' });
      w.add({ id: id + '.Vn', label: 'Nominal shear resistance, interior stiffened panel with tension-field action', sym: 'V_{n}',
        eq: eq2 ? 'V_{p}\\left[C + \\frac{0.87(1 - C)}{\\sqrt{1 + (d_{o}/D)^{2}}}\\right]' : 'V_{p}\\left[C + \\frac{0.87(1 - C)}{\\sqrt{1 + (d_{o}/D)^{2}} + d_{o}/D}\\right]',
        sub: eq2 ? `${n2(o.Vp)}\\left[${n4(o.C)} + \\frac{0.87(1 - ${n4(o.C)})}{\\sqrt{1 + (${n4(dD)})^{2}}}\\right]` : `${n2(o.Vp)}\\left[${n4(o.C)} + \\frac{0.87(1 - ${n4(o.C)})}{\\sqrt{1 + (${n4(dD)})^{2}} + ${n4(dD)}}\\right]`,
        value: o.Vn, unit: 'kip', d: 2, ref: `${ED} Eq. 6.10.9.3.2-${eq2 ? 2 : 8}` });
    } else {
      w.add({ id: id + '.Vn', label: o.stiff ? (end ? 'Nominal shear resistance, end panel (no tension field)' : 'Nominal shear resistance, tension field not used') : 'Nominal shear resistance, unstiffened web', sym: 'V_{n}', eq: 'V_{cr} = CV_{p}', sub: `${n4(o.C)}(${n2(o.Vp)})`, value: o.Vn, unit: 'kip', d: 2,
        ref: o.stiff ? (end ? `${ED} Eq. 6.10.9.3.3-1` : `${ED} Art. 6.10.9.3.2`) : `${ED} Eq. 6.10.9.2-1` });
    }
    return id + '.Vn';
  }

  /* ---------- load factors ---------- */
  /* factors(over): GirderDetail's Girder section defaults (Strength I γ_DC 1.25, γ_DW 1.50, LL+IM 1.75; Fatigue I 1.75; deck placement
     γ_DC 1.25, construction LL 1.50). factorsOwner(lf): the same with the owner's load rules (OWN_K.gs: η on the maximum γ_DC, γ_DW,
     η_N on the minimum ones, η·m on γ_LL; Fatigue I and deck placement unchanged), lf = SBDOwners.loadFactors(...) or { eta, m }. */
  function factors(over) { const C = window.SBDConstr && window.SBDConstr.factors ? window.SBDConstr.factors() : { cdc: 1.25, ccl: 1.50 };   // FONE: deck placement from the Constructibility module (one source)
    return { dc: 1.25, dw: 1.50, dcMin: 0.90, dwMin: 0.65, ll: 1.75, fat: 1.75, cdc: C.cdc, ccl: C.ccl, m: 1, ...(over || {}) }; }
  function factorsOwner(lf, over) { const G = factors(over), e = (lf && +lf.eta > 0) ? +lf.eta : 1, eN = (lf && +lf.etaN > 0) ? +lf.etaN : 1, m = (lf && +lf.m > 0) ? +lf.m : 1;
    return { ...G, dc: G.dc * e, dw: G.dw * e, dcMin: G.dcMin * eN, dwMin: G.dwMin * eN, ll: G.ll * e * m, m }; }

  /* pedestrian part (GirderDetail gdPLe, GD45): the design load multiplier m is on HL-93 LL+IM only. A demand that carries
     pl = { key: [part, value] } has the part divided back by m (V_LL − q + q/m) while it still equals the value given. */
  function plAdjust(src, r, keys, m) {
    if (!(m > 0) || m === 1 || !src || !src.pl) return r;
    keys.forEach(k => { const q0 = src.pl[k], q = Array.isArray(q0) && q0.length === 2 && isFinite(+q0[0]) && +q0[0] !== 0 && Math.abs(+src[k] - +q0[1]) < 1e-6 ? +q0[0] : 0;
      if (!q || typeof r[k] !== 'number' || !isFinite(r[k])) return; const v0 = r[k]; r[k] = v0 - q + q / m; (r.plAdj || (r.plAdj = [])).push({ k, v0, q, v: r[k] }); });
    return r;
  }

  /* ---------- a location (GirderDetail Girder section: shear lines of compute, GS11, GS16, GS18) ---------- */
  /* location(L, prj)
     L = { name, x (ft, optional), plates: { D, tw, topB, topT, botB, botT }, do (in, 0 = no stiffener), end: true | false (end panel),
           V: { DC1, DC2, DW, LL, UT, UF, CL, f } (unfactored magnitudes, kip; f: fatigue truck, max.),
           Vpan: optional { DC1, DC2, DW, LL, UT, UF }: the largest shears in the web panel containing the location (6.10.9.3.1),
           pl: optional pedestrian parts { VLL: [part, value], VLLp: [...] } }
     prj = { mat: { Fyw }, G: factors() or factorsOwner() }
     Returns { name, x, sh, Vu, VuP, VuF, VuC, V, checks, gov, steps }. */
  function location(L, prj) {
    const G = factors(prj.G), p = L.plates, Fyw = prj.mat.Fyw, V0 = L.V || {}, num = v => +v || 0;
    const r = { name: L.name, x: L.x, D: p.D, tw: p.tw, topB: p.topB, topT: p.topT, botB: p.botB, botT: p.botT, Fyw, do: num(L.do), end: !!L.end };
    const v = { VDC1: num(V0.DC1), VDC2: num(V0.DC2), VDW: num(V0.DW), VLL: num(V0.LL), VUT: num(V0.UT), VUF: num(V0.UF), VCL: num(V0.CL), Vf: num(V0.f) };
    const P = L.Vpan ? { VDC1p: num(L.Vpan.DC1), VDC2p: num(L.Vpan.DC2), VDWp: num(L.Vpan.DW), VLLp: num(L.Vpan.LL), VUTp: num(L.Vpan.UT), VUFp: num(L.Vpan.UF) } : null;
    Object.assign(r, v, P || {}); r.ut = !!(v.VUT || v.VUF);
    if (L.pl) plAdjust({ ...v, ...(P || {}), pl: L.pl }, r, ['VLL', 'VLLp'], G.m);
    r.Vu = G.dc * (r.VDC1 + r.VDC2) + G.dw * r.VDW + G.ll * r.VLL + G.dw * r.VUT + G.dc * r.VUF;
    r.VuP = P ? Math.max(r.Vu, G.dc * (r.VDC1p + r.VDC2p) + G.dw * r.VDWp + G.ll * r.VLLp + G.dw * r.VUTp + G.dc * r.VUFp) : null;
    r.VuC = G.cdc * r.VDC1 + G.ccl * r.VCL;
    r.flgA = p.botB * p.botT + p.topB * p.topT;
    r.sh = webShear(p.D, p.tw, Fyw, r.do, r.flgA, r.end);
    r.VuF = r.VDC1 + r.VDC2 + r.VDW + r.VUT + r.VUF + G.fat * r.Vf;
    r.G = G;
    // checks
    const ck = o => ({ ratio: o.demand / o.capacity, ok: o.capacity >= o.demand - 1e-9, inUse: true, unit: 'kip', ...o });
    const V = r.VuP != null ? r.VuP : r.Vu;
    r.checks = [ck({ id: 'GS11', key: 'v', title: 'Shear, V_u ≤ φ_vV_n', ref: `${ED} Art. 6.10.9 (Eq. ${r.sh.eqn})`, demand: V, capacity: r.sh.Vn, step: 'sh.ok' }),
      ck({ id: 'GS16', key: 'vc', title: 'Deck placement, V_u ≤ φ_vV_cr', ref: `${ED} Eq. 6.10.3.3-1`, demand: r.VuC, capacity: r.sh.Vcr, step: 'sh.okC' })];
    if (r.sh.stiff && !r.end) r.checks.push(ck({ id: 'GS18', key: 'vf', title: 'Special fatigue requirement for webs, V_u ≤ V_cr', ref: `${ED} Art. 6.10.5.3`, demand: r.VuF, capacity: r.sh.Vcr, step: 'sh.okF' }));
    else r.checks.push({ id: 'GS18', key: 'vf', title: 'Special fatigue requirement for webs', ref: `${ED} Art. 6.10.5.3`, na: r.sh.stiff ? 'Not applicable: end panel (6.10.5.3 applies to interior panels of webs with transverse stiffeners).' : 'Not applicable: unstiffened web (6.10.5.3 applies to interior panels of webs with transverse stiffeners).', inUse: false, ratio: NaN, step: 'sh.okF' });
    // SB2-R2 guard: a non-finite ratio (not n/a) fails, says why and governs (was dropped by isFinite)
    r.checks.forEach(c => { if (c.na == null && c.ratio !== undefined && !isFinite(c.ratio)) { c.ok = false; c.ng = c.ng || (Number.isNaN(c.ratio) ? 'error: ratio is NaN' : 'NG: ratio unbounded'); } });
    const gr = c => (isFinite(c.ratio) ? c.ratio : Infinity);
    r.gov = r.checks.filter(c => c.inUse && c.na == null && c.ratio !== undefined && c.id !== 'GS16').reduce((b, c) => (!b || gr(c) > gr(b) ? c : b), null);
    Object.defineProperty(r, 'steps', { enumerable: false, configurable: true, get() { const s = worked(r); Object.defineProperty(r, 'steps', { value: s, enumerable: false }); return s; } });
    return r;
  }
  function worked(r) {
    const w = St().work('sh'), G = r.G, Fyw = r.Fyw, tbl = `${ED} Tables 3.4.1-1, 3.4.1-2`;
    const utT = (s, k) => r.ut ? ` + ${n2(G.dw)}(${n2(r['VUT' + s])})_{UT} + ${n2(G.dc)}(${n2(r['VUF' + s])})_{UF}` : '';
    // GD45 (sb-ped-owner PR): the pedestrian part of V_LL+IM without the owner multiplier m
    (r.plAdj || []).forEach(a => w.add({ id: 'pl.' + a.k, label: `${a.k === 'VLLp' ? 'Largest LL+IM shear in the web panel' : 'LL+IM shear'} used: m not on the pedestrian part`, sym: 'V_{LL+IM,used}', eq: 'V_{LL+IM+PL} - V_{PL} + \\frac{V_{PL}}{m}',
      sub: `${n2(a.v0)} - ${n2(a.q)} + \\frac{${n2(a.q)}}{${n2(G.m)}}`, value: a.v, unit: 'kip', d: 2, ref: `${ED} Art. 3.6.1.6, Table 3.4.1-1`, note: 'So that γ_LL ηm × it = γ_LL ηm V_LL+IM + γ_LL η V_PL (GirderDetail GD45). V_PL: Analysis tab.' }));
    w.add({ id: 'Vu', label: 'Strength I shear at the location', sym: 'V_{u}', eq: `\\gamma_{DC}(V_{DC1} + V_{DC2}) + \\gamma_{DW}V_{DW} + \\gamma_{LL}V_{LL+IM}${r.ut ? ' + \\gamma_{DW}V_{UT} + \\gamma_{DC}V_{UF}' : ''}`,
      sub: `${n2(G.dc)}(${n2(r.VDC1)} + ${n2(r.VDC2)}) + ${n2(G.dw)}(${n2(r.VDW)}) + ${n3(G.ll)}(${n2(r.VLL)})${utT('')}`, value: r.Vu, unit: 'kip', d: 2, ref: tbl, note: 'Shears are magnitudes: the maximum load factors.' });
    if (r.VuP != null) {
      const vp = G.dc * (r.VDC1p + r.VDC2p) + G.dw * r.VDWp + G.ll * r.VLLp + G.dw * r.VUTp + G.dc * r.VUFp;
      w.add({ id: 'VuPan', label: 'Strength I shear, the largest in the web panel', sym: 'V_{u,panel}', eq: '', sub: `${n2(G.dc)}(${n2(r.VDC1p)} + ${n2(r.VDC2p)}) + ${n2(G.dw)}(${n2(r.VDWp)}) + ${n3(G.ll)}(${n2(r.VLLp)})${utT('p')}`, value: vp, unit: 'kip', d: 2, ref: tbl });
      w.add({ id: 'VuP', label: 'Shear for the web panel check', sym: 'V_{u}', eq: '\\max(V_{u}, V_{u,panel})', sub: `\\max(${n2(r.Vu)}, ${n2(vp)})`, value: r.VuP, unit: 'kip', d: 2, ref: `${ED} Art. 6.10.9.3.1`, note: 'The largest shear in the panel (6.10.9.3.1).' });
    }
    w.add({ id: 'flgA', label: 'Flange areas', sym: 'b_{fc}t_{fc} + b_{ft}t_{ft}', eq: '', sub: `${n2(r.topB)}(${n4(r.topT)}) + ${n2(r.botB)}(${n4(r.botT)})`, value: r.flgA, unit: 'in^{2}', d: 3 });
    const vn = panelSteps(w, 'pan', r.sh, { D: r.D, tw: r.tw, Fyw, doIn: r.do, end: r.end, flgA: r.flgA });
    const V = r.VuP != null ? r.VuP : r.Vu, okv = (d, c) => c >= d - 1e-9;
    w.add({ id: 'ok', label: 'Shear resistance', sym: 'V_{u} \\le \\phi_{v}V_{n}', eq: '', sub: `${n2(V)} ${okv(V, r.sh.Vn) ? '\\le' : '\\gt'} 1.0(${n2(r.sh.Vn)})`, value: V / r.sh.Vn, unit: '', d: 3, ref: `${ED} Eq. 6.10.9.1-1`, ok: okv(V, r.sh.Vn), note: `See §${vn}. φ_v = 1.0 (6.5.4.2).` });
    w.add({ id: 'VuC', label: 'Deck placement shear', sym: 'V_{u}', eq: '\\gamma_{DC}V_{DC1} + \\gamma_{CL}V_{CL}', sub: `${n2(G.cdc)}(${n2(r.VDC1)}) + ${n2(G.ccl)}(${n2(r.VCL)})`, value: r.VuC, unit: 'kip', d: 2, ref: `${ED} Art. 3.4.2.1` });
    w.add({ id: 'okC', label: 'Deck placement: web shear (no tension field)', sym: 'V_{u} \\le \\phi_{v}V_{cr}', eq: '', sub: `${n2(r.VuC)} ${okv(r.VuC, r.sh.Vcr) ? '\\le' : '\\gt'} 1.0(${n2(r.sh.Vcr)})`, value: r.VuC / r.sh.Vcr, unit: '', d: 3, ref: `${ED} Eq. 6.10.3.3-1`, ok: okv(r.VuC, r.sh.Vcr) });
    w.add({ id: 'VuF', label: 'Special fatigue loading: unfactored permanent shear plus the Fatigue I shear', sym: 'V_{u}', eq: `V_{DC1} + V_{DC2} + V_{DW}${r.ut ? ' + V_{UT} + V_{UF}' : ''} + \\gamma V_{fat}`,
      sub: `${n2(r.VDC1)} + ${n2(r.VDC2)} + ${n2(r.VDW)}${r.ut ? ` + ${n2(r.VUT + r.VUF)}` : ''} + ${n2(G.fat)}(${n2(r.Vf)})`, value: r.VuF, unit: 'kip', d: 2, ref: `${ED} Art. 6.10.5.3, Table 3.4.1-1` });
    if (r.sh.stiff && !r.end) w.add({ id: 'okF', label: 'Special fatigue requirement for webs', sym: 'V_{u} \\le V_{cr}', eq: '', sub: `${n2(r.VuF)} ${okv(r.VuF, r.sh.Vcr) ? '\\le' : '\\gt'} ${n2(r.sh.Vcr)}`, value: r.VuF / r.sh.Vcr, unit: '', d: 3, ref: `${ED} Eq. 6.10.5.3-1`, ok: okv(r.VuF, r.sh.Vcr) });
    else w.add({ id: 'okF', label: 'Special fatigue requirement for webs', sym: '', eq: '', sub: '', value: 'not applicable', unit: '', d: 0, ref: `${ED} Art. 6.10.5.3`, note: r.sh.stiff ? 'End panel.' : 'Unstiffened web.' });
    return w.steps;
  }

  /* ---------- every panel of a stiffener layout (Preliminary sizing tsEvalBay) ---------- */
  /* panels(pans, opt): pans from SBDStiffeners.panels() [{ p, q (ft), d (in), end, sp, sq }]; opt = { D, Fyw, twAt(p, q), rat(p, q),
     vu(p, q) (the largest Strength I |V_u| in p..q, kip), tfa (default true) }. Each panel: tsVn with the thinnest web and the largest
     2Dt_w/(b_fc t_fc + b_ft t_ft) in it, V_u, φ_vV_n, ratio, and the worked steps. Returns { rows, gov }. */
  function panels(pans, opt) {
    const tfa = opt.tfa !== false;
    const rows = pans.map((pn, i) => {
      const tw = opt.twAt(pn.p, pn.q), rat = opt.rat(pn.p, pn.q), V = tsVn(opt.D, tw, opt.Fyw, pn.d, pn.end, rat, tfa), Vu = opt.vu ? opt.vu(pn.p, pn.q) : 0;
      const q = { i, ...pn, ...V, tw, rat, Vu, phVn: PHIV * V.Vn, r: Vu / Math.max(PHIV * V.Vn, 1e-9) };
      Object.defineProperty(q, 'steps', { enumerable: false, configurable: true, get() {
        const w = St().work('pn'); w.add({ id: 'd', label: `Panel ${n2(pn.p)}–${n2(pn.q)} ft${pn.end ? ' (end panel)' : ''}`, sym: 'd_{o}', eq: '12(x_{2} - x_{1})', sub: `12(${n3(pn.q)} - ${n3(pn.p)})`, value: pn.d, unit: 'in', d: 2, ref: `${ED} Art. 6.10.9.1` });
        const id = panelSteps(w, 'v', { ...V, tfa: V.tfa || undefined, rat }, { D: opt.D, tw, Fyw: opt.Fyw, doIn: pn.d, end: pn.end, flgA: 2 * opt.D * tw / rat });
        w.add({ id: 'Vu', label: 'Largest Strength I shear in the panel', sym: 'V_{u}', eq: '', sub: '', value: Vu, unit: 'kip', d: 2, ref: `${ED} Art. 6.10.9.3.1`, note: 'Envelope of the analysis stations in the panel; minimum load factors where a permanent load relieves the extreme (Table 3.4.1-2).' });
        w.add({ id: 'ok', label: 'Shear resistance of the panel', sym: 'V_{u} \\le \\phi_{v}V_{n}', eq: '', sub: `${n2(Vu)} ${Vu <= PHIV * V.Vn + 1e-9 ? '\\le' : '\\gt'} 1.0(${n2(V.Vn)})`, value: q.r, unit: '', d: 3, ref: `${ED} Eq. 6.10.9.1-1`, ok: Vu <= PHIV * V.Vn + 1e-9, note: `See §${id}.` });
        Object.defineProperty(q, 'steps', { value: w.steps, enumerable: false }); return w.steps; } });
      return q;
    });
    const gov = rows.reduce((b, q) => (!b || (isFinite(q.r) || q.r == null ? q.r : Infinity) > (isFinite(b.r) || b.r == null ? b.r : Infinity) ? q : b), null);   // SB2-R2: NaN / ∞ govern
    return { rows, gov };
  }

  /* ---------- demands from a hand-off payload (stgirder-external-demands) ---------- */
  /* demands(pl, G): the payload's stations as shear envelopes: xs; per station the magnitudes of V_DC1, V_DC2, V_DW, LL+IM (the larger of
     the positive and negative envelope, pedestrian included when the payload carries it), UT, UF, construction LL, fatigue (the larger of
     V_FATpos, |V_FATneg|); VuE: the Strength I |V_u| (Preliminary sizing's VuE: minimum factors where a permanent load relieves the
     extreme). Functions: at(x) (the largest magnitudes over the stations within 0.011 ft of x, else the nearest one), inPanel(p, q) (the
     largest over the stations in p..q), vu(p, q) (largest VuE in p..q). Plates: zAt(x) from section.zones. */
  function demands(pl, G) {
    G = factors(G);
    const S = pl.stations || [], zones = (pl.section || {}).zones || [], xs = S.map(s => +s.x), A = k => S.map(s => +s[k] || 0);
    const VDC1 = A('V_DC1'), VDC2 = A('V_DC2'), VDW = A('V_DW'), plIn = pl.pedestrianInLL === true,   // SB2-R1: with pedestrianInLL the LL+IM already includes it (HANDOFF.md §4.9)
      Vp = S.map(s => (+s.V_LLpos || 0) + (plIn ? 0 : +s.V_PLpos || 0)), Vn = S.map(s => (+s.V_LLneg || 0) + (plIn ? 0 : +s.V_PLneg || 0));
    const VUT = A('V_UT'), VUF = A('V_UF'), VCL = A('V_CL'), Vf = S.map(s => Math.max(Math.abs(+s.V_FATpos || 0), Math.abs(+s.V_FATneg || 0)));
    // the pedestrian part of Vp / Vn (in it, or added above; sb-ped-owner PR): the owner multiplier m is kept off it (GD45, GirderDetail V_PLq)
    const Qp = A('V_PLpos'), Qn = A('V_PLneg'), mO = +G.m > 0 ? +G.m : 1;
    const gDCn = G.dcMin, gDWn = G.dwMin;
    const VuE = xs.map((_, e) => { const VDC = VDC1[e] + VDC2[e], vf = s => (s * VDC >= 0 ? G.dc : gDCn) * VDC + (s * VDW[e] >= 0 ? G.dw : gDWn) * VDW[e] + (s * VUT[e] >= 0 ? G.dw : gDWn) * VUT[e] + (s * VUF[e] >= 0 ? G.dc * VUF[e] : 0);
      return Math.max(Math.abs(vf(1) + G.ll * (Vp[e] - Qp[e] + Qp[e] / mO)), Math.abs(vf(-1) + G.ll * (Vn[e] - Qn[e] + Qn[e] / mO))); });
    const idx = (a, b) => { const out = []; xs.forEach((x, i) => { if (x >= a - 1e-9 && x <= b + 1e-9) out.push(i); }); if (!out.length) { let i = 0; const m = (a + b) / 2; xs.forEach((x, j) => { if (Math.abs(x - m) < Math.abs(xs[i] - m)) i = j; }); out.push(i); } return out; };
    const mx = (ids, arr) => Math.max(0, ...ids.map(i => Math.abs(arr[i])));
    // plLL: the pedestrian part of LL (that of the station and envelope giving the largest |V_LL+IM|, as GirderDetail V_PLq), 0 without one
    const plOf = ids => { let b = -1, q = 0; ids.forEach(i => [[Vp, Qp], [Vn, Qn]].forEach(([V, Q]) => { const v = Math.abs(V[i]); if (v > b) { b = v; q = Math.sign(V[i]) * Q[i]; } })); return Math.abs(q) > 1e-12 ? q : 0; };
    const pack = ids => ({ DC1: mx(ids, VDC1), DC2: mx(ids, VDC2), DW: mx(ids, VDW), LL: Math.max(mx(ids, Vp), mx(ids, Vn)), UT: mx(ids, VUT), UF: mx(ids, VUF), CL: mx(ids, VCL), f: mx(ids, Vf), plLL: plOf(ids) });
    const zAt = x => { const z = zones.find(q => x >= q.startX - 1e-9 && x < q.endX) || zones[zones.length - 1]; return { D: z.web.depth, tw: z.web.thickness, topB: z.topFlange.width, topT: z.topFlange.thickness, botB: z.botFlange.width, botT: z.botFlange.thickness }; };
    /* reaction(x, side): the support reaction at x from the shears on both sides (the nearest station within 0.02 ft left and right of x;
       side 'L' / 'R' at the girder ends: one side only). DC1, DC2, DW, UT, UF: the jump V(left) − V(right). LL+IM: V_LL,pos(left) −
       V_LL,neg(right), the sum of the two shear envelopes, an UPPER BOUND of the LL+IM reaction envelope (the two maxima come from
       different truck positions); GirderDetail takes the reaction envelope of its analysis (bearingExport, b.llMax). */
    const near = (a, b) => { let k = -1; xs.forEach((x, i) => { if (x >= a - 1e-9 && x <= b + 1e-9 && (k < 0 || Math.abs(x - (a + b) / 2) < Math.abs(xs[k] - (a + b) / 2))) k = i; }); return k; };
    const reaction = x => { let l = near(x - 0.02, x - 1e-6), r = near(x + 1e-6, x + 0.02); const v = (A, i) => i >= 0 ? A[i] : 0;
      if (r < 0 && l < 0 && xs.length) { if (x <= xs[0] + 1e-6) r = 0; else if (x >= xs[xs.length - 1] - 1e-6) l = xs.length - 1; }   // a station at the girder end itself
      const jump = A => v(A, l) - v(A, r);
      return { DC1: jump(VDC1), DC2: jump(VDC2), DW: jump(VDW), UT: jump(VUT), UF: jump(VUF), LL: Math.max(0, v(Vp, l)) - Math.min(0, v(Vn, r)), PL: (v(Vp, l) > 0 ? v(Qp, l) : 0) - (v(Vn, r) < 0 ? v(Qn, r) : 0), left: l >= 0, right: r >= 0 }; };
    return { xs, VuE, at: x => pack(idx(x - 0.011, x + 0.011)), inPanel: (p, q) => pack(idx(Math.min(p, q), Math.max(p, q))), vu: (p, q) => Math.max(0, ...idx(p, q).map(i => VuE[i])), zAt, reaction, G };
  }

  /* fromPayload(pl, opt): the stations of the payload as shear locations (every payload station, 0.01 ft inside the girder ends and
     on both sides of each interior support), with d_o and the end-panel flag as GirderDetail's Check at any location sets them:
     d_o = opt.do (in; default the payload's transverse stiffener spacing, girderDetail.details.transverseStiffener.spacings[0], 0 when
     none), end panel within d_o of an abutment bearing (or any bearing of a simple span). V: demands().at(x). Returns { prj, locs, dem }. */
  function fromPayload(pl, opt) {
    opt = opt || {};
    const g = pl.girderDetail || {}, m = g.materials || {}, sup = (pl.member || {}).supports || [], Lend = sup[sup.length - 1], G = factors(opt.G), dem = demands(pl, G);
    const ts = ((g.details || {}).transverseStiffener || {}), doIn = opt.do != null ? +opt.do : (ts.spacings && +ts.spacings[0]) || 0, doFt = doIn / 12, cont = sup.length > 2;
    const list = []; const add = x => { if (!list.some(o => Math.abs(o - x) < 0.005)) list.push(x); };
    dem.xs.forEach(x => { const sp = sup.find(v => Math.abs(v - x) < 0.011); add(sp != null ? (sp < 0.02 ? 0.01 : sp > Lend - 0.02 ? Lend - 0.01 : sp - 0.01) : Math.min(Math.max(x, 0.01), Lend - 0.01)); });
    sup.slice(1, -1).forEach(v => add(v + 0.01)); list.sort((a, b) => a - b);
    const ends = cont ? [sup[0], sup[sup.length - 1]] : sup;
    const locs = list.map(x => { const V = dem.at(x); return { name: `x = ${x.toFixed(2)} ft`, x, plates: dem.zAt(x), do: doIn, end: doIn > 0 && ends.some(s => Math.abs(x - s) <= doFt + 1e-6), V, ...(V.plLL ? { pl: { VLL: [V.plLL, V.LL] } } : {}) }; });   // pl: GD45
    return { prj: { mat: { Fyw: +m.Fyw || 50 }, G }, locs, dem, doIn };
  }

  window.SBDShear = { ES, PHIV, shearC, plasticShear, webShear, tsVn, panelSteps, factors, factorsOwner, plAdjust, location, panels, demands, fromPayload };
})();
