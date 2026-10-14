# Fix log — stgirder.html

Governing basis used for fixes: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), Section 6 (and App. D6); AASHTO MBE for rating (unchanged).

## 2026-10-04 — PR: claude/fix-stgirder (PR link added after merge)

Line numbers below are for the file **after** this PR. Every calculation change was checked by
running the real `computeAll()` from the old (origin/main c58cb6d) and new file under node
(Babel-standalone 7.23.5 transpile of the `text/babel` block), and every tab component was
server-rendered with React 18.2.0 for 6 input variants without error.

### F1. Shared `BridgeApps` block (bridgeSuite.v1.appPaths) replaced with the current copy   [bug fix] [no result change]
- **Where:** plain `<script>` IIFE "SHARED APP PATHS · bridgeSuite.v1.appPaths" (≈ lines 526–671). Anchor text: `SHARED APP PATHS  ·  bridgeSuite.v1.appPaths`
- **Problem:** stgirder carried an old version (no per-folder `at` map, no `selfDir`/`entry`/`prune`/`ME`/`same`). Every time ST-Girder opened, `register()` rewrote `appPaths.stgirder` as `{file,pinned:false,seenAt}` with no `dir`/`at`, erasing the per-folder record the other three apps keep. The other apps then read it through the legacy branch, which applies it to every folder (re-creating the cross-folder mis-link). `path()` also had no "never resolve a sibling to this same file" guard.
- **Governing provision:** n/a
- **Before:** the 87-line block at old lines 526–612 (md5 `bf6044ab55829d88103491de6ed28c2d`).
- **After:** psbeam.html lines 616–761 copied verbatim (146 lines, md5 `9f13146d25d65ca78c685b5cccf061b6`). The `try{ window.BridgeApps.boot('stgirder'); }catch(e){}` line after it is unchanged.
- **Check case:** `diff` of the block (from the `/* ====` line above `SHARED APP PATHS` to the `})();` before the `boot(` line) — stgirder.html 526–671 vs psbeam.html 616–761, index.html 272–417, lldf.html 645–790: **identical** (all four md5 `9f13146d25d65ca78c685b5cccf061b6`).
- **Saved data:** the key `bridgeSuite.v1.appPaths` is unchanged. stgirder now writes the same entry format the other three apps already write; old flat entries are still read through the existing legacy branch (`if(e.file&&!e.dir)`), and an old top-level pin is preserved by `register()`.
- **How verified:** diff/md5 as above; transpile + node `new Function` syntax check of every inline script.
- **Other copies of this code:** index.html, lldf.html, psbeam.html, stgirder.html (now byte-identical in all four).

### F2. MIDAS imported dead-load shears negated to the app sign convention   [calc change] [more conservative]
- **Where:** function `buildExternal` (≈ line 1664–1677). Anchor: `V_DC1:(x)=>-interp('V_DC1',x)`
- **Problem:** MIDAS element shear (exported signed by index.html) has the opposite sign to the app's `simpleV()`/`diaV()` (+V at the left support). stgirder used the imported V_DC1/V_DC2/V_DW raw and summed them with app-computed shears (DC1 + self-weight, or self-weight when `selfWeightExcluded`), so the components partly cancelled and Vu at the supports was understated. psbeam already negates (psbeam.html `buildExternal`).
- **Governing provision:** AASHTO LRFD 10th Ed. Table 3.4.1-1 (Strength I combination 1.25DC + 1.50DW + 1.75LL) — sign consistency of the components, no formula change.
- **Before:**
  ```js
    M_DC1:(x)=>interp('M_DC1',x), V_DC1:(x)=>interp('V_DC1',x),        // k-ft / kip
    M_DC2:(x)=>interp('M_DC2',x), V_DC2:(x)=>interp('V_DC2',x),
    M_DW :(x)=>interp('M_DW',x),  V_DW :(x)=>interp('V_DW',x),
    M_LLpos:(x)=>interp('M_LLpos',x)*fPos, M_LLneg:(x)=>interp('M_LLneg',x)*fNeg,
  ```
- **After:** (plus an 8-line comment above `return {`)
  ```js
    M_DC1:(x)=>interp('M_DC1',x), V_DC1:(x)=>-interp('V_DC1',x),       // k-ft / kip
    M_DC2:(x)=>interp('M_DC2',x), V_DC2:(x)=>-interp('V_DC2',x),
    M_DW :(x)=>interp('M_DW',x),  V_DW :(x)=>-interp('V_DW',x),
    M_LLpos:(x)=>interp('M_LLpos',x)*fPos, M_LLneg:(x)=>interp('M_LLneg',x)*fNeg,
    V_LLpos:(x)=>-interp('V_LLneg',x)*fV, V_LLneg:(x)=>-interp('V_LLpos',x)*fV,
  ```
  `V_LL` (used by every check) is a magnitude envelope `max(|V_LLpos|,|V_LLneg|)` and is unchanged; `V_LLpos/V_LLneg` are added for parity with psbeam and are not used by any check.
- **Consumers checked:** strength `Vu` (stations, ≈2094), constructibility `V1c` (≈2304, only mixes when `hasDC1 && selfWeightExcluded`), web special fatigue `Vperm` (≈2394), shear rating `VDC/VDWr` (≈2478, via `stVGov`). The Diagrams tab "view span" plot (≈3591) plots the raw imported station values in MIDAS convention, internally consistent; left unchanged (display only). When the file supplies DC1 including self-weight (`hasDC1 && !selfWeightExcluded`) all three dead shears flip together and every consumer uses |sum|, so results are unchanged in that case.
- **Check case (run in node):** defaults (L = 120 ft, wDC1 = 1.178 klf app-computed), imported simple-span DC2 0.30 klf and DW 0.25 klf in MIDAS sign (V_DC2(0) = −18.0, V_DW(0) = −15.0 kip), |V_LL| = 90 kip at the support, no DC1 in the file. At x = 0, V1 = 1.178·60 = 70.68 kip.
  - before: Vu = |1.25(70.68 − 18.0) + 1.5(−15.0)| + 1.75·90 = 43.35 + 157.5 = **200.85 kip** (D/C 0.363); web Vperm = 37.68 kip; shear rating VDC = 52.68, RF_inv = 2.948.
  - after: Vu = |1.25(70.68 + 18.0) + 1.5(15.0)| + 157.5 = 133.35 + 157.5 = **290.85 kip** (D/C 0.526); Vperm = 103.68 kip; VDC = 88.68, RF_inv = 2.662.
  - Same file with DC1 in the file (0.948 klf, self-weight excluded, app adds wsw = 0.230 klf): constructibility V1c(0) before −43.12 kip → after +70.68 kip; constructibility shear 54.80 → 89.25 kip.
- **How verified:** node run of old/new `computeAll` (scratch `st_cases.js`).
- **Other copies of this code:** psbeam.html `buildExternal` already has the negation (reference copy). index.html exports the signed values.

### F3. Noncomposite (deck off) positive flexure uses 6.10.8.2 Fnc (FLB/LTB with Lb)   [calc change] [more conservative]
- **Where:** `computeAll` segment loop (≈ line 2017–2026) and display in `FlexTab`. Anchor: `const FncPosNC_=deck.deckOn? null :`
- **Problem:** with the deck off the section is noncomposite, but the positive-flexure compression flange used `Rb·Rh·Fyc` (the composite value, 6.10.7.2.2). A noncomposite top flange braced only at cross-frames must use Fnc = min(FLB, LTB) per 6.10.8.2.
- **Governing provision:** AASHTO LRFD 10th Ed. 6.10.8.1.1 / 6.10.8.2.2 / 6.10.8.2.3 (Cb = 1.0 kept, as elsewhere in the app).
- **Before:**
  ```js
        FncPos:Rb_*Rh_*Fyc, Fnt:Rh_*Fyf, Iyc:Iyc_, Iyt:Iyt_,
  ```
- **After:**
  ```js
      const FncPosNC_=deck.deckOn? null : flangeFnc(dims.bft,dims.tft,dims.tw,dims.D,Lb_in,Fyc,Es,Rb_,Rh_,1.0,cN_.Dc,Fyw);
  ...
        FncPos:FncPosNC_? FncPosNC_.Fnc : Rb_*Rh_*Fyc, FncPosNC:FncPosNC_, Fnt:Rh_*Fyf, Iyc:Iyc_, Iyt:Iyt_,
  ```
  (`cN_` is the bare section when the deck is off.) `flexMode` text now says "Noncomposite — stress basis, Fnc per 6.10.8.2 (FLB/LTB)"; the Flexure tab shows the FLB/LTB values. The "Strength flexure (+M)" check row now reports the demand/limit of the flange that governs the D/C (before, it always showed the bottom flange vs Fnt even when the top flange governed r) — display only, r unchanged by that part.
- **Check case:** defaults with `deck.deckOn=false` (top flange 16×0.75, Lb = 20 ft, Rb = 0.977, Rh = 1.0, Dc = 38.28 in): rt = 3.732 in, Lp = 7.49 ft, Lr = 28.13 ft, FLB = 45.65 ksi, LTB = 39.95 ksi.
  - before: Fnc = 0.977·1.0·50 = 48.83 ksi; fbu,top = 60.14 ksi → D/C = 1.232.
  - after: Fnc = 39.95 ksi → D/C = 60.14/39.95 = **1.505**.
- **How verified:** node run old/new.
- **Other copies of this code:** none known.

### F4. 1.3RhMy cap on Mn for compact composite sections in continuous spans   [calc change] [more conservative]
- **Where:** `computeAll`, Strength I flexure station loop (≈ lines 2171–2230), `flex`/`MnGov` (≈2239), rating `capM` (≈2477), check row (≈2525); display in `FlexTab`. Anchor: `const contSpan = useExt && hasNeg;`
- **Problem:** Eq. 6.10.7.1.2-3 (Mn ≤ 1.3RhMy in a continuous span) was not applied; Mp-based Mn could govern in continuous spans.
- **Governing provision:** AASHTO LRFD 10th Ed. 6.10.7.1.2 (Eq. 6.10.7.1.2-3); My per App. D6.2.2 (staged: MD1 on the steel section, MD2 on the long-term 3n section, MAD on the short-term n section, lesser of the two flanges). The B6.2 exemption is not evaluated, so the cap is always applied when the span is continuous.
- **Continuity test:** `useExt && hasNeg` — imported demands with factored negative moment in the selected span. Applied only at stations with Mu > 0 (positive-flexure region). The capped value also flows to the per-station capacity export (`capPos` → `bridgeSuite.v1.capacity` phiMn_pos) and the flexure rating.
- **Before:**
  ```js
      const capPos = sg.compact? phif*sg.Mn_kft
  ...
        if(sg.compact){ r=st.Mu/(phif*sg.Mn_kft); mode='Mp'; }
  ...
    const capM=sgPos.compact? phif*sgPos.Mn_kft
  ```
- **After:**
  ```js
    const contSpan = useExt && hasNeg;
    const yieldMy=(st,sg)=>{
      const MD1=1.25*st.M1, MD2=1.25*st.M2+1.5*st.Mw;              // k-ft, factored permanent
      const fd=stageF(st,1.25,1.25,1.5,0).pos;                      // ksi, fB tension+, fT compression+
      const MADb=sg.cN.Sb*(Fyf-fd.fB)/12, MADt=sg.cN.StSteel*(Fyf-fd.fT)/12;
      const MyB=MD1+MD2+MADb, MyT=MD1+MD2+MADt;
      return {MD1,MD2,fDb:fd.fB,fDt:fd.fT,MADb,MADt,MyB,MyT,My:Math.min(MyB,MyT)};
    };
    stations.forEach(st=>{ const sg=segP[st.si];
      let MnSt=sg.Mn_kft, my13=null;
      if(sg.compact && contSpan && st.Mu>0){
        const y=yieldMy(st,sg), lim13=1.3*sg.Rh*y.My;
        my13={...y, Rh:sg.Rh, lim13, MnMp:sg.Mn_kft, governs:lim13<sg.Mn_kft};
        if(isFinite(lim13) && lim13<MnSt) MnSt=Math.max(lim13,0);
      }
      const capPos = sg.compact? phif*MnSt
  ...
        if(sg.compact){ r=st.Mu/(phif*MnSt); mode='Mp'; }
  ...
    const MnGov=(sgPos.compact&&posGov.Mn!=null)? posGov.Mn : Mn_kft;
    const capM=sgPos.compact? phif*MnGov
  ```
  (`posC.Mn/phiMn/dc` and the check `lim` use `MnSt`/`MnGov` likewise.)
- **Check case:** defaults, imported span 1 of a 2×120 ft continuous girder (uniform DC1 1.25, DC2 0.30, DW 0.25 klf, +LL 1700 sin(πx/L), −LL to −1500 k-ft at the pier). Governing station x = 54 ft: M1 = 1212.5, M2 = 291.0, Mw = 242.5 k-ft; S_bare,b = 1688.0, S_3n,b = 2193.3, S_n,b = 2376.5 in³.
  - MD1 = 1.25·1212.5 = 1515.6; MD2 = 1.25·291 + 1.5·242.5 = 727.5 k-ft.
  - f_D,bot = 1515.6·12/1688.0 + 727.5·12/2193.3 = 10.775 + 3.980 = 14.755 ksi; MAD,bot = 2376.5·(50 − 14.755)/12 = 6980 k-ft (top flange MAD = 38,955, not governing).
  - My = 1515.6 + 727.5 + 6980 = 9223 k-ft; 1.3·Rh·My = 1.3·1.0·9223 = 11,990 k-ft.
  - before: Mn = Mp-basis 12,163 k-ft, D/C = 5177/12163 = 0.426, flex RF_inv = 3.381.
  - after: Mn = min(12163, 11990) = **11,990 k-ft**, D/C = 0.432, flex RF_inv = 3.322.
- **How verified:** node run old/new; hand values above match the run.
- **Other copies of this code:** none known.

### F5. Ductility Dp ≤ 0.42Dt checked for every composite positive section   [calc change] [more conservative]
- **Where:** `computeAll` check list (≈ line 2524); `FlexTab` tile. Anchor: `if(deck.deckOn) checks.push({n:'Ductility Dp≤0.42Dt'`
- **Problem:** only compact sections were checked; 6.10.7.3 applies to compact and noncompact composite sections in positive flexure.
- **Governing provision:** AASHTO LRFD 10th Ed. 6.10.7.3.
- **Before:** `if(sgPos.compact) checks.push({n:'Ductility Dp≤0.42Dt', ...` and tile `{f.compact&&<div ...Ductility`
- **After:** `if(deck.deckOn) checks.push({n:'Ductility Dp≤0.42Dt', ...` and tile `{f.composite&&<div ...Ductility` (`flex.composite = !!deck.deckOn`).
- **Check case:** D = 84, tw = 0.5625, top 12×0.625, bottom 24×2.5, ts = 7 in, beff = 60 in (noncompact, PNA in web): Dp = 72.9, Dt = 96.1, 0.42Dt = 40.4 in → before: no check; after: Dp/0.42Dt = **1.806 FAIL**.
- **How verified:** node run old/new.
- **Other copies of this code:** none known.

### F6. Fatigue I/II crossover uses the 1.75 / 0.80 load-factor ratio   [calc change] [LESS conservative — corrects a conservative error]
- **Where:** `computeAll` fatigue block (≈ line 2368–2372); Fatigue tab Step 2. Anchor: `const fatGRatio = 0.80/1.75;`
- **Problem:** "auto" picked Fatigue I when (A/N)^⅓ ≤ (ΔF)TH. With γ = 1.75 (Fatigue I) and 0.80 (Fatigue II), Fatigue I governs only when (A/N)^⅓ ≤ (0.80/1.75)(ΔF)TH — the basis of Table 6.6.1.2.3-2 (Cat. C, 75 yr: 1,680/day). The app switched at 161/day for Cat. C.
- **Governing provision:** AASHTO LRFD 10th Ed. 6.6.1.2.3 and Table 6.6.1.2.3-2; Table 3.4.1-1 (γ Fatigue I = 1.75, Fatigue II = 0.80).
- **Before:**
  ```js
    const adttSLcross = Acat/(Math.pow(THcat,3)*365*lifeYr*nCyc);
  ```
- **After:**
  ```js
    const fatGRatio = 0.80/1.75;
    const adttSLcross = Acat/(Math.pow(fatGRatio*THcat,3)*365*lifeYr*nCyc);
  ```
- **Check case:** Cat. C (A = 44×10⁸, TH = 10), 75 yr, n = 1. Crossover before 44e8/(1000·27375) = **160.7**/day → after 44e8/((0.4571·10)³·27375) = **1,682**/day (Table: 1,680). Defaults with ADTT_SL = 1000: before Fatigue I, γΔf/(ΔF)n = 1.75·3.723/10 = **0.652**; after Fatigue II, (ΔF)n = (44e8/2.7375e7)^⅓ = 5.437 ksi, 0.80·3.723/5.437 = **0.548**. ADTT_SL = 500: 0.652 → 0.435. ADTT_SL = 2000: Fatigue I in both (0.652).
- **How verified:** node run old/new; table values reproduced for C (1,682) and C′ (973).
- **Other copies of this code:** none known (index.html uses different fatigue factors; see AUDIT).

### F7. Fatigue II resistance: ½(ΔF)TH floor removed   [calc change] [more conservative]
- **Where:** `computeAll` (≈ line 2380); Fatigue tab Step 3. Anchor: `const FnFatII = Math.pow(Acat/Nfat,1/3);`
- **Problem:** Eq. 6.6.1.2.5-2 for Fatigue II is (ΔF)n = (A/N)^⅓; the "≥ ½(ΔF)TH" floor belongs to the pre-2009 single-load-factor format. In auto mode the floor can never bind (Fatigue II is only chosen when (A/N)^⅓ ≥ 0.457TH); it only mattered when Fatigue II was forced manually at very high N.
- **Governing provision:** AASHTO LRFD 10th Ed. 6.6.1.2.5, Eq. 6.6.1.2.5-2.
- **Before:** `const FnFatII = Math.max(Math.pow(Acat/Nfat,1/3), THcat/2);`
- **After:** `const FnFatII = Math.pow(Acat/Nfat,1/3);`
- **Check case:** defaults, Fatigue II forced, ADTT_SL = 20,000: N = 5.475×10⁸, (A/N)^⅓ = 2.003 ksi; before (ΔF)n = max(2.003, 5.0) = 5.0, D/C 0.596 → after (ΔF)n = **2.003**, D/C **1.487**.
- **How verified:** node run old/new.
- **Other copies of this code:** none known.

### F8. Stud fatigue resistance for Fatigue I: Zr = 5.5d²   [calc change] [LESS conservative — corrects a conservative error]
- **Where:** `computeAll` shear connectors (≈ line 2462); Connectors tab formula/notes. Anchor: `const Zr=fatInf? 5.5*dStud2 : alphaF*dStud2;`
- **Problem:** infinite-life Zr was 5.5d²/2 paired with γ = 1.75; 6.10.10.2 gives Zr = 5.5d² for Fatigue I (the ÷2 floor belonged to the old single-factor format). Required about twice the studs.
- **Governing provision:** AASHTO LRFD 10th Ed. 6.10.10.2, Eq. 6.10.10.2-1 (Fatigue I) / -2 (Fatigue II).
- **Before:** `const Zr=fatInf? 5.5*dStud2/2 : alphaF*dStud2;`
- **After:** `const Zr=fatInf? 5.5*dStud2 : alphaF*dStud2;`
- **Check case:** 7/8-in studs, Fatigue I: Zr before 5.5·0.7656/2 = 2.105 → after **4.211 kip** (FHWA example value 4.21). Combined with F9 at ADTT_SL = 2000 (defaults, 3 studs/row): before Vsr = 0.741 k/in, p_req = 3·2.105/0.741 = 8.52 in → after Vsr = 1.141 k/in, p_req = 3·4.211/1.141 = **11.07 in**.
- **How verified:** node run old/new.
- **Other copies of this code:** none known.

### F9. Stud and web fatigue use the single-lane SHEAR DF (v1/1.2)   [calc change] [studs: more conservative per se; web: more conservative]
- **Where:** `computeAll` fatigue block (≈ line 2359), web special fatigue (≈2392), studs (≈2464); notes on the Fatigue and Connectors tabs. Anchor: `const dfFatV=(Ld.df? Ld.df.v1:Ld.dfv)/1.2;`
- **Problem:** the stud shear range (6.10.10.1.2) and the web special fatigue shear (6.10.5.3) were distributed with the single-lane **moment** DF (m1/1.2 or the LLDF fatM override).
- **Governing provision:** AASHTO LRFD 10th Ed. 4.6.2.2.3a (one-lane shear DF), 3.6.1.4.3b (MPF removed for fatigue), 6.10.10.1.2, 6.10.5.3.
- **Before:**
  ```js
      const Vll=fatShearAt(Lft,st.x)*1.15*dfFat;             // fatigue-truck shear, single-lane, IM 1.15
  ...
    const VfatU=Ld.hl.Vtr*1.15*dfFat;                    // unfactored range: fatigue truck, IM 1.15, 1-lane DF
  ```
- **After:**
  ```js
    const dfFatV=(Ld.df? Ld.df.v1:Ld.dfv)/1.2;
    const fatDfVSource='auto: (1-lane shear DF v₁)÷1.2';
  ...
      const Vll=fatShearAt(Lft,st.x)*1.15*dfFatV;            // fatigue-truck shear, single-lane SHEAR DF, IM 1.15
  ...
    const VfatU=Ld.hl.Vtr*1.15*dfFatV;                   // unfactored range: HL-93 truck shear at support, IM 1.15, 1-lane SHEAR DF
  ```
- **Check case:** defaults (S = 9 ft, L = 120 ft): m1 = 0.468, v1 = 0.36 + 9/25 = 0.720. DF before 0.468/1.2 = 0.390 → after 0.720/1.2 = **0.600**. Web special fatigue: Vll 27.37 → 42.14 kip, Vf = 103.68 + 1.75·42.14 = 177.42 kip, D/C 0.274 → 0.321. Studs: VfatU = 66.40·1.15·DF = 29.77 → 45.82 kip.
- **Note:** the LLDF `fatM` override still applies to the moment (flange) fatigue only. LLDF also publishes `fatV`, which this app does not read (OPEN O5). For an exterior girder the interior v1 is used (OPEN O5).
- **How verified:** node run old/new.
- **Other copies of this code:** none known.

### F10. rt uses Dc; Fyr = min(0.7Fyc, Fyw) ≥ 0.5Fyc   [calc change] [rt: LESS conservative — corrects a conservative error; Fyr: more conservative for hybrids]
- **Where:** function `flangeFnc` (≈ line 1836) and its three callers in the `computeAll` segment loop (≈2014–2016). Anchor: `function flangeFnc(bfc,tfc,tw,D,Lb_in,Fyc,Es,Rb,Rh,Cb,Dc,Fyw){`
- **Problem:** Eq. 6.10.8.2.3-9 uses Dc (web depth in compression), the code used D (understating rt, Lp, Lr). Fyr ignored Fyw.
- **Governing provision:** AASHTO LRFD 10th Ed. 6.10.8.2.3 (Eq. 6.10.8.2.3-9) and 6.10.8.2.2 (Fyr).
- **Before:**
  ```js
  function flangeFnc(bfc,tfc,tw,D,Lb_in,Fyc,Es,Rb,Rh,Cb){
    Cb=Cb||1.0; const FyrV=Math.max(0.5*Fyc,Math.min(0.7*Fyc,Fyc));
  ...
    const rt=bfc/sqrt(12*(1+(D*tw)/(3*bfc*tfc)));       // 6.10.8.2.3-9
  ...
        const FncTop_=flangeFnc(dims.bft,dims.tft,dims.tw,dims.D,Lb_in,Fyc,Es,1.0,Rh_,1.0);   // constructibility (bare)
        const FncNeg_=flangeFnc(dims.bfb,dims.tfb,dims.tw,dims.D,Lb_in,Fyc,Es,RbNeg_,Rh_,1.0);// −M: bottom flange comp.
        const FncBotBare_=flangeFnc(dims.bfb,dims.tfb,dims.tw,dims.D,Lb_in,Fyc,Es,1.0,Rh_,1.0);// −M during constr. (bare)
  ```
- **After:**
  ```js
  function flangeFnc(bfc,tfc,tw,D,Lb_in,Fyc,Es,Rb,Rh,Cb,Dc,Fyw){
    Cb=Cb||1.0; const DcV=(Dc!==undefined&&isFinite(Dc))?Dc:D, FywV=(Fyw!==undefined&&isFinite(Fyw))?Fyw:Fyc;
    const FyrV=Math.max(0.5*Fyc,Math.min(0.7*Fyc,FywV));
  ...
    const rt=bfc/sqrt(12*(1+(DcV*tw)/(3*bfc*tfc)));     // 6.10.8.2.3-9 (Dc)
  ...
    return {Fnc:Math.min(FncFLB,FncLTB),FncFLB,FncLTB,lf,lpf,lrf,rt,Lp:Lp/12,Lr:Lr/12,Fyr:FyrV,Dc:DcV};
  ...
        const FncTop_=flangeFnc(dims.bft,dims.tft,dims.tw,dims.D,Lb_in,Fyc,Es,1.0,Rh_,1.0,bare_.Dc,Fyw);   // constructibility (bare)
        const FncNeg_=flangeFnc(dims.bfb,dims.tfb,dims.tw,dims.D,Lb_in,Fyc,Es,RbNeg_,Rh_,1.0,cr_.DcNeg,Fyw);// −M: bottom flange comp.
        const FncBotBare_=flangeFnc(dims.bfb,dims.tfb,dims.tw,dims.D,Lb_in,Fyc,Es,1.0,Rh_,1.0,clamp(bare_.ybar-dims.tfb,0,dims.D),Fyw);// −M during constr. (bare)
  ```
  Dc per caller: bare section (constructibility, top flange); cracked steel+rebar section (−M, per D6.3.1); bare section with the bottom flange in compression (−M during erection).
- **Check case:** defaults, constructibility top flange 16×0.75, tw = 0.5, D = 66, Dc(bare) = 38.28 in, Lb = 20 ft.
  - rt before = 16/√(12(1 + 66·0.5/36)) = 3.336 in → after 16/√(12(1 + 38.28·0.5/36)) = **3.732 in**; Lp 6.70 → 7.49 ft, Lr 25.14 → 28.13 ft; Fnc(LTB) 39.18 → **40.91 ksi**; constructibility D/C 0.654 → 0.640.
  - Hybrid Fyf = 70, Fyw = 36: Fyr before 0.7·70 = 49 → after min(49, 36) = **36 ksi** (≥ 35); constructibility Fnc 49.95 → **44.97 ksi**.
- **How verified:** node run old/new.
- **Other copies of this code:** none known.

### F11. Optimize tab no longer crashes when a swept size fails   [bug fix] [no result change]
- **Where:** `OptimizeTab` (≈ line 4272). Anchor: `if(!Rr.ok||!Array.isArray(Rr.checks)) return`
- **Problem:** `Rr.checks.find` ran before `Rr.ok` was tested; a failed `computeAll` (`{ok:false}`, no `checks`) threw a TypeError and blanked the tab.
- **Before:**
  ```js
      const Rr=computeAll(e);
      const g=k=>{const c=Rr.checks.find(x=>x.t===k); return c?c.r:0;};
  ...
          {x:vals,y:rows.map(r=>r.flex),name:'Flexure',mode:'lines+markers',line:{color:'#1C4FC4'}},
          {x:vals,y:rows.map(r=>r.shear),name:'Shear',mode:'lines+markers',line:{color:'#B3261E'}},
          {x:vals,y:rows.map(r=>r.serv),name:'Service II',mode:'lines+markers',line:{color:'#15803D'}},
  ```
- **After:**
  ```js
      const Rr=computeAll(e);
      // a swept size can make computeAll fail ({ok:false}, no checks) — show it as a gap, not a crash
      if(!Rr.ok||!Array.isArray(Rr.checks)) return {t,flex:NaN,shear:NaN,serv:NaN,pass:false,err:Rr.error||'compute failed'};
      const g=k=>{const c=Rr.checks.find(x=>x.t===k); return c?c.r:0;};
  ...
          {x:vals,y:rows.map(r=>isFinite(r.flex)?r.flex:null),name:'Flexure',mode:'lines+markers',line:{color:'#1C4FC4'}},
          {x:vals,y:rows.map(r=>isFinite(r.shear)?r.shear:null),name:'Shear',mode:'lines+markers',line:{color:'#B3261E'}},
          {x:vals,y:rows.map(r=>isFinite(r.serv)?r.serv:null),name:'Service II',mode:'lines+markers',line:{color:'#15803D'}},
  ```
- **Check case:** test copy with `computeAll` forced to return `{ok:false}` for part of the sweep, server-rendered with React 18.2.0: before → `TypeError: Cannot read properties of undefined (reading 'find')`; after → renders, failed rows show "—" and FAIL.
- **How verified:** react-dom/server render in node.
- **Other copies of this code:** none known.

