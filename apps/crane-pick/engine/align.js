/* apps/crane-pick/engine/align.js — a horizontal alignment (tangents and circular curves) fitted to a drawn / traced / OpenStreetMap
   route line (window.CranePickAlign). Classic script, no DOM. 2026-11-17 (engineer: "each click is modelled as a turn which isn't
   really true"). Positions: the site frame (grid ft, x east, y north). Angles: radians, counter-clockwise, + = left.

   al (the fitted alignment, saved on the route as route.al) = { pis: [{ x, y }] (start, the points of intersection (PI) of the tangents,
       end), rad: [ft | null] per PI (null at the ends; at an intersection turn null = the route default radius), kind: ['end' | 'curve' |
       'turn'] per PI ('curve' = fitted to the line; 'turn' = an intersection turn: a corner where the heading changes within a short
       length, radius entered or the route default), fit: [null | { Rls, rms, n, Lc, R0 }] per PI (the curve's free least-squares circle
       radius, its rms, the points used, the length over which the heading changes, the fitted radius before any edit), opt (the inputs
       used), edited (true once the user changed a PI or radius) }

   Method (CLAUDE.md §4: new calculation; Decisions pending engineer review):
   1. Simplify: Douglas–Peucker with tolerance tol (default 1.5 ft): the noise of a trace / of OSM vertices on a straight goes.
   2. Resample the simplified line every h ft (h = max(1, win / 10) ft).
   3. Heading-change rate: the smoothed heading θ̄(s) = direction of the chord from s − w/2 to s + w/2 (w = the detection window,
      default 50 ft); κ(s) = (θ̄(s + w/2) − θ̄(s − w/2)) / w. A point is on a curve when |κ| > 1 / R_max (R_max default 5,000 ft).
   4. Curves: runs of the same sign; two runs of the same sign less than w apart are merged; a run whose total deflection Δ is less than
      Δ_min (default 3°) is dropped (a tangent). Δ of a run = the heading after it − the heading before it (the chords next to it).
   5. Intersection turn: the length L_c over which the central 90 % of a run's heading change happens (5 % to 95 % of Σ|Δθ| along the
      chords) is less than L_corner (default 12 ft): a corner (e.g. two OSM centrelines meeting at a junction node), not a curve.
   6. Tangents: a total-least-squares line through the points between two curves (centroid, principal direction); a gap shorter than
      2 h: the line through its middle point along θ̄. A curve at the very start / end of the line: the tangent at the start / end point
      is that of the curve's free circle there.
   7. PI_k = the intersection of the tangents before and after curve k; the alignment starts / ends at the projections of the line's
      first / last points onto the first / last tangent.
   8. Curve radius: the arc tangent to both tangents (PC = PI − T û_in, PT = PI + T û_out, T = R tan(|Δ|/2)) whose tangent–curve–tangent
      polyline is closest, by least squares, to the line's points from the middle of the tangent before to the middle of the one after:
      min_R Σ d_i(R)², R from 1 ft to the largest that fits half of each tangent next to it; 48 trial radii (log-spaced), then golden
      section about the best. The free least-squares circle (Kåsa algebraic fit, then Gauss–Newton on the geometric distances
      |p_i − c| − R) is reported beside it as a check (CLAUDE.md §6).
   9. Max deviation: the largest distance from a point of the line (resampled) to the alignment. */
