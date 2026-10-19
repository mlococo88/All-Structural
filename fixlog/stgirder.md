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

### CT2. Note in place of the negative-flexure card when the span has no −M   [display only] [no computed result, check, key or saved format changed]
- **Where:** new `flexNoNegText(R)` just before `function flexNegCard(R){`; FlexTab (anchor `{R.hasNeg&&flexNegCard(R)}`); report section 8 (anchor `sub(s,'Negative flexure: pier region'`).
- **Before:** `{R.hasNeg&&flexNegCard(R)}` — nothing shown when `R.hasNeg` is false; report 8 had no −M subsection.
- **After:** `{R.hasNeg?flexNegCard(R):<Card title="Negative flexure — pier region" refTag="not checked · no −M in this span"><div className="hint">{flexNoNegText(R)}</div></Card>}`; report: `else if(!R.hasNeg) sub(s,'Negative flexure: pier region','not checked · no −M in this span',<p className="cr-note">{flexNoNegText(R)}</p>);`. Text: built-in analysis — "Simple span — no negative moment. ST-Girder analyses a single simple span." import without −M — "No negative moment in this span: the imported demands produce no factored negative moment in this span."; then both: "The pier-region checks apply only where the factored moment is negative: Strength I negative flexure (6.10.8, on the steel + longitudinal deck reinforcement section, concrete neglected, 6.10.1.1.1c), the 1% longitudinal deck reinforcement (6.10.1.7), the Service II web bend-buckling check (−M) and, in a continuous span, the 1.3R_hM_y limit on M_n (6.10.7.1.2)."; built-in only: "To check a continuous girder's pier region, import continuous demands from GirderDetail (Send to ST-Girder) or MCT/MIDAS." (Matches the code: `hasNeg = MunPeak < −1`; the 1% rebar and web bend-buckling checks are pushed only when `hasNeg`; the 1.3R_hM_y cap applies when `useExt && hasNeg`.)
- **Problem:** engineer, 2026-10-14: the card silently disappeared for a simple span.
- **Governing provision:** none changed (cites 6.10.8, 6.10.1.1.1c, 6.10.1.7, 6.10.7.1.2 as already used by the tool).
- **Check case:** built-in example: Flexure tab ends with the note card; report 8.3 "Negative flexure: pier region" shows the note. GirderDetail span 2 (has −M): unchanged.
- **How verified:** as CT1 (Node R identical; headless Chromium: built-in Flexure and Report differ from main only by the note lines; GirderDetail span 2 only by the CT1 citations; no console errors); import-without-−M wording checked by evaluating `flexNoNegText({useExt:true})` in Node (no example import without −M at hand). Screenshot of the built-in Flexure tab checked.
- **Other copies:** none. **Open items:** none.

## 2026-10-14 — PR: claude/stgirder-mp-links (Section Props: M_p fully worked per Table D6.1-1; links from quoted values to their derivations; engineer's requests 2026-10-14; PR link added after merge)

### MP1. Plastic moment M_p worked in full (Table D6.1-1)   [display only] [no computed result changed; code references added to the card (CLAUDE.md §4)]
- **Where:** `plasticMoment` (anchor `function plasticMoment(sec, mat, deck){`): also returns `Ybar`, `arm` (the moment arms it already computed: `{ds,dc,dt}` Case I, `{ds,dw,dt}` Case II, `{dc,dw,dt}` deck case) and `off` (t_s + t_h, or 0 without a deck). `Mp`, `PNA`, `Dp`, `Dt`, `Dcp` and every expression are unchanged. Before: `let region,PNA,Mp,Dcp;` with `const Ybar=…` and `const ds=…, dc=…` local to each branch, `return {region,PNA,Mp,Dcp,Dp:PNA,Dt,Ps,Pc,Pw,Pt};`. After: `let region,PNA,Mp,Dcp,Ybar,arm;`, `Ybar=…` (same expressions), `arm={ds,dc,dt}` etc. at the end of each branch, `return {region,PNA,Mp,Dcp,Dp:PNA,Dt,Ps,Pc,Pw,Pt,Ybar,arm,off};`.
- **Where (display):** `secDerivs`, the `plastic` card (anchor `// Plastic moment worked per Table D6.1-1`). Before: plastic forces as results only, "PNA lies in the <region> ⇒ ȳ_PNA = … in below top of slab", "M_p = ΣP_i d_i = … kip-ft   D_p/D_t = …". After, for the segment picked on the tab (midspan segment by default, as before):
  1. Plastic forces, each symbolic → substituted → result (P_s = 0.85 f′_c b_eff t_s; P_c = F_yc b_ft t_ft; P_w = F_yw D t_w; P_t = F_yt b_fb t_fb); deck reinforcement neglected (P_rb = P_rt = 0, permitted by D6.1).
  2. The Table D6.1-1 conditions with values, in the table's order: Case I P_t + P_w ≥ P_c + P_s; Case II P_t + P_w + P_c ≥ P_s; otherwise Cases III–VII (with P_rb = P_rt = 0 these give the same Ȳ and M_p) — the same tests, in the same order, as `plasticMoment`.
  3. Ȳ for that case symbolic → substituted → result (Case I (D/2)[(P_t − P_c − P_s)/P_w + 1]; Case II (t_ft/2)[(P_w + P_t − P_s)/P_c + 1]; deck t_s(P_c + P_w + P_t)/P_s) and D_p from it.
  4. Moment arms d_s, d_c, d_w, d_t (those of the case) = |D_p − depth of the element force|, with values.
  5. M_p for the case symbolically, substituted, = … kip-in = …/12 k-ft.
  6. D_t = t_s + t_h + t_ft + D + t_fb, D_p/D_t, D_cp (D6.3.2-1 with A_rs = 0 for Case I composite, D6.3.2-4 for Case I noncomposite, 0 otherwise).
  7. Composite deck only: M_n of the segment (6.10.7.1.2-1 or -2, the segment's `Mn_kft`) and D_p ≤ 0.42D_t (6.10.7.3-1); note that the 1.3R_hM_y limit of continuous spans is worked in the Flexure tab.
  Noncomposite: the P_s and d_s terms are left out (P_s = 0, as in the code).
- **Problem:** engineer, 2026-10-14: the M_p derivation showed forces, region and the result without the work.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) Appendix D6.1 and Table D6.1-1 (positive flexure, Cases I–VII); D6.3.2 (Eqs. D6.3.2-1, D6.3.2-4); 6.10.7.1.2 (Eqs. 6.10.7.1.2-1, -2, -3); 6.10.7.3 (Eq. 6.10.7.3-1). Checked against the 10th Ed. text. Code references added to the card: Table D6.1-1, D6.3.2-1, D6.3.2-4, 6.10.7.1.2-1/-2/-3, 6.10.7.3-1 (the card previously cited "Appendix D6.1" and "D6.1"). No formula, factor or unit changed.
- **Check case (built-in example, F_y = 50 ksi, f′_c = 4 ksi, b_eff = 108 in, t_s = 8 in, t_h = 2 in, web 66 × 0.5, top 16 × 0.75, bottom 18 × 1.25 in):** P_s = 0.85·4·108·8 = 2,937.6; P_c = 600; P_w = 1,650; P_t = 1,125 kip. Case I: 2,775 < 3,537.6 → no; Case II: 3,375 ≥ 2,937.6 → yes. Ȳ = (0.75/2)[(1,650 + 1,125 − 2,937.6)/600 + 1] = 0.273 in; D_p = 8 + 2 + 0.273 = 10.273 in; d_s = 6.273, d_w = 33.477, d_t = 67.102 in; M_p = (600/1.5)[0.273² + 0.477²] + 2,937.6·6.273 + 1,650·33.477 + 1,125·67.102 = 149,275 kip-in = 12,440 k-ft; D_t = 78.000 in; D_p/D_t = 0.1317 > 0.1 → M_n = 12,440(1.07 − 0.7·0.1317) = 12,163 k-ft; D_p ≤ 0.42D_t = 32.76 ✓. Before and after: the same M_p, D_p, D_t, M_n (only the display changed).
- **How verified:** independent Python script (PNA by bisection on the net plastic force of rectangular layers, M_p by direct summation; does not use Table D6.1-1): D_p, D_t, M_p and M_n equal to the app's values (rel. 1e-6) for the built-in example (Case II), GirderDetail G2 span 2 segments 1–5 with the harness deck (Case II), noncomposite (Case I), a light girder with the PNA in the deck (Cases III–VII: M_p = 4,211, M_n = 4,190 k-ft) and a heavy bottom flange (Case I composite: M_p = 21,688 k-ft). Node: `computeAll` JSON identical main vs branch for 9 cases except the three added fields; M_p re-summed from the returned `Ybar` and `arm` equals `Mp` for every segment. Headless Chromium: the numbers on the card contain the hand-check values; every other tab unchanged.
- **Other copies:** none. **Open items:** (a) For a noncomposite section with the PNA in the top flange, D6.3.2 gives D_cp = D ("all other noncomposite sections"); `plasticMoment` returns 0 (affects the web compactness flag and R_b only for a noncomposite girder whose top flange is heavier than web + bottom flange). Not changed; needs the engineer's decision. (b) `flexPosCard` quotes D_p and D_t of the midspan segment (`R.pl`) with M_p of the governing +M segment (`R.flex.Mp_kft`); the same when the governing segment is the midspan one (all test cases). Display only; not changed.

### LK1. Links from quoted values to where they are worked (CLAUDE.md §6)   [display only] [no computed result, key, saved format or hand-off changed]
- **Where:** new `DL_T`, `sgI`, `CrRefCtx`, `stgGoto`, `DLinks` (anchor `/* Links from a quoted value to the card where it is worked`); CSS `.dl-row`, `button.dl`, `a.dl`, `.card.dl-flash` (anchor `/* Links to where a quoted value is worked`). `Card` and `Deriv` take an optional `id`. `App`: `go` state, `stg-goto` listener, scroll + flash (anchor `// Derivation links (DLinks)`); `SectionTab({R,inp,go})` sets its derivation-segment picker from a link. Report: `tag(s,key)` in `crModel` names subsections; `CalcDoc` builds the number map and provides `CrRefCtx`.
- **Before:** values derived on another tab were quoted without a pointer to the derivation.
- **After:** a small "Worked in: <value> → <Tab · Card>[, segment k]" line (one link style) under the quoting equation. Clicking switches the tab, picks the segment in the Section Props derivations, scrolls to the card and flashes it; inputs, results and saved data are untouched (only the tab and that picker change). In the calculation report the same line reads "<value>: see §n.k" (internal link to the numbered subsection; prints as text); a value of a segment other than the worked (midspan) one points to §4.2 (properties by flange segment) "(segment k)". The line is hidden in the on-screen print (`noprint`).
  Card ids: `stg-d-trans`, `stg-d-plastic`, `stg-d-cls`, `stg-d-segs` (Section Props), `stg-d-menv`, `stg-d-venv` (Diagrams), `stg-d-flexpos`, `stg-d-flexneg` (Flexure), `stg-d-shear` (Shear), `stg-d-s2` (Stresses). Report keys: `props.seg` (4.2), `props.trans`, `props.plastic`, `props.cls` (4.3–4.5), `dem.effects` (load effects at the governing stations), `serv.s2`, `flex.pos`, `flex.neg`, `shear.res`.
  Links added:
  1. Section Props, Plastic moment: M_n → Flexure · Positive-flexure resistance ("Used in").
  2. Section Props, Classification: D_cp → Plastic moment; D_c (n section, used in R_b) → Transformed sections.
  3. Flexure, top results: M_p, D_p, D_t → Plastic moment (governing +M segment).
  4. Flexure, worked station (+M): compact — M_p, D_p, D_t → Plastic moment (that station's segment), M_u → Diagrams · Moment envelope; noncompact — R_b, R_h → Classification, D_c, S → Transformed sections.
  5. Flexure, worked station (−M): cracked-section D_c, S_bot → Transformed sections; R_h → Classification.
  6. Flexure, Positive-flexure resistance: M_p, D_p, D_t → Plastic moment; M_u → Moment envelope; noncompact/noncomposite: R_b, R_h → Classification.
  7. Flexure, Negative flexure: cracked section → Transformed sections (governing −M segment); −M_u → Moment envelope.
  8. Stresses, Service II buildup: S_b (bare) → Properties by flange segment; S_b (3n, n) → Transformed sections; stage moments → Moment envelope; R_h → Classification; S_b,cr → Transformed sections (when −M).
  9. Stresses, LL deflection: I (n, midspan segment) → Transformed sections.
  10. Shear, worked station: V_u → Diagrams · Shear envelope.
  11. Constructibility, worked station: bare-steel S → Properties by flange segment; R_h → Classification.
  12. Camber: I (bare, 3n) → Properties by flange segment; DC1, DC2, DW moments → Moment envelope.
  13. Fatigue Step 4: S_x (n) → Transformed sections (station's segment).
  14. Connectors, fatigue pitch: I (n) → Transformed sections.
  15. Rating: flexure capacity → Positive-flexure resistance; −M capacity → Negative flexure; shear capacity → Shear resistance; Service II stresses → Service II buildup; DC, DW, LL+IM → Moment envelope.
  The report gets the same links wherever it reuses these cards (sections 4, 6–10, 12 and 15).
- **Problem:** engineer's guideline 2026-10-14 (CLAUDE.md §6): link every quoted value to its derivation, in the app and as "see §x.y" in the report.
- **Governing provision:** none (navigation and text). **Check case:** built-in example, Flexure tab: "M_p, D_p, D_t → Section Props · Plastic moment" opens Section Props at the Plastic moment card; report 8.1 reads "M_p, D_p, D_t: see §4.4; M_u: see §5.4".
- **How verified:** headless Chromium, main vs branch, 5 scenarios (built-in, noncomposite, PNA in the deck, PNA in the web, GirderDetail span 2): every tab differs from main only by the added link lines (plus the MP1 card); `stgirder.session` identical and unchanged after clicking every link on Flexure, Stresses, Fatigue and Rating (21 links for GirderDetail span 2: each lands on the named tab with the named card in view and, for Section Props, the named segment picked); every report "see §" link (18–27 per scenario) resolves to the subsection it names; no console errors. Node: `computeAll` and the reactions payload identical (MP1).
- **Other copies:** none. **Open items:** not linked (worked in place or with no derivation elsewhere): F_nc/FLB/LTB (worked on the card that uses it), M_y and the 1.3R_hM_y limit, f_bu of the Strength I flange stresses card, the distribution factors on the Inputs tab (worked in report §5 only, built-in analysis), the Optimize and Deck tabs.

## 2026-10-14 — PR: claude/stgirder-flexpos-seg (MP1 open items resolved; engineer's decisions 2026-10-14; PR link added after merge)

### MP1 open item (a) — D_cp of a noncomposite section with the PNA in the top flange: resolved, no change
- **Decision (engineer, 2026-10-14):** keep D_cp = 0. In positive flexure with the plastic neutral axis in the top (compression) flange, the whole web is in tension, so the depth of web in compression at M_p is physically zero. D6.3.2 (Eqs. D6.3.2-1 / -2) gives D_cp for composite sections with the PNA in the web.
- **Note for the record:** the 10th Ed. text of D6.3.2 also has a noncomposite clause (Eq. D6.3.2-3 condition F_yw A_w ≥ |F_yc A_c − F_yt A_t|, Eq. D6.3.2-4, and "for all other noncomposite sections, D_cp shall be taken equal to D"). Read literally, that clause gives D for this case; the engineer's decision rests on the physical argument above. `plasticMoment` and the display are unchanged.

### FP1. Positive-flexure resistance card: D_p, D_t and PNA of the governing +M segment   [display only] [no computed result changed]
- **Where:** new `flexGovPl(R)` before `function flexPosCard(R){`; `flexPosCard` and `FlexTab` (anchor `const f=R.flex, pl=`).
- **Before:** `const f=R.flex, pl=R.pl, …` in both — `R.pl` is the midspan segment's plastic record, quoted next to `f.Mp_kft` / `f.Mn_kft` of the governing +M segment (`segP[posGov.si||0]`).
- **After:** `pl=flexGovPl(R)` = `R.segP[(R.flex.gov.si)||0].pl` (the same segment as `Mp_kft`, `Mn_kft`, `ductOK` and the Ductility check). Affects the PNA region, D_p, D_t in the M_n line and the "Plastic moment Mp" and "Ductility Dp / 0.42Dt" result boxes of the Flexure tab, and report 8.1.
- **Problem:** MP1 open item (b): mixed segments when the governing +M station is not in the midspan segment. Engineer, 2026-10-14: quote the governing segment throughout.
- **Governing provision:** none changed (6.10.7.1.2 display).
- **Check case (flange transitions 0–45 ft top 16 × 0.75, bottom 14 × 0.875; 45–75 ft top 16 × 1.0, bottom 22 × 2.0; 75–120 ft as 0–45; otherwise built-in; governing +M at x = 45 ft, segment 1; midspan segment 2):** before — "M_p = 9,544 k-ft (PNA in Web)", M_n = 9,544(1.07 − 0.7·13.2/79.0) = 9,542, Ductility 0.40 (13.2 / 33.2 in) — the PNA and D_p/D_t were segment 2's; after — "PNA in Slab", M_n = 9,544(1.07 − 0.7·7.8/77.6) = 9,542 k-ft (hand: D_p/D_t = 7.80/77.63 = 0.1005, 9,544 × 0.99965 = 9,541), Ductility 0.24 (7.8 / 32.6 in), equal to the Ductility check. M_p, M_n and D/C unchanged.
- **How verified:** JSX transpiled. Node: `computeAll` and the reactions payload identical to main for the 9 standard cases. Headless Chromium, main vs branch: built-in example — Section Props, Flexure, Rating and Report text identical; the case above — only the PNA region, D_p, D_t and the ductility box lines differ (Flexure tab and report 8.1); no console errors; Flexure card screenshot checked.
- **Other copies:** none. **Open items:** none.

## 2026-10-14 — PR: claude/stgirder-dcp-noncomp (D_cp of noncomposite sections per D6.3.2-3/-4; engineer's decision 2026-10-14, reversing the earlier "no change"; PR link added after merge)

### DC1. D_cp for noncomposite sections per AASHTO LRFD 10th Ed. D6.3.2   [CALC CHANGE — engineer-approved] [composite sections unchanged]
- **Where:** `plasticMoment` (anchor `// Noncomposite section: D_cp per D6.3.2`), just before `const Dt=`; display in `secDerivs` plastic card, step "Depths D_t, D_p/D_t and D_cp" (anchor `D6.3.2-3`).
- **Before:** noncomposite Case I (PNA in web): `Dcp=clamp(Ybar,0,D)`; noncomposite Case II (PNA in the top flange, F_yc A_c > F_yt A_t + F_yw A_w): `Dcp=0`.
- **After:** added `if(!deckOn && !(Pw >= Math.abs(Pc-Pt))) Dcp=D;`. When Eq. D6.3.2-3 holds (F_yw A_w ≥ |F_yc A_c − F_yt A_t|, PNA in the web) D_cp is unchanged: Eq. D6.3.2-4, D_cp = D/(2A_wF_yw)·(F_yt A_t + F_yw A_w − F_yc A_c), is algebraically the Case I Ȳ already used. Otherwise ("all other noncomposite sections") D_cp = D; this changes only the PNA-in-top-flange case (0 → D); PNA in the bottom flange already gave D (clamp). The card now shows the D6.3.2-3 test with values and the branch taken (Eq. -4 substituted, or D_cp = D).
- **Problem / decision:** MP1 open item (a). Engineer, 2026-10-14: follow the 10th Ed. D6.3.2 text for noncomposite sections. (Supersedes the "resolved, no change" note of the claude/stgirder-flexpos-seg entry.) Less favorable: the web can no longer be classed compact through D_cp = 0.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) Appendix D6.3.2, Eqs. D6.3.2-3 and D6.3.2-4; web compactness 6.10.6.2.2 (λ_pw = 3.76√(E/F_yc)); R_b 6.10.1.10.2.
- **Check case (noncomposite, built-in otherwise; F_y = 50 ksi, web 66 × 0.5, top flange 24 × 2.0, bottom 12 × 0.75 in):** P_c = 50·24·2 = 2,400; P_w = 50·66·0.5 = 1,650; P_t = 50·12·0.75 = 450 kip. Case II (P_c > P_t + P_w = 2,100): PNA in the top flange. D6.3.2-3: 1,650 < |2,400 − 450| = 1,950 → not satisfied. D_cp: before 0, after D = 66.000 in. 2D_cp/t_w: 0 → 264.0 vs λ_pw = 3.76√(29,000/50) = 90.6 → web compact → noncompact. R_b: 1.000 → 1.000 (elastic 2D_c/t_w = 2·18.20/0.5 = 72.8 ≤ λ_rw = 5.7√(29,000/50) = 137.3, so 6.10.1.10.2 gives R_b = 1 either way). Section stays NONCOMPACT (noncomposite). No check ratio changes. Same result for web 48 × 0.4375 (D_cp 0 → 48.0, 2D_cp/t_w 219.4, R_b 1.000, 2D_c/t_w = 52.2).
  Unchanged case (noncomposite, built-in plates: top 16 × 0.75, web 66 × 0.5, bottom 18 × 1.25): 1,650 ≥ |600 − 1,125| = 525 → Eq. D6.3.2-4: D_cp = 66/(2·1,650)·(1,125 + 1,650 − 600) = 43.500 in, before and after.
- **How verified:** JSX transpiled. Node, main (5818ad1) vs branch: full `computeAll` JSON and the reactions payload identical for all 9 standard cases (built-in, transitions, noncomposite with and without transitions, GirderDetail spans 1–3, MIDAS spans 1–2) and for noncomposite heavy-bottom-flange and PNA-in-web cases; in the heavy-top-flange cases only `pl.Dcp` and `compactWeb` differ (no check, R_b or rating value). Headless Chromium, main vs branch (built-in, noncomposite, GirderDetail span 2, heavy top flange): composite scenarios identical in every tab; noncomposite built-in differs only by the new D6.3.2-3 lines on the card (D_cp 43.500 unchanged); heavy top flange differs only in the D_cp lines and the classification (2D_cp/t_w, compact → noncompact web); saved data identical; no console errors.
- **Other copies:** none.
- **Open items (not changed, reported to the engineer):** (1) Composite positive flexure: the code gives D_cp = clamp(Ȳ, 0, D); if P_t > P_c + P_s + P_w (PNA below the web, outside Table D6.1-1 Cases I–VII) that is D, whereas D6.3.2 reads "all other composite sections in positive flexure, D_cp = 0". Not reachable with ordinary proportions. (2) Composite negative flexure (Eq. D6.3.2-2 / else D) is not implemented: ST-Girder computes no negative-flexure plastic moment and R_b for −M uses the elastic D_c of the cracked section with the web taken as noncompact (conservative), so D_cp is not used there.

## 2026-10-14 — PR: claude/stgirder-pna-below-web (composite positive flexure with the PNA below the web: outside the scope of the app; engineer's decision 2026-10-14; PR link added after merge)

### OOS1. PNA below the web — results that use M_p / D_p / D_cp suppressed, verdict forced to "Not all checks pass"   [BEHAVIOUR CHANGE — result suppressed] [no formula, factor or unit changed; normal sections unchanged]
- **Where (anchors):**
  - `plasticMoment`: `const belowWeb = deckOn && Pt > Ps+Pc+Pw;` before the `return`, which now ends `...(belowWeb?{belowWeb:true}:{})`.
  - `computeAll`, segment map: `ductOK:… , wsw:… , ...(pl_.belowWeb?{oos:true}:{})`; new `const pnaOOS=…; const oos=…;` (anchor `// PNA-OOS (2026-10-14)`).
  - `computeAll`, Strength I flexure loop: `const capPos = sg.oos? null : …`; `const posC = sg.oos? {oos:true, compact:false, Mu:st.Mu, capPos:null, dc:NaN} : …`; `if(st.Mu>0&&!sg.oos){` (OOS stations do not enter `posGov`).
  - `computeAll`, before `const checksF=`: `if(oos){ … }` sets the `Flexure` and `Ductility` check rows to `oos:true, v/lim/r = NaN` (so `pass` is false), `flex.oos/flexDC/phiMnRep/ductOK`, `rating.oos/flexInv/flexOpr/flexBasis/capM/govInv/govOpr`. Return adds `...(oos?{pnaOOS}:{})`.
  - Display: `PNA_OOS_HEAD`, `PNA_OOS_NOT`, `pnaOosSegs`, `pnaOosText`, `PnaOos`, `OOS_TXT` (anchor `/* PNA-OOS (2026-10-14)`), CSS `.callout.oos`; status band (chips of OOS checks read "OUT OF SCOPE", an "Out of scope: PNA below the web" chip after the verdict, the full note under the band); Flexure tab (note, result boxes, chart note, `flexPosCard`, new `flexWorkedCardOos` for an OOS station); Section Props (note, midspan result boxes, segment table and properties-at-x Mp/Dp/compact, plastic-moment card stops after the case test with the OOS note, classification card 2D_cp/t_w, R_b, web compactness); `CrossSection` (no PNA line); Rating tab (note, governing RF boxes, +M row); report (objectives note, summary table rows, key results, conclusion, `CrRes`, per-segment table, flexure all-stations table, rating +M and governing RF); `publishCapacity` (blocked with a message, nothing written).
- **Before:** P_t > P_s + P_c + P_w satisfies Case I (P_t + P_w ≥ P_c + P_s), so `plasticMoment` extrapolated Case I: Ȳ > D, D_p > D_t possible, M_p from the Case I expression, D_cp = clamp(Ȳ,0,D) = D. Those values fed the compact classification, M_n or the stress basis (R_b from D_cp), the ductility check, the +M rating and the capacity hand-off.
- **After:** the segment is flagged; every result that uses its M_p, D_p or D_cp reads OUT OF SCOPE (no PASS/FAIL number); the overall verdict is "Not all checks pass" with an out-of-scope note; no silent fall-back to the stress basis. All other checks (proportions, constructibility, Service II, deflection, fatigue, −M flexure, shear, stiffeners, studs, deck) are computed and shown as before. The flag needs a composite deck (`deckOn`); noncomposite sections are covered by D6.3.2 ("all other noncomposite sections", D_cp = D) and their +M check does not use M_p.
- **Scope choice:** when any segment is OOS the span-wide +M flexure and ductility checks and the +M / governing ratings are all OOS (the governing value over the span cannot be established without that segment). Stations in other segments keep their +φM_n on the Flexure chart and in the worked-station card. **Confirmed by the engineer, 2026-10-14** (the same rule is applied in GirderDetail, PR #225). Documentation only; no code changed.
- **Problem / decision:** outside Table D6.1-1 and D6.3.2; the extrapolated Case I overstates M_p (check case: 16,740 vs 15,184 k-ft by direct force balance, +10%). Engineer, 2026-10-14: do not allow it, treat as outside the scope of the app.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) Appendix D6.1, Table D6.1-1 (Case I condition P_t + P_w ≥ P_c + P_s; Ȳ ≤ D only when P_t ≤ P_c + P_s + P_w with P_rb = P_rt = 0); Appendix D6.3.2 (D_cp); 6.10.6.2.2, 6.10.7.1.2, 6.10.7.3; MBE 6A.4.2.
- **Check case TC1 (built-in example with t_s = 7 in, b_eff = 48 in entered, bottom flange 24 × 3.0 in; F_y = 50 ksi, f′_c = 4 ksi, web 66 × 0.5, top 16 × 0.75, haunch 2 in, L = 120 ft):** P_s = 0.85·4·48·7 = 1,142.4; P_c = 50·16·0.75 = 600; P_w = 50·66·0.5 = 1,650; P_t = 50·24·3 = 3,600 kip. P_s + P_c + P_w = 3,392.4 < 3,600 → PNA below the web. Case I extrapolated: Ȳ = 33[(3,600 − 600 − 1,142.4)/1,650 + 1] = 70.152 in > D = 66; D_p = 79.902 in > D_t = 78.750 in; M_p = 16,739.7 k-ft; D_cp = D = 66. (Direct force balance: PNA 2.914 in above the bottom of the steel, in the bottom flange, M_p = 15,183.7 k-ft.)
  Before: Strength flexure (+M) 0.808 PASS (noncompact, stress basis, f_bu 40.41 / 50.00 ksi); Ductility 2.416 FAIL; flexure RF Inv/Opr 1.859 / 2.410; governing RF 1.859 / 2.410; capacity published with +φM_n = 22,050 k-ft at every station. 22 of 26 checks pass.
  After: Strength flexure (+M) OUT OF SCOPE; Ductility OUT OF SCOPE; flexure and governing RF OUT OF SCOPE; capacity not sent (message); 21 of 26 pass; verdict "Not all checks pass". All other check ratios identical.
  TC2 (same, flange transitions: bottom flange 24 × 2 at 0–30 and 90–120 ft (P_t = 2,400, PNA in the web, Ȳ = 46.152 in), 24 × 3 at 30–90 ft): only segment 2 (x = 30–90 ft) is flagged; Flexure 0.793 PASS → OUT OF SCOPE, Ductility 2.416 FAIL → OUT OF SCOPE, RF 1.928 / 2.500 → OUT OF SCOPE; +φM_n not drawn at the 12 stations of segment 2 (13 others unchanged).
- **How verified:** see the PR description (Node: full `computeAll` JSON and reactions payload identical main vs branch for the standard cases; headless Chromium main vs branch on every tab; screenshots of the OOS case).
- **Other copies:** none in this tool. GirderDetail (`Steel Bridge Beam Modules.html`) has its own plastic-moment code with the same gap (reported, not changed: one tool per PR).
- **Open items:** none for ST-Girder.

## 2026-10-15 — PR: claude/gd-st-owner-rules (GD49: the bridge owner's load rules from GirderDetail applied to ST-Girder's checks; cross-tool PR with Steel Bridge Beam Modules.html and HANDOFF.md §4.9; engineer decision 2026-10-15; PR link added after merge)

### GD49. Owner load rules from GirderDetail (`ownerRules`)   [LOAD FACTOR AND SECTION PROPERTY CHANGE for GirderDetail imports carrying ownerRules — §4 callout]
- **Where:** new `LF_ST`, `ownLFOf`, `lfFac`, `lfS`, `lfP`, `llD`, `ownLines`, `OwnBanner` (anchor `/* Owner load rules from GirderDetail (GD49`); `buildExternal` (`hasPL`, `M_PLpos`, `M_PLneg`, `V_PLq`); `computeAll`: `OWN`, `gDC = 1.25η`, `gDW = 1.50η`, `gLL = 1.75ηm`, `gS2 = 1.30m`; `deck` with `haunch: 0` when `OWN.h0` (properties only; `loadsCalc` keeps `inp.deck`); `plOn`; stations `MlD, MlnD, VlD` (= Ml, Mln, Vl without a pedestrian part) and `Mu, Mun, Vu` with the owner factors; `stageF(…, des)`; Service II `stageF(st,1,1,1,gS2,true)`; `yieldMy` (factored permanent with η); `fStg`/`fStr`; `rating.target`; result fields `lf`, `deckIn`. Displays: Stresses (Service II factor), Diagrams (other-span envelopes and callouts), Flexure (factored components), Shear note, Rating tab (target), report (1. Objectives list, 2. Input parameters "Owner load rules (from GirderDetail)" with the factors worked, Demands "Load combinations (owner load rules …)", Rating target line, Appendix), `CrossSection` (drawn with the entered haunch), banner on every tab, pull dialog / auto-load summary line, `gdCheck` validation of `ownerRules` and `M_PL…`/`V_PL…`.
- **Before:** `const Mu =1.25*(M1+M2)+1.5*Mw+1.75*Ml; … const Vu=Math.abs(1.25*(V1+V2)+1.5*Vw)+1.75*Math.abs(Vl);`, `stageF(st,1,1,1,1.30)`, `stageF(st,1.25,1.25,1.5,1.75)`, `const deck={...deck0, beff, fc:+deck0.fc};`.
- **After:** `const Mu =gDC*(M1+M2)+gDW*Mw+gLL*MlD; … const Vu=Math.abs(gDC*(V1+V2)+gDW*Vw)+gLL*Math.abs(VlD);`, `stageF(st,1,1,1,gS2,true)`, `stageF(st,gDC,gDC,gDW,gLL,true)`, `const deck={...deck0, beff, fc:+deck0.fc, ...(OWN.h0?{haunch:0}:{})};`. Without `ownerRules` every factor is exactly 1.25, 1.5, 1.75, 1.30 (× 1) and MlD = Ml: results bit-identical.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) 1.3.2.1 (Eq. 1.3.2.1-2), Table 3.4.1-1, 3.6.1.6; RIDOT BDM (April 2026) 1.3.1–1.3.3, 3.4.1.2, 6.5.1, 9.4.6; MassDOT LRFD Bridge Manual Part I 3.1.4.4, 3.5.1.2; CTDOT BRSDM V2 1.3.3–1.3.5, V1B Load Ratings; MBE 6A (rating unchanged).
- **Check case 1 (built-in example, RIDOT, η_I = Yes, G2 span 1, x = 44 ft; M_DC1 = 1001.73, M_DC2 = 192.87, M_DW = 159.74, M_LL+IM = 1814.29 kip-ft; η = 1.05, m = 1.2):**
  - Before: M_u = 1.25(1194.60) + 1.50(159.74) + 1.75(1814.29) = 1493.25 + 239.61 + 3175.01 = **4907.87** kip-ft (tool 4907.88).
  - After: M_u = 1.3125(1194.60) + 1.575(159.74) + 2.205(1814.29) = 1567.91 + 251.59 + 4000.51 = **5820.01** kip-ft (tool 5820.02); GirderDetail Structural analysis Strength I at the same x: 5820.03.
  - Strength flexure (+M) 0.509 → 0.627 (φM_n 9635 → 9289: haunch 0 and the 1.3R_hM_y cap with η); Neg flexure bottom flange 0.910 → 1.055 FAIL; Service II top 0.653 → 0.718; LL deflection 0.346 → 0.369 (haunch 0 only); inventory RF 1.205 → 1.190 (haunch 0 only), target 1.10 met.
- **Check case 2 (xsA, RIDOT, G1 exterior, 75 psf pedestrian load added to LL+IM, x = 44 ft; M_DC1+DC2 = 1599.79, M_DW = 288.97, M_LL+IM+PL = 1963.80, M_PL = 307.06 kip-ft):** LL+IM used = 1963.80 − 307.06 + 307.06/1.2 = 1912.62; M_u = 1.3125(1599.79) + 1.575(288.97) + 2.205(1912.62) = 2099.72 + 455.13 + 4217.33 = **6772.18** kip-ft (tool 6772.18; GirderDetail 6772.18). Before 5869.84. Inventory RF 0.717 < 1.10: "below the target" (reported).
- **Check case 3 (old payloads):** GirderDetail payloads without `ownerRules` (main build: built-in RIDOT G2, xsA RIDOT G1, built-in AASHTO G2) and the new payloads with `ownerRules` removed: every check, rating, station envelope, section property: **identical** to main. New AASHTO payload (η = 1, m = 1, haunch as entered): identical.
- **How verified:** Babel transform of the JSX block; headless Chromium, main vs branch, the payloads auto-applied through `#gdpull`, `computeAll` JSON compared; GirderDetail → ST-Girder auto-open test 28/28 (http and file); banner, Rating and report text checked; no console errors.
- **Other copies:** none.
- **Open items:** the Deck tab (transverse deck design) is not changed by the owner rules (ask: should RIDOT's multiplier and η apply to the deck slab design too?); the owner rules apply only while GirderDetail's demands are in use (the built-in simple-span analysis has no owner).

Diff (main → branch):

```diff
--- main stgirder.html
+++ branch stgirder.html
@@ -2187,7 +2187,11 @@
   // included, unfactored. Shears in the same MIDAS sign convention, so they are negated like V_LL (app + branch = −MIDAS − branch).
   const hasFat=slice.some(s=>s.M_FATpos!==undefined&&s.M_FATneg!==undefined);
   const hasFatV=hasFat&&slice.some(s=>s.V_FATpos!==undefined&&s.V_FATneg!==undefined);
-  return { spanLen, slice, sel, hasDC1, hasDC1split, swExcl, hasFat, hasFatV,
+  // GD45/GD49 (2026-10-15): the pedestrian load alone (GirderDetail, optional M_PL…/V_PL…). V_PLq: the part of V_LL (the larger of |V_LL+|, |V_LL−|) that is PL
+  const hasPL=slice.some(s=>s.M_PLpos!==undefined||s.V_PLpos!==undefined);
+  return { spanLen, slice, sel, hasDC1, hasDC1split, swExcl, hasFat, hasFatV, hasPL,
+    M_PLpos:(x)=>interp('M_PLpos',x)*fPos, M_PLneg:(x)=>interp('M_PLneg',x)*fNeg,
+    V_PLq:(x)=>{const p=interp('V_LLpos',x)*fV,n=interp('V_LLneg',x)*fV; return Math.abs(p)>=Math.abs(n)? Math.sign(p)*interp('V_PLpos',x)*fV : Math.sign(n)*interp('V_PLneg',x)*fV;},
     M_DC1steel:(x)=>interp('M_DC1steel',x),                              // k-ft (CF4)
     M_FATpos:(x)=>interp('M_FATpos',x), M_FATneg:(x)=>interp('M_FATneg',x),
     V_FATpos:(x)=>-interp('V_FATneg',x), V_FATneg:(x)=>-interp('V_FATpos',x),
@@ -2369,9 +2373,49 @@
     diffs:['C_b = 1.0 and one unbraced length L_b for the whole span (GirderDetail: C_b and L_b per location)',
       'no Appendix A6 (web plastification) for negative flexure',
       'shear without tension-field action (end-panel V_cr basis)',
-      'fixed maximum load factors (1.25 DC, 1.50 DW, 1.75 LL; no minimum-factor combinations)'],
+      'fixed maximum load factors (1.25 DC, 1.50 DW, 1.75 LL; no minimum-factor combinations)'+(ext.ownerRules?'; the owner load rules GirderDetail sends with the demands (η, design load multiplier, haunch 0 in properties) are applied to them here':'')],
     tbc:'Known differences to be confirmed by the engineer.'};
 }
+/* Owner load rules from GirderDetail (GD49, engineer decision 2026-10-15; HANDOFF.md §4.9, optional field ownerRules). GirderDetail applies the bridge
+   owner's rules to its own checks and sends them with the demands; ST-Girder applies the same to its girder checks while those demands are in use:
+   - m: design load multiplier on HL-93 LL+IM at Strength I and Service II (RIDOT BDM 3.4.1.2: 1.2); not on the live-load deflection, fatigue,
+     constructibility or the load rating, and not on the pedestrian load (when the import has it in LL+IM, LL+IM used = (LL+IM+PL) − PL + PL/m);
+   - eta = max(eta_D eta_R eta_I, 0.95) on the Strength I maximum load factors (AASHTO LRFD 1.3.2.1; ST-Girder uses maximum factors only, so 1/eta
+     on the minimum factors does not arise);
+   - h0: haunch taken as 0 in every composite section property (RIDOT BDM 6.5.1/9.4.6, MassDOT 3.5.1.2); the haunch weight is in the imported DC1;
+   - rt: the owner's design rating target (inventory RF), shown against the Rating tab result (reported only).
+   ownLFOf(ext): the rules of a GirderDetail import; LF_ST (identity: m = eta = 1, h0 false) for any other import, a GirderDetail payload without
+   ownerRules (sent before 2026-10-15), or the built-in analysis. With LF_ST every factor is 1.25, 1.50, 1.75 and 1.30 exactly as before. */
+const LF_ST={on:false,o:'',manual:'',m:1,eta:1,etaN:1,eD:1,eR:1,eI:1,pr:1,h0:false,rt:null,rtKind:'',cite:{m:'',eta:'',h:'',rt:''}};
+function ownLFOf(ext){ const r=ext&&extFromGD(ext)&&ext.ownerRules; if(!r||typeof r!=='object') return LF_ST;
+  const pf=v=>{ v=+v; return isFinite(v)&&v>0? v : 1; }, lm=r.llMultiplier||{}, E=r.eta||{}, t=r.ratingTarget||null;
+  const m=pf(lm.m), eD=pf(E.D), eR=pf(E.R), eI=pf(E.I), pr=eD*eR*eI;
+  const eta=E.max!=null&&+E.max>0? +E.max : Math.max(pr,0.95), etaN=E.min!=null&&+E.min>0? +E.min : Math.min(1/pr,1);
+  return {on:true, o:String(r.owner||''), manual:String(r.manual||''), m, eta, etaN, eD, eR, eI, pr, h0:r.haunchInProperties===false,
+    rt:t&&+t.rf>0? +t.rf : null, rtFat:t&&+t.fatigue>0? +t.fatigue : null, rtKind:t?String(t.kind||''):'',
+    cite:{m:String(lm.cite||''), eta:String(E.cite||''), h:String(r.haunchCite||''), rt:t?String(t.cite||''):''}}; }
+// the girder-check load factors of a rule set: Strength I maximum (DC, DW, LL) and Service II LL
+function lfFac(L){ return {gDC:1.25*L.eta, gDW:1.5*L.eta, gLL:1.75*L.eta*L.m, gS2:1.30*L.m}; }
+const lfS=R=>(R&&R.lf)||{...LF_ST,...lfFac(LF_ST),plOn:false};
+// a factor as text: the AASHTO value exactly as before when no owner rule changes it
+const lfP=(v,base)=>Math.abs(v-(+base))<1e-12? base : fmt(v,3);
+// LL+IM for the owner combinations (GD45): (LL+IM+PL) − PL + PL/m, so that m × it = m(LL+IM) + PL; unchanged without a pedestrian part or with m = 1
+const llD=(v,q,m)=>q&&m!==1? v-q+q/m : v;
+// the owner rules in words (banner, Inputs tab, report 1 and 2)
+function ownLines(R){ const L=R&&R.lf; if(!L||!L.on) return null; const f3=v=>fmt(v,3), out=[];
+  out.push(L.m!==1? 'Design load multiplier m = '+fmt(L.m,2)+' on HL-93 LL+IM at Strength I and Service II'+(L.cite.m?' ('+L.cite.m+')':'')+'; not on the live-load deflection, fatigue, constructibility or the load rating'+(L.plOn?'; not on the pedestrian load: LL+IM used = (LL+IM+PL) − PL + PL/m':'')+'.' : 'No design load multiplier (m = 1).');
+  out.push('Load modifier η = η_D·η_R·η_I = '+fmt(L.eD,2)+' × '+fmt(L.eR,2)+' × '+fmt(L.eI,2)+' = '+f3(L.pr)+(L.cite.eta?' ('+L.cite.eta+')':'')+': Strength I maximum load factors × η = '+f3(L.eta)+' (AASHTO LRFD 1.3.2.1; Eq. 1.3.2.1-2 with η ≥ 0.95). The minimum factors × 1/η = '+f3(L.etaN)+' do not arise: ST-Girder uses maximum factors only. Service II, fatigue, constructibility and the rating: η = 1.');
+  out.push('Factors used: Strength I γ_DC = 1.25η = '+f3(L.gDC)+', γ_DW = 1.50η = '+f3(L.gDW)+', γ_LL = 1.75ηm = '+f3(L.gLL)+'; Service II γ_LL = 1.30m = '+f3(L.gS2)+'.');
+  out.push(L.h0? 'Haunch taken as 0 in every composite section property (elastic n and 3n sections, cracked section, M_p)'+(L.cite.h?' ('+L.cite.h+')':'')+'; its weight is in the imported DC1; the drawing shows the haunch as entered.' : 'Haunch in the composite section properties as entered.');
+  if(L.rt) out.push('Design rating target: HL-93 inventory RF ≥ '+fmt(L.rt,2)+(L.rtFat?' (fatigue '+fmt(L.rtFat,2)+')':'')+(L.cite.rt?' ('+L.cite.rt+')':'')+'; checked on the Rating tab, reported only (no resizing).');
+  else if(L.rtKind==='report') out.push('Design load rating reported (no target)'+(L.cite.rt?' ('+L.cite.rt+')':'')+'; see the Rating tab.');
+  return out; }
+function OwnBanner({R,go}){ const L=R&&R.ok&&R.lf; if(!L||!L.on) return null; const ls=ownLines(R);
+  return <div className="callout" style={{marginTop:0,marginBottom:0,borderLeftColor:'#7c3aed',background:'#f5f3ff'}}>
+    <b>Owner load rules from GirderDetail: {L.o||'—'}</b>{L.manual?<span style={{fontSize:11.5}}> · {L.manual}</span>:null}
+    <ul style={{fontSize:11.5,margin:'4px 0 0 18px',lineHeight:1.6,padding:0}}>{ls.map((t,i)=><li key={i}>{t}</li>)}</ul>
+    <div style={{fontSize:11.5,marginTop:4}}>Applied to every girder check while GirderDetail’s demands are in use; worked in the report, <i>2. Input parameters — Owner load rules</i> and <i>Demands — Load combinations</i>.{go?<span> Go to: <a href="#" onClick={e=>{e.preventDefault();go('inputs');}}>Inputs (imported demands)</a> · <a href="#" onClick={e=>{e.preventDefault();go('diagrams');}}>Diagrams (M_u, V_u)</a>{L.rt?<span> · <a href="#" onClick={e=>{e.preventDefault();go('rating');}}>Rating (target)</a></span>:null} · <a href="#" onClick={e=>{e.preventDefault();go('report');}}>Report</a></span>:null}</div>
+  </div>; }
 function GdNote({ext,style}){
   const n=gdNoteLines(ext); if(!n) return null;
   return <div className="callout" style={{marginTop:0,marginBottom:12,borderColor:'var(--blue)',background:'#EEF4FF',...(style||{})}}>
@@ -2711,6 +2755,8 @@
 function computeAll(inp){
   try{
     const sec=inp.sec, mat=inp.mat, deck0=inp.deck, geom=inp.geom;
+    // GD49: the owner load rules of a GirderDetail import (identity otherwise): Strength I maximum factors and Service II LL factor
+    const OWN=ownLFOf(inp.external), LFc=lfFac(OWN), gDC=LFc.gDC, gDW=LFc.gDW, gLL=LFc.gLL, gS2=LFc.gS2;
     // resolve grades
     const Fyf=+mat.Fyf, Fyw=+mat.Fyw, Es=+mat.Es||29000, Fyc=Fyf, Fyt=Fyf;
     const matR={...mat,Fyf,Fyw,Es,Fyc,Fyt};
@@ -2721,7 +2767,7 @@
     const extTrib = inp.loads.pos==='exterior' && deck0.extTribAuto!==false;
     const tribFt = extTrib? (+geom.S)/2 + Math.max(+deck0.oh||0,0) : +geom.S;
     const beff = deck0.beffAuto? tribFt*12 : +deck0.beff;
-    const deck={...deck0, beff, fc:+deck0.fc};
+    const deck={...deck0, beff, fc:+deck0.fc, ...(OWN.h0?{haunch:0}:{})};   // GD49: haunch 0 in every composite property under the owner rule (the dead loads keep inp.deck)
     // modular ratio
     const EcDeck=Ec(deck.fc, +deck0.wc);
     const nRaw=Es/EcDeck;
@@ -2786,6 +2832,7 @@
     const ext=buildExternal(inp.external,Lft0, extPerGirder? {pos:1,neg:1,v:1} :
       {pos:(+inp.loads.extDFpos||1)*mpfExt, neg:(+inp.loads.extDFneg||1)*mpfExt, v:(+inp.loads.extDFv||1)*mpfExt});
     const useExt=!!ext;
+    const plOn=OWN.m!==1&&useExt&&ext.hasPL&&inp.external.pedestrianInLL===true;   // GD45: the pedestrian load in LL+IM, taken without m
     // SW-CONT (2026-10-13): the self-weight ST-Girder adds to an import with selfWeightExcluded:true is analysed on the
     // continuous girder of the import (swContinuous); null = one span / no support layout → simple span w·x(L−x)/2 as before.
     // SW-ED (2026-10-13): the selected span uses ST-Girder's current plates when they differ from the imported zones of that span.
@@ -2848,10 +2895,13 @@
       const Ml = useExt? Math.max(ext.M_LLpos(x),0) : llMomentAt(Lft,x)*Ld.dfm;   // +LL envelope
       const Mln= useExt? Math.min(ext.M_LLneg(x),0) : 0;                          // −LL envelope
       const Vl = useExt? ext.V_LL(x) : llShearAt(Lft,x)*Ld.dfv;
-      const Mu =1.25*(M1+M2)+1.5*Mw+1.75*Ml;            // factored, +LL case
-      const Mun=1.25*(M1+M2)+1.5*Mw+1.75*Mln;           // factored, −LL case
-      const Vu=Math.abs(1.25*(V1+V2)+1.5*Vw)+1.75*Math.abs(Vl);
-      return {x,si,M1,M2,Mw,Ml,Mln,V1,V2,Vw,Vl,Mu,Mun,Vu};
+      // GD49: owner factors (1.25, 1.50, 1.75 without owner rules); MlD, MlnD, VlD: LL+IM with the pedestrian part taken without m (GD45; = Ml, Mln, Vl otherwise)
+      const qM=plOn&&Ml>0? ext.M_PLpos(x):0, qMn=plOn&&Mln<0? ext.M_PLneg(x):0, qV=plOn? ext.V_PLq(x):0;
+      const MlD=plOn? llD(Ml,qM,OWN.m):Ml, MlnD=plOn? llD(Mln,qMn,OWN.m):Mln, VlD=plOn? llD(Math.abs(Vl),qV,OWN.m):Vl;
+      const Mu =gDC*(M1+M2)+gDW*Mw+gLL*MlD;            // factored, +LL case
+      const Mun=gDC*(M1+M2)+gDW*Mw+gLL*MlnD;           // factored, −LL case
+      const Vu=Math.abs(gDC*(V1+V2)+gDW*Vw)+gLL*Math.abs(VlD);
+      return {x,si,M1,M2,Mw,Ml,Mln,V1,V2,Vw,Vl,Mu,Mun,Vu,MlD,MlnD,VlD,...(plOn?{qM,qMn,qV}:{})};
     });
     const diag=stations;
     const MuPeak=Math.max(...stations.map(d=>d.Mu)), VuPeak=Math.max(...stations.map(d=>d.Vu));
@@ -2860,7 +2910,7 @@
 
     // staged flange stresses at a station (kip-ft in → ksi). Sign: fB + = bottom tension; fT + = top compression.
     // Section per component: DC1 → bare; others → composite (3n / n) when M ≥ 0, cracked (steel+rebar) when M < 0.
-    const stageF=(st,g1,g2,gw,gll)=>{
+    const stageF=(st,g1,g2,gw,gll,des)=>{   // des (GD49): the owner combinations' LL+IM (MlD, MlnD; = Ml, Mln without a pedestrian part)
       const sg=segP[st.si];
       const one=(M,kind)=>{ let Sb,St;
         if(kind==='dc1'){ Sb=sg.bare.Sb; St=sg.bare.StSteel; }
@@ -2868,7 +2918,7 @@
         else { Sb=sg.cr.Sb; St=sg.cr.St; }
         return {fB:M*12/Sb, fT:M*12/St}; };
       const dc=one(g1*st.M1,'dc1'), d2=one(g2*st.M2,'lt'), dw=one(gw*st.Mw,'lt');
-      const lp=one(gll*st.Ml,'ll'), ln=one(gll*st.Mln,'ll');
+      const lp=one(gll*(des?st.MlD:st.Ml),'ll'), ln=one(gll*(des?st.MlnD:st.Mln),'ll');
       return { pos:{fB:dc.fB+d2.fB+dw.fB+lp.fB, fT:dc.fT+d2.fT+dw.fT+lp.fT},
                neg:{fB:dc.fB+d2.fB+dw.fB+ln.fB, fT:dc.fT+d2.fT+dw.fT+ln.fT},
                parts:{dc,d2,dw,lp,ln} };
@@ -2883,13 +2933,13 @@
     const s2CoefLabel=s2Composite?'0.95R_hF_yf':'0.80R_hF_yf';
     const chartS2=[];                                  // per-station Service II stresses for the Stresses tab charts
     stations.forEach(st=>{ const sg=segP[st.si];
-      const s=stageF(st,1,1,1,1.30), lim=s2Coef*sg.Rh*Fyf;
+      const s=stageF(st,1,1,1,gS2,true), lim=s2Coef*sg.Rh*Fyf;   // GD49: Service II γ_LL = 1.30m
       chartS2.push({x:st.x, si:st.si, lim, Rh:sg.Rh,
         bP:s.pos.fB, tP:s.pos.fT, bN:s.neg.fB, tN:s.neg.fT,
         dc1B:s.parts.dc.fB, sidlB:s.parts.d2.fB+s.parts.dw.fB, llB:s.parts.lp.fB,
         dc1T:s.parts.dc.fT, sidlT:s.parts.d2.fT+s.parts.dw.fT, llT:s.parts.lp.fT,
         // moments (k-ft) and section moduli (in³) per stage, for the worked-calc picker
-        M1:st.M1, M2:st.M2, Mw:st.Mw, Ml:st.Ml, Mln:st.Mln,
+        M1:st.M1, M2:st.M2, Mw:st.Mw, Ml:st.Ml, Mln:st.Mln, MlD:st.MlD,
         SbBare:sg.bare.Sb, StBare:sg.bare.StSteel, Sb3n:sg.c3N.Sb, St3n:sg.c3N.StSteel,
         Sbn:sg.cN.Sb, Stn:sg.cN.StSteel, SbCr:sg.cr.Sb, StCr:sg.cr.St,
         dc1Bp:s.parts.dc.fB, d2Bp:s.parts.d2.fB, dwBp:s.parts.dw.fB, llBp:s.parts.lp.fB, lnBp:s.parts.ln.fB});
@@ -2902,10 +2952,10 @@
     });
     // stress display object (kept shape: governing positive-flexure station)
     const stMaxPos=stations.reduce((b,st)=>st.Mu>b.Mu?st:b,stations[0]);
-    const sDisp=stageF(stMaxPos,1,1,1,1.30);
+    const sDisp=stageF(stMaxPos,1,1,1,gS2,true);
     const sgDisp=segP[stMaxPos.si];
-    const fTop={dc1:sDisp.parts.dc.fT, sid:sDisp.parts.d2.fT+sDisp.parts.dw.fT, ll:sDisp.parts.lp.fT/1.30, serv2:sDisp.pos.fT};
-    const fBot={dc1:sDisp.parts.dc.fB, sid:sDisp.parts.d2.fB+sDisp.parts.dw.fB, ll:sDisp.parts.lp.fB/1.30, serv2:sDisp.pos.fB};
+    const fTop={dc1:sDisp.parts.dc.fT, sid:sDisp.parts.d2.fT+sDisp.parts.dw.fT, ll:sDisp.parts.lp.fT/gS2, serv2:sDisp.pos.fT};
+    const fBot={dc1:sDisp.parts.dc.fB, sid:sDisp.parts.d2.fB+sDisp.parts.dw.fB, ll:sDisp.parts.lp.fB/gS2, serv2:sDisp.pos.fB};
     const fServLim=s2Coef*sgDisp.Rh*Fyf;
     // optional LL deflection (2.5.2.6.2) — short-term composite at midspan segment
     const EI=Es*segMid.cN.I;
@@ -2935,8 +2985,8 @@
     //   My = MD1 + MD2 + MAD,  MAD = S_n·(Fyf − f_D1 − f_D2) for each flange, lesser flange governs.
     const contSpan = useExt && hasNeg;
     const yieldMy=(st,sg)=>{
-      const MD1=1.25*st.M1, MD2=1.25*st.M2+1.5*st.Mw;              // k-ft, factored permanent
-      const fd=stageF(st,1.25,1.25,1.5,0).pos;                      // ksi, fB tension+, fT compression+
+      const MD1=gDC*st.M1, MD2=gDC*st.M2+gDW*st.Mw;              // k-ft, factored permanent (GD49: × η under the owner rules)
+      const fd=stageF(st,gDC,gDC,gDW,0).pos;                      // ksi, fB tension+, fT compression+
       const MADb=sg.cN.Sb*(Fyf-fd.fB)/12, MADt=sg.cN.StSteel*(Fyf-fd.fT)/12;
       const MyB=MD1+MD2+MADb, MyT=MD1+MD2+MADt;
       return {MD1,MD2,fDb:fd.fB,fDt:fd.fT,MADb,MADt,MyB,MyT,My:Math.min(MyB,MyT)};
@@ -2957,7 +3007,7 @@
       chartFlex.push({x:st.x, capPos, capNeg, compact:sg.compact,
         SxPos:sg.cN.Sb, SxNeg:sg.cr.St, fServLim:s2Coef*sg.Rh*Fyf});
       // staged factored flange stresses (Strength I) at this station — computed once, reused below
-      const fStg=stageF(st,1.25,1.25,1.5,1.75);
+      const fStg=stageF(st,gDC,gDC,gDW,gLL,true);   // GD49
       // ── +M worked-calc record (compact → Mp basis · noncompact composite → stress basis) ──
       const posC = sg.oos? {oos:true, compact:false, Mu:st.Mu, capPos:null, dc:NaN}
         : sg.compact
@@ -2994,7 +3044,7 @@
     });
     const sgPos=segP[posGov.si||0];
     const stPos=stations.reduce((b,st)=>st.Mu>b.Mu?st:b,stations[0]);
-    const fStr=stageF(stPos,1.25,1.25,1.5,1.75);
+    const fStr=stageF(stPos,gDC,gDC,gDW,gLL,true);
     const Mp_kft=sgPos.pl.Mp/12, Mn_kft=sgPos.Mn_kft;
     const flexMode=sgPos.compact?'Compact composite — Mp basis (6.10.7.1)'
       :(deck.deckOn?'Noncompact composite — stress basis (6.10.7.2)':'Noncomposite — stress basis, Fnc per 6.10.8.2 (FLB/LTB)');
@@ -3411,6 +3461,8 @@
       rating.govInv=NaN; rating.govOpr=NaN;
     }
     const checksF=checks.map(c=>({...c,loc:c.loc||0,pass:c.r<=1.0001}));
+    // GD49: the owner's design rating target (inventory RF of the HL-93 design-load rating; reported, not a check of this list)
+    rating.target= OWN.rt? {rf:OWN.rt, inv:rating.govInv, pass:isFinite(rating.govInv)&&rating.govInv>=OWN.rt-1e-9, cite:OWN.cite.rt, fat:OWN.rtFat} : null;
 
     /* ---------- warnings for effects not computed (display only) ---------- */
     const warnings={fl:[],fat:[]};
@@ -3423,7 +3475,7 @@
     if(useExt&&fatImp) warnings.fat.push('Fatigue from the imported fatigue envelopes ('+((inp.external&&inp.external.producer)||'import')+': fatigue truck, IM and single-lane fatigue distribution factors included): bottom-flange stress range = (M_FAT+ \u2212 M_FAT\u2212)/S_b on the short-term composite section for both signs (6.6.1.2.1; requires shear connectors throughout and the 6.10.1.7 deck reinforcement)'+(fatImpV?', web special fatigue and stud fatigue pitch from the imported fatigue shears':'; no fatigue shears imported, so the web special fatigue and stud pitch still use the fatigue truck on a simple span of L = '+fmt(Lft,1)+' ft')+'. The top flange and its attachments and the deck reinforcement at interior piers are not checked here.');
     else if(useExt) warnings.fat.push('Imported MIDAS demands: the fatigue checks still use the fatigue truck on a SIMPLE span of L = '+fmt(Lft,1)+' ft (flange stress range, web special fatigue, stud pitch). Negative-moment fatigue at interior piers (top flange and its welded attachments, deck reinforcement) is not checked'+(hasNeg?', although this span has negative moment':'')+'. Check those details with a fatigue-truck range from the continuous analysis.');
 
-    return {ok:true, sec, matR, deck, geom, beff, n, nRaw, EcDeck,
+    return {ok:true, sec, matR, deck, deckIn:deck0, lf:{...OWN,...LFc,plOn}, geom, beff, n, nRaw, EcDeck,
       bare, cN, c3N, pl, compact, compactWeb, compactMat, compactDtw, lambdaPw,
       Rh, Rb, ductOK, Iyc, Iyt, IycIyt, My_bareTop, My_bareBot,
       loads:Ld, hl:Ld.hl, df:Ld.df, dfm:Ld.dfm, dfv:Ld.dfv, MLL:Ld.MLL, VLL:Ld.VLL,
@@ -3557,7 +3609,7 @@
 
 /* ================= SVG DRAWINGS ================= */
 function CrossSection({R}){
-  const {sec,deck,cN,pl}=R;
+  const {sec,cN,pl}=R, deck=R.deckIn? {...R.deck, haunch:+R.deckIn.haunch} : R.deck;   // GD49: drawn with the haunch as entered (properties may use 0)
   const segMid=R.segP? (R.segP.find(g=>R.geom.L/2<=g.x1+1e-9)||R.segP[0]) : null;
   const {D,tw,bft,tft,bfb,tfb}=segMid? {D:sec.D,tw:sec.tw,...segMid.dims} : sec;
   const hs=tfb+D+tft;
@@ -4771,7 +4823,8 @@
       <SG n="1">Stage stresses at the bottom flange (each on its stage-correct section)</SG>
       <ML s={Tx`f_{DC1}=\frac{M_{DC1}\cdot12}{S_{b,bare}}=\frac{${nx(psel.M1,0)}\cdot12}{${nx(psel.SbBare,0)}}=${nx(psel.dc1Bp,2)}\;\text{ksi}`}/>
       <ML s={Tx`f_{DC2}=\frac{M_{DC2}\cdot12}{S_{b,3n}}=${nx(psel.d2Bp,2)}\;\text{ksi}\qquad f_{DW}=\frac{M_{DW}\cdot12}{S_{b,3n}}=${nx(psel.dwBp,2)}\;\text{ksi}`}/>
-      <ML s={Tx`f_{LL}=1.30\cdot\frac{M_{LL}\cdot12}{S_{b,n}}=${nx(psel.llBp,2)}\;\text{ksi}`}/>
+      <ML s={Tx`f_{LL}=${lfP(lfS(R).gS2,'1.30')}\cdot\frac{M_{LL}\cdot12}{S_{b,n}}=${nx(psel.llBp,2)}\;\text{ksi}`}/>
+      {lfS(R).on&&<div className="mnote">Service II γ_LL = 1.30m = {lfP(lfS(R).gS2,'1.30')} (owner rule, see the owner load rules banner){lfS(R).plOn?'; M_LL = (LL+IM+PL) − PL + PL/m = '+fmt(psel.MlD,1)+' k-ft at this station':''}.</div>}
       <DLinks items={[{to:'segs',seg:sgI(R,psel.si),what:'S_b (bare)'},{to:'trans',seg:sgI(R,psel.si),what:'S_b (3n, n)'},{to:'menv',what:'stage moments'}]}/>
       <SG n="2">Service II combination & check</SG>
       <ML s={Tx`f_{ServII}=f_{DC1}+f_{DC2}+f_{DW}+f_{LL}=${nx(psel.dc1Bp,2)}+${nx(psel.d2Bp,2)}+${nx(psel.dwBp,2)}+${nx(psel.llBp,2)}=${nx(psel.bP,2)}\;\text{ksi}`}/>
@@ -4808,7 +4861,7 @@
     </div>
 
     <Card title="What Service II checks" refTag="AASHTO 6.10.4.2.2 · permanent-deformation control">
-      <div className="hint">Service II limits the flexural stress under <b>DC + DW + 1.30(LL+IM)</b> to <b>{fmt(st.s2Coef,2)} R_h F_yf</b> to prevent objectionable permanent deflection from occasional heavy overloads. The coefficient is <b>0.95</b> for the flanges of a composite section and <b>0.80</b> for both flanges of a noncomposite one. Stresses <b>accumulate by construction stage</b> on the section active at each stage: DC1 (self-weight + wet deck) on the bare steel, DC2 + DW on the long-term (3n) composite, and live load on the short-term (n) composite. The picker below shows the full stage buildup at any station.</div>
+      <div className="hint">Service II limits the flexural stress under <b>DC + DW + {lfP(lfS(R).gS2,'1.30')}(LL+IM)</b> to <b>{fmt(st.s2Coef,2)} R_h F_yf</b> to prevent objectionable permanent deflection from occasional heavy overloads. The coefficient is <b>0.95</b> for the flanges of a composite section and <b>0.80</b> for both flanges of a noncomposite one. Stresses <b>accumulate by construction stage</b> on the section active at each stage: DC1 (self-weight + wet deck) on the bare steel, DC2 + DW on the long-term (3n) composite, and live load on the short-term (n) composite. The picker below shows the full stage buildup at any station.</div>
     </Card>
 
     {psel&&s2Deriv(R,psel,<select value={selIdx} onChange={e=>setSelIdx(+e.target.value)}
@@ -4825,7 +4878,7 @@
         {x:cx,y:ch.map(p=>p.lim),name:'+'+fmt(st.s2Coef,2)+'RhFyf',line:{color:'#B3261E',width:1.4,dash:'dot'}},
         {x:cx,y:ch.map(p=>-p.lim),name:'−'+fmt(st.s2Coef,2)+'RhFyf',line:{color:'#B3261E',width:1.4,dash:'dot'}}]}
         layout={{xaxis:{title:'x (ft)'},yaxis:{title:'stress (ksi · fB + = bottom tension, fT + = top compression)'}}}/>
-      <div className="callout">Service II = DC + DW + 1.30(LL+IM), accumulated on the stage-correct sections (DC1 on bare steel, DC2+DW on 3n, LL on n{R.hasNeg?'; −M regions on the cracked steel+rebar section':''}). Both flanges are limited to ±{fmt(st.s2Coef,2)}R<sub>h</sub>F<sub>yf</sub>{st.s2Composite?' (composite section)':' — the 0.80 coefficient applies because the deck is not acting compositely with the steel'}; the limit line steps where R<sub>h</sub> changes at a flange splice. Governing: <b>{fmt(Math.abs(st.s2Gov.f||0),1)} ksi</b> ({st.s2Gov.tag}) at <b>{fmt(st.s2Gov.x||0,1)} ft</b>.</div>
+      <div className="callout">Service II = DC + DW + {lfP(lfS(R).gS2,'1.30')}(LL+IM), accumulated on the stage-correct sections (DC1 on bare steel, DC2+DW on 3n, LL on n{R.hasNeg?'; −M regions on the cracked steel+rebar section':''}). Both flanges are limited to ±{fmt(st.s2Coef,2)}R<sub>h</sub>F<sub>yf</sub>{st.s2Composite?' (composite section)':' — the 0.80 coefficient applies because the deck is not acting compositely with the steel'}; the limit line steps where R<sub>h</sub> changes at a flange splice. Governing: <b>{fmt(Math.abs(st.s2Gov.f||0),1)} ksi</b> ({st.s2Gov.tag}) at <b>{fmt(st.s2Gov.x||0,1)} ft</b>.</div>
     </Card>
     <Card title="Stage Buildup — Overlay" refTag="toggle curves · cumulative by construction stage">
       <div className="btnrow" style={{marginBottom:6}}>{OVS.map(([k,l])=>
@@ -4846,12 +4899,12 @@
           {x:cx,y:ch.map(p=>p.lim),name:'+'+fmt(st.s2Coef,2)+'RhFyf',line:{color:'#B3261E',width:1.4,dash:'dot'}},
           {x:cx,y:ch.map(p=>-p.lim),name:'−'+fmt(st.s2Coef,2)+'RhFyf',line:{color:'#B3261E',width:1.4,dash:'dot'}}]:[])]}
         layout={{xaxis:{title:'x (ft)'},yaxis:{title:'stress (ksi)'}}}/>
-      <div className="hint">Each curve adds one stage: DC1 locked into the bare girder before the deck cures, then superimposed dead load on the long-term composite, then 1.30(LL+IM) on the short-term composite. The gap between the Σ curve and the limit is the Service II reserve at every station.</div>
+      <div className="hint">Each curve adds one stage: DC1 locked into the bare girder before the deck cures, then superimposed dead load on the long-term composite, then {lfP(lfS(R).gS2,'1.30')}(LL+IM) on the short-term composite. The gap between the Σ curve and the limit is the Service II reserve at every station.</div>
     </Card>
     <Card title="Flange stresses by construction stage" refTag="6.10.4.2.2 · Service II @ midspan">
       <Tbl head={['Steel flange','DC1 (bare)','DC2+DW (3n)','LL+IM (n)','Service II Σ']}
         rows={[row('Top flange (comp.)',st.fTop),row('Bottom flange (tens.)',st.fBot)]}/>
-      <div className="hint">Stress accumulates on the section active at each stage: <b>DC1</b> (self-weight + wet deck) on bare steel, <b>DC2 + DW</b> on the long-term (3n) composite, <b>LL+IM</b> on the short-term (n) composite. Service II factors live load by <b>1.30</b> (Table 3.4.1-1). Both flanges are limited to <b>{fmt(st.s2Coef,2)} R_h F_yf = {fmt(st.fServLim,1)} ksi</b> — 0.95 for a composite section, 0.80 for both flanges of a noncomposite one (6.10.4.2.2){st.s2Composite?'':', which is the case here because the deck is switched off'}. The bottom (tension) flange, farthest from the high composite neutral axis, typically governs. Flange lateral bending f_ℓ is taken as 0 for this straight girder (the check adds f_ℓ/2 to the bottom flange when present).</div>
+      <div className="hint">Stress accumulates on the section active at each stage: <b>DC1</b> (self-weight + wet deck) on bare steel, <b>DC2 + DW</b> on the long-term (3n) composite, <b>LL+IM</b> on the short-term (n) composite. Service II factors live load by <b>{lfP(lfS(R).gS2,'1.30')}</b> (Table 3.4.1-1{lfS(R).m!==1?'; 1.30 × the owner multiplier m':''}). Both flanges are limited to <b>{fmt(st.s2Coef,2)} R_h F_yf = {fmt(st.fServLim,1)} ksi</b> — 0.95 for a composite section, 0.80 for both flanges of a noncomposite one (6.10.4.2.2){st.s2Composite?'':', which is the case here because the deck is switched off'}. The bottom (tension) flange, farthest from the high composite neutral axis, typically governs. Flange lateral bending f_ℓ is taken as 0 for this straight girder (the check adds f_ℓ/2 to the bottom flange when present).</div>
     </Card>
     <Card title="Live-load deflection" refTag="2.5.2.6.2 (optional)">
       <div className="hint">Δ_truck(incl. IM) = <b>{fmt(st.dTruck,3)} in</b> · Δ_lane = <b>{fmt(st.dLane,3)} in</b> · deflection DF (all lanes ÷ girders) = <b>{fmt(st.dfDefl,3)}</b> → Δ_LL = <b>{fmt(st.dLL,3)} in</b> vs L/800 = <b>{fmt(st.dLim,3)} in</b> ({defPass?'OK':'N.G.'}). Optional criterion; taken as the larger of the design truck alone or 25% truck + lane, on the short-term composite I = {fmt(R.cN.I,0)} in⁴.</div>
@@ -4874,13 +4927,15 @@
   const vr=spanView==='all'?{x0:0,x1:memberLen,label:'Entire beam'}
     :(spanView!=='design'?(()=>{const sp=allSpans.find(s=>('s'+s.idx)===spanView);return sp?{x0:sp.x0,x1:sp.x1,label:'Span '+sp.idx,sp}:null;})():null);
   const designThisSpan=sp=>{ if(set){ const secNew=zonesToSec(ext,sp,inp.sec); set({...inp, external:{...ext,_selSpan:sp}, geom:{...inp.geom,L:sp.len}, ...(secNew?{sec:secNew}:{})}); } setSpanView('design'); };
+  const F=lfS(R);   // GD49: the owner factors (1.25, 1.50, 1.75 without owner rules); the pedestrian part without m (GD45)
   const vrows=(x0,x1)=>ext.stations.filter(s=>(+s.x)>=x0-1e-6&&(+s.x)<=x1+1e-6).sort((a,b)=>a.x-b.x).map(s=>{
     const a=k=>+s[k]||0; const m1=a('M_DC1'),m2=a('M_DC2'),mw=a('M_DW'),mlp=a('M_LLpos'),mln=a('M_LLneg');
     const v1=a('V_DC1'),v2=a('V_DC2'),vw=a('V_DW'),vlp=a('V_LLpos'),vln=a('V_LLneg');
+    const d=(v,k)=>F.plOn? llD(v,a(k),F.m) : v;
     return {x:+s.x,M1:m1,M2:m2,Mw:mw,Mlp:mlp,Mln:mln,
-      Mup:1.25*(m1+m2)+1.5*mw+1.75*mlp,Mun:1.25*(m1+m2)+1.5*mw+1.75*mln,
+      Mup:F.gDC*(m1+m2)+F.gDW*mw+F.gLL*d(mlp,'M_PLpos'),Mun:F.gDC*(m1+m2)+F.gDW*mw+F.gLL*d(mln,'M_PLneg'),
       V1:v1,V2:v2,Vw:vw,Vlp:vlp,Vln:vln,
-      Vup:1.25*(v1+v2)+1.5*vw+1.75*vlp};});
+      Vup:F.gDC*(v1+v2)+F.gDW*vw+F.gLL*d(vlp,'V_PLpos')};});
   const lnR=(rows,k,name,color,dash)=>({x:rows.map(r=>r.x),y:rows.map(r=>r[k]||0),name,mode:'lines',line:{color,width:2,dash:dash||'solid'}});
   const ln=(k,name,color,dash)=>({x:xs,y:d.map(p=>p[k]),name,mode:'lines',line:{color,width:2,dash:dash||'solid'}});
   const mData=[ln('M1','DC1','#15803D'),ln('M2','DC2','#0E7490'),ln('Mw','DW','#B45309'),
@@ -4905,7 +4960,7 @@
           <Fig h={360} data={md} layout={{yaxis:{title:'M (k-ft)'},xaxis:{title:'x (ft, member)'}}}/></Card>
         <Card title={'Shear envelope — '+vr.label} refTag="imported demands · kip">
           <Fig h={340} data={vd} layout={{yaxis:{title:'V (kip)'},xaxis:{title:'x (ft, member)'}}}/></Card>
-        <div className="callout">Strength I = 1.25(DC1+DC2)+1.50 DW+1.75 LL from the imported per-station envelope over {vr.label.toLowerCase()} (member coordinates). Switch back to <b>Design span</b> for the full design envelopes, or use <b>Design Span n</b> to move the analysis there.</div>
+        <div className="callout">Strength I = {lfP(F.gDC,'1.25')}(DC1+DC2)+{lfP(F.gDW,'1.50')} DW+{lfP(F.gLL,'1.75')} LL{F.on?' (owner load rules)':''} from the imported per-station envelope over {vr.label.toLowerCase()} (member coordinates). Switch back to <b>Design span</b> for the full design envelopes, or use <b>Design Span n</b> to move the analysis there.</div>
       </React.Fragment>; })()
     :<React.Fragment>
     <Card id="stg-d-menv" title="Moment envelope" refTag={'per girder · k-ft'+(R.useExt?' · imported demands':'')}>
@@ -4916,7 +4971,7 @@
         ln('Vl','LL+IM','#B3261E'),ln('Vu','Strength I Vu','#1C4FC4','dot')]}
         layout={{yaxis:{title:'V (kip)'},xaxis:{title:'x (ft)'}}}/>
     </Card>
-    <div className="callout">Strength I = 1.25 DC + 1.50 DW + 1.75 (LL+IM). Peak +M_u = <b>{fmt(Math.max(...d.map(p=>p.Mu)),0)} k-ft</b>{R.hasNeg&&<span> · peak −M_u = <b>{fmt(Math.min(...d.map(p=>p.Mun)),0)} k-ft</b></span>} · peak V_u = <b>{fmt(Math.max(...d.map(p=>p.Vu)),0)} kip</b>. {R.useExt?'Demands from the imported continuous envelope (impact included; per-effect DF × m applied).':'Live-load envelopes are HL-93 (1.33× truck/tandem + lane) × distribution factor.'} Station spacing includes every flange-transition point, so the governing section is always sampled.</div>
+    <div className="callout">Strength I = {lfP(F.gDC,'1.25')} DC + {lfP(F.gDW,'1.50')} DW + {lfP(F.gLL,'1.75')} (LL+IM){F.on?<span> (owner load rules of {F.o}: η = {fmt(F.eta,3)}, m = {fmt(F.m,2)}{F.plOn?'; LL+IM = (LL+IM+PL) − PL + PL/m':''}; see the banner above)</span>:null}. Peak +M_u = <b>{fmt(Math.max(...d.map(p=>p.Mu)),0)} k-ft</b>{R.hasNeg&&<span> · peak −M_u = <b>{fmt(Math.min(...d.map(p=>p.Mun)),0)} k-ft</b></span>} · peak V_u = <b>{fmt(Math.max(...d.map(p=>p.Vu)),0)} kip</b>. {R.useExt?'Demands from the imported continuous envelope (impact included; per-effect DF × m applied).':'Live-load envelopes are HL-93 (1.33× truck/tandem + lane) × distribution factor.'} Station spacing includes every flange-transition point, so the governing section is always sampled.</div>
     </React.Fragment>}
   </div>);
 }
@@ -5054,7 +5109,7 @@
   // ── moment breakdown vs capacity (per-station capacity from computeAll) ──
   const stns=R.stations, cf=R.chartFlex||[], fx=stns.map(p=>p.x);
   const [fac,setFac]=useState(false);
-  const k1=fac?1.25:1, kw=fac?1.5:1, kl=fac?1.75:1;
+  const F=lfS(R), k1=fac?F.gDC:1, kw=fac?F.gDW:1, kl=fac?F.gLL:1;   // GD49: the owner factors (1.25, 1.5, 1.75 without owner rules)
   // ── location picker: per-station worked capacity calculation ──
   const fcAll=R.flexCalc||[], nSeg=(R.segP||[]).length, Lspan=R.geom.L;
   const govX=f.oos? R.stress.xGov : (f.gov&&f.gov.x)||0;   // PNA-OOS: no governing +M station; open at the peak +M_u station
@@ -5085,14 +5140,14 @@
       <div style={{marginBottom:6}}>
         <label style={{fontSize:11,color:'var(--ink2)',display:'flex',gap:7,alignItems:'center'}}>
           <input type="checkbox" checked={fac} onChange={e=>setFac(e.target.checked)}/>
-          Show components factored (1.25 DC · 1.50 DW · 1.75 LL) — the M<sub>u</sub> envelopes are always factored</label>
+          Show components factored ({lfP(F.gDC,'1.25')} DC · {lfP(F.gDW,'1.50')} DW · {lfP(F.gLL,'1.75')} LL{F.on?', owner load rules':''}) — the M<sub>u</sub> envelopes are always factored</label>
       </div>
       <Fig h={400} data={[
-        {x:fx,y:stns.map(p=>k1*p.M1),name:'DC1'+(fac?' ×1.25':''),line:{color:'#15803D',width:1.8}},
-        {x:fx,y:stns.map(p=>k1*p.M2),name:'DC2'+(fac?' ×1.25':''),line:{color:'#0E7490',width:1.6,dash:'dot'}},
-        {x:fx,y:stns.map(p=>kw*p.Mw),name:'DW'+(fac?' ×1.50':''),line:{color:'#B45309',width:1.6,dash:'dot'}},
-        {x:fx,y:stns.map(p=>kl*p.Ml),name:'+LL+IM'+(fac?' ×1.75':''),line:{color:'#B3261E',width:1.8}},
-        ...(R.hasNeg?[{x:fx,y:stns.map(p=>kl*p.Mln),name:'−LL+IM'+(fac?' ×1.75':''),line:{color:'#7C3AED',width:1.8,dash:'dash'}}]:[]),
+        {x:fx,y:stns.map(p=>k1*p.M1),name:'DC1'+(fac?' ×'+lfP(F.gDC,'1.25'):''),line:{color:'#15803D',width:1.8}},
+        {x:fx,y:stns.map(p=>k1*p.M2),name:'DC2'+(fac?' ×'+lfP(F.gDC,'1.25'):''),line:{color:'#0E7490',width:1.6,dash:'dot'}},
+        {x:fx,y:stns.map(p=>kw*p.Mw),name:'DW'+(fac?' ×'+lfP(F.gDW,'1.50'):''),line:{color:'#B45309',width:1.6,dash:'dot'}},
+        {x:fx,y:stns.map(p=>kl*(fac?p.MlD:p.Ml)),name:'+LL+IM'+(fac?' ×'+lfP(F.gLL,'1.75'):''),line:{color:'#B3261E',width:1.8}},
+        ...(R.hasNeg?[{x:fx,y:stns.map(p=>kl*(fac?p.MlnD:p.Mln)),name:'−LL+IM'+(fac?' ×'+lfP(F.gLL,'1.75'):''),line:{color:'#7C3AED',width:1.8,dash:'dash'}}]:[]),
         {x:fx,y:stns.map(p=>p.Mu),name:'+Mu (Strength I)',fill:'tozeroy',fillcolor:'rgba(28,79,196,.05)',line:{color:'#1C4FC4',width:2.2}},
         ...(R.hasNeg?[{x:fx,y:stns.map(p=>p.Mun),name:'−Mu (Strength I)',line:{color:'#1C4FC4',width:1.8,dash:'dashdot'}}]:[]),
         {x:cf.map(p=>p.x),y:cf.map(p=>p.capPos),name:'+φMn capacity',line:{color:'#B3261E',width:2.6}},
@@ -5144,7 +5199,7 @@
           : <ML s={Tx`V_n=V_p\!\left(C+\dfrac{0.87(1-C)}{\sqrt{1+(d_o/D)^2}}\right)=${nx(s.VnInt,0)}\;\text{kip (tension field)}`}/>}
         <ML s={Tx`\frac{V_u}{\phi_vV_n}=\frac{${nx(scSel.Vu,0)}}{${nx(scSel.phiVn,0)}}=${nx(scSel.dc,3)}\;${pass2?'\\checkmark':'\\text{N.G.}'}`}/>
         <DLinks items={[{to:'venv',what:'V_u'}]}/>
-      <div className="mnote">V_u is the Strength I factored shear envelope at this station: |1.25(V_DC1+V_DC2)+1.50 V_DW| + 1.75|V_LL| (LL with DF and impact). φ_v = 1.0.{s.stiffened?' End-panel length taken as the first stiffener spacing d_o = '+fmt(s.doSpc,0)+' in from each support.':''}</div>
+      <div className="mnote">V_u is the Strength I factored shear envelope at this station: |{lfP(lfS(R).gDC,'1.25')}(V_DC1+V_DC2)+{lfP(lfS(R).gDW,'1.50')} V_DW| + {lfP(lfS(R).gLL,'1.75')}|V_LL| (LL with DF and impact{lfS(R).on?'; owner load rules'+(lfS(R).plOn?', LL+IM = (LL+IM+PL) − PL + PL/m':''):''}). φ_v = 1.0.{s.stiffened?' End-panel length taken as the first stiffener spacing d_o = '+fmt(s.doSpc,0)+' in from each support.':''}</div>
       </Card>;
 }
 function ShearTab({R}){
@@ -5760,7 +5815,9 @@
     <div className="bigres">
       <div className={'br '+(r.govInv>=1?'p':'f')}><div className="l">Inventory RF (gov)</div><div className="n">{fmt(r.govInv,2)}</div><div className="u">HL-93 · γLL = 1.75</div></div>
       <div className={'br '+(r.govOpr>=1?'p':'f')}><div className="l">Operating RF (gov)</div><div className="n">{fmt(r.govOpr,2)}</div><div className="u">HL-93 · γLL = 1.35</div></div>
+      {r.target&&<div className={'br '+(r.target.pass?'p':'f')}><div className="l">Owner design rating target</div><div className="n">{fmt(r.target.inv,2)} {r.target.pass?'≥':'<'} {fmt(r.target.rf,2)}</div><div className="u">inventory RF · {r.target.cite||R.lf.o} (reported)</div></div>}
     </div>}
+    {r.target&&<div className="hint" style={{margin:'-4px 0 10px'}}>Design rating target of {R.lf.o} (from GirderDetail’s owner rules): HL-93 inventory RF ≥ {fmt(r.target.rf,2)}{r.target.fat?' and fatigue RF ≥ '+fmt(r.target.fat,2)+' (fatigue not rated here; see GirderDetail GS20)':''}. The rating below is the MBE design-load rating without the owner’s multiplier or η, as GirderDetail’s GS20. Reported only; the girder is not resized for it.</div>}
     <Card title="Rating factors φc, φs" refTag="MBE 6A.4.2.3 · 6A.4.2.4">
       <div className="frow">
         <Num l="Condition factor φc" v={rq.phiC} set={v=>setRate('phiC',v)} step={0.05}/>
@@ -5900,11 +5957,12 @@
     ...(R.flex.contSpan?['The B6.2 exemption for the 1.3R_hM_y limit in continuous spans is not evaluated.']:[]),
     'Fabrication / residual camber (add per the fabricator’s practice).',
     ...(R.useExt?[]:['Continuity: the built-in analysis is a simple span; import continuous demands for continuous girders.'])];
-  const gdn=gdNoteLines(ext);
+  const gdn=gdNoteLines(ext), owl=ownLines(R);   // owl (GD49): the owner load rules from GirderDetail
   // 1. Objectives
   S('obj','Objectives',{body:<React.Fragment>
     <p className="cr-p">Design check of the built-up steel plate girder <b>{gt.girder}</b> ({gt.pos} girder, {gt.sp}){p.name?<span> of {p.name}</span>:null} to the AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), Section 6: section proportions (6.10.2), constructibility (6.10.3), Service II (6.10.4) and live-load deflection (2.5.2.6.2, optional), Strength I flexure (6.10.7, 6.10.8) and shear (6.10.9), fatigue (6.6.1, 6.10.5.3), transverse and bearing stiffeners (6.10.11), shear connectors (6.10.10){R.deckD?', transverse deck design (4.6.2.1, Table A4-1, 9.7.3)':''}, an HL-93 design-load rating (AASHTO MBE 6A) and the dead-load camber.</p>
     <p className="cr-p">Demands: {R.useExt?<span>imported continuous-member envelopes ({(ext&&ext.source)||'external analysis'}{ext&&ext.producer?', '+ext.producer:''}); see 2. Input parameters.</span>:<span>ST-Girder’s built-in simple-span analysis (dead loads from the section and deck geometry, HL-93 live load times the distribution factors).</span>} Load factors: Strength I 1.25 DC + 1.50 DW + 1.75 (LL+IM); Service II DC + DW + 1.30 (LL+IM).</p>
+    {owl&&<React.Fragment><p className="cr-p"><b>Owner load rules ({R.lf.o}{R.lf.manual?', '+R.lf.manual:''}), sent by GirderDetail with the demands and applied to every girder check here</b> (worked in 2. Input parameters, Owner load rules, and in Demands, Load combinations):</p><ul className="cr-ul">{owl.map((t,i)=><li key={i}>{t}</li>)}</ul></React.Fragment>}
     {gdn&&<React.Fragment><p className="cr-p"><b>{gdn.head}</b> {gdn.src}</p><p className="cr-p">Known differences between the two tools:</p><ul className="cr-ul">{gdn.diffs.map((d,i)=><li key={i}>{d}</li>)}</ul><p className="cr-p"><i>{gdn.tbc}</i></p></React.Fragment>}
     {R.pnaOOS&&<React.Fragment><p className="cr-p cr-st-fail"><b>{OOS_TXT}.</b> {pnaOosText(R)}</p><p className="cr-p">{PNA_OOS_NOT}</p></React.Fragment>}
     {R.warnings&&(R.warnings.fl.length+R.warnings.fat.length)>0&&<React.Fragment><p className="cr-p"><b>Warnings:</b></p><ul className="cr-ul">{[...R.warnings.fl,...R.warnings.fat].map((w,i)=><li key={i}>{w}</li>)}</ul></React.Fragment>}
@@ -5944,6 +6002,15 @@
       ['Shear studs','d = '+fmt(+cn.studD,3)+' in, h = '+fmt(+cn.studH,2)+' in, '+fmt(+cn.nRow,0)+' per row, pitch '+fmt(+cn.pitch,2)+' in'],
       ['Fatigue detail category',R.fatigue.cat],['ADTT entered',fmt(R.fatigue.adttRaw,0)+' trucks/day ('+(R.fatigue.adttIsSingleLane?'single-lane (ADTT)SL':'gross, '+R.fatigue.lanes+' lanes')+')'],
       ['Cycles per truck n / design life',fmt(R.fatigue.nCyc,2)+' / '+fmt(R.fatigue.lifeYr,0)+' yr'],['Fatigue limit state',fq.lsMode==='auto'?'auto (from the (ADTT)SL crossover)':'manual: Fatigue '+fq.lsMode]]}/>);
+    if(R.lf&&R.lf.on){ const L=R.lf, f3=v=>fmt(v,3);
+      sub(s,'Owner load rules (from GirderDetail)',(L.cite.m||L.cite.eta||'AASHTO LRFD 1.3.2.1')+' · Table 3.4.1-1',<React.Fragment><div className="cr-tab">
+        <ML s={Tx`\eta=\max(\eta_D\eta_R\eta_I,\;0.95)=\max(${nx(L.eD,2)}\cdot${nx(L.eR,2)}\cdot${nx(L.eI,2)},\;0.95)=${nx(L.eta,3)}\qquad m=${nx(L.m,2)}`}/>
+        <ML s={Tx`\text{Strength I: }\gamma_{DC}=1.25\eta=${nx(L.gDC,3)},\quad\gamma_{DW}=1.50\eta=${nx(L.gDW,3)},\quad\gamma_{LL}=1.75\eta m=1.75(${nx(L.eta,3)})(${nx(L.m,2)})=${nx(L.gLL,3)}`}/>
+        <ML s={Tx`\text{Service II: }\gamma_{LL}=1.30m=1.30(${nx(L.m,2)})=${nx(L.gS2,3)}`}/>
+        {L.plOn&&<ML s={Tx`(LL+IM)_{used}=(LL+IM+PL)-PL+\frac{PL}{m}\quad\Rightarrow\quad\gamma_{LL}(LL+IM)_{used}=1.75\eta\,m(LL+IM)+1.75\eta\,PL`}/>}
+        <ML s={Tx`\text{haunch in composite properties: }${L.h0?'0\;\text{(owner rule; entered '+nx(+dk.haunch,2)+'\;\text{in})}':nx(+dk.haunch,2)+'\;\text{in (as entered)}'}`}/></div>
+        <ul className="cr-ul">{ownLines(R).map((t,i)=><li key={i}>{t}</li>)}</ul></React.Fragment>);
+    }
     sub(s,'Rating factors','MBE 6A.4.2.3 · 6A.4.2.4',<CrKV rows={[['Condition factor φ_c',fmt(R.rating.phiC,2)],['System factor φ_s',fmt(R.rating.phiS,2)],['φ_c·φ_s used (≥ 0.85)',fmt(R.rating.phiCS,3)]]}/>);
     if(R.useExt&&ext){ const e=ext, pg=extPerGirderOf(e);
       sub(s,'Imported demands','',<React.Fragment><CrKV rows={[['Source',(e.source||'external analysis')],['Producer',e.producer||'—'],['Project',e.project||'—'],['Member',(e.member&&e.member.key)||'—'],
@@ -6024,11 +6091,19 @@
       <ML s={Tx`M_{LL+IM}=DF_m\cdot${nx(ld.hl.M,0)}=${nx(ld.MLL,0)}\;\text{k-ft}\qquad V_{LL+IM}=DF_v\cdot${nx(ld.hl.V,1)}=${nx(ld.VLL,0)}\;\text{kip}`}/>
       <div className="mnote">Type (a)/(k) steel I-girder with concrete deck, LRFD 4.6.2.2 (multiple presence included in the formulas; the lever rule includes m = 1.2). Along the span the live-load moment and shear envelopes are the HL-93 influence-line values at each station times DF_m and DF_v.</div></div>);
     const sM=at((R.flex.oos?R.stress.xGov:(R.flex.gov&&R.flex.gov.x))||L/2), sV=at(R.shearR.xGov||0);
-    sub(s,'Load combinations','Table 3.4.1-1',<div className="cr-tab">
+    const OL=R.lf&&R.lf.on? R.lf : null;   // GD49: the owner load rules (the AASHTO factors 1.25, 1.50, 1.75, 1.30 exactly as before without them)
+    if(!OL) sub(s,'Load combinations','Table 3.4.1-1',<div className="cr-tab">
       <ML s={Tx`M_u=1.25(M_{DC1}+M_{DC2})+1.50M_{DW}+1.75M_{LL+IM}=1.25(${nx(sM.M1,0)}+${nx(sM.M2,0)})+1.50(${nx(sM.Mw,0)})+1.75(${nx(sM.Ml,0)})=${nx(sM.Mu,0)}\;\text{k-ft}\quad(x=${nx(sM.x,1)}')`}/>
       <ML s={Tx`V_u=\left|1.25(V_{DC1}+V_{DC2})+1.50V_{DW}\right|+1.75\left|V_{LL+IM}\right|=\left|1.25(${nx(sV.V1,1)}+${nx(sV.V2,1)})+1.50(${nx(sV.Vw,1)})\right|+1.75(${nx(Math.abs(sV.Vl),1)})=${nx(sV.Vu,1)}\;\text{kip}\quad(x=${nx(sV.x,1)}')`}/>
       <ML s={Tx`\text{Service II: }M=M_{DC1}+M_{DC2}+M_{DW}+1.30M_{LL+IM}\;\text{(stresses accumulated on the stage sections)}`}/>
       <div className="mnote">Strength I at the governing +M station (x = {fmt(sM.x,1)} ft) and the governing shear station (x = {fmt(sV.x,1)} ft). Maximum load factors only.{R.hasNeg?' The −M_u envelope uses the −LL+IM envelope in place of +LL+IM.':''}</div></div>);
+    else sub(s,'Load combinations (owner load rules of '+OL.o+')','Table 3.4.1-1 · 1.3.2.1',<div className="cr-tab">
+      {OL.plOn&&<ML s={Tx`M_{LL+IM,used}=M_{LL+IM+PL}-M_{PL}+\frac{M_{PL}}{m}=${nx(sM.Ml,1)}-${nx(sM.qM||0,1)}+\frac{${nx(sM.qM||0,1)}}{${nx(OL.m,2)}}=${nx(sM.MlD,1)}\;\text{k-ft}\qquad V_{LL+IM,used}=${nx(Math.abs(sV.Vl),1)}-${nx(sV.qV||0,1)}+\frac{${nx(sV.qV||0,1)}}{${nx(OL.m,2)}}=${nx(Math.abs(sV.VlD),1)}\;\text{kip}`}/>}
+      <ML s={Tx`M_u=1.25\eta(M_{DC1}+M_{DC2})+1.50\eta M_{DW}+1.75\eta m\,M_{LL+IM}=${nx(OL.gDC,3)}(${nx(sM.M1,0)}+${nx(sM.M2,0)})+${nx(OL.gDW,3)}(${nx(sM.Mw,0)})+${nx(OL.gLL,3)}(${nx(sM.MlD,0)})=${nx(sM.Mu,0)}\;\text{k-ft}\quad(x=${nx(sM.x,1)}')`}/>
+      <ML s={Tx`V_u=\left|1.25\eta(V_{DC1}+V_{DC2})+1.50\eta V_{DW}\right|+1.75\eta m\left|V_{LL+IM}\right|=\left|${nx(OL.gDC,3)}(${nx(sV.V1,1)}+${nx(sV.V2,1)})+${nx(OL.gDW,3)}(${nx(sV.Vw,1)})\right|+${nx(OL.gLL,3)}(${nx(Math.abs(sV.VlD),1)})=${nx(sV.Vu,1)}\;\text{kip}\quad(x=${nx(sV.x,1)}')`}/>
+      <ML s={Tx`\text{Service II: }M=M_{DC1}+M_{DC2}+M_{DW}+1.30m\,M_{LL+IM}=M_{DC1}+M_{DC2}+M_{DW}+${nx(OL.gS2,3)}M_{LL+IM}\;\text{(stresses accumulated on the stage sections)}`}/>
+      <div className="mnote">Owner load rules of {OL.o} from GirderDetail (factors worked in 2. Input parameters, Owner load rules): η = {fmt(OL.eta,3)} on the Strength I maximum factors, design load multiplier m = {fmt(OL.m,2)} on HL-93 LL+IM at Strength I and Service II{OL.plOn?' (not on the pedestrian load PL)':''}. Live-load deflection, fatigue, constructibility and the load rating use neither η nor m.</div>
+      <div className="mnote">Strength I at the governing +M station (x = {fmt(sM.x,1)} ft) and the governing shear station (x = {fmt(sV.x,1)} ft). Maximum load factors only.{R.hasNeg?' The −M_u envelope uses the −LL+IM envelope in place of +LL+IM.':''}</div></div>);
     const locs=[]; const add=(lab,x)=>{ if(x==null||!isFinite(x)) return; const i=crNear(stn,x); const e=locs.find(l=>l.i===i); if(e) e.lab+=', '+lab; else locs.push({i,lab}); };
     add('left support',0); add('midspan',L/2); add('right support',L); add('governing +M',R.flex.gov&&R.flex.gov.x);
     if(R.hasNeg&&R.neg) add('governing −M',R.neg.negBGov.x); add('governing shear',R.shearR.xGov); add('Service II',R.stress.s2Gov&&R.stress.s2Gov.x);
@@ -6119,7 +6194,9 @@
       {r.oos? <div className="cr-line cr-res"><div className="cr-d">Governing rating factor:</div><div className="cr-m">not reported (positive-moment rating out of scope: plastic neutral axis below the web)</div>
         <div className="cr-r cr-st-fail"><b>{OOS_TXT}</b></div></div>
       : <div className="cr-line cr-res"><div className="cr-d">Governing rating factor:</div><div className="cr-m">Inventory <b>{fmt(r.govInv,2)}</b>; Operating <b>{fmt(r.govOpr,2)}</b></div>
-        <div className={'cr-r'+(ok(r.govInv)?'':' cr-st-fail')}><b>{ok(r.govInv)?'RF ≥ 1.00':'RF < 1.00'}</b></div></div>}</React.Fragment>);
+        <div className={'cr-r'+(ok(r.govInv)?'':' cr-st-fail')}><b>{ok(r.govInv)?'RF ≥ 1.00':'RF < 1.00'}</b></div></div>}
+      {r.target&&<div className="cr-line cr-res"><div className="cr-d">Owner design rating target ({r.target.cite||R.lf.o}; see 2. Input parameters, Owner load rules):</div><div className="cr-m">Inventory RF {fmt(r.target.inv,2)} {r.target.pass?'≥':'<'} {fmt(r.target.rf,2)} (reported; the girder is not resized for it)</div>
+        <div className={'cr-r'+(r.target.pass?'':' cr-st-fail')}><b>{r.target.pass?'meets the target':'below the target'}</b></div></div>}</React.Fragment>);
   }
   // 15. Camber
   if(o.camber){ const s=S('camber','Camber (dead-load deflection)',{ref:'stage sections · double integration'});
@@ -6133,7 +6210,7 @@
     <h3>Method</h3><ul className="cr-ul">
       <li>Stresses accumulate by construction stage on the section active at each stage: DC1 (self-weight, wet deck, added DC1) on the bare steel; DC2 and DW on the long-term composite (3n); live load on the short-term composite (n); in −M regions the cracked steel + longitudinal rebar section (concrete neglected; 6.10.1.1.1c).</li>
       <li>Stations: the span tenth-and-twentieth points plus both sides of every flange transition; each check is evaluated at every station with that station’s plates and demands, and the worst ratio is reported with its location.</li>
-      <li>Strength I = 1.25 DC + 1.50 DW + 1.75 (LL+IM); Service II = DC + DW + 1.30 (LL+IM); constructibility = 1.25 DC + 1.50 construction live load; maximum load factors only. φ_f = φ_v = 1.0, φ_sc = 0.85.</li>
+      <li>Strength I = {lfP(lfS(R).gDC,'1.25')} DC + {lfP(lfS(R).gDW,'1.50')} DW + {lfP(lfS(R).gLL,'1.75')} (LL+IM); Service II = DC + DW + {lfP(lfS(R).gS2,'1.30')} (LL+IM){lfS(R).on?' (owner load rules from GirderDetail, see 2. Input parameters)':''}; constructibility = 1.25 DC + 1.50 construction live load; maximum load factors only. φ_f = φ_v = 1.0, φ_sc = 0.85.</li>
       <li>Positive flexure: compact composite sections on the plastic moment (6.10.7.1, with the ductility reduction and, in continuous spans, 1.3R_hM_y); noncompact or noncomposite sections on the flange stresses (6.10.7.2, 6.10.8). Negative flexure: bottom flange F_nc = min(FLB, LTB) over L_b with C_b = 1.0 (6.10.8.2). Shear: end-panel C·V_p everywhere (conservative), tension field shown for interior panels.</li>
       <li>Camber: double integration of M/(E·I) on a fine station set on the stage sections (DC1 bare, DC2 and DW 3n).</li>
       <li>Sign convention: moments sagging +; stresses f_B + = bottom tension, f_T + = top compression; deflections + down.</li>
@@ -6632,7 +6709,11 @@
     if(p.factored!==false) return 'the forces must be unfactored (factored:false)';
     const keys=['x','M_DC1','V_DC1','M_DC2','V_DC2','M_DW','V_DW','M_LLpos','M_LLneg','V_LLpos','V_LLneg'];
     for(const st of p.stations){ for(const k of keys) if(typeof st[k]!=='number'||!isFinite(st[k])) return 'station value '+k+' is not a number';
-      for(const k of ['M_FATpos','M_FATneg','V_FATpos','V_FATneg','M_DC1steel','V_DC1steel','M_DC1wet','V_DC1wet']) if(st[k]!==undefined&&!(typeof st[k]==='number'&&isFinite(st[k]))) return 'station value '+k+' is not a number'; }
+      for(const k of ['M_FATpos','M_FATneg','V_FATpos','V_FATneg','M_DC1steel','V_DC1steel','M_DC1wet','V_DC1wet','M_PLpos','M_PLneg','V_PLpos','V_PLneg']) if(st[k]!==undefined&&!(typeof st[k]==='number'&&isFinite(st[k]))) return 'station value '+k+' is not a number'; }
+    if(p.ownerRules!==undefined){ const o=p.ownerRules, ok=v=>v===undefined||v===null||(typeof v==='number'&&isFinite(v)&&v>0);   // GD49 (optional)
+      if(!o||typeof o!=='object') return 'ownerRules is not an object';
+      if(!ok(o.llMultiplier&&o.llMultiplier.m)||!['D','R','I','max','min'].every(k=>ok(o.eta&&o.eta[k]))||!ok(o.ratingTarget&&o.ratingTarget.rf)) return 'ownerRules: a factor is not a positive number';
+      if(o.haunchInProperties!==undefined&&typeof o.haunchInProperties!=='boolean') return 'ownerRules.haunchInProperties must be true or false'; }
     const sp=externalSpans(p); if(!sp.length||sp.some(s=>!(s.len>0))) return 'invalid span layout';
     return null; };
   const gdAdopt=(p,how,auto)=>{
@@ -6673,6 +6754,7 @@
       +'Imported demands: '+p.stations.length+' stations, '+spans.length+' span'+(spans.length>1?'s':'')+' ('+spans.map(s=>fmt(s.len,1)).join(', ')+' ft); span 1 is selected.\n'
       +'Per girder, unfactored; LL+IM with GirderDetail\u2019s distribution factors (not applied again here)'+(p.stations.some(s=>s.M_FATpos!==undefined)?'; fatigue moments and shears for the Fatigue and stud checks':'')+'.\n'
       +(secNew?'Plates: web and flange segments from the girder\u2019s plate zones.\n':'')
+      +(p.ownerRules?(()=>{ const L={...ownLFOf(p),...lfFac(ownLFOf(p))}; return 'Owner load rules ('+(L.o||'?')+'), applied to the girder checks: \u03b7 = '+fmt(L.eta,3)+' on the Strength I factors, design load multiplier m = '+fmt(L.m,2)+' on HL-93 LL+IM at Strength I and Service II'+(L.m!==1&&p.pedestrianInLL===true&&p.stations.some(s=>s.M_PLpos!==undefined)?' (not on the pedestrian load)':'')+', haunch '+(L.h0?'0':'as entered')+' in composite properties'+(L.rt?', design rating target RF \u2265 '+fmt(L.rt,2):'')+'.\n'; })():'')
       +(rows.length?'\nDesign inputs that change:\n'+rows.join('\n')+'\n':'')
       +((p.notes||[]).length?'\nNotes from GirderDetail:\n- '+p.notes.join('\n- ')+'\n':'')
       +'\nApply?';
@@ -6882,6 +6964,7 @@
           : <span key={i} className={'chip '+(c.pass?'p':'f')} title={`${c.n}: ${fmt(c.v,2)} vs ${fmt(c.lim,2)} ${c.u} · ${c.ref}`}><b>{c.pass?'✓':'✕'}</b>{c.t||c.n} <em>{fmt(c.r,2)}</em></span>)}
       </div>
       {R.pnaOOS&&<div className="noprint" style={{padding:'10px 24px 0'}}><PnaOos R={R} style={{marginBottom:0}}/></div>}
+      {R.ok&&R.lf&&R.lf.on&&<div className="noprint" style={{padding:'10px 24px 0'}}><OwnBanner R={R} go={setTab}/></div>}
       <div className="tabs noprint">{TABS.map(([k,l])=>
         <button key={k} className={'tab'+(tab===k?' on':'')+(LIVE[k]?'':' soon')} onClick={()=>setTab(k)}>{l}</button>)}</div>
 
```

## 2026-10-15 — PR: claude/stgirder-deck-owner (GD49 deck: the owner load rules from GirderDetail applied to the transverse Deck design; engineer decision 2026-10-15; PR link added after merge)

### GD49-D. Owner load rules (`ownerRules`) on the transverse deck design   [LOAD FACTOR CHANGE for GirderDetail imports carrying ownerRules — §4 callout]
- **Problem / decision:** GD49 (#234) applied GirderDetail's owner rules (η, RIDOT design load multiplier m) to the girder checks only; the Deck tab (transverse deck, equivalent strip) kept 1.25 / 1.50 / 1.75. Engineer decision 2026-10-15: RIDOT BDM 3.4.1.2 applies m to "all bridge components" (HL-93 LL+IM, Strength and Service; not deflection, fatigue, rating), and η (AASHTO LRFD 1.3.2.1) applies at Strength, so both apply to the deck design whenever ST-Girder has owner rules from GirderDetail. More conservative (RIDOT and CTDOT with η = 1.05; MassDOT/AASHTO with η = 1, m = 1: unchanged).
- **Where:** `deckDesign` (anchor `function deckDesign(inp,F){`): new argument `F` = the Strength I factors of `computeAll` (`lfFac(OWN)`: γ_DC = 1.25η, γ_DW = 1.50η, γ_LL = 1.75ηm; exactly 1.25, 1.50, 1.75 without owner rules); `Mu_pos`, `Mu_neg`, `Mu_oh` use them; returned as `gDC, gDW, gLL`. `computeAll` (anchor `deckD=deckDesign(inp,LFc);`). Display: `deckWorkedDeriv` (factors in the step 1 title and equation, the η/m line and an owner note with links), `DeckTab` (prop `go`; hint text factors; owner callout with links to Inputs and Report), `ownLines` (new deck line, so the banner, Inputs tab and report 1/2 list it), `OwnBanner` (text and a Deck link), report 1 "Owner load rules" paragraph, report Deck design "Method" paragraph (owner factors; "see 2. Input parameters — Owner load rules"), the pull/apply message ("applied to the girder checks and the transverse deck design").
- **Not changed:** the deck has no Service limit-state check in ST-Girder, so only Strength I changes; the A4-1 table values, the overhang wheel moment (IM 1.33, MPF 1.20), the dead-load moments and the resistance φM_n are unchanged. Haunch 0 (h0) does not touch the deck design (it uses t_s only). The owner rules apply only while a GirderDetail import with `ownerRules` is in use (same `OWN` as the girder, `ownLFOf(inp.external)`).
- **Before:**
  ```js
  function deckDesign(inp){
  ...
    const Mu_pos=1.25*MDC_pos+1.50*MDW_pos+1.75*MLL_pos;
    const Mu_neg=1.25*MDC_neg+1.50*MDW_neg+1.75*MLL_neg;
  ...
    const Mu_oh=1.25*MohDC+1.50*MohDW+1.75*Math.max(MohLL,0);
  ...
      deckD=deckDesign(inp);
  ```
- **After:**
  ```js
  function deckDesign(inp,F){
    const gDC=F?F.gDC:1.25, gDW=F?F.gDW:1.50, gLL=F?F.gLL:1.75;
  ...
    const Mu_pos=gDC*MDC_pos+gDW*MDW_pos+gLL*MLL_pos;
    const Mu_neg=gDC*MDC_neg+gDW*MDW_neg+gLL*MLL_neg;
  ...
    const Mu_oh=gDC*MohDC+gDW*MohDW+gLL*Math.max(MohLL,0);
  ...
      deckD=deckDesign(inp,LFc);
  ```
  Without owner rules `lfFac(LF_ST)` gives 1.25·1, 1.5·1, 1.75·1·1 = exactly 1.25, 1.5, 1.75 (bit-identical products).
- **Governing provision:** RIDOT Bridge Design Manual (April 2026) 3.4.1.2 (design load multiplier 1.2 on HL-93 LL+IM, all bridge components, Strength and Service); AASHTO LRFD 10th Ed. (2024) 1.3.2.1 (Eq. 1.3.2.1-2, η ≥ 0.95), Table 3.4.1-1 (Strength I), 4.6.2.1 and Table A4-1 (deck strip moments), 4.6.2.1.3 (overhang strip 45.0 + 10.0X); RIDOT BDM 1.3.1–1.3.3 (η_D, η_R, η_I).
- **Check case (built-in GirderDetail example, RIDOT, η_I = Yes → η = 1.05, m = 1.2; G2 sent to ST-Girder; S = 9.50 ft, t_s = 8 in, w_c = 0.150 kcf, FWS 25 psf, b_ft = 16 in → x = b_ft/4 = 4.0 in; top bars 0.31 in² @ 6 in, cover 2.5 in, f′_c 4 ksi, f_y 60 ksi):**
  - Interior −M (top bars): M_DC = 0.100(9.50²)/10 = 0.9025, M_DW = 0.025(9.50²)/10 = 0.2256 k-ft/ft; M_LL+IM (A4-1, S = 9.50 ft, between x = 3 in 6.31 and x = 6 in 5.46) = 6.31 − (0.85)(1/3) = 6.0267 k-ft/ft.
  - Before: M_u = 1.25(0.9025) + 1.50(0.2256) + 1.75(6.0267) = 1.1281 + 0.3384 + 10.5467 = **12.013** k-ft/ft; φM_n = 13.197 k-ft/ft; D/C **0.910** (PASS).
  - After: γ_DC = 1.25(1.05) = 1.3125, γ_DW = 1.50(1.05) = 1.575, γ_LL = 1.75(1.05)(1.2) = 2.205; M_u = 1.3125(0.9025) + 1.575(0.2256) + 2.205(6.0267) = 1.1845 + 0.3554 + 13.2888 = **14.829** k-ft/ft; D/C **1.124 FAIL**.
  - Interior +M: 12.866 → 15.931 k-ft/ft (D/C 0.740 → 0.917). Overhang: M_DC = 1.125, M_DW = 0.0281, M_LL+IM = 1.33(1.2)(16)(0.50)/(50.0/12) = 3.0643 k-ft/ft; M_u 1.25(1.125) + 1.50(0.0281) + 1.75(3.0643) = 6.811 → 1.3125(1.125) + 1.575(0.0281) + 2.205(3.0643) = 8.278 k-ft/ft (D/C 0.516 → 0.627).
  - CTDOT (η = 1.05, m = 1): −M 12.013 → 12.614 (D/C 0.910 → 0.956). xsA RIDOT G1 (exterior, wider overhang): overhang 9.316 → 11.390 (0.706 → 0.863).
- **Check case (old payloads / no ownerRules):** payloads sent by GirderDetail before #234 (built-in RIDOT G2, xsA RIDOT G1, built-in AASHTO G2), the new payloads with `ownerRules` deleted (RIDOT, xsA RIDOT, MassDOT, CTDOT, AASHTO), new AASHTO and MassDOT payloads (η = 1, m = 1), and ST-Girder's defaults: the whole `computeAll` result **identical** to main (JSON compare; the only new fields are `deckD.gDC/gDW/gLL` = 1.25/1.5/1.75), and the Deck tab, the overhang worked case, the report deck section, the owner banner and report 1/2 texts identical to main.
- **How verified:** Babel transform of the whole JSX script (main, branch); Node: `computeAll` main vs branch on the defaults and on the session inputs of 13 headless runs (above): identical except the deck results of RIDOT/CTDOT payloads, and nothing else differs in those; headless Chromium (payload auto-applied through `#gdpull`), main vs branch: texts as above, no console errors; GirderDetail → ST-Girder auto-open test 28/28 (http and file); screenshots of the Deck tab, the overhang worked case and the report deck section checked.
- **Other copies:** none in this tool. GirderDetail (`Steel Bridge Beam Modules.html`) has no transverse deck design module; its "Deck overhang" module is the exterior-girder deck-placement constructibility check (6.10.3), to which RIDOT 3.4.1.2 does not apply m ("deck placement" excluded) — not changed.
- **Open items:** none. (Closes the open item of the GD49 entry above: "the Deck tab is not changed by the owner rules".)

Diff (main → branch):

```diff
diff --git a/stgirder.html b/stgirder.html
index 63575b9..9f357b4 100644
--- a/stgirder.html
+++ b/stgirder.html
@@ -2409,2 +2409,3 @@ function ownLines(R){ const L=R&&R.lf; if(!L||!L.on) return null; const f3=v=>fm
   out.push(L.h0? 'Haunch taken as 0 in every composite section property (elastic n and 3n sections, cracked section, M_p)'+(L.cite.h?' ('+L.cite.h+')':'')+'; its weight is in the imported DC1; the drawing shows the haunch as entered.' : 'Haunch in the composite section properties as entered.');
+  if(R.deckD) out.push('Transverse deck design (Deck tab): Strength I M_u = '+lfP(R.deckD.gDC,'1.25')+' M_DC + '+lfP(R.deckD.gDW,'1.50')+' M_DW + '+lfP(R.deckD.gLL,'1.75')+' M_LL+IM (1.25η, 1.50η, 1.75ηm) for the interior bays (Table A4-1) and the overhang wheel load; the deck has no Service check in this tool.');
   if(L.rt) out.push('Design rating target: HL-93 inventory RF ≥ '+fmt(L.rt,2)+(L.rtFat?' (fatigue '+fmt(L.rtFat,2)+')':'')+(L.cite.rt?' ('+L.cite.rt+')':'')+'; checked on the Rating tab, reported only (no resizing).');
@@ -2416,3 +2417,3 @@ function OwnBanner({R,go}){ const L=R&&R.ok&&R.lf; if(!L||!L.on) return null; co
     <ul style={{fontSize:11.5,margin:'4px 0 0 18px',lineHeight:1.6,padding:0}}>{ls.map((t,i)=><li key={i}>{t}</li>)}</ul>
-    <div style={{fontSize:11.5,marginTop:4}}>Applied to every girder check while GirderDetail’s demands are in use; worked in the report, <i>2. Input parameters — Owner load rules</i> and <i>Demands — Load combinations</i>.{go?<span> Go to: <a href="#" onClick={e=>{e.preventDefault();go('inputs');}}>Inputs (imported demands)</a> · <a href="#" onClick={e=>{e.preventDefault();go('diagrams');}}>Diagrams (M_u, V_u)</a>{L.rt?<span> · <a href="#" onClick={e=>{e.preventDefault();go('rating');}}>Rating (target)</a></span>:null} · <a href="#" onClick={e=>{e.preventDefault();go('report');}}>Report</a></span>:null}</div>
+    <div style={{fontSize:11.5,marginTop:4}}>Applied to every girder check{R.deckD?' and to the transverse deck design':''} while GirderDetail’s demands are in use; worked in the report, <i>2. Input parameters — Owner load rules</i> and <i>Demands — Load combinations</i>.{go?<span> Go to: <a href="#" onClick={e=>{e.preventDefault();go('inputs');}}>Inputs (imported demands)</a> · <a href="#" onClick={e=>{e.preventDefault();go('diagrams');}}>Diagrams (M_u, V_u)</a>{R.deckD?<span> · <a href="#" onClick={e=>{e.preventDefault();go('deck');}}>Deck</a></span>:null}{L.rt?<span> · <a href="#" onClick={e=>{e.preventDefault();go('rating');}}>Rating (target)</a></span>:null} · <a href="#" onClick={e=>{e.preventDefault();go('report');}}>Report</a></span>:null}</div>
   </div>; }
@@ -2654,3 +2655,6 @@ function deckTableA4(S,x){
 // Ported from PS-Girder; the deck is reinforced concrete regardless of the girder material.
-function deckDesign(inp){
+// F (GD49 deck, engineer decision 2026-10-15): the Strength I factors {gDC, gDW, gLL} of computeAll (lfFac): 1.25η, 1.50η, 1.75ηm under the owner
+// load rules from GirderDetail; exactly 1.25, 1.50, 1.75 otherwise (or when F is not given).
+function deckDesign(inp,F){
+  const gDC=F?F.gDC:1.25, gDW=F?F.gDW:1.50, gLL=F?F.gLL:1.75;
   const D=inp.deck, S=inp.geom.S, ts=+D.ts, fcd=+D.fc, fy=+D.fyd, wcd=+D.wc;
@@ -2673,5 +2677,5 @@ function deckDesign(inp){
   const SWpos=26+6.6*S, SWneg=48+3.0*S;                 // in
-  // ---- Strength I: DC 1.25, DW 1.50, LL+IM 1.75 ----
-  const Mu_pos=1.25*MDC_pos+1.50*MDW_pos+1.75*MLL_pos;
-  const Mu_neg=1.25*MDC_neg+1.50*MDW_neg+1.75*MLL_neg;
+  // ---- Strength I: DC 1.25, DW 1.50, LL+IM 1.75 (GD49: × η, LL+IM × ηm under the owner load rules) ----
+  const Mu_pos=gDC*MDC_pos+gDW*MDW_pos+gLL*MLL_pos;
+  const Mu_neg=gDC*MDC_neg+gDW*MDW_neg+gLL*MLL_neg;
   const cap=(barA,sp,cover,Mu)=>{
@@ -2699,3 +2703,3 @@ function deckDesign(inp){
   const MohLL=1.33*1.2*16*Xoh/(SWoh/12);                // IM 1.33, MPF 1.20, 16-kip wheel
-  const Mu_oh=1.25*MohDC+1.50*MohDW+1.75*Math.max(MohLL,0);
+  const Mu_oh=gDC*MohDC+gDW*MohDW+gLL*Math.max(MohLL,0);
   const ohCap=cap(+D.barTop,+D.sTop,+D.coverT,Mu_oh);
@@ -2704,3 +2708,3 @@ function deckDesign(inp){
           MDC_pos,MDC_neg,MDW_pos,MDW_neg,A4,xneg,xnegAuto,dsRule,bft,
-          pos,neg,oh,bBar,Pbar,Xoh,SWoh,MohDC,MohDW,MohDL,MohLL,Mu_oh,ohCap,distPct,fcd,fy,ts};
+          pos,neg,oh,bBar,Pbar,Xoh,SWoh,MohDC,MohDW,MohDL,MohLL,Mu_oh,ohCap,distPct,fcd,fy,ts,gDC,gDW,gLL};
 }
@@ -3443,3 +3447,3 @@ function computeAll(inp){
     if(deck.deckOn && inp.deck.designOn){
-      deckD=deckDesign(inp);
+      deckD=deckDesign(inp,LFc);   // GD49 deck: the owner Strength I factors (1.25, 1.50, 1.75 without owner rules)
       checks.push({n:'Deck +M (bottom bars)', t:'Deck +M', v:deckD.Mu_pos, lim:deckD.pos.phiMn, r:deckD.pos.dc, u:'k-ft/ft', ref:'9.7.3', loc:0});
@@ -5255,3 +5259,5 @@ function deckCases(d){
 }
-function deckWorkedDeriv(R,CS,right){ const d=R.deckD, cc=CS.c;
+function deckWorkedDeriv(R,CS,right,goOwn){ const d=R.deckD, cc=CS.c;
+  // GD49 deck: the Strength I factors used (text exactly '1.25', '1.50', '1.75' without owner load rules)
+  const L=lfS(R), own=!!L.on, fD=lfP(d.gDC,'1.25'), fW=lfP(d.gDW,'1.50'), fL=lfP(d.gLL,'1.75');
   return (    <Deriv title="Worked deck design at a selected case"
@@ -5271,4 +5277,6 @@ function deckWorkedDeriv(R,CS,right){ const d=R.deckD, cc=CS.c;
       ]}/>
-      <SG n="1">Factored design moment — Strength I (DC 1.25, DW 1.50, LL+IM 1.75)</SG>
-      <ML s={Tx`M_u=1.25M_{DC}+1.50M_{DW}+1.75M_{LL+IM}=1.25(${nx(CS.MDC,2)})+1.50(${nx(CS.MDW,2)})+1.75(${nx(CS.MLL,2)})=${nx(CS.Mu,2)}\;\text{k-ft/ft}`}/>
+      <SG n="1">Factored design moment — Strength I (DC {fD}, DW {fW}, LL+IM {fL})</SG>
+      {own&&<ML s={Tx`\gamma_{DC}=1.25\eta=1.25(${nx(L.eta,3)})=${fD},\quad\gamma_{DW}=1.50\eta=${fW},\quad\gamma_{LL}=1.75\eta m=1.75(${nx(L.eta,3)})(${nx(L.m,2)})=${fL}`}/>}
+      <ML s={Tx`M_u=${fD}M_{DC}+${fW}M_{DW}+${fL}M_{LL+IM}=${fD}(${nx(CS.MDC,2)})+${fW}(${nx(CS.MDW,2)})+${fL}(${nx(CS.MLL,2)})=${nx(CS.Mu,2)}\;\text{k-ft/ft}`}/>
+      {own&&<div className="mnote">Owner load rules from GirderDetail ({L.o||'—'}): η = {fmt(L.eta,3)} on the Strength I factors (AASHTO LRFD 1.3.2.1) and the design load multiplier m = {fmt(L.m,2)} on the HL-93 LL+IM{L.cite.m?' ('+L.cite.m+')':''}; M_LL+IM above is the value without m ({CS.src}). See the calculation report, 2. Input parameters — Owner load rules{goOwn?<span> (<a href="#" onClick={e=>{e.preventDefault();goOwn('report');}}>Report</a> · <a href="#" onClick={e=>{e.preventDefault();goOwn('inputs');}}>Inputs</a>)</span>:null}.</div>}
       <SG n="2">Flexural resistance of the deck section</SG>
@@ -5282,3 +5290,3 @@ function deckWorkedDeriv(R,CS,right){ const d=R.deckD, cc=CS.c;
 }
-function DeckTab({R}){
+function DeckTab({R,go}){
   if(!R.ok) return null;
@@ -5299,5 +5307,8 @@ function DeckTab({R}){
     <Card title="What this check is" refTag="LRFD 4.6.2.1 · equivalent-strip method">
-      <div className="hint">The deck spans transversely between girders and is designed per foot of width. For the <b>interior bays</b> the live-load moments come straight from <b>AASHTO Table A4-1</b>, interpolated on the girder spacing S = {fmt(d.Ls,2)} ft and on the negative-moment design section x = {fmt(d.xneg,1)} in ({d.dsRule}); those tabulated values already include the multiple presence factors and the 33% dynamic load allowance, so no further impact is applied. The <b>overhang</b> is not covered by A4-1, so a 16-kip wheel placed 1 ft clear of the railing face is spread over the 45.0 + 10.0X strip (X = {fmt(d.Xoh,2)} ft, SW = {fmt(d.SWoh,1)} in) with IM and the one-lane multiple presence factor applied by hand. Dead load is the slab as DC and the future wearing surface as DW, factored 1.25 and 1.50 respectively. Distribution reinforcement (9.7.3.2) = min(220/√S, 67%) = <b>{fmt(d.distPct,0)}%</b> of the bottom steel, placed parallel to traffic.</div>
+      <div className="hint">The deck spans transversely between girders and is designed per foot of width. For the <b>interior bays</b> the live-load moments come straight from <b>AASHTO Table A4-1</b>, interpolated on the girder spacing S = {fmt(d.Ls,2)} ft and on the negative-moment design section x = {fmt(d.xneg,1)} in ({d.dsRule}); those tabulated values already include the multiple presence factors and the 33% dynamic load allowance, so no further impact is applied. The <b>overhang</b> is not covered by A4-1, so a 16-kip wheel placed 1 ft clear of the railing face is spread over the 45.0 + 10.0X strip (X = {fmt(d.Xoh,2)} ft, SW = {fmt(d.SWoh,1)} in) with IM and the one-lane multiple presence factor applied by hand. Dead load is the slab as DC and the future wearing surface as DW, factored {lfP(d.gDC,'1.25')} and {lfP(d.gDW,'1.50')} respectively{lfS(R).on?<span>, and the live load {lfP(d.gLL,'1.75')} (owner load rules, below)</span>:null}. Distribution reinforcement (9.7.3.2) = min(220/√S, 67%) = <b>{fmt(d.distPct,0)}%</b> of the bottom steel, placed parallel to traffic.</div>
     </Card>
 
+    {lfS(R).on&&(()=>{ const L=lfS(R); return <div className="callout" style={{borderLeftColor:'#7c3aed',background:'#f5f3ff'}}>
+      <b>Owner load rules from GirderDetail ({L.o||'—'}) applied to the deck design</b> (engineer decision 2026-10-15): Strength I M_u = 1.25η M_DC + 1.50η M_DW + 1.75ηm M_LL+IM = <b>{lfP(d.gDC,'1.25')}</b> M_DC + <b>{lfP(d.gDW,'1.50')}</b> M_DW + <b>{lfP(d.gLL,'1.75')}</b> M_LL+IM, with η = {fmt(L.eta,3)} (AASHTO LRFD 1.3.2.1) and the design load multiplier m = {fmt(L.m,2)} on the HL-93 LL+IM{L.cite.m?' ('+L.cite.m+')':''}, for the interior bays (Table A4-1) and the overhang wheel load alike. The deck has no Service limit-state check in this tool, so only Strength I changes.{go?<span> Go to: <a href="#" onClick={e=>{e.preventDefault();go('inputs');}}>Inputs (owner load rules)</a> · <a href="#" onClick={e=>{e.preventDefault();go('report');}}>Report (2. Input parameters — Owner load rules; Deck design)</a></span>:null}</div>; })()}
+
     <Card title="Summary — all deck design cases" refTag="dead + HL-93 · per foot of strip">
@@ -5313,3 +5324,3 @@ function DeckTab({R}){
         {CASES.map(x=><option key={x.k} value={x.k}>{x.l}</option>)}
-      </select>)}
+      </select>,go)}
 
@@ -5964,3 +5975,3 @@ function crModel(R,inp,o){
     <p className="cr-p">Demands: {R.useExt?<span>imported continuous-member envelopes ({(ext&&ext.source)||'external analysis'}{ext&&ext.producer?', '+ext.producer:''}); see 2. Input parameters.</span>:<span>ST-Girder’s built-in simple-span analysis (dead loads from the section and deck geometry, HL-93 live load times the distribution factors).</span>} Load factors: Strength I 1.25 DC + 1.50 DW + 1.75 (LL+IM); Service II DC + DW + 1.30 (LL+IM).</p>
-    {owl&&<React.Fragment><p className="cr-p"><b>Owner load rules ({R.lf.o}{R.lf.manual?', '+R.lf.manual:''}), sent by GirderDetail with the demands and applied to every girder check here</b> (worked in 2. Input parameters, Owner load rules, and in Demands, Load combinations):</p><ul className="cr-ul">{owl.map((t,i)=><li key={i}>{t}</li>)}</ul></React.Fragment>}
+    {owl&&<React.Fragment><p className="cr-p"><b>Owner load rules ({R.lf.o}{R.lf.manual?', '+R.lf.manual:''}), sent by GirderDetail with the demands and applied to every girder check here{R.deckD?' and to the transverse deck design':''}</b> (worked in 2. Input parameters, Owner load rules, and in Demands, Load combinations{R.deckD?'; deck: Deck design (transverse)':''}):</p><ul className="cr-ul">{owl.map((t,i)=><li key={i}>{t}</li>)}</ul></React.Fragment>}
     {gdn&&<React.Fragment><p className="cr-p"><b>{gdn.head}</b> {gdn.src}</p><p className="cr-p">Known differences between the two tools:</p><ul className="cr-ul">{gdn.diffs.map((d,i)=><li key={i}>{d}</li>)}</ul><p className="cr-p"><i>{gdn.tbc}</i></p></React.Fragment>}
@@ -6166,3 +6177,3 @@ function crModel(R,inp,o){
       const d=R.deckD;
-      sub(s,'Method','4.6.2.1 · Table A4-1',<p className="cr-p">Equivalent-strip method per foot of width. Interior-bay live-load moments from AASHTO Table A4-1 at S = {fmt(d.Ls,2)} ft and the −M design section x = {fmt(d.xneg,1)} in ({d.dsRule}); multiple presence and the 33% dynamic load allowance are already in the table. Overhang: 16-kip wheel 1 ft from the railing face on the 45.0 + 10.0X strip (X = {fmt(d.Xoh,2)} ft, SW = {fmt(d.SWoh,1)} in) with IM and the one-lane multiple presence factor. Distribution reinforcement (9.7.3.2) = {fmt(d.distPct,0)}% of the bottom steel.</p>);
+      sub(s,'Method','4.6.2.1 · Table A4-1',<p className="cr-p">Equivalent-strip method per foot of width. Interior-bay live-load moments from AASHTO Table A4-1 at S = {fmt(d.Ls,2)} ft and the −M design section x = {fmt(d.xneg,1)} in ({d.dsRule}); multiple presence and the 33% dynamic load allowance are already in the table. Overhang: 16-kip wheel 1 ft from the railing face on the 45.0 + 10.0X strip (X = {fmt(d.Xoh,2)} ft, SW = {fmt(d.SWoh,1)} in) with IM and the one-lane multiple presence factor. Distribution reinforcement (9.7.3.2) = {fmt(d.distPct,0)}% of the bottom steel.{lfS(R).on?<span> Strength I with the owner load rules from GirderDetail: M_u = {lfP(d.gDC,'1.25')} M_DC + {lfP(d.gDW,'1.50')} M_DW + {lfP(d.gLL,'1.75')} M_LL+IM (1.25η, 1.50η, 1.75ηm; η = {fmt(lfS(R).eta,3)}, m = {fmt(lfS(R).m,2)}); see 2. Input parameters — Owner load rules.</span>:null}</p>);
       deckCases(d).forEach((CS,k)=>sub(s,CS.l,k===2?'13.4 · 4.6.2.1.3':'9.7.3 · Table A4-1',<CrTab el={deckWorkedDeriv(R,CS)}/>,ck(['Deck +M','Deck −M','Deck OH'][k]))); }
@@ -6756,3 +6767,3 @@ function App(){
       +(secNew?'Plates: web and flange segments from the girder\u2019s plate zones.\n':'')
-      +(p.ownerRules?(()=>{ const L={...ownLFOf(p),...lfFac(ownLFOf(p))}; return 'Owner load rules ('+(L.o||'?')+'), applied to the girder checks: \u03b7 = '+fmt(L.eta,3)+' on the Strength I factors, design load multiplier m = '+fmt(L.m,2)+' on HL-93 LL+IM at Strength I and Service II'+(L.m!==1&&p.pedestrianInLL===true&&p.stations.some(s=>s.M_PLpos!==undefined)?' (not on the pedestrian load)':'')+', haunch '+(L.h0?'0':'as entered')+' in composite properties'+(L.rt?', design rating target RF \u2265 '+fmt(L.rt,2):'')+'.\n'; })():'')
+      +(p.ownerRules?(()=>{ const L={...ownLFOf(p),...lfFac(ownLFOf(p))}; return 'Owner load rules ('+(L.o||'?')+'), applied to the girder checks and the transverse deck design: \u03b7 = '+fmt(L.eta,3)+' on the Strength I factors, design load multiplier m = '+fmt(L.m,2)+' on HL-93 LL+IM at Strength I and Service II'+(L.m!==1&&p.pedestrianInLL===true&&p.stations.some(s=>s.M_PLpos!==undefined)?' (not on the pedestrian load)':'')+', haunch '+(L.h0?'0':'as entered')+' in composite properties'+(L.rt?', design rating target RF \u2265 '+fmt(L.rt,2):'')+'.\n'; })():'')
       +(rows.length?'\nDesign inputs that change:\n'+rows.join('\n')+'\n':'')
@@ -6984,3 +6995,3 @@ function App(){
         {tab==='camber'&&<CamberTab R={R}/>}
-        {tab==='deck'&&<DeckTab R={R}/>}
+        {tab==='deck'&&<DeckTab R={R} go={setTab}/>}
         {tab==='fatigue'&&<FatigueTab R={R}/>}
```

## 2026-10-15 — Report §1 load-factor sentence shows the owner factors (RF1, display only, Tier 0)
- **Function / anchor:** `ReportTab` calc-sheet builder, §1 Objectives paragraph, text `Load factors: Strength I`.
- **Before:** fixed text `Load factors: Strength I 1.25 DC + 1.50 DW + 1.75 (LL+IM); Service II DC + DW + 1.30 (LL+IM).`, even when GirderDetail owner load rules (#234) were in use.
- **After:** the text is built from `lfFac(ownLFOf(ext))`, the factors the checks already use. With no owner rules it reads exactly as before. With owner rules it appends "(owner load rules from GirderDetail; see 2. Input parameters, Owner load rules)".
- **Provision:** none changed (display of the factors already applied by #234: AASHTO LRFD 10th Ed. 1.3.2.1, Table 3.4.1-1; RIDOT BDM 3.4.1.2).
- **Check case:** built-in RIDOT G2 hand-off (η = 1.05, m = 1.2) gives `Strength I 1.3125 DC + 1.575 DW + 2.205 (LL+IM); Service II DC + DW + 1.56 (LL+IM) (owner load rules …)`. The default project shows the old text unchanged.
- **Verification:** Babel transpile OK; headless report text checked for the default project and a RIDOT payload; no page errors. No computed value changed.


## 2026-10-15 — PR: claude/gd-st-utilities (GD54c: MassDOT utilities from GirderDetail as their own loads; cross-tool PR with Steel Bridge Beam Modules.html and HANDOFF.md §4.9; engineer decision GD54(d) "yes"; PR link added after merge)

### GD54c. Utilities (`M_UT`, `V_UT`, `M_UF`, `V_UF`) applied with the exact factors   [LOAD COMBINATION CHANGE for GirderDetail payloads carrying utilities (MassDOT) — §4 callout] [Tier 2]
- **Where:** `buildExternal` (`hasUT`, `hasUF`, `M_UT`, `V_UT`, `M_UF`, `V_UF`); `computeAll`: `UTon`, `UF_`, `uFac`, `uSum` (anchor `/* GD54c (engineer decision 2026-10-15; HANDOFF.md 4.9)`), stations (`if(!UTon){` … `Mu:Mu+uP,Mun:Mun+uN`), `stageF(…, uk)` (`if(UTon&&uk)`), Service II (`stageF(st,1,1,1,gS2,true,'S')`), `sDisp`, `fTop`/`fBot` (`ut`), `yieldMy` (`MD1=UTon? gDC*st.M1+st.uP`), `fStg`/`fStr` (`'U'`), camber (`camUT`, `shUT`), web special fatigue `Vperm`, rating (flexure `mDC`/`mDW`, `'R'`, shear `uT`/`uF`, −M `'R'`, Service `'RS'`, `utR`), result `ut`. Display: `utG`, `utLines`, `utTxM`, `utTxV`, `UtBanner`, `UtCard` (anchor `/* GD54c (engineer decision 2026-10-15): MassDOT utilities from GirderDetail`), `DL_T.ut`, banner after `OwnBanner`, Inputs card after the imported-demands callout, Diagrams traces and other-span lines, Flexure chart trace, `camberSeries`, `CamberBreakdown`, `camberDeriv`, `s2Deriv`, Rating hint, report (2. Input parameters "MassDOT utilities (from GirderDetail)", Load combinations `uM`, `uV`, `uS`, load-effect tables, Imported demands row), `gdCheck` (fields validated as numbers), pull summary line.
- **Before:** `Mu =gDC*(M1+M2)+gDW*Mw+gLL*MlD`, `Vu=Math.abs(gDC*(V1+V2)+gDW*Vw)+gLL*Math.abs(VlD)`; utilities not in the payload (GirderDetail note only).
- **After (only when the payload has the fields; `UTon`):**
  - Strength I: M_u = (before) + γ_UT·M_UT + γ_UF·M_UF with γ_UT = 1.50η where M_UT adds to the case (+M_u: M ≥ 0; −M_u: M ≤ 0), 0.65/η where it relieves; γ_UF = 1.25η / 0. V_u = max over both directions s of s·[γ_DC(V_DC1+V_DC2) + γ_DW V_DW + γ_UT(s) V_UT + γ_UF(s) V_UF] + γ_LL|V_LL+IM| (= |V_D| + γ_LL|V_LL| without utilities).
  - Strength flange stresses, M_D1 of the 1.3R_hM_y cap: the factored utilities on the steel section. Service II: M_UT at 1.0, M_UF at 1.0 where it adds, 0 where it relieves, steel section.
  - Camber: Δ_UT (existing utilities, bare steel) added; the future allowance is not in the camber. Constructibility: unchanged (DC1 only; the utilities are installed after the deck).
  - Web special fatigue 6.10.5.3: V_perm = |V_DC1 + V_DC2 + V_DW + V_UT + V_UF (where it adds)|.
  - LRFR rating (default chosen, engineer to confirm, ENGINEER_CHECKS GD65): both where they add (UT with DW γ 1.50, UF with DC γ 1.25, Service 1.0), no relief.
- **Governing provision:** MassDOT LRFD Bridge Manual Part I 3.5.5.2, 3.5.5.4; AASHTO LRFD 10th Ed. (2024) 1.3.2.1, 3.4.1, Table 3.4.1-1, Table 3.4.1-2, 6.10.1.1.1a (staged sections), 6.10.4.2.2, 6.10.5.3, 6.10.7.1.2, D6.2.2; MBE 6A.4.2 (rating); engineer decisions GD42, GD54b, GD54(d).
- **Check case (built-in 15°, MassDOT, η = 1.0, m = 1; utility rows UT 0.30 klf and UF 0.25 klf at x = 17.5 ft, two adjacent → G2 0.150 klf existing, 0.125 klf future; project `tests/projects/gd/util.json`, payload `tests/projects/st/util_MassDOT_G2.json`; ST-Girder span 1, x = 44.0 ft):**
  - Payload station x = 44: M_DC1 = 1001.730, M_DC2 = 192.929, M_DW = 159.794, M_LL+IM = 1802.184, **M_UT = 112.031, M_UF = 93.359** kip-ft (GirderDetail Structural analysis: M_UT 112.031, M_UF 93.359).
  - Before (main ST-Girder, utilities not used): M_u = 1.25(1001.730 + 192.929) + 1.50(159.794) + 1.75(1802.184) = 1493.324 + 239.691 + 3153.822 = **4886.837 kip-ft** (tool 4886.837).
  - After: M_u = 4886.837 + 1.50(112.031) + 1.25(93.359) = 4886.837 + 168.047 + 116.699 = **5171.582 kip-ft** (tool 5171.582); GirderDetail Structural analysis Strength I max +M at x = 44.0 ft: **5171.583** (equal within the 0.001 rounding of the sent values).
  - Shear (governing x = 110.0 ft, pier, app sign): V_u = |1.25(−96.7 − 17.5) + 1.50(−14.5) + 1.50(−10.6) + 1.25(−8.8)| + 1.75(132.6) = 191.4 + 232.1 = **423.5 kip** (before 396.7).
  - Other results that moved (ST-Girder, this payload): Strength flexure (+M) 0.521 → 0.560; Strength shear 0.506 → 0.541; Service II flange (top, −LL) 0.659 → 0.720; Service II web bend-buckling 0.594 → 0.643; negative flexure bottom flange 0.913 → 0.992, top flange 0.816 → 0.896; web special fatigue 0.271 → 0.296; bearing stiffener 0.687 → 0.733; φM_n at the governing +M station 9388 → 9239 kip-ft (1.3R_hM_y cap, M_D1 now includes the factored utilities); camber Δ_UT = 0.155 in, Δ_total 1.613 → 1.768 in; rating inventory: flexure 2.427 → 2.290, shear 2.666 → 2.551, −M 1.198 → 1.018, Service II 2.208 → 1.993 (governing 1.198 → 1.018).
- **How verified (Tier 2):** `node tests/compare.mjs --tool st --payload def15_AASHTO_G2,def15_RIDOT_Iyes_G2,xsA_RIDOT_Iyes_G1` (payloads without the fields): **all sections identical** to main; the utility payload: only the values above differ. `node tests/compare.mjs --tool gd --project builtin,util --owner MassDOT` and `--project builtin --owner AASHTO`: all sections identical (the sender change is in the hand-off only). Every ST-Girder tab and the report rendered headless with the utility payload: no console errors, no KaTeX errors; screenshots of the Inputs card, banner and camber checked. Main's ST-Girder opens the new payload (validation passes, the fields are ignored). Babel transpile of the JSX (`tests/check-syntax.mjs`).
- **Saved data:** none changed. The session stores the payload as `inp.external` (existing field); the new fields ride along. A session saved by this branch and opened in main: main ignores the fields.
- **Other copies:** the sender is `Steel Bridge Beam Modules.html` (fixlog GD54c there).
- **Open items:** ENGINEER_CHECKS GD65 (a)–(d).
- **Diff (main → branch):**
```diff
diff --git a/stgirder.html b/stgirder.html
index 386e526..7a9a1df 100644
--- a/stgirder.html
+++ b/stgirder.html
@@ -2191,3 +2191,7 @@ function buildExternal(ext, L, llf){
   const hasPL=slice.some(s=>s.M_PLpos!==undefined||s.V_PLpos!==undefined);
-  return { spanLen, slice, sel, hasDC1, hasDC1split, swExcl, hasFat, hasFatV, hasPL,
+  // GD54c (2026-10-15): MassDOT utilities as their own loads (GirderDetail, optional): M_UT/V_UT existing utilities, M_UF/V_UF future utility
+  // allowance; unfactored, on the steel (noncomposite) section; shears in the same MIDAS sign convention, negated like the other dead-load shears
+  const hasUT=slice.some(s=>s.M_UT!==undefined), hasUF=slice.some(s=>s.M_UF!==undefined);
+  return { spanLen, slice, sel, hasDC1, hasDC1split, swExcl, hasFat, hasFatV, hasPL, hasUT, hasUF,
+    M_UT:(x)=>interp('M_UT',x), V_UT:(x)=>-interp('V_UT',x), M_UF:(x)=>interp('M_UF',x), V_UF:(x)=>-interp('V_UF',x),
     M_PLpos:(x)=>interp('M_PLpos',x)*fPos, M_PLneg:(x)=>interp('M_PLneg',x)*fNeg,
@@ -2419,2 +2423,35 @@ function OwnBanner({R,go}){ const L=R&&R.ok&&R.lf; if(!L||!L.on) return null; co
   </div>; }
+/* GD54c (engineer decision 2026-10-15): MassDOT utilities from GirderDetail as their own loads (R.ut; computeAll). Display helpers. */
+const utG=(M,sg,mx,mn)=>sg*M>=0? mx : mn;
+function utLines(R){ const U=R&&R.ok&&R.ut; if(!U) return null; const f3=v=>fmt(v,3), i=U.info||{}, F=U.F.U, out=[];
+  if(U.hasUT) out.push('Existing utilities M_UT, V_UT'+(i.existing&&i.existing.w?' ('+fmt(i.existing.w,3)+' klf on this girder)':'')+': on the steel (noncomposite) section; Strength I γ_UT = 1.50η = '+f3(F.t)+' where they add to the effect checked, 0.65/η = '+f3(F.tn)+' where they relieve it (DW factors, AASHTO LRFD Table 3.4.1-2; existing utilities = DW, GD42); Service II 1.0; in the camber.');
+  if(U.hasUF) out.push('Future utility allowance M_UF, V_UF'+(i.future&&i.future.w?' ('+fmt(i.future.w,3)+' klf on this girder)':'')+': on the steel section; Strength I γ_UF = 1.25η = '+f3(F.f)+' where it adds, 0 where it relieves; Service II 1.0 where it adds, 0 where it relieves; not in the camber (MassDOT 3.5.5.2).');
+  out.push('Not at deck placement: the constructibility checks (6.10.3) use DC1 only (the utilities are installed after the deck).');
+  out.push('Shear: V_u = |γ_DC(V_DC1 + V_DC2) + γ_DW V_DW + γ_UT V_UT + γ_UF V_UF| in the worse direction (each utility factor by whether it adds in that direction) + γ_LL|V_LL+IM|. Web special fatigue (6.10.5.3): permanent shear with V_UT and V_UF (where it adds) at 1.0.');
+  out.push('Load rating (default chosen, engineer to confirm): both included where they add (existing as DW, γ 1.50; future allowance as DC, γ 1.25; Service II 1.0), no relief taken.');
+  out.push('Source: '+(i.cite||'MassDOT LRFD Bridge Manual Part I 3.5.5.2, 3.5.5.4')+'.');
+  return out; }
+// the utility terms of the worked Strength I equations at station q (sg = +1 for +M_u, −1 for −M_u); empty strings without utilities
+function utTxM(R,q,sg){ const U=R&&R.ut; if(!U||q.Mut==null) return {sym:'',val:''}; const F=U.F.U;
+  return {sym:(U.hasUT?'+\\gamma_{UT}M_{UT}':'')+(U.hasUF?'+\\gamma_{UF}M_{UF}':''),
+    val:(U.hasUT?'+'+nx(utG(q.Mut,sg,F.t,F.tn),3)+'('+nx(q.Mut,0)+')':'')+(U.hasUF?'+'+nx(utG(q.Muf,sg,F.f,F.fn),3)+'('+nx(q.Muf,0)+')':'')}; }
+function utTxV(R,q){ const U=R&&R.ut; if(!U||q.Vut==null) return {sym:'',val:''}; const F=U.F.U, sg=(q.Vd+q.uV)>=0?1:-1;
+  return {sym:(U.hasUT?'+\\gamma_{UT}V_{UT}':'')+(U.hasUF?'+\\gamma_{UF}V_{UF}':''),
+    val:(U.hasUT?'+'+nx(utG(q.Vut,sg,F.t,F.tn),3)+'('+nx(q.Vut,1)+')':'')+(U.hasUF?'+'+nx(utG(q.Vuf,sg,F.f,F.fn),3)+'('+nx(q.Vuf,1)+')':'')}; }
+function UtBanner({R}){ const ls=utLines(R); if(!ls) return null;
+  return <div className="callout" style={{marginTop:0,marginBottom:0,borderLeftColor:'#0f766e',background:'#f0fdfa'}}>
+    <b>MassDOT utilities from GirderDetail: their own loads</b>
+    <ul style={{fontSize:11.5,margin:'4px 0 0 18px',lineHeight:1.6,padding:0}}>{ls.slice(0,2).map((t,i)=><li key={i}>{t}</li>)}</ul>
+    <div style={{fontSize:11.5,marginTop:4}}>In every Strength I and Service II check, the yield moment, the camber (existing only), the web special fatigue check and the rating; not at deck placement. Worked in the report, <i>2. Input parameters — MassDOT utilities</i> and <i>Demands — Load combinations</i>.</div>
+    <DLinks lead="Go to:" items={[{to:'ut',what:'utility loads and factors'},{to:'menv',what:'M_u with the utilities'},{to:'venv',what:'V_u'}]}/>
+  </div>; }
+function UtCard({R}){ const ls=utLines(R); if(!ls) return null; const U=R.ut, st=R.stations, F=U.F.U;
+  const pick=[['governing +M_u',st.reduce((b,q)=>q.Mu>b.Mu?q:b,st[0])],['governing −M_u',st.reduce((b,q)=>q.Mun<b.Mun?q:b,st[0])],['governing V_u',st.reduce((b,q)=>q.Vu>b.Vu?q:b,st[0])]];
+  return <Card id="stg-d-ut" title="MassDOT utilities (from GirderDetail)" refTag="own load components · steel section · MassDOT 3.5.5.2, 3.5.5.4">
+    <ul style={{fontSize:11.5,margin:'0 0 6px 18px',lineHeight:1.6,padding:0}}>{ls.map((t,i)=><li key={i}>{t}</li>)}</ul>
+    <Tbl head={['Station','x (ft)','M_UT','M_UF','γ_UT, γ_UF (+M_u)','γ_UT, γ_UF (−M_u)','V_UT','V_UF','factored utility shear']} rows={pick.map(([lab,q])=>({c:[lab,fmt(q.x,2),fmt(q.Mut,1),fmt(q.Muf,1),
+      fmt(utG(q.Mut,1,F.t,F.tn),3)+', '+fmt(utG(q.Muf,1,F.f,F.fn),3),fmt(utG(q.Mut,-1,F.t,F.tn),3)+', '+fmt(utG(q.Muf,-1,F.f,F.fn),3),fmt(q.Vut,1),fmt(q.Vuf,1),fmt(q.uV,1)]}))}/>
+    <div className="hint" style={{marginTop:4}}>Unfactored moments k-ft, shears kip (per girder, this tool's sign convention). The factored utility shear is in the direction that governs V_u.</div>
+    <DLinks items={[{to:'menv',what:'M_u envelope'},{to:'venv',what:'V_u envelope'},{to:'s2',what:'Service II with the utilities'}]}/>
+  </Card>; }
 function GdNote({ext,style}){
@@ -2839,2 +2876,11 @@ function computeAll(inp){
     const plOn=OWN.m!==1&&useExt&&ext.hasPL&&inp.external.pedestrianInLL===true;   // GD45: the pedestrian load in LL+IM, taken without m
+    /* GD54c (engineer decision 2026-10-15; HANDOFF.md 4.9): MassDOT utilities from GirderDetail as their own loads, on the steel section, as GirderDetail
+       applies them (MassDOT Part I 3.5.5.2, 3.5.5.4; GD42: existing utilities = DW). Factor by whether the load adds to the effect checked (AASHTO 3.4.1):
+       existing (UT) Strength 1.50η where it adds, 0.65/η where it relieves, Service 1.0; future allowance (UF) Strength 1.25η / 0, Service 1.0 / 0.
+       Not at deck placement (constructibility uses DC1 only), future allowance not in the camber. Rating (default chosen, engineer to confirm): both
+       included where they add (UT as DW 1.50, UF as DC 1.25; Service 1.0), no relief taken. UTon false (no fields): every result exactly as before. */
+    const UTon=useExt&&(ext.hasUT||ext.hasUF);
+    const UF_={U:{t:gDW,tn:0.65*OWN.etaN,f:gDC,fn:0}, S:{t:1,tn:1,f:1,fn:0}, R:{t:1.5,tn:0,f:1.25,fn:0}, RS:{t:1,tn:0,f:1,fn:0}};
+    const uFac=(M,sg,mx,mn)=>sg*M>=0? mx : mn;
+    const uSum=(st,sg,k)=>{ const F=UF_[k]; return uFac(st.Mut,sg,F.t,F.tn)*st.Mut+uFac(st.Muf,sg,F.f,F.fn)*st.Muf; };   // factored utility moment, case sg (+1 / −1)
     // SW-CONT (2026-10-13): the self-weight ST-Girder adds to an import with selfWeightExcluded:true is analysed on the
@@ -2906,4 +2952,12 @@ function computeAll(inp){
       const Mun=gDC*(M1+M2)+gDW*Mw+gLL*MlnD;           // factored, −LL case
-      const Vu=Math.abs(gDC*(V1+V2)+gDW*Vw)+gLL*Math.abs(VlD);
-      return {x,si,M1,M2,Mw,Ml,Mln,V1,V2,Vw,Vl,Mu,Mun,Vu,MlD,MlnD,VlD,...(plOn?{qM,qMn,qV}:{})};
+      if(!UTon){ const Vu=Math.abs(gDC*(V1+V2)+gDW*Vw)+gLL*Math.abs(VlD);
+      return {x,si,M1,M2,Mw,Ml,Mln,V1,V2,Vw,Vl,Mu,Mun,Vu,MlD,MlnD,VlD,...(plOn?{qM,qMn,qV}:{})}; }
+      // GD54c: the utilities, factor by sign (+M_u case: a positive utility moment adds; −M_u case: a negative one adds);
+      // shear: the worse direction of the factored dead load + utilities (without utilities this is |V_D| exactly), plus γ_LL|V_LL|
+      const Mut=ext.M_UT(x), Muf=ext.M_UF(x), Vut=ext.V_UT(x), Vuf=ext.V_UF(x), q={Mut,Muf};
+      const uP=uSum(q,1,'U'), uN=uSum(q,-1,'U'), Vd=gDC*(V1+V2)+gDW*Vw, F=UF_.U;
+      const vDir=sg=>sg*(Vd+uFac(Vut,sg,F.t,F.tn)*Vut+uFac(Vuf,sg,F.f,F.fn)*Vuf), vP=vDir(1), vN=vDir(-1), vSg=vP>=vN?1:-1;
+      const uV=vSg*Math.max(vP,vN)-Vd;                  // the factored utility shear in the governing direction (signed, app convention)
+      const Vu=Math.max(vP,vN)+gLL*Math.abs(VlD);
+      return {x,si,M1,M2,Mw,Ml,Mln,V1,V2,Vw,Vl,Mu:Mu+uP,Mun:Mun+uN,Vu,MlD,MlnD,VlD,...(plOn?{qM,qMn,qV}:{}),Mut,Muf,Vut,Vuf,uP,uN,uV,Vd};
     });
@@ -2916,3 +2970,3 @@ function computeAll(inp){
     // Section per component: DC1 → bare; others → composite (3n / n) when M ≥ 0, cracked (steel+rebar) when M < 0.
-    const stageF=(st,g1,g2,gw,gll,des)=>{   // des (GD49): the owner combinations' LL+IM (MlD, MlnD; = Ml, Mln without a pedestrian part)
+    const stageF=(st,g1,g2,gw,gll,des,uk)=>{   // des (GD49): the owner combinations' LL+IM (MlD, MlnD; = Ml, Mln without a pedestrian part); uk (GD54c): the utility factor set
       const sg=segP[st.si];
@@ -2925,2 +2979,6 @@ function computeAll(inp){
       const lp=one(gll*(des?st.MlD:st.Ml),'ll'), ln=one(gll*(des?st.MlnD:st.Mln),'ll');
+      if(UTon&&uk){ const up=one(uSum(st,1,uk),'dc1'), un=one(uSum(st,-1,uk),'dc1');   // GD54c: the utilities on the steel section, factored per case
+        return { pos:{fB:dc.fB+d2.fB+dw.fB+lp.fB+up.fB, fT:dc.fT+d2.fT+dw.fT+lp.fT+up.fT},
+                 neg:{fB:dc.fB+d2.fB+dw.fB+ln.fB+un.fB, fT:dc.fT+d2.fT+dw.fT+ln.fT+un.fT},
+                 parts:{dc,d2,dw,lp,ln,up,un} }; }
       return { pos:{fB:dc.fB+d2.fB+dw.fB+lp.fB, fT:dc.fT+d2.fT+dw.fT+lp.fT},
@@ -2939,3 +2997,3 @@ function computeAll(inp){
     stations.forEach(st=>{ const sg=segP[st.si];
-      const s=stageF(st,1,1,1,gS2,true), lim=s2Coef*sg.Rh*Fyf;   // GD49: Service II γ_LL = 1.30m
+      const s=stageF(st,1,1,1,gS2,true,'S'), lim=s2Coef*sg.Rh*Fyf;   // GD49: Service II γ_LL = 1.30m; GD54c: utilities 1.0 (future allowance 0 where it relieves)
       chartS2.push({x:st.x, si:st.si, lim, Rh:sg.Rh,
@@ -2948,3 +3006,4 @@ function computeAll(inp){
         Sbn:sg.cN.Sb, Stn:sg.cN.StSteel, SbCr:sg.cr.Sb, StCr:sg.cr.St,
-        dc1Bp:s.parts.dc.fB, d2Bp:s.parts.d2.fB, dwBp:s.parts.dw.fB, llBp:s.parts.lp.fB, lnBp:s.parts.ln.fB});
+        dc1Bp:s.parts.dc.fB, d2Bp:s.parts.d2.fB, dwBp:s.parts.dw.fB, llBp:s.parts.lp.fB, lnBp:s.parts.ln.fB,
+        ...(s.parts.up?{utBp:s.parts.up.fB, utBn:s.parts.un.fB, Mut:st.Mut, Muf:st.Muf, uSP:uSum(st,1,'S'), uSN:uSum(st,-1,'S')}:{})});   // GD54c
       [['top +LL',s.pos.fT],['bot +LL',s.pos.fB],['top −LL',s.neg.fT],['bot −LL',s.neg.fB]].forEach(([tag,f])=>{
@@ -2958,6 +3017,6 @@ function computeAll(inp){
     const stMaxPos=stations.reduce((b,st)=>st.Mu>b.Mu?st:b,stations[0]);
-    const sDisp=stageF(stMaxPos,1,1,1,gS2,true);
+    const sDisp=stageF(stMaxPos,1,1,1,gS2,true,'S');
     const sgDisp=segP[stMaxPos.si];
-    const fTop={dc1:sDisp.parts.dc.fT, sid:sDisp.parts.d2.fT+sDisp.parts.dw.fT, ll:sDisp.parts.lp.fT/gS2, serv2:sDisp.pos.fT};
-    const fBot={dc1:sDisp.parts.dc.fB, sid:sDisp.parts.d2.fB+sDisp.parts.dw.fB, ll:sDisp.parts.lp.fB/gS2, serv2:sDisp.pos.fB};
+    const fTop={dc1:sDisp.parts.dc.fT, sid:sDisp.parts.d2.fT+sDisp.parts.dw.fT, ll:sDisp.parts.lp.fT/gS2, serv2:sDisp.pos.fT, ...(sDisp.parts.up?{ut:sDisp.parts.up.fT}:{})};   // ut (GD54c): the utilities, Service
+    const fBot={dc1:sDisp.parts.dc.fB, sid:sDisp.parts.d2.fB+sDisp.parts.dw.fB, ll:sDisp.parts.lp.fB/gS2, serv2:sDisp.pos.fB, ...(sDisp.parts.up?{ut:sDisp.parts.up.fB}:{})};
     const fServLim=s2Coef*sgDisp.Rh*Fyf;
@@ -2991,4 +3050,4 @@ function computeAll(inp){
     const yieldMy=(st,sg)=>{
-      const MD1=gDC*st.M1, MD2=gDC*st.M2+gDW*st.Mw;              // k-ft, factored permanent (GD49: × η under the owner rules)
-      const fd=stageF(st,gDC,gDC,gDW,0).pos;                      // ksi, fB tension+, fT compression+
+      const MD1=UTon? gDC*st.M1+st.uP : gDC*st.M1, MD2=gDC*st.M2+gDW*st.Mw;   // k-ft, factored permanent (GD49: × η under the owner rules; GD54c: + the factored utilities, steel section)
+      const fd=stageF(st,gDC,gDC,gDW,0,false,'U').pos;            // ksi, fB tension+, fT compression+
       const MADb=sg.cN.Sb*(Fyf-fd.fB)/12, MADt=sg.cN.StSteel*(Fyf-fd.fT)/12;
@@ -3013,3 +3072,3 @@ function computeAll(inp){
       // staged factored flange stresses (Strength I) at this station — computed once, reused below
-      const fStg=stageF(st,gDC,gDC,gDW,gLL,true);   // GD49
+      const fStg=stageF(st,gDC,gDC,gDW,gLL,true,'U');   // GD49; GD54c
       // ── +M worked-calc record (compact → Mp basis · noncompact composite → stress basis) ──
@@ -3050,3 +3109,3 @@ function computeAll(inp){
     const stPos=stations.reduce((b,st)=>st.Mu>b.Mu?st:b,stations[0]);
-    const fStr=stageF(stPos,gDC,gDC,gDW,gLL,true);
+    const fStr=stageF(stPos,gDC,gDC,gDW,gLL,true,'U');
     const Mp_kft=sgPos.pl.Mp/12, Mn_kft=sgPos.Mn_kft;
@@ -3163,3 +3222,3 @@ function computeAll(inp){
       M2: useExt? ext.M_DC2(x) : simpleM(Ld.wDC2,x),
-      Mw: useExt? ext.M_DW(x)  : simpleM(Ld.wDW,x)}));
+      Mw: useExt? ext.M_DW(x)  : simpleM(Ld.wDW,x), ...(UTon?{Mut:ext.M_UT(x)}:{})}));   // Mut (GD54c): existing utilities (the future allowance is not in the camber)
     // deflShape: the deflected shape at every camber station (in, + up, so sagging gives negative values); deflOf = its largest magnitude.
@@ -3175,3 +3234,4 @@ function computeAll(inp){
     const camDC1=deflOf(s=>s.M1,'bare'), camDC2=deflOf(s=>s.M2,'c3N'), camDW=deflOf(s=>s.Mw,'c3N');
-    const camber={camDC1,camDC2,camDW,camTot:camDC1+camDC2+camDW};
+    const camUT=UTon&&ext.hasUT? deflOf(s=>s.Mut,'bare') : 0;   // GD54c: existing utilities on the steel section (MassDOT 3.5.5.2: not the future allowance)
+    const camber=UTon&&ext.hasUT? {camDC1,camDC2,camDW,camUT,camTot:camDC1+camDC2+camDW+camUT} : {camDC1,camDC2,camDW,camTot:camDC1+camDC2+camDW};
     // Breakdown by load (display only). DC1 on the bare steel is split into steel self-weight (+ diaphragm point loads) and the
@@ -3184,6 +3244,7 @@ function computeAll(inp){
     const shWet= dc1Split==='none' ? null : deflShape(s=>s.M1-Msteel(s),'bare');
-    const shTot=camSt.map((_,i)=>shDC1[i]+shDC2[i]+shDW[i]);
+    const shUT=UTon&&ext.hasUT? deflShape(s=>s.Mut,'bare') : null;   // GD54c
+    const shTot=camSt.map((_,i)=>shUT? shDC1[i]+shDC2[i]+shDW[i]+shUT[i] : shDC1[i]+shDC2[i]+shDW[i]);
     const argMax=a=>{ let j=0; a.forEach((v,i)=>{ if(Math.abs(v)>Math.abs(a[j])) j=i; }); return j; };
     camber.shape={x:camSt.map(s=>s.x), dc1Split, hasDia:dc1Split==='app'&&dph.length>0,
-      sw:shSW, wet:shWet, dc1:shDC1, dc2:shDC2, dw:shDW, tot:shTot,
+      sw:shSW, wet:shWet, dc1:shDC1, dc2:shDC2, dw:shDW, tot:shTot, ...(shUT?{ut:shUT}:{}),
       splices:segP.filter(g=>g.x1>0.05&&g.x1<Lft-0.05).map(g=>g.x1)};
@@ -3250,3 +3311,4 @@ function computeAll(inp){
       // special fatigue for webs (6.10.5.3): unfactored permanent + Fatigue I LL shear ≤ Vcr
-      const Vperm=Math.abs(st.V1+st.V2+st.Vw);
+      // GD54c: the permanent shear with the utilities at 1.0 (existing always, the future allowance where it adds), as GirderDetail's web check
+      const Vperm=UTon? (()=>{ const v=st.V1+st.V2+st.Vw, sg=v>=0?1:-1; return Math.abs(v+st.Vut+(sg*st.Vuf>0?st.Vuf:0)); })() : Math.abs(st.V1+st.V2+st.Vw);
       const Vll=fatImpV? Math.max(Math.abs(ext.V_FATpos(st.x)),Math.abs(ext.V_FATneg(st.x)))
@@ -3378,5 +3440,7 @@ function computeAll(inp){
         cap=phiCS*phif*MnSt; basis='Mp';
-        inv=rf(cap,st.M1+st.M2,st.Mw,st.Ml,1.75); opr=rf(cap,st.M1+st.M2,st.Mw,st.Ml,1.35);
+        // GD54c (default chosen, engineer to confirm): the utilities where they add, existing as DW, future allowance as DC; no relief taken
+        const mDC=UTon? st.M1+st.M2+Math.max(st.Muf,0) : st.M1+st.M2, mDW=UTon? st.Mw+Math.max(st.Mut,0) : st.Mw;
+        inv=rf(cap,mDC,mDW,st.Ml,1.75); opr=rf(cap,mDC,mDW,st.Ml,1.35);
       } else {
-        const fd=stageF(st,1.25,1.25,1.5,0).pos, fl=stageF(st,0,0,0,1).pos; basis='stress';
+        const fd=stageF(st,1.25,1.25,1.5,0,false,'R').pos, fl=stageF(st,0,0,0,1).pos; basis='stress';
         inv=Math.min(rfStress(sg.FncPos,fd.fT,fl.fT,1.75), rfStress(sg.Fnt,fd.fB,fl.fB,1.75));
@@ -3384,3 +3448,4 @@ function computeAll(inp){
       }
-      if(!flexRow||inv<flexRow.inv) flexRow={inv,opr,cap,basis,x:st.x,MDC:st.M1+st.M2,MDW:st.Mw,MLL:st.Ml};
+      if(!flexRow||inv<flexRow.inv) flexRow=UTon? {inv,opr,cap,basis,x:st.x,MDC:st.M1+st.M2+Math.max(st.Muf,0),MDW:st.Mw+Math.max(st.Mut,0),MLL:st.Ml,MUT:Math.max(st.Mut,0),MUF:Math.max(st.Muf,0)}   // GD54c: DC with M_UF, DW with M_UT (where they add)
+        : {inv,opr,cap,basis,x:st.x,MDC:st.M1+st.M2,MDW:st.Mw,MLL:st.Ml};
     });
@@ -3388,8 +3453,9 @@ function computeAll(inp){
     const capM=flexRow.cap;
-    const MDC=flexRow.MDC, MDWr=flexRow.MDW, MLLr=flexRow.MLL;
+    const MDC=flexRow.MDC, MDWr=flexRow.MDW, MLLr=flexRow.MLL, utR=UTon? {flexRowUT:flexRow.MUT||0, flexRowUF:flexRow.MUF||0} : {};   // GD54c
     // Shear: φcφs·φv·Vcr (end-panel basis, unchanged) against the demand at each station; lowest RF.
     let shRow=null;
-    stations.forEach(st=>{ const dc=Math.abs(st.V1+st.V2), dw=Math.abs(st.Vw), ll=Math.abs(st.Vl);
+    stations.forEach(st=>{ let dc=Math.abs(st.V1+st.V2), dw=Math.abs(st.Vw), uT=0, uF=0; const ll=Math.abs(st.Vl);
+      if(UTon){ const sg=(st.V1+st.V2+st.Vw)>=0?1:-1; uT=Math.max(sg*st.Vut,0); uF=Math.max(sg*st.Vuf,0); dc+=uF; dw+=uT; }   // GD54c: where they add (rating default)
       const inv=rf(phiCS*phiv*Vcr,dc,dw,ll,1.75);
-      if(!shRow||inv<shRow.inv) shRow={inv,opr:rf(phiCS*phiv*Vcr,dc,dw,ll,1.35),x:st.x,VDC:dc,VDW:dw,VLL:ll}; });
+      if(!shRow||inv<shRow.inv) shRow={inv,opr:rf(phiCS*phiv*Vcr,dc,dw,ll,1.35),x:st.x,VDC:dc,VDW:dw,VLL:ll,...(UTon?{VUT:uT,VUF:uF}:{})}; });
     const VDC=shRow.VDC, VDWr=shRow.VDW, VLLr=shRow.VLL;
@@ -3398,6 +3464,6 @@ function computeAll(inp){
       shearInv:shRow.inv, shearOpr:shRow.opr, shearX:shRow.x,
-      capM,capV:phiCS*phiv*Vcr,MDC,MDWr,MLLr,VDC,VDWr,VLLr,phiC,phiS,phiCS,phiCSfloor};
+      capM,capV:phiCS*phiv*Vcr,MDC,MDWr,MLLr,VDC,VDWr,VLLr,phiC,phiS,phiCS,phiCSfloor,...utR};
     if(hasNeg&&negBGov.r>0){ const stN=stations.reduce((b,st)=>st.Mun<b.Mun?st:b,stations[0]);
       const sgN=segP[stN.si];
-      const fPerm=stageF(stN,1.25,1.25,1.5,0).neg.fB;         // factored permanent, compression (−)
+      const fPerm=stageF(stN,1.25,1.25,1.5,0,false,'R').neg.fB;   // factored permanent, compression (−); GD54c: the utilities where they add
       const fLL1=Math.abs(stN.Mln*12/sgN.cr.Sb);              // LL stress per γ=1.0
@@ -3411,5 +3477,6 @@ function computeAll(inp){
     let s2Row=null;
-    stations.forEach(st=>{ const sg=segP[st.si], fR=s2Coef*sg.Rh*Fyf, s=stageF(st,1,1,1,1);
+    stations.forEach(st=>{ const sg=segP[st.si], fR=s2Coef*sg.Rh*Fyf, s=stageF(st,1,1,1,1,false,'RS');
       const fD={fB:s.parts.dc.fB+s.parts.d2.fB+s.parts.dw.fB, fT:s.parts.dc.fT+s.parts.d2.fT+s.parts.dw.fT};
-      [['bot +LL',fD.fB,s.parts.lp.fB],['top +LL',fD.fT,s.parts.lp.fT],['bot −LL',fD.fB,s.parts.ln.fB],['top −LL',fD.fT,s.parts.ln.fT]].forEach(([tag,fd,fl])=>{
+      const up=s.parts.up, un=s.parts.un;   // GD54c: the utilities (rating default: 1.0 where they add), per LL case
+      [['bot +LL',up?fD.fB+up.fB:fD.fB,s.parts.lp.fB],['top +LL',up?fD.fT+up.fT:fD.fT,s.parts.lp.fT],['bot −LL',un?fD.fB+un.fB:fD.fB,s.parts.ln.fB],['top −LL',un?fD.fT+un.fT:fD.fT,s.parts.ln.fT]].forEach(([tag,fd,fl])=>{
         if(!(Math.abs(fl)>1e-6)) return; const sgn=Math.sign(fl), base=(fR-sgn*fd)/Math.abs(fl);
@@ -3488,3 +3555,4 @@ function computeAll(inp){
       chartS2, chartFlex, chartFat, flexCalc, shearCalc, warnings,
-      checks:checksF, ...(swCont?{swCont}:{}), ...(oos?{pnaOOS}:{})};
+      checks:checksF, ...(swCont?{swCont}:{}), ...(oos?{pnaOOS}:{}),
+      ...(UTon?{ut:{hasUT:ext.hasUT, hasUF:ext.hasUF, F:UF_, info:((inp.external.girderDetail||{}).utilities)||null}}:{})};   // GD54c
   }catch(e){ return {ok:false, error:e.message}; }
@@ -3578,2 +3646,3 @@ const DL_T={
   s2:{tab:'stresses',id:'stg-d-s2',cr:'serv.s2',l:'Stresses · Service II buildup'},
+  ut:{tab:'inputs',id:'stg-d-ut',cr:'inp.ut',l:'Inputs · MassDOT utilities'},   // GD54c
 };
@@ -4101,2 +4170,3 @@ function InputsTab({inp,set,R}){
     </div>}
+    {extActive&&R&&R.ok&&R.ut&&<UtCard R={R}/>}
     <div className="stgInTabs" role="tablist" aria-label="Input groups">{STG_IN_TABS.map(([k,l])=>
@@ -4821,2 +4891,3 @@ function s2Deriv(R,psel,right){
         ['M_LL','+LL+IM envelope (n)',psel.Ml,'k-ft'],
+        ...(psel.utBp!=null?[['M_UT','Existing utilities (bare; GirderDetail)',psel.Mut,'k-ft'],['M_UF','Future utility allowance (bare; GirderDetail)',psel.Muf,'k-ft']]:[]),
         ['S_b(bare)','Bottom modulus, bare steel',psel.SbBare,'in³'],
@@ -4833,3 +4904,4 @@ function s2Deriv(R,psel,right){
       <SG n="2">Service II combination & check</SG>
-      <ML s={Tx`f_{ServII}=f_{DC1}+f_{DC2}+f_{DW}+f_{LL}=${nx(psel.dc1Bp,2)}+${nx(psel.d2Bp,2)}+${nx(psel.dwBp,2)}+${nx(psel.llBp,2)}=${nx(psel.bP,2)}\;\text{ksi}`}/>
+      {psel.utBp!=null&&<ML s={Tx`f_{U}=\frac{(M_{UT}+\gamma_{UF}M_{UF})\cdot12}{S_{b,bare}}=\frac{${nx(psel.uSP,1)}\cdot12}{${nx(psel.SbBare,0)}}=${nx(psel.utBp,2)}\;\text{ksi}\quad(\gamma_{UF}=${psel.Muf>=0?'1.0':'0'}\text{: the future allowance only where it adds; GirderDetail utilities})`}/>}
+      <ML s={Tx`f_{ServII}=f_{DC1}+f_{DC2}+f_{DW}+f_{LL}${psel.utBp!=null?'+f_{U}':''}=${nx(psel.dc1Bp,2)}+${nx(psel.d2Bp,2)}+${nx(psel.dwBp,2)}+${nx(psel.llBp,2)}${psel.utBp!=null?'+'+nx(psel.utBp,2):''}=${nx(psel.bP,2)}\;\text{ksi}`}/>
       <ML s={Tx`\frac{f_{ServII}}{0.95R_hF_yf}=\frac{${nx(Math.abs(psel.bP),2)}}{${nx(psel.lim,2)}}=${nx(Math.abs(psel.bP)/psel.lim,3)}\;${Math.abs(psel.bP)<=psel.lim*1.0001?'\\checkmark':'\\text{N.G.}'}`}/>
@@ -4938,6 +5010,9 @@ function DiagramsTab({R,inp,set}){
     const d=(v,k)=>F.plOn? llD(v,a(k),F.m) : v;
+    // GD54c: the utilities by sign, as computeAll (display of the other spans; 0 without them)
+    const U=R.ut&&R.ut.F.U, ut=a('M_UT'), uf=a('M_UF'), vt=a('V_UT'), vf=a('V_UF'), sv=(v1+v2+vw)>=0?1:-1;
+    const uM=sg=>U? utG(ut,sg,U.t,U.tn)*ut+utG(uf,sg,U.f,U.fn)*uf : 0, uVv=U? utG(vt,sv,U.t,U.tn)*vt+utG(vf,sv,U.f,U.fn)*vf : 0;
     return {x:+s.x,M1:m1,M2:m2,Mw:mw,Mlp:mlp,Mln:mln,
-      Mup:F.gDC*(m1+m2)+F.gDW*mw+F.gLL*d(mlp,'M_PLpos'),Mun:F.gDC*(m1+m2)+F.gDW*mw+F.gLL*d(mln,'M_PLneg'),
+      Mup:F.gDC*(m1+m2)+F.gDW*mw+F.gLL*d(mlp,'M_PLpos')+uM(1),Mun:F.gDC*(m1+m2)+F.gDW*mw+F.gLL*d(mln,'M_PLneg')+uM(-1),
       V1:v1,V2:v2,Vw:vw,Vlp:vlp,Vln:vln,
-      Vup:F.gDC*(v1+v2)+F.gDW*vw+F.gLL*d(vlp,'V_PLpos')};});
+      Vup:F.gDC*(v1+v2)+F.gDW*vw+F.gLL*d(vlp,'V_PLpos')+uVv};});
   const lnR=(rows,k,name,color,dash)=>({x:rows.map(r=>r.x),y:rows.map(r=>r[k]||0),name,mode:'lines',line:{color,width:2,dash:dash||'solid'}});
@@ -4946,2 +5021,3 @@ function DiagramsTab({R,inp,set}){
     ln('Ml','+LL+IM','#B3261E'),ln('Mu','Strength I +Mu','#1C4FC4','dot')];
+  if(R.ut){ if(R.ut.hasUT) mData.splice(3,0,ln('Mut','UT (existing utilities)','#0f766e')); if(R.ut.hasUF) mData.splice(3,0,ln('Muf','UF (future utility allowance)','#0f766e','dash')); }   // GD54c
   if(R.hasNeg){ mData.push(ln('Mln','−LL+IM','#B3261E','dash')); mData.push(ln('Mun','Strength I −Mu','#1C4FC4','dashdot')); }
@@ -4974,2 +5050,3 @@ function DiagramsTab({R,inp,set}){
       <Fig h={320} data={[ln('V1','DC1','#15803D'),ln('V2','DC2','#0E7490'),ln('Vw','DW','#B45309'),
+        ...(R.ut&&R.ut.hasUT?[ln('Vut','UT (existing utilities)','#0f766e')]:[]),...(R.ut&&R.ut.hasUF?[ln('Vuf','UF (future utility allowance)','#0f766e','dash')]:[]),
         ln('Vl','LL+IM','#B3261E'),ln('Vu','Strength I Vu','#1C4FC4','dot')]}
@@ -5152,2 +5229,3 @@ function FlexTab({R}){
         {x:fx,y:stns.map(p=>kw*p.Mw),name:'DW'+(fac?' ×'+lfP(F.gDW,'1.50'):''),line:{color:'#B45309',width:1.6,dash:'dot'}},
+        ...(R.ut?[{x:fx,y:stns.map(p=>fac?p.uP:p.Mut+p.Muf),name:'Utilities UT + UF'+(fac?' (factored for +M_u)':''),line:{color:'#0f766e',width:1.6,dash:'dot'}}]:[]),   // GD54c
         {x:fx,y:stns.map(p=>kl*(fac?p.MlD:p.Ml)),name:'+LL+IM'+(fac?' ×'+lfP(F.gLL,'1.75'):''),line:{color:'#B3261E',width:1.8}},
@@ -5418,2 +5496,3 @@ function camberSeries(R){
   out.push({k:'dw',l:'DW (3n composite)',short:'DW',c:'#B45309',v:sh.dw});
+  if(sh.ut) out.push({k:'ut',l:'Existing utilities (steel section)',short:'UT',c:'#0f766e',v:sh.ut});   // GD54c (the future allowance is not in the camber)
   out.push({k:'tot',l:'Total (sum)',short:'Total',c:'#16212E',v:sh.tot});
@@ -5449,2 +5528,3 @@ function CamberBreakdown({R,fig}){
       {sh.dc1Split==='none'&&<span> <b>DC1 is imported</b> ({(R.ext&&R.ext.sel&&'span '+(R.ext.sel.idx||1))||'import'}) as one total; the import does not separate steel self-weight from wet concrete, so DC1 is shown as one column.</span>}
+      {sh.ut&&<span> Existing utilities (from GirderDetail, M_UT) on the steel section are in the camber; the future utility allowance is not (MassDOT 3.5.5.2).</span>}
       {d>0.0005&&<span> The largest total ({fmt(cm.camTotMax,3)} in, the headline value) is {fmt(d,3)} in less than Δ_total = Δ_DC1 + Δ_DC2 + Δ_DW ({fmt(cm.camTot,3)} in, the sum of the stage maxima) because the stage maxima occur at different stations.</span>}
@@ -5464,2 +5544,3 @@ function camberDeriv(R){ const cm=R.camber;
         ['Δ_DW','Deflection from DW (3n)',cm.camDW,'in'],
+        ...(cm.camUT!=null?[['Δ_UT','Deflection from the existing utilities (bare; GirderDetail)',cm.camUT,'in']]:[]),
         ['Δ_total','Total dead-load camber',cm.camTot,'in'],
@@ -5471,3 +5552,4 @@ function camberDeriv(R){ const cm=R.camber;
       <SG n="2">Total camber</SG>
-      <ML s={Tx`\Delta_{total}=\Delta_{DC1}+\Delta_{DC2}+\Delta_{DW}=${nx(cm.camDC1,3)}+${nx(cm.camDC2,3)}+${nx(cm.camDW,3)}=${nx(cm.camTot,3)}\;\text{in}\;\uparrow`}/>
+      {cm.camUT!=null&&<ML s={Tx`\Delta_{UT}=${nx(cm.camUT,3)}\;\text{in (existing utilities, bare steel; the future allowance is not in the camber, MassDOT 3.5.5.2)}`}/>}
+      <ML s={Tx`\Delta_{total}=\Delta_{DC1}+\Delta_{DC2}+\Delta_{DW}${cm.camUT!=null?'+\\Delta_{UT}':''}=${nx(cm.camDC1,3)}+${nx(cm.camDC2,3)}+${nx(cm.camDW,3)}${cm.camUT!=null?'+'+nx(cm.camUT,3):''}=${nx(cm.camTot,3)}\;\text{in}\;\uparrow`}/>
       <SG n="3">Deflection by load along the span</SG>
@@ -5846,2 +5928,3 @@ function RatingTab({R,inp,set,onSendCapacity,capLocked,onToggleCapLock}){
       ]}/>
+      {R.ut&&<div className="hint" style={{marginBottom:4}}>MassDOT utilities from GirderDetail (default chosen, engineer to confirm): included where they add, the existing utilities in DW (γ 1.50; flexure M_UT = {fmt(r.flexRowUT||0,0)} k-ft at the flexure station) and the future allowance in DC (γ 1.25); Service II at 1.0; no relief taken where they relieve.</div>}
       <DLinks items={[{to:'flexpos',what:'flexure capacity'},...(r.negInv!==undefined?[{to:'flexneg',what:'−M capacity'}]:[]),{to:'shear',what:'shear capacity'},...(r.servInv!==undefined?[{to:'s2',what:'Service II stresses'}]:[]),{to:'menv',what:'DC, DW, LL+IM'}]}/>
@@ -6024,2 +6107,8 @@ function crModel(R,inp,o){
     }
+    if(R.ut){ const U=R.ut, F=U.F.U;   // GD54c
+      sub(s,'MassDOT utilities (from GirderDetail)','MassDOT Part I 3.5.5.2, 3.5.5.4 · Table 3.4.1-2',<React.Fragment><div className="cr-tab">
+        {U.hasUT&&<ML s={Tx`\text{existing utilities (DW factors): }\gamma_{UT}=1.50\eta=${nx(F.t,3)}\;\text{where they add},\quad\gamma_{UT}=0.65/\eta=${nx(F.tn,3)}\;\text{where they relieve};\quad\text{Service II }1.0`}/>}
+        {U.hasUF&&<ML s={Tx`\text{future utility allowance: }\gamma_{UF}=1.25\eta=${nx(F.f,3)}\;\text{where it adds},\quad\gamma_{UF}=0\;\text{where it relieves};\quad\text{Service II }1.0\,/\,0`}/>}</div>
+        <ul className="cr-ul">{utLines(R).map((t,i)=><li key={i}>{t}</li>)}</ul></React.Fragment>); tag(s,'inp.ut');
+    }
     sub(s,'Rating factors','MBE 6A.4.2.3 · 6A.4.2.4',<CrKV rows={[['Condition factor φ_c',fmt(R.rating.phiC,2)],['System factor φ_s',fmt(R.rating.phiS,2)],['φ_c·φ_s used (≥ 0.85)',fmt(R.rating.phiCS,3)]]}/>);
@@ -6033,3 +6122,4 @@ function crModel(R,inp,o){
         ['Plate geometry',e.section&&e.section.zones?'imported from section.zones':'ST-Girder inputs'],
-        ['Fatigue',R.fatigue.fatImp?'imported fatigue moments'+(R.fatigue.fatImpV?' and shears':''):'ST-Girder fatigue truck (simple span)']]}/>
+        ['Fatigue',R.fatigue.fatImp?'imported fatigue moments'+(R.fatigue.fatImpV?' and shears':''):'ST-Girder fatigue truck (simple span)'],
+        ...(R.ut?[['Utilities (MassDOT)',[R.ut.hasUT?'existing M_UT, V_UT':'',R.ut.hasUF?'future allowance M_UF, V_UF':''].filter(Boolean).join('; ')+': their own loads on the steel section (see MassDOT utilities above)']]:[])]}/>
         {R.ext.swExcl&&R.ext.hasDC1&&<p className="cr-note"><SwContNote R={R}/></p>}
@@ -6105,6 +6195,8 @@ function crModel(R,inp,o){
     const OL=R.lf&&R.lf.on? R.lf : null;   // GD49: the owner load rules (the AASHTO factors 1.25, 1.50, 1.75, 1.30 exactly as before without them)
+    const uM=utTxM(R,sM,1), uV=utTxV(R,sV), uS=R.ut?'+M_{UT}+M_{UF}\\;(\\text{steel section; }M_{UF}\\text{ only where it adds})':'';   // GD54c: '' without utilities
     if(!OL) sub(s,'Load combinations','Table 3.4.1-1',<div className="cr-tab">
-      <ML s={Tx`M_u=1.25(M_{DC1}+M_{DC2})+1.50M_{DW}+1.75M_{LL+IM}=1.25(${nx(sM.M1,0)}+${nx(sM.M2,0)})+1.50(${nx(sM.Mw,0)})+1.75(${nx(sM.Ml,0)})=${nx(sM.Mu,0)}\;\text{k-ft}\quad(x=${nx(sM.x,1)}')`}/>
-      <ML s={Tx`V_u=\left|1.25(V_{DC1}+V_{DC2})+1.50V_{DW}\right|+1.75\left|V_{LL+IM}\right|=\left|1.25(${nx(sV.V1,1)}+${nx(sV.V2,1)})+1.50(${nx(sV.Vw,1)})\right|+1.75(${nx(Math.abs(sV.Vl),1)})=${nx(sV.Vu,1)}\;\text{kip}\quad(x=${nx(sV.x,1)}')`}/>
-      <ML s={Tx`\text{Service II: }M=M_{DC1}+M_{DC2}+M_{DW}+1.30M_{LL+IM}\;\text{(stresses accumulated on the stage sections)}`}/>
+      <ML s={Tx`M_u=1.25(M_{DC1}+M_{DC2})+1.50M_{DW}+1.75M_{LL+IM}${uM.sym}=1.25(${nx(sM.M1,0)}+${nx(sM.M2,0)})+1.50(${nx(sM.Mw,0)})+1.75(${nx(sM.Ml,0)})${uM.val}=${nx(sM.Mu,0)}\;\text{k-ft}\quad(x=${nx(sM.x,1)}')`}/>
+      <ML s={Tx`V_u=\left|1.25(V_{DC1}+V_{DC2})+1.50V_{DW}${uV.sym}\right|+1.75\left|V_{LL+IM}\right|=\left|1.25(${nx(sV.V1,1)}+${nx(sV.V2,1)})+1.50(${nx(sV.Vw,1)})${uV.val}\right|+1.75(${nx(Math.abs(sV.Vl),1)})=${nx(sV.Vu,1)}\;\text{kip}\quad(x=${nx(sV.x,1)}')`}/>
+      <ML s={Tx`\text{Service II: }M=M_{DC1}+M_{DC2}+M_{DW}+1.30M_{LL+IM}${uS}\;\text{(stresses accumulated on the stage sections)}`}/>
+      {R.ut&&<div className="mnote">MassDOT utilities from GirderDetail as their own loads (factors in 2. Input parameters, MassDOT utilities): each utility factor by whether it adds to the effect checked; V_u in the worse direction.</div>}
       <div className="mnote">Strength I at the governing +M station (x = {fmt(sM.x,1)} ft) and the governing shear station (x = {fmt(sV.x,1)} ft). Maximum load factors only.{R.hasNeg?' The −M_u envelope uses the −LL+IM envelope in place of +LL+IM.':''}</div></div>);
@@ -6112,5 +6204,6 @@ function crModel(R,inp,o){
       {OL.plOn&&<ML s={Tx`M_{LL+IM,used}=M_{LL+IM+PL}-M_{PL}+\frac{M_{PL}}{m}=${nx(sM.Ml,1)}-${nx(sM.qM||0,1)}+\frac{${nx(sM.qM||0,1)}}{${nx(OL.m,2)}}=${nx(sM.MlD,1)}\;\text{k-ft}\qquad V_{LL+IM,used}=${nx(Math.abs(sV.Vl),1)}-${nx(sV.qV||0,1)}+\frac{${nx(sV.qV||0,1)}}{${nx(OL.m,2)}}=${nx(Math.abs(sV.VlD),1)}\;\text{kip}`}/>}
-      <ML s={Tx`M_u=1.25\eta(M_{DC1}+M_{DC2})+1.50\eta M_{DW}+1.75\eta m\,M_{LL+IM}=${nx(OL.gDC,3)}(${nx(sM.M1,0)}+${nx(sM.M2,0)})+${nx(OL.gDW,3)}(${nx(sM.Mw,0)})+${nx(OL.gLL,3)}(${nx(sM.MlD,0)})=${nx(sM.Mu,0)}\;\text{k-ft}\quad(x=${nx(sM.x,1)}')`}/>
-      <ML s={Tx`V_u=\left|1.25\eta(V_{DC1}+V_{DC2})+1.50\eta V_{DW}\right|+1.75\eta m\left|V_{LL+IM}\right|=\left|${nx(OL.gDC,3)}(${nx(sV.V1,1)}+${nx(sV.V2,1)})+${nx(OL.gDW,3)}(${nx(sV.Vw,1)})\right|+${nx(OL.gLL,3)}(${nx(Math.abs(sV.VlD),1)})=${nx(sV.Vu,1)}\;\text{kip}\quad(x=${nx(sV.x,1)}')`}/>
-      <ML s={Tx`\text{Service II: }M=M_{DC1}+M_{DC2}+M_{DW}+1.30m\,M_{LL+IM}=M_{DC1}+M_{DC2}+M_{DW}+${nx(OL.gS2,3)}M_{LL+IM}\;\text{(stresses accumulated on the stage sections)}`}/>
+      <ML s={Tx`M_u=1.25\eta(M_{DC1}+M_{DC2})+1.50\eta M_{DW}+1.75\eta m\,M_{LL+IM}${uM.sym}=${nx(OL.gDC,3)}(${nx(sM.M1,0)}+${nx(sM.M2,0)})+${nx(OL.gDW,3)}(${nx(sM.Mw,0)})+${nx(OL.gLL,3)}(${nx(sM.MlD,0)})${uM.val}=${nx(sM.Mu,0)}\;\text{k-ft}\quad(x=${nx(sM.x,1)}')`}/>
+      <ML s={Tx`V_u=\left|1.25\eta(V_{DC1}+V_{DC2})+1.50\eta V_{DW}${uV.sym}\right|+1.75\eta m\left|V_{LL+IM}\right|=\left|${nx(OL.gDC,3)}(${nx(sV.V1,1)}+${nx(sV.V2,1)})+${nx(OL.gDW,3)}(${nx(sV.Vw,1)})${uV.val}\right|+${nx(OL.gLL,3)}(${nx(Math.abs(sV.VlD),1)})=${nx(sV.Vu,1)}\;\text{kip}\quad(x=${nx(sV.x,1)}')`}/>
+      <ML s={Tx`\text{Service II: }M=M_{DC1}+M_{DC2}+M_{DW}+1.30m\,M_{LL+IM}${uS}=M_{DC1}+M_{DC2}+M_{DW}+${nx(OL.gS2,3)}M_{LL+IM}${uS}\;\text{(stresses accumulated on the stage sections)}`}/>
+      {R.ut&&<div className="mnote">MassDOT utilities from GirderDetail as their own loads (factors in 2. Input parameters, MassDOT utilities): each utility factor by whether it adds to the effect checked; V_u in the worse direction.</div>}
       <div className="mnote">Owner load rules of {OL.o} from GirderDetail (factors worked in 2. Input parameters, Owner load rules): η = {fmt(OL.eta,3)} on the Strength I maximum factors, design load multiplier m = {fmt(OL.m,2)} on HL-93 LL+IM at Strength I and Service II{OL.plOn?' (not on the pedestrian load PL)':''}. Live-load deflection, fatigue, constructibility and the load rating use neither η nor m.</div>
@@ -6123,5 +6216,9 @@ function crModel(R,inp,o){
     const rowsOf=list=>list.map(l=>{ const q=stn[l.i]; return {q,lab:l.lab}; });
-    const mt=list=><CrT wide head={['Location','x (ft)','M_DC1','M_DC2','M_DW','+M_LL+IM','−M_LL+IM','+M_u','−M_u']}
+    const mt=list=>R.ut? <CrT wide head={['Location','x (ft)','M_DC1','M_DC2','M_DW','M_UT','M_UF','+M_LL+IM','−M_LL+IM','+M_u','−M_u']}
+      rows={rowsOf(list).map(({q,lab})=>[lab,fmt(q.x,2),fmt(q.M1,0),fmt(q.M2,0),fmt(q.Mw,0),fmt(q.Mut,0),fmt(q.Muf,0),fmt(q.Ml,0),fmt(q.Mln,0),fmt(q.Mu,0),fmt(q.Mun,0)])}/>   // GD54c
+      : <CrT wide head={['Location','x (ft)','M_DC1','M_DC2','M_DW','+M_LL+IM','−M_LL+IM','+M_u','−M_u']}
       rows={rowsOf(list).map(({q,lab})=>[lab,fmt(q.x,2),fmt(q.M1,0),fmt(q.M2,0),fmt(q.Mw,0),fmt(q.Ml,0),fmt(q.Mln,0),fmt(q.Mu,0),fmt(q.Mun,0)])}/>;
-    const vt=list=><CrT wide head={['Location','x (ft)','V_DC1','V_DC2','V_DW','V_LL+IM','V_u']}
+    const vt=list=>R.ut? <CrT wide head={['Location','x (ft)','V_DC1','V_DC2','V_DW','V_UT','V_UF','V_LL+IM','V_u']}
+      rows={rowsOf(list).map(({q,lab})=>[lab,fmt(q.x,2),fmt(q.V1,1),fmt(q.V2,1),fmt(q.Vw,1),fmt(q.Vut,1),fmt(q.Vuf,1),fmt(q.Vl,1),fmt(q.Vu,1)])}/>   // GD54c
+      : <CrT wide head={['Location','x (ft)','V_DC1','V_DC2','V_DW','V_LL+IM','V_u']}
       rows={rowsOf(list).map(({q,lab})=>[lab,fmt(q.x,2),fmt(q.V1,1),fmt(q.V2,1),fmt(q.Vw,1),fmt(q.Vl,1),fmt(q.Vu,1)])}/>;
@@ -6722,3 +6819,3 @@ function App(){
     for(const st of p.stations){ for(const k of keys) if(typeof st[k]!=='number'||!isFinite(st[k])) return 'station value '+k+' is not a number';
-      for(const k of ['M_FATpos','M_FATneg','V_FATpos','V_FATneg','M_DC1steel','V_DC1steel','M_DC1wet','V_DC1wet','M_PLpos','M_PLneg','V_PLpos','V_PLneg']) if(st[k]!==undefined&&!(typeof st[k]==='number'&&isFinite(st[k]))) return 'station value '+k+' is not a number'; }
+      for(const k of ['M_FATpos','M_FATneg','V_FATpos','V_FATneg','M_DC1steel','V_DC1steel','M_DC1wet','V_DC1wet','M_PLpos','M_PLneg','V_PLpos','V_PLneg','M_UT','V_UT','M_UF','V_UF']) if(st[k]!==undefined&&!(typeof st[k]==='number'&&isFinite(st[k]))) return 'station value '+k+' is not a number'; }
     if(p.ownerRules!==undefined){ const o=p.ownerRules, ok=v=>v===undefined||v===null||(typeof v==='number'&&isFinite(v)&&v>0);   // GD49 (optional)
@@ -6768,2 +6865,3 @@ function App(){
       +(p.ownerRules?(()=>{ const L={...ownLFOf(p),...lfFac(ownLFOf(p))}; return 'Owner load rules ('+(L.o||'?')+'), applied to the girder checks and the transverse deck design: \u03b7 = '+fmt(L.eta,3)+' on the Strength I factors, design load multiplier m = '+fmt(L.m,2)+' on HL-93 LL+IM at Strength I and Service II'+(L.m!==1&&p.pedestrianInLL===true&&p.stations.some(s=>s.M_PLpos!==undefined)?' (not on the pedestrian load)':'')+', haunch '+(L.h0?'0':'as entered')+' in composite properties'+(L.rt?', design rating target RF \u2265 '+fmt(L.rt,2):'')+'.\n'; })():'')
+      +(p.stations.some(s=>s.M_UT!==undefined||s.M_UF!==undefined)?'MassDOT utilities as their own loads (GD54c): '+[p.stations.some(s=>s.M_UT!==undefined)?'existing M_UT/V_UT (DW factors 1.50/0.65, Service 1.0, in the camber)':'',p.stations.some(s=>s.M_UF!==undefined)?'future allowance M_UF/V_UF (1.25/0, Service 1.0 where it adds, not in the camber)':''].filter(Boolean).join('; ')+', on the steel section; not at deck placement.\n':'')
       +(rows.length?'\nDesign inputs that change:\n'+rows.join('\n')+'\n':'')
@@ -6978,2 +7076,3 @@ function App(){
       {R.ok&&R.lf&&R.lf.on&&<div className="noprint" style={{padding:'10px 24px 0'}}><OwnBanner R={R} go={setTab}/></div>}
+      {R.ok&&R.ut&&<div className="noprint" style={{padding:'10px 24px 0'}}><UtBanner R={R}/></div>}
       <div className="tabs noprint">{TABS.map(([k,l])=>
```


## 2026-10-19 — PR: claude/gd-stgirder-load-inputs (GDL: GirderDetail's load inputs shown on the Inputs tab while its demands are in use; engineer request 2026-10-19; cross-tool PR with Steel Bridge Beam Modules.html and HANDOFF.md §4.9; display only; PR link added after merge)

Engineer's request: "When the analysis is sent from GirderDetail to ST-Girder, bring over the load inputs as well so there is no confusion. Update the load section of the Input tab with the correct inputs from the GirderDetail app."

### GDL. Load inputs from GirderDetail (`girderDetail.loads`) on the Inputs tab, pull summary and report   [display only — no result change, Tier 1]
- **Where:** helpers after `UtCard` (anchor `/* GDL (engineer request 2026-10-19; HANDOFF.md 4.9)`): `gdLoadsOf`, `gdLsrc`, `gdLoadsCheck`, `gdLoadGroups`, `gdLoadRows`, `gdOwnUse`, `gdLLText`, `GdLoadsBox`, `GdFld`. Inputs tab, Loads card (`const gL=extActive?gdLoadsOf(extRaw):null`): `GdLoadsBox` after the dlLoads strip; the DC1 cross-check hint hidden while `gL`; DC1 fields (steel self-weight, deck + haunch, other DC1) as `GdFld`; construction live load note; cross-frame list replaced by GirderDetail's point loads; DC1, DC2, DW hints; DC2 and DW fields as `GdFld`; live load hint. Deck card: deck-design note after the Table A4-1 hint. `gdCheck`: `gdLoadsCheck`. `gdAdopt` message: the load-input block before "Design inputs that change". Report `2. Input parameters`: "Loads (per girder) from GirderDetail (LLDF and DLs, G#)" (key `inp.gdl`) in place of the own-load list when `R.useExt&&gdLoadsOf(ext)`.
- **Before:** with GirderDetail demands, the Loads card showed ST-Girder's own load inputs (default session: steel 0.233, deck + haunch 0.983, Add'l DC1 0.015, DC2 0.300, DW 0.250 klf), which are not the loads behind the imported forces; the report listed them as "Loads (per girder)".
- **After (only when the imported demands are from GirderDetail and carry `girderDetail.loads`):** a box "Load inputs from GirderDetail (LLDF and DLs, G#)" lists every component (name, category, klf on this girder, basis, distribution and source) and the live load (HL-93, IM, lanes, deflection factor, pedestrian); the DC1 / DC2 / DW fields show GirderDetail's values locked (read-only, "from GirderDetail (LLDF and DLs, G#)"); utilities and the pedestrian load are read-only rows. ST-Girder's own inputs are **not changed** (session and saved project unchanged) and show again after "✕ use built-in simple-span analysis". The outputs that still read ST-Girder's own inputs are listed (box, next to the field, Deck card, pull summary, report) and not switched: constructibility (construction live load `loads.wConstr`), live load deflection (`loads.NL`), transverse deck design (`deck.wsFut`, slab thickness for the dead load, `deck.wBar`, `deck.bBar`, and `deck.oh` of an interior girder).
- **Step 1 findings (outputs that read the Input-tab load fields while GirderDetail demands are in use):** `computeAll` takes M and V of DC1 (`hasDC1`), DC2, DW, LL+IM, fatigue (`hasFat`, `hasFatV`) and the utilities from the import, so `loads.wDCextra`, `loads.wBar`, `loads.wDW`, `loads.diaph`, the computed self-weight and deck + haunch, `llAuto`/`dfAuto`/`dfm`/`dfv`/`de`, `extDF*` (per girder: not applied) and `fatM`/`fatV` (imported fatigue) feed no result. Used: `loads.wConstr` (constructibility, 1.5·w on a simple span), `loads.NL` (live load deflection distribution factor), `deck.wsFut`, `deck.tsSeparate`/`tsDL`, `deck.wBar`, `deck.bBar`, `deck.oh` (deck design). `loads.pos` and `loads.skew` are set by the pull (existing). The superReactions note text still names ST-Girder's DC1 composition (its reactions come from the import).
- **Governing provision:** none changed (display only).
- **Check case (built-in 15°, AASHTO, G2 payload made by the branch):** Inputs tab: steel 0.254 (GirderDetail) in place of 0.233; deck + haunch 0.983 (0.950 + 0.033; ST-Girder's own also 0.983); other DC1 0.123 (SIP) in place of 0.015; DC2 0.251 (0.171 + 0.080) in place of 0.300; DW 0.208 in place of 0.250 klf. Still own: construction 0.010 vs 0.190 klf; N_L 2 (0.400) vs 3 (0.510); deck: FWS 0.025 ksf (same), slab 8.00 in (same), barrier 0.300 vs 0.400 klf, base 18 in (same), overhang 3.00 vs 3.25 ft. Every computed result is identical to main (below); the results if switched are in ENGINEER_CHECKS GD69.
- **How verified:** `node tests/check-syntax.mjs stgirder.html` (JSX transpiled, all pass). `node tests/compare.mjs --tool st --payload def15_AASHTO_G2,def15_RIDOT_Iyes_G2,xsA_RIDOT_Iyes_G1,util_MassDOT_G2` (payloads without `loads`) and the branch's payloads (built-in AASHTO G2, util MassDOT G2, built-in with a sidewalk RIDOT G1; with `loads`): **all sections identical** to main (session, status, checks, rating, governing, sections, stations), no console errors. Page text of every tab and Inputs sub-pane, main vs branch (headless, `#gdpull`): identical for the payloads without `loads`; with `loads` only the Inputs Loads and Deck panes, the "Loaded from GirderDetail" summary banner and the report section differ. The session after the pull keeps ST-Girder's own `loads` (0.015 / 0.30 / 0.25 / 0.010 / 2); after "✕ use built-in simple-span analysis" the own values show. Screenshots of the Loads and Deck panes checked.
- **Saved data:** none changed. The payload rides in `inp.external` (existing field); a session saved by this branch opens in main (main ignores `loads`).
- **Other copies:** the sender is `Steel Bridge Beam Modules.html` (fixlog GDL there).
- **Open items:** ENGINEER_CHECKS GD69 (a) constructibility, (b) live load deflection lanes, (c) deck design inputs: switch to GirderDetail's values or keep ST-Girder's own.
- **Diff (main → branch; no context lines):**
```diff
diff --git a/stgirder.html b/stgirder.html
index 7a9a1df..c7168cb 100644
--- a/stgirder.html
+++ b/stgirder.html
@@ -2456,0 +2457,72 @@ function UtCard({R}){ const ls=utLines(R); if(!ls) return null; const U=R.ut, st
+/* GDL (engineer request 2026-10-19; HANDOFF.md 4.9): the load INPUTS GirderDetail used for this girder (girderDetail.loads, optional), shown on the
+   Inputs tab, in the pull summary and in the report in place of ST-Girder's own load inputs while these GirderDetail demands are in use. Display only:
+   no result reads them (the forces are the imported demands). ST-Girder's own inputs are not changed and show again when the demands are cleared.
+   gdOwnUse lists the outputs that still read ST-Girder's own load inputs while these demands are in use (kept as they were; engineer to decide). */
+function gdLoadsOf(ext){ const L=extFromGD(ext)&&ext.girderDetail.loads; return L&&typeof L==='object'&&Array.isArray(L.components)? L : null; }
+const gdLsrc=ext=>'from GirderDetail (LLDF and DLs, '+((ext&&ext.girderDetail&&ext.girderDetail.label)||'G?')+')';
+function gdLoadsCheck(L){ if(L===undefined) return null;
+  if(!L||typeof L!=='object'||!Array.isArray(L.components)) return 'girderDetail.loads is not a list of load components';
+  const fin=v=>v===undefined||v===null||(typeof v==='number'&&isFinite(v));
+  for(const c of L.components){ if(!c||typeof c!=='object') return 'girderDetail.loads: a component is not an object';
+    for(const k of ['w','wTotal','wMin','wMax','Ptotal','thickness','unitWeight','psf','width','widthIn','x']) if(!fin(c[k])) return 'girderDetail.loads: '+(c.name||c.id||'a component')+', '+k+' is not a number'; }
+  for(const [k,v] of Object.entries(L.totals||{})) if(!fin(v)) return 'girderDetail.loads.totals.'+k+' is not a number';
+  return null; }
+// the GirderDetail values in ST-Girder's own load groups
+function gdLoadGroups(L){ const C=L.components, w=id=>{ const c=C.find(q=>q.id===id); return c&&typeof c.w==='number'? c.w : 0; }, T=L.totals||{};
+  const core=['steel','xf','deck','haunch','sip'], sumCat=k=>C.filter(q=>q.category===k&&typeof q.w==='number').reduce((a,q)=>a+q.w,0);
+  const otherDC1=C.filter(q=>q.category==='DC1'&&!core.includes(q.id));
+  return { steel:C.find(q=>q.id==='steel')||null, xf:C.find(q=>q.id==='xf')||null, deckHaunch:w('deck')+w('haunch'), deck:w('deck'), haunch:w('haunch'), sip:w('sip'),
+    otherDC1, addDC1:w('sip')+otherDC1.reduce((a,q)=>a+(q.w||0),0), dc2:typeof T.DC2==='number'?T.DC2:sumCat('DC2'), dw:typeof T.DW==='number'?T.DW:sumCat('DW'),
+    dc2rows:C.filter(q=>q.category==='DC2'), dwrows:C.filter(q=>q.category==='DW'), utrows:C.filter(q=>q.category==='UT'||q.category==='UF') }; }
+// one line per component: [name, category, w on this girder, basis, distribution and source]
+function gdLoadRows(L){ const f=(v,d)=>typeof v==='number'&&isFinite(v)?fmt(v,d):'—';
+  const basis=c=>c.id==='steel'? '0.490 kcf × (1 + '+f(c.allowancePct,0)+'%); '+f(c.wMin,3)+' to '+f(c.wMax,3)+' klf along the girder ('+(c.wIs||'average')+')'
+    : c.id==='xf'? f(c.points,0)+' point loads, '+f(c.Ptotal,2)+' kip in all'
+    : c.id==='deck'? f(c.thickness,2)+' in'+(c.tsSacrificial>0?' ('+f(c.tsStructural,2)+' + '+f(c.tsSacrificial,2)+' sacrificial)':'')+' × '+f(c.unitWeight,3)+' kcf × '+f(c.width,2)+' ft tributary'
+    : c.id==='haunch'? f(c.thickness,2)+' in × '+f(c.widthIn,1)+' in × '+f(c.unitWeight,3)+' kcf'
+    : c.id==='sip'? f(c.psf,1)+' psf × '+f(c.width,2)+' ft'
+    : [c.wTotal!=null?'whole load '+f(c.wTotal,3)+' klf':'', c.thickness!=null?f(c.thickness,2)+' in × '+f(c.unitWeight,3)+' kcf':'', c.psf!=null?f(c.psf,1)+' psf':'', c.width!=null?'width '+f(c.width,2)+' ft':'', c.x!=null?'at x = '+f(c.x,2)+' ft':''].filter(Boolean).join(', ');
+  const dist=c=>[c.distLabel||(c.dist==='tributary'?'tributary width':''), c.byMethod?'by the method':'', c.overridden?'overridden ('+c.overridden.join(', ')+')':''].filter(Boolean).join(', ');
+  return L.components.map(c=>[c.name||c.id, c.category||'', c.w==null?'—':f(c.w,3), basis(c), [dist(c),c.source||''].filter(Boolean).join(' · ')]); }
+// ST-Girder outputs that read its OWN load inputs while GirderDetail demands are in use: [{out, what, own, gd, ownT, gdT, same}]
+function gdOwnUse(inp,L,ext){ const out=[], f=(v,d)=>typeof v==='number'&&isFinite(v)?fmt(v,d):'—', eq=(a,b)=>typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<=1e-6;
+  const add=o=>out.push({...o,same:eq(o.own,o.gd)});
+  const C=L.construction||null, ld=inp.loads, dk=inp.deck, gd=(ext&&ext.girderDetail)||{};
+  add({out:'Constructibility (6.10.3, deck placement)', what:'construction live load', own:+ld.wConstr||0, gd:C&&typeof C.w==='number'?C.w:null,
+    ownT:f(+ld.wConstr||0,3)+' klf', gdT:C?f(C.w,3)+' klf ('+f(C.psf,0)+' psf × '+f(C.width,2)+' ft)':'not sent'});
+  const LL=L.liveLoad||{}, NLc=clamp(Math.round(+ld.NL||1),1,4), mpf=[1.2,1.0,0.85,0.65][NLc-1], nG=Math.max(+inp.geom.nGirders,1);
+  add({out:'Live load deflection (2.5.2.6.2, optional)', what:'number of design lanes N_L', own:NLc, gd:typeof LL.lanes==='number'?LL.lanes:null,
+    ownT:f(NLc,0)+' (Δ distribution factor m·N_L/N_b = '+f(mpf,2)+'·'+NLc+'/'+f(nG,0)+' = '+f(mpf*NLc/nG,3)+')', gdT:typeof LL.lanes==='number'?f(LL.lanes,0)+(typeof LL.deflectionDF==='number'?' ('+f(LL.deflectionDF,3)+')':''):'not sent'});
+  if(dk.deckOn&&dk.designOn){ const ws=L.wearingSurface, D=L.deck||{}, E=L.edges||{}, nb=+gd.nGirders||0, gi=+gd.girder||0;
+    const sd=gi===1?['L']:(nb&&gi===nb)?['R']:['L','R'], eg=sd.map(s=>E[s]).filter(Boolean), one=a=>a.length&&a.every(v=>eq(v,a[0]))?a[0]:null, side=sd.length>1?' (left / right)':'';
+    add({out:'Deck design (transverse)', what:'future wearing surface', own:+dk.wsFut, gd:ws&&typeof ws.psf==='number'?ws.psf/1000:null, ownT:f(+dk.wsFut,3)+' ksf', gdT:ws?f(ws.psf/1000,3)+' ksf ('+f(ws.psf,1)+' psf)':'none'});
+    add({out:'Deck design (transverse)', what:'slab thickness for the dead load', own:dk.tsSeparate?(+dk.tsDL||+dk.ts):+dk.ts, gd:typeof D.tsDL==='number'?D.tsDL:null,
+      ownT:f(dk.tsSeparate?(+dk.tsDL||+dk.ts):+dk.ts,2)+' in', gdT:typeof D.tsDL==='number'?f(D.tsDL,2)+' in'+(D.tsac>0?' ('+f(D.ts,2)+' + '+f(D.tsac,2)+' sacrificial)':''):'not sent'});
+    const bw=eg.map(e=>e.type==='curb'?e.railing:e.w), bb=eg.map(e=>e.type==='curb'?e.curbWidthIn:e.width*12);
+    add({out:'Deck design (overhang)', what:'barrier weight', own:+dk.wBar, gd:one(bw), ownT:f(+dk.wBar,3)+' klf',
+      gdT:!eg.length?'not sent':one(bw)!=null&&eg.every(e=>e.type===eg[0].type)?(eg[0].type==='curb'?'curb + railing ':'')+f(one(bw),3)+' klf'+(sd.length>1?' (both sides)':''):eg.map(e=>e.type==='curb'?'curb + railing '+f(e.railing,3)+' klf':f(e.w,3)+' klf').join(' / ')+side});
+    add({out:'Deck design (overhang)', what:'barrier base width', own:+dk.bBar, gd:one(bb), ownT:f(+dk.bBar,1)+' in',
+      gdT:!eg.length?'not sent':one(bb)!=null&&eg.every(e=>e.type===eg[0].type)?f(one(bb),1)+' in'+(eg[0].type==='curb'?' (curb)':'')+(sd.length>1?' (both sides)':''):eg.map(e=>e.type==='curb'?f(e.curbWidthIn,1)+' in (curb)':f(e.width*12,1)+' in').join(' / ')+side});
+    if(gd.position!=='exterior'&&typeof D.overhangL==='number'){ const oh=sd.length>1?[D.overhangL,D.overhangR]:[sd[0]==='L'?D.overhangL:D.overhangR];
+      add({out:'Deck design (overhang)', what:'overhang (girder CL to deck edge; geometry)', own:+dk.oh, gd:one(oh), ownT:f(+dk.oh,2)+' ft', gdT:one(oh)!=null?f(one(oh),2)+' ft'+(sd.length>1?' (both sides)':''):oh.map(v=>f(v,2)+' ft').join(' / ')+side}); } }
+  return out; }
+function gdLLText(L){ const LL=L.liveLoad||{}, f=(v,d)=>typeof v==='number'&&isFinite(v)?fmt(v,d):'—', im=LL.im||{}, pd=LL.pedestrian;
+  return [(LL.vehicle||'HL-93')+(LL.note?' ('+LL.note+')':''), 'IM '+f(im.truck,0)+'% on the truck and tandem, '+f(im.fatigue,0)+'% on the fatigue truck',
+    f(LL.lanes,0)+' design lanes ('+f(LL.laneWidth,2)+' ft wide, roadway '+f(LL.roadway,2)+' ft)'+(typeof LL.deflectionDF==='number'?'; live load deflection distribution factor '+f(LL.deflectionDF,3):''),
+    'distribution factors: the per-girder values listed with the imported live load',
+    pd?'pedestrian '+f(pd.psf,0)+' psf on '+f(pd.widthL,2)+' ft (left) and '+f(pd.widthR,2)+' ft (right) walkable widths: '+f(pd.w,3)+' klf on this girder, '+(pd.inLL?'included in the imported LL+IM':'not in the imported LL+IM'):'no pedestrian load']; }
+// Inputs tab: the GirderDetail load inputs (read-only) and the outputs that still use ST-Girder's own inputs
+function GdLoadsBox({inp,L,ext}){ const own=gdOwnUse(inp,L,ext), src=gdLsrc(ext);
+  return <div id="stg-d-gdl" className="callout" style={{marginTop:0,marginBottom:12,borderLeftColor:'#1C4FC4',background:'#EEF4FF'}}>
+    <b>Load inputs {src}</b>
+    <div style={{fontSize:11.5,marginTop:3,lineHeight:1.55}}>The loads GirderDetail applied to this girder for the imported forces. The DC1, DC2, DW and live load fields below show them (locked, read-only); every row is listed here. ST-Girder’s own load inputs are kept and come back when these demands are no longer used (“✕ use built-in simple-span analysis” on the imported-demands banner, Inputs tab). {L.distribution&&L.distribution.label?<span>Superimposed loads distributed to the girders by <b>{L.distribution.label}</b>{L.distribution.beamClass?<span> ({L.distribution.beamClass})</span>:null}.</span>:null}</div>
+    <Tbl head={['Load','Cat.','w on this girder (klf)','Basis','Distribution · source']} rows={gdLoadRows(L).map(r=>({c:r}))}/>
+    <div style={{fontSize:11.5,marginTop:6,lineHeight:1.55}}><b>Live load:</b> {gdLLText(L).join('; ')}.</div>
+    {own.length>0&&<div style={{fontSize:11.5,marginTop:6,lineHeight:1.55}}><b style={{color:'#9a3412'}}>Still computed with ST-Girder’s own inputs while these demands are in use</b> (not switched to GirderDetail’s values; engineer to decide):
+      <ul style={{margin:'2px 0 0 18px',padding:0}}>{own.map((o,i)=><li key={i}>{o.out} uses ST-Girder’s own {o.what}: <b>{o.ownT}</b>; GirderDetail used {o.gdT}{o.same?' (same)':''}.</li>)}</ul></div>}
+  </div>; }
+// a locked field showing a GirderDetail value in place of an ST-Girder input (the input itself is not changed)
+const GdFld=({l,u,v,src,title})=>(
+  <div className="fld"><label>{l}</label><div className="fwrap">
+    <input value={v} readOnly className="bl-driven" title={title||('Shown '+src+' while these demands are in use; ST-Girder’s own value is kept.')}/>
+    {u&&<span className="unit">{u}</span>}</div><span className="bl-src">{src}</span></div>);
@@ -4313,0 +4386,3 @@ function InputsTab({inp,set,R}){
+        {(()=>{ const gL=extActive?gdLoadsOf(extRaw):null; if(!gL) return null; const own=gdOwnUse(inp,gL,extRaw).filter(o=>/^Deck design/.test(o.out)); if(!own.length) return null;   // GDL (2026-10-19)
+          return <div className="hint" style={{marginTop:6,color:'#9a3412'}}>GirderDetail demands are in use: the deck design still uses ST-Girder’s own inputs above (not switched to GirderDetail’s; engineer to decide):
+            <ul style={{margin:'2px 0 0 18px',padding:0}}>{own.map((o,i)=><li key={i}>{o.what}: <b>{o.ownT}</b>; GirderDetail used {o.gdT}{o.same?' (same)':''}</li>)}</ul></div>; })()}
@@ -4344,0 +4420,3 @@ function InputsTab({inp,set,R}){
+      // GDL (2026-10-19): GirderDetail's load inputs shown in place of ST-Girder's own while its demands with girderDetail.loads are in use (display only)
+      const gL=extActive?gdLoadsOf(extRaw):null, gG=gL?gdLoadGroups(gL):null, gSrc=gL?gdLsrc(extRaw):'', gOwn=gL?gdOwnUse(inp,gL,extRaw):[];
+      const gOwnOf=what=>gOwn.find(o=>o.what===what);
@@ -4357 +4435,2 @@ function InputsTab({inp,set,R}){
-      {(()=>{ const r=dlPeek; if(!r||r.why||!(r.dc1>0)||!Ld) return null;
+      {gL&&<GdLoadsBox inp={inp} L={gL} ext={extRaw}/>}
+      {(()=>{ const r=dlPeek; if(gL||!r||r.why||!(r.dc1>0)||!Ld) return null;
@@ -4364,0 +4444,5 @@ function InputsTab({inp,set,R}){
+          {gL? <React.Fragment>
+            <GdFld l="Steel self-weight (average)" u="klf" v={gG.steel?fmt(gG.steel.w,3):'—'} src={gSrc} title={gG.steel?('GirderDetail: '+fmt(gG.steel.wMin,3)+' to '+fmt(gG.steel.wMax,3)+' klf along the girder, with the '+fmt(gG.steel.allowancePct,0)+'% detail allowance'):undefined}/>
+            <GdFld l="Deck + haunch" u="klf" v={fmt(gG.deckHaunch,3)} src={gSrc}/>
+            <GdFld l="Add'l DC1 (forms, other DC1)" u="klf" v={fmt(gG.addDC1,3)} src={gSrc}/>
+          </React.Fragment> : <React.Fragment>
@@ -4369,0 +4454 @@ function InputsTab({inp,set,R}){
+          </React.Fragment>}
@@ -4371,0 +4457 @@ function InputsTab({inp,set,R}){
+        {gL&&gOwnOf('construction live load')&&<div className="hint" style={{marginTop:4,color:'#9a3412'}}>Constructibility (deck placement) still uses ST-Girder’s own construction live load: <b>{gOwnOf('construction live load').ownT}</b>; GirderDetail used {gOwnOf('construction live load').gdT}{gOwnOf('construction live load').same?' (same)':''}. Not switched (engineer to decide).</div>}
@@ -4375 +4461 @@ function InputsTab({inp,set,R}){
-            <button className="btn sm" onClick={()=>S('loads.diaph',[...(loads.diaph||[]),{P:1.0,a:0}])}>+ add</button>
+            {!gL&&<button className="btn sm" onClick={()=>S('loads.diaph',[...(loads.diaph||[]),{P:1.0,a:0}])}>+ add</button>}
@@ -4377 +4463,2 @@ function InputsTab({inp,set,R}){
-          {(loads.diaph||[]).length===0
+          {gL? <div className="hint" style={{marginTop:0}}>{gG.xf?<span><b>{fmt(gG.xf.points,0)} point loads, {fmt(gG.xf.Ptotal,2)} kip in all</b> at this girder’s frames ({gG.xf.source||'GirderDetail'})</span>:<span>None in GirderDetail’s DC1 (the cross-frame weight is off or entered as a line load there)</span>}; <span className="bl-src" style={{display:'inline'}}>{gSrc}</span>. ST-Girder’s own list is kept and not used while these demands are in use (DC1 is imported).</div>
+          : (loads.diaph||[]).length===0
@@ -4387 +4474,2 @@ function InputsTab({inp,set,R}){
-        {Ld&&<div className="hint" style={{marginTop:6}}>Distributed DC1 = <b>{fmt(Ld.wDC1,3)} klf</b>{Ld.Pdia>0?<React.Fragment> + {fmt(Ld.Pdia,2)} kip diaphragms</React.Fragment>:null} · M_DC1(mid) = <b>{fmt(Ld.Mdc1,0)} k-ft</b>. Steel self-weight uses 0.490 kcf on the bare section; put stiffener/connection allowance under "Add'l DC1".</div>}
+        {gL&&<div className="hint" style={{marginTop:6}}>GirderDetail DC1 on this girder: steel {gG.steel?<b>{fmt(gG.steel.w,3)} klf</b>:'—'} (average; on the steel section) + deck {fmt(gG.deck,3)} + haunch {fmt(gG.haunch,3)} + SIP forms {fmt(gG.sip,3)}{gG.otherDC1.length?<span> + {gG.otherDC1.map(q=>q.name+' '+fmt(q.w,3)).join(' + ')}</span>:null} = wet <b>{fmt(gG.deckHaunch+gG.addDC1,3)} klf</b>{gG.xf?<span> + {fmt(gG.xf.Ptotal,2)} kip cross-frames</span>:null}. These produced the imported M_DC1 / V_DC1.</div>}
+        {Ld&&!gL&&<div className="hint" style={{marginTop:6}}>Distributed DC1 = <b>{fmt(Ld.wDC1,3)} klf</b>{Ld.Pdia>0?<React.Fragment> + {fmt(Ld.Pdia,2)} kip diaphragms</React.Fragment>:null} · M_DC1(mid) = <b>{fmt(Ld.Mdc1,0)} k-ft</b>. Steel self-weight uses 0.490 kcf on the bare section; put stiffener/connection allowance under "Add'l DC1".</div>}
@@ -4393 +4481,3 @@ function InputsTab({inp,set,R}){
-        <div className="frow"><Num l="Barrier / SIDL (per girder)" u="klf" v={loads.wBar} set={v=>S('loads.wBar',v)} step={0.01} driven={dlLocked&&dlHasBar} src={dlSrc}/></div>
+        <div className="frow">{gL? <GdFld l="Barrier / SIDL (per girder)" u="klf" v={fmt(gG.dc2,3)} src={gSrc}/>
+          : <Num l="Barrier / SIDL (per girder)" u="klf" v={loads.wBar} set={v=>S('loads.wBar',v)} step={0.01} driven={dlLocked&&dlHasBar} src={dlSrc}/>}</div>
+        {gL&&<div className="hint" style={{marginTop:4}}>{gG.dc2rows.length?gG.dc2rows.map(q=>q.name+' '+fmt(q.w,3)).join(' + ')+' = '+fmt(gG.dc2,3)+' klf':'No DC2 rows'} (GirderDetail; these produced the imported M_DC2 / V_DC2).</div>}
@@ -4399 +4489,3 @@ function InputsTab({inp,set,R}){
-        <div className="frow"><Num l="Wearing surface (per girder)" u="klf" v={loads.wDW} set={v=>S('loads.wDW',v)} step={0.01} driven={dlLocked&&dlHasDW} src={dlSrc}/></div>
+        <div className="frow">{gL? <GdFld l="Wearing surface (per girder)" u="klf" v={fmt(gG.dw,3)} src={gSrc}/>
+          : <Num l="Wearing surface (per girder)" u="klf" v={loads.wDW} set={v=>S('loads.wDW',v)} step={0.01} driven={dlLocked&&dlHasDW} src={dlSrc}/>}</div>
+        {gL&&<div className="hint" style={{marginTop:4}}>{gG.dwrows.length?gG.dwrows.map(q=>q.name+' '+fmt(q.w,3)).join(' + ')+' = '+fmt(gG.dw,3)+' klf':'No DW rows'} (GirderDetail; these produced the imported M_DW / V_DW).{gG.utrows.length?<span> Utilities, their own loads on the steel section (not DW here): {gG.utrows.map(q=>q.name+' ('+q.category+') '+fmt(q.w,3)+' klf').join('; ')}.</span>:null}</div>}
@@ -4421,0 +4514 @@ function InputsTab({inp,set,R}){
+        {gL&&<div className="hint" style={{marginBottom:8}}><span className="bl-src" style={{display:'inline'}}>Live load {gSrc}</span>: {gdLLText(gL).join('; ')}.{gOwnOf('number of design lanes N_L')?<span style={{color:'#9a3412'}}> Live load deflection (optional check) still uses ST-Girder’s own number of design lanes N_L = <b>{gOwnOf('number of design lanes N_L').ownT}</b>; GirderDetail used {gOwnOf('number of design lanes N_L').gdT}{gOwnOf('number of design lanes N_L').same?' (same)':''}. Not switched (engineer to decide).</span>:null}</div>}
@@ -6088 +6181,11 @@ function crModel(R,inp,o){
-    sub(s,'Loads (per girder)','3.4.1 · 3.6',<React.Fragment><CrKV rows={[['Steel self-weight (0.490 kcf)',fmt(ld.wsw,3),'klf'],['Deck slab + haunch',fmt(ld.wdk,3),'klf'],
+    if(R.useExt&&gdLoadsOf(ext)){ const L=gdLoadsOf(ext), G=gdLoadGroups(L), own=gdOwnUse(inp,L,ext);   // GDL (2026-10-19): GirderDetail's load inputs in place of ST-Girder's own (display only)
+      sub(s,'Loads (per girder) '+gdLsrc(ext),'3.4.1 · 3.6',<React.Fragment>
+        <p className="cr-note">The loads GirderDetail applied to this girder for the imported forces (unfactored, per girder). ST-Girder’s own load inputs are kept but not used for these forces.{L.distribution&&L.distribution.label?' Superimposed loads distributed to the girders by '+L.distribution.label+(L.distribution.beamClass?' ('+L.distribution.beamClass+')':'')+'.':''}</p>
+        <CrKV rows={[['DC1 steel (average along the girder)',G.steel?fmt(G.steel.w,3):'—','klf'],['DC1 deck + haunch',fmt(G.deckHaunch,3),'klf'],['DC1 other (SIP forms, other DC1 rows)',fmt(G.addDC1,3),'klf'],
+          ['DC1 cross-frames / diaphragms',G.xf?fmt(G.xf.points,0)+' point loads, '+fmt(G.xf.Ptotal,2)+' kip':'none'],['DC2 barrier / SIDL',fmt(G.dc2,3),'klf'],['DW wearing surface',fmt(G.dw,3),'klf'],
+          ...G.utrows.map(q=>[q.name+' ('+q.category+')',fmt(q.w,3),'klf']),['Live load',gdLLText(L).join('; ')]]}/>
+        <CrT wide head={['Load','Cat.','w (klf)','Basis','Distribution · source']} rows={gdLoadRows(L)}/>
+        {own.length>0&&<React.Fragment><p className="cr-note"><b>Still computed with ST-Girder’s own inputs while these demands are in use</b> (not switched to GirderDetail’s values; engineer to decide):</p>
+          <ul className="cr-ul">{own.map((o,i)=><li key={i}>{o.out}: {o.what} {o.ownT}; GirderDetail used {o.gdT}{o.same?' (same)':''}.</li>)}</ul></React.Fragment>}
+      </React.Fragment>); tag(s,'inp.gdl'); }
+    else sub(s,'Loads (per girder)','3.4.1 · 3.6',<React.Fragment><CrKV rows={[['Steel self-weight (0.490 kcf)',fmt(ld.wsw,3),'klf'],['Deck slab + haunch',fmt(ld.wdk,3),'klf'],
@@ -6824,0 +6928 @@ function App(){
+    { const le=gdLoadsCheck(p.girderDetail&&p.girderDetail.loads); if(le) return le; }   // GDL (2026-10-19, optional)
@@ -6866,0 +6971,5 @@ function App(){
+      +(gdLoadsOf(p)?(()=>{ const L=gdLoadsOf(p), G=gdLoadGroups(L), own=gdOwnUse(nx,L,p), f3=v=>fmt(v,3);   // GDL (2026-10-19): display only
+        return 'Load inputs '+gdLsrc(p)+', shown on the Inputs tab in place of ST-Girder\u2019s own (kept, not changed; they show again when these demands are cleared): DC1 steel '+(G.steel?f3(G.steel.w)+' klf average':'\u2014')
+          +', deck + haunch '+f3(G.deckHaunch)+', other DC1 '+f3(G.addDC1)+' klf'+(G.xf?', cross-frames '+fmt(G.xf.Ptotal,2)+' kip':'')+'; DC2 '+f3(G.dc2)+' klf; DW '+f3(G.dw)+' klf'
+          +(G.utrows.length?'; utilities '+G.utrows.map(q=>q.category+' '+f3(q.w)).join(', ')+' klf':'')+'; live load '+((L.liveLoad&&L.liveLoad.vehicle)||'HL-93')+', '+gdLLText(L).filter((t,i)=>i!==0&&i!==3).join('; ')+'.\n'
+          +(own.length?'Still computed with ST-Girder\u2019s own inputs (not switched):\n'+own.map(o=>'  '+o.out+': '+o.what+' '+o.ownT+' (GirderDetail '+o.gdT+(o.same?', same':'')+')').join('\n')+'\n':''); })():'')
```


## 2026-10-19 — PR: claude/gd-stgirder-import-all (GDX: GirderDetail's inputs transferred and highlighted; GD69 switched; engineer decision 2026-10-19; cross-tool PR with Steel Bridge Beam Modules.html, HANDOFF.md §4.9 and ENGINEER_CHECKS GD69/GD70; PR link added after merge)

Engineer decisions (2026-10-19): switch the constructibility construction live load, the live load deflection N_L and the deck overhang inputs to GirderDetail's values (GD69), and "Whatever can be imported from GirderDetail should be. I think the various input sections of the ST-Girder app should be highlighted indicating they were transferred from the GirderDetail app."

### GDX-1. Transferred inputs (`gdXfer`, `gdOverlay`)   [RESULT CHANGE for GirderDetail payloads that carry `girderDetail.loads` — §4 callout] [Tier 2]
- **Where:** helpers after `GdFld` (anchor `/* GDX (engineer decision 2026-10-19`): `GD_FAT_CATS`, `gdXfer`, `gdOverlay`, `gdPulled`, `gdFieldOf`, `GD_LBL`, `GD_PANE_OF`, `GdBadge`. `computeAll`: first line `inp=gdOverlay(inp);`. Report `crModel`: `gXr`, `gPr`, `gm`, `inp=gdOverlay(inp)` before `const ld=R.loads…`. Capacity hand-off: `category:gdOverlay(inp).fatigue.category`. `gdOwnUse`: each item has `path`; the transferred ones are filtered out.
- **Before:** ST-Girder used its own construction live load, N_L, deck design inputs, stiffener, stud and fatigue inputs beside GirderDetail's forces.
- **After:** while GirderDetail demands with `girderDetail.loads` are in use, `computeAll` (and the report and capacity hand-off) use these GirderDetail values; ST-Girder's saved inputs are not changed (they apply again after "✕ use built-in simple-span analysis"):

| ST-Girder input | GirderDetail value | Condition |
|---|---|---|
| `loads.wConstr` | `loads.construction.w` (construction LL psf × b_eff) | always (ST-Girder's 1.5·w simple-span method kept; GirderDetail's "Con" combination is on the continuous girder) |
| `loads.NL` | `loads.liveLoad.lanes` | 1 to 4 |
| `deck.deckOn` | true (composite girder) | always |
| `deck.wsFut` | `wearingSurface.psf` / 1000 | a wearing surface row |
| `deck.tsSeparate`, `deck.tsDL` | t_s + sacrificial | separate only when the sacrificial thickness > 0 |
| `deck.wBar`, `deck.bBar` | deck edge barrier w, width × 12 | barrier edges; interior girder: both edges equal |
| `deck.oh` (interior girder) | overhang | both overhangs equal (exterior: set by the pull, as before) |
| `stiff.bt`, `stiff.tp` | Transverse stiffeners type A | single-sided (ST-Girder's I_t = t_p b_t³/3) |
| `stiff.Fys` | stiffener grade F_y | transverse and bearing grades equal |
| `conn.studD`, `conn.studH` | Shear connectors d, h | always |
| `fatigue.ADTT`, `fatigue.adttIsSingleLane` | (ADTT)SL = p × ADTT, entered as single-lane | ADTT > 0 |
| `fatigue.designLife`, `fatigue.lsMode` | Fatigue design life, limit state | life > 0; auto / I / II |
| `fatigue.category` | Girder section bottom flange fatigue detail | a valid category |

  Not transferred (GD70, method or interpretation): d_o, bearing stiffeners, studs per row and pitch, cycles n, a curb edge, unequal edges or overhangs for an interior girder, stiffener pairs, unequal stiffener grades. Payloads without `loads` (before 2026-10-19), MIDAS/MCT imports, the built-in analysis: `gdXfer` returns null and `gdOverlay` returns the same object: nothing changes.
- **Governing provisions (AASHTO LRFD 10th Ed. (2024)):** constructibility 6.10.3.2.1, 6.10.3.3 with construction loads 3.4.2.1 (γ = 1.5); live load deflection 2.5.2.6.2 (all design lanes loaded, all girders deflecting equally, multiple presence 3.6.1.1.2); deck overhang 3.6.1.3.4, Table 4.6.2.1.3-1 (strip 45.0 + 10.0X), Table 3.4.1-1 (DC 1.25, DW 1.50, LL 1.75; A13 railing collision not checked, as before); transverse stiffeners 6.10.11.1.2, 6.10.11.1.3; fatigue 3.6.1.4.2 ((ADTT)SL = p × ADTT), Table 3.4.1-1 (Fatigue I 1.75, Fatigue II 0.80), 6.6.1.2.3 (Tables 6.6.1.2.3-1, -2: category B, A = 120 × 10⁸, (ΔF)TH = 16 ksi), 6.6.1.2.5; studs 6.10.10.1.2, 6.10.10.2.
- **Before → after (ST-Girder, span 1; main 0573760 vs branch; payloads made by the branch):**

| Check | Built-in 15°, AASHTO, G2 | `util.json`, MassDOT, G2 | Built-in + 6 ft sidewalk, RIDOT, G1 (exterior) |
|---|---|---|---|
| LL deflection Δ (in), ratio to L/800 = 1.650 | 0.552 → 0.704; 0.335 → 0.427 | 0.590 → 0.752; 0.358 → 0.456 | 0.611 → 0.779; 0.370 → 0.472 |
| Constr. compression flange f_bu (ksi), ratio | 13.945 → 17.959; 0.360 → 0.464 | same as AASHTO | 11.711 → 15.052; 0.302 → 0.389 |
| Constr. shear V_u (kip), ratio | 121.75 → 136.60; 0.155 → 0.174 | same | 102.60 → 114.98; 0.131 → 0.147 |
| Fatigue (flange) | C detail, Fatigue II: 3.552 / 5.437 ksi, 0.653 → B detail, Fatigue I: 7.769 / 16.0, 0.486 | C: 3.673 / 5.437, 0.676 → B: 8.035 / 16.0, 0.502 | C: 6.121 / 5.437, **1.126 FAIL** → B: 13.389 / 16.0, **0.837 pass** |
| Transverse stiffener I_t provided (in⁴), ratio | 36.0 → 11.39; 0.148 → 0.469 | same | 36.0 → 13.29 (GirderDetail t_p = 7/16 in); 0.148 → 0.402 |
| Transverse stiffener b_t ≥ min, ratio | 0.667 → 0.889 | same | same |
| Transverse stiffener b_t ≤ 16t_p (in) | 6 / 8 → 4.5 / 6.0 (ratio 0.75) | same | 6 / 8 → 4.5 / 7.0 (0.75 → 0.643) |
| Stud fatigue pitch: required (in), ratio (12 in provided) | 9.681 → 9.123; 1.239 → 1.315 (fails before and after) | 9.535 → 8.985; 1.259 → 1.336 | 9.111 → 8.586; 1.317 → 1.398 |
| Deck overhang M_u (k-ft/ft), ratio | 6.811 → 9.628; 0.506 → 0.716 | same | 10.848 → 11.161; 0.806 → 0.830 |

  Unchanged in all three: every Strength, Service, rating, camber, section and station result (`compare.mjs` sections `st.rating`, `st.governing`, `st.sections`, `st.stations` identical). The payloads with `loads` but no `details` (`tests/projects/st/*_loads.json`) change only the first three rows and the deck overhang.
- **Hand checks (built-in AASHTO G2, L = 110 ft):**
  - Construction shear: ΔV = 1.5 × (0.190 − 0.010) × 110 / 2 = 14.85 kip; 121.7525 + 14.85 = 136.6025 kip ✓. Flange: f_bu = [1.25 M_DC1(x) + 1.5 w x(L − x)/2] × 12 / S_t,bare; the construction term at the governing x = 44 ft is 1.5 × 0.190 × 44 × 66 / 2 = 413.8 k-ft (before: 1.5 × 0.010 × 38.5 × 71.5 / 2 = 20.6 k-ft at x = 38.5 ft).
  - Deflection: g_Δ = m N_L / N_b = 0.85 × 3 / 5 = 0.510 (before 1.00 × 2 / 5 = 0.400); Δ = g_Δ × max(Δ_truck, 0.25Δ_truck + Δ_lane) = 0.510 × max(1.3807, 0.3452 + 0.6674) = 0.704 in ✓.
  - Overhang (w_slab = 8/12 × 0.150 = 0.100 ksf, b_bar = 1.5 ft, oh = 3.25 ft, P_bar = 0.400 klf): M_DC = 0.100 × 3.25²/2 + 0.400 × (3.25 − 0.75) = 0.528 + 1.000 = 1.528; M_DW = 0.025 × (3.25 − 1.5)²/2 = 0.038; X = 3.25 − 1.5 − 1.0 = 0.75 ft, strip = 45 + 7.5 = 52.5 in; M_LL = 1.33 × 1.2 × 16 × 0.75 / (52.5/12) = 4.378; M_u = 1.25(1.528) + 1.50(0.038) + 1.75(4.378) = 9.628 k-ft/ft ✓; φM_n = 13.451 → 0.716 ✓.
  - Fatigue: (ADTT)SL = 0.85 × 2000 = 1700 ≥ the category B crossover (1120 for 75 yr, n = 1) → Fatigue I: γΔf = 1.75 × 4.4395 = 7.769 ≤ (ΔF)TH = 16 ksi → 0.486 ✓ (before: C, 1000 < 1682 → Fatigue II: 0.80 × 4.4395 = 3.552 ≤ (44 × 10⁸ / (365 × 75 × 1 × 1000))^(1/3) = 5.437 ✓).
  - Stiffener: I_t = t_p b_t³/3 = 0.375 × 4.5³ / 3 = 11.39 in⁴ ✓; b_t,min = max(2 + 60/30, 16/4) = 4.0 → 4.0/4.5 = 0.889 ✓; 16 t_p = 6.0 in.
  - Studs: Fatigue I Z_r = 5.5 d² = 5.5 × 0.875² = 4.211 kip (before Fatigue II: α d² with α = 34.5 − 4.28 log(27.375 × 10⁶) = 2.668 → 2.043); V_f with γ = 1.75 (was 0.80): 38.71 → 84.68 kip; p_req 9.681 → 9.123 in.
- **How verified (Tier 2):** `node tests/check-syntax.mjs stgirder.html` (all pass). `node tests/compare.mjs --tool st --payload def15_AASHTO_G2,def15_RIDOT_Iyes_G2,xsA_RIDOT_Iyes_G1,util_MassDOT_G2` (payloads without `loads`): **all sections identical** to main. The branch payloads (AASHTO G2, MassDOT util G2, RIDOT sidewalk G1) and `def15_AASHTO_G2_loads`, `util_MassDOT_G2_loads`: only the values in the table differ (`st.checks`), no console errors. Page text of every tab and Inputs sub-pane, main vs branch, payloads without `loads` (def15_AASHTO_G2, xsA_RIDOT_Iyes_G1): identical. After the pull the session keeps ST-Girder's own inputs; after "✕ use built-in simple-span analysis" they show and apply (screenshot).
- **Saved data:** none changed (the overlay is never saved; `inp.external` as before).
- **Other copies:** sender `Steel Bridge Beam Modules.html` (fixlog GDX there).
- **Open items:** ENGINEER_CHECKS GD70 (a)–(e).

### GDX-2. "Transferred from GirderDetail" highlight   [display only]
- **Where:** CSS `.gd-in`, `.gd-src`, `.stgInTab.gd-tab`, `.gd-legend`; `Num` and `Sel` take an optional `gd` prop ({lock, v, src}: locked, shows GirderDetail's value; {hl, src}: tinted only); InputsTab `gX`, `gPu`, `G(path)`, `inpE`, `gdPanes` (after `clearExt`); every `Num` with `set={v=>S('path',v)}` gets `gd={G('path')}`; grade and fatigue category `Sel`; checkboxes composite deck, separate dead-load thickness (locked), b_eff auto, hybrid, flange transitions (badge); fatigue limit state and ADTT basis as `GdFld` when transferred; N_L field in the live load section; legend above the sub-tabs; "GD" on sub-tabs; the not-transferred list on Stiffeners / Studs / Fatigue; `GdFld` restyled to the GD look; report marks `gm(...)` in 2. Input parameters; pull summary lists the transferred inputs and the ones not transferred.
- **Behaviour:** tinted with "GD 🔒 · from GirderDetail (<module>, G#)" = transferred (GDX-1); tinted with "GD · …" = set by the existing pull and still GirderDetail's value (editable; the tint goes when edited). Nothing for payloads without `loads`, MIDAS/MCT imports or the built-in analysis (page text identical to main).
- **Diff (main → branch; no context lines; GDX-1 and GDX-2):**
```diff
diff --git a/stgirder.html b/stgirder.html
index 5859151..f81c5e3 100644
--- a/stgirder.html
+++ b/stgirder.html
@@ -559,0 +560,5 @@ input.ovr, select.ovr { outline: 2px solid #c98a1b; outline-offset: -1px; backgr
+/* GDX (2026-10-19): inputs transferred from GirderDetail */
+.gd-in{background:#e8f1ff !important;border-color:#1C4FC4 !important;color:#0b2e7a !important}
+.gd-src{display:block;margin-top:3px;font:600 10px/1.35 ui-sans-serif,system-ui,sans-serif;color:#1C4FC4;letter-spacing:.01em}
+.stgInTab.gd-tab span:first-child::after{content:' GD';font:700 9px/1 ui-sans-serif,system-ui,sans-serif;color:#fff;background:#1C4FC4;border-radius:3px;padding:1px 3px;margin-left:5px;vertical-align:1px}
+.gd-legend{border-left:3px solid #1C4FC4;background:#EEF4FF;padding:6px 10px;margin:0 0 10px;font-size:11.5px;line-height:1.5;color:var(--text-dim)}
@@ -2491 +2496 @@ function gdOwnUse(inp,L,ext){ const out=[], f=(v,d)=>typeof v==='number'&&isFini
-  add({out:'Constructibility (6.10.3, deck placement)', what:'construction live load', own:+ld.wConstr||0, gd:C&&typeof C.w==='number'?C.w:null,
+  add({path:'loads.wConstr',out:'Constructibility (6.10.3, deck placement)', what:'construction live load', own:+ld.wConstr||0, gd:C&&typeof C.w==='number'?C.w:null,
@@ -2494 +2499 @@ function gdOwnUse(inp,L,ext){ const out=[], f=(v,d)=>typeof v==='number'&&isFini
-  add({out:'Live load deflection (2.5.2.6.2, optional)', what:'number of design lanes N_L', own:NLc, gd:typeof LL.lanes==='number'?LL.lanes:null,
+  add({path:'loads.NL',out:'Live load deflection (2.5.2.6.2, optional)', what:'number of design lanes N_L', own:NLc, gd:typeof LL.lanes==='number'?LL.lanes:null,
@@ -2498,2 +2503,2 @@ function gdOwnUse(inp,L,ext){ const out=[], f=(v,d)=>typeof v==='number'&&isFini
-    add({out:'Deck design (transverse)', what:'future wearing surface', own:+dk.wsFut, gd:ws&&typeof ws.psf==='number'?ws.psf/1000:null, ownT:f(+dk.wsFut,3)+' ksf', gdT:ws?f(ws.psf/1000,3)+' ksf ('+f(ws.psf,1)+' psf)':'none'});
-    add({out:'Deck design (transverse)', what:'slab thickness for the dead load', own:dk.tsSeparate?(+dk.tsDL||+dk.ts):+dk.ts, gd:typeof D.tsDL==='number'?D.tsDL:null,
+    add({path:'deck.wsFut',out:'Deck design (transverse)', what:'future wearing surface', own:+dk.wsFut, gd:ws&&typeof ws.psf==='number'?ws.psf/1000:null, ownT:f(+dk.wsFut,3)+' ksf', gdT:ws?f(ws.psf/1000,3)+' ksf ('+f(ws.psf,1)+' psf)':'none'});
+    add({path:'deck.tsSeparate',out:'Deck design (transverse)', what:'slab thickness for the dead load', own:dk.tsSeparate?(+dk.tsDL||+dk.ts):+dk.ts, gd:typeof D.tsDL==='number'?D.tsDL:null,
@@ -2502 +2507 @@ function gdOwnUse(inp,L,ext){ const out=[], f=(v,d)=>typeof v==='number'&&isFini
-    add({out:'Deck design (overhang)', what:'barrier weight', own:+dk.wBar, gd:one(bw), ownT:f(+dk.wBar,3)+' klf',
+    add({path:'deck.wBar',out:'Deck design (overhang)', what:'barrier weight', own:+dk.wBar, gd:one(bw), ownT:f(+dk.wBar,3)+' klf',
@@ -2504 +2509 @@ function gdOwnUse(inp,L,ext){ const out=[], f=(v,d)=>typeof v==='number'&&isFini
-    add({out:'Deck design (overhang)', what:'barrier base width', own:+dk.bBar, gd:one(bb), ownT:f(+dk.bBar,1)+' in',
+    add({path:'deck.bBar',out:'Deck design (overhang)', what:'barrier base width', own:+dk.bBar, gd:one(bb), ownT:f(+dk.bBar,1)+' in',
@@ -2507,2 +2512,2 @@ function gdOwnUse(inp,L,ext){ const out=[], f=(v,d)=>typeof v==='number'&&isFini
-      add({out:'Deck design (overhang)', what:'overhang (girder CL to deck edge; geometry)', own:+dk.oh, gd:one(oh), ownT:f(+dk.oh,2)+' ft', gdT:one(oh)!=null?f(one(oh),2)+' ft'+(sd.length>1?' (both sides)':''):oh.map(v=>f(v,2)+' ft').join(' / ')+side}); } }
-  return out; }
+      add({path:'deck.oh',out:'Deck design (overhang)', what:'overhang (girder CL to deck edge; geometry)', own:+dk.oh, gd:one(oh), ownT:f(+dk.oh,2)+' ft', gdT:one(oh)!=null?f(one(oh),2)+' ft'+(sd.length>1?' (both sides)':''):oh.map(v=>f(v,2)+' ft').join(' / ')+side}); } }
+  const X=gdXfer(ext); return X? out.filter(o=>!X.set[o.path]) : out; }   // GDX (2026-10-19): what is transferred is no longer "own"; the rest needs a decision
@@ -2527,2 +2532,76 @@ const GdFld=({l,u,v,src,title})=>(
-    <input value={v} readOnly className="bl-driven" title={title||('Shown '+src+' while these demands are in use; ST-Girder’s own value is kept.')}/>
-    {u&&<span className="unit">{u}</span>}</div><span className="bl-src">{src}</span></div>);
+    <input value={v} readOnly className="gd-in" title={title||('Shown '+src+' while these demands are in use; ST-Girder’s own value is kept.')}/>
+    {u&&<span className="unit">{u}</span>}</div><span className="gd-src">GD 🔒 · {src}</span></div>);
+/* GDX (engineer decision 2026-10-19: "Whatever can be imported from GirderDetail should be", and the transferred inputs highlighted; HANDOFF.md 4.9).
+   Active only for GirderDetail demands that carry girderDetail.loads (payloads from 2026-10-19 on); nothing for older payloads, MIDAS/MCT imports or the
+   built-in analysis. gdXfer(ext).set = the inputs taken from GirderDetail (1:1 values only), applied by gdOverlay in computeAll, the report and the
+   capacity hand-off, shown locked on the Inputs tab; ST-Girder's own values stay in the saved inputs and apply again when the demands are cleared.
+   gdXfer(ext).dec = GirderDetail values NOT imported because they would need a method or interpretation change (engineer to decide).
+   gdPulled(ext,inp) = the inputs the existing pull already wrote (gdAdopt), highlighted while they still hold GirderDetail's value. */
+const GD_FAT_CATS=['A','B',"B'",'C',"C'",'D','E',"E'"];
+function gdXfer(ext){
+  if(!extFromGD(ext)||!gdLoadsOf(ext)) return null;
+  if(ext.__gdx) return ext.__gdx;
+  const g=ext.girderDetail, L=g.loads, Dt=g.details||{}, lab=g.label||(ext.member&&ext.member.key)||'G?', set={}, dec=[];
+  const num=v=>typeof v==='number'&&isFinite(v), S=m=>'from GirderDetail ('+m+', '+lab+')', f=(v,d)=>num(v)?fmt(v,d):'—';
+  const put=(path,v,mod,pane)=>{ if(num(v)||typeof v==='boolean'||typeof v==='string') set[path]={v,src:S(mod),pane}; };
+  const no=(pane,path,what,gdT,why)=>dec.push({pane,path,what,gdT,why});
+  // (a) constructibility, (b) live load deflection, (c) deck design (engineer decision 2026-10-19)
+  const C=L.construction; if(C&&num(C.w)) put('loads.wConstr',C.w,'Structural analysis, construction live load','loads');
+  const LL=L.liveLoad||{}; if(num(LL.lanes)&&LL.lanes>=1) put('loads.NL',clamp(Math.round(LL.lanes),1,4),'LLDF and DLs, design lanes','loads');
+  put('deck.deckOn',true,'composite girder','deck');
+  const ws=L.wearingSurface; if(ws&&num(ws.psf)) put('deck.wsFut',ws.psf/1000,'LLDF and DLs, wearing surface','deck');
+  const Dk=L.deck||{}; if(num(Dk.tsDL)&&num(Dk.ts)){ const sep=num(Dk.tsac)&&Dk.tsac>0; put('deck.tsSeparate',sep,'deck, sacrificial thickness','deck'); if(sep) put('deck.tsDL',Dk.tsDL,'deck, t_s + sacrificial','deck'); }
+  const E=L.edges||{}, nb=+g.nGirders||0, gi=+g.girder||0, sd=gi===1?['L']:(nb&&gi===nb)?['R']:['L','R'], eg=sd.map(s=>E[s]).filter(Boolean);
+  if(eg.length===sd.length&&eg.every(e=>e.type==='barrier'&&num(e.w)&&num(e.width))&&eg.every(e=>e.w===eg[0].w&&e.width===eg[0].width)){
+    put('deck.wBar',eg[0].w,'LLDF and DLs, deck edge barrier','deck'); put('deck.bBar',eg[0].width*12,'LLDF and DLs, deck edge barrier','deck'); }
+  else if(eg.length) no('deck','deck.wBar','barrier weight and base width (deck overhang design)',eg.map(e=>e.type==='curb'?'curb '+f(e.curbWidthIn,1)+' in + railing '+f(e.railing,3)+' klf':f(e.w,3)+' klf, '+f(e.width*12,1)+' in').join(' / ')+(sd.length>1?' (left / right)':''),
+    eg.some(e=>e.type==='curb')?'a curb and railing is not the single barrier the overhang design models':'the two deck edges differ; which one governs this interior girder is a choice');
+  if(g.position!=='exterior'&&num(Dk.overhangL)&&num(Dk.overhangR)){ if(Dk.overhangL===Dk.overhangR) put('deck.oh',Dk.overhangL,'deck overhang','deck');
+    else no('deck','deck.oh','overhang (deck overhang design, interior girder)',f(Dk.overhangL,2)+' ft / '+f(Dk.overhangR,2)+' ft (left / right)','the two overhangs differ; which one to check is a choice'); }
+  // details (stiffeners, studs, fatigue)
+  const T=Dt.transverseStiffener, B=Dt.bearingStiffeners, St=Dt.studs, F=Dt.fatigue;
+  if(T){ if(T.sides===1&&num(T.bt)&&num(T.tp)){ put('stiff.bt',T.bt,'Transverse stiffeners, '+(T.type||'type A'),'details'); put('stiff.tp',T.tp,'Transverse stiffeners, '+(T.type||'type A'),'details'); }
+    else no('details','stiff.bt','transverse stiffener b_t × t_p',f(T.bt,2)+' × '+f(T.tp,3)+' in, '+(T.sides===2?'pairs':'?'),'ST-Girder checks a single plate (I_t = t_p b_t³/3); a pair needs another I_t');
+    no('details','stiff.doSpc','transverse stiffener spacing d_o',(T.spacings||[]).length?(T.spacings.map(v=>f(v,1)).join(', ')+' in at the stiffener rows (supports and cross-frames)'):'none listed',
+      'GirderDetail designs stiffeners at its listed rows; ST-Girder applies one d_o to every panel of the span (and to the end panel)'); }
+  if(T&&B&&num(T.Fy)&&T.Fy===B.Fy) put('stiff.Fys',T.Fy,'Transverse and bearing stiffeners, grade '+T.grade,'details');
+  else if(T&&B) no('details','stiff.Fys','stiffener F_ys','transverse '+f(T.Fy,0)+' ksi, bearing '+f(B.Fy,0)+' ksi','ST-Girder has one F_ys for both');
+  if(B) no('details','stiff.bearB','bearing stiffeners',(B.types||[]).map(t=>t.name+' '+f(t.pairs,0)+' pair(s) '+f(t.bt,2)+' × '+f(t.tp,3)+' in').join('; '),
+    'ST-Girder checks one bearing stiffener for the peak V_u of the span (abutment or pier); which GirderDetail type applies, and pairs vs. its plate count, is a choice');
+  if(St){ if(num(St.d)) put('conn.studD',St.d,'Shear connectors','details'); if(num(St.h)) put('conn.studH',St.h,'Shear connectors','details');
+    no('details','conn.pitch','studs per row and pitch',(St.zones||[]).length+' zones: '+[...new Set((St.zones||[]).map(z=>z.nr+' @ '+f(z.p,1)+' in'))].slice(0,6).join(', ')+((St.zones||[]).length>6?', …':''),
+      'GirderDetail varies the studs by zone; ST-Girder checks one row count and pitch for the span'); }
+  if(F){ if(num(F.ADTTsl)&&F.ADTTsl>0){ put('fatigue.ADTT',F.ADTTsl,'Fatigue, (ADTT)SL = p × ADTT = '+f(F.p,2)+' × '+f(F.ADTT,0),'details'); put('fatigue.adttIsSingleLane',true,'Fatigue, (ADTT)SL','details'); }
+    if(num(F.life)&&F.life>0) put('fatigue.designLife',F.life,'Fatigue, design life','details');
+    if(['auto','I','II'].includes(F.limit)) put('fatigue.lsMode',F.limit,'Fatigue, limit state','details');
+    if(GD_FAT_CATS.includes(F.catBot)) put('fatigue.category',F.catBot,'Girder section, bottom flange fatigue detail','details');
+    if((F.cycles||[]).length) no('details','fatigue.ncyc','cycles per truck passage n',F.cycles.map(v=>f(v,1)).join(', ')+' (by detail)','GirderDetail sets n per detail; ST-Girder uses one n for the span'); }
+  const out={set,dec,lab}; try{ Object.defineProperty(ext,'__gdx',{value:out,enumerable:false,configurable:true}); }catch(e){} return out; }
+// the effective inputs: ST-Girder's inputs with the GirderDetail values of gdXfer applied (the same object when nothing is transferred)
+function gdOverlay(inp){ const X=inp&&gdXfer(inp.external); if(!X) return inp; const ks=Object.keys(X.set); if(!ks.length) return inp;
+  const o={...inp}; ks.forEach(k=>{ const [a,b]=k.split('.'); if(o[a]===inp[a]) o[a]={...inp[a]}; o[a][b]=X.set[k].v; }); return o; }
+// the inputs the existing pull (gdAdopt) wrote, with GirderDetail's value: highlighted while the input still holds it
+function gdPulled(ext,inp){ if(!gdXfer(ext)) return {}; const g=ext.girderDetail, m=g.materials||{}, d=g.deck||{}, br=g.bracing||{}, sk=g.skew||{}, o={}, lab=g.label||'G?';
+  const num=v=>typeof v==='number'&&isFinite(v), pos=v=>num(v)&&v>0, S=t=>'from GirderDetail ('+t+', '+lab+')', put=(k,v,t)=>{ if(v!==undefined&&v!==null) o[k]={v,src:S(t)}; };
+  if(pos(m.Fyf)&&pos(m.Fyw)&&pos(m.Fu)){ put('mat.Fyf',m.Fyf,'materials'); put('mat.Fyw',m.Fyw,'materials'); put('mat.Fu',m.Fu,'materials'); put('mat.hybrid',m.Fyw!==m.Fyf,'materials');
+    const gk=Object.keys(GRADES).find(k=>GRADES[k].Fy===m.Fyf&&GRADES[k].Fu===m.Fu); if(gk) put('mat.grade',gk,'materials'); if(pos(m.Es)) put('mat.Es',m.Es,'materials'); }
+  if(pos(d.ts)) put('deck.ts',d.ts,'deck'); if(num(d.haunch)&&d.haunch>=0) put('deck.haunch',d.haunch,'deck'); if(pos(m.fc)) put('deck.fc',m.fc,'materials'); if(pos(m.wc)) put('deck.wc',m.wc,'materials');
+  if(pos(d.beff)){ put('deck.beffAuto',false,'Structural analysis, b_eff'); put('deck.beff',d.beff,'Structural analysis, b_eff'); }
+  if(g.position==='exterior'&&num(g.overhang)&&g.overhang>=0) put('deck.oh',g.overhang,'deck overhang');
+  if(pos(d.Ar)){ put('negM.As',d.Ar,'Structural analysis, deck reinforcement'); if(pos(d.ts)) put('negM.dTop',d.ts/2,'Structural analysis, deck mid-depth'); }
+  if(pos(g.spacing)) put('geom.S',g.spacing,'girder spacing'); if(pos(g.nGirders)) put('geom.nGirders',g.nGirders,'girders'); if(pos(br.Lb)) put('geom.Lb',br.Lb,'Cross-frames, L_b');
+  const sel=ext._selSpan||externalSpans(ext)[0]; if(sel&&pos(sel.len)) put('geom.L',sel.len,'span '+(sel.idx||1));
+  if(g.position==='interior'||g.position==='exterior') put('loads.pos',g.position,'girder position'); if(num(sk.max)) put('loads.skew',sk.max,'largest support skew');
+  const z=sel?zonesToSec(ext,sel,inp.sec):null; if(z) ['D','tw','bft','tft','bfb','tfb','useSegs'].forEach(k=>{ if(z[k]!==undefined) put('sec.'+k,z[k],'Preliminary sizing plates'); });
+  if(z&&z.useSegs&&Array.isArray(z.segs)) put('sec.segs',z.segs,'Preliminary sizing plate zones');
+  return o; }
+// one field's GirderDetail state on the Inputs tab: {lock, v, src} (transferred, locked), {hl, src} (pulled, still GirderDetail's value) or null
+function gdFieldOf(inp,X,Pu,path){ if(!X) return null; if(X.set[path]) return {lock:true,v:X.set[path].v,src:X.set[path].src};
+  const q=Pu[path]; if(!q) return null; const [a,b]=path.split('.'), cur=inp[a]&&inp[a][b];
+  const same=typeof q.v==='number'? Math.abs((+cur)-q.v)<=1e-9 : (q.v&&typeof q.v==='object')? JSON.stringify(cur)===JSON.stringify(q.v) : cur===q.v; return same? {hl:true,v:q.v,src:q.src} : null; }
+const GD_LBL={'loads.wConstr':'construction live load (klf)','loads.NL':'design lanes N_L','deck.deckOn':'composite deck','deck.wsFut':'future wearing surface (ksf)',
+  'deck.tsSeparate':'separate dead-load slab thickness','deck.tsDL':'slab thickness for dead load (in)','deck.wBar':'barrier weight (klf)','deck.bBar':'barrier base width (in)','deck.oh':'overhang (ft)',
+  'stiff.bt':'transverse stiffener b_t (in)','stiff.tp':'transverse stiffener t_p (in)','stiff.Fys':'stiffener F_ys (ksi)','conn.studD':'stud diameter (in)','conn.studH':'stud height (in)',
+  'fatigue.ADTT':'ADTT (single-lane, (ADTT)SL)','fatigue.adttIsSingleLane':'ADTT entered as single-lane','fatigue.designLife':'fatigue design life (yr)','fatigue.lsMode':'fatigue limit state','fatigue.category':'fatigue detail category'};
+const GD_PANE_OF={sec:'section',negM:'section',mat:'mat',deck:'deck',geom:'span',loads:'loads',stiff:'details',conn:'details',fatigue:'details'};
+const GdBadge=({g})=>g?<span className="gd-src" title={g.src}>GD{g.lock?' 🔒':''} · {g.src}</span>:null;
@@ -2868,0 +2948 @@ function computeAll(inp){
+  inp=gdOverlay(inp);   // GDX (2026-10-19): GirderDetail's transferred inputs (same object, unchanged, without them)
@@ -3638 +3718,2 @@ const Card=({title,refTag,right,children,id})=>(
-const Num=({l,u,v,set,step=0.1,min,driven,src})=>(
+// gd (GDX, 2026-10-19; optional): {lock, v, src} = transferred from GirderDetail (locked, shows v); {hl, src} = pulled from GirderDetail (highlight only)
+const Num=({l,u,v,set,step=0.1,min,driven,src,gd})=>{ const lk=!!(gd&&gd.lock); return (
@@ -3640,4 +3721,4 @@ const Num=({l,u,v,set,step=0.1,min,driven,src})=>(
-    <input type="number" step={step} min={min} value={v}
-      readOnly={!!driven} title={driven?('Driven by '+(src||'a locked shared channel')+' — unlock to edit.'):undefined}
-      className={driven?'bl-driven':undefined}
-      onChange={e=>{ if(driven) return; set(e.target.value===''?'':+e.target.value); }}/>
+    <input type="number" step={step} min={min} value={lk?gd.v:v}
+      readOnly={!!driven||lk} title={lk?('Transferred '+gd.src+' — used while these demands are in use; ST-Girder’s own value is kept.'):driven?('Driven by '+(src||'a locked shared channel')+' — unlock to edit.'):undefined}
+      className={gd?'gd-in':driven?'bl-driven':undefined}
+      onChange={e=>{ if(driven||lk) return; set(e.target.value===''?'':+e.target.value); }}/>
@@ -3645,2 +3726,2 @@ const Num=({l,u,v,set,step=0.1,min,driven,src})=>(
-    {driven&&src?<span className="bl-src">{src}</span>:null}</div>);
-const Sel=({l,v,set,opts})=>(
+    {gd?<span className="gd-src">GD{lk?' 🔒':''} · {gd.src}</span>:driven&&src?<span className="bl-src">{src}</span>:null}</div>); };
+const Sel=({l,v,set,opts,gd})=>{ const lk=!!(gd&&gd.lock); return (
@@ -3648 +3729,2 @@ const Sel=({l,v,set,opts})=>(
-    <select value={v} onChange={e=>set(e.target.value)}>{opts.map(o=><option key={o}>{o}</option>)}</select></div></div>);
+    <select value={lk?gd.v:v} disabled={lk} className={gd?'gd-in':undefined} onChange={e=>{ if(lk) return; set(e.target.value); }}>{opts.map(o=><option key={o}>{o}</option>)}</select></div>
+    {gd?<span className="gd-src">GD{lk?' 🔒':''} · {gd.src}</span>:null}</div>); };
@@ -4037,0 +4120,3 @@ function InputsTab({inp,set,R}){
+  // GDX (2026-10-19): inputs transferred from GirderDetail (locked) or pulled from it (highlighted); nothing without GirderDetail demands carrying loads
+  const gX=extActive?gdXfer(extRaw):null, gPu=gX?gdPulled(extRaw,inp):{}, G=path=>gdFieldOf(inp,gX,gPu,path), inpE=gdOverlay(inp);
+  const gdPanes={}; if(gX){ Object.keys(gX.set).forEach(k=>{ gdPanes[GD_PANE_OF[k.split('.')[0]]]=1; }); Object.keys(gPu).forEach(k=>{ if(G(k)) gdPanes[GD_PANE_OF[k.split('.')[0]]]=1; }); }
@@ -4243,0 +4329 @@ function InputsTab({inp,set,R}){
+    {gX&&<div className="gd-legend"><b>GD</b> = transferred from GirderDetail ({gX.lab}). Tinted fields with <b>GD 🔒</b> take GirderDetail’s value while these demands are in use (locked; your own value is kept and returns when the demands are cleared with “✕ use built-in simple-span analysis”). Tinted fields with <b>GD</b> only were set by the pull and still hold GirderDetail’s value (editable). Sub-tabs marked GD contain transferred inputs. White fields have no GirderDetail source.{gX.dec.length?<span> {gX.dec.length} GirderDetail value{gX.dec.length>1?'s are':' is'} not transferred (method or interpretation; listed on the Deck and Stiffeners / Studs / Fatigue tabs).</span>:null}</div>}
@@ -4247 +4333 @@ function InputsTab({inp,set,R}){
-        className={'stgInTab'+(inBad[k]?' has-err':'')} title={inBad[k]?'An input on this tab needs attention':undefined}
+        className={'stgInTab'+(inBad[k]?' has-err':'')+(gdPanes[k]?' gd-tab':'')} title={inBad[k]?'An input on this tab needs attention':gdPanes[k]?'Inputs on this tab were transferred from GirderDetail':undefined}
@@ -4257,2 +4343,2 @@ function InputsTab({inp,set,R}){
-        <Num l="Web depth D" u="in" v={sec.D} set={v=>S('sec.D',v)} step={1}/>
-        <Num l="Web thick tw" u="in" v={sec.tw} set={v=>S('sec.tw',v)} step={0.0625}/>
+        <Num l="Web depth D" u="in" v={sec.D} set={v=>S('sec.D',v)} step={1} gd={G('sec.D')}/>
+        <Num l="Web thick tw" u="in" v={sec.tw} set={v=>S('sec.tw',v)} step={0.0625} gd={G('sec.tw')}/>
@@ -4262,2 +4348,2 @@ function InputsTab({inp,set,R}){
-        <Num l="Width bft" u="in" v={sec.bft} set={v=>S('sec.bft',v)} step={0.5}/>
-        <Num l="Thick tft" u="in" v={sec.tft} set={v=>S('sec.tft',v)} step={0.0625}/>
+        <Num l="Width bft" u="in" v={sec.bft} set={v=>S('sec.bft',v)} step={0.5} gd={G('sec.bft')}/>
+        <Num l="Thick tft" u="in" v={sec.tft} set={v=>S('sec.tft',v)} step={0.0625} gd={G('sec.tft')}/>
@@ -4267,2 +4353,2 @@ function InputsTab({inp,set,R}){
-        <Num l="Width bfb" u="in" v={sec.bfb} set={v=>S('sec.bfb',v)} step={0.5}/>
-        <Num l="Thick tfb" u="in" v={sec.tfb} set={v=>S('sec.tfb',v)} step={0.0625}/>
+        <Num l="Width bfb" u="in" v={sec.bfb} set={v=>S('sec.bfb',v)} step={0.5} gd={G('sec.bfb')}/>
+        <Num l="Thick tfb" u="in" v={sec.tfb} set={v=>S('sec.tfb',v)} step={0.0625} gd={G('sec.tfb')}/>
@@ -4276,0 +4363 @@ function InputsTab({inp,set,R}){
+        <GdBadge g={G('sec.segs')||G('sec.useSegs')}/>
@@ -4296,2 +4383,2 @@ function InputsTab({inp,set,R}){
-        <Num l="Long. deck rebar As (in beff)" u="in²" v={inp.negM.As} set={v=>S('negM.As',v)} step={0.5}/>
-        <Num l="Top of slab → bar CG" u="in" v={inp.negM.dTop} set={v=>S('negM.dTop',v)} step={0.25}/>
+        <Num l="Long. deck rebar As (in beff)" u="in²" v={inp.negM.As} set={v=>S('negM.As',v)} step={0.5} gd={G('negM.As')}/>
+        <Num l="Top of slab → bar CG" u="in" v={inp.negM.dTop} set={v=>S('negM.dTop',v)} step={0.25} gd={G('negM.dTop')}/>
@@ -4307,5 +4394,5 @@ function InputsTab({inp,set,R}){
-        <Sel l="Steel grade" v={mat.grade} set={applyGrade} opts={Object.keys(GRADES)}/>
-        <Num l="Es" u="ksi" v={mat.Es} set={v=>S('mat.Es',v)} step={500}/>
-        <Num l="Flange Fyf" u="ksi" v={mat.Fyf} set={v=>S('mat.Fyf',v)} step={1}/>
-        <Num l="Web Fyw" u="ksi" v={mat.Fyw} set={v=>S('mat.Fyw',v)} step={1}/>
-        <Num l="Fu" u="ksi" v={mat.Fu} set={v=>S('mat.Fu',v)} step={1}/>
+        <Sel l="Steel grade" v={mat.grade} set={applyGrade} opts={Object.keys(GRADES)} gd={G('mat.grade')}/>
+        <Num l="Es" u="ksi" v={mat.Es} set={v=>S('mat.Es',v)} step={500} gd={G('mat.Es')}/>
+        <Num l="Flange Fyf" u="ksi" v={mat.Fyf} set={v=>S('mat.Fyf',v)} step={1} gd={G('mat.Fyf')}/>
+        <Num l="Web Fyw" u="ksi" v={mat.Fyw} set={v=>S('mat.Fyw',v)} step={1} gd={G('mat.Fyw')}/>
+        <Num l="Fu" u="ksi" v={mat.Fu} set={v=>S('mat.Fu',v)} step={1} gd={G('mat.Fu')}/>
@@ -4316 +4403 @@ function InputsTab({inp,set,R}){
-          Hybrid girder (web Fyw ≠ flange Fyf) — applies Rh per 6.10.1.10.1</label>
+          Hybrid girder (web Fyw ≠ flange Fyf) — applies Rh per 6.10.1.10.1</label><GdBadge g={G('mat.hybrid')}/>
@@ -4326,2 +4413,2 @@ function InputsTab({inp,set,R}){
-          <input type="checkbox" checked={deck.deckOn} onChange={e=>S('deck.deckOn',e.target.checked)}/>
-          Composite with concrete deck</label></div>
+          <input type="checkbox" checked={G('deck.deckOn')&&G('deck.deckOn').lock?G('deck.deckOn').v:deck.deckOn} disabled={!!(G('deck.deckOn')&&G('deck.deckOn').lock)} onChange={e=>S('deck.deckOn',e.target.checked)}/>
+          Composite with concrete deck</label><GdBadge g={G('deck.deckOn')}/></div>
@@ -4329,4 +4416,4 @@ function InputsTab({inp,set,R}){
-        <Num l="Deck f′c" u="ksi" v={deck.fc} set={v=>S('deck.fc',v)} step={0.5}/>
-        <Num l="Deck wc" u="kcf" v={deck.wc} set={v=>S('deck.wc',v)} step={0.005}/>
-        <Num l={deck.tsSeparate?"Slab ts (capacity)":"Slab ts"} u="in" v={deck.ts} set={v=>S('deck.ts',v)} step={0.5}/>
-        <Num l="Haunch" u="in" v={deck.haunch} set={v=>S('deck.haunch',v)} step={0.5}/>
+        <Num l="Deck f′c" u="ksi" v={deck.fc} set={v=>S('deck.fc',v)} step={0.5} gd={G('deck.fc')}/>
+        <Num l="Deck wc" u="kcf" v={deck.wc} set={v=>S('deck.wc',v)} step={0.005} gd={G('deck.wc')}/>
+        <Num l={deck.tsSeparate?"Slab ts (capacity)":"Slab ts"} u="in" v={deck.ts} set={v=>S('deck.ts',v)} step={0.5} gd={G('deck.ts')}/>
+        <Num l="Haunch" u="in" v={deck.haunch} set={v=>S('deck.haunch',v)} step={0.5} gd={G('deck.haunch')}/>
@@ -4336 +4423 @@ function InputsTab({inp,set,R}){
-          <input type="checkbox" checked={!!deck.tsSeparate} onChange={e=>S('deck.tsSeparate',e.target.checked)}/>
+          <input type="checkbox" checked={G('deck.tsSeparate')&&G('deck.tsSeparate').lock?G('deck.tsSeparate').v:!!deck.tsSeparate} disabled={!!(G('deck.tsSeparate')&&G('deck.tsSeparate').lock)} onChange={e=>S('deck.tsSeparate',e.target.checked)}/>
@@ -4338,3 +4425,4 @@ function InputsTab({inp,set,R}){
-        {deck.tsSeparate && <div className="frow" style={{marginTop:6}}>
-          <Num l="Slab ts (dead load)" u="in" v={deck.tsDL} set={v=>S('deck.tsDL',v)} step={0.5}/>
-          <div className="hint" style={{alignSelf:'center',margin:0}}>Capacity/section uses <b>{fmt(deck.ts,2)}″</b>; DC1 deck weight uses <b>{fmt(+deck.tsDL||+deck.ts,2)}″</b>.</div>
+        <GdBadge g={G('deck.tsSeparate')}/>
+        {inpE.deck.tsSeparate && <div className="frow" style={{marginTop:6}}>
+          <Num l="Slab ts (dead load)" u="in" v={deck.tsDL} set={v=>S('deck.tsDL',v)} step={0.5} gd={G('deck.tsDL')}/>
+          <div className="hint" style={{alignSelf:'center',margin:0}}>Capacity/section uses <b>{fmt(deck.ts,2)}″</b>; DC1 deck weight uses <b>{fmt(+inpE.deck.tsDL||+deck.ts,2)}″</b>.</div>
@@ -4346,2 +4434,2 @@ function InputsTab({inp,set,R}){
-          Auto effective width = tributary width (interior S; exterior S/2 + overhang, 4.6.2.6.1)</label></div>
-      {!deck.beffAuto && <div className="frow"><Num l="b_eff" u="in" v={deck.beff} set={v=>S('deck.beff',v)} step={1}/></div>}
+          Auto effective width = tributary width (interior S; exterior S/2 + overhang, 4.6.2.6.1)</label><GdBadge g={G('deck.beffAuto')}/></div>
+      {!deck.beffAuto && <div className="frow"><Num l="b_eff" u="in" v={deck.beff} set={v=>S('deck.beff',v)} step={1} gd={G('deck.beff')}/></div>}
@@ -4352 +4440 @@ function InputsTab({inp,set,R}){
-        {!deck.designOn&&<div className="frow" style={{marginTop:6}}><Num l="Overhang (web→edge)" u="ft" v={deck.oh} set={v=>S('deck.oh',v)} step={0.25}/></div>}
+        {!deck.designOn&&<div className="frow" style={{marginTop:6}}><Num l="Overhang (web→edge)" u="ft" v={deck.oh} set={v=>S('deck.oh',v)} step={0.25} gd={G('deck.oh')}/></div>}
@@ -4364,11 +4452,11 @@ function InputsTab({inp,set,R}){
-          <Num l="Overhang (web→edge)" u="ft" v={deck.oh} set={v=>S('deck.oh',v)} step={0.25}/>
-          <Num l="Rebar fy" u="ksi" v={deck.fyd} set={v=>S('deck.fyd',v)} step={5}/>
-          <Num l="Top bar area" u="in²" v={deck.barTop} set={v=>S('deck.barTop',v)} step={0.01}/>
-          <Num l="Top bar spacing" u="in" v={deck.sTop} set={v=>S('deck.sTop',v)} step={0.5}/>
-          <Num l="Bottom bar area" u="in²" v={deck.barBot} set={v=>S('deck.barBot',v)} step={0.01}/>
-          <Num l="Bottom bar spacing" u="in" v={deck.sBot} set={v=>S('deck.sBot',v)} step={0.5}/>
-          <Num l="Top cover" u="in" v={deck.coverT} set={v=>S('deck.coverT',v)} step={0.25}/>
-          <Num l="Bottom cover" u="in" v={deck.coverB} set={v=>S('deck.coverB',v)} step={0.25}/>
-          <Num l="Future wearing surf." u="ksf" v={deck.wsFut} set={v=>S('deck.wsFut',v)} step={0.005}/>
-          <Num l="Barrier base width" u="in" v={deck.bBar} set={v=>S('deck.bBar',v)} step={1}/>
-          <Num l="Barrier weight" u="klf" v={deck.wBar} set={v=>S('deck.wBar',v)} step={0.05}/>
+          <Num l="Overhang (web→edge)" u="ft" v={deck.oh} set={v=>S('deck.oh',v)} step={0.25} gd={G('deck.oh')}/>
+          <Num l="Rebar fy" u="ksi" v={deck.fyd} set={v=>S('deck.fyd',v)} step={5} gd={G('deck.fyd')}/>
+          <Num l="Top bar area" u="in²" v={deck.barTop} set={v=>S('deck.barTop',v)} step={0.01} gd={G('deck.barTop')}/>
+          <Num l="Top bar spacing" u="in" v={deck.sTop} set={v=>S('deck.sTop',v)} step={0.5} gd={G('deck.sTop')}/>
+          <Num l="Bottom bar area" u="in²" v={deck.barBot} set={v=>S('deck.barBot',v)} step={0.01} gd={G('deck.barBot')}/>
+          <Num l="Bottom bar spacing" u="in" v={deck.sBot} set={v=>S('deck.sBot',v)} step={0.5} gd={G('deck.sBot')}/>
+          <Num l="Top cover" u="in" v={deck.coverT} set={v=>S('deck.coverT',v)} step={0.25} gd={G('deck.coverT')}/>
+          <Num l="Bottom cover" u="in" v={deck.coverB} set={v=>S('deck.coverB',v)} step={0.25} gd={G('deck.coverB')}/>
+          <Num l="Future wearing surf." u="ksf" v={deck.wsFut} set={v=>S('deck.wsFut',v)} step={0.005} gd={G('deck.wsFut')}/>
+          <Num l="Barrier base width" u="in" v={deck.bBar} set={v=>S('deck.bBar',v)} step={1} gd={G('deck.bBar')}/>
+          <Num l="Barrier weight" u="klf" v={deck.wBar} set={v=>S('deck.wBar',v)} step={0.05} gd={G('deck.wBar')}/>
@@ -4382 +4470 @@ function InputsTab({inp,set,R}){
-          <Num l="Design section x" u="in" v={deck.xneg} set={v=>S('deck.xneg',v)} step={1}/>
+          <Num l="Design section x" u="in" v={deck.xneg} set={v=>S('deck.xneg',v)} step={1} gd={G('deck.xneg')}/>
@@ -4397,4 +4485,4 @@ function InputsTab({inp,set,R}){
-        <Num l="Span L" u="ft" v={geom.L} set={v=>S('geom.L',v)} step={1}/>
-        <Num l="Girder spacing S" u="ft" v={geom.S} set={v=>S('geom.S',v)} step={0.25}/>
-        <Num l="# girders" u="" v={geom.nGirders} set={v=>S('geom.nGirders',v)} step={1}/>
-        <Num l="Brace spacing Lb" u="ft" v={geom.Lb} set={v=>S('geom.Lb',v)} step={1}/>
+        <Num l="Span L" u="ft" v={geom.L} set={v=>S('geom.L',v)} step={1} gd={G('geom.L')}/>
+        <Num l="Girder spacing S" u="ft" v={geom.S} set={v=>S('geom.S',v)} step={0.25} gd={G('geom.S')}/>
+        <Num l="# girders" u="" v={geom.nGirders} set={v=>S('geom.nGirders',v)} step={1} gd={G('geom.nGirders')}/>
+        <Num l="Brace spacing Lb" u="ft" v={geom.Lb} set={v=>S('geom.Lb',v)} step={1} gd={G('geom.Lb')}/>
@@ -4453 +4541 @@ function InputsTab({inp,set,R}){
-          <Num l="Add'l DC1 (forms, details)" u="klf" v={loads.wDCextra} set={v=>S('loads.wDCextra',v)} step={0.005}/>
+          <Num l="Add'l DC1 (forms, details)" u="klf" v={loads.wDCextra} set={v=>S('loads.wDCextra',v)} step={0.005} gd={G('loads.wDCextra')}/>
@@ -4455 +4543 @@ function InputsTab({inp,set,R}){
-          <Num l="Construction live load" u="klf" v={loads.wConstr} set={v=>S('loads.wConstr',v)} step={0.005}/>
+          <Num l="Construction live load" u="klf" v={loads.wConstr} set={v=>S('loads.wConstr',v)} step={0.005} gd={G('loads.wConstr')}/>
@@ -4463 +4551 @@ function InputsTab({inp,set,R}){
-          {gL? <div className="hint" style={{marginTop:0}}>{gG.xf?<span><b>{fmt(gG.xf.points,0)} point loads, {fmt(gG.xf.Ptotal,2)} kip in all</b> at this girder’s frames ({gG.xf.source||'GirderDetail'})</span>:<span>None in GirderDetail’s DC1 (the cross-frame weight is off or entered as a line load there)</span>}; <span className="bl-src" style={{display:'inline'}}>{gSrc}</span>. ST-Girder’s own list is kept and not used while these demands are in use (DC1 is imported).</div>
+          {gL? <div className="hint" style={{marginTop:0}}>{gG.xf?<span><b>{fmt(gG.xf.points,0)} point loads, {fmt(gG.xf.Ptotal,2)} kip in all</b> at this girder’s frames ({gG.xf.source||'GirderDetail'})</span>:<span>None in GirderDetail’s DC1 (the cross-frame weight is off or entered as a line load there)</span>}; <span className="gd-src" style={{display:'inline'}}>GD · {gSrc}</span>. ST-Girder’s own list is kept and not used while these demands are in use (DC1 is imported).</div>
@@ -4482 +4570 @@ function InputsTab({inp,set,R}){
-          : <Num l="Barrier / SIDL (per girder)" u="klf" v={loads.wBar} set={v=>S('loads.wBar',v)} step={0.01} driven={dlLocked&&dlHasBar} src={dlSrc}/>}</div>
+          : <Num l="Barrier / SIDL (per girder)" u="klf" v={loads.wBar} set={v=>S('loads.wBar',v)} step={0.01} driven={dlLocked&&dlHasBar} src={dlSrc} gd={G('loads.wBar')}/>}</div>
@@ -4490 +4578 @@ function InputsTab({inp,set,R}){
-          : <Num l="Wearing surface (per girder)" u="klf" v={loads.wDW} set={v=>S('loads.wDW',v)} step={0.01} driven={dlLocked&&dlHasDW} src={dlSrc}/>}</div>
+          : <Num l="Wearing surface (per girder)" u="klf" v={loads.wDW} set={v=>S('loads.wDW',v)} step={0.01} driven={dlLocked&&dlHasDW} src={dlSrc} gd={G('loads.wDW')}/>}</div>
@@ -4514 +4602,2 @@ function InputsTab({inp,set,R}){
-        {gL&&<div className="hint" style={{marginBottom:8}}><span className="bl-src" style={{display:'inline'}}>Live load {gSrc}</span>: {gdLLText(gL).join('; ')}.{gOwnOf('number of design lanes N_L')?<span style={{color:'#9a3412'}}> Live load deflection (optional check) still uses ST-Girder’s own number of design lanes N_L = <b>{gOwnOf('number of design lanes N_L').ownT}</b>; GirderDetail used {gOwnOf('number of design lanes N_L').gdT}{gOwnOf('number of design lanes N_L').same?' (same)':''}. Not switched (engineer to decide).</span>:null}</div>}
+        {G('loads.NL')&&<div className="frow" style={{marginBottom:6}}><Num l="Design lanes N_L (live load deflection)" v={loads.NL} set={v=>S('loads.NL',v)} step={1} min={1} gd={G('loads.NL')}/></div>}
+        {gL&&<div className="hint" style={{marginBottom:8}}><span className="gd-src" style={{display:'inline'}}>GD · Live load {gSrc}</span>: {gdLLText(gL).join('; ')}.{gOwnOf('number of design lanes N_L')?<span style={{color:'#9a3412'}}> Live load deflection (optional check) still uses ST-Girder’s own number of design lanes N_L = <b>{gOwnOf('number of design lanes N_L').ownT}</b>; GirderDetail used {gOwnOf('number of design lanes N_L').gdT}{gOwnOf('number of design lanes N_L').same?' (same)':''}. Not switched (engineer to decide).</span>:null}</div>}
@@ -4519,4 +4608,4 @@ function InputsTab({inp,set,R}){
-            <Num l="DF — positive moment" v={loads.extDFpos} set={v=>S('loads.extDFpos',v)} step={0.05} min={0} driven={lldfLocked} src={lldfSrc}/>
-            <Num l="DF — negative moment" v={loads.extDFneg} set={v=>S('loads.extDFneg',v)} step={0.05} min={0} driven={lldfLocked} src={lldfSrc}/>
-            <Num l="DF — shear" v={loads.extDFv} set={v=>S('loads.extDFv',v)} step={0.05} min={0} driven={lldfLocked} src={lldfSrc}/>
-            <Num l="Multiple presence m" v={loads.extLLmpf} set={v=>S('loads.extLLmpf',v)} step={0.05} min={0} driven={lldfLocked} src={lldfSrc}/>
+            <Num l="DF — positive moment" v={loads.extDFpos} set={v=>S('loads.extDFpos',v)} step={0.05} min={0} driven={lldfLocked} src={lldfSrc} gd={G('loads.extDFpos')}/>
+            <Num l="DF — negative moment" v={loads.extDFneg} set={v=>S('loads.extDFneg',v)} step={0.05} min={0} driven={lldfLocked} src={lldfSrc} gd={G('loads.extDFneg')}/>
+            <Num l="DF — shear" v={loads.extDFv} set={v=>S('loads.extDFv',v)} step={0.05} min={0} driven={lldfLocked} src={lldfSrc} gd={G('loads.extDFv')}/>
+            <Num l="Multiple presence m" v={loads.extLLmpf} set={v=>S('loads.extLLmpf',v)} step={0.05} min={0} driven={lldfLocked} src={lldfSrc} gd={G('loads.extLLmpf')}/>
@@ -4528,2 +4617,2 @@ function InputsTab({inp,set,R}){
-          <Num l="M (LL+IM) @ midspan" u="k-ft" v={loads.MLL} set={v=>S('loads.MLL',v)} step={50}/>
-          <Num l="V (LL+IM) @ support" u="kip" v={loads.VLL} set={v=>S('loads.VLL',v)} step={5}/>
+          <Num l="M (LL+IM) @ midspan" u="k-ft" v={loads.MLL} set={v=>S('loads.MLL',v)} step={50} gd={G('loads.MLL')}/>
+          <Num l="V (LL+IM) @ support" u="kip" v={loads.VLL} set={v=>S('loads.VLL',v)} step={5} gd={G('loads.VLL')}/>
@@ -4547,3 +4636,3 @@ function InputsTab({inp,set,R}){
-            {loads.pos==='exterior'&&<Num l="d_e — ext web to barrier face" u="ft" v={loads.de} set={v=>S('loads.de',v)} step={0.25}/>}
-            {loads.pos==='exterior'&&<Num l="Design lanes N_L" v={loads.NL} set={v=>S('loads.NL',v)} step={1} min={1}/>}
-            <Num l="Skew angle" u="deg" v={loads.skew} set={v=>S('loads.skew',v)} step={5} min={0}/>
+            {loads.pos==='exterior'&&<Num l="d_e — ext web to barrier face" u="ft" v={loads.de} set={v=>S('loads.de',v)} step={0.25} gd={G('loads.de')}/>}
+            {loads.pos==='exterior'&&<Num l="Design lanes N_L" v={loads.NL} set={v=>S('loads.NL',v)} step={1} min={1} gd={G('loads.NL')}/>}
+            <Num l="Skew angle" u="deg" v={loads.skew} set={v=>S('loads.skew',v)} step={5} min={0} gd={G('loads.skew')}/>
@@ -4564,0 +4654,2 @@ function InputsTab({inp,set,R}){
+      {gX&&gX.dec.filter(q=>q.pane==='details').length>0&&<div className="hint" style={{margin:'0 0 8px',color:'#9a3412'}}>GirderDetail values not transferred (a method or interpretation choice; ST-Girder’s own inputs below are used; engineer to decide):
+        <ul style={{margin:'2px 0 0 18px',padding:0}}>{gX.dec.filter(q=>q.pane==='details').map((q,i)=><li key={i}><b>{q.what}</b>: GirderDetail {q.gdT}. {q.why}.</li>)}</ul></div>}
@@ -4570,7 +4661,7 @@ function InputsTab({inp,set,R}){
-        {inp.stiff.transverse&&<Num l="Stiffener spacing do" u="in" v={inp.stiff.doSpc} set={v=>S('stiff.doSpc',v)} step={6}/>}
-        {inp.stiff.transverse&&<Num l="Stiff. width bt" u="in" v={inp.stiff.bt} set={v=>S('stiff.bt',v)} step={0.5}/>}
-        {inp.stiff.transverse&&<Num l="Stiff. thick tp" u="in" v={inp.stiff.tp} set={v=>S('stiff.tp',v)} step={0.0625}/>}
-        <Num l="Bearing stiff. width" u="in" v={inp.stiff.bearB} set={v=>S('stiff.bearB',v)} step={0.5}/>
-        <Num l="Bearing stiff. thick" u="in" v={inp.stiff.bearT} set={v=>S('stiff.bearT',v)} step={0.0625}/>
-        <Num l="Bearing plates (ea. side)" v={inp.stiff.bearN} set={v=>S('stiff.bearN',v)} step={1}/>
-        <Num l="Stiffener Fys" u="ksi" v={inp.stiff.Fys} set={v=>S('stiff.Fys',v)} step={1}/>
+        {inp.stiff.transverse&&<Num l="Stiffener spacing do" u="in" v={inp.stiff.doSpc} set={v=>S('stiff.doSpc',v)} step={6} gd={G('stiff.doSpc')}/>}
+        {inp.stiff.transverse&&<Num l="Stiff. width bt" u="in" v={inp.stiff.bt} set={v=>S('stiff.bt',v)} step={0.5} gd={G('stiff.bt')}/>}
+        {inp.stiff.transverse&&<Num l="Stiff. thick tp" u="in" v={inp.stiff.tp} set={v=>S('stiff.tp',v)} step={0.0625} gd={G('stiff.tp')}/>}
+        <Num l="Bearing stiff. width" u="in" v={inp.stiff.bearB} set={v=>S('stiff.bearB',v)} step={0.5} gd={G('stiff.bearB')}/>
+        <Num l="Bearing stiff. thick" u="in" v={inp.stiff.bearT} set={v=>S('stiff.bearT',v)} step={0.0625} gd={G('stiff.bearT')}/>
+        <Num l="Bearing plates (ea. side)" v={inp.stiff.bearN} set={v=>S('stiff.bearN',v)} step={1} gd={G('stiff.bearN')}/>
+        <Num l="Stiffener Fys" u="ksi" v={inp.stiff.Fys} set={v=>S('stiff.Fys',v)} step={1} gd={G('stiff.Fys')}/>
@@ -4580,4 +4671,4 @@ function InputsTab({inp,set,R}){
-        <Num l="Stud diameter" u="in" v={inp.conn.studD} set={v=>S('conn.studD',v)} step={0.125}/>
-        <Num l="Stud height" u="in" v={inp.conn.studH} set={v=>S('conn.studH',v)} step={0.5}/>
-        <Num l="Studs per row" v={inp.conn.nRow} set={v=>S('conn.nRow',v)} step={1}/>
-        <Num l="Stud pitch" u="in" v={inp.conn.pitch} set={v=>S('conn.pitch',v)} step={1}/>
+        <Num l="Stud diameter" u="in" v={inp.conn.studD} set={v=>S('conn.studD',v)} step={0.125} gd={G('conn.studD')}/>
+        <Num l="Stud height" u="in" v={inp.conn.studH} set={v=>S('conn.studH',v)} step={0.5} gd={G('conn.studH')}/>
+        <Num l="Studs per row" v={inp.conn.nRow} set={v=>S('conn.nRow',v)} step={1} gd={G('conn.nRow')}/>
+        <Num l="Stud pitch" u="in" v={inp.conn.pitch} set={v=>S('conn.pitch',v)} step={1} gd={G('conn.pitch')}/>
@@ -4587,2 +4678,3 @@ function InputsTab({inp,set,R}){
-        <Sel l="Detail category (6.6.1.2.3)" v={inp.fatigue.category} set={v=>S('fatigue.category',v)} opts={['A','B',"B'",'C',"C'",'D','E',"E'"]}/>
-        <div className="fld"><label>Limit state</label>
+        <Sel l="Detail category (6.6.1.2.3)" v={inp.fatigue.category} set={v=>S('fatigue.category',v)} opts={['A','B',"B'",'C',"C'",'D','E',"E'"]} gd={G('fatigue.category')}/>
+        {G('fatigue.lsMode')? <GdFld l="Limit state" v={({auto:'AUTO',I:'FATIGUE I',II:'FATIGUE II'})[G('fatigue.lsMode').v]||G('fatigue.lsMode').v} src={G('fatigue.lsMode').src}/>
+        : <div className="fld"><label>Limit state</label>
@@ -4590 +4682 @@ function InputsTab({inp,set,R}){
-            v={inp.fatigue.lsMode||'auto'} set={v=>S('fatigue.lsMode',v)}/></div>
+            v={inp.fatigue.lsMode||'auto'} set={v=>S('fatigue.lsMode',v)}/></div>}
@@ -4595,2 +4687,3 @@ function InputsTab({inp,set,R}){
-        <Num l="ADTT (trucks/day)" v={inp.fatigue.ADTT} set={v=>S('fatigue.ADTT',v)} step={100}/>
-        <div className="fld"><label>ADTT entered as</label>
+        <Num l="ADTT (trucks/day)" v={inp.fatigue.ADTT} set={v=>S('fatigue.ADTT',v)} step={100} gd={G('fatigue.ADTT')}/>
+        {G('fatigue.adttIsSingleLane')? <GdFld l="ADTT entered as" v="SINGLE-LANE (ADTT)SL" src={G('fatigue.adttIsSingleLane').src}/>
+        : <div className="fld"><label>ADTT entered as</label>
@@ -4598,2 +4691,2 @@ function InputsTab({inp,set,R}){
-            v={inp.fatigue.adttIsSingleLane!==false} set={v=>S('fatigue.adttIsSingleLane',v)}/></div>
-        {inp.fatigue.adttIsSingleLane===false && <div className="fld"><label>Lanes available to trucks → p</label>
+            v={inp.fatigue.adttIsSingleLane!==false} set={v=>S('fatigue.adttIsSingleLane',v)}/></div>}
+        {inpE.fatigue.adttIsSingleLane===false && <div className="fld"><label>Lanes available to trucks → p</label>
@@ -4611 +4704 @@ function InputsTab({inp,set,R}){
-        <Num l="Fatigue design life (yr)" v={inp.fatigue.designLife||75} set={v=>S('fatigue.designLife',v)} step={5}/>
+        <Num l="Fatigue design life (yr)" v={inp.fatigue.designLife||75} set={v=>S('fatigue.designLife',v)} step={5} gd={G('fatigue.designLife')}/>
@@ -6137,0 +6231,2 @@ function crModel(R,inp,o){
+  // GDX (2026-10-19): the inputs the checks used (GirderDetail's transferred values applied), each marked "(from GirderDetail)" where it came from there
+  const gXr=gdXfer(inp.external), gPr=gXr?gdPulled(inp.external,inp):{}, gm=(...ps)=>ps.some(k=>gdFieldOf(inp,gXr,gPr,k))?' (from GirderDetail)':''; inp=gdOverlay(inp);
@@ -6163,3 +6258,3 @@ function crModel(R,inp,o){
-    sub(s,'Geometry and framing','',<CrKV rows={[['Span L',fmt(R.geom.L,2),'ft'],['Girder spacing S',fmt(+inp.geom.S,2),'ft'],['Number of girders',fmt(+inp.geom.nGirders,0)],
-      ['Cross-frame spacing (unbraced length) L_b',fmt(+inp.geom.Lb,2),'ft'],['Girder position',gt.pos+(lq.posAuto!==false?' (follows the shared design beam)':' (set here)')],
-      ['Skew angle',fmt(+lq.skew||0,1),'deg'],['Construction','unshored (DC1 on the bare steel)'],['Analysis',R.useExt?'imported continuous-member envelopes':'built-in simple span']]}/>);
+    sub(s,'Geometry and framing','',<CrKV rows={[['Span L',fmt(R.geom.L,2),'ft'+gm('geom.L')],['Girder spacing S',fmt(+inp.geom.S,2),'ft'+gm('geom.S')],['Number of girders',fmt(+inp.geom.nGirders,0),gm('geom.nGirders')],
+      ['Cross-frame spacing (unbraced length) L_b',fmt(+inp.geom.Lb,2),'ft'+gm('geom.Lb')],['Girder position',gt.pos+(lq.posAuto!==false?' (follows the shared design beam)':' (set here)'),gm('loads.pos')],
+      ['Skew angle',fmt(+lq.skew||0,1),'deg'+gm('loads.skew')],['Construction','unshored (DC1 on the bare steel)'],['Analysis',R.useExt?'imported continuous-member envelopes':'built-in simple span']]}/>);
@@ -6167,3 +6262,3 @@ function crModel(R,inp,o){
-      <CrKV rows={[['Starting section',inp.preset||'—'],['Web D × t_w',fmt(R.sec.D,3)+' × '+fmt(R.sec.tw,4),'in'],
-        ...(R.segP.length>1?[]:[['Top flange b_ft × t_ft',fmt(R.segP[0].dims.bft,3)+' × '+fmt(R.segP[0].dims.tft,4),'in'],['Bottom flange b_fb × t_fb',fmt(R.segP[0].dims.bfb,3)+' × '+fmt(R.segP[0].dims.tfb,4),'in']]),
-        ['Flange transitions',R.segP.length>1?R.segP.length+' segments (table below)':'none (prismatic)']]}/>
+      <CrKV rows={[['Starting section',inp.preset||'—'],['Web D × t_w',fmt(R.sec.D,3)+' × '+fmt(R.sec.tw,4),'in'+gm('sec.D','sec.tw')],
+        ...(R.segP.length>1?[]:[['Top flange b_ft × t_ft',fmt(R.segP[0].dims.bft,3)+' × '+fmt(R.segP[0].dims.tft,4),'in'+gm('sec.bft','sec.tft')],['Bottom flange b_fb × t_fb',fmt(R.segP[0].dims.bfb,3)+' × '+fmt(R.segP[0].dims.tfb,4),'in'+gm('sec.bfb','sec.tfb')]]),
+        ['Flange transitions',R.segP.length>1?R.segP.length+' segments (table below)':'none (prismatic)',gm('sec.useSegs')]]}/>
@@ -6173,6 +6268,6 @@ function crModel(R,inp,o){
-    sub(s,'Materials','AASHTO 6.4.1',<CrKV rows={[['Steel grade',mat.grade],['Flange yield F_yf',fmt(R.matR.Fyf,1),'ksi'],['Web yield F_yw',fmt(R.matR.Fyw,1),'ksi'],
-      ['Tensile strength F_u',fmt(+mat.Fu,1),'ksi'],['Steel modulus E_s',fmt(R.matR.Es,0),'ksi'],['Hybrid girder input',crYes(mat.hybrid)],['Stiffener yield F_ys',fmt(R.bearing.Fys,1),'ksi']]}/>);
-    sub(s,'Deck and composite action','6.10.1.1 · 4.6.2.6',<CrKV rows={[['Composite deck',crYes(R.deck.deckOn)],["Concrete f'_c",fmt(R.deck.fc,2),'ksi'],['Unit weight w_c',fmt(+dk.wc,3),'kcf'],
-      ['Structural slab t_s',fmt(+dk.ts,2),'in'],...(dk.tsSeparate?[['Slab thickness for dead load',fmt(+dk.tsDL,2),'in']]:[]),['Haunch',fmt(+dk.haunch,2),'in'],
-      ['Effective width b_eff',fmt(R.beff,2),'in '+(dk.beffAuto?'(tributary width)':'(entered)')],['E_c (5.4.2.4)',fmt(R.EcDeck,0),'ksi'],['Modular ratio n (rounded, ≥ 6)',fmt(R.n,0)],
-      ['Overhang (girder CL to deck edge)',fmt(+dk.oh,2),'ft'],['Longitudinal deck rebar A_s (−M section)',fmt(+inp.negM.As,2),'in²'],['Rebar depth from top of slab',fmt(+inp.negM.dTop,2),'in'],
+    sub(s,'Materials','AASHTO 6.4.1',<CrKV rows={[['Steel grade',mat.grade,gm('mat.grade')],['Flange yield F_yf',fmt(R.matR.Fyf,1),'ksi'+gm('mat.Fyf')],['Web yield F_yw',fmt(R.matR.Fyw,1),'ksi'+gm('mat.Fyw')],
+      ['Tensile strength F_u',fmt(+mat.Fu,1),'ksi'+gm('mat.Fu')],['Steel modulus E_s',fmt(R.matR.Es,0),'ksi'+gm('mat.Es')],['Hybrid girder input',crYes(mat.hybrid),gm('mat.hybrid')],['Stiffener yield F_ys',fmt(R.bearing.Fys,1),'ksi'+gm('stiff.Fys')]]}/>);
+    sub(s,'Deck and composite action','6.10.1.1 · 4.6.2.6',<CrKV rows={[['Composite deck',crYes(R.deck.deckOn),gm('deck.deckOn')],["Concrete f'_c",fmt(R.deck.fc,2),'ksi'+gm('deck.fc')],['Unit weight w_c',fmt(+dk.wc,3),'kcf'+gm('deck.wc')],
+      ['Structural slab t_s',fmt(+dk.ts,2),'in'+gm('deck.ts')],...(dk.tsSeparate?[['Slab thickness for dead load',fmt(+dk.tsDL,2),'in'+gm('deck.tsDL')]]:[]),['Haunch',fmt(+dk.haunch,2),'in'+gm('deck.haunch')],
+      ['Effective width b_eff',fmt(R.beff,2),'in '+(dk.beffAuto?'(tributary width)':'(entered)')+gm('deck.beff')],['E_c (5.4.2.4)',fmt(R.EcDeck,0),'ksi'],['Modular ratio n (rounded, ≥ 6)',fmt(R.n,0)],
+      ['Overhang (girder CL to deck edge)',fmt(+dk.oh,2),'ft'+gm('deck.oh')],['Longitudinal deck rebar A_s (−M section)',fmt(+inp.negM.As,2),'in²'+gm('negM.As')],['Rebar depth from top of slab',fmt(+inp.negM.dTop,2),'in'+gm('negM.dTop')],
@@ -6180 +6275 @@ function crModel(R,inp,o){
-        ['Cover top / bottom',fmt(+dk.coverT,2)+' / '+fmt(+dk.coverB,2),'in'],['Future wearing surface',fmt(+dk.wsFut,3),'ksf'],['Barrier base width / weight',fmt(+dk.bBar,1)+' in / '+fmt(+dk.wBar,3)+' klf']]:[])]}/>);
+        ['Cover top / bottom',fmt(+dk.coverT,2)+' / '+fmt(+dk.coverB,2),'in'],['Future wearing surface',fmt(+dk.wsFut,3),'ksf'+gm('deck.wsFut')],['Barrier base width / weight',fmt(+dk.bBar,1)+' in / '+fmt(+dk.wBar,3)+' klf',gm('deck.bBar','deck.wBar')]]:[])]}/>);
@@ -6186 +6281 @@ function crModel(R,inp,o){
-          ...G.utrows.map(q=>[q.name+' ('+q.category+')',fmt(q.w,3),'klf']),['Live load',gdLLText(L).join('; ')]]}/>
+          ...G.utrows.map(q=>[q.name+' ('+q.category+')',fmt(q.w,3),'klf']),['Construction live load (constructibility)',fmt(+lq.wConstr||0,3),'klf'+gm('loads.wConstr')],['Design lanes N_L (live load deflection)',fmt(+lq.NL||0,0),gm('loads.NL')],['Live load',gdLLText(L).join('; ')]]}/>
@@ -6197 +6292 @@ function crModel(R,inp,o){
-    sub(s,'Stiffeners, connectors and fatigue','6.10.11 · 6.10.10 · 6.6.1',<CrKV rows={[['Transverse stiffeners',st.transverse?'yes, d_o = '+fmt(+st.doSpc,1)+' in, b_t × t_p = '+fmt(+st.bt,2)+' × '+fmt(+st.tp,3)+' in':'none'],
+    sub(s,'Stiffeners, connectors and fatigue','6.10.11 · 6.10.10 · 6.6.1',<CrKV rows={[['Transverse stiffeners',st.transverse?'yes, d_o = '+fmt(+st.doSpc,1)+' in, b_t × t_p = '+fmt(+st.bt,2)+' × '+fmt(+st.tp,3)+' in':'none',gm('stiff.bt','stiff.tp')?'(b_t, t_p from GirderDetail)':''],
@@ -6199,3 +6294,3 @@ function crModel(R,inp,o){
-      ['Shear studs','d = '+fmt(+cn.studD,3)+' in, h = '+fmt(+cn.studH,2)+' in, '+fmt(+cn.nRow,0)+' per row, pitch '+fmt(+cn.pitch,2)+' in'],
-      ['Fatigue detail category',R.fatigue.cat],['ADTT entered',fmt(R.fatigue.adttRaw,0)+' trucks/day ('+(R.fatigue.adttIsSingleLane?'single-lane (ADTT)SL':'gross, '+R.fatigue.lanes+' lanes')+')'],
-      ['Cycles per truck n / design life',fmt(R.fatigue.nCyc,2)+' / '+fmt(R.fatigue.lifeYr,0)+' yr'],['Fatigue limit state',fq.lsMode==='auto'?'auto (from the (ADTT)SL crossover)':'manual: Fatigue '+fq.lsMode]]}/>);
+      ['Shear studs','d = '+fmt(+cn.studD,3)+' in, h = '+fmt(+cn.studH,2)+' in, '+fmt(+cn.nRow,0)+' per row, pitch '+fmt(+cn.pitch,2)+' in',gm('conn.studD','conn.studH')?'(d, h from GirderDetail)':''],
+      ['Fatigue detail category',R.fatigue.cat,gm('fatigue.category')],['ADTT entered',fmt(R.fatigue.adttRaw,0)+' trucks/day ('+(R.fatigue.adttIsSingleLane?'single-lane (ADTT)SL':'gross, '+R.fatigue.lanes+' lanes')+')',gm('fatigue.ADTT')],
+      ['Cycles per truck n / design life',fmt(R.fatigue.nCyc,2)+' / '+fmt(R.fatigue.lifeYr,0)+' yr',gm('fatigue.designLife')?'(design life from GirderDetail)':''],['Fatigue limit state',fq.lsMode==='auto'?'auto (from the (ADTT)SL crossover)':'manual: Fatigue '+fq.lsMode,gm('fatigue.lsMode')]]}/>);
@@ -6799 +6894 @@ function App(){
-        fatigue:{category:inp.fatigue.category, FnFat:+R.fatigue.FnFat.toFixed(2), life:inp.fatigue.life},
+        fatigue:{category:gdOverlay(inp).fatigue.category, FnFat:+R.fatigue.FnFat.toFixed(2), life:inp.fatigue.life},
@@ -6928,0 +7024,4 @@ function App(){
+    { const D=p.girderDetail&&p.girderDetail.details; if(D!==undefined){ if(!D||typeof D!=='object') return 'girderDetail.details is not an object';   // GDX (2026-10-19, optional)
+      const fin=v=>v===undefined||v===null||(typeof v==='number'&&isFinite(v)&&v>=0);
+      for(const [k,o] of Object.entries(D)){ if(!o||typeof o!=='object') continue;
+        for(const [f,v] of Object.entries(o)) if(typeof v==='number'&&!fin(v)) return 'girderDetail.details.'+k+'.'+f+' is not a non-negative number'; } } }
@@ -6975,0 +7075,4 @@ function App(){
+      +(gdXfer(p)?(()=>{ const X=gdXfer(p), ks=Object.keys(X.set), fv=v=>typeof v==='number'?String(+v.toFixed(4)):typeof v==='boolean'?(v?'yes':'no'):String(v);   // GDX (2026-10-19)
+        return 'Inputs transferred from GirderDetail (locked and used while these demands are in use; your own values are kept and return when the demands are cleared):\n'
+          +ks.map(k=>'  '+(GD_LBL[k]||k)+': '+fv(X.set[k].v)+' ('+X.set[k].src.replace(/^from /,'')+')').join('\n')+'\n'
+          +(X.dec.length?'GirderDetail values not transferred (method or interpretation; engineer to decide):\n'+X.dec.map(q=>'  '+q.what+': GirderDetail '+q.gdT).join('\n')+'\n':''); })():'')
```


## 2026-10-19 — PR: claude/gd-stgirder-gd70 (GD70: d_o, bearing stiffeners, studs and cycles n taken from GirderDetail as the governing value; engineer decision 2026-10-19; cross-tool PR with Steel Bridge Beam Modules.html, HANDOFF.md §4.9, ENGINEER_CHECKS GD70/GD71; PR link added after merge)

Engineer (2026-10-19, on GD70): "I don't see why it shouldn't all come from the girderdetail app. If they are all preliminary sized in that app then it should be transferred over or at least maybe note in the stgirder app why it's not transferred over." Decision: transfer all four; where GirderDetail has several values and ST-Girder checks one, take the governing (least favourable) one, lock it and say so next to the field.

### GD70. Governing GirderDetail values for ST-Girder's single checks   [RESULT CHANGE for GirderDetail payloads with `details` — §4 callout] [Tier 2]
- **Where:** `gdXfer` (anchor `// GD70`): `note`, `spans`, `sel`, `si`, `nSp`, `gpos`; the four former `no(...)` entries for `stiff.doSpc`, `stiff.bearB`, `conn.pitch`, `fatigue.ncyc` replaced; `GD_LBL` new labels; `gdFieldOf` passes `note`. Inputs tab: `GdFieldNote`; transverse stiffener checkbox locked (`inpE.stiff.transverse`); n select as `GdFld` when transferred; notes after the stiffener, stud and cycles rows. Report: marks of the stiffener, bearing, stud and cycles rows; `gdNotesR` under "Stiffeners, connectors and fatigue".
- **Before (GDX):** not transferred; ST-Girder's own d_o, bearing stiffener, studs per row and pitch, and n (listed as GD70).
- **After:**
  - **d_o** = the largest d_o of GirderDetail's type A stiffener rows in the selected span for this girder position (else the span, else all rows); transverse stiffeners on. ST-Girder applies one d_o to every panel and the end panel (no separate end-panel input), so the largest (least V_n) is used.
  - **Bearing stiffener** = the GirderDetail type at the support where the span's end shear 1.25(V_DC1 + V_DC2) + 1.50V_DW + 1.75 max|V_LL| from the imported stations is larger (where ST-Girder's peak V_u is: verified x = 110 ft = Pier 1 in all three cases below); b_b, t_b of that type; 1 pair → 2 plates (ST-Girder's count is the total: A_pn = n(b_b − 1.5)t_b, I = t_b(n b_b + t_w)³/12; see GD71 for its label). Several pairs, or no row for the support → not transferred, with a note. ST-Girder's 1.5 in clip is kept (GirderDetail 1.0 in: ST-Girder is conservative).
  - **Studs per row and pitch** = the zone of the span with the largest pitch per stud p/n (tie: larger p). ST-Girder's fatigue check compares p/n with Z_r/V_sr at the worst station and its strength count is n × ⌊length/p⌋, so this zone is the least favourable for both; conservative where GirderDetail places closer studs.
  - **Cycles n** = the largest n of GirderDetail's fatigue details of this girder position (payloads without `cyclesBy`: of all details).
- **Governing provisions (AASHTO LRFD 10th Ed. (2024)):** 6.10.9.3.2 (k = 5 + 5/(d_o/D)², V_n) and 6.10.11.1.3; 6.10.11.2.3 (R_sb,n = 1.4A_pn F_ys), 6.10.11.2.4 (column, K = 0.75), 6.10.11.2.2 (b_t ≤ 0.48t_p√(E/F_ys)); 6.10.10.1.2 (fatigue pitch p ≤ nZ_r I/(V_sr Q)), 6.10.10.4 (strength count); 6.6.1.2.5 and Table 6.6.1.2.5-2 (N = 365·75·n·(ADTT)SL).
- **Before → after (ST-Girder span 1; main be08084 vs branch; payloads made by the branch):**

| Check | Built-in 15°, AASHTO, G2 | `util.json`, MassDOT, G2 | Built-in + sidewalk, RIDOT, G1 |
|---|---|---|---|
| Bearing stiffener (pier type) b × t (in) | 7 × 0.75 → 8.00 × 0.75 | 7 × 0.75 → 8.50 × 0.75 | 7 × 0.75 → 8.50 × 0.75 |
| Bearing resistance φR_sb,n (kip) vs R_u, ratio | 577.5 → 682.5 vs 396.4; 0.686 → 0.581 | 577.5 → 735.0 vs 423.5; 0.733 → 0.576 | 577.5 → 735.0 vs 460.2; 0.797 → 0.626 |
| Projecting width b_b / 0.48t_b√(E/F_ys) = 8.67 in | 0.807 → 0.923 | 0.807 → 0.980 | 0.807 → 0.980 |
| Axial φP_n (kip) (pass both) | 759.8 → 832.8 | 759.8 → 869.1 | 759.8 → 869.1 |
| Studs: n per row @ pitch | 3 @ 12 → 2 @ 8 in (zone 33–44 ft) | same | same |
| Stud fatigue pitch: provided / required (in), ratio | 12 / 9.123 → 8 / 6.082; 1.315 → 1.315 (FAIL before and after) | 12 / 8.985 → 8 / 5.990; 1.336 → 1.336 | 12 / 8.586 → 8 / 5.724; 1.398 → 1.398 |
| Stud strength count (continuous, right side) | 198 → 198 (ratio 0.863) | 198 → 198 (0.863) | 198 → 198 (0.810) |
| d_o | 60 → 60 in (GirderDetail = ST-Girder default: no change) | same | same |
| Cycles n; N | 1.0 → 1.5; 46.5 × 10⁶ → 69.8 × 10⁶ | same | same |

  No other result changes. The fatigue checks are Fatigue I (infinite life, ΔF_TH) in all three, so n does not change them here; with Fatigue II it lowers (ΔF)_n by (1/1.5)^(1/3) = 0.874. The stud fatigue ratio is unchanged because p/n is 4.0 in per stud in both (12/3 = 8/2): the stud fatigue check fails before and after (ST-Girder checks one pitch at the worst station; GirderDetail's per-zone design passes; open as before).
- **Hand checks (built-in AASHTO G2):** A_pn = 2 × (8.00 − 1.5) × 0.75 = 9.75 in²; φR_sb,n = 1.0 × 1.4 × 9.75 × 50 = 682.5 kip ✓ (before 2 × 5.5 × 0.75 = 8.25 → 577.5); 396.35 / 682.5 = 0.581 ✓. 0.48 × 0.75 × √(29000/50) = 8.670 in; 8.00 / 8.670 = 0.923 ✓. Studs: required p = n Z_r I/(V_sr Q) with n = 2 instead of 3 → 9.123 × 2/3 = 6.082 in ✓; 8 / 6.082 = 1.315 ✓. Strength count over 66 ft: 2 × ⌊792/8⌋ = 198 = 3 × ⌊792/12⌋ ✓. Cycles: N = 365 × 75 × 1.5 × 1700 = 69.8 × 10⁶ ✓. End shear for the bearing choice: 396.4 kip at Pier 1 vs 286.7 kip at Abut. 1.
- **How verified (Tier 2):** check-syntax both files; `node tests/compare.mjs --tool st --payload def15_AASHTO_G2,def15_RIDOT_Iyes_G2,xsA_RIDOT_Iyes_G1,util_MassDOT_G2`: all sections identical to main; branch payloads (AASHTO G2, MassDOT util G2, RIDOT sidewalk G1): only the values above differ, no console errors; page text of every tab and Inputs sub-pane for def15_AASHTO_G2 and util_MassDOT_G2: identical to main; peak V_u location x = 110 ft (Pier 1) confirmed headless for all three; screenshots of the Stiffeners / Studs / Fatigue sub-tab checked. `tests/projects/st/*_gdx.json` regenerated with the new fields.
- **Saved data:** none changed.
- **Other copies:** sender `Steel Bridge Beam Modules.html` (fixlog GD70 there).
- **Open items:** GD71 (wording of ST-Girder's bearing plate count; no result change). Payloads made between #304 and this PR (details without `supports`): the bearing stiffener is not transferred (note shown); d_o from the bridge-wide list; n from all details.
- **Diff (main → branch; no context lines):**
```diff
diff --git a/stgirder.html b/stgirder.html
index f81c5e3..95a8076 100644
--- a/stgirder.html
+++ b/stgirder.html
@@ -2547,0 +2548,2 @@ function gdXfer(ext){
+  const note=(path,t)=>{ if(set[path]) set[path].note=t; };   // GD70: what GirderDetail has and which value was taken (shown next to the field)
+  const spans=externalSpans(ext), sel=ext._selSpan||spans[0]||{idx:1,x0:0,x1:Infinity}, si=+sel.idx||1, nSp=spans.length||1, gpos=g.position;
@@ -2565,2 +2567,7 @@ function gdXfer(ext){
-    no('details','stiff.doSpc','transverse stiffener spacing d_o',(T.spacings||[]).length?(T.spacings.map(v=>f(v,1)).join(', ')+' in at the stiffener rows (supports and cross-frames)'):'none listed',
-      'GirderDetail designs stiffeners at its listed rows; ST-Girder applies one d_o to every panel of the span (and to the end panel)'); }
+    /* GD70 (engineer decision 2026-10-19): d_o = the LARGEST spacing GirderDetail designs in this span for this girder position (fewer stiffeners
+       = smaller k and V_n; ST-Girder applies one d_o to every panel and to the end panel, which has no input of its own) */
+    const rB=T.rowsBy||[], pick=[rB.filter(r=>r.span===si&&(!r.pos||r.pos===gpos)), rB.filter(r=>r.span===si), rB].find(a=>a.length)||[];
+    const dos=pick.flatMap(r=>[r.do1,r.do2]).filter(v=>num(v)&&v>0), dMax=dos.length?Math.max(...dos):(T.spacings||[]).length?Math.max(...T.spacings):null;
+    if(num(dMax)){ put('stiff.transverse',true,'Transverse stiffeners','details'); put('stiff.doSpc',dMax,'Transverse stiffeners, largest d_o in span '+si,'details');
+      note('stiff.doSpc','GirderDetail: '+(pick.length?pick.length+' stiffener rows in span '+si+(pick[0]&&pick[0].pos?' ('+gpos+')':'')+', d_o '+[...new Set(dos)].sort((a,b)=>a-b).map(v=>f(v,1)).join(', ')+' in':'d_o '+T.spacings.map(v=>f(v,1)).join(', ')+' in')+'. ST-Girder checks one d_o for every panel and the end panel, so the largest is used: d_o = '+f(dMax,1)+' in. Panel-by-panel design: GirderDetail Transverse stiffeners.'); }
+    else no('details','stiff.doSpc','transverse stiffener spacing d_o','none listed','GirderDetail lists no intermediate stiffener rows'); }
@@ -2569,2 +2576,11 @@ function gdXfer(ext){
-  if(B) no('details','stiff.bearB','bearing stiffeners',(B.types||[]).map(t=>t.name+' '+f(t.pairs,0)+' pair(s) '+f(t.bt,2)+' × '+f(t.tp,3)+' in').join('; '),
-    'ST-Girder checks one bearing stiffener for the peak V_u of the span (abutment or pier); which GirderDetail type applies, and pairs vs. its plate count, is a choice');
+  /* GD70: bearing stiffener = the GirderDetail type at the support where this span's factored end shear (and so ST-Girder's peak V_u) is larger,
+     from the imported stations: |1.25(V_DC1 + V_DC2) + 1.50 V_DW| + 1.75 max|V_LL|. One pair = ST-Girder's 2 plates (one each side of the web). */
+  if(B){ const sts=(ext.stations||[]).filter(q=>num(q.x)&&q.x>=(+sel.x0||0)-1e-9&&q.x<=(num(+sel.x1)?+sel.x1:Infinity)+1e-9);
+    const vu=q=>q?Math.abs(1.25*((+q.V_DC1||0)+(+q.V_DC2||0))+1.5*(+q.V_DW||0))+1.75*Math.max(Math.abs(+q.V_LLpos||0),Math.abs(+q.V_LLneg||0)):-1;
+    const qL=sts[0], qR=sts[sts.length-1], left=vu(qL)>=vu(qR), sup=left?(si===1?'Abut. 1':'Pier '+(si-1)):(si===nSp?'Abut. 2':'Pier '+si);
+    const row=(B.supports||[]).find(r=>String(r.name).indexOf(sup+',')===0&&(!r.pos||r.pos===gpos))||(B.supports||[]).find(r=>String(r.name).indexOf(sup)===0);
+    const ty=row&&(B.types||[]).find(t=>t.type===row.type), all=(B.types||[]).map(t=>t.name+' '+f(t.pairs,0)+' pair(s) '+f(t.bt,2)+' × '+f(t.tp,3)+' in').join('; ');
+    if(ty&&ty.pairs===1&&num(ty.bt)&&num(ty.tp)){ const m='Bearing stiffeners, '+ty.name+' at '+sup;
+      put('stiff.bearB',ty.bt,m,'details'); put('stiff.bearT',ty.tp,m,'details'); put('stiff.bearN',2,m+', 1 pair','details');
+      note('stiff.bearB','GirderDetail: '+all+'. ST-Girder checks one bearing stiffener for the peak V_u of span '+si+', which is at '+sup+' (1.25(DC1 + DC2) + 1.50DW + 1.75(LL+IM) of the imported end shears: '+f(vu(left?qL:qR),1)+' kip there vs '+f(vu(left?qR:qL),1)+' kip at the other end), so the '+ty.name+' type is used: '+f(ty.bt,2)+' × '+f(ty.tp,3)+' in, 1 pair = 2 plates (one each side of the web). ST-Girder deducts a 1.5 in clip; GirderDetail '+f(ty.clip,2)+' in. Every bearing: GirderDetail Bearing stiffeners.'); }
+    else no('details','stiff.bearB','bearing stiffeners',all,!row?'no GirderDetail bearing row for '+sup:!ty?'the type of '+sup+' is not listed':'more than one pair per bearing: ST-Girder’s column model (one plate each side of the web) does not represent several pairs'); }
@@ -2572,2 +2588,7 @@ function gdXfer(ext){
-    no('details','conn.pitch','studs per row and pitch',(St.zones||[]).length+' zones: '+[...new Set((St.zones||[]).map(z=>z.nr+' @ '+f(z.p,1)+' in'))].slice(0,6).join(', ')+((St.zones||[]).length>6?', …':''),
-      'GirderDetail varies the studs by zone; ST-Girder checks one row count and pitch for the span'); }
+    /* GD70: the zone of this span with the LARGEST pitch per stud (p / n, the fewest studs per length). ST-Girder's fatigue check compares p / n with
+       Z_r / V_sr at the worst station and its strength check counts n per pitch over the length, so this zone is the least favourable for both. */
+    const zs=(St.zones||[]).filter(z=>num(z.x1)&&num(z.x2)&&z.x2>(+sel.x0||0)+1e-6&&z.x1<(num(+sel.x1)?+sel.x1:Infinity)-1e-6&&z.nr>0&&z.p>0);
+    if(zs.length){ const zg=zs.reduce((b,z)=>(z.p/z.nr>b.p/b.nr+1e-12||(Math.abs(z.p/z.nr-b.p/b.nr)<=1e-12&&z.p>b.p))?z:b,zs[0]), m='Shear connectors, zone '+f(zg.x1,0)+' to '+f(zg.x2,0)+' ft';
+      put('conn.nRow',zg.nr,m,'details'); put('conn.pitch',zg.p,m,'details');
+      note('conn.pitch','GirderDetail: '+zs.length+' stud zones in span '+si+' ('+[...new Set(zs.map(z=>z.nr+' @ '+f(z.p,1)+' in'))].join(', ')+'). ST-Girder checks one row count and pitch, so the zone with the largest pitch per stud is used (fewest studs per length; governs its fatigue pitch and strength count): '+zg.nr+' per row @ '+f(zg.p,1)+' in ('+f(zg.x1,0)+' to '+f(zg.x2,0)+' ft). The check is conservative where GirderDetail places closer studs. Per-zone design: GirderDetail Shear connectors.'); }
+    else no('details','conn.pitch','studs per row and pitch','no zone in span '+si,'GirderDetail lists no stud zone in this span'); }
@@ -2578 +2599,4 @@ function gdXfer(ext){
-    if((F.cycles||[]).length) no('details','fatigue.ncyc','cycles per truck passage n',F.cycles.map(v=>f(v,1)).join(', ')+' (by detail)','GirderDetail sets n per detail; ST-Girder uses one n for the span'); }
+    // GD70: cycles per passage = the largest n among GirderDetail's fatigue details of this girder position (more cycles: lower finite-life resistance)
+    const cb=(F.cyclesBy||[]).filter(r=>!r.pos||r.pos===gpos), ns=(cb.length?cb.map(r=>r.n):(F.cycles||[])).filter(v=>num(v)&&v>0);
+    if(ns.length){ const nMax=Math.max(...ns); put('fatigue.ncyc',nMax,'Fatigue, largest n','details');
+      note('fatigue.ncyc','GirderDetail: n = '+[...new Set(ns)].sort((a,b)=>a-b).map(v=>f(v,1)).join(', ')+' by detail ('+(cb.length?cb.length+' '+gpos+' details':'all details')+'). ST-Girder uses one n, so the largest is used: n = '+f(nMax,1)+'. Detail by detail: GirderDetail Fatigue.'); } }
@@ -2599 +2623 @@ function gdPulled(ext,inp){ if(!gdXfer(ext)) return {}; const g=ext.girderDetail
-function gdFieldOf(inp,X,Pu,path){ if(!X) return null; if(X.set[path]) return {lock:true,v:X.set[path].v,src:X.set[path].src};
+function gdFieldOf(inp,X,Pu,path){ if(!X) return null; if(X.set[path]) return {lock:true,v:X.set[path].v,src:X.set[path].src,note:X.set[path].note};
@@ -2604,0 +2629,2 @@ const GD_LBL={'loads.wConstr':'construction live load (klf)','loads.NL':'design
+  'stiff.transverse':'transverse stiffeners','stiff.doSpc':'stiffener spacing d_o (in)','stiff.bearB':'bearing stiffener width (in)','stiff.bearT':'bearing stiffener thickness (in)','stiff.bearN':'bearing plates',
+  'conn.nRow':'studs per row','conn.pitch':'stud pitch (in)','fatigue.ncyc':'cycles per truck passage n',
@@ -2606,0 +2633,2 @@ const GD_PANE_OF={sec:'section',negM:'section',mat:'mat',deck:'deck',geom:'span'
+// GD70: the note next to a field whose single ST-Girder value is the governing one of several GirderDetail values
+const GdFieldNote=({g})=>g&&g.note?<div className="hint" style={{margin:'2px 0 8px',color:'#1C4FC4'}}>{g.note}</div>:null;
@@ -4658,2 +4686,2 @@ function InputsTab({inp,set,R}){
-        <input type="checkbox" checked={inp.stiff.transverse} onChange={e=>S('stiff.transverse',e.target.checked)}/>
-        Transverse intermediate stiffeners (unchecked = unstiffened web)</label></div>
+        <input type="checkbox" checked={inpE.stiff.transverse} disabled={!!(G('stiff.transverse')&&G('stiff.transverse').lock)} onChange={e=>S('stiff.transverse',e.target.checked)}/>
+        Transverse intermediate stiffeners (unchecked = unstiffened web)</label><GdBadge g={G('stiff.transverse')}/></div>
@@ -4661,3 +4689,3 @@ function InputsTab({inp,set,R}){
-        {inp.stiff.transverse&&<Num l="Stiffener spacing do" u="in" v={inp.stiff.doSpc} set={v=>S('stiff.doSpc',v)} step={6} gd={G('stiff.doSpc')}/>}
-        {inp.stiff.transverse&&<Num l="Stiff. width bt" u="in" v={inp.stiff.bt} set={v=>S('stiff.bt',v)} step={0.5} gd={G('stiff.bt')}/>}
-        {inp.stiff.transverse&&<Num l="Stiff. thick tp" u="in" v={inp.stiff.tp} set={v=>S('stiff.tp',v)} step={0.0625} gd={G('stiff.tp')}/>}
+        {inpE.stiff.transverse&&<Num l="Stiffener spacing do" u="in" v={inp.stiff.doSpc} set={v=>S('stiff.doSpc',v)} step={6} gd={G('stiff.doSpc')}/>}
+        {inpE.stiff.transverse&&<Num l="Stiff. width bt" u="in" v={inp.stiff.bt} set={v=>S('stiff.bt',v)} step={0.5} gd={G('stiff.bt')}/>}
+        {inpE.stiff.transverse&&<Num l="Stiff. thick tp" u="in" v={inp.stiff.tp} set={v=>S('stiff.tp',v)} step={0.0625} gd={G('stiff.tp')}/>}
@@ -4668,0 +4697 @@ function InputsTab({inp,set,R}){
+      <GdFieldNote g={G('stiff.doSpc')}/><GdFieldNote g={G('stiff.bearB')}/>
@@ -4675,0 +4705 @@ function InputsTab({inp,set,R}){
+      <GdFieldNote g={G('conn.pitch')}/>
@@ -4697 +4727,2 @@ function InputsTab({inp,set,R}){
-        <div className="fld"><label>Cycles per passage n (Table 6.6.1.2.5-2)</label>
+        {G('fatigue.ncyc')? <GdFld l="Cycles per passage n (Table 6.6.1.2.5-2)" v={fmt(+G('fatigue.ncyc').v,1)} src={G('fatigue.ncyc').src}/>
+        : <div className="fld"><label>Cycles per passage n (Table 6.6.1.2.5-2)</label>
@@ -4703 +4734 @@ function InputsTab({inp,set,R}){
-          </select></div></div>
+          </select></div></div>}
@@ -4705,0 +4737 @@ function InputsTab({inp,set,R}){
+      <GdFieldNote g={G('fatigue.ncyc')}/>
@@ -6292,3 +6324,4 @@ function crModel(R,inp,o){
-    sub(s,'Stiffeners, connectors and fatigue','6.10.11 · 6.10.10 · 6.6.1',<CrKV rows={[['Transverse stiffeners',st.transverse?'yes, d_o = '+fmt(+st.doSpc,1)+' in, b_t × t_p = '+fmt(+st.bt,2)+' × '+fmt(+st.tp,3)+' in':'none',gm('stiff.bt','stiff.tp')?'(b_t, t_p from GirderDetail)':''],
-      ['Bearing stiffeners',fmt(R.bearing.nb,0)+' plate(s) each side of the web, b_b × t_b = '+fmt(R.bearing.bb,2)+' × '+fmt(R.bearing.tb,3)+' in'],
-      ['Shear studs','d = '+fmt(+cn.studD,3)+' in, h = '+fmt(+cn.studH,2)+' in, '+fmt(+cn.nRow,0)+' per row, pitch '+fmt(+cn.pitch,2)+' in',gm('conn.studD','conn.studH')?'(d, h from GirderDetail)':''],
+    const gdNotesR=gXr?['stiff.doSpc','stiff.bearB','conn.pitch','fatigue.ncyc'].map(k=>gXr.set[k]&&gXr.set[k].note).filter(Boolean):[];   // GD70
+    sub(s,'Stiffeners, connectors and fatigue','6.10.11 · 6.10.10 · 6.6.1',<React.Fragment><CrKV rows={[['Transverse stiffeners',st.transverse?'yes, d_o = '+fmt(+st.doSpc,1)+' in, b_t × t_p = '+fmt(+st.bt,2)+' × '+fmt(+st.tp,3)+' in':'none',gm('stiff.bt','stiff.tp','stiff.doSpc')?'('+[gm('stiff.doSpc')?'d_o':'',gm('stiff.bt','stiff.tp')?'b_t, t_p':''].filter(Boolean).join('; ')+' from GirderDetail'+(gm('stiff.doSpc')?'; d_o the largest in the span':'')+')':''],
+      ['Bearing stiffeners',fmt(R.bearing.nb,0)+' plate(s) each side of the web, b_b × t_b = '+fmt(R.bearing.bb,2)+' × '+fmt(R.bearing.tb,3)+' in',gm('stiff.bearB')?'(from GirderDetail: the type at the support of the peak V_u)':''],
+      ['Shear studs','d = '+fmt(+cn.studD,3)+' in, h = '+fmt(+cn.studH,2)+' in, '+fmt(+cn.nRow,0)+' per row, pitch '+fmt(+cn.pitch,2)+' in',gm('conn.studD','conn.studH','conn.pitch')?'('+[gm('conn.studD','conn.studH')?'d, h':'',gm('conn.pitch')?'n per row and pitch: the zone with the largest pitch per stud':''].filter(Boolean).join('; ')+' from GirderDetail)':''],
@@ -6296 +6329 @@ function crModel(R,inp,o){
-      ['Cycles per truck n / design life',fmt(R.fatigue.nCyc,2)+' / '+fmt(R.fatigue.lifeYr,0)+' yr',gm('fatigue.designLife')?'(design life from GirderDetail)':''],['Fatigue limit state',fq.lsMode==='auto'?'auto (from the (ADTT)SL crossover)':'manual: Fatigue '+fq.lsMode,gm('fatigue.lsMode')]]}/>);
+      ['Cycles per truck n / design life',fmt(R.fatigue.nCyc,2)+' / '+fmt(R.fatigue.lifeYr,0)+' yr',gm('fatigue.designLife','fatigue.ncyc')?'('+[gm('fatigue.ncyc')?'n: the largest of GirderDetail’s details':'',gm('fatigue.designLife')?'design life':''].filter(Boolean).join('; ')+' from GirderDetail)':''],['Fatigue limit state',fq.lsMode==='auto'?'auto (from the (ADTT)SL crossover)':'manual: Fatigue '+fq.lsMode,gm('fatigue.lsMode')]]}/>{gdNotesR.length>0&&<React.Fragment><p className="cr-note">Single values taken from GirderDetail’s several (governing value):</p><ul className="cr-ul">{gdNotesR.map((t,i)=><li key={i}>{t}</li>)}</ul></React.Fragment>}</React.Fragment>);
```


## 2026-10-19 — PR: claude/stgirder-gd71 (GD71: bearing stiffener plate count worded as the total; engineer approval 2026-10-19; wording only; PR link added after merge)

### GD71. "Bearing plates" = total plates, both sides of the web   [wording only — no result change, Tier 0]
- **Where:** InputsTab, Stiffeners / Studs / Fatigue: `<Num l="Bearing plates (…)"` (anchor `v={inp.stiff.bearN}`); `stiffBearDeriv` variable table row `n_b`; report `crModel` row "Bearing stiffeners"; `GD_LBL['stiff.bearN']` (pull summary).
- **Before:** "Bearing plates (ea. side)"; "n_b — Plates each side"; report "2 plate(s) each side of the web"; pull summary "bearing plates".
- **After:** "Bearing plates (total, both sides)"; "n_b — Plates in total (both sides of the web)"; report "2 plates in total (1 each side of the web)"; pull summary "bearing plates (total, both sides)".
- **Problem:** the check has always used `stiff.bearN` as the total number of plates (A_pn = n_b(b_b − clip)t_b; column I = t_b(n_b b_b + t_w)³/12, so n_b = 2 is one plate each side), while the label said "each side". The default 2 and GirderDetail's "1 pair = 2 plates" (GD70) follow the formulas; only the wording was wrong. The GD70 transfer note ("1 pair = 2 plates (one each side of the web)") was already right and is unchanged.
- **Governing provision:** none changed (AASHTO LRFD 10th Ed. (2024) 6.10.11.2.3, 6.10.11.2.4 as before).
- **Check case:** built-in AASHTO G2 (GirderDetail payload): n_b = 2, A_pn = 2 × (8.00 − 1.5) × 0.75 = 9.75 in², φR_sb,n = 682.5 kip, unchanged; the report row now reads "2 plates in total (1 each side of the web), b_b × t_b = 8.00 × 0.750 in".
- **How verified:** `node tests/check-syntax.mjs stgirder.html` (all pass); `node tests/compare.mjs --tool st --payload def15_AASHTO_G2,def15_RIDOT_Iyes_G2,xsA_RIDOT_Iyes_G1,util_MassDOT_G2,def15_AASHTO_G2_gdx,util_MassDOT_G2_gdx`: all sections identical to main (419921a), no console errors.
- **Saved data:** none (`stiff.bearN` key and meaning unchanged). **Other copies:** none. **Open items:** none.
- **Diff (main → branch; no context lines):**
```diff
diff --git a/stgirder.html b/stgirder.html
index 95a8076..e297ce6 100644
--- a/stgirder.html
+++ b/stgirder.html
@@ -2629 +2629 @@ const GD_LBL={'loads.wConstr':'construction live load (klf)','loads.NL':'design
-  'stiff.transverse':'transverse stiffeners','stiff.doSpc':'stiffener spacing d_o (in)','stiff.bearB':'bearing stiffener width (in)','stiff.bearT':'bearing stiffener thickness (in)','stiff.bearN':'bearing plates',
+  'stiff.transverse':'transverse stiffeners','stiff.doSpc':'stiffener spacing d_o (in)','stiff.bearB':'bearing stiffener width (in)','stiff.bearT':'bearing stiffener thickness (in)','stiff.bearN':'bearing plates (total, both sides)',
@@ -4694 +4694 @@ function InputsTab({inp,set,R}){
-        <Num l="Bearing plates (ea. side)" v={inp.stiff.bearN} set={v=>S('stiff.bearN',v)} step={1} gd={G('stiff.bearN')}/>
+        <Num l="Bearing plates (total, both sides)" v={inp.stiff.bearN} set={v=>S('stiff.bearN',v)} step={1} gd={G('stiff.bearN')}/>
@@ -6000 +6000 @@ function stiffBearDeriv(R){ const br=R.bearing;
-        ['n_b','Plates each side',br.nb,'—'],['b_b','Plate width',br.bb,'in'],['t_b','Plate thickness',br.tb,'in'],
+        ['n_b','Plates in total (both sides of the web)',br.nb,'—'],['b_b','Plate width',br.bb,'in'],['t_b','Plate thickness',br.tb,'in'],
@@ -6326 +6326 @@ function crModel(R,inp,o){
-      ['Bearing stiffeners',fmt(R.bearing.nb,0)+' plate(s) each side of the web, b_b × t_b = '+fmt(R.bearing.bb,2)+' × '+fmt(R.bearing.tb,3)+' in',gm('stiff.bearB')?'(from GirderDetail: the type at the support of the peak V_u)':''],
+      ['Bearing stiffeners',fmt(R.bearing.nb,0)+' plates in total ('+fmt(R.bearing.nb/2,R.bearing.nb%2?1:0)+' each side of the web), b_b × t_b = '+fmt(R.bearing.bb,2)+' × '+fmt(R.bearing.tb,3)+' in',gm('stiff.bearB')?'(from GirderDetail: the type at the support of the peak V_u)':''],
```


## 2026-10-19 — PR: claude/stgirder-disconnect (DISC: ST-Girder disconnected from every bridge tool except GirderDetail; engineer decision 2026-10-19; the other tools' side is branch claude/stgirder-disconnect-others; PR link added after merge)

### DISC. ST-Girder takes data from GirderDetail only   [removes cross-tool links; no change to the built-in analysis or to GirderDetail imports; saved MCT / LL & DL data cleared with a notice]
- **Engineer decision (2026-10-19):** ST-Girder (`stgirder.html`) is completely disconnected from every other bridge tool except GirderDetail (`Steel Bridge Beam Modules.html`). (1) Substructure Loading will take reactions from GirderDetail (separate, later PR; not here). (2) MCT's steel rating no longer uses ST-Girder's capacity. (3) No MIDAS / MCT demand input into ST-Girder: Import accepts only GirderDetail files. (4) ST-Girder's built-in simple-span analysis and its own inputs stay as they are. (5) Saved ST-Girder data that came from MCT or LL & DL is cleared on open, with a one-time visible notice listing exactly what was removed; CLAUDE.md §5 is satisfied by this explicit decision plus the notice, recorded here. (6) ST-Girder is removed from MCT's combined saved project.
- **Removed from ST-Girder (anchors are the start of each removed block in main bcbd913):**
  - Head: the shared design-beam block `Bridge Suite — shared DESIGN BEAM channel (v1)` (`window.BridgeBeam`, its `.beamchip` CSS).
  - Body: `Bridge Suite shared-storage handoff (v1)` (`window.BridgeHandoff`, the MCT demands map `bridgeSuite.v1.handoffs` / `latestId` / `updatedAt` / `adopted.stgirder`), `Bridge Suite geometry change tracker (v1)` (`window.BridgeGeometryChanges`, `geometryChanges`), and the big shared block that starts `Bridge Suite unified project registry (v1)`: `window.BridgeProjects` (`projects`, `currentProjectId`, `migrated.stgirder`), `SHARED APP PATHS` (`window.BridgeApps`, `BridgeApps.boot('stgirder')`, the iframe hello to MCT), `SHARED CHANNEL LOCKS` (`window.BridgeLocks`: `locks`, `syncLog.*`, `lockSnap.*`, toasts, lock UI kit, suite panel and drawer). Replaced by the reduced, ST-Girder-only block `ST-Girder app-path record (reduced copy, 2026-10-19)` (below).
  - Script `BXProject` (`/* Shared project info (HANDOFF.md §4.1)`; buttons "Use shared project info" / "Share project info", channel `projectMeta`). GirderDetail does not use `projectMeta` for ST-Girder (the `girderDemands` payload carries its own `project` string), so per the task it is removed; ST-Girder's title block is typed in ST-Girder only.
  - Script `BXSuperRx` (`/* superReactions sender glue (HANDOFF.md §4.4)`) and `function bxSuperRxPayload` (buttons "Send reactions to Substructure Loading" / "Export hand-off (JSON)"; keys `superReactions`, `superReactions.by.stgirder`).
  - Script `Floating cross-app sync drawer` (`BridgeLocks.drawer({app:'stgirder'})`).
  - Babel: `const BL=window.BridgeLocks…`, `BLU`, `LOCK_APP`; `function bridgeNav` (MCT iframe embedding, "↩ MCT Analysis", "PS-Beam ↗"); `function PosTag`; the module-scope LL & DL resolvers (`extActiveOf`, `lldfResolveFor`, `LLDF_LABELS`, `lldfMineFor`, `lldfTheirsFor`, `applyLLDFTo`, `dlResolveFor`, `DL_*`, `applyDLTo`, `LOCK_SIG`, `function LockAutoSync`); in `InputsTab` the LL & DL two-way link (`pullLLDF`, `toggleLLDFLock`, `pullDL`, `toggleDLLock`, `dlPeek`, `sendLLDF` → `bridgeSuite.v1.lldfGeom`, `toggleGeomLock`), the "⇩ Pull DC2 / DW from LL & DL", "⇩ Pull from LL & DL", "Send geometry to LL & DL ↗" buttons with their lock toggles and driven strips, the DC1 cross-check hint, the fatigue-DF override hints, the read-only/driven state of the DC2, DW, imported-LL DF and manual DF_m / DF_v fields and the "🔒 FROM LL & DL" tag; the shared design-beam chip (`useDesignBeam`, `BeamChip`) and the App effect that set `loads.pos` from it; in `App` the MCT demands hand-off (`checkHandoff`, `adoptHandoff`, `dismissHandoff`, the "New analysis data available" banner, demands lock), the MCT geometry-change banner and modal (and their `.geom-*` CSS), the capacity publish to the MCT rating (`publishCapacity` → `bridgeSuite.v1.capacity`, capacity lock; the Rating tab callout "Feed this capacity to the MCT rating"), the shared-project participation (`adoptProject`, project follow, project slice autosave, "◆ Project:" indicator), the legacy project helpers (`ST_APP`, `BP`, `legacyLoadProjects`, `loadProjects` … `saveLastProjId`) and the one-time `BridgeProjects.migrate` call.
- **Kept:** "⇩ Pull from GirderDetail" (`bridgeSuite.v1.girderDemands`, `BridgeXfer.read/isNew/markAdopted`, receiver `stgirder`), Import of GirderDetail's hand-off file, the `#gdpull` open-now path (OD1), the built-in simple-span analysis, the GirderDetail owner rules / loads / details transfers (GD49, GD54c, GDL, GDX, GD70, GD71), `BridgeXfer` (verbatim HANDOFF.md §5 copy, needed for `girderDemands`), the "← All tools" link to `tools.html`, the session autosave `stgirder.session`, Export JSON / Import of ST-Girder JSON files, Undo / Redo / Reset.
- **Reduced app-path block:** GirderDetail's "Open ST-Girder now" reads `bridgeSuite.v1.appPaths.stgirder` (read only) to find this file. The new block `ST-Girder app-path record (reduced copy, 2026-10-19)` keeps only `register()` for app `stgirder`, copied from the shared block's `BridgeApps.register` with the same format (`{file, pinned, seenAt, dir, at:{<folder>:{file,pinned,seenAt}}}`, 24 folders, pins honoured). It is marked as not the shared byte-identical copy (CLAUDE.md §3: the shared bootstrap block is now in index.html, lldf.html, psbeam.html only).
- **Import:** a demands file that is not GirderDetail's (`_schema` `psbeam-external-demands`, `steelbeam-external-demands`, `stgirder-external-demands` without `producer:"GirderDetail"` + `girderDetail`, or any JSON with a top-level `stations` array) is refused: "ST-Girder now takes demands only from GirderDetail; this file is from <producer> and was not loaded. Nothing was changed. Send the girder from GirderDetail (Steel Bridge Beam Modules.html, Structural analysis: Send to ST-Girder) and use "Pull from GirderDetail", or import its "Export hand-off (JSON)" file. Without GirderDetail demands ST-Girder uses its built-in simple-span analysis." An ST-Girder JSON file (Export JSON) still loads; it is cleaned like a saved session (below) and the removals are added to the notice ("File <name>: …").
- **Saved data (CLAUDE.md §5, engineer decision 5): `stgDisconnect(inp)`, run on open on the saved `stgirder.session` (`stgBoot`), on an imported ST-Girder JSON file and on a shared-project design opened from the notice.** Each rule only acts when the data came from MCT / LL & DL; every removal is listed in the notice with its old and new value:
  1. `inp.external` that is not GirderDetail's (`extFromGD` false: MCT hand-off, MIDAS / PS-Beam / steel-beam envelope) → `null` (built-in simple-span analysis). The span length `geom.L` and the plates `sec` that the import had set are kept as inputs (the notice says so), exactly as the existing "✕ use built-in simple-span analysis" button does.
  2. Manual DFs from LL & DL: `loads.dfAuto === false` and (DF_m, DF_v) equal a factor pair published on `bridgeSuite.v1.lldf` (governing interior / exterior / byBeam, to 4 decimals), or the `lldf` channel is locked, or ST-Girder holds a pre-lock snapshot `lockSnap.stgirder.lldf` → `dfAuto = true` (ST-Girder's own AASHTO LRFD 4.6.2.2 factors). DF_m / DF_v values stay stored (unused while AUTO).
  3. Imported-LL multipliers (`extDFpos`, `extDFneg`, `extDFv`, `extLLmpf`) not all at their defaults and equal to a published pair (or lock / snapshot) → the pre-lock snapshot values if ST-Girder has them, else the defaults 1.0.
  4. `loads.fatM` / `loads.fatV` > 0 (only LL & DL ever set them) → 0 (ST-Girder's own single-lane estimate DF ÷ 1.2, or GirderDetail's fatigue envelopes).
  5. `loads.wBar` (DC2) / `loads.wDW` (DW) equal to the DC2 / DW case published on `bridgeSuite.v1.dlLoads` (4 decimals), or the `dlLoads` channel locked / snapshot held (for a published case) → the pre-lock snapshot value if any, else ST-Girder's defaults 0.30 / 0.25 klf.
  6. `loads.posAuto !== false` while a shared design beam (`bridgeSuite.v1.designBeam`) is stored → `posAuto = false`; `loads.pos` is kept (the position is set in ST-Girder from now on; `posAuto` is no longer read anywhere).
  - Limitation: a DF / DC2 / DW value pulled once from LL & DL, when LL & DL's payload is no longer in the browser and no lock or snapshot exists, cannot be told apart from a value typed by hand; it is kept as ST-Girder's own input.
- **Keys:** `stgPurgeOwnCopies()` removes, on every open, only ST-Girder's own published copies, so receivers stop listing them: `bridgeSuite.v1.superReactions.by.stgirder`; `bridgeSuite.v1.superReactions` (+ `.updatedAt` when it holds the same `producedAt`) only when its `producer` is "ST-Girder"; `bridgeSuite.v1.capacity` (+ `.capacity.updatedAt`, same rule) only when its `producer` is "ST-Girder"; `bridgeSuite.v1.lldfGeom` only when its `producer` is "ST-Girder". Every removal is listed in the notice with the key name. Other tools' keys are not touched (`lldf`, `dlLoads`, `designBeam`, `beamRoster`, `locks`, `syncLog.*`, `lockSnap.*`, `handoffs`, `latestId`, `geometryChanges`, `projects`, `currentProjectId`, `capacity.adopted.mct`, `superReactions.by.psbeam`, …). ST-Girder stops writing: `capacity`, `superReactions`, `superReactions.by.stgirder`, `lldfGeom`, `projects` (its slice), `currentProjectId`, `migrated.stgirder`, `locks`, `syncLog.stgirder`, `lockSnap.stgirder`, `adopted.stgirder` (MCT map), `geometryChanges.adopted.stgirder`, `designBeam`. It still writes `stgirder.session`, `stgirder.ui.v1`, `stgirder.inputTab.v1`, `bridgeSuite.v1.appPaths` (its own entry) and `bridgeSuite.v1.girderDemands.adopted.stgirder`.
- **New key `stgirder.disconnect.v1`** (tool-prefixed, CLAUDE.md §5): `{v:1, pending, at, items:[…], projects:[{id,name,savedAt}]}`. The notice is shown while `pending` is true (it survives a reload or a closed tab) and the "✕ dismiss (do not show again)" button sets it false. On the first open only, ST-Girder designs found in the shared project registry (`bridgeSuite.v1.projects[*].slices.stgirder`, which MCT's combined project held) are listed in the notice with "Open here" (cleaned like the session; Undo restores the previous inputs) and "Export JSON" (an ST-Girder JSON file for Import), so they are not lost; nothing is deleted from the registry.
- **Notice text** (heading "ST-Girder now takes data from GirderDetail only"): "Engineer decision 2026-10-19: ST-Girder no longer exchanges data with the MCT Generator, PS-Beam, LL & DL Distribution or Bridge Substructure Loading. Demands come only from GirderDetail (Pull from GirderDetail, or Import of its hand-off file); otherwise ST-Girder uses its own inputs and its built-in simple-span analysis. Saved data that came from those tools was removed:" followed by one line per removal, e.g. "Imported demands from MCT Generator (project "Old MCT bridge"), member G2, 363 stations: removed. ST-Girder runs its built-in simple-span analysis again (span length L = 140.00 ft and the plates are kept as they were; check them).", "Live load distribution factors DF_m = 0.712, DF_v = 0.884 (MANUAL, from LL & DL Distribution): replaced by ST-Girder’s own AASHTO LRFD 4.6.2.2 factors (Distribution factors: AUTO TYPE (a)).", "DC2 barrier / SIDL (per girder) 0.412 klf from LL & DL Distribution: set to 0.300 klf (ST-Girder default). …", "Capacity (φM_n, φV_n) for the MCT rating sent by ST-Girder: removed (key bridgeSuite.v1.capacity and bridgeSuite.v1.capacity.updatedAt).", then the shared-project designs with their buttons.
- **Wording:** report "Girder position" now reads "<pos> (set here)" (was "(follows the shared design beam)" while `posAuto`); the PNA-out-of-scope note drops "Sending capacity to the MCT rating is blocked; … hand-offs"; the no-negative-moment note drops "or MCT/MIDAS"; the fatigue warning for imported demands without fatigue envelopes reads "Imported demands without fatigue envelopes:" (was "Imported MIDAS demands:"); the Fatigue tab DF hint drops "Pull an exact value from the LL & DL Distribution app if desired."; the GirderDetail pull summary drops "(no longer follows the design-beam chip)"; the autosave-failure message names only `stgirder.session`. The `DEFAULTS.loads.posAuto` comment says the field is no longer used.
- **§4 / result change:** no formula, factor, unit or code reference changed. The compute path (`computeAll`, including the `loads.fatM` / `fatV` branches, which now only see 0) is untouched. Results change only for a saved session that held MCT / LL & DL data, by the removals listed in the notice (engineer decision 5): e.g. a session on MCT demands now runs the built-in simple span; DFs from LL & DL become ST-Girder's own 4.6.2.2 factors.
- **Check case:** (a) built-in example, empty storage: every check (value, limit, ratio), the rating, the stations (x, M_u, V_u), fatigue and deflection results are identical to main (hashes checks 72123bf8f18a, rating 990718730b7c, stations c45626747a1d). (b) An old session (span 2 of a 110-140-110 ft MCT model, DF_m 0.712 / DF_v 0.884 and fatigue 0.401 / 0.512 from LL & DL, DC2 0.412 / DW 0.318 klf from LL & DL, `lldf` locked, design beam B3): after open `external = null`, `L = 140 ft`, `dfAuto = true`, `fatM = fatV = 0`, `wBar = 0.30`, `wDW = 0.25`, ext multipliers 1.0, `posAuto = false`; the cleaned session gives identical results on main and on this branch (same inputs, same computeAll).
- **How verified:** `node tests/check-syntax.mjs stgirder.html` (all pass); `node tests/compare.mjs --tool st --payload def15_AASHTO_G2,def15_RIDOT_Iyes_G2,xsA_RIDOT_Iyes_G1,util_MassDOT_G2,def15_AASHTO_G2_gdx,util_MassDOT_G2_gdx,def15_AASHTO_G2_loads`: all sections identical to main (bcbd913), no console errors (GirderDetail `#gdpull` path); a headless script (scratch) on main vs branch: built-in results identical, every tab and Inputs sub-tab renders without console errors; old session above → notice shown and data cleared, keys removed / kept as listed, notice still shown after reload until dismissed and not after; shared-project design "Open here" cleaned; MCT demands file refused with nothing changed; "Pull from GirderDetail" button and Import of the GirderDetail hand-off file applied; screenshot of the notice checked.
- **Other copies:** ST-Girder no longer carries the shared bootstrap block (BridgeBeam, BridgeHandoff, BridgeGeometryChanges, BridgeProjects + BridgeApps + BridgeLocks) or the BXSuperRx glue (still in psbeam.html); `BridgeXfer` stays the verbatim HANDOFF.md §5 copy. CLAUDE.md §3, HANDOFF.md, AUDIT.md and the other tools are updated in branch claude/stgirder-disconnect-others.
- **Open items:** `projectMeta` ("Use / Share shared project info") was removed because GirderDetail does not use it for ST-Girder; if the engineer wants ST-Girder's title block to follow GirderDetail's shared project info, it can be restored as a GirderDetail-only receiver. Substructure Loading reactions from GirderDetail: separate PR (engineer decision 1).
- **Diff (main → branch, `git diff -U0`; runs of more than 30 deleted lines and hunks that only delete are summarised by their first and last line):**
```diff
diff --git a/stgirder.html b/stgirder.html
index e297ce6..ac2134d 100644
--- a/stgirder.html
+++ b/stgirder.html
@@ -47 +47 @@ body{background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gr
-.sheet-inner>.callout,.sheet-inner>.geom-change-banner{margin-left:28px;margin-right:28px}
+.sheet-inner>.callout{margin-left:28px;margin-right:28px}
@@ -90 +90 @@ body{background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gr
-  .cols,.cols-full{padding-left:14px;padding-right:14px}.sheet-inner>.callout,.sheet-inner>.geom-change-banner{margin-left:14px;margin-right:14px}}
+  .cols,.cols-full{padding-left:14px;padding-right:14px}.sheet-inner>.callout{margin-left:14px;margin-right:14px}}
-247,155 +246,0  [deleted 155 lines: first "/* Geometry change notice — informational, so it uses the suite's steady" ... last ""]
-566,81 +410,0  [deleted 81 lines: first "<!-- ═══════════════════════════════════════════════════════════════════════════" ... last "</script>"]
@@ -652,119 +416,8 @@ var st=document.createElement('style'); st.textContent=css;
-[... 119 deleted lines, first "Bridge Suite shared-storage handoff (v1) — shared verbatim with index.html /" ... last "bridgeSuite.v1.currentProjectId  · bridgeSuite.v1.migrated.<app>"]
+     ST-Girder app-path record (reduced copy, 2026-10-19). NOT the shared bridge-suite
+     bootstrap block: ST-Girder is disconnected from MCT, PS-Beam, LL & DL and
+     Substructure Loading (engineer decision 2026-10-19) and keeps only what
+     GirderDetail's hand-off needs. It records where this file lives in
+     bridgeSuite.v1.appPaths (entry "stgirder", same format as the shared block's
+     register()), which GirderDetail reads (read only) for "Open ST-Girder now"
+     (HANDOFF.md §4.9). Nothing else is read or written here. Do not sync this block
+     with the shared block in index.html / psbeam.html / lldf.html.
@@ -774,87 +427 @@ var st=document.createElement('style'); st.textContent=css;
-[... 87 deleted lines, first ""use strict";" ... last "var ME='';                                   // which app this file is, set by b"]
+  var KEY='bridgeSuite.v1.appPaths', APP='stgirder';
@@ -863 +430 @@ var st=document.createElement('style'); st.textContent=css;
-  function write(o){ try{ localStorage.setItem(KEY,JSON.stringify(o)); return true; }catch(e){ storageWarn('the app-path record',e); return false; } }
+  function write(o){ try{ localStorage.setItem(KEY,JSON.stringify(o)); return true; }catch(e){ return false; } }
-865,31 +431,0  [deleted 31 lines: first "/* A write to the shared browser storage that fails because the storage is" ... last "with a space arrives percent-encoded and the value is shown to a human. */"]
-903,3 +438,0  [deleted 3 lines: first "/* The folder this file sits in, as a URL ending in "/". Every relative link" ... last "filed under. */"]
-912 +444,0  [deleted 1 lines: first "function same(a,b){ return String(a||'').toLowerCase()===String(b||'').toLowerCase(); }" ... last "function same(a,b){ return String(a||'').toLowerCase()===String(b||'').toLowerCa"]
@@ -918,16 +450,5 @@ var st=document.createElement('style'); st.textContent=css;
-  /* What is recorded for an app, for THIS folder. Entries written before
-     sightings were filed by folder carry no folder at all; they are still
-     honoured, since they were almost always made next door. */
-  function entry(app){
-    var o=read(), e=o[app]; if(!e) return null;
-    var d=selfDir();
-    if(e.at&&e.at[d]) return {file:e.at[d].file, pinned:!!e.at[d].pinned, legacy:false};
-    if(e.file&&!e.dir) return {file:e.file, pinned:!!e.pinned, legacy:true};
-    return null;
-  }
-  /* Record where this app lives. A sighting never overwrites a pin made for
-     the same folder -- if the engineer said which file is PS-Beam, a stray
-     copy does not get to argue. */
-  function register(app){
-    var f=selfFile(); if(!f||!NAMES[app]) return '';
-    var d=selfDir(), o=read(), e=o[app]||{}, at=e.at||{}, cur=at[d];
+  /* Record where ST-Girder lives, filed by folder. A sighting never overwrites a pin
+     made for the same folder. Same logic and format as the shared block's register(). */
+  function register(){
+    var f=selfFile(); if(!f) return '';
+    var d=selfDir(), o=read(), e=o[APP]||{}, at=e.at||{}, cur=at[d];
@@ -938,2 +459 @@ var st=document.createElement('style'); st.textContent=css;
-    // A pin from before folders were tracked keeps its place at the top level.
-    o[app]=(e.pinned&&!e.dir)
+    o[APP]=(e.pinned&&!e.dir)
@@ -944,854 +464 @@ var st=document.createElement('style'); st.textContent=css;
-[... 854 deleted lines, first "/* Point an app at a file for THIS folder (pinned unless told otherwise), or" ... last "toast:toast, onChange:onChange, onLog:onLog, ui:ui };"]
+  try{ register(); }catch(e){}
-1875,88 +541,0  [deleted 88 lines: first "/* Shared project info (HANDOFF.md §4.1): glue for the "Use shared project info" and" ... last "})();"]
-1966,4 +544,0  [deleted 4 lines: first "/* Shared cross-app channel locks (see the BridgeLocks block above). */" ... last "const LOCK_APP='stgirder';"]
-1979,11 +553,0  [deleted 11 lines: first "// Navigate between suite apps. When embedded inside the MCT window, ask the parent to switch" ... last "}"]
@@ -2023 +587 @@ const DEFAULTS = {
-         pos:'interior', posAuto:true, de:2.5, skew:0, NL:2, fatM:0, fatV:0,   // posAuto: follow the shared design beam; fatV = single-lane fatigue SHEAR DF override (0 = auto)
+         pos:'interior', posAuto:true, de:2.5, skew:0, NL:2, fatM:0, fatV:0,   // posAuto: not used since 2026-10-19 (the shared design beam was removed; the position is set here); fatV = single-lane fatigue SHEAR DF override (0 = auto)
-2929,46 +1492,0  [deleted 46 lines: first "/* ===== superReactions hand-off (HANDOFF.md §4.4) =====" ... last ""]
@@ -3727 +2245 @@ function computeAll(inp){
-    else if(useExt) warnings.fat.push('Imported MIDAS demands: the fatigue checks still use the fatigue truck on a SIMPLE span of L = '+fmt(Lft,1)+' ft (flange stress range, web special fatigue, stud pitch). Negative-moment fatigue at interior piers (top flange and its welded attachments, deck reinforcement) is not checked'+(hasNeg?', although this span has negative moment':'')+'. Check those details with a fatigue-truck range from the continuous analysis.');
+    else if(useExt) warnings.fat.push('Imported demands without fatigue envelopes: the fatigue checks still use the fatigue truck on a SIMPLE span of L = '+fmt(Lft,1)+' ft (flange stress range, web special fatigue, stud pitch). Negative-moment fatigue at interior piers (top flange and its welded attachments, deck reinforcement) is not checked'+(hasNeg?', although this span has negative moment':'')+'. Check those details with a fatigue-truck range from the continuous analysis.');
-3942,15 +2459,0  [deleted 15 lines: first "/* Shows whether the INTERIOR/EXTERIOR position is being driven by the shared design" ... last ""]
-3958,121 +2460,0  [deleted 121 lines: first "/* ===== Shared-channel resolvers, hoisted to module scope =====" ... last ""]
-4151,175 +2532,0  [deleted 175 lines: first "// ── LL & DL Distribution app two-way link (shared storage; see lldf.html) ──" ... last ""]
-4541,10 +2747,0  [deleted 10 lines: first "{/* ---- shared dead-load channel (DC2 / DW from the LL & DL app) ---- */}" ... last "{dlLocked&&BLU.DrivenStrip&&<BLU.DrivenStrip ch="dlLoads" detail={dlSrc+dlNote} "]
-4552,3 +2748,0  [deleted 3 lines: first "{(()=>{ const r=dlPeek; if(gL||!r||r.why||!(r.dc1>0)||!Ld) return null;" ... last "return <div className="hint" style={{margin:'0 0 10px'}}>DC1 cross-check — LL &a"]
@@ -4598 +2792 @@ function InputsTab({inp,set,R}){
-          : <Num l="Barrier / SIDL (per girder)" u="klf" v={loads.wBar} set={v=>S('loads.wBar',v)} step={0.01} driven={dlLocked&&dlHasBar} src={dlSrc} gd={G('loads.wBar')}/>}</div>
+          : <Num l="Barrier / SIDL (per girder)" u="klf" v={loads.wBar} set={v=>S('loads.wBar',v)} step={0.01} gd={G('loads.wBar')}/>}</div>
@@ -4606 +2800 @@ function InputsTab({inp,set,R}){
-          : <Num l="Wearing surface (per girder)" u="klf" v={loads.wDW} set={v=>S('loads.wDW',v)} step={0.01} driven={dlLocked&&dlHasDW} src={dlSrc} gd={G('loads.wDW')}/>}</div>
+          : <Num l="Wearing surface (per girder)" u="klf" v={loads.wDW} set={v=>S('loads.wDW',v)} step={0.01} gd={G('loads.wDW')}/>}</div>
-4613,17 +2806,0  [deleted 17 lines: first "<div className="btnrow" style={{margin:'2px 0 6px',alignItems:'center'}}>" ... last "{(+loads.fatV>0)&&<div className="hint" style={{marginTop:0,marginBottom:10}}>Fa"]
@@ -4636,4 +2813,4 @@ function InputsTab({inp,set,R}){
-            <Num l="DF — positive moment" v={loads.extDFpos} set={v=>S('loads.extDFpos',v)} step={0.05} min={0} driven={lldfLocked} src={lldfSrc} gd={G('loads.extDFpos')}/>
-            <Num l="DF — negative moment" v={loads.extDFneg} set={v=>S('loads.extDFneg',v)} step={0.05} min={0} driven={lldfLocked} src={lldfSrc} gd={G('loads.extDFneg')}/>
-            <Num l="DF — shear" v={loads.extDFv} set={v=>S('loads.extDFv',v)} step={0.05} min={0} driven={lldfLocked} src={lldfSrc} gd={G('loads.extDFv')}/>
-            <Num l="Multiple presence m" v={loads.extLLmpf} set={v=>S('loads.extLLmpf',v)} step={0.05} min={0} driven={lldfLocked} src={lldfSrc} gd={G('loads.extLLmpf')}/>
+            <Num l="DF — positive moment" v={loads.extDFpos} set={v=>S('loads.extDFpos',v)} step={0.05} min={0} gd={G('loads.extDFpos')}/>
+            <Num l="DF — negative moment" v={loads.extDFneg} set={v=>S('loads.extDFneg',v)} step={0.05} min={0} gd={G('loads.extDFneg')}/>
+            <Num l="DF — shear" v={loads.extDFv} set={v=>S('loads.extDFv',v)} step={0.05} min={0} gd={G('loads.extDFv')}/>
+            <Num l="Multiple presence m" v={loads.extLLmpf} set={v=>S('loads.extLLmpf',v)} step={0.05} min={0} gd={G('loads.extLLmpf')}/>
@@ -4651,3 +2828 @@ function InputsTab({inp,set,R}){
-            {lldfLocked
-              ? <span className="xlink live" title="Distribution factors are locked to the LL &amp; DL Distribution app — the AUTO/MANUAL choice is not available while locked."><span className="xlk">🔒</span><span>FROM LL &amp; DL</span></span>
-              : <Seg opts={[{v:true,l:'AUTO TYPE (a)'},{v:false,l:'MANUAL'}]} v={loads.dfAuto} set={v=>S('loads.dfAuto',v)}/>}
+            <Seg opts={[{v:true,l:'AUTO TYPE (a)'},{v:false,l:'MANUAL'}]} v={loads.dfAuto} set={v=>S('loads.dfAuto',v)}/>
-4656 +2830,0  [deleted 1 lines: first "{loads.dfAuto&&<PosTag inp={inp} set={set}/>}" ... last "{loads.dfAuto&&<PosTag inp={inp} set={set}/>}"]
@@ -4658,3 +2832,2 @@ function InputsTab({inp,set,R}){
-              <div className="fwrap" style={{width:90}}><input type="number" step="0.01" value={loads.dfm} readOnly={lldfLocked} className={lldfLocked?'bl-driven':undefined} title={lldfLocked?('Driven by '+lldfSrc+' — unlock to edit.'):undefined} onChange={e=>{ if(lldfLocked) return; S('loads.dfm',+e.target.value); }}/><span className="unit">DFm</span></div>
-              <div className="fwrap" style={{width:90}}><input type="number" step="0.01" value={loads.dfv} readOnly={lldfLocked} className={lldfLocked?'bl-driven':undefined} title={lldfLocked?('Driven by '+lldfSrc+' — unlock to edit.'):undefined} onChange={e=>{ if(lldfLocked) return; S('loads.dfv',+e.target.value); }}/><span className="unit">DFv</span></div>
-              {lldfLocked&&<span className="bl-src" style={{alignSelf:'center'}}>{lldfSrc}</span>}
+              <div className="fwrap" style={{width:90}}><input type="number" step="0.01" value={loads.dfm} onChange={e=>{ S('loads.dfm',+e.target.value); }}/><span className="unit">DFm</span></div>
+              <div className="fwrap" style={{width:90}}><input type="number" step="0.01" value={loads.dfv} onChange={e=>{ S('loads.dfv',+e.target.value); }}/><span className="unit">DFv</span></div>
@@ -4738 +2911 @@ function InputsTab({inp,set,R}){
-      <div className="hint" style={{margin:'2px 0 0'}}>{(+inp.loads.fatM>0)?<span>A single-lane fatigue distribution factor <b>{fmt(+inp.loads.fatM,3)}</b> is pulled from the LL &amp; DL Distribution app and will be used for the stress range. Clear it on the Loads card to fall back to the DF÷1.2 estimate.</span>:<span>The single-lane fatigue distribution factor is estimated as (1-lane moment DF)÷1.2 (removes multiple presence){inp.loads.pos==='exterior'?'; for an exterior girder the one-lane DF is the larger of the lever rule and the rigid-section value':''}. Pull an exact value from the LL &amp; DL Distribution app if desired.</span>}</div>
+      <div className="hint" style={{margin:'2px 0 0'}}>{(+inp.loads.fatM>0)?<span>A single-lane fatigue distribution factor <b>{fmt(+inp.loads.fatM,3)}</b> is used for the stress range.</span>:<span>The single-lane fatigue distribution factor is estimated as (1-lane moment DF)÷1.2 (removes multiple presence){inp.loads.pos==='exterior'?'; for an exterior girder the one-lane DF is the larger of the lever rule and the rigid-section value':''}.</span>}</div>
@@ -5077 +3250 @@ const PNA_OOS_HEAD='Outside the scope of this app: the plastic neutral axis fall
-const PNA_OOS_NOT='Not reported (OUT OF SCOPE): Strength I positive flexure, ductility D_p \u2264 0.42D_t, the web compactness / compact-section classification and M_p, D_p, D_cp of the segment(s) named, and the positive-moment and governing load ratings. The overall verdict is "Not all checks pass". Sending capacity to the MCT rating is blocked; the other checks and hand-offs are unaffected.';
+const PNA_OOS_NOT='Not reported (OUT OF SCOPE): Strength I positive flexure, ductility D_p \u2264 0.42D_t, the web compactness / compact-section classification and M_p, D_p, D_cp of the segment(s) named, and the positive-moment and governing load ratings. The overall verdict is "Not all checks pass". The other checks are unaffected.';
@@ -5388 +3561 @@ const flexNoNegText=R=>(R.useExt
-  +(R.useExt?'':' To check a continuous girder\'s pier region, import continuous demands from GirderDetail (Send to ST-Girder) or MCT/MIDAS.');
+  +(R.useExt?'':' To check a continuous girder\'s pier region, import continuous demands from GirderDetail (Send to ST-Girder).');
@@ -6103 +4276 @@ function ConnTab({R}){
-function RatingTab({R,inp,set,onSendCapacity,capLocked,onToggleCapLock}){
+function RatingTab({R,inp,set}){
-6110,11 +4282,0  [deleted 11 lines: first "{onSendCapacity&&<div className="callout" style={{marginTop:0,marginBottom:12,borderLeftColor:capLocked?'#ea58" ... last "</div>}"]
@@ -6291 +4453 @@ function crModel(R,inp,o){
-      ['Cross-frame spacing (unbraced length) L_b',fmt(+inp.geom.Lb,2),'ft'+gm('geom.Lb')],['Girder position',gt.pos+(lq.posAuto!==false?' (follows the shared design beam)':' (set here)'),gm('loads.pos')],
+      ['Cross-frame spacing (unbraced length) L_b',fmt(+inp.geom.Lb,2),'ft'+gm('geom.Lb')],['Girder position',gt.pos+' (set here)',gm('loads.pos')],
-6670,19 +4831,0  [deleted 19 lines: first "const ST_APP='stgirder', BP=()=>window.BridgeProjects;" ... last "function saveLastProjId(id){ if(BP()) BP().setCurrent(id); }"]
@@ -6693,16 +4836,112 @@ function mergeInputs(p){ if(!p) return null;
-/* ================= APP ================= */
-/* ═══ Shared design-beam chip ═══════════════════════════════════════════════
-   Backed by BridgeBeam (the block in this file's <head>). The beam picked here
-   is the beam the whole suite uses: the live-load distribution factors and the
-   dead-load distribution in the LL & DL app, the DFs pulled into this design,
-   and the UDLs pushed to the MCT Loads tab. Changing it in any app — or in
-   another browser tab — moves every app to the same beam.
-   The roster comes from the LL & DL Distribution app, which is the only one
-   that knows the full cross-section, so this chip degrades to a read-only
-   label until that app has been run once.
-   ═══════════════════════════════════════════════════════════════════════════ */
-function useDesignBeam(){
-  const BB=(typeof window!=='undefined'&&window.BridgeBeam)||null;
-  const [,setTick]=useState(0);
-  useEffect(()=>{ if(!BB) return undefined; return BB.onChange(()=>setTick(t=>t+1)); },[BB]);
-  return {BB, sel:BB?BB.get():null, roster:BB?BB.roster():null};
+/* ================= DISCONNECT (engineer decision 2026-10-19) =================
+   ST-Girder is connected to GirderDetail only. It no longer exchanges data with the MCT Generator,
+   PS-Beam, LL & DL Distribution or Bridge Substructure Loading. Saved ST-Girder data that came from
+   those tools is cleared when the page opens (and when an older ST-Girder JSON file is imported), and
+   a notice lists exactly what was removed (fixlog/stgirder.md DISC). Nothing here changes a result of
+   the built-in analysis or of GirderDetail demands; it only removes values the other tools supplied.
+     stgDisconnect(inp) -> {inp, items}: the cleaned copy of a saved session and the list of removals.
+     stgPurgeOwnCopies() -> items: removes ST-Girder's own published copies that other tools list.
+   The notice is kept in this tool's own key stgirder.disconnect.v1 until it is dismissed. */
+const STG_NS='bridgeSuite.v1.', STG_DISC_KEY='stgirder.disconnect.v1';
+function stgLS(k){ try{ const s=window.localStorage.getItem(k); return s?JSON.parse(s):null; }catch(e){ return null; } }
+function stgDisconnect(inp0){
+  const inp=JSON.parse(JSON.stringify(inp0)), items=[], L=inp.loads||(inp.loads={}), D=DEFAULTS.loads;
+  const f3=v=>fmt(+v,3), near=(a,b)=>b!=null&&isFinite(+a)&&Math.abs(+a-b)<5e-5;
+  const locks=((stgLS(STG_NS+'locks')||{}).channels)||{}, locked=ch=>!!(locks[ch]&&locks[ch].locked);
+  const snap=stgLS(STG_NS+'lockSnap.stgirder')||{};
+  const snapOf=(ch,k)=>(snap[ch]&&snap[ch].data&&typeof snap[ch].data[k]==='number'&&isFinite(snap[ch].data[k]))?snap[ch].data[k]:null;
+  // 1. Imported demands that are not GirderDetail's (MCT Generator hand-off, MIDAS / PS-Beam / steel-beam envelope files)
+  const e=inp.external;
+  if(e&&typeof e==='object'&&!extFromGD(e)){
+    const n=Array.isArray(e.stations)?e.stations.length:0;
+    items.push('Imported demands from '+(e.producer||e.generatedBy||'MCT Generator / MIDAS')+(e.project?' (project "'+e.project+'")':'')
+      +(e.member&&e.member.key?', member '+e.member.key:'')+', '+n+' station'+(n===1?'':'s')+': removed. ST-Girder runs its built-in simple-span analysis again'
+      +' (span length L = '+fmt(+inp.geom.L,2)+' ft and the plates are kept as they were; check them).');
+    inp.external=null;
+  }
+  // 2. LL & DL Distribution: distribution factors (pulled or followed under a lock). A value counts as LL & DL's when it equals a
+  //    published factor (to 4 decimals), or when the channel is locked or ST-Girder holds a pre-lock snapshot (it followed LL & DL).
+  const lp=stgLS(STG_NS+'lldf'), pairs=[];
+  if(lp&&typeof lp==='object'){ const add=(g,gn)=>{ if(g&&g.gM!=null) pairs.push({m:+(+g.gM).toFixed(4), v:g.gV!=null?+(+g.gV).toFixed(4):null, n:(gn&&gn.gM!=null)?+(+gn.gM).toFixed(4):+(+g.gM).toFixed(4)}); };
+    const G=lp.governing||{}, Gn=lp.governingNeg||{};
+    add(G.interior,Gn.interior); add(G.exterior,Gn.exterior);
+    Object.keys(G.byBeam||{}).forEach(k=>add(G.byBeam[k],(Gn.byBeam||{})[k])); }
+  const llLock=locked('lldf')||!!snap.lldf;
+  if(L.dfAuto===false&&(pairs.some(p=>near(L.dfm,p.m)&&near(L.dfv,p.v))||llLock)){
+    items.push('Live load distribution factors DF_m = '+f3(L.dfm)+', DF_v = '+f3(L.dfv)+' (MANUAL, from LL & DL Distribution): replaced by ST-Girder’s own AASHTO LRFD 4.6.2.2 factors (Distribution factors: AUTO TYPE (a)).');
+    L.dfAuto=true;
+  }
+  const extKs=['extDFpos','extDFneg','extDFv','extLLmpf'];
+  if(extKs.some(k=>+L[k]!==D[k])&&(pairs.some(p=>near(L.extDFpos,p.m)&&near(L.extDFv,p.v))||llLock)){
+    const was=extKs.map(k=>f3(L[k]));
+    extKs.forEach(k=>{ const s=snapOf('lldf',k); L[k]=s!=null?s:D[k]; });
+    items.push('Imported-LL multipliers (DF +M, DF −M, DF V, multiple presence) '+was.join(', ')+' from LL & DL Distribution: set to '+extKs.map(k=>f3(L[k])).join(', ')
+      +(snapOf('lldf','extDFpos')!=null?' (your values from before the lock)':' (ST-Girder defaults)')+'.');
+  }
+  if(+L.fatM>0||+L.fatV>0){
+    items.push('Single-lane fatigue distribution factor override'+(+L.fatM>0&&+L.fatV>0?'s':'')+' from LL & DL Distribution ('
+      +[+L.fatM>0?'moment '+f3(L.fatM):'',+L.fatV>0?'shear '+f3(L.fatV):''].filter(Boolean).join(', ')+'): removed; the Fatigue checks use ST-Girder’s own single-lane estimate (DF ÷ 1.2) again, or the fatigue envelopes of GirderDetail demands.');
+    L.fatM=0; L.fatV=0;
+  }
+  // 3. LL & DL Distribution: dead loads DC2 (barrier / SIDL) and DW (wearing surface) per girder
+  const dp=stgLS(STG_NS+'dlLoads'), by={};
+  if(dp&&Array.isArray(dp.cases)) dp.cases.forEach(c=>{ if(c&&c.key) by[c.key]=+(+(+c.udl||0)).toFixed(4); });
+  const dlLock=locked('dlLoads')||!!snap.dlLoads;
+  [['wBar','DC2','DC2 barrier / SIDL (per girder)'],['wDW','DW','DW wearing surface (per girder)']].forEach(([k,c,lab])=>{
+    if(!(near(L[k],by[c])||(dlLock&&(!dp||by[c]!=null)))) return;   // under a lock only the published cases were applied
+    const s=snapOf('dlLoads',k), to=s!=null?s:D[k];
+    if(+L[k]===+to) return;
+    items.push(lab+' '+f3(L[k])+' klf from LL & DL Distribution: set to '+f3(to)+' klf ('+(s!=null?'your value from before the lock':'ST-Girder default')+'). Enter the barrier / wearing surface load for this girder on the Inputs tab, Loads.');
+    L[k]=to;
+  });
+  // 4. Shared design beam (set in LL & DL or MCT): the interior / exterior position no longer follows it
+  if(L.posAuto!==false){
+    const db=stgLS(STG_NS+'designBeam');
+    if(db&&db._schema==='bridge-design-beam'&&db.type){
+      items.push('Girder position followed the shared design beam '+(db.label||('B'+db.index))+(db.clsLabel?' ('+db.clsLabel+')':'')+': it is now set in ST-Girder and kept as '+(L.pos==='exterior'?'exterior':'interior')+'.');
+      L.posAuto=false;
+    }
+  }
+  return {inp,items};
+}
+function stgPurgeOwnCopies(){
+  const out=[], has=k=>{ try{ return window.localStorage.getItem(k)!=null; }catch(e){ return false; } }, rm=k=>{ try{ window.localStorage.removeItem(k); }catch(e){} };
+  const at=k=>{ try{ return window.localStorage.getItem(k); }catch(e){ return null; } };
+  const mine=(ch,what)=>{ const k=STG_NS+ch, p=stgLS(k);
+    if(!(p&&p.producer==='ST-Girder')) return;
+    rm(k); const u=k+'.updatedAt', also=(at(u)!=null&&at(u)===p.producedAt);
+    if(also) rm(u);
+    out.push(what+' sent by ST-Girder: removed (key '+k+(also?' and '+u:'')+').'); };
+  if(has(STG_NS+'superReactions.by.stgirder')){ rm(STG_NS+'superReactions.by.stgirder');
+    out.push('Reactions sent to Bridge Substructure Loading: ST-Girder’s copy removed (key '+STG_NS+'superReactions.by.stgirder).'); }
+  mine('superReactions','Reactions on the Substructure Loading channel');
+  mine('capacity','Capacity (φM_n, φV_n) for the MCT rating');
+  mine('lldfGeom','Girder geometry for LL & DL Distribution');
+  return out;
+}
+/* ST-Girder designs in the shared project registry (MCT's combined project). ST-Girder no longer opens or saves them there;
+   the notice lists them once so each can be opened here or exported as an ST-Girder JSON file (nothing is deleted). */
+function stgSlices(){ const reg=stgLS(STG_NS+'projects'); if(!reg||typeof reg!=='object') return [];
+  return Object.keys(reg).filter(id=>reg[id]&&reg[id].slices&&reg[id].slices.stgirder&&typeof reg[id].slices.stgirder==='object')
+    .map(id=>({id, name:String(reg[id].name||'Untitled'), savedAt:String(reg[id].savedAt||'')})); }
+function stgSliceOf(id){ const reg=stgLS(STG_NS+'projects'); const e=reg&&reg[id]; return (e&&e.slices&&e.slices.stgirder&&typeof e.slices.stgirder==='object')?e.slices.stgirder:null; }
+function stgDiscRead(){ const r=stgLS(STG_DISC_KEY); return (r&&typeof r==='object')?r:null; }
+function stgDiscWrite(r){ try{ window.localStorage.setItem(STG_DISC_KEY,JSON.stringify(r)); }catch(e){} }
+/* Adds removals to the pending notice (kept until dismissed) and returns it. */
+function stgDiscAdd(items,projects){
+  const cur=stgDiscRead(), pend=!!(cur&&cur.pending);
+  const r={v:1, pending:true, at:new Date().toISOString(),
+    items:[...(pend&&Array.isArray(cur.items)?cur.items:[]),...items],
+    projects:(pend&&Array.isArray(cur.projects)&&cur.projects.length)?cur.projects:(projects||[])};
+  stgDiscWrite(r); return r;
+}
+/* On open: clean the saved session, remove the published copies, list the shared-project designs (first open only). */
+function stgBoot(canSave){
+  if(!canSave) return {inp:DEFAULTS, notice:null};
+  const raw=loadSaved(); let inp=mergeInputs(raw)||DEFAULTS, items=[];
+  if(raw){ const d=stgDisconnect(inp); inp=d.inp; items=d.items; if(items.length) saveInputs(inp); }
+  items=items.concat(stgPurgeOwnCopies());
+  const rec=stgDiscRead(), projects=rec?[]:stgSlices();
+  if(items.length||projects.length) return {inp, notice:stgDiscAdd(items,projects)};
+  if(!rec) stgDiscWrite({v:1, pending:false, at:new Date().toISOString(), items:[], projects:[]});
+  return {inp, notice:(rec&&rec.pending)?rec:null};
@@ -6710,19 +4949,19 @@ function useDesignBeam(){
-function BeamChip({nb,setBy}){
-  const {BB,sel,roster}=useDesignBeam();
-  if(!BB) return null;
-  const beams=(roster&&roster.beams)||[];
-  const mm=BB.mismatch?BB.mismatch(nb):null;
-  return (
-    <span className="beamchip" title={'Design beam — shared by every app in the suite. '
-      +'Set the beam layout and the MassDOT classification in the LL & DL Distribution app; '
-      +'the distribution factors, the dead load and the MCT beam loads all follow this beam.'}>
-      <span className="bc-k">Design beam</span>
-      {beams.length
-        ? <select value={sel?sel.index:''} onChange={e=>BB.set(+e.target.value,null,setBy||'')}>
-            {beams.map(b=><option key={b.i} value={b.i}>{b.label} · {b.ab||b.clsLabel||''}</option>)}
-          </select>
-        : <span className="bc-v" title="No beam roster published yet — open the LL & DL Distribution app and recalculate.">
-            {sel?sel.label:'—'} <span className="bc-warn">no roster</span></span>}
-      {mm&&<span className="bc-warn" title={'This app is set up for '+mm.mine+' girders but the published roster has '
-        +mm.roster+'. Re-run the LL & DL Distribution app on the current layout.'}>⚠ {mm.mine}≠{mm.roster}</span>}
-    </span>);
+function StgDiscNotice({rec,onDismiss,onOpen}){
+  if(!rec) return null;
+  const exp=p=>{ const s=stgSliceOf(p.id); if(!s){ alert('The design "'+p.name+'" is no longer in the browser storage.'); return; }
+    const blob=new Blob([JSON.stringify({...mergeInputs(s),_schema:'stgirder'},null,1)],{type:'application/json'});
+    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=(p.name||'stgirder').replace(/\W+/g,'_')+'_stgirder.json'; a.click(); };
+  return <div className="callout warn noprint" id="stg-disc" style={{marginTop:14,marginBottom:0}}>
+    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',flexWrap:'wrap',gap:8}}>
+      <b>ST-Girder now takes data from GirderDetail only</b>
+      <button className="btn sm ghost" onClick={onDismiss}>✕ dismiss (do not show again)</button></div>
+    <div style={{fontSize:11.5,marginTop:4,lineHeight:1.6}}>
+      Engineer decision 2026-10-19: ST-Girder no longer exchanges data with the MCT Generator, PS-Beam, LL &amp; DL Distribution or Bridge Substructure Loading. Demands come only from GirderDetail (<b>Pull from GirderDetail</b>, or <b>Import</b> of its hand-off file); otherwise ST-Girder uses its own inputs and its built-in simple-span analysis.
+      {(rec.items||[]).length?<React.Fragment> Saved data that came from those tools was removed:
+        <ul style={{margin:'4px 0 0 18px',padding:0}}>{rec.items.map((t,i)=><li key={i}>{t}</li>)}</ul></React.Fragment>:null}
+      {(rec.projects||[]).length?<div style={{marginTop:6}}>ST-Girder designs saved in shared MCT projects (ST-Girder no longer opens or saves them there; they are still in this browser’s storage). Open one here (replaces the current inputs; it is cleaned the same way) or save it as an ST-Girder JSON file for <b>Import</b>:
+        <ul style={{margin:'4px 0 0 18px',padding:0}}>{rec.projects.map(p=><li key={p.id}>{p.name}{p.savedAt?' (saved '+p.savedAt.slice(0,10)+')':''}{' '}
+          <button className="btn sm ghost" style={{padding:'1px 8px'}} onClick={()=>onOpen(p)}>Open here</button>{' '}
+          <button className="btn sm ghost" style={{padding:'1px 8px'}} onClick={()=>exp(p)}>Export JSON</button></li>)}</ul>
+        These buttons are shown only until this notice is dismissed.</div>:null}
+    </div></div>;
@@ -6730,0 +4970 @@ function BeamChip({nb,setBy}){
+/* ================= APP ================= */
@@ -6733,2 +4973,6 @@ function App(){
-  const [saveFail,setSaveFail]=useState('');   // '' | 'session' | 'project' — last autosave write failed (STG-S8)
-  const [inp,setInpRaw]=useState(()=>canSave?(mergeInputs(loadSaved())||DEFAULTS):DEFAULTS);
+  const [saveFail,setSaveFail]=useState('');   // '' | 'session' — last autosave write failed (STG-S8)
+  // DISC (2026-10-19): the saved session is cleaned of MCT / LL & DL data on open; the notice lists what was removed
+  const [boot]=useState(()=>stgBoot(canSave));
+  const [inp,setInpRaw]=useState(()=>boot.inp);
+  const [disc,setDisc]=useState(()=>boot.notice);
+  const dismissDisc=()=>{ const r=stgDiscRead(); stgDiscWrite({...(r||{v:1,items:[],projects:[]}),pending:false}); setDisc(null); };
-6752,17 +4995,0  [deleted 17 lines: first "// ── Follow the suite-wide design beam ──────────────────────────────────────" ... last "const [handoff,setHandoff]=useState(null);"]
-6772,211 +4998,0  [deleted 211 lines: first "const checkHandoff=()=>{ const BH=window.BridgeHandoff; if(!BH){ return; }" ... last "};"]
@@ -6985,22 +5001,2 @@ function App(){
-  // ── Auto-participate in the shared Bridge Project (created & managed only in MCT) ──
-  // ST-Girder has no Save / New / Delete / project-dropdown of its own. It autosaves its
-  // slice into whatever project is active, follows external project switches live, and
-  // keeps Export/Import JSON for portable single-design files + the per-session autosave.
-  const [curProjId,setCurProjIdRaw]=useState(()=>canSave&&BP()?BP().current():null);
-  const [activeName,setActiveName]=useState(()=>{ const id=canSave&&BP()?BP().current():null; const p=id&&BP().get(id); return p?p.name:''; });
-  const adoptProject=id=>{
-    if(!id||!BP()){ setCurProjIdRaw(null); setActiveName(''); return; }
-    const e=BP().get(id), slice=BP().getSlice(id,ST_APP);
-    setCurProjIdRaw(id); setActiveName(e?e.name:'');
-    if(slice){ const merged=mergeInputs(slice); setInp(merged);
-      try{ const dem=BP().getDemands(id); if(dem&&!merged.external&&window.BridgeHandoff) window.BridgeHandoff.publish(dem); }catch(e){}
-    } };
-  // Follow the active project when it's switched from another app (e.g. MCT loads a project).
-  useEffect(()=>{ if(!canSave||!BP())return;
-    const onStorage=e=>{ if(!e.key||e.key===BP().K_CUR||e.key===BP().K_PROJ){
-      const cur=BP().current();
-      if(cur!==curProjId){ adoptProject(cur); }
-      else { const p=cur&&BP().get(cur); setActiveName(p?p.name:''); } } };
-    window.addEventListener('storage',onStorage);
-    return ()=>window.removeEventListener('storage',onStorage);
-  },[curProjId]);
+  // ST-Girder saves its session in its own key (stgirder.session) only. Since 2026-10-19 (DISC) it no longer saves into,
+  // or follows, the shared bridge project of the MCT Generator.
-7009,3 +5004,0  [deleted 3 lines: first "// Contribute to the ACTIVE shared project only — never create or rename one (that's MCT's job)." ... last "try{ if(BP()){ const cur=BP().current(); if(cur&&BP().get(cur)) okP=!!BP().saveS"]
@@ -7013 +5006 @@ function App(){
-      setSaveFail(!okS?'session':(!okP?'project':''));
+      setSaveFail(!okS?'session':'');
@@ -7014,0 +5008,5 @@ function App(){
+  // An ST-Girder design from a shared MCT project, opened from the notice: cleaned like the saved session.
+  const openSlice=p=>{ const s=stgSliceOf(p.id); if(!s){ alert('The design "'+p.name+'" is no longer in the browser storage.'); return; }
+    if(!window.confirm('Open the ST-Girder design saved in the shared project "'+p.name+'"? It replaces the current inputs (Undo restores them).')) return;
+    const d=stgDisconnect(mergeInputs(s)); setInp(d.inp);
+    if(d.items.length) setDisc(stgDiscAdd(d.items.map(t=>'"'+p.name+'": '+t))); };
@@ -7025,6 +5023,4 @@ function App(){
-      // external analysis envelope (MIDAS-style; PS-Girder or steel-beam schema)? attach, don't replace inputs.
-      if(p._schema==='psbeam-external-demands'||p._schema==='stgirder-external-demands'||p._schema==='steelbeam-external-demands'){
-        const spans=externalSpans(p);
-        const sel=spans[0]||{idx:1,x0:0,x1:(p.member&&p.member.totalLength)||inp.geom.L,len:inp.geom.L};
-        const secNew=zonesToSec(p,sel,inp.sec);          // auto-populate plates from section.zones if present
-        setInp({...inp, external:{...p,_selSpan:sel}, geom:{...inp.geom, L:sel.len}, ...(secNew?{sec:secNew}:{})});
+      // Any other demands file (MCT Generator / MIDAS, PS-Beam or steel-beam envelope) is refused (DISC, engineer decision 2026-10-19).
+      if(p._schema==='psbeam-external-demands'||p._schema==='stgirder-external-demands'||p._schema==='steelbeam-external-demands'||Array.isArray(p.stations)){
+        alert('ST-Girder now takes demands only from GirderDetail; this file is from '+(p.producer||p.generatedBy||'another tool (MCT Generator / MIDAS)')+' and was not loaded. Nothing was changed.\n\n'
+          +'Send the girder from GirderDetail (Steel Bridge Beam Modules.html, Structural analysis: Send to ST-Girder) and use "Pull from GirderDetail", or import its "Export hand-off (JSON)" file. Without GirderDetail demands ST-Girder uses its built-in simple-span analysis.');
@@ -7033 +5029,3 @@ function App(){
-      setInp(mergeInputs(p)); }catch(err){alert('Invalid file: '+err.message);} }; rd.readAsText(f); };
+      // An ST-Girder JSON file (Export JSON): data that came from the MCT Generator or LL & DL is cleared, as on open, and listed.
+      const d=stgDisconnect(mergeInputs(p)); setInp(d.inp);
+      if(d.items.length) setDisc(stgDiscAdd(d.items.map(t=>'File '+f.name+': '+t))); }catch(err){alert('Invalid file: '+err.message);} }; rd.readAsText(f); };
@@ -7092 +5090 @@ function App(){
-    if(g.position==='interior'||g.position==='exterior'){ ld.pos=g.position; ld.posAuto=false; chg('Girder position',cur.loads.pos,g.position,'(no longer follows the design-beam chip)'); }
+    if(g.position==='interior'||g.position==='exterior'){ ld.pos=g.position; ld.posAuto=false; chg('Girder position',cur.loads.pos,g.position); }
-7148,10 +5145,0  [deleted 10 lines: first "/* Shared project info (HANDOFF.md §4.1): title block <-> shared fields. Girder ID is not a bridge ID, so it i" ... last "const bxExportRx=()=>{ if(window.BXSuperRx) window.BXSuperRx.exportJSON(()=>bxSu"]
@@ -7168,25 +5156 @@ function App(){
-    {handoff&&(handoff.version>HANDOFF_SUPPORTED_VERSION
-      ? <div className="callout warn" style={{marginTop:14,marginBottom:0}}>
-          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',flexWrap:'wrap',gap:8}}>
-            <b>⚠ Analysis output is newer than this app</b>
-            <button className="btn sm ghost" onClick={dismissHandoff}>✕ dismiss</button></div>
-          <div style={{fontSize:11.5,marginTop:4,lineHeight:1.6}}>The MCT Generator published schema <b>v{handoff.version}</b>; this ST-Girder build understands <b>v{HANDOFF_SUPPORTED_VERSION}</b>. Update ST-Girder to load it, or use JSON Import with a matching file.</div>
-        </div>
-      : <div className="callout" style={{marginTop:14,marginBottom:0,borderLeftColor:'#ea580c',background:'#fff7ed'}}>
-          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',flexWrap:'wrap',gap:8}}>
-            <b>New analysis data available</b>
-            <button className="btn sm ghost" onClick={dismissHandoff}>✕ dismiss</button></div>
-          <div style={{fontSize:11.5,marginTop:4,lineHeight:1.6}}>
-            From <b>{handoff.payload.producer||'MCT Generator'}</b>{handoff.payload.project?' · '+handoff.payload.project:''}
-            {handoff.payload.member&&handoff.payload.member.key?' · '+handoff.payload.member.key:''} · {handoff.payload.stations?handoff.payload.stations.length:0} stations · LL: <b>{handoff.payload.liveLoadType||'HL-93'}</b>
-            {handoff.payload.section&&handoff.payload.section.zones&&handoff.payload.section.zones.length?' · plate geometry included':''}.
-            Loading replaces the <b>imported demands</b> (and seeds plate geometry) — your materials and design settings stay.
-            <div className="btnrow" style={{marginTop:8}}>
-              <button className="btn sm pri" onClick={()=>adoptHandoff(handoff.payload)}>Load these demands</button>
-              {BLU.LockToggle&&<BLU.LockToggle ch="demands" onToggle={()=>{
-                // One click: take these demands and keep taking them.
-                adoptHandoff(handoff.payload); toggleDemandsLock(true); }}/>}
-              <button className="btn sm ghost" onClick={dismissHandoff}>Not now</button>
-            </div>
-          </div>
-        </div>)}
+    <StgDiscNotice rec={disc} onDismiss={dismissDisc} onOpen={openSlice}/>
-7206,45 +5169,0  [deleted 45 lines: first "{geomChanges&&!demandsLocked&&(" ... last ")}"]
-7267,5 +5185,0  [deleted 5 lines: first "<button className="btn sm ghost" onClick={bxUseProject} title="Fill Project, By, Date and Job No. from the pro" ... last "<span style={{width:1,height:20,background:'var(--line)',margin:'0 3px'}}></span"]
-7279,15 +5192,0  [deleted 15 lines: first "{canSave&&<React.Fragment>" ... last "<button className="btn sm ghost" onClick={bxExportRx} title="Save the same react"]
@@ -7305,2 +5204 @@ function App(){
-    {saveFail&&<div className="callout warn noprint" style={{marginTop:14}}><b>Autosave failed.</b> The last change could not be written to browser storage ({saveFail==='session'?'ST-Girder session key stgirder.session':'the active shared project'}). The storage is probably full: every tool opened from this folder shares one browser storage area (about 5 MB). Use <b>Export JSON</b> now to keep your work, then free space (for example delete old projects in the MCT app). This message clears on the next successful save.</div>}
-    <LockAutoSync inp={inp} set={setInp}/>
+    {saveFail&&<div className="callout warn noprint" style={{marginTop:14}}><b>Autosave failed.</b> The last change could not be written to browser storage (ST-Girder session key stgirder.session). The storage is probably full: every tool opened from this folder shares one browser storage area (about 5 MB). Use <b>Export JSON</b> now to keep your work, then free space (for example delete old projects in the other tools). This message clears on the next successful save.</div>}
@@ -7344 +5242 @@ function App(){
-        {tab==='rating'&&<RatingTab R={R} inp={inp} set={setInp} onSendCapacity={publishCapacity} capLocked={capLocked} onToggleCapLock={toggleCapLock}/>}
+        {tab==='rating'&&<RatingTab R={R} inp={inp} set={setInp}/>}
-7359,7 +5256,0  [deleted 7 lines: first "<script>" ... last "</script>"]
```


## 2026-10-19 — PR: claude/aashto10-stgirder (A10: stud shear connectors to AASHTO LRFD 10th Ed. (2024), renumbered citations, edition statement follows the owner; inventory 2026-10-19; RESULT CHANGE, awaiting engineer approval; PR link added after merge)

All provisions below were checked against the AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024) text (cited only; nothing copied).

### A10-1. Stud nominal and factored shear resistance Q_n, Q_r   [RESULT CHANGE: fewer studs credited (unconservative before where F_u governed)]
- **Where:** `computeAll`, block `/* ---------- Shear connectors (6.10.10) ---------- */`, anchor `const Qn=`; display `connStrDeriv` (variable table row `Q_r`, the `Q_n` equation line, two notes).
- **Before:** `const Qn=Math.min(0.5*Asc*sqrt(deck.fc*EcDeck), Asc*Fustud), phisc=0.85, Qr=phisc*Qn;`
- **After:** `const Qn=0.70*Asc*Fustud, phisc=1.00, Qr=phisc*Qn;` (comment cites Eq. 6.10.10.4.3-1, 6.4.4, 6.5.4.2, Eq. 6.10.10.4.1-1); `phisc` and `Fustud` added to `R.conn` for the derivation.
- **Problem:** Q_n and φ_sc were the 9th Ed. values. 10th Ed.: Q_n = 0.70·A_sc·F_u (Eq. 6.10.10.4.3-1, no concrete term), φ_sc = 1.00 (6.5.4.2). Net Q_r goes from 0.85·min(0.5A_sc√(f′_cE_c), A_scF_u) to 0.70·A_sc·F_u: 17.6 % lower where F_u governed before (the usual case), so the required number of studs rises by 0.85/0.70 = 1.214.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) Art. 6.10.10.4.1 (Eqs. 6.10.10.4.1-1, -2), 6.10.10.4.3 (Eq. 6.10.10.4.3-1), 6.5.4.2 (φ_sc), 6.4.4 (F_u = 60 ksi).
- **Check case** (GirderDetail payload `def15_AASHTO_G2`, girder G2, span 1 of 3, right side to the pier): d = 0.875 in, A_sc = π(0.875)²/4 = 0.6013 in², F_u = 60 ksi, f′_c = 4.0 ksi, E_c = 4266.2 ksi, P = P_p + P_n = 3100.8 + 1641.6 = 4742.4 kip, 198 studs provided.
  - Before: 0.5(0.6013)√(4.0 × 4266.2) = 39.28 kip; A_scF_u = 36.08 kip → Q_n = 36.08; Q_r = 0.85 × 36.08 = 30.67 kip; n = 4742.4/30.67 = 154.6 → ratio 154.6/198 = 0.781.
  - After: Q_n = 0.70 × 0.6013 × 60 = 25.26 kip; Q_r = 1.00 × 25.26 = 25.26 kip; n = 4742.4/25.26 = 187.8 → ratio 0.948.
  - Simple-span requirement (P = 3100.8 kip, shown above the continuous one): n = 101.1 → 122.8.
- **Note:** Eq. 6.10.10.4.3-1 presumes the h/d limit of 6.10.10.1.1 (≥ 5.0 normal weight, ≥ 7.0 lightweight). The tool does not check h/d; the derivation now shows h/d (6.00/0.875 = 6.86 in the check case). See open items.

### A10-2. Stud fatigue resistance Z_r   [RESULT CHANGE: larger permitted pitch in Fatigue II; Fatigue I essentially unchanged; stud limit state chosen on its own crossover]
- **Where:** `computeAll`, anchor `const SC92=` (replaces the block that started `/* 6.10.10.2 -- the stud resistance branch has to be the one`), the stud loop anchor `Vf=gammaFatSC*VfU`, the `const conn={` object; display `connFatDeriv` (variable rows, new sub-steps 1 and 2, notes); `DL_T.fatn` (new link target, Fatigue tab Step 1 card `id="stg-d-fatn"`, report tag `fat.n`); Fatigue tab Step 2 note; Inputs tab limit-state hint.
- **Before:** `const alphaF=Math.max(34.5-4.28*(Math.log(Nfat)/Math.LN10),0); const dStud2=Math.pow(+inp.conn.studD,2); const Zr=fatInf? 5.5*dStud2 : alphaF*dStud2;` and `Vf=gammaFat*VfU` (the flange detail category's Fatigue I/II choice and γ).
- **After:**
  ```js
  const SC92={A:1040e8, m:5, TH:7.0};
  const adttSLcrossSC=SC92.A/(Math.pow(fatGRatio*SC92.TH,SC92.m)*365*lifeYr*nCyc);
  const recFatISC=adttSL>=adttSLcrossSC;
  const fatInfSC=lsMode==='auto'? recFatISC : (lsMode==='I');
  const gammaFatSC=fatInfSC?1.75:0.80;
  const FnSCII=Math.pow(SC92.A/Nfat,1/SC92.m), FnSC=fatInfSC? SC92.TH : FnSCII;
  const Zr=FnSC*Asc;
  ```
  and `Vf=gammaFatSC*VfU`; `R.conn.gammaFat`/`fatInf` now carry the stud values (`gammaFatSC`, `fatInfSC`); `alphaF` removed from `R.conn`.
- **Problem:** Z_r = 5.5d² (Fatigue I) / αd², α = 34.5 − 4.28 log N (Fatigue II) is the 9th Ed. form. 10th Ed.: Z_r = (ΔF)_n·A_sc (Eq. 6.10.10.2-1) with (ΔF)_n from 6.6.1.2.5 using Condition 9.2 of Table 6.6.1.2.3-1 (A = 1040×10⁸ ksi⁵, m = 5, (ΔF)_TH = 7.0 ksi, 75-yr (ADTT)_SL equivalent to infinite life 11,320). Per 6.6.1.2.5 the Fatigue I / II choice is made for the detail under consideration, so the studs use their own crossover (Eq. C6.6.1.2.3-1 with m = 5, divided by n and scaled by 75/Y as the tool already does for the flange category); before, the studs followed the flange category's crossover (Cat. C: 1,682/day). A manual Fatigue I / II selection on the Inputs tab still applies to the studs. The pitch equation p ≤ n_t·Z_r/V_sr (Eq. 6.10.10.1.2-1) and V_sr = V_f·Q/I (Eq. 6.10.10.1.2-4) are unchanged. Fatigue I: 7.0·πd²/4 = 5.498d² vs 5.5d² (−0.04 %). Fatigue II: (A/N)^(1/5)·A_sc is higher than αd² at the usual N (ADTT_SL 1000: +53 %). Between the two crossovers (1,682 < (ADTT)_SL < 11,322 for Cat. C, n = 1, 75 yr), AUTO now designs the studs for Fatigue II (γ 0.80) instead of Fatigue I (γ 1.75): less conservative, permitted by 6.6.1.2.5.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) Art. 6.10.10.2 (Eq. 6.10.10.2-1), 6.6.1.2.5 (Eqs. 6.6.1.2.5-1, -2, -3), Table 6.6.1.2.3-1 Condition 9.2, Eq. C6.6.1.2.3-1, 6.10.10.1.2 (Eqs. 6.10.10.1.2-1, -4), Table 3.4.1-1 (γ 1.75 / 0.80).
- **Check case** (same payload; d = 0.875 in, A_sc = 0.6013 in², 3 studs per row, pitch 12 in, (ADTT)_SL = 1000, n = 1, Y = 75; governing station x = 0: V_+ − V_− = 48.338 kip (imported, IM and DF in), Q = 1697.7 in³, I = 105,501 in⁴):
  - N = 365 × 75 × 1 × 1000 = 27,375,000. Stud crossover = 1040×10⁸ / [(0.80/1.75 × 7.0)⁵ × 365 × 75 × 1] = 11,322 > 1000 → Fatigue II, γ = 0.80 (before: Cat. C crossover 1,682 > 1000 → Fatigue II as well). V_f = 0.80 × 48.338 = 38.67 kip; V_sr = 38.67 × 1697.7/105,501 = 0.6223 kip/in.
  - Before: α = 34.5 − 4.28 log(27,375,000) = 34.5 − 4.28 × 7.4374 = 2.668; Z_r = 2.668 × 0.875² = 2.043 kip; p_req = 3 × 2.043/0.6223 = 9.85 in → 12 in N.G. (1.218).
  - After: (ΔF)_n = (1040×10⁸/27,375,000)^(1/5) = 3799.1^0.2 = 5.199 ksi; Z_r = 5.199 × 0.6013 = 3.126 kip; p_req = 3 × 3.126/0.6223 = 15.07 in → 12 in OK (0.796).
  - Fatigue I check (same girder, (ADTT)_SL = 20,000 entered in the page): γ = 1.75, V_sr = 1.3612 kip/in; before Z_r = 5.5 × 0.7656 = 4.211 kip, p_req = 9.280 in; after Z_r = 7.0 × 0.6013 = 4.209 kip, p_req = 9.277 in.
  - Between crossovers ((ADTT)_SL = 5,000): before Fatigue I (≥ 1,682), Z_r = 4.211, V_sr = 1.3612, p_req = 9.28 in; after Fatigue II (< 11,322), N = 136,875,000, (ΔF)_n = 3.768 ksi, Z_r = 2.266 kip, V_sr = 0.6223, p_req = 10.92 in.

### A10-3. Renumbered citations (10th Ed.)   [wording only — no result change]
- `flangeFnc` comments (anchors `(6.10.8.2.3-9 uses Dc,` and `// 6.10.8.2.3-9 (Dc)`): "6.10.8.2.3-9" → "Eq. 6.10.8.2.3b-3" (r_t with D_c). The comment "(9th Ed.: 1.0 r_t)" on L_p is kept: it is historical (L_p = 1.1 r_t, Eq. 6.10.8.2.3a-4, in use).
- Cycles per truck passage n: "Table 6.6.1.2.5-2" → "Table 6.6.1.2.5-1" (`DEFAULTS.fatigue.ncyc` comment, `const nCyc` comment, Inputs tab label ×2, Fatigue tab Step 1 row).
- Detail constant A and (ΔF)_TH: "Table 6.6.1.2.5-1" / "Table 6.6.1.2.5-3" → "Table 6.6.1.2.3-1" (`const CAT=` comment, Fatigue tab Step 3 rows).
- Infinite-life crossover: "basis of Table 6.6.1.2.3-2" → "Eq. C6.6.1.2.3-1, the (ADTT)_SL equivalent to infinite life in Table 6.6.1.2.3-1" (`adttSLcross` comment, Fatigue tab Step 2 note). The 10th Ed. has no Tables 6.6.1.2.3-2, 6.6.1.2.5-2 or 6.6.1.2.5-3.
- Stud strength note: "(6.10.10.4.2; straight girder, radial force F_p = 0 — verify equation numbers against the 10th Ed.)" → "(6.10.10.4.2, Eqs. 6.10.10.4.2-5 to -8: P_T = P_p + P_n; straight girder, radial force F_T = 0, so P = P_T)" (verified).
- Stud derivation: "Eq. 6.10.10.2-1" now labels Z_r = (ΔF)_n A_sc; Eq. 6.10.10.1.2-1 and 6.10.10.4.1-2 named where used.

### A10-4. Edition statement follows the owner   [wording only — no result change]
- **Where:** new `OWN_ED`, `edOwn`, `edNote` after `const lfS=`; `OwnBanner` header; report Objectives first paragraph (anchor `10th Ed. (2024){edNote(R)}, Section 6:`); report footer (anchor `Prepared with ST-Girder (AASHTO LRFD BDS 10th Ed. (2024)`).
- **Before:** "AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024)" / "Prepared with ST-Girder (AASHTO LRFD BDS 10th Ed.)" whatever the owner.
- **After:** no owner or owner AASHTO: unchanged text (footer adds "(2024)"). Owner RIDOT / MassDOT / CTDOT (from GirderDetail's `ownerRules.owner`): "… 10th Ed. (2024) with the <owner> rules on top (<manual> is written to AASHTO LRFD 10th Ed. | 9th Ed.)"; banner: "code basis: AASHTO LRFD 10th Ed. (2024) with the owner rules on top (the manual is written to AASHTO LRFD …)"; footer: "… 10th Ed. (2024) with the <owner> rules on top". Same basis as GirderDetail's `OWN_RULES` (RIDOT 10th, MassDOT 9th, CTDOT 9th); engineer decision 2026-10-19 ("follow the owner"). The calculation stays 10th Ed. with the owner rules on top.

- **How verified:** `node tests/check-syntax.mjs stgirder.html` (all pass). `node tests/compare.mjs --tool st --payload def15_AASHTO_G2,def15_RIDOT_Iyes_G2,xsA_RIDOT_Iyes_G1,util_MassDOT_G2,def15_AASHTO_G2_gdx,util_MassDOT_G2_gdx,def15_AASHTO_G2_loads,util_MassDOT_G2_loads` against main (a6570c0): in every case only `st.checks` differs, and only the two stud checks (strength value and ratio × 0.85/0.70 = 1.2143 exactly; fatigue pitch limit and ratio); session, status, rating, governing, sections and stations identical; no console errors. Headless readout of `R.conn` on main and on the branch (`def15_AASHTO_G2`, and with (ADTT)_SL = 5,000 and 20,000) equals every hand value above; the Connectors tab text shows Q_n = 0.70·0.6013·60 = 25.26 kip, Q_r = 1.00·25.26 = 25.26 kip, n = 122.8, crossover 11,322, (ΔF)_n = 5.199 ksi, Z_r = 3.13 kip, p_req = 15.07 in; the report links "N, (ADTT)_SL, n and Y: see §10.1"; the RIDOT and MassDOT payloads show the owner edition text in the banner, Objectives and footer.
- **Saved data:** none (no key, field or format change; `R.conn` is computed, not stored).
- **Other copies:** GirderDetail (`Steel Bridge Beam Modules.html`) stud module still uses Q_r = 0.85·Q_n with the 9th Ed. Q_n default (inventory finding 3); not changed here (one tool per PR).
- **Open items (engineer):**
  1. Stud limit state per detail (A10-2): the studs now pick Fatigue I / II on their own crossover (11,322/day at n = 1, 75 yr) while the flange keeps its category's (1,682 for C). Confirm; the alternative is to keep the studs on the flange's choice (more conservative between the two crossovers).
  2. 10th Ed. 6.10.10.1.2 pitch limits (max 48 in. for D ≥ 24 in., 24 in. otherwise; min 4d) and 6.10.10.1.1 h/d ≥ 5.0 / 7.0, 6.10.10.1.3, 6.10.10.1.4 are not checked by the tool (they were not checked before either). Add as checks?
  3. Stud F_u is fixed at 60 ksi (6.4.4); no input.
  4. 6.10.10.3 additional connectors at contraflexure (members noncomposite for negative flexure) are not checked (unchanged).
- **Diff (main → branch; no context lines):**
```diff
diff --git a/stgirder.html b/stgirder.html
index ac2134d..e0b51e9 100644
--- a/stgirder.html
+++ b/stgirder.html
@@ -595 +595 @@ const DEFAULTS = {
-    ncyc:1.0,               // cycles per truck passage n (Table 6.6.1.2.5-2)
+    ncyc:1.0,               // cycles per truck passage n (Table 6.6.1.2.5-1)
@@ -972,0 +973,5 @@ const lfS=R=>(R&&R.lf)||{...LF_ST,...lfFac(LF_ST),plOn:false};
+// Edition statement ("follow the owner", engineer decision 2026-10-19; same basis as GirderDetail's OWN_RULES): ST-Girder computes to
+// AASHTO LRFD 10th Ed. (2024); with an owner from GirderDetail its rules are on top, and the edition the owner's manual is written to is named.
+const OWN_ED={RIDOT:'10th Ed.',MassDOT:'9th Ed.',CTDOT:'9th Ed.'};
+const edOwn=R=>{ const L=lfS(R); return L.on&&L.o&&L.o!=='AASHTO'? L.o : ''; };
+const edNote=R=>{ const o=edOwn(R), L=lfS(R); return o? ' with the '+o+' rules on top'+(OWN_ED[o]?' ('+(L.manual||o)+' is written to AASHTO LRFD '+OWN_ED[o]+')':'') : ''; };
@@ -989 +994 @@ function OwnBanner({R,go}){ const L=R&&R.ok&&R.lf; if(!L||!L.on) return null; co
-    <b>Owner load rules from GirderDetail: {L.o||'—'}</b>{L.manual?<span style={{fontSize:11.5}}> · {L.manual}</span>:null}
+    <b>Owner load rules from GirderDetail: {L.o||'—'}</b>{L.manual?<span style={{fontSize:11.5}}> · {L.manual}</span>:null}{edOwn(R)?<span style={{fontSize:11.5}}> · code basis: AASHTO LRFD 10th Ed. (2024) with the owner rules on top{OWN_ED[edOwn(R)]?' (the manual is written to AASHTO LRFD '+OWN_ED[edOwn(R)]+')':''}</span>:null}
@@ -1344 +1349 @@ function llShearAt(L,x){
-// Dc = elastic web depth in compression for the section being checked (6.10.8.2.3-9 uses Dc,
+// Dc = elastic web depth in compression for the section being checked (Eq. 6.10.8.2.3b-3 uses Dc,
@@ -1352 +1357 @@ function flangeFnc(bfc,tfc,tw,D,Lb_in,Fyc,Es,Rb,Rh,Cb,Dc,Fyw){
-  const rt=bfc/sqrt(12*(1+(DcV*tw)/(3*bfc*tfc)));     // 6.10.8.2.3-9 (Dc)
+  const rt=bfc/sqrt(12*(1+(DcV*tw)/(3*bfc*tfc)));     // Eq. 6.10.8.2.3b-3 (Dc)
@@ -1954 +1959 @@ function computeAll(inp){
-    // AASHTO Table 6.6.1.2.5-1 / 6.6.1.2.5-3.
+    // AASHTO LRFD 10th Ed. Table 6.6.1.2.3-1 (the 9th Ed. had them in Tables 6.6.1.2.5-1 / 6.6.1.2.5-3).
@@ -1978 +1983 @@ function computeAll(inp){
-    const nCyc = +fq.ncyc||1.0;                               // cycles per truck passage (Table 6.6.1.2.5-2)
+    const nCyc = +fq.ncyc||1.0;                               // cycles per truck passage (Table 6.6.1.2.5-1)
@@ -1981 +1986 @@ function computeAll(inp){
-    // Infinite-life crossover (basis of Table 6.6.1.2.3-2): Fatigue I (γ=1.75 vs (ΔF)TH) governs
+    // Infinite-life crossover (Eq. C6.6.1.2.3-1, the (ADTT)SL equivalent to infinite life column of Table 6.6.1.2.3-1): Fatigue I (γ=1.75 vs (ΔF)TH) governs
@@ -2070 +2075,3 @@ function computeAll(inp){
-    const Qn=Math.min(0.5*Asc*sqrt(deck.fc*EcDeck), Asc*Fustud), phisc=0.85, Qr=phisc*Qn;
+    // 10th Ed. Eq. 6.10.10.4.3-1: Qn = 0.70·Asc·Fu (Fu of the stud, 6.4.4); phi_sc = 1.00 (6.5.4.2); Qr = phi_sc·Qn (Eq. 6.10.10.4.1-1).
+    // (Before: Qn = min(0.5·Asc·sqrt(f'c·Ec), Asc·Fu) with phi_sc = 0.85, the 9th Ed. form.)
+    const Qn=0.70*Asc*Fustud, phisc=1.00, Qr=phisc*Qn;
@@ -2075,10 +2082,14 @@ function computeAll(inp){
-    /* 6.10.10.2 -- the stud resistance branch has to be the one that goes with the
-       limit state the rest of the app already decided on (Step 2 of the Fatigue
-       tab): Fatigue I is the infinite-life check, Zr = 5.5d^2 (Eq. 6.10.10.2-1)
-       against a shear range factored by gamma = 1.75; Fatigue II is the finite-life
-       check, Zr = alpha*d^2 (Eq. 6.10.10.2-2) with gamma = 0.80. The old
-       "alpha*d^2 >= 5.5d^2/2" floor belonged to the pre-2009 single-load-factor
-       (0.75) format and must not be paired with gamma = 1.75. */
-    const alphaF=Math.max(34.5-4.28*(Math.log(Nfat)/Math.LN10),0);
-    const dStud2=Math.pow(+inp.conn.studD,2);
-    const Zr=fatInf? 5.5*dStud2 : alphaF*dStud2;
+    /* 10th Ed. 6.10.10.2, Eq. 6.10.10.2-1: Zr = (dF)n·Asc, with (dF)n per 6.6.1.2.5 for Condition 9.2 of
+       Table 6.6.1.2.3-1 (A = 1040e8 ksi^5, m = 5, (dF)TH = 7.0 ksi). The stud is its own detail, so its
+       Fatigue I / II choice uses its own (ADTT)SL equivalent to infinite life (Eq. C6.6.1.2.3-1 with m = 5,
+       divided by n and scaled by 75/Y as the flange crossover above): AUTO -> Fatigue I (gamma 1.75,
+       (dF)n = (dF)TH) when (ADTT)SL >= that value, else Fatigue II (gamma 0.80, (dF)n = (A/N)^(1/5),
+       Eq. 6.6.1.2.5-2). A manual Fatigue I / II choice on the Inputs tab applies to the studs as well.
+       (Before: Zr = 5.5d^2 / alpha·d^2 with alpha = 34.5 - 4.28 log N, branch taken from the flange category crossover.) */
+    const SC92={A:1040e8, m:5, TH:7.0};
+    const adttSLcrossSC=SC92.A/(Math.pow(fatGRatio*SC92.TH,SC92.m)*365*lifeYr*nCyc);
+    const recFatISC=adttSL>=adttSLcrossSC;
+    const fatInfSC=lsMode==='auto'? recFatISC : (lsMode==='I');
+    const gammaFatSC=fatInfSC?1.75:0.80;                      // load factor (Table 3.4.1-1)
+    const FnSCII=Math.pow(SC92.A/Nfat,1/SC92.m), FnSC=fatInfSC? SC92.TH : FnSCII;
+    const Zr=FnSC*Asc;
@@ -2094 +2105 @@ function computeAll(inp){
-      const VfU=fatImpV? rg.range : rg.range*1.15*dfFatV, Vf=gammaFat*VfU, vsr=Vf*Q/cc.I;   // imported: per girder, IM + DF in
+      const VfU=fatImpV? rg.range : rg.range*1.15*dfFatV, Vf=gammaFatSC*VfU, vsr=Vf*Q/cc.I;   // imported: per girder, IM + DF in
@@ -2118 +2129 @@ function computeAll(inp){
-                Vfat,VfatU,gammaFat,fatInf,alphaF,Qslab,Icomp:fatStud.Icomp,dfFatV,Vtr:Ld.hl.Vtr,fatStud,contStud,yDeckNA,fatImpV};
+                Vfat,VfatU,gammaFat:gammaFatSC,fatInf:fatInfSC,studD:+inp.conn.studD,studH:+inp.conn.studH,SC92,adttSLcrossSC,recFatISC,FnSC,FnSCII,Fustud,phisc,Qslab,Icomp:fatStud.Icomp,dfFatV,Vtr:Ld.hl.Vtr,fatStud,contStud,yDeckNA,fatImpV};
@@ -2347,0 +2359 @@ const DL_T={
+  fatn:{tab:'fatigue',id:'stg-d-fatn',cr:'fat.n',l:'Fatigue · Step 1 traffic and cycles'},
@@ -2887 +2899 @@ function InputsTab({inp,set,R}){
-      <div className="hint" style={{margin:'2px 0 8px'}}>AUTO picks Fatigue&nbsp;I (infinite life, γ=1.75) when (ADTT)<sub>SL</sub> is at or above the category crossover, else Fatigue&nbsp;II (finite life, γ=0.80). See the Fatigue tab for the full determination.</div>
+      <div className="hint" style={{margin:'2px 0 8px'}}>AUTO picks Fatigue&nbsp;I (infinite life, γ=1.75) when (ADTT)<sub>SL</sub> is at or above the category crossover, else Fatigue&nbsp;II (finite life, γ=0.80); the shear studs use their own crossover (Condition 9.2, Connectors tab). See the Fatigue tab for the full determination.</div>
@@ -2900,2 +2912,2 @@ function InputsTab({inp,set,R}){
-        {G('fatigue.ncyc')? <GdFld l="Cycles per passage n (Table 6.6.1.2.5-2)" v={fmt(+G('fatigue.ncyc').v,1)} src={G('fatigue.ncyc').src}/>
-        : <div className="fld"><label>Cycles per passage n (Table 6.6.1.2.5-2)</label>
+        {G('fatigue.ncyc')? <GdFld l="Cycles per passage n (Table 6.6.1.2.5-1)" v={fmt(+G('fatigue.ncyc').v,1)} src={G('fatigue.ncyc').src}/>
+        : <div className="fld"><label>Cycles per passage n (Table 6.6.1.2.5-1)</label>
@@ -3979 +3991 @@ function fatCards(R,sel,right){
-    <Card title="Step 1 — Fatigue traffic & number of stress cycles" refTag="LRFD 3.6.1.4 · 6.6.1.2.5">
+    <Card id="stg-d-fatn" title="Step 1 — Fatigue traffic & number of stress cycles" refTag="LRFD 3.6.1.4 · 6.6.1.2.5">
@@ -3985 +3997 @@ function fatCards(R,sel,right){
-        ['Cycles per truck passage n', fmt(f.nCyc,2), 'Table 6.6.1.2.5-2'],
+        ['Cycles per truck passage n', fmt(f.nCyc,2), 'Table 6.6.1.2.5-1'],
@@ -4002 +4014 @@ function fatCards(R,sel,right){
-      <div className="mnote">Fatigue&nbsp;I (γ = 1.75) is the infinite-life check used when traffic is heavy enough that the Fatigue&nbsp;I check governs over Fatigue&nbsp;II, i.e. when (A/N)<sup>⅓</sup>/0.80 ≥ (ΔF)<sub>TH</sub>/1.75 — the basis of Table 6.6.1.2.3-2 (e.g. category C, 75 yr: 1,680 trucks/day); the section is then designed for unlimited cycles. Fatigue&nbsp;II (γ = 0.80) is the finite-life check for lighter traffic, where resistance depends on the actual cycle count N.</div>
+      <div className="mnote">Fatigue&nbsp;I (γ = 1.75) is the infinite-life check used when traffic is heavy enough that the Fatigue&nbsp;I check governs over Fatigue&nbsp;II, i.e. when (A/N)<sup>⅓</sup>/0.80 ≥ (ΔF)<sub>TH</sub>/1.75 — Eq. C6.6.1.2.3-1, the basis of the (ADTT)<sub>SL</sub> equivalent to infinite life in Table 6.6.1.2.3-1 (e.g. category C, 75 yr, n = 1: 1,680 trucks/day); the section is then designed for unlimited cycles. Fatigue&nbsp;II (γ = 0.80) is the finite-life check for lighter traffic, where resistance depends on the actual cycle count N. The shear studs are their own detail (Condition 9.2, m = 5) with their own crossover; see the Connectors tab.</div>
@@ -4009,2 +4021,2 @@ function fatCards(R,sel,right){
-        ['Detail constant A', fmt(f.Acat/1e8,2)+'×10⁸', 'ksi³ (Table 6.6.1.2.5-1)'],
-        ['CAF threshold (ΔF)ᴛʜ', fmt(f.TH,1), 'ksi (Table 6.6.1.2.5-3)'],
+        ['Detail constant A', fmt(f.Acat/1e8,2)+'×10⁸', 'ksi³ (Table 6.6.1.2.3-1)'],
+        ['CAF threshold (ΔF)ᴛʜ', fmt(f.TH,1), 'ksi (Table 6.6.1.2.3-1)'],
@@ -4211 +4223 @@ function connStrDeriv(R){ const c=R.conn;
-        ['Q_r','Factored resistance φ_sc·Q_n (φ_sc=0.85)',c.Qr,'kip'],
+        ['Q_r','Factored resistance φ_sc·Q_n (φ_sc=1.00, 6.5.4.2)',c.Qr,'kip'],
@@ -4218 +4230,2 @@ function connStrDeriv(R){ const c=R.conn;
-      <ML s={Tx`Q_n=\min\!\left(0.5A_{sc}\sqrt{f'_cE_c},\;A_{sc}F_u\right)=${nx(c.Qn,1)}\;\text{kip}\qquad Q_r=\phi_{sc}Q_n=0.85\cdot${nx(c.Qn,1)}=${nx(c.Qr,1)}\;\text{kip}`}/>
+      <ML s={Tx`Q_n=0.70\,A_{sc}F_u=0.70\cdot${nx(c.Asc,4)}\cdot${nx(c.Fustud,0)}=${nx(c.Qn,2)}\;\text{kip}\quad(\text{Eq. 6.10.10.4.3-1})\qquad Q_r=\phi_{sc}Q_n=${nx(c.phisc,2)}\cdot${nx(c.Qn,2)}=${nx(c.Qr,2)}\;\text{kip}\quad(\text{Eq. 6.10.10.4.1-1})`}/>
+      <div className="mnote">A<sub>sc</sub> = πd²/4 of the stud diameter on the Inputs tab; F<sub>u</sub> = 60 ksi, the stud's specified minimum tensile strength (6.4.4); φ<sub>sc</sub> = 1.00 (6.5.4.2). AASHTO LRFD 10th Ed. (2024); the 9th Ed. form min(0.5A<sub>sc</sub>√(f′<sub>c</sub>E<sub>c</sub>), A<sub>sc</sub>F<sub>u</sub>) with φ<sub>sc</sub> = 0.85 is no longer used. Eq. 6.10.10.4.3-1 presumes the stud height-to-diameter ratio of 6.10.10.1.1 (h/d = {fmt(c.studH,2)}/{fmt(c.studD,3)} = {fmt(c.studH/Math.max(c.studD,1e-9),2)} here; not checked by this tool).</div>
@@ -4222 +4235 @@ function connStrDeriv(R){ const c=R.conn;
-      <div className="mnote">P is the smaller of the slab force 0.85f′_c·b_eff·t_s and the steel force F_y·A_steel — the total horizontal shear that must be transferred between the point of maximum moment and the support.{c.contStud?' In this continuous span the governing requirement is the one below (6.10.10.4.2).':''}</div>
+      <div className="mnote">n = P/Q<sub>r</sub> is Eq. 6.10.10.4.1-2. P is the smaller of the slab force 0.85f′_c·b_eff·t_s and the steel force F_y·A_steel — the total horizontal shear that must be transferred between the point of maximum moment and the support.{c.contStud?' In this continuous span the governing requirement is the one below (6.10.10.4.2).':''}</div>
@@ -4228 +4241 @@ function connStrDeriv(R){ const c=R.conn;
-        <div className="mnote">The span is continuous (the imported demands have factored negative moment). Between the point of maximum positive moment and the centerline of an adjacent interior support the studs must develop P = P<sub>p</sub> + P<sub>n</sub> (6.10.10.4.2; straight girder, radial force F<sub>p</sub> = 0 — verify equation numbers against the 10th Ed.). An end is taken as an interior support when the factored −M there is below −1 k-ft. Provided studs are counted at the uniform pitch from the max +M station to that end.</div>
+        <div className="mnote">The span is continuous (the imported demands have factored negative moment). Between the point of maximum positive moment and the centerline of an adjacent interior support the studs must develop P = P<sub>p</sub> + P<sub>n</sub> (6.10.10.4.2, Eqs. 6.10.10.4.2-5 to -8: P<sub>T</sub> = P<sub>p</sub> + P<sub>n</sub>; straight girder, radial force F<sub>T</sub> = 0, so P = P<sub>T</sub>). An end is taken as an interior support when the factored −M there is below −1 k-ft. Provided studs are counted at the uniform pitch from the max +M station to that end.</div>
@@ -4236 +4249,2 @@ function connFatDeriv(R){ const c=R.conn;
-        ['Z_r','Fatigue shear resistance of one stud',c.Zr,'kip'],
+        ['(ΔF)_n','Nominal fatigue resistance, Condition 9.2 ('+(c.fatInf?'(ΔF)_TH':'(A/N)^1/5')+')',c.FnSC,'ksi'],
+        ['Z_r','Fatigue shear resistance of one stud (ΔF)_n·A_sc',c.Zr,'kip'],
@@ -4243,0 +4258,4 @@ function connFatDeriv(R){ const c=R.conn;
+      <SG n="1">Stud limit state: Fatigue I or II (Condition 9.2)</SG>
+      <ML s={Tx`(\text{ADTT})_{SL,\,cross}=\dfrac{A}{\left[\tfrac{0.80}{1.75}(\Delta F)_{TH}\right]^{5}(365)(Y)(n)}=\dfrac{1040\times10^{8}}{(${nx(R.fatigue.fatGRatio,4)}\cdot${nx(c.SC92.TH,1)})^{5}\cdot365\cdot${nx(R.fatigue.lifeYr,0)}\cdot${nx(R.fatigue.nCyc,2)}}=${nx(c.adttSLcrossSC,0)}\;\text{trucks/day}`}/>
+      <ML s={Tx`(\text{ADTT})_{SL}=${nx(R.fatigue.adttSL,0)}\;${c.recFatISC?'\\ge':'<'}\;${nx(c.adttSLcrossSC,0)}\;\Rightarrow\;\text{${c.recFatISC?'Fatigue I':'Fatigue II'} recommended}${R.fatigue.lsMode==='auto'?'':'\\quad(\\text{manual '+(c.fatInf?'Fatigue I':'Fatigue II')+' used})'}`}/>
+      <SG n="2">Fatigue resistance of one stud (Eq. 6.10.10.2-1)</SG>
@@ -4245,2 +4263,3 @@ function connFatDeriv(R){ const c=R.conn;
-        ? Tx`Z_r=5.5\,d^{2}=${nx(c.Zr,2)}\;\tfrac{\text{kip}}{\text{stud}}\quad(\text{Fatigue I, infinite life, Eq. 6.10.10.2-1})`
-        : Tx`Z_r=\alpha d^{2}=(${nx(c.alphaF,2)})d^{2}=${nx(c.Zr,2)}\;\tfrac{\text{kip}}{\text{stud}}\quad(\text{Fatigue II, finite life})`}/>
+        ? Tx`(\Delta F)_n=(\Delta F)_{TH}=${nx(c.SC92.TH,1)}\;\text{ksi}\quad(\text{Eq. 6.6.1.2.5-1})\qquad Z_r=(\Delta F)_nA_{sc}=${nx(c.FnSC,2)}\cdot${nx(c.Asc,4)}=${nx(c.Zr,2)}\;\tfrac{\text{kip}}{\text{stud}}`
+        : Tx`(\Delta F)_n=\left(\frac{A}{N}\right)^{1/5}=\left(\frac{1040\times10^{8}}{${nx(R.fatigue.Nfat,0)}}\right)^{1/5}=${nx(c.FnSC,3)}\;\text{ksi}\quad(\text{Eq. 6.6.1.2.5-2})\qquad Z_r=(\Delta F)_nA_{sc}=${nx(c.FnSC,3)}\cdot${nx(c.Asc,4)}=${nx(c.Zr,2)}\;\tfrac{\text{kip}}{\text{stud}}`}/>
+      <DLinks items={[{to:'fatn',what:'N, (ADTT)_SL, n and Y'}]}/>
@@ -4248 +4267 @@ function connFatDeriv(R){ const c=R.conn;
-      <div className="mnote">The load factor and the Z<sub>r</sub> branch are a pair (6.10.10.2 with Table 3.4.1-1): Fatigue&nbsp;I applies γ&nbsp;=&nbsp;1.75 against the infinite-life resistance 5.5d², Fatigue&nbsp;II applies γ&nbsp;=&nbsp;0.80 against αd². Which one is in force is decided on the Fatigue tab and follows the same (ADTT)<sub>SL</sub> crossover as the flange check.</div>
+      <div className="mnote">The load factor and the Z<sub>r</sub> branch are a pair (6.6.1.2.5 with Table 3.4.1-1): Fatigue&nbsp;I applies γ&nbsp;=&nbsp;1.75 against (ΔF)<sub>n</sub> = (ΔF)<sub>TH</sub> = 7.0 ksi, Fatigue&nbsp;II applies γ&nbsp;=&nbsp;0.80 against (ΔF)<sub>n</sub> = (A/N)<sup>1/5</sup>. Condition 9.2 of Table 6.6.1.2.3-1 (A = 1040×10⁸ ksi⁵, m = 5, (ΔF)<sub>TH</sub> = 7.0 ksi) has its own (ADTT)<sub>SL</sub> equivalent to infinite life (Eq. C6.6.1.2.3-1 with m = 5; 11,320 trucks/day for 75 yr and n = 1), so in AUTO the studs may be in Fatigue&nbsp;II while the flange detail is in Fatigue&nbsp;I. A manual Fatigue&nbsp;I / II choice on the Inputs tab applies to both. AASHTO LRFD 10th Ed. (2024).</div>
@@ -4251 +4270 @@ function connFatDeriv(R){ const c=R.conn;
-      <div className="mnote">Z_r is the fatigue shear resistance of one stud (Fatigue&nbsp;II: α = 34.5 − 4.28·log N; Fatigue&nbsp;I: 5.5d²). V_sr = V_f·Q/I is the horizontal shear range per unit length on the short-term composite section, with V_f the shear range V<sub>+</sub> − V<sub>−</sub> of the fatigue truck (3.6.1.4.1, 30-ft rear axle spacing, one lane, IM 1.15) at each station; the station needing the closest pitch governs (x = {fmt(c.fatStud.x,1)} ft). Radial fatigue shear F<sub>fat</sub> (curved or skewed girders) is not included. The required pitch is the closest fatigue-controlled spacing; the provided pitch must not exceed it.</div>
+      <div className="mnote">Z_r is the fatigue shear resistance of one stud (Eq. 6.10.10.2-1) and p ≤ n·Z_r/V_sr is Eq. 6.10.10.1.2-1 (regularly spaced studs). V_sr = V_f·Q/I is the horizontal shear range per unit length on the short-term composite section, with V_f the shear range V<sub>+</sub> − V<sub>−</sub> of the fatigue truck (3.6.1.4.1, 30-ft rear axle spacing, one lane, IM 1.15) at each station; the station needing the closest pitch governs (x = {fmt(c.fatStud.x,1)} ft). Radial fatigue shear F<sub>fat</sub> (curved or skewed girders) is not included. The required pitch is the closest fatigue-controlled spacing; the provided pitch must not exceed it.</div>
@@ -4439 +4458 @@ function crModel(R,inp,o){
-    <p className="cr-p">Design check of the built-up steel plate girder <b>{gt.girder}</b> ({gt.pos} girder, {gt.sp}){p.name?<span> of {p.name}</span>:null} to the AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), Section 6: section proportions (6.10.2), constructibility (6.10.3), Service II (6.10.4) and live-load deflection (2.5.2.6.2, optional), Strength I flexure (6.10.7, 6.10.8) and shear (6.10.9), fatigue (6.6.1, 6.10.5.3), transverse and bearing stiffeners (6.10.11), shear connectors (6.10.10){R.deckD?', transverse deck design (4.6.2.1, Table A4-1, 9.7.3)':''}, an HL-93 design-load rating (AASHTO MBE 6A) and the dead-load camber.</p>
+    <p className="cr-p">Design check of the built-up steel plate girder <b>{gt.girder}</b> ({gt.pos} girder, {gt.sp}){p.name?<span> of {p.name}</span>:null} to the AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024){edNote(R)}, Section 6: section proportions (6.10.2), constructibility (6.10.3), Service II (6.10.4) and live-load deflection (2.5.2.6.2, optional), Strength I flexure (6.10.7, 6.10.8) and shear (6.10.9), fatigue (6.6.1, 6.10.5.3), transverse and bearing stiffeners (6.10.11), shear connectors (6.10.10){R.deckD?', transverse deck design (4.6.2.1, Table A4-1, 9.7.3)':''}, an HL-93 design-load rating (AASHTO MBE 6A) and the dead-load camber.</p>
@@ -4651 +4670 @@ function crModel(R,inp,o){
-      sub(s,'Fatigue traffic and number of stress cycles','3.6.1.4 · 6.6.1.2.5',<CrTab el={FC.s1}/>);
+      sub(s,'Fatigue traffic and number of stress cycles','3.6.1.4 · 6.6.1.2.5',<CrTab el={FC.s1}/>); tag(s,'fat.n');
@@ -4745 +4764 @@ function CalcDoc({R,inp,o,idp,model}){
-      <p className="cr-p cr-small">Prepared with ST-Girder (AASHTO LRFD BDS 10th Ed.). Equations are shown symbolically, then with values substituted, then with the result. Units: kip, in, ksi, k-ft unless noted. Detail: {o.detail==='all'?'governing locations worked, every checked station tabulated':'governing locations worked'}.</p></section>
+      <p className="cr-p cr-small">Prepared with ST-Girder (AASHTO LRFD BDS 10th Ed. (2024){edOwn(R)?' with the '+edOwn(R)+' rules on top':''}). Equations are shown symbolically, then with values substituted, then with the result. Units: kip, in, ksi, k-ft unless noted. Detail: {o.detail==='all'?'governing locations worked, every checked station tabulated':'governing locations worked'}.</p></section>
```
