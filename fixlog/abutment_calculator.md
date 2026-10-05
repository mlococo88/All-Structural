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
