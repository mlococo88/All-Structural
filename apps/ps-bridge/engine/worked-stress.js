/* apps/ps-bridge/engine/worked-stress.js — the worked steps of the Losses and Stresses tabs (window.PSBWorkedStress). Classic script, no DOM.
   Created 2026-11-12 (PR 2c-1, docs/ps-bridge-plan.md §3 "Tabs and graphics": every number on a tab comes from computeAll, no second
   calculation; the steps substitute the engine's values and a test asserts each step's result equals the engine value).
   Uses window.PSBWorked (engine/worked.js: kit, n, g, par) and window.SharedSteps (CLAUDE.md §6: equation → values substituted → result).

   losses(inp, R), stresses(inp, R) -> { steps, pairs, paths }
     inp: the engine inputs of the design (engine/design.js inputs(P)); R: computeAll(inp) (no error).
     steps: each step's value IS the engine's value (R...), except the few display intermediates the engine does not keep (named in their
            note: the transformed section at a release station, the deck-shrinkage terms of Δf_pSS, the steel stress of the crack check);
     pairs: [{ id, shown, engine }]: the step's expression evaluated from its substituted full-precision values against the engine's value
            (tests/engine/psbridge-tabs.test.mjs: they agree to 1e-9);
     paths: { stepId: 'R path' } where the step's value is in R (tests/psbridge-compare.mjs compares it with the old app's computeAll).
   The expressions are those of the moved engine (pbd-losses-ll.js losses, pbd-compute.js computeAll: elastic gains, per-row stages, stress
   limits, stationStress, the 5.12.3.3.5 service checks, Fatigue I, crack control), written out for display. Code basis AASHTO LRFD 10th Ed. (2024). */
