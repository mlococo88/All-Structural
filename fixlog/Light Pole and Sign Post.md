# Fix log — Light Pole and Sign Post.html

Governing basis used for fixes: the tool's stated basis — ASCE 7-22 (Ch. 26/29 wind), AISC 360-16, ACI 318-19 (Ch. 17, §22.4), IBC 2021 §1806/§1807.3. (Not an AASHTO LRFDLTS tool.)

## 2026-10-04 — PR: claude/fix-light-pole (PR link added after merge)

Every check case below comes from running the page in node with jsdom. I wrapped the page's own functions (`evalCombo`, `designRebar`, `anchorBolts`, `bearingCheck`, `poleStress`, `signWind`, …) to log their inputs and outputs, and ran each case on the original file and on the fixed file. Units are lb, ft and in. "Default pole" means the tool's default inputs:
- 35 ft tapered round pole, 10″→6″ diameter, 0.25/0.1875 wall, Fy 50;
- three default cables;
- 3 ft shaft;
- (6) 1″ F1554 Gr 55 anchor bolts on a 16″ bolt circle, h_ef 18″;
- anchor reinforcement "Provided".

### F1. `fmt()` no longer prints NaN/∞ as "0.00"   [display] [no result change]
- **Where:** `const fmt=` (≈ line 870). New `markErr()` function and a MutationObserver directly below it. New CSS class `.errNum` (≈ line 112).
- **Problem:** `fmt` printed any non-finite value as 0, so a broken result looked like a valid zero. Example: a blank bolt count showed "T_max 0 lb".
- **Governing provision:** n/a.
- **Before:**
  ```js
  const fmt=(x,d=2)=>(isFinite(x)?x:0).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
  ```
- **After:**
  ```js
  const fmt=(x,d=2)=>(typeof x==='number'&&isFinite(x))?x.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'ERR';
  function markErr(root){ … wraps every whole-word "ERR" text token (outside svg/.katex/script/inputs) in <span class="errNum"> … }
  try{ if(window.MutationObserver && document.body){ new MutationObserver(ms=>ms.forEach(m=>{
        if(m.type==='characterData') markErr(m.target); else m.addedNodes.forEach(nd=>markErr(nd));
      })).observe(document.body,{childList:true,subtree:true,characterData:true}); } }catch(e){}
  ```
  CSS: `.errNum{color:#b00020;font-weight:700}`.
  `fmt` feeds HTML, `textContent` and KaTeX strings (868 call sites), so it returns plain text "ERR". The observer colours it red after rendering. Inside KaTeX it shows as black "ERR". In SVG labels it stays uncoloured, but it is never a number.
- **Check case:**
  - Bolt count left blank → before: `oBoltT` "0 lb", interaction "0.00 (uncoupled) NG". After: "ERR lb" and "ERR (uncoupled) NG", with 47 red ERR tokens across the summary, anchors, worked example and report.
  - Default pole, square shaft, manual rebar, square HSS, monopost sign and 2-post sign: 0 ERR tokens (no false alarms).
- **How verified:** jsdom run.
- **Other copies of this code:** none.

### F2. Shaft P–M and anchor bolts: every LRFD combination, governing case per check; soil bearing from the max-axial ASD combination   [calc change] [more conservative]
- **Where:**
  - `designRebar` (≈ line 2938): new optional `demands` argument.
  - New `anchorsAllCombos` (≈ line 3211).
  - `designFoundationStack` (≈ line 3239): new optional `lrfdAll` and `asdAll` arguments.
  - `calcSign` call (≈ line 3289).
  - `calc()` light-pole path (≈ lines 3730–3770).
  - `collectChecks` (≈ line 2440).
  - Bearing example calls (≈ lines 4030, 5048, 5520).
- **Problem:**
  - Bolt tension (`Mu·y/Σy² − Pu/n`) and shaft P–M were evaluated only for the max-moment LRFD combination.
  - For a sign, M is identical in 1.2D+W and 0.9D+W, and the strict `>` kept 1.2D, so the low-axial 0.9D+W case was never checked.
  - Soil bearing used the axial of the max-moment ASD combination, not the maximum axial.
