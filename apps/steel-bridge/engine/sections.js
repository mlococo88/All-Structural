/* apps/steel-bridge/engine/sections.js — section properties of a steel I-girder, noncomposite and composite
   (window.SBDSections). Classic script, no DOM. Needs window.SharedSteps (shared/steps.js), loaded first.

   Ported 2026-10-29 from GirderDetail ("Steel Bridge Design.html"), Girder section module GM.gs.compute and the
   functions it calls: steelProps, addPart, modRatio, plasticNA, d61pos, d61neg, rhFactor. The arithmetic is the same,
   operation for operation, so results agree to the last bit (tests/engine/sections.test.mjs checks this on the 100
   gd_*.json hand-off payloads and GirderDetail's built-in rows). New here: every result carries its worked steps
   (shared/steps.js format), and the input/output names are spelled out.

   Units: plate and deck dimensions in, areas in^2, I in^4, S in^3, stresses ksi, forces kip, Mp kip-ft, unit weight
   kcf. y is measured up from the bottom of the steel (bottom of the bottom flange).
   Code: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024).

   Inputs used throughout:
     plates  { D, tw, topB, topT, botB, botT }               web depth and thickness, top and bottom flange width × thickness
     deck    { ts, haunch, beff, rebar: { top: { A, c }, bot: { A, c } } }
             ts structural slab thickness; haunch from top of steel to bottom of slab; beff effective flange width
             (4.6.2.6) of this girder; rebar.top.A, .c: top layer area within beff and its centroid below the top of the
             slab; rebar.bot.A, .c: bottom layer area and its centroid above the bottom of the slab
     mat     { Fyt, Fyb, Fyw, Fyr, fc }                     yield strengths of top flange, bottom flange, web, rebar; f'c */
