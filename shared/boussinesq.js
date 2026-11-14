/* shared/boussinesq.js — vertical stress increase in an elastic half-space under a footing (window.SharedBoussinesq).
   Classic script, no DOM, no state. Created 2026-11-14 for Spread Footing.html (Bearing tab, "Stress below footing
   (Boussinesq)"); usable by any tool with a rectangular footing and a linear (rigid-footing) base pressure.
   Pure functions of plain numbers, tested in Node (tests/engine/boussinesq.test.mjs).

   Basis (the soil is a homogeneous, isotropic, linear-elastic half-space; the vertical stress does not depend on the
   modulus or on Poisson's ratio):
   - Point load P on the surface (Boussinesq, 1885): at depth z and horizontal distance r from the load,
        Δσ_z = 3 P z³ / (2π R⁵),   R = √(r² + z²).
   - Uniform pressure q on a rectangle a × b, under one CORNER at depth z (the point-load solution integrated over the
     rectangle; Newmark, 1935; charted in FHWA GEC 6 (FHWA-IF-02-054, 2002) Fig. 5-11 as f(m, n), "from Newmark (1942)"):
        Δσ_z = q · I(m, n),  m = a/z,  n = b/z,  V = m² + n² + 1,
        I = 1/(4π) · [ 2mn√V/(V + m²n²) · (V + 1)/V + atan2(2mn√V, V − m²n²) ]
     (atan2 keeps the angle in [0, π]: the "+π when m²n² > V" correction of the chart form).
   - Any point (x, y) inside or outside the rectangle: superposition of four corner rectangles with signs (the usual
     superposition of Fig. 5-11; GEC 6 §5.3.2). Coordinates here: footing centre at the origin, x along B, y along L.
   - Linear pressure q = q0 + gx·ξ + gy·η over the whole rectangle (a rigid footing in full contact): the point-load
     solution integrated in closed form. With u = ξ − x, v = η − y (from the point):
        Δσ_z = q(x, y)·I_u + gx·J_u + gy·J_v,
        I_u = Σ corners of the uniform influence above,
        J_u = ∬ u·K du dv = Σ± G(u, v),  G(u, v) = −(z³/2π) · v / ((u² + z²)·√(u² + v² + z²)),
        J_v = ∬ v·K du dv = Σ± H(u, v),  H(u, v) = −(z³/2π) · u / ((v² + z²)·√(u² + v² + z²)),
        K = 3z³/(2π(u² + v² + z²)^{5/2})  (the point-load kernel per unit load).
   - Linear pressure over ANY polygon (the contact area of a footing in partial contact, q = max(0, plane), as the tool's
     solver gives it): numerical integration of the point-load kernel. The polygon is split into signed triangles with
     the point's plan position P as their common apex (one per edge). In polar coordinates (ρ, θ) about P the radial
     integrals are exact:
        ∫₀^ρmax 3z³ρ /(2π(ρ² + z²)^{5/2}) dρ = (1/2π)·(1 − z³/(ρmax² + z²)^{3/2}),
        ∫₀^ρmax 3z³ρ²/(2π(ρ² + z²)^{5/2}) dρ = (z/2π)·ρmax³/(ρmax² + z²)^{3/2},
     so Δσ_z = Σ edges ∫ [ q(P)·(1/2π)(1 − z³/(ρmax² + z²)^{3/2}) + (gx cosθ + gy sinθ)·(z/2π)·ρmax³/(ρmax² + z²)^{3/2} ] dθ,
     ρmax(θ) = the distance from P to the edge along θ. The θ integral is done numerically (adaptive Gauss–Legendre).
     The same routine on a rectangle reproduces the closed forms above (tests: < 1e-6 relative).
   - 2:1 method (GEC 6 Eq. 5-17, Fig. 5-12): the load Q spread over (B + z)(L + z): Δσ_z = Q/((B + z)(L + z)), the AVERAGE
     over that area (with Q = q·B·L: Δσ_z/q = BL/((B + z)(L + z))).

   Units: any consistent set (the tool uses ft and ksf; Q in kip). Stresses come out in the units of q.
   z = 0 (the base itself) is allowed: the value is the surface limit (q at an inside point, the average of the two sides
   on an edge, a quarter at a corner).

   API (window.SharedBoussinesq):
   pointLoad(P, r, z)                   Boussinesq point load.
   cornerFactor(m, n)                   I(m, n), m, n ≥ 0 (Infinity allowed).
   rectTerms(B, L, x, y, z)             {I, terms:[{X, Y, s, m, n, I}]}: the four corner rectangles of point (x, y) (X, Y = the
                                        corner's signed offsets from the point; s = sign); I = Σ s·I_k = Δσ_z/q (uniform q).
   uniformRect(q, B, L, x, y, z)        q · rectTerms(...).I
   linearRectJ(B, L, x, y, z)           {Ju, Jv}
   linearRect(ld, x, y, z)              ld = {B, L, q0, gx, gy}: closed form, full contact. Returns {value, qP, Iu, Ju, Jv}.
   clipContact(B, L, q0, gx, gy)        the part of the rectangle where q0 + gx·x + gy·y ≥ 0 (Sutherland–Hodgman; the same
                                        clipping as Spread Footing's solveBearing contactArea), CCW, [] if none.
   polygonLinear(poly, q0, gx, gy, x, y, z, opt)   numeric over the polygon [[x, y], ...]; opt.tol (default 1e-9).
   stress(ld, x, y, z)                  ld = {B, L, q0, gx, gy, mode: 'full' | 'partial', poly?, qsub?}: the footing's
                                        stress increase. 'full': linearRect (or uniformRect when gx = gy = 0); 'partial':
                                        polygonLinear over ld.poly (or clipContact). qsub: a uniform pressure over the whole
                                        B × L removed (the net basis: q_sur = overburden at the base). Returns {value, gross,
                                        sub, method}.
   twoToOne(Q, B, L, z)                 Q/((B + z)(L + z)).
   querySteps(ld, x, y, z, o)           the worked point query as plain step objects (shared/steps.js fields: id, label, sym,
                                        eq, sub, value, unit, d, ref, note); o = {qRef, basis: 'net' | 'gross', qsur}. */
