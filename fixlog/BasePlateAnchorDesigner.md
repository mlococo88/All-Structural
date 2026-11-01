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

## 2026-10-18 — D11 links: quoted values link to the card where they are worked (CLAUDE.md §6) (Tier 1, display only)
- **Engineer request:** 2026-10-18, the embedded links of the CLAUDE.md §6 guideline (2026-10-14).
- **New helpers** (after `mkSection`, anchor `/* ---- D11 links`): `BPAD_TABNAME`, `BPAD_CARDS`, `bpadCardFor`, `bpadComboIndex`, `bpadLink`, `bpadWorkedIn`, `bpadGoto`, and a click handler on `a.wkA`. CSS `.wkLink`, `a.wkA`, `.sec.wkFlash`.
- **Links added:**
  1. **Summary, Governing Demand–Capacity table:** a new "Worked in" column, linking each check to its card at the governing combination.
  2. **Summary chips:** clicking now opens the worked card at the governing combination (was: the tab only).
  3. **Anchor Bolts, Governing Tension / Shear Capacity (envelope):** a "Worked in" column per mode.
  4. **Anchor Bolts, Tension / Shear Load results summaries:** a "Worked in" line under each.
  5. **Anchor Bolts, Combined interaction:** φN_n and φV_n link to the governing tension and shear modes.
- **Clicking a link** switches the tab and the detailed combination to the one the value belongs to, expands the card, scrolls to it and highlights it. Inputs, results and saved data are unchanged, apart from `S.ui.tab`, `S.detailCombo` and the card's collapse state, which tab clicks already set.
- **Calculation report:** `buildPrintReport` records each card's report number per tab and combination (`cardMap`) and rewrites every link to "see §n.k".
  - The target is the same combination's section, or the governing combination's for the Summary.
  - A cross-referenced identical combination maps to the section that holds the derivation.
  - A card in a section not printed reads "see the <tab> tab (…; not in this printout)".
