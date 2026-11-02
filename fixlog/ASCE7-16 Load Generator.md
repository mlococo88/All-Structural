# Fix log — ASCE7-16 Load Generator.html

Governing basis used for fixes: ASCE/SEI 7-16 (with 780 CMR 10th Ed. where the tool already applies it).

Note on the code below: strings in the file use JavaScript `\uXXXX` escapes for subscripts and symbols, and the code blocks reproduce them exactly. Line numbers are approximate (after the fix).

## 2026-10-04 — PR: claude/fix-asce7 (PR #23: https://github.com/mlococo88/All-Structural/pull/23)

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

## 2026-10-04 — PR: claude/step1-group4 (PR #30: https://github.com/mlococo88/All-Structural/pull/30)
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

## 2026-10-04 — PR: claude/conn-asce7-steelbeam (PR #33: https://github.com/mlococo88/All-Structural/pull/33)
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

## Open items (recorded 2026-10-04; status after the 2026-10-12 sweep: see "Earlier open items: status after this PR" below)
- O1. Unbalanced snow (Sec. 7.6.1) uses `W` with no lower bound on lu, while drifts use `max(lu, 25 ft)` (`figHd`). Fig. 7.6-1 / Sec. 7.6.1 text should be checked for whether a 20 ft minimum applies to the unbalanced hd. — Not changed: the edition text was not available to confirm. — Engineer to confirm the floor (if any) for the unbalanced drift and for `figHd`.
- O2. Hurricane-prone region test: `hurricaneProne = (S.jur==="MA") || (site.V>115)`. It treats all of Massachusetts as hurricane-prone and uses the risk-category wind speed rather than the Risk Category II speed. The Risk Category I exemption for glazing protection is also unverified. — Needs 780 CMR / ASCE 7-16 Sec. 26.2 / 26.12.3 confirmation for MA. — Engineer decision.
- O3. ASD display strings other than ASD-9: the 780 CMR "⅔ × LRFD" table string omits the L term (display only). Not changed.
- O4. Partially enclosed buildings: Ri (Sec. 26.13.1.1) not applied (conservative) and qi = qh (unconservative only if an opening is above h). Not in this task.
- O5. Blank inputs read as 0: topoLh = 0 gives K2 = 0 → Kzt = 1 silently; TL = 0 sends Cs to CsMin silently. Not in this task.
- O6. The tool has no rain load R; LRFD-3W is labelled "(Lr or S)" like the other rows.
- O7. Ch. 29 "Hexagonal or octagonal" is one Fig. 29.4-1 row, now Kd = 1.00. If hexagonal members are common, the row could be split into two (Kd 0.95 / 1.00) with a label migration. — Engineer to decide.
- O8. Adjacent-structure windward drift: applied only when the Sec. 7.7.2 separation test (s < 20 ft and s < 6h) is met, and not truncated at the lower-roof edge (conservative). Confirm this reading of Sec. 7.7.2.

## 2026-10-12 — PR: claude/sweep-asce7 (open-item sweep; PR #162: https://github.com/mlococo88/All-Structural/pull/162)

Engineer's instruction (2026-10-12): work through every open item, use best judgment, and list what needs the engineer. Basis: ASCE/SEI 7-16 (the edition this tool implements), with 780 CMR 10th Ed. where the tool already applies it. Provisions I could not confirm against the printed standard are marked **verify**. Line numbers are approximate (after the fix). New strings use `\uXXXX` escapes like the rest of the file.

### W1. Blank or zero inputs that silently change a result now block the calculation   [bug fix] [results change only for blank/zero inputs, which are now refused] (open item O5)
- **Where:** `solve()`, end of the function (≈ line 1306), anchor: the line `if(S.Lx<=0||S.Ly<=0||g.h<=0) R.err.push(`; `doExcel()` (≈ line 5427), anchor `function doExcel(){`.
- **Problem:** `num()` stores a blank number box as 0 (`i.value===""?0:parseFloat(i.value)`). With a topographic feature selected, L_h = 0 gave K₂ = 0 and K_zt = 1.0, and H = 0 gave K₁ = 0 and K_zt = 1.0, both with only a "condition not met" note. T_L = 0 made Eq. 12.8-4 return C_s,max = 0, so C_s fell to C_s,min (unconservative, silently). h_n = 0, W = 0, ρ = 0 and an override G = 0 likewise gave a period of zero, V = 0, E = 0 or zero wind with no warning. The Excel export ran even when the calculation was blocked.
- **Governing provision:** ASCE 7-16 Fig. 26.8-1 (H, L_h); Sec. 26.11 (G); Sec. 12.8.2.1 (h_n); Fig. 22-14 to 22-17 (T_L); Sec. 12.7.2 (W); Sec. 12.3.4 (ρ = 1.0 or 1.3).
- **Before:**
  ```js
  if(S.Lx<=0||S.Ly<=0||g.h<=0) R.err.push("Building plan dimensions and height must all be greater than zero.");
  if(g.h>60) R.warn.push(
  ```
  ```js
  function doExcel(){
    const btn=document.getElementById("xlbtn");
  ```
- **After:**
  ```js
  if(S.Lx<=0||S.Ly<=0||g.h<=0) R.err.push("Building plan dimensions and height must all be greater than zero.");
  /* A blank number box reads as 0 (num()). For these inputs a zero would silently change a result
     (K_zt to 1.0, C_s to its floor, V to 0, E or the wind to 0), so it blocks the calculation. */
  if(S.topoType!=="None" && !(S.topoH>0 && S.topoLh>0))
    R.err.push("Topography: the feature height H and the upwind distance Lₕ must both be greater than zero (Fig. 26.8-1). A blank entry reads as zero and would silently give Kᴢₜ = 1.0. Enter both values, or set the topographic feature to None.");
  if(S.Goverride && !(S.Gval>0))
    R.err.push("The gust-effect factor override G must be greater than zero (Sec. 26.11). Enter G, or clear the override.");
  if(sq.Fa!==null){
    if(!(S.hn>0)) R.err.push("Seismic: the structural height hₙ must be greater than zero (Sec. 12.8.2.1).");
    if(!(S.TL>0)) R.err.push("Seismic: the long-period transition period Tʟ must be greater than zero (Fig. 22-14 to 22-17). A blank entry reads as zero and would silently send Cₛ to its lower limit.");
    if(!(S.seisW>0)) R.err.push("Seismic: the effective seismic weight W must be greater than zero (Sec. 12.7.2).");
    if(!(S.rho>=1.0)) R.err.push("Seismic: the redundancy factor ρ must be at least 1.0 (Sec. 12.3.4 gives 1.0 or 1.3).");
  }
  if(g.h>60) R.warn.push(
  ```
  ```js
  function doExcel(){
    if(R && R.err && R.err.length){ alert("The calculation is blocked; resolve these first:\n\n"+R.err.join("\n")); return; }
    const btn=document.getElementById("xlbtn");
  ```
  The seismic checks apply only when the seismic calculation runs (`sq.Fa!==null`); with Site Class F (no tabulated coefficients) a blank T_L is not an error. A blocked calculation already shows "Blocking Errors" on the dashboard and "Calculation Blocked" on every other tab (existing `render()`), and the hand-off sender already refuses to send.
- **Check case:** default project (Melrose, Site D, steel not detailed for seismic, R = 3, W = 1,200 k), T_L box cleared.
  - Before: T_L = 0 < T → C_s,max = S_D1·T_L/(T²·R/I_e) = 0 → C_s = C_s,min = max(0.044 × 0.3094 × 1.0, 0.01) = 0.01361; V = 16.34 k (instead of C_s = 0.1031, V = 123.74 k).
  - After: "Seismic: the long-period transition period T_L must be greater than zero ..." blocking error; no results, no Excel, no hand-off.
  - Topography 2D escarpment, H = 50 ft, L_h cleared: before K_zt = 1.0 with the "H/L_h = 0.000 is less than 0.2" note; after a blocking error.
- **How verified:** jsdom, main vs branch, 24 states (`R` JSON, rendered text of every tab, `snapshot()` and the hand-off payload): the blank-input states differ only by the new `R.err` entry (and the refused hand-off); every other state is identical apart from the items below. `doExcel()` with T_L = 0 shows the alert and builds no workbook.
- **Other copies of this code:** none known.