- **Governing provision:** ASCE 7-22 §2.3.1/§2.4.1 (all combinations must be checked); ACI 318-19 §22.4 and Ch. 17.
- **Before (light pole):**
  ```js
  const Mu=govLRFD.M, Pu=govLRFD.axial, Vu=govLRFD.P;
  const reo=designRebar(inp,Mu,Pu,Vu);
  ...
  const bearing=bearingCheck(inp, govASD.axial);
  ...
  const struct0={Mu,Pu,Vu};
  const bolts=anchorBolts(inp,govLRFD,struct0);
  ```
- **After (light pole):**
  ```js
  const lrfdCands=lrfdList.map(r=>({name:r.name, M:r.M, axial:r.axial, P:r.P, Mang:r.Mang}));
  const VuMax=Math.max(...lrfdCands.map(c=>c.P));
  const reo=designRebar(inp,govLRFD.M,govLRFD.axial,VuMax,lrfdCands.map(c=>({Mu:c.M,Pu:c.axial,name:c.name})));
  const shaftGov=reo.long.govDem||{Mu:govLRFD.M,Pu:govLRFD.axial,name:govLRFD.name};
  const Mu=shaftGov.Mu, Pu=shaftGov.Pu, Vu=VuMax;
  ...
  const govAxASD=asdList.reduce((a,x)=>x.axial>a.axial?x:a);
  const bearing=bearingCheck(inp, govAxASD.axial); bearing.axial=govAxASD.axial; bearing.comboName=govAxASD.name;
  const bolts=anchorsAllCombos(inp, lrfdCands);
  ```
- **designRebar:**
  - Adds `const DEM=(demands&&demands.length)? demands : [{Mu,Pu}];` and `capAll(As,nb,rb)`. `capAll` evaluates `pmCapacity` for every (Mu, Pu) pair and returns the pair with the largest Mu/φMn.
  - In manual mode the check `flex: cap.phiMn >= Mu` becomes `flex: gv.u <= 1`.
  - In auto mode the condition `cap.phiMn>=Mu` becomes `gv.u<=1`.
  - The choice carries `govDem`.
  - With `demands` omitted the result is identical to before.
- **anchorsAllCombos:** runs `anchorBolts` for each LRFD case at that case's governing wind azimuth.
  - Returns the overall governing case (max of t_r, v_r and interaction/limit) plus `byCheck:{T,V,I}`.
  - `collectChecks` now takes each anchor check from its own governing case.
  - The anchor table gets a row naming the governing combination for each check.
- **Sign path:** `designFoundationStack` receives every LRFD and ASD per-post case: `lrfdCombos.map(x=>({name, M, axial, P, Mang:x.phi}))` and `asdCombos.map(x=>({name, axial}))`.
- **Check cases:**
  - **Monopost sign** (8×4 ft panel, 7 ft clearance; Mu = 10,752 lb·ft in both 1.2D+W and 0.9D+W; Pu = 634 vs 475 lb). Bolt T = Mu·12·y/Σy² − Pu/n, with y = 8 in, Σy² = 192 in², n = 6.
    - 1.2D+W: 5,376 − 106 = 5,270 lb.
    - 0.9D+W: 5,376 − 79 = 5,297 lb.
    - Before: tension check from 1.2D+W, t_r = 0.261. After: tension governed by 0.9D+W, t_r = 0.263.
    - Shaft P–M: governing pair is now 0.9D+W (Pu = 475), φMn 254,888 → 254,772 lb·ft.
  - **Default pole, bearing:** before P = 906 lb (D + 0.6W) → q = 0.128 ksf. After P = 1,117 lb (D + 0.7Di, max axial) → q = 0.158 ksf.
  - **Default pole, shaft:** governing pair is now 0.9D+W (Pu = 816 vs 1,088). φMn 255,217 → 255,020 lb·ft. V_u = max over LRFD = 669 lb.
- **How verified:** jsdom run, logging every call.
- **Other copies of this code:** none.

### F3. Pole/post checked at the base section (z = 0)   [calc change] [more conservative]
- **Where:** new `poleBaseSection` (≈ line 1535). `poleStress` and `signPostStress` add it as the last row. `govRow` for a prismatic section is the base row. The text in `poleWorkedBody` and the report now says the base section is checked.
- **Problem:** rows were evaluated only at segment mid-heights (lowest z = H/20). The base-plate section was never checked.
- **Governing provision:** AISC 360-16 §H1.1 at the maximum-moment section.
- **Before:**
  ```js
  const rows=poleSeg.segs.map(s=>{
  ...
  const govRow = prismatic ? rows[rows.length-1] : rows.reduce((a,x)=>x.ratio>a.ratio?x:a);
  ```
  (signPostStress) `const rows=poleSeg.segs.map(s=>{` … `const govRow=rows[rows.length-1];`