- **Provision:** none. No result changed.
- **Check case (default design):**
  - Summary: Concrete Breakout (V), governed by 1.2D+1.0W, shows "see §10.5" in the report = Concrete Embedment — 1.2D+1.0W, 5. Concrete Breakout — Shear. In the app, the link opens Concrete Embedment at 1.2D+1.0W and highlights `coVB`.
  - Anchor Bolts 1.2D+1.6L interaction: "φN_n: see §6.5 · φV_n: see §9.5".
  - Link counts: 10 on Summary, 14 on Anchor Bolts.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs`: every computed field is identical to main. Its `report` field reads only the front matter: the body sections are hidden off-screen, so `innerText` skips them. The "see §" lines were therefore checked in the generated PDF (pdftotext) instead.
  - Headless click test: the tab, combination and highlighted card are as stated above, with no console errors.

## 2026-10-21 — BP-T1: anchor installation input (untorqued / torqued); ACI 318-19 §17.9 torqued limits as PASS/FAIL checks; PROFIS AnchorTorqueType (§4, Tier 2)
- **Engineer request:** 2026-10-21, "add a torqued vs untorqued anchor input, as in Hilti PROFIS, where torqued adds the minimum edge distance requirement".
- **Governing provision:** ACI 318-19 §17.9.2, Table 17.9.2a (cast-in anchors):
  - minimum spacing: 4d_a not torqued, 6d_a torqued;
  - minimum edge distance: specified cover per §20.5.1.3 not torqued, 6d_a torqued.
  - §17.9.3 (smaller d_a′ for untorqued anchors that do not produce splitting forces): not used; spacing below 4d_a still withholds the output.
  - §17.9.4 (h_ef ≤ greater of 2/3 h_a and h_a − 4 in.): applies to post-installed expansion and undercut anchors only. There is no h_ef / thickness limit for torqued cast-in anchors, so none is added.
  - Post-installed anchors (Table 17.9.2a third column, Table 17.9.2b product c_min / s_min) are out of scope: the tool designs cast-in headed anchors only (User Manual, Scope).
  - Citation corrected: the old untorqued warning cited "§17.9.3 requires ≥ 6·dₐ if torqued". In ACI 318-19 the 6d_a torqued edge distance is Table 17.9.2a under §17.9.2; §17.9.3 is the d_a′ provision.
- **Saved data (CLAUDE.md §5):** one new optional field `S.anchor.torqued` (boolean, default `false`). No key or format changed.
  - A save without the field reads as untorqued. `mergeState()` leaves it `undefined` (falsy), and every use is `!!A.torqued` or `A.torqued ? … : …`.
  - Tested: an old save gives undefined, shown as Untorqued; a JSON round trip of a torqued state gives `true`.
- **Input** (`buildInputPanel`, section "2. Anchors", anchor text `BP-T1 (2026-10-21): torqued / untorqued`): a new select, "Anchor installation", with options Untorqued / Torqued, placed after "Head / bearing type", plus a note that states the limits.
- **New function `installLimits()`** (before `/* ---------------- VALIDATION`):
  - s_min = least centre-to-centre distance between any two anchors;
  - c_a,min = least of the four edge distances c_a,+x, c_a,−x, c_a,+y, c_a,−y from `anchorGeom()`;
  - s_req = 4d_a (untorqued) or 6d_a (torqued); c_req = 6d_a (torqued only);
  - DCR_s = s_req / s_min; DCR_c = c_req / c_a,min.
- **New function `installRows()`** (before `allChecks()`): torqued only, two Summary rows, "Anchor Spacing ≥ 6dₐ (torqued)" and "Edge Distance ≥ 6dₐ (torqued)", ref "Table 17.9.2a", combination "—", tab Anchor Bolts. PASS if DCR ≤ 1.0001 (`statusOf`). They are added in `allChecks()` after the anchor modes, and in `bpadResultRows()` for the Anchor Bolts sections of the report ("Results — Anchor Bolts").
- **New card** "Installation Limits — Spacing & Edge Distance" (`anInstall`): the last card of the Anchor Bolts tab (`buildAnchorTab`). It works s_min, s_req, c_a,min, c_req and the ratios (symbolic → values → result), shows a DCR box for each torqued check, and notes §17.9.3 and §17.9.4. `BPAD_CARDS.anInstall` was added, and `bpadCardFor` maps labels containing "(torqued)" to it, so the Summary chips and the "Worked in" column link to it; in the report the link reads "see §n.k".
- **`validateInputs()`**, the §17.9 block. Before:
  ```js
  { const sMin=Math.min(g.sx||1e9, g.sy||1e9);
    if(isFinite(sMin) && sMin < 4*A.dia)
      errs.push({block:true, code:"§17.9.2", msg:"Anchor spacing … below the §17.9.2 minimum of 4·dₐ … for untorqued cast-in anchors (6·dₐ if torqued)."});
    else if(isFinite(sMin) && sMin < 6*A.dia)
      warns.push("Anchor spacing … below 6·dₐ … — §17.9.2 requires 6·dₐ if the anchors will be torqued.");
    const caMin=Math.min(g.ca_x_pos,g.ca_x_neg,g.ca_y_pos,g.ca_y_neg);
    if(caMin < 6*A.dia)
      warns.push("Minimum edge distance … — acceptable untorqued if cover per §20.5.1.3 is met, but §17.9.3 requires ≥6·dₐ if the anchors will be torqued.");
  ```
  After:
  ```js
  { const IL=installLimits(), sMin=IL.sMin, caMin=IL.caMin;
    if(sMin!=null && sMin < 4*A.dia)
      errs.push({block:true, code:"§17.9.2", msg:"Anchor spacing … below the ACI 318-19 Table 17.9.2a minimum of 4·dₐ … for cast-in anchors (…)."});
    else if(!IL.tq && sMin!=null && sMin < 6*A.dia)
      warns.push("Anchor spacing … below 6·dₐ … The anchors are set as untorqued; if they will be torqued, set Anchor installation = Torqued (Table 17.9.2a, §17.9.2, requires 6·dₐ).");
    if(!IL.tq && caMin < 6*A.dia)
      warns.push("Minimum edge distance … Acceptable for the untorqued anchors set here if the cover of §20.5.1.3 is met; if they will be torqued, set Anchor installation = Torqued (Table 17.9.2a, §17.9.2, requires ≥ 6·dₐ).");
  ```
  - Torqued: the two 6d_a warnings are replaced by the FAIL/PASS rows. Untorqued: they stay as warnings, reworded, so a design that will in fact be torqued is not missed.
  - **Spacing measure changed** [check change] [MORE conservative]: s_min was the extent of the group along x or y (`g.sx`, `g.sy` = x_max − x_min), which is the spacing only for 2 anchors per row. It is now the least centre-to-centre distance (adjacent anchors), as §17.9.2 means. Grids of 2 × n are unchanged.
- **PROFIS export** (`profisBuildPe`, after the anchor layout, anchor text `BP-T1 (2026-10-21): AnchorTorqueType`):
  - `<AnchorTorqueType>` = "Torqued" or "Untorqued" from the input (was always "Torqued" from the template).
  - The enum values are those in the engineer's re-saved files `Drafts_Untitled (1).pe` (Torqued) and `(2).pe` (Untorqued); `IsReducedInstallTorque` stays `false` in both.
  - A new dialog row, "Anchor installation".
  - A default design now exports "Untorqued".
- **PROFIS import (PDF):** the PDF reports do not print the torque type. All 13 reports in `hilti_profis_references` show only "Maximum installation torque: -". So it cannot be read: the "Not found (your current values will be kept)" list now always names it, and the input is left as it is.
  - The tool has no .pe import, so the export cannot be read back.
- **Other text:**
  - Input & Schematics echo, "Anchors" row: now ends with ", untorqued" or ", torqued".
  - User Manual, "Installation limits (§17.9)" paragraph: describes the input and the checks.
- **Built-in PROFIS cases (msa3a, struct2v1, struct2v2):** left untorqued (default). Their PROFIS source reports are not in the repository and the PDF reports do not state the torque type. Results are identical either way. Torqued, they would show:
  - msa3a: spacing 6/14 = 0.43; edge 6/6 = 1.00 (c_a,+y = 6 in);
  - struct2v1 and v2: spacing 4.5/5 = 0.90; edge 4.5/4.5 = 1.00.
  - Both sit exactly at 6d_a, which is consistent with PROFIS's own torqued default (every PROFIS file on hand is Torqued). That is not proof, so they were not changed.
- **Check case 1, torqued edge distance (FAIL):** the default design (1 in anchors, 2 × 2 at ±6 in, 18 × 18 in plate) with pedestal Bx = 22 in and Torqued.
  - c_a,+x = c_a,−x = 22/2 − 6 = 5.000 in; c_a,±y = 30/2 − 6 = 9.000 in; c_a,min = 5.000 in.
  - c_req = 6 × 1.000 = 6.000 in; DCR = 6.000 / 5.000 = 1.20, FAIL.
  - Spacing: s_min = 12.000 in, s_req = 6.000 in, DCR = 0.50, PASS.
  - Before: no check; only the warning "Minimum edge distance 5.00″ is below 6·dₐ …".
  - Untorqued, the same design gives no rows and the reworded warning.
- **Check case 2, torqued spacing (FAIL):** the default design with plate B = 14 in, 3 × 2 anchors, Torqued.
  - Anchor x = −4, 0, +4 in; s_min = 4.000 in.
  - s_req = 6.000 in; DCR = 1.50, FAIL. Edge: 6.000 / 9.000 = 0.67, PASS.
- **Check case 3, spacing measure (untorqued):** the default design with plate B = 12 in, 3 × 2 anchors.
  - Anchor x = −3, 0, +3 in.
  - Before: s = extent = 6.00 in ≥ 6d_a, no message; output shown.
  - After: s_min = 3.00 in < 4d_a = 4.00 in → blocking error "Anchor spacing 3.00″ is below the ACI 318-19 Table 17.9.2a minimum of 4·dₐ = 4.00″ …"; output withheld.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs`: on the default design and msa3a, struct2v1 and struct2v2, `computeAll()`, the governing combination, every capacity and the validation messages are identical to main. Only the report text differs (the new card).
  - Its reproduction of `profis-example.pe` lists one new difference, `AnchorTorqueType` (example Torqued, export Untorqued), because the reproduction uses the default (untorqued) input. With Torqued set, the field matches.
  - Scratch headless script, not committed:
    - the Summary rows of all four cases on main equal the branch's untorqued rows;
    - capacities and `computeAll()` are identical untorqued vs torqued for all four;
    - check cases 1–3 as above;
    - export writes Untorqued / Torqued, and the "Anchor installation" row is correct;
    - reading `AnchorTorqueType` back from the exported XML gives the input value.
  - Screenshots looked at: input row, Summary chips and table, and the Installation Limits card. No console errors.
- **Open items:**
  - **.pe import:** importing a PROFIS .pe file (which would carry AnchorTorqueType) does not exist; the import reads PDF reports only. Needs an engineer decision if wanted.
  - **§17.9.3:** for untorqued anchors that do not produce splitting forces, spacing or edge distance below Table 17.9.2a may be handled with a smaller d_a′. The tool blocks below 4d_a instead.
  - **`mergeState()`:** it does not deep-merge default sub-fields. `Object.assign(d, st)` replaces `d.anchor` before the merge loop, so a new field missing from an old save stays `undefined` rather than taking the default. This is harmless here (undefined = untorqued) but affects any future field whose default is not falsy. Not changed.

## 2026-10-21 — BP-M1: `mergeState()` fills missing default sub-fields into old saves; PROFIS test updated for BP-T1 (Tier 1, no result change)
- **Engineer decisions (2026-10-21, after BP-T1, PR #403):**
  - No .pe import for now.
  - §17.9.3 (smaller d_a′ for untorqued anchors that do not produce splitting forces) is **not applied**. Spacing below 4d_a keeps withholding the output. The Installation Limits card already says so ("Not applied: §17.9.3 …").
- **Function / anchor:** `mergeState()`, comment `BP-M1 (2026-10-21)`.
- **Before:**
  ```js
  const d=defaultState();
  const out=Object.assign(d,st||{});
  ```
- **After:**
  ```js
  const d=defaultState();
  const out=Object.assign(defaultState(),st||{});
  ```
- **Problem:**
  - `out` and `d` were the same object. `Object.assign(d, st)` replaced `d.anchor`, `d.conc`, … with the saved groups before the merge loop `out[k]=Object.assign({}, d[k], st[k])` ran. So a sub-field missing from an old save stayed `undefined` instead of taking its default (e.g. `anchor.torqued` of BP-T1).
  - The same aliasing made `out.print.sections=Object.assign(d.print.sections, …)` write into the saved `print.sections`. A save with `print` but without `print.sections` threw "Cannot convert undefined or null to object" on load.
  - With `d` untouched, every object group is the defaults overlaid by the saved values, one level deep, as the loop always intended.
  - The BP-D1 head migration still runs after the merge, so a save without `anchor.head` keeps `"heavyhex"`.
- **Provision:** none. Results are unchanged for any save that has its fields (see below).
- **Check case:**
  - An old save without `anchor.torqued`: `mergeState(old).anchor.torqued` was undefined; it is now `false`. Both mean untorqued.
  - A save without `print.sections`: the load threw before; it now loads with the default print sections.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs` (origin/main 47f0405 vs working tree): every section is identical for default, msa3a, struct2v1, struct2v2 and the new torqued case. PASS.
  - Scratch headless script, origin/main vs the branch. Every saved state below was run complete, then again with each default sub-field deleted in turn (793 states):
    - the default design; msa3a, struct2v1 and struct2v2;
    - a grouted stand-off with tension and shear rebar, torqued;
    - a stand-off without clamping, lb units, elastic force model.
  - Compared: `computeAll()`, every combination's capacities, `allChecks()`, the validation messages and the governing combination.
  - Results:
    - All 6 complete states are identical.
    - A deleted field differs only for core inputs (plate B/N/t, column shape, anchor d/h_ef/n/edges, grout, stand-off z, f′c, pedestal size, cracked, rebar sizes and spacing). There main gets undefined (NaN or a blocking error) and the branch the default.
    - `print.sections` also differs: main throws.
    - Every one of those fields is in the first version of the tool in this repository (c58cb6d), so no real save lacks them.
    - Only two default fields were added after c58cb6d, `plate.holeDia` and `anchor.torqued`. For both, undefined and the default give identical results.
  - `mergeState()` does not change its argument (checked on both versions).
- **tests/bpad-profis.mjs** (developer tooling only):
  - Results identity:
    - The readout now also compares `allChecks()`.
    - New case `torqued`: the default design, torqued, with pedestal Bx = 22 in. On B it asserts Edge Distance DCR 1.20 and Anchor Spacing DCR 0.50.
    - The report text drops the TOC line "n.k. Installation Limits — Spacing & Edge Distance" before comparing, so a ref older than BP-T1 can still be compared. All other lines are compared as before.
  - Reproduction of `profis-example.pe`: the input is set to torqued, as in the example (`AnchorTorqueType` Torqued). The field now matches, leaving 7 known differences.
  - Unknown-items export: checks that the default (untorqued) design writes `AnchorTorqueType` Untorqued.
  - Still catches regressions. With `--a 23778ea` (before BP-T1), the four original cases are `same`, but the `torqued` case is DIFFERENT and the exit code is 1:
    - checks go from 10 to 12 rows;
    - one warning becomes a FAIL row.

## 2026-10-21 — BP-H1: "Anchor shear share" option, Hilti PROFIS equal share V/n (Tier 2, opt-in; default results unchanged)
- **Engineer decision (2026-10-21):** the app should make the same assumptions as Hilti PROFIS where it can. Add the PROFIS shear share as an option, and keep the current behavior as the default so the validated results do not change.
- **Function / anchor:**
  - `defaultState()`, `shear:` group, comment `BP-H1 (2026-10-21)`. New field `shear.hiltiDist:false`. Old saves get `false` through `mergeState()` (BP-M1).
  - `computeAll()`, per-combination shear demand, anchor text `const hiltiDist=!!(S.shear&&S.shear.hiltiDist);`.
  - Input tab, "6. Shear Distribution": new row "Anchor shear share".
  - `buildVCaseTab()`, "1. Basis and Case Selection": a note states which share is used.
- **Before:**
  ```js
  const Vu_per=Vfront;
  …
  p.inFront = frontSet? !!frontSet[i] : true;
  ```
- **After:**
  ```js
  const hiltiDist=!!(S.shear&&S.shear.hiltiDist);
  const Vu_per=hiltiDist? Vres/nTot : Vfront;
  if(hiltiDist && Vres>1e-9) frontDesc="all "+nTot+" anchors, V/n (Hilti PROFIS option; concrete breakout: "+frontDesc+")";
  …
  p.inFront = (frontSet && !hiltiDist)? !!frontSet[i] : true;
  ```
- **What changes when the option is on:**
  - The per-anchor shear demand `Vu_per` changes. It is used by steel shear (§17.7.1) and by the stand-off lever-arm check, and through them by the T–V interaction (§17.8).
  - Before (and the default): the share of the governing ACI 318-19 Fig. R17.7.2.1b case. Case 1 gives V/n; Case 2 gives V / (anchors in the rear row); Case 3 gives V / (anchors in the front row).
  - After: V/n on every anchor. This is a rigid plate sharing the shear equally, which is how PROFIS assigns shear for these checks.
  - Concrete breakout and pryout are unchanged: the case still sets `nV`, the breakout row and the group demand.
- **Why:** comparing with PROFIS, the anchor shear did not match. On a 2 × 2 group where Case 2 governs, the tool checked each anchor's steel shear at V/2, where PROFIS uses V/4 (for anchors in standard holes the PROFIS template also has `HoleCondition One`).
  - Option on is less conservative than the default whenever Case 2 or 3 governs.
  - The default follows R17.7.2.1(b), which assigns the full shear to one row.
- **Governing provision:** ACI 318-19 §17.7.1 (steel strength in shear), §17.7.2.1 / Fig. R17.7.2.1b (shear assumed on a row for breakout), §17.8 (interaction). PROFIS assumes a rigid anchor plate.
- **Check case 1, default design** (1 in F1554-36, 2 × 2 at ±6 in, flush on a 1 in grout pad, default combinations):
  - Governing: 1.2D+1.0W, V = 16.155 kip, Case 2 (2 anchors in the row set back 12.00 in from the +x edge).
  - φV_sa per anchor = 0.65 × 0.6 × 0.606 × 58 × 0.80 = 10.966 kip.
  - Before / default: V_u,a = 16.155 / 2 = 8.078 kip; steel shear DCR = 8.078 / 10.966 = **0.737**.
  - Option on: V_u,a = 16.155 / 4 = 4.039 kip; DCR = 4.039 / 10.966 = **0.368**.
  - Breakout 1.126, pryout 0.186 and the interaction 1.328 (governed by 0.9D+1.0W) are the same both ways.
- **Check case 2, msa3a (grouted stand-off, PROFIS 3.1.34):** V = 2.828 kip, Case 2.
  - Default: V_u,a = 1.414 kip; steel 0.129; stand-off bending 1.414 / 1.860 = 0.761.
  - Option on: V_u,a = 0.707 kip; steel 0.064; stand-off bending 0.707 / 1.860 = **0.380**. The interaction follows: 0.761 → 0.380.
- **Check case 3, struct2v1:** V = 1.015 kip, 6 anchors, Case 2 (3 in the rear row).
  - V_u,a goes 0.338 → 0.169 kip. Stand-off bending goes 0.350 → 0.175, and the interaction 0.669 → 0.453.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs` (origin/main 061e92a vs working tree): default, msa3a, struct2v1, struct2v2 and torqued are all `same`. PASS.
  - Scratch headless script, not committed: check cases 1–3 above with the option off and on; no console errors.
- **Other copies:** the Canopy MCT Generator (mlococo88/canopy-mct-generator) embeds this file through its `tools/sync-bpad.py`. It is re-synced there.
- **Open items:**
  - PROFIS's exact shear rule (hole condition, `ShearLoadDistributionType UpToFirstThreeRows`) is not documented in the repository, and the Hilti design guide was not reachable. The option implements an equal V/n share on every anchor. Confirm it against a PROFIS anchor-force table for a design where Case 2 governs.
  - The PROFIS export still writes the template `HoleCondition One` / `UpToFirstThreeRows`, whatever this option is.

## 2026-10-21 — BP-E1: §17.6.2.1.2 reduced h_ef — s is the spacing across the member between opposite near edges, as Hilti PROFIS (Tier 2, calc change, MORE conservative where it changes)
- **Engineer report (2026-10-21):** the tension-breakout h_ef did not match PROFIS. Reference files in `mlococo88/Hilti_Profis_References`:
  - `Drafts_Wyoming Hill Stairs 3D - Top (h_eff check).pdf` (PROFIS 3.1.36);
  - `Canopy · MIDAS MCT Generator (h_eff check).pdf` (this tool, embedded in the canopy app).
- **Function / anchor:** `hefEffective()`, comment `BP-E1 (2026-10-21)`. The derivation row "s" in `tensionBreakoutGroup()` steps (anchor text `"anchor spacing "+he.sBasis`).
- **Before:**
  ```js
  const s=Math.max(g.sx||0, g.sy||0);
  ```
- **After:**
  ```js
  const lim=1.5*hef, pairX=(g.ca_x_pos<lim && g.ca_x_neg<lim), pairY=(g.ca_y_pos<lim && g.ca_y_neg<lim);
  const s=(pairX||pairY)? Math.max(pairX?(g.sx||0):0, pairY?(g.sy||0):0) : Math.max(g.sx||0, g.sy||0);
  ```
- **Problem:**
  - h_ef′ = max(c_a,max/1.5, s/3). The tool took s as the larger group dimension in either direction.
  - With anchors near three edges, PROFIS takes s across the member, between the two opposite edges that are both within 1.5h_ef. The spacing toward the single near edge is not used.
  - With no opposite pair (a corner, reached only through `hefReduce` = forced), s is unchanged.
- **Governing provision:** ACI 318-19 §17.6.2.1.2 (h_ef′ = max(c_a,max/1.5, s/3), s = maximum spacing between anchors within the group). The reading is PROFIS's, as derived from the reference files (see the evidence below).
- **Check case (the reference design):**
  - Inputs:
    - ½ in F1554-55 heavy hex, h_ef = 10 in, 2 × 2 anchors at x = ±2.25, y = ±4 in, 10 × 12 × 0.5 in plate;
    - grouted stand-off e_b = 0.5 in, f′c = 5 ksi, cracked, h = 16 in;
    - edges c_−x = c_+x = 3.75, c_−y = 2.0, c_+y = 20 in (pedestal 12 × 30 in, plate offset y = −9 in);
    - combination 75 F2-C1 · STR5 A-0: N = −0.793 kip, Mx = 4.828, My = −0.482 kip-ft.
  - 1.5h_ef = 15 in. Near edges: −x, +x, −y (3). Opposite pair: x only. c_a,max = 3.75 in.
  - Before: s = max(4.5, 8.0) = 8.0 in. h_ef′ = max(3.75/1.5, 8/3) = max(2.50, 2.67) = **2.667 in**. Then A_Nco = 64.0, A_Nc = 142.50, N_b = 7.390, ψ_ec,N = 0.860 × 0.615, ψ_ed,N = 0.850, N_cbg = 7.392, φN_cbg = 5.17 kip. DCR = 5.841 / 5.17 = **1.13**.
  - After: s = 4.5 in (across the ±x edges). h_ef′ = max(2.50, 1.50) = **2.500 in**. Then A_Nco = 9 × 2.5² = 56.25, A_Nc = 133.13, N_b = 24√5000 × 2.5^1.5 = 6.708, ψ_ec,N = 0.852 × 0.599, ψ_ed,N = 0.860, N_cbg = 6.970, φN_cbg = 4.879 kip. DCR = 5.841 / 4.879 = **1.197**.
  - PROFIS: h_ef = 2.500, A_Nc = 133.12, A_Nco = 56.25, ψ_ec1 0.852, ψ_ec2 0.599, ψ_ed 0.860, N_b 6.708, N_cbg 6.974, φN_cbg 4.881, **120 %**. The anchor tensions agree too: 0 / 0.115 / 2.792 / 2.934 vs PROFIS 0 / 0.117 / 2.791 / 2.933; N_ua = 5.841.
  - Pryout: A_Nc (all) 168 → 159.00 and V_cpg 32.98 → 32.614 kip. PROFIS: 159.00, 32.614.
- **Evidence for the rule:**
  - The reference design: PROFIS 2.500 = c_a,max/1.5, so PROFIS did not use the 8 in spacing toward the single −y edge.
  - struct2v1 (all four edges near): PROFIS 3.333 = s/3 with s = 10. Unchanged.
  - msa3a (corner): 4.667. Unchanged.
  - The 12 reference reports 1–12 (square 2 × 2 groups, equal edges): 6.667 and 6.000. Unchanged.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs`: every computed number for default, msa3a, struct2v1, struct2v2 and torqued is identical to main. The test reports DIFFERENT (exit 1) only because the derivation text changed: the new `hefEff.sBasis` field and the "s" row wording. Expected.
  - Scratch headless script, not committed: the check case above, main vs branch, reproduces the canopy app's report (φN_cbg 5.17, DCR 1.13) on main and PROFIS on the branch.
- **Other copies:** the Canopy MCT Generator embeds this file through `tools/sync-bpad.py`. It is re-synced there.
- **Open items:**
  - **Three or more anchors in a row:** s along a row is the outer-to-outer extent, as before, not the spacing between neighbouring anchors. No PROFIS file on hand separates the two readings.
  - **Clipping vs `ca_override`:** `breakoutExtents()` clips A_Nc by the pedestal size and plate offset, not by `conc.ca_override` edge distances. A design that overrides the edges without a matching pedestal gets an A_Nc inconsistent with its c_a values. Not changed; raise with the engineer.

## 2026-10-21 — BP-E2: A_Nc clipped by the overridden edge distances (Tier 2, calc change; only designs using "c_a override")
- **Engineer instruction (2026-10-21):** issues found while matching PROFIS are to be fixed in this tool too. Raised as an open item in BP-E1.
- **Function / anchor:** `breakoutExtents()`, comment `BP-E2, 2026-10-21`. It is used by tension breakout, pryout and the breakout drawing.
- **Before:**
  ```js
  const x1=Math.max(ux1, -C.Bx/2 - pxo), x2=Math.min(ux2, C.Bx/2 - pxo);
  const y1=Math.max(uy1, -C.By/2 - pyo), y2=Math.min(uy2, C.By/2 - pyo);
  ```
- **After:**
  ```js
  let ex1=-C.Bx/2 - pxo, ex2=C.Bx/2 - pxo, ey1=-C.By/2 - pyo, ey2=C.By/2 - pyo;
  if(C.ca_override){ const G=anchorGeom();
    ex1=G.xmin-G.ca_x_neg; ex2=G.xmax+G.ca_x_pos; ey1=G.ymin-G.ca_y_neg; ey2=G.ymax+G.ca_y_pos; }
  const x1=Math.max(ux1, ex1), x2=Math.min(ux2, ex2);
  const y1=Math.max(uy1, ey1), y2=Math.min(uy2, ey2);
  ```
- **Problem:**
  - With "c_a override" on, ψ_ed,N, c_a,min, the §17.6.2.1.2 edge count and the shear checks used the four entered edge distances. The breakout area A_Nc (and pryout) was still clipped by the pedestal size and plate offset.
  - A design whose pedestal did not match the entered edges got an A_Nc inconsistent with its own c_a values. It could be too large (unconservative) or too small.
  - The edges are now measured from the outer anchors, as the override defines them. Without the override, nothing changes.
- **Governing provision:** ACI 318-19 §17.6.2.1 and Fig. R17.6.2.1(b): A_Nc is limited by the member edges.
- **Check case 1 (the BP-E1 reference design, entered with the override):**
  - Inputs: edges 3.75 / 3.75 / 20 / 2.0 in, pedestal left at 30 × 40 in.
  - Before: A_Nc = 146.25, N_cbg = 7.657 kip, DCR 1.09; pryout A_Nc 180, V_cpg 36.92 kip.
  - After: A_Nc = 133.13, N_cbg = 6.970 kip, DCR 1.197; pryout A_Nc 159, V_cpg 32.614 kip.
  - PROFIS: 133.12 / 6.974 / 120 % / 159.00 / 32.614.
  - The same design with a matching 12 × 30 in pedestal and no override gives 133.13 both before and after.
- **Check case 2 (built-in validation msa3a, override 7 / 21 / 6 / 20, pedestal 28 × 26 offset 7, 7):**
  - A_Nc 420 → 756 = 28 × 27. φN_cbg 21.97 → 39.55 kip; PROFIS 38.08.
  - Pryout φV_cpg 43.94 → 79.09 kip; PROFIS 76.16.
  - The error goes from −42 % to +3.9 %.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs`: default, struct2v1, struct2v2 and torqued are `same`. msa3a is DIFFERENT only in A_Nc and the values derived from it (tension breakout, pryout, their DCRs and derivation text), as in check case 2.
- **Open item:** msa3a is still +3.9 % from PROFIS. 38.08 kip corresponds to A_Nc = 728 = 28 × 26, i.e. one edge 1 in closer in y than entered. That case's source report is not in the repository, so the entered edges cannot be checked.

## 2026-10-23 — TR-H1: tension anchor reinforcement uses the actual h_ef; the §17.6.2.1.2 reduced h_ef′ stays in the breakout equations only (Tier 2, calc change, LESS conservative where it changes)
- **Engineer decision (2026-10-23):** the reduced h_ef′ of §17.6.2.1.2 applies only to the breakout equations, not to the anchor-reinforcement check.
- **Function:** `tensionRebarIntercept(cc)`. Anchor text: `const hef=he.hefEff, coneZ=C.H-hef, rMax=1.5*hef;`
- **Before:**
  ```js
  const hef=he.hefEff, coneZ=C.H-hef, rMax=1.5*hef;
  ```
- **After:**
  ```js
  const hef=he.hef, coneZ=C.H-hef, rMax=1.5*hef;
  ```
  The return object also gets `hefBreakout:he.hefEff`, so the reduced value can still be stated.
- **What changes:**
  - Cone apex: was at the reduced depth H − h_ef′, now at the anchor head H − h_ef. The bar crossing is z_cross = coneZ + r/1.5.
  - Breakout prism radius: 1.5·h_ef instead of 1.5·h_ef′.
  - Effective-placement zone: 0.5·h_ef instead of 0.5·h_ef′.
  - Display changes:
    - the Tension Rebar notes and the User Manual state the actual h_ef, and state h_ef′ as breakout-only;
    - the elevation's separate "h_ef,eff / cone apex" tier is replaced by a one-line note;
    - the plan legend, the 3-D cone and the comments are updated.
  - Not changed: `hefEffective()` and every breakout, pryout and side-face calculation still use h_ef′.
- **Governing provision:**
  - ACI 318-19 §17.6.2.1.2 limits h_ef in the breakout equations (Eqs. 17.6.2.1.1 through 17.6.2.5.1).
  - §17.5.2.1(a) and R17.5.2.1 (Fig. R17.5.2.1a) govern anchor reinforcement. It is placed within 0.5·h_ef of the anchor and developed on both sides of the breakout surface, which starts at the anchor head.
- **Check case:**
  - Default project with h_ef = 18 in, H = 58 in, pedestal 24 × 24 in. The anchors are 2 × 2 at ±6 in, so c_a = 6 in on all 4 edges.
  - Tension rebar on: #5 U-stirrups, 4 pieces per row, top cover 2 in, 30 in below the head.
  - h_ef′ = max(c_a,max/1.5, s/3) = max(6/1.5, 12/3) = 4.0 in. It is unchanged and still used in the breakout check.
  - Before (h_ef′ = 4):
    - coneZ = 58 − 4 = 54 in; zone 0.5·4 = 2.0 in.
    - The nearest legs are at r = √(3² + 2²) = 3.61 in > 2.0 in, so none is credited: 0 of 16 legs, φN_r = 0.
  - After (h_ef = 18):
    - coneZ = 58 − 18 = 40 in; zone 0.5·18 = 9.0 in.
    - The legs at r = 3.61 in cross at z = 40 + 3.61/1.5 = 42.40 in.
    - Above: 56 − 42.40 = 13.60 in ≥ ℓ_dh = 11.82 in.
    - Below: 42.40 − 10 = 32.40 in ≥ ℓ_d = 14.23 in.
    - 8 of 16 legs are credited (the other 8 fall outside the pedestal).
    - A_s = 8 × 0.31 = 2.48 in²; φN_r = 0.75 × 2.48 × 60 = 111.6 kip; DCR = 5.33/111.6 = 0.05; development DCR 11.82/13.60 = 0.869.
- **Verification:**
  - `node tests/check-syntax.mjs` passes.
  - `node tests/bpad-profis.mjs`: default, msa3a, struct2v1, struct2v2 and torqued are all `same` (none has tension rebar with a reduced h_ef). The PROFIS export checks pass.
  - The check case was run headless against origin/main and the working tree, with the numbers above. Every tab and the print report render with 0 page errors.

## 2026-10-23 — GB-1: tension anchor reinforcement is checked against ONE group breakout surface (flat across the anchors, 35° from the outer anchors); graphics redrawn to match (Tier 2, calc change)
- **Engineer request (2026-10-23):** for a group the breakout body is flat across the bottom between the anchors and rises at 35° only beyond the outer anchors (ACI 318-19 Fig. R17.5.2.1a). The tool used to put a 35° cone on each anchor separately.
- **Function:** `tensionRebarIntercept(cc)`; new helpers `breakoutHulls(pts,hef)`, `breakoutDist(x,y,hulls)` and `breakoutRing(H,R,rect,nArc)`, placed above `hefEffective()`.
  - Anchor text: `const zCross=Math.min(coneZ+r/1.5, C.H);`
- **Before:**
  ```js
  const zCross=Math.min(coneZ+r/1.5, C.H);          // r = plan distance to the NEAREST tension anchor
  ```
- **After:**
  ```js
  const hulls=breakoutHulls(pts, hef);               // tension anchors, grouped where s < 3·h_ef; convex hull per group
  ...
  const dS=breakoutDist(b.x,b.y,hulls);              // plan distance to the flat bottom (0 inside the hull)
  const zCross=Math.min(coneZ+dS/1.5, C.H);
  ```
  - The 0.5·h_ef placement limit still uses r, the distance to the nearest tension anchor (R17.5.2.1).
- **Rule:**
  - Anchors in tension closer than 3·h_ef form one group, transitively. This is the same overlap criterion as the group breakout of §17.6.2.1 and Fig. R17.6.2.1(b).
  - The flat bottom is the convex hull of the group's anchor heads, at the head plane z_head = H − h_ef.
  - The surface depth at a plan point is z = z_head + d_s/1.5, where d_s is the distance to that hull: 0 inside it, and 1:1.5 ≈ 35° outside it.
  - A single anchor, or anchors 3·h_ef or more apart, still get their own cone.
- **Governing provision:** ACI 318-19 §17.5.2.1(a), R17.5.2.1, Fig. R17.5.2.1a (the breakout body of a group), and §17.6.2.1 / Fig. R17.6.2.1(b) (group breakout, s < 3·h_ef).
- **Display changes:**
  - Per-leg table: new column d_s.
  - The derivation line, the notes, the User Manual §4D.2 and the glossary entry z_cross now read z_cross = z_head + d_s/1.5.
  - Elevation: one shaded breakout body per group, flat between the outer anchors, 35° sides with a ≈35° mark, stopped at the pedestal face. This replaces the criss-crossing cone per anchor.
  - Plan: the flat bottom is shaded, and a dashed outline shows where the surface leaves the concrete. The 0.5·h_ef zones are lighter, and the caption is split into three lines.
  - 3-D: one translucent group body, clipped at the pedestal faces, replaces the cone per anchor.
- **Check case:**
  - Plate 24 × 18 in; anchors 4 × 2 at x = ±3, ±9 and y = ±6; h_ef = 18 in; H = 58 in; pedestal 30 × 30 in; one combination P = +60 kip, so all 8 anchors are in tension.
  - Tension rebar: #5 U-stirrups, 4 per row, s = 6 in, orient y, gauge 4 in, so the legs are at y = ±4 and ±8. Top cover 2 in, 30 in below the head.
  - The hull is the rectangle x ∈ [−9, 9], y ∈ [−6, 6]; z_head = 40 in.
  - Inner legs (y = ±4), between the anchor rows:

    | | Before | After |
    |---|---|---|
    | Distance used | r = 2 | d_s = 0 |
    | z_cross | 40 + 2/1.5 = 41.33 | 40.00 |
    | Available above / below | 14.67 / 31.33 | 16.00 / 30.00 |

  - Outer legs (y = ±8): d_s = r = 2, so they are unchanged at z_cross = 41.33.
  - Totals are unchanged in this case: 16 of 16 legs effective, φN_r = 223.2 kip, development DCR 0.806 (outer legs govern). A leg between two anchor rows now has more length above the crossing and less below.
  - Second case, a single row of 4 anchors (pedestal 40 × 20 in): the hull is the segment x ∈ [−9, 9], y = 0, and the legs at y = ±2 give d_s = 2, as before.
- **Verification:**
  - `node tests/check-syntax.mjs` passes.
  - `node tests/bpad-profis.mjs`: all 5 built-in cases are `same` (none has tension rebar), and the export checks pass.
  - The check cases were run headless on origin/main and the working tree, with the numbers above.
  - Tension Rebar elevation, plan and 3-D were inspected in screenshots (three.js served locally). The print report includes d_s, and there were 0 page errors.

## 2026-10-23 — SUB-1: the §17.5.2.1(a) substitution no longer requires EVERY leg to be creditable (Tier 2, calc change)
- **Engineer report (2026-10-23):** tension rebar was provided, yet the Summary still showed concrete breakout (T) failing.
- **Function:** `rebarJustified("tension", cc)`. Anchor text: `if(ic.nEff<ic.nBarsTotal){`
- **Before:** the substitution was justified only when all of these held:
  - **every** leg was creditable (`ic.nEff===ic.nBarsTotal`);
  - the worst *crossing* leg developed (`tr.devDCR<=1`);
  - no leg was under-developed;
  - the four detailing confirmations were ticked.

  So a single leg outside the pedestal, beyond 0.5·h_ef or under-developed kept the breakout check on, even though φN_r already ignores such legs.
- **After:**
  - The substitution is justified when **at least one** leg is creditable (φN_r > 0) and the four confirmations are ticked.
  - Legs that do not qualify are reported as advisory `notes`: they are not counted in φN_r and no longer block the substitution.
  - `tensionRebarIntercept`: devDCR/devWorst are taken over the legs counted in φN_r (`devPool`); if no leg is counted, over all crossing legs. The "Rebar Development" row therefore reports the governing **credited** leg.
  - Compliance panel:
    - new blocking row "At least one leg is creditable (φN_r > 0)";
    - "every leg creditable" and the above/below development rows are now advisory;
    - the error text now says the breakout check is "still being enforced" (it wrongly said "skipped").
  - Summary: when the substitution applies, a green note says that tension breakout and side-face blowout are not checked because the anchor reinforcement carries the force, and lists the uncounted legs.
- **Governing provision:** ACI 318-19 §17.5.2.1(a): the design strength of the anchor reinforcement may be used instead of the concrete breakout strength. φN_r = φ·n_eff·A_b·f_y counts only legs that satisfy §17.5.2.1.1 and R17.5.2.1.
- **Check case:** the TR-H1 case: h_ef = 18 in, H = 58 in, pedestal 24 × 24 in, 2 × 2 anchors at ±6 in, #5 U-stirrups, 16 legs, of which 8 are creditable.

  | | Confirmations | Substitution | Concrete Breakout (T) row | Side-Face Blowout row |
  |---|---|---|---|---|
  | Before | not ticked | not justified | 0.42 | 0.072 |
  | Before | all ticked | not justified ("8 bar(s) not creditable") | 0.42 | 0.072 |
  | After | not ticked | not justified (the 4 confirmations) | 0.42 | 0.072 |
  | After | all ticked | justified | removed | removed |

  In every row: Anchor Reinf. Tension 0.048 (φN_r = 0.75 × 8 × 0.31 × 60 = 111.6 kip), Rebar Development 0.869, steel 0.145, pullout 0.114.
- **Verification:**
  - `node tests/check-syntax.mjs` passes.
  - `node tests/bpad-profis.mjs`: all 5 built-in cases are `same` (none has tension rebar), and the export checks pass.
  - The check case above was run headless on origin/main and on the working tree, with 0 page errors.
- **Open question for the engineer:** with the substitution, the tool also stops checking side-face blowout (§17.6.4); that behaviour predates this change. §17.5.2.1(a) speaks of the concrete breakout strength. Whether side-face blowout should stay checked is raised in the PR and not changed here.

## 2026-10-23 — SFB-1: side-face blowout stays checked when anchor reinforcement replaces the tension breakout (Tier 2, calc change, MORE conservative where it changes)
- **Engineer decision (2026-10-23):** §17.5.2.1(a) substitutes the anchor reinforcement for the concrete **breakout** strength only. Side-face blowout (§17.6.4), a separate failure at the head near an edge, stays checked.
- **Functions and anchor text:**
  - `comboCapacities`: tension-mode envelope, `if(!tSubst){` … `Side-face blowout (φNsb)`.
  - `allChecks`: both the governing-mode envelope (`push("sfb",…)`) and the per-combination table (`put("sfb",…)`).
  - The Strength Summary report rows: `Concrete Side-Face Blowout`.
  - The Summary note.
- **Before:**
  ```js
  if(!tSubst){ /* breakout */ ...; if(!sfb.na) tensionModes.push({label:"Side-face blowout (φNsb)", ...}); }
  ```
  With a justified substitution, side-face blowout was dropped from the envelope, from the §17.8 interaction, the Summary and the report.
- **After:**
  ```js
  if(!tSubst){ /* breakout only */ }
  if(!sfb.na) tensionModes.push({label:"Side-face blowout (φNsb)", ...});   // always
  ```
  The same split is made in `allChecks` (both places) and in the report rows. The Summary note now reads "Concrete breakout (tension) is not checked … Steel, pullout and side-face blowout are still checked."
- **Governing provision:** ACI 318-19 §17.5.2.1(a) (anchor reinforcement instead of the concrete breakout strength) and §17.6.4 (side-face blowout).
- **Check case:** the SUB-1 case with all four confirmations ticked, so the substitution is justified.
  - Before: Side-Face Blowout row absent.
  - After: Side-Face Blowout 0.072, the same value as without rebar.
  - Unchanged: Breakout (T) absent, Anchor Reinf. Tension 0.048, steel 0.145, pullout 0.114, interaction 2.134.
- **Verification:**
  - `node tests/check-syntax.mjs` passes.
  - `node tests/bpad-profis.mjs`: all 5 built-in cases are `same` (none has tension rebar).
  - The check case was run headless on origin/main and the working tree, with 0 page errors.

## 2026-10-23 — VT-1: closed ties enclosing the anchor group as shear anchor reinforcement; eligibility decided per leg from the geometry (Tier 2, new capability + calc change for the shear substitution gate)
- **Engineer request (2026-10-23):** a column pedestal with ties around all the anchors should count as shear anchor reinforcement. The engineer enters the geometry, and the app decides which ties are eligible.
- **New piece type `closedtie`:** new fields in `S.vRebar`, all additive with defaults, so no migration is needed:
  - `tieSets` (default 3);
  - `tieTop` (2.5 in, the depth of the top set to the bar centreline);
  - `tieSpacing` (3 in);
  - existing fields reused: `cover`, `size`, `grade`, `epoxy`.
- **Function:** `shearRebarIntercept(cc)`, new early branch `if(R.pieceType==="closedtie")`, inserted before "room behind the failure plane".
- **Model:**
  - The tie follows the pedestal outline at the cover. The legs that resist V are the two legs parallel to the shear, at t = ±(half-width − cover − d_b/2).
  - The reference row is the anchor row the governing shear-breakout case uses, i.e. the row at c_a1 from the governing edge (the back row when Case 2 governs).
  - For each tie set k (depth z) and side, a leg is effective only if all of these hold:
    1. **Placement:** z ≤ 0.5·c_a1, applied to the depth of the tie set. This is the engineer's reading for enclosing ties.
    2. **Crossing:** in front of the reference row, the shear breakout body has half-width and depth 1.5·x at distance x. A leg with lateral offset d_T (0 inside the span of the reference anchors) crosses the failure surface at x_c = max(d_T, z)/1.5, and must do so before the front corner: c_a1 − x_c − cover > 0.
    3. **Edge-side anchorage:** the closed corner around a longitudinal bar anchors the front end. This is the same treatment as a hairpin bend around the rod, and it is confirmed in the attestations.
    4. **Behind:** x_c + (reference row → back face) − cover ≥ ℓ_dh, because the back corner is a bend.
  - φV_r = 0.75 · n_eff · A_b · f_y.
- **Substitution gate:** shear now follows the same rule as SUB-1 on the tension side.
  - `rebarJustified("shear")`: legs that do not qualify become advisory `notes`.
  - Remaining blockers: no effective leg, a §25.2.1 clear-spacing clash, and the four confirmations.
  - Removed as blockers (those legs are already not counted): "leg extension does not fit" and "bend engaging the rod not confirmed".
  - In the compliance panel, the depth, behind and engages rows are advisory, and a new blocking row requires at least one creditable leg.
- **Display:**
  - Piece type option "Closed ties enclosing the anchor group", with inputs for the number of sets, the top-set depth, the vertical spacing, cover and epoxy. The hairpin-only inputs are hidden for ties.
  - A per-leg table, with each criterion and its value.
  - A worked derivation step (§6).
  - A plan view (CLOSED-TIE PLAN) showing the tie outline, the side legs coloured by verdict, the legs across V in grey, and a × at each crossing.
  - A section view showing each tie set with its verdict and crossing, plus the 0.5·c_a1 line.
  - The Summary row "Anchor Reinf. Shear (ties)", and a green Summary note when it replaces the shear breakout. Steel shear and pryout are still checked.
  - Tie-specific wording for the existing attestation keys (ack_bend, ack_perp, ack_devBoth), with no new keys.
- **Governing provision:** ACI 318-19 §17.5.2.1(b), R17.5.2.1(b), Fig. R17.5.2.1b (stirrups/ties enclosing the edge reinforcement); §25.4.3 (ℓ_dh).
- **Check case:**
  - Pedestal 24 × 24 × 36 in; default plate 18 × 18 with 2 × 2 anchors at ±6 in; default combinations (governing V = 16.16 kip).
  - #4 closed ties: 3 sets, top at 2.5 in, spacing 3 in, cover 2 in; ℓ_dh = 8.46 in.
  - The shear-breakout solve gives the +x edge with c_a1 = 18 in (Case 2, back row at x = −6), so 0.5·c_a1 = 9 in; t_leg = 9.75 in; d_T = 9.75 − 6 = 3.75 in.

  | Set | z (in) | x_c = max(3.75, z)/1.5 (in) | Behind = x_c + 6 − 2 (in) | Result |
  |---|---|---|---|---|
  | 1 | 2.5 | 2.50 | 6.50 < 8.46 | not counted |
  | 2 | 5.5 | 3.67 | 7.67 < 8.46 | not counted |
  | 3 | 8.5 | 5.67 | 9.67 ≥ 8.46 | **effective**; front 18 − 5.67 − 2 = 10.33 > 0 |

  - n_eff = 2; φV_r = 0.75 × 2 × 0.20 × 60 = 18.0 kip; DCR = 16.16/18.0 = 0.898.
  - With the four confirmations ticked, the substitution is justified: Concrete Breakout (V) (1.454 with no reinforcement) is removed. Pryout 0.238 is unchanged.
- **Hairpin regression (same pedestal, default hairpins):**
  - φV_r 18.0, DCR 0.898 and n_eff 2 of 8 are unchanged.
  - The gate reasons change only as described: the "not creditable" reason is now a note, the "bend not confirmed" blocker is gone, and the spacing clash still blocks.
- **Verification:**
  - `node tests/check-syntax.mjs` passes.
  - `node tests/bpad-profis.mjs`: all 5 built-in cases are `same`, and the export checks pass.
  - The tie and hairpin cases were run headless (origin/main against the working tree for the hairpins), with 0 page errors.
  - The plan and section were inspected in screenshots, and the print report builds.

## 2026-10-23 — PR-1: Pedestal Reinforcement input; §10.7.6.1.6 ties-at-anchor-bolts check; pedestal vertical bars as tension anchor reinforcement; closed-tie shear uses the pedestal ties (Tier 2, new checks)
- **Engineer request (2026-10-23):** add the pedestal tie check and the pedestal vertical bars, with the geometry entered once and the app deciding eligibility.
- **New saved group `S.ped`.** It is additive: `mergeState` fills the defaults, so no migration is needed. Fields:
  - `present`;
  - `barSize`, `nX`, `nY` (bars per face, corners included);
  - `tieSize`, `cover` (clear cover to the ties);
  - `tieSets`, `tieTop`, `tieSpacing`;
  - `barTop` (top of the vertical bars below the surface);
  - `intoFooting`, `footExt`, `grade`.

  New input section "7a. Pedestal Reinforcement".
- **New functions:**
  - `pedGeom()` places the perimeter bars at cover + tie Ø + bar Ø/2 from the faces, and the tie sets at tieTop + k·tieSpacing.
  - `pedTieCheck()` runs the §10.7.6.1.6 check.
  - `tRebarEff()` gives the effective tension-rebar inputs.
- **§10.7.6.1.6 check:**
  - Count the tie sets within 5 in of the top. Two are required for No. 4 or larger, three for No. 3; smaller than No. 3 fails.
  - The ties must enclose every anchor: anchor centre + d_a/2 inside the tie's inside face.
  - The ties must surround at least 4 longitudinal bars.
  - DCR = n_req/n. It is ∞ if the ties do not enclose the anchors, are smaller than No. 3, or surround fewer than 4 bars.
  - Shown as the Summary row "Pedestal Ties at Anchors" and as section 8 of the Concrete Embedment tab, with worked lines (§6).
- **Tension piece type `pedbars`:**
  - The legs are the pedestal bars at their true positions, and the bar size and grade come from `S.ped`.
  - The bar top is H − barTop. The bar bottom is −footExt into the footing, or 0 if `intoFooting` is off.
  - Every existing criterion applies unchanged: 0.5·h_ef placement, the GB-1 group surface, and development above and below.
  - `tensionRebarIntercept` and `tensionRebarCheck` now read `tRebarEff()`. For any other piece type it returns `S.tRebar` unchanged.
- **Shear `closedtie`:** when `S.ped.present`, the tie size, sets, top, spacing and cover come from `S.ped`. `shearRebarCheck` takes A_b from the intercept's bar.
- **Display:**
  - Input-summary lines for the tension and shear rebar and for the pedestal.
  - The tie outline in the tension plan.
  - In the elevation: bars running into the footing, clipped to the view; "bars continue … into the footing" in place of the ext-below dimension; the caption gives the bar count.
- **Governing provision:**
  - ACI 318-19 §10.7.6.1.6 (ties at anchor bolts in a column or pedestal).
  - §17.5.2.1(a), R17.5.2.1 and Fig. R17.5.2.1a (vertical bars as anchor reinforcement).
  - §25.4.2, §25.4.3 (ℓ_d, ℓ_dh).
- **Check case:**
  - Pedestal 24 × 24 × 58 in, h_ef = 18 in, default plate and anchors (2 × 2 at ±6 in), default combinations.
  - S.ped: 8 #6 bars (nX = nY = 3) at ±9.125 in (2 + 0.5 + 0.375); #4 ties, cover 2 in, 3 sets with the top at 2 in (raised to cover + d_b/2 = 2.25) at 3 in; bars stop 3 in below the top, 24 in into the footing.
  - **§10.7.6.1.6:** sets at 2.25, 5.25 and 8.25 in, so 1 is within 5 in against 2 required. DCR = 2.0, FAILS. The ties enclose the anchors and surround 8 bars.
  - **Pedestal bars (hooked top), tension anchors at x = −6:**
    - Bar (−9.125, −9.125): r = 4.42 ≤ 9.0, z_cross = 40 + 4.42/1.5 = 42.95, above 55 − 42.95 = 12.05 < ℓ_dh 15.54, so not counted.
    - Bar (−9.125, 0): d_s = 3.13, above 12.92 < 15.54.
    - Result: 0 of 8 counted, φN_r = 0. The substitution is not justified and Concrete Breakout (T) 0.450 stays.
  - **Closed ties from the pedestal (#4, sets 2.25 / 5.25 / 8.25, c_a1 = 18):** 2 of 6 legs effective (set 3), φV_r = 18.0 kip, DCR 0.898.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs`: on all 5 built-in cases, cc, capacities, checks and validation are identical. Only `.report` differs, and a line diff shows the only new lines are the "8. Pedestal Ties at Anchor Bolts" heading in each concrete section (not checked when the pedestal reinforcement is not entered).
  - The check case was run headless, with 0 page errors. The VT-1 tie case without S.ped is unchanged (φV_r 18.0, DCR 0.898).

