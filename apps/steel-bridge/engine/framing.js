/* apps/steel-bridge/engine/framing.js — cross-frame layout of a steel I-girder bridge (window.SBDFraming). Classic script, no DOM.
   Needs window.SharedSteps (steps) and window.SBDOwners (owner rule xf.orient), loaded first and read at call time.

   Ported 2026-10-29 from Preliminary sizing ("Steel Bridge Design.html", the page text in <script type="text/plain" id="pl-src">),
   the layout GirderDetail takes its brace points and cross-frame weights from:
     - framingLayout(P, m) (anchor `function framingLayout(P, m) {`), copied line for line below as layout(P, m), with its helpers
       plPierSp, plPierLen and FL_MEMO; plOwnXf (anchor `function plOwnXf(P, m) {`) reads the owner rule xf.orient from
       window.SBDOwners (GirderDetail's OWN_RULES table, verbatim there) instead of the page's GD_OWN_RULES;
     - plXfDef(FR) (anchor `function plXfDef(FR) {`): the frame list GirderDetail's DC1 cross-frame point loads use (xfDef);
     - Preliminary sizing's per-girder brace points and station mapping of the Girder section rows (anchors `const brOf = {}, braceG`,
       `const toG =`, `const toX =`, `const lbMax =`): braces, toG, toX, lbMax.
   AASHTO LRFD 10th Ed. Art. 6.7.4.2.1 and C6.7.4.2.1: per span, cross-frames parallel to the skew where both supports are skewed 20° or
   less, else normal to the girders (owner rule OWN1 may set it for the whole bridge); normal frames contiguous, staggered or (RIDOT)
   stepped; the first intermediate frame at least e = max(clear distance, 4b_f, 0.4s) from the bearing at a support skewed more than
   20°; corner frames in the acute corners; end (bearing-line) frames along each support; field splices and shop transitions avoided
   by shifting the grid; an optional closer spacing near interior supports (pier regions).
   tests/engine/framing.test.mjs runs Preliminary sizing's own framingLayout in Node on the same inputs and compares every frame.

   Inputs (layout): P = { framing: { spacing (s, ft), spPier (s_p near interior supports, ft; blank = none), pierLen (pier region each side, ft;
       blank = 0.25 L), orient: 'auto' | 'parallel' | 'normal', arrange: 'contiguous' | 'staggered' | 'stepped', supClear (ft), stagMin (ft) },
       limits: { spliceClear (ft), dot (owner) } };
     m = { nb, S, bays [ft], skews [deg, one per support], sup [ft], spans [ft], cont, splices [ft], trans [{ x, atSplice }], webTrans [{ x }],
       top / bot [{ x0, x1, b (in) }] } (Preliminary sizing's buildModel fields that framingLayout reads).
   Output FR = { frames: [{ type: 'sup' | 'int', k, bay, xa, xc }], girders: [{ i, y, x0, bear, pts: [{ s, f, side }] }], orient (per span),
     xb, ys, yc, sp, own }; x along the bridge (ft, plan), each girder's own stations s from its Abut. 1 bearing.
   Units: ft (plan), in (b_f), degrees (skew). */
