/* apps/steel-bridge/engine/flexure.js — girder flexure, Strength I and Service II, of a composite steel I-girder
   (window.SBDFlexure). Classic script, no DOM. Needs window.SharedSteps (shared/steps.js) and window.SBDSections
   (engine/sections.js), loaded first.

   Ported 2026-10-29 from GirderDetail ("Steel Bridge Design.html"), Girder section module GM.gs: the flexure part of
   compute() (load factors by sign, stresses by stage, R_h, yield moments D6.2, M_p and D_p, compactness, M_n 6.10.7,
   R_b, F_nc of 6.10.8 with the nonprismatic unbraced length of 6.10.8.2.3c, f_l amplification, Appendix A6 and its
   permission 6.10.6.2.3 (S2-9), Service II stresses and D_c, F_crw, the Fatigue I stress ranges) and the flexure checks
   GS5 to GS10, GS12, GS13 and GS19 of checks(); with the functions they call (rbFactor, ltbFnc, ampFl, fcrw, gsGov).
   From Preliminary sizing's row builder (the same page; detailExport gsRow, feCb, feAt, feNpr, feGe, feGeA, feGov,
   stP, crk, fBotN, rbN, govRec) the per-location L_b and C_b: the unbraced segment(s) containing the location, C_b of
   Eq. 6.10.8.2.3b-1 from the Strength I envelope, and the nonprismatic data. Arithmetic copied operation for operation;
   tests/engine/flexure.test.mjs checks it against GirderDetail's own functions run in Node.

   Not ported (other modules): shear GS11, constructibility GS14 to GS16, fatigue resistance GS17/GS18, proportions
   GS1 to GS4, the design load rating GS20 (owner rules only), owner load rules (OWN6/7/8, the m multiplier).

   Units: moments kip-ft (sagging +), stresses ksi (tension +), plates in, stations and L_b ft.
   Code: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024). φ_f = 1.0 (6.5.4.2).

   Demands come per location, unfactored by load (the normal case) or already factored:
     loc = { name, x (ft, optional), region: 'pos' | 'neg', cont: true | false,
             plates: { D, tw, topB, topT, botB, botT }, beff (in),
             M: { DC1, DC2, DW, LLp, LLn, UT, UF, FATp, FATn },   unfactored; LLp ≥ 0, LLn ≤ 0 (LL+IM, per girder)
             factored: optional { str: { DC1, DC2, DW, LL, UT, UF }, svc: { … }, fat: { p, n } } (load factors already applied;
                       each moment still on its own stage section)
             fl (ksi, first-order lateral bending of the bottom flange, Strength I), Lb (ft), Cb,
             npr: optional nonprismatic data (unbraced(); or entered): { kind: 'simp' | 'ge', b, t, K, geA, gov, Ir, why } }
     prj = { deck: { ts, tdeck, haunch, rebar: { top: { A, c }, bot: { A, c } } }, mat: { Fyt, Fyb, Fyw, Fyr, fc }, n,
             rebarInPositive, G: factors(), a6: { method: 'auto' | '6108', skews: [deg], curved } } */
