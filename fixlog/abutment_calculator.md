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

## 2026-10-04 — PR: claude/step1-group2 (PR link added after merge)

### F11. "← All tools" link + shared project info (HANDOFF.md §4.1)   [feature (no result change)]

- **Type:** feature (no result change). No formulas, factors, units, code references, storage keys or saved-data formats were changed.
- **What:** a small "← All tools" link to `tools.html` (`target="_top"`, hidden in print), and two buttons, **Use shared project info** and **Share project info**, in the title block in the page header. Share publishes `bridgeSuite.v1.projectMeta` (`_schema:"bridge-project-meta"`) with the tool's own fields, and `""` for fields it lacks. Use reads it with `BridgeXfer.read('projectMeta','bridge-project-meta',1)`, shows a confirm dialog listing each field that will be overwritten (old → new), writes only this tool's fields, never blanks a field when the shared value is blank, and writes through the tool's normal path (sets the input and dispatches a bubbling `input` event, so the tool's own handler updates its state and autosaves).
- **Field mapping (shared `fields` key → this tool's input):**

| shared field | this tool |
|---|---|
| `projectName` | `#projBlock [data-path="proj.name"]` |
| `bridgeId` | — (not in this tool; shared as `""`, ignored on Use) |
| `jobNo` | `#projBlock [data-path="proj.num"]` |
| `client` | — (not in this tool; shared as `""`, ignored on Use) |
| `location` | — (not in this tool; shared as `""`, ignored on Use) |
| `preparedBy` | `#projBlock [data-path="proj.calcBy"]` |
| `checkedBy` | `#projBlock [data-path="proj.chkBy"]` |
| `date` | `#projBlock [data-path="proj.date"]` |

- **Note:** `proj.date` is an `<input type="date">`; a shared date that is not `YYYY-MM-DD` is not applied and is listed as "Not used" in the confirm dialog.
- **Governing provision:** none (not a calculation change). Spec: HANDOFF.md §4.1 (channel) and §5 (helper).
- **Check case:** Share with Project name "Route 9 over Mill Brook", Job no. "J-4471", Prepared by "M. Lococo", Checked by "A. Checker", Date "2026-10-04"; then Use in another tool → the mapped fields show those values after one confirm; unmapped fields are unchanged. Calculation results before/after: identical (no calculation code touched).

**Edit 1 — link.** Where: `<header class="app-head">` → `.app-title`, above the `<h1>`.
- Before:
```html
    <div class="app-title">
      <h1>Bridge Abutment Design Calculator</h1>
```
- After:
```html
    <div class="app-title">
      <a class="bx-all-tools" href="tools.html" target="_top" title="Open the list of all tools">&larr; All tools</a>
      <h1>Bridge Abutment Design Calculator</h1>
```

**Edit 2 — buttons.** Where: title block `#projBlock`, after the "Checked Date" input.
- Before:
```js
      <label>Checked Date <input type="date" data-path="proj.chkDate"></label>
    </div>
```
- After:
```js
      <label>Checked Date <input type="date" data-path="proj.chkDate"></label>
      <div class="bx-pm-row"><button type="button" id="bx-pm-use" title="Fill this title block from the project info shared by another tool">Use shared project info</button><button type="button" id="bx-pm-share" title="Share this title block with the other tools">Share project info</button></div>
    </div>
```

**Edit 3 — CSS.** Where: end of the first `<style>` block in `<head>` (inserted just before its `</style>`).
- Before: `</style>`
- After:
```css
/* "All tools" link + shared project info buttons */
.bx-all-tools{font-size:0.8rem;color:var(--ref);text-decoration:none;}
.bx-all-tools:hover{text-decoration:underline;}
.bx-pm-row{grid-column:1/-1;display:flex;gap:6px;justify-content:flex-end;}
.bx-pm-row button{background:var(--paper);border:1px solid var(--line);border-radius:3px;padding:2px 10px;font-size:0.8rem;}
.bx-pm-row button:hover{background:var(--panel-h);}
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
  var TOOL='Bridge Abutment Design Calculator', FILE='abutment_calculator.html';
  var MAP={ projectName:'#projBlock [data-path="proj.name"]', bridgeId:'', jobNo:'#projBlock [data-path="proj.num"]', client:'', location:'', preparedBy:'#projBlock [data-path="proj.calcBy"]', checkedBy:'#projBlock [data-path="proj.chkBy"]', date:'#projBlock [data-path="proj.date"]' }; // shared field -> this tool's input ('' = this tool has no such field)
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

## 2026-10-05 — PR: claude/conn-subloads-abutment (PR link added after merge)

### F12. Pull abutment loads from SubLoads (HANDOFF.md §4.5, channel `abutmentLoads`)   [feature: hand-off (no result change)]
- **Where:** (1) toolbar, after the "↗ Open EDM" button; anchor text `<button id="btnOpenEDM"`. (2) A new `<script>` block at the end of the file, after the "SECTION F — EVENTS, PERSISTENCE, REPORT, INIT" script and before `</body>`; anchor text `/* ---------- SubLoads abutment loads hand-off`.
- **Problem:** none (feature). AUDIT S12 / D8: no importer for the SubLoads abutment export.
- **Governing provision:** n/a. No formula, factor, default or unit changed. The only effect on results is through the inputs the user confirms in the dialog.
- **What it does:**
  - **Pull from SubLoads** (with a "● new data" marker from `BridgeXfer.isNew('abutmentLoads','abutment')`) and **Import hand-off (JSON)** (also accepts a raw SubLoads "Export abutments" `subloads-abutment-v1` file). Nothing is applied on page load.
  - Validation: `_schema`, `schemaVersion ≤ 1`, `factored:false` required, `perGirder` not false, force kip, length ft, pads in inches (anything else refused; no conversion), every number used is finite; geometry, pad, A_s and ΔT must be inside the calculator's hard `VALID` ranges, else that group is disabled with the reason. 2–13 girders.
  - Dialog: producer, time, project, the sender's notes; choices (abutment; transverse +Y sign; LL set; WS case and optional wind speeds; WL case; TU case); a checkbox per group with its reason; warnings; "This will overwrite (current → new)" for every input; "Sent but not used" with reasons. **Apply** is the confirmation; it is disabled when the beam count differs and "Girder layout" is unticked.
  - Apply: `pushUndo`, write the layout, `migrate()`, write the other inputs, save the source in the **new optional field `S.subloadsSrc`** (`producer`, `producedAt`, `project`, `abutment`, `groups`, `choices`, `appliedAt`), rebuild, recalc, autosave, `BridgeXfer.markAdopted`. Undo restores the previous inputs.
  - Source shown in the toolbar (`#axh-src`) and printed under the report heading (`#axh-rpt-src`, with the choices). Done by wrapping `recalcAll` (repaints the toolbar text) and `buildReport` (adds one line); neither wrapper changes a computed value.
- **Mapping:**

| Hand-off (`abutments[k]`, kip / ft, unfactored) | Calculator input | Default |
|---|---|---|
| `girders[i].y` (+ left looking ahead station) | `beams.N` = girder count, `beams.mode` = `"position"`, `beams.positions[i]` = y (× −1 when "+ left looking from the backfill toward the span" is chosen at the end abutment), `beams.spacings` = \|Δy\|, `beams.eqSpacing`, `beams.groupOff` = 0 | on |
| `loadCases.DC1[i] + DC2[i]` | `rx.DC[i].P` | on |
| `loadCases.DW[i]` | `rx.DW[i].P` | on |
| `loadCases.LL.concurrentForMaxSeatTotal[i]` (or `envelopeMax[i]`, user choice) — LL+IM per girder, IM and MPF included | `rx.LL[i].P` | on (concurrent) |
| `loadCases.WS.III.cases[c].girders[i].{P,Vx,Vy}` (c = `WSgoverningStrIII.index` by default) | `rx.WS[i].{P,Vx,Vy}` (Vy × −1 if mirrored); `dist.shWS` = 100 | on |
| `loadCases.WS.{III,V,SI}.speedMph` | `factors.vWS3 / vWS5 / vWSsvc` | on only if the calculator's `vWS3` > 0 |
| `loadCases.WL.cases[c].girders[i].{P,Vx,Vy}` (c = `WL.governing.index`) | `rx.WL[i].{P,Vx,Vy}`; `dist.shWS` = 100 | on |
| `loadCases.BR.girders[i].Vx` | `rx.BR[i].Vx`; `dist.shBR` = 100; `longit.computeBR` = false | **off** (calculator computes BR) |
| `loadCases.TU.fall/rise[i].Vx` (default: the one with the larger push toward the span) | `rx.TU[i].Vx`; `dist.shTU` = 100; `longit.computeTU` = false | **off** |
| \|`loadCases.SH[i].Vx`\| | `rx.CRSH[i].Vx`; `dist.shCR` = 100; `longit.computeCRSH` = false | **off**; unavailable when SH is null |
| any share set to 100 while `dist.model` ≠ manual | `dist.model` = `"manual"`; from "fixed", the shares not imported are set to 100 so they keep their effective value | — |
| `geometry.backwallHeight / backwallThickness / stemHeight / stemThickness` | `geom.hbw / tbw / hstem / tst`, and `geom.tsb` = stemThickness | on |
| `stemThickness − bearingToStemFront − backwallThickness` | `geom.brgSetback` | on |
| `geometry.toe / heel / footingThickness` | `geom.Ltoe / Lheel / tf` | on |
| `geometry.stemLengthAlongSkew` | `geom.Lab` and `geom.Lftg` | on |
| `elevations.topOfBackwall − elevations.topOfFooting` | `geom.soilH` | on |
| `calculatorInput.geom.spanL` (adjacent span), `skewDeg` | `geom.spanL`, `geom.skew` | on |
| `elevations.ground − elevations.bottomOfFooting` | `fnd.Df` | on |
| `calculatorInput.mat.gc`; `bridge.roadwayWidth` | `mat.gc`; `longit.roadwayW` | on |
| `bearings.padLengthIn / padWidthIn / shearModulusKsi / rubberThicknessIn` (elastomeric only) | `bearing.padL / padW / G / hrt`, `bearing.nBrgPerGird` = 1 | on |
| `calculatorInput.seismic.As` | `seismic.As` (`seismic.on` not changed) | on only if A_s > 0 |
| `loadCases.TU.riseDegF / fallDegF` | `longit.dTrise / dTfall` | off |
| `producer`, `producedAt`, project, abutment, groups, choices | `S.subloadsSrc` (new optional field) | — |

Not used (listed in the dialog with the reason): the other LL set, lanes loaded and MPF (already inside the values); BR P and Vy (the calculator applies BR as Vx at the seat); CE (no CE row; flagged when present); the other WS cases and the Strength V / Service I / Service IV sets; the other WL cases; TU Vy and the other direction; FR; SH P and Vy; EQ (the calculator computes its own A_s·(DC+DW)·share inertia and its own 0.10·(DC+DW) seat connection force); the approach slab; bearing fixity / heights / elevations; girder stations; footing width and elevations; bridge-level data; the `calculatorInput` block (same values, mapped from the load cases); earth / soil (not sent).

- **Before (toolbar):**
```html
    <button id="btnOpenEDM" title="Open the Elastomeric Bearing Design Module and hand off geometry, loads and thermal movement">↗ Open EDM (Bearing Design)</button>
    <span class="spacer"></span>
```
- **After (toolbar):** between those two lines:
```html
    <button id="axh-pull" title="Pull the abutment loads sent by Bridge Substructure Loading (asks first; nothing changes until you apply)">Pull from SubLoads<span id="axh-new" class="axh-new" hidden> ● new data</span></button>
    <button id="axh-imp" title="Import an abutmentLoads hand-off JSON file, or a SubLoads &quot;Export abutments&quot; file (asks first)">Import hand-off (JSON)</button>
    <input type="file" id="axh-file" accept=".json,application/json" style="display:none">
    <span id="axh-src" class="axh-src"></span>
```
- **Before (end of file):**
```html
</script>
</body>
```
- **After:** this block inserted between `</script>` and `</body>`:
```html
<script>
/* ---------- SubLoads abutment loads hand-off (HANDOFF.md §4.5, channel abutmentLoads) ----------
   Toolbar: "Pull from SubLoads" (new-data marker) and "Import hand-off (JSON)" (also reads a SubLoads
   "Export abutments" file). Nothing is applied on page load. The dialog shows the source, lets the user
   pick the abutment and the groups to import, shows every input it will overwrite (current -> new) and
   every field it does not use, and applies only after "Apply". Values go into the existing inputs only;
   no calculation changes. The source is kept in the new optional field S.subloadsSrc, shown in the
   toolbar and printed in the report. Uses BridgeXfer v1 (top of this file). */
(function(){
  const CH='abutmentLoads', SCH='bridge-abutment-loads', RID='abutment';
  const BX=()=>window.BridgeXfer;
  const fin=Number.isFinite, r3=v=>Math.round(v*1000)/1000;
  const when=iso=>{ const d=new Date(iso); return isNaN(d)?String(iso||"?"):d.toLocaleString(); };
  const nfmt=v=>v===undefined||v===null||v===""?"—":(typeof v==="number"?String(r3(v)):String(v));
  let DLG=null;

  /* accept the envelope payload, or a raw SubLoads "Export abutments" file (schema subloads-abutment-v1) */
  function normalize(p){
    if(p && !p._schema && p.schema==="subloads-abutment-v1"){
      return Object.assign({}, p, { _schema:SCH, schemaVersion:1, producer:"Bridge Substructure Loading (Export abutments file)", producerFile:"Bridge Substructure Loading.html",
        producedAt:p.exported||"", project:{ name:(p.project&&p.project.name)||"", bridgeId:"" }, meta:p.project,
        units:Object.assign({ bearingPad:"in", shearModulus:"ksi" }, p.units||{}), factored:false, perGirder:true, _raw:true,
        notes:["Read from a SubLoads \"Export abutments\" file (subloads-abutment-v1): unfactored by definition of that format."] });
    }
    return p;
  }
  const isPGV=o=>o&&fin(o.P)&&fin(o.Vx)&&fin(o.Vy);
  const arrN=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(v=>typeof v==="number"&&fin(v));
  const arrG=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(isPGV);
  function hardOK(path,v){ const h=(typeof VALID!=="undefined"&&VALID[path])?VALID[path].hard:null; return fin(v)&&(!h||(v>=h[0]&&v<=h[1])); }

  /* validate the payload; returns {err} or {abuts:[...], bad:[...]} */
  function check(p){
    if(!p||typeof p!=="object") return { err:"not a hand-off object" };
    if(p._schema!==SCH) return { err:"wrong data type ("+(p._schema||p.schema||"none")+"), expected "+SCH };
    if(!(p.schemaVersion<=1)) return { err:"newer format (v"+p.schemaVersion+") than this tool supports (v1)" };
    if(p.factored!==false) return { err:p.factored===true?"the loads are factored; the calculator needs unfactored reactions":"the hand-off does not state that the loads are unfactored (factored:false)" };
    if(p.perGirder===false) return { err:"the reactions are not per girder" };
    const u=p.units||{}, fu=String(u.force||"").trim().toLowerCase(), lu=String(u.length||"").trim().toLowerCase(), pu=String(u.bearingPad||"in").trim().toLowerCase();
    if(fu!=="kip"&&fu!=="kips") return { err:"force unit \""+(u.force||"not stated")+"\" is not kip; the calculator works in kip and does not convert" };
    if(lu!=="ft") return { err:"length unit \""+(u.length||"not stated")+"\" is not ft; the calculator works in ft and does not convert" };
    if(pu!=="in") return { err:"bearing pad unit \""+u.bearingPad+"\" is not in" };
    if(!Array.isArray(p.abutments)||!p.abutments.length) return { err:"there are no abutments in the hand-off" };
    const abuts=[], bad=[];
    p.abutments.forEach((a,k)=>{ const nm=String((a&&a.name)||("Abutment "+(k+1)));
      if(!a||a.error){ bad.push(nm+": "+((a&&a.error)||"empty")); return; }
      const e=parseAbut(a,p); if(e.err) bad.push(nm+": "+e.err); else abuts.push(e); });
    if(!abuts.length) return { err:"no usable abutment: "+bad.join("; ") };
    return { abuts, bad };
  }
  function parseAbut(a,p){
    const gs=a.girders, L=a.loadCases||{}, nb=Array.isArray(gs)?gs.length:0;
    if(!nb) return { err:"no girders" };
    const y=gs.map(g=>g&&+g.y); if(!y.every(fin)) return { err:"a girder offset y is not a number" };
    if(!arrN(L.DC1,nb)||!arrN(L.DC2,nb)||!arrN(L.DW,nb)) return { err:"DC1/DC2/DW are missing or not numbers for every girder" };
    const LL=L.LL||{};
    if(!arrN(LL.concurrentForMaxSeatTotal,nb)||!arrN(LL.envelopeMax,nb)) return { err:"LL+IM values are missing or not numbers" };
    const o={ name:String(a.name), a, nb, y, L, end:a.end==="end"?"end":"begin", warns:[], gerr:{} };
    // optional groups: a bad group is disabled with its reason, not the whole abutment
    o.br=L.BR&&arrG(L.BR.girders,nb)?L.BR.girders:null; if(!o.br) o.gerr.br="no valid BR values";
    o.tu=L.TU&&arrG(L.TU.rise,nb)&&arrG(L.TU.fall,nb)?L.TU:null; if(!o.tu) o.gerr.tu="no valid TU values";
    o.sh=L.SH==null?null:(arrG(L.SH,nb)?L.SH:"bad"); if(o.sh===null) o.gerr.crsh="SubLoads has no creep/shrinkage case for this abutment"; else if(o.sh==="bad"){ o.sh=null; o.gerr.crsh="SH values are not valid numbers"; }
    const W=L.WS||{}; o.wsC=W.III&&Array.isArray(W.III.cases)&&W.III.cases.length&&W.III.cases.every(c=>arrG(c.girders,nb))?W.III.cases:null;
    if(!o.wsC) o.gerr.ws="no valid Strength III wind cases";
    o.wsGov=L.WSgoverningStrIII&&fin(+L.WSgoverningStrIII.index)&&o.wsC&&o.wsC[+L.WSgoverningStrIII.index]?+L.WSgoverningStrIII.index:0;
    o.spd={ III:W.III&&+W.III.speedMph, V:W.V&&+W.V.speedMph, SI:W.SI&&+W.SI.speedMph };
    o.spdOK=[o.spd.III,o.spd.V,o.spd.SI].every(v=>fin(v)&&v>0);
    o.wlC=L.WL&&Array.isArray(L.WL.cases)&&L.WL.cases.length&&L.WL.cases.every(c=>arrG(c.girders,nb))?L.WL.cases:null;
    if(!o.wlC) o.gerr.wl="no valid wind-on-live-load cases";
    o.wlGov=o.wlC&&L.WL.governing&&o.wlC[+L.WL.governing.index]?+L.WL.governing.index:0;
    if(nb<2||nb>13) o.gerr.layout="the calculator takes 2 to 13 beams; SubLoads sent "+nb;
    // geometry (ft) mapped to the calculator's names
    const G=a.geometry||{}, E=G.elevations||{}, ci=a.calculatorInput||{}, cg=ci.geom||{};
    const span=fin(+cg.spanL)?+cg.spanL:(p.bridge&&Array.isArray(p.bridge.spans)&&p.bridge.spans.length?+(o.end==="end"?p.bridge.spans[p.bridge.spans.length-1]:p.bridge.spans[0]):NaN);
    o.geom=[["geom.hbw",+G.backwallHeight,"Backwall height h_bw","ft"],["geom.tbw",+G.backwallThickness,"Backwall thickness t_bw","ft"],
      ["geom.hstem",+G.stemHeight,"Stem height","ft"],["geom.tst",+G.stemThickness,"Stem thickness, top","ft"],["geom.tsb",+G.stemThickness,"Stem thickness, bottom (SubLoads stem is prismatic)","ft"],
      ["geom.brgSetback",+G.stemThickness-(+G.bearingToStemFront)-(+G.backwallThickness),"Bearing setback from backwall front = t_stem − (bearing to stem front) − t_bw","ft"],
      ["geom.Ltoe",+G.toe,"Toe length","ft"],["geom.Lheel",+G.heel,"Heel length","ft"],["geom.tf",+G.footingThickness,"Footing thickness","ft"],
      ["geom.Lab",+G.stemLengthAlongSkew,"Wall length (along skew)","ft"],["geom.Lftg",+G.stemLengthAlongSkew,"Footing length (= SubLoads stem length along skew)","ft"],
      ["geom.soilH",(+E.topOfBackwall)-(+E.topOfFooting),"Soil height over heel = top of backwall − top of footing","ft"],
      ["geom.spanL",span,"Span length (adjacent span)","ft"],["geom.skew",+a.skewDeg,"Skew","deg"],
      ["fnd.Df",(+E.ground)-(+E.bottomOfFooting),"Footing embedment D_f = ground − bottom of footing (passive)","ft"]];
    if(ci.mat&&ci.mat.gc!=null) o.geom.push(["mat.gc",+ci.mat.gc,"Concrete unit weight","kcf"]);
    if(p.bridge&&p.bridge.roadwayWidth!=null) o.geom.push(["longit.roadwayW",+p.bridge.roadwayWidth,"Clear roadway width (used only by the calculator's own BR)","ft"]);
    const gBad=o.geom.filter(g=>!hardOK(g[0],g[1])).map(g=>g[2]+" = "+nfmt(g[1]));
    if(gBad.length) o.gerr.geom="out of the calculator's accepted range or not a number: "+gBad.join("; ");
    if(fin(+G.footingWidth)&&Math.abs((+G.toe)+(+G.stemThickness)+(+G.heel)-(+G.footingWidth))>0.01) o.warns.push("SubLoads footing width "+nfmt(+G.footingWidth)+" ft ≠ toe + stem + heel = "+nfmt((+G.toe)+(+G.stemThickness)+(+G.heel))+" ft; the calculator uses toe + stem + heel.");
    const B=a.bearings||{};
    o.brg=[["bearing.padL",+B.padLengthIn,"Pad length (along span)","in"],["bearing.padW",+B.padWidthIn,"Pad width (transverse)","in"],["bearing.G",+B.shearModulusKsi,"Elastomer shear modulus G","ksi"],["bearing.hrt",+B.rubberThicknessIn,"Total elastomer thickness h_rt","in"],["bearing.nBrgPerGird",1,"Bearings per girder (SubLoads: one per girder)",""]];
    if(B.type!=="elastomeric") o.gerr.brg="SubLoads bearing type is "+(B.type||"not stated")+", not elastomeric";
    else { const bb=o.brg.filter(g=>!hardOK(g[0],g[1])).map(g=>g[2]+" = "+nfmt(g[1])); if(bb.length) o.gerr.brg="out of range or not a number: "+bb.join("; "); }
    o.As=ci.seismic?+ci.seismic.As:(L.EQ?+L.EQ.As:NaN);
    if(!hardOK("seismic.As",o.As)) o.gerr.seis="no valid A_s";
    o.dT=L.TU?[+L.TU.riseDegF,+L.TU.fallDegF]:[NaN,NaN];
    if(!(hardOK("longit.dTrise",o.dT[0])&&hardOK("longit.dTfall",o.dT[1]))) o.gerr.therm="no valid temperature range";
    [].concat(L.DC1,L.DC2,L.DW).forEach(v=>{ if(v<0&&!o._neg){ o._neg=1; o.warns.push("A negative (uplift) dead-load reaction is included."); } });
    return o;
  }

  /* ---------- the groups the user can pick ---------- */
  const GROUPS=[
    ["layout","Girder layout: number of beams and offsets",true],
    ["dc","DC per girder (DC1 + DC2)",true],["dw","DW per girder",true],["ll","LL+IM per girder",true],
    ["ws","WS: wind on structure (Strength III case)",true],["wl","WL: wind on live load",true],
    ["br","BR: braking (SubLoads share)",false],["tu","TU: uniform temperature (SubLoads share)",false],["crsh","CR/SH (SubLoads share)",false],
    ["geom","Abutment geometry",true],["brg","Bearing pad",true],["seis","Seismic A_s",true],["therm","Temperature range ΔT rise / fall",false]];
  const WHY={
    layout:"Needed when the beam count or offsets differ; the reaction rows are per girder.",
    dc:"DC1 (non-composite) and DC2 (composite) are summed: the calculator has one DC row and both take γDC.",
    ll:"Total LL+IM bearing reactions per girder, with IM and multiple presence already included (not per lane). The calculator applies no IM, MPF or distribution of its own to these rows.",
    ws:"P (the overturning couple and uplift), Vx (toward the span) and Vy, per girder. SubLoads already took this abutment's share, so the calculator's WS share is set to 100%.",
    wl:"P, Vx and Vy per girder for the chosen case. The calculator's WS share (it applies to WS and WL) is set to 100%.",
    br:"Off by default: the calculator can compute BR itself (HL-93, its own lanes and share). SubLoads' value is its stiffness share of the bridge's braking force, which can be much smaller or larger. If ticked: Vx only, BR share set to 100% and the calculator's own BR switched off.",
    tu:"Off by default: the calculator can compute TU from its own pad shear. If ticked: Vx only, TU share set to 100% and the calculator's own TU switched off.",
    crsh:"Off by default: the calculator can compute CR/SH from its own pad shear. If ticked: |Vx| of the SubLoads SH case, CR/SH share set to 100% and the calculator's own CR/SH switched off.",
    geom:"Fills the I-1 geometry from the SubLoads abutment unit. Soil, backfill and water inputs are not sent and stay as they are.",
    brg:"Elastomeric pad size and properties (used by the calculator's own TU/CR·SH pad shear and the seat checks).",
    seis:"Site acceleration coefficient A_s only; the Extreme Event I on/off switch and the other seismic inputs are not changed.",
    therm:"Only used by the calculator's own TU generator."};

  function rxRow(t,c,vals){ return { lbl:t+" "+c+" (G1…G"+vals.length+")", paths:vals.map((_,i)=>"rx."+t+"."+i+"."+c), vals:vals.map(r3) }; }
  function one(path,val,lbl){ return { lbl, paths:[path], vals:[val] }; }
  function gsel(o,st){ return o.end==="end"&&st.ySys==="span"?-1:1; }   // transverse sign: +1 as sent, −1 mirrored
  function tuSet(o,st){ const sx=a=>a.reduce((t,g)=>t+g.Vx,0); return st.tu==="rise"?o.tu.rise:st.tu==="fall"?o.tu.fall:(sx(o.tu.fall)>=sx(o.tu.rise)?o.tu.fall:o.tu.rise); }

  /* plan: sections of {lbl, paths, vals} for the ticked groups */
  function plan(o,st){
    const on=k=>st.on[k]&&!o.gerr[k], sg=gsel(o,st), secs=[], L=o.L;
    const add=(k,items)=>{ if(items.length) secs.push({ k, title:(GROUPS.find(g=>g[0]===k)||[k,k])[1], items }); };
    if(on("layout")){ const ys=o.y.map(v=>r3(sg*v)), sp=ys.slice(1).map((v,i)=>r3(Math.abs(v-ys[i])));
      add("layout",[one("beams.N",o.nb,"Number of beams N"),one("beams.mode","position","Position entry mode"),{ lbl:"Beam offsets from CL (ft)", paths:["beams.positions"], vals:[ys] },
        { lbl:"Beam spacings (ft, for reference)", paths:["beams.spacings"], vals:[sp] },one("beams.eqSpacing",sp[0]||0,"Equal spacing (ft)"),one("beams.groupOff",0,"Group offset (ft)")]); }
    if(on("dc")) add("dc",[rxRow("DC","P",L.DC1.map((v,i)=>v+L.DC2[i]))]);
    if(on("dw")) add("dw",[rxRow("DW","P",L.DW)]);
    if(on("ll")) add("ll",[rxRow("LL","P",st.ll==="env"?L.LL.envelopeMax:L.LL.concurrentForMaxSeatTotal)]);
    if(on("ws")){ const g=o.wsC[st.ws].girders, it=[rxRow("WS","P",g.map(x=>x.P)),rxRow("WS","Vx",g.map(x=>x.Vx)),rxRow("WS","Vy",g.map(x=>sg*x.Vy))];
      if(st.spd&&o.spdOK) it.push(one("factors.vWS3",o.spd.III,"Wind speed V for the WS inputs (Strength III), mph"),one("factors.vWS5",o.spd.V,"Wind speed, Strength V, mph"),one("factors.vWSsvc",o.spd.SI,"Wind speed, Service I, mph"));
      add("ws",it); }
    if(on("wl")){ const g=o.wlC[st.wl].girders; add("wl",[rxRow("WL","P",g.map(x=>x.P)),rxRow("WL","Vx",g.map(x=>x.Vx)),rxRow("WL","Vy",g.map(x=>sg*x.Vy))]); }
    if(on("br")) add("br",[rxRow("BR","Vx",o.br.map(x=>x.Vx))]);
    if(on("tu")) add("tu",[rxRow("TU","Vx",tuSet(o,st).map(x=>x.Vx))]);
    if(on("crsh")) add("crsh",[rxRow("CRSH","Vx",o.sh.map(x=>Math.abs(x.Vx)))]);
    if(on("geom")) add("geom",o.geom.map(g=>one(g[0],r3(g[1]),g[2]+" ("+g[3]+")")));
    if(on("brg")) add("brg",o.brg.map(g=>one(g[0],r3(g[1]),g[2]+(g[3]?" ("+g[3]+")":""))));
    if(on("seis")) add("seis",[one("seismic.As",r3(o.As),"Acceleration coefficient A_s")]);
    if(on("therm")) add("therm",[one("longit.dTrise",r3(o.dT[0]),"Design temperature rise (°F)"),one("longit.dTfall",r3(o.dT[1]),"Design temperature fall (°F)")]);
    // linked settings: SubLoads horizontal forces are already this abutment's share
    const sh=[], d=S.dist||{}, lk=[];
    if(on("br")) sh.push("shBR"); if(on("tu")) sh.push("shTU"); if(on("crsh")) sh.push("shCR"); if(on("ws")||on("wl")) sh.push("shWS");
    if(sh.length){
      if(d.model!=="manual"){ lk.push(one("dist.model","manual","Longitudinal distribution model"));
        if(d.model==="fixed") ["shBR","shTU","shCR","shWS"].forEach(k=>{ if(sh.indexOf(k)<0&&+d[k]!==100) lk.push(one("dist."+k,100,"Share "+k.slice(2)+" (%) — keeps the fixed-bearing 100% for a load not imported")); }); }
      sh.forEach(k=>{ if(+d[k]!==100||d.model!=="manual") lk.push(one("dist."+k,100,"Share "+k.slice(2)+" to this abutment (%)")); });
    }
    const Lg=S.longit||{};
    [["br","computeBR"],["tu","computeTU"],["crsh","computeCRSH"]].forEach(([g,k])=>{ if(on(g)&&Lg[k]) lk.push(one("longit."+k,false,"Calculator's own "+g.toUpperCase()+" generator")); });
    if(lk.length) secs.push({ k:"linked", title:"Linked calculator settings", items:lk });
    return secs;
  }

  /* fields the calculator does not use, and why */
  function unused(o,st){
    const L=o.L, u=[];
    u.push(["LL+IM "+(st.ll==="env"?"concurrent set (max total at the bridge seat)":"per-bearing envelope maxima")+", envelope minima, lanes loaded, multiple presence","the calculator has one LL+IM row; the other set is not concurrent with it, and IM / multiple presence are already inside the values"]);
    u.push(["BR P (overturning couple) and Vy","the calculator's BR row is Vx only, applied at the bridge seat; it does not model the couple from the 6-ft application height [3.6.4]"]);
    u.push(["CE (centrifugal force)",L.CE?"the calculator has no CE row; NOT imported, add it by hand if it matters":"none for this abutment"]);
    if(o.wsC) u.push(["WS: "+(o.wsC.length-1)+" other Strength III cases, and the Strength V, Service I and Service IV sets","the calculator has one WS set (scaled to Strength V / Service I by (V_LS/V_III)² only when V_III is entered); SubLoads' 0.30 klf minimum and vertical uplift apply to Strength III only"]);
    if(o.wlC) u.push(["WL: "+(o.wlC.length-1)+" other cases","the calculator has one WL set"]);
    u.push(["TU Vy and the "+(st.tu==="rise"?"fall":st.tu==="fall"?"rise":"other (rise or fall)")+" case","the calculator's TU row is Vx only, one direction"]);
    u.push(["FR (bearing friction)","the calculator has no FR row"]);
    u.push(["SH P and Vy","the calculator's CR/SH row is Vx only"]);
    u.push(["EQ (superstructure seismic force"+(L.EQ&&L.EQ.basis?", "+L.EQ.basis:"")+")","the calculator computes its own superstructure inertia A_s·(DC+DW)·share for Extreme Event I and its own seat connection force 0.10·(DC+DW); SubLoads' basis (3.10.9.2 0.15/0.25 or elastic) differs, so it is not imported"]);
    u.push(["Approach slab reaction",L.approachSlab?"the calculator has no approach slab load; NOT imported":"none sent"]);
    u.push(["Bearing fixity, type, height, pedestal, seat and girder elevations; girder stations; unit station","no matching calculator input (the calculator works from the bridge seat)"]);
    u.push(["Footing width, deck / seat / ground elevations","the calculator derives B = toe + stem + heel and uses heights, not elevations"]);
    u.push(["Bridge data: spans, skews of other units, girder spacings, deck width, design lanes, IM %","no matching input (roadway width is used, in the geometry group)"]);
    u.push(["calculatorInput block","not read directly; the same values are mapped here from the load cases and geometry (it is used only for the concrete unit weight and A_s)"]);
    u.push(["Earth pressure, soil, backfill, water","not sent; the calculator computes earth loads from its own soil inputs"]);
    return u;
  }

  /* ---------- dialog ---------- */
  function css(){ if(document.getElementById("axh-css")) return; const s=document.createElement("style"); s.id="axh-css";
    s.textContent=".axh-new{color:#c62828;font-weight:700}.axh-src{font-size:.8rem;color:#555}"+
      "#axh-ov{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 8px}"+
      "#axh-dlg{background:#fff;color:#1a1a1a;max-width:980px;width:100%;border-radius:6px;padding:14px 18px;box-shadow:0 6px 30px rgba(0,0,0,.3);font-size:.86rem}"+
      "#axh-dlg h3{margin:0 0 6px 0;font-size:1.05rem}#axh-dlg h4{margin:12px 0 4px 0;font-size:.92rem}#axh-dlg table{border-collapse:collapse;width:100%;margin:4px 0}"+
      "#axh-dlg td,#axh-dlg th{border:1px solid #ddd;padding:2px 6px;text-align:left;vertical-align:top}#axh-dlg .axh-grp{margin:3px 0}#axh-dlg .axh-why{color:#555;font-size:.8rem;margin-left:22px}"+
      "#axh-dlg .axh-err{color:#c62828}#axh-dlg .axh-warn{color:#b26a00}#axh-dlg .axh-btns{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}#axh-dlg select{max-width:100%}"+
      "@media print{#axh-pull,#axh-imp,#axh-ov{display:none !important}}";
    document.head.appendChild(s); }
  function open(p){
    p=normalize(p); const c=check(p);
    if(c.err){ alert("Cannot use this hand-off: "+c.err); return; }
    const o0=c.abuts[0], st={ ai:0, ySys:"sent", ll:"conc", ws:o0.wsGov, wl:o0.wlGov, tu:"gov", spd:+(S.factors&&S.factors.vWS3)>0, on:{} };
    GROUPS.forEach(g=>{ st.on[g[0]]=g[2]; }); if(!(o0.As>0)) st.on.seis=false;
    DLG={ p, c, st }; css(); render();
  }
  function close(){ const ov=document.getElementById("axh-ov"); if(ov) ov.remove(); DLG=null; }
  function cellTxt(v){ return Array.isArray(v)?v.map(nfmt).join(", "):nfmt(v); }
  function render(){
    const { p, c, st }=DLG, o=c.abuts[st.ai], secs=plan(o,st);
    let h="<h3>Pull abutment loads from SubLoads</h3>";
    h+="<div><b>From:</b> "+esc(p.producer||"?")+" — "+esc(when(p.producedAt))+"<br><b>Project:</b> "+esc((p.project&&p.project.name)||"(none)")+((p.project&&p.project.bridgeId)?" ("+esc(p.project.bridgeId)+")":"")+
      " &nbsp;·&nbsp; <b>This calculator:</b> "+esc(S.proj&&S.proj.name||"(none)")+"<br><b>Basis:</b> unfactored, kip / ft, per girder; Vx + toward the span (the calculator's + toward the toe), P + down.</div>";
    const notes=(p.notes||[]).concat(o.a.notes||[]);
    if(notes.length) h+="<h4>Sender notes</h4><ul>"+notes.map(n=>"<li>"+esc(n)+"</li>").join("")+"</ul><div class='axh-why'>Here, shares and the calculator's own BR / TU / CR·SH generators change only for the groups you tick below.</div>";
    if(c.bad.length) h+="<div class='axh-warn'>Not usable: "+esc(c.bad.join("; "))+"</div>";
    h+="<h4>Choices</h4><table>";
    h+="<tr><td>Abutment</td><td><select data-axh='ai'>"+c.abuts.map((a,i)=>"<option value='"+i+"'"+(i===st.ai?" selected":"")+">"+esc(a.name)+" ("+a.end+" of bridge, "+a.nb+" girders)</option>").join("")+"</select></td></tr>";
    h+="<tr><td>Transverse +Y (girder offsets and wind V<sub>y</sub>)</td><td><select data-axh='ySys'><option value='sent'"+(st.ySys==="sent"?" selected":"")+">+ to the left looking ahead station (as sent)</option><option value='span'"+(st.ySys==="span"?" selected":"")+">+ to the left looking from the backfill toward the span</option></select>"+(o.end==="begin"?" <span class='axh-why'>(the same for this abutment)</span>":" <span class='axh-why'>(mirrors y and V<sub>y</sub> for this abutment)</span>")+"</td></tr>";
    h+="<tr><td>LL+IM set</td><td><select data-axh='ll'><option value='conc'"+(st.ll==="conc"?" selected":"")+">Concurrent set for the maximum total at the bridge seat (SubLoads' choice for this calculator)</option><option value='env'"+(st.ll==="env"?" selected":"")+">Per-bearing maxima (envelope, not concurrent: conservative for the total)</option></select></td></tr>";
    if(o.wsC) h+="<tr><td>WS case (Strength III, "+nfmt(o.spd.III)+" mph)</td><td><select data-axh='ws'>"+o.wsC.map((x,i)=>"<option value='"+i+"'"+(i===st.ws?" selected":"")+">"+esc(x.name)+(i===o.wsGov?" (largest horizontal force)":"")+"</option>").join("")+"</select><br><label><input type='checkbox' data-axh='spd'"+(st.spd?" checked":"")+(o.spdOK?"":" disabled")+"> Also set the calculator's wind speeds from SubLoads: V<sub>III</sub> = "+nfmt(o.spd.III)+", V<sub>V</sub> = "+nfmt(o.spd.V)+", V<sub>Service I</sub> = "+nfmt(o.spd.SI)+" mph</label><div class='axh-why'>Unticked, V<sub>III</sub> stays "+nfmt(+S.factors.vWS3||0)+" mph"+(+S.factors.vWS3>0?" — the imported WS would then be scaled with the wrong base speed":" (0 = the Strength III WS is used unscaled in Strength V and Service I: conservative)")+". Ticked by default only when the calculator already scales WS.</div></td></tr>";
    if(o.wlC) h+="<tr><td>WL case</td><td><select data-axh='wl'>"+o.wlC.map((x,i)=>"<option value='"+i+"'"+(i===st.wl?" selected":"")+">"+esc(x.name)+(i===o.wlGov?" (largest horizontal force)":"")+"</option>").join("")+"</select></td></tr>";
    if(o.tu) h+="<tr><td>TU case</td><td><select data-axh='tu'><option value='gov'"+(st.tu==="gov"?" selected":"")+">Larger push toward the span (SubLoads' choice)</option><option value='rise'"+(st.tu==="rise"?" selected":"")+">Rise ("+nfmt(+o.L.TU.riseDegF)+" °F)</option><option value='fall'"+(st.tu==="fall"?" selected":"")+">Fall ("+nfmt(+o.L.TU.fallDegF)+" °F)</option></select></td></tr>";
    h+="</table><h4>Groups to import</h4>";
    GROUPS.forEach(([k,lab])=>{ const dis=o.gerr[k]; h+="<div class='axh-grp'><label><input type='checkbox' data-axh-g='"+k+"'"+(st.on[k]&&!dis?" checked":"")+(dis?" disabled":"")+"> <b>"+esc(lab)+"</b></label>"+(dis?" <span class='axh-err'>— not available: "+esc(dis)+"</span>":"")+"<div class='axh-why'>"+esc(WHY[k]||"")+"</div></div>"; });
    const nMis=(st.on.layout&&!o.gerr.layout)?0:(+S.beams.N!==o.nb?1:0), rxOn=["dc","dw","ll","ws","wl","br","tu","crsh"].some(k=>st.on[k]&&!o.gerr[k]);
    const errs=[]; if(nMis&&rxOn) errs.push("The calculator has "+S.beams.N+" beams and SubLoads sent "+o.nb+": tick \"Girder layout\" to import per-girder reactions.");
    const warns=o.warns.slice();
    if((st.on.ws&&!o.gerr.ws)!==(st.on.wl&&!o.gerr.wl)) warns.push("The calculator uses one longitudinal share for WS and WL; it is set to 100% for the imported one, so the other is also taken at 100%.");
    if(st.on.ws&&!o.gerr.ws&&!st.spd&&+S.factors.vWS3>0&&Math.abs(+S.factors.vWS3-o.spd.III)>1e-6) warns.push("The calculator's V_III is "+nfmt(+S.factors.vWS3)+" mph but the imported WS is at "+nfmt(o.spd.III)+" mph: tick \"Also set the calculator's wind speeds\".");
    if(!(st.on.layout&&!o.gerr.layout)&&rxOn&&!nMis) warns.push("Girder layout not imported: the calculator's own beam offsets are kept for the P·y moments.");
    if(st.on.layout&&!o.gerr.layout&&S.piles&&S.piles.enabled) warns.push("Pile layout is not changed; check it against the imported beam offsets and geometry.");
    if(warns.length) h+="<h4>Warnings</h4><ul>"+warns.map(w=>"<li class='axh-warn'>"+esc(w)+"</li>").join("")+"</ul>";
    if(errs.length) h+="<ul>"+errs.map(w=>"<li class='axh-err'><b>"+esc(w)+"</b></li>").join("")+"</ul>";
    h+="<h4>This will overwrite (current → new)</h4>";
    if(!secs.length) h+="<p>Nothing selected.</p>";
    secs.forEach(s=>{ h+="<table><tr><th colspan='3'>"+esc(s.title)+"</th></tr>"+s.items.map(it=>{ const cur=it.paths.length===1?getPath(S,it.paths[0]):it.paths.map(q=>getPath(S,q)), nv=it.paths.length===1?it.vals[0]:it.vals;
      return "<tr><td style='width:32%'>"+esc(it.lbl)+"</td><td>"+esc(cellTxt(cur))+"</td><td><b>"+esc(cellTxt(nv))+"</b></td></tr>"; }).join("")+"</table>"; });
    h+="<h4>Sent but not used</h4><table><tr><th>Field</th><th>Why</th></tr>"+unused(o,st).map(r=>"<tr><td>"+esc(r[0])+"</td><td>"+esc(r[1])+"</td></tr>").join("")+"</table>";
    h+="<div class='axh-btns'><button type='button' id='axh-cancel'>Cancel</button><button type='button' id='axh-apply' class='primary'"+(errs.length||!secs.length?" disabled":"")+">Apply to the calculator</button></div>";
    let ov=document.getElementById("axh-ov");
    if(!ov){ ov=document.createElement("div"); ov.id="axh-ov"; ov.innerHTML="<div id='axh-dlg' role='dialog' aria-modal='true' aria-label='Pull abutment loads from SubLoads'></div>"; document.body.appendChild(ov); }
    ov.querySelector("#axh-dlg").innerHTML=h;
  }
  function apply(){
    const { p, c, st }=DLG, o=c.abuts[st.ai], secs=plan(o,st);
    if(!secs.length) return;
    if(typeof pushUndo==="function") pushUndo("subloads-handoff:"+Date.now());
    const items=[].concat.apply([],secs.map(s=>s.items));
    const isLay=it=>/^beams\./.test(it.paths[0]);
    items.filter(isLay).forEach(it=>it.paths.forEach((q,i)=>setPath(S,q,Array.isArray(it.vals[i])?it.vals[i].slice():it.vals[i])));
    migrate();                                                   // sizes the reaction matrix to N
    items.filter(it=>!isLay(it)).forEach(it=>it.paths.forEach((q,i)=>setPath(S,q,it.vals[i])));
    const grp=secs.filter(s=>s.k!=="linked").map(s=>s.k);
    S.subloadsSrc={ producer:p.producer||"", producedAt:p.producedAt||"", project:(p.project&&p.project.name)||"", abutment:o.name, groups:grp,
      choices:{ ll:grp.indexOf("ll")>=0?st.ll:null, ws:grp.indexOf("ws")>=0?o.wsC[st.ws].name:null, wl:grp.indexOf("wl")>=0?o.wlC[st.wl].name:null, tu:grp.indexOf("tu")>=0?st.tu:null,
        ySign:o.end==="end"&&st.ySys==="span"?"mirrored (+ left looking from the backfill toward the span)":"as sent (+ left looking ahead station)", windSpeeds:grp.indexOf("ws")>=0&&st.spd&&o.spdOK }, appliedAt:new Date().toISOString() };
    migrate(); buildInputs(); recalcAll(); scheduleSave(); if(typeof refreshProjHeader==="function") refreshProjHeader();
    if(BX()&&p.producedAt&&!p._raw) BX().markAdopted(CH,RID,p.producedAt);
    close(); paint();
    const ss=document.getElementById("saveStatus"); if(ss) ss.textContent="loads pulled from SubLoads ("+o.name+")";
  }

  /* ---------- toolbar state, report line ---------- */
  const GL={ layout:"layout", dc:"DC", dw:"DW", ll:"LL+IM", ws:"WS", wl:"WL", br:"BR", tu:"TU", crsh:"CR/SH", geom:"geometry", brg:"bearing", seis:"A_s", therm:"ΔT" };
  function srcText(){ const s=S.subloadsSrc; if(!s||!s.producedAt&&!s.producer) return "";
    return "Loads from "+(s.producer||"SubLoads")+", "+when(s.producedAt)+(s.project?" ("+s.project+")":"")+": "+(s.abutment||"")+" — "+(s.groups||[]).map(g=>GL[g]||g).join(", "); }
  function paint(){
    const n=document.getElementById("axh-new"); if(n) n.hidden=!(BX()&&BX().isNew(CH,RID));
    const s=document.getElementById("axh-src"); if(s) s.textContent=srcText();
  }
  window.addEventListener("storage",paint); window.addEventListener("focus",paint);
  if(typeof recalcAll==="function"){ const rc=recalcAll; recalcAll=function(){ const r=rc.apply(this,arguments); try{ paint(); }catch(e){} return r; }; }
  if(typeof buildReport==="function"){ const br=buildReport; buildReport=async function(){ const r=await br.apply(this,arguments);
    try{ const t=srcText(), sub=document.querySelector("#report .rpt-sub"); if(t&&sub){ const s=S.subloadsSrc, ch=s.choices||{}, d=document.createElement("div"); d.className="rpt-sub"; d.id="axh-rpt-src";
      d.textContent=t+". Choices: "+[ch.ll?"LL+IM "+(ch.ll==="env"?"per-bearing maxima":"concurrent set for the maximum at the seat"):"", ch.ws?"WS "+ch.ws+(ch.windSpeeds?", wind speeds from SubLoads":""):"", ch.wl?"WL "+ch.wl:"", ch.tu?"TU "+ch.tu:"", "transverse "+ch.ySign].filter(Boolean).join("; ")+".";
      sub.parentNode.insertBefore(d,sub.nextSibling); } }catch(e){}
    return r; }; }

  document.addEventListener("click",ev=>{
    const t=ev.target; if(!t||!t.closest) return;
    if(t.closest("#axh-pull")){
      if(!BX()){ alert("The hand-off helper is not available in this browser."); return; }
      const r=BX().read(CH,SCH,1);
      if(r.error){ alert(r.empty?"Nothing has been sent yet. In Bridge Substructure Loading, click \"Send to Abutment Calculator\" (or use \"Import hand-off (JSON)\")." :"Cannot use the SubLoads hand-off: "+r.error); return; }
      open(r.payload); return; }
    if(t.closest("#axh-imp")){ const f=document.getElementById("axh-file"); if(f) f.click(); return; }
    if(t.id==="axh-cancel"){ close(); return; }
    if(t.id==="axh-apply"){ apply(); return; }
  });
  document.addEventListener("change",ev=>{
    const t=ev.target; if(!t) return;
    if(t.id==="axh-file"){ const f=t.files&&t.files[0]; if(!f) return;
      const fr=new FileReader(); fr.onload=()=>{ let p; try{ p=JSON.parse(fr.result); }catch(e){ alert("Import failed: the file is not valid JSON."); return; } open(p); };
      fr.onerror=()=>alert("Import failed: could not read the file."); fr.readAsText(f); t.value=""; return; }
    if(!DLG||!t.closest||!t.closest("#axh-dlg")) return;
    ev.stopPropagation();
    const st=DLG.st, k=t.getAttribute("data-axh"), g=t.getAttribute("data-axh-g");
    if(g){ st.on[g]=t.checked; }
    else if(k==="ai"){ st.ai=+t.value; const o=DLG.c.abuts[st.ai]; st.ws=o.wsGov; st.wl=o.wlGov; st.on.seis=o.As>0; }
    else if(k==="spd"){ st.spd=t.checked; }
    else if(k==="ws"||k==="wl"){ st[k]=+t.value; }
    else if(k){ st[k]=t.value; }
    render();
  },true);
  paint();
})();
</script>
```
- **Saved data:** `abutcalc_v1_autosave`, `abutcalc_v1_projects` and the Export/Import JSON format are unchanged. `subloadsSrc` is a new optional top-level field of `S`; `init()` and Import JSON use `Object.assign(defaultState(), saved)`, so it is kept, and older files simply lack it. The Input ID fingerprint includes it, so the Input ID changes after a pull (as it does for any input change).
- **Check case (hand check):** SubLoads default project, Abut. 1, G1: DC = DC1 + DC2 = 43.6 + 13.5 = **57.1 kip** → `rx.DC[0].P` = 57.1. Σ DC = 57.1 + 61.7 + 58.1 + 61.7 + 57.1 = 295.7 kip = the calculator's `agg.DC.P` after the pull. Geometry: brgSetback = 4.00 − 1.75 − 1.50 = 0.75 ft; soilH = 125.00 − 108.00 = 17.00 ft (= hstem 9.991 + hbw 7.009).
- **How verified:** `node --check` on every plain inline script (12). jsdom end-to-end with a shared localStorage stub (SubLoads' real "Send" button → this pull → Apply): 57 checks pass, including the mapped values above, BR/TU not imported by default, end abutment mirrored, LL envelope, BR/TU imported when ticked (shares 100, own generators off), wind speeds, `S.subloadsSrc`, `markAdopted`, the toolbar and report lines, Undo, Cancel, the beam-count block, the JSON hand-off file and a raw "Export abutments" file, and refusals of a wrong `_schema`, `schemaVersion` 2 (file and stored), a corrupt file, a corrupt stored payload, a factored payload, kN units and a non-numeric DC1. With no hand-off, `computeAll()` (22 checks: D/C, pass, governing case, Input ID) is identical to the old file. The only console message in jsdom is the pre-existing "Could not parse CSS stylesheet" from the report's `@page` margin boxes (the old file gives it too).
- **Other copies:** BridgeXfer v1 is unchanged (already in this file).
- **Open items:** the calculator and SubLoads still differ on the seismic connection force (0.10 vs 0.15/0.25), wind per limit state, Strength IV and support-length H (AUDIT A33/A34). EQ is not imported; the calculator uses its own. The calculator applies LL+IM (with IM) to the footing as well; not changed.

## 2026-10-05 — PR: claude/conn-foundation-loads (PR link added after merge)

### F13. Send foundation loads (HANDOFF.md §4.6, channel `foundationLoads`)   [feature: hand-off (no result change)]
- **Where:** (1) toolbar, after the SubLoads hand-off source span; anchor text `<span id="axh-src" class="axh-src"></span>`. (2) A new `<script>` block at the end of the file, after the abutmentLoads receiver script and before `</body>`; anchor text `/* ---------- foundation loads hand-off (HANDOFF.md §4.6`.
- **Problem:** none (feature). The factored loads at the footing base had no way to reach Pile Designer or Spread Footing.
- **Governing provision:** n/a. No formula, factor, default, unit or code reference changed. The sender reads `window.LAST_R` (`R.LIMITS`, `R.permutations`, `R.comboEffects`, `R.geo.B`, `R.pile`) and calls `R.comboEffects` with the same arguments as the bearing and pile checks; it writes nothing into `S` and does not recompute.
- **What it does:** toolbar **Send foundation loads** opens a dialog (limit-state check boxes, location, sign convention, preview table) with **Send to other tools** (`BridgeXfer.publish('foundationLoads', …)` plus a copy at `bridgeSuite.v1.foundationLoads.by.abutment`) and **Export hand-off (JSON)** (`BridgeXfer.exportFile`). Per limit state, over all γp permutations with and without LL (LSv included, as in the bearing and pile checks), it sends the permutations giving V max, V min, My max, My min and the largest √(Hx² + Hy²); in the pile branch also the permutations behind the pile table's largest and smallest reaction (`R.pile.perLS[ls].best` / `.worstMin`, tagged "pile P max" / "pile P min"). Identical sets are merged ("governs" lists every target).
- **Mapping (per permutation `c = R.comboEffects(ls, perm, liveOn, false)`):**

| Payload field | From the calculator |
|---|---|
| `P` (kip, + down) | `c.V` |
| `Vx` (+ toward the toe = toward the span) | `c.Hx` |
| `Vy` (+ toward positive beam offsets) | `c.Hy` |
| `Mx` (+ moves the resultant toward +y) | `c.Mt − c.V·y_ref` (y_ref = 0 for a spread footing, `R.pile.ygc` in the pile branch) |
| `My` (+ moves the resultant toward the toe) | `c.V·x_ref − c.Mv + c.Mh`, x_ref from the toe = B/2 (spread) or `R.pile.xgcT` (pile branch); equals V·(x_ref − x̄) |
| `factored` | `true` for Strength I, III, IV, V, the construction stage and Extreme Event I; `false` for Service I |
| `limitState` | the calculator's name; "Constr — Str I" is sent as "Strength I (construction stage)" |
| `location`, `reference` | "bottom of footing, footing centre" (`bottomOfFooting`, `footingCentre`) or "bottom of pile cap (footing), pile-group centroid" (`bottomOfPileCap`, `pileGroupCentroid`) |
| `includes` | `footingWeight`, `soilOverFooting`, `earthPressure` all `true` |

- **Before / After** (exact):
  1. Toolbar. Before:
```html
    <span id="axh-src" class="axh-src"></span>
```
     After (one line added after it):
```html
    <span id="axh-src" class="axh-src"></span>
    <button id="fdx-send" title="Send to other tools: the factored and service load combinations at the bottom of the footing / pile cap, per limit state (channel foundationLoads), for Pile Designer and Spread Footing; the dialog also offers Export hand-off (JSON)">Send foundation loads</button>
```
  2. New script before `</body>` (Before: the abutmentLoads receiver's closing `</script>` followed by `</body>`). After — inserted between them:
```html
<script>
/* ---------- foundation loads hand-off (HANDOFF.md §4.6, channel foundationLoads) ----------
   Toolbar "Send foundation loads" opens a dialog; "Send to other tools" publishes, "Export hand-off (JSON)"
   writes the same payload to a file. The cases are the calculator's own limit-state permutations
   (R.comboEffects over R.permutations, LS surcharge included as in the bearing and pile checks), at the
   bottom of the footing: about the footing centre (spread footing) or about the pile-group centroid (pile
   branch). Per limit state the permutations giving V max, V min, My max, My min and the largest horizontal
   resultant are sent, plus in the pile branch the permutations that govern its pile table (duplicates merged). Reads window.LAST_R only; no calculation changes.
   Uses BridgeXfer v1 (top of this file). */
(function(){
  const CH="foundationLoads", SCH="bridge-foundation-loads", SID="abutment";
  const r3=v=>Math.round((+v||0)*1000)/1000;
  const escH=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
  const SIGN="P + = downward (compression on the foundation). x = horizontal, normal to the abutment (along the footing width B), + toward the toe, i.e. toward the span (the calculator's driving direction of Hx). y = horizontal, along the abutment, + in the direction of positive beam offsets (the calculator's beam-position axis). Vx, Vy = horizontal force on the foundation, + toward +x, +y. Mx = moment about the x axis, + when it moves the resultant toward +y, so e_y = Mx/P (the calculator's M_t). My = moment about the y axis, + when it moves the resultant toward +x (toward the toe), so e_x = My/P.";
  const lsOut=ls=>ls==="Constr — Str I"?"Strength I (construction stage)":ls;
  const factored=ls=>ls!=="Service I";
  /* all cases the payload can carry, per limit state, from the current results */
  function cases(R, lsSel){
    const B=R.geo.B, pile=S.fnd.branch==="pile" && R.pile && R.pile.n>0, out=[];
    const xc=pile? R.pile.xgcT : B/2, yc=pile? R.pile.ygc : 0;
    Object.keys(R.LIMITS).forEach(ls=>{
      if(lsSel && !lsSel.includes(ls)) return;
      const all=[];
      for(const pl of R.permutations(ls)){
        const c=R.comboEffects(ls,pl.perm,pl.liveOn,false);
        const My=c.V*xc-c.Mv+c.Mh, Mx=c.Mt-c.V*yc;   // about the reference point; + toward the toe / + toward +y
        all.push({c, v:{P:r3(c.V), Vx:r3(c.Hx), Vy:r3(c.Hy), Mx:r3(Mx), My:r3(My)}, H:Math.hypot(c.Hx,c.Hy)});
      }
      if(!all.length) return;
      const pick=(f,s)=>all.reduce((b,a)=>s*f(a)>s*f(b)+1e-9?a:b,all[0]);
      const sameV=(a,b)=>["P","Vx","Vy","Mx","My"].every(k=>a.v[k]===b.v[k]);
      const mine=[], put=(a,tag)=>{ const same=mine.find(m=>sameV(m.a,a)); if(same){ same.tags.push(tag); return; } mine.push({a,tags:[tag]}); };
      [["V max",a=>a.v.P,1],["V min",a=>a.v.P,-1],["My max",a=>a.v.My,1],["My min",a=>a.v.My,-1],["H max",a=>a.H,1]].forEach(([tag,f,s])=>put(pick(f,s),tag));
      if(pile && R.pile.perLS && R.pile.perLS[ls]){   // the permutations that govern this calculator's own pile table
        const q=R.pile.perLS[ls], find=c=>c&&all.find(a=>a.c.V===c.V&&a.c.Mv===c.Mv&&a.c.Mh===c.Mh&&a.c.Hx===c.Hx&&a.c.Mt===c.Mt&&a.c.Hy===c.Hy);
        const b1=find(q.best&&q.best.c), b2=find(q.worstMin&&q.worstMin.c); if(b1) put(b1,"pile P max"); if(b2) put(b2,"pile P min"); }
      mine.forEach(m=>{ const g=m.tags.join(", "), c=m.a.c;
        out.push(Object.assign({ id:ls+":"+g, name:lsOut(ls)+" — "+g, limitState:lsOut(ls), factored:factored(ls) }, m.a.v,
          { governs:g, combination:c.lbl+(c.liveOn?"":" (no live load)") })); });
    });
    return out;
  }
  function build(lsSel){
    const R=window.LAST_R; if(!R||!R.LIMITS||!R.permutations) return { err:"No results yet: fix the input errors first." };
    const pile=S.fnd.branch==="pile" && R.pile && R.pile.n>0;
    if(S.fnd.branch==="pile" && !pile) return { err:"Pile branch with no active piles: activate piles first." };
    const cs=cases(R,lsSel); if(!cs.length) return { err:"Pick at least one limit state." };
    const nErr=(typeof WARNINGS!=="undefined"?WARNINGS:[]).filter(w=>w.level==="err").length;
    const sp=window.BridgeXfer&&BridgeXfer.sharedProject?BridgeXfer.sharedProject():null;
    const B=R.geo.B;
    const p={ _schema:SCH, schemaVersion:1, producer:"Abutment Calculator", producerFile:"abutment_calculator.html",
      project:{ name:(S.proj&&S.proj.name)||"", bridgeId:(sp&&sp.bridgeId)||"" },
      units:{ force:"kip", moment:"kip-ft", length:"ft" },
      element:{ type:"abutment", label:(S.proj&&S.proj.name)||"Abutment" },
      location: pile? "bottom of pile cap (footing), pile-group centroid ("+r3(R.pile.xgcT)+" ft from the toe, "+r3(R.pile.ygc)+" ft from the abutment centreline)"
                    : "bottom of footing, footing centre ("+r3(B/2)+" ft from the toe, on the abutment centreline)",
      reference:{ level: pile?"bottomOfPileCap":"bottomOfFooting", point: pile?"pileGroupCentroid":"footingCentre", fromToe: r3(pile?R.pile.xgcT:B/2), fromCentreline: r3(pile?R.pile.ygc:0) },
      includes:{ footingWeight:true, soilOverFooting:true, earthPressure:true },
      axes:{ x:"horizontal, normal to the abutment, + toward the toe (toward the span)", y:"horizontal, along the abutment, + toward positive beam offsets" },
      geometry:{ footingWidthB:r3(B), footingLength:r3(+S.geom.Lftg||+S.geom.Lab), footingThickness:r3(S.geom.tf) },
      signConvention:SIGN, cases:cs,
      notes:[
        "Each limit state's load-factor permutations (γp max/min of DC, DW, EV, EH, ES, with and without live load) are the calculator's own; per limit state the permutations giving V max, V min, My max, My min and the largest horizontal resultant are sent, identical ones merged"+(pile?"; in the pile branch also the permutations that give the largest and smallest pile reaction in the calculator's pile table (\"pile P max\", \"pile P min\").":"."),
        "Strength and Extreme Event cases are factored (factored:true); Service I has load factors of 1.0 (factored:false).",
        "Every case includes the abutment and footing self-weight, the soil over the heel (EV), the earth pressure (EH, ES, LS) and the superstructure loads, at the bottom of the footing.",
        "The vertical live-load surcharge over the heel (LSv) is included in every case, as in the calculator's bearing and pile checks; its sliding and eccentricity checks leave it out where it helps.",
        pile? "Moments are about the pile-group centroid. My is + toward the toe here (the calculator's pile table uses ex + toward the heel)." : "Moments are about the footing centre (B/2 from the toe, on the abutment centreline).",
        "Load factors per AASHTO LRFD 10th Ed. Tables 3.4.1-1 and 3.4.1-2 as set in the calculator."]
        .concat(nErr?["The calculator reported "+nErr+" input error(s) when these loads were sent; check them."]:[]) };
    return { p, n:cs.length };
  }
  let DLG=null;
  function css(){ if(document.getElementById("fdx-css")) return; const s=document.createElement("style"); s.id="fdx-css";
    s.textContent="#fdx-ov{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 8px}"+
      "#fdx-dlg{background:#fff;color:#1a1a1a;max-width:980px;width:100%;border-radius:6px;padding:14px 18px;box-shadow:0 6px 30px rgba(0,0,0,.3);font-size:.86rem}"+
      "#fdx-dlg h3{margin:0 0 6px 0;font-size:1.05rem}#fdx-dlg table{border-collapse:collapse;width:100%;margin:4px 0}#fdx-dlg td,#fdx-dlg th{border:1px solid #ddd;padding:2px 6px;text-align:left}"+
      "#fdx-dlg td.n{text-align:right}#fdx-dlg .fdx-btns{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}#fdx-dlg .fdx-note{color:#555;font-size:.8rem}"+
      "@media print{#fdx-send,#fdx-ov{display:none !important}}";
    document.head.appendChild(s); }
  function close(){ const ov=document.getElementById("fdx-ov"); if(ov) ov.remove(); DLG=null; }
  function render(){
    const R=window.LAST_R, lss=Object.keys(R.LIMITS); if(!DLG.sel) DLG.sel=lss.slice();
    const b=build(DLG.sel); DLG.b=b;
    let ov=document.getElementById("fdx-ov"); if(!ov){ ov=document.createElement("div"); ov.id="fdx-ov"; document.body.appendChild(ov); }
    const f=v=>escH(r3(v));
    ov.innerHTML="<div id='fdx-dlg' role='dialog' aria-label='Send foundation loads'><h3>Send foundation loads</h3>"+
      "<div>Factored and service load combinations at the bottom of the footing / pile cap, per limit state, for Pile Designer and Spread Footing (channel foundationLoads).</div>"+
      "<div style='margin:6px 0'>"+lss.map(ls=>"<label style='margin-right:12px'><input type='checkbox' data-fdx-ls='"+escH(ls)+"'"+(DLG.sel.includes(ls)?" checked":"")+"> "+escH(lsOut(ls))+"</label>").join("")+"</div>"+
      (b.err?"<div style='color:#c62828'>"+escH(b.err)+"</div>":
        "<div class='fdx-note'><b>Location:</b> "+escH(b.p.location)+"<br><b>Sign convention:</b> "+escH(SIGN)+"</div>"+
        "<div style='max-height:42vh;overflow:auto'><table><tr><th>Case</th><th>Factored</th><th>P (kip)</th><th>Vx</th><th>Vy</th><th>Mx (kip-ft)</th><th>My</th></tr>"+
        b.p.cases.map(c=>"<tr><td title='"+escH(c.combination)+"'>"+escH(c.name)+"</td><td>"+(c.factored?"yes":"no")+"</td><td class='n'>"+f(c.P)+"</td><td class='n'>"+f(c.Vx)+"</td><td class='n'>"+f(c.Vy)+"</td><td class='n'>"+f(c.Mx)+"</td><td class='n'>"+f(c.My)+"</td></tr>").join("")+"</table></div>")+
      "<div class='fdx-btns'><button id='fdx-cancel'>Cancel</button><button id='fdx-export'"+(b.err?" disabled":"")+">Export hand-off (JSON)</button><button class='primary' id='fdx-go'"+(b.err?" disabled":"")+">Send to other tools</button></div></div>";
  }
  function open(){
    if(!window.BridgeXfer){ alert("The hand-off helper is not available in this browser."); return null; }
    if(!window.LAST_R){ alert("No results yet: fix the input errors first."); return null; }
    DLG={ sel:null }; css(); render(); return DLG;
  }
  function send(how){
    const b=DLG&&DLG.b; if(!b||b.err) return;
    const ss=document.getElementById("saveStatus");
    if(how==="export"){ const r=BridgeXfer.exportFile(CH,Object.assign({},b.p,{ producedAt:new Date().toISOString() })); if(r.error){ alert(r.error); return; } close(); if(ss) ss.textContent="foundation loads exported ("+b.n+" cases)"; return; }
    const r=BridgeXfer.publish(CH,b.p,"Abutment Calculator","abutment_calculator.html");
    if(r.error){ alert("Could not send: "+r.error); return; }
    try{ localStorage.setItem("bridgeSuite.v1."+CH+".by."+SID, JSON.stringify(r.payload)); }catch(e){}
    close(); if(ss) ss.textContent="foundation loads sent ("+b.n+" cases) — pull them in Pile Designer";
  }
  document.addEventListener("click",ev=>{
    const t=ev.target; if(!t||!t.closest) return;
    if(t.closest("#fdx-send")){ open(); return; }
    if(t.id==="fdx-cancel"){ close(); return; }
    if(t.id==="fdx-go"){ send("send"); return; }
    if(t.id==="fdx-export"){ send("export"); return; }
  });
  document.addEventListener("change",ev=>{
    const t=ev.target; if(!DLG||!t||!t.closest||!t.closest("#fdx-dlg")) return;
    ev.stopPropagation();
    const ls=t.getAttribute("data-fdx-ls"); if(ls){ DLG.sel=t.checked?DLG.sel.concat([ls]):DLG.sel.filter(x=>x!==ls); render(); }
  },true);
  window.AbutFoundationHandoff={ build, cases, open, send, close, state:()=>DLG };   // used by tests; no effect on results
})();
</script>
```
- **Check case:** default project, Strength I — V max (1.25 DC + 1.50 DW + 1.35 EV + 0.90 EH + 1.75 (LL, BR, LS) + 0.50 TU/CR/SH), B = 13.0 ft.
  - ΣγV = 1.25×722.7 + 1.25×510 + 1.50×72 + 1.35×501.6 + 1.75×52.8 (LSv) + 1.75×420 = **3153.435 kip** (sent P = 3153.435).
  - ΣγMv (about the toe) = 21381.536; ΣγMh = 0.90×2879.086 + 1.75×785.205 + 1.75×178.5 + 0.50×127.5 + 0.50×76.5 = 4379.662 kip-ft.
  - My = 3153.435 × 6.5 − 21381.536 + 4379.662 = **3495.453 kip-ft** (sent 3495.453); My/P = 1.108 ft = B/2 − x̄ toward the toe.
  - Cross-check with the calculator's own bearing check (Strength I governing permutation): V = 2977.875, e = 1.9897 ft toward the toe → V·e = 5925.15 = the sent "Strength I — My max" (5925.145).
  - Pile branch (24 piles, default grid): "Strength I — My max, pile P max" imported into Pile Designer with the same pile coordinates gives a largest pile reaction of 211.213 kip, equal to the calculator's pile table.
- **How verified:** `node --check` on every plain inline script of the four changed files (abutment 13, SubLoads 3, Pile Designer 4, Spread Footing 18 blocks; none is JSX — Pile Designer is pre-compiled `React.createElement`). End-to-end in jsdom with one shared localStorage stub (React UMD served locally): **79 of 79 assertions pass** — abutment default → Pile Designer; abutment pile branch → Pile Designer with the same pile layout; SubLoads Pier 2 top of footing → Spread Footing; SubLoads Pier 1 bottom of footing → Pile Designer (rotated axes); JSON export → import into both receivers; refusals (wrong `_schema`, `schemaVersion` 2 and 3, kN units, non-finite P, missing `factored`, corrupt JSON file, corrupt stored payload, nothing sent, service-only payload into the footing, integral-abutment mode). No-hand-off invariance against the pre-change files: abutment `computeAll()` (dashboard, every permutation table, Input ID); SubLoads `combine()` envelopes and `concurrentSets()` of every unit and `abutExportData()`; Spread Footing `computeAll()` + `computePhase2()` (by-type and Direct mode); Pile Designer `computeAll(DEFAULT_INPUTS)` and the rendered app text (identical apart from the two new buttons). The earlier e2e suites still pass on this branch: memberReactions (Steel Beam → BasePlate / Spread Footing, 56/56) and abutmentLoads (SubLoads → abutment, 57/57).
- **Other copies:** BridgeXfer v1 (unchanged) is in all four tools. The sender code exists only here.
- **Open items:** (1) cases include the vertical LS over the heel even where it helps stability (the calculator's sliding and eccentricity checks leave it out); (2) the transverse axis y is the calculator's beam-offset axis, which is not tied to a bridge direction; (3) the footing is assumed centred on the abutment centreline for Mx (spread branch).

## 2026-10-09 — PR: claude/tabs-abutment (PR link added after merge)

### F14. Input column split into tabs   [UI only — no calculation change]
- **Date / type:** 2026-10-09, UI only (no result change). Engineer's request (2026-10-09): "Go through all the apps and make sure they are all formatted with the input panel having tabs rather than one long scrolling input panel." Same approach as `Steel Beam Design - AISC 15th.html` (fix log T1).
- **How it works:** `buildInputs()` still builds every input panel (I-1 … I-12, `data-cid="in-…"`) into `#inputCol` exactly as before. Right after the `innerHTML` assignment, the new `abutInputTabs(P)` **moves** the finished panel nodes into one pane per tab. Nothing is rebuilt or re-templated, so every `data-path`, `id`, delegated handler, collapse state (`S.ui.collapse`) and value is unchanged. Panel numbering is kept as is (I-1 … I-6, I-6b, I-7 [pile branch only], I-8 … I-12).
- **Tabs (in order) and the panels in each** (`data-cid` in brackets):

| Tab | Panels |
|---|---|
| Geometry | I-1 Geometry (`in-geom`), I-2 Materials (`in-mat`) |
| Soil & Foundation | I-3 Backfill & Earth Pressure (`in-soil`), I-4 Foundation (`in-fnd`), I-7 Pile Group Layout & Resistances (`in-piles`, pile branch only) |
| Girders | I-5 Girders — Layout & Reaction Matrix (`in-beams`), I-6 Longitudinal Distribution (`in-dist`), I-6b Longitudinal Load Calculation (`in-longit`) |
| Factors | I-8 Load & Resistance Factors (`in-fact`) |
| Rebar & Bearings | I-9 Reinforcement (`in-reinf`), I-10 Bearings & Bearing Seat (`in-brg`) |
| Seismic | I-11 Seismic — Extreme Event I (`in-seis`) |
| Assumptions | I-12 Engineering Assumptions (`in-assum`) |

  I-7 is built after I-6b, so moving it into "Soil & Foundation" changes its DOM position only. `updateDerivedInInputs()` indexes `#inputCol .derived` [0] and [1], which are both in I-1 and stay first. A tab with no panel is hidden (none is empty in any current mode). The project title block and toolbar are in the page header, not in the input column, and are unchanged.
- **Error marker:** a red dot on a tab holding an input that `markFieldValidity()` marks `bad` (outside the VALID hard limits) or `warnf` (outside the typical range), or a number the browser cannot parse (`validity.badInput`). The tab's tooltip says which. `abutInputTabMarks()` runs at the end of `markFieldValidity()`, so it follows every rebuild and every recalc (`updateDerivedInInputs()`).
- **Keyboard / accessibility:** `role="tablist"`, `role="tab"` with `aria-selected` / `aria-controls`, `role="tabpanel"` with `aria-labelledby`; roving `tabindex`; ←/→ (and ↑/↓), Home and End.
- **Layout:** the tab strip uses the look of the existing output tab bar (`.tabbar .tab`: `--panel-h` tabs, navy active tab, navy 2 px rule). It is sticky at the top of the viewport while the input column is in view (the column has no scroll box of its own; the page scrolls), and wraps on narrow screens. When a tab is clicked while the column top is scrolled above the viewport, the page scrolls back so the start of the new pane is visible.
- **New storage key:** `abutcalc_inputTab_v1` (localStorage, plain string: `geom`, `found`, `gird`, `fact`, `detail`, `seis` or `assum`). Every read/write is in try/catch, with an in-memory copy so the tab survives rebuilds when storage is blocked. It is **not** in `S`, so the autosave (`abutcalc_v1_autosave`), saved projects (`abutcalc_v1_projects`), Export/Import JSON and the `bridgeSuite.v1.*` hand-offs are unchanged. (`S.ui.tab` is the existing *output* tab and is untouched.)
- **Jump links:** nothing in the tool scrolls to or focuses an input-column field (the dashboard and `.xlink` jumps all target output panels through `gotoPanel()` / `activateTab()`), so no jump code needed changing. Project load, Import JSON, Undo, Reset and the SubLoads hand-off all call `buildInputs()`, which re-applies the remembered tab.
- **Print:** unchanged. The existing print CSS hides `.wrap` (the whole app, input column included); the report is built separately in `#report`.
- **Governing provision:** none (no engineering change).
- **Before / After** (exact; LF line endings; `buildInputs` and `markFieldValidity` are each defined once):
  1. CSS. Anchor (unchanged): `.tabpage.active{display:block;}`. After: these lines inserted right after it:
     ```css
     /* input column tabs (abutInputTabs) — same look as the output .tabbar */
     #abutInTabs{position:sticky;top:0;z-index:20;display:flex;flex-wrap:wrap;gap:2px;margin:0 0 10px 0;padding-top:4px;
       background:#f2f2ec;border-bottom:2px solid var(--navy);}
     #abutInTabs .abutInTab{display:inline-flex;align-items:center;background:var(--panel-h);border:1px solid var(--line);border-bottom:none;
       border-radius:4px 4px 0 0;padding:4px 10px;font-weight:bold;color:#4a4a42;}
     #abutInTabs .abutInTab:hover{background:#e4e7dd;}
     #abutInTabs .abutInTab[aria-selected="true"]{background:var(--navy);color:#fff;border-color:var(--navy);}
     #abutInTabs .abutInTab:focus-visible{outline:2px solid var(--navy-lt);outline-offset:1px;}
     .abutInDot{display:none;width:7px;height:7px;border-radius:50%;background:var(--fail);margin-left:6px;box-shadow:0 0 0 1.5px #fff;}
     .abutInTab.has-err .abutInDot{display:inline-block;}
     .abutInTab[hidden],.abutInPane[hidden]{display:none !important;}
     ```
  2. New block inserted immediately before the comment `/* ---------- beam position computation (shared by input & calc) ---------- */` (i.e. right after `function panel(...)`):
     ```js
     /* ---------- input column tabs (UI only) ----------
        buildInputs() still builds every panel into #inputCol exactly as before;
        abutInputTabs() then MOVES the finished panel nodes into one pane per tab.
        Nothing is rebuilt, so data-path / data-cid, the delegated handlers and the
        collapse state are untouched. The active tab is remembered per browser in
        localStorage key abutcalc_inputTab_v1 (never in S, so the autosave, the
        saved projects and the JSON export are unchanged). */
     const ABUT_IN_TABS=[
       ['geom','Geometry'],['found','Soil & Foundation'],['gird','Girders'],
       ['fact','Factors'],['detail','Rebar & Bearings'],['seis','Seismic'],['assum','Assumptions']];
     const ABUT_IN_SEC={
       'in-geom':'geom','in-mat':'geom',
       'in-soil':'found','in-fnd':'found','in-piles':'found',
       'in-beams':'gird','in-dist':'gird','in-longit':'gird',
       'in-fact':'fact',
       'in-reinf':'detail','in-brg':'detail',
       'in-seis':'seis',
       'in-assum':'assum'};
     const ABUT_IN_KEY='abutcalc_inputTab_v1';
     let abutInTabCur=null;   /* in-memory copy: the tab survives rebuilds even without storage */
     function abutInTabGet(){ if(abutInTabCur) return abutInTabCur; try{ return localStorage.getItem(ABUT_IN_KEY)||''; }catch(e){ return ''; } }
     function abutInTabSet(t){ abutInTabCur=t; try{ localStorage.setItem(ABUT_IN_KEY,t); }catch(e){} }
     function abutInputTabs(P){
       const bar=document.createElement('div');
       bar.id='abutInTabs'; bar.setAttribute('role','tablist'); bar.setAttribute('aria-label','Input groups');
       const panes={};
       ABUT_IN_TABS.forEach(([k,lab])=>{
         const b=document.createElement('button');
         b.type='button'; b.className='abutInTab'; b.id='abutInTab_'+k; b.dataset.pane=k;
         b.setAttribute('role','tab'); b.setAttribute('aria-controls','abutInPane_'+k);
         const sp=document.createElement('span'); sp.textContent=lab; b.appendChild(sp);
         const dot=document.createElement('span'); dot.className='abutInDot'; dot.setAttribute('aria-hidden','true'); b.appendChild(dot);
         b.addEventListener('click',()=>abutSetInTab(k,true));
         b.addEventListener('keydown',abutInTabKey);
         bar.appendChild(b);
         const pn=document.createElement('div');
         pn.className='abutInPane'; pn.id='abutInPane_'+k; pn.setAttribute('role','tabpanel');
         pn.setAttribute('aria-labelledby','abutInTab_'+k);
         panes[k]=pn;
       });
       /* move the built panels; a node not in the map stays with the panel before it */
       let cur=ABUT_IN_TABS[0][0];
       Array.from(P.childNodes).forEach(n=>{
         const cid=n.getAttribute&&n.getAttribute('data-cid');
         if(cid&&ABUT_IN_SEC[cid]) cur=ABUT_IN_SEC[cid];
         panes[cur].appendChild(n);
       });
       P.appendChild(bar);
       ABUT_IN_TABS.forEach(([k])=>{
         P.appendChild(panes[k]);
         document.getElementById('abutInTab_'+k).hidden=!panes[k].querySelector('.panel');
       });
       let t=abutInTabGet();
       if(!panes[t]||!panes[t].querySelector('.panel')) t=ABUT_IN_TABS[0][0];
       abutSetInTab(t,false);
     }
     function abutSetInTab(t,remember){
       ABUT_IN_TABS.forEach(([k])=>{
         const b=document.getElementById('abutInTab_'+k), pn=document.getElementById('abutInPane_'+k); if(!b||!pn) return;
         const on=(k===t);
         b.setAttribute('aria-selected',on?'true':'false'); b.tabIndex=on?0:-1;
         pn.hidden=!on;
       });
       if(remember){
         abutInTabSet(t);
         /* keep the tab strip in view when switching from far down a long pane */
         const bar=document.getElementById('abutInTabs'), col=document.getElementById('inputCol');
         if(bar&&col){ const top=col.getBoundingClientRect().top; if(top<0) window.scrollBy(0,top); }
       }
     }
     function abutInTabKey(e){
       const vis=ABUT_IN_TABS.map(([k])=>document.getElementById('abutInTab_'+k)).filter(b=>b&&!b.hidden);
       const i=vis.indexOf(e.currentTarget); let j=-1;
       if(e.key==='ArrowRight'||e.key==='ArrowDown') j=(i+1)%vis.length;
       else if(e.key==='ArrowLeft'||e.key==='ArrowUp') j=(i-1+vis.length)%vis.length;
       else if(e.key==='Home') j=0;
       else if(e.key==='End') j=vis.length-1;
       if(j<0) return;
       e.preventDefault(); abutSetInTab(vis[j].dataset.pane,true); vis[j].focus();
     }
     /* red dot on a tab holding an input that this tool marks bad (hard-limit error)
        or warnf (outside the typical range), or a number the browser cannot parse */
     function abutInputTabMarks(){
       if(!document.getElementById('abutInTabs')) return;
       const bad={}, warnOnly={};
       document.querySelectorAll('#inputCol .abutInPane input, #inputCol .abutInPane select').forEach(i=>{
         const pn=i.closest('.abutInPane'); if(!pn) return;
         const k=pn.id.replace('abutInPane_','');
         if(i.classList.contains('bad')||(i.validity&&i.validity.badInput)) bad[k]=1;
         else if(i.classList.contains('warnf')) warnOnly[k]=1;
       });
       ABUT_IN_TABS.forEach(([k])=>{
         const b=document.getElementById('abutInTab_'+k); if(!b) return;
         const on=!!(bad[k]||warnOnly[k]);
         b.classList.toggle('has-err',on);
         b.title=bad[k]?'An input on this tab has an error':(warnOnly[k]?'An input on this tab is outside its typical range':'');
       });
     }
     ```
  3. `buildInputs()`. Before:
     ```js
       document.getElementById("inputCol").innerHTML=html;
       markFieldValidity();
     ```
     After:
     ```js
       document.getElementById("inputCol").innerHTML=html;
       abutInputTabs(document.getElementById("inputCol"));   /* move the panels just built into the input tabs */
       markFieldValidity();
     ```
  4. `markFieldValidity()`. Before:
     ```js
         else if(v<r.typ[0]||v>r.typ[1]) el.classList.add("warnf");
       });
     }
     ```
     After:
     ```js
         else if(v<r.typ[0]||v>r.typ[1]) el.classList.add("warnf");
       });
       abutInputTabMarks();
     }
     ```
- **Check case:** default project, Input ID **11D4F07F-29CD**, identical before and after; every dashboard D/C and every output tab's text identical (see How verified).
- **How verified:** `node --check` on all 13 inline scripts. Headless Chromium (Playwright; KaTeX 0.16.11, Plotly 2.35.2 and three.js 0.128.0 served locally at the pinned versions; `Date` fixed so time stamps match), main vs branch: default; pile branch; pile branch in coordinate mode; seismic on; BR/TU/CR·SH calculated; Coulomb + rock + passive + manual share + position mode + N = 5; bad inputs (h_stem = −5, f′c = 25). For each: Input ID, dashboard, warnings, all 8 output tabs' text, `S`, the autosave, the `.derived` read-outs, the foundation-loads hand-off payload (`AbutFoundationHandoff.build`) and the hand-off buttons identical; the input list (tag/type/data-path/id/class) identical apart from the 7 new tab buttons, every input in exactly one pane. Export JSON → Import JSON, and Save Project → Reset Defaults → Projects… Load: identical results, identical exported file and saved-projects store. SubLoads "Send to Abutment Calculator" (default SubLoads project) → Pull from SubLoads → Apply: identical dialog text and identical results. Tab UI: arrow/Home/End keys, remembered tab after a rebuild and after reload, key not in the autosave, sticky strip at top 0 when scrolled, red dot appears for h_stem = −5 and clears when fixed, input column hidden in print media, storage that throws (tabs still work). No console errors on either version. At 400 px the page has the same 132 px horizontal overflow on main and on the branch (from existing content, not the tab strip, which wraps).
- **Other copies:** none (the tab code exists only in this file; the Steel Beam version is a separate implementation).
- **Open items:** the pre-existing 132 px horizontal overflow at 400 px width (existing content; not changed here).

## 2026-10-12 — PR: claude/sweep-abutment (PR link added after merge)

Open-item sweep (inventory §18: ABT-O1…O11, ABT-F12, ABT-F13, ABT-C5, ABT-UI1). Basis: AASHTO LRFD 10th Ed. (2024). Every edit is listed exactly in the appendix as a unified diff of `abutment_calculator.html` against origin/main `0aff3b9` (anchor text = the context lines). All numbers below come from running the real `computeAll()` of the old and new files in headless Chromium (harness `abswp/ev.mjs`, `abswp/cmp.mjs`). "Benchmark" = `benchState()` (B = 13 ft, L_ftg = 44 ft, 6 girders, DC/DW/LL = 85/12/70 kip each, WS Vy = 2.5 kip each).

### F15. Soil and rock bearing: transverse eccentricity e_L included (ABT-O2)   [calc change] [MORE conservative]
- **Where:** `computeAll` bearing loop, anchor `const eL=Math.abs(c.Mt)/c.V;`; new global helper `function biaxRockQ(V,e,eL,B,L)` (after `linSegs`); display in `renderTabStab` panel 3.3 (`o-brg`), the bearing plot callout in `drawChartsFor`, the FBD label in `drawFBD`, and `sizingHints` (uses L′).
- **Problem:** the bearing check used B′ = B − 2e along B only. The transverse moment M_t (girder reactions × offsets + transverse wind × seat height, already used by the pile branch and the foundation hand-off) was ignored, so q was under-estimated whenever M_t ≠ 0.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 10.6.1.3 (effective dimensions B′ = B − 2e_B, L′ = L − 2e_L, Eq. 10.6.1.3-1); Art. 10.6.5 and 11.6.3.2 (linear pressure on rock).
- **Before:** soil `q=c.V/(Bp*Lftg)`; rock `q=c.V/(B*Lftg)*(1+6*e/B)` or `2*c.V/(3*Lftg*(B/2-e))`.
- **After:** e_L = |M_t|/V (footing taken as centred on the abutment centreline, as the hand-off already assumes).
  - Soil: q = V/(B′·L′), L′ = L_ftg − 2e_L; a permutation with L′ ≤ 0 is skipped with the existing "resultant outside the footing" warning.
  - Rock, e_L > 0: planar no-tension pressure. Inside the kern (6e/B + 6e_L/L ≤ 1) q_max = V/(BL)(1 + 6e/B + 6e_L/L). Outside, the plane q = a + bx + cy is solved by Newton iteration (400 strips along L, exact integration across B); non-convergence raises an error warning. Rock with e_L = 0 is unchanged (same trapezoid/triangle formulas).
  - The 2-D free body, equilibrium closure, toe/heel strip design and the Service I settlement pressure keep the per-ft (along-B) distribution; noted on the panel.
- **Solver check:** e_L = 10⁻⁶ ft reproduces 2V/(3L(B/2 − e)) for e = 2.5…5.5 ft (V = 3000, B = 13, L = 44) to 10⁻⁶ relative; four partial-contact cases re-integrated on a 1200 × 1200 grid return ΣV, e and e_L within 4×10⁻⁷ relative.
- **Check case (benchmark + girder group offset 2 ft, `beams.groupOff` = 2), governing Strength I** (1.25DC + 1.50DW + 1.00EV + 1.50EH + 1.75(LL,BR,LS) + 0.50TU/CR/SH): V = 2977.88 kip, e = 1.990 ft, M_t = 1.25·510·2 + 1.50·72·2 + 1.75·420·2 = 2961.0 kip-ft.
  - e_L = 2961.0/2977.88 = 0.994 ft.
  - Soil: B′ = 13 − 2(1.990) = 9.021 ft; before q = 2977.88/(9.021·44) = **7.503 ksf** (D/C 0.926); after L′ = 44 − 1.989 = 42.01 ft, q = 2977.88/(9.021·42.01) = **7.858 ksf**, D/C = 7.858/8.10 = **0.970**.
  - Rock: before trapezoid 2977.88/(13·44)(1 + 6·1.990/13) = **9.987 ksf** (D/C 1.233); after 6e/B + 6e_L/L = 0.918 + 0.136 = 1.054 > 1 → partial contact, q_max = **10.69 ksf** (corner), D/C **1.320**.
- **Benchmark (girders symmetric):** Strength I M_t = 0, so bearing is unchanged (q = 7.503 ksf, D/C 0.926; self-test unchanged). Strength III/V/Service carry M_t from WS/WL Vy (e_L = 0.15–0.21 ft) but do not govern. SubLoads default pull+apply: bearing D/C 0.60 → 0.62.

### F16. Stem eccentric bearing moment: γDC/γDW min and LL-reaction-off permutations (ABT-O6)   [calc change] [MORE conservative]
- **Where:** new helper `function stemEcc(L,ns)` before the stem loop (anchor `function stemEcc(L,ns){`); stem loop (`const se=stemEcc(L,ns)`); Service I `MsStem` (`const seSvc=stemEcc(LIMITS["Service I"],1)`); stem V&M diagram for strength/EE selections (`stemEcc(Lst,ns).Mecc`); stem display note.
- **Problem:** M_ecc = (P_v·e_brg + γDC·ΣW·e_sw)/L_ab always used γDC,max, γDW,max and the full LL reaction. When the bearing sits behind the stem centroid (e_brg < 0) or the self-weight eccentricity is negative, those factors reduce the back-face moment, so the minimum factors / no LL reaction govern.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 3.4.1 and Table 3.4.1-2 (γp max or min, whichever is more critical); Table 3.4.1-1.
- **After:** for each strength/EE/construction limit state γDC ∈ {max (Strength IV 1.50), min}, γDW ∈ {max, min} and LL reaction on/off are tried and the largest M_ecc is used. LS and BR stay on (conservative: a truck on the approach with none on the span). Service I (crack control) takes LL reaction on/off. Ties keep the old combination, so results are bit-identical where the old one governs. The label adds `[0.90·DC, 0.65·DW, no LL reaction]` only when a different permutation governs.
- **Check case (benchmark with bearing setback 0.25 ft):** x_brg = 6.25 ft, stem centroid 5.75 ft, e_brg = −0.50 ft; ΣW·e_sw = −74.25 kip-ft (backwall).
  - Before (Strength I): P_v = 1.25·510 + 1.50·72 + 1.75·420 = 1480.5 kip; M_ecc = (1480.5(−0.5) + 1.25(−74.25))/44 = **−18.93**; M_u = **76.50 kip-ft/ft**.
  - After: γDC 0.90, γDW 0.65, no LL: P_v = 459.0 + 46.8 = 505.8 kip; M_ecc = (505.8(−0.5) + 0.90(−74.25))/44 = **−7.27**; M_u = **88.17 kip-ft/ft** (+15%; flexure D/C 0.253 → 0.291). Service M_s 51.27 → 56.04 kip-ft/ft (no LL reaction).
- **Benchmark (e_brg = +0.50 ft):** unchanged (M_u = 110.15).

### F17. Footing crack control with the Service I moments (ABT-O7)   [calc change] [mixed — LESS conservative in the benchmark]
- **Where:** after `R.toeDem=toeDem; R.heelDem=heelDem;` (anchor `const footSvc={toe:0,heel:0`); `Ms:footSvc.toe` / `Ms:footSvc.heel` in the toe/heel `sectionCheck` calls; `R.footingCrackNote`; Tab 1 basis line 9.
- **Before:** `Ms:toeDem.Mu/1.4`, `Ms:heelDem.Mu/1.4` (flagged approximation).
- **After:** M_s = max over the Service I permutations (LL on/off) of the face moment from that permutation's own linear contact pressure (spread) or pile reactions (piles), all factors 1.0, toe self-weight at 1.0; heel = downward loads (`heelLoads`, γ = 1) minus upward, on the face the heel design checks.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 5.6.7 (f_ss from the Service I moment); Table 3.4.1-1 (Service I).
- **Check case (benchmark), Service I with LL:** V = 2312.10 kip, e = 1.503 ft, q_toe = 6.845, q_heel = 1.239 ksf.
  - Toe: q at the face (3.5 ft) = 6.845 − 5.606·3.5/13 = 5.336 ksf; M_up = 5.336·3.5²/2 + 1.509·(3.5/2)·(7/3) = 32.68 + 6.16 = 38.85; M_s = 38.85 − 0.45·3.5²/2 = **36.09** (was 53.43/1.4 = 38.17). s_max 35.52 → 38.08 in.
  - Heel: w_dn = 2.28 + 0.45 + 0.24 = 2.97 ksf, M_dn = 2.97·5²/2 = 37.13; M_up = 24.47; M_s = **12.65** (was 28.45/1.4 = 20.32). s_max 72.84 → 121.58 in.
  - Pile benchmark: toe 32.52 → 30.75, heel 21.10 → 14.50 kip-ft/ft.
- **Conservatism:** LESS conservative here (the 1/1.4 ratio over-stated M_s); it can be more conservative where live load dominates.

### F18. E_c per Eq. 5.4.2.4-1 for the crack-control modular ratio (ABT-O4)   [calc change] [slightly LESS conservative]
- **Where:** anchor `const wcE=Math.min(0.155,Math.max(0.090,m.gc-0.005));`; `sectionCheck` returns `Ec, wcE, nMod`; new first line in the crack-control block of `sectionHTML`.
- **Before:** `const Ec=1820*Math.sqrt(m.fc);` **After:** `Ec = 120000·K1·w_c²·f′c^0.33`, K1 = 1.0, w_c = γ_c − 0.005 kcf (Table 3.5.1-1 reinforcement allowance), limited to 0.090–0.155. E_c is used only for n = max(6, 29000/E_c).
- **Governing provision:** AASHTO LRFD 10th Ed. Eq. 5.4.2.4-1; Table 3.5.1-1.
- **Check case (benchmark, f′c = 4 ksi, γ_c = 0.150):** w_c = 0.145; E_c = 120000·0.145²·4^0.33 = 2523·1.5801 = **3987 ksi** (was 3640); n = 7.274 (was 7.967). Stem f_ss 13.87 → 13.83 ksi, s_max 41.99 → 42.11 in; backwall crack D/C 0.105 → 0.105 (dashboard shows 0.11 → 0.10 by rounding).

### F19. Minimum support length: H selector (ABT-O3)   [calc option, default unchanged] [default = conservative]
- **Where:** I-1 Geometry, new select `geom.HsupMode` (+ `geom.HsupUser` when "Entered value"); C-9 anchor `const HsupMode=`; panel 3.5 variable table; report input echo.
- **Before:** `const Hsup=g.hstem+g.hbw;` **After:** "Stem + backwall height (conservative)" (default, = before), "Single-span bridge: H = 0", or "Entered value" (average column height to the next expansion joint).
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 4.7.4.4, Eq. 4.7.4.4-1 (H for abutments = average height of columns to the next expansion joint; 0 for single spans).
- **Check case (benchmark, L = 80 ft, S = 0):** default N = 8 + 1.6 + 0.08·19 = **11.12 in** (unchanged); H = 0: N = **9.60 in** (LESS conservative, only when chosen).
- **Saved data:** both fields are optional and written only when the user changes the select; `defaultState()`/`migrate()` are unchanged, so old files, the autosave and the Input ID are unchanged (verified).

### F20. Foundation-load hand-off: cases without the heel LS (ABT-F13)   [hand-off content] [MORE conservative for the receiving tool]
- **Where:** `cases()` in the foundationLoads block (anchor `const addC=(c,noLSv)=>`); case name suffix `(no heel LS)`; combination text; payload note.
- **After:** each live-load permutation is also evaluated with LSv = 0 (`comboEffects(...,true)`), appended after the normal ones so a tie keeps the LSv case. The usual picks (V max/min, My max/min, H max, pile P max/min) are taken over both sets. Schema `bridge-foundation-loads` v1 unchanged (more/different cases only).
- **Provision:** AASHTO LRFD 10th Ed. Art. 3.11.6.4 and the Section 11 stability figures (vertical LS over the heel left out where it helps stability; **verify** the figure numbers, C11.5.6).
- **Check case (benchmark):** Strength I My max: before P = 2977.875, My = 5925.145; after "Strength I — My max (no heel LS)" P = **2885.475**, My = **6294.745** kip-ft (ΔP = 1.75·52.8 = 92.4 kip; ΔMy = 92.4·(10.5 − 6.5) = 369.6). Service I My max likewise (P 2259.3, My 3685.366).

### F21. V&M diagrams: toe and heel on the governing consistent permutation (ABT-O9)   [display only]
- **Where:** new helpers `toeMomentOf`, `heelNetOf`, `govToeC`, `govHeelC` (before `function govV`); toe and heel blocks of `buildVM`; Tab 6 note text.
- **Before:** toe used the max-V permutation; heel used the min-V permutation's reaction with γEV/γDC/γLS max downward loads (not one combination).
- **After:** per selected limit state, the permutation giving the largest toe moment (toe) or largest net heel moment (heel; bottom tension if none is positive), with that permutation's own `heelLoads` factors — the same rule as the toe/heel design.
- **Check (benchmark, Strength I):** toe diagram peak 45.46 → **53.43** kip-ft/ft (= design M_u); heel peak 26.61 → 27.00 (design 28.45 governs from Constr–Str I). Superposition check unaffected (stem/backwall only).

### F22. Import JSON format check (ABT-C5)   [bug fix] [no result change]
- **Where:** `#importFile` change handler, anchor `// project files carry no format tag`.
- **After:** rejects non-objects; recognises `subloads-abutment-v1` / `bridge-abutment-loads` files and points to "Import hand-off (JSON)"; rejects any other `_schema`/`schema` file; if any of geom, mat, soil, fnd, factors, beams, rx, reinf is missing, asks before loading. Project files are unchanged (no tag added). Verified: main export imports silently and gives the same state; partial file → confirm (Cancel leaves the state unchanged).

### F23. Phone width: no page-wide horizontal scroll (ABT-UI1)   [UI only]
- **Where:** CSS after `@media (max-width:1100px){.main{grid-template-columns:1fr;}}`.
- **After:** `@media screen and (max-width:600px)`: the project block wraps to two columns at full width; wide tables scroll inside their panel (`.p-body{overflow-x:auto}`). At 400 px: scrollWidth 532 → 400. No change above 600 px or in print.

### Closed (not an issue / no change)
- **ABT-O8 (wind):** WL is not scaled — correct: WL (3.8.1.3) is a fixed 0.10 klf-based load independent of the design wind speed. The remaining part (vertical wind 3.8.2 applies only to Strength III/Service IV) cannot be separated: the WS P input holds both the overturning couple and the uplift (SubLoads sends both in one P). Moved to "Remaining open items".
- **ABT-O10 (general shear N_u = 0, s_x = d_v, at the base):** conservative as is; left (inventory default "leave").
- **ABT-O11 (legacy `subloads-abutment-v1` importer):** resolved by F12 — "Import hand-off (JSON)" already reads a raw "Export abutments" file (`normalize()` in the abutmentLoads block); F22 now redirects such a file from Import JSON. The `positions`/`position` naming in SubLoads' `calculatorInput` is not used by the importer (it builds offsets from `girders[].y`).

### Needs engineer
- **N1 (ABT-O1):** Seismic connection force 0.10(DC + DW) (MassDOT) vs AASHTO 3.10.9.2 (0.15 / 0.25 by acceleration coefficient; SubLoads uses 0.15/0.25). Keep MassDOT 0.10? Recommendation: switch to the 3.10.9.2 values unless MassDOT Bridge Manual confirms 0.10 for this use.
- **N2 (ABT-O5):** EE-I γEH default 1.00 vs γp (1.50/0.90) in Table 3.4.1-1. Recommendation: keep 1.00 for the combined M–O case only if the agency allows; otherwise default to γp.
- **N3 (ABT-F12):** IM is applied to the footing (LL+IM reactions are one input); 3.6.2.1 lets IM be omitted for foundation components entirely below ground. Removing it needs the truck/lane split. Recommendation: keep (conservative) unless you want an "IM fraction" input.
- **N4 (new finding):** pile-branch **toe** design uses only the permutation with the largest single pile reaction (`R.checks.pileComp.det`), not every strength permutation as the heel does since F5. In the pile benchmark the two coincide (45.52 kip-ft/ft both). Recommendation: loop all strength permutations for the pile toe as for the heel (possibly unconservative otherwise). Not changed (not an inventory item).

### Remaining open items
- ABT-O8 remainder: a separate "vertical wind (3.8.2)" P row so Strength V / Service I can drop it (M size). Effect is small and mixed.
- F15 limits: Service I settlement pressure and the per-ft toe/heel strip design still ignore e_L; no transverse eccentricity limit is checked (11.6.3.3 is written for the wall direction).

### How verified
- `vm.Script` syntax check of all 13 inline scripts: 0 errors.
- Headless Chromium (KaTeX 0.16.11, Plotly 2.35.2, three 0.128.0 served locally), main vs branch, 14 scenarios (default, pile, pile coord, seismic, BR/TU/CR·SH calculated, Coulomb+rock+passive+manual share+position+N=5, rock, group offset 2 ft soil/rock, bearing setback 0.25, β = 15°, heel-side resultant, V_III = 115 mph, bad inputs) plus Export→Import, Save→Reset→Load and SubLoads pull+apply: `S`, autosave, Input ID, saved-projects store, exported JSON, EDM payload and self-test identical in every case; every dashboard/tab/hand-off difference is from F15–F23 (reviewed in `abswp/cmp_report.txt`). A main export imports into the branch with an identical state. No console or page errors on either version.
- Screenshots (scratchpad `followups/abtsweep/`): bearing panel soil and rock with offset, stem with e_brg < 0, toe crack control, V&M toe/heel, foundation-load dialog, H input, seat panel, 400 px page.
- **Other copies:** `biaxRockQ` is a new, independent implementation (Spread Footing has its own `solveBearing`); nothing else shared was touched.

### Appendix — unified diff (exact before/after)
```diff
diff --git a/abutment_calculator.html b/abutment_calculator.html
index fcc5211..6c9b39f 100644
--- a/abutment_calculator.html
+++ b/abutment_calculator.html
@@ -93,2 +93,8 @@ header.app-head{
 @media (max-width:1100px){.main{grid-template-columns:1fr;}}
+/* phone width: the project block wraps to two columns and wide tables scroll inside their panel (no page-wide horizontal scroll) */
+@media screen and (max-width:600px){
+  .proj-block{grid-template-columns:repeat(2,minmax(0,1fr));margin-left:0;width:100%;box-sizing:border-box;}
+  .proj-block input{min-width:0;width:100%;box-sizing:border-box;}
+  .p-body{overflow-x:auto;}
+}
 .col-in,.col-out{min-width:0;}
@@ -939,2 +945,3 @@ const RX_CELLS = {DC:["P"],DW:["P"],LL:["P"],BR:["Vx"],TU:["Vx"],CRSH:["Vx"],WS:
 function buildInputs(){
+  if(S.geom.HsupMode==="user"&&(S.geom.HsupUser==null||!isFinite(+S.geom.HsupUser))) S.geom.HsupUser=+(S.geom.hstem+S.geom.hbw).toFixed(2);   // optional field, set only when "Entered value" is picked
   const g=S.geom, derivedSeat=g.tst-g.tbw;
@@ -970,2 +977,4 @@ function buildInputs(){
     ${inpRow("Skew angle S","geom.skew","deg")}
+    ${selRow("Pier height H in N [4.7.4.4]","geom.HsupMode",[["wall","Stem + backwall height (conservative)"],["single","Single-span bridge: H = 0"],["user","Entered value"]],{rebuild:true})}
+    ${(S.geom.HsupMode==="user")?inpRow("&nbsp;&nbsp;H (average pier height to the next expansion joint)","geom.HsupUser","ft",{title:"AASHTO 4.7.4.4: for abutments, the average height of the columns supporting the bridge deck from the abutment to the next expansion joint; 0 for single-span bridges."}):""}
   `);
@@ -1357,2 +1366,38 @@ function linSegs(V,e,B,Lf){ if(!(V>0)) return null; const ea=Math.abs(e);
   return e>=0? [{x0:0,x1:Lc,q0:qm,q1:0}] : [{x0:B-Lc,x1:B,q0:0,q1:qm}]; }
+/* rock bearing with eccentricity in both directions (e along B, e_L along L, both ≥ 0): planar contact pressure,
+   no tension, on the B × L footing [10.6.5, 11.6.3.2]. Inside the kern (6e/B + 6e_L/L ≤ 1):
+   q_max = V/(B·L)·(1 + 6e/B + 6e_L/L). Otherwise the plane q = a + b·x + c·y (origin at the footing centre,
+   x toward the resultant along B, y along L) is solved by Newton iteration so that ∫q dA = V, ∫q·x dA = V·e and
+   ∫q·y dA = V·e_L over the compressed area (400 strips along L, exact integration across B); q_max is the peak corner. */
+function biaxRockQ(V,e,eL,B,L){
+  const A=B*L, kern=6*e/B+6*eL/L;
+  if(kern<=1+1e-12) return {full:true, ok:true, kern, qmax:V/A*(1+kern), qmin:V/A*(1-kern)};
+  const N=400, dy=L/N;
+  function res(p){ let F=0,My=0,Mx=0;
+    for(let j=0;j<N;j++){ const y=-L/2+(j+0.5)*dy, a=p[0]+p[2]*y, b=p[1]; let x1=-B/2, x2=B/2;
+      if(Math.abs(b)<1e-14){ if(a<=0) continue; }
+      else{ const x0=-a/b; if(b>0) x1=Math.max(x1,x0); else x2=Math.min(x2,x0); if(x2<=x1) continue; }
+      const f0=a*(x2-x1)+b*(x2*x2-x1*x1)/2, f1=a*(x2*x2-x1*x1)/2+b*(x2*x2*x2-x1*x1*x1)/3;
+      F+=f0*dy; My+=f1*dy; Mx+=f0*y*dy; }
+    return [F-V, My-V*e, Mx-V*eL]; }
+  const sc=[V, V*B, V*L];
+  let p=[V/A, 12*V*e/(L*B*B*B), 12*V*eL/(B*L*L*L)], r=res(p), ok=false, it;
+  for(it=0;it<80;it++){
+    if(Math.max(Math.abs(r[0]/sc[0]),Math.abs(r[1]/sc[1]),Math.abs(r[2]/sc[2]))<1e-9){ ok=true; break; }
+    const h=[Math.max(Math.abs(p[0]),V/A)*1e-6, Math.max(Math.abs(p[1]),V/A/B)*1e-6, Math.max(Math.abs(p[2]),V/A/L)*1e-6], J=[[],[],[]];
+    for(let k=0;k<3;k++){ const pp=p.slice(); pp[k]+=h[k]; const rp=res(pp); for(let i=0;i<3;i++) J[i][k]=(rp[i]-r[i])/h[k]; }
+    // solve J·d = −r (Gaussian elimination, partial pivoting)
+    const M=J.map((row,i)=>row.concat([-r[i]])); let sing=false;
+    for(let i=0;i<3;i++){ let piv=i; for(let k=i+1;k<3;k++) if(Math.abs(M[k][i])>Math.abs(M[piv][i])) piv=k;
+      if(Math.abs(M[piv][i])<1e-300){ sing=true; break; } [M[i],M[piv]]=[M[piv],M[i]];
+      for(let k=0;k<3;k++){ if(k===i) continue; const f=M[k][i]/M[i][i]; for(let c=i;c<4;c++) M[k][c]-=f*M[i][c]; } }
+    if(sing) break;
+    const d=[M[0][3]/M[0][0], M[1][3]/M[1][1], M[2][3]/M[2][2]];
+    let lam=1; const r0=Math.hypot(r[0]/sc[0],r[1]/sc[1],r[2]/sc[2]);
+    for(let k=0;k<30;k++){ const pn=p.map((v,i)=>v+lam*d[i]), rn=res(pn);
+      if(Math.hypot(rn[0]/sc[0],rn[1]/sc[1],rn[2]/sc[2])<r0||k===29){ p=pn; r=rn; break; } lam/=2; }
+  }
+  const qmax=Math.max(0,p[0]+p[1]*B/2+p[2]*L/2);
+  return {full:false, ok, kern, qmax, qmin:0, plane:p, it};
+}
 
@@ -1718,3 +1763,3 @@ function computeAll(){
     // ---- Bearing [10.6.3.1] ----
-    let brg={dc:-1}, brgOut=false;
+    let brg={dc:-1}, brgOut=false, brgBxBad=false;
     for(const lsName of STR_LIMITS){
@@ -1724,6 +1769,11 @@ function computeAll(){
         const xbar=(c.Mv-c.Mh)/c.V, eS=B/2-xbar, e=Math.abs(eS);   // |e| [10.6.1.3]; pressure peak on the side of the resultant
-        let q,Bp=NaN,qmax=NaN,mode;
+        const eL=Math.abs(c.Mt)/c.V;   // transverse eccentricity along L_ftg (footing centred on the abutment CL) [10.6.1.3]
+        let q,Bp=NaN,Lp=Lftg,qmax=NaN,mode,bx=null;
         if(fn.matl==="soil"){
-          Bp=B-2*e; if(Bp<=0){ brgOut=true; continue; }
-          q=c.V/(Bp*Lftg); mode="uniform";
+          Bp=B-2*e; Lp=Lftg-2*eL; if(Bp<=0||Lp<=0){ brgOut=true; continue; }
+          q=c.V/(Bp*Lp); mode="uniform";
+        }else if(eL>1e-9){                // rock, biaxial: linear (planar) no-tension pressure, peak corner [10.6.5, 11.6.3.2]
+          if(e>=B/2||eL>=Lftg/2){ brgOut=true; continue; }
+          bx=biaxRockQ(c.V,e,eL,B,Lftg); q=bx.qmax; mode=bx.full?"biaxFull":"biaxPart";
+          if(!bx.ok) brgBxBad=true;
         }else{
@@ -1734,3 +1784,3 @@ function computeAll(){
         const phiBls=resFor(lsName).phiB;
-        if(q/(phiBls*fn.qn)>brg.dc){ brg={dc:q/(phiBls*fn.qn), q, e, eSigned:eS, side:eS>=0?"toe":"heel", Bp, V:c.V, mode, phiB:phiBls, lbl:c.lbl, ls:lsName, c}; }
+        if(q/(phiBls*fn.qn)>brg.dc){ brg={dc:q/(phiBls*fn.qn), q, e, eSigned:eS, side:eS>=0?"toe":"heel", Bp, Lp, eL, bx, V:c.V, mode, phiB:phiBls, lbl:c.lbl, ls:lsName, c}; }
       }
@@ -1738,3 +1788,4 @@ function computeAll(){
     R.checks.bearing=brg;
-    if(brgOut) warn("One or more strength permutations put the factored resultant outside the footing (B′ ≤ 0); they are excluded from the bearing check — see the eccentricity check.");
+    if(brgOut) warn("One or more strength permutations put the factored resultant outside the footing (B′ ≤ 0 or L′ ≤ 0); they are excluded from the bearing check — see the eccentricity check.");
+    if(brgBxBad) warn("Rock bearing with transverse eccentricity: the biaxial no-tension pressure solution did not converge for at least one permutation — check the bearing pressure by hand.","err");
 
@@ -1828,6 +1879,10 @@ function computeAll(){
   /* ===== C-9 Minimum support length & seismic connection note ===== */
-  const Hsup=g.hstem+g.hbw;
+  // H [4.7.4.4]: average column height to the next expansion joint (0 for single spans); default = stem + backwall height (conservative)
+  const HsupMode=g.HsupMode==="single"||g.HsupMode==="user"?g.HsupMode:"wall";
+  const Hsup=HsupMode==="single"?0 : HsupMode==="user"?Math.max(0,+g.HsupUser||0) : g.hstem+g.hbw;
+  if(HsupMode==="user"&&!(+g.HsupUser>=0)) warn("Input error — the entered pier height H for the minimum support length must be a number ≥ 0 [4.7.4.4]; 0 is used.","err");
+  else if(HsupMode==="user"&&+g.HsupUser>60) warn("Check input — pier height H for the minimum support length above 60 ft [4.7.4.4].");
   const Nreq=(8+0.02*g.spanL+0.08*Hsup)*(1+0.000125*g.skew*g.skew); // in [4.7.4.4]
   const Nprov=seatW*12-0;   // seat width in inches
-  R.checks.seat={dc:Nreq/Nprov, Nreq, Nprov, Hsup};
+  R.checks.seat={dc:Nreq/Nprov, Nreq, Nprov, Hsup, HsupMode};
   const Fconn=0.10*(agg.DC.P+agg.DW.P);
@@ -1838,6 +1893,7 @@ function computeAll(){
   R.kah=kah;
-  const Ec=1820*Math.sqrt(m.fc);        // ksi (AASHTO C5.4.2.4 approx.)
+  const wcE=Math.min(0.155,Math.max(0.090,m.gc-0.005));   // plain-concrete unit weight (kcf): γ_c less the 0.005 kcf reinforcement allowance [T.3.5.1-1]
+  const Ec=120000*1.0*wcE*wcE*Math.pow(m.fc,0.33);   // ksi, K1 = 1.0 [Eq. 5.4.2.4-1] (crack-control modular ratio only)
   const nMod=Math.max(6,29000/Ec);
   const fr=0.24*Math.sqrt(m.fc);        // ksi [5.4.2.6]
-  R.matDer={Ec,nMod,fr};
+  R.matDer={Ec,nMod,fr,wcE};
   const gLL_str=Math.max(+F.llS1,+F.llS5), gEH_max=GP.EH[1];
@@ -1898,3 +1954,3 @@ function computeAll(){
       dv, Vc, phiVn, dcFlex:o.Mu/phiMn, dcShear:o.Vu/phiVn, betaMode, betaV, epsS, sxe,
-      rho,k,j,fss,dcBar:dc,betaS,sMax, crackOK:o.sp<=sMax, ld, AsST, bST, hST:hIn, gE, skinNote, skinAsk};
+      rho,k,j,fss,dcBar:dc,betaS,sMax, crackOK:o.sp<=sMax, Ec, wcE, nMod, ld, AsST, bST, hST:hIn, gE, skinNote, skinAsk};
   }
@@ -1926,2 +1982,15 @@ function computeAll(){
   const Mst_ES=kah*esQ*Hs*Hs/2, Vst_ES=kah*esQ*Hs;
+  // vertical-reaction eccentricity moment per ft at the stem base for limit state L: γDC and γDW max/min [T.3.4.1-2]
+  // and the LL reaction on/off are permuted and the largest (back-face tension) M_ecc is kept. When e_brg < 0 (bearing
+  // behind the stem centroid) the minimum factors / no LL reaction govern. LS and BR stay on (conservative).
+  function stemEcc(L,ns){
+    const dcs=L.perm?[L.dcMax||GP.DC[1],GP.DC[0]]:[1], dws=L.perm?[GP.DW[1],GP.DW[0]]:[1], lls=L.LL?[true,false]:[false];
+    let r=null;
+    for(const gDC of dcs) for(const gDW of dws) for(const llOn of lls){
+      const Pv = ns*( gDC*groups.DCsup.V + gDW*groups.DW.V + (llOn?L.LL*groups.LL.V:0)
+               + L.WS*groups.WS.V + L.WL*groups.WL.V );
+      const Mecc = ( Pv*(xSc-R.geo.xBrg) + gDC*MselfEccTot )/Lab;
+      if(!r||Mecc>r.Mecc+1e-12) r={Mecc,Pv,gDC,gDW,llOn}; }
+    return r; }
+  R.stemEcc=stemEcc;
   let stemGov=null;
@@ -1940,5 +2009,3 @@ function computeAll(){
     const gDCmx = L.dcMax||GP.DC[1];   // Strength IV: γDC max 1.50
-    const Pv = ns*( gDCmx*groups.DCsup.V + GP.DW[1]*groups.DW.V + (L.LL?L.LL*groups.LL.V:0)
-             + L.WS*groups.WS.V + L.WL*groups.WL.V );
-    const MeccPerFt = ( Pv*(xSc-R.geo.xBrg) + gDCmx*MselfEccTot )/Lab;
+    const se=stemEcc(L,ns), Pv=se.Pv, MeccPerFt=se.Mecc, gDCe=se.gDC, gDWe=se.gDW, llE=se.llOn;
     // seismic wall terms (per ft): ΔK increment over stem height + wall inertia (approx. arm mid-height)
@@ -1955,10 +2022,11 @@ function computeAll(){
     const Vu=gEH_ls*VEH_ls+(L.LL?L.LL*VLS_ls:0)+GP.ES[1]*VES_ls+HgirdPerFt + Veq;
-    if(!stemGov||Mu>stemGov.Mu) stemGov={Mu,Vu,HgirdPerFt,MeccPerFt,Pv,Meq,ls:lsName,
-      lbl:`${gEH_ls.toFixed(2)}·EH${esQ>0?` + ${GP.ES[1].toFixed(2)}·ES`:""}${L.LL?` + ${L.LL.toFixed(2)}·(LS,BR)`:""}${L.WS?` + ${L.WS.toFixed(2)}·WS`:""}${L.TU?` + ${L.TU.toFixed(2)}·TU/CR/SH`:""}${L.eq?" + 1.00·EQ":""} + P·e_brg (${lsName})`};
+    const eccMin=(gDCe!==gDCmx||gDWe!==GP.DW[1]||llE!==!!L.LL);   // a minimum-factor / no-LL permutation governs M_ecc
+    if(!stemGov||Mu>stemGov.Mu) stemGov={Mu,Vu,HgirdPerFt,MeccPerFt,Pv,Meq,ls:lsName,gDCe,gDWe,llE,eccMin,
+      lbl:`${gEH_ls.toFixed(2)}·EH${esQ>0?` + ${GP.ES[1].toFixed(2)}·ES`:""}${L.LL?` + ${L.LL.toFixed(2)}·(LS,BR)`:""}${L.WS?` + ${L.WS.toFixed(2)}·WS`:""}${L.TU?` + ${L.TU.toFixed(2)}·TU/CR/SH`:""}${L.eq?" + 1.00·EQ":""} + P·e_brg`+(eccMin?` [${gDCe.toFixed(2)}·DC, ${gDWe.toFixed(2)}·DW${L.LL?(llE?", LL reaction on":", no LL reaction"):""}]`:"")+` (${lsName})`};
   }
   const HgirdSvc=(groups.BR.Hx+groups.TU.Hx+groups.CRSH.Hx+wsFsv*groups.WS.Hx+groups.WL.Hx)/Lab;
-  const PvSvc=groups.DCsup.V+groups.DW.V+groups.LL.V+wsFsv*groups.WS.V+groups.WL.V;
-  const MeccSvc=(PvSvc*(xSc-R.geo.xBrg)+MselfEccTot)/Lab;
+  // Service I: LL reaction on or off, whichever gives the larger back-face moment (LS and BR stay on)
+  const seSvc=stemEcc(LIMITS["Service I"],1), PvSvc=seSvc.Pv, MeccSvc=seSvc.Mecc, svcNoLL=!seSvc.llOn;
   const MsStem=Mst_EH+Mst_LS+HgirdSvc*g.hstem+MeccSvc;
-  R.stemDem={Hs,heqS,Mst_EH,Vst_EH,Mst_LS,Vst_LS,...stemGov,MsStem,HgirdSvc,eBrg:R.geo.eBrg,MselfEccTot,MeccSvc};
+  R.stemDem={Hs,heqS,Mst_EH,Vst_EH,Mst_LS,Vst_LS,...stemGov,MsStem,HgirdSvc,eBrg:R.geo.eBrg,MselfEccTot,MeccSvc,svcNoLL};
   if(g.hw>g.tf) warn("Water table above the top of footing: wall structural demands conservatively use moist unit weight over the full height (no buoyant reduction applied to wall pressures).");
@@ -2057,10 +2125,25 @@ function computeAll(){
   R.footWt={wFoot,wSoilHeel,wLSv};
+  // Service I moments at the toe and heel faces for crack control [5.6.7]: every Service I permutation (live load on/off),
+  // linear contact pressure (spread) or pile reactions (piles) of that permutation, all load factors 1.0; footing
+  // self-weight at 1.0 on the toe. Heel: the moment on the face that the heel design checks (top or bottom tension).
+  const footSvc={toe:0,heel:0,toeLbl:"—",heelLbl:"—"};
+  for(const pl of permutations("Service I")){
+    const c=comboEffects("Service I",pl.perm,pl.liveOn,false); if(c.V<=0) continue;
+    let MtU=null,MhU=null;
+    if(fn.branch==="spread"){ const segs=linSegs(c.V,B/2-(c.Mv-c.Mh)/c.V,B,Lftg); if(segs){ MtU=pressMoment(segs,0,g.Ltoe,g.Ltoe); MhU=pressMoment(segs,xStemBack,B,xStemBack); } }
+    else if(fn.branch==="pile"){ const loads=pileLoadsFor(c); if(loads){ MtU=0; MhU=0;
+      activePiles().forEach((pp,i)=>{ const xT=B/2+pp.x; if(xT<g.Ltoe) MtU+=loads[i]/Lftg*(g.Ltoe-xT); if(xT>xStemBack) MhU+=loads[i]/Lftg*(xT-xStemBack); }); } }
+    if(MtU===null) continue;
+    const tMs=Math.max(0,MtU-wFoot*g.Ltoe*g.Ltoe/2), hNet=heelLoads(c).MheelDn-MhU, hMs=Math.max(0,heelDem.face==="bottom"?-hNet:hNet);
+    if(tMs>footSvc.toe){ footSvc.toe=tMs; footSvc.toeLbl=c.lbl; }
+    if(hMs>footSvc.heel){ footSvc.heel=hMs; footSvc.heelLbl=c.lbl; }
+  }
+  R.footSvc=footSvc;
   R.checks.toeFlex=sectionCheck({name:"Toe", h:g.tf*12, cover:m.coverF, bar:S.reinf.toe.size,
-    sp:+S.reinf.toe.sp, Mu:toeDem.Mu, Vu:toeDem.Vu, Ms:toeDem.Mu/1.4, lbl:toeDem.lbl,
+    sp:+S.reinf.toe.sp, Mu:toeDem.Mu, Vu:toeDem.Vu, Ms:footSvc.toe, lbl:toeDem.lbl,
     bST:Math.min(B,Lftg)*12, hST:g.tf*12, zeroShearDist:g.Ltoe*12});
   R.checks.heelFlex=sectionCheck({name:"Heel", h:g.tf*12, cover:m.coverF, bar:S.reinf.heel.size,
-    sp:+S.reinf.heel.sp, Mu:heelDem.Mu, Vu:heelDem.Vu, Ms:heelDem.Mu/1.4, lbl:heelDem.lbl,
+    sp:+S.reinf.heel.sp, Mu:heelDem.Mu, Vu:heelDem.Vu, Ms:footSvc.heel, lbl:heelDem.lbl,
     bST:Math.min(B,Lftg)*12, hST:g.tf*12, zeroShearDist:g.Lheel*12});
-  // Service moments for footing crack control approximated as Mu/1.4 — flag it
-  R.footingCrackNote="Footing service moments for crack control are approximated as M_u/1.4; refine by hand if crack control governs.";
+  R.footingCrackNote="Footing service moments for crack control are the Service I moments at the toe and heel faces (all permutations, live load on/off; linear contact pressure or pile reactions of the same permutation).";
 
@@ -2211,2 +2294,23 @@ function computeAll(){
   }
+  // V&M diagrams: the permutation of a limit state that governs the toe / heel moment, as in the toe/heel design (C-10)
+  function toeMomentOf(c){
+    if(fn.branch==="spread"){ const segs=bearingSegsFor(c); return segs? pressMoment(segs,0,g.Ltoe,g.Ltoe) : null; }
+    const loads=pileLoadsFor(c); if(!loads) return null;
+    let M=0; activePiles().forEach((pp,i)=>{ const xT=B/2+pp.x; if(xT<g.Ltoe) M+=loads[i]/Lftg*(g.Ltoe-xT); }); return M;
+  }
+  function heelNetOf(c){
+    const hl=heelLoads(c);
+    if(fn.branch==="spread"){ const segs=bearingSegsFor(c); return segs? hl.MheelDn-pressMoment(segs,xStemBack,B,xStemBack) : null; }
+    const loads=pileLoadsFor(c); if(!loads) return null;
+    let M=0; activePiles().forEach((pp,i)=>{ const xT=B/2+pp.x; if(xT>xStemBack) M+=loads[i]/Lftg*(xT-xStemBack); }); return hl.MheelDn-M;
+  }
+  function govToeC(lsName){ let best=null,bM=-Infinity;
+    for(const pl of permutations(lsName)){ const c=comboEffects(lsName,pl.perm,pl.liveOn,false); if(c.V<=0) continue;
+      const M=toeMomentOf(c); if(M!==null&&M>bM+1e-12){ bM=M; best=c; } }
+    return best; }
+  function govHeelC(lsName){ let top=null,tM=-Infinity,bot=null,bM=Infinity;   // top tension (largest net) if any, else largest bottom tension
+    for(const pl of permutations(lsName)){ const c=comboEffects(lsName,pl.perm,pl.liveOn,false); if(c.V<=0) continue;
+      const M=heelNetOf(c); if(M===null) continue;
+      if(M>tM+1e-12){ tM=M; top=c; } if(M<bM-1e-12){ bM=M; bot=c; } }
+    return (top&&tM>0)? top : bot; }
   function govV(lsName,wantMax){
@@ -2275,3 +2379,4 @@ function computeAll(){
       const Pv=ns*( fDCmax*groups.DCsup.V + fDW*groups.DW.V + fLL*groups.LL.V + fWS*groups.WS.V + fWL*groups.WL.V );
-      const Mecc=( Pv*(R.geo.xStemCenter-R.geo.xBrg) + fDCmax*MselfEccTot )/Lab;
+      const Mecc=(isLS&&Lst.perm)? stemEcc(Lst,ns).Mecc   // strength / EE: the permutation used by the stem design (γDC, γDW max/min, LL reaction on/off)
+                : ( Pv*(R.geo.xStemCenter-R.geo.xBrg) + fDCmax*MselfEccTot )/Lab;
       const r=integ(st,w,[{s:0,P:Vtop+Hg}]);
@@ -2290,3 +2395,3 @@ function computeAll(){
     { const st=[], w=[]; let pts=[], qFn;
-      if(isLS){ const rc=reactionAt(govV(lsName,true)); qFn=rc.q;
+      if(isLS){ const rc=reactionAt(govToeC(lsName)||govV(lsName,true)); qFn=rc.q;   // the permutation giving the largest toe moment
         if(rc.pts){ pts=rc.pts.filter(rw=>(B/2+rw.x)<g.Ltoe).map(rw=>({s:B/2+rw.x, P:rw.P/Lftg})); }
@@ -2302,4 +2407,4 @@ function computeAll(){
     // ---- Heel: downward soil/self/LS minus upward reaction ----
-    { const st=[], w=[]; let pts=[], qFn;
-      if(isLS){ const rc=reactionAt(govV(lsName,false)); qFn=rc.q;
+    { const st=[], w=[]; let pts=[], qFn, hc=null;
+      if(isLS){ hc=govHeelC(lsName)||govV(lsName,false); const rc=reactionAt(hc); qFn=rc.q;   // the heel-governing permutation; its own downward factors below
         if(rc.pts){ pts=rc.pts.filter(rw=>(B/2+rw.x)>xBackFace).map(rw=>({s:g.Lheel-((B/2+rw.x)-xBackFace), P:rw.P/Lftg})); }
@@ -2310,5 +2415,6 @@ function computeAll(){
       const wLSv_ls=cctx? gam*R.constrC.heqC : wLSv;
-      const wDn = isLS ? (fEVmax*wSoil_ls + fDCmax*wFoot + fLS*wLSv_ls + fES*esQv)
+      const hl = (isLS&&hc)? heelLoads(hc) : null;   // downward heel loads with the same permutation's factors (as in the heel design)
+      const wDn = isLS ? (hl? hl.wDn : (fEVmax*wSoil_ls + fDCmax*wFoot + fLS*wLSv_ls + fES*esQv))
                        : ((key==="EV"?wSoilHeel:0) + (key==="DC"?wFoot:0) + (key==="LS"?wLSv:0) + (key==="ES"?esQv:0));
-      const fWdg = cctx?0:(isLS?fEVmax:(key==="EV"?1:0)), hW=R.EV.hWedge;   // slope wedge: γ·h_wedge·(L_heel − x_l)/L_heel
+      const fWdg = cctx?0:(isLS?(hl?hl.gEV:fEVmax):(key==="EV"?1:0)), hW=R.EV.hWedge;   // slope wedge: γ·h_wedge·(L_heel − x_l)/L_heel
       for(let i=0;i<NST;i++){ const xl=g.Lheel*i/(NST-1); st.push(xl); const xg=B-xl; w.push(qFn(xg) - wDn - fWdg*gam*hW*(g.Lheel>0?(g.Lheel-xl)/g.Lheel:0)); }
@@ -2584,3 +2690,3 @@ function renderTabLoads(R){
     <b>8.</b> V&amp;M diagrams: limit states use the design bearing distribution; individual loads use elastic (tension-allowed) superposition — the two intentionally differ for the footing.<br>
-    <b>9.</b> Structural: 1-ft strips; strain-based φ per 5.5.4.2; footing crack-control service moments approximated as M<sub>u</sub>/1.4.<br>
+    <b>9.</b> Structural: 1-ft strips; strain-based φ per 5.5.4.2; footing crack-control service moments from Service I directly (linear contact pressure / pile reactions).<br>
     <b>10.</b> Construction stage: "Constr — Str I" checks the backfilled wall with <b>no superstructure</b> (fill height ${(+S.constr.hFill>0)?fmt(Math.min(+S.constr.hFill,S.geom.soilH),1)+" ft":"= full"}, dry, γ<sub>LL</sub> = ${fmt(+S.constr.gLL||0)}). If it fails, restrict backfill until erection or revise the design.<br>
@@ -2882,5 +2988,15 @@ function renderTabStab(R){
         ? eqB("Effective-width (Meyerhof) uniform pressure — soil","AASHTO 10.6.3.1, 10.6.1.3 (Eq. 10.6.1.3-1)",[
-            "B' = B - 2|e|\\,, \\qquad q_f = \\dfrac{\\Sigma V_f}{B'\\,L_{ftg}}",
+            "B' = B - 2|e|\\,, \\qquad L' = L_{ftg} - 2e_L\\,, \\quad e_L = \\dfrac{|\\Sigma M_t|}{\\Sigma V_f}\\,, \\qquad q_f = \\dfrac{\\Sigma V_f}{B'\\,L'}",
             `B' = ${fmtT(geo.B)} - 2(${fmtT(bc.e)}) = ${fmtT(bc.Bp)}\\ \\text{ft}`,
-            `q_f = \\dfrac{${fmtT(bc.V)}}{(${fmtT(bc.Bp)})(${fmtT(g.Lftg)})} = ${fmtT(bc.q)}\\ \\text{ksf}`])
+            `e_L = \\dfrac{${fmtT(Math.abs(bc.c.Mt))}}{${fmtT(bc.V)}} = ${fmtT(bc.eL,3)}\\ \\text{ft}\\,, \\qquad L' = ${fmtT(g.Lftg)} - 2(${fmtT(bc.eL,3)}) = ${fmtT(bc.Lp)}\\ \\text{ft}`,
+            `q_f = \\dfrac{${fmtT(bc.V)}}{(${fmtT(bc.Bp)})(${fmtT(bc.Lp)})} = ${fmtT(bc.q)}\\ \\text{ksf}`],
+            "e_L: transverse eccentricity from the transverse moment M_t (girder reactions × offsets, transverse wind × seat height) about the abutment centreline; the footing is taken as centred on the abutment centreline.")
+        : (bc.mode==="biaxFull"||bc.mode==="biaxPart")
+        ? eqB(`Linear (planar) distribution — rock, eccentric in both directions (${bc.mode==="biaxFull"?"full contact, inside the kern":"partial contact, outside the kern"})`,"AASHTO 10.6.3.1, 10.6.5, 11.6.3.2",[
+            `e = ${fmtT(bc.e)}\\ \\text{ft (along B)}\\,, \\qquad e_L = \\dfrac{|\\Sigma M_t|}{\\Sigma V_f} = \\dfrac{${fmtT(Math.abs(bc.c.Mt))}}{${fmtT(bc.V)}} = ${fmtT(bc.eL,3)}\\ \\text{ft (along } L_{ftg})`,
+            `\\dfrac{6e}{B} + \\dfrac{6e_L}{L_{ftg}} = ${fmtT(bc.bx.kern,3)}\\ ${bc.mode==="biaxFull"?"\\le":">"}\\ 1`,
+            bc.mode==="biaxFull"
+              ? `q_{max} = \\dfrac{\\Sigma V_f}{B\\,L_{ftg}}\\left(1+\\dfrac{6e}{B}+\\dfrac{6e_L}{L_{ftg}}\\right) = \\dfrac{${fmtT(bc.V)}}{(${fmtT(geo.B)})(${fmtT(g.Lftg)})}(1+${fmtT(bc.bx.kern,3)}) = ${fmtT(bc.q)}\\ \\text{ksf (corner)}`
+              : `q = a + b\\,x + c\\,y \\ge 0:\\ \\int q\\,dA = \\Sigma V_f,\\ \\int q\\,x\\,dA = \\Sigma V_f\\,e,\\ \\int q\\,y\\,dA = \\Sigma V_f\\,e_L \\;\\Rightarrow\\; q_{max} = ${fmtT(bc.q)}\\ \\text{ksf (corner)}`],
+            "e_L: transverse eccentricity from the transverse moment M_t about the abutment centreline (footing taken as centred on it). Partial contact: plane solved numerically (no tension); the 2-D free body in §3.0 shows the pressure averaged along L_ftg.")
         : eqB(`Linear distribution — rock (${bc.mode==="trap"?"trapezoidal, e ≤ B/6":"triangular, e > B/6"})`,"AASHTO 10.6.3.1, 11.6.3.2",[
@@ -2916,3 +3032,3 @@ function renderTabStab(R){
     ${varsTbl([["L","Bridge length to adjacent expansion joint / end",g.spanL,"ft"],
-      ["H","Abutment height (stem + backwall)",st.Hsup,"ft"],["S","Skew",g.skew,"deg"]])}
+      ["H",st.HsupMode==="single"?"Single-span bridge: H = 0 [4.7.4.4]":st.HsupMode==="user"?"Average pier height to the next expansion joint (entered) [4.7.4.4]":"Abutment height (stem + backwall) — conservative stand-in for H",st.Hsup,"ft"],["S","Skew",g.skew,"deg"]])}
     ${checkLine("Seat width",`\\dfrac{N_{req}}{N_{prov}} = \\dfrac{${fmtT(st.Nreq)}}{${fmtT(st.Nprov)}}`,st.dc)}
@@ -3078,3 +3194,4 @@ function sectionHTML(c, demHTML, secNo, title){
     <div class="subhead">Crack control [5.6.7]</div>
-    ${eqB("Service steel stress (cracked elastic section) & spacing limit","AASHTO 5.6.7, Eq. 5.6.7-1 / 5.6.7-2",[
+    ${eqB("Service steel stress (cracked elastic section) & spacing limit","AASHTO 5.6.7, Eq. 5.6.7-1 / 5.6.7-2; 5.4.2.4",[
+      `E_c = 120{,}000\\,K_1\\,w_c^2\\,f'_c{}^{0.33} = 120{,}000(1.0)(${fmtT(c.wcE,3)})^2(${fmtT(m.fc,1)})^{0.33} = ${fmtT(c.Ec,0)}\\ \\text{ksi}\\,, \\quad n = \\max\\!\\left(6,\\ \\dfrac{29{,}000}{E_c}\\right) = ${fmtT(c.nMod,3)}`,
       `\\rho = ${fmtT(c.rho,4)}\\,, \\; k = ${fmtT(c.k,3)}\\,, \\; j = ${fmtT(c.j,3)}\\,, \\quad f_{ss} = \\dfrac{M_s}{A_s j d} = \\dfrac{(${fmtT(c.Ms)})(12)}{(${fmtT(c.As)})(${fmtT(c.j,3)})(${fmtT(c.d)})} = ${fmtT(c.fss)}\\ \\text{ksi} \\le 0.6f_y`,
@@ -3110,3 +3227,3 @@ function renderTabStruct(R){
       `M_u = ${fmtT(R.GP.EH[1])}\\,M_{EH} + \\gamma_{LL}M_{LS} + H_{gird}\\,h_{stem} + M_{ecc} = ${fmtT(sd.Mu)}\\ \\text{kip-ft/ft}\\,, \\qquad V_u = ${fmtT(sd.Vu)}\\ \\text{kip/ft}`],
-      `H_gird = factored (BR + TU + CR/SH + WS + WL)·share ÷ L_ab. M_ecc = moment from the vertical girder reaction P_v acting at eccentricity e_brg = ${fmt(sd.eBrg,3)} ft from the stem centerline (bearing setback), plus the minor stem/backwall self-weight taper eccentricity; positive when the bearing sits toward the toe. Governing limit state: ${esc(sd.ls)}. Section at top of footing; t_sb = ${fmt(g.tsb)} ft.`),
+      `H_gird = factored (BR + TU + CR/SH + WS + WL)·share ÷ L_ab. M_ecc = moment from the vertical girder reaction P_v acting at eccentricity e_brg = ${fmt(sd.eBrg,3)} ft from the stem centerline (bearing setback), plus the minor stem/backwall self-weight taper eccentricity; positive when the bearing sits toward the toe. Governing limit state: ${esc(sd.ls)}.${sd.eccMin?` M_ecc uses γDC = ${fmt(sd.gDCe)}, γDW = ${fmt(sd.gDWe)}${sd.llE?"":", no LL reaction"} (the minimum-factor / no-LL permutation gives the larger back-face moment because e_brg < 0 or the self-weight eccentricity governs; LS and BR stay on).`:""}${sd.svcNoLL?" Service I M_s for crack control uses no LL reaction (larger).":""} Section at top of footing; t_sb = ${fmt(g.tsb)} ft.`),
     "5.2","Stem — Flexure, Shear, Crack Control (at base)");
@@ -3262,3 +3379,3 @@ function renderTabVM(R){
     <div class="note-box">Showing: <b>${esc(selLabel)}</b> ${isLS
-      ? "— factored, with each element using its governing γ<sub>p</sub> max/min permutation (stem/backwall on maximum EH; toe on maximum bearing/pile reaction; heel on minimum reaction with maximum gravity). Footing pressure uses the design (effective-width / triangular) distribution matching Tab 5."
+      ? "— factored, with each element using its governing γ<sub>p</sub> max/min permutation (stem/backwall on maximum EH; toe and heel on the permutation that gives the largest toe / heel moment, each with that permutation's own load factors, as in the toe and heel design). Footing pressure uses the design (effective-width / triangular) distribution matching Tab 5."
       : "— a single load applied unfactored (γ = 1.0), showing its <b>full effect</b> on every component, including indirect effects. A lateral load (EH, BR, wind) carries no direct load to the footing but produces a bearing-pressure redistribution (elastic superposition) that bends the footing — so EH shows toe shear and moment. Vertical loads (DC, DW, LL, EV) show their pressure effect net of any direct weight on the cantilever."}
@@ -3537,3 +3654,3 @@ function drawFBD(){
     });
-    s+=`<text x="${X(0)}" y="${Y(0)+qmax*qsc+14}" font-size="11.5" font-family="Times New Roman" fill="#1a7f37">q = ${fmt(R.checks.bearing.q)} ksf over B′</text>`;
+    s+=`<text x="${X(0)}" y="${Y(0)+qmax*qsc+14}" font-size="11.5" font-family="Times New Roman" fill="#1a7f37">q = ${fmt(R.checks.bearing.q)} ksf over B′${R.checks.bearing.eL>1e-9?(fn.matl==="soil"?" × L′":" (corner peak; diagram averaged along L)"):""}</text>`;
   } else if(fn.branch==="pile" && R.checks.pileComp && R.checks.pileComp.det){
@@ -3704,2 +3821,5 @@ function drawChartsFor(tabId,R){
     if(S.fnd.matl==="soil"){ xst=[0,bc.Bp,bc.Bp,B]; qst=[bc.q,bc.q,0,0]; }
+    else if(bc.bx){ const Lf=(+S.geom.Lftg||S.geom.Lab);   // biaxial (rock): pressure averaged along L_ftg; the corner peak is in the callout
+      if(bc.e<=B/6){ xst=[0,B]; qst=[bc.V/(B*Lf)*(1+6*bc.e/B),bc.V/(B*Lf)*(1-6*bc.e/B)]; }
+      else { const Lc=3*(B/2-bc.e); xst=[0,Lc,Lc,B]; qst=[2*bc.V/(Lc*Lf),0,0,0]; } }
     else if(bc.mode==="trap"){ xst=[0,B]; qst=[bc.q,bc.V/(B*(+S.geom.Lftg||S.geom.Lab))*(1-6*bc.e/B)]; }
@@ -3721,3 +3841,3 @@ function drawChartsFor(tabId,R){
     bAnno.push({xref:"paper",yref:"paper",x:0.98,y:0.96,xanchor:"right",align:"right",showarrow:false,
-      text:`B′ = ${fmt(bc.Bp||B)} ft · |e| = ${fmt(bc.e||0)} ft (${bc.side||"toe"} side)<br>q<sub>max</sub> = ${fmt(bc.q)} ksf · φ<sub>b</sub>q<sub>n</sub> = ${fmt(qR)} ksf`,
+      text:`B′ = ${fmt(bc.Bp||B)} ft · |e| = ${fmt(bc.e||0)} ft (${bc.side||"toe"} side)${bc.eL>1e-9?` · e<sub>L</sub> = ${fmt(bc.eL,3)} ft`+(S.fnd.matl==="soil"?` · L′ = ${fmt(bc.Lp)} ft`:" (curve averaged along L; corner peak)"):""}<br>q<sub>max</sub> = ${fmt(bc.q)} ksf · φ<sub>b</sub>q<sub>n</sub> = ${fmt(qR)} ksf`,
       font:{family:"Times New Roman",size:11,color:"#333"},bgcolor:"rgba(255,255,255,.88)",bordercolor:"#bbb",borderwidth:1,borderpad:3});
@@ -4141,3 +4261,3 @@ function sizingHints(R){
   if(bc&&bc.dc>0.95&&S.fnd.branch==="spread"&&R.checks.bearing.Bp>0){
-    const Breq=R.checks.bearing.V/((R.checks.bearing.phiB??S.fnd.phiB)*S.fnd.qn*(+g.Lftg||g.Lab))+2*R.checks.bearing.e;
+    const Breq=R.checks.bearing.V/((R.checks.bearing.phiB??S.fnd.phiB)*S.fnd.qn*(R.checks.bearing.Lp||+g.Lftg||g.Lab))+2*R.checks.bearing.e;
     out.push(`Bearing D/C ${fmt(bc.dc)} — for a target of 0.90, try B ≈ ${fmt(Breq/0.9,1)} ft (currently ${fmt(B,1)} ft), added at the toe, or a higher q_n.`);
@@ -4533,3 +4653,10 @@ document.getElementById("importFile").addEventListener("change",ev=>{
       const o=JSON.parse(rd.result);
+      if(!o||typeof o!=="object"||Array.isArray(o)) throw new Error("not a valid project file (not a JSON object)");
+      // project files carry no format tag; recognise the suite's hand-off files and check the project-file signature
+      const tag=o._schema||o.schema;
+      if(tag==="subloads-abutment-v1"||tag==="bridge-abutment-loads") throw new Error("this is a SubLoads hand-off file ("+tag+"), not a project file. Use \"Import hand-off (JSON)\" in the toolbar to read it.");
+      if(tag) throw new Error("this is a \""+tag+"\" file from another tool or hand-off, not an abutment-calculator project file.");
       if(!o.geom||!o.proj) throw new Error("not a valid project file");
+      const miss=["geom","mat","soil","fnd","factors","beams","rx","reinf"].filter(k=>!o[k]||typeof o[k]!=="object");
+      if(miss.length && !confirm("This file does not look like a complete abutment-calculator project (missing: "+miss.join(", ")+"). Missing groups take the built-in defaults. Load it anyway?")){ ev.target.value=""; return; }
       S=Object.assign(defaultState(),o);
@@ -4615,3 +4742,4 @@ function inputEchoHTML(){
     ["Water table above footing base",g.hw,"ft"],
-    ["Span length / skew",fmt(g.spanL)+" / "+fmt(g.skew,1)+"°","ft / deg"]]);
+    ["Span length / skew",fmt(g.spanL)+" / "+fmt(g.skew,1)+"°","ft / deg"]].concat(
+    g.HsupMode==="single"?[["Support-length H [4.7.4.4]","0 (single span)","ft"]]:g.HsupMode==="user"?[["Support-length H [4.7.4.4] (entered)",fmt(+g.HsupUser||0),"ft"]]:[]));
   h+="<h3>Materials</h3>"+echoRows([
@@ -5161,3 +5289,3 @@ document.addEventListener("DOMContentLoaded",init);
    writes the same payload to a file. The cases are the calculator's own limit-state permutations
-   (R.comboEffects over R.permutations, LS surcharge included as in the bearing and pile checks), at the
+   (R.comboEffects over R.permutations, LS surcharge included as in the bearing and pile checks, and each live-load permutation also without the heel LS), at the
    bottom of the footing: about the footing centre (spread footing) or about the pile-group centroid (pile
@@ -5180,7 +5308,9 @@ document.addEventListener("DOMContentLoaded",init);
       const all=[];
-      for(const pl of R.permutations(ls)){
-        const c=R.comboEffects(ls,pl.perm,pl.liveOn,false);
-        const My=c.V*xc-c.Mv+c.Mh, Mx=c.Mt-c.V*yc;   // about the reference point; + toward the toe / + toward +y
-        all.push({c, v:{P:r3(c.V), Vx:r3(c.Hx), Vy:r3(c.Hy), Mx:r3(Mx), My:r3(My)}, H:Math.hypot(c.Hx,c.Hy)});
-      }
+      const addC=(c,noLSv)=>{ const My=c.V*xc-c.Mv+c.Mh, Mx=c.Mt-c.V*yc;   // about the reference point; + toward the toe / + toward +y
+        all.push({c, noLSv, v:{P:r3(c.V), Vx:r3(c.Hx), Vy:r3(c.Hy), Mx:r3(Mx), My:r3(My)}, H:Math.hypot(c.Hx,c.Hy)}); };
+      for(const pl of R.permutations(ls)) addC(R.comboEffects(ls,pl.perm,pl.liveOn,false),false);
+      // the same live-load permutations without the vertical LS over the heel (it can help stability: less V, smaller My
+      // toward the heel); appended after the cases above, so on a tie the case with LSv is kept
+      for(const pl of R.permutations(ls)){ if(!pl.liveOn) continue;
+        const c=R.comboEffects(ls,pl.perm,pl.liveOn,true); if(Math.abs(c.V-R.comboEffects(ls,pl.perm,pl.liveOn,false).V)>1e-9) addC(c,true); }
       if(!all.length) return;
@@ -5194,4 +5324,4 @@ document.addEventListener("DOMContentLoaded",init);
       mine.forEach(m=>{ const g=m.tags.join(", "), c=m.a.c;
-        out.push(Object.assign({ id:ls+":"+g, name:lsOut(ls)+" — "+g, limitState:lsOut(ls), factored:factored(ls) }, m.a.v,
-          { governs:g, combination:c.lbl+(c.liveOn?"":" (no live load)") })); });
+        out.push(Object.assign({ id:ls+":"+g, name:lsOut(ls)+" — "+g+(m.a.noLSv?" (no heel LS)":""), limitState:lsOut(ls), factored:factored(ls) }, m.a.v,
+          { governs:g, combination:c.lbl+(c.liveOn?"":" (no live load)")+(m.a.noLSv?" (no vertical LS surcharge over the heel)":"") })); });
     });
@@ -5222,3 +5352,3 @@ document.addEventListener("DOMContentLoaded",init);
         "Every case includes the abutment and footing self-weight, the soil over the heel (EV), the earth pressure (EH, ES, LS) and the superstructure loads, at the bottom of the footing.",
-        "The vertical live-load surcharge over the heel (LSv) is included in every case, as in the calculator's bearing and pile checks; its sliding and eccentricity checks leave it out where it helps.",
+        "The vertical live-load surcharge over the heel (LSv) is included as in the calculator's bearing and pile checks. Each live-load permutation is also offered without it (its sliding and eccentricity checks leave it out where it helps); a case picked from those is marked \"(no heel LS)\".",
         pile? "Moments are about the pile-group centroid. My is + toward the toe here (the calculator's pile table uses ex + toward the heel)." : "Moments are about the footing centre (B/2 from the toe, on the abutment centreline).",
```

## 2026-10-12 — PR: claude/abutment-followup (PR link added after merge)

Follow-up to the sweep (#145): N4, N2, and the Service I part of the F15 limits. Basis: AASHTO LRFD 10th Ed. (2024). The exact edits are in the appendix as a unified diff of `abutment_calculator.html` against origin/main `1cc655a`. Numbers come from the real `computeAll()` of the old and new files in headless Chromium. "Benchmark" = `benchState()`.

### F24. Pile branch: toe designed for every strength / EE permutation (N4)   [calc change] [MORE conservative]
- **Where:** `computeAll`, pile branch, anchor `// TOE — every strength / EE permutation (as the heel)`; helper `toePile(loads)`; `toeDem` gains `ls`, `lsV`; display note of Tab 5 §5.3 (pile).
- **Problem:** the toe used only the permutation with the largest single pile reaction (`R.checks.pileComp.det`). Another permutation (e.g. γEV min with γEH max) can load the toe-side pile row more. Since F5 the heel already checks every permutation.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 3.4.1, Table 3.4.1-2 (γp max or min, whichever is critical for the force effect).
- **Before:** `rows` from `det.loads` only; `toeDem={Mu:Math.max(0,MtoeUp-MtoeDn), …}`.
- **After:** the max-compression case first, then every permutation of `STR_LIMITS` (strength, construction and, when on, EE-I) through `pileLoadsFor(c)`. M_u is the largest toe moment (with its rows, M_up and label) and V_u is the largest face shear. A tie keeps the old case.
- **Check case (benchmark, piles, L_toe = 8 ft, row spacing 5.5 / 5.5 ft → B = 17.5 ft, rows at 3.25 / 8.75 / 14.25 ft from the toe; only the 3.25 ft row is in front of the face):**
  - Before (max-pile case 1.25DC + 1.50DW + 1.35EV + 0.90EH + 1.75(LL,BR,LS)…): toe row ΣP = 826.83 kip, M_up = 826.83/44·(8 − 3.25) = 89.26; M_dn = 0.9·0.45·8²/2 = 12.96; **M_u = 76.30 kip-ft/ft** (flexure D/C 0.507).
  - After (1.25DC + 1.50DW + 1.00EV + 1.50EH + 1.75(LL,BR,LS)…): ΣP = 1025.10 kip, M_up = 110.66; **M_u = 97.70 kip-ft/ft** (+28%; D/C 0.650). V_u 15.55 → 20.06 kip/ft.
- **Pile benchmark (default layout):** unchanged (45.52 kip-ft/ft). With EE-I on and A_s = 0.40 the toe is governed by EE-I (45.52 → 51.89, this includes F25).

### F25. Extreme Event I γEH: γp max/min default, fixed value as "agency policy" (N2)   [calc change] [MORE conservative for new projects]
- **Where:** `defaultState()` new field `seismic.gEHEQmode:"gp"`; `migrate()` anchor `// EE-I γEH mode`; global `function eqEHfixed()`; uses in `comboEffects` (γ and label), the stem loop `gEH_ls`, `R.vmGamma`, the load-factor table (Tab 2 §2.1), the report input echo; I-11 input: select "γEH at Extreme Event I" (γp max/min | Fixed value (agency policy)), with the γEH number shown only for the agency option.
- **Problem:** EE-I used a fixed γEH = 1.00 by default. Table 3.4.1-1 gives γp for EH in Extreme Event I, i.e. the Table 3.4.1-2 values (active: 1.50 max / 0.90 min).
- **Governing provision:** AASHTO LRFD 10th Ed. Table 3.4.1-1 (Extreme Event I row, γp) and Table 3.4.1-2 (EH active 1.50/0.90).
- **Before:** `gamma = L.eq ? +S.seismic.gEHEQ : …` (1.00). **After:** `gamma = (L.eq && eqEHfixed()!==null) ? eqEHfixed() : (L.perm ? GP.EH[perm.EH] : 1.0)`; EE-I already permutes EH max/min, so both 1.50 and 0.90 are tried. The stem (wall design) takes γEH max.
- **Saved data (which rule applies):** every project saved by an earlier version stores `seismic.gEHEQ` (it has been in `defaultState()` since the seismic block was added), so on load `migrate()` sets `gEHEQmode = "agency"` and the project **keeps its saved value** (normally 1.00) — results unchanged, verified: a main export imported into the branch gives identical D/Cs for all 22 dashboard checks. Only a project with no `gEHEQ` (no seismic block at all) gets the new default `"gp"`. New projects and Reset Defaults use `"gp"`. The new field changes the Input ID (fingerprint) of every project once.
- **Check case (benchmark with EE-I on, new default), governing EE-I permutation 0.90DC + 0.65DW + 1.00EV + γEH·EH + 1.00EQ:** V = 1657.83 kip, ΣM_V = 11902.79 kip-ft; EH_h = 392.60 kip, M_EH = 2879.09 kip-ft; EQ terms ΣH = 192.20 kip, ΣM = 2374.36 kip-ft.
  - Sliding: H = γEH·392.60 + 192.20; R_n = 1657.83·tan 29° = 918.95 kip (φτ,EE = 1.0). Before γEH 1.00: H = 584.81, D/C **0.636**. After γEH 1.50: H = 781.11, D/C **0.850**.
  - Eccentricity: ΣM_H = γEH·2879.09 + 2374.36. Before 5253.44 → x̄ = 4.011, e = 2.489 ft, D/C = 2.489/4.333 = **0.574**. After 6692.99 → x̄ = 3.143, e = 3.357 ft, D/C **0.775** (EE-I governs eccentricity in both).
  - EE-I bearing q (not governing): 5.56 → 6.56 ksf. Stem, bearing and sliding dashboard governors (Strength I / Constr–Str I) unchanged.
  - Agency option with 1.00 reproduces the old numbers exactly.

### F26. Service I bearing pressure with the transverse eccentricity e_L (F15 limit)   [calc change, informational] [MORE conservative]
- **Where:** Service I loop, anchor `// transverse eccentricity e_L (as the strength bearing check, F15)`; `sv` gains `qP`, `qminP`, `eL`, `bx`; panel 3.4 shows e_L and the kern test; the plot draws the along-B curve (`sv.qP`), the corner value is reported; the triangular-pressure warning also fires for biaxial partial contact; the non-convergence warning now covers both loops.
- **After:** when e_L = |M_t|/V > 0, the planar no-tension pressure of F15 (`biaxRockQ`) gives the corner q_max (and q_min when in full contact). Service pressure is linear on soil and rock alike, so the same planar model is used for both.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 10.6.1.3, 10.6.2 (service), 10.6.5.
- **Check case (benchmark, Service I with LL):** V = 2312.10 kip, e = 1.503 ft, M_t = 2.5·6·17 + 1.0·6·17 = 357 kip-ft → e_L = 0.1544 ft. V/(BL) = 4.042 ksf; 6e/B = 0.6935, 6e_L/L = 0.0211, sum 0.7146 ≤ 1. Before q_max = 4.042(1.6935) = **6.845 ksf**, q_min 1.239. After q_max = 4.042(1.7146) = **6.930 ksf** (corner), q_min 1.154. With the girders offset 2 ft: 6.845 → 7.424 ksf.
- This value is a flag for the geotechnical engineer (no D/C).

### Remaining open items (updated)
- ABT-O8 remainder (vertical wind row); the per-ft toe/heel strip design still ignores e_L.
- N1 (seismic connection force 0.10 vs 0.15/0.25) and N3 (IM on the footing) still need the engineer.

### How verified
- `vm.Script` syntax check of all 13 inline scripts: 0 errors.
- Headless Chromium, main (1cc655a) vs branch, the same 14 scenarios plus Export→Import, Save→Reset→Load and SubLoads pull+apply. Differences: the new `seismic.gEHEQmode` field (state, autosave, Input ID); EE-I results in the seismic scenarios (F25); the Service I panel/plot (F26); the pile toe note (F24). Every other dashboard value, tab text and the foundation hand-off are identical; no console or page errors.
- Old-project rule: a project with `gEHEQ` stored and no mode → "agency" (main export imported: identical D/Cs); without `gEHEQ` or without a seismic block → "gp".
- Screenshots (scratchpad `followups/abtfollow/`): I-11 with both options, Service I panel.
- **Other copies:** none.

### Appendix — unified diff (exact before/after)
```diff
diff --git a/abutment_calculator.html b/abutment_calculator.html
index 6c9b39f..ebe0502 100644
--- a/abutment_calculator.html
+++ b/abutment_calculator.html
@@ -596,3 +596,4 @@ function defaultState(){
     seismic:{ on:false, As:0.15, khR:0.5, kv:0.0, hEQr:0.6,       // EE-I: site accel coeff, kh = khR·As (walls free to displace), ΔPAE at hEQr·H
-      gEHEQ:1.00, gEQll:0.0,                                      // γEH at EE-I; γEQ on live load (project-specific)
+      gEHEQ:1.00, gEQll:0.0,                                      // γEH at EE-I (used only with gEHEQmode "agency"); γEQ on live load (project-specific)
+      gEHEQmode:"gp",                                             // EE-I γEH: "gp" = γp max/min [T.3.4.1-1/-2]; "agency" = fixed gEHEQ
       phiTauEQ:1.00, phiBEQ:1.00, phiCEQ:1.00, eFracEQ:0.3333 },  // extreme-event resistance factors & e/B limit (soil ⅓, rock 0.45)
@@ -642,2 +643,4 @@ let WARNINGS = [];   // {level:'warn'|'err', msg}
 function warn(msg,level="warn"){ WARNINGS.push({level,msg}); }
+// Extreme Event I γEH: null = γp max/min permuted [T.3.4.1-1, T.3.4.1-2] (default); a number = the "agency policy" fixed value seismic.gEHEQ
+function eqEHfixed(){ const s=S.seismic||{}; return s.gEHEQmode==="agency"? +s.gEHEQ : null; }
 </script>
@@ -920,3 +923,5 @@ function migrate(){
   if(S.piles.dd===undefined){ S.piles.dd=0; S.piles.gDD=1.40; }
-  if(!S.seismic) S.seismic={on:false,As:0.15,khR:0.5,kv:0.0,hEQr:0.6,gEHEQ:1.00,gEQll:0.0,phiTauEQ:1.00,phiBEQ:1.00,phiCEQ:1.00,eFracEQ:0.3333};
+  // EE-I γEH mode: a project that stores gEHEQ keeps that fixed value ("agency"); one without it gets the γp default
+  if(S.seismic && S.seismic.gEHEQmode===undefined) S.seismic.gEHEQmode=(S.seismic.gEHEQ!==undefined)?"agency":"gp";
+  if(!S.seismic) S.seismic={on:false,As:0.15,khR:0.5,kv:0.0,hEQr:0.6,gEHEQ:1.00,gEHEQmode:"gp",gEQll:0.0,phiTauEQ:1.00,phiBEQ:1.00,phiCEQ:1.00,eFracEQ:0.3333};
   if(!S.meta) S.meta={revs:[]};
@@ -1249,3 +1254,4 @@ function buildInputs(){
       ${inpRow("ΔP<sub>AE</sub> application height ratio (× H)","seismic.hEQr","–",{title:"Dynamic increment applied at this fraction of H (0.6H classic Seed–Whitman; static part stays at H/3)."})}
-      ${inpRow("γ<sub>EH</sub> at Extreme Event I","seismic.gEHEQ","–",{title:"Static earth-pressure factor within EE-I; commonly 1.0 with the full M–O thrust. EOR confirm."})}
+      ${selRow("γ<sub>EH</sub> at Extreme Event I","seismic.gEHEQmode",[["gp","γp max/min, as Strength (1.50 / 0.90) [T.3.4.1-1, -2]"],["agency","Fixed value (agency policy)"]],{rebuild:true})}
+      ${S.seismic.gEHEQmode==="agency"?inpRow("&nbsp;&nbsp;γ<sub>EH</sub> (agency policy)","seismic.gEHEQ","–",{title:"Fixed static earth-pressure factor within EE-I (e.g. 1.0 with the full M–O thrust) where the owner allows it instead of γp."}):""}
       ${inpRow("γ<sub>EQ</sub> on live load","seismic.gEQll","–",{title:"Project-specific per 3.4.1; commonly 0 for abutments, up to 0.5 where live presence during EQ is credible."})}
@@ -1672,3 +1678,3 @@ function computeAll(){
       if(["DC","DW","EV","ES"].includes(gr.cls)) gamma = L.perm ? GP[gr.cls][perm[gr.cls]??1] : 1.0;
-      else if(gr.cls==="EH") gamma = L.eq ? +S.seismic.gEHEQ : (L.perm ? GP.EH[perm.EH] : 1.0);
+      else if(gr.cls==="EH") gamma = (L.eq && eqEHfixed()!==null) ? eqEHfixed() : (L.perm ? GP.EH[perm.EH] : 1.0);
       else if(gr.cls==="LL") gamma = liveOn ? L.LL : 0;
@@ -1688,3 +1694,3 @@ function computeAll(){
     const lbl = L.perm
-      ? `${(perm.DC===1&&L.dcMax?L.dcMax:GP.DC[perm.DC]).toFixed(2)}·DC + ${GP.DW[perm.DW].toFixed(2)}·DW + ${GP.EV[perm.EV].toFixed(2)}·EV + ${(L.eq?+S.seismic.gEHEQ:GP.EH[perm.EH]).toFixed(2)}·EH`
+      ? `${(perm.DC===1&&L.dcMax?L.dcMax:GP.DC[perm.DC]).toFixed(2)}·DC + ${GP.DW[perm.DW].toFixed(2)}·DW + ${GP.EV[perm.EV].toFixed(2)}·EV + ${((L.eq&&eqEHfixed()!==null)?eqEHfixed():GP.EH[perm.EH]).toFixed(2)}·EH`
         +(esOn?` + ${GP.ES[perm.ES??1].toFixed(2)}·ES`:"")
@@ -1789,3 +1795,2 @@ function computeAll(){
     if(brgOut) warn("One or more strength permutations put the factored resultant outside the footing (B′ ≤ 0 or L′ ≤ 0); they are excluded from the bearing check — see the eccentricity check.");
-    if(brgBxBad) warn("Rock bearing with transverse eccentricity: the biaxial no-tension pressure solution did not converge for at least one permutation — check the bearing pressure by hand.","err");
 
@@ -1801,6 +1806,10 @@ function computeAll(){
       else continue;
-      if(qmax>sv.q) sv={q:qmax,qmin,e,eSigned:eS,side:eS>=0?"toe":"heel",Lc,V:c.V,mode,lbl:c.lbl,c};
+      // transverse eccentricity e_L (as the strength bearing check, F15): planar no-tension pressure, peak corner [10.6.1.3, 10.6.5]
+      const eL=Math.abs(c.Mt)/c.V, qP=qmax, qminP=qmin; let bx=null;
+      if(eL>1e-9){ if(eL>=Lftg/2) continue; bx=biaxRockQ(c.V,e,eL,B,Lftg); qmax=bx.qmax; qmin=bx.full?bx.qmin:0; if(!bx.ok) brgBxBad=true; }
+      if(qmax>sv.q) sv={q:qmax,qmin,qP,qminP,eL,bx,e,eSigned:eS,side:eS>=0?"toe":"heel",Lc,V:c.V,mode,lbl:c.lbl,c};
     }
     R.serviceBearing=sv;
-    if(sv.mode==="tri") warn("Service-level bearing pressure is triangular (resultant outside the middle third) — verify serviceability/settlement with the geotechnical engineer.");
+    if(brgBxBad) warn("Bearing with transverse eccentricity: the biaxial no-tension pressure solution did not converge for at least one permutation — check the bearing pressure by hand.","err");
+    if(sv.mode==="tri"||(sv.bx&&!sv.bx.full)) warn("Service-level bearing pressure is "+(sv.mode==="tri"?"triangular (resultant outside the middle third)":"partial-contact (resultant outside the kern with the transverse eccentricity)")+" — verify serviceability/settlement with the geotechnical engineer.");
   }
@@ -1998,3 +2007,3 @@ function computeAll(){
     const L=LIMITS[lsName], ns=L.noSuper?0:1;
-    const gEH_ls=L.eq? +S.seismic.gEHEQ : gEH_max;
+    const gEH_ls=(L.eq&&eqEHfixed()!==null)? eqEHfixed() : gEH_max;
     // construction stage: reduced backfill height for the wall pressures
@@ -2084,15 +2093,25 @@ function computeAll(){
     const det=R.checks.pileComp.det, act=activePiles();
-    // per-foot upward line loads by pile row (x from footing CL)
-    const rows={};
-    act.forEach((p,i)=>{ const key=p.x.toFixed(4); (rows[key]=rows[key]||{x:p.x,P:0}).P+=det.loads[i]; });
-    const rowArr=Object.values(rows);
-    let MtoeUp=0,VtoeUp=0,MheelUp=0,VheelUp=0;
-    rowArr.forEach(r=>{
-      const xT=B/2+r.x;
-      if(xT<g.Ltoe){ VtoeUp+=r.P/Lftg; MtoeUp+=r.P/Lftg*(g.Ltoe-xT); }
-      if(xT>xStemBack){ VheelUp+=r.P/Lftg; MheelUp+=r.P/Lftg*(xT-xStemBack); }
-    });
+    // TOE — every strength / EE permutation (as the heel); per-foot upward line loads by pile row (x from footing CL).
+    // The max-pile-compression case is evaluated first, so it is kept on a tie.
     const MtoeDn=0.9*wFoot*g.Ltoe*g.Ltoe/2;
-    toeDem={Mu:Math.max(0,MtoeUp-MtoeDn), Vu:Math.max(0,VtoeUp-0.9*wFoot*g.Ltoe),
-      MtoeUp,VtoeUp,MtoeDn,rowArr, lbl:det.c?.lbl+" ("+R.checks.pileComp.ls+")", src:"pile"};
+    function toePile(loads){
+      const rows={};
+      act.forEach((p,i)=>{ const key=p.x.toFixed(4); (rows[key]=rows[key]||{x:p.x,P:0}).P+=loads[i]; });
+      const rowArr=Object.values(rows);
+      let MtoeUp=0,VtoeUp=0;
+      rowArr.forEach(r=>{ const xT=B/2+r.x; if(xT<g.Ltoe){ VtoeUp+=r.P/Lftg; MtoeUp+=r.P/Lftg*(g.Ltoe-xT); } });
+      return {rowArr,MtoeUp,VtoeUp,Mu:Math.max(0,MtoeUp-MtoeDn),Vu:Math.max(0,VtoeUp-0.9*wFoot*g.Ltoe)};
+    }
+    let tM=Object.assign(toePile(det.loads),{c:det.c,ls:R.checks.pileComp.ls}), tVu=tM.Vu, tVls=tM.ls;
+    for(const lsName of STR_LIMITS){
+      for(const pl of permutations(lsName)){
+        const c=comboEffects(lsName,pl.perm,pl.liveOn,false);
+        const loads=pileLoadsFor(c); if(!loads) continue;
+        const t=toePile(loads);
+        if(t.Mu>tM.Mu+1e-9) tM=Object.assign(t,{c,ls:lsName});
+        if(t.Vu>tVu+1e-9){ tVu=t.Vu; tVls=lsName; }
+      }
+    }
+    toeDem={Mu:tM.Mu, Vu:tVu, MtoeUp:tM.MtoeUp, VtoeUp:tM.VtoeUp, MtoeDn, rowArr:tM.rowArr, ls:tM.ls, lsV:tVls,
+      lbl:tM.c?.lbl+" ("+tM.ls+")", src:"pile"};
     // HEEL — every strength permutation; downward loads and pile reactions from the same permutation (consistent combination)
@@ -2431,3 +2450,3 @@ function computeAll(){
     return { DC:L.perm?(L.dcMax||GP.DC[1]):1, DW:ns*(L.perm?GP.DW[1]:1), LL:ns*L.LL, EV:L.perm?GP.EV[1]:1,
-      EH:L.eq? +S.seismic.gEHEQ : (L.perm?GP.EH[1]:1), LS:L.LL, ES:L.perm?GP.ES[1]:1,
+      EH:(L.eq&&eqEHfixed()!==null)? eqEHfixed() : (L.perm?GP.EH[1]:1), LS:L.LL, ES:L.perm?GP.ES[1]:1,
       BR:ns*L.LL, TU:ns*L.TU, CRSH:ns*L.CR, WS:ns*L.WS, WL:ns*L.WL, ns };
@@ -2874,3 +2893,3 @@ function renderTabComb(R){
       <td>${p?fmt(GP.EV[1])+" / "+fmt(GP.EV[0]):"1.00"}</td>
-      <td>${L.eq?fmt(+S.seismic.gEHEQ):(p?fmt(GP.EH[1])+" / "+fmt(GP.EH[0]):"1.00")}</td>
+      <td>${(L.eq&&eqEHfixed()!==null)?fmt(eqEHfixed())+" (agency)":(p?fmt(GP.EH[1])+" / "+fmt(GP.EH[0]):"1.00")}</td>
       <td>${p?fmt(GP.ES[1])+" / "+fmt(GP.ES[0]):"1.00"}</td>
@@ -3018,3 +3037,4 @@ function renderTabStab(R){
         sv.mode==="trap"?"q_{max,min} = \\dfrac{\\Sigma V}{B\\,L_{ab}}\\left(1\\pm\\dfrac{6e}{B}\\right)":"q_{max} = \\dfrac{2\\,\\Sigma V}{3\\,L_{ab}(B/2-e)}\\ \\text{over } L_c=3(B/2-e)",
-        `q_{max} = ${fmtT(sv.q)}\\ \\text{ksf}, \\qquad q_{min} = ${fmtT(sv.qmin)}\\ \\text{ksf}, \\qquad e_{svc} = ${fmtT(sv.e)}\\ \\text{ft}`])}
+        ...(sv.bx?[`e_L = \\dfrac{|\\Sigma M_t|}{\\Sigma V} = \\dfrac{${fmtT(Math.abs(sv.c.Mt))}}{${fmtT(sv.V)}} = ${fmtT(sv.eL,3)}\\ \\text{ft}\\,, \\quad \\dfrac{6e}{B}+\\dfrac{6e_L}{L_{ftg}} = ${fmtT(sv.bx.kern,3)}\\ ${sv.bx.full?"\\le":">"}\\ 1 \\;\\Rightarrow\\; ${sv.bx.full?"q = \\dfrac{\\Sigma V}{B\\,L_{ftg}}\\left(1\\pm\\dfrac{6e}{B}\\pm\\dfrac{6e_L}{L_{ftg}}\\right)":"\\text{planar no-tension pressure (solved numerically)}"}`]:[]),
+        `q_{max} = ${fmtT(sv.q)}\\ \\text{ksf}${sv.bx?"\\ (\\text{corner})":""}, \\qquad q_{min} = ${fmtT(sv.qmin)}\\ \\text{ksf}, \\qquad e_{svc} = ${fmtT(sv.e)}\\ \\text{ft}`])}
       <div class="note-box"><b>External geotechnical items (not solved in this tool):</b> settlement and overall (global slope) stability are to be evaluated by the geotechnical engineer using the Service I pressures and loads above. [10.6.2.4, 11.6.2.3, 11.6.3.7]</div>
@@ -3241,3 +3261,3 @@ function renderTabStruct(R){
         `M_u = ${fmtT(td.Mu)}\\ \\text{kip-ft/ft}\\,, \\qquad V_u = ${fmtT(td.Vu)}\\ \\text{kip/ft}`],
-        "Pile rows forward of the stem front face, using the governing max-compression case per-pile loads.")
+        "Pile rows forward of the stem front face; every strength / Extreme Event permutation is checked and the one giving the largest toe moment is shown"+(td.lsV&&td.lsV!==td.ls?" (V_u from "+td.lsV+")":"")+".")
     : `<div class="note-box">No toe demand source (check inputs).</div>`;
@@ -3817,4 +3837,5 @@ function drawChartsFor(tabId,R){
     let xsv=[],qsv=[];
-    if(sv.mode==="trap"){ xsv=[0,B]; qsv=[sv.q,sv.qmin]; }
-    else { xsv=[0,sv.Lc,sv.Lc,B]; qsv=[sv.q,0,0,0]; }
+    const sq=sv.qP??sv.q, sqm=sv.qminP??sv.qmin;   // along-B curve (averaged along L when e_L > 0; the corner peak is reported in §3.4)
+    if(sv.mode==="trap"){ xsv=[0,B]; qsv=[sq,sqm]; }
+    else { xsv=[0,sv.Lc,sv.Lc,B]; qsv=[sq,0,0,0]; }
     let xst=[],qst=[];
@@ -4754,3 +4775,3 @@ function inputEchoHTML(){
   h+="<h3>Seismic / scour</h3>"+echoRows([
-    ["Extreme Event I",S.seismic.on?("ON — As="+fmt(+S.seismic.As,3)+", kh="+fmt(+S.seismic.khR,2)+"·As, kv="+fmt(+S.seismic.kv,2)+", ΔPAE @ "+fmt(+S.seismic.hEQr,2)+"H; φτ/φb/φc(EE)="+fmt(+S.seismic.phiTauEQ,2)+"/"+fmt(+S.seismic.phiBEQ,2)+"/"+fmt(+S.seismic.phiCEQ,2)+", e/B ≤ "+fmt(+S.seismic.eFracEQ,3)):"OFF",""],
+    ["Extreme Event I",S.seismic.on?("ON — As="+fmt(+S.seismic.As,3)+", kh="+fmt(+S.seismic.khR,2)+"·As, kv="+fmt(+S.seismic.kv,2)+", ΔPAE @ "+fmt(+S.seismic.hEQr,2)+"H; φτ/φb/φc(EE)="+fmt(+S.seismic.phiTauEQ,2)+"/"+fmt(+S.seismic.phiBEQ,2)+"/"+fmt(+S.seismic.phiCEQ,2)+", e/B ≤ "+fmt(+S.seismic.eFracEQ,3)+", γEH(EE) = "+(eqEHfixed()!==null?fmt(eqEHfixed(),2)+" (agency policy)":"γp max/min")):"OFF",""],
     ["Scour condition",f.scour?"ON — passive eliminated; qn at scoured grade":"off",""]]);
```

## 2026-10-18 — PR: claude/abutment-d11-report (PR link added after merge)

### D11: calculation-sheet report in the Gusset Plate Rating / ST-Girder format (Tier 1, display only)
- **Engineer request:** 2026-10-14 / 2026-10-18 (AUDIT.md D11: "have a report builder, to be reviewed against the format").
- **Functions / anchors:**
  - `buildReport()` is rewritten, preceded by the new `ABUT_REFS`, `abutPageCSS()`, `abutApplyPageCSS()` and `abutResultBlock()` (anchor `/* D11 (2026-10-18): calculation-sheet report`). To re-apply by hand, copy the whole block from that anchor down to `function syncRptDlg(){` from this version. The tab clones, the chart-to-image swap, `inputEchoHTML()`, `captureD3()`, `selfTestHTML()` and `generateReport()` are reused unchanged.
  - CSS anchor `/* D11 calculation-sheet report` (after `#report .plotimg{…}`), and `.wklink` after `.xlink:hover`.
  - Report Contents dialog (`#rptOptList`): the labels lose their section letters, which no longer exist.
    - Before: `Section E — full input echo`, `Section G — γp load-combination &amp; permutation tables`, `Section L — detailed force-effect tables (per-load breakdown)`, `Section M — 3D load visualization snapshot`, `Section N — validation self-test result`.
    - After: `Input echo (full)`, `Load combinations &amp; γp permutation tables`, `Detailed force-effect tables (per-load breakdown)`, `3D load visualization snapshot`, `Validation self-test result`.
    - The `data-ropt` keys and `S.ui.rptOpts` are unchanged.
- **Before:**
  - A title block and a lettered contents list (A–O) without links.
  - Lettered sections, with the tabs cloned under their own panel numbers (1.0 … 8.6, "2.3" repeated for every limit state, and "3.6a").
  - A references paragraph at the end (section O).
  - A running header "name · Input ID · date" and a "Sheet X of Y" footer.
- **After:**
  - **Cover:** title, project, abutment type, codes, by-line, the existing title block (Project / Project No. / Calculated By / Date / Subject / Input ID / Checked By / Checked Date), the pass/fail banner and the Input ID note. All project fields already existed (`proj.name`, `num`, `calcBy`, `date`, `chkBy`, `chkDate`), so no field was added.
  - **References table** (`ABUT_REFS`), listing only the articles the tool cites:
    - AASHTO LRFD 10th Ed. (2024): Sections 3 and 5, Art. 4.7.4.4, Sections 10 and 11, Appendix A11.3.1, and Art. 14.6.3.1;
    - MassDOT LRFD Bridge Manual Part I §3.1.8.3, marked "edition: verify" (the tool states no edition);
    - the tool's own "Design basis §x" notes.
    - The note on load factors from the old section O is kept under the table.
  - **Numbered table of contents** with links (sections and subsections).
  - **Numbered sections:**
    1. Results Summary;
    2. Key Results;
    3. Warnings;
    4. Assumptions & Modified Constants;
    5. Input Echo;
    6. Geometry & Loads;
    7. Load Combinations (optional);
    8. External Stability;
    9. Foundation / Pile Group;
    10. Structural Design;
    11. V & M Diagrams;
    12. Detailed Tables (optional);
    13. 3D (optional);
    14. Self-Test (optional).
    - The numbers close up when an optional section is left out.
  - **Subsections n.k:** every tab panel (its own number is replaced by n.k) and every `h3` heading of sections 4 and 5. Panels keep their worked equations (symbolic → substituted → result) exactly as on screen.
  - **Result lines** at the end of §8, §9 and §10, one per check in `R.dash`: "<check>: D/C = x.xx (AASHTO LRFD 10th Ed. Art. <ref>; <governing>; §n.k) PASS / FAIL". The values are the dashboard's.
  - **Summary and key-result tables** gain a "Worked in" column: the §n.k of the panel where the value is worked, from `DASH_ANCHOR`.
  - **Print:** `@page` letter with margin boxes, in a `<head>` style (`#abut-page`) inside `@media print`, so they apply only while printing.
    - Top: "Project No / Description", "Computed By / Checked By", "Date / Date".
    - Bottom: "<project> (Bridge Abutment Design Calculator)" with "Input ID …" on a second line (kept from the old running header), and "Page X of Y".
  - Live `<select>` controls print as the text of the selected option. Buttons (Re-run self-test, Run sensitivity analysis) are hidden in the report.
- **Fixed along the way (display only):**
  - Key Results said "see Section F" for the modified constants, but they were in section D. It is now a link to §4.2.
  - Pile branch, Tab 3 §3.0 note: "their factor sets are shown in §Tab 4" (stray §). It now reads "Tab 4", as a link. Before: `` §${fn.branch==="spread"?"3.1 / 3.2":"Tab 4"} ``.
  - The section heading "Load Combinations & γp Permutations" printed as "ΓP" under the upper-case heading style. γ<sub>p</sub> is now kept lower case.
  - The in-text references "§3.0", "Tab 2 §2.3", "Tab 3, §3.6", "Tab 5 §5.x" and "Tab 6" printed the app's tab numbers, which do not exist in the report. They now print the report's §n.k (see D11 links).
- **Provision:** none. No formula, factor, unit, code reference or result changed.
- **Saved data:** none. No key or format change, and the `S.ui.rptOpts` keys are unchanged.
- **Check case (default project "Example Single-Span Bridge", all report options on):**
  - 14 sections and 61 subsections; 74 letter pages (main: 71).
  - §8 results (equal to the dashboard):
    - Sliding: D/C = 1.15 (Art. 10.6.3.4; Constr — Str I; §8.2) FAIL;
    - Eccentricity: 0.57 (11.6.3.3; Strength I; §8.3) PASS;
    - Bearing: 0.93 (10.6.3.1; Strength I; §8.4) PASS;
    - Minimum support length: 0.31 (4.7.4.4; §8.6) PASS.
  - §10 results: 18 lines, e.g. Stem flexure 0.36 PASS (§10.3).
  - Pile branch with Extreme Event I on: 76 pages. §9 results, all PASS: pile compression 0.91, pile uplift 0.21 (Extreme Event I), pile punching 0.20.

### D11 links: quoted values link to the panel where they are worked (CLAUDE.md §6) (Tier 1, display only)
- **New helper** (after `govNote`, anchor `/* ---- D11 links`): `ABUT_TABNAME` and `abutWorkedIn(items)`, which returns a "Worked in: <value> → <Tab> · <panel>" line made of `.xlink` spans. Clicks use the existing `.xlink[data-jump]` handler (`gotoPanel`), which opens the tab, expands the panel, scrolls to it and flashes it.
- **"Worked in" lines added:**
  1. Tab 4 §4.4 Pile Axial Capacity: P_max → 4.2 Axial Pile Reactions; P_min → 4.3 Pile Reactions per Limit State. Inserted after `${govNote(pc.lbl+" — "+pc.ls)}`.
  2. Tab 4 §4.6 Punching: V_u (pile reaction) → 4.2. Inserted after the `govNote(...governing pile...)` line.
  3. Tab 5 §5.5 Shear Friction: V_ui (stem-base V_u) → 5.2 Stem (`R.checks.shearFric.Vui = R.stemDem.Vu`). Inserted after `${govNote((sf.lbl||"")+" — "+(sf.ls||""))}`.
  4. Tab 5 §5.7 Reinforcement Schedule (A<sub>s</sub> prov/req and ℓ<sub>d</sub>): A1 → 5.2 Stem, B1 → 5.1 Backwall, C1 → 5.3 Toe, D1 → 5.4 Heel. Inserted after `${rt}`.
- **Existing plain-text references made into links.** The on-screen text is unchanged, except that "§3.1 / 3.2" now reads "§3.1 / §3.2".
  - Tab 2 §2.2: `The tables in §2.3` → `The tables in <span class="xlink" data-jump="tab-comb|o-perm-<first limit state>">§2.3</span>`.
  - Tab 3 §3.0 note: `§3.1 / 3.2` → links to `o-slide` / `o-ecc`. Pile branch: `Tab 4` → link to `o-pilecap`.
  - Tab 3 §3.3 note (rock, biaxial): `the 2-D free body in §3.0` → link to `o-fbd`.
  - Tab 3 pile-branch note: `see Tab 4` → link to `o-pilecap`.
  - Tab 4 spread-branch note: `results are in Tab 3` → link to `o-brg`.
  - Tab 5 §5.1 backwall note: `(Tab 3, §3.6)` → link to `o-seis`.
  - Tab 6 panels: `Governing design demand (Tab 5 ${d.ref})` → link to `o-str-Stem|Backwall|Toe|Heel`.
  - Tab 6 §6.0: `matching Tab 5` → link to `o-str-Toe`.
  - Tab 8 §8.0 and §8.6: `Tab 6` → link to `o-vm-note`.
- **Calculation report:** `buildReport` records each panel's §n.k by its `data-cid` and rewrites every `.xlink`:
  - "Worked in" links read "<value>: see §n.k".
  - In-text references have their tab/§ number replaced by the report's §n.k (e.g. "Tab 2 §2.3 (Strength I)" → "§7.4 (Strength I)").
  - All of them become PDF links.
  - A target left out of the printout reads "… (not in this printout)".
- **Provision:** none. No result changed.
- **Check case (default project):**
  - In the report:
    - "§3.1 / §3.2" prints "§8.2 / §8.3";
    - "Tab 2 §2.3 (Strength I)" prints "§7.4 (Strength I)";
    - "Tab 3, §3.6" prints "§8.7".
  - Structural section: "V_ui (stem-base V_u): see §10.3" and "A1: see §10.3 · B1: see §10.2 · C1: see §10.4 · D1: see §10.5".
  - Pile branch: "P_max: see §9.2 · P_min: see §9.3".
  - The report DOM has 143 internal links (the PDF has 145 link annotations), none broken.
  - With load combinations and detailed tables omitted, the reference prints "Tab 2 §2.3 (Strength I) (not in this printout)".
  - In the app, clicking "V_ui … → Structural Design · 5.2 Stem" opens Tab 5, expands the Stem panel (also when it was collapsed), scrolls to it and flashes it. The Tab 3, Tab 4, Tab 6 and Tab 8 links tested behave the same way.
- **Verification (both entries):**
  - `node tests/check-syntax.mjs abutment_calculator.html`: all scripts pass.
  - `node tests/compare.mjs --tool page --file abutment_calculator.html`: page.text and page.storage identical. The console errors on both sides come only from CDN libraries the kit does not hold (KaTeX 0.16.11, Plotly 2.35.2, three 0.128.0 from unpkg).
  - **Main vs branch with the libraries served locally** (KaTeX 0.16.11, Plotly 2.35.2 and three 0.128.0 from `npm pack`, outside the repo):
    - Five cases: default, pile branch, Extreme Event I on, pile + EE-I, and rock.
    - In every case these are identical: the full `computeAll()` result (functions removed), `R.dash`, `extractKeyResults`, the Input ID and the self-test. 0 console errors.
    - The rendered text of every tab differs only by the "Worked in" lines, "§3.1 / §3.2", and the pile-branch fix "§Tab 4" → "Tab 4".
  - Headless Chromium PDF (print media, `preferCSSPageSize`). Pages checked:
    - cover; references and TOC; Results Summary; Load Combinations;
    - §8.1 free body with its links; the §8 and §10 result blocks; the "Worked in" line under the reinforcement schedule;
    - pile §9.6 with its result block;
    - the header and footer boxes.
- **Other copies:** none. The report builder is specific to this tool.
- **Open items:**
  - Tab 3 §3.1 Sliding says "See §3.0 free-body ledger for the force × arm breakdown of the governing case". However, §3.0 is assembled for the governing *bearing/pile* case (its own note says so); the sliding case uses its own permutation with LSv excluded. Not changed (wording only). Should the link say so, or should §3.1 get its own ledger?
  - The "Design basis §x" citations (the tool's own notes) now appear in a report whose sections are also numbered §x. They are labelled "Design basis", but the engineer may prefer a different marker.

## 2026-10-19 — PR: claude/aashto10-abutment — ℓd per AASHTO LRFD 10th Ed. 5.10.8.2.1a; 10th Ed. renumbers (PR link added after merge)

### A1. Tension development length ℓd   [calculation change (§4)]
- **Where:** section-check function (the one returning `{...o, As, AsReq, d, …}`), anchor `// development [AASHTO LRFD 10th Ed. 5.10.8.2.1a]`; its display in the Structural tab, anchor `S&T reinforcement (each face, each direction) & tension development length`.
- **Before:**
  ```js
  // development [5.10.8.2.1]
  const ld=Math.max(12, 2.4*bar.db*m.fy/Math.sqrt(m.fc));
  ```
  display `\ell_d = 2.4 d_b f_y/\sqrt{f'_c}`, note "development length shown with all modification factors = 1.0".
- **After:**
  ```js
  const fc4=Math.pow(Math.min(m.fc,15),0.25);
  const ldb=0.17*bar.db*Math.pow(m.fy/(1.97*fc4),2);
  const ld=Math.max(12, ldb);
  ```
  (`fc4`, `ldb` added to the returned object.) In symbols: ℓdb = 0.17·db·[(λer·fy − Fh/Ab)/(1.97·λ·f′c^0.25)]² with λer = λ = 1.0, Fh = 0 (straight bar, normal weight; the tool has no lightweight input); ℓd = ℓdb·λrl·λcf·λrc with all three factors 1.0 (λrc = 1.0 is its upper bound, no confinement credit, as before) and ≥ 12 in.; f′c ≤ 15 ksi (5.10.8.2.1; the input is already limited to 2–15 ksi). Display: two lines, ℓdb symbolic → substituted → result, then ℓd = max(ℓdb·1.0·1.0·1.0, 12). Same implementation as `ACI Rebar Development Length.html` (PR claude/aashto10-rebar), duplicated per CLAUDE.md §3.
- **Provision:** AASHTO LRFD 10th Ed. (2024) Art. 5.10.8.2.1a, Eqs. 5.10.8.2.1a-1 and -2. More conservative (longer) at every f′c in the tool's range for the same bar.
- **Used by:** the ℓd column of the reinforcement schedule (§5.7) and the estimated bar lengths B1 (backwall: h_bw + ℓd), C1 (toe: L_toe + t + ℓd), D1 (heel: L_heel + t + ℓd). No strength check uses ℓd.
- **Check case (default project: f′c 4 ksi, fy 60 ksi; backwall #6, stem #9, toe and heel #8):** f′c^0.25 = 1.4142, 1.97 × 1.4142 = 2.786, (60/2.786)² = 463.8.
  - #8: before 2.4 × 1.0 × 60/2 = 72.0 in.; after 0.17 × 1.0 × 463.8 = **78.85 in.** (toe C1 and heel D1 bars +0.57 ft each).
  - #6: before 54.0 in.; after 0.17 × 0.75 × 463.8 = **59.14 in.** (backwall B1 bar +0.43 ft).
  - #9: before 81.22 in.; after 0.17 × 1.128 × 463.8 = **88.94 in.**
  - #8 at f′c 8 ksi: before 50.91 in.; after 0.17 × (60/(1.97 × 1.6818))² = **55.75 in.**

### A2. Renumbers to the 10th Ed. (citation only, no result change)
- Bearing φ = 0.70: "5.5.4.2.1" → **5.5.4.2** (Factored bearing demand & resistance card).
- Live-load surcharge: "Table 3.11.6.4-1" → **Table 3.11.6.4.1-1** (code comment, input subhead, three limit labels `soil.heq5/10/20`, design-basis note 2, surcharge card); the surcharge cards' "AASHTO 3.11.6.4" / "Eq. 3.11.6.4-1" → **3.11.6.4.1 / Eq. 3.11.6.4.1-1** (the equation is renumbered in the 10th Ed. with its table; values unchanged).
- Overall stability: "11.6.2.3" → **11.6.3.7** (Service I panel title and note; references row now "11.6.3 (incl. 11.6.3.7), 11.6.5").
- Interface shear factors: "[Table 5.7.4.4-1]" → **[Art. 5.7.4.4]** (the 10th Ed. lists c, μ, K1, K2 in the article text).
- k_h = 0.5·A_s for walls free to move 1–2 in.: "[11.6.5.2.1]" → **[11.6.5.2.2]** (limit message and input tooltip).
- A_s input: label "(F<sub>pga</sub>·PGA)" → "(S<sub>a</sub> at T = 0 s)", tooltip "[3.10.4.2]" → the 0-s risk-targeted design acceleration coefficient for the site class from the AASHTO-USGS database or the geotech report **[3.10.4.1]**, k_h0 = A_s at the wall base [11.6.5.2.1]. In the 10th Ed. 3.10.4.2 no longer exists and A_s is read directly for the site class (no F_pga·PGA product). Input key `seismic.As`, its value and units unchanged.

### Saved data
- None. No key or format change.

### How verified
- `node tests/check-syntax.mjs abutment_calculator.html`: all scripts pass.
- Headless, main vs branch, default project: `computeAll()` ℓd of the four section checks as listed (tool = hand values); self-test passes; `node tests/compare.mjs --tool page --file abutment_calculator.html`: storage same, page text differs only by the renumbered Table/Eq. 3.11.6.4.1-1 lines. The new TeX lines render without error in KaTeX 0.16.9 (strict).
- **Other copies:** same ℓd form in `ACI Rebar Development Length.html` (with all factors), the Development & Splice tab of `Concrete Beam Capacity.html`, and `Retaining Wall Designer.html`.

### Open items (not changed)
- 11.6.5.2.1: for walls founded on Site Class A, B or B/C, k_h0 = 1.2·A_s. The tool uses k_h = ratio × A_s with no 1.2 factor. Engineer decision (add a site-class input or a note?).
- ℓd is still the upper bound (λrc = 1.0). A computed λrc (cover, spacing) would shorten it; not offered.

## 2026-10-19 — PR: claude/abut-defects-factors — load factors, EE limits, drag load and connection force to AASHTO LRFD 10th Ed. (PR link added after merge)

Defects from the 2026-10-19 review (H1, H2, H3, H5, H6, H7), approved by the engineer. Basis: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024); every value below was checked against the 10th Ed. text (Table 3.4.1-3 was read from the rendered page). Numbers come from the real `computeAll()` of origin/main `832728d` and of the branch in headless Chromium. "Default project" = the built-in example (B = 13 ft, L = 44 ft, 6 girders, DC/DW/LL = 85/12/70 kip per girder; TU/CR·SH entered 2.5/1.5 kip per girder, floating share 50 %). The exact edits are in the appendix as a unified diff against `832728d`.

### F27. γTU = 1.00 for force effects (was 0.50)   [calc change] [MORE conservative]
- **Where:** `defaultState()` `factors.gTU`; the `LIMITS` table uses it unchanged (Strength I, III, IV, V). Tooltip of I-8 "γ TU (force effects)"; note of Tab 2 §2.1 (anchor `TU uses γ<sub>TU</sub> =`); constants list C-20 (default 1.00).
- **Before:** `gTU:0.50, gCR:0.50,         // γTU, γCR/SH (strength force effects; EOR confirm)`
- **After:** `gTU:1.00, gCR:1.00,         // γTU force effects [T.3.4.1-6]; γCR/SH concrete substructure under a non-segmental superstructure [T.3.4.1-3]`
- **Provision:** AASHTO LRFD 10th Ed. Table 3.4.1-1 (Strength rows: TU column = γTU) and Table 3.4.1-6 (γTU = 1.20 displacements, 1.00 force effects).
- **Check case (default project, bearing, Strength I 1.25DC + 1.50DW + 1.00EV + 1.50EH + 1.75(LL,BR,LS) + γ·TU/CR/SH):** TU + CR·SH = (2.5 + 1.5)·6·0.50 = 12.0 kip at z = t_f + h_stem = 17.0 ft. V = 2977.88 kip, ΣM_V = 19538.16 kip-ft.
  - Before (γ = 0.50): ΣM_H = 6107.11; x̄ = (19538.16 − 6107.11)/2977.88 = 4.5103 ft; e = 6.5 − 4.5103 = 1.9897 ft; B′ = 13 − 3.9794 = 9.0206 ft; q = 2977.88/(9.0206·44) = **7.503 ksf**, D/C = 7.503/(0.45·18) = **0.926**.
  - After (γ = 1.00, together with F28): ΔM_H = 0.50·12.0·17.0 = 102.0 → ΣM_H = 6209.11; x̄ = 4.4760; e = 2.0240; B′ = 8.9520; q = 2977.88/(8.9520·44) = **7.560 ksf**, D/C = **0.933**.
  - Eccentricity (Strength I, V = 2392.83, ΣM_V = 15761.54): e 2.465 → **2.508 ft**, D/C 0.569 → **0.579**.
  - Stem M_u: +0.50·12.0·h_stem/L_ab = 6.0·14/44 = 1.909 → 110.15 → **112.06 kip-ft/ft**; V_u 13.111 → **13.248 kip/ft**.

### F28. γCR/SH = 1.0 (was 0.50)   [calc change] [MORE conservative]
- **Where / before / after:** same line as F27 (`gCR`); tooltip of I-8 "γ CR/SH" added.
- **Provision:** AASHTO LRFD 10th Ed. Table 3.4.1-3: concrete substructures supporting non-segmental superstructures, CR and SH = 1.0 (for a segmental superstructure the table points to γp for DC; the tool has no superstructure-type input, so the tooltip says so).
- **Check case:** included in F27 (the 12.0 kip is 7.5 kip TU + 4.5 kip CR·SH; the CR·SH part of ΔM_H is 0.50·4.5·17 = 38.25 of the 102.0 kip-ft).

### F29. Extreme Event I bearing φ_b = 0.80 (was 1.00); other EE φ reviewed   [calc change] [MORE conservative]
- **Where:** `defaultState()` `seismic.phiBEQ`; the `if(!S.seismic)` fallback in `migrate()`; I-11 tooltips; constants list C-20.
- **Before:** `phiTauEQ:1.00, phiBEQ:1.00, phiCEQ:1.00, eFracEQ:0.3333 },`
- **After:** `phiTauEQ:1.00, phiBEQ:0.80, phiCEQ:1.00, eFracEQ:0.3333,` (+ `eLimEQmode`, `zone`: F30, F32)
- **Provision:** AASHTO LRFD 10th Ed. Art. 11.5.8 (EE φ = 1.0 unless specified; bearing of gravity and semigravity walls 0.8; overall stability 0.9) and 10.5.5.3.3 (foundations 1.0; pile/shaft uplift ≤ 0.80).
- **Other EE φ checked, unchanged:** φτ = 1.00 (11.5.8 general); φc pile compression = 1.00 (10.5.5.3.3); pile uplift at EE uses the strength φ_up (default 0.60 ≤ 0.80, conservative); φep at EE stays the strength 0.50 (conservative against 1.0); overall stability (0.9) is not computed by the tool.
- **Check case (default project, EE-I on, A_s = 0.30):** governing EE-I bearing permutation 0.90DC + 0.65DW + 1.00EV + 1.50EH + 1.00EQ: V = 1657.83 kip, e = 4.855 ft, B′ = 13 − 9.711 = 3.289 ft, q = 1657.83/(3.289·44) = 11.455 ksf. D/C before 11.455/(1.00·18) = **0.636**; after 11.455/(0.80·18) = **0.796** (Strength I 0.933 still governs).

### F30. Extreme Event I eccentricity limit interpolated on γEQ, soil and rock   [calc change] [unchanged at γEQ = 0; less restrictive with live load per 11.6.5.1; unconservative rock hint removed]
- **Where:** `computeAll`, new `eFracEQfor(liveOn)` beside `resFor(lsName,liveOn)` (anchor `// EE-I eccentricity limit [11.6.5.1]`); the eccentricity loop takes e_lim per permutation; new input `seismic.eLimEQmode` ("aashto" | "user"; the e/B box shows only for "user"); Tab 3 §3.2 shows e_lim symbolic → substituted → result; report key-result row and input echo.
- **Before:** `eLim: eq? (+S.seismic.eFracEQ)*B : …` (default 0.3333; tooltip suggested 0.45 on rock).
- **After:**
  ```js
  function eFracEQfor(liveOn){ const s=S.seismic; if(s.eLimEQmode==="user") return +s.eFracEQ;
    const gq=liveOn? Math.min(1,Math.max(0,+s.gEQll||0)) : 0; return 1/3+(0.4-1/3)*gq; }
  … eLim: eq? eFracEQfor(liveOn)*B : …
  ```
- **Provision:** AASHTO LRFD 10th Ed. Art. 11.6.5.1 (soil and rock: middle two-thirds at γEQ = 0, middle eight-tenths at γEQ = 1, linear between) and 10.6.4.2 (γEQ = 0 where live load reduces e; a permutation without live load therefore uses B/3).
- **Check case (B = 13 ft):** γEQ = 0 → e_lim = 13/3 = 4.333 ft (before 0.3333·13 = 4.3329: EE-I eccentricity D/C 1.1206 → **1.1205** in the default project with EE-I on, A_s = 0.30). γEQ = 0.5 with live load → e_lim = 13·(1/3 + 0.0667·0.5) = **4.767 ft**. γEQ = 1 → 0.4·13 = 5.20 ft. The removed rock hint (0.45) would have allowed 5.85 ft.

### F31. Drag load (downdrag): γDR = 0.00 geotechnical, 1.10 structural   [calc change] [LESS conservative for the geotechnical pile check, per the 10th Ed.]
- **Where:** `computeAll`, pile branch, anchor `// governing over strength/EE states for capacity checks (per-LS φc). Drag load DR`; `defaultState()` `piles.gDD`; I-7 labels/tooltips; Tab 4 §4.4 (note + new block "Structural pile axial demand with drag load"); design-basis note 12; input echo.
- **Before:**
  ```js
  const p=S.piles, DDf=(+p.gDD||1.4)*(+p.dd||0);
  … const dcv=(r.best.Pmax+DDf)/(phiCls*p.Rn);
  ```
- **After:**
  ```js
  const p=S.piles, gDR=(p.gDD===undefined||p.gDD===null||p.gDD==="")?1.10:+p.gDD, DR=+p.dd||0, DDf=0;
  … if(!LIMITS[lsName].eq && r.best.Pmax>gStr.P) gStr={P:r.best.Pmax, ls:lsName, lbl:r.best.c?.lbl};
  … const dcv=(r.best.Pmax+DDf)/(phiCls*p.Rn);
  R.checks.pileComp={…, DR, gDR, Pstr:gStr.P+gDR*DR, PstrTop:gStr.P, PstrLs:gStr.ls, PstrLbl:gStr.lbl, …}
  ```
  The input key `piles.gDD` keeps its name; it is now γDR for structural strength (default 1.10). The tool still has no pile structural check; the demand P_max,Str + γDR·DR is reported for it. The §4.4 compression line now shows the φc of the governing limit state (it showed the strength φc even when EE-I governed; display only).
- **Provision:** AASHTO LRFD 10th Ed. Table 3.4.1-1 note (γDR = 1.10 structural strength, 0.00 geotechnical strength), Art. 3.11.8 / C3.11.8 (neutral-plane method; drag load does not act at the geotechnical strength limit; liquefaction drag only at Extreme Event I, not combined with consolidation drag).
- **Check case (default project, piles, DR = 20 kip/pile; φc·R_n = 0.70·330 = 231 kip):**
  - Before: P_max = 211.21 kip; D/C = (211.21 + 1.40·20)/231 = 239.21/231 = **1.036**.
  - After: P_max = 212.71 kip (F27/F28 add 1.50 kip); D/C = 212.71/231 = **0.921**; structural demand P_u,str = 212.71 + 1.10·20 = **234.71 kip**.
  - With DR = 0 only F27/F28 act: 0.914 → 0.921.

### F32. Minimum seismic connection force per 3.10.9 (was 0.10(DC + DW))   [calc change, design note] [MORE conservative]
- **Where:** `computeAll` C-9, anchor `// Minimum seismic connection force (each restrained direction) [3.10.9]`; new input `seismic.zone` (I-11, shown also with EE-I off, together with A_s); Tab 3 §3.6 (MassDOT note kept); design-basis note 11; SubLoads importer note.
- **Before:**
  ```js
  const Fconn=0.10*(agg.DC.P+agg.DW.P);
  R.seismic={Fconn, perBeam:0.10*(agg.DC.P/Math.max(1,S.beams.N)+agg.DW.P/Math.max(1,S.beams.N)), trib:agg.DC.P+agg.DW.P};
  ```
- **After:**
  ```js
  const zone=Math.min(4,Math.max(1,Math.round(+S.seismic.zone||1))), AsC=Math.max(0,+S.seismic.As||0), gEQc=Math.max(0,+S.seismic.gEQll||0);
  const Wperm=agg.DC.P+agg.DW.P, Wtrib=Wperm+gEQc*agg.LL.P, cZ1=AsC<0.05?0.15:0.25;
  const F1=zone===1? cZ1*Wtrib : 0, F0=AsC*Wperm, Fconn=Math.max(F1,F0);
  R.seismic={Fconn, perBeam:Fconn/Math.max(1,S.beams.N), trib:Wperm, Wtrib, zone, As:AsC, gEQ:gEQc, cZ1, F1, F0, LL:agg.LL.P};
  ```
- **Provision:** AASHTO LRFD 10th Ed. Art. 3.10.9.2 (Zone 1: ≥ 0.15 × the reaction from tributary permanent + EQ live load where A_s < 0.05; ≥ 0.25 × for all other Zone 1 sites); 3.10.9.1 and 4.7.4.2 (single-span bridges, any zone: ≥ A_s × tributary permanent load); 3.10.9.3 / 3.10.9.4 (Zones 2–4: forces from the seismic analysis, not computed by the tool; the panel says so and shows only the single-span floor). Zone per Table 3.10.6-1 (user input, default 1).
- **Choices made here (flag if not wanted):** the 3.10.9.1 floor A_s·(DC + DW) is applied in every zone (in Zone 1 it governs only when A_s > 0.25; conservative for a multispan bridge); the EQ live load is γEQ·LL with the I-11 γEQ (default 0).
- **Check case (default project, A_s = 0.15, Zone 1, γEQ = 0):** DC + DW = 510 + 72 = 582 kip. Before 0.10·582 = **58.2 kip** (9.70 kip per beam). After F_Z1 = 0.25·582 = 145.5 kip; F_1span = 0.15·582 = 87.3 kip; F_conn = **145.5 kip** (24.25 kip per beam). A_s = 0.04: 0.15·582 = 87.3 kip. A_s = 0.30, γEQ = 0.5: F_Z1 = 0.25·(582 + 0.5·420) = 198.0 kip > 0.30·582 = 174.6 kip.

### Self-test re-bake
- `__ST_EXPECT` values changed by F27/F28 only (hand-checked above): Eccentricity e 2.465267469172704 → 2.507894818378456; Bearing q_f 7.502750812839938 → 7.560165332011858; Bearing D/C 0.9262655324493752 → 0.933353744692822; Stem M_u 110.15268922678449 → 112.0617801358754; Shear-friction D/C 0.05702500795507431 → 0.05761809346762622 (V_u 13.111 → 13.248 kip/ft, ratio 1.0104). The other 11 values are unchanged; the self-test passes.

### Saved data (CLAUDE.md §5)
- No key renamed and no format change. New fields: `seismic.eLimEQmode`, `seismic.zone`, `meta.defRev` (they change the Input ID once).
- Migration in `migrate()`, anchor `// AASHTO LRFD 10th Ed. default revision (meta.defRev 1`: for a project without `meta.defRev`, a value that still equals the old default moves to the new default; an edited value is kept:
  - `factors.gTU` 0.50 → 1.00; `factors.gCR` 0.50 → 1.00; `seismic.phiBEQ` 1.00 → 0.80; `piles.gDD` 1.40 → 1.10;
  - `seismic.eFracEQ` = 0.3333 → `eLimEQmode` "aashto"; any other value → "user" (the fixed value is kept);
  - `seismic.zone` (absent) → 1.
  Then `meta.defRev = 1`. What changed is listed once in the warnings box (dismiss with OK). After the autosave is opened, the migrated project is saved at once, so the notice does not return; a copy in the saved-projects list is migrated each time it is loaded until it is overwritten. Compare (A vs B) runs migrate silently. Fresh projects and Reset already carry the new defaults (nothing listed).
- The meaning of `piles.gDD` changes (geotechnical γDD → structural γDR). A project that stored an edited value keeps the number; it no longer enters the φc·R_n check (F31).
- Verified: a project autosaved by main (old defaults) opens in the branch with all six items listed and gives the branch's default D/Cs; a project with γTU = 0.75, e/B = 0.45, φb,EE = 0.90 keeps all three (mode "user"), and only γCR, γDR and the zone are listed; after a reload no notice appears.

### How verified
- `node tests/check-syntax.mjs abutment_calculator.html`: all scripts pass.
- Headless Chromium, main `832728d` vs branch, `computeAll()` on the default project and the variants piles (DR = 20), spread on rock (q_n = 40 ksf), seismic (EE-I, A_s = 0.30), seismic on rock with γEQ = 0.5, piles + seismic, front batter, ES = 0.5 ksf: the only D/C changes are those listed above and their structural knock-ons (stem, toe, heel and shear friction through γTU/γCR). Every tab renders with no page error; all 353 TeX strings of these cases render in KaTeX 0.16.9 with `throwOnError`. `node tests/compare.mjs --tool page`: storage same, page text differs by the changed values and labels.
- **Other copies:** none.

### Open items (not changed)
- N8 (review): the constants list C-20 still compares γWS,III with 1.40 (tool default and 10th Ed. 1.00). Not in the approved list.
- MassDOT connection force (Guide Spec 4.6 / MassDOT 3.4.4: permanent load only, 1.25·S_a for high SDC A) is not implemented; the MassDOT note is kept.
- φep at EE (strength 0.50 used; 11.5.8 gives 1.0) left conservative.

### Appendix — unified diff (exact before/after)
```diff
diff --git a/abutment_calculator.html b/abutment_calculator.html
index 6606efa..453d8aa 100644
--- a/abutment_calculator.html
+++ b/abutment_calculator.html
@@ -613,7 +613,7 @@ function defaultState(){
       offX:0.0, offY:0.0,
       Rn:330.0, phiC:0.70, RnUp:100.0, phiUp:0.60,
       pileSize:12.0, pileShape:"hp",  // width/diameter (in); 'square' | 'round' | 'hp' — punching perimeter
-      dd:0.0, gDD:1.40                    // downdrag per pile (kip) and its load factor [T.3.4.1-2]
+      dd:0.0, gDD:1.10                    // drag load DR per pile (kip) and γDR for structural strength [T.3.4.1-1 note: 1.10 structural, 0.00 geotechnical]
     },
     joint:{ prep:"roughened" },       // stem-footing construction joint: 'monolithic'|'roughened'|'smooth' [5.7.4.4]
     bearing:{ padL:18.0, padW:24.0, seatBar:"5", seatSp:6.0, // bearing pad plan L(long)×W(trans) in; provided seat mat
@@ -629,7 +629,9 @@ function defaultState(){
     seismic:{ on:false, As:0.15, khR:0.5, kv:0.0, hEQr:0.6,       // EE-I: site accel coeff, kh = khR·As (walls free to displace), ΔPAE at hEQr·H
       gEHEQ:1.00, gEQll:0.0,                                      // γEH at EE-I (used only with gEHEQmode "agency"); γEQ on live load (project-specific)
       gEHEQmode:"gp",                                             // EE-I γEH: "gp" = γp max/min [T.3.4.1-1/-2]; "agency" = fixed gEHEQ
-      phiTauEQ:1.00, phiBEQ:1.00, phiCEQ:1.00, eFracEQ:0.3333 },  // extreme-event resistance factors & e/B limit (soil ⅓, rock 0.45)
+      phiTauEQ:1.00, phiBEQ:0.80, phiCEQ:1.00, eFracEQ:0.3333,    // extreme-event resistance factors [11.5.8: 1.0; bearing 0.8 for semigravity walls; 10.5.5.3.3]; e/B (used only with eLimEQmode "user")
+      eLimEQmode:"aashto",                                        // EE-I e limit: "aashto" = B·(1/3 + (0.4 − 1/3)·γEQ) soil and rock [11.6.5.1]; "user" = fixed eFracEQ
+      zone:1 },                                                   // seismic zone [T.3.10.6-1]: connection force [3.10.9]
     meta:{ revs:[] },                                             // revision history: {n, ts, fp} on each project save
     factors:{
       // Table 3.4.1-1 / 3.4.1-2 — all editable
@@ -637,7 +639,7 @@ function defaultState(){
       gpEVmax:1.35, gpEVmin:1.00, gpEHmax:1.50, gpEHmin:0.90,
       llS1:1.75, llS5:1.35,       // γLL Strength I / Strength V
       wsS3:1.00, wsS5:1.00, wlS5:1.00,   // γWS = 1.00 since the 2017 (8th Ed.) wind revision — WS inputs are ultimate (115-mph-class) pressures [3.8.1, Table 3.4.1-1]
-      gTU:0.50, gCR:0.50,         // γTU, γCR/SH (strength force effects; EOR confirm)
+      gTU:1.00, gCR:1.00,         // γTU force effects [T.3.4.1-6]; γCR/SH concrete substructure under a non-segmental superstructure [T.3.4.1-3]
       gpDCmaxS4:1.50,             // γDC max for Strength IV [T.3.4.1-2]
       vWS3:0, vWS5:80, vWSsvc:70  // wind speeds (mph): WS reactions are entered at V_III; 0/blank V_III = no per-limit-state scaling [T.3.8.1.1.2-1]
     },
@@ -673,6 +675,7 @@ function setPath(obj,path,val){
 }
 let S = defaultState();
 let WARNINGS = [];   // {level:'warn'|'err', msg}
+let DEFAULTS_NOTICE = null;   // one-time list of saved values moved to the 10th Ed. defaults by migrate() (shown in the warnings box until dismissed)
 function warn(msg,level="warn"){ WARNINGS.push({level,msg}); }
 // Extreme Event I γEH: null = γp max/min permuted [T.3.4.1-1, T.3.4.1-2] (default); a number = the "agency policy" fixed value seismic.gEHEQ
 function eqEHfixed(){ const s=S.seismic||{}; return s.gEHEQmode==="agency"? +s.gEHEQ : null; }
@@ -953,10 +956,10 @@ function migrate(){
   if(S.fnd.scour===undefined) S.fnd.scour=false;
   if(S.fnd.eFracSoil===undefined) S.fnd.eFracSoil=1/3;   // 11.6.3.3 (2015+): middle two-thirds on soil
   if(S.fnd.eFracRock===undefined) S.fnd.eFracRock=0.45;  // middle nine-tenths on rock
-  if(S.piles.dd===undefined){ S.piles.dd=0; S.piles.gDD=1.40; }
+  if(S.piles.dd===undefined){ S.piles.dd=0; S.piles.gDD=1.10; }
   // EE-I γEH mode: a project that stores gEHEQ keeps that fixed value ("agency"); one without it gets the γp default
   if(S.seismic && S.seismic.gEHEQmode===undefined) S.seismic.gEHEQmode=(S.seismic.gEHEQ!==undefined)?"agency":"gp";
-  if(!S.seismic) S.seismic={on:false,As:0.15,khR:0.5,kv:0.0,hEQr:0.6,gEHEQ:1.00,gEHEQmode:"gp",gEQll:0.0,phiTauEQ:1.00,phiBEQ:1.00,phiCEQ:1.00,eFracEQ:0.3333};
+  if(!S.seismic) S.seismic={on:false,As:0.15,khR:0.5,kv:0.0,hEQr:0.6,gEHEQ:1.00,gEHEQmode:"gp",gEQll:0.0,phiTauEQ:1.00,phiBEQ:0.80,phiCEQ:1.00,eFracEQ:0.3333,eLimEQmode:"aashto",zone:1};
   if(!S.meta) S.meta={revs:[]};
   if(!S.ui.d3Sel) S.ui.d3Sel="ls:Strength I";
   if(!S.ui.d3Tog) S.ui.d3Tog={piles:true,P:true,Vx:true,Vy:true,eh:true,ls:true,soil:true,water:true,dims:true,wire:false};
@@ -969,6 +972,23 @@ function migrate(){
   if(S.factors.vWSsvc===undefined) S.factors.vWSsvc=70;
   if(!S.ui.rptOpts) S.ui.rptOpts={inputEcho:true, permFull:true, detailTables:true, viz3d:true, selftest:true, charts:true};
   else["inputEcho","permFull","detailTables","viz3d","selftest","charts"].forEach(k=>{ if(S.ui.rptOpts[k]===undefined) S.ui.rptOpts[k]=true; });
+  // AASHTO LRFD 10th Ed. default revision (meta.defRev 1, 2026-10-19): a saved value that still equals the previous tool
+  // default moves to the new default; a value the user edited is kept. What changed is listed once (DEFAULTS_NOTICE).
+  if(!(S.meta.defRev>=1)){
+    const upd=[];
+    const mv=(path,oldV,newV,label)=>{ const v=getPath(S,path); if(v!==undefined&&v!==null&&v!==""&&Math.abs(+v-oldV)<1e-9){ setPath(S,path,newV); upd.push(label+": "+oldV.toFixed(2)+" → "+newV.toFixed(2)); } };
+    mv("factors.gTU",0.50,1.00,"γTU, force effects [T.3.4.1-6]");
+    mv("factors.gCR",0.50,1.00,"γCR/SH, concrete substructure, non-segmental superstructure [T.3.4.1-3]");
+    mv("seismic.phiBEQ",1.00,0.80,"φb bearing at Extreme Event I, semigravity wall [11.5.8]");
+    mv("piles.gDD",1.40,1.10,"γDR drag load, structural strength [T.3.4.1-1 note]");
+    if(S.seismic.eLimEQmode===undefined){
+      if(Math.abs(+S.seismic.eFracEQ-0.3333)<1e-9){ S.seismic.eLimEQmode="aashto"; upd.push("Extreme Event I eccentricity limit: fixed 0.3333·B → B·(1/3 + (0.4 − 1/3)·γEQ) [11.6.5.1]"); }
+      else S.seismic.eLimEQmode="user";   // an edited e/B is kept as a fixed (user) limit
+    }
+    if(S.seismic.zone===undefined){ S.seismic.zone=1; upd.push("Seismic zone (new input for the connection force [3.10.9]) set to Zone 1 — check it against Table 3.10.6-1"); }
+    S.meta.defRev=1;
+    if(upd.length) DEFAULTS_NOTICE=upd;
+  }
 }
 function seedExampleReactions(){
   const ex={DC:{P:85},DW:{P:12},LL:{P:70},BR:{Vx:3.5},TU:{Vx:2.5},CRSH:{Vx:1.5},
@@ -1213,9 +1233,9 @@ function buildInputs(){
       ${inpRow("Resistance factor φ<sub>c</sub>","piles.phiC","–")}
       ${inpRow("Nominal uplift R<sub>n,up</sub>","piles.RnUp","kip")}
       ${inpRow("Resistance factor φ<sub>up</sub>","piles.phiUp","–")}
-      <div class="subhead">Downdrag (DD) [3.11.8, T.3.4.1-2]</div>
-      ${inpRow("Downdrag load per pile","piles.dd","kip",{title:"0 = none. Added to each pile's factored compression demand at γDD; conservatively excluded from uplift relief."})}
-      ${inpRow("γ<sub>DD</sub>","piles.gDD","–")}
+      <div class="subhead">Drag load / downdrag (DR) [3.11.8, T.3.4.1-1]</div>
+      ${inpRow("Drag load per pile DR","piles.dd","kip",{title:"0 = none. Drag load from the neutral-plane analysis (geotechnical report). γDR = 0.00 for geotechnical strength: not added to the φc·Rn check. γDR (below) applies to the structural pile demand P + γDR·DR, reported in Tab 4 §4.4 for the structural pile check. Service (settlement at the neutral plane) is a geotechnical check. Excluded from uplift relief. [3.11.8, T.3.4.1-1 note]"})}
+      ${inpRow("γ<sub>DR</sub> (structural strength)","piles.gDD","–",{title:"1.10 for structural strength; 0.00 for geotechnical strength (fixed) [T.3.4.1-1 note]."})}
       <div class="subhead">Pile section (for punching-shear perimeter)</div>
       ${selRow("Pile shape","piles.pileShape",[["hp","H-pile (square envelope)"],["square","Square / precast"],["round","Round / pipe / drilled"]])}
       ${inpRow("Pile size / diameter","piles.pileSize","in",{title:"Governs the loaded area and the two-way (punching) shear critical perimeter through the footing. [AASHTO 5.12.8.6]"})}
@@ -1239,8 +1259,8 @@ function buildInputs(){
     ${inpRow("γ WL — Strength V","factors.wlS5","–")}
     ${inpRow("Wind speed V for the WS inputs (Strength III)","factors.vWS3","mph",{title:"Blank/0 = WS reactions used unscaled in Strength III, Strength V and Service I (previous behaviour). When entered, Strength V and Service I WS are scaled by (V_LS/V_III)² [Table 3.8.1.1.2-1]."})}
     ${inpRow("&nbsp;&nbsp;Wind speed — Strength V","factors.vWS5","mph")}${inpRow("&nbsp;&nbsp;Wind speed — Service I","factors.vWSsvc","mph")}
-    ${inpRow("γ TU (force effects)","factors.gTU","–",{title:"0.50 for strength force effects in most substructures; 1.20 for deformations. EOR to confirm."})}
-    ${inpRow("γ CR/SH","factors.gCR","–")}
+    ${inpRow("γ TU (force effects)","factors.gTU","–",{title:"1.00 for force effects; 1.20 applies to displacements [T.3.4.1-6]. A reduction of TU force effects belongs in the stiffness (pad G, h_rt), not in this factor (C3.4.1)."})}
+    ${inpRow("γ CR/SH","factors.gCR","–",{title:"1.0 for a concrete substructure supporting a non-segmental superstructure [T.3.4.1-3]. Under a segmental superstructure use γp for DC [T.3.4.1-3]."})}
     <div class="in-note">All factors are editable constants for state-DOT overrides; the engineer of record is responsible for confirming values against the governing edition. Service I uses γ = 1.0 throughout.</div>
   `);
 
@@ -1290,10 +1310,13 @@ function buildInputs(){
       ${inpRow("γ<sub>EQ</sub> on live load","seismic.gEQll","–",{title:"Project-specific per 3.4.1; commonly 0 for abutments, up to 0.5 where live presence during EQ is credible."})}
       <div class="subhead">Extreme-event resistance factors & limits [10.5.5.3, 11.6.5]</div>
       ${inpRow("φ<sub>τ</sub> sliding (EE)","seismic.phiTauEQ","–")}
-      ${inpRow("φ<sub>b</sub> bearing (EE)","seismic.phiBEQ","–")}
-      ${inpRow("φ<sub>c</sub> pile axial (EE)","seismic.phiCEQ","–")}
-      ${inpRow("Eccentricity limit fraction e/B (EE)","seismic.eFracEQ","–",{title:"Commonly ⅓ on soil, 0.45 on rock at Extreme Event. [11.6.5.1]"})}
-    `:`<div class="in-note">OFF — Strength/Service only. The minimum seismic connection force (0.10·DC) remains surfaced as a design note in Tab 3. Enable for sites where SDC > A or where the owner requires an M–O check.</div>`}
+      ${inpRow("φ<sub>b</sub> bearing (EE)","seismic.phiBEQ","–",{title:"0.8 for bearing of gravity and semigravity walls (abutments) at Extreme Event [11.5.8]."})}
+      ${inpRow("φ<sub>c</sub> pile axial (EE)","seismic.phiCEQ","–",{title:"1.0 for compression at Extreme Event [10.5.5.3.3]. Uplift at EE uses the strength φ_up (≤ 0.80 required by 10.5.5.3.3)."})}
+      ${selRow("Eccentricity limit (EE)","seismic.eLimEQmode",[["aashto","Interpolated on γEQ, soil and rock [11.6.5.1]"],["user","Fixed fraction e/B (owner rule)"]],{rebuild:true})}
+      ${S.seismic.eLimEQmode==="user"?inpRow("&nbsp;&nbsp;Eccentricity limit fraction e/B (EE)","seismic.eFracEQ","–",{title:"Owner rule. The 10th Ed. limit is B/3 at γEQ = 0 and 0.4B at γEQ = 1, soil and rock [11.6.5.1]; a larger value is not conservative."}):`<div class="in-note">e<sub>lim</sub> = B·(1/3 + (0.4 − 1/3)·γ<sub>EQ</sub>): B/3 at γ<sub>EQ</sub> = 0, 0.4B at γ<sub>EQ</sub> = 1; permutations without live load use γ<sub>EQ</sub> = 0 [11.6.5.1, 10.6.4.2].</div>`}
+    `:`<div class="in-note">OFF — Strength/Service only. The minimum seismic connection force [3.10.9] remains surfaced as a design note in Tab 3. Enable for sites where SDC > A or where the owner requires an M–O check.</div>`}
+    ${selRow("Seismic zone [T.3.10.6-1]","seismic.zone",[["1","Zone 1 (S_D1 ≤ 0.15)"],["2","Zone 2"],["3","Zone 3"],["4","Zone 4"]])}
+    ${sq.on?"":inpRow("A<sub>s</sub> for the connection force","seismic.As","g",{title:"Zone 1 connection force: 0.15 when A_s < 0.05, else 0.25 [3.10.9.2]; single-span minimum A_s × permanent load [3.10.9.1]."})}
   `);
 
   /* ---- I-12 Assumptions ---- */
@@ -1758,10 +1781,13 @@ function computeAll(){
   }
 
   const STR_LIMITS=["Strength I","Strength III","Strength IV","Strength V","Constr — Str I"].concat(S.seismic.on&&LIMITS["Extreme Event I"]?["Extreme Event I"]:[]);
-  function resFor(lsName){ const eq=LIMITS[lsName]&&LIMITS[lsName].eq;
+  // EE-I eccentricity limit [11.6.5.1]: B·(1/3 + (0.4 − 1/3)·γEQ), soil and rock; γEQ = 0 for a permutation without live load [10.6.4.2]
+  function eFracEQfor(liveOn){ const s=S.seismic; if(s.eLimEQmode==="user") return +s.eFracEQ;
+    const gq=liveOn? Math.min(1,Math.max(0,+s.gEQll||0)) : 0; return 1/3+(0.4-1/3)*gq; }
+  function resFor(lsName,liveOn){ const eq=LIMITS[lsName]&&LIMITS[lsName].eq;
     return { phiTau: eq? +S.seismic.phiTauEQ : fn.phiTau,
              phiB:   eq? +S.seismic.phiBEQ   : fn.phiB,
-             eLim:   eq? (+S.seismic.eFracEQ)*B : B*(fn.matl==="rock"?(+fn.eFracRock||0.45):(+fn.eFracSoil||(1/3))),
+             eLim:   eq? eFracEQfor(liveOn)*B : B*(fn.matl==="rock"?(+fn.eFracRock||0.45):(+fn.eFracSoil||(1/3))),
              phiC:   eq? +S.seismic.phiCEQ   : +S.piles.phiC };
   }
   R.resFor=resFor;
@@ -1788,8 +1814,8 @@ function computeAll(){
     // ---- Eccentricity [11.6.3.3] ----
     let ecc={dc:-1};
     for(const lsName of STR_LIMITS){
-      const eLim=resFor(lsName).eLim;
       for(const pl of permutations(lsName)){
+        const eLim=resFor(lsName,pl.liveOn).eLim;
         const c=comboEffects(lsName,pl.perm,pl.liveOn,true);
         if(c.V<=0) continue;
         const xbar=(c.Mv-c.Mh)/c.V, eS=B/2-xbar, e=Math.abs(eS), dc=e/eLim;   // |e| [11.6.3.3]; eS < 0 = resultant on the heel side
@@ -1892,17 +1918,19 @@ function computeAll(){
       }
       R.pile.perLS=perLS;
 
-      // governing over strength/EE states for capacity checks (per-LS φc; DD added to compression)
-      const p=S.piles, DDf=(+p.gDD||1.4)*(+p.dd||0);
-      let gMax={dcv:-Infinity}, gMin={Pmin:Infinity}, gH={H:-1};
+      // governing over strength/EE states for capacity checks (per-LS φc). Drag load DR: γDR = 0.00 for geotechnical strength,
+      // so it is not added to φc·Rn; γDR (1.10) for structural strength gives the structural pile demand P + γDR·DR [T.3.4.1-1 note, 3.11.8]
+      const p=S.piles, gDR=(p.gDD===undefined||p.gDD===null||p.gDD==="")?1.10:+p.gDD, DR=+p.dd||0, DDf=0;
+      let gMax={dcv:-Infinity}, gMin={Pmin:Infinity}, gH={H:-1}, gStr={P:-Infinity};
       for(const lsName of STR_LIMITS){
         const r=perLS[lsName], phiCls=resFor(lsName).phiC;
+        if(!LIMITS[lsName].eq && r.best.Pmax>gStr.P) gStr={P:r.best.Pmax, ls:lsName, lbl:r.best.c?.lbl};   // structural: strength states (EE-I DR is liquefaction-only [3.11.8])
         const dcv=(r.best.Pmax+DDf)/(phiCls*p.Rn);
         if(dcv>gMax.dcv) gMax={...r.best, ls:lsName, dcv, phiC:phiCls};
         if(r.worstMin.Pmin<gMin.Pmin) gMin={...r.worstMin, ls:lsName};
         if(r.worstH.H>gH.H) gH={...r.worstH, ls:lsName};
       }
-      R.checks.pileComp={dc:gMax.dcv, P:gMax.Pmax, DD:DDf, pile:actIndexToNo(act,gMax.iMax),
+      R.checks.pileComp={dc:gMax.dcv, P:gMax.Pmax, DD:DDf, DR, gDR, Pstr:gStr.P+gDR*DR, PstrTop:gStr.P, PstrLs:gStr.ls, PstrLbl:gStr.lbl, pile:actIndexToNo(act,gMax.iMax),
         RR:gMax.phiC*p.Rn, phiC:gMax.phiC, lbl:gMax.c?.lbl, ls:gMax.ls, det:gMax};
       const uplift=gMin.Pmin<0;
       R.checks.pileUplift={dc:uplift? -gMin.Pmin/(p.phiUp*p.RnUp):0, P:gMin.Pmin, uplift,
@@ -1927,8 +1955,14 @@ function computeAll(){
   const Nreq=(8+0.02*g.spanL+0.08*Hsup)*(1+0.000125*g.skew*g.skew); // in [4.7.4.4]
   const Nprov=seatW*12-0;   // seat width in inches
   R.checks.seat={dc:Nreq/Nprov, Nreq, Nprov, Hsup, HsupMode};
-  const Fconn=0.10*(agg.DC.P+agg.DW.P);
-  R.seismic={Fconn, perBeam:0.10*(agg.DC.P/Math.max(1,S.beams.N)+agg.DW.P/Math.max(1,S.beams.N)), trib:agg.DC.P+agg.DW.P};
+  // Minimum seismic connection force (each restrained direction) [3.10.9]:
+  //   Zone 1: c·(permanent + γEQ·LL) reaction, c = 0.15 when A_s < 0.05, else 0.25 [3.10.9.2];
+  //   single-span bridges, any zone: ≥ A_s × permanent reaction [3.10.9.1, 4.7.4.2] (taken as a floor here in every zone, conservative for multispan);
+  //   Zones 2–4: the connection force comes from the seismic analysis [3.10.9.3, 3.10.9.4]; only the 3.10.9.1 floor is computed.
+  const zone=Math.min(4,Math.max(1,Math.round(+S.seismic.zone||1))), AsC=Math.max(0,+S.seismic.As||0), gEQc=Math.max(0,+S.seismic.gEQll||0);
+  const Wperm=agg.DC.P+agg.DW.P, Wtrib=Wperm+gEQc*agg.LL.P, cZ1=AsC<0.05?0.15:0.25;
+  const F1=zone===1? cZ1*Wtrib : 0, F0=AsC*Wperm, Fconn=Math.max(F1,F0);
+  R.seismic={Fconn, perBeam:Fconn/Math.max(1,S.beams.N), trib:Wperm, Wtrib, zone, As:AsC, gEQ:gEQc, cZ1, F1, F0, LL:agg.LL.P};
 
   /* ===== C-10 Structural concrete checks ===== */
   const kah=ka*Math.cos(deg2rad(iota)); // horizontal pressure coefficient used on wall faces
@@ -2552,7 +2586,8 @@ function computeAll(){
       ["factors.gpDCmaxS4",1.50,"γDC max Strength IV [T.3.4.1-2]"],
       ["factors.llS1",1.75,"γLL Strength I [T.3.4.1-1]"],["factors.llS5",1.35,"γLL Strength V [T.3.4.1-1]"],
       ["factors.wsS3",1.40,"γWS Strength III (design basis)"],["factors.wsS5",1.00,"γWS Strength V"],
-      ["factors.wlS5",1.00,"γWL Strength V"],["factors.gTU",0.50,"γTU (force effects)"],["factors.gCR",0.50,"γCR/SH"],
+      ["factors.wlS5",1.00,"γWL Strength V"],["factors.gTU",1.00,"γTU (force effects) [T.3.4.1-6]"],["factors.gCR",1.00,"γCR/SH [T.3.4.1-3]"],
+      ["piles.gDD",1.10,"γDR drag load, structural [T.3.4.1-1 note]"],["seismic.phiBEQ",0.80,"φb bearing, Extreme Event I [11.5.8]"],
       ["fnd.phiTau",0.80,"φτ sliding [T.10.5.5.2.2-1]"],["fnd.phiEP",0.50,"φep passive"],
       ["fnd.phiB",0.45,"φb bearing [10.5.5.2.2] (tool default)"],
       ["piles.phiC",0.70,"φc pile compression (tool default; method-dependent)"],
@@ -2713,7 +2748,9 @@ function renderWarnings(){
   const el=document.getElementById("warnbox");
   let h=WARNINGS.map(w=>`<div class="warn-item ${w.level==="err"?"err":""}"><b>${w.level==="err"?"⛔":"⚠"}</b> ${esc(w.msg)}</div>`).join("");
   if(window.LIBWARN) h=`<div class="warn-item">⚠ ${esc(window.LIBWARN)}</div>`+h;
+  if(DEFAULTS_NOTICE&&DEFAULTS_NOTICE.length) h=`<div class="warn-item" id="defNotice"><b>ℹ</b> This project was saved with earlier tool defaults. These values still equalled the old default and were updated to AASHTO LRFD 10th Ed. (values you had edited are kept): <ul style="margin:2px 0 2px 18px;padding:0">${DEFAULTS_NOTICE.map(t=>`<li>${esc(t)}</li>`).join("")}</ul><button class="mini-btn" id="btnDefNoticeOk">OK</button></div>`+h;
   el.innerHTML=h;
+  const ok=document.getElementById("btnDefNoticeOk"); if(ok) ok.addEventListener("click",()=>{ DEFAULTS_NOTICE=null; renderWarnings(); });
 }
 
 /* ---------------- Tabs ---------------- */
@@ -2755,8 +2792,8 @@ function renderTabLoads(R){
     <b>8.</b> V&amp;M diagrams: limit states use the design bearing distribution; individual loads use elastic (tension-allowed) superposition — the two intentionally differ for the footing.<br>
     <b>9.</b> Structural: 1-ft strips; strain-based φ per 5.5.4.2; footing crack-control service moments from Service I directly (linear contact pressure / pile reactions).<br>
     <b>10.</b> Construction stage: "Constr — Str I" checks the backfilled wall with <b>no superstructure</b> (fill height ${(+S.constr.hFill>0)?fmt(Math.min(+S.constr.hFill,S.geom.soilH),1)+" ft":"= full"}, dry, γ<sub>LL</sub> = ${fmt(+S.constr.gLL||0)}). If it fails, restrict backfill until erection or revise the design.<br>
-    <b>11.</b> Seismic: ${S.seismic.on?`<b>Extreme Event I ON</b> — M–O with k<sub>h</sub> = ${fmt(+S.seismic.khR,2)}·A<sub>s</sub>, ΔP<sub>AE</sub> at ${fmt(+S.seismic.hEQr,2)}H, wall/soil/superstructure inertia included; EE resistance factors per panel I-11`:`OFF — minimum connection force (0.10·DC) surfaced as a note only`}.<br>
-    <b>12.</b> Scour: ${S.fnd.scour?"<b>ON</b> — passive resistance eliminated; q<sub>n</sub> at scoured overburden":"not active"}. Earth surcharge ES = ${fmt(+S.soil.esQ||0,2)} ksf; pile downdrag DD = ${fmt(+S.piles.dd||0,0)} kip/pile.<br>
+    <b>11.</b> Seismic: ${S.seismic.on?`<b>Extreme Event I ON</b> — M–O with k<sub>h</sub> = ${fmt(+S.seismic.khR,2)}·A<sub>s</sub>, ΔP<sub>AE</sub> at ${fmt(+S.seismic.hEQr,2)}H, wall/soil/superstructure inertia included; EE resistance factors per panel I-11`:`OFF — minimum connection force [3.10.9] surfaced as a note only`}.<br>
+    <b>12.</b> Scour: ${S.fnd.scour?"<b>ON</b> — passive resistance eliminated; q<sub>n</sub> at scoured overburden":"not active"}. Earth surcharge ES = ${fmt(+S.soil.esQ||0,2)} ksf; pile drag load DR = ${fmt(+S.piles.dd||0,0)} kip/pile (γ<sub>DR</sub> = 0 for the geotechnical pile check, ${fmt(+S.piles.gDD,2)} for the structural demand [T.3.4.1-1 note]).<br>
     <b>13.</b> Out of scope / user-side: wingwalls, pile structural (member) design, wind attack-angle sweep (enter the governing directional WS/WL combination), metric units, settlement and global stability (flagged to geotechnical), bearing pad design.<br>
     <b>Sign conventions:</b> X longitudinal (+ driving toward toe), Y transverse, P vertical +down; moments about the toe [design basis §0.3].
     </div>`);
@@ -2943,7 +2980,7 @@ function renderTabComb(R){
   }
   ft+="</table>";
   h+=panel("o-facttbl","2.1","Load Factors In Use (editable constants) [Tables 3.4.1-1, 3.4.1-2]",ft+
-    `<div class="note-box">γ<sub>p</sub> values show max / min. BR and LS carry the live-load factor. TU/CR/SH use γ = ${fmt(+F.gTU)} for strength force effects (1.20 applies to deformations) — EOR to confirm per project.</div>`);
+    `<div class="note-box">γ<sub>p</sub> values show max / min. BR and LS carry the live-load factor. TU uses γ<sub>TU</sub> = ${fmt(+F.gTU)} for strength force effects (1.20 applies to displacements) [T.3.4.1-6]; CR/SH use γ = ${fmt(+F.gCR)} (concrete substructure under a non-segmental superstructure) [T.3.4.1-3].</div>`);
   h+=panel("o-permlogic","2.2","γp Max/Min Permutation Logic [3.4.1]",`
     <div class="note-box">Each permanent load class (DC, DW, EV, EH) is factored at <b>both</b> its maximum and minimum bound — 16 permutations per limit state, each evaluated with live load present and absent (Strength III has no live load). For each individual check the engine selects the permutation producing the <b>worst</b> demand for that check, and reports the governing factor set. No single global load case is assumed.</div>
     <table class="rtbl"><tr><th>Check</th><th>Vertical DC/EV/DW</th><th>Lateral EH/LS</th><th>Rationale</th></tr>
@@ -3042,7 +3079,9 @@ function renderTabStab(R){
         `\\bar{x} = \\dfrac{${fmtT(ec.Mv)} - ${fmtT(ec.Mh)}}{${fmtT(ec.V)}} = ${fmtT(ec.xbar)}\\ \\text{ft}`,
         `e = \\dfrac{${fmtT(geo.B)}}{2} - ${fmtT(ec.xbar)} = ${fmtT(ec.eSigned)}\\ \\text{ft}\\,, \\qquad |e| = ${fmtT(ec.e)}\\ \\text{ft}\\ (\\text{resultant on the ${ec.side} side})`])}
       ${eqB(`Limit for founding material: ${fn.matl}${LIMITS_HAS_EQ(R)?" (EE-I uses the extreme-event fraction)":""}`,"AASHTO 11.6.3.3, 11.6.5.1",[
-        `e_{lim} = ${fmtT(ec.eLim)}\\ \\text{ft} \\quad(${(R.LIMITS[ec.ls]&&R.LIMITS[ec.ls].eq)?`${fmt(+S.seismic.eFracEQ,3)}·B \\text{ at EE-I}`:`${fmtT(fn.matl==="rock"?+fn.eFracRock:+fn.eFracSoil,3)}\\,B \\text{ at Strength — middle ${fn.matl==="rock"?"nine-tenths":"two-thirds"}}`})`])}
+        ...((R.LIMITS[ec.ls]&&R.LIMITS[ec.ls].eq&&S.seismic.eLimEQmode!=="user")?["e_{lim} = B\\left(\\tfrac{1}{3} + \\left(0.4 - \\tfrac{1}{3}\\right)\\gamma_{EQ}\\right)",
+          `e_{lim} = ${fmtT(geo.B)}\\left(\\tfrac{1}{3} + \\left(0.4 - \\tfrac{1}{3}\\right)(${fmtT(ec.c&&ec.c.liveOn?Math.min(1,Math.max(0,+S.seismic.gEQll||0)):0)})\\right) \\quad (\\gamma_{EQ}${ec.c&&ec.c.liveOn?"\\text{ as entered}":" = 0\\text{: permutation without live load}"})`]:[]),
+        `e_{lim} = ${fmtT(ec.eLim)}\\ \\text{ft} \\quad(${(R.LIMITS[ec.ls]&&R.LIMITS[ec.ls].eq)?(S.seismic.eLimEQmode==="user"?`${fmt(+S.seismic.eFracEQ,3)}·B \\text{ at EE-I (owner rule)}`:`${fmtT(ec.eLim/geo.B,4)}\\,B \\text{ at EE-I}`):`${fmtT(fn.matl==="rock"?+fn.eFracRock:+fn.eFracSoil,3)}\\,B \\text{ at Strength — middle ${fn.matl==="rock"?"nine-tenths":"two-thirds"}}`})`])}
       ${checkLine("Eccentricity",`\\dfrac{|e|}{e_{lim}} = \\dfrac{${fmtT(ec.e)}}{${fmtT(ec.eLim)}}`,ec.dc)}
     `);
     const bc=R.checks.bearing;
@@ -3115,13 +3154,20 @@ function renderTabStab(R){
         "Superstructure inertia uses the full A_s (restrained by keepers) and the thermal-path share; EOR to confirm the distribution for the actual bearing/keeper layout. EE-I resistance factors and the e/B limit are editable in panel I-11.")}
     `);
   }
-  h+=panel("o-seis","3.6","Minimum Seismic Connection Force — Design Note [3.10.9.2 / MassDOT]",`
+  const sz=R.seismic;
+  h+=panel("o-seis","3.6","Minimum Seismic Connection Force — Design Note [3.10.9 / MassDOT]",`
     <div class="note-box">${S.seismic.on?"In addition to the Extreme Event I analysis above,":"Extreme Event I is currently OFF (enable in panel I-11), but"} MassDOT floating bridges require the superstructure–substructure connection (shear keys, keeper blocks, anchor bolts) to resist a minimum horizontal force in each restrained direction:</div>
-    ${eqB("Minimum connection force (each restrained direction)","AASHTO 3.10.9.2",[
-      "F_{conn} = 0.10\\,(\\Sigma P_{DC} + \\Sigma P_{DW})",
-      `F_{conn} = 0.10\\,(${fmtT(R.groups.DCsup.V)} + ${fmtT(R.groups.DW.V)})`,
-      `F_{conn} = ${fmtT(R.seismic.Fconn)}\\ \\text{kip per bearing line} \\quad(${fmtT(R.seismic.perBeam)}\\ \\text{kip per beam})`],
-      "Applies to backwall shear keys, keeper blocks and anchor bolts. Not run as a full Extreme Event combination in v1.")}
+    ${eqB("Minimum connection force (each restrained direction) — Seismic Zone "+sz.zone,"AASHTO 3.10.9.1, 3.10.9.2",[
+      ...(sz.zone===1?[
+      "F_{Z1} = c\\,(\\Sigma P_{DC} + \\Sigma P_{DW} + \\gamma_{EQ}\\,\\Sigma P_{LL}), \\quad c = 0.15 \\text{ if } A_s < 0.05,\\ \\text{else } 0.25 \\quad [3.10.9.2]",
+      `F_{Z1} = ${fmtT(sz.cZ1)}\\,(${fmtT(R.groups.DCsup.V)} + ${fmtT(R.groups.DW.V)} + (${fmtT(sz.gEQ)})(${fmtT(sz.LL)})) = ${fmtT(sz.F1)}\\ \\text{kip} \\quad (A_s = ${fmtT(sz.As,3)})`]:[]),
+      "F_{1span} = A_s\\,(\\Sigma P_{DC} + \\Sigma P_{DW}) \\quad [3.10.9.1,\\ \\text{single-span bridges, any zone}]",
+      `F_{1span} = (${fmtT(sz.As,3)})(${fmtT(R.groups.DCsup.V)} + ${fmtT(R.groups.DW.V)}) = ${fmtT(sz.F0)}\\ \\text{kip}`,
+      sz.zone===1?`F_{conn} = \\max(F_{Z1},\\,F_{1span}) = ${fmtT(sz.Fconn)}\\ \\text{kip per bearing line} \\quad(${fmtT(sz.perBeam)}\\ \\text{kip per beam})`
+                 :`F_{conn} \\ge F_{1span} = ${fmtT(sz.Fconn)}\\ \\text{kip per bearing line} \\quad(${fmtT(sz.perBeam)}\\ \\text{kip per beam})`],
+      "Applies to backwall shear keys, keeper blocks and anchor bolts. Not run as a full Extreme Event combination in v1. "
+      +(sz.zone===1?"The single-span minimum is applied as a floor (conservative for a multispan bridge). ":"<b>Zone "+sz.zone+": the connection design force comes from the seismic analysis [3.10.9.3, 3.10.9.4, 4.7.4.3]; this tool computes only the single-span minimum A_s × permanent load [3.10.9.1, 4.7.4.2].</b> ")
+      +"γ_EQ = live load assumed present during the earthquake (panel I-11). Zone and A_s are set in panel I-11 [T.3.10.6-1].")}
   `);
   h+=panel("o-tornado","3.8","Sensitivity — Governing D/C vs ±10% Input Perturbation",`
     <div class="eq-note">Each listed input is perturbed ±10% and the worst (governing) D/C across all checks is re-computed with the full engine. Long bars = the design is sensitive to that parameter; verify it carefully with the geotechnical report. Runs on demand.</div>
@@ -3180,8 +3226,14 @@ function renderTabFound(R){
     ${abutWorkedIn([["tab-found","o-pileform","4.2 Axial Pile Reactions","P_max"],["tab-found","o-pilels","4.3 Pile Reactions per Limit State","P_min"]])}
     ${eqB("Compression","AASHTO 10.7.3.8 / 10.5.5.2.3",[
       "P_{max} \\le \\varphi_c R_n",
-      `${fmtT(pc.P)} \\le (${fmtT(p.phiC)})(${fmtT(p.Rn)}) = ${fmtT(pc.RR)}\\ \\text{kip}`])}
+      `${fmtT(pc.P)} \\le (${fmtT(pc.phiC)})(${fmtT(p.Rn)}) = ${fmtT(pc.RR)}\\ \\text{kip}`],
+      pc.DR>0?"Drag load DR is not added here: γ_DR = 0.00 for geotechnical strength [T.3.4.1-1 note, 3.11.8]. The geotechnical engineer checks the neutral plane and the settlement at the service limit state.":"")}
     ${checkLine("Pile compression (pile "+pc.pile+")",`\\dfrac{P_{max}}{\\varphi_c R_n} = \\dfrac{${fmtT(pc.P)}}{${fmtT(pc.RR)}}`,pc.dc)}
+    ${pc.DR>0?eqB("Structural pile axial demand with drag load (for the pile structural check, not made in this tool)","AASHTO T.3.4.1-1 note, 3.11.8",[
+      "P_{u,str} = P_{max,Str} + \\gamma_{DR}\\,DR",
+      `P_{u,str} = ${fmtT(pc.PstrTop)} + (${fmtT(pc.gDR)})(${fmtT(pc.DR)}) = ${fmtT(pc.Pstr)}\\ \\text{kip}`],
+      "P_max,Str = largest pile reaction of the strength states ("+esc(pc.PstrLs||"")+": "+esc(pc.PstrLbl||"")+"). Applies at the neutral plane; compare with the structural resistance of the pile [10.7.3.13].")
+      :""}
     ${pu.uplift?`
       ${govNote(pu.lbl+" — "+pu.ls)}
       ${eqB("Uplift (tension present)","AASHTO 10.7.3.10",[
@@ -4269,7 +4321,7 @@ async function captureD3(R){
    Runs the frozen benchmark input (the hand-verified built-in example) through the
    LIVE engine and compares key results to baked expected values. Any drift means a
    regression (or an intentional change that requires re-baking). */
-window.__ST_EXPECT={"k_a (Rankine)": 0.3072585245224683, "P_a (kip/ft)": 8.92278755213248, "EH_h total (kip)": 392.6026522938291, "ΣDC wall (kip)": 722.6999999999999, "EV (kip)": 501.5999999999999, "h_eq (ft)": 2, "Sliding D/C": 1.1527595856623034, "Sliding R_R (kip)": 510.8645252361067, "Eccentricity e (ft)": 2.465267469172704, "Bearing q_f (ksf)": 7.502750812839938, "Bearing D/C": 0.9262655324493752, "Seat N_req (in)": 11.12, "Stem M_u (kip·ft/ft)": 110.15268922678449, "Stem φM_n (kip·ft/ft)": 302.7336470588236, "Shear-friction D/C": 0.05702500795507431, "Bearing-seat q_b (ksi)": 0.5711805555555556};
+window.__ST_EXPECT={"k_a (Rankine)": 0.3072585245224683, "P_a (kip/ft)": 8.92278755213248, "EH_h total (kip)": 392.6026522938291, "ΣDC wall (kip)": 722.6999999999999, "EV (kip)": 501.5999999999999, "h_eq (ft)": 2, "Sliding D/C": 1.1527595856623034, "Sliding R_R (kip)": 510.8645252361067, "Eccentricity e (ft)": 2.507894818378456, "Bearing q_f (ksf)": 7.560165332011858, "Bearing D/C": 0.933353744692822, "Seat N_req (in)": 11.12, "Stem M_u (kip·ft/ft)": 112.0617801358754, "Stem φM_n (kip·ft/ft)": 302.7336470588236, "Shear-friction D/C": 0.05761809346762622, "Bearing-seat q_b (ksi)": 0.5711805555555556};
 /* Baked from the hand-verified built-in example (Rankine ka, Pa, EHh, sliding, bearing, stem Mu
    each independently hand-checked during validation). If the engine or the built-in defaults are
    intentionally changed, re-validate by hand and re-bake these values. */
@@ -4416,8 +4468,8 @@ function flattenState(o,pre,out){
   return out;
 }
 function computeFor(state){
-  const saved=S;
-  S=Object.assign(defaultState(),clone(state)); migrate();
+  const saved=S, savedNotice=DEFAULTS_NOTICE;
+  S=Object.assign(defaultState(),clone(state)); migrate(); DEFAULTS_NOTICE=savedNotice;   // compare runs never raise the defaults notice
   let R=null, err=null;
   try{ R=computeAll(); }catch(e){ err=e.message; }
   const res=R?{fp:R.fingerprint, dash:R.dash.map(d=>({name:d.name,dc:d.dc,pass:d.pass}))}:{err};
@@ -4824,7 +4876,7 @@ function inputEchoHTML(){
     ["Earth surcharge ES",fmt(+s.esQ||0,2),"ksf"],
     ["Construction stage (fill / γLL)",((+S.constr.hFill>0)?fmt(+S.constr.hFill,1):"full")+" / "+fmt(+S.constr.gLL||0),"ft / –"]]);
   h+="<h3>Seismic / scour</h3>"+echoRows([
-    ["Extreme Event I",S.seismic.on?("ON — As="+fmt(+S.seismic.As,3)+", kh="+fmt(+S.seismic.khR,2)+"·As, kv="+fmt(+S.seismic.kv,2)+", ΔPAE @ "+fmt(+S.seismic.hEQr,2)+"H; φτ/φb/φc(EE)="+fmt(+S.seismic.phiTauEQ,2)+"/"+fmt(+S.seismic.phiBEQ,2)+"/"+fmt(+S.seismic.phiCEQ,2)+", e/B ≤ "+fmt(+S.seismic.eFracEQ,3)+", γEH(EE) = "+(eqEHfixed()!==null?fmt(eqEHfixed(),2)+" (agency policy)":"γp max/min")):"OFF",""],
+    ["Extreme Event I",S.seismic.on?("ON — As="+fmt(+S.seismic.As,3)+", kh="+fmt(+S.seismic.khR,2)+"·As, kv="+fmt(+S.seismic.kv,2)+", ΔPAE @ "+fmt(+S.seismic.hEQr,2)+"H; φτ/φb/φc(EE)="+fmt(+S.seismic.phiTauEQ,2)+"/"+fmt(+S.seismic.phiBEQ,2)+"/"+fmt(+S.seismic.phiCEQ,2)+", e/B ≤ "+(S.seismic.eLimEQmode==="user"?fmt(+S.seismic.eFracEQ,3)+" (owner rule)":"1/3 + (0.4 − 1/3)·γEQ [11.6.5.1]")+", γEH(EE) = "+(eqEHfixed()!==null?fmt(eqEHfixed(),2)+" (agency policy)":"γp max/min")):"OFF",""],
     ["Scour condition",f.scour?"ON — passive eliminated; qn at scoured grade":"off",""]]);
   h+="<h3>Foundation</h3>"+echoRows(f.branch==="spread"?[
     ["Branch","Spread footing on "+f.matl,""],
@@ -4838,7 +4890,7 @@ function inputEchoHTML(){
     ["Rn / φc",fmt(p.Rn)+" / "+fmt(p.phiC),"kip / –"],
     ["Rn,up / φup",fmt(p.RnUp)+" / "+fmt(p.phiUp),"kip / –"],
     ["Pile section (punching)",(p.pileShape||"hp")+", "+fmt(p.pileSize,1)+" in",""],
-    ["Downdrag DD / γDD",fmt(+p.dd||0,0)+" / "+fmt(+p.gDD||1.4,2),"kip / –"]]);
+    ["Drag load DR / γDR (structural; 0 geotechnical)",fmt(+p.dd||0,0)+" / "+fmt(+p.gDD,2),"kip / –"]]);
   h+="<h3>Longitudinal distribution</h3>"+echoRows([
     ["Model",d.model,""],["Shares BR / TU / CR-SH / WSx",
       d.model==="fixed"?"100% each":fmt(+d.shBR,0)+"% / "+fmt(+d.shTU,0)+"% / "+fmt(+d.shCR,0)+"% / "+fmt(+d.shWS,0)+"%",""]]);
@@ -4938,7 +4990,7 @@ async function buildReport(){
   let key=`<table class="rtbl"><tr><th style="width:45%">Key result</th><th>Value</th><th>Worked in</th></tr>
     <tr><td class="lft"><b>Governing check</b></td><td class="lft"><b>${g1?g1.name+" — D/C "+fmt(g1.dc)+" ("+(g1.pass?"PASS":"FAIL")+")":"—"}</b></td><td>${g1?wk(g1.tab,DASH_ANCHOR[g1.id]):""}</td></tr>`;
   if(S.fnd.branch==="spread"&&R.checks.bearing){ key+=`<tr><td class="lft">Max factored bearing pressure vs φ·qn</td><td>${fmt(R.checks.bearing.q)} vs ${fmt(S.fnd.phiB*S.fnd.qn)} ksf</td><td>${wk("tab-stab","o-brg")}</td></tr>
-    <tr><td class="lft">Eccentricity vs limit</td><td>${fmt(R.checks.ecc.e)} vs ${fmt(R.checks.ecc.eLim)} ft (e ≤ ${fmt(S.fnd.matl==="rock"?+S.fnd.eFracRock:+S.fnd.eFracSoil,3)}·B)</td><td>${wk("tab-stab","o-ecc")}</td></tr>
+    <tr><td class="lft">Eccentricity vs limit</td><td>${fmt(R.checks.ecc.e)} vs ${fmt(R.checks.ecc.eLim)} ft (e ≤ ${fmt(R.checks.ecc.eLim/R.geo.B,3)}·B)</td><td>${wk("tab-stab","o-ecc")}</td></tr>
     <tr><td class="lft">Sliding demand vs resistance</td><td>${fmt(R.checks.sliding.D)} vs ${fmt(R.checks.sliding.RR)} kip</td><td>${wk("tab-stab","o-slide")}</td></tr>`; }
   else if(R.checks.pileComp){ key+=`<tr><td class="lft">Max / min pile reaction vs φRn</td><td>${fmt(R.checks.pileComp.P)} / ${fmt(R.checks.pileUplift.P)} vs ${fmt(R.checks.pileComp.RR)} kip</td><td>${wk("tab-found","o-pilecap")}</td></tr>`; }
   key+=`<tr><td class="lft">Stem base: Mu vs φMn</td><td>${fmt(R.checks.stemFlex.Mu)} vs ${fmt(R.checks.stemFlex.phiMn)} kip·ft/ft</td><td>${wk("tab-struct","o-str-Stem")}</td></tr>
@@ -5128,6 +5180,7 @@ function init(){
   }catch(e){}
   if(fresh){ seedExampleReactions(); }
   migrate();
+  if(DEFAULTS_NOTICE) scheduleSave();   // keep the migrated values (and meta.defRev) so the notice shows once
   buildTabs();
   buildInputs();
   refreshProjHeader();
@@ -5324,7 +5377,7 @@ document.addEventListener("DOMContentLoaded",init);
     u.push(["TU Vy and the "+(st.tu==="rise"?"fall":st.tu==="fall"?"rise":"other (rise or fall)")+" case","the calculator's TU row is Vx only, one direction"]);
     u.push(["FR (bearing friction)","the calculator has no FR row"]);
     u.push(["SH P and Vy","the calculator's CR/SH row is Vx only"]);
-    u.push(["EQ (superstructure seismic force"+(L.EQ&&L.EQ.basis?", "+L.EQ.basis:"")+")","the calculator computes its own superstructure inertia A_s·(DC+DW)·share for Extreme Event I and its own seat connection force 0.10·(DC+DW); SubLoads' basis (3.10.9.2 0.15/0.25 or elastic) differs, so it is not imported"]);
+    u.push(["EQ (superstructure seismic force"+(L.EQ&&L.EQ.basis?", "+L.EQ.basis:"")+")","the calculator computes its own superstructure inertia A_s·(DC+DW)·share for Extreme Event I and its own seat connection force per 3.10.9 (Zone 1: 0.15/0.25; single-span floor A_s·(DC+DW)); SubLoads' value is not imported"]);
     u.push(["Approach slab reaction",L.approachSlab?"the calculator has no approach slab load; NOT imported":"none sent"]);
     u.push(["Bearing fixity, type, height, pedestal, seat and girder elevations; girder stations; unit station","no matching calculator input (the calculator works from the bridge seat)"]);
     u.push(["Footing width, deck / seat / ground elevations","the calculator derives B = toe + stem + heel and uses heights, not elevations"]);
```

## 2026-10-19 — PR: claude/abut-defects-calc — stability live-load case, batter centroid, stem M_s, support length, EDM count, seat A₂ (PR link added after merge)

Branched from claude/abut-defects-factors (F27–F32); the numbers "before" below are that branch (`b8da0d5`), "after" this branch. Review defects N1, N2, N3, N5, N6, N9, as the engineer approved. Basis: AASHTO LRFD 10th Ed. (2024), checked against the text (Table 4.7.4.4-1, 5.6.5 and Fig. 5.6.5-1 read from the rendered pages). Results come from the real `computeAll()` in headless Chromium. The exact edits are in the appendix as a unified diff against `b8da0d5`. Default project as in F27.

### F33. Sliding, eccentricity, pile minimum reaction, foundation hand-off: LS + BR with the girder LL reaction off (N1)   [calc change] [MORE conservative]
- **Where:** `comboEffects` (anchor `liveOn 2: LS and BR on, girder LL reaction off`), `permutations(lsName,stab)` (anchor `stab = true (sliding, eccentricity, pile minimum reaction, foundation hand-off)`); the sliding and eccentricity loops and the permutation tables call `permutations(lsName,true)`; the pile loop uses the new case for `worstMin` only (`pl.liveOn!==2` guards `best` and `worstH`); foundation hand-off `cases()` uses it and adds "H/V max" and "|e| max" for a spread footing; e_lim (F30) uses γEQ only with `liveOn===1`; Tab 2 "Live" column shows "LS, BR only"; Tab 3 §3.1/§3.2 and Tab 4 §4.4 notes say which case governs. Bearing and the maximum pile reaction keep live load on/off only, as before.
- **Before:** `else if(gr.cls==="LL") gamma = liveOn ? L.LL : 0;` and `const lives=L.liveOpt?[1,0]:[0];` (LL reaction, BR, LSh and LSv share one switch).
- **After:**
  ```js
  else if(gr.cls==="LL") gamma = liveOn ? ((liveOn===2&&k==="LL")? 0 : L.LL) : 0;
  function* permutations(lsName,stab){ … const lives=L.liveOpt?((stab&&L.perm&&!L.noSuper)?[1,2,0]:[1,0]):[0]; …
  ```
- **Provision:** AASHTO LRFD 10th Ed. C11.5.6 (live load on the bridge abutment counted for bearing and structural design, not for eccentricity and sliding) and Art. 3.4.1 (each load at the value that is least favourable; a transient load that relieves takes γ = 0).
- **Check case (default project, Strength I, γp 0.90DC + 0.65DW + 1.00EV + 1.50EH, LSv excluded):** girder LL reaction 6·70 = 420 kip at x_brg = 3.5 + 4.5 − 1.5 − 1.25 = 5.25 ft from the toe; 1.75·420 = 735.0 kip, 735.0·5.25 = 3858.75 kip-ft.
  - Eccentricity, before (LL on): V = 2392.83, ΣM_V = 15761.54, ΣM_H = 6209.11 → x̄ = 3.9921, e = 2.508 ft, D/C = 2.508/4.333 = **0.579**.
  - After (LL reaction off): V = 2392.83 − 735.0 = 1657.83; ΣM_V = 15761.54 − 3858.75 = 11902.79 → x̄ = (11902.79 − 6209.11)/1657.83 = 3.4344, e = 6.5 − 3.4344 = **3.066 ft**, D/C = **0.707** (governs eccentricity).
  - Sliding, Strength I: H = 744.20 kip; R_R = 0.80·V·tan 29°: LL on 0.80·2392.83·0.5543 = 1061.09 → 0.701; LL off 0.80·1657.83·0.5543 = 735.16 → **1.012**. The dashboard sliding D/C stays 1.153 (Constr — Str I governs).
  - Pile minimum reaction (default project, piles; n = 24, Σx′² = 289 ft²): case 1.75(BR,LS) with the LL reaction off, LSv included as in the pile check: V = 1750.23 kip, M_y = −4712.62 kip-ft; P_min = 1750.23/24 + (−4712.62)(4.25)/289 = 72.93 − 69.30 = **3.62 kip** (before 10.36 kip, Constr — Str I). No uplift in either.
  - Foundation hand-off (spread): new case "Strength I — H/V max, |e| max (no heel LS)": P = 1657.83, Vx = 744.20, My = 5082.22 kip-ft (|My|/P = 3.066 ft = the eccentricity case).

### F34. Stem front-batter triangle centroid: L_toe + 2·t_w/3 (was L_toe + |t_w|/3) (N2)   [calc change] [mixed: depends on the side of the resultant]
- **Where:** `computeAll` C-2, anchor `const xtri=g.Ltoe+2*tw/3;`.
- **Geometry convention verified:** x is measured from the toe; the stem back face is vertical at L_toe + t_sb; the front face runs from (L_toe, top of footing) to (L_toe + t_w, top of stem), t_w = t_sb − t_st (`drawXsec` draws the same polygon); the rectangular core spans L_toe + t_w … L_toe + t_sb. The batter triangle is (L_toe, 0)–(L_toe + t_w, 0)–(L_toe + t_w, h_stem), centroid x = L_toe + 2t_w/3, y = h_stem/3 (the same formula holds for t_w < 0, where the triangle is subtracted).
- **Before:** `const xtri=g.Ltoe+Math.abs(tw)/3; // triangle at front, wide at bottom`
- **After:** `const xtri=g.Ltoe+2*tw/3;`
- **Provision:** statics (no AASHTO change).
- **Check case (default project with t_st = 3, t_sb = 6 ft):** t_w = 3 ft, W = 3·14/2·0.150·44 = 138.6 kip; x: 3.5 + 1.0 = 4.50 → 3.5 + 2.0 = **5.50 ft**; ΣW·x +138.6 kip-ft.
  - Stem M_u (Strength I, γDC 0.90 governs M_ecc): ΔM = 0.90·138.6·1.0/44 = 2.835 → 89.36 → **86.53 kip-ft/ft**; Service M_s 55.54 → **52.39** (−138.6/44 = −3.15).
  - The default project (t_st = t_sb) is unchanged.

### F35. Stem crack-control M_s includes the earth surcharge ES (N3)   [calc change] [MORE conservative]
- **Where:** `computeAll`, anchor `const MsStem=Mst_EH+Mst_LS+Mst_ES+HgirdSvc*g.hstem+MeccSvc;`; `R.stemDem.Mst_ES` added; Tab 5 §5.2 shows M_s worked (symbolic → substituted → result).
- **Before:** `const MsStem=Mst_EH+Mst_LS+HgirdSvc*g.hstem+MeccSvc;`
- **After:** `const MsStem=Mst_EH+Mst_LS+Mst_ES+HgirdSvc*g.hstem+MeccSvc;`
- **Provision:** AASHTO LRFD 10th Ed. Art. 5.6.7 (crack control at the Service I load combination, Table 3.4.1-1, which includes ES at 1.00).
- **Check case (default project with ES = 0.5 ksf):** M_ES = k_ah·q·H_s²/2 = 0.30726·0.5·19²/2 = 27.73 kip-ft/ft. M_s 74.79 → **102.52 kip-ft/ft**; f_ss 13.83 → 18.96 ksi; s_max 42.1 → 29.3 in; crack-control ratio 0.214 → **0.307**.
  - The Service I V&M diagram at the stem base gives 101.60 kip-ft/ft. The remaining 0.92 is not ES: the stem design uses h_eq at its own height (19 ft → 2.10 ft) where the diagram uses the footing-base h_eq (2.0 ft), 0.71 kip-ft/ft (conservative, unchanged), plus 0.05 of numerical integration.
  - The rest of the Service I diagram (EH, LS, girder horizontal forces, eccentric vertical load) was already in M_s.

### F36. Minimum support length: N provided = girder overlap on the seat; Table 4.7.4.4-1 percentage (N9)   [calc change] [MORE conservative]
- **Where:** `computeAll` C-9, anchor `// percentage of N by seismic zone and A_s [T.4.7.4.4-1]`; new input `geom.endGap` (I-1, "Girder end to backwall face g_end", in, default 4.0; range check); Tab 3 §3.5 shows N, the percentage, N_req and N_prov worked; input echo. Zone and A_s come from I-11 (F32).
- **Before:**
  ```js
  const Nprov=seatW*12-0;   // seat width in inches
  R.checks.seat={dc:Nreq/Nprov, Nreq, Nprov, Hsup, HsupMode};
  ```
- **After:**
  ```js
  const zoneN=…, AsN=…, pctN=zoneN>1?150:(AsN<0.05?75:100), NreqP=Nreq*pctN/100;
  const endGap=Math.max(0,+g.endGap||0);
  const Nprov=seatW*12-endGap;   // in
  R.checks.seat={dc:NreqP/Nprov, Nreq, NreqP, pctN, zoneN, AsN, Nprov, seatIn:seatW*12, endGap, Hsup, HsupMode};
  ```
  An error is raised when g_end ≥ the bearing setback (girder end in front of the bearing line).
- **Provision:** AASHTO LRFD 10th Ed. Art. 4.7.4.4, Eq. 4.7.4.4-1, C4.7.4.4 (N = girder-to-seat overlap measured normal to the bearing CL; the seat must exceed N by the movements; Eq. 4.7.4.4-1 already allows for cover at the girder end and seat face, so no edge deduction), Table 4.7.4.4-1 (Zone 1, A_s < 0.05: 75 %; Zone 1, A_s ≥ 0.05: 100 %; Zones 2–4: 150 %).
- **Default g_end = 4 in:** no gap input existed; 4 in is at the conservative end of usual girder-end clearances and is meant to include the opening movement. Engineer to confirm.
- **Check case (default project: L = 80 ft, H = 19 ft, S = 0, seat 4.5 − 1.5 = 3.0 ft):** N = (8 + 1.60 + 1.52)(1) = 11.12 in.
  - Before: N_prov = 36 in, D/C = 11.12/36 = **0.309**.
  - After (Zone 1, A_s = 0.15 → 100 %): N_prov = 36 − 4 = 32 in, D/C = 11.12/32 = **0.348**. Zone 3: 1.50·11.12 = 16.68 in, D/C = **0.521**. Zone 1 with A_s = 0.04: 0.75·11.12 = 8.34 in, D/C 0.261.
  - With t_st = 3 ft (seat 18 in): 0.618 → 11.12/14 = **0.794**.
- The self-test value "Seat N_req" is N before the percentage (11.12, unchanged).

### F37. EDM pad return no longer resets the bearings per girder to 1; S11 re-checked (N5)   [hand-off fix] [MORE conservative where n > 1]
- **Where:** the `message` listener, `PAD` branch, anchor `// bearings per girder: the EDM has no count input`.
- **Before:** `if(p.nBrgPerGird) S.bearing.nBrgPerGird=+p.nBrgPerGird;`
- **After:** the abutment keeps its own `bearing.nBrgPerGird`; the status line says so when the message carried a different count. The EDM has no bearing-count input and always sends `nBrgPerGird:1` (`elastomeric_design_module.html` `sendPadBack`), so this is not a value from the module. The elastomeric file is not changed.
- **Check case (default project, calculated TU on, 2 bearings per girder; EDM returns a circular pad D = 20 in, G = 0.15 ksi, h_rt = 2.5 in):** Δ = 6.5e-6·68·480 = 0.2122 in; F per bearing = 0.15·314.16·0.2122/2.5 = 4.00 kip. Before: count reset to 1 → 6 bearings → TU = **23.99 kip**. After: 12 bearings → **47.99 kip**.
- **S11 (abutment side) re-checked:** the circular pad arrives as L = D, W = πD/4 (equal area), verified (20 × 15.708 in); `thermalFactor` is not in the abutment state, so `+Lg.thermalFactor||1.2` gives 1.2 (no NaN), verified in the INIT payload (`factor: 1.2`).
- **Found, not changed (engineer question):** the INIT payload sends the full girder-line reaction (P_DL, P_LL) as the load on one pad, also when there are 2 bearings per girder, and the seat bearing check (5.6.5) also puts the full girder reaction on one pad. Both are conservative for n > 1.

### F38. Seat bearing (5.6.5): A₂ from the pad position on the seat (N6)   [calc change] [MORE conservative where the pad is near an edge]
- **Where:** `computeAll` C-15, anchor `// A2 [5.6.5, Fig. 5.6.5-1]`; helper `seatM(i)`; Tab 5 §5.6 shows c, A₂ and m worked.
- **Before:** `const mSpread=Math.min(2,Math.max(1,(seatW*12)/bg.padL));` (one m for every bearing; seat width over pad length).
- **After:** for each girder i: c = min(c_front, c_back, c_trans) with c_front = (t_st − t_bw − setback)·12 − L_pad/2 (to the seat front edge), c_back = (setback + t_bw)·12 − L_pad/2 (to the stem back face; the stem continues under the backwall), c_trans = the lesser of (L_ab/2 − |y_i|)·12 − W_pad/2 (wall end) and half the clear distance to the adjacent girder's pad. A₂ = (L_pad + 2c)(W_pad + 2c); m = √(A₂/A₁) ≤ 2; m = 1 when c ≤ 0 (warning). The governing bearing is the one with the largest q_b/q_R.
- **Provision:** AASHTO LRFD 10th Ed. Art. 5.6.5, Eq. 5.6.5-2 and Fig. 5.6.5-1 (notional area concentric with the loaded area; m = 1 where the support is not wider than the loaded area on all sides).
- **Check case (pad 18 × 24 in, f′c = 4 ksi, P_u = 246.75 kip, A₁ = 432 in², q_b = 0.571 ksi):**
  - Default (setback 1.25 ft): c_front = 36 − 15 − 9 = 12.0; c_back = 15 + 18 − 9 = 24.0; c_trans = (22 − 20)·12 − 12 = 12.0 (end girder); c = 12 → A₂ = 42·48 = 2016 → m = √4.667 = 2.16 → **2.00** (unchanged, D/C 0.120).
  - Setback 1.8 ft: c_front = 36 − 21.6 − 9 = **5.4 in**; A₂ = 28.8·34.8 = 1002.2 in²; m = √2.320 = **1.523** (before 2.00); q_R = 0.70·0.85·4·1.523 = 3.625 ksi (before 4.760); D/C 0.120 → **0.158**.
- **Not changed (engineer question):** the 10th Ed. 5.6.5 gives m = 0.75√(A₂/A₁) ≤ 1.50 where the bearing stress is not uniform (e.g. under pad rotation). The tool uses the uniform-stress form, as before.

### Self-test re-bake
- `__ST_EXPECT` "Eccentricity e (ft)" 2.507894818378456 → 3.065583297600188 (F33, hand-checked above). The other 15 values are unchanged; the self-test passes.

### Saved data (CLAUDE.md §5)
- No key renamed and no format change. New field `geom.endGap` (in). `migrate()` anchor `// defRev 2`: a project without `meta.defRev ≥ 2` and without `endGap` gets 4.0 in, and the one-time notice of F27–F32 lists it ("Girder end to backwall face g_end … set to 4 in — check it"); then `meta.defRev = 2`. Verified with a project autosaved by main (all seven items listed) and by the F27–F32 branch (only g_end listed); no notice after a reload.
- The foundation hand-off payload format is unchanged; it carries more cases (F33). HANDOFF.md §4.6 updated.

### How verified
- `node tests/check-syntax.mjs abutment_calculator.html`: all scripts pass.
- Headless Chromium, `b8da0d5` vs branch, `computeAll()` on the default project and the variants piles (DR = 20), rock, seismic, seismic on rock (γEQ = 0.5), piles + seismic, front batter (t_st 3 / t_sb 6), ES = 0.5 ksf, setback 1.8 ft and Zone 3: the D/C changes are those listed above; every other value is identical. Every tab renders with no page error; 364 TeX strings render in KaTeX 0.16.9 with `throwOnError`. The "Send foundation loads" dialog lists "H/V max, |e| max" (spread) and "pile P min" = the LL-reaction-off case (piles). A simulated EDM PAD message (circular pad, count 1) keeps 2 bearings per girder.
- **Other copies:** none.

### Open items (not changed)
- **N7, punching with pile embedment:** reported, not implemented. Which depth governs depends on where the bottom mat sits relative to the pile heads (a judgement call). Default pile project: d_e = 36 − 3 − 1.0 = 32 in, d_v = max(0.9·32, 0.72·36) = 28.8 in, b₀ = 4(12 + 28.8) = 163.2 in, φV_n = 0.9·0.126·2·163.2·28.8 = 1066.0 kip → D/C 212.71/1066.0 = 0.200. With 12 in embedment and the mat 3 in clear over the pile heads: d_e = 36 − 12 − 3 − 0.5 = 20.5 in, d_v = max(18.45, 0.72·24 = 17.28) = 18.45 in, b₀ = 4(30.45) = 121.8 in, φV_n = 0.9·0.126·2·121.8·18.45 = 509.7 kip → D/C **0.417**.
- **N4, EE-I superstructure inertia × floating share:** not changed (engineer question). EQsup = A_s·(DC + DW)·sh_TU; with the floating 50 % share: A_s = 0.15 → 0.15·582·0.5 = 43.65 kip (vs 87.3 kip at 100 %); A_s = 0.30 → 87.3 kip (vs 174.6 kip). At A_s = 0.30 the missing 87.3 kip at z = 17 ft is 1484 kip-ft of overturning: in the governing EE-I eccentricity case (V = 1657.83 kip) e would grow by 0.90 ft (4.86 → 5.75 ft, D/C 1.12 → about 1.33) and the sliding demand by 87.3 kip.
- The bearing-seat check and the EDM INIT load use the full girder reaction on one pad when there are 2 bearings per girder (conservative).
- 5.6.5 non-uniform-stress m (0.75√(A₂/A₁) ≤ 1.5) not applied.

### Appendix — unified diff (exact before/after)
```diff
diff --git a/HANDOFF.md b/HANDOFF.md
index 030981a..5add167 100644
--- a/HANDOFF.md
+++ b/HANDOFF.md
@@ -196,7 +196,7 @@ This matches the existing BridgeLocks "project" channel (`index.html`).
   - *Moment convention (all senders).* Moments are defined by their effect, so receivers can map axes without a handedness question: **My + moves the resultant toward +x (e_x = My/P), Mx + moves it toward +y (e_y = Mx/P)**; P + = down; Vx, Vy + toward +x, +y. Each payload states its own x and y in words in `signConvention` and in the optional `axes:{ x:"<words>", y:"<words>" }`. Pile Designer's group workspace and Spread Footing use the same effect-based convention, so a receiver maps only the axes: receiver +x = ±hand-off x or ±hand-off y (user's choice, default identity); the moment about the receiver's other axis follows (e.g. receiver +x = hand-off −y gives Vx = −Vy and My = −Mx).
   - *Optional fields.* `reference:{ level:"topOfFooting"|"baseOfWall"|"bottomOfFooting"|"bottomOfPileCap"|"pointOfFixity", point:"footingCentre"|"pileGroupCentroid"|"unitCentre", … }` (machine-readable form of `location`); `includes:{ footingWeight, soilOverFooting, earthPressure }` (booleans); `element.unitIndex`; `geometry` (abutment footing B, length, thickness, ft). Per case: `id`, `governs` (which target the case maximises or minimises, e.g. "P max, My max") and `combination` (the load factors in words). Receivers must not require them; a receiver that needs the level reads `reference.level`, else the `location` text, else asks the user.
   - *Two producers, one channel.* As in §4.4: each sender writes the channel key and also keeps a copy at `bridgeSuite.v1.foundationLoads.by.<id>` (`abutment`, `subloads`). Receivers list every valid copy, newest first, and let the user pick. `updatedAt` and `adopted.<receiverId>` stay on the channel key only. Receiver ids: `pileDesigner`, `spreadFooting`.
-  - *Abutment calculator (sender).* Toolbar **"Send foundation loads"** opens a dialog (limit states to send, preview) with **"Send to other tools"** and **"Export hand-off (JSON)"**. Cases come from its own permutation engine (`R.comboEffects` over `R.permutations`, γp max/min, with and without LL; the vertical LS over the heel included as in its bearing and pile checks). Per limit state it sends the permutations giving V max, V min, My max, My min and the largest horizontal resultant, plus in the pile branch the ones that govern its pile table ("pile P max", "pile P min"); identical sets are merged. Level: bottom of footing (spread) about the footing centre, or bottom of pile cap about the pile-group centroid (pile branch). x + toward the toe (toward the span), y + toward positive beam offsets. Strength, Extreme Event and the construction stage are `factored:true` (`limitState` "Strength I (construction stage)" for the latter); Service I is `factored:false`.
+  - *Abutment calculator (sender).* Toolbar **"Send foundation loads"** opens a dialog (limit states to send, preview) with **"Send to other tools"** and **"Export hand-off (JSON)"**. Cases come from its own permutation engine (`R.comboEffects` over `R.permutations`, γp max/min; LL on, off, and LS + BR with the girder LL reaction off [C11.5.6] (since 2026-10-19); the vertical LS over the heel included as in its bearing and pile checks). Per limit state it sends the permutations giving V max, V min, My max, My min and the largest horizontal resultant, plus in the pile branch the ones that govern its pile table ("pile P max", "pile P min") and, for a spread footing, the largest H/V and |My|/V ("H/V max", "|e| max", since 2026-10-19); identical sets are merged. Level: bottom of footing (spread) about the footing centre, or bottom of pile cap about the pile-group centroid (pile branch). x + toward the toe (toward the span), y + toward positive beam offsets. Strength, Extreme Event and the construction stage are `factored:true` (`limitState` "Strength I (construction stage)" for the latter); Service I is `factored:false`.
   - *SubLoads (sender).* Header **"Send foundation loads"** opens a dialog: unit, reference level (`top of footing`, `bottom of footing`, `base of wall` or `point of fixity`, whichever the unit has; default bottom of footing) and limit states, with a preview, **"Send to other tools"** and **"Export hand-off (JSON)"**. Per limit state it sends the concurrent sets of the Combinations tab (`comboEval` with a target sign) for P max/min, M_t max/min and M_l max/min at that level, identical sets merged. Mapping: Vx = V_l, Vy = V_t, Mx = M_t, My = M_l, with x normal to the bearing line + ahead station and y along the bearing line + left looking ahead station. Strength and Extreme Event are `factored:true`; Service I and IV are `factored:false`.
   - *Pile Designer (receiver).* "Loads & group" input tab (moved from the Project panel 2026-10-10, F15): **"Pull from Abutment / SubLoads"** (new-data marker) and **"Import hand-off (JSON)"**. Not shown in integral-abutment mode (the import is refused there). Target, the user's choice: (a) *Pile group workspace* (default): each case becomes one `groupCases` entry (type `strength`, `extreme` from an Extreme Event limit state, or `service` when `factored:false`) acting at one load location "Foundation hand-off" (`loadPoints`, z = 0) at the reference point, entered in pile coordinates (default: the centroid of the current pile layout); the dialog offers to turn on "Apply pile group to the design" and, when `includes.footingWeight`, to switch off the tool's own cap/stem self-weight. (b) *Single-pile LRFD case table*, only after the user confirms the loads act on one pile: STL = |P| (type `tension` when P < 0), lateral = √(Vx² + Vy²) (default) or one component, head moment 0 (default) or |M| in the same plane. Imported rows carry `_bx:{ ch:"foundationLoads", producer, producedAt, case }`; "replace" (default) removes only tagged rows. Source: new optional input field `I.foundationSrc`, shown in the Loads & group tab and in the report's input summary.
   - *Spread Footing (receiver).* **"Pull from Abutment / SubLoads"** (new-data marker) and **"Import hand-off (JSON)"**, on a second line under the memberReactions buttons. Its by-load-type rows take unfactored loads by type and are **never** filled from this channel. One **factored** case is imported into one pedestal's Direct factored set (`peds[i].direct`, applied at the top of the pedestal); service cases are listed but not importable. Cases at the bottom of the footing or pile cap, or at a point of fixity, are refused (the tool adds the footing weight, soil and V·(t + h) itself); an unknown level needs the user's confirmation. Options: case (default the factored case with the largest P), pedestal, axis mapping, "refer the moments to the top of the pedestal" (M − V·h, default on when h > 0 and the shear couple is on), "switch Load input mode to Direct factored" (default on), "set the other pedestals' direct loads to 0" (default off). Source: new optional field `state.bxSrc.foundationLoads`, shown under the title block and in the printed report header.
diff --git a/abutment_calculator.html b/abutment_calculator.html
index 453d8aa..08db78f 100644
--- a/abutment_calculator.html
+++ b/abutment_calculator.html
@@ -575,6 +575,7 @@ function defaultState(){
       hbw:5.00, tbw:1.50,           // backwall height/thickness (ft)
       hstem:14.00, tst:4.50, tsb:4.50, // stem height, top & bottom thickness (ft)
       brgSetback:1.25,              // bearing setback from front face of backwall (ft)
+      endGap:4.0,                   // girder end to backwall face incl. opening movement (in); N provided = seat width − endGap [4.7.4.4]
       Ltoe:3.50, Lheel:5.00, tf:3.00, // toe length, heel length, footing thickness (ft)
       Lab:44.00,                    // wall (stem/backwall) length carrying earth pressure & self-weight (ft)
       Lftg:44.00,                   // footing plan length — bearing area, pile group, footing self-weight (ft)
@@ -694,6 +695,7 @@ const VALID = {
   "geom.tst":   {hard:[0.5,20], typ:[2,8],    msg:"Stem top thickness outside the typical 2–8 ft range."},
   "geom.tsb":   {hard:[0.5,20], typ:[2,10],   msg:"Stem bottom thickness outside the typical 2–10 ft range."},
   "geom.brgSetback":{hard:[0,10], typ:[0.75,3], msg:"Bearing setback outside the typical 0.75–3 ft range."},
+  "geom.endGap":{hard:[0,48], typ:[1,6], msg:"Girder end to backwall gap outside the typical 1–6 in range."},
   "geom.Ltoe":  {hard:[0,40],  typ:[1,12],    msg:"Toe length outside the typical 1–12 ft range."},
   "geom.Lheel": {hard:[0,60],  typ:[2,20],    msg:"Heel length outside the typical 2–20 ft range."},
   "geom.tf":    {hard:[0.5,15],typ:[2,6],     msg:"Footing thickness outside the typical 2–6 ft range."},
@@ -989,6 +991,11 @@ function migrate(){
     S.meta.defRev=1;
     if(upd.length) DEFAULTS_NOTICE=upd;
   }
+  // defRev 2: new input for the provided support length (girder overlap on the seat) [4.7.4.4]
+  if(!(S.meta.defRev>=2)){
+    if(S.geom.endGap===undefined){ S.geom.endGap=4.0; DEFAULTS_NOTICE=(DEFAULTS_NOTICE||[]).concat(["Girder end to backwall face g_end (new input: support length = seat width − g_end [4.7.4.4]) set to 4 in — check it"]); }
+    S.meta.defRev=2;
+  }
 }
 function seedExampleReactions(){
   const ex={DC:{P:85},DW:{P:12},LL:{P:70},BR:{Vx:3.5},TU:{Vx:2.5},CRSH:{Vx:1.5},
@@ -1016,6 +1023,7 @@ function buildInputs(){
     ${inpRow("Stem thickness at top t<sub>st</sub>","geom.tst","ft",{title:"Includes the bridge seat width plus the backwall thickness. Back face is vertical; any taper is on the front face."})}
     ${inpRow("Stem thickness at bottom t<sub>sb</sub>","geom.tsb","ft")}
     ${inpRow("Bearing setback from backwall face","geom.brgSetback","ft")}
+    ${inpRow("Girder end to backwall face g<sub>end</sub>","geom.endGap","in",{title:"Gap between the girder end and the backwall face, including the opening movement (thermal fall, creep, shrinkage). The provided support length N is the girder overlap on the seat = seat width − g_end [4.7.4.4, C4.7.4.4]. Default 4 in."})}
     <div class="derived">Derived: bridge seat width = t<sub>st</sub> − t<sub>bw</sub> = <b>${fmt(derivedSeat)} ft</b> &nbsp;·&nbsp; seat elevation (above footing base) = <b>${fmt(g.tf+g.hstem)} ft</b><br>Bearing eccentricity from stem centerline e<sub>brg</sub> = t<sub>bw</sub> + setback − t<sub>sb</sub>/2 = <b>${fmt(g.tbw+g.brgSetback-g.tsb/2)} ft</b> ${(g.tbw+g.brgSetback-g.tsb/2)>=0?"(toward toe → adds stem moment)":"(toward heel → relieves stem moment)"}</div>
     <div class="subhead">Footing</div>
     ${inpRow("Toe length L<sub>toe</sub>","geom.Ltoe","ft")}
@@ -1544,7 +1552,7 @@ function computeAll(){
   const tw=g.tsb-g.tst;
   if(Math.abs(tw)>1e-9){
     const Wtri=Math.abs(tw)*g.hstem/2*gcSub*Lab*Math.sign(tw);
-    const xtri=g.Ltoe+Math.abs(tw)/3; // triangle at front, wide at bottom
+    const xtri=g.Ltoe+2*tw/3; // triangle (Ltoe,0)-(Ltoe+tw,0)-(Ltoe+tw,h_stem), x from the toe: centroid at Ltoe + 2·tw/3 (also for tw < 0)
     parts.push({name:"Stem — front batter triangle", A:tw*g.hstem/2, W:Wtri, x:xtri, y:g.tf+g.hstem/3, note:"(t_sb−t_st)·h_stem/2·γ_c·L_ab"});
   }
   // Footing (buoyant below WT)
@@ -1733,7 +1741,7 @@ function computeAll(){
       let gamma;
       if(["DC","DW","EV","ES"].includes(gr.cls)) gamma = L.perm ? GP[gr.cls][perm[gr.cls]??1] : 1.0;
       else if(gr.cls==="EH") gamma = (L.eq && eqEHfixed()!==null) ? eqEHfixed() : (L.perm ? GP.EH[perm.EH] : 1.0);
-      else if(gr.cls==="LL") gamma = liveOn ? L.LL : 0;
+      else if(gr.cls==="LL") gamma = liveOn ? ((liveOn===2&&k==="LL")? 0 : L.LL) : 0;   // liveOn 2: LS and BR on, girder LL reaction off [C11.5.6]
       else if(gr.cls==="EQ") gamma = L.EQ||0;
       else gamma = L[gr.cls]; // TU, CR, WS, WL
       if(gr.cls==="DC" && L.perm && L.dcMax && (perm.DC??1)===1) gamma = L.dcMax;   // Strength IV γDC max
@@ -1750,7 +1758,7 @@ function computeAll(){
     const lbl = L.perm
       ? `${(perm.DC===1&&L.dcMax?L.dcMax:GP.DC[perm.DC]).toFixed(2)}·DC + ${GP.DW[perm.DW].toFixed(2)}·DW + ${GP.EV[perm.EV].toFixed(2)}·EV + ${((L.eq&&eqEHfixed()!==null)?eqEHfixed():GP.EH[perm.EH]).toFixed(2)}·EH`
         +(esOn?` + ${GP.ES[perm.ES??1].toFixed(2)}·ES`:"")
-        +(liveOn&&L.LL?` + ${L.LL.toFixed(2)}·(LL,BR,LS)`:"")
+        +(liveOn&&L.LL?(liveOn===2?` + ${L.LL.toFixed(2)}·(BR,LS), LL reaction off`:` + ${L.LL.toFixed(2)}·(LL,BR,LS)`):"")
         +(L.WS?` + ${L.WS.toFixed(2)}·WS`:"")+(L.WL?` + ${L.WL.toFixed(2)}·WL`:"")
         +(L.TU&&(groups.TU.Hx||groups.CRSH.Hx)&&!L.noSuper?` + ${L.TU.toFixed(2)}·TU/CR/SH`:"")
         +(L.EQ?` + ${(+L.EQ).toFixed(2)}·EQ`:"")
@@ -1758,9 +1766,11 @@ function computeAll(){
       : `1.00·(all)`+(liveOn?" incl. LL":" excl. LL");
     return {V,Mv,Hx,Mh,Hy,Mt,lbl,gset,lsName,liveOn,perm};
   }
-  function* permutations(lsName){
+  // stab = true (sliding, eccentricity, pile minimum reaction, foundation hand-off): also LS + BR with the girder LL reaction off
+  // (liveOn 2), since the LL reaction on the bridge is not counted as resisting in sliding / eccentricity [C11.5.6, 3.4.1]
+  function* permutations(lsName,stab){
     const L=LIMITS[lsName];
-    const lives=L.liveOpt?[1,0]:[0];
+    const lives=L.liveOpt?((stab&&L.perm&&!L.noSuper)?[1,2,0]:[1,0]):[0];
     const esB=(+S.soil.esQ||0)>0?[0,1]:[1];
     if(!L.perm){ for(const lv of lives) yield {perm:{DC:0,DW:0,EV:0,EH:0,ES:1}, liveOn:lv}; return; }
     for(const dc of [0,1]) for(const dw of [0,1]) for(const ev of [0,1]) for(const eh of [0,1]) for(const es of esB)
@@ -1772,7 +1782,7 @@ function computeAll(){
   R.permTables={};
   for(const lsName of Object.keys(LIMITS)){
     const rows=[];
-    for(const pl of permutations(lsName)){
+    for(const pl of permutations(lsName,true)){
       const c=comboEffects(lsName,pl.perm,pl.liveOn,false);
       const xbar=c.V>1e-9?(c.Mv-c.Mh)/c.V:NaN;
       rows.push({...c, xbar, e:B/2-xbar});
@@ -1783,7 +1793,7 @@ function computeAll(){
   const STR_LIMITS=["Strength I","Strength III","Strength IV","Strength V","Constr — Str I"].concat(S.seismic.on&&LIMITS["Extreme Event I"]?["Extreme Event I"]:[]);
   // EE-I eccentricity limit [11.6.5.1]: B·(1/3 + (0.4 − 1/3)·γEQ), soil and rock; γEQ = 0 for a permutation without live load [10.6.4.2]
   function eFracEQfor(liveOn){ const s=S.seismic; if(s.eLimEQmode==="user") return +s.eFracEQ;
-    const gq=liveOn? Math.min(1,Math.max(0,+s.gEQll||0)) : 0; return 1/3+(0.4-1/3)*gq; }
+    const gq=liveOn===1? Math.min(1,Math.max(0,+s.gEQll||0)) : 0; return 1/3+(0.4-1/3)*gq; }
   function resFor(lsName,liveOn){ const eq=LIMITS[lsName]&&LIMITS[lsName].eq;
     return { phiTau: eq? +S.seismic.phiTauEQ : fn.phiTau,
              phiB:   eq? +S.seismic.phiBEQ   : fn.phiB,
@@ -1799,7 +1809,7 @@ function computeAll(){
     // ---- Sliding [10.6.3.4] ----
     let slid={dc:-1};
     for(const lsName of STR_LIMITS){
-      for(const pl of permutations(lsName)){
+      for(const pl of permutations(lsName,true)){   // incl. LS + BR with the LL reaction off [C11.5.6]
         const c=comboEffects(lsName,pl.perm,pl.liveOn,true); // LSv excluded (no vertical LS benefit)
         if(c.V<=0) continue;
         const rf=resFor(lsName);
@@ -1814,7 +1824,7 @@ function computeAll(){
     // ---- Eccentricity [11.6.3.3] ----
     let ecc={dc:-1};
     for(const lsName of STR_LIMITS){
-      for(const pl of permutations(lsName)){
+      for(const pl of permutations(lsName,true)){   // incl. LS + BR with the LL reaction off [C11.5.6]
         const eLim=resFor(lsName,pl.liveOn).eLim;
         const c=comboEffects(lsName,pl.perm,pl.liveOn,true);
         if(c.V<=0) continue;
@@ -1896,7 +1906,7 @@ function computeAll(){
       const perLS={};
       for(const lsName of Object.keys(LIMITS)){
         let best={Pmax:-Infinity}, worstMin={Pmin:Infinity}, worstH={H:-1};
-        for(const pl of permutations(lsName)){
+        for(const pl of permutations(lsName,true)){   // liveOn 2 (LS + BR, LL reaction off) is used for the minimum reaction only [C11.5.6]
           const c=comboEffects(lsName,pl.perm,pl.liveOn,false);
           if(c.V<=0) continue;
           const xbar=(c.Mv-c.Mh)/c.V;
@@ -1910,9 +1920,9 @@ function computeAll(){
           let iMax=0,iMin=0;
           loads.forEach((v,i)=>{ if(v>loads[iMax])iMax=i; if(v<loads[iMin])iMin=i; });
           const Hres=Math.sqrt(c.Hx*c.Hx+c.Hy*c.Hy);
-          if(loads[iMax]>best.Pmax) best={Pmax:loads[iMax], iMax, loads:[...loads], c, ex, My, Mx, xbar};
+          if(pl.liveOn!==2 && loads[iMax]>best.Pmax) best={Pmax:loads[iMax], iMax, loads:[...loads], c, ex, My, Mx, xbar};
           if(loads[iMin]<worstMin.Pmin) worstMin={Pmin:loads[iMin], iMin, loads:[...loads], c, ex, My, Mx};
-          if(Hres>worstH.H) worstH={H:Hres, Hx:c.Hx, Hy:c.Hy, c};
+          if(pl.liveOn!==2 && Hres>worstH.H) worstH={H:Hres, Hx:c.Hx, Hy:c.Hy, c};
         }
         perLS[lsName]={best,worstMin,worstH};
       }
@@ -1953,8 +1963,14 @@ function computeAll(){
   if(HsupMode==="user"&&!(+g.HsupUser>=0)) warn("Input error — the entered pier height H for the minimum support length must be a number ≥ 0 [4.7.4.4]; 0 is used.","err");
   else if(HsupMode==="user"&&+g.HsupUser>60) warn("Check input — pier height H for the minimum support length above 60 ft [4.7.4.4].");
   const Nreq=(8+0.02*g.spanL+0.08*Hsup)*(1+0.000125*g.skew*g.skew); // in [4.7.4.4]
-  const Nprov=seatW*12-0;   // seat width in inches
-  R.checks.seat={dc:Nreq/Nprov, Nreq, Nprov, Hsup, HsupMode};
+  // percentage of N by seismic zone and A_s [T.4.7.4.4-1]: Zone 1 with A_s < 0.05 → 75 %, other Zone 1 → 100 %, Zones 2–4 → 150 %
+  const zoneN=Math.min(4,Math.max(1,Math.round(+S.seismic.zone||1))), AsN=Math.max(0,+S.seismic.As||0);
+  const pctN=zoneN>1?150:(AsN<0.05?75:100), NreqP=Nreq*pctN/100;
+  // provided support length = girder overlap on the seat: seat width less the girder-end gap to the backwall (incl. opening movement) [C4.7.4.4]
+  const endGap=Math.max(0,+g.endGap||0);
+  const Nprov=seatW*12-endGap;   // in
+  if(endGap>=g.brgSetback*12) warn("Girder end to backwall gap ("+fmt(endGap,1)+" in) is not less than the bearing setback ("+fmt(g.brgSetback*12,1)+" in): the girder end would be in front of the bearing line — check the seat geometry.","err");
+  R.checks.seat={dc:NreqP/Nprov, Nreq, NreqP, pctN, zoneN, AsN, Nprov, seatIn:seatW*12, endGap, Hsup, HsupMode};
   // Minimum seismic connection force (each restrained direction) [3.10.9]:
   //   Zone 1: c·(permanent + γEQ·LL) reaction, c = 0.15 when A_s < 0.05, else 0.25 [3.10.9.2];
   //   single-span bridges, any zone: ≥ A_s × permanent reaction [3.10.9.1, 4.7.4.2] (taken as a floor here in every zone, conservative for multispan);
@@ -2107,8 +2123,8 @@ function computeAll(){
   const HgirdSvc=(groups.BR.Hx+groups.TU.Hx+groups.CRSH.Hx+wsFsv*groups.WS.Hx+groups.WL.Hx)/Lab;
   // Service I: LL reaction on or off, whichever gives the larger back-face moment (LS and BR stay on)
   const seSvc=stemEcc(LIMITS["Service I"],1), PvSvc=seSvc.Pv, MeccSvc=seSvc.Mecc, svcNoLL=!seSvc.llOn;
-  const MsStem=Mst_EH+Mst_LS+HgirdSvc*g.hstem+MeccSvc;
-  R.stemDem={Hs,heqS,Mst_EH,Vst_EH,Mst_LS,Vst_LS,...stemGov,MsStem,HgirdSvc,eBrg:R.geo.eBrg,MselfEccTot,MeccSvc,svcNoLL};
+  const MsStem=Mst_EH+Mst_LS+Mst_ES+HgirdSvc*g.hstem+MeccSvc;   // Service I: EH + LS + ES + girder horizontal + eccentric vertical (as the Service I V&M diagram)
+  R.stemDem={Hs,heqS,Mst_EH,Vst_EH,Mst_LS,Vst_LS,Mst_ES,...stemGov,MsStem,HgirdSvc,eBrg:R.geo.eBrg,MselfEccTot,MeccSvc,svcNoLL};
   if(g.hw>g.tf) warn("Water table above the top of footing: wall structural demands conservatively use moist unit weight over the full height (no buoyant reduction applied to wall pressures).");
   R.checks.stemFlex=sectionCheck({name:"Stem", h:g.tsb*12, cover:m.coverT, bar:S.reinf.stem.size,
     sp:+S.reinf.stem.sp, Mu:stemGov.Mu, Vu:stemGov.Vu, Ms:MsStem, lbl:stemGov.lbl,
@@ -2310,23 +2326,36 @@ function computeAll(){
   /* ===== C-15 Bearing on concrete — bridge seat [AASHTO 5.6.5] ===== */
   {
     const bg=S.bearing, A1=bg.padL*bg.padW;               // in²
-    const mSpread=Math.min(2,Math.max(1,(seatW*12)/bg.padL)); // m = √(A2/A1) from geometrically-similar seat spread, floored at 1
     const phiB=0.70;
-    const qR=phiB*0.85*m.fc*mSpread;                      // ksi
-    // governing single-bearing factored vertical (strength)
-    let Pu=-Infinity, pgirder=0, pls="";
+    // A2 [5.6.5, Fig. 5.6.5-1]: notional area concentric with the pad, extended by the smallest clear edge distance c on all
+    // sides, c = min(pad to seat front edge, pad to stem back face (under the backwall), half the clear distance to the next
+    // pad, pad to the wall end). m = √(A2/A1) ≤ 2; m = 1 when the support is not wider than the pad on all sides (c ≤ 0).
+    const posB=R.beamPos||[], Lin=bg.padL, Win=bg.padW;
+    const cFront=(seatW-g.brgSetback)*12-Lin/2, cBack=(g.brgSetback+g.tbw)*12-Lin/2;
+    function seatM(i){
+      const y=posB[i]||0; let cT=(Lab/2-Math.abs(y))*12-Win/2, cTw="wall end";
+      for(const j of [i-1,i+1]){ if(j<0||j>=posB.length) continue; const cj=(Math.abs(posB[j]-y)*12-Win)/2; if(cj<cT){ cT=cj; cTw="½ clear distance to girder "+(j+1)+" pad"; } }
+      const cands=[[cFront,"seat front edge"],[cBack,"stem back face"],[cT,cTw]];
+      let c=cands[0]; cands.forEach(k=>{ if(k[0]<c[0]) c=k; });
+      const A2=c[0]>0?(Lin+2*c[0])*(Win+2*c[0]):A1, mRaw=Math.sqrt(A2/A1);
+      return {c:c[0], cBy:c[1], cT, A2, mRaw, m:c[0]>0?Math.min(2,mRaw):1};
+    }
+    // governing single bearing (largest q_b/q_R): factored vertical at Strength I, IV, V
+    let Pu=-Infinity, pgirder=0, pls="", dcB=-Infinity, sm=null;
     for(let i=0;i<S.beams.N;i++){
       const SI=GP.DC[1]*S.rx.DC[i].P+GP.DW[1]*S.rx.DW[i].P+(+F.llS1)*S.rx.LL[i].P;
       const SV=GP.DC[1]*S.rx.DC[i].P+GP.DW[1]*S.rx.DW[i].P+(+F.llS5)*S.rx.LL[i].P
                +(+F.wsS5)*wsF5*S.rx.WS[i].P+(+F.wlS5)*S.rx.WL[i].P;
       const SIV=LIMITS["Strength IV"].dcMax*S.rx.DC[i].P+GP.DW[1]*S.rx.DW[i].P;
-      if(SI>Pu){Pu=SI;pgirder=i+1;pls="Strength I";}
-      if(SIV>Pu){Pu=SIV;pgirder=i+1;pls="Strength IV";}
-      if(SV>Pu){Pu=SV;pgirder=i+1;pls="Strength V";}
+      let P=SI, ls="Strength I"; if(SIV>P){P=SIV;ls="Strength IV";} if(SV>P){P=SV;ls="Strength V";}
+      const mi=seatM(i), dci=(P/A1)/(phiB*0.85*m.fc*mi.m);
+      if(dci>dcB+1e-12){ dcB=dci; Pu=P; pgirder=i+1; pls=ls; sm=mi; }
     }
+    const mSpread=sm?sm.m:1, qR=phiB*0.85*m.fc*mSpread;   // ksi
     const qb=Pu/A1;                                       // ksi
     R.checks.bearingSeat={dc:qb/qR, qb, qR, A1, m:mSpread, phiB, Pu, pgirder, pls,
-      A2note:seatW*12};
+      A2:sm?sm.A2:A1, c:sm?sm.c:0, cBy:sm?sm.cBy:"", mRaw:sm?sm.mRaw:1, cFront, cBack, cT:sm?sm.cT:0};
+    if(sm&&sm.c<=0) warn("Bearing pad is not inside the seat on all sides (clear edge distance "+fmt(sm.c,1)+" in to the "+sm.cBy+"): m = 1 [5.6.5]; check the pad position.");
     // seat reinforcement mat — prescriptive provision + STM trigger
     const bar=BARS[bg.seatBar], AsMat=bar.Ab*12/bg.seatSp; // in²/ft each way
     const AsMatMin=0.11;                                   // nominal minimum mat, in²/ft each way
@@ -2615,7 +2644,7 @@ function computeAll(){
 
   /* ===== C-11c Tag governing permutation rows for traceability ===== */
   (function(){
-    function permKey(c){ return c.lsName+"|"+(c.perm?[c.perm.DC,c.perm.DW,c.perm.EV,c.perm.EH,c.perm.ES].join(""):"")+"|"+(c.liveOn?1:0); }
+    function permKey(c){ return c.lsName+"|"+(c.perm?[c.perm.DC,c.perm.DW,c.perm.EV,c.perm.EH,c.perm.ES].join(""):"")+"|"+(+c.liveOn||0); }
     function tagGov(c,label){ if(!c||!c.lsName||!R.permTables[c.lsName]) return;
       const key=permKey(c), row=R.permTables[c.lsName].find(rr=>permKey(rr)===key);
       if(row){ (row.govFor=row.govFor||[]).push(label); } }
@@ -2988,13 +3017,13 @@ function renderTabComb(R){
     <tr><td class="lft">Overturning / eccentricity</td><td>minimum</td><td>maximum</td><td class="lft">Least stabilizing moment</td></tr>
     <tr><td class="lft">Bearing resistance</td><td>maximum</td><td>maximum</td><td class="lft">Greatest vertical + eccentricity</td></tr>
     <tr><td class="lft">Structural / pile demand</td><td>governing per check</td><td>maximum</td><td class="lft">Worst factored section / pile demand</td></tr></table>
-    <div class="eq-note">The tables in <span class="xlink" data-jump="tab-comb|o-perm-${Object.keys(R.permTables)[0]?.replace(/\s/g,"")}">§2.3</span> list every permutation so the selection is fully auditable. Vertical live-load surcharge (LSv) is zeroed where it would aid stability.</div>`);
+    <div class="eq-note">The tables in <span class="xlink" data-jump="tab-comb|o-perm-${Object.keys(R.permTables)[0]?.replace(/\s/g,"")}">§2.3</span> list every permutation so the selection is fully auditable. Vertical live-load surcharge (LSv) is zeroed where it would aid stability. Live "LS, BR only" = surcharge and braking with the girder LL reaction off: used for sliding, eccentricity, the minimum pile reaction and the foundation hand-off, not for bearing or the maximum pile reaction [C11.5.6].</div>`);
   for(const [ls,rows] of Object.entries(R.permTables)){
     const anyGov=rows.some(r=>r.govFor);
     let t=`<table class="rtbl"><tr><th>γDC</th><th>γDW</th><th>γEV</th><th>γEH</th><th>Live</th><th>ΣV (kip)</th><th>ΣH<sub>x</sub> (kip)</th><th>ΣM<sub>V</sub> (kip·ft)</th><th>ΣM<sub>H</sub> (kip·ft)</th><th>x̄ (ft)</th><th>e (ft)</th><th>Governs</th></tr>`;
     rows.forEach(r=>{
       const g=r.govFor?`<span class="flagchip warn" style="font-size:0.72rem;">◄ ${r.govFor.join(", ")}</span>`:"";
-      t+=`<tr${r.govFor?' class="gov"':''}><td>${fmt(r.gset.DCsub)}</td><td>${fmt(r.gset.DW)}</td><td>${fmt(r.gset.EV)}</td><td>${fmt(r.gset.EHh)}</td><td>${r.liveOn?"on":"off"}</td>
+      t+=`<tr${r.govFor?' class="gov"':''}><td>${fmt(r.gset.DCsub)}</td><td>${fmt(r.gset.DW)}</td><td>${fmt(r.gset.EV)}</td><td>${fmt(r.gset.EHh)}</td><td>${r.liveOn===2?"LS, BR only":r.liveOn?"on":"off"}</td>
         <td>${fmt(r.V)}</td><td>${fmt(r.Hx)}</td><td>${fmt(r.Mv)}</td><td>${fmt(r.Mh)}</td><td>${fmt(r.xbar)}</td><td>${fmt(r.e)}</td><td class="lft">${g}</td></tr>`;
     });
     t+="</table>";
@@ -3054,6 +3083,7 @@ function renderTabStab(R){
     const sl=R.checks.sliding;
     h+=panel("o-slide","3.1","Sliding [10.6.3.4]",`
       ${govNote(sl.lbl+" — "+sl.ls)}
+      <div class="eq-note">Live-load cases checked: none; LL + BR + LS; and LS + BR with the girder LL reaction off (the LL reaction on the bridge is not counted as resisting) [C11.5.6].${sl.c&&sl.c.liveOn===2?" <b>The governing case is LS + BR with the LL reaction off.</b>":""}</div>
       <div class="eq-note">See <span class="xlink" data-jump="tab-stab|o-fbd">§3.0 free-body ledger</span> for the force × arm breakdown of the governing case.</div>
       ${fn.matl==="soil"
         ? eqB("Nominal & factored sliding resistance (soil)","AASHTO 10.6.3.4, Eq. 10.6.3.4-1",[
@@ -3073,6 +3103,7 @@ function renderTabStab(R){
     const ec=R.checks.ecc;
     h+=panel("o-ecc","3.2","Eccentricity / Overturning [11.6.3.3]",`
       ${govNote(ec.lbl+" — "+ec.ls)}
+      <div class="eq-note">Live-load cases checked: none; LL + BR + LS; and LS + BR with the girder LL reaction off (the LL reaction on the bridge is not counted as resisting) [C11.5.6].${ec.c&&ec.c.liveOn===2?" <b>The governing case is LS + BR with the LL reaction off.</b>":""}</div>
       <div class="eq-note">The governing permutation is highlighted in <span class="xlink" data-jump="tab-comb|o-perm-${ec.ls.replace(/\s/g,"")}">Tab 2 §2.3 (${esc(ec.ls)})</span>; force × arm in <span class="xlink" data-jump="tab-stab|o-fbd">§3.0</span>.</div>
       ${eqB("Location of the resultant and eccentricity (moments about the toe)","AASHTO 11.6.3.3",[
         "\\bar{x} = \\dfrac{\\Sigma M_{V} - \\Sigma M_{H}}{\\Sigma V}\\,, \\qquad e = \\dfrac{B}{2} - \\bar{x}",
@@ -3080,7 +3111,7 @@ function renderTabStab(R){
         `e = \\dfrac{${fmtT(geo.B)}}{2} - ${fmtT(ec.xbar)} = ${fmtT(ec.eSigned)}\\ \\text{ft}\\,, \\qquad |e| = ${fmtT(ec.e)}\\ \\text{ft}\\ (\\text{resultant on the ${ec.side} side})`])}
       ${eqB(`Limit for founding material: ${fn.matl}${LIMITS_HAS_EQ(R)?" (EE-I uses the extreme-event fraction)":""}`,"AASHTO 11.6.3.3, 11.6.5.1",[
         ...((R.LIMITS[ec.ls]&&R.LIMITS[ec.ls].eq&&S.seismic.eLimEQmode!=="user")?["e_{lim} = B\\left(\\tfrac{1}{3} + \\left(0.4 - \\tfrac{1}{3}\\right)\\gamma_{EQ}\\right)",
-          `e_{lim} = ${fmtT(geo.B)}\\left(\\tfrac{1}{3} + \\left(0.4 - \\tfrac{1}{3}\\right)(${fmtT(ec.c&&ec.c.liveOn?Math.min(1,Math.max(0,+S.seismic.gEQll||0)):0)})\\right) \\quad (\\gamma_{EQ}${ec.c&&ec.c.liveOn?"\\text{ as entered}":" = 0\\text{: permutation without live load}"})`]:[]),
+          `e_{lim} = ${fmtT(geo.B)}\\left(\\tfrac{1}{3} + \\left(0.4 - \\tfrac{1}{3}\\right)(${fmtT(ec.c&&ec.c.liveOn===1?Math.min(1,Math.max(0,+S.seismic.gEQll||0)):0)})\\right) \\quad (\\gamma_{EQ}${ec.c&&ec.c.liveOn===1?"\\text{ as entered}":" = 0\\text{: permutation without live load}"})`]:[]),
         `e_{lim} = ${fmtT(ec.eLim)}\\ \\text{ft} \\quad(${(R.LIMITS[ec.ls]&&R.LIMITS[ec.ls].eq)?(S.seismic.eLimEQmode==="user"?`${fmt(+S.seismic.eFracEQ,3)}·B \\text{ at EE-I (owner rule)}`:`${fmtT(ec.eLim/geo.B,4)}\\,B \\text{ at EE-I}`):`${fmtT(fn.matl==="rock"?+fn.eFracRock:+fn.eFracSoil,3)}\\,B \\text{ at Strength — middle ${fn.matl==="rock"?"nine-tenths":"two-thirds"}}`})`])}
       ${checkLine("Eccentricity",`\\dfrac{|e|}{e_{lim}} = \\dfrac{${fmtT(ec.e)}}{${fmtT(ec.eLim)}}`,ec.dc)}
     `);
@@ -3130,13 +3161,15 @@ function renderTabStab(R){
   }
   const st=R.checks.seat;
   h+=panel("o-seat","3.5","Minimum Support (Seat) Length [4.7.4.4]",`
-    ${eqB("Required support length (percentage N applies per SDC; 100% shown)","AASHTO 4.7.4.4, Eq. 4.7.4.4-1",[
+    ${eqB("Required support length (percentage of N per Table 4.7.4.4-1: Zone "+st.zoneN+", A_s = "+fmt(st.AsN,3)+" → "+st.pctN+" %)","AASHTO 4.7.4.4, Eq. 4.7.4.4-1, Table 4.7.4.4-1",[
       "N = (8 + 0.02L + 0.08H)\\,(1 + 0.000125\\,S^2)",
-      `N = (8 + 0.02(${fmtT(g.spanL)}) + 0.08(${fmtT(st.Hsup)}))\\,(1 + 0.000125(${fmtT(g.skew,1)})^2)`,
-      `N = ${fmtT(st.Nreq)}\\ \\text{in} \\qquad\\text{vs. provided seat} = ${fmtT(st.Nprov)}\\ \\text{in}`])}
+      `N = (8 + 0.02(${fmtT(g.spanL)}) + 0.08(${fmtT(st.Hsup)}))\\,(1 + 0.000125(${fmtT(g.skew,1)})^2) = ${fmtT(st.Nreq)}\\ \\text{in}`,
+      `N_{req} = ${st.pctN}\\%\\cdot N = ${fmtT(st.pctN/100,2)}(${fmtT(st.Nreq)}) = ${fmtT(st.NreqP)}\\ \\text{in}`,
+      `N_{prov} = 12(t_{st} - t_{bw}) - g_{end} = ${fmtT(st.seatIn)} - ${fmtT(st.endGap)} = ${fmtT(st.Nprov)}\\ \\text{in} \\quad(\\text{girder overlap on the seat})`],
+      "N is the girder-to-seat overlap measured normal to the bearing centerline (C4.7.4.4); g_end = girder end to backwall face, including the opening movement (panel I-1). Zone and A_s are set in panel I-11.")}
     ${varsTbl([["L","Bridge length to adjacent expansion joint / end",g.spanL,"ft"],
       ["H",st.HsupMode==="single"?"Single-span bridge: H = 0 [4.7.4.4]":st.HsupMode==="user"?"Average pier height to the next expansion joint (entered) [4.7.4.4]":"Abutment height (stem + backwall) — conservative stand-in for H",st.Hsup,"ft"],["S","Skew",g.skew,"deg"]])}
-    ${checkLine("Seat width",`\\dfrac{N_{req}}{N_{prov}} = \\dfrac{${fmtT(st.Nreq)}}{${fmtT(st.Nprov)}}`,st.dc)}
+    ${checkLine("Seat width",`\\dfrac{N_{req}}{N_{prov}} = \\dfrac{${fmtT(st.NreqP)}}{${fmtT(st.Nprov)}}`,st.dc)}
   `);
   if(S.seismic.on && R.seis){
     const q=R.seis, sOK=isFinite(q.KAE);
@@ -3236,6 +3269,7 @@ function renderTabFound(R){
       :""}
     ${pu.uplift?`
       ${govNote(pu.lbl+" — "+pu.ls)}
+      <div class="eq-note">Live-load cases checked: none; LL + BR + LS; and LS + BR with the girder LL reaction off (the LL reaction on the bridge is not counted as resisting) [C11.5.6].${pu.det&&pu.det.c&&pu.det&&pu.det.c.liveOn===2?" <b>The governing case is LS + BR with the LL reaction off.</b>":""}</div>
       ${eqB("Uplift (tension present)","AASHTO 10.7.3.10",[
         "|P_{min}| \\le \\varphi_{up} R_{n,up}",
         `${fmtT(-pu.P)} \\le (${fmtT(p.phiUp)})(${fmtT(p.RnUp)}) = ${fmtT(pu.RR)}\\ \\text{kip}`])}
@@ -3345,7 +3379,8 @@ function renderTabStruct(R){
       `M_{EH} = \\dfrac{k_{ah}\\gamma H_s^3}{6} = \\dfrac{(${fmtT(kah,4)})(${fmtT(s.gamma,3)})(${fmtT(sd.Hs)})^3}{6} = ${fmtT(sd.Mst_EH)}\\ \\text{kip-ft/ft}`,
       `M_{LS} = \\dfrac{k_{ah}\\gamma h_{eq} H_s^2}{2} = ${fmtT(sd.Mst_LS)}\\ \\text{kip-ft/ft}\\,, \\qquad H_{gird} = ${fmtT(sd.HgirdPerFt,3)}\\ \\text{kip/ft at } z = h_{stem} = ${fmtT(g.hstem)}\\ \\text{ft}`,
       `M_{ecc} = \\dfrac{P_v\\,e_{brg} + \\Sigma W_{sw}\\,e_{sw}}{L_{ab}} = ${fmtT(sd.MeccPerFt)}\\ \\text{kip-ft/ft} \\quad(e_{brg} = ${fmtT(sd.eBrg,3)}\\ \\text{ft toe-ward}, \\; P_v = ${fmtT(sd.Pv)}\\ \\text{kip})`,
-      `M_u = ${fmtT(R.GP.EH[1])}\\,M_{EH} + \\gamma_{LL}M_{LS} + H_{gird}\\,h_{stem} + M_{ecc} = ${fmtT(sd.Mu)}\\ \\text{kip-ft/ft}\\,, \\qquad V_u = ${fmtT(sd.Vu)}\\ \\text{kip/ft}`],
+      `M_u = ${fmtT(R.GP.EH[1])}\\,M_{EH} + \\gamma_{LL}M_{LS} + H_{gird}\\,h_{stem} + M_{ecc} = ${fmtT(sd.Mu)}\\ \\text{kip-ft/ft}\\,, \\qquad V_u = ${fmtT(sd.Vu)}\\ \\text{kip/ft}`,
+      `M_{s} = M_{EH} + M_{LS} + M_{ES} + H_{gird,SI}\\,h_{stem} + M_{ecc,SI} = ${fmtT(sd.Mst_EH)} + ${fmtT(sd.Mst_LS)} + ${fmtT(sd.Mst_ES)} + (${fmtT(sd.HgirdSvc,3)})(${fmtT(g.hstem)}) + ${fmtT(sd.MeccSvc)} = ${fmtT(sd.MsStem)}\\ \\text{kip-ft/ft} \\quad (\\text{Service I, crack control}; M_{ES} = k_{ah}q_{ES}H_s^2/2)`],
       `H_gird = factored (BR + TU + CR/SH + WS + WL)·share ÷ L_ab. M_ecc = moment from the vertical girder reaction P_v acting at eccentricity e_brg = ${fmt(sd.eBrg,3)} ft from the stem centerline (bearing setback), plus the minor stem/backwall self-weight taper eccentricity; positive when the bearing sits toward the toe. Governing limit state: ${esc(sd.ls)}.${sd.eccMin?` M_ecc uses γDC = ${fmt(sd.gDCe)}, γDW = ${fmt(sd.gDWe)}${sd.llE?"":", no LL reaction"} (the minimum-factor / no-LL permutation gives the larger back-face moment because e_brg < 0 or the self-weight eccentricity governs; LS and BR stay on).`:""}${sd.svcNoLL?" Service I M_s for crack control uses no LL reaction (larger).":""} Section at top of footing; t_sb = ${fmt(g.tsb)} ft.`),
     "5.2","Stem — Flexure, Shear, Crack Control (at base)");
   const td=R.toeDem, cT=R.checks.toeFlex;
@@ -3397,9 +3432,11 @@ function renderTabStruct(R){
     ${govNote("Governing single-bearing factored vertical — girder "+bs.pgirder+", "+bs.pls)}
     ${eqB("Factored bearing demand & resistance","AASHTO 5.6.5 (Eq. 5.6.5-1, -2), 5.5.4.2",[
       `A_1 = L_{pad}\\,W_{pad} = ${fmtT(bg.padL,1)}\\times${fmtT(bg.padW,1)} = ${fmtT(bs.A1,0)}\\ \\text{in}^2\\,, \\qquad q_b = \\dfrac{P_u}{A_1} = \\dfrac{${fmtT(bs.Pu)}}{${fmtT(bs.A1,0)}} = ${fmtT(bs.qb,3)}\\ \\text{ksi}`,
-      `m = \\sqrt{A_2/A_1} \\le 2 \\;\\Rightarrow\\; m = ${fmtT(bs.m,3)} \\quad(\\text{from seat spread, } w_{seat}=${fmtT(bs.A2note,1)}\\text{ in})`,
+      `c = \\min(c_{front},\\,c_{back},\\,c_{trans}) = \\min(${fmtT(bs.cFront,1)},\\,${fmtT(bs.cBack,1)},\\,${fmtT(bs.cT,1)}) = ${fmtT(bs.c,1)}\\ \\text{in} \\quad(\\text{${esc(bs.cBy)}})`,
+      `A_2 = (L_{pad}+2c)(W_{pad}+2c) = (${fmtT(bg.padL,1)}+2(${fmtT(Math.max(0,bs.c),1)}))(${fmtT(bg.padW,1)}+2(${fmtT(Math.max(0,bs.c),1)})) = ${fmtT(bs.A2,0)}\\ \\text{in}^2`,
+      `m = \\sqrt{A_2/A_1} = \\sqrt{${fmtT(bs.A2,0)}/${fmtT(bs.A1,0)}} = ${fmtT(bs.mRaw,3)} \\le 2 \\;\\Rightarrow\\; m = ${fmtT(bs.m,3)}`,
       `q_R = \\varphi_b\\,(0.85 f'_c)\\,m = ${fmtT(bs.phiB,2)}(0.85\\times${fmtT(m.fc,1)})(${fmtT(bs.m,3)}) = ${fmtT(bs.qR,3)}\\ \\text{ksi}`],
-      "P_u is the most heavily loaded single bearing (γ_DC,max·DC + γ_DW,max·DW + γ_LL·LL + wind), evaluated at Strength I, IV and V. A₂ is the geometrically-similar confined area available on the seat; m is floored at 1.0 (no spread benefit) and capped at 2.0.")}
+      "P_u is the most heavily loaded single bearing (γ_DC,max·DC + γ_DW,max·DW + γ_LL·LL + wind), evaluated at Strength I, IV and V; the governing bearing is the one with the largest q_b/q_R. A₂ is concentric with the pad, extended by the smallest clear edge distance c: c_front = (t_st − t_bw − setback)·12 − L_pad/2 to the seat front edge, c_back = (setback + t_bw)·12 − L_pad/2 to the stem back face (the stem continues under the backwall), c_trans = the lesser of the distance to the wall end and half the clear distance to the next girder's pad (Fig. 5.6.5-1). m = 1 if c ≤ 0.")}
     ${checkLine("Bearing on concrete",`\\dfrac{q_b}{q_R} = \\dfrac{${fmtT(bs.qb,3)}}{${fmtT(bs.qR,3)}}`,bs.dc)}
     <div class="subhead">Bearing-seat reinforcement (provision)</div>
     <div class="note-box">AASHTO provides <b>no closed-form demand</b> for seat reinforcement under a bearing; a reinforcement mat under each bearing is a prescriptive detailing requirement, with a <b>strut-and-tie evaluation [5.8]</b> required for heavy or edge-loaded bearings. Provided mat: <b>#${bg.seatBar} @ ${fmt(+bg.seatSp,1)} in each way = ${fmt(sm.AsMat)} in²/ft</b>.</div>
@@ -4321,7 +4358,7 @@ async function captureD3(R){
    Runs the frozen benchmark input (the hand-verified built-in example) through the
    LIVE engine and compares key results to baked expected values. Any drift means a
    regression (or an intentional change that requires re-baking). */
-window.__ST_EXPECT={"k_a (Rankine)": 0.3072585245224683, "P_a (kip/ft)": 8.92278755213248, "EH_h total (kip)": 392.6026522938291, "ΣDC wall (kip)": 722.6999999999999, "EV (kip)": 501.5999999999999, "h_eq (ft)": 2, "Sliding D/C": 1.1527595856623034, "Sliding R_R (kip)": 510.8645252361067, "Eccentricity e (ft)": 2.507894818378456, "Bearing q_f (ksf)": 7.560165332011858, "Bearing D/C": 0.933353744692822, "Seat N_req (in)": 11.12, "Stem M_u (kip·ft/ft)": 112.0617801358754, "Stem φM_n (kip·ft/ft)": 302.7336470588236, "Shear-friction D/C": 0.05761809346762622, "Bearing-seat q_b (ksi)": 0.5711805555555556};
+window.__ST_EXPECT={"k_a (Rankine)": 0.3072585245224683, "P_a (kip/ft)": 8.92278755213248, "EH_h total (kip)": 392.6026522938291, "ΣDC wall (kip)": 722.6999999999999, "EV (kip)": 501.5999999999999, "h_eq (ft)": 2, "Sliding D/C": 1.1527595856623034, "Sliding R_R (kip)": 510.8645252361067, "Eccentricity e (ft)": 3.065583297600188, "Bearing q_f (ksf)": 7.560165332011858, "Bearing D/C": 0.933353744692822, "Seat N_req (in)": 11.12, "Stem M_u (kip·ft/ft)": 112.0617801358754, "Stem φM_n (kip·ft/ft)": 302.7336470588236, "Shear-friction D/C": 0.05761809346762622, "Bearing-seat q_b (ksi)": 0.5711805555555556};
 /* Baked from the hand-verified built-in example (Rankine ka, Pa, EHh, sliding, bearing, stem Mu
    each independently hand-checked during validation). If the engine or the built-in defaults are
    intentionally changed, re-validate by hand and re-bake these values. */
@@ -4842,9 +4879,10 @@ window.addEventListener("message",ev=>{
       S.bearing.padL=D; S.bearing.padW=+(A/D).toFixed(4);
       circNote=` · circular pad D = ${D.toFixed(2)} in entered as L = D, W = πD/4 = ${(A/D).toFixed(2)} in (equal area)`;
     }
-    if(p.nBrgPerGird) S.bearing.nBrgPerGird=+p.nBrgPerGird;
+    // bearings per girder: the EDM has no count input (its PAD message always carries 1), so the abutment keeps its own I-10 value
+    const nbNote=(p.nBrgPerGird!=null&&+p.nBrgPerGird!==+S.bearing.nBrgPerGird)?` · bearings per girder kept at ${+S.bearing.nBrgPerGird} (abutment input; the module sends no count)`:"";
     buildInputs(); recalcAll(); scheduleSave();
-    document.getElementById("saveStatus").textContent="pad received from EDM — thermal/creep force updated"+(p.govDC?` (D/C ${(+p.govDC).toFixed(2)})`:"")+circNote;
+    document.getElementById("saveStatus").textContent="pad received from EDM — thermal/creep force updated"+(p.govDC?` (D/C ${(+p.govDC).toFixed(2)})`:"")+circNote+nbNote;
   }
 });
 
@@ -4860,6 +4898,7 @@ function inputEchoHTML(){
     ["Backwall height / thickness",fmt(g.hbw)+" / "+fmt(g.tbw),"ft"],
     ["Stem height; top / bottom thickness",fmt(g.hstem)+"; "+fmt(g.tst)+" / "+fmt(g.tsb),"ft"],
     ["Bearing setback from backwall face",g.brgSetback,"ft"],
+    ["Girder end to backwall face g_end (support length)",fmt(+g.endGap||0,1),"in"],
     ["Toe / stem base / heel  (B total)",fmt(g.Ltoe)+" / "+fmt(g.tsb)+" / "+fmt(g.Lheel)+"  (B = "+fmt(g.Ltoe+g.tsb+g.Lheel)+")","ft"],
     ["Footing thickness",g.tf,"ft"],["Wall (stem/backwall) length L_ab",g.Lab,"ft"],["Footing length L_ftg",fmt(g.Lftg),"ft"],
     ["Soil height over heel / backfill slope β",fmt(g.soilH)+" / "+fmt(g.beta,1)+"°","ft / deg"],
@@ -5531,16 +5570,20 @@ document.addEventListener("DOMContentLoaded",init);
       const all=[];
       const addC=(c,noLSv)=>{ const My=c.V*xc-c.Mv+c.Mh, Mx=c.Mt-c.V*yc;   // about the reference point; + toward the toe / + toward +y
         all.push({c, noLSv, v:{P:r3(c.V), Vx:r3(c.Hx), Vy:r3(c.Hy), Mx:r3(Mx), My:r3(My)}, H:Math.hypot(c.Hx,c.Hy)}); };
-      for(const pl of R.permutations(ls)) addC(R.comboEffects(ls,pl.perm,pl.liveOn,false),false);
+      for(const pl of R.permutations(ls,true)) addC(R.comboEffects(ls,pl.perm,pl.liveOn,false),false);   // incl. LS + BR with the LL reaction off [C11.5.6]
       // the same live-load permutations without the vertical LS over the heel (it can help stability: less V, smaller My
       // toward the heel); appended after the cases above, so on a tie the case with LSv is kept
-      for(const pl of R.permutations(ls)){ if(!pl.liveOn) continue;
+      for(const pl of R.permutations(ls,true)){ if(!pl.liveOn) continue;
         const c=R.comboEffects(ls,pl.perm,pl.liveOn,true); if(Math.abs(c.V-R.comboEffects(ls,pl.perm,pl.liveOn,false).V)>1e-9) addC(c,true); }
       if(!all.length) return;
       const pick=(f,s)=>all.reduce((b,a)=>s*f(a)>s*f(b)+1e-9?a:b,all[0]);
       const sameV=(a,b)=>["P","Vx","Vy","Mx","My"].every(k=>a.v[k]===b.v[k]);
       const mine=[], put=(a,tag)=>{ const same=mine.find(m=>sameV(m.a,a)); if(same){ same.tags.push(tag); return; } mine.push({a,tags:[tag]}); };
       [["V max",a=>a.v.P,1],["V min",a=>a.v.P,-1],["My max",a=>a.v.My,1],["My min",a=>a.v.My,-1],["H max",a=>a.H,1]].forEach(([tag,f,s])=>put(pick(f,s),tag));
+      // spread footing: also the sliding- and eccentricity-critical permutations (largest H/V and |My|/V), which can be the
+      // LS + BR case with the girder LL reaction off [C11.5.6]
+      if(!pile){ const pos=all.filter(a=>a.v.P>1e-9); if(pos.length){ const pk=(f)=>pos.reduce((b,a)=>f(a)>f(b)+1e-9?a:b,pos[0]);
+        put(pk(a=>a.H/a.v.P),"H/V max"); put(pk(a=>Math.abs(a.v.My)/a.v.P),"|e| max"); } }
       if(pile && R.pile.perLS && R.pile.perLS[ls]){   // the permutations that govern this calculator's own pile table
         const q=R.pile.perLS[ls], find=c=>c&&all.find(a=>a.c.V===c.V&&a.c.Mv===c.Mv&&a.c.Mh===c.Mh&&a.c.Hx===c.Hx&&a.c.Mt===c.Mt&&a.c.Hy===c.Hy);
         const b1=find(q.best&&q.best.c), b2=find(q.worstMin&&q.worstMin.c); if(b1) put(b1,"pile P max"); if(b2) put(b2,"pile P min"); }
@@ -5570,7 +5613,7 @@ document.addEventListener("DOMContentLoaded",init);
       geometry:{ footingWidthB:r3(B), footingLength:r3(+S.geom.Lftg||+S.geom.Lab), footingThickness:r3(S.geom.tf) },
       signConvention:SIGN, cases:cs,
       notes:[
-        "Each limit state's load-factor permutations (γp max/min of DC, DW, EV, EH, ES, with and without live load) are the calculator's own; per limit state the permutations giving V max, V min, My max, My min and the largest horizontal resultant are sent, identical ones merged"+(pile?"; in the pile branch also the permutations that give the largest and smallest pile reaction in the calculator's pile table (\"pile P max\", \"pile P min\").":"."),
+        "Each limit state's load-factor permutations (γp max/min of DC, DW, EV, EH, ES; live load on, off, and LS + BR with the girder LL reaction off [C11.5.6]) are the calculator's own; per limit state the permutations giving V max, V min, My max, My min and the largest horizontal resultant are sent, identical ones merged"+(pile?"; in the pile branch also the permutations that give the largest and smallest pile reaction in the calculator's pile table (\"pile P max\", \"pile P min\").":"; for a spread footing also the permutations with the largest H/V (sliding) and the largest |My|/V (eccentricity) (\"H/V max\", \"|e| max\")."),
         "Strength and Extreme Event cases are factored (factored:true); Service I has load factors of 1.0 (factored:false).",
         "Every case includes the abutment and footing self-weight, the soil over the heel (EV), the earth pressure (EH, ES, LS) and the superstructure loads, at the bottom of the footing.",
         "The vertical live-load surcharge over the heel (LSv) is included as in the calculator's bearing and pile checks. Each live-load permutation is also offered without it (its sliding and eccentricity checks leave it out where it helps); a case picked from those is marked \"(no heel LS)\".",
```


## 2026-10-20 — PR: claude/abut-followups — EE inertia share, punching depth over the pile heads, bearings per girder, connection force span rule, Strength IV removed (PR link added after merge)

Engineer decisions of 2026-10-20 (follow-ups to F27–F38: open items N4, N7 and "2 bearings per girder", plus the review note on the constants list), and two further items the engineer asked for the same day (connection force single-span rule; Strength IV). Basis: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), checked against the text (3.4.1/C3.4.1, 3.10.9.1, 3.10.9.2, 4.7.4.2, 5.12.8.6.1, 5.12.8.6.3). Numbers come from the real `computeAll()` of origin/main `877876b` (before) and of this branch (after) in headless Chromium. "Default project" = the built-in benchmark (`benchState()`: B = 13 ft, L_ab = 44 ft, t_f = 3 ft, 6 girders, DC/DW/LL = 85/12/70 kip per girder; ΣDC + ΣDW = 582 kip; seat z = 17 ft). The exact edits are in the appendix as a unified diff against `877876b`.

### F39. Extreme Event I superstructure inertia: own share input s_EQ, default 100 % (was the I-6 TU share)   [calc change] [MORE conservative with the floating 50 % share]
- **Where:** `computeAll` C-4b, anchor `// superstructure inertia through the bearings/keepers`; new input `seismic.shEQ` (%, I-11, shown with EE-I on, range 0–100); Tab 3 §3.6a shows EQ_sup symbolic → substituted → result; basis note 3; input echo.
- **Before:** `if(R.seis){ R.seis.EQsup=(+S.seismic.As)*(agg.DC.P+agg.DW.P)*shTU; } // superstructure inertia through bearings, thermal-path share`
- **After:**
  ```js
  if(R.seis){ const shEQ=Math.min(100,Math.max(0,+S.seismic.shEQ))/100; R.seis.shEQ=isFinite(shEQ)?shEQ:1; R.seis.EQsup=(+S.seismic.As)*(agg.DC.P+agg.DW.P)*R.seis.shEQ; }
  ```
  The static longitudinal shares of I-6 (BR, TU, CR·SH, WS) are unchanged.
- **Provision:** AASHTO LRFD 10th Ed. Art. 11.6.5.1 (wall inertia and seismic earth pressure; the superstructure inertia carried into the abutment is a project load path), 3.10.9 (connection forces). The share is an engineer input (decision 2026-10-20: default 100 %).
- **Check case (default project, EE-I on, γEQ = 0):**
  - A_s = 0.30: EQ_sup before 0.30·582·0.50 = 87.3 kip; after 0.30·582·1.00 = **174.6 kip**. ΔM at the seat = 87.3·17.0 = 1484.1 kip-ft.
    - Eccentricity (EE-I 0.90DC + 0.65DW + 1.00EV + 1.50EH + 1.00EQ, V = 1657.83 kip): e = 4.8555 + 1484.1/1657.83 = 4.8555 + 0.8952 = **5.751 ft**; D/C 4.8555/4.3333 = 1.120 → 5.751/4.3333 = **1.327**.
    - Bearing: B′ = 13 − 2·5.751 = 1.499 ft; q = 1657.83/(1.499·44) = 25.14 ksf; D/C = 25.14/(0.80·18) = **1.746** (EE-I now governs; before Strength I 0.933 governed, EE-I was 0.796).
    - Sliding: EE-I H = 981.6 → 1068.9 kip, R_R = 918.95 kip: D/C 1.068 → **1.163** (EE-I now governs over Constr — Str I 1.153).
    - Stem M_u: 131.99 → 159.77 kip-ft/ft (Δ = 87.3·14/44 = 27.78).
    - Piles + EE-I (A_s = 0.30): P_min −49.30 → −71.12 kip (Δ = 1484.1·4.25/289 = 21.83), uplift D/C 49.30/60 = 0.822 → **1.185**; toe shear D/C 0.938 → 1.037.
  - A_s = 0.15: EQ_sup 43.65 → **87.3 kip**; e 3.357 → 3.357 + 742.05/1657.83 = **3.805 ft**, eccentricity D/C 0.775 → **0.878**; stem M_u 112.06 → 113.88 kip-ft/ft (EE-I now governs the stem).

### F40. Pile punching: effective depth over the pile heads (embedment and clear cover inputs)   [calc change] [MORE conservative]
- **Where:** `computeAll` C-13, anchor `// bottom mat above the pile heads`; new inputs `piles.embed` (in, default 12) and `piles.clrTop` (in, default 3) in I-7; Tab 4 §4.6 shows h_p, d_e and d_v worked; error when d_e ≤ 0; input echo.
- **Before:**
  ```js
  const deF=g.tf*12-m.coverF-dbF;                     // footing effective depth (bottom mat), in
  const dvF=Math.max(0.9*deF,0.72*g.tf*12);            // in
  ```
- **After:**
  ```js
  const embP=Math.max(0,+p.embed||0), clrP=Math.max(0,+p.clrTop||0);
  const hP=g.tf*12-embP;                               // in
  const deF=hP-clrP-dbF;                               // footing effective depth over the pile heads, in
  const dvF=Math.max(0.9*deF,0.72*hP);                 // in
  ```
- **Convention:** d_e is measured from the top of the footing to the centroid of the bottom mat. The tool's punching check already used −d_b (centroid of the two orthogonal bottom layers), so that convention is kept: d_e = t_f − e_pile − c_top − d_b. The engineer's decision note wrote −d_b/2 (centroid of the lowest layer only); the difference is shown below. In d_v = max(0.9d_e, 0.72h) the height h is taken as h_p = t_f − e_pile (the footing above the pile heads).
- **Provision:** AASHTO LRFD 10th Ed. Art. 5.12.8.6.1 (critical section for two-way action at 0.5d_v from the reaction area), 5.12.8.6.3 (Eq. 5.12.8.6.3-1), 5.7.2.8 (d_v).
- **Check case (default project, piles; #8 toe bars d_b = 1.0 in, 12 in pile, f′c = 4 ksi, V_u = 212.71 kip):**
  - Before: d_e = 36 − 3 − 1.0 = 32.0 in; d_v = max(28.8, 25.92) = 28.8 in; b₀ = 4(12 + 28.8) = 163.2 in; V_n = 0.126·2·163.2·28.8 = 1184.44 kip; D/C = 212.71/(0.9·1184.44) = **0.200**.
  - After: h_p = 36 − 12 = 24.0 in; d_e = 24 − 3 − 1.0 = 20.0 in; d_v = max(18.0, 17.28) = 18.0 in; b₀ = 4(12 + 18) = 120 in; V_n = 0.126·2·120·18 = 544.32 kip; D/C = 212.71/489.89 = **0.434**.
  - With −d_b/2 instead: d_e = 20.5, d_v = 18.45, b₀ = 121.8, V_n = 566.3 kip, D/C 0.417.
- **Pile-cap one-way shear (checked, not changed):** the toe (and heel) one-way shear does not use the punching depth. It comes from `sectionCheck`, whose d = t_f − c_F − d_b/2 (footing cover from the bottom face, 36 − 3 − 0.5 = 32.5 in) is shared with the toe flexure and crack control. See open items.

### F41. Bearings per girder > 1: seat bearing and the EDM load per bearing   [calc change] [LESS conservative where n > 1; was conservative]
- **Where:** `computeAll` C-15, anchor `// (box / tub girders) each bearing takes the girder reaction / n`; `edmPayload()`, anchor `load on one bearing = girder reaction / bearings per girder`; the input "Bearings per girder line" moves from I-6b (shown only with calculated TU/CR·SH) to I-10, so it can always be set (I-6b shows the value); Tab 5 §5.6 shows P_u = P_u,girder/n_b worked; input echo. TU/CR·SH totals unchanged (F37).
- **Before:** `let P=SI, ls="Strength I"; … const mi=seatM(i), dci=(P/A1)/(phiB*0.85*m.fc*mi.m);` and `const Pdl=(DC+DW); const Pll=LL;` per girder in the INIT payload.
- **After:** `const PG=P; P=PG/nBg;` (nBg = round(bearing.nBrgPerGird) ≥ 1) before the stress, and `Pdl=(DC+DW)/nBg; Pll=LL/nBg;` in the payload. The payload format is unchanged (the EDM receives one bearing's load); `elastomeric_design_module.html` is not changed.
- **Provision:** statics; AASHTO LRFD 10th Ed. Art. 5.6.5 (bearing on concrete, per loaded area).
- **Check case (default project, n_b = 2):** P_u,girder = 1.25·85 + 1.50·12 + 1.75·70 = 246.75 kip → P_u = 123.38 kip; q_b = 123.38/432 = 0.286 ksi (before 0.571); q_R = 0.70·0.85·4·2.0 = 4.76 ksi; D/C 0.120 → **0.060**. EDM INIT: P_DL 97 → **48.5** kip, P_LL 70 → **35** kip.
- **Limitation (stated in §5.6):** with n_b > 1 each pad is still placed at the girder centreline for c_trans (pad spacing within a girder is not an input).

### F42. Constants list: γWS Strength III compared with 1.00 (was 1.40)   [display only]
- **Where:** `computeAll` C-20 `DEF` list. **Before:** `["factors.wsS3",1.40,"γWS Strength III (design basis)"]`. **After:** `["factors.wsS3",1.00,"γWS Strength III [T.3.4.1-1]"]` (the tool default since the 8th Ed. wind revision, and the 10th Ed. Table 3.4.1-1 value). The default project no longer lists γWS,III as differing from the default. No result change. (N8 of the 2026-10-19 review.)

### F43. Minimum connection force: single-span rule only for a single-span bridge   [calc change, design note] [LESS conservative for multispan bridges]
- **Where:** `computeAll` C-9, anchor `const single=g.HsupMode==="single";`; Tab 3 §3.6 (title says single-span / multispan; F_1span shown only for a single span; multispan Zones 2–4 say the force comes from the seismic analysis); I-11 tooltip.
- **Span count:** the tool's only span-count input is I-1 "Pier height H in N [4.7.4.4]" = "Single-span bridge: H = 0". That setting now also marks the bridge as single-span here; any other setting (default "Stem + backwall height") is treated as multispan. No new input; §3.6 says which input decides.
- **Before:** `const F1=zone===1? cZ1*Wtrib : 0, F0=AsC*Wperm, Fconn=Math.max(F1,F0);`
- **After:**
  ```js
  const F1=zone===1? cZ1*Wtrib : 0, F0=AsC*Wperm;
  const Fconn=zone===1? (single? Math.max(F1,F0) : F1) : (single? F0 : NaN);
  ```
- **Provision:** AASHTO LRFD 10th Ed. Art. 3.10.9.1 and 4.7.4.2 (A_s × tributary permanent load for single-span bridges, any zone), 3.10.9.2 (Zone 1: 0.15 / 0.25 × permanent + EQ live load), 3.10.9.3 / 3.10.9.4 (Zones 2–4, from the analysis).
- **Check case (default project, ΣDC + ΣDW = 582 kip, γEQ = 0):**
  - Zone 1, A_s = 0.15: F_Z1 = 0.25·582 = 145.5 kip governs either way: **unchanged** (145.5 kip; 24.25 kip per beam).
  - Zone 1, A_s = 0.30, multispan (default H setting): before max(145.5, 0.30·582 = 174.6) = 174.6 kip; after F_Z1 = **145.5 kip** (29.10 → 24.25 kip per beam). Single-span: 174.6 kip (unchanged).
  - Zone 3, A_s = 0.15: multispan before 87.3 kip (floor only); after **not computed** ("from the seismic analysis"); single-span 87.3 kip (unchanged).

### F44. Strength IV removed from the abutment limit states   [calc change] [no D/C changed in the tested projects]
- **Where:** `computeAll` C-6 `LIMITS` (anchor `// Strength IV is not a limit state of this tool`), `STR_LIMITS`, the seat bearing loop (C-15); the I-8 input "γ DC max — Strength IV" is replaced by a note; the C-20 constants list entry for it is removed; the V&M selector loses "Strength IV"; basis note 6 says why; `migrate()` moves a saved V&M / 3-D selection "ls:Strength IV" to "ls:Strength I".
- **Before:** `"Strength IV": {LL:0, WS:0, WL:0, TU:+F.gTU, CR:+F.gCR, perm:true, liveOpt:false, dcMax:(+F.gpDCmaxS4||1.50)}`; `STR_LIMITS=["Strength I","Strength III","Strength IV","Strength V","Constr — Str I"]`; seat: `const SIV=LIMITS["Strength IV"].dcMax*DC+GP.DW[1]*DW; … if(SIV>P){P=SIV;ls="Strength IV";}`.
- **After:** no Strength IV entry; `STR_LIMITS=["Strength I","Strength III","Strength V","Constr — Str I"]`; seat compares Strength I and V only. `factors.gpDCmaxS4` stays in the saved data (unused); the `dcMax` code paths stay (no limit state sets it).
- **Provision:** AASHTO LRFD 10th Ed. Art. 3.4.1 (Strength IV: dead-load force effects in bridge superstructures) and C3.4.1 (the combination does not apply to substructures, earth-retaining systems or bearing design).
- **Hand-offs:** the foundation-loads payload (HANDOFF.md §4.6) is built from `Object.keys(R.LIMITS)`, so it no longer carries Strength IV cases; the format is unchanged and Pile Designer / Spread Footing take whatever limit states arrive. No other hand-off uses it.
- **Check case:** in all 12 tested variants (default, EE-I A_s 0.15 / 0.30, piles, piles + EE-I, 2 bearings, single-span / multispan A_s 0.30, Zone 3 multispan / single-span, rock, front batter) Strength IV governed no check: no D/C changed. Seat: Strength IV 1.50·85 + 1.50·12 = 145.5 kip < Strength I 246.75 kip. Where it could govern (DC/LL > 7 with a 1.50 DC factor) the result was over-conservative and outside the 10th Ed. scope.

### Self-test
- `__ST_EXPECT` unchanged (16 values); the self-test passes (the benchmark has EE-I off, spread footing, one bearing per girder, Strength IV not governing).

### Saved data (CLAUDE.md §5)
- No key renamed and no format change. New fields: `seismic.shEQ` (%), `piles.embed` (in), `piles.clrTop` (in); `meta.defRev` = 3.
- `migrate()` anchor `// defRev 3 (2026-10-20)`: a project without `shEQ` gets 100 % (engineer decision); when its old effective share (the I-6 TU share: 50 % floating; 100 % with fixed bearing or calculated TU) was not 100 %, the one-time notice says "Seismic share of superstructure inertia … set to 100 % — … used the floating TU share (50 %) before; change it if wanted" (with "(Extreme Event I is off)" when off). A project without `embed`/`clrTop` gets 12 / 3 in; a pile project gets a notice line ("… the punching-shear depth is now measured to the bottom mat above the pile heads — check them"). The notice shows once (the migrated project is autosaved).
- `ui.vmSel` / `ui.d3Sel` = "ls:Strength IV" → "ls:Strength I" (display selection only).
- Verified: projects autosaved by `877876b` (piles + EE-I + 2 bearings + V&M on Strength IV; spread with EE-I off; fixed-bearing model) open in the branch with the expected notice lines (none for the fixed model), shEQ = 100, embed 12, clrTop 3, the selection moved to Strength I, and no notice after a reload.

### How verified
- `node tests/check-syntax.mjs abutment_calculator.html`: all scripts pass.
- Headless Chromium, `877876b` vs branch, `computeAll()` (`benchState()` + variant) on the 12 variants listed in F44: the only differences are those listed in F39–F44; every other check D/C is identical. Every tab renders with no page error; all TeX strings of four variants (194–206 each) render in KaTeX 0.16.9 with `throwOnError`. `node tests/compare.mjs --tool page --file abutment_calculator.html`: storage same, page text differs only by the changed labels.
- **Other copies:** none (the EDM payload change needs no change in `elastomeric_design_module.html`).

### Open items (not changed)
- **Pile-cap one-way shear and toe flexure with the mat over the pile heads (engineer question).** `sectionCheck` uses d = t_f − c_F − d_b/2 from the footing bottom (32.5 in in the default pile project) for the toe flexure, crack control and one-way shear. With the bottom mat over 12 in embedment + 3 in clear: d = 20.5 in, d_v = max(18.45, 0.72·24 = 17.28) = 18.45 in, φV_c = 0.9·0.0316·2·√4·12·18.45 = 25.18 kip/ft against V_u = 37.26 kip/ft → D/C **1.48** (now 37.26/39.93 = 0.933). Not changed: it also changes the toe flexure and crack control, which share the same d.
- **Span count:** F43 reuses the I-1 "Single-span bridge: H = 0" setting. If the engineer wants a separate "single-span bridge" checkbox (so that H can be "stem + backwall" while the span count is single), say so.
- **C3.10.9.1:** abutments of single-span bridges are not subject to acceleration-augmented soil pressure. The tool still applies M–O when EE-I is on, whatever the span count.
- **c_trans with n_b > 1** (pad spacing within a girder) is not modelled (F41).
- 5.6.5 non-uniform-stress m (0.75√(A₂/A₁) ≤ 1.5) not applied (from F38).

### Appendix — unified diff (exact before/after)
```diff
diff --git a/abutment_calculator.html b/abutment_calculator.html
index 08db78f..51b0834 100644
--- a/abutment_calculator.html
+++ b/abutment_calculator.html
@@ -614,6 +614,7 @@ function defaultState(){
       offX:0.0, offY:0.0,
       Rn:330.0, phiC:0.70, RnUp:100.0, phiUp:0.60,
       pileSize:12.0, pileShape:"hp",  // width/diameter (in); 'square' | 'round' | 'hp' — punching perimeter
+      embed:12.0, clrTop:3.0,         // pile embedment into the footing (in); clear cover from the pile top to the bottom mat (in) — punching depth [5.12.8.6]
       dd:0.0, gDD:1.10                    // drag load DR per pile (kip) and γDR for structural strength [T.3.4.1-1 note: 1.10 structural, 0.00 geotechnical]
     },
     joint:{ prep:"roughened" },       // stem-footing construction joint: 'monolithic'|'roughened'|'smooth' [5.7.4.4]
@@ -632,7 +633,8 @@ function defaultState(){
       gEHEQmode:"gp",                                             // EE-I γEH: "gp" = γp max/min [T.3.4.1-1/-2]; "agency" = fixed gEHEQ
       phiTauEQ:1.00, phiBEQ:0.80, phiCEQ:1.00, eFracEQ:0.3333,    // extreme-event resistance factors [11.5.8: 1.0; bearing 0.8 for semigravity walls; 10.5.5.3.3]; e/B (used only with eLimEQmode "user")
       eLimEQmode:"aashto",                                        // EE-I e limit: "aashto" = B·(1/3 + (0.4 − 1/3)·γEQ) soil and rock [11.6.5.1]; "user" = fixed eFracEQ
-      zone:1 },                                                   // seismic zone [T.3.10.6-1]: connection force [3.10.9]
+      zone:1,                                                     // seismic zone [T.3.10.6-1]: connection force [3.10.9]
+      shEQ:100 },                                                 // seismic share of the superstructure inertia at this abutment (%): EQsup = A_s·(DC+DW)·shEQ
     meta:{ revs:[] },                                             // revision history: {n, ts, fp} on each project save
     factors:{
       // Table 3.4.1-1 / 3.4.1-2 — all editable
@@ -733,6 +735,8 @@ const VALID = {
   "reinf.toe.sp":{hard:[2,24], typ:[4,18], msg:"Bar spacing outside the typical 4–18 in range."},
   "reinf.heel.sp":{hard:[2,24], typ:[4,18], msg:"Bar spacing outside the typical 4–18 in range."},
   "piles.pileSize":{hard:[6,60], typ:[10,36], msg:"Pile size/diameter outside the typical 10–36 in range."},
+  "piles.embed":{hard:[0,60], typ:[6,24], msg:"Pile embedment into the footing outside the typical 6–24 in range."},
+  "piles.clrTop":{hard:[0,12], typ:[2,6], msg:"Clear cover from the pile top to the bottom mat outside the typical 2–6 in range."},
   "bearing.padL":{hard:[3,60], typ:[8,36], msg:"Bearing pad length (along span) outside the typical 8–36 in range."},
   "bearing.padW":{hard:[3,72], typ:[8,48], msg:"Bearing pad width (transverse) outside the typical 8–48 in range."},
   "bearing.seatSp":{hard:[2,18], typ:[4,12], msg:"Seat mat spacing outside the typical 4–12 in range."},
@@ -742,6 +746,7 @@ const VALID = {
   "seismic.khR":{hard:[0.1,1.0], typ:[0.5,1.0], msg:"k_h ratio: 0.5 applies to walls free to displace 1–2 in [11.6.5.2.2]; 1.0 for restrained walls."},
   "seismic.kv":{hard:[0,0.5], typ:[0,0.2], msg:"k_v is commonly taken as 0 for walls."},
   "seismic.hEQr":{hard:[0.33,0.7], typ:[0.4,0.6], msg:"ΔPAE application height ratio outside the common 0.4–0.6H range."},
+  "seismic.shEQ":{hard:[0,100], typ:[50,100], msg:"Seismic share of the superstructure inertia below 50 % — confirm the restraint (keepers / shear keys) at both supports."},
   "constr.hFill":{hard:[0,80], typ:[0,40], msg:"Construction backfill height appears high — verify."},
   "constr.gLL":{hard:[0,2], typ:[0,1.75], msg:"γLL during construction outside 0–1.75."},
   "fnd.eFracSoil":{hard:[0.1,0.5], typ:[0.33,0.34], msg:"Soil eccentricity limit differs from 11.6.3.3 (middle two-thirds, f = 1/3) — confirm the governing edition."},
@@ -966,6 +971,8 @@ function migrate(){
   if(!S.ui.d3Sel) S.ui.d3Sel="ls:Strength I";
   if(!S.ui.d3Tog) S.ui.d3Tog={piles:true,P:true,Vx:true,Vy:true,eh:true,ls:true,soil:true,water:true,dims:true,wire:false};
   if(!S.ui.vmSel) S.ui.vmSel="ls:Strength I";
+  if(S.ui.vmSel==="ls:Strength IV") S.ui.vmSel="ls:Strength I";   // Strength IV removed (3.4.1, C3.4.1)
+  if(S.ui.d3Sel==="ls:Strength IV") S.ui.d3Sel="ls:Strength I";
   if(S.geom.Lftg===undefined) S.geom.Lftg=S.geom.Lab;   // footing length defaults to wall length (single-length model)
   if(S.mat.ag===undefined) S.mat.ag=0.75;                 // max aggregate size (in), 5.7.3.4.2
   if(S.factors.gpDCmaxS4===undefined) S.factors.gpDCmaxS4=1.50;   // Strength IV γDC max [T.3.4.1-2]
@@ -996,6 +1003,24 @@ function migrate(){
     if(S.geom.endGap===undefined){ S.geom.endGap=4.0; DEFAULTS_NOTICE=(DEFAULTS_NOTICE||[]).concat(["Girder end to backwall face g_end (new input: support length = seat width − g_end [4.7.4.4]) set to 4 in — check it"]); }
     S.meta.defRev=2;
   }
+  // defRev 3 (2026-10-20): new inputs. Seismic share of the superstructure inertia (was the I-6 TU share; now 100 % unless
+  // changed, engineer decision); pile embedment and clear cover over the pile heads for the punching depth [5.12.8.6].
+  if(!(S.meta.defRev>=3)){
+    const add=[];
+    if(S.seismic.shEQ===undefined){
+      const Lg0=S.longit||{}, d0=S.dist||{};
+      const old=Lg0.computeTU?100:(d0.model==="fixed"?100:+d0.shTU);
+      S.seismic.shEQ=100;
+      if(!(Math.abs(old-100)<1e-9)) add.push("Seismic share of superstructure inertia at this abutment (new input, panel I-11) set to 100 % — the Extreme Event I superstructure inertia used the floating TU share ("+(isFinite(old)?old.toFixed(0):"—")+" %) before; change it if wanted"+(S.seismic.on?"":" (Extreme Event I is off)"));
+    }
+    if(S.piles.embed===undefined||S.piles.clrTop===undefined){
+      if(S.piles.embed===undefined) S.piles.embed=12.0;
+      if(S.piles.clrTop===undefined) S.piles.clrTop=3.0;
+      if(S.fnd.branch==="pile") add.push("Pile embedment into the footing 12 in and clear cover from the pile top to the bottom mat 3 in (new inputs, panel I-7): the punching-shear depth is now measured to the bottom mat above the pile heads [5.12.8.6] — check them");
+    }
+    S.meta.defRev=3;
+    if(add.length) DEFAULTS_NOTICE=(DEFAULTS_NOTICE||[]).concat(add);
+  }
 }
 function seedExampleReactions(){
   const ex={DC:{P:85},DW:{P:12},LL:{P:70},BR:{Vx:3.5},TU:{Vx:2.5},CRSH:{Vx:1.5},
@@ -1202,7 +1227,7 @@ function buildInputs(){
       <div class="subhead">Elastomeric pad shear parameters [14.6.3.1]</div>
       ${inpRow("Shear modulus G","bearing.G","ksi",{title:"AASHTO 14.7.6.2 — 50-durometer nominal ≈0.095–0.200 ksi. Use the low-temperature value for cold-climate thermal force."})}
       ${inpRow("Total elastomer thickness h<sub>rt</sub>","bearing.hrt","in",{title:"Σ of the interior elastomer layer thicknesses subject to shear."})}
-      ${inpRow("Bearings per girder line","bearing.nBrgPerGird","–")}
+      <div class="in-note">Bearings per girder line n = ${fmt(+S.bearing.nBrgPerGird,0)} (panel I-10).</div>
       <div class="in-note">Pad plan area A = padL × padW = ${fmt(S.bearing.padL)} × ${fmt(S.bearing.padW)} in (from panel I-10).</div>
     `:""}
   `);
@@ -1247,6 +1272,8 @@ function buildInputs(){
       <div class="subhead">Pile section (for punching-shear perimeter)</div>
       ${selRow("Pile shape","piles.pileShape",[["hp","H-pile (square envelope)"],["square","Square / precast"],["round","Round / pipe / drilled"]])}
       ${inpRow("Pile size / diameter","piles.pileSize","in",{title:"Governs the loaded area and the two-way (punching) shear critical perimeter through the footing. [AASHTO 5.12.8.6]"})}
+      ${inpRow("Pile embedment into the footing","piles.embed","in",{title:"Length of pile inside the footing above its bottom face. The punching-shear depth is measured above the pile heads (Tab 4 §4.6)."})}
+      ${inpRow("Clear cover, pile top to bottom mat","piles.clrTop","in",{title:"Clear distance from the top of the piles to the bottom reinforcement mat. d_e = t_f − embedment − this cover − d_b (Tab 4 §4.6)."})}
     `);
   }
 
@@ -1258,7 +1285,7 @@ function buildInputs(){
     ${inpRow("γ DW max","factors.gpDWmax","–")}${inpRow("&nbsp;&nbsp;γ DW min","factors.gpDWmin","–")}
     ${inpRow("γ EV max","factors.gpEVmax","–")}${inpRow("&nbsp;&nbsp;γ EV min","factors.gpEVmin","–")}
     ${inpRow("γ EH max (active)","factors.gpEHmax","–")}${inpRow("&nbsp;&nbsp;γ EH min","factors.gpEHmin","–")}
-    ${inpRow("γ DC max — Strength IV","factors.gpDCmaxS4","–",{title:"Table 3.4.1-2: DC maximum 1.50 for Strength IV only"})}
+    <div class="in-note">Strength IV is not checked: Art. 3.4.1 defines it for dead-load force effects in superstructures, and C3.4.1 excludes substructures, earth-retaining systems and bearing design.</div>
     <div class="subhead">Transient loads — Table 3.4.1-1</div>
     ${inpRow("γ LL — Strength I (also BR, LS)","factors.llS1","–")}
     ${inpRow("γ LL — Strength V","factors.llS5","–")}
@@ -1296,6 +1323,7 @@ function buildInputs(){
     <div class="subhead">Bearing pad (each bearing) — for concrete bearing stress [5.6.5]</div>
     ${inpRow("Pad length (along span, longitudinal)","bearing.padL","in")}
     ${inpRow("Pad width (transverse)","bearing.padW","in")}
+    ${inpRow("Bearings per girder line","bearing.nBrgPerGird","–",{title:"Box / tub girders: 2. The seat bearing check (Tab 5 §5.6) and the load sent to the elastomeric module use the girder reaction / n; TU and CR·SH pad forces count N girders × n bearings."})}
     <div class="in-note">The tool checks the most heavily loaded single bearing. The confined area A<sub>2</sub> is taken from the geometric spread available on the seat (m = √(A₂/A₁) ≤ 2).</div>
     <div class="subhead">Bearing-seat reinforcement mat (provided under each bearing)</div>
     ${selRow("Seat mat bar size","bearing.seatBar",Object.keys(BARS).map(k=>[k,"#"+k]))}
@@ -1313,6 +1341,7 @@ function buildInputs(){
       ${inpRow("k<sub>h</sub> ratio (k<sub>h</sub> = ratio × A<sub>s</sub>)","seismic.khR","–",{title:"0.5 for walls free to displace 1–2 in; 1.0 for restrained walls. [11.6.5.2.2]"})}
       ${inpRow("Vertical coefficient k<sub>v</sub>","seismic.kv","–")}
       ${inpRow("ΔP<sub>AE</sub> application height ratio (× H)","seismic.hEQr","–",{title:"Dynamic increment applied at this fraction of H (0.6H classic Seed–Whitman; static part stays at H/3)."})}
+      ${inpRow("Seismic share of superstructure inertia at this abutment","seismic.shEQ","%",{title:"EQ_sup = A_s·(DC + DW)·share, at the seat (Tab 3 §3.6a). 100 % = all of the superstructure inertia through this abutment's keepers / shear keys. Independent of the static longitudinal shares of panel I-6."})}
       ${selRow("γ<sub>EH</sub> at Extreme Event I","seismic.gEHEQmode",[["gp","γp max/min, as Strength (1.50 / 0.90) [T.3.4.1-1, -2]"],["agency","Fixed value (agency policy)"]],{rebuild:true})}
       ${S.seismic.gEHEQmode==="agency"?inpRow("&nbsp;&nbsp;γ<sub>EH</sub> (agency policy)","seismic.gEHEQ","–",{title:"Fixed static earth-pressure factor within EE-I (e.g. 1.0 with the full M–O thrust) where the owner allows it instead of γp."}):""}
       ${inpRow("γ<sub>EQ</sub> on live load","seismic.gEQll","–",{title:"Project-specific per 3.4.1; commonly 0 for abutments, up to 0.5 where live presence during EQ is credible."})}
@@ -1324,7 +1353,7 @@ function buildInputs(){
       ${S.seismic.eLimEQmode==="user"?inpRow("&nbsp;&nbsp;Eccentricity limit fraction e/B (EE)","seismic.eFracEQ","–",{title:"Owner rule. The 10th Ed. limit is B/3 at γEQ = 0 and 0.4B at γEQ = 1, soil and rock [11.6.5.1]; a larger value is not conservative."}):`<div class="in-note">e<sub>lim</sub> = B·(1/3 + (0.4 − 1/3)·γ<sub>EQ</sub>): B/3 at γ<sub>EQ</sub> = 0, 0.4B at γ<sub>EQ</sub> = 1; permutations without live load use γ<sub>EQ</sub> = 0 [11.6.5.1, 10.6.4.2].</div>`}
     `:`<div class="in-note">OFF — Strength/Service only. The minimum seismic connection force [3.10.9] remains surfaced as a design note in Tab 3. Enable for sites where SDC > A or where the owner requires an M–O check.</div>`}
     ${selRow("Seismic zone [T.3.10.6-1]","seismic.zone",[["1","Zone 1 (S_D1 ≤ 0.15)"],["2","Zone 2"],["3","Zone 3"],["4","Zone 4"]])}
-    ${sq.on?"":inpRow("A<sub>s</sub> for the connection force","seismic.As","g",{title:"Zone 1 connection force: 0.15 when A_s < 0.05, else 0.25 [3.10.9.2]; single-span minimum A_s × permanent load [3.10.9.1]."})}
+    ${sq.on?"":inpRow("A<sub>s</sub> for the connection force","seismic.As","g",{title:"Zone 1 connection force: 0.15 when A_s < 0.05, else 0.25 [3.10.9.2]; single-span bridges (panel I-1 H = single-span): minimum A_s × permanent load [3.10.9.1]."})}
   `);
 
   /* ---- I-12 Assumptions ---- */
@@ -1654,7 +1683,9 @@ function computeAll(){
   /* ===== C-4b Calculated longitudinal loads (BR / TU / CR·SH) — override agg.Vx when toggled ===== */
   R.longit=computeLongitudinal(agg);
   R.agg=agg;
-  if(R.seis){ R.seis.EQsup=(+S.seismic.As)*(agg.DC.P+agg.DW.P)*shTU; } // superstructure inertia through bearings, thermal-path share
+  // superstructure inertia through the bearings/keepers: A_s·(DC + DW)·share, share = seismic.shEQ (panel I-11, default 100 %);
+  // independent of the static longitudinal shares of I-6 (BR/TU/CR·SH/WS keep those)
+  if(R.seis){ const shEQ=Math.min(100,Math.max(0,+S.seismic.shEQ))/100; R.seis.shEQ=isFinite(shEQ)?shEQ:1; R.seis.EQsup=(+S.seismic.As)*(agg.DC.P+agg.DW.P)*R.seis.shEQ; }
 
   /* ===== C-5 Load groups (about toe; Mt about abutment CL) =====
      each: V (+down), Mv=V·x, Hx (+driving), Mh=Hx·z, Hy, Mt */
@@ -1720,7 +1751,8 @@ function computeAll(){
   const LIMITS={
     "Strength I":  {LL:+F.llS1, WS:0,        WL:0,       TU:+F.gTU, CR:+F.gCR, perm:true , liveOpt:true },
     "Strength III":{LL:0,       WS:+F.wsS3,  WL:0,       TU:+F.gTU, CR:+F.gCR, perm:true , liveOpt:false},
-    "Strength IV": {LL:0,       WS:0,        WL:0,       TU:+F.gTU, CR:+F.gCR, perm:true , liveOpt:false, dcMax:(+F.gpDCmaxS4||1.50)},   // Table 3.4.1-1; γDC max 1.50 [T.3.4.1-2]
+    // Strength IV is not a limit state of this tool: 3.4.1 defines it for dead-load force effects in superstructures, and
+    // C3.4.1 excludes substructures, earth-retaining systems and bearing design (factors.gpDCmaxS4 is kept in saved data, unused)
     "Strength V":  {LL:+F.llS5, WS:+F.wsS5*wsF5,  WL:+F.wlS5, TU:+F.gTU, CR:+F.gCR, perm:true , liveOpt:true },
     "Constr — Str I":{LL:+S.constr.gLL||0, WS:0, WL:0, TU:0, CR:0, perm:true , liveOpt:(+S.constr.gLL||0)>0 , noSuper:true },
     "Service I":   {LL:1.0,     WS:1.0*wsFsv,      WL:1.0,     TU:1.0,    CR:1.0,    perm:false, liveOpt:true }
@@ -1790,7 +1822,7 @@ function computeAll(){
     R.permTables[lsName]=rows;
   }
 
-  const STR_LIMITS=["Strength I","Strength III","Strength IV","Strength V","Constr — Str I"].concat(S.seismic.on&&LIMITS["Extreme Event I"]?["Extreme Event I"]:[]);
+  const STR_LIMITS=["Strength I","Strength III","Strength V","Constr — Str I"].concat(S.seismic.on&&LIMITS["Extreme Event I"]?["Extreme Event I"]:[]);
   // EE-I eccentricity limit [11.6.5.1]: B·(1/3 + (0.4 − 1/3)·γEQ), soil and rock; γEQ = 0 for a permutation without live load [10.6.4.2]
   function eFracEQfor(liveOn){ const s=S.seismic; if(s.eLimEQmode==="user") return +s.eFracEQ;
     const gq=liveOn===1? Math.min(1,Math.max(0,+s.gEQll||0)) : 0; return 1/3+(0.4-1/3)*gq; }
@@ -1973,12 +2005,15 @@ function computeAll(){
   R.checks.seat={dc:NreqP/Nprov, Nreq, NreqP, pctN, zoneN, AsN, Nprov, seatIn:seatW*12, endGap, Hsup, HsupMode};
   // Minimum seismic connection force (each restrained direction) [3.10.9]:
   //   Zone 1: c·(permanent + γEQ·LL) reaction, c = 0.15 when A_s < 0.05, else 0.25 [3.10.9.2];
-  //   single-span bridges, any zone: ≥ A_s × permanent reaction [3.10.9.1, 4.7.4.2] (taken as a floor here in every zone, conservative for multispan);
-  //   Zones 2–4: the connection force comes from the seismic analysis [3.10.9.3, 3.10.9.4]; only the 3.10.9.1 floor is computed.
+  //   single-span bridges only, any zone: ≥ A_s × permanent reaction [3.10.9.1, 4.7.4.2]; single span = panel I-1 "Pier height H"
+  //   set to "Single-span bridge" (the tool's span-count input); otherwise multispan;
+  //   multispan Zones 2–4: the connection force comes from the seismic analysis [3.10.9.3, 3.10.9.4]; not computed.
   const zone=Math.min(4,Math.max(1,Math.round(+S.seismic.zone||1))), AsC=Math.max(0,+S.seismic.As||0), gEQc=Math.max(0,+S.seismic.gEQll||0);
+  const single=g.HsupMode==="single";
   const Wperm=agg.DC.P+agg.DW.P, Wtrib=Wperm+gEQc*agg.LL.P, cZ1=AsC<0.05?0.15:0.25;
-  const F1=zone===1? cZ1*Wtrib : 0, F0=AsC*Wperm, Fconn=Math.max(F1,F0);
-  R.seismic={Fconn, perBeam:Fconn/Math.max(1,S.beams.N), trib:Wperm, Wtrib, zone, As:AsC, gEQ:gEQc, cZ1, F1, F0, LL:agg.LL.P};
+  const F1=zone===1? cZ1*Wtrib : 0, F0=AsC*Wperm;
+  const Fconn=zone===1? (single? Math.max(F1,F0) : F1) : (single? F0 : NaN);
+  R.seismic={Fconn, perBeam:Fconn/Math.max(1,S.beams.N), trib:Wperm, Wtrib, zone, As:AsC, gEQ:gEQc, cZ1, F1, F0, single, LL:agg.LL.P};
 
   /* ===== C-10 Structural concrete checks ===== */
   const kah=ka*Math.cos(deg2rad(iota)); // horizontal pressure coefficient used on wall faces
@@ -2265,8 +2300,13 @@ function computeAll(){
   if(fn.branch==="pile" && R.pile && R.pile.n>0 && R.checks.pileComp && R.checks.pileComp.det){
     const p=S.piles, act=activePiles();
     const dbF=BARS[S.reinf.toe.size].db;
-    const deF=g.tf*12-m.coverF-dbF;                     // footing effective depth (bottom mat), in
-    const dvF=Math.max(0.9*deF,0.72*g.tf*12);            // in
+    // bottom mat above the pile heads: d_e from the top of the footing to the centroid of the bottom mat (two orthogonal
+    // layers of d_b: centroid d_b above the bottom of the mat), h_p = footing thickness above the pile heads [5.12.8.6, 5.7.2.8]
+    const embP=Math.max(0,+p.embed||0), clrP=Math.max(0,+p.clrTop||0);
+    const hP=g.tf*12-embP;                               // in
+    const deF=hP-clrP-dbF;                               // footing effective depth over the pile heads, in
+    const dvF=Math.max(0.9*deF,0.72*hP);                 // in
+    if(!(deF>0)) warn(`Punching shear: no effective depth above the pile heads (t_f − embedment − clear cover − d_b = ${fmt(deF,1)} in) — check panel I-7.`,"err");
     const sPile=+p.pileSize;                             // square-envelope side (round treated as square envelope), in
     const betaC=1.0;                                     // reaction area long/short ratio (≈1)
     const vnCoef=Math.min(0.063+0.126/betaC,0.126);      // ksi coefficient
@@ -2291,7 +2331,7 @@ function computeAll(){
       if(dc>gov.dc){ let no=0,t=c; for(const cc of S.piles.coords){no++; if(cc===t)break;}
         gov={dc, Vu, Vn, b0:b0in, dv:dvF, de:deF, pile:no, sides, spanX:spanX*12, spanY:spanY*12}; }
     });
-    R.checks.punching={...gov, sPile, betaC, vnCoef, ls:R.checks.pileComp.ls, lbl:det.c?.lbl};
+    R.checks.punching={...gov, sPile, betaC, vnCoef, embed:embP, clrTop:clrP, hP, db:dbF, ls:R.checks.pileComp.ls, lbl:det.c?.lbl};
     // overlapping-perimeter flag (group punching / beam shear governs — hand check)
     let minSp=Infinity;
     for(let i=0;i<act.length;i++)for(let j=i+1;j<act.length;j++){
@@ -2340,20 +2380,22 @@ function computeAll(){
       const A2=c[0]>0?(Lin+2*c[0])*(Win+2*c[0]):A1, mRaw=Math.sqrt(A2/A1);
       return {c:c[0], cBy:c[1], cT, A2, mRaw, m:c[0]>0?Math.min(2,mRaw):1};
     }
-    // governing single bearing (largest q_b/q_R): factored vertical at Strength I, IV, V
-    let Pu=-Infinity, pgirder=0, pls="", dcB=-Infinity, sm=null;
+    // governing single bearing (largest q_b/q_R): factored vertical at Strength I, V; with n bearings per girder line
+    // (box / tub girders) each bearing takes the girder reaction / n
+    const nBg=Math.max(1,Math.round(+bg.nBrgPerGird||1));
+    let Pu=-Infinity, PuG=0, pgirder=0, pls="", dcB=-Infinity, sm=null;
     for(let i=0;i<S.beams.N;i++){
       const SI=GP.DC[1]*S.rx.DC[i].P+GP.DW[1]*S.rx.DW[i].P+(+F.llS1)*S.rx.LL[i].P;
       const SV=GP.DC[1]*S.rx.DC[i].P+GP.DW[1]*S.rx.DW[i].P+(+F.llS5)*S.rx.LL[i].P
                +(+F.wsS5)*wsF5*S.rx.WS[i].P+(+F.wlS5)*S.rx.WL[i].P;
-      const SIV=LIMITS["Strength IV"].dcMax*S.rx.DC[i].P+GP.DW[1]*S.rx.DW[i].P;
-      let P=SI, ls="Strength I"; if(SIV>P){P=SIV;ls="Strength IV";} if(SV>P){P=SV;ls="Strength V";}
+      let P=SI, ls="Strength I"; if(SV>P){P=SV;ls="Strength V";}
+      const PG=P; P=PG/nBg;
       const mi=seatM(i), dci=(P/A1)/(phiB*0.85*m.fc*mi.m);
-      if(dci>dcB+1e-12){ dcB=dci; Pu=P; pgirder=i+1; pls=ls; sm=mi; }
+      if(dci>dcB+1e-12){ dcB=dci; Pu=P; PuG=PG; pgirder=i+1; pls=ls; sm=mi; }
     }
     const mSpread=sm?sm.m:1, qR=phiB*0.85*m.fc*mSpread;   // ksi
     const qb=Pu/A1;                                       // ksi
-    R.checks.bearingSeat={dc:qb/qR, qb, qR, A1, m:mSpread, phiB, Pu, pgirder, pls,
+    R.checks.bearingSeat={dc:qb/qR, qb, qR, A1, m:mSpread, phiB, Pu, PuG, nBg, pgirder, pls,
       A2:sm?sm.A2:A1, c:sm?sm.c:0, cBy:sm?sm.cBy:"", mRaw:sm?sm.mRaw:1, cFront, cBack, cT:sm?sm.cT:0};
     if(sm&&sm.c<=0) warn("Bearing pad is not inside the seat on all sides (clear edge distance "+fmt(sm.c,1)+" in to the "+sm.cBy+"): m = 1 [5.6.5]; check the pad position.");
     // seat reinforcement mat — prescriptive provision + STM trigger
@@ -2612,9 +2654,8 @@ function computeAll(){
       ["factors.gpDWmax",1.50,"γDW max [T.3.4.1-2]"],["factors.gpDWmin",0.65,"γDW min [T.3.4.1-2]"],
       ["factors.gpEVmax",1.35,"γEV max [T.3.4.1-2]"],["factors.gpEVmin",1.00,"γEV min [T.3.4.1-2]"],
       ["factors.gpEHmax",1.50,"γEH max (active) [T.3.4.1-2]"],["factors.gpEHmin",0.90,"γEH min [T.3.4.1-2]"],
-      ["factors.gpDCmaxS4",1.50,"γDC max Strength IV [T.3.4.1-2]"],
       ["factors.llS1",1.75,"γLL Strength I [T.3.4.1-1]"],["factors.llS5",1.35,"γLL Strength V [T.3.4.1-1]"],
-      ["factors.wsS3",1.40,"γWS Strength III (design basis)"],["factors.wsS5",1.00,"γWS Strength V"],
+      ["factors.wsS3",1.00,"γWS Strength III [T.3.4.1-1]"],["factors.wsS5",1.00,"γWS Strength V"],
       ["factors.wlS5",1.00,"γWL Strength V"],["factors.gTU",1.00,"γTU (force effects) [T.3.4.1-6]"],["factors.gCR",1.00,"γCR/SH [T.3.4.1-3]"],
       ["piles.gDD",1.10,"γDR drag load, structural [T.3.4.1-1 note]"],["seismic.phiBEQ",0.80,"φb bearing, Extreme Event I [11.5.8]"],
       ["fnd.phiTau",0.80,"φτ sliding [T.10.5.5.2.2-1]"],["fnd.phiEP",0.50,"φep passive"],
@@ -2813,10 +2854,10 @@ function renderTabLoads(R){
     <div class="note-box" style="line-height:1.55">
     <b>1.</b> Earth pressure: <b>${S.soil.method==="rankine"?"Rankine":"Coulomb"}</b> active theory on the vertical plane through the heel end; at-rest K₀ not used (free-standing cantilever) [3.11.5]. Valid for β &lt; φ and a wall free to translate/rotate.<br>
     <b>2.</b> Live-load surcharge: equivalent soil height h<sub>eq</sub> interpolated from Table 3.11.6.4.1-1; vertical LSv counted only where it increases demand.<br>
-    <b>3.</b> Longitudinal distribution: <b>${S.dist.model==="floating"?"MassDOT floating bridge":S.dist.model==="fixed"?"defined fixed bearing (100%)":"manual"}</b> — BR/TU/CR·SH/WS<sub>x</sub> shares ${fmt(shB.shBR*100,0)}/${fmt(shB.shTU*100,0)}/${fmt(shB.shCR*100,0)}/${fmt(shB.shWS*100,0)}% to this abutment [MassDOT 3.1.8.3].<br>
+    <b>3.</b> Longitudinal distribution: <b>${S.dist.model==="floating"?"MassDOT floating bridge":S.dist.model==="fixed"?"defined fixed bearing (100%)":"manual"}</b> — BR/TU/CR·SH/WS<sub>x</sub> shares ${fmt(shB.shBR*100,0)}/${fmt(shB.shTU*100,0)}/${fmt(shB.shCR*100,0)}/${fmt(shB.shWS*100,0)}% to this abutment [MassDOT 3.1.8.3]${S.seismic.on?"; Extreme Event I superstructure inertia share "+fmt(+S.seismic.shEQ,0)+"% (panel I-11)":""}.<br>
     <b>4.</b> Passive resistance at toe: <b>${R.passive.on?"ENABLED (φep applied — verify scour)":"neglected (conservative default)"}</b> [3.11.1].<br>
     <b>5.</b> Groundwater: balanced condition assumed (equal water both sides — no net hydrostatic thrust); buoyant unit weights below the modeled water table.<br>
-    <b>6.</b> γ<sub>p</sub> permutation: every permanent class factored at both bounds; each check takes its own worst permutation — no single global case [3.4.1].<br>
+    <b>6.</b> γ<sub>p</sub> permutation: every permanent class factored at both bounds; each check takes its own worst permutation — no single global case [3.4.1]. Limit states: Strength I, III, V, construction, Service I and (when on) Extreme Event I; Strength IV is not checked (3.4.1 defines it for superstructures; C3.4.1 excludes substructures, earth-retaining systems and bearing design).<br>
     <b>7.</b> Foundation: <b>${S.fnd.branch==="spread"?("spread footing on "+S.fnd.matl+" — effective-width (soil) / linear (rock) design bearing distribution [10.6]"):"pile group — elastic rigid-cap biaxial distribution, vertical piles; lateral resistance is an LPILE hand-off [10.7]"}</b>.<br>
     <b>8.</b> V&amp;M diagrams: limit states use the design bearing distribution; individual loads use elastic (tension-allowed) superposition — the two intentionally differ for the footing.<br>
     <b>9.</b> Structural: 1-ft strips; strain-based φ per 5.5.4.2; footing crack-control service moments from Service I directly (linear contact pressure / pile reactions).<br>
@@ -3183,23 +3224,28 @@ function renderTabStab(R){
       ${eqB("Inertial forces (k_h · weight)","AASHTO 11.6.5.1",[
         `\\text{Wall (incl. footing): } k_h W_w = ${fmtT(q.WiW)}\\ \\text{kip at } \\bar z = ${fmtT(q.zWall)}\\ \\text{ft}`,
         `\\text{Soil block: } k_h W_s = ${fmtT(q.WiS)}\\ \\text{kip at } \\bar z = ${fmtT(q.zSoil)}\\ \\text{ft}`,
-        `\\text{Superstructure: } A_s(DC+DW)\\cdot\\text{share} = ${fmtT(q.EQsup)}\\ \\text{kip at the seat}`],
-        "Superstructure inertia uses the full A_s (restrained by keepers) and the thermal-path share; EOR to confirm the distribution for the actual bearing/keeper layout. EE-I resistance factors and the e/B limit are editable in panel I-11.")}
+        "\\text{Superstructure: } EQ_{sup} = A_s\\,(\\Sigma P_{DC} + \\Sigma P_{DW})\\,s_{EQ}",
+        `EQ_{sup} = (${fmtT(+S.seismic.As,3)})(${fmtT(R.groups.DCsup.V)} + ${fmtT(R.groups.DW.V)})(${fmtT(q.shEQ,2)}) = ${fmtT(q.EQsup)}\\ \\text{kip at the seat}`],
+        "Superstructure inertia uses the full A_s (restrained by keepers) and s_EQ = the seismic share of the superstructure inertia at this abutment (panel I-11, default 100 %); it does not use the static longitudinal shares of panel I-6. EOR to confirm the distribution for the actual bearing/keeper layout. EE-I resistance factors and the e/B limit are editable in panel I-11.")}
     `);
   }
   const sz=R.seismic;
   h+=panel("o-seis","3.6","Minimum Seismic Connection Force — Design Note [3.10.9 / MassDOT]",`
     <div class="note-box">${S.seismic.on?"In addition to the Extreme Event I analysis above,":"Extreme Event I is currently OFF (enable in panel I-11), but"} MassDOT floating bridges require the superstructure–substructure connection (shear keys, keeper blocks, anchor bolts) to resist a minimum horizontal force in each restrained direction:</div>
-    ${eqB("Minimum connection force (each restrained direction) — Seismic Zone "+sz.zone,"AASHTO 3.10.9.1, 3.10.9.2",[
+    ${eqB("Minimum connection force (each restrained direction) — Seismic Zone "+sz.zone+", "+(sz.single?"single-span":"multispan")+" bridge","AASHTO 3.10.9.1, 3.10.9.2, 4.7.4.2",[
       ...(sz.zone===1?[
       "F_{Z1} = c\\,(\\Sigma P_{DC} + \\Sigma P_{DW} + \\gamma_{EQ}\\,\\Sigma P_{LL}), \\quad c = 0.15 \\text{ if } A_s < 0.05,\\ \\text{else } 0.25 \\quad [3.10.9.2]",
       `F_{Z1} = ${fmtT(sz.cZ1)}\\,(${fmtT(R.groups.DCsup.V)} + ${fmtT(R.groups.DW.V)} + (${fmtT(sz.gEQ)})(${fmtT(sz.LL)})) = ${fmtT(sz.F1)}\\ \\text{kip} \\quad (A_s = ${fmtT(sz.As,3)})`]:[]),
-      "F_{1span} = A_s\\,(\\Sigma P_{DC} + \\Sigma P_{DW}) \\quad [3.10.9.1,\\ \\text{single-span bridges, any zone}]",
-      `F_{1span} = (${fmtT(sz.As,3)})(${fmtT(R.groups.DCsup.V)} + ${fmtT(R.groups.DW.V)}) = ${fmtT(sz.F0)}\\ \\text{kip}`,
-      sz.zone===1?`F_{conn} = \\max(F_{Z1},\\,F_{1span}) = ${fmtT(sz.Fconn)}\\ \\text{kip per bearing line} \\quad(${fmtT(sz.perBeam)}\\ \\text{kip per beam})`
-                 :`F_{conn} \\ge F_{1span} = ${fmtT(sz.Fconn)}\\ \\text{kip per bearing line} \\quad(${fmtT(sz.perBeam)}\\ \\text{kip per beam})`],
+      ...(sz.single?[
+      "F_{1span} = A_s\\,(\\Sigma P_{DC} + \\Sigma P_{DW}) \\quad [3.10.9.1,\\ 4.7.4.2:\\ \\text{single-span bridges, any zone}]",
+      `F_{1span} = (${fmtT(sz.As,3)})(${fmtT(R.groups.DCsup.V)} + ${fmtT(R.groups.DW.V)}) = ${fmtT(sz.F0)}\\ \\text{kip}`]:[]),
+      sz.zone===1?(sz.single?`F_{conn} = \\max(F_{Z1},\\,F_{1span}) = ${fmtT(sz.Fconn)}\\ \\text{kip per bearing line} \\quad(${fmtT(sz.perBeam)}\\ \\text{kip per beam})`
+                            :`F_{conn} = F_{Z1} = ${fmtT(sz.Fconn)}\\ \\text{kip per bearing line} \\quad(${fmtT(sz.perBeam)}\\ \\text{kip per beam})`)
+                 :(sz.single?`F_{conn} \\ge F_{1span} = ${fmtT(sz.Fconn)}\\ \\text{kip per bearing line} \\quad(${fmtT(sz.perBeam)}\\ \\text{kip per beam})`
+                            :"F_{conn}:\\ \\text{from the seismic analysis (not computed)}")],
       "Applies to backwall shear keys, keeper blocks and anchor bolts. Not run as a full Extreme Event combination in v1. "
-      +(sz.zone===1?"The single-span minimum is applied as a floor (conservative for a multispan bridge). ":"<b>Zone "+sz.zone+": the connection design force comes from the seismic analysis [3.10.9.3, 3.10.9.4, 4.7.4.3]; this tool computes only the single-span minimum A_s × permanent load [3.10.9.1, 4.7.4.2].</b> ")
+      +"Single-span bridge = panel I-1 \"Pier height H in N\" set to \"Single-span bridge\""+(sz.single?"":" (not set: multispan assumed, so the single-span minimum A_s × permanent load [3.10.9.1] is not applied)")+". "
+      +(sz.zone===1||sz.single?"":"<b>Zone "+sz.zone+", multispan: the connection design force comes from the seismic analysis [3.10.9.3, 3.10.9.4, 4.7.4.3]; this tool does not compute it.</b> ")
       +"γ_EQ = live load assumed present during the earthquake (panel I-11). Zone and A_s are set in panel I-11 [T.3.10.6-1].")}
   `);
   h+=panel("o-tornado","3.8","Sensitivity — Governing D/C vs ±10% Input Perturbation",`
@@ -3289,9 +3335,11 @@ function renderTabFound(R){
     h+=panel("o-punch","4.6","Two-Way (Punching) Shear at Piles [AASHTO 5.12.8.6]",`
       ${govNote((pnc.lbl||"")+" — "+(pnc.ls||"")+" (governing pile "+pnc.pile+", "+pnc.sides+"-sided critical section)")}
       ${abutWorkedIn([["tab-found","o-pileform","4.2 Axial Pile Reactions","V_u (pile reaction)"]])}
-      ${eqB("Footing effective depth & shear depth","AASHTO 5.12.8.6, 5.7.2.8",[
-        `d_e = t_f - c_{cl} - d_b = ${fmtT(g.tf*12,1)} - ${fmtT(S.mat.coverF,2)} - ${fmtT(BARS[S.reinf.toe.size].db,3)} = ${fmtT(pnc.de)}\\ \\text{in}`,
-        `d_v = \\max(0.9d_e,\\,0.72h) = ${fmtT(pnc.dv)}\\ \\text{in}`])}
+      ${eqB("Footing effective depth & shear depth over the pile heads","AASHTO 5.12.8.6, 5.7.2.8",[
+        `h_p = t_f - e_{pile} = ${fmtT(g.tf*12,1)} - ${fmtT(pnc.embed,1)} = ${fmtT(pnc.hP,1)}\\ \\text{in}`,
+        `d_e = h_p - c_{top} - d_b = ${fmtT(pnc.hP,1)} - ${fmtT(pnc.clrTop,2)} - ${fmtT(pnc.db,3)} = ${fmtT(pnc.de)}\\ \\text{in}`,
+        `d_v = \\max(0.9d_e,\\,0.72h_p) = \\max(0.9(${fmtT(pnc.de)}),\\,0.72(${fmtT(pnc.hP,1)})) = ${fmtT(pnc.dv)}\\ \\text{in}`],
+        "e_pile = pile embedment into the footing; c_top = clear cover from the pile top to the bottom mat (panel I-7). The bottom mat sits above the pile heads; d_e is measured from the top of the footing to the mat centroid (two orthogonal layers, centroid d_b above the bottom of the mat), and h_p is the footing thickness above the pile heads.")}
       ${eqB("Critical perimeter at d_v/2 from the pile face (square envelope, edge-truncated)","AASHTO 5.12.8.6.3",[
         `\\text{pile size} = ${fmtT(pnc.sPile,1)}\\ \\text{in}, \\quad \\text{critical section side} = ${fmtT(pnc.sPile,1)}+${fmtT(pnc.dv)} = ${fmtT(pnc.sPile+pnc.dv,1)}\\ \\text{in}`,
         `b_0 = ${fmtT(pnc.b0,1)}\\ \\text{in} \\quad(${pnc.sides}\\text{ faces inside the footing for the governing pile})`])}
@@ -3431,12 +3479,13 @@ function renderTabStruct(R){
   h+=panel("o-str-bearing","5.6","Bearing on Concrete — Bridge Seat [AASHTO 5.6.5]",`
     ${govNote("Governing single-bearing factored vertical — girder "+bs.pgirder+", "+bs.pls)}
     ${eqB("Factored bearing demand & resistance","AASHTO 5.6.5 (Eq. 5.6.5-1, -2), 5.5.4.2",[
+      `P_u = \\dfrac{P_{u,girder}}{n_b} = \\dfrac{${fmtT(bs.PuG)}}{${bs.nBg}} = ${fmtT(bs.Pu)}\\ \\text{kip per bearing}`,
       `A_1 = L_{pad}\\,W_{pad} = ${fmtT(bg.padL,1)}\\times${fmtT(bg.padW,1)} = ${fmtT(bs.A1,0)}\\ \\text{in}^2\\,, \\qquad q_b = \\dfrac{P_u}{A_1} = \\dfrac{${fmtT(bs.Pu)}}{${fmtT(bs.A1,0)}} = ${fmtT(bs.qb,3)}\\ \\text{ksi}`,
       `c = \\min(c_{front},\\,c_{back},\\,c_{trans}) = \\min(${fmtT(bs.cFront,1)},\\,${fmtT(bs.cBack,1)},\\,${fmtT(bs.cT,1)}) = ${fmtT(bs.c,1)}\\ \\text{in} \\quad(\\text{${esc(bs.cBy)}})`,
       `A_2 = (L_{pad}+2c)(W_{pad}+2c) = (${fmtT(bg.padL,1)}+2(${fmtT(Math.max(0,bs.c),1)}))(${fmtT(bg.padW,1)}+2(${fmtT(Math.max(0,bs.c),1)})) = ${fmtT(bs.A2,0)}\\ \\text{in}^2`,
       `m = \\sqrt{A_2/A_1} = \\sqrt{${fmtT(bs.A2,0)}/${fmtT(bs.A1,0)}} = ${fmtT(bs.mRaw,3)} \\le 2 \\;\\Rightarrow\\; m = ${fmtT(bs.m,3)}`,
       `q_R = \\varphi_b\\,(0.85 f'_c)\\,m = ${fmtT(bs.phiB,2)}(0.85\\times${fmtT(m.fc,1)})(${fmtT(bs.m,3)}) = ${fmtT(bs.qR,3)}\\ \\text{ksi}`],
-      "P_u is the most heavily loaded single bearing (γ_DC,max·DC + γ_DW,max·DW + γ_LL·LL + wind), evaluated at Strength I, IV and V; the governing bearing is the one with the largest q_b/q_R. A₂ is concentric with the pad, extended by the smallest clear edge distance c: c_front = (t_st − t_bw − setback)·12 − L_pad/2 to the seat front edge, c_back = (setback + t_bw)·12 − L_pad/2 to the stem back face (the stem continues under the backwall), c_trans = the lesser of the distance to the wall end and half the clear distance to the next girder's pad (Fig. 5.6.5-1). m = 1 if c ≤ 0.")}
+      "P_u is the most heavily loaded single bearing: the factored girder reaction (γ_DC,max·DC + γ_DW,max·DW + γ_LL·LL + wind) divided by n_b, the bearings per girder line (panel I-10), evaluated at Strength I and V; the governing bearing is the one with the largest q_b/q_R. A₂ is concentric with the pad, extended by the smallest clear edge distance c: c_front = (t_st − t_bw − setback)·12 − L_pad/2 to the seat front edge, c_back = (setback + t_bw)·12 − L_pad/2 to the stem back face (the stem continues under the backwall), c_trans = the lesser of the distance to the wall end and half the clear distance to the next girder's pad (Fig. 5.6.5-1). m = 1 if c ≤ 0."+(bs.nBg>1?" With "+bs.nBg+" bearings per girder each pad is placed at the girder centreline for c_trans (the pad spacing within a girder is not an input): check c_trans by hand.":""))}
     ${checkLine("Bearing on concrete",`\\dfrac{q_b}{q_R} = \\dfrac{${fmtT(bs.qb,3)}}{${fmtT(bs.qR,3)}}`,bs.dc)}
     <div class="subhead">Bearing-seat reinforcement (provision)</div>
     <div class="note-box">AASHTO provides <b>no closed-form demand</b> for seat reinforcement under a bearing; a reinforcement mat under each bearing is a prescriptive detailing requirement, with a <b>strut-and-tie evaluation [5.8]</b> required for heavy or edge-loaded bearings. Provided mat: <b>#${bg.seatBar} @ ${fmt(+bg.seatSp,1)} in each way = ${fmt(sm.AsMat)} in²/ft</b>.</div>
@@ -3513,7 +3562,7 @@ function drawRebarSketch(){
 const VM_SEL_GROUPS=[
   ["Limit-state combinations (factored)",[
     ["ls:Strength I","Strength I"],["ls:Strength III","Strength III"],
-    ["ls:Strength IV","Strength IV"],["ls:Strength V","Strength V"],["ls:Constr — Str I","Construction — Str I (no superstructure)"],
+    ["ls:Strength V","Strength V"],["ls:Constr — Str I","Construction — Str I (no superstructure)"],
     ["ls:Service I","Service I"]]],
   ["Individual loads (unfactored, γ = 1.0)",[
     ["load:DC","DC — dead load (self-wt + superstructure)"],["load:DW","DW — wearing surface / utilities"],
@@ -4838,11 +4887,11 @@ document.getElementById("btnReset").addEventListener("click",()=>{
 let EDM_WIN=null;
 function edmPayload(){
   const R=window.LAST_R||recalcAll()||window.LAST_R, g=S.geom, br=S.bearing, Lg=S.longit;
-  // per-girder service loads for the EDM "run all girders" batch
-  const girders=[]; const N=S.beams.N;
+  // per-girder service loads for the EDM "run all girders" batch: load on one bearing = girder reaction / bearings per girder
+  const girders=[]; const N=S.beams.N, nBg=Math.max(1,Math.round(+br.nBrgPerGird||1));
   for(let i=0;i<N;i++){
-    const Pdl=(S.rx.DC[i]?S.rx.DC[i].P:0)+(S.rx.DW[i]?S.rx.DW[i].P:0);
-    const Pll=S.rx.LL[i]?S.rx.LL[i].P:0;
+    const Pdl=((S.rx.DC[i]?S.rx.DC[i].P:0)+(S.rx.DW[i]?S.rx.DW[i].P:0))/nBg;
+    const Pll=(S.rx.LL[i]?S.rx.LL[i].P:0)/nBg;
     girders.push({tag:"G"+(i+1),Pdl:+Pdl.toFixed(3),Pll:+Pll.toFixed(3),thetaLL:0.004});
   }
   // representative (first interior) load
@@ -4869,7 +4918,7 @@ function fromEDM(src){   // accept messages only from the EDM window this page o
 window.addEventListener("message",ev=>{
   const d=ev.data; if(!d||d.app!=="abutment-edm") return;
   if(!fromEDM(ev.source)) return;
-  if(d.type==="EDM_READY"){ try{ (ev.source||EDM_WIN).postMessage(edmPayload(),"*"); document.getElementById("saveStatus").textContent="inputs handed off to EDM"; }catch(e){} }
+  if(d.type==="EDM_READY"){ try{ (ev.source||EDM_WIN).postMessage(edmPayload(),"*"); const nB=Math.max(1,Math.round(+S.bearing.nBrgPerGird||1)); document.getElementById("saveStatus").textContent="inputs handed off to EDM"+(nB>1?" (load per bearing = girder reaction / "+nB+")":""); }catch(e){} }
   if(d.type==="PAD"){ const p=d.payload||{};
     if(p.G) S.bearing.G=+p.G; if(p.hrt) S.bearing.hrt=+p.hrt;
     let circNote="";
@@ -4915,7 +4964,7 @@ function inputEchoHTML(){
     ["Earth surcharge ES",fmt(+s.esQ||0,2),"ksf"],
     ["Construction stage (fill / γLL)",((+S.constr.hFill>0)?fmt(+S.constr.hFill,1):"full")+" / "+fmt(+S.constr.gLL||0),"ft / –"]]);
   h+="<h3>Seismic / scour</h3>"+echoRows([
-    ["Extreme Event I",S.seismic.on?("ON — As="+fmt(+S.seismic.As,3)+", kh="+fmt(+S.seismic.khR,2)+"·As, kv="+fmt(+S.seismic.kv,2)+", ΔPAE @ "+fmt(+S.seismic.hEQr,2)+"H; φτ/φb/φc(EE)="+fmt(+S.seismic.phiTauEQ,2)+"/"+fmt(+S.seismic.phiBEQ,2)+"/"+fmt(+S.seismic.phiCEQ,2)+", e/B ≤ "+(S.seismic.eLimEQmode==="user"?fmt(+S.seismic.eFracEQ,3)+" (owner rule)":"1/3 + (0.4 − 1/3)·γEQ [11.6.5.1]")+", γEH(EE) = "+(eqEHfixed()!==null?fmt(eqEHfixed(),2)+" (agency policy)":"γp max/min")):"OFF",""],
+    ["Extreme Event I",S.seismic.on?("ON — As="+fmt(+S.seismic.As,3)+", kh="+fmt(+S.seismic.khR,2)+"·As, kv="+fmt(+S.seismic.kv,2)+", ΔPAE @ "+fmt(+S.seismic.hEQr,2)+"H; φτ/φb/φc(EE)="+fmt(+S.seismic.phiTauEQ,2)+"/"+fmt(+S.seismic.phiBEQ,2)+"/"+fmt(+S.seismic.phiCEQ,2)+", e/B ≤ "+(S.seismic.eLimEQmode==="user"?fmt(+S.seismic.eFracEQ,3)+" (owner rule)":"1/3 + (0.4 − 1/3)·γEQ [11.6.5.1]")+", γEH(EE) = "+(eqEHfixed()!==null?fmt(eqEHfixed(),2)+" (agency policy)":"γp max/min")+", superstructure inertia share "+fmt(+S.seismic.shEQ,0)+"%"):"OFF",""],
     ["Scour condition",f.scour?"ON — passive eliminated; qn at scoured grade":"off",""]]);
   h+="<h3>Foundation</h3>"+echoRows(f.branch==="spread"?[
     ["Branch","Spread footing on "+f.matl,""],
@@ -4929,6 +4978,7 @@ function inputEchoHTML(){
     ["Rn / φc",fmt(p.Rn)+" / "+fmt(p.phiC),"kip / –"],
     ["Rn,up / φup",fmt(p.RnUp)+" / "+fmt(p.phiUp),"kip / –"],
     ["Pile section (punching)",(p.pileShape||"hp")+", "+fmt(p.pileSize,1)+" in",""],
+    ["Pile embedment / clear cover pile top to bottom mat",fmt(+p.embed,1)+" / "+fmt(+p.clrTop,1),"in"],
     ["Drag load DR / γDR (structural; 0 geotechnical)",fmt(+p.dd||0,0)+" / "+fmt(+p.gDD,2),"kip / –"]]);
   h+="<h3>Longitudinal distribution</h3>"+echoRows([
     ["Model",d.model,""],["Shares BR / TU / CR-SH / WSx",
@@ -4965,6 +5015,7 @@ function inputEchoHTML(){
     ["Stem–footing joint (shear friction)",{monolithic:"cast monolithic",roughened:"roughened ¼ in",smooth:"not roughened"}[S.joint?.prep||"roughened"],""]]);
   h+="<h3>Bearings & seat</h3>"+echoRows([
     ["Bearing pad (L × W)",fmt(S.bearing.padL,1)+" × "+fmt(S.bearing.padW,1),"in"],
+    ["Bearings per girder line",fmt(+S.bearing.nBrgPerGird,0),""],
     ["Bearing-seat mat","#"+S.bearing.seatBar+" @ "+fmt(+S.bearing.seatSp,1)+" in each way",""]]);
   return h;
 }
```

## 2026-10-20 — PR: claude/abut-accuracy — pile toe depth over the pile heads, single-span Extreme Event I without M–O (PR link added after merge)

Engineer decisions of 2026-10-20 on two open items of the previous entry ("Pile-cap one-way shear and toe flexure with the mat over the pile heads"; "C3.10.9.1"). Standing direction: accurate, not overly conservative. Basis: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), checked against the text (C3.10.9.1, 3.10.9.1, 4.7.4.2, 5.6.3.2, 5.6.3.3, 5.6.7, 5.7.2.8, 5.7.3.3, 11.6.5.1). Numbers come from the real `computeAll()` of origin/main `9fa3dee` (before; the abutment file is the same as in `2408b77`) and of this branch (after) in headless Chromium, on the built-in benchmark (`benchState()`: B = 13 ft, L_ab = 44 ft, t_f = 3 ft, L_toe = 3.5 ft, #8 @ 9 in toe bars, f′c = 4 ksi, f_y = 60 ksi, c_F = 3 in; 6 girders, ΣDC + ΣDW = 582 kip; seat z = 17 ft). The exact edits are in the appendix as a unified diff against `9fa3dee`.

### F45. Pile-supported footing: toe d, d_v, d_c and β_s over the pile heads (bottom mat above the pile heads)   [calc change] [MORE conservative]
- **Where:** `computeAll` C-10 `sectionCheck` (anchor `optional hEff, coverEff (in): pile-supported toe`) and the toe call (anchor `const toePileD=fn.branch==="pile"?`); `sectionHTML` (Tab 5 §5.3: h_p and d worked for the pile toe, d_v with h_p, d_c worked; link to Tab 4 §4.6); I-7 tooltips of `piles.embed` / `piles.clrTop`; `migrate()` defRev 4 notice.
- **Before:**
  ```js
  const d=o.h-o.cover-bar.db/2;
  const dv=Math.max(0.9*d,0.72*o.h);
  const dc=o.cover+bar.db/2;
  const betaS=1+dc/(0.7*(o.h-dc));
  R.checks.toeFlex=sectionCheck({name:"Toe", h:g.tf*12, cover:m.coverF, bar:S.reinf.toe.size, … zeroShearDist:g.Ltoe*12});
  ```
- **After:**
  ```js
  const hE=o.hEff!=null?o.hEff:o.h, cvE=o.coverEff!=null?o.coverEff:o.cover;
  const d=hE-cvE-bar.db/2;
  const dv=Math.max(0.9*d,0.72*hE);
  const dc=cvE+bar.db/2;
  const betaS=1+dc/(0.7*(hE-dc));
  const toePileD=fn.branch==="pile"? {embP:Math.max(0,+S.piles.embed||0), clrP:Math.max(0,+S.piles.clrTop||0)} : null;
  if(toePileD){ toePileD.hP=g.tf*12-toePileD.embP; }
  R.checks.toeFlex=sectionCheck({… zeroShearDist:g.Ltoe*12,
    ...(toePileD? {hEff:toePileD.hP, coverEff:toePileD.clrP+BARS[S.reinf.toe.size].db/2, pileMat:toePileD} : {})});
  ```
  So for the pile toe: d = h_p − c_top − d_b with h_p = t_f − e_pile (the same mat-centroid convention as the punching depth of F40, kept unchanged: −d_b, the centroid of the two orthogonal bottom layers); d_v = max(0.9d, 0.72h_p); crack control d_c = c_top + d_b and β_s = 1 + d_c/[0.7(h_p − d_c)] (tension face taken at the pile heads, consistent with h_p). S_c for M_cr (5.6.3.3) stays on the gross t_f (the concrete below the mat is there; unchanged). An input error is raised when d ≤ 0. Spread footing: no hEff/coverEff → identical to before.
- **Heel (checked, not changed):** the heel is designed for top steel (top tension; the tool warns when a permutation gives bottom tension). Its d is measured from the bottom compression face to the top mat, d = t_f − c_F − d_b/2, which does not involve the bottom mat; unchanged.
- **Provision:** AASHTO LRFD 10th Ed. Art. 5.6.3.2 (flexural resistance, d_s), 5.7.2.8 (d_v), 5.7.3.3 (Eq. 5.7.3.3-3), 5.6.7 (Eqs. 5.6.7-1, -2), 5.6.3.3 (M_cr, unchanged).
- **Check case (default project with piles; A_s = 0.79·12/9 = 1.053 in²/ft, a = 1.053·60/(0.85·4·12) = 1.549 in; Strength I V_u = 37.26 kip/ft, M_u = 45.86 kip-ft/ft, Service I M_s = 30.75 kip-ft/ft):**
  - Before: d = 36 − 3 − 0.5 = 32.50 in; φM_n = 0.9·1.053·60·(32.50 − 0.775)/12 = 150.38 → flexure D/C **0.305**; d_v = max(29.25, 25.92) = 29.25 in; φV_c = 0.9·0.0316·2.0·√4·12·29.25 = 39.93 kip/ft → shear D/C 37.26/39.93 = **0.933**; d_c = 3.5 in, β_s = 1.154, f_ss = 11.47 ksi, s_max = 45.9 in.
  - After: h_p = 36 − 12 = 24.0 in; d = 24.0 − 3.0 − 1.0 = 20.00 in; φM_n = 0.9·1.053·60·(20.00 − 0.775)/12 = 91.13 → flexure D/C **0.503**; d_v = max(18.00, 17.28) = 18.00 in; φV_c = 0.9·0.0316·2.0·2·12·18.00 = 24.57 kip/ft → shear D/C 37.26/24.57 = **1.516** (FAIL; zero-shear point 42 in < 3d_v = 54 in, so β = 2.0 still applies); d_c = 3 + 1 = 4.00 in, β_s = 1 + 4/(0.7·20) = 1.286, j = 0.926, f_ss = 30.75·12/(1.053·0.926·20) = 18.92 ksi, s_max = 700·1.0/(1.286·18.92) − 2·4 = 20.77 in ≥ 9 in (PASS); M_cr = 111.14 kip-ft/ft (gross t_f, unchanged), min(M_cr, 1.33M_u = 61.00) = 61.00 ≤ 91.13 (PASS).
  - The predicted ~1.48 used −d_b/2 (d = 20.5 in, d_v = 18.45 in, φV_c = 25.18, D/C 1.480); with the −d_b mat-centroid convention of the punching check the result is 1.516.
  - Piles + EE-I (A_s = 0.30, multispan): toe shear D/C 1.037 → **1.686** (V_u 41.42 kip/ft), flexure 0.340 → 0.560.

### F46. Extreme Event I for a single-span bridge: static earth pressure + connection force, no M–O and no wall / soil-block inertia   [calc change] [LESS conservative; was over-conservative]
- **Where:** `computeAll` C-3b (anchor `if(S.seismic.on && g.HsupMode==="single"){`); stem seismic terms (anchor `// kip per ft of wall (0 for a single-span bridge`); Tab 3 §3.6a (single-span panel with the note and EQ_sup worked); I-11 note; basis note 11; input echo; `migrate()` defRev 4 notice.
- **Span count:** the I-1 setting "Pier height H in N" = "Single-span bridge: H = 0" (as F43). No new input.
- **Before:** `if(S.seismic.on){ … M–O: K_AE, ΔP_AE, dKh; WiW = k_h·W_wall; WiS = k_h·W_soil; … }` for every bridge.
- **After:**
  ```js
  if(S.seismic.on && g.HsupMode==="single"){
    R.seis={single:true, kh:0, kv:0, thd:0, dMO:0, KAE:NaN, PAE:NaN, dPAE:0, dPAEh:0, dKh:0, zEQ:0, WiW:0, zWall:0, WiS:0, zSoil:0, EQsup:0};
  }else if(S.seismic.on){ … unchanged … }
  ```
  The load groups EQd, EQiW, EQiS are then zero, the stem ΔK term and stem wall inertia are zero (k_h = 0, dKh = 0), and the M–O validity error is not raised. EQ_sup = A_s·(ΣDC + ΣDW)·s_EQ (unchanged; at s_EQ = 100 % it equals the 3.10.9.1 force A_s × tributary permanent load) and the EE-I factors, φ and e-limit are unchanged.
- **Decision (wall inertia):** dropped as well. The wall and soil-block inertia (k_h·W) are terms of the 11.6.5.1 seismic wall analysis, used together with the M–O thrust; C3.10.9.1 takes single-span abutments out of that analysis and 4.7.4.2 needs no seismic analysis for a single-span bridge, leaving only the 3.10.9.1 connection force. The 3.10.9.2 Zone 1 force (0.15 / 0.25 × reaction) stays a connection (keeper / shear-key) design force in §3.6 and is not applied to the abutment stability (as before).
- **Wingwalls:** the note says that C3.10.9.1 leaves the seismic design of single-span wingwalls to the engineer's judgment (wingwalls are outside this tool).
- **Provision:** AASHTO LRFD 10th Ed. C3.10.9.1, Art. 3.10.9.1, 4.7.4.2, 11.6.5.1, 3.11.4.
- **Check case (default project, I-1 single-span, EE-I on, A_s = 0.30, k_h = 0.15, γEQ = 0; EE-I permutation 0.90DC + 0.65DW + 1.00EV + 1.50EH + 1.00EQ, V = 1657.83 kip, ΣM_v = 11902.79 kip-ft about the toe):**
  - Removed: ΔP_AE·L_ab = 121.73 kip at 0.6H = 13.20 ft; k_h·W_wall = 0.15·722.7 = 108.41 kip at 7.623 ft; k_h·W_soil = 0.15·501.6 = 75.24 kip at 12.50 ft. ΣH = 305.37 kip; ΣM_h = 1606.79 + 826.40 + 940.50 = 3373.69 kip-ft. Kept: EQ_sup = 0.30·582·1.00 = 174.6 kip at 17.0 ft.
  - Eccentricity: ΣM_h 10660.52 → 7286.83 kip-ft; e = 6.5 − (11902.79 − 10660.52)/1657.83 = 5.751 ft → 6.5 − (11902.79 − 7286.83)/1657.83 = **3.716 ft**; D/C = e/(B/3 = 4.333) **1.327 → 0.857**.
  - Sliding (EE-I): H 1068.88 → 763.50 kip, R_R = 918.95 kip: EE-I D/C 1.163 → **0.831**; governing becomes Constr — Str I 1.153 (unchanged).
  - Bearing: EE-I 1.746 → 0.492 (largest EE-I permutation); governing Strength I **0.933** (unchanged).
  - Stem: EE-I M_eq = (174.6/44)·14.0 = **55.55** kip-ft/ft (was 90.18 with the M–O and wall-inertia terms); M_u 159.77 → **125.14** kip-ft/ft (EE-I still governs).
  - Same with piles: pile uplift D/C 1.185 → **0.359**.
  - A_s = 0.15: EE-I no longer governs the eccentricity (0.878 → Strength I 0.707) or the stem (113.88 → Strength I 112.06).
  - Multispan (default I-1 setting) and EE-I off: unchanged.

### Self-test
- `__ST_EXPECT` unchanged; the self-test passes (the benchmark is a spread footing with EE-I off).

### Saved data (CLAUDE.md §5)
- No key, field or format change. `meta.defRev` = 4. `migrate()` anchor `// defRev 4 (2026-10-20)`: no value is changed; a pile project gets a one-time notice line on the toe depth, a single-span project with EE-I on a line on the EE-I change. Verified: projects autosaved by `9fa3dee` (piles + single-span + EE-I; spread EE-I off; multispan EE-I on) open with the expected lines (none for the last two), defRev 4, and no notice after a reload.
- Hand-offs: the foundation-loads payload (HANDOFF.md §4.6) carries the Extreme Event I cases as computed; for a single-span bridge they no longer include the M–O / inertia terms. Format unchanged.

### How verified
- `node tests/check-syntax.mjs abutment_calculator.html`: all scripts pass.
- Headless Chromium, `9fa3dee` vs branch, `computeAll()` on default, piles, piles + EE-I 0.30, EE-I 0.15 / 0.30 (multispan), single-span EE-I 0.15 / 0.30, single-span EE-I off, single-span piles + EE-I 0.30, rock: default, rock, multispan EE-I and single-span EE-I off are identical in every check; the other differences are only those listed in F45 / F46. The EE-I values above were recomputed from `R.permutations` / `R.comboEffects` and agree with the tool. All tabs render with no page error; all TeX strings of five variants (193–204 each) render in KaTeX 0.16.9 with `throwOnError`. `node tests/compare.mjs --tool page --file abutment_calculator.html`: storage same; page text differs only in the input ID (defRev in the state).
- **Other copies:** none.

### Open items (not changed)
- **Pile toe one-way shear now fails in the default pile project (D/C 1.516).** The pile toe V_u is the full pile-row reaction forward of the stem face (no reduction for piles within d_v of the face); 5.12.8.6 / 5.8 (strut-and-tie for deep pile caps) are not applied. Engineer to decide whether the toe should be thicker or checked by STM.
- **Crack-control d_c for the pile toe** is taken to the pile heads (c_top + d_b), consistent with h_p. Read literally, 5.6.7 measures d_c from the extreme tension fibre (the footing bottom: e_pile + c_top + d_b = 16 in), which would give s_max < 0 for any practical spacing; say if a different convention is wanted.
- The reinforcement sketch still draws the toe bars at c_F above the footing bottom (display only).

### Appendix — unified diff (exact before/after)
```diff
diff --git a/abutment_calculator.html b/abutment_calculator.html
index 51b0834..f41976d 100644
--- a/abutment_calculator.html
+++ b/abutment_calculator.html
@@ -1021,6 +1021,15 @@ function migrate(){
     S.meta.defRev=3;
     if(add.length) DEFAULTS_NOTICE=(DEFAULTS_NOTICE||[]).concat(add);
   }
+  // defRev 4 (2026-10-20): no input added or changed; one-time notice where a saved project's results change:
+  // pile toe d over the pile heads; single-span Extreme Event I without M–O / wall inertia [C3.10.9.1].
+  if(!(S.meta.defRev>=4)){
+    const add=[];
+    if(S.fnd.branch==="pile") add.push("Pile-supported footing: the toe flexure, one-way shear and crack control now use the depth to the bottom mat above the pile heads, d = t_f − embedment − clear cover − d_b (panel I-7; Tab 5 §5.3)");
+    if(S.seismic.on&&S.geom.HsupMode==="single") add.push("Single-span bridge: Extreme Event I no longer includes the M–O seismic earth pressure or the wall / soil-block inertia [C3.10.9.1] (Tab 3 §3.6a)");
+    S.meta.defRev=4;
+    if(add.length) DEFAULTS_NOTICE=(DEFAULTS_NOTICE||[]).concat(add);
+  }
 }
 function seedExampleReactions(){
   const ex={DC:{P:85},DW:{P:12},LL:{P:70},BR:{Vx:3.5},TU:{Vx:2.5},CRSH:{Vx:1.5},
@@ -1272,8 +1281,8 @@ function buildInputs(){
       <div class="subhead">Pile section (for punching-shear perimeter)</div>
       ${selRow("Pile shape","piles.pileShape",[["hp","H-pile (square envelope)"],["square","Square / precast"],["round","Round / pipe / drilled"]])}
       ${inpRow("Pile size / diameter","piles.pileSize","in",{title:"Governs the loaded area and the two-way (punching) shear critical perimeter through the footing. [AASHTO 5.12.8.6]"})}
-      ${inpRow("Pile embedment into the footing","piles.embed","in",{title:"Length of pile inside the footing above its bottom face. The punching-shear depth is measured above the pile heads (Tab 4 §4.6)."})}
-      ${inpRow("Clear cover, pile top to bottom mat","piles.clrTop","in",{title:"Clear distance from the top of the piles to the bottom reinforcement mat. d_e = t_f − embedment − this cover − d_b (Tab 4 §4.6)."})}
+      ${inpRow("Pile embedment into the footing","piles.embed","in",{title:"Length of pile inside the footing above its bottom face. The punching-shear depth and the toe flexure / shear / crack-control depth are measured above the pile heads (Tab 4 §4.6, Tab 5 §5.3)."})}
+      ${inpRow("Clear cover, pile top to bottom mat","piles.clrTop","in",{title:"Clear distance from the top of the piles to the bottom reinforcement mat. d_e = t_f − embedment − this cover − d_b (Tab 4 §4.6; toe d, Tab 5 §5.3)."})}
     `);
   }
 
@@ -1337,6 +1346,7 @@ function buildInputs(){
     <div class="chk-row"><input type="checkbox" id="chkSeis" data-path="seismic.on" ${sq.on?"checked":""}>
     <label for="chkSeis"><b>Enable Extreme Event I</b> (M–O seismic earth pressure + inertia)</label></div>
     ${sq.on?`
+      ${S.geom.HsupMode==="single"?`<div class="note-box small">Single-span bridge (panel I-1): Extreme Event I uses the static earth pressure + the superstructure connection force; no M–O increment, wall or soil-block inertia [C3.10.9.1, 4.7.4.2] — k<sub>h</sub> ratio, k<sub>v</sub> and the ΔP<sub>AE</sub> height are not used. Wingwalls: engineer's judgment.</div>`:""}
       ${inpRow("Site acceleration coefficient A<sub>s</sub> (S<sub>a</sub> at T = 0 s)","seismic.As","g",{title:"Risk-targeted design acceleration coefficient at T = 0 s for the site class, from the AASHTO-USGS Seismic Design Ground Motion Database or the geotech report [3.10.4.1]; k_h0 = A_s at the wall base [11.6.5.2.1]."})}
       ${inpRow("k<sub>h</sub> ratio (k<sub>h</sub> = ratio × A<sub>s</sub>)","seismic.khR","–",{title:"0.5 for walls free to displace 1–2 in; 1.0 for restrained walls. [11.6.5.2.2]"})}
       ${inpRow("Vertical coefficient k<sub>v</sub>","seismic.kv","–")}
@@ -1638,7 +1648,13 @@ function computeAll(){
 
   /* ===== C-3b Seismic earth pressure & inertia (Mononobe–Okabe) [11.6.5, A11] ===== */
   R.seis=null;
-  if(S.seismic.on){
+  // single-span bridge (panel I-1 "Single-span bridge: H = 0", the tool's span-count input, as C-9): C3.10.9.1 excludes
+  // single-span abutments from the seismic earth-pressure increase of 3.11.4 / 11.6.5, and 4.7.4.2 needs no seismic
+  // analysis for a single-span bridge. Extreme Event I then carries the static earth pressure and the superstructure connection force
+  // A_s·(DC + DW)·share [3.10.9.1] only: no ΔP_AE, and no wall / soil-block inertia (those are part of the 11.6.5.1 method).
+  if(S.seismic.on && g.HsupMode==="single"){
+    R.seis={single:true, kh:0, kv:0, thd:0, dMO:0, KAE:NaN, PAE:NaN, dPAE:0, dPAEh:0, dKh:0, zEQ:0, WiW:0, zWall:0, WiS:0, zSoil:0, EQsup:0};
+  }else if(S.seismic.on){
     const kh=(+S.seismic.khR)*(+S.seismic.As), kv=+S.seismic.kv;
     const th=Math.atan(kh/(1-kv)), thd=th*180/Math.PI;
     const dMO=S.soil.method==="coulomb"?deg2rad(S.soil.delta):0;
@@ -2026,10 +2042,13 @@ function computeAll(){
   const gLL_str=Math.max(+F.llS1,+F.llS5), gEH_max=GP.EH[1];
 
   function sectionCheck(o){
-    /* o = {name, h(in), cover(in), bar, sp(in), Mu(k-ft/ft), Vu(k/ft), Ms(k-ft/ft), face, lbl, ls} */
+    /* o = {name, h(in), cover(in), bar, sp(in), Mu(k-ft/ft), Vu(k/ft), Ms(k-ft/ft), face, lbl, ls}
+       optional hEff, coverEff (in): pile-supported toe, bottom mat above the pile heads: d, d_v, d_c and β_s use the footing
+       above the pile heads (h_p) and the clear cover over the pile tops; S_c (M_cr) stays on the gross h [5.6.3.3, 5.7.2.8, 5.6.7] */
     const bar=BARS[o.bar], b=12;
     const As=bar.Ab*12/o.sp;
-    const d=o.h-o.cover-bar.db/2;
+    const hE=o.hEff!=null?o.hEff:o.h, cvE=o.coverEff!=null?o.coverEff:o.cover;
+    const d=hE-cvE-bar.db/2;
     const a=As*m.fy/(0.85*m.fc*b);
     const beta1=Math.max(0.65,0.85-0.05*Math.max(0,m.fc-4));
     const c2=a/beta1;
@@ -2048,7 +2067,7 @@ function computeAll(){
     const MuMin=Math.min(Mcr,1.33*o.Mu);
     const minOK=phiMn>=MuMin;
     // shear [5.7.3.3]: β = 2.0 only where 5.7.3.4.1 permits it; otherwise the general procedure [5.7.3.4.2] (no transverse reinforcement)
-    const dv=Math.max(0.9*d,0.72*o.h);
+    const dv=Math.max(0.9*d,0.72*hE);
     let betaMode=o.betaMode||"simple";
     if(o.zeroShearDist!=null) betaMode = o.zeroShearDist<3*dv ? "simple" : "general";   // footings: zero-shear point within 3dv of the face
     let betaV=2.0, epsS=null, sxe=null;
@@ -2063,8 +2082,8 @@ function computeAll(){
     // crack control [5.6.7]
     const rho=As/(b*d), k=Math.sqrt(2*rho*nMod+Math.pow(rho*nMod,2))-rho*nMod, j=1-k/3;
     const fss=As>0? Math.min(o.Ms*12/(As*j*d), 0.6*m.fy):0;
-    const dc=o.cover+bar.db/2;
-    const betaS=1+dc/(0.7*(o.h-dc));
+    const dc=cvE+bar.db/2;
+    const betaS=1+dc/(0.7*(hE-dc));
     const gE=+S.reinf.gammaE;
     const sMax=fss>0? 700*gE/(betaS*fss)-2*dc : Infinity;
     // development [AASHTO LRFD 10th Ed. 5.10.8.2.1a]: l_db = 0.17·db·[(λer·fy - Fh/Ab)/(1.97·λ·f'c^0.25)]^2 (Eq. 5.10.8.2.1a-2)
@@ -2081,7 +2100,7 @@ function computeAll(){
     const skinNote = d>36;
     const skinAsk = skinNote ? Math.min(0.012*(d-30), (bar.Ab*12/o.sp)/4) : 0; // in²/ft per face (≤ As/4)
     if(!tensionCtrl) warn(`${o.name}: section is NOT tension-controlled (ε_t = ${fmt(epsT,4)} < 0.005) — φ reduced to ${fmt(phiF,3)} per the 5.5.4.2 transition; consider more depth or less steel.`);
-    return {...o, As, AsReq, d, a, c:c2, beta1, epsT, tensionCtrl, phiF, phiMn, Sc, Mcr, MuMin, minOK,
+    return {...o, hE, cvE, As, AsReq, d, a, c:c2, beta1, epsT, tensionCtrl, phiF, phiMn, Sc, Mcr, MuMin, minOK,
       dv, Vc, phiVn, dcFlex:o.Mu/phiMn, dcShear:o.Vu/phiVn, betaMode, betaV, epsS, sxe,
       rho,k,j,fss,dcBar:dc,betaS,sMax, crackOK:o.sp<=sMax, Ec, wcE, nMod, fc4, ldb, ld, AsST, bST, hST:hIn, gE, skinNote, skinAsk};
   }
@@ -2145,7 +2164,7 @@ function computeAll(){
       const dP=0.5*R.seis.dKh*gam*Hs*Hs;
       Meq+=dP*((+S.seismic.hEQr)*Hs); Veq+=dP;
       const wallApf=(g.tst*g.hstem)+(Math.max(0,g.tsb-g.tst)*g.hstem/2)+(g.tbw*g.hbw);
-      const Wi=R.seis.kh*wallApf*m.gc;                    // kip per ft of wall
+      const Wi=R.seis.kh*wallApf*m.gc;                    // kip per ft of wall (0 for a single-span bridge: k_h = 0, C3.10.9.1)
       Meq+=Wi*(g.hstem/2); Veq+=Wi;
       Meq+=ns*(R.seis.EQsup/Lab)*g.hstem; Veq+=ns*(R.seis.EQsup/Lab); // superstructure inertia at seat
     }
@@ -2280,9 +2299,16 @@ function computeAll(){
     if(hMs>footSvc.heel){ footSvc.heel=hMs; footSvc.heelLbl=c.lbl; }
   }
   R.footSvc=footSvc;
+  // pile-supported footing: the toe (bottom) mat sits above the pile heads, so the toe d is measured from the top of the
+  // footing to the centroid of the bottom mat over the pile heads, d = t_f − e_pile − c_top − d_b (as the punching depth, C-13);
+  // h_p = t_f − e_pile for d_v and β_s [5.6.3.2, 5.7.2.8, 5.6.7]. Spread footing: d = t_f − c_F − d_b/2 (unchanged).
+  const toePileD=fn.branch==="pile"? {embP:Math.max(0,+S.piles.embed||0), clrP:Math.max(0,+S.piles.clrTop||0)} : null;
+  if(toePileD){ toePileD.hP=g.tf*12-toePileD.embP; }
   R.checks.toeFlex=sectionCheck({name:"Toe", h:g.tf*12, cover:m.coverF, bar:S.reinf.toe.size,
     sp:+S.reinf.toe.sp, Mu:toeDem.Mu, Vu:toeDem.Vu, Ms:footSvc.toe, lbl:toeDem.lbl,
-    bST:Math.min(B,Lftg)*12, hST:g.tf*12, zeroShearDist:g.Ltoe*12});
+    bST:Math.min(B,Lftg)*12, hST:g.tf*12, zeroShearDist:g.Ltoe*12,
+    ...(toePileD? {hEff:toePileD.hP, coverEff:toePileD.clrP+BARS[S.reinf.toe.size].db/2, pileMat:toePileD} : {})});
+  if(toePileD && !(R.checks.toeFlex.d>0)) warn(`Toe: no effective depth above the pile heads (t_f − embedment − clear cover − d_b = ${fmt(R.checks.toeFlex.d,1)} in) — check panel I-7.`,"err");
   R.checks.heelFlex=sectionCheck({name:"Heel", h:g.tf*12, cover:m.coverF, bar:S.reinf.heel.size,
     sp:+S.reinf.heel.sp, Mu:heelDem.Mu, Vu:heelDem.Vu, Ms:footSvc.heel, lbl:heelDem.lbl,
     bST:Math.min(B,Lftg)*12, hST:g.tf*12, zeroShearDist:g.Lheel*12});
@@ -2862,7 +2888,7 @@ function renderTabLoads(R){
     <b>8.</b> V&amp;M diagrams: limit states use the design bearing distribution; individual loads use elastic (tension-allowed) superposition — the two intentionally differ for the footing.<br>
     <b>9.</b> Structural: 1-ft strips; strain-based φ per 5.5.4.2; footing crack-control service moments from Service I directly (linear contact pressure / pile reactions).<br>
     <b>10.</b> Construction stage: "Constr — Str I" checks the backfilled wall with <b>no superstructure</b> (fill height ${(+S.constr.hFill>0)?fmt(Math.min(+S.constr.hFill,S.geom.soilH),1)+" ft":"= full"}, dry, γ<sub>LL</sub> = ${fmt(+S.constr.gLL||0)}). If it fails, restrict backfill until erection or revise the design.<br>
-    <b>11.</b> Seismic: ${S.seismic.on?`<b>Extreme Event I ON</b> — M–O with k<sub>h</sub> = ${fmt(+S.seismic.khR,2)}·A<sub>s</sub>, ΔP<sub>AE</sub> at ${fmt(+S.seismic.hEQr,2)}H, wall/soil/superstructure inertia included; EE resistance factors per panel I-11`:`OFF — minimum connection force [3.10.9] surfaced as a note only`}.<br>
+    <b>11.</b> Seismic: ${S.seismic.on&&S.geom.HsupMode==="single"?`<b>Extreme Event I ON — single-span bridge</b>: static earth pressure + superstructure connection force A<sub>s</sub>·(DC+DW)·s<sub>EQ</sub> [3.10.9.1]; no M–O increment and no wall / soil-block inertia [C3.10.9.1, 4.7.4.2] (<span class="xlink" data-jump="tab-stab|o-mo">Tab 3 §3.6a</span>); wingwalls left to the engineer's judgment; EE resistance factors per panel I-11`:S.seismic.on?`<b>Extreme Event I ON</b> — M–O with k<sub>h</sub> = ${fmt(+S.seismic.khR,2)}·A<sub>s</sub>, ΔP<sub>AE</sub> at ${fmt(+S.seismic.hEQr,2)}H, wall/soil/superstructure inertia included; EE resistance factors per panel I-11`:`OFF — minimum connection force [3.10.9] surfaced as a note only`}.<br>
     <b>12.</b> Scour: ${S.fnd.scour?"<b>ON</b> — passive resistance eliminated; q<sub>n</sub> at scoured overburden":"not active"}. Earth surcharge ES = ${fmt(+S.soil.esQ||0,2)} ksf; pile drag load DR = ${fmt(+S.piles.dd||0,0)} kip/pile (γ<sub>DR</sub> = 0 for the geotechnical pile check, ${fmt(+S.piles.gDD,2)} for the structural demand [T.3.4.1-1 note]).<br>
     <b>13.</b> Out of scope / user-side: wingwalls, pile structural (member) design, wind attack-angle sweep (enter the governing directional WS/WL combination), metric units, settlement and global stability (flagged to geotechnical), bearing pad design.<br>
     <b>Sign conventions:</b> X longitudinal (+ driving toward toe), Y transverse, P vertical +down; moments about the toe [design basis §0.3].
@@ -3212,7 +3238,16 @@ function renderTabStab(R){
       ["H",st.HsupMode==="single"?"Single-span bridge: H = 0 [4.7.4.4]":st.HsupMode==="user"?"Average pier height to the next expansion joint (entered) [4.7.4.4]":"Abutment height (stem + backwall) — conservative stand-in for H",st.Hsup,"ft"],["S","Skew",g.skew,"deg"]])}
     ${checkLine("Seat width",`\\dfrac{N_{req}}{N_{prov}} = \\dfrac{${fmtT(st.NreqP)}}{${fmtT(st.Nprov)}}`,st.dc)}
   `);
-  if(S.seismic.on && R.seis){
+  if(S.seismic.on && R.seis && R.seis.single){
+    const q=R.seis;
+    h+=panel("o-mo","3.6a","Extreme Event I — Single-Span Bridge (no seismic earth pressure) [C3.10.9.1, 3.10.9.1, 4.7.4.2]",`
+      <div class="note-box"><b>Single-span bridge</b> (panel I-1, "Pier height H in N" = "Single-span bridge: H = 0", the tool's span-count input): AASHTO LRFD 10th Ed. C3.10.9.1 excludes abutments of single-span bridges from the seismic (M–O) earth-pressure increase of Arts. 3.11.4 and 11.6.5, and Art. 4.7.4.2 needs no seismic analysis for a single-span bridge. Extreme Event I therefore uses the <b>static</b> earth pressure (EH, with the EE-I γ<sub>EH</sub>) plus the superstructure connection force below. Not included: the M–O increment ΔP<sub>AE</sub> (K<sub>AE</sub>), the wall inertia k<sub>h</sub>W<sub>wall</sub> and the soil-block inertia k<sub>h</sub>W<sub>soil</sub> — these belong to the 11.6.5.1 seismic wall analysis that C3.10.9.1 excludes for single-span abutments (the k<sub>h</sub> ratio, k<sub>v</sub> and ΔP<sub>AE</sub> height inputs of panel I-11 are not used). <b>Wingwalls:</b> for single-span bridges C3.10.9.1 leaves their seismic design to the engineer's judgment (not checked by this tool).</div>
+      ${eqB("Superstructure connection force at the seat","AASHTO 3.10.9.1, 4.7.4.2",[
+        "EQ_{sup} = A_s\\,(\\Sigma P_{DC} + \\Sigma P_{DW})\\,s_{EQ}",
+        `EQ_{sup} = (${fmtT(+S.seismic.As,3)})(${fmtT(R.groups.DCsup.V)} + ${fmtT(R.groups.DW.V)})(${fmtT(q.shEQ,2)}) = ${fmtT(q.EQsup)}\\ \\text{kip at the seat}`],
+        "A_s × tributary permanent load (3.10.9.1) with s_EQ = the seismic share at this abutment (panel I-11, default 100 %). The Zone 1 connection force of 3.10.9.2 (§3.6 below) is a connection (keeper / shear key) design force and is not applied to the abutment stability here.")}
+    `);
+  }else if(S.seismic.on && R.seis){
     const q=R.seis, sOK=isFinite(q.KAE);
     h+=panel("o-mo","3.6a","Seismic Earth Pressure — Mononobe–Okabe (Extreme Event I) [11.6.5, A11]",`
       ${eqB("Seismic coefficients","AASHTO 11.6.5.2",[
@@ -3365,7 +3400,11 @@ function sectionHTML(c, demHTML, secNo, title){
     <div class="subhead">Flexural resistance [5.6.3]</div>
     ${eqB("Provided reinforcement & effective depth","AASHTO 5.6.3.2",[
       `A_s = A_b\\,\\dfrac{12}{s} = (${fmtT(BARS[c.bar].Ab)})\\dfrac{12}{${fmtT(c.sp,1)}} = ${fmtT(c.As)}\\ \\text{in}^2/\\text{ft} \\qquad(\\#${c.bar}\\ @\\ ${fmt(c.sp,1)}\\ \\text{in})`,
-      `d = h - c_{cl} - d_b/2 = ${fmtT(c.h,1)} - ${fmtT(c.cover,2)} - ${fmtT(BARS[c.bar].db/2,3)} = ${fmtT(c.d)}\\ \\text{in}`])}
+      ...(c.pileMat?[
+      `h_p = t_f - e_{pile} = ${fmtT(c.h,1)} - ${fmtT(c.pileMat.embP,2)} = ${fmtT(c.hE,1)}\\ \\text{in} \\quad(\\text{footing above the pile heads})`,
+      `d = h_p - c_{top} - d_b = ${fmtT(c.hE,1)} - ${fmtT(c.pileMat.clrP,2)} - ${fmtT(BARS[c.bar].db,3)} = ${fmtT(c.d)}\\ \\text{in} \\quad(\\text{to the centroid of the bottom mat over the pile heads})`]:[
+      `d = h - c_{cl} - d_b/2 = ${fmtT(c.h,1)} - ${fmtT(c.cover,2)} - ${fmtT(BARS[c.bar].db/2,3)} = ${fmtT(c.d)}\\ \\text{in}`])],
+      c.pileMat?`Pile-supported footing: the bottom mat sits on the clear cover c<sub>top</sub> above the pile heads (pile embedment e<sub>pile</sub> and c<sub>top</sub> in panel I-7). d is measured from the top of the footing to the centroid of the two orthogonal bottom layers (d<sub>b</sub> above the bottom of the mat), as the pile punching depth (<span class="xlink" data-jump="tab-found|o-punch">Tab 4, §4.6</span>); h<sub>p</sub> replaces h in d<sub>v</sub>, d<sub>c</sub> and β<sub>s</sub> below. M<sub>cr</sub> uses the gross thickness t<sub>f</sub>.`:"")}
     ${eqB("Stress block & factored resistance","AASHTO 5.6.3.2.2, 5.5.4.2",[
       "a = \\dfrac{A_s f_y}{0.85 f'_c b}\\,, \\qquad \\varphi M_n = \\varphi\\,A_s f_y (d - a/2)",
       `a = \\dfrac{(${fmtT(c.As)})(${fmtT(m.fy,1)})}{0.85(${fmtT(m.fc,1)})(12)} = ${fmtT(c.a)}\\ \\text{in}`,
@@ -3387,7 +3426,7 @@ function sectionHTML(c, demHTML, secNo, title){
     <div class="subhead">One-way shear [5.7.3]</div>
     ${eqB(c.betaMode==="general"?"Concrete shear resistance — general procedure, no transverse reinforcement":"Concrete shear resistance (β = 2.0 simplified)",c.betaMode==="general"?"AASHTO 5.7.3.3 (Eq. 5.7.3.3-3), 5.7.3.4.2 (Eqs. 5.7.3.4.2-2, -4, -7)":"AASHTO 5.7.3.3 (Eq. 5.7.3.3-3), 5.7.3.4.1",[
       "d_v = \\max(0.9d,\\,0.72h)\\,, \\qquad V_c = 0.0316\\,\\beta\\sqrt{f'_c}\\,b_v d_v",
-      `d_v = \\max(0.9\\times${fmtT(c.d)},\\,0.72\\times${fmtT(c.h,1)}) = ${fmtT(c.dv)}\\ \\text{in}`].concat(c.betaMode==="general"?[
+      `d_v = \\max(0.9\\times${fmtT(c.d)},\\,0.72\\times${fmtT(c.hE,1)}) = ${fmtT(c.dv)}\\ \\text{in}${c.pileMat?"\\quad(h = h_p)":""}`].concat(c.betaMode==="general"?[
       `s_{xe} = d_v\\dfrac{1.38}{a_g+0.63} = ${fmtT(c.sxe)}\\ \\text{in}\\,(12 \\le s_{xe} \\le 80)\\,, \\qquad \\varepsilon_s = \\dfrac{|M_u|/d_v + |V_u|}{E_s A_s} = ${fmtT(c.epsS*1000,3)}\\times10^{-3}`,
       `\\beta = \\dfrac{4.8}{1+750\\varepsilon_s}\\cdot\\dfrac{51}{39+s_{xe}} = ${fmtT(c.betaV,3)}`]:[]).concat([
       `\\varphi V_n = 0.90\\times0.0316(${fmtT(c.betaV,3)})\\sqrt{${fmtT(m.fc,1)}}\\,(12)(${fmtT(c.dv)}) = ${fmtT(c.phiVn)}\\ \\text{kip/ft}`]),
@@ -3397,7 +3436,8 @@ function sectionHTML(c, demHTML, secNo, title){
     ${eqB("Service steel stress (cracked elastic section) & spacing limit","AASHTO 5.6.7, Eq. 5.6.7-1 / 5.6.7-2; 5.4.2.4",[
       `E_c = 120{,}000\\,K_1\\,w_c^2\\,f'_c{}^{0.33} = 120{,}000(1.0)(${fmtT(c.wcE,3)})^2(${fmtT(m.fc,1)})^{0.33} = ${fmtT(c.Ec,0)}\\ \\text{ksi}\\,, \\quad n = \\max\\!\\left(6,\\ \\dfrac{29{,}000}{E_c}\\right) = ${fmtT(c.nMod,3)}`,
       `\\rho = ${fmtT(c.rho,4)}\\,, \\; k = ${fmtT(c.k,3)}\\,, \\; j = ${fmtT(c.j,3)}\\,, \\quad f_{ss} = \\dfrac{M_s}{A_s j d} = \\dfrac{(${fmtT(c.Ms)})(12)}{(${fmtT(c.As)})(${fmtT(c.j,3)})(${fmtT(c.d)})} = ${fmtT(c.fss)}\\ \\text{ksi} \\le 0.6f_y`,
-      `\\beta_s = 1+\\dfrac{d_c}{0.7(h-d_c)} = 1+\\dfrac{${fmtT(c.dcBar)}}{0.7(${fmtT(c.h,1)}-${fmtT(c.dcBar)})} = ${fmtT(c.betaS,3)}`,
+      ...(c.pileMat?[`d_c = c_{top} + d_b = ${fmtT(c.pileMat.clrP,2)} + ${fmtT(BARS[c.bar].db,3)} = ${fmtT(c.dcBar)}\\ \\text{in} \\quad(h = h_p = ${fmtT(c.hE,1)}\\ \\text{in};\\ \\text{tension face at the pile heads})`]:[]),
+      `\\beta_s = 1+\\dfrac{d_c}{0.7(h-d_c)} = 1+\\dfrac{${fmtT(c.dcBar)}}{0.7(${fmtT(c.hE,1)}-${fmtT(c.dcBar)})} = ${fmtT(c.betaS,3)}`,
       `s_{max} = \\dfrac{700\\,\\gamma_e}{\\beta_s f_{ss}} - 2d_c = \\dfrac{700(${fmtT(c.gE)})}{(${fmtT(c.betaS,3)})(${fmtT(c.fss)})} - 2(${fmtT(c.dcBar)}) = ${fmtT(c.sMax)}\\ \\text{in}`])}
     <div class="checkline ${c.crackOK?"pass":"fail"}"><span class="flagchip ${c.crackOK?"pass":"fail"}">${c.crackOK?"PASS":"FAIL"}</span>
       Provided spacing s = ${fmt(c.sp,1)} in ${c.crackOK?"≤":">"} s<sub>max</sub> = ${fmt(c.sMax)} in &nbsp;(M<sub>s</sub> = ${fmt(c.Ms)} kip·ft/ft, γ<sub>e</sub> = ${fmt(c.gE)})</div>
@@ -4964,7 +5004,7 @@ function inputEchoHTML(){
     ["Earth surcharge ES",fmt(+s.esQ||0,2),"ksf"],
     ["Construction stage (fill / γLL)",((+S.constr.hFill>0)?fmt(+S.constr.hFill,1):"full")+" / "+fmt(+S.constr.gLL||0),"ft / –"]]);
   h+="<h3>Seismic / scour</h3>"+echoRows([
-    ["Extreme Event I",S.seismic.on?("ON — As="+fmt(+S.seismic.As,3)+", kh="+fmt(+S.seismic.khR,2)+"·As, kv="+fmt(+S.seismic.kv,2)+", ΔPAE @ "+fmt(+S.seismic.hEQr,2)+"H; φτ/φb/φc(EE)="+fmt(+S.seismic.phiTauEQ,2)+"/"+fmt(+S.seismic.phiBEQ,2)+"/"+fmt(+S.seismic.phiCEQ,2)+", e/B ≤ "+(S.seismic.eLimEQmode==="user"?fmt(+S.seismic.eFracEQ,3)+" (owner rule)":"1/3 + (0.4 − 1/3)·γEQ [11.6.5.1]")+", γEH(EE) = "+(eqEHfixed()!==null?fmt(eqEHfixed(),2)+" (agency policy)":"γp max/min")+", superstructure inertia share "+fmt(+S.seismic.shEQ,0)+"%"):"OFF",""],
+    ["Extreme Event I",S.seismic.on?("ON — As="+fmt(+S.seismic.As,3)+(g.HsupMode==="single"?", single-span bridge: static EH + connection force, no M–O / wall inertia [C3.10.9.1]":", kh="+fmt(+S.seismic.khR,2)+"·As, kv="+fmt(+S.seismic.kv,2)+", ΔPAE @ "+fmt(+S.seismic.hEQr,2)+"H")+"; φτ/φb/φc(EE)="+fmt(+S.seismic.phiTauEQ,2)+"/"+fmt(+S.seismic.phiBEQ,2)+"/"+fmt(+S.seismic.phiCEQ,2)+", e/B ≤ "+(S.seismic.eLimEQmode==="user"?fmt(+S.seismic.eFracEQ,3)+" (owner rule)":"1/3 + (0.4 − 1/3)·γEQ [11.6.5.1]")+", γEH(EE) = "+(eqEHfixed()!==null?fmt(eqEHfixed(),2)+" (agency policy)":"γp max/min")+", superstructure inertia share "+fmt(+S.seismic.shEQ,0)+"%"):"OFF",""],
     ["Scour condition",f.scour?"ON — passive eliminated; qn at scoured grade":"off",""]]);
   h+="<h3>Foundation</h3>"+echoRows(f.branch==="spread"?[
     ["Branch","Spread footing on "+f.matl,""],
```

## 2026-10-20 — PR: claude/abut-pilecap-shear — pile toe one-way shear at d_v with partial piles (5.12.8.6.1); D-region note; sketch (PR link added after merge)

Follow-up to the F45 open item ("Pile toe one-way shear now fails in the default pile project (D/C 1.516)"). Standing direction: accurate, not overly conservative. Basis: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), checked against the text and the rendered pages (5.12.8.6.1 and Fig. C5.12.8.6.1-1, 5.7.3.2 / C5.7.3.2, 5.5.1.2.3, 5.8.1, 5.8.2.1 / C5.8.2.2, 5.12.8.2, 5.12.8.4). Numbers come from the real `computeAll()` of origin/main `22c6278` (before) and of this branch (after) in headless Chromium, on `benchState()` with `S.fnd.branch="pile"` (B = 13 ft, L_toe = 3.5 ft, t_f = 3 ft, L_ab = L_ftg = 44 ft, γc = 0.150 kcf; 3 pile rows at x = −4.25 / 0 / +4.25 ft from the footing CL, 12 in piles, e_pile = 12 in, c_top = 3 in; #8 @ 9 in toe bars; f′c = 4 ksi).

### F47. Pile-supported toe: one-way shear V_u at d_v from the stem face, each pile spread over its width   [calc change] [LESS conservative; was over-conservative]
- **Where:** `computeAll` C-10, pile branch of the toe demand (anchor `function toePile(loads){`, the lines above it from `// one-way shear [5.12.8.6.1, 5.7.3.2]`, and `toeDem={Mu:tM.Mu, Vu:tV.Vu,`); a consistency check after the toe `sectionCheck` (anchor `internal mismatch of d_v`); new `toePileShearHTML()` (Tab 5 §5.3, anchor `/* Pile-supported toe: one-way shear at d_v`) called from the pile branch of `toeDemH` in `renderTabStruct`; V&M note (anchor `Pile toe: the diagram shows each pile row as a point load`); I-7 tooltip of `piles.pileSize`; `migrate()` defRev 5 notice (anchor `// defRev 5 (2026-10-20)`).
- **Before:**
  ```js
  function toePile(loads){
    ...
    let MtoeUp=0,VtoeUp=0;
    rowArr.forEach(r=>{ const xT=B/2+r.x; if(xT<g.Ltoe){ VtoeUp+=r.P/Lftg; MtoeUp+=r.P/Lftg*(g.Ltoe-xT); } });
    return {rowArr,MtoeUp,VtoeUp,Mu:Math.max(0,MtoeUp-MtoeDn),Vu:Math.max(0,VtoeUp-0.9*wFoot*g.Ltoe)};
  }
  let tM=Object.assign(toePile(det.loads),{c:det.c,ls:R.checks.pileComp.ls}), tVu=tM.Vu, tVls=tM.ls;
  ... if(t.Vu>tVu+1e-9){ tVu=t.Vu; tVls=lsName; }
  toeDem={Mu:tM.Mu, Vu:tVu, ..., lsV:tVls, ...};
  ```
  i.e. V_u = Σ(P_row/L) of every row with its centre forward of the stem face − 0.90·γc·t_f·L_toe (shear at the face, full rows).
- **After:**
  ```js
  const DpT=Math.max(0,+S.piles.pileSize||0)/12;
  const hPv=g.tf*12-Math.max(0,+S.piles.embed||0), dTv=hPv-Math.max(0,+S.piles.clrTop||0)-BARS[S.reinf.toe.size].db;
  const dvTp=Math.max(0.9*dTv,0.72*hPv)/12, xCrT=g.Ltoe-dvTp;
  const fracOut=xT=> DpT>1e-9? Math.min(1,Math.max(0,(xCrT-(xT-DpT/2))/DpT)) : (xT<xCrT?1:0);
  function toePile(loads){
    ...
    rowArr.forEach(r=>{ const xT=B/2+r.x; if(xT<g.Ltoe){ VtoeUp+=r.P/Lftg; MtoeUp+=r.P/Lftg*(g.Ltoe-xT); }
      const f=fracOut(xT); VsUp+=f*r.P/Lftg;
      if(xT-DpT/2<g.Ltoe) vRows.push({x:r.x, xT, a:g.Ltoe-xT, f, w:r.P/Lftg}); });
    const VswDn=0.9*wFoot*Math.max(0,xCrT);
    return {rowArr,MtoeUp,VtoeUp,VsUp,VswDn,vRows,Mu:Math.max(0,MtoeUp-MtoeDn),Vu:Math.max(0,VsUp-VswDn)};
  }
  let tM=..., tV=tM;  ... if(t.Vu>tV.Vu+1e-9) tV=t;
  toeDem={Mu:tM.Mu, Vu:tV.Vu, ..., lsV:tV.ls, ..., dvT:dvTp, xCr:xCrT, Dp:DpT, VsUp:tV.VsUp, VswDn:tV.VswDn, vRows:tV.vRows, lblV:tV.c?.lbl};
  ```
  In words: section at x_cr = L_toe − d_v from the toe tip (d_v = max(0.9d, 0.72h_p) of the toe over the pile heads, the same value `sectionCheck` uses; a mismatch raises an error); f_i = min[1, max(0, (x_cr − (x_i − D/2))/D)] with D = pile size (each pile load spread uniformly over its width or diameter); V_u = Σ f_i·P_i/L − 0.90·γc·t_f·x_cr ≥ 0. A row wholly between the face and the section has f = 0, a row wholly on the toe side f = 1. Self-weight: only the toe beyond the section (as the spread-footing toe); soil over the toe is neglected (as before). Flexure (M_u at the face with the full rows, 5.12.8.4), crack control, the heel and the spread footing are unchanged. V_u still feeds β of the general procedure when the zero-shear point is beyond 3d_v (5.7.3.4.2), so φV_n changes in that case.
- **Provision:** AASHTO LRFD 10th Ed. Art. 5.12.8.6.1 (one-way critical section at the 5.7.3.2 distance; partial-pile rule), 5.7.3.2, Fig. C5.12.8.6.1-1 (toe section at d_v from the front face), 5.7.2.8 (d_v), 5.12.8.6.2 → 5.7.3.3.
- **Check case (default pile project, Strength I governs V_u before and after; front row P = 1701.70 kip → P/L = 38.675 kip/ft; d_v = 18.00 in, φV_c = 0.9·0.0316·2.0·√4·12·18.00 = 24.572 kip/ft):**
  - Before: V_u = 38.675 − 0.90·0.150·3.00·3.50 = 38.675 − 1.4175 = **37.258** kip/ft → D/C **1.516** (FAIL).
  - After: front row centre x_i = 6.5 − 4.25 = 2.250 ft from the tip, a = 3.50 − 2.25 = 1.25 ft = 15.0 in from the face; pile from 9.0 to 21.0 in; section at d_v = 18.0 in (x_cr = 3.50 − 1.50 = 2.000 ft); f = (2.000 − (2.250 − 0.500))/1.000 = 0.250; V_up,cr = 0.250·38.675 = 9.669; V_dn,cr = 0.90·0.150·3.00·2.000 = 0.810; V_u = **8.859** kip/ft → D/C 8.859/24.572 = **0.361** (PASS). Middle and back rows are under the stem / heel (f = 0).
  - Variant, first row wholly within d_v (`S.piles.offX = 0.25` ft, grid regenerated; front row P/L = 40.666 kip/ft at a = 12.0 in, pile 6.0–18.0 in): before V_u = 40.666 − 1.4175 = **39.248** → D/C **1.597**; after f = (2.000 − (2.500 − 0.500))/1.000 = 0 → V_u = max(0, 0 − 0.810) = **0** → D/C **0.000** (load carried to the stem by a direct strut; see the D-region note).
  - Variant, first row wholly beyond d_v (`offX = −0.75` ft; P/L = 32.703 kip/ft, a = 24.0 in, pile 18.0–30.0 in, f = 1): before 32.703 − 1.4175 = 31.286 → D/C 1.273; after 32.703 − 0.810 = **31.893** → D/C **1.298** (slightly MORE conservative: only the self-weight beyond the section relieves the shear).
  - Piles + EE-I (A_s = 0.30, multispan; EE-I governs V_u): 41.423 → **9.900** kip/ft, D/C 1.686 → **0.403**.
  - Spread footing, rock, and every other check: identical.
- **D-region / strut-and-tie (decision, informational only):** the 10th Ed. permits STM for D-regions (5.5.1.2.3, 5.8.1, 5.8.2.1) and says it should be considered for pile caps where the load-to-reaction distance is under twice the member depth (5.8.2.1; C5.8.2.2, a/d < 2); no article requires it for a pile-supported toe, and 5.12.8.6 gives a complete sectional procedure. So no STM check is added. Tab 5 §5.3 shows a "D-REGION" note when a pile row centre in front of the stem face is closer than 2·t_f to the face (default: a = 15 in < 72 in), naming the rows, and, for rows with centre within d_v, that the pile reaches the stem by a direct strut and its node may be checked by 5.8.2 (C5.7.3.2).
- **Show the work (§6):** Tab 5 §5.3 has a new block "Toe one-way shear demand — critical section at d_v from the stem front face": x_cr, the f_i formula, each straddling row's f worked, Σf·P/L, the self-weight term and V_u; and a table of every pile row near the toe (x from the CL and from the tip, a from the face, pile extent from the face, position vs. the section, f, P/L, f·P/L). P_i links to Tab 4 §4.2 / §4.3 (the report prints "see §x.y").
- **Display only (sketch, §5.7):** on a pile-supported footing the placement sketch draws the pile heads (embedment e_pile) and draws C1 (toe bottom bars) and the A1 hook at e_pile + c_top, above the pile heads. Spread footing: unchanged.

### Saved data (CLAUDE.md §5)
- No key, field or format change. `meta.defRev` = 5. `migrate()` anchor `// defRev 5 (2026-10-20)`: no value is changed; a pile project gets a one-time notice line on the toe shear. Verified: a pile project saved by `22c6278` (defRev 4) opens with the line and defRev 5, and a second `migrate()` adds nothing; a spread project gets no line.

### Self-test
- `__ST_EXPECT` unchanged; the self-test passes on both sides (the benchmark is a spread footing).

### How verified
- `node tests/check-syntax.mjs abutment_calculator.html`: all scripts pass.
- Headless Chromium, `22c6278` vs branch, every `R.checks` field on 13 variants (default, pile, pile + EE-I 0.30, EE-I 0.15 / 0.30, single-span EE-I 0.15 / 0.30 / off, single-span pile + EE-I 0.30, rock, pile row wholly inside d_v, pile row wholly beyond d_v, 24 in piles with L_toe = 5 ft): the only differences are `toeFlex.Vu` / `toeFlex.dcShear` on the pile variants (and `toeFlex.phiVn` on the 24 in pile variant, general-procedure β with the new V_u: D/C 1.674 → 1.174). Warning counts unchanged. The default and both offset variants were recomputed by hand (above) and agree with the tool.
- Tab 5 rendered for pile, pile + EE-I, both offset variants and spread: every TeX string (194–210 per variant) renders in KaTeX 0.16.9 with `throwOnError`; no page error. Sketch checked by screenshot. `node tests/compare.mjs --tool page --file abutment_calculator.html`: storage same; page text differs only in the input ID (defRev 5 in the state).
- **Other copies:** none.

### Open items (not changed)
- **5.7.3.2, concentrated load within d_v.** 5.12.8.6.1 places the one-way section at the 5.7.3.2 distance, and 5.7.3.2 moves the section to the face when a concentrated load lies within d_v. Read literally for a pile cap, any pile within d_v would send the section back to the face with the full pile load (the old result), which would leave the 5.12.8.6.1 partial-pile rule nothing to apply to. This entry follows 5.12.8.6.1 (the footing-specific rule; Fig. C5.12.8.6.1-1). Engineer to confirm.
- **Pile position tolerance (5.12.8.2).** For footing design the 10th Ed. assumes driven piles may be out of position by 6 in or D/4 (unless special equipment is specified). The tool uses planned positions everywhere (pile loads, punching, now the toe shear). Default project with the front row 6 in toward the toe (pile loads held): f = (2.000 − (1.750 − 0.500))/1.000 = 0.75, V_u ≈ 0.75·38.675 − 0.810 = 28.20 kip/ft, D/C ≈ 1.148. Engineer to decide whether to apply the tolerance here and in the punching check.

## 2026-10-20 — PR: claude/aashto10-abut-ee — Extreme Event I permanent loads at 1.00 (AASHTO LRFD 10th Ed. Table 3.4.1-1); engineer direction 2026-10-20 "accurate, not overly conservative"; supersedes F25 (PR link added after merge)

### F48. Extreme Event I: DC, DW, EV, EH, ES at 1.00, no γp max/min permutation   [calc change] [LESS conservative where EE I governed with γp max; MORE where it governed with γp min]
- **Provision:** AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), Table 3.4.1-1 (p. 3-16): the permanent-load column (DC, DW, EH, EV, ES, EL, PS, CR, SH) reads 1.00 for Extreme Event I and II, not γp. C3.4.1 (p. 3-10): γp > 1.0 in extreme events was dropped in 2015. No wall / abutment exception: 11.5.6 refers to 3.4.1; Fig. C11.5.6-4 (p. 11-13) shows 1.00 DC / EV / P_AE for EE I; 11.5.8 and 10.5.5.3 are resistance factors only. The tool has no Extreme Event II.
- **Supersedes:** F25 (EE I γEH = γp max/min by default, N2) and the γp max/min used for DC, DW, EV, ES in EE I since the tool was written; both followed the earlier reading that the table lists γp.
- **Where (anchors) and before → after:**
  1. `LIMITS["Extreme Event I"]` (anchor `if(S.seismic.on) LIMITS["Extreme Event I"]=`): `perm:true` → `perm:false`. With `perm:false` the engine (`comboEffects`) takes DC, DW, EV, ES at 1.0 and EH at 1.0, or the "agency policy" fixed γEH when `gEHEQmode === "agency"` (the `L.eq && eqEHfixed()` branch, unchanged).
  2. `permutations(lsName, stab)` (anchor `const lives=L.liveOpt?`): `(stab&&L.perm&&!L.noSuper)` → `(stab&&(L.perm||L.eq)&&!L.noSuper)`, so EE I keeps the "LS, BR only" live option for sliding / eccentricity / pile minimum / hand-off. EE I now has one permanent-load case (×3 live options when γEQ > 0) instead of 16 (×3).
  3. `comboEffects` label (anchor `const lbl = (L.perm||L.eq)`): new `gq(cl,i)` = `L.perm ? GP[cl][i] : 1.0`; EE I rows now print `1.00·DC + 1.00·DW + 1.00·EV + 1.00·EH (+ 1.00·ES) + γEQ·(…) + 1.00·EQ` (before: the γp max/min of each permutation). Strength labels unchanged (same expression when `L.perm`).
  4. Stem demand loop (anchor `const gEH_ls=`): `gEH_ls` = agency value, else `L.perm ? gEH_max : 1.0` (was `gEH_max` = 1.50 in EE I); new `gES_ls = L.perm ? GP.ES[1] : 1.0` replaces `GP.ES[1]` in `Mu`, `Vu` and the label; `gDCmx = L.perm ? (L.dcMax||GP.DC[1]) : 1.0` and the `eccMin` DW test use 1.0 in EE I; `stemGov.gEH` stored. `stemEcc` already used `[1]` for DC / DW when `!L.perm`.
  5. V&M stem eccentricity (anchor `const Mecc=(isLS&&(Lst.perm||Lst.eq))`): EE I keeps the `stemEcc` permutation (LL reaction on / off), now at γDC = γDW = 1.00.
  6. Shear friction (anchor `const gDCc=`): clamping force P_c uses γDC = 1.00 when EE I governs V_ui (was 0.90 = γp min); report row "P_c … (min DC factor; 1.00 in Extreme Event I)".
  7. Toe self-weight, spread and pile branches (anchor `const gTd=ls=>`): 0.90 (γp min) → 1.00 for EE I permutations; `toePile(loads, gT)`; `toeDem.gTdn` (moment case) and `toeDem.gTV` (pile shear case) printed in the Tab 5 equations instead of the fixed "0.90".
  8. Text: `eqEHfixed()` comment; default-state comment of `gEHEQmode`; panel I-11 select `seismic.gEHEQmode`: stored value `"gp"` kept (no saved-data change), label "1.00, as DC, DW, EV, ES [T.3.4.1-1, 10th Ed.]" (was "γp max/min, as Strength (1.50 / 0.90)"); agency tooltip; design basis item 6; §2.2 permutation note; report seismic row "γDC = γDW = γEV = γES(EE) = 1.00 [T.3.4.1-1], γEH(EE) = 1.00 [T.3.4.1-1]" (or the agency value).
- **Saved data (§5):** no key or format change. `seismic.gEHEQmode` "gp" keeps its stored value and now means 1.00; an "agency" fixed `gEHEQ` is kept and still applies. EE I has no separate saved γ for DC / DW / EV / ES (it used the Strength `factors.gp*`), so no saved override equals an old EE default. `migrate()` defRev 6: one-time notice (`DEFAULTS_NOTICE`) for a project with EE I on, naming the change (and the kept agency γEH). New projects (EE I off by default) get no notice.
- **Check case 1 (built-in project, EE I on, A_s = 0.15, γEQ = 0, spread footing, B = 13 ft):** unfactored resultants: DC 722.70 (sub) + 510.00 (sup) = 1232.70 kip, M_V 4422.82 + 2677.50 = 7100.32 kip-ft; DW 72.00 kip, 378.00 kip-ft; EV 501.60 kip, 5266.80 kip-ft; EH H 392.603 kip, M_H 2879.09 kip-ft; EQ (M–O increment + wall + soil + superstructure inertia) H 56.732 + 54.202 + 37.620 + 87.300 = 235.854 kip, M_H 748.86 + 413.20 + 470.25 + 1484.10 = 3116.41 kip-ft.
  - Before, EE I eccentricity governed by 0.90·DC + 0.65·DW + 1.00·EV + 1.50·EH + 1.00·EQ: V = 1109.43 + 46.80 + 501.60 = 1657.83 kip; M_V = 6390.29 + 245.70 + 5266.80 = 11902.79; M_H = 4318.64 + 3116.41 = 7435.05; e = 6.50 − (11902.79 − 7435.05)/1657.83 = **3.805 ft**; limit B/3 = 4.333 ft (γEQ = 0); **D/C 0.878**, governing (tool 0.8781, "Extreme Event I").
  - After, EE I (single case): V = 1232.70 + 72.00 + 501.60 = **1806.30 kip**; H = 392.603 + 235.854 = **628.46 kip**; M_V = 12745.12; M_H = 2879.09 + 3116.41 = 5995.50; e = 6.50 − 6749.62/1806.30 = **2.763 ft** (D/C 0.638); eccentricity now governed by Strength I, **D/C 0.707** (tool 0.7074).
  - Agency γEH 1.25: H = 1.25 · 392.603 + 235.854 = **726.61 kip** (tool 726.61).
- **Other results (tool, origin/main `efab161` → branch):**
  - Same project: stem M_u 113.88 (EE I, 1.50·EH) → 112.06 kip-ft/ft (Strength I now governs); heel M_u 41.90 → 30.52 kip-ft/ft (EE I, now 1.00 throughout), V_u 15.30 → 10.42 kip/ft; shear friction V_ui 13.72 → 13.25 kip/ft.
  - γEQ = 0.5: eccentricity D/C 0.945 (EE I) → 0.707 (Strength I); stem M_u 124.92 (EE I) → 112.06 (Strength I); toe M_u 54.87 (EE I) → 53.85 (Strength I).
  - γEQ = 0.5, pile footing: EE I minimum pile reaction −28.12 kip (uplift D/C 0.469) → −2.57 kip (D/C 0.043); EE I maximum pile reaction 207.43 → 167.91 kip.
  - EE I off (default project): every check, the stem demand, the dashboard and the pile table identical; built-in self-test passes on both.
- **How verified:** `node tests/check-syntax.mjs abutment_calculator.html`: pass. Headless Chromium (tests/lib.mjs; the tool's CDN libraries are blocked, the calculation does not need them), origin/main vs branch, `computeAll()`: default project, and EE I on with γEQ 0 / 0.5, spread and pile (`R.checks`, `R.stemDem`, `R.dash`, `R.pile.perLS`, the EE I permutation table); `migrate()` from defRev 5 with EE I on ("gp" and agency 1.25) and off; the EE I labels and page text.
- **Other copies:** Bridge Substructure Loading.html made the same change in its own code (EEP, separate PR). No shared snippet.
- **Open items:** none for this change. Wingwalls and the backwall are not designed for EE I (unchanged).

Diff (`abutment_calculator.html`, `git diff -U0` against origin/main `efab161`):

```diff
diff --git a/abutment_calculator.html b/abutment_calculator.html
index 053d0b9..250ef29 100644
--- a/abutment_calculator.html
+++ b/abutment_calculator.html
@@ -633 +633 @@ function defaultState(){
-      gEHEQmode:"gp",                                             // EE-I γEH: "gp" = γp max/min [T.3.4.1-1/-2]; "agency" = fixed gEHEQ
+      gEHEQmode:"gp",                                             // EE-I γEH: "gp" = per Table 3.4.1-1 (10th Ed.: 1.00, EEP; the stored value is kept); "agency" = fixed gEHEQ
@@ -683 +683 @@ function warn(msg,level="warn"){ WARNINGS.push({level,msg}); }
-// Extreme Event I γEH: null = γp max/min permuted [T.3.4.1-1, T.3.4.1-2] (default); a number = the "agency policy" fixed value seismic.gEHEQ
+// Extreme Event I γEH: null = per Table 3.4.1-1 (stored mode "gp"; 10th Ed.: 1.00, EEP) (default); a number = the "agency policy" fixed value seismic.gEHEQ
@@ -1038,0 +1039,7 @@ function migrate(){
+  // defRev 6 (EEP, 2026-10-20): no input added or changed; one-time notice for a project with Extreme Event I on: the permanent loads
+  // DC, DW, EV, EH, ES are now taken at 1.00 (AASHTO LRFD 10th Ed. Table 3.4.1-1, C3.4.1), not the Strength γp max/min. Saved gEHEQmode
+  // "gp" keeps its stored value and now means 1.00; an "agency policy" fixed γEH is kept.
+  if(!(S.meta.defRev>=6)){
+    S.meta.defRev=6;
+    if(S.seismic&&S.seismic.on) DEFAULTS_NOTICE=(DEFAULTS_NOTICE||[]).concat(["Extreme Event I: DC, DW, EV, EH and ES are now factored at 1.00, with no γp max/min permutation (AASHTO LRFD 10th Ed. Table 3.4.1-1, C3.4.1); before, the Strength γp max/min"+(S.seismic.gEHEQmode==="agency"?" (EH keeps the agency-policy value "+(+S.seismic.gEHEQ).toFixed(2)+")":", including EH")+" (Tab 2 §2.1)"]);
+  }
@@ -1361,2 +1368,2 @@ function buildInputs(){
-      ${selRow("γ<sub>EH</sub> at Extreme Event I","seismic.gEHEQmode",[["gp","γp max/min, as Strength (1.50 / 0.90) [T.3.4.1-1, -2]"],["agency","Fixed value (agency policy)"]],{rebuild:true})}
-      ${S.seismic.gEHEQmode==="agency"?inpRow("&nbsp;&nbsp;γ<sub>EH</sub> (agency policy)","seismic.gEHEQ","–",{title:"Fixed static earth-pressure factor within EE-I (e.g. 1.0 with the full M–O thrust) where the owner allows it instead of γp."}):""}
+      ${selRow("γ<sub>EH</sub> at Extreme Event I","seismic.gEHEQmode",[["gp","1.00, as DC, DW, EV, ES [T.3.4.1-1, 10th Ed.]"],["agency","Fixed value (agency policy)"]],{rebuild:true})}
+      ${S.seismic.gEHEQmode==="agency"?inpRow("&nbsp;&nbsp;γ<sub>EH</sub> (agency policy)","seismic.gEHEQ","–",{title:"Fixed static earth-pressure factor within EE-I where the owner requires a value other than the 1.00 of AASHTO LRFD 10th Ed. Table 3.4.1-1."}):""}
@@ -1782 +1789,3 @@ function computeAll(){
-  if(S.seismic.on) LIMITS["Extreme Event I"]={LL:+S.seismic.gEQll, WS:0, WL:0, TU:0, CR:0, EQ:1.0, perm:true, liveOpt:(+S.seismic.gEQll)>0, eq:true};
+  // EEP (2026-10-20): Extreme Event I takes the permanent loads DC, DW, EV, EH, ES at 1.00, no γp max/min permutation
+  // (AASHTO LRFD 10th Ed. Table 3.4.1-1, C3.4.1; was perm:true, i.e. the Strength γp). The "agency policy" fixed γEH still applies.
+  if(S.seismic.on) LIMITS["Extreme Event I"]={LL:+S.seismic.gEQll, WS:0, WL:0, TU:0, CR:0, EQ:1.0, perm:false, liveOpt:(+S.seismic.gEQll)>0, eq:true};
@@ -1812,3 +1821,4 @@ function computeAll(){
-    const lbl = L.perm
-      ? `${(perm.DC===1&&L.dcMax?L.dcMax:GP.DC[perm.DC]).toFixed(2)}·DC + ${GP.DW[perm.DW].toFixed(2)}·DW + ${GP.EV[perm.EV].toFixed(2)}·EV + ${((L.eq&&eqEHfixed()!==null)?eqEHfixed():GP.EH[perm.EH]).toFixed(2)}·EH`
-        +(esOn?` + ${GP.ES[perm.ES??1].toFixed(2)}·ES`:"")
+    const gq=(cl,i)=>L.perm?GP[cl][i]:1.0;   // EEP: Extreme Event I (perm false, eq) labels its permanent loads at 1.00
+    const lbl = (L.perm||L.eq)
+      ? `${(L.perm&&perm.DC===1&&L.dcMax?L.dcMax:gq("DC",perm.DC)).toFixed(2)}·DC + ${gq("DW",perm.DW).toFixed(2)}·DW + ${gq("EV",perm.EV).toFixed(2)}·EV + ${((L.eq&&eqEHfixed()!==null)?eqEHfixed():gq("EH",perm.EH)).toFixed(2)}·EH`
+        +(esOn?` + ${gq("ES",perm.ES??1).toFixed(2)}·ES`:"")
@@ -1827 +1837 @@ function computeAll(){
-    const lives=L.liveOpt?((stab&&L.perm&&!L.noSuper)?[1,2,0]:[1,0]):[0];
+    const lives=L.liveOpt?((stab&&(L.perm||L.eq)&&!L.noSuper)?[1,2,0]:[1,0]):[0];   // EEP: Extreme Event I keeps the "LS, BR only" live option
@@ -2155 +2165,2 @@ function computeAll(){
-    const gEH_ls=(L.eq&&eqEHfixed()!==null)? eqEHfixed() : gEH_max;
+    const gEH_ls=(L.eq&&eqEHfixed()!==null)? eqEHfixed() : (L.perm? gEH_max : 1.0);   // EEP: Extreme Event I EH 1.00 [T.3.4.1-1]
+    const gES_ls=L.perm? GP.ES[1] : 1.0;                                              // EEP: Extreme Event I ES 1.00
@@ -2165 +2176 @@ function computeAll(){
-    const gDCmx = L.dcMax||GP.DC[1];   // Strength IV: γDC max 1.50
+    const gDCmx = L.perm? (L.dcMax||GP.DC[1]) : 1.0;   // Strength IV: γDC max 1.50; EEP: Extreme Event I 1.00
@@ -2177,5 +2188,5 @@ function computeAll(){
-    const Mu=gEH_ls*MEH_ls+(L.LL?L.LL*MLS_ls:0)+GP.ES[1]*MES_ls+HgirdPerFt*g.hstem + MeccPerFt + Meq;
-    const Vu=gEH_ls*VEH_ls+(L.LL?L.LL*VLS_ls:0)+GP.ES[1]*VES_ls+HgirdPerFt + Veq;
-    const eccMin=(gDCe!==gDCmx||gDWe!==GP.DW[1]||llE!==!!L.LL);   // a minimum-factor / no-LL permutation governs M_ecc
-    if(!stemGov||Mu>stemGov.Mu) stemGov={Mu,Vu,HgirdPerFt,MeccPerFt,Pv,Meq,ls:lsName,gDCe,gDWe,llE,eccMin,
-      lbl:`${gEH_ls.toFixed(2)}·EH${esQ>0?` + ${GP.ES[1].toFixed(2)}·ES`:""}${L.LL?` + ${L.LL.toFixed(2)}·(LS,BR)`:""}${L.WS?` + ${L.WS.toFixed(2)}·WS`:""}${L.TU?` + ${L.TU.toFixed(2)}·TU/CR/SH`:""}${L.eq?" + 1.00·EQ":""} + P·e_brg`+(eccMin?` [${gDCe.toFixed(2)}·DC, ${gDWe.toFixed(2)}·DW${L.LL?(llE?", LL reaction on":", no LL reaction"):""}]`:"")+` (${lsName})`};
+    const Mu=gEH_ls*MEH_ls+(L.LL?L.LL*MLS_ls:0)+gES_ls*MES_ls+HgirdPerFt*g.hstem + MeccPerFt + Meq;
+    const Vu=gEH_ls*VEH_ls+(L.LL?L.LL*VLS_ls:0)+gES_ls*VES_ls+HgirdPerFt + Veq;
+    const eccMin=(gDCe!==gDCmx||gDWe!==(L.perm?GP.DW[1]:1.0)||llE!==!!L.LL);   // a minimum-factor / no-LL permutation governs M_ecc
+    if(!stemGov||Mu>stemGov.Mu) stemGov={Mu,Vu,HgirdPerFt,MeccPerFt,Pv,Meq,ls:lsName,gDCe,gDWe,llE,eccMin,gEH:gEH_ls,
+      lbl:`${gEH_ls.toFixed(2)}·EH${esQ>0?` + ${gES_ls.toFixed(2)}·ES`:""}${L.LL?` + ${L.LL.toFixed(2)}·(LS,BR)`:""}${L.WS?` + ${L.WS.toFixed(2)}·WS`:""}${L.TU?` + ${L.TU.toFixed(2)}·TU/CR/SH`:""}${L.eq?" + 1.00·EQ":""} + P·e_brg`+(eccMin?` [${gDCe.toFixed(2)}·DC, ${gDWe.toFixed(2)}·DW${L.LL?(llE?", LL reaction on":", no LL reaction"):""}]`:"")+` (${lsName})`};
@@ -2213 +2224 @@ function computeAll(){
-    const MtoeDn=0.9*wFoot*g.Ltoe*g.Ltoe/2;
+    const gTd=ls=>(LIMITS[ls]&&!LIMITS[ls].perm)? 1.0 : 0.9;   // toe self-weight (DC, relieving): γp min 0.90; EEP: Extreme Event I 1.00 [T.3.4.1-1]
@@ -2223,2 +2234,3 @@ function computeAll(){
-        const tMu=Math.max(0,MtoeUp-MtoeDn), tVu=Math.max(0,VtoeUp_dv-0.9*wFoot*Math.max(0,g.Ltoe-dvT));
-        if(!tM||tMu>tM.Mu) tM={Mu:tMu,VtoeUp,MtoeUp,c,ls:lsName,eS,segs};
+        const gT=gTd(lsName), MtoeDn=gT*wFoot*g.Ltoe*g.Ltoe/2;
+        const tMu=Math.max(0,MtoeUp-MtoeDn), tVu=Math.max(0,VtoeUp_dv-gT*wFoot*Math.max(0,g.Ltoe-dvT));
+        if(!tM||tMu>tM.Mu) tM={Mu:tMu,VtoeUp,MtoeUp,MtoeDn,gT,c,ls:lsName,eS,segs};
@@ -2233 +2245 @@ function computeAll(){
-      toeDem={Mu:tM.Mu, Vu:tV.Vu, VtoeUp:tM.VtoeUp, MtoeUp:tM.MtoeUp, MtoeDn, dvT, eS:tM.eS, ls:tM.ls, lsV:tV.ls,
+      toeDem={Mu:tM.Mu, Vu:tV.Vu, VtoeUp:tM.VtoeUp, MtoeUp:tM.MtoeUp, MtoeDn:tM.MtoeDn, gTdn:tM.gT, dvT, eS:tM.eS, ls:tM.ls, lsV:tV.ls,
@@ -2243 +2255 @@ function computeAll(){
-    const MtoeDn=0.9*wFoot*g.Ltoe*g.Ltoe/2;
+    const gTd=ls=>(LIMITS[ls]&&!LIMITS[ls].perm)? 1.0 : 0.9;   // toe self-weight (DC, relieving): γp min 0.90; EEP: Extreme Event I 1.00 [T.3.4.1-1]
@@ -2252 +2264,2 @@ function computeAll(){
-    function toePile(loads){
+    function toePile(loads,gT){
+      const MtoeDn=gT*wFoot*g.Ltoe*g.Ltoe/2;
@@ -2261,2 +2274,2 @@ function computeAll(){
-      const VswDn=0.9*wFoot*Math.max(0,xCrT);
-      return {rowArr,MtoeUp,VtoeUp,VsUp,VswDn,vRows,Mu:Math.max(0,MtoeUp-MtoeDn),Vu:Math.max(0,VsUp-VswDn)};
+      const VswDn=gT*wFoot*Math.max(0,xCrT);
+      return {rowArr,MtoeUp,VtoeUp,VsUp,VswDn,vRows,MtoeDn,gT,Mu:Math.max(0,MtoeUp-MtoeDn),Vu:Math.max(0,VsUp-VswDn)};
@@ -2264 +2277 @@ function computeAll(){
-    let tM=Object.assign(toePile(det.loads),{c:det.c,ls:R.checks.pileComp.ls}), tV=tM;
+    let tM=Object.assign(toePile(det.loads,gTd(R.checks.pileComp.ls)),{c:det.c,ls:R.checks.pileComp.ls}), tV=tM;
@@ -2269 +2282 @@ function computeAll(){
-        const t=Object.assign(toePile(loads),{c,ls:lsName});
+        const t=Object.assign(toePile(loads,gTd(lsName)),{c,ls:lsName});
@@ -2274 +2287 @@ function computeAll(){
-    toeDem={Mu:tM.Mu, Vu:tV.Vu, MtoeUp:tM.MtoeUp, VtoeUp:tM.VtoeUp, MtoeDn, rowArr:tM.rowArr, ls:tM.ls, lsV:tV.ls,
+    toeDem={Mu:tM.Mu, Vu:tV.Vu, MtoeUp:tM.MtoeUp, VtoeUp:tM.VtoeUp, MtoeDn:tM.MtoeDn, gTdn:tM.gT, rowArr:tM.rowArr, ls:tM.ls, lsV:tV.ls,
@@ -2276 +2289 @@ function computeAll(){
-      dvT:dvTp, xCr:xCrT, Dp:DpT, VsUp:tV.VsUp, VswDn:tV.VswDn, vRows:tV.vRows, lblV:tV.c?.lbl};
+      dvT:dvTp, xCr:xCrT, Dp:DpT, VsUp:tV.VsUp, VswDn:tV.VswDn, gTV:tV.gT, vRows:tV.vRows, lblV:tV.c?.lbl};
@@ -2399 +2412,2 @@ function computeAll(){
-    const Pc=GP.DC[0]*(wallWtAbove+agg.DC.P)/Lab;          // kips/ft, min DC factor (beneficial clamping)
+    const gDCc=(LIMITS[R.stemDem.ls]&&!LIMITS[R.stemDem.ls].perm)? 1.0 : GP.DC[0];   // EEP: 1.00 when Extreme Event I governs V_ui [T.3.4.1-1]
+    const Pc=gDCc*(wallWtAbove+agg.DC.P)/Lab;              // kips/ft, min DC factor (beneficial clamping)
@@ -2587 +2601 @@ function computeAll(){
-      const Mecc=(isLS&&Lst.perm)? stemEcc(Lst,ns).Mecc   // strength / EE: the permutation used by the stem design (γDC, γDW max/min, LL reaction on/off)
+      const Mecc=(isLS&&(Lst.perm||Lst.eq))? stemEcc(Lst,ns).Mecc   // strength / EE: the permutation used by the stem design (γDC, γDW max/min, LL reaction on/off)
@@ -2906 +2920 @@ function renderTabLoads(R){
-    <b>6.</b> γ<sub>p</sub> permutation: every permanent class factored at both bounds; each check takes its own worst permutation — no single global case [3.4.1]. Limit states: Strength I, III, V, construction, Service I and (when on) Extreme Event I; Strength IV is not checked (3.4.1 defines it for superstructures; C3.4.1 excludes substructures, earth-retaining systems and bearing design).<br>
+    <b>6.</b> γ<sub>p</sub> permutation: every permanent class factored at both bounds; each check takes its own worst permutation — no single global case [3.4.1]. Limit states: Strength I, III, V, construction, Service I and (when on) Extreme Event I, which takes DC, DW, EV, EH and ES at 1.00 with no max/min permutation [T.3.4.1-1, C3.4.1]; Strength IV is not checked (3.4.1 defines it for superstructures; C3.4.1 excludes substructures, earth-retaining systems and bearing design).<br>
@@ -3101 +3115 @@ function renderTabComb(R){
-    <div class="note-box">Each permanent load class (DC, DW, EV, EH) is factored at <b>both</b> its maximum and minimum bound — 16 permutations per limit state, each evaluated with live load present and absent (Strength III has no live load). For each individual check the engine selects the permutation producing the <b>worst</b> demand for that check, and reports the governing factor set. No single global load case is assumed.</div>
+    <div class="note-box">Each permanent load class (DC, DW, EV, EH) is factored at <b>both</b> its maximum and minimum bound — 16 permutations per limit state, each evaluated with live load present and absent (Strength III has no live load). Extreme Event I takes every permanent class at 1.00 [T.3.4.1-1, C3.4.1], so it has a single permanent-load case (with live load on / off when γ<sub>EQ</sub> &gt; 0). For each individual check the engine selects the permutation producing the <b>worst</b> demand for that check, and reports the governing factor set. No single global load case is assumed.</div>
@@ -3432 +3446 @@ function toePileShearHTML(td, cT){
-    `V_{dn,cr} = 0.90\\,\\gamma_c t_f\\,x_{cr} = 0.90(${fmtT(S.mat.gc,3)})(${fmtT(g.tf)})(${fmtT(Math.max(0,td.xCr),3)}) = ${fmtT(td.VswDn,3)}\\ \\text{kip/ft}`,
+    `V_{dn,cr} = ${fmtT(td.gTV??0.9)}\\,\\gamma_c t_f\\,x_{cr} = ${fmtT(td.gTV??0.9)}(${fmtT(S.mat.gc,3)})(${fmtT(g.tf)})(${fmtT(Math.max(0,td.xCr),3)}) = ${fmtT(td.VswDn,3)}\\ \\text{kip/ft}`,
@@ -3521 +3535 @@ function renderTabStruct(R){
-      `M_u = ${fmtT(R.GP.EH[1])}\\,M_{EH} + \\gamma_{LL}M_{LS} + H_{gird}\\,h_{stem} + M_{ecc} = ${fmtT(sd.Mu)}\\ \\text{kip-ft/ft}\\,, \\qquad V_u = ${fmtT(sd.Vu)}\\ \\text{kip/ft}`,
+      `M_u = ${fmtT(sd.gEH??R.GP.EH[1])}\\,M_{EH} + \\gamma_{LL}M_{LS} + H_{gird}\\,h_{stem} + M_{ecc} = ${fmtT(sd.Mu)}\\ \\text{kip-ft/ft}\\,, \\qquad V_u = ${fmtT(sd.Vu)}\\ \\text{kip/ft}`,
@@ -3529 +3543 @@ function renderTabStruct(R){
-        `M_{dn} = 0.90\\,\\gamma_c t_f \\dfrac{L_{toe}^2}{2} = 0.90(${fmtT(S.mat.gc,3)})(${fmtT(g.tf)})\\dfrac{(${fmtT(g.Ltoe)})^2}{2} = ${fmtT(td.MtoeDn)}\\ \\text{kip-ft/ft}`,
+        `M_{dn} = ${fmtT(td.gTdn??0.9)}\\,\\gamma_c t_f \\dfrac{L_{toe}^2}{2} = ${fmtT(td.gTdn??0.9)}(${fmtT(S.mat.gc,3)})(${fmtT(g.tf)})\\dfrac{(${fmtT(g.Ltoe)})^2}{2} = ${fmtT(td.MtoeDn)}\\ \\text{kip-ft/ft}`,
@@ -3535 +3549 @@ function renderTabStruct(R){
-        `M_{dn} = 0.90\\,\\gamma_c t_f L_{toe}^2/2 = ${fmtT(td.MtoeDn)}\\ \\text{kip-ft/ft}`,
+        `M_{dn} = ${fmtT(td.gTdn??0.9)}\\,\\gamma_c t_f L_{toe}^2/2 = ${fmtT(td.MtoeDn)}\\ \\text{kip-ft/ft}`,
@@ -3562 +3576 @@ function renderTabStruct(R){
-      ["P_c","Permanent compression across joint (min DC factor)",sf.Pc,"kip/ft"],
+      ["P_c","Permanent compression across joint (min DC factor; 1.00 in Extreme Event I)",sf.Pc,"kip/ft"],
@@ -5070 +5084 @@ function inputEchoHTML(){
-    ["Extreme Event I",S.seismic.on?("ON — As="+fmt(+S.seismic.As,3)+(g.HsupMode==="single"?", single-span bridge: static EH + connection force, no M–O / wall inertia [C3.10.9.1]":", kh="+fmt(+S.seismic.khR,2)+"·As, kv="+fmt(+S.seismic.kv,2)+", ΔPAE @ "+fmt(+S.seismic.hEQr,2)+"H")+"; φτ/φb/φc(EE)="+fmt(+S.seismic.phiTauEQ,2)+"/"+fmt(+S.seismic.phiBEQ,2)+"/"+fmt(+S.seismic.phiCEQ,2)+", e/B ≤ "+(S.seismic.eLimEQmode==="user"?fmt(+S.seismic.eFracEQ,3)+" (owner rule)":"1/3 + (0.4 − 1/3)·γEQ [11.6.5.1]")+", γEH(EE) = "+(eqEHfixed()!==null?fmt(eqEHfixed(),2)+" (agency policy)":"γp max/min")+", superstructure inertia share "+fmt(+S.seismic.shEQ,0)+"%"):"OFF",""],
+    ["Extreme Event I",S.seismic.on?("ON — As="+fmt(+S.seismic.As,3)+(g.HsupMode==="single"?", single-span bridge: static EH + connection force, no M–O / wall inertia [C3.10.9.1]":", kh="+fmt(+S.seismic.khR,2)+"·As, kv="+fmt(+S.seismic.kv,2)+", ΔPAE @ "+fmt(+S.seismic.hEQr,2)+"H")+"; φτ/φb/φc(EE)="+fmt(+S.seismic.phiTauEQ,2)+"/"+fmt(+S.seismic.phiBEQ,2)+"/"+fmt(+S.seismic.phiCEQ,2)+", e/B ≤ "+(S.seismic.eLimEQmode==="user"?fmt(+S.seismic.eFracEQ,3)+" (owner rule)":"1/3 + (0.4 − 1/3)·γEQ [11.6.5.1]")+", γDC = γDW = γEV = γES(EE) = 1.00 [T.3.4.1-1], γEH(EE) = "+(eqEHfixed()!==null?fmt(eqEHfixed(),2)+" (agency policy)":"1.00 [T.3.4.1-1]")+", superstructure inertia share "+fmt(+S.seismic.shEQ,0)+"%"):"OFF",""],
```

## 2026-10-20 — PR: claude/abut-owner-a — owner selector (AASHTO / MassDOT / RIDOT / CTDOT) with owner requirement checks; no computed result changes (PR link added after merge)

### F49. Owner selector and "Owner requirements" card (OWNA)   [new checks and notes only] [no result changed]
- **What:** a new input panel **I-0 Owner** (Geometry tab) with the bridge owner (AASHTO default, MassDOT, RIDOT, CTDOT), the total bridge length for the integral screening (0 = span L) and, while passive resistance is off, the existing input `fnd.Df` (bottom of footing below finished grade) for the frost / embedment rules. A new output panel **Tab 1 §1.0a "Owner Requirements"** lists every rule of the chosen owner: manual section and page, a paraphrase, the kind (Shall = pass/fail, Should = warning, Advisory, Note, Pending reference), the value checked with its worked line, the requirement, the result and a "Worked in" link (CLAUDE.md §6). A chip above the dashboard ("RIDOT: 1 TO CHECK") links to it; a failed Shall adds an error line and a Should a warning line in the warnings box (Tab 1 §1.0a cited). The report includes the card (it is a Tab 1 panel), the owner manual on the cover line and in the references, and an "Owner" block in the input echo.
- **Pattern:** the OWN_RULES table of `Steel Bridge Beam Modules.html` (owners metadata, rule rows with owner / id / kind / sec / text), copied into this tool as `ABUT_OWN` (CLAUDE.md §3: duplicated, not shared). Each rule here also carries an `ev(C)` evaluator; `abutOwnCtx(R)` works the shared values once (pile spacing per row and column and the minimum over all pairs, footing edge to pile face, rows of piles, seat width, pad edge distance from §5.6, expansion movement, etc.).
- **Rules (verified against each manual page; paraphrased, no text copied):**
  - **MassDOT Bridge Manual Part I (Hundredth Anniversary Ed.; written to AASHTO LRFD 9th Ed., 3.1.1.1):** 3.3.1.1 proportions / seat / cover / frost / bar minimums per Part II (pending reference: Part II not available); 3.2.2.3(3) pile spacing 2.5D to 10 ft; 3.2.2.3(4) footing edge to pile perimeter ≥ 9 in; 2.3.4.1 skew 40° / 50° warnings; 3.3.1.1 passive neglected (Shall) and no shear keys (note); 3.1.6 earth pressure coefficient required (K0 on rock or piles, 0.5(K0+Ka) ≤ 5 ft on soil, Coulomb Ka otherwise) shown against the Ka in use; 3.3.1.2 soil over the toe in bearing (not modelled, flagged); 3.3.2.2 heel dead-load case (flagged, not checked in this version); 3.3.1.6 coated backwall / seat bars (flagged); 4.2.2.3 general notes f′c 5.0 ksi and mass concrete (every dimension ≥ 4 ft); 3.1.8.2 temperature; 3.5.7.4 G (least favourable 0.184 ksi for the force); 3.4.4.3 SDC A no abutment seismic design; 3.5.2 crack class (none set for abutments); 3.10.11.1 / 2.3.5.1 integral screening (140 ft steel / 200 ft concrete, 30°); 3.3.1.3 LS with approach slab; 3.2.1 / 3.2.9 settlement note.
  - **RIDOT BDM (April 2026; written to the 10th Ed.):** 11.3.4 top thickness 15 in (backwall), seat width 2'-6" preferred, pad ≥ 2 in from the seat face, girder end gap ≥ Δ + 2 in (Δ = α·ΔT_rise·L_exp), at-rest where tilting is restricted (advisory); 10.4.1 spread footing ≥ 2 ft and D_f ≥ 4 ft; 10.5.1.2 pile cap ≥ 2'-6", spacing ≥ max(30 in, 2.5D + 6 in) and ≤ 10 ft, edge to pile face ≥ 1'-3", embedment ≥ 12 in; 5.4.1 Class 2 exposure (advisory); 5.7.1 / 5.4.1 S&T and skin ≥ #4 @ 12 (advisory, the required area listed per element); 5.2.2 galvanized bars (λcf = 1.0, note); 10.4.3 / 10.4.4 no passive at strength (Shall); 2.4.2.3 skew 40°; 11.3.1 type by height; 11.3.2 / 11.3.3 integral and semi-integral screening; 10.3.1 settlement 1 in / 0.5 in (note); 11.3.8 drainage (note).
  - **CTDOT BRSDM Release 1 (2024; written to the 9th Ed.):** V2 11.6.8.1CT stem front face to CL bearing ≥ 1.25 ft and backwall ≥ 1.25 ft; V2 10.6.1.2 / 10.7.1.2 bottom of footing or cap ≥ 4 ft below grade (none on competent rock) and top of footing ≥ 12 in; V2 10.6.3.4 no keys / passive; V2 3.11.6.4 LS ≥ 2 ft of soil (h_eq values used); V2 5.4.2.1 f′c ≥ 3.0 ksi; V2 5.10 main bars ≥ #5 @ ≤ 12 in, all ≥ #4; V2 5.10.3 whole-inch spacing; V2 5.6.7 Class 2 (advisory); V2 10.7.1.2 ≥ 2 pile rows and 12 in embedment; AASHTO 10.7.1.2 spacing ≥ max(30 in, 2.5D) and 9 in edge (the BRSDM adds to that article); App. CT11.1.1.1 integral screening; Table 3.4.1-1 Extreme Event III (note: not modelled); settlement (note).
- **Where (anchors):**
  1. `defaultState()` anchor `own:{ owner:"AASHTO", Ltot:0 }` (new optional saved field).
  2. After `function eqEHfixed()`: the block `/* ---------- Owner (state DOT) rules (OWNA, 2026-10-20)` with `ABUT_OWN_LIST`, `abutOwner()`, `ABUT_OWN`, `abutOwnCtx()`, the `own*` helpers, `ABUT_OWN.rules=[…]`, `abutOwnChecks()`.
  3. `migrate()` anchor `// OWNA (2026-10-20): owner field.`
  4. `buildInputs()` anchor `/* ---- I-0 Owner (OWNA) ---- */`; `ABUT_IN_SEC` gains `'in-own':'geom'`.
  5. End of `computeAll()` anchor `/* ===== C-22 Owner requirements (OWNA)`.
  6. Fingerprint anchor `own:abutOwner()==="AASHTO"?undefined:S.own`.
  7. `ownerPanelHTML(R)` before `renderTabLoads`, called after panel 1.0; dashboard `ownChip`; `abutRefsNow()`; cover line; `inputEchoHTML()` Owner block; MassDOT reference row: "edition: verify" replaced by the verified "Hundredth Anniversary Ed.; written to AASHTO LRFD 9th Ed., 3.1.1.1".
- **Saved data (§5):** one new optional field `S.own = {owner, Ltot}`. No key or existing format changed. A project saved before it (autosave, saved project, JSON) opens as `owner: "AASHTO"`, `Ltot: 0`. The tool's only MassDOT setting, the I-6 "Floating (MassDOT default)" restraint model, is the default of every project, so it does not mark a project as MassDOT (mapping it would make every saved project MassDOT). The Input ID (fingerprint) leaves `own` out while the owner is AASHTO, so an existing project keeps its Input ID.
- **Check case (built-in project, pile footing, RIDOT):** pile grid 3 rows × 8 columns, row spacing 4.25 ft, column spacing 5.5 ft, HP 12 in, B = 13 ft. Spacing minimum = 4.25·12 = 51.0 in ≥ max(30, 2.5·12 + 6 = 36) in → pass; maximum 5.50 ft ≤ 10 ft → pass. Edge: row 1 at x = −4.25 ft from the footing CL, x_T = 6.50 − 4.25 = 2.25 ft → 27.0 − 6.0 = 21.0 in ≥ 15 in → pass. Pad edge: (3.00 − 1.25)·12 − 18/2 = 12.0 in ≥ 2 in. Gap: Δ = 6.5×10⁻⁶ · 52 · 40·12 = 0.162 in; Δ + 2 = 2.162 in ≤ 4.00 in → pass. Crack: γe = 1.00 vs Class 2 → CHECK. Tool: identical values; RIDOT "1 TO CHECK". CTDOT, spread: D_f = 3.00 ft < 4 ft → FAIL; D_f − t_f = 0 < 1 ft → CHECK.
- **How verified:** `node tests/check-syntax.mjs abutment_calculator.html`: pass. Headless Chromium (tests/lib.mjs; the CDN libraries are blocked, the calculation does not need them), origin/main `e774618` vs branch, `computeAll()` on the default project, an old save (no `own`), pile footing, Extreme Event I with γEQ 0.5, rock, TU + BR + ES + construction fill: every check, the dashboard, stem / toe / heel demands, pile reactions per limit state, the permutation tables, warnings, self-test and the Input ID identical. MassDOT, RIDOT and CTDOT (spread and pile, and RIDOT with EE I) give results identical to AASHTO; only the owner rows and the owner warning lines differ. The report builds with the card (§6.2 in the printout) and no console error.
- **Other copies:** the owner table pattern is copied from `Steel Bridge Beam Modules.html` (OWN_RULES); this copy is the abutment's own (different rules). No shared snippet changed.
- **Open items:** MassDOT Part II (standard details) is needed for the MassDOT minimum dimensions, seat width, cover, frost depth and bar sizes (pending reference). MassDOT 3.3.1.2 soil over the toe in the bearing pressure is not modelled (flagged). Calculation owner defaults follow in the stacked PR (claude/abut-owner-b).

Diff (`abutment_calculator.html`, `git diff -U0` against origin/main `e774618`):

```diff
diff --git a/abutment_calculator.html b/abutment_calculator.html
index 250ef29..dd331d9 100644
--- a/abutment_calculator.html
+++ b/abutment_calculator.html
@@ -638,0 +639 @@ function defaultState(){
+    own:{ owner:"AASHTO", Ltot:0 },                               // OWNA: bridge owner (AASHTO | MassDOT | RIDOT | CTDOT); total bridge length for the integral screening (0 = span L)
@@ -684,0 +686,209 @@ function eqEHfixed(){ const s=S.seismic||{}; return s.gEHEQmode==="agency"? +s.g
+/* ---------- Owner (state DOT) rules (OWNA, 2026-10-20) ----------
+   Same pattern as the OWN_RULES table of Steel Bridge Beam Modules.html, duplicated here on purpose (CLAUDE.md §3: no shared file).
+   AASHTO LRFD 10th Ed. (2024) stays the calculation basis; an owner's rules are checked on top. Saved as S.own.owner: 'AASHTO'
+   (default; an older project without the field opens as 'AASHTO' with identical results), 'MassDOT', 'RIDOT' or 'CTDOT'.
+   Per rule: owner, id, kind ('shall-check': pass/fail; 'should-warning': a warning; 'advisory': the owner value shown beside the
+   value in use; 'note'; 'pending-reference': needs a document that is not available), sec (manual section and page), text (a short
+   paraphrase; no manual text is reproduced), ev(C) → {st: pass|fail|warn|adv|note|pend|na, val, lim, tex (worked line), link}.
+   The checks change no computed result: they are listed in Tab 1 §1.0a and summarised above the dashboard. */
+const ABUT_OWN_LIST=["AASHTO","MassDOT","RIDOT","CTDOT"];
+function abutOwner(){ const o=S.own&&S.own.owner; return ABUT_OWN_LIST.includes(o)?o:"AASHTO"; }
+const ABUT_OWN={
+  v:1,
+  note:"The MassDOT LRFD Bridge Manual and the CTDOT BRSDM are written to AASHTO LRFD 9th Ed.; the RIDOT BDM (April 2026) to the 10th Ed. This tool applies AASHTO LRFD 10th Ed. (2024) with the owner rules on top.",
+  owners:{
+    AASHTO:{manual:"AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024)", short:"AASHTO LRFD", aashto:"10th Ed.", none:true},
+    MassDOT:{manual:"MassDOT LRFD Bridge Manual, Part I (Hundredth Anniversary Ed.)", short:"MassDOT Bridge Manual Part I", aashto:"9th Ed."},
+    RIDOT:{manual:"RIDOT Bridge Design Manual (April 2026)", short:"RIDOT BDM", aashto:"10th Ed."},
+    CTDOT:{manual:"CTDOT Bridge and Roadway Structures Design Manual (BRSDM), Release 1 (2024)", short:"CTDOT BRSDM", aashto:"9th Ed."}
+  },
+  rules:[]
+};
+const abutOwnCite=r=>((ABUT_OWN.owners[r.owner]||{}).short||r.owner)+" "+r.sec;
+/* values the owner rules check, worked once per recalculation (geometry, pile layout, bars) */
+function abutOwnCtx(R){
+  const g=S.geom, B=R.geo.B, Lftg=(+g.Lftg||g.Lab), pile=S.fnd.branch==="pile";
+  const act=pile?activePiles():[], D=+S.piles.pileSize||0;
+  // pile spacing: gaps between neighbours in each row (piles with the same x) and each column (same y); minimum also over all pairs
+  let sMin=Infinity, sMax=0, sMinAt="", sMaxAt="";
+  const grp=(key,along)=>{ const m={}; act.forEach(q=>{ const k=q[key].toFixed(2); (m[k]=m[k]||[]).push(q[along]); });
+    Object.values(m).forEach(a=>{ a.sort((x,y)=>x-y); for(let i=1;i<a.length;i++){ const s=a[i]-a[i-1]; if(s>sMax+1e-9){ sMax=s; sMaxAt=along==="y"?"along the abutment (y)":"across the footing (x)"; } } }); };
+  grp("x","y"); grp("y","x");
+  for(let i=0;i<act.length;i++) for(let j=i+1;j<act.length;j++){ const s=Math.hypot(act[i].x-act[j].x,act[i].y-act[j].y); if(s<sMin-1e-9){ sMin=s; sMinAt="piles "+(S.piles.coords.indexOf(act[i])+1)+" and "+(S.piles.coords.indexOf(act[j])+1); } }
+  // footing edge to pile face (square envelope of side D, or radius D/2 for a round pile: the same distance to a straight edge)
+  let eMin=Infinity, eAt="", eSide="";
+  act.forEach(q=>{ const xT=B/2+q.x, no=S.piles.coords.indexOf(q)+1;
+    [[xT*12-D/2,"toe edge"],[(B-xT)*12-D/2,"heel edge"],[(Lftg/2-Math.abs(q.y))*12-D/2,"end of footing"]].forEach(([e,s])=>{ if(e<eMin-1e-9){ eMin=e; eAt="pile "+no; eSide=s; } }); });
+  const rows=new Set(act.map(q=>q.x.toFixed(2))).size;
+  const Ltot=(+S.own.Ltot>0)? +S.own.Ltot : +g.spanL;
+  const Lg=S.longit||{}, dExp=(+Lg.cte||0)*(+Lg.dTrise||0)*(+Lg.Lexp||0)*12;   // in: expansion toward the backwall (temperature rise)
+  const seatW=R.geo.seatW, brgFront=seatW-g.brgSetback;                          // ft: stem front face (at the seat) to CL bearing
+  const bars=[["bw","Backwall",S.reinf.bw],["stem","Stem",S.reinf.stem],["toe","Toe",S.reinf.toe],["heel","Heel",S.reinf.heel]];
+  return {g,B,Lftg,pile,act,D,sMin,sMax,sMinAt,sMaxAt,eMin,eAt,eSide,rows,Ltot,dExp,seatW,brgFront,bars,
+    cFront:R.checks.bearingSeat?R.checks.bearingSeat.cFront:NaN, mat:Lg.material==="concrete"?"concrete":"steel",
+    hTot:R.geo.hTotal, Df:+S.fnd.Df, rock:S.fnd.branch==="spread"&&S.fnd.matl==="rock", gE:+S.reinf.gammaE, fc:+S.mat.fc, R};
+}
+const ownF=(x,dp=2)=>fmtT(x,dp), ownLE=(v,l)=>v<=l+1e-9, ownGE=(v,l)=>v>=l-1e-9;
+const OWN_LK={sketch:["tab-loads","o-sketch","§1.1 cross-section"], pile:["tab-found","o-pilelay","§4.1 pile layout"], seat:["tab-struct","o-str-bearing","§5.6 bearing seat"],
+  supp:["tab-stab","o-seat","§3.5 support length"], eh:["tab-loads","o-eh","§1.3 earth pressure"], ls:["tab-loads","o-ls","§1.4 surcharge"], stem:["tab-struct","o-str-Stem","§5.2 stem"],
+  bw:["tab-struct","o-str-Backwall","§5.1 backwall"], heel:["tab-struct","o-str-Heel","§5.4 heel"], rebar:["tab-struct","o-rebar","§5.7 bar schedule"], tu:["tab-loads","o-longit-tu","§1.7 temperature"],
+  slide:["tab-stab","o-slide","§3.1 sliding"], svc:["tab-stab","o-svc","§3.4 Service I"], seis:["tab-stab","o-seis","§3.6 connection force"], basis:["tab-loads","o-basis","§1.0 basis"]};
+/* shared check bodies (each owner's own values) */
+function ownPileSp(C,minIn,maxFt,minTxt){ if(!C.pile) return {st:"na",val:"spread footing",lim:"—"};
+  if(C.act.length<2) return {st:"na",val:"fewer than 2 active piles",lim:"—"};
+  const ok=ownGE(C.sMin*12,minIn)&&ownLE(C.sMax,maxFt);
+  return {st:ok?"pass":"fail", val:`s<sub>min</sub> = ${fmt(C.sMin*12,1)} in (${C.sMinAt}); s<sub>max</sub> = ${fmt(C.sMax,2)} ft (${C.sMaxAt})`, lim:`${fmt(minIn,1)} in ≤ s ≤ ${fmt(maxFt,1)} ft`,
+    tex:`s_{min} = ${ownF(C.sMin*12,1)}\\ \\text{in} ${ownGE(C.sMin*12,minIn)?"\\ge":"<"} ${minTxt} = ${ownF(minIn,1)}\\ \\text{in};\\quad s_{max} = ${ownF(C.sMax)}\\ \\text{ft} ${ownLE(C.sMax,maxFt)?"\\le":">"} ${ownF(maxFt,1)}\\ \\text{ft}`, link:OWN_LK.pile}; }
+function ownPileEdge(C,minIn,face){ if(!C.pile) return {st:"na",val:"spread footing",lim:"—"};
+  if(!C.act.length) return {st:"na",val:"no active piles",lim:"—"};
+  return {st:ownGE(C.eMin,minIn)?"pass":"fail", val:`${fmt(C.eMin,1)} in (${C.eAt}, ${C.eSide})`, lim:`≥ ${fmt(minIn,1)} in`,
+    tex:`e_{min} = \\min(x_T,\\ B-x_T,\\ L_{ftg}/2-|y|)\\cdot12 - D/2 = ${ownF(C.eMin,1)}\\ \\text{in} ${ownGE(C.eMin,minIn)?"\\ge":"<"} ${ownF(minIn,1)}\\ \\text{in}\\ (\\text{footing edge to pile ${face}},\\ D = ${ownF(C.D,1)}\\ \\text{in})`, link:OWN_LK.pile}; }
+function ownPileEmb(C,minIn){ if(!C.pile) return {st:"na",val:"spread footing",lim:"—"};
+  const e=+S.piles.embed||0; return {st:ownGE(e,minIn)?"pass":"fail", val:`${fmt(e,1)} in (panel I-7)`, lim:`≥ ${fmt(minIn,0)} in`, link:OWN_LK.pile}; }
+function ownMinT(v,minFt,what,lk){ return {st:ownGE(v,minFt)?"pass":"fail", val:`${what} = ${fmt(v,2)} ft`, lim:`≥ ${fmt(minFt,2)} ft`, link:lk||OWN_LK.sketch}; }
+function ownSkew(C,lim1,lim2){ const s=+C.g.skew||0; const st=s>lim1+1e-9?"warn":"pass";
+  return {st, val:`skew = ${fmt(s,1)}°`, lim:`≤ ${fmt(lim1,0)}°`+(lim2?` (strong caution above ${fmt(lim2,0)}°)`:""), link:OWN_LK.supp}; }
+function ownCrack(C,owner){ const cls=Math.abs(C.gE-0.75)<1e-9?"Class 2 (γe = 0.75)":Math.abs(C.gE-1)<1e-9?"Class 1 (γe = 1.00)":"γe = "+fmt(C.gE,2);
+  if(!owner) return {st:"adv", val:cls+" (panel I-9)", lim:"not set by the owner for abutments", link:OWN_LK.stem};
+  return {st:Math.abs(C.gE-0.75)<1e-9?"pass":"warn", val:cls+" (panel I-9)", lim:"Class 2 (γe = 0.75)", link:OWN_LK.stem}; }
+function ownIntegral(C,lim){ const s=+C.g.skew||0, L=C.Ltot, Lm=C.mat==="concrete"?lim.Lc:lim.Ls;
+  const skOK=lim.strict?(s<lim.sk-1e-9):ownLE(s,lim.sk), okL=ownLE(L,Lm), okS=lim.Lsp?ownLE(+C.g.spanL,lim.Lsp):true;
+  const elig=skOK&&okL&&okS;
+  return {st:"adv", val:`skew ${fmt(s,1)}°, total length ${fmt(L,1)} ft (${C.mat})${lim.Lsp?`, span ${fmt(+C.g.spanL,1)} ft`:""} → <b>${elig?"within":"outside"}</b> the screening limits`,
+    lim:`skew ${lim.strict?"<":"≤"} ${lim.sk}°, L ≤ ${Lm} ft${lim.Lsp?`, span ≤ ${lim.Lsp} ft`:""}${lim.more?"; "+lim.more:""}`, link:OWN_LK.supp}; }
+ABUT_OWN.rules=[
+  /* ---------------- MassDOT LRFD Bridge Manual, Part I (Hundredth Anniversary Ed.) ---------------- */
+  {owner:"MassDOT", id:"geo.part2", kind:"pending-reference", sec:"3.3.1.1 (p. 3-18)", ref:"MassDOT Bridge Manual Part II (standard details)",
+    text:"Footing, stem and backwall proportions, bridge seat width, cover, frost depth / bottom-of-footing embedment and minimum bar size and spacing follow the Part II standard details; Part I gives no values",
+    ev:C=>({st:"pend", val:`t<sub>bw</sub> ${fmt(C.g.tbw)} ft, t<sub>st</sub> ${fmt(C.g.tst)} ft, t<sub>f</sub> ${fmt(C.g.tf)} ft, seat ${fmt(C.seatW)} ft`, lim:"Part II (not available)", link:OWN_LK.sketch})},
+  {owner:"MassDOT", id:"pile.sp", kind:"shall-check", sec:"3.2.2.3(3) (p. 3-9)", text:"Pile spacing at least 2.5 pile diameters and not more than 10 ft center to center (unless an alternate design is approved)",
+    ev:C=>ownPileSp(C,2.5*C.D,10,`2.5D = 2.5(${ownF(C.D,1)})`)},
+  {owner:"MassDOT", id:"pile.edge", kind:"shall-check", sec:"3.2.2.3(4) (p. 3-9)", text:"Footing edge to the perimeter of any pile at least 9 in",
+    ev:C=>ownPileEdge(C,9,"perimeter")},
+  {owner:"MassDOT", id:"skew", kind:"should-warning", sec:"2.3.4.1 (p. 2-10)", text:"Skew over 40°: the standard details may need modification; over about 50°: acute-corner, thermal-twist and diaphragm fatigue problems to be mitigated",
+    ev:C=>ownSkew(C,40,50)},
+  {owner:"MassDOT", id:"passive", kind:"shall-check", sec:"3.3.1.1 (p. 3-18)", text:"Passive resistance in front of the wall neglected for sliding, overturning and bearing",
+    ev:C=>({st:(S.fnd.branch==="spread"&&S.fnd.usePassive)?"fail":"pass", val:(S.fnd.branch==="spread"&&S.fnd.usePassive)?"passive included (panel I-4)":"passive not used", lim:"neglected", link:OWN_LK.slide})},
+  {owner:"MassDOT", id:"key", kind:"note", sec:"3.3.1.1 (p. 3-18)", text:"Shear keys tied into footings preferably not used to resist sliding (widen the heel, batter piles or lower the footing instead)",
+    ev:C=>({st:"note", val:"no key is modelled", lim:"—", link:OWN_LK.slide})},
+  {owner:"MassDOT", id:"K", kind:"advisory", sec:"3.1.6 (p. 3-4)", text:"Earth pressure, unless the geotechnical report says otherwise: K0 for cantilever walls on rock or piles; 0.5(K0 + Ka) for cantilever walls on soil 5 ft high or less; Ka by Coulomb theory otherwise",
+    ev:C=>{ const onRP=C.pile||C.rock, H=C.R.geo.H, K0=1-Math.sin(deg2rad(+S.soil.phi)), req=onRP?"K0":(H<=5+1e-9?"0.5(K0 + Ka)":"Ka (Coulomb)");
+      return {st:req.startsWith("Ka")&&S.soil.method==="coulomb"?"pass":"warn", val:`${S.soil.method==="coulomb"?"Coulomb":"Rankine"} K<sub>a</sub> = ${fmt(C.R.ka,4)} used (active, panel I-3)`,
+        lim:`${req} (${onRP?(C.pile?"pile-supported":"on rock"):"on soil, H = "+fmt(H,2)+" ft"})`, tex:`K_0 = 1-\\sin\\varphi_f = 1-\\sin${ownF(+S.soil.phi,1)}° = ${ownF(K0,4)}`, link:OWN_LK.eh}; }},
+  {owner:"MassDOT", id:"toeSoil", kind:"advisory", sec:"3.3.1.2 (p. 3-18)", text:"Weight of the earth in front of the wall included when computing the footing bearing pressure",
+    ev:C=>({st:S.fnd.branch==="spread"?"warn":"na", val:S.fnd.branch==="spread"?"not modelled: soil over the toe is omitted (bearing pressure slightly low); add it by hand":"pile-supported footing", lim:"included in bearing", link:OWN_LK.svc})},
+  {owner:"MassDOT", id:"heel", kind:"advisory", sec:"3.3.2.2 (p. 3-21)", text:"Spread footings: toe steel without the soil above the toe offsetting the upward pressure; heel top steel for all dead load above the heel (incl. the heel), no live load, load and resistance factors 1.0, no upward pressure relief",
+    ev:C=>({st:S.fnd.branch==="spread"?"warn":"na", val:S.fnd.branch==="spread"?"toe: soil above the toe not used (as required); heel: the dead-load-only case is not checked in this version":"pile-supported footing", lim:"heel: M<sub>DL</sub> ≤ 1.0·M<sub>n</sub>", link:OWN_LK.heel})},
+  {owner:"MassDOT", id:"coat", kind:"advisory", sec:"3.3.1.6 (p. 3-18)", text:"Epoxy-coated reinforcement (or galvanized COATED BARS) at least in backwalls and beam seats, and next to faces within 30 ft of a traveled way",
+    ev:C=>({st:"warn", val:"development length uses uncoated bars (λ<sub>cf</sub> = 1.0)", lim:"coated backwall and seat bars", link:OWN_LK.bw})},
+  {owner:"MassDOT", id:"fc", kind:"advisory", sec:"4.2.2.3, General Notes (p. 4-5)", text:"Concrete 5000 HP (f′c = 5.0 ksi) unless otherwise specified",
+    ev:C=>({st:Math.abs(C.fc-5)<1e-9?"pass":"adv", val:`f′c = ${fmt(C.fc,2)} ksi (panel I-2)`, lim:"5.0 ksi", link:OWN_LK.stem})},
+  {owner:"MassDOT", id:"mass", kind:"note", sec:"4.2.2.3, General Notes (p. 4-5)", text:"Pours with every dimension 4 ft or more are mass concrete placements (heat-of-hydration analysis and thermal control plan)",
+    ev:C=>{ const g=C.g, ftg=g.tf>=4&&C.B>=4&&C.Lftg>=4, stem=g.tst>=4&&g.hstem>=4&&g.Lab>=4, L=[ftg?"footing":"",stem?"stem":""].filter(Boolean);
+      return {st:L.length?"warn":"pass", val:L.length?L.join(" and ")+": every dimension ≥ 4 ft":"no pour with every dimension ≥ 4 ft", lim:"thermal control plan if ≥ 4 ft in every direction", link:OWN_LK.sketch}; }},
+  {owner:"MassDOT", id:"temp", kind:"advisory", sec:"3.1.8.2 (p. 3-7)", text:"Uniform temperature (Cold Climate, Procedure A basis, the 65 % factor already included): steel +70 / −100 °F with α = 6.5×10⁻⁶; concrete +30 / −70 °F with α = 5.5×10⁻⁶",
+    ev:C=>{ const Lg=S.longit, st=C.mat==="concrete"?[30,70,5.5e-6]:[70,100,6.5e-6], ok=Math.abs(+Lg.dTrise-st[0])<1e-9&&Math.abs(+Lg.dTfall-st[1])<1e-9&&Math.abs(+Lg.cte-st[2])<1e-12;
+      return {st:ok?"pass":"adv", val:`+${fmt(+Lg.dTrise,0)} / −${fmt(+Lg.dTfall,0)} °F, α = ${(+Lg.cte*1e6).toFixed(1)}×10⁻⁶ (panel I-6b${Lg.computeTU?"":"; TU calculation off"})`, lim:`+${st[0]} / −${st[1]} °F, α = ${(st[2]*1e6).toFixed(1)}×10⁻⁶ (${C.mat})`, link:OWN_LK.tu}; }},
+  {owner:"MassDOT", id:"G", kind:"advisory", sec:"3.5.7.4 (p. 3-57)", text:"Elastomer specified G = 0.160 ksi; design with the least favorable value of 0.136–0.184 ksi (the larger value for the force on the abutment)",
+    ev:C=>({st:Math.abs(+S.bearing.G-0.184)<1e-9?"pass":"adv", val:`G = ${fmt(+S.bearing.G,3)} ksi (panel I-6b)`, lim:"0.184 ksi for the pad shear force", link:OWN_LK.tu})},
+  {owner:"MassDOT", id:"seis", kind:"note", sec:"3.4.4.3 (p. 3-35)", text:"SDC A conventional bridges: abutments need no seismic design (no abutment inertia or seismic soil force); connections per Guide Spec 4.6 on the permanent load only; support length per Guide Spec 4.12",
+    ev:C=>({st:(S.seismic.on&&+S.seismic.zone===1)?"warn":"note", val:S.seismic.on?"Extreme Event I is ON (panel I-11)":"Extreme Event I off", lim:"not required in SDC A (S<sub>D1</sub> &lt; 0.15)", link:OWN_LK.seis})},
+  {owner:"MassDOT", id:"crack", kind:"advisory", sec:"3.5.2 (p. 3-46)", text:"Part I sets no crack-control exposure class for abutments (Class 2 is specified for link slabs)",
+    ev:C=>ownCrack(C,false)},
+  {owner:"MassDOT", id:"int", kind:"advisory", sec:"3.10.11.1 (p. 3-91); 2.3.5.1 (p. 2-14)", text:"Integral abutments to be considered where feasible; simplified method: total length 140 ft steel / 200 ft concrete, skew 30°, height 15 ft deck to bottom of cap",
+    ev:C=>ownIntegral(C,{sk:30,Ls:140,Lc:200,more:"height ≤ 15 ft, U-wingwalls, not scour susceptible"})},
+  {owner:"MassDOT", id:"LSslab", kind:"note", sec:"3.3.1.3 (p. 3-18)", text:"With the MassDOT standard approach slab, the live-load surcharge on the abutment may be ignored",
+    ev:C=>({st:"note", val:`LS in use: h<sub>eq</sub> = ${fmt(C.R.LS.heq,2)} ft (panel I-3)`, lim:"may be 0 with an approach slab", link:OWN_LK.ls})},
+  {owner:"MassDOT", id:"settle", kind:"note", sec:"3.2.1, 3.2.9 (pp. 3-8, 3-16)", text:"Settlement per the geotechnical report (Part I gives no numeric limit); not computed by this tool",
+    ev:C=>({st:"note", val:"not computed", lim:"geotechnical report", link:OWN_LK.svc})},
+  /* ---------------- RIDOT Bridge Design Manual (April 2026) ---------------- */
+  {owner:"RIDOT", id:"bw.min", kind:"shall-check", sec:"11.3.4 (p. 11-9)", text:"Minimum wall thickness at the top 15 in (applied to the backwall, the top of the abutment wall)",
+    ev:C=>Object.assign(ownMinT(+C.g.tbw,1.25,"t<sub>bw</sub>"),{lim:"≥ 15 in (1.25 ft)"})},
+  {owner:"RIDOT", id:"seat.w", kind:"should-warning", sec:"11.3.4 (p. 11-9)", text:"Beam seat width preferably at least 2'-6\" (and enough for the bearings and the AASHTO seismic support length)",
+    ev:C=>({st:ownGE(C.seatW,2.5)?"pass":"warn", val:`t<sub>st</sub> − t<sub>bw</sub> = ${fmt(C.seatW,2)} ft`, lim:"≥ 2.50 ft (preferred)", tex:`b_{seat} = t_{st}-t_{bw} = ${ownF(C.g.tst)}-${ownF(C.g.tbw)} = ${ownF(C.seatW)}\\ \\text{ft}`, link:OWN_LK.supp})},
+  {owner:"RIDOT", id:"pad.edge", kind:"shall-check", sec:"11.3.4 (p. 11-9)", text:"Bearing pad or masonry plate at least 2 in from the face of the beam seat",
+    ev:C=>({st:ownGE(C.cFront,2)?"pass":"fail", val:`${fmt(C.cFront,1)} in`, lim:"≥ 2 in", tex:`c_{front} = (b_{seat}-a_{brg})\\cdot12-L_{pad}/2 = (${ownF(C.seatW)}-${ownF(C.g.brgSetback)})(12)-${ownF(+S.bearing.padL,1)}/2 = ${ownF(C.cFront,1)}\\ \\text{in}`, link:OWN_LK.seat})},
+  {owner:"RIDOT", id:"gap", kind:"shall-check", sec:"11.3.4 (p. 11-9)", text:"Girder end (or diaphragm) to backwall at least the predicted superstructure movement plus 2 in",
+    ev:C=>{ const Lg=S.longit, need=C.dExp+2; return {st:ownGE(+C.g.endGap,need)?"pass":"fail", val:`g<sub>end</sub> = ${fmt(+C.g.endGap,2)} in (panel I-1)`, lim:`≥ Δ + 2 = ${fmt(need,2)} in`,
+      tex:`\\Delta = \\alpha\\,\\Delta T_{rise}\\,L_{exp} = (${ownF(+Lg.cte*1e6,2)}\\times10^{-6})(${ownF(+Lg.dTrise,0)})(${ownF(+Lg.Lexp)}\\cdot12) = ${ownF(C.dExp,3)}\\ \\text{in};\\quad \\Delta+2 = ${ownF(need,3)}\\ \\text{in}`, link:OWN_LK.tu}; }},
+  {owner:"RIDOT", id:"ftg.t", kind:"shall-check", sec:"10.4.1 (p. 10-5); 10.5.1.2 (p. 10-6)", text:"Footing thickness at least 2 ft (spread footing) or 2'-6\" (pile-supported footing)",
+    ev:C=>ownMinT(+C.g.tf,C.pile?2.5:2.0,"t<sub>f</sub>")},
+  {owner:"RIDOT", id:"frost", kind:"shall-check", sec:"10.4.1 (p. 10-5)", text:"Spread footing embedment below finished grade at least the greatest of the geotechnical depth, the depth below computed scour and 4 ft (frost)",
+    ev:C=>C.pile?{st:"na",val:"pile-supported footing (10.4.1 covers spread footings)",lim:"—"}:{st:ownGE(C.Df,4)?"pass":"fail", val:`D<sub>f</sub> = ${fmt(C.Df,2)} ft (panel ${(S.fnd.branch==="spread"&&S.fnd.usePassive)?"I-4":"I-0"})`, lim:"≥ 4 ft; also below scour and the geotechnical depth", link:OWN_LK.sketch}},
+  {owner:"RIDOT", id:"pile.sp", kind:"shall-check", sec:"10.5.1.2 (p. 10-6)", text:"Pile spacing at least the greater of 30 in and 2.5 pile diameters + 6 in; not more than 10 ft center to center",
+    ev:C=>ownPileSp(C,Math.max(30,2.5*C.D+6),10,`\\max(30,\\ 2.5(${ownF(C.D,1)})+6)`)},
+  {owner:"RIDOT", id:"pile.edge", kind:"shall-check", sec:"10.5.1.2 (p. 10-7)", text:"Nearest footing edge to the face of any pile at least 1'-3\"",
+    ev:C=>ownPileEdge(C,15,"face")},
+  {owner:"RIDOT", id:"pile.emb", kind:"shall-check", sec:"10.5.1.2 (p. 10-6)", text:"Piles extend at least 12 in into the footing, positively anchored",
+    ev:C=>ownPileEmb(C,12)},
+  {owner:"RIDOT", id:"crack", kind:"advisory", sec:"5.4.1 (p. 5-5)", text:"Crack control: Class 2 exposure for all reinforced concrete members",
+    ev:C=>ownCrack(C,true)},
+  {owner:"RIDOT", id:"st", kind:"advisory", sec:"5.7.1 (p. 5-9); 5.4.1 (p. 5-5)", text:"Shrinkage and temperature steel, and skin steel where required, not less than #4 bars at 12 in (0.20 in²/ft)",
+    ev:C=>{ const L=[["bwFlex","backwall"],["stemFlex","stem"],["toeFlex","toe"],["heelFlex","heel"]].map(([k,n])=>{ const c=C.R.checks[k]; return c?`${n} ${fmt(Math.max(c.AsST,0.20),3)}`:""; }).filter(Boolean);
+      return {st:"adv", val:"provide A<sub>s</sub> ≥ max(A<sub>s,ST</sub>, 0.20) in²/ft: "+L.join(", "), lim:"#4 @ 12 in minimum", link:OWN_LK.rebar}; }},
+  {owner:"RIDOT", id:"galv", kind:"note", sec:"5.2.2 (p. 5-2)", text:"All reinforcement galvanized (A615 Gr 60): development length with λcf = 1.0, as used",
+    ev:C=>({st:"note", val:"λ<sub>cf</sub> = 1.0 in use", lim:"galvanized bars", link:OWN_LK.bw})},
+  {owner:"RIDOT", id:"passive", kind:"shall-check", sec:"10.4.3, 10.4.4 (p. 10-5)", text:"Passive resistance in front of the footing excluded for every strength failure mode; it may be included at the extreme event limit states",
+    ev:C=>({st:(S.fnd.branch==="spread"&&S.fnd.usePassive)?"fail":"pass", val:(S.fnd.branch==="spread"&&S.fnd.usePassive)?"passive included in every limit state (panel I-4)":"passive not used", lim:"strength: none; extreme event: allowed", link:OWN_LK.slide})},
+  {owner:"RIDOT", id:"atrest", kind:"advisory", sec:"11.3.4 (p. 11-9)", text:"At-rest earth pressure where outward tilting of the wall is restricted so that active pressure cannot develop",
+    ev:C=>({st:"adv", val:`active K<sub>a</sub> = ${fmt(C.R.ka,4)} used (panel I-3)`, lim:"at-rest where the wall cannot tilt", link:OWN_LK.eh})},
+  {owner:"RIDOT", id:"skew", kind:"should-warning", sec:"2.4.2.3 (p. 2-9)", text:"Skew minimized; consider lengthening the span where the skew exceeds 40°",
+    ev:C=>ownSkew(C,40)},
+  {owner:"RIDOT", id:"type", kind:"should-warning", sec:"11.3.1 (p. 11-3)", text:"Height up to 12 ft: gravity or semi-gravity considered; 12–30 ft: cantilever; over 30 ft: counterfort considered",
+    ev:C=>({st:(C.hTot>12+1e-9&&C.hTot<=30+1e-9)?"pass":"warn", val:`h = t<sub>f</sub> + h<sub>stem</sub> + h<sub>bw</sub> = ${fmt(C.hTot,2)} ft`, lim:"12 to 30 ft for a cantilever", link:OWN_LK.sketch})},
+  {owner:"RIDOT", id:"int", kind:"advisory", sec:"11.3.1, 11.3.2 (pp. 11-3, 11-4)", text:"Integral or semi-integral abutments preferred and considered in every type study; integral: skew 30°, total length 150 ft steel / 200 ft concrete",
+    ev:C=>ownIntegral(C,{sk:30,Ls:150,Lc:200,more:"deck to bottom of cap ≤ 13 ft, girder depth ≤ 6 ft, grade ≤ 5 %"})},
+  {owner:"RIDOT", id:"semi", kind:"advisory", sec:"11.3.3 (p. 11-8)", text:"Semi-integral abutments: skew 30°, expansion length 175 ft steel / 300 ft concrete; backwall designed for full passive pressure",
+    ev:C=>{ const s=+C.g.skew||0, Le=+S.longit.Lexp||0, Lm=C.mat==="concrete"?300:175, ok=ownLE(s,30)&&ownLE(Le,Lm);
+      return {st:"adv", val:`skew ${fmt(s,1)}°, expansion length ${fmt(Le,1)} ft (panel I-6b) → <b>${ok?"within":"outside"}</b> the limits`, lim:`skew ≤ 30°, L<sub>exp</sub> ≤ ${Lm} ft`, link:OWN_LK.supp}; }},
+  {owner:"RIDOT", id:"settle", kind:"note", sec:"10.3.1 (p. 10-4)", text:"Post-construction settlement at most 1 in total and 0.5 in differential between adjacent units (unless approved)",
+    ev:C=>({st:"note", val:"not computed (geotechnical)", lim:"≤ 1 in total; ≤ 0.5 in differential", link:OWN_LK.svc})},
+  {owner:"RIDOT", id:"drain", kind:"note", sec:"11.3.8 (p. 11-10)", text:"Embankment behind abutments positively drained (weep holes and/or underdrain)",
+    ev:C=>({st:"note", val:"free-draining backfill assumed (Assumption 1)", lim:"drainage system", link:OWN_LK.basis})},
+  /* ---------------- CTDOT BRSDM, Release 1 (2024) ---------------- */
+  {owner:"CTDOT", id:"brg.front", kind:"shall-check", sec:"V2 11.6.8.1CT (p. 11-3)", text:"At the seat, front face of the stem to the centerline of bearings at least 1.25 ft (9 in for butted deck units and box beams, V2 11.6.8.2CT)",
+    ev:C=>({st:ownGE(C.brgFront,1.25)?"pass":"fail", val:`${fmt(C.brgFront,2)} ft`, lim:"≥ 1.25 ft (girders)", tex:`a = b_{seat}-a_{brg} = (t_{st}-t_{bw})-a_{brg} = ${ownF(C.seatW)}-${ownF(C.g.brgSetback)} = ${ownF(C.brgFront)}\\ \\text{ft}`, link:OWN_LK.sketch})},
+  {owner:"CTDOT", id:"bw.min", kind:"shall-check", sec:"V2 11.6.8.1CT (p. 11-3)", text:"Backwall thickness at least 1.25 ft",
+    ev:C=>ownMinT(+C.g.tbw,1.25,"t<sub>bw</sub>")},
+  {owner:"CTDOT", id:"frost", kind:"shall-check", sec:"V2 10.6.1.2, 10.7.1.2 (p. 10-3)", text:"Bottom of footing or pile cap at least 4 ft below finished grade (measured normal to grade); no minimum on competent rock",
+    ev:C=>C.rock?{st:"na",val:"spread footing on rock",lim:"no minimum on competent rock"}:{st:ownGE(C.Df,4)?"pass":"fail", val:`D<sub>f</sub> = ${fmt(C.Df,2)} ft (panel ${(S.fnd.branch==="spread"&&S.fnd.usePassive)?"I-4":"I-0"})`, lim:"≥ 4 ft", link:OWN_LK.sketch}},
+  {owner:"CTDOT", id:"tof", kind:"should-warning", sec:"V2 10.6.1.2, 10.7.1.2 (p. 10-3)", text:"Top of footing at least 12 in below finished grade",
+    ev:C=>C.rock?{st:"na",val:"spread footing on rock",lim:"—"}:{st:ownGE(C.Df-C.g.tf,1)?"pass":"warn", val:`D<sub>f</sub> − t<sub>f</sub> = ${fmt(C.Df-C.g.tf,2)} ft`, lim:"≥ 1.00 ft", tex:`D_f-t_f = ${ownF(C.Df)}-${ownF(+C.g.tf)} = ${ownF(C.Df-C.g.tf)}\\ \\text{ft}`, link:OWN_LK.sketch}},
+  {owner:"CTDOT", id:"passive", kind:"shall-check", sec:"V2 10.6.3.4 (p. 10-3)", text:"No footing keys for passive resistance and no passive pressure on the sides; sliding resisted by base friction only",
+    ev:C=>({st:(S.fnd.branch==="spread"&&S.fnd.usePassive)?"fail":"pass", val:(S.fnd.branch==="spread"&&S.fnd.usePassive)?"passive included (panel I-4)":"base friction only", lim:"friction only", link:OWN_LK.slide})},
+  {owner:"CTDOT", id:"ls2", kind:"shall-check", sec:"V2 3.11.6.4 (p. 3-7)", text:"Permanent earth-retaining structures designed for a live-load surcharge of at least 2 ft of soil",
+    ev:C=>{ const R=C.R, h=[R.LS.heq,R.bwDem?R.bwDem.heqBW:Infinity,R.stemDem?R.stemDem.heqS:Infinity], m=Math.min(...h);
+      return {st:ownGE(m,2)?"pass":"fail", val:`h<sub>eq</sub> used: wall ${fmt(R.LS.heq,2)}, stem ${fmt(h[2],2)}, backwall ${fmt(h[1],2)} ft`, lim:"≥ 2.00 ft", link:OWN_LK.ls}; }},
+  {owner:"CTDOT", id:"fc", kind:"shall-check", sec:"V2 5.4.2.1 (p. 5-1)", text:"Cast-in-place footings, abutments and walls: f′c at least 3.0 ksi",
+    ev:C=>({st:ownGE(C.fc,3)?"pass":"fail", val:`f′c = ${fmt(C.fc,2)} ksi (panel I-2)`, lim:"≥ 3.0 ksi", link:OWN_LK.stem})},
+  {owner:"CTDOT", id:"bars", kind:"shall-check", sec:"V2 5.10 (p. 5-5)", text:"Bars carrying tension or compression at least #5 at no more than 12 in; no bar smaller than #4",
+    ev:C=>{ const bad=C.bars.filter(([,,b])=>+b.size<5||+b.sp>12+1e-9).map(([,n,b])=>`${n} #${b.size} @ ${fmt(+b.sp,1)} in`); const seatBad=+S.bearing.seatBar<4;
+      return {st:(bad.length||seatBad)?"fail":"pass", val:C.bars.map(([,n,b])=>`${n} #${b.size} @ ${fmt(+b.sp,1)}`).join(", ")+`; seat mat #${S.bearing.seatBar}`, lim:"main ≥ #5 @ ≤ 12 in; all ≥ #4", link:OWN_LK.rebar}; }},
+  {owner:"CTDOT", id:"spinc", kind:"should-warning", sec:"V2 5.10.3 (p. 5-5)", text:"Bar spacing in whole-inch increments",
+    ev:C=>{ const all=C.bars.map(([,n,b])=>[n,+b.sp]).concat([["seat mat",+S.bearing.seatSp]]), bad=all.filter(([,s])=>Math.abs(s-Math.round(s))>1e-9);
+      return {st:bad.length?"warn":"pass", val:bad.length?bad.map(([n,s])=>`${n} ${fmt(s,2)} in`).join(", "):"all whole inches", lim:"whole inches", link:OWN_LK.rebar}; }},
+  {owner:"CTDOT", id:"crack", kind:"advisory", sec:"V2 5.6.7", text:"Crack control based on Class 2 exposure",
+    ev:C=>ownCrack(C,true)},
+  {owner:"CTDOT", id:"pile.rows", kind:"shall-check", sec:"V2 10.7.1.2 (p. 10-3)", text:"Pile foundations of abutments have at least two rows of piles (unless fully integral)",
+    ev:C=>C.pile?{st:C.rows>=2?"pass":"fail", val:`${C.rows} row${C.rows===1?"":"s"} of active piles`, lim:"≥ 2 rows", link:OWN_LK.pile}:{st:"na",val:"spread footing",lim:"—"}},
+  {owner:"CTDOT", id:"pile.emb", kind:"shall-check", sec:"V2 10.7.1.2 (p. 10-3)", text:"Piles anchored to and embedded in the footing at least 12 in",
+    ev:C=>ownPileEmb(C,12)},
+  {owner:"CTDOT", id:"pile.sp", kind:"should-warning", sec:"AASHTO LRFD 10.7.1.2 (BRSDM V2 10.7.1.2 adds to it)", text:"Pile spacing not less than 30 in or 2.5 pile diameters (the BRSDM sets no other spacing)",
+    ev:C=>{ const r=ownPileSp(C,Math.max(30,2.5*C.D),Infinity,`\\max(30,\\ 2.5(${ownF(C.D,1)}))`); if(r.st==="fail") r.st="warn"; r.lim=`≥ ${fmt(Math.max(30,2.5*C.D),1)} in`; if(r.tex) r.tex=r.tex.replace(/;\\quad s_\{max\}.*$/,""); return r; }},
+  {owner:"CTDOT", id:"pile.edge", kind:"shall-check", sec:"AASHTO LRFD 10.7.1.2 (BRSDM V2 10.7.1.2 adds to it)", text:"Side of any pile to the nearest edge of the cap at least 9 in",
+    ev:C=>ownPileEdge(C,9,"side")},
+  {owner:"CTDOT", id:"int", kind:"advisory", sec:"V2 App. CT11.1.1.1 (p. 11-10)", text:"Fully integral abutments preferred where the limits are met: skew less than 30°, total length 150 ft steel / 200 ft concrete, single span 150 ft, height 12 ft grade to bottom of stem/cap",
+    ev:C=>ownIntegral(C,{sk:30,strict:true,Ls:150,Lc:200,Lsp:150,more:"height ≤ 12 ft, U-wingwalls 5–10 ft"})},
+  {owner:"CTDOT", id:"ee3", kind:"note", sec:"V2 Table 3.4.1-1 (p. 3-2)", text:"Extreme Event III (scour check flood): permanent loads, live load, water and friction at 1.00 with the scoured foundation; not modelled here, check by hand where scour applies",
+    ev:C=>({st:S.fnd.scour?"warn":"note", val:S.fnd.scour?"scour condition ON: Extreme Event III not checked":"scour condition off", lim:"hand check", link:OWN_LK.slide})},
+  {owner:"CTDOT", id:"settle", kind:"note", sec:"V2 Section 10", text:"Settlement per the geotechnical report (the BRSDM gives no numeric abutment limit); not computed by this tool",
+    ev:C=>({st:"note", val:"not computed", lim:"geotechnical report", link:OWN_LK.svc})}
+];
+/* evaluates the current owner's rules; R.own = {owner, meta, rows:[{r, st, val, lim, tex, link}], nFail, nWarn} */
+function abutOwnChecks(R){
+  const o=abutOwner(), meta=ABUT_OWN.owners[o];
+  if(o==="AASHTO") return {owner:o, meta, rows:[], nFail:0, nWarn:0};
+  const C=abutOwnCtx(R), rows=[];
+  ABUT_OWN.rules.filter(r=>r.owner===o).forEach(r=>{ let v; try{ v=r.ev(C)||{}; }catch(e){ v={st:"warn",val:"not evaluated ("+esc(e.message)+")",lim:"—"}; } rows.push(Object.assign({r},v)); });
+  return {owner:o, meta, rows, nFail:rows.filter(x=>x.st==="fail").length, nWarn:rows.filter(x=>x.st==="warn").length};
+}
@@ -800 +1010 @@ const ABUT_IN_SEC={
-  'in-geom':'geom','in-mat':'geom',
+  'in-own':'geom','in-geom':'geom','in-mat':'geom',
@@ -970,0 +1181,6 @@ function migrate(){
+  // OWNA (2026-10-20): owner field. A project saved before it opens as "AASHTO" (no owner rule; identical results). The I-6
+  // "Floating (MassDOT default)" restraint model is this tool's general default (every project has it), so it does not mark a
+  // project as MassDOT. An unknown value reads as "AASHTO".
+  if(!S.own||typeof S.own!=="object") S.own={owner:"AASHTO",Ltot:0};
+  if(!ABUT_OWN_LIST.includes(S.own.owner)) S.own.owner="AASHTO";
+  if(!(+S.own.Ltot>=0)) S.own.Ltot=0;
@@ -1062,0 +1279,9 @@ function buildInputs(){
+  /* ---- I-0 Owner (OWNA) ---- */
+  { const oo=abutOwner(), om=ABUT_OWN.owners[oo], dfHere=oo!=="AASHTO"&&!(S.fnd.branch==="spread"&&S.fnd.usePassive);
+    html+=panel("in-own","I-0","Owner (State DOT Rules)",`
+    ${selRow("Bridge owner","own.owner",[["AASHTO","AASHTO LRFD only (no owner rules)"],["MassDOT","MassDOT — LRFD Bridge Manual, Part I"],["RIDOT","RIDOT — Bridge Design Manual (2026)"],["CTDOT","CTDOT — BRSDM, Release 1 (2024)"]],{rebuild:true})}
+    <div class="in-note">${oo==="AASHTO"?"Calculation and checks per AASHTO LRFD 10th Ed. (2024). Choose an owner to check its requirements (listed in Tab 1 §1.0a); no computed result changes.":esc(om.manual)+", written to AASHTO LRFD "+esc(om.aashto)+"; the calculation follows AASHTO LRFD 10th Ed. (2024). The owner's requirements are checked in Tab 1 §1.0a (pass / fail / advisory); no computed result changes."}</div>
+    ${oo!=="AASHTO"?inpRow("Total bridge length (integral screening; 0 = span L)","own.Ltot","ft",{title:"Used only for the owner's integral / semi-integral abutment screening (Tab 1 §1.0a). 0 uses the span length of panel I-1."}):""}
+    ${dfHere?inpRow("Bottom of footing below finished grade D<sub>f</sub>","fnd.Df","ft",{title:"Embedment for the owner's frost / minimum-depth rule (Tab 1 §1.0a). Same input as the passive embedment of panel I-4 (shown there when passive resistance is on)."}):""}
+  `); }
+
@@ -2739 +2964 @@ function computeAll(){
-    const s=JSON.stringify(Object.assign({},S,{ui:undefined}));
+    const s=JSON.stringify(Object.assign({},S,{ui:undefined, own:abutOwner()==="AASHTO"?undefined:S.own}));   // OWNA: owner AASHTO leaves the Input ID unchanged
@@ -2789,0 +3015,4 @@ function computeAll(){
+  /* ===== C-22 Owner requirements (OWNA): checked after every result is final; they change no result ===== */
+  R.own=abutOwnChecks(R);
+  if(R.own.nFail) warn(`Owner requirements (${ABUT_OWN.owners[R.own.owner].short}): ${R.own.nFail} not met — ${R.own.rows.filter(x=>x.st==="fail").map(x=>x.r.sec).join("; ")} (Tab 1 §1.0a).`,"err");
+  if(R.own.nWarn) warn(`Owner requirements (${ABUT_OWN.owners[R.own.owner].short}): ${R.own.nWarn} to check — ${R.own.rows.filter(x=>x.st==="warn").map(x=>x.r.sec).join("; ")} (Tab 1 §1.0a).`);
@@ -2867,0 +3097 @@ function renderDashboard(R){
+  const O=R.own, ownChip=(O&&O.owner!=="AASHTO")? `<span class="flagchip ${O.nFail?"fail":O.nWarn?"warn":"pass"} xlink" data-jump="tab-loads|o-owner" style="margin-right:8px;text-decoration:none;" title="Owner requirements — Tab 1 §1.0a">${esc(O.owner)}: ${O.nFail?O.nFail+" NOT MET":O.nWarn?O.nWarn+" TO CHECK":"MET"}</span>`:"";
@@ -2869 +3099 @@ function renderDashboard(R){
-  el.innerHTML=`<h2>Summary Dashboard — All Code Checks <span style="float:right;font-size:0.75rem;color:#777;font-weight:normal;">${stChip}Input ID: ${R.fingerprint||"—"}</span></h2>
+  el.innerHTML=`<h2>Summary Dashboard — All Code Checks <span style="float:right;font-size:0.75rem;color:#777;font-weight:normal;">${ownChip}${stChip}Input ID: ${R.fingerprint||"—"}</span></h2>
@@ -2906,0 +3137,15 @@ function activateTab(id){
+/* ---- Owner requirements card (OWNA): each owner rule, its section, the value checked (worked) and the result ---- */
+const OWN_ST={pass:["pass","PASS"],fail:["fail","FAIL"],warn:["warn","CHECK"],adv:["","ADVISORY"],note:["","NOTE"],pend:["","PENDING"],na:["","N/A"]};
+const OWN_KIND={"shall-check":"Shall","should-warning":"Should","advisory":"Advisory","note":"Note","pending-reference":"Pending reference"};
+function ownerPanelHTML(R){
+  const O=R.own||{owner:"AASHTO",rows:[]}, m=ABUT_OWN.owners[O.owner]||ABUT_OWN.owners.AASHTO;
+  if(O.owner==="AASHTO") return panel("o-owner","1.0a","Owner Requirements — AASHTO LRFD only",`<div class="note-box">Owner: <b>AASHTO LRFD 10th Ed. (2024)</b>, no owner rules. Choose MassDOT, RIDOT or CTDOT in panel I-0 to check that owner's requirements here. ${esc(ABUT_OWN.note)}</div>`);
+  const chip=x=>{ const c=OWN_ST[x]||["",x]; return `<span class="flagchip ${c[0]}"${c[0]?"":' style="color:#2e5077;border-color:#9fb6d3;background:#eef4fb"'}>${c[1]}</span>`; };
+  let t=`<table class="rtbl"><tr><th>Section</th><th style="width:30%">Requirement (paraphrased)</th><th>Kind</th><th style="width:28%">Value checked</th><th>Required</th><th>Result</th><th>Worked in</th></tr>`;
+  O.rows.forEach(x=>{ t+=`<tr${x.st==="fail"?' class="failrow"':''}><td class="lft">${esc(x.r.sec)}</td><td class="lft">${esc(x.r.text)}${x.r.kind==="pending-reference"&&x.r.ref?`<br><i>Needs: ${esc(x.r.ref)}</i>`:""}</td><td>${OWN_KIND[x.r.kind]||esc(x.r.kind)}</td>
+    <td class="lft">${x.val||"—"}${x.tex?`<br><span class="ktx" data-tex="${esc(x.tex)}">${esc(x.tex)}</span>`:""}</td><td class="lft">${x.lim||"—"}</td><td>${chip(x.st)}</td><td>${x.link?abutWorkedIn([x.link]):"—"}</td></tr>`; });
+  t+="</table>";
+  const head=O.nFail?`<span class="flagchip fail" style="margin-left:8px;">${O.nFail} NOT MET</span>`:(O.nWarn?`<span class="flagchip warn" style="margin-left:8px;">${O.nWarn} TO CHECK</span>`:`<span class="flagchip pass" style="margin-left:8px;">MET</span>`);
+  return panel("o-owner","1.0a","Owner Requirements — "+esc(m.short)+head,`<div class="note-box">Owner: <b>${esc(m.manual)}</b>, written to AASHTO LRFD ${esc(m.aashto)}; the calculation follows AASHTO LRFD 10th Ed. (2024) with these owner rules checked on top. Requirements are paraphrased; the section and page cite the owner manual. Shall = pass/fail; Should = a warning; Advisory = the owner value beside the value in use (no result changes in this version); Pending reference = the owner document that sets it is not available. Values are worked in the row or in the linked panel.</div>${t}`);
+}
+
@@ -2929,0 +3175 @@ function renderTabLoads(R){
+  h+=ownerPanelHTML(R);
@@ -5063 +5309 @@ function inputEchoHTML(){
-  let h="<h3>Geometry</h3>"+echoRows([
+  let h=(abutOwner()!=="AASHTO"?"<h3>Owner</h3>"+echoRows([["Bridge owner (requirements checked in Tab 1 §1.0a)",ABUT_OWN.owners[abutOwner()].manual,""],["Total bridge length for the integral screening",+S.own.Ltot>0?fmt(+S.own.Ltot):"= span L","ft"],["Bottom of footing below finished grade D_f",fmt(+S.fnd.Df),"ft"]]):"")+"<h3>Geometry</h3>"+echoRows([
@@ -5153 +5399 @@ const ABUT_REFS=[
-  ["MassDOT","MassDOT LRFD Bridge Manual, Part I — §3.1.8.3 (floating-bridge longitudinal distribution; seismic connection); edition: verify"],
+  ["MassDOT","MassDOT LRFD Bridge Manual, Part I (Hundredth Anniversary Ed.; written to AASHTO LRFD 9th Ed., 3.1.1.1) — §3.1.8.3 (floating-bridge longitudinal distribution)"],
@@ -5154,0 +5401,4 @@ const ABUT_REFS=[
+/* references in the report: the owner manual is added when an owner is chosen (OWNA) */
+function abutRefsNow(){ const o=abutOwner(); if(o==="AASHTO") return ABUT_REFS; const m=ABUT_OWN.owners[o];
+  const row=[o,m.manual+" (written to AASHTO LRFD "+m.aashto+") — owner requirements checked in Tab 1 §1.0a, sections cited there"];
+  return o==="MassDOT"? ABUT_REFS.map(r=>r[0]==="MassDOT"?[r[0],r[1]+"; "+row[1]]:r) : ABUT_REFS.slice(0,-1).concat([row,ABUT_REFS[ABUT_REFS.length-1]]); }
@@ -5315 +5565 @@ async function buildReport(){
-        <p class="cr-cover-p">AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024) · MassDOT LRFD Bridge Manual</p>
+        <p class="cr-cover-p">AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024) · ${abutOwner()==="AASHTO"?"MassDOT LRFD Bridge Manual":esc(ABUT_OWN.owners[abutOwner()].manual)+" (owner; written to AASHTO LRFD "+esc(ABUT_OWN.owners[abutOwner()].aashto)+")"}</p>
@@ -5336 +5586 @@ async function buildReport(){
-      <table class="cr-refs">${ABUT_REFS.map(([a,b])=>`<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</table>
+      <table class="cr-refs">${abutRefsNow().map(([a,b])=>`<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</table>
```

## 2026-10-20 — PR: claude/abut-owner-b (stacked on claude/abut-owner-a) — owner defaults and owner load rules that change results (PR link added after merge)

Results under the AASHTO owner are unchanged: identical to origin/main for every tested project (see "How verified"). Under MassDOT, RIDOT and CTDOT the items below change results. Page numbers are the owner manuals'; rules are paraphrased.

### F50. Owner defaults (kind "default") and their application   [input defaults] [changes results only for an owner other than AASHTO]
- **What:** `ABUT_OWN_DEF` lists, per owner, an owner value for an input. On an owner change (I-0) or a superstructure-material change, `ownReapply(pre)` sets each input that still holds its previous default (tool default or previous owner value) to the new one. A value the user entered is kept and flagged "Overrides <manual> <section>". Inputs holding an owner value are highlighted with an "Owner · <manual> <section>" line (the GirderDetail → ST-Girder style). The owner card (Tab 1 §1.0a) lists every default with the value in use and the last change. "Apply preset" in I-6b uses the owner temperature values when the owner sets them.
- **Values (verified on the manual page):**
  - **MassDOT Part I:**
    - f′c 5.0 ksi (4.2.2.3, General Notes, p. 4-5);
    - earth pressure state "MassDOT 3.1.6 rule" (3.1.6, p. 3-4);
    - temperature rise/fall and α (3.1.8.2, p. 3-7): steel 70 / 100 °F with 6.5×10⁻⁶; concrete 30 / 70 °F with 5.5×10⁻⁶;
    - G 0.184 ksi (3.5.7.4, p. 3-57). The manual specifies 0.160 ksi and requires the least favourable value of ±15 %; the upper bound gives the larger force on the abutment;
    - backwall bars coated (3.3.1.6, p. 3-18);
    - Extreme Event I off (3.4.4.3, p. 3-35, SDC A).
  - **RIDOT BDM:**
    - design load multiplier m 1.2 (3.4.1.2, p. 3-7);
    - γEQ on live load 0.5 (3.2.1.3, p. 3-2);
    - temperature rise and fall each 0.65 × the Procedure B range (3.7.1, p. 3-14): steel 0.65·115 = 74.75 °F, concrete 0.65·100 = 65 °F;
    - γe Class 2 (5.4.1, p. 5-5);
    - construction surcharge q_c 0.60 ksf (3.2.2, p. 3-3).
  - **CTDOT BRSDM:**
    - φ 35° (V2 3.11.1, p. 3-7);
    - γ 0.125 kcf (V2 3.5.1, p. 3-3);
    - γEQ on live load 0.5 (V2 3.4.1, p. 3-2);
    - rise/fall 60 / 60 °F (V2 3.12.2.1, p. 3-8);
    - α 6.4×10⁻⁶ (V2 3.12.2.3, p. 3-8);
    - γe Class 2 (V2 5.6.7).
- **Where:** after `abutOwnChecks()`: `ABUT_OWN_DEF`, `ownDefMap`, `ownReapply`, `ownTagHTML`, `ownTagRefresh`, `abutOwnLoad`. `inpRow` / `selRow` (anchor `// OWNB: owner default highlight`), the change handler (anchor `const ownPre=`), `recalcAll` (`ownTagRefresh()`), and the thermal preset (anchor `// OWNB: the owner's temperature values`).

### F51. Earth pressure state: at-rest K0, 0.5(K0 + Ka), MassDOT 3.1.6 rule   [calc change] [MORE conservative where at-rest applies]
- **Before:** k = Ka (Rankine or Coulomb) always.
- **After:** new input `soil.Kmode`:
  - "active" (default, unchanged);
  - "atrest": K = K0 = 1 − sin φ, horizontal (ι = 0) [AASHTO LRFD 10th Ed. 3.11.5.2, Eq. 3.11.5.2-1];
  - "blend": K_h = ½(K0 + Ka cos ι), K_v = ½ Ka sin ι;
  - "massdot": at-rest on piles or rock, blend on soil with H ≤ 5 ft, active otherwise [MassDOT Part I 3.1.6].
  K replaces ka for EH, LS, ES and the construction stage. At-rest uses γEH max = `factors.gpEHmaxR` (new, 1.35) [T.3.4.1-2]; the blend keeps the active 1.50. Under Extreme Event I the M–O increment is taken over the active resultant and added to the K static pressure. A warning is shown for at-rest with β > 0.
- **Where:** `computeAll`, anchor `// OWNB: earth pressure state`; `PaSumA` / `kahLoc` in the M–O block; `GP.EH`. Display: Tab 1 §1.3 "Earth pressure state" block (K0 worked), symbol K in §1.3 / §1.4, basis item 1.
- **Check (pile footing, MassDOT rule → K0, H = 22 ft, γ = 0.120 kcf, φ = 32°, L_ab = 44 ft):**
  - K0 = 1 − sin 32° = 0.4701 (Ka = 0.3073);
  - EH_h = ½·0.4701·0.120·22²·44 = **600.65 kip** (before 392.60), with γEH max 1.35;
  - stem M_u 112.06 → **148.85** kip-ft/ft;
  - maximum pile reaction 212.71 → **247.36** kip (D/C 0.921 → **1.071**).
  - Tool: same values.

### F52. Load modifier η (RIDOT 1.3.1–1.3.3)   [calc change] [MORE conservative for ADT ≥ 5000]
- **Before:** η = 1 (none).
- **After:** RIDOT owner with ADT ≥ 5000 (new input `own.ADT`, panel I-0): η = 1.05. Every Strength I, III, V and construction-stage factor at its maximum is multiplied by η, and γp minimum is multiplied by 1/η [AASHTO LRFD 10th Ed. 1.3.2.1, Eqs. 1.3.2.1-2, -3]. Service I and Extreme Event I are unchanged. ADT blank: η = 1.00 and an owner "check" row.
- **Where:** `abutOwnLoad`; `LIMITS` (anchor `// OWNB: owner load rules`); `GP`; toe self-weight `0.9*etaMin`; backwall γLL `LIMITS["Strength I"].LL`; bearing seat (`L1`, `L5`). Worked: Tab 2 §2.0a.
- **Check (default project, RIDOT, ADT 6000):**
  - ηγDC = 1.05·1.25 = 1.3125; γDC,min/η = 0.90/1.05 = 0.8571;
  - seat P_u = 1.05(1.25·85 + 1.50·12) + 1.05·1.75·1.2·70 = 130.46 + 154.35 = **284.81 kip** (m included). Tool 284.81.

### F53. Design load multiplier m on the LL+IM reaction and BR (RIDOT 3.4.1.2)   [calc change] [MORE conservative]
- **Before:** LL and BR at γLL.
- **After:** γLL·m on the girder LL+IM reaction and on BR at Strength I, III, V and Service I (input `own.mLL`, RIDOT default 1.2). Not applied to LS, Extreme Event I or the construction stage. Where the reaction relieves a check, the existing "LL reaction off" permutations govern, so m drops out there, as the BDM says.
- **Where:** `comboEffects` (anchor `OWNB: m on the LL reaction and BR`), `stemEcc`, stem `HgirdPerFt`, `HgirdSvc`, bearing seat, `buildVM` `fLL` / `fBR`, `vmGamma`, `perBearingLoads`.
- **Check (default project, RIDOT, ADT blank):** seat P_u = 1.25·85 + 1.50·12 + 1.75·1.2·70 = **271.25 kip** (before 246.75); q_b 0.571 → 0.628 ksi. Tool: same.

### F54. Construction surcharge q_c in the construction stage (RIDOT 3.2.2; AASHTO 3.4.2.1)   [calc change] [MORE conservative]
- **Before:** none (only γLL on h_eq).
- **After:** new inputs `constr.qC` (ksf, RIDOT default 0.60) and `constr.gC` (1.50, the AASHTO 3.4.2.1 minimum). Construction stage only, as a live load (on/off):
  - horizontal K·q_c·h_c·cos ι·L_ab at h_c/2;
  - vertical q_c·L_heel·L_ab over the heel, left out for sliding and eccentricity;
  - included in the stem and heel demands of that stage.
- **Where:** groups `CShC` / `CSvC`; `LIMITS["Constr — Str I"].CL`; `comboEffects` class "CL"; stem loop `MCS_ls`; `heelLoads` `gCS`; `buildVM` `fCS`; `constrMaxFill`. Worked: Tab 2 §2.0a and the §5.2 stem line.
- **Check (default project, RIDOT):**
  - P_CS,h = 0.3073·0.600·22.0·1.000·44 = 178.46 kip; × 1.50 = 267.69 kip;
  - construction-stage sliding D = 588.90 + 267.69 = **856.59 kip**, R_R = 510.86 kip;
  - sliding D/C 1.153 → **1.677**. Tool: same.

### F55. Passive resistance at Extreme Event only (RIDOT 10.4.3 / 10.4.4)   [calc change] [MORE conservative when passive is on]
- **Before:** with passive on, φep·Pp entered every limit state.
- **After:** with RIDOT, passive enters sliding only in Extreme Event I.
- **Where:** sliding loop, anchor `// OWNB: RIDOT 10.4.3/10.4.4`; §3.1 display uses `sl.pUsed`.
- **Check:** with passive off (the default) there is no change. With passive on, a strength-governed sliding R_R loses φep·Pp.

### F56. Live-load surcharge h_eq ≥ 2 ft (CTDOT V2 3.11.6.4)   [calc change] [MORE conservative where the table gives < 2 ft]
- **After:** `interpHeq(H) = max(table, 2.0)` for CTDOT.
- **Check:** with the default table (4 / 3 / 2 ft) h_eq is never below 2 ft, so the default project does not change.

### F57. MassDOT heel dead-load case (3.3.2.2)   [new check] [MORE conservative]
- **After:** spread footing, MassDOT. M_DL = (w_soil + γc·t_f + q_ES)·L_heel²/2 (+ slope wedge) ≤ 1.0·M_n, with M_n = A_s·f_y·(d − a/2). This is an additional dashboard row; the AASHTO heel check stays.
- **Check (default project, f′c 5 ksi):**
  - w = 2.28 + 0.45 + 0 = 2.73 ksf;
  - M_DL = 2.73·5²/2 = **34.13 kip-ft/ft**;
  - #8 @ 9: A_s = 1.053 in²/ft; d = 36 − 3 − 0.5 = 32.5 in; a = 1.053·60/(0.85·5·12) = 1.239 in;
  - M_n = 1.053·60·(32.5 − 0.619)/12 = **167.9 kip-ft/ft**;
  - D/C = **0.203** (tool 0.2032, from the unrounded A_s = 0.79·12/9 = 1.0533).

### F58. Coated backwall bars: λcf on ℓd (MassDOT 3.3.1.6; AASHTO 5.10.8.2.1b)   [calc change, bar length only]
- **After:** new input `reinf.coatBW` (MassDOT default on). λcf = 1.5 when the cover is < 3d_b or the clear spacing is < 6d_b, otherwise 1.2; λrl = 1.0 here, so λrl·λcf ≤ 1.7.
- **Check (#6 @ 12 in, cover 2 in < 3·0.75 = 2.25 in → 1.5; f′c 5 ksi):** ℓ_db = 0.17·0.75·(60/(1.97·5^0.25))² = 52.86 in; ℓ_d = 1.5·52.86 = **79.3 in** (before, uncoated and f′c 4: 59.1 in). Tool: 79.3.

### Other results (default project, origin/main → branch, owner applied through I-0)
- **MassDOT, spread:**
  - seat q_R 4.76 → 5.95 ksi (f′c 5; D/C 0.120 → 0.096);
  - heel MassDOT D/C 0.203;
  - K = Ka (H = 22 ft > 5 ft): EH unchanged.
- **MassDOT, TU calculated:** H_TU = 0.184·432·(6.5×10⁻⁶·100·480)/2.0·6 = **74.40 kip** (before 35.74 kip with G 0.130 and 68 °F); eccentricity D/C 0.774 → 0.866.
- **RIDOT, ADT blank:**
  - sliding 1.153 → 1.677 (construction surcharge);
  - eccentricity 0.707 → 1.103 (construction stage);
  - bearing 0.933 → 0.976;
  - stem M_u 112.06 → 114.90;
  - heel M_u 28.46 → 50.74.
- **RIDOT, ADT 6000:** sliding 1.849, bearing 1.030, stem M_u 120.65.
- **CTDOT:**
  - Ka 0.3073 → 0.2710 (φ 35°);
  - EH_h 392.60 → 360.69 kip;
  - sliding 1.153 → 1.040;
  - stem M_u 112.06 → 104.93.

### Saved data (CLAUDE.md §5)
- New optional fields, migrated to the values that reproduce earlier results: `soil.Kmode` "active", `factors.gpEHmaxR` 1.35, `constr.qC` 0, `constr.gC` 1.50, `reinf.coatBW` false, `own.ADT` "", `own.mLL` 1.0, `own.dv` 2. No key or existing format changed.
- A project saved with a non-AASHTO owner before the defaults existed (PR A) gets the owner defaults on the inputs still at the tool default, once (`own.dv`), with a one-time notice.
- The Input ID leaves these new fields out while they hold their defaults.

### How verified
- `node tests/check-syntax.mjs abutment_calculator.html`: pass.
- Headless Chromium, origin/main `e774618` vs branch, `computeAll()`. Under AASHTO every check, demand, pile reaction, permutation table, warning, self-test and Input ID is identical for:
  - default project; old save; pile; EE I γEQ 0.5; rock; TU + BR + ES + construction fill;
  - passive + EE I; Coulomb + slope + water + ES; pile + EE I + TU + γLL construction; single span on rock.
- Owner cases (default and pile) were checked against the hand checks above.
- UI screenshots: I-0, I-3 highlights, Tab 2 §2.0a, Tab 1 §1.3 and §1.0a. The report builds with no console error.

### Open items
- MassDOT 3.1.6 asks for Coulomb Ka. Coulomb is not made a MassDOT default because this tool's Coulomb option applies wall friction δ on the virtual soil plane through the heel (earlier review item N11). The MassDOT row flags Rankine.
- RIDOT "at-rest where restrained" is an advisory with the at-rest option available; it is not automatic.
- CTDOT Extreme Event III is a note only: there are no scour-check-flood inputs.
- CTDOT η_I 1.05 for scour design (V2 2.6.4.4.4CT) is not applied.
- MassDOT 3.3.1.2 toe soil in the bearing pressure is not modelled.

Diff (`abutment_calculator.html`, `git diff -U0` against claude/abut-owner-a `88983f5`):

```diff
diff --git a/abutment_calculator.html b/abutment_calculator.html
index dd331d9..96eded2 100644
--- a/abutment_calculator.html
+++ b/abutment_calculator.html
@@ -131,0 +132,3 @@ header.app-head{
+.in-row .own-src,.chk-own .own-src{grid-column:1/-1;margin:-3px 0 2px 0;font:600 10px/1.35 ui-sans-serif,system-ui,sans-serif;color:#1C4FC4;letter-spacing:.01em}
+.own-src.ovr{color:#9a3412}
+.in-row input.ownv,.in-row select.ownv{border-color:#1C4FC4;background:#eef3ff}
@@ -592 +595,2 @@ function defaultState(){
-      esQ:0.0                            // permanent earth surcharge ES behind wall (ksf); 0 = none
+      esQ:0.0,                           // permanent earth surcharge ES behind wall (ksf); 0 = none
+      Kmode:"active"                     // OWNB: earth pressure state 'active' | 'atrest' (K0) | 'blend' (0.5(K0+Ka)) | 'massdot' (MassDOT 3.1.6 rule) [3.11.5.2]
@@ -594 +598 @@ function defaultState(){
-    constr:{ hFill:0.0, gLL:0.0 },       // construction stage: backfill height above footing top (0 = full = soilH); γ on LS during construction
+    constr:{ hFill:0.0, gLL:0.0, qC:0.0, gC:1.50 },   // construction stage: backfill height above footing top (0 = full = soilH); γ on LS during construction; OWNB: construction surcharge q_c (ksf) and its factor [3.4.2.1]
@@ -639 +643 @@ function defaultState(){
-    own:{ owner:"AASHTO", Ltot:0 },                               // OWNA: bridge owner (AASHTO | MassDOT | RIDOT | CTDOT); total bridge length for the integral screening (0 = span L)
+    own:{ owner:"AASHTO", Ltot:0, ADT:"", mLL:1.0, dv:2 },        // OWNA: bridge owner (AASHTO | MassDOT | RIDOT | CTDOT); total bridge length for the integral screening (0 = span L)
@@ -647,0 +652 @@ function defaultState(){
+      gpEHmaxR:1.35,              // OWNB: γEH max for at-rest earth pressure [T.3.4.1-2]
@@ -651,0 +657 @@ function defaultState(){
+      coatBW:false, // OWNB: backwall bars epoxy coated → λcf on the development length [5.10.8.2.1b]
@@ -774,4 +780,5 @@ ABUT_OWN.rules=[
-  {owner:"MassDOT", id:"K", kind:"advisory", sec:"3.1.6 (p. 3-4)", text:"Earth pressure, unless the geotechnical report says otherwise: K0 for cantilever walls on rock or piles; 0.5(K0 + Ka) for cantilever walls on soil 5 ft high or less; Ka by Coulomb theory otherwise",
-    ev:C=>{ const onRP=C.pile||C.rock, H=C.R.geo.H, K0=1-Math.sin(deg2rad(+S.soil.phi)), req=onRP?"K0":(H<=5+1e-9?"0.5(K0 + Ka)":"Ka (Coulomb)");
-      return {st:req.startsWith("Ka")&&S.soil.method==="coulomb"?"pass":"warn", val:`${S.soil.method==="coulomb"?"Coulomb":"Rankine"} K<sub>a</sub> = ${fmt(C.R.ka,4)} used (active, panel I-3)`,
-        lim:`${req} (${onRP?(C.pile?"pile-supported":"on rock"):"on soil, H = "+fmt(H,2)+" ft"})`, tex:`K_0 = 1-\\sin\\varphi_f = 1-\\sin${ownF(+S.soil.phi,1)}° = ${ownF(K0,4)}`, link:OWN_LK.eh}; }},
+  {owner:"MassDOT", id:"K", kind:"shall-check", sec:"3.1.6 (p. 3-4)", text:"Earth pressure, unless the geotechnical report says otherwise: K0 for cantilever walls on rock or piles; 0.5(K0 + Ka) for cantilever walls on soil 5 ft high or less; Ka by Coulomb theory otherwise",
+    ev:C=>{ const ks=C.R.Ksel, onRP=C.pile||C.rock, H=C.R.geo.H, req=onRP?"atrest":(H<=5+1e-9?"blend":"active"), nm={active:"K<sub>a</sub>",atrest:"K<sub>0</sub>",blend:"0.5(K<sub>0</sub> + K<sub>a</sub>)"};
+      const ruleOK=ks.eff===req, coulOK=req==="atrest"||S.soil.method==="coulomb";
+      return {st:!ruleOK?"fail":(coulOK?"pass":"warn"), val:`${nm[ks.eff]} = ${fmt(ks.K,4)} used (panel I-3${ks.mode==="massdot"?", MassDOT rule":""})${req!=="atrest"?"; K<sub>a</sub> by "+(S.soil.method==="coulomb"?"Coulomb":"Rankine (Coulomb required)"):""}`,
+        lim:`${nm[req]} (${onRP?(C.pile?"pile-supported":"on rock"):"on soil, H = "+fmt(H,2)+" ft"})${req!=="atrest"?", K<sub>a</sub> by Coulomb":""}`, tex:`K_0 = 1-\\sin\\varphi_f = 1-\\sin${ownF(+S.soil.phi,1)}° = ${ownF(ks.K0,4)}`, link:OWN_LK.eh}; }},
@@ -780,6 +787,3 @@ ABUT_OWN.rules=[
-  {owner:"MassDOT", id:"heel", kind:"advisory", sec:"3.3.2.2 (p. 3-21)", text:"Spread footings: toe steel without the soil above the toe offsetting the upward pressure; heel top steel for all dead load above the heel (incl. the heel), no live load, load and resistance factors 1.0, no upward pressure relief",
-    ev:C=>({st:S.fnd.branch==="spread"?"warn":"na", val:S.fnd.branch==="spread"?"toe: soil above the toe not used (as required); heel: the dead-load-only case is not checked in this version":"pile-supported footing", lim:"heel: M<sub>DL</sub> ≤ 1.0·M<sub>n</sub>", link:OWN_LK.heel})},
-  {owner:"MassDOT", id:"coat", kind:"advisory", sec:"3.3.1.6 (p. 3-18)", text:"Epoxy-coated reinforcement (or galvanized COATED BARS) at least in backwalls and beam seats, and next to faces within 30 ft of a traveled way",
-    ev:C=>({st:"warn", val:"development length uses uncoated bars (λ<sub>cf</sub> = 1.0)", lim:"coated backwall and seat bars", link:OWN_LK.bw})},
-  {owner:"MassDOT", id:"fc", kind:"advisory", sec:"4.2.2.3, General Notes (p. 4-5)", text:"Concrete 5000 HP (f′c = 5.0 ksi) unless otherwise specified",
-    ev:C=>({st:Math.abs(C.fc-5)<1e-9?"pass":"adv", val:`f′c = ${fmt(C.fc,2)} ksi (panel I-2)`, lim:"5.0 ksi", link:OWN_LK.stem})},
+  {owner:"MassDOT", id:"heel", kind:"shall-check", sec:"3.3.2.2 (p. 3-21)", text:"Spread footings: toe steel without the soil above the toe offsetting the upward pressure; heel top steel for all dead load above the heel (incl. the heel), no live load, load and resistance factors 1.0, no upward pressure relief",
+    ev:C=>{ const h=C.R.checks.heelMass; if(S.fnd.branch!=="spread"||!h) return {st:"na", val:"pile-supported footing", lim:"—"};
+      return {st:h.dc<=1+1e-9?"pass":"fail", val:`toe: soil above the toe not used; heel: M<sub>DL</sub> = ${fmt(h.MDL)} vs M<sub>n</sub> = ${fmt(h.Mn)} kip-ft/ft`, lim:"M<sub>DL</sub> ≤ 1.0·M<sub>n</sub>", tex:`D/C = M_{DL}/(1.0\\,M_n) = ${ownF(h.MDL)}/${ownF(h.Mn)} = ${ownF(h.dc,3)}`, link:OWN_LK.heel}; }},
@@ -789,7 +792,0 @@ ABUT_OWN.rules=[
-  {owner:"MassDOT", id:"temp", kind:"advisory", sec:"3.1.8.2 (p. 3-7)", text:"Uniform temperature (Cold Climate, Procedure A basis, the 65 % factor already included): steel +70 / −100 °F with α = 6.5×10⁻⁶; concrete +30 / −70 °F with α = 5.5×10⁻⁶",
-    ev:C=>{ const Lg=S.longit, st=C.mat==="concrete"?[30,70,5.5e-6]:[70,100,6.5e-6], ok=Math.abs(+Lg.dTrise-st[0])<1e-9&&Math.abs(+Lg.dTfall-st[1])<1e-9&&Math.abs(+Lg.cte-st[2])<1e-12;
-      return {st:ok?"pass":"adv", val:`+${fmt(+Lg.dTrise,0)} / −${fmt(+Lg.dTfall,0)} °F, α = ${(+Lg.cte*1e6).toFixed(1)}×10⁻⁶ (panel I-6b${Lg.computeTU?"":"; TU calculation off"})`, lim:`+${st[0]} / −${st[1]} °F, α = ${(st[2]*1e6).toFixed(1)}×10⁻⁶ (${C.mat})`, link:OWN_LK.tu}; }},
-  {owner:"MassDOT", id:"G", kind:"advisory", sec:"3.5.7.4 (p. 3-57)", text:"Elastomer specified G = 0.160 ksi; design with the least favorable value of 0.136–0.184 ksi (the larger value for the force on the abutment)",
-    ev:C=>({st:Math.abs(+S.bearing.G-0.184)<1e-9?"pass":"adv", val:`G = ${fmt(+S.bearing.G,3)} ksi (panel I-6b)`, lim:"0.184 ksi for the pad shear force", link:OWN_LK.tu})},
-  {owner:"MassDOT", id:"seis", kind:"note", sec:"3.4.4.3 (p. 3-35)", text:"SDC A conventional bridges: abutments need no seismic design (no abutment inertia or seismic soil force); connections per Guide Spec 4.6 on the permanent load only; support length per Guide Spec 4.12",
-    ev:C=>({st:(S.seismic.on&&+S.seismic.zone===1)?"warn":"note", val:S.seismic.on?"Extreme Event I is ON (panel I-11)":"Extreme Event I off", lim:"not required in SDC A (S<sub>D1</sub> &lt; 0.15)", link:OWN_LK.seis})},
@@ -824,2 +820,0 @@ ABUT_OWN.rules=[
-  {owner:"RIDOT", id:"crack", kind:"advisory", sec:"5.4.1 (p. 5-5)", text:"Crack control: Class 2 exposure for all reinforced concrete members",
-    ev:C=>ownCrack(C,true)},
@@ -830,3 +825,5 @@ ABUT_OWN.rules=[
-    ev:C=>({st:"note", val:"λ<sub>cf</sub> = 1.0 in use", lim:"galvanized bars", link:OWN_LK.bw})},
-  {owner:"RIDOT", id:"passive", kind:"shall-check", sec:"10.4.3, 10.4.4 (p. 10-5)", text:"Passive resistance in front of the footing excluded for every strength failure mode; it may be included at the extreme event limit states",
-    ev:C=>({st:(S.fnd.branch==="spread"&&S.fnd.usePassive)?"fail":"pass", val:(S.fnd.branch==="spread"&&S.fnd.usePassive)?"passive included in every limit state (panel I-4)":"passive not used", lim:"strength: none; extreme event: allowed", link:OWN_LK.slide})},
+    ev:C=>({st:S.reinf.coatBW?"warn":"note", val:S.reinf.coatBW?"backwall bars set as epoxy coated (panel I-9)":"λ<sub>cf</sub> = 1.0 in use", lim:"galvanized bars (λ<sub>cf</sub> = 1.0)", link:OWN_LK.bw})},
+  {owner:"RIDOT", id:"passive", kind:"load", sec:"10.4.3, 10.4.4 (p. 10-5)", text:"Passive resistance in front of the footing excluded for every strength failure mode; it may be included at the extreme event limit states (applied: passive enters sliding at Extreme Event I only)",
+    ev:C=>({st:"pass", val:(S.fnd.branch==="spread"&&S.fnd.usePassive)?"passive on (panel I-4): used at Extreme Event I only":"passive not used", lim:"strength: none; extreme event: allowed", link:OWN_LK.slide})},
+  {owner:"RIDOT", id:"eta", kind:"load", sec:"1.3.1–1.3.3 (p. 1-8)", text:"Load modifier at the strength limit states: ηD = 1.00, ηR = 1.00 (redundant), ηI = 1.05 for ADT ≥ 5000, otherwise 1.00",
+    ev:C=>{ const L=C.R.ownLoad; return {st:L.hasADT?"pass":"warn", val:L.hasADT?`ADT = ${fmt(L.adt,0)} → η = ${fmt(L.eta,2)}`:"ADT not entered (panel I-0): η = 1.00 used", lim:"η = 1.05 if ADT ≥ 5000", tex:`\\eta = \\eta_D\\eta_R\\eta_I = (1.00)(1.00)(${ownF(L.eta)}) = ${ownF(L.eta)}`, link:["tab-comb","o-ownload","§2.0a owner load rules"]}; }},
@@ -834 +831 @@ ABUT_OWN.rules=[
-    ev:C=>({st:"adv", val:`active K<sub>a</sub> = ${fmt(C.R.ka,4)} used (panel I-3)`, lim:"at-rest where the wall cannot tilt", link:OWN_LK.eh})},
+    ev:C=>({st:"adv", val:`${{active:"active K<sub>a</sub>",atrest:"at-rest K<sub>0</sub>",blend:"0.5(K<sub>0</sub> + K<sub>a</sub>)"}[C.R.Ksel.eff]} = ${fmt(C.R.Ksel.K,4)} used (panel I-3)`, lim:"at-rest where the wall cannot tilt (choose it in panel I-3)", link:OWN_LK.eh})},
@@ -859 +856 @@ ABUT_OWN.rules=[
-  {owner:"CTDOT", id:"ls2", kind:"shall-check", sec:"V2 3.11.6.4 (p. 3-7)", text:"Permanent earth-retaining structures designed for a live-load surcharge of at least 2 ft of soil",
+  {owner:"CTDOT", id:"ls2", kind:"load", sec:"V2 3.11.6.4 (p. 3-7)", text:"Permanent earth-retaining structures designed for a live-load surcharge of at least 2 ft of soil (applied: h_eq = max(table value, 2 ft))",
@@ -870,2 +866,0 @@ ABUT_OWN.rules=[
-  {owner:"CTDOT", id:"crack", kind:"advisory", sec:"V2 5.6.7", text:"Crack control based on Class 2 exposure",
-    ev:C=>ownCrack(C,true)},
@@ -892,0 +888,4 @@ function abutOwnChecks(R){
+  // OWNB: owner defaults — the value in use beside the owner value; a different value is the user's (kept, flagged)
+  ABUT_OWN_DEF.filter(d=>d.owner===o).forEach(d=>{ const v=getPath(S,d.key), dv=ownDefVal(d), same=ownEq(v,dv);
+    rows.push({r:{owner:o,id:"def."+d.key,kind:"default",sec:d.sec,text:d.text}, st:same?"pass":"warn",
+      val:`${ownShow(d,v)} (panel ${OWN_DEF_PANEL[d.key]||"—"})`, lim:ownShow(d,dv)+(same?" (owner default in use)":" — your value is kept: it overrides the owner default"), link:OWN_DEF_LK[d.key]||null}); });
@@ -894,0 +894,65 @@ function abutOwnChecks(R){
+/* ---------- OWNB (2026-10-20): owner defaults (kind 'default'). An owner value is applied to an input when the owner is chosen
+   (or the superstructure material changes) while the input still holds the previous default (tool default or the previous
+   owner's value); a value the user entered is kept and flagged "Overrides". Inputs holding an owner value are highlighted
+   (as GirderDetail values in ST-Girder) with the owner section. ---------- */
+const ABUT_OWN_DEF=[
+  {owner:"MassDOT", key:"mat.fc", sec:"4.2.2.3, General Notes (p. 4-5)", text:"Concrete 5000 HP: f′c = 5.0 ksi", val:()=>5.0, unit:"ksi"},
+  {owner:"MassDOT", key:"soil.Kmode", sec:"3.1.6 (p. 3-4)", text:"Earth pressure coefficient by the 3.1.6 rule: K0 for walls on rock or piles, 0.5(K0 + Ka) on soil 5 ft high or less, Ka otherwise", val:()=>"massdot"},
+  {owner:"MassDOT", key:"longit.dTrise", sec:"3.1.8.2 (p. 3-7)", text:"Temperature rise: steel 70 °F, concrete 30 °F (the 65 % factor is included)", val:Q=>Q.longit.material==="concrete"?30:70, unit:"°F"},
+  {owner:"MassDOT", key:"longit.dTfall", sec:"3.1.8.2 (p. 3-7)", text:"Temperature fall: steel 100 °F, concrete 70 °F", val:Q=>Q.longit.material==="concrete"?70:100, unit:"°F"},
+  {owner:"MassDOT", key:"longit.cte", sec:"3.1.8.2 (p. 3-7)", text:"Coefficient of thermal expansion: steel 6.5×10⁻⁶, concrete 5.5×10⁻⁶ /°F", val:Q=>Q.longit.material==="concrete"?5.5e-6:6.5e-6, unit:"/°F"},
+  {owner:"MassDOT", key:"bearing.G", sec:"3.5.7.4 (p. 3-57)", text:"Elastomer G: least favorable value of 0.160 ksi ± 15 %; 0.184 ksi for the pad shear force on the abutment", val:()=>0.184, unit:"ksi"},
+  {owner:"MassDOT", key:"reinf.coatBW", sec:"3.3.1.6 (p. 3-18)", text:"Backwall and beam seat bars epoxy coated (λcf on the backwall development length)", val:()=>true},
+  {owner:"MassDOT", key:"seismic.on", sec:"3.4.4.3 (p. 3-35)", text:"SDC A conventional bridges: no seismic design of the abutment (Extreme Event I off); connection force and support length still checked", val:()=>false},
+  {owner:"RIDOT", key:"own.mLL", sec:"3.4.1.2 (p. 3-7)", text:"Design load multiplier 1.2 on HL-93 at the Strength and Service limit states (applied here to the girder LL+IM reaction and to BR)", val:()=>1.2},
+  {owner:"RIDOT", key:"seismic.gEQll", sec:"3.2.1.3 (p. 3-2)", text:"γEQ on live load at Extreme Event I: 0.50 maximum, 0.0 minimum (both run)", val:()=>0.5},
+  {owner:"RIDOT", key:"longit.dTrise", sec:"3.7.1 (p. 3-14)", text:"Procedure B, steel −10 to 105 °F, concrete 0 to 100 °F; force to the substructure from 65 % of the full range, one way each direction", val:Q=>0.65*(Q.longit.material==="concrete"?100:115), unit:"°F"},
+  {owner:"RIDOT", key:"longit.dTfall", sec:"3.7.1 (p. 3-14)", text:"As the rise: 65 % of the full Procedure B range", val:Q=>0.65*(Q.longit.material==="concrete"?100:115), unit:"°F"},
+  {owner:"RIDOT", key:"reinf.gammaE", sec:"5.4.1 (p. 5-5)", text:"Crack control: Class 2 exposure for all reinforced concrete members", val:()=>0.75},
+  {owner:"RIDOT", key:"constr.qC", sec:"3.2.2 (p. 3-3)", text:"Construction load combination for abutments and walls: surcharge of the larger of the construction equipment and 600 psf", val:()=>0.60, unit:"ksf"},
+  {owner:"CTDOT", key:"soil.phi", sec:"V2 3.11.1 (p. 3-7)", text:"Pervious Structure Backfill: φ = 35°", val:()=>35, unit:"°"},
+  {owner:"CTDOT", key:"soil.gamma", sec:"V2 3.5.1 (p. 3-3)", text:"Compacted sand, gravel, silt and clay (incl. Pervious Structure Backfill): 0.125 kcf", val:()=>0.125, unit:"kcf"},
+  {owner:"CTDOT", key:"seismic.gEQll", sec:"V2 3.4.1 (p. 3-2)", text:"γEQ on live load at Extreme Event I: 0.50 for permanent bridges", val:()=>0.5},
+  {owner:"CTDOT", key:"longit.dTrise", sec:"V2 3.12.2.1 (p. 3-8)", text:"Range −10 to +110 °F with a 50 °F median: rise 60 °F", val:()=>60, unit:"°F"},
+  {owner:"CTDOT", key:"longit.dTfall", sec:"V2 3.12.2.1 (p. 3-8)", text:"Fall 60 °F (50 °F median to −10 °F)", val:()=>60, unit:"°F"},
+  {owner:"CTDOT", key:"longit.cte", sec:"V2 3.12.2.3 (p. 3-8)", text:"Coefficient of thermal expansion 6.4×10⁻⁶ /°F", val:()=>6.4e-6, unit:"/°F"},
+  {owner:"CTDOT", key:"reinf.gammaE", sec:"V2 5.6.7", text:"Crack control based on Class 2 exposure", val:()=>0.75}
+];
+const OWN_DEF_KEYS=[...new Set(ABUT_OWN_DEF.map(d=>d.key))];
+const OWN_DEF_PANEL={"mat.fc":"I-2","soil.Kmode":"I-3","soil.phi":"I-3","soil.gamma":"I-3","constr.qC":"I-3","longit.dTrise":"I-6b","longit.dTfall":"I-6b","longit.cte":"I-6b","bearing.G":"I-6b",
+  "reinf.coatBW":"I-9","reinf.gammaE":"I-9","seismic.on":"I-11","seismic.gEQll":"I-11","own.mLL":"I-0"};
+const OWN_DEF_LK={"mat.fc":["tab-struct","o-str-Stem","§5.2 stem"],"soil.Kmode":["tab-loads","o-eh","§1.3 earth pressure"],"soil.phi":["tab-loads","o-eh","§1.3 earth pressure"],"soil.gamma":["tab-loads","o-eh","§1.3 earth pressure"],
+  "constr.qC":["tab-comb","o-ownload","§2.0a owner load rules"],"longit.dTrise":["tab-loads","o-longit-tu","§1.7 temperature"],"longit.dTfall":["tab-loads","o-longit-tu","§1.7 temperature"],"longit.cte":["tab-loads","o-longit-tu","§1.7 temperature"],
+  "bearing.G":["tab-loads","o-longit-tu","§1.7 temperature"],"reinf.coatBW":["tab-struct","o-str-Backwall","§5.1 backwall"],"reinf.gammaE":["tab-struct","o-str-Stem","§5.2 stem"],
+  "seismic.on":["tab-stab","o-seis","§3.6 connection force"],"seismic.gEQll":["tab-comb","o-facttbl","§2.1 load factors"],"own.mLL":["tab-comb","o-ownload","§2.0a owner load rules"]};
+const OWN_DEF_LBL={"mat.fc":"f′c","soil.Kmode":"earth pressure state","soil.phi":"backfill φ","soil.gamma":"backfill γ","constr.qC":"construction surcharge q_c","longit.dTrise":"temperature rise","longit.dTfall":"temperature fall",
+  "longit.cte":"α","bearing.G":"elastomer G","reinf.coatBW":"coated backwall bars","reinf.gammaE":"crack-control γe","seismic.on":"Extreme Event I","seismic.gEQll":"γEQ on live load","own.mLL":"design load multiplier m"};
+const ownDefLabel=k=>OWN_DEF_LBL[k]||k;
+const ownEq=(a,b)=>(typeof a==="boolean"||typeof b==="boolean"||typeof a==="string"&&isNaN(+a)||typeof b==="string"&&isNaN(+b)||a===""||b==="")? a===b : Math.abs(+a-+b)<=1e-9*Math.max(Math.abs(+a),Math.abs(+b))+1e-15;
+function ownDefVal(d){ return d.val(S); }
+function ownShow(d,v){ if(typeof v==="boolean") return d.key==="seismic.on"?(v?"on":"off"):(v?"yes":"no");
+  if(d.key==="soil.Kmode") return {active:"active K_a",atrest:"at-rest K_0",blend:"0.5(K_0 + K_a)",massdot:"MassDOT 3.1.6 rule"}[v]||String(v);
+  if(d.key==="reinf.gammaE") return Math.abs(+v-0.75)<1e-9?"Class 2 (γe = 0.75)":Math.abs(+v-1)<1e-9?"Class 1 (γe = 1.00)":"γe = "+fmt(+v,2);
+  if(d.key==="longit.cte") return (+v*1e6).toFixed(2)+"×10⁻⁶ /°F";
+  return fmt(+v,d.key==="bearing.G"||d.key==="soil.gamma"?3:2)+(d.unit?" "+d.unit:""); }
+/* map of every owner-default input → its default for owner o (or the tool default) for the current state */
+function ownDefMap(o){ o=o||abutOwner(); const T=defaultState(), m={};
+  OWN_DEF_KEYS.forEach(k=>{ const d=ABUT_OWN_DEF.find(x=>x.owner===o&&x.key===k); m[k]=d?ownDefVal(d):getPath(T,k); }); return m; }
+/* after the owner (or the material) changed: an input that still holds its previous default takes the new one */
+function ownReapply(pre){ const post=ownDefMap(), set=[], kept=[];
+  OWN_DEF_KEYS.forEach(k=>{ if(ownEq(pre[k],post[k])) return; const v=getPath(S,k);
+    if(ownEq(v,pre[k])){ setPath(S,k,post[k]); set.push(k); } else kept.push(k); });
+  return {set,kept}; }
+let OWN_LAST=null;   // the last owner / material change: inputs set and kept (shown in the owner card until the next change)
+function ownRuleFor(path){ const o=abutOwner(); return o==="AASHTO"? null : (ABUT_OWN_DEF.find(d=>d.owner===o&&d.key===path)||null); }
+function ownTagHTML(path){ const d=ownRuleFor(path); if(!d) return ""; const v=getPath(S,path), dv=ownDefVal(d), same=ownEq(v,dv);
+  return `<div class="own-src${same?"":" ovr"}" data-ownpath="${path}">${same?"Owner · "+esc(abutOwnCite(d)):"Overrides "+esc(abutOwnCite(d))+": "+esc(ownShow(d,dv))}</div>`; }
+function ownTagRefresh(){ document.querySelectorAll("#inputCol [data-ownpath]").forEach(el=>{ const p=el.dataset.ownpath, d=ownRuleFor(p); if(!d) return;
+  const dv=ownDefVal(d), same=ownEq(getPath(S,p),dv); el.classList.toggle("ovr",!same); el.textContent=same?"Owner · "+abutOwnCite(d):"Overrides "+abutOwnCite(d)+": "+ownShow(d,dv);
+  const inp=document.querySelector(`#inputCol [data-path="${p}"]`); if(inp) inp.classList.toggle("ownv",same); }); }
+/* OWNB load rules for this calculation: η (RIDOT 1.3.3 with the ADT), the design load multiplier m on the LL reaction and BR,
+   passive at Extreme Event only (RIDOT 10.4.3/10.4.4), h_eq ≥ 2 ft (CTDOT V2 3.11.6.4). AASHTO: η = 1, m = 1, no rule. */
+function abutOwnLoad(){ const o=abutOwner(), adt=S.own.ADT, hasADT=adt!==""&&adt!==null&&isFinite(+adt)&&+adt>0;
+  const eta=(o==="RIDOT"&&hasADT&&+adt>=5000)?1.05:1.0;
+  const m=o==="AASHTO"?1:((+S.own.mLL>0)?+S.own.mLL:1);
+  return {owner:o, eta, etaMin:1/eta, m, hasADT, adt:+adt, passEE:o==="RIDOT", lsMin:o==="CTDOT"?2.0:0}; }
@@ -980,0 +1045 @@ function inpRow(label, path, unit, o={}){
+  const ot=ownTagHTML(path), oc=ot&&!/ovr/.test(ot)?' class="ownv"':'';   // OWNB: owner default highlight
@@ -982,2 +1047,2 @@ function inpRow(label, path, unit, o={}){
-    <input type="number" step="${step}" data-path="${path}" value="${v}">
-    <span class="unit">${unit||"&nbsp;"}</span></div>`;
+    <input type="number" step="${step}" data-path="${path}" value="${v}"${oc}>
+    <span class="unit">${unit||"&nbsp;"}</span>${ot}</div>`;
@@ -988,0 +1054 @@ function selRow(label, path, options, o={}){
+  const ot=ownTagHTML(path), oc=ot&&!/ovr/.test(ot)?' class="ownv"':'';   // OWNB: owner default highlight
@@ -990 +1056 @@ function selRow(label, path, options, o={}){
-    <select data-path="${path}"${rebuild} style="grid-column:span 2;">${opts}</select></div>`;
+    <select data-path="${path}"${rebuild}${oc} style="grid-column:span 2;">${opts}</select>${ot}</div>`;
@@ -1186,0 +1253,13 @@ function migrate(){
+  // OWNB (2026-10-20): new inputs, each defaulting to the value that reproduces the earlier results (AASHTO owner)
+  if(S.soil.Kmode===undefined) S.soil.Kmode="active";
+  if(S.factors.gpEHmaxR===undefined) S.factors.gpEHmaxR=1.35;
+  if(S.constr.qC===undefined) S.constr.qC=0;
+  if(S.constr.gC===undefined) S.constr.gC=1.50;
+  if(S.reinf.coatBW===undefined) S.reinf.coatBW=false;
+  if(S.own.ADT===undefined) S.own.ADT="";
+  if(S.own.mLL===undefined) S.own.mLL=1.0;
+  if(!(S.own.dv>=2)){   // a project saved with an owner before the owner defaults existed: apply them to the inputs still at the tool default
+    S.own.dv=2;
+    if(abutOwner()!=="AASHTO"){ const r=ownReapply(ownDefMap("AASHTO"));
+      if(r.set.length) DEFAULTS_NOTICE=(DEFAULTS_NOTICE||[]).concat(["Owner "+abutOwner()+": owner defaults applied to inputs that still held the tool default — "+r.set.map(k=>ownDefLabel(k)).join("; ")+" (Tab 1 §1.0a)"]); }
+  }
@@ -1283 +1362 @@ function buildInputs(){
-    <div class="in-note">${oo==="AASHTO"?"Calculation and checks per AASHTO LRFD 10th Ed. (2024). Choose an owner to check its requirements (listed in Tab 1 §1.0a); no computed result changes.":esc(om.manual)+", written to AASHTO LRFD "+esc(om.aashto)+"; the calculation follows AASHTO LRFD 10th Ed. (2024). The owner's requirements are checked in Tab 1 §1.0a (pass / fail / advisory); no computed result changes."}</div>
+    <div class="in-note">${oo==="AASHTO"?"Calculation and checks per AASHTO LRFD 10th Ed. (2024). Choosing an owner applies its defaults and load rules and checks its requirements (Tab 1 §1.0a).":esc(om.manual)+", written to AASHTO LRFD "+esc(om.aashto)+"; the calculation follows AASHTO LRFD 10th Ed. (2024). The owner's requirements are checked in Tab 1 §1.0a; the owner defaults are applied to inputs still at their previous default (highlighted, editable) and the owner load rules are worked in Tab 2 §2.0a."}</div>
@@ -1284,0 +1364,2 @@ function buildInputs(){
+    ${oo==="RIDOT"?inpRow("Average daily traffic ADT (η<sub>I</sub>)","own.ADT","veh/day",{title:"RIDOT BDM 1.3.3: η_I = 1.05 for ADT ≥ 5000, else 1.00, at the strength limit states (Tab 2 §2.0a). Blank = not entered: η = 1.00 is used and flagged."}):""}
+    ${oo!=="AASHTO"?inpRow("Design load multiplier m (LL reaction, BR)","own.mLL","–",{title:"Multiplies the girder LL+IM reaction and braking BR at Strength I, III, V and Service I (not LS, not Extreme Event, not the construction stage). RIDOT BDM 3.4.1.2: 1.2. Worked in Tab 2 §2.0a."}):""}
@@ -1335,0 +1417,2 @@ function buildInputs(){
+    ${selRow("Earth pressure state","soil.Kmode",[["active","Active K<sub>a</sub> (wall free to move) [3.11.5.3]"],["atrest","At-rest K<sub>0</sub> = 1 − sin φ (restrained) [3.11.5.2]"],["blend","0.5(K<sub>0</sub> + K<sub>a</sub>)"],["massdot","MassDOT 3.1.6 rule (by foundation and height)"]],{rebuild:true})}
+    ${S.soil.Kmode&&S.soil.Kmode!=="active"?`<div class="in-note">K used for EH, LS, ES and the construction stage; worked in Tab 1 §1.3. At-rest takes γ<sub>EH</sub> max from panel I-8 (1.35 [T.3.4.1-2]).</div>`:""}
@@ -1345,0 +1429,2 @@ function buildInputs(){
+    ${inpRow("Construction surcharge q<sub>c</sub> (equipment)","constr.qC","ksf",{title:"Uniform construction surcharge behind the wall in the construction stage (no superstructure): horizontal K·q_c·h_c at h_c/2 and q_c over the heel, factored by γ_c (on or off, as live load). 0 = none. RIDOT BDM 3.2.2: the larger of the equipment load and 600 psf. Worked in Tab 2 §2.0a."})}
+    ${(+S.constr.qC>0)?inpRow("&nbsp;&nbsp;γ<sub>c</sub> on the construction surcharge","constr.gC","–",{title:"Construction loads in Strength I: load factor not less than 1.5 [AASHTO 3.4.2.1]."}):""}
@@ -1460 +1545 @@ function buildInputs(){
-      <div class="in-row"><label>AASHTO Procedure A range</label><button class="mini-btn" id="btnThermPreset" title="Fill α, ΔT rise/fall from Table 3.12.2.1-1 for the selected material & climate (editable after)">Apply preset</button></div>
+      <div class="in-row"><label>AASHTO Procedure A range</label><button class="mini-btn" id="btnThermPreset" title="Fill α, ΔT rise/fall from Table 3.12.2.1-1 for the selected material & climate (editable after); with an owner that sets them (MassDOT 3.1.8.2, RIDOT 3.7.1, CTDOT V2 3.12.2), the owner values">Apply preset</button></div>
@@ -1534,0 +1620 @@ function buildInputs(){
+    ${S.soil.Kmode&&S.soil.Kmode!=="active"?inpRow("γ EH max (at-rest)","factors.gpEHmaxR","–",{title:"Used when the earth pressure state is at-rest K0 [T.3.4.1-2: 1.35]; 0.5(K0 + Ka) uses the active value."}):""}
@@ -1561,0 +1648,2 @@ function buildInputs(){
+    <div class="chk-row chk-own" style="flex-wrap:wrap"><input type="checkbox" id="chkCoatBW" data-path="reinf.coatBW" ${S.reinf.coatBW?"checked":""}>
+    <label for="chkCoatBW">Backwall bars epoxy coated (λ<sub>cf</sub> on ℓ<sub>d</sub>) [5.10.8.2.1b]</label>${ownTagHTML("reinf.coatBW")}</div>
@@ -1651 +1739,2 @@ function collectInputWarnings(){
-function interpHeq(H){
+function interpHeq(H){ const v=interpHeq0(H), mn=abutOwnLoad().lsMin; return mn>0? Math.max(mn,v) : v; }   // OWNB: CTDOT V2 3.11.6.4, h_eq ≥ 2 ft
+function interpHeq0(H){
@@ -1856 +1945,10 @@ function computeAll(){
-  const {ka,iota}=computeKa();
+  // OWNB: earth pressure state [3.11.5.2; MassDOT 3.1.6; RIDOT 11.3.4]: active (as before) / at-rest K0 = 1 − sin φ (horizontal) /
+  // 0.5(K0 + Ka) / the MassDOT rule (K0 on piles or rock, the blend on soil with H ≤ 5 ft, Ka otherwise). K replaces k_a for EH, LS, ES.
+  const KA=computeKa(), K0=1-Math.sin(deg2rad(+S.soil.phi));
+  const kMode=["atrest","blend","massdot"].includes(S.soil.Kmode)?S.soil.Kmode:"active";
+  const kEff=kMode!=="massdot"?kMode:((S.fnd.branch==="pile"||(S.fnd.branch==="spread"&&S.fnd.matl==="rock"))?"atrest":(H<=5+1e-9?"blend":"active"));
+  let ka=KA.ka, iota=KA.iota;
+  if(kEff==="atrest"){ ka=K0; iota=0; }
+  else if(kEff==="blend"){ const Kh=0.5*(K0+KA.ka*Math.cos(deg2rad(KA.iota))), Kv=0.5*KA.ka*Math.sin(deg2rad(KA.iota)); ka=Math.hypot(Kh,Kv); iota=Math.atan2(Kv,Kh)*180/Math.PI; }
+  R.Ksel={mode:kMode, eff:kEff, K0, Ka:KA.ka, iotaA:KA.iota, K:ka, iota};
+  if(kEff!=="active"&&(+g.beta||0)>0) warn("At-rest K0 = 1 − sin φ is for level backfill [3.11.5.2]; the backfill slopes (β > 0) — confirm K0 with the geotechnical engineer.");
@@ -1907 +2005,2 @@ function computeAll(){
-    const dPAE=isFinite(PAE)? Math.max(0,PAE-PaSum) : NaN;    // dynamic increment over the static resultant
+    const PaSumA=kEff==="active"? PaSum : PaSum*KA.ka/ka;       // OWNB: the M–O increment is taken over the ACTIVE static resultant, added to the K static pressure
+    const dPAE=isFinite(PAE)? Math.max(0,PAE-PaSumA) : NaN;    // dynamic increment over the static resultant
@@ -1909 +2008 @@ function computeAll(){
-    const kahLoc=ka*Math.cos(deg2rad(iota));
+    const kahLoc=KA.ka*Math.cos(deg2rad(KA.iota));   // OWNB: active k_ah (= ka·cos ι when the state is active)
@@ -1984,0 +2084,5 @@ function computeAll(){
+    // OWNB: construction surcharge q_c (equipment; RIDOT BDM 3.2.2), construction stage only, factor γ_c as a live load (on/off) [3.4.2.1]
+    const qCs=Math.max(0,+S.constr.qC||0);
+    if(qCs>0){ const CSh=ka*qCs*hcC*ci2*Lab, CSv=qCs*g.Lheel*Lab;
+      groups.CShC={cls:"CL", stage:"constr", V:0,Mv:0, Hx:CSh, Mh:CSh*(hcC/2), Hy:0,Mt:0, desc:"Construction surcharge q_c — horizontal"};
+      groups.CSvC={cls:"CL", stage:"constr", V:CSv, Mv:CSv*xHeel, Hx:0,Mh:0,Hy:0,Mt:0, desc:"Construction surcharge q_c — vertical over heel"}; }
@@ -1988 +2092 @@ function computeAll(){
-  R.constrC={hfC,hcC,heqC};
+  R.constrC={hfC,hcC,heqC,qC:Math.max(0,+S.constr.qC||0)};
@@ -2004,0 +2109,4 @@ function computeAll(){
+  // OWNB: owner load rules — η (strength: γ max ×η, γ min ×1/η [1.3.2.1]; RIDOT 1.3.3), design load multiplier m on the LL reaction and BR
+  // (Strength and Service; RIDOT 3.4.1.2), construction surcharge factor γ_c. AASHTO owner: η = 1, m = 1 (every factor unchanged).
+  const OL=abutOwnLoad(), eta=OL.eta, etaMin=OL.etaMin, mLL=OL.m, qCf=Math.max(0,+S.constr.qC||0);
+  R.ownLoad=OL;
@@ -2006,2 +2114,2 @@ function computeAll(){
-    "Strength I":  {LL:+F.llS1, WS:0,        WL:0,       TU:+F.gTU, CR:+F.gCR, perm:true , liveOpt:true },
-    "Strength III":{LL:0,       WS:+F.wsS3,  WL:0,       TU:+F.gTU, CR:+F.gCR, perm:true , liveOpt:false},
+    "Strength I":  {LL:+F.llS1*eta, WS:0,        WL:0,       TU:+F.gTU*eta, CR:+F.gCR*eta, perm:true , liveOpt:true , mLL },
+    "Strength III":{LL:0,       WS:+F.wsS3*eta,  WL:0,       TU:+F.gTU*eta, CR:+F.gCR*eta, perm:true , liveOpt:false, mLL },
@@ -2010,3 +2118,3 @@ function computeAll(){
-    "Strength V":  {LL:+F.llS5, WS:+F.wsS5*wsF5,  WL:+F.wlS5, TU:+F.gTU, CR:+F.gCR, perm:true , liveOpt:true },
-    "Constr — Str I":{LL:+S.constr.gLL||0, WS:0, WL:0, TU:0, CR:0, perm:true , liveOpt:(+S.constr.gLL||0)>0 , noSuper:true },
-    "Service I":   {LL:1.0,     WS:1.0*wsFsv,      WL:1.0,     TU:1.0,    CR:1.0,    perm:false, liveOpt:true }
+    "Strength V":  {LL:+F.llS5*eta, WS:(+F.wsS5*wsF5)*eta,  WL:+F.wlS5*eta, TU:+F.gTU*eta, CR:+F.gCR*eta, perm:true , liveOpt:true , mLL },
+    "Constr — Str I":{LL:(+S.constr.gLL||0)*eta, WS:0, WL:0, TU:0, CR:0, perm:true , liveOpt:(+S.constr.gLL||0)>0||qCf>0 , noSuper:true, CL:qCf>0?(+S.constr.gC||0)*eta:0 },
+    "Service I":   {LL:1.0,     WS:1.0*wsFsv,      WL:1.0,     TU:1.0,    CR:1.0,    perm:false, liveOpt:true , mLL }
@@ -2018,2 +2126,3 @@ function computeAll(){
-  const GP={DC:[+F.gpDCmin,+F.gpDCmax], DW:[+F.gpDWmin,+F.gpDWmax],
-            EV:[+F.gpEVmin,+F.gpEVmax], EH:[+F.gpEHmin,+F.gpEHmax], ES:[0.75,1.50]};
+  // γp max/min of the strength limit states (×η / ×1/η, OWNB); at-rest earth pressure takes γEH max 1.35 [T.3.4.1-2]
+  const GP={DC:[+F.gpDCmin*etaMin,+F.gpDCmax*eta], DW:[+F.gpDWmin*etaMin,+F.gpDWmax*eta],
+            EV:[+F.gpEVmin*etaMin,+F.gpEVmax*eta], EH:[+F.gpEHmin*etaMin,(kEff==="atrest"?+F.gpEHmaxR:+F.gpEHmax)*eta], ES:[0.75*etaMin,1.50*eta]};
@@ -2032 +2141,2 @@ function computeAll(){
-      else if(gr.cls==="LL") gamma = liveOn ? ((liveOn===2&&k==="LL")? 0 : L.LL) : 0;   // liveOn 2: LS and BR on, girder LL reaction off [C11.5.6]
+      else if(gr.cls==="LL") gamma = liveOn ? ((liveOn===2&&k==="LL")? 0 : L.LL*((k==="LL"||k==="BR")&&L.mLL?L.mLL:1)) : 0;   // liveOn 2: LS and BR on, girder LL reaction off [C11.5.6]; OWNB: m on the LL reaction and BR
+      else if(gr.cls==="CL") gamma = liveOn ? (L.CL||0) : 0;   // OWNB: construction surcharge (construction stage)
@@ -2037 +2147 @@ function computeAll(){
-      if((k==="LSvC") && exclLSv) gamma=0;
+      if((k==="LSvC"||k==="CSvC") && exclLSv) gamma=0;
@@ -2050 +2160 @@ function computeAll(){
-        +(liveOn&&L.LL?(liveOn===2?` + ${L.LL.toFixed(2)}·(BR,LS), LL reaction off`:` + ${L.LL.toFixed(2)}·(LL,BR,LS)`):"")
+        +(liveOn&&L.LL?(L.mLL&&L.mLL!==1&&!L.noSuper?(liveOn===2?` + ${L.LL.toFixed(2)}·LS + ${(L.LL*L.mLL).toFixed(2)}·BR, LL reaction off`:` + ${(L.LL*L.mLL).toFixed(2)}·(LL,BR) + ${L.LL.toFixed(2)}·LS`):(liveOn===2?` + ${L.LL.toFixed(2)}·(BR,LS), LL reaction off`:` + ${L.LL.toFixed(2)}·(LL,BR,LS)`)):"")
@@ -2053,0 +2164 @@ function computeAll(){
+        +(L.CL&&liveOn&&groups.CShC?` + ${L.CL.toFixed(2)}·CS`:"")
@@ -2055 +2166 @@ function computeAll(){
-      : `1.00·(all)`+(liveOn?" incl. LL":" excl. LL");
+      : `1.00·(all)`+(liveOn?" incl. LL":" excl. LL")+(liveOn&&L.mLL&&L.mLL!==1?`, ${L.mLL.toFixed(2)}·(LL,BR)`:"");
@@ -2106 +2217,2 @@ function computeAll(){
-        const RR = rf.phiTau*Rn + (R.passive.on? fn.phiEP*Pp : 0);
+        const pUsed = R.passive.on && (!OL.passEE || !!LIMITS[lsName].eq);   // OWNB: RIDOT 10.4.3/10.4.4 — passive at Extreme Event only
+        const RR = rf.phiTau*Rn + (pUsed? fn.phiEP*Pp : 0);
@@ -2108 +2220 @@ function computeAll(){
-        if(dc>slid.dc) slid={dc, D:c.Hx, Rn, RR, V:c.V, phiTau:rf.phiTau, lbl:c.lbl, ls:lsName, c};
+        if(dc>slid.dc) slid={dc, D:c.Hx, Rn, RR, V:c.V, phiTau:rf.phiTau, lbl:c.lbl, ls:lsName, c, pUsed};
@@ -2335 +2447,3 @@ function computeAll(){
-    const ld=Math.max(12, ldb);
+    // OWNB: epoxy-coated bars [5.10.8.2.1b]: λcf = 1.5 with cover < 3d_b or clear spacing < 6d_b, else 1.2 (λrl = 1.0, so λrl·λcf ≤ 1.7); uncoated 1.0
+    const lamCf=o.coated? ((cvE<3*bar.db||(o.sp-bar.db)<6*bar.db)?1.5:1.2) : 1.0;
+    const ld=Math.max(12, ldb*lamCf);
@@ -2346 +2460 @@ function computeAll(){
-      rho,k,j,fss,dcBar:dc,betaS,sMax, crackOK:o.sp<=sMax, Ec, wcE, nMod, fc4, ldb, ld, AsST, bST, hST:hIn, gE, skinNote, skinAsk};
+      rho,k,j,fss,dcBar:dc,betaS,sMax, crackOK:o.sp<=sMax, Ec, wcE, nMod, fc4, ldb, ld, lamCf, AsST, bST, hST:hIn, gE, skinNote, skinAsk};
@@ -2356 +2470,2 @@ function computeAll(){
-  const MuBW=gEH_max*Mbw_EH+(+F.llS1)*Mbw_LS+GP.ES[1]*Mbw_ES, VuBW=gEH_max*Vbw_EH+(+F.llS1)*Vbw_LS+GP.ES[1]*Vbw_ES;
+  const gLSbw=LIMITS["Strength I"].LL;   // γLL Strength I (×η, OWNB; = factors.llS1 for the AASHTO owner)
+  const MuBW=gEH_max*Mbw_EH+gLSbw*Mbw_LS+GP.ES[1]*Mbw_ES, VuBW=gEH_max*Vbw_EH+gLSbw*Vbw_LS+GP.ES[1]*Vbw_ES;
@@ -2359 +2474 @@ function computeAll(){
-    lbl:`${gEH_max.toFixed(2)}·EH + ${(+F.llS1).toFixed(2)}·LS (Strength I)`};
+    lbl:`${gEH_max.toFixed(2)}·EH + ${gLSbw.toFixed(2)}·LS (Strength I)`, gLS:gLSbw};
@@ -2361 +2476 @@ function computeAll(){
-    sp:+S.reinf.bw.sp, Mu:MuBW, Vu:VuBW, Ms:MsBW, lbl:R.bwDem.lbl,
+    sp:+S.reinf.bw.sp, Mu:MuBW, Vu:VuBW, Ms:MsBW, lbl:R.bwDem.lbl, coated:!!S.reinf.coatBW,
@@ -2381 +2496 @@ function computeAll(){
-      const Pv = ns*( gDC*groups.DCsup.V + gDW*groups.DW.V + (llOn?L.LL*groups.LL.V:0)
+      const Pv = ns*( gDC*groups.DCsup.V + gDW*groups.DW.V + (llOn?L.LL*(L.mLL||1)*groups.LL.V:0)
@@ -2398 +2513,2 @@ function computeAll(){
-    const HgirdPerFt=ns*( (L.LL? L.LL*groups.BR.Hx:0) + L.TU*groups.TU.Hx + L.CR*groups.CRSH.Hx
+    const qCl=(L.noSuper&&L.CL)? R.constrC.qC : 0, MCS_ls=qCl>0? L.CL*kah*qCl*Hs_ls*Hs_ls/2 : 0, VCS_ls=qCl>0? L.CL*kah*qCl*Hs_ls : 0;   // OWNB: construction surcharge
+    const HgirdPerFt=ns*( (L.LL? L.LL*(L.mLL||1)*groups.BR.Hx:0) + L.TU*groups.TU.Hx + L.CR*groups.CRSH.Hx
@@ -2413,2 +2529,3 @@ function computeAll(){
-    const Mu=gEH_ls*MEH_ls+(L.LL?L.LL*MLS_ls:0)+gES_ls*MES_ls+HgirdPerFt*g.hstem + MeccPerFt + Meq;
-    const Vu=gEH_ls*VEH_ls+(L.LL?L.LL*VLS_ls:0)+gES_ls*VES_ls+HgirdPerFt + Veq;
+    let Mu=gEH_ls*MEH_ls+(L.LL?L.LL*MLS_ls:0)+gES_ls*MES_ls+HgirdPerFt*g.hstem + MeccPerFt + Meq;
+    let Vu=gEH_ls*VEH_ls+(L.LL?L.LL*VLS_ls:0)+gES_ls*VES_ls+HgirdPerFt + Veq;
+    if(qCl>0){ Mu+=MCS_ls; Vu+=VCS_ls; }
@@ -2416,2 +2533,2 @@ function computeAll(){
-    if(!stemGov||Mu>stemGov.Mu) stemGov={Mu,Vu,HgirdPerFt,MeccPerFt,Pv,Meq,ls:lsName,gDCe,gDWe,llE,eccMin,gEH:gEH_ls,
-      lbl:`${gEH_ls.toFixed(2)}·EH${esQ>0?` + ${gES_ls.toFixed(2)}·ES`:""}${L.LL?` + ${L.LL.toFixed(2)}·(LS,BR)`:""}${L.WS?` + ${L.WS.toFixed(2)}·WS`:""}${L.TU?` + ${L.TU.toFixed(2)}·TU/CR/SH`:""}${L.eq?" + 1.00·EQ":""} + P·e_brg`+(eccMin?` [${gDCe.toFixed(2)}·DC, ${gDWe.toFixed(2)}·DW${L.LL?(llE?", LL reaction on":", no LL reaction"):""}]`:"")+` (${lsName})`};
+    if(!stemGov||Mu>stemGov.Mu) stemGov={Mu,Vu,HgirdPerFt,MeccPerFt,Pv,Meq,ls:lsName,gDCe,gDWe,llE,eccMin,gEH:gEH_ls,MCS:MCS_ls,
+      lbl:`${gEH_ls.toFixed(2)}·EH${esQ>0?` + ${gES_ls.toFixed(2)}·ES`:""}${L.LL?(L.mLL&&L.mLL!==1&&!L.noSuper?` + ${L.LL.toFixed(2)}·LS + ${(L.LL*L.mLL).toFixed(2)}·BR`:` + ${L.LL.toFixed(2)}·(LS,BR)`):""}${qCl>0?` + ${L.CL.toFixed(2)}·CS`:""}${L.WS?` + ${L.WS.toFixed(2)}·WS`:""}${L.TU?` + ${L.TU.toFixed(2)}·TU/CR/SH`:""}${L.eq?" + 1.00·EQ":""} + P·e_brg`+(eccMin?` [${gDCe.toFixed(2)}·DC, ${gDWe.toFixed(2)}·DW${L.LL?(llE?", LL reaction on":", no LL reaction"):""}]`:"")+` (${lsName})`};
@@ -2419 +2536 @@ function computeAll(){
-  const HgirdSvc=(groups.BR.Hx+groups.TU.Hx+groups.CRSH.Hx+wsFsv*groups.WS.Hx+groups.WL.Hx)/Lab;
+  const HgirdSvc=(groups.BR.Hx*(LIMITS["Service I"].mLL||1)+groups.TU.Hx+groups.CRSH.Hx+wsFsv*groups.WS.Hx+groups.WL.Hx)/Lab;   // OWNB: m on BR (Service I)
@@ -2440,2 +2557,3 @@ function computeAll(){
-    const wDn=gEV*wS+gDC*wFoot+gLS*wL+gES*esQ;
-    return {gEV,gDC,gLS,gES,wDn, MheelDn:wDn*g.Lheel*g.Lheel/2+(cc?0:gEV*wedgeM), VheelDn:wDn*g.Lheel+(cc?0:gEV*wedgeV)}; }
+    const gCS=cc? (gs.CSvC||0) : 0;   // OWNB: construction surcharge over the heel
+    const wDn=gEV*wS+gDC*wFoot+gLS*wL+gES*esQ+(gCS>0?gCS*R.constrC.qC:0);
+    return {gEV,gDC,gLS,gES,gCS,wDn, MheelDn:wDn*g.Lheel*g.Lheel/2+(cc?0:gEV*wedgeM), VheelDn:wDn*g.Lheel+(cc?0:gEV*wedgeV)}; }
@@ -2449 +2567 @@ function computeAll(){
-    const gTd=ls=>(LIMITS[ls]&&!LIMITS[ls].perm)? 1.0 : 0.9;   // toe self-weight (DC, relieving): γp min 0.90; EEP: Extreme Event I 1.00 [T.3.4.1-1]
+    const gTd=ls=>(LIMITS[ls]&&!LIMITS[ls].perm)? 1.0 : 0.9*etaMin;   // toe self-weight (DC, relieving): γp min 0.90 (×1/η, OWNB); EEP: Extreme Event I 1.00 [T.3.4.1-1]
@@ -2480 +2598 @@ function computeAll(){
-    const gTd=ls=>(LIMITS[ls]&&!LIMITS[ls].perm)? 1.0 : 0.9;   // toe self-weight (DC, relieving): γp min 0.90; EEP: Extreme Event I 1.00 [T.3.4.1-1]
+    const gTd=ls=>(LIMITS[ls]&&!LIMITS[ls].perm)? 1.0 : 0.9*etaMin;   // toe self-weight (DC, relieving): γp min 0.90 (×1/η, OWNB); EEP: Extreme Event I 1.00 [T.3.4.1-1]
@@ -2572,0 +2691,4 @@ function computeAll(){
+  // OWNB: MassDOT 3.3.2.2 (spread footings): heel top steel for the dead load of everything above the heel incl. the heel, no live load,
+  // load and resistance factors 1.0, no upward pressure relief: M_DL ≤ 1.0·M_n (an additional check; the AASHTO heel check above stays)
+  if(abutOwner()==="MassDOT" && fn.branch==="spread"){ const c=R.checks.heelFlex, wDL=wSoilHeel+wFoot+esQ, MDL=wDL*g.Lheel*g.Lheel/2+wedgeM, Mn=c.As*m.fy*(c.d-c.a/2)/12;
+    R.checks.heelMass={MDL, Mn, dc:MDL/Mn, wDL, wSoil:wSoilHeel, wFoot, esQ, wedgeM}; }
@@ -2673,3 +2795,4 @@ function computeAll(){
-      const SI=GP.DC[1]*S.rx.DC[i].P+GP.DW[1]*S.rx.DW[i].P+(+F.llS1)*S.rx.LL[i].P;
-      const SV=GP.DC[1]*S.rx.DC[i].P+GP.DW[1]*S.rx.DW[i].P+(+F.llS5)*S.rx.LL[i].P
-               +(+F.wsS5)*wsF5*S.rx.WS[i].P+(+F.wlS5)*S.rx.WL[i].P;
+      const L1=LIMITS["Strength I"], L5=LIMITS["Strength V"];   // γ×η and m (OWNB); = the factors of panel I-8 for the AASHTO owner
+      const SI=GP.DC[1]*S.rx.DC[i].P+GP.DW[1]*S.rx.DW[i].P+L1.LL*L1.mLL*S.rx.LL[i].P;
+      const SV=GP.DC[1]*S.rx.DC[i].P+GP.DW[1]*S.rx.DW[i].P+L5.LL*L5.mLL*S.rx.LL[i].P
+               +L5.WS*S.rx.WS[i].P+L5.WL*S.rx.WL[i].P;
@@ -2802,2 +2925,3 @@ function computeAll(){
-    const fLL = isLS?Lst.LL:one("LL");
-    const fBR = isLS?Lst.LL:one("BR");
+    const fLL = isLS?Lst.LL*(Lst.mLL||1):one("LL");   // OWNB: m on the LL reaction and BR
+    const fBR = isLS?Lst.LL*(Lst.mLL||1):one("BR");
+    const fCS = (isLS&&Lst.noSuper)?(Lst.CL||0):0, qCv=R.constrC.qC;   // OWNB: construction surcharge
@@ -2819,3 +2943,3 @@ function computeAll(){
-        w.push(fEH*kah*gam*Math.max(0,Hs-e) + (e<=Hs? fLS*kah*gam*heqL + fES*kah*esQv : 0)); }
-      const Vtop=fEH*kah*gam*hAbove*hAbove/2 + (fLS*kah*gam*heqL+fES*kah*esQv)*hAbove;
-      const Mtop=fEH*kah*gam*Math.pow(hAbove,3)/6 + (fLS*kah*gam*heqL+fES*kah*esQv)*hAbove*hAbove/2;
+        w.push(fEH*kah*gam*Math.max(0,Hs-e) + (e<=Hs? fLS*kah*gam*heqL + fES*kah*esQv + (fCS>0?fCS*kah*qCv:0) : 0)); }
+      const Vtop=fEH*kah*gam*hAbove*hAbove/2 + (fLS*kah*gam*heqL+fES*kah*esQv+(fCS>0?fCS*kah*qCv:0))*hAbove;
+      const Mtop=fEH*kah*gam*Math.pow(hAbove,3)/6 + (fLS*kah*gam*heqL+fES*kah*esQv+(fCS>0?fCS*kah*qCv:0))*hAbove*hAbove/2;
@@ -2877 +3001 @@ function computeAll(){
-    return { DC:L.perm?(L.dcMax||GP.DC[1]):1, DW:ns*(L.perm?GP.DW[1]:1), LL:ns*L.LL, EV:L.perm?GP.EV[1]:1,
+    return { DC:L.perm?(L.dcMax||GP.DC[1]):1, DW:ns*(L.perm?GP.DW[1]:1), LL:ns*L.LL*(L.mLL||1), EV:L.perm?GP.EV[1]:1,
@@ -2879 +3003 @@ function computeAll(){
-      BR:ns*L.LL, TU:ns*L.TU, CRSH:ns*L.CR, WS:ns*L.WS, WL:ns*L.WL, ns };
+      BR:ns*L.LL*(L.mLL||1), TU:ns*L.TU, CRSH:ns*L.CR, WS:ns*L.WS, WL:ns*L.WL, ns };
@@ -2964 +3088,7 @@ function computeAll(){
-    const s=JSON.stringify(Object.assign({},S,{ui:undefined, own:abutOwner()==="AASHTO"?undefined:S.own}));   // OWNA: owner AASHTO leaves the Input ID unchanged
+    const fpS=JSON.parse(JSON.stringify(Object.assign({},S,{ui:undefined, own:abutOwner()==="AASHTO"?undefined:S.own})));   // OWNA: owner AASHTO leaves the Input ID unchanged
+    if(fpS.soil&&fpS.soil.Kmode==="active") delete fpS.soil.Kmode;              // OWNB: new inputs at their default leave it unchanged too
+    if(fpS.factors&&fpS.factors.gpEHmaxR===1.35) delete fpS.factors.gpEHmaxR;
+    if(fpS.constr&&fpS.constr.qC===0) delete fpS.constr.qC;
+    if(fpS.constr&&fpS.constr.gC===1.5) delete fpS.constr.gC;
+    if(fpS.reinf&&fpS.reinf.coatBW===false) delete fpS.reinf.coatBW;
+    const s=JSON.stringify(fpS);
@@ -3007,0 +3138 @@ function computeAll(){
+  if(R.checks.heelMass) addD("heelMass","Heel flexure — MassDOT 3.3.2.2 (dead load, γ = φ = 1.0)",R.checks.heelMass.dc,"tab-struct","1.0·(soil + heel + ES) above the heel; no LL; no upward relief");   // OWNB
@@ -3071 +3202 @@ const DASH_ANCHOR={sliding:"o-slide",ecc:"o-ecc",bearing:"o-brg",seat:"o-seat",
-  heelFlex:"o-str-Heel",heelShear:"o-str-Heel",heelFlexMin:"o-str-Heel",heelFlexCrack:"o-str-Heel"};
+  heelFlex:"o-str-Heel",heelShear:"o-str-Heel",heelMass:"o-str-Heel",heelFlexMin:"o-str-Heel",heelFlexCrack:"o-str-Heel"};
@@ -3139 +3270 @@ const OWN_ST={pass:["pass","PASS"],fail:["fail","FAIL"],warn:["warn","CHECK"],ad
-const OWN_KIND={"shall-check":"Shall","should-warning":"Should","advisory":"Advisory","note":"Note","pending-reference":"Pending reference"};
+const OWN_KIND={"shall-check":"Shall","should-warning":"Should","advisory":"Advisory","note":"Note","pending-reference":"Pending reference","default":"Default (editable)","load":"Load rule (applied)"};
@@ -3149 +3280 @@ function ownerPanelHTML(R){
-  return panel("o-owner","1.0a","Owner Requirements — "+esc(m.short)+head,`<div class="note-box">Owner: <b>${esc(m.manual)}</b>, written to AASHTO LRFD ${esc(m.aashto)}; the calculation follows AASHTO LRFD 10th Ed. (2024) with these owner rules checked on top. Requirements are paraphrased; the section and page cite the owner manual. Shall = pass/fail; Should = a warning; Advisory = the owner value beside the value in use (no result changes in this version); Pending reference = the owner document that sets it is not available. Values are worked in the row or in the linked panel.</div>${t}`);
+  return panel("o-owner","1.0a","Owner Requirements — "+esc(m.short)+head,`<div class="note-box">Owner: <b>${esc(m.manual)}</b>, written to AASHTO LRFD ${esc(m.aashto)}; the calculation follows AASHTO LRFD 10th Ed. (2024) with these owner rules checked on top. Requirements are paraphrased; the section and page cite the owner manual. Shall = pass/fail; Should = a warning; Advisory = the owner value beside the value in use; Default = an owner value of an input (applied when the owner is chosen while the input held the previous default; a value you entered is kept and flagged); Load rule = applied in the calculation (worked in Tab 2 §2.0a); Pending reference = the owner document that sets it is not available. Values are worked in the row or in the linked panel.${OWN_LAST&&OWN_LAST.owner===O.owner&&(OWN_LAST.set.length||OWN_LAST.kept.length)?`<br><b>Last change:</b> ${OWN_LAST.set.length?"set to the owner default — "+OWN_LAST.set.map(ownDefLabel).join(", "):""}${OWN_LAST.set.length&&OWN_LAST.kept.length?"; ":""}${OWN_LAST.kept.length?"your values kept — "+OWN_LAST.kept.map(ownDefLabel).join(", "):""}.`:""}</div>${t}`);
@@ -3160 +3291 @@ function renderTabLoads(R){
-    <b>1.</b> Earth pressure: <b>${S.soil.method==="rankine"?"Rankine":"Coulomb"}</b> active theory on the vertical plane through the heel end; at-rest K₀ not used (free-standing cantilever) [3.11.5]. Valid for β &lt; φ and a wall free to translate/rotate.<br>
+    <b>1.</b> Earth pressure: ${R.Ksel&&R.Ksel.eff!=="active"?`<b>${R.Ksel.eff==="atrest"?"at-rest K₀ = 1 − sin φ":"0.5(K₀ + K<sub>a</sub>)"}</b>${R.Ksel.mode==="massdot"?" by the MassDOT 3.1.6 rule":""} on the vertical plane through the heel end (Tab 1 §1.3) [3.11.5.2]${R.Ksel.eff==="blend"?"; K<sub>a</sub> by "+(S.soil.method==="rankine"?"Rankine":"Coulomb"):""}.`:`<b>${S.soil.method==="rankine"?"Rankine":"Coulomb"}</b> active theory on the vertical plane through the heel end; at-rest K₀ not used (free-standing cantilever) [3.11.5]. Valid for β &lt; φ and a wall free to translate/rotate.`}<br>
@@ -3206 +3337 @@ function renderTabLoads(R){
-       `k_a = ${fmtT(R.ka,4)}`]
+       `k_a = ${fmtT(R.Ksel?R.Ksel.Ka:R.ka,4)}`]
@@ -3209 +3340,9 @@ function renderTabLoads(R){
-       `k_a = ${fmtT(R.ka,4)}`];
+       `k_a = ${fmtT(R.Ksel?R.Ksel.Ka:R.ka,4)}`];
+  const KS=R.Ksel||{eff:"active"}, kS=KS.eff==="active"?"k_a":"K";   // OWNB: symbol of the coefficient in use
+  const kSelEq=KS.eff==="active"?"":eqB(`Earth pressure state — ${KS.eff==="atrest"?"at-rest":"0.5(K₀ + K<sub>a</sub>)"}${KS.mode==="massdot"?" (MassDOT 3.1.6 rule: "+(S.fnd.branch==="pile"?"pile-supported":S.fnd.matl==="rock"?"on rock":"on soil, H = "+fmt(geo.H,2)+" ft ≤ 5 ft")+")":""}`,KS.mode==="massdot"?"AASHTO 3.11.5.2, Eq. 3.11.5.2-1; MassDOT Part I 3.1.6":"AASHTO 3.11.5.2, Eq. 3.11.5.2-1",[
+      "K_0 = 1-\\sin\\varphi_f",
+      `K_0 = 1-\\sin${fmtT(s.phi,1)}° = ${fmtT(KS.K0,4)}`].concat(KS.eff==="atrest"?[
+      `K = K_0 = ${fmtT(KS.K0,4)}\\quad(\\text{horizontal},\\ \\iota = 0)`]:[
+      `K_h = \\tfrac{1}{2}(K_0 + k_a\\cos\\iota_a) = \\tfrac{1}{2}(${fmtT(KS.K0,4)} + ${fmtT(KS.Ka,4)}\\cos${fmtT(KS.iotaA,1)}°) = ${fmtT(KS.K*Math.cos(deg2rad(KS.iota)),4)}`,
+      `K_v = \\tfrac{1}{2}k_a\\sin\\iota_a = ${fmtT(KS.K*Math.sin(deg2rad(KS.iota)),4)}\\,;\\quad K = \\sqrt{K_h^2+K_v^2} = ${fmtT(KS.K,4)},\\ \\iota = ${fmtT(KS.iota,2)}°`]),
+      `K replaces k_a below and in the surcharge LS, ES and the construction stage. ${KS.eff==="atrest"?`γ<sub>EH</sub> max = ${fmt(+S.factors.gpEHmaxR,2)} (at-rest) [T.3.4.1-2].`:"γ<sub>EH</sub> max as active."} The Extreme Event I M–O increment is taken over the active resultant and added to this static pressure.`);
@@ -3213,3 +3352,3 @@ function renderTabLoads(R){
-      `P_1 = \\tfrac{1}{2}k_a\\gamma d_1^2 = \\tfrac{1}{2}(${fmtT(R.ka,4)})(${fmtT(s.gamma,3)})(${fmtT(E.d1)})^2 = ${fmtT(E.P1)}\\ \\text{kip/ft at } z=${fmtT(E.z1)}\\ \\text{ft}`,
-      `P_2 = k_a\\gamma d_1 h_{w} = (${fmtT(R.ka,4)})(${fmtT(s.gamma,3)})(${fmtT(E.d1)})(${fmtT(E.hwE)}) = ${fmtT(E.P2)}\\ \\text{kip/ft at } z=${fmtT(E.z2)}\\ \\text{ft}`,
-      `P_3 = \\tfrac{1}{2}k_a(\\gamma-\\gamma_w) h_{w}^2 = \\tfrac{1}{2}(${fmtT(R.ka,4)})(${fmtT(s.gamma-GAMMA_W,4)})(${fmtT(E.hwE)})^2 = ${fmtT(E.P3)}\\ \\text{kip/ft at } z=${fmtT(E.z3)}\\ \\text{ft}`,
+      `P_1 = \\tfrac{1}{2}${kS}\\gamma d_1^2 = \\tfrac{1}{2}(${fmtT(R.ka,4)})(${fmtT(s.gamma,3)})(${fmtT(E.d1)})^2 = ${fmtT(E.P1)}\\ \\text{kip/ft at } z=${fmtT(E.z1)}\\ \\text{ft}`,
+      `P_2 = ${kS}\\gamma d_1 h_{w} = (${fmtT(R.ka,4)})(${fmtT(s.gamma,3)})(${fmtT(E.d1)})(${fmtT(E.hwE)}) = ${fmtT(E.P2)}\\ \\text{kip/ft at } z=${fmtT(E.z2)}\\ \\text{ft}`,
+      `P_3 = \\tfrac{1}{2}${kS}(\\gamma-\\gamma_w) h_{w}^2 = \\tfrac{1}{2}(${fmtT(R.ka,4)})(${fmtT(s.gamma-GAMMA_W,4)})(${fmtT(E.hwE)})^2 = ${fmtT(E.P3)}\\ \\text{kip/ft at } z=${fmtT(E.z3)}\\ \\text{ft}`,
@@ -3218,2 +3357,2 @@ function renderTabLoads(R){
-    ehLayers=eqB("Active earth pressure resultant (per unit length)","AASHTO 3.11.5.1",[
-      "P_a = \\tfrac{1}{2}\\,k_a\\,\\gamma\\,H^2",
+    ehLayers=eqB((KS.eff==="active"?"Active":"Lateral")+" earth pressure resultant (per unit length)","AASHTO 3.11.5.1",[
+      `P_a = \\tfrac{1}{2}\\,${kS}\\,\\gamma\\,H^2`,
@@ -3225 +3364 @@ function renderTabLoads(R){
-    ${eqB(`Active coefficient — ${s.method==="rankine"?"Rankine":"Coulomb"}`,s.method==="coulomb"?"AASHTO 3.11.5.3, Eq. 3.11.5.3-1":"AASHTO C3.11.5.3 (Rankine)",kaEq)}
+    ${eqB(`Active coefficient — ${s.method==="rankine"?"Rankine":"Coulomb"}${KS.eff==="atrest"?" (shown for reference; at-rest K₀ is used)":""}`,s.method==="coulomb"?"AASHTO 3.11.5.3, Eq. 3.11.5.3-1":"AASHTO C3.11.5.3 (Rankine)",kaEq)}
@@ -3230,0 +3370 @@ function renderTabLoads(R){
+    ${kSelEq}
@@ -3236 +3376 @@ function renderTabLoads(R){
-      "Horizontal component drives sliding/overturning; the vertical component adds to resisting vertical load. Both carry the EH load factor. At-rest K₀ is not used for this free-standing cantilever [3.11.5.2].")}
+      "Horizontal component drives sliding/overturning; the vertical component adds to resisting vertical load. Both carry the EH load factor."+(KS.eff==="active"?" At-rest K₀ is not used for this free-standing cantilever [3.11.5.2] (earth pressure state: panel I-3).":""))}
@@ -3244 +3384 @@ function renderTabLoads(R){
-      `Table points in use: H = 5 ft → ${fmt(+s.heq5,1)} ft; 10 ft → ${fmt(+s.heq10,1)} ft; ≥ 20 ft → ${fmt(+s.heq20,1)} ft (editable in panel I-3).`)}
+      `Table points in use: H = 5 ft → ${fmt(+s.heq5,1)} ft; 10 ft → ${fmt(+s.heq10,1)} ft; ≥ 20 ft → ${fmt(+s.heq20,1)} ft (editable in panel I-3).`+(R.ownLoad&&R.ownLoad.lsMin>0?` Owner minimum (CTDOT BRSDM V2 3.11.6.4): h<sub>eq</sub> = max(table, ${fmt(R.ownLoad.lsMin,1)} ft)${interpHeq0(geo.H)<R.ownLoad.lsMin?` — the table gives ${fmt(interpHeq0(geo.H),2)} ft, raised to ${fmt(R.ownLoad.lsMin,2)} ft`:""}.`:""))}
@@ -3246 +3386 @@ function renderTabLoads(R){
-      "p_{LS} = k_a\\,\\gamma\\,h_{eq}",
+      `p_{LS} = ${R.Ksel&&R.Ksel.eff!=="active"?"K":"k_a"}\\,\\gamma\\,h_{eq}`,
@@ -3252 +3392 @@ function renderTabLoads(R){
-    ${R.passive.on?eqB("Passive resistance at toe (ENABLED)","AASHTO 3.11.5.4, 10.6.3.4",[
+    ${R.passive.on?eqB("Passive resistance at toe (ENABLED"+(R.ownLoad&&R.ownLoad.passEE?"; Extreme Event I only, RIDOT BDM 10.4.3 / 10.4.4":"")+")","AASHTO 3.11.5.4, 10.6.3.4",[
@@ -3335,0 +3476,26 @@ function renderTabLoads(R){
+/* ---- OWNB: owner load rules worked (η, design load multiplier m, construction surcharge, passive at Extreme Event, h_eq minimum) ---- */
+function ownLoadPanelHTML(R){
+  const OL=R.ownLoad, qc=R.constrC&&R.constrC.qC;
+  if(!OL||(OL.owner==="AASHTO"&&!(qc>0))) return "";
+  const m=ABUT_OWN.owners[OL.owner], L1=R.LIMITS["Strength I"], LC=R.LIMITS["Constr — Str I"], F=S.factors;
+  let b="";
+  if(OL.owner==="RIDOT") b+=eqB("Load modifier η (strength limit states)","AASHTO 1.3.2.1 (Eqs. 1.3.2.1-2, -3); RIDOT BDM 1.3.1–1.3.3",[
+      `\\eta_i = \\eta_D\\,\\eta_R\\,\\eta_I = (1.00)(1.00)(${fmtT(OL.eta)}) = ${fmtT(OL.eta)}\\quad(\\gamma\\ \\text{max}),\\qquad \\eta_i = 1/${fmtT(OL.eta)} = ${fmtT(OL.etaMin,4)}\\quad(\\gamma\\ \\text{min})`,
+      `\\text{e.g. Strength I: } \\eta\\gamma_{DC,max} = ${fmtT(OL.eta)}(${fmtT(+F.gpDCmax)}) = ${fmtT(R.GP.DC[1],4)},\\ \\eta\\gamma_{LL} = ${fmtT(OL.eta)}(${fmtT(+F.llS1)}) = ${fmtT(L1.LL,4)},\\ \\gamma_{DC,min}/\\eta = ${fmtT(+F.gpDCmin)}/${fmtT(OL.eta)} = ${fmtT(R.GP.DC[0],4)}`],
+      OL.hasADT?`η<sub>I</sub> = ${fmt(OL.eta,2)} for ADT = ${fmt(OL.adt,0)} (${OL.adt>=5000?"≥":"&lt;"} 5000, panel I-0); η<sub>D</sub> = η<sub>R</sub> = 1.00 (ductile, redundant). Applied to every load factor of Strength I, III, V and the construction stage; Service I and Extreme Event I use η = 1.00.`:"<b>ADT not entered (panel I-0): η = 1.00 is used.</b> RIDOT sets η<sub>I</sub> = 1.05 for ADT ≥ 5000.");
+  if(OL.m!==1) b+=eqB("Design load multiplier m on the girder LL+IM reaction and BR","RIDOT BDM 3.4.1.2"+(OL.owner==="RIDOT"?"":" (owner value entered in panel I-0)"),[
+      `\\text{Strength I: } \\gamma_{LL}\\,m = ${fmtT(L1.LL)}(${fmtT(OL.m)}) = ${fmtT(L1.LL*OL.m)}\\ \\text{on LL and BR};\\quad \\gamma_{LL} = ${fmtT(L1.LL)}\\ \\text{on LS}`,
+      `\\text{Strength V: } ${fmtT(R.LIMITS["Strength V"].LL)}(${fmtT(OL.m)}) = ${fmtT(R.LIMITS["Strength V"].LL*OL.m)};\\quad \\text{Service I: } 1.00(${fmtT(OL.m)}) = ${fmtT(OL.m)}`],
+      "Applied to the vehicular force effects carried from the superstructure (the HL-93 girder reaction and braking) at Strength I, III, V and Service I, in every check (stability, bearing, piles, stem, footing, seat). Not applied to the live-load surcharge LS (a 3.11.6.4 surcharge, not the HL-93 vehicle on the bridge), to Extreme Event I or to the construction stage. Where the reaction relieves a check (sliding, overturning, pile uplift) the permutations with the LL reaction off govern, so the multiplier is removed there as the BDM requires.");
+  if(qc>0){ const K=R.ka, ci=Math.cos(deg2rad(R.iota)), hc=R.constrC.hcC, g=S.geom;
+    b+=eqB("Construction surcharge q_c — construction stage (no superstructure)","AASHTO 3.4.2.1, 3.11.6.1"+(OL.owner==="RIDOT"?"; RIDOT BDM 3.2.2":""),[
+      `P_{CS,h} = K\\,q_c\\,h_c\\cos\\iota\\,L_{ab} = (${fmtT(K,4)})(${fmtT(qc,3)})(${fmtT(hc)})(${fmtT(ci,4)})(${fmtT(g.Lab)}) = ${fmtT(R.groups.CShC?R.groups.CShC.Hx:0)}\\ \\text{kip at } h_c/2 = ${fmtT(hc/2)}\\ \\text{ft}`,
+      `P_{CS,v} = q_c\\,L_{heel}\\,L_{ab} = (${fmtT(qc,3)})(${fmtT(g.Lheel)})(${fmtT(g.Lab)}) = ${fmtT(R.groups.CSvC?R.groups.CSvC.V:0)}\\ \\text{kip over the heel}`,
+      `\\gamma_c = ${fmtT(+S.constr.gC)}${OL.eta!==1?`\\times${fmtT(OL.eta)}`:""} = ${fmtT(LC.CL)}`],
+      `h<sub>c</sub> = t<sub>f</sub> + construction fill = ${fmt(hc,2)} ft. Taken as a live load of the construction stage ("Constr — Str I"): on or off in the permutations; the vertical part is left out where it would help sliding and eccentricity. Also in the stem (§5.2) and heel demands of that stage.`); }
+  if(OL.passEE) b+=`<div class="note-box"><b>Passive resistance (RIDOT BDM 10.4.3, 10.4.4):</b> ${S.fnd.branch==="spread"&&S.fnd.usePassive?"enabled in panel I-4 — used in sliding at Extreme Event I only, not at the strength limit states (Tab 3 §3.1).":"not used (panel I-4); if enabled, it enters Extreme Event I only."}</div>`;
+  if(OL.lsMin>0) b+=`<div class="note-box"><b>Live-load surcharge minimum (CTDOT BRSDM V2 3.11.6.4):</b> h<sub>eq</sub> = max(table value, ${fmt(OL.lsMin,1)} ft) wherever h<sub>eq</sub> is used (wall, stem, backwall, construction stage); see Tab 1 §1.4.</div>`;
+  return panel("o-ownload","2.0a","Owner Load Rules"+(OL.owner==="AASHTO"?" & Construction Surcharge":" — "+esc(m.short)),
+    `<div class="eq-note">${OL.owner==="AASHTO"?"Construction surcharge entered in panel I-3.":"Owner rules applied in the calculation; the owner requirements and defaults are listed in Tab 1 §1.0a."}</div>${b||'<div class="note-box">No owner load rule changes a factor for this owner.</div>'}`);
+}
+
@@ -3346,0 +3513 @@ function renderTabComb(R){
+  h+=ownLoadPanelHTML(R);
@@ -3359 +3526 @@ function renderTabComb(R){
-    `<div class="note-box">γ<sub>p</sub> values show max / min. BR and LS carry the live-load factor. TU uses γ<sub>TU</sub> = ${fmt(+F.gTU)} for strength force effects (1.20 applies to displacements) [T.3.4.1-6]; CR/SH use γ = ${fmt(+F.gCR)} (concrete substructure under a non-segmental superstructure) [T.3.4.1-3].</div>`);
+    `<div class="note-box">${R.ownLoad&&(R.ownLoad.eta!==1||R.ownLoad.m!==1)?`<b>Owner load rules included (Tab 2 §2.0a):</b> ${R.ownLoad.eta!==1?`strength factors × η = ${fmt(R.ownLoad.eta,2)} (γ<sub>p</sub> min × 1/η); `:""}${R.ownLoad.m!==1?`the LL+IM reaction and BR × m = ${fmt(R.ownLoad.m,2)} at Strength I, III, V and Service I (the LL/BR/LS column shows γ before m). `:""}<br>`:""}γ<sub>p</sub> values show max / min. BR and LS carry the live-load factor. TU uses γ<sub>TU</sub> = ${fmt(+F.gTU)} for strength force effects (1.20 applies to displacements) [T.3.4.1-6]; CR/SH use γ = ${fmt(+F.gCR)} (concrete substructure under a non-segmental superstructure) [T.3.4.1-3].</div>`);
@@ -3439 +3606 @@ function renderTabStab(R){
-          `R_R = \\varphi_\\tau R_n${R.passive.on?" + \\varphi_{ep}P_p":""} = (${fmtT(sl.phiTau??fn.phiTau)})(${fmtT(sl.Rn)})${R.passive.on?` + (${fmtT(fn.phiEP)})(${fmtT(R.passive.Pp)})`:""} = ${fmtT(sl.RR)}\\ \\text{kip}`])
+          `R_R = \\varphi_\\tau R_n${(sl.pUsed??R.passive.on)?" + \\varphi_{ep}P_p":""} = (${fmtT(sl.phiTau??fn.phiTau)})(${fmtT(sl.Rn)})${(sl.pUsed??R.passive.on)?` + (${fmtT(fn.phiEP)})(${fmtT(R.passive.Pp)})`:""} = ${fmtT(sl.RR)}\\ \\text{kip}`])
@@ -3447 +3614,2 @@ function renderTabStab(R){
-        ...(R.passive.on?[["\\varphi_{ep}P_p","Factored passive resistance",fn.phiEP*R.passive.Pp,"kip"]]:[])])}
+        ...((sl.pUsed??R.passive.on)?[["\\varphi_{ep}P_p","Factored passive resistance",fn.phiEP*R.passive.Pp,"kip"]]:[])])}
+      ${R.passive.on&&!sl.pUsed&&R.ownLoad&&R.ownLoad.passEE?`<div class="note-box">Passive resistance is not used in ${esc(sl.ls)}: RIDOT BDM 10.4.3 excludes it at the strength limit states (it enters Extreme Event I only, 10.4.4).</div>`:""}
@@ -3759,2 +3927,2 @@ function sectionHTML(c, demHTML, secNo, title){
-      `\\ell_d = \\max\\!\\left(\\ell_{db}\\,\\lambda_{rl}\\lambda_{cf}\\lambda_{rc},\\ 12\\right) = \\max\\!\\left(${fmtT(c.ldb,1)}(1.0)(1.0)(1.0),\\ 12\\right) = ${fmtT(c.ld,1)}\\ \\text{in}`],
-      "S&T applies to exposed faces not otherwise reinforced. Development length per AASHTO LRFD 10th Ed. 5.10.8.2.1a for a straight bar (F_h = 0) in normal weight concrete, with λ_er, λ_rl, λ_cf and λ_rc all taken as 1.0 (λ_rc = 1.0 is its upper bound; no confinement credit) — confirm hooks/embedment in detailing.")}
+      `\\ell_d = \\max\\!\\left(\\ell_{db}\\,\\lambda_{rl}\\lambda_{cf}\\lambda_{rc},\\ 12\\right) = \\max\\!\\left(${fmtT(c.ldb,1)}(1.0)(${fmtT(c.lamCf??1,1)})(1.0),\\ 12\\right) = ${fmtT(c.ld,1)}\\ \\text{in}`],
+      ((c.lamCf??1)>1?`Epoxy-coated bars (panel I-9${abutOwner()==="MassDOT"?"; MassDOT Part I 3.3.1.6":""}): λ<sub>cf</sub> = ${fmt(c.lamCf,1)} [5.10.8.2.1b] — cover ${fmt(c.cvE,2)} in ${c.cvE<3*BARS[c.bar].db?"&lt;":"≥"} 3d<sub>b</sub> = ${fmt(3*BARS[c.bar].db,2)} in, clear spacing ${fmt(c.sp-BARS[c.bar].db,2)} in ${(c.sp-BARS[c.bar].db)<6*BARS[c.bar].db?"&lt;":"≥"} 6d<sub>b</sub> = ${fmt(6*BARS[c.bar].db,2)} in. `:"")+"S&T applies to exposed faces not otherwise reinforced. Development length per AASHTO LRFD 10th Ed. 5.10.8.2.1a for a straight bar (F_h = 0) in normal weight concrete, with λ_er, λ_rl"+((c.lamCf??1)>1?"":", λ_cf")+" and λ_rc taken as 1.0 (λ_rc = 1.0 is its upper bound; no confinement credit) — confirm hooks/embedment in detailing.")}
@@ -3773 +3941 @@ function renderTabStruct(R){
-      `M_u = ${fmtT(R.GP.EH[1])}(${fmtT(bd.Mbw_EH)}) + ${fmtT(+S.factors.llS1)}(${fmtT(bd.Mbw_LS)}) = ${fmtT(bd.MuBW)}\\ \\text{kip-ft/ft}\\,, \\qquad V_u = ${fmtT(bd.VuBW)}\\ \\text{kip/ft}`],
+      `M_u = ${fmtT(R.GP.EH[1])}(${fmtT(bd.Mbw_EH)}) + ${fmtT(bd.gLS??+S.factors.llS1)}(${fmtT(bd.Mbw_LS)}) = ${fmtT(bd.MuBW)}\\ \\text{kip-ft/ft}\\,, \\qquad V_u = ${fmtT(bd.VuBW)}\\ \\text{kip/ft}`],
@@ -3781 +3949,2 @@ function renderTabStruct(R){
-      `M_u = ${fmtT(sd.gEH??R.GP.EH[1])}\\,M_{EH} + \\gamma_{LL}M_{LS} + H_{gird}\\,h_{stem} + M_{ecc} = ${fmtT(sd.Mu)}\\ \\text{kip-ft/ft}\\,, \\qquad V_u = ${fmtT(sd.Vu)}\\ \\text{kip/ft}`,
+      `M_u = ${fmtT(sd.gEH??R.GP.EH[1])}\\,M_{EH} + \\gamma_{LL}M_{LS} + H_{gird}\\,h_{stem} + M_{ecc}${sd.MCS>0?" + \\gamma_c M_{CS}":""} = ${fmtT(sd.Mu)}\\ \\text{kip-ft/ft}\\,, \\qquad V_u = ${fmtT(sd.Vu)}\\ \\text{kip/ft}`,
+      ...(sd.MCS>0?[`\\gamma_c M_{CS} = \\gamma_c\\dfrac{K_h\\,q_c\\,H_s^2}{2} = ${fmtT(R.LIMITS["Constr — Str I"].CL)}\\dfrac{(${fmtT(kah,4)})(${fmtT(R.constrC.qC,3)})(${fmtT(Math.min(R.constrC.hfC,sd.Hs))})^2}{2} = ${fmtT(sd.MCS)}\\ \\text{kip-ft/ft (construction surcharge, Tab 2 §2.0a)}`]:[]),
@@ -3807 +3976,8 @@ function renderTabStruct(R){
-  h+=sectionHTML(cH, heelDemH, "5.4","Heel — Flexure & Shear ("+hd.face+" reinforcement)");
+  const hmD=R.checks.heelMass;   // OWNB: MassDOT 3.3.2.2 dead-load heel case
+  const heelMassH=hmD? eqB("MassDOT dead-load heel case (top steel) — all dead load above the heel incl. the heel, no live load, γ = φ = 1.0, no upward relief","MassDOT Bridge Manual Part I 3.3.2.2; AASHTO 5.6.3.2",[
+      `w_{DL} = w_{soil} + \\gamma_c t_f + q_{ES} = ${fmtT(hmD.wSoil,3)} + ${fmtT(hmD.wFoot,3)} + ${fmtT(hmD.esQ,3)} = ${fmtT(hmD.wDL,3)}\\ \\text{ksf}`,
+      `M_{DL} = w_{DL}\\dfrac{L_{heel}^2}{2}${hmD.wedgeM>0?" + \\gamma\\,h_{wedge}\\dfrac{L_{heel}^2}{3}":""} = (${fmtT(hmD.wDL,3)})\\dfrac{(${fmtT(g.Lheel)})^2}{2}${hmD.wedgeM>0?` + ${fmtT(hmD.wedgeM)}`:""} = ${fmtT(hmD.MDL)}\\ \\text{kip-ft/ft}`,
+      `M_n = A_s f_y (d - a/2) = (${fmtT(cH.As)})(${fmtT(S.mat.fy,1)})(${fmtT(cH.d)} - ${fmtT(cH.a,3)}/2)/12 = ${fmtT(hmD.Mn)}\\ \\text{kip-ft/ft}`],
+      "An additional check on the heel top steel (the AASHTO strength check above stays). Soil weight per ft² as the heel design above (buoyant below the water table); ES = the permanent earth surcharge over the heel.")
+    + checkLine("Heel flexure — MassDOT 3.3.2.2",`\\dfrac{M_{DL}}{1.0\\,M_n} = \\dfrac{${fmtT(hmD.MDL)}}{${fmtT(hmD.Mn)}}`,hmD.dc) : "";
+  h+=sectionHTML(cH, heelDemH+heelMassH, "5.4","Heel — Flexure & Shear ("+hd.face+" reinforcement)");
@@ -4477 +4653 @@ function perBearingLoads(R, sel){
-  const fLL=isLS?L.LL:one("LL"), fBR=isLS?L.LL:one("BR"), fTU=isLS?L.TU:one("TU");
+  const fLL=isLS?L.LL*(L.mLL||1):one("LL"), fBR=isLS?L.LL*(L.mLL||1):one("BR"), fTU=isLS?L.TU:one("TU");   // OWNB: m
@@ -4833 +5009 @@ function sizingHints(R){
-  const bc=d("bearing"), sl=d("sliding"), pc=d("pileC");
+  const bc=d("bearing"), sl=d("sliding"), pc=d("pileC"), noKey=["MassDOT","CTDOT"].includes(abutOwner());   // OWNB: owners that discourage keys
@@ -4842,2 +5018,2 @@ function sizingHints(R){
-        (hMax>0.5?`Restrict backfill to ≈ ${fmt(hMax,1)} ft above the footing until the superstructure is erected (enter it in panel I-3), or add a shear key / widen the heel.`:
-        `Even minimal backfill fails — revise the footing (shear key, wider heel) before backfilling.`));
+        (hMax>0.5?`Restrict backfill to ≈ ${fmt(hMax,1)} ft above the footing until the superstructure is erected (enter it in panel I-3), or ${noKey?"widen the heel":"add a shear key / widen the heel"}.`:
+        `Even minimal backfill fails — revise the footing (${noKey?"wider heel, lower footing":"shear key, wider heel"}) before backfilling.`));
@@ -4845 +5021,2 @@ function sizingHints(R){
-      out.push(`Sliding D/C ${fmt(sl.dc)} — options: widen the heel (more soil weight), add a shear key, or enable justified passive resistance.`);
+      out.push(noKey?`Sliding D/C ${fmt(sl.dc)} — options: widen the heel (more soil weight), batter piles or lower the footing (${abutOwner()==="MassDOT"?"MassDOT 3.3.1.1: shear keys preferably not used; passive neglected":"CTDOT V2 10.6.3.4: no keys, no passive"}).`
+        :`Sliding D/C ${fmt(sl.dc)} — options: widen the heel (more soil weight), add a shear key, or enable justified passive resistance.`);
@@ -4860 +5037,2 @@ function constrMaxFill(){
-    const D=1.5*0.5*ka*gam*hc*hc*ci*Lab + gLLc*ka*gam*heq*hc*ci*Lab + 1.5*ka*esQ*hc*ci*Lab;
+    const gCS=(R0.LIMITS&&R0.LIMITS["Constr — Str I"]&&R0.LIMITS["Constr — Str I"].CL)||0, qCh=+S.constr.qC||0;   // OWNB: construction surcharge
+    const D=1.5*0.5*ka*gam*hc*hc*ci*Lab + gLLc*ka*gam*heq*hc*ci*Lab + 1.5*ka*esQ*hc*ci*Lab + gCS*ka*qCh*hc*ci*Lab;
@@ -5068,0 +5247 @@ function recalcAll(){
+  ownTagRefresh();
@@ -5112,0 +5292 @@ document.addEventListener("change",ev=>{
+  const ownPre=(p==="own.owner"||p==="longit.material")?ownDefMap():null;   // OWNB: owner defaults before the change
@@ -5120,0 +5301,2 @@ document.addEventListener("change",ev=>{
+  if(ownPre){ const r=ownReapply(ownPre); OWN_LAST={owner:abutOwner(),set:r.set,kept:r.kept};
+    const ss=document.getElementById("saveStatus"); if(ss&&(r.set.length||r.kept.length)) ss.textContent=(r.set.length?"owner defaults applied: "+r.set.map(ownDefLabel).join(", "):"")+(r.kept.length?(r.set.length?"; ":"")+"your values kept: "+r.kept.map(ownDefLabel).join(", "):""); }
@@ -5151,0 +5334 @@ document.addEventListener("click",ev=>{
+    ["longit.dTrise","longit.dTfall","longit.cte"].forEach(k=>{ const d=ownRuleFor(k); if(d) setPath(S,k,ownDefVal(d)); });   // OWNB: the owner's temperature values
@@ -5309 +5492,2 @@ function inputEchoHTML(){
-  let h=(abutOwner()!=="AASHTO"?"<h3>Owner</h3>"+echoRows([["Bridge owner (requirements checked in Tab 1 §1.0a)",ABUT_OWN.owners[abutOwner()].manual,""],["Total bridge length for the integral screening",+S.own.Ltot>0?fmt(+S.own.Ltot):"= span L","ft"],["Bottom of footing below finished grade D_f",fmt(+S.fnd.Df),"ft"]]):"")+"<h3>Geometry</h3>"+echoRows([
+  let h=(abutOwner()!=="AASHTO"?"<h3>Owner</h3>"+echoRows([["Bridge owner (requirements checked in Tab 1 §1.0a)",ABUT_OWN.owners[abutOwner()].manual,""],["Total bridge length for the integral screening",+S.own.Ltot>0?fmt(+S.own.Ltot):"= span L","ft"],["Bottom of footing below finished grade D_f",fmt(+S.fnd.Df),"ft"],
+    ["Design load multiplier m (LL reaction, BR)",fmt(+S.own.mLL||1,2),"–"]].concat(abutOwner()==="RIDOT"?[["ADT (η_I)",S.own.ADT===""?"not entered (η = 1.00)":fmt(+S.own.ADT,0),"veh/day"]]:[])):"")+"<h3>Geometry</h3>"+echoRows([
@@ -5364,0 +5549,4 @@ function inputEchoHTML(){
+  h+="<h3>Earth pressure state & construction surcharge</h3>"+echoRows([
+    ["Earth pressure state",{active:"active Ka",atrest:"at-rest K0 = 1 − sin φ",blend:"0.5(K0 + Ka)",massdot:"MassDOT 3.1.6 rule"}[S.soil.Kmode]||"active Ka",""],
+    ["γEH max at-rest",fmt(+F.gpEHmaxR,2),"–"],
+    ["Construction surcharge q_c / γ_c",fmt(+S.constr.qC||0,3)+" / "+fmt(+S.constr.gC,2),"ksf / –"]]);
@@ -5377,0 +5566 @@ function inputEchoHTML(){
+    ["Backwall bars epoxy coated (λcf)",rf.coatBW?"yes":"no",""],
```

## 2026-10-20 — PR: claude/abut-coulomb — Coulomb on the virtual back by heel length (AASHTO LRFD 10th Ed. C3.11.5.3); MassDOT Coulomb default; RIDOT at-rest on piles / rock (PR link added after merge)

Note: #367 (F50–F58) was merged into `claude/abut-owner-a` after #366 had already been squash-merged to main, so it never reached main. This branch carries it as its first commit (a cherry-pick of `4803548`, unchanged), followed by the changes below.

### F59. Coulomb active coefficient: δ on the virtual back from the heel case (CLMB)   [calc change] [Coulomb option only: MORE conservative with a long heel, unchanged with a short heel]
- **Provision:** AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), 3.11.5.3 (Eqs. 3.11.5.3-1, -2), C3.11.5.3 and Fig. C3.11.5.3-1, p. 3-88 to 3-89. Both cases put the earth pressure on the vertical plane through the heel end:
  - **(a) long heel:** the shear zone from the heel is not cut by the stem. The stress on that plane is the Rankine stress, inclined at β.
  - **(b) short heel:** the stem restricts the sliding surface. Coulomb applies on the same plane, with the soil-on-soil wall friction usually limited to 0.67φ.
  - The real wall back with concrete-on-soil δ is the gravity-wall case of Fig. C3.11.5.3-1b. It is not used for a cantilever abutment.
- **Before:** `computeKa()` (Coulomb) used the input δ (default 17°) on the virtual back in every case. That was earlier review item N11.
- **After:** the heel case is decided from the inner boundary of the Rankine shear zone, using the figure's angle:
  - ε = asin(sin β / sin φ);
  - a = ½(90° + β − φ − ε) from the vertical;
  - s* = H / (cot a + tan β), the distance from the virtual back at which that boundary meets the ground.

  If s* ≤ L_heel (long heel), δ = β, which reproduces Rankine exactly. Otherwise (short heel), δ = the input, now labelled "Friction angle δ on the virtual back (short heel)". A warning appears if that δ is over 0.67φ. The M–O δ follows the same value. The case is worked in Tab 1 §1.3, in a new "Coulomb: heel case" block.
- **Where:** `computeKa()`, anchor `// CLMB (2026-10-20): Coulomb on the vertical plane through the heel end`; `R.coul`; M–O `dMO` (anchor `// CLMB: the δ of the static Coulomb case`); input label of `soil.delta`; Tab 1 §1.3 `coulCase` and the δ row.
- **Check 1 (long heel; built-in project with Coulomb, L_toe 2 ft, L_heel 13 ft, β = 0, φ = 32°, H = 22 ft):**
  - a = ½(90 − 32) = 29°; s* = 22·tan 29° = 12.19 ft ≤ 13 ft, so long heel and δ = 0.
  - Ka = (1 − sin 32°)/(1 + sin 32°) = **0.3073** (before: δ = 17°, 0.2773).
  - EH_h = ½·0.3073·0.120·22²·44 = **392.60 kip**, EH_v 0 (before: 338.90 and 103.61 kip).
  - Sliding D/C 0.534 → **0.651**; stem M_u 100.07 → **112.06**; heel M_u 41.85 → **95.78** kip-ft/ft (the vertical component no longer relieves the heel).
- **Check 2 (long heel, β = 15°):** Coulomb with δ = β gives Ka = **0.3405**. This is identical to the Rankine option on the same project: every result matched, which confirms the equivalence.
- **Check 3 (short heel, built-in project, L_heel 5 ft):** s* = 12.19 ft > 5 ft, so δ = 17° as before.
  - Ka = cos²32° / (cos 17° [1 + √(sin 49° · sin 32° / cos 17°)]²) = 0.7192 / (0.9563 · 2.7116) = **0.2773**.
  - No change. The default project and every short-heel Coulomb project are unchanged.

### F60. Owner defaults: MassDOT Coulomb; RIDOT at-rest on piles / rock   [default change, MassDOT and RIDOT owners only]
- **MassDOT Part I 3.1.6 (p. 3-4):** Ka by Coulomb. New owner default `soil.method` = "coulomb". It is highlighted and can be overridden, like the other owner defaults.
  - Built-in project under MassDOT (short heel, δ 17°): Ka 0.3073 → **0.2773**; EH_h 392.60 → **338.90 kip**, EH_v 0 → 103.61 kip.
  - Sliding (construction stage) D/C 1.153 → **0.877**; eccentricity 0.707 → 0.419; bearing 0.933 → 0.855; stem M_u 112.06 → **100.07** kip-ft/ft.
- **RIDOT BDM 11.3.4 (p. 11-9):** at-rest where outward tilting is restricted so that active pressure cannot develop.
  - The BDM does not define which walls those are. It defers to AASHTO for the movement relationship, and its only other at-rest text is for integral abutments (11.3.2, movement under ½ in).
  - Basis used: AASHTO 10th C3.11.1 (walls that tolerate little or no movement take at-rest pressure; Table C3.11.1-1 gives the Δ/H needed for active). A pile-supported footing (vertical piles, rigid cap) and a footing on rock are taken as unable to tilt or translate that Δ/H, the same split as MassDOT 3.1.6.
  - New earth pressure state "ridot": K0 = 1 − sin φ on piles or rock, active otherwise. It is the RIDOT owner default, highlighted and overridable.
  - Built-in project under RIDOT, pile footing: K = 0.4701 (was 0.3073); EH_h 392.60 → 600.65 kip; γEH max 1.35. Maximum pile D/C 0.963 → **1.113**; stem M_u 114.90 → **161.90** kip-ft/ft (construction stage 1.35·EH + 1.50·CS now governs).
  - Spread footing on soil: unchanged.
- **Saved data (§5):** no new key. `own.dv` goes 2 → 3 (default state 3). A project saved with owner MassDOT and `soil.method` still at the tool default "rankine" takes "coulomb". A RIDOT project with `soil.Kmode` still "active" takes "ridot". A value the user changed is kept. A one-time notice names the change. Projects under AASHTO and CTDOT are unchanged.
- **Where:** `ABUT_OWN_DEF` (new rows MassDOT `soil.method`, RIDOT `soil.Kmode`), `OWN_DEF_PANEL/LK/LBL`, `ownShow`; `computeAll` anchor `// CLMB: "ridot"`; panel I-3 option "RIDOT 11.3.4: at-rest on piles or rock"; `migrate()` anchor `// CLMB (2026-10-20): new owner defaults`.

### How verified
- `node tests/check-syntax.mjs abutment_calculator.html`: pass.
- Headless `computeAll()`, before (main + #367) and after. Unchanged:
  - AASHTO default, pile, EE I, short-heel Coulomb (level and β = 15°), Rankine long heel with slope;
  - CTDOT.
- Changed as listed:
  - Coulomb long heel (level, slope, EE I);
  - MassDOT spread;
  - RIDOT pile and rock;
  - migrated MassDOT / RIDOT projects saved with `dv` 2.
- Self-test passes. Report built with RIDOT, no console error. Screenshot of Tab 1 §1.3 checked.

### Open items
- With at-rest and Extreme Event I, the M–O increment is still taken over the active resultant (F51).
- RIDOT's "restrained" basis (pile / rock) is the stated judgement above. Change `soil.Kmode` per project if the geotechnical engineer finds otherwise.

Diff (`abutment_calculator.html`, `git diff -U0` against main + #367, `e57fb65`):

```diff
diff --git a/abutment_calculator.html b/abutment_calculator.html
index 96eded2..42344b9 100644
--- a/abutment_calculator.html
+++ b/abutment_calculator.html
@@ -643 +643 @@ function defaultState(){
-    own:{ owner:"AASHTO", Ltot:0, ADT:"", mLL:1.0, dv:2 },        // OWNA: bridge owner (AASHTO | MassDOT | RIDOT | CTDOT); total bridge length for the integral screening (0 = span L)
+    own:{ owner:"AASHTO", Ltot:0, ADT:"", mLL:1.0, dv:3 },        // OWNA: bridge owner (AASHTO | MassDOT | RIDOT | CTDOT); total bridge length for the integral screening (0 = span L)
@@ -830 +830 @@ ABUT_OWN.rules=[
-  {owner:"RIDOT", id:"atrest", kind:"advisory", sec:"11.3.4 (p. 11-9)", text:"At-rest earth pressure where outward tilting of the wall is restricted so that active pressure cannot develop",
+  {owner:"RIDOT", id:"atrest", kind:"advisory", sec:"11.3.4 (p. 11-9)", text:"At-rest earth pressure where outward tilting of the wall is restricted so that active pressure cannot develop (the default \"RIDOT\" earth pressure state applies K0 on piles or rock)",
@@ -899,0 +900 @@ const ABUT_OWN_DEF=[
+  {owner:"MassDOT", key:"soil.method", sec:"3.1.6 (p. 3-4)", text:"Active earth pressure coefficient by Coulomb theory", val:()=>"coulomb"},
@@ -906,0 +908 @@ const ABUT_OWN_DEF=[
+  {owner:"RIDOT", key:"soil.Kmode", sec:"11.3.4 (p. 11-9)", text:"At-rest earth pressure where tilting is restricted: applied to pile-supported and rock-founded abutments (basis: AASHTO C3.11.1 / Table C3.11.1-1, the BDM sets no other definition)", val:()=>"ridot"},
@@ -922 +924 @@ const OWN_DEF_KEYS=[...new Set(ABUT_OWN_DEF.map(d=>d.key))];
-const OWN_DEF_PANEL={"mat.fc":"I-2","soil.Kmode":"I-3","soil.phi":"I-3","soil.gamma":"I-3","constr.qC":"I-3","longit.dTrise":"I-6b","longit.dTfall":"I-6b","longit.cte":"I-6b","bearing.G":"I-6b",
+const OWN_DEF_PANEL={"mat.fc":"I-2","soil.method":"I-3","soil.Kmode":"I-3","soil.phi":"I-3","soil.gamma":"I-3","constr.qC":"I-3","longit.dTrise":"I-6b","longit.dTfall":"I-6b","longit.cte":"I-6b","bearing.G":"I-6b",
@@ -924 +926 @@ const OWN_DEF_PANEL={"mat.fc":"I-2","soil.Kmode":"I-3","soil.phi":"I-3","soil.ga
-const OWN_DEF_LK={"mat.fc":["tab-struct","o-str-Stem","§5.2 stem"],"soil.Kmode":["tab-loads","o-eh","§1.3 earth pressure"],"soil.phi":["tab-loads","o-eh","§1.3 earth pressure"],"soil.gamma":["tab-loads","o-eh","§1.3 earth pressure"],
+const OWN_DEF_LK={"mat.fc":["tab-struct","o-str-Stem","§5.2 stem"],"soil.method":["tab-loads","o-eh","§1.3 earth pressure"],"soil.Kmode":["tab-loads","o-eh","§1.3 earth pressure"],"soil.phi":["tab-loads","o-eh","§1.3 earth pressure"],"soil.gamma":["tab-loads","o-eh","§1.3 earth pressure"],
@@ -928 +930 @@ const OWN_DEF_LK={"mat.fc":["tab-struct","o-str-Stem","§5.2 stem"],"soil.Kmode"
-const OWN_DEF_LBL={"mat.fc":"f′c","soil.Kmode":"earth pressure state","soil.phi":"backfill φ","soil.gamma":"backfill γ","constr.qC":"construction surcharge q_c","longit.dTrise":"temperature rise","longit.dTfall":"temperature fall",
+const OWN_DEF_LBL={"mat.fc":"f′c","soil.method":"active pressure theory","soil.Kmode":"earth pressure state","soil.phi":"backfill φ","soil.gamma":"backfill γ","constr.qC":"construction surcharge q_c","longit.dTrise":"temperature rise","longit.dTfall":"temperature fall",
@@ -934 +936,2 @@ function ownShow(d,v){ if(typeof v==="boolean") return d.key==="seismic.on"?(v?"
-  if(d.key==="soil.Kmode") return {active:"active K_a",atrest:"at-rest K_0",blend:"0.5(K_0 + K_a)",massdot:"MassDOT 3.1.6 rule"}[v]||String(v);
+  if(d.key==="soil.Kmode") return {active:"active K_a",atrest:"at-rest K_0",blend:"0.5(K_0 + K_a)",massdot:"MassDOT 3.1.6 rule",ridot:"RIDOT at-rest on piles / rock"}[v]||String(v);
+  if(d.key==="soil.method") return v==="coulomb"?"Coulomb":"Rankine";
@@ -1260,0 +1264,5 @@ function migrate(){
+  if(S.own.dv===2){   // CLMB (2026-10-20): new owner defaults (MassDOT Coulomb, RIDOT at-rest rule) for a project saved with the earlier defaults
+    S.own.dv=3;
+    if(abutOwner()!=="AASHTO"){ const pre=ownDefMap(); pre["soil.method"]="rankine"; if(abutOwner()==="RIDOT") pre["soil.Kmode"]="active"; const r=ownReapply(pre);
+      if(r.set.length) DEFAULTS_NOTICE=(DEFAULTS_NOTICE||[]).concat(["Owner "+abutOwner()+": new owner default applied — "+r.set.map(k=>ownDefLabel(k)).join("; ")+" (Tab 1 §1.0a, §1.3)"]); }
+  }
@@ -1262 +1270 @@ function migrate(){
-    S.own.dv=2;
+    S.own.dv=3;
@@ -1416,2 +1424,2 @@ function buildInputs(){
-    ${S.soil.method==="coulomb"? inpRow("Wall friction angle δ","soil.delta","deg",{title:"Coulomb only. The resultant acts at δ from the normal to the wall back; horizontal and vertical components are carried separately."}):""}
-    ${selRow("Earth pressure state","soil.Kmode",[["active","Active K<sub>a</sub> (wall free to move) [3.11.5.3]"],["atrest","At-rest K<sub>0</sub> = 1 − sin φ (restrained) [3.11.5.2]"],["blend","0.5(K<sub>0</sub> + K<sub>a</sub>)"],["massdot","MassDOT 3.1.6 rule (by foundation and height)"]],{rebuild:true})}
+    ${S.soil.method==="coulomb"? inpRow("Friction angle δ on the virtual back (short heel)","soil.delta","deg",{title:"Coulomb only, on the vertical plane through the heel end (soil on soil, C3.11.5.3: at most 0.67φ). Used when the heel is short (the shear zone from the heel meets the stem); with a long heel δ = β (Tab 1 §1.3). The resultant acts at δ from the normal; horizontal and vertical components are carried separately."}):""}
+    ${selRow("Earth pressure state","soil.Kmode",[["active","Active K<sub>a</sub> (wall free to move) [3.11.5.3]"],["atrest","At-rest K<sub>0</sub> = 1 − sin φ (restrained) [3.11.5.2]"],["blend","0.5(K<sub>0</sub> + K<sub>a</sub>)"],["massdot","MassDOT 3.1.6 rule (by foundation and height)"],["ridot","RIDOT 11.3.4: at-rest on piles or rock"]],{rebuild:true})}
@@ -1759 +1766,0 @@ function computeKa(){
-    const delta=deg2rad(S.soil.delta);
@@ -1760,0 +1768,9 @@ function computeKa(){
+    // CLMB (2026-10-20): Coulomb on the vertical plane through the heel end [3.11.5.3, C3.11.5.3, Fig. C3.11.5.3-1]. The inner boundary of the
+    // Rankine shear zone rises from the heel at a = ½(90° + β − φ − ε) from the vertical, ε = asin(sin β / sin φ); it meets the ground surface
+    // at s* = H/(cot a + tan β) from the virtual back. s* ≤ L_heel (long heel, Fig. C3.11.5.3-1a): the zone is not cut by the stem and the
+    // plane is soil on soil with δ = β (the Coulomb expression then gives the Rankine value). s* > L_heel (short heel, Fig. C3.11.5.3-1b):
+    // the stem restricts the sliding surface; δ = the soil-on-soil wall friction input on the same plane (C3.11.5.3: at most 0.67φ).
+    const g=S.geom, Hc=g.tf+g.soilH+g.Lheel*Math.tan(beta);
+    const eps=Math.asin(Math.sin(beta)/Math.sin(phi)), aB=0.5*(Math.PI/2+beta-phi-eps), sStar=Hc/(1/Math.tan(aB)+Math.tan(beta));
+    const longHeel=sStar<=g.Lheel+1e-9, dDeg=longHeel? +g.beta : +S.soil.delta, delta=deg2rad(dDeg);
+    if(!longHeel && +S.soil.delta>0.67*(+S.soil.phi)+1e-9) warn(`Coulomb, short heel: δ = ${fmt(+S.soil.delta,1)}° on the soil-on-soil plane through the heel exceeds 0.67φ = ${fmt(0.67*S.soil.phi,1)}° (C3.11.5.3) — check δ (panel I-3).`);
@@ -1764 +1780 @@ function computeKa(){
-    return {ka, iota:S.soil.delta}; // resultant at δ from normal to (vertical) plane
+    return {ka, iota:dDeg, cw:{longHeel, aDeg:aB*180/Math.PI, epsDeg:eps*180/Math.PI, sStar, Lheel:+g.Lheel, H:Hc, delta:dDeg}}; // resultant at δ from the normal to the vertical plane
@@ -1948,2 +1964,5 @@ function computeAll(){
-  const kMode=["atrest","blend","massdot"].includes(S.soil.Kmode)?S.soil.Kmode:"active";
-  const kEff=kMode!=="massdot"?kMode:((S.fnd.branch==="pile"||(S.fnd.branch==="spread"&&S.fnd.matl==="rock"))?"atrest":(H<=5+1e-9?"blend":"active"));
+  const kMode=["atrest","blend","massdot","ridot"].includes(S.soil.Kmode)?S.soil.Kmode:"active";
+  const onPR=(S.fnd.branch==="pile"||(S.fnd.branch==="spread"&&S.fnd.matl==="rock"));
+  // CLMB: "ridot" — RIDOT BDM 11.3.4 (at-rest where tilting is restricted; the BDM defers to AASHTO for the movement needed): K0 for a
+  // pile-supported or rock-founded abutment (cannot rotate or translate the Δ/H of Table C3.11.1-1), active otherwise
+  const kEff=kMode==="massdot"?(onPR?"atrest":(H<=5+1e-9?"blend":"active")) : kMode==="ridot"?(onPR?"atrest":"active") : kMode;
@@ -1953,0 +1973 @@ function computeAll(){
+  R.coul=KA.cw||null;   // CLMB: Coulomb heel case (long / short) and δ used
@@ -1996 +2016 @@ function computeAll(){
-    const dMO=S.soil.method==="coulomb"?deg2rad(S.soil.delta):0;
+    const dMO=S.soil.method==="coulomb"?deg2rad(KA.iota):0;   // CLMB: the δ of the static Coulomb case (β for a long heel)
@@ -3333 +3353,6 @@ function renderTabLoads(R){
-  const s=S.soil, E=R.EH;
+  const s=S.soil, E=R.EH, CW=R.coul, dC=CW?CW.delta:+s.delta;   // CLMB: δ used on the virtual back
+  const coulCase=(s.method==="coulomb"&&CW)? eqB(`Coulomb: heel case — ${CW.longHeel?"long heel (shear zone not cut by the stem): δ = β":"short heel (shear zone cut by the stem): δ = soil-on-soil input"}`,"AASHTO C3.11.5.3, Fig. C3.11.5.3-1",[
+      "\\varepsilon = \\sin^{-1}\\!\\left(\\dfrac{\\sin\\beta}{\\sin\\varphi_f}\\right),\\quad a = \\tfrac{1}{2}(90° + \\beta - \\varphi_f - \\varepsilon),\\quad s^{*} = \\dfrac{H}{\\cot a + \\tan\\beta}",
+      `\\varepsilon = ${fmtT(CW.epsDeg,2)}°,\\quad a = \\tfrac{1}{2}(90 + ${fmtT(g.beta,1)} - ${fmtT(s.phi,1)} - ${fmtT(CW.epsDeg,2)}) = ${fmtT(CW.aDeg,2)}°`,
+      `s^{*} = \\dfrac{${fmtT(CW.H)}}{\\cot ${fmtT(CW.aDeg,2)}° + \\tan ${fmtT(g.beta,1)}°} = ${fmtT(CW.sStar)}\\ \\text{ft} ${CW.longHeel?"\\le":">"} L_{heel} = ${fmtT(CW.Lheel)}\\ \\text{ft} \\;\\Rightarrow\\; \\delta = ${fmtT(CW.delta,1)}°`],
+      `s* = horizontal distance from the virtual back (vertical plane through the heel end) at which the inner boundary of the active shear zone, rising from the heel at a from the vertical, meets the ground. ${CW.longHeel?"It reaches the ground before the stem: the plane is soil on soil and the stress on it is the Rankine stress, inclined at β; Coulomb with δ = β gives that value.":"The stem cuts the zone: Coulomb on the same plane with the soil-on-soil wall friction δ of panel I-3 (C3.11.5.3: usually at most 0.67φ = "+fmt(0.67*s.phi,1)+"°)."} The soil between the stem and the plane is part of the wall weight (EV).`) : "";
@@ -3339 +3364 @@ function renderTabLoads(R){
-       `k_a = \\dfrac{\\cos^2 ${fmtT(s.phi,1)}°}{\\cos ${fmtT(s.delta,1)}°\\left[1+\\sqrt{\\dfrac{\\sin(${fmtT(s.phi+s.delta,1)}°)\\,\\sin(${fmtT(s.phi-g.beta,1)}°)}{\\cos ${fmtT(s.delta,1)}°\\,\\cos ${fmtT(g.beta,1)}°}}\\right]^2}`,
+       `k_a = \\dfrac{\\cos^2 ${fmtT(s.phi,1)}°}{\\cos ${fmtT(dC,1)}°\\left[1+\\sqrt{\\dfrac{\\sin(${fmtT(s.phi+dC,1)}°)\\,\\sin(${fmtT(s.phi-g.beta,1)}°)}{\\cos ${fmtT(dC,1)}°\\,\\cos ${fmtT(g.beta,1)}°}}\\right]^2}`,
@@ -3363,0 +3389 @@ function renderTabLoads(R){
+    ${coulCase}
@@ -3367 +3393 @@ function renderTabLoads(R){
-      ...(s.method==="coulomb"?[["\\delta","Wall interface friction angle",s.delta,"deg"]]:[]),
+      ...(s.method==="coulomb"?[["\\delta","Friction angle on the virtual back ("+(CW&&CW.longHeel?"long heel: = β":"short heel: soil on soil, input")+")",dC,"deg"]]:[]),
@@ -5550 +5576 @@ function inputEchoHTML(){
-    ["Earth pressure state",{active:"active Ka",atrest:"at-rest K0 = 1 − sin φ",blend:"0.5(K0 + Ka)",massdot:"MassDOT 3.1.6 rule"}[S.soil.Kmode]||"active Ka",""],
+    ["Earth pressure state",{active:"active Ka",atrest:"at-rest K0 = 1 − sin φ",blend:"0.5(K0 + Ka)",massdot:"MassDOT 3.1.6 rule",ridot:"RIDOT: at-rest on piles / rock"}[S.soil.Kmode]||"active Ka",""],
```

## 2026-10-20 — PR: claude/abut-checks — added checks: backwall wheel load, stem dowels (development and lap), pile structural resistance, k_h0 = 1.2·A_s on Site Class A/B/B-C, cover advisory, computed spread-footing q_n (PR link added after merge)

Basis: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), each factor and equation checked in the 10th Ed. text; FHWA LRFD Steel Girder Superstructure Design Example, Abutment and Wingwall Design (Design Step 7.5), cited only. Default project = the built-in project (B = 13 ft, L = 44 ft, 6 girders). All numbers below are from headless `computeAll()` and match the hand checks.

### F61. Backwall: design truck wheel load on top of the backwall (ABCHK-1)   [calc change] [MORE conservative]
- **Provision:** AASHTO has no backwall article; the FHWA example (Design Step 7.5) applies a vertical live load at the front top corner of the backwall, lever arm t_bw/2, backwall only. Loads per the 10th Ed.: wheel P_w = 16 kip and transverse wheel spacing 6 ft [3.6.1.2.2], tire 20 × 10 in [3.6.1.2.5], m = 1.20 one lane [Table 3.6.1.1.2-1], IM = 33 % [Table 3.6.2.1-1]. Distribution along the backwall: cast-in-place overhang strip E = 45 + 10X in [Table 4.6.2.1.3-1], X = h_bw (load to the backwall base, the cantilever's support).
- **Before:** `MuBW = γEH·M_EH + γLL·M_LS + γES·M_ES`; `MsBW = M_EH + M_LS + M_ES`.
- **After:** w_LL = m(1 + IM)·max(P_w/E, 2P_w/(E + 72))·12 (kip/ft; the second form when the two wheel strips overlap), M_LL = w_LL·t_bw/2; `MuBW += γLL·m_owner·M_LL`, `MsBW += m_owner·M_LL` (m_owner = RIDOT design load multiplier, 1.0 otherwise). V_u unchanged (vertical load). New input `bwLL.mode` "wheel" (default) | "off" (panel I-9).
- **Where:** `computeAll()` C-10, anchor `// ABCHK: live load on top of the backwall`; `renderTabStruct()` anchor `// ABCHK: backwall live load (wheel on top of the backwall)` (Tab 5 §5.1 now works M_LL, M_u, V_u and M_s).
- **Check (default project, h_bw = 5 ft, t_bw = 1.5 ft):** E = 45 + 50 = 95 in; P_w/E = 0.1684, 2P_w/(E + 72) = 32/167 = 0.1916 kip/in (both wheels govern); w_LL = 1.20(1.33)(0.1916)(12) = 3.670 kip/ft; M_LL = 3.670(0.75) = 2.752 kip-ft/ft.
  - M_u = 1.50(0.768) + 1.75(1.844) + 1.75(2.752) = **9.195** kip-ft/ft (before 4.378); φM_n = 30.30; flexure D/C 0.145 → **0.304**.
  - M_s = 0.768 + 1.844 + 2.752 = **5.364** (before 2.612); crack-control ratio 0.105 → 0.226; min. reinforcement ratio 0.192 → 0.404.
  - Shear D/C 0.060 → 0.071 (V_u unchanged at 1.98 kip/ft; β of the general procedure drops because ε_s uses M_u).
  - Variant `bwLL.mode = "off"`: identical to before (4.378).
- **Saved data:** new key `bwLL` (default "wheel"); `meta.defRev` 6 → 7 with a one-time notice for saved projects (their backwall results change).

### F62. Stem dowels into the footing: development and lap splice (ABCHK-2)   [new check]
- **Provision:** 5.10.8.2.4a (Eqs. 5.10.8.2.4a-1, -2: ℓ_dh = ℓ_d + R + d_b/2 ≥ max(8d_b, 6 in), F_h = d_b·R·ν·f′c), 5.10.8.2.1a (Eqs. -1, -2), 5.10.8.2.1c (Eqs. -1, -2: λ_rc = d_b·c_b/(c_b(1 − β_t) + 1.67n_s·k_tr)², 0.3 to 1.0), Table 5.10.2.3-1 (bend 6d_b #3–#8, 8d_b #9–#11), 5.10.2.1 (standard hook), Table 5.8.2.5.3a-1 (CTT: ν = 0.85 − f′c/20, 0.45 to 0.65), 5.10.8.4.3a (Class A 1.0ℓ_d when A_s,prov ≥ 2A_s,req and ≤ 50 % spliced, else Class B 1.3ℓ_d; ≥ 12 in).
- **Choices:** dowels = stem back-face bars; k_tr = 0 and β_t = 0 (no credit); λ_er = λ_rl = λ_cf = 1.0; c_b = s/2 in the footing, min(c_wall + d_b/2, s/2) for the lap; available embedment ℓ_avail = 12t_f − bottom cover − 2d_b,toe (spread: c_F; piles: e_pile + c_top), the hook resting on a two-layer bottom mat.
- **New inputs (panel I-9):** `reinf.dwlEnd` "hook" (default) | "straight"; `reinf.dwlLap` (in, 0 = report required only); `reinf.dwlPct` (default 100 %).
- **Where:** `computeAll()` anchor `/* ---- ABCHK: stem dowels into the footing`; Tab 5 §5.2a `o-str-dowel`; dashboard `dowelDev`, `dowelLap` (n/a until a lap is entered).
- **Check (default, #9 @ 9 in, f′c = 4 ksi, t_f = 3 ft, c_F = 3 in, toe #8):** R = 4(1.128) + 0.564 = 5.076 in; ν = 0.65; F_h = 1.128(5.076)(0.65)(4) = 14.89 kip; ℓ_db = 0.17(1.128)[(60 − 14.89)/(1.97·4^0.25)]² = 50.28 in; λ_rc = 1.128/4.5 = 0.251 → 0.30; ℓ_d = 15.08; ℓ_dh = 15.08 + 5.076 + 0.564 = **20.72 in**; ℓ_avail = 36 − 3 − 2 = 31.0 in; D/C **0.669**.
  - Lap: c_b = min(2.564, 4.5) = 2.564, λ_rc = 0.440, ℓ_d = 88.94(0.440) = 39.13 in; A_s,prov/A_s,req = 1.333/0.488 = 2.73 but 100 % spliced → Class B, ℓ_lap = 1.3(39.13) = **50.87 in** (reported, not checked: lap not entered).
  - Pile variant (e_pile 12 in + c_top 3 in): ℓ_avail = 36 − 15 − 2 = 19.0 in; D/C **1.091 (FAIL)**.

### F63. Pile structural axial resistance; governing = lesser of geotechnical and structural (ABCHK-3)   [new check]
- **Provision:** 10.7.3.13.1, 6.15.2, 6.15.3.1, 6.9.4.1.1, 6.9.4.2.1 (Table 6.9.4.2.1-1: λ_r = 0.56√(E/F_y) flanges, 1.49√(E/F_y) webs of rolled I-sections), 6.9.4.2.2 (Eqs. 6.9.4.2.2a-1, -3; 6.9.4.2.2b-1 to -4; Table 6.9.4.2.2b-1: c_1/c_2 = 0.22/1.49 flanges, 0.18/1.31 webs), 6.9.4.2.2c (round tubes), 6.5.4.2 (φ_c axial only: H-pile 0.60 good / 0.50 severe driving; pipe 0.70 / 0.60), 6.5.5 (EE φ = 1.0), Table 3.4.1-1 note (γ_DR = 1.10 structural, 0.00 geotechnical).
- **Method:** vertical pile fully embedded (laterally supported): P_n = F_y·A_eff (F_cr = F_y). Demand P_u = largest strength pile reaction + γ_DR·DR (already computed by #351, previously reported only); EE: largest EE reaction vs 1.0·P_n. Shapes: HP table (AISC 15th, as Section Property Calculator), "" = lightest HP of the pile size; round = unfilled steel pipe with wall t; square = factored P_r entered (0 = not checked). Combined axial + flexure (φ_c 0.70/0.80) is outside the tool (lateral analysis).
- **New inputs (panel I-7):** `piles.strSec` (""), `Fy` (50), `drive` ("good"), `pipeT` (0.5), `PrUser` (0). Pile shape select now rebuilds the panel.
- **Where:** `pileStructural()` in `computeAll()`, `HP_SHAPES`, `hpAuto()`; Tab 4 §4.4a `o-pilestr`; dashboard `pileS`.
- **Check (pile variant, HP12X53 automatic, F_y = 50):** b/t = 6.0/0.435 = 13.79 > λ_r = 13.49 → F_el = (1.49·13.49/13.79)²·50 = 106.1 ksi, √(F_el/F_y) = 1.4569, b_e = 6.0(1 − 0.22·1.4569)(1.4569) = 5.940 in; web 22.3 ≤ 35.9; A_eff = 15.50 − 4(0.060)(0.435) = 15.395 in²; P_n = 769.7 kip; P_r = 0.60(769.7) = 461.8 kip; P_u = 212.71 kip → D/C **0.461**. With DR = 40 kip: P_u = 212.71 + 1.10(40) = 256.71 → **0.556**. Geotechnical (unchanged) 212.71/231.0 = 0.921 governs; factored resistance per pile = min(231.0, 461.8) = 231.0 kip.
  - Pipe 14 × 0.375 in: A = 16.05 in², D/t = 37.3 ≤ 63.8 → A_eff = A_g, P_n = 802.6, P_r = 0.70(802.6) = 561.8 → 0.379.

### F64. Extreme Event k_h0 = 1.2·A_s for Site Class A, B or B/C (ABCHK-4)   [calc change] [MORE conservative where the site class is A, B or B/C]
- **Provision:** 11.6.5.2.1 (k_h0 = A_s at the wall base; 1.2·A_s for walls founded on Site Class A, B or B/C); k_h = ratio × k_h0 [11.6.5.2.2].
- **Before:** `kh = khR·As`. **After:** `kh = khR·kh0`, `kh0 = (A, B, B/C ? 1.2 : 1.0)·As`. New input `seismic.siteClass` (panel I-11), default "" (not selected → k_h0 = A_s, with a warning). The SubLoads hand-off sends A_s only. The superstructure inertia keeps A_s [3.10.9].
- **Where:** `computeAll()` C-3b anchor `// ABCHK: k_h0 = A_s at the wall base`; Tab 3 §3.6a works k_h0 then k_h.
- **Check (default + EE on, A_s = 0.15, ratio 0.5, Site Class B):** k_h0 = 1.2(0.15) = 0.18, k_h = 0.09 (before 0.075); θ = 5.14°, K_AE = 0.3613 (before 0.3517); ΔP_AE,h 56.73 → **69.01 kip**; wall inertia 54.20 → 65.04 kip; soil-block inertia 37.62 → 45.14 kip. Heel flexure D/C 0.203 → 0.212. Pile variant with Site Class B: EE now gives a minimum pile reaction of −3.12 kip (uplift D/C 0.052; before no uplift). Site class not selected: unchanged.

### F65. Concrete cover advisory (ABCHK-5)   [new advisory] [no result changes]
- **Provision:** 5.10.1, Table 5.10.1-1 (categories A/B/C; W/CM factors 0.8 / 1.0 / 1.2; minimum 1.0 in).
- **Method:** footing bottom = cast against earth (salt water if chosen); footing top = "other than noted" (or salt water / coastal / limited); stem and backwall faces = the exposure input; backwall category B when its bars are epoxy coated. Pile footing bottom cover = e_pile + c_top. PASS/FAIL table, warning on FAIL; not on the dashboard.
- **New inputs (panel I-2):** `mat.coverExp` "deicing" (default; FHWA DS7 takes deicing exposure for the backwall and stem at an expansion joint), `mat.coverCat` "A", `mat.coverWcm` 1.0.
- **Where:** `computeAll()` anchor `/* ---- ABCHK: concrete cover advisory`; Tab 5 §5.0a `o-str-cover`.
- **Check (default):** footing bottom 3.0 ≥ 3.0 PASS; top 3.0 ≥ 2.0 PASS; stem and backwall 2.0 < 2.5 **FAIL (advisory)**. With exposure "other than noted": 2.0 ≥ 2.0 PASS.

### F66. Spread-footing nominal bearing resistance from soil parameters (ABCHK-6)   [calc change only when chosen] [default "given q_n": unchanged]
- **Provision:** 10.6.3.1.2a (Eqs. 10.6.3.1.2a-1 to -10; Tables 10.6.3.1.2a-1, -2, -3), 10.6.1.3 (B′, L′), C10.6.3.1.2a (inclination factors may be conservative for D_f/B ≥ ~1).
- **Method:** for every bearing permutation, q_n on its own B′ × L′ (B = the smaller), with N_q = e^(π tanφ)tan²(45 + φ/2), N_c = (N_q − 1)cot φ (π + 2 at φ = 0), N_γ = 2(N_q + 1)tan φ; shape factors per Table 10.6.3.1.2a-3; d_q (≤ 1.4) only when ticked; inclination factors with n from θ (H along B → 90°) and the unfactored H, V of the loads present in that permutation (γ > 0 → 1.0); C_wq, C_wγ linear between the rows of Table 10.6.3.1.2a-2 (D_w input, or D_f − h_w when h_w > 0). D/C = q/(φ_b·q_n) per permutation, governing = largest.
- **New inputs (panel I-4, soil only):** `fnd.qnMode` "given" (default) | "soil"; `qnC` 0, `qnPhi` 32, `qnGam` 0.120, `qnDw` 100, `qnIncl` true, `qnDepth` false; γ_q = `fnd.gammaF`, D_f = `fnd.Df` (shared with passive).
- **Where:** `qnSoil()`, `unfactoredOf()` in C-7; bearing loop anchor `// ABCHK: nominal bearing resistance`; Tab 3 §3.3; chart, key results and sizing hint use the governing q_n.
- **Check (default + "soil", φ_f = 32°, c = 0, γ = 0.120, D_f = 3 ft, governing Strength I):** B′ = 8.952, L′ = 44, B′/L′ = 0.2035; N_q = 23.18, N_γ = 30.21; s_q = 1.127, s_γ = 0.919; H = 486.5 kip, V = 2279.1 kip (unfactored), θ = 90°, n = 2.2035/1.2035 = 1.831; 1 − H/V = 0.7865, i_q = 0.644, i_γ = 0.507; q_n = 0.120(3)(23.18)(1.127)(0.644) + 0.5(0.120)(8.952)(30.21)(0.919)(0.507) = 6.06 + 7.55 = **13.61 ksf**; q_R = 0.45(13.61) = 6.13; q = 7.56 → D/C **1.234** (given q_n = 18: 0.933).
  - Without inclination factors: q_n = 9.40 + 14.91 = 24.31 ksf, D/C 0.691.
  - Clay φ = 0, c = 3 ksf, D_f = 4 ft: s_c = 1.041, i_c = 1 − 1.831(486.5)/(3·8.952·44·5.142) = 0.853, q_n = 13.70 + 0.48 = 14.18 ksf, D/C 1.185.

### Saved data (CLAUDE.md §5)
- New optional fields only (listed above), each backfilled with its default in `migrate()`; no key renamed or removed. `meta.defRev` 7 (one-time backwall notice for saved projects). The Input ID drops the new fields while at their default.
- Verified: a project saved by main (defRev 6, pile branch) opens with every stored value unchanged plus the new defaults and the notice; a project saved by this branch (strSec HP14X73, q_n "soil") opens and computes in main.

### How verified
- `node tests/check-syntax.mjs abutment_calculator.html`: pass. `node tests/compare.mjs --tool page`: same console output as main (CDN blocks only).
- Headless `computeAll()` main vs branch on default, pile, pile + DR, EE (site class none / B / B/C), pipe, square, q_n soil (sand, clay, no inclination, water + depth), backwall off, cover variants, rock (q_n mode ignored): only the changes listed above; every other dashboard value identical.
- Every tab and the print report rebuilt for those cases with no exception; every equation parsed by KaTeX (0 errors); panel screenshots checked (§3.3, §3.6a, §4.4a, §5.0a, §5.1, §5.2a).
- Self-test (baked values) passes.

### Open items
- Backwall wheel strip: AASHTO has no backwall article; the overhang strip with X = h_bw and the FHWA corner load (arm t_bw/2) are the chosen basis. Default "wheel" applies to every project; set "none" where no wheel bears on the backwall.
- The existing ℓ_d of the section checks (bar lengths) keeps λ_rc = 1.0; the dowel check computes λ_rc. Not changed here.
- Cover advisory default exposure "deicing salts" flags the default project's 2.0 in wall cover.
- Pile combined axial + flexure, buckling of exposed piles and concrete-filled / prestressed piles are not covered.
- SubLoads does not send the site class (input here); adding it to the hand-off would be a SubLoads change.

Diff (`abutment_calculator.html`, `git diff -U0` against main `8cef5ed`):

```diff
diff --git a/abutment_calculator.html b/abutment_calculator.html
index 42344b9..04ae525 100644
--- a/abutment_calculator.html
+++ b/abutment_calculator.html
@@ -559,0 +560,16 @@ const GAMMA_W = 0.0624; // unit weight of water, kcf
+// ABCHK: rolled HP shapes (AISC Steel Construction Manual 15th Ed. shape database, as in Section Property Calculator.html):
+// [A (in²), d, b_f, t_f, t_w (in), h/t_w] — pile structural resistance [10.7.3.13.1, 6.9.4.2]
+const HP_SHAPES = {
+  "HP8X36":[10.6,8.02,8.16,0.445,0.445,14.2], "HP10X42":[12.4,9.7,10.1,0.42,0.415,18.9], "HP10X57":[16.7,9.99,10.2,0.565,0.565,13.9],
+  "HP12X53":[15.5,11.8,12,0.435,0.435,22.3], "HP12X63":[18.4,11.9,12.1,0.515,0.515,18.9], "HP12X74":[21.8,12.1,12.2,0.61,0.605,16.1],
+  "HP12X84":[24.6,12.3,12.3,0.685,0.685,14.2], "HP12X89":[25.9,12.4,12.3,0.72,0.72,13.6],
+  "HP14X73":[21.4,13.6,14.6,0.505,0.505,22.6], "HP14X89":[26.1,13.8,14.7,0.615,0.615,18.5], "HP14X102":[30.1,14,14.8,0.705,0.705,16.2],
+  "HP14X117":[34.4,14.2,14.9,0.805,0.805,14.2],
+  "HP16X88":[25.8,15.3,15.7,0.54,0.54,22], "HP16X101":[29.9,15.5,15.8,0.625,0.625,19], "HP16X121":[35.8,15.8,15.9,0.75,0.75,15.9],
+  "HP16X141":[41.7,16,16,0.875,0.875,13.6], "HP16X162":[47.7,16.3,16.1,1,1,11.9], "HP16X183":[54.1,16.5,16.3,1.13,1.13,10.5],
+  "HP18X135":[39.9,17.5,17.8,0.75,0.75,18.2], "HP18X157":[46.2,17.7,17.9,0.87,0.87,15.6], "HP18X181":[53.2,18,18,1,1,13.6],
+  "HP18X204":[60.2,18.3,18.1,1.13,1.13,12.1]};
+// "" = automatic: the lightest HP of the nominal depth nearest the pile size (panel I-7)
+function hpAuto(p){ if(p.strSec&&HP_SHAPES[p.strSec]) return p.strSec;
+  const n=[8,10,12,14,16,18].reduce((a,b)=>Math.abs(b-(+p.pileSize||12))<Math.abs(a-(+p.pileSize||12))?b:a,12);
+  return Object.keys(HP_SHAPES).filter(k=>k.startsWith("HP"+n+"X")).sort((a,b)=>HP_SHAPES[a][0]-HP_SHAPES[b][0])[0]; }
@@ -590 +606,2 @@ function defaultState(){
-    mat:{fc:4.0, gc:0.150, fy:60.0, coverF:3.0, coverT:2.0, ag:0.75}, // ksi, kcf, ksi, in (footing / wall+top), max aggregate size (in) for the 5.7.3.4.2 s_xe
+    mat:{fc:4.0, gc:0.150, fy:60.0, coverF:3.0, coverT:2.0, ag:0.75, // ksi, kcf, ksi, in (footing / wall+top), max aggregate size (in) for the 5.7.3.4.2 s_xe
+      coverExp:"deicing", coverCat:"A", coverWcm:1.0},              // ABCHK: cover advisory [T.5.10.1-1]: wall exposure, reinforcing material category, W/CM factor (0.8 / 1.0 / 1.2)
@@ -608 +625,5 @@ function defaultState(){
-      scour:false                         // scour condition: kills passive resistance; q_n to reflect scoured overburden
+      scour:false,                        // scour condition: kills passive resistance; q_n to reflect scoured overburden
+      qnMode:"given",                     // ABCHK: "given" = q_n input (geotechnical report); "soil" = computed per 10.6.3.1.2a for every permutation (soil only)
+      qnC:0.0, qnPhi:32.0, qnGam:0.120,   // ABCHK: bearing stratum below the base: cohesion c (ksf), φf (deg), γf (kcf); γq above the base = gammaF, D_f = Df
+      qnDw:100.0,                         // ABCHK: depth of groundwater D_w below the ground surface for Table 10.6.3.1.2a-2 (ft; ≥ 1.5B + D_f = no effect; h_w > 0 overrides)
+      qnIncl:true, qnDepth:false          // ABCHK: load inclination factors i (Eqs. 10.6.3.1.2a-5 to -9) on; depth factor d_q (Eq. 10.6.3.1.2a-10) only if the soil above the base is as competent
@@ -622 +643,3 @@ function defaultState(){
-      dd:0.0, gDD:1.10                    // drag load DR per pile (kip) and γDR for structural strength [T.3.4.1-1 note: 1.10 structural, 0.00 geotechnical]
+      dd:0.0, gDD:1.10,                   // drag load DR per pile (kip) and γDR for structural strength [T.3.4.1-1 note: 1.10 structural, 0.00 geotechnical]
+      strSec:"", Fy:50.0, drive:"good", pipeT:0.5, PrUser:0   // ABCHK: pile structural resistance [10.7.3.13]: HP designation ("" = lightest HP of the pile size), F_y (ksi),
+                                          // driving condition for φc [6.5.4.2]: "good" (no tip needed) | "severe" (tip needed); pipe wall t (in); square: factored P_r entered (kip, 0 = not checked)
@@ -641 +664,2 @@ function defaultState(){
-      shEQ:100 },                                                 // seismic share of the superstructure inertia at this abutment (%): EQsup = A_s·(DC+DW)·shEQ
+      shEQ:100,                                                   // seismic share of the superstructure inertia at this abutment (%): EQsup = A_s·(DC+DW)·shEQ
+      siteClass:"" },                                             // ABCHK: site class [T.3.10.3.1-1] for k_h0 = 1.2·A_s on A, B, B/C [11.6.5.2.1]; "" = not selected (k_h0 = A_s)
@@ -658 +682,3 @@ function defaultState(){
-      bw:{size:"6", sp:12}, stem:{size:"9", sp:9}, toe:{size:"8", sp:9}, heel:{size:"8", sp:9}
+      bw:{size:"6", sp:12}, stem:{size:"9", sp:9}, toe:{size:"8", sp:9}, heel:{size:"8", sp:9},
+      dwlEnd:"hook", dwlLap:0, dwlPct:100   // ABCHK: stem dowels into the footing: "hook" (standard 90° hook, 5.10.8.2.4) | "straight" (5.10.8.2.1a);
+                                            // lap with the stem bars provided (in, 0 = not detailed: required length reported); % of bars spliced within the lap length [5.10.8.4.3a]
@@ -659,0 +686 @@ function defaultState(){
+    bwLL:{ mode:"wheel" },          // ABCHK: live load on top of the backwall (FHWA LRFD steel girder example, Design Step 7.5): "wheel" (design truck wheels on an equivalent strip) | "off"
@@ -1016,0 +1044,9 @@ const VALID = {
+  "piles.Fy":   {hard:[30,100], typ:[36,65], msg:"Pile steel yield strength outside the typical 36–65 ksi range."},
+  "piles.pipeT":{hard:[0.1,3], typ:[0.25,1], msg:"Pipe pile wall thickness outside the typical 0.25–1 in range."},
+  "piles.PrUser":{hard:[0,5000], typ:[0,1500], msg:"Factored structural resistance of the pile outside the typical range — check it."},
+  "reinf.dwlLap":{hard:[0,300], typ:[0,120], msg:"Dowel lap length outside the typical 0–120 in range."},
+  "reinf.dwlPct":{hard:[0,100], typ:[50,100], msg:"Share of bars spliced within the lap outside 50–100 %."},
+  "fnd.qnC":    {hard:[0,40], typ:[0,6], msg:"Bearing soil cohesion outside the typical 0–6 ksf range."},
+  "fnd.qnPhi":  {hard:[0,50], typ:[0,42], msg:"Bearing soil friction angle above 42° — Table 10.6.3.1.2a-1 runs to 45°; confirm with the geotechnical report."},
+  "fnd.qnGam":  {hard:[0.05,0.16], typ:[0.10,0.14], msg:"Bearing soil unit weight outside the typical 0.10–0.14 kcf range."},
+  "fnd.qnDw":   {hard:[0,1000], typ:[0,200], msg:"Depth of groundwater outside the typical range."},
@@ -1199,0 +1236 @@ function migrate(){
+  const defRev0=(S.meta&&+S.meta.defRev)||0;   // ABCHK: revision of the saved defaults before this migration (0 = a new project)
@@ -1263,0 +1301,8 @@ function migrate(){
+  // ABCHK (2026-10-20): new optional inputs, each backfilled with its default (a project saved before keeps every stored value)
+  { const T=defaultState(), fill=(o,t,keys)=>keys.forEach(k=>{ if(o[k]===undefined) o[k]=t[k]; });
+    fill(S.mat,T.mat,["coverExp","coverCat","coverWcm"]);
+    fill(S.fnd,T.fnd,["qnMode","qnC","qnPhi","qnGam","qnDw","qnIncl","qnDepth"]);
+    fill(S.piles,T.piles,["strSec","Fy","drive","pipeT","PrUser"]);
+    fill(S.reinf,T.reinf,["dwlEnd","dwlLap","dwlPct"]);
+    if(S.seismic) fill(S.seismic,T.seismic,["siteClass"]);
+    if(!S.bwLL||typeof S.bwLL!=="object") S.bwLL=clone(T.bwLL); }
@@ -1348,0 +1394,6 @@ function migrate(){
+  // defRev 7 (ABCHK, 2026-10-20): new input "live load on top of the backwall" (default: design truck wheels); one-time notice for a
+  // saved project, because its backwall flexure and crack control now include it (the other new inputs leave saved results unchanged)
+  if(!(S.meta.defRev>=7)){
+    if(defRev0>=1) DEFAULTS_NOTICE=(DEFAULTS_NOTICE||[]).concat(["Backwall: a design truck wheel load on top of the backwall is now included in the backwall flexure and crack control (new input \"Live load on top of the backwall\", panel I-9; Tab 5 §5.1). Set it to \"none\" where no wheel can bear on the backwall"]);
+    S.meta.defRev=7;
+  }
@@ -1416,0 +1468,5 @@ function buildInputs(){
+    <div class="subhead">Cover check (advisory) [5.10.1, Table 5.10.1-1]</div>
+    ${selRow("Exposure of the wall faces","mat.coverExp",[["deicing","Severe/moderate: exposure to deicing salts"],["other","Severe/moderate: other than noted"],["coastal","Severe/moderate: coastal"],["saltwater","Severe/moderate: direct exposure to salt water"],["limited","Limited exposure"]])}
+    ${selRow("Reinforcing material category","mat.coverCat",[["A","A — uncoated (AASHTO M 31)"],["B","B — epoxy coated or galvanized (ASTM A775)"],["C","C — AASHTO M 334"]])}
+    ${selRow("W/CM ratio factor","mat.coverWcm",[["0.8","W/CM ≤ 0.40 (× 0.8)"],["1","0.40 < W/CM < 0.50 (× 1.0)"],["1.2","W/CM ≥ 0.50 (× 1.2)"]])}
+    <div class="in-note">Footing bottom: cast against earth; footing top: other than noted (or the exposure above if salt water, coastal or limited). Backwall bars epoxy coated (panel I-9) use category B. Worked in Tab 5 §5.0a.</div>
@@ -1447 +1503,11 @@ function buildInputs(){
-      ${inpRow("Nominal bearing resistance q<sub>n</sub>","fnd.qn","ksf",{title:"From the geotechnical report. [AASHTO 10.6.3]"})}
+      ${fm.matl==="soil"?selRow("Nominal bearing resistance q<sub>n</sub>","fnd.qnMode",[["given","Given (geotechnical report)"],["soil","Compute from soil parameters [10.6.3.1.2a]"]],{rebuild:true}):""}
+      ${(fm.matl==="soil"&&fm.qnMode==="soil")?`
+        <div class="in-note">q<sub>n</sub> is computed for every permutation on its effective B′ × L′ with its own load inclination (Tab 3 §3.3) [10.6.3.1.2a, 10.6.1.3].</div>
+        ${inpRow("&nbsp;&nbsp;Bearing soil cohesion c (undrained s<sub>u</sub>)","fnd.qnC","ksf",{title:"Undrained shear strength for a cohesive layer (total stress); 0 for a cohesionless soil (effective stress, drained) [10.6.3.1.2a]."})}
+        ${inpRow("&nbsp;&nbsp;Bearing soil friction angle φ<sub>f</sub>","fnd.qnPhi","deg",{title:"0 for an undrained cohesive analysis. Local or punching shear: use the reduced c* = 0.67c and φ* = tan⁻¹(0.67 tan φ) [10.6.3.1.2b]."})}
+        ${inpRow("&nbsp;&nbsp;Bearing soil unit weight γ<sub>f</sub> (below the base, moist)","fnd.qnGam","kcf")}
+        ${fm.usePassive?`<div class="in-note">γ<sub>q</sub> above the base and D<sub>f</sub>: the foundation soil inputs under passive resistance below.</div>`:`${inpRow("&nbsp;&nbsp;Soil unit weight above the base γ<sub>q</sub> (moist)","fnd.gammaF","kcf")}${inpRow("&nbsp;&nbsp;Embedment depth to bottom of footing D<sub>f</sub>","fnd.Df","ft")}`}
+        ${inpRow("&nbsp;&nbsp;Depth of groundwater below the ground surface D<sub>w</sub>","fnd.qnDw","ft",{title:"Table 10.6.3.1.2a-2: no effect when D_w ≥ 1.5B + D_f. A water table above the footing base (h_w, panel I-1) overrides this."})}
+        <div class="chk-row"><input type="checkbox" id="chkQnI" data-path="fnd.qnIncl" ${fm.qnIncl!==false?"checked":""}><label for="chkQnI">Load inclination factors i<sub>c</sub>, i<sub>q</sub>, i<sub>γ</sub> [Eqs. 10.6.3.1.2a-5 to -9]</label></div>
+        <div class="chk-row"><input type="checkbox" id="chkQnD" data-path="fnd.qnDepth" ${fm.qnDepth?"checked":""}><label for="chkQnD">Depth factor d<sub>q</sub> (soil above the base as competent as below) [Eq. 10.6.3.1.2a-10]</label></div>
+      `:inpRow("Nominal bearing resistance q<sub>n</sub>","fnd.qn","ksf",{title:"From the geotechnical report. [AASHTO 10.6.3]"})}
@@ -1613 +1679 @@ function buildInputs(){
-      ${selRow("Pile shape","piles.pileShape",[["hp","H-pile (square envelope)"],["square","Square / precast"],["round","Round / pipe / drilled"]])}
+      ${selRow("Pile shape","piles.pileShape",[["hp","H-pile (square envelope)"],["square","Square / precast"],["round","Round / pipe / drilled"]],{rebuild:true})}
@@ -1616,0 +1683,9 @@ function buildInputs(){
+      <div class="subhead">Pile structural resistance [10.7.3.13, 6.9.4, 6.15]</div>
+      ${p.pileShape==="square"
+        ? inpRow("Factored structural resistance P<sub>r</sub> (each pile)","piles.PrUser","kip",{title:"Square / precast pile: factored axial structural resistance from its own design (5.6.4.4 / 10.7.3.13.2). 0 = not checked (Tab 4 §4.4a)."})
+        : `${p.pileShape==="round"
+            ? inpRow("Pipe wall thickness t (unfilled steel pipe, D = pile size)","piles.pipeT","in",{title:"Open steel pipe, not concrete filled: A_eff per 6.9.4.2.2c. A concrete-filled pipe (composite, 6.9.5) is not covered."})
+            : selRow("H-pile section","piles.strSec",[["","Automatic: "+hpAuto(p)+" (lightest of the pile size)"]].concat(Object.keys(HP_SHAPES).map(k=>[k,k])))}
+          ${inpRow("Steel yield strength F<sub>y</sub>","piles.Fy","ksi")}
+          ${selRow("Driving condition (φ<sub>c</sub>, axial only) [6.5.4.2]","piles.drive",[["good","Good driving, no pile tip needed (H 0.60, pipe 0.70)"],["severe","Severe driving, pile tip needed (H 0.50, pipe 0.60)"]])}`}
+      <div class="in-note">Vertical pile fully embedded in soil (laterally supported): P<sub>n</sub> = F<sub>y</sub>A<sub>eff</sub>. Combined axial and flexure near the head (from the lateral analysis) is not checked here. Worked in Tab 4 §4.4a.</div>
@@ -1651,0 +1727 @@ function buildInputs(){
+    ${selRow("Live load on top of the backwall","bwLL.mode",[["wheel","Design truck wheels (FHWA DS 7.5; strip T.4.6.2.1.3-1)"],["off","None (no wheel bears on the backwall)"]])}
@@ -1652,0 +1729,3 @@ function buildInputs(){
+    ${selRow("Stem dowels into the footing","reinf.dwlEnd",[["hook","Standard 90° hook [5.10.8.2.4]"],["straight","Straight [5.10.8.2.1a]"]])}
+    ${inpRow("Dowel lap with the stem bars (0 = not detailed)","reinf.dwlLap","in",{title:"Lap length provided between the footing dowels and the stem back-face bars above the construction joint. 0 = report the required Class A/B lap only [5.10.8.4.3a] (Tab 5 §5.2a)."})}
+    ${inpRow("Bars spliced within the lap length","reinf.dwlPct","%",{title:"Share of the stem bars spliced within the required lap length: 100 % when every dowel laps at the joint; ≤ 50 % with staggered laps. Class A needs ≤ 50 % and A_s,prov ≥ 2·A_s,req [5.10.8.4.3a]."})}
@@ -1685 +1764,3 @@ function buildInputs(){
-      ${inpRow("k<sub>h</sub> ratio (k<sub>h</sub> = ratio × A<sub>s</sub>)","seismic.khR","–",{title:"0.5 for walls free to displace 1–2 in; 1.0 for restrained walls. [11.6.5.2.2]"})}
+      ${S.geom.HsupMode==="single"?"":selRow("Site class at the wall base [T.3.10.3.1-1]","seismic.siteClass",[["","— not selected (k<sub>h0</sub> = A<sub>s</sub>)"],["A","A"],["B","B"],["B/C","B/C"],["C","C"],["C/D","C/D"],["D","D"],["D/E","D/E"],["E","E"],["F","F"]])}
+      ${S.geom.HsupMode==="single"?"":`<div class="in-note">k<sub>h0</sub> = A<sub>s</sub>, or 1.2·A<sub>s</sub> for a wall founded on Site Class A, B or B/C [11.6.5.2.1] (worked in Tab 3 §3.6a). The SubLoads hand-off sends A<sub>s</sub> only; select the site class here.</div>`}
+      ${inpRow("k<sub>h</sub> ratio (k<sub>h</sub> = ratio × k<sub>h0</sub>)","seismic.khR","–",{title:"0.5 for walls free to displace 1–2 in; 1.0 for restrained walls. [11.6.5.2.2]"})}
@@ -2014 +2095,4 @@ function computeAll(){
-    const kh=(+S.seismic.khR)*(+S.seismic.As), kv=+S.seismic.kv;
+    // ABCHK: k_h0 = A_s at the wall base, 1.2·A_s for a wall founded on Site Class A, B or B/C [11.6.5.2.1]; k_h = ratio × k_h0 [11.6.5.2.2]
+    const sc=String(S.seismic.siteClass||""), kh0f=["A","B","B/C"].includes(sc)?1.2:1.0, kh0=kh0f*(+S.seismic.As);
+    const kh=(+S.seismic.khR)*kh0, kv=+S.seismic.kv;
+    if(!sc) warn("Seismic: site class not selected (panel I-11) — k_h0 = A_s is used. For a wall founded on Site Class A, B or B/C, k_h0 = 1.2·A_s [11.6.5.2.1].");
@@ -2036 +2120 @@ function computeAll(){
-    R.seis={kh,kv,thd,dMO:dMO*180/Math.PI,KAE,PAE,dPAE,dPAEh,dKh,zEQ,WiW,zWall,WiS,zSoil,EQsup:0};
+    R.seis={kh,kv,thd,dMO:dMO*180/Math.PI,KAE,PAE,dPAE,dPAEh,dKh,zEQ,WiW,zWall,WiS,zSoil,EQsup:0, kh0, kh0f, sc};
@@ -2260 +2344,34 @@ function computeAll(){
-    let brg={dc:-1}, brgOut=false, brgBxBad=false;
+    let brg={dc:-1}, brgOut=false, brgBxBad=false, qnBad=false;
+    const qnSoilOn=fn.matl==="soil" && fn.qnMode==="soil";
+    // ABCHK: unfactored loads of the groups present in a permutation (γ > 0 → 1.0): H and V of the inclination factors [10.6.3.1.2a]
+    function unfactoredOf(c){ let V=0,Hx=0,Hy=0; for(const [k,gr] of Object.entries(groups)){ if((c.gset[k]||0)>0){ V+=gr.V; Hx+=gr.Hx; Hy+=gr.Hy; } } return {V,Hx,Hy}; }
+    /* ABCHK: theoretical nominal bearing resistance of a soil layer [10.6.3.1.2a, Eqs. 10.6.3.1.2a-1 to -10, Tables 10.6.3.1.2a-1 to -3],
+       on the effective footing B′ × L′ [10.6.1.3]. N_q = e^(π tanφ)·tan²(45° + φ/2), N_c = (N_q − 1)·cot φ (5.14 at φ = 0), N_γ = 2(N_q + 1)·tan φ
+       (the Prandtl / Reissner / Vesić expressions of Table 10.6.3.1.2a-1). B = the smaller effective dimension; θ = load direction in plan
+       from the side L. Unfactored H, V of the same permutation. Groundwater by Table 10.6.3.1.2a-2 (linear between the rows). */
+    function qnSoil(Bp,Lp,u){
+      const cS=Math.max(0,+fn.qnC||0), phD=Math.max(0,+fn.qnPhi||0), ph=deg2rad(phD), tp=Math.tan(ph);
+      const gq=+fn.gammaF||0, gf=+fn.qnGam||0, Df=Math.max(0,+fn.Df||0);
+      const swap=Bp>Lp, Bq=swap?Lp:Bp, Lq=swap?Bp:Lp, rBL=Bq/Lq;
+      const H=Math.hypot(u.Hx,u.Hy), V=u.V;
+      const thL=Math.atan2(Math.abs(swap?u.Hy:u.Hx), Math.abs(swap?u.Hx:u.Hy));   // angle from the side L (H along B → 90°)
+      const Nq=phD>0? Math.exp(Math.PI*tp)*Math.pow(Math.tan(Math.PI/4+ph/2),2) : 1.0;
+      const Nc=phD>0? (Nq-1)/tp : Math.PI+2, Ng=phD>0? 2*(Nq+1)*tp : 0;
+      const sc=phD>0? 1+rBL*Nq/Nc : 1+rBL/5, sg=phD>0? 1-0.4*rBL : 1.0, sq=phD>0? 1+rBL*tp : 1.0;
+      const dqRaw=(fn.qnDepth&&phD>0)? 1+2*tp*Math.pow(1-Math.sin(ph),2)*Math.atan(Df/Bq) : 1.0, dq=Math.min(1.4,dqRaw);
+      const n=((2+1/rBL)/(1+1/rBL))*Math.pow(Math.cos(thL),2)+((2+rBL)/(1+rBL))*Math.pow(Math.sin(thL),2);
+      let ic=1, iq=1, ig=1, base=null;
+      if(fn.qnIncl!==false && H>0){
+        if(phD>0){ const den=V+cS*Bq*Lq/tp; base=den>0? Math.max(0,1-H/den) : 0; iq=Math.pow(base,n); ig=Math.pow(base,n+1); ic=iq-(1-iq)/(Nq-1); }
+        else{ ic=Math.max(0, cS>0? 1-n*H/(cS*Bq*Lq*Nc) : 0); }
+      }
+      // groundwater: h_w above the footing base → D_w = D_f − h_w from the ground surface; otherwise the D_w input
+      const hw=+g.hw||0, DwIn=Math.max(0,+fn.qnDw>=0? +fn.qnDw : 100), Dw=hw>0? Math.min(DwIn, Math.max(0,Df-hw)) : DwIn;
+      const Cwq= Dw>=Df? 1.0 : (Df>0? 0.5+0.5*Dw/Df : 0.5);
+      const Cwg= Dw<=Df? 0.5 : (Dw>=1.5*Bq+Df? 1.0 : 0.5+0.5*(Dw-Df)/(1.5*Bq));
+      const Ncm=Nc*sc*ic, Nqm=Nq*sq*dq*iq, Ngm=Ng*sg*ig;
+      const tC=cS*Ncm, tQ=gq*Df*Nqm*Cwq, tG=0.5*gf*Bq*Ngm*Cwg;
+      return {qn:tC+tQ+tG, c:cS, phD, gq, gf, Df, B:Bq, L:Lq, swap, rBL, H, V, Hx:u.Hx, Hy:u.Hy, thDeg:thL*180/Math.PI, Nq, Nc, Ng, sc, sg, sq, dq, dqRaw, n, ic, iq, ig, base,
+        Dw, hw, Cwq, Cwg, Ncm, Nqm, Ngm, tC, tQ, tG, incl:fn.qnIncl!==false, depth:!!fn.qnDepth};
+    }
+    R.qnSoil=qnSoilOn? qnSoil : null;
@@ -2281 +2398,4 @@ function computeAll(){
-        if(q/(phiBls*fn.qn)>brg.dc){ brg={dc:q/(phiBls*fn.qn), q, e, eSigned:eS, side:eS>=0?"toe":"heel", Bp, Lp, eL, bx, V:c.V, mode, phiB:phiBls, lbl:c.lbl, ls:lsName, c}; }
+        // ABCHK: nominal bearing resistance — the q_n input, or (soil, "compute") per 10.6.3.1.2a for this permutation's B′, L′ and H/V
+        const qc=qnSoilOn? qnSoil(Bp,Lp,unfactoredOf(c)) : null, qnU=qc? qc.qn : fn.qn;
+        if(qnSoilOn && !(qnU>0)){ qnBad=true; continue; }
+        if(q/(phiBls*qnU)>brg.dc){ brg={dc:q/(phiBls*qnU), q, e, eSigned:eS, side:eS>=0?"toe":"heel", Bp, Lp, eL, bx, V:c.V, mode, phiB:phiBls, lbl:c.lbl, ls:lsName, c, qn:qnU, qc}; }
@@ -2285,0 +2406,2 @@ function computeAll(){
+    if(qnBad) warn("Bearing: the nominal bearing resistance q_n is zero for at least one permutation"+(qnSoilOn?" (computed from the soil parameters, panel I-4: check c, φ_f, γ, D_f and the load inclination)":"")+" — that permutation is not checked; see Tab 3 §3.3.","err");
+    if(qnSoilOn&&fn.scour) warn("Bearing q_n computed from soil parameters with the scoured condition on: enter the embedment D_f and the overburden of the scoured ground (panel I-4).");
@@ -2370,0 +2493,37 @@ function computeAll(){
+      // ABCHK: pile structural axial resistance [10.7.3.13]; the governing pile resistance is the lesser of geotechnical and structural
+      const eeR=perLS["Extreme Event I"]&&perLS["Extreme Event I"].best&&isFinite(perLS["Extreme Event I"].best.Pmax)? perLS["Extreme Event I"].best : null;
+      R.checks.pileStr=pileStructural(R.checks.pileComp, eeR);
+    }
+  }
+  /* ABCHK: structural axial resistance of a vertical pile fully embedded in soil [10.7.3.13.1; 6.15.2, 6.15.3.1; 6.9.4.1.1, 6.9.4.2].
+     Laterally supported over its length: P_e → ∞, so F_cr = F_y and P_n = F_y·A_eff (Eq. 6.9.4.2.2a-1), A_eff by the effective width of
+     slender elements (Eqs. 6.9.4.2.2a-3, 6.9.4.2.2b-1 to -4; rolled HP flanges and web) or of a round tube (Eqs. 6.9.4.2.2c-1, -2).
+     φ_c for axial resistance alone, where driving damage is likely (near the tip) [6.5.4.2]: H-pile 0.60 good driving / 0.50 severe
+     driving with a tip; pipe pile 0.70 / 0.60; Extreme Event 1.0 [6.5.5]. Strength demand = largest pile reaction + γ_DR·DR [T.3.4.1-1 note]. */
+  function pileStructural(pc, eeBest){
+    const p=S.piles, shp=p.pileShape||"hp", Fy=+p.Fy||50, E=29000, sev=p.drive==="severe";
+    const out={shp, Fy, drive:sev?"severe":"good", Pu:pc.Pstr, PuTop:pc.PstrTop, DR:pc.DR, gDR:pc.gDR, PuLs:pc.PstrLs, PuLbl:pc.PstrLbl,
+      Pee:eeBest?eeBest.Pmax:null, eeLbl:eeBest&&eeBest.c?eeBest.c.lbl:"", ok:false};
+    if(shp==="hp"){
+      const nm=hpAuto(p), sx=HP_SHAPES[nm]; if(!sx){ out.note="unknown H-pile section"; return out; }
+      const [A,d,bf,tf,tw,htw]=sx;
+      const lamF=0.56*Math.sqrt(E/Fy), lamW=1.49*Math.sqrt(E/Fy);          // T.6.9.4.2.1-1: flanges of rolled I-sections / webs of rolled I-sections
+      const bF=bf/2, btF=bF/tf, hW=htw*tw;
+      const beOf=(b,bt,lam,c1,c2)=>{ if(bt<=lam+1e-12) return {be:b, slender:false};   // F_cr = F_y: limit λ_r·√(F_y/F_cr) = λ_r
+        const Fel=Math.pow(c2*lam/bt,2)*Fy, r=Math.sqrt(Fel/Fy); return {be:b*(1-c1*r)*r, slender:true, Fel, r}; };
+      const fl=beOf(bF,btF,lamF,0.22,1.49), wb=beOf(hW,htw,lamW,0.18,1.31);           // T.6.9.4.2.2b-1
+      const Aeff=A-4*(bF-fl.be)*tf-(hW-wb.be)*tw;                                     // Eq. 6.9.4.2.2a-3
+      const phiC=sev?0.50:0.60;
+      Object.assign(out,{sec:nm, auto:!p.strSec, A, d, bf, tf, tw, htw, lamF, lamW, bF, btF, hW, fl, wb, Aeff, Pn:Fy*Aeff, phiC, ok:true});
+    }else if(shp==="round"){
+      const D=+p.pileSize||0, t=+p.pipeT||0;
+      if(!(D>0&&t>0&&2*t<D)){ out.note="pipe diameter / wall thickness not valid (panel I-7)"; return out; }
+      const A=Math.PI/4*(D*D-Math.pow(D-2*t,2)), Dt=D/t, l1=0.11*E/Fy, l2=0.45*E/Fy;
+      let Aeff=A, mode="compact";
+      if(Dt>l1+1e-12){ if(Dt<=l2+1e-12){ Aeff=(0.038*E/(Fy*Dt)+2/3)*A; mode="slender"; } else { out.note="D/t > 0.45E/F_y: outside 6.9.4.2.2c"; out.D=D; out.t=t; out.Dt=Dt; out.l2=l2; return out; } }
+      const phiC=sev?0.60:0.70;
+      Object.assign(out,{sec:"Pipe "+fmt(D,2)+" × "+fmt(t,3)+" in (unfilled)", D, t, A, Dt, l1, l2, mode, Aeff, Pn:Fy*Aeff, phiC, ok:true});
+    }else{
+      const Pr=+p.PrUser||0;
+      if(!(Pr>0)){ out.note="square / precast pile: enter its factored structural resistance P_r (panel I-7)"; return out; }
+      Object.assign(out,{sec:"Square / precast (P_r entered)", user:true, Pr, ok:true});
@@ -2371,0 +2531,7 @@ function computeAll(){
+    out.Pr=out.user? out.Pr : out.phiC*out.Pn;
+    out.PrEE=out.user? null : 1.0*out.Pn;
+    out.dcS=out.Pu/out.Pr;
+    out.dcE=(out.Pee!=null&&out.PrEE)? out.Pee/out.PrEE : null;
+    out.dc=Math.max(out.dcS, out.dcE??-1);
+    out.gov=(out.dcE!=null&&out.dcE>out.dcS)?"ee":"str";
+    return out;
@@ -2482,0 +2649,24 @@ function computeAll(){
+  /* ---- ABCHK: concrete cover advisory [5.10.1, Table 5.10.1-1] — PASS/FAIL notes only, no result depends on it ---- */
+  {
+    const T={saltwater:[4.0,2.5,2.5], earth:[3.0,2.0,2.0], coastal:[3.0,2.0,2.0], deicing:[2.5,2.0,1.5], other:[2.0,2.0,1.5], limited:[1.5,1.0,1.0]};
+    const SIT={saltwater:"direct exposure to salt water", earth:"cast against earth", coastal:"coastal", deicing:"exposure to deicing salts",
+      other:"severe to moderate exposure, other than noted", limited:"limited exposure, up to #11 bars"};
+    const exp=T[m.coverExp]? m.coverExp : "deicing", ci={A:0,B:1,C:2}, cat=ci[m.coverCat]!=null? m.coverCat : "A";
+    const wcm=[0.8,1.0,1.2].includes(+m.coverWcm)? +m.coverWcm : 1.0;
+    const req=(sit,c)=>Math.max(1.0, T[sit][ci[c]]*wcm);
+    const topSit=(exp==="saltwater"||exp==="coastal"||exp==="limited")? exp : "other";
+    const botSit=exp==="saltwater"? "saltwater" : "earth";
+    const catBW=S.reinf.coatBW? "B" : cat;
+    const pileBot=fn.branch==="pile";
+    const rows=[
+      {name:"Footing — bottom (cast against earth)", prov:pileBot? Math.max(0,+S.piles.embed||0)+Math.max(0,+S.piles.clrTop||0) : +m.coverF,
+        provTxt:pileBot?"e_pile + c_top (panel I-7)":"c_F (panel I-2)", sit:botSit, cat},
+      {name:"Footing — top", prov:+m.coverF, provTxt:"c_F (panel I-2)", sit:topSit, cat},
+      {name:"Stem — faces", prov:+m.coverT, provTxt:"c_wall (panel I-2)", sit:exp, cat},
+      {name:"Backwall — faces", prov:+m.coverT, provTxt:"c_wall (panel I-2)", sit:exp, cat:catBW}];
+    rows.forEach(r=>{ r.base=T[r.sit][ci[r.cat]]; r.req=req(r.sit,r.cat); r.ok=r.prov>=r.req-1e-9; r.sitTxt=SIT[r.sit]; });
+    R.checks.cover={rows, exp, cat, wcm, nFail:rows.filter(r=>!r.ok).length};
+    const bad=rows.filter(r=>!r.ok);
+    if(bad.length) warn(`Concrete cover (advisory) below Table 5.10.1-1: ${bad.map(r=>`${r.name} ${fmt(r.prov,2)} in < ${fmt(r.req,2)} in ("${r.sitTxt}", category ${r.cat})`).join("; ")}${wcm!==1?"; W/CM factor "+fmt(wcm,1):""} [5.10.1] (Tab 5 §5.0a; exposure in panel I-2).`);
+  }
+
@@ -2491,4 +2681,17 @@ function computeAll(){
-  const MuBW=gEH_max*Mbw_EH+gLSbw*Mbw_LS+GP.ES[1]*Mbw_ES, VuBW=gEH_max*Vbw_EH+gLSbw*Vbw_LS+GP.ES[1]*Vbw_ES;
-  const MsBW=Mbw_EH+Mbw_LS+Mbw_ES;
-  R.bwDem={hbwRet,heqBW,Mbw_EH,Vbw_EH,Mbw_LS,Vbw_LS,MuBW,VuBW,MsBW,
-    lbl:`${gEH_max.toFixed(2)}·EH + ${gLSbw.toFixed(2)}·LS (Strength I)`, gLS:gLSbw};
+  // ABCHK: live load on top of the backwall (FHWA LRFD steel girder example, Design Step 7.5: vertical wheel load at the front top
+  // corner, arm t_bw/2 to the backwall centroid; backwall only, not the stem or footing). Design truck wheel P_w = 16 kip [3.6.1.2.2] on a
+  // 20 in tire [3.6.1.2.5], spread along the backwall over the cantilever (overhang) strip E = 45 + 10X in, X = h_bw (ft), the distance
+  // from the load to the backwall base [T.4.6.2.1.3-1]; the second wheel of the axle 6 ft away [3.6.1.2.2]: when the strips overlap
+  // (E > 72 in) both wheels are spread over E + 72 in. w_LL = m·(1 + IM)·max(P_w/E, 2P_w/(E + 72))·12 (kip/ft), m = 1.20 (one lane,
+  // T.3.6.1.1.2-1), IM = 0.33 [T.3.6.2.1-1]. M_LL = w_LL·t_bw/2 (back-face tension, as EH and LS). No horizontal shear.
+  const bwMode=(S.bwLL&&S.bwLL.mode==="off")?"off":"wheel";
+  const bwW={mode:bwMode, Pw:16, IM:0.33, m:1.20, X:g.hbw, E:45+10*g.hbw, sAx:72, e:g.tbw/2};
+  bwW.w1=bwW.Pw/bwW.E; bwW.w2=2*bwW.Pw/(bwW.E+bwW.sAx); bwW.two=bwW.w2>bwW.w1;
+  bwW.wLL=bwMode==="off"?0 : bwW.m*(1+bwW.IM)*Math.max(bwW.w1,bwW.w2)*12;   // kip/ft
+  bwW.M=bwW.wLL*bwW.e;                                                       // kip-ft/ft, unfactored
+  const mBW=LIMITS["Strength I"].mLL||1, mBWs=LIMITS["Service I"].mLL||1;    // OWNB: RIDOT design load multiplier m on LL+IM
+  bwW.mU=mBW; bwW.mS=mBWs;
+  const MuBW=gEH_max*Mbw_EH+gLSbw*Mbw_LS+GP.ES[1]*Mbw_ES+gLSbw*mBW*bwW.M, VuBW=gEH_max*Vbw_EH+gLSbw*Vbw_LS+GP.ES[1]*Vbw_ES;
+  const MsBW=Mbw_EH+Mbw_LS+Mbw_ES+mBWs*bwW.M;
+  R.bwDem={hbwRet,heqBW,Mbw_EH,Vbw_EH,Mbw_LS,Vbw_LS,Mbw_ES,Vbw_ES,MuBW,VuBW,MsBW,wheel:bwW,
+    lbl:`${gEH_max.toFixed(2)}·EH + ${gLSbw.toFixed(2)}·LS${bwMode==="off"?"":` + ${(gLSbw*mBW).toFixed(2)}·LL (wheel on the backwall)`} (Strength I)`, gLS:gLSbw};
@@ -2565,0 +2769,36 @@ function computeAll(){
+  /* ---- ABCHK: stem dowels into the footing — development (hooked 5.10.8.2.4a / straight 5.10.8.2.1a) in the footing depth,
+     and the lap splice of the dowels with the stem bars [5.10.8.4.3a]. Dowels = the stem back-face bars (same size and spacing). ---- */
+  {
+    const cS=R.checks.stemFlex, bar=BARS[S.reinf.stem.size], db=bar.db, Ab=bar.Ab, sp=+S.reinf.stem.sp;
+    const fcD=Math.min(m.fc,15), fc4=Math.pow(fcD,0.25);
+    // basic development length, Eq. 5.10.8.2.1a-2, λer = λ = 1.0 (normal weight); the bracket is taken as 0 when F_h/A_b ≥ f_y
+    const ldbOf=Fh=>{ const t=Math.max(0,m.fy-Fh/Ab); return 0.17*db*Math.pow(t/(1.97*fc4),2); };
+    // λrc, Eq. 5.10.8.2.1c-2 with k_tr = 0 (no transverse reinforcement counted) and β_t = 0 (no transverse compression counted):
+    // λrc = d_b·c_b/c_b² = d_b/c_b, 0.3 ≤ λrc ≤ 1.0 (Eq. 5.10.8.2.1c-1)
+    const lrcOf=cb=>Math.min(1,Math.max(0.3,db/cb));
+    // available straight embedment below the top of footing: to the top of the bottom mat (two layers of the toe bar), which sits on
+    // the clear cover (spread) or on the clear cover over the pile heads (pile embedment + clear cover)
+    const cBot=fn.branch==="pile"? Math.max(0,+S.piles.embed||0)+Math.max(0,+S.piles.clrTop||0) : +m.coverF;
+    const dbT=BARS[S.reinf.toe.size].db, lAv=g.tf*12-cBot-2*dbT;
+    // in the footing the dowel is interior: c_b = half the centre-to-centre spacing
+    const cbF=sp/2, lrcF=lrcOf(cbF);
+    // standard 90° hook [5.10.2.1]: inside bend diameter 6d_b (#3–#8) or 8d_b (#9–#11) [T.5.10.2.3-1]; R = centre of bend to bar centroid
+    const nBar=+S.reinf.stem.size, Dbend=(nBar>=9?8:6)*db, Rh=Dbend/2+db/2;
+    const nu=Math.min(0.65,Math.max(0.45,0.85-m.fc/20));            // CTT node [T.5.8.2.5.3a-1]
+    const Fh=db*Rh*nu*m.fc;                                          // Eq. 5.10.8.2.4a-2
+    const ldbH=ldbOf(Fh), ldH=ldbH*lrcF;                             // Eqs. 5.10.8.2.1a-2, -1 (λrl = λcf = 1.0)
+    const ldhRaw=ldH+Rh+db/2, ldhMin=Math.max(8*db,6), ldh=Math.max(ldhRaw,ldhMin);   // Eq. 5.10.8.2.4a-1
+    const ldbS=ldbOf(0), ldS=Math.max(12,ldbS*lrcF);                 // straight dowel in the footing
+    const hook=S.reinf.dwlEnd!=="straight", lReq=hook?ldh:ldS;
+    // lap splice in the stem above the joint: c_b = least of the cover to the bar centre and half the spacing
+    const cbL=Math.min(+m.coverT+db/2, sp/2), lrcL=lrcOf(cbL), ldL=Math.max(12,ldbS*lrcL);
+    const AsR=isFinite(cS.AsReq)&&cS.AsReq>0? cS.AsReq : NaN, ratio=isFinite(AsR)? cS.As/AsR : Infinity;
+    const pct=Math.max(0,Math.min(100,+S.reinf.dwlPct||0));
+    const classA=ratio>=2-1e-9 && pct<=50+1e-9, kLap=classA?1.0:1.3, lapReq=Math.max(12,kLap*ldL);
+    const lapProv=Math.max(0,+S.reinf.dwlLap||0);
+    R.checks.dowel={bar:S.reinf.stem.size, db, Ab, sp, fcD, fc4, cBot, dbT, lAv, cbF, lrcF, nBar, Dbend, Rh, nu, Fh, ldbH, ldH, ldhRaw, ldhMin, ldh,
+      ldbS, ldS, hook, lReq, dc:lAv>0? lReq/lAv : 99, cbL, lrcL, ldL, As:cS.As, AsR, ratio, pct, classA, kLap, lapReq, lapProv,
+      dcLap:lapProv>0? lapReq/lapProv : null};
+    if(!(lAv>0)) warn("Stem dowels: no embedment depth available in the footing (t_f − bottom cover − bottom mat ≤ 0) — check panels I-1, I-2"+(fn.branch==="pile"?", I-7":"")+".","err");
+  }
+
@@ -2719 +2958 @@ function computeAll(){
-    if(R.checks.bearing.q>fn.qn) warn(`Factored bearing pressure (${fmt(R.checks.bearing.q)} ksf) exceeds the NOMINAL resistance q_n — check inputs; D/C is ${fmt(R.checks.bearing.dc)}.`, R.checks.bearing.dc>1?"err":"warn");
+    if(R.checks.bearing.q>(R.checks.bearing.qn??fn.qn)) warn(`Factored bearing pressure (${fmt(R.checks.bearing.q)} ksf) exceeds the NOMINAL resistance q_n — check inputs; D/C is ${fmt(R.checks.bearing.dc)}.`, R.checks.bearing.dc>1?"err":"warn");
@@ -3113,0 +3353,4 @@ function computeAll(){
+    { const T=defaultState(), dropDef=(o,t,keys)=>{ if(o) keys.forEach(k=>{ if(JSON.stringify(o[k])===JSON.stringify(t[k])) delete o[k]; }); };   // ABCHK: new inputs at their default
+      dropDef(fpS.mat,T.mat,["coverExp","coverCat","coverWcm"]); dropDef(fpS.fnd,T.fnd,["qnMode","qnC","qnPhi","qnGam","qnDw","qnIncl","qnDepth"]);
+      dropDef(fpS.piles,T.piles,["strSec","Fy","drive","pipeT","PrUser"]); dropDef(fpS.reinf,T.reinf,["dwlEnd","dwlLap","dwlPct"]);
+      dropDef(fpS.seismic,T.seismic,["siteClass"]); if(fpS.bwLL&&fpS.bwLL.mode==="wheel") delete fpS.bwLL; }
@@ -3144,0 +3388,2 @@ function computeAll(){
+    const ps=R.checks.pileStr;   // ABCHK
+    if(ps) addD("pileS","Pile structural axial [10.7.3.13]",ps.ok?ps.dc:0,"tab-found",ps.ok?(ps.sec+" — "+(ps.gov==="ee"?"Extreme Event I":(ps.PuLs||""))+(ps.DR>0?", incl. γDR·DR":"")):(ps.note||"not checked"),!ps.ok);
@@ -3148,0 +3394,3 @@ function computeAll(){
+  if(R.checks.dowel){ const dw=R.checks.dowel;   // ABCHK: stem dowels into the footing
+    addD("dowelDev","Stem dowel development into the footing ["+(dw.hook?"5.10.8.2.4":"5.10.8.2.1a")+"]",dw.dc,"tab-struct",(dw.hook?"hooked ℓdh = ":"straight ℓd = ")+fmt(dw.lReq,1)+" in vs "+fmt(dw.lAv,1)+" in available");
+    addD("dowelLap","Stem dowel lap splice [5.10.8.4.3a]",dw.dcLap??0,"tab-struct",dw.lapProv>0?"Class "+(dw.classA?"A":"B")+": "+fmt(dw.lapReq,1)+" in required vs "+fmt(dw.lapProv,1)+" in":"not detailed — provide ≥ "+fmt(dw.lapReq,1)+" in (Class "+(dw.classA?"A":"B")+")",!(dw.lapProv>0)); }
@@ -3218,0 +3467 @@ const DASH_ANCHOR={sliding:"o-slide",ecc:"o-ecc",bearing:"o-brg",seat:"o-seat",
+  pileS:"o-pilestr",dowelDev:"o-str-dowel",dowelLap:"o-str-dowel",   // ABCHK
@@ -3321 +3570 @@ function renderTabLoads(R){
-    <b>11.</b> Seismic: ${S.seismic.on&&S.geom.HsupMode==="single"?`<b>Extreme Event I ON — single-span bridge</b>: static earth pressure + superstructure connection force A<sub>s</sub>·(DC+DW)·s<sub>EQ</sub> [3.10.9.1]; no M–O increment and no wall / soil-block inertia [C3.10.9.1, 4.7.4.2] (<span class="xlink" data-jump="tab-stab|o-mo">Tab 3 §3.6a</span>); wingwalls left to the engineer's judgment; EE resistance factors per panel I-11`:S.seismic.on?`<b>Extreme Event I ON</b> — M–O with k<sub>h</sub> = ${fmt(+S.seismic.khR,2)}·A<sub>s</sub>, ΔP<sub>AE</sub> at ${fmt(+S.seismic.hEQr,2)}H, wall/soil/superstructure inertia included; EE resistance factors per panel I-11`:`OFF — minimum connection force [3.10.9] surfaced as a note only`}.<br>
+    <b>11.</b> Seismic: ${S.seismic.on&&S.geom.HsupMode==="single"?`<b>Extreme Event I ON — single-span bridge</b>: static earth pressure + superstructure connection force A<sub>s</sub>·(DC+DW)·s<sub>EQ</sub> [3.10.9.1]; no M–O increment and no wall / soil-block inertia [C3.10.9.1, 4.7.4.2] (<span class="xlink" data-jump="tab-stab|o-mo">Tab 3 §3.6a</span>); wingwalls left to the engineer's judgment; EE resistance factors per panel I-11`:S.seismic.on?`<b>Extreme Event I ON</b> — M–O with k<sub>h</sub> = ${fmt(+S.seismic.khR,2)}·k<sub>h0</sub>, k<sub>h0</sub> = ${["A","B","B/C"].includes(S.seismic.siteClass)?"1.2·A<sub>s</sub> (Site Class "+esc(S.seismic.siteClass)+")":"A<sub>s</sub>"+(S.seismic.siteClass?" (Site Class "+esc(S.seismic.siteClass)+")":" (site class not selected)")} [11.6.5.2.1], ΔP<sub>AE</sub> at ${fmt(+S.seismic.hEQr,2)}H, wall/soil/superstructure inertia included; EE resistance factors per panel I-11`:`OFF — minimum connection force [3.10.9] surfaced as a note only`}.<br>
@@ -3681,0 +3931,21 @@ function renderTabStab(R){
+      ${(()=>{ const qc=bc.qc; if(!qc) return "";   /* ABCHK: q_n computed per 10.6.3.1.2a for the governing permutation */
+        const f3=(x)=>fmtT(x,3), phi0=qc.phD<=0;
+        return eqB("Nominal bearing resistance q<sub>n</sub> from the soil parameters — governing permutation","AASHTO LRFD 10th Ed. 10.6.3.1.2a (Eqs. 10.6.3.1.2a-1 to -10; Tables 10.6.3.1.2a-1, -2, -3), 10.6.1.3",[
+          "q_n = c\\,N_{cm} + \\gamma_q D_f N_{qm} C_{wq} + 0.5\\,\\gamma_f B' N_{\\gamma m} C_{w\\gamma}\\,, \\quad N_{cm} = N_c s_c i_c,\\ N_{qm} = N_q s_q d_q i_q,\\ N_{\\gamma m} = N_\\gamma s_\\gamma i_\\gamma",
+          `B' = ${f3(qc.B)}\\ \\text{ft},\\ L' = ${f3(qc.L)}\\ \\text{ft}\\ (B'/L' = ${fmtT(qc.rBL,4)}),\\quad c = ${f3(qc.c)}\\ \\text{ksf},\\ \\varphi_f = ${fmtT(qc.phD,1)}°,\\ \\gamma_q = ${f3(qc.gq)},\\ \\gamma_f = ${f3(qc.gf)}\\ \\text{kcf},\\ D_f = ${f3(qc.Df)}\\ \\text{ft}`,
+          phi0? `N_c = \\pi + 2 = ${f3(qc.Nc)},\\ N_q = 1,\\ N_\\gamma = 0`
+              : `N_q = e^{\\pi\\tan\\varphi_f}\\tan^2(45° + \\varphi_f/2) = ${f3(qc.Nq)},\\quad N_c = (N_q - 1)\\cot\\varphi_f = ${f3(qc.Nc)},\\quad N_\\gamma = 2(N_q + 1)\\tan\\varphi_f = ${f3(qc.Ng)}`,
+          phi0? `s_c = 1 + \\dfrac{B'}{5L'} = ${f3(qc.sc)},\\ s_q = s_\\gamma = 1.0`
+              : `s_c = 1 + \\dfrac{B'}{L'}\\dfrac{N_q}{N_c} = ${f3(qc.sc)},\\quad s_q = 1 + \\dfrac{B'}{L'}\\tan\\varphi_f = ${f3(qc.sq)},\\quad s_\\gamma = 1 - 0.4\\dfrac{B'}{L'} = ${f3(qc.sg)}`,
+          qc.depth&&!phi0? `d_q = 1 + 2\\tan\\varphi_f(1-\\sin\\varphi_f)^2\\tan^{-1}\\!\\dfrac{D_f}{B'} = ${f3(qc.dqRaw)} \\le 1.4 \\;\\Rightarrow\\; d_q = ${f3(qc.dq)}` : `d_q = 1.0 \\quad(\\text{depth factor not applied, panel I-4})`,
+          ...(qc.incl&&qc.H>0? [
+            `H = \\sqrt{H_x^2 + H_y^2} = \\sqrt{${fmtT(qc.Hx,1)}^2 + ${fmtT(qc.Hy,1)}^2} = ${fmtT(qc.H,1)}\\ \\text{kip},\\quad V = ${fmtT(qc.V,1)}\\ \\text{kip}\\ (\\text{unfactored}),\\quad \\theta = ${fmtT(qc.thDeg,2)}°\\ \\text{from the side } L'`,
+            `n = \\dfrac{2 + L'/B'}{1 + L'/B'}\\cos^2\\theta + \\dfrac{2 + B'/L'}{1 + B'/L'}\\sin^2\\theta = ${f3(qc.n)}`,
+            phi0? `i_c = 1 - \\dfrac{nH}{c B' L' N_c} = ${f3(qc.ic)}`
+                : `1 - \\dfrac{H}{V + cB'L'\\cot\\varphi_f} = ${fmtT(qc.base,4)}\\,, \\quad i_q = (${fmtT(qc.base,4)})^{${f3(qc.n)}} = ${f3(qc.iq)},\\quad i_\\gamma = (${fmtT(qc.base,4)})^{${f3(qc.n+1)}} = ${f3(qc.ig)},\\quad i_c = i_q - \\dfrac{1 - i_q}{N_q - 1} = ${f3(qc.ic)}`]
+            : [`i_c = i_q = i_\\gamma = 1.0 \\quad(${qc.incl?"no horizontal load":"load inclination factors not applied, panel I-4"})`]),
+          `D_w = ${f3(qc.Dw)}\\ \\text{ft} \\;\\Rightarrow\\; C_{wq} = ${f3(qc.Cwq)},\\ C_{w\\gamma} = ${f3(qc.Cwg)} \\quad(\\text{Table 10.6.3.1.2a-2})`,
+          `N_{cm} = ${f3(qc.Ncm)},\\ N_{qm} = ${f3(qc.Nqm)},\\ N_{\\gamma m} = ${f3(qc.Ngm)}`,
+          `q_n = (${f3(qc.c)})(${f3(qc.Ncm)}) + (${f3(qc.gq)})(${f3(qc.Df)})(${f3(qc.Nqm)})(${f3(qc.Cwq)}) + 0.5(${f3(qc.gf)})(${f3(qc.B)})(${f3(qc.Ngm)})(${f3(qc.Cwg)}) = ${f3(qc.tC)} + ${f3(qc.tQ)} + ${f3(qc.tG)} = ${fmtT(qc.qn)}\\ \\text{ksf}`],
+          `Computed for every permutation with its own B′, L′ [10.6.1.3] and its unfactored H and V (the loads present in the permutation at γ = 1.0); the governing permutation is shown. N factors from the Prandtl, Reissner and Vesić expressions of Table 10.6.3.1.2a-1. θ is the plan direction of H measured from the side L′ (H along B′ gives 90°). D<sub>w</sub> = depth of groundwater below the ground surface (${qc.hw>0?"from h<sub>w</sub> = "+fmt(qc.hw,2)+" ft above the footing base":"panel I-4 input"}), C<sub>w</sub> interpolated linearly between the rows of Table 10.6.3.1.2a-2. γ<sub>q</sub>, D<sub>f</sub> = the foundation soil above the base (panel I-4). ${qc.incl?"C10.6.3.1.2a notes that the inclination factors with φ<sub>b</sub> may be conservative for D<sub>f</sub>/B ≥ about 1; they can be turned off in panel I-4.":""}${qc.swap?" B′ > L′ here: the smaller effective dimension is used as B.":""}`);
+      })()}
@@ -3684,3 +3954,3 @@ function renderTabStab(R){
-        `q_R = (${fmtT(bc.phiB??fn.phiB)})(${fmtT(fn.qn)}) = ${fmtT((bc.phiB??fn.phiB)*fn.qn)}\\ \\text{ksf}`],
-        "q_n from the geotechnical report; φ_b per the governing limit state (extreme-event value at EE-I).")}
-      ${checkLine("Bearing",`\\dfrac{q_f}{q_R} = \\dfrac{${fmtT(bc.q)}}{${fmtT((bc.phiB??fn.phiB)*fn.qn)}}`,bc.dc)}
+        `q_R = (${fmtT(bc.phiB??fn.phiB)})(${fmtT(bc.qn??fn.qn)}) = ${fmtT((bc.phiB??fn.phiB)*(bc.qn??fn.qn))}\\ \\text{ksf}`],
+        (bc.qc?"q_n computed above from the soil parameters (panel I-4, \"compute from soil parameters\")":"q_n from the geotechnical report (panel I-4)")+"; φ_b per the governing limit state (extreme-event value at EE-I).")}
+      ${checkLine("Bearing",`\\dfrac{q_f}{q_R} = \\dfrac{${fmtT(bc.q)}}{${fmtT((bc.phiB??fn.phiB)*(bc.qn??fn.qn))}}`,bc.dc)}
@@ -3728 +3998,3 @@ function renderTabStab(R){
-        `k_h = ${fmt(+S.seismic.khR,2)}\\,A_s = ${fmt(+S.seismic.khR,2)}\\times${fmt(+S.seismic.As,3)} = ${fmtT(q.kh,4)}\\,, \\quad k_v = ${fmtT(q.kv,3)}\\,, \\quad \\theta_{MO} = \\tan^{-1}\\!\\dfrac{k_h}{1-k_v} = ${fmtT(q.thd,2)}°`])}
+        `k_{h0} = ${q.kh0f===1.2?"1.2\\,A_s":"A_s"} = ${q.kh0f===1.2?"1.2\\times":""}${fmt(+S.seismic.As,3)} = ${fmtT(q.kh0,4)} \\quad(\\text{Site Class ${q.sc?esc(q.sc):"not selected"}})`,
+        `k_h = ${fmt(+S.seismic.khR,2)}\\,k_{h0} = ${fmt(+S.seismic.khR,2)}\\times${fmtT(q.kh0,4)} = ${fmtT(q.kh,4)}\\,, \\quad k_v = ${fmtT(q.kv,3)}\\,, \\quad \\theta_{MO} = \\tan^{-1}\\!\\dfrac{k_h}{1-k_v} = ${fmtT(q.thd,2)}°`],
+        "k_h0 = A_s at the wall base; 1.2·A_s for a wall founded on Site Class A, B or B/C [11.6.5.2.1] (site class in panel I-11"+(q.sc?"":"; not selected, so A_s")+"). k_h = ratio × k_h0 [11.6.5.2.2]. The superstructure inertia below uses A_s [3.10.9].")}
@@ -3820 +4092 @@ function renderTabFound(R){
-    ${pc.DR>0?eqB("Structural pile axial demand with drag load (for the pile structural check, not made in this tool)","AASHTO T.3.4.1-1 note, 3.11.8",[
+    ${pc.DR>0?eqB("Structural pile axial demand with drag load (pile structural check in §4.4a)","AASHTO T.3.4.1-1 note, 3.11.8",[
@@ -3823 +4095 @@ function renderTabFound(R){
-      "P_max,Str = largest pile reaction of the strength states ("+esc(pc.PstrLs||"")+": "+esc(pc.PstrLbl||"")+"). Applies at the neutral plane; compare with the structural resistance of the pile [10.7.3.13].")
+      "P_max,Str = largest pile reaction of the strength states ("+esc(pc.PstrLs||"")+": "+esc(pc.PstrLbl||"")+"). Applies at the neutral plane; compared with the structural resistance of the pile in <span class=\"xlink\" data-jump=\"tab-found|o-pilestr\">§4.4a</span> [10.7.3.13].")
@@ -3834,0 +4107,51 @@ function renderTabFound(R){
+  /* ---- ABCHK 4.4a Pile structural axial resistance; governing = lesser of geotechnical and structural ---- */
+  { const ps=R.checks.pileStr;
+    if(ps){
+      let secH="";
+      if(ps.ok&&ps.shp==="hp"){
+        const fl=ps.fl, wb=ps.wb;
+        const elLines=(nm,o,b,t,bt,lam,c1,c2,n)=> o.slender
+          ? [`\\text{${nm}: } \\dfrac{b}{t} = ${fmtT(bt,2)} > \\lambda_r = ${fmtT(lam,2)} \\;\\Rightarrow\\; F_{el} = \\left(c_2\\dfrac{\\lambda_r}{b/t}\\right)^2 F_y = \\left(${fmtT(c2,2)}\\dfrac{${fmtT(lam,2)}}{${fmtT(bt,2)}}\\right)^2(${fmtT(ps.Fy,1)}) = ${fmtT(o.Fel,2)}\\ \\text{ksi}`,
+             `b_e = b\\left(1 - c_1\\sqrt{\\dfrac{F_{el}}{F_{cr}}}\\right)\\sqrt{\\dfrac{F_{el}}{F_{cr}}} = ${fmtT(b,3)}(1 - ${fmtT(c1,2)}(${fmtT(o.r,4)}))(${fmtT(o.r,4)}) = ${fmtT(o.be,3)}\\ \\text{in} \\quad(F_{cr} = F_y,\\ ${n})`]
+          : [`\\text{${nm}: } \\dfrac{b}{t} = ${fmtT(bt,2)} \\le \\lambda_r = ${fmtT(lam,2)} \\;\\Rightarrow\\; \\text{nonslender},\\ b_e = b = ${fmtT(b,3)}\\ \\text{in}`];
+        secH=eqB(`Effective area and nominal resistance — ${esc(ps.sec)}${ps.auto?" (automatic: lightest HP of the pile size)":""}`,"AASHTO LRFD 10th Ed. 10.7.3.13.1, 6.15.3.1, 6.9.4.1.1, 6.9.4.2.1 (Table 6.9.4.2.1-1), 6.9.4.2.2 (Eqs. 6.9.4.2.2a-1, -3; 6.9.4.2.2b-1 to -4; Table 6.9.4.2.2b-1)",[
+          `A_g = ${fmtT(ps.A,2)}\\ \\text{in}^2,\\ b_f = ${fmtT(ps.bf,3)},\\ t_f = ${fmtT(ps.tf,3)},\\ t_w = ${fmtT(ps.tw,3)}\\ \\text{in},\\ h/t_w = ${fmtT(ps.htw,1)} \\quad(F_y = ${fmtT(ps.Fy,1)}\\ \\text{ksi},\\ E = 29{,}000\\ \\text{ksi})`,
+          `\\lambda_{r,flange} = 0.56\\sqrt{E/F_y} = ${fmtT(ps.lamF,2)}\\,, \\qquad \\lambda_{r,web} = 1.49\\sqrt{E/F_y} = ${fmtT(ps.lamW,2)}`,
+          ...elLines("flange, half width",fl,ps.bF,ps.tf,ps.btF,ps.lamF,0.22,1.49,"c_1 = 0.22,\\ c_2 = 1.49"),
+          ...elLines("web, clear height",wb,ps.hW,ps.tw,ps.htw,ps.lamW,0.18,1.31,"c_1 = 0.18,\\ c_2 = 1.31"),
+          `A_{eff} = A_g - \\Sigma(b - b_e)t = ${fmtT(ps.A,2)} - 4(${fmtT(ps.bF,3)} - ${fmtT(fl.be,3)})(${fmtT(ps.tf,3)}) - (${fmtT(ps.hW,3)} - ${fmtT(wb.be,3)})(${fmtT(ps.tw,3)}) = ${fmtT(ps.Aeff,3)}\\ \\text{in}^2`,
+          `P_n = F_{cr}A_{eff} = F_y A_{eff} = (${fmtT(ps.Fy,1)})(${fmtT(ps.Aeff,3)}) = ${fmtT(ps.Pn,1)}\\ \\text{kip}`],
+          "Vertical pile fully embedded in soil, so laterally supported over its length: no flexural buckling (P_e → ∞, P_n = P_o for nonslender elements, F_cr = F_y in the effective width of slender elements). A pile through water or air, or exposed by scour, needs the unsupported length plus the depth to fixity [10.7.3.13.4, 6.15.3.3] — not covered here.");
+      }else if(ps.ok&&ps.shp==="round"){
+        secH=eqB(`Effective area and nominal resistance — ${esc(ps.sec)}`,"AASHTO LRFD 10th Ed. 10.7.3.13.1, 6.15.3.1, 6.9.4.2.2c (Eqs. 6.9.4.2.2c-1, -2)",[
+          `A_g = \\tfrac{\\pi}{4}\\left(D^2 - (D-2t)^2\\right) = \\tfrac{\\pi}{4}\\left(${fmtT(ps.D,2)}^2 - ${fmtT(ps.D-2*ps.t,3)}^2\\right) = ${fmtT(ps.A,3)}\\ \\text{in}^2\\,, \\qquad \\dfrac{D}{t} = ${fmtT(ps.Dt,2)}`,
+          ps.mode==="compact"? `\\dfrac{D}{t} \\le 0.11\\dfrac{E}{F_y} = ${fmtT(ps.l1,2)} \\;\\Rightarrow\\; A_{eff} = A_g = ${fmtT(ps.Aeff,3)}\\ \\text{in}^2`
+            : `0.11\\dfrac{E}{F_y} = ${fmtT(ps.l1,2)} < \\dfrac{D}{t} \\le 0.45\\dfrac{E}{F_y} = ${fmtT(ps.l2,2)} \\;\\Rightarrow\\; A_{eff} = \\left(\\dfrac{0.038E}{F_y(D/t)} + \\dfrac{2}{3}\\right)A_g = ${fmtT(ps.Aeff,3)}\\ \\text{in}^2`,
+          `P_n = F_y A_{eff} = (${fmtT(ps.Fy,1)})(${fmtT(ps.Aeff,3)}) = ${fmtT(ps.Pn,1)}\\ \\text{kip}`],
+          "Unfilled steel pipe, fully embedded in soil (laterally supported). A concrete-filled pipe is a composite member [6.9.5] and is not covered.");
+      }
+      const resH= ps.ok? (ps.user
+        ? `<div class="note-box">Square / precast pile: factored structural resistance P<sub>r</sub> = <b>${fmt(ps.Pr,1)} kip</b> as entered (panel I-7), from the pile's own design [10.7.3.13.2, 5.6.4.4]. Strength only; Extreme Event not checked here.</div>`
+        : eqB("Factored structural axial resistance","AASHTO LRFD 10th Ed. 6.5.4.2, 6.5.5, 6.15.2",[
+            `P_r = \\varphi_c P_n = (${fmtT(ps.phiC,2)})(${fmtT(ps.Pn,1)}) = ${fmtT(ps.Pr,1)}\\ \\text{kip} \\quad(\\text{Strength})`,
+            ...(ps.Pee!=null?[`P_{r,EE} = 1.0\\,P_n = ${fmtT(ps.PrEE,1)}\\ \\text{kip} \\quad(\\text{Extreme Event})`]:[])],
+            `φ<sub>c</sub> = ${fmt(ps.phiC,2)}: axial resistance alone of ${ps.shp==="hp"?"an H-pile":"a pipe pile"} where driving damage is likely, ${ps.drive==="severe"?"severe driving with a pile tip":"good driving, no pile tip needed"} (panel I-7) [6.5.4.2]. The φ<sub>c</sub> of combined axial and flexure (${ps.shp==="hp"?"0.70":"0.80"}, undamaged zone near the head) applies with the moments of the lateral analysis, which is outside this tool.`)) : "";
+      const demH= eqB("Structural axial demand per pile","AASHTO LRFD 10th Ed. Table 3.4.1-1 (note on DR), 3.11.8",[
+          `P_{u} = P_{max,Str} + \\gamma_{DR}\\,DR = ${fmtT(ps.PuTop)} + (${fmtT(ps.gDR,2)})(${fmtT(ps.DR)}) = ${fmtT(ps.Pu)}\\ \\text{kip} \\quad(\\text{${esc(ps.PuLs||"")}})`,
+          ...(ps.Pee!=null?[`P_{u,EE} = ${fmtT(ps.Pee)}\\ \\text{kip} \\quad(\\text{Extreme Event I; drag load at EE only from liquefaction, not included})`]:[])],
+        `P_max,Str = largest pile reaction of the strength states (${esc(ps.PuLbl||"")}), from <span class="xlink" data-jump="tab-found|o-pilels">§4.3</span>; γ<sub>DR</sub> = ${fmt(ps.gDR,2)} for structural strength (panel I-7).`);
+      const pcg=R.checks.pileComp, geoDC=pcg.dc, Rgeo=pcg.RR;
+      const govH= ps.ok? (()=>{ const strDC=ps.dcS, gov=strDC>geoDC?"structural":"geotechnical";
+          return eqB("Governing pile axial resistance — the lesser of geotechnical and structural","AASHTO LRFD 10th Ed. 10.7.3.13, 10.7.3.8 / 10.5.5.2.3",[
+            `\\text{geotechnical: } \\dfrac{P_{max}}{\\varphi_c R_n} = \\dfrac{${fmtT(pcg.P)}}{${fmtT(Rgeo)}} = ${fmtT(geoDC,3)} \\quad(\\gamma_{DR} = 0)`,
+            `\\text{structural: } \\dfrac{P_u}{P_r} = \\dfrac{${fmtT(ps.Pu)}}{${fmtT(ps.Pr,1)}} = ${fmtT(strDC,3)}${ps.dcE!=null?`\\,, \\quad \\text{EE: } \\dfrac{${fmtT(ps.Pee)}}{${fmtT(ps.PrEE,1)}} = ${fmtT(ps.dcE,3)}`:""}`,
+            `\\text{factored axial resistance per pile} = \\min(${fmtT(Rgeo)},\\ ${fmtT(ps.Pr,1)}) = ${fmtT(Math.min(Rgeo,ps.Pr),1)}\\ \\text{kip} \\quad(${gov}\\ \\text{governs at Strength})`],
+            "The two demands differ only by the drag load (γ_DR = 0.00 geotechnical, 1.10 structural) [T.3.4.1-1 note]. The pile compression check of §4.4 and this structural check both appear on the dashboard."); })() : "";
+      h+=panel("o-pilestr","4.4a","Pile Structural Axial Resistance [10.7.3.13, 6.9.4, 6.15]",`
+        ${abutWorkedIn([["tab-found","o-pilels","4.3 Pile Reactions per Limit State","P_max"],["tab-found","o-pilecap","4.4 Pile Axial Capacity Checks","φ_c R_n"]])}
+        ${demH}${secH}${resH}
+        ${ps.ok? checkLine("Pile structural axial ("+esc(ps.sec)+")",ps.gov==="ee"?`\\dfrac{P_{u,EE}}{P_{r,EE}} = \\dfrac{${fmtT(ps.Pee)}}{${fmtT(ps.PrEE,1)}}`:`\\dfrac{P_u}{P_r} = \\dfrac{${fmtT(ps.Pu)}}{${fmtT(ps.Pr,1)}}`,ps.dc)
+          : `<div class="checkline fail"><span class="flagchip warn">NOT CHECKED</span><span>${esc(ps.note||"")}</span></div>`}
+        ${govH}`);
+    }
+  }
@@ -3963,2 +4286,24 @@ function renderTabStruct(R){
-  const bd=R.bwDem, cB=R.checks.bwFlex;
-  h+=sectionHTML(cB, eqB("Backwall demands — EH + LS over its own retained height, cantilever above the seat","AASHTO 3.11.5, 3.11.6.4; design basis §8.1",[
+  /* ---- ABCHK 5.0a Concrete cover advisory ---- */
+  { const cv=R.checks.cover;
+    let t=`<table class="rtbl"><tr><th>Face</th><th>Situation [Table 5.10.1-1]</th><th>Category</th><th>Table value (in)</th><th>Required = max(1.0, value × ${fmt(cv.wcm,1)}) (in)</th><th>Provided (in)</th><th>Result</th></tr>`;
+    cv.rows.forEach(r=>{ t+=`<tr${r.ok?"":' class="failrow"'}><td class="lft">${esc(r.name)}</td><td class="lft">${esc(r.sitTxt)}</td><td>${r.cat}</td><td>${fmt(r.base,1)}</td><td>${fmt(r.req,2)}</td><td>${fmt(r.prov,2)} <span class="small">(${esc(r.provTxt)})</span></td><td><b>${r.ok?"PASS":"FAIL"}</b></td></tr>`; });
+    t+="</table>";
+    h+=panel("o-str-cover","5.0a","Concrete Cover — Advisory [5.10.1, Table 5.10.1-1]",`
+      ${eqB("Minimum cover to main bars","AASHTO LRFD 10th Ed. 5.10.1, Table 5.10.1-1",[
+        "c_{min} = \\max\\!\\left(1.0,\\ c_{T.5.10.1\\text{-}1}\\times k_{W/CM}\\right), \\qquad k_{W/CM} = 0.8\\ (\\le 0.40),\\ 1.0,\\ 1.2\\ (\\ge 0.50)",
+        `k_{W/CM} = ${fmtT(cv.wcm,1)}`],
+        `Exposure of the wall faces, reinforcing material category and W/CM factor from panel I-2. The footing bottom is cast against earth; the footing top is taken as "other than noted" (or the wall exposure if salt water, coastal or limited). ${S.reinf.coatBW?"Backwall bars epoxy coated (panel I-9): category B. ":""}Advisory only: no check result uses it (the section checks use the cover entered).`)}
+      ${t}
+      <div class="checkline ${cv.nFail?"fail":"pass"}"><span class="flagchip ${cv.nFail?"warn":"pass"}">${cv.nFail?"ADVISORY: "+cv.nFail+" FAIL":"PASS"}</span><span>${cv.nFail?"Cover below Table 5.10.1-1 for the faces marked FAIL — increase the cover (panel I-2) or confirm the exposure.":"All faces meet Table 5.10.1-1 for the exposure entered."}</span></div>`);
+  }
+  const bd=R.bwDem, cB=R.checks.bwFlex, bw=bd.wheel||{mode:"off",M:0,wLL:0}, gLb=bd.gLS??+S.factors.llS1, esB=(bd.Mbw_ES||0)>0;
+  // ABCHK: backwall live load (wheel on top of the backwall), worked here; quoted in M_u and M_s below
+  const bwWheelH= bw.mode==="off"
+    ? `<div class="note-box">Live load on top of the backwall: <b>none</b> (panel I-9) — no design truck wheel is taken to bear on the backwall; M<sub>LL</sub> = 0.</div>`
+    : eqB("Backwall live load — design truck wheels on top of the backwall (vertical, at the front top corner)","AASHTO LRFD 10th Ed. 3.6.1.2.2, 3.6.1.2.5, Table 4.6.2.1.3-1, Table 3.6.1.1.2-1, Table 3.6.2.1-1; FHWA LRFD steel girder design example, Design Step 7.5",[
+      `E = 45 + 10X = 45 + 10(${fmtT(bw.X)}) = ${fmtT(bw.E,1)}\\ \\text{in} \\quad (X = h_{bw}:\\ \\text{load to the backwall base, ft})`,
+      `\\dfrac{P_w}{E} = \\dfrac{${fmtT(bw.Pw,1)}}{${fmtT(bw.E,1)}} = ${fmtT(bw.w1,4)}\\,, \\quad \\dfrac{2P_w}{E + 72} = \\dfrac{2(${fmtT(bw.Pw,1)})}{${fmtT(bw.E,1)} + 72} = ${fmtT(bw.w2,4)}\\ \\text{kip/in} \\;\\Rightarrow\\; ${bw.two?"\\text{both wheels of the axle govern}":"\\text{one wheel governs}"}`,
+      `w_{LL} = m\\,(1+IM)\\,\\max\\!\\left(\\dfrac{P_w}{E},\\,\\dfrac{2P_w}{E+72}\\right)(12) = ${fmtT(bw.m,2)}(1+${fmtT(bw.IM,2)})(${fmtT(Math.max(bw.w1,bw.w2),4)})(12) = ${fmtT(bw.wLL,3)}\\ \\text{kip/ft}`,
+      `M_{LL} = w_{LL}\\,\\dfrac{t_{bw}}{2} = (${fmtT(bw.wLL,3)})\\dfrac{${fmtT(S.geom.tbw)}}{2} = ${fmtT(bw.M,3)}\\ \\text{kip-ft/ft}`],
+      `P<sub>w</sub> = 16 kip, one wheel of the 32 kip design truck axle [3.6.1.2.2], on a 20 in × 10 in tire [3.6.1.2.5]. The wheel is spread along the backwall over the cantilever (overhang) strip of Table 4.6.2.1.3-1 with X = h<sub>bw</sub>; the other wheel of the axle is 6 ft (72 in) away [3.6.1.2.2], so when the strips overlap (E &gt; 72 in) the axle is spread over E + 72 in. m = 1.20 (one loaded lane, Table 3.6.1.1.2-1), IM = 33 % [Table 3.6.2.1-1]. The load acts vertically at the front top corner (bridge side), lever arm t<sub>bw</sub>/2 to the backwall centroid, as in the FHWA example (Design Step 7.5): it adds back-face tension, like EH and LS, and no horizontal shear (its axial compression is conservatively ignored in the section check). Backwall only, not the stem or footing (FHWA DS 7.5).${(bw.mU||1)!==1?` Owner design load multiplier m = ${fmt(bw.mU,2)} on LL+IM (panel I-0).`:""} Set "Live load on top of the backwall" to none (panel I-9) where no wheel can bear on the backwall.`);
+  h+=sectionHTML(cB, bwWheelH + eqB("Backwall demands — EH + LS"+(bw.mode==="off"?"":" + wheel load")+" over its own retained height, cantilever above the seat","AASHTO 3.11.5, 3.11.6.4; design basis §8.1",[
@@ -3967,2 +4312,5 @@ function renderTabStruct(R){
-      `M_u = ${fmtT(R.GP.EH[1])}(${fmtT(bd.Mbw_EH)}) + ${fmtT(bd.gLS??+S.factors.llS1)}(${fmtT(bd.Mbw_LS)}) = ${fmtT(bd.MuBW)}\\ \\text{kip-ft/ft}\\,, \\qquad V_u = ${fmtT(bd.VuBW)}\\ \\text{kip/ft}`],
-      `Retained height at backwall h = ${fmt(bd.hbwRet)} ft; h_eq(${fmt(bd.hbwRet)} ft) = ${fmt(bd.heqBW)} ft. The minimum seismic connection force (<span class="xlink" data-jump="tab-stab|o-seis">Tab 3, §3.6</span>) governs shear-key/keeper detailing separately.`),
+      ...(esB?[`M_{ES} = \\dfrac{k_{ah}\\,q_{ES}\\,h^2}{2} = ${fmtT(bd.Mbw_ES)}\\ \\text{kip-ft/ft}`]:[]),
+      `M_u = ${fmtT(R.GP.EH[1])}(${fmtT(bd.Mbw_EH)}) + ${fmtT(gLb)}(${fmtT(bd.Mbw_LS)})${esB?` + ${fmtT(R.GP.ES[1])}(${fmtT(bd.Mbw_ES)})`:""}${bw.mode==="off"?"":` + ${fmtT(gLb*(bw.mU||1))}(${fmtT(bw.M,3)})`} = ${fmtT(bd.MuBW)}\\ \\text{kip-ft/ft}`,
+      `V_u = ${fmtT(R.GP.EH[1])}(${fmtT(bd.Vbw_EH,3)}) + ${fmtT(gLb)}(${fmtT(bd.Vbw_LS,3)})${esB?` + ${fmtT(R.GP.ES[1])}(${fmtT(bd.Vbw_ES??0,3)})`:""} = ${fmtT(bd.VuBW)}\\ \\text{kip/ft} \\quad(V_{EH} = k_{ah}\\gamma h^2/2,\\ V_{LS} = k_{ah}\\gamma h_{eq}h${esB?",\\ V_{ES} = k_{ah}q_{ES}h":""})`,
+      `M_s = M_{EH} + M_{LS}${esB?" + M_{ES}":""}${bw.mode==="off"?"":" + M_{LL}"} = ${fmtT(bd.Mbw_EH)} + ${fmtT(bd.Mbw_LS)}${esB?` + ${fmtT(bd.Mbw_ES)}`:""}${bw.mode==="off"?"":` + ${(bw.mS||1)!==1?fmtT(bw.mS,2)+"(":""}${fmtT(bw.M,3)}${(bw.mS||1)!==1?")":""}`} = ${fmtT(bd.MsBW)}\\ \\text{kip-ft/ft} \\quad(\\text{Service I, crack control})`],
+      `Strength I. Retained height at backwall h = ${fmt(bd.hbwRet)} ft; h_eq(${fmt(bd.hbwRet)} ft) = ${fmt(bd.heqBW)} ft. The minimum seismic connection force (<span class="xlink" data-jump="tab-stab|o-seis">Tab 3, §3.6</span>) governs shear-key/keeper detailing separately.`),
@@ -3979,0 +4328,31 @@ function renderTabStruct(R){
+  /* ---- ABCHK 5.2a Stem dowels into the footing: development and lap splice ---- */
+  { const dw=R.checks.dowel, mt=S.mat, b=dw.bar;
+    const embLine= S.fnd.branch==="pile"
+      ? `\\ell_{avail} = 12t_f - (e_{pile} + c_{top}) - 2d_{b,toe} = ${fmtT(g.tf*12,1)} - ${fmtT(dw.cBot,2)} - 2(${fmtT(dw.dbT,3)}) = ${fmtT(dw.lAv,2)}\\ \\text{in}`
+      : `\\ell_{avail} = 12t_f - c_F - 2d_{b,toe} = ${fmtT(g.tf*12,1)} - ${fmtT(dw.cBot,2)} - 2(${fmtT(dw.dbT,3)}) = ${fmtT(dw.lAv,2)}\\ \\text{in}`;
+    const lapTxt=dw.lapProv>0? "" : `<div class="checkline"><span class="flagchip warn">DETAIL</span><span>Dowel lap length not entered (panel I-9): provide a lap of at least <b>${fmt(dw.lapReq,1)} in</b> (Class ${dw.classA?"A":"B"}) above the construction joint.</span></div>`;
+    h+=panel("o-str-dowel","5.2a","Stem Dowels into the Footing — Development & Lap Splice [5.10.8.2, 5.10.8.4.3a]",`
+      ${abutWorkedIn([["tab-struct","o-str-Stem","5.2 Stem","#"+b+" @ "+fmt(dw.sp,1)+" in, A_s,req"]])}
+      <div class="note-box">The dowels are taken as the stem back-face bars (#${b} @ ${fmt(dw.sp,1)} in, panel I-9), developed below the top of the footing (the critical section at the stem base) and lapped with the stem bars above the joint. Uncoated, vertical bars: λ<sub>rl</sub> = λ<sub>cf</sub> = 1.0 [5.10.8.2.1b]; λ<sub>er</sub> = 1.0; λ = 1.0 (normal weight). λ<sub>rc</sub> from Eq. 5.10.8.2.1c-2 with k<sub>tr</sub> = 0 and β<sub>t</sub> = 0 (no transverse reinforcement or transverse compression counted).</div>
+      ${eqB("Embedment available in the footing","AASHTO LRFD 10th Ed. 5.10.8.2.4a (critical section at the top of the footing)",[embLine],
+        "The hook (or the bar end) rests on the bottom mat, taken as two layers of the toe bar (#"+S.reinf.toe.size+")"+(S.fnd.branch==="pile"?", which sits on the clear cover c_top over the pile heads (pile embedment e_pile, panel I-7)":", on the bottom cover c_F (panel I-2)")+".")}
+      ${eqB(dw.hook?"Hooked dowel — development length ℓ<sub>dh</sub>":"Hooked dowel — development length ℓ<sub>dh</sub> (for comparison; straight dowels selected)","AASHTO LRFD 10th Ed. 5.10.8.2.4a (Eqs. 5.10.8.2.4a-1, -2), 5.10.8.2.1a (Eqs. 5.10.8.2.1a-1, -2), 5.10.8.2.1c (Eqs. 5.10.8.2.1c-1, -2), Tables 5.10.2.3-1, 5.8.2.5.3a-1",[
+        `R = \\tfrac{1}{2}D_{bend} + \\tfrac{1}{2}d_b = \\tfrac{1}{2}(${dw.nBar>=9?8:6}\\times${fmtT(dw.db,3)}) + \\tfrac{1}{2}(${fmtT(dw.db,3)}) = ${fmtT(dw.Rh,3)}\\ \\text{in}\\,, \\qquad \\nu = 0.85 - \\dfrac{f'_c}{20} = 0.85 - \\dfrac{${fmtT(mt.fc,2)}}{20} \\to ${fmtT(dw.nu,3)}\\ (0.45 \\le \\nu \\le 0.65)`,
+        `F_h = d_b\\,R\\,\\nu\\,f'_c = (${fmtT(dw.db,3)})(${fmtT(dw.Rh,3)})(${fmtT(dw.nu,3)})(${fmtT(mt.fc,2)}) = ${fmtT(dw.Fh,2)}\\ \\text{kip}`,
+        `\\ell_{db} = 0.17\\,d_b\\left(\\dfrac{\\lambda_{er}f_y - F_h/A_b}{1.97\\,\\lambda\\,(f'_c)^{0.25}}\\right)^2 = 0.17(${fmtT(dw.db,3)})\\left(\\dfrac{${fmtT(mt.fy,1)} - ${fmtT(dw.Fh,2)}/${fmtT(dw.Ab,2)}}{1.97(${fmtT(dw.fcD,2)})^{0.25}}\\right)^2 = ${fmtT(dw.ldbH,2)}\\ \\text{in}`,
+        `\\lambda_{rc} = \\dfrac{d_b\\,c_b}{(c_b(1-\\beta_t) + 1.67n_s k_{tr})^2} = \\dfrac{d_b}{c_b} = \\dfrac{${fmtT(dw.db,3)}}{${fmtT(dw.cbF,2)}} \\to ${fmtT(dw.lrcF,3)} \\quad(c_b = s/2 = ${fmtT(dw.cbF,2)}\\ \\text{in};\\ 0.3 \\le \\lambda_{rc} \\le 1.0)`,
+        `\\ell_d = \\ell_{db}\\,\\lambda_{rl}\\lambda_{cf}\\lambda_{rc} = ${fmtT(dw.ldbH,2)}(1.0)(1.0)(${fmtT(dw.lrcF,3)}) = ${fmtT(dw.ldH,2)}\\ \\text{in}`,
+        `\\ell_{dh} = \\ell_d + R + \\dfrac{d_b}{2} = ${fmtT(dw.ldH,2)} + ${fmtT(dw.Rh,3)} + ${fmtT(dw.db/2,3)} = ${fmtT(dw.ldhRaw,2)}\\ \\text{in} \\;\\ge\\; \\max(8d_b,\\,6) = ${fmtT(dw.ldhMin,2)} \\;\\Rightarrow\\; \\ell_{dh} = ${fmtT(dw.ldh,2)}\\ \\text{in}`],
+        "Standard 90° hook (bend plus 12d_b extension) [5.10.2.1]; ℓ_dh is measured from the critical section to the outside of the hook. f′c ≤ 15 ksi [5.10.8.2.4].")}
+      ${eqB("Straight dowel — development length ℓ<sub>d</sub>"+(dw.hook?" (for comparison; hooked dowels selected)":""),"AASHTO LRFD 10th Ed. 5.10.8.2.1a (Eqs. 5.10.8.2.1a-1, -2), 5.10.8.2.1c",[
+        `\\ell_{db} = 0.17(${fmtT(dw.db,3)})\\left(\\dfrac{${fmtT(mt.fy,1)} - 0}{1.97(${fmtT(dw.fcD,2)})^{0.25}}\\right)^2 = ${fmtT(dw.ldbS,2)}\\ \\text{in}\\,, \\qquad \\ell_d = \\max(\\ell_{db}\\lambda_{rc},\\ 12) = \\max(${fmtT(dw.ldbS,2)}(${fmtT(dw.lrcF,3)}),\\ 12) = ${fmtT(dw.ldS,2)}\\ \\text{in}`])}
+      ${checkLine("Stem dowel development into the footing ("+(dw.hook?"hooked":"straight")+")",`\\dfrac{${dw.hook?"\\ell_{dh}":"\\ell_d"}}{\\ell_{avail}} = \\dfrac{${fmtT(dw.lReq,2)}}{${fmtT(dw.lAv,2)}}`,dw.dc)}
+      ${(!dw.hook&&dw.ldh<=dw.lAv)?`<div class="eq-note">A standard hook would fit (ℓ<sub>dh</sub> = ${fmt(dw.ldh,1)} in ≤ ${fmt(dw.lAv,1)} in).</div>`:""}
+      ${eqB("Lap splice of the dowels with the stem bars (above the joint)","AASHTO LRFD 10th Ed. 5.10.8.4.3a; 5.10.8.2.1a, 5.10.8.2.1c",[
+        `c_b = \\min\\!\\left(c_{wall} + \\tfrac{d_b}{2},\\ \\tfrac{s}{2}\\right) = \\min(${fmtT(+mt.coverT,2)} + ${fmtT(dw.db/2,3)},\\ ${fmtT(dw.sp/2,2)}) = ${fmtT(dw.cbL,3)}\\ \\text{in}\\,, \\qquad \\lambda_{rc} = \\dfrac{d_b}{c_b} = \\dfrac{${fmtT(dw.db,3)}}{${fmtT(dw.cbL,3)}} \\to ${fmtT(dw.lrcL,3)}`,
+        `\\ell_d = \\max(\\ell_{db}\\lambda_{rc},\\ 12) = \\max(${fmtT(dw.ldbS,2)}(${fmtT(dw.lrcL,3)}),\\ 12) = ${fmtT(dw.ldL,2)}\\ \\text{in} \\quad(F_h = 0)`,
+        `\\dfrac{A_{s,prov}}{A_{s,req}} = \\dfrac{${fmtT(dw.As,3)}}{${fmtT(dw.AsR,3)}} = ${isFinite(dw.ratio)?fmtT(dw.ratio,2):"\\infty"}\\ ${dw.ratio>=2?"\\ge":"<"}\\ 2\\,, \\qquad \\text{spliced within the lap} = ${fmtT(dw.pct,0)}\\%\\ ${dw.pct<=50?"\\le":">"}\\ 50\\% \\;\\Rightarrow\\; \\text{Class ${dw.classA?"A":"B"}}`,
+        `\\ell_{lap} = \\max(${fmtT(dw.kLap,1)}\\,\\ell_d,\\ 12) = \\max(${fmtT(dw.kLap,1)}(${fmtT(dw.ldL,2)}),\\ 12) = ${fmtT(dw.lapReq,2)}\\ \\text{in}`],
+        "Class A needs both A_s,prov ≥ 2·A_s,req over the lap and at most half of the bars spliced within the lap; otherwise Class B [5.10.8.4.3a]. A_s,req is the stem-base value of §5.2 (largest along the lap). The share spliced is the panel I-9 input (100 % = all dowels lap at the joint).")}
+      ${dw.lapProv>0? checkLine("Stem dowel lap splice (Class "+(dw.classA?"A":"B")+")",`\\dfrac{\\ell_{lap,req}}{\\ell_{lap,prov}} = \\dfrac{${fmtT(dw.lapReq,2)}}{${fmtT(dw.lapProv,2)}}`,dw.dcLap) : lapTxt}
+    `); }
@@ -4606 +4985 @@ function drawChartsFor(tabId,R){
-    const qR=S.fnd.phiB*S.fnd.qn;
+    const qR=S.fnd.phiB*(bc.qn??S.fnd.qn);   // ABCHK: q_n of the governing permutation (computed or entered)
@@ -5037 +5416 @@ function sizingHints(R){
-    const Breq=R.checks.bearing.V/((R.checks.bearing.phiB??S.fnd.phiB)*S.fnd.qn*(R.checks.bearing.Lp||+g.Lftg||g.Lab))+2*R.checks.bearing.e;
+    const Breq=R.checks.bearing.V/((R.checks.bearing.phiB??S.fnd.phiB)*(R.checks.bearing.qn??S.fnd.qn)*(R.checks.bearing.Lp||+g.Lftg||g.Lab))+2*R.checks.bearing.e;
@@ -5532 +5911,2 @@ function inputEchoHTML(){
-    ["Cover — footing / walls",fmt(m.coverF)+" / "+fmt(m.coverT),"in"]]);
+    ["Cover — footing / walls",fmt(m.coverF)+" / "+fmt(m.coverT),"in"],
+    ["Cover advisory: wall exposure; category; W/CM factor [T.5.10.1-1]",({deicing:"deicing salts",other:"other than noted",coastal:"coastal",saltwater:"salt water",limited:"limited exposure"}[m.coverExp]||m.coverExp)+"; "+m.coverCat+"; × "+fmt(+m.coverWcm,1),""]]);
@@ -5540 +5920 @@ function inputEchoHTML(){
-    ["Extreme Event I",S.seismic.on?("ON — As="+fmt(+S.seismic.As,3)+(g.HsupMode==="single"?", single-span bridge: static EH + connection force, no M–O / wall inertia [C3.10.9.1]":", kh="+fmt(+S.seismic.khR,2)+"·As, kv="+fmt(+S.seismic.kv,2)+", ΔPAE @ "+fmt(+S.seismic.hEQr,2)+"H")+"; φτ/φb/φc(EE)="+fmt(+S.seismic.phiTauEQ,2)+"/"+fmt(+S.seismic.phiBEQ,2)+"/"+fmt(+S.seismic.phiCEQ,2)+", e/B ≤ "+(S.seismic.eLimEQmode==="user"?fmt(+S.seismic.eFracEQ,3)+" (owner rule)":"1/3 + (0.4 − 1/3)·γEQ [11.6.5.1]")+", γDC = γDW = γEV = γES(EE) = 1.00 [T.3.4.1-1], γEH(EE) = "+(eqEHfixed()!==null?fmt(eqEHfixed(),2)+" (agency policy)":"1.00 [T.3.4.1-1]")+", superstructure inertia share "+fmt(+S.seismic.shEQ,0)+"%"):"OFF",""],
+    ["Extreme Event I",S.seismic.on?("ON — As="+fmt(+S.seismic.As,3)+(g.HsupMode==="single"?", single-span bridge: static EH + connection force, no M–O / wall inertia [C3.10.9.1]":", kh="+fmt(+S.seismic.khR,2)+"·kh0, kh0 = "+(["A","B","B/C"].includes(S.seismic.siteClass)?"1.2·As":"As")+" (site class "+(S.seismic.siteClass||"not selected")+") [11.6.5.2.1], kv="+fmt(+S.seismic.kv,2)+", ΔPAE @ "+fmt(+S.seismic.hEQr,2)+"H")+"; φτ/φb/φc(EE)="+fmt(+S.seismic.phiTauEQ,2)+"/"+fmt(+S.seismic.phiBEQ,2)+"/"+fmt(+S.seismic.phiCEQ,2)+", e/B ≤ "+(S.seismic.eLimEQmode==="user"?fmt(+S.seismic.eFracEQ,3)+" (owner rule)":"1/3 + (0.4 − 1/3)·γEQ [11.6.5.1]")+", γDC = γDW = γEV = γES(EE) = 1.00 [T.3.4.1-1], γEH(EE) = "+(eqEHfixed()!==null?fmt(eqEHfixed(),2)+" (agency policy)":"1.00 [T.3.4.1-1]")+", superstructure inertia share "+fmt(+S.seismic.shEQ,0)+"%"):"OFF",""],
@@ -5544 +5924 @@ function inputEchoHTML(){
-    ["qn / φb",fmt(f.qn)+" / "+fmt(f.phiB),"ksf / –"],
+    ...((f.matl==="soil"&&f.qnMode==="soil")?[["qn computed [10.6.3.1.2a]: c / φf / γf; γq / Df / Dw","c = "+fmt(+f.qnC,2)+" ksf, φf = "+fmt(+f.qnPhi,1)+"°, γf = "+fmt(+f.qnGam,3)+" kcf; γq = "+fmt(+f.gammaF,3)+" kcf, Df = "+fmt(+f.Df)+" ft, Dw = "+fmt(+f.qnDw,1)+" ft; inclination "+(f.qnIncl!==false?"on":"off")+", depth factor "+(f.qnDepth?"on":"off"),""],["φb",fmt(f.phiB),"–"]]:[["qn / φb",fmt(f.qn)+" / "+fmt(f.phiB),"ksf / –"]]),
@@ -5555 +5935,2 @@ function inputEchoHTML(){
-    ["Drag load DR / γDR (structural; 0 geotechnical)",fmt(+p.dd||0,0)+" / "+fmt(+p.gDD,2),"kip / –"]]);
+    ["Drag load DR / γDR (structural; 0 geotechnical)",fmt(+p.dd||0,0)+" / "+fmt(+p.gDD,2),"kip / –"],
+    ["Pile structural section [10.7.3.13]",(p.pileShape==="square"?"square / precast, Pr = "+fmt(+p.PrUser||0,1)+" kip":(p.pileShape==="round"?"unfilled steel pipe, t = "+fmt(+p.pipeT,3)+" in":hpAuto(p)+(p.strSec?"":" (automatic)"))+", Fy = "+fmt(+p.Fy,1)+" ksi, "+(p.drive==="severe"?"severe driving":"good driving")),""]]);
@@ -5592,0 +5974,2 @@ function inputEchoHTML(){
+    ["Live load on top of the backwall",(S.bwLL&&S.bwLL.mode==="off")?"none":"design truck wheels (FHWA DS 7.5)",""],
+    ["Stem dowels into the footing; lap provided; spliced within the lap",(rf.dwlEnd==="straight"?"straight":"standard 90° hook")+"; "+((+rf.dwlLap>0)?fmt(+rf.dwlLap,1)+" in":"not detailed")+"; "+fmt(+rf.dwlPct,0)+" %",""],
@@ -5608,5 +5991,6 @@ const ABUT_REFS=[
-  ["AASHTO LRFD","AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024): Section 3 — 3.4.1 (Tables 3.4.1-1, 3.4.1-2), 3.5.1, 3.6.1.1, 3.6.4, 3.10.9.2, 3.11.1, 3.11.3, 3.11.5, 3.11.6, 3.12.2"],
-  ["","Art. 4.7.4.4 (minimum support length)"],
-  ["","Section 5 — 5.4.2, 5.5.4.2, 5.6.2.1, 5.6.3, 5.6.5, 5.6.7, 5.7.2.8, 5.7.3, 5.7.4, 5.8, 5.10.6, 5.10.8.2.1a, 5.12.8.6"],
-  ["","Section 10 — 10.5.5.2.3, 10.6.1.3, 10.6.2, 10.6.3.1, 10.6.3.4, 10.6.5, 10.7.1.5, 10.7.3.8, 10.7.3.10"],
-  ["","Section 11 — 11.6.3 (incl. 11.6.3.7), 11.6.5; Appendix A11.3.1 (Mononobe–Okabe)"],
+  ["AASHTO LRFD","AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024): Section 3 — 3.4.1 (Tables 3.4.1-1, 3.4.1-2), 3.5.1, 3.6.1.1, 3.6.1.2.2, 3.6.1.2.5, 3.6.2.1, 3.6.4, 3.10.9.2, 3.11.1, 3.11.3, 3.11.5, 3.11.6, 3.12.2"],
+  ["","Art. 4.6.2.1.3 (Table 4.6.2.1.3-1, equivalent strip: backwall wheel load); Art. 4.7.4.4 (minimum support length)"],
+  ["","Section 5 — 5.4.2, 5.5.4.2, 5.6.2.1, 5.6.3, 5.6.5, 5.6.7, 5.7.2.8, 5.7.3, 5.7.4, 5.8 (incl. Table 5.8.2.5.3a-1), 5.10.1 (Table 5.10.1-1), 5.10.2, 5.10.6, 5.10.8.2.1, 5.10.8.2.4, 5.10.8.4.3a, 5.12.8.6"],
+  ["","Section 6 — 6.5.4.2, 6.5.5, 6.9.4.1.1, 6.9.4.2, 6.15.2, 6.15.3 (steel pile structural resistance)"],
+  ["","Section 10 — 10.5.5.2.3, 10.6.1.3, 10.6.2, 10.6.3.1 (incl. 10.6.3.1.2a), 10.6.3.4, 10.6.5, 10.7.1.5, 10.7.3.8, 10.7.3.10, 10.7.3.13"],
+  ["","Section 11 — 11.6.3 (incl. 11.6.3.7), 11.6.5 (incl. 11.6.5.2.1); Appendix A11.3.1 (Mononobe–Okabe)"],
@@ -5614,0 +5999 @@ const ABUT_REFS=[
+  ["FHWA","FHWA LRFD Steel Girder Superstructure Design Example, Abutment and Wingwall Design (Design Step 7.5: live load on the backwall)"],
@@ -5664 +6049 @@ async function buildReport(){
-  if(S.fnd.branch==="spread"&&R.checks.bearing){ key+=`<tr><td class="lft">Max factored bearing pressure vs φ·qn</td><td>${fmt(R.checks.bearing.q)} vs ${fmt(S.fnd.phiB*S.fnd.qn)} ksf</td><td>${wk("tab-stab","o-brg")}</td></tr>
+  if(S.fnd.branch==="spread"&&R.checks.bearing){ key+=`<tr><td class="lft">Max factored bearing pressure vs φ·qn</td><td>${fmt(R.checks.bearing.q)} vs ${fmt(S.fnd.phiB*(R.checks.bearing.qn??S.fnd.qn))} ksf</td><td>${wk("tab-stab","o-brg")}</td></tr>
```

## 2026-10-20 — PR: claude/abut-show-work — ℓ_d with λ_rc per Eq. 5.10.8.2.1c-2; worked derivations (§6) and figures (PR link added after merge)

Basis: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024). Only F67 changes a computed value (the bar-length ℓ_d); F68 and F69 are display only.

### F67. Section-check development length ℓ_d: λ_rc per Eq. 5.10.8.2.1c-2 (ABSW-1)   [calc change] [LESS conservative; bar-length estimates only]
- **Provision:** 5.10.8.2.1a (Eqs. -1, -2), 5.10.8.2.1c (Eq. 5.10.8.2.1c-2: λ_rc = d_b·c_b/(c_b(1 − β_t) + 1.67n_s·k_tr)², Eq. -1: 0.3 ≤ λ_rc ≤ 1.0).
- **Before:** `const ld=Math.max(12, ldb*lamCf);` (λ_rc = 1.0, its upper bound).
- **After:** `const cbLd=Math.min(cvE+bar.db/2, o.sp/2), lamRc=Math.min(1,Math.max(0.3,bar.db/cbLd)); const ld=Math.max(12, ldb*lamCf*lamRc);` — k_tr = 0, β_t = 0 (no input for either; same basis as the dowel check F62), c_b = the smaller of the cover to the bar centre and half the spacing.
- **Where:** `sectionCheck()` anchor `// ABSW (2026-10-20): λrc by Eq. 5.10.8.2.1c-2`; the S&T + development block of each §5.x section shows c_b and λ_rc; §5.7 note.
- **Used by:** only the §5.7 bar-length estimates (B1, C1, D1) and the ℓ_d column. No check uses ℓ_d.
- **Check (default project):**
  - Backwall #6 @ 12, cover 2.0: c_b = min(2.375, 6.0) = 2.375 in, λ_rc = 0.75/2.375 = 0.316, ℓ_d = 59.14(0.316) = **18.67 in** (before 59.14).
  - Stem #9 @ 9, cover 2.0: c_b = 2.564, λ_rc = 0.440, ℓ_d = 88.94(0.440) = **39.13 in** (before 88.94).
  - Toe / heel #8 @ 9, cover 3.0: c_b = min(3.5, 4.5) = 3.5, 1/3.5 = 0.286 → 0.30, ℓ_d = 78.85(0.30) = **23.65 in** (before 78.85).
  - Epoxy-coated backwall (λ_cf 1.5): 88.70 → 28.01 in.
  - Bar lengths: B1 9.93 → 6.56 ft, C1 14.57 → 9.97 ft, D1 16.07 → 11.47 ft.

### F68. Worked derivations (CLAUDE.md §6) — display only (ABSW-2)
- **Stem (§5.2):** H and h_eq of the governing state; M_EH, M_LS, M_ES and V_EH, V_LS, V_ES substituted; H_gird·h_stem; Σ W_sw·e_sw itemised by part; M_ecc substituted; EE I terms (ΔP_AE wall share, k_h·W_wall, EQ_sup/L_ab with arms); M_u and V_u as term sums. Anchors `// ABSW: stem base M_u, V_u worked term by term`, stemGov fields `Veq,eqT,MEH,…` (computeAll stores them; no value changed).
- **Toe / heel (§5.3, §5.4):** pressure at the ends of each loaded piece, V = ½(q_a + q_b)ℓ, M = rectangle + triangle (helper `pressWorkTex()`), toe V_u at d_v, heel w-components, M_dn, M_up (pressure or pile rows), V_dn, V_up, V_u.
- **Footing service moments:** toe and heel M_s worked (§5.3, §5.4); `footSvc.toeD/heelD` stored.
- **Service I pressures (§3.4):** e and q_max/q_min substituted.
- **K_AE (§3.6a):** the M–O expression with values substituted; P_AE substituted.
- **Seismic inertia (§3.6a):** W_w = ΣW_i, z̄ = ΣW_i·ȳ_i/W_w, k_h·W_w, k_h·W_s substituted.
- **Seat bearing (§5.6):** P_u,girder = γDC·P_DC + γDW·P_DW + γLL·P_LL (+ WS, WL at Strength V) substituted (`bearingSeat.puT`); A₂ already worked.

### F69. Figures (inline SVG, print-friendly; no new library) — display only (ABSW-3)
- §6.5 lateral pressure on the stem and backwall for the V&M selection (the w(z) of the V&M integration; EE I point loads as arrows).
- §3.2a resultant location per limit state with the kern (B/6), B/3 and each state's e_lim.
- §5.2b stem M_u(z) of the governing state against φM_n(z) up the height (batter included). At z = 0 the profile reproduces the §5.2 M_u and φM_n exactly (checked in every test case).
- §5.7 dimensioned reinforcement section to scale (bar marks, covers, ℓ_dh, lap, ℓ_d).
- §5.6 seat plan: pad, c_front, c_back, c_trans and the A₂ outline.
- §4.1 pile plan: punching perimeters (pile + d_v) and per-pile shear arrows; §4.3 pile reactions per row (arrows).
- §6 V&M: "Extreme Event I" option when EE I is on. The stem diagram adds the stem design's EQ terms (ΔP_AE at h_EQr·H_s, wall inertia at h_stem/2, EQ_sup at the seat) in closed form; the EE γEH agency value is honoured. A saved `ui.vmSel` of EE with EE off falls back to Strength I.
- CSS: `svg.absw-fig` with page-break avoidance in print.

### Saved data (§5)
No key or format change. `ui.vmSel` may now hold "ls:Extreme Event I".

### How verified
- `node tests/check-syntax.mjs abutment_calculator.html`: pass. Self-test passes.
- Headless deep comparison of every leaf of `computeAll()` (7,479 to 12,925 values per case) against main for default, pile + DR, pile EE, spread EE + ES, rock, q_n computed, coated backwall with slope and water, construction stage with surcharge: the only differences are the four `ld` values above.
- All tabs and the print report rebuilt for 8 cases (incl. EE V&M, construction V&M, rock, pile EE) with no exception; every equation parsed by KaTeX (0 errors); screenshots of every new panel checked.
- EE V&M stem base M = 255.28 vs design 256.26 kip-ft/ft (A_s 0.6, Site Class B): the 0.98 difference is the existing V&M vs §5.2 treatment of the soil above the stem top (Strength I shows 110.66 vs 112.06 on main as well).

### Open items (not changed)
- `integ()` (V&M) counts a point load twice when it falls exactly on a station; the EE points added here avoid it, the existing pile-row points could hit it. Diagram only.
- Footing top bars (heel D1): λ_rl = 1.3 (more than 12 in of concrete below) is not applied to ℓ_d [5.10.8.2.1b]; it would lengthen D1. Needs a decision.

Diff (`abutment_calculator.html`, `git diff -U0` against main `c56a8c2`):

```diff
diff --git a/abutment_calculator.html b/abutment_calculator.html
index 04ae525..ff84a19 100644
--- a/abutment_calculator.html
+++ b/abutment_calculator.html
@@ -340,0 +341,3 @@ dialog h3{margin-top:0;}
+/* ABSW: inline-SVG figures print on one page, full width, black-on-white */
+svg.absw-fig{display:block;margin:6px 0;height:auto}
+@media print{ svg.absw-fig{break-inside:avoid;page-break-inside:avoid;max-width:100% !important} }
@@ -2120 +2123 @@ function computeAll(){
-    R.seis={kh,kv,thd,dMO:dMO*180/Math.PI,KAE,PAE,dPAE,dPAEh,dKh,zEQ,WiW,zWall,WiS,zSoil,EQsup:0, kh0, kh0f, sc};
+    R.seis={kh,kv,thd,dMO:dMO*180/Math.PI,KAE,PAE,dPAE,dPAEh,dKh,zEQ,WiW,zWall,WiS,zSoil,EQsup:0, kh0, kh0f, sc, Wparts, Wev};   // ABSW: Wparts, Wev for the worked inertia (display only)
@@ -2635 +2638,5 @@ function computeAll(){
-    const ld=Math.max(12, ldb*lamCf);
+    // ABSW (2026-10-20): λrc by Eq. 5.10.8.2.1c-2 with k_tr = 0 and β_t = 0 (no transverse reinforcement or transverse compression
+    // counted; the same basis as the stem-dowel check): λrc = d_b·c_b/c_b² = d_b/c_b, 0.3 ≤ λrc ≤ 1.0 (Eq. 5.10.8.2.1c-1); c_b = the smaller
+    // of the cover to the bar centre (c + d_b/2) and half the bar spacing. Was λrc = 1.0 (upper bound).
+    const cbLd=Math.min(cvE+bar.db/2, o.sp/2), lamRc=Math.min(1,Math.max(0.3,bar.db/cbLd));
+    const ld=Math.max(12, ldb*lamCf*lamRc);
@@ -2646 +2653 @@ function computeAll(){
-      rho,k,j,fss,dcBar:dc,betaS,sMax, crackOK:o.sp<=sMax, Ec, wcE, nMod, fc4, ldb, ld, lamCf, AsST, bST, hST:hIn, gE, skinNote, skinAsk};
+      rho,k,j,fss,dcBar:dc,betaS,sMax, crackOK:o.sp<=sMax, Ec, wcE, nMod, fc4, ldb, ld, lamCf, cbLd, lamRc, AsST, bST, hST:hIn, gE, skinNote, skinAsk};
@@ -2743 +2750 @@ function computeAll(){
-    let Meq=0,Veq=0;
+    let Meq=0,Veq=0, eqT=null;
@@ -2750,0 +2758 @@ function computeAll(){
+      eqT={dP, zP:(+S.seismic.hEQr)*Hs, dKh:R.seis.dKh, wallApf, Wi, sup:ns*R.seis.EQsup/Lab};   // ABSW: terms for the worked M_u, V_u (display only)
@@ -2756,0 +2765 @@ function computeAll(){
+      Veq,eqT,MEH:MEH_ls,VEH:VEH_ls,MLS:MLS_ls,VLS:VLS_ls,MES:MES_ls,VES:VES_ls,VCS:VCS_ls,gES:gES_ls,gLL:L.LL||0,HsL:Hs_ls,heqL:heq_ls,   // ABSW: worked terms (display only)
@@ -2839 +2848 @@ function computeAll(){
-        if(!tV||tVu>tV.Vu) tV={Vu:tVu,c,ls:lsName};
+        if(!tV||tVu>tV.Vu) tV={Vu:tVu,c,ls:lsName,segs,VtoeUp_dv,gT};   // ABSW: segs etc. for the worked V_u (display only)
@@ -2842,2 +2851,2 @@ function computeAll(){
-        if(!hM||hMu>hM.Mu) hM={Mu:hMu,...hl,MheelUp,VheelUp,c,ls:lsName,eS};
-        if(!hV||hVu>hV.Vu) hV={Vu:hVu,c,ls:lsName};
+        if(!hM||hMu>hM.Mu) hM={Mu:hMu,...hl,MheelUp,VheelUp,c,ls:lsName,eS,segs};
+        if(!hV||hVu>hV.Vu) hV={Vu:hVu,c,ls:lsName,VheelDn:hl.VheelDn,VheelUp,wDn:hl.wDn,segs};   // ABSW: worked V_u (display only)
@@ -2847,0 +2857 @@ function computeAll(){
+        segs:tM.segs, segsV:tV.segs, VupDv:tV.VtoeUp_dv, gTV:tV.gT, lblV:tV.c.lbl,   // ABSW
@@ -2850,0 +2861 @@ function computeAll(){
+        segs:hM.segs, hVd:{VheelDn:hV.VheelDn, VheelUp:hV.VheelUp, wDn:hV.wDn, segs:hV.segs, lbl:hV.c.lbl}, wedgeV,   // ABSW
@@ -2898,2 +2909,2 @@ function computeAll(){
-        let MhU=0,VhU=0;
-        act.forEach((pp,i)=>{ const xT=B/2+pp.x; if(xT>xStemBack){ VhU+=loads[i]/Lftg; MhU+=loads[i]/Lftg*(xT-xStemBack); } });
+        let MhU=0,VhU=0; const hRows={};
+        act.forEach((pp,i)=>{ const xT=B/2+pp.x; if(xT>xStemBack){ VhU+=loads[i]/Lftg; MhU+=loads[i]/Lftg*(xT-xStemBack); const k=pp.x.toFixed(4); (hRows[k]=hRows[k]||{xT,P:0}).P+=loads[i]; } });
@@ -2901 +2912 @@ function computeAll(){
-        const rec={Mnet,...hl,MheelUp:MhU,VheelUp:VhU,c,ls:lsName};
+        const rec={Mnet,...hl,MheelUp:MhU,VheelUp:VhU,c,ls:lsName,rows:Object.values(hRows)};
@@ -2904 +2915 @@ function computeAll(){
-        if(!hV||Vnet>hV.Vu) hV={Vu:Vnet,c,ls:lsName};
+        if(!hV||Vnet>hV.Vu) hV={Vu:Vnet,c,ls:lsName,VheelDn:hl.VheelDn,VheelUp:VhU,wDn:hl.wDn,rows:Object.values(hRows)};
@@ -2911 +2922,2 @@ function computeAll(){
-        wedgeM:hG.gEV*wedgeM, ls:hG.ls, lsV:hV.ls, lbl:hG.c.lbl+" ("+hG.ls+") − pile reactions, same permutation", src:"pile"};
+        wedgeM:hG.gEV*wedgeM, ls:hG.ls, lsV:hV.ls, lbl:hG.c.lbl+" ("+hG.ls+") − pile reactions, same permutation", src:"pile",
+        rows:hG.rows, hVd:{VheelDn:hV.VheelDn, VheelUp:hV.VheelUp, wDn:hV.wDn, rows:hV.rows, lbl:hV.c.lbl}, wedgeV};   // ABSW
@@ -2932,2 +2944,2 @@ function computeAll(){
-    if(tMs>footSvc.toe){ footSvc.toe=tMs; footSvc.toeLbl=c.lbl; }
-    if(hMs>footSvc.heel){ footSvc.heel=hMs; footSvc.heelLbl=c.lbl; }
+    if(tMs>footSvc.toe){ footSvc.toe=tMs; footSvc.toeLbl=c.lbl; footSvc.toeD={MtU}; }
+    if(hMs>footSvc.heel){ footSvc.heel=hMs; footSvc.heelLbl=c.lbl; footSvc.heelD={MhU, Mdn:heelLoads(c).MheelDn}; }   // ABSW: worked M_s (display only)
@@ -3052 +3064 @@ function computeAll(){
-    let Pu=-Infinity, PuG=0, pgirder=0, pls="", dcB=-Infinity, sm=null;
+    let Pu=-Infinity, PuG=0, pgirder=0, pls="", dcB=-Infinity, sm=null, puT=null;
@@ -3061 +3073,3 @@ function computeAll(){
-      if(dci>dcB+1e-12){ dcB=dci; Pu=P; PuG=PG; pgirder=i+1; pls=ls; sm=mi; }
+      if(dci>dcB+1e-12){ dcB=dci; Pu=P; PuG=PG; pgirder=i+1; pls=ls; sm=mi;
+        puT={DC:S.rx.DC[i].P, DW:S.rx.DW[i].P, LL:S.rx.LL[i].P, WS:S.rx.WS[i].P, WL:S.rx.WL[i].P, gDC:GP.DC[1], gDW:GP.DW[1],
+          gLL:(ls==="Strength I"?L1.LL*L1.mLL:L5.LL*L5.mLL), gWS:ls==="Strength V"?L5.WS:0, gWL:ls==="Strength V"?L5.WL:0, y:posB[i]||0}; }   // ABSW: worked P_u (display only)
@@ -3066 +3080 @@ function computeAll(){
-      A2:sm?sm.A2:A1, c:sm?sm.c:0, cBy:sm?sm.cBy:"", mRaw:sm?sm.mRaw:1, cFront, cBack, cT:sm?sm.cT:0};
+      A2:sm?sm.A2:A1, c:sm?sm.c:0, cBy:sm?sm.cBy:"", mRaw:sm?sm.mRaw:1, cFront, cBack, cT:sm?sm.cT:0, puT};
@@ -3178 +3192 @@ function computeAll(){
-    const fEH = isLS?(Lst.perm?GP.EH[1]:1.0):one("EH");
+    const fEH = isLS?((Lst.eq&&eqEHfixed()!==null)? eqEHfixed() : (Lst.perm?GP.EH[1]:1.0)):one("EH");   // ABSW: EE I agency γEH as the stem design
@@ -3211,2 +3225,14 @@ function computeAll(){
-      const r=integ(st,w,[{s:0,P:Vtop+Hg}]);
-      vm.stem={pos:st.map(s=>g.hstem-s), V:r.V, M:r.M.map(m=>m+Mtop+Mecc),
+      // ABSW: Extreme Event I — the stem design's EQ terms as point loads: ΔP_AE (wall share) at h_EQr·H_s above the footing, wall inertia
+      // at h_stem/2, superstructure inertia at the seat (as C-10; the M–O increment above the seat adds its moment at the top)
+      const ptsS=[{s:0,P:Vtop+Hg}]; let MtopEQ=0;
+      if(isLS&&Lst.eq&&R.seis&&isFinite(R.seis.dKh)){
+        const dP=0.5*R.seis.dKh*gam*g.soilH*g.soilH, zP=(+S.seismic.hEQr)*g.soilH;
+        const wallApf=(g.tst*g.hstem)+(Math.max(0,g.tsb-g.tst)*g.hstem/2)+(g.tbw*g.hbw), Wi=R.seis.kh*wallApf*m.gc;
+        if(zP<=g.hstem) ptsS.push({s:g.hstem-zP,P:dP}); else { ptsS[0].P+=dP; MtopEQ+=dP*(zP-g.hstem); }
+        ptsS.push({s:g.hstem/2,P:Wi}); ptsS[0].P+=ns*R.seis.EQsup/Lab;
+      }
+      const r=integ(st,w,[ptsS[0]]);
+      // EE interior point loads added in closed form (V steps at s_p, M grows by P·(s − s_p)): integ() counts a point load twice
+      // when it falls exactly on a station, as the wall inertia at h_stem/2 does
+      ptsS.slice(1).forEach(q=>{ st.forEach((sv,i)=>{ if(sv>=q.s-1e-9){ r.V[i]+=q.P; r.M[i]+=q.P*(sv-q.s); } }); });
+      vm.stem={pos:st.map(s=>g.hstem-s), V:r.V, M:r.M.map(m=>m+Mtop+Mecc+MtopEQ), w:w.slice(), ptsEQ:ptsS.slice(1), pTop:(Vtop>0&&hAbove>0)?{h:hAbove,V:Vtop}:null,   // ABSW: w, EQ points for the pressure diagram (display only)
@@ -3219 +3245 @@ function computeAll(){
-      vm.backwall={pos:st.map(s=>hbwRet-s), V:r.V, M:r.M,
+      vm.backwall={pos:st.map(s=>hbwRet-s), V:r.V, M:r.M, w:w.slice(),   // ABSW
@@ -3264,0 +3291 @@ function computeAll(){
+  if(R.vmSel.startsWith("ls:")&&!LIMITS[R.vmSel.slice(3)]) R.vmSel="ls:Strength I";   // ABSW: Extreme Event I selected while it is off
@@ -3907,0 +3935,4 @@ function renderTabStab(R){
+    // ABSW: resultant location per limit state against the kern and the eccentricity limits
+    h+=panel("o-kern","3.2a","Resultant Location per Limit State — Kern and Eccentricity Limits",`
+      ${svgResultants(R)}
+      <div class="figcap">x̄ = (ΣM_v − ΣM_h)/ΣV from the toe, e = B/2 − x̄, for the permutation of each limit state with the largest |e|/e_lim (the set of <span class="xlink" data-jump="tab-stab|o-ecc">§3.2</span>; permutations in <span class="xlink" data-jump="tab-comb|o-perm-StrengthI">Tab 2 §2.3</span>).</div>`);
@@ -3964,0 +3996,5 @@ function renderTabStab(R){
+        // ABSW: substituted values (governing Service I permutation)
+        `e = \\left|\\dfrac{B}{2} - \\dfrac{\\Sigma M_v - \\Sigma M_h}{\\Sigma V}\\right| = \\left|${fmtT(geo.B/2,3)} - \\dfrac{${fmtT(sv.c.Mv,1)} - ${fmtT(sv.c.Mh,1)}}{${fmtT(sv.V,1)}}\\right| = ${fmtT(sv.e,3)}\\ \\text{ft}\\ ${sv.e<=geo.B/6?"\\le":">"}\\ B/6 = ${fmtT(geo.B/6,3)}\\ \\text{ft}`,
+        sv.mode==="trap"
+          ? `q_{max,min} = \\dfrac{${fmtT(sv.V,1)}}{(${fmtT(geo.B)})(${fmtT(+g.Lftg||g.Lab)})}\\left(1 \\pm \\dfrac{6(${fmtT(sv.e,3)})}{${fmtT(geo.B)}}\\right) = ${fmtT(sv.qP)}\\,,\\ ${fmtT(sv.qminP)}\\ \\text{ksf}${sv.bx?"\\ (\\text{before } e_L)":""}`
+          : `L_c = 3(B/2 - e) = 3(${fmtT(geo.B/2,3)} - ${fmtT(sv.e,3)}) = ${fmtT(sv.Lc,3)}\\ \\text{ft}\\,, \\quad q_{max} = \\dfrac{2(${fmtT(sv.V,1)})}{(${fmtT(sv.Lc,3)})(${fmtT(+g.Lftg||g.Lab)})} = ${fmtT(sv.qP)}\\ \\text{ksf}${sv.bx?"\\ (\\text{before } e_L)":""}`,
@@ -4003 +4039,4 @@ function renderTabStab(R){
-        `K_{AE} = ${fmtT(q.KAE,4)} \\qquad P_{AE} = \\tfrac{1}{2}\\gamma H^2 K_{AE}(1-k_v) = ${fmtT(q.PAE,3)}\\ \\text{kip/ft}`,
+        (()=>{ const ph=+S.soil.phi, th=q.thd, dl=q.dMO, bt=+S.geom.beta, r=x=>x*Math.PI/180;   // ABSW: substituted K_AE (display only)
+          const num=Math.pow(Math.cos(r(ph-th)),2), den1=Math.cos(r(th))*Math.cos(r(dl+th)), rad=Math.sqrt(Math.sin(r(ph+dl))*Math.sin(r(ph-th-bt))/(Math.cos(r(dl+th))*Math.cos(r(bt))));
+          return `K_{AE} = \\dfrac{\\cos^2(${fmtT(ph,1)}° - ${fmtT(th,2)}°)}{\\cos ${fmtT(th,2)}°\\,\\cos(${fmtT(dl,1)}° + ${fmtT(th,2)}°)\\left[1+\\sqrt{\\dfrac{\\sin(${fmtT(ph+dl,1)}°)\\sin(${fmtT(ph-th-bt,2)}°)}{\\cos(${fmtT(dl+th,2)}°)\\cos ${fmtT(bt,1)}°}}\\right]^2} = \\dfrac{${fmtT(num,4)}}{(${fmtT(den1,4)})(1 + ${fmtT(rad,4)})^2}`; })(),
+        `K_{AE} = ${fmtT(q.KAE,4)} \\qquad P_{AE} = \\tfrac{1}{2}\\gamma H^2 K_{AE}(1-k_v) = \\tfrac{1}{2}(${fmtT(S.soil.gamma,3)})(${fmtT(R.geo.H)})^2(${fmtT(q.KAE,4)})(1 - ${fmtT(q.kv,3)}) = ${fmtT(q.PAE,3)}\\ \\text{kip/ft}`,
@@ -4006,2 +4045,4 @@ function renderTabStab(R){
-        `\\text{Wall (incl. footing): } k_h W_w = ${fmtT(q.WiW)}\\ \\text{kip at } \\bar z = ${fmtT(q.zWall)}\\ \\text{ft}`,
-        `\\text{Soil block: } k_h W_s = ${fmtT(q.WiS)}\\ \\text{kip at } \\bar z = ${fmtT(q.zSoil)}\\ \\text{ft}`,
+        // ABSW: weights and centroid heights worked (display only)
+        `W_w = \\Sigma W_i = ${R.parts.map(pp=>fmtT(pp.W,1)).join(" + ")} = ${fmtT(q.Wparts,1)}\\ \\text{kip}\\,, \\quad \\bar z = \\dfrac{\\Sigma W_i\\bar y_i}{W_w} = \\dfrac{${R.parts.map(pp=>`(${fmtT(pp.W,1)})(${fmtT(pp.y??S.geom.tf/2,2)})`).join(" + ")}}{${fmtT(q.Wparts,1)}} = ${fmtT(q.zWall)}\\ \\text{ft}`,
+        `\\text{Wall (incl. footing): } k_h W_w = (${fmtT(q.kh,4)})(${fmtT(q.Wparts,1)}) = ${fmtT(q.WiW)}\\ \\text{kip at } \\bar z = ${fmtT(q.zWall)}\\ \\text{ft}`,
+        `\\text{Soil block: } k_h W_s = (${fmtT(q.kh,4)})(${fmtT(q.Wev,1)}) = ${fmtT(q.WiS)}\\ \\text{kip at } \\bar z = t_f + \\tfrac{h_{soil}}{2} = ${fmtT(S.geom.tf)} + \\tfrac{${fmtT(S.geom.soilH)}}{2} = ${fmtT(q.zSoil)}\\ \\text{ft} \\quad(W_s = \\text{EV, Tab 1 §1.2})`,
@@ -4082 +4123,2 @@ function renderTabFound(R){
-     <div class="figcap">Per-pile axial reactions for the governing max-compression case of each limit state. Toggle series in the legend; hover for pile numbers and values.</div>`);
+     <div class="figcap">Per-pile axial reactions for the governing max-compression case of each limit state. Toggle series in the legend; hover for pile numbers and values.</div>
+     ${svgPileReactions(R)}`);
@@ -4222,0 +4265,16 @@ function toePileShearHTML(td, cT){
+/* ABSW: worked integration of a linear contact-pressure diagram over [xa, xb] (x from the toe): pressure at the ends of each
+   loaded piece, force = ½(q_a + q_b)·ℓ and moment about x_s = rectangle + triangle (as pressForce / pressMoment). Display only. */
+function pressWorkTex(segs, xa, xb, xs, Vsym, Msym, withM){
+  const out=[]; let F=0, M=0; const fF=[], fM=[];
+  (segs||[]).forEach(sg=>{ const a=Math.max(xa,sg.x0), b=Math.min(xb,sg.x1); if(b<=a) return;
+    const q=x=> sg.q0+(sg.q1-sg.q0)*(x-sg.x0)/((sg.x1-sg.x0)||1), qa=q(a), qb=q(b), L=b-a;
+    const F1=Math.min(qa,qb)*L, x1=(a+b)/2, F2=Math.abs(qb-qa)*L/2, x2=qb>qa? a+2*L/3 : a+L/3;
+    F+=(qa+qb)/2*L; M+=F1*Math.abs(x1-xs)+F2*Math.abs(x2-xs);
+    out.push(`q(${fmtT(a,3)}) = ${fmtT(qa,3)},\\ q(${fmtT(b,3)}) = ${fmtT(qb,3)}\\ \\text{ksf} \\quad(x \\text{ from the toe, loaded length } ${fmtT(L,3)}\\ \\text{ft})`);
+    fF.push(`\\tfrac{1}{2}(${fmtT(qa,3)} + ${fmtT(qb,3)})(${fmtT(L,3)})`);
+    fM.push(`(${fmtT(Math.min(qa,qb),3)})(${fmtT(L,3)})(${fmtT(Math.abs(x1-xs),3)}) + \\tfrac{1}{2}(${fmtT(Math.abs(qb-qa),3)})(${fmtT(L,3)})(${fmtT(Math.abs(x2-xs),3)})`); });
+  if(!out.length){ out.push(`\\text{no contact pressure on this part}`); }
+  out.push(`${Vsym} = ${fF.length?fF.join(" + "):"0"} = ${fmtT(F,3)}\\ \\text{kip/ft}`);
+  if(withM) out.push(`${Msym} = ${fM.length?fM.join(" + "):"0"} = ${fmtT(M,3)}\\ \\text{kip-ft/ft}`);
+  return out;
+}
@@ -4273 +4331 @@ function sectionHTML(c, demHTML, secNo, title){
-    ${eqB("S&T reinforcement (each face, each direction) & tension development length","AASHTO 5.10.6 (Eq. 5.10.6-1), 5.10.8.2.1a (Eqs. 5.10.8.2.1a-1, -2)",[
+    ${eqB("S&T reinforcement (each face, each direction) & tension development length","AASHTO 5.10.6 (Eq. 5.10.6-1), 5.10.8.2.1a (Eqs. 5.10.8.2.1a-1, -2), 5.10.8.2.1c (Eqs. 5.10.8.2.1c-1, -2)",[
@@ -4276,2 +4334,3 @@ function sectionHTML(c, demHTML, secNo, title){
-      `\\ell_d = \\max\\!\\left(\\ell_{db}\\,\\lambda_{rl}\\lambda_{cf}\\lambda_{rc},\\ 12\\right) = \\max\\!\\left(${fmtT(c.ldb,1)}(1.0)(${fmtT(c.lamCf??1,1)})(1.0),\\ 12\\right) = ${fmtT(c.ld,1)}\\ \\text{in}`],
-      ((c.lamCf??1)>1?`Epoxy-coated bars (panel I-9${abutOwner()==="MassDOT"?"; MassDOT Part I 3.3.1.6":""}): λ<sub>cf</sub> = ${fmt(c.lamCf,1)} [5.10.8.2.1b] — cover ${fmt(c.cvE,2)} in ${c.cvE<3*BARS[c.bar].db?"&lt;":"≥"} 3d<sub>b</sub> = ${fmt(3*BARS[c.bar].db,2)} in, clear spacing ${fmt(c.sp-BARS[c.bar].db,2)} in ${(c.sp-BARS[c.bar].db)<6*BARS[c.bar].db?"&lt;":"≥"} 6d<sub>b</sub> = ${fmt(6*BARS[c.bar].db,2)} in. `:"")+"S&T applies to exposed faces not otherwise reinforced. Development length per AASHTO LRFD 10th Ed. 5.10.8.2.1a for a straight bar (F_h = 0) in normal weight concrete, with λ_er, λ_rl"+((c.lamCf??1)>1?"":", λ_cf")+" and λ_rc taken as 1.0 (λ_rc = 1.0 is its upper bound; no confinement credit) — confirm hooks/embedment in detailing.")}
+      `c_b = \\min\\!\\left(c + \\tfrac{d_b}{2},\\ \\tfrac{s}{2}\\right) = \\min(${fmtT(c.cvE,2)} + ${fmtT(BARS[c.bar].db/2,3)},\\ ${fmtT(c.sp/2,2)}) = ${fmtT(c.cbLd,3)}\\ \\text{in}\\,, \\qquad \\lambda_{rc} = \\dfrac{d_b\\,c_b}{(c_b(1-\\beta_t)+1.67n_s k_{tr})^2} = \\dfrac{d_b}{c_b} = \\dfrac{${fmtT(BARS[c.bar].db,3)}}{${fmtT(c.cbLd,3)}} \\to ${fmtT(c.lamRc,3)} \\quad(0.3 \\le \\lambda_{rc} \\le 1.0)`,
+      `\\ell_d = \\max\\!\\left(\\ell_{db}\\,\\lambda_{rl}\\lambda_{cf}\\lambda_{rc},\\ 12\\right) = \\max\\!\\left(${fmtT(c.ldb,1)}(1.0)(${fmtT(c.lamCf??1,1)})(${fmtT(c.lamRc,3)}),\\ 12\\right) = ${fmtT(c.ld,1)}\\ \\text{in}`],
+      ((c.lamCf??1)>1?`Epoxy-coated bars (panel I-9${abutOwner()==="MassDOT"?"; MassDOT Part I 3.3.1.6":""}): λ<sub>cf</sub> = ${fmt(c.lamCf,1)} [5.10.8.2.1b] — cover ${fmt(c.cvE,2)} in ${c.cvE<3*BARS[c.bar].db?"&lt;":"≥"} 3d<sub>b</sub> = ${fmt(3*BARS[c.bar].db,2)} in, clear spacing ${fmt(c.sp-BARS[c.bar].db,2)} in ${(c.sp-BARS[c.bar].db)<6*BARS[c.bar].db?"&lt;":"≥"} 6d<sub>b</sub> = ${fmt(6*BARS[c.bar].db,2)} in. `:"")+"S&T applies to exposed faces not otherwise reinforced. Development length per AASHTO LRFD 10th Ed. 5.10.8.2.1a for a straight bar (F_h = 0) in normal weight concrete, with λ_er, λ_rl"+((c.lamCf??1)>1?"":" and λ_cf")+" taken as 1.0; λ_rc from Eq. 5.10.8.2.1c-2 with k_tr = 0 and β_t = 0 (no transverse reinforcement or transverse compression counted), c = the cover to the bar used in this section. ℓ_d sets the bar-length estimates of §5.7 — confirm hooks/embedment in detailing.")}
@@ -4318,0 +4378,17 @@ function renderTabStruct(R){
+  // ABSW: stem base M_u, V_u worked term by term for the governing limit state (incl. ES, construction surcharge and EQ terms)
+  const sxc=R.geo.xStemCenter, swParts=R.parts.filter(pp=>!/Footing/.test(pp.name));
+  const sHs=sd.HsL??sd.Hs, sEQ=sd.eqT, sEsq=+S.soil.esQ||0, sGL=sd.gLL||0;
+  const stemWork=[
+      `H = ${fmtT(sHs)}\\ \\text{ft}${sHs!==sd.Hs?"\\ (\\text{construction-stage fill})":""}\\,, \\quad h_{eq}(${fmtT(sHs)}) = ${fmtT(sd.heqL??sd.heqS)}\\ \\text{ft} \\quad(\\text{${esc(sd.ls)}})`,
+      `M_{EH} = \\dfrac{k_{ah}\\gamma H^3}{6} = \\dfrac{(${fmtT(kah,4)})(${fmtT(s.gamma,3)})(${fmtT(sHs)})^3}{6} = ${fmtT(sd.MEH??sd.Mst_EH)}\\,, \\qquad V_{EH} = \\dfrac{k_{ah}\\gamma H^2}{2} = ${fmtT(sd.VEH??sd.Vst_EH,3)}`,
+      `M_{LS} = \\dfrac{k_{ah}\\gamma h_{eq} H^2}{2} = \\dfrac{(${fmtT(kah,4)})(${fmtT(s.gamma,3)})(${fmtT(sd.heqL??sd.heqS)})(${fmtT(sHs)})^2}{2} = ${fmtT(sd.MLS??sd.Mst_LS)}\\,, \\qquad V_{LS} = k_{ah}\\gamma h_{eq}H = ${fmtT(sd.VLS??sd.Vst_LS,3)}`,
+      ...(sEsq>0?[`M_{ES} = \\dfrac{k_{ah}q_{ES}H^2}{2} = \\dfrac{(${fmtT(kah,4)})(${fmtT(sEsq,3)})(${fmtT(sHs)})^2}{2} = ${fmtT(sd.MES)}\\,, \\qquad V_{ES} = k_{ah}q_{ES}H = ${fmtT(sd.VES,3)}`]:[]),
+      `H_{gird} = ${fmtT(sd.HgirdPerFt,3)}\\ \\text{kip/ft at } z = h_{stem} = ${fmtT(g.hstem)}\\ \\text{ft} \\;\\Rightarrow\\; H_{gird}h_{stem} = ${fmtT(sd.HgirdPerFt*g.hstem)}\\ \\text{kip-ft/ft}`,
+      `\\Sigma W_{sw}e_{sw} = ${swParts.map(pp=>`(${fmtT(pp.W)})(${fmtT(sxc-pp.x,3)})`).join(" + ")} = ${fmtT(sd.MselfEccTot)}\\ \\text{kip-ft} \\quad(e_{sw} = x_{sc} - \\bar x_i,\\ x_{sc} = ${fmtT(sxc,3)}\\ \\text{ft})`,
+      `M_{ecc} = \\dfrac{P_v\\,(x_{sc}-x_{brg}) + \\gamma_{DC}\\Sigma W_{sw}e_{sw}}{L_{ab}} = \\dfrac{(${fmtT(sd.Pv)})(${fmtT(sxc-R.geo.xBrg,3)}) + (${fmtT(sd.gDCe??1,2)})(${fmtT(sd.MselfEccTot)})}{${fmtT(g.Lab)}} = ${fmtT(sd.MeccPerFt)}\\ \\text{kip-ft/ft}`,
+      ...(sEQ?[
+        `\\Delta P_{AE,wall} = \\tfrac{1}{2}\\Delta K_h\\gamma H_s^2 = \\tfrac{1}{2}(${fmtT(sEQ.dKh,4)})(${fmtT(s.gamma,3)})(${fmtT(sd.Hs)})^2 = ${fmtT(sEQ.dP,3)}\\ \\text{kip/ft at } ${fmtT(sEQ.zP)}\\ \\text{ft}`,
+        `k_h W_{wall} = k_h\\gamma_c A_{wall} = (${fmtT(R.seis.kh,4)})(${fmtT(S.mat.gc,3)})(${fmtT(sEQ.wallApf,3)}) = ${fmtT(sEQ.Wi,3)}\\ \\text{kip/ft at } h_{stem}/2\\,, \\qquad EQ_{sup}/L_{ab} = ${fmtT(sEQ.sup,3)}\\ \\text{kip/ft at } h_{stem}`,
+        `M_{EQ} = (${fmtT(sEQ.dP,3)})(${fmtT(sEQ.zP)}) + (${fmtT(sEQ.Wi,3)})(${fmtT(g.hstem/2)}) + (${fmtT(sEQ.sup,3)})(${fmtT(g.hstem)}) = ${fmtT(sd.Meq)}\\,, \\qquad V_{EQ} = ${fmtT(sd.Veq,3)}\\ \\text{kip/ft}`]:[]),
+      `M_u = ${fmtT(sd.gEH??R.GP.EH[1])}(${fmtT(sd.MEH??sd.Mst_EH)}) + ${fmtT(sGL)}(${fmtT(sd.MLS??sd.Mst_LS)})${sEsq>0?` + ${fmtT(sd.gES,2)}(${fmtT(sd.MES)})`:""} + ${fmtT(sd.HgirdPerFt*g.hstem)} + ${fmtT(sd.MeccPerFt)}${sd.MCS>0?` + ${fmtT(sd.MCS)}`:""}${sEQ?` + ${fmtT(sd.Meq)}`:""} = ${fmtT(sd.Mu)}\\ \\text{kip-ft/ft}`,
+      `V_u = ${fmtT(sd.gEH??R.GP.EH[1])}(${fmtT(sd.VEH??sd.Vst_EH,3)}) + ${fmtT(sGL)}(${fmtT(sd.VLS??sd.Vst_LS,3)})${sEsq>0?` + ${fmtT(sd.gES,2)}(${fmtT(sd.VES,3)})`:""} + ${fmtT(sd.HgirdPerFt,3)}${sd.MCS>0?` + ${fmtT(sd.VCS,3)}`:""}${sEQ?` + ${fmtT(sd.Veq,3)}`:""} = ${fmtT(sd.Vu)}\\ \\text{kip/ft}`];
@@ -4320,4 +4396 @@ function renderTabStruct(R){
-      `M_{EH} = \\dfrac{k_{ah}\\gamma H_s^3}{6} = \\dfrac{(${fmtT(kah,4)})(${fmtT(s.gamma,3)})(${fmtT(sd.Hs)})^3}{6} = ${fmtT(sd.Mst_EH)}\\ \\text{kip-ft/ft}`,
-      `M_{LS} = \\dfrac{k_{ah}\\gamma h_{eq} H_s^2}{2} = ${fmtT(sd.Mst_LS)}\\ \\text{kip-ft/ft}\\,, \\qquad H_{gird} = ${fmtT(sd.HgirdPerFt,3)}\\ \\text{kip/ft at } z = h_{stem} = ${fmtT(g.hstem)}\\ \\text{ft}`,
-      `M_{ecc} = \\dfrac{P_v\\,e_{brg} + \\Sigma W_{sw}\\,e_{sw}}{L_{ab}} = ${fmtT(sd.MeccPerFt)}\\ \\text{kip-ft/ft} \\quad(e_{brg} = ${fmtT(sd.eBrg,3)}\\ \\text{ft toe-ward}, \\; P_v = ${fmtT(sd.Pv)}\\ \\text{kip})`,
-      `M_u = ${fmtT(sd.gEH??R.GP.EH[1])}\\,M_{EH} + \\gamma_{LL}M_{LS} + H_{gird}\\,h_{stem} + M_{ecc}${sd.MCS>0?" + \\gamma_c M_{CS}":""} = ${fmtT(sd.Mu)}\\ \\text{kip-ft/ft}\\,, \\qquad V_u = ${fmtT(sd.Vu)}\\ \\text{kip/ft}`,
+      ...stemWork,
@@ -4358,0 +4432,9 @@ function renderTabStruct(R){
+  // ABSW 5.2b: stem M_u(z) vs φM_n(z)
+  { const pr=stemCapacityProfile(R), dcMax=Math.max(...pr.map(q=>q.Mu/q.phiMn));
+    h+=panel("o-str-stemprof","5.2b","Stem — M<sub>u</sub> and φM<sub>n</sub> up the Height",`
+      ${svgStemCapacity(R)}
+      ${eqB("Profile expressions (governing state of §5.2)","AASHTO 5.6.3.2; design basis §8.2",[
+        "M_u(z) = \\gamma_{EH}M_{EH}r^3 + \\gamma_{LL}M_{LS}r^2 + \\gamma_{ES}M_{ES}r^2 + H_{gird}(h_{stem}-z) + M_{ecc} + M_{EQ}(z), \\quad r = \\dfrac{H - z}{H}",
+        "\\varphi M_n(z) = \\varphi A_s f_y\\left(d(z) - \\tfrac{a}{2}\\right), \\quad d(z) = 12\\,t(z) - c_{wall} - \\tfrac{d_b}{2}, \\quad t(z) = t_{sb} - (t_{sb}-t_{st})\\dfrac{z}{h_{stem}}",
+        `z = 0:\\ M_u = ${fmtT(pr[0].Mu)} = M_u\\ (\\S5.2),\\ \\varphi M_n = ${fmtT(pr[0].phiMn)}\\,; \\quad \\max_z M_u/\\varphi M_n = ${fmtT(dcMax,3)}`],
+        "Base values (r = 1) are the worked terms of §5.2; h_eq is held at its value for the stem base and the EE wall inertia is spread uniformly over the stem (its base moment equals the §5.2 term). The same A1 bars over the full stem height (no cut-off). Figure only; the design check is at the base (§5.2).")}`); }
@@ -4362 +4444 @@ function renderTabStruct(R){
-        `V_{up} = \\int q\\,dx = ${fmtT(td.VtoeUp)}\\ \\text{kip/ft}\\,, \\qquad M_{up} = ${fmtT(td.MtoeUp)}\\ \\text{kip-ft/ft (about the face)}`,
+        ...pressWorkTex(td.segs, 0, g.Ltoe, g.Ltoe, "V_{up}", "M_{up}", true),
@@ -4364 +4446,4 @@ function renderTabStruct(R){
-        `M_u = ${fmtT(td.Mu)}\\ \\text{kip-ft/ft}\\,, \\qquad V_u\\text{(at } d_v = ${fmtT(td.dvT)}\\ \\text{ft from face)} = ${fmtT(td.Vu)}\\ \\text{kip/ft}`],
+        `M_u = M_{up} - M_{dn} = ${fmtT(td.MtoeUp)} - ${fmtT(td.MtoeDn)} = ${fmtT(td.Mu)}\\ \\text{kip-ft/ft}`,
+        ...(td.segsV? [`\\text{Shear at } d_v = ${fmtT(td.dvT*12)}\\ \\text{in from the face: section at } x = L_{toe} - d_v = ${fmtT(g.Ltoe-td.dvT,3)}\\ \\text{ft (${esc(td.lsV||"")})}`,
+          ...pressWorkTex(td.segsV, 0, Math.max(0,g.Ltoe-td.dvT), 0, "V_{up,d_v}", "", false),
+          `V_u = V_{up,d_v} - ${fmtT(td.gTV??0.9)}\\,\\gamma_c t_f (L_{toe}-d_v) = ${fmtT(td.VupDv,3)} - ${fmtT(td.gTV??0.9)}(${fmtT(S.mat.gc,3)})(${fmtT(g.tf)})(${fmtT(Math.max(0,g.Ltoe-td.dvT),3)}) = ${fmtT(td.Vu)}\\ \\text{kip/ft}`] : [`V_u = ${fmtT(td.Vu)}\\ \\text{kip/ft}`])],
@@ -4368,2 +4453,4 @@ function renderTabStruct(R){
-        `V_{up} = \\Sigma P_{row}/L_{ab} = ${fmtT(td.VtoeUp)}\\ \\text{kip/ft}\\,, \\qquad M_{up} = \\Sigma (P_{row}/L_{ab})\\,a_{row} = ${fmtT(td.MtoeUp)}\\ \\text{kip-ft/ft}`,
-        `M_{dn} = ${fmtT(td.gTdn??0.9)}\\,\\gamma_c t_f L_{toe}^2/2 = ${fmtT(td.MtoeDn)}\\ \\text{kip-ft/ft}`,
+        ...(()=>{ const rr=(td.rowArr||[]).map(r=>({xT:R.geo.B/2+r.x,P:r.P})).filter(r=>r.xT<g.Ltoe), Lf=+g.Lftg||g.Lab;
+          return [`V_{up} = \\Sigma\\dfrac{P_{row}}{L_{ftg}} = ${rr.length?rr.map(r=>`\\dfrac{${fmtT(r.P,1)}}{${fmtT(Lf)}}`).join(" + "):"0"} = ${fmtT(td.VtoeUp,3)}\\ \\text{kip/ft}`,
+            `M_{up} = \\Sigma\\dfrac{P_{row}}{L_{ftg}}a_{row} = ${rr.length?rr.map(r=>`(${fmtT(r.P/Lf,3)})(${fmtT(g.Ltoe-r.xT,3)})`).join(" + "):"0"} = ${fmtT(td.MtoeUp,3)}\\ \\text{kip-ft/ft} \\quad(a_{row} = L_{toe} - x_{row})`]; })(),
+        `M_{dn} = ${fmtT(td.gTdn??0.9)}\\,\\gamma_c t_f \\dfrac{L_{toe}^2}{2} = ${fmtT(td.gTdn??0.9)}(${fmtT(S.mat.gc,3)})(${fmtT(g.tf)})\\dfrac{(${fmtT(g.Ltoe)})^2}{2} = ${fmtT(td.MtoeDn)}\\ \\text{kip-ft/ft}`,
@@ -4374 +4461,9 @@ function renderTabStruct(R){
-  h+=sectionHTML(cT, toeDemH, "5.3","Toe — Flexure & Shear (bottom reinforcement)");
+  // ABSW: footing service moments for crack control, worked (Service I, every permutation; the governing one shown)
+  const fsv=R.footSvc;
+  const toeSvcH= fsv.toeD? eqB("Toe service moment M<sub>s</sub> (crack control)","AASHTO 5.6.7; Service I",[
+      `M_{s} = M_{up,SI} - \\gamma_c t_f\\dfrac{L_{toe}^2}{2} = ${fmtT(fsv.toeD.MtU,3)} - (${fmtT(S.mat.gc,3)})(${fmtT(g.tf)})\\dfrac{(${fmtT(g.Ltoe)})^2}{2} = ${fmtT(fsv.toe)}\\ \\text{kip-ft/ft}`],
+      `M<sub>up,SI</sub> = ${td.src==="pile"?"Σ(P<sub>row</sub>/L<sub>ftg</sub>)·a<sub>row</sub> of the Service I pile reactions":"moment of the Service I linear contact pressure about the stem front face"}, from the permutation giving the largest M<sub>s</sub> (${esc(fsv.toeLbl||"")}); all factors 1.0.`) : "";
+  const heelSvcH= fsv.heelD? eqB("Heel service moment M<sub>s</sub> (crack control)","AASHTO 5.6.7; Service I",[
+      `M_{s} = |M_{dn,SI} - M_{up,SI}| = |${fmtT(fsv.heelD.Mdn,3)} - ${fmtT(fsv.heelD.MhU,3)}| = ${fmtT(fsv.heel)}\\ \\text{kip-ft/ft}`],
+      `Soil, footing, LS and ES over the heel at 1.0, less the ${R.heelDem.src==="pile"?"Service I pile-row moment":"Service I contact-pressure moment"} about the stem back face; permutation ${esc(fsv.heelLbl||"")}.`) : "";
+  h+=sectionHTML(cT, toeDemH+toeSvcH, "5.3","Toe — Flexure & Shear (bottom reinforcement)");
@@ -4378,2 +4473,9 @@ function renderTabStruct(R){
-      `M_{dn} = w_{dn}\\dfrac{L_{heel}^2}{2}${hd.wedgeM>0?" + \\gamma_{EV}\\,\\gamma\\,h_{wedge}\\dfrac{L_{heel}^2}{3}":""} = ${fmtT(hd.MheelDn)}\\ \\text{kip-ft/ft}\\,, \\qquad M_{up} = ${fmtT(hd.MheelUp)}\\ \\text{kip-ft/ft}`,
-      `M_u = |M_{dn}-M_{up}| = ${fmtT(hd.Mu)}\\ \\text{kip-ft/ft (}${hd.face}\\text{ tension)}\\,, \\qquad V_u = ${fmtT(hd.Vu)}\\ \\text{kip/ft}`],
+      `w_{soil} = ${fmtT(R.footWt.wSoilHeel,3)},\\ w_{ftg} = \\gamma_c t_f = ${fmtT(R.footWt.wFoot,3)},\\ w_{LS} = \\gamma h_{eq} = ${fmtT(R.footWt.wLSv,3)},\\ q_{ES} = ${fmtT(+S.soil.esQ||0,3)}\\ \\text{ksf}`,
+      `M_{dn} = w_{dn}\\dfrac{L_{heel}^2}{2}${hd.wedgeM>0?" + \\gamma_{EV}\\,\\gamma\\,h_{wedge}\\dfrac{L_{heel}^2}{3}":""} = (${fmtT(hd.wDn,3)})\\dfrac{(${fmtT(g.Lheel)})^2}{2}${hd.wedgeM>0?` + ${fmtT(hd.wedgeM)}`:""} = ${fmtT(hd.MheelDn)}\\ \\text{kip-ft/ft}`,
+      ...(hd.src==="bearing"? pressWorkTex(hd.segs, R.geo.xStemBack, R.geo.B, R.geo.xStemBack, "V_{up}", "M_{up}", true)
+        : hd.src==="pile"? (()=>{ const Lf=+g.Lftg||g.Lab, rr=hd.rows||[]; return [`M_{up} = \\Sigma\\dfrac{P_{row}}{L_{ftg}}(x_{row} - x_{back}) = ${rr.length?rr.map(r=>`(${fmtT(r.P/Lf,3)})(${fmtT(r.xT-R.geo.xStemBack,3)})`).join(" + "):"0"} = ${fmtT(hd.MheelUp,3)}\\ \\text{kip-ft/ft}`]; })() : []),
+      `M_u = |M_{dn}-M_{up}| = |${fmtT(hd.MheelDn)} - ${fmtT(hd.MheelUp)}| = ${fmtT(hd.Mu)}\\ \\text{kip-ft/ft (}${hd.face}\\text{ tension)}`,
+      ...(hd.hVd? [`\\text{Shear at the stem back face (${esc(hd.lsV||"")}): } V_{dn} = w_{dn}L_{heel}${hd.wedgeM>0?" + \\gamma_{EV}\\tfrac{1}{2}\\gamma h_{wedge}L_{heel}":""} = (${fmtT(hd.hVd.wDn,3)})(${fmtT(g.Lheel)})${hd.wedgeM>0?" + \\ldots":""} = ${fmtT(hd.hVd.VheelDn,3)}\\ \\text{kip/ft}`,
+          ...(hd.src==="bearing"? pressWorkTex(hd.hVd.segs, R.geo.xStemBack, R.geo.B, R.geo.xStemBack, "V_{up}", "", false)
+            : [`V_{up} = \\Sigma\\dfrac{P_{row}}{L_{ftg}} = ${(hd.hVd.rows||[]).length?hd.hVd.rows.map(r=>`\\dfrac{${fmtT(r.P,1)}}{${fmtT(+g.Lftg||g.Lab)}}`).join(" + "):"0"} = ${fmtT(hd.hVd.VheelUp,3)}\\ \\text{kip/ft}`]),
+          `V_u = |V_{dn} - V_{up}| = |${fmtT(hd.hVd.VheelDn,3)} - ${fmtT(hd.hVd.VheelUp,3)}| = ${fmtT(hd.Vu)}\\ \\text{kip/ft}`] : [`V_u = ${fmtT(hd.Vu)}\\ \\text{kip/ft}`])],
@@ -4388 +4490 @@ function renderTabStruct(R){
-  h+=sectionHTML(cH, heelDemH+heelMassH, "5.4","Heel — Flexure & Shear ("+hd.face+" reinforcement)");
+  h+=sectionHTML(cH, heelDemH+heelSvcH+heelMassH, "5.4","Heel — Flexure & Shear ("+hd.face+" reinforcement)");
@@ -4415 +4517,2 @@ function renderTabStruct(R){
-      `P_u = \\dfrac{P_{u,girder}}{n_b} = \\dfrac{${fmtT(bs.PuG)}}{${bs.nBg}} = ${fmtT(bs.Pu)}\\ \\text{kip per bearing}`,
+      ...(bs.puT?[`P_{u,girder} = \\gamma_{DC}P_{DC} + \\gamma_{DW}P_{DW} + \\gamma_{LL}P_{LL}${bs.puT.gWS?" + \\gamma_{WS}P_{WS} + \\gamma_{WL}P_{WL}":""} = ${fmtT(bs.puT.gDC)}(${fmtT(bs.puT.DC)}) + ${fmtT(bs.puT.gDW)}(${fmtT(bs.puT.DW)}) + ${fmtT(bs.puT.gLL)}(${fmtT(bs.puT.LL)})${bs.puT.gWS?` + ${fmtT(bs.puT.gWS)}(${fmtT(bs.puT.WS)}) + ${fmtT(bs.puT.gWL)}(${fmtT(bs.puT.WL)})`:""} = ${fmtT(bs.PuG)}\\ \\text{kip} \\quad(\\text{girder ${bs.pgirder}, ${esc(bs.pls)}; reactions from panel I-5})`]:[]),
+      `P_u =\\dfrac{P_{u,girder}}{n_b} = \\dfrac{${fmtT(bs.PuG)}}{${bs.nBg}} = ${fmtT(bs.Pu)}\\ \\text{kip per bearing}`,
@@ -4422,0 +4526 @@ function renderTabStruct(R){
+    ${svgSeatPlan(R)}
@@ -4449,0 +4554,2 @@ function renderTabStruct(R){
+      ${svgRebarDims(R)}
+      <div class="figcap">Dimensioned section to scale (ABSW): ℓ<sub>dh</sub> and the dowel lap from <span class="xlink" data-jump="tab-struct|o-str-dowel">§5.2a</span>, ℓ<sub>d</sub> of the toe and heel bars from §5.3 / §5.4.</div>
@@ -4452 +4558 @@ function renderTabStruct(R){
-      <div class="note-box"><b>Lengths are estimates for quantity take-off only</b> (member length + development/hook allowances, no laps or bends detailed). Splice locations, hooks, corner bars and bar lists are the detailer's responsibility; development shown with all modification factors = 1.0.</div>
+      <div class="note-box"><b>Lengths are estimates for quantity take-off only</b> (member length + development/hook allowances, no laps or bends detailed). Splice locations, hooks, corner bars and bar lists are the detailer's responsibility; development with λ<sub>rc</sub> per Eq. 5.10.8.2.1c-2 (k<sub>tr</sub> = 0, β<sub>t</sub> = 0), other modification factors as in each section.</div>
@@ -4522 +4628 @@ function renderTabVM(R){
-  const selLabel=(()=>{ for(const[,opts]of VM_SEL_GROUPS)for(const[v,l]of opts)if(v===sel)return l; return sel; })();
+  const selLabel=sel==="ls:Extreme Event I"?"Extreme Event I":(()=>{ for(const[,opts]of VM_SEL_GROUPS)for(const[v,l]of opts)if(v===sel)return l; return sel; })();
@@ -4524,2 +4630,2 @@ function renderTabVM(R){
-  const optsHTML=VM_SEL_GROUPS.map(([grp,opts])=>
-    `<optgroup label="${esc(grp)}">${opts.map(([v,l])=>`<option value="${v}"${v===sel?" selected":""}>${esc(l)}</option>`).join("")}</optgroup>`).join("");
+  const optsHTML=VM_SEL_GROUPS.map(([grp,opts],gi)=>
+    `<optgroup label="${esc(grp)}">${(gi===0&&LIMITS_HAS_EQ(R)?opts.concat([["ls:Extreme Event I","Extreme Event I (M–O + inertia)"]]):opts).map(([v,l])=>`<option value="${v}"${v===sel?" selected":""}>${esc(l)}</option>`).join("")}</optgroup>`).join("");   // ABSW: EE I when on
@@ -4565,0 +4672,4 @@ function renderTabVM(R){
+  // ABSW: lateral pressure on the stem and backwall for the selected load state
+  h+=panel("o-vm-press","6.5","Lateral Pressure on the Stem & Backwall — "+esc(selLabel),`
+    ${svgWallPressure(R)}
+    <div class="figcap">Pressure diagram of the selected state (the distributed load w(z) integrated in §6.1 and §6.2); EH, LS and ES worked in <span class="xlink" data-jump="tab-loads|o-eh">Tab 1 §1.3</span> and <span class="xlink" data-jump="tab-struct|o-str-Stem">Tab 5 §5.2</span>.</div>`);
@@ -4668,0 +4779,182 @@ function dimV(y1,y2,x,label){
+/* ---------- ABSW (2026-10-20): print-friendly inline-SVG figures. Display only: every value drawn comes from computeAll()
+   (R) or is re-derived from the same worked terms; no check uses them. ---------- */
+const SVGF='font-family="Times New Roman"';
+function svgT(x,y,t,o={}){ return `<text x="${x}" y="${y}" font-size="${o.fs||11}" ${SVGF} fill="${o.c||"#222"}"${o.a?` text-anchor="${o.a}"`:""}${o.b?' font-weight="bold"':""}>${t}</text>`; }
+function svgArrow(x1,y1,x2,y2,c,w){ return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c||"#444"}" stroke-width="${w||1.4}" marker-end="url(#arr)"/>`; }
+function svgWrap(W,H,body,maxw){ return `<svg class="absw-fig" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${maxw||W}px;background:#fff">${svgDefs()}${body}</svg>`; }
+
+/* 1. Lateral pressure on the stem and backwall for the V&M selection (factored for a limit state), from the same distributed
+      load the V&M integration uses; EE I point loads drawn as arrows. */
+function svgWallPressure(R){
+  const vm=R.vm||{}, st=vm.stem, bw=vm.backwall; if(!st||!st.w||!bw||!bw.w) return "";
+  const g=S.geom, Ht=g.hstem+g.hbw, W=620, Hp=430, mT=30, mB=40, sc=(Hp-mT-mB)/Ht, x0=230;
+  const Y=y=>Hp-mB-y*sc;
+  const pts=[]; st.w.forEach((p,i)=>pts.push({y:st.pos[i],p})); bw.w.forEach((p,i)=>pts.push({y:g.hstem+bw.pos[i],p}));
+  const pmax=Math.max(1e-6,...pts.map(q=>Math.abs(q.p))), ps=220/pmax;
+  let b="";
+  // wall (back face at x0; drawn to the height scale, thickness schematic)
+  b+=`<rect x="${x0-g.tsb*sc}" y="${Y(g.hstem)}" width="${g.tsb*sc}" height="${g.hstem*sc}" fill="#ecebe4" stroke="#555"/>`;
+  b+=`<rect x="${x0-g.tbw*sc}" y="${Y(Ht)}" width="${g.tbw*sc}" height="${g.hbw*sc}" fill="#ecebe4" stroke="#555"/>`;
+  b+=`<line x1="${x0-130}" y1="${Y(0)}" x2="${x0+250}" y2="${Y(0)}" stroke="#555"/>`+svgT(x0-128,Y(0)+14,"top of footing",{fs:10,c:"#666"});
+  b+=svgT(x0-g.tsb*sc/2,Y(g.hstem/2),"stem",{a:"middle",c:"#666",fs:10});
+  b+=svgT(x0-g.tbw*sc/2-2,Y(g.hstem+g.hbw/2),"bw",{a:"middle",c:"#666",fs:10});
+  // pressure polygons (stem, backwall)
+  const poly=(arr,base)=>`<polygon points="${x0},${Y(base(arr[0]))} ${arr.map(q=>`${x0+q.p*ps},${Y(q.y)}`).join(" ")} ${x0},${Y(arr[arr.length-1].y)}" fill="rgba(31,58,95,0.18)" stroke="#1f3a5f" stroke-width="1.4"/>`;
+  const sP=st.w.map((p,i)=>({y:st.pos[i],p})), bP=bw.w.map((p,i)=>({y:g.hstem+bw.pos[i],p}));
+  b+=poly(sP,q=>q.y)+poly(bP,q=>q.y);
+  // values at the stem base, the seat and the backwall base
+  const lab=(q,txt)=>svgT(x0+q.p*ps+6,Y(q.y)+4,`${txt} ${fmt(q.p,3)} ksf`,{fs:10.5});
+  const sBase=sP.reduce((a,q)=>q.y<a.y?q:a,sP[0]), sTop=sP.reduce((a,q)=>q.y>a.y?q:a,sP[0]), bBase=bP.reduce((a,q)=>q.y<a.y?q:a,bP[0]);
+  b+=lab(sBase,"stem base")+lab(sTop,"seat")+(bw.w.length&&Math.abs(bBase.p-sTop.p)>1e-6?lab({y:bBase.y+0.25,p:bBase.p},"backwall base"):"");
+  if(st.pTop) b+=svgT(x0+8,Y(g.hstem)-8,`soil above the stem top: resultant ${fmt(st.pTop.V,2)} kip/ft at the seat (in V&M)`,{fs:9.5,c:"#555"});
+  // EE I point loads (ΔP_AE, wall inertia) and the girder/superstructure force at the seat
+  (st.ptsEQ||[]).forEach(q=>{ const y=g.hstem-q.s; b+=svgArrow(x0+150,Y(y),x0+4,Y(y),"#c62828",1.6)+svgT(x0+154,Y(y)+4,`${fmt(q.P,2)} kip/ft`,{fs:10,c:"#c62828"}); });
+  b+=svgT(10,18,`Lateral pressure on the back face — ${esc(R.vmSel.replace(/^ls:|^c?load:/,""))}${R.vmSel.startsWith("ls:")?" (factored)":" (γ = 1.0)"}`,{b:1,fs:12});
+  b+=svgT(10,Hp-12,"Distributed load w(z) of the V&M integration (EH + LS + ES"+(R.vmSel.includes("Constr")?" + CS":"")+"); red arrows: EE I point loads on the stem; horizontal scale exaggerated.",{fs:9.5,c:"#555"});
+  return svgWrap(W,Hp,b,620);
+}
+
+/* 2. Resultant location in each limit state against the kern (B/6), B/3 and the eccentricity limit of that state. */
+function svgResultants(R){
+  if(S.fnd.branch!=="spread"||!R.permutations) return "";
+  const B=R.geo.B, rows=[];
+  for(const ls of Object.keys(R.LIMITS)){
+    let best=null;
+    for(const pl of R.permutations(ls,true)){
+      const c=R.comboEffects(ls,pl.perm,pl.liveOn,true); if(c.V<=0) continue;
+      const xbar=(c.Mv-c.Mh)/c.V, e=B/2-xbar, lim=ls==="Service I"?null:R.resFor(ls,pl.liveOn).eLim, r=lim?Math.abs(e)/lim:Math.abs(e);
+      if(!best||r>best.r) best={r,xbar,e,lim,lbl:c.lbl}; }
+    if(best) rows.push({ls,...best});
+  }
+  const W=640, mL=120, mR=30, rowH=26, Hp=110+rows.length*rowH, sc=(W-mL-mR)/B, X=x=>mL+x*sc, yF=60;
+  let b=svgT(10,18,"Resultant location per limit state (permutation with the largest |e| / e_lim)",{b:1,fs:11.5});
+  b+=`<rect x="${X(0)}" y="${yF}" width="${B*sc}" height="14" fill="#ecebe4" stroke="#555"/>`;
+  b+=svgT(X(0),yF-6,"toe",{fs:10,c:"#666"})+svgT(X(B),yF-6,"heel",{fs:10,c:"#666",a:"end"});
+  const vline=(x,c,d,t,ty)=>`<line x1="${X(x)}" y1="${yF-2}" x2="${X(x)}" y2="${Hp-28}" stroke="${c}" stroke-dasharray="${d}" stroke-width="1"/>`+(t?svgT(X(x),ty,t,{fs:9.5,c,a:"middle"}):"");
+  b+=`<rect x="${X(B/2-B/6)}" y="${yF+16}" width="${B/3*sc}" height="${Hp-28-yF-16}" fill="rgba(26,127,55,0.07)"/>`;
+  b+=vline(B/2,"#999","2 2","B/2",yF+30);
+  b+=vline(B/2-B/6,"#1a7f37","4 3","B/6",Hp-16)+vline(B/2+B/6,"#1a7f37","4 3","B/6",Hp-16);
+  b+=vline(B/2-B/3,"#b8860b","6 3","B/3",Hp-16)+vline(B/2+B/3,"#b8860b","6 3","B/3",Hp-16);
+  rows.forEach((r,i)=>{ const y=yF+36+i*rowH;
+    if(r.lim&&Math.abs(r.lim-B/3)>1e-6){ b+=`<line x1="${X(B/2-r.lim)}" y1="${y-8}" x2="${X(B/2-r.lim)}" y2="${y+8}" stroke="#c62828" stroke-width="1.6"/><line x1="${X(B/2+r.lim)}" y1="${y-8}" x2="${X(B/2+r.lim)}" y2="${y+8}" stroke="#c62828" stroke-width="1.6"/>`; }
+    const ok=!r.lim||Math.abs(r.e)<=r.lim+1e-9;
+    b+=`<line x1="${X(B/2)}" y1="${y}" x2="${X(Math.min(B,Math.max(0,r.xbar)))}" y2="${y}" stroke="#888" stroke-width="1"/>`;
+    b+=`<circle cx="${X(Math.min(B,Math.max(0,r.xbar)))}" cy="${y}" r="5" fill="${ok?"#1f3a5f":"#c62828"}"/>`;
+    b+=svgT(8,y+4,esc(r.ls),{fs:10.5});
+    b+=svgT(W-mR,y+4,`|e| = ${fmt(Math.abs(r.e),2)} ft${r.lim?` / e_lim ${fmt(r.lim,2)} (${fmt(Math.abs(r.e)/r.lim,2)})`:" (Service: no limit)"}`,{fs:9.5,a:"end",c:ok?"#333":"#c62828"});
+  });
+  b+=svgT(10,Hp-4,"Green band = kern (|e| ≤ B/6, full contact); B/3 = middle two-thirds (soil limit); red ticks = a different limit of that state (rock 0.45B, Extreme Event). Worked in §3.2.",{fs:9,c:"#555"});
+  return svgWrap(W,Hp,b,640);
+}
+
+/* 3. Stem M_u(z) of the governing limit state against φM_n(z) up the stem (front batter: thickness varies, same bars). */
+function stemCapacityProfile(R){
+  const g=S.geom, m=S.mat, sd=R.stemDem, c=R.checks.stemFlex, bar=BARS[S.reinf.stem.size], sp=+S.reinf.stem.sp;
+  const Hs=sd.HsL??sd.Hs, eq=sd.eqT, out=[];
+  for(let i=0;i<=40;i++){ const z=g.hstem*i/40, h=Math.max(0,Hs-z), r=Hs>0?h/Hs:0;
+    let Mu=(sd.gEH??1)*(sd.MEH??0)*r*r*r + (sd.gLL||0)*(sd.MLS??0)*r*r + (sd.gES??1)*(sd.MES??0)*r*r + (sd.MCS||0)*r*r
+          + sd.HgirdPerFt*(g.hstem-z) + sd.MeccPerFt;
+    if(eq) Mu+= eq.dP*Math.max(0,eq.zP-z) + eq.Wi*Math.pow(g.hstem-z,2)/(2*g.hstem) + eq.sup*(g.hstem-z);
+    const tIn=(g.tsb-(g.tsb-g.tst)*z/g.hstem)*12, d=tIn-m.coverT-bar.db/2, As=bar.Ab*12/sp, a=As*m.fy/(0.85*m.fc*12);
+    const b1=Math.max(0.65,0.85-0.05*Math.max(0,m.fc-4)), cc=a/b1, et=cc>1e-9?0.003*(d-cc)/cc:1;
+    const phi=et>=0.005?0.90:et<=0.002?0.75:0.75+0.15*(et-0.002)/0.003;
+    out.push({z,Mu,phiMn:phi*As*m.fy*(d-a/2)/12}); }
+  return out;
+}
+function svgStemCapacity(R){
+  const pr=stemCapacityProfile(R), g=S.geom; if(!pr.length) return "";
+  const W=600, Hp=390, mL=60, mR=20, mT=44, mB=42, Mmax=Math.max(...pr.map(q=>Math.max(q.Mu,q.phiMn)))*1.18;
+  const X=v=>mL+v/Mmax*(W-mL-mR), Y=z=>Hp-mB-z/g.hstem*(Hp-mT-mB);
+  let b=svgT(10,18,`Stem: M_u(z) of the governing state (${esc(R.stemDem.ls)}) vs φM_n(z)`,{b:1,fs:12});
+  for(let k=0;k<=4;k++){ const v=Mmax*k/4; b+=`<line x1="${X(v)}" y1="${mT}" x2="${X(v)}" y2="${Hp-mB}" stroke="#e3e3e3"/>`+svgT(X(v),Hp-mB+14,fmt(v,0),{fs:9.5,a:"middle",c:"#555"}); }
+  for(let k=0;k<=4;k++){ const z=g.hstem*k/4; b+=`<line x1="${mL}" y1="${Y(z)}" x2="${W-mR}" y2="${Y(z)}" stroke="#eee"/>`+svgT(mL-6,Y(z)+4,fmt(z,1),{fs:9.5,a:"end",c:"#555"}); }
+  b+=`<polyline points="${pr.map(q=>`${X(q.Mu)},${Y(q.z)}`).join(" ")}" fill="none" stroke="#c62828" stroke-width="2"/>`;
+  b+=`<polyline points="${pr.map(q=>`${X(q.phiMn)},${Y(q.z)}`).join(" ")}" fill="none" stroke="#1f3a5f" stroke-width="2" stroke-dasharray="6 3"/>`;
+  b+=svgT(X(pr[0].Mu)+4,Y(0)-6,`M_u = ${fmt(pr[0].Mu,2)}`,{fs:10,c:"#c62828"})+svgT(X(pr[0].phiMn)-4,Y(0)-18,`φM_n = ${fmt(pr[0].phiMn,2)}`,{fs:10,c:"#1f3a5f",a:"end"});
+  b+=svgT(W/2,Hp-8,"kip-ft/ft",{a:"middle",fs:10,c:"#555"})+`<text x="14" y="${Hp/2}" font-size="10" ${SVGF} fill="#555" transform="rotate(-90 14 ${Hp/2})" text-anchor="middle">height above the top of footing z (ft)</text>`;
+  const lx=W-158, ly=22;
+  b+=`<rect x="${lx-4}" y="${ly-4}" width="150" height="16" fill="#fff" stroke="#ccc"/><line x1="${lx}" y1="${ly+4}" x2="${lx+22}" y2="${ly+4}" stroke="#c62828" stroke-width="2"/>`+svgT(lx+26,ly+8,"M_u(z)",{fs:10})+`<line x1="${lx+70}" y1="${ly+4}" x2="${lx+92}" y2="${ly+4}" stroke="#1f3a5f" stroke-width="2" stroke-dasharray="6 3"/>`+svgT(lx+96,ly+8,"φM_n(z)",{fs:10});
+  return svgWrap(W,Hp,b,600);
+}
+
+/* 4. Dimensioned reinforcement section (to scale). */
+function svgRebarDims(R){
+  const g=S.geom, m=S.mat, B=g.Ltoe+g.tsb+g.Lheel, Ht=g.tf+g.hstem+g.hbw, dw=R.checks.dowel, rf=S.reinf;
+  const W=680, mL=70, mR=150, mT=58, mB=92, sc=Math.min((W-mL-mR)/B,(560-mT-mB)/Ht), Hp=mT+mB+Ht*sc;
+  const X=x=>mL+x*sc, Y=y=>mT+(Ht-y)*sc, xsb=g.Ltoe+g.tsb, xbwF=xsb-g.tbw;
+  const conc='fill="#f2f2ec" stroke="#555" stroke-width="1.2"';
+  let b=svgT(10,18,"Reinforcement section — to scale, bar marks of the schedule",{b:1,fs:12});
+  b+=`<rect x="${X(0)}" y="${Y(g.tf)}" width="${B*sc}" height="${g.tf*sc}" ${conc}/>`;
+  b+=`<polygon points="${X(g.Ltoe)},${Y(g.tf)} ${X(xsb)},${Y(g.tf)} ${X(xsb)},${Y(g.tf+g.hstem)} ${X(xsb-g.tst)},${Y(g.tf+g.hstem)}" ${conc}/>`;
+  b+=`<rect x="${X(xbwF)}" y="${Y(Ht)}" width="${g.tbw*sc}" height="${g.hbw*sc}" ${conc}/>`;
+  const cT=m.coverT/12, cF=m.coverF/12, onP=S.fnd.branch==="pile";
+  const yBot=onP? Math.min(g.tf-0.1,(Math.max(0,+S.piles.embed||0)+Math.max(0,+S.piles.clrTop||0))/12) : cF;
+  const L=(x1,y1,x2,y2,c)=>`<line x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>`;
+  const xA=xsb-cT;
+  // A1 dowel with hook: vertical from the hook level up past the joint by the lap; stem bar above
+  const hookY=yBot+2*BARS[rf.toe.size].db/12, lap=(dw&&dw.lapProv>0?dw.lapProv:(dw?dw.lapReq:0))/12;
+  b+=L(xA,hookY,xA,g.tf+lap,"#c62828")+L(xA,hookY,xA-12*BARS[rf.stem.size].db/12-0.4,hookY,"#c62828");
+  b+=L(xA-0.08,g.tf+0.05,xA-0.08,g.tf+g.hstem-0.2,"#7a1f1f");
+  b+=L(xbwF+g.tbw-cT,Ht-0.15,xbwF+g.tbw-cT,g.tf+g.hstem-1.0,"#1f3a5f");
+  b+=L(0.25,yBot+0.05,xsb+(R.checks.toeFlex.ld/12),yBot+0.05,"#1a7f37");
+  b+=L(g.Ltoe-(R.checks.heelFlex.ld/12),g.tf-cF,B-0.25,g.tf-cF,"#b8860b");
+  // callouts
+  const call=(x,y,t,c)=>svgT(X(x),Y(y),t,{fs:10.5,c,b:1});
+  b+=call(xsb+0.3,g.tf+g.hstem*0.6,`A1 #${rf.stem.size} @ ${fmt(+rf.stem.sp,1)}"`,"#7a1f1f");
+  b+=call(xsb+0.3,g.tf+g.hstem+g.hbw*0.5,`B1 #${rf.bw.size} @ ${fmt(+rf.bw.sp,1)}"`,"#1f3a5f");
+  b+=call(0.3,yBot+0.35,`C1 #${rf.toe.size} @ ${fmt(+rf.toe.sp,1)}"`,"#1a7f37");
+  b+=call(B-2.2,g.tf-cF-0.45,`D1 #${rf.heel.size} @ ${fmt(+rf.heel.sp,1)}"`,"#b8860b");
+  // development / lap extents
+  if(dw){ b+=dimV(Y(g.tf),Y(hookY),X(xA)+18,`ℓdh ${fmt(dw.ldh,1)}" (avail. ${fmt(dw.lAv,1)}")`);
+    if(lap>0) b+=dimV(Y(g.tf+lap),Y(g.tf),X(xA)+44,`lap ${fmt(lap*12,1)}"${dw.lapProv>0?"":" req."}`); }
+  b+=dimH(X(xsb),X(xsb+R.checks.toeFlex.ld/12),Y(0)+20,`C1 ℓd past the stem ${fmt(R.checks.toeFlex.ld,1)}"`,14);
+  // overall dimensions
+  b+=dimH(X(0),X(g.Ltoe),Y(0)+50,`toe ${fmt(g.Ltoe,2)}'`)+dimH(X(g.Ltoe),X(xsb),Y(0)+50,`${fmt(g.tsb,2)}'`)+dimH(X(xsb),X(B),Y(0)+50,`heel ${fmt(g.Lheel,2)}'`);
+  b+=dimH(X(0),X(B),Y(0)+74,`B = ${fmt(B,2)}'`);
+  b+=dimV(Y(g.tf),Y(0),X(0)-14,`t_f ${fmt(g.tf,2)}'`)+dimV(Y(g.tf+g.hstem),Y(g.tf),X(0)-14,`h_stem ${fmt(g.hstem,2)}'`)+dimV(Y(Ht),Y(g.tf+g.hstem),X(0)-14,`h_bw ${fmt(g.hbw,2)}'`);
+  b+=dimH(X(xbwF),X(xsb),Y(Ht)-12,`t_bw ${fmt(g.tbw,2)}'`)+dimH(X(xsb-g.tst),X(xsb),Y(g.tf+g.hstem)+14,`t_st ${fmt(g.tst,2)}'`,12);
+  b+=svgT(X(B)+8,Y(g.tf)+12,`covers: wall ${fmt(m.coverT,1)}", footing ${fmt(m.coverF,1)}"`,{fs:9.5,c:"#555"});
+  if(onP) b+=svgT(X(B)+8,Y(g.tf)+26,`bottom mat on ${fmt(yBot*12,1)}" (pile emb. + clear)`,{fs:9.5,c:"#555"});
+  return svgWrap(W,Hp,b,680);
+}
+
+/* 5. Bridge-seat plan at the governing bearing: pad, clear edge distances c and the A₂ outline (Fig. 5.6.5-1 concept). */
+function svgSeatPlan(R){
+  const bs=R.checks.bearingSeat, bg=S.bearing, g=S.geom; if(!bs) return "";
+  const seatIn=R.geo.seatW*12, tbwIn=g.tbw*12, Lp=+bg.padL, Wp=+bg.padW, c=Math.max(0,bs.c);
+  const spanX=seatIn+tbwIn, halfY=Wp/2+Math.max(c,bs.cT>0?bs.cT:0)+12;
+  const W=600, Hp=360, mL=40, mT=40, sc=Math.min((W-2*mL)/spanX,(Hp-mT-50)/(2*halfY));
+  const X=x=>mL+x*sc, Y=y=>mT+(halfY+y)*sc, xc=seatIn-g.brgSetback*12;
+  let b=svgT(10,18,`Bearing seat plan — girder ${bs.pgirder} (governing q_b/q_R)`,{b:1,fs:12});
+  b+=`<rect x="${X(0)}" y="${Y(-halfY)}" width="${seatIn*sc}" height="${2*halfY*sc}" fill="#f2f2ec" stroke="#555"/>`;
+  b+=`<rect x="${X(seatIn)}" y="${Y(-halfY)}" width="${tbwIn*sc}" height="${2*halfY*sc}" fill="#dcdcd4" stroke="#555"/>`;
+  b+=svgT(X(seatIn+tbwIn/2),Y(-halfY)-6,"backwall",{a:"middle",fs:10,c:"#555"})+svgT(X(0),Y(-halfY)-6,"seat front edge",{fs:10,c:"#555"});
+  if(c>0) b+=`<rect x="${X(xc-Lp/2-c)}" y="${Y(-Wp/2-c)}" width="${(Lp+2*c)*sc}" height="${(Wp+2*c)*sc}" fill="rgba(31,58,95,0.06)" stroke="#1f3a5f" stroke-dasharray="6 3"/>`;
+  b+=`<rect x="${X(xc-Lp/2)}" y="${Y(-Wp/2)}" width="${Lp*sc}" height="${Wp*sc}" fill="#c9c3b3" stroke="#333" stroke-width="1.4"/>`;
+  b+=svgT(X(xc),Y(0)+4,`pad ${fmt(Lp,1)}" × ${fmt(Wp,1)}"`,{a:"middle",fs:10});
+  b+=dimH(X(0),X(xc-Lp/2),Y(Wp/2)+22,`c_front ${fmt(bs.cFront,1)}"`);
+  b+=dimH(X(xc+Lp/2),X(seatIn+tbwIn),Y(Wp/2)+22,`c_back ${fmt(bs.cBack,1)}"`);
+  b+=dimV(Y(-Wp/2),Y(-Wp/2-Math.max(0,Math.min(bs.cT,halfY-Wp/2))),X(xc)+Lp*sc/2+18,`c_trans ${fmt(bs.cT,1)}"`);
+  if(c>0) b+=svgT(X(xc-Lp/2-c),Y(Wp/2+c)+14,`A₂ = (${fmt(Lp,1)} + 2·${fmt(c,1)})(${fmt(Wp,1)} + 2·${fmt(c,1)}) = ${fmt(bs.A2,0)} in²`,{fs:10,c:"#1f3a5f"});
+  b+=svgT(10,Hp-10,`c = min(c_front, c_back, c_trans) = ${fmt(bs.c,1)}" (${esc(bs.cBy)}); m = √(A₂/A₁) = ${fmt(bs.mRaw,3)} → ${fmt(bs.m,3)}. Worked above.`,{fs:9.5,c:"#555"});
+  return svgWrap(W,Hp,b,600);
+}
+
+/* 6. Pile reactions across the footing (section): one arrow per pile row for the governing max-compression case. */
+function svgPileReactions(R){
+  const pc=R.checks.pileComp; if(!pc||!pc.det||!pc.det.loads) return "";
+  const act=activePiles(), B=R.geo.B, rows={};
+  act.forEach((p,i)=>{ const k=p.x.toFixed(4); const r=(rows[k]=rows[k]||{x:B/2+p.x,n:0,sum:0,max:-Infinity,min:Infinity}); const v=pc.det.loads[i]; r.n++; r.sum+=v; r.max=Math.max(r.max,v); r.min=Math.min(r.min,v); });
+  const rr=Object.values(rows).sort((a,b)=>a.x-b.x), Pm=Math.max(1e-6,...rr.map(r=>Math.abs(r.max)),...rr.map(r=>Math.abs(r.min)));
+  const W=600, Hp=300, mL=50, sc=(W-2*mL)/B, X=x=>mL+x*sc, yF=70, aL=130/Pm;
+  let b=svgT(10,18,`Pile reactions per row — ${esc(pc.ls)}: ${esc(pc.lbl||"")}`,{b:1,fs:11});
+  b+=`<rect x="${X(0)}" y="${yF}" width="${B*sc}" height="${S.geom.tf*12>0?28:20}" fill="#ecebe4" stroke="#555"/>`;
+  b+=`<rect x="${X(S.geom.Ltoe)}" y="${yF-34}" width="${S.geom.tsb*sc}" height="34" fill="#ecebe4" stroke="#555"/>`;
+  b+=svgT(X(0),yF-6,"toe",{fs:10,c:"#666"})+svgT(X(B),yF-6,"heel",{fs:10,c:"#666",a:"end"});
+  rr.forEach(r=>{ const x=X(r.x), y0=yF+28, len=Math.abs(r.max)*aL;
+    b+=r.max>=0? svgArrow(x,y0+len+6,x,y0+2,"#1f3a5f",2) : svgArrow(x,y0+2,x,y0+len+6,"#5b7fa6",2);
+    b+=svgT(x,y0+len+20,`max ${fmt(r.max,1)} k`,{a:"middle",fs:10})+svgT(x,y0+len+33,`${r.n} piles, Σ ${fmt(r.sum,0)} k`,{a:"middle",fs:9,c:"#555"}); });
+  b+=svgT(10,Hp-8,"Arrow length ∝ the largest pile reaction in the row (upward = compression on the cap). From the rigid-cap distribution of §4.2.",{fs:9.5,c:"#555"});
+  return svgWrap(W,Hp,b,600);
+}
+
@@ -4855 +5147 @@ function drawPilePlan(){
-  const Hpx=B*sc+2*m+10;
+  const Hpx=B*sc+2*m+10+32;   // ABSW: +32 for the perimeter / shear legend lines
@@ -4894,0 +5187,9 @@ function drawPilePlan(){
+  // ABSW: punching critical perimeters (pile size + d_v, square envelope, §4.6) and per-pile shear arrows (H/n, §4.5)
+  if(R&&R.checks&&R.checks.punching){ const pn=R.checks.punching, sd=(pn.sPile+pn.dv)/12;
+    S.piles.coords.forEach(c=>{ if(!c.active) return;
+      s+=`<rect x="${Xc(c.y)-sd/2*sc}" y="${Yc(c.x)-sd/2*sc}" width="${sd*sc}" height="${sd*sc}" fill="none" stroke="#7a2020" stroke-width="0.9" stroke-dasharray="3 2"/>`; });
+    s+=`<text x="${Xc(Lft/2)}" y="${Yc(B/2)+44}" text-anchor="end" font-size="9.5" font-family="Times New Roman" fill="#7a2020">dashed squares: punching perimeter, side = pile + d_v = ${fmt(pn.sPile+pn.dv,1)} in (§4.6)</text>`; }
+  if(R&&R.pile&&R.pile.shear&&R.pile.shear.Hres>1e-6){ const sh=R.pile.shear, len=18, ux=sh.Hy/sh.Hres, uy=-sh.Hx/sh.Hres;
+    S.piles.coords.forEach(c=>{ if(!c.active) return; const cx=Xc(c.y), cy=Yc(c.x);
+      s+=`<line x1="${cx}" y1="${cy}" x2="${cx+ux*len}" y2="${cy+uy*len}" stroke="#555" stroke-width="1.2" marker-end="url(#arr)"/>`; });
+    s+=`<text x="${Xc(-Lft/2)}" y="${Yc(B/2)+60}" font-size="9.5" font-family="Times New Roman" fill="#555">arrows: shear per pile H/n = ${fmt(sh.Hres,2)} kip (H_x ${fmt(sh.Hx,2)}, H_y ${fmt(sh.Hy,2)}; ${esc(sh.ls||"")}, §4.5)</text>`; }
```
