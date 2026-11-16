/* apps/crane-pick/engine/ground.js — ground and supports: outrigger / track loads along the swing, mats, ground bearing, stress at depth
   (window.CranePickGround). Classic script, no DOM. C4 (2026-11-16). Uses engine/cranes.js, engine/lift.js, engine/elev.js (when loaded)
   and shared/boussinesq.js (window.SharedBoussinesq, unchanged), read at call time.

   Crane frame (C2-2 lift.js toGrid): origin at the centre of rotation, x forward along the carrier / crawler, y to the left. The boom at
   slew angle θ (from the carrier front, + clockwise in plan) points along û = (cos θ, −sin θ).
   Units: weights lb, lengths ft, pressures psf (lb/ft²; ksf = psf / 1000 shown beside), mat thickness in, F_b / F_v / E psi, F_y ksi.

   1. Loads on the supports (CLAUDE.md §4: new calculation; every step is worked in the tool):
      Weights and their plan positions (crane frame):
        carrier / carbody  W_c at (x_c, 0)                      x_c = carrier CG, + toward the front (entered)
        upperworks         W_u at x_u·û                         x_u = upperworks CG, + toward the boom (entered; without the counterweight)
        counterweight      W_cw at −r_cw·û                      W_cw = the chart configuration's counterweight (or entered),
                                                                 r_cw = its CG radius (entered; else the tail-swing radius, assumed)
        boom               W_b at x_b·û,  x_b = e + f_b (R − e) e = boom-foot pin ahead of rotation (C3-1 geometry), f_b = boom CG as a
                                                                 fraction of the foot-to-tip horizontal distance (entered; else 0.5)
        hook load          W at R·û                             W = load + rigging + hook block + other (C2-2)
      V = ΣW_i;  X = ΣW_i x_i / V;  Y = ΣW_i y_i / V   (the resultant: total vertical load and its position = the overturning moment
      about the centre of rotation, M = V·(X, Y)).
      Outriggers, rigid-body method (the carrier rigid, the four floats equally stiff: the support reactions vary linearly over the plan,
      "plane of loads"; standard statics, as used for outrigger loads in CIRIA C703 (2003) "Crane stability on site" (paraphrase)):
        floats at (x_F, ±b) and (−x_R, ±b): x̄ = (x_F − x_R)/2, a = (x_F + x_R)/2, b = spread / 2;
        u = (X − x̄)/a,  v = Y/b;
        |u| + |v| ≤ 1 (all four in contact):  P_i = V/4 · (1 + s_x u + s_y v)   (s_x = +1 front, −1 rear; s_y = +1 left, −1 right);
        |u| + |v| > 1 (the float diagonally opposite the heaviest one lifts; three floats, statically determinate):
          heaviest P = V(|u| + |v|)/2, the one beside it on the same end V(1 − |v|)/2, on the same side V(1 − |u|)/2, the fourth 0;
        |u| > 1 or |v| > 1: the resultant is outside the floats (the crane would tip): not stable.
        The heaviest float carries P_max = V·h(|u| + |v|), h(s) = (1 + s)/4 (s ≤ 1), s/2 (s > 1): convex in (X, Y).
      Crawlers (rigid carbody, two tracks on their centre lines y = ±g/2, centred on the rotation (C2 plan assumption)):
        V_L = V (1/2 + Y/g),  V_R = V (1/2 − Y/g)   (statics about the track centre lines; < 0 = not stable);
        each track: length L_t, shoe width s, the load at the eccentricity e = X along the track (Decision pending review: the same e on
        both tracks; on the heavier track this is ≥ the plane-of-pressure value, so it is the conservative split);
          |e| ≤ L_t/6 (inside the kern): linear, q_max,min = V_t /(s L_t) · (1 ± 6|e|/L_t);
          L_t/6 < |e| < L_t/2 (outside the kern): triangular over L_b = 3 (L_t/2 − |e|), q_max = 2 V_t /(s L_b);
          |e| ≥ L_t/2: not stable.
        (the eccentric-footing pressure distribution: standard statics.)
   2. Estimate (the weights or CGs are not all entered; Decision pending engineer review, the engineer-approved bounding approach):
        V = G + W_cw + W (G = crane gross operating weight without the counterweight: entered, or the file's);
        the crane without the hook load (weight Q = G + W_cw) has its CG somewhere in the rest box: outriggers: the float rectangle
        (it must be, or the unloaded crane would tip); crawlers: 70 % of the half track length and of the half gauge about the centre of
        rotation (stated assumption; the order of the backward-stability limits for crawler cranes, verify for the machine);
        the resultant then lies in the box (W·h + Q·box)/V (h = the hook's position), and inside the supports (a chart lift is stable);
        every support's load is the most unfavourable value over that box. Floats: P_i is piecewise linear in (u, v) with kinks on
        |u| ± |v| = 1, so its maximum over the box is at the box's corners, at the crossings of its edges with those lines, or at
        (±1, 0), (0, ±1): all of them are checked. Tracks: V_t and q_max increase with |Y| and |e| = |X|, so the bound takes the
        largest |Y| (toward that track) and the largest |X| of the box. Proven ≥ the rigid-body result over random cases
        (tests/engine/crane-ground.test.mjs). Marked "estimate — verify with the manufacturer's outrigger calculator".
   3. Along the swing: every degree of the C2-2 swing path (lift.js pathPoints: the radius changing uniformly with the swing angle); the
      largest load of each float / track and the slew angle where it occurs; the heaviest one governs.
   4. Mats (per setup; Decision pending engineer review): the float as a square of the same area (a = f √π / 2, f = float size taken as
      its diameter, as drawn); the load spreads through the mat at k horizontal : 1 vertical from the float edge (default k = 1, 45°),
      limited by the mat: B_e = min(B, a + 2 k t), L_e = min(L, a + 2 k t), A_e = B_e L_e; uniform pressure q = P / A_e under it;
      ground bearing q_g = q + γ t (mat self-weight); the mat as a cantilever beyond the float face, c = max(B_e − a, L_e − a)/2:
      per foot of width M = q c²/2, V = q c (at the face, conservative);
        timber (the adjusted design values entered, NDS: F_b' = F_b × the applicable factors): M_a = F_b' t²/6, V_a = F_v' (2/3) t;
        steel plate (AISC 360-16 F11.1: M_n = F_y Z, Z = t²/4 per unit width (≤ 1.6 F_y S); ASD Ω_b = 1.67; J4.2(a) shear yielding
        V_n = 0.60 F_y t, Ω_v = 1.50): M_a = F_y t² /(4 × 1.67), V_a = 0.60 F_y t / 1.50;
        cantilever tip deflection (information) δ = q c⁴ /(8 E I), I = t³/12 per unit width.
      Crawler mats across the track: B_e = min(B, s + 2 k t); q = q_max s / B_e; q_g = q + γ t; c = (B_e − s)/2.
      No mat: q_g = P / (π f²/4) (float), q_max (track).
   5. Ground bearing: q_g ≤ q_a (the allowable bearing pressure from the geotechnical engineer, entered per setup).
   6. Stress at depth (shared/boussinesq.js: Newmark's corner-superposition for a uniform rectangle; the closed form / polygon
      integration for the linear / triangular track pressure; FHWA GEC 6 (2002) §5.3.2, Fig. 5-11): at the buried utilities / culverts /
      walls drawn in C1-3 (their depth to top, or the pad elevation − their top elevation), the vertical stress increase at the top of
      the item from every float (its bearing area: the mat's effective area, else the equal-area square) or track, summed; checked at
      the governing slew angle of every support and at the pick and the set, at points along the item (spacing z/3, ≥ 0.5 ft, within
      5 z + 20 ft of the supports) and at its closest point to each support; compared with an entered allowable when given. */