- **After:**
  ```js
  const rows=poleSeg.segs.concat([poleBaseSection(poleSeg,inp)]).map(s=>{
  ...
  const govRow = prismatic ? rows[rows.length-1] : rows.reduce((a,x)=>(isNaN(x.ratio)||x.ratio>a.ratio)?x:a);
  return {rows, govRow, …, lim:hssLimitFlags(rows,shape,E,Fy)};
  ```
  `poleBaseSection` builds `hssProps(shape, base dims)` at `zMid:0`, with `cumWabove:poleSeg.totalW` and `i:'Base'`.
- **Check case:** 2-post sign, B = 30, s = 2, clearance 8 ft. Before: governing row z = 0.50 ft, M = 16,089 lb·ft, ratio 0.678. After: base row z = 0, M = 17,052 lb·ft, ratio 0.719 (+6%).
  Default pole: the base row (ratio 0.204) now governs over z = 1.75 ft (0.200).
- **How verified:** jsdom run. **Other copies:** none.

### F4. Sign Case C: no double count of the 3s–10s strip; 10 < B/s < 13 interpolated   [calc change] [less conservative for B/s ≥ 13; more conservative for 10 < B/s < 13 and for 2 < B/s < 4]
- **Where:** `signCaseC` (≈ line 1274). Anchor text: `const SPLIT=['3s to 4s','4s to 5s','5s to 10s','>10s'];`
- **Problem:**
  - For B/s ≥ 13, both '3s to 10s' and its replacement strips ('3s to 4s', '4s to 5s', '5s to 10s') were loaded.
  - For 10 < B/s < 13, '3s to 10s' was held at 0.95 and the '>10s' strip got no load.
  - For B/s < 4 (or < 3), a strip that physically exists between 3s (or 2s) and B got no load.
- **Governing provision:** ASCE 7-22 Fig. 29.3-1, Case C table and notes (linear interpolation permitted).
- **Before:**
  ```js
  SIGN_C_REGIONS.forEach(r=>{
    const cols=[], vals=[];
    r.v.forEach((v,idx)=>{ if(v!==null){cols.push(SIGN_C_BS[idx]); vals.push(v);} });
    if(vals.length===0) return;
    if(bs<cols[0]) return;               // region not applicable below its range
    const cf=interp1(cols,vals,bs)*factor;
    regs.push({lab:r.lab, cf});
  });
  ```
- **After:**
  ```js
  const SPLIT=['3s to 4s','4s to 5s','5s to 10s','>10s'];
  const r310=SIGN_C_REGIONS.find(r=>r.lab==='3s to 10s');
  const v310at10=r310.v[SIGN_C_BS.indexOf(10)];
  SIGN_C_REGIONS.forEach(r=>{
    const isSplit=SPLIT.indexOf(r.lab)>=0;
    if(r.lab==='3s to 10s' && bs>10) return;
    if(isSplit && bs<=10) return;
    const cols=[], vals=[];
    r.v.forEach((v,idx)=>{ if(v!==null){cols.push(SIGN_C_BS[idx]); vals.push(v);} });
    if(isSplit){ cols.unshift(10); vals.unshift(r.lab==='>10s'?0.55:v310at10); }
    if(vals.length===0) return;
    const cf=(bs<cols[0]? vals[0] : interp1(cols,vals,bs))*factor;
    regs.push({lab:r.lab, cf});
  });
  ```