(function () {
  'use strict';
  const ES = 29000;                                   // ksi, AASHTO LRFD 6.4.1
  const ED = 'AASHTO LRFD 10th Ed.';
  const sum = a => a.reduce((s, x) => s + x, 0);      // same summation order as GirderDetail's sum()
  const St = () => window.SharedSteps;
  const n2 = x => St().n(x, 2), n3 = x => St().n(x, 3), g0 = x => St().g(x, 0);
  const dm = x => { const s = St().n(x, 4); return s.indexOf('.') < 0 ? s : s.replace(/0+$/, '').replace(/\.$/, ''); };   // plate dimension

  /* ---------- modular ratio ---------- */
  /* modularRatio(fc, wc, K1, rule): Ec = 120,000 K1 wc² f'c^0.33 (ksi, kcf; Eq. 5.4.2.4-1), n = Es/Ec (6.10.1.1.1b);
     rule 'round' rounds n to the nearest integer (at least 1), 'exact' (default) keeps it. GirderDetail modRatio(). */
  function modularRatio(fc, wc, K1, rule) {
    const Ec = 120000 * K1 * wc ** 2 * fc ** 0.33, n0 = ES / Ec, n = rule === 'round' ? Math.max(1, Math.round(n0)) : n0;
    const w = St().work('n');
    w.add({ id: 'Ec', label: 'Modulus of elasticity of the deck concrete', sym: 'E_{c}', eq: '120{,}000K_{1}w_{c}^{2}f\\prime_{c}^{0.33}',
      sub: `120{,}000(${n2(K1)})(${n3(wc)})^{2}(${n2(fc)})^{0.33}`, value: Ec, unit: 'ksi', d: 0, ref: `${ED} Eq. 5.4.2.4-1` });
    w.add({ id: 'n', label: 'Modular ratio', sym: 'n', eq: '\\frac{E_{s}}{E_{c}}', sub: `\\frac{29{,}000}{${g0(Ec)}}`, value: n0, unit: '', d: 3, ref: `${ED} Art. 6.10.1.1.1b` });
    if (rule === 'round') w.add({ id: 'nr', label: 'Modular ratio, rounded to the nearest integer', sym: 'n', eq: '', sub: '', value: n, unit: '', d: 0, ref: `${ED} Art. 6.10.1.1.1b` });
    return { fc, wc, K1, Ec, n0, n, rule: rule === 'round' ? 'round' : 'exact', steps: w.steps };
  }

  /* ---------- elastic properties ---------- */
  /* steel(p): the steel section alone. Returns { A, yb, I, d, parts } (GirderDetail steelProps(D, s)). */
  function steelCore(p) {
    const D = p.D, parts = [{ n: 'Bottom flange', A: p.botB * p.botT, y: p.botT / 2, I0: p.botB * p.botT ** 3 / 12 },
      { n: 'Web', A: D * p.tw, y: p.botT + D / 2, I0: p.tw * D ** 3 / 12 },
      { n: 'Top flange', A: p.topB * p.topT, y: p.botT + D + p.topT / 2, I0: p.topB * p.topT ** 3 / 12 }];
    const A = sum(parts.map(q => q.A)), yb = sum(parts.map(q => q.A * q.y)) / A;
    parts.forEach(q => q.Ad2 = q.A * (q.y - yb) ** 2);
    return { A, yb, I: sum(parts.map(q => q.I0 + q.Ad2)), d: p.botT + D + p.topT, parts };
  }
  /* addPart(st, A, y, I0): st plus one part of area A at height y with own inertia I0 (GirderDetail addPart). */
  function addPart(st, A, y, I0) {
    const An = st.A + A, yb = (st.A * st.yb + A * y) / An;
    return { A: An, yb, I: st.I + st.A * (yb - st.yb) ** 2 + I0 + A * (y - yb) ** 2, d: st.d };
  }
  /* section moduli to the extreme fibers of the steel: S_top = I/(d − ȳ), S_bot = I/ȳ (GirderDetail section table) */
  function moduli(w, sec, d, tag) {
    sec.St = w.add({ id: 'St', label: `Section modulus, top of steel (${tag})`, sym: 'S_{top}', eq: '\\frac{I}{d - \\bar{y}}', sub: `\\frac{${g0(sec.I)}}{${n3(d)} - ${n3(sec.yb)}}`, value: sec.I / (d - sec.yb), unit: 'in^{3}', d: 0 });
    sec.Sb = w.add({ id: 'Sb', label: `Section modulus, bottom of steel (${tag})`, sym: 'S_{bot}', eq: '\\frac{I}{\\bar{y}}', sub: `\\frac{${g0(sec.I)}}{${n3(sec.yb)}}`, value: sec.I / sec.yb, unit: 'in^{3}', d: 0 });
    return sec;
  }

  /* steel(p): steel section, with steps. { A, yb, yt (= d − yb), I, d, St, Sb, parts, steps } */
  function steel(p) {
    const c = steelCore(p), w = St().work('sec.s'), ref = `${ED} Art. 6.10.1.1.1a`;
    w.add({ id: 'd', label: 'Depth of the steel section', sym: 'd', eq: 't_{b} + D + t_{t}', sub: `${dm(p.botT)} + ${dm(p.D)} + ${dm(p.topT)}`, value: c.d, unit: 'in', d: 3 });
    w.add({ id: 'A', label: 'Area of the steel section', sym: 'A', eq: 'b_{b}t_{b} + Dt_{w} + b_{t}t_{t}',
      sub: `${dm(p.botB)}(${dm(p.botT)}) + ${dm(p.D)}(${dm(p.tw)}) + ${dm(p.topB)}(${dm(p.topT)})`, value: c.A, unit: 'in^{2}', d: 2, ref });
    w.add({ id: 'yb', label: 'Elastic neutral axis of the steel section, above the bottom of steel', sym: '\\bar{y}', eq: '\\frac{\\sum Ay}{\\sum A}',
      sub: `\\frac{${c.parts.map(q => `${n2(q.A)}(${n3(q.y)})`).join(' + ')}}{${n2(c.A)}}`, value: c.yb, unit: 'in', d: 3, ref });
    w.add({ id: 'I', label: 'Moment of inertia of the steel section', sym: 'I', eq: '\\sum(I_{0} + A(y - \\bar{y})^{2})',
      sub: c.parts.map(q => `${g0(q.I0)} + ${n2(q.A)}(${n3(q.y)} - ${n3(c.yb)})^{2}`).join(' + '), value: c.I, unit: 'in^{4}', d: 0, ref });
    const o = { ...c, yt: c.d - c.yb };
    moduli(w, o, c.d, 'steel');
    o.steps = w.steps; return o;
  }

  /* composite(p, deck, n, k): the steel plus the slab transformed by k·n: k = 1 short-term (n), k = 3 long-term (3n).
     Slab centroid at d + haunch + ts/2; the haunch itself is not counted (GirderDetail). { A, yb, I, d, ySlab, St, Sb, steps } */
  function composite(p, deck, n, k) {
    const s = steelCore(p), d = s.d, hh = deck.haunch, ts = deck.ts, beff = deck.beff, ySl = d + hh + ts / 2;
    const tag = k === 3 ? 'long-term 3n' : 'short-term n', id = k === 3 ? 'sec.c3' : 'sec.cn', kn = k === 3 ? '3n' : 'n';
    const As = k === 3 ? beff * ts / (3 * n) : beff * ts / n, I0 = k === 3 ? beff * ts ** 3 / 12 / (3 * n) : beff * ts ** 3 / 12 / n;
    const c = addPart(s, As, ySl, I0), w = St().work(id), ref = `${ED} Art. 6.10.1.1.1b`;
    w.add({ id: 'Ad', label: `Transformed slab area (${tag})`, sym: 'A_{d}', eq: `\\frac{b_{eff}t_{s}}{${kn}}`, sub: `\\frac{${n2(beff)}(${dm(ts)})}${k === 3 ? `{3(${n3(n)})}` : `{${n3(n)}}`}`, value: As, unit: 'in^{2}', d: 2, ref });
    w.add({ id: 'yd', label: 'Slab centroid above the bottom of steel', sym: 'y_{d}', eq: 'd + h_{h} + \\frac{t_{s}}{2}', sub: `${n3(d)} + ${dm(hh)} + \\frac{${dm(ts)}}{2}`, value: ySl, unit: 'in', d: 3 });
    w.add({ id: 'A', label: `Area of the composite section (${tag})`, sym: 'A', eq: 'A_{s} + A_{d}', sub: `${n2(s.A)} + ${n2(As)}`, value: c.A, unit: 'in^{2}', d: 2, ref });
    w.add({ id: 'yb', label: `Elastic neutral axis (${tag}), above the bottom of steel`, sym: '\\bar{y}', eq: '\\frac{A_{s}\\bar{y}_{s} + A_{d}y_{d}}{A}',
      sub: `\\frac{${n2(s.A)}(${n3(s.yb)}) + ${n2(As)}(${n3(ySl)})}{${n2(c.A)}}`, value: c.yb, unit: 'in', d: 3, ref });
    w.add({ id: 'I', label: `Moment of inertia (${tag})`, sym: 'I', eq: 'I_{s} + A_{s}(\\bar{y} - \\bar{y}_{s})^{2} + \\frac{b_{eff}t_{s}^{3}}{12(' + kn + ')} + A_{d}(y_{d} - \\bar{y})^{2}',
      sub: `${g0(s.I)} + ${n2(s.A)}(${n3(c.yb)} - ${n3(s.yb)})^{2} + ${n2(I0)} + ${n2(As)}(${n3(ySl)} - ${n3(c.yb)})^{2}`, value: c.I, unit: 'in^{4}', d: 0, ref });
    const o = { ...c, k, ySlab: ySl, Ad: As, I0d: I0, yt: d - c.yb };
    moduli(w, o, d, tag);
    o.steps = w.steps; return o;
  }

  /* withRebar(p, deck): steel plus the longitudinal deck reinforcement within beff, for negative flexure (the slab is
     cracked and not counted). Top layer at d + haunch + ts − c_top, bottom layer at d + haunch + c_bot; top layer added
     first (GirderDetail). With no rebar it is the steel section. { A, yb, I, d, yRt, yRb, St, Sb, steps } */
  function withRebar(p, deck) {
    const s = steelCore(p), d = s.d, hh = deck.haunch, ts = deck.ts, rb = deck.rebar || {}, T = rb.top || { A: 0, c: 0 }, B = rb.bot || { A: 0, c: 0 };
    const yRt = d + hh + ts - T.c, yRb = d + hh + B.c, w = St().work('sec.cr'), ref = `${ED} Art. 6.10.1.1.1c`;
    let cr = s;
    if (T.A > 0) cr = addPart(cr, T.A, yRt, 0);
    if (B.A > 0) cr = addPart(cr, B.A, yRb, 0);
    w.add({ id: 'yRt', label: 'Top rebar layer above the bottom of steel', sym: 'y_{rt}', eq: 'd + h_{h} + t_{s} - c_{rt}', sub: `${n3(d)} + ${dm(hh)} + ${dm(ts)} - ${dm(T.c)}`, value: yRt, unit: 'in', d: 3 });
    w.add({ id: 'yRb', label: 'Bottom rebar layer above the bottom of steel', sym: 'y_{rb}', eq: 'd + h_{h} + c_{rb}', sub: `${n3(d)} + ${dm(hh)} + ${dm(B.c)}`, value: yRb, unit: 'in', d: 3 });
    const layers = [T.A > 0 ? [T.A, yRt, 'rt'] : null, B.A > 0 ? [B.A, yRb, 'rb'] : null].filter(Boolean);
    w.add({ id: 'A', label: 'Area of steel + longitudinal reinforcement', sym: 'A', eq: 'A_{s}' + layers.map(l => ` + A_{${l[2]}}`).join(''),
      sub: n2(s.A) + layers.map(l => ` + ${n2(l[0])}`).join(''), value: cr.A, unit: 'in^{2}', d: 2, ref, note: layers.length ? '' : 'No deck reinforcement entered: the steel section.' });
    w.add({ id: 'yb', label: 'Elastic neutral axis (steel + reinforcement), above the bottom of steel', sym: '\\bar{y}', eq: '\\frac{A_{s}\\bar{y}_{s}' + layers.map(l => ` + A_{${l[2]}}y_{${l[2]}}`).join('') + '}{A}',
      sub: `\\frac{${n2(s.A)}(${n3(s.yb)})${layers.map(l => ` + ${n2(l[0])}(${n3(l[1])})`).join('')}}{${n2(cr.A)}}`, value: cr.yb, unit: 'in', d: 3, ref });
    w.add({ id: 'I', label: 'Moment of inertia (steel + reinforcement)', sym: 'I', eq: 'I_{s} + A_{s}(\\bar{y} - \\bar{y}_{s})^{2}' + layers.map(l => ` + A_{${l[2]}}(y_{${l[2]}} - \\bar{y})^{2}`).join(''),
      sub: `${g0(s.I)} + ${n2(s.A)}(${n3(cr.yb)} - ${n3(s.yb)})^{2}` + layers.map(l => ` + ${n2(l[0])}(${n3(l[1])} - ${n3(cr.yb)})^{2}`).join(''), value: cr.I, unit: 'in^{4}', d: 0, ref,
      note: layers.length === 2 ? 'Layers added one at a time (top, then bottom); the result is the same as the one-step sum.' : '' });
    const o = { A: cr.A, yb: cr.yb, I: cr.I, d, yRt, yRb, yt: d - cr.yb };
    moduli(w, o, d, 'steel + rebar');
    o.steps = w.steps; return o;
  }

  /* ---------- plastic moment ---------- */
  /* plasticNumeric(el, pos): the plastic neutral axis by bisection on force equilibrium (GirderDetail plasticNA; used
     there as a cross-check of the D6.1 case equations and where those do not apply). el: rectangles { n, y0, y1, b, F,
     conc } or points { n, pt: true, y, A, F }; pos = true puts the top in compression; concrete counts only in
     compression. Returns { yp, pcs, Mp (kip-ft), C, T }. */
  function plasticNumeric(el, pos) {
    const force = y => { let c = 0, t = 0; el.forEach(e => { if (e.pt) { const up = e.y > y; if (pos === up) c += e.A * e.F; else t += e.A * e.F; return; }
      const above = Math.max(0, e.y1 - Math.max(e.y0, y)), below = Math.max(0, Math.min(e.y1, y) - e.y0); const ca = pos ? above : below, ta = pos ? below : above;
      c += ca * e.b * e.F; if (!e.conc) t += ta * e.b * e.F; }); return c - t; };
    let lo = Math.min(...el.map(e => e.pt ? e.y : e.y0)), hi = Math.max(...el.map(e => e.pt ? e.y : e.y1));
    for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2, g = force(m); if ((pos && g > 0) || (!pos && g < 0)) lo = m; else hi = m; }
    const yp = (lo + hi) / 2, pcs = [];
    el.forEach(e => { if (e.pt) { const up = e.y > yp; pcs.push({ n: e.n, s: pos === up ? 'C' : 'T', F: e.A * e.F, arm: Math.abs(e.y - yp) }); return; }
      [[Math.max(e.y0, yp), e.y1, pos ? 'C' : 'T'], [e.y0, Math.min(e.y1, yp), pos ? 'T' : 'C']].forEach(([a, b, s]) => { if (b - a > 1e-9 && !(e.conc && s === 'T')) pcs.push({ n: e.n + (e.y1 - e.y0 > b - a + 1e-9 ? (b > yp + 1e-9 ? ' (above PNA)' : ' (below PNA)') : ''), s, F: (b - a) * e.b * e.F, arm: Math.abs((a + b) / 2 - yp) }); }); });
    pcs.forEach(q => q.M = q.F * q.arm);
    return { yp, pcs, Mp: sum(pcs.map(q => q.M)) / 12, C: sum(pcs.filter(q => q.s === 'C').map(q => q.F)), T: sum(pcs.filter(q => q.s === 'T').map(q => q.F)) };
  }

  /* d61pos(r, X), d61neg(r, X): Appendix D6.1 plastic moment by the case equations of Table D6.1-1 (positive flexure)
     and Table D6.1-2 (negative flexure), GirderDetail's functions with the TeX fields replaced by the symbol strings of
     the steps. r: plates + beff; X: { inc, fc, ts, hh, Fyr, Art, Arb, crt, crbUp, Fyt, Fyb, Fyw }. */
  function d61pos(r, X) {
    const inc = X.inc, tb = r.botT, D = r.D, tc = r.topT, d = tb + D + tc, y1 = d + X.hh + X.ts, ts = X.ts, crt = X.crt, crb = X.ts - X.crbUp;
    const P = { s: 0.85 * X.fc * r.beff * ts, rt: inc ? X.Fyr * X.Art : 0, rb: inc ? X.Fyr * X.Arb : 0, c: X.Fyt * r.topB * tc, w: X.Fyw * D * r.tw, t: X.Fyb * r.botB * tb };
    const Y = { s: y1 - ts / 2, rt: y1 - crt, rb: y1 - crb, c: d - tc / 2, w: tb + D / 2, t: tb / 2 };
    const tests = [], CK_ = (cs, lhs, lt, rhs, rt) => { const ok = lhs >= rhs - 1e-9; tests.push({ cs, lhs, lt, rhs, rt, ok }); return ok; };
    let cs, Yb, yp;
    if (CK_('I', P.t + P.w, 'P_{t} + P_{w}', P.c + P.s + P.rb + P.rt, 'P_{c} + P_{s} + P_{rb} + P_{rt}')) { cs = 'I'; Yb = D / 2 * ((P.t - P.c - P.s - P.rt - P.rb) / P.w + 1); yp = tb + D - Yb; }
    else if (CK_('II', P.t + P.w + P.c, 'P_{t} + P_{w} + P_{c}', P.s + P.rb + P.rt, 'P_{s} + P_{rb} + P_{rt}')) { cs = 'II'; Yb = tc / 2 * ((P.w + P.t - P.s - P.rt - P.rb) / P.c + 1); yp = d - Yb; }
    else if (CK_('III', P.t + P.w + P.c, 'P_{t} + P_{w} + P_{c}', crb / ts * P.s + P.rb + P.rt, '\\frac{c_{rb}}{t_{s}}P_{s} + P_{rb} + P_{rt}')) { cs = 'III'; Yb = ts * (P.c + P.w + P.t - P.rt - P.rb) / P.s; yp = y1 - Yb; }
    else if (inc && CK_('IV', P.t + P.w + P.c + P.rb, 'P_{t} + P_{w} + P_{c} + P_{rb}', crb / ts * P.s + P.rt, '\\frac{c_{rb}}{t_{s}}P_{s} + P_{rt}')) { cs = 'IV'; Yb = crb; yp = y1 - Yb; }
    else if (CK_('V', P.t + P.w + P.c + P.rb, 'P_{t} + P_{w} + P_{c} + P_{rb}', crt / ts * P.s + P.rt, '\\frac{c_{rt}}{t_{s}}P_{s} + P_{rt}')) { cs = 'V'; Yb = ts * (P.rb + P.c + P.w + P.t - P.rt) / P.s; yp = y1 - Yb; }
    else if (inc && CK_('VI', P.t + P.w + P.c + P.rb + P.rt, 'P_{t} + P_{w} + P_{c} + P_{rb} + P_{rt}', crt / ts * P.s, '\\frac{c_{rt}}{t_{s}}P_{s}')) { cs = 'VI'; Yb = crt; yp = y1 - Yb; }
    else { cs = 'VII'; Yb = ts * (P.rb + P.rt + P.c + P.w + P.t) / P.s; yp = y1 - Yb; }
    const dist = k => Math.abs(Y[k] - yp), terms = [];
    const tm = (k, sym, lbl) => { if (P[k] > 0) terms.push({ k, sym, lbl, P: P[k], d: dist(k), M: P[k] * dist(k) }); };
    let lead, leadSym, ref = { I: 'top of the web', II: 'top of the top flange' }[cs] || 'top of the deck';
    if (cs === 'I') { lead = P.w / (2 * D) * (Yb ** 2 + (D - Yb) ** 2); leadSym = '\\frac{P_{w}}{2D}(\\bar{Y}^{2} + (D - \\bar{Y})^{2})'; tm('s', 'P_{s}d_{s}', 'Deck'); tm('rt', 'P_{rt}d_{rt}', 'Top rebar'); tm('rb', 'P_{rb}d_{rb}', 'Bottom rebar'); tm('c', 'P_{c}d_{c}', 'Top flange'); tm('t', 'P_{t}d_{t}', 'Bottom flange'); }
    else if (cs === 'II') { lead = P.c / (2 * tc) * (Yb ** 2 + (tc - Yb) ** 2); leadSym = '\\frac{P_{c}}{2t_{c}}(\\bar{Y}^{2} + (t_{c} - \\bar{Y})^{2})'; tm('s', 'P_{s}d_{s}', 'Deck'); tm('rt', 'P_{rt}d_{rt}', 'Top rebar'); tm('rb', 'P_{rb}d_{rb}', 'Bottom rebar'); tm('w', 'P_{w}d_{w}', 'Web'); tm('t', 'P_{t}d_{t}', 'Bottom flange'); }
    else { lead = Yb ** 2 * P.s / (2 * ts); leadSym = '\\frac{\\bar{Y}^{2}P_{s}}{2t_{s}}'; if (cs !== 'VI') tm('rt', 'P_{rt}d_{rt}', 'Top rebar'); if (cs !== 'IV') tm('rb', 'P_{rb}d_{rb}', 'Bottom rebar'); tm('c', 'P_{c}d_{c}', 'Top flange'); tm('w', 'P_{w}d_{w}', 'Web'); tm('t', 'P_{t}d_{t}', 'Bottom flange'); }
    const Mp = (lead + sum(terms.map(q => q.M))) / 12;
    // PNA below the web (GirderDetail PNA-OOS, engineer's decision 2026-10-14): outside Table D6.1-1 and D6.3.2; flagged, values left as they are
    const below = cs === 'I' && P.t > P.c + P.s + P.w + P.rt + P.rb;
    return { pos: true, inc, P, Y, tests, cs, Yb, yp, ref, lead, leadSym, terms, Mp, crt, crb, ts, D, tc, tb, d, y1, Dcp: cs === 'I' ? Yb : 0, ...(below ? { below: true } : {}) };
  }
  function d61neg(r, X) {
    const tb = r.botT, D = r.D, tt = r.topT, d = tb + D + tt, y1 = d + X.hh + X.ts, crt = X.crt, crb = X.ts - X.crbUp;
    const P = { rt: X.Fyr * X.Art, rb: X.Fyr * X.Arb, t: X.Fyt * r.topB * tt, w: X.Fyw * D * r.tw, c: X.Fyb * r.botB * tb };
    const Y = { rt: y1 - crt, rb: y1 - crb, t: d - tt / 2, w: tb + D / 2, c: tb / 2 };
    const tests = [], CK_ = (cs, lhs, lt, rhs, rt) => { const ok = lhs >= rhs - 1e-9; tests.push({ cs, lhs, lt, rhs, rt, ok }); return ok; };
    let cs, Yb, yp, out = false;
    if (CK_('I', P.c + P.w, 'P_{c} + P_{w}', P.t + P.rb + P.rt, 'P_{t} + P_{rb} + P_{rt}')) { cs = 'I'; Yb = D / 2 * ((P.c - P.t - P.rt - P.rb) / P.w + 1); yp = tb + D - Yb; }
    else if (CK_('II', P.c + P.w + P.t, 'P_{c} + P_{w} + P_{t}', P.rb + P.rt, 'P_{rb} + P_{rt}')) { cs = 'II'; Yb = tt / 2 * ((P.w + P.c - P.rt - P.rb) / P.t + 1); yp = d - Yb; }
    else { cs = '—'; out = true; }
    const terms = [], tm = (k, sym, lbl) => { if (P[k] > 0) { const dd = Math.abs(Y[k] - yp); terms.push({ k, sym, lbl, P: P[k], d: dd, M: P[k] * dd }); } };
    let lead = 0, leadSym = '';
    if (cs === 'I') { lead = P.w / (2 * D) * (Yb ** 2 + (D - Yb) ** 2); leadSym = '\\frac{P_{w}}{2D}(\\bar{Y}^{2} + (D - \\bar{Y})^{2})'; tm('rt', 'P_{rt}d_{rt}', 'Top rebar'); tm('rb', 'P_{rb}d_{rb}', 'Bottom rebar'); tm('t', 'P_{t}d_{t}', 'Top flange'); tm('c', 'P_{c}d_{c}', 'Bottom flange'); }
    else if (cs === 'II') { lead = P.t / (2 * tt) * (Yb ** 2 + (tt - Yb) ** 2); leadSym = '\\frac{P_{t}}{2t_{t}}(\\bar{Y}^{2} + (t_{t} - \\bar{Y})^{2})'; tm('rt', 'P_{rt}d_{rt}', 'Top rebar'); tm('rb', 'P_{rb}d_{rb}', 'Bottom rebar'); tm('w', 'P_{w}d_{w}', 'Web'); tm('c', 'P_{c}d_{c}', 'Bottom flange'); }
    const Mp = out ? NaN : (lead + sum(terms.map(q => q.M))) / 12;
    return { pos: false, P, Y, tests, cs, Yb, yp, out, ref: cs === 'I' ? 'top of the web' : 'top of the top flange', lead, leadSym, terms, Mp, crt, crb, D, tt, tb, d, Dcp: cs === 'I' ? D - Yb : cs === 'II' ? D : 0 };
  }

  const P_SYM = { s: ['P_{s}', '0.85f\\prime_{c}b_{eff}t_{s}', 'Deck'], rt: ['P_{rt}', 'F_{yr}A_{rt}', 'Top rebar'], rb: ['P_{rb}', 'F_{yr}A_{rb}', 'Bottom rebar'] };
  /* plastic(p, deck, mat, opt): plastic moment of the section, Appendix D6.1. opt.region 'pos' (top in compression;
     the deck counts in compression; rebar only if opt.rebarInPositive, GirderDetail "Deck rebar in positive Mp") or 'neg'
     (bottom in compression; the deck is cracked, rebar counts). Returns { region, cs, Yb, yp, Mp, Dcp, Dt, Dp (pos),
     out (neg: PNA above the top flange, outside Table D6.1-2), below (pos: PNA below the web, outside Table D6.1-1),
     d61, num (bisection cross-check), diff (relative |Mp(D6.1) − Mp(bisection)|), steps } */
  function plastic(p, deck, mat, opt) {
    opt = opt || {};
    const pos = opt.region !== 'neg', d = p.botT + p.D + p.topT, hh = deck.haunch, ts = deck.ts, rb = deck.rebar || {}, T = rb.top || { A: 0, c: 0 }, B = rb.bot || { A: 0, c: 0 };
    const Art = T.A, Arb = B.A, yRt = d + hh + ts - T.c, yRb = d + hh + B.c, Dt = d + hh + ts, incR = !pos || !!opt.rebarInPositive;
    const r = { ...p, beff: deck.beff };
    const el = [{ n: 'Bottom flange', y0: 0, y1: p.botT, b: p.botB, F: mat.Fyb }, { n: 'Web', y0: p.botT, y1: p.botT + p.D, b: p.tw, F: mat.Fyw }, { n: 'Top flange', y0: p.botT + p.D, y1: d, b: p.topB, F: mat.Fyt }];
    if (incR && Art > 0) el.push({ n: 'Top rebar', pt: true, y: yRt, A: Art, F: mat.Fyr }); if (incR && Arb > 0) el.push({ n: 'Bottom rebar', pt: true, y: yRb, A: Arb, F: mat.Fyr });
    if (pos) el.push({ n: 'Deck (0.85f′c)', y0: d + hh, y1: d + hh + ts, b: deck.beff, F: 0.85 * mat.fc, conc: true });
    const num = plasticNumeric(el, pos);
    const X = { inc: incR, fc: mat.fc, ts, hh, Fyr: mat.Fyr, Art, Arb, crt: T.c, crbUp: B.c, Fyt: mat.Fyt, Fyb: mat.Fyb, Fyw: mat.Fyw };
    // no deck in positive flexure (a noncomposite girder; never in GirderDetail): Table D6.1-1 needs P_s > 0, so the PNA is
    // found by force equilibrium only, and D_cp is the web above the PNA
    const noDeck = pos && !(deck.beff > 0 && ts > 0);
    const q = noDeck ? { pos: true, P: { s: 0, rt: 0, rb: 0, c: mat.Fyt * p.topB * p.topT, w: mat.Fyw * p.D * p.tw, t: mat.Fyb * p.botB * p.botT }, tests: [], cs: '—', out: true, noDeck: true }
      : pos ? d61pos(r, X) : d61neg(r, X);
    const pl = q.out ? num : { ...num, yp: q.yp, Mp: q.Mp };
    const Dcp = noDeck ? Math.max(0, Math.min(p.D, p.botT + p.D - pl.yp)) : q.out ? Math.max(0, Math.min(p.D, pl.yp - p.botT)) : q.Dcp;
    const diff = q.out ? NaN : Math.abs(q.Mp - num.Mp) / num.Mp;

    /* steps */
    const w = St().work(pos ? 'pl.pos' : 'pl.neg'), tab = pos ? 'Table D6.1-1' : 'Table D6.1-2', ref = `${ED} App. D6.1, ${tab}`;
    // forces: steel parts named by their role in this region (positive: c = top flange in compression, t = bottom; negative: the reverse)
    const fl = pos ? { c: ['top', 'F_{yt}b_{t}t_{t}', mat.Fyt, p.topB, p.topT], t: ['bottom', 'F_{yb}b_{b}t_{b}', mat.Fyb, p.botB, p.botT] }
      : { t: ['top', 'F_{yt}b_{t}t_{t}', mat.Fyt, p.topB, p.topT], c: ['bottom', 'F_{yb}b_{b}t_{b}', mat.Fyb, p.botB, p.botT] };
    if (pos) w.add({ id: 'Ps', label: 'Plastic force in the deck', sym: 'P_{s}', eq: '0.85f\\prime_{c}b_{eff}t_{s}', sub: `0.85(${n2(mat.fc)})(${n2(deck.beff)})(${dm(ts)})`, value: q.P.s, unit: 'kip', d: 1, ref: `${ED} App. D6.1` });
    ['rt', 'rb'].forEach(k => { if (q.P[k] > 0) w.add({ id: 'P' + k, label: `Plastic force in the ${P_SYM[k][2].toLowerCase()} layer`, sym: P_SYM[k][0], eq: P_SYM[k][1], sub: `${n2(mat.Fyr)}(${n2(k === 'rt' ? Art : Arb)})`, value: q.P[k], unit: 'kip', d: 1, ref: `${ED} App. D6.1` }); });
    if (pos && !incR && (Art > 0 || Arb > 0)) w.add({ id: 'Prx', label: 'Deck reinforcement in positive flexure', sym: 'P_{rt} = P_{rb}', eq: '', sub: '', value: 0, unit: 'kip', d: 0, note: 'Not counted (option: deck rebar excluded from the positive-flexure plastic moment, conservative).' });
    w.add({ id: 'Pc', label: `Plastic force in the compression flange (${fl.c[0]})`, sym: 'P_{c}', eq: fl.c[1], sub: `${n2(fl.c[2])}(${dm(fl.c[3])})(${dm(fl.c[4])})`, value: q.P.c, unit: 'kip', d: 1, ref: `${ED} App. D6.1` });
    w.add({ id: 'Pw', label: 'Plastic force in the web', sym: 'P_{w}', eq: 'F_{yw}Dt_{w}', sub: `${n2(mat.Fyw)}(${dm(p.D)})(${dm(p.tw)})`, value: q.P.w, unit: 'kip', d: 1, ref: `${ED} App. D6.1` });
    w.add({ id: 'Pt', label: `Plastic force in the tension flange (${fl.t[0]})`, sym: 'P_{t}', eq: fl.t[1], sub: `${n2(fl.t[2])}(${dm(fl.t[3])})(${dm(fl.t[4])})`, value: q.P.t, unit: 'kip', d: 1, ref: `${ED} App. D6.1` });
    q.tests.forEach(t => w.add({ id: 'case' + t.cs, label: `${tab}, Case ${t.cs}: PNA ${t.ok ? 'in this case' : 'not in this case'}`, sym: '', eq: `${t.lt} ${t.ok ? '\\ge' : '\\lt'} ${t.rt}`,
      sub: `${n2(t.lhs)} ${t.ok ? '\\ge' : '\\lt'} ${n2(t.rhs)}`, value: t.ok ? 'yes' : 'no', unit: '', ref, ok: t.ok }));
    if (q.out) {
      w.add(q.noDeck ? { id: 'out', label: 'No deck (noncomposite)', sym: '', eq: '', sub: '', value: 'Table D6.1-1 does not apply', unit: '', ref,
        note: 'The plastic neutral axis of the steel section is found by force equilibrium (bisection).' }
        : { id: 'out', label: 'PNA above the top flange', sym: '', eq: '', sub: '', value: 'outside Table D6.1-2', unit: '', ref,
        note: 'The reinforcement alone exceeds the steel: the plastic neutral axis is found by force equilibrium (bisection) instead.' });
      w.add({ id: 'yp', label: 'Plastic neutral axis by bisection, above the bottom of steel', sym: 'y_{p}', eq: '\\sum F_{C} = \\sum F_{T}', sub: `C = ${n2(num.C)}, T = ${n2(num.T)}`, value: num.yp, unit: 'in', d: 3 });
      w.add({ id: 'Mp', label: 'Plastic moment by bisection', sym: 'M_{p}', eq: '\\frac{\\sum F|y - y_{p}|}{12}', sub: '', value: num.Mp, unit: 'kip-ft', d: 1 });
    } else {
      const refY = q.ref;
      w.add({ id: 'Yb', label: `Distance from the ${refY} to the PNA (Case ${q.cs})`, sym: '\\bar{Y}', eq: ybarEq(q), sub: ybarSub(q), value: q.Yb, unit: 'in', d: 3, ref });
      w.add({ id: 'yp', label: 'Plastic neutral axis above the bottom of steel', sym: 'y_{p}', eq: ypEq(q), sub: ypSub(q), value: q.yp, unit: 'in', d: 3 });
      q.terms.forEach(t => w.add({ id: 'd' + t.k, label: `Lever arm, ${t.lbl.toLowerCase()} to the PNA`, sym: `d_{${t.k}}`, eq: `|y_{${t.k}} - y_{p}|`, sub: `|${n3(q.Y[t.k])} - ${n3(q.yp)}|`, value: t.d, unit: 'in', d: 3 }));
      w.add({ id: 'Mp', label: `Plastic moment (Case ${q.cs})`, sym: 'M_{p}', eq: `\\frac{${q.leadSym}${q.terms.map(t => ' + ' + t.sym).join('')}}{12}`,
        sub: `\\frac{${g0(q.lead)}${q.terms.map(t => ` + ${n2(t.P)}(${n3(t.d)})`).join('')}}{12}`, value: q.Mp, unit: 'kip-ft', d: 1, ref });
      w.add({ id: 'chk', label: 'Cross-check: Mp by force equilibrium (bisection)', sym: 'M_{p,num}', eq: '', sub: '', value: num.Mp, unit: 'kip-ft', d: 1,
        note: `Differs from the case equations by ${St().n(100 * diff, 4)} %.` });
      if (q.below) w.add({ id: 'below', label: 'PNA below the web', sym: '', eq: 'P_{t} \\gt P_{c} + P_{s} + P_{w}' + (q.inc ? ' + P_{rt} + P_{rb}' : ''), sub: '', value: 'outside Table D6.1-1 and D6.3.2', unit: '', ref,
        note: 'Outside the scope of the app (GirderDetail PNA-OOS, engineer decision 2026-10-14): the values above are not to be used.' });
    }
    w.add({ id: 'Dcp', label: 'Depth of the web in compression at the plastic moment', sym: 'D_{cp}', eq: q.noDeck ? 't_{b} + D - y_{p}' : q.out ? 'y_{p} - t_{b}' : pos ? (q.cs === 'I' ? '\\bar{Y}' : '0') : (q.cs === 'I' ? 'D - \\bar{Y}' : 'D'),
      sub: q.noDeck ? `${dm(p.botT)} + ${dm(p.D)} - ${n3(pl.yp)}, \\text{ within } 0 \\ldots D` : q.out ? `${n3(pl.yp)} - ${dm(p.botT)}, \\text{ within } 0 \\ldots D` : pos ? (q.cs === 'I' ? n3(q.Yb) : '') : (q.cs === 'I' ? `${dm(p.D)} - ${n3(q.Yb)}` : dm(p.D)), value: Dcp, unit: 'in', d: 3, ref: `${ED} App. D6.3.2` });
    const o = { region: pos ? 'pos' : 'neg', cs: q.cs, Yb: q.Yb, yp: pl.yp, Mp: pl.Mp, Dcp, Dt, out: !!q.out, below: !!q.below, rebarCounted: incR, d61: q, num, diff };
    if (pos && !q.noDeck) {
      w.add({ id: 'Dt', label: 'Total depth of the composite section', sym: 'D_{t}', eq: 'd + h_{h} + t_{s}', sub: `${n3(d)} + ${dm(hh)} + ${dm(ts)}`, value: Dt, unit: 'in', d: 3, ref: `${ED} Art. 6.10.7.1.2` });
      o.Dp = w.add({ id: 'Dp', label: 'Distance from the top of the deck to the PNA', sym: 'D_{p}', eq: 'D_{t} - y_{p}', sub: `${n3(Dt)} - ${n3(pl.yp)}`, value: Dt - pl.yp, unit: 'in', d: 3, ref: `${ED} Art. 6.10.7.1.2` });
    }
    o.steps = w.steps; return o;
  }
  function ybarEq(q) {
    const pos = q.pos, cs = q.cs;
    if (pos) return { I: '\\frac{D}{2}(\\frac{P_{t} - P_{c} - P_{s} - P_{rt} - P_{rb}}{P_{w}} + 1)', II: '\\frac{t_{c}}{2}(\\frac{P_{w} + P_{t} - P_{s} - P_{rt} - P_{rb}}{P_{c}} + 1)',
      III: 't_{s}\\frac{P_{c} + P_{w} + P_{t} - P_{rt} - P_{rb}}{P_{s}}', IV: 'c_{rb}', V: 't_{s}\\frac{P_{rb} + P_{c} + P_{w} + P_{t} - P_{rt}}{P_{s}}', VI: 'c_{rt}',
      VII: 't_{s}\\frac{P_{rb} + P_{rt} + P_{c} + P_{w} + P_{t}}{P_{s}}' }[cs];
    return { I: '\\frac{D}{2}(\\frac{P_{c} - P_{t} - P_{rt} - P_{rb}}{P_{w}} + 1)', II: '\\frac{t_{t}}{2}(\\frac{P_{w} + P_{c} - P_{rt} - P_{rb}}{P_{t}} + 1)' }[cs];
  }
  function ybarSub(q) {
    const P = q.P, f = n2, cs = q.cs;
    if (q.pos) return { I: `\\frac{${dm(q.D)}}{2}(\\frac{${f(P.t)} - ${f(P.c)} - ${f(P.s)} - ${f(P.rt)} - ${f(P.rb)}}{${f(P.w)}} + 1)`, II: `\\frac{${dm(q.tc)}}{2}(\\frac{${f(P.w)} + ${f(P.t)} - ${f(P.s)} - ${f(P.rt)} - ${f(P.rb)}}{${f(P.c)}} + 1)`,
      III: `${dm(q.ts)}\\frac{${f(P.c)} + ${f(P.w)} + ${f(P.t)} - ${f(P.rt)} - ${f(P.rb)}}{${f(P.s)}}`, IV: dm(q.crb), V: `${dm(q.ts)}\\frac{${f(P.rb)} + ${f(P.c)} + ${f(P.w)} + ${f(P.t)} - ${f(P.rt)}}{${f(P.s)}}`, VI: dm(q.crt),
      VII: `${dm(q.ts)}\\frac{${f(P.rb)} + ${f(P.rt)} + ${f(P.c)} + ${f(P.w)} + ${f(P.t)}}{${f(P.s)}}` }[cs];
    return { I: `\\frac{${dm(q.D)}}{2}(\\frac{${f(P.c)} - ${f(P.t)} - ${f(P.rt)} - ${f(P.rb)}}{${f(P.w)}} + 1)`, II: `\\frac{${dm(q.tt)}}{2}(\\frac{${f(P.w)} + ${f(P.c)} - ${f(P.rt)} - ${f(P.rb)}}{${f(P.t)}} + 1)` }[cs];
  }
  function ypEq(q) { return q.cs === 'I' ? 't_{b} + D - \\bar{Y}' : q.cs === 'II' ? 'd - \\bar{Y}' : 'd + h_{h} + t_{s} - \\bar{Y}'; }
  function ypSub(q) { return q.cs === 'I' ? `${dm(q.tb)} + ${dm(q.D)} - ${n3(q.Yb)}` : q.cs === 'II' ? `${n3(q.d)} - ${n3(q.Yb)}` : `${n3(q.y1)} - ${n3(q.Yb)}`; }

  /* ---------- web depth in compression, hybrid factor ---------- */
  /* dc(p, sec, flange): elastic depth of the web in compression, with the moment acting on section sec alone (D6.3.1):
     flange 'top' (positive moment, top flange in compression): (d − t_t) − ȳ; 'bot' (negative moment): ȳ − t_b.
     GirderDetail: DcC on the steel section (deck placement) and Dc = max(ȳ − t_b, 0) on steel + rebar (negative flexure). */
  function dc(p, sec, flange, tag) {
    const d = p.botT + p.D + p.topT, top = flange === 'top';
    const raw = top ? (d - p.topT) - sec.yb : sec.yb - p.botT;
    const value = top ? raw : Math.max(raw, 0);
    const w = St().work('dc.' + String(tag || 'sec').replace(/[^A-Za-z0-9]+/g, '') + '.' + flange);
    w.add({ id: 'Dc', label: `Depth of the web in compression, elastic (${tag || ''}${tag ? ', ' : ''}${top ? 'top' : 'bottom'} flange in compression)`, sym: 'D_{c}',
      eq: top ? '(d - t_{t}) - \\bar{y}' : '\\max(\\bar{y} - t_{b}, 0)', sub: top ? `(${n3(d)} - ${dm(p.topT)}) - ${n3(sec.yb)}` : `\\max(${n3(sec.yb)} - ${dm(p.botT)}, 0)`, value, unit: 'in', d: 3, ref: `${ED} App. D6.3.1` });
    return { Dc: value, steps: w.steps };
  }
  /* hybrid(p, sec, mat): hybrid factor R_h, 6.10.1.10.1 (GirderDetail rhFactor): 1 when F_yw ≥ the smaller flange F_y;
     otherwise β = 2D_n t_w/A_fn, ρ = min(F_yw/f_n, 1), R_h = (12 + β(3ρ − ρ³))/(12 + 2β), with D_n the larger distance
     from the elastic NA of sec to the inside face of a flange. */
  function hybrid(p, sec, mat, tag) {
    const w = St().work('rh.' + (tag || 'x')), ref = `${ED} Art. 6.10.1.10.1`;
    if (mat.Fyw >= Math.min(mat.Fyt, mat.Fyb) - 1e-9) {
      w.add({ id: 'Rh', label: 'Hybrid factor (homogeneous section)', sym: 'R_{h}', eq: '1.0', sub: `F_{yw} = ${n2(mat.Fyw)} \\ge \\min(F_{yt}, F_{yb}) = ${n2(Math.min(mat.Fyt, mat.Fyb))}`, value: 1, unit: '', d: 3, ref });
      return { Rh: 1, steps: w.steps };
    }
    const dT = p.botT + p.D - sec.yb, dB = sec.yb - p.botT, top = dT >= dB, Dn = Math.max(dT, dB), Afn = top ? p.topB * p.topT : p.botB * p.botT, fn = top ? mat.Fyt : mat.Fyb, beta = 2 * Dn * p.tw / Afn, rho = Math.min(mat.Fyw / fn, 1);
    const Rh = (12 + beta * (3 * rho - rho ** 3)) / (12 + 2 * beta);
    w.add({ id: 'Dn', label: `Larger distance from the elastic NA to the inside face of a flange (${top ? 'top' : 'bottom'})`, sym: 'D_{n}', eq: '\\max(t_{b} + D - \\bar{y}, \\bar{y} - t_{b})', sub: `\\max(${n3(dT)}, ${n3(dB)})`, value: Dn, unit: 'in', d: 3, ref });
    w.add({ id: 'beta', label: 'β', sym: '\\beta', eq: '\\frac{2D_{n}t_{w}}{A_{fn}}', sub: `\\frac{2(${n3(Dn)})(${dm(p.tw)})}{${n2(Afn)}}`, value: beta, unit: '', d: 3, ref: `${ED} Eq. 6.10.1.10.1-2` });
    w.add({ id: 'rho', label: 'ρ', sym: '\\rho', eq: '\\min(\\frac{F_{yw}}{f_{n}}, 1.0)', sub: `\\min(\\frac{${n2(mat.Fyw)}}{${n2(fn)}}, 1.0)`, value: rho, unit: '', d: 3, ref });
    w.add({ id: 'Rh', label: 'Hybrid factor', sym: 'R_{h}', eq: '\\frac{12 + \\beta(3\\rho - \\rho^{3})}{12 + 2\\beta}', sub: `\\frac{12 + ${n3(beta)}(3(${n3(rho)}) - ${n3(rho)}^{3})}{12 + 2(${n3(beta)})}`, value: Rh, unit: '', d: 3, ref: `${ED} Eq. 6.10.1.10.1-1` });
    return { Rh, beta, rho, Dn, steps: w.steps };
  }

  /* ---------- the section card ---------- */
  /* card(p, deck, mat, n, opt): everything GirderDetail's Girder section module works out from the section alone,
     for one location: steel s, long-term c3, short-term cn, steel + rebar cr (A, ȳ, I, S top and bottom of steel),
     the plastic moment, PNA and D_cp for the region (opt.region 'pos' | 'neg'; opt.rebarInPositive), D_t, D_p,
     D_c (negative: steel + rebar; and on the steel section for either flange), R_h (pos: cn, neg: cr; steel: s).
     deck.composite === false: no c3, cn and no deck in the plastic moment (not used by GirderDetail; the app's
     noncomposite girders). Returns the values and steps (all sub-results' steps, in order). */
  function card(p, deck, mat, n, opt) {
    opt = opt || {};
    const pos = opt.region !== 'neg', comp = deck.composite !== false;
    const s = steel(p), c3 = comp ? composite(p, deck, n, 3) : null, cn = comp ? composite(p, deck, n, 1) : null, cr = withRebar(p, deck);
    const pl = plastic(p, comp ? deck : { ...deck, beff: 0 }, mat, { region: pos ? 'pos' : 'neg', rebarInPositive: !!opt.rebarInPositive });
    const dcS = { top: dc(p, s, 'top', 'steel'), bot: dc(p, s, 'bot', 'steel') }, dcR = dc(p, cr, 'bot', 'steel + rebar');
    const rh = hybrid(p, pos ? (cn || s) : cr, mat, pos ? 'cn' : 'cr'), rhS = hybrid(p, s, mat, 's');
    const steps = [].concat(s.steps, c3 ? c3.steps : [], cn ? cn.steps : [], cr.steps, pl.steps, dcS.top.steps, dcS.bot.steps, dcR.steps, rh.steps, rhS.steps);
    return { region: pos ? 'pos' : 'neg', s, c3, cn, cr, pl, Dc: pos ? null : dcR.Dc, DcSteel: { top: dcS.top.Dc, bot: dcS.bot.Dc }, DcRebar: dcR.Dc,
      Rh: rh.Rh, RhSteel: rhS.Rh, Dt: pl.Dt, Dp: pl.Dp, Dcp: pl.Dcp, Mp: pl.Mp, yp: pl.yp, steps };
  }

  window.SBDSections = { ES, modularRatio, steelCore, addPart, steel, composite, withRebar, plasticNumeric, d61pos, d61neg, plastic, dc, hybrid, card };
})();