### F12. Stiffener width, end-panel spacing and bearing-stiffener width added to `checks`   [bug fix] [more conservative]
- **Where:** `computeAll` "push remaining checks" (≈ lines 2502–2509). Anchor: `n:'Transverse stiffener width b_t ≥ min'`
- **Problem:** `tStiff.widthOK`, `shearR.endSpcOK` and `bearing.widthOK` were computed and shown on their tabs but never pushed to `checks`, so a violation never showed FAIL in the summary/report.
- **Governing provision:** AASHTO LRFD 10th Ed. 6.10.11.1.2 (2.0 + D/30 ≤ bt, bf/4 ≤ bt ≤ 16tp), 6.10.9.3.3 (end panel do ≤ 1.5D), 6.10.11.2.2 (bt ≤ 0.48tp√(E/Fys)). Limits unchanged; only reporting added.
- **Before:**
  ```js
      if(tStiff){ checks.push({n:'Transverse stiffener It', t:'Trns stiff', v:tStiff.ItReq, lim:tStiff.ItProv, r:tStiff.ItReq/tStiff.ItProv, u:'in⁴', ref:'6.10.11.1', loc:0}); }
      checks.push({n:'Bearing stiffener', ...});
  ```
- **After:**
  ```js
      if(tStiff){ checks.push({n:'Transverse stiffener It', t:'Trns stiff', v:tStiff.ItReq, lim:tStiff.ItProv, r:tStiff.ItReq/tStiff.ItProv, u:'in⁴', ref:'6.10.11.1', loc:0});
        // 6.10.11.1.2 projecting width: lower bound max(2+D/30, bf/4), upper bound 16tp
        checks.push({n:'Transverse stiffener width b_t ≥ min', t:'Stiff bt min', v:tStiff.btMin, lim:tStiff.bt, r:tStiff.btMin/Math.max(tStiff.bt,1e-6), u:'in', ref:'6.10.11.1.2', loc:0});
        checks.push({n:'Transverse stiffener width b_t ≤ 16t_p', t:'Stiff bt max', v:tStiff.bt, lim:tStiff.btMax, r:tStiff.bt/Math.max(tStiff.btMax,1e-6), u:'in', ref:'6.10.11.1.2', loc:0}); }
      // 6.10.9.3.3 end-panel stiffener spacing d_o ≤ 1.5D (only when the web is treated as stiffened)
      if(stiffened) checks.push({n:'End-panel stiffener spacing d_o ≤ 1.5D', t:'End panel', v:doRaw, lim:doEndMax, r:doRaw/doEndMax, u:'in', ref:'6.10.9.3.3', loc:0});
      checks.push({n:'Bearing stiffener', ...});
      checks.push({n:'Bearing stiffener width b_b ≤ 0.48t_b√(E/F_ys)', t:'Brg bb', v:bb, lim:bbMax, r:bb/Math.max(bbMax,1e-6), u:'in', ref:'6.10.11.2.2', loc:0});
  ```
- **Check case:** defaults (D = 66, bt = 6, tp = 0.5, do = 60, bearing 7×0.75): bt,min = max(2 + 66/30, 16/4) = 4.20 → 0.70 OK; 16tp = 8.0 → 0.75 OK; 1.5D = 99 in → 60/99 = 0.606 OK; 0.48·0.75·√(29000/50) = 8.67 in → 7/8.67 = 0.807 OK. (Before: rows absent.)
- **How verified:** node run.
- **Other copies of this code:** none known.

### F13. `shored` checkbox disabled with a note   [bug fix / display] [no result change]
- **Where:** `InputsTab`, Span & Framing card (≈ line 3177). Anchor: `checked={!!geom.shored} disabled`
- **Problem:** `geom.shored` was never read by `computeAll`; ticking it changed nothing while the label said "deck DL on composite section".
- **Decision:** disabled (not wired). Wiring would move DC1 onto the composite section and change the stresses, deflections, constructibility, My (F4) and the MIDAS DC1 handling — too wide a change to make safely here. The saved field `geom.shored` is kept as-is (no data-format change); if a saved project has it ticked, a warning says the results are for unshored construction.
- **Before:**
  ```js
            <input type="checkbox" checked={geom.shored} onChange={e=>S('geom.shored',e.target.checked)}/>
            Shored construction (deck DL on composite section)</label></div>
  ```
- **After:**
  ```js
            <input type="checkbox" checked={!!geom.shored} disabled
              title="Not implemented — the analysis always places DC1 on the bare steel (unshored)."/>
            Shored construction (deck DL on composite section) — <i>not implemented: DC1 is always applied to the bare steel section (unshored construction)</i></label>
          {geom.shored&&<div className="hint" style={{color:'var(--warn)'}}>This project was saved with “shored” ticked. That option never affected the analysis; results are for unshored construction (conservative for flange stresses).</div>}</div>
  ```
- **Check case:** n/a (no calculation reads the field). Render test with `shored:true` OK.
- **Other copies of this code:** none known.

## Open items (not changed)
- O1. Flange lateral bending fℓ is ignored everywhere (constructibility 6.10.3.2, Service II ff + fℓ/2, Strength 6.10.7.1.1/6.10.8.1.1). Acceptable only for straight, unskewed girders without large overhang brackets — needs a design decision: add fℓ inputs (per region) or a UI warning tied to skew/overhang.
- O2. No Service II load rating (MBE 6A.6.4.2.2, γLL 1.30/1.00 against 0.95RhFyf). The capacity export sends Sx and fServLim for the MCT to rate it; decide whether ST-Girder should rate it itself.
- O3. Rating φc·φs hard-coded to 1.0 (MBE 6A.4.2.3/4: φc and φs, with φcφs ≥ 0.85). Needs two inputs with defaults 1.0; also the flexure RF mixes `sgPos` (governing D/C segment) capacity with `stPos` (max-Mu station) demands, and noncompact `capM` converts stresses to moment with short-term moduli for all stages.
- O4. Exterior girder: effective width (4.6.2.6.1, S/2 + overhang) and deck DL tributary width still use S for an exterior girder; Mp/stresses overstated for exterior girders. Needs overhang geometry used in beff/DL.
- O5. Fatigue DFs for exterior girders: single-lane moment DF uses interior m1/1.2 (unless LLDF `fatM` is pulled), and the new shear DF uses interior v1/1.2; exterior needs lever rule ÷ 1.2. LLDF already publishes `fatV`; reading it needs a new optional `loads.fatV` field — decide if wanted.
- O6. Stud fatigue shear range uses the HL-93 design truck shear `Vtr` at the support (14-ft axle spacing), not the fatigue truck (30-ft) range per station (6.10.10.1.2 / 3.6.1.4.1). Using the fatigue truck would lower Vsr (less conservative); left as is pending confirmation.
- O7. Continuous-span stud requirement 6.10.10.4.2 (P = Pp + Pn between pier and max +M) not implemented; strength studs count only (L/2)/pitch.
- O8. Fatigue range with imported continuous demands still uses the simple-span fatigue truck `fatMomentAt` (6.6.1.2 / 3.6.1.4); negative-moment fatigue details (top flange, rebar) at piers are not checked.
- O9. Hybrid details: Rh always takes the top flange as Afn (6.10.1.10.1); Rb uses the short-term composite Dc rather than staged Dc (D6.3.1). Low impact; needs hybrid-girder test cases.
- O10. 1.3RhMy (F4): continuity is inferred from imported negative moment in the span (`useExt && hasNeg`); the B6.2 exemption is not evaluated. Confirm this trigger is acceptable.
- O11. Report tab "φMn flexure" shows 0 for noncompact sections (display); modular ratio n forced ≥ 6 and rounded while `lldfGeom` sends nRaw — not in this PR's scope.
- O12. Edition: the 10th Ed. (2024) Section 6 changes were not verified article-by-article. F6–F10 rely on provisions unchanged since the 2009 Fatigue I/II split (6.6.1.2.5, 6.10.10.2, Table 6.6.1.2.3-2 values A 690 … C 1,680 …) and on long-standing 6.10.8.2.3-9 / 6.10.7.1.2 / 6.10.7.3 text; please confirm against your 10th Ed. copy.

## 2026-10-04 — PR: claude/step1-group1 (PR link added after merge)

Feature (no result change): "← All tools" link to `tools.html` (`target="_top"`, hidden in print) and the shared project info buttons. No formula, factor, unit, storage key or saved format changed. New storage written only on "Share project info": `bridgeSuite.v1.projectMeta` and `bridgeSuite.v1.projectMeta.updatedAt` (HANDOFF.md §2/§4.1). Link and buttons sit in the existing `btnrow noprint`, so they do not print. The bridgeSuite bootstrap blocks are unchanged.

Field mapping: projectName ↔ Project (`inp.proj.name`), preparedBy ↔ By (`inp.proj.by`), date ↔ Date (`inp.proj.date`), jobNo ↔ Job No. (`inp.proj.job`). Girder (`inp.proj.girderId`) is a girder label, not a bridge ID, so it is not mapped. bridgeId, client, location, checkedBy: not in this tool. Writes go through `setInp(p=>…)` (undo history + autosave as for typing).

### S1. BridgeXfer v1 + BXProject glue (plain script before the app)   [feature (no result change)]
- **Where:** new `<script>` just before `<script type="text/babel" data-presets="env,react">` (≈ line 1456). Anchor text: `<script type="text/babel" data-presets="env,react">`
- **Problem:** none (feature). Approved step 1 of the cross-tool work: "← All tools" link and shared project info (HANDOFF.md §4.1).
- **Governing provision:** n/a (no calculation, factor, unit or code reference touched).
- **Before:**
  ```html

  <script type="text/babel" data-presets="env,react">
  ```
- **After:**
  ```html

  <script>
  /* BridgeXfer v1 verbatim from HANDOFF.md §5 (73 lines, not repeated here) */
  /* Shared project info (HANDOFF.md §4.1): glue for the "Use shared project info" and
     "Share project info" buttons. Uses BridgeXfer above. Duplicated per tool (CLAUDE.md §3).
     share(own): own = {sharedKey: value} for the fields this tool has; the rest are sent as ''.
     use(cur, apply): cur = {sharedKey: current value} for the fields this tool has. Shows what
     will be overwritten, then calls apply(upd) with only the non-empty shared values that differ. */
  (function(){
    if(window.BXProject) return;
    var KEYS=['projectName','bridgeId','jobNo','client','location','preparedBy','checkedBy','date'];
    var LABELS={projectName:'Project name',bridgeId:'Bridge ID',jobNo:'Job no.',client:'Client',location:'Location',
                preparedBy:'Prepared by',checkedBy:'Checked by',date:'Date'};
    function str(v){ return v==null?'':String(v); }
    function share(own){
      if(!window.BridgeXfer){ alert('Shared project info is not available in this browser.'); return null; }
      var f={}; KEYS.forEach(function(k){ f[k]=str(own&&own[k]); });
      var r=BridgeXfer.publish('projectMeta',{_schema:'bridge-project-meta',fields:f});
      if(r.error) alert('Could not share project info: '+r.error);
      else alert('Project info shared. Other tools can load it with "Use shared project info".');
      return r;
    }
    function use(cur, apply){
      if(!window.BridgeXfer){ alert('Shared project info is not available in this browser.'); return false; }
      var r=BridgeXfer.read('projectMeta','bridge-project-meta',1);
      if(r.error){ alert('No shared project info: '+r.error); return false; }
      var f=r.payload.fields||{}, upd={}, lines=[], n=0;
      Object.keys(cur||{}).forEach(function(k){
        var v=str(f[k]); if(!v.trim()) return;          // never blank a field from an empty shared value
        var c=str(cur[k]); if(v===c) return;
        upd[k]=v; n++;
        lines.push('  '+(LABELS[k]||k)+': "'+(c||'(blank)')+'" → "'+v+'"');
      });
      var src=BridgeXfer.describe(r.payload);
      if(!n){ alert('Shared project info ('+src+') already matches this tool. Nothing to change.'); return false; }
      if(!confirm('Use shared project info?\nFrom: '+src+'\n\nThis will overwrite:\n'+lines.join('\n'))) return false;
      apply(upd);
      return true;
    }
    window.BXProject={ KEYS:KEYS, share:share, use:use };
  })();
  </script>
  <script type="text/babel" data-presets="env,react">
  ```
- **Check case:** n/a, no computed value changes. Functional check: see How verified.
- **How verified:** `node --check` on every plain inline script and @babel/standalone transpile of the text/babel block; BridgeXfer copy compared byte-for-byte with HANDOFF.md §5; whole page loaded in jsdom (React/ReactDOM/Babel from npm, other CDN scripts blocked); Share → Use round trip between lldf, Moving Load Generator, psbeam, stgirder and index with one shared localStorage; `git diff` shows only additions apart from the one header line that received the link.
- **Other copies:** BridgeXfer v1 and the `BXProject` glue are also in index.html, lldf.html, psbeam.html, stgirder.html and Moving Load Generator.html (this PR).

### S2. Shared project info handlers   [feature (no result change)]
- **Where:** `App()`, after `uP` (≈ line 4828). Anchor text: `const uP=(k,v)=>setInp({...inp,proj:{...inp.proj,[k]:v}});`
- **Problem:** none (feature). Approved step 1 of the cross-tool work: "← All tools" link and shared project info (HANDOFF.md §4.1).
- **Governing provision:** n/a (no calculation, factor, unit or code reference touched).
- **Before:**
  ```jsx
    const uP=(k,v)=>setInp({...inp,proj:{...inp.proj,[k]:v}});

  ```
- **After:**
  ```jsx
    const uP=(k,v)=>setInp({...inp,proj:{...inp.proj,[k]:v}});
    /* Shared project info (HANDOFF.md §4.1): title block <-> shared fields. Girder ID is not a bridge ID, so it is not mapped. */
    const BX_MAP={projectName:'name',preparedBy:'by',date:'date',jobNo:'job'};
    const bxOwn=()=>{const o={};Object.keys(BX_MAP).forEach(k=>{o[k]=(inp.proj&&inp.proj[BX_MAP[k]])||'';});return o;};
    const bxShareProject=()=>{ if(window.BXProject) window.BXProject.share(bxOwn()); };
    const bxUseProject=()=>{ if(window.BXProject) window.BXProject.use(bxOwn(),upd=>{
      const pp={}; Object.keys(upd).forEach(k=>{pp[BX_MAP[k]]=upd[k];});
      setInp(p=>({...p,proj:{...p.proj,...pp}})); }); };

  ```
- **Check case:** n/a, no computed value changes. Functional check: see How verified.
- **How verified:** `node --check` on every plain inline script and @babel/standalone transpile of the text/babel block; BridgeXfer copy compared byte-for-byte with HANDOFF.md §5; whole page loaded in jsdom (React/ReactDOM/Babel from npm, other CDN scripts blocked); Share → Use round trip between lldf, Moving Load Generator, psbeam, stgirder and index with one shared localStorage; `git diff` shows only additions apart from the one header line that received the link.
- **Other copies:** BridgeXfer v1 and the `BXProject` glue are also in index.html, lldf.html, psbeam.html, stgirder.html and Moving Load Generator.html (this PR).

### S3. "← All tools" link and the two buttons   [feature (no result change)]
- **Where:** `App()` render, title-block `btnrow noprint` (≈ line 4929). Anchor text: `<BeamChip nb=`
- **Problem:** none (feature). Approved step 1 of the cross-tool work: "← All tools" link and shared project info (HANDOFF.md §4.1).
- **Governing provision:** n/a (no calculation, factor, unit or code reference touched).
- **Before:**
  ```jsx
          <div className="btnrow noprint" style={{marginTop:6,justifyContent:'flex-end',alignItems:'center'}}>
            <BeamChip nb={Math.max(2,Math.round(+(inp.geom&&inp.geom.nGirders)||0))||null} setBy="ST-Girder"/>
  ```
- **After:**
  ```jsx
          <div className="btnrow noprint" style={{marginTop:6,justifyContent:'flex-end',alignItems:'center'}}>
            <a className="bx-alltools" href="tools.html" target="_top" title="Open the list of all tools"
              style={{fontSize:10.5,fontFamily:'var(--mono)',color:'var(--ink2)',textDecoration:'none',marginRight:'auto'}}>← All tools</a>
            <button className="btn sm ghost" onClick={bxUseProject} title="Fill Project, By, Date and Job No. from the project info shared by another tool (asks first; never blanks a field)">Use shared project info</button>
            <button className="btn sm ghost" onClick={bxShareProject} title="Share this title block with the other tools">Share project info</button>
            <span style={{width:1,height:20,background:'var(--line)',margin:'0 3px'}}></span>
            <BeamChip nb={Math.max(2,Math.round(+(inp.geom&&inp.geom.nGirders)||0))||null} setBy="ST-Girder"/>
  ```
- **Check case:** n/a, no computed value changes. Functional check: see How verified.
- **How verified:** `node --check` on every plain inline script and @babel/standalone transpile of the text/babel block; BridgeXfer copy compared byte-for-byte with HANDOFF.md §5; whole page loaded in jsdom (React/ReactDOM/Babel from npm, other CDN scripts blocked); Share → Use round trip between lldf, Moving Load Generator, psbeam, stgirder and index with one shared localStorage; `git diff` shows only additions apart from the one header line that received the link.
- **Other copies:** BridgeXfer v1 and the `BXProject` glue are also in index.html, lldf.html, psbeam.html, stgirder.html and Moving Load Generator.html (this PR).

## 2026-10-04 — PR: claude/conn-reactions-subloads (PR link added after merge)

Feature: hand-off (no result change). ST-Girder sends the **unfactored** DC1, DC2 and DW end reactions of its one girder line to Bridge Substructure Loading on channel `superReactions` (HANDOFF.md §4.4). Nothing is sent automatically: only the new "Send reactions to Substructure Loading" button writes `bridgeSuite.v1.superReactions`, `bridgeSuite.v1.superReactions.updatedAt` and the per-producer copy `bridgeSuite.v1.superReactions.by.stgirder`. "Export hand-off (JSON)" writes the same payload to a file. No formula, factor, default, unit, storage key or saved format changed; the bridgeSuite bootstrap blocks and the BridgeXfer copy are unchanged (BridgeXfer v1 already in this file from step 1).

Mapping:

| Payload field | Source in this tool |
|---|---|
| `supports[].id` | `Support 1`, `Support 2` (simple span); `Support i`, `Support i+1` for imported MIDAS span i |
| `supports[].x` (ft) | 0 and L; MIDAS: span start x0 and x0 + span length |
| `girders[0].label` | shared design beam label (`BridgeBeam.get().label`) while the position follows it (`loads.posAuto`), else the Girder ID of the title block, else "Interior/Exterior girder" |
| `girders[0].position` | `inp.loads.pos` |
| `DC1` (kip) | `wDC1·L/2` + diaphragms by statics, with `wDC1` = steel self-weight (area-weighted) + deck/haunch + `loads.wDCextra` (`R.loads.wDC1`). MIDAS mode with imported DC1: `V_DC1(0)` and `−V_DC1(L)`, plus `wsw·L/2` when `selfWeightExcluded`, as in the station loop |
| `DC2` (kip) | `wBar·L/2`; MIDAS: `V_DC2(0)` and `−V_DC2(L)` from `buildExternal` (already sign-flipped) |
| `DW` (kip) | `wDW·L/2`; MIDAS: `V_DW(0)` and `−V_DW(L)` |
| `liveLoad` | simple span only: per lane `max(Vtr, Vtd) + Vln` from `hl93(L)` (no IM, no DF), Rmin 0; `null` in MIDAS mode |
| `factored` / `imIncluded` / `dfIncluded` / `perGirder` | `false` / `false` / `false` / `true` |
| `project` | shared project info if present, else `{name: inp.proj.name}` |

### R1. superReactions sender glue (plain script after the BXProject glue)   [feature: hand-off (no result change)]
- **Where:** new `<script>` right after the BXProject block, before `<script type="text/babel" …>`. Anchor text: `window.BXSuperRx={ send:send, exportJSON:exportJSON, summary:summary, stamp:stamp };`
- **Problem:** none (feature). Approved step 2 of the cross-tool work.
- **Governing provision:** n/a (no calculation, factor, unit or code reference touched).
- **Before:**
```html
  window.BXProject={ KEYS:KEYS, share:share, use:use };
})();
</script>
<script type="text/babel" data-presets="env,react">
```
- **After:** the same lines, with this block inserted after the first `</script>`:
```html
<script>
/* superReactions sender glue (HANDOFF.md §4.4): "Send reactions to Substructure Loading" and
   "Export hand-off (JSON)". Uses BridgeXfer above. Duplicated verbatim in psbeam.html and
   stgirder.html (CLAUDE.md §3). build() returns {payload} or {error}; it runs on click only.
   The payload goes to bridgeSuite.v1.superReactions, and a copy to
   bridgeSuite.v1.superReactions.by.<id>, so Substructure Loading can choose when both girder
   apps have sent. */
(function(){
  if(window.BXSuperRx) return;
  function f2(v){ return (+v).toFixed(2); }
  function summary(p){
    var L=[];
    (p.supports||[]).forEach(function(s){ (s.girders||[]).forEach(function(g){
      L.push('  '+s.id+' (x = '+f2(s.x)+' ft), '+g.label+': DC1 '+f2(g.DC1)+', DC2 '+f2(g.DC2)+', DW '+f2(g.DW)+' kip'); }); });
    if(p.liveLoad&&p.liveLoad.supports) L.push('  Live load per lane, no IM, no DF (information only): '
      +p.liveLoad.supports.map(function(s){ return s.id+' '+f2(s.Rmax)+' kip'; }).join(', '));
    return L.join('\n');
  }
  function stamp(payload, producer, file){
    var p={}; for(var k in payload) if(Object.prototype.hasOwnProperty.call(payload,k)) p[k]=payload[k];
    p.schemaVersion=p.schemaVersion||1; p.producer=p.producer||producer; p.producerFile=p.producerFile||file;
    p.producedAt=new Date().toISOString();
    if(!p.project) p.project=BridgeXfer.sharedProject()||{ name:'', bridgeId:'' };
    if(!p.notes) p.notes=[];
    return p;
  }
  function built(build){
    if(!window.BridgeXfer){ alert('The hand-off helper is not available in this browser.'); return null; }
    var b=null; try{ b=build(); }catch(e){ b={ error:e.message||String(e) }; }
    if(!b||b.error||!b.payload){ alert('Cannot build the reactions hand-off: '+((b&&b.error)||'no results')+'.'); return null; }
    return b.payload;
  }
  function send(build, producer, file, id){
    var payload=built(build); if(!payload) return null;
    var r=BridgeXfer.publish('superReactions', payload, producer, file);
    if(r.error){ alert('Could not send the reactions: '+r.error); return r; }
    try{ localStorage.setItem(BridgeXfer.NS+'superReactions.by.'+id, JSON.stringify(r.payload)); }catch(e){}
    alert('Reactions sent to Substructure Loading (unfactored, kip, one girder line):\n\n'+summary(r.payload)
      +'\n\nIn Bridge Substructure Loading, Reactions tab, click "Pull from PS-Beam / ST-Girder".');
    return r;
  }
  function exportJSON(build, producer, file){
    var payload=built(build); if(!payload) return null;
    var p=stamp(payload, producer, file), r=BridgeXfer.exportFile('superReactions', p);
    if(r.error) alert('Could not export: '+r.error);
    return p;
  }
  window.BXSuperRx={ send:send, exportJSON:exportJSON, summary:summary, stamp:stamp };
})();
</script>
```
- **Check case:** n/a, no computed value changes.
- **How verified:** `node --check` on every plain inline script and @babel/standalone 7.23.5 transpile of the `text/babel` block. jsdom end-to-end run with one shared localStorage stub (React 18.2.0 / Babel from npm, other CDN scripts empty): the real "Send reactions to Substructure Loading" and "Export hand-off (JSON)" buttons on the default project, then the real pull / import / apply code in Bridge Substructure Loading (44 checks, all pass; numbers in the PR). `computeAll(DEFAULTS)` of the old (origin/main 6761b2f) and new file serialised and compared: identical. `git diff` for this file is additions only.
- **Other copies:** this glue is duplicated verbatim in psbeam.html and stgirder.html (CLAUDE.md §3). BridgeXfer v1 is in every tool listed in the PR.

### R2. `bxSuperRxPayload(inp,R)` (module scope of the app, before `computeAll`)   [feature: hand-off (no result change)]
- **Where:** new function directly above `function computeAll(inp){` (≈ line 2146). Anchor text: `function bxSuperRxPayload(inp,R){`
- **Problem:** none (feature). Builds the payload from the load terms `computeAll()` already returns; called only by the two buttons.
- **Governing provision:** statics of the app's own simple-span load model (R = wL/2 per uniform load; point load P at a: R_left = P(L−a)/L, R_right = Pa/L). No AASHTO provision is applied or changed.
- **Before:**
```js
function computeAll(inp){
  try{
```
- **After:**
```js
/* ===== superReactions hand-off (HANDOFF.md §4.4) =====
   UNFACTORED end reactions of this one girder line, per load type, for Bridge Substructure
   Loading. Reads the load terms computeAll() already produced (R.loads = loadsCalc(), and R.ext
   for an active MIDAS import, with the same DC1 rule as the station loop). Changes no result. */
function bxSuperRxPayload(inp,R){
  if(!R||!R.ok) return {error:'the design has an input error'+(R&&R.error?' ('+R.error+')':'')};
  const L=+inp.geom.L, Ld=R.loads; if(!(L>0)) return {error:'the span length is not positive'};
  const half=w=>(+w)*L/2;                                                 // simple span: R = wL/2 at each end
  const dph=inp.loads.diaph||[];                                          // same list as diaM()/diaV() in computeAll
  const diaL=dph.reduce((s,d)=>s+(+d.P||0)*(L-(+d.a||0))/L,0), diaR=dph.reduce((s,d)=>s+(+d.P||0)*(+d.a||0)/L,0);
  // DC1 here = loadsCalc's wDC1 (steel self-weight + deck/haunch + extra DC) + diaphragm point loads
  let dc1=[half(Ld.wDC1)+diaL, half(Ld.wDC1)+diaR];
  let dc2=[half(Ld.wDC2),half(Ld.wDC2)], dw=[half(Ld.wDW),half(Ld.wDW)];
  let ids=['Support 1','Support 2'], xs=[0,L], span={index:null,length:+L.toFixed(3)}, live=null;
  const pos=inp.loads.pos==='exterior'?'exterior':'interior';
  const BB=window.BridgeBeam, db=(BB&&inp.loads.posAuto!==false)?BB.get():null;
  const label=(db&&db.label)?db.label:(String((inp.proj&&inp.proj.girderId)||'').trim()||(pos==='exterior'?'Exterior girder':'Interior girder'));
  const notes=['Single girder line: '+label+' ('+pos+') designed in ST-Girder. The values are for this one girder; Substructure Loading decides which girders they apply to.',
    'Unfactored. DC1 = steel self-weight '+Ld.wsw.toFixed(3)+' klf + deck/haunch '+Ld.wdk.toFixed(3)+' klf + other DC '+(+inp.loads.wDCextra||0).toFixed(3)+' klf'+(dph.length?' + '+dph.length+' diaphragm point load(s)':'')+', all on the non-composite girder. DC2 = barrier / SIDL. DW = wearing surface.'];
  if(R.useExt&&R.ext){
    const e=R.ext, sL=e.spanLen, sel=e.sel||{}, i=Math.max(1,+sel.idx||1), x0=+sel.x0||0;
    if(e.hasDC1) dc1=[e.V_DC1(0)+(e.swExcl?half(Ld.wsw):0), -e.V_DC1(L)+(e.swExcl?half(Ld.wsw):0)];
    dc2=[e.V_DC2(0),-e.V_DC2(L)]; dw=[e.V_DW(0),-e.V_DW(L)];             // V_ already sign-flipped to + up at the left end
    ids=['Support '+i,'Support '+(i+1)]; xs=[x0,x0+sL]; span={index:i,length:+sL.toFixed(3)};
    notes.push('MIDAS import active (span '+i+'): '+(e.hasDC1?'DC1, ':'')+'DC2 and DW are the imported shears at the two ends of this span, sign-corrected to reactions (+ up)'+(e.hasDC1&&e.swExcl?', with the steel self-weight added by ST-Girder':'')+'. At an interior pier they are this span\'s share only; add the share of the adjacent span.'+(e.hasDC1?'':' DC1 is computed by ST-Girder on the simple span (L = '+L.toFixed(2)+' ft).'));
  } else {
    notes.push('Simple span L = '+L.toFixed(2)+' ft: R = wL/2 for each uniform load; diaphragm point loads by statics.');
    const hl=R.hl;
    if(hl&&isFinite(hl.Vtr)&&isFinite(hl.Vtd)&&isFinite(hl.Vln)){
      const Rmax=Math.max(hl.Vtr,hl.Vtd)+hl.Vln;
      live={basis:'per lane, no IM, no DF',vehicle:'HL-93: max(design truck, design tandem) + lane load, simple span',
        supports:ids.map(id=>({id,Rmax:+Rmax.toFixed(3),Rmin:0}))};
      notes.push('Live load is information only: one lane on the simple span, no IM, no DF, no multiple presence.');
    }
  }
  const r3=v=>+(+v).toFixed(3);
  return {payload:{_schema:'bridge-super-reactions',schemaVersion:1,
    project:(window.BridgeXfer&&BridgeXfer.sharedProject())||{name:(inp.proj&&inp.proj.name)||'',bridgeId:''},
    units:{force:'kip',length:'ft'},factored:false,imIncluded:false,dfIncluded:false,perGirder:true,
    girderLine:{label,position:pos,beamIndex:db?db.index:null,source:R.useExt?'MIDAS import (ST-Girder)':'ST-Girder simple span'},
    span,
    supports:ids.map((id,k)=>({id,x:r3(xs[k]),girders:[{label,position:pos,DC1:r3(dc1[k]),DC2:r3(dc2[k]),DW:r3(dw[k])}]})),
    liveLoad:live,notes}};
}
function computeAll(inp){
  try{
```
- **Check case (default project):** see the PR body; DC1 = w_DC1·L/2 is hand-checked there.
- **How verified:** `node --check` on every plain inline script and @babel/standalone 7.23.5 transpile of the `text/babel` block. jsdom end-to-end run with one shared localStorage stub (React 18.2.0 / Babel from npm, other CDN scripts empty): the real "Send reactions to Substructure Loading" and "Export hand-off (JSON)" buttons on the default project, then the real pull / import / apply code in Bridge Substructure Loading (44 checks, all pass; numbers in the PR). `computeAll(DEFAULTS)` of the old (origin/main 6761b2f) and new file serialised and compared: identical. `git diff` for this file is additions only.
- **Other copies:** stgirder.html / psbeam.html carry their own version (different load terms).

