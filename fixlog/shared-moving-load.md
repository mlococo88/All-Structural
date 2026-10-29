# Fix log — shared/moving-load.js (window.SharedMovingLoad)

Continuous-beam moving-load engine. Loaded by: `Moving Load Generator.html`, `apps/steel-bridge/index.html` (from 2026-10-29).
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

## 2026-10-29 — PR: moving-load-simple-span — simple-span mode for the LL envelopes (`m.simple`; option added, existing results unchanged)
### Where
- `analyze(m,opt)`. New model flag `m.simple` (true = independent simple spans). Absent or false: every edited line takes its old branch, so the arithmetic is the same as before.
  - Before `// Global stiffness (v up, θ CCW), EI in kip-ft²`, added: `const hng=new Uint8Array(Math.max(0,nn-1)); if(m.simple&&ns>1)for(let q=1;q<ns;q++)hng[idxOf(sup[q])]=1;`. This marks the element that starts at each interior support.
  - Element matrix: before `const M=[[12,6*l,-12,6*l],…]`; after `const M=hng[e]?[[3,0,-3,3*l],[0,0,0,0],[-3,0,3,-3*l],[3*l,0,-3*l,3*l*l]]:[[12,6*l,-12,6*l],…]`. A hinged element is a pinned-fixed beam element: its start rotation is released by static condensation, so no moment crosses the support.
  - Moment influence line: before `v=ef.node<nn-1? -k*(6*l*v1+…+2*l*l*t2) : …`; after `v=ef.node<nn-1? (hng[e]?0:-k*(6*l*v1+…+2*l*l*t2)) : …`.
  - Shear influence line: before `v=k*(12*d[2*e]+6*l*d[2*e+1]-12*d[2*e+2]+6*l*d[2*e+3]);`; after `v=hng[e]?k*(3*d[2*e]-3*d[2*e+2]+3*l*d[2*e+3]):k*(12*d[2*e]+…);`.
  - Step solver `solveOne`: after the uniform-load FEF line, added the pinned-fixed fixed-end forces for hinged elements: `if(m.simple&&ns>1)for(…){if(!hng[e])continue;const L=el[e],m0=FEF[4*e+1];FEF[4*e]-=1.5*m0/L;FEF[4*e+2]+=1.5*m0/L;FEF[4*e+3]-=m0/2;FEF[4*e+1]=0;}`. Check: uniform w gives 3wL/8, 0, 5wL/8, −wL²/8. End-force recovery: added `if(hng[e]){f1[e]=k*(3*v1-3*v2+3*l*t2)+FEF[4*e];m1[e]=FEF[4*e+1];continue;}`.
  - Engine-check text: `const th=` → `let th=`, plus `if(m.simple&&ns>1)th=[0,0.5];`. With equal simple spans, M over the support is 0 and R_A is wL/2.
  - Warning (simple spans, 2+ spans only): explains that each span is independent, that an interior reaction is the left span plus the right span, and that the multi-vehicle case applies to those reactions only.
- Reactions keep the assembled-K row (the band `r-4…r+6` still holds every coupling). So an interior support reaction is the left-span reaction plus the right-span reaction.
- No other function changed. `deflection`, `absScan` and the impact, DF and lane code work from the influence lines and solver above. `absScan` passes `m` on, so `m.simple` carries through. `staticAnalysis` keeps its own `simple` option from #463.
### The 90 % two-truck case (LRFD 10th Ed. 3.6.1.3.1)
- The gate is unchanged: `sel:ef=>[ef.t==='R'&&ef.interior, ef.t==='M'&&ef.neg]`, with `ef.neg` = M whose influence-line total < 0.
- Simple spans: no M section has a negative influence line (the support moment is exactly 0), so the case never reaches moments. It still reaches the interior pier reactions (summed left and right). That follows the article text: "reaction at interior piers". End reactions, M and V are identical with the multi-vehicle case on or off (test).
### Governing provision
- No formula, factor or unit changed for existing callers. Simple-span mode uses linear elastic beam theory with a moment release. Loads: LRFD 10th Ed. 3.6.1.2 (HL-93), 3.6.1.3.1 (90 % two trucks), 3.6.1.4 (fatigue), and 3.6.2 (IM), as the engine already had them.
### Check case (tests/engine/simple-span.test.mjs; IM 1.33 on the truck, lane 0.64 klf without IM, per lane, DF 1)
- Midspan M = 1.33(18L − 280) + wL²/8. L 60: 1064.00 + 288 = 1352.00 kip-ft. L 110: 2261.00 + 968 = 3229.00 kip-ft. The engine gives the same values.
- End V = 1.33(72 − 672/L) + wL/2. L 60: 80.864 + 19.2 = 100.064 kips. L 110: 87.635 + 35.2 = 122.835 kips. The engine gives the same values.
- Absolute maximum M (truck + lane, middle axle at x*, L − 2x* = 446.88/(95.76 + 0.32L)):
  - L 60: x* 28.056 ft, 1359.238 kip-ft. Engine 1359.234 (0.1 ft scan grid).
  - L 110: x* 53.294 ft, 3232.466 kip-ft. Engine 3232.466.
