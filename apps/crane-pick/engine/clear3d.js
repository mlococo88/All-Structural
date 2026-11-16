/* apps/crane-pick/engine/clear3d.js — 3D clearances along the lift (window.CranePickClear). Classic script, no DOM. C3-2 (2026-11-16).
   Uses engine/geo.js, engine/lift.js, engine/elev.js, engine/osha.js (read at call time). Positions: grid ft (x east, y north); z:
   elevation, ft (engine/elev.js).

   The crane and the load at each check position (CLAUDE.md §4: new calculation, stated in the PR and the fix log):
     boom        the segment from the boom-foot pin (rotation centre + e along the slew azimuth, z_pad + h_f) to the tip pin (plumb above
                 the hook, z_tip from engine/elev.js); a cylinder of radius b_w / 2 (b_w: boom section width; 0 = the centre line)
     load line   the vertical segment above the hook position from the load top to the tip (hook block, rigging and hoist rope)
     load        a vertical cylinder at the hook: radius √(L² + W²) / 2 (any orientation of an L × W load in plan: conservative), from
                 the load bottom to the load top (H above it); while hoisting at the pick or lowering at the set, from the lower to the
                 upper load-bottom elevation (the whole vertical travel)
     counterweight  the tail-swing cylinder about the rotation centre (radius R_t, every slew angle: C2 decision), from z_pad + z_cb to
                 z_pad + z_ct (not given: unlimited)
   Check positions: hoisting at the pick (load bottom from z_lb,pick to z_tr), every point of the path (engine/lift.js: every degree, the
   zone boundaries, the luff every 1 ft) at z_tr, lowering at the set; the closest position of each item and component is then refined
   on the path (golden-section search between its two neighbouring points, to 1e-6 of the path).
   Site items:
     power line  each span: a prism around the conductor: in plan the span ± s_h (sway allowance), in height from z_w − s_v to z_w,
                 z_w = z_gr + h_w (lowest wire above grade, grade = the item's grade elevation, else the crane pad; s_v sag allowance).
                 Wire height not entered: the span is a vertical plane at every height (the plan distance). Required: D ≥ D_min
                 (29 CFR 1926.1408 Table A, engine/osha.js) for the boom, the load line, the load and the counterweight; the true minimum
                 3D distance and its component are reported.
     obstruction the prism of its plan polygon from below grade up to its top (top elevation, else grade + height above grade).
                 Height not entered: not checked in 3D (amber when it is within the clearance in plan). Contact (D = 0): red;
                 D < the project's obstruction clearance (default 2 ft): amber.
     exclusion zone  a vertical prism without height limits: the load, the load line or the boom over it: amber (the C2 rule, now with
                 the load's plan radius and the boom from its foot pin).
   Distances: exact for these convex / product shapes: segment–segment (Ericson, Real-Time Collision Detection, 2005, §5.1.9); point and
   segment to a prism (a segment not meeting the prism is closest to it at an end point or to one of the prism's edges); a vertical
   cylinder to a prism: √(max(0, d_plan − r)² + Δz²) (both are a plan shape times a height range). */
