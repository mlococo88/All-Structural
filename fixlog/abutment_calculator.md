# Fix log — abutment_calculator.html

Governing basis used for fixes: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024); MassDOT LRFD Bridge Manual Part I (MassDOT values unchanged)

## 2026-10-04 — PR: claude/fix-abutment (PR link added after merge)

How to read this log:
- Every edit is listed **exactly** in the appendix as replacement pairs R1…R62, in the order they were applied to the original file. Applying them in order reproduces the new file; this was verified with a script.
- Each F-item below names its pairs and shows the core before/after inline.
- All numbers come from running the real `computeAll()` of the old and new files in jsdom (scratch harness `abut_dom.js`). Cases are built from the built-in benchmark (`benchState()`: B = 13 ft, L = 44 ft, 6 girders DC/DW/LL = 85/12/70 kip) plus the overrides stated.

### F1. Eccentricity: |e| everywhere; pressure diagrams mirrored for heel-side resultants   [calc change] [more conservative]
- **Where:** `computeAll` — eccentricity loop (R14), bearing loop (R15–R17), Service I loop (R18), the toe/heel pressure (R21), `bearingSegsFor` (R31) and the equilibrium closure (R36). Helpers `meyerSegs` / `linSegs` (R7). Display: R43–R49. Anchors: `e=Math.abs(eS)`, `function linSegs(`.
- **Problem:** e = B/2 − x̄ was used with its sign. For a resultant on the heel side (e < 0):
  - the eccentricity D/C was negative, so it always passed;
  - B′ = B − 2e came out larger than B, under-estimating q;
  - the rock and Service I q_max was taken at the toe with (1 + 6e/B), and qmin could even be negative;
  - the pressure blocks were always drawn from the toe, so the equilibrium closure failed.
- **Governing provision:** AASHTO LRFD 10th Ed., Art. 11.6.3.3 (e ≤ B/3 soil, 0.45B rock); Art. 10.6.1.3 (B′ = B − 2e); Art. 10.6.3.1 / 11.6.3.2.
- **Before (eccentricity):**
  ```js
  const xbar=(c.Mv-c.Mh)/c.V, e=B/2-xbar, dc=e/eLim;
  if(dc>ecc.dc) ecc={dc, e, xbar, eLim, V:c.V, Mv:c.Mv, Mh:c.Mh, lbl:c.lbl, ls:lsName, c};
  ```
- **After:**
  ```js
  const xbar=(c.Mv-c.Mh)/c.V, eS=B/2-xbar, e=Math.abs(eS), dc=e/eLim;   // |e| [11.6.3.3]; eS < 0 = resultant on the heel side
  if(dc>ecc.dc) ecc={dc, e, eSigned:eS, side:eS>=0?"toe":"heel", xbar, eLim, V:c.V, Mv:c.Mv, Mh:c.Mh, lbl:c.lbl, ls:lsName, c};
  ```
  Bearing and service use the same `eS`/`e=Math.abs(eS)` pattern. A permutation with the resultant outside the base (B′ ≤ 0, or e ≥ B/2 on rock) is skipped, and a warning now says so; before, it was skipped silently, or on rock produced a negative q. `R.checks.ecc.e`/`R.checks.bearing.e` now hold |e|; `eSigned`/`side` are new fields.
- **Check case (heel-side resultant):** benchmark with L_toe = 12 ft, L_heel = 1 ft, soil height 12 ft, h_stem = 7 ft (B = 17.5 ft, e_lim = B/3 = 5.833 ft), soil.
  - **Eccentricity**, Strength I (1.25DC + 1.50DW + 1.35EV + 0.90EH + 1.75LL…): V = 2320.91 kip, ΣM_V = 30278.58, ΣM_H = 1863.54 kip-ft.
    - x̄ = (30278.58 − 1863.54)/2320.91 = 12.243 ft, so e = 8.75 − 12.243 = −3.493 ft.
    - Before: the reported governing D/C was **−0.140** (a construction permutation, e = −0.815). This permutation gave −0.599, so the check could not fail.
    - After: D/C = 3.493/5.833 = **0.599**, governing Strength I, heel side.
  - **Bearing**, soil, governing Strength I, V = 2344.01 kip, e = −3.540 ft.
    - Before: B′ = 17.5 + 7.08 = 24.58 ft > B, q = 2.167 ksf (old governing value 2.209 ksf, D/C 0.273).
    - After: B′ = 17.5 − 7.08 = 10.42 ft, q = 2344.01/(10.42·44) = **5.113 ksf**, D/C = 5.113/(0.45·18) = **0.631**.
    - Rock: before 0.610 ksf (D/C 0.075); after a triangle at the heel, 6.817 ksf (D/C 0.842).
  - **Service I**, V = 1715.46 kip, |e| = 3.298 > B/6.
    - Before: "trapezoid" 3.451 ksf at the toe with qmin = −0.120 ksf (invalid).
    - After: triangle at the heel, Lc = 3(8.75 − 3.298) = 16.356 ft, q = 2·1715.46/(16.356·44) = **4.767 ksf**.
  - **Equilibrium closure residual**, same geometry: before 642.8 kip / 13375 kip-ft (error flagged); after 0 / 0.
- **Benchmark** (toe-side resultant): unchanged (e = 2.465 ft, bearing q = 7.503 ksf, D/C 0.926).
- **How verified:** jsdom run of old/new `computeAll`; render of every tab with no runtime errors.
- **Other copies of this code:** none.

### F2. Shrinkage & temperature steel, Eq. 5.10.6-1 with b = least width of the component   [calc change] [more conservative]
- **Where:** `sectionCheck` (R24, R25), its four calls (R26–R28), the display (R54) and the bar schedule E1 (R56). Anchor: `const hIn=o.hST||o.h, bST=o.bST||b;`
- **Problem:** b = 12 in (a 1 ft strip) was used, which almost always gave the 0.11 in²/ft floor.
- **Governing provision:** AASHTO LRFD 10th Ed., Art. 5.10.6, Eq. 5.10.6-1: A_s ≥ 1.30bh/(2(b+h)f_y), 0.11 ≤ A_s ≤ 0.60 in²/ft (each face, each direction). b = least width and h = least thickness of the component section.
- **Before:**
  ```js
  const hIn=o.h, LIn=b;
  let AsST=1.30*b*hIn/(2*(b+hIn)*m.fy);
  ```
- **After:**
  ```js
  const hIn=o.hST||o.h, bST=o.bST||b;                 // b = least width, h = least thickness of the component (in) [Eq. 5.10.6-1]
  let AsST=1.30*bST*hIn/(2*(bST+hIn)*m.fy);
  ```
  Component dimensions passed in:
  - backwall b = min(L_ab, h_bw), h = t_bw;
  - stem b = min(L_ab, h_stem), h = min(t_st, t_sb);
  - toe/heel (footing) b = min(B, L_ftg), h = t_f.

  Schedule E1 now uses the largest of the stem, backwall and footing values.
- **Check case (benchmark):**
  - Stem: b = min(528, 168) = 168 in, h = 54 in, A_s = 1.30·168·54/(2·222·60) = **0.443** in²/ft (was 0.11).
  - Backwall: b = 60, h = 18, giving **0.150** (was 0.11).
  - Footing: b = 156, h = 36, giving **0.317** (was 0.11).
- **How verified:** jsdom run; the values match the hand calculation above.
- **Other copies of this code:** none.

