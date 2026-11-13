# Fix log — shared/aisc-hss.js (window.SharedAiscHss)

## 2026-11-13 — new shared file: rectangular / square HSS member strength, AISC 360-16 LRFD
### Where
- New file `shared/aisc-hss.js` (classic script, one namespace `window.SharedAiscHss`, no DOM). Units in, kip, ksi, kip-in.
  - `rows` / `find(name)` / `section(name, grade)`: the AISC Shapes Database v15.0 rectangular HSS table (525 shapes, the same values as
    the `HSSR` table of `Steel Beam Design - AISC 15th.html`); `find` takes "HSS6X6X1/4" or "HSS6X6X.250". `grades`: A500 Gr. C
    (Fy 50, Fu 62), A500 Gr. B (46, 58), A1085 (50, 65, nominal wall). Flat widths b = B − 3t, h = H − 3t (B4.1b(d)).
  - `classify` (Table B4.1b cases 17, 19; Table B4.1a case 6), `tension` (D2), `compression` (E3, E7 with Table E7.1 case (b)),
    `flexure` (F7-1 yielding, F7-2/F7-3 FLB, F7-6 WLB, F7-10/F7-11 LTB about the major axis of a rectangular HSS), `shear` (G4, k_v = 5,
    C_v2 per G2-9 to G2-11), `torsion` (H3.1(b), h = flat width of the longer side).
  - `capacities(p, {Lcx, Lcy, Lb, Cb, An, U})`, `ratios(cap, {P, Mx, My, Vx, Vy, T})`: H1-1a/H1-1b (H1.1); H3-6 when T_r > 0.2T_c
    (H3.2), with both flexure terms and the larger shear ratio.
  - `capSteps`, `demandSteps`: the worked steps (shared/steps.js format).
- New tests `tests/engine/aisc-hss.test.mjs`. `shared/README.md`: row added.
- Loaded by the Steel Canopy Designer (separate repository, embedded by its tools/sync-bpad.py). The same formulas stay in
  `Steel Beam Design - AISC 15th.html` (not moved: CLAUDE.md §3); the test reads that file's functions and compares them.
### Problem
- None (new code). The Steel Canopy Designer's Member Design tab checks its HSS members against AISC 360-16 (engineer's request 2026-11-13).
### Governing provision
- AISC 360-16 Chapters B (B4.1), D (D2), E (E2, E3, E7), F (F1, F7), G (G2.2, G4), H (H1.1, H3.1, H3.2). LRFD φ = 0.90 (φ_t yield, φ_c, φ_b,
  φ_v, φ_T), 0.75 (φ_t rupture).
### Decisions stated in the tool (CLAUDE.md §6)
- A_e = A_g (welded ends, no holes, U = 1.0) unless A_n, U are given.
- Square HSS: no lateral-torsional buckling (F7.4 User Note). Steel Beam Design runs F7.4 for square HSS too; for a square HSS with
  L_b > L_p the two differ. Raised, not changed.
- Biaxial bending with torsion in H3-6: both flexure ratios summed, the larger of the two shear ratios.
### Check case (in the test file)
- HSS6X6X1/4, A500 Gr. C: b = 6 − 3(0.233) = 5.301 in, b/t = 22.75 ≤ 1.12√(E/Fy) = 26.97 (compact).
  φM_n = 0.9(50)(11.2)/12 = 42.0 kip-ft (Manual Table 3-13: 42.0). φV_n = 0.9(0.6)(50)(2)(5.301)(0.233) = 66.70 kip.
  L_c = 10 ft: L_c/r = 51.28, F_e = 108.8 ksi, F_cr = 0.658^(50/108.8)(50) = 41.25 ksi, φP_n = 0.9(41.25)(5.24) = 194.6 kip (Manual Table 4-4: 195).
  φT_n = 0.9(0.6·50)(15.4)/12 = 34.65 kip-ft. φP_n (tension) = min(0.9·50·5.24, 0.75·62·5.24) = 235.8 kip.
- HSS8X8X3/16: slender walls (b/t 42.98 > 33.72): E7-3 b_e = 6.183 in at F_cr = F_y; F7-3 governs flexure.
### How verified
- `node tests/engine/run.mjs aisc-hss`: 7 tests pass, including all 525 shapes × A500 Gr. C and B × 5 lengths against Steel Beam Design's
  own functions (read from the file at test time): φP_n, φM_nx, φM_ny, φV_n both axes, φP_n tension, φT_n identical (relative 1e-12).
- Every step string parses in KaTeX 0.16.9 (strict).