### R3. Send / export handlers in `App()`   [feature: hand-off (no result change)]
- **Where:** `App()`, right after `bxUseProject`. Anchor text: `const bxSendRx=()=>`
- **Before:**
```jsx
    setInp(p=>({...p,proj:{...p.proj,...pp}})); }); };
```
- **After:**
```jsx
    setInp(p=>({...p,proj:{...p.proj,...pp}})); }); };
  /* superReactions hand-off (HANDOFF.md §4.4): send / export the unfactored end reactions of this girder line. */
  const bxSendRx=()=>{ if(window.BXSuperRx) window.BXSuperRx.send(()=>bxSuperRxPayload(inp,R),'ST-Girder','stgirder.html','stgirder'); else alert('The hand-off helper is not available in this browser.'); };
  const bxExportRx=()=>{ if(window.BXSuperRx) window.BXSuperRx.exportJSON(()=>bxSuperRxPayload(inp,R),'ST-Girder','stgirder.html'); else alert('The hand-off helper is not available in this browser.'); };
```
- **Check case:** n/a, no computed value changes.
- **How verified:** `node --check` on every plain inline script and @babel/standalone 7.23.5 transpile of the `text/babel` block. jsdom end-to-end run with one shared localStorage stub (React 18.2.0 / Babel from npm, other CDN scripts empty): the real "Send reactions to Substructure Loading" and "Export hand-off (JSON)" buttons on the default project, then the real pull / import / apply code in Bridge Substructure Loading (44 checks, all pass; numbers in the PR). `computeAll(DEFAULTS)` of the old (origin/main 6761b2f) and new file serialised and compared: identical. `git diff` for this file is additions only.

### R4. The two buttons, next to Export JSON   [feature: hand-off (no result change)]
- **Where:** `App()` render, title-block `btnrow noprint`. Anchor text: `Send reactions to Substructure Loading</button>`
- **Before:**
```jsx
          <button className="btn sm" onClick={exportJSON}>Export JSON</button>
```
- **After:**
```jsx
          <button className="btn sm ghost" onClick={bxSendRx} title="Send the unfactored DC1, DC2 and DW end reactions of this girder line (kip) to Bridge Substructure Loading">Send reactions to Substructure Loading</button>
          <button className="btn sm ghost" onClick={bxExportRx} title="Save the same reactions hand-off as a JSON file (for Import hand-off in Substructure Loading, or a calc package)">Export hand-off (JSON)</button>
          <span style={{width:1,height:20,background:'var(--line)',margin:'0 3px'}}></span>
          <button className="btn sm" onClick={exportJSON}>Export JSON</button>
```
- **Check case:** n/a, no computed value changes.
- **How verified:** `node --check` on every plain inline script and @babel/standalone 7.23.5 transpile of the `text/babel` block. jsdom end-to-end run with one shared localStorage stub (React 18.2.0 / Babel from npm, other CDN scripts empty): the real "Send reactions to Substructure Loading" and "Export hand-off (JSON)" buttons on the default project, then the real pull / import / apply code in Bridge Substructure Loading (44 checks, all pass; numbers in the PR). `computeAll(DEFAULTS)` of the old (origin/main 6761b2f) and new file serialised and compared: identical. `git diff` for this file is additions only.
- **Open items:**
  - O-R1. MIDAS mode: the reactions are the imported shears at x = 0 and x = L of the selected span, i.e. exactly what this app uses at those stations. If the MIDAS file has a single station at an interior pier, the value there can belong to the adjacent span; Substructure Loading warns on negative dead-load reactions, but the engineer should check pier values in this mode.
  - O-R2. index.html (MCT) is not a sender yet: its results hold no support reactions per load case (see fixlog/index.md).

## 2026-10-09 — PR: claude/tabs-stgirder (PR link added after merge)
### T1. Inputs page split into sub-tabs   [UI only — no calculation change]
- **Date / type:** 2026-10-09, UI only (no result change). Engineer's request (2026-10-09): "Go through all the apps and make sure they are all formatted with the input panel having tabs rather than one long scrolling input panel."
- **How it works:** this tool has no input sidebar: "Inputs" is one of the top-level result tabs, a full-width page of 7 cards next to the Live Geometry column. A sub-tab strip is added at the top of that page (below the imported-demands banner, which stays visible on every sub-tab). Every card is still rendered exactly as before, in the same order; each group of cards is wrapped in a plain `<div className="stgInPane" hidden={...}>` and the inactive ones are hidden with the `hidden` attribute. Nothing unmounts, and no state, handler or value binding changes. The page layout (two columns, full width) is unchanged.
- **Tabs (in order) and the cards in each:**

| Sub-tab | Cards |
|---|---|
| Section | Girder Section — built-up plate; Negative-Moment Region — deck reinforcement |
| Materials | Materials |
| Deck | Deck & Composite |
| Span & Framing | Span & Framing |
| Loads | Loads |
| Stiffeners / Studs / Fatigue | Stiffeners, Connectors & Fatigue |

- **New storage key:** `stgirder.inputTab.v1` (localStorage, value = tab key, e.g. `loads`). It is per browser and follows the tool's `stgirder.` prefix. It is written only when a sub-tab is clicked, and never into `stgirder.session`, the projects or the exported JSON. Reads and writes are in try/catch, with an in-memory copy so the tab survives switching to another result tab and back. Existing keys and formats are unchanged.
- **Red dot:** a sub-tab gets a red dot (title "An input on this tab needs attention") when one of its editable number fields is blank or holds an entry the browser cannot parse (e.g. a lone "-"). This tool has no other per-field validation; a section-engine error already replaces the whole page with the "Input error" callout, as before.
- **Print:** the sub-tab strip is hidden and all panes are shown, so printing the Inputs page gives the same output as before.
- **Go-to-input links:** none exist in this tool (no `scrollIntoView` / `focus()` calls on inputs), so nothing else needed to change.
- **Where / anchors (approx. lines):**
  1. CSS, after `.gfx{position:sticky;top:12px}` (~line 55). Added:
     ```css
/* Inputs page sub-tabs (UI only — see stgInTabs in InputsTab) */
.stgInTabs{position:sticky;top:0;z-index:7;display:flex;flex-wrap:wrap;gap:0;margin:0 0 14px;background:var(--sheet);border-bottom:1.5px solid var(--ink)}
.stgInTab{display:inline-flex;align-items:center;font-family:var(--sans);font-stretch:75%;font-weight:700;font-size:11.5px;letter-spacing:.6px;text-transform:uppercase;
  padding:7px 12px 6px;border:none;background:transparent;color:var(--ink2);cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-1.5px}
.stgInTab:hover{color:var(--ink)}
.stgInTab[aria-selected="true"]{color:var(--blue);border-bottom-color:var(--blue)}
.stgInTab:focus-visible{outline:2px solid var(--blue);outline-offset:-2px}
.stgInDot{display:none;width:7px;height:7px;border-radius:50%;background:var(--fail);margin-left:6px}
.stgInTab.has-err .stgInDot{display:inline-block}
.stgInPane[hidden]{display:none!important}
     ```
  2. `@media print` rule (~line 141). Before: `.tabs,.btnrow,.noprint{display:none!important}.cols{grid-template-columns:1fr}.card{break-inside:avoid}}`. After: the same, then `\n  .stgInTabs{display:none!important}.stgInPane[hidden]{display:block!important}}` before the closing brace.
  3. Immediately before `function InputsTab({inp,set,R}){` (module scope) and at the top of its body. Added (the `function InputsTab` line is unchanged):
     ```js
/* ---------- Inputs page sub-tabs (UI only) ----------
   Every input card is still rendered exactly as before; the cards of the
   inactive sub-tabs are only hidden with the `hidden` attribute, so nothing
   unmounts and no state, handler or value binding changes. The active sub-tab
   is remembered per browser in localStorage key stgirder.inputTab.v1 (never in
   the inputs object, so the session autosave and the project JSON are
   unchanged). Print shows every pane. */
const STG_IN_TABS=[
  ['section','Section'],['mat','Materials'],['deck','Deck'],
  ['span','Span & Framing'],['loads','Loads'],['details','Stiffeners / Studs / Fatigue']];
const STG_IN_KEY='stgirder.inputTab.v1';
let stgInTabCur=null;   /* in-memory copy: survives the Inputs page unmounting, even without storage */
function stgInTabGet(){ if(stgInTabCur) return stgInTabCur;
  let t=''; try{ t=window.localStorage.getItem(STG_IN_KEY)||''; }catch(e){}
  return STG_IN_TABS.some(([k])=>k===t)?t:'section'; }
function stgInTabSet(t){ stgInTabCur=t; try{ window.localStorage.setItem(STG_IN_KEY,t); }catch(e){} }
/* red dot: a number field in the pane the browser cannot parse, or one left
   blank (Num stores '' for an empty field) */
function stgInBadPanes(root){
  const bad={}; if(!root) return bad;
  root.querySelectorAll('.stgInPane').forEach(pn=>{
    const k=pn.getAttribute('data-pane');
    pn.querySelectorAll('input[type="number"]').forEach(i=>{
      if(i.disabled||i.readOnly) return;
      if((i.validity&&i.validity.badInput)||i.value==='') bad[k]=1; });
  });
  return bad;
}
function InputsTab({inp,set,R}){
  const [inTab,setInTabSt]=useState(stgInTabGet);
  const [inBad,setInBad]=useState({});
  const inRoot=useRef(null);
  const pickInTab=(t,focus)=>{ setInTabSt(t); stgInTabSet(t);
    if(focus){ const b=document.getElementById('stgInTab_'+t); if(b) b.focus(); } };
  const inTabKey=e=>{ const ks=STG_IN_TABS.map(([k])=>k), i=ks.indexOf(inTab); let j=-1;
    if(e.key==='ArrowRight'||e.key==='ArrowDown') j=(i+1)%ks.length;
    else if(e.key==='ArrowLeft'||e.key==='ArrowUp') j=(i-1+ks.length)%ks.length;
    else if(e.key==='Home') j=0;
    else if(e.key==='End') j=ks.length-1;
    if(j<0) return; e.preventDefault(); pickInTab(ks[j],true); };
  const markIn=()=>{ const b=stgInBadPanes(inRoot.current);
    setInBad(prev=>{ const a=Object.keys(prev).sort().join(), c=Object.keys(b).sort().join(); return a===c?prev:b; }); };
  React.useLayoutEffect(markIn);
  /* an unparsable entry (e.g. a lone "-") fires no React change, so also re-check
     on native input events; deferred so React's controlled-input handling runs first */
  useEffect(()=>{ const el=inRoot.current; if(!el) return; let h=0;
    const onIn=()=>{ clearTimeout(h); h=setTimeout(markIn,0); };
    el.addEventListener('input',onIn);
    return ()=>{ clearTimeout(h); el.removeEventListener('input',onIn); }; },[]);
  /* plain <div> wrappers (not a component defined here) so React never remounts the cards */
  const paneP=k=>({className:'stgInPane','data-pane':k,id:'stgInPane_'+k,role:'tabpanel',
    'aria-labelledby':'stgInTab_'+k,hidden:inTab!==k});
     ```
  4. In the `return` of `InputsTab`: `return (<div>` became `return (<div ref={inRoot}>`. After the imported-demands banner (`{extActive&&<div className="callout" ...}`, ending `</div>}`) the strip was added:
     ```jsx
    <div className="stgInTabs" role="tablist" aria-label="Input groups">{STG_IN_TABS.map(([k,l])=>
      <button key={k} type="button" role="tab" id={'stgInTab_'+k} aria-controls={'stgInPane_'+k}
        aria-selected={inTab===k?'true':'false'} tabIndex={inTab===k?0:-1}
        className={'stgInTab'+(inBad[k]?' has-err':'')} title={inBad[k]?'An input on this tab needs attention':undefined}
        onClick={()=>pickInTab(k)} onKeyDown={inTabKey}>
        <span>{l}</span><span className="stgInDot" aria-hidden="true"></span></button>)}</div>
     ```
     followed by `<div {...paneP('section')}>`. Then `</div>` + `<div {...paneP('<k>')}>` was inserted before each of the cards `Materials`, `Deck & Composite`, `Span & Framing`, `Loads`, `Stiffeners, Connectors & Fatigue` (keys `mat`, `deck`, `span`, `loads`, `details`), and one `</div>` after the last card's `</Card>`. The cards themselves were not edited.
- **Note on the input listener:** the native `input` listener runs `markIn` in a `setTimeout(...,0)`. A first draft called it synchronously, and that reset a controlled number field to its old value when it was cleared (main lets it go blank). The deferred version behaves like main, and the comparison below checks this by typing into fields.
- **Governing provision / check case:** n/a, no computed value changes. Default project before and after: status band 25/26 PASS (Studs fat 1.02), M_LL+IM = 2,503 k-ft, V_LL+IM = 112 kip, Strength I +M_u = 8,381 k-ft, V_u = 328 kip. Identical.
- **How verified:** @babel/standalone 7.23.5 transpile of the `text/babel` block plus `node --check` on all 8 inline scripts (main and branch): pass. Headless Chromium 1194 (Playwright), with React 18.2.0, React-DOM 18.2.0, Babel 7.23.5, Plotly 2.27.0 and KaTeX 0.16.9 served locally at the pinned versions. Google Fonts were blocked in both runs. origin/main and the branch were compared over 18 scenarios: default; the 4 section presets; 3 other steel grades; flange transitions on; deck design on; noncomposite; LL manual; exterior girder; typed edits (Span L, bft, haunch, ADTT); Es blank; MIDAS envelope import (2-span continuous with section.zones) on span 1 and span 2; and Export → Reset → Import round trip. In every scenario these were **identical**: the text of every result tab, the Inputs page text, the inventory and values of all inputs, the status band, the `stgirder.session` autosave, the exported JSON, the `bridgeSuite.v1.*` key set and the superReactions, capacity (Send capacity to MCT Rating) and lldfGeom (Send geometry to LL & DL) payloads (timestamps masked). The round trip was exact on both. The branch adds no console errors (both have the same NaN SVG warnings in the Es-blank case). UI checks: all 63 default inputs are in exactly one pane, with none outside; no dot in the default state; dot on blank and unparsable entries, and it clears; arrow/Home/End keys; the key survives a reload and a result-tab switch; sticky strip; the strip wraps at 400 px; print shows all 6 panes. Screenshots of every sub-tab at 1500 px and 400 px were checked.
- **Other copies of this code:** none. The bridgeSuite / BridgeXfer shared snippets were not touched.
- **Open items:** at 400 px the page scrolls sideways because of the title block (`.tb-grid`, 532 px). This happens on main too and was not changed.

## 2026-10-12 — PR: claude/sweep-stgirder (PR link added after merge)

Open-item sweep of inventory section 4 (engineer 2026-10-12: "continue making updates and fixes until it's completed … use your best judgment"). Basis: AASHTO LRFD 10th Ed. (2024) and MBE 3rd Ed. Article numbers marked "verify" were not checked against a printed copy.

How every item was verified (applies to all entries below): `node --check` of all 8 inline scripts after a @babel/standalone 7.23.5 transpile of the `text/babel` block (origin/main d6edfdd and branch); the real `computeAll()` of both files run in node over 17 input variants (scratch `stgsweep/cases.js`, `detail.js`), every changed number traced to an item; headless Chromium 1194 (Playwright) with React 18.2.0, React-DOM 18.2.0, Babel 7.23.5, Plotly 2.27.0 and KaTeX 0.16.9 served locally, main vs branch over the 18 scenarios of the earlier tab comparison (text of every result tab, Inputs page, status band, `stgirder.session`, exported JSON, superReactions / capacity / lldfGeom payloads, Export → Reset → Import round trip: exact on both), plus a UI script (screenshots of the changed Inputs, Rating, Connectors, Constructibility and Fatigue tabs, the autosave banner and 400 px; all looked at). Console errors: the same 9 NaN-SVG warnings in the "Es blank" scenario on main and branch, nothing new. Interior-girder simple-span scenarios: the capacity and superReactions payloads are byte-identical to main; every other difference is listed under the item that causes it.

Saved data (CLAUDE.md §5): no key or format changed. New optional fields, all with defaults merged in by `mergeInputs` so old sessions and exported files load unchanged: `deck.extTribAuto` (true), `loads.fatV` (0), `stiff.Fys` (50), `rate.phiC` / `rate.phiS` (1.0). The lldfGeom hand-off gets a new optional field `inputs.nRaw`, and `inputs.n` now carries the rounded n (W11).

### W1. Exterior girder: tributary width S/2 + overhang for the auto b_eff and the deck dead load (STG-O4)   [calc change] [mixed: b_eff smaller and deck DL smaller when the overhang < S/2 — capacity LESS, demand LESS; both larger when the overhang > S/2]
- **Where:** `computeAll` (anchor `const extTrib = inp.loads.pos==='exterior'`), `loadsCalc` (new 4th argument `tribOver`), `DEFAULTS.deck.extTribAuto`, Inputs → Deck card (new checkbox, overhang input when deck design is off, hint).
- **Problem:** an exterior girder used the girder spacing S for b_eff and for the deck dead load. 4.6.2.6.1 takes the tributary width: S/2 + overhang for an exterior girder. Mp, the stresses and the DC1 load of an exterior girder were wrong (overstated b_eff when the overhang < S/2).
- **Governing provision:** AASHTO LRFD 10th Ed. 4.6.2.6.1 (effective flange width = tributary width); deck DL by statics.
- **Before:**
  ```js
    // effective flange width (4.6.2.6 — tributary width; interior = S)
    const beff = deck0.beffAuto? geom.S*12 : +deck0.beff;
  ...
    const Ld=loadsCalc(inp,{n,bare},wswAvg);
  ...
  function loadsCalc(inp,part,wswOver){
  ...
    const wdk = deck.deckOn? (geom.S*(tsLoad/12)*(+deck.wc) + (sec.bft/12)*(deck.haunch/12)*(+deck.wc)) : 0;
  ```
- **After:**
  ```js
    const extTrib = inp.loads.pos==='exterior' && deck0.extTribAuto!==false;
    const tribFt = extTrib? (+geom.S)/2 + Math.max(+deck0.oh||0,0) : +geom.S;
    const beff = deck0.beffAuto? tribFt*12 : +deck0.beff;
  ...
    const Ld=loadsCalc(inp,{n,bare},wswAvg,tribFt);
  ...
  function loadsCalc(inp,part,wswOver,tribOver){
    const {geom,deck,loads,sec}=inp, L=geom.L;
    const trib=(tribOver!==undefined&&isFinite(tribOver))? tribOver : geom.S;   // deck tributary width, ft (STG-O4)
  ...
    const wdk = deck.deckOn? (trib*(tsLoad/12)*(+deck.wc) + (sec.bft/12)*(deck.haunch/12)*(+deck.wc)) : 0;
  ```
  `loadsCalc` also returns `trib`. Option: unticking "Exterior girder: tributary width = S/2 + overhang …" (`deck.extTribAuto=false`) restores the old basis. The overhang is `deck.oh` (girder CL → deck edge, the existing deck-design input; it is now also shown for an exterior girder when deck design is off). Default chosen: on (code basis).
- **Check case:** defaults, exterior girder (S = 9 ft, oh = 3.0 ft, ts = 8 in, wc = 0.150 kcf, haunch 2 in × bft 16 in). Tributary = 9/2 + 3.0 = 7.50 ft → b_eff = 90.0 in (before 108). Deck DL = 7.50·(8/12)·0.150 + (16/12)(2/12)(0.150) = 0.750 + 0.0333 = **0.7833 klf** (before 9·0.6667·0.150 + 0.0333 = 0.9333). Mp 12,440 → 12,177 k-ft, peak Mu 9,540 → 9,203 k-ft, flexure D/C 0.784 → **0.775**. With oh = 5.5 ft: b_eff 120 in, DL 1.033 klf, flexure D/C 0.784 → 0.791. With the option off: identical to main. Interior girder: identical to main.
- **Hand-offs:** for an exterior girder the superReactions DC1 and the capacity φMn⁺ / Sx change with the section (intended).

### W2. Exterior girder fatigue DFs: one-lane lever rule (not less than the rigid-section value) ÷ 1.2; optional single-lane shear DF from LL & DL (STG-O5)   [calc change] [MORE conservative for exterior girders]
- **Where:** `distFactorsSteel` (`rigid1`), `computeAll` fatigue block (anchor `const dfX=Ld.df||{}, extFat=`), `lldfResolveFor` / `lldfMineFor` / `lldfTheirsFor` / `applyLLDFTo` / `LLDF_LABELS` / `LLDF_DIG` (`fatV`), Loads card hint, pull confirmation text.
- **Problem:** the exterior girder used the interior one-lane DFs m1/1.2 and v1/1.2. LL & DL publishes `fatV`, which was not read.
- **Governing provision:** AASHTO LRFD 10th Ed. Table 4.6.2.2.2d-1 and Table 4.6.2.2.3b-1 (exterior girder, one lane: lever rule), 4.6.2.2.2d (rigid-section check, also for shear per 4.6.2.2.3b — verify), 3.6.1.4.3b (m = 1.2 removed for fatigue).
- **Before:**
  ```js
    const dfFat=(+inp.loads.fatM>0)? +inp.loads.fatM : (Ld.df? Ld.df.m1:Ld.dfm)/1.2;
    const fatDfSource=(+inp.loads.fatM>0)?'LL & DL Distribution (single-lane)':'auto: (1-lane moment DF)÷1.2';
  ...
    const dfFatV=(Ld.df? Ld.df.v1:Ld.dfv)/1.2;
    const fatDfVSource='auto: (1-lane shear DF v₁)÷1.2';
  ```
- **After:**
  ```js
    const dfX=Ld.df||{}, extFat=!!dfX.ext, extFat1=extFat? Math.max(dfX.lever||0, dfX.rigid1||0) : 0;
    const dfFat=(+inp.loads.fatM>0)? +inp.loads.fatM : (extFat? extFat1 : (Ld.df? Ld.df.m1:Ld.dfm))/1.2;
    const fatDfSource=(+inp.loads.fatM>0)?'LL & DL Distribution (single-lane)'
      :(extFat?'auto: exterior, max(lever rule, rigid section) for one lane ÷1.2':'auto: (1-lane moment DF)÷1.2');
  ...
    const dfFatV=(+inp.loads.fatV>0)? +inp.loads.fatV : (extFat? extFat1 : (Ld.df? Ld.df.v1:Ld.dfv))/1.2;
    const fatDfVSource=(+inp.loads.fatV>0)?'LL & DL Distribution (single-lane shear)'
      :(extFat?'auto: exterior, max(lever rule, rigid section) for one lane ÷1.2':'auto: (1-lane shear DF v₁)÷1.2');
  ```
  In `distFactorsSteel`: `let …,rigid1=0;` and `if(NL===1) rigid1=rr;` inside the rigid-section loop; `rigid1` returned. `lldfResolveFor` returns `fatV` (`gov.fatV`, 0 when absent); the mine/theirs/apply helpers carry `fatV` next to `fatM` (new optional `loads.fatV`, default 0 = auto).
- **Check case:** defaults, exterior (Nb = 5, S = 9 ft, de = 2.5 ft). Lever: wheels at 0.5 ft and −5.5 ft from the exterior web → R = 0.5(9.5/9) + 0.5(3.5/9) = 0.722; × 1.2 = 0.867. Rigid, one lane: 1.2·(1/5 + 18·15.5/810) = 0.653. DF_fat = max(0.867, 0.653)/1.2 = **0.722** (before m1/1.2 = 0.390; shear before v1/1.2 = 0.600). Flange fatigue (Fatigue II, (ΔF)n = 5.437 ksi): Mrange 1,644.8 k-ft × 1.15 × 0.722 = 1,366.1 k-ft, Δf = 1,366.1·12/2,351.8 = 6.970 ksi, γΔf/(ΔF)n = 0.80·6.970/5.437 = **1.026 FAIL** (before 0.548). Web special fatigue 0.321 → 0.332. Interior girder: unchanged.

### W3. Rating: φc, φs inputs; capacity and demand at the same station; staged section moduli for noncompact flexure (STG-O3)   [calc change] [MORE conservative for noncompact sections and when φc·φs < 1; otherwise unchanged]
- **Where:** `computeAll` rating block (anchor `const phiCS=Math.max(phiC*phiS,0.85)`), `DEFAULTS.rate`, `RatingTab` (new "Rating factors φc, φs" card, table rows show the governing x; the App passes `inp`/`set`).
- **Problem:** φc·φs was fixed at 1.0. The flexure RF combined the capacity of the governing-D/C segment with the demands of the max-Mu station. For a noncompact section the capacity was converted to a moment with the short-term moduli for every load stage.
- **Governing provision:** MBE 3rd Ed. 6A.4.2.1 (Eq. 6A.4.2.1-1, φc·φs ≥ 0.85), Table 6A.4.2.3-1 (φc), Table 6A.4.2.4-1 (φs), Table 6A.4.2.2-1 (γ); LRFD 10th Ed. 6.10.1.1.1 (staged sections), 6.10.7.2.
- **Before:**
  ```js
    const capM=sgPos.compact? phif*MnGov
      : phif*Math.min(sgPos.FncPos*sgPos.cN.StSteel, sgPos.Fnt*sgPos.cN.Sb)/12;   // stress→moment approx
    const MDC=stPos.M1+stPos.M2, MDWr=stPos.Mw, MLLr=stPos.Ml;
    const VDC=Math.abs(stVGov.V1+stVGov.V2), VDWr=Math.abs(stVGov.Vw), VLLr=Math.abs(stVGov.Vl);
    const rating={
      flexInv:rf(capM,MDC,MDWr,MLLr,1.75), flexOpr:rf(capM,MDC,MDWr,MLLr,1.35),
      shearInv:rf(Vcr,VDC,VDWr,VLLr,1.75), shearOpr:rf(Vcr,VDC,VDWr,VLLr,1.35),
      capM,capV:Vcr,MDC,MDWr,MLLr,VDC,VDWr,VLLr};
  ...
      rating.negInv=fLL1>1e-6? (phif*sgN.FncNeg.Fnc-Math.abs(Math.min(fPerm,0)))/(1.75*fLL1):99;
      rating.negOpr=fLL1>1e-6? (phif*sgN.FncNeg.Fnc-Math.abs(Math.min(fPerm,0)))/(1.35*fLL1):99;
  ```
