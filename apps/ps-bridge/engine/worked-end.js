/* apps/ps-bridge/engine/worked-end.js — the worked steps of the End zone & hold-down and the Camber & deflection tabs (window.PSBWorkedEnd).
   Classic script, no DOM. Created 2026-11-12 (PR 2d-1, docs/ps-bridge-plan.md §3 "Tabs and graphics": every number on a tab comes from
   computeAll, no second calculation; the steps substitute the engine's values and a test asserts each step's result equals the engine value).
   Uses window.PSBWorked (engine/worked.js: kit, n, g, par) and window.SharedSteps (CLAUDE.md §6).

   endzone(inp, R), camber(inp, R) -> { steps, pairs, paths } (as engine/worked-stress.js)
     endzone: splitting / bursting resistance (5.9.4.4.1: 4 % of P_i at f_s ≤ 20 ksi within h/4 of the end), confinement (5.9.4.4.2: bar
       size, spacing, extent 1.5d; not for box and slab beams), the bonded release-tension steel (5.9.2.3.1b, where claimed), the draped
       strands (slope; the owner hold-down check where the owner rule applies: F_hd = 2 n_h f_pbt A_b sin α ≤ 0.75 W, MassDOT 3.7.2.2 /
       CTDOT V2 5.9.1.6), debonding (ℓ_d of a debonded strand 5.9.4.3.2, the simple-span length limit 5.9.4.3.3(G), the owner share).
     camber: the prestress camber of the straight and the draped strands, the self-weight, deck, diaphragm and superimposed dead load
       deflections at midspan (PCI Design Handbook method), the net camber at release, erection, deck placement (haunch and screed), the
       beam seat and final (PCI multipliers), the live-load deflection and its limit (2.5.2.6.2), the haunch build-up at midspan.
   PR 2d-3 (PS-10): for AASHTO / RIDOT the same hold-down steps from R.ps10 (engine/holddown.js, the engine addition), where the box is on.
   Display intermediates the engine does not keep are named in their notes (the hold-down location frac × L, the share of debonded strands
   without an owner rule, the simple-span debond length limit, which the engine checks as a warning). The expressions are those of the moved
   engine (pbd-compute.js computeAll, psbReportVals), written out for display. Code basis AASHTO LRFD 10th Ed. (2024). */
