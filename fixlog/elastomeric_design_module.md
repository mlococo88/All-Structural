# Fix log — elastomeric_design_module.html

Governing basis used for fixes: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), Section 14; MassDOT LRFD Bridge Manual Part I §3.5.7 (MassDOT values unchanged)

## 2026-10-04 — PR: claude/fix-elastomeric (PR link added after merge)

Check-case inputs (unless stated): default state — circular steel-reinforced pad D = 16 in, hri = 0.50 in, n = 6, cover 0.25 in, hs = 0.1196 in, G = 0.160 ksi, Fy = 36 ksi, P_DL = 80 kip, P_LL = 55 kip, θ_LL = 0.004, seat slope 0.010, other rotations 0, Δs = 0.35 in, tolerance 0.03 rad, limit 4.75.
Derived: A = 201.06 in², S = 16/(4·0.5) = 8.00, hrt = 6·0.5 + 2·0.25 = 3.50 in, σDL = 0.3979, σLL = 0.2735, σTL = 0.6714 ksi.
All "before/after" numbers below were produced by running `computeEDM` from the old and new files in node (scratch harness `edm_test.js`, which loads script sections A and C into a VM).

### F1. Method B: add static axial strain check γa,st ≤ 3.0   [calc change] [more conservative]
- **Where:** `computeEDM`, Method B dashboard block. Anchor: `add("gast","Static axial strain`
- **Problem:** γa,st was computed but never checked against 3.0.
- **Governing provision:** AASHTO LRFD 10th Ed., Art. 14.7.5.3.3 (γa,st ≤ 3.0, Eq. 14.7.5.3.3-1).
- **Before:** (no check)
- **After:**
  ```js
  add("gast","Static axial strain γa,st ≤ 3.0 [14.7.5.3.3]",ga_st/3.0,"γa,st ≤ 3.0");
  ```
  Design tab: an equation line `γa,st = … ≤ 3.0` and `checkLine("Static axial strain γa,st ≤ 3.0",st.ga_st/3.0,"[14.7.5.3.3]")` were added after the axial-strain block.
- **Check case:** default → γa,st = 1.0·0.3979/(0.160·8) = 0.311, D/C = 0.104 (new check). With P_DL = 200: γa,st = 0.777, D/C = 0.259.
- **How verified:** node run of `computeEDM` (new file); jsdom render of all tabs with no errors.
- **Other copies of this code:** none.

### F2. Method B: Da = 1.0 for circular bearings (1.4 rectangular)   [calc change] [LESS conservative for circular pads]
- **Where:** `computeEDM`. Anchor: `const Da=isCirc()?+cf.DaCirc:+cf.Da;`
- **Problem:** Da = 1.4 was used for all shapes. Circular axial strains were overstated by 40%.
- **Governing provision:** AASHTO LRFD 10th Ed., Art. 14.7.5.3.3 (Da = 1.4 rectangular, 1.0 circular).
- **Before:**
  ```js
  const Da=+cf.Da;
  ```
- **After:**
  ```js
  const Da=isCirc()?+cf.DaCirc:+cf.Da;
  ```
  New coefficient `coef.DaCirc: 1.0` in `defaultState()` (added by `migrate()` to old saved states) and a new input "Axial-strain coeff. Da (circ.)" in panel I-6. The existing input was relabelled "(rect.)". `coef.Da` keeps its key and meaning for rectangular pads.
- **Check case (default circular, together with F3 there is no change to strains):**
  - Before: γa,st = 1.4·0.3979/(0.16·8) = 0.435, γa,cy = 0.299, combined = (0.435 + 2.560 + 0.100) + 1.75(0.299 + 0.256) = 4.067, D/C 0.856.
  - After: γa,st = 0.311, γa,cy = 0.214, combined = (0.311 + 2.560 + 0.100) + 1.75(0.214 + 0.256) = 3.793, D/C 0.798.
- **How verified:** node run, before and after.
- **Other copies of this code:** none.

### F3. Method B: rotation — resultant for circular, transverse check about W for rectangular   [calc change] [more conservative]
- **Where:** `computeEDM`. Anchor: `const thSt=isCirc()?Math.hypot(thLongStatic,thTrans)`
- **Problem:** γr used only the longitudinal rotation. The transverse rotation θt fed only the displayed θs, so the displayed value did not match the value used.
- **Governing provision:** AASHTO LRFD 10th Ed., Art. 14.7.5.3.3 (γr = Dr(L/hri)²θ/n; for circular D replaces L, and rotation about any axis gives the same strain). Rectangular pads: rotation about the other axis uses W.
- **Before:**
  ```js
  const gr_st=Dr*Math.pow(Bdim/hri,2)*((thLongStatic+(+tg.rotTol))/n);
  const gr_cy=Dr*Math.pow(Bdim/hri,2)*(thLongCyclic/n);
  const gs_st=(+L.deltaS)/hrt, gs_cy=0;
  const combined=(ga_st+gr_st+gs_st)+1.75*(ga_cy+gr_cy+gs_cy);
  const limit=tg.exteriorCheck?5.0:(+tg.combLimit);
  R.strain={Da,ga_st,ga_cy,gr_st,gr_cy,gs_st,gs_cy,combined,limit};
  ```
- **After:**
  ```js
  const thSt=isCirc()?Math.hypot(thLongStatic,thTrans)+(+tg.rotTol):thLongStatic+(+tg.rotTol);
  const gr_st=Dr*Math.pow(Bdim/hri,2)*(thSt/n);
  const gr_cy=Dr*Math.pow(Bdim/hri,2)*(thLongCyclic/n);
  const gs_st=(+L.deltaS)/hrt, gs_cy=0;
  const combinedL=(ga_st+gr_st+gs_st)+1.75*(ga_cy+gr_cy+gs_cy);
  const grW_st=(!isCirc()&&!isPlain())?Dr*Math.pow(planW/hri,2)*(thTrans/n):0;
  const combinedW=(!isCirc()&&!isPlain())?(ga_st+grW_st+gs_st)+1.75*(ga_cy+gs_cy):0;
  const combined=Math.max(combinedL,combinedW);
  const limit=tg.exteriorCheck?5.0:(+tg.combLimit);
  R.strain={Da,ga_st,ga_cy,gr_st,gr_cy,gs_st,gs_cy,combined,limit,thSt,thCy:thLongCyclic,combinedL,grW_st,combinedW,gaStLimit:3.0};
  ```
  The design tab now shows θst and θcy as used, plus the transverse strain and combined line for rectangular pads.
- **Check cases:**
  - Circular, θt = 0.010: θst = √(0.010² + 0.010²) + 0.03 = 0.04414. γr,st = 0.375·(16/0.5)²·0.04414/6 = 2.825 (was 2.560). Combined = 4.058 (was 4.067 with Da = 1.4 and no θt; 3.793 with Da = 1.0 and no θt).
  - Rectangular 18 × 24, θt = 0.005, tolerance 0.005: longitudinal combined = 2.823 (unchanged). Transverse γr,st,W = 0.5·(24/0.5)²·0.005/6 = 0.960; combinedW = 0.158 + 0.960 + 0.100 + 1.75·0.108 = 1.407. Governing = 2.823.
- **How verified:** node run, before and after.
- **Other copies of this code:** none.

### F4. Method B: circular stability as a square with W = L = 0.8D   [calc change] [more conservative]
- **Where:** `computeEDM`, stability block. Anchor: `const aeq=0.8*(+g.D)`
- **Problem:** the code used an equal-area square (0.886D), which is less conservative than the code's 0.8D.
- **Governing provision:** AASHTO LRFD 10th Ed., Art. 14.7.5.3.4 (circular bearings checked as square bearings with W = L = 0.8D).
- **Before:**
  ```js
  let Lp=planL,Wp=planW; if(isCirc()){const aeq=0.886*(+g.D);Lp=aeq;Wp=aeq;}
  ```
- **After:**
  ```js
  let Lp=planL,Wp=planW; if(isCirc()){const aeq=0.8*(+g.D);Lp=aeq;Wp=aeq;}
  ```
- **Check case:** D = 12 in, hri = 0.5, n = 10 (hrt = 5.5 in, S = 6), P = 80 + 55 kip, tolerance 0.005.
  - Before: Lp = 10.632, A = 1.92(5.5/10.632)/√3 = 0.5734, B = 2.67/(8·1.25) = 0.2670, σ ≤ GS/(2A − B) = 0.96/0.8799 = 1.091 ksi; σTL = 1.194, so D/C = 1.094 (FAIL).
  - After: Lp = 9.6, A = 0.6351, σ ≤ 0.96/1.0032 = 0.957 ksi, D/C = 1.247 (FAIL).
  - Default pad: D/C goes from 0.175 to 0.206.
- **How verified:** node run, before and after.
- **Other copies of this code:** none.

