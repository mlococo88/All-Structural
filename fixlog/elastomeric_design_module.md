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
