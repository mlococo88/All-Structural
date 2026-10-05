# Fix log — Spread Footing.html

Governing basis used for fixes: ACI 318-19; ASCE 7-16 combinations as already implemented (unchanged).

## 2026-10-04 — PR: claude/fix-spread-footing (PR link added after merge)

Line numbers are approximate, as of this fix. Search for the anchor text.

### F1. γf (flexural moment transfer) used γv   [calc change] [more conservative]
- **Where:** `computePhase2`, punching block, `gfChk` (≈ line 3046). Anchor: `const gfX=`
- **Problem:** `1-(1-γv)` evaluates to γv. The moment to be developed by flexure in the c + 3h band (`MfX`, `MfY`) was γv·Mu instead of γf·Mu. For a square pedestal that is 0.40 instead of 0.60, so the moment was 33% low.
- **Governing provision:** ACI 318-19 8.4.2.2 (γf = 1/(1 + (2/3)√(b1/b2))) and 8.4.4.2.2 (γv = 1 − γf).
- **Before:**
  ```js
  const gfX=1-(1-detail.gvX), gfY=1-(1-detail.gvY); // gamma_f = 1 - gamma_v
  ```
- **After:**
  ```js
  const gfX=1-detail.gvX, gfY=1-detail.gvY; // gamma_f = 1 - gamma_v
  ```
- **Check case:** single 2 × 2 ft pedestal centred on an 8 × 8 × 2 ft footing, D: P = 100 k, My = 50 k-ft (combination 1.4D) → γv = 0.40, MuY = 70.0 k-ft.
  - Before: γf = 0.40, MfX = 28.0 k-ft, required As in the band = 0.320 in².
  - After: γf = 0.60, MfX = 42.0 k-ft, required As in the band = 0.480 in² (provided 8.43 in², still OK).
  - Hand check: γf = 1/(1 + 2/3) = 0.600; 0.6 × 70 = 42.0 k-ft.
- **How verified:** engine extracted and run in node, before and after.
- **Other copies of this code:** none known.

### F2. A live surcharge alone never activated L   [bug fix / calc change] [more conservative]
- **Where:** `computeAll`, after `present.D=true;` (≈ line 832). Anchor: `present.D=true;`
- **Problem:** `present.L` was set only from pedestal loads. If q_L,sur > 0 and no pedestal had an L load, no combination contained L, and the live surcharge was dropped from every ASD and LRFD combination.
- **Governing provision:** ASCE 7-16 2.3.1 / 2.4.1 (L in the combinations). The factors are unchanged.
- **Before:**
  ```js
   present.D=true;
   let combosASD,combosLRFD;
  ```
- **After:**
  ```js
   present.D=true;
   if(surL>0)present.L=true; // a live surcharge on its own must still generate the L combinations
   let combosASD,combosLRFD;
  ```
- **Check case:** default project with every pedestal L = 0 and q_L,sur = 200 psf (F_L,sur = 0.200 × 75.5 ft² = 15.10 k).
  - Before: no `D + L`, `D + 0.75L + 0.75S` or `1.2D + 1.6L + 0.5S` combinations; the maximum ASD ΣP = 334.94 k.
  - After: those combinations are generated, and the maximum ASD ΣP = 341.27 k.
- **How verified:** node run of `computeAll`, before and after.
- **Other copies of this code:** none known.

### F3. Punching Vu: add back the factored body weight inside the critical perimeter   [calc change] [more conservative]
- **Where:** `computePhase2`, punching `combos.forEach` (≈ line 2970). Anchor: `const relief=(cx1>cx0&&cy1>cy0)?pressResultant`
- **Problem:** the pressure solid is solved from a resultant that includes the factored footing self-weight and overburden (less buoyancy). The flexure and one-way free bodies subtract that body force (`bodyResultant`), but punching did not. The relief therefore included the body force sitting inside the perimeter, which understated Vu.
- **Governing provision:** ACI 318-19 22.6 (two-way shear demand at the critical section, 22.6.4.1).
- **Before:**
  ```js
     const relief=(cx1>cx0&&cy1>cy0)?pressResultant(c.pp,cx0,cx1,cy0,cy1).F:0;
     const Vu=Math.max(pl.P-relief,0); // kips
  ```
- **After:**
  ```js
     const relief=(cx1>cx0&&cy1>cy0)?pressResultant(c.pp,cx0,cx1,cy0,cy1).F:0;
     // (comment)
     const bodyIn=(cx1>cx0&&cy1>cy0)?bodyResultant(c.nr,cx0,cx1,cy0,cy1).F:0;
     const Vu=Math.max(pl.P-relief+bodyIn,0); // kips
  ```
  `relief` and `bodyIn` are also added to the `detail` object (`detail={q,Acrit,AcritFull,Vu,relief,bodyIn,...`). The report label changed from `(P_u - qA_{crit})` to `(P_u - ∫q dA_{crit} + W_{u,body,crit})`.
- **Check case:** default project, Ped 1, combination 1.2D + 1.6L + 0.5S.
  - Before: Vu = 152.13 k, vu = 33.25 psi, DCR = 0.235.
  - After: Vu = 160.60 k (relief 88.68 k, body add-back 8.47 k), vu = 35.10 psi, DCR = 0.248.
  - Hand check of the add-back: A_crit = 13.444 ft². Self-weight 1.2 × 30 k / 80 ft² = 0.450 ksf × 13.444 = 6.05 k. EV 16.308 k / 75.5 ft² = 0.216 ksf × (13.444 − 2.25) = 2.42 k. Total 8.47 k.
  - RISAFoundation benchmark (concrete density 0, overburden 0): punching Vu = 778.0145 k before and after (unchanged).
- **How verified:** node run, before and after; benchmark rerun.
- **Other copies of this code:** none known.

### F4. Sliding checked on the resultant √(Hx² + Hy²)   [calc change] [more conservative]
- **Where:** `computeAll`, ASD map (≈ line 925); `renderDashboard`, `comboTable`, `renderStability` §4.2, `renderPlots`. Anchor: `const FSsly=Math.abs(r.Hy)`
- **Problem:** friction was compared with each horizontal component separately. With Hx and Hy acting together, base friction resists the vector sum, so the per-axis FS overstated the margin by up to √2.
- **Governing provision:** statics; the FS target (input, default 1.5) is unchanged.
- **Before:**
  ```js
    const FSsly=Math.abs(r.Hy)>1e-9?(mu*Nn+PpY)/Math.abs(r.Hy):Infinity;
    return{cb,r,bear,cap,DCR,edges,otMin,FSslx,FSsly};
  ```
- **After:**
  ```js
    const FSsly=Math.abs(r.Hy)>1e-9?(mu*Nn+PpY)/Math.abs(r.Hy):Infinity;
    const Hres=Math.hypot(r.Hx,r.Hy);
    const PpR=Hres>1e-9?(PpX*Math.abs(r.Hx)+PpY*Math.abs(r.Hy))/Hres:0;
    const FSslr=Hres>1e-9?(mu*Nn+PpR)/Hres:Infinity;
    return{cb,r,bear,cap,DCR,edges,otMin,FSslx,FSsly,Hres,PpR,FSslr};
  ```
  Also: `const govSlr=asd.reduce((a,b)=>b.FSslr<a.FSslr?b:a,asd[0]);` added after `govSly`, and `govSlr` added to the returned object. A new dashboard chip "Sliding, resultant √(Hx²+Hy²)" (pass/fail) was added next to the existing x and y chips, which are kept. A new table column "FS sl,res", a resultant equation block in §4.2, and a plot trace were also added.
- **Passive assumption:** the passive force of each face is projected onto the direction of the resultant. This reduces exactly to the old per-axis value when the load is along one axis. Passive defaults to 0.
- **Check case:** default project with D: Vx = 5, Vy = 5 k on both pedestals (Wx shears removed), combination D. ΣP = 314.94 k, μ = tan(⅔·32°) = 0.3906, Hx = Hy = 10 k.
  - Before: FS x = FS y = 12.30 (the only check).
  - After: also FS_res = 0.3906 × 314.94 / 14.142 = 8.70 (governing).
- **How verified:** node run, before and after.
- **Other copies of this code:** none known.

