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
