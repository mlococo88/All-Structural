/* apps/ps-bridge/engine/worked-hdr.js — the worked steps of the Handling, Deck and Rating tabs (window.PSBWorkedHDR).
   Classic script, no DOM. Created 2026-11-13 (PR 2d-2, docs/ps-bridge-plan.md §3 "Tabs and graphics": every number on a tab comes from
   computeAll, no second calculation; the steps substitute the engine's values and a test asserts each step's result equals the engine value).
   Uses window.PSBWorked (engine/worked.js: kit, n, g, par) and window.SharedSteps (CLAUDE.md §6).

   handling(inp, R), deck(inp, R), rating(inp, R) -> { steps, pairs, paths } (as engine/worked-end.js); handling and deck return no steps
   when their module is off (R.handling / R.deck null).
     handling: the stresses at the lifting and hauling points (the girder on two supports a from each end at release, P = A_ps f_pi), the
       release limits, the lifting-stress ratio; the weak-axis I_y (approximate, from the section outline), the lateral CG deflection z_o
       and the cracking factors of safety of the simplified screening (not the PCI 2016 / Mast method), as the moved engine (handlingCalc).
     deck: the transverse strip design of the moved engine (deckCalc): slab and wearing-surface moments wS²/11 and wS²/10, the negative-
       moment design section (4.6.2.1.6), the live load of Table A4-1 interpolated on S and x, Strength I, the capacity of the bottom and top
       bars (5.6.3, φ by 5.5.4.2), the overhang (wheel 1 ft from the railing face on the 45 + 10X strip), the distribution steel (9.7.3.2).
     rating: the LRFR load rating of the moved engine (computeAll): φ_c φ_s (floor 0.85), the flexure rating at the governing station,
       the shear rating at the governing shear section, the Service III rating at the governing bottom-tension section, the entered
       legal / permit vehicles. The MBE citations are the old app's labels (article numbers, no edition): the MBE 4th Ed. (2026) labels
       come in their own PR (plan §5 PR 6, PS-14 e).
   Display intermediates the engine does not keep are named in their notes (the prestress force and eccentricity at the handling points,
   β_1 of the deck, the overhang wheel position terms, the vehicles' net capacities). The expressions are those of the moved engine
   (pbd-handling-deck.js handlingCalc, deckCalc; pbd-compute.js computeAll), written out for display. Code basis AASHTO LRFD 10th Ed. (2024). */
