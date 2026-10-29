/* apps/steel-bridge/engine/splices.js — bolted field splices of a steel I-girder, AASHTO LRFD 10th Ed. Art. 6.13.6.1 (window.SBDSplices).
   Classic script, no DOM. Needs window.SharedSteps (loaded first); window.SBDSections (hybrid) and window.SBDOwners (owner rules,
   load factors) when the page has them; window.SBDStiffeners (the panel at a splice) for fromAnalysis().

   Ported 2026-10-29 from GirderDetail's Field splice module ("Steel Bridge Design.html", MODS.splice: 'bolted field splice design,
   AASHTO LRFD 10th Ed. 6.13.6.1.3'), arithmetic copied operation for operation:
     - gdCompute (anchor `function gdCompute(P) {`): the smaller section (6.13.6.1.1), the section properties (steel, 3n, n, steel +
       reinforcement), the stresses of each load at mid-thickness of the flanges, the Strength I (max positive / negative), Service II
       (max positive / negative) and deck placement combinations with the owner load rules (gdOwnM(OWN_K.splice)), the utilities (GD54b)
       and the pedestrian part of LL+IM (GD45); the web shear resistance of the smaller web (6.10.9); the 8th Edition flange design forces
       (controlling / noncontrolling flange, F_cf, R_cf, F_ncf, V_uw, M_uw, H_uw: 6.13.6.1.4); the 10th Edition flange design yield
       resistance P_fy = F_yf A_e (6.13.6.1.3b), the moment resistance of the flange couple M_r (positive: bottom flange to mid-deck;
       negative: between the flange centroids, with the deck reinforcement P_rs where included; deck casting: noncomposite) and the excess
       H_w = (M_u − M_r)/A_w to the web (C6.13.6.1.3b), the Service II / deck casting slip moment and H_s; bolt shear (6.13.2.7, 0.83 for a
       joint longer than 38 in), the filler reduction R (6.13.6.1.5), bearing and tearout per row (6.13.2.9), slip (6.13.2.8, K_h, K_s,
       N_s, P_t), block shear (6.13.4) of the flanges and splice plates, the splice plate resistances (6.13.5.2, 6.8.2: A_n ≤ 0.85A_g), the
       web bolt group (elastic vector method, eccentricity), web plate shear (6.13.5.3) and the optional fatigue ranges (6.6.1.2);
     - gdChecks (anchor `function gdChecks(R) {`): TF1–TF6, BF1–BF6, MT1, WS1–WS5, DT1–DT11 (spacing and edge limits 6.13.2.6, plate
       thickness 6.7.3, plate area, stitch bolts, owner gage lines, wrench clearance), with spCtNarrow (GD62, CTDOT note);
     - autoDesignSplice and fitSplice (anchors `function autoDesignSplice() {`, `function fitSplice() {`): the most economical splice
       that passes every strength and detailing check (fewest bolts, then least plate steel), GirderDetail's search unchanged;
     - spliceExport (Preliminary sizing, anchor `function spliceExport(P, m, AN) {`): the section on each side (0.01 ft left and right
       of the splice) and the demands at the splice: moments at the analysis node nearest the splice, shears the largest magnitude in
       the element containing the splice and its two neighbours (demandsAt).
   GirderDetail's TeX `work` lines are replaced by worked steps (SharedSteps), every item linked to its step (CLAUDE.md §6).
   tests/engine/splices.test.mjs compares every value, check item, ratio and status, and the auto-design, with GirderDetail's own
   functions in Node.

   Inputs (one splice; GirderDetail's module inputs, the same field names; plate dimensions in inches, numbers or '1 1/8' text):
     p = { sec: { D, gF, gW, gP (grades of flanges, web, splice plates), L: { tw, topB, topT, botB, botT }, R: { … } (left / right of
                  the splice), Rh, aT, aB (α, 8th Ed.), ts, hh (haunch), beff, Ar, dr (deck reinforcement area and its depth below the
                  top of the slab), web: 'unstiffened' | 'stiffened', do (in), fc, wc, K1, nRule, code: '10' | '8', Fyr, prs: 'yes' | 'no'
                  (include P_rs = F_yr A_r in the negative couple), same: { top, web, bot } (the right side mirrors the left) },
           dem: { MDC1, MDC2, MDW, MLLp, MLLn, MCL (kip-ft, signed), VDC1, VDC2, VDW, VLL, VCL (kip, magnitudes), dMp, dMn (fatigue
                  moment ranges, kip-ft), pl: { MLLp|MLLn|VLL: [pedestrian part, the value it belongs to] }, ut: { MUT, MUF, VUT, VUF } },
           gam: { dcMax, dcMin, dwMax, dwMin, llS, llSv, fat, dc1C, clC },
           bolts: { d: '0.875' | '1' | '1.125', gr: 'A325' | 'A490', thr: 'excl' | 'incl', cls: 'A' | 'B', prep: 'drilled' | 'punched',
                    edge: 'cut' | 'sh', gap (in), long: 'flange' | 'both', eccS, eccV: 'incl' | 'excl', minLines, c1 (in, '' = table),
                    stitch: 'req' | 'adv' },
           top, bot: { nl (lines each side of the web), g, g0 (in), nr (rows), s (pitch), ef, ep (end distances: flange, plate), bo, to
                       (outer plate), inner (true | false), bi, ti (each inner plate) },
           web: { h, t (each plate), nr, sv (rows, vertical pitch), nc, sh (columns each side, horizontal pitch), ew, ewp (end distances) },
           clr: { cw (clearance to the web plate), cv (web plate to each flange) } }
     env = { owner ('AASHTO' | 'RIDOT' | 'MassDOT' | 'CTDOT'), lf (owner load factors: SBDOwners.loadFactors(); { m, eta, etaN, h0 }),
             rule(id), cite(r) (default SBDOwners), minPlate (in, auto-design: Owner standards minimum plate, default 3/8 in) }
   Owner rules used: spl.ovs (CTDOT BRSDM V2 6.13.6.1: designed as if oversized holes, K_h = 0.85; 2 in edge; 1/2 in plates; 1 in gap),
   the load rules OWN6–OWN8 (lf: m on LL+IM except the pedestrian load, η on the max / min permanent load factors, haunch 0 in the
   composite properties).

   Units: in, kip, ksi; moments kip-ft (inputs) and kip-in (where GirderDetail works in kip-in: M_r, M_u, M_t); stations ft. */