### F5. Method A steel-reinforced compressive stress: σs ≤ 1.25·G·S and ≤ 1.25 ksi, with the least favourable G   [calc change] [LESS conservative when not fixed against shear; more conservative through G]
- **Where:** `computeEDM`, Method A block. Anchor: `const sigGS=(isPlain()?+cf.GSplainA:1.25)*GminA*Sf;`
- **Problem:** the code used 1.0·G·S (or 1.25·G·S if "fixed against shear") with a 1.25 ksi cap. This mixes the pre-2009 rule (1.0GS ≤ 1.0 ksi, +10% if shear is prevented) with the current rule. It also used G = 0.150 ksi (nominal), not the least favourable G.
- **Governing provision:** AASHTO LRFD 10th Ed., Art. 14.7.6.3.2 (steel-reinforced: σs ≤ 1.25GS and σs ≤ 1.25 ksi); Art. 14.7.6.2 (least favourable G of the durometer range; 60 durometer 0.130–0.200 ksi).
- **Before:**
  ```js
  const GmA=+cf.GmethodA;
  const sigGS=(tg.fixedShear?1.25:1.0)*GmA*Sf;
  ```
- **After:**
  ```js
  const GmA=+cf.GmethodA, GminA=+cf.GminA;
  const sigGS=(isPlain()?+cf.GSplainA:1.25)*GminA*Sf;
  ```
  New coefficient `coef.GminA: 0.130` with an input "Method-A G for stress limit (least favourable)". `coef.GmethodA` (0.150) is still used for the rotation (uplift) check.
- **Check cases:**
  - Default circular, Method A: before σ_GS = 1.0·0.150·8 = 1.200 ksi, limit min(1.200, 1.25) = 1.200, D/C = 0.6714/1.200 = 0.560. After: σ_GS = 1.25·0.130·8 = 1.300 ksi, limit min(1.300, 1.25) = 1.25, D/C = 0.537.
  - Rectangular 18 × 24 (S = 10.29): before 1.543 → capped at 1.25; after 1.671 → capped at 1.25 (D/C 0.250 both).
  - **Net effect:** the limit is 1.25/1.0 × 0.130/0.150 = 1.083 times the old non-fixed G·S limit (8% higher). The fixed-shear case is 13% lower than before. The 1.25 ksi cap is unchanged.
- **How verified:** node run, before and after.
- **Other copies of this code:** none.

### F6. Method A circular rotation coefficient 0.375 → 0.75; transverse check for rectangular   [calc change] [more conservative]
- **Where:** `computeEDM`, Method A block. Anchor: `const DrA=isCirc()?+cf.upliftCircA:Dr;`
- **Problem:** circular pads reused the Method B Dr = 0.375. Rectangular pads were not checked for transverse rotation about W.
- **Governing provision:** AASHTO LRFD 10th Ed., Art. 14.7.6.3.5 (rectangular σs ≥ 0.5GS(L/hri)²θs/n; circular σs ≥ 0.75GS(D/hri)²θs/n). I am confident of these from memory of the post-2009 text but could not open the 10th Ed. here — see O1.
- **Before:**
  ```js
  const upliftA=Dr*GmA*Sf*Math.pow(Bdim/hri,2)*(thTotal/n);
  R.methodA={GmA,sigGS,sigCap,upliftA};
  ```
- **After:**
  ```js
  const DrA=isCirc()?+cf.upliftCircA:Dr;   // 14.7.6.3.5: 0.5 rectangular (L), 0.75 circular (D)
  const upliftA=DrA*GmA*Sf*Math.pow(Bdim/hri,2)*(thTotal/n);
  const upliftAW=(!isCirc()&&!isPlain())?DrA*GmA*Sf*Math.pow(planW/hri,2)*(thTrans/n):0;   // rectangular: transverse rotation about W
  R.methodA={GmA,GminA,sigGS,sigCap,upliftA,upliftAW,DrA};
  ```
  - New coefficient `coef.upliftCircA: 0.75` with an input in I-6.
  - New dashboard/design check "Compression–rotation, transverse (uplift)" for rectangular pads.
- **Check cases:**
  - Default circular, Method A (θs = 0.044): before σmin = 0.375·0.150·8·32²·0.044/6 = 3.379 ksi, D/C 5.03. After σmin = 6.758 ksi, D/C 10.07. This fails both before and after, because of the MassDOT 0.03 tolerance.
  - Rectangular 18 × 24, θt = 0.005: transverse σmin = 0.5·0.150·10.286·48²·0.005/6 = 1.481 ksi, D/C 4.74 (new check).
- **How verified:** node run, before and after.
- **Other copies of this code:** none.

### F7. Plain pads: add the G·S compressive stress limit   [calc change] [more conservative]
- **Where:** `computeEDM` (plain dashboard) and `renderDesign` (plain panel). Anchor: `add("sigP","Compressive stress — plain [14.7.6.3.2]",sigTL/Math.min(sigGS,`
- **Problem:** only σs ≤ 0.80 ksi was checked. 14.7.6.3.2 also limits plain pads by a G·S term.
- **Governing provision:** AASHTO LRFD 10th Ed., Art. 14.7.6.3.2. The coefficient is entered as `coef.GSplainA`, default **1.00**. This is the FGP value, and the highest coefficient I believe the article uses. See O2: the PEP coefficient may be lower.
- **Before:**
  ```js
  add("sigP","Compressive stress — plain [14.7.6.3.2]",sigTL/(+cf.sigCapPlainA),"σs ≤ 0.80 ksi");
  ```
- **After:**
  ```js
  add("sigP","Compressive stress — plain [14.7.6.3.2]",sigTL/Math.min(sigGS,+cf.sigCapPlainA),"σs ≤ min("+fmt(+cf.GSplainA)+"GS, "+fmt(+cf.sigCapPlainA)+" ksi)");
  ```
  The plain-pad design panel shows the G·S line, and its `checkLine` uses `Math.min(R.methodA.sigGS,+S.coef.sigCapPlainA)`.
- **Check case:** plain pad L = 5 in, W = 20 in, t = 1 in, P_DL = P_LL = 15 kip. S = 100/(2·1·25) = 2.0; σs = 0.300 ksi.
  - Before: D/C = 0.300/0.80 = 0.375 (PASS).
  - After: limit = min(1.00·0.130·2.0, 0.80) = 0.260 ksi, D/C = 1.154 (FAIL).
- **How verified:** node run, before and after.
- **Other copies of this code:** none.

### F8. Cover layer ≤ 0.7·hri check; Hbu report   [calc change: new check / report] [more conservative]
- **Where:** `computeEDM` (`R.coverDC`, `R.Hbu`, dashboard items `cover`/`coverA`), and `renderDesign` with a new helper `hbuEq(R)`.
- **Governing provision:** AASHTO LRFD 10th Ed., Art. 14.7.5.1 / 14.7.6.1 (cover layers ≤ 70% of internal layers); Art. 14.6.3.1 (Hbu = G·A·Δu/hrt).
- **After:**
  ```js
  R.coverDC=isPlain()?null:(+g.cover)/(0.7*hri);
  R.Hbu=G*A*(+L.deltaS)/hrt;
  ```
- **Check case:** default: 0.25/(0.7·0.5) = D/C 0.714 (PASS). Hbu = 0.160·201.06·0.35/3.5 = 3.22 kip per bearing (report only; uses the input G).
- **How verified:** node run; jsdom render.
- **Other copies of this code:** none.

### F9. Stability label edge case (fixed against shear, A ≤ B < 2A)   [display] [no result change]
- **Where:** `computeEDM` dashboard (anchor `"A ≤ B (fixed)"`) and the `renderDesign` stability block (anchor `R.stab.denom<=0?`).
- **Problem:** with "fixed against shear" ticked and A − B ≤ 0 < 2A − B, the dashboard said "2A ≤ B, stable" and the design panel showed GS/(A − B) = ∞.
- **Before:**
  ```js
  else dash.push({id:"stab",name:"Stability [14.7.5.3.4] — 2A ≤ B, stable",dc:0,pass:true,ref:"2A ≤ B"});
  ```
- **After:**
  ```js
  else dash.push({id:"stab",name:"Stability [14.7.5.3.4] — "+(tg.fixedShear?"A ≤ B (fixed)":"2A ≤ B")+", stable",dc:0,pass:true,ref:tg.fixedShear?"A ≤ B":"2A ≤ B"});
  ```
- **Check case:** rectangular 20 × 30, hri 0.5, n 4, fixed: A = 0.1571, B = 0.1635. Before the label read "2A ≤ B, stable"; after it reads "A ≤ B (fixed), stable". The verdict (PASS) is unchanged.

### F10. Bug fixes   [bug fix] [no result change unless noted]
- **Dead thermal span input.** `renderRot`: `${inpRow("Span length","thermal.span","ft").replace('data-path','data-path data-rot')}` → `${inpRow("Span length","thermal.span","ft")}`. Verified in jsdom: the input now carries `data-path="thermal.span"` and updates `S.thermal.span`.
- **Focus loss on keystroke (thermal inputs).** The thermal equation moved into a new `thermEqHtml()` inside `<div id="thermEq">`. The `input` handler now updates only that block for `thermal.*` paths and does not call `recalc()`/`renderAll()`. Added line (anchor `if(p.indexOf("thermal.")===0)`):
  ```js
  if(p.indexOf("thermal.")===0){ if(!S.thermal)S.thermal={span:75,alpha:6.5e-6,dT:100,factor:1.2}; setPath(S,p,v); const te=document.getElementById("thermEq"); if(te){ te.innerHTML=thermEqHtml(); renderMathIn(te); } scheduleSave(); return; }
  ```
  Verified in jsdom: `document.activeElement` is still the span input after typing.