### W2. Unbalanced snow: l_u = W not taken less than 25 ft in Fig. 7.6-1   [calc change] [**MORE conservative**, only where W < 25 ft] (open item O1)
- **Where:** `solve()`, Sec. 7.6.1 block (≈ line 630), anchor `ub.sqrtS=Math.sqrt(ub.S);`; `renderSnow` unbalanced panel (≈ lines 2269–2276), anchors `"Fig. 7.6-1 with lᵤ = W"` and `"h_d = 0.43\\,("+R2(ub.W)+")`; User Manual Part 6 text (≈ line 4055), anchor `and h<sub>d</sub> from Fig. 7.6-1 using l<sub>u</sub> = W.`; Excel `out("hd","Drift height"` (≈ line 5121).
- **Problem:** the unbalanced drift height used h_d from Fig. 7.6-1 with l_u = W and no lower bound, while every drift in this tool uses `figHd`, which takes l_u not less than 25 ft. For W < 25 ft (gable roofs up to 50 ft wide, not using the W ≤ 20 ft simply-supported exception) the unbalanced surcharge was smaller than the same roof's drift basis.
- **Decision:** the inventory asked the engineer to confirm whether ASCE 7-16 puts a floor on l_u for Sec. 7.6.1. Without the printed text I applied the tool's existing 25 ft drift floor, because it is the conservative choice and makes the tool consistent with itself. **Verify:** if ASCE 7-16 Sec. 7.6.1 / Fig. 7.6-1 has no minimum for the unbalanced case (or a 20 ft minimum), the floor can be removed (or set to 20) on the lines listed above; see "Needs engineer".
- **Governing provision:** ASCE 7-16 Sec. 7.6.1 (h_d from Fig. 7.6-1 with l_u = W) and Fig. 7.6-1 (h_d = 0.43·l_u^(1/3)·(p_g + 10)^(1/4) − 1.5); the 25 ft floor is the one this tool already applies under Sec. 7.7.1 / 7.8 (**verify** the edition text for both).
- **Before:**
  ```js
      ub.hd=Math.max(0,0.43*Math.pow(ub.W,1/3)*Math.pow(sn.pg+10,0.25)-1.5);
  ```
  ```js
            ["h<sub>d</sub>","Drift height",R2(ub.hd)+" ft","Fig. 7.6-1 with lᵤ = W"]]);
  ```
  ```js
      "h_d = 0.43\\,("+R2(ub.W)+")^{1/3}\\,("+R2(sn.pg)+"+10)^{1/4} - 1.5","h_d = "+R2(ub.hd)+"\\ \\text{ft}");
  ```
  ```
  `+K("\\gamma = 0.13 p_g + 14 \\le 30\\ \\mathrm{pcf}")+` and h<sub>d</sub> from Fig. 7.6-1 using l<sub>u</sub> = W.
  ```
  ```js
      {formula:"MAX(0,0.43*"+A("Wrun")+"^(1/3)*("+A("pg")+"+10)^0.25-1.5)",result:sn.unbal.hd},NF.f3,"Fig. 7.6-1");
  ```
- **After:**
  ```js
      /* Fig. 7.6-1 with l_u = W, taken as not less than 25 ft: the same l_u floor this tool applies to every
         drift (figHd below). Conservative where W < 25 ft; the ASCE 7-16 Sec. 7.6.1 / Fig. 7.6-1 floor is to be verified. */
      ub.luUsed=Math.max(ub.W,25);
      ub.hd=Math.max(0,0.43*Math.pow(ub.luUsed,1/3)*Math.pow(sn.pg+10,0.25)-1.5);
  ```
  ```js
            ["h<sub>d</sub>","Drift height",R2(ub.hd)+" ft","Fig. 7.6-1 with lᵤ = W, not less than 25 ft"]]);
  ```
  ```js
      "h_d = 0.43\\,("+R2(ub.luUsed)+")^{1/3}\\,("+R2(sn.pg)+"+10)^{1/4} - 1.5","h_d = "+R2(ub.hd)+"\\ \\text{ft}");
    if(ub.W<25) note(b,"W = "+R2(ub.W)+" ft is less than 25 ft, so lᵤ = 25 ft is used in Fig. 7.6-1, the same minimum fetch this tool applies to every drift calculation (conservative).","k");
  ```
  ```
  `+K("\\gamma = 0.13 p_g + 14 \\le 30\\ \\mathrm{pcf}")+` and h<sub>d</sub> from Fig. 7.6-1 using l<sub>u</sub> = W, not taken less than 25 ft (the same floor as the drifts; see 7.3 below).
  ```
  ```js
      {formula:"MAX(0,0.43*MAX("+A("Wrun")+",25)^(1/3)*("+A("pg")+"+10)^0.25-1.5)",result:sn.unbal.hd},NF.f3,"Fig. 7.6-1, l_u = W not less than 25 ft");
  ```
- **Check case:** Melrose defaults (p_g = 40 psf, p_s = 28.0 psf, γ = 0.13·40 + 14 = 19.2 pcf, D = 15 psf, L_r = 20 psf), gable 6:12 (S = 2, √S = 1.4142), 120 × 30 ft, ridge along X, so W = 15 ft.
  - Before: h_d = 0.43·15^(1/3)·50^(1/4) − 1.5 = 0.43 × 2.4662 × 2.6591 − 1.5 = 1.320 ft; p_sur = 1.320 × 19.2/1.4142 = 17.92 psf over 8 × 1.320 × 1.4142/3 = 4.98 ft; leeward peak 28.0 + 17.92 = **45.92 psf**. LRFD-3 net roof max 1.2·15 + 1.6·45.92 = 91.47 psf; governing gravity LRFD-3W 95.22 psf.
  - After: l_u = 25 ft; h_d = 0.43 × 2.9240 × 2.6591 − 1.5 = 1.843 ft; p_sur = 1.843 × 19.2/1.4142 = 25.03 psf over 6.95 ft; leeward peak **53.03 psf** (+15.5%). LRFD-3 102.84 psf; governing LRFD-3W 106.59 psf.
  - W = 22 ft, 4:12: leeward peak 46.89 → 48.43 psf. W ≥ 25 ft: unchanged. W ≤ 20 ft with the simply-supported exception: the load I_s·p_g is unchanged (only the displayed h_d changes).
- **Hand-off:** `info.snow.unbalanced` (information only; the receiver does not import it) carries the new leeward peak and surcharge length, and the matching note text changes; no other field changes.
- **How verified:** jsdom main vs branch (the gable cases above; hip W = 40 ft unchanged); Excel workbook built with ExcelJS 4.4.0 in node: cell formula `MAX(0,0.43*MAX(I66,25)^(1/3)*(I51+10)^0.25-1.5)`, cached 1.8434.
- **Other copies of this code:** none known.

### W3. Hurricane-prone test uses the Risk Category II speed   [calc change with no result change] [neutral] (open item O2, part)
- **Where:** `solve()` wind-borne debris block (≈ line 552), anchor `dbr.hurricaneProne =`; `renderEncl` debris table (≈ line 2131), anchor `[{v:"Hurricane-prone region`.
- **Problem:** `hurricaneProne = (S.jur==="MA") || (site.V>115)` treated all of Massachusetts as hurricane-prone and, for manual entry, used the Risk Category speed rather than the Risk Category II speed that Sec. 26.2 names. The screen said "Massachusetts is on the Atlantic coast".
- **Governing provision:** ASCE 7-16 Sec. 26.2, "Hurricane-prone regions" (Atlantic and Gulf of Mexico coasts where V for Risk Category II > 115 mph) and "Wind-borne debris regions"; Sec. 26.12.3.
- **Before:**
  ```js
  dbr.hurricaneProne = (S.jur==="MA") || (site.V>115);
  ```
  ```js
    [{v:"Hurricane-prone region"},{v:S.jur==="MA"?"Massachusetts is on the Atlantic coast":"V = "+R2(R.site.V)+" mph"},{v:YN(d.hurricaneProne)}],
    [{v:"Wind speed on the governing basis"},{v:"Risk Category "+d.Vbasis+" map value"},{v:R2(d.Vdbr)+" mph"}],
  ```
- **After:**
  ```js
  /* Sec. 26.2: hurricane-prone = Atlantic and Gulf coasts where the Risk Category II basic wind speed exceeds 115 mph.
     Massachusetts: the community's tabulated Risk Category II speed. Manual entry: only the speed entered (the
     Risk Category speed) is known, which is equal to or higher than the Risk Category II speed for RC II to IV. */
  const dbrTown = (S.jur==="MA") ? MA_TOWNS.find(r=>r[0]===S.town) : null;
  dbr.Vii = dbrTown ? dbrTown[4] : null;
  dbr.hurricaneProne = dbrTown ? (dbr.Vii>115) : (site.V>115);
  ```
  ```js
    [{v:"Hurricane-prone region: Atlantic coast, Risk Category II V > 115 mph"},{v:d.Vii!==null?"Risk Category II map value "+R2(d.Vii)+" > 115":"V = "+R2(R.site.V)+" mph as entered > 115"},{v:YN(d.hurricaneProne)}],
    [{v:"Wind speed on the governing basis"},{v:d.Vii!==null?"Risk Category "+d.Vbasis+" map value":"speed entered (Risk Category "+S.risk+")"},{v:R2(d.Vdbr)+" mph"}],
  ```
  plus, right after that table (anchor `  ]);` followed by `  if(d.inRegion){` in `renderEncl`):
  ```js
    if(d.Vii===null) note(b,"Manual hazard entry: only the wind speed entered for Risk Category "+S.risk+" is known, so it is used for both tests above. "+
      "For Risk Category III and IV it is higher than the Risk Category II (or III) speed the code calls for, so the tests err on the side of "+
      "placing the site in the region. Confirm that the site is on the Atlantic or Gulf of Mexico coast, or set the region by override.","k");
  ```
