# Fix log — shared/abutment-def.js (window.SharedAbutmentDef)

Loaded by: `Bridge Substructure Loading.html`, `abutment_calculator.html` (see `shared/README.md`). Spec: `HANDOFF.md` §4.5 (definition block)
and §4.15 (abutmentDef). Tests: `node tests/engine/run.mjs abutment-def` (Node).

## 2026-11-11 — PR: claude/abx-a (PR #1405: https://github.com/mlococo88/All-Structural/pull/1405) — created (new file): the abutment definition exchanged by the two tools (ABX, PR A)   [no calculation; storage: new optional fields only]
- **Why:** engineer request (2026-11-11): "The abutment app and substructure loading app should talk with each other more … pull an abutment
  from the abutment app into the substructure loading app and vice versa … make sure they all agree or have the same general input." The
  mapping is used in both directions, so it lives once here (CLAUDE.md §3) with Node tests.
- **What:** classic script, IIFE, one namespace, no DOM, no calculation. `fromSubLoads(x)` (anchor `function fromSubLoads(x)`), `fromLoads(a, p)`
  (older abutmentLoads payloads), `fromAbutment(S, ctx)`, `validate(def)` (geometry errors refuse; a bad optional group is disabled with its
  reason), `checkPayload(p)` (§4.15 envelope: units, conventional type, content hash), `toAbutment(def, ctx)` and `toSubLoads(def, ctx)`
  (items `{ path, val, lbl }` per group), `rows(items, get)` (current vs incoming), `summary(p)`, `hash(def)`. Format in the file header.
- **Governing provision:** none: input mapping only. Mapping relations used (all geometric): heel = W − toe − t_stem (SubLoads) and
  W = toe + t_bot + heel (calculator); stem height = seat − top of footing; backwall height = top of backwall − seat; bearing setback =
  t_top − a_f − t_bw; D_f = ground − bottom of footing; approach-slab share = R_DC / (w_c·t·W·L) × 100.
- **Check case:** SubLoads default Abut. 1: stem H = 117.991 − 108 = 9.991 ft, backwall h = 125 − 117.991 = 7.009 ft, heel = 14 − 4 − 4 = 6 ft,
  D_f = 112 − 105 = 7 ft, setback = 4 − 1.75 − 1.5 = 0.75 ft; round trip SubLoads → calculator (default project, default ticks) → SubLoads
  (default ticks) leaves every SubLoads input as it was (L_ab, L_ftg and soil height stay blank = auto). Calculator slab with a square far end,
  W 44, L 16, L̄ 18 ft: share = 18/32 = 56.25 %.
- **How verified:** `node tests/engine/run.mjs abutment-def` (8 tests).
- **Other copies:** none.