- **Check case:** s = 2 ft, clearance 8 ft (h = 10, s/h = 0.2), q_h = 20.76 psf.
  - **B/s = 15 (B = 30):**
    - Before: bands 0–s 333.8, s–2s 215.7, 2s–3s 165.9, **3s–10s 552.3** (cf 0.95 × 28 ft²), 3s–4s 126.4, 4s–5s 114.7, 5s–10s 379.0, >10s 228.4. F = 2,116 lb, e = −4.46 ft.
    - After: the 3s–10s band is gone. F = 1,564 lb (−26%), e = −5.33 ft.
  - **B/s = 11.5:** before F = 1,244 lb (3s–10s at 0.95, the 1.5s-wide >10s strip unloaded). After: 3s–4s cf = (0.95+1.50)/2 = 1.225, 4s–5s 1.15, 5s–10s 0.925, >10s 0.55 → F = 1,341 lb.
  - **B/s = 3.5:** before, the 3s–3.5s strip was unloaded (F = 480 lb). After it takes cf 1.10 (the first tabulated value) → F = 525 lb.
- **Less conservative note:** for B/s ≥ 13, the Case C force drops (the old value was a double count). Case C only feeds the 2-post split.
- **How verified:** jsdom run. **Other copies:** none.

### F5. Cable transverse wind reaction w_h·L/2   [calc change] [more conservative]
- **Where:** `cableComponents().react` (≈ line 1173), `evalComboDir` (≈ lines 1642–1693), `poleStress` cList (≈ line 2724), and an H_w column in the worked demand table (`demandWorkedHTML`).
- **Problem:** each support of a cable carries half the transverse wind span load, w_h·L/2. This is the horizontal counterpart of V_c = w_v·L/2, and it was never added. Only the along-cable catenary pull was.
- **Governing provision:** statics of a cable under a transverse line load (ASCE 7-22 wind on the cable as an appurtenance).
- **Before:**
  ```js
  const Vc = wv*c.L/2;
  const Hx=Hpull*Math.cos(c.th*RAD), Hy=Hpull*Math.sin(c.th*RAD);
  return {Ht:Hpull, Vc, Hh:0, Hx, Hy, wRes:wR, Hpull};
  ```
  (poleStress) `const cList=gov.per.map(r=>({hc:r.cp.c.hc, Hx:r.Hx, Hy:r.Hy, Vc:r.Vc}));`
- **After:**
  ```js
  const Vc = wv*c.L/2;
  const Hw = wh*c.L/2;
  const Hx=Hpull*Math.cos(c.th*RAD), Hy=Hpull*Math.sin(c.th*RAD);
  return {Ht:Hpull, Vc, Hh:0, Hw, Hx, Hy, wRes:wR, Hpull};
  ```
  In `evalComboDir`: `sHw+=r.Hw; MHw+=r.Hw*cp.c.hc;`, then `Vx+=sHw*cw; Vy+=sHw*sw; Mx+=MHw*cw; My+=MHw*sw;`. The result returns `cableWindH`/`cableWindM`.
  In poleStress: `Hx:r.Hx+(r.Hw||0)*cw, Hy:r.Hy+(r.Hw||0)*sw`.
- **Assumption (conservative):** H_w is applied along the wind direction using the full w_h for every cable, whatever the cable's azimuth. This matches the existing along-cable pull model, which also uses the full w_h. See O7.
- **Check case:** default pole, 1.2D+1.0W, wind φ = 0.
  - w_h = 1.6744 / 1.6744 / 1.6518 lb/ft for L = 80 / 70 / 90 ft, h_c = 32 / 32 / 30 ft.
  - H_w = 67.0 + 58.6 + 74.3 = 199.9 lb. ΣH_w·h_c = 6,249 lb·ft.
  - Before: M = 10,190 lb·ft, V = 469 lb. After: M_x 10,145 → 16,394, so M = 16,421 lb·ft (+61%), V = 669 lb.
  - The governing ASD embedment moment rises from 6,132 to 9,871 lb·ft.
- **How verified:** jsdom run. **Other copies:** none.

### F6. Anchors: tension-breakout A_Nc from the tension anchors only; ψ_ec,N from the tension-anchor centroid; φ matches the reinforcement choice   [calc change] [more conservative]
- **Where:**
  - `anchorBolts` (≈ lines 3078–3190). Anchor text: `TENSION breakout uses the projected area of the anchors IN TENSION only`.
  - `boltWorkedHTML` (≈ lines 4184–4216).
- **Problem:**
  - A_Nc was the whole bolt-circle cap π·min(R + 1.5h_ef, R_edge)², so it included bolts in compression.
  - ψ_ec,N was fixed at 1.0 ("symmetric").
  - φ_breakout was 0.75 always, with the comment "Condition B", which is the Condition A value.
