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

## Open items (not changed)
- **O1. Vesić inclination exponent m uses nominal B/L, not B'/L'.** Anchor: `const mxm=(2+B/L)/(1+B/L)`. Using B'/L' is the more common form (AASHTO 10.6.3.1.2a uses B'/L'). This changes bearing capacity and needs a decision. Question: should m use the effective B'/L'?
- **O2. The depth factors dq/dc are always applied.** AASHTO 10.6.3.1.2a and common practice drop them when the soil above the base is not competent or may be removed. Recommendation: add a "use depth factors" option, default on to keep the current results. Needs a decision on the default.
- **O3. Passive acts over the full Df across the full footing width** (`PpX=pf*0.5*Kp*gs*Df*Df*L`). The footing face only spans t. This is conservative by default (pf = 0) and is left as is. Question: should passive be limited to the footing thickness, or should pf stay as the user's control?
- **O4. Compression dowel ℓdc does not cap √f'c at 100 psi** (`Ldc=Math.max(0.02*BAR_DIA[dSize]*fy/(lam*sq),...)`). ACI 318-19 25.4.1.4 applies to all development lengths. This was not in the task list, so it is raised here and not changed. Effect: only when f'c > 10 ksi.
- **O5. ℓd cover assumption:** cb uses the bottom clear cover for both layers and assumes the side cover is no less than that. A separate side-cover input would sharpen this. Low priority.

## Resolved items
- **F8 note (item 8): surcharge in the structural resultant is less conservative for sagging moment and one-way shear. Keep, revert, or apply only where unfavourable?**
  - **RESOLVED 2026-10-04 (F12):** engineer keeps the surcharge in the structural resultant. No code change.