- **`tog.thermalFactor` wired.** The thermal reference calc now uses the I-5 toggle (fallback 1.2) instead of `S.thermal.factor`. Display only: Δs remains a user input. Check: span 100 ft, α 6.5e-6, ΔT 100 °F gives 0.468 in at ×1.2 and 0.390 in at ×1.0 (jsdom).
- **`tog.includeIM` removed from the UI.** Its intent (scale which load, by what, given that P_LL arrives from the abutment app with unknown IM content) is not defined, and the engine never read it. The checkbox line `<div class="chk-row"><input type="checkbox" data-path="tog.includeIM"…` was deleted. The state field is kept, so saved data is unchanged.
- **`VALID` table now produces warnings.** New block in `computeEDM` (anchor `// input ranges from the VALID table`). Values outside the hard range (including blank, which is stored as 0) give an "Input error" (class `err`). Values outside the typical range give an advisory. For plain pads, geometry is only checked for > 0. Zero total load is also an input error. `R.nInErr` is shown in the dashboard summary and the report summary. Check: hri blank → "1 input error(s) — results not valid".
- **`setProjects` try/catch.** `function setProjects(o){ try{ localStorage.setItem(PROJKEY,JSON.stringify(o)); return true; }catch(e){ alert(…); return false; } }`. Save Project shows "saved" only on success.
- **Abutment hand-off, receiving side (`applyHandoff`).**
  - Positive padL/padW from the abutment set `padType = "rectRein"` with L/W (unless the pad type is plain).
  - If W = (π/4)·L within 0.01 in, the pad is recognised as a circular pad this module sent back earlier, and it is restored as `circRein` with D = L.
  - Incoming thermal fields that are not finite and positive are ignored, so the abutment's `factor: NaN` no longer overwrites the state.
- **Abutment hand-off, return side (`sendPadBack`).** The PAD payload now also carries `A` (plan area; πD²/4 for circular) and `shape`. `D` was already sent. The abutment PR (`claude/fix-abutment`) consumes `D`/`A`.
- **How verified:** `node --check` on every inline script. jsdom smoke test (`jsd/edm_dom.js`): all five tabs render for circ/rect × Method A/B and plain; thermal input and focus; hand-off INIT (rect and circular-equivalent); PAD payload; print report. No runtime errors.

## 2026-10-04 — Engineer decisions applied

### F11. Plain-pad G·S coefficient stays at 1.00 (engineer's decision)   [decision record] [no result change]
- **Where:** `defaultState()`, anchor `GSplainA:1.00`; used in `computeEDM`, anchor `const sigGS=(isPlain()?+cf.GSplainA:1.25)*GminA*Sf;`
- **Problem:** O2 asked whether the plain-pad coefficient should be lower than 1.00 (e.g. ≈0.55 for PEP under older specifications).
- **Decision:** the engineer keeps c = 1.00. The default was verified to be 1.00 already on this branch, so no code change was made.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024), Art. 14.7.6.3.2 (plain pad σs ≤ c·G·S, with cap `coef.sigCapPlainA` = 0.80 ksi); coefficient per engineer.
- **Before:**
  ```js
  coef:{ Da:1.4, DrRect:0.5, DrCirc:0.375, sigCapReinA:1.25, sigCapPlainA:0.80, GmethodA:0.150, DaCirc:1.0, GminA:0.130, GSplainA:1.00, upliftCircA:0.75 },
  ```
- **After:** unchanged (same line).
- **Check case:** unchanged from F7 — σ_GS = 1.00·G_min·S, limit = min(σ_GS, 0.80 ksi). No numbers change.
- **How verified:** `grep -n "GSplainA" elastomeric_design_module.html` — default `GSplainA:1.00` in `defaultState()`; the I-6 input still allows a project-specific override.
- **Other copies of this code:** none known.

## Open items (not changed)
- O1. **10th Ed. text not available in this environment.** F5 (1.25GS ≤ 1.25 ksi; no increase for "fixed against shear") and F6 (0.75 for circular) were made from my knowledge of the post-2009 AASHTO text, supported by DOT manual excerpts found by search. — Engineer to confirm both against the 10th Ed., Art. 14.7.6.3.2 and 14.7.6.3.5. The `fixedShear` toggle now affects only Method B stability.
- O3. **Plain-pad rotation check (14.7.6.3.5).** Not added; I am not confident of the 10th Ed. form for plain pads.
- O7. **MassDOT values kept (needs MassDOT confirmation):** construction rotation tolerance 0.03 rad (AASHTO 14.4.2.1: 0.005) and combined-strain limit 4.75 (AASHTO 5.0).
- O12. **Anchorage check basis (S2).** (a) Δu is taken as the input Δs (MassDOT ×1.2 movement), treated as the factored strength-limit shear deformation (γTU = 1.20) — verify; creep/shrinkage in Δs at their own strength factors would change it slightly. (b) Method B uses the specified G (no +15% tolerance); Method A / plain pads use the upper-bound durometer G (`coef.GmaxA`). (c) P_min defaults to the unfactored service P_DL; enter a lower P_min (e.g. 0.9·P_DL, or DC only without DW) if the owner requires it. — Engineer to confirm (a)–(c).

## Resolved items
- O4. Construction tolerance on the rectangular transverse rotation → **fixed in A2** (2026-10-12, `claude/edm-anchored`): AASHTO 0.005 now also added about W; MassDOT 0.03 stays applied once (coordinator decision).
- O13. Anchored / doweled pad toggle → **added in A1** (`tog.anchored`, default off).
- O5. Method A uplift G → **fixed in S1** (2026-10-12, `claude/sweep-edm`).
- O6. Method B G warning range → **fixed in S3**.
- O8. Anchorage / slip check → **fixed in S2**.
- O9. Rotation sign handling (absolute values added) → **closed, no change (S6)**: conservative by design.
- O10. postMessage source check → **fixed in S4**.
- O11. Self-test shape factor from the engine → **fixed in S5**.
- O2. **Plain-pad G·S coefficient (F7).** Default 1.00 (FGP). For plain elastomeric pads (PEP), the 10th Ed. coefficient may be lower (older specifications used GS/1.8 ≈ 0.55GS for plain pads). — Engineer to confirm the coefficient for MassDOT 1 × 5 plain pads and set `coef.GSplainA`.
  - **RESOLVED 2026-10-04 (F11):** engineer keeps the coefficient at 1.00. No code change; default already 1.00.

## 2026-10-04 — PR: claude/step1-group2 (PR link added after merge)

### F12. "← All tools" link + shared project info (HANDOFF.md §4.1)   [feature (no result change)]

- **Type:** feature (no result change). No formulas, factors, units, code references, storage keys or saved-data formats were changed.
- **What:** a small "← All tools" link to `tools.html` (`target="_top"`, hidden in print), and two buttons, **Use shared project info** and **Share project info**, in the "Project / Title Block" input panel. Share publishes `bridgeSuite.v1.projectMeta` (`_schema:"bridge-project-meta"`) with the tool's own fields, and `""` for fields it lacks. Use reads it with `BridgeXfer.read('projectMeta','bridge-project-meta',1)`, shows a confirm dialog listing each field that will be overwritten (old → new), writes only this tool's fields, never blanks a field when the shared value is blank, and writes through the tool's normal path (sets the input and dispatches a bubbling `input` event, so the tool's own handler updates its state and autosaves).
- **Field mapping (shared `fields` key → this tool's input):**

| shared field | this tool |
|---|---|
| `projectName` | `#inputPanel [data-path="proj.name"]` |
| `bridgeId` | — (not in this tool; shared as `""`, ignored on Use) |
| `jobNo` | `#inputPanel [data-path="proj.num"]` |
| `client` | — (not in this tool; shared as `""`, ignored on Use) |
| `location` | — (not in this tool; shared as `""`, ignored on Use) |
| `preparedBy` | `#inputPanel [data-path="proj.calcBy"]` |
| `checkedBy` | `#inputPanel [data-path="proj.chkBy"]` |
| `date` | `#inputPanel [data-path="proj.date"]` |

- **Governing provision:** none (not a calculation change). Spec: HANDOFF.md §4.1 (channel) and §5 (helper).
- **Check case:** Share with Project name "Route 9 over Mill Brook", Job no. "J-4471", Prepared by "M. Lococo", Checked by "A. Checker", Date "2026-10-04"; then Use in another tool → the mapped fields show those values after one confirm; unmapped fields are unchanged. Calculation results before/after: identical (no calculation code touched).

**Edit 1 — link.** Where: `<header>`, above `.apptitle`.
- Before:
```html
<header>
  <div class="apptitle">Elastomeric Bearing Design Module</div>
```
- After:
```html
<header>
  <a class="bx-all-tools" href="tools.html" target="_top" title="Open the list of all tools">&larr; All tools</a>
  <div class="apptitle">Elastomeric Bearing Design Module</div>
```

**Edit 2 — buttons.** Where: `buildInputs()` → panel `in-proj` ("Project / Title Block"); anchor `${inpRow("Checked date","proj.chkDate","")}`.
- Before:
```js
    ${inpRow("Checked by","proj.chkBy","")}${inpRow("Checked date","proj.chkDate","")}`.replace(/type="number"/g,'type="text"'));
