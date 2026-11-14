/* apps/ps-bridge/engine/worked-strength.js — the worked steps of the Flexure and Shear tabs (window.PSBWorkedStrength). Classic script, no DOM.
   Created 2026-11-12 (PR 2c-2, docs/ps-bridge-plan.md §3 "Tabs and graphics": every number on a tab comes from computeAll, no second
   calculation; the steps substitute the engine's values and a test asserts each step's result equals the engine value).
   Uses window.PSBWorked (engine/worked.js: kit, n, g, par) and window.SharedSteps (CLAUDE.md §6).

   flexure(inp, R), shear(inp, R) -> { steps, pairs, paths } (as engine/worked-stress.js)
     flexure: Strength I flexure at midspan (5.6.3.1.1, 5.6.3.2, φ of 5.5.4.2), the governing station, minimum reinforcement (5.6.3.3) at
       midspan and where it governs; with continuity (5.12.3.3): the pier section's negative moment (HL-93 on the continuous unit, Strength I)
       and its resistance (deck bars in tension, a rectangular block in the girder bottom flange), the positive moment connection (5.12.3.3.8a).
     shear: at the critical section (d_v from the inside face of the bearing, 5.7.3.2): d_v, V_u, V_p, ε_s (Eq. 5.7.3.4.2-4), β, θ, V_c, V_s,
       V_n, the ratio, the stirrup spacing limits (5.7.2.5, 5.7.2.6), the longitudinal tie (5.7.3.5), interface shear (5.7.4); the governing
       stations; strand development (5.9.4.3.2).
   Display intermediates the engine does not keep are named in their notes (the flexure of the critical shear section, its shear
   components on a simple span, f_po at the section). The expressions are those of the moved engine (pbd-lldf-flexure.js flexure,
   pbd-compute.js computeAll), written out for display. Code basis AASHTO LRFD 10th Ed. (2024). */