(function () {
  'use strict';
  const PW = () => window.PSBWorked;
  const A10 = 'AASHTO LRFD 10th Ed. ';
  const ckIx = (R, name) => R.checks.findIndex(c => c.n === name);
  const rowAt = (R, x) => R.grid.reduce((b, r) => Math.abs(r.x - x) < Math.abs(b.x - x) ? r : b, R.grid[0]);

  function endzone(inp, R) {
    const { kit, n, g, par } = PW(), K = kit('ez'), add = K.add;
    const G = R.g, ss = R.ss, L = R.L, o = inp.opt, Pi = ss.Aps * R.fpi;
    // splitting / bursting (5.9.4.4.1)
    add({ id: 'Pi', label: 'Prestress force at transfer (all strands)', sym: 'P_{i}', eq: 'A_{ps}\\,f_{pi}', sub: `${n(ss.Aps, 3)}(${n(R.fpi, 2)})`, value: R.rv.terms.Pi, unit: 'kip', d: 1, ref: A10 + '5.9.4.4.1',
      note: `A_ps = ${ss.Ntot} × ${n(ss.st.Ab, 3)} in² (every strand, draped included); f_pi after elastic shortening (Losses tab).` }, Pi, 'rv.terms.Pi');
    add({ id: 'Pr', label: 'Splitting resistance required', sym: 'P_{r,req}', eq: '0.04\\,P_{i}', sub: `0.04(${n(Pi, 1)})`, value: R.splitDem, unit: 'kip', d: 1, ref: A10 + 'Eq. 5.9.4.4.1-1' }, 0.04 * Pi, 'splitDem');
    add({ id: 'AsReq', label: 'Splitting steel required (f_s limited to 20 ksi)', sym: 'A_{s,req}', eq: '\\frac{0.04\\,P_{i}}{f_{s}}', sub: `\\frac{${n(R.splitDem, 2)}}{20}`, value: R.AsSplit, unit: 'in^{2}', d: 2, ref: A10 + '5.9.4.4.1' }, R.splitDem / 20, 'AsSplit');
    add({ id: 'h4', label: `Zone for the splitting steel (h = the overall ${R.splitDir})`, sym: '\\frac{h}{4}', eq: '', sub: `\\frac{${n(R.splitH, 2)}}{4}`, value: R.splitZone, unit: 'in', d: 2, ref: A10 + '5.9.4.4.1',
      note: R.splitDir === 'width' ? 'Solid or voided slab: horizontal bars, h = the overall width.' : 'I-girder, bulb tee, box or tub: vertical bars, h = the overall height.' }, R.splitH / 4, 'splitZone');
    add({ id: 'AsProv', label: 'Splitting steel provided within h/4', sym: 'A_{s,prov}', eq: 'n\\,A_{v}', sub: `${n(+o.splitN || 0, 0)}(${n(+o.splitAv || 0, 2)})`, value: R.AsSplitProv, unit: 'in^{2}', d: 2 }, (+o.splitN || 0) * (+o.splitAv || 0), 'AsSplitProv');
    add({ id: 'PrProv', label: 'Splitting resistance provided', sym: 'P_{r}', eq: 'f_{s}\\,A_{s,prov}', sub: `20(${n(R.AsSplitProv, 2)})`, value: R.splitPr, unit: 'kip', d: 1, ref: A10 + 'Eq. 5.9.4.4.1-1' }, R.AsSplitProv * 20, 'splitPr');
    if (+o.splitAv > 0) add({ id: 'nNeed', label: 'Legs needed at this area per leg', sym: 'n_{req}', eq: '\\left\\lceil\\frac{A_{s,req}}{A_{v}}\\right\\rceil', sub: `\\left\\lceil\\frac{${n(R.AsSplit, 3)}}{${n(+o.splitAv, 2)}}\\right\\rceil`, value: R.splitN_need, unit: '', d: 0 }, Math.ceil(R.AsSplit / +o.splitAv), 'splitN_need');
    const kS = ckIx(R, 'Splitting steel (5.9.4.4)');
    add({ id: 'dc', label: 'Ratio, splitting resistance', sym: 'D/C', eq: '\\frac{0.04\\,P_{i}}{P_{r}}', sub: `\\frac{${n(R.splitDem, 1)}}{${n(R.splitPr, 1)}}`, value: R.checks[kS].r, unit: '', d: 3, ok: R.checks[kS].pass, ref: A10 + '5.9.4.4.1',
      note: R.splitPr > 0 ? '' : 'No splitting steel entered: the engine reports 99.' }, R.splitPr > 0 ? R.splitDem / R.splitPr : 99, `checks.${kS}.r`);
    // confinement (5.9.4.4.2)
    const cf = R.conf;
    if (!cf.exempt) {
      const kC = ckIx(R, 'Confinement steel (5.9.4.4.2)');
      add({ id: 'conf.db', label: `Confinement bar No. ${cf.barNo}: diameter`, sym: 'd_{b}', eq: '\\frac{\\text{No.}}{8}', sub: `\\frac{${cf.barNo}}{8}`, value: cf.db, unit: 'in', d: 3 }, cf.barNo / 8, 'conf.db');
      add({ id: 'conf.size', label: 'Bar size: not less than No. 3', sym: 'r_{size}', eq: '\\frac{0.375}{d_{b}}', sub: `\\frac{0.375}{${n(cf.db, 3)}}`, value: cf.parts[0].r, unit: '', d: 3, ok: cf.sizeOK, ref: A10 + '5.9.4.4.2' }, cf.db > 0 ? 0.375 / cf.db : 99, 'conf.parts.0.r');
      add({ id: 'conf.sp', label: 'Spacing: not more than 6.0 in', sym: 'r_{s}', eq: '\\frac{s}{6.0}', sub: `\\frac{${n(cf.s, 2)}}{6.0}`, value: cf.parts[1].r, unit: '', d: 3, ok: cf.spOK, ref: A10 + '5.9.4.4.2' }, cf.s > 0 ? cf.s / 6 : 99, 'conf.parts.1.r');
      add({ id: 'conf.req', label: 'Extent required from the end (d = overall depth of the precast member)', sym: '1.5\\,d', eq: '1.5\\,h', sub: `1.5(${n(G.h, 2)})`, value: cf.reqExt, unit: 'in', d: 1, ref: A10 + '5.9.4.4.2' }, 1.5 * G.h, 'conf.reqExt');
      add({ id: 'conf.prov', label: 'Extent provided (first bar at the member end)', sym: 'x_{prov}', eq: '(n - 1)\\,s', sub: `(${n(cf.n, 0)} - 1)(${n(cf.s, 2)})`, value: cf.provExt, unit: 'in', d: 1 }, Math.max(cf.n - 1, 0) * cf.s, 'conf.provExt');
      add({ id: 'conf.ext', label: 'Extent: not less than 1.5d', sym: 'r_{ext}', eq: '\\frac{1.5\\,d}{x_{prov}}', sub: `\\frac{${n(cf.reqExt, 1)}}{${n(cf.provExt, 1)}}`, value: cf.parts[2].r, unit: '', d: 3, ok: cf.extOK, ref: A10 + '5.9.4.4.2' }, cf.provExt > 0 ? cf.reqExt / cf.provExt : 99, 'conf.parts.2.r');
      if (cf.s > 0) add({ id: 'conf.nNeed', label: 'Bars needed at this spacing to cover 1.5d', sym: 'n_{req}', eq: '\\left\\lceil\\frac{1.5\\,d}{s}\\right\\rceil + 1', sub: `\\left\\lceil\\frac{${n(cf.reqExt, 1)}}{${n(cf.s, 2)}}\\right\\rceil + 1`, value: cf.nNeed, unit: '', d: 0 }, Math.ceil(cf.reqExt / cf.s) + 1, 'conf.nNeed');
      add({ id: 'conf.gov', label: `Confinement, governing: ${cf.gov.lbl}`, sym: 'D/C', eq: '\\max(r_{size}, r_{s}, r_{ext})', sub: `\\max(${n(cf.parts[0].r, 3)},\\,${n(cf.parts[1].r, 3)},\\,${n(cf.parts[2].r, 3)})`, value: R.checks[kC].r, unit: '', d: 3, ok: R.checks[kC].pass, ref: A10 + '5.9.4.4.2',
        note: 'A detailing rule, not a force check; the bars must also be shaped to enclose the strands (a detail the app cannot verify).' }, Math.max(cf.parts[0].r, cf.parts[1].r, cf.parts[2].r), `checks.${kC}.r`);
    }
    // bonded release-tension steel (5.9.2.3.1b)
    if (o.relBondedReinf) {
      const rs = R.relSteel, kR = ckIx(R, 'Release tens. steel (5.9.2.3.1b)'), cT = R.checks[ckIx(R, 'Release tens')], cB = R.checks[ckIx(R, 'Release tens (+M, bot)')], rT = rowAt(R, cT.loc), rB = rowAt(R, cB.loc);
      add({ id: 'rel.fs', label: 'Stress in the bonded steel', sym: 'f_{s}', eq: '\\min(0.5\\,f_{y},\\ 30)', sub: `\\min(0.5(${n(+o.relFy || 60, 0)}),\\ 30)`, value: rs.fs, unit: 'ksi', d: 1, ref: A10 + 'Table 5.9.2.3.1b-1' }, Math.min(0.5 * (+o.relFy || 60), 30), 'relSteel.fs');
      add({ id: 'rel.Ttop', label: `Concrete tensile force at release, top tension (x = ${n(rT.x, 2)} ft)`, sym: 'T_{top}', eq: '\\int_{f<0} (-f)\\,b(y)\\,dy', sub: `f_{top} = ${par(rT.relTop, 3)},\\ f_{bot} = ${par(rT.relBot, 3)}\\ \\text{ksi}`, value: rs.Ttop, unit: 'kip', d: 1, ref: A10 + 'Table 5.9.2.3.1b-1',
        note: 'Fibre stresses linear over the girder depth (release, Stresses tab); the tension area integrated over the section width at 240 strips (the engine\'s).' }, undefined, 'relSteel.Ttop');
      add({ id: 'rel.Tbot', label: `Concrete tensile force at release, bottom tension (x = ${n(rB.x, 2)} ft)`, sym: 'T_{bot}', eq: '\\int_{f<0} (-f)\\,b(y)\\,dy', sub: `f_{top} = ${par(rB.relTop, 3)},\\ f_{bot} = ${par(rB.relBot, 3)}\\ \\text{ksi}`, value: rs.Tbot, unit: 'kip', d: 1 }, undefined, 'relSteel.Tbot');
      add({ id: 'rel.As', label: `Bonded steel required (governing: ${rs.where})`, sym: 'A_{s,req}', eq: '\\frac{\\max(T_{top}, T_{bot})}{f_{s}}', sub: `\\frac{${n(rs.T, 2)}}{${n(rs.fs, 1)}}`, value: rs.AsReq, unit: 'in^{2}', d: 2, ref: A10 + 'Table 5.9.2.3.1b-1' }, rs.fs > 0 ? rs.T / rs.fs : 0, 'relSteel.AsReq');
      add({ id: 'rel.dc', label: 'Ratio, bonded release-tension steel', sym: 'D/C', eq: '\\frac{A_{s,req}}{A_{s,prov}}', sub: `\\frac{${n(rs.AsReq, 3)}}{${n(rs.AsProv, 2)}}`, value: R.checks[kR].r, unit: '', d: 3, ok: R.checks[kR].pass,
        note: 'The 0.24√f′ci release tension limit is used only with this steel (Stresses tab).' }, rs.AsReq > 1e-9 ? (rs.AsProv > 0 ? rs.AsReq / rs.AsProv : 99) : 0, `checks.${kR}.r`);
    }
    // draped strands and the hold-down force
    if (ss.nh > 0) {
      const hp = ss.hp;
      add({ id: 'slope', label: 'Slope of the draped strands (℄ bearing to the hold-down point)', sym: '\\tan\\alpha', eq: '\\frac{y_{end} - y_{mid}}{12\\,frac\\,L}', sub: `\\frac{${n(+hp.yEnd, 2)} - ${n(+hp.yMid, 2)}}{12(${n(+hp.frac, 3)})(${n(L, 2)})}`, value: ss.slope, unit: '', d: 4, ref: 'PS-13',
        note: `Hold-down points at frac × L = ${n(hp.frac * L, 2)} ft from ℄ bearing (display; PS-13). The slope also gives V_p (Shear tab).` }, (+hp.yEnd - +hp.yMid) / (hp.frac * L * 12), 'ss.slope');
      const hd = (R.own && R.own.hd) || (R.ps10 && !R.ps10.off ? R.ps10 : null), H = R.own && R.own.hd ? 'own.hd' : 'ps10';   // PR 2d-3: PS-10 for AASHTO / RIDOT
      if (hd) {
        const k = R.checks.findIndex(c => /^Hold-down force/.test(c.n)), ps = H === 'ps10', cite = ps ? 'PS-10 (MassDOT 3.7.2.2 / CTDOT V2 5.9.1.6 limit as an option)' : R.checks[k].n.replace(/^Hold-down force \(|\)$/g, '');
        add({ id: 'hd.alpha', label: 'Angle of the draped strands', sym: '\\alpha', eq: '\\tan^{-1}(\\tan\\alpha)', sub: `\\tan^{-1}(${n(ss.slope, 5)})`, value: hd.alpha, unit: 'rad', d: 5 }, Math.atan(ss.slope), H + '.alpha');
        add({ id: 'hd.Fstr', label: 'Hold-down force of one strand at one hold-down point', sym: 'F_{str}', eq: 'f_{pbt}\\,A_{b}\\sin\\alpha', sub: `${n(R.fpbt, 2)}(${n(hd.Ab, 3)})\\sin(${n(hd.alpha, 5)})`, value: hd.Fstr, unit: 'kip', d: 3, note: 'At jacking (f_pbt), before transfer.' }, R.fpbt * hd.Ab * Math.sin(hd.alpha), H + '.Fstr');
        add({ id: 'hd.F', label: 'Hold-down force of all draped strands (two hold-down points)', sym: 'F_{hd}', eq: '2\\,n_{h}\\,F_{str}', sub: `2(${hd.nh})(${n(hd.Fstr, 4)})`, value: hd.Ftot, unit: 'kip', d: 1, ref: cite }, 2 * hd.nh * hd.Fstr, H + '.Ftot');
        add({ id: 'hd.Lg', label: 'Girder length', sym: 'L_{g}', eq: 'L + 2\\,\\frac{e_{end}}{12}', sub: `${n(L, 2)} + 2\\,\\frac{${n(+o.endOh || 0, 2)}}{12}`, value: hd.Lg, unit: 'ft', d: 2, note: 'e_end: the girder end past ℄ bearing (Girders & strands tab).' }, L + 2 * (+o.endOh || 0) / 12, H + '.Lg');
        add({ id: 'hd.W', label: 'Beam weight', sym: 'W', eq: 'w_{sw}\\,L_{g}', sub: `${n(hd.wsw, 4)}(${n(hd.Lg, 2)})`, value: hd.W, unit: 'kip', d: 1 }, hd.wsw * hd.Lg, H + '.W');
        add({ id: 'hd.lim', label: `Hold-down limit (${cite})`, sym: 'F_{hd,max}', eq: `${n(hd.frac, 2)}\\,W`, sub: `${n(hd.frac, 2)}(${n(hd.W, 2)})`, value: hd.lim, unit: 'kip', d: 1, ref: cite,
          note: ps ? `f = ${n(hd.frac, 2)} entered on the Owner rules tab (PS-10 box, default 0.75). AASHTO LRFD sets no limit on the hold-down force; the 75 % is the MassDOT 3.7.2.2 / CTDOT V2 5.9.1.6 rule.` : '' }, hd.frac * hd.W, H + '.lim');
        add({ id: 'hd.r', label: 'Ratio, hold-down force', sym: 'D/C', eq: '\\frac{F_{hd}}{F_{hd,max}}', sub: `\\frac{${n(hd.Ftot, 2)}}{${n(hd.lim, 2)}}`, value: R.checks[k].r, unit: '', d: 3, ok: R.checks[k].pass, ref: cite }, hd.lim > 0 ? hd.Ftot / hd.lim : Infinity, `checks.${k}.r`);
      }
    }
    // debonding (5.9.4.3.3)
    if (ss.Ndebond > 0) {
      const fps = (R.fMid && R.fMid.fps) || R.fpe, db = R.own && R.own.db;
      add({ id: 'db.ld', label: 'Development length of a debonded strand (κ = 2.0)', sym: '\\ell_{d}', eq: '2.0\\left(f_{ps} - \\frac{2}{3}f_{pe}\\right)d_{b}', sub: `2.0\\left(${n(fps, 2)} - \\frac{2}{3}(${n(R.fpe, 2)})\\right)(${n(ss.st.db, 3)})`, value: R.ldDebond, unit: 'in', d: 1, ref: A10 + 'Eq. 5.9.4.3.2-1' }, 2.0 * (fps - (2 / 3) * R.fpe) * ss.st.db, 'ldDebond');
      if (db) { const k = R.checks.findIndex(c => /^Debonded strands/.test(c.n));
        add({ id: 'db.pct', label: 'Debonded strands, share of all strands', sym: '\\frac{N_{db}}{N}', eq: '', sub: `\\frac{${db.n}}{${db.N}}`, value: db.pct, unit: '', d: 3 }, db.n / Math.max(db.N, 1), 'own.db.pct');
        add({ id: 'db.r', label: `Ratio, debonded share (${R.checks[k].n.replace(/^Debonded strands \(|\)$/g, '')})`, sym: 'D/C', eq: '\\frac{N_{db}/N}{max}', sub: `\\frac{${n(db.pct, 4)}}{${n(db.max, 2)}}`, value: R.checks[k].r, unit: '', d: 3, ok: R.checks[k].pass }, db.pct / db.max, `checks.${k}.r`); }
      else add({ id: 'db.pct', label: 'Debonded strands, share of all strands (display)', sym: '\\frac{N_{db}}{N}', eq: '', sub: `\\frac{${ss.Ndebond}}{${ss.Ntot}}`, value: ss.Ndebond / Math.max(ss.Ntot, 1), unit: '', d: 3, note: 'AASHTO sets no limit on the total (5.9.4.3.3: 45 % per row, an engine warning); an owner rule may.' });
      if (!(inp.cont && inp.cont.on)) add({ id: 'db.max', label: 'Longest debond length, simple span (display; the engine checks it as a warning)', sym: 'x_{db,max}', eq: '\\min\\left(0.20\\,L,\\ \\frac{L}{2} - \\frac{\\ell_{d}}{12}\\right)', sub: `\\min\\left(0.20(${n(L, 2)}),\\ \\frac{${n(L, 2)}}{2} - \\frac{${n(R.ldDebond, 1)}}{12}\\right)`, value: Math.min(0.2 * L, L / 2 - R.ldDebond / 12), unit: 'ft', d: 2, ref: A10 + '5.9.4.3.3(G)' });
    }
    void g;
    return K.done();
  }

  function camber(inp, R) {
    const { kit, n, g } = PW(), K = kit('cb'), add = K.add;
    const G = R.g, cp = R.cp, ss = R.ss, L = R.L, Lin = L * 12, c = R.cam, rv = R.rv, Eci = R.lo.Eci, Ec = cp.Ecg, Ig = G.I, Ic = cp.Ic, m = inp.opt.mult;
    add({ id: 'Ps', label: 'Force in the straight strands after transfer', sym: 'P_{s}', eq: 'A_{ps,s}\\,f_{pi}', sub: `${n(ss.AsStraight, 3)}(${n(R.fpi, 2)})`, value: rv.Ps, unit: 'kip', d: 1 }, ss.AsStraight * R.fpi, 'rv.Ps');
    add({ id: 'eS', label: 'Eccentricity of the straight strands', sym: 'e_{s}', eq: 'y_{b} - y_{s}', sub: `${n(G.yb, 3)} - ${n(ss.cgsStraight, 3)}`, value: rv.eS, unit: 'in', d: 2 }, G.yb - ss.cgsStraight, 'rv.eS');
    add({ id: 'd1', label: 'Camber from the straight strands (bare girder, release)', sym: '\\Delta_{ps,s}', eq: '\\frac{P_{s}\\,e_{s}\\,L^{2}}{8\\,E_{ci}\\,I_{g}}', sub: `\\frac{${n(rv.Ps, 1)}(${n(rv.eS, 3)})(${n(Lin, 0)})^{2}}{8(${n(Eci, 0)})(${g(Ig, 0)})}`, value: rv.d1, unit: 'in', d: 3, ref: 'PCI Design Handbook' }, rv.Ps * rv.eS * Lin * Lin / (8 * Eci * Ig), 'rv.d1');
    if (ss.nh > 0) {
      add({ id: 'Ph', label: 'Force in the draped strands after transfer', sym: 'P_{h}', eq: 'A_{ps,h}\\,f_{pi}', sub: `${n(ss.AsHarp, 3)}(${n(R.fpi, 2)})`, value: rv.Ph, unit: 'kip', d: 1 }, ss.AsHarp * R.fpi, 'rv.Ph');
      add({ id: 'eHm', label: 'Eccentricity of the draped strands between the hold-down points', sym: 'e_{hm}', eq: 'y_{b} - y_{mid}', sub: `${n(G.yb, 3)} - ${n(+ss.hp.yMid, 2)}`, value: rv.eHm, unit: 'in', d: 2 }, G.yb - (+ss.hp.yMid), 'rv.eHm');
      add({ id: 'eHe', label: 'Eccentricity of the draped strands at ℄ bearing', sym: 'e_{he}', eq: 'y_{b} - y_{end}', sub: `${n(G.yb, 3)} - ${n(+ss.hp.yEnd, 2)}`, value: rv.eHe, unit: 'in', d: 2 }, G.yb - (+ss.hp.yEnd), 'rv.eHe');
      add({ id: 'aH', label: 'Hold-down point from ℄ bearing', sym: 'a', eq: '12\\,frac\\,L', sub: `12(${n(+ss.hp.frac, 3)})(${n(L, 2)})`, value: rv.aH, unit: 'in', d: 1 }, ss.hp.frac * Lin, 'rv.aH');
      add({ id: 'd2', label: 'Camber from the draped strands (bare girder, release)', sym: '\\Delta_{ps,h}', eq: '\\frac{P_{h}}{E_{ci}I_{g}}\\left[\\frac{e_{hm}L^{2}}{8} - \\frac{(e_{hm} - e_{he})a^{2}}{6}\\right]', sub: `\\frac{${n(rv.Ph, 1)}}{${n(Eci, 0)}(${g(Ig, 0)})}\\left[\\frac{${n(rv.eHm, 3)}(${n(Lin, 0)})^{2}}{8} - \\frac{(${n(rv.eHm, 3)} - ${n(rv.eHe, 3)})(${n(rv.aH, 1)})^{2}}{6}\\right]`, value: rv.d2, unit: 'in', d: 3, ref: 'PCI Design Handbook' },
        rv.Ph * (rv.eHm * Lin * Lin / 8 - (rv.eHm - rv.eHe) * rv.aH * rv.aH / 6) / (Eci * Ig), 'rv.d2');
    }
    add({ id: 'dPS', label: 'Prestress camber at midspan', sym: '\\Delta_{ps}', eq: ss.nh > 0 ? '\\Delta_{ps,s} + \\Delta_{ps,h}' : '\\Delta_{ps,s}', sub: ss.nh > 0 ? `${n(rv.d1, 4)} + ${n(rv.d2, 4)}` : n(rv.d1, 4), value: c.dPS, unit: 'in', d: 3, note: 'Upward. E_ci and the gross girder section I_g (release).' }, rv.d1 + rv.d2, 'cam.dPS');
    add({ id: 'dSW', label: 'Self-weight deflection (bare girder, release)', sym: '\\Delta_{sw}', eq: '\\frac{5\\,w_{g}L^{4}}{384\\,E_{ci}I_{g}}', sub: `\\frac{5(${n(R.wG / 12, 5)})(${n(Lin, 0)})^{4}}{384(${n(Eci, 0)})(${g(Ig, 0)})}`, value: c.dSW, unit: 'in', d: 3, note: 'Downward; w_g in kip/in.' }, 5 * (R.wG / 12) * Math.pow(Lin, 4) / (384 * Eci * Ig), 'cam.dSW');
    add({ id: 'dDK', label: 'Deck and haunch deflection (DC1 on the bare girder)', sym: '\\Delta_{dk}', eq: '\\frac{5\\,w_{dk}L^{4}}{384\\,E_{c}I_{g}}', sub: `\\frac{5(${n(R.wDk / 12, 5)})(${n(Lin, 0)})^{4}}{384(${n(Ec, 0)})(${g(Ig, 0)})}`, value: c.dDK, unit: 'in', d: 3, note: 'Downward; the wet deck on the girder alone, final girder modulus E_c.' }, 5 * (R.wDk / 12) * Math.pow(Lin, 4) / (384 * Ec * Ig), 'cam.dDK');
    if (c.dDia > 1e-4) { const D = (inp.loads.diaph || []).filter(d => +d.P > 0 && +d.a * 12 >= 0 && +d.a * 12 <= Lin).map(d => { const a0 = +d.a * 12; return { P: +d.P, a: a0 > Lin / 2 ? Lin - a0 : a0 }; });
      add({ id: 'dDia', label: 'Diaphragm point loads (DC1 on the bare girder)', sym: '\\Delta_{dia}', eq: '\\sum \\frac{P\\,a(3L^{2} - 4a^{2})}{48\\,E_{c}I_{g}}', sub: D.map(q => `\\frac{${n(q.P, 2)}(${n(q.a, 1)})(3(${n(Lin, 0)})^{2} - 4(${n(q.a, 1)})^{2})}{48(${n(Ec, 0)})(${g(Ig, 0)})}`).join(' + '), value: c.dDia, unit: 'in', d: 3, note: 'a from the nearer bearing.' },
        D.reduce((s, q) => s + q.P * q.a * (3 * Lin * Lin - 4 * q.a * q.a) / (48 * Ec * Ig), 0), 'cam.dDia'); }
    add({ id: 'dSD', label: 'Barrier and wearing surface deflection (DC2 + DW on the composite section)', sym: '\\Delta_{sd}', eq: '\\frac{5(w_{DC2} + w_{DW})L^{4}}{384\\,E_{c}I_{c}}', sub: `\\frac{5(${n((R.wBar + R.wDW) / 12, 5)})(${n(Lin, 0)})^{4}}{384(${n(Ec, 0)})(${g(Ic, 0)})}`, value: c.dSD, unit: 'in', d: 3, note: 'Simple-span estimate (also when the girders are made continuous).' }, 5 * ((R.wBar + R.wDW) / 12) * Math.pow(Lin, 4) / (384 * Ec * Ic), 'cam.dSD');
    const dk = c.dDK + c.dDia;
    add({ id: 'rel', label: 'Net camber at release', sym: '\\Delta_{rel}', eq: '\\Delta_{ps} - \\Delta_{sw}', sub: `${n(c.dPS, 4)} - ${n(c.dSW, 4)}`, value: c.rel, unit: 'in', d: 3 }, c.dPS - c.dSW, 'cam.rel');
    add({ id: 'erect', label: 'Net camber at erection', sym: '\\Delta_{erect}', eq: 'C_{ps,E}\\,\\Delta_{ps} - C_{sw,E}\\,\\Delta_{sw}', sub: `${n(+m.psE, 2)}(${n(c.dPS, 4)}) - ${n(+m.swE, 2)}(${n(c.dSW, 4)})`, value: c.erect, unit: 'in', d: 3, ref: 'PCI Design Handbook', note: 'PCI multipliers (Materials tab).' }, m.psE * c.dPS - m.swE * c.dSW, 'cam.erect');
    add({ id: 'deck', label: 'Net camber at deck placement (haunch and screed)', sym: '\\Delta_{deck}', eq: `\\Delta_{erect} - (\\Delta_{dk}${c.dDia > 1e-4 ? ' + \\Delta_{dia}' : ''})`, sub: `${n(c.erect, 4)} - ${n(dk, 4)}`, value: c.afterDeck, unit: 'in', d: 3, note: 'The wet deck at 1.0 (not aged).' }, m.psE * c.dPS - m.swE * c.dSW - c.dDK - c.dDia, 'cam.afterDeck');
    add({ id: 'seat', label: 'Net camber for the beam seats (all dead load locked in at 1.0)', sym: '\\Delta_{seat}', eq: '\\Delta_{deck} - \\Delta_{sd}', sub: `${n(c.afterDeck, 4)} - ${n(c.dSD, 4)}`, value: c.seat, unit: 'in', d: 3, ref: 'MassDOT seat method (as the old app)' }, m.psE * c.dPS - m.swE * c.dSW - c.dDK - c.dDia - c.dSD, 'cam.seat');
    add({ id: 'final', label: 'Final long-term camber', sym: '\\Delta_{final}', eq: `C_{ps,F}\\Delta_{ps} - C_{sw,F}\\Delta_{sw} - C_{dk,F}${c.dDia > 1e-4 ? '(\\Delta_{dk} + \\Delta_{dia})' : '\\Delta_{dk}'} - C_{sd,F}\\Delta_{sd}`, sub: `${n(+m.psF, 2)}(${n(c.dPS, 4)}) - ${n(+m.swF, 2)}(${n(c.dSW, 4)}) - ${n(+m.dkF, 2)}(${n(dk, 4)}) - ${n(+m.sdF, 2)}(${n(c.dSD, 4)})`, value: c.final, unit: 'in', d: 3, ref: 'PCI Design Handbook' },
      m.psF * c.dPS - m.swF * c.dSW - m.dkF * c.dDK - m.dkF * c.dDia - m.sdF * c.dSD, 'cam.final');
    const MLLd = c.MLLd != null ? c.MLLd : R.MLL, den = c.llDen || 800, kL = ckIx(R, 'LL deflection');
    add({ id: 'dLL', label: 'Live-load deflection (equivalent uniform load, composite section)', sym: '\\Delta_{LL}', eq: '\\frac{5\\,M_{LL}L^{2}}{48\\,E_{c}I_{c}}', sub: `\\frac{5(${g(MLLd * 12, 0)})(${n(Lin, 0)})^{2}}{48(${n(Ec, 0)})(${g(Ic, 0)})}`, value: c.dLL, unit: 'in', d: 3, ref: A10 + '2.5.2.6.2',
      note: `M_LL = ${n(MLLd, 1)} kip-ft per girder (LL + IM with DF_M)${c.MLLd != null ? '; simple-span estimate on a continuous unit' : ''}.` }, 5 * (MLLd * 12) * Lin * Lin / (48 * Ec * Ic), 'cam.dLL');
    add({ id: 'llLim', label: `Live-load deflection limit${c.llDen ? ' (MassDOT 3.5.6.1)' : ''}`, sym: '\\Delta_{lim}', eq: `\\frac{L}{${den}}`, sub: `\\frac{${n(Lin, 0)}}{${den}}`, value: c.llLim, unit: 'in', d: 3, ref: c.llDen ? 'MassDOT 3.5.6.1' : A10 + '2.5.2.6.2' }, Lin / den, 'cam.llLim');
    add({ id: 'll.r', label: 'Ratio, live-load deflection', sym: 'D/C', eq: '\\frac{\\Delta_{LL}}{\\Delta_{lim}}', sub: `\\frac{${n(c.dLL, 3)}}{${n(c.llLim, 3)}}`, value: R.checks[kL].r, unit: '', d: 3, ok: R.checks[kL].pass }, c.dLL / c.llLim, `checks.${kL}.r`);
    const hM = R.haunch[5];
    add({ id: 'haunch', label: 'Haunch build-up at midspan', sym: 't_{h,mid}', eq: '\\max(t_{h} + \\Delta_{deck},\\ 0.5)', sub: `\\max(${n(+inp.th, 2)} + ${n(c.afterDeck, 3)},\\ 0.5)`, value: hM.buildup, unit: 'in', d: 2,
      note: 'Shaped along the girder by 4x(L − x)/L² (the tenth-point table).' }, Math.max(+inp.th + c.afterDeck * hM.par, 0.5), 'haunch.5.buildup');
    return K.done();
  }

  window.PSBWorkedEnd = { endzone, camber };
})();
