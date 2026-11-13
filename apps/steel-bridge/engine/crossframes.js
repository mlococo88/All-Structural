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
       wind M_w = F_w d (4.6.2.7.1), the bolted connection (6.13.2), the connection plate fit (6.13.2.6.6); added in this app (SBDX,
       2026-11-10): a channel's flexure per 6.12.2.2.5 (chFlex; GirderDetail: 6.10.8) and the axial checks under F_w (diaAxial); with cfDiaSec, cfDiaOn,
       cfDiaGap, cfDiaEnd, cfTypeRec, cfTsCP, cfCPsize, cfBsCP, cfCP, cfDiaFit, angleProps, ANGLES, CF_MEM, CF_CH, CF_DIA, BOLT, FUB, PHI;
     - the cross-frame and diaphragm weight in DC1 (XF1, anchors `function gdXfW(`, `function gdXfModel(`, `function gdXfPts(`): each
       frame weighs W and puts W/2 on each of the two girders it connects, at that girder's own frame station from the framing layout
       (engine/framing.js), mapped into the analysis span proportionally between that girder's bearings; a frame on a bearing line loads
       that bearing. X: (S(A_t + A_b) + 2√(S² + h²)A_d)·0.2836/1000·(1 + allowance) kip (K: √((S/2)² + h²)); end frames X-type.
   SBXF (2026-11-13; engineer decision 2026-11-13, girder types): each cross-frame bay takes the depth of the shallower of the two girders it
   connects (bayDepths); the one frame compute() checks is the governing bay, the shallowest; the DC1 weights take each bay's own h. Projects
   saved before girder types: as before.
   SBXF2 (2026-11-13; engineer decisions SB-18, SB-19, SB-20 of 2026-11-13): the frame a girder type's brace checks use is the shallowest bay
   attached to any of that type's lines (typeGov; was the shallowest bay of the bridge); the diaphragm depth check (CFD, CFE) takes every
   bay against the deeper of its two girders and reports the governing bay; the wind acts on the exterior girder depth (the type on G1 and
   on G_Nb, the deeper when they differ), whatever type is reported. Projects saved before girder types: as before.
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
    const rT = E.rule('xf.type'), rDd = E.rule('dia.depth'), Dw = p.xfBay && nm(p.xfBay.D) > 0 ? nm(p.xfBay.D) : nm(p.sb && p.sb.D) > 0 ? nm(p.sb.D) : null;   // SBXF: the governing bay's web depth when inputsOf gives one
    const dg = nm(p.dg), dMin = nm(p.dMinXF), S = nm(p.S), h = nm(p.h), web = !!(rT && rT.value.web), dB = web && Dw ? Dw : dg, xf = (p.dia || {}).on !== 'yes';
    const deep = rT && rT.value.strict ? dB > dMin + 1e-9 : dB >= dMin - 1e-9, frac_ = rDd && dg < rDd.value.D - 1e-9 ? rDd.value.frac : 0.75;
    const DQ = diaDepthReq(p, E), req = DQ ? DQ.gov.req : frac_ * dg;   // SB-22: girder types: the least depth of every bay (SB-19's, the deeper girder), else as before
    const ch = recCh(req, Infinity), w = recW(req, Infinity), grp = DQ && !deep ? recGroups(p, DQ, ch || w) : null;
    const skM = rT && rT.value.table ? (E.skews ? Math.max(0, ...E.skews.map(v => Math.abs(+v || 0))) : 0) : 0;
    const tb = rT && rT.value.table && !deep ? rT.value.table.find(q => dB >= q[0] - 1e-9 && dB <= q[1] + 1e-9) || rT.value.table.find((q, i, A) => i > 0 && dB > A[i - 1][1] && dB < q[0]) : null;
    const chT = tb && skM < rT.value.skT - 1e-9 ? tb[2] : null;
    const sd = S / dg, kx = rT && rT.value.kHi ? (sd >= rT.value.kHi - 1e-9 ? 'K' : sd <= rT.value.xLo + 1e-9 ? 'X' : null) : null;
    const one = q => q.ch ? `channel diaphragm ${q.ch[0]} (or a rolled W)` : q.w ? `rolled diaphragm ${q.w[0]}` : null, bl = g => g.bays.map(j => `G${j + 1}–G${j + 2}`).join(', ');
    const rec = deep ? (kx ? `${kx === 'K' ? 'K (bottom)' : 'X'}-frame (S/d = ${f2(sd)}, ${E.cite(rT)})` : `${S / h > 1.5 ? 'K (bottom)' : 'X'}-frame (S/h = ${f2(S / h)})`)
      : grp ? `by bay depth (one section does not fit every bay): ${grp.map(g => `${bl(g)}: ${one(g) || `no channel or W of the list between ${f2(g.req)} and ${f2(g.top)} in`}`).join('; ')}`   // SB-22
      : ch ? `channel diaphragm ${ch[0]} (or a rolled W)` : w ? `rolled diaphragm ${w[0]}` : 'rolled W diaphragm';
    const DG = xf ? null : diaGroups(p), sN = v => `${CF_CH.some(s => s[0] === v) ? 'channel' : 'rolled'} diaphragm ${v === 'custom' ? 'custom W' : v}`;   // SB-24: the shape of each bay depth group, where they differ
    const sel = xf ? ({ X: 'X-frame', Kb: 'K-frame', Kt: 'K-frame' }[p.type] || 'cross-frame') : DG && DG.some(g => g.shape !== DG[0].shape) ? `by bay depth group (SB-24): ${DG.map(g => `${bl(g)}: ${sN(g.shape)}`).join('; ')}` : sN(DG ? DG[0].shape : (p.dia || {}).shape);
    return { dg, dMin, deep, xf, rec, sel, ch: ch && ch[0], w: w && w[0], frac: frac_, dB, web, Dw, sd, kx, chT, skM, rT, rDd, ...(DQ ? { req, DQ, grp, show: !!grp || Math.abs(req - frac_ * dg) > 1e-9 || DQ.bays.some(b => Math.abs(b.req - req) > 1e-9) } : {}) };   // show: the SB-22 work (not for equal depths: as before)
  }
  /* SB-22 (2026-11-13; engineer decision SB-22): the section CF10 recommends meets the least diaphragm depth of every bay (SB-19: f × the
     deeper of the two girders a bay connects; the governing bay's req). recCh(req, top): the lightest channel (nominal area) with
     req ≤ d ≤ top; recW(req, top): the first rolled W of CF_DIA with req ≤ d ≤ top (top = Infinity: no upper limit, the rule as before).
     recGroups(p, DQ, sec): when the bays fall in more than one depth group (the Drawings' grouping, engine/sheets.js cfGroups: the bay's h and
     the d of its shallower girder) and the one section sec (the channel, else the W, for the governing req) is deeper than the web depth D_0
     (at the first support) of the shallower girder of some group, or no section meets the governing req: per group, the section for the
     group's own req (the largest of its bays) no deeper than the group's D_0 (Decision pending engineer review: "fit" = d ≤ D_0 of the
     shallower girder). Else null (one section, as recommended). */
  const chArea = s => 2 * s[2] * s[3] + (s[1] - 2 * s[3]) * s[4];
  const recCh = (req, top) => CF_CH.filter(s => s[1] >= req - 1e-9 && s[1] <= top + 1e-9).sort((a, b) => chArea(a) - chArea(b))[0];
  const recW = (req, top) => CF_DIA.find(s => s[1] >= req - 1e-9 && s[1] <= top + 1e-9);
  function recGroups(p, DQ, sec) {
    const B = p.xfBay, m = new Map(), r2 = v => +(+v).toFixed(2); if (!B || !Array.isArray(B.bays)) return null;
    B.bays.forEach(q => { if (!q) return; const k = `${q.h}|${r2(q.s.dg)}`, b = DQ.bays.find(x => x.j === q.j); if (!b) return;
      if (!m.has(k)) m.set(k, { bays: [], req: 0, top: Infinity, s: q.s }); const g = m.get(k); g.bays.push(q.j); g.req = Math.max(g.req, b.req); g.top = Math.min(g.top, r2(q.s.D0)); });
    const G = [...m.values()]; if (G.length < 2 || (sec && G.every(g => sec[1] <= g.top + 1e-9))) return null;
    return G.map(g => ({ ...g, ch: recCh(g.req, g.top), w: recW(g.req, g.top) }));
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

  /* userModes(p): how the entered member forces combine with the computed ones, per group (CFRM, 2026-11-01): { StrI, Con: 'add' | 'replace' };
     p.userMode absent (older projects, GirderDetail's inputs): 'add', today's behaviour */
  function userModes(p) { const u = (p && p.userMode) || {}; return { StrI: u.StrI === 'replace' ? 'replace' : 'add', Con: u.Con === 'replace' ? 'replace' : 'add' }; }
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
    const PZ = V => 2.56e-6 * V ** 2 * nm(p.wind.Kz) * nm(p.wind.G) * nm(p.wind.Cd), dft = (nm(p.dW) > 0 ? nm(p.dW) : g('dg')) / 12, Lb = g('Lb');   // SBXF: wind on the reported girder's own depth d_W (inputsOf), as before; absent: d
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
    // CFRM (2026-11-01): the entered forces of each group add to the computed ones ('add', default; absent in older projects) or replace them
    // ('replace': Strength: the computed Strength III and V wind cases are not used; Constructibility: the stability bracing force is not added)
    const UM = userModes(p); if (UM.StrI === 'replace') combos.filter(cb => cb.id === 'StrIII' || cb.id === 'StrV').forEach(cb => { cb.off = true; cb.name += ', not used: the entered Strength forces replace the computed'; });
    if (UM.Con === 'replace') { const cb = combos[3]; cb.rep = true; cb.name = 'Constructibility (entered forces alone)'; }
    const frames = EL.filter(e => e.k !== 'web');
    combos.forEach(cb => { cb.f = frames.map(e => { const w = cb.off || cb.rep ? 0 : Math.abs(e.unit * cb.wind) + Math.abs(e.ubr * (cb.Mbr || 0)), u = cb.user ? nm(cb.user[e.k]) : 0; return { e, w, u, br: Math.abs(e.ubr * (cb.Mbr || 0)), T: Math.max(0, u + w), Cc: Math.max(0, -(u - w)) }; }); });
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
    const FT = { B: 16, E: 4.5, Ep: 2.6 }[p.fatCat || 'B'], gFI = nm(p.gFI) > 0 ? nm(p.gFI) : 1.75, gF = gFI * 0.65; Object.values(mem).forEach(m => { m.dP = nm((p.user.Fat || {})[m.k]) || 0; m.df = gF * m.dP / m.A; });
    const R = { errors: [], p, N, EL, frames, combos, W, SB, emin: bolt.emin.cut, mem, Fy, Fu, n, s, e0, tg, bolt, Fub, thr, dh, S, h, Lb, dft, FT, gF, gFI, primary: p.primary === 'yes', E, gWS, UM };
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
      else if (R.UM && R.UM.Con === 'replace') c.naWhy = 'Constructibility member forces entered with "Replace computed": the entered forces are used alone (CF1, CF2), the brace force is not added. CF8 still checks the stiffness.';
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
        note: `Force ranges from a refined analysis of the fatigue truck (a line-girder analysis gives none). γ = ${f2(R.gFI)} × 0.65 for Fatigue I (Fatigue I γ of the Fatigue & studs inputs; 10th Edition cross-frame provisions, NCHRP 12-113).` };
      const Ms = M.filter(m => m.dP > 0); if (!Ms.length) c.naWhy = 'No fatigue force ranges entered (from a refined analysis).';
      Ms.forEach(m => c.items.push(rc(`${m.l} (${m.name})`, [f2(m.dP), f2(m.df), f2(R.FT), f2(m.df / R.FT)], m.df, R.FT, `cf.${m.k}.fat`))); out.add(c); }
    // diaphragm used: the angle checks CF1 to CF9 do not apply and are not listed (GirderDetail 2026-10-13)
    if (cfDiaOn(R.p)) for (let i = out.length - 1; i >= 0; i--) if (/^CF[1-9]$/.test(out[i].id)) out.splice(i, 1);
    { const DG = diaGroups(R.p);   // SB-24: two or more bay depth groups: CFD (and CFE when the end diaphragm takes the intermediate shape) per group
      if (DG) { diaGrpChecks(R, out, DG); if ((R.p.dia || {}).eShape) cfDiaChecks(R, out, true); else diaGrpChecks(R, out, DG, true); }
      else { cfDiaChecks(R, out); cfDiaChecks(R, out, true); } }
    { const TR = cfTypeRec(R.p, E), c = { id: 'CF10', grp: 'Bracing type', title: 'Intermediate bracing type for the girder depth', ref: TR.rT || TR.rDd ? `${[TR.rT, TR.rDd].filter(Boolean).map(E.cite).join('; ')}; ${ED} Art. 6.7.4.2` : `Common practice (e.g. AISC/NSBA G13.1 guidance; owner standards govern); ${ED} Art. 6.7.4.2`, items: [],
        note: 'Basis: the girder depth d (out-to-out of the flanges), not the web depth. Below the minimum, a channel or rolled W diaphragm at least 0.75 of the girder depth (6.7.4.2, plate girders) is used.' };
      if (TR.DQ && !TR.deep && TR.show) c.note += ` Girder types: the recommended section meets the least depth of every bay, ${TR.DQ.gov.f} of the deeper of the two girders it connects (governing bay G${TR.DQ.gov.j + 1}–G${TR.DQ.gov.j + 2}: ${f2(TR.req)} in; engineer decision SB-22, 2026-11-13)${TR.grp ? '; one section does not fit every bay, so a section per bay depth group' : ''}.`;   // SB-22
      if (TR.rT || TR.rDd) c.note += ` Owner rule: ${[TR.rT, TR.rDd].filter(Boolean).map(r => `${E.cite(r)}: ${r.text}`).join('; ')}.`;
      const shall = !!(TR.rT && TR.rT.value.shallXF && TR.deep && !TR.xf);
      c.items.push({ loc: 'Intermediate bracing', cells: [`${f2(TR.dB)} in${TR.web ? ' (web D)' : ''}`, `${f2(TR.dMin)} in`, TR.rec, TR.sel], st: shall ? 'fail' : TR.deep || !TR.xf ? 'pass' : 'warn', demand: TR.dB, capacity: TR.dMin, step: 'cf.type' });
      out.add(c); }
    { const TR = cfTypeRec(R.p, E), rB = E.rule('xf.bolts'), rT = TR.rT;   // OWN34, OWN35, OWN37
      if (rT || rB) { const dOn = cfDiaOn(R.p), q = R.p.dia || {}, c = { id: 'CF11', grp: 'Bracing type', title: 'Owner: cross-frame and diaphragm details', ref: [rT, rB].filter(Boolean).map(E.cite).join('; '), items: [],
          note: [rT, rB].filter(Boolean).map(r => `${E.cite(r)}: ${r.text}.`).join(' ') + ' The member and connection checks above are unchanged by these items.' };
        if (rT && rT.value.kHi && !dOn) { const ty = R.p.type, isK = ty === 'Kb' || ty === 'Kt', bad = (TR.kx === 'K' && !isK) || (TR.kx === 'X' && isK);
          c.items.push({ loc: 'X or K by girder spacing to girder depth S/d', cells: [`S/d = ${f2(TR.sd)}, ${isK ? 'K' : 'X'}-frame`, `X when S/d ≤ ${f2(rT.value.xLo)}, K when ≥ ${f2(rT.value.kHi)}`], st: bad ? 'fail' : 'pass', step: 'cf.type' }); }
        const DG = dOn ? diaGroups(R.p) : null, bl = g => g.bays.map(j => `G${j + 1}–G${j + 2}`).join(', '), sN = v => (v === 'custom' ? 'custom W' : v);   // SB-24: the shape of each bay depth group
        if (rT && rT.value.members) { c.items.push({ loc: 'Single members (no back-to-back members)', cells: [dOn ? (DG ? `${DG.map(g => `${bl(g)}: ${sN(g.shape)}`).join('; ')} (single sections)` : `${q.shape === 'custom' ? 'custom W' : q.shape || 'diaphragm'} (single section)`) : 'single angles', 'single angles, tees, channels or W sections'], st: 'pass' });
          c.items.push({ loc: 'Bottom chord (under-clearance less than 16 ft 3 in)', cells: [dOn ? 'diaphragm (full section)' : `${{ X: 'X', Kb: 'K (bottom)', Kt: 'K (top)' }[R.p.type] || ''}-frame with a bottom chord`, 'a bottom chord on every cross-frame'], st: 'pass' }); }
        if (rT && rT.value.table && dOn && !TR.deep) { const ok = !TR.chT || q.shape === TR.chT;
          c.items.push({ loc: 'Intermediate channel diaphragm (Table 6.7.4.2-1)', cells: [String(q.shape === 'custom' ? 'custom W' : q.shape || '—'), TR.chT ? `${TR.chT} for D = ${f2(TR.dB)} in` : TR.skM >= rT.value.skT - 1e-9 ? `skew ${f2(TR.skM)}° ≥ ${rT.value.skT}°: designed` : `D = ${f2(TR.dB)} in outside the table: designed`], st: ok ? 'pass' : 'adv' }); }
        if (rT && rT.value.endCh) { if (dOn) (DG && !q.eShape ? DG.map(g => [g, cfDiaEnd({ ...q, shape: g.shape })]) : [[null, cfDiaEnd(q)]]).forEach(([g, e]) => { const ok = rT.value.endCh.includes(e.shape);   // SB-24: each group's end diaphragm when it takes the intermediate shape
            c.items.push({ loc: `End bearing diaphragms (6.7.4.2.1bCT)${g ? `, bays ${bl(g)}` : ''}`, cells: [String(cfDiaSec(e).nm_), `channel, preferably ${rT.value.endCh.join(' or ')}`], st: ok ? 'pass' : 'warn' }); });
          else c.items.push({ loc: 'End bearing cross-frames (6.7.4.2.2bCT)', cells: ['the intermediate type (this module)', 'K-frame with a channel top chord'], st: 'adv' }); }
        if (rB) { const n = dOn ? Math.max(2, Math.round(+q.nb || 2)) : Math.round(+(R.p.conn || {}).n || 0), ok = n >= rB.value.n;
          c.items.push({ loc: dOn ? 'Bolts per diaphragm end' : 'Bolts per cross-frame member end', cells: [String(n), `at least ${rB.value.n}`], st: ok ? 'pass' : 'warn', r: rB.value.n / Math.max(n, 1), demand: rB.value.n, capacity: n }); }
        if (c.items.length) out.add(c); } }
    return out;
  }
  /* diaGrpChecks(R, out, DG, end) (SB-24, 2026-11-13; engineer decision SB-24): with two or more bay depth groups the diaphragm checks CFD
     (end: CFE) are made for each group (DG = diaGroups(R.p)) with the group's own shape, on the frame of the group: the inputs of the frame
     checked with the group's h and d (the group's shallower girder; as the Drawings detail and the tab Download DXF of each group, SB-21,
     SB-23) and only the group's bays for the least depth (SB-19: f × the deeper girder of each of its bays, the largest). compute() of those
     inputs gives the group's stability bracing values (C and M_br with the group's diaphragm depth, 6.7.4.2.2) and the wind (unchanged:
     the exterior girder depth, SB-20); cfDiaChecks makes the items and steps, operation for operation. One check CFD (CFE) lists every
     group's items, "G1–G2, G5–G6 (W30x99): …": the worst item governs (ckNew). The steps of group k are cf.cfd.g<k+1>.… (cf.cfe.…), the
     group's C, M_br, β_sec added where they differ from the frame checked's. R.DIA: the group of the frame checked; R.DIAg: every group. */
  function diaGrpChecks(R, out, DG, end) {
    const E = R.E || env0(), P0 = R.p, B = P0.xfBay, st = end ? 'cfe' : 'cfd', bl = g => g.bays.map(j => `G${j + 1}–G${j + 2}`).join(', ');
    const parts = DG.map(g => {
      const p = { ...P0, h: g.h, dg: g.dg, dia: { ...P0.dia, shape: g.shape }, xfBay: { ...B, bays: B.bays.map(q => (q && g.bays.includes(q.j) ? q : null)) } };
      const Rg = compute(p, E); if (Rg.errors && Rg.errors.length) return null; const n0 = Rg.steps.length, tmp = ckNew(); cfDiaChecks(Rg, tmp, end);
      const pre = `cf.${st}.g${g.k + 1}`, ren = id => (id === `cf.${st}` ? pre : id && id.startsWith(`cf.${st}.`) ? pre + id.slice(`cf.${st}`.length) : id);
      const steps = Rg.steps.slice(n0).map(t => ({ ...t, id: ren(t.id), label: `${bl(g)} (${g.shape === 'custom' ? 'custom W' : g.shape}): ${t.label}` }));
      if (!end && R.SB && Rg.SB) [['sb.C', 'C'], ['sb.Mbr', 'Mbr'], ['sb.bsec', 'bsec']].forEach(([id, k]) => { if (Rg.SB[k] !== R.SB[k]) { const t = Rg.steps.find(x => x.id === `cf.${id}`);
        if (t) steps.unshift({ ...t, id: `${pre}.${id}`, label: `${bl(g)} (${g.shape === 'custom' ? 'custom W' : g.shape}): ${t.label} (this group's diaphragm depth)` }); } });
      return { g, Rg, c: tmp[0], steps, ren };
    }).filter(Boolean);
    if (!parts.length) return cfDiaChecks(R, out, end);
    const c0 = parts[0].c, nm_ = q => q.Rg.DIA[end ? 'e' : 'i'].nm_, list = parts.map(q => `${bl(q.g)}: ${nm_(q)}`).join('; ');
    const refs = [...new Set(parts.flatMap(q => q.c.ref.replace(`${ED} Arts. `, '').split(', ')))];
    const c = { id: c0.id, grp: c0.grp, title: end ? `End diaphragms at the bearing lines by bay depth group (${list}; in place of the end cross-frames)` : `Diaphragms by bay depth group (${list}; intermediate bracing used in place of the cross-frame)`,
      ref: `${ED} Arts. ${refs.join(', ')}`, items: [],
      note: `By bay depth group (engineer decision SB-24, 2026-11-13, girder types): each group of bays of one depth (the same h and the same shallower girder depth d, the Drawings' grouping) has its own ${end ? 'end ' : ''}diaphragm shape and is checked on its own frame (its h and d, its bays' least depth); the worst group governs. ${parts.map(q => `${bl(q.g)} (${nm_(q)}): ${q.c.note}`).join(' ')}` };
    parts.forEach(q => q.c.items.forEach(it => c.items.push({ ...it, loc: `${bl(q.g)} (${nm_(q)}): ${it.loc}`, step: q.ren(it.step) })));
    parts.forEach(q => R.steps.push(...q.steps));
    const own = parts.find(q => q.g.bays.includes(B.j)) || parts[0];
    (R.DIA = R.DIA || {})[end ? 'e' : 'i'] = own.Rg.DIA[end ? 'e' : 'i'];
    (R.DIAg = R.DIAg || []); parts.forEach(q => { let e = R.DIAg.find(x => x.key === q.g.key); if (!e) R.DIAg.push(e = { key: q.g.key, bays: q.g.bays, shape: q.g.shape, h: q.g.h, dg: q.g.dg, s: q.g.s, p: q.Rg.p, DIA: {} }); e.DIA[end ? 'e' : 'i'] = q.Rg.DIA[end ? 'e' : 'i']; });
    out.add(c);
  }
  /* SBDX (2026-11-10, engineer approval "yes do all three"): two additions to the diaphragm checks, from nominal dimensions (fillets neglected),
     thin-walled centerline values for J and C_w:
     chFlex(X, Fy, Lb, Sx, Iy, ry): a CHANNEL diaphragm's flexural resistance about its strong axis per AASHTO LRFD 10th Ed. Art. 6.12.2.2.5
       (channels; in place of the 6.10.8 I-section approximation, which rolled W diaphragms keep): M_n is the lesser of yielding M_p = F_yZ_x
       and lateral-torsional buckling with L_b = S, C_b = 1.0 (as before): L_p = 1.76r_y√(E/F_y); L_r per Eq. 6.12.2.2.5-8; between them the
       linear transition from M_p to 0.7F_yS_x; beyond L_r M_n = F_crS_x ≤ M_p with the elastic F_cr of Eq. 6.12.2.2.5-4; c = (h_o/2)√(I_y/C_w),
       r_ts² = √(I_yC_w)/S_x, C_w per Eq. 6.12.2.2.5-6 (b = flange toe to web centerline), J = (2bt_f³ + h_ot_w³)/3. Rolled channels have compact
       flanges and webs (C6.12.2.2.5), so FLB and web local buckling are not checked. φ_f = 1.0.
     diaAxial(X, q, Fy, Fu, Ix, Iy, S, db, primary): the diaphragm as an axial member under the wind force P = F_w (both signs): compression per
       6.9.4.1 (flexural buckling; a channel also flexural–torsional buckling about its axis of symmetry, 6.9.4.1.3-2; for a W torsional
       buckling is not a mode since K_zℓ_z = K_yℓ_y, 6.9.4.1.1) with K = 1.0 and ℓ = S − 2e (bolt line to bolt line: the member's own length;
       a single row of web bolts gives little end restraint, so the 0.75 of Art. 4.6.2.5 for frame members is not used) and K_zℓ_z = ℓ; slender
       elements by the effective area of 6.9.4.2.2 (webs of rolled I- and channel sections c_1 = 0.18, c_2 = 1.31; flanges c_1 = 0.22,
       c_2 = 1.49; Table 6.9.4.2.2b-1); φ_c = 0.95. Tension per 6.8.2.1: yielding 0.95F_yA_g, fracture 0.80F_uA_nU with A_n = A_g − n d_h t_w
       (one row of n bolts through the web, holes drilled: R_p = 1.0) and U = A_web/A_g (the connected element: one transverse row has no
       connection length for Table 6.8.2.2-1 Case 2, so the lower bound of Art. 6.8.2.2 is used). Slenderness Kℓ/r_min ≤ 120 (primary) or
       140 (secondary) (6.9.3). Combined with the wind moment M_w per 6.9.2.2. */
  function chFlex(X, Fy, Lb, Sx, Iy, ry) {
    const { d, bf, tf, tw, hw } = X, ho = d - tf, b = bf - tw / 2, Zx = bf * tf * (d - tf) + tw * hw * hw / 4, Mp = Fy * Zx, Cb = 1.0;
    const J = (2 * b * tf ** 3 + ho * tw ** 3) / 3, Cw = tf * b ** 3 * ho ** 2 / 12 * (3 * b * tf + 2 * ho * tw) / (6 * b * tf + ho * tw);
    const c = ho / 2 * Math.sqrt(Iy / Cw), rts = Math.sqrt(Math.sqrt(Iy * Cw) / Sx), jr = J * c / (Sx * ho);
    const Lp = 1.76 * ry * Math.sqrt(ES / Fy), Lr = 1.95 * rts * ES / (0.7 * Fy) * Math.sqrt(jr + Math.sqrt(jr * jr + 6.76 * (0.7 * Fy / ES) ** 2));
    const Fcr = Cb * Math.PI ** 2 * ES / (Lb / rts) ** 2 * Math.sqrt(1 + 0.078 * jr * (Lb / rts) ** 2);
    const zone = Lb <= Lp ? 'p' : Lb <= Lr ? 'i' : 'e', Mltb = zone === 'p' ? Mp : zone === 'i' ? Math.min(Cb * (Mp - (Mp - 0.7 * Fy * Sx) * (Lb - Lp) / (Lr - Lp)), Mp) : Math.min(Fcr * Sx, Mp);
    return { ho, b, Zx, Mp, Cb, J, Cw, c, rts, jr, Lp, Lr, Fcr, zone, Lb, Mltb, Mn: Math.min(Mp, Mltb) };
  }
  function diaAxial(X, q, Fy, Fu, Ix, Iy, S, db, primary) {
    const { chS, d, bf, tf, tw, hw, A } = X, ecc = +q.ecc || 3.5, L = S - 2 * ecc, K = 1.0, KL = K * L, G = 0.385 * ES, ho = d - tf, P2 = Math.PI ** 2;
    const rx = Math.sqrt(Ix / A), ry = Math.sqrt(Iy / A), b = chS ? bf - tw / 2 : bf;
    const J = (2 * b * tf ** 3 + ho * tw ** 3) / 3, Cw = chS ? tf * b ** 3 * ho ** 2 / 12 * (3 * b * tf + 2 * ho * tw) / (6 * b * tf + ho * tw) : Iy * ho * ho / 4;
    const Pex = P2 * ES * A / (KL / rx) ** 2, Pey = P2 * ES * A / (KL / ry) ** 2;
    let ft = null;
    if (chS) { const xb = (hw * tw * tw / 2 + 2 * bf * tf * bf / 2) / A, xc = xb - tw / 2, e = 3 * b * b * tf / (6 * b * tf + ho * tw), xo = e + xc, ro2 = xo * xo + (Ix + Iy) / A, H = 1 - xo * xo / ro2;
      const Pez = (P2 * ES * Cw / KL ** 2 + G * J) / (A * ro2), Pft = (Pex + Pez) / (2 * H) * (1 - Math.sqrt(1 - 4 * Pex * Pez * H / (Pex + Pez) ** 2));
      ft = { xb, xc, e, xo, ro2, H, Pez, Pft }; }
    const Pe = Math.min(Pex, Pey, ft ? ft.Pft : Infinity), mode = Pe === Pey ? 'flexural, y-axis' : Pe === Pex ? 'flexural, x-axis' : 'flexural–torsional';
    const Po = Fy * A, Pcr = Pe >= 0.44 * Po ? 0.658 ** (Po / Pe) * Po : 0.877 * Pe, Fcr = Pcr / A;
    const be = (w, lam, lr, c1, c2) => { if (lam <= lr * Math.sqrt(Fy / Fcr) + 1e-12) return { be: w, slender: lam > lr, Fel: null }; const Fel = (c2 * lr / lam) ** 2 * Fy, r = Math.sqrt(Fel / Fcr); return { be: Math.min(w, w * (1 - c1 * r) * r), slender: true, Fel }; };
    const lrw = 1.49 * Math.sqrt(ES / Fy), lrf = 0.56 * Math.sqrt(ES / Fy), lw = hw / tw, wf = chS ? bf : bf / 2, lf = wf / tf, nf = chS ? 2 : 4;
    const W_ = be(hw, lw, lrw, 0.18, 1.31), F_ = be(wf, lf, lrf, 0.22, 1.49), Aeff = A - (hw - W_.be) * tw - nf * (wf - F_.be) * tf;
    const Pn = Fcr * Aeff, Pr = 0.95 * Pn;
    const nb = Math.max(2, Math.round(+q.nb || 2)), dh = (BOLT[String(db)] || {}).dh || db + 0.0625, An = A - nb * dh * tw, U = hw * tw / A, Pyr = 0.95 * Fy * A, Pur = 0.80 * Fu * An * U, Pt = Math.min(Pyr, Pur);
    const rmin = Math.min(rx, ry), sl = KL / rmin, lim = primary ? 120 : 140;
    return { L, K, KL, ecc, rx, ry, rmin, J, Cw, G, Pex, Pey, ft, Pe, mode, Po, Pcr, Fcr, lrw, lrf, lw, lf, wf, nf, W: W_, F: F_, Aeff, Pn, Pr, nb, dh, An, U, Pyr, Pur, Pt, sl, lim, Fu };
  }
  /* cfDiaChecks(R, out, end): the diaphragm in place of the cross-frame (CFD) or at the bearing lines (end: CFE) */
  function cfDiaChecks(R, out, end) {
    const E = R.E || env0(), p = R.p, q0 = p.dia || {}; if (q0.on !== 'yes') return; const q = end ? cfDiaEnd(q0) : q0, X = cfDiaSec(q), { chS, d, bf, tf, tw, nm_ } = X, Fy = +q.gr || 50, Es = 29000, S = R.S, SB = R.SB;
    const hw = X.hw, A = X.A, Ix = bf * d ** 3 / 12 - (bf - tw) * hw ** 3 / 12, Sx = 2 * Ix / d,
      Iy = chS ? (() => { const xb = (hw * tw * tw / 2 + 2 * bf * tf * bf / 2) / A; return hw * tw ** 3 / 12 + hw * tw * (tw / 2 - xb) ** 2 + 2 * (tf * bf ** 3 / 12 + bf * tf * (bf / 2 - xb) ** 2); })() : 2 * tf * bf ** 3 / 12 + hw * tw ** 3 / 12, ry = Math.sqrt(Iy / A), dgT = nm(p.dg);
    const lt = FX().ltbFnc({ bfc: bf, tfc: tf, Dc: hw / 2, tw, Lb: S, Cb: 1.0, Rb: 1, Rh: 1, Fyc: Fy, Fyw: Fy });   // 6.10.8 for a noncomposite rolled I-section, L_b = girder spacing
    const CH = chS ? chFlex(X, Fy, S, Sx, Iy, ry) : null, Mn = CH ? CH.Mn : lt.Fnc * Sx;   // SBDX: a channel per 6.12.2.2.5 (was F_nc S_x of 6.10.8, as a W keeps)
    const k = 5, lam = hw / tw, r1 = 1.12 * Math.sqrt(Es * k / Fy), r2 = 1.40 * Math.sqrt(Es * k / Fy), C = lam <= r1 ? 1 : lam <= r2 ? r1 / lam : 1.57 / lam ** 2 * (Es * k / Fy), Vn = C * 0.58 * Fy * hw * tw;
    const wk = R.W.III.Fw >= R.W.V.Fw ? 'III' : 'V', Fw = R.W[wk].Fw, Mw = Fw * dgT, Vw = 2 * Mw / S;
    const id = end ? 'CFE' : 'CFD', c = { id, grp: end ? 'End diaphragms (bearing lines)' : 'Diaphragm (intermediate bracing used)', title: end ? `${chS ? 'Channel' : 'Rolled'} end diaphragm ${nm_} at the bearing lines (in place of the end cross-frames)` : `${chS ? 'Channel' : 'Rolled'} diaphragm ${nm_} (intermediate bracing used in place of the cross-frame)`,
      ref: `${ED} Arts. 6.7.4.2, 6.7.4.2.2, ${chS ? '6.12.2.2.5' : '6.10.8'}, 6.10.9, 6.9.2.2, 6.9.3, 6.9.4.1, 6.9.4.2.2, 6.8.2.1, 6.13.2, 3.4.3.1, 4.6.2.7.1`, items: [],
      note: `Properties from nominal dimensions (fillets neglected): I_x = ${f0(Ix)} in⁴, S_x = ${f0(Sx)} in³, r_y = ${f2(ry)} in. ${chS ? 'Flexural resistance per 6.12.2.2.5 (channels): the lesser of yielding F_yZ_x and lateral-torsional buckling with L_b = S, C_b = 1.0 (conservative); J and C_w from thin-walled centerline dimensions.' : 'Flexural resistance per 6.10.8 as a noncomposite rolled I-section braced only at the girders (L_b = S, C_b = 1.0, conservative).'} The brace stiffness 6EI/S assumes reverse-curvature bending between girders. Wind (Strength ${wk}): the bottom-flange wind force F_w of the exterior girder is carried to the deck through the diaphragm, a torque F_w d resisted by diaphragm bending with shear 2M_w/S, and the axial force P = F_w (either sign), checked in compression (6.9.4.1, K = 1.0, ℓ = S − 2e) and tension (6.8.2.1) and combined with M_w per 6.9.2.2.` };
    const st = id.toLowerCase(), it = (loc, dem, res, s, r, demand, capacity, step) => c.items.push({ loc, cells: [dem, res, r != null ? f2(r) : '—'], st: s, r, demand, capacity, step: step || `cf.${st}` });
    const tag = k => { c.items[c.items.length - 1][k] = true; };   // SBDX: items new in this app (sbdx) and items that use M_n (mn), for the GirderDetail parity test
    const MnT = CH ? `6.12.2.2.5, ${{ p: 'L_b ≤ L_p', i: 'L_p < L_b ≤ L_r', e: 'L_b > L_r' }[CH.zone]}` : `F_nc = ${f2(lt.Fnc)} ksi`;
    const fD = cfTypeRec(p, E).frac;   // OWN36 (MassDOT 3.6.3.6): 0.5 for a plate girder under 48 in; 0.75 otherwise
    const DQ = diaDepthReq(p, E);   // SBXF2 (SB-19): girder types: every bay against the deeper of its two girders, the governing bay
    if (DQ) { const g = DQ.gov, lim = g.req; it(`Depth (6.7.4.2: at least ${g.f === 0.75 ? '0.75 of the plate girder depth d' : `${g.f} of the depth d, ${E.cite(E.rule('dia.depth'))}`}; every bay against the deeper of its two girders, governing bay G${g.j + 1}–G${g.j + 2}: d of G${g.q.line + 1} ${g.q.label})`, `${f2(d)} in`, `${f2(lim)} in`, d >= lim - 1e-6 ? 'pass' : 'warn', lim / d, lim, d, `cf.${st}.dep`); }
    else if (dgT > 0) it(fD === 0.75 ? 'Depth (6.7.4.2: at least 0.75 of the plate girder depth d)' : `Depth (6.7.4.2 rolled beams, ${E.cite(E.rule('dia.depth'))}: at least ${fD} of the depth d)`, `${f2(d)} in`, `${f2(fD * dgT)} in`, d >= fD * dgT - 1e-6 ? 'pass' : 'warn', fD * dgT / d, fD * dgT, d);
    let bbr = null, bT = null;
    if (SB) { if (!end) { bbr = 6 * Es * Ix / S; bT = 1 / (1 / bbr + (isFinite(SB.bsec) ? 1 / SB.bsec : 0) + 1 / SB.bg); const r = SB.bReq / bT;
      it('Torsional brace system stiffness (6.7.4.2.2)', `β_T,req = ${f0(SB.bReq)} kip-in/rad`, `β_T = ${f0(bT)} (β_br = ${f0(bbr)}, β_sec = ${isFinite(SB.bsec) ? f0(SB.bsec) : '∞'}, β_g = ${f0(SB.bg)}; d_dia ${SB.deep ? '≥' : '<'} 0.8 D = ${f2(0.8 * SB.Dg)} in)`, r <= 1 ? 'pass' : 'fail', r, SB.bReq, bT); }
      const rm = SB.Mbr / (1.0 * Mn); it('Brace moment M_br (6.7.4.2.2)', `${f0(SB.Mbr)} kip-in`, `φ_f M_n = ${f0(Mn)} kip-in (${MnT})`, rm <= 1 ? 'pass' : 'fail', rm, SB.Mbr, Mn, `cf.${st}.Mn`); tag('mn');
      const Vb = 2 * SB.Mbr / S; it('Shear from the brace moment', `${f2(Vb)} kip`, `φ_v V_n = ${f2(Vn)} kip (C = ${n3(C)})`, Vb <= Vn ? 'pass' : 'fail', Vb / Vn, Vb, Vn); }
    else it('Stability bracing', 'enter the girder and bracing data (Stability bracing inputs)', '—', 'na');
    if (end && q.end === 'yes' && +q.Rj > 0) { const Mj = +q.Rj * +q.aj, rm = Mj / Mn, rv = +q.Rj / Vn;
      it('Jacking: flexure (3.4.3.1)', `${f0(Mj)} kip-in`, `φ_f M_n = ${f0(Mn)} kip-in`, rm <= 1 ? 'pass' : 'fail', rm, Mj, Mn, `cf.${st}.Mn`); tag('mn'); it('Jacking: shear', `${f2(+q.Rj)} kip`, `φ_v V_n = ${f2(Vn)} kip`, rv <= 1 ? 'pass' : 'fail', rv, +q.Rj, Vn); }
    { const rm = Mw / Mn, rv = Vw / Vn;
      it(`Wind, Strength ${wk}: flexure M_w = F_w d (4.6.2.7.1)`, `${f0(Mw)} kip-in (F_w = ${f2(Fw)} kip)`, `φ_f M_n = ${f0(Mn)} kip-in`, rm <= 1 ? 'pass' : 'fail', rm, Mw, Mn, `cf.${st}.Mw`); tag('mn');
      it(`Wind, Strength ${wk}: shear 2M_w/S`, `${f2(Vw)} kip`, `φ_v V_n = ${f2(Vn)} kip`, rv <= 1 ? 'pass' : 'fail', rv, Vw, Vn); }
    // SBDX: the diaphragm as an axial member under P = F_w (compression and tension), its slenderness, and P with M_w (6.9.2.2)
    const AX = diaAxial(X, q, Fy, Fy === 36 ? 58 : 65, Ix, Iy, S, +((p.conn || {}).d) || 0.875, R.primary);
    { const rc_ = Fw / AX.Pr, rt_ = Fw / AX.Pt, pr = Fw / AX.Pr, mr = Mw / Mn, ia = pr < 0.2 ? pr / 2 + mr : pr + 8 / 9 * mr; AX.ia = ia; AX.pr = pr; AX.mr = mr;
      it(`Wind, Strength ${wk}: axial compression P = F_w (6.9.4.1, ${AX.F.slender || AX.W.slender ? '6.9.4.2.2 effective area, ' : ''}Kℓ = ${f2(AX.KL)} in; ${AX.mode})`, `${f2(Fw)} kip`, `φ_c P_n = ${f2(AX.Pr)} kip`, rc_ <= 1 ? 'pass' : 'fail', rc_, Fw, AX.Pr, `cf.${st}.ax.Pr`); tag('sbdx');
      it(`Wind, Strength ${wk}: axial tension P = F_w (6.8.2.1, yielding and net-section fracture)`, `${f2(Fw)} kip`, `P_r = ${f2(AX.Pt)} kip`, rt_ <= 1 ? 'pass' : 'fail', rt_, Fw, AX.Pt, `cf.${st}.ax.Pt`); tag('sbdx');
      it(`Slenderness Kℓ/r_min (6.9.3, ${R.primary ? 'primary' : 'secondary'} member)`, `${f2(AX.sl)}`, `≤ ${AX.lim}`, AX.sl <= AX.lim ? 'pass' : 'fail', AX.sl / AX.lim, AX.sl, AX.lim, `cf.${st}.ax.sl`); tag('sbdx');
      it(`Wind, Strength ${wk}: axial and flexure (6.9.2.2, P_u/P_r = ${n3(pr)})`, `${n3(ia)}`, '≤ 1.0', ia <= 1 + 1e-12 ? 'pass' : 'fail', ia, ia, 1, `cf.${st}.ax.ia`); tag('sbdx'); tag('mn'); }
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
    (R.DIA = R.DIA || {})[end ? 'e' : 'i'] = { nm_, chS, d, bf, tf, tw, hw, A, Ix, Sx, Iy, ry, Mn, Fnc: lt.Fnc, lt, CH, AX, MnI: lt.Fnc * Sx, Fy, Vn, C, lam, wk, Fw, Mw, Vw, Mbr: SB ? SB.Mbr : null, bbr, bT, jack: end && q.end === 'yes' && +q.Rj > 0 ? { Rj: +q.Rj, aj: +q.aj } : null, nb, s, db, Ab, thr, ecc: +q.ecc || 0, ys, sy2, ym, V, Vt, M, fmax, Mc, fw, res, phiRs, phiRb, need, avail, cp, G, fD };
    diaSteps(R, end);
    out.add(c);
  }

  /* ================= worked steps (new; the values above, worked) ================= */
  /* xfBaySteps(w, R, brN) (SBXF, 2026-11-13; engineer decision 2026-11-13): with girder types (p.xfBay from inputsOf) the cross-frame depth h
     and the girder depth d of the frame checked, from the governing bay (the shallower of its two girders, the shallowest bay of the
     bridge), and the depth d_W the wind acts on (the reported girder, as before) */
  function xfBaySteps(w, R, brN) {
    const p = R.p, B = p.xfBay, gl = q => q ? `G${q.line + 1}` : '', dl = q => q ? `${gl(q)} (${q.label})` : 'no girder type', bn = `G${B.j + 1}–G${B.j + 2}`;
    const each = B.bays.map(q => q ? `${`G${q.j + 1}–G${q.j + 2}`}: ${q.a ? `${gl(q.a)} D = ${n2(q.a.D)} in` : `${`G${q.j + 1}`} no type`}, ${q.b ? `${gl(q.b)} D = ${n2(q.b.D)} in` : `${`G${q.j + 2}`} no type`}, shallower ${gl(q.s)}${B.hAuto ? `, h = ${n0(q.h)} in` : ''}` : null).filter(Boolean).join('; ');
    const tl = B.tl ? B.tl.map(j => `G${j + 1}`).join(', ') : '', sc = B.scope === 'type' ? `the shallowest bay attached to any line of the girder type ${B.rep} (${tl}; engineer decision SB-18, 2026-11-13: the frames that brace this type)` : 'the shallowest bay of the bridge';
    const asm = `Assumption (engineer decision 2026-11-13, girder types): each ${brN} bay takes the depth of the shallower of the two girders it connects (the girder type assigned to each line; the smaller web depth D, equal D the smaller d); AASHTO LRFD sets the depth of a cross-frame or diaphragm (6.7.4.2.1: as deep as practicable, at least 0.75 of the plate girder depth; 6.7.4.2.2: h_b) but not which of two unequal girders governs. The one frame checked here takes the governing bay, ${sc} (with the largest girder spacing S and the largest L_b as before)${B.scope === 'type' && B.bj !== B.j ? `; the bridge's shallowest bay G${B.bj + 1}–G${B.bj + 2} is checked with the types on its lines` : ''}; the frame weights in DC1 take each bay's own h.`;
    const sa = B.a ? n2(B.a.D) : '—', sb = B.b ? n2(B.b.D) : '—', ref = `${ED} Arts. 6.7.4.2.1, 6.7.4.2.2`;
    w.add({ id: 'xfD', label: `Web depth of the governing bay ${bn}${B.scope === 'type' ? ` (the shallowest attached to ${tl})` : ''}: ${B.a && B.b ? (B.eq ? `${dl(B.a)} and ${dl(B.b)}, of equal depth` : `the shallower of ${dl(B.a)} and ${dl(B.b)}, ${dl(B.s)}`) : dl(B.s)} (the largest web depth of each girder type)`, sym: 'D', eq: B.a && B.b ? `\\min(D_{${gl(B.a)}},\\ D_{${gl(B.b)}})` : '', sub: B.a && B.b ? `\\min(${sa},\\ ${sb})` : '', value: B.D, unit: 'in', d: 2, ref, note: `${asm} Every bay: ${each}.` });
    if (B.hAuto) w.add({ id: 'h', label: `Cross-frame depth between the chord work points, governing bay ${bn} (Preliminary sizing rule)`, sym: 'h', eq: '\\mathrm{round}(\\max(D - 8,\\ 0.75D))', sub: `\\mathrm{round}(\\max(${n2(B.D)} - 8,\\ 0.75(${n2(B.D)})))`, value: R.h, unit: 'in', d: 2, ref });
    else w.add({ id: 'h', label: 'Cross-frame depth between the chord work points, entered (every bay)', sym: 'h', eq: '', sub: '', value: R.h, unit: 'in', d: 2, ref });
    w.add({ id: 'dg', label: `Girder depth (out-to-out of the flanges, at the first support) of the shallower girder of the governing bay ${bn}, ${dl(B.s)}${B.eq ? ' (equal depths)' : ''}`, sym: 'd', eq: 'D_{0} + t_{top} + t_{bot}', sub: `${n2(B.s.D0)} + ${n3(B.s.tT)} + ${n3(B.s.tB)}`, value: nm(p.dg), unit: 'in', d: 2, ref: `${ED} Art. 6.7.4.2.1`, note: `For the bracing type for the girder depth (CF10) and the diaphragm depth (CFD). ${B.a && B.b ? `d of ${gl(B.a)} = ${n2(B.a.dg)} in, of ${gl(B.b)} = ${n2(B.b.dg)} in.` : ''}` });
    const X = B.ext, xl = q => `d_{G${q.line + 1}}`;   // SBXF2 (SB-20): the exterior girder depth, the deeper of the types on G1 and G_Nb
    if (X) w.add({ id: 'dW', label: `Girder depth for the wind on the exterior girder (at the first support): ${X.a && X.b ? `the deeper of ${dl(X.a)} and ${dl(X.b)}, ${dl(X.q)}` : dl(X.q)} (a girder depth, not the ${brN} depth)`, sym: 'd_{W}', eq: X.a && X.b ? `\\max(${xl(X.a)},\\ ${xl(X.b)})` : '', sub: X.a && X.b ? `\\max(${n2(X.a.dg)},\\ ${n2(X.b.dg)})` : '', value: R.dft * 12, unit: 'in', d: 2, ref: `${ED} Art. 4.6.2.7.1`,
      note: `Assumption (engineer decision SB-20, 2026-11-13, girder types): the wind on the girders acts on the exterior girder, so its depth d_W is the exterior girder's (the girder type on G1 and on the last line; the deeper when they differ), whatever girder type is reported (here ${B.rep}, d = ${n2(X.own)} in). d = D_0 + t_top + t_bot at the first support: ${X.a ? `${gl(X.a)} ${n2(X.a.D0)} + ${n3(X.a.tT)} + ${n3(X.a.tB)} = ${n2(X.a.dg)} in` : ''}${X.a && X.b ? '; ' : ''}${X.b ? `${gl(X.b)} ${n2(X.b.D0)} + ${n3(X.b.tT)} + ${n3(X.b.tB)} = ${n2(X.b.dg)} in` : ''}.` });
    else w.add({ id: 'dW', label: `Girder depth for the wind on the exterior girder: the reported girder ${B.rep} at the first support (no girder type on an exterior line; a girder depth, not the ${brN} depth)`, sym: 'd_{W}', eq: '', sub: '', value: R.dft * 12, unit: 'in', d: 2, ref: `${ED} Art. 4.6.2.7.1` });
  }
  /* typeRecStep(w, R) (SB-22, 2026-11-13; engineer decision SB-22): with girder types, when CF10 recommends a channel or W diaphragm (girder
     depth below the minimum for a cross-frame), the least depth it is sized for: every bay against the deeper of its two girders (SB-19),
     the governing bay, and the section chosen (per bay depth group when one section does not fit every bay). Display of cfTypeRec's values;
     not shown for bays of equal depth (TR.show false: the section and its basis as before). */
  function typeRecStep(w, R) {
    const TR = cfTypeRec(R.p, R.E || env0()), DQ = TR.DQ; if (!DQ || TR.deep || !TR.show) return;
    const g = DQ.gov, gl = q => `G${q.line + 1} ${q.label}`, bn = b => `G${b.j + 1}–G${b.j + 2}`, ref = `${ED} Art. 6.7.4.2.1`;
    const each = DQ.bays.map(b => `${bn(b)}: ${b.f} × ${n2(b.d)} (${gl(b.q)}) = ${n2(b.req)} in`).join('; ');
    const sec = (c, x, top) => c ? `channel ${c[0]} (d = ${n2(c[1])} in, the lightest channel of the list with ${top ? `${n2(x)} ≤ d ≤ ${n2(top)} in` : `d ≥ ${n2(x)} in`})` : null;
    const wsec = (c, x, top) => c ? `rolled ${c[0]} (d = ${n2(c[1])} in, the first W of the list with ${top ? `${n2(x)} ≤ d ≤ ${n2(top)} in` : `d ≥ ${n2(x)} in`})` : null;
    const pick = (ch, wv, x, top) => sec(ch, x, top) || wsec(wv, x, top) || `no channel or W of the list with ${top ? `${n2(x)} ≤ d ≤ ${n2(top)} in` : `d ≥ ${n2(x)} in`}`;
    const CH = TR.ch ? CF_CH.find(s => s[0] === TR.ch) : null, WW = TR.w ? CF_DIA.find(s => s[0] === TR.w) : null;
    const grp = TR.grp ? ` One section does not fit every bay (${CH || WW ? `${(CH || WW)[0]}, d = ${n2((CH || WW)[1])} in, is deeper than the web depth D_0 of the shallower girder of a bay group` : 'no section of the list meets the governing bay'}), so per bay depth group (the bays of the Drawings cross-frame details: the same h and the same shallower girder depth d; fit: d of the section ≤ D_0 at the first support of the shallower girder, Decision pending engineer review): ${TR.grp.map(q => `${q.bays.map(j => `G${j + 1}–G${j + 2}`).join(', ')} (shallower ${gl(q.s)}, D_0 = ${n2(q.top)} in; d_req = ${n2(q.req)} in): ${pick(q.ch, q.w, q.req, q.top)}`).join('; ')}.` : '';
    w.add({ id: 'type', label: `Diaphragm section recommended for the girder depth (CF10): the least depth, every bay against the deeper of the two girders it connects; governing bay ${bn(g)}, ${gl(g.q)}`, sym: 'd_{req}', eq: `${g.f}\\max(d_{a},\\ d_{b})`,
      sub: g.a && g.b ? `${g.f}\\max(${n2(g.a.dg)},\\ ${n2(g.b.dg)})` : `${g.f}(${n2(g.d)})`, value: g.req, unit: 'in', d: 2, ref,
      note: `Assumption (engineer decision SB-22, 2026-11-13, girder types): the channel or rolled W that CF10 recommends meets the least depth of every bay (the diaphragm depth check CFD, engineer decision SB-19: ${g.f} of the deeper of the two girders, d = D_0 + t_top + t_bot at the first support), not only that of the shallower girder of the governing bay. Every bay: ${each}. One section for every bay: ${pick(CH, WW, g.req, null)}.${grp}` });
  }
  /* SBDIA (2026-11-10): with a diaphragm (dia.on = 'yes') the truss steps of the angle cross-frame (member forces per kip, entered forces, the
     angle members CF1 to CF6 and CF9, the connection geometry CF6, the X / K brace stiffness and its system stiffness CF8) are not listed: CFD /
     CFE work the diaphragm's own. Display only: the values computed are unchanged. TRUSS: their step ids. */
  const TRUSS = /^cf\.(tr\d+|user\.|top\.|bot\.|diag\.|geo$|sb\.bbr$|sb\.bT$)/;
  function steps(R) {
    const w = St().work('cf'), p = R.p, W = R.W, dOn = cfDiaOn(p), brN = dOn ? 'diaphragm' : 'cross-frame';
    if (p.xfBay) xfBaySteps(w, R, brN); else   // SBXF (2026-11-13): girder types: the governing bay's depths (h, d) and the wind depth, worked
    w.add({ id: 'dg', label: 'Girder depth (out-to-out of the flanges)', sym: 'd', eq: '', sub: '', value: R.dft * 12, unit: 'in', d: 2 });
    if (p.xfBay) typeRecStep(w, R);   // SB-22: the CF10 section for the depth of every bay
    w.add({ id: 'Lb', label: `${dOn ? 'Diaphragm' : 'Cross-frame'} spacing (the largest unbraced length on any girder)`, sym: 'L_{b}', eq: '', sub: '', value: R.Lb, unit: 'ft', d: 2, ref: `${ED} Art. 6.7.4.2.1` });
    [['III', `Strength III, V = ${n0(W.III.V)} mph`], ['V', 'Strength V, V = 80 mph']].forEach(([k, l]) => { const q = W[k];
      w.add({ id: `w${k}.PZ`, label: `Design wind pressure, ${l}`, sym: 'P_{Z}', eq: '2.56 \\times 10^{-6}V^{2}K_{z}GC_{D}', sub: `2.56 \\times 10^{-6}(${n0(q.V)})^{2}(${n2(nm(p.wind.Kz))})(${n2(nm(p.wind.G))})(${n2(nm(p.wind.Cd))})`, value: q.PZ, unit: 'ksf', d: 4, ref: `${ED} Eq. 3.8.1.2.1-1` });
      w.add({ id: `w${k}.W`, label: `Wind on the lower half of the exterior girder, carried by the bottom flange (γ_WS = 1.0η = ${n3(R.gWS)})`, sym: 'W', eq: '\\frac{\\gamma_{WS}P_{Z}d}{2}', sub: `\\frac{${n3(R.gWS)}(${n4(q.PZ)})(${n3(R.dft)})}{2}`, value: q.W, unit: 'kip/ft', d: 4, ref: `${ED} Art. 4.6.2.7.1` });
      w.add({ id: `w${k}.Fw`, label: `Wind force at the bottom flange per ${brN}, ${l}`, sym: 'F_{w}', eq: 'WL_{b}', sub: `${n4(q.W)}(${n2(R.Lb)})`, value: q.Fw, unit: 'kip', d: 2, ref: `${ED} Art. 4.6.2.7.1` }); });
    R.frames.forEach((e, i) => w.add({ id: `tr${i}`, label: `${e.lbl}: force per kip of F_w (truss model, top chord work points held by the deck) and per kip-in of brace moment`, sym: 'f_{w},\\ f_{br}', eq: '', sub: `${n4(e.unit)},\\ ${n4(e.ubr)}`, value: e.unit, unit: 'kip/kip', d: 4, note: `Length ${n2(e.L)} in.` }));
    // CFRM: the entered member forces and how they combine (only where a force is entered or "Replace computed" is chosen)
    const UM = R.UM || userModes(p), uOf = g => ['top', 'bot', 'diag'].map(k => nm(((p.user || {})[g] || {})[k]) || 0), uAny = g => uOf(g).some(v => v !== 0) || UM[g] === 'replace';
    [['StrI', 'Strength I'], ['Con', 'Constructibility']].forEach(([g, nmG]) => { if (!uAny(g)) return; const v = uOf(g), rep = UM[g] === 'replace';
      const note = g === 'StrI' ? (rep ? 'Replace computed: these forces are the Strength design forces, used alone; the computed Strength III and V wind cases (F_w) are not used.'
        : 'Add to computed: Strength I takes these forces (nothing is computed for Strength I); Strength III and V take the computed wind forces f_w F_w. Each member is designed for the largest of the three.')
        : (rep ? 'Replace computed: these forces are used alone; the stability bracing force f_br M_br is not added (CF7 not checked; CF8, the stiffness, still is).'
        : R.SB ? 'Add to computed: T = P + |f_br M_br|, C = −P + |f_br M_br| with the stability bracing moment M_br (see the torsional bracing steps).' : 'Add to computed: the stability bracing check is off, so nothing is added: the entered forces alone.');
      w.add({ id: `user.${g}`, label: `${nmG} member forces entered from a refined analysis (factored, tension +): ${rep ? 'Replace computed' : 'Add to computed'}`, sym: 'P_{top},\\ P_{bot},\\ P_{diag}', eq: '', sub: `${n2(v[0])},\\ ${n2(v[1])},\\ ${n2(v[2])}`, value: Math.max(...v.map(Math.abs)), unit: 'kip', d: 2, note }); });
    const SB = R.SB; if (SB) {
      w.add({ id: 'sb.Iyeff', label: 'Effective I_y of the girder for torsional bracing', sym: 'I_{yeff}', eq: 'I_{yc} + \\frac{t}{c}I_{yt}', sub: `${n2(SB.Iyc)} + \\frac{${n2(SB.tD)}}{${n2(SB.cD)}}(${n2(SB.Iyt)})`, value: SB.Iyeff, unit: 'in^{4}', d: 2, ref: `${ED} Art. 6.7.4.2.2` });
      w.add({ id: 'sb.ho', label: 'Distance between flange centroids', sym: 'h_{o}', eq: 'D + \\frac{t_{c} + t_{t}}{2}', sub: `${n2(SB.Dg)} + \\frac{${n3(SB.tc)} + ${n3(SB.tt)}}{2}`, value: SB.ho, unit: 'in', d: 2 });
      w.add({ id: 'sb.C', label: `Coefficient C (${SB.full ? `${brN} ≥ 0.8 of the web depth on full-depth plates` : 'otherwise'})`, sym: 'C', eq: '', sub: `h_{br} = ${n2(SB.hBr)} ${SB.deepFrame ? '\\ge' : '\\lt'} 0.8D = ${n2(0.8 * SB.Dg)}`, value: SB.C, unit: '', d: 1, ref: `${ED} Art. 6.7.4.2.2` });
      w.add({ id: 'sb.Mbr', label: 'Brace moment during deck placement', sym: 'M_{br}', eq: '\\frac{CL}{nEI_{yeff}}\\left(\\frac{M_{u}}{C_{b}}\\right)^{2}\\frac{L_{b}}{500h_{o}}', sub: `\\frac{${SB.C}(${n0(SB.L)})}{${n0(SB.n)}(29{,}000)(${n2(SB.Iyeff)})}\\left(\\frac{${n0(SB.Mu)}}{${n2(SB.Cb)}}\\right)^{2}\\frac{${n2(SB.Lb)}}{500(${n2(SB.ho)})}`, value: SB.Mbr, unit: 'kip-in', d: 1, ref: `${ED} Eq. 6.7.4.2.2-14` });
      w.add({ id: 'sb.bbr', label: `Brace stiffness (${SB.isX ? 'X: tension-only diagonal' : 'K frame'}; areas × R = 0.65)`, sym: '\\beta_{br}', eq: SB.isX ? '\\frac{A_{d}ES^{2}h^{2}}{L_{c}^{3}}' : '\\frac{2ES^{2}h^{2}}{8L_{c}^{3}/A_{d} + S^{3}/A_{h}}', sub: SB.isX ? `\\frac{${n3(SB.Ad)}(29{,}000)(${n2(R.S)})^{2}(${n2(R.h)})^{2}}{(${n2(SB.Lc)})^{3}}` : `\\frac{2(29{,}000)(${n2(R.S)})^{2}(${n2(R.h)})^{2}}{8(${n2(SB.Lc)})^{3}/${n3(SB.Ad)} + (${n2(R.S)})^{3}/${n3(SB.Ah)}}`, value: SB.bbr, unit: 'kip-in/rad', d: 0, ref: `${ED} Art. 6.7.4.2.2; C4.6.3.3.4` });
      w.add({ id: 'sb.bsec', label: 'Web distortional stiffness (infinite when the bracing is at least 0.8 of the web depth)', sym: '\\beta_{sec}', eq: SB.deep ? '\\infty' : '\\frac{3.3E}{h_{o}}\\left(\\frac{1.5h_{o}t_{w}^{3}}{12} + \\frac{t_{s}b_{s}^{3}}{12}\\right)', sub: SB.deep ? '' : `\\frac{3.3(29{,}000)}{${n2(SB.ho)}}\\left(\\frac{1.5(${n2(SB.ho)})(${n4(SB.tw)})^{3}}{12} + \\frac{${n4(SB.tsp)}(${n3(SB.bs)})^{3}}{12}\\right)`, value: isFinite(SB.bsec) ? SB.bsec : 'infinite', unit: 'kip-in/rad', d: 0, ref: `${ED} Art. 6.7.4.2.2`, note: `Connection plate b_s × t_s = ${n3(SB.bs)} × ${n4(SB.tsp)} in (${SB.cpTs ? `Transverse stiffeners Type ${SB.cpTs.k}` : 'the Cross-frames inputs'}).` });
      w.add({ id: 'sb.bg', label: 'In-plane girder stiffness', sym: '\\beta_{g}', eq: '\\frac{24(n_{g} - 1)^{2}S^{2}EI_{x}}{n_{g}L^{3}}', sub: `\\frac{24(${SB.ng} - 1)^{2}(${n2(R.S)})^{2}(29{,}000)(${n0(SB.Ix)})}{${SB.ng}(${n0(SB.L)})^{3}}`, value: SB.bg, unit: 'kip-in/rad', d: 0, ref: `${ED} Art. 6.7.4.2.2` });
      w.add({ id: 'sb.bT', label: 'Torsional brace system stiffness', sym: '\\beta_{T}', eq: '\\left(\\frac{1}{\\beta_{br}} + \\frac{1}{\\beta_{sec}} + \\frac{1}{\\beta_{g}}\\right)^{-1}', sub: `\\left(\\frac{1}{${n0(SB.bbr)}} + ${isFinite(SB.bsec) ? `\\frac{1}{${n0(SB.bsec)}}` : '0'} + \\frac{1}{${n0(SB.bg)}}\\right)^{-1}`, value: SB.bT, unit: 'kip-in/rad', d: 0, ref: `${ED} Art. 6.7.4.2.2` });
      w.add({ id: 'sb.bReq', label: 'Required torsional brace stiffness', sym: '\\beta_{T,req}', eq: '\\frac{C_{s}LM_{u}^{2}}{nEI_{yeff}C_{b}^{2}}', sub: `\\frac{${n2(SB.Cs)}(${n0(SB.L)})(${n0(SB.Mu)})^{2}}{${n0(SB.n)}(29{,}000)(${n2(SB.Iyeff)})(${n2(SB.Cb)})^{2}}`, value: SB.bReq, unit: 'kip-in/rad', d: 0, ref: `${ED} Eq. 6.7.4.2.2-15`, ok: SB.bT >= SB.bReq }); }
    Object.values(R.mem).forEach(m => { const id = m.k, Fy = R.Fy;
      w.add({ id: `${id}.A`, label: `${m.l} ${m.name}: area and radii of gyration (leg rectangles)`, sym: 'A_{g},\\ r_{x},\\ r_{z}', eq: '', sub: `${n3(m.A)},\\ ${n3(m.rx)},\\ ${n3(m.rz)}`, value: m.A, unit: 'in^{2}', d: 3 });
      w.add({ id: `${id}.forces`, label: `${m.l}: largest tension and compression of the separate combinations (Strength I: the entered forces; Strength III, V: ± wind force alone; Constructibility: the entered forces ± brace force)`, sym: 'T_{u},\\ C_{u}', eq: '', sub: `${n2(m.Tu)}\\ (\\text{${m.cT || 'none'}}),\\ ${n2(m.Cu)}\\ (\\text{${m.cC || 'none'}})`, value: m.Fmax, unit: 'kip', d: 2,
        ...(uAny('StrI') || uAny('Con') ? { note: `Entered forces: Strength ${UM.StrI === 'replace' ? 'replace the computed (Strength III, V not used)' : 'add to the computed (Strength III, V wind kept)'}; Constructibility ${UM.Con === 'replace' ? 'replace the computed (no brace force)' : 'add to the computed brace force'}.` } : {}) });
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
      if (m.dP > 0) w.add({ id: `${id}.fat`, label: `${m.l}: factored stress range (CF9)`, sym: '\\gamma(\\Delta f)', eq: '\\gamma_{Fat\\,I}(0.65)\\frac{\\Delta P}{A_{g}}', sub: `${n2(R.gFI)}(0.65)\\frac{${n2(m.dP)}}{${n3(m.A)}}`, value: m.df, unit: 'ksi', d: 2, ref: `${ED} Table 3.4.1-1, Art. 6.6.1.2`, ok: ge(R.FT, m.df) }); });
    w.add({ id: 'geo', label: 'Connection geometry (CF6)', sym: 's,\\ e_{end},\\ t_{g}', eq: '', sub: `${n3(R.s)},\\ ${n3(R.e0)},\\ ${n3(R.tg)}`, value: R.s, unit: 'in', d: 3, ref: `${ED} Art. 6.13.2.6, Table 6.13.2.6.6-1` });
    return dOn ? w.steps.filter(s => !TRUSS.test(s.id)) : w.steps;   // SBDIA
  }
  /* diaSteps(R, end): the diaphragm values (CFD / CFE), appended to R.steps */
  function diaSteps(R, end) {
    const D = R.DIA[end ? 'e' : 'i'], id = end ? 'cfe' : 'cfd', w = St().work('cf'), lab = end ? 'End diaphragm' : 'Diaphragm';
    { const DQ = diaDepthReq(R.p, R.E || env0()); if (DQ) { const g = DQ.gov, gl = q => `G${q.line + 1} ${q.label}`;   // SBXF2 (SB-19): the depth required, every bay against the deeper of its two girders
      const each = DQ.bays.map(b => `G${b.j + 1}–G${b.j + 2}: ${b.a && b.b ? `max(${n2(b.a.dg)}, ${n2(b.b.dg)})` : n2(b.q.dg)} = ${n2(b.d)} in (${gl(b.q)}), ${b.f} × ${n2(b.d)} = ${n2(b.req)} in`).join('; ');
      w.add({ id: `${id}.dep`, label: `${lab}: least depth, every bay against the deeper of the two girders it connects; governing bay G${g.j + 1}–G${g.j + 2}, ${gl(g.q)}`, sym: 'd_{req}', eq: `${g.f}\\max(d_{a},\\ d_{b})`, sub: g.a && g.b ? `${g.f}\\max(${n2(g.a.dg)},\\ ${n2(g.b.dg)})` : `${g.f}(${n2(g.d)})`, value: g.req, unit: 'in', d: 2, ref: `${ED} Art. 6.7.4.2.1`, ok: D.d >= g.req - 1e-6,
        note: `Assumption (engineer decision SB-19, 2026-11-13, girder types): a ${end ? 'bearing-line' : 'intermediate'} diaphragm between two girders of unequal depth is checked against the deeper of the two (d out-to-out of the flanges at the first support, the girder type assigned to each line), in every bay; the governing bay is the largest requirement. Every bay: ${each}. Provided d = ${n2(D.d)} in (${D.nm_}).` }); } }
    w.add({ id: `${id}.Sx`, label: `${lab} ${D.nm_}: section modulus (nominal dimensions)`, sym: 'S_{x}', eq: '\\frac{2I_{x}}{d}', sub: `\\frac{2(${n0(D.Ix)})}{${n2(D.d)}}`, value: D.Sx, unit: 'in^{3}', d: 1 });
    if (!D.CH) w.add({ id: `${id}.Mn`, label: `${lab}: flexural resistance (6.10.8, L_b = S, C_b = 1.0; F_nc = ${n2(D.Fnc)} ksi)`, sym: '\\phi_{f}M_{n}', eq: 'F_{nc}S_{x}', sub: `${n2(D.Fnc)}(${n2(D.Sx)})`, value: D.Mn, unit: 'kip-in', d: 0, ref: `${ED} Arts. 6.10.8.2.2, 6.10.8.2.3` });
    else { const H = D.CH, E_ = '29{,}000', Fy = D.Fy;   // SBDX: a channel per 6.12.2.2.5
      w.add({ id: `${id}.ch.Zx`, label: `${lab} ${D.nm_}: plastic section modulus (nominal rectangles: flanges b_f × t_f at h_o/2, web h_w × t_w)`, sym: 'Z_{x}', eq: 'b_{f}t_{f}(d - t_{f}) + \\frac{t_{w}h_{w}^{2}}{4}', sub: `${n3(D.bf)}(${n3(D.tf)})(${n2(D.d)} - ${n3(D.tf)}) + \\frac{${n3(D.tw)}(${n3(D.hw)})^{2}}{4}`, value: H.Zx, unit: 'in^{3}', d: 2, note: 'Nominal dimensions, fillets neglected; b_f, t_f (average), t_w, d from the shape table.' });
      w.add({ id: `${id}.ch.Mp`, label: `${lab}: plastic moment (yielding)`, sym: 'M_{p}', eq: 'F_{y}Z_{x}', sub: `${n0(Fy)}(${n2(H.Zx)})`, value: H.Mp, unit: 'kip-in', d: 0, ref: `${ED} Eq. 6.12.2.2.5-1` });
      w.add({ id: `${id}.ch.JCw`, label: `${lab}: torsional constants (thin-walled, centerline: b = b_f − t_w/2 = ${n3(H.b)} in, h_o = d − t_f = ${n3(H.ho)} in)`, sym: 'J,\\ C_{w}', eq: 'J = \\frac{2bt_{f}^{3} + h_{o}t_{w}^{3}}{3},\\ C_{w} = \\frac{t_{f}b^{3}h_{o}^{2}}{12}\\,\\frac{3bt_{f} + 2h_{o}t_{w}}{6bt_{f} + h_{o}t_{w}}', sub: `J = ${n4(H.J)},\\ C_{w} = ${n2(H.Cw)}`, value: H.J, unit: 'in^{4}', d: 4, ref: `${ED} Eq. 6.12.2.2.5-6`, note: `C_w = ${n2(H.Cw)} in⁶. J from the thin-walled formula (the shape tables' J includes fillets and sloping flanges; C6.12.2.2.5 allows the tabulated values).` });
      w.add({ id: `${id}.ch.rts`, label: `${lab}: c and r_ts`, sym: 'c,\\ r_{ts}', eq: 'c = \\frac{h_{o}}{2}\\sqrt{\\frac{I_{y}}{C_{w}}},\\ r_{ts}^{2} = \\frac{\\sqrt{I_{y}C_{w}}}{S_{x}}', sub: `c = \\frac{${n3(H.ho)}}{2}\\sqrt{\\frac{${n3(D.Iy)}}{${n2(H.Cw)}}},\\ r_{ts}^{2} = \\frac{\\sqrt{${n3(D.Iy)}(${n2(H.Cw)})}}{${n3(D.Sx)}}`, value: H.rts, unit: 'in', d: 3, ref: `${ED} Eqs. 6.12.2.2.5-5, -9`, note: `c = ${n3(H.c)}; r_ts = ${n3(H.rts)} in.` });
      w.add({ id: `${id}.ch.Lp`, label: `${lab}: limiting unbraced length for M_p (r_y = ${n3(D.ry)} in)`, sym: 'L_{p}', eq: '1.76r_{y}\\sqrt{\\frac{E}{F_{y}}}', sub: `1.76(${n3(D.ry)})\\sqrt{\\frac{${E_}}{${n0(Fy)}}}`, value: H.Lp, unit: 'in', d: 2, ref: `${ED} Eq. 6.12.2.2.5-7` });
      w.add({ id: `${id}.ch.Lr`, label: `${lab}: limiting unbraced length for the onset of yielding (Jc/(S_xh_o) = ${n4(H.jr)})`, sym: 'L_{r}', eq: '1.95r_{ts}\\frac{E}{0.7F_{y}}\\sqrt{\\frac{Jc}{S_{x}h_{o}} + \\sqrt{\\left(\\frac{Jc}{S_{x}h_{o}}\\right)^{2} + 6.76\\left(\\frac{0.7F_{y}}{E}\\right)^{2}}}', sub: `1.95(${n3(H.rts)})\\frac{${E_}}{0.7(${n0(Fy)})}\\sqrt{${n4(H.jr)} + \\sqrt{${n4(H.jr)}^{2} + 6.76\\left(\\frac{0.7(${n0(Fy)})}{${E_}}\\right)^{2}}}`, value: H.Lr, unit: 'in', d: 2, ref: `${ED} Eq. 6.12.2.2.5-8` });
      const ze = H.zone === 'p' ? { eq: 'M_{p}', sub: `${n0(H.Mp)}` } : H.zone === 'i' ? { eq: 'C_{b}\\left[M_{p} - (M_{p} - 0.7F_{y}S_{x})\\frac{L_{b} - L_{p}}{L_{r} - L_{p}}\\right] \\le M_{p}', sub: `1.0\\left[${n0(H.Mp)} - (${n0(H.Mp)} - 0.7(${n0(Fy)})(${n3(D.Sx)}))\\frac{${n2(H.Lb)} - ${n2(H.Lp)}}{${n2(H.Lr)} - ${n2(H.Lp)}}\\right]` }
        : { eq: 'F_{cr}S_{x} \\le M_{p},\\ F_{cr} = \\frac{C_{b}\\pi^{2}E}{(L_{b}/r_{ts})^{2}}\\sqrt{1 + 0.078\\frac{Jc}{S_{x}h_{o}}\\left(\\frac{L_{b}}{r_{ts}}\\right)^{2}}', sub: `${n2(H.Fcr)}(${n3(D.Sx)})` };
      w.add({ id: `${id}.Mn`, label: `${lab}: flexural resistance, channel (6.12.2.2.5; L_b = S = ${n2(H.Lb)} in, C_b = 1.0: ${{ p: 'L_b ≤ L_p, yielding', i: 'L_p < L_b ≤ L_r, inelastic LTB', e: 'L_b > L_r, elastic LTB' }[H.zone]}; φ_f = 1.0)`, sym: '\\phi_{f}M_{n}', eq: ze.eq, sub: ze.sub, value: D.Mn, unit: 'kip-in', d: 0, ref: `${ED} Eqs. 6.12.2.2.5-1 to -4`,
        note: `Before (6.10.8 I-section approximation): F_nc S_x = ${n2(D.Fnc)}(${n3(D.Sx)}) = ${n0(D.MnI)} kip-in. L_b = S and C_b = 1.0 as before (braced only at the girders, conservative). Rolled channels have compact flanges and webs (C6.12.2.2.5): FLB and web local buckling not checked.` }); }
    w.add({ id: `${id}.Vn`, label: `${lab}: shear resistance (unstiffened web, k = 5, D/t_w = ${n2(D.lam)})`, sym: '\\phi_{v}V_{n}', eq: 'C(0.58F_{y}Dt_{w})', sub: `${n4(D.C)}(0.58)F_{y}(h_{w})(t_{w})`, value: D.Vn, unit: 'kip', d: 2, ref: `${ED} Eq. 6.10.9.2-1` });
    w.add({ id: `${id}.Mw`, label: `${lab}: wind moment, Strength ${D.wk}`, sym: 'M_{w}', eq: 'F_{w}d', sub: `${n2(D.Fw)}(${n2(D.Mw / D.Fw)})`, value: D.Mw, unit: 'kip-in', d: 0, ref: `${ED} Art. 4.6.2.7.1`, ok: D.Mw <= D.Mn });
    { const X = D.AX, E_ = '29{,}000', Fy = D.Fy, pi = '\\pi^{2}', ch = D.chS;   // SBDX: the diaphragm as an axial member under P = F_w
      w.add({ id: `${id}.ax.L`, label: `${lab}: length and effective length for axial load (bolt line to bolt line; K = 1.0)`, sym: 'K\\ell', eq: 'K(S - 2e)', sub: `1.0(${n2(R.S)} - 2(${n2(X.ecc)}))`, value: X.KL, unit: 'in', d: 2, ref: `${ED} Art. 4.6.2.5`,
        note: 'Assumption: K = 1.0 about both axes and K_zℓ_z = ℓ (twist restrained only at the connections). The diaphragm is bolted through its web in one row at each end, which gives little end restraint; the 0.75 of Art. 4.6.2.5 is for compression members of triangulated trusses and frames and is not used.' });
      w.add({ id: `${id}.ax.Pe`, label: `${lab}: elastic flexural buckling resistances (r_x = ${n3(X.rx)} in, r_y = ${n3(X.ry)} in)`, sym: 'P_{ex},\\ P_{ey}', eq: '\\frac{\\pi^{2}EA_{g}}{(K\\ell/r)^{2}}', sub: `\\frac{${pi}(${E_})(${n3(D.A)})}{(${n2(X.KL)}/${n3(X.rx)})^{2}},\\ \\frac{${pi}(${E_})(${n3(D.A)})}{(${n2(X.KL)}/${n3(X.ry)})^{2}}`, value: X.Pey, unit: 'kip', d: 1, ref: `${ED} Eq. 6.9.4.1.2-1`, note: `P_ex = ${n0(X.Pex)} kip, P_ey = ${n2(X.Pey)} kip.` });
      if (ch) { const F = X.ft;
        w.add({ id: `${id}.ax.ft`, label: `${lab}: flexural–torsional buckling, channel symmetric about its x-axis (J = ${n4(X.J)} in⁴, C_w = ${n2(X.Cw)} in⁶, G = 0.385E; shear center e = 3b²t_f/(6bt_f + h_ot_w) = ${n3(F.e)} in from the web centerline, centroid ${n3(F.xc)} in: x_o = ${n3(F.xo)} in)`, sym: 'P_{e,FT}',
          eq: '\\frac{P_{ex} + P_{ez}}{2H}\\left[1 - \\sqrt{1 - \\frac{4P_{ex}P_{ez}H}{(P_{ex} + P_{ez})^{2}}}\\right],\\ P_{ez} = \\frac{\\pi^{2}EC_{w}/(K_{z}\\ell_{z})^{2} + GJ}{A_{g}r_{o}^{2}},\\ r_{o}^{2} = x_{o}^{2} + \\frac{I_{x} + I_{y}}{A_{g}},\\ H = 1 - \\frac{x_{o}^{2}}{r_{o}^{2}}',
          sub: `P_{ez} = ${n2(F.Pez)},\\ r_{o}^{2} = ${n3(F.ro2)},\\ H = ${n4(F.H)}`, value: F.Pft, unit: 'kip', d: 1, ref: `${ED} Eqs. 6.9.4.1.3-2 to -6`, note: 'The channel is singly symmetric: flexural buckling about the y-axis and flexural–torsional buckling (x-axis flexure with twist) apply (6.9.4.1.1). Thin-walled centerline J and C_w (nominal dimensions).' }); }
      w.add({ id: `${id}.ax.Pcr`, label: `${lab}: nominal resistance on the gross area (governing mode: ${X.mode}${ch ? '' : '; a W is doubly symmetric and K_zℓ_z = K_yℓ_y, so torsional buckling is not a mode, 6.9.4.1.1'}; P_o = F_yA_g = ${n2(X.Po)} kip)`, sym: 'P_{cr}', eq: X.Pe >= 0.44 * X.Po ? '0.658^{P_{o}/P_{e}}P_{o}' : '0.877P_{e}', sub: X.Pe >= 0.44 * X.Po ? `0.658^{${n2(X.Po)}/${n2(X.Pe)}}(${n2(X.Po)})` : `0.877(${n2(X.Pe)})`, value: X.Pcr, unit: 'kip', d: 2, ref: `${ED} Eqs. 6.9.4.1.1-1, -2`, note: `F_cr = P_cr/A_g = ${n3(X.Fcr)} ksi.` });
      const el = (nm, E2, lam, lr, c1, c2, wd, t) => `${nm}: λ = ${n2(lam)} ${E2.slender ? `> λ_r = ${n2(lr)}` : `≤ λ_r = ${n2(lr)}`}${E2.Fel != null ? `; F_el = (${c2}λ_r/λ)²F_y = ${n2(E2.Fel)} ksi, b_e = b(1 − ${c1}√(F_el/F_cr))√(F_el/F_cr) = ${n3(E2.be)} in of ${n3(wd)} in` : E2.slender ? `; λ ≤ λ_r√(F_y/F_cr) = ${n2(lr * Math.sqrt(Fy / X.Fcr))}: fully effective` : ''}`;
      w.add({ id: `${id}.ax.Aeff`, label: `${lab}: effective area for local buckling of slender elements (rolled-section form A_g − Σ(b − b_e)t)`, sym: 'A_{eff}', eq: 'A_{g} - \\sum(b - b_{e})t', sub: `${n3(D.A)} - (${n3(D.hw)} - ${n3(X.W.be)})(${n3(D.tw)}) - ${X.nf}(${n3(X.wf)} - ${n3(X.F.be)})(${n3(D.tf)})`, value: X.Aeff, unit: 'in^{2}', d: 3, ref: `${ED} Eqs. 6.9.4.2.2a-3, 6.9.4.2.2b-1, -2; Tables 6.9.4.2.1-1, 6.9.4.2.2b-1`,
        note: `${el('Web (h_w/t_w, c_1 = 0.18, c_2 = 1.31)', X.W, X.lw, X.lrw, 0.18, 1.31, D.hw)}; ${el(ch ? 'flanges (b_f/t_f, c_1 = 0.22, c_2 = 1.49)' : 'flanges (b_f/(2t_f), c_1 = 0.22, c_2 = 1.49)', X.F, X.lf, X.lrf, 0.22, 1.49, X.wf)}. Element widths from nominal dimensions (web h_w = d − 2t_f, fillets neglected).` });
      w.add({ id: `${id}.ax.Pr`, label: `${lab}: factored compressive resistance against P = F_w = ${n2(D.Fw)} kip (Strength ${D.wk})`, sym: '\\phi_{c}P_{n}', eq: '0.95F_{cr}A_{eff}', sub: `0.95(${n3(X.Fcr)})(${n3(X.Aeff)})`, value: X.Pr, unit: 'kip', d: 2, ref: `${ED} Eqs. 6.9.2.1-1, 6.9.4.2.2a-1`, ok: D.Fw <= X.Pr });
      w.add({ id: `${id}.ax.Pt`, label: `${lab}: factored tensile resistance, the lesser of yielding and net-section fracture (${X.nb} holes d_h = ${n4(X.dh)} in through the web; U = A_web/A_g = ${n3(X.U)})`, sym: 'P_{r}', eq: '\\min(0.95F_{y}A_{g},\\ 0.80F_{u}A_{n}U)', sub: `\\min(0.95(${n0(Fy)})(${n3(D.A)}),\\ 0.80(${n0(X.Fu)})(${n3(X.An)})(${n3(X.U)}))`, value: X.Pt, unit: 'kip', d: 2, ref: `${ED} Eqs. 6.8.2.1-1, -2; Art. 6.8.2.2`, ok: D.Fw <= X.Pt,
        note: 'A_n = A_g − n d_h t_w (one row of n bolts across the web). U: one transverse row has no connection length for Table 6.8.2.2-1 Case 2, so U is the lower bound of Art. 6.8.2.2, the gross area of the connected element (the web, h_w t_w) over A_g. Holes drilled or subpunched and reamed: R_p = 1.0 (assumption).' });
      w.add({ id: `${id}.ax.sl`, label: `${lab}: slenderness (${R.primary ? 'primary' : 'secondary'} member)`, sym: '\\frac{K\\ell}{r_{min}}', eq: '', sub: `\\frac{${n2(X.KL)}}{${n3(X.rmin)}}`, value: X.sl, unit: '', d: 1, ref: `${ED} Art. 6.9.3`, ok: X.sl <= X.lim, note: `Limit ${X.lim} (${R.primary ? 'primary' : 'secondary'} member, the project's Primary members choice).` });
      w.add({ id: `${id}.ax.ia`, label: `${lab}: axial force and wind moment (P_u = F_w, M_u = M_w; P_u/P_r = ${n3(X.pr)} ${X.pr < 0.2 ? '< 0.2' : '≥ 0.2'})`, sym: '', eq: X.pr < 0.2 ? '\\frac{P_{u}}{2P_{r}} + \\frac{M_{u}}{M_{r}} \\le 1.0' : '\\frac{P_{u}}{P_{r}} + \\frac{8}{9}\\frac{M_{u}}{M_{r}} \\le 1.0', sub: X.pr < 0.2 ? `\\frac{${n2(D.Fw)}}{2(${n2(X.Pr)})} + \\frac{${n0(D.Mw)}}{${n0(D.Mn)}}` : `\\frac{${n2(D.Fw)}}{${n2(X.Pr)}} + \\frac{8}{9}\\frac{${n0(D.Mw)}}{${n0(D.Mn)}}`, value: X.ia, unit: '', d: 3, ref: `${ED} Eqs. 6.9.2.2-1, -2`, ok: X.ia <= 1 + 1e-12,
        note: `Compression with the wind moment (the compressive resistance governs over tension). M_u is not amplified for second-order effects: P_u/P_e = ${n4(D.Fw / X.Pe)}, so the amplification 1/(1 − P_u/(0.95P_e)) = ${n4(1 / (1 - D.Fw / (0.95 * X.Pe)))} is taken as 1.0 (assumption).` }); }
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
  /* xfPts(b, X): (SBXF, 2026-11-13: X.hb[bay], when given, the frame depth of each bay) the point loads of every girder (GirderDetail gdXfPts): b = { spans [ft], xf: { g: bearings per girder, f: frames (framing.js
     plXfDef) } }; per girder [{ x (ft, analysis station), P (kip), end, W (whole frame), Lf (ft) }]; a frame station is mapped into its span
     proportionally between that girder's bearings; a frame on a bearing line loads that bearing only. null without the model or the frames. */
  function xfPts(b, X) {
    if (!X || !X.on || !b || !b.xf || !Array.isArray(b.xf.f) || !Array.isArray(b.xf.g)) return null;
    const sp = b.spans, X0 = [0]; sp.forEach(L => X0.push(X0[X0.length - 1] + L)); const G = b.xf.g.map(() => []);
    b.xf.f.forEach(([sup, k, bay, sa, sc, Lf]) => { const end = !!sup, W = xfW(X.ab && X.ab[bay] ? { ...X, ...X.ab[bay] } : X.hb && X.hb[bay] > 0 ? { ...X, h: X.hb[bay] } : X, Lf, end);   // SBXF: X.hb, each bay's h; SB-24: X.ab, each bay's diaphragm area
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
    return { type: d.type, h: '', dMinXF: d.dMinXF, gA: d.gA, gG: d.gG, primary: 'auto', dia: d.dia, wind: d.wind, mem: d.mem, conn: d.conn, user: d.user, userMode: { StrI: 'add', Con: 'add' }, fatCat: d.fatCat,
      sb: { on: 'yes', full: 'auto', Mu: '', Cb: 1, bs: 5, tsp: 0.5 }, weight: { mode: 'auto', allow: 10, Wi: '', We: '' } }; }
  /* ---------- SBXF (2026-11-13; engineer decision 2026-11-13, girder types): the depth of each cross-frame bay ----------
     Each cross-frame (or diaphragm) bay takes the depth of the shallower of the two girders it connects, by the girder type assigned to each
     line. girderDepth(g): { D (the largest web depth of its plates, the basis of h as before), dg (D_0 + t_top + t_bot at x = 1 ft, the first
     support's segment, as before), D0, tT, tB }. bayDepths(P): null for a project saved before girder types (no girders[i].lines), with
     fewer than two girder lines, or without SBDModel: every caller then works exactly as before (the reported girder's plates). Else
     { bays: [{ j (lines j and j + 1), a, b ({ line, gi, label, D, dg, ... } of the type on each line; null: no type on it), s (the
     shallower: the smaller D, equal D the smaller d, equal both a) } | null (no type on either line)], gov (the governing bay: the
     shallowest s, the first such bay) }. Two types on one line (a conflict the Girders & plates tab flags): the shallower of them. */
  function girderDepth(g) {
    const S = (g && g.segments) || []; if (!S.length) return null;
    const s0 = S.find(s => 1 >= s.x0 - 1e-9 && 1 < s.x1) || S[S.length - 1];
    return { D: Math.max(...S.map(s => s.D)), dg: s0.D + s0.topT + s0.botT, D0: s0.D, tT: s0.topT, tB: s0.botT };
  }
  const shallower = (a, b) => !a ? b : !b ? a : (b.D < a.D - 1e-9 || (Math.abs(b.D - a.D) <= 1e-9 && b.dg < a.dg - 1e-9)) ? b : a;
  function bayDepths(P) {
    const M = window.SBDModel, G = (P && P.girders) || [], nb = Math.round(+((P && P.xs) || {}).nb || 0);
    if (!M || !M.lineTypes || nb < 2 || !G.some(g => Array.isArray(g.lines))) return null;
    const LT = M.lineTypes(P), at = j => (LT[j] || []).map(gi => { const d = girderDepth(G[gi]); return d ? { line: j, gi, label: G[gi].label || G[gi].id, ...d } : null; }).reduce(shallower, null);
    const bays = []; let gov = null;
    for (let j = 0; j < nb - 1; j++) { const a = at(j), b = at(j + 1), s = shallower(a, b); if (!s) { bays.push(null); continue; }
      const q = { j, a, b, s }; bays.push(q); if (!gov || shallower(gov.s, s) !== gov.s) gov = q; }
    return gov ? { bays, gov } : null;
  }
  /* bayGroups(P) (SB-23, 2026-11-13; moved from engine/sheets.js cfGroups, SBXF2 SB-21, unchanged): the distinct bay depths of the cross-frame
     details: the typed bays grouped by their h and the d of their shallower girder (rounded to 0.01 in), in bay order, each { h, s (the
     shallower girder of its first bay), dg, bays: [j] }; null for one group or none (a project saved before girder types, equal depths). Used
     by the Drawings cross-frame sheet and the Cross-frames tab graphic's Download DXF. */
  function bayGroups(P) {
    const X = bayDepths(P); if (!X) return null;
    const B = inputsOf(P, { bridge: true }).p.xfBay; if (!B) return null; return grpOf(B);
  }
  /* grpOf(B) (SB-24: bayGroups' grouping, moved out unchanged): the groups of the bays of B = p.xfBay (inputsOf) by h and the d of the
     shallower girder (rounded to 0.01 in), in bay order; null for one group */
  function grpOf(B) {
    const m = new Map(), r2 = v => +(+v).toFixed(2); if (!B || !Array.isArray(B.bays)) return null;
    B.bays.forEach(q => { if (!q) return; const k = `${q.h}|${r2(q.s.dg)}`; if (!m.has(k)) m.set(k, { h: q.h, s: q.s, dg: r2(q.s.dg), bays: [] }); m.get(k).bays.push(q.j); });
    return m.size > 1 ? [...m.values()] : null;
  }
  /* SB-24 (2026-11-13; engineer decision SB-24): the diaphragm shape per bay depth group. Saved field crossframes.dia.grp (optional):
     { '<the group's bays, 0-based, comma-separated, e.g. "0,4">': shape (a CF_CH or CF_DIA name, or 'custom': the custom W of dia.d, bf,
     tf, tw) }. Absent (every project saved before), no entry for a group, or an entry that is not a shape of the lists: dia.shape, the one
     shape of before (the migration, CLAUDE.md §5: nothing is rewritten or discarded; an entry of a grouping that no longer exists stays in the
     file, unused). grpKey(g): the key of group g; grpShape(q, g): the shape of group g of the diaphragm inputs q; diaGroups(p): with a
     diaphragm and girder types whose bays form two or more depth groups (grpOf(p.xfBay)), [{ h, s, dg, bays, k (0-based), key, shape }];
     null otherwise (one depth group, equal depths, a project saved before girder types, a cross-frame): every check exactly as before. */
  const grpKey = g => g.bays.join(',');
  const isShape = v => v === 'custom' || CF_CH.some(s => s[0] === v) || CF_DIA.some(s => s[0] === v);
  function grpShape(q, g) { const m = q && q.grp, v = m && typeof m === 'object' && !Array.isArray(m) ? m[grpKey(g)] : null; return typeof v === 'string' && isShape(v) ? v : (q || {}).shape; }
  function diaGroups(p) {
    if (!cfDiaOn(p) || !p.xfBay) return null; const G = grpOf(p.xfBay); if (!G) return null;
    return G.map((g, k) => ({ ...g, k, key: grpKey(g), shape: grpShape(p.dia, g) }));
  }
  /* typeGov(P, BD, gi) (SBXF2, 2026-11-13; engineer decision SB-18): the frame the brace checks of girder type gi use: of the bays attached to
     any of its lines (bays j − 1 and j of each line j), the shallowest (the rule of bayDepths, the first on ties). The lines: the type's
     (SBDModel.typeLines), or adLines (Auto design's run, engine/autodesign.js typeProject: each line's copy of the type carries the type's
     lines). null when the type has no line or no typed bay is attached (the caller then takes the bridge's shallowest bay, as SBXF). */
  function typeGov(P, BD, gi) {
    const M = window.SBDModel, g = ((P && P.girders) || [])[gi]; if (!g) return null;
    const TL = Array.isArray(g.adLines) ? g.adLines.slice() : M && M.typeLines ? M.typeLines(P, gi) : []; if (!TL.length) return null;
    let gov = null; BD.bays.forEach(q => { if (!q || !(TL.includes(q.j) || TL.includes(q.j + 1))) return; if (!gov || shallower(gov.s, q.s) !== gov.s) gov = q; });
    return gov ? { gov, lines: TL } : null;
  }
  /* extDepth(P, nb) (SBXF2, SB-20): the girder depth the wind acts on: the girder types on the exterior lines G1 and G_Nb (every type on a
     line, two on one line included), the deeper (the larger d, equal d the larger D, the first on ties); null when neither line has a type */
  function extDepth(P, nb) {
    const M = window.SBDModel, G = (P && P.girders) || []; if (!M || !M.lineTypes || nb < 2) return null; const LT = M.lineTypes(P);
    const at = j => (LT[j] || []).map(gi => { const d = girderDepth(G[gi]); return d ? { line: j, gi, label: G[gi].label || G[gi].id, ...d } : null; }).filter(Boolean);
    const deeper = (a, b) => !a ? b : !b ? a : (b.dg > a.dg + 1e-9 || (Math.abs(b.dg - a.dg) <= 1e-9 && b.D > a.D + 1e-9)) ? b : a;
    const A = at(0).reduce(deeper, null), B = at(nb - 1).reduce(deeper, null), q = deeper(A, B); return q ? { a: A, b: B, q } : null;
  }
  /* depthFrac(d, E): the least diaphragm depth as a fraction of the girder depth d (cfTypeRec's rule: an owner's dia.depth rule below its
     depth, else 0.75; OWN36) */
  const depthFrac = (d, E) => { const r = E.rule('dia.depth'); return r && d < r.value.D - 1e-9 ? r.value.frac : 0.75; };
  /* diaDepthReq(p, E) (SBXF2, 2026-11-13; engineer decision SB-19): with girder types (p.xfBay), every bay's least diaphragm depth from the
     deeper of the two girders it connects (d rounded to 0.01 in as p.dg), { bays: [{ j, a, b, q (the deeper), d, f, req }], gov (the largest
     req, the first on ties) }; null for a project saved before girder types (the check then uses p.dg, as before) */
  function diaDepthReq(p, E) {
    const B = p && p.xfBay; if (!B || !Array.isArray(B.bays)) return null; const r2 = v => +(+v).toFixed(2);
    const bays = B.bays.filter(Boolean).map(b => { const q = !b.a ? b.b : !b.b ? b.a : (b.b.dg > b.a.dg + 1e-9 ? b.b : b.a), d = r2(q.dg), f = depthFrac(d, E); return { j: b.j, a: b.a, b: b.b, q, d, f, req: f * d }; });
    if (!bays.length) return null; const gov = bays.reduce((g, b) => (b.req > g.req + 1e-9 ? b : g)); return { bays, gov };
  }
  /* inputsOf(P, opt): GirderDetail's Cross-frames input p for project P (the values Preliminary sizing sends: S = the largest girder spacing,
     h, d at the first support, L_b = the largest unbraced length on any girder, primary by skew; sb: the span with the largest factored
     deck-placement moment of the interior girder, its length, the fewest intermediate frames on any girder in it, the plates there).
     opt = { L (SBDFraming.compute(P)), A (SBDAnalysis.analyzeGirder result of the girder whose plates and moments are used), gi (plate
     girder index, default 0), bays (false: the reported girder's own depth, as before girder types; engine/sheets.js, the Drawings DXF) }.
     Returns { p, src } (src: where each derived value comes from).
     SBXF (2026-11-13): with girder types (bayDepths), h (when not entered) and d are those of the governing bay, p.xfBay its girders and
     every bay's, p.dW the reported girder's own d for the wind on the girder (as before); sb (the girder braced) is the reported girder's. */
  function inputsOf(P, opt) {
    opt = opt || {}; const c = Object.assign(defaults(), P.crossframes || {}), FRM = window.SBDFraming, L = opt.L || (FRM ? FRM.compute(P) : null), src = {};
    const G = (P.girders || [])[opt.gi || 0] || P.girders[0], seg = x => G.segments.find(s => x >= s.x0 - 1e-9 && x < s.x1) || G.segments[G.segments.length - 1];
    const sup = [0]; P.spans.lengths.forEach(v => sup.push(sup[sup.length - 1] + +v));
    const s0 = seg(sup[0] + 1), D = Math.max(...G.segments.map(s => s.D)), r1 = v => +(+v).toFixed(1), r2 = v => +(+v).toFixed(2);
    const bays = ((P.xs || {}).bays || [9.5]).map(Number), skews = ((P.xs || {}).skews || []).map(Number), nb = Math.round((P.xs || {}).nb || 2);
    const p = JSON.parse(JSON.stringify(c));
    const BD = opt.bays === false ? null : bayDepths(P), TG = BD && !opt.bridge ? typeGov(P, BD, (P.girders || [])[opt.gi || 0] ? opt.gi || 0 : 0) : null, GV = TG ? TG.gov : BD ? BD.gov : null;   // SBXF2 (SB-18): the type's own shallowest bay (opt.bridge: the bridge's, pointLoads)
    const gb = GV ? GV.s : null, Dh = gb ? gb.D : D, hAuto = c.h === '' || c.h == null, hOf = d => Math.round(Math.max(d - 8, d * 0.75));   // SBXF
    p.S = r2(Math.max(...bays) * 12); p.dg = r2(gb ? gb.dg : s0.D + s0.topT + s0.botT); src.S = 'the largest girder spacing'; src.dg = 'D + t_top + t_bot at the first support';
    p.h = hAuto ? hOf(Dh) : +c.h; src.h = hAuto ? 'round(max(D − 8, 0.75D))' : 'entered';
    if (gb) { const g0 = GV, dOwn = r2(s0.D + s0.topT + s0.botT), bn = `G${g0.j + 1}–G${g0.j + 2}`, XW = extDepth(P, nb), dW = XW ? r2(XW.q.dg) : dOwn;   // SBXF2 (SB-20): the wind on the exterior girder depth
      p.dW = dW; src.dW = XW ? `the exterior girder: the deeper of the types on G1 and G${nb}, D + t_top + t_bot at the first support` : 'the reported girder (no girder type on G1 or G_Nb): D + t_top + t_bot at the first support';
      src.dg = `the shallower girder of the governing bay ${bn} (G${gb.line + 1}, ${gb.label}): D + t_top + t_bot at the first support`; if (hAuto) src.h = `round(max(D − 8, 0.75D)), D of the governing bay ${bn}`;
      p.xfBay = { j: g0.j, a: g0.a, b: g0.b, s: gb, D: gb.D, hAuto, rep: G.label || G.id, eq: !!(g0.a && g0.b && g0.a.D === g0.b.D && g0.a.dg === g0.b.dg), vary: gb.D !== D || r2(gb.dg) !== dOwn,
        scope: TG ? 'type' : 'bridge', tl: TG ? TG.lines : null, bj: BD.gov.j, bs: BD.gov.s, ext: XW ? { a: XW.a, b: XW.b, q: XW.q, own: dOwn } : null,
        bays: BD.bays.map(q => q && { j: q.j, a: q.a, b: q.b, s: q.s, h: hAuto ? hOf(q.s.D) : +c.h }) }; }
    { const v = +(((P.fatigue || {}).gam || {}).fI); p.gFI = v > 0 ? v : 1.75; src.gFI = v > 0 ? 'the Fatigue & studs inputs (γ Fatigue I)' : 'no fatigue inputs: 1.75'; }   // FGAM (2026-11-01)
    p.primary = c.primary === 'auto' ? (skews.some(s => Math.abs(s) > 20) ? 'yes' : 'no') : c.primary;
    p.Lb = L && !L.errors.length ? r2(FRM.lbMax(L.FR, L.FR.girders.map(g => g.i), L.m.sup)) : 25; src.Lb = L && !L.errors.length ? 'the largest unbraced length on any girder (framing)' : 'no framing: 25 ft';
    const A = opt.A && !(opt.A.errors && opt.A.errors.length) ? opt.A : null;
    let xM = sup[0] + (sup[1] - sup[0]) / 2, Mu = +c.sb.Mu;
    if (A && A.st && A.st.DC1) { const C0 = window.SBDConstr && window.SBDConstr.projFactors ? window.SBDConstr.projFactors(P) : { cdc: 1.25, ccl: 1.50 }, xs = A.x, Mc = xs.map((_, i) => C0.cdc * A.st.DC1.M[i] + C0.ccl * (A.st.CL ? A.st.CL.M[i] : 0)); let iMx = 0; Mc.forEach((v, i) => { if (v > Mc[iMx]) iMx = i; }); xM = xs[iMx];   // FONE: the deck placement γ of the Constructibility module (was 1.25, 1.5)
      if (c.sb.Mu === '' || c.sb.Mu == null) { Mu = r1(Mc[iMx]); src.Mu = `analysis: ${+C0.cdc.toFixed(4)}M_DC1 + ${+C0.ccl.toFixed(4)}M_CL at x = ${xM.toFixed(1)} ft (deck placement, the Constructibility tab's factors${C0.eta && C0.eta !== 1 ? `, × η = ${C0.eta}` : ''})`; } }   // ETAC (2026-11-01): × the owner's η
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
    const hAuto = c.h === '' || c.h == null, I = hAuto ? inputsOf(P, { L, bridge: true }) : null, X = xfModel(c.weight, { ...c, h: hAuto ? I.p.h : +c.h }); if (!X.on) return null;
    if (I && I.p.xfBay && X.kind === 'xf' && !X.bad) X.hb = I.p.xfBay.bays.map(q => q ? q.h : X.h);   // SBXF: each bay's own h (the shallower of its two girders)
    if (X.kind === 'dia' && !X.bad) { const GR = bayGroups(P), q = c.dia;   // SB-24: each bay's own diaphragm (its depth group's shape; the end diaphragm too when it takes the intermediate shape)
      if (GR && GR.some(g => grpShape(q, g) !== q.shape)) { const ab = []; GR.forEach(g => { const sh = grpShape(q, g); if (sh === q.shape) return; const Xg = cfDiaSec({ ...q, shape: sh }), Xe = q.eShape ? null : Xg;
        if (!(Xg.A > 0)) return; g.bays.forEach(j => { ab[j] = { A: Xg.A, ...(Xe ? { Ae: Xe.A } : {}), nm: Xg.nm_ }; }); }); if (ab.length) X.ab = ab; } }
    const G = xfPts({ spans: P.spans.lengths.map(Number), xf: L.xf }, X); if (!G) return null;
    const line = Math.min(FRM.lineOf(P, P.girders[gi]), G.length - 1);
    return { line, X, pts: G[line], tot: G[line].reduce((a, q) => a + q.P, 0) };
  }

  window.SBDCrossframes = { ES, DEF, GD_GR, BOLT, FUB, PHI, ANGLES, CF_MEM, CF_CH, CF_DIA, angleProps, cfDiaSec, cfDiaOn, cfDiaGap, cfDiaEnd, cfTypeRec, cfTsCP, cfCPsize, cfBsCP, cfCP, cfDiaFit, bayGroups, grpOf, grpKey, grpShape, diaGroups,
    env0, compute, checks, userModes, xfW, xfModel, xfPts, defaults, inputsOf, envOf, pointLoads, girderDepth, bayDepths, typeGov, extDepth, diaDepthReq };
})();
