# Fix log — BasePlateAnchorDesigner.html

Governing basis used for fixes: ACI 318-19 (Ch. 17, Table 25.4.2.5, §22.8); AISC Design Guide 1, 2nd Ed.; AISC 360-16 J3.10; ASTM A449.

## 2026-10-04 — PR: claude/fix-baseplate (PR link added after merge)

All check cases below were computed by running the page's own script in node
(`vm` sandbox, DOM stubbed) on the original file and on the fixed file. Units: kip, in, ksi.
Default model = the tool's default state (18×18×1.5 A36 plate, W12X65, 2×2 1″ F1554-36,
h_ef 12″, 30×30×36 pedestal, f'c 4 ksi cracked, 1″ grout) unless stated.

### F1. Pryout φ is always 0.70   [calc change] [more conservative]
- **Where:** function `pryout` (≈ line 1740). Anchor text: `const phi = 0.70;` (search `pullout and PRYOUT always take`)
- **Problem:** φ = 0.75 was used whenever shear rebar was present. Pryout is always Condition B.
- **Governing provision:** ACI 318-19 Table 17.5.3 (pullout and pryout: Condition B, φ = 0.70 for cast-in).
- **Before:**
  ```js
  /* ACI 318-19 Table 17.5.3, concrete shear (pryout): Condition A 0.75, Condition B 0.70 */
  const phi = S.vRebar.present?0.75:0.70;
  ```
- **After:**
  ```js
  /* ACI 318-19 Table 17.5.3: pullout and PRYOUT always take the Condition B value
     (0.70 for cast-in anchors), whether or not supplementary reinforcement is
     present. (Previously 0.75 when shear rebar was present.) */
  const phi = 0.70;
  ```
  Label in the Step 5 `vars` changed to `"pryout: always Condition B (0.70) for cast-in anchors, ACI 318-19 Table 17.5.3"`.
- **Check case:** default model, shear rebar present, combo P = −50, Vx = 20. N_cbg = 44.617, V_cpg = 2.0 × 44.617 = 89.234 kip → before φV_cpg = 0.75 × 89.234 = 66.93 kip → after 0.70 × 89.234 = 62.46 kip.
- **How verified:** node run of `comboCapacities` before/after.
- **Other copies of this code:** none (Light Pole / Concrete Anchor have their own anchor code).

### F2. ψ_g = 1.3 for Grade 100 reinforcement   [calc change] [more conservative]
- **Where:** function `tensionDevLengths` (≈ line 2743). Anchor text: `const psi_g = (fy>=100)?1.3`
- **Problem:** Grade 100 used ψ_g = 1.15 (the Grade 80 value).
- **Governing provision:** ACI 318-19 Table 25.4.2.5 (Gr 40/60: 1.0; Gr 80: 1.15; Gr 100: 1.3).
- **Before:** `const psi_g = (fy>=80)?1.15:1.0;`
- **After:** `const psi_g = (fy>=100)?1.3:((fy>=80)?1.15:1.0);   /* ACI 318-19 Table 25.4.2.5: Gr 40/60 1.0, Gr 80 1.15, Gr 100 1.3 */`
- **Check case:** #6 Gr 100, f'c 4 ksi, cover 2, s 6 → (c_b+K_tr)/d_b = 2.5 (cap), ψ_s = 0.8, ψ_t = ψ_e = 1.0. ℓ_d = (3/40)(100000·0.8·ψ_g)/(√4000·2.5)·0.75 → before (ψ_g 1.15) 32.73 in → after (ψ_g 1.3) 37.00 in. Hand: 0.075·80000·1.3/(63.246·2.5)·0.75 = 37.00 ✓.
- **How verified:** node run.
- **Other copies of this code:** the rebar development snippets in other tools (see AUDIT §2.1) — not touched here.

### F3. Tension-breakout A_Nc from the anchors in tension only   [calc change] [more conservative]
- **Where:** function `tensionBreakoutGroup` (≈ line 1240), new helper `breakoutExtents` (after it), `comboCapacities` call (≈ line 2168), `pryout` (≈ line 1749), `drawBreakout` (≈ line 7269).
  Anchor text: `const tp=(tensPts&&tensPts.length)? tensPts : g.pts;`
- **Problem:** A_Nc used the extents of ALL anchors while the demand (ΣT) and ψ_ec,N used the tension anchors only. With moment, A_Nc was overstated.
- **Governing provision:** ACI 318-19 §17.6.2.1, Fig. R17.6.2.1(b) — projected area of the anchors in tension.
- **Before:**
  ```js
  function tensionBreakoutGroup(nT, ca_min, eccX, eccY){
  ...
    const x1=Math.max(g.xmin-1.5*hef, -C.Bx/2 - pxo), x2=Math.min(g.xmax+1.5*hef, C.Bx/2 - pxo);
    const y1=Math.max(g.ymin-1.5*hef, -C.By/2 - pyo), y2=Math.min(g.ymax+1.5*hef, C.By/2 - pyo);
    const ANc=Math.max(0,(x2-x1))*Math.max(0,(y2-y1));
    const ANcRatio=Math.min(ANc/ANco, nT);
  ```
  (pryout) `const Ncbg = tb.ANcRatio * tb.psi_ed * tb.psi_c * tb.psi_cp * tb.Nb;`
  (comboCapacities) `const tb = tensionBreakoutGroup(nT, ca_minT, combo.eccN_x, combo.eccN_y);`
- **After:**
  ```js
  function tensionBreakoutGroup(nT, ca_min, eccX, eccY, tensPts, condA){
  ...
    const tp=(tensPts&&tensPts.length)? tensPts : g.pts;
    const ext=breakoutExtents(tp, hef, C, pxo, pyo);
    const ANc=ext.ANc;
    const ANcRatio=Math.min(ANc/ANco, nT);
    const extAll=breakoutExtents(g.pts, hef, C, pxo, pyo);
    const ANcAll=extAll.ANc, ANcRatioAll=Math.min(ANcAll/ANco, nT);
  ...
  function breakoutExtents(pts, hef, C, pxo, pyo){
    const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
    const xmin=Math.min(...xs), xmax=Math.max(...xs), ymin=Math.min(...ys), ymax=Math.max(...ys);
    const ux1=xmin-1.5*hef, ux2=xmax+1.5*hef, uy1=ymin-1.5*hef, uy2=ymax+1.5*hef;
    const x1=Math.max(ux1, -C.Bx/2 - pxo), x2=Math.min(ux2, C.Bx/2 - pxo);
    const y1=Math.max(uy1, -C.By/2 - pyo), y2=Math.min(uy2, C.By/2 - pyo);
    return {xmin,xmax,ymin,ymax,ux1,ux2,uy1,uy2,x1,x2,y1,y2,
            ANc:Math.max(0,(x2-x1))*Math.max(0,(y2-y1))};
  }
  ```
  (pryout — unchanged numerically, uses the all-anchor cone) `const Ncbg = tb.ANcRatioAll * tb.psi_ed * tb.psi_c * tb.psi_cp * tb.Nb;` and the pryout Step 1/Step 4 text uses `tb.ANcAll` / `tb.ANcRatioAll`.
  (comboCapacities) `const tensPts = (combo.perAnchor||[]).filter(p=>p.t>1e-9);` then `tensionBreakoutGroup(nT, ca_minT, combo.eccN_x, combo.eccN_y, tensPts, condAT)`.
  (drawBreakout) extents now from `breakoutExtents(tensB.length? tensB : g.pts, hef, C, pxo, pyo)` with `tensB=c.perAnchor.filter(p=>p.t>1e-9)`; the A_Nco square is centred on the tension cluster; the canvas fit uses `2*max(|ux1|,|ux2|)` so an off-centre cone is not cut off.
- **Check case:** 2×2, s = 12 in, h_ef = 12, pedestal 120×120×60, combo P = 0, My = 600 kip-in. Tension anchors (−6, ±6), T = 21.564 each, ΣT = 43.127. A_Nco = 9·144 = 1296. Before A_Nc = (12+36)² = 2304 → ratio 1.778 → N_cbg = 113.15, φN_cbg = 79.21, DCR 0.545. After A_Nc = 36 × 48 = 1728 → ratio 1.333 → N_cbg = 84.86, φN_cbg = 59.40, DCR 0.726. Pryout N_cbg stays 113.15 (unchanged). Default model, combo 0.9D+1.0W: breakout (T) DCR 0.220 → 0.264.
- **How verified:** node run; all tab builders (incl. `drawBreakout`) exercised with a stub DOM, no exceptions.
- **Other copies of this code:** none. Note: ψ_ed,N still uses the minimum edge distance of ALL anchors (conservative) — see O5.

### F4. Side-face blowout corner factor   [calc change] [more conservative]
- **Where:** function `sideFaceBlowout` (≈ line 1371). Anchor text: `const cornerApplies = (ca2 < 3*ca1) && !groupApplies0;`
- **Problem:** the (1 + c_a2/c_a1)/4 reduction for a single anchor near a corner was missing.
- **Governing provision:** ACI 318-19 §17.6.4.1.1; §17.6.4.2 (group: N_sb "without modification for a perpendicular edge distance").
- **Before:**
  ```js
  const Nsb=160*ca1*Math.sqrt(Abrg)*1.0*Math.sqrt(fc*1000)/1000; /* kip, single anchor */
  ```
- **After:**
  ```js
  const sEdge0 = nearIsX ? (g.sy||0) : (g.sx||0);
  const groupApplies0 = (nT>1 && sEdge0>1e-6 && sEdge0 < 6*ca1);
  const ca2 = nearIsX ? Math.min(g.ca_y_pos,g.ca_y_neg) : Math.min(g.ca_x_pos,g.ca_x_neg);
  const cornerApplies = (ca2 < 3*ca1) && !groupApplies0;
  const c21 = Math.min(Math.max(ca2/ca1, 1.0), 3.0);
  const alphaCorner = cornerApplies ? (1 + c21)/4 : 1.0;
  const Nsb0=160*ca1*Math.sqrt(Abrg)*1.0*Math.sqrt(fc*1000)/1000; /* kip, single anchor, Eq.(17.6.4.1) */
  const Nsb=alphaCorner*Nsb0;
  ```
  Return object adds `ca2,Nsb0,alphaCorner,cornerApplies`; the derivation shows the corner line.
- **Note:** my first version also applied the factor to the §17.6.4.2 group case. The PROFIS validation cases (CB Plaza Struct 2 v1/v2) then fell to −50% against PROFIS. Re-reading §17.6.4.2 ("N_sb … without modification for a perpendicular edge distance"), I restricted the factor to the single-anchor case. Both PROFIS cases match again (0.0%).
- **Check case:** single 1″ heavy-hex anchor (A_brg 1.163), plate 8×8 centred on a 10×10 pedestal, h_ef = 14, f'c 4; c_a1 = c_a2 = 5 < 0.4h_ef = 5.6. N_sb = 160·5·√1.163·√4000/1000 = 54.56 kip. Before φN_sb = 0.70 × 54.56 = 38.20 kip (DCR 1.05 at N = 40). After ×(1+1)/4 = 0.5 → 27.28 → φN_sb = 19.10 kip (DCR 2.09).
- **How verified:** node run; PROFIS validation harness (`runValidationCase`) before/after.
- **Other copies of this code:** none.

### F5. Plain-rod shear V_b = min(Eq. a, Eq. b)   [calc change] [more conservative]
- **Where:** `shearBreakout` → `evalEdge` (≈ line 1600). Anchor text: `const Vb = Math.min(VbA,VbB);`
- **Governing provision:** ACI 318-19 §17.7.2.2.1.
- **Before:**
  ```js
  const Vb = castInHeaded ? Math.min(VbA,VbB) : VbA;
  const VbGov = (!castInHeaded) ? "a" : (VbB<=VbA ? "b" : "a");
  ```
- **After:**
  ```js
  const Vb = Math.min(VbA,VbB);
  const VbGov = (VbB<=VbA ? "b" : "a");
  ```
  The label for a plain rod reads `"plain rod: V_b is also the LESSER of (a) and (b), §17.7.2.2.1"`.
- **Check case:** default model, head = plain rod, Vx = 10. c_a1 = 21, ℓ_e = 8, d_a = 1. (a) = 7·8^0.2·1·√4000·21^1.5/1000 = 64.58; (b) = 9·√4000·21^1.5/1000 = 54.78. Before V_b = 64.58 → φV_cbg = 16.91. After V_b = 54.78 → φV_cbg = 14.35 kip.
- **How verified:** node run.
- **Other copies of this code:** none.

### F6. Narrow/thin-member c_a1 limit for shear breakout   [calc change] [LESS CONSERVATIVE — see note]
- **Where:** `shearBreakout` → `evalEdge` (≈ line 1580). Anchor text: `§17.7.2.1.2 — narrow, thin member`
- **Problem:** §17.7.2.1.2 was not implemented.
- **Governing provision:** ACI 318-19 §17.7.2.1.2. When c_a2 < 1.5c_a1 on both sides and h_a < 1.5c_a1, c_a1 in A_Vc, A_Vco, V_b, ψ_ed,V and ψ_h,V is limited to max(c_a2,max/1.5, h_a/1.5, s/3).
- **Before:**
  ```js
  function evalEdge(e, parallel){
    const c1=Math.max(e.ca1,0.01);
  ...
    const Vcbg=AVcRatio*1.0*psi_edV*psi_cV*psi_hV*Vb*(parallel?2:1);
  ```
- **After:**
  ```js
  function evalEdge(e, parallel){
    const c1raw=Math.max(e.ca1,0.01);
    const isX = (e.name==="+x"||e.name==="-x");
    const pP = isX ? g.ca_y_pos : g.ca_x_pos, pN = isX ? g.ca_y_neg : g.ca_x_neg;
    let c1=c1raw, narrow=null;
    if(pP<1.5*c1raw && pN<1.5*c1raw && ha<1.5*c1raw){
      const along=[...new Set(g.pts.map(p=>+(isX?p.y:p.x).toFixed(6)))].sort((a,b)=>a-b);
      let sMax=0; for(let i=1;i<along.length;i++) sMax=Math.max(sMax, along[i]-along[i-1]);
      const lim=Math.max(Math.max(pP,pN)/1.5, ha/1.5, sMax/3);
      if(lim<c1raw){ c1=Math.max(lim,0.01); narrow={c1raw, lim, ca2max:Math.max(pP,pN), sMax}; }
    }
  ...
    const psi_hV_e = narrow ? Math.min(psi_hV, (ha<1.5*c1)? Math.sqrt(1.5*c1/ha) : 1.0) : psi_hV;
    const Vcbg=AVcRatio*1.0*psi_edV*psi_cV*psi_hV_e*Vb*(parallel?2:1);
  ```
  (the later `const isX = …` line inside `evalEdge` was removed). The returned and displayed ψ_h,V is now the governing edge's value (`psi_hVg`). Step 1 prints the limit when it applies.
- **IMPORTANT, less conservative:** The reviewer said this omission was unconservative. Running the numbers shows the opposite. Limiting c_a1 *raises* the computed capacity. A_Vc is already clipped by the edges and h_a, and A_Vco ∝ c_a1² falls faster than V_b ∝ c_a1^1.5. The commentary (R17.7.2.1.2) describes the unlimited calculation as overly conservative, which agrees. The provision is a "shall" in ACI 318-19, so I implemented it as instructed. **Please confirm you want it.** If not, revert this one hunk.
- **Check case:** single 1″ anchor, plate 8×8 offset y = −20 on a 10 × 60 pedestal, H = 20, h_ef = 8, Vy = +5. c_a1 = 50, c_a2 = 5 on both sides, h_a = 20 < 75. Limit = max(5/1.5, 20/1.5, 0) = 13.33.
  - Before: V_b = 201.25, A_Vc = 200, A_Vco = 11250, ψ_ed = 0.72 → φV_cbg = 1.80 kip.
  - After: V_b = 9·√4000·13.33^1.5/1000 = 27.71, A_Vco = 800, A_Vc/A_Vco = 0.25, ψ_ed = 0.7 + 0.3·5/20 = 0.775 → V_cbg = 5.37 → φV_cbg = 3.76 kip (+108%).
  - PROFIS case "msa3a": φV_cbg 17.56 → 18.06 kip (+2.9%).
- **How verified:** node run; validation harness.
- **Other copies of this code:** none.

### F7. Condition A φ only when the reinforcement intercept check passes   [calc change] [more conservative]
- **Where:** new function `conditionA` (≈ line 2118). φ in `tensionBreakoutGroup`, `sideFaceBlowout` and `shearBreakout` now takes a `condA` argument. `comboCapacities` passes it. `shearCases(cb, condA)` passes it through, and `buildVCaseTab` calls `shearCases(cb, conditionA("shear", CC))`.
- **Problem:** φ = 0.75 was granted whenever rebar was "present", even when the bars missed the failure surface.
- **Governing provision:** ACI 318-19 Table 17.5.3 and R17.5.3 (Condition A requires supplementary reinforcement that crosses the failure surface).
- **Decision taken:** "passes" means the tool's existing intercept check credits at least one bar/leg (`tensionRebarIntercept(cc).nEff > 0`, `shearRebarIntercept(cc).nEff > 0`).
- **Before (×3):** `const phi = S.tRebar.present?0.75:0.70;` (breakout T, side-face) and `const phi = S.vRebar.present?0.75:0.70;` (breakout V)
- **After:**
  ```js
  let __condAGuard=false;
  function conditionA(kind, cc){
    const R=(kind==="tension")? S.tRebar : S.vRebar;
    if(!R || !R.present || !cc || __condAGuard) return false;
    if(!cc.__condA) cc.__condA={};
    if(cc.__condA[kind]!==undefined) return cc.__condA[kind];
    __condAGuard=true;
    let ok=false;
    try{
      const ic=(kind==="tension")? tensionRebarIntercept(cc) : shearRebarIntercept(cc);
      ok=!!(ic && ic.nEff>0);
    }catch(e){ ok=false; }
    finally{ __condAGuard=false; }
    cc.__condA[kind]=ok;
    return ok;
  }
  ...
  const phi = (condA===true)?0.75:0.70;
  ```
- **Check case:**
  - Default model with tension and shear rebar present at their defaults. Intercept nEff = 0/16 bars and 0/8 legs. Combo 0.9D+W: before φ = 0.75 for breakout T and V → after 0.70. φN_cbg 25.92 → 20.16 kip; this also includes F3. φV_cbg 15.37 → 14.35 kip.
  - Positive case: pedestal 60×60×48, perRow #4 bars, gauge 2, extBelow 12 gives nEff = 8/16, so φ stays 0.75.
  - Shear breakout in the "Shear Distribution" tab's case table outside `buildVCaseTab` (i.e. the `computeAll` case ranking) uses 0.70. That ranking is unaffected because φ is common to all cases.
- **How verified:** node run, brute-force search for an nEff > 0 layout.
- **Other copies of this code:** none.

### F8. Round HSS: 0.80D for m and n   [calc change] [more conservative]
- **Where:** `plateBending` (≈ line 2365). Anchor text: `const isRound=(!S.col.custom && S.col.shapeType!=="W"`
- **Governing provision:** AISC DG1 2nd Ed. §3.1.3 / AISC Manual Part 14 (round HSS and pipe: 0.8D).
- **Before:**
  ```js
  const m=(P.N-0.95*col.d)/2;
  const n=(P.B-(isW?0.80:0.95)*col.b)/2;
  ...
  const faceY=0.95*dcol/2, faceX=(isW?0.80:0.95)*bcol/2;
  ```
- **After:**
  ```js
  const isRound=(!S.col.custom && S.col.shapeType!=="W" && hssOf(S.col.shape).kind==="HSSround");
  const fM=isRound?0.80:0.95, fN=isRound?0.80:(isW?0.80:0.95);
  const m=(P.N-fM*col.d)/2;
  const n=(P.B-fN*col.b)/2;
  ...
  const faceY=fM*dcol/2, faceX=fN*bcol/2;
  ```
  The arm note and the Step 1 text are updated for the round case.
- **Check case:** HSS8.625 round, 18×18×1.5 plate, combo 1.2D+1.6L (q = 0.617 ksi).
  - Before: m = n = (18 − 0.95·8.625)/2 = 4.903 → t_req = 0.957 in, DCR 0.638.
  - After: m = n = (18 − 0.8·8.625)/2 = 5.550 → t_req = 5.55·√(2·0.617/(0.9·36)) = 1.083 in, DCR 0.722.
- **How verified:** node run. **Other copies:** none.

### F9. DG1 large eccentricity: real bearing DCR, and a blocking "plate too small" error   [calc change + robustness]
- **Where:** `dg1Uniaxial` (≈ line 1103), `bearingCheck` (≈ line 3773), `buildConcTab` (bearing dcrBox), `validateInputs` (≈ line 8594), `buildOutput` blocker header.
- **Problem:**
  - In the large-e regime q = f_p,max by construction, so the bearing DCR was always 1.00.
  - When disc < 0 (no DG1 solution), Y was NaN, T_u was NaN, and nothing was flagged.
- **Governing provision:** AISC DG1 2nd Ed. §3.3/§3.4: a solution requires (f + N/2)² ≥ 2P(e+f)/q, otherwise the plate must be enlarged.
- **Before:**
  ```js
  let qmax=0, gov="—";
  cc.combos.forEach(c=>{ const q=Math.max(c.resX.q||0,c.resY.q||0); if(q>qmax){qmax=q;gov=c.name;} });
  const dcr=qmax/bc.phiFp;
  ```
- **After (dg1Uniaxial, large branch, just before `if(disc>=0){`):**
  ```js
  out.bearDCR = (Pc*f + M) / (0.5*fpmax*Wb*Math.pow(f + L/2, 2));
  out.bearBasis = "moment";
  out.noSolution = !(disc>=0);
  ```
  (bearingCheck)
  ```js
  let qmax=0, gov="—", dcr=0, basis="q/fp", govAxis="";
  cc.combos.forEach(c=>{
    const q=Math.max(c.resX.q||0,c.resY.q||0); if(q>qmax) qmax=q;
    [["about y (along B)",c.resX],["about x (along N)",c.resY]].forEach(([ax,r])=>{
      const d=(r && r.bearDCR!==undefined)? r.bearDCR : ((r&&r.q)||0)/bc.phiFp;
      if(isNaN(d) || d>dcr){ dcr=isNaN(d)?Infinity:d; gov=c.name; basis=(r&&r.bearBasis)||"q/fp"; govAxis=ax; }
    });
  });
  ```
  validateInputs re-runs `dg1Uniaxial` per combo and axis. If `noSolution` is set, it adds a blocking error `{block:true, code:"DG1", …}`; with an open (air-gap) stand-off this is a warning only. `buildOutput` shows "Output withheld — invalid input, or a configuration with no valid solution." when any blocker is not a §17 code limit.
- **Derivation:** with q′ = f_p,max·B, disc = q′²(f+N/2)² − 2q′(P·f + M). So disc ≥ 0 ⇔ (P·f + M)/[q′(f+N/2)²/2] ≤ 1. That is the required moment about the anchor line divided by the largest moment the bearing block can supply.
- **Check case:** default model (φf_p = 2.7625 ksi, f = 6, N = B = 18).
  - P = −100, My = 1200: before bearing DCR 1.000 (by construction) → after (100·6 + 1200)/(0.5·2.7625·18·15²) = 1800/5594 = 0.322. Y = 2.65, T = 31.6, both unchanged.
  - P = −100, My = 6000: before Y = NaN, T = NaN, bearing DCR 1.000, no error → after DCR 1.18 and output blocked: "Base plate too small …".
