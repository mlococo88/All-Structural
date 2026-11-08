# Fix log — Light Pole and Sign Post.html

Governing basis used for fixes: the tool's stated basis — ASCE 7-22 (Ch. 26/29 wind), AISC 360-16, ACI 318-19 (Ch. 17, §22.4), IBC 2021 §1806/§1807.3. (Not an AASHTO LRFDLTS tool.)

## 2026-10-04 — PR: claude/fix-light-pole (PR #22: https://github.com/mlococo88/All-Structural/pull/22)

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

## 2026-10-18 — PR: claude/lightpole-d11-report (AUDIT.md D11, display only; PR #277: https://github.com/mlococo88/All-Structural/pull/277)

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

## 2026-10-19 — PR: claude/lightpole-shaft-phi (shaft flexure φ per ACI 318-19 Table 21.2.2; engineer decision 2026-10-19; PR #320: https://github.com/mlococo88/All-Structural/pull/320)

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

## 2026-10-21 — PR: claude/lightpole-torqued (anchor installation input and ACI 318-19 §17.9 minimum geometry; PR #402: https://github.com/mlococo88/All-Structural/pull/402)

### TQ1. Anchor installation input (Untorqued / Torqued) and ACI 318-19 §17.9.2 minimum spacing and edge distance checks   [new checks] [no existing result changes]
- **Where:**
  - Input card 7 "Anchor bolts & base plate": new row after "Anchor reinforcement", anchor text `id="segAnchTq"`, and the notice `<p ... id="anchTqMigNote">`.
  - State: `let anchTq='torqued';` below `let anchRe='yes';`; click handler below the `#segAnchRe` handler; `calc()` input object `bpDia:num('bpDia'),anchTq:anchTq,`.
  - `anchorBolts()`: new block after `const sfbApplies = ca1 < 0.4*hef;`; new return fields `torq,sAnch,sMinReq,spOK,edReq,edProv,edOK`.
  - New `boltMinGeomRows(b)` above `function boltNotCheckedRows(b){`; called before `boltNotCheckedRows` in both limit-state tables (light pole, `$('boltTbl')`; sign posts, `S('boltTbl')`).
  - `boltWorkedHTML()`: new step "9 · Minimum spacing and edge distance" after the base-plate step (also printed in the report's anchor sections, which reuse `boltWorkedHTML`).
  - `collectChecks()`: two new checks after `'Anchor T–V interaction'`; `LPP_CHK2K` maps both to `anchors`; `summaryHTML()` Demand-vs-capacity cells use `c.dec` when set (2 decimals for the new rows; other rows unchanged); new design row `drow('Anchor installation', …)`.
  - Report: anchor varsub line adds "torqued (pretensioned)" / "untorqued"; `LPP_REFS` ACI and AASHTO LTS lines extended.
  - Manual Part (inputs table, anchor rows): new "Anchor installation" row.
  - `captureState()` adds `anchTq`; `applyState()` reads it (migration below).
- **Problem:** the tool computed c_a1 = R_edge − R (for ψ_ed,N and the side-face blowout flag) but had no ACI 318-19 §17.9 minimum spacing / edge distance check, and no way to say whether the anchors are torqued.
- **Governing provision:** ACI 318-19 §17.9.1, §17.9.2 Table 17.9.2(a) (cast-in anchors: minimum spacing 4d_a not torqued, 6d_a torqued; minimum edge distance = specified cover per §20.5.1.3 not torqued, 6d_a torqued), §17.9.3 (d_a′ substitution for untorqued anchors; cited, not computed), §17.9.4 (h_ef limit for post-installed expansion/screw/undercut anchors; does not apply to cast-in, stated in the work). Wording and table values cited from the code; verify against the engineer's copy.
- **Default (decided):** Torqued for new projects. AASHTO LTS practice (snug-tight, then turn-of-nut pretension of the anchor rods in the base connection; the tool's reference list already names AASHTO LTS) means pole and sign anchor rods are tightened, so the torqued limits are the accurate ones. Article/edition of the LTS tightening provision: verify (cited by subject only).
- **Expressions (new):**
  - s = BC·sin(π/n) (chord between adjacent bolts); s_min = 6d_a torqued, 4d_a untorqued. Not checked for n = 1.
  - Torqued: c_a1 = R_edge − BC/2 ≥ 6d_a.
  - Untorqued: clear cover to the anchor shank c_a1 − d_a/2 ≥ specified cover (the Clear cover input, §20.5.1.3).
  - Utilization = required ÷ provided (the tool's convention for minimum-type checks); PASS when provided ≥ required.
- **Existing formulas, factors, units:** none changed. No capacity depends on the new input.
- **Saved data / migration:** new top-level field `anchTq` in the project state (`lpp_projects_v1`, `lpp_session_v1`); no key or existing field changed. A save without `anchTq` opens as **Untorqued** with the notice `anchTqMigNote` (hidden once the user picks a setting). Every earlier result is unchanged in both settings (verified, below); only the new rows are added. New projects (`DEFAULT_STATE`, the "New" button, empty storage) start Torqued.
- **Check cases** (lengths in in; f′c, loads irrelevant):
  - Default pole: (6) 1 in, BC 16, shaft 3.0 ft → R_edge = 18, c_a1 = 18 − 8 = 10.00. s = 16·sin(30°) = 8.00.
    - Torqued (new default): s_min = 6.00 → 6.00/8.00 = 0.75 PASS; c_min = 6.00 → 6.00/10.00 = 0.60 PASS.
    - Untorqued (old save): s_min = 4.00 → 0.50 PASS; cover 10.00 − 0.50 = 9.50 ≥ 3.00 → 0.32 PASS.
  - Edge case: shaft 2.0 ft → R_edge = 12, c_a1 = 4.00. Torqued: 4.00 < 6.00 → 1.50 **FAIL**. Untorqued: 4.00 − 0.50 = 3.50 ≥ 3.00 → 0.86 PASS.
  - Spacing case: n = 12, BC 16 → s = 16·sin(15°) = 4.14. Torqued: 6.00/4.14 = 1.45 **FAIL**. Untorqued: 4.00/4.14 = 0.97 PASS.
  - 1½ in bolts, shaft 2.5 ft (R_edge 15, c_a1 = 7.00): torqued s_min = c_min = 9.00 → spacing 9.00/8.00 = 1.13 FAIL, edge 9.00/7.00 = 1.29 FAIL; untorqued spacing 6.00/8.00 = 0.75 PASS, cover 7.00 − 0.75 = 6.25 ≥ 3.00 → 0.48 PASS.
- **How verified:**
  - `node tests/check-syntax.mjs "Light Pole and Sign Post.html"`: all scripts pass.
  - Headless Chromium, origin/main (23778ea) vs branch, KaTeX 0.16.9 served locally. Five cases seeded as an old save (main's `DEFAULT_STATE`, no `anchTq`): default pole, shaft 2.0 ft, n = 12, two-post sign (V 130, square shaft), 1½ in bolts with no anchor reinforcement. For each: every existing `collectChecks` row (demand, capacity, ratio, ok) and every scalar of the governing `anchorBolts` result are identical to main, opened as Untorqued and again after clicking Torqued. Branch opens old saves as Untorqued with the notice shown; empty storage opens Torqued with no notice. New rows, step 9, Summary rows and the report result lines (Design Summary and the anchor section, per post for the sign) are as in the check cases. No console errors, no `.katex-error`, no ERR tokens.
- **Other copies:** none (`anchorBolts` exists only in this tool).
- **Open items:**
  - §17.9.1 allows lesser values where supplementary reinforcement is provided to control splitting. The tool does not take this from the "Anchor reinforcement: Provided" input (that input is the §17.5.2.1 breakout tie cage); the work says so. Engineer to decide whether the shaft's top-zone ties should waive the check.
  - c_a1 for a square shaft is b/2 − R (the existing value, also used for ψ_ed,N), i.e. a bolt on a face normal; it is conservative when no bolt sits on a face normal. Unchanged.
  - Untorqued cover is measured to the anchor shank; head/plate-washer and template clearance to the shaft cage are detailing checks, not done.
  - §17.9.3 d_a′ substitution for untorqued anchors that fail the limits is cited, not computed.

## 2026-10-21 — PR: claude/lightpole-splitting (follow-up to #402: §17.9.1 splitting reinforcement input; square-shaft edge distance per bolt; PR #404: https://github.com/mlococo88/All-Structural/pull/404)

### TQ2. "Splitting reinforcement at the shaft top" input waives the §17.9.2 minimums (ACI 318-19 §17.9.1)   [new input] [default: no change]
- **Where:**
  - Input card 7: new row after `id="anchTqMigNote"`, anchor text `id="segSplitRe"` (Provided / None, default None). Separate from the breakout `segAnchRe` input.
  - State: `let splitRe='no';` below `let anchTq='torqued';`; click handler above the `#segAnchTq` handler; `calc()` input `anchTq:anchTq,splitRe:splitRe,`.
  - `anchorBolts()`: `const splitW = inp.splitRe==='yes';`, returned as `splitW`.
  - `collectChecks()`: the two §17.9.2 checks are pushed only when `!b.splitW` (a waived minimum is not a design check, so it is neither a pass nor a fail in the verdict).
  - `boltMinGeomRows()`: when waived, a single "WAIVED: splitting reinforcement provided at the shaft top (§17.9.1)" row with the provided s, c_a,min and the limits that would apply.
  - `boltWorkedHTML()` step 9: the values are still worked; the PASS/FAIL words become "waived (§17.9.1)" and a WAIVED paragraph follows; the closing note names the new input.
  - Summary "Anchor installation" design row and the report varsub line state the waiver.
  - Manual inputs table: new row. `captureState()` adds `splitRe`; `applyState()` reads it (`st.splitRe==='yes' ? 'yes' : 'no'`).
- **Governing provision:** ACI 318-19 §17.9.1 (the minimum spacing / edge distance of §17.9 apply unless supplementary reinforcement is provided to control splitting); Table 17.9.2(a).
- **Before / after:** before, the §17.9.2 checks always applied. After: unchanged with None (default); with Provided, both checks are waived (shown, not checked).
- **Saved data:** new top-level field `splitRe`; saves without it open as None, i.e. exactly as before.
- **Check case:** round shaft 2.0 ft, (6) 1 in, BC 16, torqued: c_a1 = 12 − 8 = 4.00 < 6.00 → edge distance 1.50 FAIL, verdict "1 CHECK FAIL". With splitting reinforcement Provided: the row reads WAIVED (s = 8.00, c_a,min = 4.00; torqued limits 6.00 / 6.00), step 9 says "waived (§17.9.1)", the check is not in the Summary, verdict "ALL CHECKS PASS".

### TQ3. Square shaft: §17.9 edge distance per bolt to the nearest face   [calc change to the #402 check] [less conservative = exact; round shafts and squares with a bolt on a face normal unchanged]
- **Where:** `anchorBolts()`, block above `const torq = inp.anchTq==='torqued';`; `edProv` now uses `ca17`; new return fields `sqShaft, ca17, caGovK, caGovAng`; each bolt object gets `ca`. `boltMinGeomRows()` and step 9 of `boltWorkedHTML()` show c_a,min (and the governing bolt for a square shaft, with every bolt's value listed). Summary design row shows c_a,min.
- **Before:**
  ```js
  const edProv = torq ? ca1 : ca1 - d/2;                       // in
  ```
  with ca1 = R_edge − R for both shapes (for a square, b/2 − R: the distance of a bolt on a face normal).
- **After:**
  ```js
  const sqShaft = inp.shaftShape==='square';
  bolts.forEach(b=>{ b.ca = sqShaft ? Redge - R*Math.max(Math.abs(Math.cos(b.ang*RAD)),Math.abs(Math.sin(b.ang*RAD))) : ca1; });
  const caGovB = bolts.reduce((a,b)=>b.ca<a.ca?b:a, bolts[0]);
  const ca17 = caGovB ? caGovB.ca : ca1;
  ...
  const edProv = torq ? ca17 : ca17 - d/2;
  ```
  c_a,i = b/2 − R·max(|cos θ_i|, |sin θ_i|), θ_i = θ_b + (i−1)·360°/n, shaft faces normal to 0°/90°/180°/270° (as `drawBoltGroup` draws the square). The smallest c_a,i governs.
- **ψ_ed,N not changed:** the tool's tension breakout is a group calculation (one A_Nc, one ψ_ed,N with c_a,min = c_a1), not per bolt, so ψ_ed,N keeps c_a1 = b/2 − R; the side-face blowout flag also keeps c_a1. Step 9 says so.
- **Governing provision:** ACI 318-19 §17.9.2, Table 17.9.2(a) (edge distance of each anchor); §20.5.1.3 (untorqued cover).
- **Check cases** (square shaft b = 2.0 ft → b/2 = 12 in, BC 16 → R = 8 in, 1 in bolts, torqued unless noted):
  - n = 6, θ_b = 0°: bolt 1 at 0° → 12 − 8·1 = 4.00 (others 12 − 8·0.866 = 5.07). c_a,min = 4.00 → 6/4 = 1.50 FAIL. Before: 4.00, 1.50 FAIL (unchanged).
  - n = 4, θ_b = 45°: every bolt on a diagonal → 12 − 8·0.7071 = 6.34. 6/6.34 = 0.95 PASS. Before: 4.00 → 1.50 FAIL.
  - n = 6, θ_b = 15°: θ = 15, 75, 135, 195, 255, 315° → max(|cos|,|sin|) = 0.9659, 0.9659, 0.7071, … → c_a,min = 12 − 7.727 = 4.27. 6/4.27 = 1.40 FAIL. Before: 4.00 → 1.50 FAIL.
  - n = 4, θ_b = 45°, untorqued: cover 6.34 − 0.50 = 5.84 ≥ 3.00 → 0.51 PASS. Before: 4.00 − 0.50 = 3.50 → 0.86 PASS.
- **How verified:** `node tests/check-syntax.mjs "Light Pole and Sign Post.html"` passes. Headless Chromium, origin/main (8adebd1, with #402) vs branch, KaTeX 0.16.9 local, 9 cases (default; an old save without `anchTq`/`splitRe`; round shaft 2.0 ft; the four square cases above; splitting reinforcement on the round 2.0 ft case; two-post sign, square 2.0 ft, n = 12, splitting on). Every check that existed before #402 and every anchor result scalar is identical in all 9. The §17.9 rows are identical for the default, the old save, the round shaft and the square with θ_b = 0°; they differ only as listed above; with splitting reinforcement they leave the Summary and are shown as WAIVED. No console errors, no `.katex-error`, no ERR tokens.
- **Other copies:** none.
- **Open items:**
  - The tension-breakout A_Nc integration clips by a circle of radius b/2 for a square shaft too (`u*u+w*w>Redge*Redge`), i.e. the inscribed circle; conservative for a square. Unchanged (pre-existing; engineer to decide).
  - ψ_ed,N for a square shaft keeps c_a1 = b/2 − R even when no bolt sits on a face normal; conservative. Unchanged, per the group method.

## 2026-11-01 — PR #537: claude/lp-pr0-harness (LP-0: test harness, scope line, manual Case B row; display only)

Basis: the deep review of 2026-11-01 (findings LP-R0…LP-R24) and the engineer's decisions of 2026-11-01 (scope; LTS 2nd Ed. mode later; no change to anything cable-related).

### LP0-1. Scope line (LP-R0)   [display] [no result change]
- **Where:** masthead, after `<div class="codetag">`, anchor `id="lppScope"` (CSS `.masthead .lppScope`); report cover in `lppReportDoc()`, after the line `'IBC 2021 §1807.3 · ASCE/SEI 7-22 · ACI 318-19 · AISC 360-16'`: `ct.appendChild(mk('p','cr-cover-p',lppEsc($('lppScope')?$('lppScope').textContent:'')));`
- **Text:** "Scope (this mode): IBC 2021 · ASCE 7-22 · AISC 360-16 · ACI 318-19 — non-highway light poles and sign supports (site, parking, sports and private signs). AASHTO LRFDLTS 2nd Ed. highway supports are a separate mode (coming); do not use this mode for them."
- **Engineer decision (2026-11-01):** keep this mode; an AASHTO LRFDLTS 2nd Ed. mode is added later by a separate PR.

### LP0-2. Manual: Case B row (LP-R24)   [display]
- **Where:** Manual §4A.4 table, anchor `["B","Offset e = 0.2B toward the windward edge",`.
- **Before:** `"Two posts only"`. **After:** `"All configurations (two posts: unequal split; monopost: as torsion)"` (true since F19, 2026-10-12).

### LP0-3. Test harness (no tool change)
- `tests/engine/lp-source.mjs`: the tool's own declarations, pulled from the page text into a Node vm on first use (as gd-source.mjs); `lpDefaultInp()` = the page's default inputs as calc() builds them.
- `tests/engine/lightpole.test.mjs`: the review's hand checks (§3 Cases 1–3: K_z, q_z, fixture and cable wind, cable pull, HSS properties and F8 M_n, IBC embedment, A_se, φN_sa, N_b, T_max, ψ_ed,N, sign q_h, Fig. 29.3-1 C_f, F_A, Case C) and TQ3. Note: the review's I = 91.06 in⁴ is a rounding slip; π/64·(10⁴ − 9.5⁴) = 91.05 (the tool's value; Z, S, M_n as in the review).
- `tests/lightpole-compare.mjs`: headless Chromium, two versions, 13 cases (default pole; square shaft/HSS check mode; no cables rect HSS V 140; Broms + K_d override; single cable at 45°; 60 ft pole; 1 in ice; 1½ in bolts; offset arms; monopost; monopost square; two-post; wide two-post). Compares the argument objects of renderSummary / buildReport / buildSignReport, every cable value (components and reactions in every combination and azimuth, an explicit "unchanged" check), the text of every output tab, and an SVG hash per drawing. `--old-saves` opens A's project state in B.
- `tests/libs`: KaTeX 0.16.9 `dist/contrib/auto-render.min.js` from the npm package, and the jsDelivr prefix in MANIFEST.json.

### Verification
- `node tests/check-syntax.mjs "Light Pole and Sign Post.html"`: pass. `node tests/engine/run.mjs lightpole`: 10 passed.
- `node tests/lightpole-compare.mjs --a origin/main` (553e98d): all 13 cases — results identical, cable values identical, drawings identical, 0 console errors; the only text difference is the new scope line on the report cover (+1 line per case). Screenshots at 1280 and 390: no horizontal scroll.

## 2026-11-01 — PR #543: claude/lp-pr1-display (LP-1: off-axis arm warning, Case C eccentricity sign, ASCE 7-22 velocity-pressure form; no design result changes)

### LP1-1. Wind-direction warning for arms not on the wind axes (LP-R1, engineer decision 2026-11-01)   [warning] [no result change]
- **Decision:** keep the 4 wind directions (0/90/180/270°); no sweep. Warn when an arm/fixture is not aligned with those axes. Cables are excluded from the warning (engineer 2026-11-01: no change to anything cable-related). Sign panels are always on the axes (panel normal = +x), so no sign warning.
- **Where:** new `lppOffAxisFixtures(fx)` and `lppOffAxisMsg(L)` above `function evalCombo(`; used in `summaryHTML()` (pole mode, appended to the "not checked" box before the monopost torsion line) and in `calc()` flags (before `if(!cablesEnabled){`).
- **Rule:** a fixture with arm a > 0 and (W > 0 or EPA > 0) whose θ mod 90° ≠ 0.
- **Check case:** fixture at θ = 45°, a = 8 ft → "Fixture 1 (arm at θ = 45°) is not aligned with these axes … may be unconservative". The default pole (fixtures at 0° and 180°) shows no warning.

### LP1-2. Sign Case C eccentricity sign (LP-R14)   [display; per-direction split mirrored] [governing results unchanged]
- **Where:** `signWind()`, anchor `const eC=`; `signWindWorkedHTML()` line `e_C = \tfrac{B}{2}-\bar x`.
- **Before:** `const eC=xR - B/2;` (negative toward the windward edge: Case C mirrored relative to Case B's +0.2B). **After:** `const eC=B/2 - xR;` (positive toward the windward edge, the Case B convention).
- **Provision:** ASCE 7-22 Fig. 29.3-1 (Case C, higher pressure near the windward edge).
- **Effect:** the monopost torsion uses |F·e| (unchanged). On two posts the Case C split at 0° and at 180° swap; each post's envelope over both directions is the same, so every governing value (per-post ASD/LRFD demand, foundation, post stress, Summary) is identical. Only the per-direction rows of the combination study differ.
- **Check case (default monopost):** x̄ = (1,705·3 + 1,137·9)/2,842 = 5.40 ft from the windward edge; e_C before −0.60 ft, after +0.60 ft (= 6.00 − 5.40) toward the windward edge.

### LP1-3. Velocity pressure shown in the ASCE 7-22 form (LP-R12, label/form only)   [display] [no result change]
- **Before:** `q_z = 0.00256 K_z K_zt K_d V²` labelled "ASCE 7-22 Eq. 26.10-1" (that is the ASCE 7-16 form).
- **After:** `q_z = 0.00256 K_z K_zt K_e V²` (ASCE 7-22 Eq. 26.10-1, K_e = 1.0 per §26.9) with K_d shown as part of the force equation (Eq. 29.3-1 signs, Eq. 29.4-1 other structures); the worked lines show the product q_z·K_d (·G) with K_e = (1.00) substituted. Numbers are unchanged (K_e = 1.0).
- **Where:** Manual §(velocity pressure) `{p:"Velocity pressure follows ASCE 7-22 Eq. 26.10-1`; `windWorkedHTML()` step 2; `fixtureWorkedHTML()` q_z and q_zi lines; `signWindWorkedHTML()` step 1; sign load path post drag line; `buildReport()` eqB "Velocity pressure, q_z" and "Evaluated at the two reference heights".
- **Not changed:** the cable worked equation (cable features are left exactly as they are, engineer 2026-11-01) still reads `q_W=0.00256 K_z(h_c)K_zt K_d G C_f V²` — numerically the same. K_z constants (7-16 Table 26.11-1 α/z_g) not changed: open question below.

### Verification
- `node tests/check-syntax.mjs`: pass; `node tests/engine/run.mjs lightpole`: 10 passed.
- `node tests/lightpole-compare.mjs --a origin/main` (5f49cfc), 13 cases: results identical in all 9 pole cases; cable values identical (1,155 numbers on the default pole, 561 for the single 45° cable); drawings identical; 0 console errors. Sign cases: monopost 1 value (caseC.e sign); two-post 169 values, all in the per-direction rows of the combination study (posts[] of each azimuth, Case C split mirrored) plus caseC.e — every per-post governing demand (postGov), foundation stack, post stress and Summary value identical (checked by filtering the diff paths). Text: the relabelled equations, e_C, and the arm warning (arms case).

### Open items (not changed)
- ASCE 7-22 Table 26.11-1 constants (α, z_g) for K_z: the tool keeps the 7-16 values (difference < 1 %: Exp. C 35 ft 1.0147 vs ≈1.009). Engineer to decide whether to switch (a calc change).

## 2026-11-01 — PR #548: claude/lp-pr2-cf (LP-2: pole/post C_f from ASCE 7-22 Fig. 29.4-1; engineer decision 2026-11-01)

### LP2-1. Automatic pole/post force coefficient (LP-R3)   [calc change] [more conservative for square/rect HSS and small round posts; less for short round posts]
- **Engineer decision (2026-11-01):** automatic lookup from ASCE 7-22 Fig. 29.4-1 by shape and h/D; the user override is kept; the "round ≈0.7, square ≈1.3" hint is fixed.
- **Where:**
  - Input card 2: the `poleCfLabel` row is replaced by `cfPoleMode` (Auto / Manual), `cfPoleSurf` (round moderately smooth / rough / very rough / hexagonal-octagonal; shown for a round section), the `cfPole` value row (shown for Manual, hint now quotes Fig. 29.4-1 at h/D ≥ 25), and notes `lppCfNote`, `cfMigNote`. `lppApplyCfUI()` above `applyShapeUI()`.
  - New `CF2941`, `CF2941_LBL`, `cfPoleFig2941(inp)`, `lppApplyCfPole(inp)`, `cfPoleWorkedHTML(inp)` above `function poleWindNominal(`.
  - `calc()`: inputs `cfPoleMode`, `cfPoleSurf`; `lppApplyCfPole(inp)` before `calcSign(inp)` (sign) and before `poleSegments` (pole). It sets `inp.cfPole` (Auto), which the existing mast wind (`poleWindNominal`, bare and iced strips) and sign-post drag (`signWind`, `cfPost`) already use.
  - Worked step: `windWorkedHTML()` (before step 3), `signWindWorkedHTML()` (end), report section "Wind force on the pole" (before "Wind force on the pole shaft").
  - `INPUT_IDS` + `cfPoleMode`, `cfPoleSurf`; `applyState()` migration (below).
- **Before:** `C_f = inp.cfPole` as entered (default 0.7 for every shape).
- **After (Auto):** C_f = Fig. 29.4-1 value, linear in h/D between 1, 7, 25 (constant beyond 25):
  - square (wind normal to a face) 1.3 / 1.4 / 2.0; hexagonal-octagonal 1.0 / 1.2 / 1.4;
  - round, D√q_z > 2.5: moderately smooth 0.5 / 0.6 / 0.7, rough 0.7 / 0.8 / 0.9, very rough 0.8 / 1.0 / 1.2;
  - round, D√q_z ≤ 2.5 (all surfaces): 0.7 / 0.8 / 1.2.
  - D = mean outside width (rect: least dimension), h = pole height (sign: post height to top of panel), q_z = 0.00256 K_z K_zt K_e V² at h/2 (K_e = 1.0, no K_d).
- **Governing provision:** ASCE 7-22 §29.4.1, Fig. 29.4-1 (chimneys, tanks, rooftop equipment and similar structures). Values cited from the figure; verify against the engineer's copy.
- **Cables:** not affected (cable C_f is the separate `cfCable` input; every cable value identical, checked).
- **Saved data / migration:** new fields `inputs.cfPoleMode`, `inputs.cfPoleSurf`. A save without `cfPoleMode` opens as **Manual** with its saved C_f and the notice `cfMigNote` ⇒ old projects compute identically (verified). New projects (DEFAULT_STATE, New, empty storage) start on Auto, moderately smooth.
- **Check cases** (V 115, Exp. C, K_zt 1):
  - Default pole (round 6→10 in, 35 ft): D = 8/12 = 0.667 ft, q_z(17.5) = 0.00256·0.8769·13225 = 29.69 psf, D√q_z = 3.63 > 2.5, h/D = 52.5 → **0.7** (= old default; results unchanged).
  - Square HSS 8 in, 35 ft: h/D = 52.5 → **2.0** (was 0.7). Square-shaft case: embedment 4.67 → 5.59 ft, M_u 18,640 → 31,864 lb·ft, T_bolt 9,082 → 15,694 lb.
  - Rect HSS 8 × 6 in, 35 ft, V 140: D = 6 in, h/D = 70 → **2.0** (was 0.7): embedment 4.07 → 5.47 ft, M_u 15,905 → 35,910 lb·ft.
  - Square post 8 in, sign h = 16 ft: h/D = 24 → 1.4 + (24 − 7)/18·0.6 = **1.967** (was 0.7): embedment 8.51 → 8.64 ft.
  - Round post 8 in, sign h = 11 ft (wide two-post case): q_z(5.5 → 15 ft), D√q_z > 2.5, h/D = 16.5 → 0.6 + (16.5 − 7)/18·0.1 = **0.653** (was 0.7; less conservative, per the figure): embedment 9.126 → 9.122 ft.
  - Round 4 in post, 16 ft: D√q_z = 0.333·√28.74 = 1.79 ≤ 2.5, h/D = 48 → **1.2** (Node test).
- **How verified:** `node tests/engine/run.mjs lightpole` (13 passed, 3 new Fig. 29.4-1 tests). `node tests/lightpole-compare.mjs --a origin/main`: new projects — default pole, Broms, 45° cable, 60 ft pole, ice, 1½ in bolts, arms, monopost and two-post sign: results identical apart from the 4 new `inp` fields (cfPoleMode, cfPoleSurf, cfAuto, cfPoleEntered) since their C_f is 0.7 either way; square/rect/sign-square/wide two-post cases change as listed. `--old-saves` (main's saved state opened in the branch): all 13 cases identical apart from the 4 new `inp` fields; cable values identical in every case.
- **Open items:** Fig. 29.4-1 has no rectangle row (the square row with D = least dimension is used); the D√q_z criterion uses q_z at mid-height (the figure does not state the height; engineer to confirm); square sections with wind along a diagonal (1.0/1.1/1.5) are not used (the tool's wind directions are normal to the faces).

## 2026-11-01 — PR #550: claude/lp-pr3-pullout (LP-3: pullout bearing area of the heavy hex nut; engineer decision 2026-11-01)

### LP3-1. Pullout A_brg from heavy hex nut dimensions (LP-R6)   [calc change] [less conservative = exact]
- **Engineer decision (2026-11-01):** use the real heavy-hex nut bearing area by bolt diameter, citing the source table, instead of 0.9d².
- **Where:** `anchorBolts()`, block `// ---- pullout (ACI §17.6.3)`; new `HEAVY_HEX_F` and `heavyHexF(d)` above `function anchorBolts(`; return field `nutF`; `boltWorkedHTML()` step 4 (new F and A_brg lines); `LPP_REFS` + ASME B18.2.2.
- **Before:** `const Abrg=(d*d)*0.9;`
- **After:** `const nutF=heavyHexF(d); const Abrg=Math.sqrt(3)/2*nutF*nutF - Math.PI*d*d/4;` with F (width across flats of a heavy hex nut, ASME B18.2.2, F = 1.5d + 1/8 in): ¾ 1.250, ⅞ 1.4375, 1 1.625, 1⅛ 1.8125, 1¼ 2.000, 1½ 2.375, 1¾ 2.750, 2 3.125 in. Net bearing = hex area across flats − gross rod area (no plate washer).
- **Governing provision:** ACI 318-19 §17.6.3.2.2(a), N_p = 8A_brg f′c, φ = 0.70 (Condition B, Table 17.5.3); nut dimensions ASME B18.2.2.
- **Check case (default, (6) 1 in Gr 55, f′c 4,000):**
  - Before: A_brg = 0.9·1² = 0.900 in²; φN_p = 0.70·8·0.900·4,000 = 20,160 lb (governed φN_n; tension ratio 9,791/20,160 = 0.486).
  - After: F = 1.625; A_brg = 0.8660·1.625² − 0.7854·1² = 2.2869 − 0.7854 = 1.5015 in²; φN_p = 0.70·8·1.5015·4,000 = 33,632 lb; φN_n = min(φN_sa 34,073, 33,632) = 33,632 lb → ratio 0.291.
  - 1½ in: A_brg = 0.8660·2.375² − 0.7854·1.5² = 3.118 in² (was 2.025); φN_p 56,700 → 87,298 lb at f′c 5,000.
- **Effect:** every case: φN_p and φN_n (when pullout governed) change; the anchor tension and interaction ratios drop. No other value changes (diff paths checked: only Abrg, Np, Npn, phiNp, phiNn, tr, inter, tgov). Cable values identical.
- **How verified:** `node tests/engine/run.mjs lightpole` 14 passed (new pullout test); `node tests/lightpole-compare.mjs --a origin/main`: 13 cases, differences only in the pullout chain; cable values identical; 0 console errors.
- **Open item:** a plate washer (larger A_brg) is not an input; the bare nut is used.

## 2026-11-01 — PR #557: claude/lp-pr4-anchre (LP-4: anchor reinforcement default None and §17.5.2.1 check; engineer decision 2026-11-01)

### LP4-1. "Anchor reinforcement" default None for new projects (LP-R2)   [default change] [more conservative: breakout checked]
- **Where:** input card 7, `id="segAnchRe"` (the `on` class moves to None); state `let anchRe='no';` (was `'yes'`).
- **Saved data (§5):** `anchRe` has been written by `captureState()` in every version since the first commit (c58cb6d, 2026-10-03), so **every saved project has it stored explicitly**: projects that chose (or kept) Provided keep Provided and now get the reinforcement check below; projects with None are unchanged. `applyState()` keeps `anchRe = st.anchRe || 'yes'`, so a hand-made save without the field also keeps the old behaviour. Only new projects (DEFAULT_STATE, New, empty storage) start on None.
- **Effect on the default new project:** concrete breakout is now in φN_n (Condition B, φ 0.70): φN_cbg = 22,323 lb; φN_n = min(34,073, 33,632, 22,323/3) = 7,441 lb per anchor; T_max = 9,791 lb → anchor tension 1.32 **NG** (before: 0.29 with Provided). The group check of the anchors table (ΣT = 19,401 ≤ φN_cbg = 22,323, 0.87) passes; the tool's φN_n compares the most-loaded anchor with φN_cbg/n_T (pre-existing, conservative; not changed — open item).

### LP4-2. Anchor reinforcement checked when Provided (ACI 318-19 §17.5.2.1)   [new checks] [more conservative]
- **Where:** new inputs `arBars` (bars per tension anchor, default 2), `arBar` (default "shaft longitudinal bar", or #4–#11), `arX` (distance rod–bar, default 3 in), rows `.arRow` shown only when Provided (`lppApplyArUI()`); `INPUT_IDS` + the three; `applyState()` defaults when missing. `anchorBolts()`: new block `// ---- anchor reinforcement, ACI 318-19 §17.5.2.1`, return field `ar`; `inp.arShaftBar = reo.long.bar` before `anchorsAllCombos` (pole and sign). New `boltArRows(b)` in both anchor tables (the "carried by anchor reinforcement" row now reads "replaced by the anchor reinforcement (§17.5.2.1), checked below"). `collectChecks()`: three checks; `LPP_CHK2K`. `boltWorkedHTML()` step 3b.
- **Checks:**
  1. strength φN_ar = 0.75·A_s·f_y ≥ N_ua (most-loaded anchor, its governing combination), A_s = bars counted for that anchor;
  2. location x ≤ 0.5h_ef (R17.5.2.1);
  3. development above the breakout surface: l_avail = h_ef − x/1.5 − c ≥ l_d; l_d = max(f_y ψ_t ψ_e ψ_g/(25 or 20 · λ√f′c)·d_b, 12 in) (ACI 318-19 Table 25.4.2.3; 25 for #6 and smaller, 20 for #7 and larger; ψ_t = ψ_e = 1.0, ψ_g = 1.0 Gr 60 / 1.15 Gr 80, λ = 1.0); below the surface the shaft bars run the full depth (developed). No reduction for excess reinforcement.
- **φN_n unchanged** when Provided: min(φN_sa, φN_p) (breakout replaced by the anchor reinforcement, which is now checked separately).
- **Governing provision:** ACI 318-19 §17.5.2.1 and R17.5.2.1 (anchor reinforcement developed on both sides of the breakout surface, φ = 0.75), §25.4.2.3. Wording cited, not copied; verify (a)/(b) item numbering against the engineer's copy.
- **Check case (default geometry with Provided; (6) 1 in, h_ef 18 in, (12) #6 shaft bars, cover 3 in, f′c 4,000, f_y 60,000):**
  - φN_ar = 0.75·(2·0.44)·60,000 = 39,600 lb ≥ 9,791 lb → 0.25 OK.
  - x = 3 ≤ 0.5·18 = 9 → OK.
  - l_d = 60,000/(25·√4,000)·0.75 = 28.5 in; l_avail = 18 − 3/1.5 − 3 = 13.0 in → 2.19 **NG**.
- **Effect on saved projects with Provided (every old default project):** the three checks are added; with the old defaults the development check fails (as above) and the verdict changes from "ALL CHECKS PASS" to "1 CHECK FAIL — Anchor reinforcement, development". No existing value changes (verified with `--old-saves`: only the new `inp` fields and the new `ar` objects differ).
- **How verified:** `node tests/engine/run.mjs lightpole` 15 passed (new test). `node tests/lightpole-compare.mjs --a origin/main --old-saves`: every case identical except the new inputs and `ar` objects (+ the 3 new check rows); `node tests/lightpole-compare.mjs --a origin/main` (new projects): the cases that were on the old default change from "breakout carried" to breakout checked (Condition B); cable values identical in all 26 runs.
- **Open items:** (1) the per-anchor breakout comparison T_max ≤ φN_cbg/n_T (conservative; ACI compares the group tension with φN_cbg) now governs the default new project (1.32 vs group 0.87) — engineer to decide whether to compare the group; (2) hooked/headed anchor-reinforcement bars, and bars lapped with hooks, are not modelled (straight bars only); (3) the 0.5h_ef zone and the 1:1.5 cone geometry follow R17.5.2.1 and A_Nco; confirm.

## 2026-11-01 — PR #561: claude/lp-pr5-baseplate (LP-5: base plate by the AASHTO LRFDLTS bending-line method, double-nut; F_y and provided-thickness inputs; engineer decision 2026-11-01)

### LP5-1. Base-plate thickness (LP-R4)   [calc change] [more conservative] [new check]
- **Engineer decision (2026-11-01):** AASHTO LRFDLTS bending-line method with a double-nut (leveling-nut) base; plate F_y input; provided-thickness input and check; effective width at the pole face. This method is used in both modes until the LTS 2nd Ed. mode is added.
- **Where:** input card 7, new rows `bpFy` (default 36 ksi) and `bpT` (default 1.25 in) after `bpDia`; `INPUT_IDS`; `calc()` inputs; `anchorBolts()` block `// ---- base plate thickness: AASHTO LRFDLTS bending-line method`, new return fields `Cmax, Prod, tpProv, tpOK`; `anchorsAllCombos()` `byCheck.BP` (combination with the largest t_req); `collectChecks()` "Base plate thickness" (utilization (t_req/t)² = M_u/φM_n); `LPP_CHK2K`; Summary design row; `oBoltBp` (both modes); `boltWorkedHTML()` step 8 (the BP combination); `applyState()` defaults for old saves (F_y 36, t 1.25).
- **Before:**
  ```js
  const m=Math.max(0,(BC-Dpole)/2); const beff=Math.PI*BC/n; const Fyp=36;
  const tpReq=Math.sqrt(4*Tmax*m/(0.9*Fyp*1000*beff));
  ```
- **After:**
  ```js
  const m=Math.max(0,(BC-Dpole)/2); const beff=Math.PI*Dpole/n; const Fyp=inp.bpFy>0?inp.bpFy:36;
  const Cmax=Math.max(0,...bolts.map(b=>-Mu*b.y/sumY2 + Pu/n)); const Prod=Math.max(Tmax,Cmax);
  const tpReq=Math.sqrt(4*Prod*m/(0.9*Fyp*1000*beff));
  ```
  M_u = P_rod·m ≤ φ_f·F_y·b_eff·t²/4, φ_f = 0.90; check t_req ≤ t_provided.
- **Governing provision:** AASHTO LRFDLTS 2nd Ed., base plates of double-nut connections (bending line at the face of the tube, effective plate width at the bending line); the **article number and the exact effective-width expression are to be confirmed against the engineer's copy** (the review cited 1st Ed. Art. 5.6.6). b_eff = πD/n (the arc per rod at the pole face) is the review's proposal (LP-R4).
- **Check case (default: D 10 in, BC 16 in, (6) rods, F_y 36, 1.2D + 1.0W, M_u = 19,949 lb·ft, P_u = 1,088 lb):**
  - Before: b_eff = π·16/6 = 8.378 in, P = T_max = 9,791 lb, t_req = √(4·9,791·3/(0.9·36,000·8.378)) = **0.658 in**, no check.
  - After: b_eff = π·10/6 = 5.236 in; C_max = 19,949·12·8/192 + 1,088/6 = 9,974 + 181 = 10,155 lb (the tool: 10,154 at the moment azimuth); P_rod = 10,154 lb; t_req = √(4·10,154·3/(0.9·36,000·5.236)) = **0.847 in** ≤ 1.25 in → (0.847/1.25)² = 0.46 OK.
  - Other cases (t_req before → after): square HSS 8 in 0.962 → 1.381 (> 1.25 NG); rect 8×6 1.023 → 1.463 (NG); 60 ft pole 0.761 → 0.894; 1½ in rods 0.677 → 0.974; monopost sign (6 in post, BC 16) 1.182 → **1.943 (NG)**; two-post 1.266 → **2.075 (NG)**.
- **Saved data:** new fields `bpFy`, `bpT`; old saves open with F_y 36 ksi (the former fixed value) and t = 1.25 in. t_req changes for every project (method change, above) and the new check is added; nothing else changes (diff paths checked: only tpReq, beff, Fyp, Cmax, Prod, tpProv, tpOK and byCheck.BP).
- **How verified:** `node tests/engine/run.mjs lightpole` 16 passed (new base-plate test). `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: only the base-plate values above differ; cable values identical; 0 console errors.
- **Open items:** (1) confirm the LTS 2nd Ed. article and effective-width rule (πD/n vs a chord/45° rule); (2) for square/rect poles the same b_eff = πB/n is used (no flat-face bending line); (3) the anchor-rod standoff (rod bending, LP-R17) is not checked; (4) LTS minimum plate thickness rules (e.g. ≥ rod diameter) are not checked.

## 2026-11-01 — PR #564: claude/lp-pr6-ice (LP-6: ASCE 7-22 Ch. 10 design ice thickness by height; 0.9D + Di + Wi and 0.6D + 0.7Di + 0.7Wi; engineer decision 2026-11-01)

### LP6-1. Design ice thickness t_d(z) (LP-R8)   [calc change] [mixed: less ice below 33 ft, more above]
- **Engineer decision (2026-11-01):** the entered thickness is the ASCE 7 map value; apply the Chapter 10 height factor and the importance factor to get the design thickness per height. Cables: engineer decision of the same day — no change to anything cable-related, so the **cables keep the entered t** (reported).
- **Where:** input card 5: `tIce` note; new `iceBasis` (Map value → t_d(z) / Uniform design t_d) and `iceIi` (I_i, default 1.0, shown for Map) with notes `iceNote`, `iceMigNote`; `lppApplyIceUI()`; `INPUT_IDS`; `calc()` inputs. New `iceTd(inp,z)`, `iceFz(z)`, `iceWorkedHTML(inp,pw,fxs)` above `function poleWindNominal(`. `poleWindNominal()`: each strip uses t_d(z_i) for the iced width and ice weight (`strips[i].td`, `.Wi`), `WiceMast` = Σ strips (Map) or the former mean-diameter form (Uniform), new `iceAbove(z)`, `tdTop`; `poleStress()` uses `pw.WiceMast` / `pw.iceAbove(z)` (was `pw.wIceMast·H`, `·(H − z)`). `fixtureComponents()`: t_d at the mount height (`td`), used for the iced EPA and the ice weight; `fixtureWorkedHTML()` shows it. Worked step in the Loading tab (wind) and the report (pole wind section).
- **Before:** t used at every height for mast, fixtures and cables.
- **After (Map):** t_d(z) = t·f_z·K_zt^0.35·I_i, f_z = (z/33)^0.10 (0 < z ≤ 900 ft); mast per strip, fixtures at h_f; cables t (unchanged).
- **Governing provision:** ASCE 7-22 §10.4.6 (Eq. 10.4-4 f_z, Eq. 10.4-5 t_d). **Question for the engineer:** in ASCE 7-22 the ice maps are given per Risk Category and the 7-16 importance factor I_i (and the 2.0 factor of 7-16 Eq. 10.4-5) are not in Eq. 10.4-5 as I read it; the tool therefore offers I_i as an input with default 1.0 ("1.0 when t is read from the 7-22 map for the structure's Risk Category"). Confirm the form against your copy.
- **Saved data:** new fields `iceBasis`, `iceIi`. Saves without `iceBasis` open as **Uniform** (the old behaviour) with a notice → identical results (verified). New projects start on Map.
- **Check case (default pole, t = 0.5 in, K_zt 1.0, I_i 1.0):**
  - t_d(35 ft) = 0.5·(35/33)^0.10 = 0.5·1.00590 = **0.5030 in** (fixtures at 35 ft: W_ice 13.37 → 13.45 lb, iced EPA 1.818 → 1.819 ft²).
  - Mast ice: before 0.5 in uniform: π(4.5² − 4²)/144·56·35 = **181.7 lb**; after Σ strips with t_d(z) (f_z < 1 below 33 ft): **163.6 lb**.
  - Bearing (ASD D + 0.7Di, max axial): 1,116.5 → 1,104.0 lb; q 0.158 → 0.156 ksf. No other governing value changes in the default (wind governs).
  - Node test: t 0.75, z 35, K_zt 1.2: 0.75·1.00590·1.2^0.35 (1.06589) = 0.8041 in.

### LP6-2. Ice combinations 0.9D + 1.0Di + 1.0Wi (LRFD) and 0.6D + 0.7Di + 0.7Wi (ASD) (LP-R9)   [calc change] [more conservative or equal]
- **Where:** `COMBOS`: `L5`, `A5`; the combination selector (`comboSel`) options; wording "all ten combinations" (combination card hint, report caption, manual QA row).
- **Governing provision:** ASCE 7-22 §2.3.4 (LRFD, atmospheric ice: 0.9D + 1.0D_i + 1.0W_i) and §2.4.3 (ASD: 0.6D + 0.7D_i + 0.7W_i) — section numbers as in 7-16; verify the 7-22 numbering.
- **Effect:** every pole-mode envelope now includes them (signs carry no ice and skip all ice combinations, as before). Default pole: L5 M = 6,428 lb·ft, N = 1,098 lb; A5 M = 4,494 lb·ft, N = 741 lb — neither governs (L1/L4, A1). The cables carry their existing loads in the new combinations (the cable model is unchanged); every existing combination's cable values are identical (harness check, keyed by combination).
- **How verified:** `node tests/engine/run.mjs lightpole` 17 passed (new ice test: t_d, uniform = old mast ice, cable ice unchanged, L5/A5 factors). `node tests/lightpole-compare.mjs --a origin/main --old-saves`: every Summary/foundation/anchor/post value identical in all 13 cases (only the combination arrays gain L5/A5 and the new fields); new projects: ice values as above, governing results unchanged in all 13 cases except the bearing axial (D + 0.7Di). Cable values identical for L1–L4, A1–A4.
- **Open items:** the 7-22 form of t_d (I_i and the 2.0 factor; see above); V_ice concurrent-wind map and its height factor are unchanged; ice on sign panels (LP-R22) unchanged.

## 2026-11-01 — PR #570: claude/lp-pr7-torsion (LP-7: fixture torsion and arm wind in light-pole mode, LP-R5)

### LP7-1. Wind on the arms   [calc change] [more conservative]
- **Where:** fixture rows: new field `armD` (arm outside diameter, in; new rows 2.375 in; `fixTbl` column "Arm OD"); `renderFixtures()`, `addFix`; `applyState()` sets `armD = 0` on rows saved without it (no arm wind, the old behaviour) with notice `armMigNote`. `fixtureComponents()`: block `// ---- wind on the arm itself`, return fields `armDin, cfArm, armRow, armHD, armDsq, FarmMax, FarmMaxI`. `evalComboDir()` and `poleStress()` add the arm force for each azimuth.
- **Expressions:** round arm of OD D and length a, horizontal at h_f along θ; wind toward φ: F_arm = q_z(h_f)·K_d·G·C_f·D·a·|sin(θ − φ)| along the wind at the arm mid-length (iced: D + 2t_d, V_ice). C_f from ASCE 7-22 Fig. 29.4-1 (round): D√q_z > 2.5 → moderately smooth row, else the D√q_z ≤ 2.5 row; h/D = a/D.
- **Provision:** ASCE 7-22 §29.4 (Eq. 29.4-1), Fig. 29.4-1.

### LP7-2. Torsion from the fixture and arm wind   [calc change] [more conservative]
- **Where:** `evalComboDir()`: `Tz += F_w·(e_x·sin φ − e_y·cos φ) + ½F_arm·(e_x·sin φ − e_y·cos φ)`, returned `Tz, T` (|T| < 10⁻⁶ lb·ft → 0, the round-off of cancelling arms); `evalCombo()`: `Tmax` over the four directions; `lrfdCands` carry `T: r.Tmax`, so `anchorsAllCombos()` adds T/(n·R) to each bolt's shear (the existing sign-mode path); `poleStress()`: torsion above each section and AISC 360-16 §H3.2 (Eq. H3-6 when T_r > 0.2T_c, `hssTorsionShear`, as for the sign post), row field `tv`; new `lppShaftTorsion(inp,cands)` (the ACI 318-19 §22.7.1.1 threshold of `designFoundationStack`) in the pole Summary stack (`found.Tu, phiTth, Acp, pcp`) → the existing "Shaft torsion ≤ φT_th" check; worked in the Shaft tab (`lppTorsionHTML`) and the anchors table note; `fixtureWorkedHTML()` steps 5 (arm wind) and 6 (torsion); Manual §2.4 item; Summary warning wording (pole: "Torsion from the wind on offset fixtures and arms").
- **Expression:** T = Σ (F_w,i + ½F_arm,i)·a_i·sin(φ − θ_i) (plan cross product r × F). T at the max-torsion azimuth is combined with the max-moment azimuth for the anchors and the shaft (conservative).
- **Provision:** statics; AISC 360-16 §H3.1, §H3.2 (Eq. H3-6); ACI 318-19 §17.7 (bolt shear), §22.7.1.1 / Table 22.7.4.1(a).
- **Check case (Node test):** fixture at θ 0°, a 6 ft, EPA 1.6, arm OD 2.375 in, 1.2D + 1.0W, wind toward 90°: q₀ = 0.00256·1.0147·13,225 = 34.35 psf, D√q₀ = 0.198·5.86 = 1.16 ≤ 2.5, h/D = 6/0.198 = 30.3 → C_f 1.2; F_arm = 29.20·1.2·0.198·6 = 41.6 lb; T = (51.4 + ½·41.6)·6 = 433 lb·ft. Wind toward 0°: T = 0. Arms at 0° and 180°: T = 0.
- **Results (harness):**
  - Default pole, new project (two arms at 0°/180°, OD 2.375 in): no torsion (arms cancel); arm wind at 90°/270° raises the governing LRFD M_u 19,949 → 21,957 lb·ft, embedment 6.244 → 6.464 ft; anchor tension 9,791 → 9,656 lb at the new governing azimuth.
  - Old saves (no arm OD): default and symmetric cases identical; the "arms" case (fixtures at 45° and 200°) gets torsion from the fixture wind: T_u = 369 lb·ft vs φT_th 36,212 lb·ft; bolt shear 134 → 226 lb.
  - One 10 ft arm at 90° (OD 3.5 in, no cables): embedment 5.17 → 5.45 ft, T_u = 1,427 lb·ft.
  - Signs: identical. Cable values identical in every case.
- **How verified:** `node tests/engine/run.mjs lightpole` 18 passed (new arm/torsion test); `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves` (14 cases incl. the new "torsion" case): differences as listed; diff paths filtered.
- **Open items:** the arm dead load is not separate (part of the fixture weight); arms are taken horizontal at h_f; the arm wind uses the projected area with the force along the wind (the normal-component form of §29.4 for inclined members is not used).

## 2026-11-01 — PR #573: claude/lp-pr8-vc (LP-8: shaft V_c per ACI 318-19 Table 22.5.5.1 with the A_v,min / size-effect branch, LP-R11)

### LP8-1. Concrete shear strength of the shaft   [calc change] [more conservative]
- **Where:** `designRebar()`, block `// ---- concrete shear strength, ACI 318-19 §22.5.5.1` (replaces `// shear capacity of concrete (circular)` through the tie-spacing selection); tie result fields `VcA, VcB, lamS, rhoW, AsT, Av, avMinPerS, sAvMin, sTrial, vcBranch`; `rebarWorkedHTML()` step 4 (A_v,min, both branches, φV_c with the branch used, s for A_v,min).
- **Before:**
  ```js
  const Acv=0.8*Ag; const Vc=2*Math.sqrt(fc)*Acv; const phiVc=0.75*Vc;
  ```
  always (branch (a)), also when the ties are below A_v,min.
- **After:** with the ties as detailed (A_v = 2 legs, s = the §25.7.2.1 spacing or the manual s): A_v ≥ A_v,min = max(0.75√f′c, 50)·b_w·s/f_yt → V_c = 2λ√f′c·A_cv (a); otherwise V_c = min(8λ_s·λ·ρ_w^(1/3)·√f′c, 5λ√f′c)·A_cv (c, §22.5.5.1.1 cap), λ_s = √(2/(1 + d/10)) ≤ 1, d = 0.8b, ρ_w = (A_s/2)/(b_w·d) (bars of the tension half). Where V_u > ½φV_c the ties are designed for shear and must give A_v ≥ A_v,min (§10.6.2.1), so branch (a) applies and the spacing is also limited to s ≤ A_v/(A_v,min/s). A_cv = 0.8A_g (the tool's b_w·d) and the neglected N_u/6A_g term are unchanged.
- **Governing provision:** ACI 318-19 §22.5.5.1 (Table 22.5.5.1 (a) and (c)), §22.5.5.1.1, §22.5.5.1.3 (λ_s), §22.5.2.2 (circular sections), §10.6.2.1 / §10.6.2.2 and Table 9.6.3.4 (A_v,min).
- **Check case (default: 3 ft shaft, (12) #6, #3 ties @ 12 in, f′c 4,000, f_y 60,000):**
  - A_v = 2·0.11 = 0.22 in² < A_v,min = 50·36·12/60,000 = 0.36 in² → branch (c).
  - d = 0.8·36 = 28.8 in; λ_s = √(2/3.88) = 0.718; ρ_w = 2.64/(36·28.8) = 0.00255, ρ_w^(1/3) = 0.1366; A_cv = 0.8·1,017.9 = 814.3 in².
  - V_c = 8·0.718·0.1366·63.25·814.3 = 40,393 lb; φV_c = **30,295 lb** (before: 0.75·2·63.25·814.3 = **77,251 lb**). V_u = 877 lb ≤ ½φV_c → minimum ties, spacing unchanged.
  - Other cases: square shaft 98,359 → 44,117; 60 ft pole (3.5 ft, (16) bars) 105,148 → 38,632; two-post sign 98,359 → 42,455 lb. No case changes its tie spacing or verdict.
- **How verified:** `node tests/engine/run.mjs lightpole` 19 passed (new V_c test). `node tests/lightpole-compare.mjs --a origin/main`: 14 cases, only φV_c / V_c and the new tie fields differ (13 values per stack; diff paths filtered); cable values identical. No saved data change.
- **Open items:** ρ_w uses half the longitudinal bars (conservative; the code does not define A_s for a circular section); A_cv = 0.8A_g kept (vs D·0.8D = 1.02A_g); the axial term N_u/6A_g is neglected.

## 2026-11-01 — PR #578: claude/lp-pr9-natgf (LP-9: n₁ and G_f worked steps; display only)

### LP9-1. Natural frequency n₁ and gust-effect factor G_f worked (CLAUDE.md §6; D11 open item)   [display] [no result change]
- **Where:** `poleNatFreq()` also returns `sWy, sWy2, rows` (the Rayleigh sums and each weight's height, weight and deflection; values unchanged); `lppApplyGf()` keeps `inp.nat`, `inp.gfDims`; new `natGfWorkedHTML(inp)` above `function hssTorsionShear(`; shown in `windWorkedHTML()` (pole, Loading tab), `signWindWorkedHTML()` (sign, Loading tab and the sign report) and the pole report's pole-wind section.
- **Steps:** table of z_i, W_i, y_i, W_i·y_i, W_i·y_i²; n₁ = (1/2π)·√(g·ΣWy/ΣWy²) with the numbers; rigid/flexible; when flexible, z̄, I_z̄, L_z̄, Q², V̄_z̄, N₁, R_n, R_h, R_B, R_L, R², g_R and G_f (ASCE 7-22 Eq. 26.11-7 … 26.11-16) with the numbers, then G used = max(G, G_f).
- **Check case (60 ft pole case):** ΣW·y = 7,213.94, ΣW·y² = 61,110.99 → n₁ = √(386.1·7,213.94/61,110.99)/(2π) = 6.751/6.283 = **1.0745 Hz** (rigid; the tool's value).
- **How verified:** `node tests/engine/run.mjs lightpole` 20 passed (worked-step test, flexible case with n₁ = 0.82 Hz: G_f shown, no NaN). `node tests/lightpole-compare.mjs --a origin/main`: results identical apart from the added fields (`sWy`, `sWy2`, `rows`, `inp.nat`, `inp.gfDims`); cable values identical; text adds the worked steps (Loading tab, report); 0 console errors.

## 2026-11-01 — PR #582: claude/lp-pr10-json (LP-10: JSON export / import of the project; no result change)

### LP10-1. Export JSON / Import JSON   [feature] [no result change] [no storage change]
- **Where:** project bar: buttons `pbExport`, `pbImport`, hidden `pbImportFile`; new `lppExportJSON()`, `lppImportState(obj)` and handlers above `const DEFAULT_STATE=captureState();`.
- **File format (new, versioned):** `{ tool:'Light Pole and Sign Post', format:'lpp-project', version:1, name, exported, state }`, where `state` is exactly `captureState()` — the same object already stored under `lpp_projects_v1` / `lpp_session_v1`. No localStorage key or saved format is changed (§5).
- **Import:** accepts that file or a bare state object (`{inputs, …}`); opens it through `applyState()`, so every migration for fields added later applies (old files open with the old behaviour and the usual notices); the result is an unsaved working state ("Save As" stores it in the browser). A file without `inputs` is refused with a message. Unsaved changes ask for confirmation first.
- **Saved-project list:** the tool already has one (the Project dropdown with Save / Save As / Rename / Delete / New); unchanged.
- **How verified (headless Chromium, scratchpad lpjson.mjs):** two-post sign at V 133 exported → New → imported: the Summary text is identical and V = 133; a bare old-format state (no cfPoleMode / anchTq / arm OD …) imports with C_f Manual and anchor reinforcement Provided as stored; a file without `inputs` gives "Import failed: not a Light Pole and Sign Post project file"; localStorage holds only `lpp_session_v1` after the run; no console errors; 390 px: buttons wrap, no horizontal scroll. Calculations untouched (no engine code changed); `node tests/engine/run.mjs lightpole` 20 passed.

## 2026-11-01 — PR #593: claude/lp-pr11-report (LP-11: Report tab in the shared viewer; the D11 calculation sheet kept as "Calc sheet"; display only)

### LP11-1. Report tab (shared/report.js + shared/steps.js)   [display] [no result change]
- **Coordinator rules applied (scratchpad/report_plan.md):** model builder `lprModel()` whose step values are the tool's own computed numbers (LPP_SUMCTX from `renderSummary`, `LPP_LAST` from `buildReport` / `buildSignReport`; nothing recomputed); steps grouped by topic (`SharedSteps.group`, `lprTopics`); nav tree to topic level; [[tab:…]] links back to the tabs; print with title block (no owner cell, "—" for the fields the tool does not have; no new saved fields), running header, page numbers. KaTeX 0.16.9 (already loaded). Old D11 report kept (engineer decision 2026-11-01: retired later).
- **Where:**
  - `<head>`: `<script src="shared/steps.js">`, `<script src="shared/report.js">`.
  - Tabs: `Report` (data-tab `report`, host `#lprHost` in a new card) is the shared viewer; the former Report card is now the `Calc sheet` tab (data-tab `calcsheet`, page `#page-calcsheet`; content, D11 links, "Print / PDF report" button and its print CSS unchanged — the print rule now targets `#page-calcsheet`). `LPP_TABNAME` + report / calcsheet.
  - New block `// ================= REPORT TAB (shared viewer, LPRP` before the project-management section: `LPP_LAST`, `LPRP`, `lprModel()`, `lprRender()`, `lprGoto()`, `lprActive()`, `lprRefresh()`.
  - `switchTab()`: renders the report when the Report tab is shown; `lppReportDoc()` ends with `lprRefresh()` (rebuilt after every calc while shown).
  - `beforeprint`: Report tab shown → the shared report prints alone (`#rp-print`, `body.rp-printing`); any other tab → the D11 calculation sheet as before.
  - `shared/README.md`: Light Pole added to the steps.js and report.js "Loaded by" rows (no shared file changed).
- **Sections:** 1 Project and scope · 2 Design summary (every check of every stack, sorted by D/C) · 3 Wind and ice (velocity pressure, C_f Fig. 29.4-1, mast wind, t_d, fixtures/arms table or sign panel wind with Cases A/C, n₁ and G_f) · 4 Load combinations (pole: every combination; sign: per post) · 5 Pole/post check (section, φM_n, φP_n, B₂·M, torsion, interaction) · 6 Base plate (bending-line steps) — anchors only listed in §2 with a link to the Anchors tab (engineer, 2026-11-01: no new anchor presentation) · 7 Drilled shaft (IBC embedment + iteration table, P–M, V_c branch, ties, bearing, torsion threshold, Broms reference) · 8 Assumptions and references.
- **How verified (headless Chromium, KaTeX local):** default pole, two-post sign, torsion case, 60 ft pole at 1280 and 390 px: 0 unresolved references, 0 duplicate keys, 0 `.katex-error`, no NaN/undefined/Infinity in `SharedReport.text`, 0 console errors, no horizontal scroll; print PDF (11 pages, default) inspected. 18 report values spot-checked equal to the app's (d, M_u, φM_n, φV_c, V_u, q, A_base, A_s, P, h, post ratio, φM_n post, φP_n, n₁, t_req, b_eff, P_rod, C_f), pole and monopost. `node tests/lightpole-compare.mjs --a origin/main`: results and cable values identical in all 14 cases; the old Report text moved unchanged to the Calc sheet tab (line counts equal). Screenshots and PDFs: scratchpad/shots-lp/pr11-*.
- **Open items:** Project No. / Computed by / Checked by / dates are not inputs (shown "—"); retire the D11 Calc sheet once the engineer accepts this report.

## 2026-11-01 — PR #597: claude/lp-pr12-drawings (LP-12: Drawings tab with DXF via shared/dxf.js; Geometry elevation to scale; display only)

### LP12-1. Drawings tab and DXF export   [display] [no result change]
- **Where:** `<head>`: `<script src="shared/dxf.js">`; tab `Drawings` (data-tab `drawings`, card host `#lpdHost`); `switchTab()` renders it when shown; `lppReportDoc()` re-renders it after each calc while shown; new block `// ================= DRAWINGS (LPDW` (before the project-management section): `LPDW_SCALES`, `LPDW`, `lpdLayers`, `lpdShaft`, `lpdElevation`, `lpdPlan`, `lpdSection`, `lpdPlate`, `lpdBuild`, `lpdSheetSVG`, `lpdRender`, `lpdActive`, `lpdElevGeometry`; CSS `.lpdBar`, `.lpdHead`, `.lpdBox`; `LPP_TABNAME` + drawings; `shared/README.md` dxf.js "Loaded by" row (no shared file changed).
- **Sheets (B-size 17 × 11 in, border and title block without owner cell, smallest standard scale that fits; one DXF R12 file, model space full size in inches, `SharedDxf.validate` before download):** 1 pole or sign elevation (to scale: tapered pole / posts, base plate, arms and fixtures projected on x–z, cable attachments, sign panel, shaft(s) with the designed embedment, bars and ties; dimensions H, d, b, clearance, L_p); 2 plan (shaft, plate, pole, rods, arms and fixtures at θ, cable directions, axes); 3 shaft section (bars at their radius, tie, cover; one per distinct shaft); 4 base plate (plate, pole, bolt circle and holes, thickness / F_y / t_req); 5 general notes. Per-browser UI key `lpp_dwgSheet_v1` (chosen sheet only).
- **Anchors:** the plate sheet shows the rods as plate geometry only (engineer, 2026-11-01: no new anchor presentation; the anchor design may move to BasePlateAnchorDesigner).
- **Cables:** drawn for information only (attachment height and direction), no cable value changes.

### LP12-2. Geometry tab elevation to scale (review §5: "the shaft width is clamped to 60–120 px")   [display]
- **Where:** `drawElev()` first calls `lpdElevGeometry()` (the elevation view of the drawing set, as SVG, to scale); the former schematic is kept as the fallback when shared/dxf.js is not loaded.

### Verification
- Headless Chromium, default pole / two-post sign / one-arm torsion case: 5 sheets each, `SharedDxf.validate` ok, no NaN/undefined in the DXF, 0 console errors, 390 px without horizontal scroll; every sheet screenshot inspected (scratchpad/shots-lp/pr12-*).
- `node tests/lightpole-compare.mjs --a origin/main`: results and cable values identical in all 14 cases; the only differences are the Geometry elevation SVG and the new Drawings tab.

## 2026-11-01 — PR #601: claude/lp-pr13-layout (LP-13: masthead at 390 px, wide equations at 1280 px; display only)

### LP13-1. Masthead code tag at narrow widths (review §5)   [UI]
- **Where:** CSS after the `@media(max-width:900px)` block: `@media(max-width:600px){.masthead .codetag{position:static;text-align:left;margin-top:8px}.masthead .codetag b{display:inline;margin-right:6px}}`.
- **Before:** the absolutely positioned `.codetag` overlapped the eyebrow and the title at 390 px. **After:** it flows below the subtitle (no overlap, measured).

### LP13-2. Wide worked equations no longer widen the page at desktop widths   [UI]
- **Where:** `.katex{position:relative}` and `@media screen{.tabpage .katex-display{overflow-x:auto;overflow-y:hidden;max-width:100%}}` (the same rule the tool already applied below 900 px; screen only, so printing is unchanged).
- **Before (origin/main, 1280 px):** page width 1528 px on Loading, 1303 px on Anchors, 1319 px on Calc sheet (long display equations). **After:** 1280 px on every tab; 390 px unchanged (390).
- **How verified:** headless Chromium, every output tab at 1280 and 390 px (scratchpad lplayout.mjs; screenshots shots-lp/pr13-*); `node tests/lightpole-compare.mjs --a origin/main`: all 14 cases identical (results, cable values, text, drawings); 0 console errors.

## 2026-11-01 — PR #602: claude/lp-pr14-breakout (LP-14: concrete breakout in the ACI 318-19 group form; engineer answer 2026-11-01)

### LP14-1. Tension breakout: ΣN_ua of the tension anchors ≤ φN_cbg   [calc change] [less conservative = the code form]
- **Engineer answer (2026-11-01, open question of LP-4):** use the group form with ψ_ec,N for eccentricity instead of T_max·n_T.
- **Where:** `anchorBolts()`, block above `const tr=`; return fields `trAnc, trBrk`; `collectChecks()`: "Anchor tension" (steel / pullout, the combination with the largest per-anchor ratio) and new "Anchor breakout (group)" (ΣN_ua vs φN_cbg, the combination with the largest group ratio; anchor reinforcement None only); `LPP_CHK2K`; `boltWorkedHTML()` step 7.
- **Before:**
  ```js
  phiNn=Math.min(phiNsa, phiNp, phiNcbg/nT);  const tr=Tmax/phiNn;
  ```
- **After:**
  ```js
  phiNn=Math.min(phiNsa, phiNp);  const trBrk = hasAnchRe ? 0 : Tsum/phiNcbg;
  const trAnc=Tmax/phiNn, tr=Math.max(trAnc, trBrk);
  ```
  N_cbg already carries ψ_ec,N (eccentricity of the tension resultant from the tension-anchor centroid) and A_Nc of the tension anchors only (F6). The §17.8 interaction uses the governing tension ratio tr.
- **Governing provision:** ACI 318-19 §17.6.2.1 (group: N_cbg for the anchors in tension, compared with the factored tension of the group, §17.5.1.1 / Table 17.5.2), §17.6.2.3 (ψ_ec,N), §17.8.
- **Check case (the engineer's: default pole before the arm wind of LP-7, M_u 19,949 lb·ft, 1.2D + 1.0W, wind toward 0°):** ΣT = 19,401 lb, φN_cbg = 22,323 lb → **0.87** (Node test at exactly 0°: 19,405 / 22,408 = 0.866). Before: T_max / (φN_cbg/n_T) = 9,791 / (22,323/3) = 1.32.
- **Current default (with arm wind, governing combination at the max-moment azimuth):** ΣT = 19,130, φN_cbg = 19,641 → **0.974** OK (before 1.475 NG). Other cases (tension ratio before → after): square shaft 2.257 → 1.493; 1½ in rods 0.843 → 0.515; torsion case 0.870 → 0.573; monopost 2.539 → 1.688 (interaction 2.812 → 1.961); two-post 2.912 → 1.938.
- **How verified:** `node tests/engine/run.mjs lightpole` 22 passed (2 new tests); `node tests/lightpole-compare.mjs --a origin/main`: only the anchor tension chain changes (phiNn, tr, trAnc, trBrk, tgov, inter, interOK and the check rows); cable values identical; 0 console errors.

## 2026-11-01 — PR #604: claude/lp-pr15-bpnote (LP-15: base-plate "verify method" note; display only; engineer answer 2026-11-01)

### LP15-1. Base-plate verification note   [display] [no result change]
- **Engineer answer (2026-11-01):** keep b_eff = πD/n; add a clear on-screen and report note "verify method / article (LRFDLTS 2nd Ed.)" on the base-plate check, listing the unverified items.
- **Where:** new constant `LPP_BP_VERIFY` (above `function lppOffAxisFixtures(`); shown in the Summary "not checked" box (every stack with anchors), in `boltWorkedHTML()` step 8 (Anchors tab and the Calc sheet, as a highlighted box), and in the shared Report (base-plate note, warn; Assumptions).
- **Text:** "VERIFY the base-plate method against AASHTO LRFDLTS 2nd Ed. — not yet verified: (1) the governing article number; (2) the effective-width rule (b_eff = πD/n at the pole face is used; for square/rectangular poles the same πB/n is used, no flat-face rule); (3) anchor-rod bending in the double-nut standoff is not checked; (4) the minimum plate thickness rules of LRFDLTS are not checked."
- **How verified:** `node tests/lightpole-compare.mjs --a origin/main`: results and cable values identical in all 14 cases; text adds the note (Summary, Anchors, Calc sheet). Report: 0 unresolved references, 0 KaTeX errors, no NaN, 0 console errors (default pole, two-post sign, torsion, 60 ft pole at 1280 / 390 px).

## 2026-11-01 — PR #605: claude/lp-pr16-signice (LP-16: atmospheric ice on sign panels and posts; engineer answer 2026-11-01)

### LP16-1. Ice on signs (LP-R22)   [calc change] [more conservative or equal]
- **Engineer answer (2026-11-01):** add ice to sign panels: t_d on the panel, ice weight and wind on the iced panel in the ice combinations.
- **Where:** `signWind()`: block `// ---- atmospheric ice on the sign`, new fields `tdP, qhI, AsI, F_Ai, iceScale, WiPanel, FpostI, MpostI, tdPost, WiPost`, `caseC.FI`, `postStrips[i].FI`; `evalSignComboDir()`: case forces `FI`, `Fp = f.W·share(F) + f.Wi·share(F_i)`, post drag `+ f.Wi·F_post,i`, axial `+ f.Di·(W_i,panel/n + W_i,post)`; `calcSign()`: every combination applies (`SIGN_COMBO_KEYS=COMBO_KEYS.slice()`, was the non-ice ones only); `signPostStress()`: panel ice in N and P_story, post ice above the section, iced post drag strips; ice input card shown in sign mode; sign wind worked step "Ice on the sign"; load-path note and governing-demand step (ice combination); wording in the combination card / report and Manual §2.6.
- **Expressions:** t_d per §10.4.6 at the panel centroid (panel) and at h/2 (post); panel ice volume = 0.8·A_s·t_d (§10.4.1, flat vertical plate: one side × t_d × 0.8 — as read; verify the factor and whether both faces apply); wind on ice (§10.5): (B + 2t_d)(s + 2t_d), same C_f, q_h at V_ice with the sign K_d and G; Cases B and C keep their eccentricity, scaled by F_A,i/F_A; posts: radial ice on the whole post (weight) and iced width D + 2t_d for the exposed drag at V_ice.
- **Governing provision:** ASCE 7-22 §10.4.1 (ice on flat plates and cylinders), §10.4.6 (t_d), §10.5 (wind on ice-covered structures), §2.3.4 / §2.4.3 (combinations).
- **Check case (default monopost: panel 12 × 6 ft, clearance 10 ft, post Ø6 in, t = 0.5 in map, V_ice 50 mph):**
  - t_d(13 ft) = 0.5·(13/33)^0.1 = 0.4555 in; W_i,panel = 56·0.8·72·0.4555/12 = **122.4 lb**.
  - Post: t_d(8 ft) = 0.4342 in; W_i,post = 56·π[(3.4342)² − 3²]/144·16 = **54.6 lb**.
  - Bearing (max-axial ASD): before D + 0.6W, N = 586.4 lb, q = 0.083 ksf; after D + 0.7Di + 0.7Wi, N = 586.4 + 0.7·(122.4 + 54.6) = **710.3 lb**, q = 0.100 ksf.
  - Wind on ice (50 mph) is well below the bare wind: embedment, M_u, post check, anchors and the plate are unchanged (wind governs).
  - Two-post default: bearing N 374.8 → 457.8 lb per post (D + 0.7Di + 0.7Wi); all other governing values unchanged. B₂ range now includes the ice combinations (1.000–1.016).
- **Old saves:** signs saved before this change get the ice too (engineer-directed; their stored t and basis are used: "Uniform" for saves without `iceBasis`). Default monopost / two-post as old saves: same governing values as above.
- **How verified:** `node tests/engine/run.mjs lightpole` 23 passed (new sign-ice test); `node tests/lightpole-compare.mjs --a origin/main` (and `--old-saves` for the sign cases): pole cases identical (results and cable values); sign cases change only in the ice-combination rows, bearing and the B₂ range (diff paths filtered); 0 console errors.
- **Open items:** confirm the flat-plate ice factor (0.8, one side) and whether both faces should be iced; the cable C_f row of the ice card shows in sign mode (unused there).

## 2026-11-01 — PR #610: claude/lp-anchor-export (LPA-1: anchorGroup hand-off to the Anchorage app, HANDOFF.md §4.11; no result change)

### LPA1-1. "Send anchors to the Anchorage app" + JSON file fallback   [feature] [no result change]
- **Engineer direction (2026-11-01):** the anchorage is designed in BasePlateAnchorDesigner; this tool sends the anchor groups.
- **Where:** the BridgeXfer v1 helper (HANDOFF.md §5, verbatim) in its own `<script>` before the tool's script; Anchors tab: new card `#lpAnchCard` (both modes) with `lpAnchSend`, `lpAnchExport`, a link to `BasePlateAnchorDesigner.html`, status `lpAnchStatus`; new block `// ================= ANCHORAGE APP HAND-OFF` (`LPP_ANCH`, `lppHash`, `lppAnchorPayload`, `lppAnchorStatus`, button handlers) before the project-management section; `calc()` (pole) stores `b2Dir` (B₂ of every combination and direction from the pole-stress runs) and `LPP_ANCH`; `calcSign()` stores `LPP_ANCH` per post and `postDesigns[i].lrfdB2` (the B₂ of each LRFD combination for that post); HANDOFF.md §4.11 sender paragraph.
- **Payload (bridge-anchor-group v1):** units in / lb / lb-ft / psi; `basis {factored:true, method:'LRFD', combos, B2}`; `signConvention:'lightPole-v1'`; `inputsHash` = FNV-1a (8 hex) of {groups, units, signConvention}; one group per post (pole: one): anchor {circle, n, BC, θ₀, d, grade f1554_<gr>, heavyHex, h_ef, torqued}, base {doubleNut, standoffClear 0 (not a Light Pole input; note), plate {circle, D, t, F_y}, pole {shape, D}}, pier {circle/square, D = b, f′c, cracked, depth = d, cover, bars, ties}, combos = every LRFD combination (ice ones included) at wind toward 0°, 90°, 180°, 270°: P (compression +), V_x, V_y, M_x = B₂·M_x, M_y = B₂·M_y, T (pole: T_z signed, CCW +; sign: |F·x|); lpRef {T_max, φN_n, interaction}. Values are the tool's own (no recomputation).
- **Saved data:** none (no stored field; the hand-off keys are `bridgeSuite.v1.anchorGroup` and `.updatedAt`, written on click only).
- **How verified:** `node tests/smoke/lightpole-anchor-handoff.mjs` (new): default pole, two-post and monopost signs — LP publishes, the JSON file equals the published payload, BasePlateAnchorDesigner's `check()` accepts it, "Pull from Light Pole" → Import imports every group with every combination (20 per group), BP's combination 1 equals the LP numbers converted by the lightPole-v1 rule (P = −P, M_y = M_x, M_x = −M_y, kip / kip-in) exactly, n / BC / plate t / pier arrive, BP's result payload has a finite governing D/C per group and echoes the inputsHash (pole 0.86 concrete breakout; two-post 1.34 base plate bending; monopost 1.66 T–V interaction), no page errors. `node tests/lightpole-compare.mjs --a origin/main`: results and cable values identical in all 14 cases (only the added `lrfdB2` field on sign posts); text adds the card.
- **Other copies of the BridgeXfer helper:** ACI Rebar Development Length, ASCE7-16 Load Generator, BasePlateAnchorDesigner, Bridge Geometry, Bridge Substructure Loading, Concrete Beam Capacity, Gusset Plate Rating, Moving Load Generator, Pile Designer, Prestressed Bridge Design, Retaining Wall Designer, Section Property Calculator, Shear and Moment Diagrams, Spread Footing, Steel Beam Design - AISC 15th, Steel Bridge Design, Stone Masonry Arch Load Rating, Timber Beam Check, abutment_calculator, elastomeric_design_module, index, lldf (+ this tool).

## 2026-11-01 — PR #612: claude/lp-anchor-result (LPA-2: Anchorage-app result chip, anchorGroupResult HANDOFF.md §4.12; display only)

### LPA2-1. Governing anchor D/C from the Anchorage app   [display] [no result change]
- **Where:** block `// ---- anchorGroupResult` (above `function lppAnchorStatus(`): `lppAnchorResult()`, `lppAnchorChip(groupId)`, `lppAnchorChipHTML()`, `lppAnchorCardRefresh()`, "Import result (JSON)" (`lpAnchImportRes`, `lpAnchResFile`; session only), `storage` / `focus` listeners; Summary design table row "Anchors — Anchorage app" (per stack: pole, or post 1 / post 2); Anchors-tab card `#lpAnchResult`; `lppReportDoc()` refreshes the card after each calc; HANDOFF.md §4.12 receiver paragraph.
- **Behaviour:** reads `bridgeSuite.v1.anchorGroupResult` (`bridge-anchor-group-result` v ≤ 1) live, or a result file imported this session; per group: "Anchors (Anchorage app, <date>): D/C … — <mode>, <combo>" (green ≤ 1, red > 1), "STALE" (amber) when the result's `source.inputsHash` differs from the hash of what this tool would send now, "not yet checked" without a result. Nothing is adopted or saved; no input changes.
- **How verified:** `tests/smoke/lightpole-anchor-handoff.mjs` (extended): pole, two-post, monopost — chips "none" before, "ok" after BP publishes its result (pole D/C 0.86 concrete breakout; two-post 1.34 base plate bending; monopost 1.66 T–V interaction), "stale" after V + 5 mph; Summary chips "ok"; no page errors. `node tests/lightpole-compare.mjs --a origin/main`: results and cable values identical in all 14 cases; text adds the Summary row (also in the Calc sheet's summary).

## 2026-11-01 — PR #616: claude/lp-anchor-retire (LPA-3: anchor checks retired from this tool, Anchorage tab)

### LPA3-1. Anchor rod checks removed from the UI, verdicts and report; base plate kept   [display] [no computed value changes; the verdict list changes]
- **Engineer direction (2026-11-01, via the coordinator):** remove the anchor design checks / tab from Light Pole's UI, summary verdicts and report; keep every anchor input and saved field (they feed the export and the base-plate check), keep the base-plate check, keep old saves loading; replace with an "Anchorage" card (export button, returned D/C chip, note that anchor design is done in the Anchorage app).
- **Engine untouched:** `anchorBolts()` and every stored result still run (the rod forces feed the base plate and the `bridgeSuite.v1.anchorGroup` payload). No input, no saved field, no storage key, no JSON export field changed.
- **Where / before → after:**
  - Output tab button `data-tab="anchors"`: label "Anchors" → "Anchorage" (data-tab unchanged); `LPP_TABNAME.anchors` → 'Anchorage'.
  - Card `#lpAnchCard`: title "Anchorage app" → "Anchorage", hint "anchor design in the Anchorage app · HANDOFF.md §4.11 / §4.12"; new note paragraph (anchor design is done in the Anchorage app; this tool no longer checks the anchor rods; the inputs are kept and sent).
  - Pole card 9 "Anchor bolt design" → "Base plate": removed `oBoltGrp`, `oBoltT`, `oBoltV`, `boltDraw` (bolt-group plan), `boltTbl` (limit-state table), `oBoltInt`; kept `oBoltBp` and `boltExample`. Same for the sign per-post detail card (`boltDraw_spN`, `boltTbl_spN`, … removed). `calc()` / `populateDetailStack()`: only `oBoltBp` is set and `renderBoltExample()` called (`drawBoltGroup()` no longer called).
  - New `basePlateWorkedHTML(bo,inp)` = step 8 of `boltWorkedHTML()` verbatim (bending line, `LPP_BP_VERIFY` box, PASS/FAIL line). `renderBoltExample()`: `box.innerHTML=boltWorkedHTML(bo,inp)` → `box.innerHTML=basePlateWorkedHTML(bo,inp)`. `boltWorkedHTML()` is kept, no longer shown.
  - `collectChecks()`: before
    ```js
    push('Anchor tension',…); if(!b.hasAnchRe){ push('Anchor breakout (group)',…); } push('Anchor shear',…); push('Anchor T–V interaction',…);
    { /* base plate */ push('Base plate thickness',…) }
    if(b.ar){ push('Anchor reinforcement, tension',…); push('Anchor reinforcement, development',…); push('Anchor reinforcement within 0.5h_ef',…); }
    if(!b.splitW && b.n>=2){ push('Anchor min. spacing',…); } if(!b.splitW){ push('Anchor min. edge distance',…); }
    ```
    after: only the base-plate block (`push('Base plate thickness','AASHTO LRFDLTS bending line',bP.tpReq,bP.tpProv,'in',bP.tpOK,Math.pow(bP.tpReq/bP.tpProv,2))`, unchanged).
  - `summaryHTML()`: removed the warning "Anchor concrete breakout in shear (ACI 318-19 §17.7.2) is NOT CHECKED [; side-face blowout (§17.6.4) applies … NOT CHECKED] — verify separately."; removed row "Anchor installation"; row "Anchor bolts" now ends "— designed in the Anchorage app" with a link to the Anchorage card (new link key `anchorage` → `lpAnchCard`, not post-suffixed); "Shaft & anchors — LRFD" → "Shaft & base plate — LRFD"; B₂ note "(pole/post, anchors, shaft)" → "(pole/post, base plate, shaft) and the anchor export". The "Anchors — Anchorage app" chip row (#612) and the "Base plate" row stay.
  - `calc()` governing-combination flag: "; anchors: tension …, shear …, interaction …" → "; base plate <combo>".
  - `LPP_K2TGT`: anchors → ['anchors','boltExample','Base plate']; torsion (was the bolt table) → ['shaft','rebarExample','Shaft structural check'] (where the φT_th step is worked).
  - Calc sheet (`buildSignReport` and the pole report): "Anchor bolts [ASTM F1554 / ACI 318-19 Ch. 17]" + `boltWorkedHTML` → "Base plate [AASHTO LRFDLTS bending line]" + a line naming the rods and the Anchorage app + `basePlateWorkedHTML`; pole section title "Base plate (anchor rods: Anchorage app)".
  - Report (`lprModel`): section "Base plate and anchors" → "Base plate"; its anchor note now points to the Anchorage tab / app; Assumptions: "Anchor shear breakout (§17.7.2) and side-face blowout (§17.6.4) are not checked; …" → "Anchor rods (ACI 318-19 Ch. 17) are not checked in this tool; they are designed in the Anchorage app. …"; intro tab list "Anchors" → "Anchorage".
  - Drawings (`lpdBuild`) general notes: "ACI 318-19 (SHAFT, ANCHORS)" → "ACI 318-19 (SHAFT)"; "THE SOIL TORSIONAL RESISTANCE, ANCHOR SHEAR BREAKOUT AND SIDE-FACE BLOWOUT ARE NOT CHECKED BY THE TOOL." → "ANCHOR RODS (ACI 318-19 CH. 17) ARE DESIGNED IN THE ANCHORAGE APP. THE SOIL TORSIONAL RESISTANCE IS NOT CHECKED BY THE TOOL." (the base-plate sheet still shows the rods).
  - Manual §3.5 "Anchors tab" → "Anchorage tab" (short description); §4C.3 gets "Background only" line.
  - HANDOFF.md §4.12 receiver wording: "Anchors-tab Anchorage card" → "Anchorage-tab card …".
- **What disappeared (for the engineer):** the checks Anchor tension, Anchor breakout (group), Anchor shear, Anchor T–V interaction, Anchor reinforcement ×3 (when provided), Anchor min. spacing, Anchor min. edge distance; the shear-breakout / side-face "NOT CHECKED" warnings; the bolt-group plan drawing, the limit-state table (incl. its torsion row and §17.9.2 / not-checked rows), T_max / V_b / interaction rows, the Ch. 17 worked steps 1–7 and 9; the Summary "Anchor installation" row; the anchor sections of the Calc sheet and Report.
- **Verdict effect (same numbers, fewer checks; compare-harness cases):** default pole unchanged (ALL CHECKS PASS, governing 100 % tie spacing); square shaft and no-cable "3 CHECKS FAIL Anchor breakout (group) · Anchor T–V interaction · Base plate thickness" → "1 CHECK FAIL Base plate thickness"; tall and cable45 "2 CHECKS FAIL Anchor breakout (group) · Anchor T–V interaction" → "ALL CHECKS PASS"; monopost 4 → 2 (base plate, post), monopost square 3 → 1, two-post 8 → 4, two-post bs 6 → 2. The anchor D/C now comes only from the Anchorage app chip.
- **Check case:** default pole: base plate t_req = √(4·10,018·3.00 / (0.9·36,000·5.236)) = 0.842 in ≤ 1.250 in, (0.842/1.25)² = 0.454 — same before and after.
- **How verified:** `node tests/check-syntax.mjs` pass; `node tests/engine/run.mjs lightpole` 23 passed; `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: "results identical" and cable values identical (1437 / 699 / 330 numbers) in all 14 cases, 0 console errors; only text (Summary, Anchorage, Calc sheet, Report) and the removed bolt-group drawing differ. `tests/smoke/lightpole-anchor-handoff.mjs` ALL PASS (one earlier run had a timing failure on the pole chip; passed on three reruns). Screenshots 1280 / 390 px: no horizontal overflow.

## 2026-11-01 — PR #617: claude/lp-anchor-cleanup (LPA-4: input card 7 relabelled; unreachable anchor display code removed; no result or output change)

### LPA4-1. Input card 7 relabel   [display] [no result change]
- **Coordinator answer (2026-11-01):** relabel card 7 and note that the anchor checks are done in the Anchorage app; keep all inputs.
- **Where:** input card 7 header. Before: `<h2>Anchor bolts &amp; base plate</h2><span class="hint">ASTM F1554 · ACI 318 Ch.17</span>`. After: `<h2>Anchor rods &amp; base plate (sent to the Anchorage app)</h2><span class="hint">ASTM F1554 · base plate checked here</span>` plus a note paragraph at the top of the card body ("The anchor checks (ACI 318-19 Ch. 17) are done in the Anchorage app: these inputs are sent with "Send anchors to the Anchorage app" (Anchorage tab). The base plate is checked here."). Manual §2.10 heading changed the same way, with a one-line note. Every input id, default and saved field is unchanged.

### LPA4-2. Unreachable anchor display code removed   [refactor] [no result change]
- **Coordinator answer (2026-11-01):** delete `boltWorkedHTML()` and `drawBoltGroup()` and any other now-unreachable anchor display code.
- **Removed (none called anywhere after LPA-3 / #616):** `boltWorkedHTML(bo,inp)` (the Ch. 17 derivation, steps 1–9; its step 8 lives on as `basePlateWorkedHTML()`), `drawBoltGroup(bolts,inp,tgt)` with its `// ---------- ANCHOR BOLT GROUP (plan) ----------` header, and the limit-state-table row helpers `boltMinGeomRows(b)`, `boltArRows(b)` (already unused), `boltNotCheckedRows(b)` with their header comment. The comment above `basePlateWorkedHTML()` reworded. The anchor engine (`anchorBolts()`, `sfbApplies` etc.) is untouched: it feeds the base plate and the anchorGroup payload. To restore any of these, take them from the file at #616 (squash 58204ba).
- **How verified:** a scan for declared functions with no remaining reference: none newly unreferenced. `node tests/check-syntax.mjs` pass; `node tests/engine/run.mjs lightpole` 23 passed; `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: "ALL CASES IDENTICAL" (results, cable values, text of every output tab, drawings) in all 14 cases, 0 console errors (the harness reads the output tabs, so the card-7 relabel does not show there); `tests/smoke/lightpole-anchor-handoff.mjs` ALL PASS.

## 2026-11-02 — PR: claude/lp-report-consolidate (LPRX: the Calc sheet (D11 calculation sheet) retired; the Report is the one report; display only, no result change)

### LPRX-1. Calc sheet content read into the Report; Calc sheet tab and the D11 layout builder removed   [display] [no result change]
- **Engineer request (2026-11-02):** consolidate the "Calc sheet" output tab (the D11 print report) and the "Report" tab (shared viewer, #593) into one: keep the Report, retire the Calc sheet, as done for lldf in #623 (LXM). Before retiring, compare every number and section of the Calc sheet against the Report and port what is missing (values from the app's own results, no recomputation); Print / PDF, Ctrl+P and the browser's Print print the Report from every tab; a remembered "Calc sheet" tab opens the Report.
- **What was missing from the Report and is ported.** Before the port the Report held 2,252 of the Calc sheet's 7,004 distinct numbers over the 14 compare cases (4,752 missing, 217–426 per case): the Report gave summary steps, the Calc sheet the full derivations. Ported, read from the builders' own HTML (`buildReport` / `buildSignReport` still write it with the tabs' worked-derivation functions and the same arguments; the HTML is kept on `LPP_LAST.H`):
  - the inputs echo (Calc sheet section 0 "Design inputs & basis" / "Design basis — sign structure": codes & method, site & wind, pole / post, ice & cable wind, shaft & soil, anchor bolts, fixture schedule, cable geometry, sign panel, torsion note) → §1.2;
  - the cover lines: mode (eyebrow), "Light Pole and Sign Post, by Mario Lococo · date", the scope line (already there), and the front-matter note (equations symbolic → substituted → result, D/C convention, "—" title-block fields) → §1.1;
  - the Summary tab's content as the Calc sheet printed it (`summaryHTML(ctx)`: verdict, not-checked flags incl. the base-plate VERIFY note, "Design — as designed" (with the Anchorage-app hand-off row and chip), governing demands, utilization table, key design inputs with B₂) → §2.1;
  - pole: 1 velocity pressure, 2 pole wind (C_f, ice, n₁ / G_f), 2b fixtures, 3 cable components → §3; 4 load-combination matrix, 4b wind-direction envelope → §4; 4c pole combined stress (worked body + segment table + D/t) → §5; 8 base plate (anchor hand-off line "designed in the Anchorage app", bending-line steps, `LPP_BP_VERIFY` box) → §6; 5 governing ASD demand, 6 embedment (iteration table, Broms reference), 6b soil bearing, 7 shaft reinforcement (worked, top-zone ties) → §7;
  - sign: 1 sign wind → §3; 1b load path, 2 per-post combinations and the two-post split → §4; each post's section 3 split at its headings: post combined stress / D/t → §5, base plate → §6, demand / embedment / Broms / bearing / shaft / torsion → §7;
  - the result line of each check where the Calc sheet had one (`.lppRes` markers → a small table: check, D/C, code, PASS/FAIL from `collectChecks`, the Summary's own values);
  - the Calc sheet's "§2b"-type references → § links to the ported section (keys `lpcs:<old tag>`); its "→ Tab · Card" links → in-app links that open the card (`lprGoto('wk:<k>:<st>')` → `lppGoto`).
  - Figures: the Calc sheet had none (0 SVG in every case); none to port.
- **Where (to re-apply by hand):**
  - New block before `function lprModel(){` (anchor `/* LPRX (2026-11-02): the Calc sheet (the D11 calculation sheet) is retired`): `lprxPlain`, `lprxText(el,has)` (text with `$_{…}$` / `$^{…}$`, `[[lpcs:…]]`, `[[tab:wk:k:st|…]]`), `LPRX_BLOCK`, `lprxItems(root,scope,checks,has)` (each `\[…\]` → `SharedSteps.step({id:'e<n>',label,eq:TeX})` with a bare `#` escaped as `\#` for KaTeX; `.eq-title` / `.subhead` → item `topic`; `.step-label` → step label; table → table item, `tr.gov` → `cls:'gov'`; `.flag` / non-ok `.verdict` → warning note; `.lppRes` → result table), `lprxSecs(H)`, `lprxSplit(body,route)`.
  - `lprModel()`: after `const stacks=ctx.stacks, lab=…`: `X`, `has`, `checks`, `xsub`, `xs(olds)`, `xpost`, `xps(part,suffix)`; §1 kv rows Mode / Prepared with, the two notes (the old note linking to `[[tab:calcsheet|Calc sheet]]` replaced) `.concat(xs(['0']))`; §2 `subs.unshift(xsub('Verdict, design and governing demands (Summary tab)',…summaryHTML(ctx)))`; §3 `subs.push(...xs(sign?['1']:['1','2','2b','3']))`; §4 `xs(sign?['1b','2']:['4','4b'])`; §5 `sign?xps('post',…):xs(['4c'])`; §6 `sign?xps('bp',…):xs(['8'])`; §7 `sign?xps('shaft',…):xs(['5','6','6b','7'])`.
  - `lprGoto(name)`: first `const w=/^wk:([^:]+):(\d+)$/.exec(name||''); if(w){ lppGoto(w[1],w[2]); return; }`.
  - `buildReport()` / `buildSignReport()`: the last call `lppReportDoc(H,{title:…,sub:…})` → `lppReportDone(H);`. New `lppReportDone(H)` (where `lppReportDoc` was): `LPP_LAST.H=H`, then the three hooks `lppReportDoc` ran at its end (`lprRefresh()`, `lpdRender()` when the Drawings tab shows, `lppAnchorCardRefresh()`).
  - Removed: `lppReportDoc(H,meta)` (cover, title block, references, contents, numbered sections, result lines, KaTeX render of `#reportBody`), `lppPageCSS()`, `lppApplyPageCSS(on)` (the `#lpp-page` @page style), `lppResLine(c,st,withLink)`; the `#lppRptPrint` click handler; the `#reportBody` / `.cr-*` / `.lppRptBtn` CSS and its `@media print` block (`.tabpage:not(#page-calcsheet){display:none}` etc.; kept: `@media print{ header.masthead,#postSelBar{display:none!important} }`); the tab button `data-tab="calcsheet"`, `#page-calcsheet`, the card `section.card.report[data-tab="calcsheet"]` (`#reportBody`, "Print / PDF report" button); `LPP_TABNAME.calcsheet`; in the wkA click handler `a.closest('#reportBody')`. Kept (used by the builders' HTML, the tabs or the Report): `LPP_SUMCTX`, `lppEsc`, `LPP_CHK2K`, `LPP_K2TGT`, `lppTgt`, `lppLink`, `lppWorkedIn`, `lppGoto`, `LPP_REFS`, `lppSecRef`, `lppRes`, `lppDtHTML`, `lppTorsionHTML`, `buildReport`, `buildSignReport` (their arguments are what `tests/lightpole-compare.mjs` reads).
  - Print (end of the script, anchor `// LPRX (2026-11-02): Ctrl+P, "Export PDF / Print" or the browser's Print prints the Report alone`): a first `beforeprint` handler — when the Report tab is not shown and there are results (`LPP_LAST`, `LPP_SUMCTX`, no `#lppInErr.on`), remember the shown tab, `switchTab('report',true)` and dispatch `beforeprint` once more (`lppInPrint` stops the repeat) so shared/report.js sets the running header / page numbers and the LPRP handler fills `#rp-print`; the old fallback `lppApplyPageCSS(true)` removed; `afterprint` shows the remembered tab again (`switchTab(t,true)`). With input errors the page prints as shown.
  - `switchTab(name,noSave)`: `const LPP_OUT_OLD={calcsheet:'report'};` above it; first line `if(LPP_OUT_OLD[name]) name=LPP_OUT_OLD[name];`; the `localStorage.setItem(LPP_OUT_KEY,name)` only when `!noSave` (the print round trip does not change the remembered tab). Restore at load: `if(lppOutTabValid(LPP_OUT_OLD[t]||t)) switchTab(t);` — a remembered `calcsheet` opens the Report. Key `lpp_activeTab_v1` and its format unchanged.
  - Manual §3.7 "Report tab": rewritten for the one report (sections, worked in full by the same generator functions, print from any tab).
- **Governing provision:** none changed (display only). No formula, factor, unit, code reference or computed value changed (CLAUDE.md §4).
- **How verified (scratchpad `shots-lp-report/`: `nums.mjs`, `verify.mjs`, `saved.mjs`):**
  - Every number of the Calc sheet's text (origin/main `#reportBody`, KaTeX read as its TeX source, section numbers, TOC and "see §" references set aside) looked up in the branch's Report (`SharedReport.text` and the rendered HTML with KaTeX annotations), 14 cases (all `tests/lightpole-compare.mjs` cases: default, sqshaft, nocable, broms, cable45, tall, ice, bolts15, arms, torsion, sign1, sign1sq, sign2, sign2bs): **0 of 7,004 missing** (before: 4,752 missing). Calc sheet headings: all found except "Table of contents", "Verdict and items not checked" and "Results — all checks" (the Report's own Contents, §2.1 and §2.2 tables). Figures: Calc sheet 0, Report 0 in every case. Report: 0 unresolved / duplicate refs, 0 `.katex-error`, no NaN / undefined / Infinity, 0 console errors in every case.
  - `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: results identical and cable values identical (1437 / 699 / 330 numbers) in all 14 cases; text of every output tab identical except the removed `calcsheet` page (−339 to −519 lines); drawings identical; 0 console errors.
  - captureState, the `bridgeSuite.v1.anchorGroup` payload (`lppAnchorPayload()`), localStorage keys and values after load and calc (timestamps aside): identical to origin/main in all 14 cases. `node tests/smoke/lightpole-anchor-handoff.mjs`: ALL PASS. `node tests/engine/run.mjs lightpole`: 23 passed. `node tests/check-syntax.mjs "Light Pole and Sign Post.html"`: pass.
  - Browser (`verify.mjs`, default pole and two-post sign): beforeprint from each of Geometry, Summary, Loading, Post, Anchorage, Shaft, Drawings, Report, Manual prints the Report alone (`body.rp-printing`, `#rp-print` filled, @page running header and page numbers) and shows the tab of before after printing; the remembered tab is unchanged; "Export PDF / Print" prints the Report; `lpp_activeTab_v1 = "calcsheet"` opens the Report; with an input error the page prints as shown; a "→ Tab · Card" link in a worked section opens its card; no Calc sheet tab; no horizontal scroll at 390 px; 0 console errors. Print PDFs: default 29 pages, two-post sign 36 pages. Screenshots 1280 / 390 px.
- **Other copies:** none.
- **Open items:** `docs/lts-mode-plan.md` (LTS-9 and the LTS-6 rows) still names the "Calc sheet"; the LTS-mode plan's owner may drop it. The Shaft tab's tie line in `rebarWorkedHTML` has a bare `#3` inside TeX, which KaTeX shows as an error on the Shaft tab (and showed on the Calc sheet); the Report escapes it when reading the TeX, the tab is not changed here (display-only fix to ask about).

## 2026-11-02 — LPK-1: Shaft tab tie line, bare `#3` escaped for KaTeX (display only; no result changes) (PR: claude/lp-tie-katex, PR #627: https://github.com/mlococo88/All-Structural/pull/627)

- **Where:** `rebarWorkedHTML(reo, inp, Mu, Pu, Vu)`, anchor text `A_v = 2A_{tie} = ${fmt(T.Av,3)}` (the A_v,min / A_v line of the shear-tie derivation on the Shaft tab).
- **Before:** `` ... \\ \\text{in}^2\\ (${T.bar.n}\\ @\\ ${fmt(T.sTrial,1)}\\ \\text{in})`); ``
- **After:** `` ... \\ \\text{in}^2\\ (${String(T.bar.n).replace(/#/g,'\\#')}\\ @\\ ${fmt(T.sTrial,1)}\\ \\text{in})`); `` (comment: a bare # is escaped for KaTeX, as the Report's `tex()` does).
- **Problem:** the bar name "#3" went into the TeX unescaped; `#` is a macro-parameter character, so KaTeX showed a parse error ("Expected 'EOF', got '#'") in place of the whole line on the Shaft tab. The Report already escaped it (`tex()` in the Report builder, which leaves an already-escaped `\#` alone), so the Report is unchanged. Pre-existing; noted as an open item in LPRX above.
- **Governing provision:** none (display only; the equation, ACI 318-19 Table 22.5.5.1 / §9.6.3, is unchanged).
- **Check case:** default pole: before → KaTeX error box; after → "A_v,min = 50.0 (36.0)(12.0)/60,000 = 0.360 in² A_v = 2A_tie = 0.220 in² (#3 @ 12.0 in)". KaTeX 0.16.9 (tests/libs) in Node: the old string throws, the new one renders.
- **How verified:** `node tests/lightpole-compare.mjs` (origin/main vs working tree, 14 cases): results identical in all 14, drawings identical, console errors 0/0; the only text difference is this line now appearing on the Shaft tab (it was an error box before, so the harness read no TeX for it): 12 cases +1 line, 2 two-post sign cases +2 lines; no other line differs, Report text identical.
- **Other copies:** none.

## 2026-11-02 — PR #649 (https://github.com/mlococo88/All-Structural/pull/649): claude/lp-lts-1 (LTS-1: AASHTO LRFDLTS code mode — basis, MRI, Table 3.4-1 combinations; IBC mode unchanged)

Basis: docs/lts-mode-plan.md (#619, #620, #647, #648); engineer, 2026-11-02: AASHTO LRFDLTS 1st Ed. (2015) with the 2017 Interim Revisions, later interims not applied (coordinator decision Q-B1: stated on screen and in the report).

### LTS1-1. Code mode switch   [new mode] [IBC results unchanged]
- **Where:** mode card, new segmented control `#codeSeg` (IBC 2021 · ASCE 7-22 | AASHTO LRFDLTS) above Light pole / Sign; global `let codeMode='ibc'` (after `let appMode=…`); `lppApplyCode()` (before `applyMode()`, called first in it): body class `lts-mode`, masthead code tag and scope line (the IBC text is kept in `LPP_IBC_HEAD` and restored), cable note shown in pole mode only, ADT row hidden for signs; `applyMode()` masthead eyebrow/sub for the LTS mode.
- **calc():** renamed the IBC engine `function calc(){` → `function lppCalcIbc(){` (body unchanged except `lppLastInp=null;` before the input-error check and `lppLastInp=inp;` after it); new `function calc(){ lppCalcIbc(); if(codeMode==='lts') ltsCalc(); else ltsClear(); }`. Every caller of calc() is unchanged.
- **CSS:** `body:not(.lts-mode) .ltsOnly`, `body.lts-mode .ibcOnly` and, in the LTS mode, every output card except `.ltsCard` (Manual page excepted) are hidden. Input cards marked `ibcOnly`: card 1 Wind & site, card 4 Catenary cables (`#cableCard`), card 5 Ice (`#iceCard`). `lppPaneShown()` ignores a card hidden by the code mode (in the IBC mode the `ltsOnly` cards do not count, so the input tabs are as before).
- **New input card `#ltsCard` (ltsOnly):** basis line; `ltsRisk` (Typical/High/Low), `ltsAdt` (4 ADT bands), MRI note, `ltsV` (130 mph placeholder), `ltsVsvc` (76 mph), `ltsIce` (0 = none). New note card `#ltsCableNote`: cables are not supported in the LRFDLTS mode (engineer decision; cable inputs kept and ignored).
- **Output (`ltsCalc()`, block `// ================= AASHTO LRFDLTS MODE — output (LTS-1`):** cards built into the tabs after each calc and removed by `ltsClear()`: Summary (basis, "in development — not for design" banner, MRI, status of LTS-1…LTS-9), Loading (MRI step, Table 3.4-1 table), and a placeholder on the Geometry, Post, Anchorage, Shaft, Drawings and Report tabs naming the PR that fills it. The Anchorage export is not reachable in the LTS mode until LTS-8 (its card is hidden).
- **Engine:** new file `apps/light-pole/lts-engine.js` (`window.LpLts`, classic script, loaded by `<script src="apps/light-pole/lts-engine.js">` after shared/dxf.js): `BASIS`, `mri(risk, adt, roadsideSign)`, `COMBOS`, `comboLabel()`.
- **Provisions (AASHTO LRFDLTS 1st Ed. 2015 with 2017 Interim Revisions):**
  - Table 3.8-1 (p. 3-5): MRI by risk category and ADT — Typical 300 (ADT < 100) / 700 (100–10,000) / 1,700 (> 10,000); High 1,700; Low 300; roadside sign supports 10 yr (Fig. 3.8-4). Maps: Fig. 3.8-1 (700), 3.8-2 (1,700), 3.8-3 (300), 3.8-4 (10).
  - Table 3.4-1 (p. 3-3): Strength I 1.25DC (+1.6LL, not applicable: walkways only, Art. 3.6); Extreme I 1.1DC + 1.0W and 0.9DC + 1.0W (V from Figs. 3.8-1/-2/-3); Service I 1.0DC + 1.0W (Fig. 3.8-4).
  - Art. 3.7 / C3.7 (p. 3-4): no ice-plus-wind combination. **Decision Q-C1 (engineer to confirm, flagged on screen):** Owner-specified ice is applied in Strength I at the DC factor 1.25.
- **Before / after:** before, no LRFDLTS mode; after, the mode exists and shows the MRI and the combinations only (no forces or checks yet). IBC mode: no change.
- **Check case:** Typical risk, 1,000 < ADT ≤ 10,000 → 700-yr MRI, Fig. 3.8-1; the same with ADT > 10,000 → 1,700 yr, Fig. 3.8-2; any roadside sign → 10 yr, Fig. 3.8-4 (tests/engine/lightpole-lts.test.mjs).
- **Saved data:** new top-level state field `codeMode` (saves without it open as `'ibc'`); new inputs `ltsRisk`, `ltsAdt`, `ltsV`, `ltsVsvc`, `ltsIce` with defaults applied in `applyState()` when absent. Storage keys and the JSON export format unchanged.
- **How verified:** `node tests/check-syntax.mjs` pass; `node tests/engine/run.mjs lightpole` 26 passed (3 new in lightpole-lts.test.mjs); `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: ALL CASES IDENTICAL (results, cable values, text, drawings; 0 console errors); `tests/smoke/lightpole-anchor-handoff.mjs` ALL PASS; LTS mode pole and two-post sign at 1280 / 390 px: no horizontal overflow, 0 console errors; switching back to IBC removes every LTS card.

## 2026-11-02 — PR: claude/lp-manbar-45 (LPMB: #4 and #5 offered for the shaft longitudinal bars in Check mode; input options only)
- **Where:** input `#manBarSize` (Shaft card, "Reinforcement mode: Check"), anchor `<select id="manBarSize" class="combo-sel">`; manual Inputs table row "Longitudinal bar size".
- **Before:** `<option>#6</option>…<option>#11</option>` (manual text: "#6 through #11. Bars below #6 are not offered for shaft longitudinal steel.")
- **After:** `<option>#4</option><option>#5</option><option>#6</option>…<option>#11</option>` (manual text: "Check mode: #4 through #11. Design mode searches #6 through #11 only.")
- **Why:** engineer request (2026-11-02): check shaft cages with #4 or #5 longitudinal bars.
- **Calculation:** no formula changed. Check mode already reads the bar from the bar table (`barByName`, #3–#11 with A_b and d_b) and checks spacing (ACI 318-19 25.2.3), minimum/maximum steel, the P–M interaction and ties with the same functions; Design mode still skips #3–#5 (`if(bar.n==='#3'||bar.n==='#4'||bar.n==='#5') continue;`), unchanged. Default stays #8, so every saved project computes identically.
- **Check case:** Check mode, 8 #5 longitudinal bars: A_s = 8 × 0.31 = 2.48 in²; the same checks run as for #8 (A_s = 6.32 in²).
- **Verified:** `node tests/check-syntax.mjs "Light Pole and Sign Post.html"` passes; `node tests/engine/run.mjs lightpole` 26 passed, 0 failed.
## 2026-11-02 — PR #651 (https://github.com/mlococo88/All-Structural/pull/651): claude/lp-lts-2 (LTS-2: LRFDLTS wind, dead load and ice, factored base actions; IBC mode unchanged)

### LTS2-1. Wind loads, AASHTO LRFDLTS 1st Ed. (2015) with 2017 Interim Revisions   [new, LTS mode only] [IBC results unchanged]
- **Where:** `apps/light-pole/lts-engine.js`, block `LTS-2 (2026-11-02): wind and dead/ice loads, base actions`: `kz`, `kd`, `cv`, `cdRound`, `cdSquare`, `cdMember`, `cdSign`, `windForces`, `sectionWind`, `LOAD_CASES`, `caseForces`, `gravity`, `baseActions`, `windSteps`. Page: `ltsGeom(inp,L)` and `lppLtsLast` (after `ltsClear()`), the new Loading card `#ltsWindCard` in `ltsCalc()`, input `ltsRs` (LTS card), `LTS_STATUS` LTS-2 done. tests/lightpole-compare.mjs extracts `apps/light-pole/` from the git ref as well as shared/ (the page loads the engine from LTS-1 on).
- **Provisions (before: none — no LRFDLTS mode loads; after):**
  - Eq. 3.8.1-1 (p. 3-14): P_z = 0.00256·K_z·K_d·G·V²·C_d (psf).
  - Eq. 3.8.4-1 (p. 3-15): K_z = 2.0(z/z_g)^(2/α), α = 9.5, z_g = 900 ft (Exposure C), z ≥ 16 ft.
  - Table 3.8.5-1 (p. 3-16): K_d = 0.95 round pole, 0.90 square (rectangular: square). Ground-mounted sign: the post value for the whole structure (decision Q-C5, flagged).
  - Art. 3.8.6 (p. 3-17, 2017): G = 1.14. Art. 3.8.7 (p. 3-17, 2017): C_v = 0.8 Extreme, 1.0 Service.
  - Table 3.8.7-1 (pp. 3-19, 3-20, 2017): round C_d 1.10 (C_vVd ≤ 39) / 129/(C_vVd)^1.3 / 0.45 (≥ 78); square 2.0 − 6r_s (r_s < 0.125) / 1.25 (new input r_s, default 0); sign panel by L/W 1.12 / 1.19 / 1.20 / 1.23 / 1.30 at 1 / 2 / 5 / 10 / 15, linear between (coordinator decision Q-B3); attachments with the manufacturer EPA: P_z without C_d times the EPA (Art. 3.9.1, p. 3-23).
  - Art. 3.9.3, Table 3.9.3-1 (pp. 3-23, 3-24): load cases 1 (normal), 2 (transverse), 3 (0.75 of both) — 8 cases (both senses).
  - Art. 3.9.4.2 (p. 3-25): torsion W·0.15b for single-support roadside signs (b = panel width) and concentric pole-top fixtures (b = √EPA, the width is not an input: flagged); arm-mounted fixtures and arms: net torque. Two-post signs: no eccentric case (decision Q-C2, flagged).
  - Support wind integrated over 100 strips (P_z, C_d and d at each strip); arms: round, projected length a·|sin(θ − ψ)|.
  - Dead load (Art. 3.5): support self-weight (the tool's `poleSegments`), misc. DL, fixtures (eccentric ΣW·e), sign panel. Ice (Art. 3.7, Owner-specified, Strength I only, decision Q-C1): 56 pcf radial on the support(s), two faces of each fixture EPA, one face of the panel.
  - Factored base actions per Table 3.4-1 limit state and load case (first order; B₂ in LTS-3); two-post signs per post.
- **Check cases (hand, tests/engine/lightpole-lts.test.mjs):** HC-1 fixture W_l = 0.00256·1.0384·0.95·1.14·130²·1.2 = 48.65·1.2 = 58.38 lb; arm C_vVd = 0.8·130·0.1979 = 20.6 → C_d 1.10, W_h = 53.52·0.1979·6 = 63.55 lb; T (wind toward 90°) = 6·58.38 + 3·63.55 = 541.0 lb·ft. HC-2 sign: K_z(16) = 0.8562, C_d(L/W 1.6) = 1.162, P_z = 0.00256·0.8562·0.95·1.14·76²·1.162 = 15.93 psf, W_p = 15.93·40 = 637.3 lb, T = 637.3·0.15·8 = 764.8 lb·ft. K_z(20/50/100) = 0.90/1.09/1.26 as Table C3.8.4-1.
- **Saved data:** new input `ltsRs` (default 0 when absent). No key or format change.
- **How verified:** check-syntax pass; `node tests/engine/run.mjs lightpole` 31 passed (5 new); `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: ALL CASES IDENTICAL; anchor hand-off smoke ALL PASS; LTS mode pole and monopost at 1280 / 390 px: no overflow, 0 console errors.

## 2026-11-02 — PR #652 (https://github.com/mlococo88/All-Structural/pull/652): claude/lp-lts-3 (LTS-3: LRFDLTS member checks, Section 5, and second order; IBC mode unchanged)

### LTS3-1. Member checks along the pole / post   [new, LTS mode only] [IBC results unchanged]
- **Where:** `apps/light-pole/lts-engine.js`, block `LTS-3 (2026-11-02): member checks`: `PHI`, `classify`, `mnOf`, `pnc`, `shearTorsion`, `b2`, `interaction`, `memberCheck`, `memberSteps`. Page: `ltsSections(inp)` (21 sections, the tool's `hssProps`, self-weight above each), `ltsGeom()` gets `taper` and `Ht`, Post-tab card `#ltsMemberCard`, Summary row "Pole/Post — combined forces"; `ltsCalc()` builds the Summary card last (it reads the member result). `windForces`: a rectangular tube shows its depth Ht to a wind along y (before: B in every direction; LTS mode only, LTS-2 results for round/square unchanged).
- **Provisions (AASHTO LRFDLTS 1st Ed. 2015 with 2017 Interim Revisions; before: none in the LTS mode):**
  - φ (Art. 5.5.3.2, p. 5-6; Art. 5.5.4): flexure 0.90, shear 0.90, torsion 0.95, compression 0.90, tension yield 0.90 / fracture 0.75.
  - Table 5.7.2-1 (p. 5-14): round D/t λp 0.07E/F_y, λr 0.31E/F_y (flexure) / 0.11E/F_y (compression), λmax 0.45E/F_y; square/rect. b/t 1.12 / 1.53 / 2.14 √(E/F_y). λ > λmax: not permitted (ratio ∞).
  - Table 5.8.2-1 (p. 5-18): M_n = Z·F_y (compact); round M_p[0.77 + 0.016(E/F_y)/(D/t)] / M_p[0.25(E/F_y)/(D/t)]; square/rect. M_p[1.37 − 0.33(b/t)/√(E/F_y)] / M_p[1.23 − 0.23(b/t)/√(E/F_y)].
  - Art. 5.10.2 (p. 5-28): P_nc = A_g·F_cr, F_cr = Q·0.658^(QF_y/F_e)·F_y or 0.877F_e; Q (round slender) = 0.67 + 0.038(E/F_y)/(D/t); Q (square slender) = A_eff/A_g with b_e (Eq. 5.10.2.3-2); K = 2.1, r at 0.5L for a tapered pole (C5.10.2.1).
  - Art. 5.11 (pp. 5-30 to 5-33): round F_nv = max(1.60E/(√(L_v/D)(D/t)^1.25), 0.78E/(D/t)^1.5) ≤ 0.6F_y, A_v = A_g/2, L_v = the height (Q-C8); round F_nt = max(1.23E/(√(L/D)(D/t)^1.25), 0.6E/(D/t)^1.5) ≤ 0.6F_y, C_t = 6.28R²t (Table B.3-1); square/rect. F_nv = 0.6F_y·C_v (k_v 5), A_v = 2ht, F_nt = F_nv, C_t per AISC 360-16 §H3.1 (decision Q-C10, flagged).
  - Second order: tapered round pole Art. 4.8.1, Eq. 4.8.1-1 (p. 4-3): B₂ = 1/(1 − P_eq/P_E,bot) ≥ 1, P_eq = (I_B/I_T)^(1/3)P_T + 0.38D_P, P_E,bot = π²EI_B/(kL)², k = 2.0, r at mid-height; valid when kL/r ≥ 2π√(E/F_y), otherwise the check fails with "detailed method (Art. 4.8.2) required". P_T = factored fixtures + misc. DL (all taken at the top), D_P = factored pole weight. Prismatic post: Eq. 5.12.1-10/-11 (p. 5-34, 2017), K = 2.1.
  - Combined forces Art. 5.12.1 (pp. 5-33, 5-34, 2017): T_u/T_r > 0.20 → Eq. 5.12.1-1; else Eq. 5.12.1-2 (P_u/P_r ≥ 0.20) or 5.12.1-3. Round: vector M_u, V_u (Eqs. 5.12.1-4/-5); square/rect.: biaxial sum (Eqs. 5.12.1-6/-7) and, for the diagonal load cases, Eq. 5.12.2-1 (α 1.6 with M_p when λ ≤ λr, else 1.0 with M_n).
  - Sections z = 0 … H in 20 steps; Strength I, Extreme I max/min × the 8 load cases of Table 3.9.3-1; fixture and misc. dead loads taken above every section (conservative).
  - Warnings: square/rect. tube (Art. 5.6.2 / C5.6.2, C11.4; coordinator decision Q-B6, warning only); wall < 0.125 in (Art. 5.6.1).
- **Engineer's answers recorded (docs/lts-mode-plan.md §4):** Q-C1, Q-C2, Q-C5, Q-C6, Q-C7, Q-C8, √EPA width accepted ("engineer to confirm" flags removed, citations kept); Q-C3 and Q-C4 for LTS-6 / LTS-7. New decision flags: Q-C9 (b = B − 3t), Q-C10 (square C_t).
- **Check cases (hand, Python independent of the engine; tests/engine/lightpole-lts.test.mjs):**
  - HC-1 (40 ft, 8 → 4.5 in × 0.1793, F_y 55): base D/t 44.62 → noncompact, φM_n 520.72 kip-in; φP_nc 4.516 kip (KL/r 469.4); φV_n 65.42 kip; φT_n 540.04 kip-in; B₂ = 1.02992 (P_eq 0.30402, P_E,bot 10.4655 kip; kL/r 447.1 ≥ 144.3 valid). Governing at the base: Extreme I max, load case 3 (0.75·0° + 0.75·90°): M_u = 225.80 kip-in, P_u = 0.57248 kip, T_u/T_r 0.012 → Eq. 5.12.1-3: 0.06338 + 1.02992·225.80/520.72 = **0.5100**.
  - HC-2 (monopost 6.625 × 0.280, F_y 42, 12 ft): compact, φM_n 426.38 kip-in; φP_nc 69.52 kip; B = 1.00487 (Eq. 5.12.1-10); wind toward 0°, V 76 mph: M_u 79.847 kip-in, T_u/T_r 0.0216 → Eq. 5.12.1-3: **0.1912**.
- **Saved data:** none added.
- **How verified:** check-syntax pass; `node tests/engine/run.mjs lightpole` 34 passed (3 new); `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: ALL CASES IDENTICAL; LTS Post tab screenshots (pole, monopost, two-post, square pole), 0 console errors.

## 2026-11-02 — PR #653 (https://github.com/mlococo88/All-Structural/pull/653): claude/lp-lts-5 (LTS-5: LRFDLTS deflection, fatigue applicability, breakaway checklist; IBC mode unchanged)

### LTS5-1. Deflection (Section 10), fatigue applicability (Section 11), breakaway (Art. 2.5.2, Section 12)   [new, LTS mode only]
- **Where:** `apps/light-pole/lts-engine.js` block `LTS-5 (2026-11-02)`: `deflection(g, L, secs, Fy, Bsvc)`, `fatigue(g)`, `breakaway(inClearZone)`. Page: new input `ltsClearZone` (LTS card), Post-tab card `#ltsDeflCard`, Summary card `#ltsBrkCard`, Summary rows (deflection checks, fatigue, breakaway); `LTS_STATUS` LTS-5 done.
- **Provisions (AASHTO LRFDLTS 1st Ed. 2015 with 2017 Interim Revisions; before: none in the LTS mode):**
  - Service I (Table 3.4-1): 1.0DC + 1.0W at V_svc (10-yr, Fig. 3.8-4), C_v = 1.0 (Art. 3.8.7), the 8 load cases of Table 3.9.3-1. Δ and slope at the top by double integration of M/(EI) along the pole (200 strips; Art. 10.4.2.1 "usual methods"), times the Service I B (C10.4.2.1: second-order effects normally included; Art. 4.8.1 or Eq. 5.12.1-10).
  - Art. 10.4.2.1 (p. 10-1, 2017): luminaire supports Δ ≤ 10 % H (the 2017 interim changed 15 % to 10 %); vertical supports with transverse loads Δ ≤ 2.5 % H and with moment loads slope ≤ 0.35 in/ft — coordinator decision Q-B4: applied under Service I to the types the article names (all in scope); the slope limit applies when arm-mounted fixtures put an unbalanced dead-load moment on the pole, else shown as information. Flagged "engineer to confirm" (the commentary calls them dead-load aesthetic limits).
  - Fatigue: Art. 11.4 (p. 11-3, 2017) and Art. 11.7.2 (p. 11-10, 2017): not required for luminaire supports under 55 ft or roadside signs (C11.4); at H ≥ 55 ft the pole is a high-mast tower (Art. 5.2): fatigue design and ≥ 8 anchor bolts (Art. 5.16) required — warning, outside this tool. C11.4 square-pole caution shown for square/rect. poles.
  - Breakaway checklist (no calculation): Art. 2.5.2, 2.5.2.1, 2.5.2.2 (pp. 2-5, 2-6); Arts. 12.1, 12.3, 12.4, 12.5.1 (pp. 12-1, 12-2, 2017).
- **Check case (hand, closed form; tests/engine/lightpole-lts.test.mjs):** HC-2, V_svc 76 mph: post C_d = 129/(41.95)^1.3 = 1.0021, w = 7.586 lb/ft; panel 637.3 lb at 9.5 ft; Δ = Pa²(3L − a)/(6EI) + wL⁴/(8EI) = 0.53787 + 0.04163 = 0.57950 in; B = 1.00442 → **Δ = 0.582 in** ≤ 0.025·144 = 3.60 in; slope 0.0658 in/ft (information: no moment load). Default pole (LTS screenshot): Δ = 2.87 in ≤ 10.5 in (2.5 % H) and ≤ 42.0 in (10 % H).
- **Saved data:** new input `ltsClearZone` (default "no" when absent).
- **How verified:** check-syntax pass; `node tests/engine/run.mjs lightpole` 36 passed (2 new); `tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: ALL CASES IDENTICAL; LTS screenshots pole Post tab (1280) and monopost Summary (390): 0 console errors.

## 2026-11-02 — PR #654 (https://github.com/mlococo88/All-Structural/pull/654): claude/lp-lts-6 (LTS-6: LRFDLTS base plate and base weld; base-plate "2nd Ed." notes relabelled; IBC results unchanged)

### LTS6-1. Base-plate method relabelled (both modes; engineer's answer Q-C3)   [display] [no result change]
- **Why:** LRFDLTS 1st Ed. (2015, 2017 Interim) has no base-plate bending method: Art. 5.6.3 (p. 5-7) only requires the base-plate thickness to be considered (Table 5.6.3-1 minimums apply to supports designed for fatigue). Engineer, 2026-11-02: keep the bending-line method, labelled "engineering method (common practice), not an LRFDLTS article".
- **Before → after (text only):**
  - `const LPP_BP_VERIFY=`: "VERIFY the base-plate method against AASHTO LRFDLTS 2nd Ed. — not yet verified: (1) the governing article number; (2) …; (3) …; (4) …" → "Base-plate method: bending line at the pole face with b_eff = πD/n per rod, double-nut base — an engineering method (common practice), not an AASHTO LRFDLTS article: LRFDLTS 1st Ed. (2015, 2017 Interim) Art. 5.6.3 only requires the base-plate thickness to be considered. Not checked: (1) square/rect. same πB/n; (2) anchor-rod bending in the standoff; (3) Table 5.6.3-1 minimums (fatigue-designed supports only)."
  - Summary check label "AASHTO LRFDLTS bending line" → "bending line at the pole face"; card-7 input note, Calc/eq title `[AASHTO LRFDLTS bending line]` → `[bending line at the pole face — engineering method]`; report step ref 'AASHTO LRFDLTS bending-line method' → 'bending line at the pole face (engineering method)'; report assumption line now `LPP_BP_VERIFY` alone; `basePlateWorkedHTML()` sentence "(and in the AASHTO LRFDLTS 2nd Ed. mode until that mode is added)" → "The same method is used in the AASHTO LRFDLTS mode (an engineering method, not an LRFDLTS article; LRFDLTS Art. 5.6.3)."; Manual §3.5 wording; code comments; IBC scope line "AASHTO LRFDLTS 2nd Ed. highway supports are a separate mode (coming)" → "AASHTO LRFDLTS highway supports have their own mode (code switch above the Light pole / Sign switch)". No "2nd Ed." remains in the tool.
- **Verified:** `tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: results identical, cable values identical, drawings identical in all 14 cases; the only text differences are these labels (Summary, Anchorage tab).

### LTS6-2. Base plate and pole-to-plate weld in the LRFDLTS mode   [new, LTS mode only]
- **Where:** `apps/light-pole/lts-engine.js` block `LTS-6`: `basePlate(ba, Bs, bp)`, `baseWeld(ba, Bs, w)`; page: inputs `ltsWeldType`, `ltsWeldW`, `ltsFexx` (LTS card), Anchorage-tab card `#ltsBpCard`, Summary rows; `LTS_STATUS` LTS-6 done.
- **Method:** rod forces of the circular double-nut base from the LTS factored base actions (Strength I, Extreme I max/min, the 8 load cases; M × the limit state's B from LTS-3), the larger of the tension and compression rod; t_req = √(4·P_rod·m/(φ_f·F_y·b_eff)), m = (BC − D)/2, b_eff = πD/n, φ_f = 0.90 (Art. 5.5.3.2) — the same method as the IBC mode, labelled per LTS6-1. Weld (socket fillet), as a line around the tube: q = √((BM/S_w + P/(πD))² + (2V/(πD) + 2T/(πD²))²), S_w = πD²/4; φR_n = 0.75·0.60F_EXX·0.707w (AWS D1.1 / AISC 360-16 §J2.4; LRFDLTS Art. 5.14 refers to AWS D1.1 and has no strength method: coordinator decision Q-B5, flagged); CJP: base metal governs, no separate check.
- **Check case (hand, tests/engine/lightpole-lts.test.mjs):** HC-1, 4 × 1 in rods on BC 13 in: Extreme I max, wind toward 90°: M = 18,739.6 × 1.0299 = 19,300.3 lb·ft; compression rod 231,603·6.5/84.5 + 572.48/4 = 17,958.7 lb; m 2.5, b_eff 6.2832 in → **t_req = 0.939 in** ≤ 1.25 OK. Weld 5/16 in E70: φR_n = 6.960 kip/in; load case 3: M 232.555 kip-in → q = √(4.6494² + 0.1109²) = 4.651 kip/in → **0.668**.
- **Saved data:** new inputs `ltsWeldType` ('fillet'), `ltsWeldW` (0.3125), `ltsFexx` (70), defaults when absent.
- **How verified:** check-syntax pass; `node tests/engine/run.mjs lightpole` 37 passed (1 new); compare as LTS6-1; LTS Anchorage-tab screenshots pole (1280) and two-post (390), 0 console errors.

## 2026-11-02 — PR #655 (https://github.com/mlococo88/All-Structural/pull/655): claude/lp-lts-7 (LTS-7: LRFDLTS foundation — Broms embedment, ACI 318-19 shaft; square-tube corner-radius input; IBC mode unchanged)

### LTS7-1. Drilled-shaft foundation in the LRFDLTS mode   [new, LTS mode only]
- **Where:** page `ltsFoundation(inp,g,ba,mc)` (before `ltsSections`), Shaft-tab card `#ltsFndCard`, Summary row; `LTS_STATUS` LTS-7 done; the Shaft placeholder removed.
- **Provisions (AASHTO LRFDLTS 1st Ed. 2015 with 2017 Interim Revisions; before: none in the LTS mode):** Art. 13.1 (factored Section 3 loads), Art. 13.6.1.1 and C13.6.1.1 (pp. 13-3, 13-4): Broms' method with the factored groundline M_F, V_F of every Strength I / Extreme I row (M × that limit state's B, as the member check) — the tool's own `bromsEmbedment()` (Eqs. C13.6.1.1-1 to -7; resistance factor φ input, 1.00 by default: decision Q-C7, accepted). The governing (largest) L is the required embedment. Shaft reinforcement: the tool's ACI 318-19 design `designRebar()` / `rebarWorkedHTML()` (P–M by strain compatibility, shear, ties) with the largest Broms shaft moment and every row as a demand — engineer, 2026-11-02 (Q-C4): Broms for the embedment, ACI 318-19 for the reinforcement, with the note that Art. 13.6.2 refers to the AASHTO LRFD BDS (not applied). Torsion: Art. 13.6 gives no method; T_u shown with the ACI 318-19 §22.7.1.1 threshold (open item N2: soil torsion not checked). Details: cover ≥ 3 in and shaft size in 6-in increments (Art. 13.6.2.1) as warnings.
- **Check case (hand, tests/engine/lightpole-lts.test.mjs):** HC-2 (c = 1.0 ksf, D = 2.5 ft): V_F 737.22 lb, M_F 6,686.3 lb·ft → H 9.0696 ft, q 0.032765 ft, **L = 5.080 ft**, M_u 9.463 kip-ft.

### LTS7-2. Optional inside corner radius for square / rect. tubes (coordinator, 2026-11-02; Q-C9/Q-C10)   [LTS mode only]
- **Input:** `ltsRi` (inside corner radius, in; 0 = not known, default).
- **With r_i:** flat width b = (B − 2t) − 2·min(r_i, 4t) (LRFDLTS Art. 5.7.2, Eq. 5.7.2-1 with n = 4); for a square tube the torsional constant is the smaller of the AISC 360-16 §H3.1 value and LRFDLTS Table B.3-1 8.00R²t/k_t with k_t by Eq. B.3-1 (p. B-4), R = (B − t)/2, n′ = r_i/t — flagged: Table B.3-1 divides by "k_t s" and Appendix B does not define s. **Without r_i:** as before (b = B − 3t; AISC C_t), flagged Q-C9/Q-C10.
- **Check case:** 6 × 6 × ¼ in, r_i = 0.5 in: b = 6 − 0.5 − 1.0 = 4.5 in; k_t = 0.08696·(5.75 − 1.25)/ln 1.5 + 0.17391 = 1.1390.
- **Saved data:** new input `ltsRi` (default 0 when absent).
- **How verified:** check-syntax pass; `node tests/engine/run.mjs lightpole` 39 passed (2 new); `tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: ALL CASES IDENTICAL; LTS Shaft tab, pole cohesionless (1280) and monopost (390): 0 console errors.

## 2026-11-02 — PR #656 (https://github.com/mlococo88/All-Structural/pull/656): claude/lp-lts-8 (LTS-8: Anchorage-app hand-off of the LRFDLTS combinations; IBC hand-off unchanged)

### LTS8-1. anchorGroup payload in the LRFDLTS mode   [new, LTS mode only] [schema unchanged]
- **Where:** new `ltsAnchorPayload()` (before `lppAnchorPayload()`), `lppAnchorPayload()` returns it when `codeMode==='lts'`; CSS shows the Anchorage card `#lpAnchCard` in the LTS mode; `ltsCalc()` refreshes the Anchorage chips after the LTS run; LTS Summary row "Anchors — Anchorage app" (chips); `LTS_STATUS` LTS-8 done; the Anchorage placeholder removed; tests/smoke/lightpole-anchor-handoff.mjs: cases `ltsPole`, `ltsSign2`.
- **Payload (HANDOFF.md §4.11, unchanged schema and `signConvention:'lightPole-v1'`):** combos = Table 3.4-1 Strength I and Extreme I (DC max, DC min) × the 8 load cases of Table 3.9.3-1 (17 per group), P/V/T as the LTS base actions (LTS-2) and M = B·M with the B of that limit state (Art. 4.8.1 tapered pole / Eq. 5.12.1-10 prismatic post, LTS-3) — the same rows as the LTS base-plate and weld checks (LTS-6 hand check HC-1: Extreme I max, toward 90°, M_y = 18,739.6 × 1.0299 = 19,300.3 lb·ft); pier depth = the LTS Broms embedment (LTS-7), cage = the LTS ACI design; `basis.combos` / `basis.B2` name the LRFDLTS provisions; notes: LRFDLTS basis, Service I and Fatigue not sent, C5.16.3 (ACI 318-11 App. D) vs the app's ACI 318-19 Ch. 17. Without a Broms soil model the export is refused with that reason. The IBC payload is unchanged (compare: identical).
- **How verified:** `tests/smoke/lightpole-anchor-handoff.mjs` ALL PASS (pole, two-post, monopost as before; LTS pole and LTS two-post: published, file = payload, BP `check()` accepts, imported, combination 1 converted exactly, result chips none → ok → stale after ltsV + 5, no page errors); `node tests/engine/run.mjs lightpole` 39 passed; `tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: ALL CASES IDENTICAL.

## 2026-11-02 — PR #657 (https://github.com/mlococo88/All-Structural/pull/657): claude/lp-lts-9 (LTS-9: LRFDLTS report, geometry summary, drawing notes, manual part L; IBC mode unchanged)

### LTS9-1. Report, geometry, drawings and manual in the LRFDLTS mode   [display, LTS mode only] [no result change]
- **Report:** `ltsReportModel()` / `ltsReportRender()` (block `// ================= LRFDLTS mode: report (LTS-9`), mounted with shared/report.js in the Report tab (card `#ltsRptCard`; `switchTab('report')` renders it in the LTS mode). Sections: 1 basis, scope and criteria (MRI step); 2 loads and combinations (Table 3.4-1, the wind steps, the base actions table); 3 member check (governing steps, all sections); 4 deflection and fatigue; 5 base plate (engineering-method note) and weld; 6 foundation (Broms steps, ACI cage, torsion); 7 anchorage, breakaway, assumptions and the items still flagged for the engineer (Q-B4, Q-B5, Q-C9/Q-C10, Table B.3-1 "s", square-tube warning). The steps are the same objects the tab cards show (`lppLtsLast.ws/ms/bpSteps/wdSteps/fdSteps`).
- **Geometry:** card `#ltsGeoCard` (input summary with the Broms embedment). **Drawings:** card `#ltsDwgCard` with LRFDLTS general notes; the dimensioned drawings and DXF stay IBC-only (they show the IBC §1807.3 embedment) — stated on the card.
- **Manual:** new part "L. AASHTO LRFDLTS Mode" (inputs, provisions table, decisions accepted / still to confirm, outputs).
- **Status text:** `LTS_STATUS` LTS-9 done (all steps); the "not for design" banner and scope line stay (removal is the engineer's decision); the masthead sub-text says all planned checks are implemented and the mode stays marked not for design until released.
- **tests/smoke/lightpole-anchor-handoff.mjs:** a 300 ms wait before reading the returned-result chips (the occasional timing failure noted in LPA-3; 3/3 passes after).
- **How verified:** check-syntax pass; `node tests/engine/run.mjs lightpole` 39 passed; `tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: ALL CASES IDENTICAL; anchor hand-off smoke ALL PASS (3 runs); LTS Report (pole, two-post) 23 headings, no unresolved references, 0 console errors; Summary / Loading at 1280 and 390 px: no overflow.

## 2026-11-02 — PR #658 (https://github.com/mlococo88/All-Structural/pull/658): claude/lp-lts-release (LTS release: engineer's answers Q-B4, Q-B5, Q-C9/Q-C10; known limits stated; "not for design" banner removed; IBC mode unchanged)

### LTSR-1. Deflection limits 2.5 % H and 0.35 in/ft: information only (engineer, 2026-11-02, Q-B4)   [verdict change, LTS mode only]
- **Where:** `apps/light-pole/lts-engine.js` `deflection()`: the `trans` (2.5 % H) and `slope` (0.35 in/ft) entries get `applies: false` (shown with value, limit and ratio; never a failure); the `lum` (10 % H, luminaire supports, Service I) entry stays a check.
- **Before:** `trans` applied to every support (`applies: true`), `slope` applied when arm-mounted fixtures put an unbalanced dead-load moment on the pole (`applies: momentLoad`), both flagged "engineer to confirm". **After:** both information only, flags removed (note: C10.4.2.1 describes them as dead-load appearance limits).
- **Provision:** AASHTO LRFDLTS 1st Ed. (2015) with 2017 Interim Revisions, Art. 10.4.2.1 and C10.4.2.1 (pp. 10-1, 10-2, 2017).
- **Check case (where it governed):** HC-1 (40 ft, 8 → 4.5 × 0.1793, arm 6 ft, V_svc 76 mph): Service I B = 1.0271, governing load case 3; Δ = 8.98 in (10 % H = 48 in: ratio 0.187 OK — unchanged); 2.5 % H = 12 in: 0.749 (before OK, after information); slope 0.364 in/ft vs 0.35: ratio 1.041 — **before: NOT OK (deflection check failed), after: information**. The computed values are unchanged (LTS-5); only the verdict changes.

### LTSR-2. Flags removed / notes (engineer, 2026-11-02)   [display, LTS mode only]
- Q-B5 (base weld per AWS D1.1 / AISC 360-16 §J2.4, φ 0.75): the "engineer to confirm (Q-B5)" chip and report flag removed; the note says "accepted by the engineer, 2026-11-02".
- Q-C9 / Q-C10: with the inside corner radius the notes cite Eq. 5.7.2-1 and the smaller of the Table B.3-1 / AISC constants ("s" undefined in Appendix B) without a flag; without it a short note "Flat width b = B − 3t (no corner radius entered)" / "AISC 360-16 §H3.1; no corner radius entered or rectangular tube".
- Known limits (accepted; `LTS_LIMITS`, shown on the Summary card, in the report §1.1 and in manual part L): soil torsional resistance not checked (Art. 13.6); drawings / DXF IBC-only; 8/12/16-sided sections not built; mast arms, high-mast towers (≥ 55 ft warning) and fatigue design outside the mode; cables not supported.
- **Banner removed:** `ltsDevHTML()` now shows the known limits (no "in development — not for design"); masthead scope line and sub-text, report note and manual warning updated; `LTS_STATUS` gets a "Release" row. docs/lts-mode-plan.md §5.1 records the answers.
- **How verified:** check-syntax pass; `node tests/engine/run.mjs lightpole` 39 passed (LTS-5 tests updated: 2.5 % H and slope `applies: false`, 10 % H a check); `tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: ALL CASES IDENTICAL; LTS screenshots (Summary, Post, Report) 0 console errors.

## 2026-11-02 — PR #659 (https://github.com/mlococo88/All-Structural/pull/659): claude/lts-ctdot-120 (LTS: CTDOT 120 mph wind-speed preset; IBC mode and cables unchanged)

### LTSC-1. "Source of V" preset: CTDOT BDM §14.2.2, 120 mph (engineer decision 2026-11-02; no owner selector)   [new input, LTS mode only] [default unchanged]
- **Where:** LRFDLTS criteria card, new select `ltsVSrc` above `ltsV` (options `map` "LRFDLTS map (enter V)", default, and `ctdot` "CTDOT BDM §14.2.2, 120 mph"). Handlers after the `poleShape` listener: choosing `ctdot` writes `ltsV = 120` (`LTS_CTDOT_V`); typing a V other than 120 while `ctdot` is selected returns the select to `map`, so CTDOT is never cited for a speed it does not give. V stays editable.
- **Code:** new `LTS_CTDOT_V` and `ltsVSrcStep(L)` (before `ltsInputs()`); `ltsInputs()` adds `vSrc` (`'ctdot'` only when the select is `ctdot` and V = 120, else `'map'`); `ltsCalc()`: `ltsVNote` text, `mSteps = m.steps` + the source step when `ctdot` (combinations card and report §1 "Wind criteria"), the combinations table Wind column, the summary row (with a link → Loading · combinations card) and the drawing note "WIND:" name CTDOT BDM §14.2.2 in place of the map figure; `ltsReportModel()` kv row and table likewise. Manual part L card 1 text mentions the preset. With `map` every output is byte-identical to before.
- **Source (paraphrase, cite only):** CTDOT Bridge Design Manual (Rev. 02/24) §14.2.2 (Arts. 14.2.2.2 structure-mounted and 14.2.2.3 special sign supports) bases the design on a 120 mph wind and refers to the older AASHTO Standard Specifications for Structural Supports (the ASD edition, not LRFDLTS); CTDOT BRSDM Release 1, C3.8.1.2.5CT, notes that one wind speed is specified for all new sign structures statewide but does not state it. The step note says this. V is used unchanged in the LRFDLTS equations (Eq. 3.8.1-1, C_v = 1.0 Extreme I); the Table 3.8-1 MRI is still shown but does not set V. V_svc (10-yr, Service I) is not changed by the preset.
- **Formulas, factors, units:** none changed. Only the input value V changes when the engineer chooses the preset.
- **Check case (HC-2, monopost sign 8 × 5 ft, clearance 7 ft, post 6.625 in, tests/engine/lightpole-lts.test.mjs):** before (V = 76 mph): P_z = 0.00256·0.8562·0.95·1.14·76²·1.162 = 15.93 psf; W_p = 15.93·8·5 = 637.3 lb; T = 637.3·0.15·8 = 764.8 lb·ft; Extreme I (DC max) base M 6,653.9 lb·ft. After (CTDOT preset, V = 120 mph): P_z = 0.00256·0.8562·0.95·1.14·120²·1.162 = 39.72 psf (= 15.93·(120/76)²); W_p = 39.72·40 = 1,588.8 lb; T = 1,906.6 lb·ft; base M 16,099.0 lb·ft. New test "CTDOT preset HC-2 at V = 120 mph".
- **Saved data:** new input `ltsVSrc` in the project `inputs` (key `lpp_projects_v1` / `lpp_session_v1` unchanged); saves without it open as `map` (default in `applyState()`), so every saved project computes identically.
- **tests/lightpole-compare.mjs:** two LRFDLTS cases added (`ltspole`, `ltssign1` with V = 115), both on the map source.
- **How verified:** check-syntax pass; `node tests/engine/run.mjs lightpole` 40 passed (1 new); `tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: ALL CASES IDENTICAL (16 cases incl. the 2 LTS cases); browser (1280, 390, LTS monopost): preset → V 120, source step, report row, summary link to the Loading tab, drawing note; editing V to 125 → source back to the map, step removed; 0 console errors.

## 2026-11-02 — PR #661 (https://github.com/mlococo88/All-Structural/pull/661): claude/lts-ctdot-max (LTS: CTDOT source uses V = max(map V, 120 mph); map source and IBC mode unchanged)

### LTSC-2. CTDOT source: V never below the LRFDLTS map value (engineer decision 2026-11-02, revises LTSC-1)   [calculation input, LTS mode only, CTDOT source only]
- **Before (#659):** choosing "CTDOT BDM §14.2.2, 120 mph" wrote `ltsV = 120` (overwriting the map V); V used = 120 mph; editing V away from 120 switched the source back to the map.
- **After:** `ltsV` is always the user's LRFDLTS map V and is never overwritten (the two handlers after the `poleShape` listener are removed). New `ltsVUsed()` (before `ltsInputs()`): map source → V = map V (as before); CTDOT source → **V = max(V_map, 120 mph)**, with `L.Vmap` kept. `ltsInputs()` spreads `ltsVUsed()` in place of `V`/`vSrc`.
- **Worked step** `ltsVSrcStep(L)` (id `vsrc`, Loading → combinations card and report §1): V = max(V_map, V_CTDOT) = max(…, 120) = V, which governs ("the LRFDLTS map V governs" / "the CTDOT 120 mph floor governs"), and the ASD-basis note (§14.2.2 refers to the older AASHTO Standard Specifications for Structural Supports; BRSDM C3.8.1.2.5CT names no speed). The V note, the combinations Wind column, the summary row, the report row and the "WIND:" drawing note show map V, CTDOT 120 and the used V. Select option text "CTDOT BDM §14.2.2: max(map V, 120 mph)"; manual part L updated.
- **Provision:** CTDOT Bridge Design Manual (Rev. 02/24) §14.2.2; AASHTO LRFDLTS 1st Ed. (2015, 2017 Interim) Art. 3.8.1, Eq. 3.8.1-1 (unchanged), Table 3.8-1 (map V).
- **Check cases (HC-2 monopost sign 8 × 5 ft, tests/engine/lightpole-lts.test.mjs):**
  - Map V = 76, CTDOT source: before (#659) 120; after max(76, 120) = **120** (unchanged): P_z 39.72 psf, W_p 1,588.8 lb, T 1,906.6 lb·ft, Extreme I base M 16,099.0 lb·ft.
  - Map V = 130, CTDOT source: before (#659) the preset set V = 120 (P_z 39.72 psf, W_p 1,588.8 lb, T 1,906.6 lb·ft, M 16,099.0 lb·ft); after max(130, 120) = **130**: P_z = 15.93·(130/76)² = 46.62 psf, W_p = 46.62·40 = 1,864.7 lb, T = 2,237.6 lb·ft, M 18,777.4 lb·ft. New test "CTDOT max rule HC-2 with map V = 130 mph".
- **Saved data:** no new key or field. Map-source projects compute identically. A project saved with the CTDOT source under #659 holds `ltsV = 120` (the preset overwrote the map V): it opens with V = max(120, 120) = 120 (unchanged result); re-enter the site's map V to apply the max rule.
- **How verified:** check-syntax (no arguments, all files) pass; `node tests/engine/run.mjs lightpole` 41 passed (1 new); `tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: ALL CASES IDENTICAL (16 cases); browser (LTS monopost, 1280 and 390): map 76 → V 76 (W_p 1,175 lb, default 12 × 6 ft panel); CTDOT, map 76 → V 120 (CTDOT floor governs, W_p 2,929 lb); CTDOT, map 130 → V 130 (map governs, W_p 3,437 lb), report row; back to map, 130 → V 130; ltsV never overwritten; 0 console errors.

## 2026-11-02 — PR #662 (https://github.com/mlococo88/All-Structural/pull/662): claude/lp-theme (LPTH: suite theme and two-panel layout; display only)

### LPTH-1. Suite look: navy header bar, scrolling input / output panels, suite tabs, cards, buttons, chips and tables   [display only] [no result change]
- **Engineer request (2026-11-02):** make the pole and sign app look like the recent apps (Spread Footing, BasePlateAnchorDesigner, lldf, apps/steel-bridge): no orange buttons / accents, no "odd" beige theme.
- **Stylesheet (whole `<style>` block rewritten, every selector kept):** tokens as apps/steel-bridge/index.html (`--navy-800 #1E3A5F`, `--blue-600 #2563EB`, slate greys, `--font-ui` system sans for controls / tabs / card heads, `--font-doc` Times for the calculation text); the old tokens (`--accent`, `--accent-deep`, `--steel`, `--line`, …) are redefined to the navy / slate palette, so the inline `var(--accent-deep)` etc. in the generated HTML follow; `--accent-wash` (used by the governing-row highlights but never defined before) = `#EEF4FB`. Tabs: slate tab, white selected tab with a 3 px blue top stripe (input and output). Cards: 6 px radius, slate-100 head with the upper-case 8.5 pt title, the card number as plain navy text (no orange badge). Buttons: header buttons translucent white on navy (Save no longer orange); `.btn` navy, `.btn.ghost` white; modal OK button blue. Segmented switches (code, light pole / sign, posts, `.seg`): selected = navy. Status chips / pills / verdicts: green / amber / red on light tints. Tables: slate header `#EEF2F6`, slate lines; `table.matrix` head no longer black. Notes: `.flag`, `.lts-dev`, `.lts-flag` use the amber warning style (no orange). The refinement layer at the end of the old block was folded into the base rules.
- **Header:** the project bar and the masthead are one navy header (`<header class="masthead">`): "← All tools", title `#appTitle`, byline with the mode line `#appEyebrow` (now a `span`, same text), the code tag (right), the project bar (`.projbar`, same ids and buttons), the mode description `#appSub` and the scope line `#lppScope`. Ids, texts and handlers unchanged.
- **Layout (screens wider than 900 px):** the page no longer scrolls; the input column `.col-in` (33 %) and the output column (new class `col-out`) scroll on their own, as BasePlateAnchorDesigner / Steel Bridge Design. Both panels are `position:relative` (KaTeX MathML containment, Spread Footing #524 pattern); the input and output tab bars are sticky inside their panel. At 900 px and below the panels stack (inputs above outputs) and the page scrolls, as before.
- **Input rows:** `.row` grid `minmax(38%,1fr) minmax(0,auto)` with `.row select{max-width:100%}`: a long select (soil class, ice basis, risk category) shrinks inside the panel instead of running past its edge (it did at 1280 px before).
- **JS (display only):** new `lppOutToTop()` (before `renderManual()`): scrolls the output panel to its top (wide screens) or the page to the output tab bar (phone). Used by the Manual part buttons (before: `document.querySelector('.col-out')||window`, `.col-out` did not exist, so the page scrolled to its top) and by `lprGoto(name)` for a report link to a tab (before: `window.scrollTo` to `#tabBar`, which does nothing when the page does not scroll). `lppGoto()` (`scrollIntoView`) works in the panel unchanged.
- **Not changed:** every input, id, default, handler, computed result, saved key / format (`lpp_projects_v1`, `lpp_session_v1`, `lpp_inputTab_v1`, the output-tab key), the Anchorage hand-off, the IBC / LRFDLTS switch, print and the report (shared/report.js), the drawings and their colours (the SVG drawings keep their own palette, e.g. the reinforcement and resultant colours that the legends name), the manual text.
- **How verified:** `node tests/check-syntax.mjs` (no arguments) all scripts pass; `node tests/engine/run.mjs lightpole` 41 passed; `tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: ALL CASES IDENTICAL (16 cases each: results, cable values, tab text, drawings, 0 console errors); `tests/smoke/lightpole-anchor-handoff.mjs` ALL PASS; scroll / phone smoke (1280 and 390): page height = window at 1280 (no page scroll), page width = window at both widths on every output tab (IBC pole, LRFDLTS pole, two-post sign); Summary "→ Shaft · Foundation demand & embedment" link scrolls the output panel (1280) or the page (390) to the card, the page itself stays at 0 at 1280; report link to a tab and the Manual part buttons show the top of the tab; input-tab click resets the input panel; arrow keys on the input tabs, Enter on an output tab, Save As modal with Escape, IBC → LRFDLTS → IBC switch work; 0 console errors; printed Report and Summary tabs (Letter): 29 pages before and after, same content. Before / after screenshots of every input and output tab at 1280 and 390 px, beside BasePlateAnchorDesigner.html.

## 2026-11-02 — PR #663 (https://github.com/mlococo88/All-Structural/pull/663): claude/lp-signviews (LPSV: sign structure and foundation views, 3D and 2D, monopost / two-post, IBC and LRFDLTS; display only)

### LPSV-0. What existed before (inventory, origin/main 7a20980)
- **Pole mode:** Geometry tab plan + to-scale elevation (`lpdElevGeometry`); Drawings tab (#597): pole elevation, plan, shaft section(s), base plate, general notes, DXF. No 3D view anywhere in the tool (three.js was not loaded).
- **Sign mode, IBC:** Geometry tab schematic plan + elevation (`drawSignSchematic`, autofit); Drawings tab: one "SIGN ELEVATION" sheet (panel, posts, shafts, CLR / s / Lp dims), the plan sheet drew the panel along x while labelling the wind normal "±x" (the engine's panel normal is +x, posts along y), section, plate, IBC notes (sign notes left out the ice that signs carry since LP-16). No side elevation, no post size, no panel-width dimension.
- **Sign mode, LRFDLTS:** Geometry tab: input-summary table only; Drawings tab: notes card only ("dimensioned drawings … IBC mode only"); no drawings, no DXF.

### LPSV-1. 3D view (Geometry tab, sign mode, both code modes)   [display] [no result change]
- **Library:** `<script defer src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js">` — the suite's pinned r128 (Pile Designer etc.; offline copy already in tests/libs, MANIFEST "used_by" updated). Added at the engineer's request for a 3D view; without it (offline) the card says so and everything else works.
- **Where:** block `// ================= SIGN VIEWS: data, 3D view (LPSV` (before the Anchorage hand-off): `lpsvData`, `lpsvGeomNote`, `lpsvLtsNotes`, `lpsvCardSync`, `lpsvRefresh`, `lpsv3dRender`, `lpsvBuild`, `lpsvInfo`, `lpsvSoilTxt`, `lpsvLabel`, `lpsvHome`, `lpsvView`, `lpsvWire`, …; `calc()` calls `lpsvRefresh()` after the IBC / LTS runs; `switchTab('geometry')` renders the view. CSS `.lp3dBar`, `.lp3dLay`, `.lp3dWrap`, `.lp3dHint`, and `body.lts-mode .tabpage > #lp3dCard{display:block!important}`. The card (`#lp3dCard`) is created in sign mode only (after the Schematics card; after `#ltsGeoCard` in the LRFDLTS mode) and removed in pole mode, so the pole tabs are unchanged.
- **Content:** panel B × s at its clearance (front face green, toward −x), post(s) round / square / rect HSS at the derived height, base plates, anchor rods on the bolt circle at θ₀ + j·360/n with h_ef, drilled shafts (semi-transparent) to the design embedment with the cage of the design (longitudinal bars at `barLayoutRound/Square`, ties at s_top within zoneH then s, auto or check mode), semi-transparent grade plane, soil block with the soil text, wind arrow of the governing case, labels. Orbit / pan / zoom (mouse, wheel, touch, pinch), Reset / Front / Side / Plan, Save PNG, 8 layer toggles (memory only — nothing saved). 1280 and 390 px (fewer, larger labels below 600 px).
- **Values used (no recomputation):** IBC — `LPP_SUMCTX.stacks[i].found.d / reo`, wind = `LPP_LAST.postDesigns[0].gASD` (φ, combination, case: the governing ASD for post 1's embedment). LRFDLTS — `lppLtsLast.fd.gov.br.L` (Broms) for every post, `lppLtsLast.fd.reo`, wind direction atan2(V_y, V_x) of `fd.gov.r` (the row governing L); without a Broms soil model the shafts are not drawn and the card says why. Nominal, not inputs (stated on the card): panel thickness 1 in, rod projection 2.5 d_b, no plate standoff, first tie 3 in below the top.

### LPSV-2. Sign drawings and DXF (Drawings tab), both code modes   [display] [no result change]
- **Where:** new `lpsvPostTxt`, `lpsvGeom`, `lpsvUniq`, `lpsvElevStack`, `lpsvGrade`, `lpsvCageTxt`, `lpsvFront`, `lpsvSide`, `lpsvPlan` (before `lpdBuild`); `lpdBuild(cx)` takes the sign context (`lpsvData()`), adds layer `S-WIND` in sign mode and builds the sheets `elev` SIGN FRONT ELEVATION, `side` SIGN SIDE ELEVATION (new), `plan` PLAN (sign plan redrawn: posts at y = ±L_p/2, panel along y on the −x face, axes, governing wind arrow, B and L_p dims); section(s) unchanged; plate: rect post at its depth, t_req label per code mode, anchor reference line ("ANCHOR DESIGN: ANCHORAGE APP"); notes: IBC list + sign geometry note + ice clause for signs; LRFDLTS list = `ltsDwgNotes(X)` (the LTS-9 card notes, now one function, card HTML unchanged) + geometry + L definition. Sign notes use plain ASCII (§ → SEC., ≥ → >=) because the preview shows DXF \U+ codes literally. `lpdRender()`: sign mode uses `lpsvData()` (error flag when no results / no Broms); layer note adds S-WIND and the value source. The pole sheets (`lpdElevation`, `lpdPlan`) are not changed.
- **LRFDLTS:** CSS `body.lts-mode .tabpage > section.lpdCard.lpdLtsOn{display:block!important}` (class set by `lpsvRefresh` in the LTS sign mode); `#ltsDwgCard` text in sign mode now points to the drawings above (pole text unchanged).
- **Front elevation dims:** CLR, s, POST HT, B, L_p, d (or L) and b per shaft; callouts post size / base plate / rods with a leader, cage text. **Side elevation:** post with the deepest shaft, panel edge, CLR / s / POST HT, d / b, rods projected on x, wind arrow + governing case.

### Verification
- `node tests/check-syntax.mjs` (no args): all scripts pass. `node tests/engine/run.mjs lightpole`: 41 passed.
- `node tests/lightpole-compare.mjs --a origin/main`: results identical in all 16 cases; pole cases identical in results, cables, text and drawings; sign cases: only the 3D card text (+2 lines, Geometry) and in ltssign1 the LTS drawings-card sentence. `--old-saves`: results identical in all 16 cases (a first run showed a transient difference in `arms`; the case and the full run repeated identical).
- `tests/smoke/lightpole-anchor-handoff.mjs`: ALL PASS. New `tests/smoke/lightpole-signviews.mjs` (IBC monopost, two-post, rect post + square shaft, 40 ft two-post; LRFDLTS monopost, two-post, no Broms; pole) at 1280 and 390: sheets fit a standard scale, DXF valid, no NaN, **no text overlaps on any sheet** (tests/engine/overlap.mjs), embedment and cage text = the results, 3D renders, views / toggles / Save PNG work, no horizontal scroll, 0 console errors — ALL PASS.

## 2026-11-02 — PR #666 (https://github.com/mlococo88/All-Structural/pull/666): claude/lp-anchor-shapes (LPAS: the Anchorage hand-off sends the post and plate this tool designs — square / rectangular HSS posts; square base-plate option; no result change for saved projects)

### LPAS-1. Anchorage hand-off: square / rectangular posts were refused by the Anchorage app   [bug] [hand-off payload; no result change]
- **Reported (engineer, live site):** "Send anchors" from a sign with square HSS posts → BasePlateAnchorDesigner: "Anchor-group hand-off refused: Post 1: a circular plate needs base.pole {shape:"round", D}. Post 1: base.pole.shape "square" is not supported (round)."
- **Root cause:** this tool designs every post shape (round / square / rectangular HSS, pole and sign, IBC and LRFDLTS) on its circular plate with the rods on a bolt circle, and sent exactly that (`plate {circle}`, `pole {shape:'square'|'rect', D:poleDiaBase}`), with the note "the Anchorage app takes a round pole on a circular plate". The receiver accepted only a round pole (`base.pole.shape "…" is not supported (round)`), although its own circular-plate check already handles a non-round column (D_pole = the smaller of width and depth, BC-1). A rectangular post was also sent without its depth (D only). The sender's geometry was consistent with what it designs; the receiver's whitelist and the missing depth were the defects.
- **Where:** new `lppAnchBase(inp)` and `lppAnchBaseNotes(inp)` (before `function lppAnchorPayload(){`); `ltsAnchorPayload()` and `lppAnchorPayload()` use them.
- **Before (both payload builders):**
  ```js
  if(inp.poleShape!=='round') notes.push('The pole is '+inp.poleShape+' (the Anchorage app takes a round pole on a circular plate).');
  base:{type:'doubleNut', standoffClear:0, grout:false, plate:{shape:'circle', D:inp.bpDia, t:inp.bpT, Fy:(inp.bpFy||36)*1000},
        pole:{shape:inp.poleShape==='round'?'round':inp.poleShape, D:inp.poleDiaBase}},
  ```
- **After:** `lppAnchBaseNotes(inp).forEach(x=>notes.push(x));` and `base:lppAnchBase(inp),` with
  ```js
  const plate=inp.bpShape==='square' ? {shape:'rect', B:inp.bpB, N:inp.bpB, t:inp.bpT, Fy:(inp.bpFy||36)*1000}
                                     : {shape:'circle', D:inp.bpDia, t:inp.bpT, Fy:(inp.bpFy||36)*1000};
  const pole=inp.poleShape==='square' ? {shape:'square', B:inp.poleDiaBase}
           : inp.poleShape==='rect' ? {shape:'rect', Bx:inp.poleDepthBase, By:inp.poleDiaBase}
           : {shape:'round', D:inp.poleDiaBase};
  return {type:'doubleNut', standoffClear:0, grout:false, plate, pole};
  ```
  Bx = the rectangular post's depth along x (panel normal / wind 0°; the "into-wind dimension" input, the depth the drawings put along x), By = its width along y. Square and rectangular posts are prismatic (`inp.poleDepthBase = inp.poleDepthTop`). Notes: square post (both tools use D = the side), rectangular post (this tool D = width along y, the Anchorage app D = min(width, depth)), square plate (this tool: bending line; the Anchorage app: its rectangular-plate method, AISC DG1).
- **Round post on a circular plate:** the payload is byte-identical (same key order) → same `inputsHash`; a stored Anchorage result stays current.
- **Check case:** sign, two posts, square HSS 8 in, Ø20 plate, (6) 1 in rods on BC 16: before — refused; after — imported, column HSS8X8, plate circle, 20 combinations per post, combination 1 P −0.6228 kip, M_y 352.24 kip·in (post 1) = −P_LP, M_x,LP converted; governing D/C 1.16 (Combined T–V, 0.9D + 1.0W, wind 0°, Case B).

### LPAS-2. Square base-plate option   [new input; default round, every saved project unchanged]
- **Engineer request (2026-11-02, via the coordinator):** add a square base plate (round default).
- **Where:** input card 7: `bpShape` select (Round (circular plate) | Square, default Round) before `bpDia` (now row `rowBpDia`), new row `rowBpB` with `bpB` (side, default 20 in), shown by `lppApplyBpUI()`; `INPUT_IDS` += `bpShape`, `bpB`; `calc()` inputs `bpShape`, `bpB`; `applyState()`: a save without `bpShape` / `bpB` opens round / 20 in; `lppInputErrors()` (end): a square plate needs B > 0 and every rod hole (rod centre on the bolt circle + d/2) inside B/2; `lppBpW()`, `lppBpTxt()`, `LPP_BP_SQ`, `lppBpSqNote()` (after `lppApplyBpUI`).
- **Anchors:** the rods stay on the existing bolt circle (the only pattern this tool has). (4) rods at θ_b = 45° put one rod on each corner diagonal of the square plate.
- **Plate check (no formula change, §4):** the existing bending line at the pole face, t_req = √(4·P_rod·m/(0.90·F_y·b_eff)), m = (BC − D)/2, b_eff = πD/n (IBC `anchorBolts()`, LRFDLTS `LpLts.basePlate()`), is used unchanged for the square plate. It is the same method: it uses only BC, D and n, never the plate outline — the strip at the pole face lies inside the plate (a square plate of side B contains the circle of diameter B), the plate outside the bolt circle is not credited (so the square plate's corners add nothing). Labelled an engineering method, as for the circular plate (`LPP_BP_VERIFY` unchanged; the square-plate statement is shown with the worked step, the LRFDLTS base-plate card and both reports).
  - Hand check (default light pole, square plate 20 × 20 × 1.25 in, A36): P_rod = 10,018 lb (as before), m = (16 − 10)/2 = 3.00 in, b_eff = π·10/6 = 5.236 in, t_req = √(4·10,018·3.00/(0.9·36,000·5.236)) = 0.842 in — identical to the Ø20 circular plate (tool: 0.842 in, both modes).
- **Display:** Summary "Base plate" row (`square 20.0 in × 1.250 in`), LRFDLTS geometry summary (`plate square 20.00 in × …`; round unchanged), elevation (plate width = B), IBC plan and base-plate sheet (square outline, dimension `PL <> SQ`), sign plan / 3D (box plate) and front-elevation callout `BASE PL 20.00" SQ x …`, Manual input table row.
- **Hand-off:** sent as `plate {shape:'rect', B, N:B}` (LPAS-1); the Anchorage app imports it as a rectangular plate under the round / square / rectangular post.

### How verified
- `node tests/smoke/lightpole-anchor-handoff.mjs`: ALL PASS — the 5 earlier cases unchanged (same D/C, same hashes) plus sign2Sq, sign1Sq, sign2Rect, sign1Round, poleSq, poleRect, ltsSign2Sq, ltsSign1Rect, ltsPoleSq (posts) and poleSqPl, sign2SqPlSq, ltsSign1SqPl (square plate): BP accepts, column and plate arrive as sent (b along x, d along y), no blocking message, combination 1 converted exactly, finite D/C, chips none → ok → stale. On origin/main sign2Sq is refused with the engineer's message.
- `node tests/smoke/lightpole-signviews.mjs` (cases ibc2sqpl, lts1sqpl added): ALL PASS (sheets, DXF valid, no overlaps, 3D renders, 1280 / 390 px).
- `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: results identical in all 16 cases except the two added inputs `inp.bpShape` / `inp.bpB`; cable values identical; text and drawings identical.
- `node tests/engine/run.mjs lightpole` 41 passed; `node tests/check-syntax.mjs` all pass.
- **Open item (engineer):** for a rectangular post this tool takes D = the width along y (`poleDiaBase`), the Anchorage app D = min(width, depth); and for a square plate the Anchorage app uses AISC DG1, not the bending line. Which should govern? (No change made; both are stated in the payload notes.)

## 2026-11-02 — PR #671 (https://github.com/mlococo88/All-Structural/pull/671): claude/lts-spec-verify (LTSV: four LRFDLTS items checked against the PDFs; Eq. 5.12.1-1 form corrected; IBC sign Summary Broms takes the shaft's B₂-amplified demands)

Basis: AASHTO LRFDLTS 1st Ed. (2015) with the 2017 Interim Revisions (the interims override). Both PDFs were read for each item (base pp. 3-23, 3-24, 5-14, 5-16, 5-28, 5-33; 2017 interim pp. 5-33 to 5-35). The interim's Section 3 pages are 3-17, 3-19 and 3-21 only, and its Section 5 pages are the notation and 5-33 to 5-35, so Art. 3.9.3, Table 5.7.2-1 and Art. 5.10.2.3 are as in the base edition.

### LTSV-1. Table 3.9.3-1 wind load cases (sign "20 % transverse")   [verified, no change]
- **Spec:** Art. 3.9.3 and Table 3.9.3-1 (base p. 3-24; not revised by the 2017 interim) give three cases: (1) 1.0·BL_n + 0·BL_t, (2) 0·BL_n + 1.0·BL_t, (3) 0.75·BL_n + 0.75·BL_t. BL_n / BL_t are W_v, W_l, W_p and W_h all applied normal / transverse to the plane of the structure. Non-symmetrical single roadside sign supports are designed for both components. There is **no 20 % transverse case** in this edition (a text search of both PDFs finds none); the independent audit's recollection is from an earlier specification.
- **Tool:** `LOAD_CASES` in `apps/light-pole/lts-engine.js` (anchor `{ key: 'd45', name: 'Case 3: 0.75 (0°) + 0.75 (90°)'`) runs exactly these, both senses, for poles and signs; a wind along y sees the panel edge only (no panel area), so cases 2 and 3 load the sign post with its own transverse wind. Matches. No change.

### LTSV-2. Eq. 5.12.1-1, combined forces when T_u/T_r > 0.20   [bug] [§4 result change, LRFDLTS mode only]
- **Spec:** Art. 5.12.1, Eq. 5.12.1-1 (base p. 5-33; the 2017 interim reprints p. 5-33 with the same equation): P_u/P_r + BM_u/M_r + (V_u/V_r + T_u/T_r)² ≤ 1.0. Only the shear + torsion sum is squared (the same form as AISC 360 Eq. H3-6). The independent audit's recollection was right; the plan doc's row M10 was not.
- **Where:** `interaction(d)` in `apps/light-pole/lts-engine.js`, anchor `if (d.Tr > 0.20) return { eq: '5.12.1-1'`; and the worked-step TeX in `memberSteps`, anchor `const eqT = gv.eq === '5.12.1-1'`.
- **Before:**
  ```js
  if (d.Tr > 0.20) return { eq: '5.12.1-1', ratio: pr + (d.BMr + d.Vr + d.Tr) ** 2 };
  const eqT = gv.eq === '5.12.1-1' ? '\\frac{P_{u}}{P_{r}} + \\left(\\frac{BM_{u}}{M_{r}} + \\frac{V_{u}}{V_{r}} + \\frac{T_{u}}{T_{r}}\\right)^{2}' : ...
  ```
- **After:**
  ```js
  if (d.Tr > 0.20) return { eq: '5.12.1-1', ratio: pr + d.BMr + (d.Vr + d.Tr) ** 2 };   // only the shear + torsion sum is squared (LTSV-2)
  const eqT = gv.eq === '5.12.1-1' ? '\\frac{P_{u}}{P_{r}} + \\frac{BM_{u}}{M_{r}} + \\left(\\frac{V_{u}}{V_{r}} + \\frac{T_{u}}{T_{r}}\\right)^{2}' : ...
  ```
- **Effect:** with a = BM_u/M_r and s = V_u/V_r + T_u/T_r, before − after = a(a + 2s − 1). The old form was conservative when a + 2s > 1 and unconservative when a + 2s < 1 (e.g. a = 0.50, s = 0.21: before 0.534 + P/P_r term, after 0.574). Only members with T_u/T_r > 0.20 use this equation (typically single-post roadside signs with the 0.15b torsion); Eqs. 5.12.1-2 and -3 are unchanged.
- **Check case 1 (engine unit test):** P_u/P_r = 0.1, BM_u/M_r = 0.5, V_u/V_r = 0.1, T_u/T_r = 0.3. Before: 0.1 + (0.5 + 0.1 + 0.3)² = 0.1 + 0.81 = **0.910**. After: 0.1 + 0.5 + (0.1 + 0.3)² = 0.1 + 0.5 + 0.16 = **0.760**.
- **Check case 2 (compare case `ltssign1`: LRFDLTS, single-post sign, V = 115 mph; post Ø6.000 × 0.1875 in, base, Extreme I (DC max), Case 1 normal):** P_u/P_r = 0.0321, BM_u/M_r = 1.5869, V_u/V_r = 0.0630, T_u/T_r = 0.2049 (> 0.20). Before: 0.0321 + (1.5869 + 0.0630 + 0.2049)² = 0.0321 + 1.8548² = **3.472**. After: 0.0321 + 1.5869 + (0.0630 + 0.2049)² = 0.0321 + 1.5869 + 0.0718 = **1.691**. NOT OK either way (the case is deliberately overstressed).
- **Other copies:** none (the IBC mode uses AISC H1/H3, unchanged). `docs/lts-mode-plan.md` row M10 corrected with a note.

### LTSV-3. Square / rectangular tube λ_r and the effective-width coefficient   [verified, no change]
- **Spec:** Table 5.7.2-1 (base p. 5-14; not revised by the 2017 interim), row "Flanges of Square/Rectangle", b/t: λ_p = 1.12√(E/F_y), λ_r = 1.53√(E/F_y) (one value, used for flexure and compression), λ_max = 2.14√(E/F_y). Art. 5.10.2.3, Eq. 5.10.2.3-2 (base p. 5-28): b_e = 1.92t√(E/f)[1 − 0.34/(b/t)·√(E/f)] ≤ b, f = F_cr at Q = 1. The coefficient is **0.34** (AISC 360-10 Eq. E7-18 uses 0.38 for HSS walls; LRFDLTS does not).
- **Tool:** `classify()` (anchor `lp: 1.12 * r, lrF: 1.53 * r, lrC: 1.53 * r, lmax: 2.14 * r`) and the effective width in `compression()` (anchor `1.92 * sec.t * Math.sqrt(E / f1) * (1 - 0.34 /`). Match. No change.

### LTSV-4. IBC sign mode: the Summary's Broms reference check left out B₂   [bug] [§4 result change, IBC sign mode, Broms reference only]
- **Where:** the sign branch of `calc()`, `renderSummary({inp, mode:'sign', ...})`, anchor `broms:bromsEmbedment(inp, pd.`.
- **Problem:** the Summary (and the summary stack read by the printed report's Broms row) called `bromsEmbedment(inp, pd.gLRFD.M/1000, pd.gLRFD.P/1000)`: the first-order moment of the max-moment LRFD combination. The shaft is designed for `M·B₂` (the sibling `designFoundationStack(...)` call passes `{M:gLRFD.M*(gLRFD.B2||1)}`), and the Shaft tab's Broms check (`populateDetailStack` → `bromsEmbedment(inp, Mu/1000, Vu/1000)`) and the report's per-post Broms (`bromsEmbedment(inp, F.Mu/1000, F.Vu/1000)`) use the shaft's `found.Mu` / `found.Vu`. So the Summary showed a different, slightly shorter Broms L than the Shaft tab for the same post (unconservative, reference value only; the IBC §1807.3 embedment that governs the design is not affected).
- **Before:** `broms:bromsEmbedment(inp, pd.gLRFD.M/1000, pd.gLRFD.P/1000)}))});`
- **After:** `broms:bromsEmbedment(inp, pd.found.Mu/1000, pd.found.Vu/1000)}))});   // the shaft's B₂-amplified M_u and V_u, as the Shaft tab and report (LTSV-4)`
- **Governing provision:** LRFDLTS C13.6.1.1 (Broms, reference check; base edition, not revised by the 2017 interim). M_F, V_F are the factored groundline demands; the tool takes them as the shaft's LRFD demands with the AISC 360-16 App. 8 B₂ the tool applies to the post moment (no formula changes; only which demand is passed).
- **Check case (compare case `signbroms1`: IBC sign, one post, defaults, cohesive c = 1.0 ksf, D = 3.0 ft):** V_F = 2.927 kip (unchanged), M_F,1st = 37.368 kip·ft, B₂ = 1.02191 → M_F = 38.186 kip·ft. q = V_F/(9cD) = 2.927/27 = 0.10841 ft. Before: H = 37.368/2.927 = 12.766 ft, L = 1.5D + q[1 + √(2 + (4H + 6D)/q)] = 4.5 + 0.10841·(1 + √(2 + 69.065/0.10841)) = 4.5 + 0.10841·26.280 = **7.349 ft** (Summary 7.35 ft, while the Shaft tab showed 7.37 ft). After: H = 13.046 ft, L = 4.5 + 0.10841·(1 + √(2 + 70.184/0.10841)) = 4.5 + 0.10841·26.483 = **7.371 ft** (Summary = Shaft tab = 7.37 ft). `signbroms2` (two posts, cohesionless, φ 30°, γ 0.115): 4.88 → 4.90 ft per post (V_F there is the largest LRFD shear, as on the Shaft tab).
- **Other copies:** the light-pole branch passes `govLRFD.M/P` (first order) to all three of its Broms calls (Summary, Shaft tab, report); consistent with each other, not changed (open item below).

### How verified
- `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves` (18 cases; `signbroms1`, `signbroms2` added to the harness for LTSV-4): every case identical except `ltssign1` (the combined-forces ratio and TeX, LTSV-2) and `signbroms1/2` (the Summary Broms, LTSV-4). **Cable values identical** in every case that has cables (1437 / 699 / 330 numbers); drawings identical; no console errors.
- `node tests/engine/run.mjs lightpole`: 41 passed (the Eq. 5.12.1-1 unit test now expects 0.76). `node tests/check-syntax.mjs`: all pass. `node tests/smoke/lightpole-anchor-handoff.mjs`: ALL PASS.

### Open items (engineer)
- **Light-pole IBC mode Broms demand:** the light-pole branch feeds Broms the first-order `govLRFD.M` while its shaft uses `M·B₂`. Should Broms (reference only) use the B₂-amplified moment there too, as the sign branch now does? Not changed.
- Not in this task's scope and not re-checked against the PDF: the square-tube M_n step just past λ_r noted by the audit (Table 5.8.2-1).

## 2026-11-02 — PR #675 (https://github.com/mlococo88/All-Structural/pull/675): claude/lp-broms-b2-sqmn (LPB2: light-pole IBC Broms takes the shaft's B₂-amplified demands; square-tube M_n step at λ_r verified)

Engineer's answers to the two open items of PR #671 (LTSV).

### LPB2-1. Light-pole IBC mode: Broms reference check with the B₂-amplified M_u and V_u   [engineer decision] [§4 result change, IBC light-pole mode, Broms reference only]
- **Engineer (2026-11-02):** Broms (Summary, Shaft tab, report) must use the B₂-amplified moment and shear, as the shaft design and the sign mode (LTSV-4) do.
- **Where (all in the light-pole branch of `calc()` and in `buildReport()`):**
  - Shaft tab, anchor `renderBromsExample(bromsEmbedment(inp,`: before `renderBromsExample(bromsEmbedment(inp, govLRFD.M/1000, govLRFD.P/1000), inp, govLRFD, Mu);` → after `renderBromsExample(bromsEmbedment(inp, Mu/1000, Vu/1000), inp, {name:shaftGov.name||govLRFD.name}, Mu);`
  - Summary, anchor `broms:bromsEmbedment(inp, govLRFD`: before `broms:bromsEmbedment(inp, govLRFD.M/1000, govLRFD.P/1000)}]});` → after `broms:bromsEmbedment(inp, Mu/1000, Vu/1000)}]});`
  - Report §, anchor `// D11: the Shaft tab's reference check, same call`: before `bromsEmbedment(inp, govLRFD.M/1000, govLRFD.P/1000)` with `bromsWorkedHTML(br,inp,govLRFD,struct.Mu)` → after `bromsEmbedment(inp, struct.Mu/1000, struct.Vu/1000)` with the shaft's governing combination name (`struct.reo.long.govDem.name`, else `govLRFD.name`).
  - `bromsWorkedHTML()` step 2 text (both modes), anchor `the same demands that drive the reinforced-concrete shaft design`: now adds that M_F is the shaft's M_u including the B₂ of that combination (AISC 360-16 App. 8; see the shaft P–M design) and V_F is the largest LRFD base shear (the shaft's V_u). Wording only.
- **Demands:** `Mu` = `shaftGov.Mu`, the governing P–M demand of the shaft (each LRFD combination's M × its B₂). `Vu` = `VuMax`, the largest LRFD base shear. These are the same objects the shaft's rebar design, its worked steps and `struct` use.
- **Governing provision:** LRFDLTS 1st Ed. (2015) C13.6.1.1 (Broms; M_F and V_F are the factored groundline demands), not revised by the 2017 interim. No formula change; only the demand passed. B₂ is the tool's AISC 360-16 App. 8 amplifier, unchanged.
- **Check case (compare case `broms`: default light pole, cohesive c = 1.2 ksf, D = 3.0 ft, LRFD 1.2D + 1.0W):**
  - Inputs: V_F = 0.8336 kip (unchanged); M_F,1st = 20.179 kip·ft; B₂ = 1.03379, so M_F = 20.861 kip·ft. q = V_F/(9cD) = 0.8336/32.4 = 0.025728 ft.
  - Formula: L = 1.5D + q[1 + √(2 + (4H + 6D)/q)].
  - Before: H = 24.208 ft, L = 4.5 + 0.025728·(1 + √(2 + 114.83/0.025728)) = 4.5 + 0.025728·67.822 = **6.245 ft**. Maximum moment M_u = 23.94 kip·ft.
  - After: H = 25.026 ft, L = 4.5 + 0.025728·(1 + √(2 + 118.10/0.025728)) = 4.5 + 0.025728·68.767 = **6.269 ft**. Maximum moment M_u = 24.62 kip·ft.
  - Summary, Shaft tab and report each go from 6.24 to 6.27 ft. The IBC §1807.3 embedment that governs the design is unchanged.
- **Other copies:** the sign branch already did this (LTSV-4, #671). The LRFDLTS mode applies B to M_F in its own Broms (`bromsEmbedment(inp,B*r.M/1000,r.V/1000)`), unchanged.

### LPB2-2. Square / rectangular tube M_n step just past λ_r (Table 5.8.2-1)   [verified, no change]
- **Spec:** LRFDLTS 1st Ed. (2015), Art. 5.8.2 and Table 5.8.2-1 (p. 5-18), row "Square and Rectangular". The 2017 interim does not revise pp. 5-17 to 5-19; its Section 5 pages are the notation and 5-33 to 5-35. The row gives, with k = (b/t)/√(E/F_y):
  - compact (λ ≤ λ_p): M_n = M_p = Z F_y;
  - noncompact (λ_p < λ ≤ λ_r): M_n = M_p(1.37 − 0.33k);
  - slender (λ > λ_r): M_n = M_p(1.23 − 0.23k);
  - λ_p = 1.12√(E/F_y) and λ_r = 1.53√(E/F_y) (Table 5.7.2-1, p. 5-14).
- **Tool:** `mnOf()` in `apps/light-pole/lts-engine.js`, anchor `Mp * (1.37 - 0.33 * k)` / `Mp * (1.23 - 0.23 * k)`, boundary `l <= cl.lrF`. This is the table as printed. No change.
- **Why the step exists:** the two printed expressions are separate straight lines. They cross at 1.37 − 0.33k = 1.23 − 0.23k, i.e. k = 0.14/0.10 = **1.40**. That is not the table's λ_r of 1.53, so the curve is discontinuous at λ_r. Between k = 1.40 and 1.53 the noncompact line lies below the slender line, so the tool is conservative there by following the table. Just past λ_r, M_n steps up by about 1.5 %. The step comes from the printed table, not from the tool.
- **Hand check (F_y = 50 ksi, √(E/F_y) = √580 = 24.083; values as fractions of M_p):**

  | k | λ = b/t | Formula | M_n/M_p |
  |---|---|---|---|
  | 1.40 | 33.72 | noncompact | 0.9080 (both lines meet) |
  | 1.53 (= λ_r) | 36.85 | noncompact | 1.37 − 0.5049 = **0.8651** |
  | 1.5301 | 36.85 | slender | 1.23 − 0.3519 = **0.8781** |

  The step at λ_r is 0.8781/0.8651 = 1.015. `mnOf()` in Node gives 0.90800, 0.86510 and 0.87808 at these points.
- **Open item (engineer, not changed):** Art. 5.8.2 (p. 5-17) also caps M_n of multi-sided tubes at M_n of a round tube of equivalent diameter (the outside distance between parallel sides). The tool has no 8-, 12- or 16-sided shapes. Square tubes have their own row in Table 5.8.2-1, and the tool does not apply this cap to them. Should a square tube be treated as "multi-sided" for this cap?

### How verified
- `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves` (18 cases):
  - Every case is identical except `broms`: the light-pole Broms in the Summary, Shaft tab and report, 6.24 → 6.27 ft.
  - The sign cases `signbroms1/2` change only the step-2 wording on the Shaft tab.
  - **Cable values identical** in all 11 cases with cables; drawings identical; no console errors.
- `node tests/engine/run.mjs lightpole`: 41 passed. `node tests/check-syntax.mjs`: all pass.

## 2026-11-02 — PR: [#680](https://github.com/mlococo88/All-Structural/pull/680) — PLIB: saved-project list (Open / Rename / Duplicate / Delete) and Undo / Redo   [display and storage only]
- **Before:** project bar: drop-down (load), Save / Save As… / Rename / Delete / New (`lpp_projects_v1`, `{ name: captureState() }`), Export /
  Import JSON. No duplicate, no undo.
- **Where:**
  - after `<script src="shared/dxf.js"></script>…`: `<script src="shared/projects.js"></script>` and `<script src="shared/projects-ui.js"></script>`.
  - `markDirty()`: after `scheduleAutosave();` added `if(window.LPPL) LPPL.soon();` (debounced 400 ms: typing a number is one step).
  - an IIFE before `// ---- JSON export / import (added 2026-11-01) ----` (anchor `// ---- PLIB (2026-11-02)`): history over
    `JSON.stringify(captureState())`, `set` = `applyState()` (the project-load path, migrations included) then marked changed;
    `mapStore(localStorage, LS_PROJECTS)`; dialog `open` = the drop-down's load (asks first when there are unsaved changes);
    rename / delete of the active project update `activeProject` and the session; the drop-down is redrawn after every change.
    Buttons Undo, Redo, Saved projects… before Export JSON. The history starts again after the page's load event.
- **Saved data:** keys `lpp_projects_v1`, `lpp_session_v1` and their formats unchanged; no new key.
- **How verified:** `node tests/smoke/project-library.mjs --tool lightpole`: ALL PASS (`LPP_LAST`, the report-builder arguments with every
  computed result, identical to origin/main on load, after an input change (V +10 mph), reopened on main's storage and opened from the
  dialog; Undo / Redo / Ctrl+Z / Ctrl+Y exact; dialog byte-identical; quota; 390 px; no new console errors).
  `node tests/lightpole-compare.mjs`: ALL CASES IDENTICAL. `node tests/check-syntax.mjs`: pass.
- **Formulas, factors, units, code references:** none changed (§4 does not apply).
- **Entered demands:** not applicable: the tool's demands are its wind / ice / cable loads, all from entered inputs; the foundation and
  anchorage take the governing reactions it computes (the Anchorage app takes them through the anchorGroup hand-off). Nothing added.

## 2026-11-03 — PR: [#743](https://github.com/mlococo88/All-Structural/pull/743) (LTS-L1: input layout of the LRFDLTS mode)   [display only, no result change]
- **Problem:** in the LRFDLTS mode the "Wind & site" input tab held inputs that belong elsewhere: tube corner ratio r_s and inside corner radius r_i, the pole-to-base-plate weld, and atmospheric ice. The other tabs showed inputs that the LRFDLTS run never reads: the ASCE 7 C_f rows and notes, the fixture ice columns, the IBC soil class / S₁ / q_a / isolated 2× / constraint, and the anchor and splitting reinforcement. Risk category was shown in sign mode, where it has no effect: a roadside sign takes the 10-yr MRI (Table 3.8-1 note; `LpLts.mri()`). The engineer approved the layout of the review on 2026-11-03.
- **Mechanism:** the existing classes `ibcOnly` (hidden in the LTS mode) and `ltsOnly` (hidden in the IBC mode). No input is deleted, renamed or recreated; ids are unchanged; nodes are moved, not cloned.
- **Where / before → after (anchor texts):**
  - `#ltsCard`: the rows of `ltsRs`, `ltsRi`, `ltsWeldType`, `ltsWeldW`, `ltsFexx` and `ltsIce` are removed from the card; their row markup is otherwise unchanged. The risk row gets `id="rowLtsRisk"`: `<div class="row"><label>Risk category` → `<div class="row" id="rowLtsRisk"><label>Risk category`.
  - Pole card, after the `poleShape` select (anchor `</select></div></div>` before `id="rowFixCf"`): the r_s / r_i rows, as `<div class="row ltsOnly" id="rowLtsRs">` / `<div class="row ltsOnly" id="rowLtsRi">`.
  - Anchors card, after the `bpT` row: the weld rows, as `<div class="row ltsOnly">` (type), `<div class="row ltsOnly" id="rowLtsWeldW">`, `<div class="row ltsOnly" id="rowLtsFexx">`.
  - New card before the Shaft & soil card: `<section class="card ltsOnly" id="ltsIceCard">` ("5 Atmospheric ice", hint "LRFDLTS Art. 3.7") holding the `ltsIce` row unchanged.
  - `class="row"` → `class="row ibcOnly"` on: `rowFixCf`; the `cfPoleMode` row; `rowCfPoleSurf`; `rowCfPoleMan`; the `signCfMode` row; `rowSignCfMan`; the `soilClass`, `S1`, `qAllow`, `segIso`, `segCon` rows; the anchor reinforcement row and the three `arRow` rows (`row arRow` → `row arRow ibcOnly`); the splitting reinforcement row. `class="tbl-note"` → `class="tbl-note ibcOnly"` on `lppCfNote`, `cfMigNote`, `signCaseNote` and `soilClassNote`.
  - Fixture table: `<th>Ice area…</th><th>Ice depth…</th>` → `<th class="ibcOnly">…`; in `renderFixtures()` the `aIce` / `tIce` cells `` `<td><input … data-k="aIce"`` → `` `<td class="ibcOnly"><input … data-k="aIce"`` (same for `tIce`).
  - Sign card hint: `<span class="hint">ASCE 7 Ch.29 solid sign</span>` → `<span class="hint"><span class="ibcOnly">ASCE 7 Ch.29 solid sign</span><span class="ltsOnly">LRFDLTS Table 3.8.7-1 sign panel</span></span>`.
  - Post spacing note: adds `<span class="ltsOnly">; LRFDLTS mode: drawings only, each post carries half the panel load (decision Q-C2)</span>` inside the existing note (the LTS engine splits the loads 1/nPost; `signSpacing` feeds only the sign drawings, the 3D view and the geometry card).
  - Clear cover note: `<span class="note">3 in for cast-against-earth (ACI §20.5.1.3)</span>` → `<span class="note"><span class="ibcOnly">3 in for cast-against-earth (ACI §20.5.1.3)</span><span class="ltsOnly">3 in minimum, LRFDLTS Art. 13.6.2.1 (ACI 318-19 §20.5.1.3)</span></span>` (LRFDLTS 1st Ed. (2015) Art. 13.6.2.1 sets a 3 in minimum cover for drilled shafts; checked in the PDF).
  - `lppApplyCode()`: after the `rowLtsAdt` line, `const rr=$('rowLtsRisk'); if(rr) rr.style.display=sign?'none':'';`.
  - `applyShapeUI()`: calls the new `lppApplyLtsRowsUI()` at its end. That function shows `rowLtsRs` / `rowLtsRi` for a square or rectangular section only and `rowLtsWeldW` / `rowLtsFexx` for a fillet weld only; a `change` listener on `ltsWeldType` calls it.
  - `LPP_IN_CARD`: `['tIce','ice'],['shaftShape','shaft']` → `['tIce','ice'],['ltsIce','ice'],['shaftShape','shaft']`.
  - `lppInTabsSync()`: in the LTS mode the `wind` tab is labelled "Criteria & site" and the `anchors` tab "Base & anchors" (IBC: "Wind & site", "Anchors", as before). The seven tab keys are unchanged.
- **Resulting LTS tabs (sign mode):** Criteria & site (source of V, V, V_svc, clear zone; pole mode also risk and ADT) · Post & sign (r_s / r_i for square/rect) · Ice (atmospheric ice) · Shaft & soil · Base & anchors (rods, base plate, base weld). Pole mode also Fixtures (without the ice columns) and Cables (note).
- **Saved data:** none changed. `captureState()` reads every `INPUT_IDS` value and the segment variables whatever their visibility, so values hidden in one mode are kept and reappear in the other. Keys `lpp_projects_v1`, `lpp_session_v1`, `lpp_inputTab_v1` unchanged.
- **Formulas, factors, units, code references in results:** none changed (§4 does not apply). The IBC mode shows the same inputs and labels as before.
- **How verified:** `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: all cases identical (results, tab text, cable values, drawings, no console errors). `node tests/engine/run.mjs lightpole`, `node tests/smoke/lightpole-anchor-handoff.mjs`, `node tests/check-syntax.mjs`: pass. Headless render of each input tab in LTS pole, sign 1-post and sign 2-post: rows as listed above; r_s / r_i appear only for square, weld size / F_EXX hide for CJP, risk category hides in sign mode; IBC tabs and rows unchanged.
- **Open items (not built):** handhole input (plan §3.3 "Base weld & handhole"); leveling-nut standoff (sent to the Anchorage app as 0 in both modes).

## 2026-11-03 — PR: [#744](https://github.com/mlococo88/All-Structural/pull/744) (LTS-L2: input checks by code mode; Broms is the LTS design method)   [behaviour change: when results are shown; no formula change]
- **Problem:** the check that runs before every calculation (`lppInputErrors()`) tested the IBC-only fields (V, β, S₁, q_a) in both modes. In the LRFDLTS mode these are hidden (LTS-L1), so a blank hidden value blocked the LTS results with an error naming a field the user could not see. It tested no LTS input: a blank V or V_svc ran as NaN, and a blank weld size or F_EXX fell back silently to 0.3125 in / 70 ksi. With the Broms soil model at "Not evaluated" the LTS run showed member checks but no foundation, hand-off or sign drawings, and the Broms panel was labelled "reference only".
- **Where / before → after:**
  - `lppInputErrors()`: `pos(inp.V,'Basic wind speed V'); if(!(inp.beta>0)) …` → the same two checks inside `if(!lts){ … }` (`lts=codeMode==='lts'`). `pos(inp.S1,…); pos(inp.qAllow,…)` → inside `if(!lts){ … }`. The IBC mode checks exactly as before.
  - New `lppLtsInputErrors(inp)` (before `lppShowInputErrors`). It requires ltsV > 0 and ltsVsvc > 0; for a fillet weld (not CJP) ltsWeldW > 0 and ltsFexx > 0; and a Broms soil model other than "none". Its message: "Broms soil model (Shaft & soil): choose Cohesive or Cohesionless. In the LRFDLTS mode the shaft embedment is designed by Broms (Art. 13.6.1.1)."
  - `lppCalcIbc()`, anchor `const errs=lppInputErrors(inp)`:
    - before: `{ const errs=lppInputErrors(inp); lppShowInputErrors(errs); if(errs.length) return; }`
    - after: `{ const errs=lppInputErrors(inp), le=(codeMode==='lts')?lppLtsInputErrors(inp):[]; lppLtsBlocked=le.length>0; lppShowInputErrors(errs.concat(le)); if(errs.length) return; }`
    - An LTS-only error does **not** stop the IBC engine underneath, so its cable values are unchanged (hard rule: nothing cable-related changes).
  - `ltsCalc()`: `const inp=lppLastInp;` → `const inp=lppLtsBlocked?null:lppLastInp;`. `ltsAnchorPayload()`: `const inp=lppLastInp, X=lppLtsLast;` → `const inp=lppLtsBlocked?null:lppLastInp, X=lppLtsLast;`. While an LTS input is in error, no LTS result is shown or sent.
  - Broms panel (`#bromsPanel`):
    - the header becomes ibcOnly "Broms reference check … reference only" plus ltsOnly "Broms embedment — design method, LRFDLTS Art. 13.6.1.1, C13.6.1.1 [required]";
    - a new ltsOnly note says the panel is required and asks for cohesive or cohesionless with the geotechnical parameters;
    - the old "Optional…" note becomes ibcOnly.
  - New `lppBromsPanelPlace(lts)`, called at the end of `lppApplyCode()`. In the LTS mode it moves `#bromsPanel` to the top of the Shaft & soil card; in the IBC mode it puts it back before the "Isolated 2×" row. The node is moved, so ids and values are unchanged.
  - `lppInputTabMarks()`: an input inside an element hidden by the code mode (`ibcOnly` in LTS, `ltsOnly` in IBC) no longer puts a red dot on its tab.
  - `docs/lts-mode-plan.md` §3.1: the `ltsIce` row said "density 57 pcf". It now says 56 pcf, with a dated note. The engine has always used 56 pcf (`ICE_DEN`), and the engineer decided on 2026-11-03 to keep it. No result change.
- **Governing provision:** LRFDLTS 1st Ed. (2015) Art. 13.6.1.1 / C13.6.1.1 (Broms, the LTS embedment method of the tool, plan G1). No formula, factor or reference in a result changed.
- **Check case:**
  - Default project in the LTS mode, Broms soil model "Not evaluated":
    - before: the LTS member, deflection and base-plate cards were shown, the foundation card asked for the soil model, and the hand-off and sign drawings were unavailable;
    - after: the input error box shows the Broms message and no LTS results are shown.
  - The same project with Cohesive c = 1.0 ksf: every LTS result (base actions, member checks, Broms L, cage, base plate, weld, deflection, Anchorage payload, report text) is identical to before. This was compared in the page for pole/cohesive, sign 1-post/cohesionless and sign 2-post/cohesive.
  - LTS mode with the hidden IBC fields V = blank, β = blank, S₁ = 0, q_a = 0:
    - before: blocked by an error on hidden fields;
    - after: the LTS results are shown, with no page error.
  - LTS mode with V_svc = 0 and fillet w blank: an input error names both; with CJP, w and F_EXX are not checked.
- **Saved data:** unchanged. A saved LTS project with "Not evaluated" opens with the Broms input error until a soil model is chosen. No value is rewritten.
- **How verified:**
  - `node tests/lightpole-compare.mjs --a claude/lts-input-layout` and `--old-saves`:
    - results identical in all 18 cases;
    - **cable values identical** in all 11 cases with cables;
    - drawings identical; no console errors.
    - Text differs only in the two LTS cases (`ltspole`, `ltssign1`, both "Not evaluated"), whose LTS cards are now replaced by the input error.
  - `node tests/engine/run.mjs lightpole`: 41 passed. `node tests/smoke/lightpole-anchor-handoff.mjs`: ALL PASS. `node tests/check-syntax.mjs`: all pass. Screenshots of each LTS sign-mode input tab were reviewed.
- **Open items (not built):** handhole input; leveling-nut standoff (sent as 0). Possible follow-up: also check the Broms parameters (c > 0, or φ and γ > 0) for the chosen model.

## 2026-11-03 — PR: [#745](https://github.com/mlococo88/All-Structural/pull/745) (LTS-L3: LRFDLTS input check also requires the Broms parameters)   [behaviour change: when results are shown; no formula change]
- **Problem:** after LTS-L2 the LRFDLTS mode required a Broms soil model but not its parameters. Cohesive with c = 0, or cohesionless with φ or γ blank or 0, gave no input error. `bromsEmbedment()` then returned null: no embedment, no Anchorage hand-off, and only a "select the Broms soil model" note.
- **Where:** `lppLtsInputErrors()`, anchor `if(!inp.bromsSoil||inp.bromsSoil==='none') e.push(`.
  - Before: that line only.
  - After: that line, then
    ```
    else if(inp.bromsSoil==='cohesive') pos(inp.bromsC,'Broms undrained shear strength c');
    else { pos(inp.bromsPhi,'Broms friction angle φ'); pos(inp.bromsGam,'Broms effective unit weight γ'); }
    ```
- **Governing provision:** LRFDLTS 1st Ed. (2015) C13.6.1.1 (Broms: c for cohesive soil; φ and γ for cohesionless soil). No formula changed.
- **IBC mode:** unchanged; `lppLtsInputErrors()` runs only in the LRFDLTS mode. An LTS-only error stops only the LTS run, so the IBC engine and its cable values are unchanged (LTS-L2).
- **Check case (default project, LTS mode):**

  | Inputs | Before | After |
  |---|---|---|
  | cohesive, c = 0 | no error, no embedment | error "Broms undrained shear strength c must be greater than 0." |
  | cohesive, c = 1.0 ksf | results | results, unchanged |
  | cohesionless, φ blank, γ = 0 | no error, no embedment | errors on φ and γ |
  | cohesionless, φ = 30°, γ = 0.115 k/ft³ | results | results, unchanged |

  IBC mode with the same values: no error, as before.
- **How verified:**
  - `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: ALL CASES IDENTICAL (18 cases; cable values identical in all 11 cable cases).
  - `node tests/engine/run.mjs lightpole`: 41 passed. `node tests/smoke/lightpole-anchor-handoff.mjs`: ALL PASS. `node tests/check-syntax.mjs`: all pass.
  - Headless gate test of the rows above.

## 2026-11-03 — PR: [#746](https://github.com/mlococo88/All-Structural/pull/746) (LPPJ: shaft projection above grade p, both code modes)   [§4: new input; formula change at grade when p > 0; p = 0 identical]
- **Engineer's decisions (2026-11-03):** a new input p (ft), the height of the shaft top (base plate) above grade; default 0. In both modes:
  1. Foundation actions at grade: M_F = B·M_base + V_base·p + M_shaftwind, V_F = V_base + V_shaftwind; B (second-order factor) on the pole / post base moment only; used for Broms (H = M_F/V_F), the IBC §1807.3 embedment (P, h), the shaft design, bearing and the drawings. Base plate and anchors keep the actions at the top of the shaft.
  2. The pole / post, fixtures and sign are raised by p for K_z / q_z (IBC) and K_z (LTS). Cables are not raised (heights from the pole base, as before; noted in the steps as slightly unconservative when p > 0).
  3. Sign: clearance from grade; steel post = clr + s − p (length, weight, checks, deflection); input error if p ≥ clearance.
  4. Wind on the exposed shaft b × p at p/2 (q_z at p/2): IBC ASCE 7-22 §29.4 / Fig. 29.4-1, round = "rough" row, square = square row, the pole's K_d; LTS Table 3.8.7-1, round = cylindrical row at C_v·V·b, square = 2.0, following the Table 3.9.3-1 load cases (0.75 diagonal parts). Each combination's wind factor; IBC ice combinations: ice weight and wind on ice on the projection.
  5. Projection weight with the dead-load factor of each combination (IBC 1.2 / 0.9 LRFD, 1.0 / 0.6 ASD; LTS 1.25 / 1.1 / 0.9).
  6. Anchorage hand-off pier depth = embedment + p.
- **Implementation choices (to confirm, see open items):** γ_c = 150 pcf (AASHTO LRFD 10th Ed. Table 3.5.1-1, 0.145 kcf for f′c ≤ 5 ksi, + 0.005 kcf for reinforcement per C3.5.1; checked in the PDF); the design ice thickness t_d(z) (map basis, ASCE 7-22 §10.4.6) is also taken at z + p for the pole / post / fixtures / sign posts (it is a height above grade like K_z); the IBC flexible gust factor G_f keeps h = pole height H; each combination's grade demand is the wind direction with the largest M_F (IBC; B₂ of that direction for LRFD); square shaft ice area 4·b·t_d + π·t_d².
- **Where (page, `Light Pole and Sign Post.html`):**
  - Input: Shaft & soil card, after the `b` row: `<div class="row"><label>Shaft projection above grade, p…<input id="shaftProj" type="number" value="0" step="0.25" min="0">…ft`. No ibcOnly/ltsOnly class (both modes).
  - `INPUT_IDS`: `…,'ltsFexx','ltsRi'];` → `…,'ltsFexx','ltsRi','shaftProj'];`. `applyState()`, after the damping comment: `if($('shaftProj') && (!st.inputs || st.inputs.shaftProj===undefined)) $('shaftProj').value='0';` (old saves → 0: identical results; no migration notice needed).
  - `lppCalcIbc()`, after the `inp` literal: `if($('shaftProj') && num('shaftProj')>0) inp.pProj=num('shaftProj');` (p = 0: no field on `inp`). Sign: after `inp.H = inp.signClr + inp.signS;` add `if(inp.pProj>0) inp.H = inp.signClr + inp.signS - inp.pProj;` and the `oSignHt` text shows "− p".
  - `lppInputErrors()`: sign branch `if(inp.pProj>0 && inp.signClr>=0 && inp.pProj>=inp.signClr) e.push('Shaft projection p (…) must be less than the clearance …')`; both modes `if($('shaftProj') && num('shaftProj')<0) e.push('Shaft projection above grade p must be 0 or more.')`.
  - New `lppZg(inp,z)` after `Kz()`: `inp.pProj>0 ? z+inp.pProj : z`. Used (before → after): `cfPoleFig2941` `Kz(zq,…)` → `Kz(lppZg(inp,zq),…)` (+ `out.zg` when p > 0, shown in `cfPoleWorkedHTML`); `poleWindNominal` `Kz(inp.H,…)`, `Kz(inp.H/2,…)`, strip `Kz(z,…)`, `iceTd(inp,z)`, `tdTop:iceTd(inp,inp.H)` → each with `lppZg(inp, ·)`; `fixtureComponents` `Kz(x.hf,…)`, `iceTd(inp,x.hf)` → `lppZg`; `iceWorkedHTML` and the `iceNote` text at the raised heights (label `H{+}p` when p > 0). `cableComponents` is not touched.
  - `signWind()`: `postExpH=Math.max(0,clr)` → `Math.max(0,inp.pProj>0?clr-inp.pProj:clr)`; `qzMidPost` at `Kz(lppZg(inp,postExpH/2))`; post strips `Kz(z)` / `iceTd(inp,st.z)` / `Kz(st.z)` → `lppZg`; `zPost` fallback `clr/2` → `postExpH/2`; `tdPost=iceTd(inp,h/2)` → `iceTd(inp, inp.pProj>0?(h+inp.pProj)/2:h/2)`; `WiPost=…*h` → `…*(inp.pProj>0?h-inp.pProj:h)`. Panel q_h, C_f (s/h) unchanged (grade geometry).
  - `evalSignComboDir`: `const zarm=cs.name==='C'? sw.zc : sw.zA;` → `const zarm=(cs.name==='C'? sw.zc : sw.zA) - (inp.pProj>0?inp.pProj:0);`. `signPostStress`: `gLRFD.zarm||sw.zA` → `gLRFD.zarm||(sw.zA-(inp.pProj>0?inp.pProj:0))`. `calcSign` natural frequency panel at `inp.signClr+inp.signS/2-(inp.pProj>0?inp.pProj:0)`. `signLoadPathHTML`: arms `zArm(sw.zA)`, `zArm(sw.zc)` and a p step.
  - New block before `// ================= SHARED FOUNDATION STACK =================`: `LPP_GC=150`, `lppShaftProj(inp)` (null when p = 0: q_z(p/2) = 0.00256·K_z·K_zt·K_d·V², C_f = Fig. 29.4-1 row 'rough' / 'square' at h/D = p/b, F = q_z·G·C_f·b·p, iced F_I with b + 2t_d at V_ice, W_c = 150·A·p, W_ice), `lppGradeDir(dr,f,sp,B)` (V_F = V + F_s,u·û, M_F = B·M + V·p + F_s,u·û·p/2, N_F = N + γ_D·W_c + γ_Di·W_ice), `lppGradeCombo`, `lppGradePost`, `lppGradeBestPost`, `lppProjWorkedHTML(sp,inp,a,l,sign,sfx)` (worked steps, id `projWorked`+sfx).
  - `designFoundationStack(inp, asd, lrfd, MangLRFD, lrfdAll, asdAll)` → `(…, asdAll, shaftAll)`; `const Vu=Math.max(...cands.map(c=>c.P)); const reo=designRebar(…cands…)` → `const sc=(shaftAll&&shaftAll.length)? shaftAll : cands;` and `sc` in both (anchors keep `cands`).
  - `lppCalcIbc()` pole: `const emb=solveEmbed(govASD.P,govASD.M,govASD.h,inp);` → `const sp=lppShaftProj(inp); const fASD=sp? asdList.map(r=>lppGradeCombo(r,sp,null)).reduce(max M) : govASD; const emb=solveEmbed(fASD.P,fASD.M,fASD.h,inp);`. Shaft: `lrfdG`, `shaftCands`, `govLRFDF` (sp ? grade : the former `lrfdCands`, `govLRFD`) feed `VuMax` and `designRebar`; bearing `govAxASD` adds `f.D·W_c + f.Di·W_ice`; headline `oCase/oP/oM/oH/oN`, flag, steps box, `window.__summary`, `renderEmbedExample` and the Summary `asd` use `fASD`; `renderDemandExample(govASD,inp,'',projCtx)`; `found.proj` and `struct.proj` only when p > 0. `LPP_ANCH` (anchors) unchanged.
  - `calcSign()`: per post `sp`, `asdG`, `lrfdG` (`lppGradeBestPost`, the LRFD ones with that combination's B₂), `asdF`, `lrfdF`; `designFoundationStack` gets the grade ASD / LRFD, the grade ASD axials and `shaftAll`; `found.proj`, `postDesigns[i].gASDF` only when p > 0. `renderSign`, `populateDetailStack` (`asdBase`), `buildSignReport`, the Summary and `lpsvData` read `gASDF||gASD`.
  - `renderDemandExample(gov,inp,sfx)` → `(gov,inp,sfx,proj)` appends `lppProjWorkedHTML`. `LPP_K2TGT.proj = ['shaft','projWorked','Foundation demand at grade (shaft projection)']`. `summaryHTML`: rows "Shaft projection above grade, p", "Embedment — ASD at grade", "Shaft at grade — LRFD" and a note (p > 0 only). `buildReport` §5: the projection steps; §7 cites §5. Manual §2 input row.
  - Hand-off: `lppAnchorPayload` `depth:f.d*12` → `depth:(inp.pProj>0?f.d+inp.pProj:f.d)*12`; `ltsAnchorPayload` `depth:X.fd.gov.br.L*12` → `(inp.pProj>0?…L+inp.pProj:…L)*12`; one note each when p > 0. Schema unchanged (HANDOFF.md §4.11 `depth:<shaft length>`).
  - Drawings: `drawShaftDetail` (shaft from p above grade, grade line and `d` from grade, a `p` dimension); `lpdElevation` (`Pz`: shaft top, plate, pole / post, fixtures and cable marks + Pz, `p = <>` dimension); `lpsvGeom` `Pz`, `lpsvElevStack` (shaft, rods, plate, post + Pz, `p = <>`), `POST HT` from Pz; `lpsvBuild` (3D: shaft d + p, plate / rods / post / cage / ties from pz); `lpsvSig` + p; `lpsvInfo` note; `drawSignSchematic` shaft from Y(p).
  - LRFDLTS: `ltsGeom` sets `g.zp=inp.pProj` when p > 0; `ltsFoundation(inp,g,ba,mc)` → `(…,mc,L)`: when p > 0 the rows are `LpLts.groundline(ba,mc.Bs,g,L,sh)` (Broms with M_F, V_F; shaft P_F; `fd.sh`), else the former loop; the Shaft card shows `LpLts.groundlineSteps` before `f.dem` and a note.
- **Where (engine, `apps/light-pole/lts-engine.js`):** `windForces`: `kz(z)` → `kzg(z)` = `kz(z + zp)` for strips, fixtures, arms; panel `zc = S.clr + S.s/2` → `zg = S.clr + S.s/2` (K_z), `zc = zg − zp` (lever arm). `windSteps`: top K_z at H + p, base P_z at K_z(p), panel arm note. New `shaftWind`, `groundline`, `groundlineSteps` (exported).
- **Governing provisions:** ASCE 7-22 §29.4 (F = q_z G C_f A_f), Eq. 26.10-1, Table 26.10-1 (K_z, z < 15 ft at 15 ft), Fig. 29.4-1; IBC 2021 §1807.3.2.1; AASHTO LRFDLTS 1st Ed. (2015) with 2017 Interim: Eq. 3.8.1-1, Eq. 3.8.4-1 (z ≥ 16 ft), Table 3.8.7-1 (p. 3-20, 2017: cylindrical C_d; square 2.0 for r_s < 0.125), Table 3.9.3-1 (p. 3-24), Table 3.4-1 (p. 3-3), C13.6.1.1 (M_F, V_F "at groundline", pp. 13-3, 13-4; checked in the PDF); AASHTO LRFD 10th Ed. Table 3.5.1-1, C3.5.1 (unit weight). The ASCE 7-22 PDF is not in the reference folder (only 7-16, which does not open); the Fig. 29.4-1 rows are the tool's existing CF2941 table.
- **Check case 1 — IBC pole** (default inputs, cables off, Broms cohesive c = 1.0 ksf; V = 115 mph Exp. C, K_zt 1, K_d 1.0, G 0.85, b = 3 ft round, S₁ 150 psf/ft non-constrained), p = 0 → 2 ft:
  - Shaft wind: K_z(1 ft → 15) = 0.8489, q_z = 0.00256·0.8489·115² = 28.74 psf; C_f (rough, h/D = 0.667 → 1) = 0.70; F_s = 28.74·0.85·0.70·3·2 = 102.60 lb. W_c = 150·(π/4·3²)·2 = 2,121 lb.
  - ASD D + 0.6W (wind 90°): base V = 367.47 lb, M = 8,197.75 lb·ft (raised K_z; 363.62 / 8,094.09 at p = 0); V_F = 367.47 + 0.6·102.60 = 429.03 lb; M_F = 8,197.75 + 367.47·2 + 61.56·1 = 8,994.25 lb·ft; h = 20.96 ft; N = 864.5 + 2,120.6 = 2,985.0 lb.
  - Embedment d: 5.528 → 5.764 ft (A = 2.34·429.03/(288.2·3) = 1.161; d = 0.5806·(1 + √(1 + 4.36·20.964/1.161)) = 5.764).
  - LRFD 1.2D + 1.0W: B₂ = 1.03186, base M = 13,662.9, V = 612.45: M_u = 1.03186·13,662.9 + 612.45·2 + 102.60·1 = 15,425.7 lb·ft (p = 0: 13,919.9); V_u 606.0 → 715.0 lb; P_u 1,037 → 3,582 lb. Shaft (12) #6 both, φM_n 353,327 → 355,882 lb·ft; φV_c 30,295 lb.
  - Broms L (reference): 6.093 → 6.189 ft (H = 21.573, q = 0.026483, L = 4.5 + 0.026483·[1 + √(2 + (86.29 + 18)/0.026483)] = 6.189). Bearing q 0.141 → 0.445 ksf. Hand-off pier depth 66.34 → 93.17 in (= (5.764 + 2)·12).
- **Check case 2 — LRFDLTS two-post sign** (B = 16 ft, s = 5 ft, clr = 10 ft, V = 130 mph, b = 3 ft round, cohesive c = 1.0 ksf), p = 0 → 2 ft:
  - Post H 15 → 13 ft. Governing Broms row Extreme I (DC max), case 1 toward 0°, per post: base V = 2,113.75 lb, M = 21,403.5 lb·ft, B = 1.01012 (p = 0: 2,144.16 / 25,661.4, B = 1.01442).
  - Shaft wind: C_v·V·b = 0.8·130·3 = 312 ≥ 78 → C_d = 0.45; K_z(16) = 0.85622; P_z = 0.00256·0.85622·0.95·1.14·130²·0.45 = 18.053 psf; W_s = 18.053·3·2 = 108.32 lb.
  - M_F = 1.01012·21,403.5 + 2,113.75·2 + 108.32·1 = 25,955.8 lb·ft (p = 0: 26,031.5); V_F = 2,222.1 lb (2,144.2); P_F = 386.6 + 1.1·2,120.6 = 2,719.2 lb (412.2).
  - Broms L: 6.881 → 6.893 ft (H = 11.681, q = 0.08230). Broms M_u 35.77 → 36.05 kip-ft; shaft (12) #6 both, φM_n 352,698 → 354,521 lb·ft. Member ratio 1.104 → 0.916; Service deflection 2.51 → 1.54 in. Hand-off pier depth 82.58 → 106.72 in (each post).
- **Cables:** with p = 2 ft every cable value (components and all reactions, every combination and azimuth) is identical to p = 0 (default, cable45, ice, LTS pole cases; `tests/smoke/lightpole-projection.mjs`).
- **Saved data:** new field `shaftProj` in `inputs` (string, default "0"); keys unchanged; an old save opens with p = 0 (identical results and byte-identical hand-off payload).
- **How verified:** `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: ALL CASES IDENTICAL (20 cases incl. two new LRFDLTS cases with a Broms model; cable values identical in all 12 cable cases). `node tests/engine/run.mjs lightpole` (42 passed, incl. the new LPPJ engine test). New `node tests/smoke/lightpole-projection.mjs`: ALL PASS. `node tests/smoke/lightpole-anchor-handoff.mjs`: ALL PASS. `node tests/check-syntax.mjs`: all pass. `node tests/smoke/lightpole-signviews.mjs` with two new p = 2 ft cases: pass, except the 4 `ltsNoBroms` checks that fail on origin/main too (since LTS-L2 a missing Broms model is an input error; test expectation not updated here). Screenshots of the Shaft-tab steps, Geometry elevation, 3D and LTS foundation card reviewed.
- **Open items (questions for the engineer):** (1) γ_c = 150 pcf; (2) t_d(z) raised by p with K_z (map basis only); (3) G_f (flexible) keeps h = H; (4) round shaft always on the rough row (also when D√q_z ≤ 2.5; same 0.7 at h/D ≤ 1); (5) the LTS shaft K_d = the structure's (pole/post shape).

## 2026-11-03 — PR: [#747](https://github.com/mlococo88/All-Structural/pull/747) (LPDC: check summary panel, as Spread Footing's dashboard)   [display only; no result change]

### LPDC. Check summary panel: one line per check; a left column on screens 1500 px and wider
- **Request (engineer):** the summary panel Spread Footing got (SFDC #737, SFDF #740), in this tool, both code modes, pole and sign (1 and 2 posts). The Summary output tab is kept.
- **Where:**
  - Markup: `<aside id="lppDashCol" class="noprint" …>` as the first child of `<div class="grid2">`; in `<div class="col-out">`, before `<div class="tabbar" id="tabBar">`, `<div id="lppDashBox" class="noprint">` with the header `#lppDashHead` (collapse button `#lppDashTgl`, title `#lppDashTtl` "Check summary", count `#lppDashCnt`) and the list `#lppDash`.
  - JS: new block after the `a.wkA` click handler (`document.addEventListener('click',ev=>{ const a=ev.target.closest&&ev.target.closest('a.wkA');`), anchor `const LPDC={key:'lpp_dashCollapsed_v1'`: `lppDashDC`, `lppDashCond`, `lppDashGoEl`, `lppDashItems`, `lppDashRender`, `lppDashPlace`, `lppDashColl` and a start-up IIFE.
  - `calc()`: after `if(typeof lpsvRefresh==='function') lpsvRefresh();` added `lppDashRender();`.
  - `lppAnchorCardRefresh()`: after the `box.innerHTML=LPP_ANCH.groups.map(…)` line added `if(typeof lppDashRender==='function') lppDashRender();` (a new Anchorage-app result updates the Anchors line).
  - CSS: before the first `</style>`, anchor `/* LPDC (2026-11-03): check summary panel`; screen only, and `@media print{#lppDashCol,#lppDashBox{display:none!important}}`.
  - `tests/smoke/phone-layout.mjs`: new entry `lp` (input tabs, output tabs and the Hide / Show checks button).
- **What the lines are (no new calculation):**
  - IBC mode: per stack (pole, or each post), `collectChecks(…)` exactly as `summaryHTML` calls it (name · post label, D/C = its `ratio`, status from its `ok`, demand vs capacity with the Summary table's decimals, code reference); a REVIEW line "Slender wall (§E7 not applied)" where `pstress.lim.e7Slender` (the Summary's red flag); one "Anchors" line per anchor group from `lppAnchorChip()` (OK / NG from the Anchorage-app result, REVIEW when stale or in error, INFO "not checked" when there is none).
  - LRFDLTS mode: the rows of the LRFDLTS summary card from `lppLtsLast`: member check (`mc.gov.gov.ratio`, OK only when ratio ≤ 1 and `mc.valid`), each `dfl.checks` row (INFO when `applies` is false), base plate (`bp.ratio`, `bp.ok`), base weld (`wd.ratio`, `wd.ok`; INFO "CJP"), Broms embedment (INFO, "L = x ft"), Anchors, fatigue (REVIEW when required), breakaway (REVIEW when needed).
  - Short value: the D/C; where the status is NG / REVIEW and the D/C is ≤ 1 or not a number, the condition instead (`lppDashCond`, as Spread Footing's `sfdChCond`): "Art. 4.8.1 not valid", "D/t ≥ 0.45E/F_y", "not computed", "stale: send again", and so on; the D/C then moves to the expanded text with "(the ratio is within its limit; the status comes from the condition)".
  - ▸ expands a line (result text, reference, "→ Tab · Card"); NG and REVIEW lines start expanded; the state is kept by name for the session (not saved). A click on the line opens its worked check: `lppGoto(LPP_CHK2K[name], post)` in the IBC mode (the D11 links, including the post selector of a two-post sign), the LRFDLTS card (`ltsMemberCard`, `ltsDeflCard`, `ltsBpCard`, `ltsFndCard`, `ltsBrkCard`) in the LRFDLTS mode.
  - Header count: "n NG" / "n REVIEW" / "no NG". With input errors (`#lppInErr.on`, which also covers the LRFDLTS input checks) the list shows "Input error: no results …" and the count "input error" instead of stale lines.
- **Layout:** ≥ 1500 px wide: `lppDashPlace()` (on load and on a `matchMedia('screen and (min-width:1500px)')` change) moves `#lppDashBox` into `#lppDashCol` (292 px with padding, about 280 px of content; the panel height; scrolls on its own; sticky header). `.wrap` max-width 1500 → 1792 px, and the input panel is 33 % of the width left after the column, so at 1792 px and wider the input and output panels are exactly as wide as before (measured: 495 / 1005 px at 1792, 1920 and 2560, as before). « collapses the column to a 42 px strip (title written vertically, count). < 1500 px: the box stays on top of the output panel above the tabs, as a grid of one-line chips (`minmax(min(250px,100%),1fr)`), with "▾ Hide checks" / "▸ Show checks".
- **Saved data:** new per-browser UI key `lpp_dashCollapsed_v1` ('1' = collapsed, '0' or absent = open), named like `lpp_activeTab_v1` / `lpp_inputTab_v1`. Not in the project, the autosave or the export. No existing key or format changed.
- **Report and printing:** unchanged (the panel is outside the tab pages, hidden in print; the Report reads the tab pages and `LPP_SUMCTX`).
- **Check case:** IBC two-post sign (V = 130 mph, square shaft, 16 × 5 ft panel): Summary "4 CHECKS FAIL"; panel "4 NG": Base plate thickness · P1 / P2, Post combined stress · P1 / P2; a click on "Shaft flexure (P–M) · P2" opens the Shaft tab with post 2 selected. LRFDLTS two-post sign (B 16, s 5, cohesionless φ 30°, γ 0.115): "3 NG": Post — combined forces D/C 1.10, Base plate D/C 1.65, Base weld D/C 1.59; the deflection rows INFO (information only), Broms "L = 4.06 ft".
- **How verified:** `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: ALL CASES IDENTICAL (20 cases; results, cable values, every output tab's text, drawings; 0 console errors; the panel is outside the tab pages, so no tab text changed). `node tests/engine/run.mjs lightpole` passes; `node tests/check-syntax.mjs` passes; `node tests/smoke/phone-layout.mjs --tool lp` passes at 390 and 768 px. Screenshots before / after at 1366, 1920 and 390 px (IBC pole, LRFDLTS two-post sign) and collapsed, looked at; no horizontal page scroll at any of them. Input-error state (V = 0; LRFDLTS V = 0) shows the message.
- **Other copies:** none (the Spread Footing code is the model, not shared).

### Open items
- Between 1500 and 1792 px the input and output panels are narrower than before (the column takes 292 px), as in Spread Footing.
- The LRFDLTS summary card does not list the shaft reinforcement (ACI 318 with the LRFDLTS demands) or the torsion threshold, so the panel does not either; adding them would be a change to that card.
- The User Manual does not yet mention the panel (left so the Manual text is unchanged).

## 2026-11-03 — PR: [#748](https://github.com/mlococo88/All-Structural/pull/748) (LPGF: flexible G_f with h above grade, H + p, IBC pole)   [§4: formula input change when p > 0 and n₁ < 1 Hz; p = 0 identical]

### LPGF. G_f height h = H + p with a shaft projection   [calculation change]
- **Decision (engineer, 2026-11-03):** with the shaft projection p (LPPJ, #746, open item 3 there: "G_f (flexible) keeps h = H"), the flexible gust-effect factor of the IBC mode uses the height above grade, h = H + p. This closes that open item; the rest of LPPJ is unchanged.
- **Where:** `lppCalcIbc()`, pole branch, anchor `lppApplyGf(inp, nat, {h:`:
  - Before: `lppApplyGf(inp, nat, {h:inp.H, B:Bw, L:Ld}); }`
  - After: `lppApplyGf(inp, nat, {h:inp.H+(inp.pProj>0?inp.pProj:0), B:Bw, L:Ld}); }`
  - `natGfWorkedHTML()` (anchor `(Table 26.11-1 values as used by the tool). h = `): when p > 0 on a pole, the text reads "h = H + p = 70.00 + 2.00 = 72.00 ft (height above grade; LPGF)"; at p = 0 the text is unchanged.
  - Sign mode is not changed: its G_f already uses h = clr + s, the top of the panel above grade (the post length is clr + s − p since LPPJ). The LRFDLTS mode does not use G_f.
  - n₁ (Rayleigh) is not changed: the cantilever is the pole on its base plate (LPPJ).
- **Governing provision:** ASCE 7-22 §26.11.5, Eqs. 26.11-7 to 26.11-16 (h = mean roof height of the structure, taken here as the height of the top above grade); z̄ = max(0.6h, z_min), Table 26.11-1.
- **Effect:** only when p > 0 and n₁ < 1 Hz (G_f used). G = max(entered G, G_f) applies to every wind force (pole, fixtures, cables), so in that case the cable wind changes in proportion to G as well. At p = 0, or with a rigid pole, nothing changes.
- **Check case:** IBC light pole, default inputs except H = 70 ft, pole OD 5 → 10 in, wall 0.25 in at the base, shaft b = 3.5 ft; V = 115 mph, Exp. C, β = 0.005, n₁ = 0.6315 Hz (flexible), B = L = 0.625 ft; p = 2 ft.
  - Before (h = H = 70 ft): z̄ = 42.0 ft, I_z̄ = 0.19212, L_z̄ = 524.71 ft, Q² = 0.84883, V̄_z̄ = 113.777 ft/s, N₁ = 2.9125, R_n = 0.071123, R_h = 0.40736, R_B = 0.98945, R_L = 0.96531, R² = 5.6400, g_R = 4.0784 → **G_f = 1.8955**.
  - After (h = 72 ft): z̄ = 0.6·72 = 43.2 ft; I_z̄ = 0.20·(33/43.2)^(1/6) = 0.19122; L_z̄ = 500·(43.2/33)^(1/5) = 527.67 ft; Q² = 1/(1 + 0.63·((0.625 + 72)/527.67)^0.63) = 0.84702; V̄_z̄ = 0.65·(43.2/33)^(1/6.5)·115·88/60 = 114.272 ft/s; N₁ = 0.63155·527.67/114.272 = 2.9163; R_n = 7.47·2.9163/(1 + 10.3·2.9163)^(5/3) = 0.071067; R_h (η = 4.6·0.63155·72/114.272 = 1.8305) = 0.40092; R_B = 0.98949; R_L = 0.96546; R² = (1/0.005)·0.071067·0.40092·0.98949·(0.53 + 0.47·0.96546) = 5.5470; g_R = 4.0784 (unchanged);
    G_f = 0.925·(1 + 1.7·0.19122·√(3.4²·0.84702 + 4.0784²·5.5470))/(1 + 1.7·3.4·0.19122) = 0.925·(1 + 0.32507·10.1024)/2.10525 = **1.8823**.
  - Results (p = 2 ft, before → after): G used 1.8955 → 1.8823 (−0.70 %); cable wind pressure q_W (cables 1, 2) 70.29 → 69.80 psf; ASD governing M 61,756 → 61,326 lb·ft; embedment d 10.550 → 10.523 ft; LRFD (1.2D + 1.0W, governing direction) M 96,720 → 96,047 lb·ft; shaft M_u 123,235 → 122,377 lb·ft. Less conservative by the change in G (a taller h lowers I_z̄ and R_h).
- **How verified:** `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: ALL CASES IDENTICAL (20 cases, all at p = 0; cable values identical in the 12 cable cases). The check case above run in the page on origin/main and this branch (headless Chromium), and G_f recomputed by hand as shown. `node tests/smoke/lightpole-projection.mjs` ALL PASS; `node tests/engine/run.mjs lightpole` passes; `node tests/check-syntax.mjs` passes.
- **Saved data:** no change.
- **Other copies:** none.

### Open items
- None.

## 2026-11-03 — PR: claude/lp-print-sheets (PR #750: https://github.com/mlococo88/All-Structural/pull/750) — Drawings: Print sheet and Print all sheets (11 × 17 landscape at plot scale) (LPPS; display only, no result change)

### LPPS. Print the drawing sheets to PDF   [display only]
- **Request (engineer):** print the previewed DXF sheets directly to PDF: "Print sheet" (the sheet shown) and "Print all sheets" next to
  "Download DXF"; each sheet a vector 11 × 17 landscape page at its true plot scale through the browser's print dialog; Ctrl+P and the
  browser's Print still print the Report.
- **Where:** `lpdRender()`:
  - Bar, anchor `'<button type="button" class="btn mini ghost" id="lpdDxf">Download DXF ('+B.S.length+' sheets)</button>`: before, the bar ended
    with `</div>'+` after that button; after, a space and two buttons `id="lpdPrint1"` (Print sheet) and `id="lpdPrintAll"` (Print all sheets (n))
    follow it, then `'<p class="tbl-note">'+lppEsc(SharedDxf.PRINT_NOTE)+'</p>'` (Tabloid / 11 × 17, Landscape, Margins None, Scale 100 %).
  - After the Download DXF handler (anchor `// LPPS (2026-11-03)`):
    `const prt=list=>SharedDxf.printSheets(list.map(s=>({svg:SharedDxf.sheetSVG(B.D,s),title:s.title})),{paper:[LPDW.W,LPDW.H]});`
    `#lpdPrint1` → `prt([cur])`, `#lpdPrintAll` → `prt(B.S)`.
  - The print code is shared: `shared/dxf.js` `printSheets`, `sheetSVG` (PR #749, fixlog/shared-dxf.md).
- **Governing provision:** none (drawing output).
- **Check case:** default project (pole, IBC), sheet 1 POLE ELEVATION at 1/8" = 1'-0" (k = 96): the shaft 3'-0" dia. × (d = 6.4636 ft = 77.564 in)
  is drawn 36/96 × 77.564/96 = 0.3750 × 0.8080 in = 27.00 × 58.17 pt; measured on the printed PDF 27.00 × 58.18 pt. Base plate sheet at
  3" = 1'-0": bolt circle 1'-4" → 4 in on paper (checked on the page image). Print all sheets: 5 pages, all 17 × 11 in.
- **How verified:** `node tests/smoke/dxf-print-sheets.mjs --tool lp` (headless Chromium page.pdf honoring @page). Report print (page.pdf with no
  button, from the Drawings tab): 27 letter pages, text identical to origin/main's apart from the print time stamp. No result changes: only the
  Drawings tab's bar and handlers changed.
- **Other copies:** none (Spread Footing has the same two buttons, SFPS, through the same shared function).

### Open items
- The outer border prints on the page edge (the sheet is the page): a physical printer with unprintable edges clips that outer line; a PDF keeps it.

## 2026-11-03 — PR: [#751](https://github.com/mlococo88/All-Structural/pull/751) (LPGC: the cables keep G_f at h = H; Manual: the check summary panel)   [§4: cable G when p > 0 on a flexible pole; p = 0 identical]

### LPGC. Cable wind: G_f with h = H, as before LPGF (#748)   [calculation change]
- **Decision (engineer, 2026-11-03):** the cables keep the gust factor computed with h = H, exactly as before #748. The pole and fixtures keep G_f with h = H + p (LPGF, #748). The sign has no cables and is unchanged. This answers the question raised with #748, where the cable wind followed the pole's G.
- **Where:**
  - `lppCalcIbc()`, pole branch. Anchor: `// LPGC (2026-11-03, engineer): the cables keep G_f at h = H`. After the LPGF `lppApplyGf(…)` call, added:
    ```js
    if(inp.gf && inp.pProj>0){ const gc=gustFlexible(inp.expo, inp.V, inp.H, Bw, Ld, nat.n1, inp.gf.beta); inp.gfCable=gc; inp.Gcable=Math.max(inp.Ginput, gc.Gf); }
    ```
    `inp.Gcable` is set only when p > 0 and the pole is flexible. That is the only case where it can differ from `inp.G`.
  - `cableComponents()`:
    - Before:
      ```js
      const qW = qBase*inp.G*inp.V*inp.V; … const qWI= qBase*inp.G*inp.Vice*inp.Vice;
      ```
    - After:
      ```js
      const Gc=(inp.Gcable!==undefined)?inp.Gcable:inp.G;
      const qW = qBase*Gc*inp.V*inp.V; … const qWI= qBase*Gc*inp.Vice*inp.Vice;
      ```
  - Steps (shown only when `inp.Gcable` is set, so the p = 0 text is unchanged):
    - `natGfWorkedHTML()`: "for every wind force" gains "except the cables (next line)". A new paragraph gives the cable G_f terms at h = H and its result line "G for the cables = max(entered G, G_f) = …".
    - `cableWorkedHTML()`: a sentence after "Evaluated per cable below…" gives the cables' G and the pole's G.
    - Report, Dynamic response: a step `Gc`, "G for the cables (G_f with h = H …)".
- **Governing provision:** ASCE 7-22 §26.11.5 (Eqs. 26.11-7 to 26.11-16), applied to the cables with h = H.
- **Check case:** the LPGF case. IBC pole: H = 70 ft, OD 5 → 10 in, base wall 0.25 in, b = 3.5 ft, V = 115 mph, Exp. C, n₁ = 0.6315 Hz, p = 2 ft.
  - Pole G = G_f(h = 72 ft) = 1.8823 (unchanged from #748).
  - Cable G = G_f(h = 70 ft) = 1.8955: z̄ 42.0, I_z̄ 0.19212, R² 5.6400. The hand check is the "before" column of LPGF.
  - q_W (cables 1, 2) = q_W,#748 × 1.8955/1.8823: 69.80 → **70.29 psf**. That equals the p = 0 / pre-#748 value.
  - Results at p = 2 ft (#748 → this change):
    - cable resultant (L1 at 270°): 109.11 → 109.87 lb (= pre-#748)
    - ASD M: 61,326 → 61,403 lb·ft
    - d: 10.523 → 10.528 ft
    - LRFD 1.2D + 1.0W M: 96,047 → 96,167 lb·ft
    - shaft M_u: 122,377 → 122,520 lb·ft
  - The pole and fixture forces are still those of #748. Only the cable contributions go back.
- **How verified:**
  - `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: ALL CASES IDENTICAL. That is 20 cases at p = 0, with cable values identical in the 12 cable cases.
  - `tests/smoke/lightpole-projection.mjs`, new section 1b (the flexible pole above):
    - at p = 0, G = G_f(h = H) and there is no separate cable G;
    - at p = 2 ft, the pole G = G_f(h = H + p);
    - the cable G = G_f(h = H), equal to the p = 0 G;
    - every cable value at p = 2 ft is identical to p = 0.
    ALL PASS.
  - Comparing commit 8818582 (before #748) at p = 2 ft with this branch: q_W and the cable resultant are equal.
  - `node tests/engine/run.mjs lightpole` passes; `node tests/check-syntax.mjs` passes.
- **Saved data:** no change.

### Manual: the check summary panel (LPDC, #747)
- Manual §3.1, Summary tab: after the first paragraph ("The Summary is the answer sheet…"), one paragraph was added on the check summary panel. It covers the one-line checks, expanding and click-through, the placement at 1500 px, the collapse button, the code modes and the input-error state, and notes that the panel is not printed. This closes the LPDC open item on the Manual.

## 2026-11-03 — PR: claude/dxf-sheet-inset (PR #754: https://github.com/mlococo88/All-Structural/pull/754) — Drawings: the sheet's outer border 0.25 in inside the paper edge (LPPS-2; display only, no result change)

### LPPS-2. Outer border inset (engineer's decision)
- **Problem (engineer):** on a physical printer the outer border, printed on the page edge, is clipped.
- **Where:** the sheet function in the drawing build (anchor `SharedDxf.sheetBorder(D`): before
  `D.rect(L.br, ox, 0, ox+W, H);`, after
  `SharedDxf.sheetBorder(D, L.br, ox, W, H, k);` (shared/dxf.js: a rect 0.25 k inside the sheet's edge).
  The inner border, title block, drawing area and every drawn object are unchanged; the sheet is still 17 × 11 in at its plot scale.
- **Governing provision:** none (drawing output).
- **Check case:** the DXF display list of the default project, origin/main vs branch: same entity count and sheet scales; one entity per sheet
  differs (the outer border, 0.25 k inward on every side). Printed: the border at 18 pt from each page edge; the known dimension unchanged
  (see the PR).
- **How verified:** `node tests/smoke/dxf-print-sheets.mjs`, the display-list comparison, the tool's smoke tests (PR).
- **Other copies:** shared/dxf.js sheetBorder (fixlog/shared-dxf.md).

### Open items
- None.

## 2026-11-05 — PR: claude/github-sync-rollout (PR #811: https://github.com/mlococo88/All-Structural/pull/811) (GHS: saved projects copied to a private GitHub repository; storage only, no result change)
- **Engineer:** the same saved projects on every device (`docs/github-sync-setup.md`; shared code `shared/github-sync.js`, fix log `shared-github-sync.md`; pilot Spread Footing, PR #808).
- **Where:** after `<script src="shared/projects-ui.js"></script>`, new `<script src="shared/github-sync.js"></script>`; in the PLIB block, `SharedProjectsUI.libraryDialog({` gets a first property `cloud:{tool:'light-pole-sign-post', …}` (anchor `GHS (2026-11-05): GitHub sync of this list`).
- **File on GitHub:** `projects/light-pole-sign-post/<name>.json`: `toFile` = `{tool, format:'lpp-project', version:1, name, state:item}` (the export without `exported`), indent 1. **Download (fromFile):** an `lpp-project` file's `state`, or a bare state object (as Import JSON); Open then goes through the dialog's existing `open`.
- **Saved data:** `lpp_projects_v1` and the autosave unchanged (key and format). With sync off nothing is written and no request is made.
- **How verified:** `node tests/smoke/project-library.mjs` for this tool (origin/main vs branch, sync off): ALL PASS. `node tests/smoke/github-sync-tools.mjs`: Save → file on GitHub; update with sha; a GitHub-only copy opened gives the same results as the saved project; 0 console errors.
- **Formulas, factors, units, code references:** none.

## 2026-11-05 — PR: claude/header-lightpole (PR #833: https://github.com/mlococo88/All-Structural/pull/833) (LPHD: compact header; saved-project picker and project-file buttons moved to a new Project input tab; display only, no result change)
- **Engineer:** clean up the top of the page (no title block here; the header's project bar had a picker and 10 buttons); the header keeps the title, a read-only project line and the global actions.
- **Where / before → after** (nodes moved, not copied: every id and handler is the same):
  - Header `.projbar`: before "Project" label, `#projSelect`, `#projStatus`, `.pb-btns` (Save, Save As…, Rename, Delete, New, Undo / Redo / Saved projects… (PLIB, inserted before Export JSON), Export JSON, Import JSON, `#pbImportFile`). After: "Project" label, `<a id="hdrProj">` (the open saved project, or "(not saved: see the Project tab)"), `#projStatus`, `<div class="pb-btns" id="hdrActs">` with Undo / Redo / Saved projects….
  - New last card of `.col-in`, `<section class="card" id="lppPrjCard">` "Project file": Saved project (`#projSelect`), Save (`#pbSave`, `#pbSaveAs`, `#pbRename`, `#pbDelete`, `#pbNew`), Project file (JSON) (`#pbExport`, `#pbImport`, `#pbImportFile`); one-line hints. `LPP_IN_TABS` gets `['proj','Project']` (last; the page still opens on Wind & site) and `LPP_IN_CARD` gets `['projSelect','proj']`.
  - `.col-in` input wiring (anchor `/* LPHD: the project picker and file input`): elements inside `#lppPrjCard` are skipped (they are not design inputs; picking a project must not mark the state dirty before the load asks about unsaved changes). `captureState()` reads `INPUT_IDS` only, so nothing saved changes.
  - PLIB block: `const ref=$('pbExport')` (insert before) → `$('hdrActs')` (`append`).
  - `updateStatus()` ends with `lpHdrProj()`; new `lpHdrProj()` and a click handler on `#hdrProj` (anchor `function lpHdrProj(){`): Project tab, picker focused (at 900 px and below the input tabs are scrolled into view first).
  - CSS (anchor `/* LPHD (2026-11-05)`): `.projbar #hdrProj`, `#lppPrjCard` (light buttons in the card).
- **Decisions (pending engineer review):** the project line is the open saved project's name (the tool has no title block); the status ("saved · …" / "● unsaved …") stays beside it; Undo / Redo / Saved projects… stay in the header.
- **Governing provision:** none (layout only).
- **Check case / how verified** (headless Chromium, origin/main vs branch):
  - `node tests/lightpole-compare.mjs --jobs 2` (every case, both codes, pole and sign): results, cable values, text and drawings identical, 0 console errors.
  - V = 120 mph typed: `captureState()`, every localStorage key and the reload of the session: identical; the header link opens the Project tab with the picker focused (1920 and 390 px).
  - `phone-layout --tool lp`, `project-library --tool lightpole`, `github-sync-tools --tool lightpole`, `dxf-print-sheets --tool lp`, `lightpole-anchor-handoff`, `check-syntax`: pass; no sideways scroll on any input tab at 390 / 768 px;
  - before / after screenshots at 1920 and 390 px looked at.
- **Saved data:** no change (`lpp_inputTab_v1` may now also hold `proj`, a view setting).

## 2026-11-06 — PR: claude/standard-save-lightpole (PR #843: https://github.com/mlococo88/All-Structural/pull/843) (STDS) — the standard save: header chip + Save + Saved projects…, "Save and open" card in the Project tab, Save as, Ctrl+S   [display / save controls only; no result change; cable results unchanged]
- **Why:** engineer decision 2026-11-05 (standard save roll-out after the Spread Footing pilot #837). Uses `SharedProjectsUI.projectBar` (shared/projects-ui.js).
- **Header project bar (`.projbar`):** before: "Project" label · `#hdrProj` (open project) · `#projStatus` (saved / unsaved) · Undo · Redo · Saved projects…. After: chip `Project: <open saved project> ● saved / unsaved changes / not saved` (+ GitHub badge with sync on) · Undo · Redo · **Save (Ctrl+S)** · Saved projects…. The label, `#hdrProj` and `#projStatus` stay in the page with `hidden` (their updaters `updateStatus` / `lpHdrProj` unchanged). The tool has no Print button in the header (Print stays on the Report tab, as before).
- **Project tab:** the card `#lppPrjCard` "Project file" → **"Save and open"** (`#lppSaveCard` body): status line; Save · Save as… · Saved projects… · New; "File on this computer": Export JSON · Import JSON (same `#pbExport` / `#pbImport` buttons and handlers); the two hint lines. Removed: the picker `#projSelect` and Save, Save As…, Rename, Delete, New (`#pbSave` … `#pbNew`) and their handlers (anchor `/* STDS (2026-11-05): the Save / Save As… / Rename / Delete / New buttons`); `doSaveAs()` / `commitSave()` kept. `refreshProjectList()` returns when the picker is absent. Input-tab map: `['projSelect','proj']` → `['pbExport','proj']`.
- **Import (anchor `$('pbImport').onclick=`):** goes through `LPPL.pb.importJSON()` (the standard question on unsaved changes) instead of the tool's own "Discard changes?" modal; the file handler `lppImportState` is unchanged.
- **Code (PLIB block, anchor `/* STDS (2026-11-05): the standard save`):** `projectBar({ store: mapStore(localStorage,'lpp_projects_v1'), getState: captureState, current / setCurrent: activeProject (kept in lpp_session_v1, as before), save: commitSave(name) (as before), open: applyState (the old load path, without its own confirm), newProject: applyState(DEFAULT_STATE) (as before), deleted: clears activeProject (as before), exportFile: lppExportJSON with the typed name, importFile: #pbImportFile, cloud: <unchanged GHS ctx.cloud, checked byte-identical> })`. `window.LPPL` gains `pb`.
- **Manual §1.4:** the sentence on the project bar now describes Save, Save as…, New and Saved projects….
- **Behaviour changes (asked for):** Save to the open name never asks; a new duplicate name at Save as is blocked ("Replace it", was "Overwrite?"); Rename / Delete only in Saved projects…; Open / New / Import ask first on unsaved changes (standard question); Ctrl+S / Ctrl+Shift+S.
- **Saved data (§5):** `lpp_projects_v1` ({ name: captureState() }), `lpp_session_v1` ({ state, activeName, dirty }) unchanged; Export JSON / GitHub file unchanged; no new key.
- **Formulas, factors, units, code references:** none (§4 does not apply).
- **How verified:** main vs branch after the same input change: results (`LPP_LAST`, including every cable reaction and the resultant) identical, localStorage keys identical (`lpp_session_v1` byte-identical), Export JSON text identical apart from its `exported` time stamp (2,687 chars), Report text identical apart from its print time (77,966 chars), no console errors beyond main. Probe: save → saved; change → unsaved; Ctrl+S saves without a dialog; every output and input tab leaves "saved"; Open, reload: saved; New → defaults, not saved. `project-library --tool lightpole` ALL PASS; `lightpole-anchor-handoff`, `lightpole-projection`: ALL PASS; `lightpole-signviews`: the same 4 failures as on main (ltsNoBroms case, not touched here); engine `lightpole*`, `project-registry`, `github-sync`, `projects`: 74 / 74; `github-sync-tools --tool lightpole`, `standard-save` (8 / 8), `github-sync` (13 / 13), `home-projects`, `home-sync`: pass; `phone-layout --tool lp` (390, 768) pass; `check-syntax` pass. 390 px: page 390 / 390, dialog 355 / 355; screenshots looked at.
- **Open item:** `lightpole-signviews.mjs` ltsNoBroms (no Broms model → the views say so; 3D draws the panel) fails on main as well; not investigated here.

## 2026-11-06 — PR: claude/lightpole-signviews-test (PR #847: https://github.com/mlococo88/All-Structural/pull/847) (LPSV-T: the sign-views smoke test's `ltsNoBroms` case brought up to date with LTS-L2 #744; test only, no tool change)
- **Problem:** `node tests/smoke/lightpole-signviews.mjs` failed 4 checks on main (case `ltsNoBroms`: default project, LRFDLTS mode, two-post sign, Broms soil model "Not evaluated"; 2 checks × 1280 / 390 px). Open item of #843.
  - "no Broms model → the views say so": expected the views' error to mention Broms; got "no LRFDLTS results yet (correct any input errors first)."
  - "3D still draws the panel and posts": expected > 50 sampled non-white px; got undefined (no canvas: the 3D card shows a "No 3D view" message).
- **Cause:** the test was written with LPSV (#663), when a missing Broms model still let the LTS run show its member checks, and the views drew the panel and posts with "select the Broms soil model". LTS-L2 (#744, commit df05fdd, 2026-11-03) made a missing Broms model an LTS input error: the LTS run is blocked (`ltsCalc()` gets `inp = null`, `lppLtsLast` stays null), the output tabs are hidden behind the input error box, and the 3D and Drawings say there are no results. That change was intended and recorded (#744 check case: "the input error box shows the Broms message and no LTS results are shown"); the test was not updated. Bisected: the case passes at df05fdd^ and fails at df05fdd.
- **Where (test only):** `tests/smoke/lightpole-signviews.mjs`, anchor `else if (name === 'ltsNoBroms')`:
  - Before: `check(/Broms/.test(r.err || ''), …the views say so…); check(r.px > 50, …3D still draws the panel and posts…);`
  - After: the input error box (`#lppInErr`) names "Broms soil model" and the output column has `.lpp-blocked`; `lpsvData()` returns "no LRFDLTS results…", `#lp3dHost` starts "No 3D view" and has no canvas; and (after the existing Drawings-tab step) `#lpdHost` starts "No drawings" with no sheet SVG.
- **Governing provision:** none changed. (LTS-L2: LRFDLTS 1st Ed. (2015) Art. 13.6.1.1, Broms is the LTS embedment method.)
- **Check case:** default project, LRFDLTS, sign, two-post, Broms "Not evaluated": the page shows "Input error — results are not shown until this is fixed: Broms soil model (Shaft & soil): choose Cohesive or Cohesionless…"; 3D card "No 3D view: no LRFDLTS results yet (correct any input errors first)."; Drawings "No drawings: correct the input errors."
- **How verified:** `node tests/smoke/lightpole-signviews.mjs`: ALL PASS (1280 and 390 px). The tool file is not changed, so no result, cable value or saved data can change.
- **Open item (not changed):** the `lpsvData()` branch "select the Broms soil model (Shaft & soil inputs)…" can no longer be reached by a missing model (LTS-L2) or missing parameters (LTS-L3); it remains as a guard if `bromsEmbedment()` returns no result.

## 2026-11-06 — PR: claude/lightpole-print (PR #849: https://github.com/mlococo88/All-Structural/pull/849) (LPHP: Print in the header, the standard header; display only, no result change)
- **Engineer:** the standard header after #837–#843: chip · Undo · Redo · Save (Ctrl+S) · Saved projects… · **Print**. The Light Pole header had no Print (#843: "Print stays on the Report tab").
- **Where:** PLIB / STDS block, after `[pb.el.chip,pb.el.save,pb.el.lib].forEach(b=>b.classList.add('pbtn'));` (anchor `/* LPHP (2026-11-06): Print, last in the header`). Before: nothing. After:
  ```js
  const bp=B('Print','Print / PDF the calculation report (the Report tab), from any tab'); bp.id='lppHdrPrint';
  bp.onclick=()=>{
    const on=document.querySelector('#tabBar button.on'), back=on?on.dataset.tab:null;
    if(back!=='report') switchTab('report',true);
    const rb=Array.from(document.querySelectorAll('#page-report [data-rpact="print"]')).find(x=>x.offsetParent!==null);
    if(rb){ if(back&&back!=='report') lppPrintBack=back; rb.click(); return; }
    if(back&&back!=='report') switchTab(back,true);
    window.print();
  };
  if(ref) ref.append(bp);
  ```
- **What it does:** exactly the Report tab's own Print, the `data-rpact="print"` toolbar button of the report shown in the active code mode (IBC `#lprHost` or LRFDLTS `#ltsRptHost`), which calls `SharedReport.print(doc)` (shared/report.js). The report is built only when its tab is shown (`switchTab('report')` → `lprRender()` / `ltsReportRender()`), so from another tab the button opens the Report tab first, without remembering it (`noSave`). After printing, the existing `afterprint` handler (LPRX) brings back the tab shown before (`lppPrintBack`), as Ctrl+P does. With input errors there is no report: the page prints as shown, as Ctrl+P and "Export PDF / Print" do. This is the same approach as Gusset Plate Rating (`gprPrintAny`) and Spread Footing (`#btnPrint`): the Report prints from any tab.
- **Governing provision:** none (display only).
- **Check case / how verified** (headless Chromium, `window.print` stubbed, 1280 and 390 px):
  - Cases: IBC pole; IBC two-post sign; LRFDLTS monopost sign (cohesive); LRFDLTS pole; LRFDLTS sign without a Broms model (input error).
  - Header Print from the Geometry tab: `window.print` called once, with `rp-printing` on. The `#rp-print` content is identical to that of the Report tab's own Print button, apart from the time stamp. The Report tab is shown during the print and Geometry comes back after `afterprint`. With the input error, the page prints as shown and the tab does not change.
  - Header order: chip · Undo · Redo · Save Ctrl+S · Saved projects… · Print. At 390 px: no sideways scroll (390 / 390).
  - `node tests/lightpole-compare.mjs --a origin/main --jobs 2`: ALL CASES IDENTICAL (results, cable values, text, drawings; 0 console errors).
  - Passed: `lightpole-signviews`, `lightpole-projection`, `lightpole-anchor-handoff`, `project-library --tool lightpole`, `phone-layout --tool lp`, `dxf-print-sheets --tool lp`, `standard-save`, `node tests/engine/run.mjs lightpole` and `check-syntax`.
- **Saved data:** no change (no new key; the Report tab opened by Print is not stored as the remembered tab).
## 2026-11-06 — PR: claude/hdrs-lightpole (PR #888: https://github.com/mlococo88/All-Structural/pull/888) (HDRS) — header: Save and Saved projects… removed (in the "Save and open" card only); the chip opens the Project tab   [display only; no result change]
- **Why:** engineer 2026-11-06: every app's header as in Spread Footing (#884): no Save (Ctrl+S) and Saved projects… buttons in the header; they stay in the "Save and open" card. The header keeps the project chip (click = the Project tab), Undo, Redo, the app's other global actions and Print. Ctrl+S and Ctrl+Shift+S work from anywhere. No "Recent projects" start strip (Spread Footing only).
- **Where:** the `SharedProjectsUI.projectBar({...})` call, right after the line `header:ref, chipBefore:bu, card:$('lppSaveCard'),` (a comment `/* HDRS (2026-11-06, …) */` and one line).
  Before: nothing. After:
  `headerSave:false, chipClick:()=>{ const a=document.getElementById("hdrProj"); if(a) a.click(); }, chipHint:"the Project tab (Save and open)",`
  Uses the projectBar options of `shared/projects-ui.js` (HDRS, #884; `fixlog/shared-projects.md`): `headerSave:false` (the chip only in the header), `chipClick`, `chipHint` (the chip tooltip's "Click: …").
- **Header before:** chip · Undo · Redo · Save · Saved projects… · Print; chip click = Saved projects… dialog. **After:** chip · Undo · Redo · Print; chip click = the Project input tab (the "Save and open" card on screen), through the click handler of the hidden header link `#hdrProj` (reused). The card's buttons are unchanged.
- **Problem:** none (layout request). **Governing provision:** none (§4 does not apply).
- **Check case:** default project, another tab open: click the chip → the Project tab, the "Save and open" card on screen, no dialog; Ctrl+S on another tab (nothing saved yet) → Save as dialog; Ctrl+Shift+S → Save as dialog.
- **How verified:** main vs branch on the default project: every localStorage key (1), page text (74143 chars), Export JSON (2665 chars identical) and the printed report text (print media, 67595 chars) identical (clock times normalised); 0 console errors; chip click → card on screen, no dialog; Ctrl+S / Ctrl+Shift+S → Save as; header at 1280 / 1400 / 1920 / 390 px (390: no sideways scroll), screenshots looked at. `node tests/check-syntax.mjs "Light Pole and Sign Post.html"`; `node tests/smoke/project-library.mjs --tool lightpole`; `node tests/smoke/github-sync-tools.mjs --tool lightpole`; `node tests/smoke/home-projects.mjs --tool lightpole`; `node tests/smoke/phone-layout.mjs --tool lp`: pass. node tests/lightpole-compare.mjs (13 cases, every result, cable value, tab text and drawing): ALL CASES IDENTICAL.
- **Saved data:** no key or format changed (§5).
- **Other copies:** none. **Open items:** none.

## 2026-11-07 — PR: claude/lp-h1-ibc-embed-12ft (PR #977: https://github.com/mlococo88/All-Structural/pull/977) (LPH1: IBC Eq. 18-1 — d not over 12 ft when the lateral pressure S₁ is computed)   [§4: embedment deeper than 12 ft, less conservative before; d ≤ 12 ft identical; cable values identical]
- **Problem (review H1, 2026-11-07):** the non-constrained IBC embedment kept increasing S₁ with depth below 12 ft. IBC 2018 §1807.3.2.1 (Eq. 18-1, verified on the 2018 IBC p. 437; the same in IBC 2021) defines d for that formula as the embedment depth, but not over 12 ft for computing the lateral pressure. The tool used S₁ = S₁,tab·iso·min(d/3, 15), i.e. only the §1806.3.3 15× cap, which never binds before the 12 ft limit. Unconservative for d > 12 ft.
- **Where:** `solveEmbed()`, anchor `const S1=S1coef*`.
  - Before: `const S1=S1coef*Math.min(d/3,15);`
  - After: `const S1=S1coef*(Math.min(d,12)/3);` (parenthesised so that d ≤ 12 ft gives the same floating-point value as before).
  - Constrained branch (Eq. 18-2, S₃ "based on a depth equal to the depth of embedment", no 12 ft wording): unchanged, `S1coef*Math.min(d,15)`.
- **Worked steps / report / manual (display):** Shaft tab step 2 and Report §6 show `S₁ = S₁,tab·min(d, 12)/3 (IBC §1807.3.2.1: d ≤ 12 ft for the lateral pressure)` (before `min(d/3, 15)`, "IBC §1806.3.3: ≤ 15× tabulated"); iteration table headers "S₁ at min(d,12)/3" (before "S₁ at d/3"); Manual §4B.2 paragraph on the caps rewritten (12 ft for S₁, 15× for S₃).
- **Governing provision:** IBC 2018 / 2021 §1807.3.2.1, Eq. 18-1 (definition of d); §1806.3.3 (15× cap, now relevant to S₃ only).
- **Check case** (harness case `deep12`, added to `tests/lightpole-compare.mjs`): default project with H = 50 ft, OD 6 → 12 in, t_base 0.3125 in, clay (S₁ = 100 psf/ft), b = 2 ft, V = 170 mph. ASD P = 1,521.2 lb, h = 26.50 ft.
  - Before: S₁ = 100·13.09/3 = 436.2 psf, A = 2.34·1521.2/(436.2·2) = 4.080, **d = 13.09 ft**.
  - After: S₁ = 100·12/3 = 400 psf, A = 2.34·1521.2/(400·2) = 4.449; d = 0.5·4.449·[1 + √(1 + 4.36·26.50/4.449)] = 2.2247·(1 + 5.193) = **13.78 ft** (+5.3 %).
  - Default project: d = 6.46 ft < 12 ft, identical.
- **How verified:** `node tests/lightpole-compare.mjs --a origin/main` (21 cases): every result identical except `deep12` (emb.d, its iteration rows and d/b, the elevation drawings); only label text changed elsewhere; **cable values identical in every case**; 0 console errors. `project-library --tool lightpole`: the 4 "results identical" failures are the intended worked-step text change only (`.H`, S₁ expression); saved data opens unchanged. `check-syntax`, `phone-layout --tool lp`, `lightpole-anchor-handoff`, `lightpole-projection`, `lightpole-signviews`, `tests/engine/run.mjs lightpole` (42): pass.
- **Saved data:** no key or format change.
- **ENGINEER_CHECKS:** the "IBC 15× cap reading" item now says the cap applies to S₃ only.
- **Open item (not changed):** Eq. 18-1 defines b for a square post or footing as its diagonal; the tool uses the side for a square shaft, which gives a deeper d (conservative).

## 2026-11-07 — PR: claude/lp-h3-fixture-axial (PR #983: https://github.com/mlococo88/All-Structural/pull/983) (LPH3: IBC pole mode — fixture weights counted once in the foundation / anchor axial)   [§4: axial N lower by ΣW_fixtures × γ_D; anchor hand-off tension slightly higher; cable values identical]
- **Problem (review H3, 2026-11-07):** `evalComboDir()` adds each fixture's factored weight (`Wg = f.D*fc.Wdead + f.Di*fc.Wice`) to N, and then adds `f.D*inp.DLtotal` for the mast, where the pole-mode `calc()` sets `DLtotal = DL + pole self-weight + ΣW_fixtures`. The fixture dead load was therefore counted twice in the axial of every IBC combination (pole mode). The extra compression is unconservative for the rod tension sent to the Anchorage app (T = M·y/Σy² − P/n) and for the shaft φM_n (slightly), conservative for soil bearing. Sign mode (`DLtotal = DL + post weight`, no fixtures), `poleStress` (own N) and the LRFDLTS engine (`gravity()`) are not affected.
- **Where:**
  - `evalComboDir()`, anchor `N += f.D*(inp.DLtotal`. Before: `N += f.D*(inp.DLtotal!==undefined?inp.DLtotal:inp.DL) + f.Di*pw.WiceMast;` After: `N += f.D*(inp.DLaxial!==undefined?inp.DLaxial:(inp.DLtotal!==undefined?inp.DLtotal:inp.DL)) + f.Di*pw.WiceMast;`
  - pole-mode `calc()`, after `inp.DLtotal=inp.DL+poleSeg.totalW+fixW;`: new line `inp.DLaxial=inp.DL+poleSeg.totalW;`. `DLtotal` stays for the display ("total dead … lb").
- **Governing provision:** none changed (ASCE 7 §2.3 / §2.4 combinations; D counted once). Load model correction.
- **Check case:** default project (2 fixtures × 55 lb, pole 644.46 lb, DL 0):
  - ASD D + 0.6W axial: 906.46 → **796.46 lb** (−110 = 2 × 55; without cables, as in the review: 864.46 → 754.46 lb; the cables add 42.0 lb, unchanged).
  - LRFD 1.2D + 1.0W axial: 1,087.76 → **955.76 lb** (−1.2 × 110).
  - Rod tension, governing 1.2D + 1.0W (sent to the Anchorage app as `dr.axial` with the moment): T_max 9,655.9 → **9,677.9 lb** (+22.0 = 132/6 rods, +0.23 %).
  - Shaft φM_n (12 #6, P–M at P_u): 353,377 → 353,244 lb·ft; soil bearing q 0.156 → 0.141 ksf; base plate t_req 0.842 → 0.841 in. Embedment d and the pole member checks: unchanged.
- **How verified:** `node tests/lightpole-compare.mjs --a origin/main` (21 cases): every pole-mode case moves only in the axial-dependent values (asd/lrfd axial, found.Pu, bolts, bearing, shaft P–M, the IBC text rows that show them); the sign cases, the LTS sign cases and `poleStress` / `found.d` are identical; `ltspole` / `ltspoleb` move only in the IBC objects the page also computes in LRFDLTS mode (the LTS engine does not call `evalComboDir`; `apps/light-pole/lts-engine.js` unchanged); **cable values identical in every case**; 0 console errors. `project-library --tool lightpole`: the 4 "results identical" failures are this intended axial change only (first diffs `.inp.DLaxial`, `.allCombos[0].axial`); saved projects open. `check-syntax`, `phone-layout --tool lp`, `lightpole-anchor-handoff`, `lightpole-projection`, `lightpole-signviews`, `tests/engine/run.mjs lightpole` (42): pass.
- **Saved data:** none (DLaxial is computed, not saved).

## 2026-11-07 — PR: claude/lp-h2-rect-wind (PR #986: https://github.com/mlococo88/All-Structural/pull/986) (LPH2: IBC rectangular pole — mast wind strip width by wind direction)   [§4: rectangular poles only; round / square poles, sign posts and LRFDLTS identical; cable values identical]
- **Problem (review H2, 2026-11-07):** in IBC pole mode, `poleWindNominal()` integrated the mast wind on the width B (`poleDiaTop/Base`) for all four azimuths. A rectangular pole has its depth along x and its width B along y (input label "Depth — into-wind dimension"; drawings, `poleStress` with I_x / I_y). Wind toward 90° / 270° therefore acts on the depth face, but used B. For a 6 in wide × 10 in deep pole, the wind on the 10 in face was 40 % low (member, foundation, base plate, hand-off). The LRFDLTS engine (`windForces`) already takes B for x and the depth for y.
- **Where:**
  - `poleWindNominal()`: new `rectDir = inp.poleShape==='rect' && inp.mode!=='sign' && inp.poleDepthTop>0`; when set, each strip also gets `Fd` / `FId` (same q_z, G, C_f, Δz; width = local depth d(z), iced d + 2t_d), summed to `Fd, Md, FdI, MdI`; returned only when `rectDir` (anchor `...(rectDir?{rectDir, Fd, Md`).
  - New `lppPoleWindDir(pw, phi)` (before `// ================= ASCE 7-22 Ch.29 SOLID SIGN WIND`): returns the mast wind for azimuth φ as |cos φ|·(B values) + |sin φ|·(depth values); |cos|, |sin| < 1e-12 → 0; non-rect → the B values unchanged.
  - `evalComboDir()`, anchor `const poleWind = f.W*`: before `f.W*pw.Wpole + f.Wi*pw.FpoleI` / `f.W*pw.Mpole + f.Wi*pw.MpoleI`; after the same with `pwd = lppPoleWindDir(pw, phi)`.
  - `poleStress()`, anchor `const sList=(pw.strips`: before `F:f.W*st.F + f.Wi*st.FI`; after `F:f.W*pwd.sF(st) + f.Wi*pwd.sFI(st)` (section forces up the pole and the B₂ drift use the same strips).
  - Worked steps (Loading tab step 3, Report "Wind force on the pole shaft", structured steps "Wind on the mast"): for a rectangular pole, F_pole,90 / M_pole,90 and the |cos φ|·B + |sin φ|·depth rule are shown.
  - C_f: unchanged (Fig. 29.4-1 square row at the least dimension). Ice weight on the mast: unchanged (round-equivalent on B; open item).
- **Governing provision:** ASCE 7 §29.4 (F = q_z G C_f A_f, A_f = area projected normal to the wind). The edition labels are unchanged (M1 is a separate item).
- **Check case** (harness cases `rect610` and `rect106`: default project, rectangular HSS, t 0.25 in, cables off, no fixtures; V 115, Exp. C):
  - `rect610` (B 6 in along y, depth 10 in along x): LRFD 1.2D + 1.0W base M by azimuth 0/90/180/270°: before 14,799 / 14,799 / 14,799 / 14,799; after 14,799 / **24,664** / 14,799 / **24,664** lb·ft (= 14,799 × 10/6). AISC H1 ratio 0.348 → **0.553**; ASD embedment d 5.80 → 6.99 ft; base plate t_req 1.232 → 1.492 in (> 1.25 in provided: the Summary now shows "Base plate thickness" NG).
  - `rect106` (B 10 in, depth 6 in): 0° / 180° unchanged at 24,664 lb·ft; 90° / 270° 24,664 → 14,799. Ratio 0.553, d 6.99 ft unchanged (0° governs). Both orientations now give 24,664 lb·ft for a wind on the 10 in face.
  - Existing `nocable` case (8 in wide × 6 in deep, fixtures, V 140): max LRFD M 37,926 (90°) → 34,041 lb·ft (0°/180°); member ratio 0.699 unchanged; d 5.67 → 5.47 ft. The anchor rod T_max 16,820 → 17,772 lb and t_req 1.423 → 1.462 in **rise**, because each combination's anchors are checked at its own max-moment azimuth, which moved from 90° to 180° (bolt pattern orientation). Not changed here (existing method).
- **How verified:** `node tests/lightpole-compare.mjs --a origin/main` (23 cases): identical except `nocable`, `rect610`, `rect106` (the rectangular pole cases); sign and LRFDLTS cases identical; **cable values identical in every case**; 0 console errors. `check-syntax`, `phone-layout --tool lp`, `project-library --tool lightpole`, `lightpole-anchor-handoff`, `lightpole-projection`, `lightpole-signviews`, `tests/engine/run.mjs lightpole` (42): pass.
- **Saved data:** none.
- **Open items (not changed):** (1) IBC sign mode, rectangular post: the post drag (`signWind`, exposed clearance height) uses B for every azimuth; at edge-on wind (90°/270°, panel force 0) the depth face is loaded. Decision (pending engineer review): left as is in this PR (small, edge-on post drag only). (2) Mast ice weight on a rectangular pole uses a round of diameter B.

## 2026-11-07 — PR: claude/lp-left-breakpoint (PR #991: https://github.com/mlococo88/All-Structural/pull/991) — Check summary panel as a left column from 1200 px (was 1500 px); 240 px wide from 1200 to 1499 px (LPLB; display only, no result change)

### LPLB. The check summary is on the left at common laptop widths   [display only]
- **Decision (pending engineer review):** the engineer asked (2026-11-07, for the Retaining Wall Designer) for "the summary cards … on the left panel", most likely at a laptop width below 1500 px, where LPDC (#747) put the panel above the output tabs. The left column now starts at **1200 px** in Light Pole and Sign Post, Retaining Wall Designer (RWLB, #984) and Spread Footing (SFLB, #988) alike. From 1200 to 1499 px it is **240 px** wide and the input panel is 33 % of the rest; at 1500 px and wider 292 px as before (layout and panel widths unchanged there). Below 1200 px nothing changes (panel above the output tabs; phone layout). Same collapse button (« / » → 42 px strip) and key `lpp_dashCollapsed_v1`.
- **Output panel with the column open:** 643 px at 1200 px, 697 at 1280, 777 at 1400 (the tool already works at 670 px, a 1000 px window): no output tab is cut off or scrolls the page sideways (measured on all nine tabs at 1200, 1280, 1400).
- **Where:**
  - CSS: `  @media screen and (min-width:1500px){` (anchor `.wrap{max-width:1792px}`) → `  @media screen and (min-width:1200px){` with a comment `/* LPLB … */` above; after that block, added:
```css
  @media screen and (min-width:1200px) and (max-width:1499.98px){   /* LPLB */
    body.lppDashWide #lppDashCol{flex-basis:240px;width:240px}
    body.lppDashWide .grid2 .col-in{flex-basis:calc((100% - 240px)*.33);max-width:calc((100% - 240px)*.33)}
    body.lppDashWide.lppDashColl #lppDashCol{flex-basis:42px;width:42px}
    body.lppDashWide.lppDashColl .grid2 .col-in{flex-basis:calc((100% - 42px)*.33);max-width:calc((100% - 42px)*.33)}
  }
```
  - JS: `const LPDC={key:'lpp_dashCollapsed_v1',mq:window.matchMedia?window.matchMedia('screen and (min-width:1500px)'):null,…` → `'screen and (min-width:1200px)'` (comment `/* LPLB: was 1500px */`).
- **Formulas, factors, units, code references:** none changed (§4 does not apply). **Saved data (§5):** no key or format changed.
- **How verified:** `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: all cases identical (results, cable values, every output tab's text, drawings; 0 console errors); its readouts are taken at 1280 px, where the column is now open. No sideways page scroll at 390, 768, 1200, 1280, 1400, 1920 px. Screenshots before / after at 1200, 1280, 1400 and after at 1920, 768, 390 looked at. Tests: check-syntax; phone-layout lp 390/768; project-library lightpole.
- **Open item:** the User Manual's "Check summary panel" paragraph still says "On screens 1500 px and wider it is a column on the left"; left unchanged so the Manual tab text stays identical in the comparison. A one-line wording update can follow.

## 2026-11-07 — PR: claude/lp-manual-1200 (PR #994: https://github.com/mlococo88/All-Structural/pull/994) — User Manual: the check summary column starts at 1200 px (LPLB follow-up; text only, no result change)
- **Why:** open item of LPLB (#991): the Manual still said the column starts at 1500 px.
- **Where:** User Manual, paragraph `<b>Check summary panel</b> (2026-11-03): …` (anchor `On screens 1500 px and wider it is a column on the left`).
  - Before: `On screens 1500 px and wider it is a column on the left (« shrinks it to a strip)`
  - After: `On screens 1200 px and wider it is a column on the left (« shrinks it to a strip)`
- **Formulas, factors, units, code references:** none (§4 does not apply). **Saved data:** unchanged.
- **How verified:** `node tests/lightpole-compare.mjs --a origin/main`: ALL CASES IDENTICAL (23 cases; it does not read the Manual tab); the only diff is the one sentence; check-syntax passes.

## 2026-11-07 — PR: claude/lp-h4-lts-shaft-checks (PR #1002: https://github.com/mlococo88/All-Structural/pull/1002) (LPH4 + LPM7: the drilled-shaft checks in the LRFDLTS Summary / check panel / report; the manual-cage tie size and shear spacing in the IBC Summary)   [pass/fail reporting; no computed value changes; cable values identical]
- **Problem (review H4, M7, 2026-11-07):**
  - H4: in LRFDLTS mode the Summary card (`ltsCalc()`, "LRFDLTS summary"), the check panel (`lppDashItems()`, LTS branch) and the LTS report listed the member, deflection, base plate, weld, Broms L, anchors, fatigue and breakaway, but **no** shaft reinforcement check (ACI 318-19 P–M, shear, min / max steel, clear spacing, ties) and no torsion threshold. A failing shaft was visible only on the Shaft tab.
  - M7: in IBC check mode (manual cage), the Summary's "Tie spacing" compared s with the §25.7.2.1 limit only; the §25.7.2.2 tie size and the shear / A_v,min spacing (`T.checks.sizeMin`, `T.checks.shear`, already computed and shown on the Shaft tab) were not in `collectChecks`.
- **Where:**
  - New `lppShaftRows(push, reo, Mu, Vu)` (before `function collectChecks(ctx)`): the six existing shaft rows of `collectChecks` (moved unchanged, same order, same arguments) + for a manual cage (`reo.tie.checks`): **"Tie size"** (ACI 318-19 §25.7.2.2, required d_tie ÷ provided, ok = `T.checks.sizeMin`) and **"Tie spacing, shear"** (§22.5, §10.6.2; s ÷ min(s_shear, s_Av,min), ok = `T.checks.shear`; when V_u ≤ ½φV_c the capacity cell reads "not required (V_u ≤ ½φV_c)", ratio 0).
  - `collectChecks()`: the six shaft `push` lines replaced by `lppShaftRows(push, reo, found.Mu, found.Vu);` (`push` now returns the row). IBC rows and order are unchanged apart from the two manual-cage rows after "Tie spacing".
  - New `ltsShaftChecks(fd)` (after `ltsFoundation`): the same rows from the LTS foundation (`fd.reo`, M_u of the governing P–M pair `reo.long.govDem`, `fd.Vu`), plus "Shaft torsion ≤ φT_th (neglect)" (§22.7.1.1) when T_u > 0. `lppChkVal(c)` formats "demand / capacity".
  - LTS Summary card: one row per shaft check (OK / NOT OK, demand / capacity, ratio, code; "torsion reinforcement required (not designed here)" when T_u > φT_th). `lppDashItems()` LTS branch: one item per shaft check (link to the Shaft tab foundation card). `ltsReportModel()` Foundation section: a check table, and failing shaft checks are listed in the report's assumptions / flags.
  - `LPP_CHK2K`: "Tie size", "Tie spacing, shear" → `ties` (Shaft tab link). Summary / dashboard / IBC report: a row's `capTxt` replaces "ERR" when the capacity is not a number.
  - **L12 (part):** Shaft tab, check-mode table, row "Tie spacing, shear": the limit is now min(s_shear, s_Av,min), the value the check uses (before: s_shear only, shown as "ERR in" when V_s = 0); "not limiting (V_s = 0)" when infinite.
- **Governing provision:** ACI 318-19 §22.4, §22.5, §10.6.1.1, §25.2.3, §25.7.2.1, §25.7.2.2, §10.6.2, §22.7.1.1 (as already used on the Shaft tab); LRFDLTS Art. 13.6.2 (structural design of the shaft; ACI 318-19 per decision Q-C4). No formula, factor or limit changed: this changes which checks are reported as NG.
- **Check case** (harness cases `ltsshaftng`, `ibcshaftng`: monopost sign 16 × 8 ft, V = 130 mph, b = 2 ft, manual cage (4) #4, #3 ties @ 12 in; LTS with Broms cohesive c = 1.0 ksf):
  - LRFDLTS, before: Summary and check panel show no shaft row. After: "Shaft flexure (P–M) NOT OK, 111,341 / 40,070 lb·ft (2.779)"; "Longitudinal steel, min NOT OK, 2.26 / 0.80 in²"; "Tie spacing NOT OK, 12 / 8 in"; "Tie spacing, shear NOT OK, 12.0 / 11.0 in (1.091)"; "Shaft torsion ≤ φT_th NOT OK, 14,666 / 10,729 lb·ft (1.367); torsion reinforcement required"; check panel 8 NG. Values are the Shaft tab's (φM_n 40,070 lb·ft vs M_u 111,341 lb·ft there).
  - IBC, before: 6 checks fail; after: 7 ("Tie spacing, shear" 12.0 in > 11.0 in, NG), plus "Tie size OK".
- **How verified:** `node tests/lightpole-compare.mjs --a origin/main` (25 cases): **results identical in every case**, **cable values identical**, 0 console errors; text differences only in the Summary of `sqshaft` (manual cage: + Tie size, + Tie spacing, shear), `ltspoleb`, `ltssign2b`, `ltsshaftng` (+ the shaft rows) and `ibcshaftng`, and the Shaft-tab tie row of the two new cases. Probe: LTS `lppDashItems()` and `ltsReportModel()` list the same rows. `check-syntax`, `phone-layout --tool lp`, `project-library --tool lightpole`, `lightpole-anchor-handoff`, `lightpole-projection`, `lightpole-signviews`, `tests/engine/run.mjs lightpole` (42): pass.
- **Saved data:** none.
- **Open item (not changed):** the Shaft tab's design line in check mode reads "Provide (4) #4 … φM_n = 40,070 lb·ft ≥ M_u = 111,341 lb·ft" even when φM_n < M_u (the check-mode table above it shows NG correctly).

## 2026-11-07 — PR: claude/lp-m6-bp-geometry (PR #1009: https://github.com/mlococo88/All-Structural/pull/1009) (LPM6: base plate / anchor geometry input errors)   [behaviour: impossible geometry is now an input error; valid inputs identical; cable values identical]
- **Problem (review M6, 2026-11-07):** `lppInputErrors()` validated only the square plate (LPAS). Reproduced on main: bolt circle 9 in inside a 10 in pole → m = (BC − D)/2 < 0, **t_req 0.000 in "OK"**; round plate Ø14 in with BC 16 in (rods outside the plate) → "OK"; BC 40 in in a 36 in shaft (rods outside the concrete) → no error.
- **Where:** `lppInputErrors()`, after the LPAS square-plate block (anchor `// LPM6 (2026-11-07, review M6)`). Before: nothing. After, when BC > 0 and n ≥ 1 (both code modes, pole and sign):
  1. every rod clear of the pole / post: R − d_rod/2 > the outline at the rod's azimuth (round D/2; square / rect.: the rectangle with the depth along x and the width along y, distance min(h_x/|cos a|, h_y/|sin a|));
  2. round plate (Ø > 0): R + d_rod/2 < Ø/2;
  3. rods within the shaft cage: BC + d_rod ≤ 12b − 2·cover.
  Each failure is a blocking input error (the existing input-error box; no results shown), with the numbers and the fix in the message.
- **Governing provision:** none (geometry). Item 3 is a detailing choice: Decision (pending engineer review): the rods are required inside the cage (b − 2·cover) rather than merely inside the concrete, the conservative reading of the review's recommendation.
- **Check cases** (harness cases added): `bcinside` (BC 9 in, default Ø10 in pole base): before t_req 0.000 in OK; after "Bolt circle BC 9.00 in: a rod is not clear of the pole (rod inner edge at 4.00 in from the centre, pole face at 5.00 in)…". `bpsmall` (plate Ø14 in, BC 16 in, rod 1 in): "the rods (BC 16.00 in + rod 1.000 in = 17.00 in) are not inside the plate". `bcoutside` (BC 40 in, plate Ø44 in, b 3 ft, cover 3 in): "41.00 in is outside the shaft cage (b − 2·cover = 36.0 − 2·3.00 = 30.00 in)". In these three blocked cases the harness reports the cable readout as differing because B shows no results; the cable model is not touched.
- **Harness:** case `bolts15` (1.5 in rods on BC 20 in) had the default Ø20 in plate, i.e. the rods outside the plate (now an error); it gets `bpDia: '24'` so that it keeps testing the large-rod path (applied to both sides).
- **How verified:** `node tests/lightpole-compare.mjs --a origin/main` (28 cases): every valid case **results identical, cable values identical**, 0 console errors; the three new cases are blocked on the branch as intended. `check-syntax`, `phone-layout --tool lp`, `project-library --tool lightpole`, `lightpole-anchor-handoff`, `lightpole-projection`, `lightpole-signviews`, `tests/engine/run.mjs lightpole` (42): pass.
- **Saved data:** keys and format unchanged. A saved project with such a geometry now opens with the input error (its data is kept; correcting BC, the plate or the shaft restores the results).

## 2026-11-07 — PR: claude/lp-m4-slope-check (PR #1018: https://github.com/mlococo88/All-Structural/pull/1018) (LPM4: LRFDLTS Art. 10.4.2.1 — the 0.35 in/ft slope is a check for poles with a moment load application)   [pass/fail: a check where it was information; no computed value changes; cable values identical]
- **Problem (review M4, 2026-11-07):** the 2017 interim, Art. 10.4.2.1 (p. 10-1, verified in the PDF), states as "shall" requirements under Service I: the top deflection of vertical supports with *transverse* load applications limited to 2.5 % of the height, and the top slope of vertical supports with *moment* load applications limited to 0.35 in/ft. C10.4.2.1 explains the moment load as the eccentric dead load of single or unbalanced multiple horizontally mounted arms. The tool showed both as information only (engineer decision Q-B4, 2026-11-02), so a pole with a single long arm passed with a slope of 1.7 × the limit.
- **Decision (pending engineer review):** the slope becomes a check when the pole has a moment load application, i.e. the engine's existing `momentLoad` (pole mode, an arm-mounted fixture, and a non-zero dead-load slope from ΣW·a, so balanced twin arms do not count). Otherwise (balanced arms, fixtures on the pole top, signs) it stays information. The 2.5 % H limit stays information: it applies to transverse load applications (strain poles, span wires), which the LRFDLTS mode does not model (cables are not supported there). This revises Q-B4 for the slope only; listed in ENGINEER_CHECKS for confirmation.
- **Where:** `apps/light-pole/lts-engine.js`, `deflection()`, anchor `checks.push({ key: 'slope'`. Before: `applies: false`, flag "Information only (engineer, 2026-11-02)…". After: `applies: momentLoad`, flag "Checked: the arm-mounted fixtures put an unbalanced dead-load moment on the pole …" or "Information only: no unbalanced arm-mounted dead load (not a moment load application, C10.4.2.1)." `c.ok` follows from the existing `!c.applies || c.ratio <= 1`.
  - Tool: the "Known limits / basis" Deflection row (anchor `["Deflection","Art. 10.4.2.1:`) and the LTS report flag (anchor `flags.push('Deflection: 10 % H`) reworded.
  - Test: `tests/engine/lightpole-lts.test.mjs` HC-1 (unbalanced arm) now expects `momentLoad` true and `applies` true; HC-2 (sign) still `applies` false.
- **Governing provision:** AASHTO LRFDLTS 1st Ed. (2015) with the 2017 Interim Revisions, Art. 10.4.2.1 and C10.4.2.1.
- **Check case** (harness case `ltsarm`: LRFDLTS, 40 ft round pole 8 → 4.5 in, t 0.1196 in, one fixture 55 lb at 40 ft on a 12 ft arm at 0°, EPA 1.6 ft², Broms cohesive c 1.0 ksf): Service I top slope 0.605 in/ft vs 0.350 in/ft. Before: "information (1.728)". After: **NOT OK (1.728)** in the Post tab, the LTS Summary, the check panel and the report. The default LTS pole (twin arms 0° / 180°, balanced): still information (0.134 in/ft, 0.384).
- **How verified:** `node tests/lightpole-compare.mjs --a origin/main` (29 cases): results identical in every case, **cable values identical**, 0 console errors; text differences only in the slope row / flag of the LTS pole cases (`ltspoleb`, `ltssign2b`, `ltsshaftng`: flag wording only; `ltsarm`: information → NOT OK). `tests/engine/run.mjs lightpole` (42), `check-syntax`, `phone-layout --tool lp`, `project-library --tool lightpole`, `lightpole-anchor-handoff`, `lightpole-projection`, `lightpole-signviews`: pass.
- **Saved data:** none.

## 2026-11-07 — PR: claude/lp-m3-anchor-ductility (PR #1025: https://github.com/mlococo88/All-Structural/pull/1025) (LPM3: LRFDLTS Art. 5.16.3 anchorage ductility stated in the Summary, check panel, report and the Anchorage hand-off notes)   [text / status only; no computed value; inputsHash unchanged; cable values identical]
- **Problem (review M3, 2026-11-07):** LRFDLTS 1st Ed. (2015) Art. 5.16.3 (p. 5-37, verified; not revised by the 2017 interim) requires the anchorage to be proportioned so that the steel anchor reaches its minimum tensile strength before the concrete fails (C5.16.3: a ductile steel failure is intended). The anchors are designed in the Anchorage app (ACI 318-19 Ch. 17), but neither the LTS Summary nor the hand-off said that ductility is required.
- **Where:**
  - New constant `LTS_DUCT_NOTE` (before `function ltsAnchorPayload()`): the requirement in one sentence (concrete-governed tension strengths > rod steel strength N_sa, or anchor reinforcement; verify in the Anchorage app; not checked here).
  - `ltsAnchorPayload()`: `notes.push(LTS_DUCT_NOTE)` after the C5.16.3 / ACI note. `notes` are outside the hashed body, so `inputsHash` is unchanged (probe: `85b30707` on main and branch, LTS default pole with Broms); the payload has 4 notes instead of 3.
  - LTS Summary card: new row "Anchorage ductility — required, verify in the Anchorage app … — Art. 5.16.3, C5.16.3 (p. 5-37)".
  - Check panel (`lppDashItems`, LTS): item "Anchorage ductility", status n/a ("verify in the Anchorage app"), link to the base plate card.
  - Anchorage tab, LTS base plate card note: a sentence on Art. 5.16.3.
  - LTS report, "Anchor rods": the note as a warning item.
  - HANDOFF.md §4.11: one line saying the LRFDLTS notes carry the Art. 5.16.3 requirement (no schema field; the receiver shows sender notes and does not check it).
- **Decision (pending engineer review):** note only; no machine-readable flag and no Base Plate & Anchor Designer change. The Anchorage app already shows the sender notes (`S.bxSrc.anchorGroup.notes`, "Sender notes"); a flag that makes it check ductility (ACI 318-19 §17.10.5.3-type comparison of the concrete modes with N_sa) is a later cross-tool item.
- **Governing provision:** AASHTO LRFDLTS 1st Ed. (2015) Art. 5.16.3 and C5.16.3 (paraphrased). IBC mode: not changed (no such general requirement in ACI 318-19 outside §17.10 seismic).
- **Check case:** default project, LRFDLTS, Broms cohesive c 1.0 ksf: the Summary shows the row; the hand-off notes end with "Anchorage ductility required (LRFDLTS Art. 5.16.3, C5.16.3): …"; `inputsHash` 85b30707 before and after.
- **How verified:** `node tests/lightpole-compare.mjs --a origin/main` (29 cases): results identical in every case, **cable values identical**, 0 console errors; text differences only in the LTS pole / sign cases' Summary (+1 row) and Anchorage card (the sentence). `lightpole-anchor-handoff` (LP → BP round trip), `check-syntax`, `phone-layout --tool lp`, `project-library --tool lightpole`, `lightpole-projection`, `lightpole-signviews`, `tests/engine/run.mjs lightpole`: pass.
- **Saved data:** none (the hand-off schema and hash are unchanged).

## 2026-11-07 — PR: claude/lp-m1-editions (PR #1037: https://github.com/mlococo88/All-Structural/pull/1037) (LPM1: IBC mode labelled IBC 2021 / ASCE 7-16; K_d = 1.0 for round masts labelled as the conservative choice; ice t_d and K_z flagged)   [labels and citations only; no computed value; cable values identical]
- **Problem (review M1, 2026-11-07):** the IBC mode said "IBC 2021 · ASCE 7-22". IBC 2021 adopts ASCE 7-16 (S. K. Ghosh, IBC 2018 → 2021 structural changes, in the references folder). The engine already uses ASCE 7-16 K_z constants and the ASCE 7-22 round-mast K_d (1.0) and ice form.
- **Decision (pending engineer review):** the IBC mode is labelled **IBC 2021 / ASCE 7-16** throughout. No computed value changes:
  - K_d = 1.0 for round and multi-sided masts / posts is kept and labelled as the ASCE 7-22 value, conservative against ASCE 7-16 Table 26.6-1 (0.95). Square / rectangular 0.90 and sign panels 0.85 are the same in both editions.
  - K_z (α, z_g, 2.01 of `Kz()`) are the ASCE 7-16 Table 26.11-1 values: unchanged, comment added that they were not re-verified against the printed table (the ASCE 7-16 PDF in the references folder is damaged).
  - Atmospheric ice: the design thickness t_d(z) = t·f_z·K_zt^0.35·I_i and the risk-category maps are the ASCE 7-22 Ch. 10 form. These mentions (25) keep "ASCE 7-22", and the scope line, references, drawings note and the ice-thickness input say that the ice follows the ASCE 7-22 form and that ASCE 7-16 Ch. 10 (its design-thickness equation and map basis) was not verified. Not changed (cannot verify).
- **Where:** `Light Pole and Sign Post.html`, 88 user-visible labels and comments "ASCE 7-22" → "ASCE 7-16" (every one not about ice; method: a script that kept the mentions within ~45 characters of "Ch. 10", "§10.", "ice map", "ice thickness" or "ICE", and the "map for the structure's Risk Category" note). Reworded where the editions differ:
  - K_d placement (Manual §wind, Loading step, Report): ASCE 7-16 has K_d in q_z (Eq. 26.10-1); ASCE 7-22 moved it to the force equation; the product q_z·K_d is the same.
  - K_d notes (input help, `kdUsedNote`, Manual table row, `K_d` comment, old-save message): "round 1.0 — the ASCE 7-22 value, conservative vs 0.95 in ASCE 7-16".
  - References: "ASCE/SEI 7-16 (adopted by IBC 2021)"; Report "Codes" row; drawings general note "ASCE 7-16 (WIND, COMBINATIONS; ICE BY THE ASCE 7-22 CH. 10 FORM)"; scope line.
  - `Kz()`: comment only.
- **Governing provision:** IBC 2021 Ch. 16 / Ch. 35 referenced standard ASCE 7-16 (per the Ghosh summary); ASCE 7-16 Table 26.6-1, Eq. 26.10-1, Table 26.11-1 (from knowledge, not verified in the damaged PDF).
- **Check case:** default project: every result, cable value and drawing identical; the Summary basis line reads "IBC 2021 · ASCE 7-16 (adopted by IBC 2021; ice t_d by the ASCE 7-22 Ch. 10 form)"; K_d used "1.00 (mast, cables, fixtures) — ASCE 7-16 Table 26.6-1 (round mast 1.0: the ASCE 7-22 value, conservative vs 0.95 in ASCE 7-16)".
- **How verified:** `node tests/lightpole-compare.mjs --a origin/main` (29 cases): **results identical, cable values identical, drawings identical**, 0 console errors; the text differences are the edition labels and the reworded K_d / ice sentences only. `project-library --tool lightpole`: its 4 "results identical" failures are the report text (`.H`, the "ASCE 7-16 §26.9" label) only. `check-syntax`, `phone-layout --tool lp`, `lightpole-anchor-handoff`, `lightpole-projection`, `lightpole-signviews`, `tests/engine/run.mjs lightpole`: pass.
- **Saved data:** none. **ENGINEER_CHECKS:** the edition, K_d, K_z and ice items added to the Light Pole line.
- **Open items (flagged, not changed):** (1) the ice design thickness under ASCE 7-16 Ch. 10 (equation and map basis) — verify; (2) K_z constants against the printed ASCE 7-16 Table 26.11-1; (3) Fig. 29.3-1 s/h = 0.7 row (review M8) — not implemented (cannot verify).

## 2026-11-07 — PR: claude/lp-m2-soil-torsion (PR #1046: https://github.com/mlococo88/All-Structural/pull/1046) (LPM2: drilled-shaft soil torsion — a REVIEW row instead of a silent pass, both modes)   [status display only; no computed value; cable values identical]
- **Problem (review M2, 2026-11-07):** LRFDLTS Art. 13.6 (p. 13-2, verified in the 2015 PDF) requires drilled shafts to provide adequate resistance to the applied torsion; it gives no method. The tool computes the groundline T_u (monopost sign Cases B/C, 0.15b torsion, arm wind) but not the soil's torsional resistance. This was a note on the Shaft tab (open item N2, accepted 2026-11-02); the LTS Summary and the check panel showed nothing, so the shaft looked passed.
- **Where:**
  - LTS Summary card (anchor `// LPM2`): when T_u > 0, row "Shaft — soil torsion resistance — **REVIEW — not computed**: T_u = … lb·ft at the groundline; check the soil's torsional resistance around the shaft (geotechnical engineer) — Art. 13.6 (p. 13-2) …".
  - `lppDashItems()`, LTS branch: item "Shaft — soil torsion resistance", status **warn** (REVIEW), "not computed: check per Art. 13.6", link to the foundation card.
  - `lppDashItems()`, IBC branch: the same REVIEW item per stack when `found.Tu > 0` (the Summary already had the red "NOT CHECKED" warning; now the check panel shows it too), link to the shaft torsion step.
  - LTS report: a "REVIEW: soil torsion resistance not computed …" flag.
- **Governing provision:** AASHTO LRFDLTS 1st Ed. (2015) Art. 13.6 (paraphrased). No formula added.
- **Check case:** LTS monopost sign 16 × 8 ft, V 130 mph, b 2 ft, Broms cohesive: T_u = 14,666 lb·ft → the Summary row and a REVIEW chip (check panel count "4 NG 1 REVIEW"). IBC default monopost sign: T_u = 6,411 lb·ft → REVIEW chip. Default pole (balanced arms, T_u = 0): no row.
- **How verified:** `node tests/lightpole-compare.mjs --a origin/main` (29 cases): results identical, **cable values identical**, 0 console errors; text differences only in the LTS Summary of the cases with T_u > 0 (`ltsshaftng`, `ltsarm`: +1 row). Probe of `lppDashItems()` / `#lppDashCnt` for the two check cases. `check-syntax`, `phone-layout --tool lp`, `project-library --tool lightpole`, `lightpole-anchor-handoff`, `lightpole-projection`, `lightpole-signviews`, `tests/engine/run.mjs lightpole`: pass.
- **Saved data:** none.
- **Future feature (not built):** a soil torsion check, e.g. T_r = φ·f_s·(πD·L)·D/2 with f_s = α·c (cohesive) or β·σ′_v (cohesionless) from geotechnical inputs, or an "allowable torque from the geotechnical report" input compared with T_u (review M2 check case: f_s ≥ 4.587 / (π·3·4.64·1.5) = 0.070 ksf). Needs the engineer's choice of method (ENGINEER_CHECKS, Light Pole: "soil torsion for monopost shafts").

## 2026-11-07 — PR: claude/lp-low-notes (PR #1053: https://github.com/mlococo88/All-Structural/pull/1053) (LPL1, L2, L5, L7, L9, L10, L13, L14: citations, notes and a REVIEW item; review LOW findings)   [no computed value; cable values identical]
- **L1 (min-steel citation):** `lppShaftRows()`, anchor `push('Longitudinal steel, min'`. Before: code "ACI 318-19 §10.6.1.1" for every minimum. After: "ACI 318-19 §10.6.1.1" when ρ_min = 1 %, "ACI 318-19 §10.6.1.1 with §10.3.1.2 (½A_g)" for the 0.5 % default (1 % of a reduced effective area of at least ½A_g). Citation only. Open item (not changed): §10.3.1.2 also bases the strength on that reduced area, while the tool uses the full section; and the drilled-shaft minimums of IBC §1810.3.9.4 (IBC mode) or AASHTO LRFD 10th Art. 5.12.9.5.2 (0.8 %, LRFDLTS Art. 13.6.2 → BDS, not applied per Q-C4) are not used — engineer to decide.
- **L2 (drilled-shaft clear spacing):** new `lppShaftFlowMsg(reo)` (before `function collectChecks`). AASHTO LRFD 10th Ed. (2024) Art. 5.12.9.5.2 (verified in the PDF; Art. 10.8.3.9.3 refers drilled shafts to it) asks for a clear distance between longitudinal bars of at least the greater of 5 × the maximum aggregate size and 5.0 in. **Decision (pending engineer review):** not a pass/fail check (the shaft is designed to ACI 318-19, §25.2.3 stays the check); when the clear spacing is below 5.0 in a REVIEW item appears in the check panel (both modes), a warning line in the IBC Summary and a REVIEW row in the LTS Summary. The auto design is unchanged. Check case: IBC default with a manual cage of 24 #8: clear spacing 2.70 in → "Shaft cage clear spacing (concrete flow)" REVIEW. Default project (≈ 7 in): nothing shown.
- **L5 (worked-step equation):** `apps/light-pole/lts-engine.js`, `memberSteps`, anchor `id: 'm.lam'`. Before: the equation always read b = B_max − 3t. After: that form without a corner radius, b = (B_max − 2t) − 2·min(r_i, 4t) with r_i (the rule actually used; the note already said so). Display only.
- **L7, L9, L10 (LTS known limits):** `LTS_LIMITS` gains three sentences: vertical bearing of the shaft (Art. 13.6.1.2) not checked; ice on square / rectangular supports taken as radial ice on a round of the side width; no "one arm loaded" case for balanced twin arms (Art. 3.9.4.1 is for overhead cantilevers).
- **L13 (design wall):** the wall-thickness input label (set in JS, anchor `$('poleTwTopLabel').innerHTML`) gains the note "the design wall: for ERW HSS and pipe, AISC 360-16 §B4.2 takes 0.93 × nominal".
- **L14 (Massachusetts):** the Soil class input note: 780 CMR 10th Ed. §1806.3 (verified in the MA code PDF) has the lateral values set by the registered design professional, and §1806.3.1 lets isolated poles use 2 × the values of the MA Table 1806.2; the IBC presets do not apply there, use Custom.
- **Not changed:** L4 (§E7 already warned), L6 (IBC compression r at each section; +0.010 on the default ratio, unconservative but small — open item), L11 (fixture C_f 1.1 on the EPA, conservative — left, as instructed), L12 (the "ERR in" part fixed in LPH4 #1002; the LTS arm-force worked step for 90° not added — open item). L3 and L8 follow in their own PRs.
- **How verified:** `node tests/lightpole-compare.mjs --a origin/main` (29 cases): **results identical, cable values identical**, 0 console errors; text differences only in the min-steel code column and the LTS known-limits sentence. Probe for L2 (above). `check-syntax`, `phone-layout --tool lp`, `project-library --tool lightpole`, `lightpole-anchor-handoff`, `lightpole-projection`, `lightpole-signviews`, `tests/engine/run.mjs lightpole`: pass.
- **Saved data:** none.

## 2026-11-07 — PR: claude/lp-l8-square-weld (PR #1060: https://github.com/mlococo88/All-Structural/pull/1060) (LPL8: LRFDLTS base weld of a square / rectangular tube as a rectangular line weld)   [§4: square / rect. LTS posts only, less conservative (was a circle of D = side); round identical; cable values identical]
- **Problem (review L8, 2026-11-07):** `LpLts.baseWeld()` treated every fillet-welded socket as a line around a circle of diameter D = the side, S_w = πD²/4. For a square tube the weld runs around the square (S_w = B² + B²/3), so the circle overstated the weld force by about 1.7× and failed welds that are adequate.
- **Where:**
  - `apps/light-pole/lts-engine.js`, `baseWeld(ba, Bs, w)`, anchor `if ((w.shape === 'square' || w.shape === 'rect')`. New branch for `w.shape` 'square' / 'rect' with `w.Bx` (side along x = the rectangular depth H_t) and `w.By` (side along y = the width B):
    - S_wx = B_y·B_x + B_x²/3, S_wy = B_x·B_y + B_y²/3 (in²), L_w = 2(B_x + B_y);
    - q_n = B·|M_x|/S_wx + B·|M_y|/S_wy + P/L_w (the corner, both bending components added);
    - q_s = |V_x|/(2B_x) + |V_y|/(2B_y) + T/(2B_xB_y) (shear on the two walls parallel to it; torsion by the closed-section shear flow T/2A);
    - q = √(q_n² + q_s²); φR_n unchanged (0.75·0.60F_EXX·0.707w). Round: the circle formula, unchanged.
  - Tool, LTS base plate card (anchor `wd=LpLts.baseWeld(`): passes `shape: inp.poleShape, Bx: (rect ? poleDepthBase : poleDiaBase), By: poleDiaBase`. Worked step `wd.q`: a rectangular-weld form (equation, substitution with B·M_x, B·M_y, P, V_x, V_y, T, then q) for square / rect.; the circle step for round, unchanged.
  - `tests/engine/lightpole-lts.test.mjs`: new hand-check test (below); HC-1 round weld test unchanged.
- **Governing provision:** LRFDLTS 1st Ed. (2015, 2017 Interim) Art. 5.14 refers to AWS D1.1 and gives no weld-strength method; AISC 360-16 §J2.4 strength (as before, decision Q-B5). The weld-as-a-line elastic method is an engineering method, as before for the circle. Decision (pending engineer review): corner superposition of M_x and M_y and the sum of the shear terms (conservative within the method).
- **Check case** (harness case `ltssignsq`: LRFDLTS monopost sign 12 × 6 ft, square post 8 × 8 × 0.25 in, r_i 0.5 in, V 115 mph, p 1.5 ft, ice 0.5 in, Broms cohesionless; 5/16 in E70 fillet, φR_n = 6.9595 kip/in). Governing Extreme I (DC max), case 1 normal to 0°: B·M = 403.77 kip-in, P = 0.861 kip, V_x = 3.123 kip, T = 55.04 kip-in.
  - Before (circle, S_w = π·8²/4 = 50.27 in²): q_n = 403.77/50.27 + 0.861/(π·8) = 8.067; q_s = 2·3.123/(π·8) + 2·55.04/(π·64) = 0.796; q = 8.106 kip/in → **ratio 1.165 NOT OK**.
  - After (square line, S_w = 64 + 64/3 = 85.33 in², L_w = 32 in): q_n = 403.77/85.33 + 0.861/32 = 4.759; q_s = 3.123/16 + 55.04/128 = 0.625; q = 4.800 kip/in → **ratio 0.690 OK**.
  - Engine test (B_x 8, B_y 6, M_x 10,000 / M_y 5,000 lb·ft × B 1.02, P 1,000, V_x 500, V_y 300 lb, T 2,000 lb·ft): S_wx 69.333, S_wy 60.0 in², q_n 2.8211, q_s 0.30625, q 2.8377 kip/in, ratio 0.4077.
- **How verified:** `node tests/lightpole-compare.mjs --a origin/main` (30 cases): results identical in every case, **cable values identical**, 0 console errors; only `ltssignsq` moves (its weld row on the Summary and the Anchorage card). Probe of `lppLtsLast.wd` on main and branch (numbers above). `tests/engine/run.mjs lightpole` 43 / 43; `check-syntax`, `phone-layout --tool lp`, `project-library --tool lightpole`, `lightpole-anchor-handoff`, `lightpole-projection`, `lightpole-signviews`: pass.
- **Saved data:** none.

## 2026-11-07 — PR: claude/lp-l3-14d (PR #1068: https://github.com/mlococo88/All-Structural/pull/1068) (LPL3: IBC mode — the 1.4D combination added, ASCE 7-16 §2.3.1 combination 1)   [§4: one new LRFD combination; no governing result changes in the 30 harness cases; existing cable values identical, the new combination's cable reactions added]
- **Problem (review L3, 2026-11-07):** the IBC-mode LRFD combinations (`COMBOS`) lacked 1.4D (ASCE 7-16 §2.3.1, combination 1). It rarely governs a pole (small gravity), but it is a required combination (e.g. the shaft axial of an eccentric single arm).
- **Where:** `const COMBOS={`, after `A5`: new `L6:{name:'1.4D',fam:'LRFD',D:1.4,W:0,Di:0,Wi:0}`. Placed last so that the existing combinations keep their keys, order and indices (every table, envelope and the cable readout keep their existing entries). It runs through the same paths as the other LRFD combinations (pole and sign mode, `evalComboDir` / `evalSignCombo`, B₂, anchors / base plate, shaft P–M, the anchorGroup hand-off).
- **Governing provision:** ASCE 7-16 §2.3.1 (load combination 1), as adopted by IBC 2021 §1605 (from knowledge; the ASCE 7-16 PDF in the references folder is damaged — the 1.4D combination is the same in ASCE 7-16 and 7-22).
- **Check case:** default project: new row "LRFD 1.4D", axial N = 1.4·(644.46 pole + 110 fixtures) + 1.4·42.0 cable dead load (sV 58.8 lb) = **1,115 lb**; no wind, so V and M come only from the fixture / cable dead loads; not governing (1.2D + 1.0W stays the governing LRFD combination for every check). In the `arms` case the B₂ *range* shown widens from 1.000–1.0811 to 1.000–1.0815 (B₂ of 1.4D); the B₂ used by each check is unchanged.
- **Cables:** the cable model is unchanged; `tests/lightpole-compare.mjs` reports "cable values: 1 DIFFER" in the 16 cabled cases, and in every one the only difference is the added entry `.combos.L6` (the 1.4D cable reactions). All existing cable values are identical.
- **Hand-off:** the anchorGroup payload carries the 1.4D combination at each azimuth, so its `inputsHash` changes: an Anchorage result received before this change shows as stale until the anchors are sent again (as for any changed input).
- **How verified:** `node tests/lightpole-compare.mjs --a origin/main` (30 cases): the only result differences are the array lengths (combination lists 10 → 11, anchor combination lists 5 → 6), the sign report's `lrfdB2['1.4D']` = 1 and the `arms` B₂ range; the Loading tab gains one row per case; 0 console errors. `project-library --tool lightpole`: its 4 "results identical" failures are these lengths only. `check-syntax`, `phone-layout --tool lp`, `lightpole-anchor-handoff`, `lightpole-projection`, `lightpole-signviews`, `tests/engine/run.mjs lightpole`: pass.
- **Saved data:** none (combinations are not saved).

## 2026-11-08 — PR: notes-lp (PR #1177: https://github.com/mlococo88/All-Structural/pull/1177) (LPNL-1: long notes as a bold lead line and a list — input panel and every output tab; display only, no result change)

### LPNL-1. Long notes split into a lead line and a list   [display only] [no result change] [cable values identical]
- **Request (engineer, 2026-11-07, approved for all apps):** "There are some sections that just have this block of text. Can we split this up into a numbered list or bullets or some other way so it's not just a text that will likely get overlooked because it's too long." Pattern as Spread Footing SFNL-1 / SFNL-2 (#1167). Part 1 of 2: the input panel and the output tabs (Geometry, Summary, Loading, Post, Anchorage, Shaft, Drawings) in both code modes; the Report picks the same notes up. Part 2 (LPNL-2): the notes written only for the Report, and the Manual.
- **Rule used:** a note is long if it is over ~300 characters, has 3 or more sentences, or carries several facts in one paragraph. It becomes a one-line bold lead, then a list with bold lead words. Every sentence, number, citation and link is kept, in the same order; only lead words, list-start capitals and end punctuation are new. New lead words carry no digits, so the digit sequence of every tab and of the Report is unchanged.
- **New helper** (top of the main script, after `const $=id=>`), anchor `/* LPNL (2026-11-08, engineer`:
  ```js
  function lpNL(lead,items,o){ o=o||{}; const L=o.ol?'ol':'ul';
    const li=(items||[]).filter(Boolean).map(x=>'<li>'+(Array.isArray(x)?'<b class="lpNLk">'+x[0]+'</b> '+x[1]+(x[2]?'<ul class="lpNLs">'+x[2].filter(Boolean).map(s=>'<li>'+s+'</li>').join('')+'</ul>':''):x)+'</li>').join('');   // [lead words, text, sub-items]
    return (o.act||[]).filter(Boolean).map(a=>'<div class="flag lpNLa">'+a+'</div>').join('')+(lead?'<div class="lpNLl">'+lead+'</div>':'')+(li?'<'+L+' class="lpNLu">'+li+'</'+L+'>':''); }
  ```
  A note becomes `<div class="eq-why lpNL">${lpNL(lead,[[leadWords,text],…])}</div>` (the note's own class kept: `tbl-note`, `eq-why`, `flag`, `lts-basis`, `lts-dev`, `eq-result`); `null` items are skipped (conditional facts). A `<p>` that now holds a list became a `<div>` (a list cannot sit in a `<p>`): `#sgTorsionNote`, `#sgPostIntro`, `#soilClassNote` and the notes listed below.
- **CSS** (after `.tbl-note{…}`), tool-scoped, no new colours (inherits the note / flag colours), print keeps a list item on one page:
  ```css
  .lpNL .lpNLl{font-weight:700;margin:0 0 1px}
  .lpNL .lpNLu,.lpNL .lpNLs{margin:2px 0 3px;padding-left:18px}
  .lpNL .lpNLu>li,.lpNL .lpNLs>li{margin:1px 0}
  .lpNL .lpNLa{margin:2px 0 4px}
  @media print{.lpNL .lpNLu>li,.lpNL .lpNLs>li{break-inside:avoid}}
  ```
- **`eqB(title, why, tex, result, ref)`**: `why` and `result` may now be `[lead, items]` (drawn with `lpNL`); a string is drawn as before.
- **Report** (`lprxItems`, the walk of the worked sections, before `if(cl.contains('verdict'))`): an `.lpNL` element gives one Report note per part — the action line, the lead, each item as "• …", each sub-item as "   – …"; a part inside a `.flag` (or an action line) keeps `warn`:
  ```js
  if(cl.contains('lpNL')){ const w=cl.contains('flag'); ch.querySelectorAll('.lpNLa,.lpNLl,.lpNLu>li,.lpNLs>li').forEach(p=>{ const c=p.cloneNode(true); c.querySelectorAll('.lpNLs').forEach(x=>x.remove());
    const t=lprxText(c,has), sub=p.parentElement.classList.contains('lpNLs'); if(t) note((p.tagName==='LI'?(sub?'   – ':'• '):'')+t,w||p.classList.contains('lpNLa')); }); return; }
  ```
  Report helper for the notes the Report writes itself (after `const lprxPlain=`): `lprNL(lead,items,o)` returns `{type:'note'}` items in the same shape ("• lead words text", "   – sub-item"; `o.warn` for warning notes). The sign report copies `#sgTorsionNote` into a `<div class="eq-why lpNL">` (was a `<p>`).
- **Strings that are also read elsewhere keep their exact text** and gain a display form built from the same parts:
  - `LPP_BP_VERIFY` (Summary, Anchorage tab, Report): now `LPP_BP_VERIFY_P.m+' — '+LPP_BP_VERIFY_P.b+'. Not checked: '+…'(1) …; (2) …; (3) ….'`, byte-identical (checked in the page); `lppBpVerifyNL(esc)` = lead "Base-plate method: bending line … double-nut base." → Basis / Not checked: (1), (2), (3).
  - `LPP_BP_SQ` and `lppBpSqNote(inp)` (square plate): from `LPP_BP_SQ_P` (3 sentences) and `lppBpSqPlate(inp)`, byte-identical; `lppBpSqNL(inp,esc)` → Same as a circular plate / Basis / Plate.
  - `lppOffAxisMsg(L)`: from `lppOffAxisP(L)`, byte-identical; `lppOffAxisNL(L)` → lead "Wind directions: the tool checks …" → Not on these axes / Remedy.
  - The anchorGroup hand-off notes (`lppAnchBaseNotes`, `LTS_DUCT_NOTE`, the LRFDLTS notes) are not touched: the hand-off text and `inputsHash` are unchanged.
- **Notes changed (anchor = the old opening text → new lead → item lead words).** Exact before / after: the PR diff.
  - Input panel: 1. "Cables (catenary spans) are not supported in the AASHTO LRFDLTS mode." → To design a cabled pole / Cable inputs. 2. Broms panel "Optional. These inputs feed only…" → Used by / Default. 3. `#soilClassNote` (`applySoilClass`) "<name> — <desc>." → IBC Table 1806.2 / Presumptive.
  - Geometry: 4. "Pole discretized into 10 equal segments" → Taper / Evaluated at each segment midpoint / Hollow circular section. 5. Sign 3D view info `#lp3dInfo` (`lpsvInfo`): "… results." → Panel / Shaft(s) or Shafts not drawn / Wind arrow / Projection / Soil / Not inputs, drawn nominal.
  - Summary: 6. The red "not checked" box (`warnL`, was items joined with `<br>`) → lead "Not checked, or to verify:", one item per warning; the natural-frequency item with two sub-items, the off-axis item with two, the base-plate item as Basis / Not checked (1), (2), (3). 7. "M above is the first-order moment." → LRFD checks / ASD embedment. 8. "Utilization = demand ÷ capacity." → Bars over 85% / Minimum-type checks. 9. LRFDLTS "Known limits (accepted by the engineer, 2026-11-02):" (`ltsDevHTML`) → one item per `LTS_LIMITS` entry (the array is unchanged).
  - Loading: 10. "Each fixture generates a wind drag force" → lead "Fixture loads:" → Wind / Ice weight / Eccentric moment. 11. "Each load source shown in isolation" → Every source / Vertical sources / Bare wind and wind-on-ice / Cable-local. 12. "The base demand is evaluated for wind blowing toward" → lead "How the base demand is found:" → Wind directions / Vectors / Governs / Row shown. 13. "Every ASCE 7 combination is evaluated at its own worst wind direction." → Embedment / Reinforced-concrete shaft. 14. Sign "Every combination applies" (Loading card and the sign Report §2) → Ice / Envelope / Governing rows. 15. Wind worked: "The velocity pressure combines" → lead "Velocity pressure:" → Combines / Directionality factor K_d. 16. "The mast is treated as a slender element" → Factors / Strips / For reference only. 17. "Rectangular pole: the values above are for wind toward 0° / 180°" → Other directions / C_f. 18. Ice (`iceWorkedHTML`) "The entered t = … is the nominal (map) ice thickness." → lead "Design ice thickness t_d:" → Entered t / Increase / Mast / Fixtures / Cables. 19. "Each fixture contributes four effects:" → Wind / Iced wind / Ice weight / Eccentric gravity moment / Fixed vector / Worked for. 20. "Round arm, OD …" → Wind toward φ / C_f. 21. "The fixture wind acts at the arm tip" → Pole / Bolts / Shaft / Opposite arms. 22–26. Cable worked (`cableWorkedHTML`, `eqB`): wind pressure on the cables (Two conditions with two sub-items / C_f), its result line (Height / Cables: G), "Glaze ice weight and wind line loads" (lead "Cable line loads:" → Ice / Wind), stiffness method (Cube-root law / E and A / Every source / In a combination), sag method (Every source / Horizontal sag / In a combination). 27. "Ice and wind-on-ice follow the identical form" → In a load combination / Never together. 28. "Every cable's along-cable pull acts along its own plan azimuth θ" → Net pull / Two service cases. 29–33. Sign load path (`signLoadPathHTML`): intro (Steps / Same computation), the ice flag "Ice on signs (added 2026-11-01)." (Applied / Panel ice weight / Post ice / Wind / Worked in), "Wind fully loads the panel only blowing normal to it" (Edge-on directions / Two posts or One post), "Post drag on the exposed column." (Exposed length / Exposed height / Integration), "Per post and case: V = share + F_drag; …" (Windward post / Reversed wind / Design, or One post / Factored). 34. Sign ice worked (`signWindWorkedHTML`) "Design ice thickness at the panel centroid" → lead "Ice on the sign:" → Design ice thickness / Panel ice volume / Wind / Cases B/C / Posts. 35. `#sgTorsionNote`: monopost → lead "Torsion (monopost): …, T = F·e." → Post / Anchor bolts / Shaft, with the action line "Limitation: the torsional resistance of the soil around the shaft is not checked — verify with the geotechnical engineer." on top (warning style); two posts → lead "Limitation: torsion is not evaluated." → Two posts / Design. 36. LRFDLTS combinations note → lead "Combinations not used, and how ice and wind enter:" → LL (Art. 3.6) / No ice-plus-wind combination / Ice / Wind from any direction / Service III and Fatigue I/II. 37. LRFDLTS "Factored base actions…, first order" → Second order / Load cases / Sign convention / Units / Bold.
  - Post: 38. "At each segment cut" → lead "How the pole is checked:" → Demand / Classification / Flexure / Compression / Interaction / Governing section. 39. "Governing run: …" → Second-order (P-Δ) effects with four sub-items (P_story, Δ_H, R_M, H·L). 40. LRFDLTS deflection "Service I (Table 3.4-1): …" → Deflection / Units (/ Per post).
  - Anchorage: 41. "Send the anchor groups" → Sent / Basis. 42. "Anchor design is done in the Anchorage app" → Workflow / This tool / Anchor inputs. 43. "Double-nut (leveling-nut) base" → Rod force / Plate / LRFDLTS mode / Combination shown. 44. The base-plate method box (IBC Anchorage tab, LRFDLTS base plate card) from `lppBpVerifyNL`. 45. The square-plate note (both modes) from `lppBpSqNL`. 46. LRFDLTS "Anchor rods: designed in the Anchorage app" → LRFDLTS Arts. 5.16–5.16.3 / Ductility (Art. 5.16.3) (/ Values per post).
  - Shaft: 47. Off-axis fixtures flag (`lppOffAxisNL`). 48. "P-Δ (AISC 360-16 App. 8): B₂ = …" flag → Applied / Pole stress. 49. "The embedment is a service-level (ASD) check." → Governing combination / Vectors. 50. Soil class / custom S₁ note (`embedWorkedHTML`) → Depth / Isolated pole / Evaluated at. 51. "The circular section is analyzed by strain compatibility" → Equilibrium / Capacity / By hand. 52. "Strength reduction factor φ" → Depends on / Tied transverse reinforcement (three sub-items). 53. "Concrete shear strength, ACI 318-19 Table 22.5.5.1" → Branch / ρ_w. 54. Check-mode flag "Check mode — user-specified reinforcement." → Bars / Checks / Overall. 55. `#sgPostIntro`, two posts → Design / Cases B and C. 56–62. Broms (`bromsWorkedHTML`): "Reference check only" (Design embedment / Why shown); "Why the two methods are not directly comparable." (IBC §1807.3 / Broms / Driven by LRFD / Expect a difference); the "Overload & understrength factors" box as three lead-and-list groups (Ultimate condition / Overload / Understrength; "So should a factor be applied? …" → Against, For, each with two sub-items; "This tool therefore defaults to φ = 1.00, …" → Lowering φ / Names); "Code-faithful basis." (Comparable / A margin on the soil); "Taken from the governing LRFD combination" (M_F / V_F / Overload factor λ); φ < 1: "Reducing the soil resistance by φ" (If you adopt the factor); "Maximum shaft moment check." (Peak moment / Result / Reinforcement / Your judgement). 63. LRFDLTS foundation basis → lead "Foundation basis:" → Lateral embedment / Resistance factor / Shaft reinforcement (/ Per post). 64. LRFDLTS "Torsion: T_u = …" → Soil / Concrete torsion threshold.
  - Drawings: 65. "One DXF file (AutoCAD R12, …):" → Sheets / Layers / Values. (`SharedDxf.PRINT_NOTE`, a shared file, is not changed.)
  - Report (notes written by `lprModel` that repeat a tab note): the base-plate and square-plate notes (`lprNL(...lppBpVerifyNL(x=>x))`, `lprNL(...lppBpSqNL(inp,x=>x))`), in §6 of both modes and in the IBC Assumptions list; the LRFDLTS Known limits (`lprNL(…, LTS_LIMITS)`).
- **Not changed (decisions, pending engineer review):** the masthead description (`#appSub`) and scope line (`#lppScope`): header lines, and the Report reads `#lppScope` as its Scope row; the hidden `.disclaim` paragraph in `#cardSource` (never shown); `SharedDxf.PRINT_NOTE` (shared file); notes under ~250 characters with 2 short sentences (for example the sign z̄ note, the Broms q and cohesionless notes, the d/b flags); input-error messages; table cells.
- **Formulas, factors, units, code references:** none changed (§4 does not apply). **Saved data:** none. **Hand-off:** unchanged (notes and `inputsHash`).
- **Check case:** default project, Anchorage tab, base-plate worked step: before one 586-character paragraph "Double-nut (leveling-nut) base: no grout bearing, … Combination shown: 1.2D + 1.0W."; after the lead "Double-nut (leveling-nut) base: no grout bearing, so the compression side also loads the plate through the leveling nuts." and four items (Rod force, Plate with b_eff = πD/n and φ_f = 0.90, LRFDLTS mode with Art. 5.6.3, Combination shown: 1.2D + 1.0W). Report §6: the same lead and four "• " lines.
- **How verified:** `node tests/lightpole-compare.mjs --a origin/main` (30 cases): results identical, **cable values identical** in every cabled case, drawings identical, 0 console errors; only text lines differ (the restructured notes). Headless probe, origin/main vs the branch, the 30 harness cases: the digit sequence of every tab's full text (all tabs, the Report tab, the check panel, the input panel) and of the Report model is identical in all 30 cases. `LPP_BP_VERIFY`, `LPP_BP_SQ` and `lppOffAxisMsg` checked equal to the old strings in the page. Screenshots at 1440 and 390 px. Tests: see the PR.
- **Other copies:** none.

## 2026-11-08 — PR: notes-lp-2 (PR #1183: https://github.com/mlococo88/All-Structural/pull/1183) (LPNL-2: long notes as a bold lead line and a list — notes written only for the Report, and the Manual; display only, no result change)

### LPNL-2. Report-only notes and Manual paragraphs as a lead line and a list   [display only] [no result change] [cable values identical]
- **Request:** as LPNL-1 (#1177), part 2 of 2. Same rule, same helpers (`lpNL`, `lprNL`, the `eqB` `[lead, items]` form, the `lprxItems` walk of `.lpNL`); no new CSS except one Manual margin line.
- **Report — IBC worked sections (`buildReport`, read into the Report by `lprxItems`)** (anchor = the old opening text → new lead → item lead words):
  1. `<p class="varsub">Wind: ASCE 7 velocity pressure. …` → lead "Design basis:" → Wind / Ice / Embedment / Shaft / Envelope (now a `div.varsub.lpNL`).
  2. "Wind pressure is derived from the basic wind speed" → Two heights.
  3. `eqB` "K_z accounts for the increase in wind speed" → Profile.
  4. `eqB` "The velocity pressure converts the wind speed into a pressure." → K_zt / K_e / V / The 0.00256 coefficient / The directionality factor K_d.
  5. "The wind pushes directly on the pole shaft." → Fixtures / Nominal.
  6. `eqB` "The distributed wind on the shaft is integrated over … strips" → Each strip / C_f / For reference.
  7. `eqB` result "Base moment M_pole = Σ F_i·z_i = …" (rectangular pole only; otherwise unchanged) → Rectangular pole / Depth face / Between the axes.
  8. "The nominal loads (dead, wind, ice, wind-on-ice) are combined" → Line loads / Cables / Result.
  9. "The foundation uses the correct family for each check:" → Embedment / Shaft / Highlighted.
  10. "Because fixtures sit on arms at different azimuths" → Directions / Vectors / Governs.
  11. "The pole is checked as a cantilevered HSS." → Sections / Given below with numbers substituted (four sub-items).
  12. "This section expands the governing ASD combination" → Cables, or Catenary system disabled.
  13. `eqB` "The shaft is treated as a rigid pier" → Soil pressure / Formula / Iterative.
  14. "Beyond lateral stability, the base of the shaft" → Service axial load / Skin friction.
  15. "The concrete shaft is designed as a reinforced-concrete column" → Check mode, or Auto-sized / Bars / Ties.
  16. `eqB` "A conventional column requires ρ = 1% of the gross area." (half-area variant) → ACI §10.3.1.2 / This drilled shaft.
  17. `eqB` "Where the anchor bolts are embedded" → Tighter ties / Top zone.
- **Report — notes written by `lprModel` / `ltsReportModel`:**
  18. §1 "Every value in this report is the value the tool computes on its tabs" → Worked sections.
  19. §1 "Equations are shown symbolically" → Result line / Title block.
  20. §4 "ASCE 7-16 §2.3 (LRFD) and §2.4 (ASD)" → Wind directions / Cable loads.
  21. LRFDLTS "Anchor rods": the ductility note from `LTS_DUCT_P` → lead "Anchorage ductility required (LRFDLTS Art. 5.16.3, C5.16.3):" → Proportion / Check (warning style). `LTS_DUCT_NOTE` is now `LTS_DUCT_P.join(' ')`, byte-identical: it is sent in the anchorGroup hand-off notes, so the hand-off text and `inputsHash` are unchanged.
  22. LRFDLTS "Breakaway": one item per checklist line (was the lines joined with a space).
  23. LRFDLTS "Assumptions and decisions": one "• " note per item (was one note joined with " • "); the "REVIEW: soil torsion resistance not computed …" item in the warning style, in its place.
- **Manual** (`manRender`, new block `{nl:[lead, items], c:'manP'|'manNote'|'manWarn'|'manKey'}` drawn as `<div class="<c> lpNL">${lpNL(…)}</div>`; CSS `.manBody .manP.lpNL{margin:7px 0}`): 39 paragraphs over ~250 characters or with several facts (anchor = the old opening text): 0.2 "Every result is derived symbolically"; 0.5 "The program is generic."; 1.x "The mode selector at the top of the input column", "Save (Ctrl+S, …)"; 2.x "Every input in the program is listed below", "The presumptive table is a fallback", "IBC §1806.3.4 permits doubling", "Non-constrained is the default", "A round shaft is axisymmetric", "The Broms inputs (c for cohesive; …)", "Anchor reinforcement."; 3.x "Check summary panel (2026-11-03)", "The banner states either", "What you would put on a drawing", "Bars above 85% are amber.", "Plan and elevation schematics", "One block per cable", "Every source uses the same catenary law", "Anchor rod design (ACI 318-19 Chapter 17) is done in the Anchorage app", "In design mode:", "The calculation package"; 4A "Velocity pressure follows ASCE 7-16 Eq. 26.10-1", "All pulls act along each cable's plan azimuth θ", "On a monopost, Cases B and C"; 4B "IBC §1807.3 treats an embedded pole as a rigid short pier", "S₁ is the allowable lateral bearing evaluated at one-third", "The depth increase is capped.", "The presumptive values in Table 1806.2 are allowable", "Service axial load over the base area"; 4C "φ for flexure follows §21.2.1", "The §10.3.1.2 allowance", "Bolt forces come from a linear-elastic distribution", "Where anchor reinforcement developed into the breakout cone"; 4D "It exists because IBC §1807.3 is a presumptive", "IBC §1807.3 is a service check"; 5 "Verification is not certification."; L "The code switch at the top of the input column", "Known limits of the LRFDLTS mode", "Summary (verdicts and status), …". Short call-outs (under ~250 characters) are left as they are.
- **Formulas, factors, units, code references:** none changed (§4 does not apply). **Saved data:** none. **Hand-off:** unchanged.
- **Check case:** default project, Report §5 (embedment): before one 445-character note "The shaft is treated as a rigid pier free to rotate at grade (no slab restraint). It resists … the solution is iterative."; after the lead "The shaft is treated as a rigid pier free to rotate at grade (no slab restraint)." and three "• " lines (Soil pressure: … S₁ is evaluated at one-third the embedment depth; Formula: …; Iterative: because S₁ depends on d, …). Manual 4B "The depth increase is capped.": the 12 ft / 4 times / 15 ft / 15 times / §1807.3.2.1 / §1806.3.3 / §1806.3.4 facts in three items.
- **How verified:** `node tests/lightpole-compare.mjs --a 55d517b` (30 cases): results identical, cable values identical, drawings identical, 0 console errors. Digit probe vs 55d517b, 30 cases: digit sequence of every tab, the check panel, the input panel and the Report model identical. Manual: every part rendered on both, digit sequences identical, no fact dropped (word check: only connecting words replaced by lead words). Tests: see the PR.
- **Other copies:** none.