(function () {
  'use strict';
  const PI = Math.PI;

  function pointLoad(P, r, z) {
    const R2 = r * r + z * z;
    if (!(R2 > 0)) return NaN;
    return 3 * P * z * z * z / (2 * PI * Math.pow(R2, 2.5));
  }

  function cornerFactor(m, n) {
    if (!(m > 0) || !(n > 0)) return 0;
    if (m === Infinity && n === Infinity) return 0.25;
    if (m === Infinity || n === Infinity) {
      // one side infinite (a strip's corner): the limit of I as m (or n) → ∞ = 1/(2π)·[k/(k² + 1) + atan k]
      const k = m === Infinity ? n : m;
      return (1 / (2 * PI)) * (k / (k * k + 1) + Math.atan(k));
    }
    const m2 = m * m, n2 = n * n, V = m2 + n2 + 1, mn = m * n, sV = Math.sqrt(V);
    return (1 / (4 * PI)) * (2 * mn * sV / (V + m2 * n2) * (V + 1) / V + Math.atan2(2 * mn * sV, V - m2 * n2));
  }

  function rectTerms(B, L, x, y, z) {
    const xs = [B / 2 - x, -B / 2 - x], ys = [L / 2 - y, -L / 2 - y];
    // Δσ/q = F(x2, y2) − F(x1, y2) − F(x2, y1) + F(x1, y1),  F(X, Y) = sgn X · sgn Y · I(|X|/z, |Y|/z)
    const sgnPair = [[0, 0, 1], [1, 0, -1], [0, 1, -1], [1, 1, 1]];
    const terms = [];
    let I = 0;
    for (const [i, j, w] of sgnPair) {
      const X = xs[i], Y = ys[j];
      const s = w * Math.sign(X) * Math.sign(Y);
      const a = Math.abs(X), b = Math.abs(Y);
      let m, n, Ik;
      if (z > 0) { m = a / z; n = b / z; Ik = cornerFactor(m, n); }
      else { m = a > 0 ? Infinity : 0; n = b > 0 ? Infinity : 0; Ik = (a > 0 && b > 0) ? 0.25 : 0; }
      terms.push({ X, Y, s, m, n, I: Ik });
      I += s * Ik;
    }
    return { I, terms };
  }

  function uniformRect(q, B, L, x, y, z) { return q * rectTerms(B, L, x, y, z).I; }

  function linearRectJ(B, L, x, y, z) {
    if (!(z > 0)) return { Ju: 0, Jv: 0 };
    const z3 = z * z * z, c = -z3 / (2 * PI);
    const G = (u, v) => c * v / ((u * u + z * z) * Math.sqrt(u * u + v * v + z * z));
    const H = (u, v) => c * u / ((v * v + z * z) * Math.sqrt(u * u + v * v + z * z));
    const u1 = -B / 2 - x, u2 = B / 2 - x, v1 = -L / 2 - y, v2 = L / 2 - y;
    const S = f => f(u2, v2) - f(u1, v2) - f(u2, v1) + f(u1, v1);
    return { Ju: S(G), Jv: S(H) };
  }

  function linearRect(ld, x, y, z) {
    const qP = ld.q0 + (ld.gx || 0) * x + (ld.gy || 0) * y;
    const Iu = rectTerms(ld.B, ld.L, x, y, z).I;
    const J = linearRectJ(ld.B, ld.L, x, y, z);
    return { value: qP * Iu + (ld.gx || 0) * J.Ju + (ld.gy || 0) * J.Jv, qP, Iu, Ju: J.Ju, Jv: J.Jv };
  }

  function clipContact(B, L, q0, gx, gy) {
    const poly = [[-B / 2, -L / 2], [B / 2, -L / 2], [B / 2, L / 2], [-B / 2, L / 2]];
    const f = p => q0 + gx * p[0] + gy * p[1];
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const cur = poly[i], nxt = poly[(i + 1) % poly.length];
      const fc = f(cur), fn = f(nxt);
      if (fc >= 0) out.push(cur);
      if ((fc > 0 && fn < 0) || (fc < 0 && fn > 0)) {
        const t = fc / (fc - fn);
        out.push([cur[0] + t * (nxt[0] - cur[0]), cur[1] + t * (nxt[1] - cur[1])]);
      }
    }
    return out.length < 3 ? [] : out;
  }

  // Gauss–Legendre, 8 points on [-1, 1]
  const GX = [-0.9602898564975363, -0.7966664774136267, -0.5255324099163290, -0.1834346424956498,
    0.1834346424956498, 0.5255324099163290, 0.7966664774136267, 0.9602898564975363];
  const GW = [0.1012285362903763, 0.2223810344533745, 0.3137066458778873, 0.3626837833783620,
    0.3626837833783620, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763];
  function gl8(f, a, b) {
    const h = (b - a) / 2, c = (a + b) / 2;
    let s = 0;
    for (let k = 0; k < 8; k++) s += GW[k] * f(c + h * GX[k]);
    return s * h;
  }
  function adapt(f, a, b, whole, tol, depth) {
    const c = (a + b) / 2, l = gl8(f, a, c), r = gl8(f, c, b);
    if (depth <= 0 || Math.abs(l + r - whole) <= tol) return l + r;
    return adapt(f, a, c, l, tol / 2, depth - 1) + adapt(f, c, b, r, tol / 2, depth - 1);
  }

  function polygonLinear(poly, q0, gx, gy, x, y, z, opt) {
    const o = opt || {};
    if (!poly || poly.length < 3) return 0;
    const qP = q0 + gx * x + gy * y, zz = Math.max(z, 0), z2 = zz * zz, z3 = z2 * zz;
    let scale = 0;
    for (const p of poly) scale = Math.max(scale, Math.abs(p[0] - x), Math.abs(p[1] - y));
    const qs = Math.abs(q0) + (Math.abs(gx) + Math.abs(gy)) * (scale + Math.abs(x) + Math.abs(y)) + 1e-300;
    const tol = (o.tol || 1e-9) * qs;
    let sum = 0;
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], Bv = poly[(i + 1) % poly.length];
      const ax = A[0] - x, ay = A[1] - y, bx = Bv[0] - x, by = Bv[1] - y;
      const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      if (la < 1e-12 * (scale + 1) || lb < 1e-12 * (scale + 1)) continue;   // P at a vertex: the triangle has no area
      const cr = ax * by - ay * bx, dt = ax * bx + ay * by;
      const ex = bx - ax, ey = by - ay, le = Math.hypot(ex, ey);
      if (!(le > 0)) continue;
      const d = Math.abs(cr) / le;                         // distance from P to the edge's line
      if (d < 1e-12 * (scale + 1)) continue;               // P on the edge's line: zero area
      const phi = Math.atan2(cr, dt), th0 = Math.atan2(ay, ax);
      // unit normal of the edge line pointing away from P
      let nx = ey / le, ny = -ex / le;
      if (nx * ax + ny * ay < 0) { nx = -nx; ny = -ny; }
      const F = th => {
        const c = Math.cos(th), s = Math.sin(th);
        const cn = c * nx + s * ny;
        const R = cn > 1e-300 ? d / cn : Infinity;
        let t1, t2;
        if (R === Infinity) { t1 = 1; t2 = 1; }
        else { const R2 = R * R, h = R2 + z2, w = h * Math.sqrt(h); t1 = 1 - z3 / w; t2 = R2 * R / w; }
        return qP * t1 / (2 * PI) + (gx * c + gy * s) * zz * t2 / (2 * PI);
      };
      const n0 = Math.max(1, Math.ceil(Math.abs(phi) / 1.2));
      for (let k = 0; k < n0; k++) {
        const a = th0 + phi * k / n0, b = th0 + phi * (k + 1) / n0;
        sum += adapt(F, a, b, gl8(F, a, b), tol / n0, 40);
      }
    }
    return sum;
  }

  function stress(ld, x, y, z) {
    const gx = ld.gx || 0, gy = ld.gy || 0;
    let gross, method;
    if (ld.mode === 'partial') {
      const poly = ld.poly && ld.poly.length >= 3 ? ld.poly : clipContact(ld.B, ld.L, ld.q0, gx, gy);
      gross = polygonLinear(poly, ld.q0, gx, gy, x, y, z);
      method = 'numeric';
    } else if (gx === 0 && gy === 0) {
      gross = uniformRect(ld.q0, ld.B, ld.L, x, y, z);
      method = 'uniform';
    } else {
      gross = linearRect({ B: ld.B, L: ld.L, q0: ld.q0, gx, gy }, x, y, z).value;
      method = 'linear';
    }
    const sub = ld.qsub ? uniformRect(ld.qsub, ld.B, ld.L, x, y, z) : 0;
    return { value: gross - sub, gross, sub, method };
  }

  function twoToOne(Q, B, L, z) { return Q / ((B + Math.max(z, 0)) * (L + Math.max(z, 0))); }

  /* ---- worked point query (steps) ---- */
  const N = (v, d) => {
    if (typeof v !== 'number' || !isFinite(v)) return v === Infinity ? '\\infty' : '\\text{–}';
    const t = (Math.abs(v) < 0.5 * Math.pow(10, -(d == null ? 3 : d)) ? 0 : v).toFixed(d == null ? 3 : d);
    return t.charAt(0) === '-' ? '\\minus ' + t.slice(1) : t;
  };
  const P = (v, d) => { const t = N(v, d); return t.indexOf('\\minus') === 0 ? '(' + t + ')' : t; };
  function querySteps(ld, x, y, z, o) {
    o = o || {};
    const st = [], add = s => { st.push(s); return s.value; };
    const ref = 'Newmark (1935); FHWA GEC 6 (2002) §5.3.2, Fig. 5-11';
    const gx = ld.gx || 0, gy = ld.gy || 0;
    const T = rectTerms(ld.B, ld.L, x, y, z);
    const r = stress(ld, x, y, z);
    add({ id: 'bq.pt', label: 'Point (from the footing centre, below the base)', sym: '(x,\\,y,\\,z)', eq: '', sub: '',
      value: '(' + N(x, 2) + ', ' + N(y, 2) + ', ' + N(z, 2) + ')', unit: 'ft', d: 2 });
    T.terms.forEach((t, k) => {
      add({ id: 'bq.I' + (k + 1), label: 'Corner rectangle ' + (k + 1) + ': |X| × |Y| = ' + N(Math.abs(t.X), 3) + ' × ' + N(Math.abs(t.Y), 3) + ' ft, sign ' + (t.s > 0 ? '+' : t.s < 0 ? '−' : '0'),
        sym: 'I_{' + (k + 1) + '}', eq: z > 0 ? 'I(m,n),\\; m = \\frac{|X|}{z},\\; n = \\frac{|Y|}{z}' : '\\tfrac{1}{4}\\;(z = 0)',
        sub: z > 0 ? 'm = ' + N(t.m, 3) + ',\\; n = ' + N(t.n, 3) : '', value: t.I, unit: '', d: 4, ref,
        note: 'I(m, n) = 1/(4π)·[2mn√V/(V + m²n²)·(V + 1)/V + atan2(2mn√V, V − m²n²)], V = m² + n² + 1' });
    });
    add({ id: 'bq.Iu', label: 'Uniform-load influence at the point (superposition of the corner rectangles)', sym: 'I_{u}',
      eq: '\\sum s_{k} I_{k}', sub: T.terms.map((t, k) => (k ? (t.s < 0 ? ' \\minus ' : ' + ') : (t.s < 0 ? '\\minus ' : '')) + N(t.I, 4)).join(''),
      value: T.I, unit: '', d: 4, ref: 'superposition, GEC 6 §5.3.2' });
    let gross;
    if (r.method === 'uniform') {
      gross = add({ id: 'bq.g', label: 'Stress increase from the base pressure (uniform)', sym: '\\Delta\\sigma_{z,q}', eq: 'q\\, I_{u}',
        sub: P(ld.q0, 3) + '\\cdot ' + N(T.I, 4), value: r.gross, unit: 'ksf', d: 3 });
    } else if (r.method === 'linear') {
      const L = linearRect({ B: ld.B, L: ld.L, q0: ld.q0, gx, gy }, x, y, z);
      add({ id: 'bq.qP', label: 'Base pressure above the point (pressure plane of the bearing solution)', sym: 'q(x,y)',
        eq: 'q_{0} + g_{x} x + g_{y} y', sub: N(ld.q0, 3) + ' + ' + P(gx, 4) + '\\cdot ' + P(x, 2) + ' + ' + P(gy, 4) + '\\cdot ' + P(y, 2), value: L.qP, unit: 'ksf', d: 3 });
      add({ id: 'bq.J', label: 'First moments of the kernel over the footing (closed form)', sym: 'J_{u},\\; J_{v}',
        eq: '\\sum \\pm \\frac{\\minus z^{3}\\, v}{2\\pi (u^{2}+z^{2})\\sqrt{u^{2}+v^{2}+z^{2}}},\\; \\sum \\pm \\frac{\\minus z^{3}\\, u}{2\\pi (v^{2}+z^{2})\\sqrt{u^{2}+v^{2}+z^{2}}}',
        sub: '', value: N(L.Ju, 4) + ', ' + N(L.Jv, 4), unit: 'ft', d: 4, note: 'u, v measured from the point to the footing corners' });
      gross = add({ id: 'bq.g', label: 'Stress increase from the base pressure (linear, full contact; closed form)', sym: '\\Delta\\sigma_{z,q}',
        eq: 'q(x,y)\\, I_{u} + g_{x} J_{u} + g_{y} J_{v}', sub: P(L.qP, 3) + '\\cdot ' + N(T.I, 4) + ' + ' + P(gx, 4) + '\\cdot ' + P(L.Ju, 4) + ' + ' + P(gy, 4) + '\\cdot ' + P(L.Jv, 4),
        value: r.gross, unit: 'ksf', d: 3, ref: 'Boussinesq point load integrated over the rectangle' });
    } else {
      const qP = ld.q0 + gx * x + gy * y;
      gross = add({ id: 'bq.g', label: 'Stress increase from the base pressure (partial contact: numerical integration over the contact polygon)', sym: '\\Delta\\sigma_{z,q}',
        eq: '\\sum_{edges} \\int \\Big[ \\frac{q_{P}}{2\\pi}\\Big(1 \\minus \\frac{z^{3}}{(\\rho^{2}+z^{2})^{3/2}}\\Big) + \\frac{(g_{x}\\cos\\theta + g_{y}\\sin\\theta)\\, z\\, \\rho^{3}}{2\\pi(\\rho^{2}+z^{2})^{3/2}} \\Big] d\\theta',
        sub: 'q_{P} = ' + P(qP, 3) + ',\\; g_{x} = ' + P(gx, 4) + ',\\; g_{y} = ' + P(gy, 4), value: r.gross, unit: 'ksf', d: 3,
        ref: 'Boussinesq point load integrated over the contact area',
        note: 'ρ(θ) = distance from the point to each edge of the contact polygon; q_P = the pressure plane extended to the point (may be negative outside the contact area)' });
    }
    if (o.basis === 'net') {
      add({ id: 'bq.s', label: 'Overburden removed at the base, over the whole footing (net basis)', sym: '\\Delta\\sigma_{z,sur}', eq: 'q_{sur}\\, I_{u}',
        sub: N(ld.qsub || 0, 3) + '\\cdot ' + N(T.I, 4), value: r.sub, unit: 'ksf', d: 3 });
      add({ id: 'bq.ds', label: 'Net vertical stress increase', sym: '\\Delta\\sigma_{z}', eq: '\\Delta\\sigma_{z,q} \\minus \\Delta\\sigma_{z,sur}',
        sub: N(gross, 3) + ' \\minus ' + N(r.sub, 3), value: r.value, unit: 'ksf', d: 3 });
    } else {
      add({ id: 'bq.ds', label: 'Vertical stress increase (gross basis)', sym: '\\Delta\\sigma_{z}', eq: '\\Delta\\sigma_{z,q}', sub: N(gross, 3), value: r.value, unit: 'ksf', d: 3 });
    }
    if (o.qRef > 0) add({ id: 'bq.rat', label: 'Ratio to the reference pressure', sym: '\\Delta\\sigma_{z}/q_{ref}', eq: '\\frac{\\Delta\\sigma_{z}}{q_{ref}}',
      sub: '\\frac{' + N(r.value, 3) + '}{' + N(o.qRef, 3) + '}', value: r.value / o.qRef, unit: '', d: 3 });
    return { steps: st, result: r, terms: T };
  }

  const api = { pointLoad, cornerFactor, rectTerms, uniformRect, linearRectJ, linearRect, clipContact, polygonLinear, stress, twoToOne, querySteps };
  if (typeof window !== 'undefined') window.SharedBoussinesq = api;
})();