## 2026-10-23 — DX-1: Export DXF (plan + section, R12, inches) (display/export only, no calculation change)
- **Engineer request (2026-10-23):** a DXF export for drafting.
- **New:**
  - a header button "Export DXF" (`btnExportDxf`);
  - `bpDxfWriter()`, an ASCII DXF R12 (AC1009) writer with CRLF line ends, layers, LINE, POLYLINE, CIRCLE and TEXT. It is adapted from `Gusset Plate Rating.html` GPDXF.write, duplicated per CLAUDE.md §3;
  - `bpExportDxf()`, which builds the drawing.
- **Content of the drawing:**
  - **PLAN** at the pedestal centre:
    - pedestal, plate, column (W outline, round or rectangle) and centrelines;
    - anchors and DG1 oversized holes, numbered;
    - pedestal bars and the tie outline;
    - tension reinforcement legs, on separate layers for counted and not counted;
    - shear hairpin legs, or the closed-tie outline;
    - the group breakout surface: its flat bottom, and where it leaves the concrete.
  - **SECTION** along x, to the right of the plan:
    - pedestal, plate and a column stub;
    - anchors with heads;
    - pedestal bars, drawn into the footing when that option is on;
    - tie sets and tension legs;
    - the group breakout polyline, clipped at the pedestal faces.
  - Notes listing the layers. All layers are prefixed BP-.
  - Plate-referenced items (anchors, plate, column, stirrup and hairpin legs) are offset by the plate offset. Pedestal-referenced items (pedestal bars, ties) are not.
- **Governing provision:** none (export only).
- **Check case:** the default project, and the PR-1 pedestal case with U-stirrups and closed ties.
  - Both files read back in ezdxf 1.4.4 with 0 audit errors and 0 fixes.
  - Entity counts:
    - default: POLYLINE 8, LINE 7, CIRCLE 8, TEXT 12;
    - pedestal case: POLYLINE 9, LINE 15, CIRCLE 24, TEXT 12.
  - Rendered through the ezdxf SVG backend and inspected.
  - The button's download is named `Untitled.dxf`.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs`: all 5 built-in cases are `same`, and the export checks pass.
  - 0 page errors.

## 2026-10-23 — GFX-A: 3-D view with every reinforcement layer and both breakout bodies; shear plan clipped to the concrete, reference row and c_a1 (display only, no calculation change)
- **Engineer request (2026-10-23):** graphics items 1 (3-D) and 6 (shear plan), approved with the other graphics items; done as the first of four PRs (GFX-A … GFX-D).
- **Saved data (§5, additive):** `S.ui.layers3d = {tRebar, vRebar, ped, breakout}`, default all `true`, added to `defaultState()`.
  - `mergeState` fills missing keys: `out.ui.layers3d=Object.assign({},d.ui.layers3d,(st&&st.ui&&st.ui.layers3d)||{})`.
  - Migration: a save without `ui.layers3d` whose old single 3-D "Rebar" layer was off (`_vis3.show.rebar===false`) keeps the tension legs and the breakout body off (`tRebar = breakout = false`); that layer held exactly those two things.
  - The existing switches and opacities stay where they were, in `S._vis3` (concrete, grout, plate, anchors, loads, dimensions, axes). Nothing is renamed or removed; the old `rebar` key is left in old saves and ignored.
- **`build3D()` — anchor text `const groups={concrete:new THREE.Group()`:**
  - Before: `…anchors:new THREE.Group(),rebar:new THREE.Group(),loads:…`.
  - After: `…anchors:new THREE.Group(),tRebar:new THREE.Group(),vRebar:new THREE.Group(),ped:new THREE.Group(),breakout:new THREE.Group(),loads:…`.
  - Canvas height `H=520` → `H=640`.
- **`build3D()` — the block `(function drawRebar3D(){ … })();` (anchor text `/* ---- TENSION ANCHOR REINFORCEMENT`) is replaced by the block `/* ---- REINFORCEMENT AND BREAKOUT BODIES (GFX-A, 2026-10-23)`.** Helpers `rod`, `path3`, `knot` at build3D scope. It draws:
  - **Pedestal reinforcement (`ped`)** from `pedGeom()`: the bars from −footExt (or 0) to H − barTop, and each tie set as a closed loop at the tie centreline (±tieHx, ±tieHy) at depth z_k. Blue-grey (0x546e7a). Not drawn here when the bars ARE the tension reinforcement (`tRebarEff().isPed`) or the ties ARE the shear ties (`icV.isTie && icV.usePed`): those are drawn coloured in their own layer, not twice.
  - **Tension rebar (`tRebar`)** from `tensionRebarIntercept(CC)`, as before: green counted, red crosses but not counted, grey never reaches the surface; a sphere at z_cross; top bend for two-leg pieces, bottom bend only for a closed tie. Change: pedestal bars (`pedbars`) are no longer shifted by the plate offset (they are pedestal-referenced; the DXF export already did this).
  - **Shear rebar (`vRebar`)** from `shearRebarIntercept(CC)`:
    - hairpins and bars: each leg from the leading row back by `availBehind` at its depth z; colour as the hairpin plan (green `L.eff`, red `L.fits` but not counted, grey does not fit); a hairpin's bend as a half circle around the rod toward the edge (green if both legs count, else 0x8d6e00); the hook stub at the back end when `hookEnd`. Plate offset applied.
    - closed ties: per set k at z_k, the two legs parallel to V coloured by that set's verdict, the legs across V grey, a sphere at each crossing (`lead + xCross`). Pedestal frame (no offset).
  - **Breakout bodies (`breakout`):**
    - the GB-1 tension body (same geometry as before: `breakoutRing` from `ic.hulls`, flat bottom at `coneZ`), now opacity 0.24 (was 0.14), the flat bottom filled at 0.45, outlines solid dark red;
    - NEW: the shear breakout half-pyramid (orange, 0xd35400, opacity 0.22) from the reference row (below) to the governing edge: on the top face a trapezoid opening 1.5·c_a1 beyond the outer anchors of the row, on the edge face a band 1.5·c_a1 deep (limited to H), the failure surface between them; clipped to the pedestal by `clipSolid3()`.
