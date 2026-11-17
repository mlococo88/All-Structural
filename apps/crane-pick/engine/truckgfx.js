/* apps/crane-pick/engine/truckgfx.js — the haul vehicle carrying its load, drawn (window.CranePickTruckGfx). Classic script, no DOM
   (Node-tested: tests/engine/crane-truck.test.mjs). 2026-11-17 (engineer request: "a TO-SCALE graphic of the truck carrying the girder").
   ONE drawing function for every picture of the haul vehicle: the map vehicle on the route (ui/route.js), the Route output tab
   "Vehicle and load" figures, Report §Route and the Drawings route sheet (ui/drawset.js). Display only: it calculates nothing the
   checks use. Every dimension drawn is a value engine/route.js uses, read from the same functions:
     the unit outlines (tractor, jeep, trailer deck / rear dolly, load): engine/route.js outlines() at a pose() — the outlines of the
       swept path; on a straight heading for the figures, at the route position for the map;
     the stations along the vehicle, deck length, overhangs, front reach, overall length / width / height: engine/route.js geometry();
     the load top: overhead() (deck + blocking + load), the axle-group loads: axles() (statics or entered), R_min: the vehicle input.
   Schematic (stated on the figures): each axle group's axles drawn at an assumed 4.5 ft spread about the group centre (the engine
   lumps a group at its centre), tyres 3.4 ft diameter × 0.9 ft wide, the frame and cab heights (the cab to the vehicle height when
   entered, else an assumed 9 ft, dashed), the blocking at the hitch and the rear pivot (1.5 ft long).

   model(r, P, ev) -> { v, l, g (geometry), ax, oh, p0 (the straight pose), Rmin }
   plan(m, p, o) -> { prims, scale: true, title } ; p = a pose (engine/route.js pose(); default: straight, steer axle at (0, 0) heading
     +x); o = { dims (default: true when p is the straight pose), labels (default true), detail ('full' | 'simple') }
   side(m) -> { prims, scale: true, title } (x along the vehicle from the steer axle, forward +; z up from the road)
   prims: { t: 'pl' (pts, closed), 'line' (a, b), 'circle' (at, r), 'text' (at, s, a: 0 left | 1 centre | 2 right, size), 'dim'
     (a, b, s, v: value id, val), c: class (tractor, cab, jeep, trailer, dolly, load, block, tyre, axle, pin, cg, road, dim, schem) }
   svg(fig, o) -> SVG (to scale: one scale for x and y, a scale bar; dims carry data-v / data-val for the tests)
   dxf(D, fig, o) -> draws fig with shared/dxf.js at 1 ft = 12 units (o.kx) from o.x0, o.y0 (model inches); layers TRUCK-<class> */
