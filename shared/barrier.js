/* shared/barrier.js — a concrete barrier's cross-section from its geometry: area, weight per foot, width at the deck, centroid
   (window.SharedBarrier). Classic script, no DOM, no state. Created 2026-11-24 (BARG; engineer 2026-11-24: "RIDOT has a barrier that
   is a rectangle shape, not an F-shape barrier. Can I enter the barrier geometry … and let the app calculate the weight directly?").
   Tested in Node (tests/engine/barrier.test.mjs). Loaded by apps/steel-bridge/index.html (engine/loads.js, ui/loads.js).

   No owner (DOT) standard barrier dimensions are kept here: every shape is parametric, with the dimensions the engineer enters.

   Coordinates (in): x from the deck edge (positive toward the roadway), y up from the top of the deck. The barrier sits on the deck:
   every point has x ≥ 0 and y ≥ 0, and at least one edge of the outline lies on the deck (y = 0).

   Shapes:
     'rect'  Rectangle (vertical wall): base width b, height h; outline (0,0) (b,0) (b,h) (0,h).
     'slope' Sloped traffic face, vertical back (single-slope / trapezoid): base width b on the deck, top width b_t, height h;
             outline (0,0) (b,0) (b_t,h) (0,h); b_t ≤ b not required.
     'poly'  Custom polygon: the points [[x, y], …] in order around the outline (either direction), at least 3, not self-intersecting.
             A last point equal to the first is dropped (closed outline entered).
   Every shape is evaluated through the same polygon (shoelace) arithmetic; the worked steps of 'rect' and 'slope' show their closed forms
   (the tests check closed form = shoelace).

   Shoelace (the polygon's signed area and centroid; points i = 1…n, point n+1 = point 1):
     c_i = x_i y_{i+1} − x_{i+1} y_i,   A_s = ½ Σ c_i,   A = |A_s|,
     x̄ = Σ (x_i + x_{i+1}) c_i / (6 A_s),   ȳ = Σ (y_i + y_{i+1}) c_i / (6 A_s).
   Weight:  w = A / 144 × γ   (A in², γ kcf, w klf: one foot of barrier weighs A/144 ft² × 1 ft × γ).
   γ default 0.150 kcf: AASHTO LRFD 10th Ed. Table 3.5.1-1, normal-weight concrete with f′c ≤ 5.0 ksi, 0.145 kcf (plain), plus the
   0.005 kcf that Commentary C3.5.1 says reinforced concrete is generally taken as heavier than plain. Editable.
   Width at the deck b_deck: from the deck edge to the inner toe, the largest x of the outline's edges on the deck (y = 0) (ft);
   the "barrier width at deck" of the apps (their deck edge to the barrier's traffic face at the deck).
   Height h: the largest y (in).

   API (window.SharedBarrier):
     GAMMA                      0.150 (kcf), the default unit weight
     SHAPES                     [['rect', 'Rectangle'], ['slope', 'Sloped face, vertical back'], ['poly', 'Custom (polygon)']]
     spec(e)                    the input from an app's saved edge object { bShape, bDims: { b, h, bt }, bPts, bGam } (keys of both apps)
     outline(spec)              the polygon [[x, y], …] (in) of a spec, or null if its dimensions are not numbers
     compute(spec)              { ok, errors: [{ key, msg }], shape, pts, A, As, w, gam, bIn, bDeck, x0In, xcIn, xc, ycIn, h, terms }
                                errors: key 'b' | 'bt' | 'h' | 'pts' | 'gam'; msg a phrase "the barrier … must …" (the app prefixes the side)
     steps(G, o)                the worked steps (shared/steps.js, read at call time): o = { prefix, base, wId, ref }; ids
                                `${prefix}.${base}.(A|S|h|b|xc)` and the weight `${prefix}.${o.wId || base + '.w'}`
     parsePts(text)             "x,y; x,y; …" (or one point per line) -> [[x, y], …] (NaN where a value is not a number)
     ptsText(pts)               the reverse, for an input field
     svg(G, o)                  a small cross-section sketch (an SVG string, display only): the outline, the deck line, b_deck, h, x̄
   Units: in (dimensions, points, A in²), kcf (γ), klf (w), ft (bDeck, xc). */