(function () {
  'use strict';
  const ED = 'AASHTO LRFD 10th Ed.';
  const St = () => window.SharedSteps;
  const n2 = x => St().n(x, 2), n3 = x => St().n(x, 3);
  const plOwner = Pp => { const d = Pp && Pp.limits && Pp.limits.dot, O = window.SBDOwners; return O && O.LIST.includes(d) ? d : 'AASHTO'; };
  const ownRule = (o, id) => (window.SBDOwners && o !== 'AASHTO' ? window.SBDOwners.rule(o, id) : null) || null;

  /* ================= Preliminary sizing (pl-src), copied unchanged ================= */
  /* cross-frame layout (SKX, 2026-10-15; AASHTO LRFD 10th Ed. 6.7.4.2.1 and C6.7.4.2.1). Per span:
     - orientation as before: automatic, parallel where both supports are skewed 20° or less, else normal to the girders.
       Owner rule xf.orient (OWN1, 2026-10-15; RIDOT BDM 6.4.3, CTDOT BRSDM V2 6.7.4.2; whole bridge, engineer's decision): with the orientation
       Automatic, the largest support skew anywhere on the bridge decides for every span: 20° or less, parallel to the skew (not staggered); more,
       normal to the girders and staggered (the "Normal frames" setting is not used). Set by hand (Parallel / Normal): as entered, check X1 flags it.
       AASHTO and MassDOT: per span, as before. RIDOT (2026-10-19, engineer's decision from the RIDOT standard framing plan for skew greater than 20°):
       more than 20°, normal to the girders and 'stepped' instead of staggered: lines parallel to the bearings, n = ⌈L/s⌉ − 1 evenly spaced along ℄ roadway
       (L the span along ℄; else the grid below, its end lines e clear of the nearest bearing), in each bay one frame where the line crosses the bay
       centerline (adjacent bays offset S·tan θ), then the corner frames, splice shifts and pier regions below, in ℄ stations (normSpan, mp).
     - parallel frames: n = ⌈L_max/s⌉ − 1 per bay, with L_max the longest girder span between the two bearing lines (was the centerline span), interpolated
       between the bearing lines, so no girder exceeds the target s.
     - normal frames: a grid at one spacing for the span (half a spacing further in alternate bays if staggered), anchored at the bearing of the obtuse-corner
       girder of each skewed (> 20°) support: the first full line at e = max(clear of bearing, 4b_f, 0.4 s) from it, so on every girder the first intermediate
       frame is at least e from that girder's own bearing (C6.7.4.2.1); at a support skewed 20° or less the first line is one spacing from the bearing (as
       before). Grid stations are kept in each bay where they are at least e (skewed support) or the clear distance from both of that bay's bearings. A girder
       panel still longer than s (the acute corners) gets frames in an adjacent bay, each either at the station of a frame on the girder's other side
       (connecting through) or at least d_min = max(min. offset, 4b_f) from every other frame on both girders it connects, and at least max(clear, 4b_f)
       from their bearings. b_f: the widest flange plate in the span.
     - field splices and shop transitions: where a frame falls within the splice clearance, the grid is shifted within the span (end offsets changed, same
       number of frames); extra frames are used only where that clears every conflict; otherwise the conflicts are reported (check X4, Framing tab).
     - pier regions (FSP, 2026-10-15; optional framing.spPier, "Spacing near interior supports"): in a continuous unit, with s_p > 0 and below the target s,
       the frames next to each interior support are spaced s_p (the first one s_p, or e = max(clear, 4b_f, 0.4 s_p) at a support skewed more than 20°, from the
       obtuse-corner bearing) until the region is covered on every girder: framing.pierLen each side of the support (blank: 0.25 times the adjacent span, about
       the dead-load point of contraflexure of continuous spans); the rest of the span is evenly spaced at most s, the region boundary being a common grid line
       (no panel shorter than the smaller spacing); where the two pier zones of a span would leave less than s_p between them, the whole span is spaced at most
       s_p. Corner frames, shifts, extra frames and conflicts as above, with the limit s_p for panels whose midpoint is in a pier zone. Blank (or s_p >= s, or
       simple spans): exactly as before.
     orient[k] (per span): { k, th, o, nInt, base, conflicts, s, n (frames per bay), e0, e1, bf, dmin, flat (staggered at s/2 < d_min: contiguous), shift, extra,
       pz (pier regions only: { sp2, pS, pE, rS, rE, Z0, Z1, one, par }) } */
  const FL_MEMO = new Map();   // framingLayout: span frames by their inputs (SKX)
  // FSP: the pier-region spacing in use (null: none): framing.spPier > 0 and below the target spacing, continuous unit with interior supports
  function plPierSp(F, m) { const s2 = +F.spPier, sp = +F.spacing; return m.cont && m.sup.length > 2 && s2 > 0 && s2 < sp - 1e-9 ? s2 : null; }
  // FSP: length of the pier region on the span side of a support (ft): framing.pierLen, or 0.25 times that span
  function plPierLen(F, Ls) { const r = +F.pierLen; return r > 0 ? r : 0.25 * Ls; }
  function layout(P, m) {
    const F = P.framing, nb = m.nb, S = m.S, ys = [0]; m.bays.forEach(v => ys.push(ys[ys.length - 1] + v)); const yc = ys[ys.length - 1] / 2;
    const tn = m.skews.map(d => Math.tan(d * Math.PI / 180));
    const xb = (k, i) => m.sup[k] + (ys[i] - yc) * tn[k];               // global x of bearing k on girder i
    const sp = +F.spacing, clr = +F.supClear, frames = [], orient = [], EPS = 1e-6;
    const sp2 = plPierSp(F, m), nS = m.sup.length;   // FSP
    /* FSP: grid lines a..z (ft, increasing) with pier zones: from a, panels sp2 until c0 (the region end at the start support) is passed (pS), the same back
       from z to c1 (pE); between, at most sp, evenly; add: extra intervals between. If the zones leave less than sp2 between them, one zone a..z at most sp2.
       dropA / dropZ: a / z is a bearing (an unskewed support), not a frame line, and is left out of L. s2 (optional): the zone panel, at most sp2.
       Returns { L (lines), tm (spacing between the zones), t0 / t1 (end panels of a..z), Z0 / Z1 (zone boundaries; +-Infinity: none or all), one } */
    function pzGrid(pz, c0, c1, a, z, add, dropA, dropZ, s2) {
      const q = s2 || sp2, out = (L, o) => ({ ...o, L: L.filter((x, j) => !(dropA && j === 0) && !(dropZ && j === L.length - 1)) });
      if (!(z > a + 1e-9)) return out([a, z], { tm: sp, t0: q, t1: q, Z0: pz.pS ? Infinity : -Infinity, Z1: pz.pE ? -Infinity : Infinity, one: true });
      const n0 = pz.pS ? Math.max(0, Math.ceil((c0 - a) / q - 1e-9)) : 0, n1 = pz.pE ? Math.max(0, Math.ceil((z - c1) / q - 1e-9)) : 0, Z0 = a + n0 * q, Z1 = z - n1 * q;
      if (Z1 - Z0 < q - 1e-9) { const n = Math.max(1, Math.ceil((z - a) / q - 1e-9)) + add, t = (z - a) / n, L = [];
        for (let j = 0; j < n; j++) L.push(a + j * t); L.push(z);
        return out(L, { tm: t, t0: t, t1: t, Z0: pz.pS ? Infinity : -Infinity, Z1: pz.pE ? -Infinity : Infinity, one: true }); }
      const nm = Math.max(1, Math.ceil((Z1 - Z0) / sp - 1e-9)) + add, tm = (Z1 - Z0) / nm, L = [];
      for (let j = 0; j < n0; j++) L.push(a + j * q);
      for (let j = 0; j < nm; j++) L.push(Z0 + j * tm);
      for (let j = 0; j < n1; j++) L.push(Z1 + j * q); L.push(z);
      return out(L, { tm, t0: n0 ? q : tm, t1: n1 ? q : tm, Z0: pz.pS ? Z0 : -Infinity, Z1: pz.pE ? Z1 : Infinity, one: false });
    }
    // FSP: the panel limit for a panel g0..g1 of a grid G (sp2 where its midpoint is in a pier zone)
    const pzLim = (pz, G) => (g0, g1) => { const mid = (g0 + g1) / 2; return (pz.pS && mid < G.Z0) || (pz.pE && mid > G.Z1) ? sp2 : sp; };
    for (let k = 0; k < m.sup.length; k++) for (let b = 0; b < nb - 1; b++) frames.push({ type: 'sup', k, bay: b, xa: xb(k, b), xc: xb(k, b + 1) });
    const feats = [...m.splices, ...m.trans.filter(t => !t.atSplice).map(t => t.x), ...m.webTrans.map(t => t.x)], fc = +P.limits.spliceClear;
    const conflicts = list => list.reduce((n, f) => n + [[f.xa, f.bay], [f.xc, f.bay + 1]].some(([x, g]) => feats.some(q => Math.abs(x - xb(0, g) - q) < fc - 1e-9)), 0);
    const gi = [...Array(nb).keys()], ox = plOwnXf(P, m), oxA = ox.on && F.orient === 'auto';   // OWN1: owner orientation rule (whole bridge)
    m.spans.forEach((Ls, k) => {
      const th = Math.max(Math.abs(m.skews[k]), Math.abs(m.skews[k + 1]));
      const o = F.orient === 'auto' ? (oxA ? ox.o : th <= 20 + 1e-9 ? 'parallel' : 'normal') : F.orient;
      const arr = oxA && o === 'normal' ? ox.arr : F.arrange;   // OWN1: the arrangement used (the "Normal frames" setting unless the owner rule applies: CTDOT 'staggered', RIDOT 'stepped' since 2026-10-19)
      const Lmax = Math.max(...gi.map(i => xb(k + 1, i) - xb(k, i)));
      // b_f (C6.7.4.2.1): the widest top or bottom flange plate within the span (any girder; own stations from its Abut. 1 bearing)
      const s0g = Math.min(...gi.map(i => xb(k, i) - xb(0, i))), s1g = Math.max(...gi.map(i => xb(k + 1, i) - xb(0, i))); let bfIn = 0;
      [...m.top, ...m.bot].forEach(r => { if (r.x1 > s0g + 1e-9 && r.x0 < s1g - 1e-9) bfIn = Math.max(bfIn, r.b); });
      const bf = bfIn / 12, dmin = Math.max(+F.stagMin || 0, 4 * bf);
      // the span's frames depend only on these inputs: memoized (Suggest builds the layout of many candidates with the same splices and transitions); copies returned
      // FSP: the pier regions of this span (support k and k + 1 interior, continuous unit, s_p in use)
      const pz = sp2 ? { sp2, pS: k > 0, pE: k + 1 < nS - 1, rS: plPierLen(F, Ls), rE: plPierLen(F, Ls) } : null;
      const mk = JSON.stringify([k, o, sp, clr, F.stagMin, arr, fc, m.sup, m.skews, m.bays, feats, bf, ...(pz ? [pz] : [])]);
      let pick = FL_MEMO.get(mk); if (!pick) { pick = o === 'parallel' ? (pz ? parSpanP(k, Lmax, pz) : parSpan(k, Lmax)) : normSpan(k, bf, dmin, pz, arr); FL_MEMO.set(mk, pick); if (FL_MEMO.size > 400) FL_MEMO.delete(FL_MEMO.keys().next().value); }
      pick = { ...pick, fr: pick.fr.map(f => ({ ...f })) };
      frames.push(...pick.fr);
      orient.push({ k, th, o, arr, nInt: pick.n, base: pick.base, conflicts: pick.c, s: pick.s, n: pick.n, shift: pick.shift || 0, extra: pick.n > pick.base, bf, dmin, Lmax, ...(pick.info || {}), ...(pick.pz ? { pz: pick.pz } : {}) });
    });
    /* parallel frames: n per bay from the longest girder; frames at the fractions (j + d)/(n + 1) of each girder's span. Conflicts: shifts d of up to a
       quarter panel first (the end panel of the longest girder stays within s), then up to three extra frames, accepted only when they clear every conflict; if none does, evenly spaced (d = 0) */
    function parSpan(k, Lmax) {
      const base = Math.max(0, Math.ceil(Lmax / sp - 1e-9) - 1), gen = (n, d) => { const fr = [];
        for (let j = 1; j <= n; j++) { const f = (j + d) / (n + 1); for (let b = 0; b < nb - 1; b++) fr.push({ type: 'int', k, bay: b, xa: (1 - f) * xb(k, b) + f * xb(k + 1, b), xc: (1 - f) * xb(k, b + 1) + f * xb(k + 1, b + 1) }); }
        return fr; };
      const DS = [0, 0.05, -0.05, 0.1, -0.1, 0.15, -0.15, 0.2, -0.2, 0.25, -0.25]; let best = null;
      for (let add = 0; add <= 3; add++) { const n = base + add;
        for (const d of (n ? DS : [0])) { if (d && (1 + Math.abs(d)) * Lmax / (n + 1) > sp + 1e-9) continue;
          const fr = gen(n, d), c = conflicts(fr), r = { fr, c, n, base, s: Lmax / (n + 1), shift: d };
          if (!c) return r; if (!add && !best) best = r; } }   // none clears every conflict: evenly spaced (d = 0), conflicts reported
      return best;
    }
    /* FSP: parallel frames with pier regions. Lines at t along the longest girder (0..L_max, bearings at both ends), on every girder at the fraction t/L_max
       between its bearings; the pier zones cover the region on the shortest girder (r·L_max/L_min). Conflicts: either end anchor moved by up to a quarter of
       its end panel (the end panel kept within its limit, s_p in a pier zone), then up to three extra intervals between the zones; none clears: the base layout */
    function parSpanP(k, Lmax, pz) {
      const Lmin = Math.min(...gi.map(i => xb(k + 1, i) - xb(k, i))), f = Lmax / Math.max(Lmin, 1e-6), c0 = pz.rS * f, c1 = Lmax - pz.rE * f;
      const gen = G => { const fr = []; G.L.forEach(t => { const q = t / Lmax; for (let b = 0; b < nb - 1; b++) fr.push({ type: 'int', k, bay: b, xa: (1 - q) * xb(k, b) + q * xb(k + 1, b), xc: (1 - q) * xb(k, b + 1) + q * xb(k + 1, b + 1) }); }); return fr; };
      const G0 = pzGrid(pz, c0, c1, 0, Lmax, 0, true, true), limS = pz.pS ? sp2 : sp, limE = pz.pE ? sp2 : sp;
      const info = G => ({ sp2, pS: pz.pS, pE: pz.pE, rS: pz.rS, rE: pz.rE, Z0: G.Z0, Z1: G.Z1, one: G.one, par: true, tm: G.tm });
      const FS = [0.05, 0.1, 0.15, 0.2, 0.25], pairs = [[0, 0]]; FS.forEach(q => pairs.push([q, 0], [-q, 0], [0, q], [0, -q], [q, q], [-q, -q], [q, -q], [-q, q]));
      let best = null;
      for (let add = 0; add <= 3; add++) for (const [d0, d1] of pairs) {
        const a = d0 * G0.t0, z = Lmax - d1 * G0.t1, G = pzGrid(pz, c0, c1, a, z, add, true, true);
        if (!G.L.length || G.L[0] > limS + 1e-9 || Lmax - G.L[G.L.length - 1] > limE + 1e-9 || G.L[0] < 0.7 * G0.t0 || Lmax - G.L[G.L.length - 1] < 0.7 * G0.t1) continue;
        const fr = gen(G), c = conflicts(fr), r = { fr, c, n: G.L.length, base: G0.L.length, s: G.tm, shift: d0 || d1 ? Math.max(Math.abs(d0), Math.abs(d1)) : 0, pz: info(G) };
        if (!c) return r; if (!best) best = r; }
      return best || { fr: gen(G0), c: conflicts(gen(G0)), n: G0.L.length, base: G0.L.length, s: G0.tm, shift: 0, pz: info(G0) };
    }
    /* normal frames */
    function normSpan(k, bf, dmin, pz, arr) {
      const A = gi.map(i => xb(k, i)), B = gi.map(i => xb(k + 1, i)), stp = arr === 'stepped';
      /* RIDOT stepped (2026-10-19, RIDOT standard framing plan for skew > 20°): grid lines are lines parallel to the bearings, x = their station on the
         centerline (y = yc, ℄ roadway; W.P. = the centerline bearing station), interpolated between the two bearing lines like parallel frames; in bay b the
         frame is normal to the girders where the line crosses the bay centerline (xm: the bearing at the bay centerline). hS / hE: the largest distance from
         a bay's centerline bearing to its farther bearing, so a line x keeps every frame at least x - X_k - hS from its own bearings. Other arrangements: mp(b, x) = x */
      const Lc = m.sup[k + 1] - m.sup[k], xm = (kk, b) => m.sup[kk] + ((ys[b] + ys[b + 1]) / 2 - yc) * tn[kk];
      const mp = stp ? (b, x) => { const f = (x - m.sup[k]) / Lc; return (1 - f) * xm(k, b) + f * xm(k + 1, b); } : (b, x) => x;
      const bys = gi.slice(0, -1), hS = stp ? Math.max(0, ...bys.map(b => Math.max(A[b], A[b + 1]) - xm(k, b))) : 0, hE = stp ? Math.max(0, ...bys.map(b => xm(k + 1, b) - Math.min(B[b], B[b + 1]))) : 0;
      const Amax = stp ? m.sup[k] + hS : Math.max(...A), Bmin = stp ? m.sup[k + 1] - hE : Math.min(...B);
      const lo0 = Math.min(...A), hi0 = Math.max(...B), e4 = 4 * bf, skS = Math.abs(m.skews[k]) > 20 + 1e-9, skE = Math.abs(m.skews[k + 1]) > 20 + 1e-9;
      const eOf = s => Math.max(clr, e4, 0.4 * s), eFl = Math.max(clr, e4);   // C6.7.4.2.1: first frame offset from a skewed support; floor 4b_f for corner frames
      const T = Bmin - Amax, cnt = (skS ? 0 : 1) + (skE ? 0 : 1);
      // the default grid: q intervals between the first and the last full line, end panels e (skewed support) or one spacing
      let s = sp, e = eOf(sp), q = 0;
      for (let it = 0; it < 8; it++) { const fx = (skS ? e : 0) + (skE ? e : 0), tot = Math.max(1, Math.ceil((T - fx) / sp - 1e-9)); q = Math.max(0, tot - cnt); s = tot > 0 && T - fx > 0 ? (T - fx) / tot : sp; e = eOf(s); }
      let X0 = Amax + (skS ? e : s), X1 = Bmin - (skE ? e : s), dA = false, dZ = false, rc0 = 0, rc1 = 0, eA = 0, eZ = 0;
      // RIDOT stepped: n = ⌈L/s⌉ - 1 lines evenly spaced along ℄ (L: the span along ℄, s_c = L/(n + 1)) where every frame is then clear of its bearings
      // (e = max(clear, 4b_f, 0.4s_c) at a support skewed more than 20°, else the clear distance); otherwise the grid above (its end lines e from the nearest bearing)
      if (stp && !pz) { const n = Math.ceil(Lc / sp - 1e-9) - 1, sc = Lc / (n + 1);
        if (n >= 1 && sc - hS >= (skS ? eOf(sc) : clr) - 1e-9 && sc - hE >= (skE ? eOf(sc) : clr) - 1e-9) { s = sc; e = eOf(sc); q = n - 1; X0 = m.sup[k] + sc; X1 = m.sup[k + 1] - sc; } }
      // FSP pier regions: the end lines at an unskewed support are its bearing (left out); at a support skewed more than 20°, e from the obtuse bearing with
      // the panel next to it (s_p in a pier zone; else the spacing between the zones, iterated); region ends c0 / c1 from the obtuse bearings
      if (pz) { rc0 = Amax + pz.rS; rc1 = Bmin - pz.rE; dA = !skS; dZ = !skE; let tm = s;
        for (let it = 0; it < 8; it++) { X0 = skS ? Amax + eOf(pz.pS ? sp2 : tm) : Amax; X1 = skE ? Bmin - eOf(pz.pE ? sp2 : tm) : Bmin; tm = pzGrid(pz, rc0, rc1, X0, X1, 0, dA, dZ).tm; }
        s = tm; q = 0; eA = skS ? eOf(pz.pS ? sp2 : tm) : clr; eZ = skE ? eOf(pz.pE ? sp2 : tm) : clr; }
      const stag = arr === 'staggered', flat = stag && (pz ? Math.min(s, sp2) : s) / 2 < dmin - 1e-9;
      let LIM = null; const limP = (g0, g1) => LIM ? LIM(g0, g1) : sp;   // FSP: the panel limit (s_p in a pier zone, else s)
      const gen = (x0, x1, qq) => {   // grid lines x0..x1 (qq intervals, extended past both ends), kept per bay; then the corner frames (FSP: pier zones, qq extra intervals)
        const G = pz ? pzGrid(pz, rc0, rc1, x0, x1, qq, dA, dZ) : null, ss = G ? G.tm : qq > 0 ? (x1 - x0) / qq : s, eS = G ? eA : skS ? e : clr, eE = G ? eZ : skE ? e : clr, bays = [];
        LIM = G ? pzLim(pz, G) : null;
        let ext = null; if (G && G.L.length) { ext = [...G.L]; const f = G.L[0], l = G.L[G.L.length - 1];   // FSP: the lines extended past both ends with the end panels
          for (let x = f - G.t0; x >= lo0 - G.t0 - 1e-9; x -= G.t0) ext.unshift(x); for (let x = l + G.t1; x <= hi0 + G.t1 + 1e-9; x += G.t1) ext.push(x); }
        const ln = new Set();   // RIDOT stepped: the lines that carry frames (station along ℄ from the W.P. of the span's first support)
        for (let b = 0; b < nb - 1; b++) {
          const lo = Math.max(A[b], A[b + 1]) + eS, hi = Math.min(B[b], B[b + 1]) - eE, off = stag && !flat && b % 2 ? ss / 2 : 0, xs = [];
          const put = x => { const y = mp(b, x); if (y >= lo - 1e-9 && y <= hi + 1e-9) { xs.push(y); if (stp) ln.add(+(x - m.sup[k]).toFixed(3)); } };   // y = x unless stepped
          if (G) { if (ext) (off ? ext.slice(1).map((x, j) => (x + ext[j]) / 2) : ext).forEach(put); }
          else if (x1 >= x0 - 1e-9) { const j0 = Math.floor((lo0 - x0 - off) / ss) - 1, j1 = Math.ceil((hi0 - x0 - off) / ss) + 1;
            for (let j = j0; j <= j1; j++) put(x0 + off + j * ss); }
          bays.push(xs);
        }
        const nLn = stp ? bays.reduce((a, l) => a + l.length, 0) : 0;
        // the corner frames, gaps taken largest first and smallest first: the result with no girder panel over s (or the smallest excess), then the fewer frames
        const score = bb => { let mx = 0, n = 0; gi.forEach(i => { const br = [A[i], ...(bb[i - 1] || []), ...(bb[i] || []), B[i]].sort((u, v) => u - v); for (let j = 1; j < br.length; j++) mx = Math.max(mx, LIM ? br[j] - br[j - 1] - LIM(br[j - 1], br[j]) : br[j] - br[j - 1]); }); bb.forEach(l => n += l.length); return [LIM ? (mx > 1e-6 ? mx : 0) : (mx > sp + 1e-6 ? mx : 0), n]; };   // FSP: the largest excess over the panel limit
        let pick = null; for (const mode of [1, -1]) { if (pick && !pick.sc[0]) break; const bb = bays.map(l => l.slice()); fill(bb, skS ? eFl : clr, skE ? eFl : clr, mode); const sc = score(bb);
          if (!pick || sc[0] < pick.sc[0] - 1e-9 || (Math.abs(sc[0] - pick.sc[0]) < 1e-9 && sc[1] < pick.sc[1])) pick = { bb, sc }; }
        bays.splice(0, bays.length, ...pick.bb); const mxG = pick.sc[0] || (() => { let mx = 0; gi.forEach(i => { const br = [A[i], ...(bays[i - 1] || []), ...(bays[i] || []), B[i]].sort((u, v) => u - v); for (let j = 1; j < br.length; j++) mx = Math.max(mx, br[j] - br[j - 1]); }); return mx; })();
        const fr = []; bays.forEach((xs, b) => [...new Set(xs.map(x => +x.toFixed(3)))].sort((u, v) => u - v).forEach(x => fr.push({ type: 'int', k, bay: b, xa: x, xc: x })));
        const st = stp ? { ln: [...ln].sort((u, v) => u - v), nLn, ncf: fr.length - nLn } : null;   // RIDOT stepped: the lines, the frames on them and the corner frames added
        return { fr, s: ss, e0: x0 - Amax, e1: Bmin - x1, mx: mxG, ex: LIM ? pick.sc[0] : Math.max(0, mxG - sp), ...(G ? { Z0: G.Z0, Z1: G.Z1, one: G.one } : {}), ...(st ? { st } : {}) };
      };
      // corner frames: while a girder panel in this span exceeds s, add a frame in an adjacent bay (rules above); a gap that cannot be closed is left (X2)
      const cfM = new Map(), cfAt = (b, x) => { const kk = b + '|' + x.toFixed(3); if (!cfM.has(kk)) cfM.set(kk, conflicts([{ xa: x, xc: x, bay: b }]) ? 1 : 0); return cfM.get(kk); };
      function fill(bays, fS, fE, mode) {
        const tried = new Set(), lexLt = (u, v) => { for (let j = 0; j < u.length; j++) if (Math.abs(u[j] - v[j]) > 1e-9) return u[j] < v[j]; return false; };
        for (let it = 0; it < 400; it++) {
          let w = null;
          for (const i of gi) { const br = [A[i], ...(bays[i - 1] || []), ...(bays[i] || []), B[i]].sort((u, v) => u - v);
            for (let j = 1; j < br.length; j++) { const g = br[j] - br[j - 1], key = i + '|' + br[j - 1].toFixed(3), lim = limP(br[j - 1], br[j]); if (g > lim + 1e-6 && !tried.has(key) && (!w || mode * (g - w.g) > 1e-9)) w = { i, g0: br[j - 1], g1: br[j], g, key, lim }; } }
          if (!w) return;
          let best = null;
          for (const b of [w.i - 1, w.i]) { if (b < 0 || b > nb - 2) continue;
            const lo = Math.max(A[b], A[b + 1]) + fS, hi = Math.min(B[b], B[b + 1]) - fE, gs = [b, b + 1];
            const near = gs.flatMap(g => [...(g > 0 && g - 1 !== b ? bays[g - 1] : []), ...(g < nb - 1 && g !== b ? bays[g] : [])]);   // frames on the other side of these two girders
            const cand = new Set([(w.g0 + w.g1) / 2, w.g1 - w.lim, w.g0 + w.lim, lo, hi, ...near.flatMap(y => [y, y - dmin, y + dmin])]);
            for (let x = Math.max(lo, w.g0) + 0.5; x < Math.min(hi, w.g1); x += 0.5) cand.add(x);   // and every 0.5 ft (positions clear of splices and transitions)
            for (const x of cand) {
              if (x < lo - 1e-6 || x > hi + 1e-6 || x <= w.g0 + 1e-6 || x >= w.g1 - 1e-6) continue;
              let ok = bays[b].every(y => Math.abs(x - y) >= dmin - 1e-6), snap = false;
              if (ok) for (const y of near) { const d = Math.abs(x - y); if (d < 0.01) snap = true; else if (d < dmin - 1e-6) { ok = false; break; } }
              if (!ok) continue;
              const mx = Math.max(x - w.g0, w.g1 - x), k0 = LIM ? (x - w.g0 > LIM(w.g0, x) + 1e-6 || w.g1 - x > LIM(x, w.g1) + 1e-6 ? 1 : 0) : mx > sp + 1e-6 ? 1 : 0; if (best && k0 > best.key[0]) continue;
              const cf = cfAt(b, x); if (best && k0 === best.key[0] && cf > best.key[1]) continue;
              // the panels next to x on both girders: one shorter than 0.4 times its neighbour is avoided where another position closes the gap (C6.7.4.2.1)
              const sh = gs.some(g => { let p0 = A[g], p1 = B[g]; for (const l of [bays[g - 1], bays[g]]) if (l) for (const y of l) { if (y < x - 1e-6 && y > p0) p0 = y; if (y > x + 1e-6 && y < p1) p1 = y; }
                const l = x - p0, r = p1 - x; return Math.min(l, r) < 0.4 * Math.max(l, r) - 1e-6; });
              const key = [k0, cf, sh ? 1 : 0, snap ? 0 : 1, mx];
              if (!best || lexLt(key, best.key)) best = { b, x, key };
            }
          }
          if (!best) { tried.add(w.key); continue; }
          bays[best.b].push(best.x); bays[best.b].sort((u, v) => u - v);
        }
      }
      const n0 = gen(X0, X1, q), c0 = conflicts(n0.fr), info = { e0: skS ? e : null, e1: skE ? e : null, flat, skS, skE };
      const res = (r, base) => ({ fr: r.g.fr, c: r.c, n: r.g.fr.length, base, s: r.g.s, shift: r.sh, q: r.qq, info: { ...info, e0: skS ? r.g.e0 : null, e1: skE ? r.g.e1 : null, ...(r.g.st ? { stp: { ...r.g.st, Lc, hS, hE } } : {}) },
        ...(pz ? { pz: { sp2, pS: pz.pS, pE: pz.pE, rS: pz.rS, rE: pz.rE, Z0: r.g.Z0, Z1: r.g.Z1, one: r.g.one, tm: r.g.s } } : {}) });
      const ex0 = n0.ex;
      if ((!c0 && ex0 < 1e-6) || !(X1 > X0 - 1e-9)) return res({ g: n0, c: c0, sh: 0, qq: q }, n0.fr.length);
      // conflicts, or a corner panel the corner frames could not bring within s: shift the first and last full lines (end offsets; a skewed end keeps
      // e >= max(clear, 4b_f, 0.4s)), with the same or up to two more grid intervals. Kept: the least excess over s (none if possible); of those, a layout clear
      // of every conflict with the fewest frames and the smallest shift (extra frames only this way); if none is clear, the unshifted grid
      const D = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4], DN = [0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2, 2.5, -2.5, 3, -3, 3.5, -3.5, 4, -4], all = [{ g: n0, c: c0, sh: 0, qq: q, ex: ex0 }];
      const pairs = [[0, 0], ...(skS ? D : DN).map(d => [d, 0]), ...(skE ? D : DN).map(d => [0, d]), ...D.map(d => [d, d]), ...(!skS && !skE ? D.map(d => [-d, d]) : [])];   // one end, the other, both inward (both outward), or a translation between unskewed ends
      let done = false;
      for (const qq of [q, q + 1, q + 2]) {
        for (const [d0, d1] of pairs) { if (done) break; if (qq === q && !d0 && !d1) continue;
          const a = X0 + d0, z = X1 - d1, ss = qq > 0 ? (z - a) / qq : s;
          if (pz) { const G = pzGrid(pz, rc0, rc1, a, z, qq, dA, dZ), n = G.L.length, f0 = n ? G.L[0] - Amax : 0, f1 = n ? Bmin - G.L[n - 1] : 0, lS = pz.pS ? sp2 : sp, lE = pz.pE ? sp2 : sp;   // FSP: end panels within their limits
            if (!(z >= a - 1e-9) || !n || (!skS && (f0 > lS + 1e-9 || f0 < clr)) || (!skE && (f1 > lE + 1e-9 || f1 < clr)) || (skS && f0 < eOf(G.t0) - 1e-6) || (skE && f1 < eOf(G.t1) - 1e-6)) continue; }
          else if (!(z >= a - 1e-9) || ss > sp + 1e-9 || (!skS && (a - Amax > sp + 1e-9 || a - Amax < clr)) || (!skE && (Bmin - z > sp + 1e-9 || Bmin - z < clr)) || (skS && a - Amax < eOf(ss) - 1e-6) || (skE && Bmin - z < eOf(ss) - 1e-6)) continue;
          const g = gen(a, z, qq), r = { g, c: conflicts(g.fr), sh: Math.abs(d0) + Math.abs(d1), qq, ex: g.ex }; all.push(r);
          if (!r.c && r.ex < 1e-6 && g.fr.length <= n0.fr.length) done = true;   // pairs are in order of increasing shift: the first clean one with no more frames is kept
        }
        const exM = Math.min(...all.map(r => r.ex)); if (exM < 1e-6 && all.some(r => r.ex < 1e-6 && !r.c && r.g.fr.length <= n0.fr.length)) break;
      }
      const exM = Math.min(...all.map(r => r.ex)), pool = all.filter(r => r.ex < exM + 1e-6), nB = Math.min(...pool.map(r => r.g.fr.length));
      const zero = pool.filter(r => !r.c).sort((u, v) => u.g.fr.length - v.g.fr.length || u.sh - v.sh)[0];   // clear of every conflict: the fewest frames, then the smallest shift
      if (zero) return res(zero, nB);
      // no shift or extra frame clears every conflict: the unshifted grid is kept (the conflicts are reported, X4 and the Framing tab)
      return res(pool.includes(all[0]) ? all[0] : pool.filter(r => r.g.fr.length <= nB).sort((u, v) => u.sh - v.sh || u.c - v.c)[0], nB);
    }
    // per-girder own stations (from Abut. 1 bearing of that girder)
    const girders = ys.map((y, i) => {
      const x0 = xb(0, i), bear = m.sup.map((_, k) => xb(k, i) - x0);
      const pts = frames.filter(f => f.bay === i - 1 || f.bay === i).map(f => ({ s: (f.bay === i ? f.xa : f.xc) - x0, f, side: f.bay === i ? 'R' : 'L' }));
      return { i, y, x0, bear, pts };
    });
    return { frames, girders, orient, xb, ys, yc, sp, own: ox };
  }
  /* OWN1 (2026-10-15): the owner's cross-frame orientation rule for the bridge (xf.orient): on, the largest support skew θ_max (absolute, every support),
     the threshold, and the orientation and arrangement it requires for every span; off (AASHTO, MassDOT, or no rules table): per span as AASHTO 6.7.4.2.1 */
  function plOwnXf(P, m) {
    const own = plOwner(P), thB = Math.max(0, ...m.skews.map(v => Math.abs(+v) || 0)), r = ownRule(own, 'xf.orient');
    if (!r) return { own, thB, on: false };
    const thr = +(r.value && r.value.thr) || 20, gt = thB > thr + 1e-9;   // arr: the rule's arrangement above the threshold (RIDOT 'stepped', 2026-10-19), else 'staggered'
    return { own, thB, on: true, r, thr, o: gt ? 'normal' : 'parallel', arr: gt ? ((r.value && r.value.arr) || 'staggered') : null };
  }


  /* plXfDef(FR): the cross-frames of the layout for GirderDetail's DC1 point loads (XF1): per girder its bearing stations (ft, from its
     Abut. 1 bearing); per frame [on a bearing line 1/0, span or support index k, bay (girders bay and bay + 1), station on girder bay,
     station on girder bay + 1, length between the girder webs along the frame line (ft)]. Copied from Preliminary sizing (anchor `function plXfDef(FR) {`). */
  function plXfDef(FR) { const r = v => Math.round(v * 1000) / 1000;
    return { v: 1, g: FR.girders.map(g => g.bear.map(r)), f: FR.frames.map(f => [f.type === 'sup' ? 1 : 0, f.k, f.bay, r(f.xa - FR.girders[f.bay].x0), r(f.xc - FR.girders[f.bay + 1].x0), r(Math.hypot(f.xc - f.xa, FR.ys[f.bay + 1] - FR.ys[f.bay]))]) }; }

  /* ================= per-girder brace points (Preliminary sizing's Girder section rows, anchors `const brOf = {}, braceG`, `const toG =`, `const toX =`) ================= */
  /* braceG(FR, gi): girder gi's brace points, its own stations (ft from its Abut. 1 bearing): its bearings and every cross-frame on it, rounded to
     0.001 ft, points closer than 0.25 ft merged */
  const braceG = (FR, gi) => [...new Set([...FR.girders[gi].bear, ...FR.girders[gi].pts.map(q => q.s)].map(v => +v.toFixed(3)))].sort((p1, p2) => p1 - p2).filter((v, k, arr) => k === 0 || v - arr[k - 1] > 0.25);
  const spanX = (sup, x) => { let k = 0; while (k < sup.length - 2 && x > sup[k + 1] + 1e-9) k++; return k; };
  /* toG(FR, gi, sup, x): analysis station x (ft) → girder gi's own station, proportionally within the span (exact where the girder's span equals
     the analysis span); toX: the reverse */
  const toG = (FR, gi, sup, x) => { const B = FR.girders[gi].bear, k = spanX(sup, x); return B[k] + (x - sup[k]) / (sup[k + 1] - sup[k]) * (B[k + 1] - B[k]); };
  const toX = (FR, gi, sup, sg) => { const B = FR.girders[gi].bear; let k = 0; while (k < B.length - 2 && sg > B[k + 1] + 1e-9) k++; return sup[k] + (sg - B[k]) / (B[k + 1] - B[k]) * (sup[k + 1] - sup[k]); };
  /* lbMax(FR, gs, sup, a, b): the largest unbraced length (girder's own length) on girders gs within analysis stations a..b (null: no limit) */
  const lbMax = (FR, gs, sup, a, b) => Math.max(0, ...gs.map(gi => { const bp = braceG(FR, gi), s0 = a == null ? -Infinity : toG(FR, gi, sup, a + 1e-6), s1 = b == null ? Infinity : toG(FR, gi, sup, b - 1e-6); let mx = 0;
    for (let k = 1; k < bp.length; k++) if (bp[k] > s0 + 1e-6 && bp[k - 1] < s1 - 1e-6) mx = Math.max(mx, bp[k] - bp[k - 1]); return mx; }));

  /* ================= the project model (new) ================= */
  /* DEF: framing settings of a new project: Preliminary sizing's built-in framing (P.framing) and limits (spliceClear, tol; flSkI, flSkE, flSkG: the
     skew f_ℓ below), no field splices */
  const DEF = { spacing: 25, spPier: '', pierLen: '', orient: 'auto', arrange: 'contiguous', supClear: 3, stagMin: 4, spliceClear: 2, tol: 0.5, splices: [], flSkI: 10, flSkE: 7.5, flSkG: 1.25 };
  const isNum = v => typeof v === 'number' && isFinite(v);
  const numList = v => (Array.isArray(v) ? v : String(v == null ? '' : v).split(/[,;\s]+/)).map(Number).filter(x => isFinite(x)).sort((a, b) => a - b);
  /* settings(P): project.framing with the defaults filled in (null when the project has no framing block) */
  function settings(P) { if (!P || !P.framing || typeof P.framing !== 'object') return null; const o = {}; for (const k in DEF) o[k] = P.framing[k] !== undefined && P.framing[k] !== null ? P.framing[k] : DEF[k]; o.splices = numList(o.splices); return o; }
  /* lineOf(P, g): the cross-section girder (0-based) of plate girder g (engine/analysis.js lineOf; repeated so this file stands alone) */
  function lineOf(P, g) { const nb = Math.round(((P.xs || {}).nb) || 0); if (g && isNum(g.line) && g.line >= 0 && g.line < nb) return Math.round(g.line); return (g && g.position === 'exterior') || nb < 3 ? 0 : 1; }
  /* modelOf(P): the inputs of layout() from an sbd2 project: spans, supports, continuity; xs.nb, xs.bays, xs.skews; framing settings; the
     field splices (framing.splices, ft) and every girder's plate changes (flange transitions and web thickness changes, as Preliminary sizing's
     buildModel: a transition within limits.tol of a splice is at the splice). Returns { errors, Pf, m }. */
  function modelOf(P) {
    const F = settings(P), errors = []; if (!F) return { errors: ['The project has no framing (Framing tab).'] };
    const spans = (P.spans.lengths || []).map(Number), sup = [0]; spans.forEach(L => sup.push(sup[sup.length - 1] + L));
    const xs = P.xs || (window.SBDModel ? window.SBDModel.defaultXs(P) : {}), nb = Math.round(+xs.nb), bays = (xs.bays || []).map(Number), skews = (xs.skews || []).map(Number);
    if (!(nb >= 2)) errors.push('Framing needs at least two girders in the cross-section.');
    if (bays.length !== nb - 1 || !bays.every(v => v > 0)) errors.push('Girder spacings: one positive spacing per bay.');
    if (skews.length !== spans.length + 1 || !skews.every(v => isFinite(v) && Math.abs(v) < 90)) errors.push('Skews: one value per support line, between −90° and 90°.');
    if (!(+F.spacing > 0)) errors.push('Cross-frame spacing must be positive.');
    ['supClear', 'stagMin', 'spliceClear'].forEach(k => { if (!(+F[k] >= 0)) errors.push(`Framing "${k}" must be zero or positive.`); });
    if (errors.length) return { errors };
    const Lt = sup[sup.length - 1], splices = F.splices.filter(x => x > 0 && x < Lt), near = x => Math.min(Infinity, ...splices.map(s => Math.abs(s - x)));
    const top = [], bot = [], trans = [], webTrans = [], seen = new Set();
    (P.girders || []).forEach(G => { const S = G.segments || [];
      S.forEach(s => { top.push({ x0: s.x0, x1: s.x1, b: s.topB, t: s.topT }); bot.push({ x0: s.x0, x1: s.x1, b: s.botB, t: s.botT }); });
      for (let k = 1; k < S.length; k++) { const a = S[k - 1], c = S[k], x = a.x1;
        if (a.topB !== c.topB || a.topT !== c.topT) { const key = 'T' + x; if (!seen.has(key)) { seen.add(key); trans.push({ fl: 'Top', x, atSplice: near(x) <= +F.tol }); } }
        if (a.botB !== c.botB || a.botT !== c.botT) { const key = 'B' + x; if (!seen.has(key)) { seen.add(key); trans.push({ fl: 'Bottom', x, atSplice: near(x) <= +F.tol }); } }
        if (a.tw !== c.tw) { const key = 'W' + x; if (!seen.has(key)) { seen.add(key); webTrans.push({ x: c.x0, atSplice: near(c.x0) <= +F.tol }); } } } });
    const m = { nb, S: Math.max(...bays), bays, skews, sup, spans, cont: P.spans.continuity === 'continuous' && spans.length > 1, splices, trans, webTrans, top, bot, Ltot: Lt };
    const Pf = { framing: { spacing: +F.spacing, spPier: F.spPier, pierLen: F.pierLen, orient: F.orient, arrange: F.arrange, supClear: +F.supClear, stagMin: +F.stagMin }, limits: { spliceClear: +F.spliceClear, dot: (P.ownerRules || {}).owner || 'AASHTO' } };
    return { errors: [], Pf, m, F };
  }

  /* compute(P): the layout of the project with its worked steps. Returns { errors } or { FR, m, Pf, F, xf (plXfDef), girders: [{ i, braces (own
     stations), lb (largest unbraced length, ft), nInt }], steps }. */
  function compute(P) {
    const M = modelOf(P); if (M.errors.length) return { errors: M.errors };
    const FR = layout(M.Pf, M.m), m = M.m, w = St().work('fr'), F = M.Pf.framing;
    w.add({ id: 's', label: 'Target cross-frame spacing', sym: 's', eq: '', sub: '', value: F.spacing, unit: 'ft', d: 2, ref: `${ED} Art. 6.7.4.2.1`, note: 'Intermediate cross-frames at most s apart along every girder (corner frames close a longer panel in the acute corners).' });
    const sp2 = plPierSp(F, m); if (sp2) w.add({ id: 'sp', label: 'Spacing near interior supports (pier regions)', sym: 's_{p}', eq: '', sub: '', value: sp2, unit: 'ft', d: 2, ref: `${ED} C6.7.4.2.1`, note: `Each side of an interior support over ${+F.pierLen > 0 ? n2(+F.pierLen) + ' ft' : '0.25 of the adjacent span'}.` });
    if (FR.own && FR.own.on) w.add({ id: 'own', label: `Owner rule, cross-frame orientation (${window.SBDOwners.cite(FR.own.r)})`, sym: '\\theta_{max}', eq: `${FR.own.thB > FR.own.thr ? '\\gt' : '\\le'} ${FR.own.thr}°`, sub: `${n2(FR.own.thB)}°`, value: `${FR.own.o}${FR.own.arr ? ', ' + FR.own.arr : ''}`, unit: '', d: 0, ref: window.SBDOwners.cite(FR.own.r), note: 'Applies to every span when the orientation is Automatic.' });
    FR.orient.forEach(o => { const id = `k${o.k}`;
      w.add({ id: id + '.th', label: `Span ${o.k + 1}: the larger skew of its two supports`, sym: '\\theta', eq: '\\max(|\\theta_{k}|, |\\theta_{k+1}|)', sub: `\\max(${n2(Math.abs(m.skews[o.k]))}, ${n2(Math.abs(m.skews[o.k + 1]))})`, value: o.th, unit: '°', d: 2, ref: `${ED} Art. 6.7.4.2.1` });
      w.add({ id: id + '.o', label: `Span ${o.k + 1}: orientation of the intermediate cross-frames`, sym: '', eq: F.orient !== 'auto' ? '\\text{as entered}' : FR.own && FR.own.on ? '\\text{owner rule}' : o.th <= 20 + 1e-9 ? '\\theta \\le 20°: \\text{parallel to the skew}' : '\\theta \\gt 20°: \\text{normal to the girders}', sub: '', value: o.o === 'normal' ? `normal to the girders, ${o.flat ? 'contiguous (staggered offset s/2 < d_min)' : o.arr}` : 'parallel to the skew', unit: '', d: 0, ref: `${ED} Art. 6.7.4.2.1` });
      if (o.o === 'normal') { w.add({ id: id + '.bf', label: `Span ${o.k + 1}: widest flange plate in the span`, sym: 'b_{f}', eq: '', sub: '', value: o.bf * 12, unit: 'in', d: 2, ref: `${ED} C6.7.4.2.1`, note: 'b_f in ft in d_min and e below.' });
        w.add({ id: id + '.dmin', label: `Span ${o.k + 1}: least offset between frames on one girder (staggered and corner frames)`, sym: 'd_{min}', eq: '\\max(d_{stag}, 4b_{f})', sub: `\\max(${n2(+F.stagMin || 0)}, 4(${n3(o.bf)}))`, value: o.dmin, unit: 'ft', d: 2, ref: `${ED} C6.7.4.2.1` });
        [['e0', o.e0, o.k], ['e1', o.e1, o.k + 1]].forEach(([k, e, ks]) => { if (e != null) w.add({ id: `${id}.${k}`, label: `Span ${o.k + 1}: first full line from the obtuse bearing at support ${ks + 1} (skewed more than 20°)`, sym: 'e', eq: '\\ge \\max(c_{brg}, 4b_{f}, 0.4s)', sub: `\\max(${n2(F.supClear)}, ${n2(4 * o.bf)}, 0.4(${n2(o.s)}))`, value: e, unit: 'ft', d: 2, ref: `${ED} C6.7.4.2.1` }); }); }
      w.add({ id: id + '.s', label: `Span ${o.k + 1}: spacing used (${o.o === 'parallel' ? 'longest girder span / (n + 1)' : 'grid spacing'})`, sym: 's_{used}', eq: o.o === 'parallel' ? '\\frac{L_{max}}{n + 1}' : '', sub: o.o === 'parallel' ? `\\frac{${n2(o.Lmax)}}{${o.n} + 1}` : '', value: o.s, unit: 'ft', d: 3, ref: `${ED} Art. 6.7.4.2.1`, note: `${o.n} intermediate ${o.o === 'parallel' ? 'frames per bay' : 'frames in the span (all bays)'}${o.conflicts ? `; ${o.conflicts} frame(s) within the splice clearance (no shift clears them)` : ''}.` });
    });
    const girders = FR.girders.map((g, i) => { const bp = braceG(FR, i); let mx = 0; for (let k = 1; k < bp.length; k++) mx = Math.max(mx, bp[k] - bp[k - 1]);
      w.add({ id: `g${i}.lb`, label: `G${i + 1}: largest unbraced length (bearings and cross-frames, its own stations)`, sym: 'L_{b,max}', eq: '\\max(s_{j+1} - s_{j})', sub: '', value: mx, unit: 'ft', d: 2, ref: `${ED} Art. 6.10.8.2.3` });
      return { i, braces: bp, lb: mx, nInt: g.pts.filter(q => q.f.type === 'int').length }; });
    return { errors: [], FR, m, Pf: M.Pf, F: M.F, xf: plXfDef(FR), girders, steps: w.steps };
  }
  /* girderBraces(P, gi, L): plate girder gi's brace points as analysis stations (ft): its cross-section girder's bearings and cross-frames
     (toX). L (optional): compute(P), reused. Returns null without framing. { line, braces, ints (intermediate cross-frames), own, lenOf(a, b):
     the girder's own length between analysis stations a and b }. */
  function girderBraces(P, gi, L) {
    const R = L || compute(P); if (!R || R.errors.length) return null;
    const line = Math.min(lineOf(P, (P.girders || [])[gi]), R.FR.girders.length - 1), sup = R.m.sup, FR = R.FR, own = braceG(FR, line);
    const ints = [...new Set(FR.girders[line].pts.filter(q => q.f.type === 'int').map(q => +q.s.toFixed(3)))].sort((a, b) => a - b);
    return { line, own, braces: own.map(s => toX(FR, line, sup, s)), ints: ints.map(s => +toX(FR, line, sup, s).toFixed(3)),
      lenOf: (a, b) => toG(FR, line, sup, b) - toG(FR, line, sup, a) };
  }

  /* forGirder(P, sel, sup): the brace points of one girder for demands whose supports are sup (ft): sel = { gi } (plate girder of P) or
     { line } (cross-section girder, 0-based: a hand-off file's girder). null when P has no framing, the layout has errors, or the supports
     differ from the project's (another bridge: the caller keeps its own brace points). */
  function forGirder(P, sel, sup) {
    const L = compute(P); if (!L || L.errors.length) return null;
    const ps = L.m.sup; if (sup && (sup.length !== ps.length || sup.some((v, k) => Math.abs(v - ps[k]) > 0.01))) return null;
    if (sel && sel.line != null) { if (!(sel.line >= 0 && sel.line < L.FR.girders.length)) return null; const Q = { ...P, girders: [{ ...(P.girders[0] || {}), line: sel.line }] }; return girderBraces(Q, 0, L); }
    return girderBraces(P, (sel && sel.gi) || 0, L);
  }
  /* flSkew(skews, ext, F): flange lateral bending from skew in lieu of a refined analysis (AASHTO LRFD C6.10.1), as Preliminary sizing sends it
     to GirderDetail's Girder section rows (anchor `flange lateral bending from skew in lieu of a refined analysis`): where any support is skewed
     more than 20°, f_ℓ = γ(10 ksi interior, 7.5 ksi exterior girders), γ = 1.25 (settings flSkI, flSkE, flSkG), rounded to 0.01 ksi; else 0.
     GirderDetail uses the same value for Strength I and Service II (SB2-O11). Returns { fl, skMax, steps }. */
  function flSkew(skews, ext, F) {
    F = F || DEF; const num = v => (v === '' || v == null ? NaN : +v), skM = Math.max(...(skews || [0]).map(v => Math.abs(v))), gI = num(F.flSkI) || 10, gE = num(F.flSkE) || 7.5, gG = num(F.flSkG) || 1.25;
    const f0 = ext ? gE : gI, fl = skM > 20 + 1e-9 ? +(gG * f0).toFixed(2) : 0, w = St().work('flsk');
    w.add({ id: 'fl', label: `Flange lateral bending from skew, ${ext ? 'exterior' : 'interior'} girder (largest support skew ${n2(skM)}° ${skM > 20 + 1e-9 ? '> 20°' : '≤ 20°: none'})`, sym: 'f_{\ell}', eq: skM > 20 + 1e-9 ? '\gamma f_{\ell,skew}' : '0', sub: skM > 20 + 1e-9 ? `${n2(gG)}(${n2(f0)})` : '', value: fl, unit: 'ksi', d: 2, ref: `${ED} C6.10.1`,
      note: 'In lieu of a refined analysis: 10 ksi interior, 7.5 ksi exterior girders (unfactored), times the load factor; the same value is used at Service II (GirderDetail; SB2-O11).' });
    return { fl, skMax: skM, steps: w.steps };
  }

  window.SBDFraming = { DEF, settings, modelOf, layout, compute, girderBraces, forGirder, flSkew, lineOf, plPierSp, plPierLen, plOwnXf, plXfDef, braceG, toG, toX, lbMax };
})();