(function () {
  'use strict';
  const RT = () => window.CranePickRoute;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const fmt = (v, d) => isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SCH = { axleSp: 4.5, tyreD: 3.4, tyreW: 0.9, frame: [2.5, 3.5], cabH: 9, blockL: 1.5 };   // schematic sizes (ft), stated on the figures
  const ft = v => fmt(v, 2) + ' ft';
  function model(r, P, ev) {
    const R = RT(), v = R.vehOf(r, P), l = R.loadOf(r, P), g = ev && ev.geo ? ev.geo : R.geometry(r, P, 'tg');
    const ax = ev && ev.ax ? ev.ax : R.axles(r, 'tg.ax', P), oh = ev && ev.oh ? ev.oh : null;
    const p0 = R.pose(v, { x: 0, y: 0 }, 0, 0, 0);
    return { r, v, l, g, ax, oh, p0, Rmin: v.Rmin, LT: g.LT, hB: g.hB };
  }
  const U = th => ({ x: Math.cos(th), y: Math.sin(th) }), N = th => ({ x: -Math.sin(th), y: Math.cos(th) });
  const at = (o, u, n, a, b) => [o.x + u.x * a + n.x * b, o.y + u.y * a + n.y * b];
  /* the axle groups: unit origin, axis, the group's axle count and tyres per axle, its load (axles()) */
  function groups(m, p) {
    const v = m.v, R = RT(), u1 = U(p.th1), uj = U(p.thj), ud = U(p.th2 + (p.dl || 0)), T = p.T, gl = {}; (m.ax.groups || []).forEach(q => { gl[q.k] = q; });
    const out = [{ k: 'S', o: p.F, u: u1, n: v.nS, t: v.tS, w: v.Wt }, { k: 'D', o: T, u: u1, n: v.nD, t: v.tD, w: v.Wt }];
    if (R.hasJeep(v) && p.J) out.push({ k: 'J', o: p.J, u: uj, n: v.nJ, t: v.tJ, w: v.Wb });
    out.push({ k: 'R', o: p.D, u: R.steered(v) ? ud : U(p.th2), n: v.nR, t: v.tR, w: v.Wb });
    out.forEach(q => { q.g = gl[q.k] || null; q.xs = []; const n = Math.max(1, Math.round(q.n || 1)); for (let i = 0; i < n; i++) q.xs.push((i - (n - 1) / 2) * SCH.axleSp); });
    return out;
  }
  /* plan: the outlines of engine/route.js at the pose, the cab back, the axles and tyres, the pins, the CG, ends A / B, dimensions */
  function plan(m, p, o) {
    const R = RT(), v = m.v, l = m.l, g = m.g, straight = !p; p = p || m.p0; o = o || {}; const dims = o.dims != null ? o.dims : straight, labels = o.labels !== false, F = [];
    const parts = R.outlines(v, l, p);
    parts.forEach(pp => F.push({ t: 'pl', pts: pp.poly.map(q => [q.x, q.y]), closed: true, c: pp.part, part: pp.part }));
    const u1 = U(p.th1), n1 = N(p.th1), u2 = U(p.th2), n2 = N(p.th2);
    // the back of the cab / headache rack (the front-reach check)
    F.push({ t: 'line', a: at(p.F, u1, n1, -v.cab, -v.Wt / 2), b: at(p.F, u1, n1, -v.cab, v.Wt / 2), c: 'cab' });
    if (o.detail !== 'simple') groups(m, p).forEach(q => { const nq = N(Math.atan2(q.u.y, q.u.x)), half = q.w / 2, per = Math.max(1, Math.round((q.t || 2) / 2));
      q.xs.forEach(xa => { F.push({ t: 'line', a: at(q.o, q.u, nq, xa, -half), b: at(q.o, q.u, nq, xa, half), c: 'axle' });
        for (const sd of [-1, 1]) for (let i = 0; i < per; i++) { const y0 = sd * (half - i * (SCH.tyreW + 0.1)), y1 = y0 - sd * SCH.tyreW, a0 = xa - SCH.tyreD / 2, a1 = xa + SCH.tyreD / 2;
          F.push({ t: 'pl', pts: [at(q.o, q.u, nq, a0, y0), at(q.o, q.u, nq, a1, y0), at(q.o, q.u, nq, a1, y1), at(q.o, q.u, nq, a0, y1)], closed: true, c: 'tyre' }); } }); });
    // kingpin, jeep bolster, rear pivot; the load CG; ends A / B
    F.push({ t: 'circle', at: [p.K.x, p.K.y], r: 0.5, c: 'pin' }); if (p.J) F.push({ t: 'circle', at: [p.H.x, p.H.y], r: 0.5, c: 'pin' }); F.push({ t: 'circle', at: [p.D.x, p.D.y], r: 0.5, c: 'pin' });
    const f = l.L - v.L2 - l.r, cg = at(p.H, u2, n2, f - l.cg, 0); F.push({ t: 'circle', at: cg, r: Math.max(0.6, l.B / 8), c: 'cg', v: 'cg' });
    if (labels) { const ea = at(p.H, u2, n2, f, 0), eb = at(p.D, u2, n2, -l.r, 0), aF = l.endA !== 'rear';
      F.push({ t: 'text', at: [ea[0] - u2.x * 1.2, ea[1] - u2.y * 1.2], s: l.tandem ? (aF ? 'A' : 'B') : 'front', a: 2, size: 1, c: 'load' }, { t: 'text', at: [eb[0] + u2.x * 1.2, eb[1] + u2.y * 1.2], s: l.tandem ? (aF ? 'B' : 'A') : 'rear', a: 0, size: 1, c: 'load' }); }
    if (dims && straight) {
      const x = g.x, W2 = g.Wov / 2, row = k => -(W2 + 2.5 + 3 * k), top = k => W2 + 2.5 + 3 * k, d = (a, b, y, s, vId, val, side) => F.push({ t: 'dim', a: [a, y], b: [b, y], s, v: vId, val, side });
      // under the vehicle: the tractor and the body; the deck / dolly; the overall length
      d(0, v.fo, row(0), `fo ${ft(v.fo)}`, 'fo', v.fo); d(-v.L1, 0, row(0), `L1 ${ft(v.L1)}`, 'L1', v.L1);
      if (R.hasJeep(v)) { d(x.J, x.K, row(1), `Lj ${ft(v.Lj)}`, 'Lj', v.Lj); if (Math.abs(v.ej) > 1e-9) d(x.J, x.H, row(2), `ej ${ft(v.ej)}`, 'ej', v.ej); }
      if (Math.abs(v.e) > 1e-9) d(Math.min(x.T, x.K), Math.max(x.T, x.K), row(R.hasJeep(v) ? 2 : 1), `e ${ft(v.e)}`, 'e', v.e);
      d(x.D, x.H, row(0), `L2 ${ft(v.L2)}${v.L2src === 'load' ? ' (from the load)' : ''}`, 'L2', v.L2);
      d(x.rearT, x.T, row(1), `ro ${ft(v.ro)}`, 'ro', v.ro); d(-v.cab, 0, row(1), `cab ${ft(v.cab)}`, 'cab', v.cab);
      if (!R.steered(v)) { d(x.H, x.df, row(3), `dF ${ft(v.dF)}`, 'dF', v.dF); d(x.dr, x.D, row(3), `dR ${ft(v.dR)}`, 'dR', v.dR); d(x.dr, x.df, row(4), `deck ${ft(g.Ldeck)}`, 'Ldeck', g.Ldeck); }
      else d(x.dr, x.df, row(3), `Ld ${ft(v.Ld)}`, 'Ld', v.Ld);
      d(g.xR, g.xF, row(5), `overall length ${ft(g.Lov)}`, 'Lov', g.Lov);
      // over the vehicle: the load
      d(x.lr, x.lf, top(2), `load L ${ft(l.L)}`, 'L', l.L); d(x.lf - l.cg, x.lf, top(1), `CG ${ft(l.cg)} from the front`, 'cgF', l.cg);
      if (Math.abs(g.f) > 1e-9) d(Math.min(x.H, x.lf), Math.max(x.H, x.lf), top(0), `${v.L2src === 'load' ? 'aF' : 'f'} ${ft(g.f)}`, 'f', g.f);
      if (Math.abs(l.r) > 1e-9) d(Math.min(x.lr, x.D), Math.max(x.lr, x.D), top(0), `r ${ft(l.r)}`, 'r', l.r);
      if (g.oRear > 1e-9) d(x.lr, x.dr, top(3), `rear overhang ${ft(g.oRear)}`, 'oRear', g.oRear);
      if (!R.steered(v) && g.oF > 1e-9) d(x.df, x.lf, top(3), `over the deck front ${ft(g.oF)}`, 'oF', g.oF);
      // widths at the front (overall) and at the load's rear end (the load)
      const xw = g.xF + 2.5; F.push({ t: 'dim', a: [xw, -W2], b: [xw, W2], s: `width ${ft(g.Wov)}`, v: 'Wov', val: g.Wov, side: 1 });
      const xb = x.lr - 2.5; F.push({ t: 'dim', a: [xb, -l.B / 2], b: [xb, l.B / 2], s: `B ${ft(l.B)}`, v: 'B', val: l.B, side: -1 });
      F.push({ t: 'text', at: [g.xR, row(7)], s: `Min. turning radius R_min = ${ft(v.Rmin)} (vehicle input; steer-axle centre). Axles drawn ${fmt(SCH.axleSp, 1)} ft apart about each group centre, tyres ${fmt(SCH.tyreD, 1)} × ${fmt(SCH.tyreW, 1)} ft (schematic); outlines as the swept path.`, a: 0, size: 0.8, v: 'Rmin', val: v.Rmin });
    }
    return { prims: F, scale: true, title: straight ? 'Plan (to scale, front to the right)' : 'Plan (at the route position)' };
  }
  /* side elevation (straight): road, wheels, frame and cab, the deck / jeep / dolly at the deck height, blocking, the load to its top */
  function side(m) {
    const R = RT(), v = m.v, l = m.l, g = m.g, x = g.x, F = [], hD = v.hDeck, hB = g.hB, LT = g.LT, rW = SCH.tyreD / 2;
    const box = (x0, x1, z0, z1, c, extra) => F.push(Object.assign({ t: 'pl', pts: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], closed: true, c }, extra || {}));
    F.push({ t: 'line', a: [g.xR - 8, 0], b: [g.xF + 8, 0], c: 'road' });
    const gs = groups(m, m.p0); gs.forEach(q => q.xs.forEach(xa => F.push({ t: 'circle', at: [q.o.x + xa, rW], r: rW, c: 'tyre' })));
    box(x.rearT, x.front, SCH.frame[0], SCH.frame[1], 'tractor');
    const hc = isNum(v.hV) ? v.hV : SCH.cabH; box(-v.cab, x.front, SCH.frame[1], hc, 'cab', isNum(v.hV) ? {} : { dash: true });
    if (R.hasJeep(v)) box(x.J - 3, x.K + 1, SCH.frame[0], hD - 0.6, 'jeep');
    box(x.H - 1, x.H + 1, hD - 0.6, hD, 'pin');
    if (!R.steered(v)) box(x.dr, x.df, hD - 1, hD, 'trailer'); else { box(x.dr, x.df, SCH.frame[0], hD - 0.6, 'dolly'); box(x.D - 1, x.D + 1, hD - 0.6, hD, 'pin'); }
    if (hB > 1e-9) [x.H, x.D].forEach(xc => box(xc - SCH.blockL / 2, xc + SCH.blockL / 2, hD, hD + hB, 'block'));
    box(x.lr, x.lf, hD + hB, LT, 'load');
    const cgx = x.lf - l.cg; F.push({ t: 'circle', at: [cgx, hD + hB + l.h / 2], r: Math.max(0.4, Math.min(1.2, l.h / 6)), c: 'cg' });
    const aF = l.endA !== 'rear'; F.push({ t: 'text', at: [x.lf - 0.8, LT - Math.min(l.h, 3) / 2 - 0.4], s: l.tandem ? (aF ? 'A' : 'B') : '', a: 2, size: 1, c: 'load' }, { t: 'text', at: [x.lr + 0.8, LT - Math.min(l.h, 3) / 2 - 0.4], s: l.tandem ? (aF ? 'B' : 'A') : '', a: 0, size: 1, c: 'load' });
    // heights at the rear (deck, blocking, load, load top) and at the front (vehicle, overall)
    const xr = g.xR - 2.5, xr2 = g.xR - 6.5, xf = g.xF + 2.5, vd = (xx, z0, z1, s, vId, val, sd) => F.push({ t: 'dim', a: [xx, z0], b: [xx, z1], s, v: vId, val, side: sd });
    vd(xr, 0, hD, `deck ${ft(hD)}`, 'hDeck', hD, -1); if (hB > 1e-9) vd(xr, hD, hD + hB, `blocking ${ft(hB)}`, 'hB', hB, -1); vd(xr, hD + hB, LT, `load ${ft(l.h)}`, 'h', l.h, -1);
    vd(xr2, 0, LT, `load top ${ft(LT)}`, 'LT', LT, -1);
    if (isNum(v.hV)) vd(xf, 0, v.hV, `vehicle ${ft(v.hV)}`, 'hV', v.hV, 1);
    vd(xf + (isNum(v.hV) ? 4 : 0), 0, g.Hov, `overall height ${ft(g.Hov)}`, 'Hov', g.Hov, 1);
    F.push({ t: 'dim', a: [g.xR, LT + 2.5], b: [g.xF, LT + 2.5], s: `overall length ${ft(g.Lov)}`, v: 'Lov', val: g.Lov });
    // the axle-group loads under each group (axles(): statics or entered), with the axles and tyres
    gs.forEach((q, i) => { const gg = q.g; if (!gg) return; const xc = q.o.x, z = -1.6 - (i % 2) * 2.6;
      F.push({ t: 'text', at: [xc, z], s: `${gg.label}: ${fmt(gg.load, 0)} lb`, a: 1, size: 0.8, v: 'ax' + q.k, val: gg.load }, { t: 'text', at: [xc, z - 1.15], s: `${gg.n} axle${gg.n === 1 ? '' : 's'} × ${gg.tyres} tyres${isNum(gg.perTyre) ? `, ${fmt(gg.perTyre, 0)} lb / tyre` : ''}`, a: 1, size: 0.7 }); });
    F.push({ t: 'text', at: [g.xR - 7, -7.6], s: `Axle loads by ${m.ax.mode}. Frame and cab ${isNum(v.hV) ? '' : `(cab ${fmt(SCH.cabH, 0)} ft, dashed: the vehicle height is not entered) `}schematic; deck, blocking, load and heights as the overhead checks use them.`, a: 0, size: 0.7 });
    return { prims: F, scale: true, title: 'Side elevation (to scale, front to the right)' };
  }
  /* ---------- SVG ---------- */
  const COL = { tractor: '#0F172A', cab: '#0F172A', jeep: '#0F172A', trailer: '#0F172A', dolly: '#0F172A', load: '#7C3AED', block: '#92400E', tyre: '#334155', axle: '#64748B', pin: '#0F172A', cg: '#DC2626', road: '#475569', dim: '#1E3A8A', schem: '#94A3B8' };
  const FILL = { load: 'rgba(124,58,237,.18)', tyre: '#334155', block: 'rgba(146,64,14,.35)', pin: '#0F172A', trailer: 'rgba(148,163,184,.25)', dolly: 'rgba(148,163,184,.25)', jeep: 'rgba(148,163,184,.25)', tractor: 'rgba(255,255,255,.9)', cab: 'rgba(226,232,240,.8)' };
  function bounds(prims) { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; const add = (q) => { if (!q || !isNum(q[0]) || !isNum(q[1])) return; x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); };
    prims.forEach(p => { if (p.t === 'pl') p.pts.forEach(add); else if (p.t === 'line' || p.t === 'dim') { add(p.a); add(p.b); } else if (p.t === 'circle') { add([p.at[0] - p.r, p.at[1] - p.r]); add([p.at[0] + p.r, p.at[1] + p.r]); } else if (p.at) add(p.at); }); return { x0, x1, y0, y1 }; }
  const nice = v => { if (!(v > 0)) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))); return [1, 2, 5, 10].map(q => q * e).filter(q => q <= v).pop() || e; };
  const tw = (s, fs) => String(s).length * fs * 0.56;
  function svg(fig, o) {
    if (!fig) return ''; o = o || {}; const W = o.w || 760, fs = o.fs || 11, pad = 16, b = bounds(fig.prims); if (!isFinite(b.x0)) return '';
    // the scale from the geometry, widened for the text that runs past it (left-anchored notes)
    let bx1 = b.x1, k = (W - 2 * pad) / Math.max(1e-6, b.x1 - b.x0);
    for (let it = 0; it < 3; it++) { bx1 = b.x1; fig.prims.forEach(p => { if (p.t === 'text' && (p.a || 0) === 0) bx1 = Math.max(bx1, p.at[0] + tw(p.s, fs * (p.size || 0.9)) / k); }); k = (W - 2 * pad) / Math.max(1e-6, bx1 - b.x0); }
    const yPad = 2.2 * fs / k, Ht = Math.ceil((b.y1 - b.y0 + 2 * yPad) * k + 2 * pad + 22), X = x => +(pad + (x - b.x0) * k).toFixed(2), Y = y => +(pad + (b.y1 + yPad - y) * k).toFixed(2), out = [];
    const sw = c => ({ road: 1.6, load: 1.6, axle: 1.2, dim: 0.8, cab: 1.6 })[c] || 1.1;
    fig.prims.forEach(p => {
      const c = COL[p.c] || '#334155', dash = p.dash ? ' stroke-dasharray="5 3"' : '';
      if (p.t === 'pl') out.push(`<${p.closed ? 'polygon' : 'polyline'} class="tg-${esc(p.c)}" points="${p.pts.map(q => X(q[0]) + ',' + Y(q[1])).join(' ')}" fill="${p.closed && FILL[p.c] ? FILL[p.c] : 'none'}" stroke="${c}" stroke-width="${sw(p.c)}"${dash} stroke-linejoin="round"/>`);
      else if (p.t === 'line') out.push(`<line class="tg-${esc(p.c)}" x1="${X(p.a[0])}" y1="${Y(p.a[1])}" x2="${X(p.b[0])}" y2="${Y(p.b[1])}" stroke="${c}" stroke-width="${sw(p.c)}"/>`);
      else if (p.t === 'circle') out.push(`<circle class="tg-${esc(p.c)}" cx="${X(p.at[0])}" cy="${Y(p.at[1])}" r="${Math.max(1.5, p.r * k).toFixed(2)}" fill="${p.c === 'cg' ? '#fff' : p.c === 'pin' ? '#0F172A' : 'none'}" stroke="${c}" stroke-width="${p.c === 'cg' ? 1.6 : 1}"/>`
        + (p.c === 'cg' ? `<path d="M${X(p.at[0]) - Math.max(1.5, p.r * k)} ${Y(p.at[1])}H${X(p.at[0]) + Math.max(1.5, p.r * k)}M${X(p.at[0])} ${Y(p.at[1]) - Math.max(1.5, p.r * k)}V${Y(p.at[1]) + Math.max(1.5, p.r * k)}" stroke="${c}" stroke-width="1"/>` : ''));
    });
    fig.prims.forEach(p => {
      const data = p.v ? ` data-v="${esc(p.v)}"${p.val != null ? ` data-val="${esc(p.val)}"` : ''}` : '';
      if (p.t === 'dim') { const x1 = X(p.a[0]), y1 = Y(p.a[1]), x2 = X(p.b[0]), y2 = Y(p.b[1]), L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L, t = 3.5;
        out.push(`<g class="tg-dim"${data}><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COL.dim}" stroke-width="0.8"/><path d="M${x1 - uy * t} ${y1 + ux * t}L${x1 + uy * t} ${y1 - ux * t}M${x2 - uy * t} ${y2 + ux * t}L${x2 + uy * t} ${y2 - ux * t}" stroke="${COL.dim}" stroke-width="1.1"/>`);
        const f2 = fs * 0.8, vert = Math.abs(uy) > Math.abs(ux), mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        out.push(vert ? `<text x="${(mx + (p.side === -1 ? -4 : 4)).toFixed(1)}" y="${(my + f2 / 3).toFixed(1)}" font-size="${f2.toFixed(1)}" fill="${COL.dim}"${p.side === -1 ? ' text-anchor="end"' : ''}>${esc(p.s)}</text></g>` : `<text x="${mx.toFixed(1)}" y="${(my - 3).toFixed(1)}" font-size="${f2.toFixed(1)}" fill="${COL.dim}" text-anchor="middle">${esc(p.s)}</text></g>`); }
      else if (p.t === 'text' && p.s) out.push(`<text x="${X(p.at[0])}" y="${Y(p.at[1])}" font-size="${(fs * (p.size || 0.9)).toFixed(1)}" fill="${COL[p.c] || '#0F172A'}"${p.a === 1 ? ' text-anchor="middle"' : p.a === 2 ? ' text-anchor="end"' : ''}${data}>${esc(p.s)}</text>`);
    });
    // the scale bar (one scale for both directions: the figure is to scale)
    const sb = nice((b.x1 - b.x0) / 5), L = sb * k, by = Ht - 12;
    out.push(`<g class="tg-scale" data-ftpx="${k.toFixed(4)}"><rect x="${pad}" y="${by - 5}" width="${(L / 2).toFixed(1)}" height="5" fill="#0F172A"/><rect x="${(pad + L / 2).toFixed(1)}" y="${by - 5}" width="${(L / 2).toFixed(1)}" height="5" fill="#fff" stroke="#0F172A"/><text x="${(pad + L + 6).toFixed(1)}" y="${by}" font-size="${(fs * 0.8).toFixed(1)}">0 – ${fmt(sb, 0)} ft (to scale)</text></g>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" class="tgFig" viewBox="0 0 ${W} ${Ht}" width="${W}" height="${Ht}" role="img" aria-label="${esc(fig.title || 'vehicle and load')}" font-family="Segoe UI, Roboto, Arial, sans-serif" style="max-width:100%;height:auto;background:#fff">${out.join('')}</svg>`;
  }
  /* ---------- DXF (shared/dxf.js): 1 ft = 12 units ---------- */
  const asc = s => String(s == null ? '' : s).replace(/[×]/g, 'X').replace(/[—–]/g, '-').replace(/[·]/g, '-').replace(/[^\x20-\x7E]/g, '').toUpperCase();
  function dxf(D, fig, o) {
    o = o || {}; const kx = o.kx || 12, x0 = o.x0 || 0, y0 = o.y0 || 0, h = D.h, X = x => x0 + x * kx, Y = y => y0 + y * kx;
    const lay = c => D.layer('TRUCK-' + String(c || 'obj').toUpperCase(), ({ load: 1, block: 30, tyre: 8, axle: 8, cg: 1, road: 8, dim: 2, cab: 5 })[c] || 5), lT = D.layer('TEXT', 7);
    fig.prims.forEach(p => {
      if (p.t === 'pl') D.pline(lay(p.c), p.pts.map(q => [X(q[0]), Y(q[1])]), p.closed, p.dash ? D.ltype('DASHED') : undefined);
      else if (p.t === 'line') D.line(lay(p.c), X(p.a[0]), Y(p.a[1]), X(p.b[0]), Y(p.b[1]));
      else if (p.t === 'circle') D.circle(lay(p.c), X(p.at[0]), Y(p.at[1]), p.r * kx);
      else if (p.t === 'text' && p.s) D.text(lT, X(p.at[0]), Y(p.at[1]), h * (p.size || 0.9) * 0.8, asc(p.s), p.a || 0);
      else if (p.t === 'dim') { const x1 = X(p.a[0]), y1 = Y(p.a[1]), x2 = X(p.b[0]), y2 = Y(p.b[1]), L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L, t = 0.35 * h, l = lay('dim');
        D.line(l, x1, y1, x2, y2); D.line(l, x1 - uy * t, y1 + ux * t, x1 + uy * t, y1 - ux * t); D.line(l, x2 - uy * t, y2 + ux * t, x2 + uy * t, y2 - ux * t);
        if (Math.abs(uy) > Math.abs(ux)) D.text(lT, (x1 + x2) / 2 + (p.side === -1 ? -0.4 * h : 0.4 * h), (y1 + y2) / 2, 0.6 * h, asc(p.s), p.side === -1 ? 2 : 0); else D.text(lT, (x1 + x2) / 2, (y1 + y2) / 2 + 0.3 * h, 0.6 * h, asc(p.s), 1); }
    });
  }
  /* the scale bar of a DXF figure (model inches) at x, y */
  function dxfScale(D, x, y, spanFt) { const h = D.h, lT = D.layer('TEXT', 7), sb = nice(spanFt / 5), L = sb * 12;
    D.rect(lT, x, y, x + L, y + 0.5 * h); D.solid(D.layer('SCALEBAR', 7), [[x, y], [x + L / 2, y], [x + L / 2, y + 0.5 * h], [x, y + 0.5 * h]]);
    D.text(lT, x, y + 0.9 * h, 0.7 * h, '0', 1); D.text(lT, x + L / 2, y + 0.9 * h, 0.7 * h, fmt(sb / 2, 0), 1); D.text(lT, x + L, y + 0.9 * h, 0.7 * h, `${fmt(sb, 0)} FT`, 1); }
  window.CranePickTruckGfx = { SCH, model, plan, side, groups, svg, dxf, dxfScale, bounds };
})();
