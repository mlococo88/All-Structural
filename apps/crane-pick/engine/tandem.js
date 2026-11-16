/* apps/crane-pick/engine/tandem.js — girder lifts: one crane or two cranes in tandem on one girder (window.CranePickTandem). Classic
   script, no DOM. C5 (2026-11-16). Uses engine/geo.js, cranes.js, lift.js, elev.js, clear3d.js, osha.js (read at call time). Positions:
   the site frame (grid ft, x east, y north); headings: degrees clockwise from grid north; z: elevation, ft (engine/elev.js).

   tandem = { id, name, type: 'tandem' | 'single', slots: [setupId, setupId] (crane 1, crane 2; 'single': slot 1 only),
              girder: { L (ft), W (lb, girder 1), cg (ft from end A; null = L / 2), cgT (transverse, ft, + to the right of A→B; null = 0),
                        H (depth, ft), B (width in plan, ft), pair: { on, s (line spacing, ft), W2 (lb; null = W), cg2 (ft; null = cg),
                        xf (cross-frame weight, lb), xfCg (ft from end A; null = L / 2) } },
              hooks: [ { s (lifting point / spreader centre, ft from end A), sp (spreader length, ft; drawing only), rig (rigging weight,
                        lb: slings, spreader / lifting beam, hardware), hook (block, lb), ded (other deductions, lb), hookLabel, rigH (hook to
                        girder top, ft), blk (block height, ft) } × 2 ],
              pick: pose, set: pose, way: [ { x, y, h } ] (intermediate waypoints in plan, at the travel height), trav (girder bottom el.
              during the travel, ft; null = the higher of the pick and the set) }
   pose   = { x, y (the girder's mid-length point on its axis), h (heading of the axis, end A → end B), z (girder bottom elevation, ft;
              null = crane 1's pad) }
   Settings: P.lift.tandem (the tandem limit, % of chart per crane, default 75; separate from the single-crane thresholds), obstClr.

   Calculations (CLAUDE.md §4: new, stated in the PR and the fix log; Decisions pending engineer review):
     combined object (paired girders: line 1 at t = −s/2, line 2 at t = +s/2, cross-frames on the axis t = 0):
       W_g = W_1 + W_2 + W_xf;  x_cg = (W_1 x_1 + W_2 x_2 + W_xf x_xf) / W_g;  t_cg = (W_1 (t_c − s/2) + W_2 (t_c + s/2)) / W_g
       (t_c: each girder's own transverse CG offset from its axis, e.g. a curved girder; one girder: t_cg = t_c)
     load share, hooks plumb (statics about the girder's axis; the hooks act on the axis line through the CG, t = t_cg):
       R_1 = W_g (x_2 − x_cg) / (x_2 − x_1),  R_2 = W_g − R_1;  each hook: W_i = R_i + W_rig,i + W_hook,i + W_other,i
       single crane: the hook plumb above the CG, W = W_g + W_rig + W_hook + W_other
     hook position (plumb above its lifting point): p = c + (x_i − L/2) â + t_cg n̂,  â = (sin h, cos h), n̂ = (cos h, −sin h)
     at each step, for each crane: R, θ, zone, C (engine/lift.js evalAt: the C2 lookup rule), %chart = W_i / C × 100; tandem: over the
       tandem limit when %chart ≥ the limit; heights: z_hk = z_b + H + h_r, z_bk = z_hk + h_bk, z_tip (engine/elev.js tipAt), hook reach
       margin m = z_tip − H_hd − z_bk
   Ground (engine/ground.js): each crane's float / track loads with its own hook load W_i at its own hook positions (every step), bearing,
     mats; the stress at depth from both setups' supports summed (GR.depthPair).
   Path: hoist at the pick pose (z_b from z_pick to z_tr), travel through the waypoints (each leg: the centre moves linearly in plan and
     the heading turns linearly by the shorter way), lower at the set pose (z_tr to z_set); z_tr = the entered travel elevation, else
     max(z_pick, z_set). Steps: every 1 ft of vertical travel; each leg in n = ⌈max over the cranes of (hook travel / 1 ft, slew / 1°)⌉
     equal steps (both measured on 48 sub-steps of the leg).
   Clearances at every step (engine/clear3d.js shapes and distances): each crane's boom (foot pin to tip, a cylinder of b_w / 2), load
     line (girder top to tip, vertical at the hook) and counterweight (tail-swing cylinder), and the girder as a box (plan rectangle
     L × B about the girder's axis; a pair: L × (s + B) about the pair's axis; from z_b to z_b + H): d = √(d_plan² + Δz²) (both
     vertical prisms); against power lines (D_min), obstructions (contact / obstruction clearance) and exclusion zones. Crane–crane: the
     least 3D distance between the two booms and load lines (segment–segment), less the boom half-widths; contact red, closer than the
     obstruction clearance amber. Girder level: the hook-height difference z_hk,1 − z_hk,2 (informational). */