```
- After:
```js
    ${inpRow("Checked by","proj.chkBy","")}${inpRow("Checked date","proj.chkDate","")}`.replace(/type="number"/g,'type="text"')
    +`<div class="in-row bx-pm-row" style="gap:6px;flex-wrap:wrap"><button type="button" class="mini-btn" id="bx-pm-use" title="Fill this title block from the project info shared by another tool">Use shared project info</button><button type="button" class="mini-btn" id="bx-pm-share" title="Share this title block with the other tools">Share project info</button></div>`);
```

**Edit 3 — CSS.** Where: end of the first `<style>` block in `<head>` (inserted just before its `</style>`).
- Before: `</style>`
- After:
```css
/* "All tools" link */
.bx-all-tools{font-size:12px;color:#555;text-decoration:none;}
.bx-all-tools:hover{color:var(--navy);text-decoration:underline;}
@media print{.bx-all-tools,.bx-pm-row{display:none !important;}}
</style>
```

**Edit 4 — scripts.** Where: just before the first `</head>`.
- Before: `</head>`
- After:
```html
<script>
/* BridgeXfer v1 verbatim from HANDOFF.md §5 (not repeated here) */
</script>
<script>
/* Shared project info (HANDOFF.md §4.1, channel projectMeta): "Use shared project info" / "Share project info".
   Uses BridgeXfer v1 above. Writes only the fields this tool has, through the tool's normal input path. */
(function(){
  var TOOL='Elastomeric Bearing Design Module', FILE='elastomeric_design_module.html';
  var MAP={ projectName:'#inputPanel [data-path="proj.name"]', bridgeId:'', jobNo:'#inputPanel [data-path="proj.num"]', client:'', location:'', preparedBy:'#inputPanel [data-path="proj.calcBy"]', checkedBy:'#inputPanel [data-path="proj.chkBy"]', date:'#inputPanel [data-path="proj.date"]' }; // shared field -> this tool's input ('' = this tool has no such field)
  var LBL={ projectName:'Project name', bridgeId:'Bridge ID', jobNo:'Job / project no.', client:'Client', location:'Location', preparedBy:'Prepared by', checkedBy:'Checked by', date:'Date' };
  function el(k){ return MAP[k] ? document.querySelector(MAP[k]) : null; }
  function share(){
    var f={}; for(var k in LBL){ var e=el(k); f[k]=e ? String(e.value==null?'':e.value).trim() : ''; }
    var r=BridgeXfer.publish('projectMeta',{ _schema:'bridge-project-meta', project:{ name:f.projectName, bridgeId:f.bridgeId }, fields:f }, TOOL, FILE);
    alert(r.error ? 'Could not share project info: '+r.error : 'Project info shared. Other tools can load it with "Use shared project info".');
  }
  function use(){
    var r=BridgeXfer.read('projectMeta','bridge-project-meta',1);
    if(r.error){ alert(r.empty ? 'No shared project info yet. Click "Share project info" in a tool that has the project filled in.' : 'Cannot use shared project info: '+r.error); return; }
    var f=r.payload.fields||{}, todo=[], lines=[], skipped=[];
    for(var k in LBL){ var e=el(k); if(!e) continue;
      var v=f[k]==null ? '' : String(f[k]).trim(); if(!v) continue;
      if(e.type==='date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)){ skipped.push(LBL[k]+' "'+v+'" (not a YYYY-MM-DD date)'); continue; }
      if(v===e.value) continue;
      todo.push([k,v]); lines.push('  '+LBL[k]+': "'+(e.value||'')+'" -> "'+v+'"'); }
    var from='From: '+BridgeXfer.describe(r.payload);
    if(!todo.length){ alert('Shared project info has nothing new for this tool.\n\n'+from+(skipped.length?'\n\nNot used: '+skipped.join('; '):'')); return; }
    if(!confirm('Use shared project info?\n\n'+from+'\n\nThis will overwrite:\n'+lines.join('\n')+(skipped.length?'\n\nNot used: '+skipped.join('; '):'')+'\n\nBlank shared fields are left unchanged.')) return;
    todo.forEach(function(t){ var e=el(t[0]); if(!e) return; e.value=t[1]; e.dispatchEvent(new Event('input',{ bubbles:true })); });
  }
  document.addEventListener('click', function(ev){
    var b=ev.target && ev.target.closest ? ev.target.closest('#bx-pm-use,#bx-pm-share') : null; if(!b) return;
    if(b.id==='bx-pm-use') use(); else share();
  });
})();
</script>
</head>
```

- **How verified:**
  - `node --check` on every plain inline `<script>` of the old and new file: no failures in either (2 new scripts per file: helper + glue). The tool has no `text/babel` blocks.
  - jsdom load with CDN scripts not fetched: the same load errors as the original file (none new); `window.BridgeXfer` exists; the link has `href="tools.html" target="_top"`.
  - Share → Use run in jsdom between all six tools of this PR (30 pairs) with the localStorage entry copied across: every pair passed. The payload had `_schema:"bridge-project-meta"`, `schemaVersion:1`, all 8 `fields` keys, and `producedAt` equal to `bridgeSuite.v1.projectMeta.updatedAt`. Fields were written through the tool's own input handler and reached its saved state/autosave. A blank shared field never blanked a tool field; an empty channel and a wrong `_schema` gave a message and changed nothing.
  - Diff check: at most one line is removed, the line replaced at the button anchor where that anchor is inside a JS template string; everything else is additions. No calculation code, storage key or saved-data format was touched.
- **Other copies:** the BridgeXfer v1 helper is duplicated verbatim in every tool that uses it (CLAUDE.md §3; list in the PR). The glue block is the same in each tool of this PR except `TOOL`/`FILE` and the field map.
- **Open items:** none.

## 2026-10-09 — PR: claude/tabs-elastomeric (PR link added after merge)

### T1. Input panel split into tabs   [UI only — no calculation change]
- **Date / type:** 2026-10-09, UI only (no result change). Engineer's request of 2026-10-09: "Go through all the apps and make sure they are all formatted with the input panel having tabs rather than one long scrolling input panel." Same approach as `Steel Beam Design - AISC 15th.html` T1. The tab strip uses this tool's own look (the same tab style as the output `#tabbar`: panel-grey tabs, navy active tab, navy rule underneath).
- **How it works:** `buildInputs()` still builds all eight cards into `#inputPanel` exactly as before (same HTML string). Right after it sets `innerHTML`, the new `edmInputTabs()` **moves** the finished card nodes into one pane per tab. Nothing is rebuilt, so every `data-path`, `data-cid`, `data-rebuild`, id (`geomDeriv`, `rotDeriv`, `bx-pm-use`, `bx-pm-share`), the document-level event handlers and the values are unchanged. The pad-type and method logic still decides which inputs exist inside each card. No card is mode-dependent, so no tab is ever empty; a tab whose pane is empty would be hidden. A node not in the map stays in the tab of the card before it.
- **Tabs (in order) and the cards in each** (`data-cid` in brackets):

| Tab | Cards |
|---|---|
| Project | Project / Title Block (`in-proj`), incl. "Use shared project info" / "Share project info" |
| Pad | I-1 Bearing Type & Design Method (`in-type`), I-2 Pad Geometry (`in-geom`) |
| Materials | I-3 Materials (`in-mat`) |
| Loads | I-4 Loads & Movements (`in-loads`) |
| Code | I-5 MassDOT ↔ AASHTO Toggles (`in-tog`), I-6 Code Coefficients (`in-coef`) |
| Assumptions | I-7 Engineering Assumptions (`in-assum`) |

