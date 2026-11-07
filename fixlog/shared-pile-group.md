# Fix log — shared/pile-group.js (window.SharedPileGroup)

## 2026-11-07 — PR #955: https://github.com/mlococo88/All-Structural/pull/955 (claude/rw-pile-8a-shared) — new shared file: rigid-cap pile-group statics (discrete group and rows per ft of wall)
### Where
- New file `shared/pile-group.js` (classic script, one namespace `window.SharedPileGroup`, no DOM). Functions:
  - `reaction(V, My, Mx, xi, yi, pi)`: the rigid-cap load on one vertical pile, general biaxial form with Σx'y'. Same expression and
    operation order as the abutment calculator's `pileReaction` (abutment_calculator.html, anchor `function pileReaction(V,My,Mx,xi,yi,pi){`, ABPX2).
  - `groupProps(piles)`: n, centroid, Σx'², Σy'², Σx'y' of a discrete group (the abutment's C-8 lines, anchor `const Sxy=act.reduce`).
  - `rowGroup(rows)`: rows of piles along a wall, per ft: n_i = 1/s_i, N = Σn_i, x̄ = Σn_i·x_i/N, I = Σn_i·(x_i − x̄)².
  - `rowLoads(g, V, M, H)`: per row, P = V/N + M·x'/I per pile, q = n·P per ft, h = H/N per pile; uplift and one-row (I = 0) flags.
  - `momentAbout(V, xR, xbar)` = V·(x_R − x̄).
- New tests `tests/engine/pile-group.test.mjs`. `shared/README.md`: row added.
- Not loaded by any tool yet. The Retaining Wall Designer loads it from Phase 8b/8c; the abutment calculator moves onto it in a later
  planned PR (review Phase 8, PR 8h). Until then the rigid-cap formula exists in both `abutment_calculator.html` and this file (CLAUDE.md §3).
### Problem
- None (new code). Retaining Wall Designer Phase 8 (pile-supported footing) needs the abutment's rigid-cap distribution reduced to a
  per-unit-length wall with rows of piles; the engineer decided (2026-11-07, review Q17) to put it in `shared/` now.
### Governing provision
- Statics of a rigid cap on identical vertical piles with pinned heads (the elastic rigid-cap distribution; AASHTO LRFD 10th Ed. (2024)
  Art. 10.7 has no closed-form provision for it). No resistance, factor or code check is in this file.
### Check case (all in the test file)
- 2 rows at x = 1.5 ft (toe) and 8.5 ft (heel), s = 6 ft: N = 2/6 = 0.33333 /ft, x̄ = 5.0 ft, I = 2(1/6)(3.5²) = 4.08333 ft²/ft.
  V = 20 kip/ft at x_R = 4.0 ft: M = 20(4.0 − 5.0) = −20 kip-ft/ft. P_toe = 20/0.33333 + (−20)(−3.5)/4.08333 = 60 + 17.143 = 77.143 kip;
  P_heel = 60 − 17.143 = 42.857 kip. Line loads 77.143/6 = 12.857 and 7.143 kip/ft (sum 20 = V; Σq·x = 80 = V·x_R). H = 6 kip/ft → 18 kip per pile.
- 3 rows x = 1, 5, 9 ft, s = 4, 8, 8 ft: N = 0.5, x̄ = 4.0, I = 5.5; V = 10, M = +11 → P = 20 + 2x' = 14, 22, 30 kip.
### How verified
- `node tests/engine/run.mjs pile-group`: 6 tests pass, including
  - `reaction()` vs the abutment's `pileReaction` read from abutment_calculator.html at test time: bit-identical (Object.is) on 2000
    random inputs with Σx'y' = 0 and ≠ 0, zero Σx'² or Σy'²;
  - `groupProps()` vs the abutment's C-8 lines (read from the file): identical for a 3 × 5 grid and the grid with one pile omitted;
  - rows per ft vs the discrete group over a 48-ft wall (piles of each row placed symmetrically, Σx'y' = 0): equal within 1e-9 relative.
- `node tests/engine/run.mjs` (all) and `node tests/check-syntax.mjs`.
### Other copies
- `abutment_calculator.html` `pileReaction` and the C-8 group-property lines (to be replaced by this file in PR 8h).
### Open items
- None.

## 2026-11-07 — PR: claude/abut-shared-pile-group — 8h: the abutment calculator now loads this file (no change to the file)
- `abutment_calculator.html` `pileReaction` calls `SharedPileGroup.reaction`, and its C-8 group properties come from `SharedPileGroup.groupProps`. Consumers: Retaining Wall Designer, abutment calculator.
- Proof: tests/engine/pile-group.test.mjs (the abutment's former code frozen in the test, bit-identical on 2000 random inputs; the file delegates) and tests/smoke/abutment-pile-group-parity.mjs (main vs branch LAST_R identical on 14 cases). See fixlog/abutment_calculator.md.

## 2026-11-07 — PR: claude/pile-group-one-row — PG1: a moment the pile group has no lever arm for is flagged, not dropped (calculation change for those layouts only)
### Where / before / after
```diff
-      (a zero Sxx or Syy drops that term). pi = {n, Sxx, Syy, Sxy}. Same expression and operation order as the abutment
+      (a zero Sxx or Syy with a non-zero moment about that axis gives NaN since PG1, 2026-11-07: unresisted(V, My, Mx, pi) names the moment; a zero Sxx or Syy with no moment drops the term). pi = {n, Sxx, Syy, Sxy}. Same expression and operation order as the abutment
+  /* PG1 (2026-11-07): a moment about an axis the group has no lever arm for (Σx'² = 0 with M_y ≠ 0: one row of piles in the
+     moment direction; or Σy'² = 0 with M_x ≠ 0) cannot be resisted by vertical piles on a pinned-head rigid cap. Before, that term
+     was dropped (every pile got V/n plus the other term); now reaction() returns NaN for it and unresisted() says which moment.
+     |M| ≤ 1e-6·max(1, |V|) counts as zero (round-off). Any layout with Σx'² > 0 and Σy'² > 0 is evaluated exactly as before. */
+  function unresisted(V, My, Mx, pi) {
+    const Sxx = pi.Sxx, Syy = pi.Syy, Sxy = pi.Sxy || 0, D = Sxx * Syy - Sxy * Sxy, tol = 1e-6 * Math.max(1, Math.abs(+V || 0));
+    if (Math.abs(Sxy) > 1e-9 * Math.max(1, Sxx + Syy) && D > 1e-9) return null;
+    if (!(Sxx > 1e-9) && Math.abs(My) > tol) return { axis: 'y', M: My, S: 'Sxx' };
+    if (!(Syy > 1e-9) && Math.abs(Mx) > tol) return { axis: 'x', M: Mx, S: 'Syy' };
+    return null;
+  }
+    if (unresisted(V, My, Mx, pi)) return NaN;   // PG1: no silent drop of an unresisted moment
-  window.SharedPileGroup = { reaction, groupProps, rowGroup, rowLoads, momentAbout };
+  window.SharedPileGroup = { reaction, unresisted, groupProps, rowGroup, rowLoads, momentAbout };
```
### Problem
- `reaction()` dropped the M_y term when Σx'² = 0 (one pile row in the moment direction) and the M_x term when Σy'² = 0: every pile got V/n, the overturning moment silently ignored (unconservative: such a group cannot resist the moment on pinned-head vertical piles). Found by the abutment review.
- Now `unresisted(V, My, Mx, pi)` returns {axis, M, S} for such a moment (|M| > 1e-6·max(1, |V|)) and `reaction()` returns NaN for it. Any layout with Σx'² > 0 and Σy'² > 0, or a zero sum with no moment about that axis, is evaluated by the same expression as before.
### Governing provision
- Statics of a rigid cap on vertical pinned-head piles (no code provision changed). AASHTO LRFD 10th Ed. Art. 10.7 has no closed form; the group needs a lever arm to resist a moment.
### Check case
- Abutment default, pile branch, one row (8 piles, Σx'² = 0): before, P = V/n = 386.17 kip on every pile with M_y = −2980.4 kip-ft (Strength I, governing pile case) ignored; after: input error "a single pile row … cannot resist the overturning moment M_y = −5,410.12 kip-ft (largest; Strength I …)", no pile results.
- Retaining Wall Designer: no change. Its pile mode needs 2 to 4 rows at different x (input error otherwise) and `rowLoads` already flagged a one-row group (`unstable`, P = NaN, rwPileAnalysis error "the rows must be at two or more different positions").
### How verified
- tests/engine/pile-group.test.mjs: new PG1 tests (flag, NaN, round-off tolerance, Σy'² = 0, rows per ft); 2000 random layouts with Σx'² > 0 and Σy'² > 0 bit-identical to the former code; in the existing random test the cases with a zero sum and a moment are the only ones that change (NaN where the former code dropped the term).
- tests/smoke/abutment-pile-group-parity.mjs (main vs branch, LAST_R JSON, 14 layouts with Σx'² > 0): identical.
- Consumers (CLAUDE.md §3): abutment_calculator.html, Retaining Wall Designer.html — retaining-wall-checks, project-library (abutment, retwall, pile), check-syntax, engine pile-group / handoffs.
