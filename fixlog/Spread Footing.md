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

## 2026-10-09 — PR: claude/tabs-spreadfooting (PR link added after merge)
### T1. Input panel split into tabs   [UI only — no calculation change]
- **Date / type:** 2026-10-09, UI only (no result change). Engineer's request (2026-10-09): "Go through all the apps and make sure they are all formatted with the input panel having tabs rather than one long scrolling input panel." Same approach as `Steel Beam Design - AISC 15th.html` T1: the input sections stay in the page exactly as before and are **moved** into tab panes; the tab strip is drawn in this tool's own style (the same button-tab look as the output `.tabbar`).
- **How it works:** the new `sfdInputTabs()` runs once at start-up, before `loadAuto()`. It moves the nine existing `<details class="sec">` nodes of `#inputPanel` into one `.sfdInPane` per tab and puts the tab strip (`#sfdInTabs`) on top. Nothing is rebuilt or re-templated, so every `data-path`, id and handler is unchanged and `bindStaticInputs()` (which selects `#inputPanel [data-path]`) still finds every field. The pedestal cards (one per pedestal, up to 10) are still built by `buildPedCards()` into `#pedContainer`, which sits inside `sec-peds`, so a pedestal that is added, removed, loaded, undone or imported by a hand-off always lands on the Pedestals & Loads tab. A tab with no section would be hidden (none is mode-dependent in this tool; the rows that show/hide with Bearing basis, q_allow override, friction basis and self-weight mode still do so inside their sections exactly as before).
- **Tabs (in order) and the sections in each** (section id in brackets):

| Tab | Sections |
|---|---|
| Project | Project Manager (`sec-proj`) |
| Geometry | Footing Geometry (`sec-geom`) |
| Materials | Materials (`sec-mat`), Footing Reinforcement (Phase 2) (`sec-rebar`) |
| Soil | Soil & Bearing Capacity (`sec-soil`), Soil Cover on Footing (EV) (`sec-ev`) |
| Stability | Stability Parameters (`sec-stab`) |
| Pedestals & Loads | Pedestals & Applied Loads (`sec-peds`: load input mode, sign convention, one card per pedestal, + Add Pedestal) |
| Assumptions | Engineering Assumptions (`sec-assump`) |

  The title block, the shared-project-info buttons and the hand-off buttons (above the two panels) are not part of the input panel and are unchanged.
- **Error marker:** a red dot on a tab when one of its inputs is in error: a number field the browser cannot parse (`validity.badInput`), or a red **ERROR** message from the existing input validation in `computeAll()` that names one of its inputs (B, L, t → Geometry; f'c, f_y, covers, γc → Materials; Vesić φ/c, direct q_a, φ, c, FS_b, γs → Soil; μ, passive fraction → Stability; pedestal size / height / footprint off the footing / no pedestals → Pedestals & Loads). Design results (eccentricity limit, unstable combination, Phase 2 skipped) and amber warnings do not set a dot. Refreshed at the end of every `recalc()`.
- **Hand-offs:** after "Pull from Abutment / SubLoads" or "Pull from Steel Beam" (or their Import buttons) is confirmed, the input panel switches to the Pedestals & Loads tab so the pedestal loads just filled are in view. What is filled is unchanged.
- **Keyboard / accessibility:** `role="tablist"`, `role="tab"` with `aria-selected` and `aria-controls`, `role="tabpanel"` with `aria-labelledby`; roving `tabindex`; ←/→ (and ↑/↓), Home and End move between the tabs.
- **New storage key:** `sfd_inputTab_v1` (localStorage, plain string: `project`, `geom`, `mat`, `soil`, `stab`, `peds` or `assump`). It remembers the active input tab per browser. Every read and write is in try/catch, with an in-memory fallback when storage is blocked. It is **not** stored in `state`, so the autosave (`sfd_auto`), saved projects (`sfd_projects`), the project JSON export/import and the `bridgeSuite.v1.*` hand-offs are unchanged. No existing key or format changed.
- **Print:** unchanged. `@media print` already hides the whole `.inp` input panel (the report prints the output panel and the input echo), so the tab strip does not print.
- **Narrow screens:** the tab strip wraps (`flex-wrap`, two rows at the default panel width) and is sticky at the top of the scrolling input panel. Existing layout note: below 900 px the panel keeps its `min-width:400px` next to the output panel, so the page already scrolls sideways at 400 px (document width 972 px before and after); this was not changed.
- **Governing provision:** none (no engineering change).
- **Before / After** (exact; file uses LF):
  1. CSS. Before (anchor, unchanged):
     ```css
     .tabpage.active{display:block}
     ```
     After: the following lines inserted right after it:
     ```css
     /* input panel tabs (sfdInputTabs) - same look as the output .tabbar */
     #sfdInTabs{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:2px 0;margin:0 0 8px 0;padding-top:2px;background:#fafafa;border-bottom:2px solid #7a8aa0}
     #sfdInTabs .sfdInTab{display:inline-flex;align-items:center;border:1px solid #7a8aa0;border-bottom:none;margin:0 2px -2px 0;background:#e2e8ef;font-size:12px;padding:5px 8px}
     #sfdInTabs .sfdInTab:hover{background:#dbe4ee}
     #sfdInTabs .sfdInTab[aria-selected="true"]{background:#fff;border-bottom:2px solid #fff;font-weight:bold}
     #sfdInTabs .sfdInTab:focus-visible{outline:2px solid #1c4e80;outline-offset:-2px}
     .sfdInDot{display:none;width:7px;height:7px;border-radius:50%;background:#c62828;margin-left:5px}
     .sfdInTab.has-err .sfdInDot{display:inline-block}
     .sfdInTab[hidden],.sfdInPane[hidden]{display:none!important}
     ```
  2. New block inserted right after the line `document.addEventListener('change',e=>{if(e.target.tagName==='SELECT')handleFieldChange(e.target);});` (end of the input-binding script; anchor: the comment `/* ---------- input panel tabs (UI only) ----------`): constants `SFD_IN_TABS`, `SFD_IN_SEC`, `SFD_IN_ERR`, `SFD_IN_KEY`, and functions `sfdInTabGet`, `sfdInTabSet`, `sfdInputTabs`, `sfdSetInTab`, `sfdInTabKey`, `sfdInputTabMarks` (about 90 lines; copy the block from the file, from that comment down to the `</script>` after `sfdInputTabMarks`).
  3. `recalc()`. Before:
     ```js
      renderPrintHeader();
      if(typeof buildManualTab==='function'&&$('#manualHost')&&!$('#manualHost').childNodes.length)buildManualTab();
     ```
     After:
     ```js
      renderPrintHeader();
      sfdInputTabMarks();
      if(typeof buildManualTab==='function'&&$('#manualHost')&&!$('#manualHost').childNodes.length)buildManualTab();
     ```
  4. Start-up script. Before:
     ```js
     <script>
     loadAuto();
     bindStaticInputs();
     ```
     After:
     ```js
     <script>
     sfdInputTabs();   /* move the input sections into the input tabs */
     loadAuto();
     bindStaticInputs();
     ```
  5. Both hand-off dialogs' Import handlers (memberReactions: `buildPedCards(); saveAuto(); recalc();`; foundationLoads: `bindStaticInputs(); buildPedCards(); saveAuto(); recalc();`), each followed by `refreshBar();`. After, one line added after `refreshBar();` in each:
     ```js
           if(typeof sfdSetInTab==='function') sfdSetInTab('peds',true);   /* show the pedestal loads just filled */
     ```
- **Check case:** default inputs (B 10 × L 8 × t 2.5 ft, Df 4 ft, f'c 4000 psi, Vesić φ 32°, Ped 1 D 120 / L 60 / Wx Vx 8, Ped 2 D 150 / L 80 / S 20 / Wx Vx 8). Before and after: Bearing (service) DCR 0.64 (D + 0.75L + 0.45(+Wx) + 0.75S); Overturning FS 20.62 (report only); Sliding x FS 7.69; Flexure DCR 0.30 (A_s < A_s,min, top x → FAIL); One-way shear max DCR 0.55; Punching max DCR 0.32; Concrete bearing DCR 0.22; Pedestal axial DCR 0.42. Identical.
- **How verified** (Chromium 1194 headless via Playwright; KaTeX 0.16.11, Plotly 2.35.2 and three.js 0.160.0 served from local copies of the same pinned versions):
  - `node --check` on all 18 inline scripts: pass.
  - 16 scenarios run in the original (origin/main) and the edited file: default; Direct factored load mode; direct q_a; q_allow override + direct μ + self-weight override + AASHTO eccentricity limit; top mat + assumptions text; B = 0 (fatal); f'c < 0 and passive fraction 2; pedestal off the footing; add a pedestal and load it; remove a pedestal; Save → change → Load round trip; Reset; Undo; foundationLoads hand-off (SubLoads Pier 2 payload, through the real dialog); memberReactions hand-off (through the real dialog); Share project info. For each: the text of the dashboard, warnings, self-consistency checks, every output tab (Schematic, Combinations, Bearing, Stability, Footing Design, Pedestal Design, Manual) and the print header, the autosave JSON, the `state` JSON (the hand-off `adoptedAt` clock time masked), the `bridgeSuite.v1.*` keys and the hand-off source lines are **identical**; all six hand-off / project-info buttons present.
  - Input inventory (every input/select/textarea/button in the panel, with id, `data-path` and value): identical sets before and after in every scenario (152 elements by default, 102 in Direct mode, 197 with 3 pedestals), each in exactly one tab pane; pedestal cards always in the Pedestals & Loads pane (also right after "+ Add Pedestal").
  - Interaction: tab remembered across reload; keyboard navigation; sticky strip while the panel scrolls; an unparseable Df puts a dot on Geometry; B = 0 → Geometry, f'c < 0 → Materials, passive fraction 2 → Stability, pedestal off the footing → Pedestals & Loads; with localStorage throwing, tabs still work and results still render; print media hides the input panel as before; no console errors.
  - Screenshots of every tab at 1400 px and 400 px widths were checked.
- **Other copies of this code:** none (the same pattern, with its own names, is in `Steel Beam Design - AISC 15th.html`).

## 2026-10-12 — PR: claude/sweep-footing (PR link added after merge)
Open-item sweep (engineer, 2026-10-12: "continue making updates and fixes until it's completed. Use your best judgment on the questions you have and just proceed"). Items from the open-item inventory, section 17: SF-O1, SF-O2, SF-O3, SF-O4, SF-O5, SF-C1, SF-C2. Basis: AASHTO LRFD 10th Ed. (2024) for the Vesić form and the eccentricity / sliding articles the tool already cites; ACI 318-19. Article numbers marked "(verify)" were not checked against the printed edition.

Default check case for all entries below ("default inputs"): B 10 × L 8 × t 2.5 ft, Df 4 ft, cover 1.5 ft, c = 0, φ = 32°, γs = 120 pcf, FS = 3, no water table, f'c 4000 psi, f_y 60,000 psi, bottom mats #8 @ 9 in, Ped 1 D 120 / L 60 / Wx Vx 8, Ped 2 D 150 / L 80 / S 20 / Wx Vx 8. Governing bearing combination D + 0.75L + 0.45(+Wx) + 0.75S: ΣP = 434.94 k, H = Hx = 7.20 k (θ = 0), e_x = 0.4883 ft, e_y = 0, B′ = 9.0233 ft, L′ = 8.00 ft, B_eff = 8.00 ft, A_e = 72.19 ft², q_eff = 6.025 ksf, N_q = 23.177, N_γ = 30.215, s_q = 1.5540, s_γ = 0.6454, q = γD_f = 0.480 ksf, γ_eff = 0.120 kcf.

### S1. SF-O1: Vesić inclination exponent m on B′/L′   [calc change] [neutral: either direction, small]
- **Where:** `vesicCapacity()`, anchor `const mxm=` (about line 974). Report: `renderBearing()`, block titled `Load inclination factors` (about line 2087).
- **Problem:** m_x = (2 + B/L)/(1 + B/L) and m_y used the nominal footing B/L. AASHTO LRFD 10th Ed. Art. 10.6.3.1.2a (Eq. 10.6.3.1.2a-6/-7, verify equation numbers) gives n on the effective dimensions B′/L′ and L′/B′, as the rest of the tool already does (shape factors, A_e). Neutral: m rises when B′/L′ < B/L (load in the long direction reduces B′) and falls in the other case; the effect on i_q is small.
- **Before:**
  ```js
   const mxm=(2+B/L)/(1+B/L), mym=(2+L/B)/(1+L/B);
  ```
- **After:**
  ```js
   /* inclination exponent on the effective footing B' x L' (AASHTO LRFD 10.6.3.1.2a);
      was nominal B/L. Bp is the x-dimension, Lp the y-dimension. */
   const mxm=(2+Bp/Lp)/(1+Bp/Lp), mym=(2+Lp/Bp)/(1+Lp/Bp);
  ```
  Report block: title reference now "Vesić (m interpolated by load direction, on B′/L′ — AASHTO LRFD 10.6.3.1.2a)"; symbolic line `m_x=\tfrac{2+B'/L'}{1+B'/L'},\; m_y=\tfrac{2+L'/B'}{1+L'/B'}`; the substituted line starts with `B'/L'=9.02/8.00,`.
- **Check case** (default inputs, depth factors On to isolate this item — i.e. an old save): before B/L = 1.25, m = 3.25/2.25 = 1.4444; after B′/L′ = 9.0233/8.00 = 1.1279, m = 3.1279/2.1279 = 1.4699. 1 − H/V = 1 − 7.20/434.94 = 0.98345. i_q = 0.98345^m: 0.97618 → 0.97576; i_γ = 0.98345^(m+1): 0.96002 → 0.95961. q_ult = 28.192 → 28.181 ksf, q_allow = 9.397 → 9.393 ksf, **DCR 0.6412 → 0.6414** (more conservative here). Combination 6 (D + 0.6(−Wx)): DCR 0.44 → 0.45 in the table. Cases with no horizontal load: no change (i = 1).

### S2. SF-O2: "Depth factors d_q, d_c" option (default Off for new projects)   [calc change] [more conservative for new projects; old saves unchanged]
- **Where:** new select in Soil & Bearing Capacity (`data-path="soil.sfdDepthF"`, shown in Vesić mode only, after "Bearing capacity FS"); `defaultState()` soil (`sfdDepthF:'off'`); `migrateState()` (old saves → `'on'`); `vesicCapacity()` anchor `const dq=`; `computeAll()` anchor `const ctx={B,L,Df,phi`; warning list; report `Depth factors` block; input echo `Bearing basis` row; Manual 2.4 and 4B.2.
- **Problem:** d_q and d_c were always applied. AASHTO LRFD 10th Ed. Art. 10.6.3.1.2a (and its commentary) uses the depth factors only where the soil above the bearing level is as competent as the bearing soil and will not be removed (excavation, scour, frost); otherwise d = 1.0. Applying them unconditionally is unconservative.
- **Default chosen:** Off (d_q = d_c = 1.0) for new projects, the conservative choice that does not rely on the overburden. Projects saved before this option existed (autosave, saved projects, exported JSON) open with **On**, so their results do not silently change; a new amber warning then says the depth factors are applied and when they are valid. (See "Needs engineer" Q-SF3 to confirm the old-save default.)
- **Before:**
  ```js
   const dq=1+2*tphi*Math.pow(1-Math.sin(phi),2)*kk;
   const dc=phi>1e-6?(dq-(1-dq)/(Nc*tphi)):(1+0.4*kk);
  ```
  ```js
   const ctx={B,L,Df,phi,c,gs,gw,dw:dwc===Infinity?Infinity:dwc,FSb};
  ```
- **After:**
  ```js
   /* depth factors only when the "use depth factors" option is on (soil.sfdDepthF):
      AASHTO LRFD 10.6.3.1.2a - use them only where the soil above the base is as
      competent as the bearing soil and will not be removed; otherwise d = 1.0. */
   const useD=(ctx.useD===true);
   const dq=useD?1+2*tphi*Math.pow(1-Math.sin(phi),2)*kk:1;
   const dc=useD?(phi>1e-6?(dq-(1-dq)/(Nc*tphi)):(1+0.4*kk)):1;
  ```
  `useD` added to the returned object (after `dg,`). `const ctx={B,L,Df,phi,c,gs,gw,dw:dwc===Infinity?Infinity:dwc,FSb,useD:state.soil.sfdDepthF==='on'};`
  `defaultState()`: `soil:{...,qaOverride:'off',qaOverVal:4,sfdDepthF:'off'}`.
  `migrateState()`, inserted right after `const ds=defaultState();`:
  ```js
   // Saves made before the "use depth factors" option always applied d_q / d_c: keep them on
   // for those saves so an old project reproduces its results (new projects default to off).
   if(!state.soil||typeof state.soil!=='object')state.soil={};
   if(state.soil.sfdDepthF===undefined)state.soil.sfdDepthF='on';
  ```
  Input row (after the Bearing capacity FS row):
  ```html
   <div class="row sm-vesic"><label>Depth factors d<sub>q</sub>, d<sub>c</sub></label><select data-path="soil.sfdDepthF"><option value="off">Off (d = 1.0)</option><option value="on">On (Vesi&cacute;)</option></select><span class="hint">AASHTO 10.6.3.1.2a</span></div>
  ```
  Warning (in `computeAll()` after the passive-fraction check): `if(state.soil.mode==='vesic'&&state.soil.sfdDepthF==='on'&&Df>0)W.push({lvl:'warn',msg:'Depth factors d_q, d_c are applied ... (AASHTO LRFD 10.6.3.1.2a); otherwise set "Depth factors" to Off.'});`
  Report: when off, the `Depth factors` block shows `d_q = d_c = d_γ = 1` with reference "Option off — AASHTO LRFD 10.6.3.1.2a (soil above the base not relied on)"; when on, the existing block with "option on — soil above the base taken as competent and permanent" added to its reference. Input echo: "…, FS=3.00, depth factors off)".
- **Check case** (default inputs, governing combination): k = D_f/B_eff = 4/8 = 0.5; d_q (on) = 1 + 2·tan32°·(1 − sin32°)²·0.5 = 1 + 2·0.6249·0.2210·0.5 = 1.1381.
  - Main (d on, m on B/L): T2 = 0.480·23.177·1.5540·1.1381·0.97618 = 19.206; T3 = 0.5·0.120·8·30.215·0.6454·0.96002 = 8.985; q_ult = 28.192, q_allow = 9.397 ksf, **DCR = 6.025/9.397 = 0.6412**.
  - Branch, new project (d off, m on B′/L′): T2 = 0.480·23.177·1.5540·1.0·0.97576 = 16.869; T3 = 8.982; q_ult = 25.851, q_allow = 8.617 ksf, **DCR = 6.025/8.617 = 0.6992** (dashboard "Bearing (service)" 0.64 → 0.70). More conservative.
  - Branch, old save (d on): DCR 0.6414 (S1 only).
- **Saved data:** new optional field `soil.sfdDepthF` (`'off'`/`'on'`). Old files load unchanged and get `'on'`. No key renamed.

### S3. SF-O4: compression dowel ℓ_dc with √f'c ≤ 100 psi   [calc change] [more conservative, rarely active]
- **Where:** `computePhase2()`, anchor `const Ldc=Math.max(0.02*BAR_DIA[dSize]*fy/(lam*` (about line 3372); report block `Bearing on concrete & dowels`.
- **Problem:** ACI 318-19 25.4.1.4 limits √f'c to 100 psi in all development-length calculations of Ch. 25; the compression ℓ_dc (25.4.9.2) did not apply it.
- **Before:**
  ```js
    const Ldc=Math.max(0.02*BAR_DIA[dSize]*fy/(lam*sq),0.0003*BAR_DIA[dSize]*fy,8);
  ```
- **After:**
  ```js
    const Ldc=Math.max(0.02*BAR_DIA[dSize]*fy/(lam*Math.min(sq,100)),0.0003*BAR_DIA[dSize]*fy,8); // ACI 318-19 25.4.9.2, sqrt(f'c) <= 100 psi (25.4.1.4)
  ```
  Report symbolic line now ends `…\ge 0.0003 f_y d_b,\;\sqrt{f'_c}\le100\;\mathrm{psi}`.
- **Effect:** with √f'c capped at 100, the first term is 0.02f_y d_b/(100λ) = 0.0002f_y d_b/λ, which exceeds the 0.0003f_y d_b floor only when λ < 0.667. So the change alters ℓ_dc only for f'c > 10,000 psi **and** λ < 0.667; otherwise the result is identical (checked: default, and f'c = 12,000 psi with λ = 1 give ℓ_dc = 18.97 and 18.00 in before and after).
- **Check case:** #8 dowel (d_b = 1.0 in), f_y = 60,000 psi, f'c = 12,000 psi, λ = 0.5. Before: 0.02·60000·1.0/(0.5·109.54) = 21.91 in (> 0.0003·60000·1.0 = 18.0) → ℓ_dc = 21.91 in. After: 0.02·60000·1.0/(0.5·100) = 24.00 in → ℓ_dc = **24.00 in**. More conservative.

### S4. SF-O5: optional side/end cover for the bottom-bar ℓ_d   [calc change only when the new input is used] [no change by default]
- **Where:** new input in Materials after "Cover, top" (`data-path="mat.sfdCoverSide"`, text field, blank = bottom cover); new helpers `sfdSideCoverIn()`, `sfdCbCover()`, `sfdEndCover()` inserted just above `function devLength(`; `renderFootingDesign()` §5.4 anchors `const dv=devLength(size,P2.fc,P2.fy,false,{lam:P2.lam,cover:` and `const avail=(sec===null||sec===undefined)?-1:`; input validation; `SFD_IN_ERR` (Materials tab dot); Manual 2.3.
- **Problem:** c_b used the bottom clear cover and assumed the side cover is not less (ACI 318-19 25.4.2.4 / definition of c_b: the smaller of the distance from the bar centre to the nearest concrete surface and half the c-c spacing). A footing with a smaller side/end cover was unconservative; the end cover deducted from the available length was also always the bottom cover.
- **Before:**
  ```js
    const dv=devLength(size,P2.fc,P2.fy,false,{lam:P2.lam,cover:num(state.mat.coverBot),spc:spcD,coating:state.mat.coating,detail:true});
  ...
    const avail=(sec===null||sec===undefined)?-1:((hf-Math.abs(sec))*12-num(state.mat.coverBot));
  ```
- **After:**
  ```js
    const dv=devLength(size,P2.fc,P2.fy,false,{lam:P2.lam,cover:sfdCbCover(),spc:spcD,coating:state.mat.coating,detail:true});
  ...
    const avail=(sec===null||sec===undefined)?-1:((hf-Math.abs(sec))*12-sfdEndCover());
  ```
  with
  ```js
  function sfdSideCoverIn(){const v=state.mat.sfdCoverSide;
   if(v===undefined||v===null||String(v).trim()==='')return null;
   const x=Number(String(v).trim());return isFinite(x)?x:NaN;}
  function sfdCbCover(){const cb=num(state.mat.coverBot),sd=sfdSideCoverIn();
   return (sd===null||isNaN(sd))?cb:Math.min(cb,Math.max(sd,0));}
  function sfdEndCover(){const sd=sfdSideCoverIn();
   return (sd===null||isNaN(sd))?num(state.mat.coverBot):Math.max(sd,0);}
  ```
  The substituted "available" line prints `sfdEndCover()`; the §5.4 note states which cover c_b used. Validation: a negative entry gives the existing "Cover cannot be negative." error; a non-number gives "Side/end cover must be a number in inches, or blank to use the bottom cover." (both mark the Materials tab).
- **Check case** (default inputs, x-bars #8 @ 9 in, governing section at 3.75 ft from centre): blank (default) → c_b = min(3 + 0.5, 4.5) = 3.50, (c_b)/d_b = 2.5 (cap), ℓ_d = (3/40)(60000/63.25)(1/2.5)(1.0) = **28.46 in**, available = (5.00 − 3.75)·12 − 3.00 = **12.00 in** (identical to before). Side/end cover 1.5 in → c_b = 2.00, (c_b)/d_b = 2.00, ℓ_d = **35.58 in** (more conservative); available = 15.00 − 1.50 = **13.50 in**. Side/end cover 4 in → c_b = 3.50 (bottom governs), ℓ_d = 28.46 in, available = 11.00 in.
- **Saved data:** new optional field `mat.sfdCoverSide` (string, blank by default; absent in old files = blank, so old files give identical results).

### S5. SF-O3: passive resistance over the full D_f — kept; warning added   [display only, no result change]
- **Decision (my judgment, per the 2026-10-12 instruction):** the formula `PpX=pf*0.5*Kp*gs*Df*Df*L` is left unchanged. It is conservative by default (passive fraction f_p = 0) and f_p is the user's control. When f_p > 0 an amber warning now says that passive is credited over the full D_f and full width, and that soil that may be removed (excavation, scour, frost) and soil above the footing top should be neglected unless the geotechnical report allows it (AASHTO LRFD 10th Ed. Art. 10.6.3.4, verify).
- **Where / After:** `computeAll()`, right after `if(num(state.stab.pf)<0||num(state.stab.pf)>1)W.push({lvl:'err',msg:'Passive fraction mobilized must be between 0 and 1.'});`:
  ```js
   else if(num(state.stab.pf)>0)W.push({lvl:'warn',msg:'Passive resistance is credited over the full embedment Df and the full footing width (P_p = f_p·½K_pγD_f²·w), not only the footing face of depth t. Neglect soil that may be removed by excavation, scour or frost, and soil above the footing top, unless the geotechnical report allows it (AASHTO LRFD 10.6.3.4); set the passive fraction accordingly.'});
  ```
- **Check case:** f_p = 0.5 → warning shown; all results identical to main.

### How verified (S1–S5)
- `node --check` on all 18 inline scripts: pass.
- Headless Chromium (Playwright; KaTeX 0.16.11, Plotly 2.35.2, three.js 0.160.0 served from local copies of the pinned versions), origin/main vs branch, scenarios: default; old autosave written by main then opened in the branch; no horizontal load; depth factors On in both; f'c = 12,000; side cover 2 in and "abc"; f_p = 0.5; Direct load mode. Compared the dashboard, warnings, every output tab, `computeAll()` per-combination bearing values, `computePhase2()` ℓ_dc and the saved `state` JSON. Every difference traced to S1–S5: bearing DCR/q_allow and the bearing report blocks (S1, S2), input echo text (S2), §5.4/§5.6 text (S3, S4), new warnings (S2 when On, S4 bad entry, S5). Saved state: only the new `soil.sfdDepthF` field (`'off'` new, `'on'` for the old autosave); `sfdCoverSide` only when entered. No console errors in any scenario. Hand-off code untouched.
- Screenshots of the Soil and Materials sections and the two bearing report blocks checked.
- **Other copies:** none (the Vesić routine and the ℓ_d helper exist only in this tool).

### Needs engineer (left as is)
- **Q-SF1 (SF-C2): Direct (factored) load mode.** Self-weight, pedestal weight and EV are bracketed with ASCE 7 1.2 / 0.9 (not AASHTO γ_p), bearing is checked with factored loads against an allowable (service) bearing, and there is one case per pedestal. Question: is Direct mode meant for ASCE 7 building work only (then keep, the note already says "indicative only"), or should it follow AASHTO (γ_p max/min per Table 3.4.1-2 and a factored resistance φ_b·q_n)? Recommendation: keep as is and label Direct mode "ASCE 7 / indicative"; use by-load-type mode for bridge work.
- **Q-SF2 (SF-C1): seismic load type (E).** There is no E load type, so E reactions in a hand-off are not imported. Question: is seismic needed in this tool? Recommendation: add E with the ASCE 7-16 2.3.6 / 2.4.5 combinations (with E_v and Ω₀ left to the user) only if you design seismic footings with it; otherwise keep, and the hand-off already says E is not imported.
- **Q-SF3 (SF-O2 default for old saves).** Old projects open with depth factors On (results unchanged, warning shown); new projects default Off. Question: should old projects also open with Off (more conservative, but bearing results of old saved projects would change on reopening)? Recommendation: keep On for old saves.
- **Q-SF4 (SF-O3 passive height).** Should passive be limited to the footing face, P_p = f_p·½K_pγ(D_f² − (D_f − t)²)·w, instead of the full D_f? Recommendation: keep f_p as the user's control with the new warning; the default f_p = 0 credits no passive.

## Open items (not changed)
- **Q-SF1 (SF-C2). Direct load mode basis** (ASCE 7 1.2/0.9 self-weight bracket; factored loads vs allowable bearing; one case per pedestal). Needs engineer: see the 2026-10-12 entry, "Needs engineer".
- **Q-SF2 (SF-C1). No seismic (E) load type**, so E reactions are not imported. Needs engineer: see the 2026-10-12 entry.
- **Q-SF3. Depth-factor default for old saves** (On, results unchanged). Needs engineer to confirm: see the 2026-10-12 entry.
- **Q-SF4 (O3). Passive height** (full D_f vs footing face only). Kept, with a warning when f_p > 0. Needs engineer to confirm: see the 2026-10-12 entry.

## Resolved items
- **O1. Vesić inclination exponent m on nominal B/L.** RESOLVED 2026-10-12 (S1): m now uses B′/L′.
- **O2. Depth factors always applied.** RESOLVED 2026-10-12 (S2): "Depth factors" option, Off for new projects, On for saves made before the option (confirmation asked in Q-SF3).
- **O3. Passive over the full D_f.** DECIDED 2026-10-12 (S5): formula kept (conservative by default, f_p = 0); warning added when f_p > 0. Confirmation asked in Q-SF4.
- **O4. ℓ_dc without the √f'c ≤ 100 psi cap.** RESOLVED 2026-10-12 (S3).
- **O5. ℓ_d side cover assumption.** RESOLVED 2026-10-12 (S4): optional side/end cover input; blank keeps the earlier behaviour.
- **F8 note (item 8): surcharge in the structural resultant is less conservative for sagging moment and one-way shear. Keep, revert, or apply only where unfavourable?**
  - **RESOLVED 2026-10-04 (F12):** engineer keeps the surcharge in the structural resultant. No code change.

## 2026-10-18 — PR: claude/sf-d11-report (PR link added after merge)

Line numbers are approximate; search for the anchor text. The file uses LF line endings.

### D11: calculation-sheet report in the Gusset Plate Rating / ST-Girder format (Tier 1, display only)
- **Engineer request:** 2026-10-14 / 2026-10-18 (AUDIT.md D11).
- **What changes for the user:** the printout of **Print-to-PDF Report** (and of Ctrl+P, which is the same in-page print) changes as listed under "After". The screen is unchanged except for the new "Worked in" lines (next entry). No new input, button or saved field.
- **Approach:** the tool already printed its result tabs in place, with numbered cards (1.1 … 6.k) whose equations are worked symbolically → substituted → result. That stays as it is: the report is the tabs' own render output, and nothing is recomputed. The gaps were closed around it (cover, references, contents, section headings, result lines, print header and footer).
- **Before (print):**
  - the screen title row and the six title-block **input boxes** printed at the top, followed by `#printHeader` (title, a one-row Project / No. / Calc By / Date / Checked By / Date table, the hand-off source lines);
  - then the Summary Dashboard, warnings, the self-consistency table and every result tab, with no section headings (the tab bar is hidden in print), no references, no contents and no result lines;
  - every open card title printed with the ▾ open-marker (`details.sec[open]>summary::before` outranked the print rule `details.sec>summary::before{content:""}`);
  - the 3D View tab printed whatever the live WebGL panel held (empty unless the tab had been opened);
  - default browser page margins, no header or footer.
- **After (print):**
  - **Cover** (`#printHeader`, built by `renderPrintHeader()`):
    - "Spread Footing Design — Calculation Report", the project name, the codes (ACI 318-19 · ASCE 7-16 · IBC 2021);
    - title block Project / Project No. / Calculated by / Date / Checked by / Checked date, from the existing `meta.*` fields (all six existed; none was added);
    - the hand-off source lines (`sfMrSourceLine`, `sfFlSourceLine`), as before;
    - a banner counting the dashboard chips by status ("1 of 17 checks FAIL · 14 PASS · 2 N/A" on the default project).
  - **References** (`SFD_REFS`), only what the tool cites (taken from the cards and the manual's §A.2):
    - ACI 318-19 (the sections the cards cite); ASCE/SEI 7-16 §2.3.1 / §2.4.1; IBC 2021 §1605.3 / §1610 / §1807.2.3;
    - AASHTO LRFD Art. 10.6.3.1.2a, 10.6.3.3 / 11.6.3.3, 10.6.4.2 / 11.6.5.1, 10.6.3.4, marked "edition: verify (the tool states none)";
    - Vesić (1973, 1975), Meyerhof (1953), Bowles 5th ed., Rankine.
  - **Numbered table of contents** with links: Summary Dashboard, then 1–6 (the result tabs) with every card n.k. The entries are read from the card titles, so they follow the tool's own numbering (including 3.2a and 4.3a). "8. User Manual" is added when "Include this manual when printing" is ticked.
  - **Section headings** "n. <tab name>" before each result tab, with a page break, built from the tab buttons.
  - **Result lines** after each tab (`sfdResultRows()`): one per dashboard chip, "<check>: D/C = x.xx (<reference>; <the chip's own text>; §n.k) PASS / FAIL / REVIEW / N/A".
    - The status is the chip's own class; the dashboard logic is not repeated.
    - D/C uses the values the chip uses: bearing `R.govBear.DCR`; eccentricity `R.eccChk.gov.dcr`; flexure the max of `dcrBot` / `dcrTop`; one-way `dcrV`; punching, concrete bearing and pedestal `dcr` / `dcrAxial`.
    - For a factor-of-safety check, D/C = FS_target / FS (overturning only when gated; 1/FS when the footing is unstable or FS < 1, which is when the chip fails). Rigidity: λℓ / (π/4). Dowel steel: A_s,min / A_s,prov; dowel ℓ_dc / available (the chips' own pass conditions).
    - D/C is "n/a" for contact area, input validation, a non-gated overturning FS, and checks with no horizontal load or no water table.
  - **Dashboard chips** print "see §n.k" under the status, pointing to where the check is worked (bearing → §3.3, flexure and one-way → §5.2, §5.3, and so on).
  - **Print header and footer** (`sfdPageCSS(true)` on `beforeprint`, cleared on `afterprint`): `@page` letter, margins 0.95 / 0.6 / 0.7 / 0.6 in.
    - Top: "Project No / Description" (Description = the project name: the tool has no description field), "Computed By / Checked By", "Date / Date" (`meta.calcDate`, `meta.chkDate`).
    - Bottom: "<project> (Spread Footing Design Tool)" and "Page X of Y".
  - **Hidden in print:** the screen title row and the title-block input boxes (the cover replaces them); the **3D View tab** (a live WebGL panel, not part of the calculation); the "★ governing" reset button of the combination selector bars (the selected combination still prints).
- **Where (re-apply by hand):**
  1. CSS: after the second `@media print{ … }` block (anchor `.chip.pass,.chip.fail,.warnbox,.errbox,table.tbl th{-webkit-print-color-adjust:exact;print-color-adjust:exact}`, then `}`), add the block that starts `/* D11 (2026-10-18): calculation-sheet report (print only:` and ends before `</style>`. Copy it from this version.
  2. HTML: `<h2 style="margin-top:0">Summary Dashboard</h2>` → `<h2 style="margin-top:0" id="sfdRptSum">Summary Dashboard</h2>`.
  3. `chip()`: after `c.appendChild(el('div','cs',status==='pass'?'PASS':status==='fail'?'FAIL':status==='warn'?'REVIEW':'N/A'));` add
     ```js
      if(nav&&nav.tab){c.dataset.tab=nav.tab;if(nav.sec)c.dataset.sec=nav.sec;}   /* D11: read by the report (result lines, "see §") */
     ```
  4. `renderPrintHeader()`: the old function (from `function renderPrintHeader(){` to the `sfFlSourceLine` line and its `}`) is replaced by the block from the anchor `/* D11 (2026-10-18): calculation-sheet report in the Gusset Plate Rating / ST-Girder format, printed` to the end of the new `renderPrintHeader()`: `SFD_REFS`, `sfdSecNum`, `sfdEsc`, `sfdPageCSS`, `sfdResultRows`, `renderPrintHeader`. Copy it from this version. It is still called at the end of `recalc()` (unchanged) and now also on `beforeprint`.
  5. Print hooks (anchor `/* print: open all sections, restore after */`):
     - Before:
       ```js
       window.addEventListener('beforeprint',()=>{
        printPrev=$$('details').map(d=>[d,d.open]);
        $$('details').forEach(d=>d.open=true);});
       window.addEventListener('afterprint',()=>{
        if(printPrev)printPrev.forEach(([d,o])=>d.open=o);printPrev=null;});
       ```
     - After:
       ```js
       window.addEventListener('beforeprint',()=>{
        printPrev=$$('details').map(d=>[d,d.open]);
        $$('details').forEach(d=>d.open=true);
        renderPrintHeader();sfdPageCSS(true);});   /* D11: report parts (renderPrintHeader) and the print header/footer, only while printing */
       window.addEventListener('afterprint',()=>{
        sfdPageCSS(false);
        if(printPrev)printPrev.forEach(([d,o])=>d.open=o);printPrev=null;});
       ```
- **Fixed along the way (report display only):**
  - the ▾ marker before every printed card title (36 on the default project);
  - the empty title-block input boxes printed above the report;
  - the missing section headings (the hidden tab bar was the only place the tab names appeared);
  - user text in the old `#printHeader` table was inserted unescaped (now escaped).
- **Provision:** none. No formula, factor, unit, code reference or result changed.
- **Saved data:** none. `sfd_auto`, `sfd_projects`, `sfd_inputTab_v1` and the JSON export are unchanged; no new key.
- **Check case (default project):** 32 letter pages (main: 23).
  - Contents: Summary Dashboard; 1. Schematic & Input Echo (1.1–1.5); 2. Load Combinations (2.1–2.5); 3. Bearing (3.1, 3.2, 3.2a, 3.3); 4. Stability (4.1–4.3, 4.3a, 4.4, 4.5); 5. Footing Design (5.1–5.7); 6. Pedestal Design (6.1–6.3).
  - 17 result lines, for example:
    - Bearing (service): D/C = 0.70 (q_eff ≤ q_allow; §3.3) PASS. Eccentricity limit: 0.31 (§4.3a) PASS. Sliding, x: 0.20 (= 1.50 / 7.69; §4.2) PASS. Rigidity: 0.50 (= 0.40 / 0.79; §4.5) PASS.
    - Flexure (footing): D/C = 0.30, **FAIL** ("DCR 0.30 OK, but A_s < A_s,min (top x)", the chip's own status; §5.2, §5.3). One-way shear 0.55, punching 0.32, concrete bearing 0.22, dowel steel 0.26, dowel ℓ_dc 0.76, pedestal 0.42 (§6.2, §6.3), all PASS.
    - Overturning: D/C = n/a, "FS = 20.62 … (reported, not gated)", N/A.

### D11 links: quoted values link to the card where they are worked (CLAUDE.md §6) (Tier 1, display only)
- **New helpers** after `solve3()` (anchor `/* ---- D11 links (CLAUDE.md §6, 2026-10-18)`): `SFD_LINKS` (card id → tab and label), `SFD_TABNAME`, `sfdLink`, `sfdWorkedIn`, `sfdGoto`, and one document click handler for `a.wkA`. A click opens the tab (with the tab button's own click), opens the card, scrolls to it and flashes its title, as the dashboard chips already do.
- **"Worked in" lines added** (each is one `….appendChild(sfdWorkedIn([...]));   /* D11 links */` line):
  1. 1.4 Input Echo, after `b4.appendChild(buildInputEcho());`: footing self-weight → 2.2.
  2. 2.3 combination table, after `b1.appendChild(comboTable(R.asd,true));`: q_max, contact % → 3.2; bearing DCR → 3.3; min FS OT → 4.3; FS sl → 4.2 ("worked for the governing or selected combination; the same procedure is applied to every row").
  3. 3.1, after the ΣP / ΣH / ΣM / e table (anchor `['e_y','Eccentricity, y',r.ey,'ft']]));`): ΣP, ΣH, ΣM → 2.3.
  4. 4.2 Sliding, just before `/* overturning */`: ΣP, ΣH → 2.3.
  5. 4.3 Overturning, after the vertical-load table (`b2.appendChild(vt);`): self-weights, EV, U → 2.2; ΣP, ΣH, ΣM → 2.3.
  6. 4.4 Flotation, after its note "EV already uses buoyant unit weight…": W_f, ΣW_ped, EV, U → 2.2.
  7. 6.1 summary table, after `intro.appendChild(t);`: each pedestal → its 6.k "Detailed Checks" card.
- **In the report** every link reads "<value>: see §n.k" (a PDF link to the card); n.k is read from the target card's own title (`sfdSecNum`). A target that is not printed would read "? (not in this printout)" (none in the cases tested).
- **Check case (default):** 11 links on screen (13 in the 3-pedestal water-table case); each opens the right tab and card. The default PDF reads, for example, "footing self-weight: see §2.2", "q_max, contact %: see §3.2 · bearing DCR: see §3.3 · min FS OT: see §4.3 · FS sl: see §4.2", "Ped 1: see §6.2 · Ped 2: see §6.3". The PDF has 98 internal link annotations.

### How verified (both entries)
- `node tests/check-syntax.mjs "Spread Footing.html"`: all 18 scripts pass.
- `node tests/compare.mjs --tool page --file "Spread Footing.html"`: page.storage identical; page.text differs only by the added line "Worked in: footing self-weight → Load Combinations · 2.2 …" (tab 1 is the open tab). The console errors are the same on both sides (the kit holds no KaTeX 0.16.11, Plotly 2.35.2 or three 0.160.0).
- **Main vs branch with the pinned libraries served locally** (KaTeX 0.16.11, plotly.js-dist-min 2.35.2, three 0.160.0 from `npm pack`), five cases:
  1. default;
  2. Direct (factored) load mode;
  3. water table, AASHTO e ≤ B/3, gated overturning, passive 0.5, top mats, side cover, a third pedestal, Mx and Wy loads;
  4. direct net q_a with failures (V_c override, custom e limit, smaller footing, a zero-height pedestal, manual printing on);
  5. an input error (B = 0).
  - In every case `R` and `P2` (functions removed), the dashboard, warnings, self-consistency text, `state` and localStorage are identical, with 0 console errors.
  - On the branch, building the report (`beforeprint` / `afterprint`) leaves `R`, `P2`, `state` and the storage keys unchanged.
- **Headless Chromium PDF** (print media, `preferCSSPageSize`) of all five cases: no raw TeX, no ▾ marker, every internal link resolves (85–91 links per case, 0 broken), header and footer boxes filled (also with a `"` in the project name). Pages looked at: cover; references and contents; summary with "see §"; §1 start; §3.1 with its "Worked in" line; §4 results; the §4.3 table with its line; §5 results; §6.1 with its line; the input-error report.
- In the app, every link of the default and a 3-pedestal case (24 clicks) opens the right tab, opens the card and scrolls it into view.
- **Other copies:** none (the report builder and the links are specific to this tool).

### Open items (noticed, not changed)
- **Contact-area chip:** `R.minContact>=1-1e-6?'pass':(R.minContact>0?'pass':'fail')` gives PASS on both branches, so any partial contact passes (only zero contact fails). Probably intended (eccentricity and bearing are checked separately), but the chip shows no limit. The report prints it as is (D/C n/a).
- **Sliding chips with no horizontal load** show "N/A — no net horizontal load" with the status PASS (FS = ∞ ≥ target). The report prints D/C n/a, PASS.
- **The default project fails Flexure:** hogging between the two pedestals needs a top x mat and the default has none, so the chip reads "DCR 0.30 OK, but A_s < A_s,min (top x)", FAIL. On-screen behaviour, unchanged.
- **Values quoted but not linked:** the pedestal P_u in 5.6 / 6.1 and the governing LRFD combination named in 5.2 / 5.3 come from the LRFD resultants (2.5 table), but no card works P_u per pedestal, so there is nothing to link to.

### Needs engineer
- **Report length:** the report prints every card of the tabs (default: 32 pages, was 23; the extra pages are the cover, references and contents, and one page break per section). Keep it all, or add section toggles later?
- **3D View no longer prints.** It printed only a live WebGL panel (empty unless the tab had been opened). Confirm it should stay out of the report.
- **Description** in the print header is the project name (the tool has no description field, and none was added).

## 2026-10-19 — PR: claude/sf-status-chips (PR link added after merge)

Line numbers are approximate; search for the anchor text. The file uses LF line endings.

### SF-ST1: dashboard chip status for contact area and for sliding with no horizontal load (status only)
- **Engineer decision:** 2026-10-19, on the two open items of the D11 entry (2026-10-18) above.
  1. Contact area: full contact → PASS; partial contact → REVIEW (a warning: bearing and overturning still govern strength); no contact or instability (resultant off the footing) → FAIL.
  2. Sliding with no net horizontal load: status N/A (it was PASS with the text "N/A — no net horizontal load"), the same N/A the dashboard already uses (overturning not gated, flotation with no water table). N/A is not counted as PASS or FAIL.
- **What changes for the user:** only the status (colour and PASS / REVIEW / FAIL / N/A word) of these chips, and so the report's result lines and cover banner, which read the chip's own status (`sfdResultRows()` takes the chip's class; `renderPrintHeader()` counts the rows by status; neither was changed). No computed value changes: `R`, `P2`, warnings, self-consistency text, `state` and the saved data are identical (see "How verified"). The banner's "x of y checks" keeps counting every chip in y (unchanged); N/A chips are counted under N/A, as before.
- **Where:** `renderDashboard()`.
  1. Sliding chips (anchors `chip('Sliding, x'`, `chip('Sliding, y'`, `chip('Sliding, resultant`): the status argument.
     - Before: `R.govSlx.FSslx>=FSsl?'pass':'fail'` (likewise `R.govSly.FSsly`, `R.govSlr.FSslr`)
     - After: `R.govSlx.FSslx===Infinity?'na':(R.govSlx.FSslx>=FSsl?'pass':'fail')` (likewise for y and the resultant)
     - FS = ∞ is exactly the condition the chip text already used for "N/A — no net horizontal load".
  2. Contact-area chip (anchor `chip('Contact area'`):
     - Before:
       ```js
        d.appendChild(chip('Contact area','min '+f2(R.minContact*100)+'% of footing',R.minContact>=1-1e-6?'pass':(R.minContact>0?'pass':'fail'),undefined,{tab:'tab-bearing',sec:'o-br-press'}));
       ```
     - After:
       ```js
        /* SF-ST1 (2026-10-19, engineer): full contact PASS; partial contact REVIEW (a warning: bearing and
           overturning govern strength); no contact or resultant off the footing (anyUnstable) FAIL. */
        d.appendChild(chip('Contact area','min '+f2(R.minContact*100)+'% of footing'+(anyUnstable?' — resultant off the footing in at least one combination':''),(anyUnstable||R.minContact<=0)?'fail':(R.minContact>=1-1e-6?'pass':'warn'),undefined,{tab:'tab-bearing',sec:'o-br-press'}));
       ```
     - `anyUnstable` is the existing local of `renderDashboard()` (`R.asd.some(a=>a.bear.mode==='unstable'||a.r.P<=1e-9)`), the same test the Overturning chip fails on.
     - Why `anyUnstable` is needed: `solveBearing()` returns `{mode:'unstable'}` with no `contactFrac` when the resultant is off the footing, and `R.minContact` counts a missing `contactFrac` as 1, so an unstable footing showed "min 100.00% of footing", PASS. `R.minContact` itself is not changed (a computed value). The chip text gets the suffix " — resultant off the footing in at least one combination" only in that case, so the FAIL is not shown next to an unexplained "100%".
  3. User Manual §3.1 chip table (anchors `["Sliding x / y",` and `["Contact area",`): rows reworded to the new statuses.
     - Before: `"(μΣP + Pp)/|ΣH| ≥ target FS, per direction"`; `"informational: minimum contact fraction across service combos; warning issued when < 100%"`.
     - After: `"(μΣP + Pp)/|ΣH| ≥ target FS, per direction (also the resultant); N/A when there is no net horizontal load"`; `"minimum contact fraction across service combos: PASS at full contact; REVIEW when < 100% (a warning: bearing and overturning govern strength); FAIL with no contact or the resultant off the footing"`.
- **Provision:** none changed. No formula, factor, unit, target FS or code reference changed; this is the status shown for existing results (pass/fail logic of two dashboard chips, called out per CLAUDE.md §4).
- **Saved data:** none. No key or saved field added or changed.
- **Check cases** (default project plus the change listed; main → branch):
  - **(a) Partial contact:** Wx M_y = 400 kip·ft on Ped 1 and Ped 2. Governing 0.6D + 0.6(+Wx): e/B = 0.31, so e = 3.1 ft > B/6 = 10/6 = 1.67 ft (outside the kern): partial contact. Contact area chip "min 58.35% of footing": PASS → **REVIEW**. Sliding y (no y load) PASS → N/A. Banner "3 of 17 checks FAIL · 12 PASS · 2 N/A" → "3 of 17 checks FAIL · 10 PASS · 1 REVIEW · 3 N/A". Bearing (DCR 1.00, PASS), eccentricity limit (FAIL), one-way shear (FAIL) unchanged.
  - **(b) No horizontal load:** Wx V_x = 0 on Ped 1 and Ped 2 (no H in any combination). Sliding x, y and resultant "N/A — no net horizontal load …": PASS → **N/A** (3 chips). Banner "1 of 17 checks FAIL · 14 PASS · 2 N/A" → "1 of 17 checks FAIL · 11 PASS · 5 N/A".
  - **(c) Resultant off the footing:** Wx M_y = 3000 kip·ft on Ped 1 and Ped 2 (0.6D + 0.6(+Wx): e/B = 1.96 > 0.5). Contact area "min 100.00% of footing", PASS → "min 100.00% of footing — resultant off the footing in at least one combination", **FAIL**. Sliding y PASS → N/A. Banner "4 of 17 checks FAIL · 12 PASS · 1 N/A" → "5 of 17 checks FAIL · 10 PASS · 2 N/A".
  - **Default project:** only Sliding y (no y load) PASS → N/A. Banner "1 of 17 checks FAIL · 14 PASS · 2 N/A" → "1 of 17 checks FAIL · 13 PASS · 3 N/A".
- **How verified:**
  - `node tests/check-syntax.mjs "Spread Footing.html"`: all scripts pass.
  - `node tests/compare.mjs --tool page --file "Spread Footing.html"`: page.storage identical; page.text differs only by the Sliding, y status "PASS" → "N/A". Console errors the same on both sides (the kit holds none of this tool's libraries).
  - Main vs branch, headless, with the pinned libraries served locally (KaTeX 0.16.11, plotly.js-dist-min 2.35.2, three 0.160.0 from `npm pack`), on the five cases of the D11 entry (default; Direct load mode; water table + AASHTO e ≤ B/3 + gated overturning + passive + top mats + third pedestal + moments; direct net q_a with failures; input error B = 0) and check cases (a)–(c): `R` and `P2` (functions dropped), warnings, self-consistency text, `state` and localStorage identical in every case, 0 console errors. Chip by chip, only the statuses listed above differ (and the contact chip text in (c)); the report's result lines differ only in those statuses, the banner only in its counts. The water-table case (horizontal load in x and y, full contact) and the input-error case are unchanged.
  - Screenshots of the dashboard (main and branch) for (a), (b), (c) looked at: REVIEW chip amber, N/A chips grey.
- **Other copies:** none.
- **Resolves** the D11 entry's open items "Contact-area chip" and "Sliding chips with no horizontal load".

## 2026-10-19 — PR: claude/aashto10-spread-footing (PR link added after merge)

Line numbers are approximate, as of this fix. Search for the anchor text.

### SF-A10: AASHTO LRFD edition stated (10th Ed., 2024); depth-factor citation corrected (text only, no result changes)
- **Where:** six text strings; no function logic changed.
  1. Soil inputs, depth-factor row hint (≈ line 312). Anchor: `data-path="soil.sfdDepthF"`
  2. `renderBearing`, §3.3 note (≈ line 2138). Anchor: `Reference: Vesić (1973, 1975)`
  3. `renderBearing`, §3.3 Depth factors line, option on, reference text (≈ line 2154). Anchor: `option on — soil above the base taken as competent and permanent`
  4. `SFD_REFS`, AASHTO LRFD row (≈ line 2534). Anchor: `['AASHTO LRFD','Bridge Design Specifications`
  5. User Manual §2 Input Reference, Depth factors row (≈ line 4908). Anchor: `["Depth factors d<sub>q</sub>, d<sub>c</sub>"`
  6. User Manual §A.2 References, Vesić item (≈ line 5192). Anchor: `Foundation Engineering Handbook</i>, 1975.`
- **Problem:** the tool stated no AASHTO edition ("edition: verify (the tool states none)") and said AASHTO LRFD 10.6.3.1.2a "presents the same form" as the Vesić equation it uses. Against the 10th Ed. (2024) that holds for N_q, N_c, N_γ, the shape factors and the inclination factors, but not for the depth factor: 10th Ed. Eq. 10.6.3.1.2a-10 is d_q = 1 + 2 tanφf (1 − sinφf)² arctan(Df/B) at every depth (no linear k = Df/B branch), with d_q ≤ 1.4, applied to the N_q term only (no d_c in Eq. 10.6.3.1.2a-2). The tool's option "On (Vesić)" uses Vesić's k = Df/B′ (≤ 1, arctan above), no cap, and d_c. The calculation is **not** changed in this PR: the tool is an ACI 318-19 / ASCE 7-16 / IBC 2021 building-footing tool with an ASD factor of safety on a Vesić capacity, so which depth factor it should use is an engineer decision (see Needs engineer). This entry only makes the text say what the tool does and which AASHTO edition the remaining citations were checked against.
- **Governing provision:** AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), Art. 10.6.3.1.2a (Eqs. 10.6.3.1.2a-1 to -10, Tables 10.6.3.1.2a-1 to -3), 10.6.3.3, 10.6.3.4, 10.6.4.2, 11.6.3.3, 11.6.5.1 (citations checked against the 10th Ed.; values in the tool unchanged).
- **Before / After** (source text, exactly):
  1. Before: `<span class="hint">AASHTO 10.6.3.1.2a</span></div>`
     After: `<span class="hint">Vesi&cacute; form (not AASHTO LRFD 10th Ed. Eq. 10.6.3.1.2a-10); use condition per AASHTO 10.6.3.1.2a</span></div>`
  2. Before: `Reference: Vesić (1973, 1975); AASHTO LRFD 10.6.3.1.2a form.'));`
     After: `Reference: Vesić (1973, 1975). AASHTO LRFD 10th Ed. (2024) Art. 10.6.3.1.2a uses the same N, shape and inclination factors, but its depth factor (Eq. 10.6.3.1.2a-10) differs from the Vesić depth factors used here (see the Depth factors line).'));`
  3. Before: `option on — soil above the base taken as competent and permanent (AASHTO LRFD 10.6.3.1.2a)',`
     After: `option on — soil above the base taken as competent and permanent (use condition: AASHTO LRFD 10.6.3.1.2a). Not AASHTO LRFD 10th Ed. Eq. 10.6.3.1.2a-10, which takes arctan(Df/B) at every depth, caps dq at 1.4 and has no dc',`
  4. Before: `['AASHTO LRFD','Bridge Design Specifications — Art. 10.6.3.1.2a (Vesić form, depth and inclination factors), 10.6.3.3 / 11.6.3.3 and 10.6.4.2 / 11.6.5.1 (eccentricity limits, when selected), 10.6.3.4 (passive, warning); edition: verify (the tool states none)'],`
     After: `['AASHTO LRFD','Bridge Design Specifications, 10th Ed. (2024) — Art. 10.6.3.1.2a (same N, shape and inclination factors as Vesić; use condition for depth factors; its Eq. 10.6.3.1.2a-10 depth factor is not the one used here), 10.6.3.3 / 11.6.3.3 and 10.6.4.2 / 11.6.5.1 (eccentricity limits, when selected), 10.6.3.4 (passive, warning)'],`
  5. Before: `On: Vesić depth factors from D<sub>f</sub>/B′. AASHTO LRFD 10.6.3.1.2a: use them`
     After: `On: Vesić depth factors from D<sub>f</sub>/B′ (not the AASHTO LRFD 10th Ed. Eq. 10.6.3.1.2a-10 form, which uses arctan(D<sub>f</sub>/B) at every depth, caps d<sub>q</sub> at 1.4 and has no d<sub>c</sub>). AASHTO LRFD 10.6.3.1.2a: use them`
  6. Before: `Foundation Engineering Handbook</i>, 1975. AASHTO LRFD 10.6.3.1.2a presents the same form.",`
     After: `Foundation Engineering Handbook</i>, 1975. AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), Art. 10.6.3.1.2a uses the same N, shape and inclination factors; its depth factor (Eq. 10.6.3.1.2a-10) differs from Vesić’s.",`
- **Saved data:** none. `soil.sfdDepthF` keeps its values (`off` / `on`) and meaning; the migration that opens pre-option saves with `on` is untouched.
- **Check case** (results unchanged; numbers for the engineer's decision): square footing B = L = 8 ft, Df = 4 ft, φ = 32°, c = 0, γ = 120 pcf, no groundwater, concentric vertical load, FS = 3 (`vesicCapacity` run in Node: same on main and on the branch).
  - N_q = 23.18, N_γ = 30.21, s_q = 1 + tan 32° = 1.625, s_γ = 0.60, q = 0.120 × 4 = 0.480 ksf. γ term = 0.5 × 0.120 × 8 × 30.21 × 0.60 = 8.70 ksf. 2 tanφ (1 − sinφ)² = 2 × 0.6249 × (1 − 0.5299)² = 0.2762.
  - Option off (default): d_q = 1.000; q term = 0.480 × 23.18 × 1.625 = 18.08 ksf; q_n = 26.78 ksf; q_allow = 8.93 ksf.
  - Option on, tool (Vesić, unchanged): k = Df/B = 0.5; d_q = 1 + 0.2762 × 0.5 = 1.138; d_c = 1.144 (no effect, c = 0); q term = 20.57 ksf; q_n = 29.27 ksf; q_allow = 9.76 ksf.
  - For comparison only, 10th Ed. Eq. 10.6.3.1.2a-10 (not implemented): arctan(0.5) = 0.4636 rad; d_q = 1 + 0.2762 × 0.4636 = 1.128 (≤ 1.4); q term = 20.39 ksf; q_n = 29.09 ksf; q_allow = 9.70 ksf (0.6 % below the tool's "On").
- **How verified:**
  - `node tests/check-syntax.mjs "Spread Footing.html"`: all scripts pass.
  - `node tests/compare.mjs --tool page --file "Spread Footing.html"`: page.text and page.storage identical (the changed strings are not on the default visible page).
  - Headless, main vs branch: B = L = 8, Df = 4, φ = 32°, c = 0, pedestals moved to the centre, depth factors Off and On, `recalc()`: governing `R.govBear.cap` (d_q, d_c, terms, q_ult, q_allow) identical; the page text differs only in the six strings above.
- **Other copies:** none.
- **Needs engineer:**
  1. Depth factor when the option is On: keep Vesić (building practice, ASD FS), switch to 10th Ed. Eq. 10.6.3.1.2a-10 (arctan(Df/B) always, d_q ≤ 1.4, no d_c), or add a third choice. Projects saved before the option existed open with it On (Vesić), so changing what `on` means would change their results; a new option value would avoid that.
  2. 10th Ed. C10.6.3.1.2a: Eq. 10.6.3.1.2a-10 is verified for φf 32°–42° and Df/B 1–8. The check case (Df/B = 0.5) and most building footings fall below that range.
  3. Inclination exponent: 10th Ed. Eq. 10.6.3.1.2a-9 writes n with the footing B and L; the tool uses the effective B′/L′ (an earlier deliberate change). Not changed here.

## 2026-10-20 — PR: claude/aashto10-sf-direct (SFAD: AASHTO load factors on the tool's own self-weight, EV and surcharge for an imported AASHTO case; engineer direction 2026-10-20 "accuracy"; PR link added after merge)

### SFAD. Direct factored mode, imported AASHTO case: footing / pedestal self-weight, EV and surcharge at that case's AASHTO factors   [calc change] [direct mode with an imported case only]
- **Problem:** in "Direct factored" mode the tool adds the footing and pedestal self-weight, the soil over the footing (EV) and the dead and live surcharge at its ASCE 7-16 bracket, 1.2 (and 0.9 in a second "min" row), even when the direct set is an AASHTO case imported from Bridge Substructure Loading or the abutment calculator (foundationLoads hand-off, HANDOFF.md §4.6). The case itself was built with AASHTO factors, so the added weights were factored on a different basis.
- **Provision:** AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), Table 3.4.1-1 (permanent loads γp in Strength; 1.00 in Extreme Event I / II and Service) and Table 3.4.1-2 (γp: DC 1.25 / 0.90; EV, retaining walls and abutments, 1.35 / 1.00; ES 1.50 / 0.75); C3.4.1.
- **Rule (new function `sfAashtoDirect()`, placed before `/* ================= combination generation (ASCE 7-16) ================= */`):**
  - Applies only in Direct mode, when `state.bxSrc.foundationLoads` (the import record) exists, its limit state is Strength, Extreme Event or Service, and the imported pedestal still holds exactly the imported set (`applied`, tolerance 1e-6). A manual edit of that set, a manual direct set, or the by-load-type mode keep the ASCE 7 bracket (unchanged).
  - **Strength:** "max or min as the case was built". The DC, EV and ES factors are read from the case's combination text (SubLoads `1.25 DC + 1.50 DW + 1.35 EV + …`; abutment `1.25·DC + … + 1.35·EV + …`). Footing and pedestal self-weight take the case's γDC; EV takes the case's γEV, or the DC side when the case has no EV term (max 1.35, min 1.00); the dead surcharge takes the case's γES, or the DC side (max 1.50, min 0.75). One row.
  - **Extreme Event and Service:** 1.00 for all. One row.
  - **Live surcharge:** the case's live-load factor (its `LL` / `(LL,BR,LS)` / `(BR,LS)` term), 0 when the case has no live load (e.g. Strength III). Before: the dead factor 1.2 / 0.9.
  - **Ambiguous (checked both, reported):** an import record without the combination text (imported before this change) has no DC factor: both γp max (1.25 / 1.35 / 1.50) and γp min (0.90 / 1.00 / 0.75) are run, each with the limit state's Table 3.4.1-1 live-load factor (γEQ taken as 1.00 for Extreme Event I) and with no live surcharge. Re-importing the case removes the ambiguity.
- **Where:**
  - `computeAll()`: `const AD=directMode?sfAashtoDirect():null;` after `const directMode=…`; in `if(directMode){`, `if(AD){ combosASD = AD.sets → {direct, dead, ev, es, ls, aashto} …; combosLRFD = same }` else the old 1.2 / 0.9 rows; `aashtoDirect:AD` in the returned R.
  - `resultant(f)`: `fEV`, `fES` (EV and dead surcharge) and `fL` (live surcharge) from `f.ev` / `f.es` / `f.ls` when given, else as before (dead factor in direct mode). The resultant breakdown already prints factor × magnitude for each action (§6).
  - `netResultant(f)` (Phase 2 free body): `fEVsw`, `fESsw`, `fLsur` the same way.
  - Import (`apply`): the record also stores `combination` (new optional field of `state.bxSrc.foundationLoads`; older records have none and are handled as above). The dialog warning about the 1.2 bracket now states the AASHTO factors.
  - Text: Loads tab Direct-mode note; Tab 2 §2.1 warn box; Bearing tab note (lists the factors used); new `sfEsc()` for the case name.
- **Before / after code:** see the diff below.
- **Check case** (built-in footing, Direct mode, pedestal 1 direct set P = 150 kip, Vx = 12 kip, My = 60 kip-ft; dead surcharge 200 psf, live surcharge 250 psf). Unfactored: W_f = 30.000, EV = 13.590, F_D,sur = 15.100, F_L,sur = 18.875, pedestal SW 0.675 + 0.675 kip.
  - Before (any import): ΣP = 150 + 1.2 · (30.000 + 13.590 + 15.100 + 18.875 + 1.350) = 150 + 1.2 · 78.915 = **244.70 kip**; min row 150 + 0.9 · 78.915 = **221.02 kip**.
  - Strength I built with γp max (`1.25·DC + 1.50·DW + 1.35·EV + 1.50·EH + 1.75·(LL,BR,LS)`): ΣP = 150 + 1.25 · 30.000 + 1.35 · 13.590 + 1.50 · 15.100 + 1.75 · 18.875 + 1.25 · 1.350 = 150 + 37.500 + 18.347 + 22.650 + 33.031 + 1.688 = **263.22 kip** (tool 263.215, one row).
  - Strength I built with γp min (`0.90·DC + 0.65·DW + 1.00·EV + 1.50·EH + 1.75·(BR,LS), LL reaction off`): 150 + 27.000 + 13.590 + 0.75 · 15.100 + 33.031 + 1.215 = **236.16 kip** (tool 236.161).
  - SubLoads Strength V (`1.25 DC + 1.50 DW + 1.35 EV + 1.35 LL + IM + …`): 150 + 37.500 + 18.347 + 22.650 + 1.35 · 18.875 + 1.688 = **255.67 kip** (tool 255.665).
  - Extreme Event I (`1.00·DC + … + 0.50·(LL,BR,LS) + 1.00·EQ`): 150 + 30.000 + 13.590 + 15.100 + 0.50 · 18.875 + 1.350 = **219.48 kip** (tool 219.478).
  - Old record, Strength I, no combination: four rows 263.22 / 230.18 / 236.16 / 203.13 kip (γp max / min × live surcharge 1.75 / 0).
  - Imported set edited by hand afterwards: 1.2 / 0.9 rows as before (identical to origin/main).
  - The Phase 2 net resultant (`netResultant`) carries the same totals (263.215, 236.161, 255.665, 219.478 kip).
- **End to end:** Bridge Substructure Loading (built-in project, Pier 1, top of footing) → Send foundation loads → Spread Footing → Pull → Extreme Event I case → Import: the record stores `combination: "1.00 DC + 1.00 DW + 1.00 EV + FR + WA (design flood)"`; the footing runs one row "Direct Extreme Event I (AASHTO, permanent loads 1.00)", ΣP = 1815.76 kip; no page error.
- **Unchanged:** by-load-type mode (ASCE 7-16 sweeps); Direct mode without an import record or after a manual edit; buoyancy (1.0). Built-in project: page text and storage identical to origin/main (`tests/compare.mjs --tool page`).
- **Saved data (§5):** no key renamed; one new optional field `bxSrc.foundationLoads.combination`, written at import. Older records without it are read as described (both brackets).
- **How verified:** `node tests/check-syntax.mjs "Spread Footing.html"`: pass. Headless Chromium (tests/lib.mjs), origin/main `cca06b1` vs branch, eight Direct-mode scenarios above (`computeAll` via `recalc`, every ASD / LRFD row's ΣP and M_y, the factor of every action in the resultant breakdown, Phase 2 `P2`); the SubLoads → Spread Footing hand-off in one browser context. Plotly is not served by the test kit (page error "Plotly is not defined" on both sides; plots only).
- **Other copies:** none.
- **Open items (engineer):**
  - Service cases are not importable in this tool (factored cases only, unchanged), so the Service rule (1.00) is implemented but unreachable today.
  - A Strength case whose combination mixes sides (SubLoads "M_t max" is `0.90 DC + 0.65 DW + 1.35 EV …`) gives the footing self-weight 0.90 and the soil 1.35, as the case was built; the dead surcharge (not in a SubLoads pier case) follows the DC side (0.75 here).
  - A SubLoads construction-stage case names LS without its factor, so the live surcharge gets 0 for that case.
  - Abutment-calculator cases are at the bottom of the footing, which this tool refuses (unchanged), so only SubLoads top-of-footing cases reach this path in practice.

Diff (`Spread Footing.html`, `git diff -U0` against origin/main `cca06b1`):

```diff
diff --git a/Spread Footing.html b/Spread Footing.html
index 81fdd1e..352c5eb 100644
--- a/Spread Footing.html	
+++ b/Spread Footing.html	
@@ -729 +729 @@ function refreshVis(){
-  ?'<b>Direct factored mode.</b> Enter one already-factored (LRFD/strength) load set per pedestal. The combination engine is bypassed \u2014 a single "Direct LRFD" envelope drives all checks. Footing self-weight, pedestal self-weight, and EV are still auto-computed and added, bracketed per ASCE 7-16 (factor 1.2 where they add to demand; 0.9 where they resist, i.e. uplift/overturning/sliding). Bearing is checked conservatively (factored loads vs allowable bearing \u2014 a service quantity). Stability results are indicative only, since a single envelope is not a true combination-by-combination sweep.'
+  ?'<b>Direct factored mode.</b> Enter one already-factored (LRFD/strength) load set per pedestal. The combination engine is bypassed \u2014 a single "Direct LRFD" envelope drives all checks. Footing self-weight, pedestal self-weight, and EV are still auto-computed and added, bracketed per ASCE 7-16 (factor 1.2 where they add to demand; 0.9 where they resist, i.e. uplift/overturning/sliding). A case imported from the abutment calculator or Bridge Substructure Loading uses that case\'s AASHTO LRFD 10th Ed. factors instead (Strength γp as built, Extreme Event 1.00). Bearing is checked conservatively (factored loads vs allowable bearing \u2014 a service quantity). Stability results are indicative only, since a single envelope is not a true combination-by-combination sweep.'
@@ -912,0 +913,31 @@ function sfdInputTabMarks(){
+/* SFAD (2026-10-20): "Direct factored" mode with an imported AASHTO case (foundationLoads hand-off from the abutment calculator or
+   Bridge Substructure Loading; record state.bxSrc.foundationLoads). The footing and pedestal self-weight (DC), the soil over the footing
+   (EV), the dead surcharge (ES) and the live surcharge take that case's AASHTO LRFD 10th Ed. factors (Tables 3.4.1-1, 3.4.1-2) instead
+   of this tool's ASCE 7-16 bracket 1.2 / 0.9:
+   - Strength: γp max or min as the case was built: the DC, EV and ES factors are read from the case's combination text (record field
+     "combination", stored at import since SFAD); a class not named there follows the case's DC side (max: DC 1.25, EV 1.35, ES 1.50;
+     min: DC 0.90, EV 1.00, ES 0.75). Without a DC factor (older import record) both sides are run.
+   - Extreme Event and Service: 1.00.
+   - Live surcharge: the case's live-load factor (its LL / BR / LS term; 0 when the case has none). Without a combination record:
+     the limit state's Table 3.4.1-1 live-load factor (γEQ taken as 1.00 for Extreme Event I) and 0, both run.
+   Used only while the imported pedestal still holds exactly the imported set; after a manual edit the ASCE 7 bracket applies again. */
+function sfEsc(x){ return String(x==null?'':x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]); }   // SFAD
+function sfAashtoDirect(){
+ const s=state.bxSrc&&state.bxSrc.foundationLoads; if(!s||!s.applied||typeof s.applied!=='object') return null;
+ const ls=String(s.limitState||''), kind=/^strength/i.test(ls)?'str':/^extreme/i.test(ls)?'ee':/^service/i.test(ls)?'svc':null; if(!kind) return null;
+ const p=(state.peds||[])[s.pedIndex]; if(!p) return null;
+ const d=p.direct||{}; if(['P','Vx','Vy','Mx','My'].some(k=>!(Math.abs(num(d[k])-num(s.applied[k]))<=1e-6))) return null;
+ const cmb=(typeof s.combination==='string'&&s.combination.trim())?s.combination:null;
+ const fac=re=>{ if(!cmb) return null; const m=cmb.match(re); return m?parseFloat(m[1]):null; };
+ const gDC=fac(/(\d+(?:\.\d+)?)\s*[· ]\s*DC\b/), gEV=fac(/(\d+(?:\.\d+)?)\s*[· ]\s*EV\b/), gES=fac(/(\d+(?:\.\d+)?)\s*[· ]\s*ES\b/);
+ const gLL=fac(/(\d+(?:\.\d+)?)\s*[· ]\s*(?:LL\b|\((?:LL|BR|LS)\b)/);
+ const base=ls.toLowerCase().replace(/\s*\(.*$/,'').trim(), LLT={'strength i':1.75,'strength iii':0,'strength v':1.35,'extreme event i':1.0,'extreme event ii':0.5,'service i':1.0};
+ const lsSets=cmb?[gLL!=null?gLL:0]:((LLT[base]||0)>0?[LLT[base],0]:[0]);
+ const ref='AASHTO LRFD 10th Ed. Tables 3.4.1-1, 3.4.1-2; imported case "'+(s.caseName||'')+'"'+(cmb?'':' (no combination record: bracketed)');
+ const sets=[];
+ const add=(tag,dc,ev,es)=>lsSets.forEach((l,i)=>sets.push({tag:tag+(lsSets.length>1?(i?', no live surcharge':', live surcharge '+l.toFixed(2)):''),dc,ev,es,ls:l,ref}));
+ if(kind!=='str') add('permanent loads 1.00',1,1,1);
+ else if(gDC!=null){ const mx=gDC>1+1e-9; add('γDC '+gDC.toFixed(2)+' as in the case',gDC,gEV!=null?gEV:(mx?1.35:1.00),gES!=null?gES:(mx?1.50:0.75)); }
+ else { add('γp max',1.25,1.35,1.50); add('γp min',0.90,1.00,0.75); }
+ return {ls,kind,caseName:s.caseName||'',combination:cmb,gDC,gEV,gES,gLL,sets};
+}
@@ -1147,0 +1179 @@ function computeAll(){
+ const AD=directMode?sfAashtoDirect():null;   // SFAD: AASHTO factors for an imported AASHTO case (null: ASCE 7 1.2 / 0.9 bracket)
@@ -1159,0 +1192,4 @@ function computeAll(){
+  if(AD){   /* SFAD: an imported AASHTO case: footing / pedestal SW (DC), EV, dead surcharge (ES) and live surcharge at that case's factors */
+   combosASD=AD.sets.map(st=>({name:'Direct '+AD.ls+' (AASHTO, '+st.tag+')',f:{direct:true,dead:st.dc,ev:st.ev,es:st.es,ls:st.ls,aashto:true},ref:st.ref}));
+   combosLRFD=combosASD.map(c=>({name:c.name,f:c.f,ref:c.ref}));
+  }else{
@@ -1163,0 +1200 @@ function computeAll(){
+  }
@@ -1172 +1209,2 @@ function computeAll(){
-  const fL=f.direct?(f.dead||1):(f.L||0); // live factor; in direct mode surcharge rides the single envelope
+  const fL=f.direct?(f.ls!=null?f.ls:(f.dead||1)):(f.L||0); // live factor; in direct mode surcharge rides the single envelope (SFAD: an AASHTO case's own live factor)
+  const fEV=(f.direct&&f.ev!=null)?f.ev:fD, fES=(f.direct&&f.es!=null)?f.es:fD;   // SFAD: AASHTO γEV / γES of the imported case; otherwise the dead factor
@@ -1174 +1212 @@ function computeAll(){
-  if(EV>0){P+=fD*EV;Mx+=fD*EV*yev;My+=fD*EV*xev;verts.push({w:fD*EV,x:xev,y:yev,src:'EV',f:fD,mag:EV});}
+  if(EV>0){P+=fEV*EV;Mx+=fEV*EV*yev;My+=fEV*EV*xev;verts.push({w:fEV*EV,x:xev,y:yev,src:'EV',f:fEV,mag:EV});}
@@ -1176 +1214 @@ function computeAll(){
-  if(surD>0){P+=fD*surD;Mx+=fD*surD*yev;My+=fD*surD*xev;verts.push({w:fD*surD,x:xev,y:yev,src:'Dead surcharge',f:fD,mag:surD});}
+  if(surD>0){P+=fES*surD;Mx+=fES*surD*yev;My+=fES*surD*xev;verts.push({w:fES*surD,x:xev,y:yev,src:'Dead surcharge',f:fES,mag:surD});}
@@ -1317 +1355 @@ function computeAll(){
-  mu,Kp,pf,PpX,PpY,rig,FSb,directMode,loadMode:state.loadMode};
+  mu,Kp,pf,PpX,PpY,rig,FSb,directMode,aashtoDirect:AD,loadMode:state.loadMode};
@@ -1516 +1554 @@ function renderSchematic(){
- if(R.directMode)ul.appendChild(el('p','note','<b>Direct factored load mode is active.</b> Loads were entered as a single already-factored (LRFD) envelope per pedestal; the ASCE 7-16 combination sweep was bypassed. Self-weight/EV are auto-added with 1.2 (demand) / 0.9 (resisting) dead brackets. Bearing is checked conservatively against allowable bearing, and overturning/sliding/flotation are indicative (single envelope, not a full combination evaluation). The engineer is responsible for confirming the entered factored loads envelope the governing code combinations.'));
+ if(R.directMode)ul.appendChild(el('p','note','<b>Direct factored load mode is active.</b> Loads were entered as a single already-factored (LRFD) envelope per pedestal; the ASCE 7-16 combination sweep was bypassed. '+(R.aashtoDirect?'Imported AASHTO case "'+sfEsc(R.aashtoDirect.caseName)+'" ('+sfEsc(R.aashtoDirect.ls)+'): self-weight, EV and surcharge are added at its AASHTO LRFD 10th Ed. factors ('+R.aashtoDirect.sets.map(st=>'DC '+st.dc.toFixed(2)+', EV '+st.ev.toFixed(2)+', ES '+st.es.toFixed(2)+', LS '+st.ls.toFixed(2)).join('; ')+'; Tables 3.4.1-1, 3.4.1-2).':'Self-weight/EV are auto-added with 1.2 (demand) / 0.9 (resisting) dead brackets.')+' Bearing is checked conservatively against allowable bearing, and overturning/sliding/flotation are indicative (single envelope, not a full combination evaluation). The engineer is responsible for confirming the entered factored loads envelope the governing code combinations.'));
@@ -1670 +1708 @@ function renderCombos(){
-  intro.appendChild(el('div','warnbox','<b>Direct factored (LRFD) mode.</b> A single user-entered factored envelope drives all checks; the ASCE 7-16 combination sweep is bypassed. Footing/pedestal self-weight and EV are auto-added and bracketed: factor 1.2 where they increase demand (bearing, footing/pedestal design); factor 0.9 in the minimum-dead case used for uplift/overturning/sliding. Bearing DCR is computed conservatively by checking the factored envelope against the allowable bearing (a service-level quantity). Stability results are <b>indicative only</b> \u2014 a single envelope is not a true combination-by-combination evaluation. For full dual-basis (service bearing/stability + strength design) results, switch to by-load-type input.'));
+  intro.appendChild(el('div','warnbox','<b>Direct factored (LRFD) mode.</b> A single user-entered factored envelope drives all checks; the ASCE 7-16 combination sweep is bypassed. Footing/pedestal self-weight and EV are auto-added and bracketed: factor 1.2 where they increase demand (bearing, footing/pedestal design); factor 0.9 in the minimum-dead case used for uplift/overturning/sliding. Bearing DCR is computed conservatively by checking the factored envelope against the allowable bearing (a service-level quantity). Stability results are <b>indicative only</b> \u2014 a single envelope is not a true combination-by-combination evaluation. For full dual-basis (service bearing/stability + strength design) results, switch to by-load-type input.'+(R.aashtoDirect?' <b>Imported AASHTO case "'+sfEsc(R.aashtoDirect.caseName)+'" ('+sfEsc(R.aashtoDirect.ls)+'):</b> the 1.2 / 0.9 bracket is replaced by the case\'s AASHTO LRFD 10th Ed. factors (Tables 3.4.1-1, 3.4.1-2) on the footing and pedestal self-weight (DC), EV, dead surcharge (ES) and live surcharge: '+R.aashtoDirect.sets.map(st=>st.tag+': DC '+st.dc.toFixed(2)+', EV '+st.ev.toFixed(2)+', ES '+st.es.toFixed(2)+', LS '+st.ls.toFixed(2)).join('; ')+' (see the resultant breakdown below for each factor × magnitude).':'')));   // SFAD
@@ -2970 +3008,2 @@ function computePhase2(R){
-  const swF=fDsw*Wf, evF=fDsw*EV, buF=U;      // kips: down, down, up
+  const fEVsw=(f.direct&&f.ev!=null)?f.ev:fDsw, fESsw=(f.direct&&f.es!=null)?f.es:fDsw;   // SFAD
+  const swF=fDsw*Wf, evF=fEVsw*EV, buF=U;      // kips: down, down, up
@@ -2978,2 +3017,2 @@ function computePhase2(R){
-  const fLsur=f.direct?(f.dead||1):(f.L||0);
-  const surF=fDsw*(R.surD||0)+fLsur*(R.surL||0);
+  const fLsur=f.direct?(f.ls!=null?f.ls:(f.dead||1)):(f.L||0);
+  const surF=fESsw*(R.surD||0)+fLsur*(R.surL||0);
@@ -5578 +5617 @@ buildManualTab();
-    r.warn.push('Direct mode adds the footing and pedestal self-weight and the soil over the footing at 1.2 (0.9 where they resist), the ASCE 7-16 bracket of this tool — not AASHTO γp. Bearing is checked with factored loads against the allowable bearing.');
+    r.warn.push('Direct mode adds the footing and pedestal self-weight, the soil over the footing and the surcharge at this case\'s AASHTO LRFD 10th Ed. factors (Tables 3.4.1-1, 3.4.1-2): Strength γp max or min as the case was built, Extreme Event 1.00; live surcharge at the case\'s live-load factor. A manual edit of the imported set returns to the ASCE 7-16 bracket 1.2 / 0.9. Bearing is checked with factored loads against the allowable bearing.');   // SFAD
@@ -5592 +5631 @@ buildManualTab();
-      element:p.element||null,location:p.location||'',caseName:c.name,limitState:c.limitState,
+      element:p.element||null,location:p.location||'',caseName:c.name,limitState:c.limitState,combination:c.combination||'',
```


## 2026-10-21 — PR: claude/abut-handoffs-iab — Integral / semi-integral hand-offs: integral per-pile foundation loads, R_n / φ into the integral inputs, type-aware SubLoads import (AXI) (PR link added after merge)

Cross-tool connection in one PR (CLAUDE.md §7 exception): abutment_calculator.html (sender of foundationLoads, receiver of pileResults and abutmentLoads), Pile Designer.html and Spread Footing.html (receivers of foundationLoads), HANDOFF.md §4.5, §4.6, §4.10. Every code site is tagged `AXI`. **No calculation changes in any tool:** the abutment's `computeAll` is identical to origin/main (`c729c12`) for conventional, semi-integral and integral projects (with seismic, on piles); the receivers change only what they accept.

### AXI-SF. foundationLoads from an integral abutment: refused   [hand-off; no calculation change]
- **Where:** foundation-load receiver `check()` (anchor `if(el.type==='integralAbutment' || el.abutmentType==='integral'`), `BAD_LEVEL` (`pileHead`).
- **Before:** an integral abutment's payload (conventional cantilever cases at the bottom of the footing) was refused only by its level; a payload at an unknown level could be confirmed by the user. **After:** a payload with `element.type "integralAbutment"`, `element.abutmentType "integral"`, `reference.level "pileHead"`, `reference.perPile` or `perPile` is refused: "This hand-off is from an integral abutment: its loads are per-pile axial loads at the head of one pile of a single pile row, cast with the superstructure (no footing). Spread Footing cannot design it; use Pile Designer (integral-abutment mode)." `pileHead` added to the refused levels.
- **Check:** the abutment's integral MassDOT payload: `bxFl.check` returns that error; conventional payloads: unchanged (only `element.abutmentType` added by the sender, ignored here).
- **Other copies:** none.

Diff (`Spread Footing.html`, `git diff -U0` against origin/main `c729c12`):

```diff
diff --git a/Spread Footing.html b/Spread Footing.html
index 352c5eb..23de227 100644
--- a/Spread Footing.html	
+++ b/Spread Footing.html	
@@ -5529 +5529 @@ buildManualTab();
-  var OK_LEVEL={topOfFooting:1,baseOfWall:1,baseOfColumn:1}, BAD_LEVEL={bottomOfFooting:'the bottom of the footing',bottomOfPileCap:'the bottom of the pile cap',pointOfFixity:'a pile or shaft point of fixity'};
+  var OK_LEVEL={topOfFooting:1,baseOfWall:1,baseOfColumn:1}, BAD_LEVEL={bottomOfFooting:'the bottom of the footing',bottomOfPileCap:'the bottom of the pile cap',pointOfFixity:'a pile or shaft point of fixity',pileHead:'the head of one pile (per-pile loads)'};   // AXI: pileHead
@@ -5542,0 +5543,4 @@ buildManualTab();
+    /* AXI (2026-10-21): an integral abutment has no footing; its payload carries per-pile loads (HANDOFF.md §4.6) */
+    var el=p.element||{};
+    if(el.type==='integralAbutment' || el.abutmentType==='integral' || (p.reference && (p.reference.level==='pileHead' || p.reference.perPile)) || p.perPile){
+      out.err.push('This hand-off is from an integral abutment: its loads are per-pile axial loads at the head of one pile of a single pile row, cast with the superstructure (no footing). Spread Footing cannot design it; use Pile Designer (integral-abutment mode).'); return out; }
```


## 2026-11-01 — PR: claude/sf-rebar-tab — Reinforcement input tab (presentation only, no calculation change) (PR link added after merge)

Line numbers are approximate; search for the anchor text.

### RB1. Footing reinforcement gets its own "Reinforcement" input tab   [UI only]
- **Engineer request (2026-11-01):** the footing reinforcement input existed but was hidden: section "Footing Reinforcement (Phase 2)" (`details#sec-rebar`, collapsed) placed on the Materials input tab.
- **Before:** `SFD_IN_TABS` had no reinforcement tab; `SFD_IN_SEC` mapped `'sec-rebar':'mat'`; `<details class="sec" id="sec-rebar">` (closed) with summary "Footing Reinforcement (Phase 2)"; the table had Mat / Bar # / Spacing only.
- **After:**
  - `SFD_IN_TABS` gains `['rebar','Reinforcement']` after Materials; `SFD_IN_SEC` maps `'sec-rebar':'rebar'`; the section is `open` and titled "Footing Reinforcement".
  - Three display columns next to each mat: A_b (from `BAR_AREA`), A_s = A_b·12/s worked out (from `barAreaPerFt`, the function the design uses) and "s vs s_max" (`P2.desX/desY.sMax`, `spcBotOK` / `spcTopOK`, `asMinTopReq`: the design's own values; s_max = min(3h, 18 in), ACI 318-19 7.7.2.3 / 13.3.4). A note under the table links to Footing Design 5.2 / 5.3 where the bars are used. Filled by the new `sfdRebarInfo()`, called at the end of `recalc()`.
  - Footing Design 5.1 gets a line "Bars set on the Reinforcement tab (inputs) → bottom x #8 @ 9.00 in, …" (`a.sfdInA`); clicking it opens the Reinforcement input tab and flashes the section (`sfdGotoInput`). Printed as plain text.
- **Unchanged:** every `data-path` (`freinf.botX.size` … `freinf.topY.spc`), the saved state and project JSON, `sfd_inputTab_v1` (a saved value `'mat'` still opens Materials; `'rebar'` is a new allowed value of that per-browser UI key).
- **Check case (default project):** bottom x #8 @ 9 in → A_b = 0.79 in², A_s = 0.79·12/9 = 1.053 in²/ft, 9.00 ≤ 18.00 ✓ (h = 30 in → 3h = 90, s_max = 18 in). Setting s = 20 in shows A_s = 0.474 and "20.00 > 18.00 NG", the same NG the Footing Design card shows.
- **How verified:** headless Chromium, origin/main vs the branch on 7 projects (default, direct mode, water table + AASHTO eccentricity + 3 pedestals + top mats, direct q_a net + override V_c, single pedestal with moments, direct mode with moments, fatal input): `R`, `P2`, dashboard, warnings, self-consistency, state and `sfd_auto` identical; the result tab text differs only in the new 5.1 link line; 0 console errors. `node tests/check-syntax.mjs "Spread Footing.html"` passes.
- **Other copies:** none.

Diff (`git diff -U0` against origin/main):

```diff
diff --git a/Spread Footing.html b/Spread Footing.html
index 23de227..ed56703 100644
--- a/Spread Footing.html	
+++ b/Spread Footing.html	
@@ -332,2 +332,2 @@ a.wkA:hover{text-decoration:underline}
-<details class="sec" id="sec-rebar">
-<summary>Footing Reinforcement (Phase 2)</summary>
+<details class="sec" id="sec-rebar" open>
+<summary>Footing Reinforcement</summary>
@@ -336,5 +336,5 @@ a.wkA:hover{text-decoration:underline}
- <table class="tbl" style="font-size:11px"><tr><th>Mat</th><th>Bar #</th><th>Spacing (in)</th></tr>
- <tr><td>Bottom, x-bars</td><td><select data-path="freinf.botX.size" class="barsel"></select></td><td><input type="number" step="0.5" data-path="freinf.botX.spc" data-num style="width:60px"></td></tr>
- <tr><td>Bottom, y-bars</td><td><select data-path="freinf.botY.size" class="barsel"></select></td><td><input type="number" step="0.5" data-path="freinf.botY.spc" data-num style="width:60px"></td></tr>
- <tr><td>Top, x-bars</td><td><select data-path="freinf.topX.size" class="barsel"></select></td><td><input type="number" step="0.5" data-path="freinf.topX.spc" data-num style="width:60px"></td></tr>
- <tr><td>Top, y-bars</td><td><select data-path="freinf.topY.size" class="barsel"></select></td><td><input type="number" step="0.5" data-path="freinf.topY.spc" data-num style="width:60px"></td></tr>
+ <table class="tbl sfdRbTbl" style="font-size:11px"><tr><th>Mat</th><th>Bar #</th><th>Spacing s (in)</th><th>A<sub>b</sub> (in&sup2;)</th><th>A<sub>s</sub> = A<sub>b</sub>&middot;12/s (in&sup2;/ft)</th><th>s vs s<sub>max</sub> (in)</th></tr>
+ <tr><td>Bottom, x-bars</td><td><select data-path="freinf.botX.size" class="barsel"></select></td><td><input type="number" step="0.5" data-path="freinf.botX.spc" data-num style="width:60px"></td><td class="sfdRbAb" data-mat="botX"></td><td class="sfdRbAs" data-mat="botX"></td><td class="sfdRbS" data-mat="botX"></td></tr>
+ <tr><td>Bottom, y-bars</td><td><select data-path="freinf.botY.size" class="barsel"></select></td><td><input type="number" step="0.5" data-path="freinf.botY.spc" data-num style="width:60px"></td><td class="sfdRbAb" data-mat="botY"></td><td class="sfdRbAs" data-mat="botY"></td><td class="sfdRbS" data-mat="botY"></td></tr>
+ <tr><td>Top, x-bars</td><td><select data-path="freinf.topX.size" class="barsel"></select></td><td><input type="number" step="0.5" data-path="freinf.topX.spc" data-num style="width:60px"></td><td class="sfdRbAb" data-mat="topX"></td><td class="sfdRbAs" data-mat="topX"></td><td class="sfdRbS" data-mat="topX"></td></tr>
+ <tr><td>Top, y-bars</td><td><select data-path="freinf.topY.size" class="barsel"></select></td><td><input type="number" step="0.5" data-path="freinf.topY.spc" data-num style="width:60px"></td><td class="sfdRbAb" data-mat="topY"></td><td class="sfdRbAs" data-mat="topY"></td><td class="sfdRbS" data-mat="topY"></td></tr>
@@ -341,0 +342 @@ a.wkA:hover{text-decoration:underline}
+ <div class="note" id="sfdRbNote"></div>
@@ -828 +829 @@ const SFD_IN_TABS=[
- ['project','Project'],['geom','Geometry'],['mat','Materials'],['soil','Soil'],
+ ['project','Project'],['geom','Geometry'],['mat','Materials'],['rebar','Reinforcement'],['soil','Soil'],
@@ -831 +832 @@ const SFD_IN_SEC={
- 'sec-proj':'project','sec-geom':'geom','sec-mat':'mat','sec-rebar':'mat',
+ 'sec-proj':'project','sec-geom':'geom','sec-mat':'mat','sec-rebar':'rebar',
@@ -910,0 +912,35 @@ function sfdInputTabMarks(){
+/* Reinforcement input tab (display only): bar area A_b (BAR_AREA), A_s per ft = A_b*12/s
+   (barAreaPerFt, the value the footing design uses), and the spacing against s_max from the
+   footing design (P2.desX / desY .sMax = min(3h, 18 in), ACI 318-19 7.7.2.3 / 13.3.4).
+   Nothing is computed here that the design does not already compute. */
+function sfdRebarInfo(){
+ const fr=state.freinf;if(!fr||!document.querySelector('.sfdRbAb'))return;
+ const des={X:(P2&&P2.desX)||null,Y:(P2&&P2.desY)||null};
+ ['botX','botY','topX','topY'].forEach(k=>{
+  const m=fr[k]||{},sz=m.size,spc=num(m.spc),Ab=BAR_AREA[sz]||0,As=barAreaPerFt(sz,spc);
+  const q=c=>document.querySelector('.'+c+'[data-mat="'+k+'"]');
+  const dir=k.slice(-1),d=des[dir],top=(k.slice(0,3)==='top');
+  q('sfdRbAb').innerHTML=sz?Ab.toFixed(2):'\u2014';
+  q('sfdRbAs').innerHTML=(sz&&spc>0)?Ab.toFixed(2)+'&middot;12/'+f2(spc)+' = <b>'+As.toFixed(3)+'</b>':(sz?'\u2014 (s = 0)':'\u2014 (no mat)');
+  let sTxt='\u2014';
+  if(sz&&spc>0&&d){
+   const chk=top?(d.asMinTopReq):true;   /* top mat: s_max applies only where it is a flexural mat (as the design) */
+   const ok=top?d.spcTopOK:d.spcBotOK;
+   sTxt=chk?(f2(spc)+(ok?' \u2264 ':' &gt; ')+f2(d.sMax)+(ok?' \u2713':' <b style="color:#b71c1c">NG</b>'))
+          :(f2(spc)+' (s<sub>max</sub> '+f2(d.sMax)+' n/a: no hogging)');
+  }else if(sz&&spc>0)sTxt=f2(spc);
+  q('sfdRbS').innerHTML=sTxt;
+ });
+ const n=document.getElementById('sfdRbNote');
+ if(n)n.innerHTML='A<sub>b</sub> from the bar table (#3\u2013#11); A<sub>s</sub> per ft of width is the value used in the footing design. s<sub>max</sub> = min(3h, 18 in) (ACI 318-19 7.7.2.3 / 13.3.4); top mats are checked only where hogging makes them flexural mats.'+
+  ((P2&&P2.desX)?' Worked in: '+sfdLink('o-fd-x','x-bars',['tab-footdes','5.2 Longitudinal (x-direction)'])+' · '+sfdLink('o-fd-y','y-bars',['tab-footdes','5.3 Transverse (y-direction)']):'');
+}
+/* link from an output card to an input tab (Reinforcement): open the tab and flash the section */
+function sfdGotoInput(tab,secId){
+ sfdSetInTab(tab,true);
+ const sec=document.getElementById(secId);if(!sec)return;
+ if(sec.tagName==='DETAILS'&&!sec.open)sec.open=true;
+ setTimeout(()=>{sec.scrollIntoView({behavior:'smooth',block:'start'});
+  const s=sec.querySelector('summary')||sec;const old=s.style.background;s.style.background='#fff3cd';setTimeout(()=>{s.style.background=old;},1100);},60);
+}
+document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a.sfdInA');if(!a)return;e.preventDefault();sfdGotoInput(a.dataset.intab,a.dataset.insec);});
@@ -2807,0 +2844 @@ function recalc(){
+ sfdRebarInfo();   /* Reinforcement input tab: A_b, A_s per ft, s vs s_max (display only) */
@@ -3832,0 +3870 @@ function flexureSVG(des,dir){
+function sfdBarTxt(m){m=m||{};return (m.size&&num(m.spc)>0)?'#'+m.size+' @ '+f2(num(m.spc))+' in':'none';}
@@ -3849,0 +3888 @@ function renderFootingDesign(){
+ intro.appendChild(el('div','wkLink','<a class="wkA sfdInA" href="#sec-rebar" data-intab="rebar" data-insec="sec-rebar"><span class="wkScr">Bars set on the Reinforcement tab (inputs) \u2192 bottom x '+sfdBarTxt(state.freinf.botX)+', bottom y '+sfdBarTxt(state.freinf.botY)+', top x '+sfdBarTxt(state.freinf.topX)+', top y '+sfdBarTxt(state.freinf.topY)+'</span><span class="wkPrt">Bars (Reinforcement input): bottom x '+sfdBarTxt(state.freinf.botX)+', bottom y '+sfdBarTxt(state.freinf.botY)+', top x '+sfdBarTxt(state.freinf.topX)+', top y '+sfdBarTxt(state.freinf.topY)+'</span></a>'));   /* link to the Reinforcement input tab */
```


## 2026-11-01 — PR: claude/sf-load-offset — Load location on the pedestal: per-pedestal load offsets e_x, e_y (SFLO, calculation change) (PR link added after merge)

Line numbers are approximate; search for the anchor text. Every code site is tagged `SFLO`.

### SFLO. Loads may act off the pedestal centroid   [calculation change, CLAUDE.md §4]
- **Engineer request (2026-11-01):** "I want to be able to define the location of the load on the pedestal. It may not always be centered."
- **Input:** two new fields on each pedestal card, "Load offset e_x / e_y (from ped. centroid)", in **ft** (the units of the pedestal x, y, b_x, b_y). They are measured at the top of the pedestal and use the axes and signs of the "Axes & sign convention" note, which gets a new bullet. Saved as `peds[i].loadEx`, `peds[i].loadEy`. `newPed` sets them to 0, and `migrateState` sets them to 0 when they are missing, so older saves and imports are unchanged. The offset applies to P of every load type (D, L, Lr, S, Wx, Wy) and to the direct factored P. It does not apply to the pedestal self-weight, which acts at the centroid.
- **Where P·e enters (each path once):**
  1. **Stability / bearing resultant** (`computeAll` → `resultant(f)`, anchor `SFLO: P acts at the load point`). P is placed at the load point: vertex `x: p.x+p.lex, y: p.y+p.ley`, and `Mx += P·(p.y+p.ley)`, `My += P·(p.x+p.lex)`. The applied-moment sums `MaX`/`MaY` are unchanged. This is the place where pedestal loads are resolved to the footing centroid for bearing, eccentricity limits, sliding and overturning. Placing P at its real location gives the true lever arm about each overturning edge.
     - Before: `Mx+=ft*(Pp*p.y+mx+vy*coupleLever(p));My+=ft*(Pp*p.x+my+vx*coupleLever(p));` (same form in direct mode, without `ft`)
     - After: `Mx+=ft*(Pp*(p.y+p.ley)+mx+vy*coupleLever(p));My+=ft*(Pp*(p.x+p.lex)+my+vx*coupleLever(p));`
  2. **Structural (Phase 2) net resultant** (`computePhase2` → `netResultant(f)`, anchor `SFLO: a load applied at e_x, e_y`). The pedestal hands the load to the footing over its own footprint, so it delivers P at its centroid plus the interface moments P·e_y (about x, +Mx) and P·e_x (about y, +My). These are added to the applied moment of each load, at the footing base (`mx`, `my`: footing flexure, one-way shear, the pedestal's equivalent interface pressure, punching relief) and at the pedestal base (`mxPed`, `myPed`: pedestal biaxial P–M, punching moment transfer per ACI 318-19 8.4.4.2).
     - Before: `mxi+=ft*(mx+vy*(t+p.h)*hFac2); … mxp+=ft*(mx+vy*p.h*hFac2);`
     - After: `mxi+=ft*(mx+Pp*p.ley+vy*(t+p.h)*hFac2); … mxp+=ft*(mx+Pp*p.ley+vy*p.h*hFac2);` (and `my…+Pp*p.lex…`)
  - Both paths give the same footing-centroid resultant: Σ(P·x_load) = Σ(P·x_centroid) + Σ(P·e_x). This is checked for every LRFD combination: |ΔP|, |ΔMx|, |ΔMy| < 1e-9 between `R.lrfd[i].r` and `P2.combos[i].nr`, so nothing is counted twice.
- **Warning:** "Pedestal "…": the load point (e_x = …, e_y = … from its centroid) is outside the pedestal top …" when |e_x| > b_x/2 or |e_y| > b_y/2. The load is still applied at that point.
- **Shown (§6):**
  - The resultant breakdown lists P at the load point and adds a note "x + e_x = …".
  - Pedestal Design gets a worked block "Load offset on the pedestal": M_ux = M_x,app + V_y h + P_u,a e_y with values, for the combination that governs each axis.
  - The punching card adds a note with the P·e share of M_ux and M_uy.
  - The input echo gets an "e_x, e_y" column.
  - The plan schematic shows the load point (red dot, dashed leader and "load e = (…)" when offset). The elevation draws the P arrow at x + e_x. The 3D view draws the P arrow at the load point.
- **Governing provisions:** statics (resultant of a load at a point); ACI 318-19 8.4.4.2 (moment transfer by eccentricity of shear, unchanged method), 10.4.1 / 22.4 (pedestal axial with moment, unchanged method). No formula, factor or reference changed, only the load position.
- **Check case:** B = L = 8 ft, t = 2 ft, D_f = 4 ft, no soil cover, γ_c = 150 pcf. One 2 × 2 × 2 ft pedestal at the centre, D = 100 k, L = 50 k. Direct q_a = 4 ksf gross. e_x = 0 (before) vs 0.5 ft (after).
  - Service D + L: P = 150 + W_f 8·8·2·0.150 = 19.2 + W_ped 2·2·2·0.150 = 1.2 = **170.4 k** (both).
  - M_y = 150 × 0.5 = **75.0 k-ft** (before 0). e_x = 75.0 / 170.4 = **0.440 ft** (before 0) < B/6 = 1.333 ft, so full contact.
  - q = P/(BL) ± 6M_y/(L B²) = 2.6625 ± 6·75/(8·64) = 2.6625 ± 0.8789 → **q_max = 3.541, q_min = 1.784 ksf** (before 2.663 uniform). Bearing DCR = 3.541/4 = **0.885** (before 0.666).
  - Overturning about +x: M_r = 681.6 → 606.6 k-ft (150 k × 0.5 ft less lever); no overturning moment, FS = ∞ in both.
  - Pedestal, 1.2D + 1.6L: P_u,a = 120 + 80 = 200 k; M_uy = 200 × 0.5 = **100.0 k-ft** (before 0); P_u = 200 + 1.2·1.2 = 201.44 k (unchanged).
  - Footing flexure x at the pedestal face x = +1 ft: net structural pressure q = 201.44/64 + (100/341.33)·x (I_y = 8·8³/12 = 341.33 ft⁴). M = 8·[3.1475·∫₁⁴(x−1)dx + 0.29297·∫₁⁴x(x−1)dx] = 8·[3.1475·4.5 + 0.29297·13.5] = **144.95 k-ft** (before 8·14.164 = 113.31); DCR 0.160 → **0.204**. Flexure y: 113.31 (unchanged).
  - Punching v_u = 45.21 → **54.05 psi** (M_uy = 100 k-ft transferred), DCR 0.292 → 0.349.
- **How verified (headless Chromium, origin/main vs the branch):**
  - Old projects identical: 7 projects (default, direct, water table + AASHTO eccentricity + 3 pedestals, direct q_a net fail, single pedestal with moments, direct with moments, fatal): every existing value of `R` and `P2`, the dashboard, warnings and self-consistency are identical (new keys only: `peds[].lex/ley`, `pl.Pa/lex/ley/PeMx/PeMy`, `punch.detail` copies, `pedDes.govMx/govMy`).
  - A save made by origin/main, loaded on the branch: identical results, migrated to loadEx = loadEy = 0, 0 console errors.
  - Offset vs the same loads with P·e typed in as applied moments: footing flexure, one-way shear, punching, pedestal P–M points, ASD resultants, e, q_max and bearing DCR identical. Overturning differs by design: P sits at its real lever arm instead of a separate overturning couple.
  - Self-consistency checks pass with offsets.
  - Warning shown at e_x = 0.9 ft on a 1.5 ft pedestal, not at e_x = 0.75 ft.
  - `node tests/check-syntax.mjs "Spread Footing.html"` passes.
- **Other copies:** none. The hand-off receivers (memberReactions, foundationLoads) write loads only and leave the offsets as they are.

Diff (`git diff -U0` against origin/main):

```diff
diff --git a/Spread Footing.html b/Spread Footing.html
index ed56703..642e9e3 100644
--- a/Spread Footing.html	
+++ b/Spread Footing.html	
@@ -383,0 +384 @@ a.wkA:hover{text-decoration:underline}
+  &bull; <b>Load offset e<sub>x</sub>, e<sub>y</sub></b> (per pedestal): where the loads act on the pedestal top, measured from the pedestal centroid, same axes. P of every load type (and the direct factored P) acts there, so +P&middot;e<sub>x</sub> adds to M<sub>y</sub> and +P&middot;e<sub>y</sub> adds to M<sub>x</sub> for the footing and the pedestal. 0 = centred.
@@ -626 +627 @@ const BAR_SIZES=[0,3,4,5,6,7,8,9,10,11];
-function newPed(n){return {label:'Ped '+n,x:0,y:0,bx:1.5,by:1.5,h:2,
+function newPed(n){return {label:'Ped '+n,x:0,y:0,bx:1.5,by:1.5,h:2,loadEx:0,loadEy:0,
@@ -669,0 +671,2 @@ function migrateState(){
+  if(p.loadEx===undefined)p.loadEx=0;   /* SFLO: load offset on the pedestal (ft); older saves: centred */
+  if(p.loadEy===undefined)p.loadEy=0;
@@ -746,0 +750,5 @@ function buildPedCards(){
+  /* SFLO: point of application of the loads on the pedestal top, from the pedestal centroid
+     (same x / y axes and signs as the footing). Applies to P of every load type and to the
+     direct factored P; 0 = centred (older projects). */
+  b.appendChild(rowInput('Load offset e\u2093 (from ped. centroid)','peds.'+i+'.loadEx','num','ft',p.loadEx||0));
+  b.appendChild(rowInput('Load offset e\u1D67 (from ped. centroid)','peds.'+i+'.loadEy','num','ft',p.loadEy||0));
@@ -1171 +1179,2 @@ function computeAll(){
- const peds=state.peds.map(p=>({label:p.label,x:num(p.x),y:num(p.y),bx:Math.max(num(p.bx),0),by:Math.max(num(p.by),0),h:Math.max(num(p.h),0),loads:p.loads,direct:p.direct||{P:0,Vx:0,Vy:0,Mx:0,My:0}}));
+ const peds=state.peds.map(p=>({label:p.label,x:num(p.x),y:num(p.y),bx:Math.max(num(p.bx),0),by:Math.max(num(p.by),0),h:Math.max(num(p.h),0),loads:p.loads,direct:p.direct||{P:0,Vx:0,Vy:0,Mx:0,My:0},
+  lex:num(p.loadEx),ley:num(p.loadEy)}));   /* SFLO: load offset from the pedestal centroid (ft) */
@@ -1175 +1184,3 @@ function computeAll(){
-   W.push({lvl:'err',msg:'Pedestal "'+p.label+'": footprint extends beyond the footing edge.'});});
+   W.push({lvl:'err',msg:'Pedestal "'+p.label+'": footprint extends beyond the footing edge.'});
+  if(Math.abs(p.lex)>p.bx/2+1e-9||Math.abs(p.ley)>p.by/2+1e-9)   /* SFLO */
+   W.push({lvl:'warn',msg:'Pedestal "'+p.label+'": the load point (e\u2093 = '+f2(p.lex)+' ft, e\u1D67 = '+f2(p.ley)+' ft from its centroid) is outside the pedestal top ('+f2(p.bx)+' \u00d7 '+f2(p.by)+' ft, |e| \u2264 b/2). The load is still applied there; check the input and the bearing / bracket detail.'});});
@@ -1256 +1267,2 @@ function computeAll(){
-    if(Pp!==0){P+=Pp;verts.push({w:Pp,x:p.x,y:p.y,src:p.label+' (factored)',f:1,mag:Pp});}
+    /* SFLO: P acts at the load point (x + e_x, y + e_y) on the pedestal top: its lever about the footing centroid is p.x + e_x, p.y + e_y */
+    if(Pp!==0){P+=Pp;verts.push({w:Pp,x:p.x+p.lex,y:p.y+p.ley,src:p.label+' (factored)',f:1,mag:Pp});}
@@ -1258 +1270 @@ function computeAll(){
-    Mx+=(Pp*p.y+mx+vy*coupleLever(p));My+=(Pp*p.x+my+vx*coupleLever(p));
+    Mx+=(Pp*(p.y+p.ley)+mx+vy*coupleLever(p));My+=(Pp*(p.x+p.lex)+my+vx*coupleLever(p));
@@ -1263 +1275 @@ function computeAll(){
-    if(Pp!==0){P+=ft*Pp;verts.push({w:ft*Pp,x:p.x,y:p.y,src:p.label+' '+tp,f:ft,mag:Pp});}
+    if(Pp!==0){P+=ft*Pp;verts.push({w:ft*Pp,x:p.x+p.lex,y:p.y+p.ley,src:p.label+' '+tp,f:ft,mag:Pp});}   // SFLO: at the load point
@@ -1265 +1277 @@ function computeAll(){
-    Mx+=ft*(Pp*p.y+mx+vy*coupleLever(p));My+=ft*(Pp*p.x+my+vx*coupleLever(p));
+    Mx+=ft*(Pp*(p.y+p.ley)+mx+vy*coupleLever(p));My+=ft*(Pp*(p.x+p.lex)+my+vx*coupleLever(p));
@@ -1616,2 +1628,7 @@ function planSVG(){
- peds.forEach(p=>{s+='<text x="'+X(p.x)+'" y="'+(Y(p.y)+4)+'" text-anchor="middle" font-weight="bold">'+p.label+'</text>';
-  s+='<text x="'+X(p.x)+'" y="'+(Y(p.y)+16)+'" text-anchor="middle" font-size="9">('+f2(p.x)+', '+f2(p.y)+')</text>';});
+ /* SFLO: load point on each pedestal (x + e_x, y + e_y): red cross-hair; dashed leader from the centroid when offset */
+ peds.forEach(p=>{const lx=X(p.x+p.lex),ly=Y(p.y+p.ley),off=(Math.abs(p.lex)>1e-12||Math.abs(p.ley)>1e-12);
+  if(off)s+='<line x1="'+X(p.x)+'" y1="'+Y(p.y)+'" x2="'+lx+'" y2="'+ly+'" stroke="#b00" stroke-width="1" stroke-dasharray="2,2"/>';
+  s+='<circle cx="'+lx+'" cy="'+ly+'" r="3.2" fill="#b00" stroke="#fff" stroke-width="0.8"><title>'+sfEsc(p.label)+' load point'+(off?' (e\u2093 = '+f3(p.lex)+', e\u1D67 = '+f3(p.ley)+' ft)':' (centred)')+'</title></circle>';
+  if(off)s+='<text x="'+X(p.x)+'" y="'+(Y(p.y-p.by/2)+11)+'" text-anchor="middle" font-size="9" fill="#b00">load e = ('+f2(p.lex)+', '+f2(p.ley)+') ft</text>';});
+ peds.forEach(p=>{s+='<text x="'+X(p.x)+'" y="'+(Y(p.y)+15)+'" text-anchor="middle" font-weight="bold">'+p.label+'</text>';   /* SFLO: below the load-point dot */
+  s+='<text x="'+X(p.x)+'" y="'+(Y(p.y)+26)+'" text-anchor="middle" font-size="9">('+f2(p.x)+', '+f2(p.y)+')</text>';});
@@ -1675 +1692,2 @@ function sectSVG(){
-  s+='<line x1="'+X(p.x)+'" y1="'+(topY-arrowLen)+'" x2="'+X(p.x)+'" y2="'+(topY-3)+'" stroke="#c00" stroke-width="2.5" marker-end="url(#ar)"/>';
+  const lxp=X(p.x+p.lex);   // SFLO: arrow at the load point (offset e_x in this elevation)
+  s+='<line x1="'+lxp+'" y1="'+(topY-arrowLen)+'" x2="'+lxp+'" y2="'+(topY-3)+'" stroke="#c00" stroke-width="2.5" marker-end="url(#ar)"/>';
@@ -1681 +1699 @@ function sectSVG(){
-  if(Pdisp!==null&&Math.abs(Pdisp)>1e-9)s+='<text x="'+(X(p.x)+4)+'" y="'+(topY-arrowLen+4)+'" fill="#c00" font-size="10">P='+f2(Math.abs(Pdisp))+' k</text>';
+  if(Pdisp!==null&&Math.abs(Pdisp)>1e-9)s+='<text x="'+(lxp+4)+'" y="'+(topY-arrowLen+4)+'" fill="#c00" font-size="10">P='+f2(Math.abs(Pdisp))+' k'+(Math.abs(p.lex)>1e-12?' (e\u2093='+f2(p.lex)+' ft)':'')+'</text>';
@@ -1718 +1736 @@ function buildInputEcho(){
- let h2='<tr><th rowspan="2">Pedestal</th><th rowspan="2">x (ft)</th><th rowspan="2">y (ft)</th><th rowspan="2">b\u2093\u00d7b\u1D67\u00d7h (ft)</th><th rowspan="2">'+(R.directMode?'Basis':'Type')+'</th><th colspan="5">Applied loads at top of pedestal</th></tr><tr><th>P (k)</th><th>Vx (k)</th><th>Vy (k)</th><th>Mx (k-ft)</th><th>My (k-ft)</th></tr>';
+ let h2='<tr><th rowspan="2">Pedestal</th><th rowspan="2">x (ft)</th><th rowspan="2">y (ft)</th><th rowspan="2">b\u2093\u00d7b\u1D67\u00d7h (ft)</th><th rowspan="2">Load offset e\u2093, e\u1D67 (ft)</th><th rowspan="2">'+(R.directMode?'Basis':'Type')+'</th><th colspan="5">Applied loads at top of pedestal</th></tr><tr><th>P (k)</th><th>Vx (k)</th><th>Vy (k)</th><th>Mx (k-ft)</th><th>My (k-ft)</th></tr>';
@@ -1722 +1740 @@ function buildInputEcho(){
-   [p.label,f2(p.x),f2(p.y),f2(p.bx)+'\u00d7'+f2(p.by)+'\u00d7'+f2(p.h),'LRFD',f2(num(d2.P)),f2(num(d2.Vx)),f2(num(d2.Vy)),f2(num(d2.Mx)),f2(num(d2.My))].forEach(x=>{const td=document.createElement('td');td.textContent=x;tr.appendChild(td);});
+   [p.label,f2(p.x),f2(p.y),f2(p.bx)+'\u00d7'+f2(p.by)+'\u00d7'+f2(p.h),f3(p.lex)+', '+f3(p.ley),'LRFD',f2(num(d2.P)),f2(num(d2.Vx)),f2(num(d2.Vy)),f2(num(d2.Mx)),f2(num(d2.My))].forEach(x=>{const td=document.createElement('td');td.textContent=x;tr.appendChild(td);});
@@ -1730 +1748,2 @@ function buildInputEcho(){
-     const td=document.createElement('td');td.rowSpan=use.length;td.textContent=f2(p.bx)+'\u00d7'+f2(p.by)+'\u00d7'+f2(p.h);tr.appendChild(td);}
+     const td=document.createElement('td');td.rowSpan=use.length;td.textContent=f2(p.bx)+'\u00d7'+f2(p.by)+'\u00d7'+f2(p.h);tr.appendChild(td);
+     const te=document.createElement('td');te.rowSpan=use.length;te.textContent=f3(p.lex)+', '+f3(p.ley);tr.appendChild(te);}   /* SFLO */
@@ -1840,0 +1860 @@ function resultantBreakdown(a){
+ if(R.peds.some(p=>p.lex||p.ley))det.appendChild(el('p','note','<b>Load offsets on the pedestals:</b> pedestal loads act at the load point (x + e<sub>x</sub>, y + e<sub>y</sub>), so their x, y above include the offset: '+R.peds.filter(p=>p.lex||p.ley).map(p=>sfEsc(p.label)+': '+f2(p.x)+' + '+f3(p.lex)+' = '+f3(p.x+p.lex)+', '+f2(p.y)+' + '+f3(p.ley)+' = '+f3(p.y+p.ley)+' ft').join('; ')+'. Pedestal self-weight stays at the pedestal centroid.'));   /* SFLO */
@@ -3012 +3032 @@ function computePhase2(R){
-   let Pi=0,mxi=0,myi=0,mxp=0,myp=0;
+   let Pi=0,mxi=0,myi=0,mxp=0,myp=0,Pa=0;
@@ -3013,0 +3034,6 @@ function computePhase2(R){
+   /* SFLO: a load applied at e_x, e_y from the pedestal centroid reaches the pedestal (and
+      through it the footing) as P at the centroid plus the moments P*e_y (about x, +Mx) and
+      P*e_x (about y, +My): added once here, to the applied moment of every load, so they
+      act at the footing base (mx, my: footing flexure, one-way shear, punching relief) and
+      at the pedestal base (mxPed, myPed: pedestal P-M, punching moment transfer). The
+      pedestal self-weight is at the centroid (no offset). */
@@ -3016,3 +3042,3 @@ function computePhase2(R){
-    Pi+=Pp;
-    mxi+=(mx+vy*(t+p.h)*hFac2); myi+=(my+vx*(t+p.h)*hFac2); // footing base
-    mxp+=(mx+vy*p.h*hFac2);     myp+=(my+vx*p.h*hFac2);     // pedestal base
+    Pi+=Pp;Pa+=Pp;
+    mxi+=(mx+Pp*p.ley+vy*(t+p.h)*hFac2); myi+=(my+Pp*p.lex+vx*(t+p.h)*hFac2); // footing base
+    mxp+=(mx+Pp*p.ley+vy*p.h*hFac2);     myp+=(my+Pp*p.lex+vx*p.h*hFac2);     // pedestal base
@@ -3022,3 +3048,3 @@ function computePhase2(R){
-     Pi+=ft*Pp;
-     mxi+=ft*(mx+vy*(t+p.h)*hFac2); myi+=ft*(my+vx*(t+p.h)*hFac2);
-     mxp+=ft*(mx+vy*p.h*hFac2);     myp+=ft*(my+vx*p.h*hFac2);});
+     Pi+=ft*Pp;Pa+=ft*Pp;
+     mxi+=ft*(mx+Pp*p.ley+vy*(t+p.h)*hFac2); myi+=ft*(my+Pp*p.lex+vx*(t+p.h)*hFac2);
+     mxp+=ft*(mx+Pp*p.ley+vy*p.h*hFac2);     myp+=ft*(my+Pp*p.lex+vx*p.h*hFac2);});
@@ -3027 +3053,2 @@ function computePhase2(R){
-   pl.push({x:p.x,y:p.y,bx:p.bx,by:p.by,P:Pi,mx:mxi,my:myi,mxPed:mxp,myPed:myp,idx:i});
+   pl.push({x:p.x,y:p.y,bx:p.bx,by:p.by,P:Pi,mx:mxi,my:myi,mxPed:mxp,myPed:myp,idx:i,
+    Pa,lex:p.lex,ley:p.ley,PeMx:Pa*p.ley,PeMy:Pa*p.lex});   // SFLO: factored applied P and its offset moments P*e_y (in mx), P*e_x (in my)
@@ -3569 +3596,2 @@ function computePhase2(R){
-   if(vu>vuMax){vuMax=vu;govC=c;detail={q,Acrit,AcritFull,Vu,relief,bodyIn,MuX,MuY,Mu:Math.hypot(MuX,MuY),gvX,gvY,JcX,JcY,cExtX,cExtY,vshear,vmomX,vmomY,vmom};}
+   if(vu>vuMax){vuMax=vu;govC=c;detail={q,Acrit,AcritFull,Vu,relief,bodyIn,MuX,MuY,Mu:Math.hypot(MuX,MuY),gvX,gvY,JcX,JcY,cExtX,cExtY,vshear,vmomX,vmomY,vmom,
+    Pa:pl.Pa,lex:pl.lex,ley:pl.ley,PeMx:pl.PeMx,PeMy:pl.PeMy};}   // SFLO: the load-offset part of mxPed / myPed, for display
@@ -3671 +3699 @@ function computePhase2(R){
-  let PuMax=0,MuxMax=0,MuyMax=0,govC=null;
+  let PuMax=0,MuxMax=0,MuyMax=0,govC=null,govMx=null,govMy=null;
@@ -3673,0 +3702,2 @@ function computePhase2(R){
+   if(Math.abs(pl.mxPed)>MuxMax||!govMx)govMx={name:c.cb.name,pl};   // SFLO: display only (P*e share of the governing moments)
+   if(Math.abs(pl.myPed)>MuyMax||!govMy)govMy={name:c.cb.name,pl};
@@ -3712 +3742 @@ function computePhase2(R){
-   PuMax,MuxMax,MuyMax,tieMax,tieOK,tieSizeOK,nBarsOK,rhoOK,rhoMin,rhoMax,barFitOK,clrX,clrY,clrMin,r,klu_r,slenderFlag,dcrAxial,bmin,h,bx,by,isPatch,
+   PuMax,MuxMax,MuyMax,govMx,govMy,tieMax,tieOK,tieSizeOK,nBarsOK,rhoOK,rhoMin,rhoMax,barFitOK,clrX,clrY,clrMin,r,klu_r,slenderFlag,dcrAxial,bmin,h,bx,by,isPatch,
@@ -3883 +3913 @@ function renderFootingDesign(){
- intro.appendChild(el('p','note','Structural design uses strength (LRFD) combinations (ASCE 7-16 \u00a72.3.1 / ACI 318-19 \u00a75.3). The net soil pressure driving footing shear and moment is computed from the pedestal-delivered factored loads (axial, applied moment, and V\u00b7h shear couples) plus pedestal self-weight; footing self-weight, EV, and buoyancy are uniform reactions carried directly to the soil and are excluded from the structural pressure per standard practice. The footing is analyzed as a rigid body on a compression-only (no-tension) soil; the factored base-pressure plane is solved for each combination and the moment and shear at each critical section are obtained by <b>direct integration of that pressure solid</b> over the region outboard of the section, with the uplifted (zero-pressure) area excluded. Moments are reported by the direction of the resisting bars: the x-direction moment is taken at the pedestal face normal to x. <b>Reinforcement convention:</b> flexural and shear capacities are computed on a <b>per-foot</b> basis, A<sub>s</sub> = A<sub>b</sub>&times;12/s, and are therefore independent of any assumed discrete bar count; the 3D view draws a floor-based count starting at cover + d<sub>b</sub>/2, which can show one fewer bar than a schedule would list. Reconcile the schedule against the spacing, not against the drawn count. Programs that label a moment by the axis it bends about (e.g. RISAFoundation M<sub>xx</sub>) will show these two values transposed.'));
+ intro.appendChild(el('p','note','Structural design uses strength (LRFD) combinations (ASCE 7-16 \u00a72.3.1 / ACI 318-19 \u00a75.3). The net soil pressure driving footing shear and moment is computed from the pedestal-delivered factored loads (axial, applied moment, and V\u00b7h shear couples'+(R.peds.some(p=>p.lex||p.ley)?', and P\u00b7e from the load offsets on the pedestals':'')+') plus pedestal self-weight; footing self-weight, EV, and buoyancy are uniform reactions carried directly to the soil and are excluded from the structural pressure per standard practice. The footing is analyzed as a rigid body on a compression-only (no-tension) soil; the factored base-pressure plane is solved for each combination and the moment and shear at each critical section are obtained by <b>direct integration of that pressure solid</b> over the region outboard of the section, with the uplifted (zero-pressure) area excluded. Moments are reported by the direction of the resisting bars: the x-direction moment is taken at the pedestal face normal to x. <b>Reinforcement convention:</b> flexural and shear capacities are computed on a <b>per-foot</b> basis, A<sub>s</sub> = A<sub>b</sub>&times;12/s, and are therefore independent of any assumed discrete bar count; the 3D view draws a floor-based count starting at cover + d<sub>b</sub>/2, which can show one fewer bar than a schedule would list. Reconcile the schedule against the spacing, not against the drawn count. Programs that label a moment by the axis it bends about (e.g. RISAFoundation M<sub>xx</sub>) will show these two values transposed.'));
@@ -4175,0 +4206 @@ function renderPunching(parent){
+  if(Math.abs(gov.detail.lex||0)>1e-12||Math.abs(gov.detail.ley||0)>1e-12)b.appendChild(el('div','note','<b>Load offset on '+sfEsc(gov.label)+':</b> M<sub>ux</sub> and M<sub>uy</sub> above are the moments transferred at the pedestal base and include P<sub>u,a</sub>\u00b7e from the load point: P<sub>u,a</sub>e<sub>y</sub> = '+f2(gov.detail.Pa)+' \u00d7 '+f3(gov.detail.ley)+' = '+f2(gov.detail.PeMx)+' k-ft in M<sub>ux</sub>, P<sub>u,a</sub>e<sub>x</sub> = '+f2(gov.detail.Pa)+' \u00d7 '+f3(gov.detail.lex)+' = '+f2(gov.detail.PeMy)+' k-ft in M<sub>uy</sub> (ACI 318-19 8.4.4.2).'));   /* SFLO */
@@ -4219,0 +4251,9 @@ function renderPedestalDesign(){
+  if(pd.govMx&&pd.govMy&&(Math.abs(pd.govMx.pl.ley)>1e-12||Math.abs(pd.govMx.pl.lex)>1e-12)){   /* SFLO: the load-offset part of M_ux, M_uy, worked */
+   const gx=pd.govMx.pl, gy=pd.govMy.pl;
+   const tn=x=>String(x).replace(/[\\{}$&#%_^~]/g,'');   // combination name inside \text{}
+   b.appendChild(eqBlock('Load offset on the pedestal — moments P·e in M_ux, M_uy','ACI 318-19 10.4.1 (factored moments with the axial force); statics',
+    'M_{ux} = M_{x,app} + V_y h + P_{u,a}\\,e_y,\\qquad M_{uy} = M_{y,app} + V_x h + P_{u,a}\\,e_x',
+    '\\text{'+tn(pd.govMx.name)+'}:\\;P_{u,a}e_y = '+f2(gx.Pa)+'\\cdot '+f3(gx.ley)+' = '+f2(gx.PeMx)+',\\;M_{ux} = '+f2(gx.mxPed-gx.PeMx)+' + '+f2(gx.PeMx)+' = '+f2(gx.mxPed)+'\\;\\mathrm{k\\text{-}ft}',
+    '\\text{'+tn(pd.govMy.name)+'}:\\;P_{u,a}e_x = '+f2(gy.Pa)+'\\cdot '+f3(gy.lex)+' = '+f2(gy.PeMy)+',\\;M_{uy} = '+f2(gy.myPed-gy.PeMy)+' + '+f2(gy.PeMy)+' = '+f2(gy.myPed)+'\\;\\mathrm{k\\text{-}ft}\\quad(|M_{ux}|_{max} = '+f2(pd.MuxMax)+',\\;|M_{uy}|_{max} = '+f2(pd.MuyMax)+')'));
+   b.appendChild(el('div','note','M at the pedestal base; P<sub>u,a</sub> = factored applied load at the load point (the pedestal self-weight acts at the centroid). The same P\u00b7e reaches the footing as an interface moment (flexure, one-way shear, punching moment transfer).'));
+  }
@@ -4610,0 +4651 @@ function buildLoads(item){
+  const lp=e2v(p.x+(p.lex||0),p.y+(p.ley||0),p.h);   // SFLO: P drawn at the load point on the pedestal top
@@ -4612 +4653 @@ function buildLoads(item){
-   addArrow(g,top,new THREE.Vector3(0,P>0?-1:1,0),len,0xc0392b,f2(Math.abs(P))+' k'); }
+   addArrow(g,lp,new THREE.Vector3(0,P>0?-1:1,0),len,0xc0392b,f2(Math.abs(P))+' k'); }
```


## 2026-11-01 — PR: claude/sf-report — Report output tab in the shared report viewer (SFRP; display only, no calculation change) (PR link added after merge)

Line numbers are approximate; search for the anchor text. Every code site is tagged `SFRP`.

### SFRP. "9. Report" output tab (shared/report.js, shared/steps.js)   [display only]
- **Engineer request (2026-11-01):** a Report output tab in the shared viewer used by the Steel Bridge app: navigation tree, numbered sections, worked steps (equation → substituted values → result, CLAUDE.md §6), steps grouped by topic with the `shared/steps.js` group helper, "see §x.y" links, and print to PDF with a title block (no owner cell).
- **Loads:** `<script src="shared/steps.js">` and `<script src="shared/report.js">` (classic scripts, relative path) after the CDN libraries. The tool now needs the `shared` folder next to it (it is in the repository). Without that folder only the Report tab shows an error; every other tab is unaffected.
- **New code** (one `<script>` block before "recalc & init"):
  - `sfrModel()` builds the report model from `R`, `P2` and the functions the result tabs already call: `barAreaPerFt`, `devLength` through `sfdDevData`, `planSVG`, `sectSVG`, `selfConsistency` is not used.
  - `sfrTopics()` groups each list of steps into topics with `SharedSteps.group`.
  - `renderReport()` mounts the viewer (`SharedReport.mount`).
  - `sfrGoto()` handles the in-app links `[[tab:…]]` (output tabs and the Reinforcement input tab).
  - The print hooks are `sfrWillPrint()` and a `beforeprint` listener.
- **Sections:**
  1. Project and inputs (title block data, geometry/materials, soil and stability parameters, footing reinforcement with A_s = 12 A_b/s worked, pedestals and loads, plan and elevation figures).
  2. Loads and combinations (W_f, W_ped, A_EV, h_EV, EV, surcharge, U worked; ASD and LRFD tables; the governing bearing combination's ΣP, ΣM, e worked term by term).
  3. Bearing (kern index, q_max/q_min or the no-tension plane; Vesić/Meyerhof steps or the direct q_a check; every combination table).
  4. Stability (eccentricity limit; μ, P_p, sliding x / y / resultant, overturning at the governing edge, flotation, rigidity; D/C = FS_target/FS as on the dashboard).
  5. Footing design (effective depths; per direction: flexure, minimum steel, spacing, one-way shear, development; punching per pedestal; concrete bearing and dowels; band steel, advisory).
  6. Pedestal design (A_st, ρ_g, bar fit, P_0, φP_n,max, axial DCR, M_ux / M_uy with the P·e share, ties, slenderness).
  7. Assumptions and warnings (the project text and the tool's warnings).
  8. References (`SFD_REFS`).
- **Values:** every step `value` is the tool's own value (for example `R.govBear.DCR`, `P2.desX.dcrBot`, `pu.dcr`, `pd.dcrAxial`). Only the substitution strings are formatted. Two values are shown in another unit: φM_n = `capBot.phiMn/12` (kip-in to kip-ft, as on the tab) and the stability D/C = FS_target/FS (as the D11 result lines and the dashboard).
- **Refactor (no result change):** the development data in Footing Design 5.4 (bar, `devLength` detail, governing section, available length) moved unchanged into `sfdDevData(dir)`. `renderFootingDesign` and the report both call it.
- **Print:**
  - The viewer's "Print report" button prints the report alone, with the title block Project / Project No. / Calculated by / Date / Checked by / Checked date (no owner cell), a cover, contents, running header "Project No. … — project" / "Computed … · Checked …", a footer, and "Page X of Y".
  - Ctrl+P while the Report tab is shown prints the report too (`sfrWillPrint()` makes the D11 `beforeprint` handler stand aside).
  - From any other tab, Ctrl+P and "Print-to-PDF Report" print the D11 tab report as before. `#tab-report` is hidden there (`#tab-report:not(.active)`) and left out of its contents (`renderPrintHeader` filter).
- **Saved data:** nothing new is saved. The viewer's collapsed sections are kept in memory only (`SFRP.closed`).
- **How verified (headless Chromium):**
  - 8 projects (default, direct, water table + AASHTO eccentricity + gated OT + 3 pedestals + top mats, direct q_a net + override V_c + bearing patch, single pedestal with moments, direct with moments, load offsets + water table + surcharges, large lateral load). Each report has 114 to 179 steps, 0 unresolved or duplicate references, 0 KaTeX errors, and no NaN or undefined in `SharedReport.text()`.
  - 15 to 22 spot values per project equal the app's values (bearing DCR, q_max, e, W_f, EV, flexure and shear DCRs, punching, pedestal axial DCR and M_uy, concrete bearing DCR).
  - `R` and `P2` are unchanged by building the report. 0 console errors.
  - The fatal-input project shows the input-error message.
  - origin/main vs the branch on 7 projects: `R`, `P2`, dashboard, warnings, self-consistency, state, storage and the text of tabs 1–6 are identical.
  - Ctrl+P on the Report tab gives `body.rp-printing`, the report alone and the @page running header (PDF checked, 24 pages on the offsets project).
  - `node tests/engine/run.mjs report steps`: 14 passed (shared files unchanged). `node tests/check-syntax.mjs "Spread Footing.html"` passes.
- **Other copies:** none. `shared/README.md` lists Spread Footing.html as a user of `steps.js` and `report.js`.
- **Open item:** at a 390 px viewport the tool's two-column layout does not stack: the input panel has a min-width of 400 px, so every output tab, the Report included, scrolls horizontally. This is the existing layout and was not changed.

Diff (`Spread Footing.html`, `git diff -U0` against origin/main):

```diff
diff --git a/Spread Footing.html b/Spread Footing.html
index 642e9e3..7a5de83 100644
--- a/Spread Footing.html	
+++ b/Spread Footing.html	
@@ -10,0 +11,3 @@
+<!-- SFRP: shared worked steps and the shared report viewer (classic scripts, relative path: keep the shared folder next to this file) -->
+<script src="shared/steps.js"></script>
+<script src="shared/report.js"></script>
@@ -177 +180 @@ a.wkA:hover{text-decoration:underline}
- .wrap>div:first-child,#titleblock,#tab-3d{display:none !important}   /* screen title row and input title block: the cover replaces them; live 3D view not printed */
+ .wrap>div:first-child,#titleblock,#tab-3d,#tab-report:not(.active){display:none !important}   /* screen title row and input title block: the cover replaces them; live 3D view not printed */
@@ -415,0 +419 @@ a.wkA:hover{text-decoration:underline}
+  <button data-tab="tab-report">9. Report</button>
@@ -424,0 +429 @@ a.wkA:hover{text-decoration:underline}
+ <div class="tabpage" id="tab-report"></div>
@@ -2708 +2713 @@ function renderPrintHeader(){
-  .filter(s=>s.n&&s.id!=='tab-3d'&&(s.id!=='tab-manual'||state.manPrint));
+  .filter(s=>s.n&&s.id!=='tab-3d'&&s.id!=='tab-report'&&(s.id!=='tab-manual'||state.manPrint));
@@ -2742,0 +2748,369 @@ function renderPrintHeader(){
+/* ================= 9. Report tab (SFRP, 2026-11-01) =================
+   The calculation report in the shared viewer (shared/report.js: navigation tree, numbered sections §n.m, collapse /
+   expand, search, Print with a title block, running header and page numbers). Worked steps are shared/steps.js steps
+   (equation → substituted values → result), grouped by topic with SharedSteps.group as in the Steel Bridge app.
+   Every value shown is a value the tool has already computed (R, P2, and the same functions the result tabs call:
+   barAreaPerFt, devLength, sfdDevData); only the substitution strings are formatted here. Nothing is saved: the report
+   is rebuilt from R / P2 whenever the tab is shown or the inputs change while it is shown. */
+const SFRP={closed:new Set(),api:null,doc:null};
+const sfrN=(x,d)=>SharedSteps.n(x,d==null?2:d);
+const sfrP=(x,d)=>(typeof x==='number'&&x<0)?'('+sfrN(x,d)+')':sfrN(x,d);   // a negative value in parentheses inside a substitution
+const sfrTx=s=>String(s==null?'':s).replace(/[\\{}$&#%_^~]/g,'');            // text placed inside \text{}
+const sfrPlain=s=>String(s==null?'':s).replace(/<sub>(.*?)<\/sub>/g,'$1').replace(/<[^>]+>/g,'');
+const SFR_FC="f^{\\prime}_{c}";
+/* a steps item whose steps are grouped in topics (SharedSteps.group, one topic per list entry, in order) */
+function sfrTopics(scope,list,opt){
+ const L=list.filter(t=>t.steps&&t.steps.length);
+ const steps=[].concat(...L.map(t=>t.steps));
+ const topics=L.map(t=>{const g=SharedSteps.group(t.steps,[{key:'k',title:t.title,ref:t.ref,ids:()=>true}],{strip:false})[0];
+  return {title:t.title,ref:t.ref||'',n:t.steps.length,cls:g.cls,chip:g.chip,res:g.res};});
+ return Object.assign({type:'steps',scope,steps,topics},opt||{});
+}
+function sfrW(){const w=SharedSteps.work('');return w;}
+const sfrCell=(v,d,cls)=>({t:(typeof v==='number')?(isFinite(v)?sfrN(v,d):(v>0?'∞':'−∞')):String(v==null?'—':v),n:typeof v==='number',cls});
+const sfrDC=v=>({t:(typeof v==='number'&&isFinite(v))?sfrN(v,2):(v===Infinity?'∞':'—'),n:true,cls:(typeof v==='number')?(v>1+1e-9?'ng':(v>=0.9?'hi':'ok')):'na'});
+
+function sfrModel(){
+ const m=state.meta||{}, secs=[];
+ const fc=R.fc, fy=num(state.mat.fy);
+ /* ---------- 1. Project and inputs ---------- */
+ {
+  const subs=[];
+  const hand=[typeof sfMrSourceLine==='function'?sfMrSourceLine():'',typeof sfFlSourceLine==='function'?sfFlSourceLine():''].filter(Boolean);
+  subs.push({title:'Project',items:[{type:'kv',rows:[
+   ['Project',m.project||'—'],['Project number',m.number||'—'],['Calculated by',(m.calcBy||'—')+(m.calcDate?', '+m.calcDate:'')],['Checked by',(m.chkBy||'—')+(m.chkDate?', '+m.chkDate:'')],
+   ['Load input',R.directMode?'Direct factored (LRFD envelope) per pedestal'+(R.aashtoDirect?'; imported AASHTO case "'+R.aashtoDirect.caseName+'" ('+R.aashtoDirect.ls+')':''):'By load type (D, L, Lr, S, Wx, Wy); ASCE 7-16 combinations generated'],
+   ['Codes','ACI 318-19 (concrete); ASCE 7-16 §2.3.1 / §2.4.1 (combinations); IBC 2021; bearing capacity per Vesić / Meyerhof (see §8)'],
+   ...hand.map(h=>['Hand-off source',h])]},
+   {type:'note',text:'Units: kip, ft, ksf unless noted; bar sizes and covers in in, f′c and f_y in psi. Every value in this report is the value the tool computes on its result tabs ([[tab:schem|Schematic]], [[tab:combos|Load Combinations]], [[tab:bearing|Bearing]], [[tab:stab|Stability]], [[tab:footdes|Footing Design]], [[tab:peddes|Pedestal Design]]).'}]});
+  subs.push({title:'Geometry and materials',items:[{type:'table',head:['Quantity','Value','Unit'],rows:[
+   ['Footing width B (x)',sfrCell(R.B),'ft'],['Footing length L (y)',sfrCell(R.L),'ft'],['Footing thickness t',sfrCell(R.t),'ft'],['Embedment D_f (grade to bearing)',sfrCell(R.Df),'ft'],
+   ['Concrete unit weight γ_c',sfrCell(R.gc*1000,0),'pcf'],["Concrete f′c",sfrCell(fc,0),'psi'],['Steel f_y',sfrCell(fy,0),'psi'],['Lightweight factor λ',sfrCell(num(state.mat.lambda)),'–'],
+   ['Bar coating',state.mat.coating==='epoxy'?'epoxy-coated':'uncoated / galvanized','–'],['One-way V_c basis',state.mat.vcMode==='a'?'override 2λ√f′c':'ACI 318-19 Table 22.5.5.1(c)','–'],
+   ['Cover, bottom / top',sfrN(num(state.mat.coverBot))+' / '+sfrN(num(state.mat.coverTop)),'in'],['Side / end cover, bottom bars',sfdSideCoverIn()===null?'= bottom cover':sfrN(sfdSideCoverIn()),'in'],
+   ['Subgrade modulus k_s',sfrCell(R.ks,0),'pci'],['Footing self-weight',state.mat.swMode==='user'?'user override':'computed','–']]}]});
+  const soilRows=state.soil.mode==='vesic'
+   ?[['Bearing basis','Vesić, computed','–'],['Cohesion c',sfrCell(R.c),'ksf'],['Friction angle φ',sfrCell(R.phiDeg,1),'deg'],['Bearing capacity FS',sfrCell(R.FSb),'–'],['Depth factors',state.soil.sfdDepthF==='on'?'on':'off (d = 1.0)','–'],
+     ['Allowable bearing override',state.soil.qaOverride==='on'?sfrN(num(state.soil.qaOverVal))+' ksf':'off','–']]
+   :[['Bearing basis','Direct allowable q_a ('+state.soil.qaBasis+')','–'],['Allowable bearing q_a',sfrCell(num(state.soil.qa)),'ksf']];
+  subs.push({title:'Soil, cover and stability parameters',items:[{type:'table',head:['Quantity','Value','Unit'],rows:soilRows.concat([
+   ['Soil unit weight γ_s',sfrCell(R.gs*1000,0),'pcf'],['Water table depth d_w',R.dw===Infinity?'none':sfrN(R.dw),'ft below grade'],
+   ['Soil cover over footing (input / effective)',sfrN(num(state.ev.cover))+' / '+sfrN(R.covEff),'ft'],['Cover soil unit weight γ_EV',sfrCell(R.gev*1000,0),'pcf'],
+   ['Dead / live surcharge',sfrN(num(state.ev.qDsur),0)+' / '+sfrN(num(state.ev.qLsur),0),'psf'],
+   ['Base friction μ',sfrN(R.mu,3)+(state.stab.muMode==='phi'?' (tan 2/3 φ)':' (input)'),'–'],['Passive fraction mobilized',sfrCell(R.pf),'–'],
+   ['FS targets: overturning / sliding / flotation',sfrN(num(state.stab.FSot))+' / '+sfrN(num(state.stab.FSsl))+' / '+sfrN(num(state.stab.FSfl)),'–'],
+   ['Overturning FS gates the result',R.otGate?'yes':'no (reported only)','–'],['Eccentricity limit',R.eccChk?sfrPlain(R.eccChk.lab):'not checked','–'],
+   ['Pedestal shear couple V·h',state.stab.shearCouple==='off'?'excluded':'included','–']])}]});
+  /* reinforcement: A_b, A_s per ft (barAreaPerFt, as the design) */
+  const w=sfrW();
+  [['botX','Bottom mat, x-bars'],['botY','Bottom mat, y-bars'],['topX','Top mat, x-bars'],['topY','Top mat, y-bars']].forEach(([k,lab])=>{
+   const mt=state.freinf[k]||{},sz=mt.size,s=num(mt.spc);
+   if(!sz||!(s>0))return;
+   w.add({id:'As.'+k,label:lab+': #'+sz+' at '+sfrN(s)+' in',sym:'A_{s}',eq:'\\frac{12\\,A_{b}}{s}',sub:'\\frac{12\\cdot'+sfrN(BAR_AREA[sz])+'}{'+sfrN(s)+'}',value:barAreaPerFt(sz,s),unit:'in^{2}/ft',d:3,ref:''});});
+  subs.push({title:'Footing reinforcement',items:[
+   {type:'table',head:['Mat','Bar','s (in)','A_b (in²)'],rows:[['botX','Bottom, x-bars'],['botY','Bottom, y-bars'],['topX','Top, x-bars'],['topY','Top, y-bars']].map(([k,lab])=>{const mt=state.freinf[k]||{};
+    return [lab,mt.size?'#'+mt.size:'none',mt.size?sfrCell(num(mt.spc)):'—',mt.size?sfrCell(BAR_AREA[mt.size]):'—'];})},
+   {type:'steps',scope:'rb',steps:w.steps,title:'Steel area per foot of width (the value used in §5)'},
+   {type:'note',text:'Set on the [[tab:in-rebar|Reinforcement]] input tab. Bars in the x-direction resist bending about the y-axis.'}]});
+  const pr=R.peds.map((p,i)=>{const rf=(state.peds[i]||{}).reinf||{};return [p.label,sfrCell(p.x),sfrCell(p.y),sfrN(p.bx)+' × '+sfrN(p.by)+' × '+sfrN(p.h),sfrN(p.lex,3)+', '+sfrN(p.ley,3),
+   p.h>1e-9?((2*(rf.nx+rf.ny)-4)+' #'+rf.longSize+'; ties #'+rf.tieSize+' at '+sfrN(num(rf.tieSpc))+' in; cover '+sfrN(num(rf.cover))+' in; dowels '+rf.dowelN+' #'+rf.dowelSize):'bearing patch (h = 0)'];});
+  const lr=[];
+  R.peds.forEach(p=>{
+   if(R.directMode){const d=p.direct||{};lr.push([p.label,'factored',...['P','Vx','Vy','Mx','My'].map(k=>sfrCell(num(d[k])))]);}
+   else TYPES.forEach(tp=>{const ld=p.loads[tp]||{};if(!COMP.some(c=>num(ld[c])!==0))return;lr.push([p.label,tp,...COMP.map(c=>sfrCell(num(ld[c])))]);});});
+  subs.push({title:'Pedestals and applied loads',items:[
+   {type:'table',head:['Pedestal','x (ft)','y (ft)','b_x × b_y × h (ft)','load offset e_x, e_y (ft)','Reinforcement'],rows:pr},
+   {type:'table',caption:'Loads at the top of each pedestal'+(R.directMode?' (direct factored)':' (unfactored, by type)')+'; P down +, M_x shifts the soil resultant toward +y, M_y toward +x',head:['Pedestal','Load','P (kip)','V_x (kip)','V_y (kip)','M_x (kip-ft)','M_y (kip-ft)'],rows:lr},
+   {type:'note',text:'Axes: origin at the footing centroid, +x toward B/2, +y toward L/2, +z up. A load offset e_x, e_y places P at (x + e_x, y + e_y) on the pedestal top: +P·e_x adds to M_y and +P·e_y to M_x (§2.4, §6).'}]});
+  const pl=planSVG(), se=sectSVG();
+  subs.push({title:'Plan and elevation',items:[{type:'figure',svg:(pl.querySelector('svg')||{}).outerHTML||'',caption:'Plan: footing, pedestals, load points (red), kern (green), resultant of the governing bearing combination (red ⊗)'},
+   {type:'figure',svg:(se.querySelector('svg')||{}).outerHTML||'',caption:'Elevation looking along −y: grade, soil cover, water table, P and V_x arrows'}]});
+  secs.push({title:'Project and inputs',subs});
+ }
+ /* ---------- 2. Loads and combinations ---------- */
+ {
+  const subs=[], w=sfrW(), gcN=sfrN(R.gc,3);
+  w.add({id:'Wf',label:'Footing self-weight'+(state.mat.swMode==='user'?' (user override)':''),sym:'W_{f}',eq:state.mat.swMode==='user'?'W_{f,user}':'B\\,L\\,t\\,\\gamma_{c}',
+   sub:state.mat.swMode==='user'?sfrN(R.Wf):sfrN(R.B)+'\\cdot'+sfrN(R.L)+'\\cdot'+sfrN(R.t)+'\\cdot'+gcN,value:R.Wf,unit:'kip',ref:'',note:state.mat.swMode==='user'?'computed B L t γ_c = '+sfrN(R.WfAuto)+' kip':''});
+  R.peds.forEach((p,i)=>w.add({id:'Wped.'+i,label:'Pedestal self-weight, '+p.label,sym:'W_{ped}',eq:'b_{x}\\,b_{y}\\,h\\,\\gamma_{c}',sub:sfrN(p.bx)+'\\cdot'+sfrN(p.by)+'\\cdot'+sfrN(p.h)+'\\cdot'+gcN,value:R.Wpeds[i],unit:'kip'}));
+  w.add({id:'Aev',label:'Plan area outside the pedestals (soil cover, surcharge)',sym:'A_{EV}',eq:'B\\,L \\minus \\sum b_{x} b_{y}',sub:sfrN(R.B)+'\\cdot'+sfrN(R.L)+' \\minus '+sfrN(R.Aped),value:R.Aev,unit:'ft^{2}'});
+  w.add({id:'hEV',label:'Effective soil cover over the footing',sym:'h_{EV}',eq:'\\min(h_{cover},\\, D_{f} \\minus t)',sub:'\\min('+sfrN(num(state.ev.cover))+',\\,'+sfrN(R.Df)+' \\minus '+sfrN(R.t)+')',value:R.covEff,unit:'ft'});
+  w.add({id:'EV',label:'Soil cover on the footing',sym:'EV',eq:'(\\gamma_{EV} h_{dry} + (\\gamma_{EV} \\minus \\gamma_{w}) h_{sub})\\,A_{EV}',
+   sub:'('+sfrN(R.gev,3)+'\\cdot'+sfrN(R.covDry)+' + ('+sfrN(R.gev,3)+' \\minus '+sfrN(R.gw,4)+')\\cdot'+sfrN(R.covSub)+')\\cdot'+sfrN(R.Aev),value:R.EV,unit:'kip',ref:'',note:'acts at x = '+sfrN(R.xev,3)+', y = '+sfrN(R.yev,3)+' ft (centroid of A_EV)'});
+  if(R.surD>0)w.add({id:'surD',label:'Dead surcharge',sym:'S_{D}',eq:'q_{D,sur} A_{EV}',sub:sfrN(R.qDsur,3)+'\\cdot'+sfrN(R.Aev),value:R.surD,unit:'kip'});
+  if(R.surL>0)w.add({id:'surL',label:'Live surcharge',sym:'S_{L}',eq:'q_{L,sur} A_{EV}',sub:sfrN(R.qLsur,3)+'\\cdot'+sfrN(R.Aev),value:R.surL,unit:'kip'});
+  if(R.U>0)w.add({id:'U',label:'Buoyancy (footing and submerged pedestals)',sym:'U',eq:'\\gamma_{w} B L h_{sub} + U_{ped}',sub:sfrN(R.gw,4)+'\\cdot'+sfrN(R.B)+'\\cdot'+sfrN(R.L)+'\\cdot'+sfrN(R.hsub)+' + '+sfrN(R.U-R.gw*R.B*R.L*R.hsub),value:R.U,unit:'kip',note:'applied at 1.0 in every combination'});
+  subs.push({title:'Self-weights, soil cover, surcharge and buoyancy',items:[{type:'steps',scope:'sw',steps:w.steps}]});
+  const row=(a,gov)=>({cells:[a.cb.name,sfrPlain(a.cb.ref||''),sfrCell(a.r.P),sfrCell(a.r.Hx),sfrCell(a.r.Hy),sfrCell(a.r.Mx),sfrCell(a.r.My),sfrCell(a.r.ex,3),sfrCell(a.r.ey,3)],cls:a===gov?'gov':''});
+  const hd=['Combination','Basis','ΣP (kip)','ΣH_x','ΣH_y','ΣM_x (kip-ft)','ΣM_y','e_x (ft)','e_y (ft)'];
+  subs.push({title:R.directMode?'Factored envelope (service checks)':'Service (ASD) combinations',items:[{type:'table',wide:true,head:hd,rows:R.asd.map(a=>row(a,R.govBear))},
+   {type:'note',text:(R.directMode?'Direct factored mode: one user envelope with dead-load brackets; bearing is checked with factored loads against the allowable bearing (conservative), stability is indicative.':'ASCE 7-16 §2.4.1 / IBC 2021 §1605.3: bearing and stability.')+' Bold: the governing bearing combination, worked in §2.4. Each row is the same sum as §2.4.'}]});
+  subs.push({title:R.directMode?'Factored envelope (structural design)':'Strength (LRFD) combinations',items:[{type:'table',wide:true,head:hd,rows:R.lrfd.map(a=>row(a,null))},
+   {type:'note',text:'ASCE 7-16 §2.3.1 / ACI 318-19 §5.3: footing and pedestal design (§5, §6).'}]});
+  /* resultant of the governing bearing combination */
+  const G=R.govBear, r=G.r, w2=sfrW(), vt=r.verts;
+  const lst=(f)=>vt.map(f).join(' + ');
+  w2.add({id:'P',label:'Vertical resultant, '+G.cb.name,sym:'\\sum P',eq:'\\sum w_{i}',sub:lst(v=>sfrP(v.w)),value:r.P,unit:'kip'});
+  w2.add({id:'My',label:'Moment about the y-axis (shifts the resultant toward +x)',sym:'\\sum M_{y}',eq:'\\sum w_{i} x_{i} + \\sum M_{a,y}',sub:lst(v=>sfrP(v.w)+'\\cdot'+sfrP(v.x,3))+' + '+sfrP(r.MaY),value:r.My,unit:'kip-ft'});
+  w2.add({id:'Mx',label:'Moment about the x-axis (shifts the resultant toward +y)',sym:'\\sum M_{x}',eq:'\\sum w_{i} y_{i} + \\sum M_{a,x}',sub:lst(v=>sfrP(v.w)+'\\cdot'+sfrP(v.y,3))+' + '+sfrP(r.MaX),value:r.Mx,unit:'kip-ft'});
+  w2.add({id:'Hx',label:'Horizontal resultants',sym:'\\sum H_{x}',eq:'\\sum V_{x}',sub:sfrN(r.Hx),value:r.Hx,unit:'kip',note:'ΣH_y = '+sfrN(r.Hy)+' kip'});
+  w2.add({id:'ex',label:'Eccentricity in x',sym:'e_{x}',eq:'\\frac{\\sum M_{y}}{\\sum P}',sub:'\\frac{'+sfrP(r.My)+'}{'+sfrN(r.P)+'}',value:r.ex,unit:'ft',d:3});
+  w2.add({id:'ey',label:'Eccentricity in y',sym:'e_{y}',eq:'\\frac{\\sum M_{x}}{\\sum P}',sub:'\\frac{'+sfrP(r.Mx)+'}{'+sfrN(r.P)+'}',value:r.ey,unit:'ft',d:3});
+  subs.push({title:'Resultant of the governing bearing combination ('+G.cb.name+')',items:[
+   {type:'table',head:['Action','factor × magnitude','w_i (kip)','x_i (ft)','y_i (ft)'],rows:vt.map(v=>[v.src,v.f===undefined?'–':sfrN(v.f)+' × '+sfrN(v.mag),sfrCell(v.w),sfrCell(v.x,3),sfrCell(v.y,3)])},
+   {type:'steps',scope:'res',steps:w2.steps},
+   {type:'note',text:'M_a: applied pedestal moments and the shear couples V·(t + h) about the base of the footing'+(state.stab.shearCouple==='off'?' (couples excluded by input)':'')+'. Pedestal loads act at their load points (x + e_x, y + e_y); self-weights at their centroids.'}]});
+  secs.push({title:'Loads and combinations',subs});
+ }
+ /* ---------- 3. Bearing ---------- */
+ {
+  const subs=[], G=R.govBear, r=G.r, bp=G.bear, w=sfrW();
+  w.add({id:'kern',label:'Kern (middle third) index',sym:'k',eq:'\\frac{6|e_{x}|}{B} + \\frac{6|e_{y}|}{L}',sub:'\\frac{6\\cdot'+sfrN(Math.abs(r.ex),3)+'}{'+sfrN(R.B)+'} + \\frac{6\\cdot'+sfrN(Math.abs(r.ey),3)+'}{'+sfrN(R.L)+'}',value:bp.kern||0,unit:'',d:3,
+   note:(bp.kern<=1?'k ≤ 1: full contact':'k > 1: partial contact (no-tension soil)')+'; e: see §ex'});
+  if(bp.mode==='full'){
+   w.add({id:'qmax',label:'Maximum corner pressure',sym:'q_{max}',eq:'\\frac{\\sum P}{B L}\\left(1 + \\frac{6|e_{x}|}{B} + \\frac{6|e_{y}|}{L}\\right)',sub:'\\frac{'+sfrN(r.P)+'}{'+sfrN(R.B)+'\\cdot'+sfrN(R.L)+'}\\left(1 + '+sfrN(6*Math.abs(r.ex)/R.B,3)+' + '+sfrN(6*Math.abs(r.ey)/R.L,3)+'\\right)',value:bp.qmax,unit:'ksf',d:3});
+   w.add({id:'qmin',label:'Minimum corner pressure',sym:'q_{min}',eq:'\\frac{\\sum P}{B L}\\left(1 \\minus \\frac{6|e_{x}|}{B} \\minus \\frac{6|e_{y}|}{L}\\right)',sub:'\\frac{'+sfrN(r.P)+'}{'+sfrN(R.B)+'\\cdot'+sfrN(R.L)+'}\\left(1 \\minus '+sfrN(6*Math.abs(r.ex)/R.B,3)+' \\minus '+sfrN(6*Math.abs(r.ey)/R.L,3)+'\\right)',value:bp.qmin,unit:'ksf',d:3});
+  }else if(bp.plane){
+   w.add({id:'qmax',label:'Maximum pressure, no-tension plane q = q_0 + g_x x + g_y y over the contact area',sym:'q_{max}',eq:'q_{0} + g_{x} x_{c} + g_{y} y_{c}',sub:'q_{0} = '+sfrN(bp.plane.q0,3)+',\\; g_{x} = '+sfrN(bp.plane.gx,4)+',\\; g_{y} = '+sfrN(bp.plane.gy,4),value:bp.qmax,unit:'ksf',d:3,note:'solved so that the pressure on the contact area equilibrates ΣP and ΣM (rigid footing, no tension)'});
+   w.add({id:'Ac',label:'Contact area / footing area',sym:'A_{c}/A',eq:'',sub:'',value:100*(bp.contactFrac||0),unit:'%',d:1});
+  }
+  const bearItem={type:'steps',scope:'brg',see:'res',steps:w.steps,title:'Base pressure, '+G.cb.name};
+  subs.push({title:'Base pressure (governing combination)',items:[bearItem,{type:'note',text:'Resultant and eccentricities: [[res/P]], [[res/ex]]. q_max is reported for information and for the structural design; '+(state.soil.mode==='vesic'&&!R.directMode?'the bearing check uses the effective-area method (§3.2).':'the bearing check is in §3.2.')}]});
+  /* allowable bearing and the check */
+  const c=G.cap, T=[];
+  if(c&&c.direct){
+   T.push({title:'Allowable bearing (direct)',ref:'geotechnical input',steps:[SharedSteps.step({id:'qa',label:'Allowable bearing pressure ('+state.soil.qaBasis+')',sym:'q_{a}',eq:'',sub:'',value:c.qa,unit:'ksf'})]});
+   const st=[];
+   if(state.soil.qaBasis==='net')st.push(SharedSteps.step({id:'qsur',label:'Overburden at the base (net basis)',sym:'q_{sur}',eq:'\\gamma_{s} D_{f}\\;(\\gamma^{\\prime}\\text{ below the water table})',sub:'',value:c.qsur,unit:'ksf',d:3}));
+   st.push(SharedSteps.step({id:'qchk',label:'Pressure checked',sym:'q',eq:state.soil.qaBasis==='net'?'q_{max} \\minus q_{sur}':'q_{max}',sub:state.soil.qaBasis==='net'?sfrN(bp.qmax,3)+' \\minus '+sfrN(c.qsur,3):sfrN(bp.qmax,3),value:c.qcheck,unit:'ksf',d:3}));
+   st.push(SharedSteps.step({id:'DCR',label:'Bearing demand / capacity',sym:'DCR',eq:'\\frac{q}{q_{a}}',sub:'\\frac{'+sfrN(c.qcheck,3)+'}{'+sfrN(c.qa)+'}',value:G.DCR,unit:'',d:3,ok:G.DCR<=1+1e-9,ref:R.directMode?'factored envelope vs allowable (conservative)':'ASCE 7-16 §2.4.1 service loads'}));
+   T.push({title:'Bearing check',ref:'',steps:st});
+  }else if(c&&!c.fail){
+   const S=(o)=>SharedSteps.step(o), ph=sfrN(R.phiDeg,1)+'^{\\circ}';
+   T.push({title:'Effective footing (Meyerhof)',ref:'Meyerhof (1953)',steps:[
+    S({id:'Bp',label:'Effective width',sym:'B^{\\prime}',eq:'B \\minus 2|e_{x}|',sub:sfrN(R.B)+' \\minus 2\\cdot'+sfrN(Math.abs(r.ex),3),value:c.Bp,unit:'ft',d:3}),
+    S({id:'Lp',label:'Effective length',sym:'L^{\\prime}',eq:'L \\minus 2|e_{y}|',sub:sfrN(R.L)+' \\minus 2\\cdot'+sfrN(Math.abs(r.ey),3),value:c.Lp,unit:'ft',d:3}),
+    S({id:'Ae',label:'Effective area',sym:'A^{\\prime}',eq:'B^{\\prime} L^{\\prime}',sub:sfrN(c.Bp,3)+'\\cdot'+sfrN(c.Lp,3),value:c.Ae,unit:'ft^{2}'})]});
+   T.push({title:'Bearing capacity factors',ref:'Vesić (1973, 1975)',steps:[
+    S({id:'Nq',label:'N_q',sym:'N_{q}',eq:'e^{\\pi \\tan\\phi} \\tan^{2}(45^{\\circ} + \\phi/2)',sub:'\\phi = '+ph,value:c.Nq,unit:'',d:3}),
+    S({id:'Nc',label:'N_c',sym:'N_{c}',eq:R.phiDeg>1e-6?'\\frac{N_{q} \\minus 1}{\\tan\\phi}':'5.14',sub:R.phiDeg>1e-6?'\\frac{'+sfrN(c.Nq,3)+' \\minus 1}{'+sfrN(c.tphi,4)+'}':'',value:c.Nc,unit:'',d:3}),
+    S({id:'Ng',label:'N_γ',sym:'N_{\\gamma}',eq:'2 (N_{q} + 1) \\tan\\phi',sub:'2\\cdot('+sfrN(c.Nq,3)+' + 1)\\cdot'+sfrN(c.tphi,4),value:c.Ng,unit:'',d:3})]});
+   const bl=c.Beff/c.Leff;
+   T.push({title:'Shape, depth and inclination factors',ref:'Vesić; AASHTO LRFD 10th Ed. Art. 10.6.3.1.2a (m, use of depth factors)',steps:[
+    S({id:'sc',label:'Shape factor s_c',sym:'s_{c}',eq:'1 + \\frac{B_{eff}}{L_{eff}}\\frac{N_{q}}{N_{c}}',sub:'1 + '+sfrN(bl,3)+'\\cdot\\frac{'+sfrN(c.Nq,3)+'}{'+sfrN(c.Nc,3)+'}',value:c.sc,unit:'',d:3}),
+    S({id:'sq',label:'Shape factor s_q',sym:'s_{q}',eq:'1 + \\frac{B_{eff}}{L_{eff}}\\tan\\phi',sub:'1 + '+sfrN(bl,3)+'\\cdot'+sfrN(c.tphi,4),value:c.sq,unit:'',d:3}),
+    S({id:'sg',label:'Shape factor s_γ',sym:'s_{\\gamma}',eq:'1 \\minus 0.4\\frac{B_{eff}}{L_{eff}}',sub:'1 \\minus 0.4\\cdot'+sfrN(bl,3),value:c.sg,unit:'',d:3}),
+    S({id:'dq',label:'Depth factor d_q'+(c.useD?'':' (option off: d = 1)'),sym:'d_{q}',eq:c.useD?'1 + 2\\tan\\phi(1 \\minus \\sin\\phi)^{2} k':'1',sub:c.useD?'k = '+sfrN(c.kk,3):'',value:c.dq,unit:'',d:3}),
+    S({id:'dc',label:'Depth factor d_c',sym:'d_{c}',eq:c.useD?'d_{q} \\minus \\frac{1 \\minus d_{q}}{N_{c}\\tan\\phi}':'1',sub:'',value:c.dc,unit:'',d:3}),
+    S({id:'m',label:'Inclination exponent (by load direction θ)',sym:'m',eq:'m_{x}\\cos^{2}\\theta + m_{y}\\sin^{2}\\theta',sub:'m_{x} = '+sfrN(c.mxm,3)+',\\; m_{y} = '+sfrN(c.mym,3),value:c.m,unit:'',d:3}),
+    S({id:'iq',label:'Inclination factor i_q',sym:'i_{q}',eq:'\\left(1 \\minus \\frac{H}{V + A^{\\prime} c / \\tan\\phi}\\right)^{m}',sub:'H = '+sfrN(c.H)+',\\; V = '+sfrN(c.V),value:c.iq,unit:'',d:3}),
+    S({id:'ig',label:'Inclination factor i_γ',sym:'i_{\\gamma}',eq:'(\\ldots)^{m+1}',sub:'',value:c.ig,unit:'',d:3}),
+    S({id:'ic',label:'Inclination factor i_c',sym:'i_{c}',eq:'i_{q} \\minus \\frac{1 \\minus i_{q}}{N_{c}\\tan\\phi}',sub:'',value:c.ic,unit:'',d:3})]});
+   T.push({title:'Ultimate and allowable bearing',ref:'Vesić general equation',steps:[
+    S({id:'q',label:'Overburden at the base (groundwater case '+c.gwCase+')',sym:'q',eq:'\\gamma D_{f}\\;(\\gamma^{\\prime}\\text{ below the water table})',sub:'',value:c.q_sur,unit:'ksf',d:3}),
+    S({id:'geff',label:'Effective unit weight below the base',sym:'\\gamma_{eff}',eq:'',sub:'',value:c.g_eff,unit:'kcf',d:4}),
+    S({id:'qult',label:'Ultimate bearing capacity',sym:'q_{ult}',eq:'c N_{c} s_{c} d_{c} i_{c} + q N_{q} s_{q} d_{q} i_{q} + \\frac{1}{2}\\gamma_{eff} B_{eff} N_{\\gamma} s_{\\gamma} i_{\\gamma}',sub:sfrN(c.T1,3)+' + '+sfrN(c.T2,3)+' + '+sfrN(c.T3,3),value:c.qult,unit:'ksf',d:3}),
+    S({id:'qall',label:'Allowable bearing'+(c.override?' (user override; computed '+sfrN(c.qallComputed,3)+' ksf)':''),sym:'q_{allow}',eq:c.override?'q_{allow,user}':'\\frac{q_{ult}}{FS}',sub:c.override?'':'\\frac{'+sfrN(c.qult,3)+'}{'+sfrN(R.FSb)+'}',value:c.qall,unit:'ksf',d:3})]});
+   T.push({title:'Bearing check (effective-area uniform pressure)',ref:R.directMode?'factored envelope vs allowable (conservative)':'ASCE 7-16 §2.4.1 service loads',steps:[
+    S({id:'qeff',label:'Effective-area pressure',sym:'q_{eff}',eq:'\\frac{V}{A^{\\prime}}',sub:'\\frac{'+sfrN(c.V)+'}{'+sfrN(c.Ae)+'}',value:c.qeff,unit:'ksf',d:3}),
+    S({id:'DCR',label:'Bearing demand / capacity',sym:'DCR',eq:'\\frac{q_{eff}}{q_{allow}}',sub:'\\frac{'+sfrN(c.qeff,3)+'}{'+sfrN(c.qall,3)+'}',value:G.DCR,unit:'',d:3,ok:G.DCR<=1+1e-9})]});
+  }
+  if(T.length)subs.push({title:'Allowable bearing and bearing check',items:[sfrTopics('cap',T,{title:'Governing combination: '+G.cb.name})]});
+  subs.push({title:'Bearing, every combination',items:[{type:'table',wide:true,head:['Combination','ΣP (kip)','e_x (ft)','e_y (ft)','q_max (ksf)','contact (%)','DCR'],
+   rows:R.asd.map(a=>({cells:[a.cb.name,sfrCell(a.r.P),sfrCell(a.r.ex,3),sfrCell(a.r.ey,3),sfrCell(a.bear.qmax,3),sfrCell(100*(a.bear.contactFrac!==undefined?a.bear.contactFrac:1),1),sfrDC(a.DCR)],cls:a===G?'gov':''}))},
+   {type:'note',text:'The governing row (bold) is worked in §3.1 and §3.2; every row follows the same procedure.'}]});
+  secs.push({title:'Bearing',subs});
+ }
+ /* ---------- 4. Stability ---------- */
+ {
+  const subs=[], S=o=>SharedSteps.step(o), FSot=num(state.stab.FSot), FSsl=num(state.stab.FSsl), FSfl=num(state.stab.FSfl);
+  const E=R.eccChk;
+  if(E&&E.gov){
+   subs.push({title:'Eccentricity limit',items:[{type:'steps',scope:'ecc',steps:[
+    S({id:'lim',label:'Limits: '+sfrPlain(E.lab),sym:'e_{x,lim}',eq:'f\\,B',sub:sfrN(E.f,3)+'\\cdot'+sfrN(R.B),value:E.limX,unit:'ft',d:3,ref:sfrPlain(E.ref),note:'e_y,lim = f L = '+sfrN(E.limY,3)+' ft'}),
+    S({id:'DCR',label:'Governing: '+E.gov.name,sym:'DCR',eq:'\\max\\left(\\frac{|e_{x}|}{f B}, \\frac{|e_{y}|}{f L}\\right)',sub:'|e_{x}| = '+sfrN(Math.abs(E.gov.ex),3)+',\\; |e_{y}| = '+sfrN(Math.abs(E.gov.ey),3),value:E.gov.dcr,unit:'',d:3,ok:!!E.ok})]}]});
+  }
+  const st=[], fr=[];
+  if(state.stab.muMode==='phi')fr.push(S({id:'mu',label:'Base friction coefficient',sym:'\\mu',eq:'\\tan(\\tfrac{2}{3}\\phi)'.replace('\\tfrac','\\frac'),sub:'\\tan(\\frac{2}{3}\\cdot'+sfrN(R.phiDeg,1)+'^{\\circ})',value:R.mu,unit:'',d:3,ref:'δ = 2/3 φ (cast on soil)'}));
+  else fr.push(S({id:'mu',label:'Base friction coefficient (input)',sym:'\\mu',eq:'',sub:'',value:R.mu,unit:'',d:3}));
+  fr.push(S({id:'PpX',label:'Passive resistance on the x-faces',sym:'P_{p,x}',eq:'f_{p}\\,\\frac{1}{2} K_{p} \\gamma_{s} D_{f}^{2} L',sub:sfrN(R.pf)+'\\cdot\\frac{1}{2}\\cdot'+sfrN(R.Kp,3)+'\\cdot'+sfrN(R.gs,3)+'\\cdot'+sfrN(R.Df)+'^{2}\\cdot'+sfrN(R.L),value:R.PpX,unit:'kip',ref:'Rankine K_p'}));
+  const sl=(a,dir,FS,H,Pp)=>[S({id:'FS'+dir,label:'Sliding FS, '+(dir==='r'?'horizontal resultant':dir+'-direction')+', '+a.cb.name,sym:'FS_{sl,'+dir+'}',eq:'\\frac{\\mu \\sum P + P_{p}}{|\\sum H|}',sub:'\\frac{'+sfrN(R.mu,3)+'\\cdot'+sfrN(Math.max(a.r.P,0))+' + '+sfrN(Pp)+'}{'+sfrN(Math.abs(H))+'}',value:FS,unit:'',d:2}),
+   S({id:'DC'+dir,label:'Demand / capacity (target FS '+sfrN(FSsl)+')',sym:'D/C',eq:'\\frac{FS_{target}}{FS_{sl}}',sub:'\\frac{'+sfrN(FSsl)+'}{'+sfrN(FS)+'}',value:FSsl/FS,unit:'',d:3,ok:FS>=FSsl-1e-9})];
+  if(isFinite(R.govSlx.FSslx))st.push(...sl(R.govSlx,'x',R.govSlx.FSslx,R.govSlx.r.Hx,R.PpX));
+  if(isFinite(R.govSly.FSsly))st.push(...sl(R.govSly,'y',R.govSly.FSsly,R.govSly.r.Hy,R.PpY));
+  if(isFinite(R.govSlr.FSslr))st.push(...sl(R.govSlr,'r',R.govSlr.FSslr,R.govSlr.Hres,R.govSlr.PpR));
+  const ot=R.govOT.otMin, otS=[S({id:'Mr',label:'Resisting moment about edge '+ot.name+', '+R.govOT.cb.name,sym:'M_{r}',eq:'\\sum W_{i} a_{i}^{+} + |M_{app}^{\\minus}|',sub:'',value:ot.Mr,unit:'kip-ft'}),
+   S({id:'Mo',label:'Overturning moment',sym:'M_{o}',eq:'\\sum |W_{i} a_{i}^{\\minus}| + M_{app}^{+}',sub:'',value:ot.Mo,unit:'kip-ft'}),
+   S({id:'FS',label:'Overturning factor of safety',sym:'FS_{OT}',eq:'\\frac{M_{r}}{M_{o}}',sub:'\\frac{'+sfrN(ot.Mr)+'}{'+sfrN(ot.Mo)+'}',value:ot.FS,unit:'',d:2,note:R.otGate?'':'reported only (the overturning FS does not gate the result; input)'})];
+  if(R.otGate&&isFinite(ot.FS))otS.push(S({id:'DC',label:'Demand / capacity (target FS '+sfrN(FSot)+')',sym:'D/C',eq:'\\frac{FS_{target}}{FS_{OT}}',sub:'\\frac{'+sfrN(FSot)+'}{'+sfrN(ot.FS)+'}',value:FSot/ot.FS,unit:'',d:3,ok:ot.FS>=FSot-1e-9}));
+  const T=[{title:'Sliding resistance parameters',ref:'',steps:fr},{title:'Sliding',ref:'FS target '+sfrN(FSsl),steps:st},{title:'Overturning (governing edge)',ref:'arm = '+ot.armLabel,steps:otS}];
+  if(R.flot)T.push({title:'Flotation',ref:'FS target '+sfrN(FSfl),steps:[S({id:'FSfl',label:'Flotation factor of safety',sym:'FS_{fl}',eq:'\\frac{W_{f} + \\sum W_{ped} + EV}{U}',sub:'\\frac{'+sfrN(R.Wf)+' + '+sfrN(R.Wpeds.reduce((a,b)=>a+b,0))+' + '+sfrN(R.EV)+'}{'+sfrN(R.U)+'}',value:R.flot.FS,unit:'',d:2}),
+    S({id:'DCfl',label:'Demand / capacity',sym:'D/C',eq:'\\frac{FS_{target}}{FS_{fl}}',sub:'\\frac{'+sfrN(FSfl)+'}{'+sfrN(R.flot.FS)+'}',value:FSfl/R.flot.FS,unit:'',d:3,ok:R.flot.FS>=FSfl-1e-9})]});
+  if(R.rig&&R.rig.lam!=null)T.push({title:'Rigid-footing verification',ref:'Bowles: λℓ ≤ π/4',steps:[
+   S({id:'lam',label:'Characteristic (beam on elastic foundation)',sym:'\\lambda',eq:'\\left(\\frac{3 k_{s}}{E_{c} t^{3}}\\right)^{1/4}',sub:'\\left(\\frac{3\\cdot'+sfrN(R.rig.ks_kcf)+'}{'+sfrN(R.rig.Ec_ksf,0)+'\\cdot'+sfrN(R.t)+'^{3}}\\right)^{1/4}',value:R.rig.lam,unit:'ft^{-1}',d:4}),
+   S({id:'rig',label:'Rigidity, governing direction',sym:'\\lambda \\ell / (\\pi/4)',eq:'\\frac{\\max(\\lambda \\ell_{x}, \\lambda \\ell_{y})}{0.785}',sub:'\\frac{\\max('+sfrN(R.rig.vx,3)+', '+sfrN(R.rig.vy,3)+')}{'+sfrN(R.rig.limit,3)+'}',value:Math.max(R.rig.vx,R.rig.vy)/R.rig.limit,unit:'',d:3,ok:!!R.rig.rigid})]});
+  subs.push({title:'Sliding, overturning, flotation and rigidity',items:[sfrTopics('stab',T),{type:'note',text:'ΣP, ΣH of each combination: §2.2. Sliding and overturning use the service combinations, with the minimum-dead 0.6D cases.'}]});
+  secs.push({title:'Stability',subs});
+ }
+ /* ---------- 5. Footing design ---------- */
+ if(P2&&!P2.noCombo){
+  const subs=[], S=o=>SharedSteps.step(o), tin=R.t*12, cvB=num(state.mat.coverBot), cvT=num(state.mat.coverTop);
+  const dbx=BAR_DIA[state.freinf.botX.size||8], dby=BAR_DIA[state.freinf.botY.size||8];
+  subs.push({title:'Design basis and effective depths',items:[{type:'steps',scope:'fd',steps:[
+   S({id:'dx',label:'Effective depth, bottom x-bars (on top of the y-bars)',sym:'d_{x}',eq:'12 t \\minus c_{bot} \\minus \\frac{d_{b,x}}{2} \\minus d_{b,y}',sub:sfrN(tin)+' \\minus '+sfrN(cvB)+' \\minus '+sfrN(dbx/2,3)+' \\minus '+sfrN(dby,3),value:P2.dBotX,unit:'in',d:3}),
+   S({id:'dy',label:'Effective depth, bottom y-bars',sym:'d_{y}',eq:'12 t \\minus c_{bot} \\minus \\frac{d_{b,y}}{2}',sub:sfrN(tin)+' \\minus '+sfrN(cvB)+' \\minus '+sfrN(dby/2,3),value:P2.dBotY,unit:'in',d:3}),
+   S({id:'davg',label:'Average depth (two-way shear)',sym:'d_{avg}',eq:'\\frac{d_{x} + d_{y}}{2}',sub:'\\frac{'+sfrN(P2.dBotX,3)+' + '+sfrN(P2.dBotY,3)+'}{2}',value:P2.dAvg,unit:'in',d:3})]},
+   {type:'note',text:'Strength (LRFD) combinations (§2.3). The net factored pressure is solved for each combination on a rigid footing with no-tension soil from the pedestal loads (axial, applied moments, V·h couples and P·e from load offsets) and the body forces; moments and shears at each critical section are integrated from that pressure solid. Capacities per foot of width, A_s = 12 A_b / s (§1.4). Shear and moment diagrams: [[tab:footdes|Footing Design tab]].'}]});
+  ['x','y'].forEach(dir=>{
+   const des=dir==='x'?P2.desX:P2.desY, k='fd'+dir, cb=des.capBot, mt=dir==='x'?state.freinf.botX:state.freinf.botY;
+   const T=[];
+   const fl=[S({id:'Mu',label:'Factored moment, bottom (envelope; total over the width '+sfrN(des.wperp)+' ft)',sym:'M_{u}',eq:'',sub:'',value:des.MuPos,unit:'kip-ft',note:des.govPos?'governing combination: '+des.govPos.cb.name+' at '+dir+' = '+sfrN(des.govMloc,3)+' ft':''}),
+    S({id:'As',label:'Bottom steel across the width',sym:'A_{s}',eq:'A_{s}/\\text{ft} \\cdot w',sub:sfrN(des.AsBot,3)+'\\cdot'+sfrN(des.wperp),value:cb.As,unit:'in^{2}',d:3}),
+    S({id:'a',label:'Depth of the stress block',sym:'a',eq:'\\frac{A_{s} f_{y}}{0.85 '+SFR_FC+' b}',sub:'\\frac{'+sfrN(cb.As,3)+'\\cdot'+sfrN(P2.fy,0)+'}{0.85\\cdot'+sfrN(P2.fc,0)+'\\cdot'+sfrN(des.wperp*12,1)+'}',value:cb.a,unit:'in',d:3}),
+    S({id:'phi',label:'Strength reduction factor (by ε_t = '+sfrN(cb.eps_t,4)+')',sym:'\\phi',eq:'',sub:'',value:cb.phi,unit:'',d:3,ref:'ACI 318-19 Table 21.2.2'}),
+    S({id:'phiMn',label:'Design flexural strength',sym:'\\phi M_{n}',eq:'\\phi A_{s} f_{y} (d \\minus a/2)',sub:sfrN(cb.phi,3)+'\\cdot'+sfrN(cb.As,3)+'\\cdot'+sfrN(P2.fy/1000,0)+'\\cdot('+sfrN(des.dBot,3)+' \\minus '+sfrN(cb.a/2,3)+')/12',value:cb.phiMn/12,unit:'kip-ft',ref:'ACI 318-19 22.3'}),
+    S({id:'DCRb',label:'Flexure, bottom: demand / capacity',sym:'DCR',eq:'\\frac{M_{u}}{\\phi M_{n}}',sub:'\\frac{'+sfrN(des.MuPos)+'}{'+sfrN(cb.phiMn/12)+'}',value:des.dcrBot,unit:'',d:3,ok:des.dcrBot<=1+1e-9})];
+    if(des.MuNeg>0.01){
+     fl.push(S({id:'MuN',label:'Factored moment, top (hogging)',sym:'M_{u}^{\\minus}',eq:'',sub:'',value:des.MuNeg,unit:'kip-ft',note:des.govNeg?'governing combination: '+des.govNeg.cb.name:''}));
+     if(des.topProvided)fl.push(S({id:'DCRt',label:'Flexure, top: demand / capacity',sym:'DCR',eq:'\\frac{M_{u}^{\\minus}}{\\phi M_{n,top}}',sub:'\\frac{'+sfrN(des.MuNeg)+'}{'+sfrN(des.capTop.phiMn/12)+'}',value:des.dcrTop,unit:'',d:3,ok:des.dcrTop<=1+1e-9}));
+     else fl.push(S({id:'AsTreq',label:'Top steel required (no top mat entered: provide top bars)',sym:'A_{s,top,req}',eq:'',sub:'',value:Math.max(des.reqTop,des.AsMinPerFt),unit:'in^{2}/ft',d:3,note:'A_s,req for M_u⁻ = '+sfrN(des.reqTop,3)+' in²/ft, not less than A_s,min'}));
+    }
+   T.push({title:'Flexure',ref:'ACI 318-19 22.3, 21.2.2',steps:fl});
+   T.push({title:'Minimum steel',ref:'ACI 318-19 7.6.1.1, 24.4.3.2',steps:[
+    S({id:'Asmin',label:'Shrinkage and temperature minimum',sym:'A_{s,min}',eq:'0.0018 \\cdot 12 h',sub:'0.0018\\cdot 12\\cdot'+sfrN(tin),value:des.AsMinPerFt,unit:'in^{2}/ft',d:3}),
+    S({id:'Asprov',label:'Provided, bottom (per ft)',sym:'A_{s,prov}',eq:'\\ge A_{s,min}',sub:sfrN(des.AsBot,3)+(des.asMinBotOK?' \\ge ':' \\lt ')+sfrN(des.AsMinPerFt,3),value:des.AsBot,unit:'in^{2}/ft',d:3,ok:!!des.asMinBotOK}),
+    ...(des.asMinTopReq&&des.topProvided?[S({id:'AsTprov',label:'Provided, top (a flexural mat: hogging)',sym:'A_{s,top}',eq:'\\ge A_{s,min}',sub:sfrN(des.AsTop,3)+(des.asMinTopOK?' \\ge ':' \\lt ')+sfrN(des.AsMinPerFt,3),value:des.AsTop,unit:'in^{2}/ft',d:3,ok:!!des.asMinTopOK})]:[])]});
+   T.push({title:'Bar spacing',ref:'ACI 318-19 7.7.2.3, 13.3.4',steps:[
+    S({id:'smax',label:'Maximum spacing',sym:'s_{max}',eq:'\\min(3h,\\, 18)',sub:'\\min(3\\cdot'+sfrN(tin)+',\\,18)',value:des.sMax,unit:'in'}),
+    S({id:'s',label:'Bottom bars: #'+(mt.size||0)+' at s',sym:'s',eq:'\\le s_{max}',sub:sfrN(des.spcBot)+(des.spcBotOK?' \\le ':' \\gt ')+sfrN(des.sMax),value:des.spcBot,unit:'in',ok:!!des.spcBotOK}),
+    ...(des.asMinTopReq&&des.AsTop>0?[S({id:'sT',label:'Top bars at s',sym:'s_{top}',eq:'\\le s_{max}',sub:sfrN(des.spcTop)+(des.spcTopOK?' \\le ':' \\gt ')+sfrN(des.sMax),value:des.spcTop,unit:'in',ok:!!des.spcTopOK})]:[])]});
+   if(des.oneWayOutside)T.push({title:'One-way shear',ref:'ACI 318-19 8.5.3, 22.5',steps:[S({id:'vna',label:'Critical section at d from every face falls outside the footing',sym:'V_{u}',eq:'',sub:'',value:'not applicable'})]});
+   else T.push({title:'One-way shear',ref:des.vcOverride?'override 2λ√f′c (not ACI Table 22.5.5.1(c))':'ACI 318-19 Table 22.5.5.1(c), 22.5.5.1.3',steps:[
+    S({id:'rho',label:'Flexural steel ratio',sym:'\\rho_{w}',eq:'\\frac{A_{s}}{b d}',sub:'\\frac{'+sfrN(des.AsBot,3)+'}{12\\cdot'+sfrN(des.dBot,3)+'}',value:des.rhoW,unit:'',d:5}),
+    S({id:'lams',label:'Size effect factor',sym:'\\lambda_{s}',eq:'\\min\\left(\\sqrt{\\frac{2}{1 + d/10}},\\,1\\right)',sub:'d = '+sfrN(des.dBot,3),value:des.lam_s,unit:'',d:3}),
+    S({id:'phiVc',label:'Design shear strength',sym:'\\phi V_{c}',eq:des.vcOverride?'0.75\\cdot 2\\lambda_{s}\\lambda\\sqrt{'+SFR_FC+'}\\,b d':'0.75\\cdot 8\\lambda_{s}\\lambda\\rho_{w}^{1/3}\\sqrt{'+SFR_FC+'}\\,b d',
+     sub:'0.75\\cdot'+sfrN(des.vcCoef,3)+'\\cdot'+sfrN(des.lam_s,3)+'\\cdot'+sfrN(P2.lam)+'\\cdot\\sqrt{'+sfrN(Math.min(P2.fc,10000),0)+'}\\cdot'+sfrN(des.wperp*12,1)+'\\cdot'+sfrN(des.dBot,3)+'/1000',value:des.phiV,unit:'kip',note:des.vcCapped?'capped at 5λ√f′c b d':''}),
+    S({id:'Vu',label:'Factored shear at d from the face (envelope)',sym:'V_{u}',eq:'',sub:'',value:des.maxV,unit:'kip',note:des.govV?'governing combination: '+des.govV.cb.name+' at '+dir+' = '+sfrN(des.govVloc,3)+' ft':''}),
+    S({id:'DCRv',label:'One-way shear: demand / capacity',sym:'DCR',eq:'\\frac{V_{u}}{\\phi V_{c}}',sub:'\\frac{'+sfrN(des.maxV)+'}{'+sfrN(des.phiV)+'}',value:des.dcrV,unit:'',d:3,ok:des.dcrV<=1+1e-9})]});
+   const dd=sfdDevData(dir);
+   if(dd&&dd.avail>0)T.push({title:'Development of the bottom bars',ref:'ACI 318-19 25.4.2.4, Table 25.4.2.5',steps:[
+    S({id:'ld',label:'Development length, #'+dd.size,sym:'\\ell_{d}',eq:'\\frac{3}{40}\\frac{f_{y}}{\\lambda\\sqrt{'+SFR_FC+'}}\\frac{\\psi_{t}\\psi_{e}\\psi_{s}\\psi_{g}}{(c_{b} + K_{tr})/d_{b}} d_{b} \\ge 12',
+     sub:'\\frac{3}{40}\\cdot\\frac{'+sfrN(P2.fy,0)+'}{'+sfrN(dd.dv.lam)+'\\cdot'+sfrN(dd.dv.sqfc,2)+'}\\cdot\\frac{'+sfrN(dd.dv.psi_te)+'\\cdot'+sfrN(dd.dv.psi_s)+'\\cdot'+sfrN(dd.dv.psi_g)+'}{'+sfrN(dd.dv.conf,3)+'}\\cdot'+sfrN(dd.dv.db,3),value:dd.dv.Ld,unit:'in',note:'c_b = '+sfrN(dd.dv.cb,3)+' in, K_tr = 0'}),
+    S({id:'avail',label:'Available from the governing section to the edge, less end cover',sym:'\\ell_{avail}',eq:'12(\\tfrac{B}{2} \\minus |x_{sec}|) \\minus c_{end}'.replace('\\tfrac','\\frac'),sub:'12\\cdot('+sfrN(dd.hf,3)+' \\minus '+sfrN(Math.abs(dd.sec),3)+') \\minus '+sfrN(sfdEndCover()),value:dd.avail,unit:'in'}),
+    S({id:'ldok',label:dd.dv.Ld<=dd.avail?'Straight bars develop':'Hooks required',sym:'\\ell_{d}',eq:'\\le \\ell_{avail}',sub:sfrN(dd.dv.Ld)+(dd.dv.Ld<=dd.avail?' \\le ':' \\gt ')+sfrN(dd.avail),value:dd.dv.Ld,unit:'in',ok:dd.dv.Ld<=dd.avail})]});
+   subs.push({title:(dir==='x'?'Longitudinal (x-direction) bars':'Transverse (y-direction) bars')+': flexure, minimum steel, spacing, one-way shear, development',items:[sfrTopics(k,T),
+    {type:'note',text:'Bars in the '+dir+'-direction resist bending about the '+(dir==='x'?'y':'x')+'-axis. Effective depth: [[fd/d'+dir+']]. Moment and shear diagrams: [[tab:footdes|Footing Design tab]].'}]});
+  });
+  /* punching */
+  const PT=[];
+  P2.punch.forEach((pu,i)=>{
+   const sc='pu'+i, d=pu.detail;
+   if(pu.perimOutside||!d){PT.push({title:pu.label,ref:'ACI 318-19 22.6.4',steps:[S({id:sc+'.na',label:'Two-way shear: the d/2 perimeter is outside the footing on both axes',sym:'v_{u}',eq:'',sub:'',value:'not applicable'})]});return;}
+   const st=[S({id:sc+'.bo',label:'Critical perimeter at d/2 ('+pu.pos+')',sym:'b_{0}',eq:'',sub:'c_{1} = '+sfrN(pu.c1,2)+',\\; c_{2} = '+sfrN(pu.c2,2)+',\\; d = '+sfrN(pu.d,3),value:pu.bo,unit:'in'}),
+    S({id:sc+'.vc',label:'Concrete two-way shear stress (least of three)',sym:'v_{c}',eq:'\\min(4,\\; 2 + 4/\\beta,\\; 2 + \\alpha_{s} d/b_{0})\\,\\lambda\\lambda_{s}\\sqrt{'+SFR_FC+'}',sub:'\\min('+sfrN(pu.vc1)+',\\,'+sfrN(pu.vc2)+',\\,'+sfrN(pu.vc3)+')',value:pu.vc,unit:'psi',ref:'ACI 318-19 22.6.5.2',note:'β = '+sfrN(pu.beta)+', α_s = '+pu.alphas+', λ_s = '+sfrN(pu.lam_s,3)}),
+    S({id:sc+'.phivc',label:'Design stress',sym:'\\phi v_{c}',eq:'0.75 v_{c}',sub:'0.75\\cdot'+sfrN(pu.vc),value:pu.phiVc,unit:'psi'}),
+    S({id:sc+'.Vu',label:'Shear on the perimeter, '+(pu.govC?pu.govC.cb.name:''),sym:'V_{u}',eq:'P_{u} \\minus \\int q\\,dA_{crit} + W_{body,crit}',sub:'\\minus '+sfrN(d.relief)+' + '+sfrN(d.bodyIn),value:d.Vu,unit:'kip'}),
+    S({id:sc+'.Mu',label:'Moments transferred at the pedestal base'+((d.lex||d.ley)?' (include P·e: '+sfrN(d.PeMx)+' and '+sfrN(d.PeMy)+' kip-ft)':''),sym:'M_{ux}',eq:'',sub:'',value:d.MuX,unit:'kip-ft',note:'M_uy = '+sfrN(d.MuY)+' kip-ft; γ_v,x = '+sfrN(d.gvX,3)+', γ_v,y = '+sfrN(d.gvY,3)}),
+    S({id:sc+'.vu',label:'Factored shear stress (direct + eccentric shear)',sym:'v_{u}',eq:'\\frac{V_{u}}{b_{0} d} + \\frac{\\gamma_{v,x} M_{uy} c_{x}}{J_{c,x}} + \\frac{\\gamma_{v,y} M_{ux} c_{y}}{J_{c,y}}',sub:sfrN(d.vshear)+' + '+sfrN(d.vmomX)+' + '+sfrN(d.vmomY),value:pu.vuMax,unit:'psi',ref:'ACI 318-19 8.4.4.2'}),
+    S({id:sc+'.DCR',label:'Punching: demand / capacity',sym:'DCR',eq:'\\frac{v_{u}}{\\phi v_{c}}',sub:'\\frac{'+sfrN(pu.vuMax)+'}{'+sfrN(pu.phiVc)+'}',value:pu.dcr,unit:'',d:3,ok:pu.dcr<=1+1e-9})];
+   PT.push({title:pu.label,ref:'ACI 318-19 22.6, 8.4.4.2',steps:st});
+  });
+  subs.push({title:'Two-way (punching) shear',items:[sfrTopics('pun',PT),{type:'note',text:'d = d_avg ([[fd/davg]]). P_u and the moments are the factored pedestal actions of the governing combination; P·e from load offsets is part of the transferred moment.'+(P2.punchWarn.length?' Overlapping perimeters: '+P2.punchWarn.join(', ')+' (check a grouped perimeter by hand).':'')}]});
+  /* concrete bearing and dowels */
+  const BT=[];
+  P2.bearing.forEach((bz,i)=>{const sc='cb'+i, st=[
+   S({id:sc+'.A1',label:'Loaded area',sym:'A_{1}',eq:'b_{x} b_{y}',sub:sfrN(R.peds[i].bx*12,1)+'\\cdot'+sfrN(R.peds[i].by*12,1),value:bz.A1,unit:'in^{2}',d:1}),
+   S({id:sc+'.conf',label:'Confinement ('+bz.confGov+')',sym:'\\sqrt{A_{2}/A_{1}}',eq:'\\le 2',sub:'',value:bz.conf,unit:'',d:3}),
+   S({id:sc+'.phiPn',label:'Design bearing strength',sym:'\\phi B_{n}',eq:'0.65\\cdot 0.85 '+SFR_FC+' A_{1}\\sqrt{A_{2}/A_{1}}',sub:'0.65\\cdot 0.85\\cdot'+sfrN(P2.fc,0)+'\\cdot'+sfrN(bz.A1,1)+'\\cdot'+sfrN(bz.conf,3)+'/1000',value:bz.phiPn,unit:'kip',ref:'ACI 318-19 22.8.3.2'}),
+   S({id:sc+'.DCR',label:'Concrete bearing: demand / capacity',sym:'DCR',eq:'\\frac{P_{u}}{\\phi B_{n}}',sub:'\\frac{'+sfrN(bz.PuMax)+'}{'+sfrN(bz.phiPn)+'}',value:bz.dcr,unit:'',d:3,ok:bz.dcr<=1+1e-9})];
+   if(!bz.isPatch)st.push(
+    S({id:sc+'.dow',label:'Dowels: '+(state.peds[i].reinf.dowelN||0)+' #'+bz.dSize+' vs 0.005 A_g',sym:'A_{s,dow}',eq:'\\ge 0.005 A_{g}',sub:sfrN(bz.AsDowProv)+(bz.dowelOK?' \\ge ':' \\lt ')+sfrN(bz.AsDowMin),value:bz.AsDowProv,unit:'in^{2}',ok:!!bz.dowelOK,ref:'ACI 318-19 16.3.4.1'}),
+    S({id:sc+'.ldc',label:'Dowel compression development into the footing',sym:'\\ell_{dc}',eq:'\\le t \\minus c_{bot} \\minus d_{b,x} \\minus d_{b,y}',sub:sfrN(bz.Ldc)+(bz.ldcOK?' \\le ':' \\gt ')+sfrN(bz.availEmb),value:bz.Ldc,unit:'in',ok:!!bz.ldcOK,ref:'ACI 318-19 25.4.9.2'}));
+   BT.push({title:bz.label+(bz.isPatch?' (bearing patch)':''),ref:'',steps:st});});
+  subs.push({title:'Concrete bearing and dowels at the pedestals',items:[sfrTopics('cbr',BT)]});
+  const bc=P2.bandChk;
+  if(bc&&bc.applies)subs.push({title:'Short-direction band reinforcement (advisory)',items:[{type:'steps',scope:'band',steps:[
+   S({id:'gs',label:'Banded fraction',sym:'\\gamma_{s}',eq:'\\frac{2}{\\beta + 1}',sub:'\\frac{2}{'+sfrN(bc.beta,3)+' + 1}',value:bc.gs,unit:'',d:3,ref:'ACI 318-19 13.3.3.3'}),
+   S({id:'req',label:'Steel required in the '+sfrN(bc.shortDim)+' ft band',sym:'\\gamma_{s} A_{s}',eq:'',sub:sfrN(bc.gs,3)+'\\cdot'+sfrN(bc.AsTot,3),value:bc.AsBandReq,unit:'in^{2}',note:'uniform layout delivers '+sfrN(bc.AsBandProv,3)+' in² in the band'+(bc.ok?'':' (less: concentrate bars in the band)')})]},
+   {type:'note',text:'Advisory: the tool distributes the bars uniformly and takes no band-steel input.'}]});
+  secs.push({title:'Footing design',subs});
+ }else secs.push({title:'Footing design',subs:[{title:'Not computed',items:[{type:'note',warn:true,text:'No valid strength combination produced downward load for the structural design.'}]}]});
+ /* ---------- 6. Pedestal design ---------- */
+ if(P2&&!P2.noCombo){
+  const subs=[], S=o=>SharedSteps.step(o);
+  P2.pedDes.forEach((pd,i)=>{
+   const rf=state.peds[i].reinf, T=[];
+   if(pd.isPatch){subs.push({title:pd.label+' (bearing patch, h = 0)',items:[{type:'note',text:'A zero-height element is a bearing patch, not a member: no member checks (Chapter 10). Its load and bearing are in §5.'}]});return;}
+   T.push({title:'Longitudinal steel',ref:'ACI 318-19 10.6.1.1, 10.7.3.1, 25.2.3',steps:[
+    S({id:'Ast',label:pd.nBars+' #'+rf.longSize+' (perimeter, '+rf.nx+' per x-face, '+rf.ny+' per y-face)',sym:'A_{st}',eq:'n A_{b}',sub:pd.nBars+'\\cdot'+sfrN(BAR_AREA[rf.longSize||0]),value:pd.Ast,unit:'in^{2}'}),
+    S({id:'rho',label:'Steel ratio ('+(pd.isPedestal?'pedestal: upper limit 8% only':'column: 1% to 8%')+')',sym:'\\rho_{g}',eq:'\\frac{A_{st}}{A_{g}}',sub:'\\frac{'+sfrN(pd.Ast)+'}{'+sfrN(pd.Ag,1)+'}',value:pd.rho,unit:'',d:4,ok:!!pd.rhoOK}),
+    S({id:'fit',label:'Bars and clear spacing (n ≥ 4; s_clear ≥ max(1.5 d_b, 1.5 in) = '+sfrN(pd.clrMin)+' in)',sym:'s_{clear}',eq:'',sub:'s_{clear,x} = '+sfrN(pd.clrX)+',\\; s_{clear,y} = '+sfrN(pd.clrY),value:Math.min(pd.clrX,pd.clrY),unit:'in',ok:!!(pd.nBarsOK&&pd.barFitOK)})]});
+   T.push({title:'Axial strength',ref:'ACI 318-19 22.4.2.1, 10.5.2',steps:[
+    S({id:'P0',label:'Nominal axial strength',sym:'P_{0}',eq:'0.85 '+SFR_FC+' (A_{g} \\minus A_{st}) + f_{y} A_{st}',sub:'(0.85\\cdot'+sfrN(pd.fc,0)+'\\cdot('+sfrN(pd.Ag,1)+' \\minus '+sfrN(pd.Ast)+') + '+sfrN(pd.fy,0)+'\\cdot'+sfrN(pd.Ast)+')/1000',value:pd.P0,unit:'kip'}),
+    S({id:'phiPn',label:'Maximum design axial strength (tied)',sym:'\\phi P_{n,max}',eq:'0.65\\cdot 0.80 P_{0}',sub:'0.65\\cdot 0.80\\cdot'+sfrN(pd.P0),value:pd.phiPn_max,unit:'kip'}),
+    S({id:'Pu',label:'Factored axial load (envelope; incl. pedestal self-weight)',sym:'P_{u}',eq:'',sub:'',value:pd.PuMax,unit:'kip'}),
+    S({id:'DCR',label:'Axial: demand / capacity',sym:'DCR',eq:'\\frac{P_{u}}{\\phi P_{n,max}}',sub:'\\frac{'+sfrN(pd.PuMax)+'}{'+sfrN(pd.phiPn_max)+'}',value:pd.dcrAxial,unit:'',d:3,ok:pd.dcrAxial<=1+1e-9})]});
+   const ms=[S({id:'Mux',label:'Factored moment about x at the pedestal base (envelope)',sym:'M_{ux}',eq:'M_{x,app} + V_{y} h + P_{u,a} e_{y}',sub:'',value:pd.MuxMax,unit:'kip-ft',note:pd.govMx?pd.govMx.name:''}),
+    S({id:'Muy',label:'Factored moment about y at the pedestal base (envelope)',sym:'M_{uy}',eq:'M_{y,app} + V_{x} h + P_{u,a} e_{x}',sub:'',value:pd.MuyMax,unit:'kip-ft',note:pd.govMy?pd.govMy.name:''})];
+   if(pd.govMx&&(pd.govMx.pl.lex||pd.govMx.pl.ley)){const gx=pd.govMx.pl,gy=pd.govMy.pl;
+    ms.push(S({id:'Pey',label:'Load-offset share of M_ux ('+pd.govMx.name+')',sym:'P_{u,a} e_{y}',eq:'',sub:sfrN(gx.Pa)+'\\cdot'+sfrP(gx.ley,3),value:gx.PeMx,unit:'kip-ft'}),
+     S({id:'Pex',label:'Load-offset share of M_uy ('+pd.govMy.name+')',sym:'P_{u,a} e_{x}',eq:'',sub:sfrN(gy.Pa)+'\\cdot'+sfrP(gy.lex,3),value:gy.PeMy,unit:'kip-ft'}));}
+   T.push({title:'Moments (biaxial)',ref:'ACI 318-19 R10.5 (strain compatibility contour)',steps:ms});
+   T.push({title:'Ties and slenderness',ref:'ACI 318-19 25.7.2, 6.2.5',steps:[
+    S({id:'tmax',label:'Tie spacing limit',sym:'s_{max}',eq:'\\min(16 d_{b},\\, 48 d_{b,tie},\\, b_{min})',sub:'\\min(16\\cdot'+sfrN(BAR_DIA[rf.longSize||8],3)+',\\,48\\cdot'+sfrN(BAR_DIA[rf.tieSize||3],3)+',\\,'+sfrN(pd.bmin)+')',value:pd.tieMax,unit:'in'}),
+    S({id:'ties',label:'Ties #'+rf.tieSize+' at s'+(pd.tieSizeOK?'':' (tie bar too small, 25.7.2.2)'),sym:'s',eq:'\\le s_{max}',sub:sfrN(num(rf.tieSpc))+(pd.tieOK?' \\le ':' \\gt ')+sfrN(pd.tieMax),value:num(rf.tieSpc),unit:'in',ok:!!(pd.tieOK&&pd.tieSizeOK)}),
+    S({id:'klr',label:'Slenderness (k = 1, ℓ_u = h, r = 0.3 b_min)',sym:'k \\ell_{u}/r',eq:'\\frac{h}{0.3 b_{min}}',sub:'\\frac{'+sfrN(pd.h)+'}{0.3\\cdot'+sfrN(pd.bmin)+'}',value:pd.klu_r,unit:'',d:2}),
+    S({id:'sl',label:'Slender (k ℓ_u/r > 22: moment magnification needed, not done here)?',sym:'',eq:'',sub:'',value:pd.slenderFlag?'yes':'no',ok:!pd.slenderFlag})]});
+   subs.push({title:pd.label+' ('+(pd.isPedestal?'pedestal':'column')+', '+sfrN(pd.bx,1)+' × '+sfrN(pd.by,1)+' × '+sfrN(pd.h,1)+' in)',items:[sfrTopics('pd'+i,T),
+    {type:'note',text:'Every LRFD combination is plotted against the biaxial capacity contour on the [[tab:peddes|Pedestal Design tab]]. Combination actions: §2.3; dowels and bearing on the footing: [[cbr/cb'+i+'.DCR]].'}]});
+  });
+  secs.push({title:'Pedestal design',subs});
+ }
+ /* ---------- 7. Assumptions ---------- */
+ {
+  const items=[];
+  if(String(state.assump||'').trim())items.push({type:'note',text:'Project assumptions (input): '+String(state.assump).trim()});
+  ['Rigid footing on a compression-only (no-tension) soil; pressures are linear over the contact area (rigidity verified in §4).',
+   'Service (ASD) combinations for bearing and stability; strength (LRFD) combinations for the concrete design (ASCE 7-16 §2.4.1 / §2.3.1).'+(R.directMode?' Direct factored mode: one user envelope with dead-load brackets; stability is indicative.':''),
+   'Horizontal shears act at the top of each pedestal; the couple V·(t + h) is '+(state.stab.shearCouple==='off'?'excluded by input.':'included at the base of the footing.'),
+   'Loads act at the load point of each pedestal (x + e_x, y + e_y); the pedestal transmits them to the footing as P at its centroid and the moments P·e.',
+   'Flexure and shear capacities per foot of width with uniformly spaced bars (A_s = 12 A_b/s); short-direction banding (ACI 13.3.3.3) is advisory.',
+   'No shear reinforcement in the footing (one-way V_c by ACI Table 22.5.5.1(c)).',
+   'Pedestal slenderness is screened only (k = 1, ℓ_u = h); moment magnification is not performed.',
+   'Footing self-weight, soil cover and surcharge carry the dead (or live) factor of each combination; buoyancy is 1.0 in every combination.'].forEach(t=>items.push({type:'note',text:t}));
+  (R.W||[]).forEach(w=>items.push({type:'note',warn:true,text:(w.lvl==='err'?'Error: ':'Warning: ')+sfrPlain(w.msg)}));
+  secs.push({title:'Assumptions and warnings',subs:[{title:'Assumptions',items}]});
+ }
+ /* ---------- 8. References ---------- */
+ secs.push({title:'References',subs:[{title:'Codes and references cited',items:[{type:'table',head:['Reference','Provisions used'],rows:SFD_REFS.map(([a,b])=>[sfrPlain(a),sfrPlain(b)])}]}]});
+ return {title:'Spread Footing Design — Calculation Report',subtitle:m.project||'Untitled',code:'ACI 318-19 · ASCE 7-16 · IBC 2021',
+  info:[['Project',m.project],['Project No.',m.number],['Calculated by',m.calcBy],['Date',m.calcDate],['Checked by',m.chkBy],['Checked date',m.chkDate]],
+  head:{left:'Project No. '+(m.number||'—')+' — '+String(m.project||'—').slice(0,40),right:'Computed: '+(m.calcBy||'—')+' '+(m.calcDate||'')+' · Checked: '+(m.chkBy||'—')+' '+(m.chkDate||''),foot:(m.project||'Untitled')+' (Spread Footing Design Tool)'},
+  sections:secs};
+}
+function renderReport(){
+ const T=document.getElementById('tab-report');if(!T)return;
+ if(!window.SharedReport||!window.SharedSteps){T.innerHTML='<div class="errbox">shared/report.js or shared/steps.js is not loaded: keep the shared folder next to this file.</div>';return;}
+ if(!R||R.fatal){T.innerHTML='<div class="errbox">No results: correct the input errors shown in the Summary.</div>';SFRP.api=null;SFRP.doc=null;return;}
+ let M;
+ try{M=sfrModel();}catch(e){T.innerHTML='<div class="errbox">Report error: '+sfEsc(e&&e.message)+'</div>';SFRP.api=null;SFRP.doc=null;return;}
+ SFRP.api=SharedReport.mount(T,M,{closed:SFRP.closed,onGoto:sfrGoto});
+ SFRP.doc=SFRP.api.doc;
+}
+/* [[tab:…]] links of the report: an output tab, or an input tab (in-…) */
+function sfrGoto(name){
+ if(name.indexOf('in-')===0){sfdGotoInput(name.slice(3),'sec-'+name.slice(3));return;}
+ const b=$$('#tabbar button').find(x=>x.dataset.tab==='tab-'+name);if(b){b.click();window.scrollTo(0,b.getBoundingClientRect().top+window.scrollY-10);}
+}
+/* Ctrl+P while the Report tab is shown prints the report alone (shared/report.js print layout and running header) */
+function sfrPrinting(){return document.body.classList.contains('rp-printing');}
+function sfrWillPrint(){const T=document.getElementById('tab-report');return sfrPrinting()||!!(SFRP.doc&&T&&T.classList.contains('active'));}
+window.addEventListener('beforeprint',()=>{
+ const T=document.getElementById('tab-report');
+ if(!SFRP.doc||!T||!T.classList.contains('active')||sfrPrinting())return;
+ let box=document.getElementById('rp-print');if(!box){box=document.createElement('div');box.id='rp-print';document.body.appendChild(box);}
+ box.innerHTML='<div class="rp"><article class="rp-doc">'+SharedReport.html(SFRP.doc,{lazy:false})+'</article></div>';
+ document.body.classList.add('rp-printing');
+});
+</script>
+<script>
@@ -2861,0 +3236 @@ function recalc(){
+ if($('#tab-report').classList.contains('active'))renderReport();   /* SFRP */
@@ -2888,0 +3264 @@ $('#tabbar').addEventListener('click',e=>{
+ if(b.dataset.tab==='tab-report')renderReport();   /* SFRP */
@@ -2935,0 +3312 @@ window.addEventListener('beforeprint',()=>{
+ if(typeof sfrWillPrint==='function'&&sfrWillPrint())return;   /* SFRP: the Report tab prints itself (shared/report.js) */
@@ -3899,0 +4277,28 @@ function flexureSVG(des,dir){
+/* SFRP: development data of the bottom bars in one direction (bar, ℓ_d detail, governing section, available length);
+   moved out of renderFootingDesign unchanged so the Report tab uses the same values. null when no bars. */
+function sfdDevData(dir){
+ const des=(dir==='x')?P2.desX:P2.desY, size=(dir==='x')?state.freinf.botX.size:state.freinf.botY.size;
+ if(!size)return null;
+  const spcD=(dir==='x')?num(state.freinf.botX.spc):num(state.freinf.botY.spc);
+  const dv=devLength(size,P2.fc,P2.fy,false,{lam:P2.lam,cover:sfdCbCover(),spc:spcD,coating:state.mat.coating,detail:true});
+  const Ld=dv.Ld;
+  /* Available length is measured from the GOVERNING FLEXURAL SECTION to the nearer footing
+     edge, less the end cover. That is the length over which the bar must develop the stress
+     the critical section demands of it (ACI 318-19 25.4.1, 13.2.7).
+     Two earlier attempts were wrong. The first used R.peds[0] unconditionally and could
+     print a NEGATIVE available length. The replacement took "the longest cantilever beyond
+     any bearing face", which on a multi-element footing measures right across the footing
+     INTERIOR - 72 in of span sitting under other bearing elements - and reported 69 in
+     available against a 12 in requirement, passing a check that should have read HOOKS
+     REQUIRED at 9 in. Both were caught only by reading the output, not by any test. */
+  const hf=(dir==='x'?R.B:R.L)/2;
+  let sec=des.govMloc;
+  if(sec===null||sec===undefined){          // no recorded section: fall back to the nearest face
+   let best=null;
+   R.peds.forEach(pz=>{const c=(dir==='x')?pz.x:pz.y, hw=((dir==='x')?pz.bx:pz.by)/2;
+    [c-hw,c+hw].forEach(v=>{if(Math.abs(v)<hf-1e-9&&(best===null||Math.abs(v)>Math.abs(best)))best=v;});});
+   sec=best;
+  }
+  const avail=(sec===null||sec===undefined)?-1:((hf-Math.abs(sec))*12-sfdEndCover());
+ return {size,dv,hf,sec,avail,Ld};
+}
@@ -3976,21 +4381,2 @@ function renderFootingDesign(){
-  const spcD=(dir==='x')?num(state.freinf.botX.spc):num(state.freinf.botY.spc);
-  const dv=devLength(size,P2.fc,P2.fy,false,{lam:P2.lam,cover:sfdCbCover(),spc:spcD,coating:state.mat.coating,detail:true});
-  const Ld=dv.Ld;
-  /* Available length is measured from the GOVERNING FLEXURAL SECTION to the nearer footing
-     edge, less the end cover. That is the length over which the bar must develop the stress
-     the critical section demands of it (ACI 318-19 25.4.1, 13.2.7).
-     Two earlier attempts were wrong. The first used R.peds[0] unconditionally and could
-     print a NEGATIVE available length. The replacement took "the longest cantilever beyond
-     any bearing face", which on a multi-element footing measures right across the footing
-     INTERIOR - 72 in of span sitting under other bearing elements - and reported 69 in
-     available against a 12 in requirement, passing a check that should have read HOOKS
-     REQUIRED at 9 in. Both were caught only by reading the output, not by any test. */
-  const hf=(dir==='x'?R.B:R.L)/2;
-  let sec=des.govMloc;
-  if(sec===null||sec===undefined){          // no recorded section: fall back to the nearest face
-   let best=null;
-   R.peds.forEach(pz=>{const c=(dir==='x')?pz.x:pz.y, hw=((dir==='x')?pz.bx:pz.by)/2;
-    [c-hw,c+hw].forEach(v=>{if(Math.abs(v)<hf-1e-9&&(best===null||Math.abs(v)>Math.abs(best)))best=v;});});
-   sec=best;
-  }
-  const avail=(sec===null||sec===undefined)?-1:((hf-Math.abs(sec))*12-sfdEndCover());
+  const DD=sfdDevData(dir);   /* SFRP: shared with the Report tab (same values) */
+  const dv=DD.dv, Ld=dv.Ld, hf=DD.hf, sec=DD.sec, avail=DD.avail;
```


## 2026-11-01 — PR: claude/sf-rebar-qty — Rebar entered as a spacing or a total quantity, for each footing mat and each pedestal (SFRQ; input form only) (PR link added after merge)

Line numbers are approximate; search for the anchor text. Every code site is tagged `SFRQ`.

### SFRQ. Input method per footing mat and per pedestal   [calculation inputs change form; CLAUDE.md §4]
- **Engineer request (2026-11-01):** "For the reinforcement tab, I want rebar to be entered as either a total qty or a spacing. Allow the user to select the input method for each pedestal and footing."
- **Footing mats** (bottom x, bottom y, top x, top y). Each mat has a selector "Spacing" / "Total qty" (`freinf.<mat>.mode` = `'spacing'` | `'qty'`, `freinf.<mat>.n`). Helper `sfdMat(k)`:
  - **Width:** w is the width across which the bars are spread, the width the design already uses: L for x-bars, B for y-bars.
  - **Cover basis:** c is the side/end cover input (Materials, "Side/end cover, bottom bars"; blank = the bottom cover), the existing `sfdEndCover()`. It is used for every mat.
  - **Spacing (default; unchanged):** A_s/ft = A_b·12/s (`barAreaPerFt(size, spc)`, the same call as before), with s as entered. Bar count shown: n = floor((12w − 2c − d_b)/s) + 1 (display only).
  - **Quantity:** A_s,total = n·A_b; A_s/ft = n·A_b/w. The spacing s = (12w − 2c − d_b)/(n − 1) (corner-bar centre span over n − 1 gaps) is used for the s ≤ s_max check, for c_b and ψ_e of ℓ_d, and for the 3D bars. A warning appears when n < 2.
  - **Used in:**
    - `directionDesign`: `AsBot`, `AsTop` (before: `barAreaPerFt(state.freinf.botX.size, state.freinf.botX.spc)`; after: `sfdMat('botX').As`) and `spcBot`, `spcTop` (before: `num(state.freinf.botX.spc)`; after: `sfdMat('botX').spc`);
    - the γ_f band steel (`AsPerFtX/Y`);
    - `sfdDevData` (`spcD`);
    - `buildRebar` (3D).
- **Pedestals.** The input today is longitudinal bar size, "n along x-face", "n along y-face" (perimeter layout of `pedBarCoords`, n = 2(nx + ny) − 4, corners shared), ties as size + spacing, cover and dowels. A per-pedestal selector "Long. bars entered as" (`reinf.longMode`) is added: `'faces'` (n per face, the current form and the default), `'total'` (`reinf.nTot`), `'spacing'` (`reinf.longSpc`, in, centre to centre along each face). Ties stay as a spacing. Helper `sfdPedBars(i)`:
  - **Corner-bar centre span:** L_c = b − 2·cover − d_b per face, the basis of the existing bar-fit clear-spacing check. `pedBarCoords` places bars at cover to the bar centre; that is an existing difference, not changed, and is listed under open items.
  - **Total N:**
    - An odd N is raised to N + 1, because the perimeter layout is symmetric. N < 4 is raised to 4. Both give a warning.
    - nx + ny = N/2 + 2, split so that the c-c spacings L_cx/(nx − 1) and L_cy/(ny − 1) are as equal as possible. On a tie, fewer bars go on the x-faces.
  - **Spacing s:** bars per face = ceil(L_c/s) + 1 (≥ 2), so the spacing provided does not exceed the spacing entered.
  - **Used in:** `pedDes` (`nBars`, `clrX/Y`, `pmBars`: before `rf.nx`, `rf.ny`; after `PB.nx`, `PB.ny`), the 3D cage, and the report.
- **Shown (entered and derived):**
  - Reinforcement tab: "→ s = 12.71 in" / "→ 13 bars" under each mat, and A_s worked as n·A_b/w or A_b·12/s.
  - Pedestal card: "Longitudinal bars: total 13 #8 → 14 bars (6 per x-face at 6.20 in, 3 per y-face at 6.50 in); odd total raised to 14", with the L_c values.
  - Footing Design 5.1 link line: "bottom x 8 #8 → s = 12.71 in". The 5.2 / 5.3 notes work the quantity conversion.
  - Pedestal Design 6.x: a note with the bars as entered and as laid out.
  - Report §1.4: A_s step (n A_b / w or 12 A_b / s) and the derived spacing step. §1.5 and §6 A_st label: as entered → laid out.
- **Saved data (§5):** `mode` defaults to `'spacing'` and `longMode` to `'faces'` (`defaultState`, `newPed`, and `migrateState` for older saves). Switching the selector fills an empty new field with the equivalent value (spacing → n = derived count; n per face → total = current n; → spacing = the larger current c-c spacing, rounded to 0.5 in).
- **Check cases (hand):**
  - Footing x-bars, L = 8 ft, #8 (A_b = 0.79 in², d_b = 1.0 in), c = 3 in (bottom cover; no side cover entered):
    - spacing 12 in: A_s = 0.79·12/12 = **0.790 in²/ft**, n = floor((96 − 6 − 1)/12) + 1 = floor(7.42) + 1 = **8 bars**;
    - quantity 8: A_s = 8·0.79/8 = **0.790 in²/ft**, s = (96 − 6 − 1)/7 = **12.71 in** (≤ 18 in).
    - Every result of the footing design is identical except the spacing used in s ≤ s_max (12.00 → 12.71 in, both pass). ℓ_d is identical (28.46 in) because c_b = min(c + d_b/2 = 3.5, s/2) is set by the cover.
  - Default #8 @ 9 in: x-bars → floor(89/9) + 1 = 10 bars; y-bars across B = 10 ft → floor(113/9) + 1 = 13 bars.
  - Pedestal 18 × 18 in, cover 2 in, #8: L_c = 18 − 4 − 1 = 13 in.
    - 3 per face (8 bars) = total 8 (nx + ny = 6 → 3 / 3, s = 6.50 in each) = spacing 6.5 in (ceil(13/6.5) + 1 = 3 per face). Identical pedestal design.
    - Spacing 5 in: ceil(2.6) + 1 = 4 per face, 12 bars at 4.33 in.
    - 36 × 18 in pedestal, total 13: raised to 14, split 6 / 3 (6.20 / 6.50 in).
- **How verified (headless Chromium):**
  - origin/main vs the branch on 7 projects: every existing value of `R` and `P2`, the dashboard, warnings and self-consistency are identical. New keys only: `pedDes.PB`, `freinf.*.mode`, `reinf.longMode`.
  - An origin/main save loads with identical results and is migrated to spacing / n per face.
  - The equivalent pairs above compare as stated.
  - The UI mode switch starts at the equivalent value.
  - The Report tab builds on 9 projects (incl. quantity modes): 0 unresolved references, 0 KaTeX errors, spot values equal the app values.
  - 0 console errors. `node tests/check-syntax.mjs` passes.
- **Decision recorded (§9):**
  - The split rule for a total quantity (equalize the c-c spacing on the two faces; odd N raised to the next even number) and the per-face rounding for a spacing (ceil, so the spacing does not exceed the entered value) are the rules stated above. They are layout rules only: the design method is unchanged.
  - Engineer to confirm or name a different rule, e.g. bars in proportion to the face lengths.
- **Open items (not changed):**
  - `pedBarCoords` (P–M strain compatibility) puts the corner bars at cover to the bar **centre**, while the bar-fit check uses cover to the bar **face**. This is an existing difference, raised and not changed (CLAUDE.md §4).
  - The note text "Enter #0 spacing to omit a mat" means bar size #0; it was left as it is.

Diff (`Spread Footing.html`, `git diff -U0` against origin/main):

```diff
diff --git a/Spread Footing.html b/Spread Footing.html
index 7a5de83..7f96751 100644
--- a/Spread Footing.html	
+++ b/Spread Footing.html	
@@ -51,0 +52 @@ table.tbl td:first-child,table.tbl th:first-child{text-align:left}
+table.sfdRbTbl th,table.sfdRbTbl td{padding:3px 4px}   /* SFRQ: Reinforcement tab table fits the input panel */
@@ -338,6 +339,6 @@ a.wkA:hover{text-decoration:underline}
- <div class="note">Bottom mat resists positive (cantilever/sagging) moment; top mat resists negative moment between pedestals. Bars in the x-direction resist bending about the y-axis. Enter #0 spacing to omit a mat. Check-only: the tool reports DCR and required A<sub>s</sub>.</div>
- <table class="tbl sfdRbTbl" style="font-size:11px"><tr><th>Mat</th><th>Bar #</th><th>Spacing s (in)</th><th>A<sub>b</sub> (in&sup2;)</th><th>A<sub>s</sub> = A<sub>b</sub>&middot;12/s (in&sup2;/ft)</th><th>s vs s<sub>max</sub> (in)</th></tr>
- <tr><td>Bottom, x-bars</td><td><select data-path="freinf.botX.size" class="barsel"></select></td><td><input type="number" step="0.5" data-path="freinf.botX.spc" data-num style="width:60px"></td><td class="sfdRbAb" data-mat="botX"></td><td class="sfdRbAs" data-mat="botX"></td><td class="sfdRbS" data-mat="botX"></td></tr>
- <tr><td>Bottom, y-bars</td><td><select data-path="freinf.botY.size" class="barsel"></select></td><td><input type="number" step="0.5" data-path="freinf.botY.spc" data-num style="width:60px"></td><td class="sfdRbAb" data-mat="botY"></td><td class="sfdRbAs" data-mat="botY"></td><td class="sfdRbS" data-mat="botY"></td></tr>
- <tr><td>Top, x-bars</td><td><select data-path="freinf.topX.size" class="barsel"></select></td><td><input type="number" step="0.5" data-path="freinf.topX.spc" data-num style="width:60px"></td><td class="sfdRbAb" data-mat="topX"></td><td class="sfdRbAs" data-mat="topX"></td><td class="sfdRbS" data-mat="topX"></td></tr>
- <tr><td>Top, y-bars</td><td><select data-path="freinf.topY.size" class="barsel"></select></td><td><input type="number" step="0.5" data-path="freinf.topY.spc" data-num style="width:60px"></td><td class="sfdRbAb" data-mat="topY"></td><td class="sfdRbAs" data-mat="topY"></td><td class="sfdRbS" data-mat="topY"></td></tr>
+ <div class="note">Bottom mat resists positive (cantilever/sagging) moment; top mat resists negative moment between pedestals. Bars in the x-direction resist bending about the y-axis (x-bars are spread across L, y-bars across B). Each mat is entered either as a <b>spacing</b> s or as a <b>total quantity</b> n of bars across the footing width. Enter #0 spacing to omit a mat. Check-only: the tool reports DCR and required A<sub>s</sub>.</div>
+ <table class="tbl sfdRbTbl" style="font-size:10.5px"><tr><th>Mat</th><th>Bar #</th><th>Input</th><th>s (in) / n</th><th>A<sub>b</sub> (in&sup2;)</th><th>A<sub>s</sub>/ft (in&sup2;)</th><th>s vs s<sub>max</sub> (in)</th></tr>
+ <tr><td>Bottom x</td><td><select data-path="freinf.botX.size" class="barsel" style="width:60px"></select></td><td><select data-path="freinf.botX.mode" class="sfdRbMode" style="width:74px"><option value="spacing">Spacing</option><option value="qty">Total qty</option></select></td><td><input type="number" step="0.5" data-path="freinf.botX.spc" data-num style="width:46px" class="sfdRbSpc" data-mat="botX" title="center-to-center spacing, in"><input type="number" step="1" min="0" data-path="freinf.botX.n" data-num style="width:46px" class="sfdRbN" data-mat="botX" title="total number of bars across the footing width"><div class="sfdRbD" data-mat="botX" style="font-size:10px"></div></td><td class="sfdRbAb" data-mat="botX"></td><td class="sfdRbAs" data-mat="botX"></td><td class="sfdRbS" data-mat="botX"></td></tr>
+ <tr><td>Bottom y</td><td><select data-path="freinf.botY.size" class="barsel" style="width:60px"></select></td><td><select data-path="freinf.botY.mode" class="sfdRbMode" style="width:74px"><option value="spacing">Spacing</option><option value="qty">Total qty</option></select></td><td><input type="number" step="0.5" data-path="freinf.botY.spc" data-num style="width:46px" class="sfdRbSpc" data-mat="botY" title="center-to-center spacing, in"><input type="number" step="1" min="0" data-path="freinf.botY.n" data-num style="width:46px" class="sfdRbN" data-mat="botY" title="total number of bars across the footing width"><div class="sfdRbD" data-mat="botY" style="font-size:10px"></div></td><td class="sfdRbAb" data-mat="botY"></td><td class="sfdRbAs" data-mat="botY"></td><td class="sfdRbS" data-mat="botY"></td></tr>
+ <tr><td>Top x</td><td><select data-path="freinf.topX.size" class="barsel" style="width:60px"></select></td><td><select data-path="freinf.topX.mode" class="sfdRbMode" style="width:74px"><option value="spacing">Spacing</option><option value="qty">Total qty</option></select></td><td><input type="number" step="0.5" data-path="freinf.topX.spc" data-num style="width:46px" class="sfdRbSpc" data-mat="topX" title="center-to-center spacing, in"><input type="number" step="1" min="0" data-path="freinf.topX.n" data-num style="width:46px" class="sfdRbN" data-mat="topX" title="total number of bars across the footing width"><div class="sfdRbD" data-mat="topX" style="font-size:10px"></div></td><td class="sfdRbAb" data-mat="topX"></td><td class="sfdRbAs" data-mat="topX"></td><td class="sfdRbS" data-mat="topX"></td></tr>
+ <tr><td>Top y</td><td><select data-path="freinf.topY.size" class="barsel" style="width:60px"></select></td><td><select data-path="freinf.topY.mode" class="sfdRbMode" style="width:74px"><option value="spacing">Spacing</option><option value="qty">Total qty</option></select></td><td><input type="number" step="0.5" data-path="freinf.topY.spc" data-num style="width:46px" class="sfdRbSpc" data-mat="topY" title="center-to-center spacing, in"><input type="number" step="1" min="0" data-path="freinf.topY.n" data-num style="width:46px" class="sfdRbN" data-mat="topY" title="total number of bars across the footing width"><div class="sfdRbD" data-mat="topY" style="font-size:10px"></div></td><td class="sfdRbAb" data-mat="topY"></td><td class="sfdRbAs" data-mat="topY"></td><td class="sfdRbS" data-mat="topY"></td></tr>
@@ -635 +636 @@ function newPed(n){return {label:'Ped '+n,x:0,y:0,bx:1.5,by:1.5,h:2,loadEx:0,loa
- reinf:{longSize:8,nx:3,ny:3,tieSize:3,tieSpc:12,cover:2,dowelSize:8,dowelN:8}};}
+ reinf:{longSize:8,nx:3,ny:3,longMode:'faces',tieSize:3,tieSpc:12,cover:2,dowelSize:8,dowelN:8}};}
@@ -645 +646 @@ function defaultState(){
- freinf:{botX:{size:8,spc:9},botY:{size:8,spc:9},topX:{size:0,spc:12},topY:{size:0,spc:12}},
+ freinf:{botX:{size:8,spc:9,mode:'spacing'},botY:{size:8,spc:9,mode:'spacing'},topX:{size:0,spc:12,mode:'spacing'},topY:{size:0,spc:12,mode:'spacing'}},
@@ -658,0 +660 @@ function migrateState(){
+ ['botX','botY','topX','topY'].forEach(k=>{const m=state.freinf[k];if(m&&!m.mode)m.mode='spacing';});   /* SFRQ: older saves entered a spacing */
@@ -675,0 +678 @@ function migrateState(){
+  if(!p.reinf.longMode)p.reinf.longMode='faces';   /* SFRQ: older saves entered bars per face */
@@ -797,0 +801,10 @@ function buildPedCards(){
+  /* SFRQ: how the longitudinal bars are entered: n per face (as before), a total quantity, or a spacing */
+  const mt=document.createElement('table');mt.className='tbl';mt.style.fontSize='11px';
+  mt.innerHTML='<tr><th>Long. bars entered as</th><th>Total qty</th><th>Spacing c-c (in)</th></tr>';
+  const mr=document.createElement('tr');
+  mr.appendChild(cell('<select data-path="peds.'+i+'.reinf.longMode" style="width:auto"><option value="faces">n per face</option><option value="total">Total quantity</option><option value="spacing">Spacing</option></select>'));
+  mr.appendChild(cell('<input type="number" step="1" min="0" data-path="peds.'+i+'.reinf.nTot" data-num style="width:52px">'));
+  mr.appendChild(cell('<input type="number" step="0.5" data-path="peds.'+i+'.reinf.longSpc" data-num style="width:52px">'));
+  mt.appendChild(mr);b.appendChild(mt);
+  const pbi=el('div','note sfdPbInfo');pbi.dataset.ped=i;pbi.style.fontSize='10.5px';b.appendChild(pbi);
+  mr.querySelectorAll('select,input').forEach(x=>{const v=getPath(state,x.dataset.path);x.value=(v===undefined||v===null)?'':v;});
@@ -827,0 +841,9 @@ function handleFieldChange(inp){
+ /* SFRQ: switching the input form starts the new field at the value equivalent to the current bars (when empty) */
+ {const mm=inp.dataset.path.match(/^freinf\.(\w+)\.mode$/);
+  if(mm&&v==='qty'){const m=state.freinf[mm[1]];if(!(num(m.n)>0)){m.mode='spacing';const n0=sfdMat(mm[1]).n;m.mode='qty';m.n=n0||0;bindStaticInputs();}}
+  if(mm&&v==='spacing'){const m=state.freinf[mm[1]];if(!(num(m.spc)>0)){m.mode='qty';const s0=sfdMat(mm[1]).spc;m.mode='spacing';m.spc=Math.round(s0*2)/2||12;bindStaticInputs();}}
+  const pm=inp.dataset.path.match(/^peds\.(\d+)\.reinf\.longMode$/);
+  if(pm){const i=+pm[1],rf=state.peds[i].reinf;rf.longMode='faces';const b0=sfdPedBars(i);rf.longMode=v;
+   if(v==='total'&&!(num(rf.nTot)>0))rf.nTot=b0.n;
+   if(v==='spacing'&&!(num(rf.longSpc)>0))rf.longSpc=Math.round(Math.max(b0.sx,b0.sy)*2)/2;
+   buildPedCards();}}
@@ -924,0 +947,51 @@ function sfdInputTabMarks(){
+/* SFRQ (2026-11-01): rebar entered as a spacing or as a total quantity.
+   Footing mat k ('botX' | 'botY' | 'topX' | 'topY'): x-bars are spread across the footing length L, y-bars across B
+   (the width w perpendicular to the bars, the same width the design uses). Cover basis for the bar positions: the
+   side/end cover (Materials, "Side/end cover, bottom bars"; blank = the bottom cover), i.e. sfdEndCover(), for every mat.
+     spacing mode (default; older projects): s as entered; A_s/ft = A_b*12/s (barAreaPerFt, unchanged);
+       derived count n = floor((12w - 2c - d_b)/s) + 1 (display only).
+     quantity mode: n as entered; A_s,total = n*A_b; A_s/ft = n*A_b/w; spacing for the s_max check and for c_b of
+       the development length s = (12w - 2c - d_b)/(n - 1) (the corner-bar centre span over the n - 1 gaps).
+   Returns { mode, size, Ab, db, w (ft), c (in), span (in), spc (in), n, As (in^2/ft), AsTot (in^2) }. */
+function sfdMat(k){
+ const m=(state.freinf&&state.freinf[k])||{}, size=m.size, Ab=BAR_AREA[size]||0, db=BAR_DIA[size]||0;
+ const w=(k.slice(-1)==='X')?num(state.geom.L):num(state.geom.B), c=sfdEndCover(), span=w*12-2*c-db;
+ if(m.mode==='qty'){
+  const n=Math.max(Math.round(num(m.n)),0), As=(size&&n>0&&w>0)?n*Ab/w:0;
+  return {mode:'qty',size,Ab,db,w,c,span,n,As,AsTot:n*Ab,spc:(n>1&&span>0)?span/(n-1):0};
+ }
+ const spc=num(m.spc), As=barAreaPerFt(size,m.spc);
+ return {mode:'spacing',size,Ab,db,w,c,span,spc,As,AsTot:As*w,n:(size&&spc>0&&span>=0)?Math.floor(span/spc+1e-9)+1:0};
+}
+/* text of a mat as entered and derived: "#8 @ 9.00 in → 10 bars" / "12 #8 → s = 8.20 in" */
+function sfdMatTxt(k){const e=sfdMat(k);if(!e.size)return 'none';
+ return e.mode==='qty'?e.n+' #'+e.size+' → s = '+f2(e.spc)+' in':(e.spc>0?'#'+e.size+' @ '+f2(e.spc)+' in → '+e.n+' bars':'#'+e.size+', s = 0');}
+/* Pedestal longitudinal bars (perimeter layout of pedBarCoords: nx bars on each face parallel to x (length b_x),
+   ny on each face parallel to y, corners shared, n = 2(nx + ny) - 4).
+     'faces' (default; older projects): nx, ny as entered (unchanged).
+     'total': N bars; an odd N is raised to N + 1 (the layout is symmetric); N >= 4. nx + ny = N/2 + 2, split so the
+       centre-to-centre spacings on the two faces are as equal as possible (ties: fewer bars on the x-faces).
+     'spacing': s centre-to-centre along each face; bars per face = ceil(L_c/s) + 1 (>= 2), so the spacing provided
+       does not exceed s. L_c = b - 2 cover - d_b, the corner-bar centre span (the same cover basis as the bar-fit
+       clear-spacing check of the Pedestal Design tab).
+   Returns { mode, nx, ny, n, Lx, Ly (in), sx, sy (in, c-c), entered text, note }. */
+function sfdPedBars(i){
+ const p=state.peds[i]||{}, rf=p.reinf||{}, mode=rf.longMode||'faces', db=BAR_DIA[rf.longSize]||0, cov=num(rf.cover);
+ const Lx=num(p.bx)*12-2*cov-db, Ly=num(p.by)*12-2*cov-db;
+ const sp=(L,n)=>n>1?L/(n-1):0;
+ if(mode==='total'){
+  const Nin=Math.round(num(rf.nTot));let N=Math.max(Nin,4),note='';
+  if(N%2){N+=1;note='odd total raised to '+N+' (symmetric perimeter layout)';}
+  if(Nin<4)note='fewer than 4 bars entered: 4 used (minimum for a perimeter layout)';
+  const S=N/2+2;let best=null;
+  for(let nx=2;nx<=S-2;nx++){const ny=S-nx,d=Math.abs(sp(Lx,nx)-sp(Ly,ny));if(!best||d<best.d-1e-9)best={nx,ny,d};}
+  return {mode,nx:best.nx,ny:best.ny,n:N,Lx,Ly,sx:sp(Lx,best.nx),sy:sp(Ly,best.ny),entered:Nin+' bars',note};
+ }
+ if(mode==='spacing'){
+  const s=num(rf.longSpc), f=L=>(s>0&&L>0)?Math.max(Math.ceil(L/s-1e-9),1)+1:2, nx=f(Lx), ny=f(Ly);
+  return {mode,nx,ny,n:2*(nx+ny)-4,Lx,Ly,sx:sp(Lx,nx),sy:sp(Ly,ny),entered:'s = '+f2(s)+' in',note:s>0?'':'no spacing entered: 2 bars per face'};
+ }
+ return {mode:'faces',nx:rf.nx,ny:rf.ny,n:2*(rf.nx+rf.ny)-4,Lx,Ly,sx:sp(Lx,rf.nx),sy:sp(Ly,rf.ny),entered:rf.nx+' per x-face, '+rf.ny+' per y-face',note:''};
+}
+function sfdPedBarTxt(i){const b=sfdPedBars(i),sz=(state.peds[i].reinf||{}).longSize;
+ return b.mode==='faces'?b.n+' #'+sz+' ('+b.nx+' per x-face, '+b.ny+' per y-face)':(b.mode==='total'?'total '+b.entered.replace(' bars','')+' #'+sz:'#'+sz+' at '+b.entered)+' → '+b.n+' bars ('+b.nx+' per x-face at '+f2(b.sx)+' in, '+b.ny+' per y-face at '+f2(b.sy)+' in)'+(b.note?'; '+b.note:'');}
@@ -933 +1006 @@ function sfdRebarInfo(){
-  const m=fr[k]||{},sz=m.size,spc=num(m.spc),Ab=BAR_AREA[sz]||0,As=barAreaPerFt(sz,spc);
+  const e=sfdMat(k),sz=e.size,spc=e.spc,Ab=e.Ab,As=e.As;   /* SFRQ: spacing or quantity */
@@ -937 +1010,4 @@ function sfdRebarInfo(){
-  q('sfdRbAs').innerHTML=(sz&&spc>0)?Ab.toFixed(2)+'&middot;12/'+f2(spc)+' = <b>'+As.toFixed(3)+'</b>':(sz?'\u2014 (s = 0)':'\u2014 (no mat)');
+  q('sfdRbAs').innerHTML=e.mode==='qty'?((sz&&e.n>0)?e.n+'&middot;'+Ab.toFixed(2)+'/'+f2(e.w)+' = <b>'+As.toFixed(3)+'</b>':(sz?'\u2014 (n = 0)':'\u2014 (no mat)'))
+   :((sz&&spc>0)?Ab.toFixed(2)+'&middot;12/'+f2(spc)+' = <b>'+As.toFixed(3)+'</b>':(sz?'\u2014 (s = 0)':'\u2014 (no mat)'));
+  const dv=q('sfdRbD');if(dv)dv.innerHTML=sz?(e.mode==='qty'?'\u2192 s = '+f2(spc)+' in':(spc>0?'\u2192 '+e.n+' bars':'')):'';
+  const isQ=(e.mode==='qty');q('sfdRbSpc').style.display=isQ?'none':'';q('sfdRbN').style.display=isQ?'':'none';
@@ -948 +1024 @@ function sfdRebarInfo(){
- if(n)n.innerHTML='A<sub>b</sub> from the bar table (#3\u2013#11); A<sub>s</sub> per ft of width is the value used in the footing design. s<sub>max</sub> = min(3h, 18 in) (ACI 318-19 7.7.2.3 / 13.3.4); top mats are checked only where hogging makes them flexural mats.'+
+ if(n)n.innerHTML='A<sub>b</sub> from the bar table (#3\u2013#11); A<sub>s</sub> per ft of width is the value used in the footing design: A<sub>b</sub>&middot;12/s (spacing) or n&middot;A<sub>b</sub>/w (quantity; w = L for x-bars, B for y-bars). With a quantity, s = (12w &minus; 2c &minus; d<sub>b</sub>)/(n &minus; 1), c = side/end cover (Materials; blank = bottom cover), is used for the s<sub>max</sub> check and for c<sub>b</sub> of &ell;<sub>d</sub>; with a spacing, the bar count shown is floor((12w &minus; 2c &minus; d<sub>b</sub>)/s) + 1. s<sub>max</sub> = min(3h, 18 in) (ACI 318-19 7.7.2.3 / 13.3.4); top mats are checked only where hogging makes them flexural mats.'+
@@ -950,0 +1027,8 @@ function sfdRebarInfo(){
+/* SFRQ: pedestal cards: which longitudinal-bar inputs apply, and the bars they give */
+function sfdPedBarInfo(){
+ $$('.sfdPbInfo').forEach(d=>{const i=+d.dataset.ped;if(!state.peds[i])return;const b=sfdPedBars(i),card=d.closest('.pedbody');
+  const show=(path,on)=>{const x=card.querySelector('[data-path="peds.'+i+'.reinf.'+path+'"]');if(x)x.disabled=!on;};
+  show('nx',b.mode==='faces');show('ny',b.mode==='faces');show('nTot',b.mode==='total');show('longSpc',b.mode==='spacing');
+  d.innerHTML='Longitudinal bars: '+sfEsc(sfdPedBarTxt(i))+'. Corner-bar centre span L<sub>c</sub> = b \u2212 2&middot;cover \u2212 d<sub>b</sub> = '+f2(b.Lx)+' in (x-face), '+f2(b.Ly)+' in (y-face).'+
+   (b.mode==='spacing'?' Bars per face = ceil(L<sub>c</sub>/s) + 1.':b.mode==='total'?' Split so the two faces have spacings as equal as possible.':'');});
+}
@@ -1179,0 +1264,4 @@ function computeAll(){
+ /* SFRQ: bars entered as a quantity */
+ [['botX','bottom x'],['botY','bottom y'],['topX','top x'],['topY','top y']].forEach(([k,lab])=>{const m=(state.freinf||{})[k]||{};
+  if(m.mode==='qty'&&m.size&&Math.round(num(m.n))<2)W.push({lvl:'warn',msg:'Footing reinforcement, '+lab+' mat: entered as a quantity of '+Math.round(num(m.n))+' bar(s); at least 2 are needed to define a spacing.'});});
+ state.peds.forEach((p,i)=>{const b=sfdPedBars(i);if(b.note&&num(p.h)>0)W.push({lvl:'warn',msg:'Pedestal "'+p.label+'" longitudinal bars: '+b.note+'.'});});
@@ -2807,3 +2895,8 @@ function sfrModel(){
-   const mt=state.freinf[k]||{},sz=mt.size,s=num(mt.spc);
-   if(!sz||!(s>0))return;
-   w.add({id:'As.'+k,label:lab+': #'+sz+' at '+sfrN(s)+' in',sym:'A_{s}',eq:'\\frac{12\\,A_{b}}{s}',sub:'\\frac{12\\cdot'+sfrN(BAR_AREA[sz])+'}{'+sfrN(s)+'}',value:barAreaPerFt(sz,s),unit:'in^{2}/ft',d:3,ref:''});});
+   const e=sfdMat(k),sz=e.size,s=e.spc;   /* SFRQ: spacing or quantity, entered and derived */
+   if(!sz)return;
+   if(e.mode==='qty'){if(!(e.n>0))return;
+    w.add({id:'As.'+k,label:lab+': '+e.n+' #'+sz+' across w = '+sfrN(e.w)+' ft (entered as a quantity)',sym:'A_{s}',eq:'\\frac{n\\,A_{b}}{w}',sub:'\\frac{'+e.n+'\\cdot'+sfrN(e.Ab)+'}{'+sfrN(e.w)+'}',value:e.As,unit:'in^{2}/ft',d:3});
+    w.add({id:'s.'+k,label:lab+': spacing from the quantity (c = side/end cover)',sym:'s',eq:'\\frac{12 w \\minus 2 c \\minus d_{b}}{n \\minus 1}',sub:'\\frac{'+sfrN(e.w*12,1)+' \\minus 2\\cdot'+sfrN(e.c)+' \\minus '+sfrN(e.db,3)+'}{'+(e.n-1)+'}',value:e.spc,unit:'in'});
+    return;}
+   if(!(s>0))return;
+   w.add({id:'As.'+k,label:lab+': #'+sz+' at '+sfrN(s)+' in (entered as a spacing; '+e.n+' bars across '+sfrN(e.w)+' ft)',sym:'A_{s}',eq:'\\frac{12\\,A_{b}}{s}',sub:'\\frac{12\\cdot'+sfrN(BAR_AREA[sz])+'}{'+sfrN(s)+'}',value:e.As,unit:'in^{2}/ft',d:3,ref:''});});
@@ -2811,2 +2904,2 @@ function sfrModel(){
-   {type:'table',head:['Mat','Bar','s (in)','A_b (in²)'],rows:[['botX','Bottom, x-bars'],['botY','Bottom, y-bars'],['topX','Top, x-bars'],['topY','Top, y-bars']].map(([k,lab])=>{const mt=state.freinf[k]||{};
-    return [lab,mt.size?'#'+mt.size:'none',mt.size?sfrCell(num(mt.spc)):'—',mt.size?sfrCell(BAR_AREA[mt.size]):'—'];})},
+   {type:'table',head:['Mat','Bar','Entered as','Entered → derived','A_b (in²)'],rows:[['botX','Bottom, x-bars'],['botY','Bottom, y-bars'],['topX','Top, x-bars'],['topY','Top, y-bars']].map(([k,lab])=>{const e=sfdMat(k);
+    return [lab,e.size?'#'+e.size:'none',e.size?(e.mode==='qty'?'total quantity':'spacing'):'—',e.size?sfdMatTxt(k):'—',e.size?sfrCell(e.Ab):'—'];})},
@@ -2816 +2909 @@ function sfrModel(){
-   p.h>1e-9?((2*(rf.nx+rf.ny)-4)+' #'+rf.longSize+'; ties #'+rf.tieSize+' at '+sfrN(num(rf.tieSpc))+' in; cover '+sfrN(num(rf.cover))+' in; dowels '+rf.dowelN+' #'+rf.dowelSize):'bearing patch (h = 0)'];});
+   p.h>1e-9?(sfdPedBarTxt(i)+'; ties #'+rf.tieSize+' at '+sfrN(num(rf.tieSpc))+' in; cover '+sfrN(num(rf.cover))+' in; dowels '+rf.dowelN+' #'+rf.dowelSize):'bearing patch (h = 0)'];});
@@ -3045 +3138 @@ function sfrModel(){
-    S({id:'Ast',label:pd.nBars+' #'+rf.longSize+' (perimeter, '+rf.nx+' per x-face, '+rf.ny+' per y-face)',sym:'A_{st}',eq:'n A_{b}',sub:pd.nBars+'\\cdot'+sfrN(BAR_AREA[rf.longSize||0]),value:pd.Ast,unit:'in^{2}'}),
+    S({id:'Ast',label:'Longitudinal bars: '+sfdPedBarTxt(i),sym:'A_{st}',eq:'n A_{b}',sub:pd.nBars+'\\cdot'+sfrN(BAR_AREA[rf.longSize||0]),value:pd.Ast,unit:'in^{2}'}),
@@ -3239,0 +3333 @@ function recalc(){
+ sfdPedBarInfo();   /* SFRQ */
@@ -3791,2 +3885,2 @@ function computePhase2(R){
-  const AsBot=barAreaPerFt((dir==='x')?state.freinf.botX.size:state.freinf.botY.size,(dir==='x')?state.freinf.botX.spc:state.freinf.botY.spc);
-  const AsTop=barAreaPerFt((dir==='x')?state.freinf.topX.size:state.freinf.topY.size,(dir==='x')?state.freinf.topX.spc:state.freinf.topY.spc);
+  const AsBot=sfdMat(dir==='x'?'botX':'botY').As;   // SFRQ: A_b*12/s (spacing, as before) or n*A_b/w (quantity)
+  const AsTop=sfdMat(dir==='x'?'topX':'topY').As;
@@ -3834,2 +3928,2 @@ function computePhase2(R){
-  const spcBot=num((dir==='x')?state.freinf.botX.spc:state.freinf.botY.spc);
-  const spcTop=num((dir==='x')?state.freinf.topX.spc:state.freinf.topY.spc);
+  const spcBot=sfdMat(dir==='x'?'botX':'botY').spc;   // SFRQ: as entered, or derived from the quantity
+  const spcTop=sfdMat(dir==='x'?'topX':'topY').spc;
@@ -3998,2 +4092,2 @@ function computePhase2(R){
-   const AsPerFtX=barAreaPerFt(state.freinf.botX.size,state.freinf.botX.spc);
-   const AsPerFtY=barAreaPerFt(state.freinf.botY.size,state.freinf.botY.spc);
+   const AsPerFtX=sfdMat('botX').As;   // SFRQ
+   const AsPerFtY=sfdMat('botY').As;
@@ -4068 +4162,2 @@ function computePhase2(R){
-  const nBars=2*(rf.nx+rf.ny)-4; // perimeter arrangement
+  const PB=sfdPedBars(i);   // SFRQ: nx, ny as entered, or from a total quantity / a spacing
+  const nBars=2*(PB.nx+PB.ny)-4; // perimeter arrangement
@@ -4104,2 +4199,2 @@ function computePhase2(R){
-  const clrX=rf.nx>1?((bx-2*cover-dbL)/(rf.nx-1)-dbL):Infinity; // bx,by already inches here
-  const clrY=rf.ny>1?((by-2*cover-dbL)/(rf.ny-1)-dbL):Infinity;
+  const clrX=PB.nx>1?((bx-2*cover-dbL)/(PB.nx-1)-dbL):Infinity; // bx,by already inches here
+  const clrY=PB.ny>1?((by-2*cover-dbL)/(PB.ny-1)-dbL):Infinity;
@@ -4113 +4208 @@ function computePhase2(R){
-  const pmBars=pedBarCoords(bx,by,cover,rf.nx,rf.ny,BAR_AREA[rf.longSize||0]);
+  const pmBars=pedBarCoords(bx,by,cover,PB.nx,PB.ny,BAR_AREA[rf.longSize||0]);
@@ -4120 +4215 @@ function computePhase2(R){
-   pmBars,pmPts,fc,fy};
+   pmBars,pmPts,fc,fy,PB};
@@ -4282 +4377 @@ function sfdDevData(dir){
-  const spcD=(dir==='x')?num(state.freinf.botX.spc):num(state.freinf.botY.spc);
+  const spcD=sfdMat(dir==='x'?'botX':'botY').spc;   // SFRQ: as entered, or derived from the quantity
@@ -4305 +4399,0 @@ function sfdDevData(dir){
-function sfdBarTxt(m){m=m||{};return (m.size&&num(m.spc)>0)?'#'+m.size+' @ '+f2(num(m.spc))+' in':'none';}
@@ -4323 +4417 @@ function renderFootingDesign(){
- intro.appendChild(el('div','wkLink','<a class="wkA sfdInA" href="#sec-rebar" data-intab="rebar" data-insec="sec-rebar"><span class="wkScr">Bars set on the Reinforcement tab (inputs) \u2192 bottom x '+sfdBarTxt(state.freinf.botX)+', bottom y '+sfdBarTxt(state.freinf.botY)+', top x '+sfdBarTxt(state.freinf.topX)+', top y '+sfdBarTxt(state.freinf.topY)+'</span><span class="wkPrt">Bars (Reinforcement input): bottom x '+sfdBarTxt(state.freinf.botX)+', bottom y '+sfdBarTxt(state.freinf.botY)+', top x '+sfdBarTxt(state.freinf.topX)+', top y '+sfdBarTxt(state.freinf.topY)+'</span></a>'));   /* link to the Reinforcement input tab */
+ intro.appendChild(el('div','wkLink','<a class="wkA sfdInA" href="#sec-rebar" data-intab="rebar" data-insec="sec-rebar"><span class="wkScr">Bars set on the Reinforcement tab (inputs) \u2192 bottom x '+sfdMatTxt('botX')+', bottom y '+sfdMatTxt('botY')+', top x '+sfdMatTxt('topX')+', top y '+sfdMatTxt('topY')+'</span><span class="wkPrt">Bars (Reinforcement input): bottom x '+sfdMatTxt('botX')+', bottom y '+sfdMatTxt('botY')+', top x '+sfdMatTxt('topX')+', top y '+sfdMatTxt('topY')+'</span></a>'));   /* link to the Reinforcement input tab */
@@ -4342,0 +4437 @@ function renderFootingDesign(){
+  {const e=sfdMat(dir==='x'?'botX':'botY');if(e.mode==='qty'&&e.size)b.appendChild(el('div','note','Bottom '+dir+'-bars entered as a quantity: n = '+e.n+' #'+e.size+' across w = '+f2(e.w)+' ft \u2192 A<sub>s</sub> = n&middot;A<sub>b</sub>/w = '+e.n+'&middot;'+f2(e.Ab)+'/'+f2(e.w)+' = '+f3(e.As)+' in\u00b2/ft; s = (12w \u2212 2c \u2212 d<sub>b</sub>)/(n \u2212 1) = ('+f2(e.w*12)+' \u2212 2&middot;'+f2(e.c)+' \u2212 '+f3(e.db)+')/'+(e.n-1)+' = '+f2(e.spc)+' in (c = side/end cover).'));}   /* SFRQ */
@@ -4614,0 +4710 @@ function renderPedestalDesign(){
+  b.appendChild(el('div','note','Longitudinal bars: '+sfEsc(sfdPedBarTxt(i))+'.'));   /* SFRQ: as entered and as laid out */
@@ -4934,2 +5030,6 @@ function buildRebar(){
- mat2('x',fr.botX.size,fr.botX.spc,zBotX);
- mat2('y',fr.botY.size,fr.botY.spc,zBotY);
+ /* SFRQ: a mat entered as a quantity is drawn as its n bars from the side cover; a spacing mat as before */
+ function matQ(k,dir,z){const e=sfdMat(k);if(!e.size||!(e.n>0))return;const span=(dir==='x'?L:B),st=-span/2+(e.c+e.db/2)/12;
+  for(let j=0;j<e.n;j++){const pos=e.n>1?st+j*e.spc/12:0;if(dir==='x')barX(pos,z,e.size);else barY(pos,z,e.size);}}
+ const mat3=(k,dir,z)=>{if(fr[k].mode==='qty')matQ(k,dir,z);else mat2(dir,fr[k].size,fr[k].spc,z);};
+ mat3('botX','x',zBotX);
+ mat3('botY','y',zBotY);
@@ -4937,2 +5037,2 @@ function buildRebar(){
- if(fr.topX.size)mat2('x',fr.topX.size,fr.topX.spc,zTopX);
- if(fr.topY.size)mat2('y',fr.topY.size,fr.topY.spc,zTopY);
+ if(fr.topX.size)mat3('topX','x',zTopX);
+ if(fr.topY.size)mat3('topY','y',zTopY);
@@ -4946 +5046 @@ function buildRebar(){
-  const xs=[],ys=[];const nx=Math.max(rf.nx||2,2),ny=Math.max(rf.ny||2,2);
+  const PB=sfdPedBars(i);const xs=[],ys=[];const nx=Math.max(PB.nx||2,2),ny=Math.max(PB.ny||2,2);   // SFRQ
```


## 2026-11-01 — PR: claude/sf-drawings — Drawings output tab with DXF export (SFDW; display and export only, no calculation change) (PR link added after merge)

Line numbers are approximate; search for the anchor text. Every code site is tagged `SFDW`.

### SFDW. "10. Drawings" output tab: sheets previewed in the app, one DXF R12 file   [display / export only]
- **Engineer request (2026-11-01):** a Drawings tab like the Steel Bridge app's, with sheets previewed in the app through the shared SVG preview (wheel zoom at the cursor, drag pan, pinch, double-click fit, + / − / Fit) and Download DXF via `shared/dxf.js`.
- **Loads:** `<script src="shared/dxf.js">` (classic script, relative path; the file is not changed).
- **New code** (one `<script>` block before "recalc & init"):
  - `sfdwBuild()` draws every sheet into one `SharedDxf.drawing` (model space, full size in inches).
  - Each sheet is a B-size sheet (17 × 11 in). It is drawn at the largest standard architectural scale its content fits (3" = 1'-0" … 1/16" = 1'-0"), inside a border and a title block, and the sheets sit side by side.
  - `sfdwSheetSVG()` gives the preview of one sheet from the same entities (`SharedDxf.toSVG`). `renderDrawings()` shows the sheet selector, the viewer (`SharedDxf.viewer`), the sheet index with a link to the tab where each sheet's content is worked, and the Download DXF button. The file is checked with `SharedDxf.validate` before the download.
- **Sheets:**
  1. **Footing plan:** outline, pedestals with sizes, load points (red cross-hair at x + e_x, y + e_y; leader and "LOAD PT e = …" when offset), x/y centre lines, axis triad, section cuts A and B (through the first pedestal), chained dimensions to the pedestal centres and the overall B, L.
  2. **Section A-A (along x)** and 3. **Section B-B (along y):**
     - footing, the cut pedestals, grade, soil cover, water table;
     - bottom and top mats: bars along the cut as lines, the others as dots at their positions from the side cover;
     - pedestal vertical bars down to the top of the bottom mat, ties at their spacing, the load arrow at the load point with its offset;
     - callouts with the bars as entered → derived (`sfdMatTxt`);
     - dimensions t, D_f, h, B or L; a cover note.
  4. **Pedestal detail** (one sheet per pedestal with h > 0):
     - plan section with the bars of `sfdPedBars` (centres at b/2 − cover − d_b/2, the bar-fit basis), the tie and chained bar spacings;
     - elevation with ties (chained), the height, top of footing and top of bottom mat;
     - the dowel embedment available vs ℓ_dc (`P2.bearing`).
  5. **Reinforcement schedule:**
     - marks F1–F4 (mats; count = the bars placed, length = B or L less 2 end covers, spacing as entered or derived);
     - per pedestal: Pn V (vertical: n, faces, length = h − cover with the extension by detail), Pn T (ties: count = floor(h/s) + 1 as the 3D view, length = perimeter on the centre line, hooks not included), Pn D (dowels: count, embedment ≥ ℓ_dc, projection by detail);
     - notes.
  6. **General notes:** the codes and editions the tool uses (ACI 318-19; ASCE 7-16 §2.3.1 / §2.4.1; IBC 2021; AASHTO LRFD 10th Ed. when an AASHTO eccentricity limit is selected), the bearing basis and the allowable bearing pressure of the governing case, f′c, f_y, coating, covers, footing size, the load convention, axes, the project assumptions.
- **Title block** on every sheet: Project, Project No., Calculated by, Date, Checked by, Checked date, Scale (row 1); Sheet title, Drawn by (the tool), Sheet n of N (row 2). There is no owner cell.
- **Layers:** S-CONC, S-PED, S-REBAR, S-DIMS, S-TEXT, S-CNTR (CENTER), S-LOAD, S-SOIL, S-HIDDEN, S-CUT, S-TBLK, S-BRDR. Dimensions are DIMENSION entities.
- **Values:** all geometry, bars and lengths come from the tool's model: `R`, `state.geom`, `sfdMat`, `sfdPedBars`, `P2.bearing`, `R.govBear`. Nothing is computed for the design. The only additions are drawing quantities: bar positions from the side cover at the spacing; bar lengths = dimension less covers; tie count by the 3D view's rule.
- **Print:** the Drawings tab is not printed with the tab report (`#tab-drawings` hidden in print and left out of `renderPrintHeader`).
- **Saved data:** none in the project. The chosen sheet is kept per browser under the UI key `sfd_dwgSheet_v1` (prefixed per tool, CLAUDE.md §5).
- **How verified (headless Chromium):**
  - 9 projects (default, direct, water table + 3 pedestals + top mats, small footing + bearing patch, single pedestal with moments, direct with moments, load offsets, large lateral load, quantity-entered bars):
    - the DXF passes `SharedDxf.validate`, with no NaN or undefined;
    - **no text overlaps** on any sheet. The check covers every TEXT and every dimension text, pairwise, using the writer's text-width estimate, and finds everything inside the sheet border;
    - `R` and `P2` are unchanged; 0 console errors.
  - The downloaded file opens in ezdxf 1.4.4 with `recover.readfile`: 0 errors, 0 fixes.
  - The viewer: wheel zoom about the cursor changes the viewBox, and a double-click returns it to the fit view.
  - origin/main vs the branch on 7 projects: `R`, `P2`, dashboard, warnings, self-consistency, state, storage and the tab text are identical.
  - `node tests/check-syntax.mjs "Spread Footing.html"` passes.
  - Screenshots of every sheet were checked by eye.
- **Other copies:** none. `shared/README.md` lists Spread Footing.html as a user of `dxf.js`.
- **Open items:**
  - The pedestal vertical-bar extension into the footing, the dowel projection and the bar hooks are not designed by the tool. The drawings mark them "by detail".
  - At a 390 px viewport the tool's layout does not stack (an existing limit, see SFRP).

Diff (`Spread Footing.html`, `git diff -U0` against origin/main):

```diff
diff --git a/Spread Footing.html b/Spread Footing.html
index 7f96751..84f1b12 100644
--- a/Spread Footing.html	
+++ b/Spread Footing.html	
@@ -13,0 +14 @@
+<script src="shared/dxf.js"></script><!-- SFDW: DXF writer and drawing preview (Drawings tab) -->
@@ -82,0 +84,6 @@ table.ldtbl input{width:58px;font-family:inherit;font-size:11px;border:1px solid
+/* SFDW: Drawings tab */
+.sfdwBar{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin:2px 0 6px}
+.sfdwBar select{width:auto;max-width:100%}
+.sfdwBox{border:1px solid #98a4b0;background:#fff;margin:6px 0}
+.sfdwHead{margin:8px 0 2px;font-size:12px}
+.sfdwIdx tr[data-sfdw]{cursor:pointer} .sfdwIdx tr.on{background:#eef4ff}
@@ -181 +188 @@ a.wkA:hover{text-decoration:underline}
- .wrap>div:first-child,#titleblock,#tab-3d,#tab-report:not(.active){display:none !important}   /* screen title row and input title block: the cover replaces them; live 3D view not printed */
+ .wrap>div:first-child,#titleblock,#tab-3d,#tab-report:not(.active),#tab-drawings{display:none !important}   /* screen title row and input title block: the cover replaces them; live 3D view not printed */
@@ -420,0 +428 @@ a.wkA:hover{text-decoration:underline}
+  <button data-tab="tab-drawings">10. Drawings</button>
@@ -430,0 +439 @@ a.wkA:hover{text-decoration:underline}
+ <div class="tabpage" id="tab-drawings"></div>
@@ -2801 +2810 @@ function renderPrintHeader(){
-  .filter(s=>s.n&&s.id!=='tab-3d'&&s.id!=='tab-report'&&(s.id!=='tab-manual'||state.manPrint));
+  .filter(s=>s.n&&s.id!=='tab-3d'&&s.id!=='tab-report'&&s.id!=='tab-drawings'&&(s.id!=='tab-manual'||state.manPrint));
@@ -3209,0 +3219,255 @@ window.addEventListener('beforeprint',()=>{
+/* ================= 10. Drawings tab (SFDW, 2026-11-01) =================
+   The drawing set as one DXF R12 file (shared/dxf.js: SharedDxf.drawing → toDXF), previewed in the app from the same
+   entities (SharedDxf.toSVG, SharedDxf.viewer: wheel zoom at the cursor, drag pan, pinch, double-click fit, + / − / Fit).
+   Display and export only: geometry and bars come from the tool's own model (R.peds with their load offsets, state.geom,
+   sfdMat / sfdPedBars for the bars as entered, P2 for ℓ_d / ℓ_dc / available lengths, the governing bearing case).
+   Model space, full size in inches; each sheet is a B-size sheet (17 × 11 in) at its plot scale with border and title
+   block (no owner cell), placed side by side. Nothing is saved except the chosen sheet (per-browser UI key sfd_dwgSheet_v1). */
+const SFDW_SCALES=[[1,'1" = 1"'],[4,'3" = 1\'-0"'],[6,'2" = 1\'-0"'],[8,'1 1/2" = 1\'-0"'],[12,'1" = 1\'-0"'],[16,'3/4" = 1\'-0"'],[24,'1/2" = 1\'-0"'],[32,'3/8" = 1\'-0"'],[48,'1/4" = 1\'-0"'],[64,'3/16" = 1\'-0"'],[96,'1/8" = 1\'-0"'],[192,'1/16" = 1\'-0"']];
+const SFDW={W:17,H:11,m:0.375,tbH:1.0,key:'sfd_dwgSheet_v1',cur:null,B:null};
+const sfdwFI=v=>SharedDxf.fmtFtIn(v);
+const sfdwIn=v=>SharedDxf.fmtIn(v);
+/* the footing mats with their bar positions (in, across the width, from the footing centre line), as entered */
+function sfdwMats(){
+ const out={};
+ ['botX','botY','topX','topY'].forEach(k=>{const e=sfdMat(k);if(!e.size)return;
+  const half=e.w*6, st=-half+e.c+e.db/2, n=e.mode==='qty'?e.n:(e.spc>0?e.n:0), s=e.mode==='qty'?e.spc:e.spc;
+  const pos=[];for(let j=0;j<n;j++)pos.push(n>1?st+j*s:0);
+  out[k]=Object.assign({},e,{pos,len:(k.slice(-1)==='X'?R.B:R.L)*12-2*e.c});});
+ return out;
+}
+/* bar heights in the section (in above the bottom of the footing): x-bars on top of y-bars in the bottom mat (as d_x of the
+   design), top x-bars outermost in the top mat (as the 3D view) */
+function sfdwLevels(M){
+ const t=R.t*12, cvB=num(state.mat.coverBot), cvT=num(state.mat.coverTop), d=k=>M[k]?M[k].db:0;
+ return {botY:cvB+d('botY')/2, botX:cvB+d('botY')+d('botX')/2, topX:t-cvT-d('topX')/2, topY:t-cvT-d('topX')-d('topY')/2, topOfBot:cvB+d('botY')+d('botX')};
+}
+/* the pedestal bar layout of the drawings: centres at b/2 − cover − d_b/2 (cover to the bar face, the bar-fit basis of sfdPedBars) */
+function sfdwPedLayout(i){
+ const p=R.peds[i], rf=state.peds[i].reinf, PB=sfdPedBars(i), db=BAR_DIA[rf.longSize]||0, cov=num(rf.cover);
+ const ax=p.bx*6-cov-db/2, ay=p.by*6-cov-db/2, xs=[], ys=[];
+ for(let k=0;k<PB.nx;k++)xs.push(PB.nx>1?-ax+2*ax*k/(PB.nx-1):0);
+ for(let k=0;k<PB.ny;k++)ys.push(PB.ny>1?-ay+2*ay*k/(PB.ny-1):0);
+ const pts=[];xs.forEach(x=>{pts.push([x,-ay]);pts.push([x,ay]);});ys.forEach(y=>{if(y>-ay+1e-6&&y<ay-1e-6){pts.push([-ax,y]);pts.push([ax,y]);}});
+ const tie=BAR_DIA[rf.tieSize]||0, ts=num(rf.tieSpc), h=p.h*12;
+ const nt=(tie>0&&ts>0&&h>0)?Math.floor(h/ts+1e-9)+1:0;   // ties at 0, s, 2s, … ≤ h (the 3D view's rule)
+ return {PB,db,cov,ax,ay,xs,ys,pts,tie,ts,nt,h,rf,tx:ax+db/2+tie/2,ty:ay+db/2+tie/2};
+}
+function sfdwBuild(){
+ const D=SharedDxf.drawing({prefix:'S-'}), S=[], m=state.meta||{};
+ const L={out:D.layer('CONC',7),ped:D.layer('PED',7),bar:D.layer('REBAR',5),dim:D.layer('DIMS',3),txt:D.layer('TEXT',7),cl:D.layer('CNTR',8,'CENTER'),
+  ld:D.layer('LOAD',1),soil:D.layer('SOIL',30),hid:D.layer('HIDDEN',8,'HIDDEN'),tb:D.layer('TBLK',7),br:D.layer('BRDR',7),cut:D.layer('CUT',6)};
+ const M=sfdwMats(), LV=sfdwLevels(M), B12=R.B*12, L12=R.L*12, t12=R.t*12, Df12=R.Df*12;
+ const AW=SFDW.W-2*SFDW.m-0.5, AH=SFDW.H-2*SFDW.m-SFDW.tbH-0.6;   // drawing area (paper in)
+ let ox=0;
+ /* one sheet: content(k) draws around (0,0) at scale k; the smallest standard k it fits is used */
+ function sheet(id,title,content,fixedK){
+  const i0=D.mark();let k=null,over=false;
+  const ks=fixedK?[fixedK]:SFDW_SCALES.map(s=>s[0]).filter(v=>v>=4);
+  for(const kk of ks){D.E.length=i0;D.k=kk;D.h=0.1*kk;content(kk);const b=D.bbox(i0);
+   if(!isFinite(b[0])||((b[2]-b[0])/kk<=AW&&(b[3]-b[1])/kk<=AH)){k=kk;break;}}
+  if(k===null){k=ks[ks.length-1];over=true;}
+  const b=D.bbox(i0), W=SFDW.W*k, H=SFDW.H*k, mm=SFDW.m*k, tb=SFDW.tbH*k;
+  const cx=ox+W/2, cy=mm+tb+0.3*k+(AH*k)/2;
+  if(isFinite(b[0]))D.move(i0,cx-(b[0]+b[2])/2,cy-(b[1]+b[3])/2);
+  D.k=k;D.h=0.1*k;
+  D.rect(L.br,ox,0,ox+W,H);D.rect(L.br,ox+mm,mm,ox+W-mm,H-mm);
+  /* title block (no owner cell): two rows along the bottom of the sheet */
+  const x0=ox+mm, y0=mm, w=(SFDW.W-2*SFDW.m)*k, r=tb/2, sc=k===1?'NTS':(SFDW_SCALES.find(q=>q[0]===k)||[0,'1:'+k])[1];
+  D.rect(L.tb,x0,y0,x0+w,y0+tb);D.line(L.tb,x0,y0+r,x0+w,y0+r);
+  const row1=[['PROJECT',m.project,4.25],['PROJECT NO.',m.number,2],['CALCULATED BY',m.calcBy,2],['DATE',m.calcDate,1.75],['CHECKED BY',m.chkBy,2],['CHECKED DATE',m.chkDate,1.75],['SCALE',sc,2.5]];
+  const row2=[['SHEET TITLE',title,8.25],['DRAWN BY','SPREAD FOOTING DESIGN TOOL (DRAWINGS TAB)',5],['SHEET','?',3]];
+  let sheetEnt=null;
+  [[row1,y0+r],[row2,y0]].forEach(([row,yb])=>{let x=x0;row.forEach(([lab,val,cw],ci)=>{
+   D.text(L.tb,x+0.05*k,yb+r-0.11*k,0.065*k,lab,0);
+   const mx=Math.floor((cw-0.12)/(0.13*0.9));D.text(L.tb,x+0.05*k,yb+0.1*k,0.13*k,String(val==null||val===''?'—':val).toUpperCase().slice(0,mx),0);
+   if(lab==='SHEET')sheetEnt=D.E[D.E.length-1];
+   x+=cw*k;if(ci<row.length-1)D.line(L.tb,x,yb,x,yb+r);});});
+  const sh={id,title,k,i0,i1:D.mark(),ox,W,H,over,sheetEnt};S.push(sh);
+  ox+=W+1*k;
+  return sh;
+ }
+ const T=(l,x,y,hh,s,j,rot)=>D.text(l,x,y,hh,s,j,rot);
+ const ped=R.peds;
+ /* ---------- 1. Footing plan ---------- */
+ const yA=ped.length?ped[0].y*12:0, xB=ped.length?ped[0].x*12:0;
+ sheet('plan','FOOTING PLAN',k=>{
+  const h=0.1*k, x0=-B12/2, x1=B12/2, y0=-L12/2, y1=L12/2;
+  D.rect(L.out,x0,y0,x1,y1);
+  const ext=0.5*k;
+  D.line(L.cl,x0-ext,0,x1+ext,0,D.ltype('CENTER'));D.line(L.cl,0,y0-ext,0,y1+ext,D.ltype('CENTER'));
+  T(L.txt,x1+ext+0.06*k,-h/2,h,'+x',0);T(L.txt,0,y1+ext+0.06*k,h,'+y',1);
+  T(L.txt,0.06*k,y0-ext-0.04*k,0.08*k,'CL FTG',0);
+  ped.forEach((p,i)=>{const px=p.x*12,py=p.y*12,bx=p.bx*12,by=p.by*12;
+   D.rect(L.ped,px-bx/2,py-by/2,px+bx/2,py+by/2);
+   T(L.txt,px,py+by/2+0.08*k,h,sfdEsc(p.label).toUpperCase()+' '+sfdwFI(bx)+' x '+sfdwFI(by),1);
+   const lx=px+p.lex*12, ly=py+p.ley*12, r=0.05*k;
+   D.circle(L.ld,lx,ly,r);D.line(L.ld,lx-1.8*r,ly,lx+1.8*r,ly);D.line(L.ld,lx,ly-1.8*r,lx,ly+1.8*r);
+   if(Math.abs(p.lex)>1e-9||Math.abs(p.ley)>1e-9){D.line(L.ld,px,py,lx,ly,D.ltype('HIDDEN'));
+    T(L.ld,px,py-by/2-0.16*k,0.08*k,'LOAD PT e = '+sfdwFI(p.lex*12)+', '+sfdwFI(p.ley*12),1);}});
+  /* section cuts */
+  const cutE=0.85*k;
+  D.line(L.cut,x0-cutE,yA,x0-ext-0.35*k,yA);D.line(L.cut,x1+ext+0.35*k,yA,x1+cutE,yA);
+  T(L.cut,x0-cutE-0.05*k,yA-0.06*k,0.14*k,'A',2);T(L.cut,x1+cutE+0.05*k,yA-0.06*k,0.14*k,'A',0);
+  D.line(L.cut,xB,y0-cutE,xB,y0-ext-0.35*k);D.line(L.cut,xB,y1+ext+0.35*k,xB,y1+cutE);
+  T(L.cut,xB,y0-cutE-0.2*k,0.14*k,'B',1);T(L.cut,xB,y1+cutE+0.05*k,0.14*k,'B',1);
+  /* dimensions: pedestal centres from the edges, then the overall size */
+  const xs=[x0,...[...new Set(ped.map(p=>+(p.x*12).toFixed(4)))].sort((a,b)=>a-b),x1];
+  const ys=[y0,...[...new Set(ped.map(p=>+(p.y*12).toFixed(4)))].sort((a,b)=>a-b),y1];
+  D.chainH(L.dim,xs,y0-1.45*k,y0);D.dimH(L.dim,x0,x1,y0-1.85*k,y0);
+  D.chainV(L.dim,ys,x1+1.45*k,x1);D.dimV(L.dim,y0,y1,x1+1.85*k,x1);
+  /* axes triad */
+  const tx=x0-1.2*k, ty=y0-1.45*k;D.line(L.ld,tx,ty,tx+0.4*k,ty);D.line(L.dim,tx,ty,tx,ty+0.4*k);
+  T(L.ld,tx+0.45*k,ty-0.04*k,0.08*k,'+x',0);T(L.dim,tx,ty+0.46*k,0.08*k,'+y',1);
+  T(L.txt,0,y0-2.3*k,0.16*k,'FOOTING PLAN',1);T(L.txt,0,y0-2.52*k,0.09*k,'SCALE '+(SFDW_SCALES.find(s=>s[0]===k)||[0,'1:'+k])[1]+';  LOAD POINTS (RED) AT x + e_x, y + e_y',1);
+ });
+ /* ---------- 2./3. Sections ---------- */
+ function section(dir){
+  const along=dir==='A'?'X':'Y', across=dir==='A'?'Y':'X', W=dir==='A'?B12:L12, cutAt=dir==='A'?yA:xB;
+  return k=>{
+   const h=0.1*k, x0=-W/2, x1=W/2;
+   D.rect(L.out,x0,0,x1,t12);
+   const g=Df12, ext=1.2*k;
+   D.line(L.soil,x0-ext,g,x1+ext,g);T(L.soil,x0-ext,g+0.05*k,0.08*k,'GRADE',0);
+   if(R.covEff>0){const ys=t12+R.covEff*12;D.line(L.soil,x0,ys,x1,ys,D.ltype('DASHED'));}
+   if(R.dw!==Infinity&&R.dw<=R.Df+2){const yw=g-R.dw*12;D.line(L.soil,x0-ext,yw,x1+ext,yw,D.ltype('HIDDEN'));T(L.soil,x1+ext,yw+0.05*k,0.08*k,'W.T.',2);}
+   /* pedestals cut by this section */
+   const cut=ped.map((p,i)=>({p,i})).filter(({p})=>dir==='A'?Math.abs(p.y*12-cutAt)<p.by*6-1e-6:Math.abs(p.x*12-cutAt)<p.bx*6-1e-6);
+   cut.forEach(({p,i})=>{const c=(dir==='A'?p.x:p.y)*12,b=(dir==='A'?p.bx:p.by)*12,hh=p.h*12;if(hh<=0)return;
+    D.rect(L.ped,c-b/2,t12,c+b/2,t12+hh);
+    const Lp=sfdwPedLayout(i), a=dir==='A'?Lp.ax:Lp.ay;
+    [c-a,c+a].forEach(xb=>D.line(L.bar,xb,LV.topOfBot,xb,t12+hh-Lp.cov));
+    for(let j=0;j<Lp.nt;j++){const z=t12+Math.min(j*Lp.ts,hh-Lp.cov);D.line(L.bar,c-a-Lp.db/2-Lp.tie/2,z,c+a+Lp.db/2+Lp.tie/2,z);}
+    const lx=c+(dir==='A'?p.lex:p.ley)*12;D.line(L.ld,lx,t12+hh+0.55*k,lx,t12+hh+0.05*k);D.line(L.ld,lx,t12+hh+0.05*k,lx-0.04*k,t12+hh+0.14*k);D.line(L.ld,lx,t12+hh+0.05*k,lx+0.04*k,t12+hh+0.14*k);
+    T(L.ld,lx,t12+hh+0.62*k,0.08*k,'P'+((dir==='A'?p.lex:p.ley)?' (e = '+sfdwFI((dir==='A'?p.lex:p.ley)*12)+')':''),1);
+    D.dimV(L.dim,t12,t12+hh,c+b/2+0.45*k,c+b/2);
+    T(L.txt,c,t12+hh+0.82*k,h,sfdEsc(p.label).toUpperCase(),1);});
+   /* bars: the mats running along the section as lines, the others as dots */
+   const bars=[];
+   [['bot','bot'],['top','top']].forEach(([lv])=>{
+    const kAl=lv+along, kAc=lv+across;
+    if(M[kAl]){const y=LV[kAl];D.line(L.bar,x0+M[kAl].c,y,x1-M[kAl].c,y);bars.push({k:kAl,y,x:x1-M[kAl].c-0.3*k});}
+    if(M[kAc]){const y=LV[kAc];M[kAc].pos.forEach(x=>D.circle(L.bar,x,y,Math.max(M[kAc].db/2,0.012*k)));bars.push({k:kAc,y,x:M[kAc].pos.length?M[kAc].pos[M[kAc].pos.length-1]:x1});}
+   });
+   /* callouts in a column to the right, top to bottom, with leaders */
+   const lab={botX:'BOTTOM x-BARS',botY:'BOTTOM y-BARS',topX:'TOP x-BARS',topY:'TOP y-BARS'};
+   const cx=x1+1.7*k;bars.sort((a,b)=>b.y-a.y);
+   const step=0.22*k, ytop=t12/2+(bars.length-1)*step/2;
+   bars.forEach((q,j)=>{const ty=ytop-j*step;D.pline(L.bar,[[q.x,q.y],[cx-0.5*k,ty],[cx-0.08*k,ty]]);T(L.txt,cx,ty-h/2,h,lab[q.k]+': '+sfdMatTxt(q.k).replace('→','->').toUpperCase(),0);});
+   /* dimensions */
+   D.dimV(L.dim,0,t12,x0-0.45*k,x0);D.dimV(L.dim,0,g,x0-0.9*k,x0);D.dimH(L.dim,x0,x1,-0.55*k,0);
+   T(L.txt,x0,-0.95*k,0.08*k,'COVER: '+sfdwIn(num(state.mat.coverBot))+' CLR BOTTOM, '+sfdwIn(num(state.mat.coverTop))+' CLR TOP, '+sfdwIn(sfdEndCover())+' CLR SIDES / ENDS',0);
+   T(L.txt,0,-1.35*k,0.16*k,'SECTION '+dir+'-'+dir,1);T(L.txt,0,-1.57*k,0.09*k,'SCALE '+(SFDW_SCALES.find(s=>s[0]===k)||[0,'1:'+k])[1]+';  CUT ALONG '+(dir==='A'?'x AT y = ':'y AT x = ')+sfdwFI(cutAt),1);
+  };
+ }
+ sheet('secA','SECTION A-A (ALONG x)',section('A'));
+ sheet('secB','SECTION B-B (ALONG y)',section('B'));
+ /* ---------- 4. Pedestal details ---------- */
+ ped.forEach((p,i)=>{if(p.h<=0)return;
+  sheet('ped'+i,'PEDESTAL DETAIL, '+String(p.label).toUpperCase(),k=>{
+   const Lp=sfdwPedLayout(i), bx=p.bx*12, by=p.by*12, h=0.1*k, rf=Lp.rf;
+   /* plan section */
+   D.rect(L.ped,-bx/2,-by/2,bx/2,by/2);
+   D.rect(L.bar,-Lp.tx,-Lp.ty,Lp.tx,Lp.ty);
+   Lp.pts.forEach(([x,y])=>D.circle(L.bar,x,y,Math.max(Lp.db/2,0.012*k)));
+   D.chainH(L.dim,Lp.xs,-by/2-0.45*k,-by/2);D.dimH(L.dim,-bx/2,bx/2,-by/2-0.85*k,-by/2);
+   D.chainV(L.dim,Lp.ys,bx/2+0.45*k,bx/2);D.dimV(L.dim,-by/2,by/2,bx/2+0.85*k,bx/2);
+   const nts=[(Lp.PB.n+'-#'+rf.longSize+' VERT  ('+Lp.PB.nx+' PER x-FACE, '+Lp.PB.ny+' PER y-FACE)').toUpperCase(),
+    ('#'+rf.tieSize+' TIES @ '+sfdwIn(num(rf.tieSpc))+';  COVER '+sfdwIn(Lp.cov)+' CLR TO VERT BARS').toUpperCase(),('DOWELS '+(rf.dowelN||0)+'-#'+rf.dowelSize).toUpperCase()];
+   nts.forEach((q,j)=>T(L.txt,-bx/2,by/2+(0.5-0.2*j)*k,h,q,0));
+   T(L.txt,0,-by/2-1.3*k,0.14*k,'PLAN SECTION',1);
+   /* elevation, to the right of the plan section and of its notes */
+   const wN=Math.max(...nts.map(q=>q.length))*h*0.9, hh=p.h*12, ex=Math.max(bx/2+2.6*k,-bx/2+wN+1.2*k)+bx/2;
+   D.rect(L.ped,ex-bx/2,0,ex+bx/2,hh);D.line(L.out,ex-bx/2-0.6*k,0,ex+bx/2+0.6*k,0);T(L.txt,ex+bx/2+0.6*k,0.05*k,0.08*k,'TOP OF FTG',2);
+   [ex-Lp.ax,ex+Lp.ax].forEach(xb=>D.line(L.bar,xb,-(t12-LV.topOfBot),xb,hh-Lp.cov));
+   D.line(L.out,ex-bx/2-0.6*k,-(t12-LV.topOfBot),ex+bx/2+0.6*k,-(t12-LV.topOfBot),D.ltype('HIDDEN'));
+   T(L.txt,ex+bx/2+0.6*k,-(t12-LV.topOfBot)+0.05*k,0.08*k,'TOP OF BOT MAT',2);
+   const zs=[];for(let j=0;j<Lp.nt;j++){const z=Math.min(j*Lp.ts,hh-Lp.cov);zs.push(z);D.line(L.bar,ex-Lp.tx,z,ex+Lp.tx,z);}
+   D.dimV(L.dim,0,hh,ex-bx/2-0.45*k,ex-bx/2);
+   if(zs.length>1)D.chainV(L.dim,zs,ex+bx/2+0.35*k,ex+bx/2);
+   const bz=(P2&&P2.bearing&&P2.bearing[i])||null;
+   if(bz&&!bz.isPatch)T(L.txt,ex-bx/2,-(t12-LV.topOfBot)-0.3*k,0.09*k,('DOWEL EMBED. AVAILABLE '+sfdwIn(bz.availEmb)+' >= L_DC = '+sfdwIn(bz.Ldc)+(bz.ldcOK?'':' (NG)')).toUpperCase(),0);
+   T(L.txt,ex,-(t12-LV.topOfBot)-0.7*k,0.14*k,'ELEVATION',1);
+   T(L.txt,(ex)/2,-(t12-LV.topOfBot)-1.1*k,0.16*k,'PEDESTAL '+String(p.label).toUpperCase()+';  '+sfdwFI(bx)+' x '+sfdwFI(by)+' x '+sfdwFI(hh),1);
+  });});
+ /* ---------- 5. Reinforcement schedule (paper inches, k = 1) ---------- */
+ const rows=[];
+ const mk={botX:['F1','FOOTING BOTTOM, x-BARS','ACROSS L'],botY:['F2','FOOTING BOTTOM, y-BARS','ACROSS B'],topX:['F3','FOOTING TOP, x-BARS','ACROSS L'],topY:['F4','FOOTING TOP, y-BARS','ACROSS B']};
+ ['botX','botY','topX','topY'].forEach(k=>{const e=M[k];if(!e)return;
+  rows.push([mk[k][0],mk[k][1],'#'+e.size,String(e.pos.length),sfdwFI(e.len),(e.mode==='qty'?e.n+' BARS -> @ '+sfdwIn(e.spc):'@ '+sfdwIn(e.spc))+' '+mk[k][2],'STRAIGHT; '+sfdwIn(e.c)+' END COVER'+(e.mode==='qty'?'; ENTERED AS QTY':'')]);});
+ ped.forEach((p,i)=>{if(p.h<=0)return;const Lp=sfdwPedLayout(i),rf=Lp.rf,n='P'+(i+1),bz=(P2&&P2.bearing&&P2.bearing[i])||null;
+  rows.push([n+'V',String(p.label).toUpperCase()+' VERTICAL','#'+rf.longSize,String(Lp.PB.n),sfdwFI(Lp.h-Lp.cov),Lp.PB.nx+' PER x-FACE, '+Lp.PB.ny+' PER y-FACE','PED. HEIGHT LESS TOP COVER; EXTENSION INTO FTG BY DETAIL']);
+  if(Lp.tie>0)rows.push([n+'T',String(p.label).toUpperCase()+' TIES','#'+rf.tieSize,String(Lp.nt),sfdwFI(4*0+2*(2*Lp.tx)+2*(2*Lp.ty)),'@ '+sfdwIn(Lp.ts),'CLOSED TIE, PERIMETER ON CL; HOOKS NOT INCL.']);
+  if(rf.dowelN>0)rows.push([n+'D',String(p.label).toUpperCase()+' DOWELS','#'+rf.dowelSize,String(rf.dowelN),'—','—',bz?'EMBED >= L_DC '+sfdwIn(bz.Ldc)+' (AVAIL. '+sfdwIn(bz.availEmb)+'); PROJECTION BY DETAIL':'']);});
+ sheet('sched','REINFORCEMENT SCHEDULE',k=>{
+  const cols=[['MARK',0.7],['LOCATION',3.2],['SIZE',0.7],['NO.',0.6],['LENGTH',1.1],['SPACING / ARRANGEMENT',3.6],['NOTES',5.3]], rh=0.3, h=0.1;
+  const Wt=cols.reduce((a,c)=>a+c[1],0), y0=0;
+  T(L.txt,0,y0+0.25,0.16,'REINFORCEMENT SCHEDULE',0);
+  const all=[cols.map(c=>c[0]),...rows];
+  all.forEach((r,j)=>{let x=0;const y=y0-j*rh;
+   r.forEach((c,ci)=>{const w=cols[ci][1],mx=Math.floor((w-0.1)/(h*0.9));T(L.txt,x+0.05,y-rh+0.1,h,String(c).slice(0,mx),0);x+=w;});
+   D.line(L.tb,0,y-rh,Wt,y-rh);});
+  D.rect(L.tb,0,y0-all.length*rh,Wt,y0);let x=0;cols.forEach(c=>{x+=c[1];if(x<Wt-1e-9)D.line(L.tb,x,y0,x,y0-all.length*rh);});
+  D.line(L.tb,0,y0-rh,Wt,y0-rh);
+  const nt=['Bar counts and spacings are as entered on the Reinforcement and Pedestals tabs (spacing, or total quantity: s = (12w - 2c - db)/(n - 1)).',
+   'Footing bars straight, full length less the end cover; where Footing Design 5.4 reports "hooks required", hook the bars.',
+   'Pedestal vertical bars: count and faces as laid out by the tool; their extension into the footing and the dowel projection are detailed by the engineer.',
+   'Lengths are bar lengths in ft-in to the nearest 1/8 in; no laps.'];
+  nt.forEach((s,j)=>T(L.txt,0,y0-(all.length+1)*rh-j*0.2,h,s,0));
+ },1);
+ /* ---------- 6. General notes (k = 1) ---------- */
+ sheet('notes','GENERAL NOTES',k=>{
+  const G=R.govBear, cap=G&&G.cap, qa=cap?(cap.direct?cap.qa:cap.qall):null;
+  const notes=[
+   'DESIGN CODES: ACI 318-19 (CONCRETE); ASCE/SEI 7-16 SEC. 2.3.1 AND 2.4.1 (LOAD COMBINATIONS); IBC 2021.'+(state.stab.eccMode&&state.stab.eccMode.indexOf('a_')===0?' ECCENTRICITY LIMIT PER AASHTO LRFD 10TH ED. (2024).':''),
+   'BEARING CAPACITY: '+(state.soil.mode==='vesic'?'VESIC / MEYERHOF EFFECTIVE AREA, FS = '+f2(R.FSb)+(state.soil.qaOverride==='on'?' (ALLOWABLE BEARING OVERRIDDEN BY USER)':''):'ALLOWABLE BEARING PRESSURE GIVEN ('+String(state.soil.qaBasis).toUpperCase()+')')+'.',
+   'ALLOWABLE BEARING PRESSURE'+(state.soil.mode==='vesic'?' (GOVERNING CASE '+(G?G.cb.name:'')+')':'')+': '+(qa!=null?f2(qa)+' KSF':'N/A')+'. SOIL UNIT WEIGHT '+Math.round(R.gs*1000)+' PCF; WATER TABLE '+(R.dw===Infinity?'NOT PRESENT':f2(R.dw)+' FT BELOW GRADE')+'.',
+   "CONCRETE: F'C = "+Math.round(R.fc)+' PSI, UNIT WEIGHT '+Math.round(R.gc*1000)+' PCF'+(num(state.mat.lambda)<1?', LIGHTWEIGHT FACTOR '+f2(num(state.mat.lambda)):'')+'.',
+   'REINFORCEMENT: ASTM A615 / A706 BARS, FY = '+Math.round(num(state.mat.fy))+' PSI'+(state.mat.coating==='epoxy'?', EPOXY-COATED':', UNCOATED')+'.',
+   'CLEAR COVER: '+sfdwIn(num(state.mat.coverBot))+' BOTTOM (CAST AGAINST EARTH), '+sfdwIn(num(state.mat.coverTop))+' TOP, '+sfdwIn(sfdEndCover())+' SIDES AND ENDS; PEDESTALS: '+state.peds.map(p=>String(p.label).toUpperCase()+' '+sfdwIn(num(p.reinf.cover))).join(', ')+'.',
+   'FOOTING: '+sfdwFI(R.B*12)+' (x) BY '+sfdwFI(R.L*12)+' (y) BY '+sfdwFI(R.t*12)+' THICK; BEARING '+sfdwFI(R.Df*12)+' BELOW GRADE; SOIL COVER '+sfdwFI(R.covEff*12)+'.',
+   'LOADS AT THE TOP OF EACH PEDESTAL AT THE LOAD POINT SHOWN (OFFSET e FROM THE PEDESTAL CENTROID). '+(R.directMode?'DIRECT FACTORED LOADS.':'SERVICE LOADS BY TYPE; COMBINATIONS GENERATED.'),
+   'AXES: ORIGIN AT THE FOOTING CENTROID; +x TOWARD THE B/2 EDGE, +y TOWARD THE L/2 EDGE.',
+   'SEE THE CALCULATION REPORT (REPORT TAB) FOR THE DESIGN; THESE DRAWINGS SHOW THE GEOMETRY AND BARS AS ENTERED AND CHECKED BY THE TOOL.'];
+  if(String(state.assump||'').trim())notes.push('PROJECT ASSUMPTIONS: '+String(state.assump).trim().toUpperCase());
+  T(L.txt,0,0.3,0.16,'GENERAL NOTES',0);
+  let y=0;const h=0.11,mx=Math.floor(15/(h*0.9));
+  notes.forEach((s,j)=>{const words=String(s).split(/\s+/);let line=(j+1)+'. ',first=true;const out=[];
+   words.forEach(w=>{if((line+w).length>mx){out.push(line);line='    '+w+' ';}else line+=w+' ';});out.push(line);
+   out.forEach(l=>{T(L.txt,0,y,h,l.trimEnd(),0);y-=0.2;});y-=0.08;});
+ },1);
+ S.forEach((s,j)=>{s.sheetEnt.s=SharedDxf.str((j+1)+' OF '+S.length);});
+ return {D,S};
+}
+/* SVG of one sheet: its entity range */
+function sfdwSheetSVG(B,s){return SharedDxf.toSVG(B.D,{i0:s.i0,i1:s.i1,bg:'#fff',title:s.title,pad:0});}
+function renderDrawings(){
+ const T=document.getElementById('tab-drawings');if(!T)return;
+ if(!window.SharedDxf){T.innerHTML='<div class="errbox">shared/dxf.js is not loaded: keep the shared folder next to this file.</div>';return;}
+ if(!R||R.fatal){T.innerHTML='<div class="errbox">No drawings: correct the input errors shown in the Summary.</div>';return;}
+ let B;try{B=sfdwBuild();}catch(e){T.innerHTML='<div class="errbox">The drawings could not be drawn: '+sfEsc(e&&e.message)+'</div>';return;}
+ SFDW.B=B;
+ let want=SFDW.cur;if(!want){try{want=localStorage.getItem(SFDW.key)||'';}catch(e){want='';}}
+ const cur=B.S.find(s=>s.id===want)||B.S[0];SFDW.cur=cur.id;
+ const SRC={plan:['schem','Schematic'],secA:['footdes','Footing Design'],secB:['footdes','Footing Design'],sched:['footdes','Footing Design / Pedestal Design'],notes:['report','Report']};
+ const src=id=>SRC[id]||(/^ped/.test(id)?['peddes','Pedestal Design']:null);
+ const scName=k=>k===1?'NTS (paper inches)':((SFDW_SCALES.find(q=>q[0]===k)||[0,'1:'+k])[1]);
+ T.innerHTML='<div class="sfdwBar"><label>Sheet <select id="sfdwSheet">'+B.S.map((s,j)=>'<option value="'+s.id+'"'+(s===cur?' selected':'')+'>'+(j+1)+'. '+sfEsc(s.title)+'</option>').join('')+'</select></label>'+
+  '<button type="button" id="sfdwDxf">Download DXF ('+B.S.length+' sheets)</button></div>'+
+  '<div class="note">One DXF file (AutoCAD R12, model space, full size in inches): each sheet is a B-size sheet (17 × 11 in) drawn at its plot scale inside its border and title block, side by side; plot each sheet at its scale. Layers S-CONC, S-PED, S-REBAR, S-DIMS, S-TEXT, S-CNTR, S-LOAD, S-SOIL, S-CUT, S-TBLK, S-BRDR; dimensions are DIMENSION entities. The preview is drawn from the same entities as the file. Geometry and bars as entered; every value is worked on the tab named in the index.</div>'+
+  '<div class="sfdwHead"><b>'+(B.S.indexOf(cur)+1)+'. '+sfEsc(cur.title)+'</b> · scale '+sfEsc(scName(cur.k))+(cur.over?' · <span style="color:#b71c1c">does not fit the sheet even at the smallest scale</span>':'')+'</div>'+
+  '<div class="sfdwBox"></div><div class="note">Wheel: zoom about the cursor · drag: pan · pinch on a touch screen · double-click: fit · + / − / Fit buttons.</div>'+
+  '<table class="tbl sfdwIdx"><tr><th>No.</th><th>Sheet</th><th>Scale</th><th>Worked on</th></tr>'+B.S.map((s,j)=>{const w=src(s.id);
+   return '<tr data-sfdw="'+s.id+'"'+(s===cur?' class="on"':'')+'><td>'+(j+1)+'</td><td style="text-align:left">'+sfEsc(s.title)+'</td><td>'+sfEsc(scName(s.k))+'</td><td style="text-align:left">'+(w?'<a href="#" data-sfdwgo="'+w[0]+'">'+w[1]+' tab</a>':'—')+'</td></tr>';}).join('')+'</table>';
+ SharedDxf.viewer(T.querySelector('.sfdwBox'),sfdwSheetSVG(B,cur),{height:'68vh'});
+ const pick=id=>{SFDW.cur=id;try{localStorage.setItem(SFDW.key,id);}catch(e){}renderDrawings();};
+ T.querySelector('#sfdwSheet').addEventListener('change',e=>pick(e.target.value));
+ T.querySelectorAll('tr[data-sfdw]').forEach(tr=>tr.addEventListener('click',e=>{if(e.target.closest('a'))return;pick(tr.dataset.sfdw);}));
+ T.querySelectorAll('[data-sfdwgo]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();sfrGoto(a.dataset.sfdwgo);}));
+ T.querySelector('#sfdwDxf').addEventListener('click',()=>{
+  const txt=B.D.toDXF({ltscale:1}),chk=SharedDxf.validate(txt);
+  if(!chk.ok){alert('The DXF file failed its structure check:\n'+chk.errors.slice(0,8).join('\n'));return;}
+  SharedDxf.download(txt,(state.meta.number||state.meta.project||'spread_footing').replace(/[^\w.-]+/g,'_')+'_drawings.dxf');});
+}
+</script>
+<script>
@@ -3329,0 +3594 @@ function recalc(){
+ if($('#tab-drawings').classList.contains('active'))renderDrawings();   /* SFDW */
@@ -3358,0 +3624 @@ $('#tabbar').addEventListener('click',e=>{
+ if(b.dataset.tab==='tab-drawings')renderDrawings();   /* SFDW */
```

## 2026-11-01 — PR: claude/sf-ped-cover — Pedestal P–M interaction: bar centres at cover + d_b/2 (cover to the bar face) (SFPC, calculation change) (PR link added after merge)

Line numbers are approximate; search for the anchor text. Every code site is tagged `SFPC`.

### SFPC. Pedestal longitudinal bars placed at cover + d_b/2 from each face in the biaxial P–M check   [calculation change; CLAUDE.md §4]
- **Engineer decision (2026-11-01):** the biaxial P–M check placed the corner and face bars with the cover measured to the bar **centre**, while the bar-fit check measured it to the bar **face**. Make the P–M check measure the cover to the bar face, and apply it everywhere pedestal bar positions are derived.
- **How the app defines the pedestal cover input** (pedestal card, "Cover (in)", `peds[i].reinf.cover`): the **clear cover to the longitudinal (vertical) bars**. That is the basis of:
  - the bar-fit clear-spacing check (`clrX = (b_x − 2c − d_b)/(n_x − 1) − d_b`, ACI 318-19 25.2.3);
  - the bar layout rules of #519 (`sfdPedBars`: corner-bar centre span L_c = b − 2c − d_b);
  - the drawings (`sfdwPedLayout`: centres at b/2 − c − d_b/2; note "COVER … CLR TO VERT BARS"; ties drawn outside the bars).
  
  So the bar centre is at **d′ = c + d_b/2** from each face. The tie diameter is **not** added: the input is not a cover to the ties. Clear cover to the ties is c − d_tie. ACI 318-19 20.5.1.3 states the specified cover to the outermost reinforcement, which in a tied pedestal is the tie; see open items.
- **Where:**
  - `computePhase2` → `pedDes` (anchor `const pmBars=pedBarCoords(`):
    - before: `const pmBars=pedBarCoords(bx,by,cover,PB.nx,PB.ny,BAR_AREA[rf.longSize||0]);`
    - after: `const dPr=num(cover)+(BAR_DIA[rf.longSize]||0)/2, dX=bx-dPr, dY=by-dPr;` then `const pmBars=pedBarCoords(bx,by,dPr,PB.nx,PB.ny,BAR_AREA[rf.longSize||0]);`
    - Also returned: `pedDes[].dPr, dX, dY` (new keys, display only).
  - `pedBarCoords`: unchanged. Its `coverIn` argument is face to bar centre; a comment says so.
  - 3D view `buildRebar` (anchor `const cv=(rf.cover||2)/12`):
    - before: `const cv=(rf.cover||2)/12;`, ties at the bar centrelines `tieLoop(x0,x1,y0,y1,…)`;
    - after: `const cv=(rf.cover||2)/12+db/2;`; ties drawn outside the bars, as in the drawings: `const to=db/2+tie/2;` `tieLoop(x0-to,x1+to,y0-to,y1+to,…)`.
  - Unchanged, because they already used the face basis: the bar-fit check, `sfdPedBars` (the #519 layout rules) and the drawings (`sfdwPedLayout`).
  - The pedestal has no shear or flexure check that uses an effective depth. d_x and d_y are only the depths to the far bar row in the P–M section, and are shown for the hand check.
- **Shown (§6):**
  - Pedestal Design 6.x: a new equation block "Bar positions for the P–M interaction": d′ = c + d_b/2 and d_x = b_x − d′, d_y = b_y − d′, with values. The note under the P–M plot now names the bar-centre basis.
  - Report §6, each pedestal: a new topic "Bar positions for the P–M interaction" (steps d′, d_x, d_y).
  - User manual 2.7: defines the pedestal cover. Input-table header tooltip: "Clear cover to the longitudinal (vertical) bars".
- **Governing provisions:**
  - ACI 318-19 20.5.1.3: concrete cover, measured to the reinforcement surface (clear cover).
  - ACI 318-19 22.2.1 to 22.2.2: strain compatibility, ε_cu = 0.003, 0.85f′c block, β1.
  - ACI 318-19 21.2.2: φ by net tensile strain, 0.65 to 0.90.
  - ACI 318-19 25.2.3: clear spacing (bar fit; unchanged).
- **Before / after:** bar centres move inward by d_b/2 on every face. φP_n,max, ρ, ties, bar fit and every footing, bearing and stability result are unchanged. Only the P–M capacity contour changes, and it gets smaller, so the result is more conservative.
- **Check case (hand), default project, Ped 1:**
  - Input: 18 × 18 in, 8 #8 (3 per face, A_b = 0.79 in², d_b = 1.00 in), c = 2.00 in, f′c = 4000 psi, f_y = 60 ksi, E_s = 29 000 ksi, β1 = 0.85, P_u = 240.81 kip (envelope max). Uniaxial, bending about x (M_y = 0).
  - Bar rows: 3 bars at d′ from the compression face, 2 at mid-depth (9 in), 3 at d.
  - **Before** (d′ = 2.00, d = 16.00 in):
    - c = 6.633 in, a = 5.638 in, C_c = 0.85·4·5.638·18 = 345.05 k;
    - compression row ε = 0.00210, f_s = 60 − 3.4 = 56.60 ksi → 134.14 k;
    - mid row ε = −0.00107, −31.05 ksi → −49.05 k;
    - tension row ε_t = 0.00424, −60 ksi → −142.20 k;
    - P_n = 287.94 k, φ = 0.65 + 0.25(0.00424 − 0.002)/0.003 = 0.836, φP_n = 240.8 k;
    - M_n = 338.93 k-ft, **φM_nx = 283.5 k-ft**.
  - **After** (d′ = 2.00 + 1.00/2 = 2.50, d = 15.50 in):
    - c = 6.980 in, a = 5.933 in, C_c = 363.10 k;
    - compression row ε = 0.00193, 55.84 − 3.40 = 52.44 ksi → 124.28 k;
    - mid row ε = −0.00087, −25.18 ksi → −39.78 k;
    - tension row ε_t = 0.00366, −60 ksi → −142.20 k;
    - P_n = 305.40 k, φ = 0.789, φP_n = 240.8 k;
    - M_n = 326.91 k-ft, **φM_nx = 257.8 k-ft** (−9.1 %).
  - App (strip-integrated contour, 180 angles): 280.78 → 255.61 k-ft (−8.97 %). This agrees with the hand values within 1 %, the strip discretization of `pmContour`.
  - Largest demand / contour ratio of Ped 1: 0.0570 → 0.0626.
- **Effect on the comparison projects** (headless Chromium, origin/main vs the branch; φM_n at P_u,max from the contour along the axes; ratio = largest |M_u| / contour radius along the same direction, the plotted basis):

  | Project | Pedestal | φM_nx before → after (k-ft) | φM_ny before → after (k-ft) | max ratio before → after | points inside the plotted contour |
  |---|---|---|---|---|---|
  | default | Ped 1 / Ped 2 | 280.78 → 255.61 / 238.69 → 225.52 | same as x | 0.0570 → 0.0626 / 0.0670 → 0.0709 | 9/9, 9/9 unchanged |
  | direct | Ped 1 / Ped 2 | 269.05 → 249.18 / 232.25 → 222.52 | same | 0.0595 → 0.0642 / 0.0689 → 0.0719 | unchanged |
  | wt_ecc_gate_3ped | Ped 1 / 2 / 3 (15 × 24) | 280.78 → 255.61 / 238.69 → 225.52 / 359.90 → 347.46 | Ped 3: 208.50 → 198.68 | 0.2671 → 0.2934 / 0.1718 → 0.1818 / 0.0384 → 0.0403 | unchanged |
  | directqa_net_fail | Ped 1 (4 #8); Ped 2 patch | 233.28 → 225.09 | same | 0.0686 → 0.0711 | unchanged |
  | single_moment | Ped 1 | 280.78 → 255.61 | same | 0.2346 → 0.2503 | unchanged |
  | direct_moment | Ped 1 / Ped 2 | 275.81 → 252.95 / 249.28 → 233.11 | same | 0.1394 → 0.1488 / 0.1437 → 0.1541 | unchanged |
  | fatal | — | no pedestal design | | | |
  | extra: offsets | Ped 2 | 238.69 → 225.52 | same | **1.0639 → 1.1144** | **8/9 → 6/9** |
  | extra: uplift_partial | Ped 1 | 280.78 → 255.61 | same | 0.7978 → 0.8763 | unchanged |
  | extra: qty_modes | Ped 1 (14 #8) / Ped 2 (12 #8) | 327.83 → 303.17 / 281.28 → 263.87 | Ped 1: 363.65 → 332.61 | 0.0440 → 0.0481 / 0.0569 → 0.0606 | unchanged |

  - The one pass/fail change: the offsets project (load offsets, Ped 2, already outside the contour at 1.06). Two more combinations fall outside the plotted contour. It is explained by the smaller contour.
- **Nothing outside the pedestal P–M changes (proof):**
  - On all 10 projects, every value of `R` and `P2`, the dashboard, warnings, self-consistency, state and saved storage are identical, except `P2.pedDes[].pmBars[].x/y`. New keys only: `pedDes[].dPr/dX/dY`.
  - The result tab text differs only on Pedestal Design (the new block and the note).
  - The DXF of the drawings is byte-identical on all 10 projects.
  - The #519 layout rules (`sfdPedBars`: total-quantity split, spacing → ceil(L_c/s) + 1, L_c = b − 2c − d_b) are not touched, and `pedDes.PB` is identical in every project, including the quantity/spacing project.
- **Saved data (§5):** no key or format change. Old projects load with the same inputs; only the P–M contour changes, as above.
- **How verified:**
  - `node tests/check-syntax.mjs "Spread Footing.html"` passes.
  - Headless Chromium comparison scripts (see above).
  - The report builds with 0 KaTeX errors and 0 unresolved references.
  - 0 console errors.
- **Open items (not changed; §9):**
  - **ACI 318-19 20.5.1.3:** cover is specified to the outermost steel (the ties). With the cover input defined as clear to the longitudinal bars, the tie cover is c − d_tie (default 2 − 0.375 = 1.625 in ≥ 1.5 in). There is no check of the tie cover. The engineer is to decide whether the input should become cover to the ties (bar centre = c + d_tie + d_b/2). That would also change the #519 layout L_c and the bar-fit check.
  - The bar-fit check uses d_b = size/8 (#9 to #11: 1.125/1.25/1.375 in), while `sfdPedBars`, the drawings and now the P–M check use `BAR_DIA` (1.128/1.27/1.41 in). This is an existing difference, raised and not changed.
  - The P–M result is shown only as the plot colouring (no DCR in the summary table or the dashboard), and the contour is drawn at P_u,max for every combination. This is existing behaviour.
  - At 390 px the output panel collapses to zero width on origin/main as well. This is existing, and not in scope.

Diff (`Spread Footing.html`, `git diff -U0` against origin/main):

```diff
diff --git a/Spread Footing.html b/Spread Footing.html
index 84f1b12..c822dc3 100644
--- a/Spread Footing.html	
+++ b/Spread Footing.html	
@@ -798 +798 @@ function buildPedCards(){
-  rt.innerHTML='<tr><th>Long. bar</th><th>n along x-face</th><th>n along y-face</th><th>Tie bar</th><th>Tie spc (in)</th><th>Cover (in)</th></tr>';
+  rt.innerHTML='<tr><th>Long. bar</th><th>n along x-face</th><th>n along y-face</th><th>Tie bar</th><th>Tie spc (in)</th><th title="Clear cover to the longitudinal (vertical) bars">Cover (in)</th></tr>';
@@ -3160,0 +3161,4 @@ function sfrModel(){
+   T.push({title:'Bar positions for the P–M interaction',ref:'ACI 318-19 20.5.1.3 (cover), 22.2 (strain compatibility)',steps:[   /* SFPC */
+    S({id:'dpr',label:'Face to longitudinal-bar centre (cover = clear cover to the longitudinal bars)',sym:"d'",eq:'c + \\frac{d_{b}}{2}',sub:sfrN(num(rf.cover))+' + \\frac{'+sfrN(BAR_DIA[rf.longSize]||0,3)+'}{2}',value:pd.dPr,unit:'in',d:3}),
+    S({id:'dx',label:'Depth to the far bar row, bending about y',sym:'d_{x}',eq:"b_{x} \\minus d'",sub:sfrN(pd.bx,1)+' \\minus '+sfrN(pd.dPr,3),value:pd.dX,unit:'in',d:3}),
+    S({id:'dy',label:'Depth to the far bar row, bending about x',sym:'d_{y}',eq:"b_{y} \\minus d'",sub:sfrN(pd.by,1)+' \\minus '+sfrN(pd.dPr,3),value:pd.dY,unit:'in',d:3})]});
@@ -4474 +4478,5 @@ function computePhase2(R){
-  const pmBars=pedBarCoords(bx,by,cover,PB.nx,PB.ny,BAR_AREA[rf.longSize||0]);
+  /* SFPC (2026-11-01, engineer): the cover input is the clear cover to the longitudinal bars (the
+     bar-fit check, the sfdPedBars layout and the drawings); bar centres are cover + d_b/2 from each
+     face (before: cover to the bar centre). d_x, d_y = depth to the far bar row about each axis. */
+  const dPr=num(cover)+(BAR_DIA[rf.longSize]||0)/2, dX=bx-dPr, dY=by-dPr;
+  const pmBars=pedBarCoords(bx,by,dPr,PB.nx,PB.ny,BAR_AREA[rf.longSize||0]);
@@ -4481 +4489 @@ function computePhase2(R){
-   pmBars,pmPts,fc,fy,PB};
+   pmBars,pmPts,fc,fy,PB,dPr,dX,dY};
@@ -4487,0 +4496 @@ function pedBarCoords(bx,by,coverIn,nx,ny,barArea){
+ // coverIn = face to bar CENTRE (SFPC: the caller passes cover + d_b/2)
@@ -4994,0 +5004,4 @@ function renderPedestalDesign(){
+  b.appendChild(eqBlock('Bar positions for the P\u2013M interaction','ACI 318-19 20.5.1.3 (cover to the longitudinal bars, as entered), 22.2',   /* SFPC */
+   "d' = c + \\tfrac{d_b}{2},\\qquad d_x = b_x - d',\\qquad d_y = b_y - d'",
+   "d' = "+f2(num(state.peds[i].reinf.cover))+' + \\tfrac{'+f3(BAR_DIA[state.peds[i].reinf.longSize]||0)+"}{2} = "+f3(pd.dPr)+'\\;\\mathrm{in}',
+   'd_x = '+f2(pd.bx)+' - '+f3(pd.dPr)+' = '+f3(pd.dX)+'\\;\\mathrm{in},\\qquad d_y = '+f2(pd.by)+' - '+f3(pd.dPr)+' = '+f3(pd.dY)+'\\;\\mathrm{in}'));
@@ -5009 +5022 @@ function renderPedestalDesign(){
-  b.appendChild(el('div','note','Biaxial load contour: the closed curve is the capacity envelope \u03c6M_nx\u2013\u03c6M_ny computed at the governing axial load by strain compatibility for the entered bar layout (0.85f\u2032c stress block, \u03b5cu = 0.003, \u03c6 by strain). Each point is a factored combination\u2019s (M_ux, M_uy) demand at this pedestal; points inside the contour pass. Because the contour size varies with axial load, points are shown against the contour at the maximum P_u (conservative for gravity-dominated cases). Verify any borderline point at its own axial level.'));
+  b.appendChild(el('div','note','Biaxial load contour: the closed curve is the capacity envelope \u03c6M_nx\u2013\u03c6M_ny computed at the governing axial load by strain compatibility for the entered bar layout, bar centres at d\u2032 = cover + d<sub>b</sub>/2 from each face (0.85f\u2032c stress block, \u03b5cu = 0.003, \u03c6 by strain). Each point is a factored combination\u2019s (M_ux, M_uy) demand at this pedestal; points inside the contour pass. Because the contour size varies with axial load, points are shown against the contour at the maximum P_u (conservative for gravity-dominated cases). Verify any borderline point at its own axial level.'));
@@ -5308 +5321 @@ function buildRebar(){
-  const cv=(rf.cover||2)/12;
+  const cv=(rf.cover||2)/12+db/2;   // SFPC: bar centre at cover + d_b/2 from the face (as the P-M check and the drawings)
@@ -5323 +5336,2 @@ function buildRebar(){
-   for(let k=0;k<=nt;k++){const zt=zc0+k*spc;if(zt>zc1)break;g.add(tieLoop(x0,x1,y0,y1,zt,tie,steel));}}
+   const to=db/2+tie/2;   // SFPC: tie centreline outside the bars (as the drawings)
+   for(let k=0;k<=nt;k++){const zt=zc0+k*spc;if(zt>zc1)break;g.add(tieLoop(x0-to,x1+to,y0-to,y1+to,zt,tie,steel));}}
@@ -5794 +5808 @@ manPart("p2","2. Input Reference",[
-{p:"Each pedestal card: label; plan position (x, y) of its centroid <i>relative to the footing centroid</i>; plan dimensions b<sub>x</sub> &times; b<sub>y</sub>; height h above the footing top; the load table (per mode); and its reinforcement (long. bar size, bars per face n<sub>x</sub>/n<sub>y</sub>, tie size and spacing, cover, dowel size and count)."},
+{p:"Each pedestal card: label; plan position (x, y) of its centroid <i>relative to the footing centroid</i>; plan dimensions b<sub>x</sub> &times; b<sub>y</sub>; height h above the footing top; the load table (per mode); and its reinforcement (long. bar size, bars per face n<sub>x</sub>/n<sub>y</sub>, tie size and spacing, cover, dowel size and count). The pedestal <b>cover</b> is the clear cover to the longitudinal bars: the bar-fit check, the bar layout, the P\u2013M interaction and the drawings all place the bar centres at cover + d<sub>b</sub>/2 from each face, with the ties outside the bars (clear cover to the ties = cover \u2212 d<sub>tie</sub>)."},
```

## 2026-11-01 — PR: claude/sf-scroll-fix — The page could be scrolled by script and not scrolled back ("won't let me scroll up") (SFSC; UI only, no calculation change) (PR link added after merge)

Line numbers are approximate; search for the anchor text. Every code site is tagged `SFSC`.

### SFSC. Two-panel layout: the document stays at scroll 0   [UI only]
- **Engineer report (2026-11-01):** "sometimes if I scroll down it won't let me scroll up. I have to refresh the page" (Chrome / Edge, `file://`).
- **Cause (reproduced headless, Chromium, 1280×800, 1366×768, 1920×1080):**
  - On screens ≥ 900 px the page is a fixed frame: `body{height:100vh;overflow:hidden}`, `.main{overflow:hidden}`, and the input (`.inp`) and output (`.out`) panels scroll. `body`'s `overflow:hidden` is applied to the window (viewport), which therefore has no scroll bar and is not scrolled by the wheel or touch, but can still be scrolled by script.
  - KaTeX writes a hidden MathML copy of every equation (`span.katex-mathml`, `position:absolute; clip:rect(1px,1px,1px,1px)`). Neither panel nor `.main` was positioned, so those spans' containing block was the page itself and they escaped the panels' overflow clip. With the default project the document became taller than the window by 125 px to 19 500 px depending on the tab (Report tab the most).
  - Any scroll by script then scrolled the page itself as well as the panel: the Worked-in links (`sfdGoto`, `scrollIntoView`), the input-tab links (`sfdGotoInput`), the report's "see §" links (`shared/report.js`), the report's tab links (`sfrGoto`, which also called `window.scrollTo(0, tab bar top)`), a `focus()` below the fold, find-in-page. Measured page scroll after one click: 171–245 px (title row, project bar and the top of both panels pushed off the top), up to 18 800 px after a scroll to the bottom of the report. The wheel and touch then went to the panels only (both back at 0), so the page could not be scrolled back; only a reload reset it.
- **Fix:**
  1. CSS, in `@media screen and (min-width:900px)`, after `.tabbar{position:sticky;top:0;z-index:4;background:#fafafa}`:
     - Before: (none)
     - After: `.inp,.out{position:relative}` — the panels contain (and clip) their absolutely positioned descendants. The only such descendants found in the panels on any tab are the KaTeX MathML spans (invisible); no offsets are set, so nothing moves on screen.
  2. `sfrGoto(name)`, anchor `window.scrollTo(0,b.getBoundingClientRect().top+window.scrollY-10)`:
     - Before: `const b=$$('#tabbar button').find(x=>x.dataset.tab==='tab-'+name);if(b){b.click();window.scrollTo(0,b.getBoundingClientRect().top+window.scrollY-10);}`
     - After: `if(!b)return;b.click();` then, in the two-panel layout, `P.scrollTop+=pg.getBoundingClientRect().top-P.getBoundingClientRect().top-b.parentElement.offsetHeight` (the output panel scrolls so the tab page starts just below the sticky tab bar); below 900 px the old `window.scrollTo` (the page scrolls normally there).
  3. New, after `sfrGoto`: `function sfdPanelLayout()` (`matchMedia('screen and (min-width:900px)')`) and a passive `window` `scroll` listener that calls `window.scrollTo(0,0)` whenever the page itself is scrolled in the two-panel layout (a safety net for any other script or browser scroll). Not active below 900 px or in print.
- **Not changed:** the wheel zoom of the 3D view canvas and of the Drawings viewer (`shared/dxf.js`). They take the wheel only while the pointer is over the canvas / drawing (by design: wheel = zoom there); the panel still scrolls with the pointer beside them, and after a canvas drag. This is not what the report describes (it does not need a reload).
- **Saved data:** none touched. **Calculations:** none touched (the diff is one CSS rule, the scroll position in `sfrGoto`, and the scroll reset; no computed value is read or written).
- **How verified:** `tests/smoke/spread-footing-scroll.mjs` (new). It opens every output tab, wheels each panel down and back up, clicks Worked-in links, an input-tab link, `sfrGoto` for output and input tabs, report "see §" links, a `scrollIntoView` of the panel bottom, a `focus()` on the last input, `window.scrollTo(0,400)`, a 3D-canvas drag, touch swipes, and checks that the page stays at scroll 0, the document is no taller than the window, and both panels wheel back to 0 with the title row on screen; and that the page still scrolls below 900 px. origin/main: 109 failures (as above); this branch: pass. `node tests/check-syntax.mjs "Spread Footing.html"` passes.
- **Check case:** default project, 1280×800, tab 5 (Footing Design), output panel scrolled to the bottom, click the first "Worked in" link. Before: `document.scrollingElement.scrollTop` = 219, the title row is 219 px above the window and cannot be scrolled back. After: 0; the panel scrolls to the card.
- **Other copies:** none.
- **Open items:** at 390 px wide the output panel collapses to zero width (`.inp{min-width:400px}` in the flex row of `.main`). Existing, not related to this fix (the two-panel scroll layout is not active below 900 px), not changed.

## 2026-11-01 — PR: claude/sf-tie-cover — Pedestal clear cover to the ties checked against ACI 318-19 Table 20.5.1.3.1 (SFTC; new check, no existing result changes) (PR link added after merge)

Line numbers are approximate; search for the anchor text. Every code site is tagged `SFTC`.

### SFTC. Clear cover to the ties, c − d_b,tie ≥ specified cover for the pedestal exposure   [new check; CLAUDE.md §4]
- **Engineer decision (2026-11-01):** keep the pedestal "Cover" input as the clear cover to the vertical bars (no input change). Add a check that the clear cover to the ties, c − d_tie, meets the ACI 318-19 Table 20.5.1.3.1 minimum for the pedestal's exposure. Show it in the pedestal checks, the dashboard, the report and the drawings note. This closes the open item of SFPC ("20.5.1.3 states the cover to the outermost reinforcement, which in a tied pedestal is the tie").
- **Exposure input (new):** the app had no exposure or "cast against earth" information for the pedestals (the footing's 3 in bottom-cover warning is a fixed rule). A per-pedestal select is added on the pedestal card, under the reinforcement row: `peds[i].reinf.exposure`.
  - `'weather'` (default): exposed to weather or in contact with ground. Table 20.5.1.3.1 row "Exposed to weather or in contact with ground": No. 6 through No. 18 bars 2 in; No. 5 bar, W31 or D31 wire, and smaller 1-1/2 in. The minimum is chosen by the **tie** size.
  - `'earth'`: cast against and permanently in contact with ground: 3 in (all members).
  - `'interior'`: not exposed to weather or in contact with ground; row "Beams, columns, pedestals, and tension ties: primary reinforcement, stirrups, ties, spirals, and hoops": 1-1/2 in.
  - Default reasoning: a bridge/foundation pedestal is formed (not cast against earth) and is backfilled or exposed, so "exposed to weather or in contact with ground" is the usual row. Engineer to confirm (open item).
  - Constant `SFTC_EXP` (labels and minimums) and `sftcMin(exp, tieSize)` sit after `const BAR_SIZES=`.
- **Where:**
  - `computePhase2` → `pedDes`, after the anchor `const tieSizeOK=isPatch?…`:
    ```js
    const exposure=SFTC_EXP[rf.exposure]?rf.exposure:'weather', cov=num(cover), tieDb=BAR_DIA[rf.tieSize]||0;
    const tieCov=cov-tieDb, tieCovMin=sftcMin(exposure,rf.tieSize), tieCovOK=isPatch?true:(tieCov>=tieCovMin-1e-9);
    ```
    returned as new keys `exposure, cov, tieDb, tieCov, tieCovMin, tieCovOK` (anchor `pmBars,pmPts,fc,fy,PB,dPr,dX,dY`). No other result reads them.
  - Defaults: `newPed` → `reinf:{…,dowelN:8,exposure:'weather'}`; `migrateState` → `if(!SFTC_EXP[p.reinf.exposure])p.reinf.exposure='weather';` (old saves and imports: the default).
- **Shown (§6):**
  - Pedestal card (input): the exposure select, and the line "Clear cover to the ties c − d_b,tie = 2.00 − 0.375 = 1.625 in ≥ 1.50 in min (exposed to weather or in contact with ground, ACI 318-19 Table 20.5.1.3.1). Worked in: Pedestal Design · 6.x" (link).
  - Pedestal Design 6.1 table: new column "Tie cover (in)" (1.625 ≥ 1.50, green / red).
  - Pedestal Design 6.x: equation block "Clear cover to the ties" (c_tie = c − d_b,tie ≥ c_min; values; OK / NG), a note on the basis, and a red NG box when it fails.
  - Dashboard: new chip "Pedestal tie cover" (PASS: the smallest margin, e.g. "min 1.625 ≥ 1.50 in (Ped 1)"; FAIL: each failing pedestal); its printed line cites Table 20.5.1.3.1 with D/C = c_min/(c − d_b,tie). The existing "Pedestal design" chip is unchanged. User manual 3.1 chip table: new row.
  - Report §1.5 pedestal row: "cover 2.00 in (clear to the vertical bars; exposure: …)". §6 topic "Ties and slenderness": new steps c_min (Table 20.5.1.3.1 row and tie size) and c_tie = c − d_b,tie with OK / NG; topic reference adds 20.5.1.3 (Table 20.5.1.3.1).
  - Drawings: pedestal plan-section note "#3 TIES @ 12"; COVER 2" CLR TO VERT BARS, 1 5/8" CLR TO TIES"; general note 6 lists, per pedestal, clear cover to the vertical bars / to the ties with the minimum and exposure ("PED 1 2" / 1 5/8" (MIN. 1 1/2", EXPOSED TO WEATHER OR IN CONTACT WITH GROUND)", "; NG" when it fails).
- **Governing provision:** ACI 318-19 20.5.1.3 and Table 20.5.1.3.1 (specified concrete cover, cast-in-place nonprestressed members).
- **Check cases (hand):**
  - Default project, both pedestals: c = 2.00 in, #3 ties (d_b = 0.375 in), exposed: c_tie = 2.00 − 0.375 = **1.625 in ≥ 1.50 in → OK**. Before: no check. After: OK.
  - #6 ties (d_b = 0.750 in), exposed: c_tie = 2.00 − 0.75 = **1.250 in < 2.00 in** (No. 6 and larger: 2 in) **→ NG**.
  - #3 ties, cast against earth: 1.625 in < **3.00 in → NG**.
  - #4 ties, interior: 2.00 − 0.50 = 1.50 ≥ 1.50 → OK.
- **New failures on the 10 comparison projects:** none. Every project uses c = 2 in, #3 ties, default exposure → 1.625 ≥ 1.50 in (the bearing patch of directqa_net_fail, h = 0, is not checked). An extra test project (`tie_cover_fail`: Ped 1 #6 ties; Ped 2 cast against earth) fails both pedestals as above.
- **How verified (headless Chromium, origin/main vs the branch, 10 projects + the extra one):**
  - Every value of `R` and `P2`, the warnings, self-consistency, state and saved storage are identical. New keys only: `P2.pedDes[].exposure/cov/tieDb/tieCov/tieCovMin/tieCovOK` and `state.peds[].reinf.exposure`.
  - Dashboard: the only change is the new chip (line diff: nothing removed; "Pedestal tie cover" + its value added).
  - Pedestal Design tab: only the 6.1 table column and the new 6.x block. Other tabs' text identical.
  - An origin/main save (no `exposure`) loads, is migrated to `'weather'`, and computes identically.
  - Report on 11 projects: 0 unresolved references, 0 KaTeX errors, no NaN, step values = app values. Drawings on 11 projects: DXF valid, no text overlaps, all inside the border, R/P2 unchanged. 0 console errors. `node tests/check-syntax.mjs` and `tests/smoke/spread-footing-scroll.mjs` pass.
- **Open items (not changed; CLAUDE.md §9):**
  - Default exposure "exposed to weather or in contact with ground": engineer to confirm, or name another default.
  - The vertical bars themselves are not checked against Table 20.5.1.3.1 (e.g. #6 and larger, exposed: 2 in to the vertical bar). With c = 2 in that row is met by the input; with a smaller cover it would not be. Raised, not added.
  - The footing's own covers (bottom 3 in warning, top and side) are unchanged.

## 2026-11-01 — PR: claude/sf-barfit-db — Pedestal bar-fit check: bar diameter from the bar table (SFBD; calculation change, #9–#11 only) (PR link added after merge)

Line numbers are approximate; search for the anchor text.

### SFBD. d_b in the pedestal bar-fit (clear spacing) check from `BAR_DIA`   [calculation change; CLAUDE.md §4]
- **Engineer decision (2026-11-01):** the bar-fit check used d_b = size/8, while everything else (bar layout `sfdPedBars`, P–M bar positions, drawings, development lengths) uses the `BAR_DIA` table. Use the table.
- **Where:** `computePhase2` → `pedDes`, anchor `const dbL=`.
  - Before: `const dbL=(rf.longSize||0)/8;`
  - After: `const dbL=BAR_DIA[rf.longSize]||0;`
  - `dbL` is now also returned (`pedDes[].dbL`) for the worked display.
- **Formula (unchanged):** s_clear = (b − 2c − d_b)/(n_face − 1) − d_b ≥ s_min = max(1.5 d_b, 1.5 in).
- **Governing provision:** ACI 318-19 25.2.3 (minimum clear spacing of longitudinal bars in columns/pedestals); nominal bar diameters per ASTM A615/A706 (the `BAR_DIA` table).
- **Change in d_b:**

  | Bar | before: size/8 | after: table | Δ |
  |---|---|---|---|
  | #3 to #8 | 0.375 to 1.000 | 0.375 to 1.000 | 0 (identical) |
  | #9 | 1.125 | 1.128 | +0.003 in |
  | #10 | 1.250 | 1.270 | +0.020 in |
  | #11 | 1.375 | 1.410 | +0.035 in |

- **Check cases (hand)**, 18 × 18 in pedestal, c = 2 in:
  - #11, 3 per face: before (18 − 4 − 1.375)/2 − 1.375 = **4.938 in** vs s_min = 1.5·1.375 = **2.063 in**. After (18 − 4 − 1.41)/2 − 1.41 = 6.295 − 1.41 = **4.885 in** vs 1.5·1.41 = **2.115 in**. OK both.
  - #10, 4 per face: before 12.75/3 − 1.25 = **3.000** vs **1.875**. After 12.73/3 − 1.27 = **2.973** vs **1.905**. OK both.
  - #9, 5 per face: before 12.875/4 − 1.125 = **2.094** vs **1.688**. After 12.872/4 − 1.128 = **2.090** vs **1.692**. OK both.
  - Pass/fail flips only where the margin is under about 0.1 in, e.g. #11 at s_clear between 2.063 and 2.115 in.
- **Effect on the comparison projects:** the 10 projects (and `tie_cover_fail`) use #8 longitudinal bars → identical, every value of `R`, `P2`, dashboard, warnings, consistency, state and storage. Extra project `big_bars` (the three cases above): only `pedDes[].clrX/clrY/clrMin` change as listed; no pass/fail change; dashboard identical.
- **Shown (§6):** Pedestal Design 6.x "Bar count and fit" now works the formula: s_clear = (b − 2c − d_b)/(n_face − 1) − d_b with d_b from the bar table and the substituted x-face values, and max(1.5 d_b, 1.5). Report §6 step "Bars and clear spacing" states the formula and d_b.
- **How verified:** headless Chromium, origin/main vs the branch (12 projects); report builds on 12 projects (0 unresolved, 0 KaTeX errors, values = app); `node tests/check-syntax.mjs`; `tests/smoke/spread-footing-scroll.mjs` passes.
- **Open item (not changed):** ACI 318-19 25.2.3 also has the (4/3)d_agg term; the app takes no aggregate size, so it is not checked (unchanged).

## 2026-11-01 — PR: claude/sf-pm-ratio — Pedestal biaxial P–M ratio of every LRFD combination at its own P_u, reported (SFPM; new check, existing results unchanged) (PR link added after merge)

Line numbers are approximate; search for the anchor text. Every code site is tagged `SFPM`.

### SFPM. Interaction demand / capacity ratio at each combination's own P_u   [new check; CLAUDE.md §4]
- **Engineer request (2026-11-01):** the pedestal biaxial P–M result was only the plot colouring, against one contour drawn at the largest P_u. For every LRFD combination, compute the interaction ratio at that combination's own P_u. Report the governing ratio and combination in the Pedestal Design summary, the dashboard and the report, with worked steps. Plot each combination against its own-P_u contour, or mark that the plotted contour is at P_u,max.
- **Method (chosen to match the app's existing contour):** constant-axial-load **radial ratio** on the app's own load contour, i.e. the capacity surface cut at P = P_u.
  - Contour: `pmContour`, unchanged. Strain compatibility (ACI 318-19 22.2: ε_cu = 0.003, 0.85f′c block, β1), φ by net tensile strain (21.2.2), bar centres at cover + d_b/2 (SFPC).
  - For a combination (P_u, M_ux, M_uy):
    - |M_u| = √(M_ux² + M_uy²) and θ = atan2(M_ux, M_uy), in the plot plane (x = M_uy, y = M_ux).
    - The capacity point (φM_nx,θ, φM_ny,θ) is the point of the contour at P_u in direction θ. It is found by bisection on the neutral-axis angle α inside the demand's quadrant. The bar layout is doubly symmetric, so the capacity direction rises with α; tolerance 1e-5 rad, at most 40 steps.
    - ratio = |M_u| / √(φM_nx,θ² + φM_ny,θ²).
  - P_u > φP_n,max (ACI 318-19 22.4.2.1, the cap on the design axial strength of the tied section): no moment capacity at that P_u, so ratio = P_u/φP_n,max (mode `axial`).
  - The section cannot reach P_u (the c search does not converge to within 1 kip, e.g. tension beyond its range): not computed (mode `range`). The dashboard then shows REVIEW and the card shows a warning.
  - A combination with no moment has ratio 0. Its axial check is the existing axial DCR.
  - Governing = the largest ratio.
  - Source of the method: ACI 318-19 22.4 (axial strength with flexure) and R10.5; the load-contour concept of Bresler, B. (1960), "Design Criteria for Reinforced Columns under Axial Load and Biaxial Bending," ACI Journal 57(11). The ratio is the radial distance at constant P on the strain-compatibility contour; the Bresler α-exponent approximation is **not** used.
- **Where:**
  - `pmContour`: a new optional argument `angList` (neutral-axis angles to evaluate instead of the uniform grid), and `phiPn` added to each returned point. The uniform-grid output is unchanged (the plot is identical in shape).
  - New functions after `pmContour`: `sfpmPoint`, `sfpmRatios`, `sfpmModeTxt`, `SFPM_REF`.
  - `computePhase2` → `pedDes`, after the anchor `pmPts.push({name:c.cb.name`: `pmRat` (one row per combination: P, Mx, My, Md, theta, alpha, cMx, cMy, Rc, ratio, mode), `pmGov`, `pmRange`. These are new keys; nothing else reads them.
- **Shown (§6):**
  - Pedestal Design 6.1: new column "P–M ratio (own P_u)" with the governing combination.
  - Pedestal Design 6.x:
    - equation block "Biaxial P–M ratio at the combination's own P_u — governing: …" (symbolic → P_u, M_ux, M_uy, |M_u|, θ → capacity point, α, |φM_n|_θ → ratio);
    - a table of every combination (P_u, M_ux, M_uy, |M_u|, φM_nx,θ, φM_ny,θ, |φM_n|_θ, ratio; governing row bold);
    - a method note.
  - Plot:
    - the solid contour is labelled "at P_u,max (reference)";
    - the dashed contour is the governing combination's own P_u (drawn when it differs from P_u,max), with a dotted ray to its capacity point;
    - point colours are now the ratio at each combination's own P_u (before: inside/outside the P_u,max contour);
    - the legend sits below the axis title.
  - Dashboard: new chip "Pedestal P–M (biaxial)" (max ratio, pedestal, combination; FAIL > 1; REVIEW if not computed); printed line D/C = ratio. User manual 3.1 chip table: new row. The existing "Pedestal design" chip is unchanged.
  - Report §6, per pedestal: new topic "Biaxial P–M ratio at each combination's own P_u" with the worked steps of the governing combination, and a table of every combination.
- **Check case (hand):** default project, Ped 2, governing combination 1.2D + 1.0(+Wx) + L + 0.5S.
  - P_u = 270.81 kip, M_ux = 0, M_uy = V_x·h = 8·2 = 16.00 kip-ft; θ = 0° (uniaxial about y, compression on the +x face).
  - Section 18 × 18 in, 8 #8 (rows of 3 / 2 / 3 at 2.5 / 9.0 / 15.5 in from the compression face), f′c = 4 ksi, f_y = 60 ksi, E_s = 29 000 ksi, β1 = 0.85.
  - Solve φP_n = 270.81:
    - c = 7.727 in, a = 6.568 in, C_c = 0.85·4·6.568·18 = 401.96 k;
    - row 1: ε = 0.002029, f_s = 58.85 − 3.40 → 131.42 k;
    - row 2: ε = −0.000494, f_s = −14.33 ksi → −22.64 k;
    - row 3: ε_t = 0.003018 → −60 ksi → −142.20 k;
    - P_n = 368.54 k, φ = 0.65 + 0.25(0.003018 − 0.002)/0.003 = 0.7348, φP_n = 270.8 k.
  - M_n = [401.96(9 − 3.284) + 131.42(6.5) − 22.64(0) + 142.20(6.5)]/12 = 339.68 k-ft; **φM_ny = 249.6 k-ft**.
  - Ratio by hand = 16.00/249.6 = **0.0641**. App: |φM_n|_θ = 247.31 k-ft, ratio **0.0647** (−0.9 % capacity: the strip integration of `pmContour`, the same as SFPC).
  - Before, the plotted basis was the contour at P_u,max = 318.81 k: largest |M_u|/radius = 0.0709 (same combination). After, at its own P_u (270.81 k): 0.0647.
- **Before / after on the comparison projects:**
  - "Before" = largest |M_u|/contour radius against the contour at P_u,max (180 angles, the plotted basis), and the number of points inside the plotted 28-angle contour.
  - "After" = governing ratio at the combination's own P_u, and the number of combinations with ratio > 1.

  | Project | Pedestal | before (at P_u,max) | inside before | after (own P_u) | governing combination (P_u, k) | > 1 after |
  |---|---|---|---|---|---|---|
  | default | Ped 1 / Ped 2 | 0.0626 / 0.0709 | 9/9, 9/9 | 0.0639 / 0.0647 | 0.9D + 1.0(+Wx) (108.61) / 1.2D + 1.0(+Wx) + L + 0.5S (270.81) | 0 |
  | direct | Ped 1 / Ped 2 | 0.0642 / 0.0719 | 2/2, 2/2 | 0.0642 / 0.0719 | Direct LRFD (dead ×1.2) | 0 |
  | wt_ecc_gate_3ped | Ped 1 / 2 / 3 | 0.2934 / 0.1818 / 0.0403 | all | 0.2826 / 0.1774 / 0.0438 | 1.2D + 1.0(+Wy) + L + 0.5S (194.81) / 1.2D + 1.6L + 0.5S (318.81) / 0.9D + 1.0(+Wx) (54.67) | 0 |
  | directqa_net_fail | Ped 1 | 0.0711 | 9/9 | 0.0969 | 0.9D + 1.0(−Wx) (108.61) | 0 |
  | single_moment | Ped 1 | 0.2503 | 10/10 | 0.2442 | 1.2D + 1.0(−Wy) + L (199.81) | 0 |
  | direct_moment | Ped 1 / Ped 2 | 0.1488 / 0.1541 | 2/2 | 0.1493 / 0.1541 | Direct LRFD (dead ×1.2) | 0 |
  | offsets | Ped 1 / **Ped 2** | 0.3020 / **1.1144** | 9/9, **6/9** | 0.2930 / **1.1160** | 1.2D + 1.0(−Wx) + L + 0.5S (204.81) / **1.2D + 1.6L + 0.5S (318.81)** | 0 / **2** |
  | uplift_partial | Ped 1 / Ped 2 | 0.8763 / 0.3547 | 9/9 | 0.8502 / 0.3235 | 1.2D + 1.0(+Wx) + L + 0.5S | 0 |
  | qty_modes | Ped 1 / Ped 2 | 0.0481 / 0.0606 | 9/9 | 0.0467 / 0.0561 | 1.2D + 1.0(+Wx) + L + 0.5S | 0 |
  | fatal | — | — | | — | | |

  - Pass/fail: the only project above 1 is offsets Ped 2 (it was already outside the plotted contour). Before, 3 combinations were outside the P_u,max contour; at their own P_u, 2 are above 1 (the third lies inside its own, larger contour). The dashboard now shows FAIL for it ("Pedestal P–M (biaxial)", ratio 1.12). The ratios where the combination's own P_u is below P_u,max can be higher (a smaller contour at low P, e.g. 0.9D combinations: default Ped 1 0.0626 → 0.0639, directqa_net_fail 0.0711 → 0.0969) or lower.
  - Accuracy of the direction search: on all 12 projects the capacity radius agrees with a 360-angle contour polygon within 0.52 % (the polygon's own chord error).
- **Nothing else changes (proof):** headless Chromium, origin/main vs the branch, 10 projects + 2 extra.
  - Every value of `R` and `P2`, the warnings, consistency, state and storage are identical. New keys: `pedDes[].pmRat/pmGov/pmRange`.
  - The dashboard line diff only adds the new chip. Only the Pedestal Design tab text changes.
  - Report on 12 projects: 0 unresolved, 0 KaTeX errors, no NaN, step values = app values.
  - `node tests/check-syntax.mjs` and `tests/smoke/spread-footing-scroll.mjs` pass.
- **Cost:** `computePhase2` takes about 10–270 ms in headless Chromium (before: 10–50 ms). Uniaxial combinations need one contour point; biaxial ones need about 15–40.
- **Open items (§9):**
  - The axial cap is handled as ratio = P_u/φP_n,max only above the cap. Below it, the radial ratio does not include the cap's flat top. Where P_u is close to φP_n,max, read the axial DCR with it.
  - Slenderness magnification is still not applied (existing "slender" flag).

## 2026-11-01 — PR: claude/sf-phone — Narrow screens: the input and output panels stack (SFPH; layout only, no calculation change) (PR link added after merge)

### SFPH. Stacked layout below 900 px   [UI only]
- **Problem (engineer, 2026-11-01):** at 390 px the output panel collapsed to zero width. `.main` is a flex row; `.inp{width:33%;min-width:400px}` took the whole row and `.out{flex:1;min-width:0}` got nothing.
- **Where:** `<style>`, a new block after the `@media screen and (min-width:900px)` block (anchor `SFPH`), and one link at the top of the input panel (anchor `id="sfdJumpOut"`, just before `<div class="main">`).
- **Before:** no narrow-screen rule. `.main{display:flex;gap:12px;align-items:flex-start}`, `.inp{width:33%;min-width:400px}`.
- **After:**
  ```css
  #sfdJumpOut{display:none;margin:6px 0 10px 0;text-align:center;color:#1c4e80}
  @media screen and (max-width:899.98px){
   .wrap{padding:8px 8px}
   .main{flex-direction:column;align-items:stretch}
   .inp{width:100%;min-width:0}
   .out{width:100%;min-width:0}
   .titleblock{grid-template-columns:repeat(2,minmax(0,1fr))}
   table.tbl,table.ldtbl{display:block;max-width:100%;overflow-x:auto}
   .tabpage{overflow-x:auto}
   .row label{width:min(170px,45%)}
   #sfdJumpOut{display:block}
  }
  ```
  - The inputs sit above the outputs.
  - Wide tables (load tables, result tables) and tab pages scroll inside their own box, so the page has no horizontal scroll.
  - A link above the input panel (outside it, so the input tabs do not hide it), "Jump to the results (dashboard and output tabs) ↓" (`href="#outputPanel"`), shows on narrow screens only.
  - The breakpoint is the same 900 px as the existing two-panel rule, so ≥ 900 px is untouched.
- **How verified (headless Chromium):**
  - At 1280, 1366 and 900 px the input and output panel rectangles are identical to origin/main.
  - At 390 and 768 px the panels are stacked (inputs above outputs, both full width).
  - `document.scrollWidth` ≤ the viewport on every output tab (10) and every input tab (8).
  - The jump link brings the output panel to the top. It is hidden at 1280. 0 console errors.
  - `R`, `P2`, dashboard, warnings, consistency, state and storage are identical on 3 projects (layout only).
  - `tests/smoke/spread-footing-scroll.mjs` passes (it includes the below-900 check).
  - Screenshots at 390, 768 and 1280.

## 2026-11-01 — PR: claude/sf-dowels — Full dowel checks per pedestal: ℓ_dc worked, dowels in tension at the interface, tension development, laps and projection (SFDO; new checks, existing results unchanged) (PR link added after merge)

Line numbers are approximate; search for the anchor text. Every code site is tagged `SFDO`.

### SFDO. Dowels topic in Footing Design 5.6, the report, the dashboard and the drawings   [new checks; CLAUDE.md §4]
- **Engineer request (2026-11-01):** before this PR, only A_s,dow ≥ 0.005A_g (16.3.4.1) and ℓ_dc into the footing (25.4.9.2, value only) were checked. Add a full Dowels topic per pedestal:
  1. ℓ_dc worked out;
  2. dowels in tension where there is uplift or the moment puts the interface in tension: required steel, A_s provided, ℓ_d / ℓ_dh into the footing and the lap into the pedestal;
  3. the dowel projection, fed to the Drawings.
- **New inputs (pedestal card, dowel row), with defaults so old projects compute identically:**
  - `reinf.dowelHook`: `'straight'` (default) | `'hook90'`.
  - `reinf.dowelProj`: inches; blank (default) = use the required projection.
  - `newPed` and `migrateState` set both defaults for old saves.
- **Engine:** `sfdDowelCheck(i,p,bz,pd,combos,fc,fy,lam)` placed before `computePhase2`, with helpers `sfdLsc`, `sfdLdc`, `sfdLdh`. `computePhase2` returns `dowels` (a new key, read only by the display). The existing `bearing[]` (dowel minimum and ℓ_dc check) is unchanged.
  1. **ℓ_dc**, term by term: 0.02 d_b f_y/(λ√f′c), 0.0003 d_b f_y, 8 in, with √f′c ≤ 100 psi (25.4.1.4).
     - The governing term is named.
     - No 25.4.9.3 modification factor is applied by the app (factor 1.0, stated).
     - Available embedment: t − c_bot − d_b,x − d_b,y, unchanged.
     - The value equals the existing `bearing[].Ldc`.
  2. **Tension at the interface.**
     - Which combinations: P_u < 0 (uplift), or the factored resultant outside the kern of the pedestal section, i.e. σ_min = P_u/A − |M_ux|/S_x − |M_uy|/S_y < 0. M is at the pedestal base, including V·h and the load-offset P·e (SFLO).
     - **Method:** for those combinations the dowels are taken as the reinforcement of the interface section b_x × b_y, with the app's biaxial strain-compatibility routine at the combination's own P_u. This is `sfpmRatios`, the same as the pedestal P–M ratio (SFPM): ACI 318-19 22.2 and 22.4, with force transfer per 16.3.1.1 and 16.3.3 (compression by bearing, 22.8).
     - Dowel positions: centres at c + d_b,dowel/2, at the vertical-bar layout positions. When the dowel count differs from the vertical-bar count, the dowel area is spread equally over those positions (total A_s,dow kept).
     - **A_s,req** = k·A_s,prov, where k is the smallest scale on the dowel area giving ratio ≤ 1 for the governing combination (bisection; 12 steps after bracketing).
     - **The dowels act in tension only where A_s,req > 0.** If the compression block alone carries P_u, M_u (ratio ≤ 1 with no dowels), no tension development or tension lap is required. This is stated on screen.
     - **Tension development into the footing:**
       - straight: ℓ_d (25.4.2.4, the app's `devLength`). c_b comes from the pedestal cover (conservative; the cover in the footing is larger) and the dowel c-c spacing around the bar perimeter. K_tr = 0. No 25.4.10 excess-reinforcement reduction.
       - 90° hook: ℓ_dh = max(f_y ψ_e ψ_r ψ_o ψ_c /(55 λ √f′c) d_b^1.5, 8d_b, 6 in) (25.4.3.1(a)), with ψ_r = 1.6 (no confining ties around the hook in the footing), ψ_o = 1.0 (side cover in the footing ≥ 6d_b), ψ_c = f′c/15000 + 0.6 for f′c < 6000 psi, ψ_e = 1.2 if epoxy.
       - Checked against the same available embedment.
     - **Into the pedestal:** a Class B tension lap with the vertical bars (25.5.2.1). All dowels are spliced at one section, so Class A does not apply. ℓ_st = max(1.3 ℓ_d of the smaller bar, ℓ_d of the larger bar, 12 in) (25.5.2.2).
  3. **Projection.**
     - Compression lap ℓ_sc = max(0.0005 f_y d_b, 12 in) for f_y ≤ 60 ksi; (0.0009 f_y − 24) d_b for f_y ≤ 80 ksi; × 4/3 for f′c < 3000 psi (25.5.5.1, 25.5.5.3). Bars of different size: max(ℓ_dc of the larger bar, ℓ_sc of the smaller bar) (25.5.5.4).
     - Required projection L_req = max(ℓ_sc, ℓ_st where the dowels are in tension).
     - Available projection: h − c, with the pedestal cover taken as the top cover.
     - If the lap does not fit, the dowels must run full height as the pedestal bars. Their development into the pedestal (ℓ_d in tension / ℓ_dc in compression) must then be ≤ h − c.
     - An entered projection is checked: L_req ≤ L_prov ≤ h − c.
- **Shown (§6):**
  - Footing Design 5.6: a summary table per pedestal, then for each pedestal (1) ℓ_dc worked, (2a) the kern test worked for the governing combination, (2b) the interface ratio and A_s,req = k·A_s,prov worked, a table of every combination in tension, (2c) ℓ_d or ℓ_dh worked with all ψ factors, (2d) ℓ_st worked, and (3) the projection worked.
  - Dashboard: new chip "Dowels (tension, laps)"; printed D/C = A_s,req/A_s,prov. User manual 3.1: new row.
  - Report §5: new subsection "Dowels at the pedestals" (steps per pedestal plus the table of combinations in tension).
  - Drawings:
    - the pedestal elevation note adds L_D / L_DH (when in tension) and "PROJ. x" or "FULL HEIGHT";
    - the schedule's dowel row now has a length (embedment + projection, + 12 d_b with a hook) and the note "EMBED a (L_DC b, L_D c); PROJ. p (COMPR. LAP / CLASS B LAP)". This replaces "PROJECTION BY DETAIL";
    - the schedule's footnote is updated.
- **Hand check:** `uplift_partial`, Ped 1, 18 × 18 in, 8 #8 dowels = verticals, f′c = 4 ksi, f_y = 60 ksi, c = 2 in, t = 2.5 ft, h = 2 ft. Governing combination 1.2D + 1.0(+Wx) + L + 0.5S: P_u = 204.81 k, M_ux = 0, M_uy = 224.00 k-ft.
  - **Kern:** A = 324 in², S_y = 18·18²/6 = 972 in³. σ_min = 204.81/324 − 224·12/972 = 0.632 − 2.765 = **−2.133 ksi < 0** → interface in tension (9 of 9 combinations).
  - **Section at φP_n = 204.81 k**, rows 3/2/3 #8 at 2.5/9/15.5 in:
    - k = 1 (6.32 in²): c = 6.278 in, a = 5.336 in, C_c = 326.57 k, ε_t = 0.00441, φ = 0.851, φM_n = **265.5 k-ft**; ratio 224/265.5 = **0.844**. App 263.46 → **0.850** (strip integration, −0.8 %).
    - k = 0 (no dowels): c = 4.375 in, φ = 0.90, φM_n = 121.9 k-ft; ratio 1.84 > 1, so dowels are needed in tension.
    - Required k = 0.632 → **A_s,req = 3.99 in²** by hand (φM_n = 224.0 k-ft at c = 5.736 in). App **4.03 in²** (0.637·6.32) ≤ 6.32 → OK.
  - **ℓ_d** (#8, straight): c_b = min(2 + 0.5, s/2 = 6.5/2) = 2.5, (c_b + K_tr)/d_b = 2.5, ψ all 1.0. ℓ_d = (3/40)(60 000/63.25)(1/2.5)(1.0) = **28.46 in** > 25.00 in available → **NG** (new failure).
  - **Laps:** ℓ_st = max(1.3·28.46, 28.46, 12) = **37.00 in**; ℓ_sc = 0.0005·60 000·1.0 = **30.00 in**. L_req = 37.00 in > h − c = 22 in, so the dowels go full height; their development in the pedestal is 28.46 > 22 → **NG** (new failure).
  - **Before:** only A_s,dow = 6.32 ≥ 0.005·324 = 1.62 OK and ℓ_dc = 18.97 ≤ 25.00 OK. Both are unchanged after.
- **New failures on the comparison projects** (all existing checks identical; the "Dowels (tension, laps)" chip is new):

  | Project | Interface in tension (kern) | A_s,req / A_s,prov (in²) | Dowels in tension? | New chip |
  |---|---|---|---|---|
  | default, direct, directqa_net_fail, direct_moment, qty_modes, tie_cover_fail, big_bars | none | — | no | PASS (projection: compression lap 30 in > 22 in → full height, ℓ_dc 18.97 ≤ 22 OK) |
  | wt_ecc_gate_3ped | Ped 1: 10 of 15 | 0 / 6.32 | no (compression block carries it) | PASS |
  | single_moment | Ped 1: 5 of 10 | 0 / 6.32 | no | PASS |
  | offsets | Ped 1: 6 of 9 (A_s,req 0); **Ped 2: 9 of 9** | **8.35 / 6.32** | Ped 2 yes | **FAIL**: Ped 2 A_s,req > A_s,prov, ℓ_d 28.46 > 25.00, development in the pedestal |
  | uplift_partial | **Ped 1: 9 of 9** (A_s,req 4.03); Ped 2: 4 of 9 (A_s,req 0) | 4.03 / 6.32 | Ped 1 yes | **FAIL**: Ped 1 ℓ_d 28.46 > 25.00, development in the pedestal 28.46 > 22 |
  | fatal | — | — | — | — |

- **Proof that nothing else changes:** headless Chromium, origin/main vs the branch, 10 projects + 2 extra.
  - Every value of `R` and `P2`, the warnings, consistency, state and storage are identical. New keys only: `P2.dowels`, `state.peds[].reinf.dowelHook/dowelProj`.
  - The dashboard line diff only adds the new chip.
  - An origin/main save loads, is migrated to straight / blank, and `R` and `P2.bearing` are identical.
  - Report (12 projects): 0 unresolved references, 0 KaTeX errors, no NaN, step values = app values. Drawings: DXF valid, no overlaps.
  - `node tests/check-syntax.mjs` and `tests/smoke/spread-footing-scroll.mjs` pass.
- **Open items (§9):**
  - The tension criterion (kern) and "dowels act in tension only where A_s,req > 0": engineer to confirm.
  - Class B for the tension lap (all dowels spliced at one section); the pedestal cover used as the top cover for the projection; c_b from the pedestal cover; ψ_r = 1.6 and ψ_o = 1.0 for the hook. Each is stated on screen.
  - Shear friction across the interface (22.9) for V_u is not part of this PR (not requested).
  - With a hook, ℓ_dc must fit in the straight part above the bend. The existing ℓ_dc check uses the full available depth (unchanged); a note says so.

## 2026-11-01 — PR: claude/sf-shear-friction — Shear friction across the pedestal–footing interface, ACI 318-19 22.9 (SFSF; new check, existing results unchanged) (PR link added after merge)

Line numbers are approximate; search for the anchor text. Every code site is tagged `SFSF`.

### SFSF. Interface shear friction per pedestal and per LRFD combination   [new check; CLAUDE.md §4]
- **Engineer request (2026-11-01).** Check shear friction across the interface (22.9), using:
  - V_u per combination in both directions and as the resultant;
  - μ for not-roughened vs roughened (a new input, with a stated default);
  - A_vf = the dowels, less the area needed for tension;
  - the 22.9.4.4 limits;
  - the permanent net compression.
- **Input (new):** `peds[i].reinf.sfJoint` on the pedestal card, dowel row, "Joint surface":
  - `'smooth'` (default): placed against hardened concrete, not intentionally roughened, μ = 0.6λ.
  - `'rough'`: intentionally roughened to about 1/4 in amplitude, μ = 1.0λ (Table 22.9.4.2).
  - The default is the conservative row; the engineer selects "roughened" where the drawings require it. `migrateState` sets the default for old saves.
- **Engine:** `sfdShearFriction(i,p,Wped,pd,dw,combos,fc,fy,lam)`, placed before `computePhase2`. `computePhase2` returns `shearFr` (a new key, display only).
  - **V_u:** V_ux and V_uy are the factored applied shears at the pedestal (the pedestal self-weight adds no shear). V_u = √(V_ux² + V_uy²): the shear plane is the whole interface.
  - **A_vf** = A_s,dow − A_s,req,ten, ≥ 0. A_s,req,ten is the area the dowels need for tension at the interface (SFDO, governing combination, applied to every combination: conservative). Per 22.9.4.6, tension reinforcement is in addition to the shear-friction reinforcement.
  - **f_y** ≤ 60 ksi for shear friction (20.2.2.4).
  - **N_u** (22.9.4.5, permanent net compression) = the combination's dead factor × (pedestal D load + pedestal self-weight), limited to P_u and ≥ 0. Direct mode has no dead/live split, so only the pedestal self-weight counts.
  - **V_n** = μ(A_vf f_y + N_u) (22.9.4.2).
  - **Upper limit** V_n,max (22.9.4.4), A_c = b_x b_y:
    - normalweight and roughened: min(0.2f′c, 480 + 0.08f′c, 1600)·A_c;
    - other cases (not roughened, or lightweight): min(0.2f′c, 800)·A_c.
  - **φ** = 0.75 (Table 21.2.1). DCR = V_u / (0.75 min(V_n, V_n,max)).
- **Shown (§6):**
  - Footing Design 5.6: a summary table, then per pedestal a worked block for the governing combination (symbolic → values → DCR) and a table of every combination.
  - Dashboard chip "Interface shear friction" (printed D/C); user manual 3.1 row.
  - Report §5: subsection "Shear friction across the pedestal–footing interface" (steps + tables).
  - Drawings: a general note on the construction-joint surface and μ per pedestal.
- **Hand check:** `uplift_partial`, Ped 1, governing combination 0.9D + 1.0(+Wx).
  - Demand: V_u = √(40² + 0²) = 40.00 k.
  - μ = 0.6·1.0 = 0.60.
  - A_vf = 6.32 − 4.03 = 2.29 in².
  - N_u = min(0.9·(120 + 0.675), 108.61) = 108.61 k.
  - V_n = 0.60(2.29·60 + 108.61) = 147.76 k. V_n,max = min(800, 800)·324/1000 = 259.2 k.
  - φV_n = 0.75·147.76 = 110.82 k. **DCR = 40/110.82 = 0.361**. Before: no check.
- **Results on the 12 projects:** no new failures. Largest DCR:
  - uplift_partial 0.361 (Ped 1);
  - offsets 0.131 (Ped 2: A_vf = 0, because the dowels are all needed for tension, so φV_n = 0.75·0.6·135.61);
  - direct modes 0.05 (N_u = self-weight only);
  - all others 0.02–0.05.
- **Proof nothing else changes:** headless Chromium, origin/main vs the branch, 12 projects.
  - Every value of `R` and `P2`, the warnings, consistency, state and storage are identical. New keys only: `P2.shearFr`, `reinf.sfJoint`.
  - The dashboard line diff only adds the new chip. An old save loads and migrates with identical results.
  - Report: 0 unresolved references, 0 KaTeX errors, values = app values. Drawings: DXF valid, no overlaps.
  - `node tests/check-syntax.mjs` and `tests/smoke/spread-footing-scroll.mjs` pass.
- **Open items:**
  - Default μ = 0.6λ (not intentionally roughened): engineer to confirm, or set "roughened" where the drawings specify it.
  - In direct mode the permanent compression is only the pedestal self-weight.
  - A_s,req,ten from the governing tension combination is deducted in every combination (conservative).