- **Result change:** the bearing DCR now reads lower (it was a fixed 1.00). This is a display/basis change, not a capacity change.
- **How verified:** node run. **Other copies:** none.

### F10. Small-eccentricity bearing: DG1 uniform block for e > N/6   [calc change] [LESS CONSERVATIVE for N/6 < e < N/3, more conservative for e > N/3]
- **Where:** `dg1Uniaxial` small branch (≈ line 1050). Anchor text: `out.smallBasis="DG1 uniform block, Y = N − 2e";`
- **Problem:** the linear trapezoid was used throughout the small-e range. For e > N/6 it needs tension in the concrete (q_min < 0). For e > N/3 it under-predicts the peak.
- **Governing provision:** AISC DG1 2nd Ed. §3.3 (small moment): Y = N − 2e, f_p = P/(B·Y).
- **Before:**
  ```js
  out.Y = L;               /* full length in compression (may be partial trapezoid) */
  out.Tu = 0;
  /* peak bearing q = Pc/(Wb*L) * (1 + 6e/L)  */
  out.q = (Pc/(Wb*L))*(1 + 6*e/L);
  out.qmin = (Pc/(Wb*L))*(1 - 6*e/L);
  return out;
  ```
- **After:**
  ```js
  out.Tu = 0;
  if(e <= L/6 + 1e-12){
    out.Y = L;
    out.q = (Pc/(Wb*L))*(1 + 6*e/L);
    out.qmin = (Pc/(Wb*L))*(1 - 6*e/L);
    out.smallBasis="trapezoid";
  } else {
    out.Y = L - 2*e;
    out.q = Pc/(Wb*out.Y);
    out.qmin = 0;
    out.smallBasis="DG1 uniform block, Y = N − 2e";
  }
  out.bearDCR = out.q/fpmax;          /* f_p / f_p,max */
  out.bearBasis = "q/fp";
  return out;
  ```
  The Plate tab note and the manual (§4A) are updated.
- **IMPORTANT, less conservative:** for N/6 < e < N/3 the trapezoid gave a higher peak than DG1. Example below: plate DCR 1.02 → 0.90, so a FAIL becomes a PASS.
- **Check case:** P = −300, My = 1200 → e = 4.0 in (N/6 = 3, N/3 = 6, e_crit = 5.98).
  - Before: q = 300/(18·18)·(1 + 24/18) = 2.160 ksi, bearing DCR 0.782, t_req 1.534 (plate DCR 1.02).
  - After: Y = 18 − 8 = 10, q = 300/(18·10) = 1.667 ksi, bearing DCR 0.603, t_req = 4.20·√(2·1.667/(0.9·36)) = 1.347 (plate DCR 0.90).
- **How verified:** node run. **Other copies:** none.

### F11. ASTM A449 strength by diameter   [calc change] [less conservative for d ≤ 1 in., more conservative for d > 1.5 in.]
- **Where:** `agrade` (≈ line 453). Anchor text: `if(g.id==="a449"){`
- **Governing provision:** ASTM A449 (Type 1): ≤ 1 in. Fy/Fu 92/120; > 1 to 1.5 in. 81/105; > 1.5 to 3 in. 58/90 ksi.
- **Before:** `function agrade(id){ return LIB.anchorGrades.find(g=>g.id===id)||LIB.anchorGrades[0]; }`
- **After:**
  ```js
  function agrade(id){ const g=LIB.anchorGrades.find(g=>g.id===id)||LIB.anchorGrades[0];
    if(g.id==="a449"){
      const d=(typeof S!=="undefined" && S && S.anchor)? S.anchor.dia : 1.0;
      const r = (d<=1.0+1e-9)? {Fy:92,Fu:120} : (d<=1.5+1e-9)? {Fy:81,Fu:105} : {Fy:58,Fu:90};
      return Object.assign({}, g, r);
    }
    return g; }
  ```
- **Check case:**
  - 3/4″ A449 (A_se 0.334): futa 105 → 120; φN_sa 26.30 → 30.06 kip (+14%, **less conservative**); φV_sa 10.94 → 12.51 kip.
  - 1-1/4″: unchanged (76.31).
  - 1-3/4″ (A_se 1.90): futa 105 → 90; φN_sa 149.63 → 128.25 kip (more conservative).
- **How verified:** node run. **Other copies:** none.

### F12. Tearout uses the oversized anchor-rod hole (DG1 Table 2.3), with an override input   [calc change] [more conservative]
- **Where:** new `DG1_HOLE` / `anchorHoleDG1` (≈ line 2451), `plateTearout` (≈ line 2472), new optional state field `plate.holeDia` (default 0 = table), new input row "Anchor hole dia. d_h" under Plate thickness.
- **Governing provision:** AISC DG1 2nd Ed. Table 2.3 / AISC Manual Table 14-2; AISC 360-16 J3.10.
- **Before:** `const dh=sp.d+0.0625;   /* std hole ~ d+1/16 for anchors (oversized common; use +1/16 min) */`
- **After:**
  ```js
  const hs=anchorHoleDG1(sp.d);
  const dh=(P.holeDia>0)? P.holeDia : hs.dh;
  ```
  The table used is 3/4→1-5/16, 7/8→1-9/16, 1→1-13/16, 1-1/4→2-1/16, 1-1/2→2-5/16, 1-3/4→2-3/4, 2→3-1/4, 2-1/2→3-3/4. Sizes between rows are interpolated on the oversize. Below 3/4 in. the 3/4 in. oversize is used, labelled "interpolated/extrapolated".
  **Please verify the table against your DG1 copy.**
- **Saved data:** `holeDia` is a new optional field. `mergeState` fills it with 0 for old projects, which gives table behaviour. No key changed.
- **Check case:** 3/4″ rod, edge 1.5, t 0.75, A36 (Fu 58), V per anchor 10 kip.
  - Before: d_h = 0.8125, l_c = 1.094, 1.2·l_c·t·Fu = 57.09 → φR_n = 42.82, DCR 0.234.
  - After: d_h = 1.3125, l_c = 0.844 → 44.04 → φR_n = 33.03, DCR 0.303.
- **How verified:** node run. **Other copies:** none.

### F13. A2 geometrically similar and concentric (plate offset included)   [calc change] [more conservative or equal]
- **Where:** `bearingCap` (≈ line 1135). Anchor text: `const kSim=Math.max(1, Math.min(`
- **Governing provision:** ACI 318-19 §22.8.3.2 (A2 geometrically similar to and concentric with A1); AISC 360-16 J8.
- **Before:** `const A2=Math.min(C.Bx,3*A1_w)*Math.min(C.By,3*A1_l); /* frustum limit ~ per §22.8.3.2 */`
- **After:**
  ```js
  const oX=Math.abs(C.plate_off_x||0), oY=Math.abs(C.plate_off_y||0);
  const kSim=Math.max(1, Math.min((C.Bx/2-oX)/(A1_w/2), (C.By/2-oY)/(A1_l/2)));
  const A2=A1*kSim*kSim;
  ```
- **Check case:**
  - Plate 18×18 with 1″ grout at 1:1 gives A1 = 20×20 = 400. With a 30×30 pedestal and plate_off_x = 4: before A2 = 900, √ = 1.50, φf_p = 2.7625 → after k = min(11/10, 15/10) = 1.1, A2 = 484, √ = 1.10, φf_p = 2.431 ksi.
  - 30×60 pedestal, no offset: before A2 = 1800, √ capped at 2.0 → after A2 = 900, √ = 1.5. φf_p = 2.7625 in both because the grout 0.85·5 governs.
- **Not done:** the 1:2 frustum depth check against pedestal height (O3).
- **How verified:** node run. **Other copies:** none.

### F14. Seismic banner   [display]
- **Where:**
  - `validateInputs`: non-blocking red error, code "§17.10".
  - `buildSummary`: red box after the overall verdict, so it prints.
- **Trigger:** `S.serviceLoads.useSeismic || S.serviceLoads.useOmega`.
- **Problem:** §17.10 is not implemented, but seismic/Ω₀ combinations could be generated and passed silently.
- **Before/After:** new code blocks only (search `SEISMIC — ACI 318-19 &sect;17.10 NOT IMPLEMENTED` and `code:"§17.10"`).
- **Check case:** n/a (no number changes). Verified that the Summary builder runs with `useSeismic=true`.

### F15. Critical inputs: blank/zero/negative is a blocking error; NaN never reads as PASS   [robustness]
- **Where:**
  - `validateInputs` (≈ line 8594).
  - `statusOf` (≈ line 4325).
  - The worst-DCR scans in `dcrMatrix`, `worstDCRNow`, `snapshotEvaluate`, `buildCompare` and `buildSummary`.
- **Problem:** a blank field was stored as 0, e.g. H = 0 gives ψ_h,V = ∞ and V_cbg = NaN. NaN failed `>1.0001`, so `statusOf` returned "pass", and the `isFinite` filters dropped it from "worst".
- **Before:**
  - `function statusOf(dcr,na){ return na?"na":(dcr>1.0001?"fail":"pass"); }`
  - The scans used `if(isFinite(d[k]) && d[k]>worst)…`
  - Summary: `const worst=checks.reduce((m,c)=>(!c.na&&c.dcr>m)?c.dcr:m,0);`
- **After:**
  - `function statusOf(dcr,na){ return na?"na":((dcr>1.0001||isNaN(dcr))?"fail":"pass"); }`
  - The scans use `const v=isNaN(x)?Infinity:x; if(v>worst)…`.
  - New blocking check for f'c, h_ef, t, B, N, H, Bx, By must be > 0 (code "input").
  - The `numInput` behaviour (blank → 0) is unchanged.
- **Check case:** H = 0.
  - Before: Concrete Breakout (V) DCR = NaN, status "pass", no blocker.
  - After: status "fail", and output is withheld with "Missing, zero or negative input: pedestal depth H = 0 in."
- **How verified:** node run.

### F16. Manual text   [display]
- Manual §4C φ table: pullout and pryout under Condition A now read "0.70 (always Condition B)". A note describes the Condition A gating.
- Manual §4A: a paragraph on the e > L/6 uniform block and the large-e bearing DCR.

