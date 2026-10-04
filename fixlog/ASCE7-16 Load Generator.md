# Fix log — ASCE7-16 Load Generator.html

Governing basis used for fixes: ASCE/SEI 7-16 (with 780 CMR 10th Ed. where the tool already applies it).

Note on the code below: strings in the file use JavaScript `\uXXXX` escapes for subscripts and symbols, and the code blocks reproduce them exactly. Line numbers are approximate (after the fix).

## 2026-10-04 — PR: claude/fix-asce7 (PR link added after merge)

### F1. Seismic vertical distribution uses height above the base   [calc change] [more or less conservative, depends on the building; no change when base elevation = 0]
- **Where:** `solve()`, seismic section (≈ line 1009). Anchor text: `const sumWH=`
- **Problem:** C_vx used the level elevation `l.h` (grade datum), not the height above the base. With `S.baseElev ≠ 0` (basement or podium) the upper levels were under-distributed. Story heights and the overturning moment already subtracted `baseElev`; C_vx did not. The Excel export showed the same values.
- **Governing provision:** ASCE 7-16 Eq. 12.8-11 and 12.8-12 (h_i, h_x = height from the base to level i, x).
- **Before:**
  ```js
    const sumWH=lv.reduce((t,l)=>t+l.w*Math.pow(l.h,sq.k),0);
    sq.levels=lv.map(l=>{const whk=l.w*Math.pow(l.h,sq.k);
      const Cvx=sumWH>0?whk/sumWH:0; return {...l,whk,Cvx,Fx:Cvx*sq.Vbase};});
  ```
- **After:**
  ```js
    /* Eq. 12.8-12: h_x is the height above the base, not the level elevation on the grade datum */
    const sumWH=lv.reduce((t,l)=>t+l.w*Math.pow(Math.max(0,l.h-S.baseElev),sq.k),0);
    sq.levels=lv.map(l=>{const hx=Math.max(0,l.h-S.baseElev), whk=l.w*Math.pow(hx,sq.k);
      const Cvx=sumWH>0?whk/sumWH:0; return {...l,hx,whk,Cvx,Fx:Cvx*sq.Vbase};});
  ```
  Display: the Sec. 12.8.3 table column is now "hₓ above base (ft)" showing `L.hx`, and the worked C_vx equation uses `L0.hx`. The story-shear table's first numeric column is relabelled "Elevation (ft)" (it always showed the elevation). Excel export: column 2 is now `h_x above base` (`L.hx`), and the elevation moved to column 10; the base row shows h_x = 0 and the base elevation.
- **Check case:** base elev 10 ft; Roof at elev 46 ft, w = 600 k; L2 at elev 28 ft, w = 600 k; T ≤ 0.5 s so k = 1; V = 124.8 k.
  - Before: w·h = 600·46 = 27,600 and 600·28 = 16,800; C_vx = 0.6216 / 0.3784; F = 77.58 / 47.22 k; M₀ = 3,642.8 k-ft.
  - After: h_x = 36 and 18; w·h = 21,600 and 10,800; C_vx = 0.6667 / 0.3333; F = 83.20 / 41.60 k; M₀ = 83.2·36 + 41.6·18 = 3,744.0 k-ft.
- **How verified:** `solve()` extracted and run in node (before/after); page rendered in jsdom; Excel workbook built with ExcelJS 4.4.0 in node.
- **Other copies of this code:** none known.

### F2. Kzt: substitute 2H for Lh in K2 and K3 when H/Lh > 0.5; Sec. 26.8.1 applicability warning   [calc change] [more conservative]
- **Where:** `calcKzt()` (≈ line 405). Anchor text: `const LhEff=`
- **Problem:** for H/Lh > 0.5, K1 used H/Lh = 0.5, but K2 and K3 still used the (short) input Lh, so they decayed too fast (unconservative). The Sec. 26.8.1 conditions were not checked at all.
- **Governing provision:** ASCE 7-16 Fig. 26.8-1 note 2; Sec. 26.8.1 conditions (4) H/Lh ≥ 0.2 and (5) H ≥ 15 ft (Exp. C, D) / 60 ft (Exp. B).
- **Before:**
  ```js
  const K1r=T.K1[s.expCat], K1=K1r*Math.min(HLh,0.5);
  const mu=(s.topoX>=0)?T.mu_up:T.mu_dn;
  const K2=Math.max(0,1-Math.abs(s.topoX)/(mu*s.topoLh));
  const K3=Math.exp(-T.gamma*Math.max(z,0)/s.topoLh);
  return {kzt:Math.pow(1+K1*K2*K3,2),HLh,K1r,K1,K2,K3,mu,gamma:T.gamma,upwind:s.topoX>=0,capped:HLh>0.5,z:z};
  ```
- **After:**
  ```js
  const K1r=T.K1[s.expCat], K1=K1r*Math.min(HLh,0.5);
  /* Fig. 26.8-1 note 2: for H/Lh > 0.5, substitute 2H for Lh when evaluating K2 and K3 */
  const LhEff=(HLh>0.5)?2*s.topoH:s.topoLh;
  const mu=(s.topoX>=0)?T.mu_up:T.mu_dn;
  const K2=Math.max(0,1-Math.abs(s.topoX)/(mu*LhEff));
  const K3=Math.exp(-T.gamma*Math.max(z,0)/LhEff);
  /* Sec. 26.8.1 conditions (4) and (5), the two that can be checked from the inputs */
  const Hmin=(s.expCat==="B")?60:15;
  const notApplic=[];
  if(HLh<0.2) notApplic.push("H/L\u2095 = "+HLh.toFixed(3)+" is less than 0.2 (condition 4)");
  if(s.topoH<Hmin) notApplic.push("H = "+s.topoH+" ft is less than "+Hmin+" ft for Exposure "+s.expCat+" (condition 5)");
  return {kzt:Math.pow(1+K1*K2*K3,2),HLh,K1r,K1,K2,K3,mu,gamma:T.gamma,upwind:s.topoX>=0,capped:HLh>0.5,LhEff:LhEff,notApplic:notApplic,z:z};
  ```
  Display (`renderWindP`, Topographic Factor panel): the K2 and K3 worked equations print `kz.LhEff` instead of `S.topoLh`; the "capped" note now states the 2H substitution; a new note lists any failed Sec. 26.8.1 condition (warning only: K_zt is still applied, which is conservative), or reminds the engineer that conditions (1)–(3) must be confirmed. The status-register entry turns to "warn" when a condition fails.
- **Check case:** 2D escarpment, Exp. C, H = 50 ft, Lh = 60 ft, x = 25 ft upwind (μ = 1.5), γ = 2.5, z = h = 30 ft; H/Lh = 0.833 → K1 = 0.85·0.5 = 0.425.
  - Before: K2 = 1 − 25/(1.5·60) = 0.7222; K3 = e^(−2.5·30/60) = 0.2865; Kzt = (1 + 0.425·0.7222·0.2865)² = 1.1836; qh = 36.43 psf.
  - After: Lh,eff = 2H = 100 ft; K2 = 1 − 25/150 = 0.8333; K3 = e^(−0.75) = 0.4724; Kzt = (1 + 0.425·0.8333·0.4724)² = 1.3626; qh = 41.94 psf (+15%).
  - Applicability: 2D ridge, Exp. B, H = 10 ft, Lh = 100 ft → warnings "H/Lh = 0.100 < 0.2" and "H = 10 ft < 60 ft"; Kzt unchanged (1.1085).
- **How verified:** node run of `solve()` before/after; jsdom render.
- **Other copies of this code:** none known.

### F3. LRFD combination 3 with 0.5W   [calc change] [more conservative — new combination]
- **Where:** `solve()`, `R.combos` (≈ line 1033). Anchor text: `id:"LRFD-3W"`
- **Problem:** Sec. 2.3.1 combination 3 is 1.2D + 1.6(Lr or S or R) + (L or 0.5W). Only the "+ L" variant was generated, so 1.2D + 1.6S + 0.5W (which can govern roof members and lateral design under heavy snow) was never checked.
- **Governing provision:** ASCE 7-16 Sec. 2.3.1, combination 3.
- **Before:**
  ```js
    {id:"LRFD-3",txt:"1.2D + 1.6(L\u1d63 or S) + 1.0L",       D:1.2,L:1.0,S:1.6,W:0,  E:0,  useLr:true},
  ```