### F3. Shear friction, "roughened" joint: c = 0.24 ksi, μ = 1.0, K1 = 0.25, K2 = 1.5 ksi   [calc change] [more conservative]
- **Where:** `PREP.roughened` in C-14 (R29). Self-test value re-baked (R62).
- **Decision:** the option is described as "against hardened concrete, roughened ¼ in" at the stem-to-footing construction joint. It is not a slab cast on girders. The 5.7.4.4 values for normal-weight concrete placed against a clean, intentionally roughened (0.25 in amplitude) hardened concrete surface therefore apply. The old values (0.28/1.0/0.30/1.8) are the 5.7.4.4 values for a CIP slab on roughened girder surfaces.
- **Governing provision:** AASHTO LRFD 10th Ed., Art. 5.7.4.4.
- **Before:** `roughened:{c:0.28,mu:1.0,K1:0.30,K2:1.8,name:"against hardened concrete, roughened ¼ in"},`
- **After:** `roughened:{c:0.24,mu:1.0,K1:0.25,K2:1.5,name:"against hardened concrete, roughened ¼ in"},   // 5.7.4.4 (…)`
- **Check case (benchmark):** A_cv = 54·12 = 648 in²/ft, A_vf = 1.333 in²/ft (#9 @ 9), f_y = 60, P_c = 19.95 kip/ft.
  - Before: V_ni = 0.28·648 + 1.0(80 + 19.95) = 281.39 kip/ft (cap min(0.30·4·648, 1.8·648) = 777.6).
  - After: V_ni = 0.24·648 + 99.95 = 255.47 kip/ft (cap min(0.25·4·648, 1.5·648) = 648).
  - D/C = 13.111/(0.9·V_ni): 0.0518 → **0.0570**.
- **Self-test:** `__ST_EXPECT["Shear-friction D/C"]` was re-baked from 0.05177218522624396 to 0.05702500795507431 (hand-checked above). All other 15 baked values are unchanged, and the self-test passes.
- **Other copies of this code:** none.

### F4. Toe/heel structural design with the trapezoidal/triangular contact pressure   [calc change] [toe more conservative; heel see F5]
- **Where:** toe/heel block (R21), `bearingSegsFor` for the V/M diagrams (R31), the display (R50–R52). Anchor: `// TOE & HEEL — structural design uses the linear (trapezoidal/triangular) contact pressure`
- **Problem:** on soil, the toe and heel were designed with the uniform Meyerhof pressure over B′. That model is for bearing resistance only. For structural design, 10.6.5 (and 11.6.3.2) call for a triangular or trapezoidal factored contact pressure.
- **Governing provision:** AASHTO LRFD 10th Ed., Art. 10.6.5; Art. 11.6.3.2.
- **Before (core):**
  ```js
  if(fn.matl==="soil"){ segs=[{x0:0,x1:Math.max(0,bc.Bp),q0:bc.q,q1:bc.q}]; }
  ...
  const VtoeUp=pressForce(segs,0,g.Ltoe), MtoeUp=pressMoment(segs,0,g.Ltoe,g.Ltoe);
  ```
- **After (core):**
  ```js
  for(const lsName of STR_LIMITS){ for(const pl of permutations(lsName)){
    const c=comboEffects(lsName,pl.perm,pl.liveOn,false); if(c.V<=0) continue;
    const eS=B/2-(c.Mv-c.Mh)/c.V, segs=linSegs(c.V,eS,B,Lftg); if(!segs) continue;
    ... toe Mu = MtoeUp − 0.9·w_ftg·L_toe²/2 (max over permutations); Vu at d_v (max over permutations) ...
  }}
  ```
  `R.qSegs` (FBD figure and closure) keeps the pressure used in the bearing check (Meyerhof on soil, linear on rock), mirrored when on the heel side. The toe still uses 0.90·DC on the footing self-weight (unchanged and conservative). The V/M diagrams (`bearingSegsFor`) now draw the linear pressure.
- **Check case (benchmark toe):** governing Strength I, V = 2977.88 kip, e = 1.990 ft, B = 13, L = 44.
  - q̄ = 5.206 ksf; q_toe = 5.206(1 + 6·1.990/13) = 9.987 ksf; q at the face (x = 3.5 ft) = 7.413 ksf.
  - M_up = 7.413·3.5²/2 + (9.987 − 7.413)·(3.5/2)·(2·3.5/3) = 45.40 + 10.51 = 55.91 kip-ft/ft; M_dn = 0.9·0.45·3.5²/2 = 2.48.
  - Before: M_u = 45.95 − 2.48 = **43.47** kip-ft/ft (uniform 7.503 ksf). After: M_u = **53.43** kip-ft/ft (+23%).
  - V_u at d_v: 7.54 → **9.77** kip/ft.
- **How verified:** jsdom run; hand check above.
- **Other copies of this code:** none.

### F5. Heel demand from one consistent load combination   [calc change] [⚠ LESS conservative in the benchmark]
- **Where:** R21 (spread), R22 (piles), helper `heelLoads(c)`; display R51–R52.
- **Problem:** the downward heel load always used γEV,max, γDC,max and γLL·LS together. The subtracted upward pressure came from a different combination (the one that maximised bearing). This mixed combinations.
- **Governing provision:** AASHTO LRFD 10th Ed., Art. 3.4.1 (each combination uses one set of factors; γp max/min chosen per load); Art. 10.6.5.
- **Before:**
  ```js
  const wDn=(+F.gpEVmax)*wSoilHeel+(+F.gpDCmax)*wFoot+gLL_str*wLSv+GP.ES[1]*esQ;
  const MheelDn=wDn*g.Lheel*g.Lheel/2, VheelDn=wDn*g.Lheel;
  const MheelUp=pressMoment(segs,xStemBack,B,xStemBack), VheelUp=pressForce(segs,xStemBack,B);
  ```
- **After:** for each strength permutation c, the downward load uses c's own factors (`c.gset`: EV/EVC, DCsub, LSv/LSvC, ESv; construction fill for the construction state) plus the slope wedge (F7). The upward pressure is the linear pressure of the same c (spread) or the pile reactions of the same c (piles). The maximum net M_u and the maximum V_u are taken.
  ```js
  function heelLoads(c){ const cc=!!LIMITS[c.lsName].noSuper, gs=c.gset;
    const gEV=gs[cc?"EVC":"EV"]||0, gDC=gs.DCsub||0, gLS=gs[cc?"LSvC":"LSv"]||0, gES=gs.ESv||0;
    const wS=cc? gam*Math.min(R.constrC.hfC,g.soilH) : wSoilHeel, wL=cc? gam*R.constrC.heqC : wLSv;
    const wDn=gEV*wS+gDC*wFoot+gLS*wL+gES*esQ;
    return {gEV,gDC,gLS,gES,wDn, MheelDn:wDn*g.Lheel*g.Lheel/2+(cc?0:gEV*wedgeM), VheelDn:wDn*g.Lheel+(cc?0:gEV*wedgeV)}; }
  ```
- **Check case (benchmark heel, L_heel = 5 ft):**
  - Before: w_dn = 1.35·2.28 + 1.25·0.45 + 1.75·0.24 = 4.061 ksf, M_dn = 50.76; M_up (Meyerhof block 1.02 ft into the heel) = 3.91; **M_u = 46.85** kip-ft/ft.
  - After: governing Construction–Str I: w_dn = 1.35·2.28 + 0.90·0.45 = 3.483 ksf, M_dn = 43.54; M_up (its own linear pressure, e = 1.399 ft) = 15.08; **M_u = 28.45** kip-ft/ft. V_u 12.65 → 10.42 kip/ft.
  - Pile branch (benchmark with piles): M_u 32.28 → 29.54 kip-ft/ft.
  - **This is a 39% drop in the benchmark heel moment.** Most of it comes from the linear pressure (F4), which puts some bearing under the heel, whereas the Meyerhof block sat mostly under the toe. The old value was not a code combination. In other geometries the new value can be higher (the reviewer's concern).
- **How verified:** jsdom run, both branches.
- **Other copies of this code:** none.

### F6. Strength IV added   [calc change] [more conservative]
- **Where:** `LIMITS` (R11), the DC factor in `comboEffects` (R61) and its label (R12), `STR_LIMITS` (R13), stem `Pv`/self-weight eccentricity (R19), bearing seat (R30), V/M factors (R32, R34), selectors/colours (R57, R58), new input `factors.gpDCmaxS4` (R2, R3, R5, R37).
- **Governing provision:** AASHTO LRFD 10th Ed., Table 3.4.1-1 (Strength IV: γp on DC, DW, EH, EV, ES; no LL; TU 0.50) and Table 3.4.1-2 (γDC max = 1.50 for Strength IV only).
- **After (core):**
  ```js
  "Strength IV": {LL:0, WS:0, WL:0, TU:+F.gTU, CR:+F.gCR, perm:true , liveOpt:false, dcMax:(+F.gpDCmaxS4||1.50)},
  ...
  else gamma = L[gr.cls]; // TU, CR, WS, WL
  if(gr.cls==="DC" && L.perm && L.dcMax && (perm.DC??1)===1) gamma = L.dcMax;   // Strength IV γDC max
  ```
- **Check case (heavy DC: benchmark with DC = 250, LL = 20 kip per girder):**
  - Bearing seat P_u: before Strength I 1.25·250 + 1.5·12 + 1.75·20 = 365.5 kip; after **Strength IV 1.50·250 + 1.50·12 = 393.0 kip** (q_b/q_R 0.178 → 0.191).
  - Strength IV also enters sliding, eccentricity, bearing, piles and the walls. It governs eccentricity in several heel-side geometries (see the F1 case search), but not the benchmark.
- **Other copies of this code:** none.

### F7. Sloping backfill: retained height at the heel + Lheel·tanβ; soil wedge added to EV   [calc change] [more conservative]
- **Where:** R8 (H), R9/R10 (EV), R21/R33 (heel loads and the heel diagram), R55 (display).
- **Governing provision:** AASHTO LRFD 10th Ed., Art. 3.11.5.3 (Rankine/Coulomb on the virtual back plane through the heel), Art. 3.5.1 (EV).
- **Before:** `const H = g.tf+g.soilH;` and `const Wev=(…)*g.Lheel*Lab; R.EV={W:Wev,x:xHeel,…}`
- **After:**
  ```js
  const hWedge = g.Lheel*Math.tan(deg2rad(+g.beta||0));
  const H = g.tf+g.soilH+hWedge;
  const Wwedge=0.5*S.soil.gamma*g.Lheel*hWedge*Lab, xWedge=xStemBack+2*g.Lheel/3;
  const Wev=Wev0+Wwedge, xEV=Wev>0?(Wev0*xHeel+Wwedge*xWedge)/Wev:xHeel;
  ```
  The construction stage (reduced, level fill) is unchanged.
- **Check case:** benchmark with β = 15°.
  - h_wedge = 5·tan15° = 1.340 ft, so H = 3 + 19 + 1.340 = 23.34 ft (was 22.00).
  - Wedge = 0.5·0.120·5·1.340·44 = 17.68 kip, so EV = 519.28 kip (was 501.60).
  - EH_h = 420.26 → **473.00** kip (ratio (23.34/22)² = 1.1255).
  - Bearing D/C 0.912 → 0.974; eccentricity D/C 0.469 → 0.538.
  - β = 0: no change.
- **Other copies of this code:** none.

### F8. One-way shear: β = 2.0 only where 5.7.3.4.1 permits; otherwise the general procedure   [calc change] [⚠ mixed — more conservative for the stem, LESS conservative for the backwall in the benchmark]
- **Where:** `sectionCheck` (R23, R25), calls R26–R28, display R53; new input `mat.ag` (R1, R3, R4).
- **Rule implemented:**
  - Footings (toe, heel): β = 2.0 when the distance from the zero-shear point (the free end) to the face is less than 3d_v (5.7.3.4.1); otherwise the general procedure.
  - Walls (stem, backwall): no transverse reinforcement is modelled, so β = 2.0 only if h < 16 in; otherwise the general procedure.
  - General procedure (5.7.3.4.2, no minimum transverse reinforcement): β = 4.8/(1+750ε_s)·51/(39+s_xe), where
    - s_xe = s_x·1.38/(a_g + 0.63), with s_x = d_v and 12 ≤ s_xe ≤ 80 in;
    - ε_s = (|M_u|/d_v + |V_u|)/(E_s A_s), with |M_u| ≥ |V_u|d_v, N_u = 0 (axial compression conservatively ignored), and 0 ≤ ε_s ≤ 0.006.
- **Before:**
  ```js
  const dv=Math.max(0.9*d,0.72*o.h);
  const Vc=0.0316*2.0*Math.sqrt(m.fc)*b*dv;           // kips/ft
  ```
- **After:** see R23. Core:
  ```js
  if(o.zeroShearDist!=null) betaMode = o.zeroShearDist<3*dv ? "simple" : "general";
  sxe=Math.min(80,Math.max(12, dv*1.38/((+m.ag||0.75)+0.63)));
  const MuIn=Math.max(Math.abs(o.Mu)*12, Math.abs(o.Vu)*dv);
  epsS=Math.min(0.006, Math.max(0, (MuIn/dv + Math.abs(o.Vu))/(29000*As)));
  betaV=4.8/(1+750*epsS)*51/(39+sxe);
  const Vc=0.0316*betaV*Math.sqrt(m.fc)*b*dv;
  ```
- **Check case (benchmark):**
  - Stem: d = 51.44, d_v = 46.29 in, A_s = 1.333 in²/ft, M_u = 110.15 kip-ft/ft, V_u = 13.11 kip/ft.
    - ε_s = (1321.8/46.29 + 13.11)/(29000·1.333) = 1.078×10⁻³; s_xe = 46.29 in (a_g = 0.75).
    - β = 4.8/1.808·51/85.29 = **1.587**; φV_n 63.19 → **50.15** kip/ft (D/C 0.208 → 0.261).
  - Backwall (h = 18 in ≥ 16): ε_s = 0.448×10⁻³, s_xe = 14.06 in, β = **3.453**. φV_n 19.20 → **33.14** kip/ft (D/C 0.103 → 0.060). **Less conservative**, as the code allows for this lightly loaded section.
  - Toe/heel: L_toe = 3.5 ft and L_heel = 5 ft are both < 3d_v = 7.31 ft, so β = 2.0 (unchanged). With L_toe = 12 ft the toe uses the general procedure (β = 1.41).
- **Other copies of this code:** none.

### F9. Wind per limit state (optional scaling)   [calc change, opt-in] [no result change with the default]
- **Where:** R2/R3/R6 (inputs `factors.vWS3`, `vWS5` = 80, `vWSsvc` = 70), R11 (LIMITS), R20 (stem service), R30 (seat Strength V), R35 (superposition check).
- **Behaviour:**
  - V_III blank or 0 (the default, and the value for all old projects): unchanged; the single WS set is used at γ = 1.0 in Strength III, Strength V and Service I.
  - When V_III is entered (the speed the WS reactions correspond to), Strength V WS is multiplied by (V_V/V_III)² and Service I by (V_SI/V_III)².
- **Governing provision:** AASHTO LRFD 10th Ed., Table 3.8.1.1.2-1 (Strength V 80 mph, Service I 70 mph), Table 3.4.1-1 (γWS = 1.0).
- **Check case:** V_III = 115 mph gives Strength V factor (80/115)² = 0.484 and Service I factor (70/115)² = 0.371. Benchmark Service I q_max 6.845 → 6.778 ksf; strength checks unchanged (Strength V does not govern).
- **Limitation (logged OPEN):** WL is not scaled. The vertical wind load (applies only in Strength III/Service IV in AASHTO) is scaled the same way as the horizontal WS.

### F10. Bug fixes / robustness   [bug fix] [no result change]
- `edmPayload` thermal factor: `factor:+Lg.thermalFactor` (NaN, since `longit.thermalFactor` does not exist) → `factor:(+Lg.thermalFactor||1.2)` (R40). jsdom: payload factor = 1.2.
- postMessage source check (R41):
  - New `fromEDM(src)` accepts only the window this page opened (`EDM_WIN`), or a window whose `opener` is this page (survives a reload).
  - Messages from any other source are ignored. jsdom: a PAD from a foreign source left G unchanged.
- `setProjects` try/catch (R38). Save Project reports "saved" only on success (R39).
- **Circular pad returned from the EDM (R42):** when PAD has `padL`/`padW` null and `D` > 0, the abutment sets padL = D and padW = A/D (A = πD²/4, or the `A` sent).
  - The pad-shear area L·W = A is then exact, and the seat check uses L = D along the span.
  - The status line explains this. The EDM recognises an L × (π/4)L pad on the next hand-off as circular (see `fixlog/elastomeric_design_module.md`).
  - jsdom: D = 16 → padL 16, padW 12.566, L·W = 201.06 in².
- The bearing-loop skip of permutations with the resultant outside the base now raises a warning (R16, R17, R60).

## Open items (not changed)
- O1. **Seismic connection force 0.10(DC + DW)** — kept (MassDOT value; AASHTO 3.10.9.2 gives 0.15/0.25; SubLoads uses 0.15/0.25). Needs MassDOT confirmation.
- O2. **Transverse eccentricity in soil bearing** (L′ = L − 2e_L, 10.6.1.3) — not included; it needs a design decision on the footing-length model.
- O3. **Minimum support length H** uses the stem + backwall height; 4.7.4.4 takes H as the average column height to the next joint (0 for single spans). This is conservative; a new input is needed.
- O4. **E_c = 1820√f′c** (crack-control n only) vs 10th Ed. Eq. 5.4.2.4-1 — small effect; not changed.
- O5. **EE-I γEH default 1.00** vs γp in Table 3.4.1-1 — EOR judgment.
- O6. **Stem eccentric bearing moment** always uses γDC,max and full LL; γmin/LL-off can govern when e_brg < 0 (review item 10).
- O7. **Footing crack control** M_s = M_u/1.4 (flagged in the output).
- O8. **Wind scaling details:** WL not scaled; vertical wind scaled with WS. A full per-limit-state wind input set would be cleaner.
- O9. **V/M diagrams for the heel** still pair max downward factors with the min-V permutation (display only; the check values above use consistent permutations). Toe downward self-weight stays at 0.90·DC.
- O10. **General shear procedure** ignores axial compression (N_u = 0, conservative) and uses s_x = d_v. If the stem has skin reinforcement layers that qualify as crack-control layers, s_x could be smaller (less conservative). The stem/backwall shear is checked at the base values, not at d_v.
- O11. **SubLoads export importer** (`subloads-abutment-v1`) is still not consumed.

## Appendix — exact replacement pairs (apply in order to the original file)
Generated by re-running the edit scripts on the original file; the result is byte-identical to the committed file.

#### R1
Before:
```js
    mat:{fc:4.0, gc:0.150, fy:60.0, coverF:3.0, coverT:2.0}, // ksi, kcf, ksi, in (footing / wall+top)
```
After:
```js
    mat:{fc:4.0, gc:0.150, fy:60.0, coverF:3.0, coverT:2.0, ag:0.75}, // ksi, kcf, ksi, in (footing / wall+top), max aggregate size (in) for the 5.7.3.4.2 s_xe
```

#### R2
Before:
```js
      gTU:0.50, gCR:0.50          // γTU, γCR/SH (strength force effects; EOR confirm)
```
After:
```js
      gTU:0.50, gCR:0.50,         // γTU, γCR/SH (strength force effects; EOR confirm)
      gpDCmaxS4:1.50,             // γDC max for Strength IV [T.3.4.1-2]
      vWS3:0, vWS5:80, vWSsvc:70  // wind speeds (mph): WS reactions are entered at V_III; 0/blank V_III = no per-limit-state scaling [T.3.8.1.1.2-1]
```

#### R3
Before:
```js
  if(S.geom.Lftg===undefined) S.geom.Lftg=S.geom.Lab;   // footing length defaults to wall length (single-length model)
```
After:
```js
  if(S.geom.Lftg===undefined) S.geom.Lftg=S.geom.Lab;   // footing length defaults to wall length (single-length model)
  if(S.mat.ag===undefined) S.mat.ag=0.75;                 // max aggregate size (in), 5.7.3.4.2
  if(S.factors.gpDCmaxS4===undefined) S.factors.gpDCmaxS4=1.50;   // Strength IV γDC max [T.3.4.1-2]
  if(S.factors.vWS3===undefined) S.factors.vWS3=0;                 // 0 = WS not scaled per limit state (previous behaviour)
  if(S.factors.vWS5===undefined) S.factors.vWS5=80;
  if(S.factors.vWSsvc===undefined) S.factors.vWSsvc=70;
```

#### R4
Before:
```js
    ${inpRow("Cover — walls (earth face)","mat.coverT","in")}
  `);
```
After:
```js
    ${inpRow("Cover — walls (earth face)","mat.coverT","in")}
    ${inpRow("Max. aggregate size a<sub>g</sub>","mat.ag","in",{title:"Used in s_xe = s_x·1.38/(a_g+0.63) for the general shear procedure [5.7.3.4.2]"})}
  `);
```

#### R5
Before:
```js
    ${inpRow("γ EH max (active)","factors.gpEHmax","–")}${inpRow("&nbsp;&nbsp;γ EH min","factors.gpEHmin","–")}
```
After:
```js
    ${inpRow("γ EH max (active)","factors.gpEHmax","–")}${inpRow("&nbsp;&nbsp;γ EH min","factors.gpEHmin","–")}
    ${inpRow("γ DC max — Strength IV","factors.gpDCmaxS4","–",{title:"Table 3.4.1-2: DC maximum 1.50 for Strength IV only"})}
```

#### R6
Before:
```js
    ${inpRow("γ WL — Strength V","factors.wlS5","–")}
```
After:
```js
    ${inpRow("γ WL — Strength V","factors.wlS5","–")}
    ${inpRow("Wind speed V for the WS inputs (Strength III)","factors.vWS3","mph",{title:"Blank/0 = WS reactions used unscaled in Strength III, Strength V and Service I (previous behaviour). When entered, Strength V and Service I WS are scaled by (V_LS/V_III)² [Table 3.8.1.1.2-1]."})}
    ${inpRow("&nbsp;&nbsp;Wind speed — Strength V","factors.vWS5","mph")}${inpRow("&nbsp;&nbsp;Wind speed — Service I","factors.vWSsvc","mph")}
```

#### R7
Before:
```js
/* ------------------------------------------------------------
   Calculated longitudinal loads: braking [3.6.4]
```
After:
```js
/* contact-pressure distributions (x from the toe) for a resultant V at signed eccentricity e (+ = toward the toe).
   |e| governs; the diagram is mirrored when the resultant lies on the heel side (e < 0) [10.6.1.3, 11.6.3.3]. */
function meyerSegs(V,e,B,Lf){ const ea=Math.abs(e), Bp=B-2*ea; if(!(V>0)||!(Bp>0)) return null; const q=V/(Bp*Lf);
  return e>=0? [{x0:0,x1:Bp,q0:q,q1:q}] : [{x0:B-Bp,x1:B,q0:q,q1:q}]; }
function linSegs(V,e,B,Lf){ if(!(V>0)) return null; const ea=Math.abs(e);
  if(ea<=B/6) return [{x0:0,x1:B,q0:V/(B*Lf)*(1+6*e/B),q1:V/(B*Lf)*(1-6*e/B)}];
  const Lc=3*(B/2-ea); if(!(Lc>0)) return null; const qm=2*V/(Lc*Lf);
  return e>=0? [{x0:0,x1:Lc,q0:qm,q1:0}] : [{x0:B-Lc,x1:B,q0:0,q1:qm}]; }

/* ------------------------------------------------------------
   Calculated longitudinal loads: braking [3.6.4]
```

#### R8
Before:
```js
  const H = g.tf+g.soilH;                     // retained height at virtual back plane (heel end)
```
After:
```js
  const hWedge = g.Lheel*Math.tan(deg2rad(+g.beta||0)); // sloping backfill: rise of the ground surface over the heel
  const H = g.tf+g.soilH+hWedge;              // retained height at virtual back plane (heel end)
```

#### R9
Before:
```js
  const Wev=( S.soil.gamma*(g.soilH-hwSoil) + (S.soil.gamma-GAMMA_W)*hwSoil )*g.Lheel*Lab;
  R.EV={W:Wev,x:xHeel, dry:g.soilH-hwSoil, sub:hwSoil};
```
After:
```js
  const Wev0=( S.soil.gamma*(g.soilH-hwSoil) + (S.soil.gamma-GAMMA_W)*hwSoil )*g.Lheel*Lab;
  const Wwedge=0.5*S.soil.gamma*g.Lheel*hWedge*Lab, xWedge=xStemBack+2*g.Lheel/3;   // soil wedge above the heel (sloping backfill)
  const Wev=Wev0+Wwedge, xEV=Wev>0?(Wev0*xHeel+Wwedge*xWedge)/Wev:xHeel;
  R.EV={W:Wev,x:xEV, dry:g.soilH-hwSoil, sub:hwSoil, W0:Wev0, Wwedge, xWedge, hWedge};
```

#### R10
Before:
```js
    EV:  {cls:"EV", V:Wev, Mv:Wev*xHeel, Hx:0,Mh:0,Hy:0,Mt:0, desc:"Soil over heel"},
```
After:
```js
    EV:  {cls:"EV", V:Wev, Mv:Wev*xEV, Hx:0,Mh:0,Hy:0,Mt:0, desc:"Soil over heel"+(Wwedge>0?" (incl. slope wedge)":"")},
```

#### R11
Before:
```js
  const F=S.factors;
  const LIMITS={
    "Strength I":  {LL:+F.llS1, WS:0,        WL:0,       TU:+F.gTU, CR:+F.gCR, perm:true , liveOpt:true },
    "Strength III":{LL:0,       WS:+F.wsS3,  WL:0,       TU:+F.gTU, CR:+F.gCR, perm:true , liveOpt:false},
    "Strength V":  {LL:+F.llS5, WS:+F.wsS5,  WL:+F.wlS5, TU:+F.gTU, CR:+F.gCR, perm:true , liveOpt:true },
    "Constr — Str I":{LL:+S.constr.gLL||0, WS:0, WL:0, TU:0, CR:0, perm:true , liveOpt:(+S.constr.gLL||0)>0 , noSuper:true },
    "Service I":   {LL:1.0,     WS:1.0,      WL:1.0,     TU:1.0,    CR:1.0,    perm:false, liveOpt:true }
  };
```
After:
```js
  const F=S.factors;
  // WS reactions are entered for Strength III (wind speed V_III); Strength V / Service I use (V_LS/V_III)² when V_III is given [T.3.8.1.1.2-1]
  const vW3=+F.vWS3||0, wsF5=vW3>0?Math.pow((+F.vWS5||80)/vW3,2):1, wsFsv=vW3>0?Math.pow((+F.vWSsvc||70)/vW3,2):1;
  R.wsScale={vW3,wsF5,wsFsv};
  const LIMITS={
    "Strength I":  {LL:+F.llS1, WS:0,        WL:0,       TU:+F.gTU, CR:+F.gCR, perm:true , liveOpt:true },
    "Strength III":{LL:0,       WS:+F.wsS3,  WL:0,       TU:+F.gTU, CR:+F.gCR, perm:true , liveOpt:false},
    "Strength IV": {LL:0,       WS:0,        WL:0,       TU:+F.gTU, CR:+F.gCR, perm:true , liveOpt:false, dcMax:(+F.gpDCmaxS4||1.50)},   // Table 3.4.1-1; γDC max 1.50 [T.3.4.1-2]
    "Strength V":  {LL:+F.llS5, WS:+F.wsS5*wsF5,  WL:+F.wlS5, TU:+F.gTU, CR:+F.gCR, perm:true , liveOpt:true },
    "Constr — Str I":{LL:+S.constr.gLL||0, WS:0, WL:0, TU:0, CR:0, perm:true , liveOpt:(+S.constr.gLL||0)>0 , noSuper:true },
    "Service I":   {LL:1.0,     WS:1.0*wsFsv,      WL:1.0,     TU:1.0,    CR:1.0,    perm:false, liveOpt:true }
  };
```

#### R12
Before:
```js
      ? `${GP.DC[perm.DC].toFixed(2)}·DC + ${GP.DW[perm.DW].toFixed(2)}·DW
```
After:
```js
      ? `${(perm.DC===1&&L.dcMax?L.dcMax:GP.DC[perm.DC]).toFixed(2)}·DC + ${GP.DW[perm.DW].toFixed(2)}·DW
```

#### R13
Before:
```js
  const STR_LIMITS=["Strength I","Strength III","Strength V","Constr — Str I"]
```
After:
```js
  const STR_LIMITS=["Strength I","Strength III","Strength IV","Strength V","Constr — Str I"]
```

#### R14
Before:
```js
        const xbar=(c.Mv-c.Mh)/c.V, e=B/2-xbar, dc=e/eLim;
        if(dc>ecc.dc) ecc={dc, e, xbar, eLim, V:c.V, Mv:c.Mv, Mh:c.Mh, lbl:c.lbl, ls:lsName, c};
```
After:
```js
        const xbar=(c.Mv-c.Mh)/c.V, eS=B/2-xbar, e=Math.abs(eS), dc=e/eLim;   // |e| [11.6.3.3]; eS < 0 = resultant on the heel side
        if(dc>ecc.dc) ecc={dc, e, eSigned:eS, side:eS>=0?"toe":"heel", xbar, eLim, V:c.V, Mv:c.Mv, Mh:c.Mh, lbl:c.lbl, ls:lsName, c};
```

#### R15
Before:
```js
        const xbar=(c.Mv-c.Mh)/c.V, e=B/2-xbar;
        let q,Bp=NaN,qmax=NaN,mode;
        if(fn.matl==="soil"){
          Bp=B-2*e; if(Bp<=0) continue;
          q=c.V/(Bp*Lftg); mode="uniform";
        }else{
          if(e<=B/6){ q=c.V/(B*Lftg)*(1+6*e/B); mode="trap"; }
          else { q=2*c.V/(3*Lftg*(B/2-e)); mode="tri"; }
        }
        const phiBls=resFor(lsName).phiB;
        if(q/(phiBls*fn.qn)>brg.dc){ brg={dc:q/(phiBls*fn.qn), q, e, Bp, V:c.V, mode, phiB:phiBls, lbl:c.lbl, ls:lsName, c}; }
```
After:
```js
        const xbar=(c.Mv-c.Mh)/c.V, eS=B/2-xbar, e=Math.abs(eS);   // |e| [10.6.1.3]; pressure peak on the side of the resultant
        let q,Bp=NaN,qmax=NaN,mode;
        if(fn.matl==="soil"){
          Bp=B-2*e; if(Bp<=0){ brgOut=true; continue; }
          q=c.V/(Bp*Lftg); mode="uniform";
        }else{
          if(e<=B/6){ q=c.V/(B*Lftg)*(1+6*e/B); mode="trap"; }
          else if(e<B/2){ q=2*c.V/(3*Lftg*(B/2-e)); mode="tri"; }
          else { brgOut=true; continue; }
        }
        const phiBls=resFor(lsName).phiB;
        if(q/(phiBls*fn.qn)>brg.dc){ brg={dc:q/(phiBls*fn.qn), q, e, eSigned:eS, side:eS>=0?"toe":"heel", Bp, V:c.V, mode, phiB:phiBls, lbl:c.lbl, ls:lsName, c}; }
```

#### R16
Before:
```js
    // ---- Bearing [10.6.3.1] ----
    let brg={dc:-1};
```
After:
```js
    // ---- Bearing [10.6.3.1] ----
    let brg={dc:-1}, brgOut=false;
```

#### R17
Before:
```js
    R.checks.bearing=brg;
```
After:
```js
    R.checks.bearing=brg;
    if(brgOut) warn("One or more strength permutations put the factored resultant outside the footing (B′ ≤ 0); they are excluded from the bearing check — see the eccentricity check.","err");
```

#### R18
Before:
```js
      const xbar=(c.Mv-c.Mh)/c.V, e=B/2-xbar;
      let qmax,qmin,Lc=B,mode;
      if(e<=B/6){ qmax=c.V/(B*Lftg)*(1+6*e/B); qmin=c.V/(B*Lftg)*(1-6*e/B); mode="trap"; }
      else { Lc=3*(B/2-e); qmax=2*c.V/(Lc*Lftg); qmin=0; mode="tri"; }
      if(qmax>sv.q) sv={q:qmax,qmin,e,Lc,V:c.V,mode,lbl:c.lbl,c};
```
After:
```js
      const xbar=(c.Mv-c.Mh)/c.V, eS=B/2-xbar, e=Math.abs(eS);   // |e|; diagram mirrored for a heel-side resultant
      let qmax,qmin,Lc=B,mode;
      if(e<=B/6){ qmax=c.V/(B*Lftg)*(1+6*e/B); qmin=c.V/(B*Lftg)*(1-6*e/B); mode="trap"; }
      else if(e<B/2){ Lc=3*(B/2-e); qmax=2*c.V/(Lc*Lftg); qmin=0; mode="tri"; }
      else continue;
      if(qmax>sv.q) sv={q:qmax,qmin,e,eSigned:eS,side:eS>=0?"toe":"heel",Lc,V:c.V,mode,lbl:c.lbl,c};
```

#### R19
Before:
```js
    const Pv = ns*( GP.DC[1]*groups.DCsup.V + GP.DW[1]*groups.DW.V + (L.LL?L.LL*groups.LL.V:0)
             + L.WS*groups.WS.V + L.WL*groups.WL.V );
    const MeccPerFt = ( Pv*(xSc-R.geo.xBrg) + GP.DC[1]*MselfEccTot )/Lab;
```
After:
```js
    const gDCmx = L.dcMax||GP.DC[1];   // Strength IV: γDC max 1.50
    const Pv = ns*( gDCmx*groups.DCsup.V + GP.DW[1]*groups.DW.V + (L.LL?L.LL*groups.LL.V:0)
             + L.WS*groups.WS.V + L.WL*groups.WL.V );
    const MeccPerFt = ( Pv*(xSc-R.geo.xBrg) + gDCmx*MselfEccTot )/Lab;
```

#### R20
Before:
```js
  const HgirdSvc=(groups.BR.Hx+groups.TU.Hx+groups.CRSH.Hx+groups.WS.Hx+groups.WL.Hx)/Lab;
  const PvSvc=groups.DCsup.V+groups.DW.V+groups.LL.V+groups.WS.V+groups.WL.V;
```
After:
```js
  const HgirdSvc=(groups.BR.Hx+groups.TU.Hx+groups.CRSH.Hx+wsFsv*groups.WS.Hx+groups.WL.Hx)/Lab;
  const PvSvc=groups.DCsup.V+groups.DW.V+groups.LL.V+wsFsv*groups.WS.V+groups.WL.V;
```

#### R21
Before:
```js
  if(fn.branch==="spread" && R.checks.bearing && R.checks.bearing.dc>=0){
    const bc=R.checks.bearing;
    let segs;
    if(fn.matl==="soil"){ segs=[{x0:0,x1:Math.max(0,bc.Bp),q0:bc.q,q1:bc.q}]; }
    else{
      if(bc.mode==="trap"){ const q0=bc.q, qL=bc.V/(B*Lftg)*(1-6*bc.e/B); segs=[{x0:0,x1:B,q0:q0,q1:qL}]; }
      else{ const Lc=3*(B/2-bc.e); segs=[{x0:0,x1:Lc,q0:bc.q,q1:0}]; }
    }
    R.qSegs=segs;
    // TOE — section at front face of stem
    const VtoeUp=pressForce(segs,0,g.Ltoe), MtoeUp=pressMoment(segs,0,g.Ltoe,g.Ltoe);
    const MtoeDn=0.9*wFoot*g.Ltoe*g.Ltoe/2, VtoeDn=0.9*wFoot*g.Ltoe;
    const dvT=Math.max(0.9*(g.tf*12-m.coverF-BARS[S.reinf.toe.size].db/2),0.72*g.tf*12)/12; // ft
    const VtoeUp_dv=pressForce(segs,0,Math.max(0,g.Ltoe-dvT));
    toeDem={Mu:Math.max(0,MtoeUp-MtoeDn), Vu:Math.max(0,VtoeUp_dv-0.9*wFoot*Math.max(0,g.Ltoe-dvT)),
      VtoeUp,MtoeUp,MtoeDn,dvT, lbl:bc.lbl+" ("+bc.ls+")", src:"bearing"};
    // HEEL — section at back face of stem; downward soil+self+LS, upward pressure if any reaches heel
    const wDn=(+F.gpEVmax)*wSoilHeel+(+F.gpDCmax)*wFoot+gLL_str*wLSv+GP.ES[1]*esQ;
    const MheelDn=wDn*g.Lheel*g.Lheel/2, VheelDn=wDn*g.Lheel;
    const MheelUp=pressMoment(segs,xStemBack,B,xStemBack), VheelUp=pressForce(segs,xStemBack,B);
    heelDem={Mu:Math.max(0,MheelDn-MheelUp), Vu:Math.max(0,VheelDn-VheelUp),
      wDn,MheelDn,VheelDn,MheelUp,VheelUp, face:"top",
      lbl:`${(+F.gpEVmax).toFixed(2)}·EV + ${(+F.gpDCmax).toFixed(2)}·DC + ${gLL_str.toFixed(2)}·LS − bearing (governing case)`, src:"bearing"};
  }else if
```
After:
```js
  // slope wedge over the heel (triangular, 0 at the stem back face → γ·h_wedge at the heel end): per-ft shear and moment at the stem back face
  const wedgeV=0.5*gam*R.EV.hWedge*g.Lheel, wedgeM=gam*R.EV.hWedge*g.Lheel*g.Lheel/3;
  // per-ft heel loads for permutation c, with that permutation's own factors (consistent combination)
  function heelLoads(c){ const cc=!!LIMITS[c.lsName].noSuper, gs=c.gset;
    const gEV=gs[cc?"EVC":"EV"]||0, gDC=gs.DCsub||0, gLS=gs[cc?"LSvC":"LSv"]||0, gES=gs.ESv||0;
    const wS=cc? gam*Math.min(R.constrC.hfC,g.soilH) : wSoilHeel, wL=cc? gam*R.constrC.heqC : wLSv;
    const wDn=gEV*wS+gDC*wFoot+gLS*wL+gES*esQ;
    return {gEV,gDC,gLS,gES,wDn, MheelDn:wDn*g.Lheel*g.Lheel/2+(cc?0:gEV*wedgeM), VheelDn:wDn*g.Lheel+(cc?0:gEV*wedgeV)}; }
  R.heelLoads=heelLoads;
  if(fn.branch==="spread" && R.checks.bearing && R.checks.bearing.dc>=0){
    const bc=R.checks.bearing;
    // governing bearing case as used in the bearing check (diagram + equilibrium closure)
    R.qSegs=(fn.matl==="soil"? meyerSegs(bc.V,bc.eSigned,B,Lftg) : linSegs(bc.V,bc.eSigned,B,Lftg))||[];
    // TOE & HEEL — structural design uses the linear (trapezoidal/triangular) contact pressure [10.6.5, 11.6.3.2],
    // evaluated for every strength permutation; the heel's downward loads use the same permutation's factors.
    const MtoeDn=0.9*wFoot*g.Ltoe*g.Ltoe/2;
    const dvT=Math.max(0.9*(g.tf*12-m.coverF-BARS[S.reinf.toe.size].db/2),0.72*g.tf*12)/12; // ft
    let tM=null,tV=null,hM=null,hV=null;
    for(const lsName of STR_LIMITS){
      for(const pl of permutations(lsName)){
        const c=comboEffects(lsName,pl.perm,pl.liveOn,false);
        if(c.V<=0) continue;
        const eS=B/2-(c.Mv-c.Mh)/c.V, segs=linSegs(c.V,eS,B,Lftg); if(!segs) continue;
        const VtoeUp=pressForce(segs,0,g.Ltoe), MtoeUp=pressMoment(segs,0,g.Ltoe,g.Ltoe);
        const VtoeUp_dv=pressForce(segs,0,Math.max(0,g.Ltoe-dvT));
        const tMu=Math.max(0,MtoeUp-MtoeDn), tVu=Math.max(0,VtoeUp_dv-0.9*wFoot*Math.max(0,g.Ltoe-dvT));
        if(!tM||tMu>tM.Mu) tM={Mu:tMu,VtoeUp,MtoeUp,c,ls:lsName,eS,segs};
        if(!tV||tVu>tV.Vu) tV={Vu:tVu,c,ls:lsName};
        const hl=heelLoads(c), MheelUp=pressMoment(segs,xStemBack,B,xStemBack), VheelUp=pressForce(segs,xStemBack,B);
        const hMu=Math.max(0,hl.MheelDn-MheelUp), hVu=Math.max(0,hl.VheelDn-VheelUp);
        if(!hM||hMu>hM.Mu) hM={Mu:hMu,...hl,MheelUp,VheelUp,c,ls:lsName,eS};
        if(!hV||hVu>hV.Vu) hV={Vu:hVu,c,ls:lsName};
      }
    }
    if(tM){
      toeDem={Mu:tM.Mu, Vu:tV.Vu, VtoeUp:tM.VtoeUp, MtoeUp:tM.MtoeUp, MtoeDn, dvT, eS:tM.eS, ls:tM.ls, lsV:tV.ls,
        lbl:tM.c.lbl+" ("+tM.ls+")", src:"bearing"};
      heelDem={Mu:hM.Mu, Vu:hV.Vu, wDn:hM.wDn, gEV:hM.gEV, gDC:hM.gDC, gLS:hM.gLS, gES:hM.gES, MheelDn:hM.MheelDn, VheelDn:hM.VheelDn,
        MheelUp:hM.MheelUp, VheelUp:hM.VheelUp, wedgeM:hM.gEV*wedgeM, eS:hM.eS, ls:hM.ls, lsV:hV.ls, face:"top",
        lbl:hM.c.lbl+" ("+hM.ls+") − linear bearing, same permutation", src:"bearing"};
    }else{ toeDem={Mu:0,Vu:0,lbl:"—",src:"none"}; heelDem={Mu:0,Vu:0,face:"top",lbl:"—",src:"none"}; }
  }else if
```

#### R22
Before:
```js
    const wDn=(+F.gpEVmax)*wSoilHeel+(+F.gpDCmax)*wFoot+gLL_str*wLSv+GP.ES[1]*esQ;
    const MheelDn=wDn*g.Lheel*g.Lheel/2, VheelDn=wDn*g.Lheel;
    const Mnet=MheelDn-MheelUp;
    heelDem={Mu:Math.abs(Mnet), Vu:Math.abs(VheelDn-VheelUp), face:Mnet>=0?"top":"bottom",
      wDn,MheelDn,VheelDn,MheelUp,VheelUp, lbl:`${(+F.gpEVmax).toFixed(2)}·EV + ${(+F.gpDCmax).toFixed(2)}·DC + ${gLL_str.toFixed(2)}·LS − pile reactions`, src:"pile"};
```
After:
```js
    // HEEL — every strength permutation; downward loads and pile reactions from the same permutation (consistent combination)
    let hTop=null,hBot=null,hV=null;
    for(const lsName of STR_LIMITS){
      for(const pl of permutations(lsName)){
        const c=comboEffects(lsName,pl.perm,pl.liveOn,false);
        const loads=pileLoadsFor(c); if(!loads) continue;
        let MhU=0,VhU=0;
        act.forEach((pp,i)=>{ const xT=B/2+pp.x; if(xT>xStemBack){ VhU+=loads[i]/Lftg; MhU+=loads[i]/Lftg*(xT-xStemBack); } });
        const hl=heelLoads(c), Mnet=hl.MheelDn-MhU, Vnet=Math.abs(hl.VheelDn-VhU);
        const rec={Mnet,...hl,MheelUp:MhU,VheelUp:VhU,c,ls:lsName};
        if(!hTop||Mnet>hTop.Mnet) hTop=rec;
        if(!hBot||Mnet<hBot.Mnet) hBot=rec;
        if(!hV||Vnet>hV.Vu) hV={Vu:Vnet,c,ls:lsName};
      }
    }
    const hG=(hTop&&hTop.Mnet>0)? hTop : hBot;
    if(hG){
      heelDem={Mu:Math.abs(hG.Mnet), Vu:hV.Vu, face:hG.Mnet>=0?"top":"bottom",
        wDn:hG.wDn, gEV:hG.gEV, gDC:hG.gDC, gLS:hG.gLS, gES:hG.gES, MheelDn:hG.MheelDn, VheelDn:hG.VheelDn, MheelUp:hG.MheelUp, VheelUp:hG.VheelUp,
        wedgeM:hG.gEV*wedgeM, ls:hG.ls, lsV:hV.ls, lbl:hG.c.lbl+" ("+hG.ls+") − pile reactions, same permutation", src:"pile"};
      if(hG===hTop && hBot && hBot.Mnet<0) warn(`Heel: some strength permutations (e.g. ${hBot.ls}) give BOTTOM tension (M = ${fmt(-hBot.Mnet)} kip-ft/ft) — the heel is checked for top steel only; check bottom steel by hand.`,"warn");
    }else heelDem={Mu:0,Vu:0,face:"top",lbl:"—",src:"none"};
```

#### R23
Before:
```js
    // shear [5.7.3.3] with β=2.0 simplified
    const dv=Math.max(0.9*d,0.72*o.h);
    const Vc=0.0316*2.0*Math.sqrt(m.fc)*b*dv;           // kips/ft
```
After:
```js
    // shear [5.7.3.3]: β = 2.0 only where 5.7.3.4.1 permits it; otherwise the general procedure [5.7.3.4.2] (no transverse reinforcement)
    const dv=Math.max(0.9*d,0.72*o.h);
    let betaMode=o.betaMode||"simple";
    if(o.zeroShearDist!=null) betaMode = o.zeroShearDist<3*dv ? "simple" : "general";   // footings: zero-shear point within 3dv of the face
    let betaV=2.0, epsS=null, sxe=null;
    if(betaMode==="general"){
      sxe=Math.min(80,Math.max(12, dv*1.38/((+m.ag||0.75)+0.63)));                 // s_x = d_v (no intermediate crack-control layers) [Eq. 5.7.3.4.2-7]
      const MuIn=Math.max(Math.abs(o.Mu)*12, Math.abs(o.Vu)*dv);                    // |Mu| ≥ |Vu|·dv, k-in/ft
      epsS=Math.min(0.006, Math.max(0, (MuIn/dv + Math.abs(o.Vu))/(29000*As)));     // N_u conservatively 0 [Eq. 5.7.3.4.2-4]
      betaV=4.8/(1+750*epsS)*51/(39+sxe);                                             // [Eq. 5.7.3.4.2-2]
    }
    const Vc=0.0316*betaV*Math.sqrt(m.fc)*b*dv;         // kips/ft
```

#### R24
Before:
```js
    const hIn=o.h, LIn=b;
    let AsST=1.30*b*hIn/(2*(b+hIn)*m.fy);
```
After:
```js
    const hIn=o.hST||o.h, bST=o.bST||b;                 // b = least width, h = least thickness of the component (in) [Eq. 5.10.6-1]
    let AsST=1.30*bST*hIn/(2*(bST+hIn)*m.fy);
```

#### R25
Before:
```js
      dv, Vc, phiVn, dcFlex:o.Mu/phiMn, dcShear:o.Vu/phiVn,
      rho,k,j,fss,dcBar:dc,betaS,sMax, crackOK:o.sp<=sMax, ld, AsST, gE, skinNote, skinAsk};
```
After:
```js
      dv, Vc, phiVn, dcFlex:o.Mu/phiMn, dcShear:o.Vu/phiVn, betaMode, betaV, epsS, sxe,
      rho,k,j,fss,dcBar:dc,betaS,sMax, crackOK:o.sp<=sMax, ld, AsST, bST, hST:hIn, gE, skinNote, skinAsk};
```

#### R26
Before:
```js
  R.checks.bwFlex=sectionCheck({name:"Backwall", h:g.tbw*12, cover:m.coverT, bar:S.reinf.bw.size,
    sp:+S.reinf.bw.sp, Mu:MuBW, Vu:VuBW, Ms:MsBW, lbl:R.bwDem.lbl});
```
After:
```js
  R.checks.bwFlex=sectionCheck({name:"Backwall", h:g.tbw*12, cover:m.coverT, bar:S.reinf.bw.size,
    sp:+S.reinf.bw.sp, Mu:MuBW, Vu:VuBW, Ms:MsBW, lbl:R.bwDem.lbl,
    bST:Math.min(Lab,g.hbw)*12, hST:g.tbw*12, betaMode:g.tbw*12<16?"simple":"general"});
```

#### R27
Before:
```js
  R.checks.stemFlex=sectionCheck({name:"Stem", h:g.tsb*12, cover:m.coverT, bar:S.reinf.stem.size,
    sp:+S.reinf.stem.sp, Mu:stemGov.Mu, Vu:stemGov.Vu, Ms:MsStem, lbl:stemGov.lbl});
```
After:
```js
  R.checks.stemFlex=sectionCheck({name:"Stem", h:g.tsb*12, cover:m.coverT, bar:S.reinf.stem.size,
    sp:+S.reinf.stem.sp, Mu:stemGov.Mu, Vu:stemGov.Vu, Ms:MsStem, lbl:stemGov.lbl,
    bST:Math.min(Lab,g.hstem)*12, hST:Math.min(g.tst,g.tsb)*12, betaMode:g.tsb*12<16?"simple":"general"});
```

#### R28
Before:
```js
  R.checks.toeFlex=sectionCheck({name:"Toe", h:g.tf*12, cover:m.coverF, bar:S.reinf.toe.size,
    sp:+S.reinf.toe.sp, Mu:toeDem.Mu, Vu:toeDem.Vu, Ms:toeDem.Mu/1.4, lbl:toeDem.lbl});
  R.checks.heelFlex=sectionCheck({name:"Heel", h:g.tf*12, cover:m.coverF, bar:S.reinf.heel.size,
    sp:+S.reinf.heel.sp, Mu:heelDem.Mu, Vu:heelDem.Vu, Ms:heelDem.Mu/1.4, lbl:heelDem.lbl});
```
After:
```js
  R.checks.toeFlex=sectionCheck({name:"Toe", h:g.tf*12, cover:m.coverF, bar:S.reinf.toe.size,
    sp:+S.reinf.toe.sp, Mu:toeDem.Mu, Vu:toeDem.Vu, Ms:toeDem.Mu/1.4, lbl:toeDem.lbl,
    bST:Math.min(B,Lftg)*12, hST:g.tf*12, zeroShearDist:g.Ltoe*12});
  R.checks.heelFlex=sectionCheck({name:"Heel", h:g.tf*12, cover:m.coverF, bar:S.reinf.heel.size,
    sp:+S.reinf.heel.sp, Mu:heelDem.Mu, Vu:heelDem.Vu, Ms:heelDem.Mu/1.4, lbl:heelDem.lbl,
    bST:Math.min(B,Lftg)*12, hST:g.tf*12, zeroShearDist:g.Lheel*12});
```

#### R29
Before:
```js
                roughened:{c:0.28,mu:1.0,K1:0.30,K2:1.8,name:"against hardened concrete, roughened ¼ in"},
```
After:
```js
                roughened:{c:0.24,mu:1.0,K1:0.25,K2:1.5,name:"against hardened concrete, roughened ¼ in"},   // 5.7.4.4 (normal-weight concrete against hardened, roughened concrete; 0.28/0.30/1.8 is for a CIP slab on girders)
```

#### R30
Before:
```js
      const SV=GP.DC[1]*S.rx.DC[i].P+GP.DW[1]*S.rx.DW[i].P+(+F.llS5)*S.rx.LL[i].P
               +(+F.wsS5)*S.rx.WS[i].P+(+F.wlS5)*S.rx.WL[i].P;
      if(SI>Pu){Pu=SI;pgirder=i+1;pls="Strength I";}
      if(SV>Pu){Pu=SV;pgirder=i+1;pls="Strength V";}
```
After:
```js
      const SV=GP.DC[1]*S.rx.DC[i].P+GP.DW[1]*S.rx.DW[i].P+(+F.llS5)*S.rx.LL[i].P
               +(+F.wsS5)*wsF5*S.rx.WS[i].P+(+F.wlS5)*S.rx.WL[i].P;
      const SIV=LIMITS["Strength IV"].dcMax*S.rx.DC[i].P+GP.DW[1]*S.rx.DW[i].P;
      if(SI>Pu){Pu=SI;pgirder=i+1;pls="Strength I";}
      if(SIV>Pu){Pu=SIV;pgirder=i+1;pls="Strength IV";}
      if(SV>Pu){Pu=SV;pgirder=i+1;pls="Strength V";}
```

#### R31
Before:
```js
    const xbar=(c.Mv-c.Mh)/c.V, e=B/2-xbar;
    if(fn.matl==="soil"){ const Bp=B-2*e; if(Bp<=0) return null; const q=c.V/(Bp*Lftg); return [{x0:0,x1:Bp,q0:q,q1:q}]; }
    if(e<=B/6){ return [{x0:0,x1:B,q0:c.V/(B*Lftg)*(1+6*e/B),q1:c.V/(B*Lftg)*(1-6*e/B)}]; }
    const Lc=3*(B/2-e); return [{x0:0,x1:Lc,q0:2*c.V/(Lc*Lftg),q1:0}];
```
After:
```js
    const xbar=(c.Mv-c.Mh)/c.V, e=B/2-xbar;
    return linSegs(c.V,e,B,Lftg);   // structural design of the footing: linear contact pressure [10.6.5], mirrored for a heel-side resultant
```

#### R32
Before:
```js
    const fDCmax = isLS?(Lst.perm?GP.DC[1]:1.0):one("DC");
```
After:
```js
    const fDCmax = isLS?(Lst.perm?(Lst.dcMax||GP.DC[1]):1.0):one("DC");
```

#### R33
Before:
```js
      const wDn = isLS ? (fEVmax*wSoil_ls + fDCmax*wFoot + fLS*wLSv_ls + fES*esQv)
                       : ((key==="EV"?wSoilHeel:0) + (key==="DC"?wFoot:0) + (key==="LS"?wLSv:0) + (key==="ES"?esQv:0));
      for(let i=0;i<NST;i++){ const xl=g.Lheel*i/(NST-1); st.push(xl); const xg=B-xl; w.push(qFn(xg) - wDn); }
```
After:
```js
      const wDn = isLS ? (fEVmax*wSoil_ls + fDCmax*wFoot + fLS*wLSv_ls + fES*esQv)
                       : ((key==="EV"?wSoilHeel:0) + (key==="DC"?wFoot:0) + (key==="LS"?wLSv:0) + (key==="ES"?esQv:0));
      const fWdg = cctx?0:(isLS?fEVmax:(key==="EV"?1:0)), hW=R.EV.hWedge;   // slope wedge: γ·h_wedge·(L_heel − x_l)/L_heel
      for(let i=0;i<NST;i++){ const xl=g.Lheel*i/(NST-1); st.push(xl); const xg=B-xl; w.push(qFn(xg) - wDn - fWdg*gam*hW*(g.Lheel>0?(g.Lheel-xl)/g.Lheel:0)); }
```

#### R34
Before:
```js
    return { DC:L.perm?GP.DC[1]:1, DW:ns*(L.perm?GP.DW[1]:1)
```
After:
```js
    return { DC:L.perm?(L.dcMax||GP.DC[1]):1, DW:ns*(L.perm?GP.DW[1]:1)
```

#### R35
Before:
```js
    keys.forEach(k=>{ const v=buildVM("load:"+k);
      sumStem+=v.stem.M[v.stem.M.length-1]; sumBw+=v.backwall.M[v.backwall.M.length-1]; });
```
After:
```js
    keys.forEach(k=>{ const v=buildVM("load:"+k), f=(k==="WS"?wsFsv:1);   // Service I WS factor (V_SI/V_III)² when wind scaling is on
      sumStem+=f*v.stem.M[v.stem.M.length-1]; sumBw+=f*v.backwall.M[v.backwall.M.length-1]; });
```

#### R36
Before:
```js
    const bc=R.checks.bearing, xbar=B/2-bc.e;
```
After:
```js
    const bc=R.checks.bearing, xbar=B/2-bc.eSigned;
```

#### R37
Before:
```js
      ["factors.gpEHmax",1.50,"γEH max (active) [T.3.4.1-2]"],["factors.gpEHmin",0.90,"γEH min [T.3.4.1-2]"],
```
After:
```js
      ["factors.gpEHmax",1.50,"γEH max (active) [T.3.4.1-2]"],["factors.gpEHmin",0.90,"γEH min [T.3.4.1-2]"],
      ["factors.gpDCmaxS4",1.50,"γDC max Strength IV [T.3.4.1-2]"],
```

#### R38
Before:
```js
function setProjects(o){ localStorage.setItem(PROJ_KEY,JSON.stringify(o)); }
```
After:
```js
function setProjects(o){ try{ localStorage.setItem(PROJ_KEY,JSON.stringify(o)); return true; }catch(e){ alert("Could not save to this browser's local storage ("+e.message+"). Use Export JSON for a backup."); return false; } }
```

#### R39
Before:
```js
  all[name]={state:clone(S), ts:Date.now()};
  setProjects(all);
  document.getElementById("saveStatus").textContent=`project "${name}" saved`;
  markSavedFp();
```
After:
```js
  all[name]={state:clone(S), ts:Date.now()};
  if(!setProjects(all)) return;
  document.getElementById("saveStatus").textContent=`project "${name}" saved`;
  markSavedFp();
```

#### R40
Before:
```js
    thermal:{span:+g.spanL,alpha:+Lg.cte,dT:Math.max(+Lg.dTrise,+Lg.dTfall),factor:+Lg.thermalFactor},
```
After:
```js
    thermal:{span:+g.spanL,alpha:+Lg.cte,dT:Math.max(+Lg.dTrise,+Lg.dTfall),factor:(+Lg.thermalFactor||1.2)},
```

#### R41
Before:
```js
window.addEventListener("message",ev=>{
  const d=ev.data; if(!d||d.app!=="abutment-edm") return;
```
After:
```js
function fromEDM(src){   // accept messages only from the EDM window this page opened (or one opened by this page before a reload)
  if(!src) return false; if(EDM_WIN && src===EDM_WIN) return true;
  try{ return src.opener===window; }catch(e){ return false; } }
window.addEventListener("message",ev=>{
  const d=ev.data; if(!d||d.app!=="abutment-edm") return;
  if(!fromEDM(ev.source)) return;
```

#### R42
Before:
```js
    if(p.padL) S.bearing.padL=+p.padL; if(p.padW) S.bearing.padW=+p.padW;
    if(p.nBrgPerGird) S.bearing.nBrgPerGird=+p.nBrgPerGird;
    buildInputs(); recalcAll(); scheduleSave();
    document.getElementById("saveStatus").textContent="pad received from EDM — thermal/creep force updated"+(p.govDC?` (D/C ${(+p.govDC).toFixed(2)})`:"");
```
After:
```js
    let circNote="";
    if(p.padL) S.bearing.padL=+p.padL; if(p.padW) S.bearing.padW=+p.padW;
    if(!p.padL && !p.padW && +p.D>0){   // circular pad: L = D along the span, W = A/D so that L·W = πD²/4 (equal area for the pad shear force and seat bearing)
      const D=+p.D, A=(+p.A>0)?+p.A:Math.PI*D*D/4;
      S.bearing.padL=D; S.bearing.padW=+(A/D).toFixed(4);
      circNote=` · circular pad D = ${D.toFixed(2)} in entered as L = D, W = πD/4 = ${(A/D).toFixed(2)} in (equal area)`;
    }
    if(p.nBrgPerGird) S.bearing.nBrgPerGird=+p.nBrgPerGird;
    buildInputs(); recalcAll(); scheduleSave();
    document.getElementById("saveStatus").textContent="pad received from EDM — thermal/creep force updated"+(p.govDC?` (D/C ${(+p.govDC).toFixed(2)})`:"")+circNote;
```

#### R43
Before:
```js
        `e = \\dfrac{${fmtT(geo.B)}}{2} - ${fmtT(ec.xbar)} = ${fmtT(ec.e)}\\ \\text{ft}`])}
```
After:
```js
        `e = \\dfrac{${fmtT(geo.B)}}{2} - ${fmtT(ec.xbar)} = ${fmtT(ec.eSigned)}\\ \\text{ft}\\,, \\qquad |e| = ${fmtT(ec.e)}\\ \\text{ft}\\ (\\text{resultant on the ${ec.side} side})`])}
```

#### R44
Before:
```js
      ${checkLine("Eccentricity",`\\dfrac{e}{e_{lim}} = \\dfrac{${fmtT(ec.e)}}{${fmtT(ec.eLim)}}`,ec.dc)}
```
After:
```js
      ${checkLine("Eccentricity",`\\dfrac{|e|}{e_{lim}} = \\dfrac{${fmtT(ec.e)}}{${fmtT(ec.eLim)}}`,ec.dc)}
```

#### R45
Before:
```js
            "B' = B - 2e\\,, \\qquad q_f = \\dfrac{\\Sigma V_f}{B'\\,L_{ftg}}",
```
After:
```js
            "B' = B - 2|e|\\,, \\qquad q_f = \\dfrac{\\Sigma V_f}{B'\\,L_{ftg}}",
```

#### R46
Before:
```js
      <div class="figcap">Bearing-pressure distributions: Service I (trapezoidal/triangular) and governing Strength (effective uniform over B′ for soil; linear for rock). Toggle series in the legend.</div>
```
After:
```js
      <div class="figcap">Bearing-pressure distributions: Service I (trapezoidal/triangular) and governing Strength (effective uniform over B′ for soil; linear for rock). |e| is used; the governing resultant is on the <b>${bc.side||"toe"}</b> side${bc.side==="heel"?" (diagram mirrored — peak at the heel)":""}. Toggle series in the legend.</div>
```

#### R47
Before:
```js
    let xsv=[],qsv=[];
    if(sv.mode==="trap"){ xsv=[0,B]; qsv=[sv.q,sv.qmin]; }
    else { xsv=[0,sv.Lc,sv.Lc,B]; qsv=[sv.q,0,0,0]; }
    let xst=[],qst=[];
    if(S.fnd.matl==="soil"){ xst=[0,bc.Bp,bc.Bp,B]; qst=[bc.q,bc.q,0,0]; }
    else if(bc.mode==="trap"){ xst=[0,B]; qst=[bc.q,bc.V/(B*(+S.geom.Lftg||S.geom.Lab))*(1-6*bc.e/B)]; }
    else { const Lc=3*(B/2-bc.e); xst=[0,Lc,Lc,B]; qst=[bc.q,0,0,0]; }
```
After:
```js
    let xsv=[],qsv=[];
    if(sv.mode==="trap"){ xsv=[0,B]; qsv=[sv.q,sv.qmin]; }
    else { xsv=[0,sv.Lc,sv.Lc,B]; qsv=[sv.q,0,0,0]; }
    let xst=[],qst=[];
    if(S.fnd.matl==="soil"){ xst=[0,bc.Bp,bc.Bp,B]; qst=[bc.q,bc.q,0,0]; }
    else if(bc.mode==="trap"){ xst=[0,B]; qst=[bc.q,bc.V/(B*(+S.geom.Lftg||S.geom.Lab))*(1-6*bc.e/B)]; }
    else { const Lc=3*(B/2-bc.e); xst=[0,Lc,Lc,B]; qst=[bc.q,0,0,0]; }
    // heel-side resultant: mirror the diagrams about the footing centre (peak at the heel)
    const mir=(xs,qs)=>{ const n=xs.length; return [xs.map((x,i)=>B-xs[n-1-i]), qs.map((q,i)=>qs[n-1-i])]; };
    if(sv.side==="heel") [xsv,qsv]=mir(xsv,qsv);
    if(bc.side==="heel") [xst,qst]=mir(xst,qst);
```

#### R48
Before:
```js
    if(S.fnd.matl==="soil" && bc.Bp){
      bShapes.push({type:"rect",x0:0,x1:bc.Bp,y0:0,y1:bc.q,fillcolor:"rgba(198,40,40,0.07)",line:{width:0},layer:"below"});
      const xr=bc.Bp/2;
```
After:
```js
    if(S.fnd.matl==="soil" && bc.Bp){
      const xb0=bc.side==="heel"?B-bc.Bp:0;
      bShapes.push({type:"rect",x0:xb0,x1:xb0+bc.Bp,y0:0,y1:bc.q,fillcolor:"rgba(198,40,40,0.07)",line:{width:0},layer:"below"});
      const xr=xb0+bc.Bp/2;
```

#### R49
Before:
```js
      text:`B′ = ${fmt(bc.Bp||B)} ft · e = ${fmt(bc.e||0)} ft<br>
```
After:
```js
      text:`B′ = ${fmt(bc.Bp||B)} ft · |e| = ${fmt(bc.e||0)} ft (${bc.side||"toe"} side)<br>
```

#### R50
Before:
```js
        "Pressure distribution from the governing strength bearing case (uniform over B′ on soil; linear on rock). Soil above the toe neglected (conservative).")
```
After:
```js
        `Linear (trapezoidal/triangular) contact pressure for structural design [10.6.5], from the strength permutation that gives the largest toe moment (${esc(td.ls||"")}); V<sub>u</sub> from the permutation giving the largest shear (${esc(td.lsV||"")}). Soil above the toe neglected (conservative).`)
```

#### R51
Before:
```js
      `w_{dn} = \\gamma_{EV}w_{soil} + \\gamma_{DC}w_{ftg} + \\gamma_{LL}w_{LS} = ${fmtT(hd.wDn,3)}\\ \\text{ksf}`,
      `M_{dn} = w_{dn}\\dfrac{L_{heel}^2}{2} = (${fmtT(hd.wDn,3)})\\dfrac{(${fmtT(g.Lheel)})^2}{2} = ${fmtT(hd.MheelDn)}\\ \\text{kip-ft/ft}\\,, \\qquad M_{up} = ${fmtT(hd.MheelUp)}\\ \\text{kip-ft/ft}`,
```
After:
```js
      `w_{dn} = \\gamma_{EV}w_{soil} + \\gamma_{DC}w_{ftg} + \\gamma_{LL}w_{LS} + \\gamma_{ES}q_{ES} = ${fmtT(hd.gEV)}w_{soil} + ${fmtT(hd.gDC)}w_{ftg} + ${fmtT(hd.gLS)}w_{LS} + ${fmtT(hd.gES)}q_{ES} = ${fmtT(hd.wDn,3)}\\ \\text{ksf}`,
      `M_{dn} = w_{dn}\\dfrac{L_{heel}^2}{2}${hd.wedgeM>0?" + \\gamma_{EV}\\,\\gamma\\,h_{wedge}\\dfrac{L_{heel}^2}{3}":""} = ${fmtT(hd.MheelDn)}\\ \\text{kip-ft/ft}\\,, \\qquad M_{up} = ${fmtT(hd.MheelUp)}\\ \\text{kip-ft/ft}`,
```

#### R52
Before:
```js
      hd.src==="bearing"?"Upward bearing included only where the effective/linear pressure block reaches the heel.":"Pile rows behind the stem back face reduce (or reverse) the downward heel moment.");
```
After:
```js
      (hd.src==="bearing"?"Upward bearing from the linear (trapezoidal/triangular) contact pressure [10.6.5].":"Pile rows behind the stem back face reduce (or reverse) the downward heel moment.")+` Every strength permutation is evaluated with its own factors on both the downward loads and the reaction (consistent combination); governing: ${esc(hd.ls||"")}${hd.lsV&&hd.lsV!==hd.ls?`, V<sub>u</sub> from ${esc(hd.lsV)}`:""}.`);
```

#### R53
Before:
```js
    ${eqB("Concrete shear resistance (β = 2.0 simplified)","AASHTO 5.7.3.3 (Eq. 5.7.3.3-3), 5.7.2.8",[
      "d_v = \\max(0.9d,\\,0.72h)\\,, \\qquad V_c = 0.0316\\,\\beta\\sqrt{f'_c}\\,b_v d_v",
      `d_v = \\max(0.9\\times${fmtT(c.d)},\\,0.72\\times${fmtT(c.h,1)}) = ${fmtT(c.dv)}\\ \\text{in}`,
      `\\varphi V_n = 0.90\\times0.0316(2.0)\\sqrt{${fmtT(m.fc,1)}}\\,(12)(${fmtT(c.dv)}) = ${fmtT(c.phiVn)}\\ \\text{kip/ft}`])}
```
After:
```js
    ${eqB(c.betaMode==="general"?"Concrete shear resistance — general procedure, no transverse reinforcement":"Concrete shear resistance (β = 2.0 simplified)",c.betaMode==="general"?"AASHTO 5.7.3.3 (Eq. 5.7.3.3-3), 5.7.3.4.2 (Eqs. 5.7.3.4.2-2, -4, -7)":"AASHTO 5.7.3.3 (Eq. 5.7.3.3-3), 5.7.3.4.1",[
      "d_v = \\max(0.9d,\\,0.72h)\\,, \\qquad V_c = 0.0316\\,\\beta\\sqrt{f'_c}\\,b_v d_v",
      `d_v = \\max(0.9\\times${fmtT(c.d)},\\,0.72\\times${fmtT(c.h,1)}) = ${fmtT(c.dv)}\\ \\text{in}`].concat(c.betaMode==="general"?[
      `s_{xe} = d_v\\dfrac{1.38}{a_g+0.63} = ${fmtT(c.sxe)}\\ \\text{in}\\,(12 \\le s_{xe} \\le 80)\\,, \\qquad \\varepsilon_s = \\dfrac{|M_u|/d_v + |V_u|}{E_s A_s} = ${fmtT(c.epsS*1000,3)}\\times10^{-3}`,
      `\\beta = \\dfrac{4.8}{1+750\\varepsilon_s}\\cdot\\dfrac{51}{39+s_{xe}} = ${fmtT(c.betaV,3)}`]:[]).concat([
      `\\varphi V_n = 0.90\\times0.0316(${fmtT(c.betaV,3)})\\sqrt{${fmtT(m.fc,1)}}\\,(12)(${fmtT(c.dv)}) = ${fmtT(c.phiVn)}\\ \\text{kip/ft}`]),
      c.betaMode==="general"?"β = 2.0 is not permitted here [5.7.3.4.1]: no minimum transverse reinforcement and h ≥ 16 in (walls), or the zero-shear point is not within 3d<sub>v</sub> of the face (footings). General procedure with s<sub>x</sub> = d<sub>v</sub>, N<sub>u</sub> = 0 (axial compression conservatively ignored), |M<sub>u</sub>| ≥ |V<sub>u</sub>|d<sub>v</sub>, 0 ≤ ε<sub>s</sub> ≤ 0.006.":"β = 2.0 permitted by 5.7.3.4.1 (footing with the zero-shear point within 3d<sub>v</sub> of the face, or h < 16 in).")}
```

#### R54
Before:
```js
      `A_{s,ST} \\ge \\dfrac{1.30\\,b\\,h}{2(b+h)f_y} = \\dfrac{1.30(12)(${fmtT(c.h,1)})}{2(12+${fmtT(c.h,1)})(${fmtT(m.fy,1)})} = ${fmtT(c.AsST)}\\ \\text{in}^2/\\text{ft} \\quad (0.11 \\le A_{s,ST} \\le 0.60)`,
```
After:
```js
      `A_{s,ST} \\ge \\dfrac{1.30\\,b\\,h}{2(b+h)f_y} = \\dfrac{1.30(${fmtT(c.bST,1)})(${fmtT(c.hST,1)})}{2(${fmtT(c.bST,1)}+${fmtT(c.hST,1)})(${fmtT(m.fy,1)})} = ${fmtT(c.AsST)}\\ \\text{in}^2/\\text{ft} \\quad (0.11 \\le A_{s,ST} \\le 0.60;\\ b,\\,h = \\text{least width, least thickness of the component})`,
```

#### R55
Before:
```js
      `W_{EV} = ${fmtT(R.EV.W)}\\ \\text{kip} \\quad\\text{at } \\bar{x} = ${fmtT(R.EV.x)}\\ \\text{ft from toe}`])}
```
After:
```js
      ...(R.EV.Wwedge>0?[`\\text{slope wedge: } \\tfrac{1}{2}\\gamma\\,L_{heel}\\,(L_{heel}\\tan\\beta)\\,L_{ab} = \\tfrac{1}{2}(${fmtT(S.soil.gamma,3)})(${fmtT(g.Lheel)})(${fmtT(R.EV.hWedge)})(${fmtT(g.Lab)}) = ${fmtT(R.EV.Wwedge)}\\ \\text{kip at } ${fmtT(R.EV.xWedge)}\\ \\text{ft}`]:[]),
      `W_{EV} = ${fmtT(R.EV.W)}\\ \\text{kip} \\quad\\text{at } \\bar{x} = ${fmtT(R.EV.x)}\\ \\text{ft from toe}`])}
```

#### R56
Before:
```js
    const AsST=Math.min(0.60,Math.max(0.11,1.30*12*(g.tsb*12)/(2*(12+g.tsb*12)*S.mat.fy)));
```
After:
```js
    const AsST=Math.max(cS.AsST,cBW.AsST,cT.AsST);   // governing Eq. 5.10.6-1 value of the stem, backwall and footing
```

#### R57
Before:
```js
    ["ls:Strength V","Strength V"],["ls:Constr — Str I","Construction — Str I (no superstructure)"],
```
After:
```js
    ["ls:Strength IV","Strength IV"],["ls:Strength V","Strength V"],["ls:Constr — Str I","Construction — Str I (no superstructure)"],
```

#### R58
Before:
```js
const colors={"Strength I":"#1f3a5f","Strength III":"#7c6a46","Strength V":"#5b7fa6","Service I":"#1a7f37"};
```
After:
```js
const colors={"Strength I":"#1f3a5f","Strength III":"#7c6a46","Strength IV":"#8a5a2b","Strength V":"#5b7fa6","Service I":"#1a7f37"};
```

#### R59
Before:
```js
evaluated at Strength I and V. A₂
```
After:
```js
evaluated at Strength I, IV and V. A₂
```

#### R60
Before:
```js
they are excluded from the bearing check — see the eccentricity check.","err");
```
After:
```js
they are excluded from the bearing check — see the eccentricity check.");
```

#### R61
Before:
```js
      else gamma = L[gr.cls]; // TU, CR, WS, WL
```
After:
```js
      else gamma = L[gr.cls]; // TU, CR, WS, WL
      if(gr.cls==="DC" && L.perm && L.dcMax && (perm.DC??1)===1) gamma = L.dcMax;   // Strength IV γDC max
```

#### R62
Before:
```js
"Shear-friction D/C": 0.05177218522624396
```
After:
```js
"Shear-friction D/C": 0.05702500795507431
```