(function () {
  'use strict';
  const ES = 29000, ED = 'AASHTO LRFD 10th Ed.';
  const St = () => window.SharedSteps, SEC = () => window.SBDSections;
  const n2 = x => St().n(x, 2), n3 = x => St().n(x, 3), n4 = x => St().n(x, 4), g0 = x => St().g(x, 0), g1 = x => St().g(x, 1);
  const pa = x => (x < 0 ? `(${n2(x)})` : n2(x));
  const r1 = v => +(+v).toFixed(1), r2 = v => +(+v).toFixed(2), r3 = v => +(+v).toFixed(3);

  /* ---------- load factors ---------- */
  /* factors(over): Strength I, Service II and Fatigue I load factors, AASHTO LRFD 10th Ed. Tables 3.4.1-1 and 3.4.1-2
     (GirderDetail's defaults: γ_DC 1.25 / 0.90, γ_DW 1.50 / 0.65, γ_LL 1.75, Service II 1.30, Fatigue I 1.75). */
  function factors(over) { return { dc: 1.25, dw: 1.50, dcMin: 0.90, dwMin: 0.65, ll: 1.75, sll: 1.30, fat: 1.75, ...(over || {}) }; }

  /* envelopeStrI(v, G): Strength I max and min of the moments v = { DC1, DC2, DW, LLp, LLn, UT, UF } (kip-ft) at a
     station, as GirderDetail's Structural analysis (saComb, AASHTO base: DC1 + DC2 with one factor by the sign of their
     sum, DW by its sign, LL+IM; utilities UT with the DW factors, UF with γ_DC max and 0). */
  function envelopeStrI(v, G) {
    G = G || factors();
    const dc = v.DC1 + v.DC2, fd = [G.dc, G.dcMin], fw = [G.dw, G.dwMin], fU = [1.25 * G.dc / 1.25, 0];
    const g = (x, f) => x >= 0 ? f[0] * x : f[1] * x, h = (x, f) => x <= 0 ? f[0] * x : f[1] * x;
    const uX = (v.UT ? g(v.UT, fw) : 0) + (v.UF ? g(v.UF, fU) : 0), uN = (v.UT ? h(v.UT, fw) : 0) + (v.UF ? h(v.UF, fU) : 0);
    return { max: g(dc, fd) + g(v.DW, fw) + G.ll * (v.LLp) + uX, min: h(dc, fd) + h(v.DW, fw) + G.ll * (v.LLn) + uN };
  }

  /* ---------- unbraced length and C_b (Preliminary sizing's row builder) ---------- */
  /* feAt(xs, M, x): M linear between the stations xs (ft). */
  function feAt(xs, M, x) { let i = 0; while (i < xs.length - 2 && xs[i + 1] < x) i++; const t = Math.max(0, Math.min(1, (x - xs[i]) / (xs[i + 1] - xs[i]))); return M[i] * (1 - t) + M[i + 1] * t; }
  /* feCb(xs, M, xa, xb, sgn): C_b of Eq. 6.10.8.2.3b-1 over the segment xa..xb from the envelope M that compresses the flange
     (sgn = −1: negative moment compresses it); M_max the largest compression (41 points), M_A, M_B, M_C absolute values at
     the quarter points; 1.0 where the flange is never in compression. */
  function feCb(xs, M, xa, xb, sgn) {
    const at = x => { let i = 0; while (i < xs.length - 2 && xs[i + 1] < x) i++; const t = Math.max(0, Math.min(1, (x - xs[i]) / (xs[i + 1] - xs[i]))); return M[i] * (1 - t) + M[i + 1] * t; };
    let Mx = 0; for (let k = 0; k <= 40; k++) Mx = Math.max(Mx, sgn * at(xa + (xb - xa) * k / 40));
    if (!(Mx > 0)) return 1; const q = f => Math.abs(at(xa + (xb - xa) * f));
    return 12.5 * Mx / (2.5 * Mx + 3 * q(0.25) + 4 * q(0.5) + 3 * q(0.75));
  }
  /* feCbParts: the same, with M_max, M_A, M_B, M_C, for the worked step */
  function feCbParts(xs, M, xa, xb, sgn) {
    let Mx = 0; for (let k = 0; k <= 40; k++) Mx = Math.max(Mx, sgn * feAt(xs, M, xa + (xb - xa) * k / 40));
    const q = f => Math.abs(feAt(xs, M, xa + (xb - xa) * f));
    return { Mx, MA: q(0.25), MB: q(0.5), MC: q(0.75), Cb: feCb(xs, M, xa, xb, sgn) };
  }
  /* feNpr(xa, xb, secAt, mc): nonprismatic unbraced length, 6.10.8.2.3c: kind 'pris' | 'simp' | 'ge', pieces, I_y1/I_y2, why. */
  function feNpr(xa, xb, secAt, mc) {
    const key = s => [s.topB, s.topT, s.botB, s.botT, s.tw].join(','), e = 1e-4, L = xb - xa, n = Math.max(20, Math.ceil(L / 0.25)), X = k => xa + e + (L - 2 * e) * k / n, tr = [];
    let s0 = secAt(X(0));
    for (let k = 1; k <= n; k++) { const s = secAt(X(k)); if (key(s) === key(s0)) continue; let lo = X(k - 1), hi = X(k);
      for (let j = 0; j < 30; j++) { const m = (lo + hi) / 2; if (key(secAt(m)) === key(s0)) lo = m; else hi = m; } tr.push((lo + hi) / 2); s0 = s; }
    if (!tr.length) return { kind: 'pris', tr, pcs: [{ x0: xa, x1: xb, s: s0 }], Ir: 1, why: '' };
    const bd = [xa, ...tr, xb], pcs = bd.slice(1).map((x, k) => ({ x0: bd[k], x1: x, s: secAt((bd[k] + x) / 2) })), smA = mc(xa) <= mc(xb), Iy = (b, t) => t * b ** 3 / 12;
    let Ir = 1; for (let k = 0; k < tr.length; k++) { const [s1, s2] = smA ? [pcs[k].s, pcs[k + 1].s] : [pcs[k + 1].s, pcs[k].s]; Ir = Math.min(Ir, Iy(s1.topB, s1.topT) / Iy(s2.topB, s2.topT), Iy(s1.botB, s1.botT) / Iy(s2.botB, s2.botT)); }
    let why = '';
    if (tr.length > 1) why = `${tr.length} section changes within L_b`;
    else { const x = tr[0], d = smA ? x - xa : xb - x, [s1, s2] = smA ? [pcs[0].s, pcs[1].s] : [pcs[1].s, pcs[0].s];
      let xm = xa, mm = -Infinity; for (let k = 0; k <= 80; k++) { const q = xa + L * k / 80, v = mc(q); if (v > mm) { mm = v; xm = q; } }
      if (d > 0.2 * L + 1e-6) why = `the section change is ${d.toFixed(2)} ft (${(d / L * 100).toFixed(0)} % of L_b) from the brace point with the smaller moment (limit 20 %)`;
      else if (!['topB', 'topT', 'botB', 'botT', 'tw'].every(k => s2[k] >= s1[k] - 1e-9)) why = 'the section next to the brace point with the smaller moment is not the smaller section';
      else if (smA ? xm < x : xm > x) why = 'the largest moment is not within the larger section';
      else if (Ir < 0.5 - 1e-9) why = `I_y1/I_y2 = ${Ir.toFixed(3)} < 0.5`;
      if (!why) return { kind: 'simp', tr, pcs, Ir, why, big: s2 }; }
    return { kind: 'ge', tr, pcs, Ir, why };
  }
  /* feGe: γ_e by the conservative bound (each section prismatic over the full L_b at its largest stress), the fallback where
     App. D6.6.2 Method A does not apply. */
  function feGe(pcs, LbIn, rtOf, fOf, ks) {
    let best = null; pcs.forEach((p, j) => { const rt = rtOf(p.s); let fm = 0; ks.forEach(k => { fm = Math.max(fm, fOf(p.s, k)); }); if (!(fm > 0)) return;
      const Fe = Math.PI ** 2 * ES / (LbIn / rt) ** 2, g = Fe / fm; if (!best || g < best.g) best = { g, j, fm, Fe, rt, s: p.s }; });
    return best;
  }
  /* feGeA: γ_e by App. D6.6.2 Method A (Eqs. D6.6.2-1, -2, D6.6.2.2-1), in stress form. */
  function feGeA(pcs, tr, xa, xb, LbIn, D, xs, rtOf, fOf) {
    const L = xb - xa, N = xs.length, Fe1 = pcs.map(p => Math.PI ** 2 * ES / (LbIn / rtOf(p.s)) ** 2), memo = pcs.map(() => ({}));
    const fN = (j, k) => k in memo[j] ? memo[j][k] : (memo[j][k] = fOf(pcs[j].s, k));
    const fx = (j, x) => { let i = 0; while (i < N - 2 && xs[i + 1] < x) i++; const t = Math.max(0, Math.min(1, (x - xs[i]) / (xs[i + 1] - xs[i]))); return fN(j, i) * (1 - t) + fN(j, i + 1) * t; };
    let rm = -Infinity, jm = 0, xm = xa;
    pcs.forEach((p, j) => { const pts = [p.x0, p.x1]; xs.forEach(x => { if (x > p.x0 && x < p.x1) pts.push(x); });
      pts.forEach(x => { const r = fx(j, x) / Fe1[j]; if (r > rm) { rm = r; jm = j; xm = x; } }); });
    if (!(rm > 0)) return null;
    const pt = (f, w0, w1) => { const x = xa + f * L, a = xa + w0 * L - 1e-6, b = xa + w1 * L + 1e-6, step = tr.some(q => q >= a && q <= b);
      const js = step ? pcs.map((p, j) => j).filter(j => pcs[j].x1 > a && pcs[j].x0 < b) : [Math.max(0, pcs.findIndex(p => x >= p.x0 - 1e-9 && x <= p.x1 + 1e-9))];
      return { r: Math.max(...js.map(j => Math.abs(fx(j, x)) / Fe1[j])), step }; };
    const A = pt(0.25, 0, 0.5), B = pt(0.5, 0.25, 0.75), C = pt(0.75, 0.5, 1), Cbe = 12.5 * rm / (2.5 * rm + 3 * A.r + 4 * B.r + 3 * C.r);
    const runs = []; tr.forEach((q, k) => { const last = runs[runs.length - 1]; if (last && q - tr[k - 1] < 0.25 * L - 1e-9) last[1] = k + 1; else runs.push([k, k + 1]); });
    const Iw = (b, t) => t * b ** 3, ys = s => { const It = Iw(s.topB, s.topT), Ib = Iw(s.botB, s.botT); return (It * (D + s.topT / 2) - Ib * s.botT / 2) / (It + Ib); };
    let dS = 0, Imx = 1, why = '';
    runs.forEach(([k0, k1]) => { const ps = pcs.slice(k0, k1 + 1).map(p => p.s), y = ps.map(ys); dS = Math.max(dS, Math.max(...y) - Math.min(...y));
      [['top', 'topB', 'topT'], ['bottom', 'botB', 'botT']].forEach(([n, kb, kt]) => { const I = ps.map(s => Iw(s[kb], s[kt])), q = Math.max(...I) / Math.min(...I);
        if (q > Imx) Imx = q; if (q > 2 + 1e-9 && !why) why = `${n} flange I_y changes by a factor ${q.toFixed(2)} > 2.0 ${k1 - k0 > 1 ? `over ${k1 - k0} steps less than 0.25L_b apart` : 'at a step'} near ${pcs[k0].x1.toFixed(2)} ft`; }); });
    const chi = 1 - 4 * dS / LbIn, g = chi * Cbe / rm;
    return { g, Cbe, chi, dS, rm, rA: A.r, rB: B.r, rC: C.r, sA: A.step, sB: B.step, sC: C.step, j: jm, xm, fm: fx(jm, xm), Fe1: Fe1[jm], rt: rtOf(pcs[jm].s), s: pcs[jm].s, Imx, ok: !why, why };
  }
  /* feGov: the governing section of a nonprismatic L_b, where f_bu/R_b is largest (NPG). */
  function feGov(pcs, xs, rbOf, fOf) {
    const N = xs.length; let best = null;
    pcs.forEach((p, j) => { const Rb = rbOf(p.s), pts = [p.x0, p.x1]; xs.forEach(x => { if (x > p.x0 && x < p.x1) pts.push(x); });
      pts.forEach(x => { let i = 0; while (i < N - 2 && xs[i + 1] < x) i++; const t = Math.max(0, Math.min(1, (x - xs[i]) / (xs[i + 1] - xs[i]))), f = fOf(p.s, i) * (1 - t) + fOf(p.s, i + 1) * t;
        if (f > 0 && (!best || f / Rb > best.f / best.Rb + 1e-12)) best = { x, f, Rb, s: p.s, j, i, t }; }); });
    return best;
  }

  /* bracing(x, env, opt): L_b, C_b and the nonprismatic data of the location at x, as Preliminary sizing's row builder (gsRow)
     makes them for Girder section (Strength I; one girder, its brace points = its bearings and cross-frames).
     env = { xs, MDC1, MDC2, MDW, Mn (LL+IM negative), Mun (Strength I minimum), MUT, MUF } at the analysis stations;
     opt = { impl (optional: the fe* functions to use, for the parity test), braces: [ft] (bearings and cross-frames), L (girder length), region, secAt(x) -> plates, D, beff, ts, haunch,
             Ar (total deck rebar within beff) and yr (its height above the top of the slab bottom: ts/2 for one layer at mid-depth),
             FyF (flange F_y), G }.
     Returns the row fields { Lb, Cb, lbB, lbT, npr, lbK, lbIr, nprWhy, geA, nprG, seg: { xa, xb }, cbParts }. */
  function bracing(x, env, opt) {
    const I = opt.impl || {}, feCb_ = I.feCb || feCb, feNpr_ = I.feNpr || feNpr, feGe_ = I.feGe || feGe, feGeA_ = I.feGeA || feGeA, feGov_ = I.feGov || feGov, feAt_ = I.feAt || feAt;
    const xs = env.xs, N = xs.length, Lend = opt.L, region = opt.region, G = opt.G || factors();
    const bp = [...new Set(opt.braces.map(v => +(+v).toFixed(3)))].sort((p1, p2) => p1 - p2).filter((v, k, arr) => k === 0 || v - arr[k - 1] > 0.25);
    const ib = bp.findIndex(v => Math.abs(v - x) < 0.25), Lg = bp[bp.length - 1], segs = [];
    if (ib >= 0) { if (ib > 0) segs.push([bp[ib - 1], bp[ib]]); if (ib < bp.length - 1) segs.push([bp[ib], bp[ib + 1]]); }
    else segs.push([[...bp].reverse().find(v => v < x) ?? 0, bp.find(v => v > x) ?? Lg]);
    const node = q => { let b = 0; xs.forEach((v, i) => { if (Math.abs(v - q) < Math.abs(xs[b] - q)) b = i; }); return b; }, i = node(x);
    const secAt = q => opt.secAt(Math.min(Math.max(q, 1e-6), Lend - 1e-6));
    // Preliminary sizing's own section and stress for γ_e and the governing section (stP, crk, fBotN, rbN): the deck rebar Ar at yr
    const stP = s => { const d = s.D + s.topT + s.botT, parts = [[s.botB * s.botT, s.botT / 2, s.botB * s.botT ** 3 / 12], [s.D * s.tw, s.botT + s.D / 2, s.tw * s.D ** 3 / 12], [s.topB * s.topT, d - s.topT / 2, s.topB * s.topT ** 3 / 12]];
      const A = parts.reduce((q, p) => q + p[0], 0), yb = parts.reduce((q, p) => q + p[0] * p[1], 0) / A; return { A, yb, d, I: parts.reduce((q, p) => q + p[2] + p[0] * (p[1] - yb) ** 2, 0) }; };
    const crk = s => { const { A, yb, d, I } = stP(s), Ar = opt.Ar, yr = d + opt.haunch + opt.yr;
      const Ac = A + Ar, ybc = (A * yb + Ar * yr) / Ac, Ic = I + A * (ybc - yb) ** 2 + Ar * (yr - ybc) ** 2, Dc = Math.max(ybc - s.botT, 1);
      return { Ss: I / yb, Scr: Ic / ybc, Dc, rt: s.botB / Math.sqrt(12 * (1 + Dc * s.tw / (3 * s.botB * s.botT))) }; };
    const fBotN = (s, k) => { const M1 = env.MDC1[k], M2 = env.MDC2[k], Mw = env.MDW[k], gd = M1 + M2 <= 0 ? G.dc : G.dcMin, gw = Mw <= 0 ? G.dw : G.dwMin, p = crk(s);
      const uT = env.MUT ? env.MUT[k] : 0, uF = env.MUF ? env.MUF[k] : 0, Mu1 = (uT <= 0 ? G.dw : G.dwMin) * uT + (uF <= 0 ? G.dc : 0) * uF;
      return -((gd * M1 + Mu1) * 12 / p.Ss + (gd * M2 + gw * Mw + G.ll * env.Mn[k]) * 12 / p.Scr); };
    const rbN = s => { const lrw = 5.7 * Math.sqrt(ES / opt.FyF), Dc = crk(s).Dc; if (!(2 * Dc / s.tw > lrw)) return 1; const awc = Math.min(2 * Dc * s.tw / (s.botB * s.botT), 10); return 1 - awc / (1200 + 300 * awc) * (2 * Dc / s.tw - lrw); };
    const govRec = gv => { if (!gv) return ''; const at = A => A[gv.i] * (1 - gv.t) + A[gv.i + 1] * gv.t, o = { x: r2(gv.x), topB: gv.s.topB, topT: gv.s.topT, botB: gv.s.botB, botT: gv.s.botT, tw: gv.s.tw };
      [['MDC1', 'MDC1'], ['MDC2', 'MDC2'], ['MDW', 'MDW'], ['MLL', 'Mn'], ['MUT', 'MUT'], ['MUF', 'MUF']].forEach(([k, a]) => { if (env[a]) o[k] = r1(at(env[a])); }); return o; };
    const geSeg = (np, p0, p1, LbIn, rtF, fF) => { const ks = []; for (let k = 0; k < N; k++) if (xs[k] >= p0 - 1e-6 && xs[k] <= p1 + 1e-6) ks.push(k);
      const A = feGeA_(np.pcs, np.tr, p0, p1, LbIn, opt.D, xs, rtF, fF), mA = !!(A && A.ok); return { A, mA, G: mA ? A : feGe_(np.pcs, LbIn, rtF, fF, ks) }; };
    const rtS = q => crk(q).rt, fS = (q, k) => fBotN(q, k), byGe = (u, v) => u.ge && v.ge && u.ge.G && v.ge.G ? u.ge.G.g - v.ge.G.g : null;
    const cand = segs.map(([p0, p1]) => { const L = p1 - p0, Cb = region === 'neg' ? feCb_(xs, env.Mun, p0, p1, -1) : 1, np = region === 'neg' ? feNpr_(p0, p1, secAt, q => -feAt_(xs, env.Mun, q)) : null;
      return { xa: p0, xb: p1, L, np, Cb: np && np.kind === 'ge' ? 1 : Cb, ge: np && np.kind === 'ge' ? geSeg(np, p0, p1, L * 12, rtS, fS) : null }; })
      .sort((u, v) => byGe(u, v) ?? v.L / v.Cb - u.L / u.Cb)[0] || { xa: 0, xb: Lend, L: Lend, Cb: 1, np: null };
    const np = cand.np;
    let lbB = 0, lbT = 0, npr = '', lbK = '', lbIr = '', nprWhy = '', geA = '', nprG = '';
    const geRec = A => !A ? '' : A.ok ? { m: 'A', ge: +A.g.toFixed(4), Cbe: r3(A.Cbe), chi: +A.chi.toFixed(4), dS: r3(A.dS), rm: +A.rm.toFixed(4), rA: +A.rA.toFixed(4), rB: +A.rB.toFixed(4), rC: +A.rC.toFixed(4), sA: A.sA ? 1 : 0, sB: A.sB ? 1 : 0, sC: A.sC ? 1 : 0, xm: r2(A.xm), Fe1: r2(A.Fe1), fm: r2(A.fm), Imx: r3(A.Imx) } : { m: 'bound', why: A.why, Imx: r3(A.Imx) };
    if (np && np.kind === 'simp') { npr = 'simp'; lbB = np.big.botB; lbT = np.big.botT; lbIr = r3(np.Ir); }
    else if (np && np.kind === 'ge') { const { A, mA, G: Gq } = cand.ge; npr = 'ge'; lbIr = r3(np.Ir); nprWhy = np.why; geA = geRec(A);
      if (Gq) { lbB = Gq.s.botB; lbT = Gq.s.botT; const fr = fBotN(Gq.s, i); lbK = fr > 0 && !mA ? r3(Math.max(1, Gq.fm / fr)) : '';
        nprG = govRec(feGov_(np.pcs, xs, q => rbN(q), fS)); }
      else { const q = np.pcs.reduce((a, p) => crk(p.s).rt < crk(a.s).rt ? p : a, np.pcs[0]).s; lbB = q.botB; lbT = q.botT; } }
    return { Lb: r2(cand.L), Cb: +cand.Cb.toFixed(3), lbB, lbT, npr, lbK, lbIr, nprWhy, geA, ...(nprG ? { nprG } : {}), seg: { xa: cand.xa, xb: cand.xb },
      cbParts: region === 'neg' && !(np && np.kind === 'ge') ? feCbParts(xs, env.Mun, cand.xa, cand.xb, -1) : null };
  }

  /* ---------- resistances (GirderDetail's functions) ---------- */
  /* rbFactor: R_b, 6.10.1.10.2 (Eq. 6.10.1.10.2-3), λ_rw = 5.7√(E/F_yc) as GirderDetail (see the open item in the fix log). */
  function rbFactor(Dc, tw, bfc, tfc, Fyc) { const lrw = 5.7 * Math.sqrt(ES / Fyc), lw = 2 * Dc / tw, awc = 2 * Dc * tw / (bfc * tfc); return { lrw, lw, awc, Rb: lw <= lrw ? 1 : Math.min(1, 1 - awc / (1200 + 300 * awc) * (lw - lrw)) }; }
  /* ltbFnc: F_nc, 6.10.8.2.2 (FLB) and 6.10.8.2.3 (LTB, Eqs. a-1 to a-5, b-2, b-3); o.rt optional (Eq. c-3). */
  function ltbFnc(o) {
    const Fyr = Math.max(Math.min(0.7 * o.Fyc, o.Fyw), 0.5 * o.Fyc), lf = o.bfc / (2 * o.tfc), lpf = 0.38 * Math.sqrt(ES / o.Fyc), lrf = 0.56 * Math.sqrt(ES / Fyr), cap = o.Rb * o.Rh * o.Fyc;
    const FLB = lf <= lpf ? cap : (1 - (1 - Fyr / (o.Rh * o.Fyc)) * (lf - lpf) / (lrf - lpf)) * cap;
    const rt = o.rt > 0 ? o.rt : o.bfc / Math.sqrt(12 * (1 + o.Dc * o.tw / (3 * o.bfc * o.tfc))), Lp = 1.1 * rt * Math.sqrt(ES / o.Fyc), Lr = Math.PI * rt * Math.sqrt(ES / Fyr), Fcr = o.Cb * o.Rb * Math.PI ** 2 * ES / (o.Lb / rt) ** 2;
    const LTB = o.Lb <= Lp ? cap : o.Lb <= Lr ? Math.min(o.Cb * (1 - (1 - Fyr / (o.Rh * o.Fyc)) * (o.Lb - Lp) / (Lr - Lp)) * cap, cap) : Math.min(Fcr, cap);
    return { Fyr, lf, lpf, lrf, FLB, rt, Lp, Lr, Fcr, LTB, Fnc: Math.min(FLB, LTB), cap };
  }
  /* ampFl: f_l amplification 0.85/(1 − f_bu/F_cr) ≥ 1 where 6.10.1.6 requires it (L_b > 1.2L_p√(C_bR_b/(f_bu/F_yc)), Eq. 6.10.1.6-4). */
  function ampFl(fl, fbu, Fyc, Lp, Lb, Cb, Rb, Fcr) { const lim = 1.2 * Lp * Math.sqrt(Cb * Rb / Math.max(fbu / Fyc, 1e-9)), req = Lb > lim; const AF = req ? (fbu < Fcr ? Math.max(0.85 / (1 - fbu / Fcr), 1) : Infinity) : 1; return { AF, fl: fl * AF, req, lim }; }
  /* fcrw: F_crw, 6.10.1.9.1 (Eqs. 6.10.1.9.1-1, -2); k = 7.2 where both edges of the web are in compression (S2-2). */
  function fcrw(D, tw, Dc, Rh, Fyc, Fyw, both) { const b2 = both === true || Dc > D, k = b2 ? 7.2 : 9 / (Dc / D) ** 2; return { k, both: b2, F: Math.min(0.9 * ES * k / (D / tw) ** 2, Rh * Fyc, Fyw / 0.7), Fe: 0.9 * ES * k / (D / tw) ** 2 }; }

  /* ---------- one location ---------- */
  function location(L, prj, cache) {
    const S = SEC(), G = factors(prj.G), pos = L.region === 'pos', p = L.plates, mat = prj.mat, Fyt = mat.Fyt, Fyb = mat.Fyb, Fyw = mat.Fyw;
    const dk = prj.deck, ts = dk.ts, hh = dk.haunch, rb = dk.rebar || {}, Art = (rb.top && rb.top.A) || 0, Arb = (rb.bot && rb.bot.A) || 0, crt = (rb.top && rb.top.c) || 0, crb = (rb.bot && rb.bot.c) || 0;
    // the section card (engine/sections.js) depends only on the section, deck, materials and region: one per distinct section in a girder
    const ckey = cache && JSON.stringify([p.D, p.tw, p.topB, p.topT, p.botB, p.botT, L.beff, pos]);
    const card = (cache && cache.get(ckey)) || S.card(p, { ts, haunch: hh, beff: L.beff, rebar: rb }, mat, prj.n, { region: pos ? 'pos' : 'neg', rebarInPositive: !!prj.rebarInPositive });
    if (cache) cache.set(ckey, card);
    const s = card.s, c3 = card.c3, cn = card.cn, cr = card.cr, d = s.d;
    const r = { name: L.name, x: L.x, region: pos ? 'pos' : 'neg', pos, cont: L.cont !== false, D: p.D, tw: p.tw, topB: p.topB, topT: p.topT, botB: p.botB, botT: p.botT, beff: L.beff, d, Dt: card.Dt,
      Lb: +L.Lb, Cb: +L.Cb, fl: +L.fl || 0, seg: L.seg || null, cbParts: L.cbParts || null, card, G };
    const M = L.M || {}, num = v => +v || 0;
    const MDC1 = num(M.DC1), MDC2 = num(M.DC2), MDW = num(M.DW), MLLp = num(M.LLp), MLLn = num(M.LLn), MUT = num(M.UT), MUF = num(M.UF);
    Object.assign(r, { MDC1, MDC2, MDW, MLLp, MLLn, MUT, MUF, ut: !!(MUT || MUF) });
    const secs = pos ? { DC1: s, DC2: c3, DW: c3, LL: cn } : { DC1: s, DC2: cr, DW: cr, LL: cr };
    const fAt = (Mm, sec, y) => -Mm * 12 * (y - sec.yb) / sec.I;
    const st = (Mm, sec) => ({ M: Mm, sec, top: fAt(Mm, sec, d), bot: fAt(Mm, sec, 0) });
    const MLL = pos ? MLLp : MLLn; r.MLL = MLL;
    const F = L.factored || null; r.factored = !!F;
    const sg = pos ? 1 : -1, gF = (Mm, mx, mn, s1) => s1 * Mm >= 0 ? mx : mn;
    const gSet = s1 => ({ DC1: gF(MDC1, G.dc, G.dcMin, s1), DC2: gF(MDC2, G.dc, G.dcMin, s1), DW: gF(MDW, G.dw, G.dwMin, s1), UT: gF(MUT, G.dw, G.dwMin, s1), UF: gF(MUF, G.dc, 0, s1) });
    if (!F) {
      r.stg = { DC1: st(MDC1, secs.DC1), DC2: st(MDC2, secs.DC2), DW: st(MDW, secs.DW), LL: st(MLL, secs.LL), UT: st(MUT, s), UF: st(MUF, s) };
      r.gm = gSet(sg); r.gll = G.ll; r.svU = sg * MUF >= 0 ? 1 : 0;
      const comb = (a1, a2, b, l, u1, u2) => ({ top: a1 * r.stg.DC1.top + a2 * r.stg.DC2.top + b * r.stg.DW.top + l * r.stg.LL.top + u1 * r.stg.UT.top + u2 * r.stg.UF.top, bot: a1 * r.stg.DC1.bot + a2 * r.stg.DC2.bot + b * r.stg.DW.bot + l * r.stg.LL.bot + u1 * r.stg.UT.bot + u2 * r.stg.UF.bot });
      r.str = comb(r.gm.DC1, r.gm.DC2, r.gm.DW, G.ll, r.gm.UT, r.gm.UF); r.svc = comb(1, 1, 1, G.sll, 1, r.svU);
      r.Mu = r.gm.DC1 * MDC1 + r.gm.DC2 * MDC2 + r.gm.DW * MDW + G.ll * MLL + r.gm.UT * MUT + r.gm.UF * MUF; r.Ms = MDC1 + MDC2 + MDW + G.sll * MLL + MUT + r.svU * MUF;
      { const gO = gSet(-sg), MLLo = pos ? MLLn : MLLp; r.gmO = gO; r.MLLo = MLLo; r.Mrev = gO.DC1 * MDC1 + gO.DC2 * MDC2 + gO.DW * MDW + G.ll * MLLo + gO.UT * MUT + gO.UF * MUF; r.rev = sg * r.Mrev < 0; }
      r.MD1 = r.gm.DC1 * MDC1 + r.gm.UT * MUT + r.gm.UF * MUF; r.MD2 = r.gm.DC2 * MDC2 + r.gm.DW * MDW;
    } else {   // factored demands: each stage moment already factored (Strength I: F.str, Service II: F.svc)
      const a = F.str || {}, b = F.svc || {}, z = { DC1: 0, DC2: 0, DW: 0, LL: 0, UT: 0, UF: 0 }, A = { ...z, ...a }, B = { ...z, ...b };
      const mk = Q => ({ DC1: st(Q.DC1, secs.DC1), DC2: st(Q.DC2, secs.DC2), DW: st(Q.DW, secs.DW), LL: st(Q.LL, secs.LL), UT: st(Q.UT, s), UF: st(Q.UF, s) });
      const sum = T => ({ top: T.DC1.top + T.DC2.top + T.DW.top + T.LL.top + T.UT.top + T.UF.top, bot: T.DC1.bot + T.DC2.bot + T.DW.bot + T.LL.bot + T.UT.bot + T.UF.bot });
      r.stg = mk(A); r.stgS = mk(B); r.str = sum(r.stg); r.svc = sum(r.stgS); r.fA = A; r.fB = B;
      r.gm = { DC1: 1, DC2: 1, DW: 1, UT: 1, UF: 1 }; r.gll = 1;
      r.Mu = A.DC1 + A.DC2 + A.DW + A.LL + A.UT + A.UF; r.Ms = B.DC1 + B.DC2 + B.DW + B.LL + B.UT + B.UF; r.Mrev = null; r.rev = false;
      r.MD1 = A.DC1 + A.UT + A.UF; r.MD2 = A.DC2 + A.DW;
    }
    r.cF = pos ? { lab: 'top', b: p.topB, t: p.topT, Fy: Fyt, f: -r.str.top } : { lab: 'bottom', b: p.botB, t: p.botT, Fy: Fyb, f: -r.str.bot };
    r.tF = pos ? { lab: 'bottom', b: p.botB, t: p.botT, Fy: Fyb, f: r.str.bot } : { lab: 'top', b: p.topB, t: p.topT, Fy: Fyt, f: r.str.top };
    r.Rh = card.Rh;
    // yield moments, D6.2.2 / D6.2.3
    const MD1 = r.MD1, MD2 = r.MD2, Sx = (sec, y) => sec.I / Math.abs(y - sec.yb), long = pos ? c3 : cr, short = pos ? cn : cr;
    const yld = (y, Fy) => { const S1 = Sx(s, y), S2 = Sx(long, y), S3 = Sx(short, y), MAD = S3 * (Fy - sg * MD1 * 12 / S1 - sg * MD2 * 12 / S2) / 12; return { S1, S2, S3, MAD, My: sg * MD1 + sg * MD2 + MAD, Fy }; };
    r.yT = yld(d, Fyt); r.yB = yld(0, Fyb);
    r.pl = card.pl; r.Dcp = card.Dcp; r.below = !!card.pl.below;
    const yp = r.pl.yp;
    if (pos) {
      r.Dp = r.Dt - yp; r.My = Math.min(r.yT.My, r.yB.My); r.Sxt = r.yB.My * 12 / Fyb;
      r.cmp = { Fy: Fyt <= 70 && Fyb <= 70, Dtw: r.D / r.tw <= 150, web: 2 * r.Dcp / r.tw <= 3.76 * Math.sqrt(ES / Fyt), lim: 3.76 * Math.sqrt(ES / Fyt) };
      r.compact = r.cmp.Fy && r.cmp.Dtw && r.cmp.web;
      r.Mn0 = r.Dp <= 0.1 * r.Dt ? r.pl.Mp : r.pl.Mp * (1.07 - 0.7 * r.Dp / r.Dt); r.cap13 = r.cont ? 1.3 * r.Rh * r.My : Infinity; r.Mn = Math.min(r.Mn0, r.cap13);
      r.Rb = 1; r.FncP = r.Rb * r.Rh * Fyt;
    } else {
      const Dc = Math.max(cr.yb - r.botT, 0); r.Dc = Dc; const RB = rbFactor(Dc, r.tw, r.botB, r.botT, Fyb); r.Rb = RB.Rb; r.rb = RB;
      r.lt = ltbFnc({ bfc: r.botB, tfc: r.botT, Dc, tw: r.tw, Lb: r.Lb * 12, Cb: r.Cb, Rb: r.Rb, Rh: r.Rh, Fyc: Fyb, Fyw });
      r.lt0 = r.lt;
      const N0 = L.npr || {}, lbB = +N0.b || 0, lbT = +N0.t || 0, nk = lbB > 0 && lbT > 0 ? (N0.kind === 'simp' || N0.kind === 'ge' ? N0.kind : lbB * lbT < r.botB * r.botT - 1e-6 ? 'ge' : '') : '';
      r.CbU = r.Cb;
      if (nk === 'simp') { const m = ltbFnc({ bfc: lbB, tfc: lbT, Dc, tw: r.tw, Lb: r.Lb * 12, Cb: r.Cb, Rb: r.Rb, Rh: r.Rh, Fyc: Fyb, Fyw });
        r.lt = { ...r.lt, rt: m.rt, Lp: m.Lp, Lr: m.Lr, Fcr: m.Fcr, LTB: m.LTB, Fnc: Math.min(r.lt.FLB, m.LTB), npr: { kind: 'simp', b: lbB, t: lbT } }; }
      else if (nk === 'ge') { const sS = S.steelCore({ ...p, botB: lbB, botT: lbT }), dS = sS.d; let crS = sS; if (Art > 0) crS = S.addPart(crS, Art, dS + hh + ts - crt, 0); if (Arb > 0) crS = S.addPart(crS, Arb, dS + hh + crb, 0);
        const fS = -(r.gm.DC1 * fAt(MDC1, sS, 0) + (r.ut ? fAt(r.gm.UT * MUT + r.gm.UF * MUF, sS, 0) : 0) + (r.gm.DC2 * MDC2 + r.gm.DW * MDW + G.ll * MLL) * 12 * crS.yb / crS.I), DcS = Math.max(crS.yb - lbT, 0), rtS = lbB / Math.sqrt(12 * (1 + DcS * r.tw / (3 * lbB * lbT)));
        const gR = N0.geA, gA = gR && typeof gR === 'object' && gR.m === 'A' && +gR.ge > 0 ? gR : null;
        const gv = gsGov(N0.gov, r, { G, gF, fAt, Art, Arb, hh, ts, crt, crb, Fyw, Fyt, Fyb });
        const K = +N0.K > 0 ? Math.max(1, +N0.K) : 1, Lbi = r.Lb * 12, FeS = Math.PI ** 2 * ES / (Lbi / rtS) ** 2, fbu = Math.max(gv ? gv.f : r.cF.f, 0), ge = gA ? +gA.ge : fS > 0 ? FeS / (K * fS) : null, Fe = ge != null && fbu > 0 ? ge * fbu : FeS, rtE = Lbi / Math.PI * Math.sqrt(Fe / ES);
        const m = ltbFnc({ bfc: r.botB, tfc: r.botT, Dc, tw: r.tw, Lb: Lbi, Cb: 1, Rb: gv ? gv.Rb : r.Rb, Rh: gv ? gv.Rh : r.Rh, Fyc: Fyb, Fyw, rt: rtE }); r.CbU = 1;
        r.lt = { ...r.lt, rt: m.rt, Lp: m.Lp, Lr: m.Lr, Fcr: m.Fcr, LTB: m.LTB, Fnc: Math.min(r.lt.FLB, m.LTB), ltbCap: m.cap, npr: { kind: 'ge', b: lbB, t: lbT, K, fS, DcS, rtS, FeS, ge, fbu, gv, Fe, rtE, A: gA, bw: gR && typeof gR === 'object' && gR.m === 'bound' ? String(gR.why || '') : null } }; }
      if (r.lt.npr) { r.lt.npr.Ir = +N0.Ir > 0 ? +N0.Ir : null; r.lt.npr.why = typeof N0.why === 'string' ? N0.why : ''; }
      r.fbuC = Math.max(r.cF.f, 0); r.am = ampFl(r.fl, r.fbuC, Fyb, r.lt.Lp, r.Lb * 12, r.CbU, r.Rb, r.lt.Fcr);
      // Appendix A6 and its permission, 6.10.6.2.3 (S2-9)
      const Myc = r.yB.My, Myt = r.yT.My, Iyc = r.botT * r.botB ** 3 / 12, Iyt = r.topT * r.topB ** 3 / 12, lrw = 5.7 * Math.sqrt(ES / Fyb), lw = 2 * Dc / r.tw;
      const brg = prj.a6 || {}, skA = Array.isArray(brg.skews) ? brg.skews.map(v => Math.abs(+v || 0)) : [], skM = skA.length ? Math.max(...skA) : 0;
      const awcP = 2 * Dc * r.tw / (r.botB * r.botT), crwP = awcP > 0 ? Math.min(Math.max(3.1 + 5.0 / awcP, 4.6), 5.7) : 5.7, lrwP = crwP * Math.sqrt(ES / Fyb);
      const A6 = { Myc, Myt, My: Math.min(Myc, Myt), Iyc, Iyt, lrw, lw, awcP, crwP, lrwP, skM, curved: !!brg.curved, why: [], cond: {} };
      A6.cond = { skew: !(skM > 20), straight: !brg.curved, FyF: !(Math.max(Fyt, Fyb) > 70), FyW: !(Fyw > 70), web: !(lw >= lrwP), Iy: !(Iyc / Iyt < 0.3), prism: !r.lt.npr };
      if (skM > 20) A6.why.push(`a support is skewed ${skM.toFixed(0)}° from normal (more than 20°)`); if (brg.curved) A6.why.push('the bridge is horizontally curved');
      if (Math.max(Fyt, Fyb) > 70) A6.why.push('a flange has F_y > 70 ksi'); if (Fyw > 70) A6.why.push('the web has F_y > 70 ksi');
      if (lw >= lrwP) A6.why.push(`the web is slender (2D_c/t_w = ${lw.toFixed(2)} ≥ λ_rw = ${lrwP.toFixed(2)}, c_rw = ${crwP.toFixed(3)})`); if (Iyc / Iyt < 0.3) A6.why.push(`I_yc/I_yt = ${(Iyc / Iyt).toFixed(3)} < 0.3`);
      if (r.lt.npr) A6.why.push(r.lt.npr.kind === 'simp' ? 'the unbraced length is nonprismatic (the simplification of 6.10.8.2.3c is used): Appendix A6 is not used, and 6.10.8 governs (conservative)' : 'the unbraced length is nonprismatic (6.10.8.2.3c): Appendix A6 is not used, and 6.10.8 with C_b = 1.0 and F_e = γ_e f_bu governs');
      A6.ok = !A6.why.length;
      const Mp = r.pl.Mp, lpDcp = Math.min(Math.sqrt(ES / Fyb) / (0.54 * Mp / (r.Rh * A6.My) - 0.09) ** 2, lrw * (r.Dcp / Math.max(Dc, 1e-9))); A6.lpDcp = lpDcp;
      A6.webCompact = 2 * r.Dcp / r.tw <= lpDcp;
      if (A6.webCompact) { A6.Rpc = Mp / Myc; A6.Rpt = Mp / Myt; }
      else { const lpDc = Math.min(lpDcp * Dc / Math.max(r.Dcp, 1e-9), lrw); A6.lpDc = lpDc; const q = (lw - lpDc) / (lrw - lpDc); A6.q = q;
        A6.Rpc = Math.min((1 - (1 - r.Rh * Myc / Mp) * q) * Mp / Myc, Mp / Myc); A6.Rpt = Math.min((1 - (1 - r.Rh * Myt / Mp) * q) * Mp / Myt, Mp / Myt); }
      const Sxc = Myc * 12 / Fyb, Sxt = Myt * 12 / Fyt, h = r.D + (r.topT + r.botT) / 2;
      const J = r.D * r.tw ** 3 / 3 + r.botB * r.botT ** 3 / 3 * (1 - 0.63 * r.botT / r.botB) + r.topB * r.topT ** 3 / 3 * (1 - 0.63 * r.topT / r.topB);
      const FyrA = Math.max(Math.min(0.7 * Fyb, r.Rh * Fyt * Sxt / Sxc, Fyw), 0.5 * Fyb), kc = Math.min(Math.max(4 / Math.sqrt(r.D / r.tw), 0.35), 0.76);
      const lf = r.botB / (2 * r.botT), lpf = 0.38 * Math.sqrt(ES / Fyb), lrf = 0.95 * Math.sqrt(ES * kc / FyrA), RM = A6.Rpc * Myc;
      const MncF = lf <= lpf ? RM : (1 - (1 - FyrA * Sxc / 12 / RM) * (lf - lpf) / (lrf - lpf)) * RM;
      const rt = r.botB / Math.sqrt(12 * (1 + Dc * r.tw / (3 * r.botB * r.botT))), Lp = 1.1 * rt * Math.sqrt(ES / Fyb), Lb = r.Lb * 12;
      const Lr = 1.95 * rt * ES / FyrA * Math.sqrt(J / (Sxc * h)) * Math.sqrt(1 + Math.sqrt(1 + 6.76 * (FyrA / ES * Sxc * h / J) ** 2));
      const FcrA = r.Cb * Math.PI ** 2 * ES / (Lb / rt) ** 2 * Math.sqrt(1 + 0.078 * J / (Sxc * h) * (Lb / rt) ** 2);
      const MncL = Lb <= Lp ? RM : Lb <= Lr ? Math.min(r.Cb * (1 - (1 - FyrA * Sxc / 12 / RM) * (Lb - Lp) / (Lr - Lp)) * RM, RM) : Math.min(FcrA * Sxc / 12, RM);
      Object.assign(A6, { Sxc, Sxt, h, J, FyrA, kc, lf, lpf, lrf, RM, MncF, rt, Lp, Lr, FcrA, MncL, Mnc: Math.min(MncF, MncL), Mnt: A6.Rpt * Myt });
      A6.am = ampFl(r.fl, r.fbuC, Fyb, Lp, Lb, r.Cb, r.Rb, r.lt.Fcr); r.A6 = A6;
      r.useA6 = (!brg.method || brg.method === 'auto') && A6.ok;
    }
    // Service II, D_c from the Service II stresses (D6.3.1), F_crw
    const cS = pos ? -r.svc.top : -r.svc.bot, tS = pos ? r.svc.bot : r.svc.top; r.svcC = cS; r.svcT = tS;
    const fcS = Math.max(cS, 0); r.DcS = fcS > 0 ? Math.max(fcS / (fcS + Math.abs(tS)) * d - (pos ? r.topT : r.botT), 0) : 0; r.webS = fcrw(r.D, r.tw, Math.max(r.DcS, 1e-6), r.Rh, pos ? Fyt : Fyb, Fyw, fcS > 0 && tS < 0);
    // Fatigue I stress ranges (top and bottom of steel); the resistance is the fatigue module's
    const minR = Art + Arb >= 0.01 * r.beff * dk.tdeck - 1e-9; r.fatNegSec = minR ? cn : cr; r.minR = minR;
    const MfP = F && F.fat ? num(F.fat.p) : num(M.FATp), MfN = F && F.fat ? num(F.fat.n) : num(M.FATn), gf = F && F.fat ? 1 : G.fat; r.MfP = MfP; r.MfN = MfN; r.gfat = gf;
    r.dfT = gf * (Math.abs(fAt(MfP, cn, d)) + Math.abs(fAt(MfN, r.fatNegSec, d))); r.dfB = gf * (Math.abs(fAt(MfP, cn, 0)) + Math.abs(fAt(MfN, r.fatNegSec, 0)));
    r.checks = checksOf(r, prj);
    let stp = null;   // the worked steps, built when first read (a girder has hundreds of locations; the page shows one at a time)
    Object.defineProperty(r, 'steps', { enumerable: true, get() { return stp || (stp = worked(r, prj)); } });
    const inUse = r.checks.filter(c => c.inUse && isFinite(c.ratio));
    r.gov = inUse.reduce((b, c) => (!b || c.ratio > b.ratio ? c : b), null);
    return r;
  }

  /* gsGov: f_bu,gov, R_b and R_h of the governing section of a 'ge' unbraced length (GirderDetail gsGov, Strength I). */
  function gsGov(o, r, X) {
    const S = SEC(), pl = ['topB', 'topT', 'botB', 'botT', 'tw'], mk = ['MDC1', 'MDC2', 'MDW', 'MLL'];
    if (!o || typeof o !== 'object' || !pl.every(k => +o[k] > 0) || !mk.every(k => o[k] !== '' && o[k] != null && isFinite(+o[k]))) return null;
    const q = { ...r, topB: +o.topB, topT: +o.topT, botB: +o.botB, botT: +o.botT, tw: +o.tw }, s = S.steelCore({ D: r.D, tw: q.tw, topB: q.topB, topT: q.topT, botB: q.botB, botT: q.botT }), x = o.x != null && isFinite(+o.x) ? +o.x : null;
    let cr = s; if (X.Art > 0) cr = S.addPart(cr, X.Art, s.d + X.hh + X.ts - X.crt, 0); if (X.Arb > 0) cr = S.addPart(cr, X.Arb, s.d + X.hh + X.crb, 0);
    const M1 = +o.MDC1, M2 = +o.MDC2, Mw = +o.MDW, ML = Math.min(+o.MLL, 0), G = X.G, g1 = X.gF(M1, G.dc, G.dcMin, -1), g2 = X.gF(M2, G.dc, G.dcMin, -1), gw = X.gF(Mw, G.dw, G.dwMin, -1);
    const Mu1 = +o.MUT || 0, Mu2 = +o.MUF || 0, gu1 = X.gF(Mu1, G.dw, G.dwMin, -1), gu2 = X.gF(Mu2, G.dc, 0, -1);
    const f = -(g1 * X.fAt(M1, s, 0) + g2 * X.fAt(M2, cr, 0) + gw * X.fAt(Mw, cr, 0) + G.ll * X.fAt(ML, cr, 0) + gu1 * X.fAt(Mu1, s, 0) + gu2 * X.fAt(Mu2, s, 0)), Dc = Math.max(cr.yb - q.botT, 0), RB = rbFactor(Dc, q.tw, q.botB, q.botT, X.Fyb);
    const Rh = S.hybrid({ D: r.D, tw: q.tw, topB: q.topB, topT: q.topT, botB: q.botB, botT: q.botT }, cr, { Fyt: X.Fyt, Fyb: X.Fyb, Fyw: X.Fyw }, 'gov').Rh;
    return { kind: 'S', x, q, M1, M2, Mw, ML, g1, g2, gw, gll: G.ll, Mu1, Mu2, gu1, gu2, Ss: s.I / s.yb, Scr: cr.I / cr.yb, f, Dc, Rb: RB.Rb, Rh };
  }

  /* ---------- checks: value, capacity, ratio, reference ---------- */
  const ck = (o) => ({ ratio: o.demand / o.capacity, ok: o.capacity >= o.demand - 1e-9, inUse: true, ...o });
  function checksOf(r, prj) {
    const out = [], Fyt = prj.mat.Fyt, Fyb = prj.mat.Fyb;
    if (r.pos) {
      if (r.below) {
        out.push({ id: 'GS5', key: 'duct', title: 'Ductility', ref: `${ED} Art. 6.10.7.3`, na: 'The plastic neutral axis falls below the web: outside Table D6.1-1; M_p, D_p, D_cp and compactness are not reported.', inUse: false, ratio: NaN, step: 'pl.pos.yp' });
        out.push({ id: 'GS6', key: 'mn', title: 'Positive flexure resistance', ref: `${ED} Art. 6.10.7.1, 6.10.7.2`, na: 'Out of scope (PNA below the web).', inUse: false, ratio: NaN, step: 'pl.pos.yp' });
      } else {
        out.push(ck({ id: 'GS5', key: 'duct', title: 'Ductility, D_p ≤ 0.42D_t', ref: `${ED} Eq. 6.10.7.3-1`, demand: r.Dp, capacity: 0.42 * r.Dt, unit: 'in', step: 'fx.duct.ok' }));
        if (r.compact) { const dem = Math.abs(r.Mu) + r.fl * r.Sxt / 3 / 12;
          out.push(ck({ id: 'GS6', key: 'mn', title: 'Compact section, M_u + f_ℓS_xt/3 ≤ φ_fM_n', ref: `${ED} Eq. 6.10.7.1.1-2, 6.10.7.1.2`, demand: dem, capacity: r.Mn, unit: 'kip-ft', step: 'fx.mn.ok' })); }
        else { const fc = Math.max(r.cF.f, 0), ft = Math.max(r.tF.f, 0) + r.fl / 3, capT = r.Rh * Fyb;
          out.push(ck({ id: 'GS6', key: 'ncC', title: 'Noncompact, compression flange, f_bu ≤ φ_fF_nc', ref: `${ED} Eq. 6.10.7.2.1-1, 6.10.7.2.2`, demand: fc, capacity: r.FncP, unit: 'ksi', step: 'fx.ncC.ok' }));
          out.push(ck({ id: 'GS6', key: 'ncT', title: 'Noncompact, tension flange, f_bu + f_ℓ/3 ≤ φ_fR_hF_yt', ref: `${ED} Eq. 6.10.7.2.1-2`, demand: ft, capacity: capT, unit: 'ksi', step: 'fx.ncT.ok' })); }
      }
    } else {
      const a = r.A6, lt = r.lt, dem = r.fbuC + r.am.fl / 3;
      out.push(ck({ id: 'GS7', key: 'fnc', title: 'Compression flange, f_bu + f_ℓ/3 ≤ φ_fF_nc', ref: `${ED} Eq. 6.10.8.1.1-1; 6.10.8.2.2, 6.10.8.2.3`, demand: dem, capacity: lt.Fnc, unit: 'ksi', inUse: !r.useA6, step: 'fx.fnc.ok' }));
      const f = Math.max(r.tF.f, 0), cap = r.Rh * Fyt;
      out.push(ck({ id: 'GS8', key: 'fnt', title: 'Tension flange, f_bu ≤ φ_fF_nt', ref: `${ED} Eq. 6.10.8.1.3-1; 6.10.8.3`, demand: f, capacity: cap, unit: 'ksi', inUse: !r.useA6, step: 'fx.fnt.ok' }));
      if (!a.ok) out.push({ id: 'GS9', key: 'a6', title: 'Appendix A6', ref: `${ED} Art. 6.10.6.2.3`, na: 'Appendix A6 is not permitted: ' + a.why.join('; '), inUse: false, ratio: NaN, step: 'fx.a6.ok' });
      else { const Mu = Math.abs(r.Mu), demC = Mu + a.am.fl * a.Sxc / 3 / 12;
        out.push(ck({ id: 'GS9', key: 'a6c', title: 'App. A6, compression flange, M_u + f_ℓS_xc/3 ≤ φ_fM_nc', ref: `${ED} Eq. A6.1.1-1`, demand: demC, capacity: a.Mnc, unit: 'kip-ft', inUse: r.useA6, step: 'fx.a6c.ok' }));
        out.push(ck({ id: 'GS9', key: 'a6t', title: 'App. A6, tension flange, M_u ≤ φ_fR_ptM_yt', ref: `${ED} Eq. A6.1.2-1, A6.4`, demand: Mu, capacity: a.Mnt, unit: 'kip-ft', inUse: r.useA6, step: 'fx.a6t.ok' })); }
    }
    { const fS = r.pos ? r.fl : r.am.fl; if (fS > 0) out.push(ck({ id: 'GS10', key: 'fl', title: 'Flange lateral bending, f_ℓ ≤ 0.6F_yf', ref: `${ED} Eq. 6.10.1.6-1`, demand: fS, capacity: 0.6 * Fyb, unit: 'ksi', step: 'fx.flim.ok' })); }
    [['top', r.svc.top, Fyt, 0], ['bottom', r.svc.bot, Fyb, Math.max(r.fl, 0)]].forEach(([f, v, Fy, fl]) => {
      out.push(ck({ id: 'GS12', key: 'sv' + f[0], title: `Service II, ${f} flange, ${fl > 0 ? 'f_f + f_ℓ/2' : 'f_f'} ≤ 0.95R_hF_yf`, ref: `${ED} Eq. 6.10.4.2.2-${f === 'top' ? 1 : 2}`, demand: Math.abs(v) + fl / 2, capacity: 0.95 * r.Rh * Fy, unit: 'ksi', step: `fx.sv${f[0]}.ok` })); });
    if (!(r.pos && r.D / r.tw <= 150)) { const fcS = Math.max(r.svcC, 0); out.push(ck({ id: 'GS13', key: 'web', title: 'Service II, web bend-buckling, f_c ≤ F_crw', ref: `${ED} Eq. 6.10.4.2.2-4; 6.10.1.9.1`, demand: fcS, capacity: r.webS.F, unit: 'ksi', step: 'fx.web.ok' })); }
    else out.push({ id: 'GS13', key: 'web', title: 'Service II, web bend-buckling', ref: `${ED} Art. 6.10.4.2.2`, na: 'Not required: composite section in positive flexure with D/t_w ≤ 150.', inUse: false, ratio: NaN, step: 'fx.web.na' });
    if (!r.factored) out.push({ id: 'GS19', key: 'rev', title: 'Moment reversal under Strength I', ref: `${ED} Art. 3.4.1, Table 3.4.1-2`, demand: r.Mrev, capacity: r.Mu, ratio: NaN, ok: !r.rev, inUse: false, unit: 'kip-ft',
      na: r.rev ? `The opposite extreme M_u = ${r.Mrev.toFixed(1)} kip-ft changes sign: also check this section in ${r.pos ? 'negative' : 'positive'} flexure.` : 'No reversal.', step: 'fx.rev' });
    return out;
  }

  /* ---------- worked steps ---------- */
  function worked(r, prj) {
    const w = St().work('fx'), G = r.G, pos = r.pos, Fyt = prj.mat.Fyt, Fyb = prj.mat.Fyb, Fyw = prj.mat.Fyw, c = r.card, tbl = `${ED} Tables 3.4.1-1, 3.4.1-2`;
    const sec = pos ? { DC1: 'steel', DC2: '3n', DW: '3n', LL: 'n' } : { DC1: 'steel', DC2: 'steel + rebar', DW: 'steel + rebar', LL: 'steel + rebar' };
    const okv = (dem, cap) => cap >= dem - 1e-9 ? 'OK' : 'NG';
    // load factors and moments
    if (!r.factored) {
      [['DC1', 'dc', 'dcMin', r.MDC1], ['DC2', 'dc', 'dcMin', r.MDC2], ['DW', 'dw', 'dwMin', r.MDW]].forEach(([k, mx, mn, Mm]) =>
        w.add({ id: 'gam.' + k, label: `γ_p for ${k}: maximum where it adds to the ${pos ? 'positive' : 'negative'} moment, minimum where it relieves it`, sym: `\\gamma_{${k}}`, eq: '', sub: `M_{${k}} = ${n2(Mm)}\\text{ kip-ft}`, value: r.gm[k], unit: '', d: 2, ref: tbl }));
      if (r.ut) [['UT', r.MUT], ['UF', r.MUF]].forEach(([k, Mm]) => w.add({ id: 'gam.' + k, label: `γ for ${k === 'UT' ? 'existing utilities (DW factors)' : 'future utility allowance (γ_DC max, 0 min)'}`, sym: `\\gamma_{${k}}`, eq: '', sub: `M_{${k}} = ${n2(Mm)}`, value: r.gm[k], unit: '', d: 2, ref: tbl }));
      w.add({ id: 'Mu', label: 'Strength I factored moment', sym: 'M_{u}', eq: '\\gamma_{DC1}M_{DC1} + \\gamma_{DC2}M_{DC2} + \\gamma_{DW}M_{DW} + 1.75M_{LL+IM}' + (r.ut ? ' + \\gamma_{UT}M_{UT} + \\gamma_{UF}M_{UF}' : ''),
        sub: `${n2(r.gm.DC1)}${pa(r.MDC1)} + ${n2(r.gm.DC2)}${pa(r.MDC2)} + ${n2(r.gm.DW)}${pa(r.MDW)} + ${n2(G.ll)}${pa(r.MLL)}` + (r.ut ? ` + ${n2(r.gm.UT)}${pa(r.MUT)} + ${n2(r.gm.UF)}${pa(r.MUF)}` : ''), value: r.Mu, unit: 'kip-ft', d: 1, ref: `${ED} Eq. 3.4.1-1` });
      w.add({ id: 'Ms', label: 'Service II moment', sym: 'M_{s}', eq: 'M_{DC1} + M_{DC2} + M_{DW} + 1.30M_{LL+IM}', sub: `${pa(r.MDC1)} + ${pa(r.MDC2)} + ${pa(r.MDW)} + ${n2(G.sll)}${pa(r.MLL)}` + (r.ut ? ` + ${pa(r.MUT)} + ${r.svU}${pa(r.MUF)}` : ''), value: r.Ms, unit: 'kip-ft', d: 1, ref: tbl });
    } else {
      w.add({ id: 'Mu', label: 'Strength I factored moment (factored demands as given)', sym: 'M_{u}', eq: '\\sum M_{u,i}', sub: ['DC1', 'DC2', 'DW', 'LL', 'UT', 'UF'].map(k => pa(r.fA[k])).join(' + '), value: r.Mu, unit: 'kip-ft', d: 1, ref: `${ED} Eq. 3.4.1-1` });
      w.add({ id: 'Ms', label: 'Service II moment (factored demands as given)', sym: 'M_{s}', eq: '\\sum M_{s,i}', sub: ['DC1', 'DC2', 'DW', 'LL', 'UT', 'UF'].map(k => pa(r.fB[k])).join(' + '), value: r.Ms, unit: 'kip-ft', d: 1, ref: tbl });
    }
    // stresses by stage
    const sfx = (k, which) => r.stg[k];
    ['top', 'bot'].forEach(f => {
      const parts = ['DC1', 'DC2', 'DW', 'LL'].concat(r.ut ? ['UT', 'UF'] : []), gm = k => r.factored ? 1 : k === 'LL' ? G.ll : r.gm[k];
      w.add({ id: `str.${f}`, label: `Strength I stress, ${f === 'top' ? 'top' : 'bottom'} of steel, each load on its stage section (tension +)`, sym: `f_{${f}}`, eq: '\\sum \\gamma_{i}\\frac{-M_{i}(y - \\bar{y}_{i})}{I_{i}}',
        sub: parts.map(k => `${n2(gm(k))}(${n2(sfx(k)[f])})`).join(' + '), value: r.str[f], unit: 'ksi', d: 2, ref: `${ED} Art. 6.10.1.1.1a, 6.10.1.1.1b, 6.10.1.1.1c`,
        note: `Sections: DC1 ${sec.DC1}, DC2 and DW ${sec.DC2}, LL+IM ${sec.LL}${r.ut ? ', utilities steel' : ''} (y = ${f === 'top' ? n3(r.d) : '0'} in).` }); });
    ['top', 'bot'].forEach(f => w.add({ id: `svc.${f}`, label: `Service II stress, ${f === 'top' ? 'top' : 'bottom'} of steel (tension +)`, sym: `f_{f,${f}}`, eq: r.factored ? '\\sum f_{s,i}' : 'f_{DC1} + f_{DC2} + f_{DW} + 1.30f_{LL+IM}',
      sub: r.factored ? ['DC1', 'DC2', 'DW', 'LL', 'UT', 'UF'].map(k => n2(r.stgS[k][f])).join(' + ') : `${n2(r.stg.DC1[f])} + ${n2(r.stg.DC2[f])} + ${n2(r.stg.DW[f])} + ${n2(G.sll)}(${n2(r.stg.LL[f])})` + (r.ut ? ` + ${n2(r.stg.UT[f])} + ${r.svU}(${n2(r.stg.UF[f])})` : ''),
      value: r.svc[f], unit: 'ksi', d: 2, ref: tbl }));
    // yield moments, D6.2.2 / D6.2.3
    [['T', r.yT, 'top', Fyt], ['B', r.yB, 'bottom', Fyb]].forEach(([k, y, f, Fy]) => w.add({ id: `My${k}`, label: `Yield moment, ${f} flange (M_AD from the remaining stress)`, sym: `M_{y,${f}}`,
      eq: pos ? 'M_{D1} + M_{D2} + M_{AD},\\ M_{AD} = S_{n}(F_{y} - \\frac{M_{D1}}{S_{NC}} - \\frac{M_{D2}}{S_{LT}})' : '|M_{D1}| + |M_{D2}| + M_{AD},\\ M_{AD} = S_{cr}(F_{y} - \\frac{|M_{D1}|}{S_{NC}} - \\frac{|M_{D2}|}{S_{cr}})',
      sub: `${n2(Math.abs(r.MD1))} + ${n2(Math.abs(r.MD2))} + \\frac{${g0(y.S3)}}{12}(${n2(Fy)} - \\frac{${n2(Math.abs(r.MD1))}(12)}{${g0(y.S1)}} - \\frac{${n2(Math.abs(r.MD2))}(12)}{${g0(y.S2)}})`, value: y.My, unit: 'kip-ft', d: 1,
      ref: `${ED} App. ${pos ? 'D6.2.2' : 'D6.2.3'}`, note: `M_AD = ${n2(y.MAD)} kip-ft; M_D1, M_D2 the factored permanent moments on the steel and long-term sections.` }));
    w.add({ id: 'Rh', label: 'Hybrid factor (worked on the section card)', sym: 'R_{h}', eq: '', sub: '', value: r.Rh, unit: '', d: 3, ref: `${ED} Art. 6.10.1.10.1`, note: `See ${pos ? 'rh.cn.Rh' : 'rh.cr.Rh'}.` });
    if (pos) {
      if (!r.below) {
        w.add({ id: 'Dp', label: 'Distance from the top of the deck to the PNA', sym: 'D_{p}', eq: 'D_{t} - y_{p}', sub: `${n3(r.Dt)} - ${n3(r.pl.yp)}`, value: r.Dp, unit: 'in', d: 3, ref: `${ED} Art. 6.10.7.1.2` });
        w.add({ id: 'duct.ok', label: 'Ductility', sym: 'D_{p}', eq: '\\le 0.42D_{t}', sub: `${n3(r.Dp)} \\le 0.42(${n3(r.Dt)}) = ${n3(0.42 * r.Dt)}`, value: okv(r.Dp, 0.42 * r.Dt), unit: '', ref: `${ED} Eq. 6.10.7.3-1`, ok: r.Dp <= 0.42 * r.Dt + 1e-9 });
        w.add({ id: 'cmp', label: 'Compact section: F_y ≤ 70 ksi, D/t_w ≤ 150, 2D_cp/t_w ≤ 3.76√(E/F_yc)', sym: '\\frac{2D_{cp}}{t_{w}}', eq: '\\le 3.76\\sqrt{\\frac{E}{F_{yc}}}', sub: `\\frac{2(${n3(r.Dcp)})}{${n4(r.tw)}} = ${n2(2 * r.Dcp / r.tw)} \\le ${n2(r.cmp.lim)};\\ \\frac{D}{t_{w}} = ${n2(r.D / r.tw)}`,
          value: r.compact ? 'compact' : 'noncompact', unit: '', ref: `${ED} Art. 6.10.6.2.2, Eq. 6.10.6.2.2-1`, note: `F_y ≤ 70: ${r.cmp.Fy ? 'yes' : 'no'}; D/t_w ≤ 150: ${r.cmp.Dtw ? 'yes' : 'no'}; web: ${r.cmp.web ? 'yes' : 'no'}. D_cp: see pl.pos.Dcp.` });
        if (r.compact) {
          w.add({ id: 'My', label: 'Yield moment, the lesser of the two flanges', sym: 'M_{y}', eq: '\\min(M_{y,top}, M_{y,bottom})', sub: `\\min(${n2(r.yT.My)}, ${n2(r.yB.My)})`, value: r.My, unit: 'kip-ft', d: 1, ref: `${ED} App. D6.2.2` });
          w.add({ id: 'Mn0', label: 'Nominal flexural resistance, compact', sym: 'M_{n}', eq: r.Dp <= 0.1 * r.Dt ? 'M_{p}\\ (D_{p} \\le 0.1D_{t})' : 'M_{p}(1.07 - 0.7\\frac{D_{p}}{D_{t}})',
            sub: r.Dp <= 0.1 * r.Dt ? g1(r.pl.Mp) : `${g1(r.pl.Mp)}(1.07 - 0.7\\frac{${n3(r.Dp)}}{${n3(r.Dt)}})`, value: r.Mn0, unit: 'kip-ft', d: 1, ref: `${ED} Eqs. 6.10.7.1.2-1, -2` });
          if (r.cont) w.add({ id: 'cap13', label: 'Continuous span limit', sym: '1.3R_{h}M_{y}', eq: '', sub: `1.3(${n3(r.Rh)})(${n2(r.My)})`, value: r.cap13, unit: 'kip-ft', d: 1, ref: `${ED} Eq. 6.10.7.1.2-3` });
          w.add({ id: 'Sxt', label: 'Elastic section modulus to the tension flange', sym: 'S_{xt}', eq: '\\frac{M_{yt}}{F_{yt}}', sub: `\\frac{${n2(r.yB.My)}(12)}{${n2(Fyb)}}`, value: r.Sxt, unit: 'in^{3}', d: 0, ref: `${ED} Art. 6.10.7.1.1` });
          const dem = Math.abs(r.Mu) + r.fl * r.Sxt / 3 / 12;
          w.add({ id: 'mn.ok', label: 'Strength I, compact positive flexure', sym: 'M_{u} + \\frac{1}{3}f_{\\ell}S_{xt}', eq: '\\le \\phi_{f}M_{n}', sub: `${n2(Math.abs(r.Mu))} + \\frac{1}{3}(${n2(r.fl)})\\frac{${g0(r.Sxt)}}{12} = ${n2(dem)} \\le ${n2(r.Mn)}`, value: okv(dem, r.Mn), unit: '', ref: `${ED} Eq. 6.10.7.1.1-2`, ok: dem <= r.Mn + 1e-9 });
        } else {
          const fc = Math.max(r.cF.f, 0), ft = Math.max(r.tF.f, 0) + r.fl / 3, capT = r.Rh * Fyb;
          w.add({ id: 'Fnc', label: 'Noncompact: compression-flange resistance (R_b = 1.0)', sym: 'F_{nc}', eq: 'R_{b}R_{h}F_{yc}', sub: `1.0(${n3(r.Rh)})(${n2(Fyt)})`, value: r.FncP, unit: 'ksi', d: 2, ref: `${ED} Eq. 6.10.7.2.2-1` });
          w.add({ id: 'ncC.ok', label: 'Strength I, compression flange', sym: 'f_{bu}', eq: '\\le \\phi_{f}F_{nc}', sub: `${n2(fc)} \\le ${n2(r.FncP)}`, value: okv(fc, r.FncP), unit: '', ref: `${ED} Eq. 6.10.7.2.1-1`, ok: fc <= r.FncP + 1e-9 });
          w.add({ id: 'ncT.ok', label: 'Strength I, tension flange', sym: 'f_{bu} + \\frac{1}{3}f_{\\ell}', eq: '\\le \\phi_{f}R_{h}F_{yt}', sub: `${n2(Math.max(r.tF.f, 0))} + \\frac{${n2(r.fl)}}{3} = ${n2(ft)} \\le ${n3(r.Rh)}(${n2(Fyb)})`, value: okv(ft, capT), unit: '', ref: `${ED} Eq. 6.10.7.2.1-2, 6.10.7.2.2-2`, ok: ft <= capT + 1e-9 });
        }
      }
    } else {
      const lt = r.lt, rb = r.rb, np = lt.npr;
      w.add({ id: 'Dc', label: 'Depth of the web in compression (steel + rebar section)', sym: 'D_{c}', eq: '\\bar{y}_{cr} - t_{b}', sub: `${n3(r.card.cr.yb)} - ${n4(r.botT)}`, value: r.Dc, unit: 'in', d: 3, ref: `${ED} App. D6.3.1` });
      w.add({ id: 'Rb', label: 'Web load-shedding factor', sym: 'R_{b}', eq: rb.lw <= rb.lrw ? '1.0\\ (\\frac{2D_{c}}{t_{w}} \\le \\lambda_{rw})' : '1 - \\frac{a_{wc}}{1200 + 300a_{wc}}(\\frac{2D_{c}}{t_{w}} - \\lambda_{rw})',
        sub: `\\frac{2D_{c}}{t_{w}} = ${n2(rb.lw)},\\ \\lambda_{rw} = 5.7\\sqrt{\\frac{E}{F_{yc}}} = ${n2(rb.lrw)},\\ a_{wc} = ${n3(rb.awc)}`, value: r.Rb, unit: '', d: 3, ref: `${ED} Eq. 6.10.1.10.2-3`,
        note: 'λ_rw = 5.7√(E/F_yc) as GirderDetail (open question: the 10th Ed. λ_rw of 6.10.1.10.2 / 6.10.6.2.3 uses c_rw).' });
      w.add({ id: 'Fyr', label: 'Compression-flange stress at the onset of nominal yielding', sym: 'F_{yr}', eq: '\\min(0.7F_{yc}, F_{yw}) \\ge 0.5F_{yc}', sub: `\\min(0.7(${n2(Fyb)}), ${n2(Fyw)})`, value: lt.Fyr, unit: 'ksi', d: 2, ref: `${ED} Art. 6.10.8.2.2` });
      w.add({ id: 'FLB', label: 'Flange local buckling resistance', sym: 'F_{nc,FLB}', eq: lt.lf <= lt.lpf ? 'R_{b}R_{h}F_{yc}\\ (\\lambda_{f} \\le \\lambda_{pf})' : '[1 - (1 - \\frac{F_{yr}}{R_{h}F_{yc}})\\frac{\\lambda_{f} - \\lambda_{pf}}{\\lambda_{rf} - \\lambda_{pf}}]R_{b}R_{h}F_{yc}',
        sub: `\\lambda_{f} = \\frac{${n2(r.botB)}}{2(${n4(r.botT)})} = ${n2(lt.lf)},\\ \\lambda_{pf} = ${n2(lt.lpf)},\\ \\lambda_{rf} = ${n2(lt.lrf)};\\ R_{b}R_{h}F_{yc} = ${n3(r.Rb)}(${n3(r.Rh)})(${n2(Fyb)})`, value: lt.FLB, unit: 'ksi', d: 2, ref: `${ED} Eqs. 6.10.8.2.2-1 to -5` });
      if (r.cbParts) w.add({ id: 'Cb', label: 'Moment gradient modifier from the Strength I envelope over the unbraced segment', sym: 'C_{b}', eq: '\\frac{12.5M_{max}}{2.5M_{max} + 3M_{A} + 4M_{B} + 3M_{C}}',
        sub: `\\frac{12.5(${n2(r.cbParts.Mx)})}{2.5(${n2(r.cbParts.Mx)}) + 3(${n2(r.cbParts.MA)}) + 4(${n2(r.cbParts.MB)}) + 3(${n2(r.cbParts.MC)})}`, value: r.Cb, unit: '', d: 3, ref: `${ED} Eq. 6.10.8.2.3b-1`, note: r.seg ? `Unbraced segment ${n2(r.seg.xa)} to ${n2(r.seg.xb)} ft; C_b as stored in the row (3 decimals).` : '' });
      else w.add({ id: 'Cb', label: 'Moment gradient modifier (input)', sym: 'C_{b}', eq: '', sub: '', value: r.CbU, unit: '', d: 3, ref: `${ED} Art. 6.10.8.2.3${np && np.kind === 'ge' ? 'c, Eq. 6.10.8.2.3c-1' : 'b'}` });
      if (np && np.kind === 'ge') {
        w.add({ id: 'npr.ge', label: 'Nonprismatic unbraced length: γ_e', sym: '\\gamma_{e}', eq: np.A ? '\\frac{\\chi C_{be}}{(M_{u}/M_{e1})_{max}}\\ (App.\\ D6.6.2\\ Method\\ A)' : '\\frac{F_{e,s}}{Kf_{s}}\\ (conservative\\ bound)',
          sub: np.A ? `${n4(+np.A.ge)}` : `\\frac{${n2(np.FeS)}}{${n3(np.K)}(${n2(np.fS)})}`, value: np.ge != null ? np.ge : 'n/a', unit: '', d: 4, ref: `${ED} Art. 6.10.8.2.3c; App. D6.6.2`, note: `Governing compression flange ${n3(np.b)} × ${n3(np.t)} in; r_t,s = ${n3(np.rtS)} in.${np.gv ? ` f_bu,gov = ${n2(np.gv.f)} ksi at ${np.gv.x != null ? n2(np.gv.x) + ' ft' : 'the governing section'} (R_b ${n3(np.gv.Rb)}, R_h ${n3(np.gv.Rh)}).` : ''}` });
        w.add({ id: 'npr.Fe', label: 'Elastic LTB stress and equivalent r_t', sym: 'F_{e}', eq: '\\gamma_{e}f_{bu},\\ r_{t} = \\frac{L_{b}}{\\pi}\\sqrt{\\frac{F_{e}}{E}}', sub: `${np.ge != null ? n4(np.ge) : 'n/a'}(${n2(np.fbu)})`, value: np.Fe, unit: 'ksi', d: 2, ref: `${ED} Eqs. 6.10.8.2.3c-2, -3`, note: `r_t = ${n3(np.rtE)} in.` });
      } else if (np && np.kind === 'simp') w.add({ id: 'npr.simp', label: 'Nonprismatic unbraced length, simplification of 6.10.8.2.3c: prismatic with the larger section\'s compression flange', sym: 'b_{fc} \\times t_{fc}', eq: '', sub: `${n3(np.b)} \\times ${n3(np.t)}`, value: '', unit: 'in', ref: `${ED} Art. 6.10.8.2.3c` });
      w.add({ id: 'rt', label: 'Effective radius of gyration for LTB', sym: 'r_{t}', eq: np && np.kind === 'ge' ? '\\frac{L_{b}}{\\pi}\\sqrt{\\frac{F_{e}}{E}}' : '\\frac{b_{fc}}{\\sqrt{12(1 + \\frac{D_{c}t_{w}}{3b_{fc}t_{fc}})}}',
        sub: np && np.kind === 'ge' ? `\\frac{${n2(r.Lb * 12)}}{\\pi}\\sqrt{\\frac{${n2(np.Fe)}}{29{,}000}}` : `\\frac{${n2(np ? np.b : r.botB)}}{\\sqrt{12(1 + \\frac{${n3(r.Dc)}(${n4(r.tw)})}{3(${n2(np ? np.b : r.botB)})(${n4(np ? np.t : r.botT)})})}}`, value: lt.rt, unit: 'in', d: 3, ref: `${ED} Eq. 6.10.8.2.3${np && np.kind === 'ge' ? 'c-3' : 'b-3'}` });
      w.add({ id: 'Lp', label: 'Limiting unbraced length, L_p', sym: 'L_{p}', eq: '1.1r_{t}\\sqrt{\\frac{E}{F_{yc}}}', sub: `1.1(${n3(lt.rt)})\\sqrt{\\frac{29{,}000}{${n2(Fyb)}}}`, value: lt.Lp, unit: 'in', d: 2, ref: `${ED} Eq. 6.10.8.2.3a-4` });
      w.add({ id: 'Lr', label: 'Limiting unbraced length, L_r', sym: 'L_{r}', eq: '\\pi r_{t}\\sqrt{\\frac{E}{F_{yr}}}', sub: `\\pi(${n3(lt.rt)})\\sqrt{\\frac{29{,}000}{${n2(lt.Fyr)}}}`, value: lt.Lr, unit: 'in', d: 2, ref: `${ED} Eq. 6.10.8.2.3a-5` });
      const Lbi = r.Lb * 12, cap = r.Rb * r.Rh * Fyb, ltbCap = lt.ltbCap != null ? lt.ltbCap : cap;
      w.add({ id: 'LTB', label: 'Lateral-torsional buckling resistance', sym: 'F_{nc,LTB}', eq: Lbi <= lt.Lp ? 'R_{b}R_{h}F_{yc}\\ (L_{b} \\le L_{p})' : Lbi <= lt.Lr ? 'C_{b}[1 - (1 - \\frac{F_{yr}}{R_{h}F_{yc}})\\frac{L_{b} - L_{p}}{L_{r} - L_{p}}]R_{b}R_{h}F_{yc} \\le R_{b}R_{h}F_{yc}' : 'F_{cr} = \\frac{C_{b}R_{b}\\pi^{2}E}{(L_{b}/r_{t})^{2}} \\le R_{b}R_{h}F_{yc}',
        sub: `L_{b} = ${n2(Lbi)}\\text{ in},\\ C_{b} = ${n3(r.CbU)};\\ R_{b}R_{h}F_{yc} = ${n2(ltbCap)}` + (Lbi > lt.Lr ? `;\\ F_{cr} = ${n2(lt.Fcr)}` : ''), value: lt.LTB, unit: 'ksi', d: 2, ref: `${ED} Eqs. 6.10.8.2.3a-1 to -3, -8` });
      w.add({ id: 'Fnc', label: 'Nominal compression-flange flexural resistance', sym: 'F_{nc}', eq: '\\min(F_{nc,FLB}, F_{nc,LTB})', sub: `\\min(${n2(lt.FLB)}, ${n2(lt.LTB)})`, value: lt.Fnc, unit: 'ksi', d: 2, ref: `${ED} Art. 6.10.8.1.1` });
      w.add({ id: 'fbu', label: 'Strength I compression-flange stress (bottom flange)', sym: 'f_{bu}', eq: '-f_{bot} \\ge 0', sub: `-(${n2(r.str.bot)})`, value: r.fbuC, unit: 'ksi', d: 2, ref: `${ED} Art. 6.10.1.6` });
      w.add({ id: 'fl', label: 'Lateral bending stress, amplified where required', sym: 'f_{\\ell}', eq: r.am.req ? '\\frac{0.85}{1 - f_{bu}/F_{cr}}f_{\\ell1} \\ge f_{\\ell1}' : 'f_{\\ell1}\\ (L_{b} \\le 1.2L_{p}\\sqrt{C_{b}R_{b}/(f_{bu}/F_{yc})})',
        sub: r.am.req ? `${isFinite(r.am.AF) ? n3(r.am.AF) : '\\infty'}(${n2(r.fl)})` : `${n2(r.fl)};\\ ${n2(Lbi)} \\le ${n2(r.am.lim)}`, value: r.am.fl, unit: 'ksi', d: 2, ref: `${ED} Eqs. 6.10.1.6-4, -5` });
      const dem = r.fbuC + r.am.fl / 3;
      w.add({ id: 'fnc.ok', label: `Strength I, compression flange (6.10.8)${r.useA6 ? ' — not the method in use (Appendix A6 governs)' : ''}`, sym: 'f_{bu} + \\frac{1}{3}f_{\\ell}', eq: '\\le \\phi_{f}F_{nc}', sub: `${n2(r.fbuC)} + \\frac{${n2(r.am.fl)}}{3} = ${n2(dem)} \\le ${n2(lt.Fnc)}`, value: okv(dem, lt.Fnc), unit: '', ref: `${ED} Eq. 6.10.8.1.1-1`, ok: dem <= lt.Fnc + 1e-9 });
      const f = Math.max(r.tF.f, 0), capT = r.Rh * Fyt;
      w.add({ id: 'fnt.ok', label: 'Strength I, tension flange (6.10.8)', sym: 'f_{bu}', eq: '\\le \\phi_{f}R_{h}F_{yt}', sub: `${n2(f)} \\le ${n3(r.Rh)}(${n2(Fyt)}) = ${n2(capT)}`, value: okv(f, capT), unit: '', ref: `${ED} Eq. 6.10.8.1.3-1, 6.10.8.3-1`, ok: f <= capT + 1e-9 });
      // Appendix A6
      const a = r.A6, C = a.cond;
      w.add({ id: 'a6.crw', label: 'Web slenderness limit for App. A6 (c_rw from a_wc)', sym: '\\lambda_{rw}', eq: 'c_{rw}\\sqrt{\\frac{E}{F_{yc}}},\\ c_{rw} = 3.1 + \\frac{5.0}{a_{wc}}\\ (4.6 \\le c_{rw} \\le 5.7),\\ a_{wc} = \\frac{2D_{c}t_{w}}{b_{fc}t_{fc}}',
        sub: `a_{wc} = ${n3(a.awcP)},\\ c_{rw} = ${n3(a.crwP)}`, value: a.lrwP, unit: '', d: 2, ref: `${ED} Eqs. 6.10.6.2.3-1, -3 to -5` });
      w.add({ id: 'a6.ok', label: 'App. A6 permitted (6.10.6.2.3)', sym: '', eq: '', sub: `\\text{skew } ${n2(a.skM)}° \\le 20°: ${C.skew ? 'yes' : 'no'};\\ \\text{straight}: ${C.straight ? 'yes' : 'no'};\\ F_{y} \\le 70: ${C.FyF && C.FyW ? 'yes' : 'no'};\\ \\frac{2D_{c}}{t_{w}} = ${n2(a.lw)} \\lt \\lambda_{rw} = ${n2(a.lrwP)}: ${C.web ? 'yes' : 'no'};\\ \\frac{I_{yc}}{I_{yt}} = ${n3(a.Iyc / a.Iyt)} \\ge 0.3: ${C.Iy ? 'yes' : 'no'};\\ \\text{prismatic } L_{b}: ${C.prism ? 'yes' : 'no'}`,
        value: a.ok ? (r.useA6 ? 'permitted, used' : 'permitted, 6.10.8 selected') : 'not permitted', unit: '', ref: `${ED} Art. 6.10.6.2.3, Eq. 6.10.6.2.3-2`, ok: a.ok,
        note: (a.ok ? '' : a.why.join('; ') + '. ') + 'Not testable here, for the engineer: no holes in the tension flange, cross-frames in contiguous lines parallel to the supports, girders not kinked.' });
      if (a.ok) {
        w.add({ id: 'a6.Rpc', label: `Web plastification factors (${a.webCompact ? 'compact' : 'noncompact'} web; λ_pw(Dcp) = ${n2(a.lpDcp)})`, sym: 'R_{pc}', eq: a.webCompact ? '\\frac{M_{p}}{M_{yc}}' : '[1 - (1 - \\frac{R_{h}M_{yc}}{M_{p}})\\frac{\\lambda_{w} - \\lambda_{pw(D_{c})}}{\\lambda_{rw} - \\lambda_{pw(D_{c})}}]\\frac{M_{p}}{M_{yc}}',
          sub: `M_{p} = ${g1(r.pl.Mp)},\\ M_{yc} = ${g1(a.Myc)},\\ M_{yt} = ${g1(a.Myt)}`, value: a.Rpc, unit: '', d: 3, ref: `${ED} Eqs. A6.2.1-4, A6.2.2-4, -5`, note: `R_pt = ${n3(a.Rpt)}; λ_rw of A6.2.2 = 5.7√(E/F_yc) = ${n2(a.lrw)} (as GirderDetail).` });
        w.add({ id: 'a6.Mnc', label: 'App. A6 compression-flange resistance', sym: 'M_{nc}', eq: '\\min(M_{nc,FLB}, M_{nc,LTB})', sub: `\\min(${g1(a.MncF)}, ${g1(a.MncL)});\\ L_{p} = ${n2(a.Lp)},\\ L_{r} = ${n2(a.Lr)}\\text{ in},\\ J = ${n2(a.J)},\\ F_{yr} = ${n2(a.FyrA)}`, value: a.Mnc, unit: 'kip-ft', d: 1, ref: `${ED} Eqs. A6.3.2-1, -2; A6.3.3-1 to -9` });
        const Mu = Math.abs(r.Mu), demC = Mu + a.am.fl * a.Sxc / 3 / 12;
        w.add({ id: 'a6c.ok', label: 'App. A6, compression flange', sym: 'M_{u} + \\frac{1}{3}f_{\\ell}S_{xc}', eq: '\\le \\phi_{f}M_{nc}', sub: `${n2(Mu)} + \\frac{1}{3}(${n2(a.am.fl)})\\frac{${g0(a.Sxc)}}{12} = ${n2(demC)} \\le ${n2(a.Mnc)}`, value: okv(demC, a.Mnc), unit: '', ref: `${ED} Eq. A6.1.1-1`, ok: demC <= a.Mnc + 1e-9 });
        w.add({ id: 'a6t.ok', label: 'App. A6, tension flange', sym: 'M_{u}', eq: '\\le \\phi_{f}R_{pt}M_{yt}', sub: `${n2(Mu)} \\le ${n3(a.Rpt)}(${n2(a.Myt)}) = ${n2(a.Mnt)}`, value: okv(Mu, a.Mnt), unit: '', ref: `${ED} Eq. A6.1.2-1`, ok: Mu <= a.Mnt + 1e-9 });
      }
    }
    { const fS = pos ? r.fl : r.am.fl; if (fS > 0) w.add({ id: 'flim.ok', label: 'Flange lateral bending limit', sym: 'f_{\\ell}', eq: '\\le 0.6F_{yf}', sub: `${n2(fS)} \\le 0.6(${n2(Fyb)})`, value: okv(fS, 0.6 * Fyb), unit: '', ref: `${ED} Eq. 6.10.1.6-1`, ok: fS <= 0.6 * Fyb + 1e-9 }); }
    // Service II
    [['t', 'top', r.svc.top, Fyt, 0], ['b', 'bottom', r.svc.bot, Fyb, Math.max(r.fl, 0)]].forEach(([k, f, v, Fy, fl]) => { const a = Math.abs(v) + fl / 2, cap = 0.95 * r.Rh * Fy;
      w.add({ id: `sv${k}.ok`, label: `Service II permanent deformations, ${f} flange`, sym: fl > 0 ? '|f_{f}| + \\frac{f_{\\ell}}{2}' : '|f_{f}|', eq: '\\le 0.95R_{h}F_{yf}', sub: `${fl > 0 ? `${n2(Math.abs(v))} + \\frac{${n2(fl)}}{2} = ${n2(a)}` : n2(a)} \\le 0.95(${n3(r.Rh)})(${n2(Fy)}) = ${n2(cap)}`, value: okv(a, cap), unit: '', ref: `${ED} Eq. 6.10.4.2.2-${k === 't' ? 1 : 2}`, ok: a <= cap + 1e-9 }); });
    { const fcS = Math.max(r.svcC, 0);
      w.add({ id: 'DcS', label: `Depth of the web in compression from the Service II stresses${pos ? ' (composite, positive flexure)' : ''}`, sym: 'D_{c}', eq: '\\frac{f_{c}}{f_{c} + |f_{t}|}d - t_{fc} \\ge 0', sub: `\\frac{${n2(fcS)}}{${n2(fcS)} + ${n2(Math.abs(r.svcT))}}(${n3(r.d)}) - ${n4(pos ? r.topT : r.botT)}`, value: r.DcS, unit: 'in', d: 3, ref: `${ED} App. D6.3.1, Eq. D6.3.1-1` });
      if (!(pos && r.D / r.tw <= 150)) {
        w.add({ id: 'Fcrw', label: 'Nominal web bend-buckling resistance', sym: 'F_{crw}', eq: '\\frac{0.9Ek}{(D/t_{w})^{2}} \\le \\min(R_{h}F_{yc}, \\frac{F_{yw}}{0.7}),\\ k = ' + (r.webS.both ? '7.2' : '\\frac{9}{(D_{c}/D)^{2}}'), sub: `k = ${n2(r.webS.k)};\\ \\frac{0.9(29{,}000)(${n2(r.webS.k)})}{(${n2(r.D / r.tw)})^{2}} = ${n2(r.webS.Fe)}`, value: r.webS.F, unit: 'ksi', d: 2, ref: `${ED} Eqs. 6.10.1.9.1-1, -2` });
        w.add({ id: 'web.ok', label: 'Service II web bend-buckling', sym: 'f_{c}', eq: '\\le F_{crw}', sub: `${n2(fcS)} \\le ${n2(r.webS.F)}`, value: okv(fcS, r.webS.F), unit: '', ref: `${ED} Eq. 6.10.4.2.2-4`, ok: fcS <= r.webS.F + 1e-9 });
      } else w.add({ id: 'web.na', label: 'Web bend-buckling at Service II not required (composite, positive flexure, D/t_w ≤ 150)', sym: '\\frac{D}{t_{w}}', eq: '', sub: '', value: r.D / r.tw, unit: '', d: 2, ref: `${ED} Art. 6.10.4.2.2` }); }
    // Fatigue I stress ranges
    [['T', 'top', r.d, r.dfT], ['B', 'bottom', 0, r.dfB]].forEach(([k, f, y, v]) => w.add({ id: `fat${k}`, label: `Fatigue I stress range, ${f} of steel (positive on n, negative on ${r.minR ? 'n: 6.6.1.2.1 rebar ≥ 1%' : 'steel + rebar'})`, sym: `(\\Delta f)_{${f}}`, eq: '\\gamma(|f(M_{fat}^{+})| + |f(M_{fat}^{-})|)',
      sub: `${n2(r.gfat)}(|f(${n2(r.MfP)})| + |f(${n2(r.MfN)})|)`, value: v, unit: 'ksi', d: 2, ref: `${ED} Table 3.4.1-1, Art. 6.6.1.2.1, 6.10.1.1.1c`, note: 'Resistance (ΔF)_n: the fatigue module.' }));
    if (!r.factored) w.add({ id: 'rev', label: 'Strength I opposite extreme (moment reversal)', sym: 'M_{u,opp}', eq: '\\gamma_{p}M_{DC1} + \\gamma_{p}M_{DC2} + \\gamma_{p}M_{DW} + 1.75M_{LL,opp}', sub: `${n2(r.gmO.DC1)}${pa(r.MDC1)} + ${n2(r.gmO.DC2)}${pa(r.MDC2)} + ${n2(r.gmO.DW)}${pa(r.MDW)} + ${n2(G.ll)}${pa(r.MLLo)}`,
      value: r.Mrev, unit: 'kip-ft', d: 1, ref: tbl, note: r.rev ? `Reverses: also check this section in ${pos ? 'negative' : 'positive'} flexure.` : 'Same sign as M_u: no reversal.', ok: !r.rev });
    return [].concat(w.steps, c.steps);
  }

  /* ---------- a girder: every location ---------- */
  /* girder(locs, prj, opt): every location; PNA-OOS (GirderDetail 2026-10-14): where a positive-flexure location has its PNA
     below the web, every positive-flexure location of the same span is out of scope too (opt.supports [ft]; without them,
     or a location without x, the whole girder). Returns { rows, oos, gov }. */
  function girder(locs, prj, opt) {
    const cache = new Map(), rows = locs.map(L => location(L, prj, cache)), sup = opt && opt.supports;
    const spOf = x => { if (!sup || x == null || !isFinite(+x)) return null; const k = sup.slice(0, -1).findIndex((v, i) => +x <= sup[i + 1] + 1e-6); return k < 0 ? sup.length - 2 : k; };
    const bad = rows.filter(r => r.pos && r.below);
    if (bad.length) { const ks = new Set(bad.map(r => spOf(r.x))), all = ks.has(null);
      rows.forEach(r => { if (r.pos && (r.below || all || spOf(r.x) == null || ks.has(spOf(r.x)))) { r.oos = true;
        r.checks.forEach(c => { if (c.id === 'GS5' || c.id === 'GS6') { c.inUse = false; c.ratio = NaN; c.na = 'Out of scope: a positive-flexure location of this span has its PNA below the web (Table D6.1-1).'; } });
        const inUse = r.checks.filter(c => c.inUse && isFinite(c.ratio)); r.gov = inUse.reduce((b, c) => (!b || c.ratio > b.ratio ? c : b), null); } }); }
    const gov = rows.reduce((b, r) => (r.gov && (!b || r.gov.ratio > b.gov.ratio) ? r : b), null);
    return { rows, oos: bad.length > 0, gov };
  }

  /* ---------- demands from a hand-off payload (schema stgirder-external-demands, as ST-Girder read it) ---------- */
  /* fromPayload(pl, opt): the stations GirderDetail's "Check at any location" checks on this girder (every analysis station; both
     sides, ±0.01 ft, of each plate change and interior support; 0.01 ft inside the ends), each with its unfactored moments
     (linear between the payload stations), plates, region (Strength I max ≥ |min| at the nearest station: positive) and, from
     bracing(), L_b, C_b and the nonprismatic data with brace points every ≤ L_b in each span (the payload has the cross-frame
     spacing, not the stations). opt: { G, Lb (ft), braces, fl, rebar (two layers, instead of the payload's A_r at mid-depth), xs (stations to check; default every payload station), impl }. n = E_s/E_c exact from f′c, w_c,
     K_1 = 1 (the payload's n is the same, rounded); the deck rebar A_r is one layer at slab mid-depth (as the payload states it). Returns { prj, locs, env, supports, braces }. */
  function fromPayload(pl, opt) {
    opt = opt || {};
    const g = pl.girderDetail || {}, m = g.materials || {}, dk = g.deck || {}, S = pl.stations || [], zones = (pl.section || {}).zones || [], sup = (pl.member || {}).supports || [];
    const G = factors(opt.G), Lend = sup[sup.length - 1];
    const xs = S.map(s => s.x), arr = k => S.map(s => +s[k] || 0);
    const env = { xs, MDC1: arr('M_DC1'), MDC2: arr('M_DC2'), MDW: arr('M_DW'), Mp: S.map(s => (+s.M_LLpos || 0) + (+s.M_PLpos || 0)), Mn: S.map(s => (+s.M_LLneg || 0) + (+s.M_PLneg || 0)),
      MUT: arr('M_UT'), MUF: arr('M_UF'), MfP: arr('M_FATpos'), MfN: arr('M_FATneg') };
    env.Mup = xs.map((_, i) => envelopeStrI({ DC1: env.MDC1[i], DC2: env.MDC2[i], DW: env.MDW[i], LLp: env.Mp[i], LLn: env.Mn[i], UT: env.MUT[i], UF: env.MUF[i] }, G).max);
    env.Mun = xs.map((_, i) => envelopeStrI({ DC1: env.MDC1[i], DC2: env.MDC2[i], DW: env.MDW[i], LLp: env.Mp[i], LLn: env.Mn[i], UT: env.MUT[i], UF: env.MUF[i] }, G).min);
    const zAt = x => { const z = zones.find(q => x >= q.startX - 1e-9 && x < q.endX) || zones[zones.length - 1]; return { D: z.web.depth, tw: z.web.thickness, topB: z.topFlange.width, topT: z.topFlange.thickness, botB: z.botFlange.width, botT: z.botFlange.thickness }; };
    const chg = zones.slice(0, -1).map(z => z.endX).filter((x, i) => { const a = zAt(x - 0.01), b = zAt(x + 0.01); return ['D', 'tw', 'topB', 'topT', 'botB', 'botT'].some(k => a[k] !== b[k]); });
    const list = [], add = x => { if (!list.some(o => Math.abs(o - x) < 0.005)) list.push(x); };
    const stations = x => { const c = chg.find(q => Math.abs(q - x) < 0.011); if (c != null && c > 0.02 && c < Lend - 0.02) return [c - 0.01, c + 0.01];
      const sp = sup.find(v => Math.abs(v - x) < 0.011); if (sp != null) return [sp < 0.02 ? 0.01 : sp > Lend - 0.02 ? Lend - 0.01 : sp - 0.01]; return [Math.min(Math.max(x, 0.01), Lend - 0.01)]; };
    (opt.xs || xs).forEach(x => stations(x).forEach(add)); sup.slice(1, -1).forEach(v => add(v + 0.01)); list.sort((a, b) => a - b);
    const Lb = opt.Lb != null ? opt.Lb : (g.bracing && g.bracing.Lb) || 25;
    const braces = opt.braces || (() => { const b = []; sup.slice(0, -1).forEach((x0, k) => { const x1 = sup[k + 1], n = Math.max(1, Math.ceil((x1 - x0) / Lb - 1e-9)); for (let j = 0; j < n; j++) b.push(x0 + (x1 - x0) * j / n); }); b.push(Lend); return b; })();
    const top = (dk.Ar || 0), deck = { ts: dk.ts, tdeck: dk.ts + 0.5, haunch: dk.haunch, rebar: opt.rebar || { top: { A: top, c: dk.ts / 2 }, bot: { A: 0, c: dk.ts / 2 } } };
    const Fy = { Fyt: +m.Fyf || 50, Fyb: +m.Fyf || 50, Fyw: +m.Fyw || 50, Fyr: 60, fc: +m.fc };
    const prj = { deck, mat: Fy, n: SEC().modularRatio(+m.fc, +m.wc || 0.15, 1, 'exact').n, wc: +m.wc || 0.15, rebarInPositive: false, G, a6: { method: 'auto', skews: ((g.skew || {}).bySupport || []).slice(), curved: false } };
    const cont = sup.length > 2;
    const locs = list.map((x, k) => {
      let i = 0; xs.forEach((v, q) => { if (Math.abs(v - x) < Math.abs(xs[i] - x)) i = q; });
      let region = env.Mup[i] >= -env.Mun[i] ? 'pos' : 'neg';
      if (region === 'neg' && Math.max(Math.abs(env.Mup[i]), Math.abs(env.Mun[i])) < 1e-3) region = 'pos';
      const at = A => feAt(xs, A, x);
      const br = bracing(x, env, { braces, L: Lend, region, secAt: zAt, D: zAt(x).D, haunch: dk.haunch, Ar: top, yr: dk.ts / 2, FyF: Fy.Fyb, G, impl: opt.impl });
      const npr = br.npr ? { kind: br.npr, b: br.lbB, t: br.lbT, K: br.lbK, geA: br.geA || null, gov: br.nprG || null, Ir: br.lbIr, why: br.nprWhy } : null;
      return { name: `x = ${x.toFixed(2)} ft`, x, region, cont, plates: zAt(x), beff: dk.beff, Lb: br.Lb, Cb: br.Cb, fl: opt.fl || 0, npr, seg: br.seg, cbParts: br.cbParts,
        M: { DC1: at(env.MDC1), DC2: at(env.MDC2), DW: at(env.MDW), LLp: Math.max(0, at(env.Mp)), LLn: Math.min(0, at(env.Mn)), UT: at(env.MUT), UF: at(env.MUF), FATp: at(env.MfP), FATn: at(env.MfN) } };
    });
    return { prj, locs, env, supports: sup, braces, Lb };
  }

  window.SBDFlexure = { ES, factors, envelopeStrI, feAt, feCb, feNpr, feGe, feGeA, feGov, bracing, rbFactor, ltbFnc, ampFl, fcrw, gsGov, location, girder, fromPayload };
})();
