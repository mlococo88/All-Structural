/* apps/crane-pick/engine/route.js — the trucking route: path, vehicle, swept path, overhead clearances, haul-road bearing, posted bridges,
   staging (window.CranePickRoute). Classic script, no DOM. C6 (2026-11-16). Uses engine/geo.js, osha.js, lift.js, ground.js (read at
   call time). Positions: the site frame (grid ft, x east, y north). Angles inside: radians, counter-clockwise from grid east.
   Units: ft, lb (tons = short tons of 2,000 lb, as bridge postings), psf, tyre contact area in².

   route = { id, name, pts: [{ x, y }] (drawn by the user: the path of the TRACTOR'S FRONT (STEER) AXLE CENTRE, from the site entrance
             or last public road to the truck stop for the pick), rad: [ft | null per vertex] (the curve radius at each interior vertex;
             null = rDef), rDef (ft), veh, load, tyre, axIn, pickId (the C2 pick this delivery is for: staging), tandemId (the C5 girder lift whose
             girder is the load: staging at its pick pose), endA ('front' | 'rear': where the girder's end A is on the truck), stageTol (ft),
             margin (ft), at (ft along the route where the vehicle is drawn; null = the stop) }
   veh = { type: 'semi' | 'stretch' | 'dolly' | 'jeep', L1 (tractor wheelbase: steer axle to drive-group centre), e (kingpin / fifth
           wheel ahead (+) of the drive-group centre), fo (tractor front overhang ahead of the steer axle), ro (tractor rear overhang
           behind the drive-group centre), Wt (tractor width), L2 (body wheelbase: kingpin (or jeep bolster) to the trailer's rear
           axle-group centre or the rear dolly's pivot), Wb (trailer / dolly width), dF (deck ahead of the kingpin), dR (deck behind the rear
           group), Lj (jeep: kingpin to jeep axle-group centre), ej (jeep bolster ahead (+) of its axle group), Ld (dolly length, drawn),
           k (effective steering ratio of the rear dolly, 0 … 1), dmax (deg, the dolly's largest steer angle), Rmin (ft, the vehicle's
           minimum turning radius, steer-axle centre path), hDeck (deck / bolster height above the road), weights: Wtr (tractor tare, lb)
           xt (its CG behind the steer axle), Wtl (trailer tare) xtl (its CG behind the kingpin), Wj (jeep tare, at its axle), Wd (rear
           dolly tare, at its pivot); axles: nS, nD, nJ, nR (axles per group), tS, tD, tJ, tR (tyres per axle) }
   load = { L (length), W (weight, lb), B (width), r (rear overhang behind the rear group / dolly pivot), cg (CG from the load's front
           end; null = L / 2), h (load height above the deck) }      linked to a C5 girder lift: L, W, B, h, cg from its girder object
   tyre = { A (contact area per tyre, in²) }    axIn = { on, S, D, J, R } (entered axle-group loads, lb)
   mark (route marks, P.routeMarks) = { id, type: 'overhead' | 'haul' | 'bridge', name, pts, h (overhead: clearance height above the
           road, ft), w (overhead point: radius; haul road / bridge: width, ft), qa (haul: allowable bearing, psf), mat (haul: as C4's mat
           { type, B, L, t, Fb, Fv, E, Fy, gamma, k }), post: { gross, axle, tLabel, tTons } (bridge: tons) }

   2026-11-17 (fitted alignment): route.mode = 'fit' (absent = the legacy "each vertex is a turn" path below, unchanged); route.al = the
           alignment fitted to route.pts (engine/align.js: PIs, radius and kind ('curve' | 'turn') per PI); route.src = { kind: 'click' |
           'trace' | 'osm', at (fetch date), names: [{ name, s0, s1 }], against: [{ name, s0, s1 }] (one-way roads travelled against
           their direction), cl (the OSM road centreline), snaps } (OSM: engine/osm.js); route.lane = { on, w } (the travel-lane offset
           of the OSM centreline: w / 2 to the right). In 'fit' mode route.pts is the line the alignment is fitted to (the clicks, the
           trace or the OSM path, after the lane offset) and the path is built from route.al (pathAl, method 1b).
   Methods (CLAUDE.md §4: new calculation; Decisions pending engineer review):
   1. Path: straight tangents between the drawn vertices, joined at each interior vertex by a circular curve of radius r (entered per
      vertex, else rDef): deflection Δ (signed, + left), tangent length T = r tan(|Δ|/2); T is limited to the available tangent (half of
      a segment shared by two curves, the whole of an end segment) and r reduced to T / tan(|Δ|/2) (flagged).
   2. Kinematic (low-speed, no tyre slip) off-tracking model: every unit's rear axle (group centre) moves along the unit's axis (a steered
      axle along the axis turned by its steer angle δ). Unit with hitch H (moving at v_H) and rear axle at distance L behind it, heading
      θ (n = left normal):  dθ/ds = (v_H · n_δ) / (L cos δ),  n_δ = left normal of (θ + δ). Tractor: H = the steer axle (on the path,
      v = the path tangent), δ = 0. A point at distance a ahead of the rear axle moves at v_H − (L − a) θ' n. Integrated along the path
      with RK4, 0.25 ft steps; the vehicle starts straight on the first tangent. This is the standard kinematic tractor-trailer
      off-tracking model (bicycle model; e.g. SAE J695 "Turning Ability and Off Tracking — Motor Vehicles"; NCHRP Report 505 (2003),
      "Review of Truck Characteristics as Factors in Roadway Design", ch. 3, off-tracking; the AASHTO Green Book (A Policy on Geometric
      Design of Highways and Streets, 7th Ed. 2018) §2.1.4 design-vehicle turning paths are drawn from the same kinematics). Paraphrased.
      Rear dolly (types dolly / jeep): its own unit at the body's rear pivot D, steered δ = −k γ (γ = articulation between the unit ahead
      (tractor or jeep) and the body; |δ| ≤ δ_max): k = 0 unsteered, k ≈ 1 the rear nearly tracks the front (Decision pending engineer
      review: a proportional steering law stands for hydraulic or steerman steering; enter the dolly maker's ratio).
      Steady state on a radius R (closed form, the unsteered chain): R_T² = R² − L1², R_K² = R_T² + e², (jeep: R_J² = R_K² − Lj²,
      R_B² = R_J² + ej²), R_D² = R_H² − L2²; off-tracking OT = R − R_D. Steered rear (δ): in the body's frame (H at 0, D at (−L2, 0)),
      the turn centre O = (o_x, o_y): o_x = −L2 − o_y tan δ, o_x² + o_y² = R_H², R_D = o_y / cos δ; δ = −k γ solved by iteration.
   3. Swept path: the outlines of the tractor (front bumper to rear), jeep, trailer deck / rear dolly and the load (length, width, front /
      rear overhang) at every 1 ft of travel; their union is drawn. Off-tracking at a step = the distance of the rear axle-group centre
      (dolly pivot) from the steer-axle path. Per turn (from the curve's start to one vehicle length past its end): max off-tracking, the
      inside radius (least distance from the curve's centre to any outline), the outside radius (largest, incl. the load's swing-out),
      swept width = outside − inside. A turn with r < R_min is flagged (stop).
   4. Conflicts (plan): any outline overlapping an obstruction (stop), an exclusion zone (stop), a crane footprint (stop); inside a power
      line's plan buffer (29 CFR 1926.1408 Table A D_min, warn: the vertical check governs); over a buried utility (info).
   5. Overhead: load top H_top = h_deck + h_load. A route mark (point within its radius, or a line) reached by the outline: available
      c = h − H_top, flagged when c < margin. Power lines (site items): horizontal distance d_h (outline to the wire's plan line, less
      the sway allowance), vertical d_v = max(0, h_wire − sag − H_top), d = √(d_h² + d_v²) (d = d_h when the wire is below the load top),
      compared with Table T D_T (29 CFR 1926.1411): stop when d < D_T; a dedicated spotter when d < 20 ft (1926.1411(b)(4)).
   6. Axle-group loads by statics (or entered): body: R_rear = (W_tl x_tl + W_L x_L)/L2 (+ W_d at the dolly), R_H = W_tl + W_L − R_rear;
      jeep: R_J = (R_H (Lj − ej) + W_j Lj)/Lj, R_K = R_H + W_j − R_J; tractor: R_drive = (W_tr x_t + R_K (L1 − e))/L1,
      R_steer = W_tr + R_K − R_drive. x_L = c_L − f (load CG behind the hitch), f = L − L2 − r (the load's front ahead of the hitch).
      Per axle = group / n; per tyre = group / (n × tyres per axle).
   7. Haul road (marks 'haul', a corridor of width w along its line): when the steer-axle path enters it, the heaviest tyre is checked
      (C4's engine/ground.js bearing(): the tyre contact area A as an equal-area round "float" f = √(4A/π), so the square side
      a = √A; with a mat: spread at k : 1 through it, its weight; q_g vs q_a). Tyres one at a time (Decision pending engineer review:
      overlapping spread under closely spaced tyres is not combined).
   8. Posted bridges (marks 'bridge'): on the route when the steer-axle path comes within w/2 of the bridge line; gross weight vs the
      gross posting and the vehicle-type posting; the heaviest single axle vs the axle posting (tons × 2,000 lb).
   9. Staging: the vehicle's pose at the end of the route. A C5 girder lift: the girder's mid-length point c = H + (f − L/2) û and its
      end-A→B heading at the stop against the lift's pick pose (offset ≤ stageTol, heading within 2°, warn; Decision pending engineer
      review), and both cranes at the pick pose (the C5 evaluation's first step: % of chart). A C2 pick: the load CG (x_L behind the
      hitch) against the pick point (offset ≤ stageTol) and the pick crane's chart at that radius (engine/lift.js evalAt with the pick's W).
      Turnaround: information only. */
