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

## 2026-11-01 — PR: shared-lldf-steps (LLST) — the LLDF worked-step writer moved from the Steel Bridge app into shared/lldf.js (refactor, no result or step change)
### Where
- `shared/lldf.js`: new block `/* ---------- worked steps (SharedLLDF.steps) ---------- */` before `window.SharedLLDF={…}`, exported as
  `SharedLLDF.steps = { ED, geometry, skew, emp, lever, rigid, member, withC }` (one namespace per file kept: a sub-object).
- Moved from `apps/steel-bridge/engine/lldf.js`, line for line: `geometrySteps` → `steps.geometry`, `skewSteps` → `steps.skew`,
  `empSteps` → `steps.emp`, `leverSteps` → `steps.lever`, `rigidSteps` → `steps.rigid`, `member` → `steps.member`, `memberSteps`,
  `extSteps`, `finalSteps` (private), `withC` → `steps.withC`.
- The only edits (before → after):
  - `function geometrySteps(p, geo) { const w = St().work('df.geo'); … return w.steps; }` → `function geometry(w, p, geo) { … }`
    (the caller passes the collector; the adapter keeps `geometrySteps(p, geo)` = `{ const w = St().work('df.geo');
    SS().geometry(w, p, geo); return w.steps; }`).
  - `skewSteps`: `${SIMPLE.c1}`, `${SIMPLE.v}` → `${KG_SIMPLE.c1}`, `${KG_SIMPLE.v}` (the same constants 1.03, 0.97).
  - `function member(p, geo, Kg, sk, j, w) { const q = lp(p), md = SL().memberDF(q, …), … label = 'G' + (j + 1), … n3b = p.Nb === 3 …
    empSteps(w, e, S, p.L, p.ts, Kg, p.simple) … extSteps(w, o, sk, p.Nb)` →
    `function member(q, geo, Kg, sk, j, w, opt) { const md = memberDF(q, …), … label = ((opt && opt.prefix) || 'G') + (j + 1), …
    n3b = q.Nb === 3 … emp(w, e, S, q.L, q.ts, Kg, q.kgSimple) … extSteps(w, o, sk, q.Nb)`. The adapter's `lp(p)` sets
    `L: p.L, ts: p.ts, Nb: p.Nb, kgSimple: !!p.simple`: the same values (`simple` is only tested for truth).
  - `SL().memberDF`, `SL().girderU`, `SL().leverContribution` → the file's own `memberDF`, `girderU`, `leverContribution`.
- `apps/steel-bridge/engine/lldf.js`: the moved bodies replaced by one-line calls (`SS = () => window.SharedLLDF.steps`):
  `geometrySteps`, `skewSteps`, `withC`, `member(p, …) { return SS().member(lp(p), geo, Kg, sk, j, w); }`. Region steps (e_g, K_g,
  K_g,avg, K_g used, g_Δ, the exterior policy step) stay in the adapter (they use the app's plate sections). `window.SBDLldf` keeps
  every export.
### Why
- Coordinator decision 2026-11-01 (Report tab rollout): lldf.html's new Report tab and the Steel Bridge app write the LLDF steps
  with ONE copy of the writer.
### Governing provision
- None changed. AASHTO LRFD 10th Ed. (2024) Art. 3.6.1.1.1, Table 3.6.1.1.2-1, Art. 4.6.2.2 (Tables 4.6.2.2.2b-1 … 4.6.2.2.3c-1,
  Eq. 4.6.2.2.1-1, Eq. C4.6.2.2.2d-1), Art. 3.6.1.4.3b, C3.6.1.1.2 — the refs in the step strings are unchanged.
### Check case
- Steel Bridge `tests/projects/sbd2-loads/xsA_AASHTO.json`, Span 1, G1 (exterior): `df.s0.G1.fatM` = 0.4474 (g_fat,M =
  max(0.3316, 0.5368)(r_M)/1.2), `df.s0.G1.gM`, `df.s0.G1.gV`, every substitution string — identical before and after (see below).
### How verified
- Step dump (scratchpad `rpt/sbdump.mjs`): `SBDLoads.compute` (the loads module, which calls `SBDLldf.compute`: every region,
  girder and worked step) on all 20 `tests/projects/sbd2-loads/*.json` fixtures × 12 geometry variants (as is, N_b = 3, S = 18 ft,
  N_b = 3 with S = 17 ft, skews 45° / 65° / mixed 10–50° / signed ±32–40°, overhangs 7 / 1 ft, unequal bays, N_b = 7) × 8 options
  (K_g max / avg / simple, shear skew exterior only, exterior-not-less-than-interior on / off, truck gap 6 ft) = 1,920 cases,
  2,227,456 steps: the SHA-256 of every case's full output (values and step strings) is identical before and after
  (whole-dump hash 293fb98c…).
- `node tests/engine/run.mjs lldf loads report steps tex` (7 files, 33 passed) and `static paths girderdetail` (3 files, 16 passed).
### Other copies
- None. lldf.html's own in-app steps (`memberSteps`, KaTeX strings) are separate and unchanged; its Report tab (next PR) uses
  `SharedLLDF.steps`.
