/* apps/ps-bridge/engine/reltension.js — the concrete tensile force of an uncracked section, summed exactly by parts (window.PSBRelTension).
   Classic script, no DOM. Created 2026-11-25 (EZX, engineer "Merge, then exact", after PR #1714 EZNI).
   AN ENGINE CHANGE (CLAUDE.md §4; fixlog/ps-bridge.md EZX): AASHTO LRFD 10th Ed. Art. 5.9.2.3.1b, Table 5.9.2.3.1b-1 (and, near an interior
   support, 5.12.3.3.5 with the same table) asks for bonded reinforcement to carry the tensile force in the concrete computed on an uncracked
   section, at f_s = 0.5 f_y ≤ 30 ksi. The moved engine (engine/pbd-section.js releaseTensionForce, frozen byte for byte) sums that force
   over 240 horizontal strips at their mid-heights. This file replaces the strip sum by the exact sum, after computeAll, in the app's engine
   call (engine/holddown.js compute0: on each engine result, before the stages that run the chain more than once, UT-N and PL-A):
     the fibre stresses are linear over the depth (+ = compression); the tension zone runs from the tension fibre to c = h|f_t| / (|f_t| + |f_c|)
     (the whole depth when both fibres are in tension); the girder outline (halfPolygon, the one sectionWidthAt reads: voids ignored, as the
     engine) is cut into horizontal layers at its corners and at c; each layer is a trapezoid of widths b_a, b_b and thickness t:
     A = (b_a + b_b)/2 · t, centroid at d_a + t(b_a + 2b_b)/(3(b_a + b_b)) below the tension fibre, F = A · f(centroid) (exact for a linear
     stress over a trapezoid); T = ΣF.
   The same stations, stresses, outline, f_s and A_s,prov as the engine; only the sum changes. apply(inp, R) sets
     R.relSteel: Ttop, Tbot, T, x, where, AsReq, ok, dc (the governing case as the engine: top when T_top ≥ T_bot) and the check
       'Release tens. steel (5.9.2.3.1b)' (v = A_s,req, r = D/C, pass r ≤ 1.0001 as checksF);
     R.cont.svc: Ttop, AsTop and the check 'Top tens. steel (pier, 5.12.3.3.5)' (added or removed where its condition T > 0 changes);
     R.relT = { strip: { Ttop, Tbot, pier }, exact: { … } } (the engine's strip values kept, for the record and the tests).
   It recomputes the strip values from the same rows first and changes nothing unless they equal the engine's (a guard that the stations are
   the engine's). The frozen engine's own optimizer (pbd-optimize.js) calls computeAll directly and still uses the strip sum.
   parts(G, fTop, fBot) -> { from: 'top' | 'bottom' | null, ft, fo, c, full, parts: [{ name, da, db, ba, bb, t, A, dbar, f, F, k }], T }
     (da, db, dbar: depths below the tension fibre, in; consecutive pieces of one named part, e.g. a curved fillet, merged: A summed, dbar
     their area centroid, k the number of pieces). Moved unchanged from engine/worked-end.js (PR #1714), where the steps show these parts. */