- **Error marker:** a red dot on a tab holding an input that this tool's own validation flags as an **input error** (the red `err` warnings from `computeEDM` — `Input error: <path> = …` names the input; total service load zero → `loads.Pdl`; Δs > 2.5 in → `loads.deltaS`; steel laminate < 0.1196 in → `geom.tSteel`), or a number field the browser cannot parse (`validity.badInput`). The amber advisory warnings (typical-range, approval notes) do not set the dot. Refreshed after every rebuild and every recalculation (`buildInputsDerived`).
- **Keyboard / accessibility:** `role="tablist"`, `role="tab"` with `aria-selected` and `aria-controls`, `role="tabpanel"` with `aria-labelledby`; roving `tabindex`; ←/→ (and ↑/↓), Home and End move between the visible tabs.
- **New storage key:** `edm_v1_inputTab` (localStorage, plain string: `project`, `pad`, `mat`, `loads`, `code` or `assum`), following the tool's `edm_v1_` prefix. Every read and write is in try/catch; an in-memory copy keeps the tab across rebuilds when storage is blocked. It is **not** stored in `S`, so the autosave (`edm_v1_autosave`), saved projects (`edm_v1_projects`), the JSON export/import, the Abutment postMessage hand-off and `bridgeSuite.v1.projectMeta` are unchanged. The output tab (`S.ui.tab`) and card collapse state (`S.ui.collapse`) are unchanged. No existing key or format changed.
- **Abutment hand-off:** unchanged. `applyHandoff()` calls `buildInputs()` as before; the remembered input tab stays selected (the hand-off does not focus an input). Nothing in the tool scrolls to or focuses an input programmatically, so no "go to input" path needed a tab switch.
- **Print:** unchanged. `@media print` hides `.layout` and `#inputPanel`; the report is built from the output tabs into `#report`. The input tabs never print.
- **Narrow screens:** the strip wraps (`flex-wrap`) and is sticky at the top of the input panel while the page scrolls. No horizontal page scroll at 400 px (document scroll width = 400).
- **Governing provision:** none (no engineering change).
- **Before / After** (file uses LF; each edited function is defined once):
  1. CSS. Anchor (unchanged): `.tabpane{display:none;}.tabpane.active{display:block;}`. Inserted right after it:
     ```css
     /* input panel tabs (edmInputTabs) — same look as the output #tabbar */
     #edmInTabs{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:3px;margin:-12px -14px 8px;padding:8px 14px 0;background:#fff;border-bottom:2px solid var(--navy);}
     #edmInTabs .edmInTab{display:inline-flex;align-items:center;font-family:inherit;font-size:13px;padding:6px 12px;border:1px solid var(--line);border-bottom:none;border-radius:5px 5px 0 0;background:var(--panel);color:#1a1a1a;cursor:pointer;}
     #edmInTabs .edmInTab:hover{background:var(--panel-h);}
     #edmInTabs .edmInTab[aria-selected="true"]{background:var(--navy);color:#fff;border-color:var(--navy);}
     #edmInTabs .edmInTab:focus-visible{outline:2px solid var(--navy-lt);outline-offset:1px;}
     .edmInDot{display:none;width:7px;height:7px;border-radius:50%;background:var(--bad);margin-left:6px;box-shadow:0 0 0 1.5px #fff;}
     .edmInTab.has-err .edmInDot{display:inline-block;}
     .edmInTab[hidden],.edmInPane[hidden]{display:none !important;}
     ```
     (Class names are deliberately not `.tab`: the document click handler treats any `.tab` as an output tab.)
  2. `buildInputs()`. Before:
     ```js
       document.getElementById("inputPanel").innerHTML=h;
       // derived readouts
     ```
     After:
     ```js
       document.getElementById("inputPanel").innerHTML=h;
       edmInputTabs();   // move the cards just built into the input tabs
       // derived readouts
     ```
  3. New block inserted right after the end of `buildInputs()` (before the `</script>` that closes SECTION B; anchor: the comment `/* ---------- input panel tabs (UI only) ----------`): constants `EDM_IN_TABS`, `EDM_IN_SEC`, `EDM_IN_KEY`, and functions `edmInTabGet`, `edmInTabSet`, `edmInputTabs`, `edmSetInTab`, `edmInTabKey`, `edmInputTabMarks` (about 85 lines; copy the block from the file, from that comment down to the `</script>`).
  4. `buildInputsDerived()`. Before (last line of the function):
     ```js
       const rd=document.getElementById("rotDeriv"); if(rd) rd.innerHTML=`Design rotation θ<sub>s</sub> = <b>${fmt(R.rot.thTotal,4)} rad</b> · σ<sub>TL</sub> = <b>${fmt(R.sigTL,3)} ksi</b>`;
     }
     ```
     After:
     ```js
       const rd=document.getElementById("rotDeriv"); if(rd) rd.innerHTML=`Design rotation θ<sub>s</sub> = <b>${fmt(R.rot.thTotal,4)} rad</b> · σ<sub>TL</sub> = <b>${fmt(R.sigTL,3)} ksi</b>`;
       edmInputTabMarks();   // refresh the input-tab error dots
     }
     ```
- **Check case:** default state (circular, Method B): dashboard "All 6 checks PASS · governing D/C = 0.80" before and after. Set h_ri = 0 → before and after: "1 input error(s)"; after: red dot on the Pad tab only.
- **How verified:**
  - `node --check` on every inline script of the old and new file: all pass.
  - Headless Chromium (Playwright 1.56, KaTeX 0.16.11 and Plotly 2.35.2 served locally at the pinned versions), main vs branch, 11 scenarios: default; rectangular; plain; Method A; rectangular + Method A; all four toggles changed; edited inputs (P_DL, h_ri, D_r, G, project name); h_ri = 0; Δs = 3; P_DL = P_LL = 0; and the Abutment hand-off (an opener page that answers `EDM_READY` with an `INIT` payload incl. 3 girders, then receives the `PAD` message). Identical in every scenario: dashboard text, the text of all five output tabs, the print report text (timestamp masked), the full state `S`, all results (`LAST`), the autosave JSON, the save → load round trip, and the "Send Pad to Abutment" payload (download and postMessage). The list of input `data-path`s (with type and value), input-panel ids and `data-cid`s is identical, and every input is in exactly one pane.
  - Tab UI: keyboard (arrows wrap, Home/End), remembered tab after a pad-type rebuild and after reload, in-memory fallback with localStorage blocked, card collapse still works, "Use shared project info" fills the Project tab, error dots for h_ri = 0 (Pad), Δs > 2.5 and zero load (Loads), t_s < 0.1196 (Pad), unparsable f′c (Materials), cleared when fixed. No console errors.
  - Screenshots of every tab at 1400 px and 400 px inspected.
- **Other copies of this code:** none.
- **Open items:** none.

## 2026-10-12 — PR: claude/sweep-edm (open-item sweep; PR link added after merge)

Inventory items worked: EDM-O5, EDM-O8, EDM-O6, EDM-O10, EDM-O11 (fixed); EDM-O9 (closed, no change); EDM-O1, EDM-O3, EDM-O4, EDM-O7 (need the engineer; see "Needs engineer" at the end of this entry). Check-case inputs are the default state of the 2026-10-04 entry unless stated (circular D = 16, hri = 0.5, n = 6, cover 0.25, G = 0.160, P_DL = 80, P_LL = 55, θLL = 0.004, seat slope 0.010, Δs = 0.35, tolerance 0.03). Derived: A = 201.06 in², S = 8.00, hrt = 3.50 in, σTL = 0.6714 ksi, θs = 0.014 + 0.03 = 0.044 rad.

### S1. Method A uplift check uses the upper-bound G (EDM-O5)   [calc change] [MORE conservative]
- **Where:** `computeEDM`, Method A block. Anchor: `const GmA=+cf.GmaxA, GminA=+cf.GminA;`. Also `defaultState()` (`coef`), `migrate()`, `buildInputs()` panel I-6, `renderDesign()` Method A uplift note.
- **Problem:** the uplift (minimum-stress) check σs ≥ c·G·S(B/hri)²θs/n used G = 0.150 ksi (`coef.GmethodA`, mid-range). The demand grows with G, so the least favourable G is the upper bound of the durometer range (0.200 ksi at 60 durometer).
- **Governing provision:** AASHTO LRFD 10th Ed. (2024), Art. 14.7.6.2 (when the elastomer is specified by hardness, G is taken as the least favourable value of the range; Table 14.7.6.2-1: 60 durometer 0.130–0.200 ksi); check per Art. 14.7.6.3.5.
- **Before:**
  ```js
  const GmA=+cf.GmethodA, GminA=+cf.GminA;   // GminA: least favourable (lowest) G of the durometer range, used for the G·S stress limit [14.7.6.2]
  ```
  ```js
  coef:{ Da:1.4, DrRect:0.5, DrCirc:0.375, sigCapReinA:1.25, sigCapPlainA:0.80, GmethodA:0.150, DaCirc:1.0, GminA:0.130, GSplainA:1.00, upliftCircA:0.75 },
  ```
  ```js
      ${inpRow("Method-A shear modulus","coef.GmethodA","ksi",{title:"Used in the Method A rotation (uplift) check"})}
  ```