(function () {
  'use strict';
  const G = () => window.CranePickGeo, O = () => window.CranePickOSHA, LF = () => window.CranePickLift, GR = () => window.CranePickGround;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const n0 = v => isNum(v) ? v : 0;
  const tx = (x, d) => { if (x === Infinity) return '\\infty'; if (!isNum(x)) return String(x); const s = Math.abs(x).toFixed(d), [i, p] = s.split('.'); return (x < 0 && Number(s) !== 0 ? '\\minus ' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '{,}') + (p ? '.' + p : ''); };
  const tp = (x, d) => { const t = tx(x, d); return t.indexOf('\\minus') === 0 ? '(' + t + ')' : t; };
  const fmt = (v, d) => isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const st = (pre, o) => Object.assign({ unit: '', d: 2, ref: '', note: '', eq: '', sub: '' }, o, { id: pre + '.' + o.id });
  const DEG = Math.PI / 180;
  const LB_PER_TON = 2000, IN2_PER_FT2 = 144;
  const REF = { ot: 'kinematic off-tracking (SAE J695; NCHRP Report 505, 2003, ch. 3; AASHTO Green Book 7th Ed. 2018 §2.1.4)', t: '29 CFR 1926.1411 Table T', a: '29 CFR 1926.1408 Table A', statics: 'statics (moments about the hitch / axle)' };
  const TYPES = { semi: 'Tractor + semi-trailer', stretch: 'Tractor + stretch (extendable) trailer', dolly: 'Tractor + load + steerable rear dolly', jeep: 'Tractor + jeep + load + steerable rear dolly' };
  const VDEF = { type: 'semi', L1: 20, e: 1, fo: 4, ro: 3, Wt: 8.5, L2: 40, Wb: 8.5, dF: 3, dR: 4, Lj: 10, ej: 0, Ld: 12, k: 0, dmax: 45, Rmin: 45, hDeck: 5,
    Wtr: 20000, xt: 8, Wtl: 15000, xtl: 25, Wj: 8000, Wd: 12000, nS: 1, nD: 2, nJ: 2, nR: 3, tS: 2, tD: 4, tJ: 4, tR: 4 };
  const LDEF = { L: 50, W: 40000, B: 8, r: 2, cg: null, h: 6 };
  const RDEF = 50, STEP = 0.25, SAMPLE = 1;
  const steered = v => v.type === 'dolly' || v.type === 'jeep';
  const hasJeep = v => v.type === 'jeep';
  /* vehOf / loadOf: the inputs with the defaults filled (null / missing = default; the "from" lists what was assumed) */
  function vehOf(r) { const v = Object.assign({}, VDEF), src = (r && r.veh) || {}, from = {}; Object.keys(VDEF).forEach(k => { if (k === 'type') { v.type = TYPES[src.type] ? src.type : VDEF.type; return; } if (isNum(src[k])) v[k] = src[k]; else from[k] = 'default'; });
    if (!steered(v)) { v.k = 0; } v.k = Math.max(0, Math.min(1, v.k)); v.from = from; return v; }
  /* loadOf(r, P): the load; linked to a C5 girder lift (r.tandemId) its length, weight, width, depth and CG come from that girder object
     (engine/tandem.js object(): a pair of girders with cross-frames as one load); r.endA: 'front' (end A toward the tractor, default) or
     'rear'. The rear overhang stays a route input (how the load sits on the trailer). */
  function tandemOf(r, P) { return r && r.tandemId && P && (P.tandems || []).find(t => t.id === r.tandemId) || null; }
  function loadOf(r, P) {
    const l = Object.assign({}, LDEF), src = (r && r.load) || {}; Object.keys(LDEF).forEach(k => { if (isNum(src[k])) l[k] = src[k]; });
    const t = tandemOf(r, P), T = window.CranePickTandem;
    if (t && T) { const ob = T.object(t); l.L = ob.L; l.W = ob.Wg; l.B = Math.max(ob.tmax - ob.tmin, 0.5); l.h = ob.H > 0 ? ob.H : l.h; l.endA = r.endA === 'rear' ? 'rear' : 'front';
      l.cg = l.endA === 'front' ? ob.xcg : ob.L - ob.xcg; l.tcg = ob.tcg; l.from = `girder lift "${t.name}"`; l.tandem = t; l.ob = ob; return l; }
    if (!isNum(l.cg)) l.cg = l.L / 2; l.from = 'entered'; return l; }
  /* ---------- 1. the path ---------- */
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y }), add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y }), mul = (a, k) => ({ x: a.x * k, y: a.y * k });
  const len = a => Math.hypot(a.x, a.y), unit = a => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l }; }, left = a => ({ x: -a.y, y: a.x });
  const U = th => ({ x: Math.cos(th), y: Math.sin(th) }), N = th => ({ x: -Math.sin(th), y: Math.cos(th) }), dot = (a, b) => a.x * b.x + a.y * b.y;
  /* ---------- 1b. the fitted alignment (route.mode 'fit', 2026-11-17; engine/align.js fits route.al from the drawn line) ----------
     The same tangent–curve construction on the alignment's PIs with each PI's radius (al.rad; null = the route default rDef). T is
     limited where two curves share a tangent: when T_i + T_i+1 > the tangent's length both are scaled down in proportion (an end
     tangent: its whole length), and r = T / tan(|Δ|/2) (flagged). Legacy routes (no mode) keep path() below exactly as before. */
  const fitted = r => !!(r && r.mode === 'fit' && r.al && Array.isArray(r.al.pis) && r.al.pis.length >= 2);
  const KIND_LBL = { curve: 'Curve', turn: 'Intersection turn' };
  function pathAl(r) {
    const al = r.al, pts = al.pis, n = pts.length, rDef = isNum(r.rDef) && r.rDef > 0 ? r.rDef : RDEF, segs = [], turns = [];
    const L = []; for (let i = 0; i < n - 1; i++) L.push(G().dist(pts[i], pts[i + 1]));
    const q = [null];
    for (let i = 1; i < n - 1; i++) {
      const ui = unit(sub(pts[i], pts[i - 1])), uo = unit(sub(pts[i + 1], pts[i])), cr = ui.x * uo.y - ui.y * uo.x, D = Math.atan2(cr, dot(ui, uo));
      if (Math.abs(D) < 0.5 * DEG || L[i - 1] < 1e-6 || L[i] < 1e-6) { q.push(null); continue; }
      const kind = al.kind && al.kind[i] === 'turn' ? 'turn' : 'curve', has = isNum(al.rad && al.rad[i]) && al.rad[i] > 0, rq = has ? al.rad[i] : rDef, f = al.fit && al.fit[i];
      const from = !has ? 'route default' : kind === 'curve' && f && isNum(f.R0) && Math.abs(f.R0 - rq) < 1e-9 ? 'fitted to the line' : 'entered';
      q.push({ i, D, ui, uo, rq, Treq: rq * Math.tan(Math.abs(D) / 2), kind, from, fit: f || null });
    }
    q.push(null);
    const fac = []; for (let j = 0; j < n - 1; j++) { const a = q[j] ? q[j].Treq : 0, b = q[j + 1] ? q[j + 1].Treq : 0; fac.push(a + b > L[j] ? L[j] / (a + b) : 1); }
    const corner = [];
    for (let i = 1; i < n - 1; i++) {
      const c = q[i]; if (!c) { corner.push(null); continue; }
      const t = Math.tan(Math.abs(c.D) / 2), k = Math.min(fac[i - 1], fac[i]); let T = c.Treq, rr = c.rq, reduced = false; if (k < 1 - 1e-12) { T = c.Treq * k; rr = T / t; reduced = true; }
      const A = sub(pts[i], mul(c.ui, T)), B = add(pts[i], mul(c.uo, T)), cc = add(A, mul(left(c.ui), Math.sign(c.D) * rr));
      corner.push({ i, D: c.D, rq: c.rq, r: rr, T, reduced, A, B, c: cc, ui: c.ui, uo: c.uo, from: c.from, kind: c.kind, fit: c.fit, PI: pts[i] });
    }
    let s = 0, cur = pts[0];
    for (let i = 1; i < n; i++) {
      const cn = i < n - 1 ? corner[i - 1] : null, end = cn ? cn.A : pts[i];
      const ll = G().dist(cur, end); if (ll > 1e-9) { segs.push({ type: 'line', a: cur, b: end, th: Math.atan2(end.y - cur.y, end.x - cur.x), s0: s, L: ll }); s += ll; }
      if (cn) { const th0 = Math.atan2(cn.ui.y, cn.ui.x), La = cn.r * Math.abs(cn.D);
        segs.push({ type: 'arc', c: cn.c, r: cn.r, th0, dir: Math.sign(cn.D), D: cn.D, s0: s, L: La, a: cn.A, b: cn.B, turn: turns.length });
        const nn = turns.length + 1; turns.push(Object.assign({}, cn, { s0: s, s1: s + La, n: nn, lbl: `${KIND_LBL[cn.kind]} ${nn}`, tag: (cn.kind === 'turn' ? 'T' : 'C') + nn })); s += La; cur = cn.B; }
      else cur = pts[i];
    }
    return { segs, turns, L: s, ok: s > 0, fitted: true };
  }
  function path(r) {
    if (fitted(r)) return pathAl(r);
    const pts = (r && r.pts) || [], n = pts.length, rDef = isNum(r && r.rDef) && r.rDef > 0 ? r.rDef : RDEF, segs = [], turns = [];
    if (n < 2) return { segs, turns, L: 0, ok: false };
    const L = []; for (let i = 0; i < n - 1; i++) L.push(G().dist(pts[i], pts[i + 1]));
    const corner = [];
    for (let i = 1; i < n - 1; i++) {
      const ui = unit(sub(pts[i], pts[i - 1])), uo = unit(sub(pts[i + 1], pts[i])), cr = ui.x * uo.y - ui.y * uo.x, D = Math.atan2(cr, dot(ui, uo));
      const rq = isNum(r.rad && r.rad[i]) && r.rad[i] > 0 ? r.rad[i] : rDef;
      if (Math.abs(D) < 0.5 * DEG || L[i - 1] < 1e-6 || L[i] < 1e-6) { corner.push(null); continue; }
      const t = Math.tan(Math.abs(D) / 2), avail = Math.min(i - 1 === 0 ? L[0] : L[i - 1] / 2, i === n - 2 ? L[i] : L[i] / 2);
      let T = rq * t, rr = rq, reduced = false; if (T > avail) { T = avail; rr = T / t; reduced = true; }
      const A = sub(pts[i], mul(ui, T)), B = add(pts[i], mul(uo, T)), c = add(A, mul(left(ui), Math.sign(D) * rr));
      corner.push({ i, D, rq, r: rr, T, reduced, A, B, c, ui, uo, from: isNum(r.rad && r.rad[i]) && r.rad[i] > 0 ? 'entered' : 'route default' });
    }
    let s = 0, cur = pts[0];
    for (let i = 1; i < n; i++) {
      const cn = i < n - 1 ? corner[i - 1] : null, end = cn ? cn.A : pts[i];
      const ll = G().dist(cur, end); if (ll > 1e-9) { segs.push({ type: 'line', a: cur, b: end, th: Math.atan2(end.y - cur.y, end.x - cur.x), s0: s, L: ll }); s += ll; }
      if (cn) { const th0 = Math.atan2(cn.ui.y, cn.ui.x), La = cn.r * Math.abs(cn.D);
        segs.push({ type: 'arc', c: cn.c, r: cn.r, th0, dir: Math.sign(cn.D), D: cn.D, s0: s, L: La, a: cn.A, b: cn.B, turn: turns.length });
        turns.push(Object.assign({}, cn, { s0: s, s1: s + La, n: turns.length + 1 })); s += La; cur = cn.B; }
      else cur = pts[i];
    }
    return { segs, turns, L: s, ok: s > 0 };
  }
  /* the steer-axle point at arc length s: { x, y, th (heading), k (curvature, + left) } */
  function at(pa, s) {
    const segs = pa.segs; if (!segs.length) return null;
    s = Math.max(0, Math.min(pa.L, s));
    let lo = 0, hi = segs.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (s <= segs[m].s0 + segs[m].L + 1e-12) hi = m; else lo = m + 1; }   // the first segment that ends at or after s
    const g = segs[lo];
    const u = s - g.s0;
    if (g.type === 'line') { const d = U(g.th); return { x: g.a.x + d.x * u, y: g.a.y + d.y * u, th: g.th, k: 0 }; }
    const th = g.th0 + g.dir * u / g.r, rn = mul(N(g.th0 + g.dir * u / g.r), -g.dir * g.r);   // from the centre to the point: −dir·r·n(th)
    return { x: g.c.x + rn.x, y: g.c.y + rn.y, th, k: g.dir / g.r };
  }
  /* ---------- 2. kinematics ---------- */
  /* derivative of the headings (per ft of steer-axle travel) at the state q = { F, a (path heading), th1, thj, th2 } */
  function deltaOf(v, th1, thj, th2) { if (!steered(v)) return 0; const gma = ang((hasJeep(v) ? thj : th1) - th2), d = -v.k * gma, m = v.dmax * DEG; return Math.max(-m, Math.min(m, d)); }
  function ang(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
  function deriv(v, a, th1, thj, th2) {
    const vF = U(a), n1 = N(th1), w1 = dot(vF, n1) / v.L1;
    const vK = sub(vF, mul(n1, (v.L1 - v.e) * w1));
    let vH = vK, wj = 0;
    if (hasJeep(v)) { const nj = N(thj); wj = dot(vK, nj) / v.Lj; vH = sub(vK, mul(nj, (v.Lj - v.ej) * wj)); }
    const dl = deltaOf(v, th1, thj, th2), nd = N(th2 + dl), w2 = dot(vH, nd) / (v.L2 * Math.cos(dl));
    return [w1, wj, w2];
  }
  /* the vehicle's points at a state */
  function pose(v, F, th1, thj, th2) {
    const u1 = U(th1), T = sub(F, mul(u1, v.L1)), K = add(T, mul(u1, v.e));
    let H = K, J = null; if (hasJeep(v)) { const uj = U(thj); J = sub(K, mul(uj, v.Lj)); H = add(J, mul(uj, v.ej)); }
    const u2 = U(th2), D = sub(H, mul(u2, v.L2));
    return { F, T, K, J, H, D, th1, thj, th2, dl: deltaOf(v, th1, thj, th2) };
  }
  function rect(c0, c1, w) { const u = unit(sub(c0, c1)), nl = mul(left(u), w / 2); return [add(c0, nl), sub(c0, nl), sub(c1, nl), add(c1, nl)]; }
  /* the outlines at a pose: [{ part, poly }] */
  function outlines(v, l, p) {
    const u1 = U(p.th1), u2 = U(p.th2), out = [], f = l.L - v.L2 - l.r;
    out.push({ part: 'tractor', poly: rect(add(p.F, mul(u1, v.fo)), sub(p.T, mul(u1, v.ro)), v.Wt) });
    if (p.J) { const uj = U(p.thj); out.push({ part: 'jeep', poly: rect(add(p.K, mul(uj, 1)), sub(p.J, mul(uj, 3)), v.Wb) }); }
    if (steered(v)) { const ud = U(p.th2 + p.dl); out.push({ part: 'dolly', poly: rect(add(p.D, mul(ud, v.Ld / 2)), sub(p.D, mul(ud, v.Ld / 2)), v.Wb) }); }
    else out.push({ part: 'trailer', poly: rect(add(p.H, mul(u2, v.dF)), sub(p.D, mul(u2, v.dR)), v.Wb) });
    out.push({ part: 'load', poly: rect(add(p.H, mul(u2, f)), sub(p.D, mul(u2, l.r)), l.B) });
    return out;
  }
  /* simulate(route) -> { pa, v, l, samples: [{ s, p (pose), ot (off-tracking), parts }], end (pose), ok } */
  function simulate(r, o) {
    const STP = o && o.step > 0 ? o.step : STEP, v = vehOf(r), l = loadOf(r, o && o.P), pa = path(r);
    if (!pa.ok || !(v.L1 > 0) || !(v.L2 > 0) || (hasJeep(v) && !(v.Lj > 0))) return { pa, v, l, samples: [], ok: false, why: !pa.ok ? 'draw at least two points' : 'enter the wheelbases' };
    const a0 = at(pa, 0).th; let th1 = a0, thj = a0, th2 = a0, s = 0;
    const samples = [], push = () => { const q = at(pa, s), p = pose(v, { x: q.x, y: q.y }, th1, thj, th2); samples.push({ s, p, parts: outlines(v, l, p) }); };
    push(); let nextS = SAMPLE;
    const nSteps = Math.ceil(pa.L / STP);
    for (let k = 0; k < nSteps; k++) {
      const h = Math.min(STP, pa.L - s); if (h <= 0) break;
      const a = x => at(pa, x).th;
      const k1 = deriv(v, a(s), th1, thj, th2);
      const k2 = deriv(v, a(s + h / 2), th1 + h / 2 * k1[0], thj + h / 2 * k1[1], th2 + h / 2 * k1[2]);
      const k3 = deriv(v, a(s + h / 2), th1 + h / 2 * k2[0], thj + h / 2 * k2[1], th2 + h / 2 * k2[2]);
      const k4 = deriv(v, a(s + h), th1 + h * k3[0], thj + h * k3[1], th2 + h * k3[2]);
      th1 += h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); thj += h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]); th2 += h / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
      s += h;
      if (s >= nextS - 1e-9 || s >= pa.L - 1e-9) { push(); nextS += SAMPLE; }
    }
    // off-tracking: the rear point's distance from the steer-axle path (searched near where it is)
    const dense = [], q0 = at(pa, 0), u0 = U(q0.th), Lback = v.L1 + (hasJeep(v) ? v.Lj : 0) + v.L2 + 40;   // the approach: the first tangent extended back
    for (let x = -Lback; x < 0; x += 0.5) dense.push({ x: q0.x + u0.x * x, y: q0.y + u0.y * x, s: x });
    for (let x = 0; x <= pa.L + 1e-9; x += 0.5) { const q = at(pa, x); dense.push({ x: q.x, y: q.y, s: x }); }
    if (dense[dense.length - 1].s < pa.L) { const q = at(pa, pa.L); dense.push({ x: q.x, y: q.y, s: pa.L }); }
    const Ltot = v.L1 + (hasJeep(v) ? v.Lj : 0) + v.L2 + 20;
    // the nearest dense segment moves forward with the vehicle: search a window about the last one (± 40 ft), the whole path at the start
    const sd = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy; let t = L2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
    let iBest = -1;
    samples.forEach(q => { let d = Infinity, ib = iBest; const lo = iBest < 0 ? 1 : Math.max(1, iBest - 80), hi = iBest < 0 ? dense.length - 1 : Math.min(dense.length - 1, iBest + 80);
      for (let i = lo; i <= hi; i++) { const e = sd(q.p.D, dense[i - 1], dense[i]); if (e < d) { d = e; ib = i; } } q.ot = d; iBest = ib; });
    return { pa, v, l, samples, end: samples[samples.length - 1].p, ok: true, dense, Ltot };
  }
  /* ---------- steady state (closed form) ---------- */
  function steady(v, R) {
    v = Object.assign({}, VDEF, v);
    const RT2 = R * R - v.L1 * v.L1; if (RT2 <= 0) return null;
    const RT = Math.sqrt(RT2), RK = Math.sqrt(RT2 + v.e * v.e);
    let RH = RK, RJ = null; if (hasJeep(v)) { const j2 = RK * RK - v.Lj * v.Lj; if (j2 <= 0) return null; RJ = Math.sqrt(j2); RH = Math.sqrt(j2 + v.ej * v.ej); }
    if (!steered(v) || !(v.k > 0)) { const d2 = RH * RH - v.L2 * v.L2; if (d2 <= 0) return null; const RD = Math.sqrt(d2); return { RT, RK, RJ, RH, RD, OT: R - RD, dl: 0, gma: null }; }
    // steered rear: the front unit's angle at the hitch, then the body's centre with δ; iterate δ = −k γ
    const front = hasJeep(v) ? Math.atan2(v.ej, RJ) : Math.atan2(v.e, RT);   // the front unit's axis vs the tangent at the hitch
    let dl = 0, oy = 0, ox = 0;
    for (let it = 0; it < 200; it++) {
      const t = Math.tan(dl), A = 1 + t * t, B = 2 * v.L2 * t, C = v.L2 * v.L2 - RH * RH, disc = B * B - 4 * A * C; if (disc < 0) return null;
      oy = (-B + Math.sqrt(disc)) / (2 * A); ox = -v.L2 - oy * t;
      const tH = Math.atan2(-ox, oy), gma = tH - front, nd = Math.max(-v.dmax * DEG, Math.min(v.dmax * DEG, -v.k * gma));
      if (Math.abs(nd - dl) < 1e-13) { dl = nd; break; } dl = nd;
    }
    const RD = oy / Math.cos(dl); return { RT, RK, RJ, RH, RD, OT: R - RD, dl, gma: -dl / v.k };
  }
  /* ---------- 3. turns ---------- */
  function polyDist(c, poly) { return G().inside(c, poly) ? 0 : G().lineDist(c, poly, true); }
  function turnsOf(sim, idp) {
    const { pa, v, samples } = sim, out = [];
    pa.turns.forEach((t, k) => {
      const end = t.s1 + sim.Ltot, inT = samples.filter(q => q.s >= t.s0 - 1e-9 && q.s <= end + 1e-9);
      let ot = 0, otS = t.s0, Rin = Infinity, Rout = 0, inPart = '', outPart = '';
      // the radii are measured in the curve's sector (between the radii to its tangent points): outside it the vehicle is on a tangent
      const a0 = Math.atan2(t.A.y - t.c.y, t.A.x - t.c.x), sg = Math.sign(t.D), inSec = p => { const a = ang(Math.atan2(p.y - t.c.y, p.x - t.c.x) - a0) * sg; return a >= -1e-9 && a <= Math.abs(t.D) + 1e-9; };
      inT.forEach(q => { if (q.ot > ot) { ot = q.ot; otS = q.s; } q.parts.forEach(pp => { if (!pp.poly.some(inSec)) return; const d = polyDist(t.c, pp.poly); if (d < Rin) { Rin = d; inPart = pp.part; } pp.poly.forEach(c => { if (!inSec(c)) return; const e = G().dist(t.c, c); if (e > Rout) { Rout = e; outPart = pp.part; } }); }); });
      const ss = steady(v, t.r), pre = `${idp}.t${k + 1}`, steps = [];
      const nm = t.lbl || `Turn ${k + 1}`;
      steps.push(st(pre, { id: 'D', label: `${nm}: deflection at ${t.kind ? 'PI ' + t.i : 'vertex ' + (t.i + 1)} (+ left)`, sym: '\\Delta', eq: '\\text{atan2}(\\hat{u}_{in} \\times \\hat{u}_{out},\\; \\hat{u}_{in} \\cdot \\hat{u}_{out})', sub: '', value: t.D / DEG, unit: 'deg', d: 1 }),
        st(pre, { id: 'T', label: `Tangent length (radius ${fmt(t.rq, 1)} ft ${t.from})`, sym: 'T', eq: 'r \\tan\\frac{|\\Delta|}{2}', sub: `${tx(t.rq, 2)} \\tan\\frac{${tx(Math.abs(t.D) / DEG, 2)}°}{2}`, value: t.rq * Math.tan(Math.abs(t.D) / 2), unit: 'ft', d: 2,
          note: t.reduced ? `More than the tangent available (${fmt(t.T, 2)} ft): r reduced to T / tan(|Δ|/2) = ${fmt(t.r, 2)} ft.` : '' }));
      if (t.reduced) steps.push(st(pre, { id: 'r', label: 'Curve radius used (the tangent available governs)', sym: 'r', eq: '\\frac{T_{avail}}{\\tan(|\\Delta|/2)}', sub: `\\frac{${tx(t.T, 2)}}{\\tan(${tx(Math.abs(t.D) / DEG / 2, 2)}°)}`, value: t.r, unit: 'ft', d: 2 }));
      if (ss) {
        steps.push(st(pre, { id: 'RT', label: 'Steady state: tractor drive-group radius', sym: 'R_{T}', eq: '\\sqrt{r^{2} \\minus L_{1}^{2}}', sub: `\\sqrt{${tx(t.r, 2)}^{2} \\minus ${tx(v.L1, 2)}^{2}}`, value: ss.RT, unit: 'ft', d: 2, ref: REF.ot }),
          st(pre, { id: 'RK', label: 'Steady state: kingpin radius', sym: 'R_{K}', eq: '\\sqrt{R_{T}^{2} + e^{2}}', sub: `\\sqrt{${tx(ss.RT, 2)}^{2} + ${tp(v.e, 2)}^{2}}`, value: ss.RK, unit: 'ft', d: 2 }));
        if (hasJeep(v)) steps.push(st(pre, { id: 'RJ', label: 'Steady state: jeep axle radius', sym: 'R_{J}', eq: '\\sqrt{R_{K}^{2} \\minus L_{j}^{2}}', sub: `\\sqrt{${tx(ss.RK, 2)}^{2} \\minus ${tx(v.Lj, 2)}^{2}}`, value: ss.RJ, unit: 'ft', d: 2 }),
          st(pre, { id: 'RH', label: 'Steady state: jeep bolster radius', sym: 'R_{H}', eq: '\\sqrt{R_{J}^{2} + e_{j}^{2}}', sub: `\\sqrt{${tx(ss.RJ, 2)}^{2} + ${tp(v.ej, 2)}^{2}}`, value: ss.RH, unit: 'ft', d: 2 }));
        if (ss.dl) steps.push(st(pre, { id: 'dl', label: `Steady state: rear dolly steer angle (δ = −k γ, k = ${fmt(v.k, 2)}, solved by iteration)`, sym: '\\delta', eq: '\\minus k \\gamma', sub: `\\minus ${tx(v.k, 2)} \\cdot ${tp(ss.gma / DEG, 2)}°`, value: ss.dl / DEG, unit: 'deg', d: 2 }),
          st(pre, { id: 'RD', label: 'Steady state: rear dolly radius (turn centre o_y from o_x = −L₂ − o_y tan δ, o_x² + o_y² = R_H²)', sym: 'R_{D}', eq: '\\frac{o_{y}}{\\cos\\delta}', sub: `\\frac{${tx(ss.RD * Math.cos(ss.dl), 2)}}{\\cos(${tx(ss.dl / DEG, 2)}°)}`, value: ss.RD, unit: 'ft', d: 2 }));
        else steps.push(st(pre, { id: 'RD', label: `Steady state: ${steered(v) ? 'rear dolly pivot' : 'trailer rear-group'} radius`, sym: 'R_{D}', eq: `\\sqrt{R_{${hasJeep(v) ? 'H' : 'K'}}^{2} \\minus L_{2}^{2}}`, sub: `\\sqrt{${tx(ss.RH, 2)}^{2} \\minus ${tx(v.L2, 2)}^{2}}`, value: ss.RD, unit: 'ft', d: 2 }));
        steps.push(st(pre, { id: 'OTss', label: 'Steady-state off-tracking (the limit on a long curve of this radius)', sym: 'OT_{ss}', eq: 'r \\minus R_{D}', sub: `${tx(t.r, 2)} \\minus ${tx(ss.RD, 2)}`, value: ss.OT, unit: 'ft', d: 2 }));
      } else steps.push(st(pre, { id: 'OTss', label: 'Steady state: the radius is shorter than the wheelbases allow (no steady state)', sym: 'OT_{ss}', eq: '', sub: '', value: 'none', d: 0 }));
      const frac = t.r * Math.abs(t.D) / Math.max(1e-9, v.L1 + v.L2);
      steps.push(st(pre, { id: 'OT', label: `Max off-tracking in the turn (simulation, at ${fmt(otS, 1)} ft along the route; arc length ${fmt(t.r * Math.abs(t.D), 1)} ft = ${fmt(frac, 2)} × the wheelbases: ${frac < 2 ? 'transient, below the steady state' : 'near the steady state'})`, sym: 'OT_{max}', eq: '\\max_{s} d(D(s),\\, \\text{path})', sub: '', value: ot, unit: 'ft', d: 2, ref: REF.ot }),
        st(pre, { id: 'Rin', label: `Inside radius of the swept path (least distance from the curve centre; ${inPart})`, sym: 'R_{in}', eq: '\\min d(O, \\text{outlines in the curve\'s sector})', sub: '', value: Rin, unit: 'ft', d: 2 }),
        st(pre, { id: 'Rout', label: `Outside radius of the swept path (largest; ${outPart}${outPart === 'load' ? ': the load\'s swing-out' : ''})`, sym: 'R_{out}', eq: '\\max d(O, \\text{corners in the curve\'s sector})', sub: '', value: Rout, unit: 'ft', d: 2 }),
        st(pre, { id: 'Wsw', label: 'Swept width in the turn', sym: 'W_{sw}', eq: 'R_{out} \\minus R_{in}', sub: `${tx(Rout, 2)} \\minus ${tx(Rin, 2)}`, value: Rout - Rin, unit: 'ft', d: 2 }));
      const flags = [];
      if (t.r < v.Rmin - 1e-9) flags.push({ level: 'stop', kind: 'radius', turn: k + 1, text: `${nm}: radius ${fmt(t.r, 1)} ft is tighter than the vehicle's minimum turning radius ${fmt(v.Rmin, 1)} ft.` });
      if (t.reduced) flags.push({ level: 'warn', kind: 'radius', turn: k + 1, text: t.kind ? `${nm}: the radius asked for (${fmt(t.rq, 1)} ft) does not fit the tangents next to it; ${fmt(t.r, 1)} ft is used. Move the PIs apart or lower the radius.` : `Turn ${k + 1}: the radius asked for (${fmt(t.rq, 1)} ft) does not fit the drawn tangents; ${fmt(t.r, 1)} ft is used. Move the vertices apart or lower the radius.` });
      if (t.kind) {   // fitted alignment: the curve's geometry (PC, PT, length, stations; the fit check)
        const La = t.r * Math.abs(t.D), AL = window.CranePickAlign, sta = AL ? AL.sta : (x => fmt(x, 2));
        const g = [st(pre, { id: 'L', label: `${nm}: arc length`, sym: 'L', eq: 'r\\,|\\Delta|', sub: `${tx(t.r, 2)} \\times ${tx(Math.abs(t.D), 5)}\\ \\text{rad}`, value: La, unit: 'ft', d: 2 }),
          st(pre, { id: 'Tu', label: `${nm}: tangent length used (PI to PC and PT)`, sym: 'T', eq: 'r \\tan\\frac{|\\Delta|}{2}', sub: `${tx(t.r, 2)} \\tan\\frac{${tx(Math.abs(t.D) / DEG, 2)}°}{2}`, value: t.T, unit: 'ft', d: 2,
            note: `PC sta. ${sta(t.s0)}, PI sta. ${sta(t.s0 + t.T)}, PT sta. ${sta(t.s1)} (stations along the steer-axle path from its start).` })];
        if (t.fit && isNum(t.fit.R0)) g.unshift(st(pre, { id: 'Rf', label: `${nm}: radius fitted to the line (least squares, the arc tangent to both tangents; ${t.fit.n} points, rms ${fmt(t.fit.rms, 2)} ft)`, sym: 'R_{fit}', eq: '\\arg\\min_{R} \\sum d_{i}(R)^{2}', sub: '', value: t.fit.R0, unit: 'ft', d: 2,
          note: `Check: the free least-squares circle through the curve's points R_LS = ${fmt(t.fit.Rls, 2)} ft.${t.fit.atMax ? ' The fit reached the largest radius that fits the tangents.' : ''}${Math.abs(t.fit.R0 - t.rq) > 1e-9 ? ` Radius entered: ${fmt(t.rq, 2)} ft.` : ''}` }));
        steps.unshift(...g);
        if (t.kind === 'turn') steps.unshift(st(pre, { id: 'kind', label: `${nm}: an intersection turn (the heading changes within ${fmt(t.fit && isNum(t.fit.Lc) ? t.fit.Lc : 0, 1)} ft: a corner, not a road curve); radius ${t.from}`, sym: 'r', eq: '', sub: '', value: t.rq, unit: 'ft', d: 2 }));
      }
      out.push(Object.assign({ n: k + 1, i: t.i, D: t.D, r: t.r, rq: t.rq, reduced: t.reduced, c: t.c, s0: t.s0, s1: t.s1, ot, otS, Rin, Rout, inPart, outPart, ss, steps, flags },
        t.kind ? { kind: t.kind, lbl: t.lbl, tag: t.tag, T: t.T, PC: t.A, PT: t.B, PI: t.PI, Lc: t.r * Math.abs(t.D), from: t.from, fit: t.fit } : {}));
    });
    return out;
  }
  /* ---------- 4. conflicts ---------- */
  function bbox(pts) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; pts.forEach(p => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }); return { x0, y0, x1, y1 }; }
  const near = (a, b, pad) => a.x0 - pad <= b.x1 && b.x0 - pad <= a.x1 && a.y0 - pad <= b.y1 && b.y0 - pad <= a.y1;
  /* the first sample where any outline comes within `pad` of the shape (closed: polygon), with the part and the distance */
  function firstHit(sim, shape, closed, pad, test) {
    const bs = bbox(shape); let best = null;
    for (const q of sim.samples) for (const pp of q.parts) {
      const bp = bbox(pp.poly); if (!near(bp, bs, pad + 1e-6)) continue;
      const d = LF().minDist(pp.poly, true, shape, closed);
      if (test(d)) { if (!best) best = { s: q.s, part: pp.part, d, sMin: q.s, dMin: d }; if (d < best.dMin) { best.dMin = d; best.sMin = q.s; } }
    }
    return best;
  }
  function minAll(sim, shape, closed, pad) {   // the least distance (outline to the shape) over the route, ignoring outlines farther than pad
    const bs = bbox(shape); let best = { d: Infinity, s: null, part: '' };
    for (const q of sim.samples) for (const pp of q.parts) { if (!near(bbox(pp.poly), bs, pad)) continue; const d = LF().minDist(pp.poly, true, shape, closed); if (d < best.d) best = { d, s: q.s, part: pp.part }; }
    return best;
  }
  function conflicts(sim, P) {
    const out = [], items = (P && P.items) || [];
    items.forEach(it => { const nm = it.name || it.type;
      if (it.type === 'obst') { const h = firstHit(sim, it.pts, true, 0, d => d === 0); if (h) out.push({ level: 'stop', kind: 'obst', item: it.id, s: h.s, text: `The ${h.part} meets the obstruction "${nm}" at ${fmt(h.s, 0)} ft along the route.` }); }
      else if (it.type === 'excl') { const h = firstHit(sim, it.pts, true, 0, d => d === 0); if (h) out.push({ level: 'stop', kind: 'excl', item: it.id, s: h.s, text: `The ${h.part} enters the exclusion zone "${nm}" at ${fmt(h.s, 0)} ft along the route.` }); }
      else if (it.type === 'power') { const c = O().clearance({ kv: it.kv, le350: it.le350, setFt: it.setFt }, 'x'); if (isNum(c.ft)) { const h = firstHit(sim, it.pts, false, c.ft, d => d < c.ft - 1e-9);
        if (h) out.push({ level: 'warn', kind: 'power', item: it.id, s: h.s, text: `The vehicle / load passes within the plan buffer of "${nm}" (Table A D_min ${fmt(c.ft, 0)} ft; closest ${fmt(h.dMin, 1)} ft in plan): the vertical travel clearance governs (Overhead).` }); } }
      else if (it.type === 'util') { const h = firstHit(sim, it.pts, !!it.closed, 0, d => d === 0); if (h) out.push({ level: 'info', kind: 'util', item: it.id, s: h.s, text: `The route crosses the buried ${it.kind === 'culvert' ? 'culvert' : it.kind === 'wall' ? 'wall' : 'utility'} "${nm}" at ${fmt(h.s, 0)} ft: check it for the wheel loads (not computed here).` }); }
    });
    ((P && P.setups) || []).forEach(u => { const c = P.cranes && P.cranes.find(x => x.id === u.craneId); if (!c || !LF()) return; const fp = LF().footprint(c.def, u);
      const parts = [].concat(fp.body ? [fp.body] : [], fp.tracks, fp.floats); for (const q of parts) { const h = firstHit(sim, q, true, 0, d => d === 0); if (h) { out.push({ level: 'stop', kind: 'crane', setup: u.id, s: h.s, text: `The ${h.part} meets the crane footprint of "${u.name}" at ${fmt(h.s, 0)} ft along the route.` }); break; } } });
    return out;
  }
  /* ---------- 5. overhead ---------- */
  function overhead(sim, P, marks, r, idp) {
    const v = sim.v, l = sim.l, Htop = v.hDeck + l.h, mg = isNum(r && r.margin) && r.margin >= 0 ? r.margin : 1, out = [];
    const top = [st(idp, { id: 'Htop', label: 'Load top above the road', sym: 'H_{top}', eq: 'h_{deck} + h_{load}', sub: `${tx(v.hDeck, 2)} + ${tx(l.h, 2)}`, value: Htop, unit: 'ft', d: 2, note: 'The tractor, jeep and dolly are assumed lower than the load top; enter the load height so that it governs.' })];
    (marks || []).filter(m => m.type === 'overhead').forEach((m, k) => {
      const pre = `${idp}.oh${k + 1}`, isPt = m.pts.length === 1, rad = isPt ? (isNum(m.w) && m.w > 0 ? m.w : 2) : 0;
      const shape = isPt ? LF().circle(m.pts[0], Math.max(rad, 0.01), 24) : m.pts;
      const h = firstHit(sim, shape, isPt, 0, d => d === 0); if (!h) return;
      const hc = isNum(m.h) ? m.h : null, c = hc != null ? hc - Htop : null;
      const steps = hc != null ? [st(pre, { id: 'c', label: `Clearance under "${m.name || 'overhead'}"`, sym: 'c', eq: 'h \\minus H_{top}', sub: `${tx(hc, 2)} \\minus ${tx(Htop, 2)}`, value: c, unit: 'ft', d: 2, note: c >= mg ? `OK (≥ the margin ${fmt(mg, 2)} ft)` : `LESS than the margin ${fmt(mg, 2)} ft` })] : [];
      const fl = hc == null ? { level: 'stop', text: `"${m.name || 'Overhead'}" is on the route but its clearance height is not entered.` } : c < 0 ? { level: 'stop', text: `"${m.name || 'Overhead'}": the load top (${fmt(Htop, 2)} ft) is ${fmt(-c, 2)} ft above the clearance (${fmt(hc, 2)} ft).` } : c < mg ? { level: 'warn', text: `"${m.name || 'Overhead'}": clearance ${fmt(c, 2)} ft is less than the margin ${fmt(mg, 2)} ft.` } : null;
      out.push({ kind: 'mark', id: m.id, name: m.name || 'Overhead', h: hc, Htop, c, s: h.s, ok: !fl, steps, flag: fl ? Object.assign({ kind: 'overhead', item: m.id, s: h.s }, fl) : null });
    });
    ((P && P.items) || []).filter(i => i.type === 'power').forEach((it, k) => {
      const D = O().travel({ kv: it.kv, setFt: it.setFt }, `${idp}.pw${k + 1}`), pad = Math.max(isNum(D.ft) ? D.ft : 20, O().SPOTTER_FT) + n0(it.sway) + 1;
      const m = minAll(sim, it.pts, false, pad); if (!isNum(m.d) || m.d > pad) return;
      const pre = `${idp}.pw${k + 1}`, dh = Math.max(0, m.d - n0(it.sway)), hw = isNum(it.height) ? it.height - n0(it.sag) : null, steps = D.steps.slice();
      let d = null; const nm = it.name || 'Power line';
      steps.push(st(pre, { id: 'dh', label: `Least horizontal distance, ${m.part} to the line in plan, less the sway allowance (at ${fmt(m.s, 0)} ft along the route)`, sym: 'd_{h}', eq: '\\max(0,\\; d_{plan} \\minus s_{w})', sub: `\\max(0,\\; ${tx(m.d, 2)} \\minus ${tx(n0(it.sway), 2)})`, value: dh, unit: 'ft', d: 2 }));
      if (hw != null) { const dv = Math.max(0, hw - Htop); d = Math.hypot(dh, dv);
        steps.push(st(pre, { id: 'dv', label: 'Vertical gap, lowest wire (less the sag allowance) above the load top', sym: 'd_{v}', eq: '\\max(0,\\; h_{w} \\minus s_{g} \\minus H_{top})', sub: `\\max(0,\\; ${tx(it.height, 2)} \\minus ${tx(n0(it.sag), 2)} \\minus ${tx(Htop, 2)})`, value: dv, unit: 'ft', d: 2 }),
          st(pre, { id: 'd', label: 'Least distance, load / vehicle to the wire', sym: 'd', eq: '\\sqrt{d_{h}^{2} + d_{v}^{2}}', sub: `\\sqrt{${tx(dh, 2)}^{2} + ${tx(dv, 2)}^{2}}`, value: d, unit: 'ft', d: 2, ref: REF.t,
            note: isNum(D.ft) ? (d >= D.ft ? `≥ D_T = ${fmt(D.ft, 0)} ft: OK` : `LESS than D_T = ${fmt(D.ft, 0)} ft`) : 'D_T not set' })); }
      else if (dh > 0) d = dh;
      let fl = null;
      if (d == null) fl = { level: 'stop', text: `The route passes under "${nm}" but the lowest wire height is not entered (Site items).` };
      else if (!isNum(D.ft)) fl = { level: 'stop', text: `"${nm}": over 1,000 kV, the travel clearance is not set (enter the utility / RPE value).` };
      else if (d < D.ft - 1e-9) fl = { level: 'stop', text: `"${nm}": ${fmt(d, 1)} ft from the load / vehicle, less than the travel clearance D_T = ${fmt(D.ft, 0)} ft (29 CFR 1926.1411 Table T).` };
      else if (d < O().SPOTTER_FT - 1e-9) fl = { level: 'warn', text: `"${nm}": ${fmt(d, 1)} ft (< 20 ft): a dedicated spotter in continuous contact with the driver (29 CFR 1926.1411(b)(4)).` };
      if (!D.known && fl == null) fl = { level: 'info', text: `"${nm}": voltage not known, D_T = 20 ft used.` };
      out.push({ kind: 'power', id: it.id, name: nm, kv: it.kv, DT: D.ft, basis: D.basis, dh, hw, d, Htop, s: m.s, ok: !fl || fl.level === 'info', steps, flag: fl ? Object.assign({ kind: 'power', item: it.id, s: m.s }, fl) : null });
    });
    return { Htop, margin: mg, top, list: out };
  }
  /* ---------- 6. axle loads ---------- */
  function axles(r, idp, P) {
    const v = vehOf(r), l = loadOf(r, P), steps = [], pre = idp || 'ax', ai = (r && r.axIn) || {};
    const f = l.L - v.L2 - l.r, xL = l.cg - f;
    steps.push(st(pre, { id: 'f', label: 'Load front ahead of the hitch (kingpin / jeep bolster; − = behind it)', sym: 'f', eq: 'L_{load} \\minus L_{2} \\minus r', sub: `${tx(l.L, 2)} \\minus ${tx(v.L2, 2)} \\minus ${tx(l.r, 2)}`, value: f, unit: 'ft', d: 2 }),
      st(pre, { id: 'xL', label: 'Load CG behind the hitch', sym: 'x_{L}', eq: 'c_{L} \\minus f', sub: `${tx(l.cg, 2)} \\minus ${tp(f, 2)}`, value: xL, unit: 'ft', d: 2 }));
    const g = { S: null, D: null, J: null, R: null }, n = { S: v.nS, D: v.nD, J: hasJeep(v) ? v.nJ : 0, R: v.nR }, t = { S: v.tS, D: v.tD, J: v.tJ, R: v.tR };
    let mode = 'statics';
    if (ai.on && ['S', 'D', 'R'].every(k => isNum(ai[k])) && (!hasJeep(v) || isNum(ai.J))) { mode = 'entered'; g.S = ai.S; g.D = ai.D; g.R = ai.R; g.J = hasJeep(v) ? ai.J : null;
      steps.push(st(pre, { id: 'in', label: 'Axle-group loads entered (weigh tickets / the hauler\'s axle-load calculation)', sym: 'R', eq: '', sub: '', value: 'entered', d: 0 })); }
    else {
      const Wb = steered(v) ? 0 : v.Wtl, xb = v.xtl, Wd = steered(v) ? v.Wd : 0;
      const Rb = (Wb * xb + l.W * xL) / v.L2, RH = Wb + l.W - Rb;
      steps.push(st(pre, { id: 'Rr', label: steered(v) ? 'Rear dolly: load share at the pivot (moments about the hitch)' : 'Trailer rear group: from the trailer tare and the load (moments about the kingpin)', sym: 'R_{b}', eq: steered(v) ? '\\frac{W_{L} x_{L}}{L_{2}}' : '\\frac{W_{tl} x_{tl} + W_{L} x_{L}}{L_{2}}',
        sub: steered(v) ? `\\frac{${tx(l.W, 0)} \\cdot ${tp(xL, 2)}}{${tx(v.L2, 2)}}` : `\\frac{${tx(Wb, 0)} \\cdot ${tp(xb, 2)} + ${tx(l.W, 0)} \\cdot ${tp(xL, 2)}}{${tx(v.L2, 2)}}`, value: Rb, unit: 'lb', d: 0, ref: REF.statics }),
        st(pre, { id: 'R', label: steered(v) ? 'Rear dolly group load (with the dolly tare at its pivot)' : 'Trailer rear-group load', sym: 'R_{R}', eq: steered(v) ? 'R_{b} + W_{d}' : 'R_{b}', sub: steered(v) ? `${tx(Rb, 0)} + ${tx(Wd, 0)}` : tx(Rb, 0), value: Rb + Wd, unit: 'lb', d: 0 }),
        st(pre, { id: 'RH', label: hasJeep(v) ? 'Load on the jeep bolster' : 'Load on the fifth wheel (kingpin)', sym: 'R_{H}', eq: steered(v) ? 'W_{L} \\minus R_{b}' : 'W_{tl} + W_{L} \\minus R_{b}', sub: steered(v) ? `${tx(l.W, 0)} \\minus ${tx(Rb, 0)}` : `${tx(Wb, 0)} + ${tx(l.W, 0)} \\minus ${tx(Rb, 0)}`, value: RH, unit: 'lb', d: 0 }));
      g.R = Rb + Wd; let RK = RH;
      if (hasJeep(v)) { const RJ = (RH * (v.Lj - v.ej) + v.Wj * v.Lj) / v.Lj; RK = RH + v.Wj - RJ; g.J = RJ;
        steps.push(st(pre, { id: 'J', label: 'Jeep axle-group load (moments about the jeep kingpin; jeep tare at its axles)', sym: 'R_{J}', eq: '\\frac{R_{H} (L_{j} \\minus e_{j}) + W_{j} L_{j}}{L_{j}}', sub: `\\frac{${tx(RH, 0)} \\cdot (${tx(v.Lj, 2)} \\minus ${tp(v.ej, 2)}) + ${tx(v.Wj, 0)} \\cdot ${tx(v.Lj, 2)}}{${tx(v.Lj, 2)}}`, value: RJ, unit: 'lb', d: 0 }),
          st(pre, { id: 'RK', label: 'Load on the tractor\'s fifth wheel', sym: 'R_{K}', eq: 'R_{H} + W_{j} \\minus R_{J}', sub: `${tx(RH, 0)} + ${tx(v.Wj, 0)} \\minus ${tx(RJ, 0)}`, value: RK, unit: 'lb', d: 0 })); }
      const Rd = (v.Wtr * v.xt + RK * (v.L1 - v.e)) / v.L1, Rs = v.Wtr + RK - Rd; g.D = Rd; g.S = Rs;
      steps.push(st(pre, { id: 'D', label: 'Tractor drive-group load (moments about the steer axle)', sym: 'R_{D}', eq: '\\frac{W_{tr} x_{t} + R_{K} (L_{1} \\minus e)}{L_{1}}', sub: `\\frac{${tx(v.Wtr, 0)} \\cdot ${tx(v.xt, 2)} + ${tx(RK, 0)} \\cdot (${tx(v.L1, 2)} \\minus ${tp(v.e, 2)})}{${tx(v.L1, 2)}}`, value: Rd, unit: 'lb', d: 0 }),
        st(pre, { id: 'S', label: 'Steer-axle load', sym: 'R_{S}', eq: 'W_{tr} + R_{K} \\minus R_{D}', sub: `${tx(v.Wtr, 0)} + ${tx(RK, 0)} \\minus ${tx(Rd, 0)}`, value: Rs, unit: 'lb', d: 0 }));
    }
    const keys = ['S', 'D'].concat(hasJeep(v) ? ['J'] : [], ['R']), lbl = { S: 'Steer axle', D: 'Drive group', J: 'Jeep group', R: steered(v) ? 'Rear dolly group' : 'Trailer rear group' };
    const gross = keys.reduce((a, k) => a + g[k], 0);
    steps.push(st(pre, { id: 'Wg', label: 'Gross vehicle weight', sym: 'W_{gross}', eq: keys.map(k => `R_{${k}}`).join(' + '), sub: keys.map(k => tx(g[k], 0)).join(' + '), value: gross, unit: 'lb', d: 0, note: `${fmt(gross / LB_PER_TON, 2)} tons (2,000 lb)` }));
    const groups = keys.map(k => { const per = n[k] > 0 ? g[k] / n[k] : g[k], tyre = n[k] > 0 && t[k] > 0 ? g[k] / (n[k] * t[k]) : null; return { k, label: lbl[k], load: g[k], n: n[k], tyres: t[k], perAxle: per, perTyre: tyre }; });
    groups.forEach(q => steps.push(st(pre, { id: 'a' + q.k, label: `${q.label}: per axle (${q.n} axle${q.n === 1 ? '' : 's'}) and per tyre (${q.tyres} per axle)`, sym: `P_{${q.k}}`, eq: `\\frac{R_{${q.k}}}{n}`, sub: `\\frac{${tx(q.load, 0)}}{${tx(q.n, 0)}}`, value: q.perAxle, unit: 'lb', d: 0, note: isNum(q.perTyre) ? `per tyre ${fmt(q.perTyre, 0)} lb` : '' })));
    const flags = groups.filter(q => q.load < 0).map(q => ({ level: 'stop', kind: 'axle', text: `${q.label}: the statics give an uplift (${fmt(q.load, 0)} lb): check the load position and the weights.` }));
    const heavyAxle = groups.reduce((m, q) => q.perAxle > m.v ? { v: q.perAxle, q } : m, { v: -Infinity, q: null });
    const heavyTyre = groups.reduce((m, q) => isNum(q.perTyre) && q.perTyre > m.v ? { v: q.perTyre, q } : m, { v: -Infinity, q: null });
    return { mode, groups, gross, f, xL, steps, flags, heavyAxle, heavyTyre };
  }
  /* ---------- 7. haul road ---------- */
  function haul(sim, ax, marks, r, idp) {
    const out = [];
    (marks || []).filter(m => m.type === 'haul').forEach((m, k) => {
      const w = isNum(m.w) && m.w > 0 ? m.w : 20, pre = `${idp}.h${k + 1}`;
      const on = sim.dense.some(q => q.s >= 0 && G().lineDist(q, m.pts, false) <= w / 2); if (!on) return;
      const A = r && r.tyre && isNum(r.tyre.A) && r.tyre.A > 0 ? r.tyre.A : 100, P = ax.heavyTyre.v, f = Math.sqrt(4 * A / IN2_PER_FT2 / Math.PI);
      const mat = Object.assign({ type: 'none', k: 1 }, m.mat || {}); if (!isNum(mat.gamma)) mat.gamma = (GR().DEF.gamma || {})[mat.type] || 0; if (!isNum(mat.k)) mat.k = GR().DEF.spread;
      const steps = [st(pre, { id: 'P', label: `Heaviest tyre load (${ax.heavyTyre.q ? ax.heavyTyre.q.label : '—'})`, sym: 'P_{tyre}', eq: '\\frac{R}{n\\, t}', sub: ax.heavyTyre.q ? `\\frac{${tx(ax.heavyTyre.q.load, 0)}}{${ax.heavyTyre.q.n} \\cdot ${ax.heavyTyre.q.tyres}}` : '', value: P, unit: 'lb', d: 0 }),
        st(pre, { id: 'A', label: 'Tyre contact area', sym: 'A_{c}', eq: '\\frac{A_{in}}{144}', sub: `\\frac{${tx(A, 1)}}{144}`, value: A / IN2_PER_FT2, unit: 'ft^{2}', d: 4, note: r && r.tyre && isNum(r.tyre.A) ? 'entered' : 'default 100 in² (enter the tyre maker\'s contact area at this load and pressure)' }),
        st(pre, { id: 'f', label: 'Equal-area round contact (C4 bearing method: float of size f)', sym: 'f', eq: '\\sqrt{\\frac{4 A_{c}}{\\pi}}', sub: `\\sqrt{\\frac{4 \\cdot ${tx(A / IN2_PER_FT2, 4)}}{\\pi}}`, value: f, unit: 'ft', d: 4 })];
      const b = GR().bearing(P, { kind: 'wheeled', f }, mat, pre + '.b'); steps.push(...b.steps);
      const qa = isNum(m.qa) && m.qa > 0 ? m.qa : null, ratio = qa ? b.qg / qa : null;
      if (qa) steps.push(st(pre, { id: 'rq', label: 'Bearing ratio', sym: '\\frac{q_{g}}{q_{a}}', eq: '', sub: `\\frac{${tx(b.qg, 0)}}{${tx(qa, 0)}}`, value: ratio, d: 3, note: ratio <= 1 ? 'OK' : 'OVER the allowable' }));
      const fl = b.bad ? { level: 'warn', text: `Haul road "${m.name || 'haul road'}": ${b.bad}.` } : !qa ? { level: 'warn', text: `Haul road "${m.name || 'haul road'}": enter the allowable bearing pressure.` } : ratio > 1 ? { level: 'stop', text: `Haul road "${m.name || 'haul road'}": tyre bearing ${fmt(b.qg, 0)} psf over the allowable ${fmt(qa, 0)} psf (${fmt(ratio * 100, 0)} %).` } : null;
      if (isNum(b.rM) && b.rM > 1) out.push({ flagOnly: true, flag: { level: 'stop', kind: 'haul', item: m.id, text: `Haul road "${m.name}": mat bending ${fmt(b.rM, 2)} > 1.` } });
      out.push({ id: m.id, name: m.name || 'Haul road', P, A, qg: b.qg, qa, ratio, mat: mat.type, steps, flag: fl ? Object.assign({ kind: 'haul', item: m.id }, fl) : null });
    });
    return out;
  }
  /* ---------- 8. posted bridges ---------- */
  function bridges(sim, ax, marks, idp) {
    const out = [];
    (marks || []).filter(m => m.type === 'bridge').forEach((m, k) => {
      const w = isNum(m.w) && m.w > 0 ? m.w : 30, pre = `${idp}.b${k + 1}`;
      const on = sim.dense.some(q => q.s >= 0 && G().lineDist(q, m.pts, false) <= w / 2); if (!on) return;
      const p = m.post || {}, steps = [], checks = [], nm = m.name || 'Bridge';
      const T = v => isNum(v) && v > 0 ? v : null;
      steps.push(st(pre, { id: 'Wg', label: 'Gross vehicle weight in tons', sym: 'W_{gross}', eq: '\\frac{W_{lb}}{2{,}000}', sub: `\\frac{${tx(ax.gross, 0)}}{2{,}000}`, value: ax.gross / LB_PER_TON, unit: 'tons', d: 2 }));
      if (T(p.gross)) checks.push({ what: 'gross posting', limit: p.gross, val: ax.gross / LB_PER_TON });
      if (T(p.tTons)) checks.push({ what: `posting for ${p.tLabel || 'this vehicle type'}`, limit: p.tTons, val: ax.gross / LB_PER_TON });
      if (T(p.axle)) { steps.push(st(pre, { id: 'Pa', label: `Heaviest single axle in tons (${ax.heavyAxle.q ? ax.heavyAxle.q.label : '—'})`, sym: 'P_{axle}', eq: '\\frac{P_{lb}}{2{,}000}', sub: `\\frac{${tx(ax.heavyAxle.v, 0)}}{2{,}000}`, value: ax.heavyAxle.v / LB_PER_TON, unit: 'tons', d: 2 }));
        checks.push({ what: 'axle posting', limit: p.axle, val: ax.heavyAxle.v / LB_PER_TON }); }
      checks.forEach((c, i) => steps.push(st(pre, { id: 'c' + i, label: `${nm}: ${c.what}`, sym: '\\frac{W}{W_{post}}', eq: '', sub: `\\frac{${tx(c.val, 2)}}{${tx(c.limit, 2)}}`, value: c.val / c.limit, d: 3, note: c.val <= c.limit + 1e-9 ? 'OK' : 'OVER the posting' })));
      const over = checks.filter(c => c.val > c.limit + 1e-9);
      const fl = !checks.length ? { level: 'warn', text: `Posted bridge "${nm}" is on the route but no posting is entered.` } : over.length ? { level: 'stop', text: `Posted bridge "${nm}": ${over.map(c => `${c.what} ${fmt(c.limit, 1)} t exceeded (${fmt(c.val, 2)} t)`).join('; ')}. A permit / the bridge owner governs.` } : null;
      out.push({ id: m.id, name: nm, checks, ok: !fl, steps, flag: fl ? Object.assign({ kind: 'bridge', item: m.id }, fl) : null });
    });
    return out;
  }
  /* ---------- 9. staging ---------- */
  function loadCg(sim) { const p = sim.end, u2 = U(p.th2); return sub(p.H, mul(u2, sim.l.cg - (sim.l.L - sim.v.L2 - sim.l.r))); }
  /* the load's mid-length point and its end-A→B azimuth at the stop (the C5 pose) */
  function loadPose(sim) { const p = sim.end, u2 = U(p.th2), f = sim.l.L - sim.v.L2 - sim.l.r, mid = add(p.H, mul(u2, f - sim.l.L / 2)), azF = (90 - p.th2 / DEG + 360) % 360;
    return { x: mid.x, y: mid.y, h: sim.l.endA === 'rear' ? azF : (azF + 180) % 360 }; }
  const n180 = a => { a = ((a % 360) + 360) % 360; return a > 180 ? a - 360 : a; };
  function staging(sim, r, P, s, idp, tev) {
    const cg = loadCg(sim), out = { cg, steps: [], flags: [] }, pre = idp;
    out.az = (90 - sim.end.th2 / DEG + 360) % 360;   // the load axis at the stop, azimuth of front
    const k = r && r.pickId && P && (P.picks || []).find(q => q.id === r.pickId);
    const tol = isNum(r && r.stageTol) && r.stageTol >= 0 ? r.stageTol : 2;
    // turnaround (information): the outer front corner circle of the tractor at R_min
    const v = sim.v, RT2 = v.Rmin * v.Rmin - v.L1 * v.L1;
    if (RT2 > 0) { const Ro = Math.hypot(v.L1 + v.fo, Math.sqrt(RT2) + v.Wt / 2); out.turnR = Ro;
      out.steps.push(st(pre, { id: 'Ro', label: 'Turnaround (information): the tractor\'s outer front corner on its minimum turn', sym: 'R_{o}', eq: '\\sqrt{(L_{1} + f_{o})^{2} + (\\sqrt{R_{min}^{2} \\minus L_{1}^{2}} + \\frac{W_{t}}{2})^{2}}', sub: `\\sqrt{(${tx(v.L1, 2)} + ${tx(v.fo, 2)})^{2} + (\\sqrt{${tx(v.Rmin, 2)}^{2} \\minus ${tx(v.L1, 2)}^{2}} + \\frac{${tx(v.Wt, 2)}}{2})^{2}}`, value: Ro, unit: 'ft', d: 2,
        note: 'An empty tractor turning around needs a circle of about 2 R_o, or it backs out: plan the exit.' })); }
    const t = sim.l.tandem;
    if (t) {   // C5 girder lift: its pick pose is where the girder sits on the truck
      const lp = loadPose(sim), pp = t.pick, off = G().dist(lp, pp), dh = n180(lp.h - pp.h); out.tandem = t; out.lp = lp; out.off = off; out.dh = dh;
      out.steps.push(st(pre, { id: 'mid', label: `Girder mid-length point on the truck at the stop (front ${fmt(sim.l.L - sim.v.L2 - sim.l.r, 2)} ft ahead of the hitch, less L/2)`, sym: 'c', eq: 'H + (f \minus L/2)\,\hat{u}', sub: '', value: `E ${fmt(lp.x, 2)}, N ${fmt(lp.y, 2)}`, d: 0 }),
        st(pre, { id: 'off', label: `Girder on the truck vs the pick pose of "${t.name}" (C5)`, sym: '\Delta', eq: '\sqrt{\Delta x^{2} + \Delta y^{2}}', sub: `\sqrt{${tx(lp.x - pp.x, 2)}^{2} + ${tx(lp.y - pp.y, 2)}^{2}}`, value: off, unit: 'ft', d: 2, note: off <= tol ? `within ${fmt(tol, 1)} ft` : `more than ${fmt(tol, 1)} ft` }),
        st(pre, { id: 'dh', label: `Heading of the girder (end A → B; end A ${sim.l.endA === 'rear' ? 'to the rear' : 'toward the tractor'}) vs the pick pose`, sym: '\Delta h', eq: 'h_{truck} \minus h_{pick}', sub: `${tx(lp.h, 2)} \minus ${tx(pp.h, 2)}`, value: dh, unit: 'deg', d: 2, note: Math.abs(dh) <= 2 ? 'within 2°' : 'more than 2°' }));
      if (off > tol || Math.abs(dh) > 2) out.flags.push({ level: 'warn', kind: 'stage', text: `Staging: the girder on the truck is ${fmt(off, 1)} ft and ${fmt(Math.abs(dh), 1)}° from the pick pose of "${t.name}" (tolerance ${fmt(tol, 1)} ft, 2°): move the route's end or the pick pose.` });
      if (tev && tev.steps && tev.steps[0]) { out.tsteps = tev.steps[0].cr.map((c, i) => c ? { i, R: c.R, pct: c.pct, cls: c.cls } : null).filter(Boolean);
        out.tsteps.forEach(c => { if (c.cls === 'np' || c.cls === 'over') out.flags.push({ level: 'stop', kind: 'stage', text: `Staging: crane ${c.i + 1} of "${t.name}" at the pick pose: ${c.cls === 'np' ? 'not permitted' : fmt(c.pct, 1) + ' % of chart, over the limit'} (R = ${fmt(c.R, 1)} ft; Girder lifts tab).` }); }); }
      else if (tev) out.flags.push({ level: 'warn', kind: 'stage', text: `Staging: "${t.name}" is not computed yet (cranes / girder inputs): its pick-pose reach is not checked.` });
      if (isNum(pp.z)) out.flags.push({ level: 'info', kind: 'stage', text: `Staging: the pick pose has the girder bottom at el. ${fmt(pp.z, 2)} ft; the deck is ${fmt(sim.v.hDeck, 2)} ft above the road at the stop: check the road elevation there.` });
      return out;
    }
    if (!k) { out.flags.push({ level: 'info', kind: 'stage', text: 'No pick or girder lift is linked to this route: choose the delivery (staging check).' }); return out; }
    out.pick = k; const off = G().dist(cg, k.pick); out.off = off;
    out.steps.push(st(pre, { id: 'off', label: `Load CG at the truck stop vs the pick point of "${k.name}"`, sym: '\\Delta', eq: '\\sqrt{\\Delta x^{2} + \\Delta y^{2}}', sub: `\\sqrt{${tx(cg.x - k.pick.x, 2)}^{2} + ${tx(cg.y - k.pick.y, 2)}^{2}}`, value: off, unit: 'ft', d: 2, note: off <= tol ? `within ${fmt(tol, 1)} ft` : `more than ${fmt(tol, 1)} ft: move the pick point to the load, or the route's end` }));
    if (off > tol) out.flags.push({ level: 'warn', kind: 'stage', text: `Staging: the load CG stops ${fmt(off, 1)} ft from the pick point of "${k.name}" (tolerance ${fmt(tol, 1)} ft).` });
    const u = (P.setups || []).find(x => x.id === k.setupId), c = u && (P.cranes || []).find(x => x.id === u.craneId);
    if (u && c && LF()) { const W = LF().total(k), e = LF().evalAt(c.def, u, cg, W, s || LF().DEF, pre + '.cap'); out.ev = e; out.setup = u; out.W = W;
      out.steps.push(st(pre, { id: 'W', label: `Hook load of "${k.name}" (C2 pick)`, sym: 'W', eq: 'W_{load} + W_{rig} + W_{hook} + W_{other}', sub: `${tx(n0(k.load), 0)} + ${tx(n0(k.rigging), 0)} + ${tx(n0(k.hook), 0)} + ${tx(n0(k.ded), 0)}`, value: W, unit: 'lb', d: 0 }), ...e.steps);
      if (e.cls === 'np') out.flags.push({ level: 'stop', kind: 'stage', text: `Staging: the load on the trailer is out of the chart of "${u.name}" (R = ${fmt(e.R, 1)} ft).` });
      else if (e.cls === 'over') out.flags.push({ level: 'stop', kind: 'stage', text: `Staging: ${fmt(e.pct, 1)} % of chart for "${u.name}" at the load on the trailer (R = ${fmt(e.R, 1)} ft).` });
      else if (e.cls !== 'ok') out.flags.push({ level: 'warn', kind: 'stage', text: `Staging: ${fmt(e.pct, 1)} % of chart (${LF().CLS[e.cls]}) for "${u.name}" at the load on the trailer.` });
      if (isNum(n0(k.load)) && n0(k.load) && Math.abs(n0(k.load) - sim.l.W) > 1) out.flags.push({ level: 'warn', kind: 'stage', text: `Staging: the route's load weight (${fmt(sim.l.W, 0)} lb) differs from the pick's load (${fmt(n0(k.load), 0)} lb).` });
    } else out.flags.push({ level: 'warn', kind: 'stage', text: `Staging: the pick "${k.name}" has no crane setup / crane.` });
    return out;
  }
  /* ---------- the whole route ---------- */
  function evaluate(r, P, idp, o) {
    idp = idp || 'rt'; const sim = simulate(r, Object.assign({ P }, o || {}));
    const res = { sim, ok: sim.ok, flags: [] };
    if (!sim.ok) { res.flags.push({ level: 'warn', kind: 'route', text: `Route "${r.name || 'route'}": ${sim.why}.` }); return res; }
    const marks = (P && P.routeMarks) || [];
    res.turns = turnsOf(sim, idp);
    res.conf = conflicts(sim, P);
    res.ax = axles(r, idp + '.ax', P);
    res.oh = overhead(sim, P, marks, r, idp + '.oh');
    res.haul = haul(sim, res.ax, marks, r, idp + '.hl');
    res.br = bridges(sim, res.ax, marks, idp + '.br');
    res.stage = staging(sim, r, P, LF() ? LF().settingsOf(P) : null, idp + '.sg', o && o.tev);
    res.otMax = sim.samples.reduce((m, q) => Math.max(m, q.ot), 0);
    { const al = alignOf(r, sim); if (al) res.align = al; }   // fitted alignment only (a legacy route's result is as before)
    res.flags = [].concat(...res.turns.map(t => t.flags), res.align ? res.align.flags : [], res.conf, res.ax.flags, res.oh.list.map(o => o.flag).filter(Boolean), res.haul.map(h => h.flag).filter(Boolean), res.br.map(b => b.flag).filter(Boolean), res.stage.flags);
    const rank = { stop: 0, warn: 1, info: 2 }; res.flags.sort((a, b) => rank[a.level] - rank[b.level]);
    res.worst = res.flags.length ? res.flags[0].level : 'ok';
    return res;
  }
  /* the fitted alignment's summary (route.mode 'fit'): the deviation of the drawn / traced / OSM line from it, the smallest radius vs
     the vehicle's R_min, the source (OpenStreetMap: attribution, "not survey", one-way roads travelled against their direction) */
  function alignOf(r, sim) {
    if (!sim.pa.fitted) return null;
    const AL = window.CranePickAlign, flags = [], src = r.src || {}, apts = sim.dense.filter(q => q.s >= 0);
    const dev = AL && (r.pts || []).length >= 2 ? AL.deviation(r.pts, apts) : null, curves = sim.pa.turns;
    const rmin = curves.reduce((m, t) => Math.min(m, t.r), Infinity), Rv = sim.v.Rmin;
    if (src.kind === 'osm') flags.push({ level: 'info', kind: 'osm', text: `Road geometry ${window.CranePickOSM ? window.CranePickOSM.NOT_SURVEY : 'from OpenStreetMap — not survey'} (${window.CranePickOSM ? window.CranePickOSM.ATTR : '© OpenStreetMap contributors'}, fetched ${String(src.at || '').slice(0, 10) || '—'}): check the curves and the clear widths on site.` });
    (src.against || []).forEach(a => flags.push({ level: 'warn', kind: 'oneway', text: `The route travels against the one-way direction of ${a.name} for ${fmt(a.s1 - a.s0, 0)} ft (from ${fmt(a.s0, 0)} ft along the OpenStreetMap path): an escort / traffic control or a permit is needed.` }));
    if (dev && dev.max > 10) flags.push({ level: 'warn', kind: 'align', text: `The fitted alignment is up to ${fmt(dev.max, 1)} ft from the line it was fitted to: check the fit (tolerance, detection window) or edit the PIs.` });
    return { dev, n: curves.length, rmin: isFinite(rmin) ? rmin : null, Rv, src: src.kind || 'click', flags };
  }
  /* the swept outline rings (every `every` ft) and the corner traces, for drawing */
  function swept(sim, every) {
    every = every || 2; const rings = [], tr = {};
    let last = -Infinity; sim.samples.forEach((q, i) => { if (q.s - last >= every - 1e-9 || i === sim.samples.length - 1) { last = q.s; q.parts.forEach(pp => rings.push(pp.poly)); } q.parts.forEach(pp => pp.poly.forEach((c, j) => { const key = pp.part + j; (tr[key] || (tr[key] = [])).push(c); })); });
    return { rings, traces: tr };
  }
  window.CranePickRoute = { fitted, pathAl, alignOf, KIND_LBL, loadPose, tandemOf, TYPES, VDEF, LDEF, RDEF, STEP, REF, LB_PER_TON, vehOf, loadOf, path, at, simulate, steady, turnsOf, conflicts, overhead, axles, haul, bridges, staging, loadCg, evaluate, swept, outlines, pose, steered, hasJeep };
})();
