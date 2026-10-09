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