- **After:**
  ```js
  const GmA=+cf.GmaxA, GminA=+cf.GminA;   // least favourable G of the durometer range [14.7.6.2]: GminA (lowest) for the G·S stress limit, GmA = GmaxA (highest) for the uplift check
  ```
  ```js
  coef:{ Da:1.4, DrRect:0.5, DrCirc:0.375, sigCapReinA:1.25, sigCapPlainA:0.80, GmethodA:0.150, DaCirc:1.0, GminA:0.130, GSplainA:1.00, upliftCircA:0.75, GmaxA:0.200 },
  ```
  ```js
      ${inpRow("Method-A G for uplift &amp; anchorage (least favourable)","coef.GmaxA","ksi",{title:"Highest G of the specified durometer range (60 duro: 0.200 ksi) [14.7.6.2]; used in the Method A rotation (uplift) check and the Method A / plain-pad anchorage check"})}
  ```
  Migration, first lines of `migrate()` (anchor `// GmaxA (Method A uplift G, upper bound) is new`):
  ```js
  if(S.coef&&S.coef.GmaxA===undefined&&S.coef.GmethodA!==undefined&&+S.coef.GmethodA!==0.150) S.coef.GmaxA=+S.coef.GmethodA;
  ```
  The Method A uplift note in `renderDesign` now ends `G = ${fmt(ma.GmA,3)} ksi, the highest value of the durometer range (least favourable for this check) [14.7.6.2].`
- **Saved data:** new optional field `coef.GmaxA`. `coef.GmethodA` keeps its key and stored value but no longer feeds any check (its input row is replaced by the GmaxA row in the same place). Old files: if `GmethodA` is the old default 0.150, `GmaxA` gets the new default 0.200; if the engineer had edited `GmethodA` (e.g. 0.130 for a 50-durometer pad), that value is carried into `GmaxA`, so a deliberate entry is kept.
- **Default choice:** 0.200 ksi = upper bound of 60 durometer (the hardness the existing GminA = 0.130 already assumes). Code-required; editable in I-6.
- **Check cases** (σTL = 0.6714 ksi):
  - Default circular, Method A, tolerance 0.03: before σmin = 0.75·0.150·8·(16/0.5)²·0.044/6 = 0.9·1024·0.007333 = 6.758 ksi, D/C 10.07. After 0.75·0.200·8·1024·0.007333 = 9.011 ksi, D/C 13.42. FAIL both.
  - Same, tolerance 0.005 (θs = 0.019): before 2.918 ksi, D/C 4.35; after 3.891 ksi, D/C 5.80.
  - Rectangular 18 × 24 Method A, θt = 0.005 (S = 10.286, σTL = 0.3125): θs = √(0.014² + 0.005²) + 0.03 = 0.04487; long. before 0.5·0.150·10.286·36²·0.04487/6 = 7.476 ksi (D/C 23.92), after 9.968 ksi (D/C 31.90); transverse before 0.5·0.150·10.286·48²·0.005/6 = 1.481 ksi (D/C 4.74), after 1.975 ksi (D/C 6.32).
  - Every uplift result scales by 0.200/0.150 = 1.333.
- **How verified:** headless Chromium, main vs branch (see "Verification" below).
- **Other copies:** none.

### S2. Anchorage check H ≤ P_min/5 with a P_min input (EDM-O8)   [calc change: new check] [MORE conservative]
- **Where:** `computeEDM` (anchor `// anchorage [14.7.5.4 Method B / 14.7.6.4 Method A]`, dashboard items `anc` / `ancA` / `ancP`, warning anchor `if(isFinite(ancDC)&&ancDC>1.0001)`), new helper `ancEq(R)` right after `hbuEq`, called in all three `renderDesign` panels; new input in I-4; `VALID` entry `loads.Pmin`; `inputEcho()` row.
- **Problem:** no anchorage (slip) check. AASHTO requires the pad to be secured against horizontal movement when the shear force exceeds one-fifth of the minimum vertical force due to permanent loads.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024), Art. 14.7.5.4 (Method B) and Art. 14.7.6.4 (Method A, incl. plain pads); shear force per Art. 14.6.3.1 (H = G·A·Δu/hrt); G per Art. 14.7.5.2 (Method B, specified G) / 14.7.6.2 (Method A, least favourable = upper bound for a force). Article numbers from memory: verify.
- **Before:** (no check)
- **After:**
  ```js
  // anchorage [14.7.5.4 Method B / 14.7.6.4 Method A]: secure the pad if the shear force H > P_min/5 (P_min = minimum vertical force due to permanent loads)
  // H = G·A·Δs/h_rt with Method B: specified G [14.7.5.2]; Method A and plain pads: upper-bound G of the durometer range (GmaxA) [14.7.6.2]
  const GAnc=(S.method==="B"&&!isPlain())?G:GmA;
  const PminIn=+L.Pmin, PminUsed=(PminIn>0)?PminIn:Pdl;
  const Hanc=GAnc*A*(+L.deltaS)/hrt;
  const ancDC=(PminUsed>0)?Hanc/(PminUsed/5):Infinity;
  R.anc={G:GAnc,H:Hanc,Pmin:PminUsed,PminFromDL:!(PminIn>0),dc:ancDC,ref:(S.method==="B"&&!isPlain())?"14.7.5.4":"14.7.6.4"};
  ```
  - Dashboard: `add("anc","Anchorage H ≤ P_min/5 [14.7.5.4]",ancDC,"H ≤ P_min/5");` (Method B, after `cover`); `add("ancA","Anchorage H ≤ P_min/5 [14.7.6.4]",ancDC,"H ≤ P_min/5");` (Method A, after `coverA`); `add("ancP", …same…)` (plain, after `stabP`).
  - Warning when D/C > 1: `if(isFinite(ancDC)&&ancDC>1.0001) warn("Anchorage: H = "+fmt(Hanc)+" kip > P_min/5 = "+fmt(PminUsed/5)+" kip — the pad must be secured against horizontal movement [AASHTO "+R.anc.ref+"].");`
  - Input (I-4, after P_LL): `${inpRow("Min. permanent load P<sub>min</sub> (0 = P<sub>DL</sub>)","loads.Pmin","kip",{title:"…"})}`; default `Pmin:0` in `defaultState().loads`; `"loads.Pmin":{hard:[0,2000],typ:[0,2000],msg:""}` in `VALID` (negative → input error).
  - `inputEcho()`: `["P_min (anchorage)",(+L.Pmin>0)?L.Pmin:"= P_DL","kip"]` after P_LL.
  - `ancEq(R)` shows H = G·A·Δs/hrt with values, H ≤ P_min/5, the G basis and the check line (copy the function from the file; anchor `function ancEq(R)`).
- **Saved data:** new optional field `loads.Pmin` (0 = use P_DL). Old files load with 0, i.e. P_min = P_DL. In the Girder Run, P_min = 0 uses each girder's own P_DL.
- **Default choice:** P_min = P_DL (unfactored permanent load, the plain reading of the article); the engineer can enter a lower value. See O12.
- **Hand-off:** the PAD payload format is unchanged; its `pass` / `govDC` now include this check.
- **Check cases:**
  - Default (circular, Method B): H = 0.160·201.06·0.35/3.50 = 3.217 kip; P_min/5 = 80/5 = 16.00 kip; D/C = 0.201 PASS. Dashboard before "All 6 checks PASS · governing D/C = 0.80", after "All 7 checks PASS · governing D/C = 0.80".
  - Default with P_min = 12 kip: 12/5 = 2.40 kip; D/C = 3.217/2.40 = 1.34 FAIL (warning shown).
  - Default, Method A: G = GmaxA = 0.200 → H = 4.021 kip, D/C = 0.251.
  - Plain MassDOT pad 5 × 20 × 1 in, P_DL = P_LL = 15 kip, Δs = 0.25 in (hrt = 1.0): H = 0.200·100·0.25/1.0 = 5.00 kip; P_min/5 = 3.00 kip; D/C = 1.67 FAIL (new; see O13).
  - Abutment hand-off test (P_DL 120, Δs 0.6, rect 20 × 26, G 0.15): D/C 0.557.
- **How verified:** headless Chromium (below); girder run: a girder with P_DL = 40 gives P_min = 40, D/C 0.402.
- **Other copies:** none.

### S3. Method B shear-modulus warning range 0.080–0.175 ksi (EDM-O6)   [bug fix: advisory text only] [no result change]
- **Where:** after the `VALID` table (new constant `VALID_G_METHOD_B`), and the `VALID` loop in `computeEDM`.
- **Before:**
  ```js
    const V=VALID[p], v=Number(getPath(S,p));
  ```
- **After:**
  ```js
  // Method B (steel-reinforced) shear modulus range [14.7.5.2]; replaces the mat.G typical range above when Method B is used
  const VALID_G_METHOD_B={hard:[0.05,0.30],typ:[0.080,0.175],msg:"Shear modulus outside the Method B range 0.080–0.175 ksi [14.7.5.2]."};
  ```
  ```js
    const V=(p==="mat.G"&&S.method==="B"&&!isPlain())?VALID_G_METHOD_B:VALID[p], v=Number(getPath(S,p));
  ```
- **Governing provision:** AASHTO LRFD 10th Ed., Art. 14.7.5.2 (Method B: G between 0.080 and 0.175 ksi). Method A / plain keep the 0.130–0.200 advisory (60 durometer, Art. 14.7.6.2).
- **Check case:** Method B, G = 0.09: before advisory "outside 0.130–0.200", after none. Method B, G = 0.18: before none, after "outside the Method B range 0.080–0.175 ksi". Method A, G = 0.09: advisory unchanged. Hard range (input error) unchanged.