- Two simple spans 60 + 110: pier M = 0.
  - Pier R with one truck: 1.33(32 + 32·96/110 + 8·46/60) + 0.64·85 = 142.261 kips.
  - Pier R with 90 % of two trucks (headway 50 ft): 0.9[1.33(60.800 + 27.055) + 54.4] = 154.122 kips. This governs. Before the change, simple spans were not available, so there is no "before" value.
### How verified
- `node tests/engine/run.mjs`: all tests pass. The 35 Moving Load Generator parity cases still hash identically to the original page, which shows no result change for existing callers.
- A 3-span simple girder (60/110/75) was compared with three 1-span runs, for HL-93 (two-truck case on) and for the fatigue truck:
  - M and V at every 1/20 point, end reactions, and step solver: equal within 1e-7 relative (1e-6 for the step solver).
  - Deflection envelope: within 0.2 %. The meshes differ (Lt/240 vs L/240) and the deflection influence line is cubic between nodes.
  - Each pier reaction is at least each adjacent span's own reaction.
- `simple:false` and absent give the same output. On one span, `simple:true` gives the same output as without it.
### Other copies
- None. Moving Load Generator.html gets no UI for this; its `readModel()` does not set `simple`.
### Open items
- SML-O2 closed (analyze has a simple-span mode).
- SML-O4 (closed 2026-10-29, engineer: keep it on; see the sbd2-analysis entry below). Engineer to confirm: in simple-span mode, should the 90 % two-truck case apply to the summed pier reaction (as implemented, per the 3.6.1.3.1 text), or should it be off for simple-span bridges in this office's practice? The pier reaction is the pier load per girder line, not one bearing. Each bearing's reaction equals the adjacent span's end reaction, which is the shear next to the support.

## 2026-10-29 — PR: sbd2-analysis — `m.negX` option (added; existing results unchanged); SML-O4 closed
### Where
- `analyze(m,opt)`, the multi-vehicle gate. Anchor `effs.forEach((ef,ei)=>{ef.neg=ef.t==='M'&&`.
  - Before: `effs.forEach((ef,ei)=>{ef.neg=ef.t==='M'&&DER[ei].end<-1e-9*Lt*Lt;});`
  - After: `effs.forEach((ef,ei)=>{ef.neg=ef.t==='M'&&(DER[ei].end<-1e-9*Lt*Lt||!!(m.negX&&m.negX.some(r=>ef.x>=r[0]-1e-6&&ef.x<=r[1]+1e-6)));});`
  - New optional model field `m.negX`: x ranges `[[x0,x1],…]` (ft). M sections in them also take the multi-vehicle case
    (90 % of two trucks + lane) for the minimum. Absent: `x||false` is `x`, so the gate and every result are as before.
  - Header comment: one paragraph on `m.negX`.
- Why: Steel Bridge's analysis (`apps/steel-bridge/engine/analysis.js`) mirrors GirderDetail's LL5 rule (2026-10-14): the
  two-truck region is the negative-moment influence-line region united with the negative permanent-load moment region
  around each pier. Without `negX` the shared engine gave up to 2.6 % less negative LL moment at the few nodes between the
  two region ends (e.g. gd_builtin_AASHTO_G2, x = 79 ft: −992.7 vs GirderDetail −1042.4 kip-ft). With it: 0.005 %.
- Loaded by now also `apps/steel-bridge/index.html` (engine `apps/steel-bridge/engine/analysis.js`).
### Governing provision
- No formula, factor or unit changed. AASHTO LRFD 10th Ed. 3.6.1.3.1 (90 % of two design trucks + 90 % lane for negative
  moment between points of contraflexure under a uniform load on all spans, and for interior pier reactions).
### Check case
- Existing callers (Moving Load Generator): `node tests/engine/run.mjs moving-load simple static`: the 35 parity cases
  still hash identically to the original page; all tests pass (no result change).
- `negX`: gd_builtin_AASHTO_G2, staged stiffness, HL-93 per lane, g_M 0.7034 (span 1): M_LL− at x = 79 ft −992.7 kip-ft
  (influence-line gate only) → −1042.34 kip-ft with `negX` = [[79, 142], [218, 281]] (the pier regions; payload −1042.385).
### How verified
- `tests/engine/analysis.test.mjs` (100 payloads and GirderDetail's own functions; see `fixlog/steel-bridge.md`).
### Other copies
- None.
### Open items
- SML-O4 closed. The engineer decided on 2026-10-29: in simple-span mode the 90 % two-truck case stays on for the summed
  pier reactions (as implemented in #464). Test: `tests/engine/analysis.test.mjs` "SML-O4" (two simple spans 60 + 110 ft:
  pier R = 154.122 kips per lane, the two-truck case governs; pier moment 0).