(function () {
  'use strict';
  const K = () => window.CranePickCranes, LF = () => window.CranePickLift, EL = () => window.CranePickElev, BQ = () => window.SharedBoussinesq;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const tx = (x, d) => { if (x === Infinity) return '\\infty'; if (!isNum(x)) return String(x); const s = Math.abs(x).toFixed(d), [i, p] = s.split('.'); return (x < 0 && Number(s) !== 0 ? '\\minus ' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '{,}') + (p ? '.' + p : ''); };
  const tp = (x, d) => { const t = tx(x, d); return t.indexOf('\\minus') === 0 ? '(' + t + ')' : t; };
  const fmt = (v, d) => isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : (v === Infinity ? '∞' : '—');
  const st = (pre, o) => Object.assign({ unit: '', d: 2, ref: '', note: '', eq: '', sub: '' }, o, { id: pre + '.' + o.id });
  const rad = d => d * Math.PI / 180;
  /* unit conversions (exact) */
  const U = { psfPerKsf: 1000, lbPerKip: 1000, ftPerIn: 1 / 12, psfPerPsi: 144, psfPerKsi: 144000, E_STEEL_KSI: 29000 };
  const DEF = { boomCgF: 0.5, spread: 1, gamma: { timber: 50, steel: 490 }, crawlerBox: 0.7, omegaB: 1.67, omegaV: 1.50 };
  const MAT_TYPES = { none: 'none', timber: 'timber crane mat', steel: 'steel plate' };
  const REF = { rigid: 'rigid-body statics (plane of loads); CIRIA C703 (2003), outrigger loads (paraphrase)', track: 'eccentric bearing: kern L/6, triangular beyond (statics)',
    steel: 'AISC 360-16 F11.1 (M_n = F_y Z), J4.2(a) (V_n = 0.60 F_y A_gv); ASD', timber: 'NDS: f_b ≤ F_b\', f_v ≤ F_v\' (adjusted values entered)', bq: 'Newmark (1935); FHWA GEC 6 (2002) §5.3.2, Fig. 5-11' };
  const FLOATS = [{ id: 'FL', name: 'front left', sx: 1, sy: 1 }, { id: 'FR', name: 'front right', sx: 1, sy: -1 }, { id: 'RL', name: 'rear left', sx: -1, sy: 1 }, { id: 'RR', name: 'rear right', sx: -1, sy: -1 }];
  const TRACKS = [{ id: 'TL', name: 'left track', sy: 1 }, { id: 'TR', name: 'right track', sy: -1 }];
  const dval = v => isNum(v) ? v : (v && typeof v === 'object' ? (isNum(v.value) ? v.value : isNum(v.lb) ? v.lb : null) : null);
  function fileGross(c) { const w = (c && c.weights) || {}; for (const k of ['gross_operating_weight', 'gross_vehicle_weight', 'operating_weight', 'gvw']) { const v = dval(w[k]); if (isNum(v) && v > 0) return v; } return null; }
  function cfgOf(crane, setup) { const chs = LF().chartsOf(crane, setup), gr = chs.gr; return gr ? (gr.configs['360'] || gr.configs[gr.zones[0]]) : null; }

  /* inputsOf(crane, setup) -> the weights and CGs, where each comes from, and the mode they allow */
  function inputsOf(crane, setup) {
    const ai = (crane && crane.app_inputs) || {}, ph = ai.ph4 || {}, p = K().planDims(crane), cfg = cfgOf(crane, setup), from = {}, assumed = [];
    const val = (k, v, f) => { from[k] = f; return v; };
    const Wc = ph.carrierLb, xc = ph.carrierCg, Wu = ph.upperLb, xu = ph.upperCg, Wb = ph.boomLb;
    let fb = ph.boomCgF; if (!isNum(fb)) { fb = DEF.boomCgF; assumed.push('boom CG at 0.5 of the foot-to-tip horizontal distance (uniform boom)'); from.fb = 'assumed'; } else from.fb = 'entered';
    let Wcw = null; if (isNum(ph.cwLb)) Wcw = val('Wcw', ph.cwLb, 'entered'); else if (cfg && isNum(cfg.counterweight_lb)) Wcw = val('Wcw', cfg.counterweight_lb, 'chart configuration');
    let rcw = null; if (isNum(ph.cwRad)) rcw = val('rcw', ph.cwRad, 'entered'); else if (isNum(p.tail)) { rcw = val('rcw', p.tail, 'assumed'); assumed.push('counterweight CG at the tail-swing radius'); }
    const geo = EL() ? EL().geomOf(crane) : null, e = geo && isNum(geo.footE) ? geo.footE : (isNum(p.boomFoot) ? p.boomFoot : 0);
    let G = null; if (isNum(ph.grossLb)) G = val('G', ph.grossLb, 'entered'); else if (isNum(fileGross(crane))) G = val('G', fileGross(crane), 'crane file');
    else if ([Wc, Wu, Wb].every(isNum)) G = val('G', Wc + Wu + Wb, 'sum of the entered weights');
    const need = [['carrier / carbody weight', Wc], ['carrier / carbody CG', xc], ['upperworks weight', Wu], ['upperworks CG', xu], ['boom weight', Wb], ['counterweight', Wcw], ['counterweight radius', rcw]];
    const missing = need.filter(x => !isNum(x[1])).map(x => x[0]);
    const mode = !missing.length ? 'rigid' : isNum(G) && isNum(Wcw) ? 'estimate' : 'none';
    return { mode, missing, Wc, xc, Wu, xu, Wb, fb, Wcw, rcw, e, G, from, assumed, cfg };
  }
  /* supports(crane, setup) -> { ok, kind, ... } in the crane frame */
  function supports(crane, setup) {
    const p = K().planDims(crane), ph = ((crane && crane.app_inputs) || {}).ph4 || {}, cfg = cfgOf(crane, setup), assumed = [];
    if (!cfg) return { ok: false, why: 'no chart configuration for this setup' };
    if (p.kind === 'crawler') {
      const c = p.crawler || {}; let s = isNum(ph.floatFt) ? ph.floatFt : c.shoe;
      if (!isNum(s)) { s = 3; assumed.push('track shoe width 3 ft'); }
      if (!isNum(c.length) || !isNum(c.gauge)) return { ok: false, why: 'the crawler track length / gauge are not given (crane editor: plan dimensions)' };
      return { ok: true, kind: 'crawler', Lt: c.length, g: c.gauge, s, assumed, items: TRACKS.map(t => Object.assign({ lx: 0, ly: t.sy * c.gauge / 2 }, t)) };
    }
    const key = K().spreadKey(cfg, p), o = p.outr || {};
    if (!key || !isNum(o.xFront) || !isNum(o.xRear) || !isNum((o.spreads || {})[key])) return { ok: false, why: /rubber/.test(cfg.support || '') ? 'on rubber: tyre loads are not covered by this tool' : 'the outrigger positions / spread are not given (crane editor: plan dimensions)' };
    let f = isNum(ph.floatFt) ? ph.floatFt : o.float; if (!isNum(f)) { f = 2; assumed.push('float size 2 ft'); }
    const b = o.spreads[key] / 2;
    return { ok: true, kind: 'wheeled', xF: o.xFront, xR: o.xRear, b, a: (o.xFront + o.xRear) / 2, xbar: (o.xFront - o.xRear) / 2, f, spread: key, assumed,
      items: FLOATS.map(t => Object.assign({ lx: t.sx > 0 ? o.xFront : -o.xRear, ly: t.sy * b }, t)) };
  }
  /* the weights at slew angle θ and hook radius R */
  function parts(inp, theta, R, W) {
    const ux = Math.cos(rad(theta)), uy = -Math.sin(rad(theta)), xb = inp.e + inp.fb * (R - inp.e);
    return [{ id: 'c', name: 'carrier / carbody', W: inp.Wc, x: inp.xc, y: 0 }, { id: 'u', name: 'upperworks', W: inp.Wu, x: inp.xu * ux, y: inp.xu * uy, r: inp.xu },
      { id: 'cw', name: 'counterweight', W: inp.Wcw, x: -inp.rcw * ux, y: -inp.rcw * uy, r: -inp.rcw }, { id: 'b', name: 'boom', W: inp.Wb, x: xb * ux, y: xb * uy, r: xb },
      { id: 'h', name: 'hook load', W, x: R * ux, y: R * uy, r: R }];
  }
  function resultant(ps) { const V = ps.reduce((s, q) => s + q.W, 0); return { V, X: ps.reduce((s, q) => s + q.W * q.x, 0) / V, Y: ps.reduce((s, q) => s + q.W * q.y, 0) / V }; }
  /* floatDist(V, X, Y, S) -> { u, v, P: [FL, FR, RL, RR], three (bool), stable } */
  function floatDist(V, X, Y, S) {
    const u = (X - S.xbar) / S.a, v = Y / S.b, au = Math.abs(u), av = Math.abs(v), eps = 1e-9;
    const stable = au <= 1 + eps && av <= 1 + eps;
    if (au + av <= 1) return { u, v, P: FLOATS.map(f => V / 4 * (1 + f.sx * u + f.sy * v)), three: false, stable };
    const gx = u >= 0 ? 1 : -1, gy = v >= 0 ? 1 : -1;
    return { u, v, three: true, stable, P: FLOATS.map(f => f.sx === gx && f.sy === gy ? V * (au + av) / 2 : f.sx === gx ? V * (1 - av) / 2 : f.sy === gy ? V * (1 - au) / 2 : 0) };
  }
  /* trackP(Vt, e, L, s) -> { Vt, e, q1 (max), q2 (min), Lb, tri, stable, q0, gy (pressure along the track: q0 + gy·η, η from the
     track centre toward +x; the triangular case clipped at zero) } */
  function trackP(Vt, e, L, s) {
    const ae = Math.abs(e), sg = e >= 0 ? 1 : -1;
    if (!(Vt >= -1e-9) || ae >= L / 2 - 1e-12) return { Vt, e, q1: Infinity, q2: 0, Lb: 0, tri: true, stable: false, q0: 0, gy: 0 };
    if (ae <= L / 6) { const qa = Vt / (s * L); return { Vt, e, q1: qa * (1 + 6 * ae / L), q2: qa * (1 - 6 * ae / L), Lb: L, tri: false, stable: true, q0: qa, gy: 12 * Vt * e / (s * L * L * L) }; }
    const Lb = 3 * (L / 2 - ae), q1 = 2 * Vt / (s * Lb);
    return { Vt, e, q1, q2: 0, Lb, tri: true, stable: true, q0: q1 * (1 - L / (2 * Lb)), gy: sg * q1 / Lb };
  }
  function trackDist(V, X, Y, S) {
    const VL = V * (0.5 + Y / S.g), VR = V * (0.5 - Y / S.g);
    const t = [trackP(VL, X, S.Lt, S.s), trackP(VR, X, S.Lt, S.s)];
    return { VL, VR, e: X, T: t, stable: VL >= -1e-9 && VR >= -1e-9 && t.every(x => x.stable) };
  }
  /* rigidAt / boundAt -> { V, X, Y, load: [per support: lb (float) or track V_t], q: [psf: track q_max] , stable, ... } */
  function rigidAt(inp, S, theta, R, W) {
    const ps = parts(inp, theta, R, W), r = resultant(ps);
    if (S.kind === 'wheeled') { const d = floatDist(r.V, r.X, r.Y, S); return Object.assign({ theta, R, ps, load: d.P, stable: d.stable, d }, r); }
    const d = trackDist(r.V, r.X, r.Y, S); return Object.assign({ theta, R, ps, load: [d.VL, d.VR], q: d.T.map(x => x.q1), stable: d.stable, d }, r);
  }
  function restBox(S) {
    if (S.kind === 'wheeled') return { x0: -S.xR, x1: S.xF, y0: -S.b, y1: S.b };
    const k = DEF.crawlerBox; return { x0: -k * S.Lt / 2, x1: k * S.Lt / 2, y0: -k * S.g / 2, y1: k * S.g / 2 };
  }
  function boundAt(inp, S, theta, R, W) {
    const V = inp.G + inp.Wcw + W, Q = V - W, ux = Math.cos(rad(theta)), uy = -Math.sin(rad(theta)), hx = R * ux, hy = R * uy, B = restBox(S);
    const lim = S.kind === 'wheeled' ? { x0: -S.xR, x1: S.xF, y0: -S.b, y1: S.b } : { x0: -S.Lt / 2, x1: S.Lt / 2, y0: -S.g / 2, y1: S.g / 2 };
    const reg = { x0: Math.max(lim.x0, (W * hx + Q * B.x0) / V), x1: Math.min(lim.x1, (W * hx + Q * B.x1) / V), y0: Math.max(lim.y0, (W * hy + Q * B.y0) / V), y1: Math.min(lim.y1, (W * hy + Q * B.y1) / V) };
    const base = { theta, R, V, Q, hx, hy, box: B, reg, bound: true };
    if (reg.x0 > reg.x1 + 1e-9 || reg.y0 > reg.y1 + 1e-9) return Object.assign(base, { stable: false, feasible: false, load: S.items.map(() => Infinity), q: S.kind === 'crawler' ? [Infinity, Infinity] : undefined, at: [] });
    if (S.kind === 'wheeled') {
      const cand = boundCandidates(reg, S), load = FLOATS.map(() => 0), at = FLOATS.map(() => null);
      cand.forEach(c => { const d = floatDist(V, c.X, c.Y, S); d.P.forEach((P, i) => { if (P > load[i]) { load[i] = P; at[i] = { X: c.X, Y: c.Y, u: d.u, v: d.v, three: d.three }; } }); });
      return Object.assign(base, { stable: true, feasible: true, load, at, nCand: cand.length });
    }
    const ex = Math.max(Math.abs(reg.x0), Math.abs(reg.x1)), YL = reg.y1, YR = reg.y0;
    const tL = trackP(V * (0.5 + YL / S.g), ex, S.Lt, S.s), tR = trackP(V * (0.5 - YR / S.g), ex, S.Lt, S.s);
    return Object.assign(base, { stable: tL.stable && tR.stable, feasible: true, load: [tL.Vt, tR.Vt], q: [tL.q1, tR.q1], T: [tL, tR], ex, at: [{ X: ex, Y: YL }, { X: ex, Y: YR }] });
  }
  /* the points of the region where a float's load can be largest (P_i piecewise linear in u, v; kinks on |u| ± |v| = 1) */
  function boundCandidates(reg, S) {
    const U0 = (reg.x0 - S.xbar) / S.a, U1 = (reg.x1 - S.xbar) / S.a, V0 = reg.y0 / S.b, V1 = reg.y1 / S.b, pts = [];
    const add = (u, v) => { if (u >= U0 - 1e-12 && u <= U1 + 1e-12 && v >= V0 - 1e-12 && v <= V1 + 1e-12) pts.push({ u: Math.min(U1, Math.max(U0, u)), v: Math.min(V1, Math.max(V0, v)) }); };
    [[U0, V0], [U0, V1], [U1, V0], [U1, V1], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([u, v]) => add(u, v));
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([p, q]) => {   // the line p·u + q·v = 1
      [U0, U1].forEach(u => add(u, (1 - p * u) / q)); [V0, V1].forEach(v => add((1 - q * v) / p, v));
    });
    return pts.map(c => ({ X: S.xbar + c.u * S.a, Y: c.v * S.b }));
  }
  /* ---------- mats and bearing ---------- */
  function matOf(setup) {
    const g = (setup && setup.ground) || {}, m = g.mat || {}, type = MAT_TYPES[m.type] ? m.type : 'none';
    return { type, B: m.B, L: m.L, t: m.t, Fb: m.Fb, Fv: m.Fv, E: m.E, Fy: m.Fy, gamma: isNum(m.gamma) ? m.gamma : (DEF.gamma[type] || 0), gFrom: isNum(m.gamma) ? 'entered' : 'assumed', k: isNum(m.k) && m.k >= 0 ? m.k : DEF.spread };
  }
  /* bearing(P_or_q, S, mat, pre) -> { qg (psf), Ae, ok (mat inputs complete), M, V, Ma, Va, rM, rV, defl, steps }
     float: P = float load (lb); crawler: q = track q_max (psf) */
  function bearing(load, S, mat, pre) {
    const steps = [], o = { steps };
    if (S.kind === 'wheeled') {
      const f = S.f, Af = Math.PI * f * f / 4;
      if (mat.type === 'none') {
        o.qg = load / Af; o.A = Af;
        steps.push(st(pre, { id: 'Af', label: 'Float bearing area (round float, size taken as its diameter)', sym: 'A_{f}', eq: '\\frac{\\pi f^{2}}{4}', sub: `\\frac{\\pi \\cdot ${tx(f, 2)}^{2}}{4}`, value: Af, unit: 'ft^{2}', d: 3 }),
          st(pre, { id: 'qg', label: 'Ground bearing pressure under the float (no mat)', sym: 'q_{g}', eq: '\\frac{P}{A_{f}}', sub: `\\frac{${tx(load, 0)}}{${tx(Af, 3)}}`, value: o.qg, unit: 'psf', d: 0 }));
        return o;
      }
      const t = mat.t * U.ftPerIn, a = f * Math.sqrt(Math.PI) / 2;
      if (!(mat.B > 0 && mat.L > 0 && mat.t > 0)) { o.bad = 'enter the mat size and thickness'; o.qg = load / Af; o.A = Af; return o; }
      const Be = Math.min(mat.B, a + 2 * mat.k * t), Le = Math.min(mat.L, a + 2 * mat.k * t), Ae = Be * Le, q = load / Ae, c = Math.max(Be - a, Le - a, 0) / 2;
      o.a = a; o.Be = Be; o.Le = Le; o.A = Ae; o.q = q; o.c = c; o.qg = q + mat.gamma * t;
      steps.push(st(pre, { id: 'a', label: 'Float as the square of the same area (round float of size f)', sym: 'a', eq: '\\frac{f\\sqrt{\\pi}}{2}', sub: `\\frac{${tx(f, 2)}\\sqrt{\\pi}}{2}`, value: a, unit: 'ft', d: 3 }),
        st(pre, { id: 't', label: 'Mat thickness', sym: 't', eq: '\\frac{t_{in}}{12}', sub: `\\frac{${tx(mat.t, 2)}}{12}`, value: t, unit: 'ft', d: 4 }),
        st(pre, { id: 'Be', label: `Effective bearing width (spread ${fmt(mat.k, 2)} : 1 from the float edge, limited by the mat)`, sym: 'B_{e}', eq: '\\min(B,\\; a + 2 k t)', sub: `\\min(${tx(mat.B, 2)},\\; ${tx(a, 3)} + 2 \\cdot ${tx(mat.k, 2)} \\cdot ${tx(t, 4)})`, value: Be, unit: 'ft', d: 3, note: 'Decision (pending engineer review): load spread through the mat at k : 1 (default 1 : 1, 45°); a stiffer or thicker mat may spread more, a flexible one less.' }),
        st(pre, { id: 'Le', label: 'Effective bearing length', sym: 'L_{e}', eq: '\\min(L,\\; a + 2 k t)', sub: `\\min(${tx(mat.L, 2)},\\; ${tx(a, 3)} + 2 \\cdot ${tx(mat.k, 2)} \\cdot ${tx(t, 4)})`, value: Le, unit: 'ft', d: 3 }),
        st(pre, { id: 'Ae', label: 'Effective bearing area', sym: 'A_{e}', eq: 'B_{e} L_{e}', sub: `${tx(Be, 3)} \\cdot ${tx(Le, 3)}`, value: Ae, unit: 'ft^{2}', d: 3 }),
        st(pre, { id: 'q', label: 'Pressure under the effective area (from the float load)', sym: 'q', eq: '\\frac{P}{A_{e}}', sub: `\\frac{${tx(load, 0)}}{${tx(Ae, 3)}}`, value: q, unit: 'psf', d: 0 }),
        st(pre, { id: 'qg', label: `Ground bearing pressure (with the mat's weight, γ = ${fmt(mat.gamma, 0)} pcf ${mat.gFrom})`, sym: 'q_{g}', eq: 'q + \\gamma t', sub: `${tx(q, 0)} + ${tx(mat.gamma, 0)} \\cdot ${tx(t, 4)}`, value: o.qg, unit: 'psf', d: 0 }),
        st(pre, { id: 'c', label: 'Mat cantilever beyond the float face', sym: 'c', eq: '\\frac{\\max(B_{e} \\minus a,\\; L_{e} \\minus a)}{2}', sub: `\\frac{\\max(${tx(Be - a, 3)},\\; ${tx(Le - a, 3)})}{2}`, value: c, unit: 'ft', d: 3 }));
      return matChecks(o, q, c, t, mat, pre);
    }
    // crawler track
    const s = S.s;
    if (mat.type === 'none') { o.qg = load; o.A = null; steps.push(st(pre, { id: 'qg', label: 'Ground bearing pressure under the track (no mat): q_max of the track', sym: 'q_{g}', eq: 'q_{max}', sub: tx(load, 0), value: load, unit: 'psf', d: 0 })); return o; }
    if (!(mat.B > 0 && mat.t > 0)) { o.bad = 'enter the mat length across the track and its thickness'; o.qg = load; return o; }
    const t = mat.t * U.ftPerIn, Be = Math.min(mat.B, s + 2 * mat.k * t), q = load * s / Be, c = Math.max(Be - s, 0) / 2;
    o.Be = Be; o.q = q; o.c = c; o.qg = q + mat.gamma * t;
    steps.push(st(pre, { id: 't', label: 'Mat thickness', sym: 't', eq: '\\frac{t_{in}}{12}', sub: `\\frac{${tx(mat.t, 2)}}{12}`, value: t, unit: 'ft', d: 4 }),
      st(pre, { id: 'Be', label: `Effective width across the track (spread ${fmt(mat.k, 2)} : 1 from the shoe edge, limited by the mat)`, sym: 'B_{e}', eq: '\\min(B,\\; s + 2 k t)', sub: `\\min(${tx(mat.B, 2)},\\; ${tx(s, 2)} + 2 \\cdot ${tx(mat.k, 2)} \\cdot ${tx(t, 4)})`, value: Be, unit: 'ft', d: 3, note: 'Decision (pending engineer review): spread at k : 1 across the track only; none along it (conservative).' }),
      st(pre, { id: 'q', label: 'Pressure under the mat at the heaviest end of the track', sym: 'q', eq: '\\frac{q_{max}\\, s}{B_{e}}', sub: `\\frac{${tx(load, 0)} \\cdot ${tx(s, 2)}}{${tx(Be, 3)}}`, value: q, unit: 'psf', d: 0 }),
      st(pre, { id: 'qg', label: `Ground bearing pressure (with the mat's weight, γ = ${fmt(mat.gamma, 0)} pcf ${mat.gFrom})`, sym: 'q_{g}', eq: 'q + \\gamma t', sub: `${tx(q, 0)} + ${tx(mat.gamma, 0)} \\cdot ${tx(t, 4)}`, value: o.qg, unit: 'psf', d: 0 }),
      st(pre, { id: 'c', label: 'Mat cantilever beyond the track shoe', sym: 'c', eq: '\\frac{B_{e} \\minus s}{2}', sub: `\\frac{${tx(Be, 3)} \\minus ${tx(s, 2)}}{2}`, value: c, unit: 'ft', d: 3 }));
    return matChecks(o, q, c, t, mat, pre);
  }
  function matChecks(o, q, c, t, mat, pre) {
    const s = o.steps, M = q * c * c / 2, V = q * c, I = t * t * t / 12;
    s.push(st(pre, { id: 'M', label: 'Mat bending moment at the face, per foot of width', sym: 'M', eq: '\\frac{q c^{2}}{2}', sub: `\\frac{${tx(q, 0)} \\cdot ${tx(c, 3)}^{2}}{2}`, value: M, unit: 'lb\\cdot ft/ft', d: 0 }),
      st(pre, { id: 'V', label: 'Mat shear at the face, per foot of width (conservative: at the face, not at d)', sym: 'V', eq: 'q c', sub: `${tx(q, 0)} \\cdot ${tx(c, 3)}`, value: V, unit: 'lb/ft', d: 0 }));
    let E = null;
    if (mat.type === 'timber') {
      if (!(mat.Fb > 0 && mat.Fv > 0)) { o.bad = 'enter the timber F_b\' and F_v\''; }
      else {
        const Fb = mat.Fb * U.psfPerPsi, Fv = mat.Fv * U.psfPerPsi;
        o.Ma = Fb * t * t / 6; o.Va = Fv * 2 * t / 3;
        s.push(st(pre, { id: 'Ma', label: 'Allowable moment per foot (timber, solid section)', sym: 'M_{a}', eq: '\\frac{F_{b}\' t^{2}}{6}', sub: `\\frac{${tx(mat.Fb, 0)} \\cdot 144 \\cdot ${tx(t, 4)}^{2}}{6}`, value: o.Ma, unit: 'lb\\cdot ft/ft', d: 0, ref: REF.timber, note: 'F_b\' in psi × 144 = psf; enter the adjusted value (wet service, duration, size…).' }),
          st(pre, { id: 'Va', label: 'Allowable shear per foot (timber, f_v = 1.5 V / t)', sym: 'V_{a}', eq: '\\frac{2 F_{v}\' t}{3}', sub: `\\frac{2 \\cdot ${tx(mat.Fv, 0)} \\cdot 144 \\cdot ${tx(t, 4)}}{3}`, value: o.Va, unit: 'lb/ft', d: 0, ref: REF.timber }));
      }
      if (mat.E > 0) E = mat.E * U.psfPerPsi;
    } else if (mat.type === 'steel') {
      if (!(mat.Fy > 0)) { o.bad = 'enter the plate F_y'; }
      else {
        const Fy = mat.Fy * U.psfPerKsi;
        o.Ma = Fy * t * t / 4 / DEF.omegaB; o.Va = 0.6 * Fy * t / DEF.omegaV;
        s.push(st(pre, { id: 'Ma', label: 'Allowable moment per foot (steel plate, plastic: Z = t²/4)', sym: 'M_{a}', eq: '\\frac{F_{y} t^{2}}{4\\, \\Omega_{b}}', sub: `\\frac{${tx(mat.Fy, 1)} \\cdot 144{,}000 \\cdot ${tx(t, 4)}^{2}}{4 \\cdot 1.67}`, value: o.Ma, unit: 'lb\\cdot ft/ft', d: 0, ref: REF.steel, note: 'F_y in ksi × 144,000 = psf.' }),
          st(pre, { id: 'Va', label: 'Allowable shear per foot (steel plate, shear yielding)', sym: 'V_{a}', eq: '\\frac{0.60 F_{y} t}{\\Omega_{v}}', sub: `\\frac{0.60 \\cdot ${tx(mat.Fy, 1)} \\cdot 144{,}000 \\cdot ${tx(t, 4)}}{1.50}`, value: o.Va, unit: 'lb/ft', d: 0, ref: REF.steel }));
      }
      E = U.E_STEEL_KSI * U.psfPerKsi;
    }
    o.M = M; o.V = V;
    if (isNum(o.Ma)) { o.rM = M / o.Ma; o.rV = V / o.Va;
      s.push(st(pre, { id: 'rM', label: 'Mat bending ratio', sym: '\\frac{M}{M_{a}}', eq: '', sub: `\\frac{${tx(M, 0)}}{${tx(o.Ma, 0)}}`, value: o.rM, d: 3, note: o.rM <= 1 ? 'OK' : 'OVER: a thicker or stronger mat' }),
        st(pre, { id: 'rV', label: 'Mat shear ratio', sym: '\\frac{V}{V_{a}}', eq: '', sub: `\\frac{${tx(V, 0)}}{${tx(o.Va, 0)}}`, value: o.rV, d: 3, note: o.rV <= 1 ? 'OK' : 'OVER: a thicker or stronger mat' })); }
    if (E) { o.defl = q * Math.pow(c, 4) / (8 * E * I) * 12;
      s.push(st(pre, { id: 'dl', label: 'Mat cantilever deflection at the effective edge (information; a large value means less spread than assumed)', sym: '\\delta', eq: '\\frac{q c^{4}}{8 E I} \\cdot 12', sub: `\\frac{${tx(q, 0)} \\cdot ${tx(c, 3)}^{4}}{8 \\cdot ${tx(E, 0)} \\cdot ${tx(I, 6)}} \\cdot 12`, value: o.defl, unit: 'in', d: 3, note: 'E in psf; I = t³/12 per foot of width (ft⁴/ft).' })); }
    return o;
  }
  /* ---------- the pick along its swing ---------- */
  /* o (C5, optional): { W (the hook load, lb, in place of LF.total(pick)), pts: [{ x, y }] (the hook positions to check, in place of the
     pick's swing path: a girder lift's steps for this crane) }; pick may then be null. */
  function evaluate(crane, setup, pick, P, idp, o) {
    idp = idp || 'gr'; o = o || null;
    const inp = inputsOf(crane, setup), S = supports(crane, setup), W = o && isNum(o.W) ? o.W : LF().total(pick);
    const out = { mode: inp.mode, inp, S, W, src: o && o.pts ? 'steps' : 'swing', label: inp.mode === 'rigid' ? 'entered data' : 'estimate — verify with the manufacturer\'s outrigger calculator', flags: [] };
    if (!S.ok) { out.mode = 'none'; out.why = S.why; return out; }
    if (inp.mode === 'none') { out.why = `enter the crane's gross operating weight${isNum(inp.Wcw) ? '' : ' and the counterweight'} (estimate), or the weights and CGs (${inp.missing.join(', ')}) on the crane card`; return out; }
    const pp = o && o.pts ? { pts: o.pts.map((q, j, a) => { const dx = q.x - setup.x, dy = q.y - setup.y; let az = Math.atan2(dx, dy) * 180 / Math.PI; if (az < 0) az += 360;
      return { x: q.x, y: q.y, az, r: Math.hypot(dx, dy), t: a.length > 1 ? j / (a.length - 1) : 0 }; }) } : LF().pathPoints(setup, pick.pick, pick.set, pick.swing || 'short', LF().settingsOf(P).path), h0 = setup.heading || 0;
    if (!pp.pts.length) { out.mode = 'none'; out.why = 'no hook positions to check'; return out; }
    const fn = inp.mode === 'rigid' ? rigidAt : boundAt;
    const samples = pp.pts.map(q => { const theta = K().norm180(q.az - h0); return Object.assign(fn(inp, S, theta, q.r, W), { t: q.t, gp: { x: q.x, y: q.y } }); });
    out.samples = samples;
    const isTr = S.kind === 'crawler', key = s => isTr ? s.q : s.load;
    out.max = S.items.map((it, i) => { let best = null; samples.forEach((s, j) => { const v = key(s)[i]; if (!best || v > best.v + 1e-9) best = { v, j }; }); const s = samples[best.j];
      return { id: it.id, name: it.name, i, j: best.j, theta: s.theta, R: s.R, load: s.load[i], q: isTr ? s.q[i] : null, s }; });
    out.unstable = samples.some(s => !s.stable);
    const gi = out.max.reduce((b, m, i) => (key(m.s)[i] > key(out.max[b].s)[b] ? i : b), 0);
    out.gov = out.max[gi];
    const mat = matOf(setup), qa = setup.ground && isNum(setup.ground.qa) && setup.ground.qa > 0 ? setup.ground.qa : null;
    out.mat = mat; out.qa = qa;
    out.bear = out.max.map(m => { const b = bearing(isTr ? m.q : m.load, S, mat, `${idp}.m.${m.id}`); b.ratio = qa ? b.qg / qa : null; if (qa) b.steps.push(st(`${idp}.m.${m.id}`, { id: 'rq', label: 'Ground bearing ratio (allowable bearing pressure from the geotechnical engineer)', sym: '\\frac{q_{g}}{q_{a}}', eq: '', sub: `\\frac{${tx(b.qg, 0)}}{${tx(qa, 0)}}`, value: b.ratio, d: 3, note: b.ratio <= 1 ? 'OK' : 'OVER the allowable bearing pressure' })); return b; });
    out.steps = govSteps(out, idp);
    if (out.unstable) out.flags.push({ level: 'stop', text: inp.mode === 'rigid' ? 'Ground: the resultant leaves the supports on the swing (the crane would tip with the entered weights): check the inputs.' : (samples.some(s => s.feasible === false) ? 'Ground (estimate): no CG position within the stated limits keeps the resultant inside the supports at some slew angle: enter the weights and CGs.' : 'Ground (estimate): the resultant may reach the track end at some slew angle, so the estimate cannot bound the track pressure: enter the weights and CGs.') });
    out.bear.forEach((b, i) => { const m = out.max[i];
      if (b.ratio > 1) out.flags.push({ level: 'stop', text: `Ground: ${m.name} bearing ${fmt(b.qg, 0)} psf > allowable ${fmt(qa, 0)} psf (${fmt(b.ratio, 2)}).` });
      if (b.rM > 1 || b.rV > 1) out.flags.push({ level: 'stop', text: `Ground: the mat under the ${m.name} is overstressed (bending ${fmt(b.rM, 2)}, shear ${fmt(b.rV, 2)}).` });
      if (b.bad) out.flags.push({ level: 'warn', text: `Ground: ${b.bad}.` }); });
    if (!qa) out.flags.push({ level: 'info', text: 'Ground: no allowable bearing pressure entered for this setup (Ground tab).' });
    out.depth = depthAll(out, crane, setup, P, idp);
    out.depth.forEach(d => { if (d.ratio > 1) out.flags.push({ level: 'stop', text: `Ground: stress at depth at "${d.name}" ${fmt(d.ds, 0)} psf > the entered allowable ${fmt(d.cap, 0)} psf.` }); });
    return out;
  }
  /* the governing support's worked steps at its governing slew angle */
  function govSteps(out, idp) {
    const S = out.S, inp = out.inp, m = out.gov, s = m.s, pre = idp + '.L', L = [];
    const alongSteps = out.src === 'steps';   // C5: a girder lift's steps (1 ft of hook travel / 1° of slew)
    L.push(st(pre, { id: 'th', label: `Governing slew angle for the ${m.name} (largest ${S.kind === 'crawler' ? 'track pressure' : 'float load'} ${alongSteps ? 'over the girder lift\'s steps' : 'on the swing, 1° steps'})`, sym: '\\theta', eq: '', sub: '', value: s.theta, unit: 'deg', d: 1, note: '0° = over the front, + clockwise (plan).' }),
      st(pre, { id: 'R', label: alongSteps ? 'Hook radius there (the hook plumb above its lifting point at that step)' : 'Hook radius there (the radius changing uniformly along the swing)', sym: 'R', eq: '', sub: '', value: s.R, unit: 'ft', d: 2 }));
    if (!s.bound) {
      s.ps.forEach(q => L.push(st(pre, { id: 'x' + q.id, label: `${q.name}: W = ${fmt(q.W, 0)} lb at (x, y)`, sym: `(x,\\,y)_{${q.id}}`, eq: q.id === 'c' ? '(x_{c},\\; 0)' : q.id === 'cw' ? '\\minus r_{cw}(\\cos\\theta,\\; \\minus \\sin\\theta)' : q.id === 'b' ? '(e + f_{b}(R \\minus e))(\\cos\\theta,\\; \\minus \\sin\\theta)' : `${q.id === 'h' ? 'R' : 'x_{u}'}(\\cos\\theta,\\; \\minus \\sin\\theta)`,
        sub: q.id === 'c' ? `(${tx(q.x, 2)},\\; 0)` : `${tp(q.r, 2)}(\\cos ${tp(s.theta, 1)}°,\\; \\minus \\sin ${tp(s.theta, 1)}°)`, value: `(${fmt(q.x, 2)}, ${fmt(q.y, 2)})`, unit: 'ft', d: 2,
        note: q.id === 'b' ? `e = ${fmt(inp.e, 2)} ft, f_b = ${fmt(inp.fb, 2)} (${inp.from.fb})` : q.id === 'cw' ? `r_cw ${inp.from.rcw}; W_cw ${inp.from.Wcw}` : '' })));
      L.push(st(pre, { id: 'V', label: 'Total vertical load', sym: 'V', eq: '\\sum W_{i}', sub: s.ps.map(q => tx(q.W, 0)).join(' + '), value: s.V, unit: 'lb', d: 0, ref: REF.rigid }),
        st(pre, { id: 'X', label: 'Resultant position, x (forward)', sym: 'X', eq: '\\frac{\\sum W_{i} x_{i}}{V}', sub: `\\frac{${s.ps.map(q => tx(q.W, 0) + ' \\cdot ' + tp(q.x, 2)).join(' + ')}}{${tx(s.V, 0)}}`, value: s.X, unit: 'ft', d: 3 }),
        st(pre, { id: 'Y', label: 'Resultant position, y (left)', sym: 'Y', eq: '\\frac{\\sum W_{i} y_{i}}{V}', sub: `\\frac{${s.ps.map(q => tx(q.W, 0) + ' \\cdot ' + tp(q.y, 2)).join(' + ')}}{${tx(s.V, 0)}}`, value: s.Y, unit: 'ft', d: 3,
          note: `Overturning moment about the centre of rotation: M = V·(X, Y) = (${fmt(s.V * s.X, 0)}, ${fmt(s.V * s.Y, 0)}) lb·ft.` }));
    } else {
      L.push(st(pre, { id: 'V', label: 'Total vertical load (estimate: gross operating weight + counterweight + hook load)', sym: 'V', eq: 'G + W_{cw} + W', sub: `${tx(inp.G, 0)} + ${tx(inp.Wcw, 0)} + ${tx(out.W, 0)}`, value: s.V, unit: 'lb', d: 0, note: `G ${inp.from.G}; W_cw ${inp.from.Wcw}.` }),
        st(pre, { id: 'h', label: 'Hook position', sym: '(x_{h},\\,y_{h})', eq: 'R(\\cos\\theta,\\; \\minus \\sin\\theta)', sub: `${tx(s.R, 2)}(\\cos ${tp(s.theta, 1)}°,\\; \\minus \\sin ${tp(s.theta, 1)}°)`, value: `(${fmt(s.hx, 2)}, ${fmt(s.hy, 2)})`, unit: 'ft', d: 2 }),
        st(pre, { id: 'box', label: S.kind === 'wheeled' ? 'Rest box: the CG of the crane without the hook load lies within the float rectangle (else it would tip unloaded)' : 'Rest box: the CG of the crane without the hook load within 70 % of the half track length and half gauge (stated assumption)', sym: '[x],\\,[y]', eq: '', sub: '', value: `x ${fmt(s.box.x0, 2)} … ${fmt(s.box.x1, 2)}, y ${fmt(s.box.y0, 2)} … ${fmt(s.box.y1, 2)}`, unit: 'ft', d: 2, note: 'Decision (pending engineer review).' }),
        st(pre, { id: 'reg', label: 'Possible resultant positions: (W·h + (V − W)·box)/V, inside the supports', sym: '[X],\\,[Y]', eq: '\\frac{W x_{h} + (V \\minus W)[x]}{V}', sub: `\\frac{${tx(out.W, 0)} \\cdot ${tp(s.hx, 2)} + ${tx(s.Q, 0)}\\,[${tx(s.box.x0, 2)},\\, ${tx(s.box.x1, 2)}]}{${tx(s.V, 0)}}`, value: s.stable ? `X ${fmt(s.reg.x0, 3)} … ${fmt(s.reg.x1, 3)}, Y ${fmt(s.reg.y0, 3)} … ${fmt(s.reg.y1, 3)}` : 'empty (not stable)', unit: 'ft', d: 3, note: 'the same for Y with y_h and [y]' }));
    }
    if (S.kind === 'wheeled') {
      const at = s.bound ? s.at[m.i] : { u: s.d.u, v: s.d.v, three: s.d.three, X: s.X, Y: s.Y };
      if (!at) return L;
      L.push(st(pre, { id: 'u', label: 'Float layout: x̄ = (x_F − x_R)/2, a = (x_F + x_R)/2, b = spread / 2' + (s.bound ? ' (at the most unfavourable resultant position for this float)' : ''), sym: 'u', eq: '\\frac{X \\minus \\bar{x}}{a}', sub: `\\frac{${tp(at.X, 3)} \\minus ${tp(S.xbar, 2)}}{${tx(S.a, 2)}}`, value: at.u, d: 4, note: `x_F = ${fmt(S.xF, 2)}, x_R = ${fmt(S.xR, 2)}, b = ${fmt(S.b, 2)} ft (spread "${S.spread}")` }),
        st(pre, { id: 'v', label: 'Lateral eccentricity ratio', sym: 'v', eq: '\\frac{Y}{b}', sub: `\\frac{${tp(at.Y, 3)}}{${tx(S.b, 2)}}`, value: at.v, d: 4 }));
      const f = FLOATS[m.i], au = Math.abs(at.u), av = Math.abs(at.v);
      if (!at.three) L.push(st(pre, { id: 'P', label: `${m.name} float load (all four floats in contact: |u| + |v| = ${fmt(au + av, 3)} ≤ 1)`, sym: `P_{${f.id}}`, eq: `\\frac{V}{4}(1 ${f.sx > 0 ? '+' : '\\minus'} u ${f.sy > 0 ? '+' : '\\minus'} v)`, sub: `\\frac{${tx(s.V, 0)}}{4}(1 ${f.sx > 0 ? '+' : '\\minus'} ${tp(at.u, 4)} ${f.sy > 0 ? '+' : '\\minus'} ${tp(at.v, 4)})`, value: m.load, unit: 'lb', d: 0, ref: REF.rigid }));
      else { const gx = at.u >= 0 ? 1 : -1, gy = at.v >= 0 ? 1 : -1, heavy = f.sx === gx && f.sy === gy, sameEnd = f.sx === gx;
        L.push(st(pre, { id: 'P', label: `${m.name} float load (|u| + |v| = ${fmt(au + av, 3)} > 1: the diagonally opposite float lifts; three floats)`, sym: `P_{${f.id}}`, eq: heavy ? '\\frac{V(|u| + |v|)}{2}' : sameEnd ? '\\frac{V(1 \\minus |v|)}{2}' : '\\frac{V(1 \\minus |u|)}{2}', sub: heavy ? `\\frac{${tx(s.V, 0)}(${tx(au, 4)} + ${tx(av, 4)})}{2}` : sameEnd ? `\\frac{${tx(s.V, 0)}(1 \\minus ${tx(av, 4)})}{2}` : `\\frac{${tx(s.V, 0)}(1 \\minus ${tx(au, 4)})}{2}`, value: m.load, unit: 'lb', d: 0, ref: REF.rigid })); }
      return L;
    }
    const T = s.bound ? s.T[m.i] : s.d.T[m.i], Ys = s.bound ? s.at[m.i].Y : s.Y, Xs = s.bound ? s.ex : s.X, sg = TRACKS[m.i].sy;
    L.push(st(pre, { id: 'Vt', label: `${m.name} load (statics about the track centre lines, gauge g = ${fmt(S.g, 2)} ft)`, sym: `V_{${TRACKS[m.i].id}}`, eq: `V\\left(\\frac{1}{2} ${sg > 0 ? '+' : '\\minus'} \\frac{Y}{g}\\right)`, sub: `${tx(s.V, 0)}\\left(\\frac{1}{2} ${sg > 0 ? '+' : '\\minus'} \\frac{${tp(Ys, 3)}}{${tx(S.g, 2)}}\\right)`, value: T.Vt, unit: 'lb', d: 0, ref: REF.track }),
      st(pre, { id: 'e', label: `Eccentricity along the track (the same for both tracks; L_t = ${fmt(S.Lt, 2)} ft, kern L_t/6 = ${fmt(S.Lt / 6, 3)} ft)`, sym: 'e', eq: s.bound ? '\\max|X|' : 'X', sub: tx(Xs, 3), value: Math.abs(Xs), unit: 'ft', d: 3 }));
    if (!T.stable) L.push(st(pre, { id: 'q', label: 'Track pressure: the resultant reaches the track end (not stable / not bounded)', sym: 'q_{max}', eq: '', sub: '', value: '∞', unit: 'psf', d: 0 }));
    else if (!T.tri) L.push(st(pre, { id: 'q', label: `Track pressure, inside the kern (|e| ≤ L_t/6), shoe s = ${fmt(S.s, 2)} ft`, sym: 'q_{max}', eq: '\\frac{V_{t}}{s L_{t}}\\left(1 + \\frac{6|e|}{L_{t}}\\right)', sub: `\\frac{${tx(T.Vt, 0)}}{${tx(S.s, 2)} \\cdot ${tx(S.Lt, 2)}}\\left(1 + \\frac{6 \\cdot ${tx(Math.abs(Xs), 3)}}{${tx(S.Lt, 2)}}\\right)`, value: T.q1, unit: 'psf', d: 0, ref: REF.track, note: `q_min = ${fmt(T.q2, 0)} psf` }));
    else L.push(st(pre, { id: 'Lb', label: 'Bearing length, outside the kern (triangular pressure)', sym: 'L_{b}', eq: '3\\left(\\frac{L_{t}}{2} \\minus |e|\\right)', sub: `3\\left(\\frac{${tx(S.Lt, 2)}}{2} \\minus ${tx(Math.abs(Xs), 3)}\\right)`, value: T.Lb, unit: 'ft', d: 3, ref: REF.track }),
      st(pre, { id: 'q', label: `Track pressure, triangular, shoe s = ${fmt(S.s, 2)} ft`, sym: 'q_{max}', eq: '\\frac{2 V_{t}}{s L_{b}}', sub: `\\frac{2 \\cdot ${tx(T.Vt, 0)}}{${tx(S.s, 2)} \\cdot ${tx(T.Lb, 3)}}`, value: T.q1, unit: 'psf', d: 0, ref: REF.track }));
    return L;
  }
  /* ---------- stress at depth ---------- */
  const toLocal = (setup, p) => { const h = rad(setup.heading || 0), dx = p.x - setup.x, dy = p.y - setup.y; return { x: dx * Math.sin(h) + dy * Math.cos(h), y: -dx * Math.cos(h) + dy * Math.sin(h) }; };
  function depthOf(it, setup) { if (isNum(it.depth) && it.depth > 0) return { z: it.depth, from: 'depth to top entered' }; if (isNum(it.topEl)) { const pad = isNum(setup.pad) ? setup.pad : 0, z = pad - it.topEl; if (z > 0) return { z, from: `pad el. ${fmt(pad, 2)} − top el. ${fmt(it.topEl, 2)}` }; } return null; }
  /* the loaded areas of a sample (crane frame): [{ kind, x, y, B (along x), L (along y), q (psf) } | track { y, B (width), L (length), q0, gy, tri }] */
  function areasOf(out, s, j) {
    const S = out.S, mat = out.mat;
    if (S.kind === 'wheeled') return S.items.map((f, i) => { const P = s.load[i], b = bearingArea(S, mat); return { x: f.lx, y: f.ly, Bx: b.Bx, By: b.By, q: P / (b.Bx * b.By), P }; });
    return S.items.map((t, i) => {
      const width = bearingArea(S, mat).Bx, sc = S.s / width;
      if (s.bound) { const V = s.load[i]; return [-1, 0, 1].map(sg => { const T = trackP(V, sg * s.ex, S.Lt, S.s); return { track: true, y: t.ly, B: width, L: S.Lt, q0: T.q0 * sc, gy: T.gy * sc, tri: T.tri, ok: T.stable }; }); }
      const T = s.d.T[i]; return [{ track: true, y: t.ly, B: width, L: S.Lt, q0: T.q0 * sc, gy: T.gy * sc, tri: T.tri, ok: T.stable }];
    });
  }
  function bearingArea(S, mat) {
    const t = (mat.t || 0) * U.ftPerIn, ok = mat.type !== 'none' && mat.t > 0 && mat.B > 0;
    if (S.kind === 'wheeled') { const a = S.f * Math.sqrt(Math.PI) / 2; if (ok && mat.L > 0) return { Bx: Math.min(mat.B, a + 2 * mat.k * t), By: Math.min(mat.L, a + 2 * mat.k * t) }; return { Bx: a, By: a }; }
    return { Bx: ok ? Math.min(mat.B, S.s + 2 * mat.k * t) : S.s };
  }
  function stressAt(areas, p, z) {
    const bq = BQ(); let sum = 0;
    areas.forEach(a => {
      if (Array.isArray(a)) { sum += Math.max(...a.map(t => trackStress(bq, t, p, z))); return; }
      if (a.track) { sum += trackStress(bq, a, p, z); return; }
      sum += bq.uniformRect(a.q / 1000, a.Bx, a.By, p.x - a.x, p.y - a.y, z) * 1000;
    });
    return sum;
  }
  function trackStress(bq, t, p, z) {   // footing frame: x across the track (B), y along it (L)
    if (!t.ok) return Infinity;
    const ld = { B: t.B, L: t.L, q0: t.q0 / 1000, gx: 0, gy: t.gy / 1000, mode: t.tri ? 'partial' : 'full' };
    return bq.stress(ld, p.y - t.y, p.x, z).value * 1000;
  }
  function samplePts(it, setup, out, z) {
    const loc = it.pts.map(q => toLocal(setup, q)), sup = out.S.items.map(s => ({ x: s.lx, y: s.ly })), R0 = Math.max(...sup.map(s => Math.hypot(s.x, s.y)), out.S.kind === 'crawler' ? out.S.Lt / 2 : 0), lim = R0 + 5 * z + 20;
    const h = Math.max(z / 3, 0.5), pts = [], segs = [];
    for (let i = 0; i < loc.length - 1 + (it.closed ? 1 : 0); i++) segs.push([loc[i], loc[(i + 1) % loc.length]]);
    segs.forEach(([a, b]) => { const L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.min(400, Math.max(1, Math.ceil(L / h)));
      for (let k = 0; k <= n; k++) { const q = { x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n }; if (Math.hypot(q.x, q.y) <= lim) pts.push(q); }
      sup.forEach(s => { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, ((s.x - a.x) * dx + (s.y - a.y) * dy) / L2)) : 0; pts.push({ x: a.x + t * dx, y: a.y + t * dy }); }); });
    if (it.closed && loc.length >= 3) sup.forEach(s => { if (inPoly(s, loc)) pts.push({ x: s.x, y: s.y }); });
    return pts;
  }
  function inPoly(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; }
  function depthAll(out, crane, setup, P, idp) {
    if (!BQ()) return [];
    const items = ((P && P.items) || []).filter(i => i.type === 'util'), caps = (P && P.ground && P.ground.caps) || {};
    const js = [...new Set([0, out.samples.length - 1].concat(out.max.map(m => m.j)))];
    return items.map(it => {
      const dz = depthOf(it, setup), cap = isNum(caps[it.id]) && caps[it.id] > 0 ? caps[it.id] : null, name = it.name || 'utility';
      if (!dz) return { id: it.id, name, kind: it.kind, none: 'enter the depth to top (or the top elevation) of the item (Site items tab)', cap };
      const pts = samplePts(it, setup, out, dz.z); let best = null;
      js.forEach(j => { const s = out.samples[j], ar = areasOf(out, s, j); pts.forEach(p => { const v = stressAt(ar, p, dz.z); if (!best || v > best.ds) best = { ds: v, j, p }; }); });
      if (!best) return { id: it.id, name, kind: it.kind, z: dz.z, zFrom: dz.from, ds: 0, far: true, cap, ratio: cap ? 0 : null };
      const s = out.samples[best.j], ar = areasOf(out, s, best.j), steps = depthSteps(out, ar, best.p, dz, `${idp}.z.${it.id}`, s, name);
      return { id: it.id, name, kind: it.kind, z: dz.z, zFrom: dz.from, ds: best.ds, theta: s.theta, p: best.p, cap, ratio: cap ? best.ds / cap : null, steps, n: pts.length };
    });
  }
  function depthSteps(out, ar, p, dz, pre, s, name) {
    const L = [st(pre, { id: 'z', label: `Depth to the top of "${name}" (${dz.from})`, sym: 'z', eq: '', sub: '', value: dz.z, unit: 'ft', d: 2 }),
      st(pre, { id: 'pt', label: `Governing point on the item (crane frame: x forward, y left), at slew angle ${fmt(s.theta, 1)}°`, sym: '(x,\\,y)', eq: '', sub: '', value: `(${fmt(p.x, 2)}, ${fmt(p.y, 2)})`, unit: 'ft', d: 2 })];
    const parts = [];
    out.S.items.forEach((it, i) => {
      const a = ar[i];
      if (out.S.kind === 'wheeled') {
        const q = BQ().querySteps({ B: a.Bx, L: a.By, q0: a.q / 1000, gx: 0, gy: 0 }, p.x - a.x, p.y - a.y, dz.z, {});
        L.push(st(pre, { id: 'q' + it.id, label: `${it.name}: pressure over ${fmt(a.Bx, 3)} × ${fmt(a.By, 3)} ft (${out.mat.type === 'none' ? 'the float as the equal-area square' : 'the mat\'s effective area'})`, sym: `q_{${it.id}}`, eq: '\\frac{P}{B_{x} B_{y}}', sub: `\\frac{${tx(a.P, 0)}}{${tx(a.Bx, 3)} \\cdot ${tx(a.By, 3)}}`, value: a.q / 1000, unit: 'ksf', d: 3 }));
        q.steps.forEach(x => L.push(Object.assign({}, x, { id: `${pre}.${it.id}.${x.id}`, label: `${it.name}: ${x.label}`, ref: x.ref || '' })));
        parts.push({ id: it.id, v: q.result.value });
      } else {
        const t = Array.isArray(a) ? a.reduce((b, c) => (trackStress(BQ(), c, p, dz.z) > trackStress(BQ(), b, p, dz.z) ? c : b)) : a;
        const v = trackStress(BQ(), t, p, dz.z) / 1000;
        L.push(st(pre, { id: 'd' + it.id, label: `${it.name}: ${fmt(t.B, 3)} ft wide × ${fmt(t.L, 2)} ft long, pressure ${fmt(t.q0, 0)} ${t.gy < 0 ? '−' : '+'} ${fmt(Math.abs(t.gy), 2)}·η psf (η along the track from its centre${t.tri ? '; triangular: the negative part cut off' : ''})${out.samples[0].bound ? ', the most unfavourable of e = −, 0, + max|X|' : ''}`, sym: `\\Delta\\sigma_{z,${it.id}}`, eq: t.tri ? '\\text{polygon integration}' : 'q(x,y) I_{u} + g_{y} J_{v}', sub: '', value: v, unit: 'ksf', d: 3, ref: REF.bq }));
        parts.push({ id: it.id, v });
      }
    });
    const tot = parts.reduce((s2, x) => s2 + x.v, 0);
    L.push(st(pre, { id: 'sum', label: 'Vertical stress increase at the item (sum of the supports)', sym: '\\Delta\\sigma_{z}', eq: '\\sum \\Delta\\sigma_{z,i}', sub: parts.map(x => tx(x.v, 3)).join(' + '), value: tot, unit: 'ksf', d: 3, ref: REF.bq, note: `${fmt(tot * 1000, 0)} psf` }));
    return L;
  }
  /* ---------- C5: stress at depth from two setups together (a tandem lift) ----------
     depthPair(outs, setups, P, idp): outs = [GR.evaluate(crane 1, …, { pts: crane 1's hooks at the lift's steps }), the same for crane 2],
     the two evaluated over the same steps (step j of one with step j of the other: the cranes carry the girder together). For every
     buried utility / culvert / wall: Δσ_z(p) = Σ over both setups' supports at step j (superposition of the Boussinesq solutions; each
     crane's loads at its own depth z_i below its pad, depthOf), at the union of both setups' sample points (samplePts), at the steps
     where any support of either crane governs, the first and the last step; the largest sum governs. */
  const toGrid = (setup, q) => { const h = rad(setup.heading || 0); return { x: setup.x + q.x * Math.sin(h) - q.y * Math.cos(h), y: setup.y + q.x * Math.cos(h) + q.y * Math.sin(h) }; };
  function depthPair(outs, setups, P, idp) {
    idp = idp || 'gr2';
    if (!BQ() || outs.length !== 2 || outs.some(o => !o || o.mode === 'none' || !o.samples)) return [];
    const items = ((P && P.items) || []).filter(i => i.type === 'util'), caps = (P && P.ground && P.ground.caps) || {}, n = Math.min(outs[0].samples.length, outs[1].samples.length);
    const js = [...new Set([0, n - 1].concat(...outs.map(o => o.max.map(m => m.j))))].filter(j => j < n);
    return items.map(it => {
      const dz = setups.map(u => depthOf(it, u)), cap = isNum(caps[it.id]) && caps[it.id] > 0 ? caps[it.id] : null, name = it.name || 'utility';
      if (!dz[0] || !dz[1]) return { id: it.id, name, kind: it.kind, none: 'enter the depth to top (or the top elevation) of the item (Site items tab)', cap };
      const pts = [].concat(...outs.map((o, i) => samplePts(it, setups[i], o, dz[i].z).map(q => toGrid(setups[i], q))));
      let best = null;
      js.forEach(j => { const ar = outs.map((o, i) => areasOf(o, o.samples[j], j));
        pts.forEach(p => { const v = outs.map((o, i) => stressAt(ar[i], toLocal(setups[i], p), dz[i].z)), sum = v[0] + v[1]; if (!best || sum > best.ds) best = { ds: sum, v, j, p }; }); });
      if (!best) return { id: it.id, name, kind: it.kind, z: dz.map(d => d.z), ds: 0, far: true, cap, ratio: cap ? 0 : null };
      const steps = [];
      outs.forEach((o, i) => { const s = o.samples[best.j], ar = areasOf(o, s, best.j);
        steps.push(...depthSteps(o, ar, toLocal(setups[i], best.p), dz[i], `${idp}.z.${it.id}.c${i + 1}`, s, name).map(x => Object.assign({}, x, { label: `Crane ${i + 1}: ${x.label}` }))); });
      steps.push(st(`${idp}.z.${it.id}`, { id: 'sum2', label: `Vertical stress increase at "${name}" from both cranes' supports together (superposition), at grid (${fmt(best.p.x, 2)}, ${fmt(best.p.y, 2)})`, sym: '\\Delta\\sigma_{z}', eq: '\\Delta\\sigma_{z,1} + \\Delta\\sigma_{z,2}', sub: `${tx(best.v[0] / 1000, 3)} + ${tx(best.v[1] / 1000, 3)}`, value: best.ds / 1000, unit: 'ksf', d: 3, ref: REF.bq, note: `${fmt(best.ds, 0)} psf` }));
      if (cap) steps.push(st(`${idp}.z.${it.id}`, { id: 'r2', label: 'Ratio to the entered allowable stress increase', sym: '\\frac{\\Delta\\sigma_{z}}{\\Delta\\sigma_{a}}', eq: '', sub: `\\frac{${tx(best.ds, 0)}}{${tx(cap, 0)}}`, value: best.ds / cap, d: 3, note: best.ds <= cap ? 'OK' : 'OVER the allowable' }));
      return { id: it.id, name, kind: it.kind, z: dz.map(d => d.z), ds: best.ds, parts: best.v, j: best.j, p: best.p, cap, ratio: cap ? best.ds / cap : null, steps, n: pts.length };
    });
  }
  /* a setup's map labels: for each support, the largest over the setup's picks */
  function setupSummary(crane, setup, picks, P) {
    const evs = picks.map(k => ({ k, g: evaluate(crane, setup, k, P, 'gr') })).filter(x => x.g.mode !== 'none');
    if (!evs.length) return null;
    const S = evs[0].g.S, isTr = S.kind === 'crawler';
    const sup = S.items.map((it, i) => { let best = null; evs.forEach(x => { const m = x.g.max[i], v = isTr ? m.q : m.load; if (!best || v > best.v) best = { v, m, b: x.g.bear[i], k: x.k, g: x.g }; }); return Object.assign({ it }, best); });
    return { S, sup, mode: evs.some(x => x.g.mode === 'estimate') ? 'estimate' : 'rigid', qa: evs[0].g.qa, evs };
  }
  window.CranePickGround = { U, DEF, MAT_TYPES, FLOATS, TRACKS, REF, inputsOf, supports, parts, resultant, floatDist, trackP, trackDist, rigidAt, boundAt, boundCandidates, restBox, matOf, bearing, bearingArea, evaluate, stressAt, depthOf, toLocal, toGrid, depthPair, setupSummary, fileGross };
})();
