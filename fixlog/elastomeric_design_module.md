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
- O4. **Construction tolerance on transverse rotation.** The MassDOT tolerance (0.03) is applied once (to the longitudinal rotation / resultant), per the existing §3.5.7.6 note. It is not applied to the rectangular transverse check (F3, F6). AASHTO 14.4.2.1's 0.005 rad may apply about each axis. — Engineer to decide.
- O5. **Method A uplift G.** The uplift check still uses `GmethodA` = 0.150. The least favourable G for a minimum-stress check is the upper bound (0.200 for 60 durometer). Not changed (brief scope: stress limit only). Recommend an upper-bound G input.
- O6. **Method B G range.** `VALID` warns outside 0.130–0.200 ksi; the Method B material range is 0.080–0.175 ksi (14.7.5.2). Not changed.
- O7. **MassDOT values kept (needs MassDOT confirmation):** construction rotation tolerance 0.03 rad (AASHTO 14.4.2.1: 0.005) and combined-strain limit 4.75 (AASHTO 5.0).
- O8. **Anchorage / slip check (14.7.5.4 / 14.7.6.4).** Not added; this needs a minimum vertical load input.
- O9. **Rotation sign handling.** The static rotation adds absolute values (camber usually opposes DL). Conservative; not changed.
- O10. **postMessage origin.** The EDM `message` handler still checks only `d.app`; acceptable for `file://` (not in this brief).
- O11. **Self-test.** The shape-factor case is still a literal expression, not engine code. Not changed.

## Resolved items
- O2. **Plain-pad G·S coefficient (F7).** Default 1.00 (FGP). For plain elastomeric pads (PEP), the 10th Ed. coefficient may be lower (older specifications used GS/1.8 ≈ 0.55GS for plain pads). — Engineer to confirm the coefficient for MassDOT 1 × 5 plain pads and set `coef.GSplainA`.
  - **RESOLVED 2026-10-04 (F11):** engineer keeps the coefficient at 1.00. No code change; default already 1.00.