- **Governing provision:** ACI 318-19 §17.6.2.1 / Fig. R17.6.2.1(b) (A_Nc of the tension anchors); §17.6.2.3 (ψ_ec,N); Table 17.5.3 (Condition A 0.75 / Condition B 0.70).
- **Before:**
  ```js
  const ANc=Math.PI*capR*capR;                       // projected breakout area (in²) — circular cap
  ...
  const eN=0;
  const psi_ec = 1/(1 + 2*eN/(3*hef));
  ...
  const Ncbg = (ANc/ANco)*psi_ec*psi_ed*psi_c*psi_cp*Nb;
  const hasAnchRe = anchRe==='yes';
  const phiBrk = 0.75;                                // §17.5.3 (Condition B, supplementary reinf or anchor reinf)
  ...
  const Vcp=kcp*Ncbg;
  ```
- **After:**
  ```js
  const ANcAll=Math.PI*capR*capR;                    // whole-group area — used for PRYOUT only
  ...
  const tb=tension.length? tension : bolts;
  let ANcT=0;  // union of 3h_ef×3h_ef squares (axes along/across the moment direction) around each
               // tension bolt, clipped by the shaft circle R_edge — 240×240 grid integration
  const ANc=Math.min(ANcT, tb.length*ANco);
  // e'_N per axis = |tension resultant − tension-anchor centroid|, factors multiplied
  const psi_ec = Math.min(1,1/(1 + 2*eN1/(3*hef)))*Math.min(1,1/(1 + 2*eN2/(3*hef)));
  const Ncbg = (ANc/ANco)*psi_ec*psi_ed*psi_c*psi_cp*Nb;
  const NcbgAll = (ANcAll/ANco)*psi_ed*psi_c*psi_cp*Nb;   // pryout, unchanged
  const phiBrk = hasAnchRe ? 0.75 : 0.70;
  const brkCond = hasAnchRe ? 'Condition A' : 'Condition B';
  ...
  const Vcp=kcp*NcbgAll;
  ```
  Each bolt also stores its perpendicular coordinate `v=R*Math.sin((ang-thM)*RAD)`.
- **Decision:** "anchor reinforcement: Provided" is taken as the Condition A reinforcement. With "None", φ = 0.70 (Condition B). When Provided, breakout is excluded from φN_n anyway, as before.
- **Check case:** 6 ft shaft (R_edge 36″), BC 24″ (R 12″), h_ef 8″, 6 × 1″ bolts, reinforcement None, LRFD 1.2D+W (default pole loads).
  - Tension bolts: #1 (u 11.98, v 0.70, T 5,283), #2 (5.39, 10.72, 2,276), #6 (6.59, −10.03, 2,826).
  - Before: A_Nc = π·(min(24, 36))² = 1,809.6 in², ψ_ec = 1, φ = 0.75 → φN_cbg = 80,926 lb (on the before-F5 loads).
  - After: A_Nc = 1,219 in² (3 squares of 576 less overlap; ≤ 3 × 576), e′_N1 = 1.08, e′_N2 = 0.49 → ψ_ec = 0.881. N_cbg = (1219/576)(0.881)(1.0)(1.0)(1.0)(34,346) = 64,066 lb, φ = 0.70 → φN_cbg = 44,846 lb.
  - Single tension bolt (1.2D+1.0Di): A_Nc = 576 = A_Nco ✓.
  - Pryout unchanged: φV_cpg = 151,062 lb before and after.
  - Default pole (3 ft shaft, h_ef 18″): A_Nc stays 1,018 in², because the squares cover the whole shaft. ψ_ec = 0.963, so φN_cbg 24,615 → 23,707 lb.
- **How verified:** jsdom run. **Other copies:** none (BasePlateAnchorDesigner has its own implementation).

### F7. Anchor shear breakout and side-face blowout: prominent "NOT CHECKED"   [display]
- **Choice:** I did not implement §17.7.2 (shear breakout) or §17.6.4 (side-face blowout) for a bolt circle in a round shaft. The curved edge and the group geometry need engineering decisions (c_a2 on a curved edge, which bolts act as the group along the edge, A_Vc geometry), so per the brief I added a prominent warning instead.
- **Where:**
  - New `boltNotCheckedRows(b)`, appended to both anchor limit-state tables (light pole and per-post sign).
  - A red box in the Summary (`summaryHTML`).
  - The `sfbApplies = ca1 < 0.4*hef` flag in `anchorBolts`.