(function () {
  'use strict';
  const G = () => window.CranePickGeo, LF = () => window.CranePickLift, EL = () => window.CranePickElev, O = () => window.CranePickOSHA;
  const BIG = 1e4;   // "no limit" in height (ft): far beyond any lift; keeps the arithmetic well conditioned
  const isNum = v => typeof v === 'number' && isFinite(v);
  const fmt = (v, d) => isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const tx = (x, d) => { if (!isNum(x)) return String(x); const s = Math.abs(x).toFixed(d), [i, p] = s.split('.'); return (x < 0 && Number(s) !== 0 ? '\\minus ' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '{,}') + (p ? '.' + p : ''); };
  const st = (pre, o) => Object.assign({ unit: '', d: 2, ref: '', note: '', eq: '', sub: '' }, o, { id: pre + '.' + o.id });
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }), dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const along = (a, d, t) => ({ x: a.x + d.x * t, y: a.y + d.y * t, z: a.z + d.z * t }), dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  /* ---------- distances ---------- */
  /* segSeg3(p1, q1, p2, q2) -> { d, p, q } (closest points p on p1q1, q on p2q2) */
  function segSeg3(p1, q1, p2, q2) {
    const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2), a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r), E = 1e-12; let s, t;
    if (a <= E && e <= E) { s = 0; t = 0; }
    else if (a <= E) { s = 0; t = clamp(f / e, 0, 1); }
    else { const c = dot(d1, r);
      if (e <= E) { t = 0; s = clamp(-c / a, 0, 1); }
      else { const b = dot(d1, d2), den = a * e - b * b; s = den > E * a * e ? clamp((b * f - c * e) / den, 0, 1) : 0; t = (b * s + f) / e;
        if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); } } }
    const p = along(p1, d1, s), q = along(p2, d2, t); return { d: dist3(p, q), p, q };
  }
  function cpSeg2(p, a, b) { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy, t = L2 > 0 ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / L2, 0, 1) : 0; return { x: a.x + dx * t, y: a.y + dy * t }; }
  const closed = F => F.length >= 3;
  function edges2(F) { const n = F.length, e = []; if (n === 1) return [[F[0], F[0]]]; for (let i = 0; i < (closed(F) ? n : n - 1); i++) e.push([F[i], F[(i + 1) % n]]); return e; }
  /* cpPoly(p, F) -> { x, y, d }: the closest plan point of F (a filled polygon with ≥ 3 points; else a line) */
  function cpPoly(p, F) {
    if (closed(F) && G().inside(p, F)) return { x: p.x, y: p.y, d: 0 };
    let best = null; edges2(F).forEach(([a, b]) => { const q = cpSeg2(p, a, b), d = Math.hypot(p.x - q.x, p.y - q.y); if (!best || d < best.d) best = { x: q.x, y: q.y, d }; });
    return best;
  }
  /* a prism Q = { F (plan points), z0, z1 } */
  function ptPrism(p, Q) { const c = cpPoly(p, Q.F), q = { x: c.x, y: c.y, z: clamp(p.z, Q.z0, Q.z1) }; return { d: dist3(p, q), p, q }; }
  /* discPrism(c, r, za, zb, Q): a vertical cylinder (plan disc c, r; heights za … zb) to a prism */
  function discPrism(c, r, za, zb, Q) {
    const cp = cpPoly(c, Q.F), dh = Math.max(0, cp.d - r), k = cp.d > 1e-12 ? Math.min(r, cp.d) / cp.d : 0;
    let pz, qz; if (zb < Q.z0) { pz = zb; qz = Q.z0; } else if (za > Q.z1) { pz = za; qz = Q.z1; } else { pz = qz = clamp(Math.max(za, Q.z0), Q.z0, Q.z1); }
    const p = { x: c.x + (cp.x - c.x) * k, y: c.y + (cp.y - c.y) * k, z: pz }, q = { x: cp.x, y: cp.y, z: qz };
    return { d: Math.hypot(dh, pz - qz), p, q };
  }
  function cross2(a, b, c, d) { const cr = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); const d1 = cr(c, d, a), d2 = cr(c, d, b), d3 = cr(a, b, c), d4 = cr(a, b, d);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return { x: a.x + (b.x - a.x) * d1 / (d1 - d2), y: a.y + (b.y - a.y) * d1 / (d1 - d2), t: d1 / (d1 - d2) }; return null; }
  /* segPrism(a, b, Q) -> { d, p, q }: 0 when the segment meets the prism */
  function segPrism(a, b, Q) {
    // the part of ab inside the height range, then in plan against F
    let t0 = 0, t1 = 1; const dz = b.z - a.z;
    if (Math.abs(dz) < 1e-12) { if (a.z < Q.z0 || a.z > Q.z1) t0 = 2; }
    else { let u0 = (Q.z0 - a.z) / dz, u1 = (Q.z1 - a.z) / dz; if (u0 > u1) [u0, u1] = [u1, u0]; t0 = Math.max(0, u0); t1 = Math.min(1, u1); }
    if (t0 <= t1) {
      const P = t => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + dz * t }), A = P(t0), B = P(t1);
      let hit = null;
      if (closed(Q.F) && G().inside(A, Q.F)) hit = A; else if (closed(Q.F) && G().inside(B, Q.F)) hit = B;
      else for (const [c, e] of edges2(Q.F)) { const x = cross2(A, B, c, e); if (x) { hit = P(t0 + (t1 - t0) * x.t); break; }
        if (cpPoly(A, [c, e]).d < 1e-9) { hit = A; break; } if (cpPoly(B, [c, e]).d < 1e-9) { hit = B; break; } }
      if (hit) return { d: 0, p: hit, q: hit };
    }
    let best = ptPrism(a, Q); const take = r => { if (r.d < best.d) best = r; }; take(ptPrism(b, Q));
    Q.F.forEach(v => take(segSeg3(a, b, { x: v.x, y: v.y, z: Q.z0 }, { x: v.x, y: v.y, z: Q.z1 })));
    edges2(Q.F).forEach(([c, e]) => [Q.z0, Q.z1].forEach(z => take(segSeg3(a, b, { x: c.x, y: c.y, z }, { x: e.x, y: e.y, z }))));
    return best;
  }
  /* ---------- the site items as prisms ---------- */
  function spanRect(a, b, w) { if (!(w > 0)) return [a, b]; const L = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / L * w, ny = (b.x - a.x) / L * w; return [{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }, { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny }]; }
  /* envelope(item, zPad) -> { prisms: [Q], zw, z0, z1, grade, gradeEntered, known, steps } */
  function envelope(it, zPad, idp) {
    const grade = isNum(it.gradeEl) ? it.gradeEl : zPad, steps = [];
    if (it.type === 'power') {
      const known = isNum(it.height), sv = isNum(it.sag) ? it.sag : 0, sh = isNum(it.sway) ? it.sway : 0, prisms = [];
      let z0 = -BIG, z1 = BIG, zw = null;
      if (known) { zw = grade + it.height; z0 = zw - sv; z1 = zw;
        steps.push(st(idp, { id: 'zw', label: 'Lowest wire elevation', sym: 'z_{w}', eq: 'z_{gr} + h_{w}', sub: `${tx(grade, 2)} + ${tx(it.height, 2)}`, value: zw, unit: 'ft', note: `z_gr: grade at the line (${isNum(it.gradeEl) ? 'entered' : 'not entered: the crane pad'}).` }),
          st(idp, { id: 'zl', label: 'Conductor envelope: lowest point with the sag allowance', sym: 'z_{w,min}', eq: 'z_{w} - s_{v}', sub: `${tx(zw, 2)} - ${tx(sv, 2)}`, value: z0, unit: 'ft', note: `Sideways: ± s_h = ${fmt(sh, 2)} ft about the line in plan.` })); }
      else steps.push(st(idp, { id: 'zw', label: 'Lowest wire height not entered: the line is checked as a vertical plane at every height (plan distance)', sym: 'z_{w}', value: 'not entered', d: 0 }));
      for (let i = 0; i + 1 < it.pts.length; i++) prisms.push({ F: spanRect(it.pts[i], it.pts[i + 1], sh), z0, z1 });
      return { prisms, zw, z0, z1, grade, known, steps };
    }
    if (it.type === 'obst') {
      const known = isNum(it.topEl) || isNum(it.height), z1 = isNum(it.topEl) ? it.topEl : known ? grade + it.height : BIG;
      if (isNum(it.topEl)) steps.push(st(idp, { id: 'zt', label: 'Top of the obstruction (top elevation entered)', sym: 'z_{top}', value: z1, unit: 'ft' }));
      else if (known) steps.push(st(idp, { id: 'zt', label: 'Top of the obstruction', sym: 'z_{top}', eq: 'z_{gr} + h', sub: `${tx(grade, 2)} + ${tx(it.height, 2)}`, value: z1, unit: 'ft', note: `z_gr: grade (${isNum(it.gradeEl) ? 'entered' : 'not entered: the crane pad'}).` }));
      return { prisms: [{ F: it.pts, z0: -BIG, z1 }], z1, grade, known, steps };
    }
    return { prisms: [{ F: it.pts, z0: -BIG, z1: BIG }], known: true, steps };   // exclusion zone
  }
  /* ---------- the crane and load at a position ---------- */
  function ctx(c, u, k, ev, s) {
    const h = ev.elev, g = h.g, E = EL().el0(k), zp = EL().padEl(u), H = h.pick.H;
    const rL = Math.hypot(isNum(E.L) ? E.L : 0, isNum(E.W) ? E.W : 0) / 2;
    const cw = isNum(g.tail) && g.tail > 0 ? { c: { x: u.x, y: u.y }, r: g.tail, za: zp + g.cwBot, zb: isNum(g.cwTop) ? zp + g.cwTop : BIG } : null;
    return { c, u, k, ev, g, h, zp, H, rL, rb: (g.boomW || 0) / 2, cw, zTr: h.trav.z };
  }
  /* geometry at a hook position q { x, y } with the load bottom between lb0 and lb1 */
  function at(X, q, lb0, lb1, kind, t) {
    const u = X.u, R = Math.hypot(q.x - u.x, q.y - u.y), az = G().azimuth(u, q), cfg = LF().cfgAt(X.c, u, q, X.ev.chs), zTip = EL().tipAt(X.c, u, cfg, R, X.g), r = az * Math.PI / 180;
    return { kind, t, x: q.x, y: q.y, R, az, zTip, foot: { x: u.x + X.g.footE * Math.sin(r), y: u.y + X.g.footE * Math.cos(r), z: X.zp + X.g.footH }, lb0: Math.min(lb0, lb1), lb1: Math.max(lb0, lb1) };
  }
  const COMP = { boom: 'boom', line: 'load line', load: 'load', cw: 'counterweight (tail swing)' };
  function compDist(X, pos, Q, comp) {
    if (comp === 'cw') return X.cw ? discPrism(X.cw.c, X.cw.r, X.cw.za, X.cw.zb, Q) : null;
    if (comp === 'load') return discPrism(pos, X.rL, pos.lb0, pos.lb1 + X.H, Q);
    if (!isNum(pos.zTip)) return null;
    if (comp === 'line') return discPrism(pos, 0, pos.lb0 + X.H, pos.zTip, Q);
    const r = segPrism(pos.foot, { x: pos.x, y: pos.y, z: pos.zTip }, Q); return { d: Math.max(0, r.d - X.rb), d0: r.d, p: r.p, q: r.q };
  }
  function whereText(X, pos) {
    if (pos.kind === 'hoist') return 'at the pick (hoisting)';
    if (pos.kind === 'lower') return 'at the set (lowering)';
    const tL = X.ev.path.tL || 0, d = Math.abs(X.ev.path.d);
    if (pos.t <= tL && tL > 0) return `on the luff at the pick, R = ${fmt(pos.R, 1)} ft`;
    return `on the swing, ${fmt(d * (pos.t - tL) / (1 - tL || 1), 1)}° from the pick`;
  }
  /* check(crane, setup, pick, ev (engine/lift.js evaluate + ev.elev), items, settings, idp) -> { results: [...], flags: [...] } */
  function check(c, u, k, ev, items, s, idp) {
    idp = idp || 'c3'; s = s || LF().settingsOf(null);
    const out = { results: [], flags: [] }; if (!ev.elev) return out;
    const X = ctx(c, u, k, ev, s), h = X.h, path = ev.path;
    const positions = [at(X, k.pick, h.pick.zLb, X.zTr, 'hoist', 0)].concat(path.pts.map(q => at(X, q, X.zTr, X.zTr, 'path', q.t)), [at(X, k.set, X.zTr, h.set.zLb, 'lower', 1)]);
    const pathAt = t => at(X, path.at(t), X.zTr, X.zTr, 'path', t);
    (items || []).forEach(it => {
      if (['power', 'obst', 'excl'].indexOf(it.type) < 0) return;
      const ip = `${idp}.${it.id}`, env = envelope(it, X.zp, ip), nm = it.name || it.type;
      const comps = it.type === 'excl' ? ['boom', 'line', 'load'] : ['boom', 'line', 'load', 'cw'], best = {};
      // a lower bound in plan (bounding boxes) skips positions that cannot be closer than the best found so far (speed only: the
      // distance of every position that could be closer is computed exactly)
      const bb = env.prisms.map(Q => { const xs = Q.F.map(v => v.x), ys = Q.F.map(v => v.y); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; });
      const lower = (pos, comp, B) => { let x0, x1, y0, y1, r = 0;
        if (comp === 'boom') { x0 = Math.min(pos.foot.x, pos.x); x1 = Math.max(pos.foot.x, pos.x); y0 = Math.min(pos.foot.y, pos.y); y1 = Math.max(pos.foot.y, pos.y); r = X.rb; }
        else { x0 = x1 = pos.x; y0 = y1 = pos.y; r = comp === 'load' ? X.rL : 0; }
        return Math.max(0, Math.hypot(Math.max(0, B.x0 - x1, x0 - B.x1), Math.max(0, B.y0 - y1, y0 - B.y1)) - r); };
      const dAt = (pos, comp, cut) => { let m = null; env.prisms.forEach((Q, i) => { if (cut != null && comp !== 'cw' && lower(pos, comp, bb[i]) > Math.min(cut, m ? m.d : Infinity)) return; const r = compDist(X, pos, Q, comp); if (r && (!m || r.d < m.d)) m = r; }); return m; };
      comps.forEach(comp => {
        let m = null, mi = -1;
        (comp === 'cw' ? positions.slice(0, 1) : positions).forEach((pos, i) => { const r = dAt(pos, comp, m ? m.d : null); if (r && (!m || r.d < m.d - 1e-12)) { m = Object.assign({}, r, { pos }); mi = i; } });
        if (!m) return;
        // refine on the path between the two neighbouring check points (golden-section search)
        if (comp !== 'cw' && m.pos.kind === 'path' && m.d > 0) {
          const ta = positions[Math.max(1, mi - 1)].t, tb = positions[Math.min(positions.length - 2, mi + 1)].t;
          let a = Math.min(ta, tb), b = Math.max(ta, tb); const gr = (Math.sqrt(5) - 1) / 2, f = t => { const pos = pathAt(t), r = dAt(pos, comp); return r ? Object.assign({}, r, { pos }) : { d: Infinity }; };
          let x1 = b - gr * (b - a), x2 = a + gr * (b - a), f1 = f(x1), f2 = f(x2);
          for (let n = 0; n < 40 && b - a > 1e-6; n++) { if (f1.d < f2.d) { b = x2; x2 = x1; f2 = f1; x1 = b - gr * (b - a); f1 = f(x1); } else { a = x1; x1 = x2; f1 = f2; x2 = a + gr * (b - a); f2 = f(x2); } }
          [f1, f2].forEach(r => { if (r.d < m.d) m = r; });
        }
        best[comp] = m;
      });
      const list = Object.keys(best).map(comp => Object.assign({ comp }, best[comp])); if (!list.length) return;
      const gov = list.reduce((a, b) => b.d < a.d ? b : a), where = whereText(X, gov.pos);
      const res = { item: it.id, type: it.type, name: nm, known: env.known, env, comps: list, gov, where, steps: env.steps.slice(), level: 'ok', text: '' };
      // worked steps of the governing component
      const P = gov.p, Qp = gov.q, dx = P.x - Qp.x, dy = P.y - Qp.y, dz = P.z - Qp.z;
      res.steps.push(st(ip, { id: 'd', label: `Closest 3D distance: ${COMP[gov.comp]} to "${nm}" (${where})`, sym: gov.comp === 'boom' ? 'd_{0}' : 'd', eq: '\\sqrt{\\Delta x^{2} + \\Delta y^{2} + \\Delta z^{2}}', sub: `\\sqrt{${tx(dx, 2)}^{2} + ${tx(dy, 2)}^{2} + ${tx(dz, 2)}^{2}}`, value: gov.comp === 'boom' ? gov.d0 : gov.d, unit: 'ft',
        note: `Closest points (grid ft, elevation): ${COMP[gov.comp]} (${fmt(P.x, 2)}, ${fmt(P.y, 2)}, ${fmt(P.z, 2)}); ${it.type === 'power' ? 'conductor envelope' : it.type} (${fmt(Qp.x, 2)}, ${fmt(Qp.y, 2)}, ${fmt(Qp.z, 2)}). Radius at that position ${fmt(gov.pos.R, 2)} ft.` }));
      if (gov.comp === 'boom') res.steps.push(st(ip, { id: 'db', label: 'Clearance from the boom surface (boom section width b_w)', sym: 'd', eq: 'd_{0} - \\frac{b_{w}}{2}', sub: `${tx(gov.d0, 2)} - \\frac{${tx(X.rb * 2, 2)}}{2}`, value: gov.d, unit: 'ft' }));
      const others = list.filter(x => x !== gov).map(x => `${COMP[x.comp]} ${fmt(x.d, 2)} ft`).join(', ');
      if (it.type === 'power') {
        const oc = O().clearance({ kv: it.kv, le350: it.le350, setFt: it.setFt }, ip + '.osha'), D = oc.ft; res.D = D; res.steps.unshift(...oc.steps);
        if (!isNum(D)) { res.level = 'stop'; res.text = `"${nm}": clearance not set (over 1,000 kV): enter the utility / RPE distance.`; }
        else {
          res.steps.push(st(ip, { id: 'chk', label: `OSHA minimum clearance in 3D (${oc.basis})`, sym: 'd', eq: '\\ge D_{min}', sub: `${tx(gov.d, 2)} \\ge ${tx(D, 0)}`, value: gov.d >= D ? 'OK' : 'NOT OK', d: 0, ref: oc.ref, ok: gov.d >= D,
            note: `Other components: ${others || 'none'}.${env.known ? '' : ' Wire height not entered: plan distance.'}` }));
          res.level = gov.d < D - 1e-9 ? 'stop' : 'info';
          res.text = gov.d < D - 1e-9 ? `The ${COMP[gov.comp]} comes within ${fmt(gov.d, 1)} ft of "${nm}" in 3D (${where}) < D_min = ${fmt(D, 0)} ft (29 CFR 1926.1408): keep every part of the crane, load line and load outside D_min, or de-energize and ground the line.`
            : `"${nm}": closest ${fmt(gov.d, 1)} ft in 3D (${COMP[gov.comp]}, ${where}) ≥ D_min = ${fmt(D, 0)} ft.`;
          if (!env.known) res.text += ' Wire height not entered: checked in plan (as a vertical plane).';
        }
      } else if (it.type === 'obst') {
        res.req = s.obstClr;
        if (!env.known) { if (gov.d < s.obstClr - 1e-9) { res.level = 'warn'; res.text = `"${nm}": height not entered; in plan the ${COMP[gov.comp]} comes within ${fmt(gov.d, 1)} ft of it (${where}): enter its height or top elevation for the 3D check.`; } }
        else {
          res.steps.push(st(ip, { id: 'chk', label: 'Clearance to the obstruction (project setting)', sym: 'd', eq: '\\ge c_{obst}', sub: `${tx(gov.d, 2)} \\ge ${tx(s.obstClr, 2)}`, value: gov.d >= s.obstClr ? 'OK' : gov.d <= 1e-9 ? 'CONTACT' : 'NOT OK', d: 0, ok: gov.d >= s.obstClr, note: `Other components: ${others || 'none'}.` }));
          if (gov.d <= 1e-9) { res.level = 'stop'; res.text = `The ${COMP[gov.comp]} meets the obstruction "${nm}" (${where}).`; }
          else if (gov.d < s.obstClr - 1e-9) { res.level = 'warn'; res.text = `The ${COMP[gov.comp]} comes within ${fmt(gov.d, 2)} ft of the obstruction "${nm}" (${where}) < ${fmt(s.obstClr, 2)} ft.`; }
        }
      } else if (it.type === 'excl') {
        const hits = list.filter(x => x.d <= 1e-9);
        if (hits.length) { res.level = 'warn'; res.text = `Over the exclusion zone "${nm}": ${hits.map(x => COMP[x.comp]).join(', ')} (${whereText(X, hits[0].pos)}).`; }
      }
      out.results.push(res);
      if (res.level !== 'ok') out.flags.push({ kind: 'c3-' + it.type, level: res.level, item: it.id, d: gov.d, D: res.D, comp: gov.comp, p: gov.p, q: gov.q, text: res.text });
    });
    return out;
  }
  window.CranePickClear = { BIG, segSeg3, cpPoly, ptPrism, discPrism, segPrism, spanRect, envelope, check, COMP };
})();
