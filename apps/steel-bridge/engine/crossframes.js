/* apps/steel-bridge/engine/crossframes.js — intermediate cross-frames and diaphragms of a steel I-girder bridge, their weight in DC1
   (window.SBDCrossframes). Classic script, no DOM. Needs (loaded first, read at call time): shared/steps.js, engine/sections.js (steelCore),
   engine/flexure.js (ltbFnc), engine/owners.js (owner rules); for the project helpers also engine/framing.js.

   Ported 2026-10-29 from GirderDetail ("Steel Bridge Design.html"), operation for operation:
     - the Cross-frames module GM.cf (anchor `GM.cf = {`): def, compute(p) (truss model of the frame by direct stiffness: a unit
       horizontal load at the exterior girder's bottom flange with the top chord held by the deck, and a unit torsional brace moment;
       wind on the exterior girder P_Z = 2.56 × 10⁻⁶V²K_zGC_D, W = γ_WS P_Z d/2, F_w = W L_b (3.8.1.2.1, 4.6.2.7.1; γ_WS = 1.0η, OWN7);
       stability bracing during deck placement M_br = (C L/(n E I_yeff))(M_u/C_b)²(L_b/(500h_o)), the torsional brace system stiffness
       β_T = (1/β_br + 1/β_sec + 1/β_g)⁻¹ ≥ β_T,req (6.7.4.2.2); the member resistances) and checks(R): CF1 single-angle compression
       (6.9.4.4, 6.9.4.1.1), CF2 tension (6.8.2.1, Table 6.8.2.2-1), CF3 slenderness (6.9.3, 6.8.4), CF4 bolt shear (6.13.2.7), CF5 bolt
       bearing (6.13.2.9), CF6 connection geometry (6.13.2.6, Table 6.13.2.6.6-1, 6.7.3, 6.9.4.4), CF7 / CF8 stability bracing strength
       and stiffness (6.7.4.2.2), CF9 fatigue of the members (6.6.1.2, Table 3.4.1-1: Fatigue I × 0.65), CF10 bracing type for the girder
       depth (6.7.4.2; owner rules OWN34–OWN36), CF11 owner details (OWN34, OWN35, OWN37);
     - cfDiaChecks (anchor `function cfDiaChecks(`): the channel or rolled W diaphragm in place of the cross-frame (CFD) and at the
       bearing lines (CFE): depth (6.7.4.2), brace stiffness 6EI_x/S and the brace moment and its shear (6.7.4.2.2), jacking (3.4.3.1),
       wind M_w = F_w d (4.6.2.7.1), the bolted connection (6.13.2), the connection plate fit (6.13.2.6.6); with cfDiaSec, cfDiaOn,
       cfDiaGap, cfDiaEnd, cfTypeRec, cfTsCP, cfCPsize, cfBsCP, cfCP, cfDiaFit, angleProps, ANGLES, CF_MEM, CF_CH, CF_DIA, BOLT, FUB, PHI;
     - the cross-frame and diaphragm weight in DC1 (XF1, anchors `function gdXfW(`, `function gdXfModel(`, `function gdXfPts(`): each
       frame weighs W and puts W/2 on each of the two girders it connects, at that girder's own frame station from the framing layout
       (engine/framing.js), mapped into the analysis span proportionally between that girder's bearings; a frame on a bearing line loads
       that bearing. X: (S(A_t + A_b) + 2√(S² + h²)A_d)·0.2836/1000·(1 + allowance) kip (K: √((S/2)² + h²)); end frames X-type.
   Where GirderDetail reads its page state, the inputs are passed in env: env = { owner, lf: { eta } (OWN7), rule(id), cite(r),
   ts: { types, rows } (the Transverse stiffeners connection plate, CF-D13), bs: { types, rows } (bearing stiffeners at the end
   diaphragms), skews (deg, every support; CF11 CTDOT channel table) }. The TeX work lines are replaced by worked steps (SharedSteps).
   tests/engine/crossframes.test.mjs checks every value and check item against GirderDetail's own functions in Node.

   Units: in, kip, ksi, kip-in (brace and diaphragm moments), ft (L_b, frame lengths, stations), mph (wind). E = 29,000 ksi. */