(function () {
  'use strict';
  const PW = () => window.PSBWorked;
  const A10 = 'AASHTO LRFD 10th Ed. ';
  const near = (rows, x) => rows.reduce((b, r, i) => Math.abs(r.x - x) < Math.abs(rows[b].x - x) ? i : b, 0);
  const ownOf = R => { const o = R.own || {}; return { eta: o.eta === undefined ? 1 : o.eta, mLL: o.mLL === undefined ? 1 : o.mLL }; };
  const ckIx = (R, name) => R.checks.findIndex(c => c.n === name);
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));

  function flexure(inp, R) {
    const { kit, n, g, par } = PW(), K = kit('fx'), add = K.add;
    const G = R.g, cp = R.cp, ss = R.ss, L = R.L, f = R.fMid, own = ownOf(R), eta = own.eta, mLL = own.mLL, m = inp.mat;
    const fpu = +inp.str.fpu, lowlax = !!inp.str.lowlax, kk = lowlax ? 0.28 : 0.38, ts = +inp.ts, hasTop = ts > 0, fcd = hasTop ? +m.fcd : +m.fc;
    const iM = near(R.grid, L / 2), rM = R.grid[iM], dM = R.diagrams[iM], aM = ss.at(L / 2), Aps = aM.Aps;
    const hasR = rM.mrp != null;
    add({ id: 'Mu', label: `Strength I moment at midspan (x = ${n(rM.x, 2)} ft)`, sym: 'M_{u}', eq: `\\eta[1.25(M_{g} + M_{DC1} + M_{DC2}) + 1.50\\,M_{DW} + 1.75\\,m\\,M_{LL+IM}${hasR ? ' + M_{r}' : ''}]`,
      sub: `${n(eta, 4)}[1.25(${g(rM.Mg, 0)} + ${g(rM.Mdk, 0)} + ${g(dM.M_DC2 * 12, 0)}) + 1.50(${g(dM.M_DW * 12, 0)}) + 1.75(${n(mLL, 2)})(${g(rM.Mll, 0)})${hasR ? ` + ${g(rM.mrp, 0)}` : ''}]`, value: R.MuMid, unit: 'kip-in', d: 0, ref: A10 + 'Table 3.4.1-1, 1.3.2.1',
      note: `= ${n(R.MuMid / 12, 1)} kip-ft. Moments in kip-in (Analysis tab); η, m: owner factors (1 for AASHTO).${hasR ? ' M_r: the positive restraint moment where it increases the effect (5.12.3.3.2).' : ''}` },
      eta * (1.25 * (rM.Mg + rM.Mdk + dM.M_DC2 * 12) + 1.5 * dM.M_DW * 12 + 1.75 * mLL * rM.Mll + (hasR ? rM.mrp : 0)), 'MuMid');
    add({ id: 'b1', label: `Stress block factor (${hasTop ? 'deck' : 'girder'} concrete in compression)`, sym: '\\beta_{1}', eq: `0.85 - 0.05(f^{\\prime}_{c} - 4) \\text{, } 0.65 \\le \\beta_{1} \\le 0.85`, sub: `0.85 - 0.05(${n(fcd, 2)} - 4)`, value: f.b1, unit: '', d: 3, ref: A10 + '5.6.2.2' }, cl(0.85 - 0.05 * (fcd - 4), 0.65, 0.85), 'fMid.b1');
    add({ id: 'dp', label: 'Depth to the strand centroid at midspan', sym: 'd_{p}', eq: 'h_{c} - y_{ps}', sub: `${n(cp.hc, 2)} - ${n(aM.cgs, 3)}`, value: f.dp, unit: 'in', d: 2 }, cp.hc - aM.cgs, 'fMid.dp');
    const b = cp.beff, bw = G.isNext ? G.bw : G.btf, hf = hasTop ? (ts + (G.isNext ? 0 : +inp.th)) : (G.isNext ? G.next.ft : G.d[0]);
    if (f.devGov) add({ id: 'c', label: 'Neutral axis depth (strand not fully developed at the section: from the developed tension)', sym: 'c', value: f.c, unit: 'in', d: 2, ref: A10 + '5.9.4.3.2' }, undefined, 'fMid.c');
    else if (f.rect) add({ id: 'c', label: 'Neutral axis depth (rectangular section behaviour)', sym: 'c', eq: '\\frac{A_{ps}f_{pu}}{0.85\\,f^{\\prime}_{c}\\,\\beta_{1}\\,b + k\\,A_{ps}\\frac{f_{pu}}{d_{p}}}', sub: `\\frac{${n(Aps, 3)}(${n(fpu, 0)})}{0.85(${n(fcd, 2)})(${n(f.b1, 3)})(${n(b, 2)}) + ${kk}(${n(Aps, 3)})\\frac{${n(fpu, 0)}}{${n(f.dp, 2)}}}`, value: f.c, unit: 'in', d: 2, ref: A10 + 'Eq. 5.6.3.1.1-4',
      note: `k = ${kk} (${lowlax ? 'low-relaxation' : 'stress-relieved'} strand, Table C5.6.3.1.1-1); b = b_eff; β_1 c ≤ h_f = ${n(hf, 2)} in.` }, Aps * fpu / (0.85 * fcd * f.b1 * b + kk * Aps * fpu / f.dp), 'fMid.c');
    else add({ id: 'c', label: 'Neutral axis depth (flanged section: the block is deeper than the flange)', sym: 'c', eq: '\\frac{A_{ps}f_{pu} - 0.85\\,f^{\\prime}_{c}(b - b_{w})h_{f}}{0.85\\,f^{\\prime}_{c}\\,\\beta_{1}\\,b_{w} + k\\,A_{ps}\\frac{f_{pu}}{d_{p}}}', sub: `\\frac{${n(Aps, 3)}(${n(fpu, 0)}) - 0.85(${n(fcd, 2)})(${n(b, 2)} - ${n(bw, 2)})(${n(hf, 2)})}{0.85(${n(fcd, 2)})(${n(f.b1, 3)})(${n(bw, 2)}) + ${kk}(${n(Aps, 3)})\\frac{${n(fpu, 0)}}{${n(f.dp, 2)}}}`, value: f.c, unit: 'in', d: 2, ref: A10 + 'Eq. 5.6.3.1.1-3',
      note: `b_w: the ${G.isNext ? 'stem' : 'girder top flange'} width below the flange (the engine's).` }, (Aps * fpu - 0.85 * fcd * (b - bw) * hf) / (0.85 * fcd * f.b1 * bw + kk * Aps * fpu / f.dp), 'fMid.c');
    add({ id: 'a', label: 'Depth of the stress block', sym: 'a', eq: '\\beta_{1}\\,c', sub: `${n(f.b1, 3)}(${n(f.c, 3)})`, value: f.a, unit: 'in', d: 2 }, f.b1 * f.c, 'fMid.a');
    if (!f.devGov) add({ id: 'fps', label: 'Average stress in the strands at nominal resistance', sym: 'f_{ps}', eq: 'f_{pu}\\left(1 - k\\frac{c}{d_{p}}\\right)', sub: `${n(fpu, 0)}\\left(1 - ${kk}\\left(\\frac{${n(f.c, 3)}}{${n(f.dp, 2)}}\\right)\\right)`, value: f.fps, unit: 'ksi', d: 1, ref: A10 + 'Eq. 5.6.3.1.1-1' }, fpu * (1 - kk * f.c / f.dp), 'fMid.fps');
    else add({ id: 'fps', label: 'Average developed strand stress (5.9.4.3.2)', sym: 'f_{ps}', value: f.fps, unit: 'ksi', d: 1, ref: A10 + '5.9.4.3.2' }, undefined, 'fMid.fps');
    if (f.rect) add({ id: 'Mn', label: 'Nominal flexural resistance', sym: 'M_{n}', eq: 'A_{ps}f_{ps}\\left(d_{p} - \\frac{a}{2}\\right)', sub: `${n(Aps, 3)}(${n(f.fps, 2)})\\left(${n(f.dp, 2)} - \\frac{${n(f.a, 3)}}{2}\\right)`, value: f.Mn, unit: 'kip-in', d: 0, ref: A10 + 'Eq. 5.6.3.2.2-1', note: `= ${n(f.Mn / 12, 1)} kip-ft.` }, Aps * f.fps * (f.dp - f.a / 2), 'fMid.Mn');
    else add({ id: 'Mn', label: 'Nominal flexural resistance (flanged)', sym: 'M_{n}', eq: 'A_{ps}f_{ps}\\left(d_{p} - \\frac{a}{2}\\right) + 0.85\\,f^{\\prime}_{c}(b - b_{w})h_{f}\\left(\\frac{a}{2} - \\frac{h_{f}}{2}\\right)', sub: `${n(Aps, 3)}(${n(f.fps, 2)})\\left(${n(f.dp, 2)} - \\frac{${n(f.a, 3)}}{2}\\right) + 0.85(${n(fcd, 2)})(${n(b - bw, 2)})(${n(hf, 2)})\\left(\\frac{${n(f.a, 3)}}{2} - \\frac{${n(hf, 2)}}{2}\\right)`, value: f.Mn, unit: 'kip-in', d: 0, ref: A10 + 'Eq. 5.6.3.2.2-1', note: `= ${n(f.Mn / 12, 1)} kip-ft.` },
      f.devGov ? undefined : Aps * f.fps * (f.dp - f.a / 2) + 0.85 * fcd * (b - bw) * hf * (f.a / 2 - hf / 2), 'fMid.Mn');
    const dt = cp.hc - ss.yLow;
    add({ id: 'et', label: 'Net tensile strain in the extreme strand layer', sym: '\\varepsilon_{t}', eq: '0.003\\left(\\frac{d_{t}}{c} - 1\\right)', sub: `0.003\\left(\\frac{${n(dt, 2)}}{${n(f.c, 3)}} - 1\\right)`, value: f.et, unit: '', d: 5, ref: A10 + 'C5.6.2.1', note: `d_t = h_c − y_low = ${n(cp.hc, 2)} − ${n(ss.yLow, 2)}.` }, 0.003 * (dt / f.c - 1), 'fMid.et');
    add({ id: 'phi', label: `Resistance factor (${f.et >= 0.005 ? 'tension-controlled' : f.et <= 0.002 ? 'compression-controlled' : 'transition'})`, sym: '\\phi', eq: '0.75 + 0.25\\,\\frac{\\varepsilon_{t} - 0.002}{0.003}\\text{, } 0.75 \\le \\phi \\le 1.0', sub: `0.75 + 0.25\\,\\frac{${n(f.et, 5)} - 0.002}{0.003}`, value: f.phi, unit: '', d: 3, ref: A10 + 'Eq. 5.5.4.2-2' }, cl(0.75 + 0.25 * (f.et - 0.002) / 0.003, 0.75, 1.0), 'fMid.phi');
    add({ id: 'phiMn', label: 'Factored flexural resistance at midspan', sym: '\\phi M_{n}', eq: '\\phi\\,M_{n}', sub: `${n(f.phi, 3)}(${g(f.Mn, 0)})`, value: f.phiMn, unit: 'kip-in', d: 0, note: `= ${n(f.phiMn / 12, 1)} kip-ft.` }, f.phi * f.Mn, 'fMid.phiMn');
    const kF = ckIx(R, 'Flexure'), fg = R.flexGov;
    add({ id: 'gov', label: `Ratio where it governs (x = ${n(fg.x, 2)} ft${Math.abs(fg.x - L / 2) > 0.01 ? '' : ', midspan'})`, sym: '\\frac{M_{u}}{\\phi M_{n}}', eq: '', sub: `\\frac{${g(fg.Mu, 0)}}{${g(fg.phiMn, 0)}}`, value: R.checks[kF].r, unit: '', d: 3, ok: R.checks[kF].pass, ref: A10 + '5.6.3.2',
      note: 'The largest over every station of the span with a positive M_u (φM_n at each station from its strands, transfer and development included; the station table).' }, fg.Mu / fg.phiMn, `checks.${kF}.r`);
    // minimum reinforcement (5.6.3.3)
    const fc = +m.fc, PeM = Aps * R.fpe;
    add({ id: 'fr', label: 'Modulus of rupture', sym: 'f_{r}', eq: '0.24\\sqrt{f^{\\prime}_{c}}', sub: `0.24\\sqrt{${n(fc, 2)}}`, value: R.fr, unit: 'ksi', d: 3, ref: A10 + '5.4.2.6' }, 0.24 * Math.sqrt(fc), 'fr');
    add({ id: 'fcpe', label: 'Compression from the effective prestress at the bottom fibre (midspan)', sym: 'f_{cpe}', eq: '\\frac{P_{e}}{A_{g}} + \\frac{P_{e}e_{m}}{S_{b}}', sub: `\\frac{${n(PeM, 1)}}{${n(G.A, 1)}} + \\frac{${n(PeM, 1)}(${n(ss.eMid, 3)})}{${g(G.Sb, 0)}}`, value: R.fcpe, unit: 'ksi', d: 3, ref: A10 + '5.6.3.3' }, PeM / G.A + PeM * ss.eMid / G.Sb, 'fcpe');
    add({ id: 'Mcr', label: 'Cracking moment (midspan)', sym: 'M_{cr}', eq: '\\gamma_{3}\\left[(\\gamma_{1}f_{r} + \\gamma_{2}f_{cpe})S_{bc} - M_{dnc}\\left(\\frac{S_{bc}}{S_{b}} - 1\\right)\\right]', sub: `1.0\\left[(1.6(${n(R.fr, 3)}) + 1.1(${n(R.fcpe, 3)}))(${g(cp.Sbc, 0)}) - ${g(rM.Mg + rM.Mdk, 0)}\\left(\\frac{${g(cp.Sbc, 0)}}{${g(G.Sb, 0)}} - 1\\right)\\right]`, value: R.Mcr, unit: 'kip-in', d: 0, ref: A10 + 'Eq. 5.6.3.3-1',
      note: `= ${n(R.Mcr / 12, 1)} kip-ft. γ_1 = 1.6, γ_2 = 1.1, γ_3 = 1.0 (prestressing steel); M_dnc = M_g + M_DC1 at midspan (kip-in).` }, Math.max(1.0 * ((1.6 * R.fr + 1.1 * R.fcpe) * cp.Sbc - (rM.Mg + rM.Mdk) * (cp.Sbc / G.Sb - 1)), 0), 'Mcr');
    add({ id: 'minMr', label: 'Required resistance at midspan', sym: 'M_{r,min}', eq: '\\min(M_{cr},\\,1.33\\,M_{u})', sub: `\\min(${g(R.Mcr, 0)},\\,1.33(${g(R.MuMid, 0)}))`, value: R.minMr, unit: 'kip-in', d: 0, ref: A10 + '5.6.3.3' }, Math.min(R.Mcr, 1.33 * R.MuMid), 'minMr');
    const kM = ckIx(R, 'Min reinf'), mg = R.minGov;
    add({ id: 'min.req', label: `Required resistance where the ratio governs (x = ${n(mg.x, 2)} ft)`, sym: 'M_{r,min}', eq: '\\min(M_{cr,x},\\,1.33\\,M_{u,x})', sub: `\\min(${g(mg.Mcr, 0)},\\,1.33(${g(mg.Mu, 0)}))`, value: mg.req, unit: 'kip-in', d: 0, note: `M_cr at the station from its prestress and eccentricity (f_cpe = ${n(mg.fcpe, 3)} ksi).` }, Math.min(mg.Mcr, 1.33 * mg.Mu), 'minGov.req');
    add({ id: 'min.r', label: 'Ratio, minimum reinforcement', sym: '\\frac{M_{r,min}}{\\phi M_{n}}', eq: '', sub: `\\frac{${g(mg.req, 0)}}{${g(mg.phiMn, 0)}}`, value: R.checks[kM].r, unit: '', d: 3, ok: R.checks[kM].pass, ref: A10 + '5.6.3.3' }, mg.req / mg.phiMn, `checks.${kM}.r`);
    // continuity: the pier section and the positive moment connection
    const c = R.cont;
    if (c) {
      if (c.pier) {
        const pr = c.pier, ll = pr.nd.ll;
        add({ id: 'pier.neg', label: 'Negative moment per lane at the pier: one truck or the tandem, with the lane (no IM in the vehicles\' values)', sym: 'M_{LL,1}', eq: '1.33\\,\\min(M_{tr},\\,M_{td}) + M_{ln}', sub: `1.33\\,\\min(${par(ll.truckMin, 1)},\\,${par(ll.tanMin, 1)}) + ${par(ll.laneNeg, 1)}`, value: ll.neg, unit: 'kip-ft', d: 1, ref: A10 + '3.6.1.3.1', note: 'Influence line of the support moment on the continuous unit (the old app\'s FE model); − hogging.' },
          1.33 * Math.min(ll.truckMin, ll.tanMin) + ll.laneNeg, 'cont.pier.nd.ll.neg');
        add({ id: 'pier.neg2', label: 'Negative moment per lane at the pier: two trucks 50 ft apart, 90 %', sym: 'M_{LL,2}', eq: '0.9(1.33\\,M_{2tr} + M_{ln})', sub: `0.9(1.33(${par(ll.twoMin, 1)}) + ${par(ll.laneNeg, 1)})`, value: ll.neg2, unit: 'kip-ft', d: 1, ref: A10 + '3.6.1.3.1' }, 0.9 * (1.33 * ll.twoMin + ll.laneNeg), 'cont.pier.nd.ll.neg2');
        add({ id: 'pier.Mlane', label: `Governing negative moment per lane (${c.llSrc})`, sym: 'M_{LL,lane}', value: pr.nd.Mn, unit: 'kip-ft', d: 1, note: 'The two-truck case applies where the uniform-load support moment is negative (at an interior support) and it is larger.' }, undefined, 'cont.pier.nd.Mn');
        add({ id: 'pier.MLL', label: 'Live load moment at the pier per girder', sym: 'M_{LL,n}', eq: '-DF_{M}\\,M_{LL,lane}', sub: `-${n(R.dfm, 4)}(${par(pr.nd.Mn, 1)})`, value: c.MLLn, unit: 'kip-ft', d: 1, ref: A10 + '4.6.2.2' }, -R.dfm * pr.nd.Mn, 'cont.MLLn');
      } else add({ id: 'pier.MLL', label: `Live load moment at the pier per girder (${c.llSrc})`, sym: 'M_{LL,n}', value: c.MLLn, unit: 'kip-ft', d: 1 }, undefined, 'cont.MLLn');
      const Mrn = c.MrnPier || 0;
      add({ id: 'pier.Mu', label: 'Strength I negative moment at the pier', sym: 'M_{u,n}', eq: '\\eta(1.25\\,M_{DC2,n} + 1.50\\,M_{DW,n} + 1.75\\,m\\,M_{LL,n} + M_{r,n})\\times 12', sub: `${n(eta, 4)}(1.25(${n(c.MDC2n, 1)}) + 1.50(${n(c.MDWn, 1)}) + 1.75(${n(mLL, 2)})(${n(c.MLLn, 1)}) + ${n(Mrn, 1)})\\times 12`, value: c.MuN, unit: 'kip-in', d: 0, ref: A10 + 'Table 3.4.1-1, 5.12.3.3.2',
        note: `= ${n(c.MuN / 12, 1)} kip-ft. M_DC2,n, M_DW,n: the continuous unit (Analysis tab); M_r,n: a negative restraint moment (γ = 1.0), 0 without restraint.` }, eta * (1.25 * c.MDC2n + 1.5 * c.MDWn + 1.75 * mLL * c.MLLn + Mrn) * 12, 'cont.MuN');
      const cn = inp.cont;
      add({ id: 'pier.d', label: 'Depth of the deck bars from the girder bottom', sym: 'd', eq: 'h_{c} - d_{top}', sub: `${n(cp.hc, 2)} - ${n(+cn.dTop, 2)}`, value: c.dN, unit: 'in', d: 2 }, cp.hc - (+cn.dTop), 'cont.dN');
      add({ id: 'pier.a', label: 'Depth of the compression block in the girder bottom flange', sym: 'a', eq: '\\frac{A_{s}f_{y}}{0.85\\,f^{\\prime}_{c}\\,b_{bf}}', sub: `\\frac{${n(c.As, 2)}(${n(c.fyr, 0)})}{0.85(${n(fc, 2)})(${n(G.bbf, 2)})}`, value: c.aN, unit: 'in', d: 2, ref: A10 + '5.6.3.2.3',
        note: `A_s: the deck bars within b_eff (Bridge layout tab, continuity card); girder f′c. ${R.ps34 ? `a ${R.ps34.aOK ? '≤' : '>'} ${R.ps34.what} = ${n(R.ps34.t, 2)} in (PS-34)${R.ps34.aOK ? '' : ': the rectangular block is not valid (warning)'}` : `a ${c.aOK ? '≤' : '>'} t_bf = ${n(c.tbf, 2)} in${c.aOK ? '' : ': the rectangular block is not valid (warning of the engine)'}`}.` }, c.As * c.fyr / (0.85 * fc * G.bbf), 'cont.aN');
      add({ id: 'pier.b1', label: 'Stress block factor (girder concrete)', sym: '\\beta_{1}', eq: '0.85 - 0.05(f^{\\prime}_{c} - 4)', sub: `0.85 - 0.05(${n(fc, 2)} - 4)`, value: c.b1g, unit: '', d: 3, ref: A10 + '5.6.2.2' }, cl(0.85 - 0.05 * (fc - 4), 0.65, 0.85), 'cont.b1g');
      add({ id: 'pier.c', label: 'Neutral axis depth', sym: 'c', eq: '\\frac{a}{\\beta_{1}}', sub: `\\frac{${n(c.aN, 3)}}{${n(c.b1g, 3)}}`, value: c.cN, unit: 'in', d: 2 }, c.aN / c.b1g, 'cont.cN');
      add({ id: 'pier.et', label: 'Net tensile strain in the deck bars', sym: '\\varepsilon_{t}', eq: '0.003\\left(\\frac{d}{c} - 1\\right)', sub: `0.003\\left(\\frac{${n(c.dN, 2)}}{${n(c.cN, 3)}} - 1\\right)`, value: c.etN, unit: '', d: 5 }, 0.003 * (c.dN / c.cN - 1), 'cont.etN');
      add({ id: 'pier.phi', label: 'Resistance factor (reinforced concrete)', sym: '\\phi', eq: '0.75 + 0.15\\,\\frac{\\varepsilon_{t} - 0.002}{0.003}\\text{, } 0.75 \\le \\phi \\le 0.90', sub: `0.75 + 0.15\\,\\frac{${n(c.etN, 5)} - 0.002}{0.003}`, value: c.phiN, unit: '', d: 3, ref: A10 + 'Eq. 5.5.4.2-1' }, cl(0.75 + 0.15 * (c.etN - 0.002) / 0.003, 0.75, 0.9), 'cont.phiN');
      add({ id: 'pier.Mn', label: 'Nominal negative resistance at the pier', sym: 'M_{n}', eq: 'A_{s}f_{y}\\left(d - \\frac{a}{2}\\right)', sub: `${n(c.As, 2)}(${n(c.fyr, 0)})\\left(${n(c.dN, 2)} - \\frac{${n(c.aN, 3)}}{2}\\right)`, value: c.MnN, unit: 'kip-in', d: 0, ref: A10 + 'Eq. 5.6.3.2.2-1', note: 'The strands near the pier are neglected (debonded or not effective in negative bending).' }, c.As * c.fyr * (c.dN - c.aN / 2), 'cont.MnN');
      add({ id: 'pier.phiMn', label: 'Factored negative resistance at the pier', sym: '\\phi M_{n}', eq: '\\phi\\,M_{n}', sub: `${n(c.phiN, 3)}(${g(c.MnN, 0)})`, value: c.phiMnN, unit: 'kip-in', d: 0, note: `= ${n(c.phiMnN / 12, 1)} kip-ft.` }, c.phiN * c.MnN, 'cont.phiMnN');
      const kP = ckIx(R, 'Neg flexure (pier)');
      add({ id: 'pier.r', label: 'Ratio, negative flexure at the pier', sym: '\\frac{M_{u,n}}{\\phi M_{n}}', eq: '', sub: `\\frac{${g(c.MuN, 0)}}{${g(c.phiMnN, 0)}}`, value: c.dc, unit: '', d: 3, ok: kP >= 0 ? R.checks[kP].pass : undefined, ref: A10 + '5.12.3.3' }, c.MuN / c.phiMnN, 'cont.dc');
      const q = c.conn;
      if (q) {
        add({ id: 'conn.M', label: `Service moment at the ${q.x === 0 ? 'left' : 'right'} end after continuity (positive moment connection)`, sym: 'M_{pos}', eq: 'M_{res} + M_{DC2} + M_{DW} + m\\,M_{LL+}', sub: `${par(q.mr, 1)} + ${par(q.mdc2, 1)} + ${par(q.mdw, 1)} + ${n(mLL, 2)}(${n(q.mll, 1)})`, value: q.M, unit: 'kip-ft', d: 1, ref: A10 + 'C5.12.3.3.2, 5.12.3.3.5',
          note: 'At the girder end over the interior support; M_res: the restraint moment (0 without restraint); M_LL+: the positive LL+IM there (γ = 1.0).' }, q.mr + q.mdc2 + q.mdw + mLL * q.mll, 'cont.conn.M');
        if (q.M > 0) {
          add({ id: 'conn.T', label: 'Tension in the positive moment connection', sym: 'T', eq: '\\frac{0.9\\,M_{pos}\\times 12}{0.9\\,h_{c}}', sub: `\\frac{0.9(${n(q.M, 1)})(12)}{0.9(${n(q.hc, 2)})}`, value: q.T, unit: 'kip', d: 1, ref: A10 + 'C5.12.3.3.5' }, 0.9 * q.M * 12 / (0.9 * q.hc), 'cont.conn.T');
          add({ id: 'conn.As', label: 'Connection steel required (f_s ≤ 36 ksi)', sym: 'A_{s,req}', eq: '\\frac{T}{36}', sub: `\\frac{${n(q.T, 1)}}{36}`, value: q.AsReq, unit: 'in^{2}', d: 2, ref: A10 + '5.12.3.3.8a' }, q.T / 36, 'cont.conn.AsReq');
          if (q.AsProv > 0) {
            add({ id: 'conn.fs', label: 'Stress in the connection steel entered', sym: 'f_{s}', eq: '\\frac{T}{A_{s,pos}}', sub: `\\frac{${n(q.T, 1)}}{${n(q.AsProv, 2)}}`, value: q.fs, unit: 'ksi', d: 1, ref: A10 + '5.12.3.3.8a' }, q.T / q.AsProv, 'cont.conn.fs');
            add({ id: 'conn.r', label: 'Ratio, positive moment connection', sym: '\\frac{f_{s}}{36}', eq: '', sub: `\\frac{${n(q.fs, 2)}}{36}`, value: q.dc, unit: '', d: 3, ok: q.dc <= 1.0001 }, q.fs / 36, 'cont.conn.dc');
          }
        } else add({ id: 'conn.none', label: 'Positive moment connection', sym: '', value: 'no positive moment at the connection', unit: '', note: 'Detail the connection per 5.12.3.3.8 and the owner.' });
      }
    }
    return K.done();
  }

  function shear(inp, R) {
    const { kit, n, g, par } = PW(), K = kit('sh'), add = K.add;
    const G = R.g, cp = R.cp, ss = R.ss, L = R.L, m = inp.mat, fc = +m.fc, own = ownOf(R), eta = own.eta, mLL = own.mLL, phiV = R.phiV;
    const k0 = R.shear.findIndex(s => !s.isBearing), s = R.shear[k0], x = s.x, P = `shear.${k0}.`, xm = Math.min(x, L - x);
    const Av = +inp.opt.stirAv, fy = +inp.opt.fy, Ep = +inp.str.Ep, fpu = +inp.str.fpu;
    const f = window.flexure(inp, G, cp, ss, x, R.fpe), DI = 'Display intermediate: the engine\'s flexure() at the section (the engine keeps d_v only).';
    add({ id: 'x', label: 'Critical section: d_v from the inside face of the bearing', sym: 'x_{crit}', value: x, unit: 'ft', d: 2, ref: A10 + '5.7.3.2', note: `Inside face of the bearing = L_pad/2 = ${n((+inp.opt.Lpad || 0) / 24, 3)} ft from ℄ bearing; found by iteration on d_v (the engine).` }, undefined, P + 'x');
    add({ id: 'dp', label: 'Strand depth and stress block at the section', sym: 'd_{p}', value: f.dp, unit: 'in', d: 2, note: `a = ${n(f.a, 3)} in. ` + DI });
    add({ id: 'dv', label: 'Effective shear depth', sym: 'd_{v}', eq: '\\max\\left(d_{p} - \\frac{a}{2},\\,0.9\\,d_{p},\\,0.72\\,h_{c}\\right)', sub: `\\max\\left(${n(f.dp, 2)} - \\frac{${n(f.a, 3)}}{2},\\,0.9(${n(f.dp, 2)}),\\,0.72(${n(cp.hc, 2)})\\right)`, value: s.dv, unit: 'in', d: 2, ref: A10 + '5.7.2.8' }, Math.max(f.dp - f.a / 2, 0.9 * f.dp, 0.72 * cp.hc), P + 'dv');
    // V_u
    let vg, vdc1, vdc2, vdw, vll, vr = 0, rIn = false;
    if (s.vc) ({ g: vg, dc1: vdc1, dc2: vdc2, dw: vdw, ll: vll, r: vr, rIn } = s.vc);
    else {
      const V = w => w * (L / 2 - x), dia = (inp.loads.diaph || []).filter(d => +d.P > 0 && +d.a >= 0 && +d.a <= L);
      const Vdia = dia.reduce((t, d) => { const Pp = +d.P, a = +d.a, Rl = Pp * (L - a) / L; return t + (x < a ? Rl : x > a ? Rl - Pp : Rl - Pp / 2); }, 0);
      vg = V(R.wG); vdc1 = V(R.wDk) + Vdia; vdc2 = V(R.wBar); vdw = V(R.wDW); vll = R.VLL * (L - xm) / L;
    }
    const vdl = 1.25 * (vg + vdc1 + vdc2) + 1.5 * vdw;
    add({ id: 'Vu', label: 'Strength I shear at the section', sym: 'V_{u}', eq: `\\eta\\left(\\left|1.25(V_{g} + V_{DC1} + V_{DC2}) + 1.50\\,V_{DW}${rIn ? ' + V_{r}' : ''}\\right| + 1.75\\,m\\,V_{LL+IM}\\right)`,
      sub: `${n(eta, 4)}\\left(\\left|1.25(${n(vg, 2)} + ${n(vdc1, 2)} + ${n(vdc2, 2)}) + 1.50(${n(vdw, 2)})${rIn ? ` + ${par(vr, 2)}` : ''}\\right| + 1.75(${n(mLL, 2)})(${n(vll, 2)})\\right)`, value: s.Vu, unit: 'kip', d: 2, ref: A10 + 'Table 3.4.1-1',
      note: (s.vc ? 'Shears of the continuous unit for DC2, DW and LL (the engine). ' : 'Simple span; V_LL+IM = V_LL (L − x)/L (the engine\'s envelope). Component shears: display intermediates. ') + (rIn ? 'V_r: the restraint shear where it increases |V| (5.12.3.3.2).' : '') },
      eta * (Math.max(Math.abs(vdl), Math.abs(vdl + vr)) + 1.75 * mLL * vll), P + 'Vu');
    const a = +ss.hp.frac * L, ramp = cl(xm * 12 / ss.lt, 0, 1), Ph = ss.AsHarp * R.fpe * ramp;
    if (ss.nh > 0 && xm < a) add({ id: 'Vp', label: 'Vertical component of the draped strands\' force', sym: 'V_{p}', eq: 'A_{p,dr}\\,f_{pe}\\,\\min\\left(\\frac{x}{\\ell_{t}},\\,1\\right)\\,\\tan\\alpha', sub: `${n(ss.AsHarp, 3)}(${n(R.fpe, 2)})(${n(ramp, 3)})(${n(ss.slope, 5)})`, value: s.Vp, unit: 'kip', d: 2, ref: A10 + '5.7.3.3' }, Ph * ss.slope, P + 'Vp');
    else add({ id: 'Vp', label: 'Vertical component of the prestress', sym: 'V_{p}', value: s.Vp, unit: 'kip', d: 2, note: ss.nh > 0 ? 'The section is between the hold-down points: 0.' : 'No draped strands: 0.' }, undefined, P + 'Vp');
    add({ id: 'Mu', label: 'Moment used with the shear', sym: '|M_{u}|', eq: '\\max(M_{u},\\,|V_{u} - V_{p}|\\,d_{v})', sub: `\\max(${g(R.rv.rN.Mu, 0)},\\,|${n(s.Vu, 2)} - ${n(s.Vp, 2)}|(${n(s.dv, 2)}))`, value: R.rv.MuU, unit: 'kip-in', d: 0, ref: A10 + '5.7.3.4.2', note: 'M_u of the nearest station (Stresses tab table).' }, Math.max(R.rv.rN.Mu, Math.abs(s.Vu - s.Vp) * s.dv), 'rv.MuU');
    const apsX = ss.at(x).Aps, fpo = 0.7 * fpu * ramp, num = R.rv.MuU / s.dv + Math.abs(s.Vu - s.Vp) - apsX * fpo;
    add({ id: 'esRaw', label: 'Longitudinal strain at the section', sym: '\\varepsilon_{s}', eq: '\\frac{\\frac{|M_{u}|}{d_{v}} + |V_{u} - V_{p}| - A_{ps}f_{po}}{E_{p}A_{ps}}', sub: `\\frac{\\frac{${g(R.rv.MuU, 0)}}{${n(s.dv, 2)}} + ${n(Math.abs(s.Vu - s.Vp), 2)} - ${n(apsX, 3)}(${n(fpo, 2)})}{${n(Ep, 0)}(${n(apsX, 3)})}`, value: s.esRaw, unit: '', d: 6, ref: A10 + 'Eq. 5.7.3.4.2-4',
      note: `f_po = 0.7 f_pu, ramped over the transfer length (× ${n(ramp, 3)}); A_ps: the strands effective at the section.` }, num / (Ep * apsX), P + 'esRaw');
    if (s.esRecomp) add({ id: 'es', label: 'Negative strain recomputed with the concrete on the tension side, then limited to −0.40 × 10⁻³', sym: '\\varepsilon_{s}', eq: '\\frac{\\text{numerator}}{E_{p}A_{ps} + E_{c}A_{ct}}', sub: `\\frac{${n(num, 2)}}{${n(Ep, 0)}(${n(apsX, 3)}) + ${n(cp.Ecg, 0)}(${n(s.Act, 1)})}`, value: s.es, unit: '', d: 6, ref: A10 + 'Eq. 5.7.3.4.2-4', note: 'A_ct: the girder concrete below mid-depth.' },
      cl(num / (Ep * apsX + cp.Ecg * s.Act), -0.40e-3, 6e-3), P + 'es');
    else add({ id: 'es', label: 'Strain used (limits −0.40 × 10⁻³ … 6.0 × 10⁻³)', sym: '\\varepsilon_{s}', value: s.es, unit: '', d: 6 }, undefined, P + 'es');
    add({ id: 'beta', label: 'Factor for the tensile stresses in cracked concrete', sym: '\\beta', eq: '\\frac{4.8}{1 + 750\\,\\varepsilon_{s}}', sub: `\\frac{4.8}{1 + 750(${n(s.es, 6)})}`, value: s.beta, unit: '', d: 3, ref: A10 + 'Eq. 5.7.3.4.2-1' }, 4.8 / (1 + 750 * s.es), P + 'beta');
    add({ id: 'theta', label: 'Angle of the diagonal compression', sym: '\\theta', eq: '29 + 3500\\,\\varepsilon_{s}', sub: `29 + 3500(${n(s.es, 6)})`, value: s.theta, unit: 'deg', d: 2, ref: A10 + 'Eq. 5.7.3.4.2-3' }, 29 + 3500 * s.es, P + 'theta');
    add({ id: 'Vc', label: 'Concrete shear resistance', sym: 'V_{c}', eq: '0.0316\\,\\beta\\,\\lambda\\sqrt{f^{\\prime}_{c}}\\,b_{v}d_{v}', sub: `0.0316(${n(s.beta, 3)})(1.0)\\sqrt{${n(fc, 2)}}(${n(G.bw, 2)})(${n(s.dv, 2)})`, value: s.Vc, unit: 'kip', d: 2, ref: A10 + 'Eq. 5.7.3.3-3', note: 'λ = 1.0 (normal-weight concrete).' }, 0.0316 * s.beta * Math.sqrt(fc) * G.bw * s.dv, P + 'Vc');
    add({ id: 'Vs', label: 'Stirrup shear resistance', sym: 'V_{s}', eq: '\\frac{A_{v}f_{y}d_{v}\\cot\\theta}{s}', sub: `\\frac{${n(Av, 3)}(${n(fy, 0)})(${n(s.dv, 2)})(${n(s.cot, 4)})}{${n(s.sProv, 2)}}`, value: s.Vs, unit: 'kip', d: 2, ref: A10 + 'Eq. 5.7.3.3-4', note: 'Vertical stirrups; s: the end-zone or interior spacing at the section (Girders & strands tab).' }, Av * fy * s.dv * s.cot / s.sProv, P + 'Vs');
    add({ id: 'Vn', label: 'Nominal shear resistance', sym: 'V_{n}', eq: '\\min(V_{c} + V_{s} + V_{p},\\,0.25\\,f^{\\prime}_{c}b_{v}d_{v} + V_{p})', sub: `\\min(${n(s.Vc, 2)} + ${n(s.Vs, 2)} + ${n(s.Vp, 2)},\\,0.25(${n(fc, 2)})(${n(G.bw, 2)})(${n(s.dv, 2)}) + ${n(s.Vp, 2)})`, value: s.Vn, unit: 'kip', d: 2, ref: A10 + 'Eq. 5.7.3.3-1, -2' }, Math.min(s.Vc + s.Vs + s.Vp, 0.25 * fc * G.bw * s.dv + s.Vp), P + 'Vn');
    add({ id: 'dc', label: 'Ratio at the critical section', sym: '\\frac{V_{u}}{\\phi V_{n}}', eq: '', sub: `\\frac{${n(s.Vu, 2)}}{${n(phiV, 2)}(${n(s.Vn, 2)})}`, value: s.dc, unit: '', d: 3, ref: A10 + '5.5.4.2 (φ = 0.90)' }, s.Vu / (phiV * s.Vn), P + 'dc');
    const kS = ckIx(R, 'Shear'), w = R.wShear;
    add({ id: 'gov', label: `Ratio where it governs (x = ${n(w.x, 2)} ft)`, sym: '\\frac{V_{u}}{\\phi V_{n}}', eq: '', sub: `\\frac{${n(w.Vu, 2)}}{${n(phiV, 2)}(${n(w.Vn, 2)})}`, value: R.checks[kS].r, unit: '', d: 3, ok: R.checks[kS].pass, note: 'The largest over the design stations from the critical section inward (the table).' }, w.Vu / (phiV * w.Vn), `checks.${kS}.r`);
    // spacing
    add({ id: 'vu', label: 'Shear stress on the concrete', sym: 'v_{u}', eq: '\\frac{|V_{u} - \\phi V_{p}|}{\\phi\\,b_{v}d_{v}}', sub: `\\frac{|${n(s.Vu, 2)} - ${n(phiV, 2)}(${n(s.Vp, 2)})|}{${n(phiV, 2)}(${n(G.bw, 2)})(${n(s.dv, 2)})}`, value: s.vu, unit: 'ksi', d: 3, ref: A10 + 'Eq. 5.7.2.8-1' }, Math.abs(s.Vu - phiV * s.Vp) / (phiV * G.bw * s.dv), P + 'vu');
    const low = s.vu < 0.125 * fc;
    add({ id: 'sMax', label: `Maximum stirrup spacing (v_u ${low ? '<' : '≥'} 0.125 f′c = ${n(0.125 * fc, 3)} ksi)`, sym: 's_{max}', eq: low ? '\\min(0.8\\,d_{v},\\,24)' : '\\min(0.4\\,d_{v},\\,12)', sub: low ? `\\min(0.8(${n(s.dv, 2)}),\\,24)` : `\\min(0.4(${n(s.dv, 2)}),\\,12)`, value: s.sMax, unit: 'in', d: 2, ref: A10 + 'Eq. 5.7.2.6-1, -2' }, low ? Math.min(0.8 * s.dv, 24) : Math.min(0.4 * s.dv, 12), P + 'sMax');
    add({ id: 'sMinR', label: 'Spacing for the minimum transverse reinforcement', sym: 's_{A_{v,min}}', eq: '\\frac{A_{v}f_{y}}{0.0316\\sqrt{f^{\\prime}_{c}}\\,b_{v}}', sub: `\\frac{${n(Av, 3)}(${n(fy, 0)})}{0.0316\\sqrt{${n(fc, 2)}}(${n(G.bw, 2)})}`, value: s.sMinR, unit: 'in', d: 2, ref: A10 + 'Eq. 5.7.2.5-1' }, Av * fy / (0.0316 * Math.sqrt(fc) * G.bw), P + 'sMinR');
    add({ id: 'sGov', label: 'Governing maximum spacing', sym: 's_{max,gov}', eq: '\\min(s_{max},\\,s_{A_{v,min}})', sub: `\\min(${n(s.sMax, 2)},\\,${n(s.sMinR, 2)})`, value: s.sMaxGov, unit: 'in', d: 2,
      note: `${s.stirReq ? 'Stirrups required here (V_u > 0.5 φ(V_c + V_p), 5.7.2.3): ' : 'Not required by 5.7.2.3 here (informational): '}s provided = ${n(s.sProv, 2)} in ${s.spOK ? '≤' : '>'} s_max,gov.` }, Math.min(s.sMax, s.sMinR), P + 'sMaxGov');
    // longitudinal tie (5.7.3.5)
    const VsCap = Math.min(s.Vs, s.Vu / phiV);
    add({ id: 'Tdem', label: 'Tension demand on the longitudinal reinforcement', sym: 'T', eq: '\\frac{|M_{u}|}{\\phi_{f}d_{v}} + \\left(\\frac{|V_{u}|}{\\phi_{v}} - 0.5\\,V_{s} - |V_{p}|\\right)\\cot\\theta', sub: `\\frac{${g(R.rv.MuU, 0)}}{0.9(${n(s.dv, 2)})} + \\left(\\frac{${n(s.Vu, 2)}}{0.9} - 0.5(${n(VsCap, 2)}) - ${n(Math.abs(s.Vp), 2)}\\right)(${n(s.cot, 4)})`, value: s.Tdem, unit: 'kip', d: 1, ref: A10 + 'Eq. 5.7.3.5-1',
      note: 'V_s not more than V_u/φ.' }, Math.abs(R.rv.MuU) / (s.dv * 0.9) + (Math.abs(s.Vu) / phiV - 0.5 * VsCap - Math.abs(s.Vp)) * s.cot, P + 'Tdem');
    add({ id: 'Tcap', label: 'Tension resistance: developed strands + bottom mild steel', sym: 'T_{r}', eq: '\\sum A_{p}f_{p,dev} + A_{s}f_{y}', sub: `${n(s.Tcap - s.TsMild, 1)} + ${n(s.TsMild, 1)}`, value: s.Tcap, unit: 'kip', d: 1, ref: A10 + '5.7.3.5, 5.9.4.3.2', note: 'Strand stress ramped over the transfer and development lengths from the girder end (each bond group).' }, (s.Tcap - s.TsMild) + s.TsMild, P + 'Tcap');
    const kL = ckIx(R, 'Long. reinf (5.7.3.5)'), wl = R.wLong;
    add({ id: 'Tr', label: `Ratio where the tie governs (x = ${n(wl.x, 2)} ft${wl.isBearing ? ', inside edge of the bearing: shear term only, Eq. 5.7.3.5-2' : ''})`, sym: '\\frac{T}{T_{r}}', eq: '', sub: `\\frac{${n(wl.Tdem, 1)}}{${n(wl.Tcap, 1)}}`, value: R.checks[kL].r, unit: '', d: 3, ok: R.checks[kL].pass }, wl.Tcap > 0 ? wl.Tdem / wl.Tcap : 0, `checks.${kL}.r`);
    // interface shear (5.7.4) at the critical section
    const I = R.iface[k0], Pi = `iface.${k0}.`;
    add({ id: 'vui', label: 'Interface shear stress (girder / deck)', sym: 'v_{ui}', eq: '\\frac{V_{u}}{b_{vi}d_{v}}', sub: `\\frac{${n(s.Vu, 2)}}{${n(G.btf, 2)}(${n(s.dv, 2)})}`, value: I.vui, unit: 'ksi', d: 4, ref: A10 + 'Eq. 5.7.4.5-1', note: 'b_vi: the girder top flange width.' }, s.Vu / (G.btf * s.dv), Pi + 'vui');
    add({ id: 'Avfreq', label: 'Interface steel required per foot', sym: 'A_{vf,req}', eq: '\\frac{V_{ui}/\\phi - c\\,A_{cv}}{\\mu\\,f_{y}}', sub: `\\frac{${n(I.Vui, 2)}/${n(phiV, 2)} - 0.28(${n(G.btf * 12, 1)})}{1.0(${n(fy, 0)})}`, value: I.AvfReq, unit: 'in^{2}/ft', d: 3, ref: A10 + 'Eq. 5.7.4.3-3', note: 'c = 0.28 ksi, μ = 1.0 (roughened surface); not less than 0.' }, Math.max((I.Vui / phiV - 0.28 * G.btf * 12) / fy, 0), Pi + 'AvfReq');
    add({ id: 'Avfmin', label: 'Minimum interface steel per foot', sym: 'A_{vf,min}', eq: '\\frac{0.05\\,A_{cv}}{f_{y}}', sub: `\\frac{0.05(${n(G.btf * 12, 1)})}{${n(fy, 0)}}`, value: I.AvfMin, unit: 'in^{2}/ft', d: 3, ref: A10 + 'Eq. 5.7.4.2-1', note: I.minWaived ? 'Waived: v_ui < 0.210 ksi (5.7.4.2).' : '' }, 0.05 * G.btf * 12 / fy, Pi + 'AvfMin');
    add({ id: 'Avfprov', label: 'Interface steel provided per foot (the stirrups)', sym: 'A_{vf}', eq: '\\frac{12\\,A_{v}}{s}', sub: `\\frac{12(${n(Av, 3)})}{${n(s.sProv, 2)}}`, value: I.AvfProv, unit: 'in^{2}/ft', d: 3 }, 12 * Av / s.sProv, Pi + 'AvfProv');
    const kI = ckIx(R, 'Interface shear (5.7.4)'), wI = R.wIface;
    add({ id: 'ifr', label: `Ratio, interface shear where it governs (x = ${n(wI.x, 2)} ft)`, sym: 'D/C', eq: '\\max\\left(\\frac{V_{ui}/\\phi}{V_{ni}},\\,\\frac{V_{ui}/\\phi}{V_{ni,max}},\\,\\frac{A_{vf,min}}{A_{vf}}\\right)', sub: `\\max(${n(wI.rStr, 3)},\\,${n(wI.rCap, 3)},\\,${n(wI.rMin, 3)})`, value: R.checks[kI].r, unit: '', d: 3, ok: R.checks[kI].pass, ref: A10 + '5.7.4.3' }, Math.max(wI.rStr, wI.rCap, wI.rMin), `checks.${kI}.r`);
    // development (5.9.4.3.2)
    const fpsM = R.fMid.fps || R.fpe;
    add({ id: 'lt', label: 'Transfer length', sym: '\\ell_{t}', eq: '60\\,d_{b}', sub: `60(${n(ss.st.db, 3)})`, value: ss.lt, unit: 'in', d: 1, ref: A10 + '5.9.4.3.1' }, 60 * ss.st.db, 'ss.lt');
    add({ id: 'ldB', label: 'Development length, bonded strand', sym: '\\ell_{d}', eq: '1.6\\left(f_{ps} - \\frac{2}{3}f_{pe}\\right)d_{b}', sub: `1.6\\left(${n(fpsM, 2)} - \\frac{2}{3}(${n(R.fpe, 2)})\\right)(${n(ss.st.db, 3)})`, value: R.ldBonded, unit: 'in', d: 1, ref: A10 + 'Eq. 5.9.4.3.2-1', note: 'κ = 1.6; f_ps at midspan (Flexure tab).' }, 1.6 * (fpsM - 2 / 3 * R.fpe) * ss.st.db, 'ldBonded');
    add({ id: 'ldD', label: 'Development length, debonded strand', sym: '\\ell_{d}', eq: '2.0\\left(f_{ps} - \\frac{2}{3}f_{pe}\\right)d_{b}', sub: `2.0\\left(${n(fpsM, 2)} - \\frac{2}{3}(${n(R.fpe, 2)})\\right)(${n(ss.st.db, 3)})`, value: R.ldDebond, unit: 'in', d: 1, ref: A10 + '5.9.4.3.3' }, 2.0 * (fpsM - 2 / 3 * R.fpe) * ss.st.db, 'ldDebond');
    return K.done();
  }
  window.PSBWorkedStrength = { flexure, shear };
})();
