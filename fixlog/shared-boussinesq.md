# Fix log — shared/boussinesq.js (window.SharedBoussinesq)

## 2026-11-14 — PR: claude/sf-boussinesq (PR #1534: https://github.com/mlococo88/All-Structural/pull/1534) (SFBQ-1) — new shared file: vertical stress increase below a footing (Boussinesq, Newmark, 2:1)   [NEW CALCULATION; no tool loads it yet; no existing result changes]
### Where
- New file `shared/boussinesq.js` (classic script, one namespace `window.SharedBoussinesq`, no DOM). Functions:
  - `pointLoad(P, r, z)` = 3Pz³/(2πR⁵), R = √(r² + z²).
  - `cornerFactor(m, n)`: Newmark's influence factor under the corner of a uniformly loaded rectangle, m = a/z, n = b/z,
    V = m² + n² + 1: I = 1/(4π)·[2mn√V/(V + m²n²)·(V + 1)/V + atan2(2mn√V, V − m²n²)]. `atan2` keeps the angle in [0, π]
    (the chart form's "+π when m²n² > V"). One side infinite (strip corner): 1/(2π)·[k/(k² + 1) + atan k].
  - `rectTerms(B, L, x, y, z)`, `uniformRect(q, B, L, x, y, z)`: any point (x, y) from the footing centre (x along B, y along L), inside or
    outside, as four signed corner rectangles: Δσ/q = F(x₂, y₂) − F(x₁, y₂) − F(x₂, y₁) + F(x₁, y₁), F(X, Y) = sgn X·sgn Y·I(|X|/z, |Y|/z),
    x₁,₂ = ∓B/2 − x, y₁,₂ = ∓L/2 − y. z = 0 gives the surface limit (q inside, q/2 on an edge, q/4 at a corner).
  - `linearRectJ`, `linearRect(ld, x, y, z)`: a linear pressure q0 + gx·ξ + gy·η over the whole rectangle (rigid footing, full contact),
    closed form: Δσ = q(x, y)·I_u + gx·J_u + gy·J_v with J_u = Σ± G(u, v), G = −(z³/2π)·v/((u² + z²)√(u² + v² + z²)), J_v the same with
    u ↔ v (u, v from the point to the corners). Derived by integrating the point-load kernel u·K exactly (∂²G/∂u∂v = u·K).
  - `clipContact(B, L, q0, gx, gy)`: the contact polygon (q ≥ 0), the same Sutherland–Hodgman clipping as Spread Footing's
    `solveBearing` (`contactArea`).
  - `polygonLinear(poly, q0, gx, gy, x, y, z, opt)`: numerical integration of the point-load kernel over any polygon with a linear
    pressure: signed triangles from the point's plan position, the radial integrals exact, the angle integral by adaptive 8-point
    Gauss–Legendre (tolerance 1e-9·q by default).
  - `stress(ld, x, y, z)`: the footing's Δσ_z for {B, L, q0, gx, gy, mode 'full' | 'partial', poly, qsub}: 'full' → `uniformRect` /
    `linearRect`; 'partial' → `polygonLinear` over the contact polygon; `qsub` (net basis) = a uniform pressure over the whole B × L removed.
  - `twoToOne(Q, B, L, z)` = Q/((B + z)(L + z)).
  - `querySteps(ld, x, y, z, o)`: the worked point query as shared/steps.js step objects (ids `bq.*`).
- New tests `tests/engine/boussinesq.test.mjs` (13 tests). `shared/README.md`: row added.
- Not loaded by any tool yet: Spread Footing loads it in the next PR (SFBQ-2).
### Problem
- None (new code). Engineer request (2026-11-14): a Boussinesq-type pressure contour diagram in Spread Footing "so we can calculate the stress in the soil at any distance below the footing".
### Governing provision / references
- Boussinesq (1885) point load; Newmark (1935) closed form for the rectangle corner (charted as f(m, n) "from Newmark (1942)" in
  FHWA GEC 6, *Shallow Foundations*, FHWA-IF-02-054 (2002), §5.3.2, Fig. 5-11; the superposition for points inside / outside is the
  text under §5.3.2).
- 2:1 method: GEC 6 Eq. 5-17 (Δσ_v/q = B_f·L_f/((B_f + Z)(L_f + Z))), Fig. 5-12, Fig. 5-13 (comparison with elastic theory, square).
- AASHTO LRFD 10th Ed. (2024) Art. 10.6.2.4.1 and Fig. 10.6.2.4.1-1 (Boussinesq vertical stress contours, continuous and square footings,
  after Sowers 1979): the isobars used as a check.
- Verified in `/home/user/structural_references` (rendered pages): GEC 6 p. 77 (Fig. 5-11), pp. 78–79 (Eq. 5-17, Figs. 5-12, 5-13);
  AASHTO LRFD 10th p. 10-56 (Fig. 10.6.2.4.1-1). **Not verified** (not in the references folder): the closed-form expression of
  I(m, n) itself (Newmark 1935; also in Das, Poulos & Davis 1974, NAVFAC DM-7.01), and the point-load equation (Boussinesq 1885).
  They are checked here instead by (1) the GEC 6 chart readings, (2) the AASHTO isobars, (3) an independent brute-force sum of
  point loads over the footing (midpoint rule, 300 × 300) and (4) the far-field limit.
- No code provision is changed: no tool uses this file yet.
### Check cases (all in the test file)
- **Square B = L = 10 ft, uniform q = 3 ksf (net):**
  - Centre, z = 5 ft: four 5 × 5 corner rectangles, m = n = 1, I = 0.17522 → Δσ = 4·0.17522·3 = **2.103 ksf** (0.701q). 2:1: 300/(15·15) = 1.333 ksf.
  - Centre, z = 10 ft: m = n = 0.5, I = 0.08403 → **1.008 ksf** (0.336q). 2:1: 300/(20·20) = 0.750 ksf.
  - Centre, z = 20 ft: m = n = 0.25, I = 0.02702 → **0.324 ksf** (0.108q). 2:1: 300/(30·30) = 0.333 ksf.
  - Corner, z = 10 ft: one 10 × 10 rectangle, m = n = 1, I = 0.17522 → **0.526 ksf** (the other three terms have X or Y = 0).
- **Eccentric, full contact:** 10 × 10 ft, P = 300 kip, e_x = 1 ft (6e/B = 0.6 ≤ 1): q = 3 ± 1.8 ksf (1.2 to 4.8), q0 = 3, gx = 12Pe/(LB³) = 0.36 ksf/ft.
  - Below the high edge (x = 5, y = 0), z = 5 ft: q(5, 0) = 4.8 ksf; I_u = 2·I(2, 1) = 2·0.19994 = 0.39988;
    J_u = G(0, 5) − G(−10, 5) − G(0, −5) + G(−10, −5), G = −(125/2π)·v/((u² + 25)√(u² + v² + 25)): G(0, 5) = −0.5627, G(−10, 5) = −0.0650 →
    J_u = −0.9954 ft; Δσ = 4.8·0.39988 + 0.36·(−0.9954) = 1.9194 − 0.3584 = **1.561 ksf** (uniform 3 ksf at the same point: 1.200 ksf).
  - Below the centre: J_u = 0 → 2.103 ksf at z = 5 ft (as uniform). Below the low edge (x = −5), z = 5: 0.838 ksf.
- **Eccentric, partial contact (triangular):** 10 × 10 ft, P = 300 kip, e_x = 2.5 ft: contact 3(B/2 − e) = 7.5 ft, q_max = 2P/(3(B/2 − e)L) = 8 ksf.
  The numeric integration over the clipped area equals the closed form on the 7.5 × 10 ft contact rectangle (centre x = 1.25 ft) to 1e-6:
  Δσ(5, 0, 5) = 2.151 ksf, Δσ(1.25, 0, 5) = 2.476 ksf, Δσ(0, 0, 10) = 0.987 ksf, Δσ(−5, 0, 5) = 0.341 ksf.
### How verified
- `node tests/engine/run.mjs boussinesq tex`: 29 pass (the 13 new) — chart readings (GEC 6 Fig. 5-11, ±0.002), the hand checks above, AASHTO Fig. 10.6.2.4.1-1(b)
  (0.2q and 0.1q isobars cross the centreline at 1.1–1.5B and 1.9–2.3B), symmetry, superposition (two halves = whole, closed form and numeric),
  numeric vs closed form on 420 points incl. z = 0, points on edges, outside and deep (worst 1e-6·q; the < 0.5 % criterion is met by a wide margin),
  brute-force point-load sums (< 0.5 %), far field (z = 200B: the point-load value of the total load, < 0.1 %), partial contact = closed form
  on the contact rectangle, Spread Footing's own `solveBearing` (read from the tool at test time): same contact polygon, far field = P
  (statics), brute force on a biaxial partial-contact case (< 0.5 %), and `querySteps` through `SharedSteps.step` (TeX checked by tex.test.mjs).
- `node tests/engine/run.mjs` (all) and `node tests/check-syntax.mjs`.
### Decisions (pending engineer review)
1. **Coordinates:** footing centre at the origin, x along B, y along L, z down from the base; the same axes as Spread Footing's bearing solver.
2. **Net basis:** the overburden removed is taken as a uniform pressure q_sur over the whole B × L (the excavated footprint), so
   Δσ_net = Δσ(q) − q_sur·I_u. Where q < q_sur (a lightly loaded or partly lifted footing) the net increase can be negative (unloading).
3. **Partial contact:** the pressure is the tool's no-tension plane, q = max(0, q0 + gx x + gy y), over the contact polygon only.
4. **2:1** is the average over (B + z)(L + z) (GEC 6 Eq. 5-17); it is not a point value.
### Other copies
- None.
### Open items
- None.
