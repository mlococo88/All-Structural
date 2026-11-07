/* shared/pile-group.js — rigid-cap pile-group statics (window.SharedPileGroup).
   Classic script, no DOM, no state. Created 2026-11-07 (Retaining Wall Designer, Phase 8 "pile-supported footing").
   Pure functions of plain numbers, tested in Node (tests/engine/pile-group.test.mjs).

   Basis: a rigid pile cap on identical vertical piles with pinned heads. Each pile takes an axial load that varies
   linearly with its distance from the pile-group centroid (the usual elastic rigid-cap distribution, e.g.
   AASHTO LRFD 10th Ed. Art. C10.7.1 / standard foundation texts); each pile takes an equal share of the horizontal
   load. Nothing here is a code provision: it is statics. The resistances and checks belong to the calling tool.

   Units: coordinates and spacings in ft, forces in kip, moments in kip-ft. Per-unit-length functions take
   forces per ft of wall (kip/ft) and moments per ft (kip-ft/ft); their per-pile results are kip per pile.

   Discrete group (a footing with individual piles; the abutment calculator's form, ABPX2):
   groupProps(piles)          piles = [{x, y}] → {n, xgc, ygc, Sxx = Σ(x−xgc)², Syy = Σ(y−ygc)², Sxy = Σ(x−xgc)(y−ygc)}.
   reaction(V,My,Mx,xi,yi,pi) the load on one pile at (xi, yi) from the group centroid:
        P_i = V/n + [(My·Syy − Mx·Sxy)·xi + (Mx·Sxx − My·Sxy)·yi] / (Sxx·Syy − Sxy²)   when Sxy ≠ 0,
        P_i = V/n + My·xi/Sxx + Mx·yi/Syy                                              when Sxy = 0
      (a zero Sxx or Syy drops that term). pi = {n, Sxx, Syy, Sxy}. Same expression and operation order as the abutment
      calculator's pileReaction (abutment_calculator.html, ABPX2), so the two give identical numbers.

   Rows of piles along a wall (per unit length of wall; the Retaining Wall Designer's form):
   rowGroup(rows)             rows = [{x, s}]: x = distance of the row from the reference edge (the toe), s = pile spacing
                              along the wall. n_i = 1/s_i piles per ft; N = Σn_i; x̄ = Σn_i·x_i/N; I = Σn_i·(x_i − x̄)².
                              Returns {ok, err, N, xbar, I, rows:[{x, s, n, xp = x − x̄}]}.
   rowLoads(g, V, M, H)       V, H per ft; M per ft about the group centroid, + when the resultant is on the +x side of x̄
                              (M = V·(x_R − x̄), see momentAbout). Per row: P = V/N + M·x'/I per pile (the discrete
                              formula with n → N, Sxx → I, i.e. reaction(V, M, 0, x', 0, {n:N, Sxx:I, Syy:0, Sxy:0})),
                              q = n·P (kip/ft of wall, the row's line load), h = H/N per pile (equal share), qh = n·h.
                              With I = 0 (one row) and M ≠ 0 the group cannot take the moment: P = NaN, unstable = true.
                              Returns {N, xbar, I, V, M, H, rows:[{x, s, n, xp, P, q, h, qh}], Pmax, Pmin, iMax, iMin,
                              uplift (Pmin < 0), unstable, sumQ (= V), sumQx (= V·x_R about the reference edge)}.
   momentAbout(V, xR, xbar)   V·(xR − xbar): the moment of a resultant V at x_R about the centroid x̄. */
(function () {
  'use strict';

  function reaction(V, My, Mx, xi, yi, pi) {
    const n = pi.n, Sxx = pi.Sxx, Syy = pi.Syy, Sxy = pi.Sxy || 0, D = Sxx * Syy - Sxy * Sxy;
    if (Math.abs(Sxy) > 1e-9 * Math.max(1, Sxx + Syy) && D > 1e-9) return V / n + ((My * Syy - Mx * Sxy) * xi + (Mx * Sxx - My * Sxy) * yi) / D;
    return V / n + (Sxx > 1e-9 ? My * xi / Sxx : 0) + (Syy > 1e-9 ? Mx * yi / Syy : 0);
  }

  function groupProps(piles) {
    const act = (piles || []).filter(p => p && p.active !== false), n = act.length;
    if (!n) return { n: 0, xgc: 0, ygc: 0, Sxx: 0, Syy: 0, Sxy: 0 };
    const xgc = act.reduce((a, c) => a + c.x, 0) / n;
    const ygc = act.reduce((a, c) => a + c.y, 0) / n;
    const Sxx = act.reduce((a, c) => a + Math.pow(c.x - xgc, 2), 0);
    const Syy = act.reduce((a, c) => a + Math.pow(c.y - ygc, 2), 0);
    const Sxy = act.reduce((a, c) => a + (c.x - xgc) * (c.y - ygc), 0);
    return { n, xgc, ygc, Sxx, Syy, Sxy };
  }

  function rowGroup(rows) {
    const rs = (rows || []).map(r => ({ x: +r.x, s: +r.s }));
    if (!rs.length) return { ok: false, err: 'no pile rows', N: 0, xbar: 0, I: 0, rows: [] };
    const bad = rs.find(r => !isFinite(r.x) || !isFinite(r.s) || !(r.s > 0));
    if (bad) return { ok: false, err: 'every row needs a finite position and a spacing > 0', N: 0, xbar: 0, I: 0, rows: [] };
    rs.forEach(r => { r.n = 1 / r.s; });
    const N = rs.reduce((a, r) => a + r.n, 0);
    const xbar = rs.reduce((a, r) => a + r.n * r.x, 0) / N;
    rs.forEach(r => { r.xp = r.x - xbar; });
    const I = rs.reduce((a, r) => a + r.n * r.xp * r.xp, 0);
    return { ok: true, err: '', N, xbar, I, rows: rs };
  }

  function momentAbout(V, xR, xbar) { return V * (xR - xbar); }

  function rowLoads(g, V, M, H) {
    V = +V || 0; M = +M || 0; H = +H || 0;
    const tolM = 1e-9 * Math.max(1, Math.abs(V)), unstable = !(g.I > 1e-9) && Math.abs(M) > tolM;
    const pi = { n: g.N, Sxx: g.I, Syy: 0, Sxy: 0 };
    const rows = g.rows.map(r => {
      const P = unstable ? NaN : reaction(V, M, 0, r.xp, 0, pi), h = H / g.N;
      return { x: r.x, s: r.s, n: r.n, xp: r.xp, P, q: r.n * P, h, qh: r.n * h };
    });
    let iMax = 0, iMin = 0;
    rows.forEach((r, i) => { if (r.P > rows[iMax].P) iMax = i; if (r.P < rows[iMin].P) iMin = i; });
    const sumQ = rows.reduce((a, r) => a + r.q, 0), sumQx = rows.reduce((a, r) => a + r.q * r.x, 0);
    return { N: g.N, xbar: g.xbar, I: g.I, V, M, H, rows, Pmax: rows.length ? rows[iMax].P : NaN, Pmin: rows.length ? rows[iMin].P : NaN,
      iMax, iMin, uplift: rows.length > 0 && rows[iMin].P < 0, unstable, sumQ, sumQx };
  }

  window.SharedPileGroup = { reaction, groupProps, rowGroup, rowLoads, momentAbout };
})();