- **After:**
  ```js
    {id:"LRFD-3",txt:"1.2D + 1.6(L\u1d63 or S) + 1.0L",       D:1.2,L:1.0,S:1.6,W:0,  E:0,  useLr:true},
    {id:"LRFD-3W",txt:"1.2D + 1.6(L\u1d63 or S) + 0.5W",      D:1.2,L:0,  S:1.6,W:0.5,E:0,  useLr:true},
  ```
  The rest of the combination machinery (sub-cases per wind direction, roof surface, GCpi sign and snow case; the worked panels; the Excel table; the 780 CMR ⅔ × LRFD table) picks the new row up automatically. Rain load R is not generated anywhere in this tool, so the label keeps "(Lr or S)" like the other rows.
- **Check case:** tool defaults with custom hazard pg = 40 psf, V = 120 mph (D = 15 psf, Lr = 20 psf, balanced S = 28 psf).
  - Before: no LRFD-3W row.
  - After: LRFD-3W net roof p_u = 1.2·15 + 1.6·28 + 0.5·p_roof = 62.8 + 0.5·p_roof → range 45.30 to 61.60 psf (p_roof from −35.0 to −2.4 psf); lateral 0.5 × 141.99 = 71.00 kip. It does not govern this case (LRFD-3 gives 62.8 psf, LRFD-4/6 give the uplift and lateral).
- **How verified:** node run of `solve()`; jsdom render of the Combinations tab; Excel build.
- **Other copies of this code:** none known.

### F4. Ce, Surface Roughness D, Sheltered = 1.0   [calc change] [LESS conservative]
- **Where:** `CE_TAB` (≈ line 281). Anchor text: `const CE_TAB=`
- **Problem:** Roughness D sheltered was 1.2 (the Roughness B value). Table 7.3-1 gives 1.0.
- **Governing provision:** ASCE 7-16 Table 7.3-1.
- **Before:**
  ```js
  const CE_TAB={B:{full:0.9,partial:1.0,shelt:1.2},C:{full:0.9,partial:1.0,shelt:1.1},D:{full:0.8,partial:0.9,shelt:1.2}};
  ```
- **After:**
  ```js
  const CE_TAB={B:{full:0.9,partial:1.0,shelt:1.2},C:{full:0.9,partial:1.0,shelt:1.1},D:{full:0.8,partial:0.9,shelt:1.0}};
  ```
- **Check case:** pg = 40 psf, Is = 1.0, Ct = 1.0, Exp. D, Sheltered: before pf = 0.7·1.2·40 = 33.6 psf; after pf = 0.7·1.0·40 = 28.0 psf (−17%).
- **How verified:** node run of `solve()`; the Excel Ce table reads the same `CE_TAB`.
- **Other copies of this code:** none known.

### F5. Cs: lower limit applied last   [calc change] [more conservative where it applies]
- **Where:** `solve()` (≈ line 1001). Anchor text: `sq.Cs=Math.max(Math.min`
- **Problem:** the outer `min(…, CsBase)` let Cs fall below the Eq. 12.8-5 floor of 0.01 when S_DS·Ie/R < 0.01. The printout and the Excel formula already showed `max(min(CsBase, CsMax), CsMin)`, so the screen value disagreed with its own equation.
- **Governing provision:** ASCE 7-16 Sec. 12.8.1.1, Eq. 12.8-2, 12.8-3, 12.8-5.
- **Before:**
  ```js
    sq.Cs=Math.min(Math.max(sq.CsMin,Math.min(sq.CsBase,sq.CsMax)), sq.CsBase);
  ```
- **After:**
  ```js
    sq.Cs=Math.max(Math.min(sq.CsBase,sq.CsMax), sq.CsMin);
  ```
- **Check case:** Site B, Ss = 0.075, S1 = 0.03, steel SMF (R = 8), Ie = 1.0: Fa = 0.9, SDS = 0.045, CsBase = 0.0056, CsMax = 0.0068, CsMin = max(0.044·0.045, 0.01) = 0.01. Before Cs = 0.0056 (V = 6.75 k for W = 1,200 k); after Cs = 0.0100 (V = 12.0 k).
- **How verified:** node run; the Excel formula `MAX(MIN(Csb,Csx),Csn)` was already correct and is unchanged.
- **Other copies of this code:** none known.

### F6. Sec. 11.4.3 site-coefficient rules as opt-in options   [calc change, opt-in] [more conservative when used; default unchanged]
- **Where:** `solve()` (≈ line 957), anchor `sq.siteRule=null`; Seismic input panel, anchor `chk("siteDefaultD"`; `DEF` anchor `siteDefaultD:false, siteBnoVs:false`; Excel seismic section, anchor `FaRef=`.
- **Problem:** the "default Site Class D" minimum Fa ≥ 1.2 and the "Site Class B without measured vs → Fa = Fv = 1.0" rules were mentioned in a note only. Site B used 0.9/0.8 regardless.
- **Governing provision:** ASCE 7-16 Sec. 11.4.2 and 11.4.3.
- **Before:**
  ```js
      else { sq.Fa=fa.v; sq.Fv=fv.v; sq.faTrace=fa; sq.fvTrace=fv; }
  ```
