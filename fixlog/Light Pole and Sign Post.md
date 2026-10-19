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

## 2026-10-04 — Engineer decisions applied

Check cases: jsdom runs of the page before and after this change (scratch harness `jsd/kd.js`, wrapping `evalCombo`, `solveEmbed`, `designRebar`, `anchorBolts`, `poleStress`/`signPostStress`, `signWind`). Units lb, ft, in.

### F10. K_d per component from ASCE 7-22 Table 26.6-1 (engineer: "use ASCE")   [calc change] [more conservative for round poles/posts]
- **Where:** new functions `kdComponents()` and `kdStr()` just above `calc()`; `calc()` inp object (anchor `Kd:kdComponents().mast`); `signWind` (anchor `inp.KdSign*inp.G*inp.V*inp.V`); Wind & site card (anchor `id="KdMode"`); `applyState` migration (anchor `// K_d source (added 2026-10)`); `INPUT_IDS`; report echoes; manual §Wind inputs table.
- **Problem:** a single K_d = 0.85 was applied to every component. ASCE 7-22 Table 26.6-1 gives 0.85 for solid freestanding signs, but 1.0 for round chimneys, tanks and similar structures and 0.90 for square ones. The round mast was therefore under-loaded by 15%.
- **Governing provision:** ASCE 7-22 §26.6 and Table 26.6-1 (the tool's stated wind basis).
- **Rule now used (K_d source = "Per component", the default):**
  - mast / sign post, round (multi-sided treated as round): 1.0;
  - mast / sign post, square or rectangular HSS: 0.90;
  - solid sign panel (Ch. 29, `signWind` q_h): 0.85;
  - cables and fixtures: the mast value. **Assumption** (conservative); Table 26.6-1 has no row for them.
  - "Single value (override)" applies the existing K_d input to every component, which is the old behaviour.
- **Before:**
  ```js
  <div class="row"><label>K<sub>d</sub> directionality</label><div class="ctl"><input id="Kd" type="number" value="0.85" step="0.05"><span class="unit">—</span></div></div>
  const inp={V:num('V'),expo:$('expo').value,Kzt:num('Kzt'),Kd:num('Kd'),G:num('G'),
  const qh=0.00256*Kzh*inp.Kzt*inp.Kd*inp.G*inp.V*inp.V;   // velocity pressure at sign top
  const INPUT_IDS=['V','expo','Kzt','Kd','G', …
  ```
- **After:**
  ```js
  <div class="row"><label>K<sub>d</sub> source<span class="note">ASCE 7-22 Table 26.6-1</span></label><div class="ctl"><select id="KdMode"><option value="auto" selected>Per component (Table 26.6-1)</option><option value="override">Single value (override)</option></select></div></div>
  <div class="row"><label>K<sub>d</sub> directionality<span class="note">override value, used only when source = single value</span></label><div class="ctl"><input id="Kd" type="number" value="0.85" step="0.05"><span class="unit">—</span></div></div>
  <p class="tbl-note" id="kdUsedNote" style="margin:-4px 0 8px 0"></p>
  <p class="tbl-note" id="kdMigNote" style="margin:0 0 8px 0;display:none;color:#b45309"></p>

  function kdComponents(){
    const ov=($('KdMode')&&$('KdMode').value==='override');
    const shp=$('poleShape')?$('poleShape').value:'round';
    const mast=ov?num('Kd'):(shp==='round'?1.0:0.90);
    return {mode:ov?'override':'auto', mast, sign:ov?num('Kd'):0.85};
  }
  function kdStr(inp){ … }   // display text, e.g. "1.00 (post) / 0.85 (sign panel)"

  const inp={V:num('V'),expo:$('expo').value,Kzt:num('Kzt'),Kd:kdComponents().mast,KdSign:kdComponents().sign,KdMode:kdComponents().mode,G:num('G'),
  const qh=0.00256*Kzh*inp.Kzt*inp.KdSign*inp.G*inp.V*inp.V;   // velocity pressure at sign top (K_d of the solid sign)
  const INPUT_IDS=['V','expo','Kzt','Kd','KdMode','G', …
  ```
  `inp.Kd` now carries the mast/post value, so the mast (`poleWindNominal`), the sign post drag (`qzPost`), cables (`cableComponents`) and fixtures (`fixtureComponents`) use it without further edits. After `inp` is built, `calc()` writes the K_d used into `#kdUsedNote`. The report echoes (key-inputs table, pole report §0, sign report §0) now print `kdStr(inp)`. The sign worked example q_h prints `inp.KdSign`.
- **Saved data / migration:** storage keys unchanged. `KdMode` is a new optional field in `inputs`. In `applyState`, a save without `KdMode` is migrated: a stored K_d of 0.85 (the old default) → source "Per component", and a visible note `#kdMigNote` says that the results may differ and how to reproduce the old run. Any other stored K_d → source "Single value (override)" with that value kept, plus a note. Saves that carry `KdMode` load as saved, with no note.
- **Manual:** the K_d row of the wind input table (which recommended 0.85 for round and rectangular members) now states the per-component values. The K_d warning now refers to "the Table 26.6-1 K_d values" instead of "K_d = 0.85".
- **Check case 1, default cabled light pole** (35 ft round tapered pole, 3 cables, 3 fixtures; governing 1.2D + 1.0W):
  - Hand check: K_d 0.85 → 1.0 scales every wind force by 1/0.85 = 1.176. q_z,mid = 25.23 → 29.69 psf (25.23/0.85 = 29.68). F_pole = 350.3 → 412.2 lb. Fixture 1 q_z = 24.82 → 29.20 psf. Cable 1 w_h = 1.6744 → 1.9699 lb/ft.
  - LRFD base moment M = 16,421 → 19,310 lb·ft (+17.6%); V = 669 → 787 lb.
  - ASD (D + 0.6W) embedment moment 9,871 → 11,599 lb·ft; embedment d = 5.89 → 6.24 ft.
  - Shaft: (12) #6, φM_n = 255,020 lb·ft, unchanged (min. steel governs).
  - Anchors: T_max = 8,055 → 9,498 lb; tension ratio 0.400 → 0.471.
  - Pole combined ratio 0.204 → 0.237.
- **Check case 2, monopost sign** (default 12 × 6 ft panel, 10 ft clearance, round post):
  - Sign panel q_h = 21.05 psf and F_A = 2,671.1 lb, unchanged (K_d 0.85 for both).
  - Exposed post drag: q_z = 20.76 → 24.43 psf, F_post = 72.7 → 85.5 lb.
  - LRFD base M_u = 35,087 → 35,151 lb·ft. ASD M = 21,052 → 21,091 lb·ft; embedment 8.30 → 8.31 ft.
  - Anchors: T_max = 17,456 → 17,488 lb; ratio 0.866 → 0.867. Post ratio 1.482 → 1.485.
  - Square HSS post (K_d 0.90): F_post 72.7 → 77.0 lb, M_u 35,087 → 35,109 lb·ft.
- **Override check:** source = single value with K_d = 0.85 reproduces the old default pole exactly (M = 16,421 lb·ft).
- **How verified:** `node --check` on the inline script (`syncheck.js`). jsdom runs before and after (`jsd/kd.js`). Migration test (`jsd/kdmig.js`): an old save with K_d 0.85 → auto with the note shown; an old save with 0.9 → override 0.9 with the note; a new save with override 0.85 → no note, and M = 16,421; the UI select switch recalculates. Smoke test `jsd/t6.js`: no error spans in pole and sign modes.
- **Other copies of this code:** none known.

### F11. Cable transverse wind: full w_h on every cable kept (engineer's decision)   [decision record] [no result change]
- **Where:** `evalComboDir` / `cableComponents().react`, see F5. Anchor `const Hw = wh*c.L/2;`
- **Decision:** the engineer keeps the full transverse wind w_h·L/2 on every cable, applied along the wind direction whatever the cable azimuth (F5 as written). It is not projected normal to each cable.
- **Governing provision:** as F5.
- **Before / After:** unchanged (F5 code).
- **Check case:** F5 numbers stand. With F10's K_d = 1.0, cable 1 w_h is 1.9699 lb/ft.
- **How verified:** no code change.
- **Other copies of this code:** none known.

## 2026-10-04 — "All tools" link and shared project info
### F12. "← All tools" link (no title block, so no project-info buttons)   [feature (no result change)]
- **Date:** 2026-10-04. **Type:** feature (no result change). Approved by the engineer (step 1 of the cross-tool hand-off work, HANDOFF.md §4.1).
- **What:** a small "← All tools" link to `tools.html` (`target="_top"`, because tools can be shown inside index.html's iframe), placed in the sticky project bar `.projbar` (already hidden in print), before the "Project" label. It is hidden in print.
- **Storage:** unchanged.
- **Where / Before / After** (each change is an insertion; the Before text is the anchor and is kept):
  1. Anchor: `.projbar .pb-status.saved{color:#8fca9b}`
     - Before:
       ```
         .projbar .pb-status.saved{color:#8fca9b}
       ```
     - After:
       ```
         .projbar .pb-status.saved{color:#8fca9b}
         .projbar .pb-link{font-size:11.5px;color:#c9b8a8;text-decoration:none}
         .projbar .pb-link:hover{color:#fff;text-decoration:underline}
       ```
  2. Anchor: `<div class="projbar noprint">`
     - Before:
       ```
       <div class="projbar noprint">
         <span class="pb-label">Project</span>
       ```
     - After:
       ```
       <div class="projbar noprint">
         <a class="pb-link" href="tools.html" target="_top" title="Open the list of all tools">&larr; All tools</a>
         <span class="pb-label">Project</span>
       ```
- **Governing provision:** none. UI and cross-tool data hand-off only (HANDOFF.md §2, §4.1, §5). No formula, factor, unit, code reference or computed result changed.
- **Check case:** not applicable (no calculation touched). Functional check: the link opens `tools.html` in the top window.
- **How verified:** `node --check` on every plain inline script; text/babel blocks transpiled with @babel/standalone; page loaded in jsdom with CDN libraries stubbed (React UMD served locally); Share → Use exercised across Spread Footing, BasePlateAnchorDesigner, Pile Designer, Concrete Anchor and Timber Beam Check (Timber: plain scripts in jsdom, the same calls its onClick handlers make, since it imports React from esm.sh) with a localStorage carried between pages; `git diff --numstat` shows only insertions.
- **Other copies:** the same link is added to the other tools in the step-1 PRs. Light Pole and Sign Post has no title-block fields (its project bar only names saved projects), so it gets no BridgeXfer helper or project-info buttons.

## 2026-10-09 — Input panel tabs (branch claude/tabs-lightpole)
### F13. Input panel split into tabs   [UI only — no calculation change]
- **Date:** 2026-10-09. **Type:** UI only. No calculation change. Engineer's request (2026-10-09): "make sure they are all formatted with the input panel having tabs rather than one long scrolling input panel."
- **What:** the input cards in `.col-in` are moved into tab panes when the page starts. The Light pole / Sign mode card stays above the tab strip, so it is always visible. Nothing is rebuilt. `lppInputTabs()` moves the existing `<section class="card">` nodes, so every id, handler and value stays the same. All inputs stay inside `.col-in`, so the existing `.col-in input, .col-in select` wiring still finds them.

  | Tab | Light pole mode | Sign mode |
  |---|---|---|
  | Wind & site | 1 Wind & site | 1 Wind & site |
  | Pole / **Post & sign** (label follows the mode) | 2 Pole | 2 Post + 2b Sign panel |
  | Fixtures | 3 Luminaires & fixtures | hidden (card hidden by `applyMode`) |
  | Cables | 4 Catenary cables (also shown when "Enabled" is unticked, as today) | hidden |
  | Ice | 5 Ice & wind-on-ice | hidden |
  | Shaft & soil | 6 Shaft & soil | 6 Shaft & soil |
  | Anchors | 7 Anchor bolts & base plate | 7 Anchor bolts & base plate |

  `applyMode()` still shows and hides cards and rows exactly as before. Afterwards it calls `lppInTabsSync()`, which hides any tab whose cards are all `display:none`. If the shown tab becomes hidden, the first visible tab is shown instead. The remembered tab comes back when the user returns to light-pole mode.
- **Storage:** new key `lpp_inputTab_v1` (follows the tool's `lpp_` prefix). It holds the active input tab, per browser. It is written only when a tab is clicked or picked with the keyboard. Reads and writes are wrapped in try/catch, with an in-memory fallback. An unknown stored value falls back to the first visible tab. The key is not part of `captureState()`, so `lpp_session_v1`, `lpp_projects_v1` and saved projects are unchanged. Existing keys are unchanged, including the generic `activeTab` (output tabs, see F9 and O10).
- **Error marker:** a red dot on a tab that holds a shown number input with `validity.badInput` (text the browser cannot parse, e.g. "4000e"). The tool has no other per-input error state: `num()` turns blank or bad text into 0, and only the outputs show "ERR" (F1). Inputs in rows or cards hidden by the mode are ignored.
- **Keyboard / ARIA:** `role=tablist/tab/tabpanel`, `aria-selected`, `aria-controls`, roving tabindex. Arrow keys, Home and End move between visible tabs.
- **Print:** unchanged. `@media print` already hides `.col-in` (the whole input column), and the tab strip is inside it.
- **Where / Before / After** (all insertions; the Before text is the anchor and is kept):
  1. CSS. Anchor: `.tabpage>section.card:first-child{margin-top:0}`
     - After it, insert the block that starts `/* ---- input panel tabs (lppInputTabs; UI only) ---- */`: `#lppInTabs` (sticky, wraps, styled like the output `.tabbar`), `.lppInTab`, `.lppInDot`, `[hidden]` rules, and `@media(max-width:900px){#lppInTabs{position:static}}`. At ≤ 900 px the column no longer scrolls on its own; the page does.
  2. `applyMode()`. Anchor: `show('rowSignCfMan', sign && $('signCfMode') && $('signCfMode').value==='manual');`
     - After it, insert: `lppInTabsSync();   // input tabs: hide a tab whose cards are all hidden in this mode`
  3. JS. Anchor: `(function boot(){` followed by `renderManual();`
     - Before `(function boot(){`, insert the block `// ================= INPUT PANEL TABS (UI only) =================`, which defines `LPP_IN_TABS`, `LPP_IN_CARD` (card → tab, keyed by an input id inside each card: V, H, signB, fixTbl, cablesOn, tIce, shaftShape, boltDia), `LPP_IN_KEY='lpp_inputTab_v1'`, `lppInTabGet/Set`, `lppInputTabs`, `lppPaneShown`, `lppInTabsSync`, `lppSetInTab`, `lppInTabKey` and `lppInputTabMarks`.
     - As the first line of `boot()`, insert: `lppInputTabs();   // move the input cards into the input tabs (before any state is applied)`
- **Governing provision:** none. No formula, factor, unit, code reference or computed result changed.
- **Check case:** not applicable. Results are identical, see below.
- **How verified:**
  - `node --check` on the inline script, main and branch.
  - Headless Chromium (Playwright 1.56, Chromium 1194). KaTeX 0.16.9 (the pinned version) was served locally from `npm pack`.
  - Main and branch were compared in 9 states: default pole, cables disabled, square HSS, manual rebar, Broms cohesive, monopost sign, two-post sign, two-post sign with manual C_f, and sign → pole. In every state these were identical: the text of all 8 output tab pages, every output SVG, `captureState()` JSON, the `lpp_session_v1` autosave, save → load round trip (`commitSave` → `applyState`), and the page after a reload (session restore). In the sign states, reload changes the text of the hidden light-pole-only output cards (stale pole values before the reload, "—" after). This happens the same way in main, so it is not caused by this change (O12). The branch writes no new key unless a tab is clicked.
  - All 109 inputs, selects and buttons in the input column (by id, data-i/data-k, data-v) are present in both. Every one is in exactly one pane, except the four mode-card buttons, which are above the strip by design.
  - No console errors.
  - Checked by hand: keyboard End/Home/arrow keys, red dot on and off ("4000e" in f′c), tab remembered across reload, sign → pole tab restore, a bogus stored value falls back to the first tab, print media hides `.col-in`.
  - Screenshots of every tab at 1400 px and 400 px.
- **Other copies:** none.

## 2026-10-09 — Output-tab localStorage key renamed (branch claude/lightpole-key)
### F14. `activeTab` → `lpp_activeTab_v1`, with migration   [storage key] [no result change]
- **Date:** 2026-10-09. **Type:** saved-data key change with migration (CLAUDE.md §5). No calculation change. Engineer's decision (2026-10-09) on O10: rename the generic key to `lpp_activeTab_v1`.
- **What:** the remembered output tab (Geometry, Summary, Loading, Post, Anchors, Shaft, Report, Manual) is now stored under `lpp_activeTab_v1`. At start-up, if `lpp_activeTab_v1` is absent (`getItem` returns `null`) and the old `activeTab` key holds one of this tool's output-tab ids, that value is copied to the new key. Any other old value (another tool's value, "foo", empty) is not copied. The old `activeTab` key is **never written or removed**, so any other page on the same file:// origin that uses that name keeps its value. After the migration the tool reads and writes only `lpp_activeTab_v1`. Every storage access is in try/catch; with storage blocked the page opens on Geometry and tabs still switch.
- **Other tools using `activeTab` as a storage key:** none. A repo-wide search (all `.html` files) for `'activeTab'` / `"activeTab"` finds only this tool. `Timber Beam Check.html`, `Stone Masonry Arch Load Rating.html` and `Retaining Wall Designer.html` use `activeTab` only as a JS variable or function name, not as a storage key. The old key is left in place anyway (it may also exist from other copies or older versions of tools).
- **Where / Before / After:**
  1. `switchTab()`. Anchor: `function switchTab(name){`
     - Before:
       ```js
       function switchTab(name){
         document.querySelectorAll('#tabBar button').forEach(b=>b.classList.toggle('on', b.dataset.tab===name));
         document.querySelectorAll('.tabpage').forEach(p=>p.classList.toggle('on', p.dataset.page===name));
         try{ localStorage.setItem('activeTab', name); }catch(e){}
       }
       ```
     - After:
       ```js
       // Output tab is remembered under this tool's own key. The old generic 'activeTab' key is only read
       // once, by lppMigrateOutTab() at boot, and is never written or removed (other file:// pages may use it).
       const LPP_OUT_KEY='lpp_activeTab_v1';
       function lppOutTabValid(t){ return !!t && Array.from(document.querySelectorAll('#tabBar button')).some(b=>b.dataset.tab===t); }
       function lppMigrateOutTab(){
         try{
           if(localStorage.getItem(LPP_OUT_KEY)!==null) return;          // new key already set: nothing to do
           const old=localStorage.getItem('activeTab');
           if(lppOutTabValid(old)) localStorage.setItem(LPP_OUT_KEY, old); // copy only a valid output-tab id of THIS tool
         }catch(e){}
       }
       function switchTab(name){
         document.querySelectorAll('#tabBar button').forEach(b=>b.classList.toggle('on', b.dataset.tab===name));
         document.querySelectorAll('.tabpage').forEach(p=>p.classList.toggle('on', p.dataset.page===name));
         try{ localStorage.setItem(LPP_OUT_KEY, name); }catch(e){}
       }
       ```
  2. Boot IIFE, tab restore (the F9 code). Anchor: `// restore last active tab`
     - Before:
       ```js
         // restore last active tab
         // 'activeTab' is a generic key shared by every file:// page in Chromium. Keep the key, but
         // only honour a stored value that is one of THIS tool's tab names; anything else is ignored
         // (a foreign value used to hide every tab page).
         try{ const t=localStorage.getItem('activeTab');
              const valid=Array.from(document.querySelectorAll('#tabBar button')).some(b=>b.dataset.tab===t);
              if(t && valid) switchTab(t); }catch(e){}
       ```
     - After:
       ```js
         // restore last active tab
         // One-time migration from the old generic 'activeTab' key (shared by every file:// page in
         // Chromium) to 'lpp_activeTab_v1'. Only a stored value that is one of THIS tool's tab names is
         // honoured; anything else is ignored (a foreign value used to hide every tab page).
         lppMigrateOutTab();
         try{ const t=localStorage.getItem(LPP_OUT_KEY);
              if(lppOutTabValid(t)) switchTab(t); }catch(e){}
       ```
- **Governing provision:** none. No formula, factor, unit, code reference or computed result changed. Saved-data rule: CLAUDE.md §5.
- **Check case** (storage before load → tab shown, keys after load):
  | Before load | Tab shown | `lpp_activeTab_v1` after | `activeTab` after |
  |---|---|---|---|
  | nothing (fresh browser) | Geometry | absent (written on first click) | absent |
  | `activeTab`="summary" | Summary | "summary" (migrated) | "summary" (kept) |
  | `activeTab`="foo", "" or "analysis" | Geometry | absent | unchanged |
  | `lpp_activeTab_v1`="report", `activeTab`="summary" | Report | "report" | "summary" |
  | `lpp_activeTab_v1`="bogus", `activeTab`="summary" | Geometry (no re-migration once the new key exists) | "bogus" | "summary" |
  | storage blocked (getter throws) | Geometry; clicking Post works | — | — |
  Clicking a tab writes only `lpp_activeTab_v1`; `activeTab` keeps its old value (e.g. "report" stays "report" after clicking Anchors, and Anchors comes back after a reload).
- **How verified:**
  - `node --check` on the inline script, main and branch.
  - Headless Chromium (Playwright, file:// URL, KaTeX 0.16.9 served locally): every row of the table above, on main and branch. Main gives the expected old behaviour (reads/writes `activeTab` only). No page errors or console errors in any case, including storage blocked.
  - Default page: the text of all 8 output tab pages plus the `lpp_session_v1` autosave are byte-identical between main and branch.
- **Other copies:** none.

## 2026-10-12 — Open-item sweep (branch claude/sweep-lightpole)

Engineer's instruction (2026-10-12): work through every open item, use engineering judgment, and list only what truly needs the engineer. Basis: ASCE 7-22, AISC 360-16, ACI 318-19 and IBC 2021, as stated by the tool. Article numbers marked "verify" were not checked against the printed code.

Check cases come from headless Chromium (Playwright). The page's own functions (`poleWindNominal`, `poleStress`, `signPostStress`, `anchorBolts`, `solveEmbed`, `signWind`, `fixtureComponents`, `cableComponents`) were wrapped to log their inputs and outputs, on main (606b2ec) and on the branch. Units are lb, ft and in. "Default pole" and "default monopost" mean the tool's default inputs.

### F15. Mast wind integrated over the height (LP-A1)   [calc change] [mixed: tapered mast slightly LESS, prismatic mast MORE]
- **Where:** `poleWindNominal` (anchor `const NSTRIP=100`), `poleStress` (anchor `const sList=(pw.strips||[])`), `windWorkedHTML` step 3, report §2 (anchor `The distributed wind on the shaft is integrated`).
- **Problem:** the mast wind was one resultant, q_z(H/2)·G·C_f·D̄·H, acting at H/2. With a power-law q_z profile this under-estimates the base moment of a prismatic mast. It also ignored the taper: on a tapered mast the area centroid is below H/2. `poleStress` spread that force uniformly (w = F/H).
- **Governing provision:** ASCE 7-22 §29.4.1, F = q_z·G·C_f·A_f with q_z at the centroid of A_f, applied to each of 100 strips.
- **Before:**
  ```js
  const Fpole=qzMid*inp.G*inp.cfPole*Apole;
  const FpoleI=qzMidI*inp.cfPole*ApoleI;
  return {Wpole:Fpole, Mpole:Fpole*inp.H/2, Fpole, FpoleI, MpoleI:FpoleI*inp.H/2, ...
  // poleStress
  const wMast=(gov.poleWind)/inp.H;  ...  const Hm=wMast*(inp.H-z); const armM=(inp.H-z)/2;
  ```
- **After:**
  ```js
  const NSTRIP=100, dzs=inp.H/NSTRIP, strips=[];
  for(i…){ const z=(i+0.5)*dzs; const w_in=Dt+(Db-Dt)*(H-z)/H; const Kzs=Kz(z,expo);
    const F =0.00256*Kzs*Kzt*Kd*V²*G*cfPole*(w_in/12)*dzs;
    const FI=0.00256*Kzs*Kzt*Kd*Vice²*G*cfPole*((w_in+2t)/12)*dzs;
    strips.push({z,F,FI}); Fpole+=F; Mpole+=F*z; FpoleI+=FI; MpoleI+=FI*z; }
  return {Wpole:Fpole, Mpole, Fpole, FpoleI, MpoleI, strips, NSTRIP, zF:Mpole/Fpole, …}
  // poleStress: each factored strip above the cut adds F_i and F_i·(z_i − z)
  ```
  Sign posts are not changed: they use their own exposed-post drag (`signWind`), which is exact for a clearance up to 15 ft.
- **Check case (default pole, unfactored mast wind, K_d = 1.0):**
  - Before: F = 29.69 × 0.85 × 0.70 × 23.33 = 412.2 lb at 17.5 ft, M = 7,213 lb·ft.
  - After: F = 420.0 lb, M = 6,980 lb·ft, resultant at 16.62 ft (−3.2 % M).
  - Default-pole results: ASD M 11,599 → 11,460 lb·ft, d 6.24 → 6.23 ft.
  - Hand check (node, 200 strips): prismatic 8 in × 35 ft, Exp. C: M 7,213 → 7,673 (+6.4 %). 60 ft prismatic, Exp. B: +7.3 %.
- **How verified:** Playwright run, main vs branch; independent node integration.

### F16. Wind-on-ice carries the gust factor G (LP-O4)   [calc change] [LESS conservative, ×0.85 at G = 0.85]
- **Where:** `cableComponents` (anchor `const qWI= qBase*inp.G*inp.Vice*inp.Vice;`), `fixtureComponents` (anchor `const qzi = 0.00256*Kzf*inp.Kzt*inp.Kd*inp.G*inp.Vice*inp.Vice;`), mast strips (F15). Text: manual §4A.2, cable/fixture worked examples, report notes.
- **Problem:** wind-on-ice was computed without G ("Ch. 10: no gust"). ASCE 7-22 §10.5 (verify) sends wind on ice-covered structures to Chapters 26–29 with V_c, which include G. Omitting G over-estimated wind-on-ice by 1/G = 1.18.
- **Before → After:** `qBase*inp.Vice*inp.Vice` → `qBase*inp.G*inp.Vice*inp.Vice`. Fixture `…*inp.Kd*inp.Vice*inp.Vice` → `…*inp.Kd*inp.G*inp.Vice*inp.Vice`. Mast `qzMidI*inp.cfPole*ApoleI` → strips × G.
- **Check case (default pole):**
  - Cable 1 q_Wi: 7.010 → 5.958 psf (× 0.85).
  - Fixture 1 q_zi: 6.494 → 5.520 psf. F_wi 12.98 → 11.04 lb.
  - Mast F_wi: 103.1 → 89.4 lb (G and F15).
  - Heavy-ice case (t = 1.5 in, V_ice = 60 mph): ASD D+0.7Di+0.7Wi M 14,141 → 12,307 lb·ft, d 6.64 → 6.32 ft. The governing LRFD combination moves from 1.2D+1.0Di+1.0Wi (20,153 lb·ft) to 1.2D+1.0W (19,078 lb·ft first-order).
- **LESS conservative:** this was a known conservative over-estimate (inventory LP-O4, "Default: apply G").

### F17. P-Δ amplifier B₂ (AISC 360-16 App. 8) on pole/post, anchor and shaft LRFD moments (LP-O3)   [calc change] [MORE conservative]
- **Where:**
  - New `poleSecAt`, `poleDeflection` and `poleB2`, after `hssLimitFlags`.
  - `poleStress`: `secForces`, `Nbase`, `p2`, rows `M = B2·M1`.
  - `signPostStress` (rewritten, see F19).
  - `calc()` (anchor `const psAll=[], b2ByKey={};`) and `calcSign` (anchor `const psList=[];`): `lrfdCands` / the sign `cands` carry `M:M1*B2`.
  - Worked example step 1 (`poleWorkedBody`), summary flag, key-inputs row and governing-demands note.
- **Problem:** no second-order effects. AISC 360-16 Ch. C requires them. The pole is a free-standing cantilever (a sway column).
- **Method (default chosen):**
  - B₂ = 1/(1 − α·P_story/P_e,story) ≥ 1, α = 1.0 (Eq. A-8-6).
  - P_e,story = R_M·H·L/Δ_H (Eq. A-8-7), R_M = 0.85 (the pole is its own moment-resisting column, Eq. A-8-8).
  - H·L is taken as the first-order base moment M₀, so distributed load and eccentric gravity couples are handled. For a single tip load this is exact; for a lower load centroid it gives a smaller P_e (conservative).
  - Δ_H is the first-order top drift: the curvature M/EI is integrated twice on 200 stations using the tapered section (I_x / I_y).
  - P_story is the factored axial at the base.
  - B₂ multiplies the whole first-order moment at every section. B₁ ≤ B₂ for this member (App. 8 user note).
  - The B₂ of each LRFD combination (at its governing azimuth) also multiplies the LRFD base moment passed to the anchors and the shaft (second-order connection/foundation demand).
  - The ASD embedment (IBC) keeps the first-order moment; see N3.
- **Check case — default pole, 1.2D+1.0W, wind 0°:**
  - M₀ = 19,282 lb·ft = 231.4 kip-in. Δ_H = 6.879 in.
  - P_e = 0.85 × 231.4/6.879 = 28.59 kip. P_story = 0.956 kip.
  - B₂ = 1/(1 − 0.956/28.59) = **1.0346**.
  - Pole H1: M_r 19,282 → 19,949 lb·ft, ratio 0.237 → **0.242**.
  - Anchors: M_u = 1.0346 × 19,078 = 19,737 lb·ft; T_max 9,458 → 9,671 lb; ratio 0.47 → 0.48.
  - Shaft M_u 19,299 → 19,737 lb·ft.
- **Other cases:** 60 ft pole (8 → 12 in): B₂ = 1.130, anchor tension 17,695 → 19,351 lb (88 % → 96 %). Default monopost: B₂ = 1.022.
- **Hand checks of the helpers (in the page):**
  - Prismatic 8 × 0.25 in, L = 20 ft, 1,000 lb tip load: Δ 3.47340 in vs PL³/3EI 3.47342 in.
  - UDL 50 lb/ft: 1.30252 vs wL⁴/8EI 1.30253 in.
  - B₂ (P = 2,000 lb) 1.035253 vs exact 1.035254.

### F18. Natural frequency estimate and flexible-structure warning (LP-O2)   [new check, warning only] [no result change]
- **Where:** new `poleNatFreq`; `calc()` (anchor `const nat=poleNatFreq(`); `calcSign` (anchor `const nat=poleNatFreq(inp, poleSeg.segs`); summary warning box, key-inputs row and a pole flag.
- **Method:** Rayleigh, n₁ = (1/2π)·√(g·ΣW·y/ΣW·y²), with the weights applied laterally to the same tapered cantilever as F17.
  - Pole weights: segments, fixtures, misc. DL at the top, and half of each cable's dead weight at its attachment. Cable tension stiffening is ignored, which lowers n₁ (conservative for the check).
  - Sign weights: post segments plus the post's share of the panel at the panel centroid.
- **Behaviour:** when n₁ < 1 Hz, a red warning says the structure is flexible (ASCE 7-22 §26.2) and that G must be G_f from §26.11.5. The G input is used as entered; G_f is not computed (see N1).
- **Check case:**
  - Default pole: n₁ = 1.67 Hz (rigid).
  - 60 ft pole, 8 → 12 in: 0.82 Hz (warning).
  - Default monopost: 2.59 Hz.
  - Uniform cantilever hand check: 5.314 Hz (tool) vs 1.875²/(2π)·√(EI/mL⁴) = 5.292 Hz (Rayleigh +0.4 %).

### F19. Monopost sign: Cases B and C applied; torsion checked (LP-A2)   [calc change] [MORE conservative]
- **Where:**
  - `evalSignComboDir`: Cases B/C now apply to every post count. Each record carries `T` and `Tmax`/`tCase`.
  - `signPostStress`: rewritten. It takes `gLRFD.T`, applies §H3.2 Eq. H3-6, and calls the new `hssTorsionShear`.
  - `anchorBolts`: `Tu` → each bolt's shear gets T/(n·R).
  - `designFoundationStack`: `Tu`, `phiTth`.
  - `collectChecks`: new check "Shaft torsion ≤ φT_th".
  - Sign case table, torsion note, post block, load-path derivation, sign wind worked example, masthead text, manual (Torsion row, Case C row, warn box).
- **Problem:** on a monopost only Case A was used. The eccentric Cases B (e = 0.2B) and C (e_C) were dropped ("torsion out of scope"), so the post, base and shaft were never checked for the resulting torsion. Case C was also left out of the flexure envelope.
- **Governing provisions:**
  - ASCE 7-22 Fig. 29.3-1 (Cases A, B, C).
  - AISC 360-16 §H3.1(a)/(b): T_c = φ_T·F_cr·C, φ_T = 0.90. Shear §G5 (round) / §G4 (rect.). §H3.2 Eq. H3-6 when T_r > 0.2T_c.
  - ACI 318-19 §22.7.1.1 / Table 22.7.4.1(a): T_th = λ√f′c·A_cp²/p_cp, φ = 0.75.
  - ACI 318-19 Ch. 17: anchor shear.
- **After (key lines):**
  ```js
  cases.push({name:'B', F:sw.F_A*onFace, x:0.2*sw.B*windSign});
  if(sw.caseC){ cases.push({name:'C', F:sw.caseC.F*onFace, x:sw.caseC.e*windSign}); }
  const T=nPost===1? Math.abs(Fp*cs.x) : 0;
  // anchorBolts
  const VbT = Tu>0 ? Tu/(n*R) : 0;  b.V=Vu/n+VbT;  const Vb=Vu/n+VbT;
  // signPostStress
  if(tv.applies){ ratio=(prPc+mratio)+Math.pow(Vr/ts.Vc+Tr/ts.Tc,2); form='H3-6'; }
  // designFoundationStack
  const phiTth=0.75*1.0*Math.sqrt(inp.fc)*Acp*Acp/pcp/12;   // lb-ft
  ```
  Flexure and shear use the max-moment case. Torsion uses the max-torsion case: the post is checked for both, and the anchors and shaft use the envelope (max M with max T, conservative). On two posts nothing changes: B/C were already resolved as a force split.
- **Check case — default monopost (12 × 6 ft panel, clearance 10 ft, 6 in × 0.1875 in round post), 1.2D+1.0W:**
  - F_A = 2,671 lb, e_B = 2.40 ft → T_B = 6,411 lb·ft. F_C = 2,842 lb, e_C = −0.60 ft → T_C = 1,705 lb·ft.
  - **Flexure:** Case C now governs the moment, 2,842 × 13 + 86 × 5 = 37,368 lb·ft (was Case A, 35,151).
    - ASD M 21,091 → 22,421 lb·ft; embedment d 8.31 → **8.50 ft**.
  - **Post, Case B (H3-6):**
    - P_r/P_c = 0.704/20.11 = 0.035. M_r/M_c = 1.022 × 35,151 × 12/1000 / 285.2 = 431.1/285.2 = 1.512. V_r/V_c = 2.757/46.22 = 0.060.
    - C = π(6 − 0.1875)²(0.1875)/2 = 9.95 in³. F_cr = 0.6F_y = 30 ksi. T_c = 0.9 × 30 × 9.95 = 268.7 kip-in.
    - T_r/T_c = 76.93/268.7 = 0.286 > 0.2.
    - H3-6 = 0.035 + 1.512 + (0.060 + 0.286)² = **1.666** (was H1 1.485; both NG).
  - **Anchors:**
    - T/(n·R) = 6,411 × 12/(6 × 8) = 1,603 lb. V_b = 2,927/6 + 1,603 = 2,090 lb (was 459).
    - T_max 17,488 → 18,976 lb.
    - Interaction 0.941 + 0.273 = **1.21 > 1.2, NG** (was 0.87).
  - **Shaft:** A_cp = π·36²/4 = 1,018 in², p_cp = 113.1 in. φT_th = 0.75·√4000·1018²/113.1/12 = 36,212 lb·ft ≥ 6,411 lb·ft → OK.
  - The soil's torsional resistance is NOT checked (warning, N2).
- **Note:** this item uncovered F21 (panel weight missing from the post axial).

### F20. Pole/post combined stress for every LRFD combination and azimuth (LP-O9)   [calc change] [MORE conservative or equal]
- **Where:** `calc()` (anchor `const psAll=[], b2ByKey={};`, `const pstress=psAll.reduce(`), `calcSign` (anchor `const pstress=psList.reduce(`). `poleStress` / `signPostStress` return `comboName`, `phi`, `tCase`. These are shown in the worked example and in the sign post block.
- **Before:** `const pstress=poleStress(inp,poleSeg,comps,fxs,pw,govLRFD);` (max-moment combination only). Sign: `signPostStress(inp,poleSeg,pw,gLRFD,sw)`.
- **After:**
  - Pole: `poleStress` runs for every LRFD combination × each of the 4 azimuths (16 runs), and the largest H1 ratio governs.
  - Sign: `signPostStress` runs for every LRFD combination, plus the monopost torsion case.
- **Governing provision:** ASCE 7-22 §2.3.1 (all combinations); AISC 360-16 §H1.1.
- **Check case:** default pole: the governing run stays 1.2D+1.0W at 0° (0.242, with F17). For the default two-post sign, P1 is 1.193 → 1.215 (F17 + F21; the governing case is still B).

### F21. Post/pole axial includes the panel share and the misc. dead load (found during LP-A2/LP-O3)   [calc change] [MORE conservative]
- **Where:** `signPostStress` (`Npanel=f.D*(inp.signWt||0)/(inp.signPosts||1)`, `N+=f.D*(s.cumWabove+(inp.DL||0))+Npanel`); `poleStress` (`N+=f.D*(s.cumWabove+(inp.DL||0))…`).
- **Problem:**
  - The sign post's H1 axial used the post self-weight only. The panel weight that the foundation axial already carries was missing.
  - The pole/post H1 axial also omitted the misc. dead load DL. Its height is not stated, so it is now applied over the full height.
- **Before → After:** sign `N+=f.D*s.cumWabove;` → `N+=f.D*(s.cumWabove+(inp.DL||0))+Npanel;`. Pole `N+=f.D*s.cumWabove + …` → `N+=f.D*(s.cumWabove+(inp.DL||0)) + …`.
- **Check case:**
  - Default monopost: P_r 0.224 → 0.704 kip (1.2 × (186 + 400) lb).
  - Default pole (DL = 0): unchanged.
  - 45 ft thin pole with DL = 800 lb: included, together with F17 (the H1 ratio 0.93 → 1.73 there is mostly B₂ = 1.44 on a 0.29 Hz pole).
- **Governing provision:** AISC 360-16 §H1.1 (P_r = required axial).

### F22. IBC lateral-bearing depth increase capped at 15 × tabulated (LP-O5)   [calc change] [MORE conservative when d/3 > 15 ft (non-constrained) or d > 15 ft (constrained)]
- **Where:** `solveEmbed` (anchor `const S1=S1coef*Math.min(d/3,15);`), embedment worked examples (pole tab, sign stack, report), manual §4B.2.
- **Governing provision:** IBC 2021 §1806.3.3 "increase for depth" (verify the number; the inventory cites §1806.3.4, which is the isolated-pole doubling). The tabulated value may be increased per foot of depth up to 15 × the tabulated value.
- **Before:** `const S1=S1coef*(d/3);` … `const S3=S1coef*d;`
- **After:** `const S1=S1coef*Math.min(d/3,15);` … `const S3=S1coef*Math.min(d,15);` The isolated-pole ×2 (`isoFac`) multiplies the capped value. See N4 for the stricter reading.
- **Check case (default pole, constrained, S₁ = 4 psf/ft, b = 3 ft):**
  - Before: d = (4.25 × 11,599/(4 × 3))^(1/3) = **16.02 ft** (S₃ = 64.1 psf).
  - After (with F15's M = 11,460): S₃ = 4 × 15 = 60 psf, d = √(4.25 × 11,460/(60 × 3)) = **16.45 ft**. With the old M the cap alone gives 16.55 ft (+3.3 %).
  - Defaults are not affected (d < 15 ft).

### F23. Blocking input errors (LP-O6)   [bug fix] [no result change for valid inputs]
- **Where:** new `lppInputErrors` and `lppShowInputErrors` (before `kdComponents`). Call at the top of `calc()` (anchor `const errs=lppInputErrors(inp); lppShowInputErrors(errs); if(errs.length) return;`). New `<div id="lppInErr" role="alert">` after `#tabBar`. CSS `#lppInErr`, `.lpp-blocked>.tabpage:not([data-page="manual"])`.
- **Problem:** a blank or zero H or b crashed `calc()` in `drawElev` ("Invalid array length") and left stale results on screen.
- **After:** before any calculation, `calc()` checks the following, and any failure shows a red list above the results and hides every output tab except Manual (also in print) until fixed:
  - V > 0; H > 0 (pole);
  - B, s > 0, clearance ≥ 0, spacing > 0 when two-post (sign);
  - section dimensions and walls > 0, with 2t < D;
  - F_y, b, S₁, q_a, f′c, f_y > 0;
  - bolts ≥ 1, BC > 0, h_ef > 0.
- **Check case:**
  - H blank: banner "Pole height H must be greater than 0.", results hidden, no console errors. Main gave "Invalid array length" plus 40 SVG NaN errors, and showed d = 5.22 ft.
  - b = 0: banner shown. Main showed "ERR ft".
  - Restoring the values brings back d = 6.23 ft.

### F24. Stale hidden cards cleared on a mode switch (LP-O12)   [UI] [no result change]
- **Where:** `LPP_MODE_OUT_SNAP`, `lppSnapPoleOutputs`, `lppResetPoleOutputs` (before `boot`). `lppSnapPoleOutputs()` is called in `boot()` after `renderFixtures()`. `applyMode()` calls `lppResetPoleOutputs(sign?'pole':'sign')`.
- **After:**
  - At start-up the id'd output elements (those without form controls) of the light-pole-only cards (`.poleOnly`, `#fixOutCard`, `#cableOutCard`) and of the sign-only cards (`#signWindCard`, `#signComboCard`, `#signPostsCard`) are snapshotted.
  - On each mode switch the hidden mode's elements are reset to that "—" content.
- **Check:**
  - Switching pole → sign: the hidden pole cards show "—" (no "x,xxx lb" values).
  - Pole → sign → pole gives page text identical to a fresh load. Without the sign-side reset, the stale sign cards differed.

### F25. Narrow screens: no horizontal page scroll (LP-O11)   [UI] [no result change]
- **Where:** CSS after the `.tabpage>section.card:first-child` rule. The fixture and cable tables are wrapped in `<div class="lppTblScroll">`.
- **After:**
  - Fixture/cable input tables scroll inside their card.
  - At ≤ 900 px only: grid column `minmax(0,1fr)`; output tables `display:block; overflow-x:auto`; `.row` select may shrink; `.katex-display` scrolls.
  - Desktop layout is unchanged.
- **Check:** scrollWidth at 400 px, every input tab and every output tab, pole and sign mode (KaTeX loaded): 400/400 everywhere. Main: 445–667 px.
- **Pre-existing, not changed:** at 400 px the masthead's right-hand reference block overlaps the title.

### F26. Summary "Anchor bolts" row printed "Gr.[object Object]"   [display bug]
- **Where:** `summaryHTML`, `drow('Anchor bolts', …)`. Before `Gr.${st.found.bolts.gr}` → after `Gr.${inp.boltGrade}`.
- **Check:** "(6) 1.000 in Gr.55, BC 16.0 in, h_ef 18.0 in".

### Verification (F15–F26)
- `node --check` on the inline script: 0 failures.
- **Playwright (Chromium 1194, KaTeX 0.16.9 served locally), main vs branch, 16 scenarios:**
  - default pole; no cables; square; rect; constrained + iso 2; 60 ft constrained / non-constrained; thin 45 ft with DL 800; constrained S₁ 4; non-constrained S₁ 5 at 50 ft; heavy ice;
  - monopost round / square / 16 × 4 ft; two-post default / 30 × 2 ft.
- The text of every output tab and every table was dumped and compared. Each change traces to an item above. No other result changed.
- `captureState()` JSON (saved projects, `lpp_session_v1` autosave) is identical in all 16 scenarios. No storage key, input id or saved field was added or changed.
- No page or console errors in any scenario, and 0 "ERR" tokens.
- UI checks: O6, O11 and O12 scripted as above.
- Screenshots reviewed: monopost Summary and Post tab (H3-6 worked example), input error banner, 400 px fixture tab.
- **Other copies:** none.

## 2026-10-12 — Follow-up: N1, N6, N7, sign-post drag (branch claude/lightpole-followup)

Engineer's decisions (2026-10-12, after #136):
- N6: use the exact Σ H_i·h_ci.
- N7: add the misc. DL to the sign foundation axial.
- Integrate the sign-post exposed drag.
- N1: compute G_f with a new β input (default 0.005) and use max(entered G, G_f).

Check cases come from headless Chromium, main (e29761a) vs branch, with the page's functions wrapped to log their values. Units are lb, ft and in.

### F27. Cable pull moment is the exact vector sum Σ H_i·h_ci (N6)   [calc change] [exact; mixed — default pole MORE (+1.1 %)]
- **Where:** `evalComboDir`. Anchors `cMx+=r.Hx*cp.c.hc; cMy+=r.Hy*cp.c.hc;` and `Mx+=cMx; My+=cMy;`. Also `M_cable`.
- **Problem:** the base moment used (ΣH)·h_c,eff with h_c,eff = Σ|H|·h_c/Σ|H|. This is not the moment of the individual pulls when they act at different heights and partly cancel. `poleStress` already used the exact sum, so the foundation path and the pole check disagreed by about 1 %.
- **Governing provision:** statics; ASCE 7-22 §2.3/§2.4 demands.
- **Before:**
  ```js
  Mx+=cx*hcEff; My+=cy*hcEff;
  … M_cable:Math.hypot(cx,cy)*hcEff
  ```
- **After:**
  ```js
  cMx+=r.Hx*cp.c.hc; cMy+=r.Hy*cp.c.hc;   // in the cable loop
  Mx+=cMx; My+=cMy;
  … M_cable:Math.hypot(cMx,cMy)
  ```
  `hcEff` is kept for the elevation drawing only.
- **Check case (default pole, 1.2D+1.0W, wind 0°):**
  - Cables (H_x, H_y, h_c): (389.1, 104.3, 32), (−249.2, 249.2, 32), (−104.2, −388.9, 30).
  - Before: ΣH = (35.7, −35.4) × h_c,eff 31.305 → (1,117.6, −1,108.2), |M_c| = 1,573 lb·ft.
  - After: M_cx = 389.1(32) − 249.2(32) − 104.2(30) = 1,350.8; M_cy = 104.3(32) + 249.2(32) − 388.9(30) = −355.0; |M_c| = 1,396 lb·ft.
  - Base M (with the wind terms): 19,077.6 → **19,281.8 lb·ft**. This now equals the `poleStress` base M₁ of F17.
  - Anchor tension 9,671 → 9,791 lb. ASD M 11,460 → 11,584 lb·ft; d 6.23 → 6.24 ft.

### F28. Sign foundation axial includes the misc. dead load (N7)   [calc change] [mixed: more bearing, less anchor uplift]
- **Where:** `evalSignComboDir` (anchor `const axial=f.D*(perPostDeadSign+postSelfW+(inp.DL||0));`); `signLoadPathHTML` steps 2 and 5 (N_DL term).
- **Before → After:** `f.D*(perPostDeadSign+postSelfW)` → `f.D*(perPostDeadSign+postSelfW+(inp.DL||0))`. DL is per post, as for the post H1 axial (F21) and `inp.DLtotal`.
- **Check case (two-post, clearance 25 ft, DL = 300 lb):** LRFD N 673 → 1,033 lb (+1.2 × 300). ASD N 561 → 861 lb. Bearing 0.08 → 0.12 ksf. With DL = 0 (the default) nothing changes.

### F29. Sign-post exposed drag integrated over the clearance height   [calc change] [MORE conservative when clearance > 15 ft; identical at ≤ 15 ft]
- **Where:** `signWind` (anchor `const NPS=50, dzp=postExpH/NPS, postStrips=[];`), `signPostStress.secM` (anchor `sw.postStrips.forEach`), `signLoadPathHTML` step 3 (q̄_z, z_drag). A text fix in step 1 says the drag acts at z_drag; it wrongly said h/2.
- **Problem:** one force at q_z(clr/2) acting at clr/2. Because K_z is floored at 15 ft this was exact for clearance ≤ 15 ft and under-estimated the drag above that.
- **Governing provision:** ASCE 7-22 §29.4.1 per strip (as F15).
- **Before:** `Fpost=qzPost*cfPost*Apost; zPost=clr/2; Mpost=Fpost*zPost;` and a uniform w in `signPostStress`.
- **After:** 50 strips, `F_i = 0.00256·K_z(z_i)·K_zt·K_d·G·V²·C_f·w·Δz`, `Fpost=ΣF_i`, `Mpost=ΣF_i z_i`, `zPost=Mpost/Fpost`. `qzPost` is the area average (display). The post stress uses the factored strips.
- **Check case (6 in post, clearance 25 ft, Exp. C, V 115):**
  - Before: q_z(12.5) = q_z(15 ft floor) = 24.41 psf; F = 24.41 × 0.7 × 0.5 × 25 = 213.8 lb; M = 213.8 × 12.5 = 2,672 lb·ft.
  - After: F = 218.9 lb, M = 2,783.5 lb·ft (z = 12.71 ft); independent node integration gives 218.9 / 2,784.
  - Two-post LRFD M 72,906 → 73,018 lb·ft (+111.6 × 1.0).
  - Default sign (clearance 10 ft): identical.

### F30. Flexible gust-effect factor G_f when n₁ < 1 Hz (N1)   [calc change] [MORE conservative for flexible structures; rigid structures unchanged]
- **Where:**
  - New `GF_TBL`, `gustFlexible` and `lppApplyGf` (after `poleNatFreq`).
  - `calc()`: `nat` is now computed right after `poleSegments` (anchor `lppApplyGf(inp, nat, {h:inp.H`), before any wind force; the later `nat` block is removed.
  - `calcSign`: `lppApplyGf(inp, nat, {h:inp.signClr+inp.signS`.
  - New input `lppBeta` (Wind & site card) with note `#lppGfNote`.
  - `INPUT_IDS` gets `'lppBeta'`; `applyState` sets the default.
  - Validation: β > 0.
  - Flexible warnings in the summary and the pole flags; manual input table (G row, new β row).
- **Governing provision:** ASCE 7-22 §26.11.5, Eqs. 26.11-10 to 26.11-16, Table 26.11-1 (verify constants):
  - B: b̄ 0.45, ᾱ 1/4, c 0.30, ℓ 320, ε̄ 1/3, z_min 30;
  - C: b̄ 0.65, ᾱ 1/6.5, c 0.20, ℓ 500, ε̄ 1/5, z_min 15;
  - D: b̄ 0.80, ᾱ 1/9, c 0.15, ℓ 650, ε̄ 1/8, z_min 7.
- **Before:** G = entered value always (0.85 default); only a warning for n₁ < 1 Hz.
- **After:**
  ```js
  if(nat.n1<1.0){ const gf=gustFlexible(expo,V,h,B,L,n1,beta); inp.G=Math.max(inp.Ginput,gf.Gf); }
  ```
  - Pole: h = H, B = mean width, L = mean depth.
  - Sign: h = clearance + s, B = panel width, L = post width.
  - The G used drives every wind force: mast, fixtures, cables, wind-on-ice, sign q_h and post drag.
  - The note under G states n₁, G_f, β and the G used. The Summary key inputs show the G used.
- **Saved data:** new optional field `inputs.lppBeta` (tool-prefixed). An older save without it loads with β = 0.005, tested by loading a save with lppBeta removed after setting the input to 0.02. All other saved fields are identical to main in all 20 scenarios.
- **Check case (60 ft pole, 8 → 12 in, Exp. C, V = 115 mph, β = 0.005):**
  - n₁ = 0.821 Hz. z̄ = max(0.6 × 60, 15) = 36 ft.
  - I_z̄ = 0.20(33/36)^(1/6) = 0.1971. L_z̄ = 500(36/33)^(1/5) = 508.8 ft.
  - Q² = 1/(1 + 0.63(60.83/508.8)^0.63) = 0.8582.
  - V̄_z̄ = 0.65(36/33)^(1/6.5)(115)(88/60) = 111.1 ft/s.
  - N₁ = 3.760, R_n = 0.0607, R_h = 0.3721 (η = 2.04), R_B = 0.9814, R_L = 0.9397.
  - R² = (1/0.005)(0.0607)(0.3721)(0.9814)(0.9717) = 4.309. g_R = 4.142.
  - G_f = 0.925(1 + 1.7 × 0.1971 × √(3.4² × 0.8582 + 4.142² × 4.309))/(1 + 1.7 × 3.4 × 0.1971) = **1.76** (page: 1.768 with the unrounded n₁).
  - G used = max(0.85, 1.768) = 1.768, so every wind force × 2.08: ASD M 20,859 → 43,622 lb·ft, d 13.06 → 17.17 ft, anchor tension 96 % → 202 % (NG).
  - With β = 0.02: G_f = 1.20, d 14.90 ft, anchors 138 %. With β = 0.05: G_f = 1.04.
  - Default pole (n₁ = 1.67 Hz) and default signs (2.6–6.4 Hz): unchanged.

### Verification (F27–F30)
- `node --check`: 0 failures.
- Playwright, main vs branch, 20 scenarios (the 16 of the sweep plus pole β = 0.02, flexible monopost, and monopost/two-post with clearance 25 ft and DL 300):
  - Rigid scenarios differ only by F27 (pole) or not at all (signs with clearance ≤ 15 ft and DL = 0).
  - Flexible scenarios differ by G_f as above.
  - Saved state differs only by the new `lppBeta` field. No console or page errors.
- Screenshot reviewed: flexible pole Summary with the G_f note under the G input.
- **Other copies:** none.

## Needs engineer
- **N1 (LP-O2) — RESOLVED 2026-10-12 (F30):** G_f with β input (default 0.005), G = max(G, G_f). Original note: for a flexible pole (n₁ < 1 Hz) the tool now warns but still uses the entered G. Should it compute G_f (ASCE 7-22 §26.11.5)? That needs a damping ratio β. Recommendation: compute G_f with β = 0.005 for steel poles (verify against your practice) and use max(G, G_f).
- **N2 (LP-A2):** monopost torsion — the soil's torsional resistance around the drilled shaft is not checked (warning shown). Which method do you want (for example, side shear × radius from the geotechnical report)? Recommendation: an input "allowable torsional resistance (from geotech)" checked against the ASD torsion.
- **N3 (LP-O3):** B₂ is applied to the LRFD pole, anchor and shaft moments, but not to the ASD embedment moment. Should the IBC embedment use an ASD second-order moment (AISC uses 1.6 × ASD loads for the amplifier)? Recommendation: keep first-order for the empirical IBC §1807.3 check; the effect is a few percent.
- **N4 (LP-O5):** IBC 15 × cap with the isolated-pole doubling. Implemented as S = 2 × S₁ × min(depth, 15). The stricter reading caps at 15 × the undoubled tabulated value (min(2 × depth, 15)). Please confirm the reading and the section number (§1806.3.3 vs §1806.3.4).
- **N5 (LP-O8, unchanged):** anchor concrete breakout in shear (§17.7.2) and side-face blowout (§17.6.4) for a bolt circle in a round shaft are still "NOT CHECKED". A method is needed: c_a1 to the curved face, which bolts form the group, and the A_Vc geometry. Recommendation: treat the single most-loaded bolt at c_a1 = R_edge − R with A_Vc from a straight tangent edge, and n_eff = bolts within 1.5c_a1. Or design for anchor reinforcement (§17.7.2.5) and require it.
- **N6 — RESOLVED 2026-10-12 (F27).** Original note: `evalComboDir` takes the cable pull moment as (ΣH)·h_c,eff with h_c,eff = Σ|H|·h_c/Σ|H|, while `poleStress` uses Σ H_i·h_ci (exact). Default pole, 1.2D+1.0W: base moment 19,078 (foundation path) vs 19,282 lb·ft (exact), −1 %. Recommendation: use the exact vector sum in `evalComboDir`. The `h` display and the drawings would then need the exact sum too.
- **N7 — RESOLVED 2026-10-12 (F28).** Original note: in sign mode the misc. dead load DL is not in the foundation axial (`evalSignComboDir` uses panel + post only). It is now in the post H1 axial (F21). Recommendation: add f_D·DL to the sign foundation axial as well.

## Remaining open items
- N2–N5 above.
- N8 (new): G_f with β = 0.005 is large for slender poles (e.g. 1.77 for a 60 ft pole at 0.82 Hz). Please confirm the default β for your pole types (0.01–0.02 is also used in practice for steel poles with attachments).
- Sign-post exposed drag: RESOLVED 2026-10-12 (F29).

## Resolved items
- **O1. Kd = 0.85 recommended for round masts** (default and manual). ASCE 7-22 Table 26.6-1 gives 1.0 for round chimneys/tanks/similar structures, while 0.85 applies to solid signs and trussed towers. **Question:** which Kd do you want as the default for round light masts, and should the mast and sign use different Kd?
  - **RESOLVED 2026-10-04 (F10):** engineer: "use ASCE". K_d is set per component from ASCE 7-22 Table 26.6-1 (round 1.0, square/rect. 0.90, sign 0.85; cables and fixtures take the mast value). The single input is kept as an override.
- **O7. Cable transverse reaction (F5)** uses the full w_h along the wind direction for every cable. Projecting it normal to each cable (w_h·|sin(φ−θ)|, directed normal to the cable) would be more accurate and less conservative. For the default pole this one assumption raises the base moment by 61%. Please confirm.
  - **RESOLVED 2026-10-04 (F11):** engineer keeps the full w_h on every cable. No change.
- **O10. Generic `activeTab` localStorage key** (output tabs, `switchTab`). Every file:// page in Chromium shares this name, and CLAUDE.md §5 forbids generic names. It was left unchanged in F9 and F13 because changing a key needs a migration. Decide whether to move it to `lpp_activeTab_v1` and migrate the old value.
  - **RESOLVED 2026-10-09 (F14):** engineer: rename to `lpp_activeTab_v1`. The old value is migrated once if it is a valid output-tab id; the old `activeTab` key is left in place and no longer written.
- **O2, O3, O4, O5, O6, O9, O11, O12 / LP-A1, LP-A2:** RESOLVED 2026-10-12 (sweep), see F15–F25. The open sub-questions are listed under "Needs engineer" (N1–N7).

## 2026-10-18 — PR: claude/lightpole-d11-report (AUDIT.md D11, display only; PR link added after merge)

### D11: calculation-sheet report in the Gusset Plate Rating / ST-Girder format (Tier 1, display only)
- **Engineer request:** 2026-10-14; scope decided 2026-10-18 (AUDIT.md D11: full report for every design-check tool).
- **Where (anchors; line numbers drift):**
  - **New block** before `// ================= CALCULATION REPORT =================`, anchor `// ================= D11 (2026-10-18): CALCULATION-SHEET REPORT + DERIVATION LINKS`:
    - `LPP_SUMCTX`, `lppEsc`, `LPP_TABNAME`, `LPP_CHK2K`, `LPP_K2TGT`;
    - `lppTgt`, `lppLink`, `lppWorkedIn`, `lppGoto`, the `a.wkA` click handler;
    - `lppResLine`, `LPP_REFS`, `lppPageCSS`, `lppApplyPageCSS`;
    - `lppSecRef`, `lppRes`, `lppDtHTML`, `lppTorsionHTML`, `lppReportDoc`.
  - **`buildReport(inp,allCombos,gov,embed,struct)`** (light pole) and **`buildSignReport(inp,sw,pw,allCombos,postDesigns,poleSeg)`** (sign):
    - They still write one `<details class="rpt-sec">` per section. Each now carries `data-old="<old tag>"`.
    - They end with `lppReportDoc(H,{title,sub})` instead of writing `#reportBody` directly.
  - **`renderSummary(ctx)`:** first line `LPP_SUMCTX=ctx;`. The report reads the same Summary context.
  - **`summaryHTML(ctx)`:** a "Worked in" column in "Governing demands" and in "Demand vs capacity", and a B₂ link in "Key design inputs" (see "D11 links" below).
  - **`bearingWorkedHTML(bearing, N, inp)`:** the square-shaft A_base formula (see "Also fixed" below).
  - **Report card header:** new button `id="lppRptPrint"` ("Print / PDF report").
  - **End of the script:** anchor `// D11: printing prints the calculation report` (the button, `beforeprint`, `afterprint`).
  - **CSS:** anchor `/* D11 calculation-sheet report (Gusset Plate Rating / ST-Girder format)`. It also holds the print rules.
  - **Manual:** the §3.7 "Report tab" paragraph now describes the new layout.
- **Before:**
  ```js
  // end of buildReport (light pole) and of buildSignReport (sign), identical:
  $('reportBody').innerHTML=H;
  if(window.renderMathInElement){
    renderMathInElement($('reportBody'),{delimiters:[{left:'\\[',right:'\\]',display:true},{left:'$',right:'$',display:false}],throwOnError:false});
  }
  ```
  ```css
  @media print{ … .tabpage{display:block!important} … }   /* every output tab printed, then the report */
  ```
  - The Report tab was a stack of collapsible sections:
    - light pole tags 0, 1, 2, 2b, 3, 4, 4b, 4c, 5, 6, 6b, 7, 8;
    - sign tags 0, 1, 1b, 3.
  - It had no cover, title block, references, table of contents, n.k numbering, result lines, page header or page footer.
  - Ctrl+P printed every output tab (Geometry, Summary, Loading, Post, Anchors, Shaft) and then the report.
  - The "Export PDF / Print" button sits in the hidden `#cardSource` block and was never visible. It is unchanged.
- **After:**
  - **Cover:**
    - tool title (the masthead title: Light Pole / Monopost Sign / Double-Post Sign Pier Designer);
    - project (the saved project name, else "Untitled");
    - the masthead eyebrow line;
    - codes, tool, author and print time.
  - **Title block:** Project / Project No. / Calculated by / Date / Checked by / Checked date.
    - **No field was added.** The tool has no project-number, engineer or date fields, so these read "—". The contents page says so.
  - **References** (only what the tool cites): ASCE/SEI 7-22, IBC 2021, ACI 318-19, AISC 360-16, ASTM F1554, AASHTO LTS C13.6.1.1.
    - AASHTO LTS is cited for the Broms check, which is reference only. The tool states no edition, so it reads "edition: verify".
    - The ASCE 7 load combinations are listed with "the tool cites no section".
  - **Numbered table of contents** with links.
  - **Section 1, Design Summary:**
    - It is the Summary tab's own `summaryHTML(ctx)`, with the check chips removed.
    - It is split at its headings:
      - 1.1 Verdict and items not checked;
      - 1.2 Design;
      - 1.3 Governing demands;
      - 1.4 Demand vs capacity;
      - 1.5 Key design inputs;
      - 1.6 Reference comparisons (only when Broms is on).
    - It ends with "Results — all checks": one result line per `collectChecks` item, each with "see §n.k".
  - **Sections 2, 3, …:** one per old report section.
    - Subsections n.k are cut at the section's `.eq-title` / `.subhead` headings, or at its `.step-label` steps when it has none.
    - A heading directly followed by another heading stays inside the first one's subsection.
    - The old "(§2)", "(§2b)", "(§3)", "(§4)", "(§4c)", "(§6b)" references in the text point to the renumbered sections.
    - "(§2b)" and "(§3)" are dropped when there are no fixtures / no cables. They used to point at a missing section.
  - **Result line** after each worked check: `<check>: D/C = x.xx (<code>) PASS/FAIL`. The D/C and the verdict are `collectChecks`' own `ratio` and `ok`, as in the Summary table.
  - **Print:** only the report prints, from any tab. The print CSS hides the masthead and every other tab.
    - `@page` letter with margin boxes. They are set only while printing (button / `beforeprint`) and cleared on `afterprint`.
    - Top: "Project No: — / Description: <project or tool title>", "Computed By: — / Checked By: —", "Date: — / Date: —".
    - Bottom: "<project> (Light Pole and Sign Post)" and "Page X of Y".
  - **On screen,** the Report tab shows the same document. Its sections are no longer collapsible.
- **Content changes inside the report** (display only, same values). The tab derivations are reused: "one copy of each derivation", as the manual states.
  - **Light pole §7 → section "Shaft reinforcement":**
    - Three blocks of the report's own are replaced by the Shaft tab's `rebarWorkedHTML(reo,inp,Mu,Pu,Vu)`: "Flexural capacity by circular P-M interaction", "Concrete shear capacity" and "Tie size & spacing".
      - The removed blocks gave φM_n with no work shown.
      - They were captioned "circular" for a square shaft.
      - They were titled "auto-sized" in check mode.
    - `rebarWorkedHTML` shows A_s,max, the strain-compatibility φM_n with the bar table, and the check-mode table.
    - The section title now reads "(check of the specified bars)" in check mode.
  - **"Minimum longitudinal reinforcement":**
    - The prose is kept. It now follows the "full 1 %" option when that option is selected.
    - The equation is dropped. `A_g = π/4 b²` was wrong for a square shaft; A_g is worked in the next block.
  - **Light pole §6b → "Soil bearing":** now the Shaft tab's `bearingWorkedHTML`.
    - The prose said the axial came "from the governing ASD combination".
    - Since F2 it is the ASD combination with the largest axial. That combination is now named.
  - **Light pole §6 → "Embedment":** adds the Shaft tab's Broms reference check when a Broms soil model is selected. It is `bromsWorkedHTML`, with the same call as the tab.
  - **Light pole §4c → "Pole combined stress":** adds a report-only line for the D/t < 0.45E/F_y check. The Summary lists that check, but no tab works it.
    - Default: `(D/t)max = 40.0 < 0.45E/Fy = 0.45(29,000)/50 = 261.0`.
  - **Sign report:**
    - **Basis line:** "<b>Torsion is not evaluated</b> — see the limitation note below (§2)" was stale since F19 (monopost torsion is checked), and it pointed at a section that did not exist. It is replaced by the Loading tab's own torsion note (`#sgTorsionNote`).
    - **New section "Load combinations — per-post demand":** the Loading tab's `#sgComboTbl`. The report had no combination table. The two-post force split moves here.
    - **One section per post,** with the Post / Anchors / Shaft tabs' derivations, called exactly as `populateDetailStack` calls them:
      - `demandWorkedHTML`, `embedWorkedHTML`, `bromsWorkedHTML` (when on), `bearingWorkedHTML`;
      - `rebarWorkedHTML`, `boltWorkedHTML`, `poleWorkedBody`.
    - **Removed:** the report's own sign blocks.
      - "Embedment (IBC §1807.3, non-constrained)" said non-constrained and showed the non-constrained equation even with "constrained" selected.
      - "Soil bearing" and "Longitudinal reinforcement" gave results with no substitution.
    - **Monopost:** a report-only "Shaft torsion threshold" block. The Summary lists the check, but no tab works it.
      - Default monopost: `φT_th = φλ√f′c·A_cp²/p_cp = 0.75(1.0)√4000·(1,017.9)²/113.10·1/12 = 36,212 lb·ft`; `T_u = 6,411 < φT_th`.
  - **Plain-text TeX** in two light-pole prose lines now uses subscripts: `K_{z,top}`, `K_{z,mid}`, `q_{z,mid}·G·C_f·A_pole`, `M_{pole}`.
- **Also fixed (display only, app and report):** `bearingWorkedHTML` showed `A_base = π/4·b²` for a square shaft, while the value was b² (`bearingCheck` uses b² for a square shaft).
  - Before:
    ```js
    H+=g(`A_{base} = \\tfrac{\\pi}{4}b^2 = \\tfrac{\\pi}{4}(${fmt(inp.b,2)}\\ \\text{ft})^2 = ${fmt(bearing.Abase,2)}\\ \\text{ft}^2`);
    ```
  - After: when `inp.shaftShape==='square'`, it shows `A_{base} = b^2 = (${fmt(inp.b,2)}\\ \\text{ft})^2 = …`. Round shafts are unchanged.
  - Check (square 3.00 ft shaft):
    - Before: "A_base = π/4 b² = π/4(3.00 ft)² = 9.00 ft²".
    - After: "A_base = b² = (3.00 ft)² = 9.00 ft²".
    - The value is unchanged.
- **Provision:** none. No formula, factor, unit, code reference or result changed. The references and the codes in the result lines are those the tool already cites.
- **Saved data:** none. No key or format changed, and no key was added. The report reads the Summary context in memory (`LPP_SUMCTX`), never storage.
- **Check case:** default light pole, project "Main St Pole 4".
  - **27 letter pages:** cover, front matter (references and contents, 3 pages), then 14 sections:
    1. Design Summary (1.1–1.5);
    2. Design inputs & basis (2.1–2.8);
    3. Wind velocity pressure (3.1–3.3);
    4. Wind force on the pole (4.1–4.2);
    5. Fixture loads (5.1–5.4);
    6. Cable loads (6.1–6.6);
    7. Load combinations;
    8. Wind direction envelope;
    9. Pole combined stress (9.1–9.7);
    10. Governing ASD demand (10.1–10.3);
    11. Embedment (11.1–11.2);
    12. Soil bearing (12.1);
    13. Shaft reinforcement (13.1–13.4);
    14. Anchor bolts (14.1–14.8).
  - **Result lines** (same as the Summary):

    | Check | D/C | Worked | Result |
    |---|---|---|---|
    | Tie spacing | 1.00 | 12 / 12 in | PASS |
    | Longitudinal steel, min | 0.96 | 5.09 / 5.28 in² | PASS |
    | Anchor tension | 0.49 | 9,791 / 20,160 lb | PASS |
    | Post combined stress (AISC 360 §H1.1) | 0.24 | — | PASS |
    | D/t | 0.15 | 40.0 / 261.0 | PASS |
    | Soil bearing | 0.08 | q = 1,117 lb / 7.07 ft² = 0.16 ksf ≤ 2.00 ksf | PASS |
    | Shaft flexure | 0.08 | 19,949 / 255,217 lb·ft | PASS |

  - **Other cases:**
    - monopost sign: 19 pages, 6 sections;
    - two-post sign: 26 pages, 7 sections (one per post);
    - square shaft / check mode / constrained: 27 pages;
    - no cables: 22 pages, 13 sections;
    - Broms on: 30 pages.

### D11 links: quoted values link to where they are worked (CLAUDE.md §6) (Tier 1, display only)
- **Links added** (Summary tab; they read "Worked in: → Tab · Card"):
  1. **"Demand vs capacity":** a "Worked in" column. Each check opens its worked calculation:
     - shaft checks → Shaft · Shaft structural check (`#rebarExample`);
     - soil bearing → `#bearingExample`;
     - anchor checks → Anchors · Anchor bolt design (`#boltExample`);
     - shaft torsion → the Anchors limit-state table (`#boltTbl`);
     - post combined stress → Post · Pole/Post combined stress (`#poleStrExample`);
     - D/t → `#poleStressTbl`.
  2. **"Governing demands":**
     - ASD row → Shaft · Foundation demand & embedment (`#demandExample`);
     - LRFD row → Loading · Load combinations (`#comboMatrixTbl`; sign: `#sgComboTbl`).
  3. **"Key design inputs":** the B₂ value → Post · Pole combined stress. B₂ is worked in step 1 of the pole/post derivation.
- **Sign mode:**
  - The targets are the per-post ids (`…_sp1`, `…_sp2`).
  - With two posts, the link first selects that post (`__selectedPost`, the post selector), then opens the tab.
- **Clicking a link:**
  - It switches the tab, opens a closed worked-calculation `<details>`, scrolls to the block and flashes it.
  - Only the shown tab / post changes, as a tab click does. `switchTab` writes the remembered tab key `lpp_activeTab_v1` as before.
  - Inputs, results and saved projects are untouched.
- **In the report,** each link reads "see §n.k" (the subsection that holds that worked block).
  - A target missing from the printout would read "see the <Tab> tab (…); not in this printout". None of the 6 test cases has one.
- **Check case:**
  - **Default pole, Summary tab:** "Anchor tension … → Anchors · Anchor bolt design" opens Anchors at the worked Ch. 17 block.
    - The report reads "see §14.7".
    - The results block reads "Anchor tension: D/C = 0.49 (ACI 318-19 Ch.17) see §14.7 PASS".
  - **Two-post sign:** "Anchor tension · P2" selects Post 2 and opens `#boltExample_sp2`. The report reads "see §7.5".

### Verification (whole PR)
- **Syntax:** `node tests/check-syntax.mjs "Light Pole and Sign Post.html"`: all scripts pass.
- **No computed result changed.** Headless Chromium, origin/main (9119f2a) vs this branch, with KaTeX 0.16.9 served locally (npm pack).
  - **Method:** every function declaration is global, so the harness wrapped `renderSummary`, `buildReport` and `buildSignReport` to capture their full argument objects:
    - the Summary context, with every stack's `found`, `pstress`, `asd`, `lrfd`, `nat`, `b2` and `broms`;
    - `allCombos`, `struct`, `postDesigns` and the other builder arguments;
    - `window.__summary`.
  - **6 cases:**
    1. default pole;
    2. square shaft, square HSS, check-mode rebar, constrained, no anchor reinforcement;
    3. no cables, rectangular HSS, V = 140, custom soil, isolated ×2;
    4. monopost sign;
    5. two-post sign (V = 130, square shaft);
    6. Broms cohesive, K_d override 0.95.
  - **Results:**
    - In all 6 cases, the captured objects (99–283 k characters of JSON each) are identical.
    - The text of the Geometry / Summary / Loading / Post / Anchors / Shaft tabs is identical once the new "Worked in" cells and links are removed. The only remaining difference is the square-shaft A_base formula (cases 2 and 5), as intended.
    - No console errors.
- **Page smoke test:** `node tests/compare.mjs --tool page --file "Light Pole and Sign Post.html"`.
  - `page.text` and `page.storage` are the same.
  - The 3 console errors are the kit's blocked jsDelivr KaTeX requests, identical on main.
- **Report PDF** for the 6 cases (print media, `preferCSSPageSize`, `printBackground`):
  - Every internal link (`#crp-…`) resolves.
  - KaTeX: 0 errors, and no raw TeX outside KaTeX.
  - No empty subsection and no unmapped "§" reference.
  - pdftotext shows the "see §" links.
  - Pages inspected:
    - cover; references / contents; Design Summary with its results;
    - wind (3.x); the cable section; pole stress with its result lines and the D/t line;
    - shaft reinforcement; soil bearing;
    - sign load combinations; a sign post section with the torsion block.
- **Headless click test** (default pole, two-post sign, monopost):
  - Every link type opens the right tab / post, opens the collapsed calculation and flashes the target in view.
  - No console errors.
- **Print and narrow screens:**
  - Printing from the Geometry tab shows only the report; the masthead and the other tabs are hidden.
  - At 390 px wide the page has no horizontal scroll.

### Open items (not changed; engineer to decide)
- **Calculation (raised only), shaft φ:** the shaft P–M uses φ = 0.65 ("tied, compression-controlled") for every section, including clearly tension-controlled ones.
  - Default pole: the extreme bar strain is −15.7×10⁻³.
  - ACI 318-19 Table 21.2.2 gives φ = 0.90 when ε_t ≥ 0.005.
  - The tool's value is conservative. Keep 0.65?
- **Calculation (raised only), sign Broms arguments:** in sign mode the Broms reference check is called with different moments.
  - The Summary's "Reference comparisons" calls `bromsEmbedment(inp, gLRFD.M/1000, gLRFD.P/1000)` (first-order M).
  - The Shaft tab and the report call it with `F.Mu/1000, F.Vu/1000` (B₂·M).
  - Monopost default with cohesive soil: L = 7.35 ft (Summary) vs 7.37 ft (tab / report).
  - It is a reference check with no design effect. Which arguments should both use?
- **Not worked anywhere (§6 gap):**
  - The natural frequency n₁ (Rayleigh) and G_f are quoted, not derived.
  - Shaft torsion φT_th and the D/t limit are now worked in the report only. Show those two blocks in the Post / Anchors tabs too?
- **Title block fields:** the tool has no Project No., Calculated by, Checked by or date fields, so the cover and the page header show "—". Add optional tool-prefixed fields, saved in the project state?
- **Behaviour change to confirm:**
  - Ctrl+P now prints only the calculation report. Before, it printed every output tab, then the report.
  - The Report tab's sections are no longer collapsible.

## 2026-10-19 — PR: claude/lightpole-shaft-phi (shaft flexure φ per ACI 318-19 Table 21.2.2; engineer decision 2026-10-19; PR link added after merge)

Answers the D11 open item "Calculation (raised only), shaft φ" above. Engineer decision: replace the fixed φ = 0.65 with φ from the net tensile strain, tied row of Table 21.2.2.

### SHAFT-PHI: strain-dependent φ for the drilled-shaft P–M (§4 result change)
- **Where:** `pmCapacity(shape, b_in, As, nbar, rbar, fc, fy, Pu)`, anchor `// governing = smallest Mn` (≈ line 3172). Display: `rebarWorkedHTML`, anchor `\\phi M_n = ${fmt(cap.phi,2)}` (≈ line 4772). Manual Part 4C.1, anchor `\u03b2\u2081 follows §22.2.2.4.3` (the source writes β₁ as \u escapes). Comment above `barLayoutRound`, anchor `φ = 0.65 (tied, compression-controlled default)`.
- **Before** (`pmCapacity`):
  ```js
  // governing = smallest Mn
  const gov=axes.reduce((a,x)=>x.detail.Mn<a.detail.Mn?x:a);
  const phi=0.65;
  return {phiMn:phi*gov.detail.Mn/12, Mn:gov.detail.Mn/12, Pn:gov.detail.Pn, c:gov.detail.c, phi,
          detail:gov.detail, beta1, R:gov.hDepth, Es, ecu, Abar, nbar, rbar,
          shape, axisName:gov.axisName, axes};
  ```
- **After:**
  ```js
  // φ per ACI 318-19 §21.2.1, Table 21.2.2 (tied transverse reinforcement): ε_t = net tensile strain
  // in the extreme tension bar (deepest bar; eps > 0 is compression, so ε_t = −eps), ε_ty = f_y/E_s.
  const ety=fy/Es;
  axes.forEach(ax=>{
    const rt=ax.detail.rows.reduce((a,r)=>r.di>a.di?r:a);
    const et=-rt.eps;
    const phiA = et<=ety ? 0.65 : (et>=ety+0.003 ? 0.90 : 0.65+0.25*(et-ety)/0.003);
    Object.assign(ax,{phi:phiA, epsT:et, dt:rt.di, kT:rt.k,
      phiCls: et<=ety ? 'compression-controlled' : (et>=ety+0.003 ? 'tension-controlled' : 'transition'),
      phiMn:phiA*ax.detail.Mn/12});
  });
  // governing = smallest φMn (φ now differs per axis)
  const gov=axes.reduce((a,x)=>x.phiMn<a.phiMn?x:a);
  const phi=gov.phi;
  return {phiMn:gov.phiMn, Mn:gov.detail.Mn/12, Pn:gov.detail.Pn, c:gov.detail.c, phi,
          epsT:gov.epsT, ety, dt:gov.dt, kT:gov.kT, phiCls:gov.phiCls,
          detail:gov.detail, beta1, R:gov.hDepth, Es, ecu, Abar, nbar, rbar,
          shape, axisName:gov.axisName, axes};
  ```
- **Expression:**
  - Before: φ = 0.65 for every section and every LRFD combination.
  - After: ε_ty = f_y/E_s; ε_t = 0.003(d_t − c)/c of the extreme tension bar at the converged c (the existing strain-compatibility solution; the tool stores bar strain with compression positive, so ε_t = −ε of the deepest bar);
    - ε_t ≤ ε_ty: φ = 0.65;
    - ε_t ≥ ε_ty + 0.003: φ = 0.90;
    - otherwise φ = 0.65 + 0.25(ε_t − ε_ty)/0.003.
  - φ is evaluated for each LRFD combination's P_u (the auto-size loop and the check mode both go through `pmCapacity`, so both use it).
  - **Square shafts:** each axis (face, diagonal) gets its own φ and the axis with the smaller **φM_n** governs. Before, the smaller M_n governed (the same thing while φ was constant). The card already said "smaller φM_n".
- **Not changed:** the shaft has no spiral option (transverse steel is ties only, `manTieBar`/auto ties), so the tied row applies; no spiral row was added. There is no separate axial-only φ in the shaft check (no φP_n,max check exists). The anchor φ (0.65/0.70/0.75), shear φ = 0.75, torsion φ = 0.75 and base-plate φ = 0.90 are unchanged. Broms does not use φM_n of the shaft.
- **Governing provision:** ACI 318-19 §21.2.1 (φ for moment, axial force, or combined), Table 21.2.2 (φ by net tensile strain ε_t, "Other" (tied) transverse reinforcement), with ε_ty = f_y/E_s (§21.2.2.1). Less conservative than before (φ rises from 0.65 up to 0.90).
- **Display (CLAUDE.md §6):** Shaft · Shaft structural check, step 3, and report §13 (same `rebarWorkedHTML`): a new "Strength reduction factor φ [ACI 318-19 §21.2.1, Table 21.2.2]" block works ε_ty, ε_t and φ symbolically → substituted → result, names the extreme tension bar and d_t, and the φM_n line now shows φ to 3 decimals with its class (was the fixed text "φ = 0.65, tied, compression-controlled"). Manual Part 4C.1 gains one paragraph on φ.
- **Saved data:** none. No key or format changed. New result fields only (`cap.epsT`, `ety`, `dt`, `kT`, `phiCls`, per-axis `phi`/`phiMn`).

### Hand check (default light pole, "Main St Pole 4")
- Round shaft b = 36 in, (12) #6, f′c = 4,000 psi, f_y = 60,000 psi, E_s = 29,000,000 psi, cover 3 in + #4 tie allowance → r_bar = 18 − 3 − 0.5 − 0.375 = 14.125 in.
- Governing LRFD combination 1.2D + 1.0W: P_u = 1,088 lb, M_u = 19,949 lb·ft; converged c = 5.151 in (unchanged).
- Extreme tension bar = bar 10 (270°): d_t = 18 + 14.125 = 32.125 in.
- ε_ty = 60,000/29,000,000 = 2.069×10⁻³; ε_ty + 0.003 = 5.069×10⁻³.
- ε_t = 0.003(32.125 − 5.151)/5.151 = 15.711×10⁻³ (the −15.711×10⁻³ bar-10 strain in the table; D11 quoted −15.7×10⁻³) ≥ 5.069×10⁻³ → tension-controlled, φ = 0.90.
- M_n = 392,641 lb·ft (unchanged).
- φM_n: before 0.65 × 392,641 = 255,217 lb·ft; after 0.90 × 392,641 = 353,377 lb·ft.
- Shaft flexure D/C: before 19,949/255,217 = 0.078; after 19,949/353,377 = 0.056.
- Bars: (12) #6 before and after (minimum steel governs the selection, not flexure).

Transition check (default pole with b = 1.25 ft, V = 150 mph): (6) #6, c = 4.20 in, d_t = 10.64 in, ε_t = 0.003(10.64 − 4.20)/4.20 = 4.598×10⁻³; φ = 0.65 + 0.25(4.598 − 2.069)/3.000 = 0.861; M_n = 62,294 lb·ft; φM_n = 0.65 × 62,294 = 40,491 → 0.861 × 62,294 = 53,621 lb·ft; D/C 33,907/40,491 = 0.837 → 0.632.

### Before / after, the 6 PR #277 cases
| Case | Bars (auto/check) | ε_t (×10⁻³) | φ | φM_n (lb·ft) | M_u (lb·ft) | Shaft flexure D/C |
|---|---|---|---|---|---|---|
| 1 Default pole | (12) #6 → (12) #6 | 15.711 | 0.65 → 0.90 | 255,217 → 353,377 | 19,949 | 0.078 → 0.056 |
| 2 Square shaft / check mode / constrained | (8) #8 check → same | 29.915 (face axis governs; diagonal 9.95) | 0.65 → 0.90 | 334,250 → 462,808 | 17,492 | 0.052 → 0.038 |
| 3 No cables / rect tube / V = 140 / custom soil | (12) #6 → (12) #6 | 15.724 | 0.65 → 0.90 | 254,994 → 353,069 | 39,064 | 0.153 → 0.111 |
| 4 Monopost sign | (12) #6 → (12) #6 | 15.727 | 0.65 → 0.90 | 254,938 → 352,992 | 38,186 | 0.150 → 0.108 |
| 5 Two-post sign (V = 130, square), P1 and P2 | (16) #6 → (16) #6 | 27.208 (face; diagonal 9.34) | 0.65 → 0.90 | 368,825 → 510,680 | 36,560 | 0.099 → 0.072 |
| 6 Broms cohesive, K_d override 0.95 | (12) #6 → (12) #6 | 15.711 | 0.65 → 0.90 | 255,217 → 353,377 | 18,954 | 0.074 → 0.054 |

- No auto-sized bar set changed in these 6 cases: flexure D/C is ≤ 0.15 and minimum steel governs the selection. The governing axis of the square shafts is unchanged (face). Shaft diameter is an input, not auto-sized, so no shaft size changes.
- Flexure-governed demonstration (default pole, b = 1.5 ft, V = 180 mph, H = 50 ft): auto-size picks (9) #6 before (φ = 0.65, φM_n = 73,392, D/C 0.989) and (6) #6 after (ε_t = 6.909×10⁻³, φ = 0.90, φM_n = 75,113 lb·ft, D/C = 72,570/75,113 = 0.966).

### Every output that changes (6 cases)
- Shaft tab: "Vertical reinforcement" φM_n vs M_u readout (`oPhiMn`); the worked shaft card step 3 (new φ block, φM_n lines, "Provide … φM_n = …" line); check-mode table "Flexure" row (case 2).
- Summary: "Shaft flexure (P–M)" row capacity and D/C (and its utilisation %).
- Report: §13 shaft reinforcement (same worked block) and the Design Summary result line "Shaft flexure".
- Captured result objects: only `reo.long.phiMn`, `reo.long.cap.phiMn`, `reo.long.cap.phi`, plus the new fields. Nothing else differs: loads, combinations, embedment, bearing, Broms, anchors, pole stress, ties and the governing check (tie spacing, D/C 1.00) are identical. `window.__summary` text is identical.

### How verified
- `node tests/check-syntax.mjs "Light Pole and Sign Post.html"`: all scripts pass.
- `node tests/compare.mjs --tool page --file "Light Pole and Sign Post.html"`: page.text and page.storage same; the 3 console errors are the kit's blocked jsDelivr KaTeX requests, identical on main.
- Headless Chromium, origin/main (78938d8) vs branch, KaTeX 0.16.9 served locally (npm pack), the PR #277 harness (wraps `renderSummary`, `buildReport`, `buildSignReport`): leaf-by-leaf diff of every captured object for the 6 cases; the only differing leaves are those listed above. No console errors; no `.katex-error` in any case; the report holds the φ block once per stack.
- Screenshots of the worked φ step (tension-controlled, transition, and the flexure-governed case) inspected.

### Other copies
- None. `pmCapacity` exists only in this tool.

### Open items
- None new.