(function () {
  'use strict';
  const ES = 29000, ED = 'AASHTO LRFD 10th Ed.';
  const St = () => window.SharedSteps;
  const GD_GR = { '36': { Fy: 36, Fu: 58 }, '50': { Fy: 50, Fu: 65 }, '50W': { Fy: 50, Fu: 70 }, 'HPS50W': { Fy: 50, Fu: 70 }, 'HPS70W': { Fy: 70, Fu: 85 } };
  const BOLT = {
    '0.875': { d: 0.875, Ab: 0.6013, dh: 0.9375, Pt: { A325: 39, A490: 49 }, emin: { sh: 1.50, cut: 1.125 } },
    '1': { d: 1.0, Ab: 0.7854, dh: 1.0625, Pt: { A325: 51, A490: 64 }, emin: { sh: 1.75, cut: 1.25 } },
    '1.125': { d: 1.125, Ab: 0.9940, dh: 1.25, Pt: { A325: 56, A490: 80 }, emin: { sh: 2.00, cut: 1.50 } } };
  const FUB = { A325: 120, A490: 150 };
  const PHI = { f: 1.0, y: 0.95, u: 0.80, c: 0.90, cp: 0.95, s: 0.80, bb: 0.80, bs: 0.80, v: 1.0, vu: 0.80 };
  const C1TBL = { '0.75': 1.25, '0.875': 1.5, '1': 1.625, '1.125': 1.75 };   // AISC Manual Table 7-16 tightening clearance (GirderDetail)
  /* GirderDetail's built-in splice (GD_DEFAULT: splice FS1 of the PlateLine example girder) */
  const DEF = {
    sec: { D: 60, gF: '50W', gW: '50W', gP: '50W',
      L: { tw: 0.5625, topB: 16, topT: 0.75, botB: 16, botT: 1.125 }, R: { tw: 0.5625, topB: 18, topT: 1, botB: 18, botT: 1.25 },
      Rh: 1.0, aT: 1.0, aB: 1.0, ts: 8, hh: 2, beff: 114, Ar: 9.3, dr: 4, web: 'unstiffened', do: 60, fc: 4, wc: 0.150, K1: 1.0, nRule: 'exact', code: '10', Fyr: 60, prs: 'no', same: { top: false, web: false, bot: false } },
    dem: { MDC1: -120, MDC2: -30, MDW: -35, MLLp: 1150, MLLn: -1250, MCL: -15, VDC1: 60, VDC2: 9, VDW: 10, VLL: 70, VCL: 5, dMp: 0, dMn: 0 },
    gam: { dcMax: 1.25, dcMin: 0.90, dwMax: 1.50, dwMin: 0.65, llS: 1.75, llSv: 1.30, fat: 1.75, dc1C: 1.25, clC: 1.50 },
    bolts: { d: '0.875', gr: 'A325', thr: 'excl', cls: 'B', prep: 'drilled', edge: 'cut', gap: 0.5, long: 'flange', eccS: 'incl', eccV: 'excl', minLines: 2, c1: '', stitch: 'req' },
    top: { nl: 2, g: 3, g0: 3, nr: 3, s: 3, ef: 1.75, ep: 1.75, bo: 16, to: 0.5, inner: true, bi: 6.5, ti: 0.625 },
    bot: { nl: 2, g: 3, g0: 3, nr: 4, s: 3, ef: 1.75, ep: 1.75, bo: 16, to: 0.6875, inner: true, bi: 6.5, ti: 0.875 },
    web: { h: 54, t: 0.4375, nr: 17, sv: 3, nc: 2, sh: 3, ew: 1.75, ewp: 1.75 },
    clr: { cw: 0.5, cv: 1.5 } };
  const clone = o => JSON.parse(JSON.stringify(o));
  const LF_ONE = { v: 1, o: null, m: 1, eD: 1, eR: 1, eI: 1, eta: 1, etaN: 1, h0: false };
  const RANK = { na: 0, pass: 1, adv: 2, warn: 3, fail: 4 };
  const worst = a => a.reduce((w, s) => RANK[s] > RANK[w] ? s : w, 'na');
  const sum = a => a.reduce((s, x) => s + x, 0);
  const ge = (a, b) => a >= b - 1e-9;
  function parseDim(v) { if (typeof v === 'number') return v; if (v == null) return NaN; let s = String(v).trim().replace(/["”]/g, '').replace(/(\d)-(\d)/g, '$1 $2').replace(/\s+/g, ' '); if (!s) return NaN;
    let m = s.match(/^(-?\d+(?:\.\d+)?) (\d+)\/(\d+)$/); if (m) return +m[1] + m[2] / m[3]; m = s.match(/^(\d+)\/(\d+)$/); if (m) return m[1] / m[2]; const n = Number(s); return isFinite(n) ? n : NaN; }
  const num = v => typeof v === 'number' ? v : parseDim(v);
  const f2 = x => (isFinite(x) ? (Math.abs(x) < 5e-3 ? 0 : x).toFixed(2) : '—');
  function frac(x) { if (!isFinite(x)) return '—'; const s16 = Math.round(x * 16); if (Math.abs(x * 16 - s16) > 1e-6) return x.toFixed(3); let w = Math.floor(s16 / 16), n = s16 - w * 16, d = 16; while (n && n % 2 === 0) { n /= 2; d /= 2; } return n ? (w ? w + ' ' : '') + n + '/' + d : String(w); }

  /* ---------- section properties (GirderDetail steelProps, addPart, modRatio) ---------- */
  function steelProps(D, s) {
    const parts = [{ n: 'Bottom flange', A: s.botB * s.botT, y: s.botT / 2, I0: s.botB * s.botT ** 3 / 12 },
      { n: 'Web', A: D * s.tw, y: s.botT + D / 2, I0: s.tw * D ** 3 / 12 },
      { n: 'Top flange', A: s.topB * s.topT, y: s.botT + D + s.topT / 2, I0: s.topB * s.topT ** 3 / 12 }];
    const A = sum(parts.map(p => p.A)), yb = sum(parts.map(p => p.A * p.y)) / A;
    parts.forEach(p => p.Ad2 = p.A * (p.y - yb) ** 2);
    return { A, yb, I: sum(parts.map(p => p.I0 + p.Ad2)), d: s.botT + D + s.topT, parts };
  }
  function addPart(st, A, y, I0, name) {
    const An = st.A + A, yb = (st.A * st.yb + A * y) / An;
    return { A: An, yb, I: st.I + st.A * (yb - st.yb) ** 2 + I0 + A * (y - yb) ** 2, d: st.d, add: { name, A, y, I0 } };
  }
  function modRatio(fc, wc, K1, rule) { const Ec = 120000 * K1 * wc ** 2 * fc ** 0.33, n0 = ES / Ec, n = rule === 'round' ? Math.max(1, Math.round(n0)) : n0; return { fc, wc, K1, Ec, n0, n, rule: rule === 'round' ? 'round' : 'exact' }; }
  function A610_shearC(lam, r, E, k, Fyw) { return lam <= 1.12 * r ? 1 : lam <= 1.40 * r ? 1.12 * r / lam : 1.57 / lam ** 2 * (E * k / Fyw); }
  function A610_Vp(Fyw, D, tw) { return 0.58 * Fyw * D * tw; }
  const SAME_KEYS = { top: ['topB', 'topT'], web: ['tw'], bot: ['botB', 'botT'] };
  function secEff(sec) { const sm = sec.same || {}, R = { ...sec.R }; Object.entries(SAME_KEYS).forEach(([p, ks]) => { if (sm[p]) ks.forEach(k => R[k] = sec.L[k]); }); return { ...sec, R }; }

  /* ---------- owner rules (GirderDetail gdLF, gdOwnM(OWN_K.splice), gdPLq, gdUt, gdOwnR) ---------- */
  function env0(env) {
    const e = env || {}, OW = window.SBDOwners, owner = e.owner || 'AASHTO', l = e.lf;
    const lf = l && typeof l === 'object' && +l.m > 0 && +l.eta > 0 && +l.etaN > 0 ? l : LF_ONE;
    const rule = e.rule || (id => owner && owner !== 'AASHTO' && OW ? OW.rule(owner, id) || null : null);
    const cite = e.cite || (r => r ? (OW && OW.RULES && OW.RULES.owners[r.owner] ? OW.RULES.owners[r.owner].short : r.owner) + ' ' + r.sec : '');
    return { owner, lf, rule, cite, minPlate: +e.minPlate > 0 ? +e.minPlate : 0.375 };
  }
  const OWN_K = { mx: ['dcMax', 'dwMax'], mn: ['dcMin', 'dwMin'], ll: ['llS'], sv: ['llSv'] };
  function ownM(L) { const f = {}; OWN_K.mx.forEach(k => f[k] = L.eta); OWN_K.mn.forEach(k => f[k] = L.etaN); OWN_K.ll.forEach(k => f[k] = L.eta * L.m); OWN_K.sv.forEach(k => f[k] = L.m); return k => f[k] ?? 1; }
  const plq = (s, k) => { const q = s && s.pl && s.pl[k]; return Array.isArray(q) && q.length === 2 && isFinite(+q[0]) && +q[0] !== 0 && Math.abs(num(s[k]) - +q[1]) < 1e-6 ? +q[0] : 0; };
  const utv = (s, k) => { const v = s && s.ut && typeof s.ut === 'object' ? +s.ut[k] : 0; return isFinite(v) ? v : 0; };

  /* ---------- compute(p, env): GirderDetail gdCompute ---------- */
  function compute(P, env) {
    const E = env0(env);
    const errors = [], S = secEff(P.sec), Dm = P.dem, G = P.gam, B = P.bolts;
    const D = num(S.D);
    ['L', 'R'].forEach(k => ['tw', 'topB', 'topT', 'botB', 'botT'].forEach(f => { if (!(num(S[k][f]) > 0)) errors.push(`Section ${k === 'L' ? 'left' : 'right'} of splice: ${f} must be positive.`); }));
    if (!(D > 0)) errors.push('Web depth D must be positive.');
    ['ts', 'beff', 'fc', 'wc', 'K1', 'Rh', 'aT', 'aB'].forEach(k => { if (!(num(S[k]) > 0)) errors.push(`Section input "${k}" must be positive.`); });
    if (!(num(S.Ar) >= 0) || !(num(S.dr) >= 0) || !(num(S.hh) >= 0)) errors.push('Rebar area, rebar depth, and haunch must be zero or positive.');
    ['top', 'bot'].forEach(k => { const f = P[k]; ['nl', 'nr'].forEach(q => { if (!(Number.isInteger(+f[q]) && +f[q] >= 1)) errors.push(`${k === 'top' ? 'Top' : 'Bottom'} flange splice: "${q}" must be a whole number of at least 1.`); });
      ['g0', 'ef', 'ep', 'bo', 'to'].forEach(q => { if (!(num(f[q]) > 0)) errors.push(`${k === 'top' ? 'Top' : 'Bottom'} flange splice: "${q}" must be positive.`); });
      if (+f.nl > 1 && !(num(f.g) > 0)) errors.push(`${k === 'top' ? 'Top' : 'Bottom'} flange splice: gage g must be positive.`);
      if (+f.nr > 1 && !(num(f.s) > 0)) errors.push(`${k === 'top' ? 'Top' : 'Bottom'} flange splice: pitch s must be positive.`);
      if (f.inner && !(num(f.bi) > 0 && num(f.ti) > 0)) errors.push(`${k === 'top' ? 'Top' : 'Bottom'} flange splice: inner plate width and thickness must be positive.`); });
    ['h', 't', 'sv', 'sh', 'ew', 'ewp'].forEach(q => { if (!(num(P.web[q]) > 0)) errors.push(`Web splice: "${q}" must be positive.`); });
    ['nr', 'nc'].forEach(q => { if (!(Number.isInteger(+P.web[q]) && +P.web[q] >= 1)) errors.push(`Web splice: "${q}" must be a whole number of at least 1.`); });
    Object.keys(Dm).forEach(k => { if (k === 'pl' || k === 'ut') return; if (!isFinite(num(Dm[k]))) errors.push(`Demand "${k}" must be a number.`); });
    ['VDC1', 'VDC2', 'VDW', 'VLL', 'VCL'].forEach(k => { if (num(Dm[k]) < 0) errors.push(`Shear "${k}" is entered as a magnitude and must not be negative.`); });
    if (num(Dm.MLLp) < 0) errors.push('M_LL+ must be zero or positive.'); if (num(Dm.MLLn) > 0) errors.push('M_LL− must be zero or negative.');
    if (!(num(B.gap) >= 0)) errors.push('Gap between girder ends must be zero or positive.');
    if (S.code !== '8' && S.prs === 'yes' && !(num(S.Fyr) > 0)) errors.push('Rebar yield strength F_yr must be positive when P_rs is included.');
    if (S.web === 'stiffened' && !(num(S.do) > 0)) errors.push('Stiffener spacing d_o must be positive when the web shear resistance basis is "Stiffened" (select "Unstiffened" if there are no transverse stiffeners).');
    if (Number.isInteger(+P.web.nr) && Number.isInteger(+P.web.nc) && +P.web.nr * +P.web.nc < 2) errors.push('Web splice: at least two bolts are needed on each side of the splice (rows × columns ≥ 2); a one-bolt group has no polar moment of inertia.');
    if (!GD_GR[S.gF] || !GD_GR[S.gW] || !GD_GR[S.gP]) errors.push('Choose the steel grades of the flanges, web and splice plates.');
    if (!BOLT[B.d] || !FUB[B.gr]) errors.push('Choose the bolt diameter (7/8, 1 or 1 1/8 in) and grade (A325 or A490).');
    if (errors.length) return { errors };

    const secL = { ...Object.fromEntries(Object.entries(S.L).map(([k, v]) => [k, num(v)])) }, secR = { ...Object.fromEntries(Object.entries(S.R).map(([k, v]) => [k, num(v)])) };
    const pL = steelProps(D, secL), pR = steelProps(D, secR);
    const smSide = pL.I <= pR.I ? 'L' : 'R', sm = smSide === 'L' ? secL : secR, ps = smSide === 'L' ? pL : pR;
    const gF = GD_GR[S.gF], gW = GD_GR[S.gW], gP = GD_GR[S.gP], bolt = BOLT[B.d], Fub = FUB[B.gr];
    const MR = modRatio(num(S.fc), num(S.wc), num(S.K1), S.nRule), ts = num(S.ts), hh0 = num(S.hh), hh = E.lf.h0 ? 0 : hh0, beff = num(S.beff), n = MR.n, Ar = num(S.Ar), dr = num(S.dr), Rh = num(S.Rh);   // hh: 0 in composite properties under the owner rule (OWN8)
    const ySlab = ps.d + hh + ts / 2;
    const sec = {
      s: { ...ps, name: 'Steel section (noncomposite)' },
      c3: { ...addPart(ps, beff * ts / (3 * n), ySlab, beff * ts ** 3 / 12 / (3 * n), 'Deck, b_eff t_s / 3n'), name: 'Long-term composite (3n)' },
      cn: { ...addPart(ps, beff * ts / n, ySlab, beff * ts ** 3 / 12 / n, 'Deck, b_eff t_s / n'), name: 'Short-term composite (n)' },
      r: Ar > 0 ? { ...addPart(ps, Ar, ps.d + hh + ts - dr, 0, 'Deck reinforcement A_r'), name: 'Steel + longitudinal reinforcement' } : { ...ps, name: 'Steel section (no reinforcement entered)' } };
    const yT = ps.d - sm.topT / 2, yB = sm.botT / 2;
    const fAt = (Mkft, k) => { const s = sec[k]; return { top: -Mkft * 12 * (yT - s.yb) / s.I, bot: -Mkft * 12 * (yB - s.yb) / s.I }; };

    /* ---- components and combinations ---- */
    const plE = {}, mS = E.lf.m; if (mS !== 1 && Dm.pl) ['MLLp', 'MLLn', 'VLL'].forEach(k => { const q = plq(Dm, k); if (q) plE[k] = { k, v0: num(Dm[k]), q, v: num(Dm[k]) - q + q / mS }; });   // GD45: m not on the pedestrian load
    const M = k => plE[k] ? plE[k].v : num(Dm[k]);
    const comp = {
      DC1: { M: M('MDC1'), sec: 's', lbl: 'M_{DC1}' }, DC2: { M: M('MDC2'), sec: M('MDC2') >= 0 ? 'c3' : 'r', lbl: 'M_{DC2}' },
      DW: { M: M('MDW'), sec: M('MDW') >= 0 ? 'c3' : 'r', lbl: 'M_{DW}' }, LLp: { M: M('MLLp'), sec: 'cn', lbl: 'M_{LL+IM}^{+}' },
      LLn: { M: M('MLLn'), sec: 'r', lbl: 'M_{LL+IM}^{-}' }, CL: { M: M('MCL'), sec: 's', lbl: 'M_{CL}' },
      UT: { M: utv(Dm, 'MUT'), sec: 's', lbl: 'M_{UT}' }, UF: { M: utv(Dm, 'MUF'), sec: 's', lbl: 'M_{UF}' } };   // GD54b: utilities on the steel section (0 without them)
    Object.values(comp).forEach(c => c.f = fAt(c.M, c.sec));
    const gO = ownM(E.lf), g = k => num(G[k]) * gO(k);   // OWN6/OWN7: the owner load rules (factors × 1 for AASHTO)
    const uT = comp.UT.M, uF = comp.UF.M;
    const combos = [
      { id: 'StrP', name: 'Strength I, maximum positive flexure', type: 'str', fac: { DC1: M('MDC1') >= 0 ? g('dcMax') : g('dcMin'), DC2: M('MDC2') >= 0 ? g('dcMax') : g('dcMin'), DW: M('MDW') >= 0 ? g('dwMax') : g('dwMin'), LLp: g('llS'), LLn: 0, CL: 0, UT: uT >= 0 ? g('dwMax') : g('dwMin'), UF: uF >= 0 ? g('dcMax') : 0 } },
      { id: 'StrN', name: 'Strength I, maximum negative flexure', type: 'str', fac: { DC1: M('MDC1') <= 0 ? g('dcMax') : g('dcMin'), DC2: M('MDC2') <= 0 ? g('dcMax') : g('dcMin'), DW: M('MDW') <= 0 ? g('dwMax') : g('dwMin'), LLp: 0, LLn: g('llS'), CL: 0, UT: uT <= 0 ? g('dwMax') : g('dwMin'), UF: uF <= 0 ? g('dcMax') : 0 } },
      { id: 'SvP', name: 'Service II, maximum positive flexure', type: 'sv', fac: { DC1: 1, DC2: 1, DW: 1, LLp: g('llSv'), LLn: 0, CL: 0, UT: 1, UF: uF >= 0 ? 1 : 0 } },
      { id: 'SvN', name: 'Service II, maximum negative flexure', type: 'sv', fac: { DC1: 1, DC2: 1, DW: 1, LLp: 0, LLn: g('llSv'), CL: 0, UT: 1, UF: uF <= 0 ? 1 : 0 } },
      { id: 'Con', name: 'Constructibility, deck placement', type: 'con', fac: { DC1: g('dc1C'), DC2: 0, DW: 0, LLp: 0, LLn: 0, CL: g('clC'), UT: 0, UF: 0 } }];
    const V = k => plE[k] ? plE[k].v : num(Dm[k]);   // GD45
    const vT = utv(Dm, 'VUT'), vF = utv(Dm, 'VUF');
    combos.forEach(c => {
      c.terms = Object.entries(c.fac).filter(([k, f]) => f !== 0 && comp[k].M !== 0).map(([k, f]) => ({ k, g: f, M: comp[k].M, sec: comp[k].sec, fs: comp[k].f, ft: f * comp[k].f.top, fb: f * comp[k].f.bot }));
      c.ft = sum(c.terms.map(t => t.ft)); c.fb = sum(c.terms.map(t => t.fb)); c.M = sum(c.terms.map(t => t.g * t.M));
      c.V = c.type === 'str' ? g('dcMax') * (V('VDC1') + V('VDC2')) + g('dwMax') * V('VDW') + g('llS') * V('VLL')
          : c.type === 'sv' ? V('VDC1') + V('VDC2') + V('VDW') + g('llSv') * V('VLL') : g('dc1C') * V('VDC1') + g('clC') * V('VCL');
      // GD54b: utility shears (magnitudes): γ_DW max on UT and γ_DC max on UF at Strength, 1.0 at Service, none at deck placement
      c.vUt = null;
      if ((vT || vF) && c.type !== 'con') { const a = c.type === 'str' ? g('dwMax') : 1, b = c.type === 'str' ? g('dcMax') : 1; c.V += a * vT + b * vF; c.vUt = { a, b, vT, vF }; }
    });

    /* ---- web shear resistance of the smaller section ---- */
    const tw = sm.tw, FyW = gW.Fy, stiffW = S.web === 'stiffened' && num(S.do) <= 3 * D + 1e-9, k = stiffW ? 5 + 5 / (num(S.do) / D) ** 2 : 5, r = Math.sqrt(ES * k / FyW), lam = D / tw;
    const Cv = A610_shearC(lam, r, ES, k, FyW), Vp = A610_Vp(FyW, D, tw);
    let Vn, vnExpr;
    if (stiffW) {   // 6.10.9.1: interior panels with d_o > 3D are unstiffened
      const dD = num(S.do) / D, rat = 2 * D * tw / (sm.botB * sm.botT + sm.topB * sm.topT);
      Vn = rat <= 2.5 ? Vp * (Cv + 0.87 * (1 - Cv) / Math.sqrt(1 + dD ** 2)) : Vp * (Cv + 0.87 * (1 - Cv) / (Math.sqrt(1 + dD ** 2) + dD));
      vnExpr = { k, C: Cv, Vp, rat, dD, eq: rat <= 2.5 ? '6.10.9.3.2-2' : '6.10.9.3.2-8' };
    } else { Vn = Cv * Vp; vnExpr = { k, C: Cv, Vp, eq: '6.10.9.2-1', over3D: S.web === 'stiffened' }; }
    const phVn = PHI.v * Vn;

    /* ---- flange design forces (strength, 8th Edition) ---- */
    const Fy = gF.Fy, Fu = gF.Fu, aT = num(S.aT), aB = num(S.aB);
    const nhT = 2 * +P.top.nl, nhB = 2 * +P.bot.nl, dh = bolt.dh, dn = dh + 0.0625;   // dn: hole width deducted for net area, standard hole + 1/16 in (6.8.3)
    const flg = { top: { b: sm.topB, t: sm.topT, a: aT, nh: nhT }, bot: { b: sm.botB, t: sm.botT, a: aB, nh: nhB } };
    Object.values(flg).forEach(f => { f.Ag = f.b * f.t; f.An = f.Ag - f.nh * dn * f.t; f.Ae = Math.min(PHI.u * Fu / (PHI.y * Fy) * f.An, f.Ag); });
    combos.filter(c => c.type === 'str').forEach(c => {
      const rt = Math.abs(c.ft) / (PHI.f * aT * Fy), rb = Math.abs(c.fb) / (PHI.f * aB * Fy);
      const cf = rb >= rt ? 'bot' : 'top', nc = cf === 'bot' ? 'top' : 'bot';
      const fcf = cf === 'bot' ? c.fb : c.ft, fncf = cf === 'bot' ? c.ft : c.fb, ac = flg[cf].a, anc = flg[nc].a;
      const Fcf = Math.max((Math.abs(fcf) / Rh + ac * PHI.f * Fy) / 2, 0.75 * ac * PHI.f * Fy);
      const Rcf = Math.abs(fcf) > 1e-9 ? Fcf / Math.abs(fcf) : 0;
      const Fncf = Math.max(Rcf * Math.abs(fncf) / Rh, 0.75 * anc * PHI.f * Fy);
      const sgc = fcf >= 0 ? 1 : -1, sgn = Math.abs(fncf) > 1e-9 ? Math.sign(fncf) : -sgc;
      const F = { [cf]: { F: Fcf, sign: sgc, role: 'controlling' }, [nc]: { F: Fncf, sign: sgn, role: 'noncontrolling' } };
      ['top', 'bot'].forEach(fl => { const q = F[fl], ff = flg[fl]; q.tension = q.sign > 0; q.Aused = q.tension ? ff.Ae : ff.Ag; q.P = q.F * q.Aused; });
      // web forces
      const Vu = c.V, Vuw = Vu < 0.5 * phVn ? 1.5 * Vu : (Vu + phVn) / 2;
      const Fcs = sgc * Fcf, fncs = fncf;
      const Muw = tw * D ** 2 / 12 * Math.abs(Rh * Fcs - Rcf * fncs), Huw = tw * D / 2 * (Rh * Fcs + Rcf * fncs);
      Object.assign(c, { rt, rb, cf, nc, fcf, fncf, Fcf, Rcf, Fncf, F, Vu, Vuw, Muw, Huw, ruleV: Vu < 0.5 * phVn ? 'low' : 'high' });
    });
    /* ---- 10th Edition (6.13.6.1.3): flange design yield resistance and flange-couple moment ---- */
    const code = S.code === '8' ? '8' : '10';
    const pfyOf = (b, t, nh) => { const Ag = b * t, An = Ag - nh * dn * t, Ae0 = PHI.u * Fu / (PHI.y * Fy) * An, Ae = Math.min(Ae0, Ag); return { b, t, Ag, An, Ae0, Ae, P: Fy * Ae }; };
    const Pfy = {};
    ['top', 'bot'].forEach(k => { const nh = k === 'top' ? nhT : nhB, fb = s => k === 'top' ? [s.topB, s.topT] : [s.botB, s.botT];
      const L = pfyOf(...fb(secL), nh), Rr = pfyOf(...fb(secR), nh); Pfy[k] = L.P <= Rr.P ? { ...L, side: 'L', L, R: Rr } : { ...Rr, side: 'R', L, R: Rr }; });
    const tbS = sm.botT, ttS = sm.topT, Apos = tbS / 2 + D + ttS + hh + ts / 2, Aneg = tbS / 2 + D + ttS / 2;
    const yb_ = tbS / 2, yt_ = tbS + D + ttS / 2, yr_ = ps.d + hh + ts - dr, Fyr = num(S.Fyr), usePrs = S.prs === 'yes' && Ar > 0, Prs = usePrs ? Fyr * Ar : 0;
    const AwPos = D / 2 + ttS + hh + ts / 2;
    const negCouple = (Tt, Tr, C) => {   // tension: top flange (+ rebar); compression: bottom flange; kip, kip-in
      const MT = Tt * (yt_ - yb_) + Tr * (yr_ - yb_);
      if (Tt + Tr <= C + 1e-9) return { Mr: MT, spare: 'bot', Aw: D / 2 + tbS / 2, gov: Tr > 0 ? 'top flange + rebar (tension)' : 'top flange', MT, scaled: false };
      return { Mr: C / (Tt + Tr) * MT, spare: 'top', Aw: D / 2 + ttS / 2, gov: 'bottom flange (compression)', MT, scaled: true }; };
    const mPos = { Mr: Pfy.bot.P * Apos, A: Apos, Aw: AwPos, gov: 'bottom flange', basis: 'pos' };
    const nNeg = negCouple(Pfy.top.P, Prs, Pfy.bot.P), mNeg = { ...nNeg, A: Aneg, basis: 'neg' };
    const nNc = negCouple(Pfy.top.P, 0, Pfy.bot.P), mNc = { ...nNc, A: Aneg, basis: 'nc' };
    if (code === '10') {
      combos.filter(c => c.type === 'str' || c.type === 'con').forEach(c => {
        const m = c.type === 'con' ? mNc : c.M >= 0 ? mPos : mNeg, Mu = Math.abs(c.M) * 12, ex = Math.max(0, Mu - m.Mr);
        c.m10 = { ...m, Mu, ex, Hw: ex / m.Aw };
        if (c.type === 'str') { c.Vu = c.V; c.Vuw = phVn; c.Muw = 0; c.Huw = c.m10.Hw;
          c.F = { top: { P: Pfy.top.P, tension: true, both: true, role: 'design' }, bot: { P: Pfy.bot.P, tension: true, both: true, role: 'design' } }; }
      });
    }
    // service and constructibility forces (slip)
    combos.filter(c => c.type !== 'str').forEach(c => {
      c.Ps = { top: Math.abs(c.ft) / Rh * flg.top.Ag, bot: Math.abs(c.fb) / Rh * flg.bot.Ag };
      c.Vw = c.V; c.Mw = tw * D ** 2 / 12 * Math.abs(c.ft - c.fb); c.Hw = tw * D / 2 * (c.ft + c.fb);
    });

    /* ---- bolt resistances ---- */
    const rOv = E.rule('spl.ovs');   // OWN25 (CTDOT BRSDM V2 6.13.6.1): designed as if oversized holes were used (K_h = 0.85), edge distance at least 2 in
    const thrF = B.thr === 'excl' ? 0.56 : 0.45, Ks = B.cls === 'B' ? 0.50 : 0.30, Kh = rOv ? rOv.value.Kh : 1.0, Pt = bolt.Pt[B.gr], Rp = B.prep === 'drilled' ? 1.0 : 0.90;
    const emin = Math.max(bolt.emin[B.edge], rOv ? rOv.value.edge : 0), d = bolt.d, gap = num(B.gap);
    const fl = {};
    ['top', 'bot'].forEach(key => {
      const f = P[key], nl = +f.nl, nr = +f.nr, g0 = num(f.g0), gg = nl > 1 ? num(f.g) : 0, s = nr > 1 ? num(f.s) : 0, ef = num(f.ef), ep = num(f.ep);
      const bo = num(f.bo), to = num(f.to), inner = !!f.inner, bi = inner ? num(f.bi) : 0, ti = inner ? num(f.ti) : 0;
      const bL = key === 'top' ? secL.topB : secL.botB, bR = key === 'top' ? secR.topB : secR.botB, tL = key === 'top' ? secL.topT : secL.botT, tR = key === 'top' ? secR.topT : secR.botT;
      const bmin = Math.min(bL, bR), yOut = g0 + (nl - 1) * gg, yiO = bmin / 2, yiI = yiO - bi;
      const n = 2 * nl * nr, Ns = inner ? 2 : 1, Lconn = (nr - 1) * s, red = Lconn > 38 ? 0.83 : 1.0;
      const Rn1 = thrF * bolt.Ab * Fub * Ns * red, phR1 = PHI.s * Rn1;
      const Ao = bo * to, Ai = 2 * bi * ti, Asp = Ao + Ai;
      const equal = inner && Math.abs(Ai - Ao) / Ao <= 0.10;
      const tfill = Math.abs(tL - tR), fillSide = tL < tR ? 'L' : tR < tL ? 'R' : null;
      const sides = ['L', 'R'].map(sd => {
        const tf = sd === 'L' ? tL : tR, bf = sd === 'L' ? bL : bR, Af = bf * tf;
        let R = 1, gamma = 0, Afill = 0, Ap = 0;
        if (sd === fillSide && tfill >= 0.25 - 1e-9) { Afill = tfill * Math.min(bo, bf); Ap = Math.min(Af, Asp); gamma = Afill / Ap; R = (1 + gamma) / (1 + 2 * gamma); }
        // bearing, per bolt
        const brg = (t, Fu_, end) => { let tot = 0; const rows = []; for (let i = 0; i < nr; i++) { const Lc = i === 0 ? end - dh / 2 : s - dh; const rn = Math.min(2.4 * d * t * Fu_, 1.2 * Lc * t * Fu_); rows.push({ Lc, rn }); tot += rn * 2 * nl; } return { tot: PHI.bb * tot, rows, t, Fu: Fu_ }; };
        const bF = brg(tf, gF.Fu, ef), bP = brg(to + ti, gP.Fu, ep);
        return { sd, tf, bf, Af, R, gamma, Afill, Ap, filled: sd === fillSide && tfill > 1e-9, shear: n * phR1 * R, bF, bP, bearing: Math.min(bF.tot, bP.tot), edgeF: bf / 2 - yOut };
      });
      const slip1 = Kh * Ks * Ns * Pt, slip = n * slip1;
      // block shear: region from the part's end to the last row, bounded in width by bolt lines (shear planes) or free edges;
      // each pattern is compared with the share of force delivered by the bolts on or inside the block
      const bs = (t, Fy_, Fu_, Lend, planes, AtnLen, share, name) => { const Lv = Lend + (nr - 1) * s, Agv = planes * Lv * t, Anv = planes * (Lv - (nr - 0.5) * dn) * t, Atn = AtnLen * t;
        const a = 0.58 * Fu_ * Anv + Fu_ * Atn, b = 0.58 * Fy_ * Agv + Fu_ * Atn; return { name, planes, share, Lv, Agv, Anv, Atn, a, b, Fy: Fy_, Fu: Fu_, Rr: PHI.bs * Rp * Math.min(a, b) }; };
      const eo = bo / 2 - yOut, blk = [];
      const flangeBlocks = (sd, b, t) => { const ee = b / 2 - yOut;
        blk.push({ part: `Flange, ${sd === 'L' ? 'left' : 'right'}`, force: 'flange', ...bs(t, gF.Fy, gF.Fu, ef, 2, 2 * (ee - dn / 2), 1 / nl, 'edge strips outside the outer lines') });
        if (nl > 1) blk.push({ part: `Flange, ${sd === 'L' ? 'left' : 'right'}`, force: 'flange', ...bs(t, gF.Fy, gF.Fu, ef, 2, 2 * ((b / 2 - g0) - (nl - 0.5) * dn), 1, 'blocks from the inner lines to the edges') }); };
      flangeBlocks('L', bL, tL); flangeBlocks('R', bR, tR);
      blk.push({ part: 'Outer plate', force: 'o', ...bs(to, gP.Fy, gP.Fu, ep, 2, 2 * (eo - dn / 2), 1 / nl, 'edge strips outside the outer lines') });
      if (nl > 1) blk.push({ part: 'Outer plate', force: 'o', ...bs(to, gP.Fy, gP.Fu, ep, 2, 2 * ((bo / 2 - g0) - (nl - 0.5) * dn), 1, 'blocks from the inner lines to the edges') });
      blk.push({ part: 'Outer plate', force: 'o', ...bs(to, gP.Fy, gP.Fu, ep, 2, 2 * yOut - (2 * nl - 1) * dn, 1, 'central block between the outer lines') });
      if (inner) {
        const eIn = g0 - yiI, eOut = yiO - yOut;
        blk.push({ part: 'Inner plates', force: 'i', ...bs(ti, gP.Fy, gP.Fu, ep, 4, 2 * (eIn + eOut - dn), nl === 1 ? 1 : 2 / nl, 'edge strips on both edges') });
        blk.push({ part: 'Inner plates', force: 'i', ...bs(ti, gP.Fy, gP.Fu, ep, 2, 2 * ((yiO - g0) - (nl - 0.5) * dn), 1, 'block from the web-side line to the outside edge') });
        blk.push({ part: 'Inner plates', force: 'i', ...bs(ti, gP.Fy, gP.Fu, ep, 2, 2 * ((yOut - yiI) - (nl - 0.5) * dn), 1, 'block from the outside line to the web-side edge') });
        if (nl > 1) blk.push({ part: 'Inner plates', force: 'i', ...bs(ti, gP.Fy, gP.Fu, ep, 4, 2 * (nl - 1) * (gg - dn), 1, 'central block between the extreme lines') });
      }
      // plate resistances
      const An_o = Math.min(Ao - 2 * nl * dn * to, 0.85 * Ao), An_i = inner ? Math.min(Ai - 2 * nl * dn * ti, 0.85 * Ai) : 0;
      const plate = { o: { A: Ao, An: An_o, y: PHI.y * gP.Fy * Ao, u: PHI.u * gP.Fu * An_o, c: PHI.cp * gP.Fy * Ao }, i: inner ? { A: Ai, An: An_i, y: PHI.y * gP.Fy * Ai, u: PHI.u * gP.Fu * An_i, c: PHI.cp * gP.Fy * Ai } : null };
      fl[key] = { key, nl, nr, g0, g: gg, s, ef, ep, bo, to, inner, bi, ti, bL, bR, tL, tR, bmin, yOut, yiO, yiI, n, Ns, Lconn, red, Rn1, phR1, Ao, Ai, Asp, equal, tfill, fillSide, sides, slip1, slip, blk, plate, eo,
        Lpl: gap + 2 * (ef + (nr - 1) * s + ep) };
    });

    if (code === '10') {
      const slipNeg = Math.min(fl.top.slip, fl.bot.slip);
      combos.filter(c => c.type === 'sv' || c.type === 'con').forEach(c => {
        const pos = c.type === 'sv' && c.M >= 0, A = pos ? Apos : Aneg, Aw = pos ? AwPos : (fl.top.slip <= fl.bot.slip ? D / 2 + tbS / 2 : D / 2 + ttS / 2);
        const Msr = (pos ? fl.bot.slip : slipNeg) * A, Ms = Math.abs(c.M) * 12, ex = Math.max(0, Ms - Msr);
        c.s10 = { pos, A, Aw, Msr, Ms, ex, Hs: ex / Aw, gov: pos ? 'bottom flange' : fl.top.slip <= fl.bot.slip ? 'top flange' : 'bottom flange' };
        c.Ps = { top: pos ? null : Ms / A, bot: Ms / A };
        c.Vw = c.V; c.Mw = 0; c.Hw = c.s10.Hs;
      });
    }
    /* ---- web splice bolt group ---- */
    const W = P.web, nrw = +W.nr, ncw = +W.nc, sv = num(W.sv), sh = num(W.sh), ew = num(W.ew), ewp = num(W.ewp), hw = num(W.h), twp = num(W.t);
    const xbar = ew + (ncw - 1) * sh / 2, e = gap / 2 + xbar, nw = nrw * ncw;
    const bolts = []; for (let j = 0; j < ncw; j++) for (let i = 0; i < nrw; i++) bolts.push({ dx: (j - (ncw - 1) / 2) * sh, dy: (i - (nrw - 1) / 2) * sv });
    const Ip = sum(bolts.map(b => b.dx ** 2 + b.dy ** 2)), dxm = (ncw - 1) * sh / 2, dym = (nrw - 1) * sv / 2;
    const redW = B.long === 'both' && Math.max((nrw - 1) * sv, (ncw - 1) * sh) > 38 ? 0.83 : 1.0;
    const phRw = PHI.s * thrF * bolt.Ab * Fub * 2 * redW, slipW = Kh * Ks * 2 * Pt;
    const ev = (hw - (nrw - 1) * sv) / 2;
    const LcW = Math.min(ew - dh / 2, ncw > 1 ? sh - dh : Infinity, nrw > 1 ? sv - dh : Infinity), LcP = Math.min(ewp - dh / 2, ev - dh / 2, ncw > 1 ? sh - dh : Infinity, nrw > 1 ? sv - dh : Infinity);
    const brgW = PHI.bb * Math.min(2.4 * d * tw * gW.Fu, 1.2 * LcW * tw * gW.Fu), brgP = PHI.bb * Math.min(2.4 * d * 2 * twp * gP.Fu, 1.2 * LcP * 2 * twp * gP.Fu);
    const webForce = (V, Mw, H, useE = true) => { const Mt = Mw + (useE ? V * e : 0), Rx = Math.abs(H) / nw + Mt * dym / Ip, Ry = V / nw + Mt * dxm / Ip; return { Mt, Rx, Ry, R: Math.hypot(Rx, Ry) }; };
    const Awp = 2 * hw * twp, Swp = 2 * twp * hw ** 2 / 6, Avn = 2 * (hw - nrw * dn) * twp;
    const web = { nrw, ncw, sv, sh, ew, ewp, hw, twp, xbar, e, nw, Ip, dxm, dym, redW, phRw, slipW, ev, LcW, LcP, brgW, brgP, Awp, Swp, Avn,
      Vy: PHI.v * 0.58 * gP.Fy * Awp, Vr: PHI.vu * 0.58 * gP.Fu * Avn, bolts };
    const eS = code === '8' || B.eccS !== 'excl', eV = code === '8' || B.eccV === 'incl';
    combos.forEach(c => { if (c.type === 'str') c.wb = webForce(c.Vuw, c.Muw, c.Huw, eS); else c.wb = webForce(c.Vw, c.Mw, c.Hw, eV); });

    /* ---- fatigue (optional) ---- */
    let fat = null;
    if (Math.abs(M('dMp')) > 0 || Math.abs(M('dMn')) > 0) {
      const fp = fAt(Math.abs(M('dMp')), 'cn'), fn = fAt(-Math.abs(M('dMn')), 'r'), gf = g('fat');
      fat = { gf, fp, fn, top: gf * (Math.abs(fp.top) + Math.abs(fn.top)), bot: gf * (Math.abs(fp.bot) + Math.abs(fn.bot)) };
    }
    return { errors: [], env: E, plAdj: Object.values(plE), D, secL, secR, pL, pR, smSide, sm, ps, sec, yT, yB, comp, combos, flg, fl, web, fat, bolt, Fub, thrF, Ks, Kh, Pt, Rp, emin, gap, gF, gW, gP, Rh, Fy, Fu, tw,
      k, Cv, Vp, Vn, phVn, vnExpr, lam, P, MR, code, Pfy, Apos, Aneg, AwPos, mPos, mNeg, mNc, Prs, Fyr, usePrs, yr_, eS, eV, hh, hh0, dn, rOv, g, gO };
  }

  /* spCtNarrow(R): GD62 (CTDOT BRSDM V2 6.13.6.1, 6.10.2.2): under the owner's 2 in edge and 1/2 in plates, the flange width needed at
     the splice for the minimum gage lines each side of the web (no inner plates, no staggering), rounded up to the owner's flange width
     increment; null when the owner has no such rule or the flanges are wide enough (a note on DT3, DT4, DT7, DT10; display only) */
  function spCtNarrow(R) { const E = R.env, rOv = E.rule('spl.ovs'); if (!rOv || !R || !R.fl || !R.web) return null;
    const P_ = R.P, bt = BOLT[P_.bolts.d] || BOLT['0.875'], d = bt.d, u4 = v => Math.ceil(v * 4 - 1e-6) / 4, tw = Math.max(R.secL.tw, R.secR.tw), twp = Math.max(R.web.twp, rOv.value.tp), cw = parseDim(P_.clr.cw), em = R.emin;
    const C1 = parseDim(P_.bolts.c1) > 0 ? parseDim(P_.bolts.c1) : (C1TBL[P_.bolts.d] || 1.5), nMin = Math.max(1, Math.round(parseDim(P_.bolts.minLines) || 1)), g = u4(Math.max(3, 3 * d));
    const g0 = u4(Math.max(tw / 2 + twp + cw + em, tw / 2 + twp + C1)), need = Math.ceil(2 * (g0 + (nMin - 1) * g + em) * 4 - 1e-6) / 4, rI = E.rule('plate.incBf'), inc = rI && +rI.value > 0 ? +rI.value : 0, needI = inc ? Math.ceil(need / inc - 1e-9) * inc : need;
    const fl = ['top', 'bot'].map(k => ({ k, b: R.fl[k].bmin })).filter(q => q.b < need - 1e-9); if (!fl.length) return null;
    return { need, needI, fl, nMin, em, tp: rOv.value.tp, msg: `${E.cite(rOv)}: ${frac(em)} in minimum edge distance and ${frac(rOv.value.tp)} in minimum splice plates, so the flange at the splice must be at least ${frac(need)} in wide for ${nMin} gage line${nMin > 1 ? 's' : ''} each side of the web${inc && needI !== need ? ` (${frac(needI)} in with the owner's ${frac(inc)} in flange width increment, ${E.cite(rI)})` : ''}; here the ${fl.map(q => `${q.k === 'top' ? 'top' : 'bottom'} flange is ${frac(q.b)} in`).join(' and the ')}. Widen the flange at the splice to ${frac(needI)} in${nMin > 1 ? ', or use one gage line each side if the flange splice still passes with it' : ''}.` }; }

  /* ---------- checks(R, opt): GirderDetail gdChecks ----------
     Each check { id, grp, title, ref, items: [{ loc, dem, cap, r, st, step }], status, gov, naWhy, note }; the item's step (id sp.<check>.<k>)
     works it. opt.steps = false skips the steps (auto-design). The result carries .steps (every check's steps, in order). */
  function checks(R, opt) {
    const wantSt = !(opt && opt.steps === false), w = wantSt ? St().work('sp') : null;
    const out = [], P = R.P, B = P.bolts, E = R.env;
    const add = c => { c.status = c.items.length ? worst(c.items.map(i => i.st)) : 'na'; let gi = -1; c.items.forEach((it, k) => { if (gi < 0 || RANK[it.st] > RANK[c.items[gi].st] || (RANK[it.st] === RANK[c.items[gi].st] && (it.r ?? -1) > (c.items[gi].r ?? -1))) gi = k; }); c.gov = gi; out.push(c); };
    const na = (c, why) => { c.items = []; c.naWhy = why; add(c); };
    const st = (dem, cap) => ge(cap, dem) ? 'pass' : 'fail';
    const n2 = x => St().n(x, 2), n3 = x => St().n(x, 3), g0 = x => St().g(x, 0), lt = ok => ok ? '\\le' : '\\gt';
    /* item(c, it, mk): adds item it to check c; mk() returns the step (sym, eq, sub, value, unit, d, note), built only when steps are wanted */
    const item = (c, it, mk) => { const k = c.items.length; it.step = `sp.${c.id}.${k}`; c.items.push(it);
      if (wantSt) { const s = mk(); w.add({ id: `${c.id}.${k}`, label: `${c.id} ${c.title}: ${it.loc}`, unit: '', d: 3, ref: c.ref, ...s, ok: it.st === 'pass' || it.st === 'na' ? true : it.st === 'fail' ? false : undefined }); } };
    const ratio = (dem, cap, dsym, csym, d0) => ({ sym: `\\frac{${dsym}}{${csym}}`, eq: '', sub: `\\frac{${St().n(dem, d0 == null ? 2 : d0)}}{${St().n(cap, d0 == null ? 2 : d0)}}`, value: dem / cap });
    const strs = R.combos.filter(c => c.type === 'str'), svs = R.combos.filter(c => c.type === 'sv'), con = R.combos.find(c => c.type === 'con');
    const SD = sd => sd === 'L' ? 'left' : 'right', X10 = R.code === '10';
    const fcases = X10 ? [{ id: 'P_fy', F: { top: { P: R.Pfy.top.P, tension: true, both: true, role: 'design' }, bot: { P: R.Pfy.bot.P, tension: true, both: true, role: 'design' } } }] : strs;
    const Psym = X10 ? 'P_{fy}' : 'P_{fu}';
    const r6 = `${ED} Art.`;

    ['top', 'bot'].forEach(key => {
      const F = R.fl[key], nm = key === 'top' ? 'Top' : 'Bottom', grp = `${nm} flange splice`, id = key === 'top' ? 'TF' : 'BF';
      {
        const c = { id: id + '1', grp, title: 'Bolt shear resistance', ref: `${r6} 6.13.2.7, 6.13.6.1.5 (fillers)`, items: [],
          note: `${F.n} bolts per side, ${F.Ns === 2 ? 'double' : 'single'} shear (${F.inner ? 'inner and outer plates' : 'outer plate only'}), threads ${B.thr === 'excl' ? 'excluded from' : 'included in'} the shear planes. ${F.red < 1 ? `The connection length ${f2(F.Lconn)} in exceeds 38 in, so R_n is reduced by 0.83. ` : ''}${F.tfill >= 0.25 - 1e-9 ? `A ${frac(F.tfill)} in filler on the ${SD(F.fillSide)} side is 0.25 in or thicker, so the bolt shear resistance on that side is reduced by R instead of developing the filler.` : F.tfill > 1e-9 ? `The ${frac(F.tfill)} in filler is thinner than 0.25 in, so no reduction applies.` : 'Flange thicknesses match; no filler.'}` };
        fcases.forEach(cb => F.sides.forEach(sd => { const P_ = cb.F[key].P, cap = sd.shear, r = P_ / cap;
          item(c, { loc: `${cb.id}, ${SD(sd.sd)}`, dem: P_, cap, r, st: st(P_, cap), unit: 'kip' }, () => ({ ...ratio(P_, cap, Psym, 'n\\,\\phi_{s}R_{n}R'),
            note: `n φ_sR_nR = ${F.n}(0.80)(${n2(F.Rn1)})(${n3(sd.R)}) = ${n2(cap)} kip; R_n: see sp.${key}.Rn${sd.R < 1 ? `; R: see sp.${key}.R${sd.sd}` : ''}. ${Psym === 'P_{fy}' ? 'P_fy: see sp.' + key + '.Pfy' : 'P_fu: see sp.' + cb.id + '.P' + key}.` })); }));
        add(c);
      }
      {
        const c = { id: id + '2', grp, title: 'Bearing resistance at bolt holes', ref: `${r6} 6.13.2.9`, items: [],
          note: 'Bearing is summed over all bolts on one side, separately for the flange and for the splice plates (outer plus inner thickness). L_c is the clear distance to the end of the part for the end row and the clear distance between holes elsewhere.' };
        fcases.forEach(cb => F.sides.forEach(sd => { const P_ = cb.F[key].P, cap = sd.bearing, r = P_ / cap;
          item(c, { loc: `${cb.id}, ${SD(sd.sd)}`, dem: P_, cap, r, st: st(P_, cap), unit: 'kip' }, () => ({ ...ratio(P_, cap, Psym, '\\sum\\phi_{bb}R_{n}'),
            note: `Σφ_bbR_n = min(flange ${n2(sd.bF.tot)}, plates ${n2(sd.bP.tot)}) = ${n2(cap)} kip: see sp.${key}.brg${sd.sd}.` })); }));
        add(c);
      }
      {
        const c = { id: id + '3', grp, title: 'Slip resistance', ref: `${r6} 6.13.2.8, 6.13.6.1.3`, items: [],
          note: `Class ${B.cls} surface (K_s = ${f2(R.Ks)}), ${R.Kh !== 1 ? `standard holes specified but designed as if oversized (K_h = ${f2(R.Kh)}, ${E.cite(R.rOv)})` : 'standard holes (K_h = 1.0)'}, P_t = ${R.Pt} kip, ${F.Ns} slip plane${F.Ns > 1 ? 's' : ''}. Checked under Service II and during deck placement (constructibility). Fillers do not reduce slip resistance but must have the same faying surface class.` };
        if (X10) {
          c.note = `Flange slip force from the factored moment for slip divided by the flange-couple arm A (positive: bottom flange to mid-deck, A = ${f2(R.Apos)} in; negative and deck casting: between flange centroids, A = ${f2(R.Aneg)} in). Class ${B.cls} (K_s = ${f2(R.Ks)}), P_t = ${R.Pt} kip, ${F.Ns} slip planes; with inner and outer plates the slip force is shared equally by the two planes regardless of plate areas. Where P_s exceeds the slip resistance the excess moment is carried by the web (WS3), so the item is advisory rather than a failure.`;
          [...svs, con].forEach(cb => { const Ps = cb.Ps[key]; if (Ps == null) return; const r = Ps / F.slip;
            item(c, { loc: cb.id, dem: Ps, cap: F.slip, r, st: ge(F.slip, Ps) ? 'pass' : 'adv', unit: 'kip' }, () => ({ sym: 'P_{s}', eq: '\\frac{M_{s}}{A}', sub: `\\frac{${n2(cb.s10.Ms)}}{${n2(cb.s10.A)}} = ${n2(Ps)} ${lt(ge(F.slip, Ps))} nK_{h}K_{s}N_{s}P_{t} = ${n2(F.slip)}`, value: r,
              note: `Ratio P_s / slip resistance. M_s: see sp.${cb.id}.Ms; slip resistance: see sp.${key}.slip.${ge(F.slip, Ps) ? '' : ' The excess moment goes to the web (WS3).'}` })); });
          if (!c.items.length) c.naWhy = 'No slip combination loads this flange.'; add(c);
        } else {
          [...svs, con].forEach(cb => { const f = key === 'top' ? cb.ft : cb.fb, Ps = cb.Ps[key], r = Ps / F.slip;
            item(c, { loc: cb.id, dem: Ps, cap: F.slip, r, st: st(Ps, F.slip), unit: 'kip' }, () => ({ sym: 'P_{s}', eq: '\\frac{|f_{s}|}{R_{h}}A_{g}', sub: `\\frac{|${n2(f)}|}{${n2(R.Rh)}}(${n2(R.flg[key].Ag)}) = ${n2(Ps)} ${lt(ge(F.slip, Ps))} ${n2(F.slip)}`, value: r, note: `Ratio P_s / slip resistance; slip resistance: see sp.${key}.slip.` })); });
          add(c);
        }
      }
      {
        const c = { id: id + '4', grp, title: 'Splice plate resistance', ref: `${r6} 6.13.5.2, 6.13.6.1.3, 6.8.2`, items: [],
          note: F.inner ? (F.equal ? `The inner plates (${f2(F.Ai)} in²) are within 10% of the outer plate (${f2(F.Ao)} in²), so each carries half the flange force.` : `The inner plates (${f2(F.Ai)} in²) and outer plate (${f2(F.Ao)} in²) differ by more than 10%, so the flange force is divided in proportion to area.`) : 'Outer plate only.' };
        fcases.forEach(cb => { const Pf = cb.F[key].P, ten = cb.F[key].tension, both = cb.F[key].both;
          [['Outer', 'o'], ...(F.inner ? [['Inner (both)', 'i']] : [])].forEach(([pn, pk]) => {
            const Pp = F.inner ? (F.equal ? Pf / 2 : Pf * (pk === 'o' ? F.Ao : F.Ai) / F.Asp) : Pf, pr = F.plate[pk];
            const tm = [['gross yielding', pr.y, '\\phi_{y}F_{y}A_{g}', `0.95(${R.gP.Fy})(${n2(pr.A)})`], ['net fracture', pr.u, '\\phi_{u}F_{u}A_{n}', `0.80(${R.gP.Fu})(${n2(pr.An)})`]], cm = [['compression', pr.c, '\\phi_{c}F_{y}A_{s}', `0.95(${R.gP.Fy})(${n2(pr.A)})`]];
            const modes = both ? [...tm, ...cm] : ten ? tm : cm;
            modes.forEach(([mn, cap, eqs, subs]) => { const r = Pp / cap;
              item(c, { loc: `${cb.id}, ${pn}, ${mn}`, dem: Pp, cap, r, st: st(Pp, cap), unit: 'kip' }, () => ({ sym: '\\frac{P}{R_{r}}', eq: `\\frac{P}{${eqs}}`, sub: `\\frac{${n2(Pp)}}{${subs}} = \\frac{${n2(Pp)}}{${n2(cap)}}`, value: r,
                note: `P = ${F.inner ? (F.equal ? `${Psym === 'P_{fy}' ? 'P_fy' : 'P_fu'}/2 (plates within 10 % in area)` : `${Psym === 'P_{fy}' ? 'P_fy' : 'P_fu'} × A_plate/A_plates`) : 'the flange force'}; A_n = min(A_g − holes, 0.85A_g) (6.13.5.2): see sp.${key}.pl.${pk}.` })); });
          }); });
        add(c);
      }
      {
        const c = { id: id + '5', grp, title: 'Block shear rupture', ref: `${r6} 6.13.4`, items: [],
          note: `φ_bs = 0.80, R_p = ${f2(R.Rp)} (holes ${B.prep === 'drilled' ? 'drilled or subpunched and reamed' : 'punched full size'}), U_bs = 1.0. Each block runs from the end of the part to the last bolt row and is bounded by bolt lines (shear planes) or free edges; its demand is the share of the part force delivered by the bolts on or inside it. The flange cannot tear between the inner lines because the web is attached there. Checked only where the flange is in tension.` };
        fcases.forEach(cb => { const Pf = cb.F[key].P; if (!cb.F[key].tension) return;
          const Po = F.inner ? (F.equal ? Pf / 2 : Pf * F.Ao / F.Asp) : Pf, Pi = F.inner ? Pf - Po : 0;
          F.blk.forEach((b, bi) => { const Pp = b.force === 'flange' ? Pf : b.force === 'o' ? Po : Pi, Pd = Pp * b.share, r = Pd / b.Rr;
            item(c, { loc: `${cb.id}, ${b.part}, ${b.name}`, dem: Pd, cap: b.Rr, r, st: st(Pd, b.Rr), unit: 'kip' }, () => ({ sym: '\\frac{P}{R_{r}}', eq: '\\frac{sP_{part}}{\\phi_{bs}R_{p}\\min(0.58F_{u}A_{vn} + U_{bs}F_{u}A_{tn}, 0.58F_{y}A_{vg} + U_{bs}F_{u}A_{tn})}',
              sub: `\\frac{${n3(b.share)}(${n2(Pp)})}{0.80(${n2(R.Rp)})\\min(0.58(${b.Fu})(${n2(b.Anv)}) + ${b.Fu}(${n2(b.Atn)}), 0.58(${b.Fy})(${n2(b.Agv)}) + ${b.Fu}(${n2(b.Atn)}))} = \\frac{${n2(Pd)}}{${n2(b.Rr)}}`, value: r,
              note: `${b.planes} shear plane${b.planes > 1 ? 's' : ''}, L_v = ${n2(b.Lv)} in (end distance + pitches) each; A_tn across the last row. s = the share of the part force delivered by the bolts on or inside the block.` })); }); });
        if (!c.items.length) na(c, 'The flange is not in tension in either Strength I combination.'); else add(c);
      }
      {
        const c = { id: id + '6', grp, title: 'Fatigue, base metal at the bolted splice (Category B)', ref: `${ED} Art. 6.6.1.2, Table 6.6.1.2.3-1`, items: [],
          note: 'Fatigue I (infinite life). The flange stress range is computed at mid-thickness on the smaller section (short-term composite for positive, steel plus reinforcement for negative). The splice plate range is the flange range times the flange-to-plate area ratio.' };
        if (!R.fat) na(c, 'No fatigue moment range entered.');
        else { const fr = R.fat[key], pr = fr * R.flg[key].Ag / F.Asp;
          [['Flange (gross section)', fr, 'f'], ['Splice plates', pr, 'p']].forEach(([pn, v, t]) => item(c, { loc: pn, dem: v, cap: 16, r: v / 16, st: st(v, 16), unit: 'ksi' }, () => ({ sym: '\\frac{\\gamma(\\Delta f)}{(\\Delta F)_{TH}}', eq: '', sub: t === 'f' ? `\\frac{${n2(v)}}{16.00}` : `\\frac{${n2(fr)}(${n2(R.flg[key].Ag)})/${n2(F.Asp)}}{16.00}`, value: v / 16, note: `γ(Δf) of the flange: see sp.fat.${key}.` })));
          add(c); }
      }
    });

    /* ---- flange-couple moment transfer (10th Ed.) ---- */
    {
      const c = { id: 'MT1', grp: 'Moment transfer', title: 'Moment resistance of the flange splices', ref: `${ED} Art. 6.13.6.1.3b, C6.13.6.1.3b; NSBA Bolted Field Splices (2021) 2.1.1.2`, items: [],
        note: `Where M_u exceeds M_r the web splice is designed for the excess moment as a horizontal force H_w = (M_u − M_r)/A_w acting at mid-depth of the web, together with the factored shear resistance of the web (WS1). A_w is ${f2(R.AwPos)} in (web mid-depth to mid-deck) in positive flexure and web mid-depth to the flange with spare capacity in negative flexure. ${R.usePrs ? `The deck reinforcement is included in negative flexure, P_rs = F_yr A_r = ${f2(R.Prs)} kip.` : 'The deck reinforcement is not included in negative flexure (conservative).'} An item above 1.00 is advisory: it transfers load to the web rather than failing the splice.` };
      if (!X10) { na(c, 'Not part of the 8th Edition method (select the 10th Edition).'); }
      else { [...strs, con].forEach(cb => { const m = cb.m10, r = m.Mu / m.Mr;
        item(c, { loc: cb.id + (m.basis === 'pos' ? ', positive' : m.basis === 'neg' ? ', negative' : ', noncomposite'), dem: m.Mu / 12, cap: m.Mr / 12, r, st: ge(m.Mr, m.Mu) ? 'pass' : 'adv', unit: 'kip-ft', Hw: m.Hw }, () => ({ ...ratio(m.Mu / 12, m.Mr / 12, 'M_{u}', 'M_{r}', 1),
          note: `M_u: see sp.${cb.id}.M; M_r: see sp.Mr.${m.basis}${m.ex > 0 ? `; H_w = (M_u − M_r)(12)/A_w = (${n2(m.Mu / 12)} − ${n2(m.Mr / 12)})(12)/${n2(m.Aw)} = ${n2(m.Hw)} kip to the web` : ''}.` })); });
        add(c); }
    }
    /* ---- web splice ---- */
    {
      const W = R.web, grp = 'Web splice';
      {
        const c = { id: 'WS1', grp, title: 'Web bolt shear, critical bolt', ref: `${r6} 6.13.6.1.4b, 6.13.6.1.3c, 6.13.2.7`, items: [],
          note: `Elastic vector method, ${W.nw} bolts per side (${W.nrw} rows × ${W.ncw} columns), double shear through two web plates. Eccentricity e = gap/2 + distance to the group centroid = ${f2(R.gap / 2)} + ${f2(W.xbar)} = ${f2(W.e)} in. I_p = Σ(x² + y²) = ${f2(W.Ip)} in². ${W.redW < 1 ? 'The 0.83 long-joint reduction is applied to the web bolts.' : 'The 0.83 long-joint reduction is not applied to web bolts (setting).'}` };
        strs.forEach(cb => { const wb = cb.wb, r = wb.R / W.phRw;
          item(c, { loc: cb.id, dem: wb.R, cap: W.phRw, r, st: st(wb.R, W.phRw), unit: 'kip' }, () => ({ ...ratio(wb.R, W.phRw, 'R_{u}', '\\phi_{s}R_{n}'), note: `R_u of the critical bolt: see sp.${cb.id}.wb.R; φ_sR_n: see sp.web.phRw.` })); });
        add(c);
      }
      {
        const c = { id: 'WS2', grp, title: 'Web bolt bearing, critical bolt', ref: `${r6} 6.13.2.9`, items: [],
          note: `Because the resultant direction varies, L_c is conservatively the smallest clear distance around the critical bolt: web ${f2(W.LcW)} in, plates ${f2(W.LcP)} in.` };
        strs.forEach(cb => { const cap = Math.min(W.brgW, W.brgP), r = cb.wb.R / cap;
          item(c, { loc: cb.id, dem: cb.wb.R, cap, r, st: st(cb.wb.R, cap), unit: 'kip' }, () => ({ ...ratio(cb.wb.R, cap, 'R_{u}', '\\min(\\phi_{bb}R_{n,web}, \\phi_{bb}R_{n,pl})'), note: `Bearing per bolt: see sp.web.brgW, sp.web.brgP.` })); });
        add(c);
      }
      {
        const c = { id: 'WS3', grp, title: 'Web bolt slip, critical bolt', ref: `${r6} 6.13.6.1.4b, 6.13.2.8`, items: [],
          note: X10 ? `Service II and deck-casting shear V_s on the web bolts, plus H_s where the factored moment for slip exceeds the slip moment resistance of the flange splices (TF3, BF3). ${R.eV ? 'The eccentricity moment is included.' : 'The eccentricity moment is neglected for slip because slip must occur on both sides of the splice at once (NSBA 2.1.2).'}` : 'Service II and deck placement stresses and shear, including the eccentricity moment, applied to the same bolt group.' };
        R.combos.filter(k => k.type !== 'str').forEach(cb => { const wb = cb.wb, r = wb.R / W.slipW;
          item(c, { loc: cb.id, dem: wb.R, cap: W.slipW, r, st: st(wb.R, W.slipW), unit: 'kip' }, () => ({ ...ratio(wb.R, W.slipW, 'R_{s}', 'K_{h}K_{s}N_{s}P_{t}'), note: `R_s of the critical bolt: see sp.${cb.id}.wb.R; slip resistance per bolt: see sp.web.slipW.` })); });
        add(c);
      }
      {
        const c = { id: 'WS4', grp, title: 'Web splice plates, shear', ref: `${r6} 6.13.5.3`, items: [],
          note: `Two plates, ${frac(W.hw)} × ${frac(W.twp)} in. A_vg = ${f2(W.Awp)} in², A_vn = 2(h − n_r(d_h + 1/16))t = ${f2(W.Avn)} in².` };
        strs.forEach(cb => [['shear yielding', W.Vy, 'Vy'], ['shear rupture', W.Vr, 'Vr']].forEach(([mn, cap, sid]) => { const r = cb.Vuw / cap;
          item(c, { loc: `${cb.id}, ${mn}`, dem: cb.Vuw, cap, r, st: st(cb.Vuw, cap), unit: 'kip' }, () => ({ ...ratio(cb.Vuw, cap, X10 ? 'V_{r}' : 'V_{uw}', sid === 'Vy' ? '\\phi_{v}0.58F_{y}A_{vg}' : '\\phi_{vu}0.58F_{u}A_{vn}'), note: `See sp.web.${sid}; ${X10 ? 'V_r: see sp.Vr' : 'V_uw: see sp.' + cb.id + '.Vuw'}.` })); }));
        add(c);
      }
      {
        const c = { id: 'WS5', grp, title: 'Web splice plates, flexure', ref: `${r6} 6.13.6.1.4b`, items: [],
          note: `S_pl = 2th²/6 = ${f2(W.Swp)} in³ and A_pl = ${f2(W.Awp)} in² for both plates, gross section at the splice centerline.` };
        if (X10) { c.title = 'Web splice plates, axial force from H_w'; c.ref = `${r6} 6.13.6.1.3c, 6.13.5.2`;
          c.note = `A_pl = ${f2(W.Awp)} in² for both plates. H_w acts at mid-depth of the web, so the plates see a uniform stress; φ_c = 0.90 covers both tension and compression.`;
          strs.filter(k => k.Huw > 0).forEach(cb => { const f = cb.Huw / W.Awp, cap = PHI.c * R.gP.Fy, r = f / cap;
            item(c, { loc: cb.id, dem: f, cap, r, st: st(f, cap), unit: 'ksi' }, () => ({ sym: '\\frac{f}{\\phi_{c}F_{y}}', eq: '\\frac{H_{w}/A_{pl}}{\\phi_{c}F_{y}}', sub: `\\frac{${n2(cb.Huw)}/${n2(W.Awp)}}{0.90(${R.gP.Fy})} = \\frac{${n2(f)}}{${n2(cap)}}`, value: r })); });
          if (!c.items.length) na(c, 'The flange splices carry the full factored moment (MT1), so the web plates carry no horizontal force.'); else add(c);
        } else {
          strs.forEach(cb => { const f = cb.Muw / W.Swp + Math.abs(cb.Huw) / W.Awp, cap = PHI.f * R.gP.Fy, r = f / cap;
            item(c, { loc: cb.id, dem: f, cap, r, st: st(f, cap), unit: 'ksi' }, () => ({ sym: '\\frac{f}{\\phi_{f}F_{y}}', eq: '\\frac{M_{uw}/S_{pl} + |H_{uw}|/A_{pl}}{\\phi_{f}F_{y}}', sub: `\\frac{${n2(cb.Muw)}/${n2(W.Swp)} + ${n2(Math.abs(cb.Huw))}/${n2(W.Awp)}}{${n2(cap)}} = \\frac{${n2(f)}}{${n2(cap)}}`, value: r })); });
          add(c); }
      }
    }

    /* ---- detailing ---- */
    {
      const grp = 'Detailing', d = R.bolt.d, W = R.web, em = R.emin;
      const simple = (c, loc, it, sym, sub, val) => item(c, { loc, ...it }, () => ({ sym, eq: '', sub, value: val !== undefined ? val : (it.st === 'pass' ? 'OK' : it.st === 'fail' ? 'NG' : it.st), unit: '', d: 2 }));
      {
        const c = { id: 'DT1', grp, title: 'Minimum bolt spacing', ref: `${r6} 6.13.2.6.1`, items: [] };
        const add1 = (loc, v) => simple(c, loc, { dem: 3 * d, cap: v, r: 3 * d / v, st: ge(v, 3 * d) ? 'pass' : 'fail', unit: 'in' }, 's \\ge 3d', `${n2(v)} ${ge(v, 3 * d) ? '\\ge' : '\\lt'} 3(${n3(d)}) = ${n2(3 * d)}`);
        ['top', 'bot'].forEach(k => { const F = R.fl[k], n = k === 'top' ? 'Top' : 'Bottom'; if (F.nr > 1) add1(`${n} flange pitch s`, F.s); if (F.nl > 1) add1(`${n} flange gage g`, F.g); add1(`${n} flange gage across web, 2g₀`, 2 * F.g0); });
        if (W.nrw > 1) add1('Web vertical pitch', W.sv); if (W.ncw > 1) add1('Web horizontal pitch', W.sh);
        add(c);
      }
      {
        const c = { id: 'DT2', grp, title: 'Maximum spacing for sealing', ref: `${r6} 6.13.2.6.2`, items: [],
          note: 't is the thickness of the thinner outside plate: on a flange with inner plates, the thinner of the outer and inner plates, since the flange is between two outside plates. Applies to bolt lines adjacent to a free edge of an outside plate.' };
        const add2 = (loc, t, s) => { const mx = Math.min(4 + 4 * t, 7); simple(c, loc, { dem: s, cap: mx, r: s / mx, st: ge(mx, s) ? 'pass' : 'fail', unit: 'in' }, 's \\le \\min(4.0 + 4.0t, 7.0)', `${n2(s)} ${lt(ge(mx, s))} \\min(4.0 + 4.0(${n3(t)}), 7.0) = ${n2(mx)}`); };
        ['top', 'bot'].forEach(k => { const F = R.fl[k]; if (F.nr > 1) add2(`${k === 'top' ? 'Top' : 'Bottom'} flange edge lines (thinner of outer and inner plates)`, F.inner ? Math.min(F.to, F.ti) : F.to, F.s); });
        if (W.nrw > 1) add2('Web plate, column at plate end', W.twp, W.sv); if (W.ncw > 1) add2('Web plate, row at plate top/bottom', W.twp, W.sh);
        if (!c.items.length) na(c, 'Single bolts only; no spacing to check.'); else add(c);
      }
      {
        const c = { id: 'DT3', grp, title: 'Edge distances', ref: `${r6} 6.13.2.6.6, Table 6.13.2.6.6-1`, items: [],
          note: `Minimum ${f2(em)} in for a ${frac(d)} in bolt with ${R.P.bolts.edge === 'cut' ? 'rolled or gas-cut' : 'sheared'} edges${R.rOv ? ` (owner: ${E.cite(R.rOv)})` : ''}. The maximum edge distance (8t ≤ 5.0 in, t = thinnest outside plate) is a sealing requirement for plates in contact, so it is applied to the splice plates; the flange edges are checked for the minimum only.` };
        const add3 = (loc, e, t, minOnly) => { const mx = minOnly ? Infinity : Math.min(8 * t, 5), ok = ge(e, em) && ge(mx, e);
          simple(c, loc, { dem: e, cap: em, r: minOnly ? em / e : Math.max(em / e, e / mx), st: ok ? 'pass' : 'fail', unit: 'in' }, minOnly ? 'e \\ge e_{min}' : 'e_{min} \\le e \\le \\min(8t, 5.0)', minOnly ? `${n2(e)} ${ge(e, em) ? '\\ge' : '\\lt'} ${n2(em)}` : `${n2(em)} ${ge(e, em) ? '\\le' : '\\gt'} ${n2(e)} ${lt(ge(mx, e))} \\min(8(${n3(t)}), 5.0) = ${n2(mx)}`); };
        ['top', 'bot'].forEach(k => { const F = R.fl[k], n = k === 'top' ? 'Top' : 'Bottom';
          add3(`${n} flange, left`, F.bL / 2 - F.yOut, F.tL, true); add3(`${n} flange, right`, F.bR / 2 - F.yOut, F.tR, true); add3(`${n} outer plate`, F.eo, F.to);
          if (F.inner) { add3(`${n} inner plate, web side`, F.g0 - F.yiI, F.ti); add3(`${n} inner plate, outside`, F.yiO - F.yOut, F.ti); } });
        add3('Web plates, top and bottom', W.ev, W.twp);
        add(c);
      }
      {
        const c = { id: 'DT4', grp, title: 'End distances', ref: `${r6} 6.13.2.6.5`, items: [] };
        const add4 = (loc, e) => simple(c, loc, { dem: e, cap: em, r: em / e, st: ge(e, em) ? 'pass' : 'fail', unit: 'in' }, 'e \\ge e_{min}', `${n2(e)} ${ge(e, em) ? '\\ge' : '\\lt'} ${n2(em)}`);
        ['top', 'bot'].forEach(k => { const F = R.fl[k], n = k === 'top' ? 'Top' : 'Bottom'; add4(`${n} flange end at splice`, F.ef); add4(`${n} splice plate ends`, F.ep); });
        add4('Web end at splice', W.ew); add4('Web plate ends', W.ewp);
        add(c);
      }
      {
        const c = { id: 'DT5', grp, title: 'Plate fit and clearances', ref: 'Practice (detailing)', items: [],
          note: `Inner flange plates are placed flush with the edge of the narrower flange. Clearance to the web face and web splice plate ≥ ${f2(num(R.P.clr.cw))} in; web plate clear of each flange ≥ ${f2(num(R.P.clr.cv))} in (for the flange-to-web weld).` };
        const add5 = (loc, v, lim, le, st0 = 'warn') => { const ok = le ? ge(lim, v) : ge(v, lim); simple(c, loc, { dem: v, cap: lim, st: ok ? 'pass' : st0, unit: 'in' }, le ? 'v \\le \\text{limit}' : 'v \\ge \\text{limit}', `${n2(v)} ${ok ? (le ? '\\le' : '\\ge') : (le ? '\\gt' : '\\lt')} ${n2(lim)}`); };
        ['top', 'bot'].forEach(k => { const F = R.fl[k], n = k === 'top' ? 'Top' : 'Bottom';
          add5(`${n} outer plate width vs. narrower flange`, F.bo, F.bmin, true, 'fail');
          if (F.inner) add5(`${n} inner plate clearance to web plate`, F.yiI - R.tw / 2 - W.twp, num(R.P.clr.cw), false); });
        add5('Web plate depth vs. D − 2 × clearance', W.hw, R.D - 2 * num(R.P.clr.cv), true);
        add5('Web bolt rows fit the plate (edge ≥ min.)', W.ev, R.emin, false, 'fail');
        { const rG = R.rOv; if (rG) add5(`Gap between the girder ends (${E.cite(rG)})`, R.gap, rG.value.gap, true, 'fail'); }   // OWN25
        add(c);
      }
      {
        const c = { id: 'DT6', grp, title: 'Minimum number of bolt rows', ref: `${r6} 6.13.6.1.3a`, items: [],
          note: 'Rows are counted along the line of force: bolt rows along the girder in each flange splice, and vertical bolt columns in the web splice.' };
        [['Top flange splice', R.fl.top.nr], ['Bottom flange splice', R.fl.bot.nr], ['Web splice (columns)', W.ncw]].forEach(([p, nr]) => simple(c, p, { dem: 2, cap: nr, st: nr >= 2 ? 'pass' : 'fail' }, 'n \\ge 2', `${nr} ${nr >= 2 ? '\\ge' : '\\lt'} 2`));
        add(c);
      }
      {
        const rOv7 = R.rOv, tmin = rOv7 ? rOv7.value.tp : 0.3125, c = { id: 'DT7', grp, title: 'Minimum plate thickness', ref: rOv7 ? `${r6} 6.7.3; ${E.cite(rOv7)}` : `${r6} 6.7.3`, items: [],
          note: 'Structural steel plates, including splice plates and fillers developed as part of the connection, not less than 5/16 in. Fillers thinner than 5/16 in are permitted and are not checked here.' };
        const add7 = (loc, t) => simple(c, loc, { dem: tmin, cap: t, st: ge(t, tmin) ? 'pass' : 'fail', r: tmin / t, unit: 'in' }, 't \\ge t_{min}', `${n3(t)} ${ge(t, tmin) ? '\\ge' : '\\lt'} ${n3(tmin)}`);
        ['top', 'bot'].forEach(k => { const F = R.fl[k], nm = k === 'top' ? 'Top' : 'Bottom';
          add7(`${nm} flange, outer plate`, F.to); if (F.inner) add7(`${nm} flange, inner plates`, F.ti); });
        add7('Web splice plates', W.twp);
        add(c);
      }
      {
        const c = { id: 'DT8', grp, title: 'Splice plate area vs. connected area', ref: `${ED} Table 6.6.1.2.3-1 (Condition 2.1), Art. 6.13.6.1.3`, items: [],
          note: 'The base metal adjacent to a slip-critical connection is Category B on the gross section. Where the splice plates have less area than the part they connect, the stress range in the plates governs; this is a warning that the fatigue checks (TF6, BF6) must be satisfied, not a failure.' };
        ['top', 'bot'].forEach(k => { const F = R.fl[k], Ac = Math.min(F.bL * F.tL, F.bR * F.tR), nm = k === 'top' ? 'Top flange' : 'Bottom flange';
          simple(c, nm, { dem: Ac, cap: F.Asp, st: ge(F.Asp, Ac) ? 'pass' : 'warn', r: Ac / F.Asp, unit: 'in²' }, 'A_{plates} \\ge A_{connected}', `${n2(F.Asp)} ${ge(F.Asp, Ac) ? '\\ge' : '\\lt'} ${n2(Ac)}`); });
        const Aw = R.D * R.tw; simple(c, 'Web', { dem: Aw, cap: W.Awp, st: ge(W.Awp, Aw) ? 'pass' : 'warn', r: Aw / W.Awp, unit: 'in²' }, 'A_{plates} \\ge Dt_{w}', `2(${n2(W.hw)})(${n3(W.twp)}) = ${n2(W.Awp)} ${ge(W.Awp, Aw) ? '\\ge' : '\\lt'} ${n2(Aw)}`);
        add(c);
      }
      const tw = Math.max(R.secL.tw, R.secR.tw), Bo = R.P.bolts, C1 = parseDim(Bo.c1) > 0 ? parseDim(Bo.c1) : (C1TBL[Bo.d] || 1.5);
      {
        const req = Bo.stitch !== 'adv', c = { id: 'DT9', grp, title: 'Maximum pitch and gage for stitch bolts', ref: `${r6} 6.13.2.6.3`, items: [],
          note: `t is the thinner outside plate. The splice plates are taken to act in compression (the flange splices are designed for P_fy in tension and compression, and the web plates carry the compressive part of the flange force transferred to the web). ${req ? 'Required.' : 'Shown as advisory (setting).'} The end-pitch rule for compression members (6.13.2.6.4) applies to built-up members and is not applied to splices.` };
        const add9 = (loc, t, v, k) => { const mx = k * t, ok = ge(mx, v); simple(c, loc, { dem: v, cap: mx, r: v / mx, st: ok ? 'pass' : (req ? 'fail' : 'adv'), unit: 'in' }, `s \\le ${k}.0t`, `${n2(v)} ${lt(ok)} ${k}.0(${n3(t)}) = ${n2(mx)}`); };
        ['top', 'bot'].forEach(k => { const F = R.fl[k], n = k === 'top' ? 'Top flange' : 'Bottom flange', t = F.inner ? Math.min(F.to, F.ti) : F.to;
          if (F.nr > 1) add9(`${n}, pitch along the force`, t, F.s, 12);
          if (F.nl > 1) add9(`${n}, gage between lines each side of the web`, t, F.g, 24);
          add9(`${n}, gage across the web (outer plate)`, F.to, 2 * F.g0, 24); });
        if (W.nrw > 1) add9('Web plates, vertical pitch', W.twp, W.sv, 12); if (W.ncw > 1) add9('Web plates, horizontal pitch', W.twp, W.sh, 12);
        add(c);
      }
      {
        const nmin = Math.max(1, Math.round(parseDim(Bo.minLines) || 1)), c = { id: 'DT10', grp, title: 'Minimum bolt lines each side of the web', ref: 'Owner / office practice', items: [],
          note: 'AASHTO LRFD requires at least two rows along the force (DT6) but no minimum number of gage lines; this is the owner or office minimum (Bolts setting). Staggered holes are not used.' };
        ['top', 'bot'].forEach(k => { const F = R.fl[k]; simple(c, k === 'top' ? 'Top flange' : 'Bottom flange', { dem: nmin, cap: F.nl, r: nmin / F.nl, st: F.nl >= nmin ? 'pass' : 'fail' }, 'n \\ge n_{min}', `${F.nl} ${F.nl >= nmin ? '\\ge' : '\\lt'} ${nmin}`); });
        add(c);
      }
      {
        const c = { id: 'DT11', grp, title: 'Wrench clearance for tightening', ref: 'AISC Manual Table 7-16 (tightening clearance C₁)', items: [],
          note: `C₁ is the clearance from the bolt centerline to an adjacent surface needed to tighten the nut (${parseDim(Bo.c1) > 0 ? 'entered' : `default for a ${frac(parseDim(Bo.d))} in bolt; confirm with the AISC Manual Table 7-16 and the fabricator's equipment`}). Flange bolts are checked against the face of the web splice plate; the web bolts nearest the flanges against the face of the flange splice plate.` };
        const add11 = (loc, v) => simple(c, loc, { dem: C1, cap: v, r: C1 / v, st: ge(v, C1) ? 'pass' : 'fail', unit: 'in' }, 'c \\ge C_{1}', `${n2(v)} ${ge(v, C1) ? '\\ge' : '\\lt'} ${n2(C1)}`);
        ['top', 'bot'].forEach(k => { const F = R.fl[k]; add11(`${k === 'top' ? 'Top' : 'Bottom'} flange, line nearest the web`, F.g0 - tw / 2 - W.twp); });
        const cv = parseDim(R.P.clr.cv); ['top', 'bot'].forEach(k => { const F = R.fl[k]; add11(`Web, bolt row nearest the ${k === 'top' ? 'top' : 'bottom'} flange`, cv + W.ev - (F.inner ? F.ti : 0)); });
        add(c);
      }
    }
    { const ct = spCtNarrow(R); if (ct) out.filter(c => ['DT3', 'DT4', 'DT7', 'DT10'].includes(c.id) && c.status === 'fail').forEach(c => { c.note = `${ct.msg}${c.note ? ' ' + c.note : ''}`; c.ctN = 1; }); }   // GD62 (display only)
    Object.defineProperty(out, 'steps', { value: wantSt ? w.steps : [], enumerable: false });
    return out;
  }

  /* ---------- steps(R): the worked values of compute() (ids sp.*) ---------- */
  function steps(R) {
    const w = St().work('sp'), n2 = x => St().n(x, 2), n3 = x => St().n(x, 3), n4 = x => St().n(x, 4), g0 = x => St().g(x, 0), pa = x => `(${n2(x)})`;
    const X10 = R.code === '10', s = R.sec.s, sm = R.sm, side = R.smSide === 'L' ? 'left' : 'right';
    w.add({ id: 'Is', label: 'Smaller section: the side with the smaller steel moment of inertia (design forces on it)', sym: 'I_{s}', eq: '\\min(I_{left}, I_{right})', sub: `\\min(${g0(R.pL.I)}, ${g0(R.pR.I)})`, value: s.I, unit: 'in^{4}', d: 0, ref: `${ED} Art. 6.13.6.1.1`, note: `The ${side} side: ${n2(sm.topB)} × ${n3(sm.topT)} top, ${n2(R.D)} × ${n4(sm.tw)} web, ${n2(sm.botB)} × ${n3(sm.botT)} bottom; ȳ = ${n3(s.yb)} in from the bottom of the steel.` });
    w.add({ id: 'n', label: 'Modular ratio', sym: 'n', eq: '\\frac{E_{s}}{E_{c}} = \\frac{29{,}000}{120{,}000K_{1}w_{c}^{2}f\\prime_{c}^{0.33}}', sub: `\\frac{29{,}000}{120{,}000(${n2(R.MR.K1)})(${n3(R.MR.wc)})^{2}(${n2(R.MR.fc)})^{0.33}}`, value: R.MR.n, unit: '', d: 3, ref: `${ED} Eq. 5.4.2.4-1, Art. 6.10.1.1.1b`, note: R.MR.rule === 'round' ? `Rounded from ${n3(R.MR.n0)}.` : '' });
    [['c3', 'Long-term composite (3n)', 'b_{eff}t_{s}/3n'], ['cn', 'Short-term composite (n)', 'b_{eff}t_{s}/n']].forEach(([k, t, a]) => { const q = R.sec[k];
      w.add({ id: `I.${k}`, label: `${t}: moment of inertia (deck ${a} at mid-slab, ${n2(q.add.y)} in above the bottom of the steel${R.hh !== R.hh0 ? '; haunch 0 by the owner rule' : ''})`, sym: `I_{${k === 'c3' ? '3n' : 'n'}}`, eq: 'I_{s} + A_{s}(\\bar{y} - \\bar{y}_{s})^{2} + I_{0} + A(y - \\bar{y})^{2}', sub: `\\bar{y} = ${n3(q.yb)}`, value: q.I, unit: 'in^{4}', d: 0, ref: `${ED} Art. 6.10.1.1.1b` }); });
    w.add({ id: 'I.r', label: R.sec.r.add ? `Steel + longitudinal deck reinforcement (A_r = ${n2(R.sec.r.add.A)} in² at ${n2(R.sec.r.add.y)} in)` : 'Steel + reinforcement: no reinforcement entered (steel section)', sym: 'I_{r}', eq: '', sub: `\\bar{y} = ${n3(R.sec.r.yb)}`, value: R.sec.r.I, unit: 'in^{4}', d: 0, ref: `${ED} Art. 6.10.1.1.1c` });
    w.add({ id: 'y', label: 'Stress points: mid-thickness of the flanges of the smaller section', sym: 'y_{T},\\ y_{B}', eq: 'd - t_{ft}/2,\\ t_{fb}/2', sub: `${n3(R.yT)},\\ ${n3(R.yB)}`, value: R.yT, unit: 'in', d: 3, ref: `${ED} Art. 6.13.6.1.3` });
    Object.entries(R.comp).forEach(([k, c]) => { if (c.M === 0) return; const q = R.sec[c.sec];
      w.add({ id: `f.${k}`, label: `Flange stresses from ${c.lbl.replace(/[{}\\_^]/g, '')} = ${n2(c.M)} kip-ft on the ${q.name.toLowerCase()} (tension +)`, sym: 'f_{T},\\ f_{B}', eq: '-\\frac{12M(y - \\bar{y})}{I}', sub: `-\\frac{12${pa(c.M)}(${n3(R.yT)} - ${n3(q.yb)})}{${g0(q.I)}},\\ -\\frac{12${pa(c.M)}(${n3(R.yB)} - ${n3(q.yb)})}{${g0(q.I)}}`, value: c.f.top, unit: 'ksi', d: 2, ref: `${ED} Art. 6.10.1.1.1`, note: `f_B = ${n2(c.f.bot)} ksi.` }); });
    if (R.plAdj.length) R.plAdj.forEach(q => w.add({ id: `pl.${q.k}`, label: `${q.k}: the owner's LL multiplier m = ${n2(R.env.lf.m)} not on the pedestrian part (it is applied to the whole by the load factor)`, sym: q.k, eq: 'v_{0} - q + q/m', sub: `${n2(q.v0)} - ${n2(q.q)} + ${n2(q.q)}/${n2(R.env.lf.m)}`, value: q.v, unit: q.k[0] === 'M' ? 'kip-ft' : 'kip', d: 2, ref: R.env.cite(R.env.rule('ld.mult')) || 'Owner rule' }));
    R.combos.forEach(c => {
      const gl = c.terms.map(t => `${n3(t.g)}${pa(t.M)}`).join(' + ') || '0';
      w.add({ id: `${c.id}.M`, label: `${c.name}: factored moment`, sym: `M_{${c.id}}`, eq: '\\sum \\gamma_{i}M_{i}', sub: gl, value: c.M, unit: 'kip-ft', d: 1, ref: c.type === 'con' ? `${ED} Art. 3.4.2.1` : `${ED} Table 3.4.1-1, 3.4.1-2`, note: `Load factors × the owner's η and m (${n3(R.gO('dcMax'))}, ${n3(R.gO('dcMin'))}, LL ${n3(R.gO(c.type === 'sv' ? 'llSv' : 'llS'))}); f_T = ${n2(c.ft)}, f_B = ${n2(c.fb)} ksi.` });
      const P_ = R.P, Vk = k => num(P_.dem[k]);
      w.add({ id: `${c.id}.V`, label: `${c.name}: factored shear`, sym: `V_{${c.id}}`, eq: c.type === 'str' ? '\\gamma_{DC}(V_{DC1} + V_{DC2}) + \\gamma_{DW}V_{DW} + \\gamma_{LL}V_{LL}' : c.type === 'sv' ? 'V_{DC1} + V_{DC2} + V_{DW} + \\gamma_{LL}V_{LL}' : '\\gamma_{DC}V_{DC1} + \\gamma_{CL}V_{CL}',
        sub: c.type === 'str' ? `${n3(R.g('dcMax'))}(${n2(Vk('VDC1'))} + ${n2(Vk('VDC2'))}) + ${n3(R.g('dwMax'))}(${n2(Vk('VDW'))}) + ${n3(R.g('llS'))}(${n2(Vk('VLL'))})` : c.type === 'sv' ? `${n2(Vk('VDC1'))} + ${n2(Vk('VDC2'))} + ${n2(Vk('VDW'))} + ${n3(R.g('llSv'))}(${n2(Vk('VLL'))})` : `${n3(R.g('dc1C'))}(${n2(Vk('VDC1'))}) + ${n3(R.g('clC'))}(${n2(Vk('VCL'))})`,
        value: c.V, unit: 'kip', d: 2, ref: `${ED} Table 3.4.1-1`, note: c.vUt ? `Includes the utilities ${n2(c.vUt.a)}(${n2(c.vUt.vT)}) + ${n2(c.vUt.b)}(${n2(c.vUt.vF)}).` : (R.plAdj.some(q => q.k === 'VLL') ? 'V_LL: see sp.pl.VLL.' : '') });
    });
    const vx = R.vnExpr;
    w.add({ id: 'Vn', label: `Nominal shear resistance of the smaller web (${R.P.sec.web === 'stiffened' && !vx.over3D ? `stiffened, d_o = ${n2(num(R.P.sec.do))} in` : 'unstiffened'}${vx.over3D ? ', d_o > 3D treated as unstiffened (6.10.9.1)' : ''})`, sym: 'V_{n}', eq: vx.eq === '6.10.9.2-1' ? 'CV_{p}' : vx.eq === '6.10.9.3.2-2' ? 'V_{p}(C + \\frac{0.87(1 - C)}{\\sqrt{1 + (d_{o}/D)^{2}}})' : 'V_{p}(C + \\frac{0.87(1 - C)}{\\sqrt{1 + (d_{o}/D)^{2}} + d_{o}/D})',
      sub: vx.eq === '6.10.9.2-1' ? `${n4(vx.C)}(${n2(vx.Vp)})` : `${n2(vx.Vp)}(${n4(vx.C)} + \\frac{0.87(1 - ${n4(vx.C)})}{\\sqrt{1 + ${n3(vx.dD)}^{2}}${vx.eq === '6.10.9.3.2-8' ? ` + ${n3(vx.dD)}` : ''}})`, value: R.Vn, unit: 'kip', d: 2, ref: `${ED} Eq. ${vx.eq}`,
      note: `k = ${n3(vx.k)}, D/t_w = ${n2(R.lam)}, C = ${n4(vx.C)} (Eq. 6.10.9.3.2-4 to -6), V_p = 0.58F_ywDt_w = 0.58(${R.gW.Fy})(${n2(R.D)})(${n4(R.tw)}) = ${n2(vx.Vp)} kip.` });
    w.add({ id: 'Vr', label: 'Factored shear resistance of the smaller web', sym: 'V_{r}', eq: '\\phi_{v}V_{n}', sub: `1.0(${n2(R.Vn)})`, value: R.phVn, unit: 'kip', d: 2, ref: X10 ? `${ED} Art. 6.13.6.1.3c, 6.10.9.1` : `${ED} Art. 6.10.9.1` });
    if (X10) {
      ['top', 'bot'].forEach(k => { const q = R.Pfy[k], nh = k === 'top' ? 2 * R.fl.top.nl : 2 * R.fl.bot.nl;
        w.add({ id: `${k}.An`, label: `${k === 'top' ? 'Top' : 'Bottom'} flange, ${q.side === 'L' ? 'left' : 'right'} side (the smaller P_fy): net area, ${nh} holes of d_h + 1/16 in`, sym: 'A_{n}', eq: 'b_{f}t_{f} - n_{h}(d_{h} + 0.0625)t_{f}', sub: `${n2(q.b)}(${n3(q.t)}) - ${nh}(${n4(R.dn)})(${n3(q.t)})`, value: q.An, unit: 'in^{2}', d: 3, ref: `${ED} Art. 6.8.3` });
        w.add({ id: `${k}.Ae`, label: 'Effective flange area', sym: 'A_{e}', eq: '\\frac{\\phi_{u}F_{u}}{\\phi_{y}F_{yf}}A_{n} \\le A_{g}', sub: `\\frac{0.80(${R.Fu})}{0.95(${R.Fy})}(${n3(q.An)}) = ${n3(q.Ae0)} \\le ${n3(q.Ag)}`, value: q.Ae, unit: 'in^{2}', d: 3, ref: `${ED} Eq. 6.13.6.1.3b-2` });
        w.add({ id: `${k}.Pfy`, label: `Design yield resistance of the ${k === 'top' ? 'top' : 'bottom'} flange (the smaller of the two sides: left ${n2(q.L.P)}, right ${n2(q.R.P)})`, sym: 'P_{fy}', eq: 'F_{yf}A_{e}', sub: `${R.Fy}(${n3(q.Ae)})`, value: q.P, unit: 'kip', d: 2, ref: `${ED} Eq. 6.13.6.1.3b-1` }); });
      w.add({ id: 'Mr.pos', label: 'Moment resistance of the flange splices, positive flexure: bottom flange P_fy to mid-deck', sym: 'M_{r}^{+}', eq: 'P_{fy,bot}A,\\ A = \\frac{t_{bf}}{2} + D + t_{tf} + t_{h} + \\frac{t_{s}}{2}', sub: `${n2(R.Pfy.bot.P)}(${n3(R.Apos)})/12`, value: R.mPos.Mr / 12, unit: 'kip-ft', d: 1, ref: `${ED} Art. 6.13.6.1.3b, C6.13.6.1.3b`, note: `A_w = D/2 + t_tf + t_h + t_s/2 = ${n3(R.AwPos)} in (H_w lever arm).` });
      [['neg', R.mNeg, 'negative flexure'], ['nc', R.mNc, 'deck casting (noncomposite)']].forEach(([b, m, t]) => w.add({ id: `Mr.${b}`, label: `Moment resistance of the flange splices, ${t}: the couple of the top${b === 'neg' && R.usePrs ? ' flange + deck reinforcement' : ' flange'} (tension) and the bottom flange (compression), governed by the ${m.gov}`, sym: 'M_{r}^{-}',
        eq: m.scaled ? '\\frac{C}{T}\\sum Ty' : '\\sum Ty', sub: m.scaled ? `\\frac{${n2(R.Pfy.bot.P)}}{${n2(R.Pfy.top.P + (b === 'neg' ? R.Prs : 0))}}(${n2(m.MT)})/12` : `${n2(m.MT)}/12`, value: m.Mr / 12, unit: 'kip-ft', d: 1, ref: `${ED} Art. 6.13.6.1.3b, C6.13.6.1.3b`,
        note: `Arm between flange centroids ${n3(R.Aneg)} in${b === 'neg' && R.usePrs ? `; P_rs = F_yrA_r = ${n2(R.Prs)} kip at ${n3(R.yr_)} in` : ''}; A_w = ${n3(m.Aw)} in.` }));
    } else {
      R.combos.filter(c => c.type === 'str').forEach(c => ['top', 'bot'].forEach(k => { const q = c.F[k];
        w.add({ id: `${c.id}.P${k}`, label: `${c.name}: ${k === 'top' ? 'top' : 'bottom'} flange design force (${q.role}, ${q.tension ? 'tension, F A_e' : 'compression, F A_g'}), 8th Ed.`, sym: 'P_{fu}', eq: 'F_{cf}A\\ \\text{or}\\ F_{ncf}A', sub: `${n2(q.F)}(${n3(q.Aused)})`, value: q.P, unit: 'kip', d: 2, ref: 'AASHTO LRFD 8th Ed. Eqs. 6.13.6.1.4c-1, -3', note: `F_cf = max((|f_cf|/R_h + αφ_fF_yf)/2, 0.75αφ_fF_yf) = ${n2(c.Fcf)} ksi; R_cf = ${n4(c.Rcf)}; F_ncf = ${n2(c.Fncf)} ksi.` }); }));
      R.combos.filter(c => c.type === 'str').forEach(c => w.add({ id: `${c.id}.Vuw`, label: `${c.name}: web design shear, 8th Ed.`, sym: 'V_{uw}', eq: c.ruleV === 'low' ? '1.5V_{u}' : '\\frac{V_{u} + \\phi_{v}V_{n}}{2}', sub: c.ruleV === 'low' ? `1.5(${n2(c.Vu)})` : `\\frac{${n2(c.Vu)} + ${n2(R.phVn)}}{2}`, value: c.Vuw, unit: 'kip', d: 2, ref: 'AASHTO LRFD 8th Ed. Eqs. 6.13.6.1.4b-1, -2', note: `M_uw = ${n2(c.Muw)} kip-in, H_uw = ${n2(c.Huw)} kip (Eqs. 6.13.6.1.4b-3, -4).` }));
    }
    ['top', 'bot'].forEach(k => { const F = R.fl[k], T = k === 'top' ? 'Top' : 'Bottom';
      w.add({ id: `${k}.Rn`, label: `${T} flange: nominal shear resistance per bolt, ${F.Ns} shear plane${F.Ns > 1 ? 's' : ''}${F.red < 1 ? ', joint longer than 38 in' : ''}`, sym: 'R_{n}', eq: `${R.thrF.toFixed(2)}A_{b}F_{ub}N_{s}${F.red < 1 ? '(0.83)' : ''}`, sub: `${R.thrF.toFixed(2)}(${n4(R.bolt.Ab)})(${R.Fub})(${F.Ns})${F.red < 1 ? '(0.83)' : ''}`, value: F.Rn1, unit: 'kip', d: 2, ref: `${ED} Eqs. 6.13.2.7-1, -2` });
      F.sides.forEach(sd => { if (sd.R < 1) w.add({ id: `${k}.R${sd.sd}`, label: `${T} flange, ${sd.sd === 'L' ? 'left' : 'right'}: filler reduction (filler ${n3(F.tfill)} in ≥ 1/4 in)`, sym: 'R', eq: '\\frac{1 + \\gamma}{1 + 2\\gamma},\\ \\gamma = \\frac{A_{f}}{A_{p}}', sub: `\\gamma = \\frac{${n3(sd.Afill)}}{${n3(sd.Ap)}} = ${n4(sd.gamma)}`, value: sd.R, unit: '', d: 4, ref: `${ED} Eq. 6.13.6.1.5-1`, note: 'A_f: filler area (filler thickness × the narrower of the outer plate and the flange); A_p: the smaller of the flange area and the total splice plate area.' });
        w.add({ id: `${k}.brg${sd.sd}`, label: `${T} flange, ${sd.sd === 'L' ? 'left' : 'right'}: bearing on the bolt holes, all bolts of one side (end row: L_c = ${n3(sd.bF.rows[0].Lc)} in in the flange, ${n3(sd.bP.rows[0].Lc)} in in the plates)`, sym: '\\sum\\phi_{bb}R_{n}', eq: '\\min(\\sum 0.80\\min(2.4dtF_{u}, 1.2L_{c}tF_{u}))', sub: `\\min(${n2(sd.bF.tot)}, ${n2(sd.bP.tot)})`, value: sd.bearing, unit: 'kip', d: 2, ref: `${ED} Eqs. 6.13.2.9-1, -2`, note: `Flange t = ${n3(sd.tf)}, F_u = ${sd.bF.Fu}; plates t = ${n3(sd.bP.t)}, F_u = ${sd.bP.Fu}.` }); });
      w.add({ id: `${k}.slip`, label: `${T} flange: slip resistance of the bolts on one side`, sym: 'nR_{r}', eq: 'nK_{h}K_{s}N_{s}P_{t}', sub: `${F.n}(${n2(R.Kh)})(${n2(R.Ks)})(${F.Ns})(${R.Pt})`, value: F.slip, unit: 'kip', d: 2, ref: `${ED} Eq. 6.13.2.8-1` });
      ['o', 'i'].forEach(pk => { const pr = F.plate[pk]; if (!pr) return; w.add({ id: `${k}.pl.${pk}`, label: `${T} flange, ${pk === 'o' ? 'outer plate' : 'inner plates (both)'}: areas`, sym: 'A_{g},\\ A_{n}', eq: 'A_{n} = \\min(A_{g} - 2n_{l}(d_{h} + 0.0625)t, 0.85A_{g})', sub: `${n3(pr.A)},\\ ${n3(pr.An)}`, value: pr.An, unit: 'in^{2}', d: 3, ref: `${ED} Art. 6.13.5.2, 6.8.3` }); });
    });
    if (X10) [...R.combos.filter(c => c.type !== 'str')].forEach(c => w.add({ id: `${c.id}.Ms`, label: `${c.name}: slip moment of the flange splices and the excess to the web`, sym: 'H_{s}', eq: '\\frac{\\max(0, M_{s} - nR_{r}A)}{A_{w}}', sub: `\\frac{\\max(0, ${n2(c.s10.Ms)} - ${n2(c.s10.Msr)})}{${n3(c.s10.Aw)}}`, value: c.s10.Hs, unit: 'kip', d: 2, ref: `${ED} Art. 6.13.6.1.3b, 6.13.6.1.4b`, note: `M_s = |M|(12) = ${n2(c.s10.Ms)} kip-in; A = ${n3(c.s10.A)} in (${c.s10.pos ? 'positive' : 'negative'}); slip moment from the ${c.s10.gov}.` }));
    const W = R.web;
    w.add({ id: 'web.Ip', label: `Web bolt group (${W.nrw} rows × ${W.ncw} columns each side): polar moment`, sym: 'I_{p}', eq: '\\sum(x^{2} + y^{2})', sub: `x_{max} = ${n3(W.dxm)},\\ y_{max} = ${n3(W.dym)}`, value: W.Ip, unit: 'in^{2}', d: 2, ref: `${ED} C6.13.6.1.4b` });
    w.add({ id: 'web.e', label: 'Eccentricity of the web shear about the bolt group', sym: 'e', eq: '\\frac{gap}{2} + e_{w} + \\frac{(n_{c} - 1)s_{h}}{2}', sub: `${n3(R.gap / 2)} + ${n3(W.ew)} + ${n3((W.ncw - 1) * W.sh / 2)}`, value: W.e, unit: 'in', d: 3, ref: `${ED} Art. 6.13.6.1.4b` });
    w.add({ id: 'web.phRw', label: 'Web bolts: factored shear resistance per bolt, double shear', sym: '\\phi_{s}R_{n}', eq: `0.80(${R.thrF.toFixed(2)})A_{b}F_{ub}(2)${W.redW < 1 ? '(0.83)' : ''}`, sub: `0.80(${R.thrF.toFixed(2)})(${n4(R.bolt.Ab)})(${R.Fub})(2)${W.redW < 1 ? '(0.83)' : ''}`, value: W.phRw, unit: 'kip', d: 2, ref: `${ED} Eq. 6.13.2.7-1` });
    w.add({ id: 'web.slipW', label: 'Web bolts: slip resistance per bolt, two slip planes', sym: 'R_{r}', eq: 'K_{h}K_{s}N_{s}P_{t}', sub: `${n2(R.Kh)}(${n2(R.Ks)})(2)(${R.Pt})`, value: W.slipW, unit: 'kip', d: 2, ref: `${ED} Eq. 6.13.2.8-1` });
    w.add({ id: 'web.brgW', label: `Bearing per bolt on the girder web (L_c = ${n3(W.LcW)} in)`, sym: '\\phi_{bb}R_{n}', eq: '0.80\\min(2.4dt_{w}F_{u}, 1.2L_{c}t_{w}F_{u})', sub: `0.80\\min(2.4(${n3(R.bolt.d)})(${n4(R.tw)})(${R.gW.Fu}), 1.2(${n3(W.LcW)})(${n4(R.tw)})(${R.gW.Fu}))`, value: W.brgW, unit: 'kip', d: 2, ref: `${ED} Eqs. 6.13.2.9-1, -2` });
    w.add({ id: 'web.brgP', label: `Bearing per bolt on the two web plates (L_c = ${n3(W.LcP)} in)`, sym: '\\phi_{bb}R_{n}', eq: '0.80\\min(2.4d(2t_{p})F_{u}, 1.2L_{c}(2t_{p})F_{u})', sub: `0.80\\min(2.4(${n3(R.bolt.d)})(2)(${n4(W.twp)})(${R.gP.Fu}), 1.2(${n3(W.LcP)})(2)(${n4(W.twp)})(${R.gP.Fu}))`, value: W.brgP, unit: 'kip', d: 2, ref: `${ED} Eqs. 6.13.2.9-1, -2` });
    w.add({ id: 'web.Vy', label: 'Web plates: shear yielding', sym: 'R_{r}', eq: '\\phi_{v}0.58F_{y}A_{vg}', sub: `1.0(0.58)(${R.gP.Fy})(${n3(W.Awp)})`, value: W.Vy, unit: 'kip', d: 2, ref: `${ED} Eq. 6.13.5.3-1` });
    w.add({ id: 'web.Vr', label: 'Web plates: shear rupture', sym: 'R_{r}', eq: '\\phi_{vu}0.58F_{u}A_{vn}', sub: `0.80(0.58)(${R.gP.Fu})(${n3(W.Avn)})`, value: W.Vr, unit: 'kip', d: 2, ref: `${ED} Eq. 6.13.5.3-2` });
    R.combos.forEach(c => { const b = c.wb, str = c.type === 'str', V = str ? c.Vuw : c.Vw, H = str ? c.Huw : c.Hw;
      w.add({ id: `${c.id}.wb.R`, label: `${c.name}: resultant on the critical (corner) web bolt`, sym: str ? 'R_{u}' : 'R_{s}', eq: '\\sqrt{(\\frac{|H|}{n} + \\frac{M_{t}y_{max}}{I_{p}})^{2} + (\\frac{V}{n} + \\frac{M_{t}x_{max}}{I_{p}})^{2}}', sub: `\\sqrt{${n2(b.Rx)}^{2} + ${n2(b.Ry)}^{2}}`, value: b.R, unit: 'kip', d: 2, ref: `${ED} Art. 6.13.6.1.4b`,
        note: `V = ${n2(V)} kip (${str ? (X10 ? 'V_r, 6.13.6.1.3c' : 'V_uw') : 'V_s'}), H = ${n2(H)} kip, M_t = ${str && !X10 ? 'M_uw + ' : ''}${(str ? R.eS : R.eV) ? 'Ve' : '0'} = ${n2(b.Mt)} kip-in, n = ${W.nw}.` }); });
    if (R.fat) ['top', 'bot'].forEach(k => w.add({ id: `fat.${k}`, label: `Fatigue I stress range, ${k === 'top' ? 'top' : 'bottom'} flange (short-term composite for +ΔM, steel + reinforcement for −ΔM)`, sym: '\\gamma(\\Delta f)', eq: '\\gamma(|f_{+}| + |f_{-}|)', sub: `${n2(R.fat.gf)}(|${n2(R.fat.fp[k])}| + |${n2(R.fat.fn[k])}|)`, value: R.fat[k], unit: 'ksi', d: 2, ref: `${ED} Art. 6.6.1.2.2` }));
    return w.steps;
  }

  /* ---------- auto-design (GirderDetail autoDesignSplice, fitSplice) ---------- */
  const spStdT = v => v <= 1 + 1e-9 ? Math.ceil(v * 16 - 1e-6) / 16 : Math.ceil(v * 8 - 1e-6) / 8;   // standard plate thicknesses: 1/16 in up to 1 in, 1/8 in above
  const spNextT = t => spStdT(t + (t < 1 - 1e-9 ? 0.0625 : 0.125) - 1e-6);
  /* fit(P, env): fitSplice — geometry fitted to the girder, then rows, plates and web columns increased until the checks pass (40 rounds) */
  function fit(P, env) {
    const E = env0(env);
    const R0 = compute(P, E); if (R0.errors.length) return { ok: false, msg: 'The splice has input errors; fix them before fitting.' };
    const bt = BOLT[P.bolts.d] || BOLT['0.875'], d = bt.d, em = Math.max(bt.emin[P.bolts.edge === 'sh' ? 'sh' : 'cut'], (E.rule('spl.ovs') || { value: { edge: 0 } }).value.edge), q4 = v => Math.floor(v * 4 + 1e-6) / 4, u4 = v => Math.ceil(v * 4 - 1e-6) / 4, q2 = v => Math.floor(v * 2 + 1e-6) / 2;
    const cw = parseDim(P.clr.cw), cv = parseDim(P.clr.cv), before = JSON.stringify({ top: P.top, bot: P.bot, web: P.web });
    const geom = () => { const R = compute(P, E); if (R.errors.length) return; const tw = Math.max(R.secL.tw, R.secR.tw), twp = parseDim(P.web.t);
      ['top', 'bot'].forEach(k => { const F = P[k], bmin = Math.min(R.secL[k + 'B'], R.secR[k + 'B']), g = Math.max(parseDim(F.g) || 3, u4(3 * d));
        F.bo = bmin; F.g = g;
        if (F.inner) { const bi = q4(bmin / 2 - tw / 2 - twp - cw); if (bi >= 2 * em + 0.25) F.bi = bi; else F.inner = false; }
        const inEdge = F.inner ? bmin / 2 - F.bi : tw / 2 + twp + cw;
        const C1f = parseDim(P.bolts.c1) > 0 ? parseDim(P.bolts.c1) : (C1TBL[P.bolts.d] || 1.5);
        let g0 = u4(Math.max(inEdge + em, tw / 2 + twp + C1f)), nl = 1 + Math.floor((bmin / 2 - em - g0) / g + 1e-9);
        if (nl < 1) { nl = 1; g0 = q4(bmin / 2 - em); }
        F.g0 = g0; F.nl = Math.min(nl, 3); });
      const hw = q2(R.D - 2 * cv), sv = parseDim(P.web.sv) || 3; P.web.h = hw; P.web.nr = Math.max(2, 1 + Math.floor((hw - 2 * em) / sv + 1e-9)); };
    let fails = [];
    for (let it = 0; it < 40; it++) {
      geom(); const R = compute(P, E); if (R.errors.length) break; const C = checks(R, { steps: false }); fails = C.filter(c => c.status === 'fail').map(c => c.id);
      if (!fails.length) break; let ch = false;
      const thick = F => { F.to = spNextT(parseDim(F.to)); if (F.inner) F.ti = spNextT(parseDim(F.ti)); ch = true; };
      if (fails.some(id => /^TF[123]$/.test(id)) && P.top.nr < 14) { P.top.nr++; ch = true; }
      if (fails.some(id => /^BF[123]$/.test(id)) && P.bot.nr < 14) { P.bot.nr++; ch = true; }
      if (fails.some(id => /^TF[45]$/.test(id))) thick(P.top);
      if (fails.some(id => /^BF[45]$/.test(id))) thick(P.bot);
      if (fails.some(id => /^WS[123]$/.test(id)) && P.web.nc < 4) { P.web.nc++; ch = true; }
      if (fails.some(id => /^WS[45]$/.test(id))) { P.web.t = spNextT(parseDim(P.web.t)); ch = true; }
      if (!ch) break;
    }
    const f = F => `${F.nl} line${F.nl > 1 ? 's' : ''} each side × ${F.nr} rows at ${frac(F.g0)} from the web${F.nl > 1 ? `, ${frac(F.g)} gage` : ''}; outer PL ${frac(F.bo)} × ${frac(F.to)}${F.inner ? `, inner PL ${frac(F.bi)} × ${frac(F.ti)}` : ', no inner plates'}`;
    const msg = `Top flange: ${f(P.top)}. Bottom flange: ${f(P.bot)}. Web: PL ${frac(P.web.h)} × ${frac(P.web.t)}, ${P.web.nr} rows × ${P.web.nc} columns.` + (fails.length ? ` Still failing: ${fails.join(', ')}; adjust these by hand.` : ' All strength and detailing checks pass.');
    return { ok: !fails.length, changed: before !== JSON.stringify({ top: P.top, bot: P.bot, web: P.web }), msg, fails };
  }
  /* autoDesign(p, env): autoDesignSplice on a copy of p (the inputs p are not changed). The most economical splice that passes every strength
     and detailing check: web plates full depth with the fewest columns, then the thinnest plate; each flange with or without inner plates,
     1 to 3 lines each side, the fewest rows, the thinnest balanced plates; two passes. Where no layout passes, fit() increases the plates
     and bolts. Returns { ok, msg, fails, p (the designed inputs) }. Locked inputs (GirderDetail's adLocks) are not part of this app. */
  function autoDesign(p0, env) {
    const E = env0(env), P = clone(p0);
    const R0 = compute(P, E); if (R0.errors.length) return { ok: false, msg: 'Fix the splice input errors first.', fails: ['input errors'], p: P };
    const undo = clone({ top: P.top, bot: P.bot, web: P.web });
    const bt = BOLT[P.bolts.d] || BOLT['0.875'], d = bt.d, em = Math.max(bt.emin[P.bolts.edge === 'sh' ? 'sh' : 'cut'], (E.rule('spl.ovs') || { value: { edge: 0 } }).value.edge);   // OWN25: owner edge distance
    const q4 = v => Math.floor(v * 4 + 1e-6) / 4, u4 = v => Math.ceil(v * 4 - 1e-6) / 4, q2 = v => Math.floor(v * 2 + 1e-6) / 2;
    const cw = parseDim(P.clr.cw), cv = parseDim(P.clr.cv), g = u4(Math.max(3, 3 * d)), OK = ['pass', 'na', 'adv'], DT = ['DT1', 'DT2', 'DT3', 'DT4', 'DT5', 'DT6', 'DT7', 'DT8', 'DT9', 'DT10', 'DT11'];
    const run = () => { const R = compute(P, E); return R.errors.length ? null : { R, C: checks(R, { steps: false }) }; };
    const good = (C, ids, part) => ids.every(id => { const c = C.find(q => q.id === id); if (!c) return true; if (!part) return OK.includes(c.status); return c.items.filter(i => String(i.loc).startsWith(part)).every(i => OK.includes(i.st)); });
    const tw = Math.max(R0.secL.tw, R0.secR.tw), nMin = Math.max(1, Math.round(parseDim(P.bolts.minLines) || 1)), C1 = parseDim(P.bolts.c1) > 0 ? parseDim(P.bolts.c1) : (C1TBL[P.bolts.d] || 1.5);
    const minPlate = E.minPlate;
    const needB = twp => { const g0 = u4(Math.max(tw / 2 + twp + cw + em, tw / 2 + twp + C1)); return Math.ceil(2 * (g0 + (nMin - 1) * g + em) * 4 - 1e-6) / 4; };
    const designWeb = () => { const hw = q2(R0.D - 2 * cv); P.web.h = hw; P.web.sh = Math.max(3, u4(3 * d)); let best = null;
      for (let nc = 1; nc <= 4; nc++) for (const sv of [3, 3.5, 4, 4.5, 5, 5.5, 6]) { if (sv < 3 * d - 1e-9) continue; const tMin = Math.max(0.3125, minPlate); const nr = Math.max(2, 1 + Math.floor((hw - 2 * em) / sv + 1e-9)), bolts = 2 * nr * nc; if (best && bolts > best.bolts) continue;
        P.web.nc = nc; P.web.sv = sv; P.web.nr = nr;
        for (let t = tMin; t <= 1.0 + 1e-9; t += 0.0625) { P.web.t = t; const r = run(); if (!r) break;
          if (good(r.C, ['WS1', 'WS2', 'WS3', 'WS4', 'WS5']) && good(r.C, DT, 'Web')) { const lb = 2 * hw * t; if (!best || bolts < best.bolts || (bolts === best.bolts && lb < best.lb)) best = { nc, sv, nr, t, h: hw, bolts, lb }; break; } } }
      if (best) { const { bolts, lb, ...w } = best; Object.assign(P.web, w); } return best; };
    const designFl = k => { const pre = k === 'top' ? 'TF' : 'BF', part = k === 'top' ? 'Top' : 'Bottom', F = P[k], bmin = Math.min(R0.secL[k + 'B'], R0.secR[k + 'B']), twp = parseDim(P.web.t); let best = null;
      for (const inner of [true, false]) for (let nl = nMin; nl <= Math.max(nMin, 3); nl++) {
        F.bo = bmin; F.g = g; F.inner = inner; if (parseDim(F.s) < 3 * d - 1e-9) F.s = u4(3 * d);
        if (inner) { const bi = q4(bmin / 2 - tw / 2 - twp - cw); if (bi < 2 * em + 0.25) continue; F.bi = bi; }
        const inEdge = inner ? bmin / 2 - F.bi : tw / 2 + twp + cw, g0 = u4(Math.max(inEdge + em, tw / 2 + twp + C1)); if (g0 + (nl - 1) * g > bmin / 2 - em + 1e-9) continue; F.g0 = g0; F.nl = nl;
        F.to = 1.5; if (inner) F.ti = 1.5; let r = null, ok = false;
        for (let nr = 2; nr <= 16; nr++) { F.nr = nr; r = run(); if (!r) break; if (good(r.C, [pre + '1', pre + '3']) && good(r.C, ['DT1', 'DT2', 'DT4', 'DT6'], part)) { ok = true; break; } }
        if (!ok) continue; ok = false;
        for (let to = Math.max(0.3125, minPlate); to <= 2.0 + 1e-9; to = spNextT(to)) { F.to = to; if (inner) F.ti = Math.max(0.3125, minPlate, spStdT(to * F.bo / (2 * F.bi))); r = run(); if (!r) break;
          if (good(r.C, [pre + '1', pre + '2', pre + '3', pre + '4', pre + '5', pre + '6']) && good(r.C, DT, part)) { ok = true; break; } }
        if (!ok) continue;
        const Ff = r.R.fl[k], bolts = 2 * Ff.n, lb = (F.bo * F.to + (inner ? 2 * F.bi * F.ti : 0)) * Ff.Lpl * 0.2836;
        if (!best || bolts < best.bolts || (bolts === best.bolts && lb < best.lb)) best = { inner, nl, nr: F.nr, to: F.to, ti: F.ti, bi: F.bi, bo: F.bo, g0: F.g0, g, bolts, lb }; }
      if (best) Object.assign(F, { inner: best.inner, nl: best.nl, nr: best.nr, to: best.to, ti: best.ti, bi: best.bi, bo: best.bo, g0: best.g0, g: best.g }); return best; };
    let W = null, T = null, Bt = null;
    for (let pass = 0; pass < 2; pass++) { W = designWeb(); T = designFl('top'); Bt = designFl('bot'); }
    const r = run(), fails = r ? r.C.filter(c => c.status === 'fail').map(c => c.id) : ['input errors'], warns = r ? r.C.filter(c => c.status === 'warn').map(c => c.id) : [];
    const narrow = ['top', 'bot'].filter((k, i) => ![T, Bt][i]).map(k => { const bmin = Math.min(R0.secL[k + 'B'], R0.secR[k + 'B']), nb = needB(parseDim(P.web.t)); return bmin < nb ? `${k === 'top' ? 'top' : 'bottom'} flange is ${frac(bmin)} in wide; ${nMin} gage lines each side of the web without staggering need at least ${frac(nb)} in` : null; }).filter(Boolean);
    if (narrow.length) { Object.assign(P, clone(undo)); const ctN = E.rule('spl.ovs') ? spCtNarrow(compute(P, E)) : null;
      if (ctN) return { ok: false, msg: `${ctN.msg} The splice was not changed.`, fails: ['DT10'], p: P };
      return { ok: false, msg: `The ${narrow.join('; the ')}. Widen the flange at this splice, or lower the minimum number of gage lines. The splice was not changed.`, fails: ['DT10'], p: P }; }
    if (!W || !T || !Bt || fails.length) {
      if (!W) { const hw = q2(R0.D - 2 * cv), svMin = [3, 3.5, 4, 4.5, 5, 5.5, 6].find(v => v >= 3 * d - 1e-9) || 6;
        Object.assign(P.web, { h: hw, sv: svMin, nr: Math.max(2, 1 + Math.floor((hw - 2 * em) / svMin + 1e-9)), nc: 4 }); }
      const f = fit(P, E); return { ok: f.ok, msg: `No layout within the search passed every check${!W ? ' (web)' : !T ? ' (top flange)' : !Bt ? ' (bottom flange)' : ''}; the plates and bolts were fitted and increased instead. ${f.msg}`, fails: f.fails, p: P }; }
    const fs = (F, x) => `${x.inner ? 'double shear' : 'single shear'}, ${F.nl} line${F.nl > 1 ? 's' : ''} each side × ${F.nr} rows = ${x.bolts} bolts; outer PL ${frac(F.bo)} × ${frac(F.to)}${F.inner ? `, 2 inner PL ${frac(F.bi)} × ${frac(F.ti)}` : ''}`;
    const Rw = r.R.web, nW = 2 * Rw.nrw * Rw.ncw;
    const msg = `Top flange: ${fs(P.top, T)}. Bottom flange: ${fs(P.bot, Bt)}. Web: 2 PL ${frac(P.web.h)} × ${frac(P.web.t)}, ${P.web.nr} rows × ${P.web.nc} column${P.web.nc > 1 ? 's' : ''} each side = ${nW} bolts. Total ${T.bolts + Bt.bolts + nW} bolts. Every strength and detailing check passes${warns.length ? ` (warnings: ${warns.join(', ')})` : ''}.`;
    return { ok: true, msg, fails: [], p: P };
  }

  /* ---------- demands and sections at a splice (Preliminary sizing spliceExport) ---------- */
  /* demandsAt(A, x): A = { xs (the analysis nodes, ft), node arrays MDC1, MDC2, MDW, MCL, Mp (LL+IM, +), Mn (LL+IM, −), MfP, MfN (fatigue),
     MUT, MUF (optional); element arrays (length N − 1, the shear of each element: magnitudes are taken) VDC1, VDC2, VDW, VCL, Vp, Vn, VUT, VUF }.
     Moments at the node nearest x; shears the largest magnitude in the element containing x and its neighbours (GirderDetail spliceExport,
     rounded to 0.1 as it sends them). Returns { i (node), e (element), dem }. */
  function demandsAt(A, x) {
    const xs = A.xs, N = xs.length, r1 = v => +(+v).toFixed(1);
    const node = q => { let b = 0; xs.forEach((v, i) => { if (Math.abs(v - q) < Math.abs(xs[b] - q)) b = i; }); return b; };
    const el = q => { let e = 0; while (e < N - 2 && xs[e + 1] < q) e++; return e; };
    const vmax = (arr, e) => Math.max(...[e - 1, e, e + 1].filter(k => k >= 0 && k < arr.length).map(k => Math.abs(arr[k])));
    const i = node(x), e = el(x);
    const dem = { MDC1: r1(A.MDC1[i]), MDC2: r1(A.MDC2[i]), MDW: r1(A.MDW[i]), MLLp: r1(Math.max(0, A.Mp[i])), MLLn: r1(Math.min(0, A.Mn[i])), MCL: r1(A.MCL[i]),
      VDC1: r1(vmax(A.VDC1, e)), VDC2: r1(vmax(A.VDC2, e)), VDW: r1(vmax(A.VDW, e)), VLL: r1(Math.max(vmax(A.Vp, e), vmax(A.Vn, e))), VCL: r1(vmax(A.VCL, e)), dMp: r1(Math.max(0, A.MfP[i])), dMn: r1(Math.abs(Math.min(0, A.MfN[i]))) };
    if (A.MUT || A.MUF) dem.ut = { MUT: A.MUT ? r1(A.MUT[i]) : 0, MUF: A.MUF ? r1(A.MUF[i]) : 0, VUT: A.VUT ? r1(vmax(A.VUT, e)) : 0, VUF: A.VUF ? r1(vmax(A.VUF, e)) : 0 };
    return { i, e, xi: xs[i], dem };
  }
  /* arraysFromAnalysis(AR): demandsAt's arrays from engine/analysis.js (analyzeGirder, with live load). An element's shear is the larger
     magnitude of its two ends (VR at its left node, VL at its right node): the shared engine applies distributed loads exactly, where
     GirderDetail's lumped loads give one shear per element. */
  function arraysFromAnalysis(AR) {
    const st = AR.st, N = AR.x.length, elv = (VR, VL) => Array.from({ length: N - 1 }, (_, k) => Math.max(Math.abs(VR[k]), Math.abs(VL[k + 1])));
    const A = { xs: AR.x, MDC1: st.DC1.M, MDC2: st.DC2.M, MDW: st.DW.M, MCL: st.CL.M, VDC1: elv(st.DC1.VR, st.DC1.VL), VDC2: elv(st.DC2.VR, st.DC2.VL), VDW: elv(st.DW.VR, st.DW.VL), VCL: elv(st.CL.VR, st.CL.VL),
      Mp: AR.ll ? AR.ll.Mpos : new Array(N).fill(0), Mn: AR.ll ? AR.ll.Mneg : new Array(N).fill(0), MfP: AR.fat ? AR.fat.Mpos : new Array(N).fill(0), MfN: AR.fat ? AR.fat.Mneg : new Array(N).fill(0),
      Vp: AR.ll ? elv(AR.ll.VRpos, AR.ll.VLpos) : new Array(N - 1).fill(0), Vn: AR.ll ? elv(AR.ll.VRneg, AR.ll.VLneg) : new Array(N - 1).fill(0) };
    if (st.UT) { A.MUT = st.UT.M; A.VUT = elv(st.UT.VR, st.UT.VL); }
    if (st.UF) { A.MUF = st.UF.M; A.VUF = elv(st.UF.VR, st.UF.VL); }
    return A;
  }
  /* sectionAt(segs, x): the plates 0.01 ft left and right of x (spliceExport) from segments [{ x0, x1, D, tw, topB, topT, botB, botT }] */
  function sectionAt(segs, x) {
    const at = q => { const s = segs.find(z => q >= z.x0 - 1e-9 && q < z.x1) || segs[segs.length - 1]; return { D: s.D, tw: s.tw, topB: s.topB, topT: s.topT, botB: s.botB, botT: s.botT }; };
    return { L: at(x - 0.01), R: at(x + 0.01) };
  }

  /* ---------- the splices of a girder of an sbd2 project ---------- */
  /* settings(P): P.splices with GirderDetail's module defaults filled in; x = the field splice stations P.framing.splices (one list, shared with
     the Framing tab). P.splices = { code, bolts, gam, clr, Rh, aT, aB, prs,
     gP (splice plate grade; blank = the flange grade), auto: true | false (auto-design the plates and bolts of every splice; false: the
     entered plates), plates: [ { x, top, bot, web } ] (entered, per station) } */
  function settings(P) {
    const s = (P && P.splices) || {}, d = clone(DEF);
    const fx = P && P.framing && Array.isArray(P.framing.splices) ? P.framing.splices : [];
    return { x: fx.map(Number).filter(v => isFinite(v)), code: s.code === '8' ? '8' : '10', bolts: { ...d.bolts, ...(s.bolts || {}) }, gam: { ...d.gam, ...(s.gam || {}) }, clr: { ...d.clr, ...(s.clr || {}) },
      prs: s.prs === 'yes' ? 'yes' : 'no', gP: s.gP || '', auto: s.auto !== false, plates: Array.isArray(s.plates) ? s.plates : [] };
  }
  /* inputsAt(P, gi, AR, x, opt): the splice inputs (p, as GirderDetail's module receives them from spliceExport) for the splice at x of girder gi.
     Section: the segments 0.01 ft left and right; deck: t_s, the haunch, b_eff of the girder; the deck reinforcement A_r = top + bottom layers at
     their centroid (d_r below the top of the slab); E_c from w_c for E_c (OWN17) and the n rule; R_h of the smaller steel section (engine/sections.js
     hybrid; 1.0 when homogeneous); the web shear basis from the stiffener layout (the panel containing x: stiffened with its d_o, else
     unstiffened); demands from demandsAt(arraysFromAnalysis(AR), x). opt.env: the owner env. */
  function inputsAt(P, gi, AR, x, opt) {
    opt = opt || {};
    const S = settings(P), g = P.girders[gi], d = P.deck, m = P.materials, ms = m.steel || {}, sc = sectionAt(g.segments, x), warn = [];
    if (Math.abs(sc.L.D - sc.R.D) > 1e-9) warn.push(`The web depth changes at ${f2(x)} ft (${f2(sc.L.D)} / ${f2(sc.R.D)} in): the splice is designed with the left depth.`);
    if (ms.top !== ms.bot) warn.push(`Top and bottom flange grades differ (${ms.top} / ${ms.bot}): the splice module takes one flange grade, the top flange's.`);
    const reb = d.rebar || {}, At = +((reb.top || {}).A) || 0, Ab = +((reb.bot || {}).A) || 0, Ar = At + Ab;
    const dr = Ar > 0 ? (At * (+(reb.top || {}).c || 0) + Ab * (d.ts - (+(reb.bot || {}).c || 0))) / Ar : 0;
    const p = clone(DEF), A = arraysFromAnalysis(AR), dm = demandsAt(A, x);
    const pick = q => ({ tw: q.tw, topB: q.topB, topT: q.topT, botB: q.botB, botT: q.botT });
    const GR = (window.SBDModel && window.SBDModel.GRADES) || GD_GR, smP = (() => { const a = steelProps(sc.L.D, sc.L), b = steelProps(sc.L.D, sc.R); return a.I <= b.I ? sc.L : sc.R; })();
    let Rh = 1; const SEC = window.SBDSections;
    if (SEC && SEC.hybrid && SEC.steelCore) { const q = { D: sc.L.D, tw: smP.tw, topB: smP.topB, topT: smP.topT, botB: smP.botB, botT: smP.botT }, F = k => (GR[ms[k]] || GD_GR['50']).Fy;
      Rh = SEC.hybrid(q, SEC.steelCore(q), { Fyt: F('top'), Fyb: F('bot'), Fyw: F('web') }, 'spl').Rh; }
    const SB = window.SBDStiffeners, ly = (P.stiffeners || {}).layout || {};
    let web = 'unstiffened', dO = 60;
    if (SB && ly.web === 'stiffened' && AR.sup) { const fr = ly.frames || {}, ints = Array.isArray(fr.at) ? fr.at.map(Number) : SB.framesDefault(AR.sup, +fr.Lb || 25);
      const supX = AR.sup, D = Math.max(...g.segments.map(s => s.D));
      try { const pans = SB.girderBays(ly, D, supX, AR.cont, supX, ints, gi + 1).flatMap(SB.bayPanels), pn = pans.find(q => x >= q.p - 1e-9 && x <= q.q + 1e-9); if (pn && pn.d > 0) { web = 'stiffened'; dO = pn.d; } } catch (e) { warn.push('Stiffener panel at the splice not found: unstiffened web assumed.'); } }
    p.sec = { ...p.sec, D: sc.L.D, gF: ms.top || '50W', gW: ms.web || '50W', gP: S.gP || ms.top || '50W', L: pick(sc.L), R: pick(sc.R), Rh, ts: d.ts, hh: d.haunch, beff: g.beff, Ar, dr, web, do: dO,
      fc: m.concrete.fc, wc: m.concrete.wcE > 0 ? m.concrete.wcE : m.concrete.wc, K1: m.concrete.K1, nRule: m.concrete.nRule, code: S.code, Fyr: (m.rebar || {}).Fyr || 60, prs: S.prs, same: { top: false, web: false, bot: false } };
    p.dem = dm.dem; p.gam = S.gam; p.bolts = S.bolts; p.clr = S.clr;
    const own = S.plates.find(q => q && Math.abs(+q.x - x) < 1e-6 && (q.g == null || +q.g === gi));
    if (own) ['top', 'bot', 'web'].forEach(k => { if (own[k]) p[k] = { ...p[k], ...own[k] }; });
    return { p, dm, warn, own: !!own };
  }
  /* girder(P, gi, AR, opt): every splice of girder gi: inputs, auto-design (settings.auto and no entered plates), compute, checks.
     opt.env: { owner, lf, minPlate }. Returns { list: [{ x, name, p, R, CK, gov, design, warn }], errors }. */
  function girder(P, gi, AR, opt) {
    opt = opt || {};
    const S = settings(P), E = env0(opt.env), Lt = AR.Lt, out = [], errors = [];
    S.x.forEach((x, k) => {
      const name = `FS${k + 1} at ${f2(x)} ft`;
      if (!(x > 0 && x < Lt)) { errors.push(`${name}: the station must lie between 0 and ${f2(Lt)} ft.`); return; }
      const I = inputsAt(P, gi, AR, x, opt); let p = I.p, design = null;
      if (S.auto && !I.own) { design = autoDesign(p, E); p = design.p; }
      const R = compute(p, E);
      if (R.errors.length) { out.push({ x, name, p, R, CK: null, gov: null, design, warn: I.warn, dm: I.dm }); return; }
      const CK = checks(R);
      let gov = null; CK.forEach(c => { if (c.gov < 0) return; const it = c.items[c.gov]; if (it.r == null) return; if (!gov || RANK[it.st] > RANK[gov.it.st] || (RANK[it.st] === RANK[gov.it.st] && it.r > gov.it.r)) gov = { c, it }; });
      out.push({ x, name, p, R, CK, gov, design, warn: I.warn, dm: I.dm, own: I.own });
    });
    return { list: out, errors };
  }

  /* ---------- drawing (plan of the flange splice and elevation of the web splice; simple) ---------- */
  function svg(R) {
    if (!R || R.errors && R.errors.length) return '';
    const W = R.web, F = R.fl.bot, k = 5, pad = 24, gap = R.gap;
    const Lw = 2 * (W.ew + (W.ncw - 1) * W.sh + W.ewp) + gap, Lf = F.Lpl, L = Math.max(Lw, Lf) + 8, H = R.D;
    const wid = (L * k + 2 * pad), ht = (H * k + 2 * pad), cx = wid / 2, y0 = pad, s = v => v * k;
    let h = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wid.toFixed(0)} ${ht.toFixed(0)}" style="max-width:100%;height:auto;font-family:sans-serif" role="img" aria-label="Web splice elevation">`;
    h += `<rect x="${pad}" y="${y0}" width="${(cx - s(gap / 2) - pad).toFixed(1)}" height="${s(H).toFixed(1)}" fill="#e9ecf2" stroke="#4a5562"/>`;
    h += `<rect x="${(cx + s(gap / 2)).toFixed(1)}" y="${y0}" width="${(wid - pad - cx - s(gap / 2)).toFixed(1)}" height="${s(H).toFixed(1)}" fill="#e9ecf2" stroke="#4a5562"/>`;
    const pw = s(Lw), ph = s(W.hw), px = cx - pw / 2, py = y0 + (s(H) - ph) / 2;
    h += `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" fill="#dfe6fb" fill-opacity=".85" stroke="#2346c2"/>`;
    const r = Math.max(2, s(R.bolt.d) / 2);
    [-1, 1].forEach(sd => { for (let j = 0; j < W.ncw; j++) for (let i = 0; i < W.nrw; i++) { const bx = cx + sd * s(gap / 2 + W.ew + j * W.sh), by = py + s(W.ev + i * W.sv); h += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${r.toFixed(1)}" fill="#172130"/>`; } });
    h += `<text x="${cx.toFixed(1)}" y="${(y0 + s(H) + 16).toFixed(1)}" font-size="11" text-anchor="middle">Web: 2 PL ${frac(W.hw)} × ${frac(W.twp)}; ${W.nrw} rows × ${W.ncw} col. each side</text></svg>`;
    // flange plan (bottom flange, outer plate and bolts)
    const fw = Math.max(F.bL, F.bR), wd2 = (L * k + 2 * pad), ht2 = s(fw) + 2 * pad + 14, cy = pad + s(fw) / 2, cx2 = wd2 / 2;
    let p2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wd2.toFixed(0)} ${ht2.toFixed(0)}" style="max-width:100%;height:auto;font-family:sans-serif" role="img" aria-label="Bottom flange splice plan">`;
    p2 += `<rect x="${pad}" y="${(cy - s(F.bL) / 2).toFixed(1)}" width="${(cx2 - s(gap / 2) - pad).toFixed(1)}" height="${s(F.bL).toFixed(1)}" fill="#e9ecf2" stroke="#4a5562"/>`;
    p2 += `<rect x="${(cx2 + s(gap / 2)).toFixed(1)}" y="${(cy - s(F.bR) / 2).toFixed(1)}" width="${(wd2 - pad - cx2 - s(gap / 2)).toFixed(1)}" height="${s(F.bR).toFixed(1)}" fill="#e9ecf2" stroke="#4a5562"/>`;
    p2 += `<rect x="${(cx2 - s(Lf) / 2).toFixed(1)}" y="${(cy - s(F.bo) / 2).toFixed(1)}" width="${s(Lf).toFixed(1)}" height="${s(F.bo).toFixed(1)}" fill="#dfe6fb" fill-opacity=".85" stroke="#2346c2"/>`;
    [-1, 1].forEach(sd => { for (let j = 0; j < F.nr; j++) for (let l = 0; l < F.nl; l++) [-1, 1].forEach(sy => { const bx = cx2 + sd * s(gap / 2 + F.ef + j * F.s), by = cy + sy * s(F.g0 + l * F.g); p2 += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${r.toFixed(1)}" fill="#172130"/>`; }); });
    p2 += `<line x1="${pad}" y1="${cy.toFixed(1)}" x2="${(wd2 - pad).toFixed(1)}" y2="${cy.toFixed(1)}" stroke="#94A3B8" stroke-dasharray="4 3"/>`;
    p2 += `<text x="${cx2.toFixed(1)}" y="${(ht2 - 6).toFixed(1)}" font-size="11" text-anchor="middle">Bottom flange: outer PL ${frac(F.bo)} × ${frac(F.to)}${F.inner ? `, 2 inner PL ${frac(F.bi)} × ${frac(F.ti)}` : ''}; ${F.nl} line${F.nl > 1 ? 's' : ''} each side of the web × ${F.nr} rows</text></svg>`;
    return { web: h, flange: p2 };
  }

  window.SBDSplices = { DEF, BOLT, GD_GR, PHI, env0, compute, checks, steps, autoDesign, fit, spCtNarrow, demandsAt, arraysFromAnalysis, sectionAt, settings, inputsAt, girder, svg, spStdT, spNextT, parseDim, frac };
})();
