# Fix log — shared/pile-group.js (window.SharedPileGroup)

## 2026-11-07 — PR: claude/rw-pile-8a-shared — new shared file: rigid-cap pile-group statics (discrete group and rows per ft of wall)
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
