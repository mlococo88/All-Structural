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

## 2026-11-01 — PR: rpt-lldf (LLRP) — SharedLLDF.steps.other: worked steps of types f, g, b/c, d and slab (new, display only)
### Where
- `shared/lldf.js`, inside the `STEPS` block: new `skewOther`, `otherFinal`, `other(q, geo, sk, md, w)`; exported
  `SharedLLDF.steps.other`. Anchor `/* ---- other cross-section types (added 2026-11-01`.
- Used by lldf.html's Report tab only (the Steel Bridge app does not call it). Every value written is a field of the engine's own
  results (`memberDF` → md.bx, md.sp, md.mc, md.r, md.eM1 …; `skewFactors` → sk.scfM, sk.scfV; md.fV); nothing is computed again.
### Governing provision
- None changed. AASHTO LRFD 10th Ed. (2024) Tables 4.6.2.2.2b-1, 4.6.2.2.2d-1, 4.6.2.2.2e-1, 4.6.2.2.3a-1, 4.6.2.2.3b-1,
  4.6.2.2.3c-1; Eqs. 4.6.2.3-1, 4.6.2.3-2; Art. 3.6.1.4.3b, C3.6.1.1.2 (as the engine and lldf.html's sheet cite them).
### How verified
- No change to any existing output: the Steel Bridge step dump (LLST, 1,920 cases) hashes the same (293fb98c…);
  `node tests/engine/run.mjs lldf loads report steps tex` pass. lldf.html headless checks (fixlog/lldf.md LLRP): every step value of
  types f, g, b/c (incl. S > 18 ft), d and slab equals the app's, 0 KaTeX errors.

## 2026-11-01 — PR: lldf-slab-w (LLSW) — CIP slab equivalent strip: W = physical edge-to-edge width (CALCULATION CHANGE, engineer's decision; was LLRP-O1)
### Where
- `shared/lldf.js`, `memberDF`, the cast-in-place slab branch, anchor `// cast-in-place slab: equivalent strip`.
- Before:
  `const L1=Math.min(p.L,60), W1s=Math.min(geo.roadway,30), W1m=Math.min(geo.roadway,60);`
  `const Es=10+5*Math.sqrt(L1*W1s), Em=Math.min(84+1.44*Math.sqrt(L1*W1m),12*geo.roadway/Math.max(1,geo.NL));`
- After:
  `const L1=Math.min(p.L,60), W1s=Math.min(geo.Wdeck,30), W1m=Math.min(geo.Wdeck,60);`
  `const Es=10+5*Math.sqrt(L1*W1s), Em=Math.min(84+1.44*Math.sqrt(L1*W1m),12*geo.Wdeck/Math.max(1,geo.NL));`
- `SharedLLDF.steps.other` (slab steps): W_1 and the 12W/N_L cap from `geo.Wdeck`; labels and note say W = edge-to-edge width.
- `lldf.html` `memberSteps` (slab): the substituted W_1 is min(W, 30) with W = `geo.Wdeck`; the two-lane step lists W_1, W, N_L.
### Problem
- The strip widths used the clear roadway width (between the railing faces) for W and W_1. Art. 4.6.2.3 defines W as the physical
  edge-to-edge width of the bridge and W_1 as the modified edge-to-edge width (the lesser of the actual width and 30 ft for one lane,
  60 ft for multiple lanes); N_L stays per Art. 3.6.1.1.1 (clear roadway). A wider W gives wider strips and SMALLER distribution
  factors (less conservative than before; it is the code's definition).
### Governing provision
- AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), Art. 4.6.2.3, Eqs. 4.6.2.3-1 and 4.6.2.3-2 (and Art. 3.6.1.1.1 for N_L).
### Check case
- L = 35 ft, three lines at 10 ft, overhangs 4 ft, faces 1.5 ft: W = 28 ft, w = 25 ft, N_L = 2, L_1 = 35 ft.
  - Before (W → w = 25): E_1 = 10 + 5√(35 × 25) = 157.902 in, g_1 = 12/157.902 = 0.07600; E_2 = 84 + 1.44√(35 × 25) = 126.596 in
    (≤ 12 × 25/2 = 150), g_2 = 0.09479; g = 0.0948; fatigue 0.0633.
  - After (W = 28): E_1 = 10 + 5√(35 × 28) = 10 + 5(31.305) = 166.525 in, g_1 = 0.07206; E_2 = 84 + 1.44(31.305) = 129.079 in
    (≤ 12 × 28/2 = 168), g_2 = 0.09297; g = 0.0930 (−1.9 %); fatigue 0.07206/1.2 = 0.0601.
  - Test: `tests/engine/lldf.test.mjs` "LLSW".
### Which outputs change (every consumer of shared/lldf.js)
- Only cross-section type "slab" results. The hash harness (1,592 cases vs lldf.html before the move): the 48 slab cases are the
  only ones that differ (CHANGED = /^slab /, 72 outputs: R and the slab steps); every other output hashes identically.
- `apps/steel-bridge` (type a only): unchanged — the 1,920-case LLDF step dump hashes the same (293fb98c…); `node tests/engine/run.mjs
  lldf loads report` pass.
- `lldf.html`: slab results and steps change (sheet, D11 print, Report tab, the DF hand-off "Send DFs" for a slab bridge); every other
  type identical (headless main vs branch).
- `Prestressed Bridge Design.html`, `index.html`: do not load shared/lldf.js; they receive lldf.html's DFs only through the hand-off,
  so only a slab-bridge hand-off would carry the new values.

## 2026-11-01 — PR: lldf-d-fatigue (LLDF-D) — type (d) exterior web: fatigue moment factor without the 1.2 multiple presence factor (CALCULATION CHANGE, engineer's decision; was LLRP-O2)
### Where
- `shared/lldf.js`, `memberDF`, CIP multicell box (d), exterior web return. Before:
  `fatM:gWe*skew.scfM,fatV:fat(shrExt1),fatNote:"We/14 used directly for fatigue moment (verify)",method:"We/14 + e-factor"};`
  After: `fatM:fat(gWe*skew.scfM),fatV:fat(shrExt1),method:"We/14 + e-factor"};` (`fat(x) = x/1.2`; the "verify" note removed).
- `SharedLLDF.steps.other`: the special fatigue step "W_e/14 used directly" removed; the exterior web uses the common step
  g_fat,M = g_M,1/1.2 (lldf.html's sheet fatigue step shows the same formula automatically).
### Problem
- The fatigue moment factor of a type (d) exterior web kept the multiple presence factor 1.2 embedded in the one-lane value W_e/14,
  unlike every other factor (interior webs, other types). Art. 3.6.1.4.3b: when the approximate distribution factors are used for
  fatigue, the 1.2 is removed. The new value is 1/1.2 = 0.833 of the old (less conservative; code-consistent).
### Governing provision
- AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), Art. 3.6.1.4.3b (and C3.6.1.1.2); Table 4.6.2.2.2d-1 (W_e/14).
### Check case
- 6 webs at 8 ft, overhangs 3 ft, L = 120 ft: W_e = min(3 + 8/2, 8) = 7.0 ft, g = W_e/14 = 0.5000.
  - No skew: fatigue before 0.5000, after 0.5000/1.2 = 0.4167 (test "LLDF-D").
  - Skew 30°: r_M = 1.05 − 0.25 tan 30° = 0.9057; fatigue before 0.5 × 0.9057 = 0.4528, after 0.4528/1.2 = 0.3774. Interior webs
    unchanged (0.2720).
### Which outputs change (every consumer of shared/lldf.js)
- Only the fatigue moment factor of the two exterior webs of a type (d) bridge (and its step). Hash harness: the 48 type (d) cases
  are the only additional ones that differ (CHANGED = /^slab /, /^d sk/; every other output hashes the same).
- `apps/steel-bridge` (type a): unchanged — 1,920-case step dump 293fb98c…; `node tests/engine/run.mjs lldf loads report` pass.
- `lldf.html`: type (d) exterior fatigue g_M on the sheet, D11 print, Report tab and the DF hand-off; other types identical.
- `Prestressed Bridge Design.html`, `index.html`: no shared/lldf.js; only a type (d) hand-off would carry the new value.
