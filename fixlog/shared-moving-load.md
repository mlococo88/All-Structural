# Fix log — shared/moving-load.js (window.SharedMovingLoad)

Continuous-beam moving-load engine. Loaded by: `Moving Load Generator.html`.
Tests: `node tests/engine/run.mjs moving-load` (parity with the original page code at b3dbddb).

## 2026-10-29 — PR: pilot-moving-load — created by moving the engine out of Moving Load Generator.html (refactor, no result change)
### Where
- `props(s,dk)`, `luDecomp(A,n)`, `luSolve(A,n,b)`: verbatim copies of the page functions (anchors `function props(s,dk){`, `function luDecomp(A,n){`).
- `analyze(m,opt)`: verbatim copy of the page's `function analyze(m){` body. Only edits (before → after):
  - `function analyze(m){` → `function analyze(m,opt){ opt=opt||{}; const P=opt.vehicles||(window.SharedVehicles?window.SharedVehicles.build().presets:{});`
  - `const Lb=$('aLb')?$('aLb').value:'span';` → `const Lb=opt.Lb!=null?opt.Lb:'span';`
  - `Math.max(1,num('aL',100))` → `Math.max(1,opt.aL!=null?opt.aL:100)`
  - `if(!$('refineChk')||$('refineChk').checked){` → `if(opt.refine!==false){`
- `deflection(R,opt)`: the page's `deflAnalyze()` body; `const R=RES,m=R.m,` → `const m=R.m,` and `const mode=$('dCase').value,DF=num('dDF',1),useIM=$('dIM').checked,` → `const mode=opt.mode,DF=opt.DF,useIM=opt.useIM,`.
- `absScan(R,analyzeFn)`: the page's `absScan(R)` body with `const analyze=analyzeFn||ENGINE_ANALYZE;` added at the top.
### Governing provision
- None changed (AASHTO LRFD 10th Ed. 3.6.1.2/3.6.1.3 HL-93 and the 90 % two-truck case, 3.6.1.4 fatigue, 3.6.2 IM; AASHTO Std. Spec. 17th Ed. 3.7, 3.8; AREMA impact — all as the page had them).
### Check case
- 2 spans 100/120 ft, one plate girder segment (16×1 / 54×0.5625 / 18×1.5 in, composite n 8, b 96, t 8, haunch 2 in), E 29000 ksi, HL-93 truck preset: max +M 2850.258 kip-ft, max −M −2673.561 kip-ft, max |V| 138.148 kips, max R 223.225 kips (per lane, with IM) — same before and after.
### How verified
- 35 cases, full output SHA-256 equal to the original inline functions; 4 cases compared live value by value. Bit-identical. See `fixlog/Moving Load Generator.md`.
### Other copies
- None.
### Open items
- SML-O1. Engine check (`check` HTML): theory values exist for 1–4 equal spans only (`th={1:…,4:…}[ns]`); with 5+ spans `th[0]` throws. Needed before any 5+ span use (PR 3 of the pilot addresses this without changing 1–4 span results, or asks).

## 2026-10-29 — PR: pilot-sbd-engine — any number of spans; staticAnalysis (dead / uniform load) and camber added (functions added; Moving Load Generator results unchanged)
### Where
- `analyze`, engine-check block (anchor `const th={1:[0.125,0.5],2:[-0.125,0.375]`): before `…[ns], L1=m.spans[0];` → after `…[ns]||['n/a','n/a'], L1=m.spans[0];`. With 5+ spans the check text reads "theory: n/a" instead of throwing (closes SML-O1). 1–4 spans: unchanged text. GirderDetail allows any number of spans (`buildModel`: `b.spans.map(num)`, no upper limit), so the shared engine must too.
- New `staticAnalysis(spec)`: the same beam element, stiffness `E*I/144/l³`, segment rule (last segment = remainder, I at the element midpoint) and LU solver as `analyze`; consistent fixed-end forces for uniform loads (as the step solver's `solveOne`), point loads at nodes; outputs M, V just left / right, deflection (in, down +) at stations and support reactions. `simple:true` = independent simple spans.
- New `camber(stages,opt)`: deflection per stage (each a `staticAnalysis` spec with its own EI) and the sum.
### Governing provision
- None changed. Linear elastic beam theory; no load factor, IM or DF is applied inside `staticAnalysis`.
### Check case (tests/engine/static.test.mjs, E 29000 ksi, I 10000 in⁴)
- Simple 100 ft, w 1 klf: M = 1250 kip-ft, R = 50 kips, δ = 5wL⁴/(384EI) = 7.7586 in.
- 5 equal spans 100 ft, w 1 klf: M_B = −2/19 wL² = −1052.63 kip-ft, M_C = −3/38 wL² = −789.47 kip-ft, R_A = 15/38 wL = 39.474 kips.
- Results agree with the closed forms within 1e-7 relative (round-off of the unpivoted dense LU).
### How verified
- `node tests/engine/run.mjs`: 14 tests pass; the 35 Moving Load Generator cases still hash identically to the original page (no result change).
- Against GirderDetail's own engine (`sgBeam`/`sgLLRow`/`feIM`, taken from Steel Bridge Design.html into a vm; `tests/engine/girderdetail.test.mjs`), same spans and EI from the payloads gd_builtin_AASHTO_G1/G2/G3, gd_xsA_AASHTO_G2, gd_curb_AASHTO_G1 (3 spans 110/140/110, 9 plate zones):
  - moment influence lines at all GirderDetail nodes (359 sections × 361 load points): max |diff| 4e-8 ft (round-off; GirderDetail's penalty supports);
  - dead load with GirderDetail's nodal loads w·trib: max |ΔM| 5e-7 kip-ft, |ΔR| 3e-8 kips (round-off);
  - uniform DC1 (exact here, lumped in GirderDetail): max |ΔM| 0.14 kip-ft (0.006 %), pier M −2397.39 vs −2397.25 kip-ft (G2), |ΔR| ≤ 0.0013 kips; deflection max 0.0033 in of 1.60 in (0.21 %, GirderDetail integrates M·m/EI by the nodal rule);
  - HL-93 per lane with IM 33 %: +M within 0.10 kip-ft, −M within 0.23 kip-ft (0.01 %), V within 0.005 kips. Causes: lane load integrated over the linearly interpolated IL (shared) vs nodal trib lumping (GirderDetail); truck positions refined to 0.1 ft with 0.5 ft spacing steps (shared) vs the 1-ft grid and integer spacings (GirderDetail); mesh 1.5 ft vs 1 ft.
### Other copies
- None. GirderDetail keeps its own engine; nothing in Steel Bridge Design.html was changed.
### Open items
- SML-O2. `analyze` has no simple-span (non-continuous) mode; `staticAnalysis` has one. Needed before Steel Bridge's simple-span projects use the shared LL envelopes.
- SML-O3. GirderDetail's cracked-section zones, staged EI and cross-frame point loads are inputs the caller builds (EI per segment, point loads); the shared engine does not derive them.