- **Display:**
  - Shear breakout always shows "NOT CHECKED — verify separately".
  - Side-face blowout shows "NOT CHECKED — applies (c_a1 < 0.4h_ef)" or "N/A — c_a1 ≥ 0.4h_ef (§17.6.4.1)", which is code-definitive.
- **Check case:** default pole: c_a1 = 18 − 8 = 10 in ≥ 0.4·18 = 7.2 → side-face blowout N/A; shear breakout "NOT CHECKED" shown on the Anchors tab and the Summary.

### F8. Round HSS D/t < 0.45E/Fy check; E7 slender-wall warning   [new check] [more conservative]
- **Where:** new `hssLimitFlags` (≈ line 1555). The `lim` field is returned by `poleStress`/`signPostStress`. A new check in `collectChecks`, and a warning in `summaryHTML`.
- **Governing provision:** AISC 360-16 §F8 (applies to round HSS with D/t < 0.45E/Fy); Table B4.1a λ_r (round 0.11E/Fy, rectangular wall 1.40√(E/Fy)) for §E7.
- **After:**
  ```js
  push('Round HSS D/t < 0.45E/Fy','AISC 360-16 §F8 scope',pstress.lim.maxSl,pstress.lim.dtLim,'—',pstress.lim.dtOK);
  ```
  It is checked over all rows, including the base. E7 is only a warning: "slender compression element … §E7 effective-area reduction is not applied".
- **Check case:** wall 0.035″ on the 10″ base → D/t = 285.7 > 0.45·29000/50 = 261.0 → FAIL chip. D/t > 0.11E/Fy = 63.8 → E7 warning. Default pole: D/t = 40 → pass, no warning.

### F9. `activeTab` key: kept, but foreign values ignored   [robustness]
- **Where:** init IIFE (≈ line 5802).
- **Before:** `try{ const t=localStorage.getItem('activeTab'); if(t) switchTab(t); }catch(e){}`
- **After:**
  ```js
  try{ const t=localStorage.getItem('activeTab');
       const valid=Array.from(document.querySelectorAll('#tabBar button')).some(b=>b.dataset.tab===t);
       if(t && valid) switchTab(t); }catch(e){}
  ```
  The key name and the write in `switchTab` are unchanged.
- **Check case:** stored value "foo" → before: no visible page (blank results area); after: the Geometry page shows. Stored "summary" opens Summary in both versions.

## Open items (not changed)
- **O1. Kd = 0.85 recommended for round masts** (default and manual). ASCE 7-22 Table 26.6-1 gives 1.0 for round chimneys/tanks/similar structures, while 0.85 applies to solid signs and trussed towers. **Question:** which Kd do you want as the default for round light masts, and should the mast and sign use different Kd?
- **O2. G for flexible poles:** G = 0.85 (rigid) is used, with no natural-frequency or G_f check. Decide whether to add an n₁ estimate and a warning.
- **O3. P-δ / B1** amplification of first-order moments (AISC Ch. C) is not applied, and no warning was added. Decide whether to add a B1 estimate.
- **O4. Wind-on-ice omits G** (conservative, about +18%). Left as is per the brief.
- **O5. IBC §1806.3.4** cap (lateral bearing increase ≤ 15× the tabulated value) is not applied. Left as is per the brief.
- **O6. A blank or zero pole height H or shaft diameter b crashes `calc()`** in `drawElev` ("Invalid array length"), in both the original and fixed files. The page then keeps the stale results. Input validation (AUDIT B12) was not in this brief.
- **O7. Cable transverse reaction (F5)** uses the full w_h along the wind direction for every cable. Projecting it normal to each cable (w_h·|sin(φ−θ)|, directed normal to the cable) would be more accurate and less conservative. For the default pole this one assumption raises the base moment by 61%. Please confirm.
- **O8. Shear breakout / side-face blowout (F7)** are not computed. A method for a bolt circle in a round shaft is needed if you want them implemented.
- **O9. Pole/post combined stress** still uses the max-moment LRFD combination. Lower axial reduces the H1 ratio, so that combination governs for these structures, but it is not proven for every case.