(function () {
  'use strict';
  /* EZN (2026-11-25, engineer "Fix NEXT stems only"; §4): the concrete width at a height y. NEXT beams (G.isNext: the NEXT F and D shapes,
     the library's and MassDOT's): the length of the horizontal line at y inside the outline (the two stems only below the flange; the gap
     between them is not concrete), from the same outline halfPolygon(G), × 2 for the mirrored half. Every other shape: the engine's
     sectionWidthAt (the widest point of the outline at y; box and voided slab voids ignored, conservative), unchanged. Used only for the
     tension force here; the engine's section properties, drawings and every other check do not read it. */
  function chordWidth(G, y) {
    const P = halfPolygon(G), xs = [];
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length];
      if ((a[1] <= y) !== (b[1] <= y)) xs.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1])); }   // the closed outline (its last point back to the first, along the ℄)
    xs.sort((p, q) => p - q); let w = 0; for (let i = 0; i + 1 < xs.length; i += 2) w += xs[i + 1] - xs[i];
    return 2 * w;
  }
  const widthAt = (G, y) => (G.isNext ? chordWidth(G, y) : sectionWidthAt(G, y));
  function parts(G, fTop, fBot) {
    const h = G.h, top = fTop <= fBot, ft = top ? fTop : fBot, fo = top ? fBot : fTop;   // ft: the tension fibre (most negative); fo: the other
    if (!(ft < 0)) return { from: null, ft, fo, c: 0, full: false, parts: [], T: 0 };
    const full = fo < 0, c = full ? h : h * (-ft) / (-ft + fo);
    const yOf = u => top ? h - u : u, fAt = u => -ft - (fo - ft) * u / h;   // f(u): tension magnitude at depth u below the tension fibre
    const ys = [...new Set(halfPolygon(G).map(p => +p[1]).filter(y => y > 1e-9 && y < h - 1e-9))];
    const us = [0, ...ys.map(y => top ? h - y : y).filter(u => u < c - 1e-9), c].sort((a, b) => a - b);
    const wAt = (ua, ub) => { const e = 1e-6 * (ub - ua), w1 = widthAt(G, yOf(ua + e)), w2 = widthAt(G, yOf(ub - e)), s = (w2 - w1) / (ub - ua - 2 * e);
      return [w1 - s * e, w2 + s * e]; };   // the layer's widths at its two edges (read just inside it, where the outline is straight)
    const [ttf, ttf2, tbf, tbf2] = G.d || [0, 0, 0, 0], isI = !G.isNext && !G.isBox && !G.isDeck;
    const nameOf = (y0, y1) => { const m = (y0 + y1) / 2;
      if (G.isNext && G.next) return m > h - G.next.ft ? 'flange' : 'stems (the two stems; the gap between them not counted)';
      if (!isI) return 'full width (voids ignored, as the engine)';
      return m > h - ttf ? 'top flange' : m > h - ttf - ttf2 ? 'top flange taper' : m < tbf ? 'bottom flange' : m < tbf + tbf2 ? 'bottom flange taper' : 'web'; };
    const parts = [];
    for (let i = 0; i < us.length - 1; i++) {
      const da = us[i], db = us[i + 1], t = db - da; if (t < 1e-9) continue;
      const [ba, bb] = wAt(da, db), A = (ba + bb) / 2 * t, dbar = da + (ba + bb > 0 ? t * (ba + 2 * bb) / (3 * (ba + bb)) : t / 2), f = fAt(dbar);
      const name = nameOf(Math.min(yOf(da), yOf(db)), Math.max(yOf(da), yOf(db))), q = parts[parts.length - 1];
      if (q && q.name === name) { const A2 = q.A + A; q.dbar = (q.A * q.dbar + A * dbar) / A2; q.A = A2; q.db = db; q.t = db - q.da; q.bb = bb; q.k++; q.f = fAt(q.dbar); q.F = q.A * q.f; }
      else parts.push({ name, da, db, ba, bb, t, A, dbar, f, F: A * f, k: 1 });   // k: the outline's straight-sided pieces in the part (a curved fillet: several)
    }
    return { from: top ? 'top' : 'bottom', ft, fo, c, full, parts, T: parts.reduce((s, q) => s + q.F, 0) };
  }

  const PIER = 'Top tens. steel (pier, 5.12.3.3.5)', REL = 'Release tens. steel (5.9.2.3.1b)';
  function apply(inp, R) {
    if (!R || R.error || !R.relSteel || !R.grid || !R.grid.length || typeof releaseTensionForce !== 'function') return R;
    const G = R.g, rs = R.relSteel, grid = R.grid, worst = (key, fn) => grid.reduce((b, r) => fn(r[key], b[key]) ? r : b, grid[0]);
    const wT = worst('relTop', (a, b) => a < b), wB = worst('relBot', (a, b) => a < b);   // the engine's wRelT, wRelBT (pbd-compute.js)
    if (releaseTensionForce(G, wT.relTop, wT.relBot) !== rs.Ttop || releaseTensionForce(G, wB.relTop, wB.relBot) !== rs.Tbot) return R;   // not the engine's stations: leave R
    const strip = { Ttop: rs.Ttop, Tbot: rs.Tbot }, Ttop = parts(G, wT.relTop, wT.relBot).T, Tbot = parts(G, wB.relTop, wB.relBot).T;
    const gov = Ttop >= Tbot ? { T: Ttop, x: wT.x, where: 'top (ends)' } : { T: Tbot, x: wB.x, where: 'bottom (midspan)' };
    const AsReq = rs.fs > 0 ? gov.T / rs.fs : 0, AsProv = rs.AsProv;
    Object.assign(rs, { Ttop, Tbot, T: gov.T, x: gov.x, where: gov.where, AsReq, ok: AsProv >= AsReq - 1e-6, dc: AsReq > 1e-9 ? (AsProv > 0 ? AsReq / AsProv : 99) : 0 });
    const k = R.checks.findIndex(c => c.n === REL);
    if (k >= 0) R.checks[k] = Object.assign({}, R.checks[k], { v: rs.AsReq, lim: rs.AsProv, r: rs.dc, loc: rs.x, pass: rs.dc <= 1.0001 });
    const exact = { Ttop, Tbot };
    const v = R.cont && R.cont.svc;
    if (v && v.wT) {
      const T0 = v.wT.s3TopN < 0 ? releaseTensionForce(G, v.wT.s3TopN, v.wT.s3BotN) : 0;
      if (T0 === v.Ttop) {
        strip.pier = v.Ttop; const T = v.wT.s3TopN < 0 ? parts(G, v.wT.s3TopN, v.wT.s3BotN).T : 0; exact.pier = T;
        v.Ttop = T; v.AsTop = T / v.fsT;
        const j = R.checks.findIndex(c => c.n === PIER), want = !v.topRC && v.bonded && v.Ttop > 0 && v.AsTopProv > 0;
        const ck = { n: PIER, v: v.AsTop, lim: v.AsTopProv, r: v.AsTop / v.AsTopProv, loc: v.wT.x, u: 'in²' }; ck.pass = ck.r <= 1.0001;
        if (want && j >= 0) R.checks[j] = Object.assign({}, R.checks[j], ck);
        else if (want) { const a = R.checks.findIndex(c => c.n === 'Srv III top tens (pier, 5.12.3.3.5)'); R.checks.splice(a >= 0 ? a + 1 : R.checks.length, 0, ck); }
        else if (j >= 0) R.checks.splice(j, 1);
      }
    }
    R.relT = { strip, exact };
    return R;
  }
  window.PSBRelTension = { parts, apply, widthAt, chordWidth, REL, PIER };
})();