## Verification summary
- `node --check` on the inline script: OK.
- Every tab builder (`buildSummary`, `buildPlateTab`, `buildAnchorTab`, `buildConcTab`, `buildVCaseTab`, `buildInputEcho`, `buildTRebarTab`, `buildVRebarTab`) and `buildInputPanel` were run against a stub DOM for four states. There were no exceptions.
- PROFIS validation harness (`VALIDATION_CASES`): every target is unchanged except msa3a "Shear edge breakout φVcbg" 17,555 → 18,057 lb (F6). PROFIS itself prints 7,962, so the pre-existing gap there is unrelated.
- Default model: breakout (T) 0.220 → 0.264; interaction 1.299 → 1.328; concrete bearing 0.224 → 0.268. Plate bending 0.547 → 0.574 (the governing combination moves to 0.9D+1.0W because of F10's Y).

## 2026-10-04 — "All tools" link and shared project info
### F17. "← All tools" link; "Use shared project info" / "Share project info" buttons   [feature (no result change)]
- **Date:** 2026-10-04. **Type:** feature (no result change). Approved by the engineer (step 1 of the cross-tool hand-off work, HANDOFF.md §4.1).
- **What:** a small "← All tools" link to `tools.html` (`target="_top"`, because tools can be shown inside index.html's iframe), placed in the `#hdr .titleRow`, above the `<h1>`. It is hidden in print.
- **Shared project info:** two buttons in the new `#projMetaBtns` row directly under `#projGrid`.
  - **Share** builds the full `fields` object (all 8 HANDOFF §4.1 fields, blank where this tool has no field) and calls `BridgeXfer.publish('projectMeta', {_schema:'bridge-project-meta', project:{name, bridgeId}, fields})`. Key: `bridgeSuite.v1.projectMeta` (+ `.updatedAt`).
  - **Use** calls `BridgeXfer.read('projectMeta','bridge-project-meta',1)`, shows a confirm listing the producer, time, project and every field that will change (old → new), and writes only this tool's mapped fields. A blank shared value never blanks a field. Apply path: sets each `#projGrid` input (found by its label text) and dispatches a bubbling `input` event, so the existing `buildProjHeader` listener updates `S.proj`, autosaves and refreshes the project dropdown. Records `bridgeSuite.v1.projectMeta.adopted.<id>`.
- **Field mapping (shared → this tool):**

  | Shared field | Tool field | Label |
  |---|---|---|
  | `projectName` | `S.proj.name` | Project name |
  | `jobNo` | `S.proj.num` | Project number |
  | `preparedBy` | `S.proj.by` | Calculated by |
  | `date` | `S.proj.date` | Date (only if YYYY-MM-DD; the field is `type="date"`) |
  | `checkedBy` | `S.proj.chk` | Checked by |

  Not mapped: bridgeId, client, location. Checked date (`S.proj.chkDate`) has no shared field.
- **Helpers added:** a plain `<script>` with BridgeXfer v1 verbatim from HANDOFF.md §5, then a plain `<script>` with `ProjMetaUI` (shown in full in the After code below) and this tool's field map. Both sit before the tool's own script.
- **Storage:** no existing key or saved-data format changed. New keys only: `bridgeSuite.v1.projectMeta`, `.updatedAt`, `.adopted.<id>` (HANDOFF.md §2).
- **Where / Before / After** (each change is an insertion; the Before text is the anchor and is kept):
  1. Anchor: `#hdrBtns button:hover{background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.6);}`
     - Before:
       ```
         #hdrBtns button:hover{background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.6);}
       ```
     - After:
       ```
         #hdrBtns button:hover{background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.6);}
         #projMetaBtns{margin-top:5px;}
         #projMetaBtns button{font-size:8.5pt;padding:2px 8px;background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.35);color:#fff;}
         #projMetaBtns button:hover{background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.6);}
         #hdr .allToolsLink{font-size:8.5pt;color:#C7D4E4;text-decoration:none;font-family:var(--font-ui);}
         #hdr .allToolsLink:hover{color:#fff;text-decoration:underline;}
         @media print{ #hdr .allToolsLink,#projMetaBtns{display:none!important;} }
       ```
  2. Anchor: `<div>`
     - Before:
       ```
             <div>
               <h1>Base Plate &amp; Anchor Bolt Designer</h1>
       ```
     - After:
       ```
             <div>
               <a class="allToolsLink" href="tools.html" target="_top" title="Open the list of all tools">&larr; All tools</a>
               <h1>Base Plate &amp; Anchor Bolt Designer</h1>
       ```
  3. Anchor: `<div id="projGrid"></div>`
     - Before:
       ```
           <div id="projGrid"></div>
       ```
     - After:
       ```
           <div id="projGrid"></div>
           <div id="projMetaBtns">
             <button id="btnUseProjMeta" title="Fill the project fields from project info shared by another tool">Use shared project info</button>
             <button id="btnShareProjMeta" title="Make these project fields available to the other tools">Share project info</button>
           </div>
       ```
  4. Anchor: `<div id="printReport"></div>`
     - Before:
       ```
       <div id="printReport"></div>
       <script>
       ```
     - After:
       ```
       <div id="printReport"></div>
       <script>
       /* BridgeXfer v1 verbatim from HANDOFF.md §5 (73 lines, starts "/* BridgeXfer v1 — cross-tool hand-off helper.", ends "})();") */
       </script>
       <script>
       /* Shared project info buttons (HANDOFF.md §4.1, channel bridgeSuite.v1.projectMeta). Uses window.BridgeXfer.
          map: [{shared:'<HANDOFF field>', key:'<this tool's field>', label:'<this tool's label>', accept:optional fn(v)->bool}]
          values: { <tool key>: <current value> } */
       (function(){
         if(window.ProjMetaUI) return;
         var FIELDS=['projectName','bridgeId','jobNo','client','location','preparedBy','checkedBy','date'];
         function s(v){ return (v===undefined||v===null)?'':String(v); }
         function share(map, values, producer, producerFile){
           var fields={}; FIELDS.forEach(function(k){ fields[k]=''; });
           map.forEach(function(m){ fields[m.shared]=s(values[m.key]); });
           var r=window.BridgeXfer.publish('projectMeta', {_schema:'bridge-project-meta', project:{ name:fields.projectName, bridgeId:fields.bridgeId }, fields:fields}, producer, producerFile);
           if(r.error){ alert('Could not share project info: '+r.error); return r; }
           var lines=map.map(function(m){ return '  '+m.label+': '+(fields[m.shared]||'(blank)'); });
           alert('Project info shared with the other tools:\n\n'+lines.join('\n'));
           return r;
         }
         function use(map, values, receiverId){
           var r=window.BridgeXfer.read('projectMeta','bridge-project-meta',1);
           if(r.error){ alert('Shared project info: '+r.error+(r.empty?'\n\nOpen a tool that has project info and click "Share project info" first.':'')); return null; }
           var p=r.payload, f=(p.fields&&typeof p.fields==='object')?p.fields:{}, patch={}, lines=[], skipped=[];
           map.forEach(function(m){
             var v=s(f[m.shared]);
             if(v.trim()==='') return;                                   /* never blank a field */
             if(m.accept && !m.accept(v)){ skipped.push('  '+m.label+': "'+v+'" (not a valid value here)'); return; }
             if(v===s(values[m.key])) return;
             patch[m.key]=v; lines.push('  '+m.label+': "'+s(values[m.key])+'" → "'+v+'"');
           });
           if(!lines.length){ alert('Shared project info ('+window.BridgeXfer.describe(p)+') has nothing new for this tool.'+(skipped.length?'\n\nNot used:\n'+skipped.join('\n'):'')); return null; }
           if(!confirm('Use shared project info from '+window.BridgeXfer.describe(p)+'?\n\nThis will overwrite:\n'+lines.join('\n')+(skipped.length?'\n\nNot used:\n'+skipped.join('\n'):''))) return null;
           window.BridgeXfer.markAdopted('projectMeta', receiverId, p.producedAt);
           return patch;
         }
         window.ProjMetaUI={ share:share, use:use };
       })();
       /* BasePlateAnchorDesigner: shared project info field map and buttons (title block #projGrid). */
       (function(){
         var MAP=[{shared:'projectName',key:'Project name',label:'Project name'},
                  {shared:'jobNo',key:'Project number',label:'Project number'},
                  {shared:'preparedBy',key:'Calculated by',label:'Calculated by'},
                  {shared:'date',key:'Date',label:'Date',accept:function(v){ return /^\d{4}-\d{2}-\d{2}$/.test(v); }},
                  {shared:'checkedBy',key:'Checked by',label:'Checked by'}];
         function inp(k){ var ls=document.querySelectorAll('#projGrid label'); for(var i=0;i<ls.length;i++){ var s=ls[i].querySelector('span'); if(s&&s.textContent===k) return ls[i].querySelector('input'); } return null; }
         function values(){ var v={}; MAP.forEach(function(m){ var i=inp(m.key); v[m.key]=i?i.value:''; }); return v; }
         document.getElementById('btnShareProjMeta').addEventListener('click',function(){ ProjMetaUI.share(MAP, values(), 'BasePlateAnchorDesigner', 'BasePlateAnchorDesigner.html'); });
         document.getElementById('btnUseProjMeta').addEventListener('click',function(){
           var patch=ProjMetaUI.use(MAP, values(), 'basePlateAnchor'); if(!patch) return;
           Object.keys(patch).forEach(function(k){ var i=inp(k); if(!i) return; i.value=patch[k]; i.dispatchEvent(new Event('input',{bubbles:true})); });
         });
       })();
       </script>
       <script>
       ```
- **Governing provision:** none. UI and cross-tool data hand-off only (HANDOFF.md §2, §4.1, §5). No formula, factor, unit, code reference or computed result changed.
- **Check case:** not applicable (no calculation touched). Functional check: Spread Footing shares {Project Name "Route 9 over Mill Brook", Project Number "J-2026-114", Calculated By "MRL", Date "2026-10-04", Checked By "JKD"}; Use in this tool fills the mapped fields; a blank shared value leaves the existing field unchanged.
- **How verified:** `node --check` on every plain inline script; text/babel blocks transpiled with @babel/standalone; page loaded in jsdom with CDN libraries stubbed (React UMD served locally); Share → Use exercised across Spread Footing, BasePlateAnchorDesigner, Pile Designer, Concrete Anchor and Timber Beam Check (Timber: plain scripts in jsdom, the same calls its onClick handlers make, since it imports React from esm.sh) with a localStorage carried between pages; `git diff --numstat` shows only insertions.
- **Other copies:** BridgeXfer v1 and `ProjMetaUI` are duplicated (CLAUDE.md §3) in Pile Designer.html, Spread Footing.html, BasePlateAnchorDesigner.html, Concrete Anchor.html and Timber Beam Check.html (this PR), plus any other tools that received BridgeXfer in their own step-1 PRs.
- **`ProjMetaUI`:** given in full in the After code of the helper insertion above; the copy is identical in every tool listed.

## 2026-10-05 — PR: claude/conn-steelbeam-reactions (PR link added after merge)
### C1. Member-reaction hand-off receiver: "Pull from Steel Beam" and "Import hand-off (JSON)"   [feature: hand-off (no result change)]
- **Date / type:** 2026-10-05, feature: hand-off (no result change).
- **Where:** header `#projMetaBtns` (anchor `<button id="btnShareProjMeta" title="Make these project fields available to the other tools">Share project info</button>`); `buildPrintReport()` after the title block (anchor `holder.appendChild(hg);`, first occurrence inside `buildPrintReport`); one new `<script>` block at the end of the file, just before `</body>` (anchor `Member-reaction hand-off receiver`).
- **Purpose:** reads channel `bridgeSuite.v1.memberReactions` (HANDOFF.md §4.8) and fills the ASCE 7-22 generator's SERVICE loads `S.serviceLoads.cases[slot].P` for one beam support.
- **Sign convention verified:** this tool stores **P + = tension (uplift)**, compression negative (`defaultState()` comment "P positive = tension/uplift, negative = compression (gravity)"; default D.P = −100; `axialSign()` only flips entry/display). The sender's V is + down, so **P = −V**.
- **Mapping:**

| Hand-off (support chosen by the user) | Base plate target |
|---|---|
| `byLoadType.D.V` | `S.serviceLoads.cases.D.P = −V` (kip) |
| `byLoadType.L.V` | `cases.L.P = −V` |
| `byLoadType.Lr.V` | `cases.Lr.P = −V` |
| `byLoadType.S.V` | `cases.S.P = −V` (warning: the generator does not use slot S; map to Lr if snow governs) |
| `byLoadType.W.V` | `cases.W.P = −V` |
| `byLoadType.E.V` | `cases.E.P = −V` (used only with seismic/Ω₀ combinations on) |
| `byCase` "other" cases | listed; default "do not import"; any slot may be chosen |
| `M` (fixed supports) | not imported (shown; the beam-support moment is not a column-base moment) |

- **User choices (logged in `S.bxSrc.memberReactions`):** support (default the first); slot per row (default same type; all-zero rows and "other" cases → not imported); replace P (default) or add to P; "also set Vx, Vy, Mx, My of the target slots to 0" (default off); "regenerate the load combinations now" (default off — combinations unchanged until the user regenerates).
- **Validation:** `_schema`, `schemaVersion ≤ 1`, corrupt JSON (BridgeXfer); `factored:true` refused; `units.force` kip or lb (÷1000), `units.moment` kip-ft/kip-in/lb-ft/lb-in, else refused; every V and M finite; at least one support with reactions.
- **Governing provision:** none changed. No formula, factor or default changed; `generateCombos()` is called unchanged only when the user ticks regenerate.
- **Before / After** (exact):
  1. Header buttons.
     - Before:
  ```html
      <button id="btnShareProjMeta" title="Make these project fields available to the other tools">Share project info</button>
    </div>
  ```
     - After:
  ```html
      <button id="btnShareProjMeta" title="Make these project fields available to the other tools">Share project info</button>
      <button id="btnPullMemberReactions" type="button" onclick="bxPullMemberReactions()" title="Import unfactored support reactions from Steel Beam Design into the ASCE 7-22 service loads (HANDOFF.md, channel memberReactions)">Pull from Steel Beam<span id="bxMrNew" style="display:none;color:#b45309;font-weight:bold"> &#9679; new data available</span></button>
      <button id="btnImportMemberReactions" type="button" onclick="document.getElementById('bxMrFile').click()">Import hand-off (JSON)</button><input type="file" id="bxMrFile" accept=".json,application/json" style="display:none" onchange="bxImportMemberReactions(event)">
      <span id="bxMrSrc" style="font-size:9pt;font-style:italic"></span>
    </div>
  ```
  2. `buildPrintReport()`.
     - Before:
  ```js
  holder.appendChild(hg);
  ```
     - After:
  ```js
  holder.appendChild(hg);
  if(typeof bxMrSourceLine==="function"&&bxMrSourceLine()) holder.appendChild(el("div","note",bxMrSourceLine()));   /* hand-off source (HANDOFF.md §3.4) */
  ```
  3. New script, inserted just before `</body>` (Before: nothing). After:
  ```html
<script>
/* Member-reaction hand-off receiver (HANDOFF.md §4.8, channel memberReactions, sender: Steel Beam Design - AISC 15th.html).
   "Pull from Steel Beam" / "Import hand-off (JSON)". Nothing is applied on page load. The user picks one support,
   maps each load type to a slot of the ASCE 7-22 generator's SERVICE loads (S.serviceLoads.cases), chooses replace
   or add, reviews exactly what will change, and confirms. Only the P of the chosen slots changes (and Vx/Vy/Mx/My are
   zeroed only if the user ticks that option); the combinations are regenerated only if the user ticks that option.
   Sign: the sender's V is + DOWN on the support; this tool stores P + = TENSION (uplift), so P = -V.
   The source is kept in the new optional field S.bxSrc.memberReactions. */
(function(){
  var CH='memberReactions', SCHEMA='bridge-member-reactions', MAXV=1, RID='basePlate';
  var SLOTS=['D','L','Lr','S','W','E'];
  var SLOT_LBL={D:'Dead',L:'Live',Lr:'Roof live',S:'Snow',W:'Wind',E:'Seismic'};
  var FORCE={kip:1,kips:1,k:1,lb:0.001,lbf:0.001,lbs:0.001};               /* -> kip */
  var MOMENT={'kip-ft':1,'kip·ft':1,'k-ft':1,'ft-kip':1,'kip-in':1/12,'lb-ft':0.001,'ft-lb':0.001,'lb-in':0.001/12};   /* -> kip-ft */
  function isNum(v){ return typeof v==='number' && isFinite(v); }
  function f2(v,d){ return isNum(v) ? (Math.abs(v)<1e-12?0:v).toFixed(d==null?2:d) : '—'; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function h(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!==undefined) e.innerHTML=html; return e; }
  function when(iso){ var d=new Date(iso); if(isNaN(d)) return String(iso||'?');
    function p(n){ return (n<10?'0':'')+n; }
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes()); }
  function projName(p){ return (p.project && typeof p.project==='object') ? (p.project.name||'') : String(p.project||''); }

  /* ---- validate and convert to kip / kip-ft; returns {err, warn, sups:[{id,x,support,rows:[{key,label,type,V,M}]}]} ---- */
  function check(p){
    var out={err:[],warn:[],sups:[]};
    var e=BridgeXfer.validate(p,SCHEMA,MAXV); if(e){ out.err.push(e); return out; }
    if(p.factored===true){ out.err.push('The payload says its reactions are factored. This tool imports unfactored (service) loads only.'); return out; }
    var u=p.units||{}, kf=FORCE[u.force], km=MOMENT[u.moment];
    if(!kf){ out.err.push('Unknown force unit "'+(u.force||'')+'". Accepted: kip, or lb (converted ÷ 1000).'); return out; }
    if(!km){ out.err.push('Unknown moment unit "'+(u.moment||'')+'". Accepted: kip-ft, kip-in, lb-ft, lb-in.'); return out; }
    if(kf!==1) out.warn.push('Forces converted from '+u.force+' to kip (× '+kf+').');
    if(!Array.isArray(p.supports) || !p.supports.length){ out.err.push('The payload has no supports.'); return out; }
    p.supports.forEach(function(s,i){
      if(!s || typeof s!=='object'){ out.err.push('Support '+(i+1)+' is not an object.'); return; }
      if(s.factored===true){ out.err.push('Support '+(s.id||i+1)+' is marked factored.'); return; }
      var sid=String(s.id==null?(i+1):s.id);
      if(s.x!==undefined && s.x!==null && !isNum(s.x)) out.err.push('Support '+sid+': x is not a finite number.');
      var rows=[];
      function rd(src,key,label,type){
        if(!src || typeof src!=='object'){ out.err.push('Support '+sid+', '+label+': not an object.'); return; }
        if(!isNum(src.V)){ out.err.push('Support '+sid+', '+label+': V is not a finite number ('+JSON.stringify(src.V)+').'); return; }
        if(src.M!==undefined && src.M!==null && !isNum(src.M)){ out.err.push('Support '+sid+', '+label+': M is not a finite number ('+JSON.stringify(src.M)+').'); return; }
        rows.push({key:key,label:label,type:type,V:src.V*kf,M:(isNum(src.M)?src.M:0)*km});
      }
      var bt=s.byLoadType;
      if(!bt || typeof bt!=='object'){ out.err.push('Support '+sid+' has no byLoadType.'); return; }
      Object.keys(bt).forEach(function(t){
        if(SLOTS.indexOf(t)<0){ out.warn.push('Support '+sid+': unknown load type "'+t+'" is listed as "other".'); rd(bt[t],'t:'+t,t+' (unknown type)',null); return; }
        rd(bt[t],'t:'+t,t+' — '+SLOT_LBL[t],t);
      });
      rows.sort(function(a,b){ return (a.type?SLOTS.indexOf(a.type):99)-(b.type?SLOTS.indexOf(b.type):99); });
      if(s.byCase && typeof s.byCase==='object') Object.keys(s.byCase).forEach(function(cid){
        var c=s.byCase[cid]; if(c && c.type) return;   /* already inside byLoadType */
        rd(c,'c:'+cid,'case '+cid+(c&&c.name&&c.name!==cid?' ('+c.name+')':'')+' — not assigned to a type',null);
      });
      out.sups.push({id:sid,x:s.x,support:s.support||'',rows:rows});
    });
    if(!out.err.length && !out.sups.some(function(s){ return s.rows.length; })) out.err.push('The payload contains no reactions.');
    return out;
  }
  /* default mapping for one support: same load type -> same slot; "other" cases and all-zero rows -> do not import */
  function defaultMap(s){
    var m={}; s.rows.forEach(function(r){ m[r.key]=(r.type && (Math.abs(r.V)>1e-9 || Math.abs(r.M)>1e-9)) ? r.type : ''; }); return m;
  }
  function defaults(chk){
    var o={sup:0,mode:'replace',zeroOther:false,regen:false,map:defaultMap(chk.sups[0])};
    return o;
  }
  /* ---- plan: exactly what will change. Pure apart from reading S. ---- */
  function plan(p,chk,o){
    var r={err:[],warn:[],changes:[],rows:[],slots:{}};
    var s=chk.sups[o.sup]; if(!s){ r.err.push('Pick a support.'); return r; }
    var SL=S.serviceLoads;
    if(!SL || !SL.cases){ r.err.push('This project has no service-load table.'); return r; }
    var add={}, from={};
    s.rows.forEach(function(row){
      var slot=o.map[row.key]||'';
      if(!slot) return;
      if(SLOTS.indexOf(slot)<0){ r.err.push('Unknown target slot '+slot+'.'); return; }
      var P=-row.V;   /* + down on support -> tension-positive P */
      add[slot]=(add[slot]||0)+P; (from[slot]=from[slot]||[]).push(row.label.split(' —')[0]);
      r.rows.push({from:row.label.split(' —')[0],slot:slot,V:row.V,P:P,M:row.M});
      if(Math.abs(row.M)>1e-9) r.warn.push(row.label.split(' —')[0]+': the fixed-support moment M = '+f2(row.M,3)+' kip·ft is NOT transferred. It is the moment at the beam’s support, not at the column base; enter any base moment yourself.');
    });
    var used=Object.keys(add);
    if(!used.length) r.err.push('Map at least one load type to a slot.');
    used.forEach(function(slot){
      if(from[slot].length>1) r.warn.push(from[slot].join(' + ')+' are added together into slot '+slot+'.');
      var c=SL.cases[slot]||{P:0,Vx:0,Vy:0,Mx:0,My:0};
      var oldP=c.P||0, newP=(o.mode==='add'?oldP:0)+add[slot];
      newP=Math.round(newP*1e6)/1e6;
      r.slots[slot]={P:newP};
      r.changes.push({slot:slot,field:'P',from:oldP,to:newP});
      if(o.zeroOther) ['Vx','Vy','Mx','My'].forEach(function(k){ if((c[k]||0)!==0){ r.changes.push({slot:slot,field:k,from:c[k],to:0}); r.slots[slot][k]=0; } });
      else if(['Vx','Vy','Mx','My'].some(function(k){ return (c[k]||0)!==0; }))
        r.warn.push('Slot '+slot+' keeps its existing shear/moment (Vx '+f2(c.Vx||0)+', Vy '+f2(c.Vy||0)+' kip; Mx '+f2((c.Mx||0)/12)+', My '+f2((c.My||0)/12)+' kip·ft). Tick the option below to set them to 0.');
    });
    if(add.S!==undefined) r.warn.push('The ASCE 7-22 generator in this tool does not use the S (snow) slot: Lr and S share the roof-live term (open item O1 in its fix log). Snow put in slot S has no effect on the combinations; map it to Lr if snow governs the roof load.');
    if(add.E!==undefined && !(SL.useSeismic||SL.useOmega)) r.warn.push('Slot E is used only when the seismic or overstrength combinations are switched on in the generator.');
    if(o.regen){
      var save=JSON.parse(JSON.stringify(SL.cases));
      used.forEach(function(slot){ var c=SL.cases[slot]=SL.cases[slot]||{P:0,Vx:0,Vy:0,Mx:0,My:0}; Object.keys(r.slots[slot]).forEach(function(k){ c[k]=r.slots[slot][k]; }); });
      try{ r.combos=generateCombos(); } finally { SL.cases=save; }
      if(!r.combos.length) r.err.push('Regenerating would produce no combinations (all service loads zero or no combination set selected).');
    }
    return r;
  }
  function apply(p,chk,o,via){
    var r=plan(p,chk,o); if(r.err.length) return r;
    var SL=S.serviceLoads;
    Object.keys(r.slots).forEach(function(slot){
      var c=SL.cases[slot]=SL.cases[slot]||{P:0,Vx:0,Vy:0,Mx:0,My:0};
      Object.keys(r.slots[slot]).forEach(function(k){ c[k]=r.slots[slot][k]; });
    });
    if(o.regen && r.combos){ S.combos=r.combos; S.detailCombo=0; }
    if(!S.bxSrc || typeof S.bxSrc!=='object') S.bxSrc={};
    var s=chk.sups[o.sup];
    S.bxSrc.memberReactions={producer:p.producer||'',producerFile:p.producerFile||'',producedAt:p.producedAt||'',
      project:p.project||'',via:via||'pull',adoptedAt:new Date().toISOString(),
      support:s.id,supportType:s.support,mode:o.mode,zeroOther:!!o.zeroOther,regen:!!o.regen,
      rows:r.rows.map(function(x){ return {from:x.from,slot:x.slot,V:x.V,P:x.P}; }),
      notes:(p.notes||[]).slice(0,20)};
    BridgeXfer.markAdopted(CH,RID,p.producedAt);
    r.ok=true;
    return r;
  }

  function openDialog(p,via){
    var chk=check(p);
    if(chk.err.length){ alert('Support-reaction hand-off refused:\n  '+chk.err.join('\n  ')); return null; }
    var o=defaults(chk);
    var old=document.getElementById('bxMrOverlay'); if(old) old.remove();
    var ov=h('div','modal'); ov.id='bxMrOverlay';
    var box=h('div','modalBox wide'); ov.appendChild(box);
    box.appendChild(h('h3',null,'Import support reactions from '+esc(p.producer||'?')));
    box.appendChild(h('div','note','<b>Source:</b> '+esc(p.producer||'?')+(p.producerFile?' ('+esc(p.producerFile)+')':'')+
      ' &middot; <b>sent</b> '+esc(when(p.producedAt))+' &middot; <b>project</b> '+esc(projName(p)||'—')+
      ' &middot; unfactored reactions'+(via==='file'?' &middot; from a JSON file':'')));
    box.appendChild(h('div','warnBox','<b>Beam reactions give column AXIAL load only.</b> Shear (Vx, Vy) and moment (Mx, My) at the base plate are zero unless you add them yourself. '+
      'Sign: the beam tool sends V + = downward on the support; this tool uses <b>P + = tension (uplift)</b>, so <b>P = −V</b> (a 2.0 kip downward reaction becomes P = −2.00 kip).'));
    if(chk.warn.length) box.appendChild(h('div','warnBox',chk.warn.map(esc).join('<br>')));
    if(p.notes && p.notes.length){
      var nb=h('details'); nb.appendChild(h('summary',null,'Sender notes ('+p.notes.length+')'));
      nb.appendChild(h('div','note',p.notes.map(function(n){ return '&bull; '+esc(n); }).join('<br>'))); nb.open=true; box.appendChild(nb);
    }
    var g=h('div'); g.style.cssText='display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin:8px 0';
    var sl=h('label',null,'<b>Support (column)</b> '); var ss=document.createElement('select'); ss.id='bxMrSup';
    chk.sups.forEach(function(s,i){ var op=document.createElement('option'); op.value=i; op.textContent=s.id+(isNum(s.x)?' (x = '+f2(s.x)+' ft'+(s.support?', '+s.support:'')+')':''); ss.appendChild(op); });
    sl.appendChild(ss); g.appendChild(sl); box.appendChild(g);
    var tw=h('div'); box.appendChild(tw);
    var md=h('div'); md.style.margin='6px 0';
    md.innerHTML='<b>Existing service loads in the target slots:</b> '+
      '<label><input type="radio" name="bxMrMode" id="bxMrRep" checked> replace P</label> '+
      '<label><input type="radio" name="bxMrMode" id="bxMrAdd"> add to P</label><br>'+
      '<label><input type="checkbox" id="bxMrZero"> also set Vx, Vy, Mx, My of the target slots to 0</label><br>'+
      '<label><input type="checkbox" id="bxMrRegen"> regenerate the load combinations from the service loads now (replaces the '+S.combos.length+' current combination'+(S.combos.length===1?'':'s')+')</label>';
    box.appendChild(md);
    var sum=h('div'); box.appendChild(sum);
    var foot=h('div','modalFoot');
    var ca=h('button',null,'Cancel'); var go=h('button','primary','Import'); go.id='bxMrGo';
    foot.appendChild(ca); foot.appendChild(go); box.appendChild(foot);
    var sels={};
    function drawRows(){
      var s=chk.sups[o.sup]; tw.innerHTML=''; sels={};
      var t=h('table','tbl');
      t.innerHTML='<tr><th class="lft">From '+esc(p.producer||'sender')+'</th><th>V (kip, + down)</th><th>M (kip·ft)</th><th>Into service-load slot</th><th>P = −V (kip, + tension)</th></tr>';
      s.rows.forEach(function(row){
        var tr=h('tr');
        tr.appendChild(h('td','lft',esc(row.label)));
        tr.appendChild(h('td',null,f2(row.V,3)));
        tr.appendChild(h('td',null,Math.abs(row.M)>1e-9?f2(row.M,3)+' (not transferred)':'0'));
        var td=h('td'), se=document.createElement('select'); se.dataset.key=row.key;
        SLOTS.concat(['']).forEach(function(sl2){ var op=document.createElement('option'); op.value=sl2; op.textContent=sl2?sl2+' — '+SLOT_LBL[sl2]:'do not import'; se.appendChild(op); });
        se.value=o.map[row.key]||''; td.appendChild(se); tr.appendChild(td); sels[row.key]=se;
        tr.appendChild(h('td',null,f2(-row.V,3)));
        t.appendChild(tr);
      });
      tw.appendChild(t);
    }
    function read(){
      o.sup=+ss.value;
      Object.keys(sels).forEach(function(k){ o.map[k]=sels[k].value; });
      o.mode=document.getElementById('bxMrAdd').checked?'add':'replace';
      o.zeroOther=document.getElementById('bxMrZero').checked;
      o.regen=document.getElementById('bxMrRegen').checked;
      return o;
    }
    function refresh(){
      read();
      var r=plan(p,chk,o), x='';
      if(r.err.length) x+='<div class="warnBox" style="color:#8c1d1d;font-weight:bold">'+r.err.map(esc).join('<br>')+'</div>';
      x+='<div class="note" style="font-style:normal"><b>Will change</b> (service loads, internal units kip / P + tension): '+(r.changes.length? r.changes.map(function(c){
        var isM=(c.field==='Mx'||c.field==='My');
        return 'slot '+c.slot+' '+c.field+': '+(isM?f2(c.from/12,3)+' → '+f2(c.to/12,3)+' kip·ft':f2(c.from,3)+' → <b>'+f2(c.to,3)+'</b> kip'); }).join('; ') : 'nothing')+
        '<br><b>Load combinations:</b> '+(o.regen && r.combos ? 'replaced by '+r.combos.length+' generated combination'+(r.combos.length===1?'':'s')+'.' :
          'NOT changed. The design uses the current combinations until you click “Generate from service loads (ASCE 7-22)” or tick the option above.')+
        '<br><b>Also recorded:</b> the source (producer and time) in this project, shown in the header and the printed report.</div>';
      if(r.warn.length) x+='<div class="warnBox">'+r.warn.map(esc).join('<br>')+'</div>';
      sum.innerHTML=x; go.disabled=!!r.err.length;
      return r;
    }
    drawRows();
    ss.addEventListener('change',function(){ o.sup=+ss.value; o.map=defaultMap(chk.sups[o.sup]); drawRows(); refresh(); });
    box.addEventListener('change',function(e){ if(e.target!==ss) refresh(); });
    ca.addEventListener('click',function(){ ov.remove(); });
    go.addEventListener('click',function(){
      var r=apply(p,chk,read(),via);
      if(r.err.length){ refresh(); return; }
      ov.remove();
      autosave();
      try{ buildInputPanel(); buildTabs(); }catch(e){}
      refreshBar();
    });
    document.body.appendChild(ov);
    refresh();
    return {overlay:ov, opts:o, chk:chk, refresh:refresh, drawRows:drawRows};
  }

  function sourceLine(){
    var s=S.bxSrc && S.bxSrc.memberReactions; if(!s) return '';
    return 'Service loads '+(s.rows||[]).map(function(x){ return x.slot; }).filter(function(v,i,a){ return a.indexOf(v)===i; }).join(', ')+
      ' (P) from '+(s.producer||'?')+' support '+(s.support||'?')+', '+when(s.producedAt)+
      ((s.project&&(s.project.name||typeof s.project==='string'))?' ('+(s.project.name||s.project)+')':'')+(s.via==='file'?', via JSON file':'')+
      (s.mode==='add'?', added to existing':'');
  }
  function refreshBar(){
    var nd=document.getElementById('bxMrNew'); if(nd) nd.style.display=BridgeXfer.isNew(CH,RID)?'inline':'none';
    var sl=document.getElementById('bxMrSrc'); if(sl) sl.textContent=sourceLine();
  }
  window.bxPullMemberReactions=function(){
    var r=BridgeXfer.read(CH,SCHEMA,MAXV);
    if(!r.ok){ alert('Pull from Steel Beam: '+r.error+(r.empty?'\n\nIn Steel Beam Design, click "Send to other tools" first.':'')); return null; }
    return openDialog(r.payload,'pull');
  };
  window.bxImportMemberReactions=function(ev){
    var f=ev && ev.target && ev.target.files && ev.target.files[0]; if(!f) return;
    BridgeXfer.importFile(f,SCHEMA,MAXV,function(r){
      if(!r.ok){ alert('Import hand-off: '+r.error); return; }
      openDialog(r.payload,'file');
    });
    ev.target.value='';
  };
  window.bxMrSourceLine=sourceLine;
  window.bxMr={check:check,plan:plan,apply:apply,defaults:defaults,openDialog:openDialog,sourceLine:sourceLine,refreshBar:refreshBar};
  document.addEventListener('DOMContentLoaded',function(){ setTimeout(refreshBar,200); });
  window.addEventListener('focus',refreshBar);
  window.addEventListener('storage',refreshBar);
  setInterval(refreshBar,2000);
})();
</script>
  ```
- **Saved data:** no existing key or format changed (`bpad_autosave_v1`, `bpad_projects_v1`, `bpad_lastproject_v1`). New optional field `S.bxSrc.memberReactions` (kept by `mergeState`, which copies unknown top-level keys). New key: only `bridgeSuite.v1.memberReactions.adopted.basePlate`.
- **Check case:** default Steel Beam project, support A: D V = 2.000 kip (+ down) → `cases.D.P` −100.000 → **−2.000**; L V = 4.000 → `cases.L.P` −40.000 → **−4.000**; S and W reactions are 0, so their slots are left alone by default (W keeps P 20, Vx 12, My 200). Add mode again: D.P = −2 − 2 = −4.000; with regenerate ticked, 1.4D gives P = 1.4 × (−4.000) = **−5.600 kip**.
- **How verified:** every plain inline script of the three files passes `node --check` (no JSX in these files). jsdom end-to-end test with one shared localStorage stub (56 assertions, all pass): the default Steel Beam project is sent through the real dialog (`bxSendMemberReactions('send')` → Send), then pulled in BasePlateAnchorDesigner and Spread Footing through their real dialogs and Import buttons; inputs asserted equal to the mapped values; export (`Export hand-off (JSON)` blob) re-imported through `Import hand-off (JSON)` in both receivers; wrong `_schema`, `schemaVersion: 2` (pull and file), `factored: true`, unit `kN`, non-finite V, no supports, and corrupt JSON are all refused with no change. No-result-change check: with no hand-off present, original (origin/main) and modified files give byte-identical results on the default state (Steel Beam `computeAll()` for the default beam and a 2-span pin/pin/fixed beam with wind and snow, plus the rendered tab text; BasePlate `allChecks()`, `generateCombos()` and the print report; Spread Footing `computeAll()`, `computePhase2()` and the print header).
- **Other copies of this code:** the receiver logic (`check`, unit tables) is duplicated in Spread Footing.html (CLAUDE.md §3). BridgeXfer v1 unchanged.
- **Open items:** the generator does not use slot S (existing O1); a beam-support moment is never transferred.

## Open items (not changed)
- O1. ASCE 7-22 generator details (the 0.2S term in the 2.3.6 seismic combinations, a separate S slot, the 0.5L option). Not changed, per the brief (OPEN). Decide which combinations the generator should produce. **Resolved 2026-10-12 by S1 (claude/sweep-baseplate).**
- O2. Stand-off rod buckling uses gross d and A_g (`standoffCompressionCheck`). The threaded root arguably governs (r = d_root/4, A = A_se or A_root). Not changed (OPEN). Confirm the intended basis. **Resolved 2026-10-12 by S2 (claude/sweep-baseplate).**
- O3. The A2 1:2 frustum depth limit against pedestal height H is not checked (F13 covers similarity and concentricity only). **Resolved 2026-10-12 by S3 (claude/sweep-baseplate).**
- O4. **Pre-existing bug found:** shear hairpins can never be credited. `tensionDevLengths(S.vRebar)` reads `R.cover`, which `vRebar` does not have, so c_b = NaN, ℓ_d = NaN, and every leg fails the "behind the plane" development check (`reqBehind = NaN`). Hairpin substitution and (with F7) shear Condition A therefore never apply. This is conservative. Not fixed because it is outside the brief. Suggested fix: give `vRebar` a `cover` (2.0) or pass the cover used in `shearRebarIntercept`. **Resolved 2026-10-12 by S4 (claude/sweep-baseplate).**
- O5. ψ_ed,N in tension breakout still uses the minimum edge distance of ALL anchors, not the tension anchors (conservative). It is used consistently with the pryout cone. Should it follow the tension anchors like A_Nc? **Resolved 2026-10-12 by S5 (claude/sweep-baseplate).**
- O6. ψ_h,V outside the narrow-member case is computed from the `ca1` argument, which `comboCapacities` sets to the minimum edge distance of the whole group, not c_a1 of the governing edge. This is conservative and was left as is. **Resolved 2026-10-12 by S6 (claude/sweep-baseplate).**
- O7. Pryout keeps its old ratio cap `min(A_Nc,all/A_Nco, nT)` (nT = tension-anchor count) so its result is unchanged. Per §17.7.3 the cap would be the number of anchors in the group (less conservative when A_Nc,all/A_Nco > nT). Confirm. **Resolved 2026-10-12 by S7 (claude/sweep-baseplate).**
- O8. Condition A is decided by "the intercept check credits ≥ 1 bar/leg" (F7). If you want a stricter rule (all bars effective) or an explicit "Condition A" input, say so. **Still open: see "Needs engineer" in the 2026-10-12 entry.**
- O9. F6 (§17.7.2.1.2) and F10 (uniform block) reduce DCRs in some cases. Both follow the code text / the reviewer's instruction, but please confirm. **Still open: see "Needs engineer" in the 2026-10-12 entry.**

## 2026-10-09 — PR: claude/tabs-baseplate (PR link added after merge)
### T1. Input panel split into tabs   [UI only — no calculation change]
- **Date / type:** 2026-10-09, UI only (no result change). Requested by the engineer on 2026-10-09: "Go through all the apps and make sure they are all formatted with the input panel having tabs rather than one long scrolling input panel." Same approach as `Steel Beam Design - AISC 15th.html` T1: build every section as before, then move the built nodes into tab panes. Drawn in this tool's own style (the same button-tab look as the output `#tabBar`).
- **How it works:** `buildInputPanel()` still builds the 11 numbered input cards into `#inputPanel` exactly as before. At its end the new `bpadInputTabs(P)` **moves** the finished `.sec` nodes into one pane per tab. Nothing is rebuilt or re-templated, so every `data-fkey`, `data-secid`, handler, bound value and collapse state (`S.ui.collapse`) is unchanged. Every caller goes through `buildInputPanel()` (`refreshAll`, `init`, project Load, Import JSON, Restore All, PROFIS import, the member-reaction hand-off), so all of them get the tabs. A tab whose pane is empty is hidden. None is empty today, because all 11 cards are always built. A card not in the map stays in the tab of the card before it.
- **Tabs (in order) and the cards in each** (`data-secid` in brackets):

| Tab | Cards |
|---|---|
| Plate & Anchors | 1. Plate & Column Geometry (`inGeom`), 2. Anchors (cast-in headed) (`inAnchor`) |
| Stand-off | 3. Grout & Stand-off (`inGrout`), 4. Stand-off Bending Summary (`inLevNut`) |
| Pedestal | 5. Concrete Pedestal (`inConc`) |
| Distribution | 6. Shear Distribution (`inShear`), 7. Anchor Force Distribution (`inForceModel`) |
| Reinforcement | 8. Tension Reinforcement (`inTRebar`), 9. Shear Reinforcement (Hairpins) (`inVRebar`) |
| Loads | 10. Load Combinations (pre-factored, LRFD) (`inLoads`) |
| Assumptions | 11. Engineering Assumptions (`inAssume`) |

- **Error marker:** a red dot appears on a tab when one of its inputs needs attention. That means one of these:
  - an `.errBox` inside one of its cards (for example, plain threaded rod in card 2);
  - a number field the browser cannot parse (`validity.badInput`);
  - a `validateInputs()` error (the red lines above the output) that names one of its inputs:
    - blank, zero or negative critical input: plate t, B or N → `inGeom`; h_ef → `inAnchor`; f'c or pedestal H, Bx, By → `inConc`;
    - `DG1` plate too small → `inGeom`;
    - `geometry` (edge distance) and `§17.9.2` spacing → `inAnchor`;
    - `§17.10` seismic banner and the load-unit plausibility error → `inLoads`.

  Warnings (amber) do not set a dot. The dots are refreshed at the end of `validateInputs()` and on every `input` event in the panel.
- **Keyboard / accessibility:** `role="tablist"`, `role="tab"` with `aria-selected` and `aria-controls`, `role="tabpanel"` with `aria-labelledby`; roving `tabindex`; ←/→ (and ↑/↓), Home and End move between the visible tabs.
- **Focus restore:** after each rebuild, `restoreUI()` re-focuses the field being typed in. It now first switches to the tab holding that field (`bpadShowInTabOf`). This tool has no other "go to input" links.
- **New storage key:** `bpad_inputTab_v1` (localStorage, plain string: `plate`, `standoff`, `pedestal`, `dist`, `reinf`, `loads` or `assume`). It remembers the active input tab per browser. Every read and write is in try/catch, and an in-memory copy keeps the tab across rebuilds when storage is blocked. It is **not** stored in `S`. These are unchanged: the autosave (`bpad_autosave_v1`), saved projects (`bpad_projects_v1`), `bpad_lastproject_v1`, the project JSON export/import, Backup All / Restore All, and the `bridgeSuite.v1.*` hand-offs. No existing key or format changed.
- **Print:** unchanged. Print hides `#main`, and the report is built separately in `#printReport` from the output pages. So the input panel and its tab strip are not printed, as before.
- **Narrow screens:** the tab strip wraps (`flex-wrap`) and is sticky at the top of the scrolling input panel. At 400 px the page already scrolls horizontally on main: the document is 784 px wide because of the six-column project header (`#projGrid`). This change leaves that as it is (784 px before and after); see O11.
- **Governing provision:** none (no engineering change).
- **Before / After** (file uses LF):
  1. CSS. Anchor (unchanged): `  #inputPanel{flex:0 0 33%;max-width:33%;border-right:1px solid var(--color-border);overflow-y:auto;` … After: these lines inserted right after it, before `  #outputPanel{`:
     ```css
       /* input panel tabs (bpadInputTabs) — same button-tab look as the output #tabBar */
       #bpadInTabs{position:sticky;top:-10px;z-index:12;display:flex;flex-wrap:wrap;gap:2px;margin:-10px -12px 0;padding:8px 12px 0;background:var(--color-bg);border-bottom:2px solid var(--ink);}
       #bpadInTabs .bpadInTab{display:inline-flex;align-items:center;border:1px solid var(--color-border);border-bottom:none;border-radius:6px 6px 0 0;font-size:9pt;font-family:var(--font-ui);padding:5px 10px;background:var(--slate-100);color:#475569;}
       #bpadInTabs .bpadInTab:hover{background:#E8ECF1;color:var(--color-fg);}
       #bpadInTabs .bpadInTab[aria-selected="true"]{background:var(--paper);font-weight:600;color:var(--color-primary);box-shadow:inset 0 3px 0 var(--color-secondary);}
       #bpadInTabs .bpadInTab:focus-visible{outline:none;box-shadow:inset 0 3px 0 var(--color-secondary),0 0 0 2px rgba(37,99,235,.3);}
       .bpadInDot{display:none;width:7px;height:7px;border-radius:50%;background:var(--fail);margin-left:6px;box-shadow:0 0 0 1.5px #fff;}
       .bpadInTab.has-err .bpadInDot{display:inline-block;}
       .bpadInTab[hidden],.bpadInPane[hidden]{display:none!important;}
     ```
  2. `restoreUI()`. Before:
     ```js
         if(el){
           el.focus({preventScroll:true});
     ```
     After:
     ```js
         if(el){
           bpadShowInTabOf(el);   /* input tabs: make sure its pane is the visible one */
           el.focus({preventScroll:true});
     ```
  3. End of `buildInputPanel()`. Before:
     ```js
         body.appendChild(el("div","note","Echoed in the on-screen output and the PDF report."));
       },P);
     }
     ```
     After:
     ```js
         body.appendChild(el("div","note","Echoed in the on-screen output and the PDF report."));
       },P);
       bpadInputTabs(P);   /* move the sections just built into the input tabs */
     }
     ```
     A new block follows right after that closing brace, before the `OUTPUT — tabs, dashboard, worked calculations` banner. It starts at the comment `/* ---------- input panel tabs (UI only) ----------` and holds:
     - constants `BPAD_IN_TABS`, `BPAD_IN_SEC`, `BPAD_IN_KEY`;
     - functions `bpadInTabGet`, `bpadInTabSet`, `bpadInputTabs`, `bpadSetInTab`, `bpadInTabKey`, `bpadShowInTabOf`, `bpadValSecs`, `bpadInputTabMarks`.

     It is about 110 lines; copy the block from the file.
  4. End of `validateInputs()`. Before:
     ```js
       VALIDATION={errs:norm, warns, blockers};
       return norm.length===0;
     ```
     After:
     ```js
       VALIDATION={errs:norm, warns, blockers};
       bpadInputTabMarks();   /* refresh the input-tab error dots */
       return norm.length===0;
     ```
- **Check case:** the default project. Inputs: 18 × 18 × 1.5 in. A36 plate, W12X65 column, 2×2 anchors of 1.0 in. F1554 Gr. 36, h_ef 12 in., f'c 4 ksi, 30 × 30 × 36 in. pedestal, and the three default combinations. The `allChecks()` JSON, the text of every output tab and the print report text are identical before and after.
- **How verified:** Chromium headless via Playwright. KaTeX 0.16.11, three 0.160.0, Plotly 2.32.0 and pdf.js 3.11.174 were served from local copies of the same pinned versions.
  - `node --check` on all 4 inline scripts: pass.
  - 8 scenarios were run in origin/main and in the edited file:
    - default;
    - tension and shear rebar on;
    - open stand-off (no clamp, no grout);
    - clamped stand-off, HSS column, lb / lb-ft units and the elastic force model;
    - custom column, plain threaded rod, 3×3 anchors, front-row shear and uncracked concrete;
    - blocked (t = 0, f'c = 0);
    - §17.9.2 spacing violation;
    - implausible load with the seismic flag set.

    For each scenario these are **identical**: the input inventory (every input, select, textarea and button in the panel, with its id, `data-fkey`, card and value), the card list, `allChecks()`, the text of every output tab (including Validation and User Manual), the `bpad_autosave_v1` JSON and the print report text. Every input sits in exactly one tab pane (0 unplaced).
  - Save → Load round trip through the header buttons: the saved project and the loaded state are identical to main, and saved equals loaded.
  - Hand-offs:
    - all four buttons are present;
    - "Share project info" writes the same `bridgeSuite.v1.projectMeta` payload (minus the timestamp);
    - "Pull from Steel Beam" with a test `memberReactions` payload gives the same `S.serviceLoads` and source line.
  - PROFIS import through the real dialog. `extractPdfText` was stubbed with report text lines, because no PROFIS PDF is available here. The resulting `S` and the Loads card are identical to main, and so are the field values on these tabs:
    - Plate & Anchors: B 20, N 22, t 1.25; 3/4 in. F1554 Gr. 55, h_ef 15;
    - Stand-off: grout 1.5 in.;
    - Pedestal: f'c 5, H 40.
  - Interaction:
    - arrow, Home and End keys move between tabs;
    - the active tab and the focus are kept while typing, although the panel rebuilds on each keystroke;
    - the tab is remembered after a reload;
    - `restoreUI` switches to the tab of the field it focuses;
    - a blank plate thickness puts a dot on Plate & Anchors, and the dot clears when it is fixed;
    - with localStorage throwing, the tab still survives rebuilds;
    - no console errors from the new code.
  - Screenshots of every tab at 1400 px and 400 px were checked.
- **Other copies of this code:** none.
- **Open items (found, not changed):**
  - O10. Typing a decimal into a number field can lose the decimal point. Typing `5.5` into f'c with Playwright's keyboard gives 55, both on main and on this branch. The panel is rebuilt on every keystroke, and the number input does not keep the intermediate `5.`. Please check this by hand in a browser. Not changed, because it is outside this brief. **Resolved 2026-10-10 by D1** (claude/baseplate-decimal).
  - O11. At 400 px the page scrolls horizontally because of the six-column project header (`#projGrid`, at least 120 px per column). This was there before this change and was not changed. **Resolved 2026-10-12 by S8 (claude/sweep-baseplate).**

## 2026-10-10 — PR: claude/baseplate-decimal (PR link added after merge)
### D1. Number fields keep a typed decimal point (closes O10)   [UI only — no calculation change]
- **Date / type:** 2026-10-10, input handling only. No formula, factor, unit, code reference, storage key or saved-data change. Engineer's instruction (2026-10-10): fix O10 with the recommended fix.
- **Problem (reproduced on main in headless Chromium with real key events):** typing `5.5` into an input-panel number field gave `55`; `0.75` gave `75`, `.5` gave `5`, `-1.25` gave `125`, `1e3` gave `3`, and `1.25` into plate t gave `125`. So f'c could silently become 55 ksi. Typing with 120–150 ms between keys gave the same. All 24 number fields in the input-panel tabs failed (168 of 168 typed cases).
- **Root cause:** every keystroke runs `refreshAll()`, which rebuilds the whole input panel, so the field being typed in is replaced by a new `<input type="number">`. `numInput()` already tried to carry the typed text over (`window.__editingRaw`), but it reads it from `i.value`, and a number input hides unfinished text: `5.` reads as `"5"`, and `-`, `.` and `1e` read as `""`. The new field was filled with `5`, and the next `5` made it `55`.
- **Fix:** keep the live field across the rebuild. In `refreshAll()`, if the focused element is a `numInput` field in `#inputPanel` that is being typed in (`st.key===window.__editingKey`), the panel is rebuilt as before, then the rebuilt twin (same `data-fkey` and same row label) is replaced by the original node. The original node takes the twin's attributes and setter, so it acts exactly like the rebuilt field. Its text, caret and focus are the browser's own and are left alone. If no twin with the same key and label exists (the field layout changed), the old behaviour applies. Results still update live on every keystroke. The combination editor fields (`mcombo*`, not rebuilt while typing) and the ASCE 7 generator fields (update on `change`) already kept decimals and are unchanged.
- **Where:**
  - `numInput()`, anchor text `const v=parseFloat(i.value); set(isNaN(v)?0:v); refreshAll();` (approx. line 1049).
  - `refreshAll()`, anchor text `__fieldSeq=0;            /* deterministic keys: same field gets same key each rebuild */` (approx. line 9588).
- **Before (`numInput`):**
  ```js
    i.value = (window.__editingKey===k && window.__editingRaw!=null)? window.__editingRaw : get();
    i.addEventListener("input",()=>{
      window.__editingKey=k; window.__editingRaw=i.value;
      const v=parseFloat(i.value); set(isNaN(v)?0:v); refreshAll();
    });
  ```
- **After (`numInput`):**
  ```js
    i.value = (window.__editingKey===k && window.__editingRaw!=null)? window.__editingRaw : get();
    i.__bpadSet=set;   /* refreshAll() may keep this node and hand it the setter of its rebuilt twin */
    i.addEventListener("input",()=>{
      window.__editingKey=k; window.__editingRaw=i.value;
      const v=parseFloat(i.value); i.__bpadSet(isNaN(v)?0:v); refreshAll();
    });
  ```
- **Before (`refreshAll`):**
  ```js
    __fieldSeq=0;            /* deterministic keys: same field gets same key each rebuild */
    buildInputPanel();
    buildTabs();
    restoreUI(st);
  ```
- **After (`refreshAll`):**
  ```js
    __fieldSeq=0;            /* deterministic keys: same field gets same key each rebuild */
    /* A number input's .value hides unfinished text ("5." reads as "5", "-" as ""),
       so a rebuilt copy cannot show what is being typed. Keep the live node instead. */
    const ae=document.activeElement;
    const keep=(ae && ae.__bpadSet && st.key && st.key===window.__editingKey &&
                ae.closest && ae.closest("#inputPanel"))? ae : null;
    const rowLab=n=>{ const r=n.closest(".fRow"); const l=r&&r.querySelector("label"); return l?l.textContent:null; };
    const keepLab=keep? rowLab(keep) : null;
    buildInputPanel();
    if(keep){
      const twin=document.querySelector('#inputPanel [data-fkey="'+st.key+'"]');
      if(twin && twin!==keep && twin.__bpadSet && twin.type===keep.type && rowLab(twin)===keepLab){
        keep.__bpadSet=twin.__bpadSet;
        [...keep.attributes].forEach(a=>{ if(!twin.hasAttribute(a.name)) keep.removeAttribute(a.name); });
        [...twin.attributes].forEach(a=>keep.setAttribute(a.name,a.value));
        twin.replaceWith(keep);
      }
    }
    buildTabs();
    restoreUI(st);
  ```
- **Governing provision:** none (input handling only).
- **Check case:** default project, Pedestal tab, f'c field. Select all and type `5.5`. Before: the field shows `55`, `S.conc.fc` = 55, and the Input Summary shows `f'c=55 ksi`. After: the field shows `5.5`, `S.conc.fc` = 5.5, and every result is identical to setting 5.5 directly. Plate thickness `1.25` typed slowly: before `125`, after `1.25`.
- **How verified (headless Chromium, Playwright real keystrokes, main vs branch):**
  - All 24 input-panel number fields × `5.5`, `5.5` with 120 ms delay, `0.75`, `.5`, `-1.25`, `1e3`, `1.0`: branch 168/168 correct, with focus kept; main 0/168.
  - Parity: for each of the 24 fields in a fresh browser profile, main with the value set directly (`fill("5.5")`) vs the branch typed key by key. The `allChecks()` JSON, the full output-panel text and the saved `LS_AUTO` JSON are identical in all 24 cases and for the untouched default project (75 of 75 comparisons). Branch `fill` vs main `fill` is also identical. The default project is the tool's only example.
  - Live update after each keystroke (`5`, `5.`, `5.5`). Backspace over the decimal (`5.5` → `5.` → `5`, then type `.25` → `5.25`). Caret in the middle (`12`, ←, `.` → `1.2`, then `7` → `1.72`). ArrowUp steps (`4` → `4.5`). `-` alone, then `0.5` → `-0.5`. A field that changes the layout (Bolts along x → 3). Combination editor P (`12.75`, `-0.5`) and all 32 ASCE 7 generator fields (`5.5`) correct on both main and branch.
  - Every inline script parses (`vm.Script`). No console errors. Screenshot checked.
- **Other copies of this code:** none (`numInput` and `refreshAll` are local to this tool).
- **Open items:** none new.


## 2026-10-12 — PR: claude/sweep-baseplate (PR link added after merge)

Open-item sweep (engineer, 2026-10-12: "continue making updates and fixes until it's completed … use your best judgment"). Items from the open-item inventory, section 8 (BP-O1 to O9, BP-O11, BP-A1, BP-C5, BP-D6). Basis: ACI 318-19, AISC 360-16, ASCE 7-22 (as the tool states), AISC DG1 2nd Ed. Units: kip, in, ksi. "Default model" = the tool's default state (18×18×1.5 A36 plate, W12X65, 2×2 1″ F1554-36 heavy hex, h_ef 12″, 30×30×36 pedestal, f'c 4 ksi cracked, 1″ grout, three default combinations). All values below were read from the page itself in headless Chromium (main vs branch).

Order of work: unconservative calc items (S1, S2, S3), then the conservative calc items and the bug (S4 to S7), then UI / import / dependency (S8 to S10).

### S1. ASCE 7-22 generator: snow slot S, 0.2S with seismic, 0.5L option (closes O1)   [calc change: generator only] [MORE conservative where snow is entered]
- **Where:** `const ASCE722 = {` (approx. line 702), new `const SNOW_FACTORS`, `generateCombos()` (anchor text `const roofs=hasS?`), `openComboGenerator()` (anchor text `0.5L in combinations 3, 4 and 6`), member-reaction receiver `plan()` (anchor text `if(add.E!==undefined && !(SL.useSeismic`).
- **Problem:** the §2.3.1 roof term "(Lr or S or R)" used only slot Lr. A snow load typed into slot S had no effect (a warning in the member-reaction receiver said so). No 0.2S in the §2.3.6 seismic combinations and no 0.5L option. Unconservative wherever snow governs the roof.
- **Before:**
  ```js
  const ASCE722 = {
    /* [label, {D,L,Lr,S,W,E}] — Lr and S share the roof-live slot */
    basic:[
      ["1.4D",                 {D:1.4}],
      ["1.2D+1.6L+0.5Lr",      {D:1.2,L:1.6,Lr:0.5}],
      ["1.2D+1.6Lr+1.0L",      {D:1.2,Lr:1.6,L:1.0}],
      ["1.2D+1.6Lr+0.5W",      {D:1.2,Lr:1.6,W:0.5}],
      ["1.2D+1.0W+1.0L+0.5Lr", {D:1.2,W:1.0,L:1.0,Lr:0.5}],
      ["0.9D+1.0W",            {D:0.9,W:1.0}],
      ["0.9D-1.0W",            {D:0.9,W:-1.0}]
    ],
    seismic:(sds)=>{ const up=0.2*(sds||0); return [
        ["("+fmt(1.2+up,2)+")D+1.0E+1.0L", {D:1.2+up, E:1.0, L:1.0}],
        ["("+fmt(1.2+up,2)+")D-1.0E+1.0L", {D:1.2+up, E:-1.0, L:1.0}], … ]; },
    omega:(sds,om)=>{ … ["…E+1.0L", {D:1.2+up, E:±o, L:1.0}] … }
  };
  …
  const sets=[].concat(
    SL.useBasic!==false ? ASCE722.basic : [],
    SL.useSeismic ? ASCE722.seismic(SL.SDS) : [],
    SL.useOmega   ? ASCE722.omega(SL.SDS, SL.omega) : []
  );
  ```
  Receiver `plan()`: `if(add.S!==undefined) r.warn.push('The ASCE 7-22 generator in this tool does not use the S (snow) slot: …');`
- **After:**
  ```js
  basic:(roofs, fL, sf)=>{
    const L=(fL===undefined)?1.0:fL, F=sf||SNOW_FACTORS["1.6"];
    const pf=r=>(r==="S"? F.p : 1.6), cf=r=>(r==="S"? F.c : 0.5);
    const out=[["1.4D", {D:1.4}]];
    const each=fn=>roofs.forEach(r=>out.push(fn(r)));
    each(r=>["1.2D+1.6L+"+fmt(cf(r),1)+r,         {D:1.2, L:1.6, [r]:cf(r)}]);
    each(r=>["1.2D+"+fmt(pf(r),1)+r+"+"+fmt(L,1)+"L", {D:1.2, [r]:pf(r), L:L}]);
    each(r=>["1.2D+"+fmt(pf(r),1)+r+"+0.5W",      {D:1.2, [r]:pf(r), W:0.5}]);
    each(r=>["1.2D+1.0W+"+fmt(L,1)+"L+"+fmt(cf(r),1)+r, {D:1.2, W:1.0, L:L, [r]:cf(r)}]);
    out.push(["0.9D+1.0W", {D:0.9, W:1.0}], ["0.9D-1.0W", {D:0.9, W:-1.0}]);
    return out;
  },
  seismic:(sds, fL, fS)=>{ … ["…D+1.0E+"+fmt(L,1)+"L"+sT, {D:1.2+up, E:1.0, L:L, S:s}] … }   /* sT = "+0.20S" when s>0 */
  omega:(sds,om,fL,fS)=>{ … same L and S terms … }
  const SNOW_FACTORS = {
    "1.6":{p:1.6, c:0.5, e:0.2,  label:"1.6S / 0.5S / 0.2S — service-level snow (ASCE 7-16 form)"},
    "1.0":{p:1.0, c:0.3, e:0.15, label:"1.0S / 0.3S / 0.15S — ASCE 7-22 strength-level snow (verify)"}
  };
  /* generateCombos */
  const hasS=nz("S");
  const roofs=hasS? (nz("Lr")? ["Lr","S"] : ["S"]) : ["Lr"];
  const fL=SL.halfL? 0.5 : 1.0;
  const sf=SNOW_FACTORS[SL.snowFactors]||SNOW_FACTORS["1.6"];
  const fS=hasS? sf.e : 0;
  ```
  Generator dialog: new checkbox "0.5L in combinations 3, 4 and 6 (§2.3.1 Exception 1 …)" and a "Snow (S) factors" selector. The receiver's slot-S warning is removed, because slot S is now used.
- **Defaults chosen:** 0.5L **off** (full L, conservative; the exception needs an occupancy judgement). Snow factors **1.6 / 0.5 / 0.2** (the service-level form the tool's 1.6Lr / 0.5Lr terms already use, and the larger gravity factors). The 7-22 set (1.0S / 0.3S / 0.15S, for strength-level snow from the 7-22 reliability-targeted ground snow load) is offered as an option and marked "verify": see Needs engineer N1.
- **No change when S is empty:** with all S values zero the set, the labels and the order are exactly as before (checked: default service loads, with and without seismic and Ω₀, give identical lists on main and branch).
- **Saved data:** two new optional fields in `S.serviceLoads`: `halfL` (boolean) and `snowFactors` ("1.6" or "1.0"). They are written only when the user touches the new controls. Old files load unchanged (absent = off / "1.6").
- **Governing provision:** ASCE 7-22 §2.3.1 combinations 1 to 5 and Exception 1 (0.5L); §2.3.6 combination 6 (snow term). Combination numbering per ASCE 7-22 §2.3 (verify against the printed standard).
- **Check case:** default service loads (D P −100, L −40, Lr −15, W P 20 / Vx 12 / My 200, E P 15 / Vx 10 / My 150) plus S = P −30, My 20 (kip, kip-in):
  - Before: S is ignored. 7 combinations, the same as with S = 0 (for example 1.2D+1.6Lr+1.0L, P = −184).
  - After (default factors): 11 combinations. Four new: 1.2D+1.6L+0.5S P = 1.2(−100)+1.6(−40)+0.5(−30) = **−199**, My = 10; 1.2D+1.6S+1.0L P = −120−48−40 = **−208**, My = 32; 1.2D+1.6S+0.5W P = −120−48+10 = **−158**, My = 0.5(200)+1.6(20) = 132; 1.2D+1.0W+1.0L+0.5S P = −120+20−40−15 = **−155**, My = 210.
  - With seismic on (S_DS 1.0): (1.40)D+1.0E+1.0L+0.20S P = −140+15−40−6 = **−171** (before −165), My = 150+4 = 154.
  - With "0.5L" ticked: 1.2D+1.6Lr+0.5L P = −120−24−20 = **−164** (before −184).
  - With the 7-22 set: 1.2D+1.0S+1.0L P = −120−30−40 = −190; 1.2D+1.6L+0.3S P = −193; (1.40)D+1.0E+1.0L+0.15S P = −169.5.
- **Conservatism:** more conservative wherever S is non-zero (S now enters). The 0.5L option and the 7-22 snow set are less conservative and are off by default.

### S2. Stand-off rod compression on the threaded section (closes O2)   [calc change] [MORE conservative]
- **Where:** `standoffCompressionCheck` (approx. line 3920). Anchor text `const dRoot=Math.max(d-1.2990/sp.n, 0.01);`
- **Problem:** the open stand-off (no grout) rod buckling check used the gross area and r = d/4. The exposed length between the leveling nut and the concrete is threaded, so the threaded section governs.
- **Before:**
  ```js
  const Ag=sp.Ag;                       /* gross area for compression */
  const r=d/4;                          /* radius of gyration of solid round = d/4 */
  ```
  Report: `"\\phi P_n=\\phi F_{cr}A_g=…"`, vars `["r",…,"radius of gyration, d/4 (solid round)"]`, `["A_g",…,"gross rod area"]`.
- **After:**
  ```js
  const dRoot=Math.max(d-1.2990/sp.n, 0.01);
  const Ag=sp.Ase;                      /* threaded (stress) area for compression; name kept for the report fields */
  const r=dRoot/4;                      /* radius of gyration of the root section = d_root/4 */
  ```
  Report: `A_{se}` in the φP_n line; vars `["r",…,"radius of gyration of the threaded root, d_root/4, d_root = d − 1.299/n = …"]`, `["A_se",…,"tensile stress area of the threaded rod …"]`. `dRoot` added to the returned object.
- **Basis chosen:** A = A_se (the tool's own A_se table, the same area the tension check uses). r = d_root/4 with the basic minor diameter d_root = d − 1.2990/n, the root that the A_se formula 0.7854(d − 0.9743/n)² is built on. No new input: a leveling-nut stand-off is threaded at the nut by definition.
- **Governing provision:** AISC 360-16 §E3 (flexural buckling), Eq. E3-2 / E3-3 / E3-4. The threaded-section properties follow ASME B1.1 thread geometry (A_se per ACI 318-19 R17.6.1.2 / AISC Table 7-17, verify).
- **Check case:** 1″ F1554-36 (F_y 36), n = 8, open stand-off "no clamping" (K = 2.0), z = 2″, elastic force model (so the rods carry compression), default combinations. C_u = 40.0 kip (1.2D+1.6L).
  - Before: r = 0.250, KL/r = 2(2)/0.25 = 16.0, F_e = π²(29000)/16² = 1118.0 ksi, F_cr = 0.658^(36/1118.0)(36) = 35.52 ksi, φP_n = 0.9(35.52)(0.7854) = **25.11 kip**, DCR = 40.0/25.11 = **1.593**.
  - After: d_root = 1 − 1.299/8 = 0.8376, r = 0.2094, KL/r = 4/0.2094 = 19.10, F_e = 784.4 ksi, F_cr = 0.658^(36/784.4)(36) = 35.32 ksi, φP_n = 0.9(35.32)(0.606) = **19.26 kip**, DCR = 40.0/19.26 = **2.077**.
- **Conservatism:** more conservative (φP_n about 23% lower for a 1″ rod).
- **Found while checking (not changed, see N3):** with the default neutral-axis force model the anchors never carry compression, so for an open stand-off C_u = 0 and this check always reads 0.00. Only the elastic model loads the rods in compression.

### S3. A2: 1V:2H frustum depth limited by the pedestal height H (closes O3)   [calc change] [MORE conservative or equal]
- **Where:** `bearingCap` (approx. line 1320). Anchor text `const kDepth=Math.min(1+4*Hs/A1_w, 1+4*Hs/A1_l);`. Report label in `bearingCheck` (anchor text `1V:2H frustum within the pedestal height H`).
- **Problem:** F13 made A2 geometrically similar and concentric, but the frustum depth was not checked against the pedestal height, so on a thin pedestal A2 (and √(A2/A1)) could be overstated.
- **Before:**
  ```js
  const kSim=Math.max(1, Math.min((C.Bx/2-oX)/(A1_w/2), (C.By/2-oY)/(A1_l/2)));
  ```
- **After:**
  ```js
  const Hs=Math.max(+C.H||0, 0);
  const kDepth=Math.min(1+4*Hs/A1_w, 1+4*Hs/A1_l);
  const kSim=Math.max(1, Math.min((C.Bx/2-oX)/(A1_w/2), (C.By/2-oY)/(A1_l/2), kDepth));
  ```
  Returned object gains `kDepth` and `depthGoverns`. The A_2 row of the bearing step says "1V:2H frustum within the pedestal height H" and adds "LIMITED BY H" when the depth governs.
- **Derivation:** each side of the lower base may lie at most 2H outside the loaded area, so k·A1_w ≤ A1_w + 4H, giving k ≤ 1 + 4H/A1_w (and likewise for A1_l). The pedestal height is used as the support depth (conservative: a footing below is ignored).
- **Governing provision:** ACI 318-19 §22.8.3.2 and Fig. R22.8.3.2 (A2 is the lower base of the largest frustum, side slopes 1 vertical to 2 horizontal, contained wholly within the support); AISC 360-16 J8.
- **Check case:** 18×18 plate, 1″ grout at 1:1 so A1 = 20×20 = 400 in². Pedestal 60×60, H = 4 in.:
  - Before: k = 30/10 = 3.0, A2 = 3600, √(A2/A1) = 2.0 (cap).
  - After: k_depth = 1 + 16/20 = 1.8, A2 = 400(1.8²) = 1296, √ = 1.8.
  - With 5 ksi grout: φf_p = 0.65(0.85)(5) = **2.7625 ksi** in both (grout governs).
  - With 10 ksi grout: before φf_p = 0.65(0.85)(4)(2.0) = **4.420 ksi** (bearing DCR 0.1676). After 0.65(0.85)(4)(1.8) = **3.978 ksi** (DCR 0.1862).
  - Default model (H = 36): k_depth = 8.2, so there is no change.
- **Conservatism:** more conservative or equal.

### S4. Shear hairpins: ℓ_d no longer NaN, so effective legs can be credited (closes O4)   [bug fix → calc change] [LESS conservative]
- **Where:** `shearRebarIntercept` (anchor text `const dev=tensionDevLengths(Object.assign({}, R, {cover}));`), `shearRebarCheck` (anchor text `const dev=ic? ic.dev : tensionDevLengths(Object.assign({}, R, {cover:`).
- **Problem:** `tensionDevLengths(S.vRebar)` read `R.cover`, which `vRebar` does not have, so c_b = NaN and ℓ_d = NaN. Every leg failed the "developed behind the failure plane" test, no hairpin was ever credited, and shear Condition A (F7) and the shear substitution never applied. Main also logged NaN SVG attribute errors in the hairpin plan drawing.
- **Before:**
  ```js
  const dev=tensionDevLengths(R);
  const cover=Math.max(R.cover!==undefined?R.cover:2.0,0);
  …
  const dev=ic? ic.dev : tensionDevLengths(R);
  ```
- **After:**
  ```js
  const cover=Math.max(R.cover!==undefined?R.cover:2.0,0);
  const dev=tensionDevLengths(Object.assign({}, R, {cover}));
  …
  const dev=ic? ic.dev : tensionDevLengths(Object.assign({}, R, {cover:Math.max(R.cover!==undefined?R.cover:2.0,0)}));
  ```
  This is the cover the intercept check already used for the leg set-out (2.0 in. unless a `cover` is present). No new input or saved field.
- **Governing provision:** ACI 318-19 §17.5.2.1.2 (anchor reinforcement for shear, developed on both sides of the breakout surface); §25.4.2.4 Eq. 25.4.2.4a (ℓ_d); Table 17.5.3 (Condition A φ = 0.75 for concrete shear breakout when the reinforcement is effective).
- **Check case:** default model, shear hairpins on with defaults (#4 Gr 60, 2 hairpins per leading anchor, spacing 4, ext. behind 12, acknowledgements not ticked):
  - ℓ_d: c_b = min(2.0 + 0.25, 4/2) = 2.0, (c_b+K_tr)/d_b = 4.0 → 2.5 (cap), ψ_s = 0.8. ℓ_d = (3/40)(60000 · 0.8)/(√4000 · 2.5) · 0.5 = **11.38 in → 12 in (min)**. Before: NaN.
  - Effective legs: before **0 of 8**; after **4 of 8** (available behind = 12 ≥ 12 required; the other 4 legs are outside 0.5c_a1).
  - Hairpin shear φV_r = 0.75 × (4 × 0.20) × 60 = **36.0 kip**. V_ua = 16.16 kip (1.2D+1.0W). DCR before ∞ (FAIL); after **0.449**.
  - Shear breakout φ (Condition A, F7): 0.70 → 0.75, so φV_cbg 14.346 → **15.371 kip**. Concrete breakout (V) DCR 1.126 → **1.051**; interaction 1.328 → **1.195**. Substitution stays off because the §17.5.2.1 acknowledgements are not ticked.
- **Conservatism:** less conservative. This restores the intended F7 / §17.5.2.1.2 behaviour.

### S5. ψ_ed,N from the anchors in tension (closes O5)   [calc change] [LESS conservative]
- **Where:** `tensionBreakoutGroup` (anchor text `const caOf=p=>Math.min(g.ca_x_pos+(g.xmax-p.x)`), `pryout` (anchor text `tb.psi_edAll`).
- **Problem:** ψ_ed,N used c_a,min of all anchors, while A_Nc (F3) and e′_N already use the anchors in tension.
- **Before:**
  ```js
  /* psi_ed,N */
  const ca=ca_min;
  ```
  pryout: `const Ncbg = tb.ANcRatioAll * tb.psi_ed * tb.psi_c * tb.psi_cp * tb.Nb;`, `psi_ed:tb.psi_ed`, `ca:tb.ca`, and the Step 3 text used `tb.ca` / `tb.psi_ed`.
- **After:**
  ```js
  const caOf=p=>Math.min(g.ca_x_pos+(g.xmax-p.x), g.ca_x_neg+(p.x-g.xmin),
                         g.ca_y_pos+(g.ymax-p.y), g.ca_y_neg+(p.y-g.ymin));
  const caAll=ca_min;
  const ca=Math.min(...tp.map(caOf));            /* ≥ caAll by construction */
  const psi_edAll = (caAll>=1.5*hef)?1.0:(0.7+0.3*caAll/(1.5*hef));
  ```
  Each anchor's edge distance is the group edge distance (geometric, or the user override) plus the anchor's set-back from the outermost anchor line. Pryout keeps the all-anchor ψ_ed,N (`psi_edAll`, `caAll`) to match its all-anchor cone, so pryout is unchanged by S5. The c_a,min row now reads "smallest edge distance of the n anchors in tension (§17.6.2.4)".
- **Governing provision:** ACI 318-19 §17.6.2.4.1, Eq. 17.6.2.4.1a/b (c_a,min of the anchor group in tension, read with §17.6.2.1 and Fig. R17.6.2.1(b)).
- **Check case:** pedestal 60×60, plate offset x = −18, h_ef = 8 (only one edge within 1.5h_ef, so no §17.6.2.1.2 reduction). Anchors at pedestal x = −24 and −12. Combination P = −10, M_y = −400: the two anchors at x = −12 are in tension.
  - Before: c_a,min = 6 (the compression anchors at the −x edge). ψ_ed,N = 0.7 + 0.3(6/12) = 0.85.
  - After: c_a,min = 6 + 12 = 18 ≥ 12, so ψ_ed,N = 1.0.
  - N_b = 24√4000(8^1.5)/1000 = 34.35 kip. A_Nc/A_Nco = 864/576 = 1.5. φN_cbg = 0.70(1.5)(ψ_ed)(34.35): before **30.65 kip**, after **36.06 kip**.
  - The default model is unchanged (all c_a = 9 = 1.5h_ef,eff).
- **Conservatism:** less conservative (only when the tension anchors are farther from the edge than the compression anchors).

### S6. ψ_h,V from c_a1 of the edge being checked (closes O6)   [calc change] [LESS conservative]
- **Where:** `shearBreakout` → `evalEdge` (anchor text `const psi_hV_e = (ha<1.5*c1)? Math.sqrt(1.5*c1/ha) : 1.0;`). The function-level `const psi_hV = (ha<1.5*ca1)? …` line is removed (no longer used).
- **Problem:** outside the narrow-member case, ψ_h,V came from the `ca1` argument. In the main check that is the group's smallest edge distance to any edge, not the c_a1 of the edge whose breakout is computed. The c_a1 used in A_Vc, A_Vco and V_b was different from the one in ψ_h,V.
- **Before:**
  ```js
  const psi_hV = (ha<1.5*ca1)? Math.sqrt(1.5*ca1/ha) : 1.0;
  …
  /* ψ_h,V with the §17.7.2.1.2-limited c_a1 (never larger than the value used before) */
  const psi_hV_e = narrow ? Math.min(psi_hV, (ha<1.5*c1)? Math.sqrt(1.5*c1/ha) : 1.0) : psi_hV;
  ```
- **After:**
  ```js
  const psi_hV_e = (ha<1.5*c1)? Math.sqrt(1.5*c1/ha) : 1.0;
  ```
  Here `c1` is this edge's c_a1, limited per §17.7.2.1.2 where the narrow-member rule applies.
- **Governing provision:** ACI 318-19 §17.7.2.6.1, Eq. 17.7.2.6.1 (ψ_h,V = √(1.5c_a1/h_a) ≥ 1.0). c_a1 is as used in §17.7.2.1 for that breakout surface, limited by §17.7.2.1.2.
- **Check case:** default model with plate offset x = −6, pedestal B_y = 60, H = 14, one combination V_x = +10 (toward +x). c_a1(+x) = 15, c_a2 = 24, h_a = 14.
  - V_b = min(38.98, 33.07) = 33.07 kip. A_Vc = 57 × 14 = 798, A_Vco = 4.5(15²) = 1012.5, ratio 0.788. ψ_ed,V = 1.0, ψ_c,V = 1.0.
  - Before: ψ_h,V from c_a1 = 3 (the −x edge) = 1.0 → V_cbg = 26.06, φV_cbg = **18.24 kip**, DCR **0.548**.
  - After: ψ_h,V = √(1.5 × 15/14) = 1.268 → V_cbg = 33.04, φV_cbg = **23.13 kip**, DCR **0.432**.
  - The default model is unchanged (h_a = 36 ≥ 1.5c_a1).
- **Conservatism:** less conservative. It removes a mismatch that A_Vc already accounts for, since A_Vc is clipped at h_a.

### S7. Pryout A_Nc/A_Nco cap = number of anchors in the group (closes O7)   [calc change] [LESS conservative — changes the default model]
- **Where:** `tensionBreakoutGroup` (anchor text `const nAll=g.pts.length;`), and the `pryout` Step 1 text (shows "≤ n" and an `n` row).
- **Problem:** the pryout cone (all anchors) was capped at nT, the number of anchors in tension in that combination. The §17.6.2.1 cap is n·A_Nco, where n is the number of anchors in the group. For pryout the group is all the anchors resisting shear.
- **Before:** `const ANcAll=extAll.ANc, ANcRatioAll=Math.min(ANcAll/ANco, nT);`
- **After:**
  ```js
  const nAll=g.pts.length;
  const ANcAll=extAll.ANc, ANcRatioAll=Math.min(ANcAll/ANco, nAll);
  ```
- **Governing provision:** ACI 318-19 §17.7.3.1, Eq. 17.7.3.1b (V_cpg = k_cp N_cpg, with N_cpg = N_cbg from §17.6.2 for the group); §17.6.2.1 (A_Nc ≤ n A_Nco).
- **Check case (default model, 1.2D+1.0W, n_T = 1):** h_ef,eff = 6 (§17.6.2.1.2), A_Nco = 9(6²) = 324, A_Nc,all = 30 × 30 = 900, N_b = 22.31 kip, ψ_ed,N = 1.0, k_cp = 2, φ = 0.70.
  - Before: ratio = min(900/324, 1) = 1.0. N_cbg = 22.31, V_cpg = 44.62, φV_cpg = **31.23 kip**. Pryout DCR = 16.16/31.23 = **0.517**.
  - After: ratio = min(2.778, 4) = 2.778. N_cbg = 61.97, V_cpg = 123.94, φV_cpg = **86.75 kip**. DCR = **0.186**.
  - In the default model pryout does not govern. The governing checks (breakout V 1.126, interaction 1.328) are unchanged.
  - Second case: h_ef 4, plate 24×24, edges 2, pedestal 60×60, P = 0, V_x = 20, M_y = 300 (n_T = 2). Before: ratio capped at 2, φV_cpg = 34.00 kip. After: ratio 4, φV_cpg = **68.00 kip**, DCR 0.588 → **0.294**.
- **Conservatism:** less conservative (when A_Nc,all/A_Nco > n_T).

### S8. Project header wraps to two columns below 600 px (closes O11)   [UI only]
- **Where:** CSS after `#projGrid{display:grid;…}` (approx. line 41).
- **Before:** (no rule)
- **After:** `@media (max-width:600px){ #projGrid{grid-template-columns:repeat(2,minmax(0,1fr));} }`
- **Check:** at 400 px, document scrollWidth was 784 on main and is 400 on the branch (no horizontal scroll). At 1400 px the header screenshot is byte-identical to main.

### S9. JSON import checks the file format (closes BP-C5)   [import robustness; export gains an optional tag]
- **Where:** `wireHeader()`: `btnExport` (anchor text `Object.assign({_bpad:"project",_bpadVersion:1},S)`) and the `fileImport` change handler (anchor text `This is a whole-workspace backup`).
- **Problem:** Import JSON accepted any JSON. A workspace backup or another tool's file was merged over defaults and silently replaced the current model. On main, importing a workspace backup reset the plate thickness to the default 1.5.
- **Before:**
  ```js
  const blob=new Blob([JSON.stringify(S,null,2)],{type:"application/json"});
  …
  rd.onload=()=>{ try{ S=mergeState(JSON.parse(rd.result)); buildProjHeader(); refreshAll(); }catch(err){ alert("Invalid JSON."); } };
  ```
- **After:**
  - Export writes `{_bpad:"project", _bpadVersion:1, …S}`: two new optional fields, stripped again on import.
  - Import: a non-object is refused. A workspace backup (`_bpad:"workspace"`) is refused with a pointer to "Restore All".
  - A file with another `_bpad` tag, or an untagged file without the `plate` / `anchor` / `conc` groups (another tool's file, named by its `_schema` if it has one), asks "Load anyway?" before anything changes.
  - Old untagged exports that have those groups load silently, exactly as before.
- **Saved data:** existing exports, autosave and project keys are unchanged. Older copies of the tool still read new exports (the two tag fields are copied into the state and ignored).
- **Check:** branch export → import returns the identical state (JSON equal) with no tag fields left in `S`. An old untagged export loads (plate t 2.25). A workspace file is refused, with no change. A `bridge-member-reactions` file is refused on Cancel, with no change. `[1,2]` is refused.

### S10. pdf.js: `isEvalSupported:false` (closes BP-D6)   [dependency mitigation, no version change]
- **Where:** `extractPdfText` (anchor text `getDocument({data:buf, isEvalSupported:false})`).
- **Before:** `const pdf=await pdfjsLib.getDocument({data:buf}).promise;`
- **After:** `const pdf=await pdfjsLib.getDocument({data:buf, isEvalSupported:false}).promise;   /* CVE-2024-4367 mitigation (pdf.js 3.11.174) */`
- **Check:** a real two-line PDF (made by Chromium) is extracted identically on main and branch through `extractPdfText`. pdf.js stays at 3.11.174.

### Not changed
- **BP-A1** (type `5.5` into f'c in Edge/Chrome by hand): the engineer's own check. D1's headless test still passes. Left for the engineer.
- **BP-O8, BP-O9:** need the engineer (N4, N5).

### Needs engineer
- **N1 (S1 snow factors).** Which snow factors should the generator default to? I recall that ASCE 7-22 §2.3.1 / §2.3.6 use 1.0S (primary), 0.3S (companion) and 0.15S (with seismic) for strength-level snow, replacing 7-16's 1.6S / 0.5S / 0.2S, but I could not check the printed standard. Recommendation: keep the default at 1.6 / 0.5 / 0.2 (conservative for gravity with service-level S). Confirm the 7-22 values and wording of the option ("verify" on its label) against your copy, and say whether the default should follow 7-22.
- **N2 (S1 scope).** Should the generator also produce 1.2D − 1.0W style wind-reversal combinations, and should rain (R) get a slot? Neither is generated today. Recommendation: add "−W" versions of combinations 3 and 4 only if your base-plate practice needs them; the uplift case 0.9D − 1.0W is already generated.
- **N3 (new, found under S2).** With the default neutral-axis force model, an open (ungrouted) stand-off puts no compression in the rods, so the rod compression / buckling check always shows 0.00. Bearing is N/A for an open gap, so compression is not checked at all. This is unconservative. Recommendation: for an open stand-off, take rod compression from the elastic bolt group (P/n ± M·c/I, compression kept), or switch the force model to elastic automatically for that stand-off type. Not changed: it is a new calculation issue outside the inventory.
- **N4 (BP-O8).** Condition A (Table 17.5.3) is granted when the intercept check credits at least one bar or leg. Do you want a stricter rule (all claimed bars effective) or an explicit "Condition A" input? Recommendation: require all claimed legs effective, or show a warning when fewer than all are, and keep the automatic decision.
- **N5 (BP-O9).** Please confirm F6 (§17.7.2.1.2 narrow-member c_a1) and F10 (DG1 uniform bearing block for e > N/6). Both follow the code text and lower some DCRs. Recommendation: keep both.

### Remaining open items
- N1 to N5 above, and BP-A1.
- Seen, not changed (display only, outside the inventory): the generator dialog note shows a literal `<b>…</b>` because `el()` sets `textContent`. Recommendation: build that note with `innerHTML`, or drop the tags.

### How verified
- `node --check` on every inline script: 4 blocks, 0 failures.
- Headless Chromium (Playwright, `/opt/pw-browsers/chromium`, KaTeX / three / Plotly / pdf.js served locally), origin/main vs branch, 14 model scenarios: default, both rebar types, group hairpin, open and clamped stand-off, two thin pedestals, offset moment, pryout cap, narrow member, 3×3 plain rod, an O5 edge case, an O6 ψ_h,V case, and a large load with seismic. For each scenario, compared every output tab's text, `allChecks()`, the per-combination intermediates (tension breakout, pryout, shear breakout), `bearingCap()`, the stand-off check, the hairpin intercept and the autosaved JSON. Also compared 7 generator scenarios.
  - Every difference is explained by S1 to S7. The default model's only result change is pryout (S7).
  - Every `VALIDATION_CASES` (PROFIS) target is identical on main and branch.
  - The autosaved JSON is identical in every scenario: no new default fields; `halfL` / `snowFactors` are written only when the generator controls are used.
- UI: the generator was driven through its real controls (checkbox, selector, Replace) and the resulting combinations and saved `serviceLoads` checked. Export / import was run through the real buttons with five file types (see S9). The PDF import ran with a real PDF. Screenshots at 400 px (header) and of the generator dialog were looked at.
- Console: main logged NaN SVG errors in both hairpin scenarios. The branch logs none.
  - Both builds log a harness-only error, "Cannot read properties of undefined (reading 'show')". It comes from the 3-D tab's delayed `setTimeout` firing after the test script resets `S`, and does not occur in normal use.
- **Other copies of this code:** none. The generator, anchor checks and import code are local to this tool. The member-reaction receiver's `check()` and unit tables are duplicated in Spread Footing.html, but the removed warning line is in this tool's own `plan()` and is not duplicated.


## 2026-10-12 — PR: claude/baseplate-n3 (PR link added after merge)

Follow-up to the claude/sweep-baseplate entry (#132), on the coordinator's instruction of 2026-10-12: N3 fixed, N4 warning added, the §17.6.2.2.3 N_b basis aligned with Concrete Anchor.html (#134), and the generator note fixed. Units: kip, in, ksi. "Default model" is as defined in the earlier entries.

### S11. Open stand-off: rod compression from the elastic bolt group, whatever force model is selected (closes N3)   [calc change] [MORE conservative]
- **Where:** `standoffCompressionCheck` (anchor text `const gp=anchorGeom().pts, nG=Math.max(gp.length,1);`). The C_u row label also changes.
- **Problem:**
  - With the default neutral-axis force model (`forceModel.method "na"`), the per-anchor forces assume a concrete bearing block, so no anchor ever carries compression.
  - For an open (ungrouted) stand-off there is no bearing (the bearing check is N/A). So C_u was always 0, the rod compression / buckling DCR always read 0.00, and the compression was not checked anywhere. This was unconservative.
- **Before:**
  ```js
  /* governing per-anchor compression across combos: rigid plate, compression side */
  let Cmax=0, gov="—";
  cc.combos.forEach(c=>{
    if(!c.perAnchor) return;
    c.perAnchor.forEach(p=>{ const comp=-p.t; if(comp>Cmax){Cmax=comp;gov=c.name;} });
  });
  ```
- **After:**
  ```js
  const gp=anchorGeom().pts, nG=Math.max(gp.length,1);
  const sx2=gp.reduce((a,p)=>a+p.x*p.x,0)||1e-9, sy2=gp.reduce((a,p)=>a+p.y*p.y,0)||1e-9;
  let Cmax=0, gov="—";
  cc.combos.forEach(c=>{
    const cb=c.raw||c;
    gp.forEach(p=>{ const t=(+cb.P||0)/nG + (+cb.Mx||0)*p.y/sy2 - (+cb.My||0)*p.x/sx2;
      const comp=-t; if(comp>Cmax){Cmax=comp;gov=c.name;} });
  });
  ```
  - This is the same expression and sign convention as the "elastic" force model in `computeAll` (T_i = P/n + M_x·y_i/Σy² − M_y·x_i/Σx²). With the elastic model selected, the result is therefore unchanged (checked: 40.00 kip in both builds).
  - The C_u row now says "elastic bolt group P/n ± M·c/Σc² — open gap, no bearing block, whatever force model is selected".
  - The S2 variable label `A_se` is now written `A_{se}` so that KaTeX renders it as one subscript (it showed as "A_s e").
- **Governing provision:** AISC 360-16 §E3 (column check of the exposed rod; unchanged). AISC Design Guide 1, 2nd Ed. §3.5 / §2.10 on leveling-nut stand-offs: with no grout, the rods carry all of the compression (verify the section numbers).
- **Check case:** default model, open stand-off "no clamping" (K = 2), z = 2″, default neutral-axis model.
  - Combination 1.2D+1.6L: P = −120, M_y = 240. Anchors at x = ±6, y = ±6, Σx² = 4(36) = 144.
  - Anchor at x = +6: T = −120/4 − 240(6)/144 = −30 − 10 = **−40 kip**, so C_u = 40 kip.
  - φP_n = 19.26 kip (S2: A_se 0.606, r 0.2094, KL/r 19.10, F_cr 35.32 ksi).
  - Before: C_u = 0, DCR = **0.00 (PASS)**. After: C_u = 40.00 kip, DCR = 40.00/19.26 = **2.08 (FAIL)**.
  - The same result is obtained for the clamped type. Grouted and flush stand-offs are unaffected, because the check returns null for them, as before.
- **Conservatism:** more conservative.

### S12. Hairpins: warn when fewer legs are effective than claimed (N4 / BP-O8)   [display only — Condition A rule unchanged]
- **Where:** `buildSummary`, after the substitution-status loop (anchor text `/* hairpins: fewer legs effective than claimed (BP-O8 / N4).`).
- **Before:** (no Summary warning. The Shear Rebar tab already had the `ineffCauseBanner` detail.)
- **After:** when shear rebar is present and `shearRebarIntercept(CC).nEff < nLegsTotal`, the Summary shows a warning box (which also prints).
  - Text: "Shear hairpins: only n_eff of N claimed legs are effective (§17.5.2.1.2 …). φV_r counts the effective legs only."
  - It then adds either "Condition A (φ = 0.75 …) is still applied … because at least one leg is effective — confirm the detail is acceptable with the reduced number of legs", or, when n_eff = 0, "No leg is effective, so shear breakout uses Condition B (φ = 0.70)".
- **Check:**
  - Default model with hairpins on: "only 4 of 8" (Condition A).
  - The same with `extBehind` = 2: "only 0 of 8" (Condition B).
  - Group hairpin, 2 of 2 effective: no warning.
- **Governing provision:** ACI 318-19 §17.5.2.1.2; Table 17.5.3. No result changes.

### S13. N_b for headed anchors with 11 ≤ h_ef ≤ 25 in: the 16-form whenever it applies (consistency with Concrete Anchor.html #134)   [calc change] [MORE conservative]
- **Where:** `tensionBreakoutGroup` (anchor text `const headed=(A.head!=="plainrod");`) and the Step 1 text. The pryout Step 2 text now shows the 16-form when it is used (before, it printed the 24-form equation next to the 16-form value).
- **Before:**
  ```js
  /* Nb: kc=24 cast-in; alt 16 form for 11<=hef<=25 — use larger (§17.6.2.2.3) */
  let NbAlt=0, useAlt=false;
  if(hef>=11 && hef<=25){ NbAlt=16*lam*Math.sqrt(fc*1000)/1000*Math.pow(hef,5/3); if(NbAlt>Nb1)useAlt=true; }
  const Nb=Math.max(Nb1,NbAlt);
  ```
- **After:**
  ```js
  let NbAlt=0, useAlt=false;
  const headed=(A.head!=="plainrod");
  if(headed && hef>=11 && hef<=25){ NbAlt=16*lam*Math.sqrt(fc*1000)/1000*Math.pow(hef,5/3); useAlt=true; }
  const Nb=useAlt? NbAlt : Nb1;
  ```
  - "Headed" means every head type except the plain rod: hex / heavy hex / square heads, headed studs, and the plate washer. A plain rod has no head, so §17.6.2.2.3 does not apply and it keeps the 24-form.
  - h_ef is the value used in the breakout equations (reduced per §17.6.2.1.2 where that applies), as before.
- **Problem:** max(24-form, 16-form) reads §17.6.2.2.3 as an optional alternative. If ACI 318-19 makes the 16-form mandatory in that range, the max is unconservative for 11 ≤ h_ef < 11.39 in, where the 16-form is smaller. Using the 16-form throughout the range satisfies both readings. The max also wrongly applied the headed-anchor equation to plain rods.
- **Governing provision:** ACI 318-19 §17.6.2.2.1 (Eq. 17.6.2.2.1, k_c = 24) and §17.6.2.2.3 (cast-in headed studs and headed bolts, 11 ≤ h_ef ≤ 25 in: N_b = 16λ_a√f'c h_ef^(5/3)).
- **Check cases** (f'c = 4000 psi, √f'c = 63.246, pedestal 80×80×40 so h_ef is not reduced):
  - **Headed, h_ef = 11.2:**
    - 24-form = 24(63.246)(11.2^1.5 = 37.48)/1000 = 56.89 kip.
    - 16-form = 16(63.246)(11.2^(5/3) = 56.06)/1000 = 56.73 kip.
    - Before: N_b = 56.89 (max). After: N_b = **56.73** (−0.28%).
    - φN_cbg (0.9D+1.0W): 73.35 → **73.15 kip**. Breakout (T) DCR 0.1139 → **0.1143**. Pryout DCR 0.1101 → **0.1104**.
  - **Headed, h_ef = 18:** 16-form 125.10 > 24-form 115.92, so N_b = 125.10 in both builds (no change).
  - **Plain rod, h_ef = 18:**
    - Before: N_b = 125.10 (16-form). After: N_b = **115.92** (24-form, −7.3%).
    - φN_cbg 130.82 → **121.21 kip**. Pryout φV_cpg 261.64 → **242.43 kip**, DCR 0.0617 → **0.0666**.
  - Crossover: 24h^1.5 = 16h^(5/3) at h = 1.5^6 = 11.39 in. For headed anchors, results change only for 11 ≤ h_ef < 11.39 in (≤ 0.7%).
- **Conservatism:** more conservative or equal.
- **Other copies:** Concrete Anchor.html has its own N_b code, already changed the same way in #134 (its L-bolt keeps the 24-form, like the plain rod here). Not touched in this PR.

### S14. Generator dialog note: bold text instead of literal `<b>` tags   [display only]
- **Where:** `openComboGenerator`, anchor text `/* innerHTML: el() sets textContent`.
- **Before:** `box.appendChild(el("div","note", "Enter SERVICE … <b>P positive = tension/uplift</b> …"));`. `el()` sets `textContent`, so the tags showed literally.
- **After:** `{ const nt=el("div","note"); nt.innerHTML= "Enter SERVICE … <b>P positive = tension/uplift</b> …"; box.appendChild(nt); }`. The text is a static string with no user input.
- **Check:** the note renders with one `<b>` element, and the screenshot was checked. The other `el("div","note", …)` calls in the file contain no tags.

### Status of the earlier open items
- N3: resolved by S11.
- N4 (BP-O8): warning added (S12). The rule itself is unchanged, as instructed.
- Still open: N1, N2, N5 (BP-O9) and BP-A1.

### How verified
- `node --check` on all 4 inline scripts: 0 failures.
- Headless Chromium, origin/main (3da718f) vs branch, 18 model scenarios plus 7 generator scenarios, with the same harness as #132. Four scenarios were added: headed h_ef 11.2, headed h_ef 18, plain rod h_ef 18, and an open stand-off with the elastic model. A Summary-warning comparison was also added.
  - Every result difference is explained by S11 (open and clamped stand-off) or S13 (h_ef 11.2, plain rod 18).
  - Text-only differences come from S11 / S13 labels, the S12 warning, and S2's `A_{se}` label.
  - The default model and every `VALIDATION_CASES` target are identical. The autosaved JSON is identical in every scenario. The generator lists are identical.
- No console errors from the page in either build, apart from the harness-only 3-D `setTimeout` error noted in #132.
- Screenshots checked: the Summary hairpin warning, the open stand-off rod-compression section (C_u 40.00, DCR 2.08 FAILS), and the generator note in bold.

## 2026-10-16 — PR: claude/bpad-profis-export (Export to Hilti PROFIS Engineering (.pe); PR link added after merge)

Engineer request 2026-10-16. A new export only: **no input, result, report or saved-data change** (verified below).

### X1. "Export to Hilti PROFIS (.pe)"   [new feature] [no result change]
- **Where:**
  - Header button, after `<button id="btnImportProfis">Import PROFIS PDF</button>`:
    ```html
    <button id="btnExportProfis" title="Write this design as a Hilti PROFIS Engineering file (.pe), with a summary of what to check in PROFIS">Export to Hilti PROFIS (.pe)</button>
    ```
  - Wiring in `init`, after `{ const b=document.getElementById("btnImportProfis"); if(b) b.addEventListener("click",openProfisImport); }`:
    ```js
    { const b=document.getElementById("btnExportProfis"); if(b) b.addEventListener("click",openProfisExport); }
    ```
  - New section `EXPORT TO HILTI PROFIS ENGINEERING (.pe)` inserted just before the `USER MANUAL & TECHNICAL GUIDE` comment block (after `openProfisImport`). It contains: `PROFIS_PE_NS`, `PROFIS_PE_XSI`, `PROFIS_PE_U` (unit factors), `PROFIS_PE_IDS` (catalog ID table), `PROFIS_PE_TEMPLATE` (the engineer's PROFIS file, verbatim, in a `String.raw` template literal), `profisNewGuid`, `profisNum`, `profisFastenerFor`, `profisProfileCandidates`, `profisDiaLabel`, `profisBuildPe(opts)` (builder) and `openProfisExport()` (dialog). To re-apply by hand, copy the whole section from this PR's commit; the template is `tests/projects/bpad/profis-example.pe` unchanged.
  - Manual §1.5: new sub-heading `Export to PROFIS (.pe)` after the note `Nothing is applied until you confirm. Anchor edge distances are imported as explicit overrides`.
- **How it works:** the template is parsed with `DOMParser`, values are replaced in place (`kid()` walks direct children by local name; `setT()` removes `i:nil` and sets the text), lists (anchor points, plate points, profile points, load combinations) are rebuilt by cloning the template's own entity, and the document is serialised with `XMLSerializer` and downloaded with a Blob (works from `file://`). `profisBuildPe` reads `S`, `anchorCoords()`, `anchorGeom()`, `colDims()`, `standoffParams()` and `governingComboIndex()`; it refreshes the cache `CC=computeAll()` with the same state (identical values) and writes nothing to `S` or storage.
- **Mapping and units** (PROFIS stores SI whatever its display units; the example confirms this: 10 kip = 44482.216 N, 10 ft-kip = 13558179.48 N·mm, 12 in = 304.8 mm):

  | PROFIS field | from | factor |
  |---|---|---|
  | AnchorPlate LengthA / LengthB / Thickness | plate B (x) / N (y) / t | × 25.4 mm/in |
  | AnchorLayout AnchorLayoutPoints X, Y (+ CalculatedData copy) | `anchorCoords()` (plate centre) | × 25.4 |
  | CalculatedData AnchorPlatePoints | ±B/2, ±N/2 | × 25.4 |
  | Anchor CustomEmbedmentDepth, CalculatedData EmbedmentDepth | h_ef | × 25.4 |
  | BaseMaterial Thickness | pedestal H | × 25.4 |
  | BaseMaterial EdgeXPositive / XNegative / YPositive / YNegative | `anchorGeom()` ca_x_pos / ca_x_neg / ca_y_pos / ca_y_neg (from the nearest anchor centre, as the template's `MeasureBaseMaterialEdgeFrom NearestAnchorCenter`) | × 25.4 |
  | BaseMaterial ConcreteGradeType Custom + CustomCompressiveStrength | f'c | × 6.894757293168361 MPa/ksi |
  | BaseMaterial ConcreteCharacteristic | cracked | Cracked / Uncracked |
  | Loads LoadCombinationEntity ForceZ / ForceX / ForceY | P / Vx / Vy | × 4448.2216152605 N/kip |
  | Loads LoadCombinationEntity MomentX / MomentY | Mx / My (kip-in) | × 112984.829027617 N·mm per kip-in |
  | MomentZ | — (no torsion input) | 0 |
  | Comment | combination name | — |
  | ActiveLoadCombinationId, Options ReportLoadCombination, top-level Loads Force*/Moment* | the governing combination (`governingComboIndex()`) | — |
  | ProjectName / DesignName | title block name (and number) | DesignName ends "(from Base Plate & Anchor Designer - verify in PROFIS)" |
  | Options ReportNotes | the check list shown in the dialog | — |
  | BaseMaterial SupplementaryReinforcement Height | Thickness − 60 mm (the template's relation; the reinforcement is inactive) | — |

  PROFIS's own kip factor in the example is 4448.221617233 N (4e-10 relative to the exact 4448.2216152605); the exact value is used.
- **Sign convention (assumed, flagged in the dialog and the file):** ForceZ = P (+ tension), ForceX = Vx, ForceY = Vy, MomentX = Mx, MomentY = My. Reasoning: this tool stores P tension-positive and the PROFIS PDF importer maps PROFIS N straight to P (PROFIS N + = tension); the engine header records that this tool's Mx/My (right-hand rule about the named axis: +Mx lifts +y, +My lifts −x) reproduce PROFIS anchor forces (Ramp Canopy report); Vx/Vy and the axes x = plate B, y = plate N are the importer's mapping (lx → B, anchor x → x). The example's Combo 2 (ForceZ −10 kip with moments) is consistent with compression being negative. Not yet confirmed by a PROFIS test file.
- **Catalog IDs (`PROFIS_PE_IDS`)** — only IDs seen in real files:
  - FastenerId **1829** = ½ in Heavy Hex Head ASTM F1554 Gr. 36, cast-in, `ACI31819_CIP` (engineer's file). Matches this tool's head `hvyhexhead` ("Heavy hex head bolt"), grade `f1554_36`, d = 0.5 only.
  - FastenerId **9952** = HIT-HY 200 V3 + HAS-V-36 (ASTM F1554 Gr.36), ½ in, `CSA_A233_19_Chem`, from the base file of github.com/rpakishore/Hilti-Profis (MPL-2.0; Canada region, CSA A23.3-19, ProjectDesignVersion 8100). Post-installed adhesive: never matched (this tool is cast-in only); marked "seen in a CSA/Canada file — confirm it is valid under the US/ACI region before relying on it". Only the ID facts were used, no code.
  - Profile **28 / 2958** = HSS4X4X.25 (matched from this tool's `HSS4X4`; wall thickness assumed, flagged).
  - AnchorLayoutId **8** with point Ids 2, 3, 5, 6 = the 2 × 2 grid.
  - Not identified (always "select in PROFIS"): plate SteelTypeId 40, profile SteelTypeId 46, ConcreteGradeId 65 (all three also appear in the CSA base file, so they look like defaults).
  - **Adding an ID:** copy it from a PROFIS .pe into the matching list of `PROFIS_PE_IDS` (the comment above the table names the fields) with its source; nothing else changes.
- **Not exported** (template value kept, listed in the dialog when it applies): stand-off / grout type, edge reinforcement, anchor reinforcement (kept Condition B), seismic options, plate and column steel grades, user f_uta, forced reduced h_ef. Lightweight concrete is always false (this tool is normalweight only).
- **Check case (reproduction of the engineer's file, `tests/bpad-profis.mjs`):** plate 12 × 12 × ½ in, HSS4X4 (→ HSS4X4X.25), 2 × 2 ½ in heavy hex head F1554 Gr. 36, h_ef 10 in, edx 1 / edy 2 in (anchors ±5, ±4 in), pedestal 28 × 26 in (edges 9 in), H 420 in, f'c 4 ksi, cracked; combinations "Combination 1" (Vx 10 kip) and "Combo 2" (P −10, Vx 10, Vy 2 kip, Mx 60, My 120 kip-in).
  - Hand: 12 × 25.4 = 304.8 mm; ½ × 25.4 = 12.7; 10 × 25.4 = 254; 5 × 25.4 = 127, 4 × 25.4 = 101.6; 9 × 25.4 = 228.6; 420 × 25.4 = 10668; P −10 × 4448.2216 = −44482.216 N; Vy 2 → 8896.443 N; Mx 60 kip-in × 112984.829 = 6779089.7 N·mm (= 5 ft-kip); My 120 → 13558179.5 N·mm; f'c 4 × 6.894757 = 27.579 MPa.
  - Field-by-field against the example (542 leaf fields): all match within 1e-9 relative except the 8 expected ones: ProjectName, DesignName, ReportNotes (title block / notes); ConcreteGradeType Custom vs Predefined and CustomCompressiveStrength 27.579 vs 25 (f'c written as a custom strength; with the "Template grade" option these two match); MomentZ of Combo 2 and the top-level MomentZ 0 vs 10 ft-kip (no torsion in this tool); Description of Combination 1 nil vs empty. The governing combination is Combo 2, as the example's active one.
- **How verified:** `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` (all scripts pass); `node tests/bpad-profis.mjs` (headless Chromium, offline):
  1. origin/main vs branch: `computeAll()` (every field), `governingComboIndex()`, every combination's `comboCapacities`, `VALIDATION` and the full print-report text identical on the default project and on all `VALIDATION_CASES` (msa3a, struct2v1, struct2v2); no console errors.
  2. reproduction as above; output well-formed XML, root `ProjectDesignConcreteEntity`, namespace `http://schemas.agito.si/PROFIS3`; `S` unchanged by the export.
  3. a design with unknown items (¾ in hex head F1554 Gr. 55, 3 × 2 anchors, W12X65, A572 Gr. 50 plate offset 1 in, uncracked, edge stirrups, tension reinforcement, grouted stand-off, seismic on): every item listed as "select in PROFIS" or "check"; 6 anchor points and all combinations written.
  4. the dialog's Download button writes a well-formed `Untitled.pe`; screenshot of the dialog checked.
- **Saved data:** none changed. No new storage keys.
- **Other copies:** none.
- **Open items:**
  - BP-X1: load sign convention and the plate LengthA/LengthB orientation are unconfirmed. Confirm by opening an exported file in PROFIS (ENGINEER_CHECKS A10). A PROFIS file with a non-square plate and one combination per load component (+N, +Vx, +Vy, +Mx, +My, +Mz alone) saved from PROFIS would settle both.
  - BP-X2: enum values not seen in a file: ConcreteGradeType `Custom`, ConcreteCharacteristic `Uncracked`. If PROFIS refuses the file, use "Template grade". A PROFIS file with a custom f'c and one with uncracked concrete would confirm them.
  - BP-X3: catalog IDs still needed (one PROFIS file each fills them): other cast-in anchors (⅝–2½ in, hex / heavy hex / square heads, F1554 Gr. 55 and 105, A449, A354 …), HSS of other sizes and walls, W shapes, round HSS, plate steels (A36, A572 Gr. 50 …), column steel, predefined concrete grades (2500–8000 psi), anchor layouts other than 2 × 2 (e.g. 2 × 3, 3 × 3, 4 × 2), the stand-off types (without clamping / with clamping / grouted), edge and anchor reinforcement settings, and a column offset on the plate.
  - BP-X4 (found, not changed): the PROFIS **PDF import** maps "Heavy Hex Head …" (any text matching `hex\s*head`) to head `heavyhex`, which this tool calls "Hex head bolt" (A_brg for ½ in: 0.291 vs heavy hex 0.467 in²). An imported heavy-hex design is therefore checked with the smaller standard-hex bearing area (conservative for pullout and side-face blowout) and will not match FastenerId 1829 on export. Decision needed before changing the importer (§4).

## 2026-10-16 — BP-X4: PROFIS PDF import maps "Heavy Hex Head" to the heavy hex head bolt (§4, Tier 2)
- **Engineer decision:** 2026-10-16, "map to heavy hex".
- **Function / anchor:** PROFIS PDF import, anchor line parser, comment `/* head type */`.
- **Before:**
  ```js
  if(/hex\s*head/i.test(txtv)){ st.head="heavyhex"; add("head","Head type","Heavy hex head",txtv,"high"); }
  ```
  Every "… Hex Head …" anchor, including "Heavy Hex Head", became the tool's `heavyhex` key. That key is the **standard** hex head bolt (A_brg table "hex"), even though the label said "Heavy hex head".
- **After:**
  ```js
  if(/heavy\s*hex\s*head/i.test(txtv)){ st.head="hvyhexhead"; add("head","Head type","Heavy hex head",txtv,"high"); }
  else if(/hex\s*head/i.test(txtv)){ st.head="heavyhex"; add("head","Head type","Hex head",txtv,"high"); }
  ```
- **Provision:** ACI 318-19 §17.6.3.2.2(a), N_p = 8 A_brg f′c. A_brg comes from the tool's existing bolt-head table (PROFIS Design Guide values); no table value changed.
- **Check case:** ½ in anchor, f′c = 4 ksi.
  - Before: imported as hex head, A_brg = 0.291 in², N_p = 8(0.291)(4) = 9.31 kip.
  - After: imported as heavy hex head, A_brg = 0.467 in², N_p = 8(0.467)(4) = 14.94 kip.
  - Side-face blowout, which uses √A_brg, rises in the same way.
  - Only designs **imported from a PROFIS PDF that names "Heavy Hex Head"** change; designs entered by hand are unaffected. Such an import now also exports with FastenerId 1829.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - The regex was checked on "Heavy Hex Head … 1/2" → heavy hex, "Hex Head … 3/4" → hex, and "HEAVY HEX HEAD 1" → heavy hex.
  - `node tests/bpad-profis.mjs` passes.

## 2026-10-16 — BP-X5: PROFIS export writes concrete edges from the plate centre (Tier 2, export only)
- **Reported by the engineer:** the exported design (18 × 18 in plate, 2 × 2 anchors at 12 in, c_a = 9 in, 30 × 30 in pedestal) opened in PROFIS with the concrete flush with the plate.
- **Cause:** PROFIS stores `BaseMaterial/EdgeXPositive … EdgeYNegative` as the distance from the plate (anchor-layout) origin to each concrete edge. `MeasureBaseMaterialEdgeFrom = NearestAnchorCenter` only changes how PROFIS displays the edges. The export wrote c_a (9 in from the anchors), which PROFIS took as 9 in from the plate centre, i.e. the plate edge. Two checks support this reading. The engineer's example file (12 × 12 plate, anchors at ±5/±4 in, 228.6 mm edges) is an 18 × 18 in block. The public sample file in rpakishore/Hilti-Profis writes 10000 mm for "far" edges.
- **Function / anchor:** `profisBuildPe`, comment `/* BP-X5 (2026-10-16)`.
- **Before:**
  ```js
  fill(bm,{EdgeXPositive:mm(g.ca_x_pos), EdgeXNegative:mm(g.ca_x_neg), EdgeYPositive:mm(g.ca_y_pos), EdgeYNegative:mm(g.ca_y_neg)});
  ```
- **After:**
  ```js
  const eg=[g.ca_x_pos+g.xmax, g.ca_x_neg-g.xmin, g.ca_y_pos+g.ymax, g.ca_y_neg-g.ymin];
  fill(bm,{EdgeXPositive:mm(eg[0]), EdgeXNegative:mm(eg[1]), EdgeYPositive:mm(eg[2]), EdgeYNegative:mm(eg[3])});
  ```
  The export-dialog row now lists the edges from the plate centre and also shows c_a.
- **Provision:** none. No calculation in the tool changed; this is only the export file mapping.
- **Check case:** the engineer's design. The anchors are at ±6 in, c_a = 9 in, and the pedestal is 30 in.
  - Before: Edge* = 9 in = 228.6 mm, so the concrete ends at the 18 in plate edge.
  - After: Edge* = 9 + 6 = 15 in = 381.0 mm, giving a 30 × 30 in pedestal with 9 in from each anchor.
  - With a pedestal offset or c_a overrides, the edge is still c_a + the outer anchor offset.
- **Test change:** the reproduction design in `tests/bpad-profis.mjs` is now an 18 × 18 in pedestal instead of 28 × 26, matching the corrected reading of the example.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs` passes: results are identical to main, and the example is reproduced with only the expected differences.
  - A headless export of the engineer's design writes 381 mm on all four edges.

## 2026-10-16 — BP-X6: PROFIS export, catalog items learned from the engineer's re-saved files (Tier 2, export only)
- **Source:** four PROFIS re-saves of an exported design, `Drafts_Untitled*.pe` in Structural_References, plus the engineer's answers on 2026-10-16.
- **Learned:**
  - ConcreteGradeId 67 = 4000 psi (confirmed by the engineer).
  - ConcreteGradeType "Custom" is accepted: PROFIS opened and re-saved such files.
  - Stand-off with grouting = `StandoffType WithGrouting` with `StandoffRestraintLevel 2`. The engineer set this in PROFIS; the meaning of the restraint level is not identified.
  - Concrete edges 381 mm were kept unchanged by PROFIS.
- **Not yet identified (engineer to look up in PROFIS):**
  - FastenerId 1901, the anchor picked in file (2), with "Untorqued" and nut and washer set.
  - Profile family 24 / size 920, the column picked in file (3), probably W12X65.
  - EdgeReinforcementId 6, which goes with Condition A and anchor reinforcement on.
- **Function / anchor:** `PROFIS_PE_IDS.concreteGrades`; `profisBuildPe` f′c verify text; stand-off block, comment `/* BP-X6 (2026-10-16)`.
- **Before:**
  ```js
  concreteGrades:[],
  ...
  if(so.hasStandoff){ row("Stand-off",…,"StandoffType None (template)","select"); verify.push("Select in PROFIS after opening: stand-off …"); }
  ```
- **After:**
  ```js
  concreteGrades:[ { id:67, fc:4, … confirmed:true } ],
  ...
  if(so.hasStandoff && so.type==="grout"){ StandoffType "WithGrouting", StandoffDistance = mm(gap), StandoffRestraintLevel 2, status "check" }
  else if(so.hasStandoff){ …unchanged… }
  ```
  - f′c of exactly 4 ksi is now written as Predefined grade 67; other strengths are still written as Custom.
  - A flush plate on a grout pad (stand-off type "none") is unchanged: it is still written as no stand-off, with a note.
- **Provision:** none. No calculation in the tool changed; this is only the export file mapping.
- **Check case:**
  - f′c 4 ksi. Before: Custom 27.579 MPa. After: Predefined grade 67.
  - Grouted stand-off with a 1.0 in gap. Before: None / 30 mm / 0. After: WithGrouting / 25.4 mm / 2.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs` passes. The expected diff for the example is now ConcreteGradeId 65 → 67.

## 2026-10-16 — BP-X7: PROFIS export, mappings confirmed by the engineer's PROFIS files and reports (Tier 2, export only)
- **Source:** the private repo `mlococo88/Hilti_Profis_References`, files `1–4.pe` with their PROFIS 3.1.36 reports `1–4.pdf`. The files stay in that private repo and are not copied here.
- **Confirmed:**
  - **Load signs.** This tool's anchor tensions (`naAnchorForces`) match the reports for the same inputs:
    - Report 3, combination 1 (N 10, Vx 10, Vy 10, Mx 1, My 1 ft-kip): PROFIS 2.501 / 1.004 / 3.998 / 2.501 kip; tool 2.501 / 1.004 / 3.998 / 2.501 kip.
    - Report 4, combination 2: PROFIS 2.336 / 0 / 4.928 / 2.336 kip; tool 2.335 / 0 / 4.931 / 2.335 kip.
    - Report 1, combination 2: PROFIS 2.352 / 0 / 5.735 / 2.352 kip; tool 2.351 / 0 / 5.740 / 2.351 kip.
    - So ForceZ = P (+ tension), MomentX = Mx and MomentY = My are confirmed. Anchor numbering is −x−y, +x−y, −x+y, +x+y.
  - **Concrete edges are measured from the plate centre (BP-X5).** Report 1 has edges of 355.6 mm with anchors at ±4 in and prints c_a,min = 10.000 in.
  - **FastenerId 1901** = ¾ in Heavy Hex Head ASTM F1554 Gr. 105 (Diameter 19.05 mm, HoleSize 20.6375 mm).
  - **Profile family 24** = W shape (AISC); size 911 = W10X15. W10X15 is not in this tool's library, so this entry is recorded but never matched yet.
  - **W orientation.** PROFIS draws a W at Angle 0 with its depth along X (W10X15 layout points ±126.873 mm in x). This tool has the depth along y.
  - **EdgeReinforcementId 6** = "> No. 4 bar with stirrups" (ψ_c,V 1.400 in the report).
  - **Grouted stand-off.** `StandoffRestraintLevel 2` is printed as "restraint level (anchor plate): 2.00", and `StandoffDistance` is e_b.
  - **ConcreteGradeId 67** = "4000", f′c 4,000 psi.
- **Function / anchors:** `PROFIS_PE_IDS.fasteners` and `.profiles`; `profisBuildPe`, at comments `BP-X7 (2026-10-16)` (W orientation, edge reinforcement, stand-off, load signs); and the export-dialog sign-mapping text.
- **Before:**
  - FastenerId 1901 and W10X15 were not in the table.
  - Edge reinforcement "bar with stirrups" was not exported (verify note).
  - The grouted stand-off row was "check", with a note that the restraint level was not identified.
  - The load-sign mapping was listed as an assumption in the verify list.
  - The dialog said "Sign mapping (assumed)".
- **After:**
  - The 1901 and W10X15 entries are added.
  - Stirrups → `EdgeReinforcementId 6` (ok).
  - The grouted stand-off row is "ok".
  - Load signs are a confirmed "ok" row.
  - The dialog says "confirmed against PROFIS reports".
  - A W-shape column adds a verify note to rotate the profile 90° in PROFIS. Angle stays 0, because its unit has not been seen.
- **Provision:** none. No calculation in the tool changed; this is only the export file mapping. ψ_c,V = 1.4 for No. 4 bar with stirrups is ACI 318-19 §17.7.2.5.1, unchanged.
- **Check case:** export a design matching report 1 and compare with `1.pe`:
  - 12 × 12 × 0.5 in plate; ¾ in heavy hex F1554 Gr. 105; h_ef 8 in; anchors ±4 in; 28 × 28 in concrete, h 420 in; f′c 4 ksi; stirrups; grouted stand-off.
  - Every input field matches except these, all expected:
    - StandoffDistance (e_b) comes from this tool's grout thickness.
    - ReinforcementConditionTension: A in PROFIS; this tool's Condition A is not mapped.
    - SupplementaryReinforcement EdgeOffsetLeft/Right: PROFIS recomputes them as edge − 130 / edge − 190 mm.
    - MomentZ: this tool has no torsion.
    - The active combination.
    - Rounding at 1e-9.
- **Still open:**
  - Plate LengthA/LengthB orientation: all four plates are square.
  - Profile size 920.
  - Edge reinforcement IDs for "none" (the template's 4) and "edge bar".
  - Condition A / anchor reinforcement mapping.
  - Plate and column steel IDs: the reports do not print the plate steel.
  - Stand-off types other than grouted.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs` passes. The unknown-items case now uses an edge bar, which is still unmapped, and expects the W orientation note.

## 2026-10-16 — BP-X8: PROFIS export, plate orientation, edge reinforcement and clamped stand-offs from examples 5–10 (Tier 2, export only)
- **Source:** `mlococo88/Hilti_Profis_References`, files `5–10.pe` with their reports. Each example changes one setting from the one before.
- **Confirmed:**
  - **Example 5, plate orientation:** LengthB 355.6 → 406.4 mm is printed as "lx x ly = 14.000 x 16.000 in". So LengthA = l_x = B and LengthB = l_y = N, as the export already writes.
  - **Examples 6/7, edge reinforcement IDs:**
    - 4 = "none or < No. 4 bar";
    - 5 = "> No. 4 bar";
    - 6 = "> No. 4 bar with stirrups" (BP-X7).
  - **Example 8:** `IsAnchorReinforcementTension/Shear` are separate flags; "anchor reinforcement: shear" means tension false, shear true.
  - **Example 9, stand-off without clamping:** `StandoffType WithoutClamping` is printed as "without clamping (anchor); restraint level (anchor plate): 1.00; eb = 1.181 in" (StandoffDistance 30 mm). PROFIS also set `StandoffNutAndWasherHeight` 23.8125 mm (15/16 in) for the ¾ in anchor.
  - **Example 10, stand-off with clamping:** `StandoffType WithClamping` with restraint level 2 is printed as "with clamping (anchor); restraint level 2.00; eb = 2.181 in" (StandoffDistance 55.3974 mm). So StandoffDistance = e_b.
- **Function / anchors:** `profisBuildPe`, at comments `BP-X8 (2026-10-16)` (plate, edge reinforcement, stand-off).
- **Before:**
  - Non-square plates added a verify note that the orientation was unconfirmed.
  - Edge reinforcement: only "stirrups" was mapped (ID 6); "edge bar" gave a verify note; "none" kept the template ID 4 implicitly.
  - Stand-off without / with clamping wrote StandoffType None, with a "select in PROFIS" note.
- **After:**
  - The plate orientation note is removed.
  - Edge reinforcement: none → 4, bar → 5, stirrups → 6 (all "ok").
  - Stand-off without clamping → `WithoutClamping`, StandoffDistance = clear gap, restraint level 1.
  - Stand-off with clamping → `WithClamping`, StandoffDistance = clear gap, restraint level 2.
  - Both clamping types add a verify note: the nut and washer height is written as 0.
  - These restraint levels equal this tool's α_M (1.0 and 2.0) for the same types.
- **Provision:** none. No calculation in the tool changed; this is only the export file mapping.
- **Check case:** designs matching examples 7, 9 and 10 were exported with a 14 × 16 × 1.25 in plate; anchors ±4 in by ±4 in; 28 × 28 × 30 in concrete; f′c 4 ksi.
  - LengthA/B, Edge*, EdgeReinforcementId, StandoffType, StandoffDistance and StandoffRestraintLevel all match the PROFIS files.
  - The exceptions are StandoffNutAndWasherHeight (0 vs 23.8125 mm, noted in the verify list) and the leftover restraint level when there is no stand-off.
- **Still open:**
  - W12X65 size ID (920?) and other shapes.
  - Plate and column steel IDs.
  - W rotation angle field.
  - Condition A (supplementary reinforcement) and anchor-reinforcement mapping: needs an engineer decision on how this tool's tension/shear rebar maps to PROFIS "supplementary" vs "anchor" reinforcement.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs` passes. The unknown-items case no longer expects edge reinforcement and plate orientation notes, since both are mapped.

## 2026-10-16 — BP-X9: PROFIS export writes tension/shear reinforcement as this tool uses it (Tier 2, export only)
- **Engineer decision:** 2026-10-16, option (d): write the reinforcement as this tool uses it.
- **Function / anchor:** `profisBuildPe`, comment `/* BP-X9 (2026-10-16, engineer decision (d))`. It replaces the "Anchor reinforcement … is not exported" verify note.
- **Mapping:** done separately for tension (`S.tRebar`) and shear (`S.vRebar`); PROFIS stores them as separate flags (example 8).

  | This tool | PROFIS file | Seen in |
  |---|---|---|
  | §17.5.2.1 substitution justified (`substitutionJustified(CC)`) | IsAnchorReinforcement[Tension/Shear] true, ReinforcementCondition A | example 4 |
  | Not justified, but `conditionA(kind, CC)` true (a leg crosses the surface) | Condition A, anchor reinforcement off | example 1 |
  | Present, but no leg crosses the surface | Condition B, anchor reinforcement off, plus a note | — |
  | None | Condition B, anchor reinforcement off | template |

  `IsAnchorReinforcement` = tension OR shear. A verify note says PROFIS does not design the bars.
- **Before:**
  ```js
  if((S.tRebar&&S.tRebar.present)||(S.vRebar&&S.vRebar.present))
    verify.push("Anchor reinforcement (…) is not exported: the file keeps \"no anchor reinforcement\", Condition B. Set it in PROFIS.");
  ```
- **After:** the mapping above, two "Reinforcement — tension/shear" rows, and the notes.
- **Provision:** ACI 318-19 §17.5.2.1 (anchor reinforcement in lieu of breakout) and Table 17.5.3 (Condition A/B). This tool's checks are unchanged; this is only the export file mapping.
- **Check cases (default design):**
  - Tension and shear rebar at their defaults: the tension legs do not cross the cone, and the shear hairpins cross it but are not justified. Written: tension B, shear A, no anchor reinforcement.
  - With `substitutionJustified` stubbed to tension justified, shear not: IsAnchorReinforcement true, Tension true, Shear false, conditions A / A.
  - No rebar: B / B, all flags false (unchanged).
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs` passes. The unknown-items case expects the new reinforcement note.

## 2026-10-16 — BP-X10: PROFIS export, FastenerId 1841 (1 in Heavy Hex Head F1554 Gr. 36) and a standard-hex note (Tier 2, export only)
- **Source:** `Hilti_Profis_References`, files `11.pe` / `11.pdf` / the app report, and `12.pe` / `12.pdf`.
  - Example 11 is the engineer's export of the default design. PROFIS used the template ½ in anchor, because the design's 1 in "Hex head bolt" had no catalog ID.
  - Example 12 is the same file with 1 in Heavy Hex Head F1554 Gr. 36 selected: `FastenerId 1841` (Diameter 25.4 mm, HoleSize 26.9875 mm).
- **Example 11 explained:** PROFIS's anchor tensions (0.966 / 0 / 1.761 / 0.102 kip, combination 0.9D+1.0W) match this tool run with a ½ in heavy hex (0.970 / 0 / 1.769 / 0.102). The difference was only the anchor.
- **Example 12 vs this tool, default design:**
  - Anchor tensions: PROFIS 1.499 / 0 / 3.813 / 0 kip; tool 1.501 / 0 / 3.827 / 0 kip.
  - φN_sa: PROFIS 26.361 kip; tool 26.36.
  - φN_cbg: PROFIS 20.169 kip; tool 20.16.
  - φV_cbg (y+): PROFIS 14.346 kip; tool 14.35.
  - φV_cpg: PROFIS 86.755 kip; tool 86.75.
  - φN_pn: PROFIS 33.622 kip; tool 26.05 with the standard Hex head, or 33.622 with Heavy hex head.
  - These method differences remain:
    - steel shear: this tool puts the shear on 2 anchors (8.08 kip each), PROFIS on 4 (4.04 kip each);
    - grout: this tool applies the §17.7.1.2.1 0.80 factor for its 1 in grout pad, PROFIS has no stand-off. 13.708 × 0.80 = 10.97 kip, as this tool gives.
- **Function / anchor:** `PROFIS_PE_IDS.fasteners` (new 1841 entry); `profisBuildPe` anchor block, comment `BP-X10 (2026-10-16)`.
- **Before:** a 1 in heavy hex Gr. 36 design wrote the template ½ in anchor (1829), with "select in PROFIS".
- **After:**
  - It writes FastenerId 1841.
  - A design with the standard "Hex head bolt" still writes the template, and adds a note: PROFIS cast-in bolts are Heavy Hex Head, and this tool's hex head has a smaller A_brg.
- **Provision:** none. No calculation in the tool changed; this is only the export file mapping.
- **Check case:** default design, HSS4X4, head set to Heavy hex head bolt. The export is identical to `12.pe` in every input field; only the report-option and empty-vs-nil formatting fields differ.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs` passes.

## 2026-10-16 — BP-X11: PROFIS export, Heavy Hex Head F1554 Gr. 36 sizes 5/8–1-1/8 in (Tier 2, export only)
- **Source:** the engineer, read from PROFIS on 2026-10-16:
  - 5/8 in = 1832;
  - 3/4 in = 1835;
  - 7/8 in = 1838;
  - 1-1/8 in = 1844.
  - These complete the series with 1/2 in = 1829 and 1 in = 1841 (example 12).
- **Grade:** Gr. 36, confirmed by the engineer on 2026-10-16. Same series as 1829 and 1841, with a step of 3 per 1/8 in.
- **Function / anchor:** `PROFIS_PE_IDS.fasteners`. The four new entries follow the 1841 entry.
- **Before:** these sizes wrote the template 1/2 in anchor (1829), with "select in PROFIS".
- **After:** each size writes its own FastenerId.
  - The CalculatedData HoleSize is d + 1/16 in, as in 1829 (14.2875 mm) and 1841 (26.9875 mm). PROFIS recomputes this field on open.
  - Sizes above 1-1/8 in still write the template, with "select in PROFIS".
- **Provision:** none. No calculation in the tool changed; this is only the export file mapping.
- **Check case:** the default design with a heavy hex head, exported at each diameter:

  | Diameter (in) | 0.5 | 0.625 | 0.75 | 0.875 | 1.0 | 1.125 | 1.25 |
  |---|---|---|---|---|---|---|---|
  | FastenerId | 1829 | 1832 | 1835 | 1838 | 1841 | 1844 | 1829 (template) |

- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs` passes.

## 2026-10-16 — BP-X12: PROFIS export, Heavy Hex Head F1554 Gr. 36 / 55 / 105, all PROFIS sizes (Tier 2, export only)
- **Source:** 18 PROFIS files `Drafts_Untitled (1) (1–18).pe` in `Hilti_Profis_References`. Each file stores FastenerId, FastenerFamilyName and Diameter, so every ID read is self-identifying.
  - Gr. 36: 1/2–1-1/8 in = 1829, 1832, 1835, 1838, (1841 from example 12), 1844.
  - Gr. 55: 1/2–1-1/8 in = 1862, 1865, 1868, 1871, 1874, 1877.
  - Gr. 105: 1/2–1-1/4 in = 1895, 1898, 1901, 1904, 1907, 1910, 1913.
- **Numbering:**
  - PROFIS offers 11 sizes: 1/2, 5/8, 3/4, 7/8, 1, 1-1/8, 1-1/4, 1-3/8, 1-1/2, 1-3/4, 2 in.
  - Each grade is one block, step 3: Gr. 36 = 1829 + 3k, Gr. 55 = 1862 + 3k, Gr. 105 = 1895 + 3k.
  - The block starts are exactly 33 = 11 × 3 apart (1862 − 1829, 1895 − 1862). That fixes the sizes not read: Gr. 36 and Gr. 55 1-1/4–2 in, and Gr. 105 1-3/8–2 in.
- **Function / anchor:** the IIFE after `PROFIS_PE_IDS`, comment `/* BP-X12 (2026-10-16)`, appends the missing entries. The `profisBuildPe` anchor row is "check" for an inferred ID, with a verify note.
- **Before:** only Gr. 36 1/2–1-1/8 in and Gr. 105 3/4 in were mapped.
- **After:**
  - Gr. 36, 55 and 105, 1/2–2 in are mapped (33 IDs).
  - IDs read from a file → "ok".
  - Inferred IDs → "check", plus a note to confirm the anchor name on page 1 of the PROFIS report.
  - 2-1/4 and 2-1/2 in (not offered by PROFIS) still write the template with "select in PROFIS".
- **Provision:** none. No calculation in the tool changed; this is only the export file mapping.
- **Check case:** the default design with a heavy hex head, exported for every diameter and grade:
  - Gr. 36: 1829 … 1844, then 1847i, 1850i, 1853i, 1856i, 1859i.
  - Gr. 55: 1862 … 1877, then 1880i … 1892i.
  - Gr. 105: 1895 … 1913, then 1916i … 1925i.
  - 2.25 and 2.5 in → template.
  - (i = inferred.)
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs` passes.

## 2026-10-16 — BP-D1: default anchor head changed to heavy hex (§4, Tier 2)
- **Engineer request:** 2026-10-16, "Change the app's default head to heavy hex". PROFIS cast-in anchors are Heavy Hex Head (BP-X10–X12).
- **Function / anchor:** `defaultState()`, `anchor.head`; `mergeState()`, comment `BP-D1 migration`.
- **Before:**
  ```js
  head:"heavyhex",      /* heavyhex(hex) | hvyhexhead | ... */
  ```
- **After:**
  ```js
  head:"hvyhexhead",    /* default heavy hex head (engineer 2026-10-16, BP-D1; was "heavyhex" = standard hex) | ... */
  ```
- **Migration (CLAUDE.md §5):** a saved project, autosave or imported JSON whose `anchor` group has no `head` field keeps `"heavyhex"`, the old default. A stored head is always kept. Tested:
  - saved without head → heavyhex;
  - saved sqhead → sqhead;
  - new project → hvyhexhead.
- **Effect:** new projects only.
  - A_brg from the existing table (PROFIS Design Guide values; no table value changed).
  - Pullout: ACI 318-19 §17.6.3.2.2(a), N_p = 8 A_brg f′c.
  - Side-face blowout: §17.6.4.1, which uses √A_brg.
- **Check case:** the default design (1 in F1554 Gr. 36, f′c = 4 ksi, ψ_c,P = 1.0).
  - Before: A_brg = 1.163 in², N_p = 8 × 1.163 × 4 = 37.22 kip, φN_pn = 0.70 × 37.22 = 26.05 kip.
  - After: A_brg = 1.501 in², N_p = 8 × 1.501 × 4 = 48.03 kip, φN_pn = 0.70 × 48.03 = 33.62 kip.
  - The after value equals PROFIS example 12 (33.622 kip).
  - The default design's other results are unchanged.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs`: the default design differs from main only in the pullout values above, as intended. The three PROFIS validation cases (msa3a, struct2v1, struct2v2) are identical.

## 2026-10-16 — BP-C2: tension breakout A_Nc is the area covered by the tension anchors' 1.5h_ef squares (§4, Tier 2)
- **Engineer decision:** 2026-10-16, "go ahead". Found by comparing this tool with the engineer's PROFIS examples 1–12 (`Hilti_Profis_References`).
- **Function / anchor:** `breakoutExtents()`, comment `BP-C2 (2026-10-16)`; `tensionBreakoutGroup()`, step "Projected areas & modification factors", A_Nc line.
- **Before:** A_Nc = the bounding rectangle of the tension anchors ± 1.5h_ef, clipped by the member edges:
  ```js
  ANc:Math.max(0,(x2-x1))*Math.max(0,(y2-y1))
  ```
- **After:** A_Nc = the union of each tension anchor's 2(1.5h_ef) square, clipped by the edges (exact, by coordinate cells), and never more than the rectangle.
  - The rectangle is still returned as `ANcRect` for the drawing extents.
  - When the two differ, the step shows the rectangle minus the uncovered area.
- **Code:** ACI 318-19 §17.6.2.1 and Fig. R17.6.2.1(b). A_Nc is the projected area of the failure surface of the anchors in tension.
- **Effect:** a full rectangular tension group with s ≤ 3h_ef is unchanged. An L-shaped group (e.g. 3 of 4 anchors in tension) or widely spaced anchors (s > 3h_ef) now get the smaller, correct area. The old value was unconservative.
- **Check case 1 (PROFIS example 1):**
  - Inputs: 2 × 2 anchors at ±4 in; 28 × 28 in member; h_ef = 8 in reduced to h_ef′ = 6.667 in (§17.6.2.1.2), so 1.5h_ef′ = 10 in; anchors 1, 3, 4 in tension, anchor 2 (+4, −4) not.
  - Before: A_Nc = 28 × 28 = 784 in²; φN_cbg = 32.53 kip.
  - After: A_Nc = 784 − (14 − 6)(14 − 6) = 784 − 64 = 720 in².
    - φN_cbg = 0.75 × (720/400) × 0.920 × 0.920 × 1.0 × 1.0 × 1.0 × 26.128 = 29.88 kip.
    - PROFIS: A_Nc = 720 in², φN_cbg = 29.885 kip.
- **Check case 2 (PROFIS example 11):** ½ in anchors at ±6 in; 30 × 30 in member; h_ef′ = 6.0 in, so 1.5h_ef′ = 9 in.
  - Before: A_Nc = 900 in², φN_cbg = 30.72 kip.
  - After: A_Nc = 900 − 12 × 12 = 756 in², φN_cbg = 25.81 kip. PROFIS: 756 in², 25.808 kip.
- **Pryout:** unchanged. It uses all anchors, a full grid.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs`: the default design and the three built-in PROFIS cases (msa3a, struct2v1, struct2v2) are identical to main.
  - The examples 1–12 comparison (private scratch script) gives φN_cbg within 0.03% of PROFIS for examples 1, 2, 3, 8, 11 and 12.

## 2026-10-16 — BP-C3: stand-off bending (lever arm) uses the highest-shear anchor's own axial force (§4, Tier 2)
- **Engineer decision:** 2026-10-16, "go ahead". Found by comparing with the engineer's PROFIS examples 1, 9 and 10.
- **Function / anchor:** `standoffLeverArm()`, comment `BP-C3 (2026-10-16)`; `levelingNutCheck()`, Step 4 description of N_ua.
- **Before:** N_ua in M_s = M⁰_s(1 − N_ua/φN_sa) was the highest anchor tension in the combination (`combo.Tmax_anchor`), paired with the highest shear.
- **After:** N_ua = |T| of the anchor with the highest shear in that combination, tension or compression. With tied shears, the anchor with the largest |T| is taken, which is conservative. Step 4 names the anchor.
- **Code / method:** ACI 318-19 §17.7.1.2.1 and R17.7.1.2.1 (stand-off shear via bending); the PROFIS lever-arm method, V_s^M = α_M·M_s/L_b.
  - PROFIS report text for the anchor used: example 1, combo 2: N_ua = 0.000 on anchor 2 (shear 4.419 kip), while anchor 3 carried 5.735 kip tension. Example 9: N_ua = −7.000 kip (compression), reduction 0.776.
- **Check case (PROFIS example 1, combo 2):** ¾ in F1554 Gr. 105; M⁰_s = 0.32427 ft-kip = 3.891 kip-in; φN_sa = 31.312 kip; L_b = 1.806 in; α_M = 2.
  - Before (this tool, N_ua = highest tension 5.740 kip): reduction 1 − 5.740/31.312 = 0.817; φV_s^M = 0.65 × 2 × 3.891 × 0.817 / 1.806 = 2.29 kip.
  - After (anchor with the highest shear, N_ua = 0): reduction 1.000; φV_s^M = 0.65 × 2 × 3.891 / 1.806 = 2.80 kip. PROFIS: 2.801 kip.
  - In the headless run, this tool has no torsion input, so all four anchors carry equal shear. The tie rule then picks the largest |T|, and the run gives 2.58 kip for this example (it was 2.45). PROFIS's unique highest-shear anchor comes from its torsion, Mz = 5 ft-kip.
- **Not changed (pending engineer):** the clamped stand-off spalling factor n. PROFIS 3.1.36 (example 10) used n = 0; the built-in PROFIS 3.1.34 cases (CB Plaza Struct 2) match n = 0.5.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs`: the default design is identical. msa3a, struct2v1 and struct2v2 have identical values; the only difference is the two new reporting fields, `govAnchorN` and `govAnchorV`.

## 2026-10-16 — BP-X13: export note wording for standard hex heads (Tier 0)
- **Function / anchor:** `profisBuildPe` anchor block, the `A.head==="heavyhex"` verify note (BP-X10).
- **Before:** "PROFIS lists cast-in bolts as Heavy Hex Head. …"
- **After:** "This design uses a standard Hex head bolt; only the Heavy Hex Head catalog IDs are known, so pick the Hex Head anchor in PROFIS …"
- **Why:** the built-in PROFIS cases (msa3a, struct2) show that PROFIS offers standard hex heads too (A_brg 1.163 in² for 1 in). The old wording was wrong. Wording only; no result changes.

## 2026-10-16 — BP-C1: open stand-off — elastic bolt-group anchor forces; clamped n = 0 (§4, Tier 2)
- **Engineer decision:** 2026-10-16, "Treat 3.1.36 as current, go ahead with item 1". The decision follows PROFIS 3.1.36 (examples 9 and 10) over the built-in PROFIS 3.1.34 cases (CB Plaza Struct 2).
- **Function / anchor:**
  - `computeAll()`: `useNA`, comment `BP-C1 (2026-10-16, engineer-approved)`.
  - `standoffParams()`: case "clamp", comment `BP-C1`.
  - "Anchor Demands" section: new `c.openSO` branch.
  - `VALIDATION_CASES` struct2v1 / struct2v2: new `note`, shown on the PROFIS check tab.
- **Change 1, anchor forces under an open stand-off** (types noclamp and clamp; grouted and flush are unchanged):
  - Before: rigid-plate neutral-axis solve with a concrete bearing block, as for a flush plate.
  - After: elastic bolt group with no bearing block. The rods carry compression:
    T_i = P/n + M_x·y_i/Σy² − M_y·x_i/Σx².
    Tension anchors (T_i > 0) drive the tension checks. The step "Per-anchor force — open stand-off" shows the equation with the values substituted.
- **Change 2, clamped stand-off spalling factor n in L_b = z + n·d₀:**
  - Before: n = 0.5.
  - After: n = 0. A user override (`restraintOverride`) is still respected. Without clamping n stays 0.5, and grouted stays 0.5.
- **Basis:** the PROFIS 3.1.36 reports.
  - Example 9 (without clamping): "Max. concrete compressive strain: –", anchor forces 0.5 / −7.0 / 8.0 / 0.5 kip, n = 0.5.
  - Example 10 (with clamping): the same forces, n = 0.000, L_b = z = 2.806 in.
  - ACI 318-19 §17.7.1.2.1 / R17.7.1.2.1 (stand-off).
- **Check case 1 (example 9, combo 2):**
  - Inputs: P = +2 kip, M_x = M_y = 60 kip-in, anchors at ±4 in, Σx² = Σy² = 64 in².
  - Anchor 3 (−4, +4): T = 2/4 + 60(4)/64 − 60(−4)/64 = 0.5 + 3.75 + 3.75 = 8.00 kip.
  - Anchor 2 (+4, −4): T = 0.5 − 3.75 − 3.75 = −7.00 kip (compression).
  - Before: 2.572 / 0 / 4.619 / 2.036 kip. After: 0.500 / −7.000 / 8.000 / 0.500 kip. PROFIS: 0.500 / −7.000 / 8.000 / 0.500 kip.
  - φN_cbg: before 31.00 kip; after 23.612 kip. PROFIS: 23.612 kip.
- **Check case 2 (example 10, with clamping, combo 2):** ¾ in Gr. 105; M⁰_s = 3.891 kip-in; φN_sa = 31.312 kip; z = 2.181 + 1.25/2 = 2.806 in; α_M = 2.
  - Before: L_b = 2.806 + 0.5 × 0.75 = 3.181 in.
  - After: L_b = 2.806 in.
    - With the highest-shear anchor's |N| = 7.0 kip (PROFIS): reduction 0.776 (BP-C3).
    - φV_s^M = 0.65 × 2 × 3.891 × 0.776 / 2.806 = 1.40 kip. PROFIS: 1.400 kip. Example-run value: 1.401 kip.
- **Effect on saved projects:** no data change.
  - A saved open stand-off now gets higher anchor tensions (conservative) and the rod compression is explicit.
  - A saved clamped stand-off without an override gets L_b reduced by 0.5d₀ (higher bending capacity), as PROFIS 3.1.36 does.
- **Built-in PROFIS 3.1.34 cases:** struct2v2's anchor-force rows (1994 / 1110 / 225 lb) no longer match (now 2333 / 833 / −667 lb). Those cases carry a note explaining the 3.1.34 vs 3.1.36 difference.
  - Unrelated to this change and already present on main: msa3a φN_cbg −42% and φV_cbg +127%, and struct2v1 φN_cbg +17% and φV_cbg +52% against their targets. Reported to the engineer; not changed.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - Examples 1–12 comparison (private scratch script): examples 9 and 10 match PROFIS in anchor forces, steel, pullout, breakout and stand-off bending.
  - `node tests/bpad-profis.mjs`: the default design differs only in the added reporting fields (`openSO`, `Ixx`, `Iyy`, `nAll`).

## 2026-10-16 — G1: graphics review — W column drawn as an I-shape; label clashes; stand-off gap; 3-D (Tier 1, display only)
- **Engineer request:** 2026-10-16, "review all the graphics … particularly when a wf column is used it just shows a square shape".
- **Data (display only):** `LIB.wshapes` entries gain `tf` and `tw` (AISC Manual 16th Ed. values) for the 47 W shapes in the list. No check uses them.
- **New helpers:** `colShape()`, `colPlanDraw()` and `colElevDraw()`, defined just before `colDims()`.
  - W: an I-shape, depth along y, flanges along x, as the tool already models it.
  - Round HSS: a circle.
  - Rectangular HSS / custom: a rectangle.
- **Changes by view:**
  - **Plan (Input & Schematics):** a W column is drawn as an I-shape (was a solid box).
  - **Elevations:**
    - Column: looking along x, the flanges show edge-on as strips at each side; looking along y, the hidden web is shown dashed. HSS gets dashed inner wall lines (indicative).
    - Shear arrow: starts at the column face, so it no longer runs through the column and its name.
    - Moment arc: drawn above the column top, with the same rotational sense, and labelled at its left end. It was drawn down over the plate and grout, with the label on the plate.
    - Plate-width dimension: lifted clear of the moment arc.
    - **Open stand-off:** the gap e_b is now drawn and dimensioned (clickable), with a leveling nut under the plate, plus a nut on top for a clamped stand-off. The plate used to sit on the concrete.
  - **Anchor Bolts key, Tension breakout, Tension rebar plan, Hairpin plan:** a faint column footprint is drawn for orientation.
  - **Shear label:** placed beyond the arrowhead in the Anchor Bolts key (it sat on the arrow), and on the tail side in the hairpin plan (it sat on the hairpin labels).
  - **Hairpin plan legend:** wrapped onto two lines; it ran off both edges.
  - **Tension breakout:** where A_Nc is smaller than the rectangle (BP-C2), the uncovered cells are drawn and labelled "not in A_Nc". `breakoutExtents()` now also returns those cells (`holes`); its A_Nc value is unchanged.
  - **3-D:**
    - W column built as two flanges + web; round HSS as a cylinder.
    - Open stand-off gap included: the plate is raised and the rods lengthened.
    - Labels 2× larger (sprite scale 0.03 → 0.06 of the model size).
    - New projects default to concrete opacity 0.45, so the anchors show. A saved 3-D setting is kept.
- **Provision:** none. No formula, factor, unit or result changed.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs`: computed results and the printed report text are identical to main for the default design and the three built-in PROFIS cases; there are no console errors.
  - Every graphic was screenshotted headless before and after, for: W12X65 (default), W10X33 with plate eccentricity, HSS8X8, a clamped stand-off, both rebar types, and a 3-anchor tension breakout (PROFIS example 1 geometry).

## 2026-10-18 — D11: calculation-sheet report in the Gusset Plate Rating / ST-Girder format (Tier 1, display only)
- **Engineer request:** 2026-10-18 (AUDIT.md D11, parked 2026-10-14).
- **Functions / anchors:**
  - `buildPrintReport()` is rewritten, preceded by the new `BPAD_REFS`, `bpadPageCSS()`, `bpadApplyPageCSS()`, `bpadResultRows()` and `bpadResultBlock()` (anchor `/* D11 (2026-10-18)`).
  - `buildOutputInto()` gains cases `tabVCase`, `tabValidation`, `tabManual`.
  - `openPrintSettings()`: the appendix check boxes and the size estimate.
  - Print triggers: `beforeprint` / `afterprint` and the Generate PDF button.
  - CSS anchor `/* D11 calculation-sheet report`.
- **Before:**
  - Title, sub-title and title block, then "n. Tab" headings with the tab content and the disclaimer.
  - Shear Distribution, Validation and User Manual printed as empty headings: there was no builder case for them.
  - The combination picker in every per-combination section showed the FIRST combination, because `cloneNode` drops a `<select>`'s live selection. The worked values were those of the correct combination.
- **After:**
  - **Cover:** title, project, codes and the title block (Project / No. / Calculated by / Date / Checked by / Checked date).
  - **References:** ACI 318-19 Ch. 17, §22.8, Ch. 25; AISC Design Guide 1, 2nd Ed.; AISC 360 §J3.10 / §E3 (edition: verify); ASCE 7-22 §2.3; the PROFIS lever-arm method.
  - **Numbered table of contents** with links.
  - **Numbered sections n and subsections n.k:** each tab card, with its own "k." number replaced.
  - **Results block** at the end of each section: one line per check, "<check>: D/C = x.xx (<ref>[; governing combination]) PASS / FAIL / N/A".
    - Per combination for Base Plate (plate bending, tearout), Anchor Bolts (steel tension, pullout, steel shear, stand-off bending, interaction) and Concrete Embedment (breakout T/V, side-face blowout, pryout).
    - The envelope for the tension and shear rebar sections.
  - The identical-combination cross-reference links to "§n".
  - Print uses `@page` margin boxes:
    - top: "Project No / Description", "Computed By / Checked By", "Date / Date";
    - bottom: "<project> (Base Plate & Anchor Bolt Design)" and "Page X of Y".
  - Shear Distribution is now printed.
  - Validation and User Manual are opt-in appendices, unticked by default in Report Contents.
  - The selected combination and check-box states are carried into the print copy.
  - Expand/collapse carets are hidden in print.
  - Base Plate tab, "Eq. 3.3.15" note: the raw TeX `t=\sqrt{4f_pY(\ell-Y/2)/(\phi F_y)}` became "t = √(4f_p·Y·(ℓ − Y/2)/(φF_y))". Wording only.
- **Provision:** none. No formula, factor, unit or result changed. The D/C values in the result lines are the existing `dcrMatrix()`, `plateBending()`, `plateTearout()` and `allChecks()` values.
- **Saved data:** `S.print.sections.tabValidation` / `tabManual` are now read as "print only if true". A project saved with them unticked is unaffected; one saved with them included (the old default, which printed empty headings) now omits them until ticked. No key or format change.
- **Check case (default design, all combinations):**
  - 12 sections: Input (5 subsections), Summary (5), Base Plate × 3 combinations (3 each), Anchor Bolts × 3 (9 each), Concrete Embedment × 3 (7 each), Shear Distribution (4).
  - 27 result lines; 67 letter pages.
  - Combination 1.2D+1.6L, Anchor Bolts: steel tension 0.00, pullout 0.00, steel shear 0.36, interaction 0.56, all PASS. These equal the "All combinations × limit states" matrix row.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs`: every computed field is identical to main for the default design and the 3 built-in PROFIS cases. Only `report` (the printed text) differs, as intended, so its results-identity step reports DIFFERENT for this PR only.
  - Headless Chromium PDF (print media, `preferCSSPageSize`, KaTeX 0.16.11 served locally): pages checked for the cover, references and TOC, a Base Plate section with its result block, Anchor Bolts, Concrete Embedment and the header/footer boxes. No console errors.