### F5. Development length per ACI 318-19 25.4.2.4 with the actual cb, λ, ψg, ψe and the √f'c cap   [calc change] [more conservative]
- **Where:** `devLength` (≈ line 2419) and its caller in `renderFootingDesign` §5.4 (≈ line 3401). New input: `mat.coating` (select, default `'none'`), backfilled in `migrateState`.
- **Problem:** (cb + Ktr)/db was hard-coded at 2.5 (the maximum). λ was hard-coded at 1.0, ψg and ψe were ignored, and √f'c was uncapped. All of these are unconservative for close spacing, lightweight concrete, Grade 80/100 bars, epoxy-coated bars and f'c > 10 ksi. The equation was also labelled 25.4.2.3; it is the general Eq. 25.4.2.4a.
- **Governing provision:** ACI 318-19 25.4.2.4 (Eq. 25.4.2.4a), Table 25.4.2.5 (ψt, ψe, ψs, ψg, with ψtψe ≤ 1.7), 25.4.1.4 (√f'c ≤ 100 psi), and 25.4.2.1 (ℓd ≥ 12 in).
- **Before:**
  ```js
  function devLength(size,fc,fy,topBar){
   const db=BAR_DIA[size];if(!db)return 0;
   const psi_t=topBar?1.3:1.0, psi_e=1.0, psi_s=(size<=6)?0.8:1.0, lam=1.0;
   const cb=Math.max(2.5,db); // assume adequate cover/spacing; ktr=0 => (cb+ktr)/db capped at 2.5
   let ratio=Math.min((2.5),(2.5)); // conservative confinement term =2.5
   let Ld=(3/40)*(fy/(lam*Math.sqrt(fc)))*(psi_t*psi_e*psi_s/2.5)*db;
   return Math.max(Ld,12);
  }
  ...
    const Ld=devLength(size,P2.fc,P2.fy,false);
  ```
- **After:**
  ```js
  function devLength(size,fc,fy,topBar,o){
   o=o||{};
   const db=BAR_DIA[size];if(!db)return o.detail?{Ld:0}:0;
   const lam=(o.lam>0)?o.lam:1.0;
   const psi_t=topBar?1.3:1.0, psi_s=(size<=6)?0.8:1.0;
   const psi_g=(fy<=60000)?1.0:((fy<=80000)?1.15:1.3);
   const cover=(o.cover>0)?o.cover:0, spc=(o.spc>0)?o.spc:Infinity;
   const clrSpc=spc-db;
   const psi_e=(o.coating==='epoxy')?((cover<3*db||clrSpc<6*db)?1.5:1.2):1.0;
   const psi_te=Math.min(psi_t*psi_e,1.7);
   const cb=Math.min(cover+db/2,spc/2), Ktr=0;
   const conf=Math.min((cb+Ktr)/db,2.5);
   const sqfc=Math.min(Math.sqrt(fc),100);
   const LdRaw=(conf>0)?(3/40)*(fy/(lam*sqfc))*(psi_te*psi_s*psi_g/conf)*db:Infinity;
   const Ld=Math.max(LdRaw,12);
   return o.detail?{Ld,LdRaw,db,lam,psi_t,psi_e,psi_te,psi_s,psi_g,cb,Ktr,conf,sqfc}:Ld;
  }
  ...
    const spcD=(dir==='x')?num(state.freinf.botX.spc):num(state.freinf.botY.spc);
    const dv=devLength(size,P2.fc,P2.fy,false,{lam:P2.lam,cover:num(state.mat.coverBot),spc:spcD,coating:state.mat.coating,detail:true});
    const Ld=dv.Ld;
  ```
  - New input row, placed before "Cover, bottom": `<select data-path="mat.coating">` with the options `none` and `epoxy`.
  - `defaultState().mat` gains `coating:'none'`, and `migrateState` backfills `'coating'`. Old saved projects load as uncoated, which reproduces the old ψe = 1.0.
  - The §5.4 equation block now prints λ, √f'c, ψtψe, ψs, ψg, cb and (cb + Ktr)/db. The citation changed from "ACI 318-19 25.4.2.3" to "ACI 318-19 25.4.2.4, Table 25.4.2.5", in the report and in the manual §4C.4.
- **Assumption:** cb uses the bottom clear cover (side cover is assumed to be no less than that) and s/2. Ktr = 0.
- **Check case:** #8 bars, f'c = 4,000, fy = 60,000, clear cover 3 in. Before: 28.46 in in every case. After:

  | Case | Intermediate values | ℓd after |
  |---|---|---|
  | s = 4 in | cb = min(3.5, 2.0) = 2.0; ratio 2.0 | **35.58 in**. Hand check: 0.075 × 60000 / 63.25 × 1 / 2.0 × 1.0 = 35.57 |
  | s = 9 in | ratio 2.5 | 28.46 in (unchanged) |
  | fy = 80 ksi | ψg = 1.15 | 43.64 in (the old function gave 37.95) |
  | λ = 0.75 | | 37.95 in |
  | Epoxy, s = 9 in | ψe = 1.2 | 34.15 in |
  | f'c = 12,000 psi | √f'c = 100 | 18.00 in (the old function gave 16.43) |

- **How verified:** node run of both functions.
- **Other copies of this code:** other private ℓd implementations exist in `ACI Rebar Development Length.html`, `Concrete Beam Capacity.html`, `BasePlateAnchorDesigner.html` and `Retaining Wall Designer.html` (AUDIT §2.1). They were not touched.

### F6. √f'c ≤ 100 psi in one-way Vc and two-way vc   [calc change] [more conservative, only when f'c > 10,000 psi]
- **Where:** `computePhase2` (new `sqV` next to `const sq=Math.sqrt(fc);`, ≈ line 2449). Used in `Vc`, `VcCap`, `vc1`, `vc2` and `vc3`, in the `vcCode` display value, and in the display strings.
- **Governing provision:** ACI 318-19 22.5.3.1 (one-way) and 22.6.3.1 (two-way). No shear reinforcement is provided.
- **Before:**
  ```js
    let Vc=vcCoef*lam*lam_s*sq*bIn*dV/1000;
    const VcCap=5*lam*sq*bIn*dV/1000;
    const vc1=4*lam*lam_s*sq; const vc2=(2+4/beta)*lam*lam_s*sq; const vc3=(2+alphas*d/bo)*lam*lam_s*sq;
  ```
- **After:**
  ```js
   const sqV=Math.min(sq,100);
    let Vc=vcCoef*lam*lam_s*sqV*bIn*dV/1000;
    const VcCap=5*lam*sqV*bIn*dV/1000;
    const vc1=4*lam*lam_s*sqV; const vc2=(2+4/beta)*lam*lam_s*sqV; const vc3=(2+alphas*d/bo)*lam*lam_s*sqV;
  ```
  The `vcCode` display value now uses `Math.min(Math.sqrt(P2.fc),100)`.
- **Check case:** single 2 × 2 pedestal, 8 × 8 × 2 ft footing, f'c = 12,000 psi.
  - Before: vc = 357.77 psi, one-way Vc,x = 223.04 k.
  - After: vc = 326.60 psi, Vc,x = 203.60 k.
  - Hand check: the ratio is 100/109.54 = 0.913 (357.77 × 0.913 = 326.6).
  - No change for f'c ≤ 10,000 psi.
- **How verified:** node run.
- **Other copies:** none known.

### F7. Mat maximum spacing check min(3h, 18 in)   [new check] [more conservative]
- **Where:** `directionDesign` in `computePhase2` (≈ line 2883), dashboard flexure chip (≈ line 1119), and §5.x flexure notes (≈ line 3361).
- **Problem:** the mats are check-only. A sparse mat that met As,min passed with no spacing check.
- **Governing provision:** ACI 318-19 7.7.2.3 (s ≤ min(3h, 18 in)) as applied to footings (Ch. 13, 13.3.3 / 13.3.4).
- **Before:** no check.
- **After:**
  ```js
    const sMax=Math.min(3*tin,18);
    const spcBot=num((dir==='x')?state.freinf.botX.spc:state.freinf.botY.spc);
    const spcTop=num((dir==='x')?state.freinf.topX.spc:state.freinf.topY.spc);
    const spcBotOK=!(AsBot>0)||spcBot<=sMax+1e-9;
    const spcTopOK=!(asMinTopReq&&AsTop>0)||spcTop<=sMax+1e-9;
  ```
  - These values are returned from `directionDesign`.
  - The dashboard "Flexure (footing)" chip fails with "s > s_max (...)".
  - The flexure section shows a fail box or an OK note.
  - The top mat is checked only where hogging makes it a flexural mat, which is consistent with the existing As,min logic.
- **Check case:** default project with the bottom x-bars changed to #11 @ 20 in (t = 30 in). sMax = min(90, 18) = 18 in, so this is NG. As,min alone passes.
  - Before: PASS. After: FAIL (spacing).
- **How verified:** node run.

### F8. Surcharges included in the structural (Phase 2) resultant   [calc change] [mixed: see note]
- **Where:** `netResultant` and `bodyResultant` in `computePhase2` (≈ lines 2507 and 2526), and the equilibrium self-check in `selfConsistency` (≈ line 2275).
- **Problem:** `surD` and `surL` were in the stability resultant but not in the structural resultant. Under partial contact the surcharge over the uplifted region was ignored.
- **Governing provision:** statics. The factors are the same as in the stability resultant (dead factor for q_D,sur, live factor for q_L,sur; in direct mode both ride the single envelope).
- **Before:**
  ```js
    P-=buF;                                      // buoyancy uplift at the centroid
    return{P,Mx,My,pl,swF,evF,buF,ex:...
  ...
    if(nr.evF&&Aev>1e-9){                        // overburden: plan minus pedestal footprints
     const wEV=nr.evF/Aev;
  ```
- **After:**
  ```js
    P-=buF;
    const fLsur=f.direct?(f.dead||1):(f.L||0);
    const surF=fDsw*(R.surD||0)+fLsur*(R.surL||0);
    P+=surF; My+=surF*xev; Mx+=surF*yev;
    return{P,Mx,My,pl,swF,evF,buF,surF,ex:...
  ...
    if((nr.evF||nr.surF)&&Aev>1e-9){
     const wEV=((nr.evF||0)+(nr.surF||0))/Aev;
  ```
  The self-check sum adds `+(c.nr.surF||0)`.
- **Check case:** single 2 × 2 pedestal, 8 × 8 × 2 ft footing, D: P = 40 k, My = 130 k-ft, q_D,sur = 500 psf, combination 1.4D.
  - Before: the surcharge was ignored. Net P = 99.68 k, e = 1.83 ft, 81.5% contact. Mu+ (x) = 92.27, Mu− (x) = 21.44 k-ft, Vu,x = 30.21 k.
  - After: net P = 141.68 k, e = 1.29 ft, full contact. Mu+ (x) = 87.89, Mu− (x) = 27.28 k-ft, Vu,x = 28.69 k.
  - Full-contact case (D: P = 200 k, no moment, q_D,sur = 500 psf): Mu+ (x) 157.88 → 156.30 k-ft (−1.0%), Vu,x 48.24 → 47.76 k. The change is small but not zero, because the surcharge is not applied over the pedestal footprint, while its pressure share is spread over the full plan. The same model is already used for EV.
- **⚠ Less conservative in some cases:** a surcharge on the cantilever pushes down against the soil pressure, so sagging moment and one-way shear can drop slightly (−1% to −5% in the cases above). Hogging (top-steel) moment rises. The old omission was not a consistent bound in either direction. If the engineer prefers to ignore the favourable part, this fix should be reverted, or the surcharge applied only in combinations where it is unfavourable.
- **How verified:** node run, before and after. RISAFoundation benchmarks (no surcharge) unchanged.

### F9. Export: deferred `revokeObjectURL`   [robustness] [no result change]
- **Where:** `#btnExport` click handler (≈ line 2366). Anchor: `_inputs.json';a.click();`
- **Before:**
  ```js
  a.download=(state.meta.number||state.meta.project||'spread_footing')+'_inputs.json';a.click();URL.revokeObjectURL(a.href);});
  ```
- **After:**
  ```js
  a.download=(state.meta.number||state.meta.project||'spread_footing')+'_inputs.json';a.click();
   const href=a.href;setTimeout(()=>URL.revokeObjectURL(href),60000);}); // revoke later: an immediate revoke can cancel the download (Firefox)
  ```

### F10. Stale "not yet checked" note   [display] [no result change]
- **Where:** `renderSchematic` §1.5 (≈ line 1192). Anchor: `Buoyancy U is applied at a factor of 1.0`
- **Before:** `... Structural (LRFD) design of the footing and pedestals is Phase 2 and is not yet checked here; LRFD combinations are generated and reported for that purpose.`
- **After:** `... Structural (LRFD, ACI 318-19) design of the footing and pedestals uses the generated LRFD combinations and is reported on the Footing Design and Pedestal Design tabs.`

### F11. Import: warn when the JSON does not look like a Spread Footing file   [robustness] [no result change]
- **Where:** `#fileImport` change handler (≈ line 2374). Anchor: `rd.onload=()=>{try{const j=JSON.parse(rd.result);`
- **Before:**
  ```js
  rd.onload=()=>{try{const j=JSON.parse(rd.result);state=Object.assign(defaultState(),j);migrateState();
  ```
- **After:**
  ```js
  rd.onload=()=>{try{const j=JSON.parse(rd.result);
    const looksSF=j&&typeof j==='object'&&!Array.isArray(j)&&j.geom&&typeof j.geom==='object'&&j.soil&&typeof j.soil==='object'&&Array.isArray(j.peds);
    if(!looksSF&&!confirm('"'+f.name+'" does not look like a Spread Footing input file (missing geometry, soil or pedestal data). Missing values will be filled with defaults.\n\nLoad it anyway?'))return;
    state=Object.assign(defaultState(),j);migrateState();
  ```
- The export format is unchanged (no tag added), so the check recognises the file by its required sections.

## 2026-10-04 — Engineer decisions applied

### F12. Surcharge kept in the structural (Phase 2) resultant (engineer's decision)   [decision record] [no result change]
- **Where:** `computePhase2`, `netResultant` / `bodyResultant` (see F8). Anchor: `const surF=fDsw*(R.surD||0)+fLsur*(R.surL||0);`
- **Problem:** F8 asked the engineer whether to keep the surcharge in the structural resultant, since it lowers sagging moment and one-way shear slightly (−1% to −5%), or to revert it or apply it only where unfavourable.
- **Decision:** the engineer keeps the surcharge in the structural resultant, as implemented in F8.
- **Governing provision:** statics (as F8).
- **Before / After:** unchanged (F8 code stands).
- **Check case:** F8 numbers stand (2 × 2 pedestal, 8 × 8 × 2 ft footing, 1.4D: Mu+ (x) = 87.89 k-ft, Mu− (x) = 27.28 k-ft, Vu,x = 28.69 k).
- **How verified:** no code change on this branch since F8.
- **Other copies of this code:** none known.

## 2026-10-04 — "All tools" link and shared project info
### F13. "← All tools" link; "Use shared project info" / "Share project info" buttons   [feature (no result change)]
- **Date:** 2026-10-04. **Type:** feature (no result change). Approved by the engineer (step 1 of the cross-tool hand-off work, HANDOFF.md §4.1).
- **What:** a small "← All tools" link to `tools.html` (`target="_top"`, because tools can be shown inside index.html's iframe), placed in the page heading block, above `<h1>Spread Footing Design Tool</h1>`. It is hidden in print.
- **Shared project info:** two buttons in the new `noprint` row directly under the title block `#titleblock`.
  - **Share** builds the full `fields` object (all 8 HANDOFF §4.1 fields, blank where this tool has no field) and calls `BridgeXfer.publish('projectMeta', {_schema:'bridge-project-meta', project:{name, bridgeId}, fields})`. Key: `bridgeSuite.v1.projectMeta` (+ `.updatedAt`).
  - **Use** calls `BridgeXfer.read('projectMeta','bridge-project-meta',1)`, shows a confirm listing the producer, time, project and every field that will change (old → new), and writes only this tool's mapped fields. A blank shared value never blanks a field. Apply path: sets each `#titleblock [data-path]` input and dispatches a bubbling `input` event, so the existing `handleFieldChange` updates `state`, autosaves and recalculates. Records `bridgeSuite.v1.projectMeta.adopted.<id>`.
- **Field mapping (shared → this tool):**

  | Shared field | Tool field | Label |
  |---|---|---|
  | `projectName` | `meta.project` | Project Name |
  | `jobNo` | `meta.number` | Project Number |
  | `preparedBy` | `meta.calcBy` | Calculated By |
  | `date` | `meta.calcDate` | Date |
  | `checkedBy` | `meta.chkBy` | Checked By |

  Not mapped: bridgeId, client, location. Checked Date (`meta.chkDate`) has no shared field.
- **Helpers added:** a plain `<script>` with BridgeXfer v1 verbatim from HANDOFF.md §5, then a plain `<script>` with `ProjMetaUI` (shown in full in the After code below) and this tool's field map. Both sit before the tool's own script.
- **Storage:** no existing key or saved-data format changed. New keys only: `bridgeSuite.v1.projectMeta`, `.updatedAt`, `.adopted.<id>` (HANDOFF.md §2).
- **Where / Before / After** (each change is an insertion; the Before text is the anchor and is kept):
  1. Anchor: `.titleblock input{width:100%;font-family:inherit;font-size:11px;padding:2px 4px;border:1px solid #bbb}`
     - Before:
       ```
       .titleblock input{width:100%;font-family:inherit;font-size:11px;padding:2px 4px;border:1px solid #bbb}
       ```
     - After:
       ```
       .titleblock input{width:100%;font-family:inherit;font-size:11px;padding:2px 4px;border:1px solid #bbb}
       .allToolsLink{font-size:10px;color:#1c4e80;text-decoration:none}
       .allToolsLink:hover{text-decoration:underline}
       @media print{.allToolsLink{display:none !important}}
       ```
  2. Anchor: `<div>`
     - Before:
       ```
        <div>
         <h1>Spread Footing Design Tool</h1>
       ```
     - After:
       ```
        <div>
         <a class="allToolsLink noprint" href="tools.html" target="_top" title="Open the list of all tools">&larr; All tools</a>
         <h1>Spread Footing Design Tool</h1>
       ```
  3. Anchor: `<div><label>Checked Date</label><input data-path="meta.chkDate"></div>`
     - Before:
       ```
        <div><label>Checked Date</label><input data-path="meta.chkDate"></div>
       </div>
       ```
     - After:
       ```
        <div><label>Checked Date</label><input data-path="meta.chkDate"></div>
       </div>
       <div class="noprint" style="margin:-4px 0 8px 0">
        <button id="btnUseProjMeta" title="Fill the title block from project info shared by another tool">Use shared project info</button>
        <button id="btnShareProjMeta" title="Make this title block available to the other tools">Share project info</button>
       </div>
       ```
  4. Anchor: `<script>`
     - Before:
       ```


       <script>
       /* ================= helpers ================= */
       ```
     - After:
       ```


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
       /* Spread Footing: shared project info field map and buttons (title block #titleblock). */
       (function(){
         var MAP=[{shared:'projectName',key:'meta.project',label:'Project Name'},
                  {shared:'jobNo',key:'meta.number',label:'Project Number'},
                  {shared:'preparedBy',key:'meta.calcBy',label:'Calculated By'},
                  {shared:'date',key:'meta.calcDate',label:'Date'},
                  {shared:'checkedBy',key:'meta.chkBy',label:'Checked By'}];
         function inp(k){ return document.querySelector('#titleblock [data-path="'+k+'"]'); }
         function values(){ var v={}; MAP.forEach(function(m){ var i=inp(m.key); v[m.key]=i?i.value:''; }); return v; }
         document.getElementById('btnShareProjMeta').addEventListener('click',function(){ ProjMetaUI.share(MAP, values(), 'Spread Footing', 'Spread Footing.html'); });
         document.getElementById('btnUseProjMeta').addEventListener('click',function(){
           var patch=ProjMetaUI.use(MAP, values(), 'spreadFooting'); if(!patch) return;
           Object.keys(patch).forEach(function(k){ var i=inp(k); if(!i) return; i.value=patch[k]; i.dispatchEvent(new Event('input',{bubbles:true})); });
         });
       })();
       </script>
       <script>
       /* ================= helpers ================= */
       ```
- **Governing provision:** none. UI and cross-tool data hand-off only (HANDOFF.md §2, §4.1, §5). No formula, factor, unit, code reference or computed result changed.
- **Check case:** not applicable (no calculation touched). Functional check: Spread Footing shares {Project Name "Route 9 over Mill Brook", Project Number "J-2026-114", Calculated By "MRL", Date "2026-10-04", Checked By "JKD"}; Use in this tool fills the mapped fields; a blank shared value leaves the existing field unchanged.
- **How verified:** `node --check` on every plain inline script; text/babel blocks transpiled with @babel/standalone; page loaded in jsdom with CDN libraries stubbed (React UMD served locally); Share → Use exercised across Spread Footing, BasePlateAnchorDesigner, Pile Designer, Concrete Anchor and Timber Beam Check (Timber: plain scripts in jsdom, the same calls its onClick handlers make, since it imports React from esm.sh) with a localStorage carried between pages; `git diff --numstat` shows only insertions.
- **Other copies:** BridgeXfer v1 and `ProjMetaUI` are duplicated (CLAUDE.md §3) in Pile Designer.html, Spread Footing.html, BasePlateAnchorDesigner.html, Concrete Anchor.html and Timber Beam Check.html (this PR), plus any other tools that received BridgeXfer in their own step-1 PRs.
- **`ProjMetaUI`:** given in full in the After code of the helper insertion above; the copy is identical in every tool listed.

## 2026-10-05 — PR: claude/conn-steelbeam-reactions (PR link added after merge)
### C1. Member-reaction hand-off receiver: "Pull from Steel Beam" and "Import hand-off (JSON)"   [feature: hand-off (no result change)]
- **Date / type:** 2026-10-05, feature: hand-off (no result change).
- **Where:** the row under the title block (anchor `<button id="btnShareProjMeta" title="Make this title block available to the other tools">Share project info</button>`); `renderPrintHeader()` (anchor `+(m.chkDate||'\u2013')+'</td></tr></table>';`); one new `<script>` block at the end of the file, just before `</body>` (anchor `Member-reaction hand-off receiver`).
- **Purpose:** reads channel `bridgeSuite.v1.memberReactions` (HANDOFF.md §4.8) and fills one pedestal's unfactored by-load-type rows `state.peds[i].loads[row]` from one beam support.
- **Sign convention verified:** "P positive = downward (compression on soil)" (Pedestals section note and the dashboard note). The sender's V is + down, so **P = V** (no sign change). +My shifts the soil resultant toward +x, +Mx toward +y.
- **Mapping:**

| Hand-off (support chosen by the user) | Footing target (pedestal chosen by the user) |
|---|---|
| `byLoadType.D` | row D: `P = V` (kips) |
| `byLoadType.L` | row L: `P = V` |
| `byLoadType.Lr` | row Lr: `P = V` |
| `byLoadType.S` | row S: `P = V` |
| `byLoadType.W` | row Wx (default) or Wy: `P = V` |
| `byLoadType.E` | not imported (no seismic type in this tool); warned if non-zero |
| `byCase` "other" cases | listed; default "do not import" |
| `M` (fixed supports) | beam toward +x: `My = −M` (default); −x: `My = +M`; +y: `Mx = −M`; −y: `Mx = +M`; or not imported |

- **User choices (logged in `state.bxSrc.memberReactions`):** support (default the first); pedestal (default the first); row per load type (defaults above; all-zero rows not imported); moment orientation (default +x); replace (default) or add; "also set the other components to 0" (default off).
- **Validation:** as BasePlateAnchorDesigner (same `check()`): `_schema`, version, corrupt JSON, `factored:true`, units (kip/lb, kip-ft/kip-in/lb-ft/lb-in), finite V and M. A warning is shown when the tool is in Direct factored mode (rows filled but unused).
- **Governing provision:** none changed. No formula, factor or default changed; the only effect is filling inputs the user confirms.
- **Before / After** (exact):
  1. Buttons under the title block.
     - Before:
  ```html
 <button id="btnShareProjMeta" title="Make this title block available to the other tools">Share project info</button>
</div>
  ```
     - After:
  ```html
 <button id="btnShareProjMeta" title="Make this title block available to the other tools">Share project info</button>
 <button id="btnPullMemberReactions" type="button" onclick="bxPullMemberReactions()" title="Import unfactored support reactions from Steel Beam Design into one pedestal's loads by type (HANDOFF.md, channel memberReactions)">Pull from Steel Beam<span id="bxMrNew" style="display:none;color:#b45309;font-weight:bold"> &#9679; new data available</span></button>
 <button id="btnImportMemberReactions" type="button" onclick="document.getElementById('bxMrFile').click()">Import hand-off (JSON)</button><input type="file" id="bxMrFile" accept=".json,application/json" style="display:none" onchange="bxImportMemberReactions(event)">
 <span id="bxMrSrc" style="font-size:11px;font-style:italic"></span>
</div>
  ```
  2. `renderPrintHeader()`, after the title-block table assignment.
     - Before:
  ```js
 '<tr><td>'+(m.project||'\u2013')+ … +(m.chkDate||'\u2013')+'</td></tr></table>';
}
  ```
     - After:
  ```js
 '<tr><td>'+(m.project||'\u2013')+ … +(m.chkDate||'\u2013')+'</td></tr></table>';
 if(typeof sfMrSourceLine==='function'&&sfMrSourceLine()){const sp=document.createElement('p');sp.style.cssText='font-size:10px;margin:2px 0';sp.textContent=sfMrSourceLine();$('#printHeader').appendChild(sp);}   /* hand-off source (HANDOFF.md §3.4) */
}
  ```
  3. New script, inserted just before `</body>` (Before: nothing). After:
  ```html
<script>
/* Member-reaction hand-off receiver (HANDOFF.md §4.8, channel memberReactions, sender: Steel Beam Design - AISC 15th.html).
   "Pull from Steel Beam" / "Import hand-off (JSON)". Nothing is applied on page load. The user picks a beam support
   and a target pedestal, maps each load type to the pedestal's by-load-type rows (D, L, Lr, S, Wx, Wy), chooses how a
   fixed-support moment is oriented on the footing axes, picks replace or add, reviews what will change, and confirms.
   Values are unfactored, kip and kip-ft, P + = down in both tools (no sign change on P).
   The source is kept in the new optional field state.bxSrc.memberReactions. */
(function(){
  var CH='memberReactions', SCHEMA='bridge-member-reactions', MAXV=1, RID='spreadFooting';
  var SRC_TYPES=['D','L','Lr','S','W','E'];
  var SRC_LBL={D:'Dead',L:'Live',Lr:'Roof live',S:'Snow',W:'Wind',E:'Seismic'};
  var DEF_ROW={D:'D',L:'L',Lr:'Lr',S:'S',W:'Wx',E:''};
  var FORCE={kip:1,kips:1,k:1,lb:0.001,lbf:0.001,lbs:0.001};               /* -> kip */
  var MOMENT={'kip-ft':1,'kip·ft':1,'k-ft':1,'ft-kip':1,'kip-in':1/12,'lb-ft':0.001,'ft-lb':0.001,'lb-in':0.001/12};   /* -> kip-ft */
  /* beam elevation x (first support -> last) along footing ... : component and factor applied to the sender's M (+CCW) */
  var AXIS={'+x':{c:'My',k:-1,lbl:'+x (My = −M)'},'-x':{c:'My',k:1,lbl:'−x (My = +M)'},
            '+y':{c:'Mx',k:-1,lbl:'+y (Mx = −M)'},'-y':{c:'Mx',k:1,lbl:'−y (Mx = +M)'},none:{c:null,k:0,lbl:'do not import M'}};
  function isNum(v){ return typeof v==='number' && isFinite(v); }
  function f2(v,d){ return isNum(v) ? (Math.abs(v)<1e-12?0:v).toFixed(d==null?2:d) : '—'; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function h(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!==undefined) e.innerHTML=html; return e; }
  function when(iso){ var d=new Date(iso); if(isNaN(d)) return String(iso||'?');
    function p(n){ return (n<10?'0':'')+n; }
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes()); }
  function projName(p){ return (p.project && typeof p.project==='object') ? (p.project.name||'') : String(p.project||''); }

  /* ---- validate and convert to kip / kip-ft ---- */
  function check(p){
    var out={err:[],warn:[],sups:[]};
    var e=BridgeXfer.validate(p,SCHEMA,MAXV); if(e){ out.err.push(e); return out; }
    if(p.factored===true){ out.err.push('The payload says its reactions are factored. This tool imports unfactored loads by type only.'); return out; }
    var u=p.units||{}, kf=FORCE[u.force], km=MOMENT[u.moment];
    if(!kf){ out.err.push('Unknown force unit "'+(u.force||'')+'". Accepted: kip, or lb (converted ÷ 1000).'); return out; }
    if(!km){ out.err.push('Unknown moment unit "'+(u.moment||'')+'". Accepted: kip-ft, kip-in, lb-ft, lb-in.'); return out; }
    if(kf!==1) out.warn.push('Forces converted from '+u.force+' to kip (× '+kf+').');
    if(km!==1) out.warn.push('Moments converted from '+u.moment+' to kip-ft (× '+km+').');
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
        if(SRC_TYPES.indexOf(t)<0){ out.warn.push('Support '+sid+': unknown load type "'+t+'" is listed as "other".'); rd(bt[t],'t:'+t,t+' (unknown type)',null); return; }
        rd(bt[t],'t:'+t,t+' — '+SRC_LBL[t],t);
      });
      rows.sort(function(a,b){ return (a.type?SRC_TYPES.indexOf(a.type):99)-(b.type?SRC_TYPES.indexOf(b.type):99); });
      if(s.byCase && typeof s.byCase==='object') Object.keys(s.byCase).forEach(function(cid){
        var c=s.byCase[cid]; if(c && c.type) return;
        rd(c,'c:'+cid,'case '+cid+(c&&c.name&&c.name!==cid?' ('+c.name+')':'')+' — not assigned to a type',null);
      });
      out.sups.push({id:sid,x:s.x,support:s.support||'',rows:rows});
    });
    if(!out.err.length && !out.sups.some(function(s){ return s.rows.length; })) out.err.push('The payload contains no reactions.');
    return out;
  }
  /* default mapping for one support: D/L/Lr/S to the same row, W to Wx, E and "other" cases and all-zero rows -> do not import */
  function defaultMap(s){
    var m={}; s.rows.forEach(function(r){ m[r.key]=(r.type && (Math.abs(r.V)>1e-9 || Math.abs(r.M)>1e-9)) ? DEF_ROW[r.type] : ''; }); return m;
  }
  function defaults(chk){
    var o={sup:0,ped:0,mode:'replace',zeroOther:false,axis:'+x',map:defaultMap(chk.sups[0])};
    return o;
  }
  /* ---- plan: exactly what will change. Pure apart from reading state. ---- */
  function plan(p,chk,o){
    var r={err:[],warn:[],changes:[],rows:[],set:{}};
    var s=chk.sups[o.sup]; if(!s){ r.err.push('Pick a support.'); return r; }
    var ped=state.peds[o.ped]; if(!ped){ r.err.push('Pick a pedestal (add one first if there is none).'); return r; }
    var ax=AXIS[o.axis]||AXIS.none;
    var add={}, from={};
    s.rows.forEach(function(row){
      var tr=o.map[row.key]||'';
      if(row.type==='E' && !tr && (Math.abs(row.V)>1e-9 || Math.abs(row.M)>1e-9)) r.warn.push('E (seismic) is not imported: this tool has no seismic load type (see its scope notes).');
      if(!tr) return;
      if(TYPES.indexOf(tr)<0){ r.err.push('Unknown target row '+tr+'.'); return; }
      var a=add[tr]=add[tr]||{P:0}; a.P+=row.V;
      if(Math.abs(row.M)>1e-9){
        if(ax.c){ a[ax.c]=(a[ax.c]||0)+ax.k*row.M; }
        else r.warn.push(row.label.split(' —')[0]+': the fixed-support moment M = '+f2(row.M,3)+' kip·ft is not imported (you chose "do not import M").');
      }
      (from[tr]=from[tr]||[]).push(row.label.split(' —')[0]);
      r.rows.push({from:row.label.split(' —')[0],row:tr,V:row.V,M:row.M,Mc:(ax.c&&Math.abs(row.M)>1e-9)?ax.c:null,Mv:(ax.c&&Math.abs(row.M)>1e-9)?ax.k*row.M:0});
    });
    var used=Object.keys(add);
    if(!used.length) r.err.push('Map at least one load type to a pedestal row.');
    used.forEach(function(tr){
      if(from[tr].length>1) r.warn.push(from[tr].join(' + ')+' are added together into row '+tr+'.');
      var cur=(ped.loads&&ped.loads[tr])||{P:0,Vx:0,Vy:0,Mx:0,My:0}, nw={};
      ['P','Vx','Vy','Mx','My'].forEach(function(k){
        var old=+cur[k]||0, v;
        if(k in add[tr]) v=(o.mode==='add'?old:0)+add[tr][k];
        else if(o.zeroOther) v=0;
        else return;
        v=Math.round(v*1e6)/1e6;
        if(v!==old || k==='P'){ nw[k]=v; r.changes.push({row:tr,field:k,from:old,to:v}); }
      });
      r.set[tr]=nw;
      if(!o.zeroOther && ['Vx','Vy','Mx','My'].some(function(k){ return !(k in add[tr]) && (+cur[k]||0)!==0; }))
        r.warn.push('Row '+tr+' of '+ped.label+' keeps its existing shear/moment ('+['Vx','Vy','Mx','My'].filter(function(k){ return !(k in add[tr]) && (+cur[k]||0)!==0; }).map(function(k){ return k+' '+f2(+cur[k]); }).join(', ')+'). Tick the option to set them to 0.');
    });
    if(state.loadMode==='direct') r.warn.push('The footing is in Direct factored mode. The by-load-type rows are filled but not used until you switch "Load input mode" to "By load type".');
    if(s.support==='fixed' && ax.c) r.warn.push('Fixed support: M is applied as '+ax.c+' = '+(ax.k<0?'−':'+')+'M (beam runs toward footing '+o.axis+'). Check this orientation against your framing plan.');
    return r;
  }
  function apply(p,chk,o,via){
    var r=plan(p,chk,o); if(r.err.length) return r;
    var ped=state.peds[o.ped];
    Object.keys(r.set).forEach(function(tr){
      if(!ped.loads[tr]) ped.loads[tr]={P:0,Vx:0,Vy:0,Mx:0,My:0};
      Object.keys(r.set[tr]).forEach(function(k){ ped.loads[tr][k]=r.set[tr][k]; });
    });
    if(!state.bxSrc || typeof state.bxSrc!=='object') state.bxSrc={};
    var s=chk.sups[o.sup];
    state.bxSrc.memberReactions={producer:p.producer||'',producerFile:p.producerFile||'',producedAt:p.producedAt||'',
      project:p.project||'',via:via||'pull',adoptedAt:new Date().toISOString(),
      support:s.id,supportType:s.support,pedestal:ped.label,pedIndex:o.ped,mode:o.mode,zeroOther:!!o.zeroOther,axis:o.axis,
      rows:r.rows.map(function(x){ return {from:x.from,row:x.row,V:x.V,M:x.M,Mc:x.Mc,Mv:x.Mv}; }),
      notes:(p.notes||[]).slice(0,20)};
    BridgeXfer.markAdopted(CH,RID,p.producedAt);
    r.ok=true;
    return r;
  }

  function openDialog(p,via){
    var chk=check(p);
    if(chk.err.length){ alert('Support-reaction hand-off refused:\n  '+chk.err.join('\n  ')); return null; }
    if(!state.peds || !state.peds.length){ alert('Pull from Steel Beam: add a pedestal first.'); return null; }
    var o=defaults(chk);
    var old=document.getElementById('bxMrOverlay'); if(old) old.remove();
    var ov=h('div'); ov.id='bxMrOverlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:200;display:flex;align-items:center;justify-content:center';
    var box=h('div'); box.style.cssText='background:#fff;border:2px solid #333;padding:12px 16px;width:820px;max-width:96vw;max-height:88vh;overflow:auto;font-size:12px';
    ov.appendChild(box);
    box.appendChild(h('div',null,'<b style="font-size:14px">Import support reactions from '+esc(p.producer||'?')+'</b>'));
    box.appendChild(h('div','note','<b>Source:</b> '+esc(p.producer||'?')+(p.producerFile?' ('+esc(p.producerFile)+')':'')+
      ' &middot; <b>sent</b> '+esc(when(p.producedAt))+' &middot; <b>project</b> '+esc(projName(p)||'—')+
      ' &middot; unfactored reactions'+(via==='file'?' &middot; from a JSON file':'')));
    box.appendChild(h('div','warnbox','Beam reactions give the pedestal <b>axial load P</b> (and a moment only at a fixed beam support). Shear Vx, Vy is zero unless you add it. '+
      'Sign: P + = down in both tools (no sign change); uplift arrives as negative P. Values are applied unfactored to the chosen load-type rows; this tool’s own ASCE 7-16 combinations then apply.'));
    if(chk.warn.length) box.appendChild(h('div','warnbox',chk.warn.map(esc).join('<br>')));
    if(p.notes && p.notes.length){
      var nb=h('details'); nb.appendChild(h('summary',null,'Sender notes ('+p.notes.length+')'));
      nb.appendChild(h('div','note',p.notes.map(function(n){ return '&bull; '+esc(n); }).join('<br>'))); nb.open=true; box.appendChild(nb);
    }
    var g=h('div'); g.style.cssText='display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin:8px 0';
    var sl=h('label',null,'<b>Beam support</b> '); var ss=document.createElement('select'); ss.id='bxMrSup';
    chk.sups.forEach(function(s,i){ var op=document.createElement('option'); op.value=i; op.textContent=s.id+(isNum(s.x)?' (x = '+f2(s.x)+' ft'+(s.support?', '+s.support:'')+')':''); ss.appendChild(op); });
    sl.appendChild(ss); g.appendChild(sl);
    var pl=h('label',null,'<b>Target pedestal</b> '); var ps=document.createElement('select'); ps.id='bxMrPed';
    state.peds.forEach(function(pd,i){ var op=document.createElement('option'); op.value=i; op.textContent=pd.label+' (x = '+pd.x+', y = '+pd.y+' ft)'; ps.appendChild(op); });
    pl.appendChild(ps); g.appendChild(pl);
    box.appendChild(g);
    var tw=h('div'); box.appendChild(tw);
    var axw=h('div'); axw.style.margin='6px 0'; box.appendChild(axw);
    var md=h('div'); md.style.margin='6px 0';
    md.innerHTML='<b>Existing loads in the target rows:</b> '+
      '<label><input type="radio" name="bxMrMode" id="bxMrRep" checked> replace</label> '+
      '<label><input type="radio" name="bxMrMode" id="bxMrAdd"> add</label> '+
      '<span class="note">(only P, and the moment component if one is imported)</span><br>'+
      '<label><input type="checkbox" id="bxMrZero"> also set the other components (Vx, Vy and the other moments) of the target rows to 0</label>';
    box.appendChild(md);
    var sum=h('div'); box.appendChild(sum);
    var row=h('div'); row.style.cssText='display:flex;gap:8px;justify-content:flex-end;margin-top:10px;border-top:1px solid #ccc;padding-top:8px';
    var ca=h('button',null,'Cancel'); var go=h('button',null,'<b>Import</b>'); go.id='bxMrGo';
    row.appendChild(ca); row.appendChild(go); box.appendChild(row);
    var sels={}, axSel=null;
    function drawRows(){
      var s=chk.sups[o.sup]; tw.innerHTML=''; sels={};
      var t=h('table','tbl');
      t.innerHTML='<tr><th>From '+esc(p.producer||'sender')+'</th><th>P = V (kips, + down)</th><th>M (kip-ft)</th><th>Into pedestal row</th></tr>';
      s.rows.forEach(function(row){
        var tr=h('tr');
        tr.appendChild(h('td',null,esc(row.label)));
        tr.appendChild(h('td',null,f2(row.V,3)));
        tr.appendChild(h('td',null,Math.abs(row.M)>1e-9?f2(row.M,3):'0'));
        var td=h('td'), se=document.createElement('select'); se.dataset.key=row.key;
        TYPES.concat(['']).forEach(function(t2){ var op=document.createElement('option'); op.value=t2; op.textContent=t2?t2+' — '+TYPE_DESC[t2]:'do not import'; se.appendChild(op); });
        se.value=o.map[row.key]||''; td.appendChild(se); tr.appendChild(td); sels[row.key]=se;
        t.appendChild(tr);
      });
      tw.appendChild(t);
      var hasM=s.rows.some(function(r2){ return Math.abs(r2.M)>1e-9; });
      axw.innerHTML=''; axSel=null;
      if(hasM){
        axw.appendChild(h('span',null,'<b>Fixed-support moment.</b> The beam (from its first support toward its last) runs toward footing '));
        axSel=document.createElement('select'); axSel.id='bxMrAxis';
        Object.keys(AXIS).forEach(function(k){ var op=document.createElement('option'); op.value=k; op.textContent=AXIS[k].lbl; axSel.appendChild(op); });
        axSel.value=o.axis; axw.appendChild(axSel);
        axw.appendChild(h('div','note','The beam tool sends M + = counter-clockwise in the beam elevation. A CCW moment at the pedestal top shifts the soil resultant back along the beam, so My = −M when the beam runs toward +x (this tool: +My shifts the resultant toward +x).'));
      } else axw.appendChild(h('div','note','No moment at this support (pin or roller): only P is imported.'));
    }
    function read(){
      o.sup=+ss.value; o.ped=+ps.value;
      Object.keys(sels).forEach(function(k){ o.map[k]=sels[k].value; });
      if(axSel) o.axis=axSel.value;
      o.mode=document.getElementById('bxMrAdd').checked?'add':'replace';
      o.zeroOther=document.getElementById('bxMrZero').checked;
      return o;
    }
    function refresh(){
      read();
      var r=plan(p,chk,o), x='';
      if(r.err.length) x+='<div class="warnbox" style="color:#b71c1c;font-weight:bold">'+r.err.map(esc).join('<br>')+'</div>';
      var ped=state.peds[o.ped];
      x+='<div style="margin:6px 0"><b>Will change</b> (pedestal '+esc(ped?ped.label:'?')+', unfactored): '+(r.changes.length? r.changes.map(function(c){
        return c.row+' '+c.field+': '+f2(c.from,3)+' → <b>'+f2(c.to,3)+'</b> '+(c.field==='Mx'||c.field==='My'?'kip-ft':'kips'); }).join('; ') : 'nothing')+
        '<br><b>Also recorded:</b> the source (producer and time) in this project, shown above the inputs and in the printed report.</div>';
      if(r.warn.length) x+='<div class="warnbox">'+r.warn.map(esc).join('<br>')+'</div>';
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
      buildPedCards(); saveAuto(); recalc();
      refreshBar();
    });
    document.body.appendChild(ov);
    refresh();
    return {overlay:ov, opts:o, chk:chk, refresh:refresh, drawRows:drawRows};
  }

  function sourceLine(){
    var s=state && state.bxSrc && state.bxSrc.memberReactions; if(!s) return '';
    return 'Loads on '+(s.pedestal||'?')+' ('+(s.rows||[]).map(function(x){ return x.row; }).filter(function(v,i,a){ return a.indexOf(v)===i; }).join(', ')+
      ') from '+(s.producer||'?')+' support '+(s.support||'?')+', '+when(s.producedAt)+
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
  window.sfMrSourceLine=sourceLine;
  window.bxMr={check:check,plan:plan,apply:apply,defaults:defaults,openDialog:openDialog,sourceLine:sourceLine,refreshBar:refreshBar};
  refreshBar();
  window.addEventListener('focus',refreshBar);
  window.addEventListener('storage',refreshBar);
  setInterval(refreshBar,2000);
})();
</script>
  ```
- **Saved data:** no existing key or format changed (`sfd_auto`, `sfd_projects`, the JSON export). New optional field `state.bxSrc.memberReactions` (kept by `Object.assign(defaultState(), saved)`). New key: only `bridgeSuite.v1.memberReactions.adopted.spreadFooting`.
- **Check case:** default Steel Beam project, support A → Ped 2: D.P 150 → **2.000**, L.P 80 → **4.000** kips; S (20) and Wx (Vx 8) untouched because the beam's S and W reactions are 0. Fixed–fixed variant, support A → Ped 1: M_D = −6.667 kip·ft → D.My = **+6.667** (beam toward +x); wind −20 psf → Wx.P = **−2.000** (uplift).
- **How verified:** every plain inline script of the three files passes `node --check` (no JSX in these files). jsdom end-to-end test with one shared localStorage stub (56 assertions, all pass): the default Steel Beam project is sent through the real dialog (`bxSendMemberReactions('send')` → Send), then pulled in BasePlateAnchorDesigner and Spread Footing through their real dialogs and Import buttons; inputs asserted equal to the mapped values; export (`Export hand-off (JSON)` blob) re-imported through `Import hand-off (JSON)` in both receivers; wrong `_schema`, `schemaVersion: 2` (pull and file), `factored: true`, unit `kN`, non-finite V, no supports, and corrupt JSON are all refused with no change. No-result-change check: with no hand-off present, original (origin/main) and modified files give byte-identical results on the default state (Steel Beam `computeAll()` for the default beam and a 2-span pin/pin/fixed beam with wind and snow, plus the rendered tab text; BasePlate `allChecks()`, `generateCombos()` and the print report; Spread Footing `computeAll()`, `computePhase2()` and the print header).
- **Other copies of this code:** the receiver logic (`check`, unit tables) is duplicated in BasePlateAnchorDesigner.html (CLAUDE.md §3). BridgeXfer v1 unchanged.
- **Open items:** the tool has no seismic (E) load type, so E reactions are not imported.

## 2026-10-05 — PR: claude/conn-foundation-loads (PR link added after merge)

### C2. Foundation-load hand-off receiver: "Pull from Abutment / SubLoads" and "Import hand-off (JSON)"   [feature: hand-off (no result change)]
- **Purpose:** reads channel `bridgeSuite.v1.foundationLoads` (HANDOFF.md §4.6) from the abutment calculator or SubLoads.
- **Decision (logged):** this tool's by-load-type rows take **unfactored** loads by type and build their own ASCE 7-16 combinations, so a foundation-load case (a combination) is **never** written there. The tool has a **Direct factored (LRFD envelope)** load mode (`state.loadMode = 'direct'`, `peds[i].direct`, applied at the top of the pedestal, self-weight / soil added at 1.2 / 0.9). One **factored** case (Strength / Extreme Event) is imported into one pedestal's direct set. **Service cases are refused** (shown, no selector): they cannot be split into load types, and the direct mode takes factored loads. **Bottom-of-footing / pile-cap / point-of-fixity cases are refused**: the tool adds the footing weight, the soil and the shear couple itself. So the abutment calculator's payload (always bottom of footing) is refused with an explanation, and SubLoads must send the top-of-footing level.
- **Sign convention verified:** P + = down; +Vx, +Vy toward +x, +y; +My shifts the soil resultant toward +x, +Mx toward +y (`resultant()`: `My += P·x + my + vx·(t + h)`). The hand-off uses the same effect-based convention, so only the axes are mapped.
- **Mapping:**

| Hand-off case (one, factored) | Footing target (pedestal chosen by the user) |
|---|---|
| `P` | `peds[i].direct.P` |
| `Vx`, `Vy` (after the axis mapping; footing +x/+y = ± hand-off x or y, default identity) | `direct.Vx`, `direct.Vy` |
| `My`, `Mx` (after the axis mapping) | `direct.My = My − Vx·h`, `direct.Mx = Mx − Vy·h` when "refer the moments to the top of the pedestal" is on (default when h > 0 and the shear couple is on); else unchanged |
| — | `state.loadMode` → `'direct'` (option, default on); other pedestals' `direct` → 0 (option, default off) |

- **User choices (logged in `state.bxSrc.foundationLoads`):** sender (when both have sent), case (default: the factored case with the largest P), pedestal (default the first), axes, height correction, switch to Direct, zero the other pedestals; an unknown level needs a confirmation tick.
- **Validation:** `_schema`, version, corrupt JSON, units (kip/lb, kip-ft/kip-in/lb-ft/lb-in, ft), boolean `factored` on every case, finite P, Vx, Vy, Mx, My.
- **Governing provision:** none changed. No formula, factor or default changed; the only effect is filling inputs the user confirms.
- **Before / After** (exact):
  1. Buttons under the title block. Before:
```html
 <span id="bxMrSrc" style="font-size:11px;font-style:italic"></span>
</div>
```
     After:
```html
 <span id="bxMrSrc" style="font-size:11px;font-style:italic"></span>
 <br><button id="btnPullFoundationLoads" type="button" onclick="bxPullFoundationLoads()" title="Import one factored foundation-load case (Strength / Extreme Event, top of footing) from the abutment calculator or Bridge Substructure Loading into one pedestal's Direct factored loads (HANDOFF.md, channel foundationLoads)">Pull from Abutment / SubLoads<span id="bxFlNew" style="display:none;color:#b45309;font-weight:bold"> &#9679; new data available</span></button>
 <button id="btnImportFoundationLoads" type="button" onclick="document.getElementById('bxFlFile').click()" title="Import a foundationLoads hand-off JSON file">Import hand-off (JSON)</button><input type="file" id="bxFlFile" accept=".json,application/json" style="display:none" onchange="bxImportFoundationLoads(event)">
 <span id="bxFlSrc" style="font-size:11px;font-style:italic"></span>
</div>
```
  2. `renderPrintHeader()`, after the memberReactions source line. Before:
```js
 if(typeof sfMrSourceLine==='function'&&sfMrSourceLine()){…}   /* hand-off source (HANDOFF.md §3.4) */
}
```
     After:
```js
 if(typeof sfMrSourceLine==='function'&&sfMrSourceLine()){…}   /* hand-off source (HANDOFF.md §3.4) */
 if(typeof sfFlSourceLine==='function'&&sfFlSourceLine()){const sp=document.createElement('p');sp.style.cssText='font-size:10px;margin:2px 0';sp.textContent=sfFlSourceLine();$('#printHeader').appendChild(sp);}   /* foundationLoads hand-off source (HANDOFF.md §3.4) */
}
```
  3. New script, inserted just before `</body>` (after the memberReactions receiver script; Before: nothing). After:
```html
<script>
/* Foundation-load hand-off receiver (HANDOFF.md §4.6, channel foundationLoads; senders: abutment_calculator.html,
   Bridge Substructure Loading.html). "Pull from Abutment / SubLoads" / "Import hand-off (JSON)". Nothing is applied
   on page load. Decision (fix log C2): this tool's by-load-type rows take UNFACTORED loads by type and build their own
   ASCE 7-16 combinations, so a foundation-load case (a combination) never goes there. One FACTORED case
   (Strength / Extreme Event) is imported into one pedestal's "Direct factored (LRFD envelope)" set
   (state.peds[i].direct, applied at the top of the pedestal). Service cases are listed but not importable.
   Cases given at the bottom of the footing or pile cap, or at a pile point of fixity, are refused: this tool adds
   the footing self-weight and the soil itself. The user picks the source, case, pedestal and axis mapping;
   the moment can be referred from the top of footing to the top of the pedestal (− V·h). The source is kept in
   the new optional field state.bxSrc.foundationLoads. */
(function(){
  var CH='foundationLoads', SCHEMA='bridge-foundation-loads', MAXV=1, RID='spreadFooting', BY=['abutment','subloads'];
  var FORCE={kip:1,kips:1,k:1,lb:0.001,lbf:0.001,lbs:0.001};               /* -> kip */
  var MOMENT={'kip-ft':1,'kip·ft':1,'k-ft':1,'ft-kip':1,'kip-in':1/12,'lb-ft':0.001,'ft-lb':0.001,'lb-in':0.001/12};   /* -> kip-ft */
  var AX=['+x','-x','+y','-y'], AXL={'+x':'+x of the hand-off','-x':'−x of the hand-off','+y':'+y of the hand-off','-y':'−y of the hand-off'};
  var OK_LEVEL={topOfFooting:1,baseOfWall:1,baseOfColumn:1}, BAD_LEVEL={bottomOfFooting:'the bottom of the footing',bottomOfPileCap:'the bottom of the pile cap',pointOfFixity:'a pile or shaft point of fixity'};
  function isNum(v){ return typeof v==='number' && isFinite(v); }
  function f2(v,d){ return isNum(v) ? (Math.abs(v)<1e-12?0:v).toFixed(d==null?2:d) : '—'; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function h(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!==undefined) e.innerHTML=html; return e; }
  function when(iso){ var d=new Date(iso); if(isNaN(d)) return String(iso||'?');
    function p(n){ return (n<10?'0':'')+n; }
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes()); }
  function projName(p){ return (p.project && typeof p.project==='object') ? (p.project.name||'') : String(p.project||''); }

  /* ---- validate and convert to kip / kip-ft (same check as Pile Designer's receiver) ---- */
  function check(p){
    var out={err:[],warn:[],cases:[]};
    var e=BridgeXfer.validate(p,SCHEMA,MAXV); if(e){ out.err.push(e); return out; }
    var u=p.units||{}, kf=FORCE[u.force], km=MOMENT[u.moment];
    if(!kf){ out.err.push('Unknown force unit "'+(u.force||'')+'". Accepted: kip, or lb (converted ÷ 1000).'); return out; }
    if(!km){ out.err.push('Unknown moment unit "'+(u.moment||'')+'". Accepted: kip-ft, kip-in, lb-ft, lb-in.'); return out; }
    if(u.length!==undefined && u.length!=='ft'){ out.err.push('Unknown length unit "'+u.length+'". Accepted: ft.'); return out; }
    if(kf!==1) out.warn.push('Forces converted from '+u.force+' to kip (× '+kf+').');
    if(km!==1) out.warn.push('Moments converted from '+u.moment+' to kip-ft (× '+km+').');
    if(!Array.isArray(p.cases) || !p.cases.length){ out.err.push('The payload has no load cases.'); return out; }
    p.cases.forEach(function(c,i){
      var nm=(c && c.name) ? String(c.name) : 'case '+(i+1);
      if(!c || typeof c!=='object'){ out.err.push('Case '+(i+1)+' is not an object.'); return; }
      if(typeof c.factored!=='boolean'){ out.err.push(nm+': "factored" must be true or false.'); return; }
      var v={}, bad=[];
      ['P','Vx','Vy','Mx','My'].forEach(function(k){ if(!isNum(c[k])) bad.push(k+' = '+JSON.stringify(c[k])); else v[k]=c[k]*(k[0]==='M'?km:kf); });
      if(bad.length){ out.err.push(nm+': not a finite number: '+bad.join(', ')+'.'); return; }
      out.cases.push({i:i,name:nm,limitState:String(c.limitState||''),factored:c.factored,governs:c.governs||'',combination:c.combination||'',P:v.P,Vx:v.Vx,Vy:v.Vy,Mx:v.Mx,My:v.My});
    });
    return out;
  }
  /* where the forces act: from reference.level, else from the location text */
  function level(p){
    var r=p.reference&&p.reference.level; if(r) return String(r);
    var t=String(p.location||'').toLowerCase();
    if(/bottom of (the )?(footing|pile cap|cap)/.test(t)) return 'bottomOfFooting';
    if(/point of fixity/.test(t)) return 'pointOfFixity';
    if(/top of (the )?footing|base of (the )?(wall|column)/.test(t)) return 'topOfFooting';
    return '';
  }
  /* receiver axes from the hand-off axes: rx/ry each '+x','-x','+y','-y'; moments follow (effect-based convention) */
  function mapAxes(c,ax){
    function comp(a){ var s=a.charAt(0)==='-'?-1:1, k=a.charAt(1); return {V:s*(k==='x'?c.Vx:c.Vy), M:s*(k==='x'?c.My:c.Mx)}; }
    var X=comp(ax.x), Y=comp(ax.y);
    return {P:c.P, Vx:X.V, Vy:Y.V, Mx:Y.M, My:X.M};
  }
  /* every valid payload on the channel (one per sender), newest first */
  function candidates(){
    var keys=BY.map(function(b){ return BridgeXfer.NS+CH+'.by.'+b; }).concat([BridgeXfer.NS+CH]), seen={}, out=[];
    keys.forEach(function(k){ var raw=null; try{ raw=localStorage.getItem(k); }catch(e){}
      if(!raw) return; var p; try{ p=JSON.parse(raw); }catch(e){ return; }
      if(BridgeXfer.validate(p,SCHEMA,MAXV)) return;
      var id=(p.producer||'')+'|'+(p.producedAt||''); if(seen[id]) return; seen[id]=1; out.push(p); });
    out.sort(function(a,b){ return String(b.producedAt||'').localeCompare(String(a.producedAt||'')); });
    return out;
  }
  function defaults(chk){
    var best=-1; chk.cases.forEach(function(c,j){ if(c.factored && (best<0 || c.P>chk.cases[best].P)) best=j; });
    return {ci:best, ped:0, ax:{x:'+x',y:'+y'}, hCorr:true, toDirect:state.loadMode!=='direct', zeroOther:false, confirmLevel:false};
  }
  /* ---- plan: exactly what will change. Pure apart from reading state. ---- */
  function plan(p,chk,o){
    var r={err:[],warn:[],changes:[],set:null};
    var lev=level(p);
    if(BAD_LEVEL[lev]) r.err.push('These loads act at '+BAD_LEVEL[lev]+' ('+(p.location||lev)+'). Spread Footing needs the loads at the top of the footing (base of the column or wall): it adds the footing self-weight, the soil over the footing and the shear couple itself, so loads at the bottom would count them twice. In the sender, pick the top-of-footing level (SubLoads) — the abutment calculator only sends bottom-of-footing loads.');
    else if(!OK_LEVEL[lev] && !o.confirmLevel) r.err.push('The payload does not say where the loads act ("'+(p.location||'')+'"). Tick the box to confirm they act at the top of the footing.');
    var c=chk.cases[o.ci];
    if(!c) r.err.push(chk.cases.some(function(x){ return x.factored; }) ? 'Pick a factored case.' : 'The payload has no factored case. This tool takes factored (Strength / Extreme Event) loads only, in its Direct factored mode; service combinations cannot be split into its unfactored load types.');
    else if(!c.factored) r.err.push(c.name+' is a service case (factored:false). It cannot be imported: the by-load-type rows take unfactored loads by type, not combinations, and the Direct mode takes factored loads.');
    if(o.ax.x.charAt(1)===o.ax.y.charAt(1)) r.err.push('Map footing x and y to different hand-off axes.');
    var ped=state.peds[o.ped]; if(!ped) r.err.push('Pick a pedestal.');
    if(r.err.length) return r;
    var m=mapAxes(c,o.ax), hp=Math.max(+ped.h||0,0), on=state.stab.shearCouple!=='off';
    var corr=o.hCorr && on && hp>0;
    if(corr){ m.My-=m.Vx*hp; m.Mx-=m.Vy*hp; }
    var cur=ped.direct||{P:0,Vx:0,Vy:0,Mx:0,My:0}, set={};
    ['P','Vx','Vy','Mx','My'].forEach(function(k){ var v=Math.round(m[k]*1e6)/1e6; set[k]=v; r.changes.push({what:ped.label+' direct '+k,from:+cur[k]||0,to:v,u:k[0]==='M'?'kip-ft':'kips'}); });
    r.set=set; r.mapped=m; r.corr=corr; r.h=hp;
    if(o.toDirect && state.loadMode!=='direct') r.changes.push({what:'Load input mode',from:'By load type',to:'Direct factored',u:''});
    if(!o.toDirect && state.loadMode!=='direct') r.warn.push('The footing stays in "By load type" mode: the imported direct set is stored but not used until you switch "Load input mode" to "Direct factored".');
    var others=state.peds.map(function(pd,i){ return {pd:pd,i:i}; }).filter(function(x){ return x.i!==o.ped && ['P','Vx','Vy','Mx','My'].some(function(k){ return (+(x.pd.direct||{})[k]||0)!==0; }); });
    if(o.zeroOther) others.forEach(function(x){ ['P','Vx','Vy','Mx','My'].forEach(function(k){ var old=+(x.pd.direct||{})[k]||0; if(old!==0) r.changes.push({what:x.pd.label+' direct '+k,from:old,to:0,u:k[0]==='M'?'kip-ft':'kips'}); }); });
    else if(others.length) r.warn.push('In Direct mode the other pedestals\' direct loads also act: '+others.map(function(x){ return x.pd.label+' (P '+f2(+x.pd.direct.P||0)+' k)'; }).join(', ')+'. Tick the option to set them to 0 if the hand-off is the whole load on the footing.');
    if(hp>0 && on) r.warn.push(corr ? 'Moments referred from the top of the footing to the top of the pedestal: My = My,TOF − Vx·h, Mx = Mx,TOF − Vy·h, h = '+f2(hp)+' ft. With the tool\'s couple V·(t + h) the moment at the bottom of the footing is My,TOF + Vx·t.'
      : 'The pedestal is '+f2(hp)+' ft tall and the tool applies V at its top (couple V·(t + h)): without the correction the moment at the footing base is overstated by V·h.');
    if(!on) r.warn.push('"Shear couple" is set to Exclude: the tool adds no V·(t + h) moment, so the moment at the bottom of the footing will miss V·t.');
    if(hp>0) r.warn.push('The tool also adds the self-weight of the '+f2(hp)+' ft pedestal; '+(p.producer||'the sender')+'\'s top-of-footing P already includes the column or wall above. Set the pedestal height to 0 if the pedestal is that column or wall.');
    r.warn.push('Direct mode adds the footing and pedestal self-weight and the soil over the footing at 1.2 (0.9 where they resist), the ASCE 7-16 bracket of this tool — not AASHTO γp. Bearing is checked with factored loads against the allowable bearing.');
    if(p.includes && p.includes.earthPressure) r.warn.push('The case includes earth pressure on the stem (abutment). This tool adds no earth pressure on its own.');
    return r;
  }
  function apply(p,chk,o,via){
    var r=plan(p,chk,o); if(r.err.length) return r;
    var ped=state.peds[o.ped], c=chk.cases[o.ci];
    if(!ped.direct) ped.direct={P:0,Vx:0,Vy:0,Mx:0,My:0};
    Object.keys(r.set).forEach(function(k){ ped.direct[k]=r.set[k]; });
    if(o.toDirect) state.loadMode='direct';
    if(o.zeroOther) state.peds.forEach(function(pd,i){ if(i!==o.ped) pd.direct={P:0,Vx:0,Vy:0,Mx:0,My:0}; });
    if(!state.bxSrc || typeof state.bxSrc!=='object') state.bxSrc={};
    state.bxSrc.foundationLoads={producer:p.producer||'',producerFile:p.producerFile||'',producedAt:p.producedAt||'',
      project:p.project||'',via:via||'pull',adoptedAt:new Date().toISOString(),
      element:p.element||null,location:p.location||'',caseName:c.name,limitState:c.limitState,
      sent:{P:c.P,Vx:c.Vx,Vy:c.Vy,Mx:c.Mx,My:c.My},applied:r.set,pedestal:ped.label,pedIndex:o.ped,
      axes:{x:o.ax.x,y:o.ax.y},heightCorrection:r.corr?r.h:0,toDirect:!!o.toDirect,zeroOther:!!o.zeroOther,
      notes:(p.notes||[]).slice(0,20)};
    BridgeXfer.markAdopted(CH,RID,p.producedAt);
    r.ok=true;
    return r;
  }

  function openDialog(list,via){
    if(!state.peds || !state.peds.length){ alert('Foundation loads: add a pedestal first.'); return null; }
    var si=0, p=list[0], chk=check(p);
    if(chk.err.length){ alert('Foundation-load hand-off refused:\n  '+chk.err.join('\n  ')); return null; }
    var o=defaults(chk);
    var old=document.getElementById('bxFlOverlay'); if(old) old.remove();
    var ov=h('div'); ov.id='bxFlOverlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:200;display:flex;align-items:center;justify-content:center';
    var box=h('div'); box.style.cssText='background:#fff;border:2px solid #333;padding:12px 16px;width:900px;max-width:96vw;max-height:90vh;overflow:auto;font-size:12px';
    ov.appendChild(box);
    var head=h('div'); box.appendChild(head);
    var body=h('div'); box.appendChild(body);
    var sum=h('div'); box.appendChild(sum);
    var row=h('div'); row.style.cssText='display:flex;gap:8px;justify-content:flex-end;margin-top:10px;border-top:1px solid #ccc;padding-top:8px';
    var ca=h('button',null,'Cancel'); var go=h('button',null,'<b>Import</b>'); go.id='bxFlGo';
    row.appendChild(ca); row.appendChild(go); box.appendChild(row);
    function opt(sel,val,txt,on){ var op=document.createElement('option'); op.value=val; op.textContent=txt; if(on) op.selected=true; sel.appendChild(op); }
    function draw(){
      head.innerHTML='';
      head.appendChild(h('div',null,'<b style="font-size:14px">Import foundation loads</b>'));
      if(list.length>1){ var sl=h('label',null,'<b>Sender</b> '), ss=document.createElement('select'); ss.id='bxFlSrcSel';
        list.forEach(function(q,i){ opt(ss,i,(q.producer||'?')+' — '+when(q.producedAt)+((q.element&&q.element.label)?' — '+q.element.label:''),i===si); });
        sl.appendChild(ss); head.appendChild(sl); }
      head.appendChild(h('div','note','<b>Source:</b> '+esc(p.producer||'?')+(p.producerFile?' ('+esc(p.producerFile)+')':'')+
        ' &middot; <b>sent</b> '+esc(when(p.producedAt))+' &middot; <b>project</b> '+esc(projName(p)||'—')+
        (p.element?' &middot; <b>element</b> '+esc((p.element.type||'')+' '+(p.element.label||'')):'')+(via==='file'?' &middot; from a JSON file':'')+
        '<br><b>Location:</b> '+esc(p.location||'—')+'<br><b>Sign convention (sender):</b> '+esc(p.signConvention||'—')+
        (p.axes?'<br><b>Axes (sender):</b> x: '+esc(p.axes.x||'')+'; y: '+esc(p.axes.y||''):'')));
      head.appendChild(h('div','warnbox','This tool takes <b>one factored case per pedestal</b>, in its <b>Direct factored (LRFD envelope)</b> mode, applied at the top of the pedestal. '+
        'Its by-load-type rows take unfactored loads by type and are never filled from a combination. Service cases are shown but cannot be imported. '+
        'This tool: P + = down; +Vx, +Vy toward +x, +y; +My moves the soil resultant toward +x, +Mx toward +y — the same effect-based convention as the hand-off, so only the axes are mapped.'));
      if(chk.warn.length) head.appendChild(h('div','warnbox',chk.warn.map(esc).join('<br>')));
      if(p.notes && p.notes.length){ var nb=h('details'); nb.appendChild(h('summary',null,'Sender notes ('+p.notes.length+')'));
        nb.appendChild(h('div','note',p.notes.map(function(n){ return '&bull; '+esc(n); }).join('<br>'))); nb.open=true; head.appendChild(nb); }
      body.innerHTML='';
      var t=h('table','tbl'); t.innerHTML='<tr><th></th><th>Case</th><th>Factored</th><th>P (k)</th><th>Vx</th><th>Vy</th><th>Mx (k-ft)</th><th>My</th></tr>';
      chk.cases.forEach(function(c,j){ var tr=h('tr');
        tr.innerHTML='<td>'+(c.factored?'<input type="radio" name="bxFlCase" value="'+j+'"'+(j===o.ci?' checked':'')+'>':'')+'</td><td title="'+esc(c.combination)+'">'+esc(c.name)+'</td><td>'+(c.factored?'yes':'no — not importable')+'</td><td>'+f2(c.P,1)+'</td><td>'+f2(c.Vx,1)+'</td><td>'+f2(c.Vy,1)+'</td><td>'+f2(c.Mx,1)+'</td><td>'+f2(c.My,1)+'</td>';
        if(!c.factored) tr.style.color='#888'; t.appendChild(tr); });
      var tw=h('div'); tw.style.cssText='max-height:30vh;overflow:auto'; tw.appendChild(t); body.appendChild(tw);
      var g=h('div'); g.style.cssText='display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin:8px 0';
      var pl=h('label',null,'<b>Target pedestal</b> '), ps=document.createElement('select'); ps.id='bxFlPed';
      state.peds.forEach(function(pd,i){ opt(ps,i,pd.label+' (x = '+pd.x+', y = '+pd.y+' ft, h = '+pd.h+' ft)',i===o.ped); }); pl.appendChild(ps); g.appendChild(pl);
      ['x','y'].forEach(function(a){ var lb=h('label',null,'<b>Footing +'+a+' =</b> '), se=document.createElement('select'); se.id='bxFlAx'+a;
        AX.forEach(function(k){ opt(se,k,AXL[k],o.ax[a]===k); }); lb.appendChild(se); g.appendChild(lb); });
      body.appendChild(g);
      var lev=level(p), ped=state.peds[o.ped], x='';
      if(!OK_LEVEL[lev] && !BAD_LEVEL[lev]) x+='<label><input type="checkbox" id="bxFlLev"'+(o.confirmLevel?' checked':'')+'> the loads act at the top of the footing (base of the column or wall)</label><br>';
      if(ped && (+ped.h||0)>0) x+='<label><input type="checkbox" id="bxFlH"'+(o.hCorr?' checked':'')+'> refer the moments from the top of the footing to the top of this '+f2(+ped.h)+' ft pedestal (M − V·h), because this tool applies V at the pedestal top</label><br>';
      if(state.loadMode!=='direct') x+='<label><input type="checkbox" id="bxFlDirect"'+(o.toDirect?' checked':'')+'> switch "Load input mode" to Direct factored (the by-load-type rows are kept, unused)</label><br>';
      if(state.peds.length>1) x+='<label><input type="checkbox" id="bxFlZero"'+(o.zeroOther?' checked':'')+'> set the other pedestals\' direct loads to 0</label>';
      body.appendChild(h('div',null,x));
    }
    function read(){
      var r=document.querySelector('input[name="bxFlCase"]:checked'); if(r) o.ci=+r.value;
      var e; if((e=document.getElementById('bxFlPed'))) o.ped=+e.value;
      if((e=document.getElementById('bxFlAxx'))) o.ax.x=e.value; if((e=document.getElementById('bxFlAxy'))) o.ax.y=e.value;
      if((e=document.getElementById('bxFlH'))) o.hCorr=e.checked; if((e=document.getElementById('bxFlDirect'))) o.toDirect=e.checked;
      if((e=document.getElementById('bxFlZero'))) o.zeroOther=e.checked; if((e=document.getElementById('bxFlLev'))) o.confirmLevel=e.checked;
      return o;
    }
    function refresh(){
      var r=plan(p,chk,o), x='';
      if(r.err.length) x+='<div class="warnbox" style="color:#b71c1c;font-weight:bold">'+r.err.map(esc).join('<br>')+'</div>';
      else x+='<div style="margin:6px 0"><b>Will change</b> (factored, kips / kip-ft): '+r.changes.map(function(c){
        return esc(c.what)+': '+(typeof c.from==='number'?f2(c.from,3):esc(c.from))+' → <b>'+(typeof c.to==='number'?f2(c.to,3):esc(c.to))+'</b>'; }).join('; ')+
        '<br><b>Also recorded:</b> the source (producer, time, case) in this project, shown above the inputs and in the printed report.</div>';
      if(r.warn.length) x+='<div class="warnbox">'+r.warn.map(esc).join('<br>')+'</div>';
      sum.innerHTML=x; go.disabled=!!r.err.length;
      return r;
    }
    function full(){ draw(); refresh(); }
    box.addEventListener('change',function(e){
      if(e.target && e.target.id==='bxFlSrcSel'){ si=+e.target.value; p=list[si]; chk=check(p);
        if(chk.err.length){ sum.innerHTML='<div class="warnbox" style="color:#b71c1c">'+chk.err.map(esc).join('<br>')+'</div>'; go.disabled=true; return; }
        o=defaults(chk); full(); return; }
      read(); if(e.target && e.target.id==='bxFlPed'){ full(); return; } refresh();
    });
    ca.addEventListener('click',function(){ ov.remove(); });
    go.addEventListener('click',function(){
      var r=apply(p,chk,read(),via);
      if(r.err.length){ refresh(); return; }
      ov.remove();
      bindStaticInputs(); buildPedCards(); saveAuto(); recalc();
      refreshBar();
    });
    document.body.appendChild(ov);
    full();
    return {overlay:ov, opts:o, chk:chk, refresh:refresh, plan:function(){ return plan(p,chk,o); }};
  }

  function sourceLine(){
    var s=state && state.bxSrc && state.bxSrc.foundationLoads; if(!s) return '';
    return 'Direct factored loads on '+(s.pedestal||'?')+' from '+(s.producer||'?')+(s.element&&s.element.label?' ('+s.element.label+')':'')+', '+when(s.producedAt)+
      ((s.project&&(s.project.name||typeof s.project==='string'))?', project '+(s.project.name||s.project):'')+': '+(s.caseName||'?')+
      ' at '+(s.location||'?')+'; footing +x = hand-off '+((s.axes&&s.axes.x)||'?')+', +y = '+((s.axes&&s.axes.y)||'?')+
      (s.heightCorrection?'; moments referred to the pedestal top (h = '+s.heightCorrection+' ft)':'')+(s.via==='file'?'; via JSON file':'');
  }
  function refreshBar(){
    var nd=document.getElementById('bxFlNew'); if(nd) nd.style.display=BridgeXfer.isNew(CH,RID)?'inline':'none';
    var sl=document.getElementById('bxFlSrc'); if(sl) sl.textContent=sourceLine();
  }
  window.bxPullFoundationLoads=function(){
    var list=candidates();
    if(!list.length){ var r=BridgeXfer.read(CH,SCHEMA,MAXV);
      alert('Pull foundation loads: '+(r.ok?'no valid payload.':r.error)+(r.empty?'\n\nIn the abutment calculator or Bridge Substructure Loading, click "Send foundation loads" first.':'')); return null; }
    return openDialog(list,'pull');
  };
  window.bxImportFoundationLoads=function(ev){
    var f=ev && ev.target && ev.target.files && ev.target.files[0]; if(!f) return;
    BridgeXfer.importFile(f,SCHEMA,MAXV,function(r){
      if(!r.ok){ alert('Import hand-off: '+r.error); return; }
      openDialog([r.payload],'file');
    });
    ev.target.value='';
  };
  window.sfFlSourceLine=sourceLine;
  window.bxFl={check:check,level:level,mapAxes:mapAxes,candidates:candidates,plan:plan,apply:apply,defaults:defaults,openDialog:openDialog,sourceLine:sourceLine,refreshBar:refreshBar};
  refreshBar();
  window.addEventListener('focus',refreshBar);
  window.addEventListener('storage',refreshBar);
  setInterval(refreshBar,2000);
})();
</script>
```
- **Check case:** SubLoads default project, Pier 2, top of footing, "Strength IV — P max, Mx (M_t) max, My (M_l) max" (P 2353.381, Vx 15.896, Vy 4.259, Mx 89.451, My 333.836) into Ped 1 (h = 2 ft, shear couple on, identity axes): direct P = 2353.381, Vx = 15.896, Vy = 4.259, **Mx = 89.451 − 4.259 × 2 = 80.933**, **My = 333.836 − 15.896 × 2 = 302.044** kip-ft; with the tool's couple V·(t + h) the base moment is My,TOF + Vx·t. Load mode switched to Direct; Ped 2 direct zeroed (option ticked); the by-load-type rows (memberReactions inputs) unchanged.
- **How verified:** `node --check` on every plain inline script of the four changed files (abutment 13, SubLoads 3, Pile Designer 4, Spread Footing 18 blocks; none is JSX — Pile Designer is pre-compiled `React.createElement`). End-to-end in jsdom with one shared localStorage stub (React UMD served locally): **79 of 79 assertions pass** — abutment default → Pile Designer; abutment pile branch → Pile Designer with the same pile layout; SubLoads Pier 2 top of footing → Spread Footing; SubLoads Pier 1 bottom of footing → Pile Designer (rotated axes); JSON export → import into both receivers; refusals (wrong `_schema`, `schemaVersion` 2 and 3, kN units, non-finite P, missing `factored`, corrupt JSON file, corrupt stored payload, nothing sent, service-only payload into the footing, integral-abutment mode). No-hand-off invariance against the pre-change files: abutment `computeAll()` (dashboard, every permutation table, Input ID); SubLoads `combine()` envelopes and `concurrentSets()` of every unit and `abutExportData()`; Spread Footing `computeAll()` + `computePhase2()` (by-type and Direct mode); Pile Designer `computeAll(DEFAULT_INPUTS)` and the rendered app text (identical apart from the two new buttons). The earlier e2e suites still pass on this branch: memberReactions (Steel Beam → BasePlate / Spread Footing, 56/56) and abutmentLoads (SubLoads → abutment, 57/57).
- **Other copies:** `check()`, `mapAxes()` and `candidates()` are duplicated in Pile Designer.html (CLAUDE.md §3). BridgeXfer v1 unchanged.
- **Open items:** Direct mode brackets self-weight with ASCE 7-16 1.2 / 0.9 rather than AASHTO γp, and checks bearing with factored loads against an allowable value (existing behaviour, unchanged); one case per pedestal (no multi-case sweep in Direct mode).

## Open items (not changed)
- **O1. Vesić inclination exponent m uses nominal B/L, not B'/L'.** Anchor: `const mxm=(2+B/L)/(1+B/L)`. Using B'/L' is the more common form (AASHTO 10.6.3.1.2a uses B'/L'). This changes bearing capacity and needs a decision. Question: should m use the effective B'/L'?
- **O2. The depth factors dq/dc are always applied.** AASHTO 10.6.3.1.2a and common practice drop them when the soil above the base is not competent or may be removed. Recommendation: add a "use depth factors" option, default on to keep the current results. Needs a decision on the default.
- **O3. Passive acts over the full Df across the full footing width** (`PpX=pf*0.5*Kp*gs*Df*Df*L`). The footing face only spans t. This is conservative by default (pf = 0) and is left as is. Question: should passive be limited to the footing thickness, or should pf stay as the user's control?
- **O4. Compression dowel ℓdc does not cap √f'c at 100 psi** (`Ldc=Math.max(0.02*BAR_DIA[dSize]*fy/(lam*sq),...)`). ACI 318-19 25.4.1.4 applies to all development lengths. This was not in the task list, so it is raised here and not changed. Effect: only when f'c > 10 ksi.
- **O5. ℓd cover assumption:** cb uses the bottom clear cover for both layers and assumes the side cover is no less than that. A separate side-cover input would sharpen this. Low priority.

## Resolved items
- **F8 note (item 8): surcharge in the structural resultant is less conservative for sagging moment and one-way shear. Keep, revert, or apply only where unfavourable?**
  - **RESOLVED 2026-10-04 (F12):** engineer keeps the surcharge in the structural resultant. No code change.
