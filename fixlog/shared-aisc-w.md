# Fix log — shared/aisc-w.js (window.SharedAiscW)

## 2026-11-23 — new shared data file: the AISC W shapes (PR: claude/sb-rolled-beam)
### Where
- New file `shared/aisc-w.js` (classic script, one namespace `window.SharedAiscW`, no DOM, data and lookups only).
  - `ROWS` / `COLS`: the 289 W shapes of the AISC Shapes Database v16.0, columns `name, W (lb/ft), A, d, bf, tf, tw, kdes, Ix, Zx, Sx, Iy, ry, J`
    (in units). The rows are the W table of `Steel Beam Design - AISC 15th.html` (`DB.W`, `DBVER` "AISC Shapes Database v16.0"), the same
    values in the same order (columns `lbl, Wt, A, d, bf, tf, tw, kdes, Ix, Zx, Sx, Iy, ry, J` of its `DBKEYS.I`).
  - `get(name)` (any spelling: "w 36 x 135" → W36X135; null when not in the table), `names()`, `groups()` (by nominal depth, table order),
    `nominal(name)`, `key(name)`, `VERSION`.
- New test `tests/engine/aisc-w.test.mjs`. `shared/README.md`: row added.
- Loaded by: `apps/steel-bridge/index.html` only (rolled-beam girder segments, `apps/steel-bridge/engine/rolled.js`).
### Problem
- None (new file). Steel Bridge Design needed the W shapes for rolled-beam girders; its own list (engine/crossframes.js `CF_DIA`, 8 shapes
  with d, b_f, t_f, t_w for the diaphragms) has no A, I_x, weight or k. The repo's full table sits inside `Steel Beam Design - AISC 15th.html`
  (and `Section Property Calculator.html`), single-file tools.
### Governing provision
- None (data). Source: AISC Shapes Database v16.0, as already carried by `Steel Beam Design - AISC 15th.html`. No value was typed from memory.
### Check case (in the test file)
- W36X135: W 135, A 39.9, d 35.6, b_f 12.0, t_f 0.790, t_w 0.600, k_des 1.54, I_x 7800, S_x 439, Z_x 509 (AISC Manual Table 1-1).
  Three plates: 2(12)(0.79) + (35.6 − 1.58)(0.6) = 39.372 in² (98.7 % of A). With the four fillets, r = k_des − t_f = 0.75 in:
  39.372 + 4(1 − π/4)(0.75)² = 39.855 in² (99.9 % of A).
- Every shape: plates plus fillets within 1.0 % of A and 1.2 % of I_x (largest found 0.73 %, 0.97 %); S_x within 1.2 % of 2 I_x/d;
  W within 1.6 % of A × 490/144; three plates alone A_3/A 0.9728 to 1.0052, I_3/I_x 0.9593 to 1.0071.
### How verified
- `node tests/engine/run.mjs aisc-w`: 4 tests (289 shapes, unique names, lookup, groups; value-for-value equality with the W table read
  from `Steel Beam Design - AISC 15th.html` at test time; the cross-check above on every row; the hand case).
### Other copies
- `Steel Beam Design - AISC 15th.html` (`DB.W`) and `Section Property Calculator.html` (`DB.W`) keep their own copies of the table
  (not moved: CLAUDE.md §3, planned work). A change to the W rows of Steel Beam Design without this file fails the test.
  `apps/steel-bridge/engine/crossframes.js` `CF_DIA` (8 diaphragm shapes) is unchanged.
### Open items
- The table has 289 W shapes; small shapes (W4 to W10) are offered to the bridge girder picker too (no lower limit applied).