- **After:**
  ```js
    const rq=inp.rate||{};
    const phiC=(+rq.phiC>0)? +rq.phiC : 1.0, phiS=(+rq.phiS>0)? +rq.phiS : 1.0;
    const phiCS=Math.max(phiC*phiS,0.85), phiCSfloor=phiC*phiS<0.85;
    const rfStress=(F,fd,fl,g)=>fl>1e-6? (phiCS*phif*F-fd)/(g*fl) : 99;
    let flexRow=null;
    stations.forEach(st=>{ if(!(st.Ml>1e-6)||!(st.Mu>0)) return; const sg=segP[st.si];   // positive-flexure stations
      let inv,opr,cap=null,basis;
      if(sg.compact){
        const fc=flexCalc.find(f=>f.x===st.x), MnSt=(fc&&fc.pos&&fc.pos.Mn!=null)? fc.pos.Mn : sg.Mn_kft;
        cap=phiCS*phif*MnSt; basis='Mp';
        inv=rf(cap,st.M1+st.M2,st.Mw,st.Ml,1.75); opr=rf(cap,st.M1+st.M2,st.Mw,st.Ml,1.35);
      } else {
        const fd=stageF(st,1.25,1.25,1.5,0).pos, fl=stageF(st,0,0,0,1).pos; basis='stress';
        inv=Math.min(rfStress(sg.FncPos,fd.fT,fl.fT,1.75), rfStress(sg.Fnt,fd.fB,fl.fB,1.75));
        opr=Math.min(rfStress(sg.FncPos,fd.fT,fl.fT,1.35), rfStress(sg.Fnt,fd.fB,fl.fB,1.35));
      }
      if(!flexRow||inv<flexRow.inv) flexRow={inv,opr,cap,basis,x:st.x,MDC:st.M1+st.M2,MDW:st.Mw,MLL:st.Ml};
    });
    if(!flexRow) flexRow={inv:99,opr:99,cap:null,basis:sgPos.compact?'Mp':'stress',x:stPos.x,MDC:stPos.M1+stPos.M2,MDW:stPos.Mw,MLL:stPos.Ml};
    const capM=flexRow.cap;
    const MDC=flexRow.MDC, MDWr=flexRow.MDW, MLLr=flexRow.MLL;
    let shRow=null;
    stations.forEach(st=>{ const dc=Math.abs(st.V1+st.V2), dw=Math.abs(st.Vw), ll=Math.abs(st.Vl);
      const inv=rf(phiCS*phiv*Vcr,dc,dw,ll,1.75);
      if(!shRow||inv<shRow.inv) shRow={inv,opr:rf(phiCS*phiv*Vcr,dc,dw,ll,1.35),x:st.x,VDC:dc,VDW:dw,VLL:ll}; });
    const VDC=shRow.VDC, VDWr=shRow.VDW, VLLr=shRow.VLL;
    const rating={
      flexInv:flexRow.inv, flexOpr:flexRow.opr, flexX:flexRow.x, flexBasis:flexRow.basis,
      shearInv:shRow.inv, shearOpr:shRow.opr, shearX:shRow.x,
      capM,capV:phiCS*phiv*Vcr,MDC,MDWr,MLLr,VDC,VDWr,VLLr,phiC,phiS,phiCS,phiCSfloor};
  ...
      rating.negInv=fLL1>1e-6? (phiCS*phif*sgN.FncNeg.Fnc-Math.abs(Math.min(fPerm,0)))/(1.75*fLL1):99;
      rating.negOpr=fLL1>1e-6? (phiCS*phif*sgN.FncNeg.Fnc-Math.abs(Math.min(fPerm,0)))/(1.35*fLL1):99;
      rating.negX=stN.x;
  ```
  φc, φs apply to the strength rating only (not Service II, W4) and not to the capacity hand-off to the MCT (`chartFlex` unchanged). Shear keeps the end-panel C·Vp capacity.
- **Check cases:**
  - Defaults (compact, uniform section): governing station x = 60 ft for flexure and x = 120 ft for shear, as before. RF_inv flexure = (12,163.5 − 1.25·2,660.4 − 1.5·450)/(1.75·2,503.1) = **1.864** (unchanged); shear 2.153 (unchanged).
  - φc = 0.95, φs = 0.85: product 0.8075 < 0.85 → 0.85 used. Flexure (0.85·12,163.5 − 3,325.5 − 675)/4,380.4 = **1.447** (before 1.864); shear (0.85·552.65 − 110.85 − 22.5)/194.76 = **1.727** (before 2.153).
  - Noncompact (D = 84, tw = 0.5625, top 12×0.625, bottom 24×2.5, ts = 7 in, b_eff = 60 in), x = 60 ft: M_DC1 = 2,192.3, M_DC2 = 540, M_DW = 450, M_LL = 2,899.1 k-ft; S_bare top/bot = 1,733.0 / 4,392.0, S_3n 3,570.5 / 5,384.0, S_n 7,424.4 / 6,054.5 in³; F_nc = F_nt = 50 ksi. Top: f_D = 1.25·2,192.3·12/1,733.0 + (1.25·540 + 1.5·450)·12/3,570.5 = 18.98 + 4.54 = 23.51 ksi, f_LL = 2,899.1·12/7,424.4 = 4.686 ksi → RF = (50 − 23.51)/(1.75·4.686) = **3.230**. Bottom: f_D = 7.49 + 3.01 = 10.50, f_LL = 5.746 → 3.928. Before: C = min(50·7,424.4, 50·6,054.5)/12 = 25,227 k-ft → (25,227 − 3,415.4 − 675)/(1.75·2,899.1) = 4.166. Governing Inventory RF 3.552 (shear) → **3.230**.