(function () {
  'use strict';
  const ES = 29000, ED = 'AASHTO LRFD 10th Ed.';
  const St = () => window.SharedSteps, SEC = () => window.SBDSections, FX = () => window.SBDFlexure;
  const n0 = x => St().g(x, 0), n2 = x => St().n(x, 2), n3 = x => St().n(x, 3), n4 = x => St().n(x, 4);
  /* ---------- GirderDetail's constants and small helpers (unchanged) ---------- */
  const GD_GR = { '36': { Fy: 36, Fu: 58 }, '50': { Fy: 50, Fu: 65 }, '50W': { Fy: 50, Fu: 70 }, 'HPS50W': { Fy: 50, Fu: 70 }, 'HPS70W': { Fy: 70, Fu: 85 } };
  const BOLT = {
    '0.875': { d: 0.875, Ab: 0.6013, dh: 0.9375, Pt: { A325: 39, A490: 49 }, emin: { sh: 1.50, cut: 1.125 } },
    '1': { d: 1.0, Ab: 0.7854, dh: 1.0625, Pt: { A325: 51, A490: 64 }, emin: { sh: 1.75, cut: 1.25 } },
    '1.125': { d: 1.125, Ab: 0.9940, dh: 1.25, Pt: { A325: 56, A490: 80 }, emin: { sh: 2.00, cut: 1.50 } } };
  const FUB = { A325: 120, A490: 150 };
  const PHI = { f: 1.0, y: 0.95, u: 0.80, c: 0.90, cp: 0.95, s: 0.80, bb: 0.80, bs: 0.80, v: 1.0, vu: 0.80 };
  const RANK = { na: 0, pass: 1, adv: 2, warn: 3, fail: 4 };
  const ge = (a, b) => a >= b - 1e-9;
  const worst = a => a.reduce((w, s) => (RANK[s] > RANK[w] ? s : w), 'na');
  function parseDim(v) { if (typeof v === 'number') return v; if (v == null) return NaN; let s = String(v).trim().replace(/["”]/g, '').replace(/(\d)-(\d)/g, '$1 $2').replace(/\s+/g, ' '); if (!s) return NaN;
    let m = s.match(/^(-?\d+(?:\.\d+)?) (\d+)\/(\d+)$/); if (m) return +m[1] + m[2] / m[3]; m = s.match(/^(\d+)\/(\d+)$/); if (m) return m[1] / m[2]; const n = Number(s); return isFinite(n) ? n : NaN; }
  const nm = v => typeof v === 'number' ? v : parseDim(v);
  const f2 = x => (isFinite(x) ? (Math.abs(x) < 5e-3 ? 0 : x).toFixed(2) : '—');
  const f0 = x => isFinite(x) ? (Math.round(x) || 0).toLocaleString('en-US') : '—';   // display text (cells), as GirderDetail
  const frac = x => { const w = Math.floor(x + 1e-9), f = Math.round((x - w) * 16); if (!f) return `${w}`; let a = f, b = 16; while (a % 2 === 0) { a /= 2; b /= 2; } return w ? `${w} ${a}/${b}` : `${a}/${b}`; };
  function ckNew() { const out = []; out.add = c => { c.status = c.items.length ? worst(c.items.map(i => i.st)) : 'na'; let gi = -1; c.items.forEach((it, k) => { if (gi < 0 || RANK[it.st] > RANK[c.items[gi].st] || (RANK[it.st] === RANK[c.items[gi].st] && (it.r ?? -1) > (c.items[gi].r ?? -1))) gi = k; }); c.gov = gi; if (!c.items.length && !c.naWhy) c.naWhy = 'Not applicable to any item.'; out.push(c); }; return out; }
  const rc = (loc, cells, d, c, step) => ({ loc, cells, demand: d, capacity: c, r: d / c, st: ge(c, d) ? 'pass' : 'fail', step });

  /* ---------- sections ---------- */
  const ANGLES = { 'L3x3x3/8': [3, 3, 0.375], 'L3-1/2x3-1/2x3/8': [3.5, 3.5, 0.375], 'L4x4x3/8': [4, 4, 0.375], 'L4x4x1/2': [4, 4, 0.5], 'L5x5x3/8': [5, 5, 0.375], 'L5x5x1/2': [5, 5, 0.5], 'L6x6x3/8': [6, 6, 0.375], 'L6x6x1/2': [6, 6, 0.5], 'L6x6x5/8': [6, 6, 0.625], 'L5x3-1/2x3/8 (LLV)': [5, 3.5, 0.375], 'L6x4x1/2 (LLV)': [6, 4, 0.5] };
  /* angleProps(b1, b2, t): b1 = connected leg (along x, at y = 0..t), b2 = outstanding leg; leg rectangles, root fillet neglected */
  function angleProps(b1, b2, t) {
    const A1 = b1 * t, A2 = (b2 - t) * t, A = A1 + A2, xb = (A1 * b1 / 2 + A2 * t / 2) / A, yb = (A1 * t / 2 + A2 * (t + (b2 - t) / 2)) / A;
    const Ix = b1 * t ** 3 / 12 + A1 * (t / 2 - yb) ** 2 + t * (b2 - t) ** 3 / 12 + A2 * (t + (b2 - t) / 2 - yb) ** 2;
    const Iy = t * b1 ** 3 / 12 + A1 * (b1 / 2 - xb) ** 2 + (b2 - t) * t ** 3 / 12 + A2 * (t / 2 - xb) ** 2;
    const Ixy = A1 * (b1 / 2 - xb) * (t / 2 - yb) + A2 * (t / 2 - xb) * (t + (b2 - t) / 2 - yb);
    const Imin = (Ix + Iy) / 2 - Math.sqrt(((Ix - Iy) / 2) ** 2 + Ixy ** 2);
    return { A, rx: Math.sqrt(Ix / A), rz: Math.sqrt(Imin / A), xbar: yb, b1, b2, t };
  }
  const CF_MEM = [['top', 'Top chord'], ['bot', 'Bottom chord'], ['diag', 'Diagonals']];
  /* channels and rolled W for diaphragms: [name, d, b_f, t_f (average), t_w] in in, nominal dimensions (AISC Manual; verify) */
  const CF_CH = [['C8x11.5', 8.00, 2.26, 0.390, 0.220], ['C10x15.3', 10.0, 2.60, 0.436, 0.240], ['C12x20.7', 12.0, 2.94, 0.501, 0.282], ['MC12x31', 12.0, 3.67, 0.700, 0.370], ['C15x33.9', 15.0, 3.40, 0.650, 0.400], ['MC18x42.7', 18.0, 3.95, 0.625, 0.450]];
  const CF_DIA = [['W18x35', 17.7, 6.00, 0.425, 0.300], ['W21x44', 20.7, 6.50, 0.450, 0.350], ['W24x55', 23.6, 7.01, 0.505, 0.395], ['W24x76', 23.9, 8.99, 0.680, 0.440], ['W27x84', 26.7, 9.96, 0.640, 0.460], ['W30x99', 29.7, 10.5, 0.670, 0.520], ['W33x118', 32.9, 11.5, 0.740, 0.550], ['W36x135', 35.6, 12.0, 0.790, 0.600]];
  /* DEF: GirderDetail's built-in Cross-frames inputs (GM.cf.def) */
  const DEF = { type: 'X', S: 114, h: 48, dg: 62.5, dMinXF: 48, Lb: 25, gA: '36', gG: '50', primary: 'no', dia: { on: 'no', shape: 'W21x44', d: 20.7, bf: 6.5, tf: 0.45, tw: 0.35, gr: '50', nb: 4, pitch: 3, ecc: 3.5, end: 'no', Rj: 0, aj: 12, P: 0 },
    wind: { V: 130, Kz: 1.0, G: 1.0, Cd: 1.3 },
    mem: { top: { sec: 'L5x5x3/8', b1: 5, b2: 5, t: 0.375 }, bot: { sec: 'L5x5x3/8', b1: 5, b2: 5, t: 0.375 }, diag: { sec: 'L5x5x3/8', b1: 5, b2: 5, t: 0.375 } },
    conn: { d: '0.875', gr: 'A325', thr: 'incl', n: 2, s: 3, e: 1.5, tg: 0.5 },
    user: { StrI: { top: 0, bot: 0, diag: 0 }, Con: { top: 0, bot: 0, diag: 0 }, Fat: { top: 0, bot: 0, diag: 0 } }, fatCat: 'B',
    sb: { on: 'yes', full: 'yes', L: 110, n: 3, Mu: 2082, Cb: 1.0, D: 60, tw: 0.5625, bc: 16, tc: 0.75, bt: 16, tt: 1.125, ng: 5, bs: 5, tsp: 0.5 } };
  /* cfDiaSec(q): diaphragm section from the cf.dia inputs (preset W or channel, or a custom W): nominal dimensions, fillets neglected;
     wpf: lb/ft from the nominal area, 0.2836 lb/in³ (490 pcf) */
  function cfDiaSec(q) {
    const chS = CF_CH.find(s => s[0] === q.shape), pre = CF_DIA.find(s => s[0] === q.shape) || chS, d = pre ? pre[1] : +q.d, bf = pre ? pre[2] : +q.bf, tf = pre ? pre[3] : +q.tf, tw = pre ? pre[4] : +q.tw;
    const hw = d - 2 * tf, A = 2 * bf * tf + hw * tw;
    return { chS, pre, d, bf, tf, tw, hw, A, wpf: A * 12 * 0.2836, nm_: pre ? q.shape : `W ${f2(d)} x ${f2(bf)}` };
  }
  const cfDiaOn = p => ((p || {}).dia || {}).on === 'yes';
  const cfDiaGap = q => Math.max(0.5, (+q.ecc || 3.5) - 1.5);   // diaphragm end from each girder web: bolt line less a 1.5 in end distance (assumption)
  const cfDiaEnd = q => ({ ...q, shape: q.eShape || q.shape, nb: +q.eNb >= 2 ? q.eNb : q.nb });   // end (bearing-line) diaphragms: own shape / bolts, else the intermediate

  /* ---------- environment (GirderDetail page state) ---------- */
  function env0(env) {
    const e = env || {}, O = window.SBDOwners, owner = e.owner || 'AASHTO';
    return { owner, lf: e.lf || { eta: 1 }, rule: e.rule || (id => (O ? O.rule(owner, id) : null)), cite: e.cite || (r => (O ? O.cite(r) : (r ? `${r.owner} ${r.sec}` : ''))),
      ts: e.ts || null, bs: e.bs || null, skews: Array.isArray(e.skews) ? e.skews : null };
  }
  /* cfTypeRec(p, E): recommended intermediate bracing type from the girder depth (GirderDetail cfTypeRec; owner rules OWN34–OWN36) */
  function cfTypeRec(p, E) {
    const rT = E.rule('xf.type'), rDd = E.rule('dia.depth'), Dw = nm(p.sb && p.sb.D) > 0 ? nm(p.sb.D) : null;
    const dg = nm(p.dg), dMin = nm(p.dMinXF), S = nm(p.S), h = nm(p.h), web = !!(rT && rT.value.web), dB = web && Dw ? Dw : dg, xf = (p.dia || {}).on !== 'yes';
    const deep = rT && rT.value.strict ? dB > dMin + 1e-9 : dB >= dMin - 1e-9, frac_ = rDd && dg < rDd.value.D - 1e-9 ? rDd.value.frac : 0.75;
    const ch = CF_CH.filter(s => s[1] >= frac_ * dg - 1e-9).sort((a, b) => (2 * a[2] * a[3] + (a[1] - 2 * a[3]) * a[4]) - (2 * b[2] * b[3] + (b[1] - 2 * b[3]) * b[4]))[0], w = CF_DIA.find(s => s[1] >= frac_ * dg - 1e-9);
    const skM = rT && rT.value.table ? (E.skews ? Math.max(0, ...E.skews.map(v => Math.abs(+v || 0))) : 0) : 0;
    const tb = rT && rT.value.table && !deep ? rT.value.table.find(q => dB >= q[0] - 1e-9 && dB <= q[1] + 1e-9) || rT.value.table.find((q, i, A) => i > 0 && dB > A[i - 1][1] && dB < q[0]) : null;
    const chT = tb && skM < rT.value.skT - 1e-9 ? tb[2] : null;
    const sd = S / dg, kx = rT && rT.value.kHi ? (sd >= rT.value.kHi - 1e-9 ? 'K' : sd <= rT.value.xLo + 1e-9 ? 'X' : null) : null;
    const rec = deep ? (kx ? `${kx === 'K' ? 'K (bottom)' : 'X'}-frame (S/d = ${f2(sd)}, ${E.cite(rT)})` : `${S / h > 1.5 ? 'K (bottom)' : 'X'}-frame (S/h = ${f2(S / h)})`) : ch ? `channel diaphragm ${ch[0]} (or a rolled W)` : w ? `rolled diaphragm ${w[0]}` : 'rolled W diaphragm';
    const sel = xf ? ({ X: 'X-frame', Kb: 'K-frame', Kt: 'K-frame' }[p.type] || 'cross-frame') : `${CF_CH.some(s => s[0] === (p.dia || {}).shape) ? 'channel' : 'rolled'} diaphragm ${(p.dia || {}).shape === 'custom' ? 'custom W' : (p.dia || {}).shape}`;
    return { dg, dMin, deep, xf, rec, sel, ch: ch && ch[0], w: w && w[0], frac: frac_, dB, web, Dw, sd, kx, chT, skM, rT, rDd };
  }
  /* cfTsCP(E): the Transverse stiffeners type with role "Connection plate" (most rows; a tie to Type B); null when none (CF-D13) */
  function cfTsCP(E) {
    const T = E.ts; if (!T || !T.types) return null;
    const n = k => (T.rows || []).filter(r => r && r.type === k).length, ok = Object.entries(T.types).filter(([k, t]) => t && t.role === 'cp' && nm(t.bt) > 0 && nm(t.tp) > 0);
    if (!ok.length) return null;
    ok.sort((a, b) => n(b[0]) - n(a[0]) || (a[0] === 'B' ? -1 : b[0] === 'B' ? 1 : a[0] < b[0] ? -1 : 1));
    const [k, t] = ok[0];
    return { k, name: String(t.name || ''), bt: nm(t.bt), tp: nm(t.tp), c: nm(t.c), pair: String(t.sides) === '2', n: n(k), alt: ok.slice(1).map(x => x[0]) };
  }
  const cfCPsize = (p, E) => { const t = cfTsCP(E); if (t) return { bs: t.bt, tp: t.tp, ts: t }; const sb = (p && p.sb) || {}; return { bs: nm(sb.bs), tp: nm(sb.tsp), ts: null }; };
  /* cfBsCP(E): of the bearing stiffener types used at the bearings, the narrowest (the larger clip on a tie); null when none */
  function cfBsCP(E) {
    const B = E.bs; if (!B || !B.types) return null;
    const used = [...new Set((B.rows || []).map(r => r && r.type))].filter(k => B.types[k] && nm(B.types[k].bt) > 0 && nm(B.types[k].tp) > 0);
    if (!used.length) return null;
    used.sort((a, b) => nm(B.types[a].bt) - nm(B.types[b].bt) || nm(B.types[b].c) - nm(B.types[a].c));
    const k = used[0], t = B.types[k];
    return { k, name: String(t.name || ''), bt: nm(t.bt), tp: nm(t.tp), c: nm(t.c), np: +t.np || 1, alt: used.slice(1) };
  }
  /* cfCP(p, end, E): the connection plate b_s × t_p and clip c (end: the bearing stiffener when there is one); src 'ts' | 'bs' | 'cf' */
  function cfCP(p, end, E) {
    const sb = (p && p.sb) || {}, tw = nm(sb.tw) > 0 ? nm(sb.tw) : 0.5, b = end ? cfBsCP(E) : null, t = cfTsCP(E);
    if (b) return { bs: b.bt, tp: b.tp, tw, c: b.c > 0 ? b.c : 1, src: 'bs', bsT: b, ts: t };
    if (t) return { bs: t.bt, tp: t.tp, tw, c: t.c > 0 ? t.c : 1, src: 'ts', ts: t };
    const bs = nm(sb.bs) > 0 ? nm(sb.bs) : 5, tp = nm(sb.tsp) > 0 ? nm(sb.tsp) : 0.5, tsB = E.ts && E.ts.types && E.ts.types.B;
    return { bs, tp, tw, c: tsB && +tsB.c > 0 ? +tsB.c : 1, src: 'cf', ts: null, cB: !!(tsB && +tsB.c > 0) };
  }
  /* cfDiaFit: bolt row on the connection plate, end bolts, diaphragm end clear of the web; the items that do not fit */
  function cfDiaFit(R, q, cp, tB, tT) {
    const dg = nm(R.p.dg), ecc = +q.ecc || 3.5, nb = Math.max(2, Math.round(+q.nb || 2)), s = +q.pitch || 3, em = R.emin, gap = cfDiaGap(q), bad = [];
    const edge = cp.tw / 2 + cp.bs - ecc, yEnd = dg / 2 - (nb - 1) / 2 * s, vEdge = Math.min(yEnd - tB - cp.c, dg - tT - cp.c - (dg / 2 + (nb - 1) / 2 * s)), lap = cp.tw / 2 + cp.bs - gap;
    if (edge < em - 1e-9) bad.push(edge < 0 ? `bolt line ${f2(ecc)} in from the web is outside the ${frac(cp.bs)} in plate (free edge at ${f2(cp.tw / 2 + cp.bs)} in)` : `edge distance to the plate's free edge ${f2(edge)} in < ${frac(em)} in`);
    if (vEdge < em - 1e-9) bad.push(`end bolt to the plate end (clip) ${f2(vEdge)} in < ${frac(em)} in`);
    if (gap < cp.tw / 2 + 1e-9) bad.push(`diaphragm end ${f2(gap)} in from the web centerline reaches the web`);
    return { ecc, edge, vEdge, lap, gap, em, bad };
  }

  /* ================= compute (GM.cf.compute, unchanged arithmetic) ================= */
  function compute(p, env) {
    const E = env0(env), errors = [], g = k => nm(p[k]);
    ['S', 'h', 'dg', 'Lb'].forEach(k => { if (!(g(k) > 0)) errors.push(`"${k}" must be positive.`); });
    ['V', 'Kz', 'G', 'Cd'].forEach(k => { if (!(nm(p.wind[k]) >= 0)) errors.push(`Wind "${k}" must be zero or positive.`); });
    const mem = {}; CF_MEM.forEach(([k, l]) => { const m = p.mem[k], dims = m.sec === 'custom' ? [nm(m.b1), nm(m.b2), nm(m.t)] : ANGLES[m.sec];
      if (!dims || !(dims[0] > 0 && dims[1] > 0 && dims[2] > 0 && dims[2] < Math.min(dims[0], dims[1]))) errors.push(`${l}: angle dimensions are invalid.`); else mem[k] = { k, l, name: m.sec === 'custom' ? `L${f2(dims[0])}x${f2(dims[1])}x${frac(dims[2])}` : m.sec.replace(' (LLV)', ''), ...angleProps(...dims) }; });
    const C = p.conn, n = +C.n; if (!(Number.isInteger(n) && n >= 1)) errors.push('Bolts per member end must be a whole number.'); else if (n < 2) errors.push('Bolts per member end must be at least 2 (AASHTO LRFD 6.13.1; with one bolt the shear lag factor U is undefined).');
    ['s', 'e', 'tg'].forEach(k => { if (!(nm(C[k]) > 0)) errors.push(`Connection "${k}" must be positive.`); });
    if (!(nm(p.dMinXF) > 0)) errors.push('The minimum girder depth for cross-frames must be positive.');
    ['StrI', 'Con'].forEach(c => ['top', 'bot', 'diag'].forEach(k => { if (!isFinite(nm(p.user[c][k]))) errors.push(`User force ${c} ${k} must be a number.`); }));
    if (errors.length) return { errors };
    const S = g('S'), h = g('h');
    // truss model: nodes and members
    const N = { TL: [0, h], TR: [S, h], BL: [0, 0], BR: [S, 0] }, EL = [];
    const addM = (a, b, k, lbl) => EL.push({ a, b, k, lbl });
    if (p.type === 'X') { addM('TL', 'TR', 'top', 'Top chord'); addM('BL', 'BR', 'bot', 'Bottom chord'); addM('BL', 'TR', 'diag', 'Diagonal 1'); addM('TL', 'BR', 'diag', 'Diagonal 2'); }
    else if (p.type === 'Kb') { N.MB = [S / 2, 0]; addM('TL', 'TR', 'top', 'Top chord'); addM('BL', 'MB', 'bot', 'Bottom chord 1'); addM('MB', 'BR', 'bot', 'Bottom chord 2'); addM('TL', 'MB', 'diag', 'Diagonal 1'); addM('TR', 'MB', 'diag', 'Diagonal 2'); }
    else { N.MT = [S / 2, h]; addM('TL', 'MT', 'top', 'Top chord 1'); addM('MT', 'TR', 'top', 'Top chord 2'); addM('BL', 'BR', 'bot', 'Bottom chord'); addM('BL', 'MT', 'diag', 'Diagonal 1'); addM('BR', 'MT', 'diag', 'Diagonal 2'); }
    addM('TL', 'BL', 'web', 'Girder web'); addM('TR', 'BR', 'web', 'Girder web');
    const keys = Object.keys(N), idx = Object.fromEntries(keys.map((k, i) => [k, i])), nd = keys.length * 2, K = [...Array(nd)].map(() => new Float64Array(nd));
    EL.forEach(e => { const [x1, y1] = N[e.a], [x2, y2] = N[e.b], L = Math.hypot(x2 - x1, y2 - y1), c = (x2 - x1) / L, s = (y2 - y1) / L, EA = ES * (e.k === 'web' ? 1000 : mem[e.k].A);
      Object.assign(e, { L, c, s }); const kk = EA / L, m = [[c * c, c * s], [c * s, s * s]], dof = [2 * idx[e.a], 2 * idx[e.a] + 1, 2 * idx[e.b], 2 * idx[e.b] + 1];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) K[dof[i]][dof[j]] += kk * m[i % 2][j % 2] * ((i < 2) === (j < 2) ? 1 : -1); });
    const solve = (fixN, loads) => {   // loads: [[node, fx, fy]]; returns member forces (tension +)
      const fixed = new Set(fixN.flatMap(k => [2 * idx[k], 2 * idx[k] + 1])), free = [...Array(nd).keys()].filter(i => !fixed.has(i));
      const Fv = new Float64Array(nd); loads.forEach(([k, fx, fy]) => { Fv[2 * idx[k]] += fx; Fv[2 * idx[k] + 1] += fy; });
      const A = free.map(i => free.map(j => K[i][j])), bvec = free.map(i => Fv[i]);
      for (let i = 0; i < A.length; i++) { let pv = i; for (let r = i + 1; r < A.length; r++) if (Math.abs(A[r][i]) > Math.abs(A[pv][i])) pv = r; [A[i], A[pv]] = [A[pv], A[i]]; [bvec[i], bvec[pv]] = [bvec[pv], bvec[i]];
        for (let r = i + 1; r < A.length; r++) { const f = A[r][i] / A[i][i]; for (let c2 = i; c2 < A.length; c2++) A[r][c2] -= f * A[i][c2]; bvec[r] -= f * bvec[i]; } }
      const xs = new Float64Array(A.length); for (let i = A.length - 1; i >= 0; i--) { let s2 = bvec[i]; for (let j = i + 1; j < A.length; j++) s2 -= A[i][j] * xs[j]; xs[i] = s2 / A[i][i]; }
      const U = new Float64Array(nd); free.forEach((d, i) => U[d] = xs[i]);
      return EL.map(e => { const EA = ES * (e.k === 'web' ? 1000 : mem[e.k].A), ia = idx[e.a], ib = idx[e.b]; return EA / e.L * ((U[2 * ib] - U[2 * ia]) * e.c + (U[2 * ib + 1] - U[2 * ia + 1]) * e.s); });
    };
    // case 1: unit horizontal load at the exterior girder bottom flange, top chord work points held by the deck
    solve(['TL', 'TR'], [['BL', 1, 0]]).forEach((f, i) => EL[i].unit = f);
    // case 2: unit torsional brace moment (1 kip-in) on the left girder, reacted by the right girder
    solve(['TR', 'BR'], [['TL', 1 / h, 0], ['BL', -1 / h, 0]]).forEach((f, i) => EL[i].ubr = f);
    // wind
    const PZ = V => 2.56e-6 * V ** 2 * nm(p.wind.Kz) * nm(p.wind.G) * nm(p.wind.Cd), dft = g('dg') / 12, Lb = g('Lb');
    const gWS = 1.0 * E.lf.eta, W = { III: { V: nm(p.wind.V) }, V: { V: 80 } }; Object.values(W).forEach(w => { w.PZ = PZ(w.V); w.W = gWS * w.PZ * dft / 2; w.Fw = w.W * Lb; });   // OWN7: γ_WS = 1.0 × η at Strength III and V
    // stability bracing strength for deck placement (AASHTO LRFD 10th Ed. 6.7.4.2.2; AISC App. 6.3.2a form)
    const sb = p.sb || {}, sbOn = sb.on === 'yes';
    let SB = null;
    if (sbOn) { const gd = k => nm(sb[k]), Dg = gd('D'), tc = gd('tc'), bc = gd('bc'), tt = gd('tt'), bt = gd('bt'), tw = gd('tw');
      const s0 = SEC().steelCore({ D: Dg, tw, topB: bc, topT: tc, botB: bt, botT: tt }), yc = s0.d - tc / 2, yt = tt / 2, cD = yc - s0.yb, tD = s0.yb - yt;
      const Iyc = tc * bc ** 3 / 12, Iyt = tt * bt ** 3 / 12, Iyeff = Iyc + tD / cD * Iyt, ho = Dg + (tc + tt) / 2, L = gd('L') * 12, n = gd('n'), Mu = gd('Mu') * 12, Cb = gd('Cb'), Lb = g('Lb') * 12;
      const hBr = cfDiaOn(p) && cfDiaSec(p.dia).d > 0 ? cfDiaSec(p.dia).d : h;   // bracing depth for the 0.8 D test: the diaphragm's own depth when the diaphragm is used, else h
      const deepFrame = hBr >= 0.8 * Dg, C = sb.full === 'yes' && deepFrame ? 2.4 : 3.6, Mbr = C * L / (n * ES * Iyeff) * (Mu / Cb) ** 2 * Lb / (500 * ho);
      SB = { Dg, tc, bc, tt, bt, tw, Iyc, Iyt, Iyeff, cD, tD, ho, L, n, Mu, Cb, Lb, C, Mbr, full: sb.full === 'yes' && deepFrame, fullSet: sb.full === 'yes', deepFrame, hBr };
      // torsional brace system stiffness (6.7.4.2.2): brace, web distortion, girder in-plane stiffness, in series
      const Rf = 0.65, Ad = Rf * mem.diag.A, isX = p.type === 'X', Lc = isX ? Math.hypot(S, h) : Math.hypot(S / 2, h), Ah = Rf * (p.type === 'Kb' ? mem.top.A : mem.bot.A);
      const bbr = isX ? Ad * ES * S ** 2 * h ** 2 / Lc ** 3 : 2 * ES * S ** 2 * h ** 2 / (8 * Lc ** 3 / Ad + S ** 3 / Ah);
      const cpS = cfCPsize(p, E), deep = hBr >= 0.8 * Dg, bs = cpS.bs, tsp = cpS.tp, bsec = deep ? Infinity : 3.3 * ES / ho * (1.5 * ho * tw ** 3 / 12 + tsp * bs ** 3 / 12);
      const ng = Math.max(2, Math.round(gd('ng') || 2)), bg = 24 * (ng - 1) ** 2 * S ** 2 * ES * s0.I / (ng * L ** 3), bT = 1 / (1 / bbr + (isFinite(bsec) ? 1 / bsec : 0) + 1 / bg);
      const Cs = SB.full ? 2.4 : 3.6 / 0.75, bReq = Cs * L * Mu ** 2 / (n * ES * Iyeff * Cb ** 2);
      Object.assign(SB, { Rf, Ad, Lc, Ah, isX, bbr, deep, bs, tsp, cpTs: cpS.ts, bsec, ng, bg, bT, Cs, bReq, Ix: s0.I }); }
    const combos = [{ id: 'StrI', name: 'Strength I (analysis forces)', wind: 0, user: p.user.StrI }, { id: 'StrIII', name: 'Strength III (wind)', wind: W.III.Fw, user: null }, { id: 'StrV', name: 'Strength V (80 mph wind)', wind: W.V.Fw, user: null }, { id: 'Con', name: SB ? 'Constructibility (analysis forces + stability bracing)' : 'Constructibility (analysis forces)', wind: 0, user: p.user.Con, Mbr: SB ? SB.Mbr : 0 }];
    const frames = EL.filter(e => e.k !== 'web');
    combos.forEach(cb => { cb.f = frames.map(e => { const w = Math.abs(e.unit * cb.wind) + Math.abs(e.ubr * (cb.Mbr || 0)), u = cb.user ? nm(cb.user[e.k]) : 0; return { e, w, u, br: Math.abs(e.ubr * (cb.Mbr || 0)), T: Math.max(0, u + w), Cc: Math.max(0, -(u - w)) }; }); });
    // member design demands (max over combos, per member group)
    const Fy = GD_GR[p.gA].Fy, Fu = GD_GR[p.gA].Fu, bolt = BOLT[C.d], Fub = FUB[C.gr], thr = C.thr === 'excl' ? 0.56 : 0.45, s = nm(C.s), e0 = nm(C.e), tg = nm(C.tg), Fug = GD_GR[p.gG].Fu, dh = bolt.dh, dn = dh + 0.0625;   // dn: net-area hole width (6.8.3)
    Object.values(mem).forEach(m => { const els = frames.filter(e => e.k === m.k); m.L = Math.max(...els.map(e => e.L)); m.els = els;
      m.Tu = 0; m.Cu = 0; m.cT = ''; m.cC = ''; combos.forEach(cb => cb.f.filter(q => q.e.k === m.k).forEach(q => { if (q.T > m.Tu) { m.Tu = q.T; m.cT = cb.id; } if (q.Cc > m.Cu) { m.Cu = q.Cc; m.cC = cb.id; } }));
      m.lrx = m.L / m.rx; m.KLr = m.lrx <= 80 ? 72 + 0.75 * m.lrx : Math.min(32 + 1.25 * m.lrx, 200);
      m.bt = m.b1 / m.t; m.lim = 0.45 * Math.sqrt(ES / Fy); m.Q = m.bt <= m.lim ? 1 : m.bt <= 0.91 * Math.sqrt(ES / Fy) ? 1.34 - 0.76 * m.bt * Math.sqrt(Fy / ES) : 0.53 * ES / (Fy * m.bt ** 2);
      m.bt2 = m.b2 / m.t; if (m.bt2 > m.bt) { m.bt = m.bt2; m.Q = m.bt <= m.lim ? 1 : m.bt <= 0.91 * Math.sqrt(ES / Fy) ? 1.34 - 0.76 * m.bt * Math.sqrt(Fy / ES) : 0.53 * ES / (Fy * m.bt ** 2); }
      m.Po = m.Q * Fy * m.A; m.Pe = Math.PI ** 2 * ES * m.A / m.KLr ** 2; m.Pn = m.Pe >= 0.44 * m.Po ? Math.pow(0.658, m.Po / m.Pe) * m.Po : 0.877 * m.Pe; m.Pr = 0.95 * m.Pn;
      m.Pyr = PHI.y * Fy * m.A; m.An = m.A - dn * m.t; m.Lc = (n - 1) * s; m.U = n >= 4 ? 0.80 : n === 3 ? 0.60 : n === 2 ? Math.max(0, 1 - m.xbar / m.Lc) : 0; m.Pur = PHI.u * Fu * m.An * m.U;
      m.slC = m.L / m.rz; m.slT = m.L / m.rz; m.Fmax = Math.max(m.Tu, m.Cu);
      m.phRb = PHI.s * thr * bolt.Ab * Fub; m.boltR = n * m.phRb;
      const brg = (t, F) => { let tot = 0; for (let i = 0; i < n; i++) { const Lc = i === 0 ? e0 - dh / 2 : s - dh; tot += Math.min(2.4 * bolt.d * t * F, 1.2 * Lc * t * F); } return PHI.bb * tot; };
      m.brgA = brg(m.t, Fu); m.brgG = brg(tg, Fug); m.brgR = Math.min(m.brgA, m.brgG);
      m.gage = ({ 3: 1.75, 3.5: 2, 4: 2.5, 5: 3, 6: 3.5, 7: 4, 8: 4.5 })[m.b1] || Math.round(m.b1 * 0.55 * 8) / 8; m.edge = m.b1 - m.gage; });
    const FT = { B: 16, E: 4.5, Ep: 2.6 }[p.fatCat || 'B'], gF = 1.75 * 0.65; Object.values(mem).forEach(m => { m.dP = nm((p.user.Fat || {})[m.k]) || 0; m.df = gF * m.dP / m.A; });
    const R = { errors: [], p, N, EL, frames, combos, W, SB, emin: bolt.emin.cut, mem, Fy, Fu, n, s, e0, tg, bolt, Fub, thr, dh, S, h, Lb, dft, FT, gF, primary: p.primary === 'yes', E, gWS };
    R.steps = steps(R);
    return R;
  }

  /* ================= checks (GM.cf.checks, with cfDiaChecks) ================= */
  function checks(R) {
    const E = R.E || env0(), out = ckNew(), M = Object.values(R.mem), lims = R.primary ? { c: 120, t: 140 } : { c: 140, t: 240 }, CN = { StrI: 'Strength I', StrIII: 'Strength III', StrV: 'Strength V', Con: 'Constructibility' };
    { const c = { id: 'CF1', grp: 'Members', title: 'Compression resistance, single angles', ref: `${ED} Arts. 6.9.4.4, 6.9.4.1.1`, items: [],
        note: 'Single angles connected through one leg, with adjacent members on the same side of the gusset. r_x is about the geometric axis parallel to the connected leg. Angle properties from the leg rectangles with the root fillet neglected (within about 1 to 2 % of the AISC tables). Q: the single-angle slender-leg reduction when b/t > 0.45√(E/F_y).' };
      M.forEach(m => c.items.push(rc(`${m.l} (${m.name}), ${CN[m.cC] || m.cC || '—'}`, [f2(m.Cu), f2(m.lrx), f2(m.KLr), f2(m.Pr), f2(m.Cu / m.Pr)], m.Cu, m.Pr, `cf.${m.k}.Pr`))); out.add(c); }
    { const c = { id: 'CF2', grp: 'Members', title: 'Tension resistance', ref: `${ED} Art. 6.8.2.1, Table 6.8.2.2-1`, items: [],
        note: `U for a single angle bolted through one leg: 0.80 with four or more bolts in the line of force, 0.60 with three, 1 − x̄/L with two (Table 6.8.2.2-1). A_n deducts one standard hole plus 1/16 in (${f2(R.dh + 0.0625)} in, 6.8.3).` };
      M.forEach(m => { const cap = Math.min(m.Pyr, m.Pur); c.items.push(rc(`${m.l} (${m.name}), ${CN[m.cT] || m.cT || '—'}`, [f2(m.Tu), f2(m.Pyr), f2(m.Pur), f2(m.Tu / cap)], m.Tu, cap, `cf.${m.k}.Pt`)); }); out.add(c); }
    { const c = { id: 'CF3', grp: 'Members', title: `Slenderness limits (ℓ/r ≤ ${lims.c} compression, ≤ ${lims.t} tension)`, ref: `${ED} Arts. 6.9.3, 6.8.4`, items: [],
        note: `${R.primary ? 'Primary' : 'Secondary'} members (cross-frames in curved or skewed bridges should be treated as primary). r is the least radius of gyration r_z.` };
      M.forEach(m => { const lim = m.Cu > 0 ? lims.c : lims.t; c.items.push(rc(`${m.l} (${m.name})`, [f2(m.slC), String(lims.c), String(lims.t)], m.slC, lim, `cf.${m.k}.sl`)); }); out.add(c); }
    { const c = { id: 'CF4', grp: 'Connections', title: 'Bolt shear, member end connections', ref: `${ED} Art. 6.13.2.7`, items: [],
        note: `Single shear, threads ${R.p.conn.thr === 'excl' ? 'excluded' : 'included'}. At least two bolts at each end (6.9.4.4). Cross-frame member joints with pretensioned bolts in standard holes are bearing-type connections (6.13.2.1.1), so slip is not checked.` };
      M.forEach(m => { const it = rc(`${m.l} (${m.name})`, [f2(m.Fmax), String(R.n), f2(m.boltR), f2(m.Fmax / m.boltR)], m.Fmax, m.boltR, `cf.${m.k}.bolt`); if (R.n < 2) it.st = 'fail'; c.items.push(it); }); out.add(c); }
    { const c = { id: 'CF5', grp: 'Connections', title: 'Bolt bearing on the angle and gusset', ref: `${ED} Art. 6.13.2.9`, items: [] };
      M.forEach(m => c.items.push(rc(`${m.l} (${m.name})`, [f2(m.Fmax), f2(m.brgA), f2(m.brgG), f2(m.Fmax / m.brgR)], m.Fmax, m.brgR, `cf.${m.k}.brg`))); out.add(c); }
    { const d = R.bolt.d, em = R.emin, c = { id: 'CF6', grp: 'Connections', title: 'Connection geometry and minimum thickness', ref: `${ED} Art. 6.13.2.6, Table 6.13.2.6.6-1, Arts. 6.7.3, 6.9.4.4`, items: [],
        note: `One line of bolts on the usual AISC workable gage of the connected leg; e_min = ${frac(em)} in for rolled or thermally cut edges (${frac(d)} in bolts). Edge distance from the bolt line to the toe of the connected leg.` };
      const add = (loc, v, lim, ok, r, demand, capacity) => c.items.push({ loc, cells: [v, lim], st: ok ? 'pass' : 'fail', r, demand, capacity, step: 'cf.geo' });
      add('All members, bolt pitch', `${frac(R.s)} in`, `≥ ${frac(3 * d)} in`, ge(R.s, 3 * d), 3 * d / R.s, R.s, 3 * d);
      add('All members, end distance', `${frac(R.e0)} in`, `≥ ${frac(em)} in`, ge(R.e0, em), em / R.e0, R.e0, em);
      add('All members, bolts per end', String(R.n), '≥ 2', R.n >= 2, undefined, R.n, 2);
      add('Gusset plate thickness', `${frac(R.tg)} in`, '≥ 5/16 in', ge(R.tg, 0.3125), 0.3125 / R.tg, R.tg, 0.3125);
      M.forEach(m => { const emx = Math.min(8 * m.t, 5);
        add(`${m.l} (${m.name}), edge distance`, `${frac(m.edge)} in (g = ${frac(m.gage)})`, `${frac(em)} to ${frac(emx)} in`, ge(m.edge, em) && ge(emx, m.edge), Math.max(em / m.edge, m.edge / emx), m.edge, emx);
        add(`${m.l} (${m.name}), thickness`, `${frac(m.t)} in`, '≥ 5/16 in', ge(m.t, 0.3125), 0.3125 / m.t, m.t, 0.3125); });
      out.add(c); }
    { const c = { id: 'CF7', grp: 'Members', title: 'Stability bracing strength during deck placement', ref: `${ED} Art. 6.7.4.2.2, Eqs. 6.7.4.2.2-14, -15`, items: [],
        note: 'M_br is applied to the truss as a horizontal couple M_br/h at the chord work points of one girder, reacted by the adjacent girder. Brace forces can act in either direction. The stiffness requirement is CF8.' };
      if (!R.SB) c.naWhy = 'Stability bracing check turned off.';
      else { const cb = R.combos.find(x => x.id === 'Con');
        M.forEach(m => { const q = cb.f.filter(z => z.e.k === m.k), br = Math.max(...q.map(z => z.br)), tot = Math.max(m.Cu, m.Tu), cap = m.Cu >= m.Tu ? m.Pr : Math.min(m.Pyr, m.Pur);
          c.items.push(rc(`${m.l} (${m.name})`, [f2(br), f2(tot), f2(cap), f2(tot / cap)], tot, cap, 'cf.sb.Mbr')); }); }
      out.add(c); }
    { const c = { id: 'CF8', grp: 'Members', title: 'Stability bracing stiffness during deck placement', ref: `${ED} Art. 6.7.4.2.2 (torsional brace system stiffness); C4.6.3.3.4 (R = 0.65)`, items: [],
        note: 'Brace stiffness from the diagonal (and, for K frames, the horizontal) area reduced by R = 0.65 for single-angle end-connection eccentricity; X frames taken as tension-only diagonals. β_sec is infinite when the cross-frame is at least 0.8 of the web depth. β_g = 24(n_g − 1)²S²EI_x/(n_gL³): if it alone is below the requirement, stiffer cross-frames cannot help. C = 2.4 for cross-frames at least 0.8 of the girder depth on full-depth connection plates attached to both flanges, otherwise 3.6/φ with φ = 0.75 (AISC Appendix 6 form; confirm the coefficient with the edition in use).' };
      if (!R.SB) c.naWhy = 'Stability bracing check turned off.';
      else { const S = R.SB, it = (loc, v, st, step) => c.items.push({ loc, cells: [isFinite(v) ? f0(v) : '∞', f0(S.bReq), isFinite(v) ? f2(S.bReq / v) : '0.00'], r: isFinite(v) ? S.bReq / v : 0, st, demand: S.bReq, capacity: v, step });
        it('Brace, β_br', S.bbr, 'pass', 'cf.sb.bbr'); it('Web distortion, β_sec', S.bsec, 'pass', 'cf.sb.bsec'); it('Girder in-plane, β_g', S.bg, S.bg >= S.bReq ? 'pass' : 'fail', 'cf.sb.bg');
        c.items.push({ loc: 'System, β_T', cells: [f0(S.bT), f0(S.bReq), f2(S.bReq / S.bT)], r: S.bReq / S.bT, st: S.bT >= S.bReq ? 'pass' : 'fail', demand: S.bReq, capacity: S.bT, step: 'cf.sb.bT' }); }
      out.add(c); }
    { const c = { id: 'CF9', grp: 'Members', title: 'Fatigue of cross-frame members', ref: `${ED} Art. 6.6.1.2, Table 3.4.1-1 (Fatigue I factor × 0.65 for cross-frames)`, items: [],
        note: 'Force ranges from a refined analysis of the fatigue truck (a line-girder analysis gives none). γ = 1.75 × 0.65 for Fatigue I (10th Edition cross-frame provisions, NCHRP 12-113).' };
      const Ms = M.filter(m => m.dP > 0); if (!Ms.length) c.naWhy = 'No fatigue force ranges entered (from a refined analysis).';
      Ms.forEach(m => c.items.push(rc(`${m.l} (${m.name})`, [f2(m.dP), f2(m.df), f2(R.FT), f2(m.df / R.FT)], m.df, R.FT, `cf.${m.k}.fat`))); out.add(c); }
    // diaphragm used: the angle checks CF1 to CF9 do not apply and are not listed (GirderDetail 2026-10-13)
    if (cfDiaOn(R.p)) for (let i = out.length - 1; i >= 0; i--) if (/^CF[1-9]$/.test(out[i].id)) out.splice(i, 1);
    cfDiaChecks(R, out); cfDiaChecks(R, out, true);
    { const TR = cfTypeRec(R.p, E), c = { id: 'CF10', grp: 'Bracing type', title: 'Intermediate bracing type for the girder depth', ref: TR.rT || TR.rDd ? `${[TR.rT, TR.rDd].filter(Boolean).map(E.cite).join('; ')}; ${ED} Art. 6.7.4.2` : `Common practice (e.g. AISC/NSBA G13.1 guidance; owner standards govern); ${ED} Art. 6.7.4.2`, items: [],
        note: 'Basis: the girder depth d (out-to-out of the flanges), not the web depth. Below the minimum, a channel or rolled W diaphragm at least 0.75 of the girder depth (6.7.4.2, plate girders) is used.' };
      if (TR.rT || TR.rDd) c.note += ` Owner rule: ${[TR.rT, TR.rDd].filter(Boolean).map(r => `${E.cite(r)}: ${r.text}`).join('; ')}.`;
      const shall = !!(TR.rT && TR.rT.value.shallXF && TR.deep && !TR.xf);
      c.items.push({ loc: 'Intermediate bracing', cells: [`${f2(TR.dB)} in${TR.web ? ' (web D)' : ''}`, `${f2(TR.dMin)} in`, TR.rec, TR.sel], st: shall ? 'fail' : TR.deep || !TR.xf ? 'pass' : 'warn', demand: TR.dB, capacity: TR.dMin, step: 'cf.type' });
      out.add(c); }
    { const TR = cfTypeRec(R.p, E), rB = E.rule('xf.bolts'), rT = TR.rT;   // OWN34, OWN35, OWN37
      if (rT || rB) { const dOn = cfDiaOn(R.p), q = R.p.dia || {}, c = { id: 'CF11', grp: 'Bracing type', title: 'Owner: cross-frame and diaphragm details', ref: [rT, rB].filter(Boolean).map(E.cite).join('; '), items: [],
          note: [rT, rB].filter(Boolean).map(r => `${E.cite(r)}: ${r.text}.`).join(' ') + ' The member and connection checks above are unchanged by these items.' };
        if (rT && rT.value.kHi && !dOn) { const ty = R.p.type, isK = ty === 'Kb' || ty === 'Kt', bad = (TR.kx === 'K' && !isK) || (TR.kx === 'X' && isK);
          c.items.push({ loc: 'X or K by girder spacing to girder depth S/d', cells: [`S/d = ${f2(TR.sd)}, ${isK ? 'K' : 'X'}-frame`, `X when S/d ≤ ${f2(rT.value.xLo)}, K when ≥ ${f2(rT.value.kHi)}`], st: bad ? 'fail' : 'pass', step: 'cf.type' }); }
        if (rT && rT.value.members) { c.items.push({ loc: 'Single members (no back-to-back members)', cells: [dOn ? `${q.shape === 'custom' ? 'custom W' : q.shape || 'diaphragm'} (single section)` : 'single angles', 'single angles, tees, channels or W sections'], st: 'pass' });
          c.items.push({ loc: 'Bottom chord (under-clearance less than 16 ft 3 in)', cells: [dOn ? 'diaphragm (full section)' : `${{ X: 'X', Kb: 'K (bottom)', Kt: 'K (top)' }[R.p.type] || ''}-frame with a bottom chord`, 'a bottom chord on every cross-frame'], st: 'pass' }); }
        if (rT && rT.value.table && dOn && !TR.deep) { const ok = !TR.chT || q.shape === TR.chT;
          c.items.push({ loc: 'Intermediate channel diaphragm (Table 6.7.4.2-1)', cells: [String(q.shape === 'custom' ? 'custom W' : q.shape || '—'), TR.chT ? `${TR.chT} for D = ${f2(TR.dB)} in` : TR.skM >= rT.value.skT - 1e-9 ? `skew ${f2(TR.skM)}° ≥ ${rT.value.skT}°: designed` : `D = ${f2(TR.dB)} in outside the table: designed`], st: ok ? 'pass' : 'adv' }); }
        if (rT && rT.value.endCh) { if (dOn) { const e = cfDiaEnd(q), ok = rT.value.endCh.includes(e.shape);
            c.items.push({ loc: 'End bearing diaphragms (6.7.4.2.1bCT)', cells: [String(cfDiaSec(e).nm_), `channel, preferably ${rT.value.endCh.join(' or ')}`], st: ok ? 'pass' : 'warn' }); }
          else c.items.push({ loc: 'End bearing cross-frames (6.7.4.2.2bCT)', cells: ['the intermediate type (this module)', 'K-frame with a channel top chord'], st: 'adv' }); }
        if (rB) { const n = dOn ? Math.max(2, Math.round(+q.nb || 2)) : Math.round(+(R.p.conn || {}).n || 0), ok = n >= rB.value.n;
          c.items.push({ loc: dOn ? 'Bolts per diaphragm end' : 'Bolts per cross-frame member end', cells: [String(n), `at least ${rB.value.n}`], st: ok ? 'pass' : 'warn', r: rB.value.n / Math.max(n, 1), demand: rB.value.n, capacity: n }); }
        if (c.items.length) out.add(c); } }
    return out;
  }
  /* cfDiaChecks(R, out, end): the diaphragm in place of the cross-frame (CFD) or at the bearing lines (end: CFE) */
  function cfDiaChecks(R, out, end) {
    const E = R.E || env0(), p = R.p, q0 = p.dia || {}; if (q0.on !== 'yes') return; const q = end ? cfDiaEnd(q0) : q0, X = cfDiaSec(q), { chS, d, bf, tf, tw, nm_ } = X, Fy = +q.gr || 50, Es = 29000, S = R.S, SB = R.SB;
    const hw = X.hw, A = X.A, Ix = bf * d ** 3 / 12 - (bf - tw) * hw ** 3 / 12, Sx = 2 * Ix / d,
      Iy = chS ? (() => { const xb = (hw * tw * tw / 2 + 2 * bf * tf * bf / 2) / A; return hw * tw ** 3 / 12 + hw * tw * (tw / 2 - xb) ** 2 + 2 * (tf * bf ** 3 / 12 + bf * tf * (bf / 2 - xb) ** 2); })() : 2 * tf * bf ** 3 / 12 + hw * tw ** 3 / 12, ry = Math.sqrt(Iy / A), dgT = nm(p.dg);
    const lt = FX().ltbFnc({ bfc: bf, tfc: tf, Dc: hw / 2, tw, Lb: S, Cb: 1.0, Rb: 1, Rh: 1, Fyc: Fy, Fyw: Fy }), Mn = lt.Fnc * Sx;   // 6.10.8 for a noncomposite rolled I-section, L_b = girder spacing
    const k = 5, lam = hw / tw, r1 = 1.12 * Math.sqrt(Es * k / Fy), r2 = 1.40 * Math.sqrt(Es * k / Fy), C = lam <= r1 ? 1 : lam <= r2 ? r1 / lam : 1.57 / lam ** 2 * (Es * k / Fy), Vn = C * 0.58 * Fy * hw * tw;
    const wk = R.W.III.Fw >= R.W.V.Fw ? 'III' : 'V', Fw = R.W[wk].Fw, Mw = Fw * dgT, Vw = 2 * Mw / S;
    const id = end ? 'CFE' : 'CFD', c = { id, grp: end ? 'End diaphragms (bearing lines)' : 'Diaphragm (intermediate bracing used)', title: end ? `${chS ? 'Channel' : 'Rolled'} end diaphragm ${nm_} at the bearing lines (in place of the end cross-frames)` : `${chS ? 'Channel' : 'Rolled'} diaphragm ${nm_} (intermediate bracing used in place of the cross-frame)`,
      ref: `${ED} Arts. 6.7.4.2, 6.7.4.2.2, 6.10.8, 6.10.9, 6.13.2, 3.4.3.1, 4.6.2.7.1`, items: [],
      note: `Properties from nominal dimensions (fillets neglected): I_x = ${f0(Ix)} in⁴, S_x = ${f0(Sx)} in³, r_y = ${f2(ry)} in. Flexural resistance per 6.10.8 as a noncomposite rolled I-section braced only at the girders (L_b = S, C_b = 1.0, conservative). The brace stiffness 6EI/S assumes reverse-curvature bending between girders.${chS ? ' Channel: the 6.10.8 lateral-torsional buckling model is for I-sections and is used as an approximation (verify against AISC 360-16 F2).' : ''} Wind (Strength ${wk}): the bottom-flange wind force F_w of the exterior girder is carried to the deck through the diaphragm, a torque F_w d resisted by diaphragm bending with shear 2M_w/S; its axial force is not combined with the flexure (assumption to verify).` };
    const st = id.toLowerCase(), it = (loc, dem, res, s, r, demand, capacity, step) => c.items.push({ loc, cells: [dem, res, r != null ? f2(r) : '—'], st: s, r, demand, capacity, step: step || `cf.${st}` });
    const fD = cfTypeRec(p, E).frac;   // OWN36 (MassDOT 3.6.3.6): 0.5 for a plate girder under 48 in; 0.75 otherwise
    if (dgT > 0) it(fD === 0.75 ? 'Depth (6.7.4.2: at least 0.75 of the plate girder depth d)' : `Depth (6.7.4.2 rolled beams, ${E.cite(E.rule('dia.depth'))}: at least ${fD} of the depth d)`, `${f2(d)} in`, `${f2(fD * dgT)} in`, d >= fD * dgT - 1e-6 ? 'pass' : 'warn', fD * dgT / d, fD * dgT, d);
    let bbr = null, bT = null;
    if (SB) { if (!end) { bbr = 6 * Es * Ix / S; bT = 1 / (1 / bbr + (isFinite(SB.bsec) ? 1 / SB.bsec : 0) + 1 / SB.bg); const r = SB.bReq / bT;
      it('Torsional brace system stiffness (6.7.4.2.2)', `β_T,req = ${f0(SB.bReq)} kip-in/rad`, `β_T = ${f0(bT)} (β_br = ${f0(bbr)}, β_sec = ${isFinite(SB.bsec) ? f0(SB.bsec) : '∞'}, β_g = ${f0(SB.bg)}; d_dia ${SB.deep ? '≥' : '<'} 0.8 D = ${f2(0.8 * SB.Dg)} in)`, r <= 1 ? 'pass' : 'fail', r, SB.bReq, bT); }
      const rm = SB.Mbr / (1.0 * Mn); it('Brace moment M_br (6.7.4.2.2)', `${f0(SB.Mbr)} kip-in`, `φ_f M_n = ${f0(Mn)} kip-in (F_nc = ${f2(lt.Fnc)} ksi)`, rm <= 1 ? 'pass' : 'fail', rm, SB.Mbr, Mn);
      const Vb = 2 * SB.Mbr / S; it('Shear from the brace moment', `${f2(Vb)} kip`, `φ_v V_n = ${f2(Vn)} kip (C = ${n3(C)})`, Vb <= Vn ? 'pass' : 'fail', Vb / Vn, Vb, Vn); }
    else it('Stability bracing', 'enter the girder and bracing data (Stability bracing inputs)', '—', 'na');
    if (end && q.end === 'yes' && +q.Rj > 0) { const Mj = +q.Rj * +q.aj, rm = Mj / Mn, rv = +q.Rj / Vn;
      it('Jacking: flexure (3.4.3.1)', `${f0(Mj)} kip-in`, `φ_f M_n = ${f0(Mn)} kip-in`, rm <= 1 ? 'pass' : 'fail', rm, Mj, Mn); it('Jacking: shear', `${f2(+q.Rj)} kip`, `φ_v V_n = ${f2(Vn)} kip`, rv <= 1 ? 'pass' : 'fail', rv, +q.Rj, Vn); }
    { const rm = Mw / Mn, rv = Vw / Vn;
      it(`Wind, Strength ${wk}: flexure M_w = F_w d (4.6.2.7.1)`, `${f0(Mw)} kip-in (F_w = ${f2(Fw)} kip)`, `φ_f M_n = ${f0(Mn)} kip-in`, rm <= 1 ? 'pass' : 'fail', rm, Mw, Mn);
      it(`Wind, Strength ${wk}: shear 2M_w/S`, `${f2(Vw)} kip`, `φ_v V_n = ${f2(Vn)} kip`, rv <= 1 ? 'pass' : 'fail', rv, Vw, Vn); }
    const nb = Math.max(2, Math.round(+q.nb || 2)), s = +q.pitch || 3, db = +((p.conn || {}).d) || 0.875, Ab = Math.PI * db * db / 4, thr = (p.conn || {}).thr === 'excl' ? 0.56 : 0.45, phiRs = 0.80 * thr * Ab * (FUB[(p.conn || {}).gr] || 120), phiRb = 0.80 * 2.4 * db * tw * (Fy === 36 ? 58 : 65);
    const ys = [...Array(nb)].map((_, i) => (i - (nb - 1) / 2) * s), sy2 = ys.reduce((a, y) => a + y * y, 0), ym = Math.max(...ys.map(Math.abs)), res = Math.min(phiRs, phiRb);
    const V = SB ? 2 * SB.Mbr / S : 0, Vt = V + (end && q.end === 'yes' ? +q.Rj || 0 : 0), M = (SB ? SB.Mbr : 0) + Vt * (+q.ecc || 0), fmax = Math.hypot(Vt / nb, M * ym / (sy2 || 1)), r = fmax / res;
    it(`Bolted connection: ${nb} bolts at ${f2(s)} in, eccentric shear and moment (6.13.1, 6.13.2)`, `${f2(fmax)} kip per bolt`, `${f2(res)} kip (shear ${f2(phiRs)}, bearing ${f2(phiRb)})`, r <= 1 ? 'pass' : 'fail', r, fmax, res);
    const Mc = Mw + Vw * (+q.ecc || 0), fw = Math.hypot(Vw / nb, Mc * ym / (sy2 || 1) + Fw / nb), rw = fw / res;
    it(`Bolted connection under wind, Strength ${wk}: V = ${f2(Vw)} kip, M = ${f0(Mc)} kip-in, H = F_w = ${f2(Fw)} kip (6.13.2)`, `${f2(fw)} kip per bolt`, `${f2(res)} kip`, rw <= 1 ? 'pass' : 'fail', rw, fw, res);
    const em = R.emin, avail = d - 2 * tf - 1.0, need = (nb - 1) * s + 2 * em, okG = s >= 3 * db - 1e-9 && need <= avail + 1e-9;
    it(`Bolt line: pitch ≥ 3d (6.13.2.6.1) and ${nb} bolts with ${frac(em)} in end distances within the web depth d − 2t_f − 1 in`, `s = ${f2(s)} in, ${f2(need)} in`, `≥ ${f2(3 * db)} in, ≤ ${f2(avail)} in`, okG ? 'pass' : 'fail', Math.max(3 * db / s, need / (avail > 0 ? avail : 1e-9)), need, avail);
    const cp = cfCP(p, end, E), G = cfDiaFit(R, q, cp, SB ? SB.tt : 1, SB ? SB.tc : 0.75), de = G.ecc - G.gap, mA = Math.min(G.edge, de), okA = mA >= em - 1e-9 && G.gap >= cp.tw / 2 + 1e-9;
    const src = cp.src === 'bs' ? `bearing stiffener Type ${cp.bsT.k}` : cp.src === 'ts' ? `Transverse stiffeners Type ${cp.ts.k}` : 'inputs b_s, t_s', pl = `${frac(cp.bs)} × ${frac(cp.tp)} in, ${src}`;
    it(`Connection plate fit: bolt line ${f2(G.ecc)} in from the web centerline, edge distances to the plate's free edge and to the diaphragm end (6.13.2.6.6)`, `${f2(G.edge)} in to the plate edge, ${f2(de)} in to the diaphragm end${G.gap < cp.tw / 2 + 1e-9 ? ' (diaphragm end reaches the web)' : ''}`, `≥ ${frac(em)} in (plate ${pl})`, okA ? 'pass' : 'fail', mA > 0 ? em / mA : 99.99, em, mA);
    it(`Connection plate fit: end bolts to the plate ends (flange faces less the ${frac(cp.c)} in corner clip; 6.13.2.6.6)`, `${f2(G.vEdge)} in`, `≥ ${frac(em)} in`, G.vEdge >= em - 1e-9 ? 'pass' : 'fail', G.vEdge > 0 ? em / G.vEdge : 99.99, em, G.vEdge);
    (R.DIA = R.DIA || {})[end ? 'e' : 'i'] = { nm_, chS, d, A, Ix, Sx, Iy, ry, Mn, Fnc: lt.Fnc, lt, Vn, C, lam, wk, Fw, Mw, Vw, Mbr: SB ? SB.Mbr : null, bbr, bT, jack: end && q.end === 'yes' && +q.Rj > 0 ? { Rj: +q.Rj, aj: +q.aj } : null, nb, s, db, Ab, thr, ecc: +q.ecc || 0, ys, sy2, ym, V, Vt, M, fmax, Mc, fw, res, phiRs, phiRb, need, avail, cp, G, fD };
    diaSteps(R, end);
    out.add(c);
  }

  /* ================= worked steps (new; the values above, worked) ================= */
  function steps(R) {
    const w = St().work('cf'), p = R.p, W = R.W;
    w.add({ id: 'dg', label: 'Girder depth (out-to-out of the flanges)', sym: 'd', eq: '', sub: '', value: R.dft * 12, unit: 'in', d: 2 });
    w.add({ id: 'Lb', label: 'Cross-frame spacing (the largest unbraced length on any girder)', sym: 'L_{b}', eq: '', sub: '', value: R.Lb, unit: 'ft', d: 2, ref: `${ED} Art. 6.7.4.2.1` });
    [['III', `Strength III, V = ${n0(W.III.V)} mph`], ['V', 'Strength V, V = 80 mph']].forEach(([k, l]) => { const q = W[k];
      w.add({ id: `w${k}.PZ`, label: `Design wind pressure, ${l}`, sym: 'P_{Z}', eq: '2.56 \\times 10^{-6}V^{2}K_{z}GC_{D}', sub: `2.56 \\times 10^{-6}(${n0(q.V)})^{2}(${n2(nm(p.wind.Kz))})(${n2(nm(p.wind.G))})(${n2(nm(p.wind.Cd))})`, value: q.PZ, unit: 'ksf', d: 4, ref: `${ED} Eq. 3.8.1.2.1-1` });
      w.add({ id: `w${k}.W`, label: `Wind on the lower half of the exterior girder, carried by the bottom flange (γ_WS = 1.0η = ${n3(R.gWS)})`, sym: 'W', eq: '\\frac{\\gamma_{WS}P_{Z}d}{2}', sub: `\\frac{${n3(R.gWS)}(${n4(q.PZ)})(${n3(R.dft)})}{2}`, value: q.W, unit: 'kip/ft', d: 4, ref: `${ED} Art. 4.6.2.7.1` });
      w.add({ id: `w${k}.Fw`, label: `Wind force at the bottom flange per cross-frame, ${l}`, sym: 'F_{w}', eq: 'WL_{b}', sub: `${n4(q.W)}(${n2(R.Lb)})`, value: q.Fw, unit: 'kip', d: 2, ref: `${ED} Art. 4.6.2.7.1` }); });
    R.frames.forEach((e, i) => w.add({ id: `tr${i}`, label: `${e.lbl}: force per kip of F_w (truss model, top chord work points held by the deck) and per kip-in of brace moment`, sym: 'f_{w},\\ f_{br}', eq: '', sub: `${n4(e.unit)},\\ ${n4(e.ubr)}`, value: e.unit, unit: 'kip/kip', d: 4, note: `Length ${n2(e.L)} in.` }));
    const SB = R.SB; if (SB) {
      w.add({ id: 'sb.Iyeff', label: 'Effective I_y of the girder for torsional bracing', sym: 'I_{yeff}', eq: 'I_{yc} + \\frac{t}{c}I_{yt}', sub: `${n2(SB.Iyc)} + \\frac{${n2(SB.tD)}}{${n2(SB.cD)}}(${n2(SB.Iyt)})`, value: SB.Iyeff, unit: 'in^{4}', d: 2, ref: `${ED} Art. 6.7.4.2.2` });
      w.add({ id: 'sb.ho', label: 'Distance between flange centroids', sym: 'h_{o}', eq: 'D + \\frac{t_{c} + t_{t}}{2}', sub: `${n2(SB.Dg)} + \\frac{${n3(SB.tc)} + ${n3(SB.tt)}}{2}`, value: SB.ho, unit: 'in', d: 2 });
      w.add({ id: 'sb.C', label: `Coefficient C (${SB.full ? 'cross-frame ≥ 0.8 of the web depth on full-depth plates' : 'otherwise'})`, sym: 'C', eq: '', sub: `h_{br} = ${n2(SB.hBr)} ${SB.deepFrame ? '\\ge' : '\\lt'} 0.8D = ${n2(0.8 * SB.Dg)}`, value: SB.C, unit: '', d: 1, ref: `${ED} Art. 6.7.4.2.2` });
      w.add({ id: 'sb.Mbr', label: 'Brace moment during deck placement', sym: 'M_{br}', eq: '\\frac{CL}{nEI_{yeff}}\\left(\\frac{M_{u}}{C_{b}}\\right)^{2}\\frac{L_{b}}{500h_{o}}', sub: `\\frac{${SB.C}(${n0(SB.L)})}{${n0(SB.n)}(29{,}000)(${n2(SB.Iyeff)})}\\left(\\frac{${n0(SB.Mu)}}{${n2(SB.Cb)}}\\right)^{2}\\frac{${n2(SB.Lb)}}{500(${n2(SB.ho)})}`, value: SB.Mbr, unit: 'kip-in', d: 1, ref: `${ED} Eq. 6.7.4.2.2-14` });
      w.add({ id: 'sb.bbr', label: `Brace stiffness (${SB.isX ? 'X: tension-only diagonal' : 'K frame'}; areas × R = 0.65)`, sym: '\\beta_{br}', eq: SB.isX ? '\\frac{A_{d}ES^{2}h^{2}}{L_{c}^{3}}' : '\\frac{2ES^{2}h^{2}}{8L_{c}^{3}/A_{d} + S^{3}/A_{h}}', sub: SB.isX ? `\\frac{${n3(SB.Ad)}(29{,}000)(${n2(R.S)})^{2}(${n2(R.h)})^{2}}{(${n2(SB.Lc)})^{3}}` : `\\frac{2(29{,}000)(${n2(R.S)})^{2}(${n2(R.h)})^{2}}{8(${n2(SB.Lc)})^{3}/${n3(SB.Ad)} + (${n2(R.S)})^{3}/${n3(SB.Ah)}}`, value: SB.bbr, unit: 'kip-in/rad', d: 0, ref: `${ED} Art. 6.7.4.2.2; C4.6.3.3.4` });
      w.add({ id: 'sb.bsec', label: 'Web distortional stiffness (infinite when the bracing is at least 0.8 of the web depth)', sym: '\\beta_{sec}', eq: SB.deep ? '\\infty' : '\\frac{3.3E}{h_{o}}\\left(\\frac{1.5h_{o}t_{w}^{3}}{12} + \\frac{t_{s}b_{s}^{3}}{12}\\right)', sub: SB.deep ? '' : `\\frac{3.3(29{,}000)}{${n2(SB.ho)}}\\left(\\frac{1.5(${n2(SB.ho)})(${n4(SB.tw)})^{3}}{12} + \\frac{${n4(SB.tsp)}(${n3(SB.bs)})^{3}}{12}\\right)`, value: isFinite(SB.bsec) ? SB.bsec : 'infinite', unit: 'kip-in/rad', d: 0, ref: `${ED} Art. 6.7.4.2.2`, note: `Connection plate b_s × t_s = ${n3(SB.bs)} × ${n4(SB.tsp)} in (${SB.cpTs ? `Transverse stiffeners Type ${SB.cpTs.k}` : 'the Cross-frames inputs'}).` });
      w.add({ id: 'sb.bg', label: 'In-plane girder stiffness', sym: '\\beta_{g}', eq: '\\frac{24(n_{g} - 1)^{2}S^{2}EI_{x}}{n_{g}L^{3}}', sub: `\\frac{24(${SB.ng} - 1)^{2}(${n2(R.S)})^{2}(29{,}000)(${n0(SB.Ix)})}{${SB.ng}(${n0(SB.L)})^{3}}`, value: SB.bg, unit: 'kip-in/rad', d: 0, ref: `${ED} Art. 6.7.4.2.2` });
      w.add({ id: 'sb.bT', label: 'Torsional brace system stiffness', sym: '\\beta_{T}', eq: '\\left(\\frac{1}{\\beta_{br}} + \\frac{1}{\\beta_{sec}} + \\frac{1}{\\beta_{g}}\\right)^{-1}', sub: `\\left(\\frac{1}{${n0(SB.bbr)}} + ${isFinite(SB.bsec) ? `\\frac{1}{${n0(SB.bsec)}}` : '0'} + \\frac{1}{${n0(SB.bg)}}\\right)^{-1}`, value: SB.bT, unit: 'kip-in/rad', d: 0, ref: `${ED} Art. 6.7.4.2.2` });
      w.add({ id: 'sb.bReq', label: 'Required torsional brace stiffness', sym: '\\beta_{T,req}', eq: '\\frac{C_{s}LM_{u}^{2}}{nEI_{yeff}C_{b}^{2}}', sub: `\\frac{${n2(SB.Cs)}(${n0(SB.L)})(${n0(SB.Mu)})^{2}}{${n0(SB.n)}(29{,}000)(${n2(SB.Iyeff)})(${n2(SB.Cb)})^{2}}`, value: SB.bReq, unit: 'kip-in/rad', d: 0, ref: `${ED} Eq. 6.7.4.2.2-15`, ok: SB.bT >= SB.bReq }); }
    Object.values(R.mem).forEach(m => { const id = m.k, Fy = R.Fy;
      w.add({ id: `${id}.A`, label: `${m.l} ${m.name}: area and radii of gyration (leg rectangles)`, sym: 'A_{g},\\ r_{x},\\ r_{z}', eq: '', sub: `${n3(m.A)},\\ ${n3(m.rx)},\\ ${n3(m.rz)}`, value: m.A, unit: 'in^{2}', d: 3 });
      w.add({ id: `${id}.forces`, label: `${m.l}: largest tension and compression (analysis force ± wind and brace forces)`, sym: 'T_{u},\\ C_{u}', eq: '', sub: `${n2(m.Tu)} (${m.cT || '—'}),\\ ${n2(m.Cu)} (${m.cC || '—'})`, value: m.Fmax, unit: 'kip', d: 2 });
      w.add({ id: `${id}.KLr`, label: `${m.l}: effective slenderness, single angle connected through one leg (ℓ = ${n2(m.L)} in, ℓ/r_x = ${n2(m.lrx)})`, sym: '\\left(\\frac{KL}{r}\\right)_{eff}', eq: m.lrx <= 80 ? '72 + 0.75\\frac{\\ell}{r_{x}}' : '32 + 1.25\\frac{\\ell}{r_{x}} \\le 200', sub: m.lrx <= 80 ? `72 + 0.75(${n2(m.lrx)})` : `32 + 1.25(${n2(m.lrx)})`, value: m.KLr, unit: '', d: 2, ref: `${ED} Eq. 6.9.4.4-${m.lrx <= 80 ? 1 : 2}` });
      w.add({ id: `${id}.Q`, label: `${m.l}: slender-leg reduction (b/t = ${n2(m.bt)}, 0.45√(E/F_y) = ${n2(m.lim)})`, sym: 'Q', eq: m.bt <= m.lim ? '1.0' : '', sub: '', value: m.Q, unit: '', d: 3, ref: `${ED} Art. 6.9.4.2.2` });
      w.add({ id: `${id}.Pe`, label: `${m.l}: elastic buckling resistance`, sym: 'P_{e}', eq: '\\frac{\\pi^{2}EA_{g}}{(KL/r)_{eff}^{2}}', sub: `\\frac{\\pi^{2}(29{,}000)(${n3(m.A)})}{(${n2(m.KLr)})^{2}}`, value: m.Pe, unit: 'kip', d: 2, ref: `${ED} Eq. 6.9.4.1.2-1` });
      w.add({ id: `${id}.Po`, label: `${m.l}: equivalent nominal yield resistance`, sym: 'P_{o}', eq: 'QF_{y}A_{g}', sub: `${n3(m.Q)}(${n0(Fy)})(${n3(m.A)})`, value: m.Po, unit: 'kip', d: 2, ref: `${ED} Art. 6.9.4.1.1` });
      w.add({ id: `${id}.Pn`, label: `${m.l}: nominal compressive resistance (P_e/P_o = ${n3(m.Pe / m.Po)})`, sym: 'P_{n}', eq: m.Pe >= 0.44 * m.Po ? '0.658^{P_{o}/P_{e}}P_{o}' : '0.877P_{e}', sub: m.Pe >= 0.44 * m.Po ? `0.658^{${n3(m.Po / m.Pe)}}(${n2(m.Po)})` : `0.877(${n2(m.Pe)})`, value: m.Pn, unit: 'kip', d: 2, ref: `${ED} Eq. 6.9.4.1.1-${m.Pe >= 0.44 * m.Po ? 1 : 2}` });
      w.add({ id: `${id}.Pr`, label: `${m.l}: factored compressive resistance (CF1)`, sym: 'P_{r}', eq: '0.95P_{n} \\ge C_{u}', sub: `0.95(${n2(m.Pn)}) = ${n2(m.Pr)}\\ ${ge(m.Pr, m.Cu) ? '\\ge' : '\\lt'}\\ ${n2(m.Cu)}`, value: m.Pr, unit: 'kip', d: 2, ref: `${ED} Eq. 6.9.2.1-1`, ok: ge(m.Pr, m.Cu) });
      w.add({ id: `${id}.U`, label: `${m.l}: shear lag factor (${R.n} bolts in the line of force)`, sym: 'U', eq: R.n >= 4 ? '0.80' : R.n === 3 ? '0.60' : '1 - \\frac{\\bar{x}}{L}', sub: R.n === 2 ? `1 - \\frac{${n3(m.xbar)}}{${n2(m.Lc)}}` : '', value: m.U, unit: '', d: 3, ref: `${ED} Table 6.8.2.2-1` });
      w.add({ id: `${id}.Pt`, label: `${m.l}: factored tension resistance, yield and fracture (CF2)`, sym: 'P_{r}', eq: '\\min(\\phi_{y}F_{y}A_{g},\\ \\phi_{u}F_{u}A_{n}U) \\ge T_{u}', sub: `\\min(0.95(${n0(Fy)})(${n3(m.A)}),\\ 0.80(${n0(R.Fu)})(${n3(m.An)})(${n3(m.U)})) = \\min(${n2(m.Pyr)},\\ ${n2(m.Pur)})\\ ${ge(Math.min(m.Pyr, m.Pur), m.Tu) ? '\\ge' : '\\lt'}\\ ${n2(m.Tu)}`, value: Math.min(m.Pyr, m.Pur), unit: 'kip', d: 2, ref: `${ED} Eqs. 6.8.2.1-1, -2`, ok: ge(Math.min(m.Pyr, m.Pur), m.Tu) });
      w.add({ id: `${id}.sl`, label: `${m.l}: slenderness (CF3, ${R.primary ? 'primary' : 'secondary'} member)`, sym: '\\frac{\\ell}{r_{z}}', eq: '', sub: `\\frac{${n2(m.L)}}{${n3(m.rz)}}`, value: m.slC, unit: '', d: 2, ref: `${ED} Arts. 6.9.3, 6.8.4` });
      w.add({ id: `${id}.bolt`, label: `${m.l}: bolt shear resistance, ${R.n} bolts, single shear (CF4)`, sym: 'n\\phi_{s}R_{n}', eq: 'n(0.80)(0.45\\text{ or }0.56)A_{b}F_{ub}', sub: `${R.n}(0.80)(${n2(R.thr)})(${n4(R.bolt.Ab)})(${n0(R.Fub)})`, value: m.boltR, unit: 'kip', d: 2, ref: `${ED} Eq. 6.13.2.7-1, -2`, ok: ge(m.boltR, m.Fmax) });
      w.add({ id: `${id}.brg`, label: `${m.l}: bolt bearing, angle and gusset (CF5)`, sym: '\\sum\\phi_{bb}\\min(2.4dtF_{u},\\ 1.2L_{c}tF_{u})', eq: '', sub: `\\min(${n2(m.brgA)},\\ ${n2(m.brgG)})`, value: m.brgR, unit: 'kip', d: 2, ref: `${ED} Eqs. 6.13.2.9-1, -2`, ok: ge(m.brgR, m.Fmax) });
      if (m.dP > 0) w.add({ id: `${id}.fat`, label: `${m.l}: factored stress range (CF9)`, sym: '\\gamma(\\Delta f)', eq: '1.75(0.65)\\frac{\\Delta P}{A_{g}}', sub: `${n4(R.gF)}\\frac{${n2(m.dP)}}{${n3(m.A)}}`, value: m.df, unit: 'ksi', d: 2, ref: `${ED} Table 3.4.1-1, Art. 6.6.1.2`, ok: ge(R.FT, m.df) }); });
    w.add({ id: 'geo', label: 'Connection geometry (CF6)', sym: 's,\\ e_{end},\\ t_{g}', eq: '', sub: `${n3(R.s)},\\ ${n3(R.e0)},\\ ${n3(R.tg)}`, value: R.s, unit: 'in', d: 3, ref: `${ED} Art. 6.13.2.6, Table 6.13.2.6.6-1` });
    return w.steps;
  }
  /* diaSteps(R, end): the diaphragm values (CFD / CFE), appended to R.steps */
  function diaSteps(R, end) {
    const D = R.DIA[end ? 'e' : 'i'], id = end ? 'cfe' : 'cfd', w = St().work('cf'), lab = end ? 'End diaphragm' : 'Diaphragm';
    w.add({ id: `${id}.Sx`, label: `${lab} ${D.nm_}: section modulus (nominal dimensions)`, sym: 'S_{x}', eq: '\\frac{2I_{x}}{d}', sub: `\\frac{2(${n0(D.Ix)})}{${n2(D.d)}}`, value: D.Sx, unit: 'in^{3}', d: 1 });
    w.add({ id: `${id}.Mn`, label: `${lab}: flexural resistance (6.10.8, L_b = S, C_b = 1.0; F_nc = ${n2(D.Fnc)} ksi)`, sym: '\\phi_{f}M_{n}', eq: 'F_{nc}S_{x}', sub: `${n2(D.Fnc)}(${n2(D.Sx)})`, value: D.Mn, unit: 'kip-in', d: 0, ref: `${ED} Arts. 6.10.8.2.2, 6.10.8.2.3` });
    w.add({ id: `${id}.Vn`, label: `${lab}: shear resistance (unstiffened web, k = 5, D/t_w = ${n2(D.lam)})`, sym: '\\phi_{v}V_{n}', eq: 'C(0.58F_{y}Dt_{w})', sub: `${n4(D.C)}(0.58)F_{y}(h_{w})(t_{w})`, value: D.Vn, unit: 'kip', d: 2, ref: `${ED} Eq. 6.10.9.2-1` });
    w.add({ id: `${id}.Mw`, label: `${lab}: wind moment, Strength ${D.wk}`, sym: 'M_{w}', eq: 'F_{w}d', sub: `${n2(D.Fw)}(${n2(D.Mw / D.Fw)})`, value: D.Mw, unit: 'kip-in', d: 0, ref: `${ED} Art. 4.6.2.7.1`, ok: D.Mw <= D.Mn });
    if (D.bbr != null) w.add({ id: `${id}.bT`, label: `${lab}: brace system stiffness with β_br = 6EI_x/S = ${n0(D.bbr)}`, sym: '\\beta_{T}', eq: '', sub: '', value: D.bT, unit: 'kip-in/rad', d: 0, ref: `${ED} Art. 6.7.4.2.2`, ok: R.SB ? D.bT >= R.SB.bReq : undefined });
    w.add({ id: `${id}.bolt`, label: `${lab}: largest bolt force, ${D.nb} bolts at ${n2(D.s)} in (brace moment${D.jack ? ' and jacking' : ''})`, sym: 'f', eq: '\\sqrt{(V/n)^{2} + (My_{max}/\\sum y^{2})^{2}}', sub: `\\sqrt{(${n2(D.Vt)}/${D.nb})^{2} + (${n0(D.M)}(${n2(D.ym)})/${n2(D.sy2)})^{2}}`, value: D.fmax, unit: 'kip', d: 2, ref: `${ED} Art. 6.13.2`, ok: D.fmax <= D.res });
    w.add({ id: `${id}.boltw`, label: `${lab}: largest bolt force under wind`, sym: 'f_{w}', eq: '\\sqrt{(V_{w}/n)^{2} + (M_{c}y_{max}/\\sum y^{2} + F_{w}/n)^{2}}', sub: `\\sqrt{(${n2(D.Vw)}/${D.nb})^{2} + (${n0(D.Mc)}(${n2(D.ym)})/${n2(D.sy2)} + ${n2(D.Fw)}/${D.nb})^{2}}`, value: D.fw, unit: 'kip', d: 2, ref: `${ED} Art. 6.13.2`, ok: D.fw <= D.res });
    w.add({ id: `${id}`, label: `${lab}: bolt resistance, the lesser of shear and bearing on the diaphragm web`, sym: '\\phi R_{n}', eq: '\\min(\\phi_{s}R_{n},\\ \\phi_{bb}R_{n})', sub: `\\min(${n2(D.phiRs)},\\ ${n2(D.phiRb)})`, value: D.res, unit: 'kip', d: 2, ref: `${ED} Arts. 6.13.2.7, 6.13.2.9` });
    R.steps.push(...w.steps);
  }

  /* ================= cross-frame weight in DC1 (XF1) ================= */
  /* xfW(X, Lft, end): the weight (kip) of one frame of length Lft (ft, between the girder webs); GirderDetail gdXfW */
  function xfW(X, Lft, end) {
    if (X.kind === 'ovr') return Math.max(0, +(end ? X.We : X.Wi) || 0);
    const S = Lft * 12, k = 1 + (+X.allow || 0) / 100;
    if (X.kind === 'dia') return (end ? X.Ae : X.A) * Math.max(0, S - 2 * (end ? X.ge : X.g)) * 0.2836 / 1000 * k;
    const d = end || X.type === 'X' ? Math.hypot(S, X.h) : Math.hypot(S / 2, X.h);
    return (S * (X.At + X.Ab) + 2 * d * X.Ad) * 0.2836 / 1000 * k;
  }
  /* xfModel(set, c0): the weight model (GirderDetail gdXfModel). set = { mode: 'auto' | 'ovr' | 'off', allow (%), Wi, We (kip per frame, 'ovr') };
     c0: the Cross-frames inputs (the member sizes, or the diaphragm); invalid sizes fall back to the built-in ones (bad: true). */
  function xfModel(set, c0) {
    const dl = set || {}, mode = dl.mode === 'off' || dl.mode === 'ovr' ? dl.mode : 'auto', opt = v => (v === '' || v == null || !isFinite(+v) ? null : +v), al = opt(dl.allow), allow = al > 0 ? al : 0;
    if (mode === 'off') return { on: false, mode };
    if (mode === 'ovr') { const Wi = opt(dl.Wi), e = opt(dl.We), We = e === null ? Wi : e; return Wi >= 0 && We >= 0 && Wi !== null ? { on: true, mode, kind: 'ovr', Wi, We } : { on: false, mode, bad: true }; }
    const d = DEF; c0 = c0 || d; const dia = cfDiaOn(c0);
    if (dia) { let q = c0.dia, X = cfDiaSec(q), eq = cfDiaEnd(q), XE = cfDiaSec(eq), bad = false; if (!(X.A > 0 && XE.A > 0)) { q = d.dia; X = cfDiaSec(q); eq = cfDiaEnd(q); XE = cfDiaSec(eq); bad = true; }
      return { on: true, mode, kind: 'dia', A: X.A, g: cfDiaGap(q), Ae: XE.A, ge: cfDiaGap(eq), allow, bad, nm: X.nm_, nmE: XE.nm_, wpf: X.wpf, wpfE: XE.wpf }; }
    const ang = c => { const o = {}; for (const [k] of CF_MEM) { const m = (c.mem || {})[k] || {}, dims = m.sec === 'custom' ? [nm(m.b1), nm(m.b2), nm(m.t)] : ANGLES[m.sec];
      if (!dims || !(dims[0] > 0 && dims[1] > 0 && dims[2] > 0 && dims[2] < Math.min(dims[0], dims[1]))) return null; o[k] = { A: angleProps(...dims).A, nm: m.sec === 'custom' ? `L${f2(dims[0])}x${f2(dims[1])}x${frac(dims[2])}` : m.sec.replace(' (LLV)', '') }; } return o; };
    let c = c0, A = ang(c), bad = false; if (!A || !(nm(c.h) > 0)) { c = d; A = ang(d); bad = true; }
    return { on: true, mode, kind: 'xf', type: c.type === 'X' || c.type === 'Kb' ? c.type : 'Kt', h: nm(c.h), At: A.top.A, Ab: A.bot.A, Ad: A.diag.A, allow, bad, nmT: A.top.nm, nmB: A.bot.nm, nmD: A.diag.nm };
  }
  /* xfPts(b, X): the point loads of every girder (GirderDetail gdXfPts): b = { spans [ft], xf: { g: bearings per girder, f: frames (framing.js
     plXfDef) } }; per girder [{ x (ft, analysis station), P (kip), end, W (whole frame), Lf (ft) }]; a frame station is mapped into its span
     proportionally between that girder's bearings; a frame on a bearing line loads that bearing only. null without the model or the frames. */
  function xfPts(b, X) {
    if (!X || !X.on || !b || !b.xf || !Array.isArray(b.xf.f) || !Array.isArray(b.xf.g)) return null;
    const sp = b.spans, X0 = [0]; sp.forEach(L => X0.push(X0[X0.length - 1] + L)); const G = b.xf.g.map(() => []);
    b.xf.f.forEach(([sup, k, bay, sa, sc, Lf]) => { const end = !!sup, W = xfW(X, Lf, end);
      [[bay, sa], [bay + 1, sc]].forEach(([g, st]) => { const B = b.xf.g[g]; if (!B || !G[g]) return; let x;
        if (end) x = X0[k]; else { const a = B[k], c = B[k + 1]; x = Math.max(X0[k], Math.min(X0[k + 1], X0[k] + (c > a ? (st - a) / (c - a) : 0.5) * sp[k])); }
        G[g].push({ x, P: W / 2, end, W, Lf }); }); });
    return G;
  }

  /* ================= the project (new) ================= */
  /* DEFP: the Cross-frames design inputs of a new project: GirderDetail's built-in (GM.cf.def) member sizes, connections, wind and stability
     bracing choices; the geometry (S, d, L_b, h, the deck-placement span and its brace points, the girder plates) comes from the project. h: ''
     = round(max(D − 8, 0.75D)) as Preliminary sizing; primary 'auto' = yes where any support is skewed more than 20°; sb.Mu '' = from the
     analysis (1.25M_DC1 + 1.5M_CL, the largest positive), weight: { mode 'auto' (member sizes) | 'ovr' (Wi, We kip per frame) | 'off', allow % } */
  function defaults() { const d = JSON.parse(JSON.stringify(DEF));
    return { type: d.type, h: '', dMinXF: d.dMinXF, gA: d.gA, gG: d.gG, primary: 'auto', dia: d.dia, wind: d.wind, mem: d.mem, conn: d.conn, user: d.user, fatCat: d.fatCat,
      sb: { on: 'yes', full: 'auto', Mu: '', Cb: 1, bs: 5, tsp: 0.5 }, weight: { mode: 'auto', allow: 10, Wi: '', We: '' } }; }
  /* inputsOf(P, opt): GirderDetail's Cross-frames input p for project P (the values Preliminary sizing sends: S = the largest girder spacing,
     h, d at the first support, L_b = the largest unbraced length on any girder, primary by skew; sb: the span with the largest factored
     deck-placement moment of the interior girder, its length, the fewest intermediate frames on any girder in it, the plates there).
     opt = { L (SBDFraming.compute(P)), A (SBDAnalysis.analyzeGirder result of the girder whose plates and moments are used), gi (plate
     girder index, default 0) }. Returns { p, src } (src: where each derived value comes from). */
  function inputsOf(P, opt) {
    opt = opt || {}; const c = Object.assign(defaults(), P.crossframes || {}), FRM = window.SBDFraming, L = opt.L || (FRM ? FRM.compute(P) : null), src = {};
    const G = (P.girders || [])[opt.gi || 0] || P.girders[0], seg = x => G.segments.find(s => x >= s.x0 - 1e-9 && x < s.x1) || G.segments[G.segments.length - 1];
    const sup = [0]; P.spans.lengths.forEach(v => sup.push(sup[sup.length - 1] + +v));
    const s0 = seg(sup[0] + 1), D = Math.max(...G.segments.map(s => s.D)), r1 = v => +(+v).toFixed(1), r2 = v => +(+v).toFixed(2);
    const bays = ((P.xs || {}).bays || [9.5]).map(Number), skews = ((P.xs || {}).skews || []).map(Number), nb = Math.round((P.xs || {}).nb || 2);
    const p = JSON.parse(JSON.stringify(c));
    p.S = r2(Math.max(...bays) * 12); p.dg = r2(s0.D + s0.topT + s0.botT); src.S = 'the largest girder spacing'; src.dg = 'D + t_top + t_bot at the first support';
    p.h = c.h === '' || c.h == null ? Math.round(Math.max(D - 8, D * 0.75)) : +c.h; src.h = c.h === '' || c.h == null ? 'round(max(D − 8, 0.75D))' : 'entered';
    p.primary = c.primary === 'auto' ? (skews.some(s => Math.abs(s) > 20) ? 'yes' : 'no') : c.primary;
    p.Lb = L && !L.errors.length ? r2(FRM.lbMax(L.FR, L.FR.girders.map(g => g.i), L.m.sup)) : 25; src.Lb = L && !L.errors.length ? 'the largest unbraced length on any girder (framing)' : 'no framing: 25 ft';
    const A = opt.A && !(opt.A.errors && opt.A.errors.length) ? opt.A : null;
    let xM = sup[0] + (sup[1] - sup[0]) / 2, Mu = +c.sb.Mu;
    if (A && A.st && A.st.DC1) { const xs = A.xs, Mc = xs.map((_, i) => 1.25 * A.st.DC1.M[i] + 1.5 * (A.st.CL ? A.st.CL.M[i] : 0)); let iMx = 0; Mc.forEach((v, i) => { if (v > Mc[iMx]) iMx = i; }); xM = xs[iMx];
      if (c.sb.Mu === '' || c.sb.Mu == null) { Mu = r1(Mc[iMx]); src.Mu = `analysis: 1.25M_DC1 + 1.5M_CL at x = ${xM.toFixed(1)} ft`; } }
    if (!(isFinite(Mu))) { Mu = DEF.sb.Mu; src.Mu = 'no analysis: GirderDetail built-in value'; } else if (!src.Mu) src.Mu = 'entered';
    let k = 0; while (k < sup.length - 2 && sup[k + 1] < xM) k++;
    const nBr = L && !L.errors.length ? Math.min(...L.FR.girders.map(g => g.pts.filter(q => q.f.type === 'int' && q.s > g.bear[k] + 0.5 && q.s < g.bear[k + 1] - 0.5).length)) : Math.max(0, Math.ceil((sup[k + 1] - sup[k]) / 25 - 1e-9) - 1);
    const s = seg(xM);
    p.sb = { on: c.sb.on, full: c.sb.full === 'auto' ? (p.h >= 0.8 * D ? 'yes' : 'no') : c.sb.full, L: r2(sup[k + 1] - sup[k]), n: Math.max(1, nBr), Mu, Cb: +c.sb.Cb || 1, D, tw: s.tw, bc: s.topB, tc: s.topT, bt: s.botB, tt: s.botT, ng: nb, bs: c.sb.bs, tsp: c.sb.tsp };
    src.sb = `span ${k + 1}`;
    return { p, src, k, xM };
  }
  /* envOf(P, opt): GirderDetail's page state for compute(): the owner and η (OWN7), the skews, and the stiffener types for the connection plate
     (the Transverse stiffeners connection-plate type with the rows of the stiffener layout when given (opt.tsRows), else the types alone) */
  function envOf(P, opt) {
    opt = opt || {}; const O = window.SBDOwners, own = (P.ownerRules || {}).owner || 'AASHTO', lf = O ? O.loadFactors(own, (P.ownerRules || {}).eta, (P.xs || {}).nb) : { eta: 1 };
    const st = P.stiffeners || {}, tr = st.transverse || {}, br = st.bearing || {};
    return env0({ owner: own, lf, skews: ((P.xs || {}).skews || []).slice(), ts: tr.types ? { types: tr.types, rows: opt.tsRows || [] } : null, bs: br.types ? { types: br.types, rows: opt.bsRows || Object.keys(br.types).map(k => ({ type: k })) } : null });
  }
  /* pointLoads(P, gi, opt): the DC1 point loads of plate girder gi from the framing and the cross-frame weight model, for engine/analysis.js:
     [{ x, P }] (null when the project has no framing, the weight is off, or the layout has errors). opt.L: SBDFraming.compute(P), reused. */
  function pointLoads(P, gi, opt) {
    const FRM = window.SBDFraming; if (!FRM || !P.framing) return null;
    const c = Object.assign(defaults(), P.crossframes || {}), L = (opt && opt.L) || FRM.compute(P); if (!L || L.errors.length) return null;
    const X = xfModel(c.weight, { ...c, h: c.h === '' || c.h == null ? inputsOf(P, { L }).p.h : +c.h }); if (!X.on) return null;
    const G = xfPts({ spans: P.spans.lengths.map(Number), xf: L.xf }, X); if (!G) return null;
    const line = Math.min(FRM.lineOf(P, P.girders[gi]), G.length - 1);
    return { line, X, pts: G[line], tot: G[line].reduce((a, q) => a + q.P, 0) };
  }

  window.SBDCrossframes = { ES, DEF, GD_GR, BOLT, FUB, PHI, ANGLES, CF_MEM, CF_CH, CF_DIA, angleProps, cfDiaSec, cfDiaOn, cfDiaGap, cfDiaEnd, cfTypeRec, cfTsCP, cfCPsize, cfBsCP, cfCP, cfDiaFit,
    env0, compute, checks, xfW, xfModel, xfPts, defaults, inputsOf, envOf, pointLoads };
})();
