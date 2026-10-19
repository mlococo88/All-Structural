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