### W4. Service II load rating (STG-O2)   [calc change: new rating row] [MORE conservative — governs the default design]
- **Where:** `computeAll` rating block (anchor `// Service II rating (MBE 6A.6.4.2.2, STG-O2)`), `RatingTab` row "Service II flange".
- **Problem:** no Service II rating; the governing RF ignored it.
- **Governing provision:** MBE 3rd Ed. 6A.6.4.2.2 and Table 6A.4.2.2-1 (steel Service II: γLL = 1.30 Inventory, 1.00 Operating); LRFD 10th Ed. 6.10.4.2.2 (f_R = 0.95RhFyf composite; the app's 0.80RhFyf for a noncomposite section is kept, as in the design check).
- **Before:**
  ```js
    rating.govInv=Math.min(rating.flexInv,rating.shearInv,rating.negInv??99);
    rating.govOpr=Math.min(rating.flexOpr,rating.shearOpr,rating.negOpr??99);
  ```
- **After:**
  ```js
    let s2Row=null;
    stations.forEach(st=>{ const sg=segP[st.si], fR=s2Coef*sg.Rh*Fyf, s=stageF(st,1,1,1,1);
      const fD={fB:s.parts.dc.fB+s.parts.d2.fB+s.parts.dw.fB, fT:s.parts.dc.fT+s.parts.d2.fT+s.parts.dw.fT};
      [['bot +LL',fD.fB,s.parts.lp.fB],['top +LL',fD.fT,s.parts.lp.fT],['bot −LL',fD.fB,s.parts.ln.fB],['top −LL',fD.fT,s.parts.ln.fT]].forEach(([tag,fd,fl])=>{
        if(!(Math.abs(fl)>1e-6)) return; const sgn=Math.sign(fl), base=(fR-sgn*fd)/Math.abs(fl);
        if(!s2Row||base/1.30<s2Row.inv) s2Row={inv:base/1.30,opr:base/1.00,x:st.x,tag,fR,fD:sgn*fd,fLL:Math.abs(fl)}; }); });
    if(s2Row){ rating.servInv=s2Row.inv; rating.servOpr=s2Row.opr; rating.serv=s2Row; }
    rating.govInv=Math.min(rating.flexInv,rating.shearInv,rating.negInv??99,rating.servInv??99);
    rating.govOpr=Math.min(rating.flexOpr,rating.shearOpr,rating.negOpr??99,rating.servOpr??99);
  ```
- **Check case:** defaults, x = 60 ft, bottom flange, +LL: f_R = 0.95·1.0·50 = 47.5 ksi; f_D (DC1 bare + DC2/DW 3n, unfactored) = 20.49 ksi; f_LL (n section, incl. IM and DF) = 12.64 ksi. RF_inv = (47.5 − 20.49)/(1.30·12.64) = **1.644**; RF_opr = 27.01/12.64 = **2.137**. Governing RF: Inventory 1.864 → **1.644**, Operating 2.416 → **2.137** (Service II governs). Consistency with the design check: (20.49 + 1.30·12.64)/47.5 = 0.777 = Service II D/C on the status band.

### W5. Continuous-span stud strength requirement P = Pp + Pn (STG-O7)   [calc change: new check basis in continuous spans] [MORE conservative]
- **Where:** `computeAll` connectors (anchor `let contStud=null;`), check row "Shear studs — strength", `ConnTab` (tile, step 3 and table).
- **Problem:** with imported continuous demands the strength studs were still counted for P = Pp over L/2.
- **Governing provision:** AASHTO LRFD 10th Ed. 6.10.10.4.2 (P = √(P_T² + F_T²), P_T = P_p + P_n, F_T = 0 for a straight girder; P_n = min(F_yw·D·t_w + F_yt·b_ft·t_ft + F_yc·b_fc·t_fc, 0.45f′c·b_s·t_s) — verify equation numbers), 6.10.10.4.1 (studs between the max +M point and the adjacent support).
- **Before:**
  ```js
    checks.push({n:'Shear studs — strength', t:'Studs str', v:nReq, lim:nProv, r:nReq/Math.max(nProv,1), u:'#', ref:'6.10.10.4', loc:0});
  ```
- **After:** (block above the `const conn=` line, see anchor)
  ```js
    let contStud=null;
    if(contSpan && deck.deckOn){
      const stEnds=[stations[0],stations[stations.length-1]], xP=stPos.x, dimsP=segP[stPos.si].dims;
      const PpS=Fyw*D*tw+Fyf*(dimsP.bft*dimsP.tft+dimsP.bfb*dimsP.tfb), Pp=Math.min(Pslab,PpS);
      const sides=stEnds.map((se,k)=>{ const dS=segP[se.si].dims, pier=se.Mun<-1;
        const PnS=Fyw*D*tw+Fyf*(dS.bft*dS.tft+dS.bfb*dS.tfb), PnC=0.45*deck.fc*beff*deck.ts, Pn=pier?Math.min(PnS,PnC):0;
        const len=k===0? xP : Lft-xP, P=Pp+Pn, req=P/Qr, prov=nRow*Math.floor((len*12)/Math.max(pitch,1));
        return {end:k===0?'left':'right', pier, len, Pp, PnS, PnC, Pn, P, nReq:req, nProv:prov, r:req/Math.max(prov,1)}; });
      const gov=sides[0].r>=sides[1].r? sides[0] : sides[1];
      contStud={xP, Pp, PpS, Pslab, sides, gov};
    }
  ...
    if(contStud) conn.strOK=contStud.gov.nProv>=contStud.gov.nReq;
  ...
    if(contStud) checks.push({n:'Shear studs — strength (continuous, P = Pp + Pn, '+contStud.gov.end+' side)', t:'Studs str', v:contStud.gov.nReq, lim:contStud.gov.nProv, r:contStud.gov.r, u:'#', ref:'6.10.10.4.2', loc:contStud.gov.end==='left'?0:Lft});
    else checks.push({n:'Shear studs — strength', t:'Studs str', v:nReq, lim:nProv, r:nReq/Math.max(nProv,1), u:'#', ref:'6.10.10.4', loc:0});
  ```
  Continuous = `contSpan` (imported demands with factored −M, the F4 trigger). An end is an interior support when the factored −M there is < −1 k-ft. Simple spans: unchanged.
- **Check case:** test 2 × 120 ft continuous MIDAS file (scratch `stg/midas.json`), span 1, interior girder, defaults: max +M at x = 54 ft; Q_r = 30.67 kip; P_p = min(0.85·4·108·8 = 2,937.6, 50·66·0.5 + 50·(16·0.75 + 18·1.25) = 3,375) = 2,937.6 kip. Right end (pier): P_n = min(3,375, 0.45·4·108·8 = 1,555.2) = 1,555.2 kip; P = 4,492.8 kip; n_req = 146.5; n_prov = 3·⌊66·12/12⌋ = 198 → **0.740**. Left end (abutment): n_req 95.8, n_prov 162 → 0.591. Before: 95.8 / 180 = **0.532**.

### W6. Stud fatigue shear range: fatigue truck, range per station (STG-O6)   [calc change] [LESS conservative at the defaults — §4 sign-off needed]
- **Where:** new function `fatShearRangeAt(L,x)` (before the LOADS banner), `computeAll` connectors (anchor `let fatStud=null;`), check row loc, `ConnTab` variables / equation / note.
- **Problem:** the stud shear range used the HL-93 design-truck shear at the support (14-ft rear spacing) with the midspan section. 6.10.10.1.2 uses the shear range from the fatigue load (fatigue truck, 30-ft rear spacing), at each section.
- **Governing provision:** AASHTO LRFD 10th Ed. 6.10.10.1.2 (V_sr = V_f·Q/I, V_f = shear range under the fatigue load combination), 3.6.1.4.1 (fatigue truck), 3.6.2.1 (IM 15%), 6.10.10.2 (Z_r).
- **Before:**
  ```js
    const yDeckNA=(bare.hs+deck.haunch+deck.ts/2)-cN.ybar, Qslab=(beff*deck.ts/n)*yDeckNA;
    const VfatU=Ld.hl.Vtr*1.15*dfFatV;                   // unfactored range: HL-93 truck shear at support, IM 1.15, 1-lane SHEAR DF
    const Vfat=gammaFat*VfatU;                           // factored per the governing fatigue combination
    const Vsr=Vfat*Qslab/cN.I, pReq=nRow*Zr/Math.max(Vsr,1e-6);
  ```
- **After:**
  ```js
    let fatStud=null;
    stations.forEach(st=>{ const sg=segP[st.si], cc=sg.cN;
      const yNA=(sg.bare.hs+deck.haunch+deck.ts/2)-cc.ybar, Q=(beff*deck.ts/n)*yNA;
      const rg=fatShearRangeAt(Lft,st.x), VfU=rg.range*1.15*dfFatV, Vf=gammaFat*VfU, vsr=Vf*Q/cc.I;
      const p_=nRow*Zr/Math.max(vsr,1e-6);
      if(!fatStud||p_<fatStud.pReq) fatStud={x:st.x,si:st.si,Vpos:rg.Vpos,Vneg:rg.Vneg,range:rg.range,VfatU:VfU,Vfat:Vf,Qslab:Q,Icomp:cc.I,Vsr:vsr,pReq:p_}; });
    const yDeckNA=(bare.hs+deck.haunch+deck.ts/2)-cN.ybar;
    const Qslab=fatStud.Qslab, VfatU=fatStud.VfatU, Vfat=fatStud.Vfat, Vsr=fatStud.Vsr, pReq=fatStud.pReq;
  ```
  `fatShearRangeAt` moves the fatigue truck (8-32-32 kip, 14 ft + 30 ft, both directions) in 1-ft steps plus the positions that put each axle exactly at / just left of x, and returns max V⁺, max V⁻ and the range.
- **Check case:** defaults (Fatigue II, γ = 0.80, Z_r = 2.043 kip, 3 studs/row, DF_V = 0.600, Q = 1,964.7 in³, I = 138,030 in⁴). Governing station x = 0: V⁺ = 32 + 32·90/120 + 8·76/120 = 61.07 kip, V⁻ = 0. V_f = 0.80·61.07·1.15·0.600 = 33.71 kip; V_sr = 33.71·1,964.7/138,030 = 0.480 kip/in; p_req = 3·2.043/0.480 = **12.77 in** → pitch 12 in: D/C **0.940 PASS**. Before: V_tr = 66.40 kip → V_sr 0.522, p_req 11.75 in, D/C **1.022 FAIL**. ADTT 2000 (Fatigue I): 1.084 → 0.997.

### W7. Stiffener yield strength F_ys input (STG-A1)   [calc change only when the input differs from 50] [default unchanged]
- **Where:** `computeAll` (anchor `const Fys=(+inp.stiff.Fys>0)?`), `DEFAULTS.stiff.Fys`, Inputs → Stiffeners card ("Stiffener Fys"), StiffTab variable table and the two equations that printed 50.
- **Before:** `const Fys=50;` / `['F_ys','Stiffener yield',50,'ksi'],` / `\sqrt{29000/50}` / `\cdot50=`
- **After:** `const Fys=(+inp.stiff.Fys>0)? +inp.stiff.Fys : 50;` (and `bearing.Fys`), `['F_ys','Stiffener yield',br.Fys,'ksi'],`, `\sqrt{${(+R.matR.Es).toFixed(0)}/${(+br.Fys).toFixed(0)}}`, `\cdot${nx(br.Fys,0)}=`.
- **Governing provision:** AASHTO LRFD 10th Ed. 6.10.11.1.3 (F_crs ≤ F_ys), 6.10.11.2.2 (b_t ≤ 0.48t_p√(E/F_ys)), 6.10.11.2.3 (R_sb = 1.4A_pn·F_ys), 6.10.11.2.4 (column).
- **Check case:** F_ys = 36 ksi, defaults: R_sb = 1.4·8.25·36 = 415.8 kip (before 577.5) → bearing D/C 328.1/415.8 = **0.789** (before 0.568); b_b,max = 0.48·0.75·√(29,000/36) = 10.22 in → 7/10.22 = **0.685** (before 0.807 with 50). F_ys = 50: identical to main.

### W8. Hybrid factor R_h: A_fn is the flange on the side of D_n (STG-O9, R_h part)   [calc change, hybrid girders only] [LESS conservative for composite +M where the bottom flange is the larger one]
- **Where:** `hybridRh` (anchor `const DnTop=el.yt-tft, DnBot=el.yb-sec.tfb;`).
- **Problem:** A_fn was always the top flange, whichever side D_n is on.
- **Governing provision:** AASHTO LRFD 10th Ed. 6.10.1.10.1 (A_fn = flange area on the side of the neutral axis corresponding to D_n).
- **Before:**
  ```js
    const Dn=Math.max(el.yt-tft, el.yb-sec.tfb);          // larger dist NA→flange (approx)
    const Afn=bft*tft;                                    // area of flange on side of larger Dn (approx top)
  ```
- **After:**
  ```js
    const DnTop=el.yt-tft, DnBot=el.yb-sec.tfb;           // NA → inside face of each flange
    const Dn=Math.max(DnTop, DnBot);                      // larger distance NA→flange
    // Afn = flange on the side of the NA corresponding to Dn (6.10.1.10.1; STG-O9 — was always the top flange)
    const Afn=(DnTop>=DnBot)? bft*tft : sec.bfb*sec.tfb;
  ```
- **Check case:** defaults with Fyf = 70, Fyw = 50, hybrid on (short-term composite NA: y_t = 9.918 in, y_b = 58.082 in): D_n = 58.082 − 1.25 = 56.83 in (bottom), A_fn = 18·1.25 = 22.5 in², β = 2·56.83·0.5/22.5 = 2.526, ρ = 50/70 = 0.714, 3ρ − ρ³ = 1.778; R_h = (12 + 2.526·1.778)/(12 + 2·2.526) = **0.967**. Before A_fn = 16·0.75 = 12: β = 4.736, R_h = **0.951**. Service II D/C 0.584 → 0.574; flexure (compact, Mp basis) unchanged. Non-hybrid: R_h = 1.0, unchanged.
- **Rb part of STG-O9 (staged Dc):** not changed. 6.10.1.10.2 (as read here — verify) sets R_b = 1.0 for a composite section in positive flexure whose web meets 6.10.2.1.1 (D/t_w ≤ 150, checked by the app), so the app's R_b from the short-term D_c is equal or conservative there; for the noncomposite case the bare-section D_c is the correct one. No unconservative case found; adopting R_b = 1.0 is listed under "Needs engineer".

### W9. Warnings: flange lateral bending f_ℓ not computed (STG-O1); fatigue with imported continuous demands (STG-O8)   [display only — no result change]
- **Where:** `computeAll` (anchor `/* ---------- warnings for effects not computed (display only) ---------- */`, returned as `R.warnings`), new component `StgWarn` (before `function StressTab`), one `<StgWarn …/>` line at the top of `StressTab`, `FlexTab`, `ConstructTab` (f_ℓ), `FatigueTab`, `ConnTab` (fatigue) and `ReportTab` (both).
- **Rules:** f_ℓ warning when skew > 20° (C6.10.1, verify) or the girder is exterior (overhang brackets 6.10.3.4 / C6.10.3.4; wind 4.6.2.7), with a note that curved girders are outside the app. Fatigue warning whenever imported MIDAS demands are active: the fatigue checks use the fatigue truck on a simple span of L, and negative-moment fatigue details at interior piers are not checked.
- **Before:** none. **After:** the callouts above; no check, factor or value changed.
- **Check case:** exterior default → 2 f_ℓ lines on Constructibility / Stresses / Flexure / Report; skew 30° → 2 lines; MIDAS span 1 → fatigue line on Fatigue / Connectors / Report; interior default → no callout.
- **Why not more:** f_ℓ inputs per region (6.10.1.6) and a fatigue envelope in the MCT export (`psbeam-external-demands` carries none) are larger, cross-tool changes — see "Remaining open items".

### W10. Report "φMn flexure" for noncompact sections (STG-O11, display part)   [display only]
- **Where:** `computeAll` `flex.phiMnRep` (anchor `phiMnRep: sgPos.compact?`), `ReportTab` key-results row.
- **Before:** `['φMn flexure',fmt(R.flex.compact?R.flex.Mn_kft:0,0),'k-ft'],` (0 for a noncompact section; the uncapped Mn for a compact one)
- **After:** `[R.flex.compact?'φMn flexure':'φMn flexure (stress-basis equivalent, φf·min(Fnc·S_t, Fnt·S_b))',fmt(R.flex.phiMnRep,0),'k-ft'],` with `phiMnRep = compact ? φf·MnGov (incl. the 1.3RhMy cap) : φf·min(Fnc·S_t,n, Fnt·S_b,n)/12`.
- **Check case:** noncompact case of W3: min(50·7,424.4, 50·6,054.5)/12 = **25,227 k-ft** (before 0). Defaults: 12,163 (unchanged). Continuous MIDAS span 1: 11,990 (the capped value of F4; before 12,163).

### W11. lldfGeom hand-off sends the n this app uses (STG-O11, modular-ratio part)   [hand-off value change; no ST-Girder result change]
- **Where:** `sendLLDF` payload (anchor `n:+(+R.n).toFixed(2), nRaw:+R.nRaw.toFixed(2)}};`).
- **Problem:** ST-Girder computes its sections and its own K_g with n rounded (≥ 6), but sent the unrounded Es/Ec to LL & DL, so the two apps' K_g differed.
- **Before:** `I:Math.round(R.bare.I), A:+R.bare.A.toFixed(1), eg:+egv.toFixed(2), n:+R.nRaw.toFixed(2)}};`
- **After:** `I:…, eg:+egv.toFixed(2),` / `n:+(+R.n).toFixed(2), nRaw:+R.nRaw.toFixed(2)}};` (new optional field `nRaw`; LL & DL reads `inputs.n` only).
- **Governing provision:** AASHTO LRFD 10th Ed. 4.6.2.2.1 (K_g = n(I + A·e_g²)); 6.10.1.1.1b (n).
- **Check case:** defaults: Ec = 120,000·0.150²·4^0.33 = 4,266 ksi, Es/Ec = 6.80 → n = 7. Payload n 6.80 → **7**, nRaw 6.80. In LL & DL, K_g for this girder rises by 7/6.80 = 2.9% and its moment DF by about 0.3% (more conservative), matching ST-Girder's own K_g.

### W12. Narrow screens: title block wraps (STG-UI1)   [UI only]
- **Where:** CSS after `@media(max-width:1080px){…}`.
- **Before:** none. **After:**
  ```css
  /* narrow screens (STG-UI1): the title block stacks and its grid wraps to two columns, so the page does not scroll sideways */
  @media(max-width:600px){.tblock{grid-template-columns:minmax(0,1fr)}.tb-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.tb-cell input{min-width:0;width:100%}}
  ```
- **Check:** document scroll width at 400 px: main 532 → branch **400**; layout above 600 px unchanged (1500 px comparison identical apart from the items above).

### W13. Autosave failures shown (STG-S8, this tool's part of X-S8)   [UI only]
- **Where:** `App()` (anchor `const [saveFail,setSaveFail]=useState('')`), the autosave effect, the "✓ auto-saved" label, and a callout above `<LockAutoSync …/>`.
- **Before:**
  ```js
    saveTimer.current=setTimeout(()=>{ saveInputs(inp);          // per-session autosave (always)
      // Contribute to the ACTIVE shared project only — never create or rename one (that's MCT's job).
      try{ if(BP()){ const cur=BP().current(); if(cur&&BP().get(cur)) BP().saveSlice(cur,undefined,ST_APP,JSON.parse(JSON.stringify(inp))); } }catch(e){}
    },400);
  ```
- **After:**
  ```js
    saveTimer.current=setTimeout(()=>{ const okS=saveInputs(inp);          // per-session autosave (always)
      // Contribute to the ACTIVE shared project only — never create or rename one (that's MCT's job).
      let okP=true;
      try{ if(BP()){ const cur=BP().current(); if(cur&&BP().get(cur)) okP=!!BP().saveSlice(cur,undefined,ST_APP,JSON.parse(JSON.stringify(inp))); } }catch(e){ okP=false; }
      // STG-S8: a failed write (browser storage full or blocked) is shown, not swallowed
      setSaveFail(!okS?'session':(!okP?'project':''));
    },400);
  ```
  The header label reads "⚠ autosave failed" (red) and a callout says what failed and to use Export JSON. It clears on the next successful save. Nothing is written or pruned; the shared bootstrap blocks are unchanged.
- **Check:** Chromium with `localStorage.setItem('stgirder.session', …)` forced to throw: banner shown; after the throw is removed and a field edited: banner gone.

### Items closed / not changed
- **STG-O10** (1.3RhMy trigger `useExt && hasNeg`; B6.2 not evaluated): kept. Applying the cap whenever the span is continuous is the conservative reading of 6.10.7.1.2; B6.2 is an optional refined method. Listed under "Needs engineer" only to confirm.
- **STG-OR1** (MIDAS reactions at an interior pier): not changed. The MCT export has one station per node, so the shear at a pier node can come from either adjacent element and ST-Girder cannot tell which. The superReactions notes already say "At an interior pier they are this span's share only; add the share of the adjacent span" and Substructure Loading warns on negative dead-load reactions.
- **STG-O12** (10th Ed. article-by-article check): needs the printed spec (see "Needs engineer").

### Needs engineer
1. **STG-O12** — Please check against your printed 10th Ed. (2024): 6.10.10.4.2 (P = Pp + Pn, P_n with 0.45f′c·b_s·t_s), Tables 4.6.2.2.2d-1 / 4.6.2.2.3b-1 and 4.6.2.2.3b (rigid-section check for exterior shear), C6.10.1 (f_ℓ may be ignored for skew ≤ 20°?), 6.10.1.10.2 (R_b = 1.0 for composite +M with D/t_w ≤ 150), and the F6–F10 provisions listed in O12 above. Recommendation: confirm; the code follows the reading stated in each entry.
2. **STG-O10** — Keep the 1.3RhMy cap for every continuous span (no B6.2 exemption)? Recommendation: keep (conservative).
3. **STG-O9 (R_b)** — Adopt R_b = 1.0 for composite sections in positive flexure with D/t_w ≤ 150 (6.10.1.10.2)? It would raise F_nc of slender-web noncompact composite sections (less conservative). Recommendation: yes, after the printed-spec check in 1.
4. **STG-OR1** — Accept the existing note for MIDAS-mode pier reactions, or should ST-Girder refuse to send reactions at interior supports? Recommendation: keep the note.
5. **W6 sign-off** — W6 makes the stud fatigue pitch check less conservative (default D/C 1.022 FAIL → 0.940 PASS). It follows 6.10.10.1.2 / 3.6.1.4.1; please sign off.

### Remaining open items (not done in this PR)
- **STG-O1 (inputs):** f_ℓ inputs per region (constructibility, Service II f_f + f_ℓ/2, Strength 6.10.7.2 / 6.10.8.1 with f_ℓ/3) — L. Recommendation: add f_ℓ fields for the top flange during the deck pour and for each region, default 0, with the warning of W9 kept when skew > 20° or the girder is exterior.
- **STG-O8 (calc):** negative-moment fatigue at piers needs a fatigue-truck envelope from the continuous analysis. The `psbeam-external-demands` schema exported by index.html has no fatigue fields, so this is a cross-tool change (index.html sender + this receiver; allowed in one PR as a HANDOFF.md connection). Recommendation: add optional `M_FATpos / M_FATneg / V_FATpos / V_FATneg` station fields and use them here when present.
- **STG-S8 (rest of X-S8):** pruning of `bridgeSuite.v1.handoffs` lives in the shared bootstrap block (index/lldf/psbeam/stgirder) and was not touched here, as instructed.
- **New, found during this sweep:** (a) the fatigue DFs (m1/1.2, v1/1.2, and the exterior lever/rigid values of W2) carry no skew correction (4.6.2.2.2e / 4.6.2.2.3c); the shear skew factor is > 1, so omitting it is slightly unconservative for skewed bridges. Recommendation: apply skV to the fatigue shear DF and skM to the fatigue moment DF. (b) `hybridRh` uses the short-term composite section for the −M checks too; 6.10.1.10.1 uses the steel + reinforcement section in negative flexure. Hybrid girders only, small. Recommendation: pass the cracked section for `FncNeg` / negative-moment Rh.

## 2026-10-12 — PR: claude/bootstrap-sync (shared `bridgeSuite.v1.*` bootstrap; PR link added after merge)

Cross-tool sync of the shared bootstrap blocks. The same change is in index.html, lldf.html, psbeam.html and stgirder.html (CLAUDE.md §3). No engineering formula, factor, unit or code reference changed; no computed value changes. Storage keys and saved formats are unchanged (the hand-off map keeps its key and entry format; it only loses old entries).

This closes **STG-S8 (rest of X-S8)** listed in the 2026-10-12 sweep entry above, and AUDIT S3 (see XS4).

### XS1. `whois` responder answers only the framing page, the opener, or an own frame (X-S10)   [robustness] [no result change]
- **Where:** `BridgeApps.announce()` in the "SHARED APP PATHS" block. Anchor: `d.source==='bridge-suite'&&d.whois`.
- **Before:**
  ```js
    try{ window.addEventListener('message',function(e){
      var d=e&&e.data; if(d&&d.source==='bridge-suite'&&d.whois) send();
    }); }catch(e){}
  ```
- **After:**
  ```js
    // Only the page framing this one, the window that opened it, or a frame
    // this window holds may ask (X-S10; same rule as the abutment / EDM links).
    var asker=function(src){
      if(!src) return false;
      try{
        if(window.parent!==window&&src===window.parent) return true;
        if(window.opener&&src===window.opener) return true;
        for(var i=0;i<window.frames.length;i++) if(window.frames[i]===src) return true;
      }catch(x){}
      return false;
    };
    try{ window.addEventListener('message',function(e){
      var d=e&&e.data; if(d&&d.source==='bridge-suite'&&d.whois&&asker(e.source)) send();
    }); }catch(e){}
  ```
- **Problem:** any window (e.g. a sibling frame) could make the app post its hello. Low risk; the reply only names the app. Same approach as abutment F10 / EDM S4.
- **Check:** host page framing lldf.html plus a sibling frame. Sibling sends `{source:'bridge-suite',whois:true}` to the lldf frame: main 1 hello reaches the host, branch 0. Host (parent) sends the same ping: 1 hello on both. The boot burst is unchanged.

### XS2. Hand-off map pruned on publish (X-S8)   [storage] [no result change]
- **Where:** `BridgeHandoff` block (index.html, psbeam.html, stgirder.html; lldf.html has no copy of this block). Anchors: `function prune(map,keep)`, `map=prune(map,[p.handoffId,localStorage.getItem(K_LATEST)]);`.
- **Before:** `publish()` added the entry to `bridgeSuite.v1.handoffs` and never removed any.
- **After:** new constants `var KEEP_N=20, KEEP_DAYS=30;` and
  ```js
  function prune(map,keep){
    var ids=Object.keys(map), cutoff=Date.now()-KEEP_DAYS*864e5, out={};
    ids.sort(function(a,b){ return String((map[b]||{}).producedAt||'').localeCompare(String((map[a]||{}).producedAt||'')); });
    ids.forEach(function(id,i){
      var t=Date.parse((map[id]||{}).producedAt||''), fresh=isNaN(t)||t>=cutoff;
      if(keep.indexOf(id)>=0||(i<KEEP_N&&fresh)) out[id]=map[id];
    });
    return out;
  }
  ```
  called in `publish()` right after `map[p.handoffId]=p;`. Rule: keep the newest 20 entries that are at most 30 days old; always keep the entry being published and the entry the `latestId` pointer named before this publish (the design apps read only the latest entry, so that is the one a receiver may not have pulled yet).
- **Check:** map seeded with 25 entries (m0–m14 aged 0–14 days, m15–m24 aged 55–64 days, `latestId`=m24) plus one entry with no date; publish `p/new`. Main: 27 entries kept. Branch: 17 (m0–m14, m24, new); `latestId` = `p__new` on both.

### XS3. Storage-full writes in the shared blocks are shown (X-S8)   [UI] [no result change]
- **Where:** "SHARED APP PATHS" block: new `isQuota()` / `storageWarn(what,e)` after `function now()`, exported as `BridgeApps.storageWarn`; called from `write()` (app paths), `BridgeProjects` `writeReg()` and `BridgeHandoff` `publish()` catch blocks. Anchor: `id='bridgeStorageWarn'`.
- **Before (examples):**
  ```js
  function write(o){ try{ localStorage.setItem(KEY,JSON.stringify(o)); return true; }catch(e){ return false; } }
  function writeReg(r){ try{localStorage.setItem(K_PROJ,JSON.stringify(r));return true;}catch(e){return false;} }
  ```
- **After:**
  ```js
  function write(o){ try{ localStorage.setItem(KEY,JSON.stringify(o)); return true; }catch(e){ storageWarn('the app-path record',e); return false; } }
  function writeReg(r){ try{localStorage.setItem(K_PROJ,JSON.stringify(r));return true;}
    catch(e){ try{ if(window.BridgeApps&&window.BridgeApps.storageWarn) window.BridgeApps.storageWarn('the shared project',e); }catch(x){} return false;} }
  ```
  and in `publish()`'s catch: `window.BridgeApps.storageWarn('the analysis hand-off',e)`. `storageWarn` acts only on a quota error (`QuotaExceededError`, `NS_ERROR_DOM_QUOTA_REACHED`, code 22 / 1014, or "quota" in the message), so a browser that blocks storage outright is not nagged. It shows one fixed red banner per page (id `bridgeStorageWarn`, dismissable), one line per item: "⚠ Browser storage is full: <item> was not saved. Export your work as JSON now, then delete old projects to free space." Return values are unchanged (`false` / `null` / `{ok:false}`).
- **Check:** index.html with `setItem` for `bridgeSuite.v1.projects` / `.handoffs` throwing `QuotaExceededError`: `publish()` → `ok:false`, `saveSlice()` → `null` on both; main shows nothing, branch shows the banner with both lines (screenshot `quota_banner_br.png`).

### XS4. Shared blocks byte-identical (AUDIT S3)
- The `BridgeApps` block was already the same in all four files (stgirder F1, 2026-10-04); AUDIT S3 is closed by that entry. The `BridgeHandoff` block differed in formatting and comments between index.html and psbeam/stgirder.html; it is now the index.html text (plus XS2/XS3) in all three. The file-header comments above each block are per-file and were not touched.
- **Proof:** extracted blocks compared after the change (md5): `BridgeApps` block identical in the four files; `BridgeProjects` block identical in the four; `BridgeHandoff` block identical in index/psbeam/stgirder; `BridgeLocks` block unchanged and identical.

### How verified
- `node --check` on every plain `<script>` that holds the shared blocks, all four files.
- Headless Chromium, main vs branch, same steps: index publishes the PS demands payload → psbeam shows "New analysis data available", "Load these demands" adopts it (adopted token `test__beam@2026-10-12T10:00:00.000Z`); index publishes the steel payload → stgirder banner and adoption; lldf boots and resolves `BridgeApps.path('psbeam')`. Same results and the same storage keys on both; key values differ only in timestamps. No page errors (only Babel's "deoptimised styling" notes).
- **Other copies:** index.html, lldf.html, psbeam.html, stgirder.html (all changed in this PR; lldf.html has no `BridgeHandoff` block, so XS2 and the hand-off call of XS3 are not in it).

## 2026-10-12 — PR: claude/lldf-receivers (cross-tool: lldf DF payload `perFootStrip` / `skewShear` receivers; PR link added after merge)

Cross-tool connection PR (CLAUDE.md §7 exception): receivers of the `bridgeSuite.v1.lldf` payload honour lldf's new optional fields (fixlog/lldf.md 2026-10-12 SW3 `skewShear`, SW6 `perFootStrip`), and Bridge Geometry's skew note is softened. Tools changed: index.html, psbeam.html, stgirder.html, Moving Load Generator.html, Steel Bridge Beam Modules.html, Bridge Geometry.html; HANDOFF.md §4.2 / §4.3. The shared `bridgeSuite.v1.*` bootstrap blocks are not touched. No formula, factor, unit or code reference changed. Payloads without the new fields give the same results as before (checked).

### LR1. CIP slab DFs (`perFootStrip`) refused by the LL & DL pull and lock   [hand-off] [no result change for girder payloads]
- **Where:** `lldfResolveFor(inp)`. Anchor: `if(d.perFootStrip===true) return {why:`. Used by the Pull button and by the locked auto-sync (`LockAutoSync`), so a locked channel shows the warning state and applies nothing.
- **Before:** (no check; the slab factors went into DF +M / −M / V and the fatigue DF.)
- **After** (inserted after `if((d.schemaVersion||1)>1) return {why:'LL & DL Distribution data is v'…'Update ST-Girder.'};`):
  ```js
    // CIP slab (lldf perFootStrip): factors per 1-ft strip of slab width, not per girder. Refused (HANDOFF.md §4.3).
    if(d.perFootStrip===true) return {why:'The published distribution factors are for a cast-in-place slab: they are per 1-ft strip of slab width (AASHTO LRFD 4.6.2.3), not per girder. ST-Girder needs girder factors, so nothing was applied.\n\nRecompute in LL & DL Distribution with the girder cross-section type, then send again.'};
  ```
- **Problem:** a strip factor (≈ 0.08) used as a girder DF makes every live-load effect about 1/10 of the girder value: very unconservative.
- **Skew:** this tool does not read the payload skew; lldf's g_V already carries the shear correction at θ_V. Nothing to change.
- **Check case:** lldf type "Cast-in-place concrete slab", 1 span 120 ft, default inputs → payload `perFootStrip:true`, interior gM = gV = 0.076 (per 1-ft strip), fatM = fatV = 0.045. Before: g_M = g_V = 0.076 (fatigue 0.045) applied. After: refused with the message above; nothing applied. Girder payload (type a, θ = 30°, θ_V = 40°: gM 0.7128, gV 1.0582, fatM 0.4019, fatV 0.7075): identical before and after.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 4.6.2.3 (equivalent strip widths for slab-type bridges: the slab DF is per unit width, not per girder). No formula changed.
- **How verified:** headless Chromium, main vs branch: lldf "Send DFs" for the slab and the girder case, then the resolver called on this tool (`lldfResolveFor({loads:{pos:'interior'}})`). Slab: main applied, branch refused. Girder: identical results (only `producedAt` differs). No page errors.

## 2026-10-13 — PR: claude/girderdetail-to-stgirder (cross-tool connection GirderDetail → ST-Girder, HANDOFF.md §4.9; CLAUDE.md §7 exception: sender and receiver in one PR; PR link added after merge)

Receiver of one girder's forces, plates and design inputs from GirderDetail (Steel Bridge Beam Modules.html, Structural analysis "Send to ST-Girder", fixlog/Steel Bridge Beam Modules.md EX1). The payload is this tool's existing imported-demands schema (`stgirder-external-demands`, MIDAS station format) with optional fields only. Without such a payload nothing changes (verified: 18 scenarios incl. the MIDAS import, bit-identical). Basis: AASHTO LRFD 10th Ed. (2024).

### GD1. "Pull from GirderDetail" and Import of the hand-off file   [hand-off receiver] [inputs change only after the user confirms]
- **Where:** `App`: new block right before `const uP=(k,v)=>setInp({...inp,proj:{...inp.proj,[k]:v}});` (`GD_CH`, `gdIsNew`, `gdNew` state + `storage` listener, `gdCheck`, `gdAdopt`, `pullGD`); `importJSON` (anchor `// external analysis envelope (MIDAS-style; PS-Girder or steel-beam schema)? attach, don't replace inputs.`); header button before `<button className="btn sm" onClick={exportJSON}>Export JSON</button>`; helpers `extPerGirderOf`, `extFromGD` after `externalSpans()`.
- **Before (importJSON):** a `stgirder-external-demands` file was attached at once (`setInp({...inp, external:{...p,_selSpan:sel}, geom:{...inp.geom, L:sel.len}, ...secNew})`).
- **After (importJSON):** inserted first: `if(p._schema==='stgirder-external-demands'&&extFromGD(p)){ gdAdopt(p,'file '+f.name); return; }` (only files with `producer:"GirderDetail"` and `girderDetail`; every other file takes the old path).
- **gdAdopt:** validates (stations finite, units ft / ft-kip / kip, `factored:false`, span layout), then one confirm dialog: source, produced time, project, stations and spans, every input that changes (old → new) and the sender's notes. On OK: `external` = payload with span 1 selected, `geom.L` = span 1, plates from `section.zones` (`zonesToSec`, as every import), and `mat` (Fyf, Fyw, Fu, Es, hybrid; grade name = the `GRADES` entry with the same Fy and Fu, else unchanged), `deck` (ts, haunch, fc, wc, `beffAuto:false`, beff; `oh` for an exterior girder), `negM` (As = Ar, dTop = ts/2: GirderDetail takes the rebar at the deck mid-depth), `geom` (S, nGirders, Lb = the cross-frame spacing), `loads` (pos, `posAuto:false`, skew = largest support skew), `proj.girderId`; then `BridgeXfer.markAdopted('girderDemands','stgirder',producedAt)`. Saved data: only existing fields; the payload is kept in the existing `inp.external` (it carries `producer`/`producedAt`, the recorded source).
- **Span selection (request item 4):** the existing span buttons of the imported-demands banner and the Diagrams span view work unchanged (member.supports).
- **Check case:** built-in GirderDetail example, G2 → dialog lists b_eff auto → 114 in, A_s 12 → 9.12 in², S 9 → 9.5 ft, L_b 20 → 25 ft, skew 0 → 15°, girder ID G3 → G2; 363 stations, spans 110/140/110 ft, 3 span buttons; "Span 2" → L = 140 ft, 5 plate segments. G1 (exterior) additionally sets overhang 3 → 3.25 ft and position interior → exterior.
- **Spot check of the demands (by hand against GirderDetail's Results tab, G2, unfactored; ST-Girder station = GirderDetail node):**

  | Span, x | GirderDetail M_DC1 / M_DC2 / M_DW / LL+IM (+/−) k-ft; V_DC1 / LL+IM V kip | ST-Girder M1 / M2 / Mw / Ml / Mln; V1 / Vl |
  |---|---|---|
  | 1, 0 | 0 / 0 / 0 / 0 / 0; 51.18 / +111.55 −17.01 | 0 / 0 / 0 / 0 / 0; 51.18 / 111.55 |
  | 1, 44 | 990.40 / 193.18 / 160.01 / 1827.35 / −550.59; −7.49 / +47.68 −49.35 | 990.40 / 193.18 / 160.00 / 1827.35 / −550.59; −7.49 / 49.35 |
  | 1, 110 | −2382.10 / −426.45 / −353.21 / 341.17 / −2280.11; −95.90 (left) / −131.46 | −2382.10 / −426.45 / −353.21 / 341.17 / −2280.11; −95.90 / 131.46 |
  | 2, 0 (x 110) | as above; +95.58 (right) / +134.88 | M as above; 95.58 / 134.88 |
  | 2, 56 (x 166) | 801.15 / 162.79 / 134.83 / 1691.62 / −590.41; 18.08 / +68.20 | 801.14 / 162.78 / 134.83 / 1691.62 / −590.41; 18.08 / 68.20 |
  | 2, 140 (x 250) | −2382.58 / … / −2280.11; −95.51 / −134.88 | −2382.58 / … / −2280.11; −95.51 / 134.88 |
  | 3, 44 (x 294) | 518.36 / 107.89 / 89.36 / 1604.56 / −825.88; 35.48 / +76.93 | 518.36 / 107.89 / 89.36 / 1604.56 / −825.88; 35.48 / 76.93 |
  | 3, 110 (x 360) | 0; −51.19 / −111.55 | 0; −51.19 / 111.55 |

  (Vl is this tool's magnitude envelope max(|+|, |−|); 0.01 differences are the 0.001 rounding of the payload.)
- **How verified:** JSX transpiled (Babel) and `node --check`; headless Chromium: Pull (new-data dot on, off after), the same via Import of the exported file (identical results), Export JSON, reopen in the branch (all tab texts identical, no dialog on open), the branch-saved session opened in main (no errors); no console errors.

### GD2. Fatigue from the imported fatigue envelopes when the import has them   [§4: changes computed results — fatigue only, only for imports with M_FAT]   (engineer-approved 2026-10-13)
- **Where:** `buildExternal()` (anchor `return { spanLen, slice, sel, hasDC1, swExcl,`); `computeAll()` fatigue block (the `stations.forEach(st=>{ const sg=segP[st.si];` loop with `fatMomentAt(Lft,st.x)`), stud fatigue (anchor `fatShearRangeAt(Lft,st.x)`), `fatigue` and `conn` objects, STG-O8 warning (anchor `// STG-O8: the imported envelopes carry no fatigue demands`).
- **Before:**
  ```js
      const Mrange=fatMomentAt(Lft,st.x);                     // k-ft/lane, unfactored, no IM
      const Mf=Mrange*1.15*dfFat;                             // k-ft (IM 1.15, single-lane DF)
      …
      const Vll=fatShearAt(Lft,st.x)*1.15*dfFatV;            // fatigue-truck shear, single-lane SHEAR DF, IM 1.15
      …
      const rg=fatShearRangeAt(Lft,st.x), VfU=rg.range*1.15*dfFatV, Vf=gammaFat*VfU, vsr=Vf*Q/cc.I;
  ```
- **After:**
  ```js
    const fatImp=!!(useExt&&ext.hasFat), fatImpV=!!(useExt&&ext.hasFatV);
      const fP=fatImp? ext.M_FATpos(st.x) : 0, fN=fatImp? ext.M_FATneg(st.x) : 0;
      const Mrange=fatImp? null : fatMomentAt(Lft,st.x);     // k-ft/lane, unfactored, no IM (built-in truck only)
      const Mf=fatImp? Math.max(fP,0)-Math.min(fN,0) : Mrange*1.15*dfFat;   // k-ft (IM 1.15, single-lane DF)
      …
      const Vll=fatImpV? Math.max(Math.abs(ext.V_FATpos(st.x)),Math.abs(ext.V_FATneg(st.x)))
        : fatShearAt(Lft,st.x)*1.15*dfFatV;                  // fatigue-truck shear, single-lane SHEAR DF, IM 1.15
      …
      const rg=fatImpV? (()=>{ const vp=ext.V_FATpos(st.x), vn=ext.V_FATneg(st.x); return {Vpos:vp, Vneg:vn, range:vp-vn}; })()
        : fatShearRangeAt(Lft,st.x);
      const VfU=fatImpV? rg.range : rg.range*1.15*dfFatV, Vf=gammaFat*VfU, vsr=Vf*Q/cc.I;   // imported: per girder, IM + DF in
  ```
  and in `buildExternal` (shears negated like V_LL, the schema's MIDAS sign): `hasFat`, `hasFatV`, `M_FATpos:(x)=>interp('M_FATpos',x)`, `M_FATneg:(x)=>interp('M_FATneg',x)`, `V_FATpos:(x)=>-interp('V_FATneg',x)`, `V_FATneg:(x)=>-interp('V_FATpos',x)`. `fatCalc` rows get `fP`, `fN` and `fatigue`/`conn` get `fatImp`/`fatImpV` (display). For these imports the STG-O8 warning is replaced by a note of what is used and what is not checked (top flange and deck reinforcement at piers); otherwise the old warning is unchanged.
- **Problem:** with imported continuous demands the fatigue checks used the fatigue truck on a simple span of the selected span length, so the negative-moment part of the range and the continuity were missing (STG-O8). GirderDetail sends the fatigue envelopes of its continuous analysis.
- **Governing provision:** AASHTO LRFD 10th Ed. 6.6.1.2.1 (live-load stress range on the short-term composite section for positive and negative flexure when shear connectors are provided throughout and the 6.10.1.7 reinforcement is provided), 6.6.1.2.2 (γ(Δf) ≤ (ΔF)_n), 3.6.1.4 (fatigue load), 6.10.5.3 (special fatigue requirement for webs), 6.10.10.1.2 / 6.10.10.2 (stud shear range and pitch). Load factors and resistances unchanged.
- **Check case (GirderDetail built-in example, G2 interior; Fatigue II, γ = 0.80, category C, ADTT_SL 1000, 75 yr, (ΔF)_n = (44×10⁸/27 375 000)^⅓ = 5.437 ksi):**
  - *Span 1, flange:* before: governing x = 49.5 ft, M_range = 1462.80 k-ft/lane (simple span 110 ft), g_fat = 0.4046 (this tool's 1-lane DF ÷ 1.2), M_f = 1462.80·1.15·0.4046 = 680.70 k-ft, S_b = 1923.66 in³ → Δf = 680.70·12/1923.66 = 4.246 ksi, D/C = 0.80·4.246/5.437 = 0.625. After: governing x = 60.5 ft, M_FAT+ = 500.53, M_FAT− = −221.84 (between nodes 60 and 61) → M_f = 722.38 k-ft → Δf = 4.506 ksi, D/C = 0.663.
  - *Span 1, pier region (x = 110 ft):* before: M_f = 0 (simple-span support). After: M_FAT+ = 103.14, M_FAT− = −403.35 → M_f = 506.49 k-ft, S_b = 3080.27 in³ → Δf = 1.973 ksi (bottom flange).
  - *Span 2 (140 ft):* before Δf = 5.043 ksi at 63 ft (D/C 0.742); after 3.768 ksi at 56 ft (D/C 0.554).
  - *Web special fatigue, span 1, x = 110 ft:* V_perm = 127.95 kip; before V_f,LL = 42.14 → V_u = 127.95 + 1.75·42.14 = 201.69 kip, /783 = 0.257; after V_f,LL = max(47.14, 1.50) = 47.14 → V_u = 210.45 kip, 0.269.
  - *Studs, span 1, x = 0:* before range = 60.07 kip/lane · 1.15 · 0.6167 = 42.60 kip, p_req = 11.17 in; after range = 41.86 − (−5.88) = 47.74 kip (per girder), V_f = 0.80·47.74 = 38.19 kip, p_req = 9.97 in (12 in provided: D/C 1.074 → 1.203).
  - G1 (exterior): span 1 Δf 7.812 → 7.423 ksi (D/C 1.149 → 1.092); span 2 10.034 → 6.710 ksi (1.476 → 0.987).
  - Rating factors and every strength and service check: identical before and after.
- **How verified:** in the page, `computeAll` on the adopted inputs with and without the `M_FAT…`/`V_FAT…` fields (the "without" run is the old path); MIDAS/MCT imports (no fatigue fields) bit-identical to main.

### GD3. Per-girder imported LL+IM: the imported-LL DF / multiple-presence multipliers are not applied   [§4: changes the LL factor for such imports only]
- **Where:** `computeAll()`, anchor `const ext=buildExternal(inp.external,Lft0,`; Inputs tab, imported-LL DF block (anchor `{extActive&&!extPerGirderOf(extRaw)&&<React.Fragment>`).
- **Before:** `const ext=buildExternal(inp.external,Lft0, {pos:(+inp.loads.extDFpos||1)*mpfExt, neg:(+inp.loads.extDFneg||1)*mpfExt, v:(+inp.loads.extDFv||1)*mpfExt});`
- **After:**
  ```js
    const extPerGirder=extPerGirderOf(inp.external);
    const ext=buildExternal(inp.external,Lft0, extPerGirder? {pos:1,neg:1,v:1} :
      {pos:(+inp.loads.extDFpos||1)*mpfExt, neg:(+inp.loads.extDFneg||1)*mpfExt, v:(+inp.loads.extDFv||1)*mpfExt});
  ```
  The DF / m inputs are hidden for such imports; a hint lists the factors GirderDetail applied (per span g_M, g_V; per pier g_M).
- **Problem:** GirderDetail's LL+IM is already per girder. With the LL & DL channel locked (or factors typed), the multipliers would have applied the DFs a second time.
- **Governing provision:** AASHTO LRFD 10th Ed. 4.6.2.2 (distribution factors) and 3.6.1.1.2 (multiple presence), applied once, by the sender; HANDOFF.md §3.3.
- **Check case:** G2 import with DF +M = 0.708 and m = 1.0 in the inputs: before M_LL+ (x = 44 ft) = 0.708 · 1827.35 = 1293.8 k-ft; after 1827.35 k-ft (= GirderDetail). With the defaults (1.0) there is no difference.

### GD4. Note "Forces from GirderDetail …" and fatigue display   [display only]
- **Where:** `gdNoteLines()`, `GdNote` (after `externalSpans()`); shown in the imported-demands banner (Inputs), the Rating tab (anchor `const rq=(inp&&inp.rate)||{};`) and the Report tab (`ReportTab({R,inp})`, now called with `inp`); Fatigue tab Step 4 and web note (`f.fatImp`, `f.fatImpV`); Connectors stud table row and V_f equation (`c.fatImpV`); banner sentence on imported fatigue.
- **Text:** "Forces from GirderDetail (G#, staged analysis); resistances by ST-Girder's own checks." + source and time + "Known differences between the two tools: C_b = 1.0 and one unbraced length L_b for the whole span (GirderDetail: C_b and L_b per location); no Appendix A6 (web plastification) for negative flexure; shear without tension-field action (end-panel V_cr basis); fixed maximum load factors (1.25 DC, 1.50 DW, 1.75 LL; no minimum-factor combinations); L_p = 1.0 r_t √(E/F_yc) here vs 1.1 r_t in GirderDetail. Known differences to be confirmed by the engineer."
- **Check case:** G2 import: the note in all three places; without a GirderDetail import nothing is rendered.

### Open items (not changed)
- The known differences above are listed, not resolved; the engineer to confirm each (L_p: AASHTO Eq. 6.10.8.2.3-4 gives 1.0 r_t √(E/F_yc)).
- Top flange and deck reinforcement fatigue at interior piers are still not checked here (the imported range is applied to the bottom flange, as before).
- "Send reactions to Substructure Loading" still labels an imported girder "MIDAS import (ST-Girder)".

## 2026-10-13 — PR: claude/stgirder-lp-10th (L_p = 1.1 r_t per the 10th Ed.; PR link added after merge)

Engineer's decision 2026-10-13: AASHTO LRFD 10th Ed. Eq. 6.10.8.2.3a-4 is L_p = 1.1 r_t √(E/F_yc) (text supplied by the engineer). Closes the L_p item of GD4 above.

### LP1. Compression-flange L_p = 1.1 r_t √(E/F_yc)   [§4: calc change] [LESS conservative — larger L_p, higher F_nc(LTB) when L_p < L_b ≤ L_r]
- **Where:** `flangeFnc(bfc,tfc,tw,D,Lb_in,Fyc,Es,Rb,Rh,Cb,Dc,Fyw)` (~line 2124), anchor `const Lp=`.
- **Before:**
  ```js
  const Lp=1.0*rt*sqrt(Es/Fyc), Lr=Math.PI*rt*sqrt(Es/FyrV);
  ```
- **After:**
  ```js
  const Lp=1.1*rt*sqrt(Es/Fyc), Lr=Math.PI*rt*sqrt(Es/FyrV);   // Lp: 10th Ed. Eq. 6.10.8.2.3a-4 (9th Ed.: 1.0 r_t)
  ```
  Comments only on the next two lines (code unchanged): `// Eq. 6.10.8.2.3a-2` after the `else if(Lb_in<=Lr)` line and `// Eq. 6.10.8.2.3a-3: R_b F_e, F_e = C_b π²E/(L_b/r_t)²` after the `else` line.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) Art. 6.10.8.2.3a, Eq. 6.10.8.2.3a-4 (9th Ed. Eq. 6.10.8.2.3-4 was 1.0 r_t). Eq. a-2 and a-3 checked against the engineer's text: the code already uses F_yr/(R_hF_yc), the R_bR_hF_yc cap, and R_b on the elastic term (C_bR_bπ²E/(L_b/r_t)² ≤ R_bR_hF_yc). L_r = πr_t√(E/F_yr) is unchanged (see open items).
- **Affected outputs:** every `flangeFnc` use — constructibility top flange (`FncTop`), constructibility −M bottom flange (`FncBotBare`), strength −M bottom flange (`FncNeg`, check "Neg flexure — bot flange (FLB/LTB)"), noncomposite +M (`FncPosNC`), the ratings that use them (−M and noncomposite +M), the `bridgeSuite.v1.capacity` payload `phiMn_neg`, and the L_p values printed on the Constructibility, Flexure and Report tabs. Results change only where LTB governs F_nc and L_b > 1.0 r_t√(E/F_yc).
- **Check case 1 (defaults, constructibility top flange 16 × 0.75, L_b = 20 ft, F_yc = 50, F_yr = 35, R_b = R_h = 1.0, C_b = 1.0):** r_t = 3.7321 in, √(E/F_yc) = √(29000/50) = 24.083. L_p before = 1.0 · 3.7321 · 24.083 / 12 = 7.490 ft; after 1.1 × = 8.239 ft. L_r = 28.125 ft.
  F_nc(LTB) before = [1 − (1 − 35/50)(20 − 7.490)/(28.125 − 7.490)] · 50 = [1 − 0.3 · 0.6063] · 50 = **40.906 ksi**; after = [1 − 0.3 · (11.761/19.886)] · 50 = [1 − 0.3 · 0.5914] · 50 = **41.129 ksi** (+0.55 %). The constructibility ratio (0.6395) is unchanged because the web governs there. −M bottom flange at the defaults: F_nc 43.711 → 44.040 ksi; capacity payload φM_n,neg −7083.8 → −7137.1 kip-ft.
- **Check case 2 (GirderDetail built-in example G2 imported, Span 1, pier x = 110 ft, −M bottom flange of the pier segment, L_b = 25 ft, F_yr = 35 ksi, R_b = R_h = 1.0):** r_t = 4.8266 in, L_p 9.687 → 10.655 ft, L_r = 36.372 ft.
  F_nc before = [1 − 0.3 · (25 − 9.687)/(36.372 − 9.687)] · 50 = [1 − 0.3 · 0.5738] · 50 = 41.392 ksi; after = [1 − 0.3 · (14.345/25.717)] · 50 = [1 − 0.3 · 0.5578] · 50 = 41.633 ksi.
  Neg flexure check f_bu = 38.698 ksi: ratio 0.9349 → **0.9295**. Rating (governing) inventory 1.1437 → 1.1565, operating 1.4826 → 1.4992. Span 2 (pier x = 140 ft): ratio 0.9350 → 0.9296; rating 1.1435 → 1.1564 / 1.4823 → 1.4990.
- **Other results (before → after, branch vs main):** noncomposite defaults +M strength 1.5054 → 1.4972 (F_nc 39.949 → 40.166 ksi), rating 0.519/0.672 → 0.524/0.679; presets top-flange F_nc: Shallow 36.514 → 36.571 (Cnstr FLB 1.6973 → 1.6947), Deep 42.596 → 42.882, Symmetric 41.986 → 42.249 (ratio 0.6023 → 0.5985).
- **How verified:** headless Chromium, origin/main 1f5b31a vs branch: 18 UI scenarios (default, 4 presets, 3 grades, segments, deck design, noncomposite, LL manual, exterior, typed inputs, blank E_s, MIDAS 2-span span 1/2, export–reset–import round trip). Differences only on the Constructibility, Flexure, Report, Rating, Optimize tabs, the status band, and the capacity payload; session (`stgirder.session`), Export JSON, superReactions and lldfGeom payloads, and all inputs identical; round trip identical; same console messages on both (blocked CDN fonts and pre-existing NaN SVG messages in the typed-inputs scenario); no page errors. `computeAll()` on default, presets, noncomposite and the GirderDetail G2 import (spans 1 and 2) gave the values above.
- **Other copies:** GirderDetail (`Steel Bridge Beam Modules.html`, `ltbFnc`, the Deck overhang module, A6.3.3, and PlateLine `PL_B64` `Fnc`) already use 1.1 r_t; not changed.

### LP2. GirderDetail note: "L_p = 1.0 r_t … vs 1.1 r_t in GirderDetail" removed   [display only]
- **Where:** `gdNoteLines(ext)`, the `diffs:[…]` list.
- **Before:** last item `'L_p = 1.0 r_t √(E/F_yc) here vs 1.1 r_t in GirderDetail'` after `'fixed maximum load factors (1.25 DC, 1.50 DW, 1.75 LL; no minimum-factor combinations)',`.
- **After:** the item removed; the list ends with `'fixed maximum load factors (1.25 DC, 1.50 DW, 1.75 LL; no minimum-factor combinations)'],`.
- **Check case:** G2 import: the note lists four known differences (screenshot checked).

### Open items (not changed)
- L_r: the tool keeps L_r = πr_t√(E/F_yr) (the 9th Ed. Eq. 6.10.8.2.3-5 form). The 10th Ed. definition the engineer supplied adds "and geometric imperfection effects" and continues past the screenshot, so the 10th Ed. expression could differ. Engineer to confirm the 10th Ed. L_r equation.
- F_e in Eq. 6.10.8.2.3a-3 is taken as C_bπ²E/(L_b/r_t)² (the 9th Ed. F_cr without R_b); confirm against the printed 10th Ed. definition of F_e.
- The r_t comment still cites "6.10.8.2.3-9" (9th Ed. numbering); the 10th Ed. equation number for r_t was not in the supplied text, so it was not renumbered.

## 2026-10-13 — PR: claude/gd-st-open-direct (open from GirderDetail with the girder loaded; cross-tool connection HANDOFF.md §4.9, sender and receiver in one PR per the CLAUDE.md §7 exception; PR link added after merge)

### OD1. `#gdpull=<producedAt>`: apply the GirderDetail hand-off on load without the confirm, with a summary banner   [hand-off receiver] [no computed result, key, channel or schema changes; manual Pull and Import unchanged]
- **Where:** `App()`: `gdAdopt` (anchor `const gdAdopt=(p,how`), new state and effects after `pullGD` (anchor `/* OD1 (2026-10-13): GirderDetail's "Send to ST-Girder" can open this app`), the banner before `{geomChanges&&!demandsLocked&&(`, and the comment above `const GD_CH='girderDemands'`. About lines 5310–5460.
- **Before:**
  ```js
  const gdAdopt=(p,how)=>{
    const err=gdCheck(p); if(err){ alert('Cannot use the GirderDetail hand-off: '+err+'.'); return false; }
  …
    if(!window.confirm(msg)) return false;
    setInp(nx);
    try{ if(window.BridgeXfer&&p.producedAt) BridgeXfer.markAdopted(GD_CH,GD_RX,p.producedAt); }catch(e){}
    setGdNew(gdIsNew()); return true; };
  ```
  Comment: `in the dialog. Opening the app never applies it. */`
- **After:**
  ```js
  const gdAdopt=(p,how,auto)=>{
    const err=gdCheck(p); if(err){ if(auto){ setGdAuto({ok:false,text:'The GirderDetail hand-off cannot be used: '+err+'. Nothing was changed.'}); return false; }
      alert('Cannot use the GirderDetail hand-off: '+err+'.'); return false; }
  …
    // auto (OD1): opened from GirderDetail's "Send to ST-Girder" after the engineer confirmed there; same changes, no dialog, summary in a banner.
    if(!auto&&!window.confirm(msg)) return false;
    setInp(nx);
    try{ if(window.BridgeXfer&&p.producedAt) BridgeXfer.markAdopted(GD_CH,GD_RX,p.producedAt); }catch(e){}
    if(auto) setGdAuto({ok:true,text:msg.replace(/^[^\n]*\n/,'').replace(/\n+Apply\?$/,'')});
    setGdNew(gdIsNew()); return true; };
  ```
  Comment: `in the dialog. Opening the app never applies it, except when GirderDetail opened it with the #gdpull flag (OD1, below). */`
  Added after `pullGD`:
  ```js
  const [gdAuto,setGdAuto]=useState(null);       // {ok, text}: banner after an open-from-GirderDetail
  const [gdPullReq,setGdPullReq]=useState(null);
  useEffect(()=>{ let m=null; try{ m=/^#gdpull=([^&]*)/.exec(window.location.hash||''); }catch(e){} if(!m) return;
    let id=''; try{ id=decodeURIComponent(m[1]); }catch(e){ id=''; }
    try{ window.history.replaceState(null,'',window.location.pathname+window.location.search); }catch(e){}
    setGdPullReq({id}); },[]);
  useEffect(()=>{ if(!gdPullReq) return; setGdPullReq(null);
    const how='Use GirderDetail’s "Export hand-off (JSON)" and Import here, or click "Pull from GirderDetail" to review what is stored.';
    const same='The tools must be opened the same way: both from the website, or both as files in one folder, in Chrome or Edge.';
    const no=t=>setGdAuto({ok:false,text:t+' Nothing was changed.\n'+same+'\n'+how});
    if(!window.BridgeXfer){ no('The hand-off helper is not available in this browser.'); return; }
    const r=BridgeXfer.read(GD_CH,GD_SCHEMA,1);
    if(r.error||!r.payload){ no('The hand-off from GirderDetail was not found in this browser'+(r.empty?'':' ('+r.error+')')+'.'); return; }
    if(!extFromGD(r.payload)){ no('The hand-off stored in this browser is not from GirderDetail.'); return; }
    if(!gdPullReq.id||r.payload.producedAt!==gdPullReq.id){ no('The hand-off stored in this browser is not the one GirderDetail sent (sent '+(gdPullReq.id||'?')+', stored '+(r.payload.producedAt||'?')+').'); return; }
    gdAdopt(r.payload,'opened from GirderDetail',true); },[gdPullReq]);
  ```
  Banner (JSX, before the MCT geometry-change banner): a `callout` with a green left border, title "Loaded from GirderDetail", text "Applied as confirmed in GirderDetail (Send to ST-Girder). Undo (Ctrl+Z) restores the previous inputs." followed by the dialog's summary (source, time, project, stations and spans, plates, design inputs that change, GirderDetail's notes) and a dismiss button; or a `callout warn` "⚠ GirderDetail hand-off not loaded" with the reason. Same style as the existing "New analysis data available" banner.
- **Problem / request:** GirderDetail's Send to ST-Girder can now open this app in a new tab (fixlog/Steel Bridge Beam Modules.md OD1). The engineer confirmed there, so the payload is applied without a second dialog and the summary is shown without blocking. The flag is handled in a second effect, one render after mount, from `inpRef`, so the saved session (`stgirder.session`, read in the `useState` initializer) and any mount-time update are in place first; the existing autosave effect then writes the session and the active shared-project slice as after a manual pull. `markAdopted` is set as before. The flag is removed from the address, so a refresh does not re-import.
- **Governing provision:** none (hand-off UI; the applied inputs are the same as a manual Pull from GirderDetail).
- **Check case:** GirderDetail built-in example G2 sent; ST-Girder with a saved session (defaults, project name "KEEPME"); opened as `stgirder.html#gdpull=<producedAt>` → address `stgirder.html`, no dialog, banner "Loaded from GirderDetail" with "Design inputs that change: b_eff auto → 114 in (fixed); A_s (−M) 12 → 9.12 in²; S 9 → 9.5 ft; L_b 20 → 25 ft; skew 0 → 15 deg; Girder ID G3 (Interior) → G2 (Interior)" and the notes; project name KEEPME kept; Fyf 50, t_s 8, 5 girders, interior; 30/31 checks pass, governing rating inventory 1.1565 (span 1) — identical to Pull from GirderDetail from the same starting session. `#gdpull=2020-01-01T00:00:00.000Z` → warning "…not the one GirderDetail sent…", nothing changed. Channel empty → "…was not found in this browser. Nothing was changed. The tools must be opened the same way…". Stored payload with `factored:true` → "…cannot be used: the forces must be unfactored (factored:false). Nothing was changed."
- **How verified:** JSX transpiled with @babel/standalone (preset react) and every script block parsed (`new Function`); headless Chromium (Playwright), both files in one folder, over http and as `file://`, 28 checks pass in each: GirderDetail confirm text; new tab opened and flag removed; banner summary equal to the manual confirm's; no dialog in ST-Girder; `bridgeSuite.v1.girderDemands.adopted.stgirder` = producedAt; autosaved session holds the payload as `inp.external`; inputs equal to GirderDetail's values; saved project name kept; Ctrl+Z restores the previous inputs and Ctrl+Y re-applies; refresh: no banner, no re-import, session unchanged; manual Pull from the same starting session still shows the confirm and gives byte-identical session JSON, identical `computeAll` checks and rating, identical Rating tab text; mismatched, missing and invalid payloads apply nothing; GirderDetail cancel and blocked-tab paths. No console or page errors.
- **Other copies:** sender in `Steel Bridge Beam Modules.html` (fixlog/Steel Bridge Beam Modules.md OD1).
- **Open items:** an ST-Girder tab that was already open keeps its own inputs (it shows the new-data dot); all tabs share `stgirder.session`, so its next edit autosaves over the session written by the new tab (existing multi-tab behaviour, not changed). If the MCT demands channel is locked and adopts on the same load, the GirderDetail hand-off is applied after it and replaces the imported demands (the engineer chose it in GirderDetail).

## 2026-10-13 — PR: claude/stgirder-camber-breakdown (Camber tab: dead-load deflection by load, graph and tables; PR link added after merge)

### CB1. Camber: deflected shape by load (steel self-weight, wet concrete, DC2, DW, total) from the existing double integration   [display only] [no headline value, formula, section, unit, key or payload changed]
- **Where:** `computeAll()`, Camber block (anchor `/* ---------- Camber — numeric double integration`), about line 2680; new components `camberSeries`, `camberTable`, `CamberBreakdown` before `function CamberTab({R})` (about line 4539); `CamberTab` graph (anchor `<SG n="3">Deflection by load along the span</SG>`); `ReportTab`, new card "Dead-load deflection by load (camber)" after the "Key results" card (anchor `title="Dead-load deflection by load (camber)"`).
- **Before (calc):**
  ```js
    const deflOf=(Mkey,Ikey)=>{
      const nS=stations.length, xin=stations.map(s=>s.x*12);
      const k=stations.map(s=>(Mkey(s)*12)/(Es*segP[s.si][Ikey].I));
      const th=[0]; for(let i=1;i<nS;i++) th.push(th[i-1]+0.5*(k[i]+k[i-1])*(xin[i]-xin[i-1]));
      const v=[0];  for(let i=1;i<nS;i++) v.push(v[i-1]+0.5*(th[i]+th[i-1])*(xin[i]-xin[i-1]));
      const vc=v.map((vi,i)=>vi - v[nS-1]*xin[i]/Math.max(xin[nS-1],1e-6));
      return Math.max(...vc.map(Math.abs));
    };
    const camDC1=deflOf(s=>s.M1,'bare'), camDC2=deflOf(s=>s.M2,'c3N'), camDW=deflOf(s=>s.Mw,'c3N');
    const camber={camDC1,camDC2,camDW,camTot:camDC1+camDC2+camDW};
  ```
- **After (calc):**
  ```js
    // deflShape: the deflected shape at every station (in, + up, so sagging gives negative values); deflOf = its largest magnitude.
    const deflShape=(Mkey,Ikey)=>{
      const nS=stations.length, xin=stations.map(s=>s.x*12);
      const k=stations.map(s=>(Mkey(s)*12)/(Es*segP[s.si][Ikey].I));
      const th=[0]; for(let i=1;i<nS;i++) th.push(th[i-1]+0.5*(k[i]+k[i-1])*(xin[i]-xin[i-1]));
      const v=[0];  for(let i=1;i<nS;i++) v.push(v[i-1]+0.5*(th[i]+th[i-1])*(xin[i]-xin[i-1]));
      const vc=v.map((vi,i)=>vi - v[nS-1]*xin[i]/Math.max(xin[nS-1],1e-6));
      return vc;
    };
    const deflOf=(Mkey,Ikey)=>Math.max(...deflShape(Mkey,Ikey).map(Math.abs));
    const camDC1=deflOf(s=>s.M1,'bare'), camDC2=deflOf(s=>s.M2,'c3N'), camDW=deflOf(s=>s.Mw,'c3N');
    const camber={camDC1,camDC2,camDW,camTot:camDC1+camDC2+camDW};
    // Breakdown by load (display only; the headline values above are unchanged). DC1 on the bare steel is split into
    // steel self-weight (+ diaphragm point loads) and the rest of DC1 (deck slab + haunch + Add'l DC1), taken as M1 − M_steel
    // so the two parts sum to M1 exactly. Imported DC1 is not split unless the import excludes self-weight (ST-Girder adds it).
    const dc1Split = !(useExt&&ext.hasDC1) ? 'app' : (ext.swExcl ? 'swExcl' : 'none');
    const Msteel = st => dc1Split==='app' ? simpleM(Ld.wsw,st.x)+diaM(st.x) : dc1Split==='swExcl' ? simpleM(wswAvg,st.x) : 0;
    const shDC1=deflShape(s=>s.M1,'bare'), shDC2=deflShape(s=>s.M2,'c3N'), shDW=deflShape(s=>s.Mw,'c3N');
    const shSW = dc1Split==='none' ? null : deflShape(Msteel,'bare');
    const shWet= dc1Split==='none' ? null : deflShape(s=>s.M1-Msteel(s),'bare');
    const shTot=stations.map((_,i)=>shDC1[i]+shDC2[i]+shDW[i]);
    camber.shape={x:stations.map(s=>s.x), dc1Split, hasDia:dc1Split==='app'&&dph.length>0,
      sw:shSW, wet:shWet, dc1:shDC1, dc2:shDC2, dw:shDW, tot:shTot,
      splices:segP.filter(g=>g.x1>0.05&&g.x1<Lft-0.05).map(g=>g.x1)};
    camber.camTotMax=Math.max(...shTot.map(Math.abs));    // largest per-station total (vs camTot = sum of the stage maxima)
  ```
- **Before (CamberTab):** `const cm=R.camber, L=R.geom.L, xs=[], ys=[];` and `for(let i=0;i<=20;i++){const x=L*i/20; const sh=(x*(L-x))/((L/2)*(L/2)); xs.push(x); ys.push(-cm.camTot*sh);}` with
  ```jsx
      <Fig h={260} data={[{x:xs,y:ys,name:'deflected shape',mode:'lines',fill:'tozeroy',line:{color:'#1C4FC4'}}]}
        layout={{yaxis:{title:'Δ (in)'},xaxis:{title:'x (ft)'}}}/>
  ```
  (a parabola scaled to the total camber, not the computed shape).
- **After (CamberTab):** `const cm=R.camber;` and the `Fig` replaced by
  ```jsx
      <SG n="3">Deflection by load along the span</SG>
      <CamberBreakdown R={R} fig={true}/>
  ```
  ReportTab, after the Key results `</Card>`:
  ```jsx
    <Card title="Dead-load deflection by load (camber)" refTag="DC1 on bare steel · DC2, DW on 3n composite">
      <CamberBreakdown R={R} fig={false}/>
    </Card>
  ```
  New components (before `function CamberTab`):
  ```jsx
// Camber breakdown by load: curve definitions, tenth-point / flange-transition table (display only).
// Values in the table are downward deflection (in, + down) = the camber (upward offset) to fabricate.
function camberSeries(R){
  const sh=R.camber.shape;
  const swL = sh.dc1Split==='swExcl' ? 'Steel self-weight (added by ST-Girder)' : 'Steel self-weight'+(sh.hasDia?' + diaphragms':'');
  const wetL= sh.dc1Split==='swExcl' ? 'Imported DC1 excl. self-weight' : 'Wet concrete (deck, haunch, add’l DC1)';
  const out=[];
  if(sh.dc1Split==='none') out.push({k:'dc1',l:'DC1 (imported, not split)',short:'DC1 (imported)',c:'#15803D',v:sh.dc1});
  else { out.push({k:'sw',l:swL,short:sh.dc1Split==='swExcl'?'Self-weight (app)':'Steel self-wt'+(sh.hasDia?' + diaph.':''),c:'#6B7280',v:sh.sw});
         out.push({k:'wet',l:wetL,short:sh.dc1Split==='swExcl'?'Imported DC1 − SW':'Wet concrete',c:'#15803D',v:sh.wet}); }
  out.push({k:'dc2',l:'DC2 (3n composite)',short:'DC2',c:'#0E7490',v:sh.dc2});
  out.push({k:'dw',l:'DW (3n composite)',short:'DW',c:'#B45309',v:sh.dw});
  out.push({k:'tot',l:'Total (sum)',short:'Total',c:'#16212E',v:sh.tot});
  return out;
}
function camberTable(R){
  const sh=R.camber.shape, L=R.geom.L, ser=camberSeries(R), X=sh.x;
  const at=(arr,x)=>{ if(x<=X[0]) return arr[0]; for(let i=1;i<X.length;i++) if(x<=X[i]+1e-9){
      const t=(x-X[i-1])/Math.max(X[i]-X[i-1],1e-9); return arr[i-1]+(arr[i]-arr[i-1])*t; } return arr[arr.length-1]; };
  const pts=[]; for(let i=0;i<=10;i++) pts.push({x:L*i/10,lab:(i/10).toFixed(1)+'L'});
  sh.splices.forEach(x=>{ if(!pts.some(p=>Math.abs(p.x-x)<0.05)) pts.push({x,lab:'flange transition'}); });
  pts.sort((a,b)=>a.x-b.x);
  const head=['Location','x (ft)',...ser.map(c=>c.short+' (in)')];
  const dn=v=>Math.abs(v)<5e-4?0:-v;                 // downward +, no "-0.000" at the supports
  const rows=pts.map(p=>({c:[p.lab,fmt(p.x,2),...ser.map(c=>fmt(dn(at(c.v,p.x)),3))]}));
  const mx=ser.map(c=>{ let j=0; c.v.forEach((v,i)=>{ if(Math.abs(v)>Math.abs(c.v[j])) j=i; }); return {v:-c.v[j],x:X[j]}; });
  rows.push({_cls:'tot',c:[{v:<b>Maximum</b>},'',...mx.map(m=>({v:<span><b>{fmt(m.v,3)}</b> <span style={{color:'var(--ink2)'}}>@ {fmt(m.x,1)} ft</span></span>}))]});
  return {head,rows,ser,mx};
}
function CamberBreakdown({R,fig}){
  const sh=R.camber.shape, cm=R.camber, T=camberTable(R);
  const d=Math.abs(cm.camTotMax-cm.camTot);
  return (<React.Fragment>
    {fig&&<Fig h={300} data={T.ser.map(c=>({x:sh.x,y:c.v,name:c.l,mode:'lines',
        line:{color:c.c,width:c.k==='tot'?2.6:1.8,dash:c.k==='tot'?'solid':(c.k==='sw'?'dot':'solid')}}))}
      layout={{yaxis:{title:'Δ (in), downward −'},xaxis:{title:'x (ft)'},legend:{orientation:'h',y:1.22,font:{size:10}},margin:{l:52,r:14,t:34,b:38}}}/>}
    {fig&&<div className="hint" style={{marginTop:4}}>Dead-load deflected shapes from the double integration, drawn downward. <b>Camber = upward offset</b> equal and opposite to these curves.</div>}
    <Tbl head={T.head} rows={T.rows}/>
    <div className="hint" style={{marginTop:6}}>Downward dead-load deflection, in (+ = down) = camber (upward offset) to fabricate, at tenth points{sh.splices.length?' and flange transitions':''}. DC1 (steel self-weight and wet concrete) acts on the bare steel; DC2 and DW on the long-term (3n) composite section. Total = sum of the columns at each station.
      {sh.dc1Split==='app'&&<span> Steel self-weight = girder steel at 0.490 kcf ({fmt(R.loads.wsw,3)} klf){sh.hasDia?' + the diaphragm point loads':''}; wet concrete = deck slab + haunch ({fmt(R.loads.wdk,3)} klf) + Add'l DC1 (forms, details: {fmt(+R.loads.wDC1-R.loads.wsw-R.loads.wdk,3)} klf).</span>}
      {sh.dc1Split==='swExcl'&&<span> The imported DC1 excludes self-weight; ST-Girder adds the girder self-weight ({fmt(R.loads.wsw,3)} klf) on the span. The imported remainder is not split further.</span>}
      {sh.dc1Split==='none'&&<span> <b>DC1 is imported</b> ({(R.ext&&R.ext.sel&&'span '+(R.ext.sel.idx||1))||'import'}) as one total; the import does not separate steel self-weight from wet concrete, so DC1 is shown as one column.</span>}
      {d>0.0005&&<span> The largest per-station total ({fmt(cm.camTotMax,3)} in) differs from the headline total camber ({fmt(cm.camTot,3)} in, the sum of the stage maxima) by {fmt(d,3)} in because the stage maxima occur at different stations.</span>}
    </div>
  </React.Fragment>);
}
  ```
- **Problem / request:** the engineer asked for the dead-load deflection broken down by load in the graph and in tables: steel self-weight, wet concrete, DC2, DW and the total, each along the span. The old graph was a parabola scaled to the total.
- **Which DC1 components go where** (`loadsCalc`: `wDC1 = wsw + wdk + loads.wDCextra`, plus `diaM(x)` in the station moments `M1 = simpleM(Ld.wDC1,x) + diaM(x)`):
  - *Steel self-weight* = `simpleM(Ld.wsw,x)` (girder steel at 0.490 kcf, the area-weighted `wswAvg` over the flange segments) **+ `diaM(x)` (diaphragm point loads)**, because diaphragms/cross-frames are steel erected with the girders, before the pour. The curve and column are labelled "Steel self-weight + diaphragms" when diaphragms are entered.
  - *Wet concrete* = `M1 − M_steel` = deck slab `trib·(t_s,DL/12)·w_c` + haunch `(b_ft/12)(haunch/12)·w_c` + **Add'l DC1** (input labelled "forms, details", e.g. SIP forms). Taken as the remainder so the two parts sum to `M1` exactly.
  - Both on the bare steel section (`'bare'`), DC2 and DW on the long-term 3n section (`'c3N'`), as before.
- **Imported demands** (`R.useExt && R.ext.hasDC1`, i.e. MCT/MIDAS file or GirderDetail hand-off with `M_DC1`): the payload carries only the DC1 total (HANDOFF.md §4.9 has no self-weight/deck split), so DC1 is one curve and column "DC1 (imported, not split)" with a note. If the import has `selfWeightExcluded:true`, the existing calc already adds the girder self-weight (`simpleM(wswAvg,x)`), so the curves are "Steel self-weight (added by ST-Girder)" and "Imported DC1 excl. self-weight". An import without `M_DC1` uses the app's own DC1 and is split as for the built-in case.
- **Headline values:** `camDC1/camDC2/camDW/camTot` unchanged (same function, same stations; `camTot` = sum of the stage maxima). The table's Maximum row gives each column's largest value and its station; when the largest per-station total (`camber.camTotMax`) differs from `camTot` by more than 0.0005 in, a note says so (stage maxima at different stations). On the built-in example they are equal (all at 60 ft).
- **Governing provision:** none changed (display of the existing calc: dead-load deflection by double integration of M/(E·I) on the stage sections, DC1 on the bare steel, DC2 and DW on the 3n composite, as before).
- **Check case (built-in example, L = 120 ft, I_bare = 48,910 in⁴, I_3n = 100,951 in⁴, E = 29,000 ksi):** w_sw = 0.2297 klf, w_deck+haunch = 0.9333 klf, Add'l DC1 = 0.015 klf (w_DC1 = 1.1780 klf), w_DC2 = 0.30, w_DW = 0.25 klf.
  - Midspan (0.5L), downward: self-weight 0.752, wet concrete 3.107, DC2 0.476, DW 0.397, total 4.732 in. Before: Δ_DC1 = 3.859 = 0.752 + 3.107 (to 1e-15 at every station), Δ_DC2 0.476, Δ_DW 0.397, Δ_total 4.732 — unchanged.
  - Hand check, 5wL⁴/384EI: self-weight 5(0.2297/12)(1440)⁴/(384·29,000·48,910) = 0.756 in; wet concrete (0.9483 klf) 3.119 in; DC2 0.478 in. The tool's 20-division trapezoidal integration gives 0.4 % less (existing, see open items).
  - Tenth points 0.1L…0.9L total: 1.485, 2.810, 3.848, 4.507, 4.732, 4.507, 3.848, 2.810, 1.485 in.
- **How verified:** JSX transpiled with @babel/standalone (preset react) and every script block parsed. Node (`computeAll` of main vs branch): the whole result object other than the new `camber.shape`/`camber.camTotMax` is identical (JSON) for the built-in example, diaphragms added, flange transitions on, GirderDetail hand-off span 1 and 2 (example 3-span 110/140/110 ft, G2), the same with `selfWeightExcluded:true`, and an import without `M_DC1`; |sw + wet − DC1| ≤ 3e-15 in at every station; the maxima of the DC1/DC2/DW shapes equal the old camDC1/camDC2/camDW exactly. Headless Chromium (Playwright), main vs branch, 20 scenarios (built-in, presets, grades, flange transitions, deck design, noncomposite, manual LL, exterior, typed inputs, MIDAS 2-span import span 1/2, GirderDetail hand-off JSON imported span 1/2, export/import round trip): inputs, status band, every tab's text except Camber and Report, autosave (`stgirder.session`), Export JSON, superReactions, capacity and lldfGeom hand-offs identical; Camber and Report text only gain the new lines (the old axis title "Δ (in)" is replaced); console errors identical on both (blocked font requests and the pre-existing NaN SVG warnings of the "Es blank" scenario). Screenshots of the Camber tab (built-in and GirderDetail import) checked.
- **Other copies:** none.
- **Open items:**
  - The double integration uses the analysis stations (L/20 plus ±0.01 ft at flange transitions), trapezoidal; on the built-in example it gives Δ_DC1 = 3.859 in vs 3.875 in closed form (−0.4 %, slightly low for camber). Not changed; a finer station set would change the headline values.
  - `selfWeightExcluded:true` imports: the self-weight added by ST-Girder is a simple-span moment on the selected span (existing, stated in the import banner). On a continuous span this overstates the self-weight deflection (GirderDetail example span 2 with the flag set: 1.89 in self-weight vs 1.58 in for the imported remainder). Not changed.
  - Diaphragm point loads are grouped with the steel self-weight; Add'l DC1 ("forms, details") with the wet concrete. Engineer to confirm, or ask for a separate column.

## 2026-10-13 — PR: claude/camber-followups (Camber follow-ups CF1, CF3, CF4: fine integration, headline max and location, GirderDetail DC1 split; engineer's decisions 2026-10-13; cross-tool connection HANDOFF.md §4.9, sender `Steel Bridge Beam Modules.html` in the same PR; PR link added after merge)

### CF1. Camber: camber-only fine station set (about 0.5 ft) for the double integration   [§4: calc change] [MORE conservative — larger camber; checks unchanged]
- **Where:** `computeAll()`, Camber block (anchor `/* ---------- Camber — numeric double integration`), about line 2681. The check stations (`stations`, L/20 plus ±0.01 ft at flange transitions) are not changed; camber gets its own set `camSt`.
- **Before:**
  ```js
    const deflShape=(Mkey,Ikey)=>{
      const nS=stations.length, xin=stations.map(s=>s.x*12);
      const k=stations.map(s=>(Mkey(s)*12)/(Es*segP[s.si][Ikey].I));
      …
    const shTot=stations.map((_,i)=>shDC1[i]+shDC2[i]+shDW[i]);
    camber.shape={x:stations.map(s=>s.x), …
  ```
  (the deflection integrated on the 21 check stations of the built-in example, h = 6 ft).
- **After (whole block, CF1 + CF3 + CF4 receiver):**
  ```js
    /* ---------- Camber — numeric double integration (handles segments & continuous M) ---------- */
    // CF1 (2026-10-13): camber-only fine station set (the checks keep `stations`): about 0.5 ft spacing (at least L/20),
    // plus every check station (supports, ±0.01 ft at flange transitions) and the imported payload's own stations in this span.
    // The moments are the same expressions as `stations` (M1, M2, Mw), evaluated at the fine stations.
    const camH=0.5, camN=Math.max(Ndiv,Math.ceil(Lft/camH));
    const camSet=new Set(xs);
    for(let i=0;i<=camN;i++) camSet.add(+(Lft*i/camN).toFixed(4));
    if(useExt) ext.slice.forEach(s=>{ if(s.xr>1e-6&&s.xr<Lft-1e-6) camSet.add(+s.xr.toFixed(4)); });
    const camSt=[...camSet].filter(x=>x>=0&&x<=Lft).sort((a,b)=>a-b).map(x=>({x, si:segIdxAt(x),
      M1: (useExt&&ext.hasDC1)? ext.M_DC1(x)+(ext.swExcl? simpleM(wswAvg,x):0) : simpleM(Ld.wDC1,x)+diaM(x),
      M2: useExt? ext.M_DC2(x) : simpleM(Ld.wDC2,x),
      Mw: useExt? ext.M_DW(x)  : simpleM(Ld.wDW,x)}));
    // deflShape: the deflected shape at every camber station (in, + up, so sagging gives negative values); deflOf = its largest magnitude.
    const deflShape=(Mkey,Ikey)=>{
      const nS=camSt.length, xin=camSt.map(s=>s.x*12);
      const k=camSt.map(s=>(Mkey(s)*12)/(Es*segP[s.si][Ikey].I));
      const th=[0]; for(let i=1;i<nS;i++) th.push(th[i-1]+0.5*(k[i]+k[i-1])*(xin[i]-xin[i-1]));
      const v=[0];  for(let i=1;i<nS;i++) v.push(v[i-1]+0.5*(th[i]+th[i-1])*(xin[i]-xin[i-1]));
      const vc=v.map((vi,i)=>vi - v[nS-1]*xin[i]/Math.max(xin[nS-1],1e-6));
      return vc;
    };
    const deflOf=(Mkey,Ikey)=>Math.max(...deflShape(Mkey,Ikey).map(Math.abs));
    const camDC1=deflOf(s=>s.M1,'bare'), camDC2=deflOf(s=>s.M2,'c3N'), camDW=deflOf(s=>s.Mw,'c3N');
    const camber={camDC1,camDC2,camDW,camTot:camDC1+camDC2+camDW};
    // Breakdown by load (display only). DC1 on the bare steel is split into steel self-weight (+ diaphragm point loads) and the
    // rest of DC1 (deck slab + haunch + Add'l DC1), taken as M1 − M_steel so the two parts sum to M1 exactly. Imported DC1 is split
    // by the payload's M_DC1steel when present (GirderDetail, CF4), or by the self-weight ST-Girder adds (selfWeightExcluded); else not split.
    const dc1Split = !(useExt&&ext.hasDC1) ? 'app' : ext.swExcl ? 'swExcl' : ext.hasDC1split ? 'import' : 'none';
    const Msteel = st => dc1Split==='app' ? simpleM(Ld.wsw,st.x)+diaM(st.x) : dc1Split==='swExcl' ? simpleM(wswAvg,st.x) : dc1Split==='import' ? ext.M_DC1steel(st.x) : 0;
    const shDC1=deflShape(s=>s.M1,'bare'), shDC2=deflShape(s=>s.M2,'c3N'), shDW=deflShape(s=>s.Mw,'c3N');
    const shSW = dc1Split==='none' ? null : deflShape(Msteel,'bare');
    const shWet= dc1Split==='none' ? null : deflShape(s=>s.M1-Msteel(s),'bare');
    const shTot=camSt.map((_,i)=>shDC1[i]+shDC2[i]+shDW[i]);
    const argMax=a=>{ let j=0; a.forEach((v,i)=>{ if(Math.abs(v)>Math.abs(a[j])) j=i; }); return j; };
    camber.shape={x:camSt.map(s=>s.x), dc1Split, hasDia:dc1Split==='app'&&dph.length>0,
      sw:shSW, wet:shWet, dc1:shDC1, dc2:shDC2, dw:shDW, tot:shTot,
      splices:segP.filter(g=>g.x1>0.05&&g.x1<Lft-0.05).map(g=>g.x1)};
    camber.xDC1=camSt[argMax(shDC1)].x; camber.xTot=camSt[argMax(shTot)].x;   // CF3: locations of the maxima (headline)
  ```
  `camber.camTotMax=Math.max(...shTot.map(Math.abs));` follows, as before.
- **Problem:** trapezoidal double integration of M/(E·I) on the L/20 check stations under-estimates the deflection (−0.4 % on the built-in example), and on imported continuous spans it interpolated the moment diagram between stations L/20 apart, missing its curvature (−2 % on the GirderDetail example span 2). The fine set (≥ L/20, about 0.5 ft) also includes every check station (supports, both sides of each flange transition) and every station of the imported payload inside the span.
- **Governing provision:** none changed (M/(E·I) on the stage sections: DC1 bare steel, DC2 and DW long-term 3n; E_s, units and sections as before). AASHTO LRFD 10th Ed. Art. 6.7.2 (dead-load camber) is the context; no equation of it is coded.
- **Check case (built-in example):** L = 120 ft, E = 29,000 ksi, I_bare = 48,910.36 in⁴, I_3n = 100,950.64 in⁴, w_DC1 = 1.178021 klf, w_DC2 = 0.30, w_DW = 0.25 klf.
  - Hand: Δ = 5wL⁴/(384EI), L = 1440 in: Δ_DC1 = 5(1.178021/12)(1440)⁴/(384·29,000·48,910.36) = 3.8749 in; Δ_DC2 = 5(0.025)(1440)⁴/(384·29,000·100,950.64) = 0.4781 in; Δ_DW = 0.3984 in; total 4.7514 in.
  - Before: 3.8594 / 0.4762 / 0.3968, Δ_total 4.7324 in. After: 3.8748 / 0.4781 / 0.3984, Δ_total 4.7513 in (displayed 3.87 / 0.478 / 0.398 / 4.75).
  - Convergence (camH): 6 ft 3.8594; 2 ft 3.8732; 1 ft 3.8745; 0.5 ft 3.8748; 0.25 ft 3.8749; 0.1 ft 3.8749 in. GirderDetail example G2 span 2 (140 ft, imported): L/20 1.5806 → 0.5 ft 1.6129; 0.25 ft 1.6130; 0.1 ft 1.6130 in.
  - Other cases, before → after (Δ_total): flange transitions on 4.5958 → 4.6150; L = 100 ft 2.2822 → 2.2913; diaphragms 2 × 2 kip 4.8620 → 4.8812; GirderDetail example spans 1/2/3 (imported, defaults otherwise) 1.5852 → 1.6013, 1.8731 → 1.9110, 1.5866 → 1.6027; MIDAS 2-span test 2.1014 → 2.1263 in.
- **How verified:** see CF4.
- **Other copies:** none.

### CF3. Camber headline: "Total DL camber (max)" with its location; Δ DC1 with its location   [display] [headline value = largest per-station total]
- **Where:** `CamberTab` (anchor `Total DL camber (max)`), `ReportTab` Key results (anchor `['Total DL camber (max)'`), `CamberBreakdown` note (anchor `the headline value`).
- **Before:**
  ```jsx
      <div className="br"><div className="l">Total DL camber (mid)</div><div className="n">{fmt(cm.camTot,2)}</div><div className="u">in ↑ offset</div></div>
      <div className="br"><div className="l">Δ DC1 (bare steel)</div><div className="n">{fmt(cm.camDC1,2)}</div><div className="u">in</div></div>
  ```
  `['Total DL camber',fmt(R.camber.camTot,2),'in'],`
- **After:**
  ```jsx
      <div className="br"><div className="l">Total DL camber (max)</div><div className="n">{fmt(cm.camTotMax,2)}</div><div className="u">in ↑ offset · at x = {fmt(cm.xTot,1)} ft</div></div>
      <div className="br"><div className="l">Δ DC1 (bare steel)</div><div className="n">{fmt(cm.camDC1,2)}</div><div className="u">in · at x = {fmt(cm.xDC1,1)} ft</div></div>
  ```
  `['Total DL camber (max)',fmt(R.camber.camTotMax,2),'in at x = '+fmt(R.camber.xTot,1)+' ft'],`
  Note when they differ: "The largest total (… in, the headline value) is … in less than Δ_total = Δ_DC1 + Δ_DC2 + Δ_DW (… in, the sum of the stage maxima) because the stage maxima occur at different stations."
- **Problem:** "(mid)" is wrong on continuous spans (GirderDetail example span 1 peaks at 44.5 ft of 110). The headline now shows the largest total deflection along the span (the camber at one point) and where it occurs, on every span. Δ_total in the derivation stays the sum of the stage maxima (it is ≥ the headline value; equal when all maxima are at one station).
- **Check case:** built-in 4.75 in at x = 60.0 ft (= Δ_total 4.751); GirderDetail example span 1 (imported via Import, browser): 1.60 in at x = 44.5 ft, Δ_DC1 1.36 in at 44.0 ft; app-computed DC1 on an imported span without M_DC1 (GirderDetail span 1 without M_DC1): headline 3.741 in at x = 53.5 ft vs Δ_total = 3.752 in (larger by 0.012 in; note shown).
- **Governing provision:** none.

### CF4. Camber: use the GirderDetail DC1 split (`M_DC1steel`) when the payload has it   [hand-off receiver, display] [no check result changes]
- **Where:** `buildExternal()` (anchors `const hasDC1split=` and `M_DC1steel:(x)=>interp('M_DC1steel',x)`), the Camber block (`dc1Split … 'import'`, above), `camberSeries`/`CamberBreakdown` labels and note (anchor `sh.dc1Split==='import'`), `gdCheck` optional-field validation (anchor `'M_DC1steel','V_DC1steel','M_DC1wet','V_DC1wet'`).
- **Before:** `const dc1Split = !(useExt&&ext.hasDC1) ? 'app' : (ext.swExcl ? 'swExcl' : 'none');` — an imported DC1 was always shown as one total ("DC1 (imported, not split)").
- **After:** `const dc1Split = !(useExt&&ext.hasDC1) ? 'app' : ext.swExcl ? 'swExcl' : ext.hasDC1split ? 'import' : 'none';` with steel = `ext.M_DC1steel(x)` and wet concrete = `M1 − M_steel`. Curves/columns "Steel (imported: girder + details)" and "Wet concrete (imported: deck, haunch, SIP, other DC1)". `gdCheck` also rejects a non-numeric value in the four new optional fields (absent is fine). Older payloads: unchanged ("not split").
- **Governing provision:** none (display of the imported moments; same sections as DC1).
- **Check case:** GirderDetail example G2, span 1, x = 44 ft: M_DC1 = 990.401, M_DC1steel = 164.482, M_DC1wet = 825.919 k-ft (sum 990.401). Camber maxima (browser, imported): steel 0.220 in at 43.5 ft, wet concrete 1.141 in at 44.5 ft, DC2 0.129, DW 0.107, total 1.597 in at 44.5 ft; steel + wet = DC1 shape within 1e-14 in at every station.
- **How verified (CF1, CF3, CF4):** JSX transpiled with @babel/standalone and all script blocks parsed. Node, `computeAll` main vs branch, 16 cases (built-in, diaphragms, flange transitions, L = 100 ft, GirderDetail example spans 1–3 with the old and the new payload, MIDAS 2-span spans 1–2, selfWeightExcluded): every result other than `camber` identical (JSON); the camber values as listed in CF1. Headless Chromium, main vs branch, 20 scenarios (built-in, presets, grades, flange transitions, deck design, noncomposite, manual LL, exterior, typed inputs, MIDAS import spans 1/2, GirderDetail hand-off file (new payload) spans 1/2, export/import round trip): inputs, status band, every tab except Camber and Report, autosave, Export JSON and all hand-offs identical; round trip identical; console errors identical (pre-existing font blocks and "Es blank" NaN SVG warnings). GirderDetail → ST-Girder "Send" + open-now flow (OD1 test, 28 checks) passes as file:// and over http with no console errors. Screenshots of the Camber tab checked.
- **Other copies:** sender: `Steel Bridge Beam Modules.html` (fixlog/Steel Bridge Beam Modules.md CF4).
- **Open items:**
  - CF2 (self-weight added by ST-Girder on continuous imported spans, `selfWeightExcluded:true`) not implemented: options sent to the engineer (it changes M_DC1 for every check, not only camber).
  - GirderDetail's DC1 has no cross-frame weight unless the user enters a DC1 row (its detail allowance covers stiffeners, connection plates and splices).

## 2026-10-13 — PR: claude/stgirder-restyle (restyle to match GirderDetail: theme, typography, header, cards, inputs, tables, check presentation, equation blocks; engineer's request 2026-10-13; PR link added after merge)

### RS1. GirderDetail look ("calc-pad" theme) for the whole page   [display only] [no computed result, input, key, saved format or hand-off changed]
- **Where:** the first `<style>` block (anchor: the new block starts with `/* Theme: GirderDetail "calc-pad" look`), the Google Fonts `<link>` in `<head>`, and these UI primitives / App markup: `Tbl` (anchor `c.v==='PASS'||c.v==='FAIL'`), `RBar` (anchor `const RBar=`), `VarTable` (anchor `className="wsym"`), `Deriv` (anchor `className="sg-block"`), `PLT` (anchor `"Barlow Semi Condensed", Barlow, system-ui`), the status band in `App` (anchor `className="sb-gov"`), `ReportTab` summary table (anchor `<RBar r={c.r}`), header subtitle (anchor `Built-up steel plate girder design`).
- **Before:** drafting-sheet theme: framed `.sheet`, Archivo / IBM Plex Mono, uppercase condensed headings, black 1.5 px card borders, uppercase tabs, mono status chips (`<span className="chip head">Design status</span>` + `{c.t||c.n} {fmt(c.r,2)}`), PASS/FAIL as coloured text, plain D/C text in the Report summary, derivation groups as plain headings, Plotly in IBM Plex Mono.
- **After (copied from `Steel Bridge Beam Modules.html`, kept duplicated per CLAUDE.md §3):**
  - Tokens: GirderDetail calc-pad colours (pad #e8eee2 with 24 px grid, graphite #252d29 text, ink blue #1d56a3, pass #2c7a4b, red pencil #c3352b, warn #9c6a0e, borders #d4ddcd / #b4c1ab). The ST-Girder token names (`--paper`, `--ink`, `--ink2`, `--line`, `--pass` …) are kept because inline styles use them; only their values change. GirderDetail has no dark mode, so none is added.
  - Fonts: Barlow / Barlow Semi Condensed (GirderDetail's Google Fonts link replaces the Archivo / IBM Plex Mono link; fallbacks Segoe UI, Arial). No script library added or changed (React 18.2.0, Babel 7.23.5, Plotly 2.27.0, KaTeX 0.16.9 unchanged).
  - Header: white header strip, tool name in the condensed face, title-block fields and toolbar buttons styled as GirderDetail fields and buttons (same buttons, order, titles and handlers).
  - Verdict strip (status band): GirderDetail verdict ("All checks pass" / "Not all checks pass" with ✓/✕), "Governing: <check> <ratio>" (the largest D/C, already shown in its chip), and GirderDetail chips (✓/✕, label, ratio; failing chips red). Same chips, order and tooltips.
  - Output tabs and Inputs sub-tabs: GirderDetail tab bar (same tabs, order, labels and behaviour; text no longer forced to upper case).
  - Cards, field labels/inputs/selects/units, group labels, hints, notices (callouts), key-value lists, headline figures (`bigres`, as GirderDetail scorecard figures with a pass/fail rule), segmented buttons, tables (GirderDetail `.tbl`), PASS/FAIL cells as GirderDetail badges (same text), footer.
  - Equations: `Step` and each numbered group of a `Deriv` (from an `SG` heading to the next) render as GirderDetail eq-blocks (title row, equation strip with the blue left rule); `VarTable` styled as GirderDetail's "where" table (blue italic symbol, description, value, unit). KaTeX rendering unchanged.
  - Report "Design summary" table: a GirderDetail ratio bar (0–1.25 scale, tick at 1.0) beside the same D/C text; failing rows tinted. The bar is hidden in print.
  - Plotly charts: GirderDetail chart font and axis/grid colours (layout, data and sizes unchanged).
  - Print: grid background removed, title-block fields print without boxes, the Report summary table now fits the page width (on main the Status column was clipped).
- **Problem:** engineer's request (2026-10-13): make ST-Girder look like GirderDetail, styling and check presentation only.
- **Governing provision:** none (no formula, factor, unit, reference or computed value touched).
- **Check case:** built-in example: status strip "All checks pass · Governing: Studs fat 0.94", 26 chips with the same ratios as before; Report summary D/C 0.88 … 0.59 as before, PASS badges; GirderDetail example G2 span 1: "Not all checks pass · Governing: Studs fat 1.20" (red chip), as the Studs fat chip on main.
- **How verified:** JSX transpiled with @babel/standalone 7.23.5 and every script block parsed. The source from `</style>` to `/* ================= UI PRIMITIVES` (all computation) and from `/* ================= PROJECT STORAGE` to `function App(){` is byte-identical to main. Node: `computeAll` result object R and `bxSuperRxPayload` JSON identical main vs branch for 10 cases (built-in, diaphragms, flange transitions, L = 100 ft, a failing section, GirderDetail hand-off spans 1–3, MIDAS 2-span spans 1–2). Headless Chromium main vs branch, 20 scenarios (built-in, 4 presets, 3 grades, flange transitions, deck design, noncomposite, manual LL, exterior, typed inputs, Es blank, MIDAS import spans 1/2, GirderDetail hand-off file spans 1/2, export/import round trip): inputs, autosave (`stgirder.session`), Export JSON, superReactions, capacity and lldfGeom hand-offs and bridgeSuite keys identical; every tab's text identical ignoring letter case and white space (the only text change is the removed CSS upper-casing; the header subtitle is now sentence case); status-band chips identical; round trip identical; console errors identical (pre-existing blocked-font and "Es blank" NaN SVG messages). GirderDetail → ST-Girder "Send" + open-now flow (OD1 test, 28 checks) passes as file:// and over http with no console errors. Report print text identical to main (print emulation). Screenshots of every tab before/after compared with GirderDetail.
- **Other copies:** the theme CSS is copied from `Steel Bridge Beam Modules.html` (GirderDetail); that file is not changed.
- **Open items:** none. Not matched: GirderDetail's check IDs (ST-Girder checks have none; adding IDs would change the report content) and its left input sidebar layout (ST-Girder keeps its own tab layout as requested).

## 2026-10-13 — PR: claude/stgirder-sw-continuous (self-weight added to `selfWeightExcluded:true` imports analysed on the continuous girder; engineer's decision 2026-10-13, Option B of CF2; PR link added after merge)

### SW1. Self-weight on continuous imports: stiffness analysis over all spans, variable EI from `section.zones`   [calculation change: M_DC1 / V_DC1 of affected imports] [less conservative in positive moment, more conservative at the piers]
- **Applies only when** an imported payload has `M_DC1` **and** `selfWeightExcluded:true` (MCT/MIDAS steel export default) **and** a support layout with two or more spans (`member.supports` with ≥ 3 entries, or `member.spans` with ≥ 2). Built-in (non-imported) designs, imports with `selfWeightExcluded:false` (all GirderDetail payloads), and one-span imports or imports without a support layout are unchanged (simple span kept; that is correct for them).
- **Where:**
  - new function `swContinuous(ext, sel, wswOwn, Es)` after `externalSpans()` (anchor `function swContinuous(`), and display helpers `swContLabel()` / `SwContNote` just after it (anchor `function SwContNote(`);
  - `computeAll()`: anchor `const swCont=(useExt&&ext.hasDC1&&ext.swExcl)?` (after `const useExt=!!ext;`), anchor `const swM=x=>swCont?` (after `const simpleM=`), and the five DC1 expressions below; `swCont` added to the result object (only when not null);
  - `bxSuperRxPayload()` (superReactions hand-off): anchor `const swc=R.swCont;`;
  - Inputs import banner (anchor `<b>Self-weight excluded from the import</b>`) and the Camber breakdown note (anchor `sh.dc1Split==='swExcl'&&<span> The imported DC1 excludes self-weight`).
- **Before** (`computeAll`, stations / constructibility / camber / camber split):
  ```js
  const M1= (useExt&&ext.hasDC1)? ext.M_DC1(x)+(ext.swExcl? simpleM(wswAvg,x):0) : simpleM(Ld.wDC1,x)+diaM(x);
  const V1= (useExt&&ext.hasDC1)? ext.V_DC1(x)+(ext.swExcl? simpleV(wswAvg,x):0) : simpleV(Ld.wDC1,x)+diaV(x);
  const M1c=(useExt&&ext.hasDC1)? ext.M_DC1(st.x)+(ext.swExcl? simpleM(wswAvg,st.x):0) : simpleM(Ld.wDC1,st.x)+diaM(st.x);
  const V1c=(useExt&&ext.hasDC1)? ext.V_DC1(st.x)+(ext.swExcl? simpleV(wswAvg,st.x):0) : simpleV(Ld.wDC1,st.x)+diaV(st.x);
  M1: (useExt&&ext.hasDC1)? ext.M_DC1(x)+(ext.swExcl? simpleM(wswAvg,x):0) : simpleM(Ld.wDC1,x)+diaM(x),
  const Msteel = st => ... : dc1Split==='swExcl' ? simpleM(wswAvg,st.x) : ...
  ```
  `bxSuperRxPayload`: `if(e.hasDC1) dc1=[e.V_DC1(0)+(e.swExcl?half(Ld.wsw):0), -e.V_DC1(L)+(e.swExcl?half(Ld.wsw):0)];`
- **After:** every `simpleM(wswAvg,·)` / `simpleV(wswAvg,·)` above becomes `swM(·)` / `swV(·)`, with
  ```js
  const swCont=(useExt&&ext.hasDC1&&ext.swExcl)? swContinuous(inp.external, ext.sel, wswAvg, Es) : null;
  const swM=x=>swCont? swCont.M(x) : simpleM(wswAvg,x), swV=x=>swCont? swCont.V(x) : simpleV(wswAvg,x);   // SW-CONT
  ```
  and in `bxSuperRxPayload`: `e.swExcl?(swc?swc.Rspan[0]:half(Ld.wsw)):0` / `e.swExcl?(swc?swc.Rspan[1]:half(Ld.wsw)):0` (this span's end shears from the same analysis, + up). The reactions note adds the method text when continuous.
  `swContinuous` (copy the function from the file to re-apply): supports from `member.supports` (≥ 3) or cumulative `member.spans` (≥ 2), else `null`. Direct stiffness method, Euler–Bernoulli beam elements, 2 DOF per node (v, θ), knife-edge supports (v = 0) at every support, domain first → last support. Nodes = supports ∪ zone boundaries. Per element: uniform w and EI; element end forces = k·d + [wh/2, wh²/12, wh/2, −wh²/12]; inside an element M(s) = −M₁ + V₁s − ws²/2 (sagging +), V(s) = V₁ − ws (app sign, + at a left support under gravity). Exact for piecewise-uniform w and EI (no mesh error).
  - `zones` (normal case): per `section.zones` piece, bare steel A and I from `elasticProps(dims,null,null)` (the same bare-section function ST-Girder uses); w = A·0.490/144 klf — the same 0.490 kcf ST-Girder's own self-weight uses; ST-Girder has no detail factor (stiffener/connection allowance goes in "Add'l DC1", which an import with M_DC1 does not use); EI = E_s·I/144 kip-ft².
  - `constEI` (fallback, warned on screen): no usable `section.zones`, or zones that do not cover first → last support: w = ST-Girder's own area-weighted self-weight (`wswAvg`, the value used before) on every span, constant EI.
  - Display: Inputs banner and Camber note show "Self-weight method: continuous girder, variable EI … / constant EI …", the support layout ("supports at 0, 110, 250, 360 ft (spans 110 + 140 + 110 ft), span 2 selected"), the self-weight reactions of the whole girder and this span's end shears; the fallback shows "⚠ Fallback to constant EI: <reason>; the flange transitions are ignored in the self-weight moments." One-span imports show "Self-weight method: simple span, w·x(L−x)/2".
- **Problem:** the self-weight was added as a simple-span moment w·x(L−x)/2 on the selected span of a continuous import, so the pier got no self-weight negative moment and the positive moment was too large (GirderDetail example G2 span 2 with the flag forced: self-weight camber 1.89 in vs 0.30 in continuous). It fed DC1 in every check (Strength, constructibility, Service II, rating, fatigue permanent shear, bearing stiffener, reactions, camber).
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) Art. 4.4 / 4.6.2 (structural analysis of continuous girders: elastic analysis with the stiffness of the section acting at the load stage); Art. 6.10.1.5 (noncomposite DC1 on the steel section) — the bare-steel EI per zone. No load factor, resistance factor, unit or check formula changed.
- **Check case 1 (closed form, constant EI):** two equal spans L = 100 ft, w = 1.0 klf, no zones (→ constEI): M_pier = −1250.000 k-ft (= −wL²/8), R = 37.500 / 125.000 / 37.500 kip (= 0.375wL / 1.25wL / 0.375wL), M_max+ = 703.125 k-ft at 37.5 ft (= 9wL²/128 at 3L/8), V = 37.5 / −62.5 kip at the ends of span 1. One uniform zone (zones method): M_pier/(wL²/8) = −1.000000, R_int/(1.25wL) = 1.000000. Three spans 110/140/110, w = 1: M_pier = −1591.797 k-ft = three-moment equation −(L₁³+L₂³)/(4(2(L₁+L₂)+L₂)).
- **Check case 2 (variable EI):** independent force-method script (Python; redundant support moments by virtual work, ∫M·m/EI with A and I recomputed from the plates): MIDAS 2-span test (zones 0–90 / 90–150 / 150–240 ft) M_pier = −492.95 vs app −492.9 k-ft; GirderDetail example G2 (3 spans 110/140/110, 9 zones) M_pier = −412.71 / −412.71 vs app −412.7 / −412.7 k-ft. GirderDetail's own variable-EI steel moment (M_DC1steel ÷ 1.05 detail allowance), span 2: x = 0 / 35 / 70 / 105 / 140 ft: GD −412.1 / 27.9 / 164.1 / 26.5 / −412.6, app −412.7 / 27.2 / 164.2 / 27.2 / −412.7 k-ft.
- **Check case 3 (before → after, GirderDetail example G2 hand-off with `selfWeightExcluded` forced true, span 2, L = 140 ft, zones method):** self-weight M at the piers 0 → −412.7 k-ft; max positive 629.1 at 70 ft → 164.2 at 70 ft; DC1 M1 at x = 0: −2382.1 → −2794.8, max + 1561.4 → 1096.4 k-ft; V1 at ends unchanged (symmetric span: 17.98 kip either way); self-weight reactions 8.34 / 35.26 / 35.26 / 8.34 kip; Strength flexure (+M) 0.562 → 0.487; Neg flexure bottom flange 0.861 → 0.919; top flange tension 0.773 → 0.835; Service II top −LL 0.625 → 0.677; constructibility comp. flange 0.513 → 0.363; rating governing Inventory 1.335 → 1.195, Operating 1.731 → 1.549; camber self-weight 1.893 → 0.298 in, Δ_DC1 3.506 → 1.911 in, total (max) 3.804 → 2.209 in. Span 1 superReactions DC1 63.99 / 108.71 → 59.52 / 113.19 kip.
- **How verified:** JSX transpiled with @babel/standalone and every script block parsed. Node, `computeAll` main vs branch: 12 non-affected cases (built-in, diaphragms, flange transitions, L = 100 ft, exterior, GirderDetail spans 1–3, MIDAS spans 1–2, one-span import with the flag and no layout, one-span import with the flag and 2 supports) — the whole result object JSON identical; 7 affected cases (GirderDetail flag forced spans 1–3, MIDAS flag spans 1–2, both without zones → constEI): only DC1 terms change (per station M2, Mw, Ml, Mln, V2, Vw, Vl identical), superReactions DC2/DW identical. Headless Chromium main vs branch, 24 scenarios (the 20 of CF4 plus GirderDetail hand-off with the flag forced spans 1/2, MIDAS 2-span with the flag, MIDAS without zones with the flag): the 20 non-affected scenarios identical in every field (inputs, status band, every tab, autosave `stgirder.session`, Export JSON, superReactions, capacity and lldfGeom hand-offs); the 4 affected scenarios differ only in DC1-derived output (status band ratios, result tabs, superReactions DC1, capacity hand-off), inputs, autosave and Export JSON identical; export/import round trip identical; console errors identical to main (pre-existing blocked fonts and "Es blank" NaN SVG). GirderDetail → ST-Girder "Send" + open-now flow: 28/28 checks pass as file:// and over http, no console errors. Inputs banner (method, layout, fallback warning) and Camber note checked on screenshots.
- **Other copies:** none (the self-weight logic exists only in ST-Girder; PS-Beam has its own import code, not changed).
- **Open items:** the zones method uses the import's plates for the self-weight even if the user edits the ST-Girder section afterwards (the analysis is of the imported girder); overhangs beyond the end supports, if any, are not loaded (domain is first to last support).

## 2026-10-13 — PR: claude/stgirder-sw-edited-plates (SW1 follow-ups: plates edited in ST-Girder used for the selected span's self-weight; overhang note; engineer's decisions 2026-10-13; PR link added after merge)

### SW2. Continuous self-weight: the selected span uses the plates edited in ST-Girder   [calculation change: M_DC1 / V_DC1 of affected imports, only when the plates were edited or the no-zones import has flange transitions]
- **Applies only when** SW1 applies (import with `M_DC1`, `selfWeightExcluded:true` and ≥ 2 spans) **and** either (a) the import has `section.zones` and the ST-Girder Section inputs differ from what the import put there for the selected span, or (b) the import has no usable zones and the ST-Girder section has flange transitions (`useSegs`, more than one segment). Unedited imports, uniform-section no-zones imports, and everything SW1 did not touch give results identical to SW1 (main a3cbc4b).
- **"Edited" test:** `zonesToSec(inp.external, ext.sel, sec)` (the section the import writes for the selected span) is compared with the current `inp.sec`: D, tw, bft, tft, bfb, tfb, `useSegs` and, when the import has several zones on the span, every segment's xEnd, bft, tft, bfb, tfb (tolerance 1e-9). Any difference = edited.
- **Where:** `computeAll()` (anchor `const swSelPlates=(useExt&&ext.hasDC1&&ext.swExcl)?`, just before `const swCont=`); `swContinuous()` new 5th argument `selPlates` (anchors `function swContinuous(ext, sel, wswOwn, Es, selPlates){`, `// SW-ED: plates of the selected span`, `EI:(varEI? Es*p.I/144 : 1)`, `selIdx:+sel.idx||null, x0, x1, selSrc,`); display `swContLabel()`, new `swSelPlatesText()` and `SwContNote` (anchor `function swSelPlatesText(`).
- **Before (SW1):**
  ```js
  function swContinuous(ext, sel, wswOwn, Es){
      els.push({a,b,h:b-a,w:p.w,EI:(method==='zones'? Es*p.I/144 : 1)}); }
  const swCont=(useExt&&ext.hasDC1&&ext.swExcl)? swContinuous(inp.external, ext.sel, wswAvg, Es) : null;
  ```
  The imported zones were used for the self-weight on every span, whatever the ST-Girder plates were; without zones, constant EI with ST-Girder's own w on every span.
- **After:**
  ```js
  const swSelPlates=(useExt&&ext.hasDC1&&ext.swExcl)? (()=>{ ... edited (above) ...
      return {edited, Iown:segMid.bare.I,
        pieces:segP.map(g=>({a:x0+g.x0, b:Math.min(x0+g.x1, isFinite(x1)?x1:x0+g.x1), w:g.wsw, I:g.bare.I}))};
    })() : null;
  const swCont=(useExt&&ext.hasDC1&&ext.swExcl)? swContinuous(inp.external, ext.sel, wswAvg, Es, swSelPlates) : null;
  ```
  In `swContinuous`, after the zones/constEI decision:
  - zones + edited: the imported zone pieces are cut at the selected span ends and the selected span is filled with ST-Girder's segments (`segP`: w = bare A·0.490/144, I = bare I per segment, with the edited D and tw); `selSrc='edited'`. Other spans keep the imported zones.
  - zones + unedited: unchanged, `selSrc='imported'`.
  - no zones + ST-Girder flange transitions on the selected span: selected span = ST-Girder's segments (w, I per segment); other spans = ST-Girder's own self-weight `wswAvg` (as SW1) with the midspan-segment bare-steel I (`segMid.bare.I`); variable EI; `selSrc='ownSegs'`. The fallback warning stays, reworded.
  - no zones + one uniform section: unchanged constant EI, `selSrc='own'`.
  - `EI` uses E_s·I/144 whenever the pieces carry their own I (`varEI`), else 1 (constant EI) as before.
  - Display: the Inputs banner and Camber note add "Selected span plates: imported (section.zones of this span, as on the Section inputs)" / "edited in ST-Girder (the Section inputs differ from the imported section.zones of this span); the other spans keep the imported zones" / "ST-Girder's Section inputs (the import has no usable zones); the other spans use ST-Girder's own section" / "... one uniform section ...", and the label names the edited plates.
- **Problem / decision:** engineer, 2026-10-13: when the plates are edited after an import, the self-weight analysis must use the edited plates for the selected span (they are the girder being designed), other spans keep the imported zones; without zones, the edited section for the selected span and ST-Girder's own section for the others.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) Art. 4.4 / 4.6.2 (elastic analysis with the stiffness of the section at the load stage), 6.10.1.5 (DC1 on the steel section). No factor, unit or check formula changed.
- **Check case (GirderDetail example G2 hand-off, `selfWeightExcluded` forced true, span 2, bottom flange at both piers 2.0 → 2.5 in, in ST-Girder's segment table):** self-weight M at the piers −412.7 → −418.2 k-ft; max + 164.2 → 163.2 k-ft; end shears 17.98 → 18.50 kip; girder reactions 8.34/35.26/35.26/8.34 → 8.29/35.83/35.83/8.29 kip; DC1 M1 at x = 0 −2794.8 → −2800.3 k-ft; Neg flexure bottom flange 0.773 → 0.774; rating governing Inventory 1.649 → 1.647; camber self-weight 0.301 → 0.297 in, total (max) 2.231 → 2.227 in; superReactions DC1 113.55/113.48 → 114.07/114.00 kip. Independent force-method script (plates → A, I in Python, imported zones outside span 2, edited plates inside): pier moments −418.17 / −418.17 k-ft = app −418.17 / −418.17.
  - Other cases (before → after, pier self-weight moment; independent script): GD span 1, pier bottom flange 2.0 → 2.5: −412.7 → −416.1 (indep −416.10); MIDAS 2-span, web 0.5 → 0.5625 in on span 1: −492.9 → −506.3 (indep −506.30); MIDAS without zones, ST-Girder flange transitions on span 1 (0–90 ft 0.75/1.25, 90–120 ft 1.25/2.0): constant EI −446.4 → −467.2 (indep −467.21).
- **How verified:** JSX transpiled, every script block parsed. Node, `computeAll` main (a3cbc4b) vs branch: 18 cases with no edit (built-in, diaphragms, transitions, L = 100, exterior, GirderDetail spans 1–3, MIDAS spans 1–2, one-span import with the flag, GirderDetail and MIDAS with the flag unedited on all spans, both without zones) identical (whole result JSON, ignoring the new `swCont.selSrc` field); 4 edited cases change only the DC1 terms (M2, Mw, Ml, Mln, V2, Vw, Vl identical at every station). Headless Chromium main vs branch (24 scenarios + one edited scenario: GirderDetail flag forced span 2, web tw typed 0.625), 25 scenarios main vs branch: the 20 non-import/non-flag scenarios identical in every field; unedited flag imports (GirderDetail spans 1/2, MIDAS) differ only in the note text (Inputs banner, Camber, Report) and in the Optimize tab (its trial sections are edited plates, so their self-weight now follows them); the edited scenario (GirderDetail span 2, web tw typed 0.625) and the no-zones scenario (the section kept flange transitions from the previous import → ownSegs) change DC1-derived results; autosave, Export JSON and inputs identical; round trip identical; console errors identical to main. GirderDetail → ST-Girder Send + open-now flow 28/28 as file:// and http, no console errors. Inputs banner screenshot (edited) checked.
- **Other copies:** none.
- **Open items:** none.

### SW3. Overhang note   [display only]
- **Where:** `SwContNote` (anchor `Self-weight is applied between the first and last supports only`).
- **Before:** no note. **After:** the continuous self-weight note (Inputs banner, Camber note) adds "Self-weight is applied between the first and last supports only (no overhang beyond the end supports is loaded)." Engineer, 2026-10-13: leave the analysis domain as is, state it on screen.
- **Governing provision:** none. **Check case:** GirderDetail flag forced, any span: the sentence appears after the reactions.

## 2026-10-14 — PR: claude/stgirder-calc-report (Report tab: full calculation-sheet report in the Gusset Plate Rating / GirderDetail document style; engineer's request 2026-10-14; PR link added after merge)

### CR1. Tab derivations moved into shared functions   [display only] [refactor: no computed result and no on-screen content changed]
- **Where:** new top-level functions, each placed just before its tab and built from that tab's JSX unchanged: `secDerivs(R)` → `{trans, plastic, cls}` (SectionTab, anchor `const SD=secDerivs(R);`); `s2Deriv(R,psel,right)` (StressTab, anchor `{psel&&s2Deriv(`); `flexPosLines(R,p)` / `flexNegLines(R,g,hasDem)` (were `renderPos` / `renderNeg` inside FlexTab), `flexWorkedCard(R,fcSel,right)`, `flexPosCard(R)`, `flexNegCard(R)`; `shearResCard(R)`, `shearWorkedCard(R,scSel,right)`; `deckCases(d)`, `deckWorkedDeriv(R,CS,right)`; `constrWorkedDeriv(R,sel,right)`; `camberDeriv(R)`; `fatCards(R,sel,right)` → `{s1,s2,s3,s4,s5,web}` (Fatigue Steps 1–5 and the web special-fatigue card); `stiffTransDeriv(R)`, `stiffBearDeriv(R)`; `connStrDeriv(R)`, `connFatDeriv(R)`; `NOMEN_ROWS` (Nomenclature rows). `right` is the tab's station / case picker (passed by the tab, omitted by the report).
- **Before:** the same JSX inline in each tab component (e.g. `{psel&&<Deriv title="Service II stress buildup at a selected location" … right={<select …/>}> … </Deriv>}`).
- **After:** the tab renders the function's element in the same place (e.g. `{psel&&s2Deriv(R,psel,<select …/>)}`), so the element tree is the same; the report (CR2) renders the same elements' children.
- **Governing provision:** none. **Check case:** any tab, any picked station: identical to main.
- **How verified:** headless Chromium, main vs branch, 10 scenarios (built-in; flange transitions; noncomposite; exterior + 30° skew + diaphragms; a failing section (t_fb 0.75, t_ft 0.625, t_w 0.4375, L = 150 ft, d_o = 150 in, pitch 24 in); MIDAS 2-span spans 1/2; GirderDetail hand-off spans 1/2; GirderDetail with `selfWeightExcluded` span 2): the innerText **and** innerHTML (Plotly plots replaced by a marker) of every tab except Report, the status band, the title block and `stgirder.session` identical.

### CR2. Report tab: calculation-sheet report, viewer and print   [display only] [no computed result, key, saved format or hand-off changed; three optional title-block fields added]
- **Where:** `ReportTab` replaced (anchor `function ReportTab({R,inp,set}){`), with `CR_OPTS`, `CR_REFS`, `crOpts`, `CrTab`, `CrKV`, `CrT`, `CrRes`, `crGirderText`, `crDesc`, `crShort`, `crModel` (the report content), `CalcDoc`, `crToggle`, `crJump`, `crFit`, `crEsc`, `crPageCSS`, `crTitleBlock` (anchor `/* ================= CALCULATION-SHEET REPORT`); CSS: the `.cr-*` / `.crv-*` rules copied from `Gusset Plate Rating.html` (anchor `/* ===== calculation-sheet report ===== */`) plus ST-Girder additions (anchor `/* ===== ST-Girder additions`), at the end of the first `<style>` block; print host `<div id="calc-rpt" class="crdoc"></div>` after `<div id="root"></div>`; `App` passes `set={setInp}` to `ReportTab`.
- **Before:** Report tab = GirderDetail note, warnings, design summary table, key results, camber-by-load table.
- **After:** the Report tab shows a calculation sheet in the Gusset Plate Rating / GirderDetail format: section chips (Inputs, Summary, Section properties, Demands, Limit states worked, Rating, Camber, Drawings, Appendix: method — off by default, as in Gusset), Detail (governing locations worked / + every station tabulated), Expand / Collapse all, Print, side TOC; a title block (Project No / Computed by / Date; Description / Checked by / Date). Document: cover; References (AASHTO LRFD 10th Ed. (2024) articles that ST-Girder cites; AASHTO MBE Section 6A — ST-Girder does not state the MBE edition, so the report says "verify"); numbered table of contents with links; 1. Objectives (scope, demand source, GirderDetail note and known differences, warnings, items not included — all taken from existing ST-Girder text); 2. Input parameters (project, geometry, section and segments, materials, deck, loads, stiffeners / connectors / fatigue, rating factors, imported demands incl. source, producer, span, LL distribution, DC1 source, self-weight method note `SwContNote`, GirderDetail factors); 3. Summary of results (the former design summary table and key results, same values); 4. Section properties (bare / 3n / n table, cracked section, the three Section Props derivations, segments, 6.10.2 limits); 5. Demands (dead loads, HL-93 and distribution factors, Strength I combinations substituted at the governing stations, load effects at the governing stations; with Detail = every station, all stations); 6. Constructibility, 7. Service II and LL deflection, 8. Strength I flexure, 9. Shear, 10. Fatigue, 11. Stiffeners, 12. Shear connectors, 13. Deck design — each the tab derivation at the governing station (the station the tab picker opens on), followed by result lines (check, LRFD article, demand vs capacity, D/C, PASS/FAIL) from `R.checks`, plus the station tables with Detail = every station; 14. Load rating (φcφs, RF equations substituted for +M (M_n basis), shear and Service II, −M and stress-basis RF stated with the result, summary table, governing RF); 15. Camber (Camber derivation and the by-load table); 16. Drawings (cross-section and elevation SVGs); 17. Appendix (method notes from existing ST-Girder text, notation = Nomenclature rows).
  - Print: the report is rendered into `#calc-rpt` (ids prefixed `crp-`, viewer `crv-`), `@page` letter with margin boxes — top: "Project No / Description", "Computed By / Checked By", "Date / Date"; bottom: "<project>, <girder> (ST-Girder)", "Page X of Y" — then `window.print()`; `afterprint` restores the page. Display equations wider than the line are scaled down (`crFit`) so nothing is cut off. The header description is shortened to 38 characters (margin boxes do not wrap); the full text is in 2.1 and the title block.
  - Title-block fields: ST-Girder had Project, Girder, By, Date, Job No. Added **optional** report fields Description, Checked by, Check date, typed on the Report tab and stored in the session inputs as `proj.desc`, `proj.checkedBy`, `proj.chkDate` (new optional keys inside the existing `proj` object; absent until typed, so existing saved data, Export JSON and hand-offs are unchanged; no migration needed). Empty Description = "<girder>, [span k of n,] L = … ft". Report options (chips, Detail) are stored in the existing UI store `stgirder.ui.v1` under `rpt`.
- **Problem:** engineer's request (2026-10-14): the detailed derivations lived only in the tabs and never reached the report or the print.
- **Governing provision:** none (display). The derived display lines added in the report (Strength I combination substitution, DF formulas, HL-93 per lane, LL deflection, rating RF substitution) show existing R values with the formulas `computeAll` uses (`Mu=1.25*(M1+M2)+1.5*Mw+1.75*Ml`, `Vu=|1.25(V1+V2)+1.5Vw|+1.75|Vl|`, `distFactorsSteel`, `hl93`, `dLL=dfDefl*max(dTruck,0.25dTruck+dLane)`, `rf=(C−1.25dc−1.5dw)/(γ·ll)`, Service II `(fR−fD)/(1.30 fLL)`); the result shown is always R's value.
- **Check case (built-in example):** 16 sections (Appendix off), 44 subsections, 26 result lines = the 26 checks; Strength I at x = 60 ft: M_u = 1.25(2,120 + 540) + 1.50(450) + 1.75(2,503) = 8,381 k-ft; rating +M: RF_Inv = (12,163 − 1.25(2,660) − 1.50(450))/(1.75(2,503)) = 1.86, Opr 2.42, governing Inventory 1.64 (Service II) / Operating 2.14. Printed: 25 letter pages (31 with Detail = every station and the Appendix).
- **How verified:** JSX transpiled with @babel/standalone and every script block parsed. Node: `computeAll` R and `bxSuperRxPayload` JSON identical main vs branch for the 10 scenarios above (computation code untouched). Headless Chromium: every other tab identical to main (CR1); for each of the 10 scenarios the report renders every enabled section, the summary table rows and every result line equal `R.checks` (Node, same inputs: name, ref, demand, capacity, D/C, PASS/FAIL), and every number in the worked sections (1,275–1,757 per scenario, KaTeX read from its TeX annotation) is found in the matching tab's text, the inputs or a value of R rounded as shown — none untraced; TOC links resolve (55–63) and scroll; no console errors (only the pre-existing blocked web-font request). Print to PDF (Playwright `page.pdf`, print media, CSS page size) for built-in (both Detail modes), the failing case, GirderDetail span 2, GirderDetail self-weight span 2 and MIDAS span 2 (every station): header and footer boxes and "Page X of Y" present, no element wider than the 7.3 in text width, page restored after print; compared visually with a Gusset Plate Rating printed report. GirderDetail → ST-Girder Send + open-now flow (OD1 test) passes as file:// and http.
- **Other copies:** the `.cr-*` / `.crv-*` CSS and the print pattern are duplicated from `Gusset Plate Rating.html` (not changed).
- **Open items:** MBE edition not stated in ST-Girder (the report says "verify"). Plotly charts are not in the report (only the static SVG drawings). The stress-basis +M and the −M rating factors are stated with the result, not substituted (their staged stresses are not in R).

## 2026-10-14 — PR: claude/stgirder-props-location (Section Props: properties by flange segment incl. cracked, properties at any x; report section 4; engineer's request 2026-10-14; PR link added after merge)

### SP1. Section properties by segment and at any location   [display only] [no computed result, check, key or saved format changed; one UI preference added]
- **Where:** new display helpers before `secDerivs` (anchor `/* Section properties by flange segment and at any location x`): `spMidIdx`, `spSegAt` (same rule as `computeAll`'s `segIdxAt`: first segment with x ≤ x1), `spX0`, `spRange`, `spPlates`, `spGovTags`, `spAs`, `spDtop`, `spRows`, `SP_HEAD`, `spNote`, `SegPropsTable`, `PropsAtX`. `secDerivs(R)` → `secDerivs(R,si0,right)` (anchor `function secDerivs(R,si0,right){`). `SectionTab({R})` → `SectionTab({R,inp})` (App: `{tab==='section'&&<SectionTab R={R} inp={inp}/>}`). Report: `crModel` section 4 (anchor `// 4. Section properties`). CSS: `.sp-*` rules after `table.eng tr.row-fail td`, `.crdoc .cr-sp` after `.crdoc .cr-tbl tr { break-inside: avoid; }`.
- **Before:** the Section Props tab showed bare / n / 3n properties without saying where they are taken (they are the midspan segment `segMid`); the cracked negative-moment section appeared only when `R.hasNeg`, and only for the governing −M segment; the "Flange segments" card listed I bare, I n, Mp, class per segment; the derivations always worked the midspan segment; report 4.1 "Elastic section properties (midspan segment)" and a "Flange segments" table.
- **After:**
  - Card titles name the segment: "Elastic section properties at midspan — segment k of N, x = a–b ft"; the cracked (pier) card names the governing −M segment and x.
  - New card "Section properties by flange segment" (replaces the "Flange segments" card, always shown, also for one segment): for each `segP` entry — x-range (and member x for an import), plates, web, compact/noncompact, M_p, D_p — four rows: bare steel (`g.bare`), long-term 3n (`g.c3N`), short-term n (`g.cN`), cracked steel + deck rebar (`g.cr`, from `crackedSection`, already computed by `computeAll` for every segment), each A, ȳ from bottom, I, S_bot, S_top,steel, and S at the slab top (`StDeckTr`, transformed) or S at the rebar (`cr.Srb`), with A_s and its height y. Tags mark the segment of the midspan display and of each governing station: Service II (`stress.s2Gov.si`), constructibility (`constr.xGov`), Strength +M (`flex.gov.si`), Strength −M (`neg.negBGov.si`), fatigue (`fatigue.xGov`).
  - New card "Section properties at a location": span selector (multi-span import), range slider + number input for x, Midspan button; shows the segment at x, plates, b_eff, n / 3n and the same four rows (same `spRows` strings as the table). Another span than the design span is evaluated with `computeAll` on that span exactly as `publishCapacity` does (zones → `zonesToSec`), display only; the checks stay on the design span. Position stored in the existing UI store `stgirder.ui.v1` as `propsAt: {span, x}` (UI preference, not session data).
  - Derivations: segment picker on the transformed-section card (default = midspan segment, as before); the three derivation cards (transformed n / 3n / cracked, plastic moment, classification) use the picked segment's `segP` values and say which segment in their titles. Added worked steps for the 3n section (b_tr = b_eff/3n, ȳ, I, S) and the cracked section (y_r = h_s + t_h + t_s − d_top, ȳ = (A_st ȳ_st + A_s y_r)/(A_st + A_s), I = I_st + A_st(ȳ − ȳ_st)² + A_s(y_r − ȳ)², S_bot, S_top,st, S_rebar, D_c(−M)); every result shown is the `crackedSection` / `elasticProps` value.
  - Report section 4: "4.1 Elastic section properties at midspan (segment k, x = a–b ft)", cracked line names the governing −M segment and x, new "4.2 Section properties by flange segment" (the per-segment table incl. cracked, M_p, D_p and the governing tags), derivation subsections titled with their segment; the old "Flange segments" table dropped (its columns are in 4.2).
- **Problem:** engineer, 2026-10-14: say where each set of properties is taken; show the cracked section for every segment (simple spans too, informative); properties at any x.
- **Governing provision:** none (display). Formulas shown are those of `elasticProps` / `crackedSection` (transformed-area method, parallel-axis theorem); no factor, unit or code reference changed; which section each check uses is unchanged.
- **Check case (GirderDetail example G2 hand-off, span 2, segment 5, x = 123–140 ft: D = 60, t_w = 0.5625, top 18 × 1.5, bot 18 × 2.0 in; b_eff = 114 in, t_s = 8, haunch 2 in, n = 7, A_s = 9.12 in² at 4 in below the slab top):** n composite A = 227.0 in², ȳ = 52.26 in, I = 160,978 in⁴, S_bot = 3,080, S_top,st = 14,323, S_slab = 7,579 in³; cracked A = 105.9 in², ȳ = 32.53 in, I = 83,063 in⁴, S_bot = 2,553, S_top,st = 2,682, S_rebar = 2,247 in³. Independent Python parallel-axis script (datum at the slab top, measured down): same values. Built-in example (one segment): cracked I = 69,565 in⁴ shown for information (simple span).
- **How verified:** JSX transpiled, every script block parsed. Node: full `computeAll` result JSON and `bxSuperRxPayload` identical main vs branch for built-in, flange transitions, noncomposite (with and without transitions), GirderDetail hand-off spans 1–3 (multi-segment, continuous), MIDAS spans 1–2 (`computeAll` not touched). Headless Chromium, main vs branch for built-in, flange transitions, noncomposite, MIDAS span 1, GirderDetail span 2: every other tab (Inputs … Nomenclature), the status band, the saved session and the report outside section 4 identical; the per-segment table rows equal `spRows` of `computeAll(saved session)` in Node; the slider at x = 0, L/2, L, each splice, splice + 0.5 ft and 0.37L shows the expected segment (x ≤ x1 rule) and its rows equal the table rows; GirderDetail span 2 viewing span 1 equals `computeAll` with span 1 designed; the derivation picker on segment 5 shows I_n = 160,978 and I_cr = 83,063; picking span/x leaves `stgirder.session` unchanged, `stgirder.ui.v1` gets `propsAt` and the picker is restored after reload; report section 4 renders and prints (26 pages, Letter); no console errors.
- **Other copies:** none.
- **Open items:** none.

## 2026-10-14 — PR: claude/stgirder-cite-61011c (cite AASHTO LRFD 6.10.1.1.1c for the cracked negative-moment section; note in place of the negative-flexure card when the span has no −M; engineer's requests 2026-10-14; PR link added after merge)

### CT1. Code reference added: AASHTO LRFD 10th Ed. Art. 6.10.1.1.1c for the cracked section   [display only] [code reference added (CLAUDE.md §4); no number, formula, factor, unit or other citation changed]
- **Where / Before → After** (citation text only; anchors are the "before" text):
  1. `secDerivs` transformed-section card refTag: `refTag="LRFD 4.6.2.6 · 6.10.1.1.1b"` → `refTag="LRFD 4.6.2.6 · 6.10.1.1.1b · 6.10.1.1.1c"`.
  2. `secDerivs` cracked step: `r="parallel-axis theorem"` → `r="parallel-axis theorem · AASHTO LRFD 6.10.1.1.1c"`.
  3. `spRows` (per-segment table, "Section properties at a location" card, report 4.2): `row('Cracked: steel + rebar',` → `row('Cracked: steel + rebar (6.10.1.1.1c)',`.
  4. `spNote` (per-segment card hint, report 4.2 note): `', concrete neglected (crackedSection). '` → `', concrete neglected (6.10.1.1.1c; crackedSection). '`.
  5. SectionTab per-segment card: `refTag="bare · 3n · n · cracked (steel + rebar) · where each check governs"` → `refTag="bare · 3n · n · cracked (steel + rebar, 6.10.1.1.1c) · where each check governs"`.
  6. SectionTab cracked (pier) card: `refTag="steel + deck rebar · concrete neglected"` → `refTag="6.10.1.1.1c · steel + deck rebar · concrete neglected"`.
  7. `flexNegCard` refTag: `"AASHTO 6.10.8 · cracked section (steel + rebar)"` → `"AASHTO 6.10.8 · cracked section (steel + rebar, 6.10.1.1.1c)"`; hint: `<b>steel + longitudinal reinforcement</b> (concrete neglected),` → `<b>steel + longitudinal reinforcement</b> (concrete neglected, 6.10.1.1.1c),`.
  8. Report `CR_REFS` AASHTO LRFD entry: `I-section flexural members 6.10 with Appendix D6)` → `I-section flexural members 6.10 with Appendix D6; cracked section in negative flexure 6.10.1.1.1c)`.
  9. Report section 4 (`// 4. Section properties`): 4.1 tag `'bare · 3n · n · cracked'` → `'bare · 3n · n · cracked (6.10.1.1.1c)'`; 4.1 note `−M regions on the cracked steel + rebar section.` → `−M regions on the cracked steel + rebar section (6.10.1.1.1c).`; 4.2 tag `'bare · 3n · n · cracked'` → `'bare · 3n · n · cracked (6.10.1.1.1c)'`; transformed-sections tag `'LRFD 4.6.2.6 · 6.10.1.1.1b'` → `'LRFD 4.6.2.6 · 6.10.1.1.1b · 6.10.1.1.1c'`.
  10. Report section 8 negative-flexure tag: `'6.10.8 · cracked section'` → `'6.10.8 · cracked section (6.10.1.1.1c)'`.
  11. Report Appendix method note: `the cracked steel + longitudinal rebar section (concrete neglected).</li>` → `the cracked steel + longitudinal rebar section (concrete neglected; 6.10.1.1.1c).</li>`.
- **Problem:** engineer, 2026-10-14: the cracked negative-moment section (steel + longitudinal deck reinforcement within b_eff, concrete neglected) had no code reference.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) Art. 6.10.1.1.1c "Stresses for Sections in Negative Flexure": for both short-term and long-term moments the composite section consists of the steel section and the longitudinal reinforcement within the effective width of the concrete deck, except as specified in 6.6.1.2.1, 6.10.1.1.1d or 6.10.4.2.1 (text verified by the engineer). The section `crackedSection` builds is unchanged.
- **Check case:** none needed (no computed value changed). `computeAll` result and `bxSuperRxPayload` identical main vs branch (see How verified); e.g. GirderDetail G2 span 2, segment 5: cracked I = 83,063 in⁴ before and after.
- **How verified:** JSX transpiled (@babel/standalone), every script block parsed. Node: full `computeAll` JSON and `bxSuperRxPayload` identical main (a3675b8) vs branch for built-in, flange transitions, noncomposite (± transitions), GirderDetail spans 1–3, MIDAS spans 1–2. Headless Chromium, built-in and GirderDetail span 2, every tab and the Report: every differing line equals main's line once the added citation text is removed; `stgirder.session` identical; no console errors.
- **Other copies:** none. **Open items:** the input card "Negative-Moment Region — deck reinforcement" (refTag `6.10.1.7 · cracked section`), the Flexure station card heading "Negative moment — cracked section (6.10.8)" and the hand-off `basis` string (`φMn− per 6.10.8 cracked steel+rebar section`, part of the hand-off payload) were left without the new citation; the payload string is deliberately unchanged (CLAUDE.md §5).