- **Why no result changes:** the debris region also needs V ≥ 130 mph (coastal) or ≥ 140 mph on the Risk Category II (III for RC IV) basis. Any Massachusetts community that reaches 130 mph on that basis has a Risk Category II speed above 115 mph, so the stricter hurricane-prone test never removes a site from the region. 113 of the 351 communities are now "not hurricane-prone"; none of them was in the region before.
- **Check case:** Nantucket (V_II = 137 mph), RC III, coastal: hurricane-prone Yes (137 > 115), coastal trigger Yes → in region; same as before. Adams (V_II = 111 mph): before Yes ("Massachusetts is on the Atlantic coast"), after No; debris region No before and after (111 < 130).
- **How verified:** jsdom, every Massachusetts community × Risk Category I–IV × coastal yes/no, plus manual entry V = 100–180 mph × RC × coastal (2,896 runs, 500 ft² of glazing on wall 1): debris region, glazing counted and enclosure class identical to main in every run.
- **Not changed (needs engineer):** whether 780 CMR 10th Ed. amends the hurricane-prone or wind-borne debris definitions for Massachusetts.
- **Other copies of this code:** none known.

### W4. 780 CMR "⅔ × LRFD" ASD strings show the L term   [display] [no result change] (open item O3)
- **Where:** `renderComb`, 780 CMR ASD table (≈ line 3079), anchor `{v:(2/3*c.D).toFixed(3)+"D + "`.
- **Problem:** the combination string omitted L, so ⅔ × LRFD-4 read "0.800D + 0.333(Lr or S) + 0.667W + 0.000E" although the combination carries 1.0L × ⅔ = 0.667L. The net roof values are unaffected (L acts on the floor below).
- **Governing provision:** 780 CMR 10th Ed. 1605.1 (⅔ of the ASCE 7-16 Sec. 2.3 combinations that include W or E).
- **Before:**
  ```js
        {v:(2/3*c.D).toFixed(3)+"D + "+(2/3*c.S).toFixed(3)+(c.useLr?"(Lᵣ or S)":"S")+" + "+(2/3*c.W).toFixed(3)+"W + "+(2/3*c.E).toFixed(3)+"E"},
  ```
- **After:**
  ```js
        {v:(2/3*c.D).toFixed(3)+"D + "+(2/3*c.L).toFixed(3)+"L + "+(2/3*c.S).toFixed(3)+(c.useLr?"(Lᵣ or S)":"S")+" + "+(2/3*c.W).toFixed(3)+"W + "+(2/3*c.E).toFixed(3)+"E"},
  ```
- **Check case:** default: LRFD-4a reads "0.800D + 0.667L + 0.333(Lr or S) + 0.667W + 0.000E"; LRFD-5a "0.800D + 0.667L + 0.133S + 0.000W + 0.667E"; LRFD-3Wa, 6a, 7a show "0.000L". Net roof columns unchanged.
- **How verified:** headless Chromium screenshot of the ASD panel; jsdom text diff.
- **Other copies of this code:** none.

### W5. Rain load R: stated on the Combinations tab   [display] [no result change] (open item O6)
- **Where:** `renderComb`, panel "Basis for the Combinations" (≈ line 2996), anchor: the note ending `"load L acts on the framing below and does not appear in the roof pressure.");`.
- **Problem:** the combinations read "(Lr or S)" while Sec. 2.3.1 reads "(Lr or S or R)"; the omission of R was stated only in the User Manual scope list.
- **Decision:** the combination labels are left as they are (they are also the Excel and worked-panel labels, and "(Lr or S or R)" would suggest R is included). A warning note is added instead.
- **Before:** (no note)
- **After** (inserted after that note):
  ```js
    note(b,"Rain load R (Ch. 8) is not computed by this tool. Sec. 2.3.1 combinations 2, 3 and 4 read (Lᵣ or S or R); the "+
      "(Lᵣ or S) term below omits R. Where rain on the roof can exceed Lᵣ and S (for example a roof that relies on "+
      "secondary drainage, or one prone to ponding), evaluate R by hand and substitute it.","w");
  ```
- **Governing provision:** ASCE 7-16 Sec. 2.3.1 combinations 2–4; Ch. 8.
- **Check case:** n/a (text).
- **How verified:** headless Chromium screenshot; jsdom text diff.
- **Other copies of this code:** none.