(function () {
  'use strict';
  const GAMMA = 0.150;
  const SHAPES = [['rect', 'Rectangle'], ['slope', 'Sloped face, vertical back'], ['poly', 'Custom (polygon)']];
  const REF_W = 'AASHTO LRFD 10th Ed. Art. 3.5.1, Table 3.5.1-1';
  const LBL = { b: 'the barrier base width', bt: 'the barrier top width', h: 'the barrier height', pts: 'the barrier points', gam: 'the barrier unit weight' };
  const isN = v => typeof v === 'number' && isFinite(v);
  const num = v => (v == null || v === '') ? NaN : Number(v);

  function spec(e) {
    const q = e || {}, d = q.bDims || {};
    return { shape: q.bShape === 'slope' || q.bShape === 'poly' ? q.bShape : 'rect', b: num(d.b), h: num(d.h), bt: num(d.bt),
      pts: Array.isArray(q.bPts) ? q.bPts.map(p => Array.isArray(p) ? [num(p[0]), num(p[1])] : [NaN, NaN]) : [],
      gam: q.bGam == null || q.bGam === '' ? GAMMA : num(q.bGam) };
  }
  function outline(s) {
    if (s.shape === 'rect') return isN(s.b) && isN(s.h) ? [[0, 0], [s.b, 0], [s.b, s.h], [0, s.h]] : null;
    if (s.shape === 'slope') return isN(s.b) && isN(s.h) && isN(s.bt) ? [[0, 0], [s.b, 0], [s.bt, s.h], [0, s.h]] : null;
    const p = (s.pts || []).map(q => [q[0], q[1]]);
    if (p.length > 3 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
    return p;
  }
  /* segments (a,b) and (c,d) share a point (touching counts) */
  const orient = (a, b, c) => { const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); return Math.abs(v) < 1e-12 ? 0 : v > 0 ? 1 : -1; };
  const onSeg = (a, b, c) => Math.min(a[0], b[0]) - 1e-12 <= c[0] && c[0] <= Math.max(a[0], b[0]) + 1e-12 && Math.min(a[1], b[1]) - 1e-12 <= c[1] && c[1] <= Math.max(a[1], b[1]) + 1e-12;
  function cross(a, b, c, d) {
    const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
    if (o1 !== o2 && o3 !== o4) return true;
    return (o1 === 0 && onSeg(a, b, c)) || (o2 === 0 && onSeg(a, b, d)) || (o3 === 0 && onSeg(c, d, a)) || (o4 === 0 && onSeg(c, d, b));
  }
  /* simple(p): '' or why the outline is not a simple polygon */
  function simple(p) {
    const n = p.length;
    for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; if (a[0] === b[0] && a[1] === b[1]) return `point ${i + 1} repeats point ${(i + 1) % n + 1}`; }
    for (let i = 0; i < n; i++) {
      const a = p[i], b = p[(i + 1) % n], c = p[(i + 2) % n];   // adjacent edges: they must not fold back on each other
      if (orient(a, b, c) === 0 && ((b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])) < 0) return `the edges at point ${(i + 1) % n + 1} fold back on each other`;
      for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue;
        if (cross(a, b, p[j], p[(j + 1) % n])) return `edge ${i + 1}–${(i + 1) % n + 1} crosses or touches edge ${j + 1}–${(j + 1) % n + 1}`; }
    }
    return '';
  }

  function compute(s0) {
    const s = s0 || spec({}), errors = [], E = (key, why) => errors.push({ key, msg: `${LBL[key]} ${why}` });
    const shape = s.shape === 'slope' || s.shape === 'poly' ? s.shape : 'rect';
    if (shape !== 'poly') {
      if (!(isN(s.b) && s.b > 0)) E('b', 'must be positive (in)');
      if (shape === 'slope' && !(isN(s.bt) && s.bt > 0)) E('bt', 'must be positive (in)');
      if (!(isN(s.h) && s.h > 0)) E('h', 'must be positive (in)');
    }
    if (!(isN(s.gam) && s.gam > 0)) E('gam', 'must be positive (kcf)');
    const p = outline({ ...s, shape });
    if (shape === 'poly') {
      if (!p || p.length < 3) E('pts', 'must be at least 3 points (x, y in inches)');
      else if (!p.every(q => isN(q[0]) && isN(q[1]))) E('pts', 'must be numbers, each point x, y in inches');
      else if (!p.every(q => q[0] >= 0 && q[1] >= 0)) E('pts', 'must have x ≥ 0 (from the deck edge) and y ≥ 0 (up from the top of the deck)');
      else { const why = simple(p); if (why) E('pts', `must form a simple polygon (${why})`); }
    }
    if (errors.length) return { ok: false, errors, shape };
    const n = p.length, terms = [];
    let S = 0, Sx = 0, Sy = 0;
    for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n], c = a[0] * b[1] - b[0] * a[1]; terms.push(c); S += c; Sx += (a[0] + b[0]) * c; Sy += (a[1] + b[1]) * c; }
    const As = S / 2, A = Math.abs(As);
    if (!(A > 1e-9)) { E('pts', 'must enclose an area (the points are in one line)'); return { ok: false, errors, shape }; }
    const xcIn = Sx / (6 * As), ycIn = Sy / (6 * As), h = Math.max(...p.map(q => q[1]));
    let bIn = -Infinity, x0In = Infinity;
    for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; if (Math.abs(a[1]) < 1e-9 && Math.abs(b[1]) < 1e-9 && Math.abs(a[0] - b[0]) > 1e-9) { bIn = Math.max(bIn, a[0], b[0]); x0In = Math.min(x0In, a[0], b[0]); } }
    if (!isFinite(bIn)) { E('pts', 'must have an edge on the deck (two consecutive points with y = 0)'); return { ok: false, errors, shape }; }
    const w = A / 144 * s.gam;
    return { ok: true, errors, shape, pts: p, A, As, S, Sx, terms, w, gam: s.gam, bIn, bDeck: bIn / 12, x0In, xcIn, xc: xcIn / 12, ycIn, h,
      dims: shape === 'poly' ? null : { b: s.b, h: s.h, ...(shape === 'slope' ? { bt: s.bt } : {}) } };
  }

  /* steps(G, o): the worked steps (symbolic, substituted, result) */
  function steps(G, o0) {
    const St = window.SharedSteps, o = o0 || {}; if (!St || !G || !G.ok) return [];
    const pre = o.prefix || '', base = o.base || 'bar', w = St.work(pre), n2 = x => St.n(x, 2), n3 = x => St.n(x, 3), d = G.dims;
    const id = k => `${base}.${k}`, P = G.pts, nP = P.length, nx = i => P[(i + 1) % nP];
    if (G.shape === 'rect') {
      w.add({ id: id('A'), label: 'Barrier cross-section area (rectangle b × h)', sym: 'A_{bar}', eq: 'bh', sub: `${n2(d.b)}(${n2(d.h)})`, value: G.A, unit: 'in^{2}', d: 2 });
    } else if (G.shape === 'slope') {
      w.add({ id: id('A'), label: 'Barrier cross-section area (sloped face, vertical back: a trapezoid)', sym: 'A_{bar}', eq: '\\frac{b + b_{t}}{2}h', sub: `\\frac{${n2(d.b)} + ${n2(d.bt)}}{2}(${n2(d.h)})`, value: G.A, unit: 'in^{2}', d: 2 });
    } else {
      w.add({ id: id('S'), label: `Barrier outline, shoelace sum of the ${nP} points (x from the deck edge, y up from the top of the deck, in)`, sym: '\\sum c_{i}', eq: '\\sum (x_{i}y_{i+1} - x_{i+1}y_{i})',
        sub: G.terms.map(c => (c < 0 ? `(${n2(c)})` : n2(c))).join(' + '), value: G.S, unit: 'in^{2}', d: 2,
        note: `c_i = x_i·y_i+1 − x_i+1·y_i (point ${nP} + 1 = point 1): ${P.map((q, i) => `c${i + 1} = ${n2(q[0])}·${n2(nx(i)[1])} − ${n2(nx(i)[0])}·${n2(q[1])} = ${n2(G.terms[i])}`).join('; ')}.` });
      w.add({ id: id('A'), label: 'Barrier cross-section area (shoelace)', sym: 'A_{bar}', eq: '\\frac{1}{2}|\\sum c_{i}|', sub: `\\frac{1}{2}|${n2(G.S)}|`, value: G.A, unit: 'in^{2}', d: 2 });
      w.add({ id: id('h'), label: 'Barrier height (the highest point)', sym: 'h_{bar}', eq: '\\max y_{i}', sub: '', value: G.h, unit: 'in', d: 2 });
    }
    w.add({ id: id('w'), label: o.wLabel || 'Barrier weight per foot from its cross-section', sym: o.wSym || 'w', eq: '\\frac{A_{bar}}{144}\\gamma_{bar}', sub: `\\frac{${n2(G.A)}}{144}(${n3(G.gam)})`, value: G.w, unit: 'klf', d: 4, ref: o.ref || REF_W,
      note: `γ_bar = ${n3(G.gam)} kcf${Math.abs(G.gam - GAMMA) < 1e-12 ? ' (the default: Table 3.5.1-1 normal-weight concrete, f′c ≤ 5.0 ksi, 0.145 kcf, + 0.005 kcf for the reinforcement, C3.5.1)' : ' (entered)'}.${o.wNote ? ' ' + o.wNote : ''}` });
    if (o.wId) w.steps[w.steps.length - 1].id = pre ? `${pre}.${o.wId}` : o.wId;
    w.add({ id: id('b'), label: 'Barrier width at the deck (deck edge to the inner toe on the deck)', sym: 'b_{deck}', eq: G.shape === 'poly' ? '\\frac{\\max x_{y=0}}{12}' : '\\frac{b}{12}', sub: `\\frac{${n2(G.bIn)}}{12}`, value: G.bDeck, unit: 'ft', d: 3,
      note: G.x0In > 1e-9 ? `The barrier's outer toe is ${n2(G.x0In)} in in from the deck edge.` : '' });
    if (G.shape === 'rect') w.add({ id: id('xc'), label: 'Barrier centroid from the deck edge', sym: '\\bar{x}_{bar}', eq: '\\frac{b}{2(12)}', sub: `\\frac{${n2(d.b)}}{2(12)}`, value: G.xc, unit: 'ft', d: 3 });
    else if (G.shape === 'slope') w.add({ id: id('xc'), label: 'Barrier centroid from the deck edge (trapezoid with a vertical back)', sym: '\\bar{x}_{bar}', eq: '\\frac{b^{2} + bb_{t} + b_{t}^{2}}{3(b + b_{t})(12)}', sub: `\\frac{${n2(d.b)}^{2} + ${n2(d.b)}(${n2(d.bt)}) + ${n2(d.bt)}^{2}}{3(${n2(d.b)} + ${n2(d.bt)})(12)}`, value: G.xc, unit: 'ft', d: 3 });
    else w.add({ id: id('xc'), label: 'Barrier centroid from the deck edge (shoelace)', sym: '\\bar{x}_{bar}', eq: '\\frac{\\sum (x_{i} + x_{i+1})c_{i}}{6A_{s}(12)}', sub: `\\frac{${n2(G.Sx)}}{6(${n2(G.As)})(12)}`, value: G.xc, unit: 'ft', d: 3,
      note: `A_s = ½ Σ c_i = ${n2(G.As)} in² (signed: the order of the points); Σ(x_i + x_i+1)c_i = ${P.map((q, i) => `(${n2(q[0])} + ${n2(nx(i)[0])})(${n2(G.terms[i])})`).join(' + ')} = ${n2(G.Sx)} in³.` });
    return w.steps;
  }

  function parsePts(t) {
    return String(t == null ? '' : t).split(/[;\n]+/).map(s => s.trim()).filter(Boolean).map(s => { const v = s.replace(/[()[\]]/g, ' ').split(/[,\s]+/).filter(Boolean).map(Number); return [v.length > 0 ? v[0] : NaN, v.length > 1 ? v[1] : NaN]; });
  }
  const ptsText = pts => (Array.isArray(pts) ? pts : []).map(q => `${q && q[0] != null ? q[0] : ''}, ${q && q[1] != null ? q[1] : ''}`).join('; ');

  /* svg(G, o): o = { w: px (default 200), side: 'L' | 'R' (the right deck edge drawn mirrored: the roadway to the left) } */
  function svg(G, o0) {
    const o = o0 || {}; if (!G || !G.ok) return '';
    const W = o.w || 200, H = Math.round(W * 0.95), pad = 26, padS = 52, xs = G.pts.map(q => q[0]), xmax = Math.max(...xs, G.bIn) * 1.25 + 2, ymax = G.h * 1.08 + 2;
    const k = Math.min((W - pad - padS) / xmax, (H - 2 * pad) / ymax), m = o.side === 'R', X = x => (m ? W - padS - x * k : padS + x * k), Y = y => H - pad - y * k, r = v => Math.round(v * 10) / 10;
    const poly = G.pts.map(q => `${r(X(q[0]))},${r(Y(q[1]))}`).join(' '), f2 = v => (Math.round(v * 100) / 100).toString();
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Barrier cross-section sketch" style="font:10px sans-serif">
      <line x1="${r(X(0))}" y1="${r(Y(0))}" x2="${r(X(xmax))}" y2="${r(Y(0))}" stroke="#64748b" stroke-width="2"/>
      <line x1="${r(X(0))}" y1="${r(Y(0))}" x2="${r(X(0))}" y2="${r(Y(0) + 10)}" stroke="#64748b"/>
      <polygon points="${poly}" fill="#cbd5e1" stroke="#1e3a5f" stroke-width="1.5"/>
      <line x1="${r(X(G.xcIn))}" y1="${r(Y(0) - 3)}" x2="${r(X(G.xcIn))}" y2="${r(Y(G.h) - 4)}" stroke="#dc2626" stroke-dasharray="3 2"/>
      <text x="${r(X(G.xcIn))}" y="${r(Y(G.h) - 7)}" text-anchor="middle" fill="#dc2626">x̄ ${f2(G.xcIn)} in</text>
      <text x="${r((X(0) + X(G.bIn)) / 2)}" y="${r(Y(0) + 12)}" text-anchor="middle">b_deck ${f2(G.bIn)} in</text>
      <text x="${r(X(0) + (m ? 4 : -4))}" y="${r(Y(G.h / 2))}" text-anchor="${m ? 'start' : 'end'}">h ${f2(G.h)} in</text>
      <text x="${r(X(0))}" y="${r(Y(0) + 26)}" text-anchor="middle" fill="#64748b">deck edge</text></svg>`;
  }

  window.SharedBarrier = { GAMMA, SHAPES, REF_W, LBL, spec, outline, compute, steps, parsePts, ptsText, svg };
})();