(function () {
  'use strict';
  const G = () => window.CranePickGeo, K = () => window.CranePickCranes, LF = () => window.CranePickLift, EL = () => window.CranePickElev, C3 = () => window.CranePickClear, O = () => window.CranePickOSHA;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const n0 = v => isNum(v) ? v : 0;
  const tx = (x, d) => { if (!isNum(x)) return String(x); const s = Math.abs(x).toFixed(d), [i, p] = s.split('.'); return (x < 0 && Number(s) !== 0 ? '\\minus ' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '{,}') + (p ? '.' + p : ''); };
  const fmt = (v, d) => isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const st = (pre, o) => Object.assign({ unit: '', d: 2, ref: '', note: '', eq: '', sub: '' }, o, { id: pre + '.' + o.id });
  const rad = d => d * Math.PI / 180;
  const LIMIT = 75;
  const CLS = { ok: 'within the tandem limit', over: 'over the tandem limit', np: 'not permitted' };
  const limitOf = s => s && isNum(s.tandem) && s.tandem > 0 ? s.tandem : LIMIT;
  const norm180 = a => { a = ((a % 360) + 360) % 360; return a > 180 ? a - 360 : a; };
  /* ---------- the girder (combined object) and the load share ---------- */
  /* object(t, idp) -> { L, W1, W2, Wx, Wg, xcg, tcg, H, B, pair, tmin, tmax, steps } */
  function object(t, idp) {
    idp = idp || 'tg'; const g = t.girder || {}, L = isNum(g.L) && g.L > 0 ? g.L : 0, W1 = n0(g.W), x1 = isNum(g.cg) ? g.cg : L / 2, tc = n0(g.cgT), pr = g.pair || {}, on = !!pr.on;
    const H = n0(g.H), B = n0(g.B), steps = [];
    if (!on) {
      if (!isNum(g.cg)) steps.push(st(idp, { id: 'xcg', label: 'Girder CG along the girder (not entered: mid-length)', sym: 'x_{cg}', eq: '\\frac{L}{2}', sub: `\\frac{${tx(L, 2)}}{2}`, value: x1, unit: 'ft' }));
      else steps.push(st(idp, { id: 'xcg', label: 'Girder CG along the girder from end A (entered)', sym: 'x_{cg}', value: x1, unit: 'ft' }));
      return { L, W1, W2: 0, Wx: 0, Wg: W1, xcg: x1, tcg: tc, H, B, pair: false, tmin: -B / 2, tmax: B / 2, steps,
        Wsteps: [st(idp, { id: 'Wg', label: 'Girder weight', sym: 'W_{g}', value: W1, unit: 'lb', d: 0 })] };
    }
    const s = n0(pr.s), W2 = isNum(pr.W2) ? pr.W2 : W1, x2 = isNum(pr.cg2) ? pr.cg2 : x1, Wx = n0(pr.xf), xx = isNum(pr.xfCg) ? pr.xfCg : L / 2, Wg = W1 + W2 + Wx;
    const xcg = Wg > 0 ? (W1 * x1 + W2 * x2 + Wx * xx) / Wg : L / 2, tcg = Wg > 0 ? (W1 * (tc - s / 2) + W2 * (tc + s / 2)) / Wg : tc;
    const Wsteps = [st(idp, { id: 'Wg', label: 'Combined weight: two girders and the cross-frames', sym: 'W_{g}', eq: 'W_{1} + W_{2} + W_{xf}', sub: `${tx(W1, 0)} + ${tx(W2, 0)} + ${tx(Wx, 0)}`, value: Wg, unit: 'lb', d: 0,
      note: `Girder 2 ${isNum(pr.W2) ? 'entered' : 'as girder 1 (not entered)'}.` })];
    steps.push(st(idp, { id: 'xcg', label: 'Combined CG along the girders from end A', sym: 'x_{cg}', eq: '\\frac{W_{1} x_{1} + W_{2} x_{2} + W_{xf} x_{xf}}{W_{g}}', sub: `\\frac{${tx(W1, 0)} \\cdot ${tx(x1, 2)} + ${tx(W2, 0)} \\cdot ${tx(x2, 2)} + ${tx(Wx, 0)} \\cdot ${tx(xx, 2)}}{${tx(Wg, 0)}}`, value: xcg, unit: 'ft',
      note: `x_1, x_2: each girder's CG (${isNum(g.cg) ? 'entered' : 'mid-length'}${isNum(pr.cg2) ? '; girder 2 entered' : ''}); x_xf: the cross-frames' CG (${isNum(pr.xfCg) ? 'entered' : 'mid-length'}).` }),
      st(idp, { id: 'tcg', label: 'Combined CG across (from the pair\'s axis, + to the right of A→B; girder 1 at −s/2, girder 2 at +s/2, cross-frames on the axis)', sym: 't_{cg}', eq: '\\frac{W_{1} (t_{c} - s/2) + W_{2} (t_{c} + s/2)}{W_{g}}', sub: `\\frac{${tx(W1, 0)} (${tx(tc, 2)} - ${tx(s / 2, 2)}) + ${tx(W2, 0)} (${tx(tc, 2)} + ${tx(s / 2, 2)})}{${tx(Wg, 0)}}`, value: tcg, unit: 'ft' }));
    return { L, W1, W2, Wx, Wg, xcg, tcg, H, B, pair: true, s, x1, x2, xx, tmin: -s / 2 - B / 2, tmax: s / 2 + B / 2, steps, Wsteps };
  }
  /* share(t, idp) -> { ob, single, xs: [x_1, x_2], R: [..], Wh: [..], ok, flags, steps } */
  function share(t, idp) {
    idp = idp || 'tg'; const ob = object(t, idp), hk = t.hooks || [], single = t.type === 'single', flags = [], steps = ob.Wsteps.concat(ob.steps);
    const extra = h => n0(h && h.rig) + n0(h && h.hook) + n0(h && h.ded);
    const hookStep = (i, R, h) => st(idp, { id: 'W' + (i + 1), label: `Hook load, crane ${i + 1} (girder share + rigging + hook block + other deductions; the chart capacities are gross)`, sym: `W_{${i + 1}}`, eq: `R_{${i + 1}} + W_{rig,${i + 1}} + W_{hook,${i + 1}} + W_{other,${i + 1}}`,
      sub: `${tx(R, 0)} + ${tx(n0(h && h.rig), 0)} + ${tx(n0(h && h.hook), 0)} + ${tx(n0(h && h.ded), 0)}`, value: R + extra(h), unit: 'lb', d: 0, note: `Hook block: ${h && h.hookLabel || (n0(h && h.hook) ? 'entered' : 'none entered')}.` });
    if (single) {
      steps.push(st(idp, { id: 'R1', label: 'Single crane: the hook plumb above the CG carries the whole girder', sym: 'R_{1}', eq: 'W_{g}', sub: tx(ob.Wg, 0), value: ob.Wg, unit: 'lb', d: 0 }), hookStep(0, ob.Wg, hk[0]));
      return { ob, single, xs: [ob.xcg], R: [ob.Wg], Wh: [ob.Wg + extra(hk[0])], ok: ob.Wg > 0, flags, steps };
    }
    const x1 = n0(hk[0] && hk[0].s), x2 = n0(hk[1] && hk[1].s), span = x2 - x1;
    if (Math.abs(span) < 1e-9) { flags.push({ kind: 'share', level: 'stop', text: 'The two lifting points are at the same place along the girder: the load share is not defined. Move a lifting point.' });
      return { ob, single, xs: [x1, x2], R: [null, null], Wh: [null, null], ok: false, flags, steps }; }
    const R1 = ob.Wg * (x2 - ob.xcg) / span, R2 = ob.Wg - R1;
    steps.push(st(idp, { id: 'R1', label: 'Girder share at crane 1 (statics, hooks plumb: moments about lifting point 2)', sym: 'R_{1}', eq: 'W_{g} \\frac{x_{2} - x_{cg}}{x_{2} - x_{1}}', sub: `${tx(ob.Wg, 0)} \\frac{${tx(x2, 2)} - ${tx(ob.xcg, 2)}}{${tx(x2, 2)} - ${tx(x1, 2)}}`, value: R1, unit: 'lb', d: 0,
      note: 'x_1, x_2: the lifting points (or each spreader\'s centre) from end A.' }),
      st(idp, { id: 'R2', label: 'Girder share at crane 2 (vertical equilibrium)', sym: 'R_{2}', eq: 'W_{g} - R_{1}', sub: `${tx(ob.Wg, 0)} - ${tx(R1, 0)}`, value: R2, unit: 'lb', d: 0 }),
      hookStep(0, R1, hk[0]), hookStep(1, R2, hk[1]));
    const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
    if (ob.xcg < lo - 1e-9 || ob.xcg > hi + 1e-9) flags.push({ kind: 'share', level: 'stop', text: `The CG (x_cg = ${fmt(ob.xcg, 2)} ft) is outside the lifting points (${fmt(lo, 2)} … ${fmt(hi, 2)} ft): one hook would have to push down (R = ${fmt(Math.min(R1, R2), 0)} lb); the girder tips. Move the lifting points.` });
    return { ob, single, xs: [x1, x2], R: [R1, R2], Wh: [R1 + extra(hk[0]), R2 + extra(hk[1])], ok: R1 >= -1e-9 && R2 >= -1e-9, flags, steps };
  }
  /* ---------- poses ---------- */
  const axis = h => ({ ax: Math.sin(rad(h)), ay: Math.cos(rad(h)), nx: Math.cos(rad(h)), ny: -Math.sin(rad(h)) });
  /* at(pose, L, x, tr): the plan point x ft from end A, tr ft to the right of the axis */
  function at(pose, L, x, tr) { const a = axis(pose.h || 0), u = x - L / 2; return { x: pose.x + u * a.ax + (tr || 0) * a.nx, y: pose.y + u * a.ay + (tr || 0) * a.ny }; }
  /* outline(t, pose, ob) -> { box (plan polygon of the object; a segment when it has no width), lines: [[A, B]] (each girder's axis) } */
  function outline(t, pose, ob) {
    ob = ob || object(t); const L = ob.L, lines = (ob.pair ? [-ob.s / 2, ob.s / 2] : [0]).map(o => [at(pose, L, 0, o), at(pose, L, L, o)]);
    const box = ob.tmax - ob.tmin > 1e-9 ? [at(pose, L, 0, ob.tmin), at(pose, L, L, ob.tmin), at(pose, L, L, ob.tmax), at(pose, L, 0, ob.tmax)] : [at(pose, L, 0, ob.tmin), at(pose, L, L, ob.tmin)];
    return { box, lines };
  }
  /* hooks(t, pose, sh) -> plan positions of the hooks (crane 1, crane 2) */
  function hooks(t, pose, sh) { return sh.xs.map(x => at(pose, sh.ob.L, x, sh.ob.tcg)); }
  /* ---------- the path ---------- */
  function zOf(pose, zPad) { return isNum(pose && pose.z) ? pose.z : zPad; }
  /* path(t, env, sh) -> { list: [{ i, phase, pose: {x,y,h,z}, leg, k, n }], zP, zS, zT, trEntered, legs: [{ n, hookD, slew }], steps } */
  function path(t, env, sh, idp) {
    idp = idp || 'tg'; const zP = zOf(t.pick, env.zPad), zS = zOf(t.set, env.zPad), zT = isNum(t.trav) ? t.trav : Math.max(zP, zS);
    const nodes = [t.pick].concat(t.way || [], [t.set]).map(p => ({ x: p.x, y: p.y, h: isNum(p.h) ? p.h : 0 })), list = [], legs = [];
    const push = (phase, pose, leg, k, n) => list.push({ i: list.length, phase, pose, leg, k, n });
    const nH = Math.ceil(Math.abs(zT - zP) - 1e-9);
    for (let k = 0; k < nH; k++) push('hoist', { x: nodes[0].x, y: nodes[0].y, h: nodes[0].h, z: zP + (zT - zP) * k / nH }, -1, k, nH);
    for (let j = 0; j + 1 < nodes.length; j++) {
      const a = nodes[j], b = nodes[j + 1], dh = norm180(b.h - a.h), pose = u => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, h: ((a.h + dh * u) % 360 + 360) % 360, z: zT });
      // n: the finer of 1 ft of hook travel and 1° of slew, for every crane, measured on 48 sub-steps
      let hookD = 0, slew = 0; const m = 48;
      (env.setups || []).forEach((u, i) => { if (!u) return; let d = 0, s = 0, prev = null;
        for (let q = 0; q <= m; q++) { const p = hooks(t, pose(q / m), sh)[i]; if (!p) return; const az = G().azimuth(u, p); if (prev) { d += Math.hypot(p.x - prev.p.x, p.y - prev.p.y); s += Math.abs(norm180(az - prev.az)); } prev = { p, az }; }
        hookD = Math.max(hookD, d); slew = Math.max(slew, s); });
      const n = Math.max(1, Math.ceil(Math.max(hookD, slew) - 1e-9)); legs.push({ n, hookD, slew, dh, len: Math.hypot(b.x - a.x, b.y - a.y) });
      for (let k = 0; k < n; k++) push('travel', pose(k / n), j, k, n);
      if (j + 2 === nodes.length) push('travel', pose(1), j, n, n);
    }
    const nL = Math.ceil(Math.abs(zT - zS) - 1e-9), last = nodes[nodes.length - 1];
    for (let k = 1; k <= nL; k++) push('lower', { x: last.x, y: last.y, h: last.h, z: zT + (zS - zT) * k / nL }, nodes.length - 1, k, nL);
    const steps = [st(idp, { id: 'ztr', label: isNum(t.trav) ? 'Girder bottom elevation during the travel (entered)' : 'Girder bottom elevation during the travel (not entered: the higher of the pick and the set)', sym: 'z_{tr}', eq: isNum(t.trav) ? '' : '\\max(z_{pick}, z_{set})', sub: isNum(t.trav) ? '' : `\\max(${tx(zP, 2)}, ${tx(zS, 2)})`, value: zT, unit: 'ft',
      note: `z_pick, z_set: the girder bottom at the pick (on the truck) and at the set (on the bearings)${isNum(t.pick.z) && isNum(t.set.z) ? '' : '; not entered: crane 1\'s pad'}.` })];
    legs.forEach((g, j) => steps.push(st(idp, { id: 'n' + j, label: `Steps on travel leg ${j + 1} (${fmt(g.len, 2)} ft in plan, turning ${fmt(g.dh, 1)}°): the finer of 1 ft of hook travel and 1° of slew`, sym: `n_{${j + 1}}`, eq: '\\text{ceil}(\\max(\\frac{s_{hook}}{1\\,\\text{ft}}, \\frac{\\Delta\\alpha}{1^{\\circ}}))', sub: `\\text{ceil}(\\max(${tx(g.hookD, 2)}, ${tx(g.slew, 2)}))`, value: g.n, unit: '', d: 0 })));
    return { list, zP, zS, zT, trEntered: isNum(t.trav), legs, nH, nL, steps };
  }
  /* ---------- one step ---------- */
  function where(x) {
    if (!x) return '';
    if (x.phase === 'hoist') return `hoisting at the pick, girder bottom el. ${fmt(x.pose.z, 2)}`;
    if (x.phase === 'lower') return `lowering at the set, girder bottom el. ${fmt(x.pose.z, 2)}`;
    return x.k === 0 && x.leg === 0 ? 'at the pick (travel height)' : x.k === x.n && x.leg >= 0 && x.last ? 'at the set (travel height)' : `travel leg ${x.leg + 1}, step ${x.k} of ${x.n}`;
  }
  function evalStep(X, x, full) {
    const t = X.t, sh = X.sh, H = sh.ob.H, hp = hooks(t, x.pose, sh), out = { x, cr: [] };
    X.env.setups.forEach((u, i) => {
      const c = X.env.cranes[i]; if (!u || !c) { out.cr.push(null); return; }
      const p = hp[i], e = LF().evalAt(c, u, p, sh.Wh[i], X.s, `${X.idp}.c${i + 1}.s${x.i}`, X.chs[i]);
      const g = X.geo[i], h = t.hooks[i] || {}, zTip = EL().tipAt(c, u, e.cfg, e.R, g), zHk = x.pose.z + H + n0(h.rigH), zBk = zHk + n0(h.blk);
      const tcls = !e.look.ok ? 'np' : sh.single ? e.cls : (e.pct >= X.lim - 1e-9 ? 'over' : 'ok');
      const az = rad(e.az), zp = EL().padEl(u), foot = { x: u.x + g.footE * Math.sin(az), y: u.y + g.footE * Math.cos(az), z: zp + g.footH };
      out.cr.push({ p, e: full ? e : { R: e.R, az: e.az, theta: e.theta, zone: e.zone, cfg: e.cfg, C: e.C, pct: e.pct, cls: e.cls, look: { ok: e.look.ok, why: e.look.why } }, R: e.R, C: e.C, pct: e.pct, cls: tcls, zTip, zHk, zBk, margin: isNum(zTip) ? zTip - g.head - zBk : null, foot, tip: isNum(zTip) ? { x: p.x, y: p.y, z: zTip } : null, rb: (g.boomW || 0) / 2 });
    });
    return out;
  }
  /* ---------- evaluate ---------- */
  /* evaluate(t, env, idp): env = { setups: [u1, u2], cranes: [def1, def2], items, s (engine/lift.js settingsOf + tandem), zPad } ->
     { sh, path, steps: [step], gov: [per crane], flags, clr: [...], cc (crane–crane), level, ok } */
  function evaluate(t, env, idp) {
    idp = idp || 'tg'; const s = env.s || LF().settingsOf(null), lim = limitOf(s), single = t.type === 'single', nC = single ? 1 : 2;
    env = Object.assign({}, env, { setups: (env.setups || []).slice(0, nC), cranes: (env.cranes || []).slice(0, nC) });
    const flags = [], sh = share(t, idp + '.ls'); flags.push(...sh.flags);
    for (let i = 0; i < nC; i++) if (!env.setups[i] || !env.cranes[i]) flags.push({ kind: 'slot', level: 'stop', text: `Crane ${i + 1}: no crane setup chosen (or its crane is not in the project).` });
    if (!(sh.ob.L > 0)) flags.push({ kind: 'girder', level: 'stop', text: 'Enter the girder length.' });
    if (!(sh.ob.Wg > 0)) flags.push({ kind: 'girder', level: 'warn', text: 'Enter the girder weight.' });
    const X = { t, env, sh, s, lim, idp, chs: env.setups.map((u, i) => u && env.cranes[i] ? LF().chartsOf(env.cranes[i], u) : null), geo: env.cranes.map(c => c ? EL().geomOf(c) : null) };
    const pa = path(t, env, sh, idp + '.path'); pa.list.forEach((x, i) => { x.last = i === pa.list.length - 1 - pa.nL; });
    const ready = env.setups.every(Boolean) && env.cranes.every(Boolean) && sh.ob.L > 0 && sh.Wh.every(isNum);
    const res = { sh, path: pa, steps: [], gov: [], flags, clr: [], cc: null, lim, single, nC, ok: false };
    if (!ready) { res.level = 'stop'; return res; }
    res.steps = pa.list.map(x => evalStep(X, x, false));
    // the governing step of each crane: the highest % of chart (any step not permitted governs; a tie: the first)
    for (let i = 0; i < nC; i++) {
      let gi = -1; res.steps.forEach((q, j) => { const c = q.cr[i]; if (!c) return; const g = gi >= 0 ? res.steps[gi].cr[i] : null;
        if (!g || (g.cls !== 'np' && (c.cls === 'np' || c.pct > g.pct + 1e-9))) gi = j; });
      const q = res.steps[gi], full = evalStep(X, q.x, true).cr[i], c = q.cr[i], lab = `${idp}.c${i + 1}`;
      const gsteps = full.e.steps.slice();
      if (full.e.look.ok && !single) gsteps.push(st(lab, { id: 'lim', label: 'Tandem limit (project setting, % of chart per crane)', sym: '\\%_{chart}', eq: '\\lt \\%_{tandem}', sub: `${tx(full.pct, 1)} \\lt ${tx(lim, 0)}`, value: full.pct < lim - 1e-9 ? 'OK' : 'NOT OK', d: 0, ok: full.pct < lim - 1e-9 }));
      const u = env.setups[i], g = X.geo[i], h = t.hooks[i] || {};
      gsteps.push(st(lab, { id: 'hk', label: 'Hook elevation (girder bottom + depth + rigging height)', sym: 'z_{hk}', eq: 'z_{b} + H + h_{r}', sub: `${tx(q.x.pose.z, 2)} + ${tx(sh.ob.H, 2)} + ${tx(n0(h.rigH), 2)}`, value: c.zHk, unit: 'ft' }),
        st(lab, { id: 'bk', label: 'Top of the hook block', sym: 'z_{bk}', eq: 'z_{hk} + h_{bk}', sub: `${tx(c.zHk, 2)} + ${tx(n0(h.blk), 2)}`, value: c.zBk, unit: 'ft' }));
      if (isNum(c.zTip)) { const th = EL().angleAt(env.cranes[i], u, full.e.cfg, c.R, g, lab + '.a', true);
        gsteps.push(st(lab, { id: 'tip', label: 'Boom-tip pin elevation (engine/elev.js: the chart\'s boom angle where printed, else the geometry)', sym: 'z_{tip}', eq: 'z_{pad} + h_{f} + L\\,\\text{sin}\\,\\theta', sub: `${tx(EL().padEl(u), 2)} + ${tx(g.footH, 2)} + ${tx(u.boom, 2)}\\,\\text{sin}\\,${tx(th.theta, 2)}^{\\circ}`, value: c.zTip, unit: 'ft' }),
          st(lab, { id: 'm', label: 'Hook reach margin', sym: 'm', eq: 'z_{tip} - H_{hd} - z_{bk}', sub: `${tx(c.zTip, 2)} - ${tx(g.head, 2)} - ${tx(c.zBk, 2)}`, value: c.margin, unit: 'ft', ok: c.margin >= 0 })); }
      res.gov.push({ i: gi, x: q.x, where: where(q.x), c, e: full.e, steps: gsteps, nOver: res.steps.filter(z => z.cr[i] && (z.cr[i].cls === 'over' || z.cr[i].cls === 'np')).length });
      const gv = res.gov[i];
      if (c.cls === 'np') flags.push({ kind: 'cap', level: 'stop', crane: i, step: gi, text: `Crane ${i + 1}: not permitted at step ${gi} (${gv.where}): ${full.e.look.why || 'outside the chart'}.` });
      else if (!single && c.cls === 'over') flags.push({ kind: 'cap', level: 'stop', crane: i, step: gi, text: `Crane ${i + 1}: ${fmt(c.pct, 1)} % of chart at step ${gi} (${gv.where}) ≥ the tandem limit ${fmt(lim, 0)} % (${gv.nOver} of ${res.steps.length} steps over).` });
      else if (single && (c.cls === 'over' || c.cls === 'critical' || c.cls === 'caution')) flags.push({ kind: 'cap', level: c.cls === 'over' ? 'stop' : 'warn', crane: i, step: gi, text: `${fmt(c.pct, 1)} % of chart at step ${gi} (${gv.where}): ${LF().CLS[c.cls]}.` });
      // heights along the path
      let mm = null; res.steps.forEach((z, j) => { const r = z.cr[i]; if (!r) return; const m = isNum(r.margin) ? r.margin : -Infinity; if (!mm || m < mm.m) mm = { m, j }; });
      gv.reach = mm;
      if (mm && mm.m < 0) flags.push({ kind: 'elev', level: 'stop', crane: i, step: mm.j, text: mm.m === -Infinity ? `Crane ${i + 1}: the boom cannot reach the hook at step ${mm.j} (${where(res.steps[mm.j].x)}).` : `Crane ${i + 1}: the hook block reaches above the allowed height at step ${mm.j} (${where(res.steps[mm.j].x)}; hook reach margin ${fmt(mm.m, 2)} ft).` });
      if (g.assumed.length) flags.push({ kind: 'geom', level: 'info', crane: i, text: `Crane ${i + 1}: geometry assumed (not in the file, not entered): ${g.assumed.join('; ')}.` });
    }
    // girder level (informational): the hook-height difference
    if (!single) { const d = n0((t.hooks[0] || {}).rigH) - n0((t.hooks[1] || {}).rigH); res.level = { d, steps: [st(idp, { id: 'lvl', label: 'Girder level: hook-height difference (informational; the girder is carried level)', sym: '\\Delta z_{hk}', eq: 'z_{hk,1} - z_{hk,2} = h_{r,1} - h_{r,2}', sub: `${tx(n0(t.hooks[0].rigH), 2)} - ${tx(n0(t.hooks[1].rigH), 2)}`, value: d, unit: 'ft' })] };
      if (Math.abs(d) > 1e-9) flags.push({ kind: 'level', level: 'info', text: `Girder level: the hooks are ${fmt(Math.abs(d), 2)} ft apart in height (rigging heights differ) for the girder to hang level.` }); }
    clearances(X, res);
    if (!single) crane2(X, res);
    ground(X, res);
    res.ok = !flags.some(f => f.level === 'stop');
    return res;
  }
  /* ---------- clearances along the path ---------- */
  const COMP = { boom: 'boom', line: 'load line', girder: 'girder', cw: 'counterweight (tail swing)' };
  function boxPrism(box, zb, zt, Q) {
    const ca = box.length >= 3, cb = Q.F.length >= 3, dp = LF().minDist(box, ca, Q.F, cb), gap = Math.max(0, Q.z0 - zt, zb - Q.z1);
    return { d: Math.hypot(dp, gap) };
  }
  function clearances(X, res) {
    const t = X.t, sh = X.sh, H = sh.ob.H, zPad = X.env.zPad, s = X.s;
    (X.env.items || []).forEach(it => {
      if (['power', 'obst', 'excl'].indexOf(it.type) < 0) return;
      const ip = `${X.idp}.${it.id}`, env = C3().envelope(it, zPad, ip), nm = it.name || it.type, best = {};
      const take = (key, comp, crane, r, j) => { if (r && (!best[key] || r.d < best[key].d - 1e-12)) best[key] = Object.assign({ comp, crane, j }, r); };
      env.prisms.forEach(Q => {
        X.env.setups.forEach((u, i) => { const g = X.geo[i]; if (it.type !== 'excl' && isNum(g.tail) && g.tail > 0) { const zp = EL().padEl(u); take('cw' + i, 'cw', i, C3().discPrism({ x: u.x, y: u.y }, g.tail, zp + g.cwBot, isNum(g.cwTop) ? zp + g.cwTop : C3().BIG, Q), 0); } });
        res.steps.forEach((z, j) => {
          z.cr.forEach((c, i) => { if (!c || !c.tip) return;
            const r = C3().segPrism(c.foot, c.tip, Q); take('boom' + i, 'boom', i, { d: Math.max(0, r.d - c.rb), d0: r.d, p: r.p, q: r.q }, j);
            take('line' + i, 'line', i, C3().discPrism(c.p, 0, z.x.pose.z + H, c.tip.z, Q), j); });
          const ol = outline(t, z.x.pose, sh.ob); take('girder', 'girder', null, boxPrism(ol.box, z.x.pose.z, z.x.pose.z + H, Q), j);
        });
      });
      const list = Object.keys(best).map(k => best[k]); if (!list.length) return;
      const gov = list.reduce((a, b) => b.d < a.d ? b : a), wh = gov.comp === 'cw' ? 'at every slew (tail swing)' : `step ${gov.j} (${where(res.steps[gov.j].x)})`;
      const cn = gov.crane == null ? '' : `crane ${gov.crane + 1} `, r = { item: it.id, type: it.type, name: nm, env, comps: list, gov, where: wh, steps: env.steps.slice(), level: 'ok', text: '' };
      r.steps.push(st(ip, { id: 'd', label: `Closest 3D distance along the path: ${cn}${COMP[gov.comp]} to "${nm}" (${wh})`, sym: 'd', eq: gov.comp === 'girder' ? '\\sqrt{d_{plan}^{2} + \\Delta z^{2}}' : '', sub: '', value: gov.d, unit: 'ft',
        note: 'Every step of the path (1 ft of hook travel / 1° of slew); the shapes and distances of engine/clear3d.js; the girder as a box (plan outline × depth).' }));
      const others = list.filter(x => x !== gov).map(x => `${x.crane == null ? '' : 'crane ' + (x.crane + 1) + ' '}${COMP[x.comp]} ${fmt(x.d, 2)} ft`).join(', ');
      if (it.type === 'power') {
        const oc = O().clearance({ kv: it.kv, le350: it.le350, setFt: it.setFt }, ip + '.osha'), D = oc.ft; r.D = D; r.steps.unshift(...oc.steps);
        if (!isNum(D)) { r.level = 'stop'; r.text = `"${nm}": clearance not set (over 1,000 kV): enter the utility / RPE distance.`; }
        else { r.steps.push(st(ip, { id: 'chk', label: `OSHA minimum clearance in 3D (${oc.basis})`, sym: 'd', eq: '\\ge D_{min}', sub: `${tx(gov.d, 2)} \\ge ${tx(D, 0)}`, value: gov.d >= D ? 'OK' : 'NOT OK', d: 0, ref: oc.ref, ok: gov.d >= D, note: `Other components: ${others || 'none'}.` }));
          r.level = gov.d < D - 1e-9 ? 'stop' : 'info';
          r.text = gov.d < D - 1e-9 ? `The ${cn}${COMP[gov.comp]} comes within ${fmt(gov.d, 1)} ft of "${nm}" (${wh}) < D_min = ${fmt(D, 0)} ft (29 CFR 1926.1408).` : `"${nm}": closest ${fmt(gov.d, 1)} ft (${cn}${COMP[gov.comp]}, ${wh}) ≥ D_min = ${fmt(D, 0)} ft.`; }
      } else if (it.type === 'obst') {
        r.req = s.obstClr;
        if (!env.known) { if (gov.d < s.obstClr - 1e-9) { r.level = 'warn'; r.text = `"${nm}": height not entered; in plan the ${cn}${COMP[gov.comp]} comes within ${fmt(gov.d, 1)} ft of it (${wh}).`; } }
        else { r.steps.push(st(ip, { id: 'chk', label: 'Clearance to the obstruction (project setting)', sym: 'd', eq: '\\ge c_{obst}', sub: `${tx(gov.d, 2)} \\ge ${tx(s.obstClr, 2)}`, value: gov.d >= s.obstClr ? 'OK' : gov.d <= 1e-9 ? 'CONTACT' : 'NOT OK', d: 0, ok: gov.d >= s.obstClr, note: `Other components: ${others || 'none'}.` }));
          if (gov.d <= 1e-9) { r.level = 'stop'; r.text = `The ${cn}${COMP[gov.comp]} meets the obstruction "${nm}" (${wh}).`; }
          else if (gov.d < s.obstClr - 1e-9) { r.level = 'warn'; r.text = `The ${cn}${COMP[gov.comp]} comes within ${fmt(gov.d, 2)} ft of the obstruction "${nm}" (${wh}) < ${fmt(s.obstClr, 2)} ft.`; } }
      } else { const hits = list.filter(x => x.d <= 1e-9); if (hits.length) { r.level = 'warn'; r.text = `Over the exclusion zone "${nm}": ${hits.map(x => (x.crane == null ? '' : 'crane ' + (x.crane + 1) + ' ') + COMP[x.comp]).join(', ')}.`; } }
      res.clr.push(r);
      if (r.level !== 'ok') res.flags.push({ kind: 'c3-' + it.type, level: r.level, item: it.id, step: gov.j, comp: gov.comp, crane: gov.crane, d: gov.d, p: gov.p, q: gov.q, text: r.text });
    });
  }
  /* crane–crane: the least distance between the booms and load lines of the two cranes over the path */
  function crane2(X, res) {
    let best = null;
    res.steps.forEach((z, j) => {
      const [a, b] = z.cr; if (!a || !b || !a.tip || !b.tip) return; const H = X.sh.ob.H, zt = z.x.pose.z + H;
      const la = [{ x: a.p.x, y: a.p.y, z: zt }, a.tip], lb = [{ x: b.p.x, y: b.p.y, z: zt }, b.tip];
      [['boom', 'boom', a.foot, a.tip, b.foot, b.tip, a.rb + b.rb], ['boom', 'line', a.foot, a.tip, lb[0], lb[1], a.rb], ['line', 'boom', la[0], la[1], b.foot, b.tip, b.rb], ['line', 'line', la[0], la[1], lb[0], lb[1], 0]].forEach(([c1, c2, p1, q1, p2, q2, r]) => {
        const d = C3().segSeg3(p1, q1, p2, q2); const v = Math.max(0, d.d - r); if (!best || v < best.d - 1e-12) best = { d: v, d0: d.d, r, p: d.p, q: d.q, c1, c2, j }; });
    });
    if (!best) return;
    const wh = `step ${best.j} (${where(res.steps[best.j].x)})`, P = best.p, Q = best.q, oc = X.s.obstClr;
    const steps = [st(X.idp, { id: 'cc', label: `Least distance between the two cranes: crane 1 ${COMP[best.c1]} to crane 2 ${COMP[best.c2]} (${wh})`, sym: 'd_{0}', eq: '\\sqrt{\\Delta x^{2} + \\Delta y^{2} + \\Delta z^{2}}', sub: `\\sqrt{${tx(P.x - Q.x, 2)}^{2} + ${tx(P.y - Q.y, 2)}^{2} + ${tx(P.z - Q.z, 2)}^{2}}`, value: best.d0, unit: 'ft',
      note: `Closest points (grid ft, elevation): crane 1 (${fmt(P.x, 2)}, ${fmt(P.y, 2)}, ${fmt(P.z, 2)}); crane 2 (${fmt(Q.x, 2)}, ${fmt(Q.y, 2)}, ${fmt(Q.z, 2)}).` }),
      st(X.idp, { id: 'ccd', label: 'Clear distance (less the boom half-widths)', sym: 'd', eq: 'd_{0} - \\sum \\frac{b_{w}}{2}', sub: `${tx(best.d0, 2)} - ${tx(best.r, 2)}`, value: best.d, unit: 'ft' }),
      st(X.idp, { id: 'ccchk', label: 'Crane–crane clearance (the project\'s obstruction clearance)', sym: 'd', eq: '\\ge c_{obst}', sub: `${tx(best.d, 2)} \\ge ${tx(oc, 2)}`, value: best.d >= oc ? 'OK' : best.d <= 1e-9 ? 'CONTACT' : 'NOT OK', d: 0, ok: best.d >= oc })];
    res.cc = Object.assign(best, { where: wh, steps });
    if (best.d <= 1e-9) res.flags.push({ kind: 'cc', level: 'stop', step: best.j, p: P, q: Q, text: `The two cranes meet: crane 1 ${COMP[best.c1]} and crane 2 ${COMP[best.c2]} (${wh}).` });
    else if (best.d < oc - 1e-9) res.flags.push({ kind: 'cc', level: 'warn', step: best.j, p: P, q: Q, text: `Crane 1 ${COMP[best.c1]} comes within ${fmt(best.d, 2)} ft of crane 2 ${COMP[best.c2]} (${wh}) < ${fmt(oc, 2)} ft.` });
  }
  /* ---------- ground (engine/ground.js, C4): each crane's own hook load W_i and its own hook positions at every step ----------
     res.ground = { cr: [GR.evaluate(crane i, setup i, null, P, …, { W: W_i, pts: crane i's hooks at the steps })], pair: GR.depthPair
     (both setups' supports summed for the stress at depth, tandem only) }; their flags are appended to res.flags with "Crane i: ". */
  function ground(X, res) {
    const GR = window.CranePickGround, P = X.env.P; if (!GR || !P) return;
    const outs = X.env.setups.map((u, i) => GR.evaluate(X.env.cranes[i], u, null, P, `${X.idp}.c${i + 1}.gr`, { W: X.sh.Wh[i], pts: res.steps.map(z => z.cr[i].p) }));
    res.ground = { cr: outs, pair: [] };
    outs.forEach((g, i) => (g.flags || []).forEach(f => res.flags.push(Object.assign({}, f, { kind: 'ground', crane: i, text: `Crane ${i + 1}: ${f.text}` }))));
    if (outs.length === 2 && outs.every(g => g.mode !== 'none')) {
      res.ground.pair = GR.depthPair(outs, X.env.setups, P, `${X.idp}.gr2`);
      res.ground.pair.forEach(d => { if (d.ratio > 1) res.flags.push({ kind: 'ground', level: 'stop', text: `Ground: stress at depth at "${d.name}" from both cranes together ${fmt(d.ds, 0)} psf > the entered allowable ${fmt(d.cap, 0)} psf.` }); });
    }
  }
  window.CranePickTandem = { LIMIT, CLS, COMP, limitOf, object, share, at, outline, hooks, path, evaluate, where, norm180 };
})();