### Earlier open items: status after this PR
- **O1:** fixed conservatively (W2); the floor value needs the printed-text check (see "Needs engineer").
- **O2:** hurricane-prone test corrected (W3, no result change). The Risk Category I exemption is kept: my reading of Sec. 26.12.3.2 is that glazing protection is required for Risk Category II, III and IV buildings only (**verify**). The 780 CMR question is under "Needs engineer".
- **O3:** fixed (W4).
- **O4, q_i part closed, not an issue:** q_i = q_h for positive internal pressure in a partially enclosed building is permitted by ASCE 7-16 Sec. 27.3.1 ("for positive internal pressure evaluation, q_i may conservatively be evaluated at height h (q_i = q_h)"; **verify** wording), and the tool takes no opening heights, so q_z at the highest opening could not be computed anyway. **R_i** (Sec. 26.13.1.1) is still not applied; that is conservative (R_i ≤ 1.0). See "Remaining open items".
- **O5:** fixed (W1).
- **O6:** addressed by a note (W5); R itself is still not computed (outside the tool's scope, as the User Manual states).
- **O7 closed, kept as is:** the combined Fig. 29.4-1 "Hexagonal or octagonal" row keeps K_d = 1.00 (5% conservative for hexagonal members). Splitting the row would add a near-duplicate row to the Fig. 29.4-1 table and a saved-label migration for a 5% gain; not done. See "Remaining open items" if wanted.
- **O8:** not changed; needs engineer (below).

### Needs engineer
1. **O1, Sec. 7.6.1 l_u floor.** Does the printed ASCE 7-16 Sec. 7.6.1 / Fig. 7.6-1 give a minimum l_u (20 ft or 25 ft) for the unbalanced drift height, and is the 25 ft floor the tool uses for drifts (Sec. 7.7.1 / 7.8) right for 7-16? Recommendation: keep 25 ft for both unless the printed text says otherwise (conservative).
2. **O2, 780 CMR.** Does 780 CMR 10th Ed. amend the hurricane-prone or wind-borne debris region definitions (or the glazing-protection requirement) for Massachusetts? Recommendation: if not amended, keep the ASCE 7-16 Sec. 26.2 test as now implemented.
3. **O8, adjacent structures, Sec. 7.7.2.** For a windward drift on a lower roof next to a separate taller structure, does it apply only when s < 20 ft and s < 6h (the tool's reading), or for any separation, truncated at the lower-roof edge? Recommendation: keep the current reading (the full untruncated drift where s < 20 ft is conservative); if the engineer reads 7.7.2 as "any separation", add the windward drift for s ≥ 20 ft truncated at the edge (it reaches the lower roof only when 4h_d > s).

### Remaining open items
- **R_i (O4):** optional Sec. 26.13.1.1 reduction for partially enclosed buildings with a single unpartitioned volume: a checkbox (default off), V_i from the geometry, A_og from the opening schedule, GC_pi × R_i on screen and in Excel. Conservative as it stands; implement only if wanted.
- **Hexagonal members (O7):** if wanted, add a separate "Hexagonal" Fig. 29.4-1 row with K_d = 0.95 and keep "Hexagonal or octagonal" (K_d = 1.00) for old projects, so no saved label changes.
- **Observed, not changed:** the unbalanced surcharge length 8h_d√S/3 is not truncated at the eave (L_sur can exceed W on low slopes). This only overstates the displayed extent of a load that cannot exist past the eave (conservative, display).

## 2026-10-18 — PR: claude/asce7-d11-report — D11: slim calculation-sheet report and §6 links (Tier 1, display only; PR #294: https://github.com/mlococo88/All-Structural/pull/294)

- **Engineer request:** AUDIT.md D11 (2026-10-14); scope decided 2026-10-18: **slim report** for this tool (inputs → worked results, no D/C section). The existing report builder (`runPrint`) is refreshed to the calculation-sheet format, not rewritten: the sections are still built by the tabs' own renderers. CLAUDE.md §6 "show the work and link to it". Format from Section Property Calculator (#290) and Gusset Plate Rating.
- **Provision:** none. No formula, factor, unit, code reference or computed result changed. No storage key, saved format or hand-off payload changed (`asce7bldg.autosave`, `asce7bldg.projects`, `S.print` keys, `bridgeSuite.v1.buildingLoads` unchanged); no input field added (the title block already has Project, Job No., Computed by, Date, Checked by, Chk. Date).

### D11-1. Print report in the calculation-sheet format
- **What changes for the user:** the output of **Print / PDF** (header button and Project tab button, both existing; dialog unchanged except three fixed "always printed" labels and its hint). **Ctrl+P without the button is unchanged:** a blank page on main and on this branch (`#report` is empty until the button builds it; everything else is hidden in print).
- **Where:** Section J, `runPrint()` replaced by the block from `/* D11 (2026-10-18): slim calculation-sheet report` to the end of `runPrint()` (just above `Section K : INIT`): new `A7_TOOL`, `a7PageCSS(tb)`, `a7ApplyPageCSS(css)`, `A7_CH`, `a7Refs(body,sel)`, `a7InputEcho(h)`. Print CSS: the two lines `#rpt-hdr{position:fixed;…}` and `#report{padding-top:0.72in}` replaced by the `.cr-*` rules (anchor `/* D11 calculation sheet (2026-10-18)`). `openPrint()`: the two disabled labels "Title block and disclaimer footer" / "Status register and governing loads" became three ("Cover with title block, references, contents and disclaimer footer", "Inputs", "Results summary: …"). To re-apply by hand, copy that block, those CSS lines and labels.
- **Before:** a fixed title-block header repeated on every page (`#rpt-hdr`), then the dashboard (its panels numbered 1–5, clashing with the section numbers), then the selected sections 1…n (panels n.k), then the disclaimer. No cover, references, contents or page numbers.
- **After:**
  - **Cover:** title, project, subject, task, "Design loads: inputs and worked results", codes (ASCE/SEI 7-16; 780 CMR 10th Ed. when the jurisdiction is MA), author and version; title block Project / Project No. (`tb_job`) / Calculated by (`tb_by`) / Date (`tb_date`) / Checked by (`tb_chk`) / Checked date (`tb_chkdate`) / Subject / Task / Site / Risk Category ("—" when blank).
  - **References** (`a7Refs`): collected from the text of the printed sections (Sec., Eq., Table, Fig. and Ch. citations, grouped by ASCE 7-16 chapter; 780 CMR 10th Ed. numbers; KaTeX and SVG text excluded), so it lists only what the printout cites. Also "Hazard data" (source as entered) for manual entry, and IBC 2021 / the legacy workbook ("edition: verify") when the User Manual is printed.
  - **Numbered contents** with links; sections: **1 Inputs** (new, always printed: the entered values as entered, five tables: site/risk/hazard, exposure/topography, geometry and roof loads, openings/glazing/enclosure, snow/wind/seismic options) → Design Basis → Enclosure → Snow → Wind: Velocity Pressure → Walls → Roof → Components (if any) → Seismic → Combinations → Captured 3-D view (if any) → **Results Summary** (the dashboard: status register, cross-tab checks, governing design values, wind envelope, advisories; always printed, moved from the front) → User Manual. Subsections n.k = the tabs' numbered panels (as before); panels get report-only ids `rpt-n-k`.
  - **No D/C lines** (the tool has none; the status register reports method status only).
  - **Print header / footer** (`a7PageCSS`, `<style id="a7-page">` filled while the report exists, emptied with the report after printing): letter, margins 0.95/0.5/0.7/0.5 in; top "Project No / Description" (subject, else task), "Computed By / Checked By", "Date / Date" (checked date); bottom "<project> (ASCE 7-16 Building Load Generator)" and "Page X of Y".
- **Panel key attribute:** `panel()`: `p.id="pnl-"+key;` → `p.id="pnl-"+key; p.dataset.k=key;` (link target; some renderers overwrite the panel id with `s-*`).

### D11-2. §6 links ("Worked in"; "see §n.k" in the report)
- **Helpers** above `/* ---------------- Dashboard ----------------` (anchor `/* D11 links (CLAUDE.md §6, 2026-10-18): a value quoted`): `a7TabName`, `a7WorkedIn(host,items)`, `a7Goto(tab,key)` (opens the tab, opens the panel, scrolls to it and flashes it, as `goto` does). CSS `.wkLink` after `@keyframes fl`.
- **New lines** (one "Worked in:" line each, `/* D11 links */`): Dashboard, Governing Design Values (enclosure and GC<sub>pi</sub> → Enclosure · Classification and Internal Pressure, or Enclosure Classification for a free roof; h → Design Basis · Building Geometry; q<sub>h</sub> → Wind: Velocity Pressure · Velocity Pressure; p<sub>f,des</sub> → Snow · Minimum Roof Snow Load, or Flat Roof Snow Load when Sec. 7.3.4 does not apply; p<sub>s</sub> → Design Snow Summary; SDC, C<sub>s</sub>, V → Seismic panels); Dashboard, Wind Pressure Envelope (each direction's walls → Wind: Walls · Wind Direction, roof → Wind: Roof · Roof, Wind Direction; free roof → Monoslope Free Roof); Combinations, Basis (W → Walls · Minimum Design Wind Load; Q<sub>E</sub> → Base Shear; S balanced → Design Snow Summary; S unbalanced → Unbalanced Snow Load).
- **Report:** each link reads "see §n.k" with an internal link; a target left out of the printout reads "see the <Tab> tab, <panel> (not in this printout)".

### Check case (default project, title block Project "Test Building", Job 26-101)
- Report: 69 letter pages (main: 60; the cover, references and contents add 3, the Inputs section 1, the larger header margin the rest; the User Manual is the last 18). §1 Inputs (1.1–1.5), §2 Design Basis, §3 Enclosure, §4 Snow (4.1–4.7), §5 Velocity Pressure (5.1–5.4), §6 Walls, §7 Roof, §8 Seismic, §9 Combinations, §10 Results Summary (10.1–10.4), §11 User Manual.
- Hand check (§5.4, Eq. 26.10-1): K<sub>h</sub> = 2.01 (36/900)<sup>2/9.5</sup> = 1.0207 (§5.3), K<sub>zt</sub> = 1.0, K<sub>d</sub> = 0.85, K<sub>e</sub> = e<sup>0</sup> = 1.0000, V = 119 mph (Melrose, RC II): q<sub>h</sub> = 0.00256 × 1.0207 × 1.0 × 0.85 × 1.0 × 119² = 0.0022211 × 14,161 = **31.45 psf**; Results Summary §10.2 "q<sub>h</sub> 31.45 psf … q<sub>h</sub>: see §5.4". Same as origin/main.

### How verified (Tier 1)
- `node tests/check-syntax.mjs "ASCE7-16 Load Generator.html"`: 10 scripts pass. No other tests exist for this tool.
- `node tests/compare.mjs --tool page --file "ASCE7-16 Load Generator.html"`: page.storage same; page.text differs only by the new "Worked in" line of the Dashboard (KaTeX is not in the kit for this URL: blocked on both sides).
- Main vs branch, headless Chromium (Playwright via `tests/lib.mjs`, KaTeX 0.16.9 from `tests/libs`, Plotly 2.35.2 from its npm package outside the repo), 5 cases: default (MA Melrose, RC II, Exp C, flat, Site D); RC IV, Exp B, gable m = 0.5, Site C, Nantucket, openings + glazing, coastal; manual hazard entry, RC III, Exp D, hip m = 0.25 ridge Y, Site E, 2D ridge topography, z<sub>g</sub> = 900 ft, fully exposed; RC I, Exp B, monoslope free roof, Site B without v<sub>s</sub>, obstructed flow; monoslope m = 0.08, Boston, Site D default, C<sub>u</sub>T<sub>a</sub>, conservative tables. In every case `R` (JSON), the text of all 11 output tabs (less the "Worked in" lines), the saved snapshot and the `bridgeSuite.v1.buildingLoads` hand-off are identical to main; building the report leaves `R` unchanged; the header/footer style and the report are emptied after printing; 0 console errors.
- Report PDFs (print media, `preferCSSPageSize`): 69 / 73 / 81 / 55 / 69 pages; every internal link resolves (85 / 85 / 87 / 64 / 85); 0 KaTeX errors; pages looked at (cover, references and contents, Inputs, Velocity Pressure, Combinations, Results Summary).
- In the app: all 54 "Worked in" links (default, free roof, gable) open the right tab with the target panel open, in view and flashed.
- **Other copies:** none (tool-specific).

### Open items (noticed, not changed)
- **User Manual cites "tornado (Ch. 32)"** (Part 1, scope list): ASCE 7-16 has no Ch. 32; tornado loads are Ch. 32 of ASCE 7-22. The references table flags it ("verify"). Change the manual wording to "tornado (not in ASCE 7-16; Ch. 32 of ASCE 7-22)"? Text only, no result.
- **Duplicate panel key `o-rf0`** on the Wind: Roof tab ("Roof Procedure Selected" and "Roof, Wind Direction +X" share it, so their collapse state and DOM id are shared). Display only; the links target the later one. Rename the per-direction keys (`"o-rfd"+i`) if wanted (would reset saved collapse state of those panels only).
- **p<sub>f,des</sub> when Sec. 7.3.4 does not apply** (θ ≥ 15°): the solver sets p<sub>f,des</sub> = p<sub>f</sub> (`sn.pfDes=sn.minApplies?Math.max(sn.pf,sn.pmGov):sn.pf`), so the link points to Flat Roof Snow Load, where p<sub>f</sub> is worked; the Minimum Roof Snow Load panel only says the minimum does not apply. The 780 CMR tabulated minimum is then not applied either; confirm that is intended (no change made).
- **Report length:** default 69 pages (was 60); the User Manual appendix (ticked by default) is 18 of them.

## 2026-10-18 — D11 follow-ups (engineer's decisions)

Display/defaults only; no computed result changes (`R` identical to main for default, Gable 0.5 and Gable 0.25 cases, checked headless).

1. **User Manual, scope list (Section H):** removed the tornado mention. ASCE 7-16 has no Ch. 32 (tornado loads are Ch. 32 of ASCE 7-22).
   - Before: `<li><b>Floor live load L, rain load R, ice, flood, and tornado (Ch. 32).</b> Not addressed.`
   - After: `<li><b>Floor live load L, rain load R, ice and flood.</b> Not addressed.`
   - Also removed the now-unused `32:` entry from the chapter-title map used by `a7Refs`.
2. **Snow, Minimum Roof Snow Load panel (`o-sn2`):** behaviour is unchanged. The 780 CMR Table 1604.11 note 1 minimum still applies only when θ < 15°, like ASCE 7-16 Sec. 7.3.4 (engineer's decision). When θ ≥ 15° and the community has a tabulated minimum, the note now says so.
   - Before: `"…is 15° or steeper, so the Sec. 7.3.4 minimum does not apply."`
   - After: the same sentence, plus `"The 780 CMR Table 1604.11 note 1 minimum flat roof snow load (X psf) is treated the same way and is not applied at this slope (engineer's decision 2026-10-18)."`
   - Check: Melrose, Gable 0.5 (θ = 26.57°) shows the note with 30.00 psf; p_f,des = p_f, unchanged.
3. **Print dialog default (`printSel`):** the User Manual is now unticked by default.
   - Before: `S.print[s.k]=true;`
   - After: `S.print[s.k]=(s.k!=="man");`
   - Only applies when no print selection has been saved; saved choices are kept.


## 2026-11-01 — PR: claude/rpt-asce7 — Report output tab in the shared report viewer (A7RP; slim report by topic; display only, no calculation change) (PR #559: https://github.com/mlococo88/All-Structural/pull/559)

Line numbers are approximate; search for the anchor text. Every code site is tagged `A7RP`.

### A7RP. "Report" output tab (shared/report.js, shared/steps.js)   [display only]
- **Engineer request (2026-11-01, report rollout plan):** a slim report grouped by topic in the shared viewer: navigation tree, §n.m, search, collapse / expand, see-links, links to the tool's tabs, and print with a title block (no owner cell), running header and page numbers.
- **Coordinator decisions recorded:**
  - The D11 "Print / PDF" (`openPrint` / `runPrint`) is unchanged.
  - Step values are values of `R` (`R.snow`, `R.wind`, `R.enc`, `R.site`, `R.seis`, `R.geom`, `R.checks`). Only the substitution strings are formatted, with `R2` / `RN` as on the tabs.
  - Title block: Project, Project No. (Job No.), Calculated by, Date, Checked by, Checked date (Chk. Date). All are existing fields.
- **Saved data:**
  - The Report tab is kept out of the saved state. It is not added to `TABS`, and `S.tab` is not changed by it; `A7RP.on` is in memory only.
  - So `asce7bldg.autosave` / `asce7bldg.projects` and exported files are unchanged, and an older copy of the tool never meets an unknown tab.
  - Clicking any other tab, a Dashboard `goto()` link or an `a7Goto()` "Worked in" link leaves the Report.
- **Code:**
  - `<script src="shared/steps.js">` and `<script src="shared/report.js">` after KaTeX.
  - `buildTabs()`: the existing buttons also clear `A7RP.on`, and a "Report" button is appended.
  - `render()`: `if(A7RP.on){ renderReport(h); return; }`.
  - `goto()`, `a7Goto()`: `A7RP.on=false`.
  - A new block before Section K INIT (anchor `REPORT tab (A7RP, 2026-11-01)`):
    - `a7Model()`, `a7Topics()`, `renderReport(h)`;
    - a `beforeprint` listener. The print CSS hides `#outbody`, so the report goes into `#rp-print`. It does nothing while the D11 report (`#report`) is being printed.
- **Sections and topics:**
  1. Summary: governing design values with links to their steps; status register.
  2. Project and building.
  3. Snow:
     - [flat roof p_g, C_e, C_t, I_s, p_f];
     - [minimum and design p_m, p_f,des];
     - [sloped C_s, p_s].
  4. Wind:
     - [basic V, K_d, G, GC_pi];
     - [velocity pressure K_zt, K_h, K_e, q_h].
  5. Seismic:
     - [site coefficients S_s, S_1, F_a, F_v, S_MS, S_M1, S_DS, S_D1];
     - [SDC];
     - [period T_a, C_u T_a, T];
     - [C_s base / max / min, C_s, V].
  6. Notes: blocking errors, warnings and the scope statement.
  - Wall, roof and component pressures, the story distribution and the combinations stay on their tabs (linked).
- **How verified (headless Chromium, KaTeX 0.16.9 served locally):**
  - 5 projects: default; gable 30° with Risk IV, Exposure D and title fields; 2D ridge topography at 900 ft elevation with C_u T_a; low p_g gable with Site Class E and high S_s / S_1; Site Class E with S_s = 1.8.
  - 33 or 34 steps in 9 topics. 0 unresolved or duplicate references, 0 KaTeX errors, no raw TeX, no NaN.
  - 24 step values per project equal `R` exactly (snow, wind, seismic). The Dashboard shows the same q_h, p_s, V and C_s.
  - `R` and the saved snapshot are unchanged by opening the Report tab. 0 console errors.
  - Ctrl+P on the Report tab prints the report alone with the @page header. A report link opens the Seismic tab. Ctrl+P on another tab does not print the report.
  - origin/main vs the branch: the text of the 11 output tabs (3-D Model excluded), the input panel and the saved snapshot are identical.
  - `node tests/check-syntax.mjs` passes.
- **Open item:** at 390 px the page is 729 px wide because of the existing two-panel layout (input panel min-width 390 px) and title bar. Unchanged; the report itself fits its column.
- **Other copies:** none. `shared/README.md` lists the tool.

Diff (`ASCE7-16 Load Generator.html`, `git diff -U0` against origin/main):

```diff
diff --git a/ASCE7-16 Load Generator.html b/ASCE7-16 Load Generator.html
index cdf1ad0..01963af 100644
--- a/ASCE7-16 Load Generator.html	
+++ b/ASCE7-16 Load Generator.html	
@@ -288,0 +289,3 @@ svg.sch .ld{stroke:var(--bad);fill:var(--bad)}
+<!-- A7RP: shared worked steps and the shared report viewer (classic scripts, relative path: keep the shared folder next to this file) -->
+<script src="shared/steps.js"></script>
+<script src="shared/report.js"></script>
@@ -1926,2 +1929,4 @@ function buildTabs(){
-  TABS.forEach(([k,t])=>{const b=el("div","tab"+(S.tab===k?" on":""),esc(t));
-    b.onclick=()=>{S.tab=k;autosave();render();};h.appendChild(b);});
+  TABS.forEach(([k,t])=>{const b=el("div","tab"+(S.tab===k&&!A7RP.on?" on":""),esc(t));
+    b.onclick=()=>{S.tab=k;A7RP.on=false;autosave();render();};h.appendChild(b);});
+  { const b=el("div","tab"+(A7RP.on?" on":""),"Report");   /* A7RP: the Report tab (not in TABS, not saved) */
+    b.onclick=()=>{A7RP.on=true;render();document.getElementById("outbody").scrollTop=0;};h.appendChild(b); }
@@ -1932 +1937 @@ function goto(a){
-  S.tab=m[a]||"basis"; render();
+  S.tab=m[a]||"basis"; A7RP.on=false; render();   /* A7RP: a link opens its tab */
@@ -1947 +1952 @@ function a7Goto(tab,key){
-  S.tab=tab; S.open[key]=true; autosave(); render();
+  S.tab=tab; S.open[key]=true; A7RP.on=false; autosave(); render();   /* A7RP */
@@ -4318,0 +4324 @@ function render(){
+  if(A7RP.on){ renderReport(h); return; }   /* A7RP */
@@ -4650,0 +4657,118 @@ function runPrint(){
+/* ==================================================================
+   REPORT tab (A7RP, 2026-11-01): a slim calculation report in the shared viewer (shared/report.js: navigation tree,
+   numbered sections §n.m, collapse / expand, search, Print with a title block, running header and page numbers),
+   grouped by topic (SharedSteps.group): snow, wind velocity pressure, seismic base shear, with the status register and
+   the governing design values. Every value is a value of R (R.snow, R.wind, R.enc, R.site, R.seis), as the output tabs
+   show them; only the substitution strings are formatted (R2 / RN, as the tabs). The detailed wind wall, roof and
+   component pressures, the story distribution and the combinations stay on their tabs (linked). The Report tab is kept
+   out of the saved state (S.tab is not changed by it; A7RP.on is in memory only), so saved projects are unchanged.
+   The D11 "Print / PDF" is unchanged.
+   ================================================================== */
+const A7RP={on:false,closed:new Set(),api:null,doc:null};
+const a7S=o=>SharedSteps.step(o);
+function a7Topics(list){
+  const L=list.filter(t=>t.steps&&t.steps.length),steps=[].concat(...L.map(t=>t.steps));
+  const topics=L.map(t=>{const q=SharedSteps.group(t.steps,[{key:"k",title:t.title,ref:t.ref,ids:()=>true,res:t.res}],{strip:false})[0];return{title:t.title,ref:t.ref||"",n:t.steps.length,cls:q.cls,chip:q.chip,res:q.res};});
+  return {type:"steps",scope:"a7",steps,topics};
+}
+const a7Plain=s=>String(s==null?"":s).replace(/<sub>(.*?)<\/sub>/g,(m,a)=>"$_{"+a+"}$").replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">");
+function a7Model(){
+  const tb={}; document.querySelectorAll("[data-tb]").forEach(i=>tb[i.id.slice(3)]=i.value);
+  const sn=R.snow,w=R.wind,g=R.geom,q=R.seis,st=R.site,e=R.enc,secs=[],A="ASCE 7-16 ";
+  /* ---------- snow ---------- */
+  const SN=[{title:"Flat roof snow load",ref:A+"Sec. 7.3",res:/pf$/,steps:[
+    a7S({id:"sn.pg",label:"Ground snow load ("+st.source+")",sym:"p_{g}",value:sn.pg,unit:"psf",d:2}),
+    a7S({id:"sn.Ce",label:"Exposure factor ("+sn.CeLabel+", "+CE_ROUGH[S.expCat]+")",sym:"C_{e}",value:sn.Ce,unit:"",d:2,ref:A+"Table 7.3-1"}),
+    a7S({id:"sn.Ct",label:"Thermal factor ("+S.thermal+")",sym:"C_{t}",value:sn.Ct,unit:"",d:2,ref:A+"Table 7.3-2"}),
+    a7S({id:"sn.Is",label:"Snow importance factor (Risk Category "+S.risk+")",sym:"I_{s}",value:sn.Is,unit:"",d:2,ref:A+"Table 1.5-2"}),
+    a7S({id:"sn.pf",label:"Flat roof snow load",sym:"p_{f}",eq:"0.7\\,C_{e}\\,C_{t}\\,I_{s}\\,p_{g}",sub:"0.7 \\times "+R2(sn.Ce)+" \\times "+R2(sn.Ct)+" \\times "+R2(sn.Is)+" \\times "+R2(sn.pg),value:sn.pf,unit:"psf",d:2,ref:A+"Eq. 7.3-1"})]}];
+  const mn=[];
+  if(sn.minApplies){
+    mn.push(a7S({id:"sn.pm",label:"Code minimum roof snow load"+(sn.pg<=20?" (p_g ≤ 20 psf)":" (p_g > 20 psf)"),sym:"p_{m}",eq:sn.pg<=20?"I_{s}\\,p_{g}":"20\\,I_{s}",sub:sn.pg<=20?R2(sn.Is)+" \\times "+R2(sn.pg):"20 \\times "+R2(sn.Is),value:sn.pmCode,unit:"psf",d:2,ref:A+"Sec. 7.3.4"}));
+    mn.push(a7S({id:"sn.pfDes",label:"Design flat roof snow load"+(sn.pmTab>0?" (with the 780 CMR Table 1604.11 note 1 minimum)":""),sym:"p_{f,des}",eq:"\\max(p_{f}, p_{m}, p_{f,min,tab})",sub:"\\max("+R2(sn.pf)+", "+R2(sn.pmCode)+", "+R2(sn.pmTab)+")",value:sn.pfDes,unit:"psf",d:2,note:sn.minGoverns?"The minimum governs: it is a separate uniform load case, not combined with drift, unbalanced or partial loading (Sec. 7.3.4).":""}));
+  } else mn.push(a7S({id:"sn.pfDes",label:"Design flat roof snow load (roof slope "+R2(g.theta)+"° ≥ 15°: the Sec. 7.3.4 minimum does not apply)",sym:"p_{f,des}",eq:"p_{f}",sub:"",value:sn.pfDes,unit:"psf",d:2}));
+  SN.push({title:"Minimum and design flat roof snow load",ref:A+"Sec. 7.3.4",res:/pfDes$/,steps:mn});
+  SN.push({title:"Sloped roof snow load",ref:A+"Sec. 7.4",res:/ps$/,steps:[
+    a7S({id:"sn.Cs",label:"Roof slope factor ("+sn.cs.branch+"; θ = "+R2(g.theta)+"°)",sym:"C_{s}",eq:g.theta<=sn.cs.lo?"":"1 - \\frac{\\theta - \\theta_{0}}{70 - \\theta_{0}}",sub:g.theta<=sn.cs.lo?"":"1 - \\frac{"+R2(g.theta)+" - "+R2(sn.cs.lo)+"}{70 - "+R2(sn.cs.lo)+"}",value:sn.cs.cs,unit:"",d:3,ref:A+"Fig. 7.4-1",note:g.theta<=sn.cs.lo?"θ ≤ "+R2(sn.cs.lo)+"°: C_s = 1.0.":""}),
+    a7S({id:"sn.ps",label:"Sloped roof (balanced) snow load",sym:"p_{s}",eq:"C_{s}\\,p_{f}",sub:RN(sn.cs.cs,3)+" \\times "+R2(sn.pf),value:sn.ps,unit:"psf",d:2,ref:A+"Eq. 7.4-1",note:sn.ros>0?"Rain-on-snow surcharge of "+R2(sn.ros)+" psf added to the balanced case only (Sec. 7.10).":""})]});
+  /* ---------- wind velocity pressure ---------- */
+  const kz=w.kzt;
+  const WP=[{title:"Basic parameters",ref:A+"Sec. 26.5, 26.6, 26.11",res:/\.V$/,steps:[
+    a7S({id:"wi.V",label:"Basic wind speed, Risk Category "+S.risk+" ("+st.source+")",sym:"V",value:w.V,unit:"mph",d:2,ref:A+"Sec. 26.5"}),
+    a7S({id:"wi.Kd",label:"Directionality factor, MWFRS",sym:"K_{d}",value:w.kdMWFRS,unit:"",d:2,ref:A+"Table 26.6-1"}),
+    a7S({id:"wi.G",label:"Gust-effect factor ("+(S.Goverride?"user override":"rigid structure")+")",sym:"G",value:w.G,unit:"",d:2,ref:A+"Sec. 26.11"}),
+    a7S({id:"wi.GCpi",label:"Internal pressure coefficient ("+e.cls+")",sym:"GC_{pi}",value:"±"+R2(e.gcpi.p),unit:"",d:2,ref:A+"Table 26.13-1"})]},
+   {title:"Velocity pressure at the mean roof height",ref:A+"Sec. 26.8–26.10",res:/qh$/,steps:[
+    a7S({id:"wi.Kzt",label:kz.none?"Topographic factor (no abrupt change in topography declared)":"Topographic factor at the mean roof height",sym:"K_{zt}",eq:kz.none?"":"(1 + K_{1} K_{2} K_{3})^{2}",sub:kz.none?"":"(1 + "+RN(kz.K1,4)+" \\cdot "+RN(kz.K2,4)+" \\cdot "+RN(kz.K3,4)+")^{2}",value:kz.kzt,unit:"",d:4,ref:kz.none?A+"Sec. 26.8.2":A+"Eq. 26.8-1"}),
+    a7S({id:"wi.Kh",label:"Velocity pressure exposure coefficient (Exposure "+S.expCat+(w.qh.kzInfo.floored?"; h < 15 ft: at 15 ft":"")+")",sym:"K_{h}",eq:"2.01\\left(\\frac{z}{z_{g}}\\right)^{2/\\alpha}",sub:"2.01\\left(\\frac{"+R2(w.qh.kzInfo.zEff)+"}{"+w.qh.kzInfo.zg.toFixed(0)+"}\\right)^{2/"+w.qh.kzInfo.a.toFixed(1)+"}",value:w.qh.kz,unit:"",d:4,ref:A+"Table 26.10-1 note 1"}),
+    a7S({id:"wi.Ke",label:"Ground elevation factor (site elevation "+R2(S.siteElev)+" ft)",sym:"K_{e}",eq:"e^{-0.0000362\\,z_{g}}",sub:"e^{-0.0000362 \\times "+R2(S.siteElev)+"}",value:w.ke,unit:"",d:4,ref:A+"Table 26.9-1 note 2"}),
+    a7S({id:"wi.qh",label:"Velocity pressure at the mean roof height h = "+R2(g.h)+" ft",sym:"q_{h}",eq:"0.00256\\,K_{h} K_{zt} K_{d} K_{e} V^{2}",sub:"0.00256 \\times "+RN(w.qh.kz,4)+" \\times "+RN(kz.kzt,4)+" \\times "+R2(w.kdMWFRS)+" \\times "+RN(w.ke,4)+" \\times "+R2(w.V)+"^{2}",value:w.qh.q,unit:"psf",d:2,ref:A+"Eq. 26.10-1"})]}];
+  /* ---------- seismic ---------- */
+  const SE=[];
+  SE.push({title:"Site coefficients and design spectral accelerations",ref:A+"Sec. 11.4",res:/SD1$/,steps:[
+    a7S({id:"se.Ss",label:"Mapped MCE_R short-period acceleration ("+st.source+")",sym:"S_{s}",value:st.Ss,unit:"g",d:3}),
+    a7S({id:"se.S1",label:"Mapped MCE_R 1-second acceleration",sym:"S_{1}",value:st.S1,unit:"g",d:3})].concat(q.Fa===null?[]:[
+    a7S({id:"se.Fa",label:"Short-period site coefficient (Site Class "+S.siteClass+")",sym:"F_{a}",value:q.Fa,unit:"",d:3,ref:A+"Table 11.4-1"}),
+    a7S({id:"se.Fv",label:"Long-period site coefficient (Site Class "+S.siteClass+")",sym:"F_{v}",value:q.Fv,unit:"",d:3,ref:A+"Table 11.4-2"}),
+    a7S({id:"se.SMS",label:"MCE_R spectral response acceleration, short periods",sym:"S_{MS}",eq:"F_{a}\\,S_{s}",sub:RN(q.Fa,3)+" \\times "+RN(st.Ss,3),value:q.SMS,unit:"g",d:4,ref:A+"Eq. 11.4-1"}),
+    a7S({id:"se.SM1",label:"MCE_R spectral response acceleration, 1 s",sym:"S_{M1}",eq:"F_{v}\\,S_{1}",sub:RN(q.Fv,3)+" \\times "+RN(st.S1,3),value:q.SM1,unit:"g",d:4,ref:A+"Eq. 11.4-2"}),
+    a7S({id:"se.SDS",label:"Design spectral response acceleration, short periods",sym:"S_{DS}",eq:"\\frac{2}{3} S_{MS}",sub:"\\frac{2}{3} \\times "+RN(q.SMS,4),value:q.SDS,unit:"g",d:4,ref:A+"Eq. 11.4-3"}),
+    a7S({id:"se.SD1",label:"Design spectral response acceleration, 1 s",sym:"S_{D1}",eq:"\\frac{2}{3} S_{M1}",sub:"\\frac{2}{3} \\times "+RN(q.SM1,4),value:q.SD1,unit:"g",d:4,ref:A+"Eq. 11.4-4"})])});
+  if(q.Fa!==null){
+    SE.push({title:"Seismic design category",ref:A+"Sec. 11.6",res:/SDC$/,steps:[a7S({id:"se.SDC",label:"Seismic design category: the more severe of Table 11.6-1 ("+q.sdcS+", from S_DS) and Table 11.6-2 ("+q.sdc1+", from S_D1)",sym:"SDC",value:q.SDC,unit:"",d:0,ref:A+"Tables 11.6-1, 11.6-2",note:q.sdcOverride||""})]});
+    SE.push({title:"Fundamental period",ref:A+"Sec. 12.8.2",res:/Tused$/,steps:[
+      a7S({id:"se.Ta",label:"Approximate fundamental period",sym:"T_{a}",eq:"C_{t}\\,h_{n}^{x}",sub:q.Ct+" \\times "+R2(q.hn)+"^{"+q.x+"}",value:q.Ta,unit:"s",d:4,ref:A+"Eq. 12.8-7"}),
+      a7S({id:"se.CuTa",label:"Upper limit on the calculated period",sym:"C_{u} T_{a}",eq:"",sub:RN(q.Cu,3)+" \\times "+RN(q.Ta,4),value:q.T,unit:"s",d:4,ref:A+"Sec. 12.8.2"}),
+      a7S({id:"se.Tused",label:"Period used for C_s ("+(S.useTa?"T_a: permitted and conservative":"C_u T_a: requires a substantiated analysis")+")",sym:"T",value:q.Tused,unit:"s",d:4})]});
+    const cs=[a7S({id:"se.CsB",label:"Base value (R = "+R2(q.R)+", I_e = "+R2(q.Ie)+"; "+S.sfrs+")",sym:"C_{s}",eq:"\\frac{S_{DS}}{R/I_{e}}",sub:"\\frac{"+RN(q.SDS,4)+"}{"+R2(q.R)+"/"+R2(q.Ie)+"}",value:q.CsBase,unit:"",d:4,ref:A+"Eq. 12.8-2"})];
+    if(isFinite(q.CsMax))cs.push(a7S({id:"se.CsMax",label:"Upper limit"+(q.exc1148?" (Sec. 11.4.8 Exception 2: × 1.5)":""),sym:"C_{s,max}",eq:q.Tused<=q.TL?"\\frac{S_{D1}}{T (R/I_{e})}":"\\frac{S_{D1} T_{L}}{T^{2} (R/I_{e})}",sub:q.Tused<=q.TL?"\\frac{"+RN(q.SD1,4)+"}{"+RN(q.Tused,4)+" ("+R2(q.R)+"/"+R2(q.Ie)+")}":"\\frac{"+RN(q.SD1,4)+" \\times "+R2(q.TL)+"}{"+RN(q.Tused,4)+"^{2} ("+R2(q.R)+"/"+R2(q.Ie)+")}",value:q.CsMax,unit:"",d:4,ref:A+(q.Tused<=q.TL?"Eq. 12.8-3":"Eq. 12.8-4")}));
+    cs.push(a7S({id:"se.CsMin",label:"Lower limit"+(q.CsMinS1!==null?" (with Eq. 12.8-6, S_1 ≥ 0.6 g: "+RN(q.CsMinS1,4)+")":""),sym:"C_{s,min}",eq:"\\max(0.044\\,S_{DS} I_{e}, 0.01)",sub:"\\max(0.044 \\times "+RN(q.SDS,4)+" \\times "+R2(q.Ie)+", 0.01)",value:q.CsMin,unit:"",d:4,ref:A+"Eq. 12.8-5"}),
+      a7S({id:"se.Cs",label:"Governing seismic response coefficient",sym:"C_{s}",eq:"\\min(C_{s,base}, C_{s,max}) \\ge C_{s,min}",sub:"",value:q.Cs,unit:"",d:4,ref:A+"Sec. 12.8.1.1"}),
+      a7S({id:"se.V",label:"Seismic base shear (effective seismic weight W = "+R2(q.Wt)+" kip)",sym:"V",eq:"C_{s}\\,W",sub:RN(q.Cs,4)+" \\times "+R2(q.Wt),value:q.Vbase,unit:"kip",d:2,ref:A+"Eq. 12.8-1"}));
+    SE.push({title:"Seismic response coefficient and base shear",ref:A+"Sec. 12.8.1",res:/\.V$/,steps:cs});
+  }
+  /* ---------- 1. Summary ---------- */
+  const ck={ok:"OK",warn:"Review",err:"Blocked",na:"N/A"}, cls={ok:"ok",warn:"hi",err:"ng",na:"na"};
+  const gv=[["Enclosure classification","—",e.cls,"Sec. 26.2",""],["Internal pressure coefficient","GC_pi","±"+R2(e.gcpi.p),"Table 26.13-1","a7/wi.GCpi"],["Mean roof height","h",R2(g.h)+" ft","Sec. 26.2",""],
+    ["Velocity pressure at h","q_h",R2(w.qh.q)+" psf","Eq. 26.10-1","a7/wi.qh"],["Design flat roof snow load","p_f,des",R2(sn.pfDes)+" psf","Sec. 7.3","a7/sn.pfDes"],["Design balanced snow load","p_s",R2(sn.balanced)+" psf","Sec. 7.4","a7/sn.ps"]];
+  if(q.Fa!==null)gv.push(["Seismic design category","SDC",q.SDC,"Sec. 11.6","a7/se.SDC"],["Seismic response coefficient","C_s",RN(q.Cs,4),"Sec. 12.8.1.1","a7/se.Cs"],["Seismic base shear","V",R2(q.Vbase)+" kip","Eq. 12.8-1","a7/se.V"]);
+  secs.push({title:"Summary",subs:[{title:"Governing design values",items:[{type:"table",head:["Quantity","Symbol","Value","Reference"],rows:gv.map(r=>[r[0],r[1],{t:r[2],n:true,key:r[4]||undefined},A+r[3]])},
+      {type:"note",text:"Each value links to the step where it is worked. Design loads only: this tool makes no member or connection check. The same values are on the Dashboard[[tab:dash| ↗]]."}]},
+    {title:"Status register",items:[{type:"table",head:["Check","Status","Basis"],rows:R.checks.map(c=>[c.name,{t:c.state==="warn"&&c.standing?"Standing":ck[c.state],cls:cls[c.state]},a7Plain(c.detail)])},
+      {type:"note",text:"OK = method applied cleanly; Review = conservative fallback or unverified assumption; Blocked = input outside the method; N/A = does not apply; Standing = an assumption the tool always makes."}]}]});
+  /* ---------- 2. Inputs ---------- */
+  secs.push({title:"Project and building",subs:[{title:"Project and site",items:[{type:"kv",rows:[["Project",tb.project||"—"],["Subject",tb.subject||"—"],["Task",tb.task||"—"],["Job No.",tb.job||"—"],
+      ["Computed by",(tb.by||"—")+(tb.date?", "+tb.date:"")],["Checked by",(tb.chk||"—")+(tb.chkdate?", "+tb.chkdate:"")],["Risk Category",String(S.risk)],["Exposure category",S.expCat],["Site class",S.siteClass],
+      ["Mean roof height h",R2(g.h)+" ft"],["Roof slope θ",R2(g.theta)+"°"],["Site data",st.source]]},{type:"note",text:"All inputs are listed on the input tabs and in the Print / PDF report; the building geometry is shown on the Design Basis[[tab:basis| ↗]] and 3-D Model[[tab:3d| ↗]] tabs."}]}]});
+  secs.push({title:"Snow",subs:[{title:"Roof snow loads",items:[a7Topics(SN),{type:"note",text:"Unbalanced, drift and rain-on-snow details: Snow[[tab:snow| ↗]] tab."}]}]});
+  secs.push({title:"Wind",subs:[{title:"Velocity pressure",items:[a7Topics(WP),{type:"note",text:"Velocity pressure by height and the wall, roof and component pressures are worked on the Wind: Velocity Pressure[[tab:windp| ↗]], Wind: Walls[[tab:walls| ↗]], Wind: Roof[[tab:roof| ↗]] and Wind: Components[[tab:elem| ↗]] tabs."}]}]});
+  secs.push({title:"Seismic",subs:[{title:"Equivalent lateral force",items:(q.Fa===null?[{type:"note",warn:true,text:"No site coefficient is tabulated for Site Class "+S.siteClass+" at these accelerations: a site response analysis is required (Sec. 11.4.8); the seismic results are not computed."}]:[]).concat([a7Topics(SE),{type:"note",text:"Vertical distribution, story shears and overturning: Seismic[[tab:seis| ↗]] tab. Load combinations: Combinations[[tab:comb| ↗]] tab."}])}]});
+  const notes=[];(R.err||[]).forEach(m=>notes.push({type:"note",warn:true,text:"Blocking: "+a7Plain(m)}));(R.warn||[]).forEach(m=>notes.push({type:"note",warn:true,text:a7Plain(typeof m==="string"?m:(m.msg||m.text||JSON.stringify(m)))}));
+  if(!notes.length)notes.push({type:"note",text:"No warnings."});
+  secs.push({title:"Notes",subs:[{title:"Warnings and assumptions",items:notes.concat([{type:"note",text:"This tool generates design loads only. Snow drift and sliding snow, partial loading, components and cladding beyond the tabulated elements, torsional wind cases and the seismic provisions beyond base shear and its vertical distribution are outside its scope (User Manual)."}])}]});
+  /* rich notation: q_h, GC_pi, p_f,des → $…$ */
+  const not=s=>String(s==null?"":s).replace(/([A-Za-z])_([A-Za-z0-9]+(?:,[A-Za-z]+)?)/g,(m,a,b)=>"$"+a+"_{"+b+"}$"),cell=c=>(c&&typeof c==="object")?Object.assign({},c,{t:not(c.t)}):not(c);
+  secs.forEach(s=>s.subs.forEach(qq=>qq.items.forEach(it=>{if(it.type==="note")it.text=not(it.text);else if(it.type==="kv")it.rows=it.rows.map(r=>[not(r[0]),not(r[1])]);
+    else if(it.type==="table"){it.head=it.head.map(cell);it.rows=it.rows.map(r=>r.map(cell));}else if(it.type==="steps")it.steps.forEach(x=>{x.label=x.label.replace(/_/g,"");x.note=String(x.note||"").replace(/_/g,"");});})));
+  const today=new Date().toISOString().slice(0,10);
+  return {title:"ASCE 7-16 Building Loads — Calculation Report",subtitle:(tb.project||"Untitled")+(tb.subject?" — "+tb.subject:""),code:"ASCE 7-16: snow (Ch. 7), wind (Ch. 26–30), seismic (Ch. 11–12) · "+APP_VERSION,
+    info:[["Project",tb.project],["Project No.",tb.job],["Calculated by",tb.by],["Date",tb.date||today],["Checked by",tb.chk],["Checked date",tb.chkdate]],
+    head:{left:"Project No. "+(tb.job||"—")+" — "+String(tb.subject||tb.project||"Building loads").slice(0,40),right:"Computed: "+(tb.by||"—")+" "+(tb.date||today)+" · Checked: "+(tb.chk||"—")+" "+(tb.chkdate||""),foot:(tb.project||"Untitled")+" (ASCE 7-16 Building Load Generator)"},
+    sections:secs};
+}
+function renderReport(h){
+  if(!window.SharedReport||!window.SharedSteps){note(h,"shared/report.js or shared/steps.js is not loaded: keep the shared folder next to this file.","e");A7RP.api=null;A7RP.doc=null;return;}
+  if(!R.enc||!R.geom||!R.wind||!R.snow||!R.seis){const b=panel(h,"o-rpb","1.","Report not available","");(R.err||[]).forEach(e=>note(b,esc(e),"e"));note(b,"The calculation did not complete; correct the blocking error and the report will be built.","e");A7RP.api=null;A7RP.doc=null;return;}
+  let Mo;try{Mo=a7Model();}catch(e){note(h,"Report error: "+esc(e&&e.message),"e");A7RP.api=null;A7RP.doc=null;console.error(e);return;}
+  const box=el("div","");h.appendChild(box);
+  A7RP.api=SharedReport.mount(box,Mo,{closed:A7RP.closed,onGoto:k=>{if(!TABS.some(t=>t[0]===k))return;A7RP.on=false;S.tab=k;autosave();render();document.getElementById("outbody").scrollTop=0;}});
+  A7RP.doc=A7RP.api.doc;
+}
+/* Ctrl+P while the Report tab is shown prints the report alone (the print CSS hides #outbody, so it goes into #rp-print); otherwise unchanged */
+window.addEventListener("beforeprint",()=>{
+  if(!A7RP.on||!A7RP.doc||document.body.classList.contains("rp-printing")||document.getElementById("report").innerHTML)return;
+  let box=document.getElementById("rp-print");if(!box){box=document.createElement("div");box.id="rp-print";document.body.appendChild(box);}
+  box.innerHTML='<div class="rp"><article class="rp-doc">'+SharedReport.html(A7RP.doc,{lazy:false})+"</article></div>";
+  document.body.classList.add("rp-printing");
+});
+
```

## 2026-11-02 — PR: claude/phone-print-asce7 — Phone / tablet layout (below 900 px) and a report print break (PHN; display only, no calculation change)

Engineer-approved overnight job (2026-11-02): phone layout at 390 / 768 px and report print polish, one PR per tool. Every code site is tagged `PHN`.

### PHN-1. One-column layout below 900 px   [display only]
- **Problem:** the tool had no small-screen layout. The page is a fixed 100 vh flex column. The title block is one row with eight title fields in a 4-column grid, and the input panel has `min-width:390px` beside the output panel. At 390 px the page scrolled sideways 339 px, the title fields were squeezed to a few pixels, and the output panel was off-screen. At 768 px the title fields overlapped each other and the output panel had about 370 px.
- **Where:** a new block at the end of the first `<style>`, just before `</style>`, anchor `/* PHN (2026-11-02): phone / tablet (below 900 px)`. It must come after the layout rules, which have the same specificity.
- **Added:**
```css
@media screen and (max-width:899px){
  body{height:auto;min-height:100vh;overflow:visible}
  #titlewrap{flex-wrap:wrap;gap:8px 14px;padding:8px 10px}
  #appid{flex:1 1 100%;border-right:none;padding-right:0}
  #tbfields{flex:1 1 100%;grid-template-columns:repeat(2,minmax(0,1fr))}
  #tbactions,#tbshare{flex:1 1 100%;flex-direction:row;flex-wrap:wrap}
  #main,#mainwrap,#inpanel,#outpanel{display:block}
  #inpanel{max-width:none;min-width:0;border-right:none;border-bottom:2px solid var(--navy)}
  #inbody{overflow:visible;padding-bottom:16px}
  #outbody{overflow:visible;padding:10px 10px 40px}
  .pnl>.bd{overflow-x:auto}   /* a wide table scrolls inside its panel */
}
@media screen and (max-width:520px){#tbfields{grid-template-columns:minmax(0,1fr)}}
```
- The input panel (with its tab bar) now sits above the output panel (with its tab bar). Both tab bars already wrap. The page scrolls as one column; the panels do not scroll by themselves, so the KaTeX page-scroll trap (Spread Footing #524) cannot occur. Wide tables (Enclosure 740 px, Wind: Walls 592 px, Seismic, Combinations) scroll inside their panel. At 900 px and up nothing changes (`screen` and `max-width:899px`). Print is unchanged.

### PHN-2. Report print: topic heading split (fixed in shared/report.js)
- Report → Print report: on page 7 the heading of topic "4. Seismic response coefficient and base shear" was split from its one-line result. Fixed in `shared/report.js` (`.rp-top{break-inside:avoid}` in print); see `fixlog/shared-report.md`.
- The "Print / PDF" calc sheet (all sections, 69 pages) was checked as well. Nothing is clipped at the page edge: the widest table, the Enclosure test matrix, fits within the 7.5 in text width. Nothing was changed.

### Smoke test
- `tests/smoke/phone-layout.mjs` gains the tool key `asce7` (every output tab including Report). It fails on origin/main at 390 px (339 px sideways scroll) and passes on this branch.

### How verified (no computed result, saved key or hand-off changed)
- origin/main vs this branch, headless Chromium, file://: the page text (`innerText`) at 1280 px on load and on all 13 output tabs, the whole-document `textContent` (425,382 chars) and localStorage after load are identical. Screenshots at 900 and 1280 px are pixel-identical (0 differing pixels) on load and on all 13 tabs.