- **`build3D()` — framing (anchor text `let ang=0,drag=false`):** new `target`, `place()` and `fit()`. `fit()` projects a sample of the drawn vertices of the visible layers, pans the target to centre them and scales the distance until they fill ~90 % of the view (iterated). Before: aim at the plate top, distance from a fixed reach estimate; the model filled about the middle third. `three3D.fit()` resets the orbit to the isometric default and fits.
- **`buildVisualTab()`:** the layer toggles are Concrete, Grout, Plate/column, Anchors, Tension rebar, Shear rebar, Pedestal reinforcement, Breakout bodies, Loads, Dimensions, Axes (before: … Anchors, Rebar, Loads …), plus a "Fit view" button. A second note gives the colour key. The toggles of the four new layers read and write `S.ui.layers3d`; the others `S._vis3.show` as before.
- **New helpers before `drawHairpinPlan`:**
  - `shearBodyGeom(ic)`: the reference row of the governing shear breakout case, in the pedestal frame — the anchor row at c_a1 from the governing face (c_a1 from `shearRebarIntercept` → `comboCapacities().sbk`); if no row matches (c_a1 limited by §17.7.2.1.2), the row at the combination's critical-row set-back `vCaseOffset`. Returns u (toward the edge) and t (along it) of the row, its outer anchors, the face, and whether it is the back row.
  - `clipSolid3(faces, planes)`: clips a convex solid (list of planar faces) by axis-aligned half-spaces and caps the cut.
- **`drawHairpinPlan()` — shear plan:**
  - Breakout trapezoid. Before (anchor text `const halfW=1.5*ic.ca1;`): rear corners at the LEADING row, front corners at `edgeN` moved in to `min(1.5·c_a1, c_a2)`, drawn in the plate frame (`XP`, `YP`). After: rear corners at the REFERENCE row (`shearBodyGeom`), front corners 1.5·c_a1 beyond the row's outer anchors at the face, the polygon clipped to the pedestal (the splayed side stops at the side face and runs along it), drawn in the pedestal frame (`X`, `Y`).
  - The failure-plane line is drawn through the reference row (was: the leading row), clipped to the concrete.
  - New: label "reference row: back row (Case 2)" / "front row" / "anchor row", and a c_a1 dimension from the reference row to the governing face, outside the side face. Where §17.7.2.1.2 limits c_a1 the label also gives the geometric row-to-edge distance.
  - Closed ties: the front and back legs (across V) solid dark grey 2.6 (were light grey 2.2), named "front leg" / "back leg" outside the pedestal on a dotted leader; the "n of m tie legs effective" count moved under the title (it sat on the front leg and the shear arrow).
  - Legend line: "shaded = breakout body, reference row → +x edge (1.5·c_a1 = … beyond its outer anchors), clipped to the concrete".
  - The 0.5·c_a1 bands, the hairpin legs and the ≥ ℓ_d note are unchanged (leading row, as the check places them).