### S4. postMessage: accept INIT only from the opener / framing page (EDM-O10, X-S10)   [bug fix] [no result change]
- **Where:** "postMessage linkage" block. Anchor: `function fromAbutment(src)`.
- **Before:**
  ```js
  window.addEventListener("message",ev=>{ const d=ev.data; if(!d||d.app!=="abutment-edm")return;
    if(d.type==="INIT"){ …
  ```
- **After:**
  ```js
  function fromAbutment(src){   // accept messages only from the window that opened this page (the Abutment app), or from the page framing it
    if(!src) return false;
    try{ if(window.opener&&src===window.opener) return true; if(window.parent!==window&&src===window.parent) return true; }catch(e){}
    return false; }
  window.addEventListener("message",ev=>{ const d=ev.data; if(!d||d.app!=="abutment-edm")return;
    if(!fromAbutment(ev.source))return;
    if(d.type==="INIT"){ …
  ```
- **Protocol:** unchanged (same `app`, `type`, payload; EDM_READY / INIT / PAD). `abutment_calculator.html` is not touched; it opens this file with `window.open`, so it is `window.opener` here. Same approach as the abutment's F10 `fromEDM`.
- **Check case:** standalone page, `window.postMessage({app:"abutment-edm",type:"INIT",payload:{loads:{Pdl:999}}},"*")`: before P_DL 80 → 999; after it stays 80. Opener hand-off (test opener page answering EDM_READY with INIT incl. 3 girders): linked, inputs applied, PAD returned, as before.

### S5. Self-test shape factor computed by the engine (EDM-O11)   [test fix] [no result change]
- **Where:** `runSelfTest()`. Anchor: `// shape factor from the engine`.
- **Before:**
  ```js
    // shape factor sanity: rectangular 18×24, hri 0.406 → S = 18·24/(2·0.406·42)
    chk("Shape factor (18×24, hri .406)", 18*24/(2*0.406*42), 12.67, 0.05);
  ```
- **After:**
  ```js
    // shape factor from the engine: rectangular 18×24, hri 0.406 → S = 18·24/(2·0.406·42) = 12.67
    { const S0=S, W0=WARN; let Sf=NaN;
      try{ S=defaultState(); S.padType="rectRein"; S.geom.L=18; S.geom.W=24; S.geom.hri=0.406; Sf=computeEDM().S; }
      finally{ S=S0; WARN=W0; }
      chk("Shape factor (18×24, hri .406) [computeEDM]", Sf, 12.67, 0.05); }
  ```
- **Check case:** 432/(2·0.406·42) = 12.667 vs 12.67 → PASS (same as before). The user's state (`S`, `WARN`) is restored: pad type, method and hri unchanged after pressing Self-Test.

### S6. EDM-O9 closed: static rotation adds absolute values   [no change]
- `thLongStatic=Math.abs(θpg)+Math.abs(θDL)+Math.abs(θc)+Math.abs(seat)` is conservative (camber usually opposes DL). The inventory default is "leave". The engineer can enter a net value in one field and 0 in the other if relief is wanted. No code change.

### Verification (whole PR)
- `node --check` on all six inline scripts of the old and new file: all pass.
- Headless Chromium (Playwright, KaTeX 0.16.11 / Plotly 2.35.2 served locally at the pinned versions), main vs branch, 15 scenarios plus the Abutment opener hand-off: default; rect; plain; Method A (tolerance 0.03 and 0.005); rect Method A with θt; rect Method A tolerance 0.005; all toggles; P_min = 10 and 40; plain 5 × 20; Method B and A with G = 0.09; P_min = −5; zero load.
  - Every result difference comes from S1 (methodA.GmA, upliftA, upliftAW and their D/Cs ×1.333) or S2 (new `anc` result, the new dashboard item and check counts, the anchorage warning, the PAD `pass` / `govDC` where the new check governs). S3 changes only the advisory text listed.
  - Everything else is identical: the rest of `LAST`, the Geometry, Rotation and Girder Run tabs, and the state apart from the two new fields.
  - Old-format saved state: GmethodA 0.150 → GmaxA 0.200; GmethodA 0.18 → GmaxA 0.18. P_min = −5 → input error and a red dot on the Loads tab.
  - No console errors. Self-test PASS. No horizontal scroll at 400 px.
- Screenshots (Loads and Code input tabs, anchorage and uplift blocks, 400 px) inspected.

### Needs engineer (left unchanged)
- EDM-O1: confirm against the printed 10th Ed. Art. 14.7.6.3.2 (1.25GS ≤ 1.25 ksi, no "fixed" increase) and 14.7.6.3.5 (0.75 circular). Recommendation: keep as built.
- EDM-O3: plain-pad rotation check. What is the 10th Ed. 14.7.6.3.5 form for plain pads? Recommendation: if it is σs ≥ 0.5GS(L/hri)²θs/n with n = 1, add it as a dashboard check.
- EDM-O4: should the construction tolerance also be added to the rectangular transverse rotation (θt about W)? Recommendation: yes for the AASHTO 0.005 per axis; MassDOT §3.5.7.6 to confirm for 0.03.
- EDM-O7: MassDOT 0.03 rad tolerance and 4.75 combined-strain limit. Confirm with MassDOT. Recommendation: keep (conservative).
- O12 and O13 in "Open items" above (anchorage basis; anchored-pad toggle).

## 2026-10-12 — PR: claude/edm-anchored (follow-up to #139; PR link added after merge)

Coordinator request after #139: (1) O13, an anchored / doweled toggle; (2) O4, the AASHTO 0.005 tolerance on the rectangular transverse rotation (MassDOT 0.03 unchanged).
Check-case pad unless stated: rectangular 18 × 24, hri = 0.5, n = 6, cover 0.25, G = 0.160, P_DL = 80, P_LL = 55, θLL = 0.004, seat slope 0.010, Δs = 0.35. Derived: A = 432 in², S = 10.286, hrt = 3.50, σDL = 0.1852, σLL = 0.1273, σTL = 0.3125 ksi; γa,st = 1.4·0.1852/(0.16·10.286) = 0.158, γa,cy = 0.108, γs = 0.100.

### A1. Anchored / doweled toggle for the anchorage check (O13)   [behaviour option; default unchanged] [LESS conservative only when switched on]
- **Where:** `defaultState().tog` (anchor `anchored:false`), panel I-5 in `buildInputs()` (new checkbox after "Exterior-beam check"), `computeEDM` (`R.anc.anchored`, new `addAnc` helper replacing the three anchorage `add(...)` calls, the anchorage warning), `ancEq(R)`, `renderDashboard` / `buildReport` check counts and the report verdict column, `inputEcho()`.
- **Problem:** an anchored or doweled pad that exceeds P_min/5 still showed FAIL and "must be secured", and failed the PAD hand-off.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024), Art. 14.7.5.4 / 14.7.6.4 (when H > P_min/5 the pad shall be secured against horizontal movement). Once secured, the anchorage must be designed for H (Art. 14.6.3.1); this tool does not design it.
- **Before:**
  ```js
      exteriorCheck:false    // exterior-beam check → uses 5.0 limit regardless
  ```
  ```js
    R.anc={G:GAnc,H:Hanc,Pmin:PminUsed,PminFromDL:!(PminIn>0),dc:ancDC,ref:(S.method==="B"&&!isPlain())?"14.7.5.4":"14.7.6.4"};
  ```
  ```js
    add("ancP","Anchorage H ≤ P_min/5 [14.7.6.4]",ancDC,"H ≤ P_min/5");
    add("anc","Anchorage H ≤ P_min/5 [14.7.5.4]",ancDC,"H ≤ P_min/5");
    add("ancA","Anchorage H ≤ P_min/5 [14.7.6.4]",ancDC,"H ≤ P_min/5");
  ```
  ```js
    if(isFinite(ancDC)&&ancDC>1.0001) warn(
  ```
  `renderDashboard` / `buildReport`: `R.dash.length` (3 places); report verdict `${d.pass?"PASS":"FAIL"}`; `ancEq` ends `+checkLine("Anchorage H ≤ P_min/5",a.dc,"["+a.ref+"]"); }`.
