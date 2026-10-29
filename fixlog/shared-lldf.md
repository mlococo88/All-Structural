# Fix log — shared/lldf.js (window.SharedLLDF)

AASHTO LRFD live-load distribution factors (Art. 4.6.2.2, 4.6.2.3), the engine of `lldf.html`. Loaded by: `lldf.html`,
`apps/steel-bridge/index.html` (through the adapter `apps/steel-bridge/engine/lldf.js`).
Tests: `node tests/engine/run.mjs lldf` (hash harness against lldf.html before the move, hand checks), `node tests/engine/lldf-hash.mjs`.

## 2026-10-29 — PR: shared-lldf — created by moving the engine out of lldf.html (refactor, no result change for lldf.html)
### Where
- Moved from `lldf.html` (the inline engine script, anchor `/* ---------- formatting helpers ---------- */`), line for line:
  `multiplePresence`, `RANGES`, `BEAM_SLAB`, `BOX`, `BOXR`, `SPREADR`, `CELLR`, `FAMILY`, `designL`, `spreadDF`, `multicellDF`,
  `geometry`, `memberType`, `memberSpacing`, `girderU`, `skewFactors`, `boxDF`, `empiricalInterior`, `leverContribution`, `truckGap`,
  `leverConfig`, `leverAll`, `leverMulti`, `rigidMethod`, `memberDF`, `inputErrors`, `computeBridge`. Private copies of the page's
  `f1`, `f3` (designL's TeX, memberDF's fatNote). One IIFE, one namespace `window.SharedLLDF`, no DOM.
- The only edits (before → after):
  - `function truckGap(t){ return Math.max(4,(state.truckGaps&&+state.truckGaps[t])||4); }` →
    `function truckGap(p,t){ return Math.max(4,(p.truckGaps&&+p.truckGaps[t])||4); }`; in `leverConfig`
    `gaps.push(truckGap(t))` → `gaps.push(truckGap(p,t))`. lldf.html's `readInputs()` now passes `truckGaps: state.truckGaps`
    (the same array, read at call time as before).
  - `computeBridge`: `return {geo,Kg,skew,members,warnings:bridgeWarnings(p,geo,Kg)};` → `return {geo,Kg,skew,members};`. The
    warnings are page text that read the page's lock state (`BridgeLocks`) and `nFromFc`; `bridgeWarnings` stays in lldf.html and
    the page's `computeBridge` adds them (same object, same key order).
  - Option (apps/steel-bridge): `p.kgSimple` = the simplified K_g terms of Table 4.6.2.2.1-3, type (a) (`KG_SIMPLE = {m: 1.02, c1:
    1.03, v: 0.97}`), in `empiricalInterior(Kg,L,ts,S,simple)` (`kterm`) and `skewFactors` (the K_g terms of c_1 and of the shear
    correction); `memberDF` passes `p.kgSimple`. lldf.html never sets it: `undefined` takes the old branch.
  - Read-only output: `rigidMethod` also returns `ecc` (the lane eccentricities it already computed), for the steel-bridge worked steps.
  - New `momentSkewNoReduction(thA, thB)` = `Math.abs(thA − thB) > 10 + 1e-9`: Art. 4.6.2.2.2e, per span (engineer's decision
    2026-10-29): a span whose two support lines differ by more than 10° gets no moment skew reduction. Used by apps/steel-bridge; not
    called by lldf.html. The one place to change if the rule changes (e.g. to the whole bridge).
  - New `momentSkewNoReductionPier(thPrev, thPier, thNext)`: a pier (negative-moment) region at a support line loses the moment skew
    reduction if either adjacent span's two support lines differ by more than 10° (engineer's decision 2026-10-29); a missing
    neighbour (end support) counts as no span on that side. Used by apps/steel-bridge; not called by lldf.html.
### Governing provision
- None changed. AASHTO LRFD 10th Ed. (2024): Art. 3.6.1.1.1, Table 3.6.1.1.2-1, Art. 4.6.2.2 (Tables 4.6.2.2.1-1 … 4.6.2.2.3c-1,
  Eq. 4.6.2.2.1-1, Eq. C4.6.2.2.2d-1), Art. 4.6.2.3, C3.6.1.1.2 — as lldf.html has them.
### Check case
- lldf.html defaults (type k, AASHTO IV, 5 girders at 9.75 ft, L 120 ft, t_s 8 in, I 260,730 in⁴, A 789 in², e_g 35.5 in, n 1):
  every girder's g_M, g_V, fatigue factors, the lever-rule trials and the KaTeX steps hash the same before and after.
- Steel girder (type a), xsA-like exterior girder (d_e = −2.25 ft, X_ext 19 ft, Σx² 902.5 ft²): rigid one lane
  1.2(1/5 + 19 × 11.75/902.5) = 0.536842; lever one lane 0.331579; fatigue max(…)/1.2 = 0.447368 — same before and after (lldf.html
  already had the floor).
### How verified
- `tests/engine/lldf-hash.mjs` (also run by `tests/engine/lldf.test.mjs`): the page's engine at de72d9e (before the move) and
  shared/lldf.js + the page's remaining code, both in Node vm, on 1,592 cases: lldf.html's defaults, every catalog preset (SECTIONS),
  FHWA-like steel and PSC examples, a grid over types a/e/k (N_b 3–7, S 4–20 ft incl. > 16 ft and unequal bays, overhangs and faces
  giving d_e from −3 to 4.5 ft, skews 0–65° with separate shear skews, truck gaps 4–8 ft, K_g from 2e4 to 9e5 in⁴), roadways around
  the 20–24 ft rule (N_L 1–6), continuous spans (designL regions), types f, g, b/c, d and slab with skews and d_e out of range, the
  n-from-f′c warning and input errors. Outputs hashed (SHA-256 of JSON, exact for numbers): computeBridge (geometry, K_g, skew, every
  member, warnings), leverAll and leverMulti per girder, rigidMethod per side, memberSteps (92,802 KaTeX steps), designL: 11,135
  outputs, all identical (hash a0a3dad5…). `ecc` is left out of the hash (added output). A mutation (truckGap ignoring the gaps) is
  detected.
- One headless load of lldf.html: 0 console errors, the same summary table and steps as before (see fixlog/lldf.md).
### Other copies
- None. GirderDetail ("Steel Bridge Design.html") keeps its own LLDF code (dfMember …), which since #472 follows the same rules.
### Open items
- SLLDF-O1. `bridgeWarnings` stays in lldf.html (page text, lock state). If another tool needs the same warnings, move it with an
  option for the lock state.