- **Governing provision:** none changed. The drawn shear body follows ACI 318-19 §17.7.2.1 and Fig. R17.7.2.1b (half-pyramid 1.5·c_a1 from the critical row; Case 2 = back row); the tension body GB-1 (Fig. R17.5.2.1a).
- **Check case (display):**
  - Pedestal 24 × 24 × 58, h_ef 18, S.ped #6 3 × 3, #4 ties cover 2, 3 sets at 2 (2.25) / 3; tension `pedbars`, shear `closedtie`. Shear to +x, c_a1 = 18 from the back row x = −6 (Case 2) to the face x = 12: the plan shows the body from x = −6, 27 in beyond y = ±6, clipped at y = ±12, and "c_a1 = 18.00″". 3-D: tie set 3 legs green, sets 1–2 red (table: 2 of 6, set 3), legs across V grey; the 8 pedestal bars coloured as tension legs (0 of 8 counted; 5 cross, 3 grey), no blue-grey duplicates.
  - Default pedestal 30 × 30 × 36, 4 × 2 anchors (plate 24 × 18), U-stirrups qty 2, hairpins: c_a1 = 12 from the back row x = 3 (Case 2) to x = 15; the trapezoid reaches the ±15 side faces and runs along them; hairpin legs (0 of 8 counted) red with mixed bends.
  - Shear toward −y with a plate offset x = 3 (2 × 3 anchors, group hairpin): reference row y = 0, c_a1 = 15, body clipped at x = ±15 in the pedestal frame.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs`: all 5 built-in cases `same` (cc, capacities, checks, validation and the report text); export checks pass.
  - The three test projects above, origin/main vs this branch: `computeAll()`, every combination's capacities, `allChecks()`, `VALIDATION`, `tensionRebarIntercept` and `shearRebarIntercept` identical; report text identical.
  - Migration and toggles checked headless: an old save with `_vis3.show.rebar=false` loads with tension rebar and breakout off; a partial `layers3d` is filled; a toggle writes `S.ui.layers3d` and survives a rebuild.
  - Screenshots of every changed view, 0 page errors.

## 2026-10-23 — GFX-B: both orthogonal sections with a section-cut selector; plan dimensions; leg-to-anchor distances (display only, no calculation change)
- **Engineer request (2026-10-23):** graphics items 2 (sections) and 3 (dimensions), the second of four PRs.
- **Saved data (§5, additive):** `S.ui.secCut = {A:"all", B:"all"}` in `defaultState()`. `A` is the tension Section A-A, `B` is B-B. Each value is `"all"` (projected), or the coordinate of an anchor row. A missing or stale value reads as `"all"` (`bpCutOf`), so no migration is needed.
- **New helpers before `drawRebar`:**
  - `bpCutRows(ax)`: the distinct anchor coordinates along one axis, in the plate frame, as the rebar views draw them.
  - `bpNearestRow(v, rows)`.
  - `bpCutOf(key, rows)`.
- **`drawRebar(body, kind, opt)` (anchor text `function drawRebar(body,kind`), tension only.** `opt = {axis:"x"|"y", cut:null|row}`. A call without `opt` draws exactly the view as before: A-A, projected.
  - **Axis:** `hc()` / `oc()` read the in-page and out-of-page coordinate. `spanPed` is `C.By` for B-B. The anchors are the intercept's tension anchors, `anchorRestraint` (before: `rows[].xs`, which are x only). The legs, z_cross ticks and bends are drawn at `hc()`. Before, they were drawn at `.x`.
  - **Bends:** `bendIntoPage = isPair && (axY? orient==="x" : orient==="y")`. Before: `orient==="y"`.
  - **Cut:** an object is in the cut when its nearest anchor row is the chosen row. Objects outside the cut are drawn first, at opacity 0.2.
    - The breakout surface is the true profile along the cut line: `z = min(coneZ + breakoutDist(P, hulls)/1.5, H)`, sampled in 160 steps. This is the same function the check uses.
    - With no cut, the GB-1 silhouette is drawn as before.
  - **Overlap order:** where legs superimpose in a projection, counted legs are drawn on top, then crossing legs, then the rest.
  - **Pedestal reinforcement:** the pedestal ties, and the pedestal bars when they are not the tension legs, are drawn light grey (#8a9aa6).
  - **Title:** a section title, e.g. "SECTION A-A — along x, looking +y — cut at the anchor row y = −6.00″ (others dimmed)". The axis triad is `elevX` for B-B.
  - **Spacing dimension:** it now uses the distinct leg positions in the cut and is labelled with the distance drawn. Before, it took the middle two legs in list order, which could be the same position in two rows, and it was always labelled with the input spacing.
- **Piece pairing (display fix):** the two legs of a 2-leg piece are now its two consecutive entries in the intercept's leg list. Piece numbers restart in every row, so keying by the number joined the pieces of different rows. The effect was:
  - in the elevation, one wide U across the rows;
  - in the plan, no stirrup outline;
  - in the 3-D view, no bends.

  Changed in `drawRebar`, `drawRebarPlan` (anchor text `(ic.bars||[]).forEach((b,i)=>`) and `build3D` (anchor text `icT.bars.forEach((b,i)=>`).
- **`buildTRebarTab` → card "3. Rebar Layout":** two selectors are added, "Section A-A (along x) cut at" and "Section B-B (along y) cut at". Each offers "all anchors and legs, projected" or an anchor row. The card then draws A-A and B-B. The warning box still uses A-A's fit result, unchanged.
- **Shear:**
  - New `drawShearFace(body)`, Section B-B. It shows the governing edge face from outside, looking along V. It draws:
    - the projected area A_Vc, with width × depth = A_Vc labelled from `comboCapacities().sbk`;
    - the anchors, projected;
    - every leg in section at its t and depth, coloured by its verdict;
    - for ties, the front leg as a grey bar, the tie sets and the 0.5·c_a1 line;
    - for hairpins, the 0.5·c_a1 bands.

    It is added to the Shear Rebar tab under "Section B-B — the governing edge face".
  - The existing shear section gets the title "SECTION A-A — along V, toward the +x edge …".
  - The shear sections are projected and have no cut selector. B-B separates the legs that superimpose in A-A.
- **Plan dimensions, new `bpPlanDims(s, o)` before `drawRebarPlan`:**
  - A chain along x above the pedestal (face → anchor columns → face) and along y to its left. A label that would run into its neighbour is staggered one tier out.
  - The plate B and N on a second tier.
  - In the tension plan, the clear-cover envelope (dashed) and a "clear cover" dimension.
  - The edge-distance labels use the values from `anchorGeom()` (ca_x_neg …, with the plate offset and a c_a override included; "(override)" is added when it is set). Spacings are the distances drawn.
  - Tension plan labels: "c_a". Shear plan labels: "c_a2" to the faces along the governing edge, "c" to the others; c_a1 stays the GFX-A dimension from the reference row.
  - `drawRebarPlan`: H 460 → 500, with the pedestal lowered. The chosen section cuts are marked A–A / B–B.
  - `drawHairpinPlan`: H 470 → 520, with the pedestal lowered. Anchor circles are reserved in the label placer. The reference-row label for an edge along y now sits inside, clear of the anchors. The tie front/back-leg labels moved out beyond the dimension tiers.
  - `makeTagPlacer()` gains `.reserve(x1, y1, x2, y2)`.
- **Click panels:**
  - **Tension leg:** new row "Distance to that anchor: Δx, Δy, r = √(Δx² + Δy²), and d_s to the flat bottom". The anchor is now taken from the intercept's own list of tension anchors (`anchorRestraint[nearIdx]`) and numbered as in the anchor key. Before, `nearIdx` indexed the governing combination's anchor list, which could name another anchor when the maximum-tension combination is a different one.
  - **Shear leg:** new row "Distance to its anchor": the anchor number and coordinates, |t − t_a|, and for ties the crossing in front of the anchor and the depth.
- **Governing provision:** none changed. The sections follow Fig. R17.5.2.1a (GB-1 surface) and §17.7.2.1.3 / Fig. R17.7.2.1b (A_Vc).
- **Check case (display):**
  - 4 × 2 anchors (x = −9, −3, 3, 9; y = ±6), pedestal 30 × 30 × 36, U-stirrups, qty 2, orient y.
    - A-A cut at y = −6: the only tension anchor in that row, x = −9, is drawn full and x = −3, 3 are dimmed. The legs at x = −12 and −6 are full. The profile is a V from x = −9 at the head plane (z = 24), reaching the top at x = 9 (1.5 · 12 = 18 from the anchor) and the −x face at z = 26.
    - B-B projected: four separate U's (before: one U from y = −8 to 8). The spacing dimension reads 8.00″ (legs at ±4).
    - Plan chain: c_a 6.00, s 6.00 ×3, c_a 6.00 along x; c_a 9.00, s 12.00, c_a 9.00 along y; plate 24 × 18.
  - The leg 1A panel reads: anchor 1 (−9, −6), Δx = −3.00, Δy = −2.00, r = 3.61″ (table r = 3.61). Tie set 1 leg A: anchor 1 (−6, −6), |t − t_a| = 3.75″, crossing 2.50″ in front at depth 2.50″.
  - Pedestal case (24 × 24 × 58, closed ties): the B-B face shows A_Vc = 24.00 × 27.00 = 648.0 in² (sbk), set 3 green, sets 1–2 red.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs`: all 5 built-in cases `same`, report included.
  - On the three graphics test projects, origin/main vs this branch, every result is identical, including both intercepts and the report text.
  - The panels were clicked headless. Screenshots were checked. 0 page errors.

## 2026-10-23 — GFX-C: anchor force map; labels through collision checks; 9 px minimum text size (display only, no calculation change)
- **Engineer request (2026-10-23):** graphics items 4 (force map) and 5 (labels). This is the third of four PRs.
- **Saved data:** none.
- **New `drawForceMap(body, c)`**, placed before `anchorForceTable`. It is called in `buildAnchorTab`, card "Anchor Layout & Resulting Forces", between the anchor key and the force table. Anchor text: `drawForceMap(body,c);   /* GFX-C`. It draws a plan of the plate for the detailed (selected) combination:
  - **Anchors:** each anchor is shaded by its axial force from `c.perAnchor[i].t` (red = tension, green = compression, intensity ∝ |T_i|/max) and labelled T = … / C = …. A tension scale bar is shown.
  - **Neutral axis:** the line `w = a + b·x + c·y = 0` from `c.na.plane`.
  - **Bearing stress block:** the compression polygon, shaded by a gradient from 0 on the neutral axis to the most compressed corner. This follows `naAnchorForces`: σ = K_c·(−w), linear in w. Isostress lines are drawn at 25 / 50 / 75 % of the peak, and labelled only when they are at least 16 px apart.
  - **Peak and resultant:** the peak `c.na.smax` at that corner, and the resultant `c.na.C` at (`c.na.xc`, `c.na.yc`).
  - **Other cases:**
    - no moment: uniform bearing, `c.na.C`, with DG1 f_p = `c.resX.q`;
    - open stand-off: "no bearing under the plate";
    - elastic model: a note referring to DG1 on the Base Plate tab.
  - **Not recomputed:** no force or stress. The solver's own plane is evaluated only to place the shading and the lines.
- **`txt()`:** before, `const fsz=size||11;`. After, `const fsz=Math.max(size||11,9);`. No drawing text is below 9 px, on screen or in print.
- **New `svgFitText(s)`**, called first in `svgWithControls`. An upright label whose estimated box (0.5·font-size per character) crosses the left or right edge is slid back inside.
- **`drawRebar`:**
  - H 440 → 480.
  - Caption rows:
    - tension: legend at H−45 and H−32, caption at H−16, the cover-warning line at H−58 (it shared the legend row);
    - shear: the caption is split into the description at H−30 and the verdict at H−16 (one line ran past both edges).
  - The axis triad moved to the top left (34, 62). At the bottom, its origin note ran into the caption.
  - The "breakout uses h_ef' = …" note moved under the title. It was centred on the third dimension tier and ran off the right edge. It now also states the h_ef used by the check and the drawing.
  - **c_top** moved to a third tier outside the right face, on a leader, when it fits. Otherwise it stays where it was. It sat among the bars and the z-datum label.
  - **"flat at the head plane across the anchors"** moved below the bar bottoms, or below the pedestal when the bars run to the base, on a dotted leader. It sat across the bars.
  - **Closed-tie section:** the set labels and "0.5·c_a1 = … below the top" go through one `makeTagPlacer` outside the left face, with the z = H label reserved. The 0.5·c_a1 label sat on a tie line. "top set" moved to the outer right tier; it sat on the H dimension.
  - **Hairpin section:**
    - "behind = …" moved above the top face, on extension lines;
    - the depth and stack dimensions use horizontal labels on leaders (the rotated depth label ran off the top);
    - "failure plane" moved right of the plane;
    - the title was shortened (it ran under the zoom buttons).
- **`drawHairpinPlan`:**
  - The leg tags (6.5 → 9 px) go past the BACK end of each leg. At the plane end they sat on the bends and on each other.
  - The "≥ ℓ_d" label goes on the far side of its dimension line from the leg, through the placer.
- **Print report (`buildPrintReport`):** the PDF of the 4 × 2 U-stirrup / hairpin project was printed headless (Letter, print media; 50 pages) and the figure pages were rendered and inspected. No figure is clipped.
- **Governing provision:** none changed.
- **Check case (display):**
  - Combination "Vy" (P = +10, Vx = 2, Vy = −15, Mx = 200 kip-in), plate 18 × 24, 2 × 3 anchors.
  - The force map shows anchors 5 and 6 at T = 6.12 kip and 3 and 4 at T = 3.01 kip (the per-anchor table gives the same), and anchors 1 and 2 at 0.
  - The neutral axis runs just above the bottom row. σ_max = 0.269 ksi and C = 8.25 kip over 60.5 in².
  - Hand check: ΣT − C = 2(6.12 + 3.01) − 8.25 = 10.01 ≈ P = 10.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs`: all 5 built-in cases are `same`, and `.report` is identical.
  - On the three graphics test projects, every result and the report are identical.
  - Every drawing was screenshotted (input plan and elevations, anchor key, force map, breakout, tension plan and sections, shear plan and sections) for the default, pedestal, 4 × 2 and −y shear projects, with 0 page errors.

## 2026-10-23 — GFX-D: Detail Sheet tab — one printable page with plan, both sections, rebar schedule and check summary (display only, no calculation change)
- **Engineer request (2026-10-23):** graphics item 7. This is the last of four PRs.
- **Saved data:** no new key. `S.print.sections.tabDetail` is written only when the report option is ticked. It is opt-in like the appendices: a missing key means the sheet is not in the calculation report.
- **New tab "Detail Sheet" (`tabDetail`):**
  - **Where it is wired:** `TABS()` adds it after the rebar tabs; `buildOutput` and `buildOutputInto` call `buildDetailTab`.
  - **Print settings:** in `openPrintSettings` (the `optIn` test, and the `est()` count) and `BPAD_OPTIN` in `buildPrintReport`, it is an appendix that prints only when ticked. The default calculation report is unchanged.
- **New `buildDetailTab(pg)`.** The tab shows a header line (project, pedestal, f′c, plate, anchors, h_ef) and a 2 × 2 grid:
  - **Figures in three cells,** using the compact versions of the existing drawing functions:
    - with tension reinforcement: `drawRebarPlan`, then `drawRebar` A-A and B-B, with the cuts chosen on the Tension Rebar tab;
    - otherwise, with shear reinforcement: `drawHairpinPlan`, the shear `drawRebar` and `drawShearFace`;
    - otherwise: `drawPlan` and `drawElevation` x and y, at full drawing size (see the open item).
  - **The rebar schedule in the fourth cell.**
  - **Below the grid, a check summary** from `allChecks()`: label, reference, D/C and status, in two columns.
- **"Print this sheet (one page)" button.** It calls `bpPrintSheet()`, which:
  - copies the sheet into `#printReport`;
  - applies the report page CSS (`bpadApplyPageCSS`): letter portrait with the title-block header;
  - prints.
- **New `bpRebarSchedule()`.** It builds one row per mark, size, shape, length and verdict. The columns are mark, size, quantity, shape, approximate length and counted / not counted.
  - **Lengths:** the centreline lengths of the straight segments and bends as drawn, from the same geometry the checks use. Hooks and bend allowances are not added.
    - U-stirrup: 2·(bar top − bar bottom) + gauge (top bend when hooked at the top).
    - Closed stirrup: 2·leg + 2·gauge.
    - Straight bar or pedestal bar: the leg.
    - Hairpin: 2·available behind + π·gauge/2.
    - Closed tie: 2·(2u_F) + 2·(2t_L).
    - Pedestal bar: (H − barTop) + footExt.
    - Pedestal tie: 4·tieHx + 4·tieHy.
  - **Counted:** from the per-leg verdicts. A piece is counted when all its legs are counted. A tie set is counted when its legs parallel to V are counted.
  - **Pedestal rows:** pedestal bars and ties are listed as P1 / P2 unless they are themselves the tension bars or the shear ties.
- **Compact option** (`opt.compact`, detail sheet only):
  - **Canvas sizes:**
    - `drawRebarPlan(body,opt)`: 380 × 320;
    - `drawRebar(body,kind,opt)`: 380 × 320, pad 56;
    - `drawHairpinPlan(body,cGov,opt)`: 380 × 320;
    - `drawShearFace(body,opt)`: 380 × 320, pad 56.
  - **Left out:** the captions, legends and click panels (the sheet's notes replace them).
  - **Titles:** shortened.
  - **Axis triad:** dropped from the sections; their titles name the axis.
  - **`bpPlanDims`:** new `o.noPlate`, which leaves out the plate tier (the header gives the plate size).
  - **No compact option:** the full-size views are drawn exactly as before.
- **CSS:** `.bpSheet` (max-width 7.3 in), `.bpSheetHd`, `.bpSheetGrid`, `.bpSheetCell`, `.bpSheetH`, `.bpSheetNote`, and the sheet table sizes (8.5 pt).
- **Governing provision:** none changed.
- **Check case (display):**
  - **Pedestal 24 × 24 × 58, `pedbars`, closed ties:**
    - T1: #6 × 8, pedestal vertical bar 79.0 in (55 − (−24)), not counted. The table gives 0 of 8.
    - V1: #4 × 1, closed tie 19.50 × 19.50, 78.0 in (2·(2·9.75)·2), counted (set 3).
    - V2: #4 × 2, closed tie, not counted. The table gives 2 of 6 legs (set 3).
  - **4 × 2 anchors with U-stirrups and hairpins:**
    - T1: #5 × 4, U-stirrup 40.0 in (2·(34 − 16) + 4).
    - V1: #4 × 4, hairpin 30.3 in (2·12 + π·4/2).
    - Both not counted.
  - **One page:** the sheet printed alone to PDF (Letter, print media) is 1 page for all 5 test projects (default, pedestal, 4 × 2, −y shear, closed ties only).
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs`: all 5 built-in cases `same`, report included. The sheet is opt-in, so the default report is unchanged.
  - On the three graphics test projects, every result and the report are identical.
  - With the report option ticked, the report ends with "Appendix: Detail Sheet".
  - 0 page errors.
- **Open item:** for a design without reinforcement the sheet shows the input plan and both elevations. Those views are 900 px wide and have no compact version, so on the page their text is about 4 px. Options: a compact plan and elevations, or a full-width plan on the sheet.

## 2026-10-24 — HP-1: hairpins / shear bars are measured from the reference anchor row of the governing breakout case (Tier 2, calc change, MORE conservative where it changes)
- **Engineer request (2026-10-24):** approved after GFX-A showed the mismatch.
- **Problem.** In `shearRebarIntercept`, the hairpin / bar branch (not the closed-tie branch) used the leading row (`lead`) for two things:
  - the failure plane that the development "behind" is measured from;
  - the 0.5·c_a1 placement test.

  But `ca1` comes from the governing shear-breakout case. When Case 2 governs (Fig. R17.7.2.1b, the back row), the failure surface starts at the back row, c_a1 from the edge. So the leg length behind the leading row was credited as development behind a plane it may not even reach.
- **Where:** `shearRebarIntercept`, non-tie branch.
  - Anchor text before: `/* room behind the failure plane, inside the pedestal, less cover */`.
  - Anchor text after: `/* HP-1 (2026-10-24, engineer)`.
- **Before:**
  ```js
  const roomBehind=Math.max(0,(halfSpanN + lead) - cover);
  const extBehind=Math.max(R.extBehind||0,0);
  const availBehind=Math.min(extBehind, roomBehind);
  …
  L.dT=Math.min(...leadPts.map(p=>Math.abs(projT(p)-L.t)));
  ```
- **After** (the same reference row as the VT-1 tie branch):
  ```js
  const tolRef=0.05+0.02*Math.max(g.sx||1,g.sy||1,1);
  const uRef0H=halfSpanN-ca1;
  let refPtsH=pts.filter(p=>Math.abs(projN(p)-uRef0H)<tolRef), uRefH=uRef0H;
  const refIsLead=(!refPtsH.length || Math.abs(uRef0H-lead)<tolRef);
  if(refIsLead){ refPtsH=leadPts; uRefH=lead; }
  const roomBehind=Math.max(0,(halfSpanN + lead) - cover);
  const extBehind=Math.max(R.extBehind||0,0);
  const legLen=Math.min(extBehind, roomBehind);
  const legEnd=lead-legLen;
  const availBehind=refIsLead? legLen : (uRefH-legEnd);
  …
  L.dT=Math.min(...refPtsH.map(p=>Math.abs(projT(p)-L.t)));
  ```
- **What changes and what doesn't:**
  - The legs stay where they are detailed: they start at the leading row and wrap its anchors.
  - Development behind the plane is now the length of leg behind the reference plane. A leg that ends at or in front of the plane does not cross the failure surface and is not counted. Its reason reads "the leg ends … the failure plane through the reference row".
  - The lateral 0.5·c_a1 offset is measured to the reference-row anchors.
  - Edge-side anchorage is unchanged: the bend engaging the rod, or ℓ_d within c_a1 − cover.
  - `devDCR = reqBehind/availBehind` is unchanged in form; it is ∞ when availBehind ≤ 0.
  - New return fields: `uRef`, `refIsLead`, `refTs`, `legLen`, `legEnd`.
- **Show the work:** `shearRebarCheck`, step "Failure surface, proximity and development", gains lines when the reference row is not the leading row:
  - u_ref = h/2 − c_a1;
  - u_end = u_lead − min(ℓ_ext, room);
  - available behind = u_ref − u_end;
  - the lateral limit is measured to the reference-row anchors.
- **Drawings:**
  - Legs are drawn with their length `legLen`, from their own row: DXF, the hairpin plan, the shear section, the 3-D view, and the Detail Sheet schedule length. Before, they were drawn with `availBehind`.
  - The section draws the failure plane and wedge at `uRef`, and the "behind" dimension from the leg end to that plane. When the legs end in front of it, the section says so.
  - The hairpin plan draws the 0.5·c_a1 bands around the reference-row anchors, and the ≥ ℓ_d dimension from the reference plane.
- **Governing provision:**
  - ACI 318-19 §17.5.2.1(b) and R17.5.2.1(b): anchor reinforcement for shear must be developed on both sides of the breakout surface and placed close to the anchor.
  - §17.7.2.1 and Fig. R17.7.2.1b, Case 2: the failure surface is projected from the critical anchor row, with c_a1 measured from it.
- **Check case:** pedestal 30 × 30 × 36, plate 24 × 18, 4 × 2 anchors (x = −9, −3, 3, 9; y = ±6), #4 hairpins, 2 per leading anchor, depth 3, ext_behind 12, default combinations.
  - The governing shear combination is 0.9D+1.0W, V = 16.155 kip toward +x. Case 2 governs: the reference row is x = 3, c_a1 = 15 − 3 = 12. The leading row is x = 9.
  - **(a) As entered (bend not marked as engaging the rod):**
    - Before: available behind = min(12, 15 + 9 − 2 = 22) = 12 ≥ ℓ_d = 12. Every leg still fails on the edge side (10 < 12). 0 of 8, φV_r = 0, DCR ∞.
    - After: u_end = 9 − 12 = −3, available behind = 3 − (−3) = 6 < 12. 0 of 8, φV_r = 0, DCR ∞.
    - The shear breakout is unchanged: Condition B, φ = 0.70, φV_cbg = 11.732 kip, DCR 1.377.
  - **(b) Same design with the bend engaging the rod:**
    - Before: 4 of 8 legs (the other 4 clash, §25.2.1). φV_r = 0.75 × 4 × 0.20 × 60 = 36.0 kip, DCR = 16.155/36.0 = 0.449. The intercept passes, so Condition A applies: φ = 0.75, φV_cbg = 12.570 kip, Concrete Breakout (V) DCR 1.285, interaction 1.563.
    - After: available behind 6 < 12, so 0 of 8, φV_r = 0, DCR ∞. Condition B: φ = 0.70, φV_cbg = 11.732 kip (= 12.570 × 0.70/0.75), Concrete Breakout (V) DCR 1.377, interaction 1.748.
  - **(c) As (b) with ext_behind = 18:** the legs end at 9 − 18 = −9, available behind = 3 + 9 = 12 ≥ 12. 4 of 8, φV_r = 36.0, DCR 0.449, unchanged from before.
  - **(d) Default project with hairpins and the bend engaging:** 2 × 2 at ±6, pedestal 30, Case 2, c_a1 = 21 from x = −6.
    - Before: 4 of 8, φV_r 36.0, DCR 0.449; Condition A, φV_cbg 15.371, Concrete Breakout (V) DCR 1.051.
    - After: the legs (6 → −6) end exactly at the reference plane: 0 of 8, DCR ∞. Condition B, φV_cbg 14.346, Concrete Breakout (V) DCR 1.126.
- **Regression:**
  - `node tests/bpad-profis.mjs`: all 5 built-in cases `same`, report included. None of them has shear reinforcement.
  - On the three graphics test projects, everything is identical except the shear intercept of the 4 × 2 project (case (a) above; nothing downstream changes).
  - A sweep of 112 hairpin / bar designs (7 anchor grids × 4 pedestals × 4 load sets; hairpin and bar; per anchor and group; bend engaging on and off; hooked end; ext 12/18/30; welded plate), origin/main vs this branch:
    - every one of the 54 designs whose reference row is the leading row (Cases 1 and 3, single row) gives identical intercept, check, capacities and `allChecks`;
    - all 58 Case 2 designs change in `availBehind`; some also in n_eff, DCR and Condition A, as above.
- **Open items:**
  - The reference-row search uses `halfSpanN − ca1` in the plate frame without the plate offset, exactly as the VT-1 tie branch does. With a plate offset it misses the row and falls back to the leading row, which is the old behaviour for hairpins. The same applies when c_a1 is limited by §17.7.2.1.2. Both branches would need the offset-aware row (as `shearBodyGeom` finds it for the drawings) to fix this; that needs a decision.
  - Edge-side anchorage (c) is still checked from the leading row with c_a1 − cover, as instructed.

## 2026-10-24 — GFX-F: Detail Sheet without reinforcement — full-width plan and compact elevations at print size (display only, no calculation change)
- **Engineer request (2026-10-24):** this is the GFX-D open item.
  - With no reinforcement, the sheet used the input-tab drawings (`drawPlan`, `drawElevation`). They are 900 px wide, so on the page their text printed at about 4 px.
  - The request: put the plan across the full width with the elevations below it, so the text prints at 9 px or more.
- **New functions,** placed before `bpRebarSchedule`:
  - `drawSheetPlan(body)`, 700 × 320. It draws:
    - pedestal, plate, column footprint and the numbered anchors;
    - the `bpPlanDims` chains: c_a to each face from `anchorGeom()` (plate offset and override included), anchor spacings, and plate B / N;
    - By and Bx;
    - the column name.
  - `drawSheetElev(body, view)`, 348 × 270. It draws:
    - pedestal, grout, plate (above an open stand-off gap when there is one), and a column stub with the column width in that view;
    - the anchors to the head at H − h_ef;
    - H, h_ef, t_p, the grout thickness, and Bx or By.
  - Both are drawn at the size they print: the full page width (7.3 in = 700 px) and half of it. No text is below 9 px.
- **`buildDetailTab`, branch with no reinforcement.**
  - Before:
    ```js
    drawPlan(cell()); drawElevation(cell(),"x"); drawElevation(cell(),"y");
    ```
  - After:
    ```js
    const cp=cell(); cp.style.gridColumn="1 / span 2"; drawSheetPlan(cp);
    drawSheetElev(cell(),"y"); drawSheetElev(cell(),"x");
    ```
  - The schedule cell spans both columns. When there is no reinforcement, the schedule is one line: "Rebar schedule: no reinforcement entered."
- **Unchanged:** the input-tab drawings and the sheets with reinforcement.
- **Governing provision:** none.
- **Check case:** the default project (no reinforcement).
  - The sheet prints on one page.
  - Plan: c_a = 9.00 to every face, s = 12.00 both ways, plate 18 × 18, Bx = By = 30.
  - Elevations: H = 36.00, h_ef = 12.00, t_p = 1.50, grout 1.00.
- **Verification:**
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
  - `node tests/bpad-profis.mjs`: all 5 built-in cases are `same`, report included.
  - On the three graphics test projects, every result and the report are identical.
  - The sheet printed alone to PDF (Letter, print media) is 1 page for all 5 test projects: default, pedestal, 4 × 2, −y shear, closed ties only.
  - 0 page errors.

## 2026-10-24 — UI-1: "7a. Pedestal Reinforcement" moved from the Distribution input tab to the Reinforcement tab (display only)
- **Problem:** PR-1 added the input section `inPed` but did not add it to `BPAD_IN_SEC`. Unmapped sections stay with the section before them, so it appeared under Distribution.
- **Anchor text:** `inTRebar:'reinf',inVRebar:'reinf',`
- **Before:**
  ```js
  inTRebar:'reinf',inVRebar:'reinf',
  ```
- **After:**
  ```js
  inPed:'reinf',inTRebar:'reinf',inVRebar:'reinf',
  ```
- **Governing provision:** none (layout).
- **Check:** in the headless page, the Distribution pane holds `inShear,inForceModel` and the Reinforcement pane holds `inPed,inTRebar,inVRebar`. No result changes.

## 2026-10-24 — T3D-1: 3-D view orbits and zooms on touch screens (display only)
- **Engineer report (2026-10-24):** on a tablet the 3-D view would not orbit.
- **Cause:** the view listened only to `mousedown`/`mousemove`/`mouseup` and `wheel`. Touch input does not produce those as drags, and the page scrolled instead.
- **Anchor text:** `renderer.domElement.addEventListener("mousedown",e=>{drag=true;lx=e.clientX;ly=e.clientY;});`
- **Before:** mouse-only listeners (mousedown / window mouseup / mousemove) plus wheel.
- **After:**
  - Pointer events (`pointerdown`/`pointermove`/`pointerup`/`pointercancel`/`pointerleave`) with pointer capture, covering mouse, touch and pen.
  - One pointer orbits, at the same rate (0.01 rad/px). Two pointers pinch-zoom: `dist = dist0 · pinch0 / pinch`.
  - `touch-action:none` on the canvas.
  - The wheel zoom is unchanged.
- **Governing provision:** none (UI).
- **Check:** headless Chromium with `hasTouch` and CDP touch events.
  - A one-finger drag moved the camera from (84.71, 134.08, −18.56) to (5.66, 160.82, −43.32).
  - A two-finger spread zoomed the camera distance from 166.6 to 81.0.
  - Mouse drag still orbits.
  - 0 page errors. `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.

## 2026-10-24 — CAM-1: the 3-D camera keeps its position when an input changes (display only)
- **Engineer report (2026-10-24):** every input change reset the 3-D camera.
- **Cause:** each input change rebuilds the 3-D view. `build3D` called `fit()`, and the Visuals tab then called `three3D.fit()` again 80 ms later. Both re-framed the default isometric view.
- **After:**
  - `place()` stores the camera in the session variable `bpad3dView` (orbit angles, distance, target). It is not saved data.
  - On a rebuild, `build3D` restores that camera instead of calling `fit()`, and the Visuals tab calls `three3D.fit()` only on the first build.
  - "Fit view" still resets the camera to the isometric view and re-frames it.
- **Anchor text:** `fit:()=>{ rot.x=Math.PI/6; rot.y=Math.PI/4; fit(); }};` and `if(three3D.fit) three3D.fit(); } },80);`
- **Governing provision:** none (UI).
- **Check:** headless, with a touch orbit and pinch.
  - Camera (1.10, 79.72, −14.33) before an input edit; (1.10, 79.72, −14.33) after it, unchanged.
  - Fit view → (78.03, 103.86, 79.38), the default framing.
  - 0 page errors. `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.

## 2026-10-24 — VR-1: every geometric property of the shear reinforcement enterable; automatic values stay the defaults (Tier 2, new inputs; default results unchanged)
- **Engineer request (2026-10-24):** "The shear rebar is not allowing some input. I thought I would be able to define all the geometry." The app still decides eligibility.
- **Saved data (§5, all additive; the defaults reproduce the automatic layout, so no migration is needed):**
  - `S.vRebar.edgeSel` = "auto": the face the legs are detailed toward ("+x" / "-x" / "+y" / "-y").
  - `S.vRebar.setOut` = 0: plan set-out of the bend (leg start) from the anchor row, + toward the edge.
  - `S.vRebar.lenMode` = "ext": "ext" = `extBehind` behind the leading anchor row (as before); "total" = `legTotal`.
  - `S.vRebar.legTotal` = 0: the total straight leg length from the bend. Choosing "total" prefills extBehind + setOut.
  - `S.vRebar.gaugeOverride` = false, `gaugeGrp` = 0: the group-hairpin gauge override.
  - `S.vRebar.tOffsetHp` = 0: the group-hairpin run offset along the edge. This is a new field; it is not `tOffset`, so saves with a group-bar offset are unaffected.
  - `S.vRebar.vDepths` = "": custom depths of stacked group hairpins (comma list, top down).
  - `S.ped.tieGrade` = null: the pedestal tie grade. null means the grade used before VR-1, i.e. the Shear Rebar grade, so every existing save keeps its f_y.
- **`shearRebarIntercept`, hairpin / bar branch.** Anchor text: `/* VR-1: hairpins / bars may be detailed toward a chosen face`.
  - **Leg edge.** `nx, ny` come from the chosen face (`legEdge`), else the governing edge. `bodyNx, bodyNy` stay the governing edge; `shearBodyGeom` now uses them.
  - **Chosen face ≠ the governing edge** (`wrongEdge`). The reference row is not searched, and every leg is "not counted". The reason reads: "detailed toward the +y face; the governing shear breakout is toward the +x edge, so the leg does not cross its failure surface (not counted)". Counter `nWrongEdge`. The input panel shows the same in a red box.
  - **Leg position and length.**
    ```js
    legStart = lead + setOut;
    extBehind = (lenMode==="total") ? max(legTotal − setOut, 0) : max(R.extBehind, 0);
    ```
    `legLen = min(extBehind, roomBehind)` and `legEnd = lead − legLen` are unchanged. HP-1's "available behind" (u_ref − u_end) is unchanged.
  - **Set-out behind the plane.** A negative set-out that puts the leg start behind the failure plane means the leg does not cross it. It is not counted (counter `nNoCross`); this test only runs for setOut < 0.
  - **Group hairpin:**
    - gauge = `max(gaugeGrp, d_b)` when overridden, else the automatic gauge as before;
    - legs at `cTgrp + tOffsetHp ± gauge/2`;
    - stacked depths from `vDepths` where given, else depth + k·vSpacing.
  - **New return fields:** `legStart`, `setOut`, `lenMode`, `legTotal` (start → end), `wrongEdge`, `legEdge`, `bodyNx`, `bodyNy`, `nWrongEdge`, `nNoCross`, `gaugeOverride`, `tOffsetHp`.
- **Closed tie with `S.ped`.**
  - The Rt object adds `grade: S.ped.tieGrade||R.grade` (used in ℓ_dh).
  - `shearRebarCheck`: `fy = rgrade(isTie && usePed && S.ped.tieGrade ? S.ped.tieGrade : R.grade).fy`.
- **Inputs (`buildInputPanel`, shear reinforcement):**
  - **Closed tie with `S.ped`.** Before: a note, plus Piece type and Grade. After: tie size, tie grade, sets, top depth, spacing and cover, inline. They write to `S.ped`, with a note that they are shared with 7a. The Shear Rebar "Grade" row is hidden.
  - **Group hairpin.**
    - The vertical spacing is always shown (before: only when the stack is > 1).
    - New: custom stacked depths (text), a gauge override (checkbox + value; the note gives both the entered and the automatic gauge), and a run offset.
  - **All hairpin and bar types.** New:
    - "Detail the legs toward" (auto / face);
    - "Set-out of the bend from the anchor row";
    - "Leg length given as" (extension / total), with the field for the chosen definition and a note giving the derived values: start, length behind the row, total, and the part behind the failure plane.

    The old label "Leg extension behind the failure plane" now reads "Leg extension behind the leading anchor row". That is what it always measured; since HP-1 the failure plane can be the back row.
- **Drawings use the new geometry.** Legs run from `legStart` to `legEnd` in:
  - DXF (`bpExportDxf`);
  - the hairpin plan (legs and bends);
  - the shear section A-A;
  - the 3-D view (legs and bends);
  - the Detail Sheet schedule length (start → end).

  The breakout body is drawn for the governing edge (`bodyNx`/`bodyNy`). When the legs are detailed toward another face, the hairpin plan and section A-A carry a red line, and section B-B (the governing face) says the legs do not cross it.
- **Superseded by VR-2 (2026-10-24):** the inline tie inputs in the shear section (and the VT-1 tie inputs in `S.vRebar`) duplicated 7a, so the ties could be defined in two places. VR-2 makes 7a the only place: the shear section shows a read-only summary and an "Edit in Pedestal Reinforcement" button, the Tie grade input moved to 7a, and the closed-tie check reads `S.ped` only. See the VR-2 entry below.
- **Not done:** the optional "per-anchor custom" mode (tick which anchors get hairpins). Done cleanly it needs a per-anchor list in the saved data, keyed to anchor numbers that change when the grid changes; left for a decision.
- **Governing provision:** none changed. Eligibility is still decided by §17.5.2.1(b), R17.5.2.1(b) and HP-1.
- **Check case (new inputs).** Pedestal 36 × 36 × 36, default 2 × 2 anchors (±6), V = 15 kip toward +x; Case 2, so the reference row is x = −6 and c_a1 = 24.
  - **Group hairpin**, gauge 10 entered, offset 2, 2 stacked, depths "3, 8": legs at t = 2 ± 5 = −3 / 7 and z = 3 / 8.
  - **Per-anchor**, total 20, set-out +1:
    - start 6 + 1 = 7;
    - behind the row 20 − 1 = 19 (room 18 + 6 − 2 = 22), so the end is 6 − 19 = −13;
    - behind the failure plane −6 − (−13) = 7 < ℓ_d 12, so not counted.
  - **Toward +y:** 0 of 8, with the wrong-edge reason.
  - **Closed ties (24 × 24 × 58 pedestal, #4 pedestal ties):**
    - tie grade null: f_y 60, 2 legs, φV_r 18.0;
    - tie grade 75: f_y 75; ℓ_dh grows, so 0 legs. Each change follows from the input.
- **Regression (defaults):**
  - `node tests/bpad-profis.mjs`: all 5 built-in cases `same`, report included.
  - Test projects, origin/main vs this branch: `computeAll`, capacities, `allChecks`, `VALIDATION`, both intercepts (new fields excluded) and the report are identical for:
    - the default project;
    - the pedestal + `pedbars` + closed-tie project;
    - the 4 × 2 U-stirrup / hairpin project;
    - a group-hairpin project (2 stacked, engaging, ext 30);
    - a closed-tie project without `S.ped`.
  - The HP-1 sweep of 112 hairpin / bar designs: 112 of 112 identical.
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes. 0 page errors.

## 2026-10-24 — VR-2: pedestal ties defined in one place only (7a); closed-tie shear reads S.ped only; migration of older closed-tie saves (Tier 2, input source change; saved results unchanged)
- **Engineer request (2026-10-24):** "Now it seems I can define the ties in the pedestal in two places … How can we avoid this duplication?" The ties are defined only in **7a. Pedestal Reinforcement**.
- **Saved data (§5).**
  - New field `S.ped.barsUnconfirmed` = false (additive).
  - **Migration in `mergeState`** (anchor text `/* VR-2 migration (2026-10-24)`). Applies only to saves made before VR-2, recognised by `st.ped` having no `barsUnconfirmed` key (every later save has it):
    ```js
    if(preVR2 && sv && sv.pieceType==="closedtie"){
      if(!(sp&&sp.present)){
        out.ped.tieSize=out.vRebar.size; out.ped.tieSets=out.vRebar.tieSets; out.ped.tieTop=out.vRebar.tieTop; out.ped.tieSpacing=out.vRebar.tieSpacing;
        out.ped.cover=(sv.cover!==undefined)? sv.cover : 2.0;   // the check used 2.0 when no cover was saved
        out.ped.present=true; out.ped.barsUnconfirmed=true;
      }
      if(out.ped.tieGrade==null) out.ped.tieGrade=out.vRebar.grade;   // VR-1: null meant the Shear Rebar grade
    }
    ```
    The old `S.vRebar` tie fields (`size`, `tieSets`, `tieTop`, `tieSpacing`, `cover`) stay in the save, unused by closed ties.
  - **While `barsUnconfirmed`:** red box in 7a and on the Summary: "Pedestal ties were moved here from Shear Reinforcement; the longitudinal bars are defaults — confirm them." Editing any bar field (size, bars per face x / y, grade, top, into footing, extension) or the button "The bars are as shown — confirm" clears it. Until then:
    - `pedTieCheck()` returns `{na:true, unconfirmed:true}` (the §10.7.6.1.6 check is not made, exactly as before migration when no pedestal reinforcement was entered);
    - `tRebarEff()` does not use the pedestal bars as tension anchor reinforcement (as before migration);
    - the rebar schedule marks the pedestal bars "defaults, to confirm in 7a".
- **`shearRebarIntercept`, closed-tie branch.** Anchor text `/* PR-1: the ties ARE the pedestal ties. VR-2`.
  - Before:
    ```js
    const usePed=!!(S.ped&&S.ped.present);
    const Rt=usePed? Object.assign({},R,{size:S.ped.tieSize, cover:S.ped.cover, tieSets:S.ped.tieSets, tieTop:S.ped.tieTop, tieSpacing:S.ped.tieSpacing,
      grade:S.ped.tieGrade||R.grade}) : R;
    const devT=usePed? tensionDevLengths(Object.assign({},Rt,{cover:coverT})) : dev, rbT=rebarOf(Rt.size);
    ```
  - After:
    ```js
    const P=S.ped||{}, usePed=!!P.present;
    const Rt=Object.assign({},R,{size:P.tieSize, cover:P.cover, tieSets:P.tieSets, tieTop:P.tieTop, tieSpacing:P.tieSpacing,
      grade:P.tieGrade||P.grade});
    const devT=tensionDevLengths(Object.assign({},Rt,{cover:coverT})), rbT=rebarOf(Rt.size);
    ...
    if(!usePed){ L.eff=false; L.why="pedestal ties not entered (7a. Pedestal Reinforcement): no leg is counted"; }
    ```
    and the development pool is empty when `!usePed` (`devDCR` = ∞). New return field `notEntered`.
  - Epoxy, K_tr and the hook factors of the ties still come from `S.vRebar` (they have no 7a input; the "Epoxy-coated" row stays in the shear section for ties).
- **`shearRebarCheck`.** Before: `fy = rgrade(isTie && usePed && S.ped.tieGrade ? S.ped.tieGrade : R.grade).fy`. After: `fy = rgrade(isTie ? (S.ped.tieGrade||S.ped.grade) : R.grade).fy`.
- **Behaviour change, called out (§4):** a closed-tie design with no pedestal reinforcement entered, built in the session (or saved after VR-2), now counts **no** tie leg (φV_r = 0, DCR ∞; the concrete breakout check stays) instead of using the `S.vRebar` tie fields. No existing save changes: those are migrated as above. Governing provision unchanged: ACI 318-19 §17.5.2.1(b), R17.5.2.1(b) (closed ties as shear anchor reinforcement), §10.7.6.1.6.
- **Inputs.**
  - Shear section (9), piece type closed ties: no tie inputs and no Bar size / Grade rows. A read-only line, e.g. "Pedestal ties (from 7a. Pedestal Reinforcement): #4 ties (Gr. 60), 3 sets from 2.25″ at 3.00″, cover 2.00″", and a button "Edit in Pedestal Reinforcement ↗" (`bpadGoInSec("inPed")`: switches the input tab, expands 7a, scrolls to it). With 7a not entered: red box "No pedestal ties entered. No tie leg is counted …" and the button "Enter pedestal ties in 7a ↗".
  - Tension section (8), piece type pedestal vertical bars: the same read-only summary of the bars + button (the hooked-top and epoxy rows stay; they are not 7a fields).
  - 7a: new "Tie grade" row (moved from section 9; null shows the bar grade).
  - Report input summary: closed ties without 7a read "pedestal ties not entered: none counted".
- **Check case (migration), a project saved on main at b270d90 (before VR-1):** pedestal 24 × 24 × 58, h_ef 18, default 2 × 2 anchors, shear rebar closed ties #4 Gr. 40, 3 sets from 2.25″ at 3″, cover 2″, U-stirrups for tension.
  - Before (old version): 6 legs counted, φV_r = 0.75 · 6 · 0.20 · 40 = 36.0 kip, DCR 0.449.
  - After loading in this version: S.ped = #4, 3 sets, 2.25, 3.0, cover 2.0, tie grade Gr. 40, present, bars unconfirmed; 6 legs, φV_r 36.0 kip, DCR 0.449. Identical.
- **Regression.**
  - Six projects saved on main at b270d90 (closed ties #4 Gr. 60 with no cover saved; #5 Gr. 40 4 sets cover 1.5 epoxy; 4 × 2 anchors #3 cover 3; #4 Gr. 40 with U-stirrups; S.ped entered + closed ties + Shear Rebar Gr. 40 and no tie grade; a hairpin project) were loaded in this version through the tool's start-up path (autosave). `computeAll`, capacities, `allChecks`, `VALIDATION`, both intercepts, `shearRebarCheck` and the printed report are identical for all six.
  - `node tests/bpad-profis.mjs`: 5 of 5 `same`.
  - Test projects vs origin/main: default, pedestal + pedbars + closed ties, 4 × 2 U-stirrup / hairpin, group hairpin identical. The closed-tie project built from fresh defaults without S.ped changes as called out above (DCR 0.90 → ∞).
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes; 0 page errors.

## 2026-10-24 — GFX-G: movable section cuts — A-A and B-B at any position, dragged on the plans (mouse and touch), sections show what the cut passes through; DXF uses the cuts (display / export only, no calculation change)
- **Engineer request (2026-10-24):** "The detail sheet has section cuts. These should be dynamic and let the user move the section cut. The cuts should be shown on the plan view as well."
- **Saved data (§5):** `S.ui.secCut = {A, B}` is kept (GFX-B). A = y of Section A-A (along x), B = x of Section B-B (along y), rebar-view frame, or "all" (projected). GFX-B stored "all" or an anchor-row coordinate; both read unchanged as positions, so no conversion is needed. New values are rounded to 0.01 in.
- **Helpers** (anchor text `/* ---- GFX-G (2026-10-24): movable section cuts`, before `drawRebar`):
  - `bpCutOf(key)`: the cut position or null ("all"). The old `rows` snap argument is ignored.
  - `bpCutState(v,cut,tol,sg)`: "cut" (|v − cut| ≤ tol), "beyond" (on the far side for a viewer looking toward sg) or "front" (removed).
  - `bpCutExtent`, `bpSetCut`, `bpCutSection(body,draw)` (a section container that redraws itself), `bpCutsLive()` (one requestAnimationFrame redraw of every section, cut line and cut input), `bpPlanCutLines(s,map)` (draggable lines), `bpCutControls(body)` (slider, number field, "all (projected)" and one snap button per anchor row; not drawn when printing).
- **Cut lines on the plans:** the Detail Sheet plan, the Tension Rebar plan (`drawRebarPlan`, the GFX-B static markers removed) and the Shear Rebar plan (`drawHairpinPlan`, plate offset included). Dash-dot purple line, circled A / B at both ends and view arrows (A-A looks +y, B-B looks −x). Dragging uses pointer events with pointer capture (mouse, pen and touch; `touch-action:none` on the 16 px hit line), snaps to an anchor row within 6 px, redraws the sections live, and saves and refreshes on release. Projected cuts are drawn faded at 0.
- **Sections (what the cut passes through; beyond at 0.25 opacity; in front removed):**
  - Tension A-A / B-B (`drawRebar` "tension"): anchors (tol d/2 + 0.05), tension legs (tol d_b/2 + 0.05), pedestal ties and bars by state; breakout surface as its true profile in the cut plane (z = z_head + d_s/1.5, GFX-B).
  - Shear along V (`drawRebar` "shear"): cut along the edge (A for a ±x edge, B for a ±y edge); anchors, tie legs and hairpin legs by state; the breakout body in the cut plane (`bodyAt`: side faces splay 1:1.5 from the reference row, so at lateral offset d_T it starts d_T/1.5 in front of the row). Title shows the cut.
  - Edge-face section (`drawShearFace`): cut along the shear normal (the other letter); breakout body at the cut, d = u_cut − u_ref, width tMax − tMin + 3d and depth 1.5d; anchors and legs by state. The section letter follows the cut (B-B for a ±x edge, A-A for a ±y edge).
- **Tabs:** Tension Rebar, Shear Rebar and the Detail Sheet all use the same two cuts, with the controls above the sections (Detail Sheet: above the sheet; not printed). The printed Detail Sheet and the printed report draw the current cuts.
- **DXF (`bpExportDxf`):** new layers `BP-SECTION` (colour 6, CENTER: cut lines with A / B and view arrows on the plan) and `BP-SECTION-BEYOND` (colour 8: anchors, bars and ties beyond the cut). The DXF section is A-A: at y = cut when set (items in front left out, breakout surface as the true profile), projected otherwise. The notes list both cuts.
- **Governing provision:** none; display and export only.
- **Check case:** 32 × 32 × 48 pedestal, 4 × 2 anchors at x = ±3, ±9 and y = ±9, cut A at y = 4.24″: the A-A section shows no anchor in the plane (rows at ±9 are 4.76″ away), the y = +9 row beyond (lighter), the y = −9 row removed; the breakout profile at y = 4.24 is the projected profile (inside the group hull). Dragging B to within 6 px of x = 9 snaps to 9.00.
- **Tests:**
  - Mouse drag (Playwright mouse) and touch drag (CDP touch events in a touch context → pointer events) of both lines on the Detail Sheet, Tension Rebar and Shear Rebar plans: `S.ui.secCut` follows during the drag, the section titles change before release (live), the value is saved on release. 6 of 6 tabs × modes OK, 0 page errors.
  - DXF: BP-SECTION and BP-SECTION-BEYOND present; section titled "SECTION A-A at y = 4.24 in".
  - Detail Sheet printed to PDF with cuts A = 3, B = −3 for five projects: 1 page each.
  - `node tests/bpad-profis.mjs`: 5 of 5 `same`. Test projects vs origin/main (default, pedestal + pedbars + closed ties, 4 × 2 U-stirrup / hairpin, group hairpin, closed ties without S.ped): computeAll, capacities, checks, validation, intercepts and report identical.
  - `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.

## 2026-10-24 — RPT-1: report and display corrections from a printed project (closed-tie wording and references, raw TeX, clipped labels, combination statements, links) (display / report only; no result changes)
- **Source:** the engineer printed a real project's report; the coordinator listed the defects. Test project (the engineer's, "W"): pedestal 32 × 32 × 48, f′c 5, plate 24 × 24 × 1.75, W12X65, 4 × 2 anchors 1.25″ F1554 Gr. 55 at 6 / 18, h_ef 14, 2″ grout; combos 1.2D+1.6L (P −120, Vx 8, My 240 kip-in), 1.2D+1.0W (P −70, Vx 15, Vy 6, Mx 180, My 300), 0.9D+1.0W (P −40, Vx 15, Vy 6, Mx 420, My 300); S.ped 20-#8 (6 × 6), #4 ties 3 sets from 2.0 at 3.0; 4-#6 U-stirrups enclosing; closed ties with the four acknowledgements ticked.
- **1. Summary.** The "Shear hairpins: only N of M claimed legs are effective … Condition A still applied" box is shown only when the §17.5.2.1 substitution is NOT justified (`if(S.vRebar.present && !rebarJustified("shear",CC).justified)`); the green "breakout (shear) not checked" note already lists the uncounted legs. For ties it reads "Shear closed ties" and cites §17.5.2.1(b), R17.5.2.1(b). The Concrete Embedment note "replaced by the hairpin steel check" reads "closed-tie steel check (§17.5.2.1(b))" for ties.
- **2. Shear Rebar section, closed ties:**
  - card titles "1. Closed-Tie Shear Reinforcement", "2. Closed-Tie Layout" (hairpins unchanged); `BPAD_CARDS.vrCap` is a getter returning the same title;
  - step title "Anchor reinforcement — shear (closed ties)"; reference before `ACI 318-19 §17.5.2.1.2`, after `ACI 318-19 §17.5.2.1(b), R17.5.2.1(b)` (ties only);
  - `allChecks` ref for "Anchor Reinf. Shear (ties)": before `§17.5.2.1.2`, after `§17.5.2.1(b)` — this is the Results line, the Summary chip and table;
  - "Why only N of M legs" (`ineffCauseBanner`) has a tie branch naming the failed criterion: "4 legs are in tie sets 2, 3, deeper than 0.5·c_a1 = 3.50″ below the top surface (R17.5.2.1(b)). Fix: move the top sets up / tighten the tie spacing …"; crossing beyond the front corner; ℓ_dh behind; ties not entered (VR-2);
  - 8.2 intro text is tie-specific; "Section through the anchor" → "Section along V"; the hairpin design-detail figure is not shown for ties (it illustrates hairpins); "Click any tie leg".
  - **Code-reference change (§4 callout):** governing provision for closed ties as shear anchor reinforcement, ACI 318-19 §17.5.2.1(b) with commentary R17.5.2.1(b) and Fig. R17.5.2.1b (unchanged edition). Check case W: D/C = V_ua / φV_r = 16.16 / 18.00 = 0.90 before and after; only the cited article changes.
- **3. Raw TeX in plain text.**
  - `shearRebarCheck` vars: "pieces = 3 closed tie sets × 2 legs parallel to V = 6 legs" (was `3\text{ closed tie sets} \times 2\text{ legs parallel to }V`); hairpin/bar pieces likewise; n_eff description "0.5·c_a1"; tension n_eff description "1.5·h_ef"; d_T now shows the governing counted leg's value ("4.75 in (governing counted leg)", was "d_T = in").
  - New `bpPlainTex()` applied in `eqBlock` to a step's reference and every variable's value and description (\text{}, \ge, \le, \Rightarrow, \times, \cdot, \phi, \psi, \ell, \infty, _{…}, ^{…}). Fixed by it: "\psi_{ec,N}", "\phi per Table 17.5.3", "h_{ef} \ge 2.5 in \Rightarrow k_{cp}", "K_{tr}".
  - Open stand-off elastic bolt-group equations (Anchor Bolts tab): the three lines had single backslashes ("\frac" became a form feed + "rac", "\times" a tab), so KaTeX printed them raw; backslashes doubled. Same expressions.
  - Scan: every output tab on screen for three projects (default, W, a group-hairpin project) and the printed report: no text outside KaTeX contains TeX.
- **4. Clipping.** The "governing counted leg" worked line is split in two (x_c; edge side and behind ≥ ℓ_dh). The closed-tie plan legend is two lines. `axisTriad(…, noteAbove)` puts "origin @ plate ¢" beside the x axis; the tension and shear plans place the triad top-left (it was cut off at the bottom / overlapped the caption).
- **5. Labels.** Tension section: "flat at the head plane across the anchors" sits at the head plane on a white ground (it was at the pedestal bottom). Shear section along V: triad bottom-left (it overlapped "0.5·c_a1 = 3.50″ below the top"). "top set 2.25″" and the caption "3 sets at 3.00″, top set 2.25″" use 2 decimals (were 2.3″ / 3.0″).
- **6. Combinations.**
  - The closed-tie / hairpin plan shows the combination that governs the shear check (`bpShearGovCombo()`: largest V_res, as `shearRebarIntercept`), was the overall governing one (0.9D+1.0W vs the check's 1.2D+1.0W).
  - Titles state the combination: tension plan and sections (tension intercept's combination), shear section along V and edge-face section (shear intercept's).
  - Printed report: the non-per-combination sections (Summary, rebar tabs, …) use the governing combination for table 2.2 unless the engineer picked a detail combination on screen (new `S.ui.detailComboSet`, set by the selector, cleared when combinations are regenerated; additive). Table 2.2 heading: "(governing overall)" or "(detail combination selected by the engineer; governing overall: …)".
- **7. Links.** `bpadCardFor`: "Pedestal Ties at Anchors" → card coPedTie ("see §5.8"); "Anchor Reinf. Shear (ties)" → vrCap (it linked to the tension card, "see §7.1"; now "see §8.1").
- **8. Small items.** Input summary: "#4 ties: 3 sets from 2.25″ (raised to cover + d_b/2; entered 2.00″)". Table 2.2 note when no anchor carries tension: "no anchor carries tension in this combination … computed on n = 4 anchors …". References: before "AISC 360 … edition: verify", after "AISC 360-16 … §J3.10 (Eq. J3-6a/J3-6c), §E3" (§4 callout: the tool's φR_n = φ·min(1.2 l_c t F_u, 2.4 d t F_u) is 360-16 J3-6c / J3-6a; no value changes — W: 0.75 · min(1.2·1.97·1.75·58, 2.4·1.25·1.75·58) = 179.85 kip both).
- Print CSS: `#printReport h3{break-after:avoid}` (a figure heading stays with its figure).
- **Regression.** `node tests/bpad-profis.mjs`: every computed result identical; only `.report` differs, by the AISC 360-16 reference row (5 cases, 2 lines each). Test projects vs origin/main (default, pedestal + pedbars + closed ties, 4 × 2 U-stirrup / hairpin, group hairpin, closed ties without S.ped): computeAll, capacities, checks (except the closed-tie `ref` text), validation, intercepts identical. W report printed to PDF (49 pages) and its text diffed against main: only the corrected text listed above. `node tests/check-syntax.mjs` passes; 0 page errors.

## 2026-10-24 — LAY-1: one scroll per column — the page no longer scrolls; input and output columns scroll on their own; narrow screens stack (display only)
- **Engineer request (2026-10-24):** "The input window should be able to scroll, and so should the output, but not the whole app. There are too many scroll options right now."
- **Audit before (headless, project W):**
  - Desktop 1500 × 1000 and tablet landscape 1180 × 820: `#inputPanel` and `#outputPanel` scroll vertically, as intended, **and the page itself scrolls** on the Shear Rebar tab (scroll height 1123 / 1000; 1169 / 820). The cause: absolutely positioned content inside the columns (KaTeX's hidden MathML spans, the SVG zoom-tool bars `.svgTools`) had no positioned ancestor, so its containing block was the page and it sized the document.
  - Tablet portrait 820 × 1180: the same, plus a 33 % input column 270 px wide, wide tables and `.eqLine` boxes scrolling horizontally.
  - No section, card or table had its own vertical scrolling (`max-height` is only on `.modalBox`, a dialog).
- **CSS (anchor `/* LAY-1 (2026-10-24)`):**
  - `#app{height:100vh;height:100dvh}`; `html,body{overflow:hidden}`.
  - `#inputPanel`, `#outputPanel`: `position:relative` (the containing block for that absolute content), `overscroll-behavior:contain`, `-webkit-overflow-scrolling:touch`; `#outputPanel{min-width:0}`.
  - `@media screen and (max-width:899.98px)`: the columns stack (`#main{flex-direction:column}`), neither scrolls on its own (`overflow:visible`), `html,body` scroll as one page, `#app{height:auto}`. Breakpoint 900 px: tablet landscape (1180) keeps two columns; portrait (820) and phones stack.
  - Print CSS unchanged; it already releases `html,body` and `#app` (`height:auto; overflow:visible !important`), and the screen-only media query does not apply to print.
- **Kept:** the output tab bar (`#tabBar`, sticky at the top of the output column), the input tab bar, remembered input sub-tab and the column scroll positions across refreshes (`ipTop` / `opTop`), the 3-D view, the draggable section cuts (GFX-G drag test re-run, mouse and touch 6 / 6 OK), the print report.
- **Verify (after):**
  - Every output tab at 1500 × 1000 and 1180 × 820: `document.scrollingElement.scrollHeight` = the viewport height (1000 / 1000, 820 / 820); the only vertical scrolling elements are `#inputPanel` and `#outputPanel`. One `.eqLine` (a long equation on the Anchor Bolts tab at 1180) scrolls horizontally in its own box.
  - 820 × 1180: no element scrolls; the page scrolls as one.
  - Programmatic scroll: desktop input 0 → 134 (its end), output 0 → 1200, page stays 0; the header and output tab bar do not move. Tablet landscape: input 300, output 1200, page 0.
  - Report printed to PDF (W project): 49 pages, as before the change.
  - `node tests/bpad-profis.mjs` 5 / 5 `same`; `node tests/check-syntax.mjs` passes; 0 page errors.

## 2026-10-24 — RPT-2: the calculation report reads like Gusset Plate Rating's; Report output tab (same builder as Print / PDF) (display / report only)
- **Engineer:** the report "doesn't look like the Gusset plate app's report" (the D11 standard) and "was also supposed to be part of the app's output", not PDF-only.
- **Template:** `Gusset Plate Rating.html`, default project, printed headless (56 pages): cover; references + table of contents; "n. TITLE:" underlined section heads; "n.k. Title:" sub-heads; each worked item as a title with its reference in italics on the left and the equations (symbolic, substituted, result) on the right, then a "where" table (symbol, description, value); a result line with D/C and PASS/FAIL; Times, black, plain ruled tables with grey heads; figure captions.
- **Builder (`buildPrintReport(target)`, anchor text `/* RPT-2 (2026-10-24): the calculation sheet as Gusset`):** one function fills `#printReport` (Print / PDF) or the Report tab's container. New helpers:
  - `bpRptPolishTab(id, clone)` (each tab before it is numbered): removes `.svgTools`, `.bpCutCtl`, `.noPrint`, the chip list `#dash`, the "Detailed combination" row, "Click any … leg" panels and SVG click hints; the Summary's "Why is this failing?" (`sumDiag`) is dropped and "Design Comparison" (`sumCompare`) is dropped unless saved designs exist (then only its D/C table); the governing D/C table moves first and the Summary banners follow it as "Notes — Note 1. …"; every remaining select / input / textarea becomes its value as static text (checkboxes ☒ / ☐), every button is removed.
  - `bpRptPolishDoc(body, addSection)`: each `dcrBox` (now classed `dcrBox`, with `data-st` / `data-dcr`) becomes a result line "Result: D/C = 0.57 (demand ÷ capacity …) PASS"; coloured boxes become "Note: …"; each drawing gets "Figure n — <its title>"; explanatory notes longer than 450 characters move to a new last section "Notes / basis" (B.1, B.2 …), with "Basis: see Note B.n — <first sentence>" left in place.
  - Headings: "n. Title:" and "n.k. Title:"; the TOC and every "see §n.k" link are numbered after the removals, so they resolve.
  - `eqBlock`: while the report is built (`S.ui.printing`) the variables are a "where" table (`.cr-where`), not "sym = value — description" lines (same symbols, values and descriptions).
  - CSS: the report rules are scoped to `.crdoc` (was `#printReport`), so the same document styles print and the tab; new rules strip the app chrome (cards, shaded heads, coloured boxes and status colours) and lay out the worked items.
- **Report tab (`tabReport`, `buildReportTab`):** after Detail Sheet. Tool bar: "Print / PDF" (builds `#printReport` with the same builder and prints), "Include Detail Sheet appendix" (`S.print.sections.tabDetail`, the existing opt-in), "Report contents…" (the existing print settings). The document is rebuilt each time the tab is drawn (opening it, and every input change while open), debounced 250 ms (about 1.1–1.7 s to build). Table-of-contents and Basis links scroll within the document; "see §n.k" links jump to the tab and card where the value is worked (the existing `a.wkA` handler). Never printed as a section of itself; excluded from the print-settings list and size estimate.
- **Saved data:** none added.
- **Results:** `node tests/bpad-profis.mjs` — every computed field identical; only `.report` differs (by design). Test projects vs origin/main: computeAll, capacities, checks, validation, intercepts identical.
- **Report text, main → RPT-2 (pdftotext of the printed PDFs):** removed — the chip list (its D/C values remain in the table), "Detailed combination" selector text, "Why is this failing?" (+ "Run diagnostic"), "Design Comparison" (input, buttons, "No saved designs yet"), "See red chips", on-screen click hints; added — heading colons, "Figure n — …" captions, "Note n." labels, "Result: D/C = …" lines, "Notes / basis" with B.n entries and "Basis: see Note B.n" pointers. Engineer's test project (governing combination): 49 → 35 pages; default project (every combination): 70 → 46 pages.
- **Checks:** Report tab text equals the printed report text (default, W, group-hairpin projects); no input / select / button in the document; 0 page errors; no raw TeX in plain text; `node tests/check-syntax.mjs` passes.

## 2026-10-24 — RPT-3: Report tab with the Gusset navigation tree — sticky tool bar, tree with scroll-spy, collapsible chapters and sections, "§ in report" jumps (display only)
- **Engineer:** "The report you added for the base plate and anchor bolts app doesn't have the navigation tree."
- **Pattern copied (CLAUDE.md §3, kept duplicated):** `Gusset Plate Rating.html`, CSS "/* ===== Report tab viewer ===== */" (`.crv-bar`, `.crv-body`, `.crv-toc`, `.crv-doc`, `.cr-closed`) and JS `renderReportTab` / `crSizeBar` / `crJump` (its `CR_CLOSED` set and `data-rptjump`). Here: CSS after `.crv-doc .cr-flash` (anchor `/* RPT-3 (2026-10-24): report viewer`), JS `bpCrScroller`, `bpCrKey`, `bpCrSizeBar`, `bpCrJump`, `bpCrSpyOn/Off`, `buildReportTab`, `bpadRptJ`, `BP_RPT_CLOSED`, `BP_RPT_PENDING`.
- **Tool bar (sticky under the output tab bar):** chapter chips (the "Report contents" sections; Validation / User Manual as appendices), "Include Detail Sheet appendix", every / governing combination, Expand all, Collapse all, Print this report.
- **Body:** a sticky tree (250 px) beside the sheet (8.5 in max). Level 1 = numbered chapters, level 2 = numbered sections, from the same table of contents as the report. A click scrolls the output column to the heading and flashes it; the current section is highlighted while scrolling (scroll-spy on the output column, or the page when the columns stack); the tree scrolls on its own. ≤ 1100 px: the tree stacks above the sheet, 240 px high.
- **Collapsible:** a chapter heading or a section heading toggles it (▾ / ▸); the state is kept for the session (also across rebuilds when an input changes); a jump opens any collapsed parent first.
- **LAY-1:** the page still does not scroll (1000 / 1000, 820 / 820); sticky positions are measured inside the output column (`--crv-bar-top` = the tab bar, `--crv-top` = tab bar + tool bar). The sheet column is clipped sideways (`overflow-x:clip`), wide equations scroll in their own box, so the column never scrolls horizontally.
- **"§ in report" links:** each "Worked in" line and the Summary table's "Worked in" column carry a "§ in report" link (`a.rptJ`, `data-rptjump="tab|ci|card"`) that opens the Report tab at the section where that card is worked (`window.BPAD_CARDMAP`, set by `buildPrintReport`). Inside the report, "see §n.k" still goes to the source tab. The report itself never carries the "§ in report" links.
- **Print:** unchanged — `buildPrintReport()` into `#printReport`, no bar, no tree, nothing collapsed. The printed PDF of the engineer's test project is identical to main's (35 pages, `pdftotext` equal).
- **Checks (1500 × 1000 mouse, 1180 × 820 touch):** tree entries equal the report headings 1:1 (9 chapters, 39 sections); a tree jump puts the heading just under the tool bar and the tree highlights it; scroll-spy follows; heading tap collapses / expands; Collapse all closes 9 chapters, a jump into one opens it, the rest stay closed after a rebuild, Expand all clears them; "§ in report" from the Summary opens the Report tab at §5.1; "see §3.2" in the report goes to Base Plate; output column never scrolls sideways; 0 page errors. `node tests/bpad-profis.mjs` 5 / 5 `same`; `node tests/check-syntax.mjs` passes.

## 2026-11-01 — RPT-4: the Report tab moves to the shared report viewer (shared/report.js); RPT-1/2/3 kept (display / report only; no result changes) (PR: claude/rpt-baseplate, PR link added after merge)
- **Engineer request (2026-11-01, report rollout, item 9):** migrate the tool's own in-app Report tab (RPT-2/3, Gusset pattern) to the shared viewer used by the other tools, keeping every feature; replace the old one only if equivalent.
- **What is unchanged:** the document. `buildPrintReport()` (RPT-2, with the RPT-1 corrections: closed-tie wording and references, plain-text TeX, clipping, combination statements, links) still builds the calculation sheet; Print / PDF (tool bar) still prints `#printReport` with `bpadPageCSS`; Ctrl+P from any other tab is unchanged.
- **New (anchor `/* RPT-4 (2026-11-01)`, before `/* BP-T1 (2026-10-21)`):**
  - `bprModel()` builds the RPT-2 sheet off screen (in the page, as RPT-3 built it in the tab, since some drawings measure their text) and reads it back into the viewer's model in order and with the same numbering: chapter (`section.cr-sec`) → section n, every card as `buildPrintReport` numbers them (`.sec`) → subsection n.k (a chapter's own content before its cards goes at the top of its first card, so the cards keep the numbers n.k of the old sheet and its "see §n.k" texts; its result lines → a last subsection "Results — <chapter>"), each worked equation (`eqBlock`) → a worked step (its TeX lines from KaTeX's source annotation; its "where" table → the step's note; the result read back from its last line "= value unit"), result lines → a table (D/C and PASS / FAIL / N/A), drawings with their "Figure n — …" captions, notes ("Note n."), "Notes / basis" B.n. Steps under one heading form a topic (`SharedSteps.group`). References → a last section.
  - `bprReportTab(pg)` (was `buildReportTab`): mounts the viewer, debounced 250 ms as before; the tool bar keeps the RPT-3 controls (`bprControls`, `bprWire`): chapter chips (`S.print.sections`), "Include Detail Sheet appendix", every / governing combination (`S.print.combos.all`) — the same saved fields as before, nothing new; the viewer adds Search, Expand all, Collapse all, Print report.
  - "§ in report" (RPT-3 `a.rptJ`, `BP_RPT_PENDING`): `BPRP_CARDMAP` maps each card to its viewer anchor; the viewer opens at it (`api.go`).
  - "see §n.k" links inside the report still open the tab and card where the value is worked (`bprGoto` → `bpadGoto`).
  - Ctrl+P while the Report tab is shown prints the viewer's report (title block without owner cell, running header, Page X of Y); `bprWillPrint()` makes the D11 `beforeprint` stand aside.
- **shared/report.js (additive):** `opt.spy` (the RPT-3 scroll-spy: the tree highlights the heading being read and keeps it in view) and `api.go(anchorId)`. See `fixlog/shared-report.md`.
- **Changed lines:** `buildOutput`: `case "tabReport": bprReportTab(pg)`; the D11 `beforeprint` listener returns first when the Report tab prints itself; two `<script src="shared/…">` tags. The RPT-3 helpers `bpCrScroller` (used) and `buildReportTab`, `bpCrSizeBar`, `bpCrJump`, `bpCrSpyOn/Off`, `BP_RPT_CLOSED` (no longer called) are left in place unchanged; the `.crv-*` CSS stays (Gusset pattern, CLAUDE.md §3).
- **Side-by-side comparison, old (main, RPT-3) vs new, headless Chromium, 4 projects (default; MSA3A; torqued with 22 in. pedestal; the last built-in validation case):** chapters 1:1 (13 / 7 / 13 / 7), sections 1:1 (75 / 34 / 75 / 35), worked equations = steps (96 / 41 / 96 / 43), drawings 12 / 6 / 12 / 6 equal, every result-line D/C (58 / 22 / 70 / 24) in the new report, every number of the old sheet's text (1,282–3,383) present in the new one, tool bar controls equal (9 chapter chips, Detail Sheet appendix, combination selector); 0 unresolved references, 0 KaTeX errors, no NaN / undefined. Features: scroll-spy, Collapse all / Expand all, chapter chip removes the chapter, "§ in report" from the Summary opens the Report tab at the card (`tabPlate|2|pbBend` → §5.3), Ctrl+P prints the viewer's report. `S` after building the report differs only by `S.ui.printing` and `S.print.collapseIdentical`, which `buildPrintReport` sets on main as well.
- Final run on the branch file: all of the above PASS for the 4 projects; every number of the old sheet's text present in the new one (0 missing of 1,282–3,383); "§ in report" `tabPlate|2|pbBend` → §5.2 as in the old sheet; Ctrl+P on the Report tab: viewer report alone, 53 letter pages (default, every combination). 0 page errors (the PDF.js CDN script is not served in the test kit, on main too).
- `node tests/bpad-profis.mjs`: PASS (results origin/main vs branch: default, msa3a, struct2v1, struct2v2, torqued all `same`; export checks pass). `node tests/check-syntax.mjs BasePlateAnchorDesigner.html`: all scripts pass. `node tests/engine/run.mjs report steps steps-groups report-wiring`: 14 passed (shared/report.js changed).
- **Decision:** equivalent (same chapters, sections, worked items, drawings, result lines and numbers; every RPT-3 feature kept) → the old viewer is replaced.
- **Provision:** none. No formula, factor, unit, code reference or result changed. **Saved data:** none added.
- **Open items:** the viewer's Print report prints the viewer's layout (shared title block and running header); the RPT-2 calculation sheet layout prints from Print / PDF in the tool bar, as before. The now-unused RPT-3 functions can be deleted in a later clean-up.

Diff (`BasePlateAnchorDesigner.html`, `git diff -U0` against origin/main):

```diff
diff --git a/BasePlateAnchorDesigner.html b/BasePlateAnchorDesigner.html
index 5a65298..c7c5f79 100644
--- a/BasePlateAnchorDesigner.html
+++ b/BasePlateAnchorDesigner.html
@@ -11,0 +12,3 @@
+<!-- RPT-4: shared worked steps and the shared report viewer (classic scripts, relative path: keep the shared folder next to this file) -->
+<script src="shared/steps.js"></script>
+<script src="shared/report.js"></script>
@@ -5739 +5742 @@ function buildOutput(){
-    case "tabReport":  buildReportTab(pg); break;   /* RPT-2 */
+    case "tabReport":  bprReportTab(pg); break;   /* RPT-4: the shared viewer (was RPT-2/3 buildReportTab) */
@@ -5846,0 +5850,147 @@ document.addEventListener("click",e=>{ const a=e.target.closest&&e.target.closes
+/* RPT-4 (2026-11-01): the Report tab in the shared report viewer (shared/report.js, shared/steps.js; engineer's report
+   rollout). The document is the same one as before: buildPrintReport() builds the RPT-2 calculation sheet (same builder
+   as Print / PDF), and bprModel() reads it back into the viewer's model, in order and with the same numbering: each
+   chapter (section.cr-sec) a section n, each card (.sec, as buildPrintReport numbers them) a subsection n.k, each
+   worked equation (eqBlock) a worked step (its TeX lines from KaTeX's source annotation, its "where" table as the
+   step's note, its result read back from the line: the number the tool formatted, never recomputed), the result lines
+   of a chapter a table, drawings with their "Figure n" captions, notes, "Notes / basis" B.n. Steps under one heading
+   form a topic (SharedSteps.group). Kept from RPT-3: chapter chips, "Include Detail Sheet appendix", every / governing
+   combination, Expand / Collapse all, Print, navigation tree with scroll-spy, collapsible chapters and sections (state
+   kept for the session), "§ in report" jumps from the other tabs, "see §n.k" to the tab where a value is worked. New
+   from the viewer: search, topics in the tree. Print / PDF (toolbar button) is unchanged (#printReport). */
+const BPRP={closed:new Set(),api:null,doc:null};
+function bprAnn(k){const a=k&&k.querySelector('annotation[encoding="application/x-tex"]');return a?a.textContent:'';}
+function bprLite(t){return String(t||'').replace(/\\[dt]frac/g,'\\frac').replace(/\\(mathbf|mathrm|boldsymbol|textbf|mathit|operatorname)\{/g,'{').replace(/\\color\{[^}]*\}/g,'')
+  .replace(/\\checkmark/g,'\u2713').replace(/\\q?quad/g,'\\;').replace(/\\(displaystyle|scriptstyle|limits|!)/g,'').replace(/\\Rightarrow/g,'\u21D2').replace(/\\rightarrow|\\to\b/g,'\u2192')
+  .replace(/\\approx/g,'\u2248').replace(/\\infty/g,'\u221E').replace(/\\varepsilon/g,'\\epsilon').replace(/\\big[lr]?|\\Big[lr]?/g,'').replace(/\\ /g,' ').replace(/\$/g,'');}
+function bprText(n){
+  const c=n.cloneNode(true);
+  c.querySelectorAll('.katex-display,.katex').forEach(k=>{if(!c.contains(k))return;const t=bprAnn(k);k.replaceWith(document.createTextNode(t?'$'+bprLite(t)+'$':''));});
+  c.querySelectorAll('button,select,input,textarea,.svgTools,.noPrint').forEach(x=>x.remove());
+  return c.textContent.replace(/\s+/g,' ').trim();
+}
+/* the result at the end of the last line: "= 12.3\ \text{kip}" or "=\mathbf{12.3}" -> {value, unit, d, line} */
+function bprResult(line){
+  const m=/=\s*(?:\\mathbf\{)?\s*(-?[\d.,{}]+?)\s*\}?\s*((?:\\\s*|\\,|\\;|~|\s)*\\(?:text|mathrm)\{\s*([^{}]*)\})?\s*$/.exec(line);
+  if(!m)return null;
+  const raw=m[1].replace(/\{,\}/g,'').replace(/,/g,'').replace(/[{}]/g,'');
+  if(!/^-?\d+(\.\d+)?$/.test(raw))return null;
+  return {value:parseFloat(raw),unit:(m[3]||'').trim(),d:(raw.split('.')[1]||'').length,line:line.slice(0,m.index)};
+}
+function bprStep(eb,id){
+  const t=eb.querySelector('.eqTitle'),r=t&&t.querySelector('.eqRef');
+  const title=t?Array.from(t.childNodes).filter(x=>x!==r).map(x=>x.textContent).join('').trim():'';
+  const lines=Array.from(eb.querySelectorAll(':scope > .eqLine')).map(l=>bprAnn(l)).filter(Boolean);
+  const vars=Array.from(eb.querySelectorAll(':scope table.cr-wtab tr')).map(tr=>{const c=tr.cells;return c.length>=3?bprText(c[0])+' = '+bprText(c[2])+(bprText(c[1])?' ('+bprText(c[1])+')':''):bprText(tr);})
+    .concat(Array.from(eb.querySelectorAll(':scope > .varList > div')).map(bprText)).filter(Boolean);
+  let value=null,unit='',d=2;
+  const res=lines.length?bprResult(lines[lines.length-1]):null;
+  if(res){value=res.value;unit=res.unit;d=res.d;lines[lines.length-1]=res.line;}
+  const eq=lines.length>1?'\\begin{gathered}'+lines.join(' \\\\ ')+'\\end{gathered}':(lines[0]||'');
+  return {id,label:title||'Worked equation',sym:'',eq,sub:'',value,unit:unit.replace(/\u00B2|\^2/g,'^{2}').replace(/\u00B3|\^3/g,'^{3}'),d,ref:r?r.textContent.replace(/^\[|\]$/g,'').trim():'',note:vars.length?('where '+vars.join('; ').replace(/\$([^$]+)\$/g,(m,t)=>SharedSteps.toText(t))).replace(/\u00A7(?=[A-Za-z])/g,'\u00A7\u2060'):''};
+}
+/* the RPT-2 document -> the viewer's model (same chapters, cards and numbering) */
+function bprModel(){
+  /* built in the page (off screen), as the RPT-3 tab built it: some drawings measure their text */
+  const tmp=document.createElement('div');tmp.style.cssText='position:absolute;left:-30000px;top:0;width:8.5in;visibility:hidden;';tmp.setAttribute('aria-hidden','true');
+  (document.getElementById('tabPages')||document.body).appendChild(tmp);
+  try{buildPrintReport(tmp);}finally{tmp.remove();}
+  const body=tmp.querySelector('.cr-bodyall'), secs=[], cardKey={};
+  const wk=a=>{ /* "see §n.k" (D11 link rewritten by buildPrintReport): keep the text, open the tab where it is worked */
+    const tab=a.dataset.tab,card=a.dataset.card,ci=a.dataset.ci||'';return '[[tab:wk|'+tab+'|'+card+'|'+ci+'|'+a.textContent.replace(/[\]|]/g,'')+']]';};
+  Array.from(body.querySelectorAll(':scope > section.cr-sec')).forEach((sec,si)=>{
+    const h=sec.querySelector(':scope > .cr-h1'), title=(h?h.textContent:'').replace(/^\s*\d+\.\s*/,'').replace(/:\s*$/,'');
+    const cards=Array.from(sec.querySelectorAll('.sec')), subs=[];
+    const mk=(t,scope)=>({title:t,items:[],run:null,head:'',scope,n:0});
+    const flush=c=>{if(c.run&&c.run.steps.length){const g=SharedSteps.group(c.run.steps,[{key:'k',title:c.run.title,ids:()=>true}],{strip:false})[0];
+      c.items.push({type:'steps',scope:c.scope,title:'Worked steps',steps:c.run.steps,topics:[{title:c.run.title,ref:'',n:c.run.steps.length,cls:g.cls,chip:g.chip,res:g.res}]});}c.run=null;};
+    const linkText=n=>{const c=n.cloneNode(true);c.querySelectorAll('a.wkA').forEach(a=>a.replaceWith(document.createTextNode('\u0001'+wk(a)+'\u0001')));
+      c.querySelectorAll('a[href^="#"]').forEach(a=>a.replaceWith(document.createTextNode(a.textContent)));return bprText(c).replace(/\u0001/g,'');};
+    const walk=(node,c)=>{
+      Array.from(node.childNodes).forEach(ch=>{
+        if(ch.nodeType===3){const t=ch.textContent.trim();if(t){flush(c);c.items.push({type:'note',text:t});}return;}
+        if(ch.nodeType!==1)return;
+        const cl=ch.classList,tag=ch.tagName;
+        if(cl.contains('sec'))return;   /* every card is its own subsection (buildPrintReport's numbering) */
+        if(cl.contains('eqBlock')){if(!c.run)c.run={title:c.head||c.title,steps:[]};c.run.steps.push(bprStep(ch,'s'+(++c.n)));return;}
+        if(cl.contains('secHead')||tag==='BUTTON'||tag==='SCRIPT'||tag==='STYLE')return;
+        if(cl.contains('cr-results')){flush(c);c.items.push({type:'table',head:['Check','D/C','Status'],rows:Array.from(ch.querySelectorAll('.cr-line')).map(l=>{const st=bprText(l.querySelector('.cr-r')||l);
+          return [linkText(l.querySelector('.cr-d')||l).replace(/:$/,''),linkText(l.querySelector('.cr-m')||l),{t:st,cls:/FAIL/.test(st)?'ng':/PASS/.test(st)?'ok':'na'}];})});return;}
+        if(tag==='TABLE'&&!cl.contains('cr-wtab')){flush(c);const rows=Array.from(ch.rows);if(!rows.length)return;const hr=rows[0].querySelector('th')?rows.shift():null;
+          c.items.push({type:'table',head:hr?Array.from(hr.cells).map(linkText):[],rows:rows.map(r=>Array.from(r.cells).map(td=>{const t=linkText(td);return {t,n:/^[-−]?[\d.,]+$/.test(t),span:td.colSpan>1?td.colSpan:undefined};}))});Array.from(ch.querySelectorAll('svg')).filter(v=>!v.closest('.katex')).forEach(v=>c.items.push({type:'figure',svg:v.outerHTML}));   /* drawings laid out in a table */
+          return;}
+        if(tag.toLowerCase()==='svg'){flush(c);let cap='';const nx=(ch.parentElement&&ch.parentElement.querySelector(':scope > p.cr-cap'))||null;
+          const sib=ch.nextElementSibling&&ch.nextElementSibling.classList.contains('cr-cap')?ch.nextElementSibling:(ch.parentElement&&ch.parentElement.nextElementSibling&&ch.parentElement.nextElementSibling.classList.contains('cr-cap')?ch.parentElement.nextElementSibling:nx);
+          if(sib){cap=sib.textContent.trim();sib.dataset.used='1';}c.items.push({type:'figure',svg:ch.outerHTML,caption:cap});return;}
+        if(tag==='P'&&cl.contains('cr-cap')){if(ch.dataset.used)return;}
+        if(/^H[1-6]$/.test(tag)||cl.contains('cr-notesHd')||cl.contains('cr-resh')){flush(c);const t=ch.textContent.trim();if(t){c.head=t;c.items.push({type:'note',text:'— '+t+' —'});}return;}
+        if(ch.querySelector('.eqBlock,table,svg,.cr-results')){walk(ch,c);return;}
+        if(cl.contains('cr-bn')){flush(c);c.items.push({type:'note',text:linkText(ch)});return;}
+        const t=linkText(ch);if(t){flush(c);c.items.push({type:'note',warn:cl.contains('cr-noteBox')&&/^Note:/.test(t)&&!!ch.querySelector('b'),text:t});}
+      });
+    };
+    const lead=mk('General',('c'+(si+1))+'.0');
+    /* the chapter's own content outside the cards */
+    const clone=sec.cloneNode(true);clone.querySelectorAll('.sec').forEach(x=>x.remove());const hh=clone.querySelector(':scope > .cr-h1');if(hh)hh.remove();
+    walk(clone,lead);flush(lead);
+    cards.forEach((sc,k)=>{const t=sc.querySelector(':scope > .secHead .secTitle');const c=mk((t?t.textContent:'').replace(/^\s*\d+(\.\d+)*\.\s*/,'').replace(/:\s*$/,''),'c'+(si+1)+'.'+(k+1));
+      walk(sc.querySelector(':scope > .secBody')||sc,c);flush(c);subs.push(c);});
+    /* the lead content (cross-reference line, chapter result lines): before the cards, or after them for result lines */
+    const res=lead.items.filter(it=>it.type==='table'&&it.head[0]==='Check'), other=lead.items.filter(it=>res.indexOf(it)<0);
+    /* the chapter's own content before its cards goes at the top of its first card, so the cards keep buildPrintReport's numbers n.k
+       (the "see §n.k" texts); the "Results — …" heading is the title of the results subsection */
+    const other2=other.filter(it=>!(it.type==='note'&&/^— Results — /.test(it.text)));
+    const S2=[]; if(other2.length&&!subs.length) S2.push({title:title,items:other2}); else if(other2.length) subs[0].items=other2.concat(subs[0].items);
+    subs.forEach(c=>S2.push({title:c.title,items:c.items.length?c.items:[{type:'note',text:'—'}]}));
+    if(res.length) S2.push({title:'Results — '+title,items:res});
+    secs.push({title,subs:S2.length?S2:[{title:title,items:[{type:'note',text:'—'}]}],_cards:subs.length,_lead:0});
+  });
+  /* "§ in report": card -> subsection anchor of the viewer (rp-s<n>-<k>; k shifted by a leading "General") */
+  const map={}; Object.entries(window.BPAD_CARDMAP||{}).forEach(([k,v])=>{const m=/^crp-(\d+)-(\d+)$/.exec(v.id);if(!m)return;const s=secs[+m[1]-1];if(!s)return;map[k]='rp-s'+m[1]+'-'+(+m[2]+s._lead);});
+  window.BPRP_CARDMAP=map;
+  const P=S.proj||{};
+  return {title:'Base Plate & Anchor Bolt Design',subtitle:P.name||'Untitled',code:'ACI 318-19 Chapter 17 · AISC Design Guide 1',
+    info:[['Project',P.name],['Project No.',P.num],['Calculated by',P.by],['Date',P.date],['Checked by',P.chk],['Checked date',P.chkDate]],
+    head:{left:'Project No. '+(P.num||'—')+' — '+String(P.name||'—').slice(0,40),right:'Computed: '+(P.by||'—')+' '+(P.date||'')+' · Checked: '+(P.chk||'—')+' '+(P.chkDate||''),foot:(P.name||'Untitled')+' (Base Plate & Anchor Bolt Designer)'},
+    sections:secs.map(s=>({title:s.title,subs:s.subs})).concat([{title:'References',subs:[{title:'References',items:[{type:'table',head:['Reference','Provisions used'],rows:BPAD_REFS.map(r=>[bprText(Object.assign(document.createElement('div'),{innerHTML:r[0]})),bprText(Object.assign(document.createElement('div'),{innerHTML:r[1]}))])}]}]}])};
+}
+/* RPT-4: the Report tab (replaces RPT-3's buildReportTab; same tool bar controls, same document) */
+function bprControls(){
+  const chips=TABS().filter(([id])=>!(id==="tabVisual"||id==="tabReport"||id==="tabDetail")).map(([id,label])=>{
+    const optIn=(id==="tabValidation"||id==="tabManual"), on=optIn? S.print.sections[id]===true : S.print.sections[id]!==false;
+    return '<label class="rp-chip"><input type="checkbox" data-bprsec="'+id+'"'+(on?' checked':'')+'>'+sbdEscB(label+(optIn?" (appendix)":""))+'</label>'; }).join("");
+  return '<div class="rp-chips" role="group" aria-label="Report chapters">'+chips+'</div>'
+    +'<label class="rp-chip"><input type="checkbox" data-bprsec="tabDetail"'+(S.print.sections.tabDetail===true?' checked':'')+'>Include Detail Sheet appendix</label>'
+    +'<select data-bprcombos><option value="all"'+(S.print.combos.all!==false?' selected':'')+'>Every combination worked</option><option value="gov"'+(S.print.combos.all===false?' selected':'')+'>Governing combination only</option></select>';
+}
+function sbdEscB(s){ return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
+function bprWire(host){
+  host.querySelectorAll("input[data-bprsec]").forEach(cb=>cb.addEventListener("change",()=>{ S.print.sections[cb.dataset.bprsec]=cb.checked; autosave(); buildOutput(); }));
+  const cs=host.querySelector("select[data-bprcombos]"); if(cs) cs.addEventListener("change",()=>{ S.print.combos.all=(cs.value==="all"); autosave(); buildOutput(); });
+}
+function bprReportTab(pg){
+  if(!window.SharedReport||!window.SharedSteps){ pg.appendChild(el("div","errBox","shared/report.js or shared/steps.js is not loaded: keep the shared folder next to this file.")); return; }
+  const host=el("div","bprHost"); pg.appendChild(host);
+  host.appendChild(el("div","note","Building the calculation sheet…"));
+  /* building the whole sheet takes about a second: debounced so typing stays responsive (as RPT-2/3) */
+  clearTimeout(bpRptTimer);
+  bpRptTimer=setTimeout(()=>{ if(!host.isConnected || S.ui.tab!=="tabReport") return;
+    const sc=bpCrScroller(), keep=sc? sc.scrollTop : 0, tb=document.getElementById("tabBar");
+    let M; try{ M=bprModel(); }catch(e){ host.innerHTML=""; host.appendChild(el("div","errBox","Report error: "+sbdEscB(e&&e.message))); return; }
+    BPRP.api=SharedReport.mount(host,M,{closed:BPRP.closed,onGoto:bprGoto,controls:bprControls(),spy:true,stick:(sc&&tb)? tb.offsetHeight : 0});
+    BPRP.doc=BPRP.api.doc; bprWire(host);
+    if(sc) sc.scrollTop=keep;
+    if(BP_RPT_PENDING){ const [t,ci,card]=BP_RPT_PENDING.split("|"); BP_RPT_PENDING=null;
+      const m=window.BPRP_CARDMAP||{}, id=m[t+"|"+ci+"|"+card]||m[t+"||"+card]||m[t+"|"+(window.BPAD_GI)+"|"+card]; if(id) BPRP.api.go(id); }
+    host.dataset.ready="1"; },250);
+}
+/* [[tab:wk|tab|card|ci|text]]: "see §n.k" — to the tab and card where the value is worked (as the a.wkA links) */
+function bprGoto(name){ const p=String(name).split("|"); if(p[0]==="wk") bpadGoto(p[1],p[2],p[3]===""? null : p[3]); }
+function bprWillPrint(){ return document.body.classList.contains("rp-printing")||!!(BPRP.doc&&S.ui.tab==="tabReport"); }
+window.addEventListener("beforeprint",()=>{
+  if(!BPRP.doc||S.ui.tab!=="tabReport"||document.body.classList.contains("rp-printing")) return;
+  let box=document.getElementById("rp-print"); if(!box){ box=document.createElement("div"); box.id="rp-print"; document.body.appendChild(box); }
+  box.innerHTML='<div class="rp"><article class="rp-doc">'+SharedReport.html(BPRP.doc,{lazy:false})+'</article></div>';
+  document.body.classList.add("rp-printing");
+});
+
@@ -12489 +12639,2 @@ function init(){
-  window.addEventListener("beforeprint",()=>{ if(!document.getElementById("printReport").innerHTML) buildPrintReport(); bpadApplyPageCSS(true); });
+  window.addEventListener("beforeprint",()=>{ if(typeof bprWillPrint==="function"&&bprWillPrint()) return;   /* RPT-4: the Report tab prints itself (shared/report.js) */
+    if(!document.getElementById("printReport").innerHTML) buildPrintReport(); bpadApplyPageCSS(true); });
```

## 2026-11-01 — RPT-4b: the unused RPT-3 report viewer code removed (pure removal; no behaviour change) (PR: claude/bpad-rpt3-cleanup, PR link added after merge)
- **Coordinator request (2026-11-01):** delete the RPT-3 functions that RPT-4 (#580) left in place but no longer calls.
- **Removed** (anchor before: `/* RPT-2 (2026-10-24): Report tab — the calculation sheet on screen.`, through the `resize` listener that called `bpCrSizeBar`): the RPT-2/RPT-3 comments, `bpCrSpy`, `BP_RPT_CLOSED`, `bpCrKey`, `bpCrSizeBar`, `bpCrJump`, `bpCrSpyOff`, `bpCrSpyOn`, `buildReportTab` and `window.addEventListener("resize", … bpCrSizeBar(pg) …)`. None of them is referenced by any remaining code (checked by search: each name now occurs only in comments).
- **Kept** (used by RPT-4 `bprReportTab` and the "§ in report" handler): `let bpRptTimer=0, BP_RPT_PENDING=null;` and `bpCrScroller()`, under a new comment `/* RPT-4 (2026-11-01): the Report tab is the shared viewer …`. The `.crv-*` CSS stays: `buildPrintReport(target)` still gives the off-screen sheet the class `crdoc crv-doc` (its drawings are laid out with it).
- **Re-apply by hand:** delete the block named above and put back the two kept lines.
- **How verified (no behaviour change):** headless Chromium, origin/main (RPT-4) vs branch, 4 projects (default, MSA3A, torqued, last built-in validation case): the text of every output tab, the Report tab's text (`SharedReport.text`) and navigation tree, the "§ in report" jump target, `S` and localStorage identical; a `resize` event raises no error; 0 page errors. `node tests/check-syntax.mjs BasePlateAnchorDesigner.html` passes.
- **Provision:** none. **Saved data:** none.