- **After:**
  ```js
      else { sq.Fa=fa.v; sq.Fv=fv.v; sq.faTrace=fa; sq.fvTrace=fv;
        sq.FaTab=fa.v; sq.FvTab=fv.v; sq.siteRule=null;
        /* Sec. 11.4.3 site coefficient rules, both opt-in (default off reproduces the tabulated values) */
        if(S.siteClass==="B" && S.siteBnoVs){ sq.Fa=1.0; sq.Fv=1.0;
          sq.siteRule="Site Class B without site-specific shear wave velocity measurement: Sec. 11.4.3 requires F\u2090 = F\u1d65 = 1.0 in place of the tabulated "+RN(fa.v,2)+" and "+RN(fv.v,2)+"."; }
        if(S.siteClass==="D" && S.siteDefaultD && fa.v<1.2){ sq.Fa=1.2;
          sq.siteRule="Site Class D used as the default site class (Sec. 11.4.2): Sec. 11.4.3 requires F\u2090 \u2265 1.2, so F\u2090 = 1.2 in place of the tabulated "+RN(fa.v,3)+"."; }
        else if(S.siteClass==="D" && S.siteDefaultD){
          sq.siteRule="Site Class D used as the default site class (Sec. 11.4.2): the tabulated F\u2090 = "+RN(fa.v,3)+" already satisfies the Sec. 11.4.3 minimum of 1.2."; }
      }
  ```
  New saved fields `siteDefaultD` and `siteBnoVs` (both default `false`, added to `DEF`; old projects load with the default through `restore()`'s merge). Two checkboxes appear under "Site class" only when D or B is selected (the site-class select now rebuilds the panel). The adjusted value is reported in the Site Coefficients panel. Excel: the tabulated Fa/Fv rows keep their table formulas; when a rule is on, new rows "site coefficient used" (`=MAX(1.2,Fa)` or `=1`) are added and S_MS / S_M1 reference them.
- **Check case:** (a) Site D, Ss = 1.2, S1 = 0.1, default-D box ticked: Fa table = 1.02 → Fa = 1.20; SDS = ⅔·1.2·1.2 = 0.960 (was 0.816). (b) Site B, Ss = 0.30, S1 = 0.07, "no measured vs" ticked: Fa, Fv = 0.9, 0.8 → 1.0, 1.0; SDS 0.180 → 0.200; SD1 0.0373 → 0.0467; Cs 0.0423 → 0.0529; V 50.80 → 63.51 k (W = 1,200 k, R = 3). With the boxes unticked the results are identical to before.
- **How verified:** node run; jsdom render; Excel build (formulas inspected: `=MAX(1.2,I371)`, `=1`).
- **Other copies of this code:** none known.

### F7. Sec. 11.4.8 Exception 2 for Site Class D with S1 ≥ 0.2   [calc change] [more conservative]
- **Where:** `solve()` (≈ line 990), anchor `sq.exc1148=(`; `renderSeis` (≈ line 2847), Excel Cs row (≈ line 5075).
- **Problem:** the tool warned that a site-specific analysis was required and then used the ordinary Eq. 12.8-3 cap, which the code does not permit without the exception adjustment.
- **Governing provision:** ASCE 7-16 Sec. 11.4.8 Exception 2 (Cs by Eq. 12.8-2 for T ≤ 1.5Ts; 1.5 × Eq. 12.8-3 for TL ≥ T > 1.5Ts; 1.5 × Eq. 12.8-4 for T > TL); Ts = SD1/SDS (Sec. 11.4.6).
- **Before:**
  ```js
      sq.CsMax=(sq.Tused<=sq.TL)? sq.SD1/(sq.Tused*(sq.R/sq.Ie)) : sq.SD1*sq.TL/(sq.Tused*sq.Tused*(sq.R/sq.Ie));
  ```
- **After:**
  ```js
      sq.CsMax=(sq.Tused<=sq.TL)? sq.SD1/(sq.Tused*(sq.R/sq.Ie)) : sq.SD1*sq.TL/(sq.Tused*sq.Tused*(sq.R/sq.Ie));
      /* Sec. 11.4.8 Exception 2: Site Class D with S1 >= 0.2 may use the mapped values without a
         site-specific analysis provided Cs is taken by Eq. 12.8-2 for T <= 1.5Ts and as 1.5 times
         Eq. 12.8-3 (TL >= T > 1.5Ts) or Eq. 12.8-4 (T > TL) above that. */
      sq.exc1148=(S.siteClass==="D" && site.S1>=0.2);
      if(sq.exc1148){
        sq.Ts=sq.SDS>0?sq.SD1/sq.SDS:0;
        sq.CsMaxTab=sq.CsMax;
        sq.CsMax=(sq.Tused<=1.5*sq.Ts)? Infinity : 1.5*sq.CsMaxTab;
  ```
  (followed by replacing the "unless the exception is satisfied" warning with a statement that Exception 2 is applied). Applied automatically, because without it the old result was not code-compliant. The screen shows Ts, 1.5Ts and which branch applies; the Excel `Cs` cell becomes `MAX(IF(T<=1.5*SD1/SDS,Csb,MIN(Csb,1.5*Csx)),Csn)` with `Csx` still the plain Eq. 12.8-3/12.8-4 value.
- **Check case:** Site D, Ss = 0.6, S1 = 0.25, R = 3, Ie = 1: Fa = 1.32, Fv = 2.10, SDS = 0.528, SD1 = 0.350, Ts = 0.663 s, 1.5Ts = 0.994 s.
  - hn = 120 ft, steel MRF (Ct = 0.028, x = 0.8), T = Ta = 1.290 s > 1.5Ts: before Cs = min(0.176, 0.0905) = 0.0905, V = 108.5 k; after Cs = 1.5·0.0905 = 0.1357, V = 162.8 k (W = 1,200 k).
  - hn = 36 ft, T = 0.294 s ≤ 1.5Ts: Cs = 0.176 before and after (Eq. 12.8-2 already governed).
- **How verified:** node run; jsdom render; Excel build (formula inspected, cached result 0.13569).
- **Other copies of this code:** none known.

### F8. Adjacent-structure drift: 6hd extent and the windward drift   [calc change] [more conservative]
- **Where:** `solve()` snow drift (≈ lines 650–690). Anchors: `o.hdLee772 = ` and `const wMult=`. Input panel: anchor `d.kind==="lower"||d.kind==="adjacent"`.
- **Problem:** the leeward drift width was 4hd although the code (and the tool's own comment) give "the smaller of 6hd and (6h − s)"; the windward drift on the lower roof was set to zero.
- **Governing provision:** ASCE 7-16 Sec. 7.7.2 (and Sec. 7.7.1 for the windward drift, 0.75 × Fig. 7.6-1 with lu = lower roof length).
- **Before:**
  ```js
      o.luLee=Math.max(d.luUpper,25); o.hdLee=figHd(o.luLee);
      o.hdWind=0; o.gov="leeward";
      /* Sec. 7.7.2: the drift height is the smaller of h_d and (6h - s)/6,
         and the horizontal extent the smaller of 6h_d and (6h - s) */
      o.sepOK = (d.sep < 20) && (d.sep < 6*o.hObs);
      o.hd672 = (6*o.hObs - d.sep)/6;
      o.hdRaw = o.sepOK ? Math.min(o.hdLee, Math.max(0,o.hd672)) : 0;
  ```
  ```js
      if(o.hdRaw <= o.hc){ o.hd=o.hdRaw; o.w=4*o.hd; o.capped=false; }
      else { o.hd=o.hc; o.w=Math.min(4*o.hdRaw*o.hdRaw/o.hc, 8*o.hc); o.capped=true; }
      if(d.kind==="adjacent") o.w=Math.min(o.w, o.extCap);
  ```
- **After:**
  ```js
      o.luLee=Math.max(d.luUpper,25); o.hdLee=figHd(o.luLee);
      /* Sec. 7.7.2: the leeward drift height is the smaller of h_d and (6h - s)/6,
         and its horizontal extent the smaller of 6h_d and (6h - s). Windward drifts
         follow Sec. 7.7.1 using the lower roof length, truncated at the edge of the lower roof. */
      o.sepOK = (d.sep < 20) && (d.sep < 6*o.hObs);
      o.hd672 = (6*o.hObs - d.sep)/6;
      o.hdLee772 = o.sepOK ? Math.min(o.hdLee, Math.max(0,o.hd672)) : 0;
      o.luWind=Math.max(d.luLower||0,25); o.hdWind=o.sepOK ? 0.75*figHd(o.luWind) : 0;
      o.hdRaw = Math.max(o.hdLee772, o.hdWind);
      o.gov = o.hdLee772>=o.hdWind ? "leeward" : "windward";
  ```
  ```js
      /* Sec. 7.7.2: a leeward drift on an adjacent lower structure extends 6h_d; all other drifts 4h_d */
      const wMult=(d.kind==="adjacent"&&o.gov==="leeward")?6:4;
      if(o.hdRaw <= o.hc){ o.hd=o.hdRaw; o.w=wMult*o.hd; o.capped=false; }
      else { o.hd=o.hc; o.w=Math.min(4*o.hdRaw*o.hdRaw/o.hc, 8*o.hc); o.capped=true; }
      if(d.kind==="adjacent"&&o.gov==="leeward") o.w=Math.min(o.w, o.extCap);
  ```
  The "Length of this lower roof (windward fetch)" input (`luLower`, which every drift row already stores) is now shown for adjacent drifts too. The worked derivation shows the leeward height, the windward height, the governing value and the 6hd width equation. The windward drift is applied only when the Sec. 7.7.2 separation test is met (same applicability as the leeward drift). The capped-drift width formula (4hd²/hc ≤ 8hc) is unchanged.
- **Check case:** pg = 40 psf (γ = 19.2 pcf, ps = 28 psf, hb = 1.458 ft), h = 10 ft, s = 5 ft (extent cap 6h − s = 55 ft).
  - Upper roof 100 ft, lower roof 60 ft: hd,lee = 3.807 ft, hd,wind = 0.75·figHd(60) = 2.232 ft → leeward governs. Width before 4·3.807 = 15.23 ft; after 6·3.807 = 22.84 ft. pd = 73.10 psf both.
  - Upper roof 30 ft, lower roof 200 ft: before hd = 2.053 ft, w = 8.21 ft, pd = 39.42 psf, peak 67.42 psf; after windward governs, hd = 0.75·(0.43·200^(1/3)·50^(1/4) − 1.5) = 3.890 ft, w = 15.56 ft, pd = 74.69 psf, peak 102.69 psf.
- **How verified:** node run of `solve()`; jsdom render of the Snow tab.
- **Other copies of this code:** none known.

### F9. hb and drift totals use ps, not the balanced design load with rain-on-snow or pm   [calc change] [mixed: drift peak can be LOWER; hc larger]
- **Where:** `solve()` (≈ line 634 and 686). Anchors: `sn.hb = sn.gamma>0 ? sn.ps/sn.gamma` and `o.pTotal = sn.ps + o.pd;`. Display: drift panel and governing-drift note. Excel: `hb` and `pmaxg` rows.
- **Problem:** `sn.balanced = max(ps + ros, pm)` was used for hb and for the drift peak. Rain-on-snow and pm are separate uniform load cases that are not used to determine, or combined with, drift. Using them raised hb (which can falsely trigger the hc/hb < 0.2 exemption, unconservative) and added up to 5 psf, or up to pm − ps, to the drift peak (conservative).
- **Governing provision:** ASCE 7-16 Sec. 7.7.1 (hb = ps/γ), Sec. 7.10 (rain-on-snow applies to the balanced case only), Sec. 7.3.4 (pm is a separate uniform case).
- **Before:**
  ```js
    sn.hb = sn.gamma>0 ? sn.balanced/sn.gamma : 0;                /* balanced snow depth */
  ```
  ```js
      o.pTotal = sn.balanced + o.pd;
    } else { o.hd=0; o.w=0; o.pd=0; o.pTotal=sn.balanced; }
  ```
  Excel: `{formula:A("psdes")+"/"+A("gam2"),result:sn.hb}` and `{formula:A("psdes")+"+"+A("pdg"),result:sn.driftGov.pTotal}`.
- **After:**
  ```js
    /* h_b is based on p_s alone: the rain-on-snow surcharge (Sec. 7.10) and the minimum load p_m (Sec. 7.3.4)
       are separate uniform cases and are not used in determining or combined with drift */
    sn.hb = sn.gamma>0 ? sn.ps/sn.gamma : 0;                      /* balanced snow depth */
  ```
  ```js
      o.pTotal = sn.ps + o.pd;
    } else { o.hd=0; o.w=0; o.pd=0; o.pTotal=sn.ps; }
  ```
  Excel: `A("ps")` replaces `A("psdes")` in both formulas. The balanced snow case itself (`sn.balanced`, used in the combinations) is unchanged.
- **Check case:** flat roof, pg = 15 psf, Exp. C fully exposed (Ce = 0.9), Ct = Is = 1, parapet 3 ft, lu = 100 ft. pf = ps = 9.45 psf, pm = 15 psf, ros = 5 psf, balanced = 15 psf, γ = 15.95 pcf, hd,raw = 0.75·(0.43·100^(1/3)·25^(1/4) − 1.5) = 2.222 ft.
  - Before: hb = 15/15.95 = 0.940 ft, hc = 2.060 ft < hd → capped: hd = 2.060 ft, w = 9.59 ft, pd = 32.85 psf, peak = 15 + 32.85 = 47.85 psf.
  - After: hb = 9.45/15.95 = 0.592 ft, hc = 2.408 ft ≥ hd → hd = 2.222 ft, w = 8.89 ft, pd = 35.44 psf, peak = 9.45 + 35.44 = 44.89 psf.
  - **The drift peak is 3.0 psf (6%) lower** in this case; the surcharge pd is higher and the uniform pm = 15 psf case is still carried separately in the combinations.
- **How verified:** node run; Excel build (formulas `=I188/I193`, `=I188+I200` with I188 = ps).
- **Other copies of this code:** none known.

### F10. Windward roof Cp between 45° and 60°   [calc change] [more conservative]
- **Where:** `solve()` MWFRS roof, wind normal to ridge (≈ line 741). Anchor: `const at60=`
- **Problem:** the 60° column of `CP_ROOF_NORM` is `null` (shown as 0.01θ) and `tblPick` drops nulls, so Cp held the 45° value up to 60° and then jumped. Fig. 27.3-1 allows interpolation to 0.01θ at 60°.
- **Governing provision:** ASCE 7-16 Fig. 27.3-1 (θ ≥ 60°: 0.01θ; note on interpolation between values of the same sign, 0.0 assumed where none of that sign is given).
- **Before:**
  ```js
        const wn=across(k=>Tn.ww[k].neg), wp=across(k=>Tn.ww[k].pos);
  ```
- **After:**
  ```js
        /* Fig. 27.3-1: at theta = 60 deg the windward coefficient is 0.01*theta = 0.6 (positive). Interpolation is
           between values of the same sign only, with 0.0 assumed where none is given (note 3), so the 60 deg
           column is 0.6 for the positive row and 0.0 for the negative row when interpolating 45 to 60 deg. */
        const at60=(arr,v)=>arr.map((x,j)=>Tn.theta[j]>=60?v:x);
        const wn=across(k=>at60(Tn.ww[k].neg,0.0)), wp=across(k=>at60(Tn.ww[k].pos,0.6));
  ```
  The displayed table and the θ ≥ 60° override (`if(g.theta>=60){…}`) are unchanged.
- **Check case:** gable, θ = 55°, h/L = 1.077 (≥ 1.0 row: 45° pos = 0.3). Before Cp,pos = 0.30; after 0.3 + (55 − 45)/15·(0.6 − 0.3) = 0.50. Negative stays 0.0.
- **How verified:** node run.
- **Other copies of this code:** none known.

### F11. Chapter 29 member "Hexagonal or octagonal": Kd = 1.00   [calc change] [more conservative]
- **Where:** `solve()` Chapter 29 elements (≈ line 865). Anchor: `startsWith("Hexagonal")?1.00`
- **Problem:** the combined Fig. 29.4-1 row used Kd = 0.95 (hexagonal). Table 26.6-1 gives octagonal = 1.00 (as the tool's own `KD_TAB` shows). The row cannot tell the two shapes apart, so the larger value is used; hexagonal members are now 5% conservative. Splitting the row would change the saved `section` label, so it was not done (see O7).
- **Governing provision:** ASCE 7-16 Table 26.6-1.
- **Before:**
  ```js
      const kd=e.type==="wall"?0.85:(e.section||"").startsWith("Round")?1.00:(e.section||"").startsWith("Hexagonal")?0.95:0.90;
  ```
- **After:**
  ```js
      /* Table 26.6-1: hexagonal 0.95, octagonal 1.00. The Fig. 29.4-1 row covers both shapes, so the
         octagonal (larger) value is used for it. */
      const kd=e.type==="wall"?0.85:(e.section||"").startsWith("Round")?1.00:(e.section||"").startsWith("Hexagonal")?1.00:0.90;
  ```
- **Check case:** member 0–30 ft, D = 12 in, h/D = 30 (Cf = 1.4), defaults otherwise: before Kd 0.95, q = 29.73 psf, F = 1,061.3 lb; after Kd 1.00, q = 31.29 psf, F = 1,117.2 lb (+5.3%).
- **How verified:** node run.
- **Other copies of this code:** none known.

### F12. Table 12.2-1 rows: building-frame labels, bearing-wall RC rows added, masonry SDC E height limit   [calc/data change] [label migration; masonry limit LESS conservative]
- **Where:** `SFRS` (≈ line 357) and new `SFRS_OLD` map (≈ line 367); `restore()` (≈ line 4262), anchor `SFRS_OLD[S.sfrs]`.
- **Problem:** the RC shear-wall rows carried building-frame values (B.4 R = 6, B.5 R = 5) without saying so; a user with bearing walls would overstate R by 20–25% (unconservative). The special reinforced masonry shear wall row (bearing wall A.7 values) had SDC E = 100 ft; Table 12.2-1 gives 160 ft.
- **Governing provision:** ASCE 7-16 Table 12.2-1, rows A.1, A.2, A.7, B.4, B.5.
- **Before:**
  ```js
   ["Special reinforced concrete shear wall",6.0,2.5,5.0,                       {B:"NL",C:"NL",D:160,E:160,F:100}],
   ["Ordinary reinforced concrete shear wall",5.0,2.5,4.5,                      {B:"NL",C:"NL",D:"NP",E:"NP",F:"NP"}],
   ["Special reinforced masonry shear wall",5.0,2.5,3.5,                        {B:"NL",C:"NL",D:160,E:100,F:100}],
  ```
- **After:**
  ```js
   ["Special reinforced concrete shear wall, building frame system (B.4)",6.0,2.5,5.0,{B:"NL",C:"NL",D:160,E:160,F:100}],
   ["Ordinary reinforced concrete shear wall, building frame system (B.5)",5.0,2.5,4.5,{B:"NL",C:"NL",D:"NP",E:"NP",F:"NP"}],
   ["Special reinforced concrete shear wall, bearing wall system (A.1)",5.0,2.5,5.0,{B:"NL",C:"NL",D:160,E:160,F:100}],
   ["Ordinary reinforced concrete shear wall, bearing wall system (A.2)",4.0,2.5,4.0,{B:"NL",C:"NP",D:"NP",E:"NP",F:"NP"}],
   ["Special reinforced masonry shear wall, bearing wall system (A.7)",5.0,2.5,3.5,{B:"NL",C:"NL",D:160,E:160,F:100}],
  ```
  and, after the `SFRS` array:
  ```js
  /* Labels used before the building-frame / bearing-wall rows were distinguished. Saved projects store the
     label, so restore() maps these to the row that carries the same R, Omega_0 and C_d as before. */
  const SFRS_OLD={"Special reinforced concrete shear wall":"Special reinforced concrete shear wall, building frame system (B.4)",
   "Ordinary reinforced concrete shear wall":"Ordinary reinforced concrete shear wall, building frame system (B.5)",
   "Special reinforced masonry shear wall":"Special reinforced masonry shear wall, bearing wall system (A.7)"};
  ```
  and in `restore()`:
  ```js
    if(S.sfrs && SFRS_OLD[S.sfrs]) S.sfrs=SFRS_OLD[S.sfrs];   /* labels renamed; same R, Omega_0, C_d */
  ```
- **Migration:** saved projects store the system *label* in `S.sfrs`. Without the map an old label would silently fall back to the last row (R = 3). The map keeps every old project on the row with the same R / Ω0 / Cd it had before, so no saved result changes. Verified in jsdom: restoring `sfrs:"Special reinforced masonry shear wall"` gives the A.7 row, R = 5.
- **Check case:** R/Ω0/Cd are unchanged for every existing row. Choosing the new A.1 row instead of B.4 changes R 6 → 5 (Cs up 20%). Masonry in SDC E: before a 120 ft building was flagged "exceeds the 100 ft limit"; after it is "permitted up to 160 ft". This is a screening message only (no load value changes) and is **less conservative**.
- **How verified:** node run; jsdom restore of an old label.
- **Other copies of this code:** none known.

### F13. ASD-9 display string   [display] [no result change]
- **Where:** `renderComb` ASD table (≈ line 3030). Anchor: `["ASD-9",`
- **Problem:** ASD-9 was shown with "0.75(Lr or S or R)". ASCE 7-16 Sec. 2.4.5 combination 9 is 1.0D + 0.525Ev + 0.525Eh + 0.75L + 0.75S (S only). Display only; the ASD combinations are listed, not worked.
- **Governing provision:** ASCE 7-16 Sec. 2.4.5, combination 9.
- **Before:**
  ```js
       ["ASD-8","D + 0.7E"],["ASD-9","D + 0.75L + 0.75(0.7E) + 0.75(L\u1d63 or S or R)"],
  ```
- **After:**
  ```js
       ["ASD-8","D + 0.7E"],["ASD-9","D + 0.75L + 0.75(0.7E) + 0.75S"],
  ```
- **Check case:** n/a (text).
- **How verified:** jsdom render.
- **Other copies of this code:** none known.

### F14. Autosave failure is shown; `doDelete` wrapped in try/catch   [robustness] [no result change]
- **Where:** `autosave()` and new `autosaveNotice()` (≈ line 4268), `doDelete()` (≈ line 4305).
- **Problem:** a quota or blocked-storage failure during autosave was swallowed silently (`catch(e){}`), so work could be lost without warning; `doDelete` called `localStorage.setItem` without try/catch.
- **Governing provision:** n/a.
- **Before:**
  ```js
    saveTimer=setTimeout(()=>{ try{ localStorage.setItem(LSA, JSON.stringify(snapshot())); }catch(e){} },350);
  ```
  ```js
    const p=projects(); delete p[n]; localStorage.setItem(LSK, JSON.stringify(p)); refreshProjects(); }
  ```
- **After:**
  ```js
    saveTimer=setTimeout(()=>{ try{ localStorage.setItem(LSA, JSON.stringify(snapshot())); autosaveNotice(false); }catch(e){ autosaveNotice(true); } },350);
  ```
  plus a new function `autosaveNotice(fail)` (inserted before `function projects()`) that shows a dismissible fixed banner, class `noprint`, id `asce7AutosaveWarn`, telling the user to Export JSON; it is removed on the next successful autosave.
  ```js
    const p=projects(); delete p[n];
    try{ localStorage.setItem(LSK, JSON.stringify(p)); }catch(e){ alert("Local storage is unavailable; the project could not be deleted."); return; }
    refreshProjects(); }
  ```
  Storage keys (`asce7bldg.projects`, `asce7bldg.autosave`) and formats are unchanged.
- **Check case:** n/a. jsdom: `autosaveNotice(true)` creates the banner.
- **How verified:** jsdom.
- **Other copies of this code:** none known.

## 2026-10-04 — PR: claude/step1-group4 (PR link added after merge)
### S1. "← All tools" link and shared project info   [feature (no result change)]
- **Date / type:** 2026-10-04, feature (no result change).
- **Where:** CSS after `#tbactions{...}`, `#appid` markup (anchor `<span id="appver"></span></div>`), new `#tbshare` column after `#tbactions` (anchor `onclick="doExcel()">Excel calculation</button>`), and two new `<script>` blocks before `</body>` (line ≈ 4448; the scripts that follow `</html>` are unchanged).
- **Purpose:** link back to `tools.html` (`target="_top"`, hidden in print); "Use shared project info" / "Share project info" on the `bridgeSuite.v1.projectMeta` channel (`_schema:"bridge-project-meta"`, HANDOFF.md §4.1). Use reads with `BridgeXfer.read('projectMeta','bridge-project-meta',1)`, shows a confirm listing every field that will be overwritten (old → new), writes only fields this tool has, never blanks a field when the shared value is empty, and skips a non-`YYYY-MM-DD` value for a date input.
- **Field mapping:** tb_project → projectName; tb_job → jobNo; tb_by → preparedBy; tb_chk → checkedBy; tb_date → date. Not in this tool (sent as ""): bridgeId, client, location. Subject, Task and Chk. Date are not mapped.
- **Governing provision:** none (no engineering change). Spec: HANDOFF.md §4.1 and §5.
- **Before / After** (exact; edits applied in this order, each anchor occurs once; line endings preserved):
  1.
     - Before:
  ```html
  #tbactions{flex:0 0 auto;display:flex;flex-direction:column;gap:4px}
  ```
     - After:
  ```html
  #tbactions{flex:0 0 auto;display:flex;flex-direction:column;gap:4px}
  #tbshare{flex:0 0 auto;display:flex;flex-direction:column;gap:4px}
  #tbshare .btn{font-size:9pt;padding:2px 8px}
  #appid .alltools{display:inline-block;margin-top:3px;font-size:9pt;color:var(--navy);text-decoration:none}
  #appid .alltools:hover{text-decoration:underline}
  @media print{.alltools,#tbshare{display:none!important}}
  ```
  2.
     - Before:
  ```html
        <div class="code">Snow &middot; Wind &middot; Seismic &nbsp;|&nbsp; <span id="appver"></span></div>
      </div>
  ```
     - After:
  ```html
        <div class="code">Snow &middot; Wind &middot; Seismic &nbsp;|&nbsp; <span id="appver"></span></div>
        <a class="alltools" href="tools.html" target="_top">&larr; All tools</a>
      </div>
  ```
  3.
     - Before:
  ```html
        <button class="btn" id="xlbtn" onclick="doExcel()">Excel calculation</button>
      </div>
  ```
     - After:
  ```html
        <button class="btn" id="xlbtn" onclick="doExcel()">Excel calculation</button>
      </div>
      <div id="tbshare">
        <button class="btn" type="button" onclick="bxUseProjectInfo()">Use shared project info</button>
        <button class="btn" type="button" onclick="bxShareProjectInfo()">Share project info</button>
      </div>
  ```
  4. Final `</body>`.
     - Before:
  ```html
  </body>
  ```
     - After (the first `<script>` holds BridgeXfer v1 verbatim from HANDOFF.md §5, shown here as a placeholder comment):
  ```html
  <script>
  /* (BridgeXfer v1 verbatim from HANDOFF.md §5) */
  </script>
  <script>
  /* Shared project info (HANDOFF.md §4.1): "Use shared project info" / "Share project info".
     Reads and writes the title-block inputs only, through their normal input events. */
  (function(){
    var PRODUCER="ASCE 7-16 Building Load Generator", FILE="ASCE7-16 Load Generator.html";
    var MAP={projectName:'#tb_project', jobNo:'#tb_job', preparedBy:'#tb_by', checkedBy:'#tb_chk', date:'#tb_date'};
    var KEYS=['projectName','bridgeId','jobNo','client','location','preparedBy','checkedBy','date'];
    var LBL={projectName:'Project name',bridgeId:'Bridge ID',jobNo:'Job no.',client:'Client',location:'Location',
             preparedBy:'Prepared by',checkedBy:'Checked by',date:'Date'};
    function fld(k){ return MAP[k] ? document.querySelector(MAP[k]) : null; }
    window.bxShareProjectInfo=function(){
      var f={};
      KEYS.forEach(function(k){ var e=fld(k); f[k]=e ? String(e.value||'') : ''; });
      var r=BridgeXfer.publish('projectMeta',{_schema:'bridge-project-meta',fields:f},PRODUCER,FILE);
      alert(r.ok ? 'Project info shared. Other tools can load it with "Use shared project info".' : r.error);
    };
    window.bxUseProjectInfo=function(){
      var r=BridgeXfer.read('projectMeta','bridge-project-meta',1);
      if(!r.ok){ alert('Shared project info: '+r.error); return; }
      var f=r.payload.fields||{}, ch=[], skip=[];
      KEYS.forEach(function(k){
        var e=fld(k), v=(f[k]==null) ? '' : String(f[k]);
        if(!e || v==='') return;   /* field not in this tool, or shared value empty: never blank a field */
        if(e.type==='date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)){ skip.push(LBL[k]+' ("'+v+'" is not a YYYY-MM-DD date)'); return; }
        if(e.value!==v) ch.push({e:e,k:k,v:v});
      });
      var head='Shared project info from '+BridgeXfer.describe(r.payload);
      var sk=skip.length ? '\n\nSkipped: '+skip.join('; ') : '';
      if(!ch.length){ alert(head+'\n\nNothing to change: the matching fields already hold these values.'+sk); return; }
      if(!confirm(head+'\n\nThese fields will be overwritten:\n'+ch.map(function(c){
          return '  '+LBL[c.k]+': "'+c.e.value+'" → "'+c.v+'"'; }).join('\n')+sk+'\n\nContinue?')) return;
      ch.forEach(function(c){ c.e.value=c.v; c.e.dispatchEvent(new Event('input',{bubbles:true})); });
    };
  })();
  </script>
  </body>
  ```
- **Behaviour notes:** Use dispatches `input`, so the existing `oninput` handler updates `S.tb[k]` and calls `autosave()` (key and format unchanged).
- **Saved data:** no existing key or format changed. New keys are only the HANDOFF channel keys `bridgeSuite.v1.projectMeta` and `bridgeSuite.v1.projectMeta.updatedAt`, written on "Share project info".
- **Check case:** n/a, no computed result changes. Hand check: open the tool, type a project name, click "Share project info"; open another tool, click "Use shared project info", accept the confirm; the name appears and survives a reload.
- **How verified:** Every plain inline script syntax-checked (Node `vm.Script`, same parser as `node --check`); BridgeXfer block compared byte-for-byte with HANDOFF.md §5; page loaded in jsdom (CDN scripts not loaded) before and after the change with no new errors; Share → Use exercised between tools with jsdom localStorage (ASCE7-16 → ACI Rebar, Steel Beam → Shear and Moment, Concrete Beam Capacity shell against stub tab documents), including cancel, empty shared values (field kept), a non-ISO date on a date input (skipped), an empty channel and a wrong `_schema` (refused). `git diff` shows no removed lines other than the ones listed under Before. No calculation code was touched.
- **Other copies of this code:** none. BridgeXfer v1 is also in: ACI Rebar Development Length.html, ASCE7-16 Load Generator.html, Concrete Beam Capacity.html (shell), Steel Beam Design - AISC 15th.html, Shear and Moment Diagrams.html.

## 2026-10-04 — PR: claude/conn-asce7-steelbeam (PR link added after merge)
### C1. Building-load hand-off sender: "Send to other tools" and "Export hand-off (JSON)"   [feature: hand-off (no result change)]
- **Date / type:** 2026-10-04, feature: hand-off (no result change).
- **Where:** two buttons added at the end of `#tbactions` (anchor `onclick="doExcel()">Excel calculation</button>` inside `<div id="tbactions">`), and one new `<script>` block inserted right after the shared-project-info script, before `</body>` (anchor: the line `ch.forEach(function(c){ c.e.value=c.v; ...` followed by `};`, `})();`, `</script>`, `</body>`). The scripts after `</html>` are unchanged.
- **Purpose:** publishes channel `bridgeSuite.v1.buildingLoads` (`_schema:"bridge-building-loads"`, HANDOFF.md §4.7) with nominal area loads in psf and the seismic parameters, for Steel Beam Design. "Export hand-off (JSON)" stamps the same payload and downloads it; it does not publish. The builder only reads `S` and the existing `solve()` result `R`; it refuses to send while `R.err` is non-empty.
- **Mapping:**

| HANDOFF field | ASCE7-16 source (sender) | Steel Beam target (receiver) |
|---|---|---|
| `areaLoads.D` | `S.DLroof` (roof dead load input, psf, horizontal projection) | uniform load, case DL (default), w = D·TW/1000 |
| `areaLoads.L` | not computed → `null` | row disabled ("not provided") |
| `areaLoads.Lr` | `S.LrRoof` (roof live input, psf) | uniform load, case LR (created if missing), w = Lr·TW/1000 |
| `areaLoads.S` | `R.snow.balanced` (design balanced roof snow, psf) | uniform load, case SL, w = S·TW/1000 |
| `areaLoads.W.roofUplift` | most negative MWFRS roof pressure, all directions/zones/±GCpi (dashboard envelope) | uniform load, case WL, w = p·TW/1000 (negative = upward) — default wind choice |
| `areaLoads.W.roofDown` | most positive MWFRS roof pressure | same, if chosen |
| `areaLoads.W.wall` | larger of abs(windward wall at h) and abs(most negative leeward/side wall) | same, applied as + (beam load plane), if chosen |
| `areaLoads.W.wallPressure` / `wallSuction` | windward wall at h (max of ±GCpi) / most negative leeward or side wall | same, sign as published, if chosen |
| `areaLoads.R` | not computed → `null` | not imported |
| `seismic.SDS, SD1, SDC` | `R.seis.SDS`, `.SD1`, `.SDC` (`null` if no tabulated Fa/Fv) | shown in the dialog, not imported |
| `seismic.Ie` | `R.site.Ie` | shown, not imported |
| `info.snow` (unbalanced, drift) | `R.snow.unbal`, `R.snow.driftGov` | warning in the dialog only; not imported |

- **Governing provision:** none changed. Values are read from the existing calculation (ASCE 7-16 Sec. 7.3/7.4 snow, Ch. 27 Part 1 MWFRS wind, Sec. 11.4/11.6 seismic) exactly as the dashboard shows them. Spec: HANDOFF.md §4.7 (updated in the same PR) and §5.
- **Before / After** (exact; each anchor occurs once):
  1. Buttons.
     - Before:
  ```html
      <button class="btn" id="xlbtn" onclick="doExcel()">Excel calculation</button>
    </div>
  ```
     - After:
  ```html
      <button class="btn" id="xlbtn" onclick="doExcel()">Excel calculation</button>
      <button class="btn" type="button" onclick="bxSendBuildingLoads()" title="Publish the nominal area loads (psf) and seismic parameters for Steel Beam Design (HANDOFF.md, channel buildingLoads)">Send to other tools</button>
      <button class="btn" type="button" onclick="bxExportBuildingLoads()" title="Save the same hand-off as a JSON file">Export hand-off (JSON)</button>
    </div>
  ```
  2. New script, inserted between the shared-project-info `</script>` and `</body>` (BridgeXfer v1 is already in this file from Step 1 and is reused, not pasted again):
  ```html
<script>
/* Building-load hand-off (HANDOFF.md §4.7, channel buildingLoads): "Send to other tools" / "Export hand-off (JSON)".
   Reads the results already computed by solve() (R) and the inputs (S). Nothing here changes a calculation. */
(function(){
  var PRODUCER="ASCE 7-16 Building Load Generator", FILE="ASCE7-16 Load Generator.html";
  function r2(v){ return Math.round(v*100)/100; }
  function fin(v){ return (typeof v==="number" && isFinite(v)) ? v : null; }
  /* most negative and most positive of a list of {p, tag} */
  function env(list){
    var lo=null, hi=null;
    list.forEach(function(o){ if(fin(o.p)===null) return;
      if(!lo || o.p<lo.p) lo=o; if(!hi || o.p>hi.p) hi=o; });
    return { lo:lo, hi:hi };
  }
  window.bxBuildingLoadsPayload=function(){
    if(!R || (R.err && R.err.length) || !R.snow || !R.wind || !R.geom || !R.site)
      return { error:"The calculation is blocked or incomplete, so there is nothing to send. Clear the blocking errors first." };
    var g=R.geom, sn=R.snow, notes=[];
    /* ---- roof wind: the same envelope the dashboard shows (Wind Pressure Envelope by Direction) ---- */
    var roof=[], wallP=[], wallS=[];
    if(g.free){
      if(R.free){
        R.free.cases.forEach(function(f){
          roof.push({p:f.pW, tag:"free roof (Fig. 27.3-4/5) case "+f.name+", windward half"});
          roof.push({p:f.pL, tag:"free roof (Fig. 27.3-4/5) case "+f.name+", leeward half"}); });
        R.free.longCases.forEach(function(f){
          roof.push({p:f.p, tag:"free roof (Fig. 27.3-7) case "+f.name+", "+f.band+" from the windward edge"}); });
      }
    } else {
      R.cases.forEach(function(c){
        (c.roofRows||[]).forEach(function(r){
          roof.push({p:r.pPos, tag:"MWFRS roof, wind "+c.id+", "+r.label+", +GCpi"});
          roof.push({p:r.pNeg, tag:"MWFRS roof, wind "+c.id+", "+r.label+", −GCpi"});
          if(r.pMaxPos!==undefined){
            roof.push({p:r.pMaxPos, tag:"MWFRS roof, wind "+c.id+", "+r.label+" (alternate Cp = −0.18), +GCpi"});
            roof.push({p:r.pMaxNeg, tag:"MWFRS roof, wind "+c.id+", "+r.label+" (alternate Cp = −0.18), −GCpi"});
          }
        });
        var ww=c.wwTable[c.wwTable.length-1];
        wallP.push({p:ww.pPos, tag:"MWFRS windward wall at z = "+r2(ww.z)+" ft, wind "+c.id+", +GCpi"});
        wallP.push({p:ww.pNeg, tag:"MWFRS windward wall at z = "+r2(ww.z)+" ft, wind "+c.id+", −GCpi"});
        wallS.push({p:c.pLW.pPos, tag:"MWFRS leeward wall, wind "+c.id+", +GCpi"});
        wallS.push({p:c.pLW.pNeg, tag:"MWFRS leeward wall, wind "+c.id+", −GCpi"});
        wallS.push({p:c.pSide.pPos, tag:"MWFRS side wall, wind "+c.id+", +GCpi"});
        wallS.push({p:c.pSide.pNeg, tag:"MWFRS side wall, wind "+c.id+", −GCpi"});
      });
    }
    var re=env(roof), we=env(wallP), se=env(wallS);
    var W={ roofUplift:re.lo?re.lo.p:null, roofDown:re.hi?re.hi.p:null,
            wall:null, wallPressure:we.hi?we.hi.p:null, wallSuction:se.lo?se.lo.p:null,
            basis:{ roofUplift:re.lo?re.lo.tag:"", roofDown:re.hi?re.hi.tag:"",
                    wallPressure:we.hi?we.hi.tag:"", wallSuction:se.lo?se.lo.tag:"" } };
    if(W.wallPressure!==null || W.wallSuction!==null){
      var a=Math.abs(W.wallPressure||0), b=Math.abs(W.wallSuction||0);
      W.wall=Math.max(a,b); W.basis.wall=(a>=b)?W.basis.wallPressure:W.basis.wallSuction;
    }
    /* ---- snow: design balanced roof snow; unbalanced and drift are information only ---- */
    var info={ snow:{ pfDes:fin(sn.pfDes), ps:fin(sn.ps), balanced:fin(sn.balanced),
      unbalanced: sn.unbal && sn.unbal.applies ? { windward:fin(sn.unbal.windward), leewardUniform:fin(sn.unbal.leewardUniform),
        leewardPeak:fin(sn.unbal.leewardPeak), surchargeLength:fin(sn.unbal.surchargeLen) } : null,
      drift: sn.driftGov ? { location:String(sn.driftGov.label||("drift "+sn.driftGov.idx)), peak:fin(sn.driftGov.pTotal),
        surcharge:fin(sn.driftGov.pd), width:fin(sn.driftGov.w) } : null },
      roof:{ type:S.roofType, slopeDeg:fin(g.theta) }, qh:fin(R.wind.qh.q), G:R.wind.G, GCpi:R.enc&&R.enc.gcpi?R.enc.gcpi.p:null,
      enclosure:R.enc?R.enc.cls:"" };
    var q=R.seis||{}, hasSeis=(q.Fa!==null && q.Fa!==undefined);
    var payload={ _schema:"bridge-building-loads", schemaVersion:1, code:"ASCE 7-16",
      project:{ name:(document.getElementById("tb_project")||{}).value||"", bridgeId:"" },
      units:{ pressure:"psf", seismic:"SDS and SD1 in g; Ie dimensionless; SDC a letter", length:"ft", angle:"deg" },
      factored:false,
      signConvention:"Wind: positive acts toward (into) the surface, negative away from it (suction). On a roof, positive is downward and negative is uplift. D, Lr and S act downward on the horizontal projection of the roof.",
      areaLoads:{ D:fin(S.DLroof), L:null, Lr:fin(S.LrRoof), S:fin(sn.balanced), W:W, R:null },
      seismic:{ SDS:hasSeis?fin(q.SDS):null, SD1:hasSeis?fin(q.SD1):null, SDC:hasSeis?q.SDC:null, Ie:fin(R.site.Ie) },
      info:info,
      notes:notes };
    var p=BridgeXfer.sharedProject(); if(p && (p.name||p.bridgeId) && !payload.project.name) payload.project=p;
    notes.push("All values are nominal (unfactored) ASCE 7-16 area loads in psf. Apply the load factors and combinations of the receiving tool.");
    notes.push("D is the roof dead load entered in this tool (on the horizontal projection) and Lr the roof live load entered here; they are inputs, not computed. L (floor live) and R (rain) are not computed by this tool and are sent as null.");
    notes.push("S = "+r2(sn.balanced)+" psf is the design balanced roof snow load (Sec. 7.3/7.4, including the Sec. 7.3.4 minimum and the Sec. 7.10 rain-on-snow surcharge where they apply). Unbalanced snow"+
      (info.snow.unbalanced?" (windward "+r2(info.snow.unbalanced.windward)+" psf, leeward peak "+r2(info.snow.unbalanced.leewardPeak!==null?info.snow.unbalanced.leewardPeak:info.snow.unbalanced.leewardUniform)+" psf)":" (not required here)")+
      " and drift are NOT included in S.");
    if(info.snow.drift) notes.push("Information only, not included in S: governing drift at "+info.snow.drift.location+", peak "+r2(info.snow.drift.peak)+" psf (surcharge "+r2(info.snow.drift.surcharge)+" psf over "+r2(info.snow.drift.width)+" ft). Apply it separately where the member lies in the drift.");
    notes.push("Wind pressures are MWFRS pressures (Ch. 27 Part 1, directional procedure), q_h = "+r2(info.qh)+" psf, G = "+info.G+(info.GCpi!==null?", GCpi = ±"+info.GCpi:"")+". Components and cladding pressures (Ch. 30) are NOT computed by this tool and usually govern purlins, girts and roof or wall beams with small tributary areas; check them separately.");
    if(W.roofUplift!==null) notes.push("roofUplift = "+r2(W.roofUplift)+" psf: most negative roof pressure of all MWFRS cases and zones ("+W.basis.roofUplift+").");
    if(W.roofDown!==null) notes.push("roofDown = "+r2(W.roofDown)+" psf: most positive roof pressure of all MWFRS cases and zones ("+W.basis.roofDown+")"+(W.roofDown<=0?"; no case gives a net downward pressure, so this is the least uplift.":"."));
    if(W.wall!==null) notes.push("wall = "+r2(W.wall)+" psf: larger magnitude of the windward wall pressure at the mean roof height ("+r2(W.wallPressure)+" psf) and the most negative leeward or side wall pressure ("+r2(W.wallSuction)+" psf). Basis: "+W.basis.wall+".");
    else notes.push("No wall pressures: the building is modelled as an open canopy (free roof).");
    if(info.roof.slopeDeg>0.01) notes.push("Roof slope "+r2(info.roof.slopeDeg)+"°: wind pressures act normal to the roof surface; snow, D and Lr act on the horizontal projection.");
    if(!hasSeis) notes.push("SDS, SD1 and SDC are null: "+((q.ssReason||[]).join(" ")||"no tabulated site coefficient."));
    var blk=(R.xchecks||[]).filter(function(c){ return c.sev==="err"; }).map(function(c){ return c.name+": "+c.msg; })
      .concat((R.checks||[]).filter(function(c){ return c.state==="err"; }).map(function(c){ return c.name+": "+c.detail; }));
    if(blk.length) notes.push("The sender's status register shows Blocked items; resolve them before relying on these loads: "+blk.join(" | "));
    return { ok:true, payload:payload };
  };
  window.bxSendBuildingLoads=function(){
    var b=bxBuildingLoadsPayload(); if(!b.ok){ alert(b.error); return; }
    var r=BridgeXfer.publish("buildingLoads", b.payload, PRODUCER, FILE);
    if(!r.ok){ alert(r.error); return; }
    var a=r.payload.areaLoads;
    function f(v){ return v===null||v===undefined ? "n/a" : (typeof v==="number" ? String(r2(v)) : String(v)); }
    alert("Building loads sent (nominal, psf):\n  D = "+f(a.D)+", Lr = "+f(a.Lr)+", S = "+f(a.S)+
      "\n  W roof uplift = "+f(a.W.roofUplift)+", roof down = "+f(a.W.roofDown)+", wall = "+f(a.W.wall)+
      "\n  SDS = "+f(r.payload.seismic.SDS)+", SD1 = "+f(r.payload.seismic.SD1)+", SDC = "+f(r.payload.seismic.SDC)+", Ie = "+f(r.payload.seismic.Ie)+
      "\n\nOpen Steel Beam Design and click \"Pull from ASCE 7-16\".");
  };
  window.bxExportBuildingLoads=function(){
    var b=bxBuildingLoadsPayload(); if(!b.ok){ alert(b.error); return; }
    var p=b.payload;   /* stamped here, not published: the file export does not change what other tools see */
    p.producer=PRODUCER; p.producerFile=FILE; p.producedAt=new Date().toISOString();
    var e=BridgeXfer.exportFile("buildingLoads", p); if(!e.ok) alert(e.error);
  };
})();
</script>
  ```
- **Saved data:** no existing key or format changed (`asce7bldg.projects`, `asce7bldg.autosave` untouched). New keys are only the HANDOFF channel keys `bridgeSuite.v1.buildingLoads` and `bridgeSuite.v1.buildingLoads.updatedAt`, written on "Send to other tools".
- **Check case:** default project (Melrose MA, Risk II, 120 × 50 ft flat roof, h = 36 ft, Exp. C). Sent: D = 15, Lr = 20, S = 30 psf; W.roofUplift = −34.43 psf (wind +Y, zone 0 to h/2, +GCpi); roofDown = +0.85; wall = 27.05 (windward at h, −GCpi); wallSuction = −24.38; SDS = 0.3094 g, SD1 = 0.1104 g, SDC B, Ie = 1.0. Hand check of roofUplift: q_h = 0.00256·K_z·K_zt·K_d·K_e·V² = 0.00256 × 1.0209 × 1.0 × 0.85 × 1.0 × 119² = 31.45 psf; wind +Y: L = 50 ft, h/L = 36/50 = 0.72, Cp = −0.9 + (0.72 − 0.5)/0.5 × (−1.3 + 0.9) = −1.076 (Fig. 27.3-1, parallel, 0 to h/2); p = q_h·G·Cp − q_i·GCpi = 31.45 × 0.85 × (−1.076) − 31.45 × 0.18 = −28.77 − 5.66 = **−34.43 psf**.
- **How verified:** every plain inline script passes `node --check`; jsdom run of the real page: `solve()` output identical to origin/main (JSON of `R`); `bxBuildingLoadsPayload()` checked against `R` for the default project, a 6:12 gable with a lower-roof drift (unbalanced and drift sent under `info.snow` only), an open canopy (wall fields `null`), Site Class F (seismic `null`) and a blocked calculation (refused). End-to-end Send → Steel Beam Pull test, see the Steel Beam fix log C1.
- **Other copies of this code:** none. BridgeXfer v1 (unchanged) is also in: ACI Rebar Development Length.html, Concrete Beam Capacity.html, Steel Beam Design - AISC 15th.html, Shear and Moment Diagrams.html, and the other Step 1 tools.

## Open items (not changed)
- O1. Unbalanced snow (Sec. 7.6.1) uses `W` with no lower bound on lu, while drifts use `max(lu, 25 ft)` (`figHd`). Fig. 7.6-1 / Sec. 7.6.1 text should be checked for whether a 20 ft minimum applies to the unbalanced hd. — Not changed: the edition text was not available to confirm. — Engineer to confirm the floor (if any) for the unbalanced drift and for `figHd`.
- O2. Hurricane-prone region test: `hurricaneProne = (S.jur==="MA") || (site.V>115)`. It treats all of Massachusetts as hurricane-prone and uses the risk-category wind speed rather than the Risk Category II speed. The Risk Category I exemption for glazing protection is also unverified. — Needs 780 CMR / ASCE 7-16 Sec. 26.2 / 26.12.3 confirmation for MA. — Engineer decision.
- O3. ASD display strings other than ASD-9: the 780 CMR "⅔ × LRFD" table string omits the L term (display only). Not changed.
- O4. Partially enclosed buildings: Ri (Sec. 26.13.1.1) not applied (conservative) and qi = qh (unconservative only if an opening is above h). Not in this task.
- O5. Blank inputs read as 0: topoLh = 0 gives K2 = 0 → Kzt = 1 silently; TL = 0 sends Cs to CsMin silently. Not in this task.
- O6. The tool has no rain load R; LRFD-3W is labelled "(Lr or S)" like the other rows.
- O7. Ch. 29 "Hexagonal or octagonal" is one Fig. 29.4-1 row, now Kd = 1.00. If hexagonal members are common, the row could be split into two (Kd 0.95 / 1.00) with a label migration. — Engineer to decide.
- O8. Adjacent-structure windward drift: applied only when the Sec. 7.7.2 separation test (s < 20 ft and s < 6h) is met, and not truncated at the lower-roof edge (conservative). Confirm this reading of Sec. 7.7.2.