(function () {
  'use strict';
  const isNum = v => typeof v === 'number' && isFinite(v);
  const DEG = Math.PI / 180;
  const DEF = { tol: 1.5, win: 50, Rmax: 5000, minDelta: 3, cornerL: 12 };
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y }), add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y }), mul = (a, k) => ({ x: a.x * k, y: a.y * k });
  const dot = (a, b) => a.x * b.x + a.y * b.y, crs = (a, b) => a.x * b.y - a.y * b.x, len = a => Math.hypot(a.x, a.y), dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const unit = a => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l }; }, left = a => ({ x: -a.y, y: a.x });
  const ang = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  function optOf(o) { const r = Object.assign({}, DEF); Object.keys(DEF).forEach(k => { if (o && isNum(o[k]) && o[k] > 0) r[k] = o[k]; }); return r; }
  function clean(pts) { const out = []; (pts || []).forEach(p => { if (p && isNum(p.x) && isNum(p.y) && (!out.length || dist(out[out.length - 1], p) > 1e-6)) out.push({ x: p.x, y: p.y }); }); return out; }
  function segDist(p, a, b) { const d = sub(b, a), L2 = dot(d, d); let t = L2 ? dot(sub(p, a), d) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return dist(p, add(a, mul(d, t))); }
  /* 1. Douglas–Peucker (iterative) */
  function simplify(pts, tol) {
    pts = clean(pts); const n = pts.length; if (n < 3) return pts.slice();
    const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1; const st = [[0, n - 1]];
    while (st.length) { const [i, j] = st.pop(); let dm = -1, k = -1; for (let q = i + 1; q < j; q++) { const d = segDist(pts[q], pts[i], pts[j]); if (d > dm) { dm = d; k = q; } } if (dm > tol && k > 0) { keep[k] = 1; st.push([i, k], [k, j]); } }
    return pts.filter((_, i) => keep[i]);
  }
  /* 2. points every h along a polyline (the ends kept), with their stations s */
  function resample(pts, h) {
    pts = clean(pts); const out = []; if (pts.length < 2) return pts.map(p => Object.assign({ s: 0 }, p));
    let S = 0; const cum = [0]; for (let i = 1; i < pts.length; i++) { S += dist(pts[i - 1], pts[i]); cum.push(S); }
    const n = Math.max(1, Math.round(S / h)), dh = S / n; let j = 0;
    for (let k = 0; k <= n; k++) { const s = Math.min(S, k * dh); while (j < pts.length - 2 && cum[j + 1] < s) j++; const L = cum[j + 1] - cum[j], t = L > 0 ? (s - cum[j]) / L : 0; out.push({ x: pts[j].x + (pts[j + 1].x - pts[j].x) * t, y: pts[j].y + (pts[j + 1].y - pts[j].y) * t, s }); }
    return out;
  }
  /* total-least-squares line: { c (centroid), u (direction, oriented first → last point) } */
  function fitLine(pts) {
    const n = pts.length; let cx = 0, cy = 0; pts.forEach(p => { cx += p.x; cy += p.y; }); cx /= n; cy /= n;
    let sxx = 0, syy = 0, sxy = 0; pts.forEach(p => { const dx = p.x - cx, dy = p.y - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; });
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy); let u = { x: Math.cos(th), y: Math.sin(th) };
    if (dot(u, sub(pts[n - 1], pts[0])) < 0) u = mul(u, -1);
    let rms = 0; pts.forEach(p => { const e = crs(u, sub(p, { x: cx, y: cy })); rms += e * e; });
    return { c: { x: cx, y: cy }, u, rms: Math.sqrt(rms / n) };
  }
  function solve3(A, b) {
    const M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < 3; c++) { let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; if (Math.abs(M[p][c]) < 1e-300) return null; [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < 3; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k]; } }
    return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
  }
  /* the free least-squares circle: Kåsa (min Σ (x² + y² + D x + E y + F)²), then Gauss–Newton on r_i = |p_i − c| − R */
  function fitCircle(pts) {
    const n = pts.length; if (n < 3) return null;
    let mx = 0, my = 0; pts.forEach(p => { mx += p.x; my += p.y; }); mx /= n; my /= n;   // centred (conditioning)
    const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
    pts.forEach(p => { const x = p.x - mx, y = p.y - my, z = x * x + y * y, r = [x, y, 1]; for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) S[i][j] += r[i] * r[j]; b[i] -= r[i] * z; } });
    const k = solve3(S, b); if (!k) return null;
    let cx = -k[0] / 2, cy = -k[1] / 2, R = Math.sqrt(Math.max(0, cx * cx + cy * cy - k[2]));
    for (let it = 0; it < 50; it++) {
      const J = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], g = [0, 0, 0];
      pts.forEach(p => { const dx = p.x - mx - cx, dy = p.y - my - cy, d = Math.hypot(dx, dy) || 1e-12, r = d - R, j = [-dx / d, -dy / d, -1]; for (let a = 0; a < 3; a++) { for (let c = 0; c < 3; c++) J[a][c] += j[a] * j[c]; g[a] -= j[a] * r; } });
      const s = solve3(J, g); if (!s) break; cx += s[0]; cy += s[1]; R += s[2]; if (Math.hypot(s[0], s[1], s[2]) < 1e-10 * Math.max(1, R)) break;
    }
    let e2 = 0, emax = 0; pts.forEach(p => { const e = Math.abs(Math.hypot(p.x - mx - cx, p.y - my - cy) - R); e2 += e * e; emax = Math.max(emax, e); });
    return { c: { x: cx + mx, y: cy + my }, R: Math.abs(R), rms: Math.sqrt(e2 / n), max: emax, n };
  }
  function intersect(a, u, b, v) { const d = crs(u, v); if (Math.abs(d) < 1e-9) return null; const t = crs(sub(b, a), v) / d; return add(a, mul(u, t)); }
  /* tangent–curve–tangent: the distance from p to the composite (rays before PC and after PT, the arc between) */
  function tctDist(p, PI, ui, uo, D, R) {
    const T = R * Math.tan(Math.abs(D) / 2), PC = sub(PI, mul(ui, T)), PT = add(PI, mul(uo, T)), sg = Math.sign(D), c = add(PC, mul(left(ui), sg * R));
    const a0 = Math.atan2(PC.y - c.y, PC.x - c.x), a = ang(Math.atan2(p.y - c.y, p.x - c.x) - a0) * sg;
    if (a >= 0 && a <= Math.abs(D)) return Math.abs(dist(p, c) - R);
    const t1 = dot(sub(p, PC), ui), d1 = t1 <= 0 ? Math.abs(crs(ui, sub(p, PC))) : dist(p, PC);
    const t2 = dot(sub(p, PT), uo), d2 = t2 >= 0 ? Math.abs(crs(uo, sub(p, PT))) : dist(p, PT);
    return Math.min(d1, d2);
  }
  function fitRadius(pts, PI, ui, uo, D, Rhi) {
    const f = R => { let s = 0; for (const p of pts) { const d = tctDist(p, PI, ui, uo, D, R); s += d * d; } return s; };
    const lo = Math.log(1), hi = Math.log(Math.max(1.0001, Rhi)), N = 48; let best = lo, fb = Infinity;
    for (let k = 0; k <= N; k++) { const u = lo + (hi - lo) * k / N, v = f(Math.exp(u)); if (v < fb) { fb = v; best = u; } }
    let a = Math.max(lo, best - (hi - lo) / N), b = Math.min(hi, best + (hi - lo) / N); const gr = (Math.sqrt(5) - 1) / 2;
    let x1 = b - gr * (b - a), x2 = a + gr * (b - a), f1 = f(Math.exp(x1)), f2 = f(Math.exp(x2));
    for (let it = 0; it < 60 && b - a > 1e-7; it++) { if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = b - gr * (b - a); f1 = f(Math.exp(x1)); } else { a = x1; x1 = x2; f1 = f2; x2 = a + gr * (b - a); f2 = f(Math.exp(x2)); } }
    const R = Math.exp((a + b) / 2); return { R, ss: f(R), atMax: R > 0.999 * Rhi };
  }
  /* 3–5. classify the resampled points: the curve runs [{ a, b (point indices), sg, D, Lc, corner }] */
  function runs(Q, o, h) {
    const n = Q.length, m = Math.max(1, Math.round(o.win / 2 / h));
    const cth = []; for (let i = 0; i < n - 1; i++) cth.push(Math.atan2(Q[i + 1].y - Q[i].y, Q[i + 1].x - Q[i].x));
    for (let i = 1; i < cth.length; i++) cth[i] = cth[i - 1] + ang(cth[i] - cth[i - 1]);   // unwrapped chord headings
    const ths = []; for (let i = 0; i < n; i++) { const a = Q[Math.max(0, i - m)], b = Q[Math.min(n - 1, i + m)]; ths.push(Math.atan2(b.y - a.y, b.x - a.x)); }
    for (let i = 1; i < n; i++) ths[i] = ths[i - 1] + ang(ths[i] - ths[i - 1]);
    const sg = []; for (let i = 0; i < n; i++) { const a = Math.max(0, i - m), b = Math.min(n - 1, i + m), ds = Q[b].s - Q[a].s, k = ds > 0 ? (ths[b] - ths[a]) / ds : 0; sg.push(Math.abs(k) > 1 / o.Rmax ? Math.sign(k) : 0); }
    let R = []; for (let i = 0; i < n;) { if (!sg[i]) { i++; continue; } let j = i; while (j + 1 < n && sg[j + 1] === sg[i]) j++; R.push({ a: i, b: j, sg: sg[i] }); i = j + 1; }
    for (let k = R.length - 1; k > 0; k--) if (R[k].sg === R[k - 1].sg && Q[R[k].a].s - Q[R[k - 1].b].s < o.win) { R[k - 1].b = R[k].b; R.splice(k, 1); }   // merge
    const Dof = r => cth[Math.min(cth.length - 1, r.b)] - cth[Math.max(0, r.a - 1)];
    R.forEach(r => { r.D = Dof(r); });
    R = R.filter(r => Math.abs(r.D) >= o.minDelta * DEG && Math.sign(r.D) === r.sg);
    R.forEach(r => {   // the length holding the central 90 % of the heading change
      const i0 = Math.max(0, r.a - 1), i1 = Math.min(cth.length - 1, r.b); let tot = 0; const c = [0]; for (let i = i0 + 1; i <= i1; i++) { tot += Math.abs(cth[i] - cth[i - 1]); c.push(tot); }
      const sAt = f => { for (let k = 1; k < c.length; k++) if (c[k] >= f * tot) return Q[i0 + k].s; return Q[i1].s; };
      r.Lc = tot > 0 ? sAt(0.95) - sAt(0.05) : 0; r.corner = r.Lc < o.cornerL;
    });
    return { R, ths, m };
  }
  /* fit(pts, o) -> { ok, al, Q (the resampled simplified line), runs, why } */
  function fit(pts, o) {
    const uo = {}; Object.keys(DEF).forEach(k => { if (o && isNum(o[k]) && o[k] > 0) uo[k] = o[k]; });   // al.opt keeps only what was entered
    o = optOf(o); const raw = clean(pts); if (raw.length < 2) return { ok: false, why: 'draw at least two points' };
    const S = simplify(raw, o.tol), h = Math.max(1, o.win / 10), Q = resample(S, h), n = Q.length;
    if (n < 3 || Q[n - 1].s < 1) { return { ok: true, al: { pis: [raw[0], raw[raw.length - 1]], rad: [null, null], kind: ['end', 'end'], fit: [null, null], opt: uo }, Q, runs: [] }; }
    const { R: C, ths } = runs(Q, o, h);
    const tg = []; let ok = [];   // tangents: tg[k] lies before curve k (k = 0 … C.length)
    const dirAt = i => { const t = ths[i]; return { x: Math.cos(t), y: Math.sin(t) }; };
    for (let k = 0; k <= C.length; k++) {
      const a = k === 0 ? 0 : C[k - 1].b, b = k === C.length ? n - 1 : C[k].a, P = Q.slice(a, b + 1);
      if (P.length >= 3 && P[P.length - 1].s - P[0].s >= 2 * h) { const L = fitLine(P); tg.push({ c: L.c, u: L.u, a, b, from: 'ls' }); continue; }
      if (k === 0 || k === C.length) {   // the line starts / ends in a curve: the curve's circle at the end point
        const cv = C[k === 0 ? 0 : C.length - 1], cc = fitCircle(Q.slice(cv.a, cv.b + 1)), e = k === 0 ? Q[0] : Q[n - 1];
        let u = cc ? unit(left(sub(e, cc.c))) : dirAt(k === 0 ? 0 : n - 1); if (cc && Math.sign(cv.D) < 0) u = mul(u, -1);
        tg.push({ c: e, u, a, b, from: 'end' }); continue; }
      const mi = Math.round((a + b) / 2); tg.push({ c: Q[mi], u: dirAt(mi), a, b, from: 'mid' });
    }
    // PIs (a curve whose tangents do not meet ahead is dropped)
    const pis = [], kind = [], fitI = [], rad = [];
    const start = add(tg[0].c, mul(tg[0].u, dot(sub(Q[0], tg[0].c), tg[0].u)));
    pis.push(start); kind.push('end'); fitI.push(null); rad.push(null);
    let prevT = tg[0];
    for (let k = 0; k < C.length; k++) {
      const nx = tg[k + 1], PI = intersect(prevT.c, prevT.u, nx.c, nx.u), D = PI ? ang(Math.atan2(nx.u.y, nx.u.x) - Math.atan2(prevT.u.y, prevT.u.x)) : 0;
      const last = pis[pis.length - 1];
      if (!PI || Math.abs(D) < o.minDelta * DEG || dot(sub(PI, last), prevT.u) <= 0) { continue; }
      pis.push(PI); kind.push(C[k].corner ? 'turn' : 'curve'); rad.push(null); fitI.push({ k, D, prev: prevT, next: nx, Lc: C[k].Lc, corner: C[k].corner });
      prevT = nx;
    }
    const endT = prevT, end = add(endT.c, mul(endT.u, dot(sub(Q[n - 1], endT.c), endT.u)));
    pis.push(end); kind.push('end'); fitI.push(null); rad.push(null);
    // radii (curves): least squares, tangent to both tangents, within half of each tangent next to it (the whole of an end one)
    for (let i = 1; i < pis.length - 1; i++) {
      const f = fitI[i]; if (!f) continue;
      const ui = unit(sub(pis[i], pis[i - 1])), uo = unit(sub(pis[i + 1], pis[i])), D = ang(Math.atan2(uo.y, uo.x) - Math.atan2(ui.y, ui.x));
      const Lb = dist(pis[i - 1], pis[i]) * (i - 1 === 0 ? 1 : 0.5), Lf = dist(pis[i], pis[i + 1]) * (i + 1 === pis.length - 1 ? 1 : 0.5), t = Math.tan(Math.abs(D) / 2);
      if (f.corner) { fitI[i] = { Lc: f.Lc, corner: true }; continue; }
      const a = Math.round((f.prev.a + f.prev.b) / 2), b = Math.round((f.next.a + f.next.b) / 2), P = Q.slice(Math.max(0, a), Math.min(n - 1, b) + 1);
      const fr = fitRadius(P, pis[i], ui, uo, D, Math.max(1, Math.min(Lb, Lf) / t)), cc = fitCircle(Q.slice(C[f.k].a, C[f.k].b + 1));
      rad[i] = fr.R; fitI[i] = { Rls: cc ? cc.R : null, rms: Math.sqrt(fr.ss / P.length), n: P.length, Lc: f.Lc, R0: fr.R, atMax: fr.atMax };
    }
    return { ok: true, al: { pis, rad, kind, fit: fitI, opt: uo }, Q, runs: C };
  }
  /* 9. the deviation of the line from an alignment polyline (dense points of the path) */
  function deviation(line, apts) {
    const Q = resample(clean(line), 2); let max = 0, at = null, sum = 0;
    Q.forEach(p => { let d = Infinity; for (let i = 1; i < apts.length; i++) { const e = segDist(p, apts[i - 1], apts[i]); if (e < d) d = e; } if (d > max) { max = d; at = p; } sum += d * d; });
    return { max, at, rms: Math.sqrt(sum / Math.max(1, Q.length)), n: Q.length };
  }
  /* offset a polyline to the right (d > 0) or the left (d < 0): mitred joints, a bevel past 4 |d| */
  function offset(pts, d) {
    pts = clean(pts); const n = pts.length; if (n < 2 || !d) return pts.slice();
    const nr = []; for (let i = 0; i < n - 1; i++) { const u = unit(sub(pts[i + 1], pts[i])); nr.push({ x: u.y, y: -u.x }); }   // right normals
    const out = [add(pts[0], mul(nr[0], d))];
    for (let i = 1; i < n - 1; i++) { const a = nr[i - 1], b = nr[i], m = unit(add(a, b)), c = dot(m, a);
      if (c > 0.25) out.push(add(pts[i], mul(m, d / c))); else { out.push(add(pts[i], mul(a, d)), add(pts[i], mul(b, d))); } }
    out.push(add(pts[n - 1], mul(nr[n - 2], d))); return out;
  }
  /* stations: 1234.56 ft -> "12+34.56" */
  function sta(s) { if (!isNum(s)) return '—'; const neg = s < 0, a = Math.abs(s), h = Math.floor(a / 100 + 1e-9), r = a - h * 100; return (neg ? '-' : '') + h + '+' + (r < 10 ? '0' : '') + r.toFixed(2); }
  window.CranePickAlign = { DEF, optOf, simplify, resample, fitLine, fitCircle, fitRadius, tctDist, runs, fit, deviation, offset, sta, intersect };
})();