(function () {
  'use strict';
  const PW = () => window.PSBWorked;
  const A10 = 'AASHTO LRFD 10th Ed. ';
  const near = (rows, x) => rows.reduce((b, r, i) => Math.abs(r.x - x) < Math.abs(rows[b].x - x) ? i : b, 0);
  const ownOf = R => { const o = R.own || {}; return { eta: o.eta === undefined ? 1 : o.eta, mLL: o.mLL === undefined ? 1 : o.mLL }; };
  const ckIx = (R, name) => R.checks.findIndex(c => c.n === name);

  /* ---------- Losses (5.9.3): elastic shortening, approximate and refined long-term losses, elastic gains, stages per strand row ---------- */
  function losses(inp, R) {
    const { kit, n, g, par } = PW(), K = kit('ls'), add = K.add;
    const G = R.g, cp = R.cp, ss = R.ss, lo = R.lo, rf = lo.ref, fin = R.refFin, m = inp.mat, Ep = lo.Ep, em = ss.eMid, rv = R.rv, L = R.L;
    const fpu = +inp.str.fpu, jack = +inp.str.jack, lowlax = !!inp.str.lowlax, Aps = ss.Aps, A = G.A, I = G.I, Eci = lo.Eci, Ecf = lo.Ecf;
    const mid = R.grid[near(R.grid, L / 2)];
    // elastic shortening (C5.9.3.2.3a)
    add({ id: 'fpbt', label: 'Strand stress immediately before transfer', sym: 'f_{pbt}', eq: 'k_{j}\\,f_{pu}', sub: `${n(jack, 3)}(${n(fpu, 1)})`, value: R.fpbt, unit: 'ksi', d: 2, ref: A10 + 'Table 5.9.2.2-1', note: 'k_j: the jacking ratio (Materials tab).' }, jack * fpu, 'fpbt');
    add({ id: 'Eci', label: 'Modulus of elasticity of the girder concrete at transfer', sym: 'E_{ci}', eq: '120{,}000\\,K_{1}\\,w_{c}^{2}\\,f^{\\prime}_{ci}{}^{0.33}', sub: `120{,}000(1.0)(${n(+m.wc, 3)})^{2}(${n(+m.fci, 2)})^{0.33}`, value: Eci, unit: 'ksi', d: 0, ref: A10 + 'Eq. 5.4.2.4-1' }, 120000 * m.wc * m.wc * Math.pow(m.fci, 0.33), 'lo.Eci');
    add({ id: 'Mg', label: 'Girder self-weight moment at midspan', sym: 'M_{g}', eq: '\\frac{w_{g}\\,L^{2}}{8}\\times 12', sub: `\\frac{${n(R.wG, 4)}(${n(L, 2)})^{2}}{8}\\times 12`, value: rv.MgM, unit: 'kip-in', d: 0 }, R.wG * L * L / 8 * 12, 'rv.MgM');
    add({ id: 'X1', label: 'Term of the closed-form solution', sym: 'I_{g} + e_{m}^{2}A_{g}', eq: '', sub: `${g(I, 0)} + (${n(em, 3)})^{2}(${n(A, 1)})`, value: rv.X1, unit: 'in^{4}', d: 0 }, I + em * em * A, 'rv.X1');
    add({ id: 'dfES', label: 'Loss from elastic shortening (closed form, no iteration on P_i)', sym: '\\Delta f_{pES}', eq: '\\frac{A_{ps}f_{pbt}(I_{g} + e_{m}^{2}A_{g}) - e_{m}M_{g}A_{g}}{A_{ps}(I_{g} + e_{m}^{2}A_{g}) + \\frac{A_{g}I_{g}E_{ci}}{E_{p}}}',
      sub: `\\frac{${n(Aps, 3)}(${n(R.fpbt, 2)})(${g(rv.X1, 0)}) - ${n(em, 3)}(${g(rv.MgM, 0)})(${n(A, 1)})}{${n(Aps, 3)}(${g(rv.X1, 0)}) + \\frac{${n(A, 1)}(${g(I, 0)})(${n(Eci, 0)})}{${n(Ep, 0)}}}`, value: lo.dfES, unit: 'ksi', d: 2, ref: A10 + 'Eq. C5.9.3.2.3a-1',
      note: 'e_m: the strand eccentricity at midspan (Section properties tab); the losses are computed at midspan and applied along the girder.' }, (Aps * R.fpbt * rv.X1 - em * rv.MgM * A) / (Aps * rv.X1 + A * I * Eci / Ep), 'lo.dfES');
    add({ id: 'fpt', label: 'Strand stress after transfer', sym: 'f_{pt} = f_{pi}', eq: 'f_{pbt} - \\Delta f_{pES}', sub: `${n(R.fpbt, 2)} - ${n(lo.dfES, 2)}`, value: lo.fpt, unit: 'ksi', d: 2 }, R.fpbt - lo.dfES, 'lo.fpt');
    add({ id: 'Pi', label: 'Prestress force after transfer', sym: 'P_{i}', eq: 'A_{ps}\\,f_{pt}', sub: `${n(Aps, 3)}(${n(lo.fpt, 2)})`, value: lo.Pi, unit: 'kip', d: 1 }, Aps * lo.fpt, 'lo.Pi');
    add({ id: 'fcgp', label: 'Concrete stress at the strand centroid after transfer', sym: 'f_{cgp}', eq: '\\frac{P_{i}}{A_{g}} + \\frac{P_{i}e_{m}^{2}}{I_{g}} - \\frac{M_{g}e_{m}}{I_{g}}', sub: `\\frac{${n(lo.Pi, 1)}}{${n(A, 1)}} + \\frac{${n(lo.Pi, 1)}(${n(em, 3)})^{2}}{${g(I, 0)}} - \\frac{${g(rv.MgM, 0)}(${n(em, 3)})}{${g(I, 0)}}`, value: lo.fcgp, unit: 'ksi', d: 3 },
      lo.Pi / A + lo.Pi * em * em / I - rv.MgM * em / I, 'lo.fcgp');
    // approximate long-term losses (5.9.3.3)
    const used = inp.opt.lossMethod === 'refined' ? 'refined' : 'approximate';
    const nu = which => which === used ? '' : ` Not used: the ${used} method is selected (Materials tab).`;
    add({ id: 'apx.gh', label: 'Correction factor for relative humidity', sym: '\\gamma_{h}', eq: '1.7 - 0.01\\,H', sub: `1.7 - 0.01(${n(+m.H, 0)})`, value: rv.gh, unit: '', d: 3, ref: A10 + 'Eq. 5.9.3.3-2' }, 1.7 - 0.01 * m.H, 'rv.gh');
    add({ id: 'apx.gst', label: 'Correction factor for the concrete strength at transfer', sym: '\\gamma_{st}', eq: '\\frac{5}{1 + f^{\\prime}_{ci}}', sub: `\\frac{5}{1 + ${n(+m.fci, 2)}}`, value: rv.gst, unit: '', d: 3, ref: A10 + 'Eq. 5.9.3.3-3' }, 5 / (1 + +m.fci), 'rv.gst');
    add({ id: 'apx.shcr', label: 'Long-term loss from creep and shrinkage (approximate)', sym: '\\Delta f_{pCR+SR}', eq: '10\\frac{f_{pi}A_{ps}}{A_{g}}\\gamma_{h}\\gamma_{st} + 12\\,\\gamma_{h}\\gamma_{st}', sub: `10\\frac{${n(R.fpbt, 2)}(${n(Aps, 3)})}{${n(A, 1)}}(${n(rv.gh, 3)})(${n(rv.gst, 3)}) + 12(${n(rv.gh, 3)})(${n(rv.gst, 3)})`, value: lo.apx.SH_CR, unit: 'ksi', d: 3, ref: A10 + 'Eq. 5.9.3.3-1',
      note: 'f_pi in Eq. 5.9.3.3-1: the stress before transfer f_pbt (as the engine).' + nu('approximate') }, 10 * (R.fpbt * Aps / A) * rv.gh * rv.gst + 12 * rv.gh * rv.gst, 'lo.apx.SH_CR');
    add({ id: 'apx.R', label: 'Relaxation loss (approximate)', sym: '\\Delta f_{pR}', value: lo.apx.R, unit: 'ksi', d: 1, ref: A10 + '5.9.3.3', note: lowlax ? 'Low-relaxation strand: 2.4 ksi.' : 'Stress-relieved strand: 10.0 ksi.' }, undefined, 'lo.apx.R');
    add({ id: 'apx.total', label: 'Long-term loss (approximate)', sym: '\\Delta f_{pLT}', eq: '\\Delta f_{pCR+SR} + \\Delta f_{pR}', sub: `${n(lo.apx.SH_CR, 3)} + ${n(lo.apx.R, 1)}`, value: lo.apx.total, unit: 'ksi', d: 3, ref: A10 + 'Eq. 5.9.3.3-1', note: nu('approximate').trim() }, lo.apx.SH_CR + lo.apx.R, 'lo.apx.total');
    // refined long-term losses (5.9.3.4)
    const ti = +m.ti, td = +m.td, tf = +m.tfin;
    add({ id: 'ref.ks', label: 'Factor for the volume-to-surface ratio', sym: 'k_{s}', eq: '\\max\\left(1.45 - 0.13\\,\\frac{V}{S},\\,1.0\\right)', sub: `\\max(1.45 - 0.13(${n(+m.VS, 2)}),\\,1.0)`, value: rf.ks, unit: '', d: 3, ref: A10 + 'Eq. 5.4.2.3.2-2' }, Math.max(1.45 - 0.13 * m.VS, 1.0), 'lo.ref.ks');
    add({ id: 'ref.khs', label: 'Humidity factor for shrinkage', sym: 'k_{hs}', eq: '2.00 - 0.014\\,H', sub: `2.00 - 0.014(${n(+m.H, 0)})`, value: rf.khs, unit: '', d: 3, ref: A10 + 'Eq. 5.4.2.3.3-2' }, 2.00 - 0.014 * m.H, 'lo.ref.khs');
    add({ id: 'ref.khc', label: 'Humidity factor for creep', sym: 'k_{hc}', eq: '1.56 - 0.008\\,H', sub: `1.56 - 0.008(${n(+m.H, 0)})`, value: rf.khc, unit: '', d: 3, ref: A10 + 'Eq. 5.4.2.3.2-3' }, 1.56 - 0.008 * m.H, 'lo.ref.khc');
    add({ id: 'ref.kf', label: 'Factor for the effect of concrete strength', sym: 'k_{f}', eq: '\\frac{5}{1 + f^{\\prime}_{ci}}', sub: `\\frac{5}{1 + ${n(+m.fci, 2)}}`, value: rf.kf, unit: '', d: 3, ref: A10 + 'Eq. 5.4.2.3.2-4' }, 5 / (1 + +m.fci), 'lo.ref.kf');
    add({ id: 'ref.ktdK', label: 'Time-development term', sym: 'K_{td}', eq: '12\\,\\frac{100 - 4f^{\\prime}_{ci}}{f^{\\prime}_{ci} + 20}', sub: `12\\,\\frac{100 - 4(${n(+m.fci, 2)})}{${n(+m.fci, 2)} + 20}`, value: rv.ktdK, unit: 'days', d: 2, ref: A10 + 'Eq. 5.4.2.3.2-5', note: 'k_td(t) = t / (K_td + t).' }, 12 * (100 - 4 * m.fci) / (+m.fci + 20), 'rv.ktdK');
    add({ id: 'ref.ktdID', label: 'Time-development factor, transfer to deck placement', sym: 'k_{td}^{id}', eq: '\\frac{t_{d} - t_{i}}{K_{td} + (t_{d} - t_{i})}', sub: `\\frac{${n(td - ti, 0)}}{${n(rv.ktdK, 2)} + ${n(td - ti, 0)}}`, value: rv.ktdID, unit: '', d: 4, ref: A10 + 'Eq. 5.4.2.3.2-5' }, (td - ti) / (rv.ktdK + td - ti), 'rv.ktdID');
    add({ id: 'ref.ktdIF', label: 'Time-development factor, transfer to final', sym: 'k_{td}^{if}', eq: '\\frac{t_{f} - t_{i}}{K_{td} + (t_{f} - t_{i})}', sub: `\\frac{${n(tf - ti, 0)}}{${n(rv.ktdK, 2)} + ${n(tf - ti, 0)}}`, value: rv.ktdIF, unit: '', d: 4 }, (tf - ti) / (rv.ktdK + tf - ti), 'rv.ktdIF');
    add({ id: 'ref.ktdDF', label: 'Time-development factor, deck placement to final', sym: 'k_{td}^{df}', eq: '\\frac{t_{f} - t_{d}}{K_{td} + (t_{f} - t_{d})}', sub: `\\frac{${n(tf - td, 0)}}{${n(rv.ktdK, 2)} + ${n(tf - td, 0)}}`, value: rv.ktdDF, unit: '', d: 4 }, (tf - td) / (rv.ktdK + tf - td), 'rv.ktdDF');
    add({ id: 'ref.eShID', label: 'Girder shrinkage strain, transfer to deck placement', sym: '\\varepsilon_{bid}', eq: 'k_{s}k_{hs}k_{f}k_{td}^{id}(0.48\\times 10^{-3})', sub: `${n(rf.ks, 3)}(${n(rf.khs, 3)})(${n(rf.kf, 3)})(${n(rv.ktdID, 4)})(0.48\\times 10^{-3})`, value: rf.eShID, unit: '', d: 6, ref: A10 + 'Eq. 5.4.2.3.3-1' }, rf.ks * rf.khs * rf.kf * rv.ktdID * 0.48e-3, 'lo.ref.eShID');
    add({ id: 'ref.eShIF', label: 'Girder shrinkage strain, transfer to final', sym: '\\varepsilon_{bif}', eq: 'k_{s}k_{hs}k_{f}k_{td}^{if}(0.48\\times 10^{-3})', sub: `${n(rf.ks, 3)}(${n(rf.khs, 3)})(${n(rf.kf, 3)})(${n(rv.ktdIF, 4)})(0.48\\times 10^{-3})`, value: rf.eShIF, unit: '', d: 6, ref: A10 + 'Eq. 5.4.2.3.3-1' }, rf.ks * rf.khs * rf.kf * rv.ktdIF * 0.48e-3, 'lo.ref.eShIF');
    const psi = (id, lab, sym, kt, ktS, t0, path, v) => add({ id, label: lab, sym, eq: `1.9\\,k_{s}k_{hc}k_{f}${ktS}\\,t_{${t0 === td ? 'd' : 'i'}}^{-0.118}`, sub: `1.9(${n(rf.ks, 3)})(${n(rf.khc, 3)})(${n(rf.kf, 3)})(${n(kt, 4)})(${n(t0, 0)})^{-0.118}`, value: v, unit: '', d: 4, ref: A10 + 'Eq. 5.4.2.3.2-1' },
      1.9 * rf.ks * rf.khc * rf.kf * kt * Math.pow(t0, -0.118), path);
    psi('ref.psiBID', 'Girder creep coefficient, transfer to deck placement', '\\psi_{b}(t_{d},t_{i})', rv.ktdID, 'k_{td}^{id}', ti, 'lo.ref.psiBID', rf.psiBID);
    psi('ref.psiBIF', 'Girder creep coefficient, transfer to final', '\\psi_{b}(t_{f},t_{i})', rv.ktdIF, 'k_{td}^{if}', ti, 'lo.ref.psiBIF', rf.psiBIF);
    psi('ref.psiBDF', 'Girder creep coefficient, deck placement to final', '\\psi_{b}(t_{f},t_{d})', rv.ktdDF, 'k_{td}^{df}', td, 'lo.ref.psiBDF', rf.psiBDF);
    add({ id: 'ref.Kid', label: 'Transformed-section factor, transfer to deck placement', sym: 'K_{id}', eq: '\\frac{1}{1 + \\frac{E_{p}}{E_{ci}}\\frac{A_{ps}}{A_{g}}\\left(1 + \\frac{A_{g}e_{m}^{2}}{I_{g}}\\right)(1 + 0.7\\,\\psi_{b}(t_{f},t_{i}))}',
      sub: `\\frac{1}{1 + \\frac{${n(Ep, 0)}}{${n(Eci, 0)}}\\frac{${n(Aps, 3)}}{${n(A, 1)}}\\left(1 + \\frac{${n(A, 1)}(${n(em, 3)})^{2}}{${g(I, 0)}}\\right)(1 + 0.7(${n(rf.psiBIF, 4)}))}`, value: rf.Kid, unit: '', d: 4, ref: A10 + 'Eq. 5.9.3.4.2a-2' },
      1 / (1 + (Ep / Eci) * (Aps / A) * (1 + A * em * em / I) * (1 + 0.7 * rf.psiBIF)), 'lo.ref.Kid');
    add({ id: 'ref.dfSR', label: 'Shrinkage loss, transfer to deck placement', sym: '\\Delta f_{pSR}', eq: '\\varepsilon_{bid}\\,E_{p}\\,K_{id}', sub: `${n(rf.eShID, 7)}(${n(Ep, 0)})(${n(rf.Kid, 4)})`, value: rf.dfSR, unit: 'ksi', d: 3, ref: A10 + 'Eq. 5.9.3.4.2a-1' }, rf.eShID * Ep * rf.Kid, 'lo.ref.dfSR');
    add({ id: 'ref.dfCR', label: 'Creep loss, transfer to deck placement', sym: '\\Delta f_{pCR}', eq: '\\frac{E_{p}}{E_{ci}}f_{cgp}\\,\\psi_{b}(t_{d},t_{i})\\,K_{id}', sub: `\\frac{${n(Ep, 0)}}{${n(Eci, 0)}}(${n(lo.fcgp, 3)})(${n(rf.psiBID, 4)})(${n(rf.Kid, 4)})`, value: rf.dfCR, unit: 'ksi', d: 3, ref: A10 + 'Eq. 5.9.3.4.2b-1' }, (Ep / Eci) * lo.fcgp * rf.psiBID * rf.Kid, 'lo.ref.dfCR');
    const KL = lowlax ? 30 : 7;
    add({ id: 'ref.dfR1', label: 'Relaxation loss, transfer to deck placement', sym: '\\Delta f_{pR1}', eq: `\\frac{f_{pt}}{K_{L}}\\left(\\frac{f_{pt}}{f_{py}} - 0.55\\right)`, sub: `\\frac{${n(lo.fpt, 2)}}{${KL}}\\left(\\frac{${n(lo.fpt, 2)}}{${n(lo.fpy, 1)}} - 0.55\\right)`, value: rf.dfR1, unit: 'ksi', d: 3, ref: A10 + 'Eq. 5.9.3.4.2c-1', note: `K_L = ${KL} (${lowlax ? 'low-relaxation' : 'stress-relieved'} strand); f_py = ${lowlax ? '0.90' : '0.85'} f_pu; not less than 0.` },
      Math.max((lo.fpt / KL) * (lo.fpt / lo.fpy - 0.55), 0), 'lo.ref.dfR1');
    add({ id: 'ref.epc', label: 'Strand eccentricity on the composite section at midspan', sym: 'e_{pc}', eq: 'y_{bc} - y_{ps}', sub: `${n(cp.ybc, 3)} - ${n(ss.cgsMid, 3)}`, value: rf.epc, unit: 'in', d: 3 }, cp.ybc - ss.cgsMid, 'lo.ref.epc');
    add({ id: 'ref.Kdf', label: 'Transformed-section factor, deck placement to final', sym: 'K_{df}', eq: '\\frac{1}{1 + \\frac{E_{p}}{E_{ci}}\\frac{A_{ps}}{A_{c}}\\left(1 + \\frac{A_{c}e_{pc}^{2}}{I_{c}}\\right)(1 + 0.7\\,\\psi_{b}(t_{f},t_{i}))}',
      sub: `\\frac{1}{1 + \\frac{${n(Ep, 0)}}{${n(Eci, 0)}}\\frac{${n(Aps, 3)}}{${n(cp.Ac, 1)}}\\left(1 + \\frac{${n(cp.Ac, 1)}(${n(rf.epc, 3)})^{2}}{${g(cp.Ic, 0)}}\\right)(1 + 0.7(${n(rf.psiBIF, 4)}))}`, value: rf.Kdf, unit: '', d: 4, ref: A10 + 'Eq. 5.9.3.4.3a-2' },
      1 / (1 + (Ep / Eci) * (Aps / cp.Ac) * (1 + cp.Ac * rf.epc * rf.epc / cp.Ic) * (1 + 0.7 * rf.psiBIF)), 'lo.ref.Kdf');
    add({ id: 'ref.dfSD', label: 'Shrinkage loss of the girder, deck placement to final', sym: '\\Delta f_{pSD}', eq: '(\\varepsilon_{bif} - \\varepsilon_{bid})\\,E_{p}\\,K_{df}', sub: `(${n(rf.eShIF, 7)} - ${n(rf.eShID, 7)})(${n(Ep, 0)})(${n(rf.Kdf, 4)})`, value: rf.dfSD, unit: 'ksi', d: 3, ref: A10 + 'Eq. 5.9.3.4.3a-1' }, (rf.eShIF - rf.eShID) * Ep * rf.Kdf, 'lo.ref.dfSD');
    add({ id: 'ref.dfcd', label: 'Change in concrete stress at the strand centroid from the loads after transfer (midspan)', sym: '\\Delta f_{cd}', eq: '-\\left[\\frac{M_{DC1}\\,e_{m}}{I_{g}} + \\frac{(M_{DC2} + M_{DW})\\,e_{pc}}{I_{c}}\\right]',
      sub: `-\\left[\\frac{${g(mid.Mdk, 0)}(${n(em, 3)})}{${g(I, 0)}} + \\frac{${g(mid.Msd, 0)}(${n(rf.epc, 3)})}{${g(cp.Ic, 0)}}\\right]`, value: R.dfcd, unit: 'ksi', d: 3, ref: A10 + '5.9.3.4.3b', note: 'Moments in kip-in at midspan (Analysis tab): DC1 on the girder, DC2 + DW on the composite section.' },
      -(mid.Mdk * em / I + mid.Msd * rf.epc / cp.Ic), 'dfcd');
    add({ id: 'ref.dfCD', label: 'Creep loss of the girder, deck placement to final', sym: '\\Delta f_{pCD}', eq: '\\frac{E_{p}}{E_{ci}}f_{cgp}(\\psi_{b}(t_{f},t_{i}) - \\psi_{b}(t_{d},t_{i}))K_{df} + \\frac{E_{p}}{E_{c}}\\Delta f_{cd}\\,\\psi_{b}(t_{f},t_{d})\\,K_{df}',
      sub: `\\frac{${n(Ep, 0)}}{${n(Eci, 0)}}(${n(lo.fcgp, 3)})(${n(rf.psiBIF, 4)} - ${n(rf.psiBID, 4)})(${n(rf.Kdf, 4)}) + \\frac{${n(Ep, 0)}}{${n(Ecf, 0)}}(${n(R.dfcd, 3)})(${n(rf.psiBDF, 4)})(${n(rf.Kdf, 4)})`, value: fin.dfCD, unit: 'ksi', d: 3, ref: A10 + 'Eq. 5.9.3.4.3b-1' },
      (Ep / Eci) * lo.fcgp * (rf.psiBIF - rf.psiBID) * rf.Kdf + (Ep / Ecf) * R.dfcd * rf.psiBDF * rf.Kdf, 'refFin.dfCD');
    add({ id: 'ref.dfR2', label: 'Relaxation loss, deck placement to final', sym: '\\Delta f_{pR2}', eq: '\\Delta f_{pR1}', sub: n(rf.dfR1, 3), value: fin.dfR2, unit: 'ksi', d: 3, ref: A10 + 'Eq. 5.9.3.4.3c-1' }, rf.dfR1, 'refFin.dfR2');
    // deck shrinkage gain (5.9.3.4.3d)
    const ts = +inp.ts;
    if (inp.opt.dfpSSauto && ts > 0) {
      const ddt = tf - td, kfd = 5 / (1 + +m.fcd), ktdD = ktdAASHTO(ddt, m.fcd), eDdf = rf.ks * rf.khs * kfd * ktdD * 0.48e-3, psiD = 1.9 * rf.ks * rf.khc * kfd * ktdD;
      const Acd = cp.beff * ts, edd = cp.hc - ts / 2 - cp.ybc, dfcdf = -eDdf * cp.Ecd * Acd / (1 + 0.7 * psiD) * (1 / cp.Ac - rf.epc * edd / cp.Ic);
      const DI = 'Display intermediate (the engine\'s expression, 5.9.3.4.3d; the engine keeps only Δf_pSS).';
      add({ id: 'ss.eDdf', label: 'Deck shrinkage strain after the deck is cast', sym: '\\varepsilon_{ddf}', eq: 'k_{s}k_{hs}k_{f,d}k_{td,d}(0.48\\times 10^{-3})', sub: `${n(rf.ks, 3)}(${n(rf.khs, 3)})(${n(kfd, 3)})(${n(ktdD, 4)})(0.48\\times 10^{-3})`, value: eDdf, unit: '', d: 6, ref: A10 + 'Eq. 5.4.2.3.3-1', note: `k_f,d = 5/(1 + f′c,deck), k_td,d at t_f − t_d = ${n(ddt, 0)} days with f′c,deck. ` + DI });
      add({ id: 'ss.psiD', label: 'Deck creep coefficient', sym: '\\psi_{d}', eq: '1.9\\,k_{s}k_{hc}k_{f,d}k_{td,d}', sub: `1.9(${n(rf.ks, 3)})(${n(rf.khc, 3)})(${n(kfd, 3)})(${n(ktdD, 4)})`, value: psiD, unit: '', d: 4, ref: A10 + 'Eq. 5.4.2.3.2-1', note: 'Deck loaded young (t_i = 1 day). ' + DI });
      add({ id: 'ss.dfcdf', label: 'Change in concrete stress at the strand centroid from deck shrinkage', sym: '\\Delta f_{cdf}', eq: '-\\frac{\\varepsilon_{ddf}\\,E_{cd}\\,A_{d}}{1 + 0.7\\,\\psi_{d}}\\left(\\frac{1}{A_{c}} - \\frac{e_{pc}\\,e_{d}}{I_{c}}\\right)',
        sub: `-\\frac{${n(eDdf, 7)}(${n(cp.Ecd, 0)})(${n(Acd, 1)})}{1 + 0.7(${n(psiD, 4)})}\\left(\\frac{1}{${n(cp.Ac, 1)}} - \\frac{${n(rf.epc, 3)}(${n(edd, 3)})}{${g(cp.Ic, 0)}}\\right)`, value: dfcdf, unit: 'ksi', d: 4, ref: A10 + 'Eq. 5.9.3.4.3d-2', note: `A_d = b_eff t_s (gross deck), e_d = h_c − t_s/2 − y_bc. ` + DI });
      add({ id: 'ss.dfSS', label: 'Prestress gain from deck shrinkage', sym: '\\Delta f_{pSS}', eq: '\\frac{E_{p}}{E_{c}}\\Delta f_{cdf}\\,K_{df}(1 + 0.7\\,\\psi_{b}(t_{f},t_{d}))', sub: `\\frac{${n(Ep, 0)}}{${n(Ecf, 0)}}(${n(dfcdf, 4)})(${n(rf.Kdf, 4)})(1 + 0.7(${n(rf.psiBDF, 4)}))`, value: fin.dfSS, unit: 'ksi', d: 3, ref: A10 + 'Eq. 5.9.3.4.3d-1',
        note: 'A gain (it reduces the long-term loss). Computed (Materials tab).' }, (Ep / Ecf) * dfcdf * rf.Kdf * (1 + 0.7 * rf.psiBDF), 'refFin.dfSS');
    } else add({ id: 'ss.dfSS', label: 'Prestress gain from deck shrinkage', sym: '\\Delta f_{pSS}', value: fin.dfSS, unit: 'ksi', d: 3, ref: A10 + '5.9.3.4.3d', note: inp.opt.dfpSSauto ? 'No deck (t_s = 0): 0.' : 'Entered (Materials tab).' }, undefined, 'refFin.dfSS');
    add({ id: 'ref.total', label: 'Long-term loss (refined)', sym: '\\Delta f_{pLT}', eq: '\\Delta f_{pSR} + \\Delta f_{pCR} + \\Delta f_{pR1} + \\Delta f_{pSD} + \\Delta f_{pCD} + \\Delta f_{pR2} - \\Delta f_{pSS}',
      sub: `${n(rf.dfSR, 3)} + ${n(rf.dfCR, 3)} + ${n(rf.dfR1, 3)} + ${n(rf.dfSD, 3)} + ${par(fin.dfCD, 3)} + ${n(fin.dfR2, 3)} - ${par(fin.dfSS, 3)}`, value: fin.total, unit: 'ksi', d: 3, ref: A10 + 'Eq. 5.9.3.4.1-1', note: nu('refined').trim() },
      rf.dfSR + rf.dfCR + rf.dfR1 + rf.dfSD + fin.dfCD + fin.dfR2 - fin.dfSS, 'refFin.total');
    // totals
    add({ id: 'LT', label: `Long-term loss used (${used} method)`, sym: '\\Delta f_{pLT}', value: R.LT, unit: 'ksi', d: 3, note: `The ${used} method is selected on the Materials tab; applied to every check.` }, undefined, 'LT');
    add({ id: 'total', label: 'Total loss', sym: '\\Delta f_{pT}', eq: '\\Delta f_{pES} + \\Delta f_{pLT}', sub: `${n(lo.dfES, 3)} + ${n(R.LT, 3)}`, value: R.totalLoss, unit: 'ksi', d: 2, ref: A10 + 'Eq. 5.9.3.1-1' }, lo.dfES + R.LT, 'totalLoss');
    add({ id: 'pct', label: 'Total loss as a share of the stress before transfer', sym: '\\frac{\\Delta f_{pT}}{f_{pbt}}', eq: '', sub: `\\frac{${n(R.totalLoss, 2)}}{${n(R.fpbt, 2)}}\\times 100`, value: R.pctLoss, unit: 'percent', d: 1 }, R.totalLoss / R.fpbt * 100, 'pctLoss');
    add({ id: 'fpe', label: 'Effective prestress after all losses', sym: 'f_{pe}', eq: 'f_{pbt} - \\Delta f_{pES} - \\Delta f_{pLT}', sub: `${n(R.fpbt, 2)} - ${n(lo.dfES, 2)} - ${n(R.LT, 3)}`, value: R.fpe, unit: 'ksi', d: 2, note: 'Without elastic gains: the value the service checks use.' }, R.fpbt - lo.dfES - R.LT, 'fpe');
    add({ id: 'Pe', label: 'Effective prestress force (all strands)', sym: 'P_{e}', eq: 'A_{ps}\\,f_{pe}', sub: `${n(Aps, 3)}(${n(R.fpe, 2)})`, value: Aps * R.fpe, unit: 'kip', d: 0, note: 'Display product of two engine values.' }, Aps * R.fpe);
    // elastic gains (C5.9.3.4.3)
    const gn = R.gains, epc = rf.epc;
    add({ id: 'gain.pc', label: 'Elastic gain from DC1 (deck, haunch, diaphragms) on the girder', sym: '\\Delta f_{p,DC1}', eq: '\\frac{E_{p}}{E_{c}}\\frac{M_{DC1}\\,e_{m}}{I_{g}}', sub: `\\frac{${n(Ep, 0)}}{${n(Ecf, 0)}}\\frac{${g(mid.Mdk, 0)}(${n(em, 3)})}{${g(I, 0)}}`, value: gn.precast, unit: 'ksi', d: 3, ref: A10 + 'C5.9.3.4.3' }, (Ep / Ecf) * (mid.Mdk * em / I), 'gains.precast');
    add({ id: 'gain.cmp', label: 'Elastic gain from DC2 + DW on the composite section', sym: '\\Delta f_{p,SD}', eq: '\\frac{E_{p}}{E_{c}}\\frac{(M_{DC2} + M_{DW})\\,e_{pc}}{I_{c}}', sub: `\\frac{${n(Ep, 0)}}{${n(Ecf, 0)}}\\frac{${g(mid.Msd, 0)}(${n(epc, 3)})}{${g(cp.Ic, 0)}}`, value: gn.composite, unit: 'ksi', d: 3 }, (Ep / Ecf) * (mid.Msd * epc / cp.Ic), 'gains.composite');
    const MllG = epc !== 0 ? gn.live * Ecf * cp.Ic / (Ep * epc) : NaN;
    add({ id: 'gain.ll', label: 'Elastic gain from LL+IM on the composite section (transient)', sym: '\\Delta f_{p,LL}', eq: '\\frac{E_{p}}{E_{c}}\\frac{M_{LL+IM}\\,e_{pc}}{I_{c}}', sub: `\\frac{${n(Ep, 0)}}{${n(Ecf, 0)}}\\frac{${g(MllG, 0)}(${n(epc, 3)})}{${g(cp.Ic, 0)}}`, value: gn.live, unit: 'ksi', d: 3, note: 'M_LL+IM: the engine\'s live-load envelope at midspan (kip-in). Credited only in combinations with live load; not used by the checks.' }, undefined, 'gains.live');
    add({ id: 'gain.perm', label: 'Permanent elastic gains', sym: '\\Delta f_{p,perm}', eq: '\\Delta f_{p,DC1} + \\Delta f_{p,SD}', sub: `${n(gn.precast, 3)} + ${n(gn.composite, 3)}`, value: gn.permanent, unit: 'ksi', d: 3 }, gn.precast + gn.composite, 'gains.permanent');
    const fx2 = v => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);   // PS-29: plain-text value in the step's note
    add({ id: 'gain.fpe', label: 'Effective prestress with the permanent elastic gains credited', sym: 'f_{pe,gain}', eq: 'f_{pe} + \\Delta f_{p,perm}', sub: `${n(R.fpe, 2)} + ${n(gn.permanent, 3)}`, value: R.fpeGain, unit: 'ksi', d: 2, note: 'The margin the gains give: the service checks use f_pe without gains (conservative). ' + (inp.opt.lossMethod === 'refined'
        ? `The deck shrinkage gain Δf_pSS = ${fx2(gn.deckShr)} ksi is already in the long-term loss Δf_pLT (refined method, 5.9.3.4.3) and is not added again.`
        : `The deck shrinkage gain Δf_pSS (${fx2(gn.deckShr)} ksi) is not credited: the approximate method (5.9.3.3) has no deck shrinkage term.`) }, R.fpe + gn.permanent, 'fpeGain');
    // stages of one strand row (the table covers every row)
    const S = R.strandStages, r0 = S.rows[0];
    if (r0) {
      const P = 'strandStages.rows.0.', rr = S.ref, uni = (R.totalLoss - rr.dfES) - (rr.dfCR + (rr.dfCD || 0));
      add({ id: 'row.fac', label: `Stress factor of row 1 (y = ${n(r0.y, 2)} in, e = ${n(r0.e, 3)} in) against the strand centroid`, sym: 'r_{1}', eq: '\\frac{1/A_{g} + e_{1}\\,e_{cg}/I_{g}}{1/A_{g} + e_{cg}^{2}/I_{g}}', sub: `\\frac{1/${n(A, 1)} + (${n(r0.e, 3)})(${n(rr.ecg, 3)})/${g(I, 0)}}{1/${n(A, 1)} + (${n(rr.ecg, 3)})^{2}/${g(I, 0)}}`, value: r0.fac, unit: '', d: 4,
        note: 'Elastic shortening, creep and the gains scale with the concrete stress at the row; shrinkage and relaxation do not.' }, (1 / A + r0.e * rr.ecg / I) / rr.fcgpDen, P + 'fac');
      add({ id: 'row.fpt', label: 'Row 1 at release', sym: 'f_{pt,1}', eq: 'f_{pbt} - r_{1}\\,\\Delta f_{pES}', sub: `${n(S.fpbt, 2)} - ${n(r0.fac, 4)}(${n(rr.dfES, 3)})`, value: r0.fpt, unit: 'ksi', d: 2 }, S.fpbt - r0.fac * rr.dfES, P + 'fpt');
      add({ id: 'row.Ppt', label: 'Row 1 force at release', sym: 'P_{t,1}', eq: 'f_{pt,1}\\,n_{1}\\,A_{b}', sub: `${n(r0.fpt, 2)}(${r0.n})(${n(S.Ab, 3)})`, value: r0.Ppt, unit: 'kip', d: 1 }, r0.fpt * r0.n * S.Ab, P + 'Ppt');
      add({ id: 'row.dTD', label: 'Row 1 losses from transfer to deck placement', sym: '\\Delta f_{TD,1}', eq: '\\Delta f_{pSR} + r_{1}\\,\\Delta f_{pCR} + \\Delta f_{pR1}', sub: `${n(rr.dfSR, 3)} + ${n(r0.fac, 4)}(${n(rr.dfCR, 3)}) + ${n(rr.dfR1, 3)}`, value: r0.dTDdeck, unit: 'ksi', d: 3, ref: A10 + '5.9.3.4.2' }, rr.dfSR + r0.fac * rr.dfCR + rr.dfR1, P + 'dTDdeck');
      add({ id: 'row.fpD', label: 'Row 1 after transfer to deck placement', sym: 'f_{pD,1}', eq: 'f_{pt,1} - \\Delta f_{TD,1}', sub: `${n(r0.fpt, 2)} - ${n(r0.dTDdeck, 3)}`, value: r0.fpDeck, unit: 'ksi', d: 2 }, r0.fpt - r0.dTDdeck, P + 'fpDeck');
      add({ id: 'row.dLT', label: 'Row 1 long-term loss', sym: '\\Delta f_{pLT,1}', eq: 'r_{1}(\\Delta f_{pCR} + \\Delta f_{pCD}) + (\\Delta f_{pT} - \\Delta f_{pES} - \\Delta f_{pCR} - \\Delta f_{pCD})', sub: `${n(r0.fac, 4)}(${n(rr.dfCR, 3)} + ${par(rr.dfCD || 0, 3)}) + ${par(uni, 3)}`, value: r0.dLT, unit: 'ksi', d: 3,
        note: 'The eccentricity-dependent share (creep) scaled by r_1, the rest (shrinkage, relaxation, deck shrinkage gain) uniform; the engine splits the long-term loss of the method used this way.' }, (rr.dfCR + (rr.dfCD || 0)) * r0.fac + uni, P + 'dLT');
      add({ id: 'row.fpe', label: 'Row 1 permanent (final), without gains', sym: 'f_{pe,1}', eq: 'f_{pbt} - r_{1}\\,\\Delta f_{pES} - \\Delta f_{pLT,1}', sub: `${n(S.fpbt, 2)} - ${n(r0.fac, 4)}(${n(rr.dfES, 3)}) - ${n(r0.dLT, 3)}`, value: r0.fpe, unit: 'ksi', d: 2 }, S.fpbt - r0.fac * rr.dfES - r0.dLT, P + 'fpe');
      add({ id: 'row.Ppe', label: 'Row 1 permanent force', sym: 'P_{e,1}', eq: 'f_{pe,1}\\,n_{1}\\,A_{b}', sub: `${n(r0.fpe, 2)}(${r0.n})(${n(S.Ab, 3)})`, value: r0.Ppe, unit: 'kip', d: 1 }, r0.fpe * r0.A, P + 'Ppe');
    }
    return K.done();
  }

  /* ---------- Stresses (5.9.2.3): limits, the governing fibre stresses, 5.12.3.3.5 at the interior supports, Fatigue I, crack control ---------- */
  function stresses(inp, R) {
    const { kit, n, g, par } = PW(), K = kit('st'), add = K.add;
    const G = R.g, cp = R.cp, ss = R.ss, lim = R.lim, m = inp.mat, L = R.L, own = ownOf(R), mLL = own.mLL, gl = +inp.opt.gLLs3;
    const sq = Math.sqrt, fci = +m.fci, fc = +m.fc;
    // limits
    add({ id: 'lim.relC', label: 'Compression limit at release', sym: 'f_{ci,lim}', eq: `${n(lim.relCfac, 2)}\\,f^{\\prime}_{ci}`, sub: `${n(lim.relCfac, 2)}(${n(fci, 2)})`, value: lim.relC, unit: 'ksi', d: 3, ref: A10 + '5.9.2.3.1a', note: lim.relCfac !== 0.65 ? 'Owner / entered factor (Owner rules tab).' : '' }, lim.relCfac * fci, 'lim.relC');
    if (inp.opt.relBondedReinf) add({ id: 'lim.relT', label: 'Tension limit at release (bonded reinforcement provided)', sym: 'f_{ti,lim}', eq: '0.24\\sqrt{f^{\\prime}_{ci}}', sub: `0.24\\sqrt{${n(fci, 2)}}`, value: lim.relT, unit: 'ksi', d: 3, ref: A10 + 'Table 5.9.2.3.1b-1' }, 0.24 * sq(fci), 'lim.relT');
    else add({ id: 'lim.relT', label: 'Tension limit at release (no bonded reinforcement)', sym: 'f_{ti,lim}', eq: '\\min(0.0948\\sqrt{f^{\\prime}_{ci}},\\,0.2)', sub: `\\min(0.0948\\sqrt{${n(fci, 2)}},\\,0.2)`, value: lim.relT, unit: 'ksi', d: 3, ref: A10 + 'Table 5.9.2.3.1b-1' }, Math.min(0.0948 * sq(fci), 0.2), 'lim.relT');
    add({ id: 'lim.srvC1', label: 'Compression limit, effective prestress + permanent loads', sym: 'f_{c,lim,1}', eq: '0.45\\,f^{\\prime}_{c}', sub: `0.45(${n(fc, 2)})`, value: lim.srvC1, unit: 'ksi', d: 3, ref: A10 + 'Table 5.9.2.3.2a-1' }, 0.45 * fc, 'lim.srvC1');
    add({ id: 'lim.srvC2', label: 'Compression limit, effective prestress + permanent + transient loads', sym: 'f_{c,lim,2}', eq: '0.60\\,\\phi_{w}\\,f^{\\prime}_{c}', sub: `0.60(1.0)(${n(fc, 2)})`, value: lim.srvC2, unit: 'ksi', d: 3, ref: A10 + 'Table 5.9.2.3.2a-1', note: 'φ_w = 1.0 (solid sections).' }, 0.60 * fc, 'lim.srvC2');
    if (inp.opt.corrosion === 'severe') add({ id: 'lim.srvT', label: 'Tension limit, Service III (severe corrosive conditions)', sym: 'f_{t,lim}', eq: '\\min(0.0948\\sqrt{f^{\\prime}_{c}},\\,0.3)', sub: `\\min(0.0948\\sqrt{${n(fc, 2)}},\\,0.3)`, value: lim.srvT, unit: 'ksi', d: 3, ref: A10 + 'Table 5.9.2.3.2b-1' }, Math.min(0.0948 * sq(fc), 0.3), 'lim.srvT');
    else add({ id: 'lim.srvT', label: 'Tension limit, Service III (moderate corrosive conditions)', sym: 'f_{t,lim}', eq: '\\min(0.19\\sqrt{f^{\\prime}_{c}},\\,0.6)', sub: `\\min(0.19\\sqrt{${n(fc, 2)}},\\,0.6)`, value: lim.srvT, unit: 'ksi', d: 3, ref: A10 + 'Table 5.9.2.3.2b-1' }, Math.min(0.19 * sq(fc), 0.6), 'lim.srvT');
    add({ id: 'lim.dkC2', label: 'Compression limit in the deck (permanent + transient)', sym: 'f_{cd,lim}', eq: '0.60\\,f^{\\prime}_{c,d}', sub: `0.60(${n(+m.fcd, 2)})`, value: lim.dkC2, unit: 'ksi', d: 3, ref: A10 + 'Table 5.9.2.3.2a-1' }, 0.60 * m.fcd, 'lim.dkC2');
    // the governing fibre stresses at the stations of the checks (R.grid rows, + compression)
    const niT = R.rv.niT;
    const trans = r => { const cgs = G.yb - r.e, At = G.A + (niT - 1) * r.Aps, ybt = (G.A * G.yb + (niT - 1) * r.Aps * cgs) / At, It = G.I + G.A * (ybt - G.yb) ** 2 + (niT - 1) * r.Aps * (ybt - cgs) ** 2; return { cgs, At, ybt, It, eT: ybt - cgs, P0: r.Aps * R.fpbt }; };
    const rel = (id, ck, top) => {
      const k = ckIx(R, ck); if (k < 0) return; const c = R.checks[k], i = near(R.grid, c.loc), r = R.grid[i], key = top ? 'relTop' : 'relBot', P = `grid.${i}.${key}`, x = n(r.x, 2);
      if (R.useT && r.Aps > 0) {
        const t = trans(r), DI = 'Display intermediate (the engine\'s transformed section at this station, 5.9.2.3.1).';
        add({ id: id + '.At', label: `Transformed area at x = ${x} ft (n_i = E_p/E_ci = ${n(niT, 3)})`, sym: 'A_{t}', eq: 'A_{g} + (n_{i} - 1)A_{ps}', sub: `${n(G.A, 1)} + (${n(niT, 3)} - 1)(${n(r.Aps, 3)})`, value: t.At, unit: 'in^{2}', d: 1, note: DI });
        add({ id: id + '.ybt', label: 'Centroid of the transformed section', sym: 'y_{bt}', eq: '\\frac{A_{g}y_{b} + (n_{i} - 1)A_{ps}\\,y_{ps}}{A_{t}}', sub: `\\frac{${n(G.A, 1)}(${n(G.yb, 3)}) + (${n(niT, 3)} - 1)(${n(r.Aps, 3)})(${n(t.cgs, 3)})}{${n(t.At, 1)}}`, value: t.ybt, unit: 'in', d: 3, note: DI });
        add({ id: id + '.It', label: 'Moment of inertia of the transformed section', sym: 'I_{t}', eq: 'I_{g} + A_{g}(y_{bt} - y_{b})^{2} + (n_{i} - 1)A_{ps}(y_{bt} - y_{ps})^{2}', sub: `${g(G.I, 0)} + ${n(G.A, 1)}(${n(t.ybt - G.yb, 3)})^{2} + (${n(niT, 3)} - 1)(${n(r.Aps, 3)})(${n(t.eT, 3)})^{2}`, value: t.It, unit: 'in^{4}', d: 0, note: DI });
        const yy = top ? G.h - t.ybt : t.ybt, s = top ? -1 : 1;
        add({ id, label: `${top ? 'Top' : 'Bottom'} fibre at release, x = ${x} ft (transformed section, P at f_pbt)`, sym: top ? 'f_{top}' : 'f_{bot}', eq: `\\frac{P_{0}}{A_{t}} ${top ? '-' : '+'} \\frac{P_{0}\\,e_{t}\\,${top ? '(h - y_{bt})' : 'y_{bt}'}}{I_{t}} ${top ? '+' : '-'} \\frac{M_{g}\\,${top ? '(h - y_{bt})' : 'y_{bt}'}}{I_{t}}`,
          sub: `\\frac{${n(t.P0, 1)}}{${n(t.At, 1)}} ${top ? '-' : '+'} \\frac{${n(t.P0, 1)}(${n(t.eT, 3)})(${n(yy, 3)})}{${g(t.It, 0)}} ${top ? '+' : '-'} \\frac{${g(r.Mg, 0)}(${n(yy, 3)})}{${g(t.It, 0)}}`, value: r[key], unit: 'ksi', d: 3, ref: A10 + '5.9.2.3.1', note: 'P_0 = A_ps(x) f_pbt: elastic shortening is captured by the transformed section (Loads tab, release option). M_g in kip-in. + compression.' },
          t.P0 / t.At + s * t.P0 * t.eT / (t.It / yy) - s * r.Mg / (t.It / yy), P);
      } else {
        const Pi = r.Aps * R.fpi, Sx = top ? G.St : G.Sb, s = top ? -1 : 1;
        add({ id, label: `${top ? 'Top' : 'Bottom'} fibre at release, x = ${x} ft (gross section, P_i after elastic shortening)`, sym: top ? 'f_{top}' : 'f_{bot}', eq: `\\frac{P_{i}}{A_{g}} ${top ? '-' : '+'} \\frac{P_{i}\\,e}{S_{${top ? 't' : 'b'}}} ${top ? '+' : '-'} \\frac{M_{g}}{S_{${top ? 't' : 'b'}}}`,
          sub: `\\frac{${n(Pi, 1)}}{${n(G.A, 1)}} ${top ? '-' : '+'} \\frac{${n(Pi, 1)}(${n(r.e, 3)})}{${g(Sx, 0)}} ${top ? '+' : '-'} \\frac{${g(r.Mg, 0)}}{${g(Sx, 0)}}`, value: r[key], unit: 'ksi', d: 3, ref: A10 + '5.9.2.3.1', note: `P_i = A_ps(x) f_pi = ${n(r.Aps, 3)}(${n(R.fpi, 2)}) (Losses tab); e and A_ps(x) at the station (transfer length and debonding); M_g in kip-in. + compression.` },
          Pi / G.A + s * Pi * r.e / Sx - s * r.Mg / Sx, P);
      }
      ratio(id, k, true);
    };
    const ratio = (id, k, rel0) => { const c = R.checks[k], tens = c.lim < 0;
      if (tens) add({ id: id + '.r', label: `Ratio, ${c.n}`, sym: 'D/C', eq: c.v < 0 ? '\\frac{|f|}{f_{t,lim}}' : '0\\ (\\text{compression})', sub: c.v < 0 ? `\\frac{${n(-c.v, 3)}}{${n(-c.lim, 3)}}` : '', value: c.r, unit: '', d: 3, ok: c.pass }, c.v < 0 ? -c.v / -c.lim : 0, `checks.${k}.r`);
      else add({ id: id + '.r', label: `Ratio, ${c.n}`, sym: 'D/C', eq: '\\frac{f}{f_{lim}}', sub: `\\frac{${n(c.v, 3)}}{${n(c.lim, 3)}}`, value: c.r, unit: '', d: 3, ok: c.pass }, c.v / c.lim, `checks.${k}.r`); void rel0; };
    rel('rc', 'Release comp', false);
    rel('rt', 'Release tens', true);
    rel('rtb', 'Release tens (+M, bot)', false);
    const mrS = r => (r.mrp != null && r.mrp !== 0 ? r.mrp : 0);
    const srv = (id, ck, kind) => {
      const k = ckIx(R, ck); if (k < 0) return; const c = R.checks[k], i = near(R.grid, c.loc), r = R.grid[i], x = n(r.x, 2), Pe = r.Aps * R.fpe, mr = mrS(r), hasR = r.mrp != null;
      const pre = `Effective prestress P_e = A_ps(x) f_pe = ${n(r.Aps, 3)}(${n(R.fpe, 2)}) (Losses tab); moments in kip-in at x (Analysis tab): M_g, M_dk = DC1, M_sd = DC2 + DW${hasR ? ', M_r = the positive restraint moment where it increases the effect (5.12.3.3.2)' : ''}, M_LL = the positive LL+IM envelope; m = ${n(mLL, 2)} (owner LL multiplier). + compression.`;
      const top = `\\frac{P_{e}}{A_{g}} - \\frac{P_{e}e}{S_{t}} + \\frac{M_{g} + M_{dk}}{S_{t}} + \\frac{M_{sd}${hasR ? ' + M_{r}' : ''}}{S_{tg}}`;
      const topS = `\\frac{${n(Pe, 1)}}{${n(G.A, 1)}} - \\frac{${n(Pe, 1)}(${n(r.e, 3)})}{${g(G.St, 0)}} + \\frac{${g(r.Mg, 0)} + ${g(r.Mdk, 0)}}{${g(G.St, 0)}} + \\frac{${g(r.Msd, 0)}${hasR ? ` + ${g(mr, 0)}` : ''}}{${g(cp.Stg, 0)}}`;
      const s1 = Pe / G.A - Pe * r.e / G.St + (r.Mg + r.Mdk) / G.St + r.Msd / cp.Stg + mr / cp.Stg;
      if (kind === 's1') add({ id, label: `Top of the girder, effective prestress + permanent loads, x = ${x} ft`, sym: 'f_{top}', eq: top, sub: topS, value: r.s1Top, unit: 'ksi', d: 3, ref: A10 + '5.9.2.3.2a', note: pre }, s1, `grid.${i}.s1Top`);
      if (kind === 's2') add({ id, label: `Top of the girder, permanent + live loads (Service I), x = ${x} ft`, sym: 'f_{top}', eq: `${top} + \\frac{m\\,M_{LL}}{S_{tg}}`, sub: `${topS} + \\frac{${n(mLL, 2)}(${g(r.Mll, 0)})}{${g(cp.Stg, 0)}}`, value: r.s2Top, unit: 'ksi', d: 3, ref: A10 + '5.9.2.3.2a', note: pre }, s1 + mLL * r.Mll / cp.Stg, `grid.${i}.s2Top`);
      if (kind === 's3') add({ id, label: `Bottom of the girder, Service III (γ_LL = ${n(gl, 2)}), x = ${x} ft`, sym: 'f_{bot}', eq: `\\frac{P_{e}}{A_{g}} + \\frac{P_{e}e}{S_{b}} - \\frac{M_{g} + M_{dk}}{S_{b}} - \\frac{M_{sd}${hasR ? ' + M_{r}' : ''} + \\gamma_{LL}\\,m\\,M_{LL}}{S_{bc}}`,
        sub: `\\frac{${n(Pe, 1)}}{${n(G.A, 1)}} + \\frac{${n(Pe, 1)}(${n(r.e, 3)})}{${g(G.Sb, 0)}} - \\frac{${g(r.Mg, 0)} + ${g(r.Mdk, 0)}}{${g(G.Sb, 0)}} - \\frac{${g(r.Msd, 0)}${hasR ? ` + ${g(mr, 0)}` : ''} + ${n(gl, 2)}(${n(mLL, 2)})(${g(r.Mll, 0)})}{${g(cp.Sbc, 0)}}`, value: r.s3Bot, unit: 'ksi', d: 3, ref: A10 + '5.9.2.3.2b, Table 3.4.1-4', note: pre },
        Pe / G.A + Pe * r.e / G.Sb - (r.Mg + r.Mdk) / G.Sb - (r.Msd + mr + gl * (mLL * r.Mll)) / cp.Sbc, `grid.${i}.s3Bot`);
      if (kind === 'dk') add({ id, label: `Top of the deck, permanent + live loads on the composite section, x = ${x} ft`, sym: 'f_{deck}', eq: `\\frac{M_{sd}${hasR ? ' + M_{r}' : ''} + m\\,M_{LL}}{S_{td}}`, sub: `\\frac{${g(r.Msd, 0)}${hasR ? ` + ${g(mr, 0)}` : ''} + ${n(mLL, 2)}(${g(r.Mll, 0)})}{${g(cp.Std, 0)}}`, value: r.dkC, unit: 'ksi', d: 3, ref: A10 + '5.9.2.3.2a', note: 'S_td in deck stress units (÷ n, Section properties tab). Moments in kip-in.' },
        r.Msd / cp.Std + (mLL * r.Mll) / cp.Std + mr / cp.Std, `grid.${i}.dkC`);
      ratio(id, k);
    };
    srv('s1', 'Srv comp (perm)', 's1');
    srv('s2', 'Srv comp (full)', 's2');
    srv('s2t', 'Srv tens (top)', 's2');
    srv('s3', 'Srv III tens', 's3');
    srv('dk', 'Deck comp', 'dk');
    // the interior supports of a span made continuous (5.12.3.3.5)
    const v = R.cont && R.cont.svc;
    if (v) {
      const pre = r => `Station of the half span next to the interior support; P_e = ${n(r.Aps, 3)}(${n(R.fpe, 2)}); M_LL− = the negative LL+IM envelope, M_r,n = a negative restraint moment where it adds. Moments in kip-in. + compression.`;
      if (!v.topRC) {
        add({ id: 'pier.topLim', label: 'Tension limit at the top of the girder near the interior support (f′c for f′ci)', sym: 'f_{t,lim}', eq: v.bonded ? '0.24\\sqrt{f^{\\prime}_{c}}' : '\\min(0.0948\\sqrt{f^{\\prime}_{c}},\\,0.2)', sub: v.bonded ? `0.24\\sqrt{${n(fc, 2)}}` : `\\min(0.0948\\sqrt{${n(fc, 2)}},\\,0.2)`, value: v.topLim, unit: 'ksi', d: 3, ref: A10 + '5.12.3.3.5, Table 5.9.2.3.1b-1' }, v.bonded ? 0.24 * sq(fc) : Math.min(0.0948 * sq(fc), 0.2), 'cont.svc.topLim');
        const r = v.wT, Pe = r.Aps * R.fpe;
        add({ id: 'pier.s3TopN', label: `Top of the girder, Service III with the negative live load, x = ${n(r.x, 2)} ft`, sym: 'f_{top}', eq: '\\frac{P_{e}}{A_{g}} - \\frac{P_{e}e}{S_{t}} + \\frac{M_{g} + M_{dk}}{S_{t}} + \\frac{M_{sd} + M_{r,n} + \\gamma_{LL}\\,m\\,M_{LL-}}{S_{tg}}',
          sub: `\\frac{${n(Pe, 1)}}{${n(G.A, 1)}} - \\frac{${n(Pe, 1)}(${n(r.e, 3)})}{${g(G.St, 0)}} + \\frac{${g(r.Mg, 0)} + ${g(r.Mdk, 0)}}{${g(G.St, 0)}} + \\frac{${g(r.Msd, 0)} + ${par(r.mrn, 0)} + ${n(gl, 2)}(${n(mLL, 2)})(${par(r.Mlln, 0)})}{${g(cp.Stg, 0)}}`, value: r.s3TopN, unit: 'ksi', d: 3, ref: A10 + '5.12.3.3.5', note: pre(r) },
          Pe / G.A - Pe * r.e / G.St + (r.Mg + r.Mdk) / G.St + (r.Msd + r.mrn + gl * (mLL * r.Mlln)) / cp.Stg, 'cont.svc.wT.s3TopN');
        const k = ckIx(R, 'Srv III top tens (pier, 5.12.3.3.5)'); if (k >= 0) ratio('pier.s3TopN', k);
        if (v.Ttop > 0) {
          add({ id: 'pier.Ttop', label: 'Tension force in the girder top near the interior support (uncracked section)', sym: 'T', value: v.Ttop, unit: 'kip', d: 1, ref: A10 + 'Table 5.9.2.3.1b-1', note: 'The engine integrates the tensile stress block over the girder outline.' }, undefined, 'cont.svc.Ttop');
          add({ id: 'pier.AsTop', label: 'Bonded steel needed for the 0.24√f′c limit', sym: 'A_{s,req}', eq: '\\frac{T}{\\min(0.5\\,f_{y},\\,30)}', sub: `\\frac{${n(v.Ttop, 1)}}{${n(v.fsT, 1)}}`, value: v.AsTop, unit: 'in^{2}', d: 2 }, v.Ttop / v.fsT, 'cont.svc.AsTop');
        }
      }
      const r = v.wB, Pe = r.Aps * R.fpe, perm = v.bPerm;
      add({ id: 'pier.fBot', label: `Bottom of the girder, Service I with the negative live load${perm ? ' (permanent loads govern)' : ''}, x = ${n(r.x, 2)} ft`, sym: 'f_{bot}', eq: `\\frac{P_{e}}{A_{g}} + \\frac{P_{e}e}{S_{b}} - \\frac{M_{g} + M_{dk}}{S_{b}} - \\frac{M_{sd} + M_{r,n}${perm ? '' : ' + m\\,M_{LL-}'}}{S_{bc}}`,
        sub: `\\frac{${n(Pe, 1)}}{${n(G.A, 1)}} + \\frac{${n(Pe, 1)}(${n(r.e, 3)})}{${g(G.Sb, 0)}} - \\frac{${g(r.Mg, 0)} + ${g(r.Mdk, 0)}}{${g(G.Sb, 0)}} - \\frac{${g(r.Msd, 0)} + ${par(r.mrn, 0)}${perm ? '' : ` + ${n(mLL, 2)}(${par(r.Mlln, 0)})`}}{${g(cp.Sbc, 0)}}`, value: v.fBot, unit: 'ksi', d: 3, ref: A10 + '5.12.3.3.5, 5.9.2.3.2a', note: pre(r) + ` Limit ${perm ? '0.45' : '0.60'} f′c.` },
        Pe / G.A + Pe * r.e / G.Sb - (r.Mg + r.Mdk) / G.Sb - (r.Msd + r.mrn) / cp.Sbc - (perm ? 0 : mLL * r.Mlln / cp.Sbc), 'cont.svc.fBot');
      const k = ckIx(R, 'Srv comp (bot, −M, 5.12.3.3.5)');
      if (k >= 0) add({ id: 'pier.fBot.r', label: 'Ratio, bottom compression near the interior support', sym: 'D/C', eq: '\\max\\left(\\frac{f_{perm}}{0.45f^{\\prime}_{c}},\\,\\frac{f_{full}}{0.60f^{\\prime}_{c}}\\right)', sub: `\\max\\left(\\frac{${n(r.s1BotN, 3)}}{${n(lim.srvC1, 3)}},\\,\\frac{${n(r.s2BotN, 3)}}{${n(lim.srvC2, 3)}}\\right)`, value: R.checks[k].r, unit: '', d: 3, ok: R.checks[k].pass },
        Math.max(r.s1BotN / lim.srvC1, r.s2BotN / lim.srvC2), `checks.${k}.r`);
    }
    // Fatigue I (5.5.3)
    const F = R.fat, mid = R.grid[near(R.grid, L / 2)], PeM = ss.at(L / 2).Aps * R.fpe;
    add({ id: 'fat.Mfat', label: 'Fatigue truck moment at midspan, one lane, no IM', sym: 'M_{fat}', value: F.Mfat, unit: 'kip-ft', d: 1, ref: A10 + '3.6.1.4.1', note: 'Design truck with a constant 30 ft rear axle spacing, no lane load (by search along the span).' }, undefined, 'fat.Mfat');
    const L0 = R.df, dfA = inp.loads.dfAuto;
    if (+inp.loads.fatM > 0) add({ id: 'fat.df', label: 'Fatigue distribution factor (entered)', sym: 'DF_{fat}', value: F.dfFat, unit: '', d: 4, note: 'Entered on the Loads tab.' }, undefined, 'fat.dfFat');
    else if (dfA && L0.ext) add({ id: 'fat.df', label: 'Fatigue distribution factor, exterior girder (one lane, m = 1.2 removed)', sym: 'DF_{fat}', eq: '\\frac{\\max(g_{lever},\\,g_{rigid,1})}{1.2}', sub: `\\frac{\\max(${n(L0.lever, 4)},\\,${n(L0.rigid1 || 0, 4)})}{1.2}`, value: F.dfFat, unit: '', d: 4, ref: A10 + '3.6.1.1.2, 4.6.2.2.2d' }, Math.max(L0.lever, L0.rigid1 || 0) / 1.2, 'fat.dfFat');
    else if (dfA) add({ id: 'fat.df', label: 'Fatigue distribution factor (one lane, m = 1.2 removed)', sym: 'DF_{fat}', eq: '\\frac{g_{M1}}{1.2}', sub: `\\frac{${n(L0.m1, 4)}}{1.2}`, value: F.dfFat, unit: '', d: 4, ref: A10 + '3.6.1.1.2' }, L0.m1 / 1.2, 'fat.dfFat');
    else add({ id: 'fat.df', label: 'Fatigue distribution factor (entered DF_M, m = 1.2 removed)', sym: 'DF_{fat}', eq: '\\frac{DF_{M}}{1.2}', sub: `\\frac{${n(+inp.loads.dfm, 4)}}{1.2}`, value: F.dfFat, unit: '', d: 4, ref: A10 + '3.6.1.1.2' }, +inp.loads.dfm / 1.2, 'fat.dfFat');
    add({ id: 'fat.M1', label: 'Fatigue moment per girder with IM', sym: 'M_{fat,g}', eq: 'M_{fat}(1.15)\\,DF_{fat}', sub: `${n(F.Mfat, 1)}(1.15)(${n(F.dfFat, 4)})`, value: F.Mfat1, unit: 'kip-ft', d: 1, ref: A10 + 'Table 3.6.2.1-1' }, F.Mfat * 1.15 * F.dfFat, 'fat.Mfat1');
    add({ id: 'fat.fbPerm', label: 'Bottom fibre at midspan, effective prestress + permanent loads', sym: 'f_{b,perm}', eq: '\\frac{P_{e}}{A_{g}} + \\frac{P_{e}e_{m}}{S_{b}} - \\frac{M_{g} + M_{dk}}{S_{b}} - \\frac{M_{sd}}{S_{bc}}', sub: `\\frac{${n(PeM, 1)}}{${n(G.A, 1)}} + \\frac{${n(PeM, 1)}(${n(ss.eMid, 3)})}{${g(G.Sb, 0)}} - \\frac{${g(mid.Mg, 0)} + ${g(mid.Mdk, 0)}}{${g(G.Sb, 0)}} - \\frac{${g(mid.Msd, 0)}}{${g(cp.Sbc, 0)}}`, value: F.fbPerm, unit: 'ksi', d: 3, ref: A10 + '5.5.3.1', note: 'f_pe without elastic gains; moments in kip-in at midspan.' },
      PeM / G.A + PeM * ss.eMid / G.Sb - (mid.Mg + mid.Mdk) / G.Sb - mid.Msd / cp.Sbc, 'fat.fbPerm');
    add({ id: 'fat.dfb', label: 'Bottom fibre stress change from Fatigue I', sym: '\\Delta f_{b}', eq: '\\frac{1.75\\,M_{fat,g}\\times 12}{S_{bc}}', sub: `\\frac{1.75(${n(F.Mfat1, 1)})(12)}{${g(cp.Sbc, 0)}}`, value: F.dfbFat, unit: 'ksi', d: 3, ref: A10 + 'Table 3.4.1-1 (Fatigue I)' }, 1.75 * F.Mfat1 * 12 / cp.Sbc, 'fat.dfbFat');
    add({ id: 'fat.fbMin', label: 'Bottom fibre under permanent loads + Fatigue I', sym: 'f_{b,min}', eq: 'f_{b,perm} - \\Delta f_{b}', sub: `${n(F.fbPerm, 3)} - ${n(F.dfbFat, 3)}`, value: F.fbMinFat, unit: 'ksi', d: 3 }, F.fbPerm - F.dfbFat, 'fat.fbMinFat');
    add({ id: 'fat.fr', label: 'Cracking trigger for the fatigue check', sym: 'f_{r,fat}', eq: '0.095\\sqrt{f^{\\prime}_{c}}', sub: `0.095\\sqrt{${n(fc, 2)}}`, value: F.frFat, unit: 'ksi', d: 3, ref: A10 + '5.5.3.1', note: F.cracksFat ? 'f_b,min < −f_r,fat: the section is taken as cracked; the strand stress range is checked.' : 'f_b,min ≥ −f_r,fat: uncracked; the strand stress range is small.' }, 0.095 * sq(fc), 'fat.frFat');
    add({ id: 'fat.dfs', label: 'Strand stress range', sym: '\\Delta f_{p}', eq: F.cracksFat ? '1.5\\,\\frac{E_{p}}{E_{c}}\\Delta f_{b}' : '\\frac{E_{p}}{E_{c}}\\Delta f_{b}', sub: `${F.cracksFat ? '1.5' : ''}\\frac{${n(+inp.str.Ep, 0)}}{${n(cp.Ecg, 0)}}(${n(F.dfbFat, 3)})`, value: F.dfStrand, unit: 'ksi', d: 2, ref: A10 + '5.5.3.3', note: 'The engine\'s approximation (cracked: × 1.5).' },
      (F.cracksFat ? 1.5 : 1) * (inp.str.Ep / cp.Ecg) * F.dfbFat, 'fat.dfStrand');
    const kf = ckIx(R, 'Fatigue I (strand)');
    if (kf >= 0) add({ id: 'fat.r', label: 'Ratio, strand stress range (limit 18 ksi)', sym: 'D/C', eq: '\\frac{\\Delta f_{p}}{18.0}', sub: `\\frac{${n(F.dfStrand, 2)}}{${n(F.fatLimit, 1)}}`, value: R.checks[kf].r, unit: '', d: 3, ok: R.checks[kf].pass, ref: A10 + 'Table 5.5.3.3-1', note: 'Strand radius of curvature ≥ 30 ft (10 ksi applies for sharper deviations).' }, F.dfStrand / F.fatLimit, `checks.${kf}.r`);
    const C = F.conc;
    add({ id: 'fat.cTopPerm', label: 'Top of the girder at midspan, effective prestress + permanent loads', sym: 'f_{t,perm}', eq: '\\frac{P_{e}}{A_{g}} - \\frac{P_{e}e_{m}}{S_{t}} + \\frac{M_{g} + M_{dk}}{S_{t}} + \\frac{M_{sd}}{S_{tg}}', sub: `\\frac{${n(PeM, 1)}}{${n(G.A, 1)}} - \\frac{${n(PeM, 1)}(${n(ss.eMid, 3)})}{${g(G.St, 0)}} + \\frac{${g(mid.Mg, 0)} + ${g(mid.Mdk, 0)}}{${g(G.St, 0)}} + \\frac{${g(mid.Msd, 0)}}{${g(cp.Stg, 0)}}`, value: C.topPerm, unit: 'ksi', d: 3 },
      PeM / G.A - PeM * ss.eMid / G.St + (mid.Mg + mid.Mdk) / G.St + mid.Msd / cp.Stg, 'fat.conc.topPerm');
    add({ id: 'fat.cTop', label: 'Top of the girder: ½(prestress + permanent) + Fatigue I', sym: 'f_{c,top}', eq: '\\frac{1}{2}f_{t,perm} + \\frac{1.75\\,M_{fat,g}\\times 12}{S_{tg}}', sub: `\\frac{1}{2}(${n(C.topPerm, 3)}) + \\frac{1.75(${n(F.Mfat1, 1)})(12)}{${g(cp.Stg, 0)}}`, value: C.top, unit: 'ksi', d: 3, ref: A10 + '5.5.3.1' }, 0.5 * C.topPerm + 1.75 * F.Mfat1 * 12 / cp.Stg, 'fat.conc.top');
    add({ id: 'fat.cBot', label: `Bottom of the girder: ½(prestress + permanent), largest over the span (x = ${n(C.xBot, 2)} ft)`, sym: 'f_{c,bot}', eq: '\\frac{1}{2}f_{b,perm}', sub: `\\frac{1}{2}(${n(C.botPerm, 3)})`, value: C.bot, unit: 'ksi', d: 3, ref: A10 + '5.5.3.1', note: 'The live load only relieves the bottom fibre.' }, 0.5 * C.botPerm, 'fat.conc.bot');
    add({ id: 'fat.cLim', label: 'Compression limit under Fatigue I', sym: 'f_{c,lim}', eq: '0.40\\,f^{\\prime}_{c}', sub: `0.40(${n(fc, 2)})`, value: C.lim, unit: 'ksi', d: 3, ref: A10 + '5.5.3.1' }, 0.40 * fc, 'fat.conc.lim');
    const kc = ckIx(R, 'Fatigue I (concrete, 5.5.3.1)');
    if (kc >= 0) add({ id: 'fat.cr', label: 'Ratio, concrete compression under Fatigue I', sym: 'D/C', eq: '\\frac{\\max(f_{c,top},\\,f_{c,bot})}{0.40f^{\\prime}_{c}}', sub: `\\frac{\\max(${n(C.top, 3)},\\,${n(C.bot, 3)})}{${n(C.lim, 3)}}`, value: R.checks[kc].r, unit: '', d: 3, ok: R.checks[kc].pass }, Math.max(C.top, C.bot) / C.lim, `checks.${kc}.r`);
    // crack control (5.6.7)
    const cr = R.crack;
    if (cr.cracked) {
      const dc = 2.0, fss = Math.min((inp.str.Ep / cp.Ecg) * cr.fssBot, 0.6 * inp.str.fpu);
      add({ id: 'crk.beta', label: 'Ratio of flexural strain at the tension face to that at the steel', sym: '\\beta_{s}', eq: '1 + \\frac{d_{c}}{0.7(h - d_{c})}', sub: `1 + \\frac{${n(dc, 1)}}{0.7(${n(G.h, 2)} - ${n(dc, 1)})}`, value: cr.betaCr, unit: '', d: 3, ref: A10 + '5.6.7', note: 'd_c = 2.0 in assumed.' }, 1 + dc / (0.7 * (G.h - dc)), 'crack.betaCr');
      add({ id: 'crk.fss', label: 'Steel stress increment at the bottom (the engine\'s proxy)', sym: 'f_{ss}', eq: '\\min\\left(\\frac{E_{p}}{E_{c}}|f_{bot}|,\\,0.6f_{pu}\\right)', sub: `\\min\\left(\\frac{${n(+inp.str.Ep, 0)}}{${n(cp.Ecg, 0)}}(${n(cr.fssBot, 3)}),\\,0.6(${n(+inp.str.fpu, 0)})\\right)`, value: fss, unit: 'ksi', d: 2, note: 'Display intermediate (the engine keeps only s_max). |f_bot|: the governing Service III bottom tension.' });
      add({ id: 'crk.s', label: 'Maximum spacing of the bonded reinforcement', sym: 's_{max}', eq: '\\max\\left(\\frac{700\\gamma_{e}}{\\beta_{s}\\,f_{ss}} - 2d_{c},\\,4\\right)', sub: `\\max\\left(\\frac{700(${n(cr.gammaE, 2)})}{${n(cr.betaCr, 3)}(${n(Math.max(fss, 1), 2)})} - 2(${n(dc, 1)}),\\,4\\right)`, value: cr.sMaxCrack, unit: 'in', d: 1, ref: A10 + 'Eq. 5.6.7-1', note: 'γ_e = 0.75 (Class 2 exposure).' },
        Math.max(700 * cr.gammaE / (cr.betaCr * Math.max(fss, 1)) - 2 * dc, 4), 'crack.sMaxCrack');
    } else add({ id: 'crk.none', label: 'Crack control (spacing of the bonded reinforcement)', sym: '', value: 'not triggered', unit: '', ref: A10 + '5.6.7', note: 'The Service III bottom fibre stays in compression: the 5.6.7 spacing limit does not apply.' });
    return K.done();
  }
  window.PSBWorkedStress = { losses, stresses, near };
})();