(function () {
  'use strict';
  const PW = () => window.PSBWorked;
  const A10 = 'AASHTO LRFD 10th Ed. ';
  const ckIx = (R, name) => R.checks.findIndex(c => c.n === name);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const NONE = () => ({ steps: [], pairs: [], paths: {} });

  /* ---------- Handling (pbd-handling-deck.js handlingCalc) ---------- */
  function handling(inp, R) {
    const H = R.handling; if (!H) return NONE();
    const { kit, n, g, par } = PW(), K = kit('hn'), add = K.add;
    const G = R.g, ss = R.ss, L = R.L, Lin = L * 12, Hi = inp.handling, fci = +inp.mat.fci, fpi = R.fpi;
    add({ id: 'w', label: 'Girder self-weight', sym: 'w', eq: 'w_{g}', sub: n(G.wsw, 4), value: H.w, unit: 'klf', d: 4, note: 'Section properties tab.' }, G.wsw, 'handling.w');
    const stage = (key, nm, S, ref) => {
      const P = `handling.${key}.`, a = S.a, Pe = ss.at(L / 2).Aps * fpi, e = ss.eMid, PeE = ss.at(a).Aps * fpi, eE = ss.at(a).e;
      add({ id: key + '.Ls', label: `${nm}: span between the supports`, sym: 'L_{s}', eq: 'L - 2a', sub: `${n(L, 2)} - 2(${n(a, 2)})`, value: S.Ls, unit: 'ft', d: 2, ref,
        note: `a = ${n(a, 2)} ft from each end (${key === 'lift' ? 'lifting loops' : 'truck / trailer supports'}; Loads tab). The engine takes the girder length as the span L.` }, L - 2 * a, P + 'Ls');
      add({ id: key + '.Msup', label: `${nm}: moment at the support (cantilever)`, sym: 'M_{sup}', eq: '-\\frac{w\\,a^{2}}{2}', sub: `-\\frac{${n(H.w, 4)}(${n(a, 2)})^{2}}{2}`, value: S.Msup, unit: 'kip-ft', d: 1 }, -H.w * a * a / 2, P + 'Msup');
      add({ id: key + '.Mmid', label: `${nm}: moment at midspan`, sym: 'M_{mid}', eq: '\\frac{w\\,L_{s}^{2}}{8} - \\frac{w\\,a^{2}}{2}', sub: `\\frac{${n(H.w, 4)}(${n(S.Ls, 2)})^{2}}{8} - \\frac{${n(H.w, 4)}(${n(a, 2)})^{2}}{2}`, value: S.Mmid, unit: 'kip-ft', d: 1 }, H.w * S.Ls * S.Ls / 8 - H.w * a * a / 2, P + 'Mmid');
      const nt = `P = A_ps f_pi (at release, Losses tab): ${n(Pe, 1)} kip with e = ${n(e, 3)} in at midspan, ${n(PeE, 1)} kip with e = ${n(eE, 3)} in at the support (display; the engine's strand profile).`;
      add({ id: key + '.fMidTop', label: `${nm}: top fibre at midspan`, sym: 'f_{t,mid}', eq: '\\frac{P}{A} - \\frac{P\\,e}{S_{t}} + \\frac{12\\,M_{mid}}{S_{t}}', sub: `\\frac{${n(Pe, 1)}}{${n(G.A, 1)}} - \\frac{${n(Pe, 1)}(${n(e, 3)})}{${g(G.St, 0)}} + \\frac{12(${par(S.Mmid, 1)})}{${g(G.St, 0)}}`, value: S.fMidTop, unit: 'ksi', d: 3, note: nt + ' + compression.' },
        Pe / G.A - Pe * e / G.St + S.Mmid * 12 / G.St, P + 'fMidTop');
      add({ id: key + '.fMidBot', label: `${nm}: bottom fibre at midspan`, sym: 'f_{b,mid}', eq: '\\frac{P}{A} + \\frac{P\\,e}{S_{b}} - \\frac{12\\,M_{mid}}{S_{b}}', sub: `\\frac{${n(Pe, 1)}}{${n(G.A, 1)}} + \\frac{${n(Pe, 1)}(${n(e, 3)})}{${g(G.Sb, 0)}} - \\frac{12(${par(S.Mmid, 1)})}{${g(G.Sb, 0)}}`, value: S.fMidBot, unit: 'ksi', d: 3, note: nt },
        Pe / G.A + Pe * e / G.Sb - S.Mmid * 12 / G.Sb, P + 'fMidBot');
      add({ id: key + '.fSupTop', label: `${nm}: top fibre at the support`, sym: 'f_{t,sup}', eq: '\\frac{P}{A} - \\frac{P\\,e}{S_{t}} + \\frac{12\\,M_{sup}}{S_{t}}', sub: `\\frac{${n(PeE, 1)}}{${n(G.A, 1)}} - \\frac{${n(PeE, 1)}(${n(eE, 3)})}{${g(G.St, 0)}} + \\frac{12(${par(S.Msup, 2)})}{${g(G.St, 0)}}`, value: S.fSupTop, unit: 'ksi', d: 3 },
        PeE / G.A - PeE * eE / G.St + S.Msup * 12 / G.St, P + 'fSupTop');
      add({ id: key + '.fSupBot', label: `${nm}: bottom fibre at the support`, sym: 'f_{b,sup}', eq: '\\frac{P}{A} + \\frac{P\\,e}{S_{b}} - \\frac{12\\,M_{sup}}{S_{b}}', sub: `\\frac{${n(PeE, 1)}}{${n(G.A, 1)}} + \\frac{${n(PeE, 1)}(${n(eE, 3)})}{${g(G.Sb, 0)}} - \\frac{12(${par(S.Msup, 2)})}{${g(G.Sb, 0)}}`, value: S.fSupBot, unit: 'ksi', d: 3 },
        PeE / G.A + PeE * eE / G.Sb - S.Msup * 12 / G.Sb, P + 'fSupBot');
    };
    stage('lift', 'Lifting', H.lift, 'release stage');
    stage('haul', 'Hauling', H.haul, 'release stage (as the engine)');
    const rc = +inp.opt.relCfac > 0 ? +inp.opt.relCfac : 0.65;
    add({ id: 'limC', label: 'Compression limit (release)', sym: 'f_{c,lim}', eq: 'c\\,f^{\\prime}_{ci}', sub: `${n(rc, 2)}(${n(fci, 2)})`, value: H.limC, unit: 'ksi', d: 2, ref: A10 + '5.9.2.3.1a', note: 'c = the release compression factor (Owner rules tab; 0.65 when blank). Shown with the stresses; the engine reports no compression check for handling.' }, rc * fci, 'handling.limC');
    add({ id: 'limT', label: 'Tension limit (release, with bonded reinforcement)', sym: 'f_{t,lim}', eq: '0.24\\sqrt{f^{\\prime}_{ci}}', sub: `0.24\\sqrt{${n(fci, 2)}}`, value: H.limT, unit: 'ksi', d: 3, ref: A10 + 'Table 5.9.2.3.1b-1' }, 0.24 * Math.sqrt(fci), 'handling.limT');
    const lf = H.lift, kL = ckIx(R, 'Lifting stress'), wT = Math.min(lf.fMidTop, lf.fMidBot, lf.fSupTop, lf.fSupBot);
    add({ id: 'lift.r', label: 'Ratio, lifting stress (the largest tension of the four fibres)', sym: 'D/C', eq: '\\frac{-\\min(f)}{f_{t,lim}}', sub: `\\frac{${n(-wT, 3)}}{${n(H.limT, 3)}}`, value: R.checks[kL].r, unit: '', d: 3, ok: R.checks[kL].pass,
      note: wT < 0 ? 'The four lifting fibre stresses above; tension negative.' : 'No fibre in tension while lifting: the engine reports 0.' }, wT < 0 ? -wT / H.limT : 0, `checks.${kL}.r`);
    // lateral stability screening
    const [d0, d1, d2, d3] = G.d || [0, 0, 0, 0], tf = d0 + d1, bf = d2 + d3, web = G.h - tf - bf;
    add({ id: 'Iy', label: 'Weak-axis moment of inertia (approximate: flange and web rectangles)', sym: 'I_{y}', eq: '\\frac{t_{tf}b_{tf}^{3}}{12} + \\frac{t_{bf}b_{bf}^{3}}{12} + \\frac{h_{w}b_{w}^{3}}{12}', sub: `\\frac{${n(tf, 2)}(${n(G.btf, 2)})^{3}}{12} + \\frac{${n(bf, 2)}(${n(G.bbf, 2)})^{3}}{12} + \\frac{${n(web, 2)}(${n(G.bw, 2)})^{3}}{12}`, value: H.Iy, unit: 'in^{4}', d: 0,
      note: 't_tf, t_bf: the flange thicknesses with their tapers; h_w = h − t_tf − t_bf (the section outline).' }, tf * Math.pow(G.btf, 3) / 12 + bf * Math.pow(G.bbf, 3) / 12 + web * Math.pow(G.bw, 3) / 12, 'handling.Iy');
    const zo = (a, w) => { const l = Lin - 2 * a; return { l, v: (w / 12) / (R.lo.Eci * H.Iy) * (Math.pow(l, 5) / 120 - a * a * Math.pow(l, 3) / 12 + Math.pow(a, 4) * l / 4 + 3 * Math.pow(a, 5) / 20) / (l + 2 * a) }; };
    const zL = zo(H.aLift * 12, H.w), zH = zo(H.aHaul * 12, H.w);
    const zEq = '\\frac{w}{E_{ci}I_{y}}\\left[\\frac{l^{5}}{120} - \\frac{a^{2}l^{3}}{12} + \\frac{a^{4}l}{4} + \\frac{3a^{5}}{20}\\right]\\frac{1}{l + 2a}';
    const zSub = (a, z) => `\\frac{${n(H.w / 12, 5)}}{${n(R.lo.Eci, 0)}(${g(H.Iy, 0)})}\\left[\\frac{(${n(z.l, 1)})^{5}}{120} - \\frac{(${n(a, 1)})^{2}(${n(z.l, 1)})^{3}}{12} + \\frac{(${n(a, 1)})^{4}(${n(z.l, 1)})}{4} + \\frac{3(${n(a, 1)})^{5}}{20}\\right]\\frac{1}{${n(z.l, 1)} + 2(${n(a, 1)})}`;
    add({ id: 'zo', label: 'Lateral deflection of the centre of gravity, lifting (Mast form)', sym: 'z_{o}', eq: zEq, sub: zSub(H.aLift * 12, zL), value: H.zo, unit: 'in', d: 3, ref: 'PCI / Mast (screening)', note: `l = 12L − 2a = ${n(zL.l, 1)} in between the lifting points, a = ${n(H.aLift * 12, 1)} in; w in kip/in.` }, zL.v, 'handling.zo');
    add({ id: 'FSl', label: 'Factor of safety against cracking, lifting (screening)', sym: 'FS_{cr,lift}', eq: '\\frac{y_{r}}{z_{o} + e_{i}}', sub: `\\frac{${n(G.yt, 3)}}{${n(H.zo, 3)} + ${n(H.ei, 3)}}`, value: H.FScrLift, unit: '', d: 2,
      note: 'y_r = y_t: the roll axis taken at the top of the girder (lifting loops), above the centre of gravity; e_i = the initial sweep (Loads tab).' }, G.yt / (H.zo + H.ei), 'handling.FScrLift');
    const kFL = ckIx(R, 'Lifting FS (crack, screening)');
    add({ id: 'FSl.r', label: 'Ratio, lifting FS (1.0 required)', sym: 'D/C', eq: '\\frac{1.0}{FS_{cr,lift}}', sub: `\\frac{1.0}{${n(H.FScrLift, 3)}}`, value: R.checks[kFL].r, unit: '', d: 3, ok: R.checks[kFL].pass }, H.FScrLift > 0 ? 1 / H.FScrLift : 9, `checks.${kFL}.r`);
    add({ id: 'zoH', label: 'Lateral deflection of the centre of gravity, hauling', sym: 'z_{o,h}', eq: zEq, sub: zSub(H.aHaul * 12, zH), value: H.zoH, unit: 'in', d: 3, ref: 'PCI / Mast (screening)', note: `l = ${n(zH.l, 1)} in between the supports, a = ${n(H.aHaul * 12, 1)} in.` }, zH.v, 'handling.zoH');
    const yr = +Hi.hr + G.yb;
    add({ id: 'yrH', label: 'Height of the centre of gravity above the roll centre (hauling)', sym: 'y_{r,h}', eq: 'h_{r} + y_{b}', sub: `${n(+Hi.hr, 2)} + ${n(G.yb, 3)}`, value: yr, unit: 'in', d: 2, note: 'Display (the engine\'s expression); h_r = roll centre height (Loads tab).' });
    add({ id: 'FSh', label: 'Factor of safety against cracking, hauling (screening)', sym: 'FS_{cr,haul}', eq: '\\frac{y_{r,h}}{z_{o,h} + e_{i} + y_{r,h}\\,\\theta_{i}}', sub: `\\frac{${n(yr, 2)}}{${n(H.zoH, 3)} + ${n(H.ei, 3)} + ${n(yr, 2)}(${n(+Hi.theta_i, 4)})}`, value: H.FScrHaul, unit: '', d: 2,
      note: 'θ_i = the road cross slope (Loads tab). No truck roll stiffness, no tilt equilibrium, no FS against failure or rollover.' }, yr / (H.zoH + H.ei + yr * (+Hi.theta_i)), 'handling.FScrHaul');
    const kFH = ckIx(R, 'Hauling FS (crack, screening)');
    add({ id: 'FSh.r', label: 'Ratio, hauling FS (1.0 required)', sym: 'D/C', eq: '\\frac{1.0}{FS_{cr,haul}}', sub: `\\frac{1.0}{${n(H.FScrHaul, 3)}}`, value: R.checks[kFH].r, unit: '', d: 3, ok: R.checks[kFH].pass }, H.FScrHaul > 0 ? 1 / H.FScrHaul : 9, `checks.${kFH}.r`);
    return K.done();
  }

  /* ---------- Deck (pbd-handling-deck.js deckCalc, deckTableA4, deckDesignSection) ---------- */
  function deck(inp, R) {
    const D = R.deck; if (!D) return NONE();
    const { kit, n } = PW(), K = kit('dk'), add = K.add;
    const G = R.g, Di = inp.deck, m = inp.mat, S = +inp.S, ts = +inp.ts, tsL = inp.tsSeparate ? (+inp.tsDL || ts) : ts, wL = +m.wcdLoad || +m.wcd;
    add({ id: 'wDC', label: 'Slab weight per square foot (DC)', sym: 'w_{DC}', eq: '\\frac{t_{s}}{12}\\,w_{c,d}', sub: `\\frac{${n(tsL, 2)}}{12}(${n(wL, 3)})`, value: D.wDLslab, unit: 'ksf', d: 4,
      note: inp.tsSeparate ? 'The separate dead-load deck thickness (Cross-section tab); the capacity uses t_s.' : 'Deck unit weight for the dead load (Materials tab).' }, tsL / 12 * wL, 'deck.wDLslab');
    add({ id: 'wDW', label: 'Future wearing surface (DW)', sym: 'w_{DW}', eq: '', sub: n(+Di.wsFut, 4), value: D.wDLws, unit: 'ksf', d: 4, note: 'Entered (Diaphragms / deck tab).' }, +Di.wsFut, 'deck.wDLws');
    const own = D.own, eV = own ? `${n(own.eta, 3)}\\,\\left[` : '', eC = own ? '\\right]' : '', mV = own && own.mLL !== 1 ? `${n(own.mLL, 2)}\\,` : '', eE = own ? '\\eta\\,\\left[' : '', eEc = own ? '\\right]' : '', mE = own && own.mLL !== 1 ? 'm\\,' : '';
    add({ id: 'MDCp', label: 'Slab moment, positive (continuous slab)', sym: 'M_{DC,+}', eq: '\\frac{w_{DC}S^{2}}{11}', sub: `\\frac{${n(D.wDLslab, 4)}(${n(S, 3)})^{2}}{11}`, value: D.MDC_pos, unit: 'kip-ft/ft', d: 3, ref: 'continuous-beam coefficients (as the old app)' }, D.wDLslab * S * S / 11, 'deck.MDC_pos');
    add({ id: 'MDWp', label: 'Wearing-surface moment, positive', sym: 'M_{DW,+}', eq: '\\frac{w_{DW}S^{2}}{11}', sub: `\\frac{${n(D.wDLws, 4)}(${n(S, 3)})^{2}}{11}`, value: D.MDW_pos, unit: 'kip-ft/ft', d: 3 }, D.wDLws * S * S / 11, 'deck.MDW_pos');
    add({ id: 'MDCn', label: 'Slab moment, negative', sym: 'M_{DC,-}', eq: '\\frac{w_{DC}S^{2}}{10}', sub: `\\frac{${n(D.wDLslab, 4)}(${n(S, 3)})^{2}}{10}`, value: D.MDC_neg, unit: 'kip-ft/ft', d: 3 }, D.wDLslab * S * S / 10, 'deck.MDC_neg');
    add({ id: 'MDWn', label: 'Wearing-surface moment, negative', sym: 'M_{DW,-}', eq: '\\frac{w_{DW}S^{2}}{10}', sub: `\\frac{${n(D.wDLws, 4)}(${n(S, 3)})^{2}}{10}`, value: D.MDW_neg, unit: 'kip-ft/ft', d: 3 }, D.wDLws * S * S / 10, 'deck.MDW_neg');
    // design section (4.6.2.1.6)
    if (Di.xnegAuto === false) add({ id: 'xneg', label: 'Negative-moment design section from the girder ℄ (entered, 0 to 24 in)', sym: 'x', eq: '\\min(\\max(x_{ent}, 0), 24)', sub: `\\min(\\max(${n(+Di.xneg || 0, 2)}, 0), 24)`, value: D.xneg, unit: 'in', d: 2, ref: A10 + '4.6.2.1.6' }, clamp(+Di.xneg || 0, 0, 24), 'deck.xneg');
    else if (G.isBox || G.isDeck) add({ id: 'xneg', label: 'Negative-moment design section (closed box: the face of the support)', sym: 'x', eq: '\\frac{b}{2}', sub: `\\frac{${n(+G.btf || 0, 2)}}{2}`, value: D.xneg, unit: 'in', d: 2, ref: A10 + '4.6.2.1.6', note: 'Limited to 0 to 24 in (Table A4-1).' }, clamp((+G.btf || 0) / 2, 0, 24), 'deck.xneg');
    else add({ id: 'xneg', label: 'Negative-moment design section (precast I / open box: b_tf/3, not more than 15 in)', sym: 'x', eq: '\\min\\left(\\frac{b_{tf}}{3},\\ 15\\right)', sub: `\\min\\left(\\frac{${n(+G.btf || 0, 2)}}{3},\\ 15\\right)`, value: D.xneg, unit: 'in', d: 2, ref: A10 + '4.6.2.1.6' }, clamp(Math.min((+G.btf || 0) / 3, 15), 0, 24), 'deck.xneg');
    // Table A4-1, interpolated on S and on x (the engine's deckTableA4)
    const A4 = D.A4, T = typeof A4_1 !== 'undefined' ? A4_1 : null, XS = typeof A4_1_X !== 'undefined' ? A4_1_X : [0, 3, 6, 9, 12, 18, 24];   // the moved engine's table (global of pbd-handling-deck.js)
    const t = (A4.Sused - 4) / 0.25, i0 = clamp(Math.floor(t), 0, T ? T.length - 1 : 0), i1 = T ? Math.min(i0 + 1, T.length - 1) : 0, f = t - i0;
    const Am = A4.outOfRange ? (A4.below ? 'S below 4 ft: the 4 ft row is used.' : 'S above 15 ft: the 15 ft row is used; a refined analysis is required.') : '';
    if (T) {
      const r0 = T[i0], r1 = T[i1], row = r0.map((v, k) => v + (r1[k] - v) * f);
      add({ id: 'MLLp', label: 'Live load + IM, positive (Table A4-1, interpolated on S)', sym: 'M_{LL,+}', eq: 'M_{+}(S_{0}) + \\left(M_{+}(S_{1}) - M_{+}(S_{0})\\right)\\frac{S - S_{0}}{0.25}', sub: `${n(r0[1], 2)} + (${n(r1[1], 2)} - ${n(r0[1], 2)})\\frac{${n(A4.Sused, 3)} - ${n(r0[0], 2)}}{0.25}`, value: D.MLL_pos, unit: 'kip-ft/ft', d: 3, ref: A10 + 'Table A4-1',
        note: `Rows S_0 = ${n(r0[0], 2)} ft and S_1 = ${n(r1[0], 2)} ft. The table includes the multiple presence factors and the 33 % dynamic load allowance: no further IM. ${Am}` }, r0[1] + (r1[1] - r0[1]) * f, 'deck.MLL_pos');
      const xc = A4.xUsed; let j = 0; while (j < XS.length - 2 && xc > XS[j + 1]) j++;
      const gf = (xc - XS[j]) / (XS[j + 1] - XS[j]);
      add({ id: 'MLLn', label: 'Live load + IM, negative at the design section (Table A4-1, interpolated on S, then on x)', sym: 'M_{LL,-}', eq: 'M_{-}(x_{j}) + \\left(M_{-}(x_{j+1}) - M_{-}(x_{j})\\right)\\frac{x - x_{j}}{x_{j+1} - x_{j}}', sub: `${n(row[2 + j], 3)} + (${n(row[3 + j], 3)} - ${n(row[2 + j], 3)})\\frac{${n(xc, 2)} - ${XS[j]}}{${XS[j + 1]} - ${XS[j]}}`, value: D.MLL_neg, unit: 'kip-ft/ft', d: 3, ref: A10 + 'Table A4-1',
        note: `Columns x_j = ${XS[j]} in and x_j+1 = ${XS[j + 1]} in of the row interpolated at S = ${n(A4.Sused, 3)} ft.${A4.xClamped ? ' x above 24 in: 24 in used.' : ''}` }, row[2 + j] + (row[3 + j] - row[2 + j]) * gf, 'deck.MLL_neg');
    }
    const ref1 = A10 + 'Table 3.4.1-1';
    const Mu = (Mdc, Mdw, Mll, llEq) => (own ? own.eta : 1) * (1.25 * Mdc + 1.50 * Mdw + 1.75 * ((own ? own.mLL : 1) * llEq(Mll)));
    add({ id: 'Mup', label: 'Factored positive moment, Strength I', sym: 'M_{u,+}', eq: `${eE}1.25\\,M_{DC,+} + 1.50\\,M_{DW,+} + 1.75\\,${mE}M_{LL,+}${eEc}`, sub: `${eV}1.25(${n(D.MDC_pos, 3)}) + 1.50(${n(D.MDW_pos, 3)}) + 1.75(${mV}${n(D.MLL_pos, 3)})${eC}`, value: D.Mu_pos, unit: 'kip-ft/ft', d: 3, ref: ref1,
      note: own ? 'η and the owner live-load multiplier m (Owner rules tab).' : '' }, Mu(D.MDC_pos, D.MDW_pos, D.MLL_pos, v => v), 'deck.Mu_pos');
    add({ id: 'Mun', label: 'Factored negative moment, Strength I', sym: 'M_{u,-}', eq: `${eE}1.25\\,M_{DC,-} + 1.50\\,M_{DW,-} + 1.75\\,${mE}M_{LL,-}${eEc}`, sub: `${eV}1.25(${n(D.MDC_neg, 3)}) + 1.50(${n(D.MDW_neg, 3)}) + 1.75(${mV}${n(D.MLL_neg, 3)})${eC}`, value: D.Mu_neg, unit: 'kip-ft/ft', d: 3, ref: ref1 }, Mu(D.MDC_neg, D.MDW_neg, D.MLL_neg, v => v), 'deck.Mu_neg');
    // capacity of the bottom and top bars (cap() of deckCalc)
    const fy = +Di.fyd, fcd = +m.fcd, b1 = clamp(0.85 - 0.05 * (fcd - 4), 0.65, 0.85);
    const cap = (key, nm, c, barA, sp, cover, chk) => {
      const P = `deck.${key}.`;
      add({ id: key + '.As', label: `${nm}: steel area per foot`, sym: 'A_{s}', eq: '\\frac{12\\,A_{b}}{s}', sub: `\\frac{12(${n(barA, 2)})}{${n(sp, 2)}}`, value: c.As, unit: 'in^{2}/ft', d: 3, note: sp > 0 ? '' : 'Spacing 0: no steel credited (an input error).' }, sp > 0 ? barA * 12 / sp : 0, P + 'As');
      add({ id: key + '.d', label: `${nm}: effective depth`, sym: 'd', eq: 't_{s} - c_{c} - \\frac{d_{b}}{2}', sub: `${n(ts, 2)} - ${n(cover, 2)} - \\frac{${n(c.dbar, 3)}}{2}`, value: c.dEff, unit: 'in', d: 2, note: `d_b = √(4A_b/π) = ${n(c.dbar, 3)} in, the equivalent bar diameter.` }, ts - cover - c.dbar / 2, P + 'dEff');
      add({ id: key + '.a', label: `${nm}: depth of the compression block`, sym: 'a', eq: '\\frac{A_{s}\\,f_{y}}{0.85\\,f^{\\prime}_{c,d}\\,(12)}', sub: `\\frac{${n(c.As, 3)}(${n(fy, 0)})}{0.85(${n(fcd, 2)})(12)}`, value: c.a, unit: 'in', d: 3, ref: A10 + '5.6.3.1.1' }, c.As * fy / (0.85 * fcd * 12), P + 'a');
      add({ id: key + '.c', label: `${nm}: neutral axis depth`, sym: 'c', eq: '\\frac{a}{\\beta_{1}}', sub: `\\frac{${n(c.a, 3)}}{${n(b1, 3)}}`, value: c.c, unit: 'in', d: 3, ref: A10 + '5.6.2.2', note: `β_1 = 0.85 − 0.05(f′c,d − 4), 0.65 to 0.85: ${n(b1, 3)} (display).` }, c.a / b1, P + 'c');
      add({ id: key + '.et', label: `${nm}: net tensile strain`, sym: '\\varepsilon_{t}', eq: '0.003\\left(\\frac{d}{c} - 1\\right)', sub: `0.003\\left(\\frac{${n(c.dEff, 3)}}{${n(c.c, 3)}} - 1\\right)`, value: c.et, unit: '', d: 5 }, 0.003 * (c.dEff / c.c - 1), P + 'et');
      add({ id: key + '.phi', label: `${nm}: resistance factor (nonprestressed)`, sym: '\\phi', eq: '0.75 + 0.15\\,\\frac{\\varepsilon_{t} - 0.002}{0.003}', sub: `0.75 + 0.15\\,\\frac{${n(c.et, 5)} - 0.002}{0.003}`, value: c.phi, unit: '', d: 3, ref: A10 + 'Eq. 5.5.4.2-1', note: 'Limited to 0.75 to 0.90.' }, clamp(0.75 + 0.15 * (c.et - 0.002) / 0.003, 0.75, 0.9), P + 'phi');
      add({ id: key + '.Mn', label: `${nm}: nominal resistance`, sym: 'M_{n}', eq: '\\frac{A_{s}\\,f_{y}(d - a/2)}{12}', sub: `\\frac{${n(c.As, 3)}(${n(fy, 0)})(${n(c.dEff, 3)} - ${n(c.a, 3)}/2)}{12}`, value: c.Mn, unit: 'kip-ft/ft', d: 3, ref: A10 + 'Eq. 5.6.3.2.3-1' }, c.As * fy * (c.dEff - c.a / 2) / 12, P + 'Mn');
      add({ id: key + '.phiMn', label: `${nm}: factored resistance`, sym: '\\phi M_{n}', eq: '\\phi\\,M_{n}', sub: `${n(c.phi, 3)}(${n(c.Mn, 3)})`, value: c.phiMn, unit: 'kip-ft/ft', d: 3 }, c.phi * c.Mn, P + 'phiMn');
      const k = ckIx(R, chk);
      add({ id: key + '.r', label: `Ratio, ${nm.toLowerCase()}`, sym: 'D/C', eq: '\\frac{M_{u}}{\\phi M_{n}}', sub: `\\frac{${n(c.Mu, 3)}}{${n(c.phiMn, 3)}}`, value: R.checks[k].r, unit: '', d: 3, ok: R.checks[k].pass }, c.Mu / c.phiMn, `checks.${k}.r`);
    };
    cap('pos', 'Positive moment, bottom bars', D.pos, +Di.barBot, +Di.sBot, +Di.coverB, 'Deck +M');
    cap('neg', 'Negative moment, top bars', D.neg, +Di.barTop, +Di.sTop, +Di.coverT, 'Deck −M');
    // overhang
    const bF = D.bBar / 12;
    add({ id: 'X', label: 'Overhang: wheel 1 ft from the railing face, distance to the support', sym: 'X', eq: '\\max\\left(o_{h} - \\frac{b_{bar}}{12} - 1.0,\\ 0\\right)', sub: `\\max\\left(${n(D.oh, 3)} - \\frac{${n(D.bBar, 2)}}{12} - 1.0,\\ 0\\right)`, value: D.Xoh, unit: 'ft', d: 3, ref: A10 + '3.6.1.3.1',
      note: 'o_h = the deck overhang from the design girder ℄ (Cross-section tab), b_bar = the barrier base width.' }, Math.max(D.oh - bF - 1, 0), 'deck.Xoh');
    add({ id: 'SWoh', label: 'Overhang: equivalent strip width', sym: 'SW_{oh}', eq: '45.0 + 10.0\\,X', sub: `45.0 + 10.0(${n(D.Xoh, 3)})`, value: D.SWoh, unit: 'in', d: 1, ref: A10 + 'Table 4.6.2.1.3-1' }, 45 + 10 * D.Xoh, 'deck.SWoh');
    add({ id: 'MohDC', label: 'Overhang: slab and barrier moment (DC)', sym: 'M_{DC,oh}', eq: '\\frac{w_{DC}\\,o_{h}^{2}}{2} + P_{bar}\\left(o_{h} - \\frac{b_{bar}}{24}\\right)', sub: `\\frac{${n(D.wDLslab, 4)}(${n(D.oh, 3)})^{2}}{2} + ${n(D.Pbar, 3)}(${n(D.oh, 3)} - \\frac{${n(D.bBar, 2)}}{24})`, value: D.MohDC, unit: 'kip-ft/ft', d: 3, note: 'Barrier at its centroid (half its base width from the edge); the arm is not taken below 0.' },
      D.wDLslab * D.oh * D.oh / 2 + D.Pbar * Math.max(D.oh - bF / 2, 0), 'deck.MohDC');
    add({ id: 'MohDW', label: 'Overhang: wearing-surface moment (DW, inside the barrier)', sym: 'M_{DW,oh}', eq: '\\frac{w_{DW}\\left(o_{h} - b_{bar}/12\\right)^{2}}{2}', sub: `\\frac{${n(D.wDLws, 4)}(${n(D.oh, 3)} - ${n(bF, 3)})^{2}}{2}`, value: D.MohDW, unit: 'kip-ft/ft', d: 4 }, D.wDLws * Math.pow(Math.max(D.oh - bF, 0), 2) / 2, 'deck.MohDW');
    add({ id: 'MohLL', label: 'Overhang: wheel moment on the strip (IM 1.33, multiple presence 1.20, 16 kip wheel)', sym: 'M_{LL,oh}', eq: '\\frac{1.33(1.20)(16)\\,X}{SW_{oh}/12}', sub: `\\frac{1.33(1.20)(16)(${n(D.Xoh, 3)})}{${n(D.SWoh, 1)}/12}`, value: D.MohLL, unit: 'kip-ft/ft', d: 3, ref: A10 + '3.6.1.1.2, 3.6.2' }, 1.33 * 1.2 * 16 * D.Xoh / (D.SWoh / 12), 'deck.MohLL');
    add({ id: 'Muoh', label: 'Overhang: factored moment, Strength I (gravity and barrier only)', sym: 'M_{u,oh}', eq: `${eE}1.25\\,M_{DC,oh} + 1.50\\,M_{DW,oh} + 1.75\\,${mE}M_{LL,oh}${eEc}`, sub: `${eV}1.25(${n(D.MohDC, 3)}) + 1.50(${n(D.MohDW, 4)}) + 1.75(${mV}${n(Math.max(D.MohLL, 0), 3)})${eC}`, value: D.Mu_oh, unit: 'kip-ft/ft', d: 3, ref: ref1,
      note: 'The Extreme Event II collision cases (A13.4) need a barrier-specific analysis (not checked).' }, Mu(D.MohDC, D.MohDW, D.MohLL, v => Math.max(v, 0)), 'deck.Mu_oh');
    add({ id: 'oh.phiMn', label: 'Overhang: factored resistance (the top bars, as the negative moment)', sym: '\\phi M_{n,oh}', eq: '\\phi\\,M_{n}', sub: `${n(D.ohCap.phi, 3)}(${n(D.ohCap.Mn, 3)})`, value: D.ohCap.phiMn, unit: 'kip-ft/ft', d: 3, note: 'Same bars, cover and depth as the negative moment above.' }, D.ohCap.phi * D.ohCap.Mn, 'deck.ohCap.phiMn');
    const kO = ckIx(R, 'Deck overhang');
    add({ id: 'oh.r', label: 'Ratio, overhang', sym: 'D/C', eq: '\\frac{M_{u,oh}}{\\phi M_{n,oh}}', sub: `\\frac{${n(D.Mu_oh, 3)}}{${n(D.ohCap.phiMn, 3)}}`, value: R.checks[kO].r, unit: '', d: 3, ok: R.checks[kO].pass }, D.Mu_oh / D.ohCap.phiMn, `checks.${kO}.r`);
    add({ id: 'dist', label: 'Distribution reinforcement, percent of the positive-moment steel', sym: '\\%', eq: '\\min\\left(\\frac{220}{\\sqrt{S}},\\ 67\\right)', sub: `\\min\\left(\\frac{220}{\\sqrt{${n(S, 3)}}},\\ 67\\right)`, value: D.distPct, unit: '', d: 1, ref: A10 + '9.7.3.2', note: 'S in ft (the engine: the girder spacing). Bottom bars parallel to the girders.' }, Math.min(220 / Math.sqrt(S), 67), 'deck.distPct');
    return K.done();
  }

  /* ---------- Rating (pbd-compute.js computeAll: rating, shrRating, svcRating, vehRatings) ---------- */
  function rating(inp, R) {
    const { kit, n } = PW(), K = kit('rt'), add = K.add;
    const rt = R.rating, sh = R.shrRating, sv = R.svcRating, G = R.g, cp = R.cp;
    add({ id: 'phiCS', label: 'Condition × system factor (used)', sym: '\\phi_{c}\\phi_{s}', eq: '\\min(\\max(\\phi_{c}\\phi_{s},\\ 0.85),\\ 1.0)', sub: `\\min(\\max(${n(rt.phiC, 2)}(${n(rt.phiS, 2)}),\\ 0.85),\\ 1.0)`, value: rt.phiCS, unit: '', d: 3, ref: 'MBE Eq. 6A.4.2.1-3',
      note: 'φ_c and φ_s: Loads tab (MBE Tables 6A.4.2.3-1, 6A.4.2.4-1; blank = 1.00). Applied to the flexure and shear ratings and the vehicles, not to Service III.' }, clamp(rt.phiC * rt.phiS, 0.85, 1.0), 'rating.phiCS');
    // flexure at the governing station
    const fr = R.flexFull.find(r => r.x === rt.x && r.mLLpos > 1e-6);
    add({ id: 'Rn', label: `Flexure: factored resistance at x = ${n(rt.x, 2)} ft (the governing station: lowest inventory RF)`, sym: '\\phi M_{n}', value: rt.Rn, unit: 'kip-ft', d: 1, ref: 'MBE 6A.4', note: 'The strength check\'s φM_n at that station (Flexure tab, the flexure stations).' }, fr ? fr.phiMn / 12 : undefined, 'rating.Rn');
    if (fr) add({ id: 'MDC', label: 'Flexure: dead-load moment (DC: girder, DC1, DC2)', sym: 'M_{DC}', eq: 'M_{g} + M_{DC1} + M_{DC2}', sub: `${n(fr.mSW, 1)} + ${n(fr.mDC1, 1)} + ${n(fr.mDC2, 1)}`, value: rt.MDC, unit: 'kip-ft', d: 1 }, fr.mSW + fr.mDC1 + fr.mDC2, 'rating.MDC');
    else add({ id: 'MDC', label: 'Flexure: dead-load moment (DC) at midspan', sym: 'M_{DC}', value: rt.MDC, unit: 'kip-ft', d: 1, note: 'No station with positive live-load moment: rated at midspan.' }, undefined, 'rating.MDC');
    add({ id: 'MDW', label: 'Flexure: wearing-surface moment (DW)', sym: 'M_{DW}', value: rt.MDW, unit: 'kip-ft', d: 1 }, fr ? fr.mDW : undefined, 'rating.MDW');
    add({ id: 'MLL', label: 'Flexure: live-load moment (HL-93 with IM and DF)', sym: 'M_{LL+IM}', value: rt.MLL, unit: 'kip-ft', d: 1, note: 'Analysis tab.' }, fr ? fr.mLLpos : undefined, 'rating.MLL');
    const rfEq = (g, R_, Dc, Dw, L_) => `\\frac{${n(rt.phiCS, 3)}(${n(R_, 1)}) - 1.25(${n(Dc, 1)}) - 1.50(${n(Dw, 1)})}{${g}(${n(L_, 1)})}`;
    const rfF = (Rn, Dc, Dw, Ll, g) => (rt.phiCS * Rn - 1.25 * Dc - 1.50 * Dw) / (g * Ll);
    const eqM = '\\frac{\\phi_{c}\\phi_{s}\\,\\phi M_{n} - \\gamma_{DC}M_{DC} - \\gamma_{DW}M_{DW}}{\\gamma_{LL}\\,M_{LL+IM}}';
    add({ id: 'RFinv', label: 'Flexure: inventory rating factor (γ_LL = 1.75)', sym: 'RF_{inv}', eq: eqM, sub: rfEq('1.75', rt.Rn, rt.MDC, rt.MDW, rt.MLL), value: rt.RFinv, unit: '', d: 3, ok: rt.okInv, ref: 'MBE Eq. 6A.4.2.1-1', note: 'γ_DC = 1.25, γ_DW = 1.50 (MBE Table 6A.4.2.2-1, Strength I).' }, rfF(rt.Rn, rt.MDC, rt.MDW, rt.MLL, 1.75), 'rating.RFinv');
    add({ id: 'RFopr', label: 'Flexure: operating rating factor (γ_LL = 1.35)', sym: 'RF_{opr}', eq: eqM, sub: rfEq('1.35', rt.Rn, rt.MDC, rt.MDW, rt.MLL), value: rt.RFopr, unit: '', d: 3, ok: rt.okOpr, ref: 'MBE Eq. 6A.4.2.1-1' }, rfF(rt.Rn, rt.MDC, rt.MDW, rt.MLL, 1.35), 'rating.RFopr');
    const md = rt.mid;
    add({ id: 'RFmid', label: 'Flexure: inventory rating factor at midspan (for comparison)', sym: 'RF_{inv,mid}', eq: eqM, sub: rfEq('1.75', md.Rn, md.MDC, md.MDW, md.MLL), value: md.RFinv, unit: '', d: 3, note: 'Midspan φM_n and demands; also the capacity side of the vehicles below.' }, rfF(md.Rn, md.MDC, md.MDW, md.MLL, 1.75), 'rating.mid.RFinv');
    // shear at the governing shear section
    add({ id: 'phiVn', label: `Shear: factored resistance at x = ${n(sh.x, 2)} ft (the governing shear section)`, sym: '\\phi V_{n}', eq: '\\phi_{v}\\,V_{n}', sub: `${n(R.phiV, 2)}(${n(R.wShear.Vn, 2)})`, value: sh.phiVn, unit: 'kip', d: 1, ref: 'MBE 6A.5.6', note: 'The design\'s general-procedure (MCFT) V_n (Shear tab), where V_u/φV_n is greatest (bearing face excluded).' }, R.phiV * R.wShear.Vn, 'shrRating.phiVn');
    add({ id: 'VDC', label: 'Shear: dead-load shear (DC)', sym: 'V_{DC}', value: sh.VDC, unit: 'kip', d: 1, note: '|V_g + V_DC1 + V_DC2| at x (the engine\'s shear functions; Analysis tab).' }, undefined, 'shrRating.VDC');
    add({ id: 'VDW', label: 'Shear: wearing-surface shear (DW)', sym: 'V_{DW}', value: sh.VDW, unit: 'kip', d: 1 }, undefined, 'shrRating.VDW');
    add({ id: 'VLL', label: 'Shear: live-load shear (HL-93 with IM and DF, envelope)', sym: 'V_{LL+IM}', value: sh.VLL, unit: 'kip', d: 1 }, undefined, 'shrRating.VLL');
    const eqV = '\\frac{\\phi_{c}\\phi_{s}\\,\\phi V_{n} - \\gamma_{DC}V_{DC} - \\gamma_{DW}V_{DW}}{\\gamma_{LL}\\,V_{LL+IM}}', vOK = sh.VLL > 0;
    add({ id: 'RFvInv', label: 'Shear: inventory rating factor (γ_LL = 1.75)', sym: 'RF_{v,inv}', eq: eqV, sub: rfEq('1.75', sh.phiVn, sh.VDC, sh.VDW, sh.VLL), value: sh.RFinv, unit: '', d: 3, ok: sh.okInv, ref: 'MBE 6A.5.6', note: vOK ? '' : 'No live-load shear at x: the engine reports 99.' }, vOK ? rfF(sh.phiVn, sh.VDC, sh.VDW, sh.VLL, 1.75) : 99, 'shrRating.RFinv');
    add({ id: 'RFvOpr', label: 'Shear: operating rating factor (γ_LL = 1.35)', sym: 'RF_{v,opr}', eq: eqV, sub: rfEq('1.35', sh.phiVn, sh.VDC, sh.VDW, sh.VLL), value: sh.RFopr, unit: '', d: 3, ok: sh.okOpr, ref: 'MBE 6A.5.6' }, vOK ? rfF(sh.phiVn, sh.VDC, sh.VDW, sh.VLL, 1.35) : 99, 'shrRating.RFopr');
    // Service III at the governing bottom-tension section
    const row = R.grid.find(r => r.x === sv.x), dg = R.diagrams.find(r => r.x === sv.x);
    if (row) {
      add({ id: 'fPS', label: `Service III: prestress compression at the bottom fibre, x = ${n(sv.x, 2)} ft`, sym: 'f_{ps}', eq: '\\frac{P_{e}}{A} + \\frac{P_{e}\\,e}{S_{b}}', sub: `\\frac{${n(row.Aps * R.fpe, 1)}}{${n(G.A, 1)}} + \\frac{${n(row.Aps * R.fpe, 1)}(${n(row.e, 3)})}{${n(G.Sb, 0)}}`, value: sv.fPS, unit: 'ksi', d: 3, ref: 'MBE 6A.5.4.1',
        note: `P_e = A_ps f_pe = ${n(row.Aps, 3)}(${n(R.fpe, 2)}) at the governing Service III section (Stresses tab); f_pe without the elastic gains.` }, row.Aps * R.fpe / G.A + row.Aps * R.fpe * row.e / G.Sb, 'svcRating.fPS');
      add({ id: 'fDC', label: 'Service III: bottom-fibre tension from DC', sym: 'f_{DC}', eq: '\\frac{12(M_{g} + M_{DC1})}{S_{b}} + \\frac{12\\,M_{DC2}}{S_{bc}}', sub: dg ? `\\frac{${n(row.Mg + row.Mdk, 0)}}{${n(G.Sb, 0)}} + \\frac{12(${n(dg.M_DC2, 1)})}{${n(cp.Sbc, 0)}}` : `\\frac{${n(row.Mg + row.Mdk, 0)}}{${n(G.Sb, 0)}} + \\ldots`, value: sv.fDC, unit: 'ksi', d: 3,
        note: 'M_g + M_DC1 in kip-in on the girder section; M_DC2 on the composite section (Analysis tab).' }, dg ? (row.Mg + row.Mdk) / G.Sb + dg.M_DC2 * 12 / cp.Sbc : undefined, 'svcRating.fDC');
      add({ id: 'fDW', label: 'Service III: bottom-fibre tension from DW', sym: 'f_{DW}', eq: '\\frac{12\\,M_{DW}}{S_{bc}}', sub: dg ? `\\frac{12(${n(dg.M_DW, 1)})}{${n(cp.Sbc, 0)}}` : '', value: sv.fDW, unit: 'ksi', d: 3 }, dg ? dg.M_DW * 12 / cp.Sbc : undefined, 'svcRating.fDW');
      add({ id: 'fLL', label: 'Service III: bottom-fibre tension from LL + IM (unfactored)', sym: 'f_{LL}', eq: '\\frac{M_{LL}}{S_{bc}}', sub: `\\frac{${n(row.Mll, 0)}}{${n(cp.Sbc, 0)}}`, value: sv.fLL, unit: 'ksi', d: 3, note: 'M_LL in kip-in, with IM and DF.' }, row.Mll / cp.Sbc, 'svcRating.fLL');
    }
    add({ id: 'fr', label: 'Service III: allowable tension', sym: 'f_{r}', eq: inp.opt.corrosion === 'severe' ? '\\min(0.0948\\sqrt{f^{\\prime}_{c}},\\ 0.3)' : '\\min(0.19\\sqrt{f^{\\prime}_{c}},\\ 0.6)', sub: inp.opt.corrosion === 'severe' ? `\\min(0.0948\\sqrt{${n(+inp.mat.fc, 2)}},\\ 0.3)` : `\\min(0.19\\sqrt{${n(+inp.mat.fc, 2)}},\\ 0.6)`, value: sv.fr, unit: 'ksi', d: 3, ref: A10 + 'Table 5.9.2.3.2b-1' },
      inp.opt.corrosion === 'severe' ? Math.min(0.0948 * Math.sqrt(+inp.mat.fc), 0.3) : Math.min(0.19 * Math.sqrt(+inp.mat.fc), 0.6), 'svcRating.fr');
    const sOK = sv.fLL > 0;
    add({ id: 'RFs3', label: 'Service III rating factor (γ_DC = γ_DW = 1.0, γ_LL = 0.8)', sym: 'RF_{SIII}', eq: '\\frac{f_{r} + f_{ps} - \\gamma_{DC}f_{DC} - \\gamma_{DW}f_{DW}}{\\gamma_{LL}\\,f_{LL}}', sub: `\\frac{${n(sv.fr, 3)} + ${n(sv.fPS, 3)} - ${n(sv.fDC, 3)} - ${n(sv.fDW, 3)}}{0.8(${n(sv.fLL, 3)})}`, value: sv.RF, unit: '', d: 3, ok: sv.ok, ref: 'MBE 6A.5.4.1',
      note: sOK ? 'MBE Table 6A.4.2.2-1 (Service III). Mandatory for prestressed concrete; not × φ_c φ_s.' : 'No live-load tension at the bottom fibre: the engine reports 99 (not applicable).' }, sOK ? (sv.fr + sv.fPS - sv.fDC - sv.fDW) / (0.8 * sv.fLL) : 99, 'svcRating.RF');
    // the entered vehicles
    const capM = rt.phiCS * md.Rn - 1.25 * md.MDC - 1.50 * md.MDW, capV = rt.phiCS * sh.phiVn - 1.25 * sh.VDC - 1.50 * sh.VDW;
    (R.vehRatings || []).forEach((v, i) => {
      const P = `vehRatings.${i}.`, nm = `Vehicle ${i + 1} (${v.name})`;
      add({ id: `veh${i}.RFm`, label: `${nm}: flexure (midspan)`, sym: 'RF_{M}', eq: '\\frac{\\phi_{c}\\phi_{s}\\,\\phi M_{n} - 1.25\\,M_{DC} - 1.50\\,M_{DW}}{M_{LL,fact}}', sub: `\\frac{${n(rt.phiCS, 3)}(${n(md.Rn, 1)}) - 1.25(${n(md.MDC, 1)}) - 1.50(${n(md.MDW, 1)})}{${n(v.M, 1)}}`, value: v.RFm, unit: '', d: 3, ref: 'MBE 6A.4.4, 6A.4.5',
        note: v.M > 0 ? `Entered factored M = ${n(v.M, 1)} kip-ft (DF, IM, MPF and γ_LL applied by you); net capacity ${n(capM, 1)} kip-ft (display).` : 'No moment entered: the engine reports 99.' }, v.M > 0 ? capM / v.M : 99, P + 'RFm');
      add({ id: `veh${i}.RFv`, label: `${nm}: shear (governing shear section)`, sym: 'RF_{V}', eq: '\\frac{\\phi_{c}\\phi_{s}\\,\\phi V_{n} - 1.25\\,V_{DC} - 1.50\\,V_{DW}}{V_{LL,fact}}', sub: `\\frac{${n(rt.phiCS, 3)}(${n(sh.phiVn, 1)}) - 1.25(${n(sh.VDC, 1)}) - 1.50(${n(sh.VDW, 1)})}{${n(v.V, 1)}}`, value: v.RFv, unit: '', d: 3,
        note: v.V > 0 ? `Net capacity ${n(capV, 1)} kip (display).` : 'No shear entered: the engine reports 99.' }, v.V > 0 ? capV / v.V : 99, P + 'RFv');
      add({ id: `veh${i}.RF`, label: `${nm}: rating factor (governing: ${v.gov})`, sym: 'RF', eq: '\\min(RF_{M},\\ RF_{V})', sub: `\\min(${n(v.RFm, 3)},\\ ${n(v.RFv, 3)})`, value: v.RF, unit: '', d: 3, ok: v.ok }, Math.min(v.RFm, v.RFv), P + 'RF');
      if (v.W > 0) add({ id: `veh${i}.RT`, label: `${nm}: rated load`, sym: 'RT', eq: 'RF\\,W', sub: `${n(v.RF, 3)}(${n(v.W, 1)})`, value: v.RT, unit: 'ton', d: 1 }, v.RF * v.W, P + 'RT');
    });
    return K.done();
  }

  window.PSBWorkedHDR = { handling, deck, rating };
})();