- **After:**
  ```js
      exteriorCheck:false,   // exterior-beam check → uses 5.0 limit regardless
      anchored:false         // pad anchored / doweled against horizontal movement → anchorage check is informational (design the anchorage for H)
  ```
  ```js
    R.anc={G:GAnc,H:Hanc,Pmin:PminUsed,PminFromDL:!(PminIn>0),dc:ancDC,ref:(S.method==="B"&&!isPlain())?"14.7.5.4":"14.7.6.4",anchored:!!tg.anchored};
  ```
  ```js
    // anchorage item: a D/C check, or (pad anchored / doweled) an informational item with no D/C and no pass/fail, so nFail / governing D/C exclude it
    const addAnc=id=>{ if(R.anc.anchored) dash.push({id,name:"Anchorage ["+R.anc.ref+"] — anchored/doweled: design the anchorage for H = "+fmt(Hanc)+" kip",dc:null,pass:null,ref:"info"});
      else add(id,"Anchorage H ≤ P_min/5 ["+R.anc.ref+"]",ancDC,"H ≤ P_min/5"); };
  ```
  The three calls become `addAnc("ancP");`, `addAnc("anc");`, `addAnc("ancA");` (same positions, same names as before when the toggle is off). Warning: `if(!R.anc.anchored&&isFinite(ancDC)&&ancDC>1.0001) warn(`.
  - Check counts: `R.dash.filter(d=>d.pass!==null).length` in place of `R.dash.length`. This is identical while there is no info item.
  - Report verdict: `${d.pass===null?"INFO":d.pass?"PASS":"FAIL"}`.
  - `ancEq`: when anchored, a grey "INFO" line "Pad anchored / doweled (panel I-5) — design the anchorage for H = … kip per bearing; H/(P_min/5) = … for reference (not a pass/fail check)" replaces the check line.
  - `inputEcho()`: new row `["Pad anchored / doweled", anchored ? "yes — anchorage force H = …" : "no", anchored ? "kip" : ""]`.
  - Checkbox (I-5): `<input type="checkbox" data-path="tog.anchored">` "Pad anchored / doweled against horizontal movement (anchorage check becomes "design the anchorage for H")".
- **Saved data:** new optional field `tog.anchored` (default false). Old files load with false and give the #139 results.
- **Effect when on:** the anchorage item has no D/C and no pass/fail. It is left out of `nFail`, the governing D/C, the check count, the D/C chart and the PAD `pass` / `govDC`. H is shown in the dashboard, the Design Checks tab, the report summary table and the input echo.
- **Check cases:**
  - Default circular pad, toggle on: H = 0.160·201.06·0.35/3.5 = 3.22 kip. Dashboard: before (off) "Anchorage H ≤ P_min/5 [14.7.5.4] (0.20) · All 7 checks PASS · governing D/C = 0.80"; on: "Anchorage [14.7.5.4] — anchored/doweled: design the anchorage for H = 3.22 kip · All 6 checks PASS · governing D/C = 0.80".
  - Default circular pad with P_min = 10 kip: off → D/C 1.61, "1 of 7 checks FAIL", PAD pass false / govDC 1.61; on → "All 6 checks PASS", PAD pass true / govDC 0.80, no "must be secured" warning; report row "… H = 3.22 kip — INFO".
  - Plain pad (default plain state), on: the 3.78 anchorage FAIL becomes info (H = 60.48 kip). Shear deformation (1.40) still fails: "1 of 3 checks FAIL · governing D/C = 1.40".
- **Other copies:** none.

### A2. AASHTO 0.005 construction tolerance added about W for the rectangular transverse checks (O4)   [calc change] [MORE conservative]
- **Where:** `computeEDM` (anchor `const tolW=`; `grW_st`; `upliftAW`), new helper `thTWtex(R)` before `hbuEq`, transverse lines and note in `renderDesign` (Method B rotational-strain block and Method A uplift block).
- **Problem:** with the AASHTO 0.005 rad tolerance selected, the tolerance was added only to the longitudinal rotation (about L). The rectangular transverse checks about W used θt alone.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024), Art. 14.4.2.1 (the design rotation includes an allowance of 0.005 rad for uncertainties, taken about each axis — verify the "each axis" reading against the printed text); used in Art. 14.7.5.3.3 (γr, Method B) and Art. 14.7.6.3.5 (Method A uplift). The MassDOT 0.03 rad option is unchanged and still applied once, to the resultant/longitudinal rotation (MassDOT §3.5.7.6), as the coordinator asked.
- **Before:**
  ```js
    R.rot={thLongStatic,thLongCyclic,thTrans,thTotal,tol:+tg.rotTol};
  ```
  ```js
    // rectangular: transverse rotation θt about W (tolerance applied once, to the longitudinal rotation, per MassDOT §3.5.7.6)
    const grW_st=(!isCirc()&&!isPlain())?Dr*Math.pow(planW/hri,2)*(thTrans/n):0;
  ```
  ```js
    const upliftAW=(!isCirc()&&!isPlain())?DrA*GmA*Sf*Math.pow(planW/hri,2)*(thTrans/n):0;   // rectangular: transverse rotation about W
  ```
- **After:**
  ```js
    // rectangular transverse checks (θt about W): the AASHTO 0.005-rad tolerance is added about this axis too [14.4.2.1]; the MassDOT 0.03 is applied once, to the resultant [§3.5.7.6]
    const tolW=(Math.abs(+tg.rotTol-0.005)<1e-9)?0.005:0;
    const thTransW=thTrans+tolW;
    R.rot={thLongStatic,thLongCyclic,thTrans,thTotal,tol:+tg.rotTol,tolW,thTransW};
  ```
  ```js
    // rectangular: transverse rotation θt about W (+0.005 with the AASHTO tolerance; MassDOT 0.03 applied once, to the longitudinal rotation, per §3.5.7.6)
    const grW_st=(!isCirc()&&!isPlain())?Dr*Math.pow(planW/hri,2)*(thTransW/n):0;
  ```
  ```js
    const upliftAW=(!isCirc()&&!isPlain())?DrA*GmA*Sf*Math.pow(planW/hri,2)*(thTransW/n):0;   // rectangular: transverse rotation about W (+0.005 with the AASHTO tolerance)
  ```
  ```js
  function thTWtex(R){ const r=R.rot; return r.tolW>0?`\\theta_t = ${fmtT(r.thTrans,4)}+${fmtT(r.tolW,3)} = ${fmtT(r.thTransW,4)}`:`\\theta_t = ${fmtT(r.thTransW,4)}`; }   // transverse rotation used about W (incl. the AASHTO tolerance)
  ```
  - The Method B transverse γr line and the Method A transverse uplift line end with `, \\quad ${thTWtex(R)}`.
  - The rectangular note in the Method B block adds: "With the AASHTO 0.005-rad tolerance it is also added to θt [14.4.2.1]; the MassDOT 0.03 rad is applied once, to the longitudinal rotation [§3.5.7.6]."
- **Not affected:** circular pads (θst is already the resultant plus the tolerance once), the displayed design rotation θs, the Method B/A longitudinal checks, plain pads, and every case with the MassDOT 0.03 option.
- **Check cases** (rectangular pad above, AASHTO tolerance 0.005):
  - Method B, θt = 0.005: γr,st,W = 0.5·(24/0.5)²·θ/6 = 192·θ. Before θ = 0.005 → 0.960, combinedW = 0.158 + 0.960 + 0.100 + 1.75·0.108 = 1.407. After θ = 0.010 → 1.920, combinedW = 2.367. Longitudinal combined = 0.158 + 0.5·36²·0.015/6 (= 1.620) + 0.100 + 1.75(0.108 + 0.432) = 2.823 still governs → combined-strain D/C 0.59, unchanged.
  - Method B, θt = 0.020: before 192·0.020 = 3.840, combinedW = 4.287, D/C 4.287/4.75 = 0.90 PASS. After 192·0.025 = 4.800, combinedW = 5.247, D/C 1.10 FAIL (governs; PAD pass true → false).
  - Method B, θt = 0: before combinedW = 0.447; after γr,st,W = 0.960, combinedW = 1.407 (longitudinal still governs).
  - Method A, θt = 0.005: σs,min,W = 0.5·0.200·10.286·48²·θ/6 = 394.97·θ. Before 1.975 ksi (D/C 1.975/0.3125 = 6.32); after 3.950 ksi (D/C 12.64).
  - MassDOT 0.03, θt = 0.005: unchanged (Method A transverse 1.975 ksi, D/C 6.32).
- **Other copies:** none.

### Verification
- `node --check` on all six inline scripts of the old and new file: all pass.
- Headless Chromium, main (a794071) vs branch, KaTeX 0.16.11 / Plotly 2.35.2 served locally, 16 scenarios plus the Abutment opener hand-off. Scenarios: default; rect; plain; Method A; circular with tolerance 0.005; rect with θt = 0.005 at 0.03 and 0.005; rect with θt = 0 at 0.005; rect Method A with θt = 0.005 at 0.005 and 0.03; rect with θt = 0.02 at 0.005; anchored (default, with P_min = 10, plain, Method A); unanchored with P_min = 10.
  - Results change only in the A2 cases above (combinedW, upliftAW and their D/Cs, only with the 0.005 option on rectangular pads) and the A1 cases (anchorage item info, counts, PAD pass/govDC).
  - Every other `LAST` value is identical. The only additions are the new fields `rot.tolW`, `rot.thTransW` and `anc.anchored`. The state differs only by the new `tog.anchored`.
  - Text changes elsewhere are the new input-echo row and the new θt line in the rectangular design blocks. Circular, plain and MassDOT-0.03 results are unchanged.
  - No console errors.
- Screenshots (I-5 with the toggle, the anchored anchorage block, the Method B and Method A transverse lines) inspected: `scratchpad/followups/edm-anchored/`.
