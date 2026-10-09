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
- O1. ASCE 7-22 generator details (the 0.2S term in the 2.3.6 seismic combinations, a separate S slot, the 0.5L option). Not changed, per the brief (OPEN). Decide which combinations the generator should produce.
- O2. Stand-off rod buckling uses gross d and A_g (`standoffCompressionCheck`). The threaded root arguably governs (r = d_root/4, A = A_se or A_root). Not changed (OPEN). Confirm the intended basis.
- O3. The A2 1:2 frustum depth limit against pedestal height H is not checked (F13 covers similarity and concentricity only).
- O4. **Pre-existing bug found:** shear hairpins can never be credited. `tensionDevLengths(S.vRebar)` reads `R.cover`, which `vRebar` does not have, so c_b = NaN, ℓ_d = NaN, and every leg fails the "behind the plane" development check (`reqBehind = NaN`). Hairpin substitution and (with F7) shear Condition A therefore never apply. This is conservative. Not fixed because it is outside the brief. Suggested fix: give `vRebar` a `cover` (2.0) or pass the cover used in `shearRebarIntercept`.
- O5. ψ_ed,N in tension breakout still uses the minimum edge distance of ALL anchors, not the tension anchors (conservative). It is used consistently with the pryout cone. Should it follow the tension anchors like A_Nc?
- O6. ψ_h,V outside the narrow-member case is computed from the `ca1` argument, which `comboCapacities` sets to the minimum edge distance of the whole group, not c_a1 of the governing edge. This is conservative and was left as is.
- O7. Pryout keeps its old ratio cap `min(A_Nc,all/A_Nco, nT)` (nT = tension-anchor count) so its result is unchanged. Per §17.7.3 the cap would be the number of anchors in the group (less conservative when A_Nc,all/A_Nco > nT). Confirm.
- O8. Condition A is decided by "the intercept check credits ≥ 1 bar/leg" (F7). If you want a stricter rule (all bars effective) or an explicit "Condition A" input, say so.
- O9. F6 (§17.7.2.1.2) and F10 (uniform block) reduce DCRs in some cases. Both follow the code text / the reviewer's instruction, but please confirm.

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
  - O10. Typing a decimal into a number field can lose the decimal point. Typing `5.5` into f'c with Playwright's keyboard gives 55, both on main and on this branch. The panel is rebuilt on every keystroke, and the number input does not keep the intermediate `5.`. Please check this by hand in a browser. Not changed, because it is outside this brief.
  - O11. At 400 px the page scrolls horizontally because of the six-column project header (`#projGrid`, at least 120 px per column). This was there before this change and was not changed.
