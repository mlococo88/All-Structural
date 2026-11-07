# Fix log — Spread Footing.html

Governing basis used for fixes: ACI 318-19; ASCE 7-16 combinations as already implemented (unchanged).

## 2026-10-04 — PR: claude/fix-spread-footing (PR #8: https://github.com/mlococo88/All-Structural/pull/8)

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

## 2026-10-05 — PR: claude/conn-steelbeam-reactions (PR #38: https://github.com/mlococo88/All-Structural/pull/38)
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

## 2026-10-05 — PR: claude/conn-foundation-loads (PR #40: https://github.com/mlococo88/All-Structural/pull/40)

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

## 2026-10-09 — PR: claude/tabs-spreadfooting (PR #62: https://github.com/mlococo88/All-Structural/pull/62)
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

## 2026-10-12 — PR: claude/sweep-footing (PR #142: https://github.com/mlococo88/All-Structural/pull/142)
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

## 2026-10-18 — PR: claude/sf-d11-report (PR #284: https://github.com/mlococo88/All-Structural/pull/284)

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

## 2026-10-19 — PR: claude/sf-status-chips (PR #318: https://github.com/mlococo88/All-Structural/pull/318)

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

## 2026-10-19 — PR: claude/aashto10-spread-footing (PR #331: https://github.com/mlococo88/All-Structural/pull/331)

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

## 2026-10-20 — PR: claude/aashto10-sf-direct (SFAD: AASHTO load factors on the tool's own self-weight, EV and surcharge for an imported AASHTO case; engineer direction 2026-10-20 "accuracy"; PR #361: https://github.com/mlococo88/All-Structural/pull/361)

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


## 2026-10-21 — PR: claude/abut-handoffs-iab — Integral / semi-integral hand-offs: integral per-pile foundation loads, R_n / φ into the integral inputs, type-aware SubLoads import (AXI) (PR #398: https://github.com/mlococo88/All-Structural/pull/398)

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


## 2026-11-01 — PR: claude/sf-rebar-tab — Reinforcement input tab (presentation only, no calculation change) (PR #514: https://github.com/mlococo88/All-Structural/pull/514)

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


## 2026-11-01 — PR: claude/sf-load-offset — Load location on the pedestal: per-pedestal load offsets e_x, e_y (SFLO, calculation change) (PR #515: https://github.com/mlococo88/All-Structural/pull/515)

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


## 2026-11-01 — PR: claude/sf-report — Report output tab in the shared report viewer (SFRP; display only, no calculation change) (PR #518: https://github.com/mlococo88/All-Structural/pull/518)

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


## 2026-11-01 — PR: claude/sf-rebar-qty — Rebar entered as a spacing or a total quantity, for each footing mat and each pedestal (SFRQ; input form only) (PR #519: https://github.com/mlococo88/All-Structural/pull/519)

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


## 2026-11-01 — PR: claude/sf-drawings — Drawings output tab with DXF export (SFDW; display and export only, no calculation change) (PR #521: https://github.com/mlococo88/All-Structural/pull/521)

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

## 2026-11-01 — PR: claude/sf-ped-cover — Pedestal P–M interaction: bar centres at cover + d_b/2 (cover to the bar face) (SFPC, calculation change) (PR #523: https://github.com/mlococo88/All-Structural/pull/523)

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

## 2026-11-01 — PR: claude/sf-scroll-fix — The page could be scrolled by script and not scrolled back ("won't let me scroll up") (SFSC; UI only, no calculation change) (PR #524: https://github.com/mlococo88/All-Structural/pull/524)

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

## 2026-11-01 — PR: claude/sf-tie-cover — Pedestal clear cover to the ties checked against ACI 318-19 Table 20.5.1.3.1 (SFTC; new check, no existing result changes) (PR #526: https://github.com/mlococo88/All-Structural/pull/526)

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

## 2026-11-01 — PR: claude/sf-barfit-db — Pedestal bar-fit check: bar diameter from the bar table (SFBD; calculation change, #9–#11 only) (PR #528: https://github.com/mlococo88/All-Structural/pull/528)

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

## 2026-11-01 — PR: claude/sf-pm-ratio — Pedestal biaxial P–M ratio of every LRFD combination at its own P_u, reported (SFPM; new check, existing results unchanged) (PR #541: https://github.com/mlococo88/All-Structural/pull/541)

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

## 2026-11-01 — PR: claude/sf-phone — Narrow screens: the input and output panels stack (SFPH; layout only, no calculation change) (PR #551: https://github.com/mlococo88/All-Structural/pull/551)

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

## 2026-11-01 — PR: claude/sf-dowels — Full dowel checks per pedestal: ℓ_dc worked, dowels in tension at the interface, tension development, laps and projection (SFDO; new checks, existing results unchanged) (PR #558: https://github.com/mlococo88/All-Structural/pull/558)

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

## 2026-11-01 — PR: claude/sf-shear-friction — Shear friction across the pedestal–footing interface, ACI 318-19 22.9 (SFSF; new check, existing results unchanged) (PR #568: https://github.com/mlococo88/All-Structural/pull/568)

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

## 2026-11-01 — PR: claude/sf-agg — Aggregate size input and the (4/3)·d_agg clear-spacing term; minimum clear spacing of the footing mats (SFAG; calculation change, no change at the default) (PR #572: https://github.com/mlococo88/All-Structural/pull/572)

Line numbers are approximate; search for the anchor text. Every code site is tagged `SFAG`.

### SFAG. d_agg (default 3/4 in) in every minimum-clear-spacing check   [calculation change + new check; CLAUDE.md §4]
- **Engineer request (2026-11-01):** add an aggregate-size input (default 3/4 in) and the (4/3)·d_agg clear-spacing term in every bar-spacing check that uses the minimum clear spacing (footing mats and pedestal bars).
- **Input:** `state.mat.dagg` (in), Materials tab, "Max. aggregate size d_agg". `defaultState` = 0.75; `migrateState` backfills 0.75 for old saves. Helper `sfdDagg()`.
- **Pedestal bars** (`computePhase2` → `pedDes`, anchor `const clrMin=`):
  - Before: `const clrMin=Math.max(1.5*dbL,1.5);`
  - After: `const clrMin=Math.max(1.5*dbL,1.5,4/3*sfdDagg());`
  - Provision: ACI 318-19 25.2.3, minimum clear spacing of column/pedestal longitudinal bars: the greatest of 1.5 in, 1.5d_b and (4/3)d_agg.
- **Footing mats** (new check, `directionDesign`, after the anchor `const spcTopOK=`):
  - Each mat entered: clear spacing s − d_b ≥ max(1 in, d_b, (4/3)d_agg) (ACI 318-19 25.2.1), with s as entered or derived from a quantity (SFRQ).
  - The app had no minimum-spacing check for the mats before, only s_max.
  - New keys: `desX/desY.clrMinB, clrB, clrBotOK, clrMinT, clrT, clrTopOK, dagg, dbB, dbT`.
- **Shown:**
  - Footing Design 5.2 / 5.3: block "Minimum clear spacing, x/y-bars" (worked).
  - Pedestal Design 6.x "Bar count and fit" and the report step now include the 4/3 d_agg term and its value.
  - Report §5 "Bar spacing" topic: new steps for bottom / top clear spacing.
  - Dashboard: new chip "Footing bar clear spacing"; user manual 3.1 row.
  - Drawings, general note 4: "MAX. AGGREGATE 3/4"".
- **Check cases (hand):**
  - Default, d_agg = 3/4 in → (4/3)(0.75) = 1.00 in. That is never more than 1.5 in (pedestal) and never more than max(1 in, d_b) (mats), so **every result at the default is identical to before**.
  - d_agg = 1.5 in → (4/3)(1.5) = **2.00 in**:
    - pedestal 18 in, cover 2 in, #8, 6 per x-face: s_clear = (18 − 4 − 1)/5 − 1 = **1.60 in**. Before: ≥ 1.50 → OK. After: < 2.00 → **NG** (Pedestal design chip: "bars do not fit").
    - pedestal 5 per face: (13)/4 − 1 = 2.25 ≥ 2.00 → OK.
    - mat #8 @ 3 in: s − d_b = 3 − 1 = **2.00 ≥ max(1, 1, 2.00) → OK** (margin 0).
- **Comparison (12 projects + `agg_tight`):**
  - The 12 projects use the default: `R` and `P2` are identical to before (new keys only). New chip PASS; the smallest mat margin is 6.13 in.
  - `agg_tight` (d_agg = 1.5 in): only `pedDes[0..1].clrMin` 1.5 → 2.0 and `pedDes[1].barFitOK` true → false (the flip shown above) change.
  - Report: 0 unresolved references, 0 KaTeX errors. Drawings valid.
  - `node tests/check-syntax.mjs` and `tests/smoke/spread-footing-scroll.mjs` pass.

## 2026-11-01 — PR: claude/sf-cover — Concrete cover of the pedestal vertical bars and of the footing mats vs ACI 318-19 Table 20.5.1.3.1 (SFCV; new checks, existing results unchanged) (PR #577: https://github.com/mlococo88/All-Structural/pull/577)

Line numbers are approximate; search for the anchor text. Every code site is tagged `SFCV`.

### SFCV. Vertical-bar cover and footing covers   [new checks; CLAUDE.md §4]
- **Engineer request (2026-11-01):** check the clear cover to the pedestal vertical bars, and the footing mats' covers if they were not already checked, against Table 20.5.1.3.1 for the chosen exposure, alongside the tie cover check (SFTC). Before this PR the only footing cover item was a warning for a bottom cover below 3 in; that warning is kept unchanged.
- **Pedestal vertical bars** (`pedDes`, after the anchor `const tieCov=`): `vertCovMin = sftcMin(exposure, longSize)`, `vertCovOK = cov >= vertCovMin`. The rows are the pedestal exposure input of SFTC:
  - exposed to weather or in contact with ground: No. 6 and larger 2 in, No. 5 and smaller 1.5 in;
  - cast against earth: 3 in;
  - not exposed: pedestals, primary reinforcement 1.5 in.
- **Footing** (`computePhase2`, `covChk`):
  - bottom: cast against and permanently in contact with ground, 3 in;
  - top (only when top bars are entered): in contact with ground, by the largest top bar: 2 in for No. 6 and larger, 1.5 in for No. 5 and smaller;
  - sides and ends: c = `sfdEndCover()` (side cover input, blank = bottom), checked against the row set by a **new input** `mat.sideExp`:
    - `'earth'` (cast against earth, 3 in) is the default, because footings are usually cast against the excavation;
    - `'weather'` (formed, in contact with ground) uses the largest bar of any mat.
  - `migrateState` backfills `'earth'` for old saves.
- **Shown:**
  - Footing Design 5.1: block "Concrete cover, footing" plus an NG box.
  - Pedestal Design 6.x: block "Clear cover to the vertical bars" plus an NG box.
  - Pedestal card note: vertical-bar cover line before the tie cover line.
  - Dashboard: new chip "Concrete cover" (footing and vertical bars); user manual row. The "Pedestal tie cover" chip is unchanged.
  - Report §5: new subsection "Concrete cover (Table 20.5.1.3.1)". Report §6 ties topic: new step "Clear cover to the vertical bars".
  - Drawings, general note 6: the minimum covers and NG.
- **Check cases (hand):**
  - default: bottom 3 ≥ 3, side 3 (blank = bottom) ≥ 3, no top bars (n/a); vertical #8, exposed: 2.00 ≥ 2.00 → OK.
  - `cover_fail`: top cover 1.25 in with #6 top bars → 1.25 < 2.00 **NG**; Ped 1 #6 verticals at c = 1.5 → 1.5 < 2.0 **NG** (its ties 1.125 < 1.5 NG too, SFTC); Ped 2 interior → 2.0 ≥ 1.5 OK.
- **New failures on the comparison projects:**
  - `wt_ecc_gate_3ped`: side cover entered as 2 in < 3 in (cast against earth, the default) → **FAIL**. If its sides are formed, choose "Formed" → 2 ≥ 2 (#8) OK.
  - `tie_cover_fail` (extra project, Ped 2 cast against earth): vertical 2.00 < 3.00 → **FAIL**.
  - All other projects PASS.
- **Proof nothing else changes:** headless Chromium, origin/main vs the branch, 14 projects.
  - Every value of `R` and `P2`, the warnings, consistency, state and storage are identical. New keys only: `P2.covChk`, `pedDes[].vertCovMin/vertCovOK`, `mat.sideExp`.
  - The dashboard only adds the new chip. An old save loads with identical results.
  - Report: 0 unresolved references, 0 KaTeX errors. Drawings valid.
  - `node tests/check-syntax.mjs` and `tests/smoke/spread-footing-scroll.mjs` pass.
- **Open item:** the default for the footing sides is "cast against earth" (3 in). Engineer to confirm, or set "Formed" per project.

## 2026-11-01 — PR: claude/sf-report-tablinks — Report tab links keep the tab name in print (SFTL; display only) (PR #583: https://github.com/mlococo88/All-Structural/pull/583)

### SFTL. `[[tab:x|Name]]` → `Name tab[[tab:x| ↗]]` in the Report notes   [display only]
- **Problem (coordinator, 2026-11-01):** the shared viewer prints a `[[tab:x|text]]` link as its text only in the app. In print the link (and with it the tab name) is dropped. The other tools adopted `Name[[tab:x| ↗]]`, which keeps the name as plain text.
- **Where:** `buildReportDoc` notes (anchor `[[tab:`). 11 links:
  - the §1 note listing the result tabs (Schematic, Load Combinations, Bearing, Stability, Footing Design, Pedestal Design);
  - "Set on the Reinforcement input tab";
  - three "Footing Design tab" notes;
  - "Pedestal Design tab".
- **Before / after (example):** `on the [[tab:peddes|Pedestal Design tab]]` → `on the Pedestal Design tab[[tab:peddes| ↗]]`.
- **How verified:** report on 12 projects (0 unresolved references, 0 KaTeX errors); `R` and `P2` unchanged; the report text keeps the tab names; `node tests/check-syntax.mjs` passes.

## 2026-11-01 — PR: claude/sf-sf-rough — Shear-friction joint surface: default intentionally roughened, μ = 1.0λ (SFSR; calculation change) (PR #588: https://github.com/mlococo88/All-Structural/pull/588)

### SFSR. Default "Joint surface" = intentionally roughened   [calculation change; CLAUDE.md §4]
- **Engineer decision (2026-11-01):**
  - New projects default to intentionally roughened, μ = 1.0λ (ACI 318-19 Table 22.9.4.2).
  - "Not intentionally roughened" (0.6λ) stays as an override.
  - A stored choice is kept. Saves without the field (made before #568) get the new default.
  - Kept as decided: N_u = dead load only; the worst-case tension area is deducted in every combination; the footing sides default to cast against earth.
- **Where:**
  - `newPed`:
    - before: `sfJoint:'smooth'`
    - after: `sfJoint:'rough'`
  - `migrateState`:
    - before: `if(p.reinf.sfJoint!=='rough')p.reinf.sfJoint='smooth';`
    - after: `if(p.reinf.sfJoint!=='smooth'&&p.reinf.sfJoint!=='rough')p.reinf.sfJoint='rough';`
  - `sfdShearFriction`:
    - before: `const rough=rf.sfJoint==='rough'`
    - after: `const rough=rf.sfJoint!=='smooth'`
  - Pedestal card select: "Roughened" is listed first and is the fallback.
  - The 5.6 note text is updated.
  - Comments only: the misplaced comments on the `migrateState` lines (SFTC/SFDO) are moved to their own lines.
- **Effect:** where the μ(A_vf f_y + N_u) term governs before and after, the DCR drops by the factor 0.6/1.0. Where V_n,max (22.9.4.4) governs after, the DCR drops less. Where V_n,max already governed, the DCR is unchanged. No project fails either way.
- **Hand check:** `uplift_partial`, Ped 1, 0.9D + 1.0(+Wx). V_u = 40 k, A_vf = 2.29 in², N_u = 108.61 k.
  - Before (μ = 0.6): V_n = 0.6(2.29·60 + 108.61) = 147.76 k, φV_n = 110.82 k, **DCR 0.361**.
  - After (μ = 1.0): V_n = 1.0(137.66 + 108.61) = 246.27 k. Roughened normalweight limit min(0.2·4000, 480 + 0.08·4000, 1600)·324/1000 = 800·324/1000 = 259.2 k does not govern. φV_n = 184.70 k, **DCR 0.217** (= 0.6 × 0.361).
- **Comparison** (origin/main vs the branch, 14 projects; governing DCR before → after):

  | Project | Before → after | Why |
  |---|---|---|
  | uplift_partial | 0.361 → 0.217 | μ governs |
  | offsets | 0.131 → 0.079 | μ governs, A_vf = 0 |
  | direct | 0.047 → 0.041 | V_n,max governs after |
  | direct_moment | 0.048 → 0.042 | V_n,max governs after |
  | the other 10 | 0.041 unchanged | V_n,max already governed |

  - Only `P2.shearFr` and `reinf.sfJoint` change; every other value of `R` and `P2` is identical.
  - Saved data:
    - no field → roughened;
    - explicit "smooth" → kept (μ 0.6);
    - explicit "rough" → kept.
  - Report: 0 unresolved references, 0 KaTeX errors. Drawings valid. `node tests/check-syntax.mjs` and the scroll test pass.

## 2026-11-02 — PR: [#674](https://github.com/mlococo88/All-Structural/pull/674) — PLIB: "Saved projects…" dialog (Open / Rename / Duplicate / Delete)   [display and storage only]
- **Before:** Project Manager: name box + Save / Overwrite, drop-down + Load / Delete (`sfd_projects`, `{ name: state }`), Export / Import
  JSON, Undo / Redo (U-2), Reset. No rename, no duplicate.
- **Where:**
  - after `<script src="shared/dxf.js"></script>`: `<script src="shared/projects.js"></script>` and `<script src="shared/projects-ui.js"></script>`.
  - an IIFE before `$('#btnExport').addEventListener('click',()=>{` (anchor `/* PLIB (2026-11-02): "Saved projects…" dialog`):
    `mapStore(localStorage,'sfd_projects')`; dialog `open` = the Load button's code without its alert (`state=Object.assign(defaultState(),…);
    migrateState(); SEL…=null; bindStaticInputs(); buildPedCards(); saveAuto(); recalc();`); a rename of the project named in the name box
    updates the name box; the drop-down is redrawn after every change. Button "Saved projects…" after Delete.
- The tool's own Undo / Redo (U-2) is unchanged (Open from the dialog goes through `saveAuto()`, so it is one undo step as Load is).
- **Saved data:** keys `sfd_projects`, `sfd_auto` and their formats unchanged; no new key.
- **How verified:** `node tests/smoke/project-library.mjs --tool spreadfooting`: ALL PASS (`R` identical to origin/main on load, after an
  input change, reopened on main's storage and opened from the dialog; dialog rename / duplicate / delete byte-identical; quota; 390 px;
  no new console errors). `node tests/smoke/spread-footing-scroll.mjs`: PASS. `node tests/check-syntax.mjs`: pass.
- **Formulas, factors, units, code references:** none changed (§4 does not apply).
- **Entered demands:** already entered directly (factored and service column loads per case, and the hand-offs memberReactions /
  foundationLoads). Nothing added.
## 2026-11-02 — PR: claude/sf-dowel-allcombos — Dowels and shear friction: A_s,req over every combination, A_vf developed on both sides, N_u = 0.9D; pedestal reinforcement on the Reinforcement tab, longitudinal bars as dowels, hooked end (SFDA, SFDB; calculation change) (PR #684: https://github.com/mlococo88/All-Structural/pull/684)

### SFDA. Pier-to-footing dowels and shear friction   [calculation change; CLAUDE.md §4]
- **Engineer decision (2026-11-02), after the independent audit (discrepancies #1, #2, #3 and #5, cases SF-1 and SF-2):**
  1. The dowels are checked for every load combination. The worst combination governs both A_s,req and the "dowels in tension" trigger.
  2. Shear-friction dowels must be developed on both sides of the joint, into the footing and into the pedestal. The case where they are not is handled.
  3. A_vf is recomputed consistently with 1 and 2.
  4. Shear friction uses the permanent N_u = 0.9 × D (dead load only, factored 0.9).
- **Provisions** (read in AASHTO LRFD 10th Ed. (2024); paraphrased):
  - Art. 5.7.4.1: all reinforcement where interface shear transfer is considered must be fully developed on both sides of the interface (embedment, hooks, mechanical means or welding).
  - Art. 5.7.4.3, Eq. 5.7.4.3-3: V_ni = cA_cv + μ(A_vf f_y + P_c). P_c is the net compression normal to the shear plane from **unfactored** permanent loads (0 if tensile). The commentary says that neglecting P_c is conservative. Eqs. 5.7.4.3-4 and -5 are the upper limits.
  - The tool's shear-friction basis stays ACI 318-19 22.9 (V_n = μ(A_vf f_y + N_u), Table 22.9.4.2, 22.9.4.4–22.9.4.6). 0.9D is less than the unfactored permanent load, so it is on the conservative side of the AASHTO P_c definition.
- **Where** (function + anchor text):
  - `sfdDowelCheck(i,p,bz,pd,combos,fc,fy,lam,sfPre)`: new last argument (the shear-friction result with A_vf = 0).
    - Item 1. Before (the combination with the largest ratio at the provided area only):
      ```
      const g=o.tenGov;let k;
      if(ratioAt(0,g)<=1)k=0;
      else{...bisection on g...}
      o.kReq=k;
      ```
      After (`kOf` = the same bisection, run for every combination in tension; the largest k governs):
      ```
      const kOf=g=>{let k; ...same bisection... return k;};
      o.tenRat.forEach(z=>{z.k=kOf(z);});
      o.kGov=o.tenRat.reduce((a,z)=>(!a||z.k>a.k)?z:a,null);
      const k=o.kGov.k;
      o.kReq=k;
      ```
      `o.AsReq=k*AsBase`, `o.tenOK` and `o.tension=k>0` are unchanged in form. `o.tenGov` (largest ratio) is kept for the ratio step.
    - Item 2. Before: `if(o.tension){ o.ld=...; o.ldh=...; o.LftgReq=...; o.ftgOK=...; ...o.lst=... }else{o.ftgOK=true;if(!o.tenKern){...}}`.
      After:
      ```
      o.sfNeed=!!(sfPre&&!sfPre.isPatch&&sfPre.gov&&!sfPre.ok);o.sfNeedDCR=sfPre&&sfPre.gov?sfPre.gov.ratio:0;
      o.devTen=o.tension||o.sfNeed;
      if(db>0){ o.ld=...; o.ldh=...; o.LftgReq=...; ...o.lst=... }   // always computed
      if(o.devTen){o.ftgOK=o.LftgReq<=bz.availEmb+1e-9;
      }else{o.ftgOK=true;}
      if(!o.tenKern){o.tenOK=true;o.kReq=0;o.AsReq=0;}
      ```
      `o.Lreq=Math.max(o.lc,o.tension?o.lst:0)` → `o.Lreq=Math.max(o.lc,o.devTen?o.lst:0)`;
      `o.LpedReq=o.tension?o.ld.Ld:o.Ldc` → `o.LpedReq=o.devTen?o.ld.Ld:o.Ldc`.
      New, after the projection:
      ```
      o.sfDevFtg=db>0&&o.LftgReq<=bz.availEmb+1e-9;
      o.sfDevPed=db>0&&(o.full?o.ld.Ld<=o.hAvail+1e-9:o.lst<=o.Lprov+1e-9);
      o.sfDev=nD>0&&o.sfDevFtg&&o.sfDevPed;
      ```
  - `sfdShearFriction`:
    - Item 3. Before: `const AsReqT=dw&&dw.tension&&isFinite(dw.AsReq)?dw.AsReq:0, Avf=Math.max(0,(dw?dw.AsProv:0)-AsReqT);`
      After:
      ```
      const AsReqT=dw&&dw.tension?dw.AsReq:0, AvfNom=isFinite(AsReqT)?Math.max(0,(dw?dw.AsProv:0)-AsReqT):0,
       dev=!!(dw&&dw.sfDev), Avf=dev?AvfNom:0;
      ```
      (A_s,req = ∞ used to count the whole dowel area as A_vf. It now gives 0.)
    - Item 4. Before: `Pperm=(f.dead||1)*Wped;` (direct mode) and `Pperm=(f.D||0)*(num(p.loads.D.P)+Wped);`.
      After: `Pperm=o.NUF*Wped;` and `Pperm=o.NUF*(num(p.loads.D.P)+Wped);` with `o.NUF=0.9`. `N_u=Math.max(0,Math.min(Pperm,pl.P))` is unchanged.
  - `computePhase2`: before `const dowels=peds.map((p,i)=>sfdDowelCheck(i,p,bearing[i],pedDes[i],combos,fc,fy,lam));`. After, a first shear-friction pass with A_vf = 0 decides whether the dowels are relied on:
    ```
    const sfPre=peds.map((p,i)=>sfdShearFriction(i,p,R.Wpeds[i],pedDes[i],null,combos,fc,fy,lam));
    const dowels=peds.map((p,i)=>sfdDowelCheck(i,p,bearing[i],pedDes[i],combos,fc,fy,lam,sfPre[i]));
    ```
  - Display (§6), with the work shown:
    - Report §5.6 (anchor `S({id:q+'AvfN'`): A_s,dow − A_s,req, then the development step on both sides (footing ℓ_d / ℓ_dh vs available; pedestal Class B lap vs projection, or full-height ℓ_d vs h − c), A_vf counted, N_u = min(0.9(P_D + W_ped), P_u).
    - Report §5.7: A_s,req step names the governing combination (largest k). The table has a k column, and the k-governing row is highlighted. A "shear friction relies on the dowels" step appears where it applies. Tension development and lap steps are shown where `devTen`.
    - Footing Design 5.6 (`sfsfRender`, `sfdoRender`): the same equations and notes. (2c)/(2d) are shown where `devTen`, and the table has a k column.
    - Drawings (`sfdwDowelNote`, elevation text): L_D / L_DH and "CLASS B LAP" where `devTen` (before: `tension`).
- **Problem fixed:**
  - Items 1/3: A lower-P_u combination (typically 0.9D + W) that needs dowel tension was missed. Tension development was then skipped and the check reported OK. Before, A_vf used the understated A_s,req. Unconservative.
  - Item 2: A_vf f_y was counted with no check that the dowels are developed in tension. Unconservative.
  - Item 4: N_u used the combination's own dead factor (1.2 or 1.4). It is now 0.9 in every combination. More conservative.
- **Check cases.** Ped 1 of the default project: 18 × 18 in, h 24 in, 8 #8 dowels (6.32 in²), #8 verticals, c 2 in, f′c 4 ksi, f_y 60 ksi, footing t 30 in. Available in the footing t − c − d_bx − d_by = 25.0 in, h − c = 22.0 in. ℓ_d(#8) = 28.46 in, ℓ_dc = 18.97 in, ℓ_st = 37.0 in, ℓ_sc = 30.0 in. P_D + W_ped = 120.675 k.
  - **SF-2** (L: P 60, M_y 40; W_x: P −40, V_x 12, M_y 36):
    - Item 1. Before: governing 1.2D + 1.0W + L + 0.5S (P 164.81, M 100 k-ft; plain-concrete φM_n ≈ 103 > 100), k = 0, A_s,req = 0, no tension, dowel check OK. After: 0.9D + 1.0(+W_x) (P_u 68.61 k, M_uy 36 + 12·2 = 60 k-ft). Plain concrete: a = (68.61/0.65)/(0.85·4·18) = 1.73 in, φM_n ≈ 0.65·105.55·(9 − 0.86)/12 = 46.5 k-ft < 60, so k = 0.0574 and **A_s,req = 0.36 in²** (audit hand: 0.36). Tension development then governs: ℓ_d 28.46 > 25.0 (footing) and full height ℓ_d 28.46 > 22.0, so the **dowel check is NG**.
    - Item 3: A_s,dow − A_s,req = 6.32 − 0.36 = 5.96 in². Not developed (above), so **A_vf = 0** (before 6.32).
    - Item 4 and the shear-friction result. Before: governing 1.2D + 1.0(+W_x) + L + 0.5S, N_u = min(1.2·120.675, 164.81) = 144.81, V_n = 1.0(6.32·60 + 144.81) = 524.0 → V_n,max 259.2 governs, φV_n = 194.4, **DCR 0.062**. After: governing 0.9D + 1.0(+W_x), N_u = min(0.9·120.675 = 108.61, P_u 68.61) = 68.61, V_n = 1.0(0 + 68.61), φV_n = 51.46, **DCR 0.233**.
  - **SF-1** (e_x 0.25 ft; W_x: P −40, V_x 12, M_y 60). Item 1: A_s,req 0.79 (k 0.125, 1.2D + W + L + 0.5S) → **1.71 in²** (k 0.2708, 0.9D + 1.0(+W_x); audit hand 1.70). Item 3: A_vf 5.53 → nominal 6.32 − 1.71 = 4.61 (audit hand 4.62), not developed, so **0**. Shear friction DCR 0.062 → 0.233. The dowel check was already NG (development) and stays NG.
  - **Default project**:
    - Dowel results are unchanged: A_s,req 0, no tension, OK.
    - Shear friction, Ped 1: A_vf 6.32 → 0 (ℓ_d 28.46 > 25 in the footing, full height 28.46 > 22 in the pedestal). N_u 144.81 → 108.61. φV_n 194.4 → 81.46. DCR **0.041 → 0.098**.
    - Shear friction, Ped 2: N_u 180.81 → 135.61, φV_n 194.4 → 101.71, DCR **0.041 → 0.079**.
    - Both stay OK.
  - **Item 2, dowels relied on** (scratch case: Ped 1 3 × 3 × 1.5 ft, not intentionally roughened μ 0.6, D + 150 k, W_x V_x 115 k; φμN_u alone = 0.45·244.82 = 110.17 < 115):
    - With 8 #8 dowels: before, A_vf 6.32 counted, V_n = 0.6(379.2 + 244.82) = 374.4, **DCR 0.410 OK**. After, the dowels must be developed: ℓ_d 28.46 > 25 (footing) and full height 28.46 > 16 (pedestal). So A_vf = 0, **DCR 1.044 NG**, and the dowel check is NG.
    - With 12 #5 dowels: ℓ_d 14.23 ≤ 25 and full height ℓ_d 14.23 ≤ 16, so the dowels are developed and A_vf = 3.72 counts. DCR 0.546 before and after.
- **How verified:**
  - Headless Chromium on origin/main vs the branch, using the pinned KaTeX 0.16.11, Plotly 2.35.2 and three 0.160.0 from npm. Cases: default, SF-1, SF-2, the two item-2 cases, and direct mode.
    - A deep diff of every `P2` value: only `P2.dowels` and `P2.shearFr` differ.
    - At the default, `P2.dowels` only gains new fields. No existing value changes.
    - The report text differs only in §5.6, and in §5.7 where the dowels change.
    - The dashboard differs only in the shear-friction chip (default: max DCR 0.04 → 0.10).
  - Report on all 6 cases: 0 unresolved or duplicate references, 0 KaTeX errors, no NaN or undefined. Drawings build (`sfdwBuild`).
  - 0 console errors. `node tests/check-syntax.mjs` passes, as does `tests/smoke/spread-footing-scroll.mjs --libs`.
  - Cost: `computePhase2` takes about 107 → 236 ms on a case with 7 combinations in tension (one bisection per combination).
- **Saved data:** no new input, key or format.
- **Other copies:** none.
- **Open items:**
  - ACI 318-19's own article for developing shear-friction steel on both sides was not checked (no ACI copy here). AASHTO 5.7.4.1 is cited.
  - N_u = 0.9D follows the engineer's decision. AASHTO 5.7.4.3 defines P_c from unfactored permanent loads, so 0.9 is a conservative choice within it.
  - Partial development (scaling f_y by available/required length) is not taken. Undeveloped dowels count A_vf = 0.

### SFDB. Pedestal reinforcement on the Reinforcement tab; "Pedestal longitudinal bars act as the dowels"; "Hooked end in footing"   [calculation change for new projects; CLAUDE.md §4, §5]
- **Engineer requests (2026-11-02), same PR as SFDA:**
  1. Move the pedestal reinforcement inputs to the Reinforcement tab. No result change, and the saved fields are unchanged.
  2. A checkbox "Pedestal longitudinal bars act as the dowels". When ticked, the dowel size, count and layout are those of the longitudinal bars, and the separate dowel inputs are greyed out. New projects: ticked. Old saves: unticked (migration).
  3. A checkbox "Hooked end in footing" (standard hook at the footing end). Footing side: hooked → ℓ_dh, straight → ℓ_d, against t − c_bot − d_b,x − d_b,y. Pedestal side: continuous bars are developed by definition; separate dowels need the Class B tension lap within the projection (or ℓ_d full height). New projects: ticked. Old saves keep their behaviour.
- **Where:**
  - HTML: new section `<details class="sec" id="sec-pedrebar">` ("Pedestal Reinforcement & Dowels", container `#pedRebarContainer`) after `sec-rebar`. `SFD_IN_SEC` gets `'sec-pedrebar':'rebar'`.
  - `buildPedCards`:
    - The tables for longitudinal bars, ties, cover, exposure, bar entry mode, bar info, dowels and joint surface are built into a per-pedestal block `div.pedbody.sfdPedRb[data-ped=i]` in `#pedRebarContainer`, instead of the pedestal card. The `data-path`s are unchanged.
    - New checkbox `data-path="peds.i.reinf.dowelLong"`.
    - The dowelHook `<select>` (Straight / 90° hook) becomes `<input type="checkbox" data-path="peds.i.reinf.dowelHook" data-on="hook90" data-off="straight">`. The field and its values are unchanged.
  - `handleFieldChange`, `bindStaticInputs`, the document `input` / `change` listeners: checkboxes (value = `data-on` / `data-off`, else a boolean), handled on `change` only. A label change also renames the block header.
  - `sfdPedBarInfo`: `dowelSize`, `dowelN` and `dowelProj` are disabled when the longitudinal bars act as the dowels. The info line names those dowels.
  - `newPed`:
    - before: `...dowelHook:'straight',dowelProj:'',sfJoint:'rough'}`
    - after: `...dowelHook:'hook90',dowelProj:'',sfJoint:'rough',dowelLong:true}`
  - `migrateState`: new `if(p.reinf.dowelLong!==true&&p.reinf.dowelLong!==false)p.reinf.dowelLong=false;`. The existing `dowelHook` line (missing → 'straight') is unchanged. A stored value is never changed.
  - New `sfdDowelBars(i)`: `{size:longSize, n:sfdPedBars(i).n, fromLong:true}` when `dowelLong===true` and h > 0. Otherwise `{size:dowelSize, n:dowelN}`. It is used in:
    - the bearing dowel area: before `(reinf.dowelN||0)*BAR_AREA[reinf.dowelSize||0]`, `dSize=reinf.dowelSize||8`;
    - `sfdDowelCheck` (`nD`);
    - the Report input table and the §5.5 dowel step label;
    - the drawings (pedestal note, schedule: the vertical bar row gets the embedment and hook length, and no separate dowel row);
    - the 3D view.
  - `sfdDowelCheck`: `o.cont=DB.fromLong`. When `o.cont`:
    - `o.full=false; o.Lreq=0; o.Lprov=h−c; o.projOK=true` (no lap, no projection check);
    - `o.sfDevPed` is true.
  - Display:
    - The footing-side tension development (ℓ_dh or ℓ_d, with its equation substituted) is shown in Report §5.7 and Footing Design (2c) for every pedestal. It is marked "not required here" when neither interface tension nor shear friction needs it.
    - Pedestal side, continuous bars: the step "developed in the pedestal by definition; no lap or projection check".
    - Pedestal side, separate dowels: the Class B lap ℓ_st and the projection, as before.
- **Formulas:** unchanged. The tool's ACI 318-19 expressions are kept:
  - ℓ_d per 25.4.2.4;
  - ℓ_dh per 25.4.3.1(a), with ψ_r = 1.6 and ψ_o = 1.0;
  - Class B lap per 25.5.2;
  - ℓ_dc per 25.4.9.2.
  - The request cites AASHTO LRFD 10th Ed. 5.10.8.2.1 (straight), 5.10.8.2.4 (hooks) and 5.10.8.4.3 (tension laps). These articles were confirmed to exist in the 10th Ed. PDF. Their ℓ_d expression (Eq. 5.10.8.2.1a, with λ_rc from Eq. 5.10.8.2.1c-2) differs from ACI. Switching is left as an open question (below).
- **Check cases** (Ped 1 18 × 18 × 24 in, #8, f′c 4 ksi, f_y 60 ksi, available 25.0 in):
  - Hooked ℓ_dh = max(60000 · 1.0 · 1.6 · 1.0 · (4000/15000 + 0.6) / (55 · 1.0 · 63.25) · 1.0^1.5, 8, 6) = max(23.92, 8, 6) = **23.92 in ≤ 25.0 OK**. Straight ℓ_d = 3/40 · 60000/63.25 · 1.0/2.5 · 1.0 = **28.46 in > 25.0**.
  - **Default (new) project:**
    - Before (main, and SFDA with straight separate dowels): A_vf 6.32. After SFDA alone: A_vf 0, Ped 1 DCR 0.098.
    - Now (hooked, continuous bars): footing ℓ_dh 23.92 ≤ 25 and the pedestal developed by definition, so the dowels are developed and **A_vf = 6.32**. N_u = 108.61 (0.9D). V_n = 1.0(6.32 · 60 + 108.61) = 487.8 > V_n,max 259.2, so φV_n = 194.4 and **DCR 0.041** (main 0.041).
    - Dowel check: OK, with no lap and no projection check (main: compression lap 30 > 22, full height ℓ_dc 18.97 ≤ 22).
  - **SF-2 with the new defaults:**
    - A_s,req 0.36 in² (SFDA). Tension development: ℓ_dh 23.92 ≤ 25 in the footing, continuous bars in the pedestal, so the **dowel check is OK**. (With straight separate dowels, SFDA: NG on ℓ_d 28.46 > 25 and full height 28.46 > 22.)
    - A_vf = 6.32 − 0.36 = 5.96 is counted. Shear friction DCR 0.062 (V_n,max governs).
  - **SF-1 with the new defaults:** A_s,req 1.71, dowels developed, A_vf 4.61 counted, DCR 0.062, dowel check OK.
- **Saved data (§5):**
  - No key or field is renamed.
  - New field `reinf.dowelLong`. Saves without it get `false`: separate dowels, and the stored `dowelHook` is kept (missing → 'straight', as before).
  - Checked: old saves (dowelLong false, straight) give `P2` identical to SFDA on default, SF-1, SF-2, the two item-2 cases and direct mode. The only difference is the new field `dowels[i].cont`. Unticking then re-ticking keeps the separate dowel inputs.
- **How verified:**
  - Headless Chromium, origin/main vs the branch:
    - with the new defaults: only `P2.dowels` and `P2.shearFr` differ (default, SF-1, SF-2, direct);
    - SFDA vs old saves on the branch: identical apart from `cont`.
  - UI checks:
    - the inputs are on the Reinforcement tab and not in the card;
    - the new pedestal has both boxes ticked and the dowel inputs disabled;
    - long bars #9 give dowels #9 × 8;
    - unticking restores the #8 dowel inputs and enables them;
    - the hook checkbox toggles 'hook90' / 'straight';
    - `migrateState` on a save without the field gives `false`;
    - a label edit renames the block.
  - Report: 0 unresolved references, 0 KaTeX errors, no NaN. Drawings build. `node tests/check-syntax.mjs` passes, as does the scroll smoke test.
- **Other copies:** none.
- **Open items (questions for the engineer):**
  1. Should ℓ_d, ℓ_dh and the tension lap switch from ACI 318-19 (the tool's basis) to AASHTO LRFD 10th Ed. 5.10.8.2.1 / 5.10.8.2.4 / 5.10.8.4.3?
     - The 10th Ed. ℓ_db form (Eq. 5.10.8.2.1a) gives 0.17 · 1.0 · (60/(1.97 · 4^0.25))² = 78.9 in for #8, before λ_rc (0.3 to 1.0, Eq. 5.10.8.2.1c-2).
     - With λ_rc = d_b/(c_b + k_tr) = 0.4 (β_t = 0), ℓ_d ≈ 31.6 in, against ACI's 28.46. This needs a decision on β_t, n_s and the hook factors.
  2. Development of the continuous bars above the joint is taken as satisfied by definition, as instructed. The pedestal height itself (h − c = 22 in < ℓ_d 28.46 for straight #8) is not checked against a bar terminating at the pedestal top.

### SFDC. Dowel area presented as minimum / required for interface tension / governing   [D/C display and dowel-check logic; CLAUDE.md §4]
- **Engineer request (2026-11-02):**
  - The step "Dowel area required (smallest k A_s,prov…)" was read as k × A_g.
  - Show three things: (1) 0.005A_g, substituted; (2) A_s,req in plain words, with k and what k > 1 means; (3) A_s,gov = max of (1) and (2) against A_s,prov, with its D/C.
- **Where:**
  - `sfdDowelCheck`, before `return o`:
    - before: `o.ok=o.tenOK&&o.ftgOK&&o.projOK;`
    - after:
      ```
      o.Ag=A;o.AsMin=0.005*A;o.AsGov=Math.max(o.AsMin,isFinite(o.AsReq)?(o.AsReq||0):Infinity);
      o.asOK=o.AsGov<=AsProv+1e-9;o.dcAs=AsProv>0?o.AsGov/AsProv:Infinity;
      o.ok=o.asOK&&o.tenOK&&o.ftgOK&&o.projOK;
      ```
  - Summary table row "Dowels (tension, laps)":
    - before: D/C = `z.tension?(z.AsProv>0?z.AsReq/z.AsProv:Infinity):0`, labelled A_s,req/A_s,prov
    - after: D/C = `z.dcAs`, labelled A_s,gov/A_s,prov with A_s,gov = max(0.005A_g, A_s,req) (§16.3.4.1 added)
  - Dashboard chip text: "A_s,gov … > A_s,prov …".
  - Report §5.7:
    - A_s,req step reworded: the provided area is scaled by k at the same bar positions until the interface ratio is ≤ 1. "k > 1: the dowels provided are k times short". "k multiplies the dowel area, not A_g".
    - New steps `AsMin` (0.005 A_g, A_g = b_x b_y substituted) and `AsGov` (max, ≤ / > A_s,prov = n × A_b, D/C).
  - Footing Design 5.6:
    - new block (2e);
    - the same note under (2b);
    - table column A_s,gov / A_s,prov.
- **Effect:**
  - The dowel-check D/C now includes the minimum. Default Ped 1: before 0 (no interface tension), after A_s,gov/A_s,prov = max(0.005·324 = 1.62, 0)/6.32 = **0.256**.
  - The dowel check's pass/fail now also fails when A_s,prov < 0.005A_g. That case was already a FAIL on the separate "Dowel steel (min 0.005A_g)" chip.
  - No computed area changes. Checked against the previous commit on default, SF-2, M_y 600 and an old SF-2 save: `P2` differs only by the new fields.
- **Check case:** M_y(W_x) = 600 k-ft on default Ped 1 (governing 1.2D + 1.0(+W_x) + L + 0.5S, P_u 204.81).
  - k = 4.276, so A_s,req = 4.276 · 6.32 = 27.03 in².
  - A_s,min = 1.62, so A_s,gov = 27.03 > 6.32: D/C 4.28, NG ("4.28 times short").
  - Plausibility: only the 3 bars of the tension face (3/8 of the area) work. M/(φ f_y 0.9d) = 7200/(0.9·60·0.9·15.5) ≈ 9.6 in² on that face, i.e. ≈ 25.6 in² total. That is the same order, so this is not a scaling bug.
- **Open items:**
  - k ≈ 15 cannot be reproduced on the default project. It has no interface tension, so no k is shown. The engineer's project is needed.
  - Observation, not changed: for net uplift with M = 0, `sfpmRatios` reaches its tension limit at about 0.52 f_y per in² of steel. Example: P_u −55.19 k needs 1.78 in², against 55.19/(0.9·60) = 1.02 in² by hand. This is conservative and comes from the shared P–M routine. Raised, not changed.

## 2026-11-02 — PR: claude/sf-show-work-links — Show the work and link to it: report summary of results, section keys instead of hard-coded § numbers, cross-step links (SFLK; display only, no result change) (PR #693: https://github.com/mlococo88/All-Structural/pull/693)

### SFLK. CLAUDE.md §6 links across the Report and the inputs
- **Engineer request (2026-11-02):** every value quoted away from where it is worked gets an in-app link, and a "see §x.y" in print. This uses the shared `[[key]]` mechanism of `shared/report.js` (as in lldf).
- **Where:**
  - `sfrModel`, sections and subsections get anchor keys:
    - sections: `S-stab`, `S-fd`, `S-pd`, `S-ref`;
    - subsections: `S-rb` (footing reinforcement), `S-asd`, `S-lrfd`, `S-res`, `S-bp`, `S-qa`, `S-ecc`, `S-st`, `S-fdx`/`S-fdy`, `S-pun`, `S-cbr`, `S-sf`, `S-dow`, `S-cov`, `S-pd<i>`.
    - When no strength combination exists, "Pedestal design" now gets a "Not computed" section, as "Footing design" already did. This keeps the numbering and the keys.
  - Hard-coded section numbers in report text become keys. There were 18: "see §8", "used in §5", "(§2.4, §6)", "worked in §2.4" ×2, "(§5, §6)", "§3.2" ×2, "§3.1 and §3.2", "§2.2", "§2.3" ×2, "§1.4", "in §5", "in §4". They print the right number whatever the section order, and they are links on screen.
  - New first section **Summary of results**: one row per dashboard check (`sfdResultRows`), with the check, the result, D/C, status and "Worked in" (`[[S-…]]`, only keys present in the report).
  - Cross-step notes (`see:'dow'` on the `cbr` and `sf` step items):
    - §5.5 dowel area → `§p<i>.AsGov`;
    - §5.5 ℓ_dc → `§p<i>.ldc`;
    - shear friction A_s,dow − A_s,req → `§p<i>.AsGov`;
    - shear friction "developed on both sides" → `§p<i>.Lftg`.
  - Table rows:
    - interface-tension table, the k-governing row → `dow/p<i>.AsReq`;
    - shear-friction table, the governing row → `sf/f<i>.DCR`.
  - Reinforcement input tab, pedestal block: "Dowels and shear friction worked in" link to Footing Design 5.6.
- **Effect:**
  - The report sections are renumbered by one: Summary is §1, Project and inputs §2, and so on.
  - No computed value changes. A deep diff of `P2` on main vs the branch is empty on 7 cases: default, SF-2, the shear-friction case, direct mode, M_y 600, an old SF-2 save and a large-uplift case.
  - Report: 0 unresolved or duplicate references, 0 KaTeX errors, no NaN on all 7.
  - `node tests/check-syntax.mjs` passes, as does the scroll smoke test.
- **Other copies:** none.
- **Open items:**
  - Step-level references print the subsection number (§6.7), as the shared report does elsewhere.
  - The old print path (`renderPrintHeader`, "see §" on chips) is left to the agent retiring the old print reports.

## 2026-11-02 — PR: claude/sf-pm-bracket — P–M neutral-axis search: lower bracket expanded; combinations the section cannot reach are NG (SFPB; calculation change) (PR #698: https://github.com/mlococo88/All-Structural/pull/698)

### SFPB. `pmContour` lower bracket on c   [calculation change; CLAUDE.md §4]
- **Finding** (independent review of the engineer's "Seymour Platform Foundation" report, item A1; approved 2026-11-02):
  - Ped 1 is 24 × 112 in. Its dowel A_s,req was 15.36 · 12.32 = 189 in² (the engineer's "k ≈ 15") and its A_vf was 0.
  - In the pedestal P–M check, 6 of the 15 combinations were "not computed", yet the check was reported OK at 0.017.
- **Cause:** `pmContour` searched c in [0.05·max(b_x, b_y), 4·max(b_x, b_y)]. For Ped 1 the bottom of that range is c = 5.6 in. Bending about the 24-in side, that c already gives φP_n = 1491 kip, so no P_u below 1491 kip could be reached. `sfpmPoint` then returned "range":
  - the dowels were taken as "> capacity", and k was bisected up to that threshold;
  - the pedestal check skipped those combinations.
- **Where:**
  - `pmContour`, the bisection on c. Before:
    ```
    let lo=0.05*Math.max(bx,by),hi=4*Math.max(bx,by),found=null;
    ```
    After: the same line, then
    ```
    for(let e=0;e<40&&lo>1e-6;e++){const r0=analyze(lo,ang);if(phiOf(lo,ang)*r0.Pn<=Pu_target)break;lo/=4;}
    ```
    The lower bracket is divided by 4 until φP_n(lo) ≤ P_u. Where the old bracket already reached P_u nothing changes: the same lo and the same bisection path.
  - A combination still out of range is P_u below the net tension the section can carry. That is now **NG**, never skipped:
    - dashboard chip "Pedestal P–M (biaxial)": FAIL (before: REVIEW);
    - summary D/C: ∞;
    - Pedestal Design warning box: "NG";
    - Report: a step "Combinations beyond the section's tension capacity", marked NG.
- **Check cases:**
  - **Review case** (24 × 112 in, 30 #6, c 2 in + d_b/2 = 2.375 in, f′c 4 ksi, f_y 60 ksi), the tool's own `sfpmRatios`:
    - 0.9D + 1.0Wx (P 47.91, M_x 19.67, M_y 48): before "range" → after ratio **0.0706**, |φM_n|θ = 734.7 kip-ft (review: 0.071 / 734.9).
    - 1.2D + 1.6S + 0.5Wx (P 70.66, M_x 30.30, M_y 24): before "range" → after **0.0348** (review: 0.035).
    - Hand: tension face 14 #6 = 6.16 in², T = 370 kip, a = (370 + 70.7)/(0.85·4·112) = 1.16 in, c ≈ 1.4 in (< 5.6). φM_n ≈ 0.9·(370·(21.63 − 0.58) + 70.7·(12 − 0.58))/12 ≈ 645 kip-ft. Ratio < 0.1.
    - 32 × 32 in section: unchanged (0.2910 before and after).
  - **Whole tool, 24 × 112 in pedestal** (2 × 9.333 ft, 3 × 14 #6, separate 28 #6 dowels, D 50, W_x P −10, V 8, M_y 24):
    - dowel A_s,req 171.1 → **0.009 in²**;
    - A_vf 0 → 12.31 in²;
    - shear-friction DCR 0.266 → **0.014**;
    - pedestal P–M: 9 of 9 combinations "range" → all computed.
  - **Net uplift** (default Ped 1, W_x P −400): governing 1.2D + 1.6S + 0.5(+W_x), P_u −55.19, M 0.
    - Dowel A_s,req 1.778 → **1.004 in²**. Hand: 55.19/(0.9·60) = 1.02 in². The previously noted "0.52 f_y" conservatism (SFDC open item) was this same bracket.
    - A_vf 4.54 → 5.32.
  - **Unchanged** (deep diff of `P2`, main vs branch, empty): default, SF-2, direct mode, M_y 600.
- **How verified:**
  - Headless Chromium with the pinned libraries. Report: 0 unresolved or duplicate references, 0 KaTeX errors, no NaN. 0 console errors.
  - `node tests/check-syntax.mjs` passes, as does the scroll smoke test.
  - Cost: `sfpmRatios` on the review's points takes 84 → 248 ms. The extra cost is only where the bracket expands.
- **Other copies:** none. Only `sfpmRatios` → `sfpmPoint` and the pedestal P–M diagram (`pmContour`, two calls) use it.

## 2026-11-02 — PR: claude/sf-calc-fixes — Biaxial middle third; punching J_c from the truncated section; top-mat inner-layer depth; pedestal slenderness k = 2; proportional development credit in shear friction; ACI / IBC citations (SFEB, SFPJ, SFTD, SFKS, SFPD, SFCI; calculation change) (PR #710: https://github.com/mlococo88/All-Structural/pull/710)

Engineer-approved fixes from the independent review of the "Seymour Platform Foundation" report (items A2, B1, B2, B3), plus the engineer's decision on shear-friction development credit. Code basis unchanged: ACI 318-19 (IBC for stability). Check case "review": the engineer's project rebuilt from the report's input echo (B 5 × L 13 × t 2 ft; Ped 1 2.00 × 9.33 × 6.00 ft at y 1.333, 30 #6, 28 #6 separate straight dowels; Ped 2 2.67 × 2.67 × 7.00 ft at y −4.667, 16 #8, 16 #8 separate straight dowels; mats #7 @ 8 bottom, #6 @ 8 top; covers 3 / 2 in; epoxy). On main it reproduces the report: eccentricity 0.935, Ped 2 punching 58.36 psi / 0.377, φM_n,top,y 313.92, kℓ_u/r 10.0 / 8.75.

### SFEB. Middle-third (full-contact) eccentricity check is biaxial   [calculation change; CLAUDE.md §4]
- **Where:** `computeAll`, eccentricity limits. Anchor `const ECC={kern:`.
  - Before:
    ```
    const ECC={kern:{f:1/6,set:'asd',lab:'middle third, e ≤ B/6 (full contact)',ref:'kern / classical ASD'},
    ...
        dcr:cfg.f>0?Math.max(ratX,ratY)/cfg.f:0};});
    ```
  - After:
    ```
    const ECC={kern:{f:1/6,set:'asd',biax:true,lab:'middle third, 6eₓ/B + 6eᵧ/L ≤ 1 (full contact)',ref:'kern / classical ASD'},
    ...
        dcr:cfg.f>0?(cfg.biax?(ratX+ratY)/cfg.f:Math.max(ratX,ratY)/cfg.f):0};});
    ```
    and `eccChk` gets `biax:!!cfg.biax`. The AASHTO options (e ≤ B/3, B/4, 0.45B, 0.33B, 0.40B, custom) stay per axis.
  - Display: Stability 4.3a equation, table header and failbox; dashboard chip ("6eₓ/B + 6eᵧ/L = …"); warning text; the Stability input option text; Report §5.1 step `DCR` (biaxial form with values substituted) plus a note linking the service combinations.
- **Problem:** the option is labelled "full contact", but each axis was checked alone (DCR = max). A resultant inside both per-axis limits can be outside the kern diamond, so the base is in partial contact while the check reads OK. Unconservative.
- **Provision:** statics of a rigid footing on no-tension soil: full contact requires the resultant inside the kern, 6|e_x|/B + 6|e_y|/L ≤ 1 (the same index the tool's own pressure solver uses, `kern` in the base-pressure solution).
- **Check case (review):**
  - 0.6D + 0.6(−Wx): e_x = −0.703, e_y = −1.962 ft. 6·0.703/5 + 6·1.962/13 = 0.844 + 0.905 = **1.749 NG** (before max = 0.905).
  - 0.6D + 0.6(+Wx): 6·0.629/5 + 6·2.027/13 = 0.755 + 0.936 = 1.690 (before 0.936, the governing value).
  - D + 0.6(+Wx): 6·0.406/5 + 6·1.359/13 = 0.487 + 0.627 = 1.115 (before 0.627).
  - Governing: before 0.936 OK (0.6D + 0.6(+Wx)); after **1.749 NG** (0.6D + 0.6(−Wx)). §3.3 of the report shows that combination at 87.2 % contact.
  - Default project: unchanged (e_y = 0 in every combination).

### SFPJ. Two-way shear: J_c and the extreme fibre from the truncated critical section   [calculation change; CLAUDE.md §4]
- **Where:** `computePhase2`, punching, `function polarAxis`.
  - Before:
    ```
    function polarAxis(len1,len2,openA,openB,perpLen,perpOpenA,perpOpenB){
     const half=len1/2, segs=[];
     if(!openA)segs.push({x:+half,L:perpLen,own:0});
     if(!openB)segs.push({x:-half,L:perpLen,own:0});
     const ownLen1=d*Math.pow(len1,3)/12 + len1*Math.pow(d,3)/12;
     if(!perpOpenA)segs.push({x:0,L:len1,own:ownLen1});
     if(!perpOpenB)segs.push({x:0,L:len1,own:ownLen1});
     ...
     const cExt=Math.max(Math.abs(half-xbar),Math.abs(-half-xbar));
     return{Jc,cExt};
    }
    const pa_X=polarAxis(c1,c2,openXpos,openXneg,faceX,openYpos,openYneg);
    const pa_Y=polarAxis(c2,c1,openYpos,openYneg,faceY,openXpos,openXneg);
    ```
  - After:
    ```
    function polarAxis(len1,extA,extB,openA,openB,perpLen,perpOpenA,perpOpenB){
     const half=len1/2, segs=[], parLen=extA+extB, parX=(extA-extB)/2;
     if(!openA)segs.push({x:+half,L:perpLen,own:0});
     if(!openB)segs.push({x:-half,L:perpLen,own:0});
     const ownPar=d*Math.pow(parLen,3)/12 + parLen*Math.pow(d,3)/12;
     if(!perpOpenA)segs.push({x:parX,L:parLen,own:ownPar});
     if(!perpOpenB)segs.push({x:parX,L:parLen,own:ownPar});
     ...
     const cExt=Math.max(Math.abs(extA-xbar),Math.abs(-extB-xbar));
     return{Jc,cExt,xbar};
    }
    const pa_X=polarAxis(c1,bx/2+sideX1,bx/2+sideX2,openXpos,openXneg,faceX,openYpos,openYneg);
    const pa_Y=polarAxis(c2,by/2+sideY1,by/2+sideY2,openYpos,openYneg,faceY,openXpos,openXneg);
    ```
    `detail` gets `xbarX`, `xbarY`. Report §6.4 v_u step: a note with J_c,x, c_x, J_c,y, c_y and the centroid offset. Footing Design 5.4: c_x, c_y in the equation, values printed.
- **Problem:** b_0 already used the truncated faces, but J_c used full-length side faces centred on the column, and the extreme fibre was at a face beyond the footing edge. v_u understated where the perimeter is truncated. Unconservative. Interior perimeters: ext = len1/2, identical result.
- **Provision (checked in ACI 318-19):** 8.4.4.2.2 and 8.4.4.2.3 (γ_vM_sc applied at, and the stress varying linearly about, the centroid of the critical section); R8.4.4.2.3 (J_c analogous to the polar moment of inertia; similar expressions for edge and corner columns).
- **Check case (review, Ped 2, 32 × 32 in, d = 20.125 in, −y side truncated 6 in from the face):**
  - Closed face at +26.06 in (length 52.13); side faces from −22.0 to +26.06 (length 48.06, centred +2.03).
  - ȳ = (52.13·26.06 + 2·48.06·2.03)/148.25 = 10.48 in.
  - J_c,y = 20.125·52.13·15.58² + 2[20.125·48.06³/12 + 48.06·20.125³/12 + 20.125·48.06·8.45²] = 830,492 in⁴ (before 1,020,875). c_y = 10.48 + 22.0 = 32.48 in (before 34.75).
  - v_moment,y = 0.400·287.25·12000·32.48/830,492 = 53.93 psi (before 46.93). v_u = 10.78 + 0.65 + 53.93 = **65.36 psi**, DCR = 65.36/154.60 = **0.423** (before 58.36 psi, 0.378).
  - Ped 1: 1.66 → 1.76 psi, DCR 0.066 → 0.067.
  - Default project: unchanged (interior perimeters).
- **Not changed (raised):** the moment is still taken about the pedestal centroid, not the critical-section centroid (review B1, V_u·e term, R8.4.4.2.3).

### SFTD. Top mat: the inner layer uses its own depth   [calculation change; CLAUDE.md §4]
- **Where:** `computePhase2`, effective depths. Anchor `const dTopY=`.
  - Before: `const dTopY=tin-cvT-BAR_DIA[state.freinf.topY.size||8]/2;`
  - After: `const dTopY=tin-cvT-(BAR_DIA[state.freinf.topX.size||0]||0)-BAR_DIA[state.freinf.topY.size||8]/2;`
  - The top y-bars are the inner layer, under the top x-bars, as the drawings (`topY:t-cvT-d('topX')-d('topY')/2`) and the 3D view already place them. `dTopX` is unchanged. With no top x-bars, d_top,y is unchanged.
  - Display: Report §6.1 steps d_top,x and d_top,y (worked), a worked φM_n,top step in §6.2/§6.3 and a link to the depth; Footing Design 5.1 table rows.
- **Problem:** both top layers used the outer-layer depth. Unconservative for the inner layer.
- **Provision:** ACI 318-19 22.2 / 22.3 (d to the centroid of the tension steel).
- **Check case (review):** d_top,y = 24 − 2 − 0.75 − 0.375 = 20.875 in (before 21.625). a = 3.30·60/(0.85·4·60) = 0.971 in. φM_n = 0.9·3.30·60·(20.875 − 0.485)/12 = **302.79 kip-ft** (before 313.92). DCR = 184.66/302.79 = **0.610** (before 0.588). The x top layer: 816.20, unchanged. Default project: no top mat, unchanged.

### SFKS. Pedestal slenderness: k = 2.0 (free top)   [calculation change; CLAUDE.md §4]
- **Where:** `computePhase2`, pedestal design. Anchor `klu_r=`.
  - Before: `const r=0.3*bmin,klu_r=(1*h)/r,...`
  - After: `const kSl=2.0; const r=0.3*bmin,klu_r=(kSl*h)/r,...` and `kSl` returned.
  - The tool has no input for top restraint, so no input is added. The step states the assumption: fixed at the footing, free at the top (cantilever, sway), k = 2.0; conservative if the top is braced. Report §7 assumption, Pedestal Design screen block and Report §7.x step updated.
- **Provision (checked in ACI 318-19):** 6.2.5.1(a), Eq. 6.2.5.1a (columns not braced against sidesway, kℓ_u/r ≤ 22); 6.2.5.2(b) (r = 0.30 × the dimension, rectangular columns); commentary Fig. R6.2.5.1(b), sway frames: Ψ = 0 at the fixed base and ∞ at the free top gives k = 2.0.
- **Check case (review):** Ped 1: 2.0·72/(0.3·24) = **20.0** (before 10.0). Ped 2: 2.0·84/(0.3·32) = **17.5** (before 8.75). Both ≤ 22: still "slenderness neglected". Default project: 2.0·24/(0.3·18) = 8.89 (before 4.44).

### SFPD. Shear friction: proportional development credit   [calculation change; CLAUDE.md §4; all projects]
- **Engineer decision (2026-11-02):** dowels not fully developed get proportional shear-friction credit instead of zero: A_vf × min(1, available / required) on each side of the joint; the smaller side governs. It is labelled in the step as an engineering assumption (proportional development credit). Development lengths stay ACI 318-19 (no AASHTO switch).
- **Where:**
  - `sfdDowelCheck`, after `o.sfDev=...`, new:
    ```
    o.sfFrFtg=(db>0&&o.LftgReq>0)?Math.min(1,bz.availEmb/o.LftgReq):0;
    o.sfFrPed=db>0?(o.cont?1:(o.full?Math.min(1,o.hAvail/o.ld.Ld):(o.lst>0?Math.min(1,o.Lprov/o.lst):0))):0;
    o.sfFr=nD>0?(o.sfDev?1:Math.max(0,Math.min(o.sfFrFtg,o.sfFrPed))):0;
    ```
    Footing side: t − c − d_b,x − d_b,y against ℓ_dh (hooked) or ℓ_d. Pedestal side: continuous bars 1; full-height dowels (h − c)/ℓ_d; lapped dowels projection/ℓ_st (Class B).
  - `sfdShearFriction`:
    - Before: `dev=!!(dw&&dw.sfDev), Avf=dev?AvfNom:0;   // SFDA`
    - After: `dev=!!(dw&&dw.sfDev), devFr=dw?(dw.sfFr||0):0, Avf=AvfNom*devFr;` and `devFr` stored.
  - Display: Report §6.6 new step η_dev (both ratios substituted), A_vf = η_dev(A_s,dow − A_s,req,ten); the "developed on both sides" step no longer carries an NG flag (the shear-friction verdict is the DCR; full development is still checked by the dowel check). Footing Design 5.6 equation and note.
- **Problem / effect:** before, A_vf was zero unless fully developed on both sides (SFDA). More generous than SFDA, by the engineer's decision.
- **Check case (#684 item-2 case):** default project with Ped 1 3 × 3 × 1.5 ft, P_D 270 k, W_x V_x 115 k, not intentionally roughened (μ = 0.6), 8 #8 straight separate dowels (6.32 in²).
  - Footing: available 25.00 in, ℓ_d 28.46 → 0.878. Pedestal: lap does not fit, full height h − c = 16.00 against ℓ_d 28.46 → 0.562. η_dev = min(1, 0.878, 0.562) = **0.562**.
  - A_vf = 0.562·6.32 = 3.55 in². N_u = min(0.9·272.03, P_u) = 244.82 k. V_n = 0.6(3.55·60 + 244.82) = 274.80 k (V_n,max = 800·1296/1000 = 1036.8). φV_n = 206.10 k.
  - DCR = 115/206.10 = **0.558 OK** (before A_vf = 0, V_n = 0.6·244.82 = 146.89, φV_n = 110.17, **DCR 1.044 NG**).
  - With 12 #5 dowels (developed): η = 1, unchanged (0.546).
- **Review case:** Ped 1 η = 19.25/25.61 = 0.752, A_vf = 0.752·12.32 = 9.26 in², DCR 0.223 → 0.018. Ped 2 η = 19.25/42.69 = 0.451, A_vf = 0.451·9.10 = 4.10 in², governing DCR **2.142 NG (0.9D + 1.0(−Wx)) → 0.080 OK** (1.2D + 1.0(+Wx) + L + 0.5S).
- **Default project:** dowels developed, unchanged.
- **Saved data:** no input, key or format change. Every saved project with undeveloped dowels gets the new credit on open; no migration (engineer: a result change for all projects, called out).

### How verified (all five items)
- Headless Chromium, origin/main vs the branch, the tool's pinned KaTeX 0.16.11, Plotly 2.35.2 and three 0.160.0 routed from npm copies (as in SFPB). Deep diff of every `R` and `P2` value on: default, review, the #684 item-2 case with 8 #8 and with 12 #5, direct mode.
  - Default and direct: only `klu_r` and new fields (`biax`, `kSl`, `xbar*`, `sfFr*`, `devFr`) and the eccentricity label differ.
  - Review: only `eccChk`, the eccentricity warning, `dTopY` / `desY` top capacity, `punch` J_c / c / v_u / DCR, `klu_r`, `shearFr` A_vf and its rows, and new fields.
  - Item-2 cases: only `punch` Ped 1 (its perimeter is truncated at the −x edge), `klu_r`, `shearFr` (8 #8 case) and new fields.
- Report on all cases: 0 KaTeX errors, no NaN / undefined / unresolved `§?` or literal `[[`. 0 console errors.
- `node tests/check-syntax.mjs` passes, as does `tests/smoke/spread-footing-scroll.mjs --libs`.
- **Other copies:** none.
- **Open items (questions for the engineer):**
  1. The dowel check (§6.7) still requires full tension development where shear friction relies on the dowels (`sfNeed`), so with proportional credit a joint can pass shear friction while the dowel check reads NG on development. Keep that, or relax it to match SFPD?
  2. Punching: the transferred moment is still taken about the pedestal centroid, not the critical-section centroid (R8.4.4.2.3; review B1, about 10 % of M_ux on Ped 2).
  3. Top mat order: y-bars inner, as the drawings and 3D view. If the field order is the reverse, d_top,x would take the reduction instead.

### SFCI. Citations checked against ACI 318-19 and the IBC references   [citations only; no result change]
- **Engineer request (2026-11-02):** ACI 318-19, the 2018 IBC and the IBC 2018 → 2021 structural changes summary are now in the reference folder. Verify every ACI article this PR touches or cites, the review's "verify" item, and ACI's own rule for developing shear-friction steel.
- **Shear-friction development:** ACI 318-19 22.9.5.1 requires reinforcement crossing the shear plane to be anchored to develop f_y on both sides (R22.9.5.1: by bond, a mechanical device, or threaded dowels). The tool cited AASHTO LRFD 10th Ed. 5.7.4.1 (SFDA, #684) because ACI was not available. Changed to ACI 318-19 22.9.5.1 in: Report §6.6 "developed on both sides" step; Report §6.7 "shear friction relies on the dowels" step; Footing Design 5.6 note and the "relies on the dowels" note; the `sfdDowelCheck` / `sfdShearFriction` comments (the comment keeps AASHTO 5.7.4.1 as "the same rule").
  - Note: SFPD (proportional credit) is an engineering assumption beyond 22.9.5.1, which asks for full development of f_y. The step is labelled so.
- **IBC combinations:** "IBC 2021 §1605.3" is 2018 IBC numbering (2018 §1605.3 = ASD combinations). In the 2021 IBC, §1605.1 sends the design to the ASCE 7 §2.3 (strength) and §2.4 (ASD) combinations, and §1605.2 holds the alternative ASD combinations (IBC 2018 → 2021 structural changes summary, item 1605.1). Changed to §1605.1 in: the Load Combinations service note, Report §3.2 table note, Report references, the Help references.
- **Checked, unchanged:** 6.2.5.1(a), 6.2.5.2(b), Fig. R6.2.5.1; 8.4.4.2.2, 8.4.4.2.3, R8.4.4.2.3; 22.9.4.2 (Table 22.9.4.2), 22.9.4.4 (Table 22.9.4.4), 22.9.4.5, 22.9.4.6.
- **Not changed (raised):** "IBC 2021 1610 overburden" (effective soil cover step and references): IBC 1610 is soil lateral loads (2021: soil lateral and uplift loads), not the weight of soil cover. A dead-load article would fit better, but the full 2021 IBC is not available to confirm its number.


## 2026-11-02 — PR: claude/sf-dowel-review-punch-centroid — Dowel development REVIEW where it serves shear friction only; punching moment about the critical-section centroid; soil-cover citation; top-mat order confirmed (SFDR, SFPC, SFCJ; calculation change) (PR #716: https://github.com/mlococo88/All-Structural/pull/716)

Engineer's answers (2026-11-02) to the questions of PR #710.

### SFDR. Dowel development: NG only where interface tension needs it   [pass / fail logic; CLAUDE.md §4]
- **Engineer:** the dowel development check is NG only where tension needs the development (A_s,req > 0, interface tension). Where the dowels serve shear friction only, the shortfall is REVIEW (proportional credit, SFPD) and the shear-friction D/C decides.
- **Where:** `sfdDowelCheck`, before `return o`.
  - Before: `o.ok=o.asOK&&o.tenOK&&o.ftgOK&&o.projOK;`
  - After:
    ```
    const LreqPF=o.cont?0:Math.max(o.lc,o.tension?o.lst:0);
    o.ftgOKpf=o.tension?o.ftgOK:true;
    o.projOKpf=o.cont?true:(projIn!==null?(projIn>=LreqPF-1e-9&&projIn<=o.hAvail+1e-9):(LreqPF<=o.hAvail+1e-9?true:(o.tension?o.ld.Ld:o.Ldc)<=o.hAvail+1e-9));
    o.sfReview=!!(o.sfNeed&&!o.tension&&(!o.ftgOK||!o.projOK));
    o.ok=o.asOK&&o.tenOK&&o.ftgOKpf&&o.projOKpf;
    o.status=!o.ok?'fail':(o.sfReview?'review':'pass');
    ```
    `o.ftgOK` / `o.projOK` (development as detailed, with the tension lap where `devTen`) are unchanged and still drive the displayed lengths and the shear-friction credit. The compression lap / ℓ_dc and an entered projection beyond h − c still fail.
  - Display: dashboard / summary chip "Dowels (tension, laps)": REVIEW (`warn`) with "shear-friction development short (proportional credit η) — shear-friction D/C decides". Report §6.7: the footing-side step carries a pass / fail flag only with interface tension (else a REVIEW note linking the credit step); the projection step's flag is `projOKpf`, with a REVIEW note. Footing Design 5.6 (2c), (3): "REVIEW (shear friction only: proportional credit)" in place of NG. Drawings: "(REVIEW)" in place of "(NG)" on the footing embedment note when there is no interface tension.
- **Check cases:**
  - #684 case with 9 #8 straight separate dowels and h = 2.5 ft (no interface tension; φμN_u alone does not carry V_u): footing ℓ_d 28.46 > 25.00 in; pedestal lap does not fit, full height ℓ_d 28.46 > h − c = 28.00 in; compression ℓ_dc 18.97 ≤ 28.00 OK; A_s 7.11 ≥ 0.005A_g 6.48 OK. η = min(25.00/28.46, 28.00/28.46) = 0.878; shear friction DCR 0.412 OK. Badge: **FAIL → REVIEW** ("Ped 1: shear-friction development short (REVIEW: proportional credit 0.88) — shear-friction D/C decides").
  - Review case: **FAIL, unchanged.** Both pedestals have interface tension (A_s,req = 0.003 in² at Ped 1, 3.54 in² at Ped 2), so their tension development (ℓ_d 25.61 and 42.69 > 19.25 in) stays NG; Ped 1 also has A_s,dow 12.32 < 0.005A_g 13.44.
  - Default project: no change (dowels developed).

### SFPC. Punching: transferred moment about the critical-section centroid   [calculation change; CLAUDE.md §4]
- **Where:** `computePhase2`, punching, after `const JcY=pa_Y.Jc, cExtY=pa_Y.cExt;`.
  - Before: `const MuY=Math.abs(pl.myPed), MuX=Math.abs(pl.mxPed);`
  - After:
    ```
    const xcG=p.x+(pa_X.xbar||0)/12, ycG=p.y+(pa_Y.xbar||0)/12, xAG=(cx0+cx1)/2, yAG=(cy0+cy1)/2, Nnet=pl.P-relief+bodyIn;
    const MscX=pl.mxPed+pl.P*(p.y-ycG)-(pl.P-Nnet)*(yAG-ycG), MscY=pl.myPed+pl.P*(p.x-xcG)-(pl.P-Nnet)*(xAG-xcG);
    const MuY=Math.abs(MscY), MuX=Math.abs(MscX);
    ```
    Free body of the region inside the critical section, moments about its centroid (x_c, y_c): the pedestal moment, P_u at the pedestal centre, and the soil relief less the body forces (P_u − N) at the centroid of the clipped critical area. Interior perimeter: y_c = y_A = y_ped, unchanged. `detail` gets `MxPed, MyPed, Pu, Nnet, dyc, dxc, dyA, dxA`. The γ_f flexural-transfer check (`gfChk`) uses the same M_sc.
  - Display: Report §6.4 steps "Moments at the pedestal base" and "Moment transferred about the critical-section centroid" (worked). Footing Design 5.4 note.
- **Provision (ACI 318-19, checked):** 8.4.4.2.2 (γ_vM_sc applied at the centroid of the critical section), 8.4.4.2.3, R8.4.4.2.3.
- **Check case (review, governing combinations unchanged):**
  - Ped 2 (1.2D + 1.0(+Wx) + L + 0.5S): M_x,ped 287.25, P_u 43.81, N 32.16 kip, y_c = +0.8734 ft, y_A = +0.1693 ft. M_sc = 287.25 − 43.81·0.8734 − (43.81 − 32.16)(0.1693 − 0.8734) = 287.25 − 38.26 + 8.20 = **257.19 kip-ft**. v_m = 0.400·257.19·12000·32.48/830,492 = 48.28 psi. v_u = 10.78 + 0.65 + 48.28 = **59.71 psi**, DCR = 59.71/154.60 = **0.386** (before 65.36 psi, 0.423).
  - Ped 1 (1.2D + 1.0(−Wx) + L + 0.5S): M_x,ped 38.39, P_u 84.15, N 26.21, y_c = −0.9534 ft, y_A = −0.1693 ft. M_sc = 38.39 + 84.15·0.9534 − 57.94·0.7841 = 38.39 + 80.23 − 45.43 = **73.19 kip-ft**. v_m = 0.536·73.19·12000·73.44/10,324,278 = 3.35 psi. v_u = 4.34 + 1.32 + 3.35 = **9.00 psi**, DCR **0.0815** (before 7.41 psi, 0.0671).
  - #684 case (Ped 1 truncated at −x): DCR 0.457 → 0.475 (governing combination changes to 1.2D + 1.6L + 0.5S).
  - Default project: unchanged (interior perimeters).

### SFCJ. Citation: weight of the soil cover → IBC dead loads §1606   [citation only]
- "IBC 2021 1610 overburden" (Load Combinations, effective soil cover step) and "§1610 (overburden, as cited)" (Report references) → IBC 2021 §1606 (dead loads: weight of the soil cover). Checked: 2018 IBC Section 1606 is Dead Loads; the 2018 → 2021 changes summary keeps 1606 (1606.2 design dead load, 1606.3 fixed service equipment, new 1606.4).

### Top mat order (SFTD, PR #710)
- Confirmed by the engineer (2026-11-02): the top y-bars are the inner layer. No change.

### How verified
- Headless Chromium, origin/main vs the branch, pinned libraries (as in #710). Deep diff of `R` and `P2` on default, review, the #684 cases (8 #8, 12 #5, 9 #8 with h 2.5 ft) and direct mode: only `P2.punch` (truncated perimeters only), `P2.dowels[].ok` (9 #8 case) and new fields differ. Default and direct mode: new fields only.
- Report on all cases: 0 KaTeX errors, no NaN / undefined / `§?` / literal `[[`. 0 console errors. `node tests/check-syntax.mjs` passes, as does the scroll smoke test.
- **Other copies:** none. **Saved data:** no change.

## 2026-11-03 — PR: claude/sf-missing-checks — Missing checks and the NG summary: footing-bar development (straight, hooked, excess-reinforcement option), top-mat development, pedestal crossties and shear, dowel count, grouped punching statement, flotation statement, NG / REVIEW list and named badges (SFDV, SFVP, SFXT, SFDN, SFPG, SFFL, SFNG; new checks, pass / fail logic) (PR #723: https://github.com/mlococo88/All-Structural/pull/723)

Engineer-approved PR 3 of the independent review of the "Seymour Platform Foundation" report (items C1–C9, E4). Code basis ACI 318-19 (articles below read in the ACI 318-19 PDF). Check case "review": the engineer's project rebuilt from the report's input echo (as in #710). No existing computed value changes: a deep diff of `R` and `P2` (origin/main vs the branch) on default, review, the three #684 cases and direct mode shows only new fields.

### SFDV. Footing mats: development worked, straight and hooked; excess-reinforcement option   [new check; CLAUDE.md §4]
- **Where:** new `sfdDevAll()` (after `sfdDevData`), called in `recalc` after `computePhase2` (`P2.dev`). Report: footing x / y subsections, the topic "Development of the bottom bars" is rebuilt from `P2.dev` and a "Development of the top bars" topic is added where the top mat is a flexural mat. Footing Design 5.4 rebuilt from `P2.dev`. Dashboard chip "Footing bar development" (new). Input `mat.ldExcess` (Materials, "ℓ_d reduction for excess A_s"), `'off'` default; `migrateState` sets `'off'` for saves without it.
  - Before (Report step `ldok`): `label:dd.dv.Ld<=dd.avail?'Straight bars develop':'Hooks required', … ok:dd.dv.Ld<=dd.avail` — straight ℓ_d only, no ℓ_dh, no dashboard item, top mat not checked.
  - After: per mat (bottom x / y; top x / y where M_u⁻ > 0.01 and a top mat is entered):
    - ℓ_d = `devLength(size,f′c,f_y,top,{λ, cover (bottom: sfdCbCover(); top: coverTop), s, coating})` (25.4.2.4, Table 25.4.2.5; top bars ψ_t = 1.3);
    - ℓ_avail = 12(B/2 or L/2 − |section|) − c_end (governing sagging section for the bottom mat, as before; governing hogging section for the top mat);
    - option on: ℓ_d,red = max(ℓ_d,raw · A_s,req/A_s,prov, 12) (25.4.10.1, 25.4.2.1(b)); A_s,req per ft = `des.reqBot` (flexure, not less than A_s,min) / top: max(A_s,req, A_s,min);
    - where straight does not develop: ℓ_dh = max(f_y ψ_e ψ_r ψ_o ψ_c /(55 λ √f′c) · d_b^1.5, 8d_b, 6) (25.4.3.1, Table 25.4.3.2): ψ_e 1.2 epoxy / 1.0; ψ_r = 1.0 where c-c spacing s ≥ 6d_b (No. 11 and smaller), else 1.6 (A_th not considered); ψ_o = 1.0 where the side cover of the outermost bar ≥ 6d_b, else 1.25; ψ_c = f′c/15000 + 0.6 below 6000 psi. No excess reduction for hooks (25.4.10.2(d)).
    - Status: straight (reduced if on) ≤ ℓ_avail PASS; else ℓ_dh ≤ ℓ_avail REVIEW ("hook the bars"); else FAIL.
- **Provisions read (ACI 318-19):** 25.4.2.4 / Table 25.4.2.5; 25.4.3.1 and Table 25.4.3.2 (ψ_r = 1.0 for s ≥ 6d_b; ψ_o = 1.0 for side cover normal to the plane of the hook ≥ 6d_b); 25.4.10.1 (applies to 25.4.2.1(a), 25.4.6.1(a), 25.4.7.1(a), 25.4.9.1(a) — not 25.4.3.1); 25.4.10.2(d) (not for hooked bars); R25.4.10.2 (not for development of shrinkage and temperature reinforcement).
- **Check case (review):**
  - Bottom x #7 at 8 in, epoxy, cover 3 in: ψ_tψ_e = 1.2 (cover 3.0 ≥ 3d_b, clear 7.13 ≥ 6d_b), (c_b + K_tr)/d_b → 2.5. ℓ_d = 0.075·60000/63.25·1.2·1.0·1.0/2.5·0.875 = **29.88 in**; ℓ_avail = 12(2.500 − 1.000) − 3.00 = **15.00 in** → NG.
  - Hooked: ψ_e 1.2, ψ_r 1.0 (s 8.00 ≥ 6d_b = 5.25), ψ_o 1.25 (side cover 3.00 < 5.25), ψ_c = 4000/15000 + 0.6 = 0.867. ℓ_dh = 60000·1.2·1.0·1.25·0.867/(55·63.25)·0.875^1.5 = 22.42·0.8185 = **18.35 in > 15.00 → FAIL**. (Review: 23.5 in with ψ_r 1.6, ψ_o 1.0; interior bars, ψ_o 1.0: 14.68 in.)
  - Option on: ℓ_d,red = 29.88·0.518/0.900 = **17.21 in > 15.00** NG; hooks not reduced (25.4.10.2(d)) → still FAIL. (The review's 13.5 in OK applied the factor to the hook, which 25.4.10.2(d) does not permit.)
  - Top y #6 at 8 in (hogging at y = −3.333 ft, 184.66 kip-ft): ψ_t 1.3 · ψ_e 1.5 (cover 2.0 < 3d_b = 2.25) → 1.7; ψ_s 0.8; conf 2.5. ℓ_d = 0.075·948.7·1.7·0.8/2.5·0.75 = **29.03 in ≤ 35.00** OK (review 29.0 ≤ 35.0).
  - Top x #6 (M_u⁻,x = 0.88 kip-ft at x = 1.0 ft): ℓ_d 29.03 > 15.00; ℓ_dh = 14.56 ≤ 15.00 → REVIEW (hook the bars).
  - Default project: bottom x #8 ℓ_d 28.46 > 12.00 in (before: report step "Hooks required" NG, no dashboard item); ℓ_dh = 18.69 > 12.00 → FAIL chip (new).

### SFVP. Pedestal one-way shear   [new check; CLAUDE.md §4]
- **Where:** new `sfdPedShear(i,p,pd,combos,fc,fy,lam)` (before `computePhase2`), `P2.pedShear`. Report: pedestal topic "Shear (governing …)". Pedestal Design: an equation block. Dashboard chip "Pedestal shear".
- **Method:** each direction on its own section: V_ux on b_w = b_y, d = b_x − d′ (A_s = the n_y bars on the far face); V_uy on b_w = b_x, d = b_y − d′. Table 22.5.5.1: A_v (2 legs of the perimeter tie) ≥ A_v,min = max(0.75√f′c, 50) b_w s/f_yt (10.6.2.2) → row (a) 2λ√f′c; else row (c) 8λ_sλρ_w^1/3√f′c; + N_u/(6A_g) with net tension only (compression not counted); V_c ≥ 0, ≤ 5λ√f′c b_w d; φ = 0.75; V_s not counted. Biaxial: both ratios > 0.5 → (r_x + r_y)/1.5 ≤ 1 (22.5.1.10, 22.5.1.11). 10.6.2.1: V_u > 0.5φV_c with A_v < A_v,min → NG.
- **Check case (review):** Ped 2, 1.2D + 1.0(+Wx) + L + 0.5S, V_uy = 15.95 kip: #3 ties at 12 in, A_v = 0.22 < A_v,min = max(47.4, 50)·32·12/60000 = 0.320 → row (c). ρ_w = 3.95/(32·29.5) = 0.00418, λ_s = √(2/(1 + 2.95)) = 0.712: V_c = 8·0.712·0.161·63.25·32·29.5/1000 = 54.8 kip, φV_c = **41.08 kip**, ratio **0.388** (V_u < 0.5φV_c, A_v,min not required). (Review: 89.6 kip with row (a), not available here since A_v < A_v,min.) Ped 1: V_ux = 8.00, φV_c = 99.77 → **0.080**.

### SFXT. Pedestal crossties, ACI 318-19 25.7.2.3   [new check]
- **Where:** new `sfdCrossties(pd)`, `P2.xties`. Report topic "Lateral support of the vertical bars (crossties)"; Pedestal Design block; chip "Pedestal crossties" (REVIEW where crossties are needed: the tool takes no crosstie input).
- **Rule (25.7.2.3 (a), (b), read):** per face with n bars at clear spacing s: s ≤ 6 in: ⌊(n − 2)/2⌋ interior bars need support; s > 6 in: n − 2. Crossties per tie set = n_req on the b_x faces + n_req on the b_y faces.
- **Check case (review):** Ped 1: b_x faces 3 bars at 8.88 in → 1; b_y faces 14 #6 at 7.50 in → 12; **13 crossties** (REVIEW). Ped 2: 5 #8 at 5.75 in → 1 + 1 = **2** (REVIEW). Default: 3 bars per face at 5.50 in clear → 0, PASS.

### SFDN. Dowel count against the vertical bars   [pass / fail logic; CLAUDE.md §4]
- **Where:** `sfdDowelCheck`, before `return o`. Before: `o.status=!o.ok?'fail':(o.sfReview?'review':'pass');` After: `o.countDiff=!o.cont&&nD>0&&nD!==nPos; o.status=!o.ok?'fail':((o.sfReview||o.countDiff)?'review':'pass');`. Report step `p<i>.cnt`; chip text.
- **Check case:** review Ped 1, 28 dowels vs 30 bars → REVIEW (status stays FAIL there for A_s,dow < 0.005A_g and the tension development). Not flagged where the dowels are the longitudinal bars (`dowelLong`).

### SFPG. Touching / close pedestals: the grouped section stated   [statement only]
- `P2.punchGroup` (after `punchWarn`) and `sfdPunchGroupTxt()`: the group's bounding rectangle, edge clearances against d/2; open on both ends of one axis → no closed two-way section, the group acts in one-way shear across the other axis (the existing one-way check). No grouped punching stress is computed. Review: y ends 6.00 in < 10.06 in → open; "one-way shear in x; that section falls outside the footing: not critical". Chip status unchanged (REVIEW).

### SFFL. Flotation statement   [display]
- Report Stability: topic "Flotation" with "No water table at or above the base … not applicable" when `R.flot` is null; checked (FS_fl) when a water table above the base gives buoyancy (unchanged).

### SFNG. NG / REVIEW list and named badges   [display]
- Report Summary: new first subsection "Items that fail (NG) or need review (REVIEW)" (key `S-ng`), from the dashboard chips (NG first), each with what fails and the link; "Assumptions and warnings" links to it.
- `sfrTopics`: the topic badge names the failing check ("NG: dowel area, dowel tension development into the footing") instead of a passing ratio with NG appended ("0.345 NG"); REVIEW steps (`rev`) show "REVIEW: …" in amber. `sfrS` keeps the step's `chk` (short name) and `rev`.

### How verified
- Headless Chromium, origin/main vs the branch, pinned KaTeX 0.16.11 / Plotly 2.35.2 / three 0.160.0. Deep diff of `R` and `P2`: default, review, review with the option on, #684 cases (8 #8, 12 #5, 9 #8 h 2.5 ft), direct mode: only new fields (`dev`, `pedShear`, `xties`, `punchGroup`, `dowels[].countDiff`). Report: 0 KaTeX errors, no NaN / undefined / `§?` / literal `[[`; 0 console errors.
- `node tests/check-syntax.mjs` passes; `tests/smoke/spread-footing-scroll.mjs --libs <pinned libs>` passes. The results harness over all 10 saved cases (default, review case and 8 others) with auto on: `R`, `P2` and the full Report text (with its figure captions) identical to origin/main after #732.
- **Saved data:** new input `mat.ldExcess` ('off' | 'on'); saves without it read as 'off' (the reduction not taken, as before). No key or format change.
- **Other copies:** none.
- **Open items (questions):**
  1. Hook factors: Table 25.4.3.2 gives ψ_r = 1.0 at s ≥ 6d_b and ψ_o = 1.25 for the outermost bar (side cover 3 in < 6d_b). The dowel hook (`sfdLdh`, SFDO) still uses ψ_r 1.6, ψ_o 1.0. Align the dowels with the table?
  2. 25.4.10.1 with A_s,req governed by A_s,min (0.0018): R25.4.10.2 says the factor does not apply to development of shrinkage and temperature reinforcement. Keep A_s,req = max(flexure, A_s,min), or use the flexural requirement only, or disallow the option where A_s,min governs?
  3. Dowels: 25.4.10.1 is not applied to the dowels (22.9.5.1 asks for development of f_y where they serve shear friction, 25.4.10.2(b)). Confirm.

## 2026-11-03 — PR: claude/sf-presentation — Report presentation and code basis: relations, substitutions (ΣM_a, M_r / M_o, J_c and c, V_u, laps), rigidity ℓ, elevation figure, printed tables, φ in the inputs, combined-footing citations (13.3.4, 8.6.1.1, 8.7.2.2), references the run uses (SFPR; display and citations only, no result change) (PR #725: https://github.com/mlococo88/All-Structural/pull/725)

Engineer-approved PR 4 of the independent review of the "Seymour Platform Foundation" report (section E and items D1, D3). **No computed value changes**: a deep diff of `R` and `P2` (origin/main vs the branch) on default, review, review with the ℓ_d option on, the three #684 cases and direct mode shows only new display fields (`r.maT`, `punch[].detail.paX/paY`). The old print report (`renderPrintHeader`, `SFD_REFS`, `sfdResultRows`) is not touched.

### SFPR. Items
- **E1, stray "=" before a relation:** `sfrS` (the report's step helper). A step with a symbol and an `eq` starting with ≤ / ≥ / < / > is rewritten for display: before `A_s,prov = ≥ A_s,min = 0.900 ≥ 0.518 = 0.900 in²/ft`; after `A_s,prov ≥ A_s,min = 0.900 ≥ 0.518 in²/ft`. This covers A_s,min, s ≤ s_max (footing and ties), √(A₂/A₁) ≤ 2, A_s,dow ≥ 0.005A_g and ℓ_dc.
- **E2, substitutions:**
  - **ΣM_a,x and ΣM_a,y itemised.** New step `res/MaX` / `MaY`. `resultant()` records its terms in `maT`; this is display only, and the sums MaX / MaY are unchanged. Review case: ΣM_a,x = 31.50 + 0.75·35.20 + 0.45·120.20 + (0.50 + 0.75·0.50 + 0.45·15.10)·9.000 = 111.99 + 69.03 = **181.02** kip-ft. ΣM_a,y = **36.84** kip-ft (2.10 + 34.74).
  - **M_r and M_o substituted** from the edge rows (`ot.rows`, `ot.appRow`). The formula now states that the applied moments and couples enter once, as a net value, on the side they act (as the code does). Review case: M_r = 11.70·6.500 + 4.24·6.712 + 10.08·7.833 + 4.48·1.833 + 21.86·8.433 + 9.00·1.833 = **392.49**. M_o = 6.66·1.833 + 132.06 = **144.27**. FS = 2.72.
  - **Punching V_u** now shows P_u. Before: `− 76.03 + 18.09 = 26.21`; after: `84.15 − 76.03 + 18.09 = 26.21`.
  - **J_c and c worked** (new steps `pu<i>.JcX/JcY`, `pu<i>.cX/cY`). `polarAxis` returns its faces (`segs`, `extA`, `extB`). Review case, Ped 2 y: J_c,y = 20.125·52.13·15.58² + 218,844 + 2·20.125·48.06·(−8.45)² + 218,844 = **830,492 in⁴**; c_y = max(|26.06 − 10.48|, |22.00 + 10.48|) = **32.48 in**.
  - **Dowel ℓ_sc and L_proj** get their expressions, e.g. L_proj = max(ℓ_sc, ℓ_st) = max(22.50, 33.30) = 33.30 in.
  - **Eccentricity DCR (per-axis options)** now substituted as max(|e_x|/(fB), |e_y|/(fL)).
  - **Rigidity:** new step ℓ_x, with ℓ defined as the larger of the cantilever beyond the outermost pedestal centre and half the distance between adjacent pedestal centres (`maxSeg`). Review: ℓ_y = 5.167 ft.
- **E5, dowel note:** "Worked on the Footing Design tab, 5.6" → "Also shown on the Footing Design tab, in its card 5.6 'Concrete Bearing & Dowels' (screen numbering; in this report the dowels are this section and shear friction is [[S-sf]])".
- **E6, print:**
  - `sectSVG`:
    - the caption is on two lines above the drawing, and the SVG is at least 470 px wide, so the caption is no longer clipped;
    - pedestals in line with each other in the elevation have their labels stacked instead of overprinted;
    - P and V_x labels name the pedestal and the loads they show ("Ped 1: P (D + L) = 54.58 k", "V_x (D + Wx)").
  - Print CSS (tool only):
    - `#rp-print .rp-tw{overflow:visible}`: no scroll bar printed beside a table that breaks across pages;
    - the last step of a topic does not go to a new page alone.
  - The §5.7 table's M_ux column gets its unit.
- **E7:** the inputs table now shows the friction angle φ in direct-bearing mode (it feeds tan(2/3 φ) and K_p).
- **D1, code basis (ACI 318-19, read):**
  - 13.3.4.1: combined footings are designed under Chapter 8; 13.3.4.4 points mats to 8.6.1.1; 13.3.2.1 covers one-way combined footings under Chapters 7 and 9.
  - 8.6.1.1: A_s,min = 0.0018A_g.
  - 8.7.2.2: s_max = lesser of 2h and 18 in at critical sections, 3h and 18 in elsewhere.
  - For a footing with two or more bearing elements (`sfrCombined()`), the Report cites:
    - minimum steel: 13.3.4.1, 8.6.1.1, 24.4.3.2;
    - bar spacing: 13.3.4.1, 8.7.2.2, 25.2.1, with the s_max step min(2h, 18) shown where 2h ≥ 18 in (the same value as the tool's min(3h, 18));
    - the band note: 13.3.3.3 is an isolated-footing rule, shown for information;
    - the Codes row in the inputs.
  - Single footing: unchanged citations (7.6.1.1, 7.7.2.3 with 13.3.3.1).
- **D3, references:** the Report lists only what the run uses (`sfrRefs()`):
  - Vesić and Meyerhof only with the computed bearing;
  - AASHTO only for the items in use (10.6.3.1.2a with Vesić; the eccentricity articles when an AASHTO limit is selected; 10.6.3.4 when passive resistance is credited).
  - Review case (direct q_a, middle third, no passive): Vesić, Meyerhof and AASHTO are dropped.

### How verified
- **Deep diff:** headless Chromium, pinned libraries. Origin/main vs the branch on 7 cases: no existing value differs (new display fields only).
- **Report:** 0 KaTeX errors; no NaN, undefined, `§?` or `[[`; 0 console errors.
- **Printed PDF of the review case** (`page.pdf` after `beforeprint`): the elevation caption is whole and the labels are stacked; the shear-friction table breaks across pages without a scroll bar.
- `node tests/check-syntax.mjs` passes; `tests/smoke/spread-footing-scroll.mjs --libs <pinned libs>` passes. The results harness over all 10 saved cases (default, review case and 8 others) with auto on: `R`, `P2` and the full Report text (with its figure captions) identical to origin/main after #732.
- **Other copies:** none. **Saved data:** no change.

### Open items
1. `shared/report.js` keeps `.rp-tw{overflow-x:auto}` in print, so other tools may print the same scroll bar. Fixed here in the tool's own CSS only (one tool per PR).
2. **8.7.2.2 vs the tool's s_max.** For a combined footing, 8.7.2.2 gives min(2h, 18 in) at critical sections, but the tool computes min(3h, 18 in). The two are equal for h ≥ 9 in (every footing with d ≥ 6 in per 13.3.1.2). Below 9 in the report says to check by hand. Changing the formula would be a result change and was not made.
3. **Not in this PR's list:**
   - the plan view's resultant marker over the "Ped 1" label;
   - the free-body expression for the footing M_u;
   - numbers in the pedestal M_ux, M_uy formula steps.

## 2026-11-03 — PR: claude/sf-dowel-psi-spacing — Dowel hook factors per Table 25.4.3.2; excess-reinforcement option only where flexure governs A_s,req; dowels get no 25.4.10.1 reduction (stated); s_max = min(2h, 18 in) per 8.7.2.2 (SFDH, SFEX, SFDX, SFSM; calculation change) (PR #727: https://github.com/mlococo88/All-Structural/pull/727)

These are the engineer's decisions on the open items of #723 (questions 1–3) and #725 (item 2). The code basis is ACI 318-19, read in the ACI 318-19 PDF: Table 25.4.3.2 (printed p. 475), 25.4.10.1, 25.4.10.2, R25.4.10.2 (p. 487–488), 8.7.2.2 (p. 114), and 13.3.3.1 (p. 197). Check cases are in the harness: "review" (the engineer's project, as in #710), "revEx" (review with the ℓ_d option on), the three #684 cases, default, direct mode, and three extra cases. "revHook" is review with every dowel hooked. "edgeHook" is the default with Ped 2 at x = 4.25 ft, flush with the footing edge. "thin" is the default with t = 8 in and bottom x-bars at 17 in.

### SFDH. Dowel hook ℓ_dh, ψ_r and ψ_o per Table 25.4.3.2   [CLAUDE.md §4]
- **Where:** `sfdLdh` (anchor `function sfdLdh(`), called in `sfdDowelCheck` (anchor `o.ldh=sfdLdh(`). New helper `sfdDowHookTxt(z)`. Report step `p<i>.Lftg` (note and ref); Footing Design 5.6 (2c) note.
  - Before: `function sfdLdh(db,fy,lam,fc,coating){ … pr=1.6, po=1.0 …}` and `o.ldh=sfdLdh(db,fy,lam,fc,coat);`
  - After: `function sfdLdh(db,fy,lam,fc,coating,size,sMin,cso){ … sm=size<=11, pr=(sm&&sMin>=6*db-1e-9)?1.0:1.6, po=(sm&&cso>=6*db-1e-9)?1.0:1.25 …}`. In `sfdDowelCheck`:
    - `o.sDow` is the minimum centre-to-centre spacing of the dowels. Where there is one dowel per vertical-bar position, it is the smaller face spacing, min((b_x − 2d′)/(n_x − 1), (b_y − 2d′)/(n_y − 1)), with d′ = c + d_b/2. Where the dowel count differs, the dowels are spread evenly around the perimeter: 2((b_x − 2d′) + (b_y − 2d′))/n.
    - `o.cso = 12·min(B/2 − |x| − b_x/2, L/2 − |y| − b_y/2) + c` is the clear plan distance from the outermost dowel to the nearest footing side face. It is used as the side cover normal to the plane of the hook.
    - ψ_o condition (1) (hook ending inside a column core) does not apply, because the hook ends in the footing. A_th is not considered, as for the footing bars (SFDV).
- **Effect:** ℓ_dh is multiplied by 1/1.6 where s ≥ 6d_b, and by 1.25 where side cover < 6d_b. It changes results only where the dowels are hooked (`dowelHook` 'hook90'), through `LftgReq`, footing-side development, and the shear-friction development credit. With straight dowels, ℓ_dh is computed but not used.
- **Check case, default (and dir / sfe / sfe5 / sfe9 Ped 2): #8 hooked, 8 dowels in an 18 in pedestal, c = 2 in, f′c = 4000, uncoated.**
  - s = (18 − 2·2.5)/2 = **6.50 ≥ 6.00** → ψ_r = 1.0.
  - Side cover = 12·min(5 − 3 − 0.75, 4 − 0.75) + 2 = **17.0 ≥ 6.0** → ψ_o = 1.0.
  - ψ_c = 4000/15000 + 0.6 = 0.867.
  - ℓ_dh = 60000·1.0·ψ_r·1.0·0.867/(55·63.25)·1.0^1.5. Before (ψ_r 1.6): **23.92 in**. After: **14.95 in**.
  - Available is 25.00 in, so PASS before and after. Default: devTen false. dir: shear-friction credit already 1.0.
- **Review (straight dowels): no result change.** ℓ_dh, for information:
  - Ped 1, 28 #6 epoxy: s = 253/28 = 9.04 ≥ 4.50; side cover 6 + 2 = 8.00 ≥ 4.50. ℓ_dh goes from **18.64 to 11.65 in**.
  - Ped 2, 16 #8 epoxy: s = (32 − 5)/4 = 6.75 ≥ 6.00; side cover 6 + 2 = 8.00 ≥ 6.00. ℓ_dh goes from **28.70 to 17.94 in**.
- **revHook (review, dowels hooked):** Ped 2 ℓ_dh goes from 28.70 to **17.94 in ≤ 19.25 in available**.
  - The dowel status changes from FAIL to **PASS**.
  - Shear friction: development credit 0.671 → 1.0, A_vf 6.10 → 9.10 in², φV_n 289.73 → 424.55 kip, DCR 0.0551 → 0.0376.
  - Ped 1: ℓ_dh 18.64 → 11.65 in, which passes both before and after.
- **edgeHook (ψ_o = 1.25):** Ped 2 is flush with the edge, so side cover = 0 + 2 = 2.00 < 6.00 and ψ_o = 1.25. ℓ_dh = 23.92·1.25/1.6 = **18.69 in** (before 23.92).

### SFEX. Excess-reinforcement option (25.4.10.1) only where flexure governs A_s,req   [CLAUDE.md §4]
- **Where:** `computePhase2` design (anchor `const reqBotFlex=`): new field `des.reqBotFlex`, the flexural A_s per ft alone. `sfdDevAll` (anchor `const AsFlex=`). Report step `ldx`; Footing Design 5.4 equation block and note; input hint; dashboard chip basis.
  - Before: `rEx=AsProv>0?Math.min(1,AsReq/AsProv):1`, with A_s,req = max(flexure, A_s,min).
  - After: `flexGov=AsFlex>=des.AsMinPerFt-1e-12` (bottom: `des.reqBotFlex`; top: `des.reqTop`) and `rEx=(flexGov&&AsProv>0)?Math.min(1,AsReq/AsProv):1`. Where A_s,min = 0.0018A_g governs, no reduction is taken, and a step / note cites R25.4.10.2 (the factor does not apply to development of shrinkage and temperature reinforcement).
- **Provision:** ACI 318-19 25.4.10.1; R25.4.10.2. The option stays off by default.
- **Check case revEx (#7 epoxy at 8 in bottom, #6 at 8 in top, A_s,min = 0.0018·12·24 = 0.518 in²/ft):**
  - Bottom x: flexure 0.037 < 0.518, so A_s,min governs. ℓ_d,red goes from 29.88·0.518/0.900 = **17.21 to 29.88 in** (not taken). Status FAIL in both, because ℓ_dh 18.35 > 15.00.
  - Bottom y: flexure 0.599 ≥ 0.518, so flexure governs. ℓ_d,red = 29.88·0.5985/0.900 = **19.87 in**, unchanged. PASS.
  - Top x: flexure 0.0007 < 0.518. ℓ_d,red goes from **22.80 to 29.03 in**. REVIEW (hook) in both: ℓ_dh 14.56 ≤ 15.00.
  - Top y: flexure 0.399 < 0.518. ℓ_d,red goes from **22.80 to 29.03 in** ≤ 35.00, still PASS; D/C 0.651 → 0.829.
- With the option off (every other case), `rEx` / `LdEx` change in the stored rows only. `LdUse` and the status are unchanged.

### SFDX. Dowels: no 25.4.10.1 reduction   [statement; no change]
- The dowels were already developed without the excess-reinforcement factor. This is now stated in the report step `p<i>.Lftg` note and the Footing Design 5.6 (2c) note. The dowels serve shear friction and are developed for f_y on both sides of the joint (22.9.5.1), so 25.4.10.2(b) excludes the reduction. The laps are also excluded (25.5.1.4).

### SFSM. Maximum bar spacing s_max = min(2h, 18 in), ACI 318-19 8.7.2.2   [CLAUDE.md §4]
- **Where:** `computePhase2` design (anchor `const sMax=Math.min(`).
  - Before: `const sMax=Math.min(3*tin,18);` (7.7.2.3).
  - After: `const sMax=Math.min(2*tin,18);`, from 8.7.2.2 at critical sections. Footings reach Chapter 8 through 13.3.3.1 (two-way isolated footings: Chapters 7 and 8) and 13.3.4.1 (combined footings). The rule is applied to the whole mat.
  - Text updated: report step `smax` (one form for all footings; the #725 "check by hand" branch is removed), the Bar-spacing topic ref, Footing Design 5.2 / 5.3 notes, the Reinforcement tab hint, the dashboard chip basis, and `sfrRefs()` for a single footing.
  - `SFD_REFS` (the old print report's list) is not touched.
- **Effect:** results change only for h < 9 in (2h < 18).
- **Check case "thin" (default with t = 8 in, bottom x-bars #8 at 17 in):**
  - Before: s_max = min(3·8, 18) = **18 in**, 17 ≤ 18 OK.
  - After: s_max = min(2·8, 18) = **16 in**, 17 > 16 **NG**. The y-bars at 9 in pass both before and after.
  - In this case the hooked dowels also move (SFDH): ℓ_dh 23.92 → 14.95 in; shear-friction credit 0.125 → 0.201; Ped 1 DCR 0.0683 → 0.0577.
  - Every case with h ≥ 9 in is unchanged (18 in).

### How verified
- **Deep diff:** headless Chromium with the pinned libraries (KaTeX 0.16.11, Plotly 2.35.2, three 0.160.0). `R` and `P2` were compared on origin/main and on the branch, for default, review, revEx, sfe, sfe5, sfe9, dir, thin, revHook and edgeHook.
  - Changed values: only the ones listed above (ℓ_dh and what follows from it for hooked dowels; `rEx`, `LdEx`, `LdUse`, `dc` where A_s,min governs; `sMax`, `spcBotOK` for thin).
  - New fields: `reqBotFlex`, `AsFlex`, `flexGov`, `AsMin`, `sDow`, `edgeX`, `edgeY`, `cso`, `ldh.sMin`, `ldh.cso`.
  - No other value moved.
- **Report:** 0 KaTeX errors; no NaN, undefined, `§?` or `[[`; 0 console errors.
- `node tests/check-syntax.mjs` passes; `tests/smoke/spread-footing-scroll.mjs --libs <pinned libs>` passes. The results harness over all 10 saved cases (default, review case and 8 others) with auto on: `R`, `P2` and the full Report text (with its figure captions) identical to origin/main after #732.
- **Saved data:** no key or format change; no new input.
- **Other copies:** none.

### Open items
1. The old print report (`SFD_REFS`) still lists "§7.7.2.3 / §13.3.4 (bar spacing)". It is left for the agent porting that report.
2. For dowels, the side cover normal to the plane of the hook is taken as the smallest plan distance to a footing side (the hook direction is not an input). A hook turned away from a near edge could use the larger cover.

## 2026-11-03 — PR: claude/report-retire-spreadfooting, PR #732: https://github.com/mlococo88/All-Structural/pull/732 (SFRX: the D11 print report (Print-to-PDF Report / Ctrl+P printing the page in place: `renderPrintHeader`, `sfdPageCSS`) retired after porting what the Report tab lacked; Print-to-PDF Report, Ctrl+P and the browser's Print print the Report from every tab; the manual's "Include this manual" choice kept as an Include box; SFD_REFS bar-spacing citation; display only, no result change)

### SFRX-1. What the print report printed and the Report lacked, ported   [display] [no result change]
- **Engineer request (2026-11-03):** retire each tool's old print report by porting it in full into the Report tab (method of #715, #718, #722, #724, #726, #728, #729, #731).
- **Compared:** the print report on origin/main (Schematic tab shown, `beforeprint`, print media: the whole body's text plus the KaTeX annotations) against the Report (`#rp-print`, print media) on the branch, with KaTeX and without it. A number counts as present when the Report shows it, or more digits that round to it. Cases (scratch `cases.json`): def (the default project, two pedestals), rev (combined footing B 5 × L 13 × 2 ft, direct qa, epoxy bars, two pedestals with wind loads), sfe (Ped 1 3 × 3 × 1.5 ft, P_D = 270, V_Wx = 115, smooth joint, straight #8 dowels); def again with "Include this manual" ticked.
- **Missing before:** 78 / 203 / 102 of 505 / 965 / 590 distinct numbers (def / rev / sfe): the result tabs as on screen (tables the Report does not repeat, worked equation blocks of the cards, notes, the Plotly charts and SVG drawings), the dashboard chips, the self-consistency checks, the result line of each dashboard check after each tab (D/C, reference, status), the cover's verdict banner and tool line, the front note, and (when ticked) the User Manual.
- **Ported (anchor `SFRX (2026-11-03): the D11 print report retired`, after the Report's `beforeprint` handler):**
  - `sfxWalk(root, scope, T)`: reads a rendered tab (a clone) in order. A KaTeX formula becomes its TeX (`sfxLite`, the built-in renderer's subset). A card title or heading is the topic of its first item. Every worked equation line (`.eq`: title, reference, lines) is added unless the Report already works the line; a line the walk added under another title (the same check for the y-bars) is repeated under its own title. With KaTeX a step equation, without KaTeX its TeX source. A table is added when it has a number or a row of text the Report lacks; a note when it has a sentence or a number the Report lacks; a figure when the Report has none with that caption (Plotly charts as one SVG, `sfxPlotSvg`). A "Worked in" line reads as on screen ("<value> → <tab> · <card>"); the Reinforcement input echo link as printed ("Bars (Reinforcement input): …"). Inputs become static text; buttons and screen-only parts are dropped.
  - `sfxResults(tab)`: the result lines printed after each tab (`sfdResultRows`, unchanged: same D/C, reference, value and status), a table in subsection "Results — <section>".
  - `sfxApply(model)` (called by `renderReport`): each tab's items in a subsection "As printed: tables, equations, notes and figures" of its Report section (`SFX_TABS`: dashboard → Summary of results, Schematic → Project and inputs, Load Combinations, Bearing, Stability, Footing Design, Pedestal Design); the User Manual (Include box on), one subsection per part in `MANUAL_ORDER`, before References; "About this report" in References (tool line, verdict, the front note with the units line).
- **Include box** on the report bar (`sfxControls` / `sfxWire`): "User manual", written to the same saved field `state.manPrint` as the Manual tab's "Include this manual when printing the report" box (kept, and kept in step), with `saveAuto()`. No new key or format, no migration.
- **After:** in all cases, with and without KaTeX, every number of the print report is in the Report except: the references the Report leaves out by design since SFPR (#725, "references used": AASHTO 11.6.3.3 when no AASHTO eccentricity limit is selected; Vesić 1973/1975, Meyerhof 1953 and AASHTO 10.6.3.1.2a with direct bearing in rev) and one print section number (5.5). Report: 0 unresolved references, 0 duplicate keys. Text not repeated: the print report's contents, section numbers and "see §n.k" labels (the Report has its own contents and § links), the bearing tab's combination list printed from its select (the Report names the governing combination), the Manual tab's footer about the checkbox.

### SFRX-2. Print report removed; Print prints the Report from every tab   [display]
- **Removed:** `renderPrintHeader()` (and its call in `recalc`), `sfdPageCSS()`, `sfdSecNum()`, `#printHeader`, the D11 `@media print` rules (cover, references, contents, result lines) and the manual's print rules, the page's `beforeprint` / `afterprint` handlers that opened every card, and the manual's own `beforeprint` / `afterprint` handlers.
- **Kept:** `SFD_REFS`, `sfdResultRows`, `sfdEsc`, the `.wkPrt` / `.wkScr` spans (screen text unchanged), the Manual tab's checkbox.
- **Changed:**
  - "Print-to-PDF Report" (tooltip updated) → `sfxPrintAny()`: shows the Report tab (not saved) and prints it (`SFRP.api.print()`).
  - An inline `beforeprint` script before `shared/report.js` calls `window.sfPrintPrep` (Ctrl+P / the browser's Print from another tab), so the shared viewer's own `beforeprint` handler finds the Report.
  - `afterprint` brings the tab of before back.
  - With input errors (no results) there is no Report; Print prints the page as shown.
- **Saved data:** no key or format change (`sfd_auto`, `sfd_projects`, `bridgeSuite.v1.*`).

### SFRX-3. SFD_REFS bar-spacing citation   [CLAUDE.md §4: code reference; no value change]
- **Where:** `SFD_REFS`, ACI 318-19 row (anchor `(bar spacing)`), and `sfrRefs()`.
  - Before: `SFD_REFS` cited "§7.7.2.3 / §13.3.4 (bar spacing)"; `sfrRefs()` replaced it with "§8.7.2.2 with §13.3.3.1 (bar spacing)" for an isolated footing (SFSM, #727) and rebuilt the combined-footing row.
  - After: `SFD_REFS` cites "§8.7.2.2 with §13.3.3.1 (bar spacing)"; the isolated-footing replacement is removed (no longer needed); the combined-footing replacement anchors on the new text. The Report's references read exactly as before for both footing types.
- **Provision:** ACI 318-19 8.7.2.2 (s_max = min(2h, 18 in) at critical sections), reached through 13.3.3.1 (isolated two-way footings) and 13.3.4.1 (combined footings). This is the rule the tool computes since #727 (SFSM); the old list's 7.7.2.3 (min(3h, 18 in)) is not used.
- **Check case (default, h = 24 in):** s_max = min(2·24, 18) = 18.00 in; bottom x-bars #8 @ 9.00 in ≤ 18.00 in OK, before and after. No value changes; only the citation the old list printed.

### How verified
- `node tests/check-syntax.mjs "Spread Footing.html"`: pass.
- origin/main vs branch, def / rev / sfe, with KaTeX: `R` and `P2` (JSON) identical; the text of every tab (Schematic, Load Combinations, Bearing, Stability, Footing Design, Pedestal Design, Drawings, Manual, inputs) and the dashboard identical; localStorage identical on load, after visiting every tab, and after showing and printing the Report; no console errors.
- Print routing from each of the 10 tabs, by `beforeprint` and by the button (20 paths per case): `#rp-print` holds the Report, `body.rp-printing` and the running header are set, the tab of before comes back, localStorage unchanged.
- Include box: on/off writes only `state.manPrint` (the rest of `sfd_auto` unchanged), adds / removes the User manual section, keeps the Manual tab's box in step; 0 unresolved references either way. One Report build: about 100 ms (def).
- Screenshots at 1400 and 390 px (no sideways scroll) and the printed PDF (def with the manual, 73 pages) looked at.
- `node tests/smoke/spread-footing-scroll.mjs --libs …`: PASS. `node tests/smoke/project-library.mjs --tool spreadfooting`: ALL PASS.
- Line endings unchanged (LF).
- **Other copies:** none.

## 2026-11-03 — PR: claude/report-print-overflow (PR #733: https://github.com/mlococo88/All-Structural/pull/733) — printed Report: the local table scroll-box rule (SFPR) removed; shared/report.js now does it for every tool (RPTW; display only)

- **Where:** the `<style>` block in the head, anchor `/* SFPR (2026-11-03; review E6)`.
- **Before:**
  ```css
  /* SFPR (2026-11-03; review E6): printed Report: a table's scroll box is not printed as a scroll bar, and the last step of a topic
     does not go to a page alone */
  @media print{#rp-print .rp-tw{overflow:visible !important;max-height:none !important} #rp-print .rp-steps>.rp-step:last-child,#rp-print .rp-step:has(+ .rp-top){break-before:avoid}}
  ```
- **After:**
  ```css
  /* SFPR (2026-11-03; review E6): printed Report: the last step of a topic does not go to a page alone (the table scroll-box rule
     moved to shared/report.js, RPTW) */
  @media print{#rp-print .rp-steps>.rp-step:last-child,#rp-print .rp-step:has(+ .rp-top){break-before:avoid}}
  ```
- **Why redundant:** `shared/report.js` now prints `.rp-tw{overflow:visible;}` (fixlog/shared-report.md, RPTW). No `.rp-tw` in this tool has a `max-height`. The local rule made wide tables run past the page edge, so Chromium shrank the whole printed report to about 89 %. The shared fix scales only those tables: the resultant table (0.875) and the pedestal table (0.913) on the default project.
- **Check case:** default project, Report → Print report: before 54 pages at about 89 % scale; after 63 pages at full size, every table inside the page. The same with Ctrl+P.
- No calculation, saved-data or storage change. The second rule (last step of a topic) is unchanged.

## 2026-11-03 — PR: claude/sf-autocalc (PR #734: https://github.com/mlococo88/All-Structural/pull/734) — "Auto-calculate on change" switch, Re-analyze (Ctrl+Enter), out-of-date marking; plots in hidden output tabs drawn when shown (SFAC; display and workflow only, no result change)

### SFAC. Auto-calculate on change   [no result change]
- **Problem:** every input edit re-ran the whole analysis and re-render (after the 300 ms typing debounce). Several small edits in a row (e.g. bar sizes and spacings) were slow.
- **Where:** header (anchor `id="sfdAcChk"`, before `id="btnPrint"`); output panel banner (anchor `id="sfdAcBar"`, before `<h2 … id="sfdRptSum">`); CSS after `.tabpage.active{display:block}` (anchor `#sfdAcBar{`); `recalc()` and `recalcDebounced()` and the new block after it (anchor `const SFAC={key:'sfd_autoCalc_v1'`).
  - `recalc()`: before `R=computeAll();` added `clearTimeout(rcTimer);sfdSetStale(false);`.
  - `recalcDebounced()`, before: `clearTimeout(rcTimer);rcTimer=setTimeout(recalc,300);` After: `clearTimeout(rcTimer);if(!SFAC.on){sfdSetStale(true);return;}rcTimer=setTimeout(recalc,300);`
  - Input edits that called `recalc()` directly now call `sfdAnalyzeReq()` (`recalc()` when on; otherwise mark out of date): pedestal Delete (`state.peds.splice(i,1);buildPedCards();`), Add pedestal (`btnAddPed`), Undo / Redo (`undoApply`), and the two hand-off "Apply" buttons (Steel Beam reactions, foundation loads).
  - Load, Import JSON, Reset, "Saved projects…" Open and the page load still always analyze.
- **Behaviour:** checkbox "Auto-calculate on change" (default on = the old behaviour). Off: an edit is still autosaved (`sfd_auto`) and goes on the undo stack; the analysis does not run; `body.sfdStale` is set. That shows the banner "Results out of date — press Re-analyze", enables the header Re-analyze button, and dims / dashes the dashboard chips, warnings, self-consistency checks, every output tab except the User Manual (Schematic … Report, 3D View, Drawings), a ⚠ on those tab buttons, and the Reinforcement-tab A_s / s_max / pedestal bar notes. Re-analyze, Ctrl+Enter (any time) and turning the box back on run `recalc()`.
- **Print / export while out of date: re-analyze first.** A capture `beforeprint` listener runs `recalc()` before the other print listeners (the `<head>` `sfPrintPrep` listener of #732 and SFRP), so Ctrl+P and the browser's Print print the Report of the new results. A click on the header Print-to-PDF Report runs `recalc()` first and then goes on. "Print report" (Report tab) and "Download DXF" (Drawings tab) are intercepted, re-analyzed, and the click is replayed on the rebuilt button. Export JSON exports inputs only and is unchanged. The tool sends no results hand-off (only the title block, `projectMeta`), so nothing there is marked.
- **Saved data:** new per-browser UI key `sfd_autoCalc_v1` (`'0'` = off, `'1'` = on, absent = on), named like `sfd_inputTab_v1` / `sfd_dwgSheet_v1`. It is not in the project, the autosave or the export. No existing key or format changed.

### SFAC-P. Plots in hidden output tabs are drawn when their tab or the Report is shown   [display only]
- **Where:** before `function renderPlots(){` (anchor `const SFPLT={all:false,skip:false};`, `function sfpOn(id)`, `function sfpDrawHidden()`); inside `renderPlots` the five plot guards; in `renderReport()` one line after the `if(!R||R.fatal){…}` line.
  - Before: `if($('#plot-dcr'))`, `if($('#plot-heat')&&R.govBear…`, `if($('#plot-fs'))`, `const elid='plot-vm-'+dir;if(!$('#'+elid))return;`, `const elid='plot-pm-'+i;if(!$('#'+elid))return;`
  - After: the same with `sfpOn('plot-dcr')`, `sfpOn('plot-heat')`, `sfpOn('plot-fs')`, `if(!sfpOn(elid))return;` (twice), and `SFPLT.skip=false;` at the top of `renderPlots`.
  - `renderReport()`: added `sfpDrawHidden();` before `let M;`. Since #732 the Report copies every result tab's Plotly charts (`sfxWalk` → `sfxPlotSvg`), so any skipped plot is drawn (`SFPLT.all`) before the Report reads the tabs; the Report and its printout keep every figure.
- **Why:** profiling a single bar-spacing edit (headless Chromium, default project) showed Plotly redrawing every plot in every tab, more than half of `recalc()` on a result tab. The tab click already calls `renderPlots()`, so a plot is drawn when its tab is opened.
- **Timings** (bottom-x bar spacing edited through its input, time inside `recalc()` per edit, mean of 4 edits, two runs, headless Chromium, default project; origin/main → this branch): Schematic tab 431 / 488 → 247 / 200 ms (`renderPlots` 258 / 280 → 0.1 ms); Footing Design tab, whose own two plots are still drawn, 601 → 392 ms (second run; first run noisy, 1159 → 753 ms); Report tab about the same (931 → 905 ms), because the Report needs every plot. With the Report tab open, turning Auto-calculate off is what saves the time. The rest of `recalc()` (`computeAll` about 1 ms, `computePhase2` about 40 ms, the HTML renders) is unchanged.

### How verified
- `R`, `P2`, dashboard text and the report text (SharedReport.text) compared with origin/main on the default project and the review case (`rev`): harness run with auto on → 0 differences. With auto off, the same edits made through the inputs (bottom-x spacing 10, bottom-y #6, top-x spacing 9, Ped 1 tie spacing 10), then Ctrl+Enter, compared with main making the same edits → 0 differences, identical report and dashboard text, on both cases.
- Behaviour (headless, 21 checks on each case): out of date after edits with no analysis run; autosave and undo stored; banner and Re-analyze shown; Ctrl+Enter, the button, turning the box on, `beforeprint`, Download DXF, the Report's Print report and the header Print-to-PDF Report (from the Bearing tab) each re-analyze; Undo while off does not analyze; the preference survives a reload and the page analyzes on load. 0 console errors.
- `node tests/check-syntax.mjs` passes; `tests/smoke/spread-footing-scroll.mjs --libs <pinned libs>` passes. The results harness over all 10 saved cases (default, review case and 8 others) with auto on: `R`, `P2` and the full Report text (with its figure captions) identical to origin/main after #732.
- **Other copies:** none.

### Open items
- None.

## 2026-11-03 — PR: claude/sf-dashboard-column (PR #737: https://github.com/mlococo88/All-Structural/pull/737) — Summary dashboard: compact one-line chips, collapsible; a left column on screens 1500 px and wider (SFDC; display only, no result change)

### SFDC. Dashboard as a third panel on the left   [display only]
- **Problem (engineer):** the summary dashboard (26 check chips, 3–5 lines each) filled the top of the output panel: about 500 px tall at 1366 px wide and 440 px at 1920, 1570 px on a phone. At 1920 px and wider the page (max-width 1600 px) left blank space on both sides.
- **Where:**
  - Markup: `<aside id="sfdDashCol" …>` added as the first child of `<div class="main">`. In the output panel, the `<h2 … id="sfdRptSum">Summary Dashboard</h2>` and `<div class="dash" id="dashboard">` are wrapped in `<div id="sfdDashBox">` with a header `<div id="sfdDashHead">` holding the collapse button `#sfdDashTgl`, the same h2 and the NG / REVIEW count `#sfdDashCnt`.
  - `recalc()`: before `renderDashboard();renderWarnings();renderConsistency();` after `renderDashboard();sfdDashDecorate();renderWarnings();renderConsistency();   /* SFDC */`.
  - New block before `function renderWarnings(){` (anchor `const SFDC={key:'sfd_dashCollapsed_v1'`): `sfdDashDecorate()`, `sfdDashPlace()`, `sfdDashColl()` and a start-up IIFE.
  - CSS before `/* ---- user manual ---- */` (anchor `/* SFDC (2026-11-03): compact dashboard`), all under `@media screen`.
- **Behaviour:**
  - Each chip is one line: expand button ▸, check name (cut with … if long), a short value, status. The short value is the D/C of the Report summary (`sfdResultRows()`, the same number as the Report's "Summary of results" D/C column; for an FS check D/C = FS_target/FS), or `FS n` from the chip text where there is no D/C (overturning not gated), or nothing (e.g. Contact area, Input validation). Hover (title) shows the name, the full chip text (with the governing combination) and the reference; ▸ expands the chip to show them. NG and REVIEW chips start expanded so the reason is on screen. The expand state is kept by check name for the session (not saved).
  - A chip click still jumps to its worked section (§6); the ▸ button does not navigate.
  - Header: "2 NG" / "1 REVIEW" / "no NG" count. The #734 out-of-date styling (dimmed chips) is unchanged and also dims the count.
  - ≥ 1500 px wide: `sfdDashPlace()` (on load and on a `matchMedia('screen and (min-width:1500px)')` change) moves `#sfdDashBox` into the 280 px left column `#sfdDashCol`, which has the panel height and scrolls on its own (`overflow-y:auto`), so it stays put while the outputs scroll; `.wrap` max-width 1600 → 1892 px (1600 + 280 + 12 gap), and `.inp` width 33 % of the width left after the column, so at 1892 px and wider the input and output panels are exactly as wide as before. The collapse button (« / ») shrinks the column to a 42 px strip with the title written vertically and the NG / REVIEW count.
  - < 1500 px: the box stays on top of the output panel (after the out-of-date banner); chips in a grid of one-line chips (`minmax(min(250px,100%),1fr)`), "▾ Hide checks" / "▸ Show checks" button. Default project: 186–250 px tall at 1366 (was 504), about 600 px at 390 (was 1569).
- **Saved data:** new per-browser UI key `sfd_dashCollapsed_v1` (`'1'` = collapsed, `'0'` = open, absent = open), named like `sfd_inputTab_v1` / `sfd_autoCalc_v1`. Not in the project, the autosave or the export. No existing key or format changed.
- **Report and printing:** unchanged. The chips keep `.cn` / `.cv` / `.cs`, their classes and `data-tab` / `data-sec`; the Report (`sfdResultRows`, the dashboard walk `sfxWalk` → `dash`) reads only those, by class. Printing prints `#rp-print` only (shared/report.js), and the new CSS is screen-only.
- **Tests:** `tests/smoke/phone-layout.mjs` gets a Spread Footing entry (`sf`: input tabs, output tabs and the Hide / Show checks button at 390 and 768 px). `tests/smoke/spread-footing-scroll.mjs` checks that the dashboard is in the left column at 1920 px and on top below 1500 px, and that chip clicks show the chip's section in the output panel and leave the page scroll at 0.

### How verified
- Main vs this branch, 10 saved cases (default, review case and 8 others), headless Chromium with the pinned KaTeX / Plotly / three.js, at 1920 and 1366 px: `R`, `P2`, the chip text / status / links, the Report's result rows (`sfdResultRows`), the full Report text, warnings, self-consistency, every output tab's text and every localStorage key and value (apart from the new key) identical; 0 console errors. (Before the max-width was set to 1892 px, Plotly picked other axis ticks on the Pedestal Design P–M plot at 1920 px because the output panel was 5 px wider; that is why the panel widths are kept exact.)
- Screenshots at 1366, 1600, 1920, 2560 and 390 px, before and after, and collapsed, looked at.
- `node tests/check-syntax.mjs` passes; `tests/smoke/spread-footing-scroll.mjs --libs <pinned libs>` PASS; `tests/smoke/phone-layout.mjs --tool sf` passes at 390 and 768 px.
- **Other copies:** none.

### Open items
- The User Manual (§0 "the summary dashboard at the top of the report", §3.1) still describes the dashboard as at the top; left as is so the tab text stays identical. A wording update can follow if the engineer wants it.

## 2026-11-03 — PR: claude/sf-plotly-guard (PR #738: https://github.com/mlococo88/All-Structural/pull/738) — Report renders when Plotly is not loaded; each chart shows a note instead (SFPN; display only, no result change)

### SFPN. "Plotly is not defined" left the Report empty   [display only]
- **Problem (regression of #734, SFAC-P):** with Plotly not loaded (offline from `file://`, CDN blocked), `renderReport()` calls `sfpDrawHidden()` → `renderPlots()` before it builds the Report, and the first `Plotly.newPlot` threw "Plotly is not defined": the Report tab stayed empty, and so did the printout (`#rp-print`). Before #734 the same throw happened in `recalc()` whenever a chart was on the open tab (it skipped the rest of `recalc()`: the open Report / Drawings tab refresh and the input-tab notes) and on every tab click (after the tab was shown).
- **Where:** after `function sfpDrawHidden(){…}` (anchor `const SFP_NA='chart unavailable (Plotly not loaded)';`); inside `renderPlots()` the six calls; in `sfxWalk()` (`const visit=e=>{`) one line before `if(e.matches('.js-plotly-plot')){const s=sfxPlotSvg(e);`.
  - Added:
    ```js
    const SFP_NA='chart unavailable (Plotly not loaded)';
    function sfpPlot(id,data,layout,cfg){
     if(typeof Plotly==='undefined'||!Plotly.newPlot){const e=document.getElementById(id);
      if(e){e.classList.add('sfp-na');e.style.height='auto';e.innerHTML='<p class="note">Chart unavailable (Plotly not loaded): the values are in the tables.</p>';}return;}
     return Plotly.newPlot(id,data,layout,cfg);}
    ```
  - `renderPlots()`: before `Plotly.newPlot('plot-dcr',` / `('plot-heat',` / `('plot-fs',` / `(elid,traces,` / `(elid,[],{font,title:{text:'P-M contour unavailable'` / `(elid,[` (P-M); after: the same arguments with `sfpPlot(` (these are every Plotly call in the tool).
  - `sfxWalk()` `visit`, added:
    ```js
    if(e.matches('.sfp-na')){nfig++;const cap=(card||'Chart')+(nfig>1?' ('+nfig+')':''),key=sfxNrm(cap);if(!T.figs.has(key)){T.figs.add(key);push({type:'note',text:cap+': '+SFP_NA+'.'});}return;}   /* SFPN */
    ```
- **Behaviour:** with Plotly loaded nothing changes (`sfpPlot` is `Plotly.newPlot`). Without it, each chart box (on its tab) shows "Chart unavailable (Plotly not loaded): the values are in the tables." and the Report has, where the figure would be, a note "<card title, as the figure caption>: chart unavailable (Plotly not loaded)." The paths that draw charts (page load / `recalc()`, a tab click, `renderReport()`'s `sfpDrawHidden`, the print path: `beforeprint` → `recalc()` / `sfPrintPrep` → Report, the LRFD combination selector) all go through `renderPlots()`, so none throws.
- **Check case:** default project, Plotly blocked (KaTeX and three loaded): before, Report tab empty, no printout built, 9 × "pageerror: Plotly is not defined" (load, tab clicks, Report). After, Report tab and printout render (print text 134 k characters with KaTeX blocked as well); the print text differs from the Plotly-loaded one only where the 7 charts were: Bearing DCR by combination, base pressure heat map, stability FS, x and y shear/moment diagrams, Ped 1 and Ped 2 P-M diagrams, each replaced by its note. `R` identical. No page errors.
- **How verified:** headless Chromium (tests/lib.mjs, libraries from tests/libs): origin/main vs branch with Plotly loaded: `R`, the Report tab text on opening, after visiting every tab, and the printout (`beforeprint` from the dashboard) identical; every chart drawn by Plotly. With Plotly blocked as in the check case. `node tests/check-syntax.mjs` passes; `node tests/smoke/spread-footing-scroll.mjs` passes with tests/libs only (no `--libs`).
- **Other copies:** none.

### Open items
- None.
## 2026-11-03 — PR: claude/sfdc-fail-condition (PR #740: https://github.com/mlococo88/All-Structural/pull/740) — Dashboard chip short value: the failing condition where the D/C is not what fails; User Manual wording on where the dashboard is (SFDF; display only, no result change)

### SFDF. A chip that fails for a reason other than its ratio showed a passing D/C next to FAIL   [display only]
- **Problem (engineer):** since #737 (SFDC) each chip's short value is the D/C from `sfdResultRows()`. A chip that is NG or REVIEW for another reason then read e.g. "Flexure (footing) D/C 0.30 FAIL" (default project: it fails because A_s < A_s,min, top x). Engineer's decision: the short value shows the failing condition; the D/C shows when the chip is expanded. Where the ratio itself is what fails or passes, the D/C stays.
- **Where:**
  - `sfdDashDecorate()`, after `else{const m=/FS = ([\d.]+)/.exec(val);if(m)short='FS '+m[1];}` added:
    ```js
    let dcLine='';
    if((st==='fail'||st==='warn')&&!(r&&r.dc!=null&&r.dc>1+1e-9)){let cnd=[];try{cnd=sfdChCond(name);}catch(e){cnd=[];}
     if(cnd.length){if(short)dcLine=short;short=cnd.join('; ');}}
    ```
    and before `if(r&&r.ref){const rf=el('div','sfdChRef noprint');`:
    ```js
    if(dcLine)c.insertBefore(el('div','sfdChDC noprint',sfdEsc(dcLine)+' (the ratio is within its limit; the status comes from the condition)'),null);
    ```
    The chip title (hover) gets the same D/C line: `c.title=name+': '+val+(dcLine?'\n'+dcLine:'')+…`.
  - New `function sfdChCond(name)` before `function sfdDashPlace(){` (anchor `/* SFDF (2026-11-03, engineer): the failing condition`). It reads the same flags `renderDashboard()` sets each chip's status and text from; no new calculation.
  - CSS (screen block of SFDC): `.chip .sfdChDC` added to the hidden-until-expanded rules (`.chip .cv,.chip .sfdChRef,.chip .sfdChDC{…display:none…}`, `.chip.sfdOpen … .chip.sfdOpen .sfdChDC{display:block}`), and `.chip .sfdChDC{color:#444;font-size:10.5px}`.
- **Chips whose status can disagree with their D/C, and the condition shown** (only when the chip is NG / REVIEW and its D/C is ≤ 1 or n/a):

| Chip | Status set by (renderDashboard) | Short text |
|---|---|---|
| Overturning | resultant off the footing / no contact in a combination (`anyUnstable`) | resultant off footing |
| Flexure (footing) | `asMinBotOK` / `asMinTopOK`; `spcBotOK` / `spcTopOK`; top steel needed, none provided (REVIEW; dropped from the text when A_s,min fails, as the chip text) | A_s < A_s,min; s > s_max; top steel required |
| Punching shear | overlapping perimeters (`P2.punchWarn`, REVIEW) | perimeters overlap |
| Pedestal design | `rhoOK`, `nBarsOK`, `barFitOK`, `tieOK` / `tieSizeOK` (D/C is the axial ratio) | ρ outside 1–8%; <4 bars; bars do not fit; ties |
| Dowels (tension, laps) | `asOK`/`tenOK`, `ftgOKpf`, `projOKpf` (NG); `sfReview`, `countDiff` (REVIEW) | A_s,gov > A_s,prov; ℓ_dh (hooked) or ℓ_d > avail; projection short / pedestal development short; shear-friction dev. short; dowels ≠ bars |
| Pedestal P–M (biaxial) | no P–M ratio computed (REVIEW, D/C 0) | not computed |
| Footing bar development | straight ℓ_d > available, hook works (REVIEW; D/C is ℓ_dh/available) | straight ℓ_d > avail |
| Pedestal shear | `avFail` (A_v < A_v,min where V_u > 0.5φV_c) | A_v < A_v,min |
| Footing bar clear spacing | `clrBotOK` / `clrTopOK` (D/C can be ≤ 0 when s ≤ d_b) | s_clr < min |

  The other chips' status follows their D/C (bearing, eccentricity, sliding, flotation, rigidity, one-way shear, concrete bearing, dowel minimum, ℓ_dc, interface shear friction, cover, tie cover) or they have no D/C (contact area, input validation, crossties, overturning not gated): unchanged.
- **Check case:** default project, 1920 px. Before: "Flexure (footing) D/C 0.30 FAIL". After: "Flexure (footing) A_s < A_s,min FAIL"; expanded: "DCR 0.30 OK, but A_s < A_s,min (top x)", "D/C 0.30 (the ratio is within its limit; …)", the reference. "Footing bar development D/C 1.56 FAIL" unchanged (the ratio fails). Review case (`rev`): "Punching shear perimeters overlap REVIEW" (D/C 0.39 when expanded). Default with ties at 30 in: "Pedestal design ties FAIL" (D/C 0.42). Default with #11 at 20 in bottom x: "A_s < A_s,min; s > s_max".
- **Report:** unchanged. It reads the chips by class (`.cn` / `.cv` / `.cs`) and `sfdResultRows()`, which are not changed.

### Manual wording: where the dashboard is
- §1.1 Layout: "The summary dashboard at the top of the report shows …" → it is a left column on screens 1500 px and wider, at the top of the output panel above the tabs on narrower screens. Same paragraph: the self-consistency panel is "at the top of the output panel (under the dashboard on screens narrower than 1500 px)" (was "under the dashboard").
- §3.1 Summary dashboard: the first sentence ("Each shows the governing value, its threshold, and the governing combination.") replaced by a paragraph on the one-line chip, the placement (1500 px breakpoint), collapse, the short value (D/C, or the failing condition as above) and the expand button; the PASS/FAIL/REVIEW/N/A sentence is unchanged, now its own paragraph.

### How verified
- origin/main vs branch, 12 cases (default, review case, 8 saved cases and 2 more: `asmin`, `ped`), headless Chromium, libraries from tests/libs: `R`, `P2` and the full Report text identical, 0 console errors.
- The short value, status and expanded D/C of every NG / REVIEW chip listed for those cases; `sfdChCond` for each chip with its flags forced in the page (A_v, straight ℓ_d, ρ / bars, P–M, unstable, dowel embedment / projection, clear spacing).
- `node tests/check-syntax.mjs`; `tests/smoke/spread-footing-scroll.mjs`; `tests/smoke/phone-layout.mjs --tool sf`; screenshot at 1920 px looked at.
- **Other copies:** none.

### Open items
- The Report's result rows ("Checks (as on the dashboard)" and each section's "Results — …" table) print the same D/C next to FAIL / REVIEW (e.g. Flexure 0.30 FAIL). Their Result column carries the full chip text, which names the reason ("DCR 0.30 OK, but A_s < A_s,min"). Left unchanged; asked of the engineer.
- §0.1 says the self-consistency checks "appear at the top of the report"; still true of the output panel, left as is. The "at the top of the report" wording about the dashboard was in §1.1, not §0.

## 2026-11-03 — PR: claude/sfdf-report-cond (PR #741: https://github.com/mlococo88/All-Structural/pull/741) — Report result rows: the failing condition in the D/C column where the ratio is not what fails (SFDF-R; display only, no result change)

### SFDF-R. Report rows printed a passing D/C next to FAIL / REVIEW   [display only]
- **Problem:** the open item of SFDF (#740). The Report's "Checks (as on the dashboard)" table and each section's "Results — …" table printed e.g. "Flexure (footing) | 0.30 | FAIL" on the default project, which fails on A_s < A_s,min. Engineer's decision: show the condition, as on the dashboard.
- **Where:**
  - New `function sfdRowCond(x)` before `function sfdDashPlace(){` (anchor `/* SFDF-R (2026-11-03, engineer): the Report's result rows`). It takes a `sfdResultRows()` row. It returns null unless the status is FAIL or REVIEW and the D/C is ≤ 1 or n/a, and `sfdChCond(x.name)` (SFDF) names a condition. Otherwise it returns `{cond: the conditions joined by '; ', ratio: 'DCR 0.30 (within limit)'}`, where ratio is '' when the D/C is n/a.
  - `sfdReportModel` summary (anchor `const rows=RR.map(x=>{const ks=(W[x.name]||[]).filter(k=>have.has(k));`):
    - Before:
      ```js
      const dc=(x.dc==null||isNaN(x.dc))?'n/a':(isFinite(x.dc)?sfrN(x.dc,2):'∞');
      return {cells:[x.name,String(x.val).replace(/\$/g,''),{t:dc,n:true},…
      ```
    - After:
      ```js
      const dc=…, cd=sfdRowCond(x);
      if(cd)return {cells:[x.name,(cd.ratio?cd.ratio+'; ':'')+String(x.val).replace(/\$/g,''),{t:cd.cond},{t:ST[x.st]||'N/A',cls:…},ks.length?…:'—']};
      ```
      followed by the old return, unchanged.
  - `sfxResults(tab)`: the row mapper `x=>[x.name+':',{t:fdc(x.dc),n:true},sfrPlain((x.ref?x.ref+'; ':'')+String(x.val)…),…]` became `x=>{const cd=sfdRowCond(x);return [x.name+':',cd?{t:cd.cond}:{t:fdc(x.dc),n:true},sfrPlain((x.ref?x.ref+'; ':'')+(cd&&cd.ratio?cd.ratio+'; ':'')+String(x.val)…),…];}`.
- **Check case:** default project.
  - Summary, before: `Flexure (footing) | DCR 0.30 OK, but A_s < A_s,min (top x) | 0.30 | FAIL`. After: `Flexure (footing) | DCR 0.30 (within limit); DCR 0.30 OK, but A_s < A_s,min (top x) | A_s < A_s,min | FAIL`.
  - The "Results — Footing design" row changes the same way.
  - "Footing bar development | … | 1.56 | FAIL" is unchanged, because the ratio governs.
- **Not changed:** the "Items that fail (NG) or need review" table, which has no D/C column; the verdict counts; the dashboard; `sfdResultRows()`.
- **How verified:** origin/main vs branch, 12 cases. `R` and `P2` are identical. The Report text has the same line count, and only these rows differ. The default project was printed to PDF and the rows checked: §1.2 (page 3) and §6.11 (page 50). check-syntax passes.
- **Other copies:** none.

### Open items
- None.

## 2026-11-03 — PR: claude/sfdf-report-nowrap (PR #742: https://github.com/mlococo88/All-Structural/pull/742) — Report rows: no repeated DCR prefix; the condition on one line (SFDF-N; display only, no result change)

### SFDF-N. Follow-up to SFDF-R (#741)   [display only]
- **Problem (engineer):** the Result cell read "DCR 0.30 (within limit); DCR 0.30 OK, but A_s < A_s,min (top x)". The ratio appeared twice.
- **Where:**
  - `sfdRowCond(x)` (anchor `/* SFDF-R (2026-11-03, engineer): the Report's result rows`):
    - Before: `const has=x.dc!=null&&!isNaN(x.dc);`
    - After: `const has=x.dc!=null&&!isNaN(x.dc)&&!/^\s*DCR\s/.test(String(x.val||''));`
    - So no "DCR x.xx (within limit); " prefix is added where the chip text already starts with "DCR ".
  - The condition cell in the summary table and in `sfxResults`: `{t:cd.cond}` → `{t:cd.cond,cls:'sfnw'}`. shared/report.js renders that as class `rp-sfnw`; shared/report.js itself is not changed.
  - CSS: before `@media print{#rp-print .rp-steps>.rp-step:last-child`, added `td.rp-sfnw{white-space:nowrap}`. It applies on screen and in print.
- **Check case:** default project. Before: `Flexure (footing) | DCR 0.30 (within limit); DCR 0.30 OK, but A_s < A_s,min (top x) | A_s < A_s,min | FAIL`. After: `Flexure (footing) | DCR 0.30 OK, but A_s < A_s,min (top x) | A_s < A_s,min | FAIL`. Punching shear (review case) changes the same way. Rows whose text starts otherwise keep the prefix, e.g. "DCR 0.91 (within limit); Ped 1: …" for dowels in sfe9 and "DCR 0.42 (within limit); Ped 1: ties".
- **How verified:**
  - origin/main vs branch, 12 cases: `R` and `P2` are identical. The Report text has the same line count, and only these cells differ. 0 console errors.
  - PDFs checked: default project pages 3 and 50, and the sfe9 case pages 4 and 53. The longest condition there, "shear-friction dev. short; dowels ≠ bars", stays on one line. It widens the D/C column, but the tables stay within the page width.
- **Other copies:** none.

### Open items
- None.

## 2026-11-03 — PR: claude/dxf-print-sheets (PR #749: https://github.com/mlococo88/All-Structural/pull/749) — Drawings: Print sheet and Print all sheets (11 × 17 landscape at plot scale) (SFPS; display only, no result change)

### SFPS. Print the drawing sheets to PDF   [display only]
- **Request (engineer):** print the previewed DXF sheets directly to PDF: "Print sheet" (the sheet shown) and "Print all sheets" next to
  "Download DXF"; each sheet a vector 11 × 17 landscape page at its true plot scale through the browser's print dialog; Ctrl+P and the
  browser's Print still print the Report.
- **Where:** `renderDrawings()`:
  - Bar, anchor `'<button type="button" id="sfdwDxf">Download DXF ('+B.S.length+' sheets)</button>`: before, the bar ended with `</div>'+` after
    that button; after, two buttons `id="sfdwPrint1"` (Print sheet) and `id="sfdwPrintAll"` (Print all sheets (n)) follow it, then
    `'<div class="note">'+sfEsc(SharedDxf.PRINT_NOTE)+'</div>'` (Tabloid / 11 × 17, Landscape, Margins None, Scale 100 %).
  - After the Download DXF handler (anchor `/* SFPS (2026-11-03)`):
    `const prt=list=>SharedDxf.printSheets(list.map(s=>({svg:SharedDxf.sheetSVG(B.D,s),title:s.title})),{paper:[SFDW.W,SFDW.H]});`
    `#sfdwPrint1` → `prt([cur])`, `#sfdwPrintAll` → `prt(B.S)`.
  - SFAC click interception (anchor `const t=e.target.closest&&e.target.closest('#btnPrint,#sfdwDxf,`): before
    `'#btnPrint,#sfdwDxf,#tab-report [data-rpact="print"]'` and `const sel=t.id==='sfdwDxf'?'#sfdwDxf':'#tab-report [data-rpact="print"]';`;
    after `'#btnPrint,#sfdwDxf,#sfdwPrint1,#sfdwPrintAll,#tab-report [data-rpact="print"]'` and
    `const sel=/^sfdw/.test(t.id)?'#'+t.id:'#tab-report [data-rpact="print"]';` (with Auto-calculate off and results out of date, the
    print buttons re-analyze first and then print, as Download DXF).
- **Governing provision:** none (drawing output).
- **Check case:** default project, sheet 1 FOOTING PLAN at 1/2" = 1'-0": the 10 × 8 ft footing measures 5.000 × 4.000 in (360 × 288 pt) on
  the printed 17 × 11 in page. Print all sheets: 7 pages, all 17 × 11 in.
- **How verified:** `node tests/smoke/dxf-print-sheets.mjs --tool sf` (headless Chromium page.pdf honoring @page). Report print (page.pdf with no
  button, from the Drawings tab): 63 letter pages, text identical to origin/main's (pdftotext, diff empty). `node tests/smoke/spread-footing-scroll.mjs`,
  `node tests/check-syntax.mjs`. No result changes: only the Drawings tab's bar and handlers changed.
- **Other copies:** the print code is shared (`shared/dxf.js` printSheets, sheetSVG; fixlog/shared-dxf.md).

### Open items
- The outer border prints on the page edge (the sheet is the page). A physical printer with unprintable edges will clip that outer line
  (the inner border and title block are inside it); a PDF keeps it.

## 2026-11-03 — PR: claude/dxf-sheet-inset (PR #754: https://github.com/mlococo88/All-Structural/pull/754) — Drawings: the sheet's outer border 0.25 in inside the paper edge (SFPS-2; display only, no result change)

### SFPS-2. Outer border inset (engineer's decision)
- **Problem (engineer):** on a physical printer the outer border, printed on the page edge, is clipped.
- **Where:** the sheet function in the drawing build (anchor `SharedDxf.sheetBorder(D`): before
  `D.rect(L.br,ox,0,ox+W,H);`, after
  `SharedDxf.sheetBorder(D,L.br,ox,W,H,k);` (shared/dxf.js: a rect 0.25 k inside the sheet's edge).
  The inner border, title block, drawing area and every drawn object are unchanged; the sheet is still 17 × 11 in at its plot scale.
- **Governing provision:** none (drawing output).
- **Check case:** the DXF display list of the default project, origin/main vs branch: same entity count and sheet scales; one entity per sheet
  differs (the outer border, 0.25 k inward on every side). Printed: the border at 18 pt from each page edge; the known dimension unchanged
  (see the PR).
- **How verified:** `node tests/smoke/dxf-print-sheets.mjs`, the display-list comparison, the tool's smoke tests (PR).
- **Other copies:** shared/dxf.js sheetBorder (fixlog/shared-dxf.md).

### Open items
- None.

## 2026-11-04 — PR: claude/sf-lrfd-ref (PR #757: https://github.com/mlococo88/All-Structural/pull/757) — LRFD (factored) combinations for bearing and stability, reference only (SFLR; display only, no result change)

### SFLR. Reference tables of the strength combinations on the Bearing and Stability tabs and in the Report   [display only]
- **Request (engineer):** show the LRFD (ASCE 7-16 §2.3 as the tool cites, §2.3.1) combinations for the bearing and stability calculations, for reference only: not in any D/C, status, dashboard chip, NG / REVIEW list or governing selection; the ASD basis unchanged; no new factors.
- **Combination set:** the tool's own `R.lrfd` (`genCombos('LRFD',…)`, used for the footing and pedestal design): 1.4D; 1.2D + 1.6L + 0.5(Lr or S); 1.2D + 1.6(Lr or S) + (L or 0.5W); 1.2D + 1.0W + L + 0.5(Lr or S); 0.9D + 1.0W (2.3.1(5), the uplift / overturning case is in the set). In direct mode, the factored envelopes (dead ×1.2 / ×0.9, or the imported AASHTO case's sets). No factor added or changed. ASCE 7-16 2.3.1(6)/(7) (seismic) are not generated by the tool (no E input), as before.
- **Where:**
  - New `function sfdOTEdges(r,B,L)` after `solveBearing` (anchor `/* SFLR (2026-11-04): overturning about the 4 edges`): the `edgeCalc` closure and its four calls moved out of `computeAll`'s ASD loop unchanged. In `computeAll`, before: `const edges=[];\n function edgeCalc(name,arm,Ma,armLabel){…}\n edgeCalc('+x (x=+B/2)',…);…edgeCalc('−y (y=−L/2)',…);`; after: `const edges=sfdOTEdges(r,B,L);`. Pure refactor (proof below).
  - New block before `/* ---------- Plotly charts ---------- */` (anchor `/* ================= SFLR (2026-11-04, engineer): LRFD (factored) combinations`): `sfdLrRef()` (per `R`, cached): for each `R.lrfd` row `solveBearing(P,e_x,e_y,B,L)`, `sfdOTEdges`, the smallest-ratio edge, N = max(P,0), H = √(H_x² + H_y²), P_p,R as the service sliding, μN, (μN + P_p,R)/H, 6|e_x|/B, 6|e_y|/L; the row with the largest q_max and the rows with the smallest M_r/M_o and sliding ratio (for the worked steps only). `sfdLrBearCard(T)` (card 3.4, `#o-br-lrfd`) and `sfdLrStabCard(T)` (card 4.6, `#o-st-lrfd`), each with the label "LRFD (factored) — reference only; not used in the checks", the table(s), one worked step, and "Worked in" links (§2.5 LRFD resultants, §3.2 / §4.2 / §4.3 procedure). No status column, no D/C, no comparison with q_allow.
  - Calls: last line of `renderBearing()` `sfdLrBearCard(T);` and of `renderStability()` `sfdLrStabCard(T);`.
  - Report: new `sfdLrReport(M)` (anchor `/* SFLR (2026-11-04): the LRFD reference tables in the Report`), called in `renderReport()`: before `M=sfxApply(sfrModel());`, after `M=sfdLrReport(sfxApply(sfrModel()));`. It adds a subsection "Reference: LRFD combinations" at the end of the Bearing and Stability sections (keys S-brLR, S-stLR; links [[S-lrfd]], [[S-bp]], [[S-st]]). It runs after sfxApply, so the rest of the Report is unchanged.
  - `sfxWalk`: the cards carry class `sfLrRef` and are skipped by the "As printed" walk (`'.noprint,.sfLrRef,.wkScr,…'`), so they appear in the Report only under the new heading.
  - Include box: `sfxControls()` gains "LRFD reference tables (bearing, stability)" (`data-sfx="lr"`), wired in `sfxWire`. Saved field `state.lrRefRpt` (new, default `true` in `defaultState()`; `migrateState()` sets `true` when absent, so older saves and projects show the tables). No key or existing field changed.
- **Governing provision:** ASCE 7-16 §2.3.1 (combinations, unchanged). Nothing checked against a code limit.
- **Check case (default project, 0.9D + 1.0(+Wx)):** P_u = 0.9(30.00 + 13.59 + 2·0.675 + 120 + 150) = 283.45 k; M_y = 0.9(−3·120 + 3·150) + 1.0·2·8·(2.5 + 2.0) = 81 + 72 = 153.00 k-ft; e_x = 0.540 ft; 6e_x/B = 0.324 (full); q = 283.45/80 (1 ± 0.324) = 4.69 / 2.40 ksf. Edge +x: M_r = 27.00·5 + 12.23·5 + 0.61·8 + 0.61·2 + 108·8 + 135·2 = 1336.23 k-ft, M_o = 72.00, ratio 18.56. Sliding: μ = tan(21.33°) = 0.391, μN = 110.70 k, H = 16.00 k, ratio 6.92. Tool: identical.
- **How verified:** origin/main vs branch, the 10 cases of the harness (def, rev, sfe, sfe5, dir, sfe9, revEx, thin, revHook, edgeHook): `R`, `P2`, dashboard text identical; the Report text of main is an in-order subsequence of the branch's (only the two new subsections added); 0 console errors, 0 KaTeX errors. `node tests/check-syntax.mjs`; `tests/smoke/spread-footing-scroll.mjs`; `tests/smoke/phone-layout.mjs --tool sf`; `tests/smoke/dxf-print-sheets.mjs --tool sf`. Screenshots of both cards (also out of date with Auto-calculate off: greyed with the tab), Report printed (pages 21 and 29–30 of the default project).
- **Other copies:** none.

### Open items
- Sliding ratio is (μN + P_p,R)/H, the same resistance as the service sliding check (passive included when the passive fraction is > 0), not H/μN. Asked of the engineer.

## 2026-11-04 — PR: claude/sf-lrfd-select (PR #758: https://github.com/mlococo88/All-Structural/pull/758) — LRFD (factored) combinations in the Bearing / Stability combination selector, reference only (SFLS; display only, no result change)

### SFLS. Select an LRFD combination on the Bearing and Stability tabs   [display only]
- **Request (engineer):** list the LRFD combinations in the combination selector of the Bearing and Stability tabs (`comboSelectorBar('asd',…)`, "Service (ASD) combination:"); when one is selected, the tab's per-combination views show its factored values, under a banner "LRFD (factored) combination — reference only; not used in the checks; no D/C". The governing D/C, the status chips, the dashboard, the NG list, the Report and the "★ governing" star stay ASD. Session only.
- **Where:**
  - `const SEL={asd:null,lrfd:null};` → `const SEL={asd:null,lrfd:null,asdLr:null};` (session only, never saved). The three resets `SEL.asd=null;SEL.lrfd=null;` (load-mode switch, Load project, Saved projects dialog) also clear `SEL.asdLr`.
  - `comboSelectorBar(basis,govIdx,onChange)`: for `basis==='asd'` outside direct mode the options go in `<optgroup label="Service (ASD)">` (texts unchanged) and a second `<optgroup label="LRFD (factored), reference only">` lists `R.lrfd` as `[LRFD] <n>. <name>` (value `L<i>`). Picking `L<i>` sets `SEL.asdLr=i`; an ASD pick or "★ governing" clears it. With an LRFD row selected the badge reads "Showing an LRFD (factored) combination — the checks use the service combinations; governing is #n (…)" and the banner `div.warnbox.sfLrSelBan` follows.
  - New after `comboSelectorBar` (anchor `/* SFLS (2026-11-04, engineer): the LRFD combination selected`): `sfdLrSel()`, `sfdLrView()` (the selected row of `sfdLrRef()` as `{lr,i,cb,r,bear,edges,otMin,z}`, the same objects as the 3.4 / 4.6 tables) and `sfdLrPick(i)` (sets `SEL.asdLr`, re-renders Bearing, Stability and the plots, syncs the 3D view, keeps the scroll position).
  - `syncSelTo3D(basis)`: first line after the `V3D.inited` test, `if(basis==='asd'&&sfdLrSel()){V3D.combo='LRFD:'+SEL.asdLr;…return;}` (the 3D view already lists `LRFD:i`).
  - `renderBearing()`: the selector's onChange, before `()=>{renderBearing();syncSelTo3D('asd');}`, after `()=>{sfdLrPick(SEL.asdLr);}`; `const g=selASD(R.govBear)` → `const lv=sfdLrView(), lvT=…; const g=lv||selASD(R.govBear)`. 3.1 title / text and the "Worked in" links (§2.5 row, §3.4 row) for `lv`; a net-uplift LRFD row (`mode==='tension'`) gets a note instead of the eccentricity, kern and pressure steps. **3.3**: with `lv`, the card "3.3 Bearing Check — service (ASD) combinations only" says the check applies to the service combinations, names the governing one and has a "Show the governing service combination" button; otherwise unchanged. Chosen over keeping 3.3 on the governing ASD combination because 3.3 would then work B′ = B − 2|e_x|, q_eff and a D/C from a different combination's e_x and P directly under 3.1 / 3.2 of the LRFD row, and put a D/C next to factored values the banner calls "no D/C".
  - `renderPlots()` heat map: `R.govBear.bear.plane` → `(hv?hv.bear:R.govBear.bear).plane` with `const hv=sfdLrView()`, title "Base pressure — LRFD (factored), reference only: <name>" when `hv`.
  - `renderStability()`: same onChange; `const selCombo=selASD(R.govOT)` → `const lv=sfdLrView(); const selCombo=lv||selASD(R.govOT)`. 4.2 with `lv`: the resultant ratio (μN + P_p,R)/H of §4.6 for the row (ratio only), plus a note that the x, y and resultant checks with FS_target are service checks; otherwise the ASD x / y / resultant blocks unchanged (wrapped in `else{…}`). 4.3 with `lv`: title, a warnbox (reference only, governing service overturning quoted), `M_r/M_o` instead of `FS_OT`, subtitle "ratio only, reference; no target, no check", no ✓ / NG, edge table header `M_r/M_o`; `overturningSVG(go,oe,lr)` (new third argument) prints "M_r/M_o = … (LRFD factored, reference only)" instead of "FS = … ✓/NG".
  - `sfdLrTable`: outside direct mode each row has class `sfLrRow` (click → `sfdLrPick`, a second click returns to governing) and the selected row `sfLrSel` (amber, outlined; CSS after `.comboSel .selBadge`). `sfdLrHead` adds the note "Click a row to show that combination …".
  - `contactZoneMap`: the wrapper gets class `sfdZone` and `wrap.sfdZoneDraw` (its deferred first draw).
  - `renderReport()`: the Report reads the Bearing / Stability tabs as rendered (`sfxApply`). With an LRFD row selected it clears `SEL.asdLr`, re-renders the two tabs (and draws the contact-zone readout at once), builds the Report, then restores the selection (`try{…}finally{…}`). Without an LRFD selection the function runs as before.
  - Side effect (display): an ASD pick now also re-renders the other tab and the plots (`sfdLrPick`). Before, an ASD pick left the 2.4 D/C chart and the 3.2 heat map empty until the next recalc, and the other tab on the previous selection.
- **Governing provision:** none changed. ASCE 7-16 §2.3.1 (combinations, as SFLR). No new factor, formula, check or status.
- **Check case (default project, LRFD #8 0.9D + 1.0(+Wx), as in SFLR):** 3.4 row P_u = 283.45 k, M_y = 153.00 k-ft, e_x = 0.540 ft, q_max / q_min = 4.69 / 2.40 ksf; 3.2 with the row selected: q = 283.45/(10·8)·(1 ± 6·0.540/10) = 3.543·(1 ± 0.324) = 4.69 / 2.40 ksf (section cut 2.40 → 4.69). 4.6 row edge +x, M_o = 72.00, M_r = 1,336.23, M_r/M_o = 18.56; 4.3 with the row selected: the same edge, sums and ratio. 4.6 sliding row H = 16.00, μN = 0.3906·283.45 = 110.70, P_p,R = 0, ratio 6.92; 4.2 with the row selected: 110.70/16.00 = 6.92. #2 1.2D + 1.6L + 0.5S (largest q_max): P_u = 611.93, M_y = 234.00, e_x = 0.382, q = 7.649·(1 ± 0.229) = 9.40 / 5.89 ksf in 3.4 and in 3.2.
- **How verified:** origin/main vs branch, the 10 cases of the harness (def, rev, sfe, sfe5, dir, sfe9, revEx, thin, revHook, edgeHook), default (governing) selection: `R`, `P2`, dashboard text and HTML, warnings / NG list, Report text and Report HTML (Plotly's random ids normalized) identical; 0 console errors, 0 KaTeX errors. With an LRFD row selected (default project): dashboard HTML and the Report text identical to the default selection; the selected row's values in 3.1 / 3.2 / 4.2 / 4.3 equal its 3.4 / 4.6 row; 3D view `LRFD:i`; selection kept after the Report is built; "★ governing" returns to ASD. Card 3.4 present in every case and in: phone (390 px), 900 px, auto-calculate off, stale (edited, not re-analyzed), 3.3 and 3.4 collapsed, direct mode (Vesić and q_a), no loads, an autosave written by the 2026-11-01 version (58204ba). `node tests/check-syntax.mjs`; `tests/smoke/spread-footing-scroll.mjs`; `tests/smoke/phone-layout.mjs --tool sf`.
- **Saved data:** none. `SEL` is not saved; an LRFD selection is lost on reload (session only). No key or field added or changed.
- **Other copies:** none.

### Card 3.4 missing in the engineer's photo (investigation)
- On main card 3.4 is built at the end of `renderBearing()` whenever `R.lrfd` exists; `R.lrfd` is computed on every analysis from the inputs (never saved), so a project saved by an older version gets it too (checked with an autosave written by 58204ba). Nothing hides it: not direct mode, a collapsed card (the title line stays), auto-calculate off or the stale state (dimmed only), a narrow window or the two-panel layout (checked at 390, 900, 1400 px). The only way 3.3 renders without 3.4 would be an exception in `sfdLrBearCard`, which would also leave the Stability, Footing and Pedestal tabs empty; none occurred on any case. Most likely the photographed copy predates #757 (merged 2026-11-04).

## 2026-11-04 — PR: claude/sf-heat-sel (PR #759: https://github.com/mlococo88/All-Structural/pull/759) — 3.2 heat map follows the selected combination, ASD or LRFD (SFHS; display only, no result change)

### SFHS. The base-pressure heat map shows the selected service combination   [display only]
- **Request (engineer):** the 3.2 heat map and its title follow any selected combination, ASD or LRFD; governing stays the default. Before, the heat map followed an LRFD selection (SFLS) but always showed the governing combination for an ASD pick.
- **Where:** `renderPlots()`, heat map (anchor `/* SFHS: else the selected service combination`). Before: `if(sfpOn('plot-heat')&&R.govBear&&(hv?hv.bear:R.govBear.bear).plane){ const bp=(hv?hv.bear:R.govBear.bear).plane,…`; after: `const hs=R.govBear?selASD(R.govBear):null;` and `(hv?hv.bear:hs.bear).plane` in both places. Title, before: `hv?'…LRFD (factored), reference only: '+hv.cb.name+…:'Base pressure — governing combination: '+R.govBear.cb.name+'  (green = min, red = max)'`; after: the LRFD title unchanged, then `hs===R.govBear?` the governing title unchanged `:'Base pressure — selected service combination: '+hs.cb.name+' (governing: '+R.govBear.cb.name+')  (green = min, red = max)'`. `selASD` returns the governing combination when nothing is selected (and always in direct mode).
- **Governing provision:** none. No calculation touched.
- **Check case (default project, ASD #2 D + L picked):** title "Base pressure — selected service combination: D + L (governing: D + 0.75L + 0.45(+Wx) + 0.75S)"; colour scale 4.56 → 6.81 ksf = the row's q_min / q_max (`R.asd[1].bear`). "★ governing" returns the governing title.
- **How verified:** origin/main vs branch, the 10 harness cases, default (governing) selection: `R`, `P2`, dashboard text and HTML, warnings, Report text and HTML (Plotly ids normalized), Bearing and Stability tab text identical; 0 console errors. Screenshot of the ASD pick checked by eye. `node tests/check-syntax.mjs`.
- **Note:** the Report reads the tabs as rendered, so with a non-governing ASD combination selected, its "As printed" Bearing figure now shows that combination's heat map, the same as the rest of that tab already does (unchanged behaviour of the ASD selection). With the default selection the Report is unchanged.
- **Saved data:** none. **Other copies:** none.

## 2026-11-05 — PR: claude/sf-shear-couple-rows (PR #760: https://github.com/mlococo88/All-Structural/pull/760) — resultant breakdown itemises the applied moments and the pedestal shear couples V·(t + h) (SFMR; display only, no result change)

### SFMR. Shears and their moments tabulated in the resultant breakdown (screen 2.3 and Report "Resultant of the governing bearing combination")   [display only]
- **Request (engineer):** does the resultant account for the moment of the pedestal shears acting at an elevated lever arm, and tabulate the shears and their moments. Answer: yes, `resultant(f)` adds `vx·coupleLever(p)` to M_y and `vy·coupleLever(p)` to M_x, `coupleLever(p) = (t + p.h)·hFac` (top of pedestal to bottom of footing; 0 when Stability "Pedestal shear couple" is Exclude), and this flows into e, bearing and overturning. The breakdown only showed it as one lumped row.
- **Where:**
  - New `sfdMaRows(r)` and `sfdLevTxt(w,fmt)` before `resultantBreakdown` (anchor `/* SFMR (2026-11-05): the terms of ΣM_a`). They read `r.maT` (the terms `resultant()` already records, SFPR) and return one row per pedestal and load type: applied moment (factor × M_y, factor × M_x) when nonzero, and a shear row for each nonzero V_x (→ ΣM_y) and V_y (→ ΣM_x) with H = f·V and M = H·lev. Lever text: `t + h = <R.t> + <lev − R.t> = <lev>`, or `0 (shear couple off)`.
  - `resultantBreakdown(a)`. Before: 7 columns, and
    `['Applied M + V·h couples','–','–','–','–',f2(r.MaY),f2(r.MaX)]` as one italic row; totals `['Totals (Σ)','',f2(r.P),'','',f2(r.My),f2(r.Mx)]`.
    After: 10 columns (adds ΣH_x term, ΣH_y term, shear lever; moment headers "contrib to ΣM_y (k-ft)" / "contrib to ΣM_x (k-ft)"), the vertical rows unchanged with "–" in the new columns, then "Subtotal: vertical loads (ΣP·x, ΣP·y)", the `sfdMaRows` rows, "Subtotal: applied M + shear couples (ΣM_a)" = `f2(r.MaY), f2(r.MaX)` (the old lumped values), and totals `['Totals (Σ)','',f2(r.P),'','',f2(r.Hx),f2(r.Hy),'',f2(r.My),f2(r.Mx)]`. Intro note and the "Horizontal resultants" note reworded (V·(t + h); "tabulated above").
  - Report, section "Resultant of the governing bearing combination" (key S-res). Before: `{type:'table',head:['Action','factor × magnitude','w_i (kip)','x_i (ft)','y_i (ft)'],rows:vt.map(…)}`. After: `wide:true`, the same 10-column layout (anchor `/* SFMR: the shears and the M_a terms tabulated */`), subtotal and total rows bold (`cls:'gov'`). The ΣM_a worked steps (SFPR) are unchanged and list the same terms.
- **Governing provision:** none changed (statics of the resultant, as before). No formula, factor or lever changed; the pedestal-base moment (V·h, pedestal design) is not part of this table and is unchanged.
- **Check case (default project, governing bearing D + 0.75L + 0.45(+Wx) + 0.75S):** Σ P·x = −2.02 + 2.02 − 360.00 − 135.00 + 450.00 + 180.00 + 45.00 = 180.00 k-ft. Ped 1 Wx: H_x = 0.45 × 8.00 = 3.60 k, lever t + h = 2.50 + 2.00 = 4.50 ft, M_y = 3.60 × 4.50 = 16.20 k-ft; Ped 2 Wx the same. ΣM_a,y = 32.40 (= old lumped row). ΣM_y = 180.00 + 32.40 = 212.40 k-ft, ΣH_x = 7.20 k, ΣP = 434.94 k, e_x = 0.488 ft. Before and after identical. With the couple excluded: the two shear rows show 3.60 k, lever "0 (shear couple off)", 0.00; ΣM_y = 180.00.
- **How verified:** origin/main vs branch on the 10 harness cases (def, rev, sfe, sfe5, dir, sfe9, revEx, thin, revHook, edgeHook): `R` and `P2` identical, 0 console and KaTeX errors. Self-consistency "ΣM: breakdown vs summary" passes (def 212.40 / 212.40; rev 36.84 / 36.84 and 139.41 / 139.41, where rows include applied M_x, M_y and V_y couples, ΣM_a,x = 181.02). `node tests/check-syntax.mjs`; `tests/smoke/spread-footing-scroll.mjs`. Screenshots of the card on screen and the printed Report checked by eye.
- **Saved data:** none. **Other copies:** none.

### Open items
- Stability 4.3, overturning edge tables, still show one row "Applied M + V·h couple" per edge (not part of this request). It can be itemised the same way if wanted.

## 2026-11-05 — PR: claude/sf-ot-itemise (PR #761: https://github.com/mlococo88/All-Structural/pull/761) — overturning edge tables itemise the applied moments and shear couples V·(t + h) (SFOR; display only, no result change)

### SFOR. Stability 4.3 per-edge overturning tables: the "Applied M + V·h couple" row itemised per pedestal and load type   [display only]
- **Request (engineer, approved after SFMR's open item):** in each edge table of 4.3, replace the single lumped row with one row per pedestal and load type (applied moment; shear "Ped n T shear V_x · (t + h)" with factor × V, lever "t + h = a + b = c" and the moment), signed and bucketed for that edge as the lumped term is, with a subtotal equal to the old row, so M_r, M_o and FS are unchanged.
- **Where:**
  - New `sfdOTMaRows(r,e)` after `sfdLevTxt` (anchor `/* SFOR (2026-11-05): the sfdMaRows terms that act about one overturning edge`). It filters `sfdMaRows(r)` (SFMR, from `r.maT`) to the terms acting about edge `e` (an x-edge: applied M_y and V_x couples; a y-edge: applied M_x and V_y couples) and signs each one as `edgeCalc` (in `sfdOTEdges`) signs the lumped term: `Ma = +MaY` on +x, `−MaY` on −x, `+MaX` on +y, `−MaX` on −y. The edge's axis and sign are read from `e.name` ("+x …", "−x …", "+y …", "−y …"); nothing is added to the results object.
  - `renderStability`, 4.3 per-edge loop (anchor `// SFOR: applied moments and shear couples, itemised per pedestal`). Before:
    ```js
      // applied moment / shear-couple row
      if(e.appRow){const tr=document.createElement('tr');
       const lbl='Applied M + V·h couple';
       const cells=[lbl,'–','–',f2(e.Ma),e.appRow.bucket==='r'?f2(Math.abs(e.appRow.m)):'–',e.appRow.bucket==='o'?f2(Math.abs(e.appRow.m)):'–'];
       cells.forEach((x,k)=>{const td=document.createElement('td');td.textContent=x;td.style.fontStyle='italic';if(k>=4)td.style.color=(k===4?'#1b5e20':'#b71c1c');tr.appendChild(td);});
       t.appendChild(tr);}
    ```
    After: one italic row per `sfdOTMaRows(go.r,e)` term — applied: `[src+' applied Mᵧ' (or Mₓ), f × M, '–', m, bucket cells]`; shear: `[src+' shear Vₓ · (t + h)' (or Vᵧ), 'f × V = H', sfdLevTxt(w,f2), m, bucket cells]` — then `['Subtotal: applied M + shear couples (M_app,net)','','',f2(e.Ma), <the old row's bucket cells>]`. Bucket cells of an item row: in the column of the net (`e.appRow.bucket`), `m` when the net overturns, `−m` when it resists, so a row acting against the net shows negative; the other column "–" (both "–" when `e.appRow` is null, i.e. |M_app,net| ≤ 1e-9). The note above the edge tables gains one sentence explaining this.
  - Same code serves the 4.3 view of a selected LRFD combination (SFLS) and the Report's copy of 4.3 (the Report reproduces the tab's tables). Card 4.6 and the Report's worked M_r / M_o steps quote M_app,net as one term and are unchanged (no edge table there).
- **Bucketing (unchanged):** `edgeCalc` nets all applied moments and couples into one `Ma` and puts it in M_o if ≥ 0, in M_r (as |Ma|) if < 0. The rows reproduce that net; they are not bucketed one by one (that would change M_r, M_o and FS where the terms have mixed signs, e.g. "rev", edge −y, 0.6D + 0.6(−Wx): the D terms −21.60 oppose the Wx terms +153.66). Raised as a question, not changed.
- **Governing provision:** none changed (statics of overturning about an edge, as before). No formula, factor, lever or bucket changed.
- **Check cases:**
  - Default project, 0.6D + 0.6(+Wx), edge +x (governing): Ped 1 Wx shear V_x: 0.60 × 8.00 = 4.80 k, lever t + h = 2.50 + 2.00 = 4.50 ft, m = +21.60 k-ft; Ped 2 Wx the same, +21.60. Subtotal 43.20 = old row (43.20, → M_o). M_r = 890.82, M_o = 43.20, FS = 20.62, before and after. Edge −x: the same rows −21.60 each, subtotal −43.20 → M_r, as before.
  - "rev" case, 0.6D + 0.6(−Wx), edge −y (governing), s = −1 on MaX: Ped 2 D applied M_x 0.60 × 31.50 = 18.90 → −18.90; Ped 2 D shear V_y 0.60 × 0.50 = 0.30 k × (2.00 + 7.00) = 2.70 → −2.70; Ped 2 Wx applied M_x −0.60 × 120.20 = −72.12 → +72.12; Ped 2 Wx shear V_y −0.60 × 15.10 = −9.06 k × 9.00 = −81.54 → +81.54. Sum = 132.06 = old row (→ M_o). M_r = 392.49, M_o = 12.21 + 132.06 = 144.27, FS = 2.72, before and after. Edge −x: V_x rows +38.40, −0.54, −1.62, +0.60, +1.62 = 38.46 = old row.
  - Shear couple excluded ("rev", Stability "Pedestal shear couple" off): shear rows show H, lever "0 (shear couple off)" and 0.00; the subtotal is the applied-moment sum, as the old row.
- **How verified:** origin/main vs branch on the 10 harness cases (def, rev, sfe, sfe5, dir, sfe9, revEx, thin, revHook, edgeHook): `R` and `P2` identical, 0 console and KaTeX errors, self-consistency "all 11 passed" on every case. In the page, for every case × shear couple on/off × every service and LRFD combination × all four edges, the `sfdOTMaRows` moments sum to `e.Ma` (relative 1e-9; 0 mismatches over 1,688 edge tables). `node tests/check-syntax.mjs`; `tests/smoke/spread-footing-scroll.mjs`. Screenshots of the edge tables on screen (default, rev, rev with the couple off, rev with an LRFD combination selected) and of the printed Report checked by eye.
- **Saved data:** none. **Other copies:** none.

### Open items
- Question for the engineer: should the applied moments and couples about an edge be bucketed term by term (each opposing term into M_r) instead of netted first? That changes M_r, M_o and FS wherever terms have mixed signs (e.g. "rev", edge −y above: M_r 392.49 → 414.09, M_o 144.27 → 165.87, FS 2.72 → 2.50). Not changed here.
- Pre-existing: the +x and −x edge panels share the id `o-st-ot-xxB2` (and +y / −y `o-st-ot-yyL2`), because the id strips the sign, so their open/closed state is shared. Not changed.

## 2026-11-05 — PR: claude/sf-ot-panel-ids (PR #762: https://github.com/mlococo88/All-Structural/pull/762) — one panel id per overturning edge (SFID; display only, no result change)

### SFID. Stability 4.3: the four per-edge panels get unique ids, each opens and closes on its own   [display only]
- **Problem (raised in SFOR, engineer approved the fix):** the per-edge panel id was `'o-st-ot-'+e.name.replace(/[^a-z0-9]/gi,'')`, which strips the sign, so +x and −x were both `o-st-ot-xxB2` and +y and −y both `o-st-ot-yyL2`: duplicate DOM ids, and one saved open/closed state (`collapseState`, saved in `sfd_auto`) per pair.
- **Where:** `renderStability`, 4.3 per-edge loop (anchor `/* SFID (2026-11-05): one id per edge`). Before:
  ```js
    const det=secPanel(b2,'o-st-ot-'+e.name.replace(/[^a-z0-9]/gi,''),'Edge '+e.name+ ...
  ```
  After:
  ```js
    const eid='o-st-ot-'+(e.name.charAt(0)==='+'?'p':'m')+(/x/.test(e.name.split(' ')[0])?'x':'y'), oid='o-st-ot-'+e.name.replace(/[^a-z0-9]/gi,'');
    if(collapseState[eid]===undefined&&collapseState[oid]!==undefined)collapseState[eid]=collapseState[oid];
    const det=secPanel(b2,eid,'Edge '+e.name+ ...
  ```
  New ids: `o-st-ot-px`, `o-st-ot-mx`, `o-st-ot-py`, `o-st-ot-my`.
- **Saved data (§5):** the storage key (`sfd_auto`) and format are unchanged; only the `collapseState` entries for these panels are new. Migration: when a new id has no saved state and the old shared id has one, the old value seeds it, so a saved project opens the panels exactly as before; from then on each edge keeps its own state. The old entries are left in place (unused), nothing is discarded. No other code refers to these ids (links go to the card `o-st-ot`).
- **Governing provision:** none (display).
- **Check case:** saved `collapseState {'o-st-ot-xxB2':false,'o-st-ot-yyL2':true}` → +x, −x closed, +y, −y open (as before). Opening −x leaves +x closed; closing +y leaves −y open; both survive a reload (saved `o-st-ot-mx:true`, `o-st-ot-px:false`, `o-st-ot-py:false`, `o-st-ot-my:true`). No duplicate `o-st-ot-*` ids in the page.
- **How verified:** the check case above in headless Chromium; origin/main vs branch on the 10 harness cases: `R`, `P2` identical and the Report text identical, 0 console / KaTeX errors; `node tests/check-syntax.mjs`; `tests/smoke/spread-footing-scroll.mjs`.
- **Other copies:** none. **Open items:** none.

## 2026-11-05 — PR: claude/sf-ot-term-bucket (PR #763: https://github.com/mlococo88/All-Structural/pull/763) — overturning: applied moments and shear couples bucketed term by term (SFTB; CALCULATION CHANGE)

### SFTB. M_r / M_o about each edge take each applied moment and each V·(t + h) couple on its own side, not their net   [result change]
- **Request (engineer, answer to the SFOR question):** bucket term by term. Each applied pedestal moment and each shear couple, signed for the edge, goes to M_r when it resists and to M_o when it tips the footing over that edge, instead of netting them first.
- **Where:**
  - `sfdOTEdges(r,B,L)` / `edgeCalc` (anchor `/* SFTB (2026-11-05, engineer): the applied pedestal moments and the shear couples`). Before:
    ```js
    function edgeCalc(name,arm,Ma,armLabel){
     ...
     let appRow=null;
     if(Math.abs(Ma)>1e-9){if(Ma>=0){Mo+=Ma;appRow={m:Ma,bucket:'o'};}else{Mr+=-Ma;appRow={m:-Ma,bucket:'r'};}}
     edges.push({name,Mr,Mo,FS:Mo>1e-9?Mr/Mo:Infinity,rows,appRow,armLabel,Ma});}
    edgeCalc('+x (x=+B/2)',v=>B/2-v.x,r.MaY,'B/2 − x');   // likewise −x (−MaY), +y (MaX), −y (−MaX)
    ```
    After:
    ```js
    function edgeCalc(name,arm,Ma,armLabel,ax,s){
     ...
     const app=[];let appR=0,appO=0;
     T.forEach(z=>{const mA=s*z.f*(ax==='x'?z.my:z.mx), mV=s*z.f*(ax==='x'?z.vx:z.vy)*z.lev;
      [['M',mA],['V',mV]].forEach(([k,m])=>{if(Math.abs(m)>1e-12){app.push({src:z.src,k,m,bucket:m>=0?'o':'r'});if(m>=0)appO+=m;else appR+=-m;}});});
     Mr+=appR;Mo+=appO;
     edges.push({name,Mr,Mo,FS:Mo>1e-9?Mr/Mo:Infinity,rows,app,appR,appO,armLabel,Ma});}
    edgeCalc('+x (x=+B/2)',v=>B/2-v.x,r.MaY,'B/2 − x','x',1);   // −x: 'x',−1; +y: 'y',1; −y: 'y',−1
    ```
    `T = r.maT` (the terms `resultant()` sums into MaX / MaY: f·M and f·V·lev per pedestal and load type). The sign per edge is the one the net used (+MaY on +x, −MaY on −x, +MaX on +y, −MaX on −y). `appRow` is replaced by `app`, `appR`, `appO`; `Ma` (the net) is kept for display.
  - Consumers of `appRow` changed to the term list: Stability 4.3 edge tables (`// SFOR: applied moments and shear couples`: each row in its own column, positive; subtotal row = net M_app,net and the two column sums `appR`, `appO`; the note above the tables reworded), the 4.3 FS equation (`\sum |M_{app}^{-}|`, `\sum M_{app}^{+}`), card 4.6 worked ratio (`sum(bk)` lists each term), Report "Overturning (governing edge)" (`otT`, label now says each term is bucketed on its own) and Report "Reference: LRFD combinations" (`sum`). Manual 4B.3 sentence: "each applied moment and each V·(t+h) couple contributes, on its own (term by term, not netted first), …".
- **Governing provision / basis:** the tool's overturning check is FS_OT = ΣM_r / ΣM_o about each footing edge for the ASCE 7-16 §2.4.1 service combinations (min-dead 0.6D + 0.6W bracket), compared with an input target (default 2.0; reported, not gated, by default — IBC / ASCE 7 set no numeric FS for a building spread footing; IBC 1807.2.3 sets 1.5 for retaining walls). Unchanged. What changes is the classification: every action is now classified individually as resisting or overturning (as the vertical loads already were), instead of netting the applied moments and couples first. Netting understated both M_r and M_o where terms had mixed signs, so FS was higher (unconservative) for FS > 1. The LRFD reference ratios (4.6, 4.3 with an LRFD combination) use the same edge sums and change the same way.
- **Check case ("rev", governing 0.6D + 0.6(−Wx), edge −y, s = −1 on MaX):** vertical terms unchanged, ΣW·a⁺ = 11.70·6.500 + 4.24·6.712 + 10.08·7.833 + 4.48·1.833 + 21.86·8.433 + 9.00·1.833 = 392.49, ΣW·a⁻ = 6.66·1.833 = 12.21. Terms: Ped 2 D M_x 0.60·31.50 = 18.90 → −18.90 (resists); Ped 2 D V_y 0.60·0.50·(2.00 + 7.00) = 2.70 → −2.70 (resists); Ped 2 Wx M_x −0.60·120.20 = −72.12 → +72.12 (overturns); Ped 2 Wx V_y −0.60·15.10·9.00 = −81.54 → +81.54 (overturns). Before (net 132.06 → M_o): M_r = 392.49, M_o = 12.21 + 132.06 = 144.27, FS = 2.72. After: M_r = 392.49 + 18.90 + 2.70 = 414.09, M_o = 12.21 + 72.12 + 81.54 = 165.87, FS = 414.09 / 165.87 = 2.50. Governing combination and edge unchanged; FS target 2.00 still met (not gated in this case). LRFD reference, 0.9D + 1.0(−Wx), edge −y: M_r 588.73 → 621.13, M_o 244.05 → 276.45, ratio 2.41 → 2.25.
- **What moves (deep diff, origin/main vs branch, 10 harness cases):** def, sfe, sfe5, dir, sfe9, thin, edgeHook: nothing (every applied term about an edge has the same sign, so term-by-term = net). rev, revEx, revHook (identical lists, 93 values each): M_r, M_o, FS of the edges of the six combinations with D moments opposing a negative wind (D + 0.6(−Wx), D + 0.6(−Wy), D + 0.75L + 0.45(−Wx) + 0.75S, D + 0.75L + 0.45(−Wy) + 0.75S, 0.6D + 0.6(−Wx), 0.6D + 0.6(−Wy)); their otMin edge changes for D + 0.6(−Wx) (−x 4.76 → −y 4.16), D + 0.75L + 0.45(−Wx) + 0.75S (−x 8.73 → −y 7.05) and 0.6D + 0.6(−Wy) (+x 71.01 → +y 19.52); R.govOT (and the same object under govSlx/govSly/govSlr.otMin) 2.72 → 2.50. LRFD reference: six strength combinations change the same way; smallest ratio 0.9D + 1.0(−Wx) −y 2.41 → 2.25. P2 (footing / pedestal design) unchanged in every case. Besides these, only the field names change (`appRow` → `app`, `appR`, `appO`).
- **How verified:** the deep diff above; self-consistency "all 11 passed" on every case; in the page, for every case × shear couple on/off × every service and LRFD combination × edge, the + rows sum to `appO`, the − rows to `appR` and all rows to the net `Ma` (0 mismatches); `node tests/check-syntax.mjs`; `tests/smoke/spread-footing-scroll.mjs`; screenshots of the 4.3 edge tables (service and LRFD) and the Report pages checked by eye.
- **Saved data:** none (no input or key changed). **Other copies:** none.

### Open items
- none.

## 2026-11-05 — PR: claude/sf-lams (PR #764: https://github.com/mlococo88/All-Structural/pull/764) — Option: neglect the size-effect factor λ_s in footing one-way and two-way shear, ACI 318-19 §13.2.6.2 (SFLN; calculation option, default off = no change)

### SFLN. "Neglect size effect λ_s for footing shear (ACI 318-19 §13.2.6.2)"   [calculation option; CLAUDE.md §4]
- **Request (engineer, RISAFoundation reconciliation of the Seymour project):** an option to take λ_s = 1.0 in the footing's shear, as ACI 318-19 permits for shallow foundations. Default off.
- **Provision read (ACI 318-19, printed p. 194, §13.2.6.2):** for one-way shallow foundations, two-way isolated footings, two-way combined footings and mat foundations, the size effect factor of 22.5 (one-way shear) and 22.6 (two-way shear) may be neglected. Paraphrased; not quoted.
- **Where:**
  - Input: Materials, checkbox after "One-way V_c basis" (anchor `<!-- SFLN -->`), `data-path="mat.lamsFtg"`, values `'off'` (default) / `'on'`. `defaultState().mat.lamsFtg='off'`; `migrateState`: `if(state.mat.lamsFtg!=='on')state.mat.lamsFtg='off';` (saves without the field: off, λ_s applied as before).
  - `computePhase2` / `directionDesign` (footing one-way shear). Before: `const dV=dBot;const lam_s=Math.min(Math.sqrt(2/(1+dV/10)),1);` After: `const dV=dBot;const lamsNeg=(state.mat.lamsFtg==='on'); const lam_s=lamsNeg?1:Math.min(Math.sqrt(2/(1+dV/10)),1);` (`lamsNeg` added to the returned object).
  - `computePhase2` punching (per pedestal). Before: `const lam_s=Math.min(Math.sqrt(2/(1+d/10)),1);` After: `const lamsNeg=(state.mat.lamsFtg==='on'); const lam_s=lamsNeg?1:Math.min(Math.sqrt(2/(1+d/10)),1);` (`lamsNeg` returned).
  - Not changed: pedestal shear (`sfdPedShear`, `lams` in `sec`), which is not a footing and keeps λ_s.
  - Display (option on only): Report footing x / y "One-way shear" topic reference and the λ_s step ("neglected for a shallow foundation (option on)", ACI 318-19 13.2.6.2); punching v_c step note; Footing Design one-way and punching equation blocks; dashboard rows "One-way shear" and "Punching shear"; Report "Geometry and materials" table gets a row "Size effect λ_s, footing one-way and two-way shear" (applied / neglected; shown in every report). User manual 0.3.3: one sentence on the option.
- **Check case (Seymour Platform Foundation, f′c = 3000 psi, as saved otherwise):**
  - One-way, x (b = 13 ft = 156 in, #7 at 8 in, d_x = 19.6875 in): ρ_w = 0.900/(12·19.6875) = 0.003810; 8ρ_w^1/3 = 1.2494. Off: λ_s = √(2/(1 + 1.96875)) = **0.8208**; φV_c = 0.75·1.2494·0.8208·1.0·54.772·156·19.6875/1000 = **129.38 kip** (9.95 kip/ft). On: λ_s = 1.0, φV_c = **157.63 kip** (12.13 kip/ft). The check itself is N/A in this project (the critical section at d from the face is outside the footing), so no status changes.
  - One-way, y (b = 60 in, d_y = 20.5625 in): λ_s 0.8089 → 1.0; φV_c 50.49 → 62.41 kip (also N/A).
  - Punching, Ped 2 (d = 20.125 in, b_0 = 148.41 in, β = 1.19): λ_s = √(2/(1 + 2.0125)) = 0.8148. Off: v_c = 4·0.8148·54.772 = 178.51 psi, φv_c = 133.89 psi, v_u = 60.12 psi, DCR **0.449**. On: v_c = 4·54.772 = 219.09 psi, φv_c = 164.32 psi, DCR **0.366**. Ped 1: DCR 0.077 → 0.063.
  - RISAFoundation's one-way φV_n for the same footing, 12.49 kip/ft, is the λ_s = 1 value at its d = 20.56 in (bar layer order differs; see the next option).
- **How verified:** headless Chromium, origin/main 805f83c vs the branch, pinned KaTeX / Plotly / three. Deep diff of `R` and `P2` on the 10 harness cases plus Seymour at 3000 psi: only the new field `lamsNeg` (false) on `desX`, `desY`, `punch[]`; Report text identical except the new materials-table row. Option on (Seymour, rev, default): only λ_s, V_c, φV_c, v_c1–3, v_c, φv_c and the DCRs move, as above. 0 console errors, 0 KaTeX errors. `node tests/check-syntax.mjs` passes; `tests/smoke/spread-footing-scroll.mjs` passes. Screenshots of the input, the Footing Design blocks and the Report steps checked by eye.
- **Saved data:** new field `mat.lamsFtg` ('off' | 'on'); absent = 'off' = today's behaviour. No key or format change.
- **Other copies:** none.
- **Decision (pending engineer review):** the option covers the footing's one-way and punching checks only; the grouped-pedestal statement (SFPG) computes no stress and is unaffected. The one-way override row (a) (`vcMode 'a'`) also uses λ_s in this tool; with the option on it uses 1.0 as well, since 13.2.6.2 covers 22.5 as a whole.
## 2026-11-05 — PR: claude/sf-3d-load-labels (PR #765: https://github.com/mlococo88/All-Structural/pull/765) — 3D view: load labels, case/combination selector, title with sign convention (SF3L; display only, no result change)

### SF3L. Tab 7 (3D View): every pedestal load arrow carries its value; the selector lists the governing service combination, the unfactored load cases, the service and the LRFD combinations   [display only]
- **Request (engineer):** label each load arrow with its value and units, legible at any zoom and facing the camera, no overlap, hidden for a zero component; a selector for Governing (service) [default], each unfactored load case, each service (ASD) combination and each LRFD combination (reference); in direct mode the envelope only; kept in step with the Bearing / Stability selector; a title with the selection and the sign convention.
- **Where (all in the `7. 3D VIEW` block unless noted; anchor `SF3L`):**
  - `syncSelTo3D(basis)` (output-tab section, anchor `/* SF3L (2026-11-05): one-way sync`). Before: returned when the 3D view was not yet built; set `'ASD:'+SEL.asd`, `'LRFD:'+SEL.asdLr` or `'LRFD:'+SEL.lrfd` only for an explicit pick. After: builds the key `k` (`'LRFD:'+SEL.asdLr`; `'ASD:'+SEL.asd` when it is not the governing bearing combination, else `'GOV'`; `'LRFD:'+SEL.lrfd`), maps it to the envelope list in direct mode, stores it in `V3D.combo` also before the 3D tab has been opened, and rebuilds the scene when it is built.
  - `v3dActiveList()`. Before: `[ASD] name` for each `R.asd`, `[LRFD] name` for each `R.lrfd`. After: `GOV` (`Governing (service): <name>`, `a: R.govBear`); `CASE:<tp>` for each `TYPES` entry with `R.present[tp]` (`f: {[tp]:1}`, basis `'CASE'`); `ASD:i` (`[ASD] n. name`, ★ on the governing one); `LRFD:i` (`[LRFD] n. name (reference)`); each with an optgroup `grp`. Direct mode: only `ASD:i` (`n. name`, group "Direct factored envelope"), the two dead-load brackets of the envelope. New constant `SF3L_CASE` (case names).
  - `renderView3D()`: options grouped in `<optgroup>`s; default `V3D.combo = 'GOV'` (was `'ASD:'+R.asd.indexOf(R.govBear)`; same combination, but `GOV` follows the governing combination after a re-analysis); a `#v3dTitle` div above the view; an `<svg id="v3dLeaders">` over the canvas for label leaders.
  - `initThree()` render loop: `v3dLayoutLabels()` before `renderer.render`.
  - `clearGroup(g)`: also disposes `m.map` (label and axis textures).
  - `rebuildScene()`: `V3D.labels=[]` before the groups are rebuilt.
  - `comboBearing(item)`: `item.basis==='CASE'` → `{plane:null,qmax:0,mode:'case'}` (no pressure plane for a single load case; the pressure layer is empty and the hover / inspect show q = 0 as for a missing plane).
  - `buildLoads(item)`. Before: `const direct=(item.basis==='ASD')?(item.a.cb.f&&item.a.cb.f.direct):(item.l.cb.f&&item.l.cb.f.direct); const f=item.basis==='ASD'?item.a.cb.f:item.l.cb.f;` After: `const f=item.f||(item.basis==='ASD'?item.a.cb.f:item.l.cb.f); const direct=!!(f&&f.direct);`. After each non-zero `addArrow` / `addMomentArc`: `v3dLoadLabel(g,'P = '+f2(P)+' k', …)` (anchor at mid-shaft of the P arrow), `'Vx = '+f2(Vx)+' k'` / `'Vy = …'` (at the arrow tip), `'Mx = '+f2(Mx)+' k-ft'` / `'My = …'` (at the start of the arc). Arrow lengths, directions and arcs unchanged.
  - New `v3dLoadLabel(g,txt,anchor,color)`: canvas-texture `THREE.Sprite` (bold 12 px text, white box, border in the arrow colour), `sizeAttenuation:false`, `depthTest:false`, `frustumCulled=false`, material `userData.noclip` (not cut by the section cuts, like the arrows).
  - New `v3dLayoutLabels()`: each render, projects every anchor to screen pixels, scales the sprite to its pixel size (`scale = 2·px/(H·P[5])`), places it right of the anchor inside the view, moves it clear of the control panels, then pushes it down below any label already placed (greedy, top to bottom), and sets `sprite.center` for that offset; a dashed leader (SVG) joins a label moved more than 10 px off its anchor.
  - New `v3dTitle(item)` (called from `buildBasisNote`): what is shown (governing / selected service combination with its number and ASCE 7-16 reference; LRFD "reference only"; load case "unfactored"; direct envelope), that the values are the loads at the pedestal tops without self-weight, EV and surcharge, a link to tab 2, and the sign convention. `buildBasisNote`: a line for a load case. CSS `#v3dTitle`.
- **Problem:** the arrows had no magnitudes (the label argument of `addArrow` was unused), and the selector had neither the governing default as such nor the single load cases.
- **Governing provision:** none (display). Values: per pedestal, Σ f·(case value) over D, L, Lr, S, Wx, Wy with the factors of the selected combination (the same sum `buildLoads` already used for the arrows); direct mode: the entered envelope values.
- **Decisions (pending engineer review):**
  1. Labels show the signed value as entered / combined (e.g. `Vx = -0.30 k`), and the arrow points the way the load acts; "+P downward" etc. is stated in the title.
  2. Sync is one-way, the latest pick wins: a pick in the Bearing / Stability selector (or the Phase 2 LRFD selector) sets the 3D selection, also before the 3D tab was first opened; a pick in the 3D selector stays local and never changes the other tabs. "★ governing" in Bearing / Stability maps to "Governing (service)".
  3. A single unfactored load case shows arrows and labels only, no bearing-pressure surface (it is not a bearing combination).
  4. Direct mode lists the two dead-load brackets of the envelope (the pedestal arrows are the same; the pressure differs), default the governing one.
  5. The selection is session only (`V3D.combo`, not saved); no new storage key.
  6. Labels are kept out from under the control panels and inside the view; a label pushed off its arrow gets a dashed leader in the arrow colour.
- **Check case (Seymour Platform Foundation inputs, Ped 2: D P 15.9, Vy 0.5, Mx 31.5; S P 11.5, Vy 0.5, Mx 35.2; Wx P 11.1, Vx −0.3, Vy 15.1, Mx 120.2, My 1.0; Ped 1: D P 47.15, L P 36.3):** governing service D + 0.75L + 0.45(+Wx) + 0.75S: Ped 1 P = 47.15 + 0.75·36.3 = 74.38 k; Ped 2 P = 15.9 + 0.75·11.5 + 0.45·11.1 = 29.52 k, Vy = 0.5 + 0.375 + 6.795 = 7.67 k, Mx = 31.5 + 26.40 + 54.09 = 111.99 k-ft; labels `P = 74.38 k`, `P = 29.52 k`, `Vy = 7.67 k`, `Mx = 111.99 k-ft` (and Vx 0.39 k, My 2.10 k-ft). Load case Wx: `P = 11.10 k`, `Vx = -0.30 k` (arrow toward −x), `Vy = 15.10 k`, `Mx = 120.20 k-ft`, `My = 1.00 k-ft`. LRFD 1.4D: `P = 66.01 k` (1.4·47.15), `P = 22.26 k` (1.4·15.9).
- **How verified:** deep diff origin/main vs branch over the 10 harness cases: `R`, `P2`, the dashboard and the Report text identical, 0 console / KaTeX errors; selector / sync script (Bearing pick before opening 3D → `ASD:1`; 3D pick `CASE:L` leaves `SEL` unchanged; Bearing LRFD pick → `LRFD:2`; ★ governing → `GOV`; stale styling applies; direct mode lists the envelope only); `node tests/check-syntax.mjs`; `tests/smoke/spread-footing-scroll.mjs`; `tests/smoke/phone-layout.mjs --tool sf`; screenshots (default and Seymour: governing, Wx, LRFD 1.4D; direct envelope; stale) checked by eye.
- **Saved data:** none (no key, no format). **Other copies:** none. **Library:** three.js r160 core only (Sprite, CanvasTexture); no CSS2DRenderer, nothing new loaded.

### Open items
- The tool tabulates combination resultants (tab 2) and the unfactored pedestal loads (input / §1 echo), but not the per-pedestal loads of each combination; the 3D labels are the only place those appear. If the engineer wants them worked in a table (CLAUDE.md §6), that is a separate request.


## 2026-11-05 — PR: claude/sf-bot-layer (PR #766: https://github.com/mlococo88/All-Structural/pull/766) — Input: which bottom layer is outermost (y-bars default, or x-bars); d_x, d_y follow; 3D view follows the design order (SFBO; calculation option, default = no change)

### SFBO. "Outer bottom layer (nearest the soil): y-bars (default) / x-bars"   [calculation option; CLAUDE.md §4]
- **Request (engineer, RISAFoundation reconciliation of the Seymour project):** until now the bottom y-bars were always the outer layer. This adds a choice. The top mat order is unchanged: top x-bars outer, top y-bars inner (SFTD, confirmed in SFCJ).
- **Where:**
  - Input: Reinforcement tab, under the mat table (anchor `<!-- SFBO -->`), `data-path="freinf.botOuter"`, `'y'` (default) / `'x'`. `defaultState().freinf.botOuter='y'`; `migrateState`: `if(state.freinf.botOuter!=='x')state.freinf.botOuter='y';`.
  - `computePhase2` (anchor `/* SFBO (2026-11-05, engineer)`). Before:
    ```js
    const dBotX=tin-cvB-BAR_DIA[state.freinf.botX.size||8]/2-BAR_DIA[state.freinf.botY.size||8];
    const dBotY=tin-cvB-BAR_DIA[state.freinf.botY.size||8]/2;
    ```
    After:
    ```js
    const botXOut=(state.freinf.botOuter==='x');
    const dBotX=botXOut?tin-cvB-BAR_DIA[state.freinf.botX.size||8]/2:tin-cvB-BAR_DIA[state.freinf.botX.size||8]/2-BAR_DIA[state.freinf.botY.size||8];
    const dBotY=botXOut?tin-cvB-BAR_DIA[state.freinf.botX.size||8]-BAR_DIA[state.freinf.botY.size||8]/2:tin-cvB-BAR_DIA[state.freinf.botY.size||8]/2;
    ```
    `botXOut` is returned in `P2`. Everything that uses `dBotX` / `dBotY` follows: flexure (φM_n, A_s,req, DCR), one-way shear (ρ_w, λ_s, V_c), the 13.3.3.3 band check, punching d_avg (unchanged when both layers are the same size), and development (A_s,req in the 25.4.10.1 option). The cover used for c_b and the hook factors is the same for both layers (as before).
  - Drawings and DXF: `sfdwLevels` places the bottom x-bars at c + d_b,x/2 and the y-bars at c + d_b,x + d_b,y/2 when x is outer. Unchanged for y outer.
  - 3D view, `buildRebar`: the bottom layers now follow the input. **Display fix:** before, the 3D view always drew the bottom x-bars outermost, opposite to the design's d_x and to the drawings. Now, with the default (y outer), it draws the y-bars outermost.
  - Report 6.1: with x outer, the d_x / d_y steps read "outer layer, nearest the soil" / "inner layer, on top of the x-bars", with their own expressions. With y outer the steps are unchanged. Report 2.4 note states the layer order (every report). Footing Design 5.1 table: "(outer layer)" / "(inner layer)" when x is outer. Manual 0.3.4: one sentence.
- **Governing provision:** effective depth d is the distance from the extreme compression fibre to the centroid of the tension reinforcement (ACI 318-19 §2.2, "d"); used in §22.2 (flexure) and §22.5 (one-way shear). No formula changes; only which layer is nearer the soil.
- **Check case (Seymour, f′c = 3000 psi, t = 24 in, bottom cover 3 in, #7 at 8 in both ways, d_b = 0.875 in):**
  - Default (y outer): d_x = 24 − 3 − 0.4375 − 0.875 = **19.6875 in**; d_y = 24 − 3 − 0.4375 = **20.5625 in**.
  - x outer: d_x = 24 − 3 − 0.4375 = **20.5625 in**; d_y = 24 − 3 − 0.875 − 0.4375 = **19.6875 in**.
  - x flexure (transverse, toe), per ft: a = 0.900·60/(0.85·3·12) = 1.765 in.
    - Before: φM_n = 0.9·0.900·60·(19.6875 − 0.882)/12 = **76.16 kip-ft/ft** (11 881 kip-in over 13 ft).
    - After: φM_n = 0.9·0.900·60·(20.5625 − 0.882)/12 = **79.70 kip-ft/ft** (12 434 kip-in).
    - DCR 0.0252 → 0.0241. RISA: 79.87 with A_s 0.902.
  - y flexure (longitudinal, M_u = 276.76 kip-ft over B = 5 ft):
    - φM_n 4782.3 → **4569.7 kip-in**;
    - DCR **0.694 → 0.727** (governing flexure; still PASS);
    - A_s,req (flexure) 0.616 → 0.646 in²/ft.
  - One-way φV_c: x 129.38 → 131.27 kip (ρ_w and λ_s change with d); y 50.49 → 49.76 kip (both N/A in this project).
  - Punching: d_avg = 20.125 in, unchanged (both layers #7).
- **How verified:** headless Chromium, origin/main d21a727 vs the branch, pinned libraries.
  - Deep diff of `R` and `P2` on the 10 harness cases plus Seymour at 3 ksi: only the new field `P2.botXOut: false`. Report text identical except the Report 2.4 layer-order note. Dashboard identical. 0 console errors, 0 KaTeX errors.
  - Option on (Seymour): only the values listed above move (`dBotX/Y`, `desX/Y` capacities, shear, `gfChk` band A_s,req, `dev` A_s,req / `rEx` / `LdEx`).
  - `sfdwLevels`, Seymour: default botY 3.4375 / botX 4.3125 in; x outer botX 3.4375 / botY 4.3125 in.
  - 3D bar centre heights (ft from the top of the footing):
    - main: x −1.7135, y −1.6406 (x drawn outer);
    - branch default: y −1.7135, x −1.6406;
    - branch with x outer: x −1.7135, y −1.6406.
  - `node tests/check-syntax.mjs` passes; `tests/smoke/spread-footing-scroll.mjs` passes. Screenshots of the input, Report 6.1, Footing Design 5.1 and Drawings section A-A checked by eye.
- **Saved data:** new field `freinf.botOuter`. Absent = 'y' = today's behaviour. No key or format change.
- **Other copies:** none.
- **Decision (pending engineer review):** the 3D view drew the x-bars outermost before, which disagreed with the design and the drawings. It now follows the design (display only; no computed value changes).
## 2026-11-05 — PR: claude/sf-dxf-loads (PR #767: https://github.com/mlococo88/All-Structural/pull/767) — Drawings: pedestal load schedule, pedestal tags and section load arrows (SFDL; display only, no result change)

### SFDL. Drawings tab (DXF / preview / print): the pedestal loads on the FOOTING PLAN and SECTION A-A / B-B sheets   [display only]
- **Request (engineer):** pedestal tags; a PEDESTAL LOAD SCHEDULE (unfactored, at the top of the pedestal; one row per pedestal x load case, P, Vx, Vy, Mx, My, load point offset; in direct mode the factored envelope, labelled so) with the sign convention and a small axis / arrow legend, on its own layer, inside the border without overlapping the title block or the views, on an extra sheet if it does not fit; on the sections, arrows with values for the governing service combination, labelled with its name.
- **Where (`sfdwBuild`, anchor `SFDL`):**
  - Layers: `lt: S-LOAD-TEXT` (7), `lg: S-LOAD-TABLE` (7), `la: S-LOAD-ARW` (1) added to `L`. Before: `...,cut:D.layer('CUT',6)};` After: `...,cut:D.layer('CUT',6),\n  lt:D.layer('LOAD-TEXT',7),lg:D.layer('LOAD-TABLE',7),la:D.layer('LOAD-ARW',1)};`
  - `sheet(id,title,content,fixedK)` → `sheet(id,title,content,fixedK,post)`. Before: `if(isFinite(b[0]))D.move(i0,cx-(b[0]+b[2])/2,cy-(b[1]+b[3])/2);` After: the same move through `dx`, `dy`, then `if(post){const g=0.15*k;post(k,{i0,dx,dy,ox,W,H,area:[ox+mm+g,mm+tb+g,ox+W-mm-g,H-mm-g]});D.k=k;D.h=0.1*k;}`. `post` runs after the view has been fitted, scaled and placed, so the view's own entities are unchanged; `area` is the drawing area inside the border, above the title block.
  - New helpers: `sfdlSpot` (first free box in `area`, clear of every entity of the sheet: the corners first, then a grid from the top right), `sfdlV(p,f)` (pedestal-top P, Vx, Vy, Mx, My for factors `f`, or the direct envelope; the same sum as the 3D view's `buildLoads`), `sfdlN`, `sfdlWrap`, `sfdlLay(compact)` (the schedule in a wide layout: tag, pedestal, case, P, Vx, Vy, Mx, My, load point; and a compact one for the side of the plan: tag, case, the five values, with the load points listed under the table), `sfdlTable(Lo,x,y,k)` (title, subtitle, table, sign convention, legend: +x / +y arrows, load-point symbol "+P down", pedestal tag).
  - Plan sheet `post`: a circled tag P1, P2, ... at each pedestal (inside a corner clear of the plan's text and symbols, else just outside); then the schedule in the first layout that fits a free area of the sheet (wide, then compact). Otherwise a note "PEDESTAL LOAD SCHEDULE: SEE SHEET n OF n (PEDESTAL LOADS)" and a new last sheet `loads` "PEDESTAL LOADS" (k = 1, wide layout). It is added at the end so no other sheet moves; only the "n OF N" sheet numbers change.
  - Section sheets `post` (`sfdlSec(dir)`): at each pedestal the section cuts, `P = … K` (and `(UPLIFT)` when negative) next to the existing P arrow; `My` (section A) or `Mx` (section B) `= … K-FT` when non-zero; a horizontal V arrow (Vx on A, Vy on B) at the pedestal top, pointing the way it acts, with `Vx = … K`. Under the section title: `LOADS AT PEDESTAL TOP: GOVERNING SERVICE COMBINATION n: <name> (SERVICE LEVEL); +P DOWN, +Vx IN +x; SELF-WEIGHT NOT INCLUDED` (direct mode: `DIRECT FACTORED ENVELOPE (AS ENTERED)`).
- **Governing provision:** none (display). Values are the entered pedestal loads; the section values use Σ f·(case value) with the governing service combination's factors (`R.govBear.cb.f`).
- **Decisions (pending engineer review):**
  1. The schedule goes on the plan sheet only where a free area takes it whole (the plan view keeps its scale and position). Otherwise it goes on an extra PEDESTAL LOADS sheet at the end of the set, with a "see sheet" note on the plan. Default project: extra sheet (8 sheets); Seymour: on the plan, compact layout.
  2. The section arrows show the governing service (bearing) combination, the same one as the 3D default. Moments are given as text (no curved arrow in the 2D section).
  3. Values are signed as entered (2 decimals, `0` for zero); the sign convention is printed under the table.
  4. Direct mode: one row per pedestal, "FACTORED" (wide) / "ENV." (compact), with the subtitle "FACTORED ENVELOPE AS ENTERED (DIRECT MODE)".
- **Check case:** Seymour, governing D + 0.75L + 0.45(+Wx) + 0.75S. Section B-B: Ped 2 P = 15.9 + 0.75·11.5 + 0.45·11.1 = 29.52 K, Vy = 0.5 + 0.375 + 6.795 = 7.67 K (arrow toward +y), Mx = 31.5 + 26.40 + 54.09 = 111.99 K-FT; Ped 1 P = 47.15 + 0.75·36.3 = 74.38 K. Schedule rows = the entered loads (P1 D 47.15, L 36.30; P2 Wx 11.10, −0.30, 15.10, 120.20, 1.00). Default: section A-A Ped 1 P = 120 + 0.75·60 = 165.00 K, Vx = 0.45·8 = 3.60 K.
- **How verified:**
  - DXF entities, origin/main vs branch, for the default, Seymour, "dir" and "rev": every existing entity of every sheet is identical (same order, coordinates, layers; same sheet scale and model-space offset). The only differences are the "n OF N" sheet numbers when the extra sheet is added, plus the new entities on the three new layers, all inside the drawing area.
  - `SharedDxf.validate` ok.
  - `tests/smoke/dxf-print-sheets.mjs --tool sf`: all ok (8 pages).
  - Deep diff over the 10 harness cases: R, P2, the dashboard and the Report identical, 0 errors.
  - `node tests/check-syntax.mjs`; `tests/smoke/spread-footing-scroll.mjs`.
  - The printed PDFs of the plan sheet (default and Seymour), the default PEDESTAL LOADS sheet and Seymour section B-B checked by eye.
- **Saved data:** none (the remembered sheet `sfd_dwgSheet_v1` may now also hold `loads`; an unknown id falls back to the first sheet as before). **Other copies:** none.

### Open items
- A very large schedule (many pedestals × load cases) on the extra sheet is not split; it is flagged by the existing "does not fit the sheet" marker.

## 2026-11-05 — PR: claude/sf-ped-combo-loads (PR #768: https://github.com/mlococo88/All-Structural/pull/768) — Load Combinations 2.6: pedestal loads by combination, worked (SFPC; display only, no result change)

### SFPC. Card 2.6 "Pedestal Loads by Combination (at Top of Pedestal)", its Report subsection, and links from the 3D view and the drawings   [display only]
- **Request (engineer, CLAUDE.md §6):** the per-pedestal combined loads quoted in the 3D labels (SF3L) and on the section sheets (SFDL) were not worked anywhere.
- **Where:**
  - New `sfdPedCb(p,f)` (after `renderCombos`, anchor `/* SFPC (2026-11-05, engineer; CLAUDE.md §6)`): P, V_x, V_y, M_x, M_y of a pedestal = Σ γ_i·Q_i over `TYPES` (γ_i = `f[type]`, Q_i = the entered `p.loads[type]`), with its terms; direct mode the envelope as entered. New `sfdPcSel`, `sfdPcSub`, `renderPedCb(b)`, `SFPC_SYM`.
  - `renderCombos`: after 2.5, `renderPedCb(secPanel(T,'o-cb-ped','2.6  Pedestal Loads by Combination (at Top of Pedestal)'));`. The card has:
    - the Bearing / Stability selector (`comboSelectorBar('asd',…)`, the same `SEL`; the default is the governing service combination, and an LRFD pick there shows that LRFD combination, reference only);
    - for the combination shown, one row per pedestal × component: the symbolic terms γ_type·Q_type, the substitution, the value;
    - an open "All … combinations × pedestals" table (service, then LRFD reference; governing in bold, the one shown shaded). Direct mode: the envelope only.
  - `sfdLrPick`: after `syncSelTo3D('asd');` the card is re-rendered, so a pick in Bearing, Stability or the card moves all of them, and the 3D view.
  - `SFD_LINKS`: `'o-cb-ped':['tab-combos','2.6 Pedestal loads by combination']`. `v3dTitle`: "see 2. Load Combinations" (tab link) → "worked in " + `sfdLink('o-cb-ped','')` (opens the card); the old click handler is removed.
  - Drawings `sfdwBuild`: `sfdlV` now calls `sfdPedCb` (same sums: verified, every DXF entity unchanged). Section sheets: a second line under the loads note, `PER-PEDESTAL VALUES WORKED IN: LOAD COMBINATIONS TAB 2.6 / CALC REPORT "PEDESTAL LOADS BY COMBINATION"`.
  - Report: new `sfdPcReport(M)` after `sfdLrReport` in `renderReport`. It adds the subsection "Pedestal loads by combination (at top of pedestal)" (key `S-pcb`) at the end of "Loads and combinations": the governing service combination worked per pedestal and component (Σ γ_i Q_i, substituted; zero components not listed), and the table of every combination × pedestal. Include box "Pedestal loads by combination" in the Report bar (`sfxControls` / `sfxWire`, `data-sfx="pcb"`). The card is marked `sfPcRef` and skipped by `sfxWalk` (as `sfLrRef`), so the Report has one copy.
  - State: new field `pedCbRpt` (default `true` in `defaultState`; `migrateState` backfills `true` for saves without it, as `lrRefRpt`). Additive; no existing key or field changed.
- **Governing provision:** none (display). The factors are the existing ASCE 7-16 §2.4.1 / §2.3.1 combination factors (`genCombos`); nothing new is computed for the checks.
- **Decisions (pending engineer review):** the card shares the Bearing / Stability selection (`SEL`) rather than having its own, so all of them stay in step; the 3D selector stays local (SF3L). The Report works the governing service combination, as the rest of the Report. The Include box is saved with the project like the LRFD reference box (default on).
- **Check case (Seymour, governing D + 0.75L + 0.45(+Wx) + 0.75S, Ped 2):** P = 1.00·15.90 + 0.75·11.50 + 0.45·11.10 = 29.52 kip; V_y = 1.00·0.50 + 0.75·0.50 + 0.45·15.10 = 7.67 kip; M_x = 1.00·31.50 + 0.75·35.20 + 0.45·120.20 = 111.99 kip-ft (the card, the Report and the earlier 3D / drawing checks agree). Default, governing, Ped 1: P = 1.00·120 + 0.75·60 = 165.00, V_x = 0.45·8.00 = 3.60.
- **How verified:**
  - Deep diff, origin/main vs branch, all 10 harness cases: `R`, `P2` and the dashboard identical; 0 console / KaTeX errors.
  - Report text: with the Include box off, identical to main. With it on (default), only added lines (the new subsection, appended at the end of its section; 0 lines removed or changed).
  - DXF of default / Seymour / dir: only the new note line per section sheet added; `SharedDxf.validate` ok.
  - Sync script: card pick → `SEL`, Bearing selector and 3D follow; Bearing LRFD pick → card shows it; the 3D title link opens tab 2 card 2.6.
  - `node tests/check-syntax.mjs`; `tests/smoke/spread-footing-scroll.mjs`.
- **Saved data:** one new additive field `pedCbRpt` (backfilled); nothing else. **Other copies:** the same Σ γ·Q sum remains inline in the 3D view's `buildLoads` (`pedLoads`), unchanged.

### Open items
- none.


## 2026-11-05 — PR: claude/sf-wall (PR #769: https://github.com/mlococo88/All-Structural/pull/769) — Element type per pedestal: Pedestal (default) / Wall; wall-foundation dowel minimum per ACI 318-19 16.3.4.2 → 11.6.1 (SFWL; calculation option, default = no change)

### SFWL. "Element type: Pedestal (default) / Wall"   [calculation option; CLAUDE.md §4]
- **Request (engineer, RISAFoundation reconciliation of the Seymour project):** a Wall type per pedestal. The dowel minimum follows the wall rule. Two-way shear and the pedestal-only checks are stated for a wall. No full wall design.
- **Provisions read in the ACI 318-19 PDF (paraphrased):**
  - **2.3, "wall":** a vertical element with a horizontal length-to-thickness ratio greater than 3.
  - **16.3.4.1:** column or pedestal to foundation: A_s across the interface ≥ 0.005A_g.
  - **16.3.4.2:** wall to foundation: the vertical reinforcement crossing the interface satisfies 11.6.1.
  - **11.6.1:** applies where in-plane V_u ≤ 0.5φα_cλ√f′c A_cv. Minimum ρ_l and ρ_t then per Table 11.6.1. The limits need not be met where adequate strength and stability are shown by analysis (not used).
  - **Table 11.6.1, cast-in-place, deformed bars, minimum ρ_l:**
    - No. 5 and smaller, f_y ≥ 60 000 psi: 0.0012;
    - No. 5 and smaller, f_y < 60 000 psi: 0.0015;
    - larger than No. 5: 0.0015.
  - **11.5.4.3:** α_c = 3 for h_w/ℓ_w ≤ 1.5, 2 for ≥ 2.0, linear between.
  - **11.5.4.4:** net axial tension: α_c = 2(1 + N_u/(500A_g)) ≥ 0.
  - **2.2 notation:** A_cv = the gross area bounded by the web thickness and the length of section in the direction of the shear (walls). ρ_l = distributed longitudinal reinforcement / the gross area perpendicular to it.
  - **11.6.2** (where 11.6.1's condition is not met): ρ_l ≥ max(Eq. 11.6.2, 0.0025). The printed condition of 11.6.2 in this copy reads "≤", the same as 11.6.1, so its condition could not be confirmed from the PDF. Not implemented; see the decisions below.
  - **Also read:** 22.6.4.1 (two-way critical sections at edges or corners of columns, concentrated loads or reaction areas: no exemption for walls); 13.2.7.1 / Table 13.2.7.1 (critical section at the face of a concrete wall); 11.5.3 / Table 11.5.3.2 (k = 2.0 for a wall not braced against lateral translation); 11.5.5.1 (out-of-plane shear per 22.5); 11.7.2.1, 11.7.2.3, 11.7.3.1, 11.7.4.1 (detailing).
- **Where:**
  - Input: Pedestals & Loads card, "Element type" (`peds[i].elemType`, `'pedestal'` default / `'wall'`). `newPed` sets `'pedestal'`. `migrateState`: `if(p.elemType!=='wall')p.elemType='pedestal';`.
  - New `sfdWallInfo(i,p,combos,fc,fy,lam)` (anchor `/* ---- SFWL (2026-11-05, engineer)`):
    - applied only where elemType is 'wall', h > 0 and ℓ_w/t > 3 (ℓ_w = the longer plan side, t = the shorter);
    - per LRFD combination: in-plane V_u (the applied shear along ℓ_w), N_u = P_u at the interface, α_c, and the limit 0.5·0.75·α_c·λ·min(√f′c, 100)·A_cv;
    - ρ_l from Table 11.6.1 with the dowel bar size;
    - AsMin = ρ_l·A_g where the condition holds in every combination, else 0.005A_g (today's value).
    - New `sfdWallTxt(w,html)` holds the statements.
  - `computePhase2` bearing (anchor `const AsDowMin=`). Before: `const AsDowMin=0.005*Ag;`. After: `const wall=sfdWallInfo(i,p,combos,fc,fy,lam); const AsDowMin=wall.applied?wall.AsMin:0.005*Ag;` (`wall` returned).
  - `sfdDowelCheck` (anchor `o.Ag=A;o.AsMin=`). Before: `o.AsMin=0.005*A;`. After: `o.AsMin=(bz.wall&&bz.wall.applied)?bz.AsDowMin:0.005*A;o.wall=…;o.rhoMin=…;`.
  - Display (wall only, except where noted):
    - Report: concrete-bearing topic steps ℓ_w/t, α_c, the 11.6.1 condition, and the dowel minimum ρ_l·A_g. The dowel A_s,min step and the Footing Design (2e) block use ρ_l.
    - Report pedestal subsection: "(wall, …)" title and the statement note. Punching: a note.
    - Footing Design 5.5 / 5.6 notes. Pedestal Design: a note per wall; 6.1 Class "Wall"; the 1 % note quotes the dowel minimum in effect (same number for a pedestal).
    - 3D info box: Class "Wall".
    - Dashboard: "Dowel steel" text names the wall rule. New REVIEW chip "Wall checks (ACI 318-19 Ch. 11)" whenever a pedestal is set to Wall. The Report result-row references follow.
- **Check case (Seymour Platform Foundation, f′c = 3000 psi, Ped 1 set to Wall):** Ped 1 is 2.67 × 9.833 × 7.25 ft, 32 #6 continuous into the footing, f_y 60 000 psi.
  - ℓ_w = 118.00 in (along y), t = 32.04 in, ℓ_w/t = **3.68 > 3**: a wall.
  - h_w/ℓ_w = 87.0/118.0 = 0.737, so α_c = 3.0.
  - A_cv = A_g = 32.04·118.00 = 3780.6 in². Limit = 0.5·0.75·3.0·1.0·54.77·3780.6/1000 = **232.96 kip**. In-plane V_u = 0 (Ped 1 carries no shear along y). 11.6.1 applies.
  - Dowels #6 (larger than No. 5): ρ_l = 0.0015.
    - Before: A_s,min = 0.005·3780.6 = **18.90 in²**. Provided 32·0.44 = 14.08 in², D/C 1.343, "Dowel steel" **FAIL**, "Dowels (tension, laps)" Ped 1 **NG** (A_s,gov 18.90 > 14.08).
    - After: A_s,min = 0.0015·3780.6 = **5.67 in²**, D/C 0.403, **PASS**. Ped 1 dowels OK. Ped 2's ℓ_dh failure is unchanged.
  - Dashboard: 4 NG → 3 NG. New REVIEW "Wall checks".
  - Ped 2 set to Wall as well: ℓ_w/t = 37.99/32.00 = 1.19 ≤ 3, not a wall. Pedestal treatment kept, with a REVIEW note.
  - Path where 11.6.1 is not met (default project, Ped 1 made 1.5 × 6 ft, direct V_y = 120 kip): limit = 0.5·0.75·3·63.25·(18·72)/1000 = 92.21 kip < 120. The column rule 0.005·1296 = 6.48 in² is kept (REVIEW: 11.6.2 not computed).
- **How verified:** headless Chromium, origin/main 8d103e0 vs the branch, pinned libraries.
  - Deep diff of `R` and `P2` on the 10 harness cases plus Seymour at 3 ksi: only the new fields (`bearing[].wall` {sel: false}, `dowels[].wall` false, `dowels[].rhoMin` 0.005). Report text and dashboard identical.
  - Wall cases (Seymour Ped 1; Seymour Ped 1 + Ped 2; default with a 1.5 × 6 ft wall; the direct-load case above): values as listed. 0 console errors, 0 KaTeX errors.
  - `node tests/check-syntax.mjs` and `tests/smoke/spread-footing-scroll.mjs` pass. Screenshots of the input, Pedestal Design note, Footing Design 5.6 and the Report steps checked by eye.
- **Saved data:** new field `peds[i].elemType`. Absent = 'pedestal' = today's behaviour. No key or format change.
- **Other copies:** none.
- **Decisions (pending engineer review):**
  1. **Two-way shear is kept for a wall (conservative).** The brief asked to state it as not applicable along a wall's length and use one-way shear. ACI 318-19 22.6.4.1 has no wall exemption that could be confirmed, so punching is still computed and gates. A note states that the footing one-way check at d from the wall faces (Table 13.2.7.1) is the wall's governing footing shear.
  2. **The pedestal checks are kept as a conservative stand-in, not marked N/A.** They are the P–M of the section, ties 25.7.2, crossties 25.7.2.3, one-way shear by 22.5 and the k = 2 slenderness screen. The wall statements cite the corresponding Chapter 11 provisions. A REVIEW chip lists the wall checks the tool does not compute: in-plane shear 11.5.4, the wall's own ρ_l / ρ_t (11.6), spacing 11.7.2.1 / 11.7.3.1, and two layers above 10 in (11.7.2.3).
  3. **Where 11.6.1's condition is not met, 0.005A_g is kept.** Table 11.6.1 is used only where in-plane V_u ≤ 0.5φα_cλ√f′c A_cv in every LRFD combination. Otherwise the column rule stays (REVIEW), because 11.6.2 is not computed (it needs ρ_t, and its printed condition could not be confirmed).
  4. **Wall geometry and inputs.** Wall only where ℓ_w/t > 3 (2.3); otherwise the pedestal treatment stays, with a REVIEW note. ℓ_w = the longer plan side. h_w = the pedestal height h. N_u = P_u at the interface. √f′c is capped at 100 psi in the 11.6.1 limit (conservative). ρ_l is taken with the dowel bar size.

## 2026-11-05 — PR: claude/sf-dowel-legend (PR #770: https://github.com/mlococo88/All-Structural/pull/770) — Card 5.6: status legend and dowel-minimum formula follow each element's basis (pedestal 0.005A_g / wall ρ_l A_g); hook-in-compression citation 25.4.9.1 → 25.4.1.2; "ℓ_d reduction for excess A_s" input moved to the Reinforcement tab (SFML; display only, no result change)

### SFML-1. Card 5.6 legend: only the statuses that occur, the dowel minimum per element   [display only]
- **Where:** `renderFootDes` card 5.6 (anchor `const bb=secPanel(T,'o-fd-bear'`). New helpers before `/* SFSF: shear friction at the pedestal / footing interface (worked) */`: `sfdDowMinBasis(z)`, `sfdDowMinKinds()`, `sfdDowMinTex()`, `sfdDowMinRef()`, `sfdBearLegend(seen)`.
  - Before: `bb.appendChild(el('div','note','Status legend: <b>OK</b> = bearing stress, dowel area and dowel development all satisfy code; <b style="color:#b71c1c">BEARING NG</b> = … <b style="color:#b71c1c">DOWELS &lt; MIN</b> = provided dowel area is below the 0.005A<sub>g</sub> minimum of ACI 318-19 16.3.4.1; … <b>PATCH</b> = …'));` (static, every status listed).
  - After: the row loop records `seen.push([status,bz]);` and the note is `sfdBearLegend(seen)`: a general line (one status per element, the first check not met in the order bearing, L_dc, dowel area), the dowel minimum of the elements in the table (0.005A_g column / pedestal, 16.3.4.1; ρ_l A_g wall, 16.3.4.2 → 11.6.1, Table 11.6.1; both, with element names, when both occur; "kept for a wall where 11.6.1 does not apply" for a Wall where SFWL keeps the column rule), then only the statuses present in the table.
  - Basis test: `z.wall&&z.wall.applied&&z.wall.t1161` → wall rule, the same condition SFWL uses to set `AsDowMin` (and `sfdDowelCheck` `rhoMin`).
- **Problem:** the legend quoted 0.005A_g (16.3.4.1) for every element, also for a Wall whose minimum is ρ_l A_g (SFWL), and listed statuses (BEARING NG, PATCH) that no row had.

### SFML-2. Card 5.6 formula line and reference   [display only]
- **Where:** card 5.6 eqBlock `'Bearing on concrete & dowels'`.
  - Before: ref `'ACI 318-19 22.8.3.2 / 16.3.4.1'`; line 2 `'A_{s,dowel,min} = 0.005 A_g,\\quad L_{dc} = …'`.
  - After: ref `'ACI 318-19 22.8.3.2 / '+sfdDowMinRef()` (16.3.4.1 and/or 16.3.4.2, 11.6.1, Table 11.6.1). Without a wall the line is unchanged. With a wall the minimum is on its own line (`A_{s,dowel,min} = \rho_{\ell} A_g` (wall), or both forms labelled column / pedestal and wall), and the ℓ_dc expression on the next line.
- **Report:** the Report's "As printed" copy of the Footing Design tab (`sfxWalk`) carries the new legend and formula lines; the worked Report steps (`cb<i>.dow`, `p<i>.AsMin`) already followed the basis (SFWL).

### SFML-3. Citation: hooks are not effective in compression → ACI 318-19 25.4.1.2   [code reference; CLAUDE.md §4]
- **Before / after:** "ACI 318-19 25.4.9.1" → "ACI 318-19 25.4.1.2" in: the card 5.6 warnbox "Dowel compression development not satisfied" (anchor `does not permit a hook to develop a bar in compression`); the dowel note `The 90° hook does not develop compression (ACI 318-19 …)`; the Reinforcement-tab dowel table header title (anchor `but not compression (25.4.`); the comment in `computePhase2` bearing.
- **Provision (read in the PDF):** 25.4.1.2 (printed p. 471): hooks and heads are not to be used to develop bars in compression. 25.4.9.1 (p. 487) only gives ℓ_dc = max(25.4.9.2, 8 in).
- **Check case:** none (text only); no value changes.

### SFML-4. "ℓ_d reduction for excess A_s" input moved to the Reinforcement tab   [layout; engineer request]
- **Where:** the row `<select data-path="mat.ldExcess">` moved from `#sec-mat` (Materials, after "Footing sides (cover)") to `#sec-rebar` (Footing Reinforcement), after "Outer bottom layer". Same `data-path`, options, hint and saved field (`state.mat.ldExcess`), same default and migration. The λ_s footing-shear checkbox (`mat.lamsFtg`) is a separate row and stays in Materials.
- User Manual 2.6 "Footing reinforcement": one sentence saying the option is on this tab.

### How verified
- Headless Chromium, origin/main b833fec vs the branch, pinned KaTeX 0.16.11 / Plotly 2.35.2 / three 0.160.0. Deep diff of `R` and `P2` and the dashboard text on 15 cases: the 10 harness cases (def, rev, sfe, sfe5, dir, sfe9, revEx, thin, revHook, edgeHook), Seymour at f′c = 3000 psi (sey3), Seymour with Ped 1 Wall (seyW), with both Walls (seyWW), the default with a 1.5 × 6 ft wall Ped 1 (defW), and the default with Ped 2 h = 0 and Ped 1 P_D = 2500 k (pb: BEARING NG and PATCH). **0 differences** in `R`, `P2` and the dashboard on every case. Report text: only the legend, the formula / reference lines and the citation change. 0 console errors, 0 KaTeX errors.
- `node tests/check-syntax.mjs` passes; `tests/smoke/spread-footing-scroll.mjs` passes.
- The moved select: changing it on the Reinforcement tab sets `state.mat.ldExcess`, `P2.dev.exOn` and the autosave.
- Screenshots of card 5.6 (seyW, defW, rev, pb) and of the Reinforcement input checked by eye.
- **Saved data:** no key or format change.
- **Other copies:** none.

### Open items
1. The dashboard chip and Report summary row are still named "Dowel steel (min 0.005A_g)" when a wall is present (the chip's value text and reference name the wall rule). The name is the lookup key of several maps (`sfdResultRows`, the Report summary "Worked in" map), so it was not renamed here.
2. The card 5.6 formula line shows ℓ_dc ≥ 0.0003f_y d_b but not the 8 in floor of 25.4.9.1(b); the computation and the Report step `p<i>.ldc` include it.
3. Dowel compression development, excess reinforcement (25.4.10.1): investigated, not implemented. See the PR description (code not clear enough for this case: 25.4.10.2(b), (c), (d) and R16.3.4).
## 2026-11-05 — PR: claude/sf-3d-dowel-hooks (PR #771: https://github.com/mlococo88/All-Structural/pull/771) (SFHK: dowel hooks and embedment in the 3D view and the section sheets; display only, no result change)

- **Problem:** the 3D view (tab 7) drew the pedestal vertical bars from the footing top up only, and drew "dowels" as a fixed placeholder: min(0.6 t, 1.2 ft) into the footing and min(h/2, 1.5 ft) up, straight, whatever the inputs. The selected hook, the embedment of card 5.6 and the lap of separate dowels were not shown. The section sheets (A-A, B-B) and the pedestal elevation drew the vertical bars straight down to the top of the bottom mat: no hook, and no separate dowels.
- **Where:**
  - New helpers before `sfdwDowelNote` (anchor `/* SFHK (2026-11-05): the dowel ends in the footing`): `sfdHookGeo(size)`, `sfdHookDir(x,y,ax,ay)`, `sfdHookPath(x,y,dir,zTop,zOut,size,hooked)`.
  - `sfdwBuild`: new inner `sfhkEnds(c,a,i,zTof,zTob)` just before `function section(dir){`. It is called in `section()` after the tie lines (anchor `sfhkEnds(c,a,i,t12,LV.topOfBot);`) and in the pedestal elevation before the `'ELEVATION'` title (anchor `sfhkEnds(ex,Lp.ax,i,0,-(t12-LV.topOfBot));`). It only adds S-REBAR LINE / ARC entities.
  - `buildRebar` (3D), pedestal loop.
    - Before: `uniq.forEach(([xx,yy])=>{const geo=new THREE.CylinderGeometry(db/2,db/2,p.h*0.98,8);…});`. After: when the bars act as the dowels (`P2.dowels[i].cont`), each bar is drawn as one path from 0.99 h down to the footing end via `sfdHookPath`. Otherwise it is drawn as before.
    - Before: `if(dwd>0&&dn>0){const per=uniq.slice(0,…);const embFt=Math.min(t*0.6,1.2);const embPed=Math.min(p.h*0.5,1.5);…}`. After: separate dowels (`!cont`, nD > 0) are drawn from the footing end up to the projection `Lprov`. The old placeholder is kept only where there is no dowel result (bearing patch, h = 0): `else if(!hk&&dwd>0&&dn>0){…}`.
- **Geometry (display only):**
  - 90° standard hook: straight extension 12 d_b beyond the bend (ACI 318-19 Table 25.3.1). Inside bend diameter per Table 25.3.2: 6 d_b for No. 3–8, 8 d_b for No. 9–11, 10 d_b for No. 14 and 18. Centre-line bend radius r = D/2 + d_b/2.
  - The outside of the hook rests at the available depth of card 5.6, `z.availEmb` = t − c_bot − d_b,x − d_b,y below the footing top (the top of the bottom mat). The tail centre line is d_b/2 above it. A straight dowel ends at the same depth.
  - The drawings use `LV.topOfBot`, which is the same level: cvB + d_b,y + d_b,x.
- **Decisions (pending engineer review):**
  1. **Tail direction: toward the pedestal centre.** Bars on a face point normal to that face, and corner bars point diagonally. This follows ACI 318-19 18.13.2.3 for column bars hooked in a foundation. The tool and drawings had no convention before. In a small pedestal, tails from opposite faces pass the centre and overlap. They are drawn as such.
  2. **2D sections:** each hook is drawn in its true shape in the plane of the section, including corner bars, whose real tails are diagonal.
     - The existing vertical-bar lines are unchanged: new entities only. They still run straight to the top of the bottom mat, so for a hooked bar a short straight stub (r + d_b/2) shows below the start of the bend.
     - With separate dowels, the existing vertical-bar line still runs into the footing as on main. The new dowel line is drawn beside it.
     - Both points are left for the engineer to decide (changing the existing lines changes existing DXF entities).
  3. **Separate dowels:** drawn in contact with the vertical bars on the inside, offset (d_b,long + d_b,dowel)/2 toward the centre, from the footing end up to the projection `Lprov` (the lap; for full-height dowels h − cover).
     - In 3D, where the dowel count differs from the vertical-bar count, the dowels are spread evenly round the perimeter just inside the bars, starting from a corner. The calculation smears their area over the bar positions (SFDA); this is not changed.
     - The 3D vertical bars of a pedestal with separate dowels still start at the footing top (as before).
- **Check case:**
  - Default project, #8 continuous, hooked: d_b = 1.000 in, D = 6.000 in, r = 3.500 in, tail 12.000 in. availEmb = 25.00 in.
    - Tail centre line 24.50 in below the footing top.
    - Bend starts 21.00 in below the top.
    - Tail end 3.50 + 12.00 = 15.50 in from the bar axis toward the pedestal centre.
  - Seymour Ped 1, #6: d_b = 0.750 in, D = 4.500 in, r = 2.625 in, tail 9.000 in. availEmb = 19.25 in.
    - Tail centre line 18.875 in below the top.
    - Bend starts 16.25 in below.
    - Tail end 11.625 in from the bar axis.
- **How verified (headless Chromium, origin/main b833fec vs the branch):**
  - Deep diff of `R` and `P2` on all 10 cases of the Spread Footing harness: 0 differences. Report text and dashboard identical. 0 console errors, 0 KaTeX errors.
  - DXF on 7 harness cases plus Seymour:
    - every existing entity is identical and in the same order;
    - sheet ids, scales and offsets are unchanged;
    - only S-REBAR LINE / ARC entities were added (e.g. revHook: 6 on A-A, 12 on B-B, 6 per pedestal elevation);
    - `SharedDxf.validate` passes on all.
  - Tests: `node tests/check-syntax.mjs` (all files), `tests/smoke/spread-footing-scroll.mjs` and `tests/smoke/dxf-print-sheets.mjs` pass.
  - 3D screenshots were checked by eye: default, Seymour, revHook (separate hooked dowels) and rev (separate straight dowels).
- **Saved data:** none.
- **Other copies:** none.
- **Open items:** the existing vertical-bar lines in the 2D sections and the elevation (decision 2) are left as they were.

## 2026-11-05 — PR: claude/sf-2d-hook-stubs (PR #772: https://github.com/mlococo88/All-Structural/pull/772) (SFHS: vertical-bar lines in the sections and pedestal elevation end at the hook / the footing top; display only, no result change)

- **Problem:** after SFHK (#771), the existing vertical-bar lines in the sections A-A / B-B and the pedestal elevation still ran straight to the top of the bottom mat. This left two errors:
  - for hooked bars that act as the dowels, a stub (r + d_b/2) below the start of the bend;
  - with separate dowels, the vertical bars drawn into the footing beside the dowels.
- **Engineer's direction (2026-11-05):** fix both. The "existing entities unchanged" rule protected the views, not wrong lines.
- **Where:** `sfdwBuild`.
  - New inner `sfhkBarBot(i,zTof,zTob)`, just before `function sfhkEnds`. It returns the lower end of the vertical-bar line:
    - bars act as the dowels, hooked: zTob + d_b/2 + r (where the hook arc starts, `sfdHookGeo`);
    - separate dowels (nD > 0): zTof, the footing top, where the vertical bars start and the lap with the dowels begins (the 3D view already starts them there);
    - otherwise (straight continuous bars, no dowels, bearing patch, no dowel result): zTob, as before.
  - Section, before: `[c-a,c+a].forEach(xb=>D.line(L.bar,xb,LV.topOfBot,xb,t12+hh-Lp.cov));` After: `…D.line(L.bar,xb,sfhkBarBot(i,t12,LV.topOfBot),xb,t12+hh-Lp.cov)…`.
  - Elevation, before: `[ex-Lp.ax,ex+Lp.ax].forEach(xb=>D.line(L.bar,xb,-(t12-LV.topOfBot),xb,hh-Lp.cov));` After: `…D.line(L.bar,xb,sfhkBarBot(i,0,-(t12-LV.topOfBot)),xb,hh-Lp.cov)…`.
- **Entities changed:** only the start (lower) point y of these S-REBAR vertical-bar LINEs. Their x, their upper point, the entity count, order and layers, and every other entity are unchanged. Per case (DXF dump, main 535c69a vs branch):
  - **default:** 10 lines: A-A #5, #6, #21, #22; B-B #5, #6; each pedestal elevation #21, #22. Each moves up by 4.000 in (#8: d_b/2 + r = 0.5 + 3.5).
  - **Seymour:**
    - A-A #5, #6 and B-B #5, #6: +3.000 in (#6: 0.375 + 2.625);
    - B-B #26, #27: +4.000 in (#8);
    - Ped 1 elevation #45, #46: +3.000 in;
    - Ped 2 elevation #29, #30: +4.000 in.
  - **revHook / rev (separate dowels):** 10 lines move up by 19.250 in (= availEmb, top of the bottom mat → footing top): A-A #5, #6; B-B #5, #6 and #27/#28 (#23/#24 in rev); elevations #43, #44 and #29, #30.
  - **sfe:** separate dowels at Ped 1 (+25.000 in); hooked continuous #8 at Ped 2 (+4.000 in).
  - **edgeHook, thin, dir:** as default (+4.000 in).
- **How verified:**
  - Entity-by-entity DXF comparison on 7 harness cases plus Seymour: only the listed LINE start points differ. `SharedDxf.validate` passes on all.
  - Results deep diff of `R` and `P2` on all 10 cases: 0 differences. Report and dashboard identical, 0 console errors.
  - `node tests/check-syntax.mjs` and `tests/smoke/dxf-print-sheets.mjs` pass.
  - Printed PDFs (Print all sheets) for default, Seymour and revHook checked by eye: no stub below the hooks; with separate dowels only the dowels enter the footing.
- **Saved data:** none.
- **Other copies:** none.


## 2026-11-05 — PR: claude/sf-ldc-bearing (PR #773: https://github.com/mlococo88/All-Structural/pull/773) — Dowel compression development ℓ_dc required only for compression beyond the concrete bearing strength, ACI 318-19 16.3.1.2(a) (SFBC; pass / fail logic change)

### SFBC. ℓ_dc check only where P_u exceeds the concrete bearing strength   [pass / fail logic; CLAUDE.md §4]
- **Engineer (2026-11-05):** approved. Per 16.3.1.2(a), the dowels must transfer only the compression that exceeds the concrete bearing strength. Where concrete bearing carries P_u in every combination, ℓ_dc is shown as "not required" (OK / N/A), not NG. Unchanged: tension development, hooked ℓ_dh, shear friction (22.9.5.1) and the minimum area (16.3.4.1 / 16.3.4.2).
- **Provisions (read in the PDF):**
  - 16.3.1.2 (printed pp. 222–223): reinforcement, dowels or connectors transfer (a) compression exceeding the lesser of the concrete bearing strengths of the supported member and the foundation (22.8), and (b) any calculated tension.
  - 16.3.3.4 (p. 223): B_n is the lesser of the bearing strengths of the supported member and the foundation surface.
  - 25.4.1.1 (p. 471) and 13.2.8.2 (p. 196): the calculated force is developed.
- **Where:**
  - `computePhase2`, concrete bearing (anchor `const ldcOK=isPatch?true:(Ldc<=availEmb);`).
    - Before: `const ldcOK=isPatch?true:(Ldc<=availEmb);`
    - After:
      ```
      const phiBsup=0.65*0.85*fc*A1/1000, phiBgate=Math.min(phiPn,phiBsup);
      const ldcReq=!isPatch&&PuMax>phiBgate+1e-9;
      const ldcOK=isPatch?true:(!ldcReq||Ldc<=availEmb);
      ```
      New fields `ldcReq`, `phiBsup`, `phiBgate`.
  - Display:
    - Card 5.6: the L_dc cell reads "(not req.)"; the legend explains it; a note lists any element where ℓ_dc would not fit but is not required.
    - Card 5.6 dowel table and its step (1): "not required: P_u ≤ …, concrete bearing carries P_u (16.3.1.2(a))".
    - Dashboard chip "Dowel development (ℓdc)": N/A "not required: concrete bearing carries P_u (16.3.1.2(a))" where no element needs it. A mixed case lists both. The Report row D/C uses only the elements that need it (n/a where none do).
    - Report: new step `cb<i>.ldcq`, P_u,dow = max(0, P_u − min(φB_n, 0.65·0.85f′c A_1)). Steps `cb<i>.ldc` and `p<i>.ldc` carry no pass/fail flag where ℓ_dc is not required.
    - User Manual: checks table row "Dowel development (ℓdc)" and the 4C.4 text. The old text said a shortfall was "flagged REVIEW"; it has been NG since #716.
  - The drawings' "(NG)" on the embedment note follows `ldcOK` (no drawing code touched).
- **Decision (pending engineer review): the gate uses the lesser bearing strength, the conservative choice.** 16.3.1.2(a) uses the lesser of the supported member's and the foundation's bearing strengths. The tool has one f′c, so the pedestal's own bearing is φ0.85f′c A_1 with √(A_2/A_1) = 1. The gate is therefore min(φP_nb (footing, card 5.6), 0.65·0.85·f′c·A_1), not the footing value alone.
- **Check case (Seymour, f′c = 3000 psi, Ped 1 Wall), Ped 2:**
  - Inputs: 32.00 × 37.99 in, A_1 = 1215.90 in²; 16 #8 continuous, hooked; t − c − d_b,x − d_b,y = 19.25 in.
  - Pedestal bearing: 0.65·0.85·3000·1215.90/1000 = **2015.35 k**. Footing φP_nb = 2024.26 k. Lesser = 2015.35 k.
  - P_u,max = 54.05 k, so P_u,dow = max(0, 54.05 − 2015.35) = **0**.
  - ℓ_dc = 0.02·1.000·60000/(1.0·√3000 = 54.77) = 21.91 in > 19.25 in.
  - Before: **L_dc NG**; dashboard "Dowel development (ℓdc)" **FAIL** (D/C 1.14).
  - After: **not required**; card 5.6 status OK; chip **N/A**. Verdict: 3 → 2 FAIL.
  - **Still governing for Ped 2:** "Dowels (tension, laps)" FAIL. There is interface tension in 8 of 9 combinations (A_s,req = 2.93 in²), and the hooked ℓ_dh = 23.90 in > 19.25 in.
  - Ped 1 (wall): 148.92 ≤ min(6270.79, 6266.33) → not required (16.43 ≤ 19.25, was OK).
- **Default project:**
  - Ped 1: P_u 240.81 ≤ min(1432.08, 716.04). Ped 2: 318.81 ≤ 716.04.
  - Not required (ℓ_dc 18.97 ≤ 25.00 in before, PASS). The chip goes PASS (D/C 0.76) → N/A.
- **"thin" (t = 8 in):** ℓ_dc 18.97 > 3.00 in available for both pedestals. Before NG (FAIL), after not required (N/A).
- **"pb" (Ped 1 P_D = 2500 k):** P_u 3500.95 > min(1432.08, 716.04), so P_u,dow = 2784.91 k and ℓ_dc is checked as before (18.97 ≤ 25.00 OK).
- **How verified:**
  - Headless Chromium, origin/main c3db2bc vs the branch, pinned libraries. Deep diff of `R` and `P2` on 15 cases (the 10 harness cases, sey3, seyW, seyWW, defW, pb).
  - The only changed value is `P2.bearing[].ldcOK`, false → true: sey3 / seyW / seyWW Ped 2 and thin Ped 1 and Ped 2. The new fields are `ldcReq`, `phiBsup`, `phiBgate`.
  - Report: 0 KaTeX errors, 0 console errors. `node tests/check-syntax.mjs` and `tests/smoke/spread-footing-scroll.mjs` pass. Card 5.6 and the dashboard were checked by eye (Seymour).
- **Saved data:** no change. **Other copies:** none.
- **Open item (raised, not changed):** the concrete bearing check itself (card 5.6, `dcr = PuMax/phiPn`) uses the footing's φ0.85f′c A_1√(A_2/A_1) only. 16.3.3.4 takes B_n as the lesser of the supported member and the foundation, and with one f′c the pedestal's 0.85f′c A_1 governs whenever √(A_2/A_1) > 1. Default project: DCR 318.81/1432.08 = 0.22 vs 318.81/716.04 = 0.45. Needs the engineer's decision (pedestal f′c may differ in practice; the tool has one f′c).

## 2026-11-05 — PR: claude/sf-ex-asmin (PR #774: https://github.com/mlococo88/All-Structural/pull/774) — Excess-reinforcement option (25.4.10.1) for footing bars: A_s,req = A_s,min where the 0.0018A_g minimum governs, instead of no reduction (SFEM; calculation option, default off = no change)

### SFEM. ℓ_d reduction with A_s,req = A_s,min where the minimum governs   [CLAUDE.md §4; supersedes the SFEX block (#727)]
- **Engineer (2026-11-05):** approved. Where the 0.0018 minimum governs A_s,req, use A_s,req = A_s,min in the ratio instead of blocking the reduction. Straight bars only; the hook exclusion (25.4.10.2(d)) stays. The option stays off by default.
- **Provisions (read in the PDF, printed pages):**
  - 25.4.10.1 (p. 487).
  - 25.4.10.2 (pp. 487–488).
  - R25.4.10.2 (p. 488): no factor where full-f_y anchorage is required. Its examples are shrinkage and temperature reinforcement per 24.4.3.4 and the integrity provisions.
  - 24.4.1 (p. 461): S&T reinforcement is the steel perpendicular to the flexural reinforcement.
  - 8.6.1.1 / R8.6.1.1 (p. 110): the 0.0018A_g is the *minimum flexural* reinforcement. It has the same area as 24.4.3.2 but is flexural steel near the tension face. 7.6.1.1 is the same for one-way.
  - 13.3.3.1 (p. 197): two-way isolated footings → Ch. 7 and 8.
  - So R25.4.10.2's S&T example does not cover the footing's flexural minimum. The #727 block was more conservative than the code requires.
- **Where:** `sfdDevAll` (anchor `const AsFlex=top?des.reqTop:des.reqBotFlex`).
  - Before: `const AsReq=top?Math.max(des.reqTop,des.AsMinPerFt):des.reqBot, AsProv=m.As, rEx=(flexGov&&AsProv>0)?Math.min(1,AsReq/AsProv):1;`
  - After: `const AsReq=flexGov?(top?Math.max(des.reqTop,des.AsMinPerFt):des.reqBot):des.AsMinPerFt, AsProv=m.As, rEx=(AsProv>0)?Math.min(1,AsReq/AsProv):1;`
  - ℓ_d,red = max(ℓ_d·A_s,req/A_s,prov, 12 in) as before (25.4.2.1(b)). Hooks unchanged: no reduction of ℓ_dh.
  - Display:
    - Report step `<q>ldx`: worked with A_s,min, citing R8.6.1.1 and R25.4.10.2.
    - Footing Design 5.4: equation line and note.
    - Input hint; dashboard / Report reference; the `sfdDevAll` header comment.
- **Check case revEx (option on; #7 epoxy @ 8 in bottom, #6 @ 8 in top, t = 24 in, A_s,min = 0.0018·12·24 = 0.518 in²/ft):**
  - **Bottom x (#7):** flexure 0.037 < 0.518, so A_s,min governs.
    - Before: no reduction, ℓ_d 29.88 in.
    - After: ℓ_d,red = max(29.88·0.518/0.900, 12) = **17.21 in** > 15.00 available. Still NG; hooked ℓ_dh 18.35 > 15.00 → **FAIL unchanged**.
  - **Bottom y (#7):** flexure 0.599 governs, 19.87 in. Unchanged, PASS.
  - **Top x (#6):** flexure 0.0007, so A_s,min governs.
    - ℓ_d,red = max(29.03·0.518/0.660, 12) = **22.80 in** (before 29.03) > 15.00. Still REVIEW (hook: ℓ_dh 14.56 ≤ 15.00).
  - **Top y (#6):** flexure 0.399 < 0.518.
    - ℓ_d,red = **22.80 in** (before 29.03) ≤ 35.00. PASS, D/C 0.829 → **0.651**.
  - These equal the values before #727 (SFEX), since A_s,req = max(flexure, A_s,min) again.
- **Other cases with the option on:**
  - Default project ("defEx", #8 @ 9 in, A_s,min 0.648, A_s,prov 1.053): ℓ_d,red 28.46 → 17.51 in. Bottom x still FAIL (ℓ_dh 18.69 > 12.00). Bottom y D/C 0.791 → 0.486.
  - Seymour 3 ksi with the option on ("seyEx"):
    - bottom x 34.51 → 19.88 in, still FAIL (> 11.00, ℓ_dh 19.56);
    - top y 33.52 → 26.33 in, D/C 0.959 → 0.753.
- **How verified:**
  - Headless Chromium, origin/main fe9b9f4 vs the branch, deep diff of `R` and `P2` on 17 cases (15 as in SFBC plus defEx and seyEx).
  - **Option off (default and every case without it):** only the stored informational `P2.dev.rows[].rEx` and `LdEx` move, where A_s,min governs (e.g. default rEx 1 → 0.615, LdEx 28.46 → 17.51). `LdUse`, `dc` and every status are unchanged. Dashboard and Report text are identical.
  - **Option on (revEx, defEx, seyEx):** `rEx`, `LdEx`, `LdUse` and `dc` move as listed. No status changes.
  - 0 console / KaTeX errors. `node tests/check-syntax.mjs` and `tests/smoke/spread-footing-scroll.mjs` pass. Card 5.4 (revEx) checked by eye.
- **Saved data:** no change (same `mat.ldExcess`, default off). **Other copies:** none.

## 2026-11-05 — PR: claude/sf-bearing-lesser (PR #775: https://github.com/mlococo88/All-Structural/pull/775) — Concrete bearing at the pedestal–footing interface: φB_n = the lesser of the footing and the pedestal, ACI 318-19 16.3.3.4 / Table 22.8.3.2 (SFBL; calculation change)

### SFBL. Interface bearing strength = lesser of footing and pedestal   [CLAUDE.md §4]
- **Engineer (2026-11-05):** approved the open item of #773.
- **Provisions (read in the PDF, printed pages):**
  - 16.3.3.4 (p. 223): at the contact surface, B_n is calculated per 22.8, and it is the lesser of the concrete bearing strengths of the supported member and the foundation surface.
  - 22.8.3.2 and Table 22.8.3.2 (p. 429): B_n is
    - (a) √(A_2/A_1)(0.85f′c A_1), or (b) 2(0.85f′c A_1), the lesser of the two, where the supporting surface is wider on all sides than the loaded area;
    - (c) 0.85f′c A_1 in other cases.
  - φ = 0.65 (as before).
- **Where:** `computePhase2`, concrete bearing (anchor `const phiPnFtg=`).
  - Before: `const phiPn=0.65*0.85*fc*A1*conf/1000;`
  - After:
    ```
    const phiPnFtg=0.65*0.85*fc*A1*conf/1000;
    const phiBsup=0.65*0.85*fc*A1/1000;
    const phiPn=isPatch?phiPnFtg:Math.min(phiPnFtg,phiBsup);
    const brgGov=isPatch?'footing':(phiBsup<phiPnFtg-1e-9?'pedestal':(phiPnFtg<phiBsup-1e-9?'footing':'both'));
    ```
    - New fields: `phiPnFtg`, `brgGov`. `dcr = PuMax/phiPn` follows.
    - The SFBC gate `phiBgate = min(phiPnFtg, phiBsup)` is the same value as `phiPn`, so the two stay consistent.
  - Display (governing side named):
    - card 5.6: φP_nb column "(pedestal)" / "(footing)" / "(equal)"; the formula line is min(footing, pedestal) with the refs 16.3.3.4, Table 22.8.3.2; the √(A_2/A_1) note;
    - Report: steps `cb<i>.phiF` (footing), `cb<i>.phiP` (pedestal), `cb<i>.phiPn` (lesser, with the governing side). The `cb<i>.ldcq` step uses φB_n directly;
    - dashboard chip "Concrete bearing": "DCR = x (Ped n, pedestal side governs)", with the reference;
    - User Manual checks table and 4C.4.
- **Decision (pending engineer review):** a bearing patch (h = 0) has no supported concrete member, so it keeps the footing value.
- **Effect:** with one f′c, the pedestal governs whenever √(A_2/A_1) > 1. Bearing capacity is lower and the result is more conservative; DCR rises by up to 2×.
- **Check case, default project** (18 × 18 in pedestals, A_1 = 324.0 in², f′c = 4000 psi, √(A_2/A_1) = 2.00 at the code ceiling):

  | | Before | After |
  |---|---|---|
  | Footing φB_n | 0.65·0.85·4000·324.0·2.000/1000 = **1432.08 k** | same |
  | Pedestal φB_n | — | 0.65·0.85·4000·324.0/1000 = **716.04 k** |
  | Ped 2 (P_u 318.81 k) DCR | 318.81/1432.08 = **0.22** | 318.81/716.04 = **0.45** |
  | Ped 1 (P_u 240.81 k) DCR | 0.17 | 0.34 |

  The chip reads "DCR = 0.45 (Ped 2, pedestal side governs)", PASS.
- **Check case, Seymour (f′c 3000 psi):**
  - Ped 2: A_1 = 1215.90 in², √(A_2/A_1) = 1.004 (footing edge). Footing 2024.26 → pedestal 0.65·0.85·3000·1215.90/1000 = **2015.35 k**. DCR 54.05/2024.26 = 0.0267 → 54.05/2015.35 = **0.0268**.
  - Ped 1: 6270.79 → 6266.33 k; DCR 0.02375 → 0.02377.
- **Other cases:**
  - review: Ped 1 6576.96 → 5940.48 k (DCR 0.0144 → 0.0160); Ped 2 3111.68 → 2263.04 k (0.0164 → 0.0225).
  - sfe: Ped 1 3818.88 → 2864.16 k (0.111 → 0.147).
  - pb: Ped 1 1432.08 → 716.04 k, DCR 2.44 → 4.89 (already NG).
- **How verified:**
  - Headless Chromium, origin/main b4beecb vs the branch. Deep diff of `R` and `P2` on 17 cases.
  - The only values that move are `P2.bearing[].phiPn` and `.dcr`, wherever √(A_2/A_1) > 1. Unchanged elements: edgeHook Ped 2 (√ = 1, at the edge) and the pb patch (Ped 2).
  - New fields: `phiPnFtg`, `brgGov`. `phiBgate`, `ldcReq` and every pass/fail status are unchanged on all cases.
  - 0 console / KaTeX errors. `node tests/check-syntax.mjs` and `tests/smoke/spread-footing-scroll.mjs` pass. Card 5.6 (default) checked by eye.
- **Saved data:** no change. **Other copies:** none.

## 2026-11-05 — PR: claude/sf-toscale (PR #776: https://github.com/mlococo88/All-Structural/pull/776) — Every geometric drawing on the result tabs to scale: one scale across and up for the footing, t and the pedestals (SFTS; display only, no result change)

### SFTS. Drawings to scale (engineer, 2026-11-05: "review all graphics in the output tabs and make sure each is drawn to scale"; extended to the input side, the Report copies and the User Manual)
- **Audit (headless Chromium, rendered px per ft measured from the drawn rectangles, across vs up; ratio 1.00 = to scale).** Projects: default (10 × 8 × 2.5 ft), Seymour (5 × 13 × 2 ft, pedestals 7.25 ft), cases.json `rev` (5 × 13), and a wide check case (16 × 5 × 1.5 ft, pedestals 5 ft).

  | Graphic | Before (default / Seymour / wide) | After |
  |---|---|---|
  | 1.1 Plan schematic (SVG) | 1.00 / 1.00 / 1.00, pedestals true | 1.00 (unchanged; a plan with L > 1.5 B may now be 560 px tall, was 420) |
  | 1.2 Section schematic (SVG) | 1.00 (B, t, D_f, pedestal b × h) | unchanged |
  | 3.2 Base pressure sections x / y (SVG) | t: 0.83, 0.67 / 0.52, 1.00 / 1.00, 0.69 (t capped at 70 px); pedestals a fixed 12 px stub: h at 0.03–0.18 | 1.00 (t and full pedestal h); pressure ordinates to their own scale with a ksf scale bar |
  | 3.2 Heat map (Plotly, x vs y in ft) | 1.00 (`scaleanchor`) | unchanged |
  | 3.2a Contact-zone map (canvas) | 0.95 / 0.94 / 0.98 (plot height 0.72·L/B·440 px) | 1.00 (pixel scan ±1 px) |
  | 4.3 Overturning free-body (SVG, title said "to scale") | t: 0.87 / 1.00 / 1.00 (capped at 90 px); pedestals a fixed 14 px stub: 0.06–0.17 | 1.00; weight-arrow lengths stay indicative (labelled) |
  | 5.2 / 5.3 Flexure plan (SVG) | 1.00 | unchanged (may grow to 380 px tall when the plan is long across the bending direction; span dimension clear of the title) |
  | 5.2 / 5.3 One-way shear elevation (SVG, title said "to scale") | t 1.00 (cap 120 px not reached); pedestals a fixed 18 px stub: 0.05–0.25 | 1.00 |
  | 5.5 Punching plan (SVG) | 1.00 | unchanged |
  | 5.5 Punching elevation (SVG) | depth at 0.50 of the width scale; "45°" lines at 1.15–1.29 run/rise; d drawn over the full slab | 1.00; 45° lines over d; slab = t; pedestal a stub cut by a break line (true width) |
  | Plotly DCR, FS, V/M, P–M charts | not lengths on both axes (P–M already equal-aspect in k-ft) | unchanged |
  | Report copies | clones of the tab drawings with a viewBox (aspect kept, 1.00) | follow the tabs |
  | 3D view; Drawings | camera aspect follows the canvas; DXF full size, viewBox `meet` | confirmed, unchanged |
  | Input panel, User Manual | no geometric figures | — |

- **Where** (all in `Spread Footing.html`):
  - New helpers before `function planSVG(){`: `SFTS_GH` (300 px, the most an elevation's footing + pedestal geometry may take), `sftsPedH()` (tallest pedestal), `sftsNice()`, `sftsScaleNote(W,y,sc,qsc,txt)` (a ft scale bar, and a ksf bar for pressure ordinates).
  - `pressureBlockSVG` → `profile()` (anchor `const tPx=R.t*sc;                         // thickness at the same scale`).
    - Before: `const sc=(W-padL-padR)/B; … const tPx=Math.min(R.t*sc, 70); const slabTop=padT+16, …`; pedestal `height="12"`.
    - After: `const hp=sftsPedH(), sc=Math.min((W-padL-padR)/B, SFTS_GH/(R.t+hp));` the footing centred (`X0`), `tPx=R.t*sc`, `slabTop=padT+16+hp*sc`, pedestal height `p.h*sc`; the end q values beside the ordinates; `sftsScaleNote(W,H-22,sc,qsc)`; `H=slabBot+134` (was +120).
  - `overturningSVG` (anchor `const nArm=go.r.verts`): same scale rule; `slabTop=Math.max(150,weightTop+24+hp*sc)`; pedestal height `p.h*sc` (was 14); `H=Math.max(slabBot+124,slabBot+16+nArm*12+50)` so every stacked arm row and the legend fit (was `slabBot+110`); scale line "arrow lengths indicative".
  - `onewaySVG` (anchor `SFTS (2026-11-05): one scale for span, t and pedestal h (geometry at most SFTS_GH px tall; was: t capped at 120 px`): same scale rule; `slabTop=Math.max(96,40+hp*sc)`; pedestal height `p.h*sc` (was 18); t dimension at the footing edge (`X0-10`); "shear area" label inside the slab.
  - `punchingSVG` elevation (anchor `SFTS (2026-11-05): elevation at one scale`):
    - Before: `const esc=(W-2*pad)/(c1*1.5); … ebot=etop+Math.max(34,tin*esc*0.5);` lines from the pedestal faces to ±c₁/2 at the slab bottom.
    - After: `const esc=Math.min((W-2*pad)/((c1+d)*1.1), 150/tin); … ebot=etop+tin*esc, edd=etop+d*esc, EH=ebot+64;` 45° lines from the faces to depth d, critical section at ±c₁/2 over d, d and t labelled inside the drawing (the d label used to be cut off at the left edge), pedestal label beside the stub (it was under the P_u arrow).
  - `contactZoneMap` (anchor `const cvW=440, scU=`):
    - Before: `const cvW=440,cvH=Math.round(440*L/B*0.72)+64; … const scX=plotW/B, scY=plotH/L;`
    - After: `scU=Math.min((cvW-padL-padR)/B, 640/L)`, `cvH=Math.round(L*scU)+padT+padB`, `scX=scY=scU`.
  - `planSVG`: `(420-2*pad)/L` → `((L>1.5*B?560:420)-2*pad)/L`. `flexureSVG`: `padT` 52 → 62, `scY=(other>1.5*B?380:182)/other`, `H=Math.max(300,padT+padB+other*sc)` (was 290 fixed).
- **Decisions (pending engineer review):**
  - Elevations show the pedestals at full height. When the footing + tallest pedestal would exceed 300 px at the width scale, the whole elevation is drawn at the smaller scale (narrower), not distorted. Seymour x-section: 32.4 px/ft (was 67.2 across, 35 up).
  - The punching elevation is a local detail in inches: the pedestal is shown cut by a break line (true width, height not drawn), and the slab is a strip with the footing's ends not shown.
  - Load arrows (section 1.2, overturning weights) and pressure ordinates are quantities, not geometry: they keep their own lengths, labelled ("arrow lengths indicative"; ksf scale bar).
  - The 3.2 heat map is already equal-aspect and is not changed (another PR is adding corner labels to it).
  - The contact-zone canvas is screen only (not in the Report), as before.
- **Check case (default, 3.2 x-section):** B = 10 ft, t = 2.5 ft, pedestals 1.5 × 2 ft. Width scale (440 − 104)/10 = 33.6 px/ft; height limit 300/(2.5 + 2) = 66.7 px/ft; sc = 33.6 px/ft. Slab 336 × 84 px (before 336 × 70); pedestals 50.4 × 67.2 px (before 50.4 × 12).
- **How verified:**
  - Results: headless Chromium, origin/main vs the branch, deep diff of `R` and `P2` plus the dashboard and Report text on 12 cases (cases.json + Seymour + wide): 0 differences, 0 console / KaTeX errors.
  - Scale: rendered px per ft measured across and up for every drawing on 4 projects (table above); Report figures: rendered box vs viewBox 1.00.
  - `node tests/check-syntax.mjs`, `tests/smoke/spread-footing-scroll.mjs`, `tests/smoke/phone-layout.mjs --tool sf` pass. Before/after screenshots of each changed drawing looked at (default, Seymour).
- **Saved data:** none. **Other copies:** none.

## 2026-11-05 — PR: claude/sf-corner-pressures (PR #777: https://github.com/mlococo88/All-Structural/pull/777) — Bearing-pressure heat map labels the four footing-corner pressures; corner-pressure worked lines and table in 3.2 and in the Report (SFQC; display only)

- **What:** the base-pressure heat map (Bearing tab, card 3.2, Plotly `plot-heat`) labels each footing corner with its pressure, e.g. "q₁ = 7.03 ksf", or "q₃ = 0 (no contact)" where the corner is off the soil under partial contact. Card 3.2 gets a worked block and a table of the four corner pressures, with a "Worked in" link under the heat map. The Report (section Bearing, "Base pressure (governing combination)", key S-bp) gets the same table. The heat-map figure printed in the Report carries the labels.
- **Values:** no new calculation. Every number is the solver's own `bp.corners` (`solveBearing`), the plane the heat map draws:
  - full contact: `q0l + gxl*x + gyl*y`, where q0 = ΣP/A, g_x = 12ΣP e_x/(L B³) = M_y/I_y, g_y = 12ΣP e_y/(B L³) = M_x/I_x. The table splits it into ΣP/A, M_y·x/I_y = g_x·x and M_x·y/I_x = g_y·y.
  - partial contact: `Math.max(0, q0 + gx*x + gy*y)` with the Newton-solved no-tension plane (q0, g_x, g_y). The table shows q0, g_x·x, g_y·y, the unclamped sum and q.
  - Corner order (as in `solveBearing`): q₁ (+B/2, +L/2), q₂ (−B/2, +L/2), q₃ (−B/2, −L/2), q₄ (+B/2, −L/2).
- **Where (anchors):**
  - New, before `function pressureBlockSVG(bp,r){`: `SFQC_PTS`, `SFQC_SUB`, `sfqcRows(bp)` (rows from `bp.corners` and `bp.plane`), `sfqcName`, `sfqcTxt`, `sfqcFit(id,B,L)` (label placement), `sfqcCard(bp,r)` (card 3.2 block, id `o-br-corners`).
  - `renderBearing`, before `const hm=el('div','plot');hm.id='plot-heat';`: `const qc=(bp.mode==='full'||bp.mode==='partial')?sfqcCard(bp,r):null;if(qc)b1.appendChild(qc);`; after it: `if(qc)b1.appendChild(sfdWorkedIn([['o-br-corners','corner labels q₁…q₄',['tab-bearing','3.2 Footing-corner pressures']]]));`
  - `renderPlots`, heat map: `const qcAnn=(sfqcRows(hv?hv.bear:hs.bear)||[]).map(...)` added; layout `yaxis:{title:'y (ft)'}}` → `yaxis:{title:'y (ft)'},annotations:qcAnn}`; after the `sfpPlot('plot-heat',…)` call: `sfqcFit('plot-heat',B,L);`.
  - `sfrModel`, Bearing: `items:[bearItem,{type:'note',…` → `items:[bearItem,...sfqcReport(bp,r),{type:'note',…`. New `sfqcReport(bp,r)` before the `/* SFLR (2026-11-04)` comment.
- **Decision (pending engineer review):**
  - Labels sit just inside each corner. Where the footing is too narrow on the plot for two labels side by side (e.g. Seymour, 5 × 13 ft), they sit just outside its left and right edges, if the plot has room there. Otherwise they go inside, on two lines. All placements stay inside the plot area and clear of the colour scale. The placement is chosen when the plot is drawn. A later window resize keeps the labels anchored to the corners but does not choose a new placement.
  - "No contact" is shown only under partial contact, for a corner where the solved plane is ≤ 0. A full-contact corner at exactly q = 0 (kern index 1.00) reads "0.00 ksf".
  - The SVG elevation sections under the heat map are cuts through the centroid (movable by slider), not edges, so their end values are not corner pressures. They are not labelled.
  - In the near-uniaxial partial-contact case, card 3.2 also shows the closed-form triangle q_max. The corner table shows the solver's plane values (the same values as q_max used by the checks and by the heat map). In the cases run, the two agree to 0.01 ksf (sfe9: 8.02 both).
  - The Report table is for the governing service combination (the S-bp section). The tab and the heat map follow the selected combination (ASD or LRFD reference), as before.
- **Governing provision:** none changed. This is the rigid-footing linear pressure distribution q = P/A ± M_y x/I_y ± M_x y/I_x, which the tool already uses.
- **Check case, default project, governing D + 0.75L + 0.45(+Wx) + 0.75S:** ΣP = 434.94 k, B × L = 10 × 8 ft, e_x = 0.488 ft, e_y = 0.
  - A = 80.00 ft², I_y = 8·10³/12 = 666.67 ft⁴, M_y = 434.94·0.4883 = 212.40 kip-ft.
  - ΣP/A = 5.437 ksf; M_y·x/I_y = 212.40·5/666.67 = 1.593 ksf.
  - q₁ = q₄ = 5.437 + 1.593 = **7.03 ksf** (= q_max); q₂ = q₃ = 5.437 − 1.593 = **3.84 ksf** (= q_min).
- **How verified:**
  - Headless Chromium, origin/main 36712c9 vs the branch, 11 cases (the 10 of the Spread Footing case set plus the Seymour project file). Deep diff of `R` and `P2`: 0 differences. The dashboard text is identical. 0 console / KaTeX errors.
  - Report text: only added lines (the new table, steps and note, plus the tab's worked lines that the "As printed" part copies). No line removed.
  - On all 199 combinations with a pressure solution (ASD and LRFD, all cases): max of the four corners === `bp.qmax`, min === `bp.qmin` (full contact) or q_min = 0 (partial contact), and each corner value equals the heat-map value at that grid corner (exact equality).
  - `node tests/check-syntax.mjs` and `tests/smoke/spread-footing-scroll.mjs` pass. Screenshots checked: default, Seymour (ASD governing, LRFD), the Seymour-based review case partial-contact rows (ASD 0.6D + 0.6(±Wx), LRFD), sfe9 (one-way uplift, two corners off), and a 620 px wide window.
- **Saved data:** no change. **Other copies:** none.

## 2026-11-05 — PR: claude/sf-report-order (PR #778: https://github.com/mlococo88/All-Structural/pull/778) (SFRO: Report sections in the design order, "As printed" copies and LRFD reference tables in appendices; SFCB: Report copy of the 3.2 heat-map colour bar filled; display only, no result change)

### SFRO — Report order
- **Problem (engineer):** in the printed Report, sections out of order / placed after unrelated material. Found on origin/main (Seymour, f′c 3000 psi, Ped 1 Wall; default; direct; all Include boxes on):
  - "Pedestal loads by combination" (#768) printed as §3.6, after the Load Combinations tab copy §3.5 "As printed";
  - "Reference: LRFD combinations" (#757) printed after the Results lines (§4.6 after §4.5 Results — Bearing; §5.5 after §5.4 Results — Stability), i.e. reference-only tables after the checks' result lines;
  - each "As printed" copy (#732) between the worked checks and the result lines (§1.3, §2.7, §3.5, §4.4, §5.3, §6.10, §7.3);
  - concrete bearing / shear friction / dowels at the interface (#773/#775) inside "Footing design" (§6.5–§6.7), between punching and the band / cover checks;
  - the Summary first and "Assumptions and warnings" after the pedestal design; the User manual (Include box) inserted before References, so References moved §9 → §10 with the box;
  - inside the As printed copies, bare tab-card numbers read as this report's §: "§4.3a" and "§4.3" (Stability copy; Report §4.3 = "Bearing, every combination"), "Section 2.3" (Bearing copy), "Section 3.2" (Bearing copy, Vesić), "§5.6" (Footing and Pedestal copies). No [[key]] link was unresolved (0 on every case) and no duplicate key.
- **Where:** new `sfroOrder(M)`, `sfroCard`, `sfroCards`, constants `SFRO_IFC`, `SFRO_CARD`, `SFRO_AP`, inserted before the anchor `/* the report bar's Include box: the manual`. Called last in `renderReport()`:
  - Before: `try{M=sfdPcReport(sfdLrReport(sfxApply(sfrModel())));}`
  - After: `try{M=sfroOrder(sfdPcReport(sfdLrReport(sfxApply(sfrModel()))));}`
  The functions before it find their sections by title, so their output is unchanged; `sfroOrder` only moves sections / subsections. shared/report.js regenerates every § number and [[key]] link.
- **New order:** 1 Project and inputs · 2 Assumptions and warnings · 3 Loads and combinations (pedestal loads by combination last) · 4 Bearing · 5 Stability · 6 Footing design · 7 Pedestal–footing interface: bearing, shear friction and dowels (`S-ifc`; the `S-cbr`, `S-sf`, `S-dow` subsections and their result lines, split from "Results — Footing design" by check name) · 8 Pedestal design · 9 Summary of results · 10 References · part "Appendices": Appendix: the result tabs as printed (`S-axP`, one subsection per tab, `S-axP0`…`S-axP6`) · Appendix: LRFD reference tables (`S-axL`, Include box) · User manual (Include box). §1–§10 no longer move with the Include boxes.
- **Pointers:** each section whose copy / LRFD tables moved gets a one-line section note "Moved to the appendices: … in §x.y" (a link). In the appendix, a bare tab-card number becomes "card n.m", linked where `SFRO_CARD` maps it (2.3 → S-asd, 4.1–4.5 → S-st, 4.3a → S-ecc, 5.2/5.3 → S-fdx/S-fdy, 5.5 → S-pun, 5.6 → S-cbr). Code citations (ACI / ASCE / IBC / AASHTO / Table / Art.) are left alone.
- **Decisions (pending engineer review):**
  - The As printed copies move whole to the appendix. They hold the tab figures (pressure surface, contact-zone map, diagrams) and some tables shown nowhere else; they are linked from each section. Alternative: keep the figures in the sections.
  - The Summary of results moves to §9 ("drawings and summary" in the requested flow). Moving it back to the front is a one-line change in `sfroOrder`. The drawing sheets are not part of the Report (Drawings tab); the plan / elevation stays in §1.
  - Assumptions and warnings stays a section of its own, right after the inputs (basis).
  - Within a subsection the item order is unchanged (lead notes / warnings stay first).
  - Interface order kept: concrete bearing, shear friction, dowels (the Report's order; on screen card 5.6 shows dowels before shear friction). Tab cards are not reordered.
  - "Worked in: … → Load Combinations · 2.3 …" lines in the copies name the tab, so they are left as printed.
- **Removed:** nothing. No true duplicate: `sfxWalk` already drops a table / step / note whose numbers and sentences the Report has. Renamed: the 9 subsection titles "As printed: tables, equations, notes and figures" → "<section> (<tab> tab)", "Reference: LRFD combinations" → "Bearing — …" / "Stability — …".

### SFCB — colour bar of the 3.2 heat map unfilled in the Report
- **Problem:** the Report copy of a Plotly chart (`sfxPlotSvg`) and of a tab SVG kept the element ids. Plotly fills the colour bar with `url("#<gradient id>")`, and the original (in the hidden Bearing tab) came first in the document. The copy painted no gradient. Same on main before #777 (572f79f), so this is not a #777 regression. In print the Report tab's own copy is hidden, so the print box needs fresh ids again.
- **Fix:** `sfxUniq(html)` and `sfxUniqDom(root)` (anchor `let SFX_UID=0;`) give every id referenced by `url(#id)` a new suffix. They are used in `sfxPlotSvg` (`return sfxUniq('<svg …'+…+'</svg>')`), on the `svg` figure clone in `sfxWalk` (`svg:sfxUniq(c.outerHTML)`), on the beforeprint print box (`sfxUniq(SharedReport.html(...))`), and in place on the box `SharedReport.print` filled (beforeprint, `if(sfrPrinting()){…sfxUniqDom(b);return;}`). § anchors are not touched (they are not `url()` targets).
- **Check:** default project: screen copy gradient id is unique in the document (1, was 2). The print box gradient is unique and inside the box. The colour bar prints filled (screenshot).

### How verified
- Headless Chromium, origin/main vs the branch:
  - Deep diff of `R` and `P2` on the 10 cases of the session case set: 0 differences.
  - Report text: every line of main's text is present in the branch's, apart from § / heading numbers and the 9 renamed subsection titles, on 6 cases (default, Seymour wall, direct, all Include on, Seymour + all Include, all Include off). Added lines: the section notes, the appendix headings and note, the interface Results heading.
  - 0 unresolved references, 0 duplicate keys, 0 console / KaTeX errors.
- Outline extracted from the on-screen model and from the Chromium PDF (contents page and body headings agree).
- `node tests/check-syntax.mjs`, `node tests/engine/run.mjs report`, `tests/smoke/spread-footing-scroll.mjs` pass.
- **Saved data:** no change (Include boxes keep `manPrint`, `lrRefRpt`, `pedCbRpt`). **Other copies:** none.

## 2026-11-05 — PR: claude/sf-report-figs (PR #779: https://github.com/mlococo88/All-Structural/pull/779) (SFRF: tab figures and unique tables back in their sections; Summary of results first; display only, no result change)
- **Engineer (on SFRO decisions):**
  - put the tab figures, and any table found nowhere else in the Report, back next to the worked check they illustrate. The appendix keeps only text and tables that duplicate worked sections;
  - put the Summary of results back in front.
- **Where:**
  - `sfxWalk`: each copied item records its tab card (`it._card={no,title}`). The card number is read from the card summary ("3.2a …"); unnumbered sub-cards ("Edge +x", "Resultant breakdown", the 5.6 headings) inherit it.
    - Before: `const push=it=>{if(topic){it.topic={title:topic,no:++ntp};topic=null;}out.push(it);};`
    - After: the same, plus `it._card={no:cno,title:card};`
  - New `SFRF_TAB`, `sfrfTarget(ti,card)` (card → subsection key / title prefix / pedestal label), and `sfrfMove(ap,secs)`, inserted before `function sfroOrder`.
  - `sfroOrder`:
    - calls `sfrfMove` after `sfroCards`;
    - updates the appendix note and the section notes ("the tab's other notes, equation lines and tables, as printed, in §x");
    - puts `sum` first: `M.sections=[sum,inp,asm,…,ref]`.
- **Rule:**
  - Every copied figure moves. A copied table moves when it has a number (or, roundings as `sfxApply`) or a cell text longer than 15 normalized characters that the Report's own text (all sections except the appendix copy) lacks.
  - A moved item goes to the end of its subsection, under a topic heading "<card title> [<tab> tab, card x.y]". It is numbered on from that subsection's own topics.
  - A figure keeps its caption, with "(<tab> tab, card x.y)" added.
  - What stays in the appendix: the notes and equation lines of the copies, and tables whose values the Report already shows. Topic headings are renumbered there.
- **Placement:**

  | Card | Goes to |
  |---|---|
  | 1.1 / 1.2 | Plan and elevation |
  | 1.3 | Pedestals and applied loads |
  | 1.4 | Geometry and materials |
  | 1.5 | Assumptions |
  | 2.1 / 2.2 | self-weights |
  | 2.3 | S-asd ("Resultant breakdown" → S-res) |
  | 2.4 | Bearing, every combination |
  | 2.5 | S-lrfd |
  | 2.6 | S-pcb |
  | 3.1 / 3.2 / 3.2a | S-bp ("Bearing Check …" → S-qa) |
  | 3.3 | S-qa |
  | 4.3a | S-ecc |
  | other 4.x | S-st |
  | 5.1 | design basis |
  | 5.2 | S-fdx |
  | 5.3 / 5.4 | S-fdy |
  | 5.5 | S-pun |
  | 5.6 | S-cbr / S-dow / S-sf (by heading) |
  | 5.7 | band |
  | 6.1 | first pedestal |
  | 6.k | the pedestal of that label |
  | dashboard | "Checks (as on the dashboard)" |

  An item with no target stays in the appendix.
- **Dropped:** none. No tab copy became empty, so nothing was dropped as a true duplicate.
- **Tables kept in the appendix as duplicates of worked sections** (every value already in the Report):

  | Project | Tables |
  |---|---|
  | default | 4.3 edge summary; 5.5 punching summary; 5.6 bearing summary; 5.6 shear-friction summary |
  | Seymour | 4.3 edge summary; 5.5 punching summary; two 5.6 shear-friction tables |

- **Decision (pending engineer review):**
  - the copies' notes and equation lines are text the Report does not otherwise show, so they stay in the appendix rather than being dropped;
  - the Summary is §1, before the project inputs.
- **How verified:**
  - Headless Chromium, origin/main vs branch:
    - deep diff of `R` and `P2` on the 10 session cases: 0 differences;
    - Report text on 6 cases (default, Seymour f′c 3000 + Ped 1 Wall, direct, all Include on, Seymour + all Include, all Include off): every line of the pre-#778 Report is present, apart from §/topic numbers, the renamed subsection titles and the card refs on moved headings and captions;
    - 0 unresolved references, 0 duplicate keys, 0 console errors.
  - Printed PDF (default and Seymour) looked at. The heat map with a filled colour bar is in 5.1, the overturning free body in 6.2 and the Summary on page 3.
  - `check-syntax`, `run.mjs report` and `spread-footing-scroll` pass.
- **Saved data:** no change.

## 2026-11-05 — PR: claude/sf-report-overview (PR #780: https://github.com/mlococo88/All-Structural/pull/780) (SFOV: "Overview of the footing" at the start of the Report — 3D snapshot, plan, elevation, cross sections; Include box "Overview figures"; display only, no result change)
- **Engineer:** right after the Summary of results, an overview of the footing. Contents: a 3D rendering at a fixed isometric camera and the default selection, a plan, an elevation and a cross section. Each has a caption, a scale or scale bar, and its dimensions. Include box "Overview figures", default on.
- **Where:**
  - New `SFOV`, `sfovBarFt`, `sfovSheetView`, `sfovSchem`, `sfovSnap3D` and `sfovReport`, inserted before `/* the report bar's Include box: the manual`.
  - `renderReport`:
    - Before: `M=sfroOrder(sfdPcReport(…))`
    - After: `M=sfovReport(sfroOrder(sfdPcReport(…)))`
  - The section §2 "Overview of the footing" (key `S-ov`) is inserted after "Summary of results".
- **Views used (choice):**
  - **3D:** the 3D View's own scene. It is rendered once more, off screen, by a second WebGLRenderer (1000 × 600, `preserveDrawingBuffer`) to a PNG.
    - Default selection: the governing service combination (direct mode: the envelope), every layer on, no cut, opacity 0.92, plain colour. If the live view differs, it is set to the default for the snapshot and then restored.
    - Camera: the Reset-view camera (az 0.9, el 0.5, r = 2.1 · max(B, L, D_f + 4)).
    - The load-label sprites are laid out for that camera (`v3dLayoutLabels` with the snapshot's camera and size), then for the live view again.
    - The image is cached until the inputs change (`JSON.stringify(state)`).
    - If three.js is not loaded, WebGL is not available, the render fails or the image is blank, a note replaces the figure ("3D view not included: <reason>").
    - The 3D View tab is initialised (hidden) if it has not been opened yet.
  - **Plan:** the Schematic tab's 1.1 plan (`planSVG`), to scale. A scale bar is added; its scale is read from the footing rectangle (width = B·sc).
  - **Elevation:** the Schematic tab's 1.2 elevation (`sectSVG`), to scale with one scale across and up, with a scale bar the same way. No plain elevation exists in the other direction; the B-B section covers it.
  - **Cross sections:** the Drawings tab's SECTION A-A and SECTION B-B views. These are the sheet views only: entities `i0 … iv`, without the post-placed load schedules, border or title block.
    - `sfdwBuild` / `sheet()` now records `iv` (anchor `const iv=D.mark();`). The sheets themselves are unchanged.
    - The views are dimensioned and carry their sheet scale text. Each gets a scale bar in model inches, and the caption says the view is reduced from its sheet scale.
  - The sheet plan was tried and dropped: its text is too small at report size.
- **Include box:** "Overview figures" (`data-sfx="ov"`), saved field `state.ovRpt`.
  - `defaultState` sets `ovRpt:true`, and `migrateState` sets `if(state.ovRpt===undefined)state.ovRpt=true;`.
  - A save without the field gets the overview (default on), like the other report boxes. Existing fields are unchanged.
- **Print:** the overview fills about 2 pages (3D + plan on the first; elevation and both sections on the second) for the default project and Seymour. The marker ids of the elevation copy are made unique (`sfxUniq`).
- **How verified:**
  - Headless Chromium, origin/main vs branch:
    - deep diff of `R` and `P2` on the 10 session cases: 0 differences;
    - Report text: every line of main present on 6 cases (only the overview lines are added, plus § renumbering);
    - 0 unresolved references, 0 console errors.
  - Printed PDF looked at, default and Seymour: 3D with labels, plan, elevation and A-A / B-B with their scale bars; the 5 ft bar matches the 5'-0" dimension of A-A.
  - three.js removed: a note replaces the 3D figure and the other figures remain.
  - `check-syntax` and `spread-footing-scroll` pass.
- **Saved data:** new field `state.ovRpt` (default true), migrated as above.

## 2026-11-05 — PR: claude/sf-report-input-echo (PR #781: https://github.com/mlococo88/All-Structural/pull/781) (SFIE: the Report's copy of the 1.4 Input Echo printed garbled; display only, no result change)
- **Engineer:** the printed Report for the Seymour project showed the input echo in §3.2 garbled:
  - the pedestal table's cells shifted (load-case rows: P under x, Vx under y, …; the D row's loads outside the table);
  - General Inputs had an empty fourth column and an unlabelled unit column.
- **Root cause:** the Report's tab copier `sfxWalk` (the tool's "As printed" walker, function `table`) read each `<tr>` as a flat list of its own cells and took only the first row as the header. It ignored `rowspan` and `colspan`:
  - the pedestal table's two-row header (`rowspan="2"` / `colspan="5"`) became one header row plus one body row;
  - the `rowspan` cells (pedestal, x, y, b×b×h, offset) exist only in each pedestal's first row, so every other load-case row was short by five cells and slid left;
  - General Inputs' title row (`<th colspan="4">`) became the header, so the columns had no names.
  - The tab's HTML is valid; the on-screen tab is not garbled (screenshot looked at) and is unchanged. `shared/report.js` is not involved (it renders the flat rows it is given) and is unchanged.
- **Other tables:** a search of the tool for `rowspan` / `colspan` / `rowSpan` / `colSpan` finds them only in `buildInputEcho`. No other table the Report copies (dashboard, result tabs, user manual) uses spans. The report-text comparison below confirms no other table changed.
- **Where / before → after:**
  - `sfxWalk`, inner `const table=t=>{`:
    - Before: header = `trs[0]` if every cell is `TH`; body = `cs.map(c=>cellOf(txt(c)))` per `<tr>`.
    - After: the table is read as its grid. A rowspan cell is repeated in each row it spans. A header of several rows becomes one row ("group: column"). A first row that is one heading over the whole table becomes the caption. A column empty in every row is left out. A table without spans reads as before.
  - `buildInputEcho`:
    - its General Inputs rows moved unchanged into a new `sfEchoGen()` (anchor `function sfEchoGen(){`), used by the tab and the Report;
    - the card's div gets `data-sfx-rpt="echo"`.
  - New `sfxEcho()` (anchor `function sfxEcho(){`). `sfxWalk` sends that card there (`if(e.matches('[data-sfx-rpt="echo"]'))`), with the tab's own values and formats, as three tables:
    - General inputs: Quantity | Value | Unit. The tab's note joins the quantity in brackets, and an empty unit prints "–".
    - Pedestal geometry: Pedestal | x | y | b_x × b_y × h | load offset e_x, e_y | element type (the `elemType` input).
    - Applied loads at top of pedestal: one row per pedestal and load type with a non-zero component, as the tab (a pedestal with none shows its D row). Direct mode: one "factored envelope (LRFD)" row per pedestal, labelled in the caption.
    - Each table is kept only if it adds to the Report, as for any copied table.
  - `sfrModel`, §"Pedestals and applied loads" pedestal table: new column "Element type" (pedestal / wall, the input), after "load offset".
- **Where the tables land (default and Seymour):**
  - General inputs: §3.2 (it has values the Report shows nowhere else, e.g. K_p, the self-weight).
  - Pedestal geometry and loads: the appendix §12.2. They repeat §3.5.
- **How verified:**
  - Headless Chromium, origin/main vs branch, 13 cases: the 10 session cases, the Seymour file, Seymour with every Include box on, and default with every Include box on.
    - deep diff of `R` and `P2`: 0 differences;
    - Report text: every number in the main Report is in the branch Report. The only changed lines are the echo copy and the §3.5 pedestal rows (new column).
    - 0 console errors.
  - Printed PDF looked at, default and Seymour: §3.2 General inputs, §3.5, and the appendix echo.
  - `check-syntax` and `spread-footing-scroll` pass.
- **Saved data:** no change.

## 2026-11-05 — PR: claude/sf-plan-marker, PR #809: https://github.com/mlococo88/All-Structural/pull/809 (SFPA: the plan schematic's B dimension gets its arrowheads; the marker it referenced was never defined; display only, no result change)

### SFPA. B dimension arrowheads in the plan schematic   [display only] [no result change]
- **Problem:** `planSVG` (Schematic tab card 1.1, and its copies in the Report: overview and §1) draws the B dimension with `marker-start="url(#a1)" marker-end="url(#a1)"`, but no marker `a1` is defined anywhere in the page. The dimension had no arrowheads, on screen or in print. This was found by the print-reference check of the Concrete Beam Capacity PR #807: every `url(#…)` in the printed Report must resolve inside its own figure, and only these two references failed in Spread Footing.
- **Fix (`planSVG`, the axis-triad block; anchor `<marker id="axg"`):**
  - Before: `s+='<marker id="axg" …><path d="M0,0 L7,3.5 L0,7 z" fill="#228822"/></marker></defs>';`
  - After: the same `axg` line without `</defs>`, then
    `s+='<marker id="a1" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse"><path d="M0,1 L7,4 L0,7 z" fill="#333"/></marker></defs>';`
  - `auto-start-reverse` points the start head outward as well.
  - The Report copies get their own id through the existing per-copy handling (SFCB `sfxUniq` / `sfxUniqDom`); nothing else changed.
- **How verified (headless Chromium, origin/main 22e987d vs branch, default project):**
  - `R` and the Report text: identical. 0 console errors.
  - Print-state reference check: 0 unresolved of 124 (main: the 4 `a1` references).
  - Screen screenshot of card 1.1, and the printed Report (p. 5, the plan) looked at: both arrowheads of B = 10.00 ft.
  - `check-syntax` and `spread-footing-scroll` pass.
- **Saved data:** none. **Governing provision:** none. **Other copies:** none.

## 2026-11-05 — PR: claude/github-sync (PR #808: https://github.com/mlococo88/All-Structural/pull/808) (GHS: saved projects copied to a private GitHub repository, pilot tool; storage only, no result change)
- **Engineer:** see the same saved projects on every device (GitHub; `docs/github-sync-setup.md`). Spread Footing is the pilot.
- **Where / before → after:**
  - After `<script src="shared/projects-ui.js"></script>`: new `<script src="shared/github-sync.js"></script>`.
  - PLIB block, `SharedProjectsUI.libraryDialog({…})`: after the `changed:` line, new `cloud:{tool:'spread-footing',label:'Spread Footing',fromFile:j=>{…}}`.
    Files on GitHub are `projects/spread-footing/<name>.json` = the tool's Export JSON (`JSON.stringify(state,null,1)`; the stored item is the
    state). `fromFile` refuses a file without `geom`, `soil` and `peds` (the test the tool's Import JSON uses) and otherwise stores it as it is;
    Open goes through the dialog's existing `open` (Object.assign(defaultState(), …), migrateState()).
- **Saved data:** `sfd_projects` and `sfd_auto` unchanged (key and format). With sync off nothing is written and no request is made.
  New keys only with sync on: `bridgeSuite.v1.githubSync`, `bridgeSuite.v1.githubSync.tool.spread-footing`.
- **How verified:** `node tests/smoke/github-sync.mjs` (13 checks, ALL PASS: sync off; Test connection; Upload all; the GitHub file
  byte-identical to a real Export JSON download; background save and Overwrite with sha; conflict copy; GitHub-only Open; offline queue;
  explicit cloud delete; token checks; 390 px). `node tests/smoke/project-library.mjs --tool spreadfooting` (origin/main vs branch,
  sync off): results and saved data identical. Screenshots looked at (dialog at 1400 and 390 px, settings dialog).
- **Formulas, factors, units, code references:** none.

## 2026-11-05 — PR: claude/header-sf (PR #810: https://github.com/mlococo88/All-Structural/pull/810) (SFHD: compact page header; title block and hand-off buttons moved to the Project input tab; display only, no result change)
- **Engineer:** clean up the top of the page: the title-block inputs and the hand-off / project buttons go into the Project input tab; the header keeps the title, a read-only project line and the global actions.
- **Where / before → after** (markup moved, not copied: every id, `data-path`, `onclick` and handler is the same):
  - Header (anchor `<div id="sfdHdr">`; before: `<div style="display:flex;justify-content:space-between;align-items:flex-start">`):
    - Before: title + by-line on the left; Auto-calculate, Re-analyze, Print-to-PDF Report on the right; then the `#titleblock` grid (6 inputs) and a button row (Use shared project info, Share project info, Pull from Steel Beam, Import hand-off (JSON), Pull from Abutment / SubLoads, Import hand-off (JSON)).
    - After: title + by-line on the left; on the right `#sfdHdrA`: "Project: <name> · <number>" (`#sfdHdrProj`, a link to the Project tab), Undo, Redo, Saved projects…, Auto-calculate, Re-analyze, Print-to-PDF Report. One row on a wide screen; under the title, wrapping, below 900 px.
  - Project tab, in order:
    - new `<details class="sec" id="sec-title">` "Title block": the `#titleblock` div moved here unchanged (same six inputs `meta.project`, `meta.number`, `meta.calcBy`, `meta.calcDate`, `meta.chkBy`, `meta.chkDate`); CSS `.titleblock` grid 6 columns → 2 columns, no border (it sits in a card);
    - `#sec-proj` Project Manager: unchanged except `#btnUndo` / `#btnRedo` moved to the header;
    - new `<details class="sec noprint" id="sec-xfer">` "Shared project info and hand-offs": the six buttons, their file inputs and the `#bxMrSrc` / `#bxFlSrc` source lines, in three groups with a one-line hint each (Project info; Support reactions (Steel Beam Design); Foundation loads (Abutment / Substructure Loading)). Button texts unchanged.
  - `SFD_IN_SEC`: `'sec-title':'project'` and `'sec-xfer':'project'` added (they were already placed on the Project tab, as nodes before the first mapped section).
  - Saved projects… button (PLIB wiring): `const ref=$('#btnDelProj')` → `const ref=$('#btnRedo')` (inserted after Redo in the header).
  - New `sfdHdrProjShow()` (anchor `function sfdHdrProjShow(){`): writes `state.meta.project · state.meta.number` (or "(untitled: enter it in the Project tab)") into `#sfdHdrProjTxt`; called at the end of `bindStaticInputs()` (load, import, undo, saved project, hand-off) and on `input` in `#titleblock`. A click on `#sfdHdrProj` opens the Project tab (`sfdSetInTab('project',true)`), opens the Title block card and focuses Project Name (below 900 px it scrolls to the card first). Nothing is stored.
- **Decision (pending engineer review):** Undo / Redo and Saved projects… are global actions, so they moved to the header with Auto-calculate, Re-analyze and Print; Save / Overwrite / Load / Delete / Export / Import / Reset stay in the Project Manager card.
- **Governing provision:** none (layout only).
- **Check case / how verified** (headless Chromium, origin/main vs branch, title fields typed: "Route 6 Bridge", "P-1234", "MJL", "2026-11-05", "ABC", "2026-11-06"):
  - `R` (all results), every localStorage key, the Report model `sfrModel()` (title block included) and the DXF text `sfdwBuild().D.toDXF()` (title block included): identical; every typed value is in the Report model and the DXF;
  - Share project info: `bridgeSuite.v1.projectMeta` identical (time stamp normalized); Use shared project info on a blank page fills the five shared fields;
  - reload on the saved autosave: the six fields and `R` identical;
  - header shows "Project: Route 6 Bridge · P-1234"; the link opens the Project tab with Project Name focused, page not scrolled at 1920 px;
  - `phone-layout --tool sf` (390, 768), `project-library --tool spreadfooting`, `spread-footing-scroll` (3 window sizes): pass; `check-syntax`: pass; 0 console errors;
  - screenshots before / after at 1920 and 390 px looked at.
- **Saved data:** no change (no key, field or format touched).

## 2026-11-05 — PR: claude/standard-save-spread-footing (PR #837: https://github.com/mlococo88/All-Structural/pull/837) (STDS PR 2, pilot) — the standard save: header chip + Save + Saved projects…, "Save and open" card, Save as, Ctrl+S   [display / save controls only; no result change]
- **Why:** engineer decision 2026-11-05 (standard save approved; Spread Footing is the pilot). Uses `SharedProjectsUI.projectBar` (shared/projects-ui.js, STDS PR 1).
- **Header (`#sfdHdrA`):** before: `Project: <title block name>` link · Undo · Redo · Saved projects… (PLIB) · Auto-calculate · Re-analyze · Print-to-PDF Report. After: chip `Project: <open saved project> ● saved / unsaved changes / not saved` (+ GitHub badge with sync on; click = Saved projects…) · Undo · Redo · **Save (Ctrl+S)** · Saved projects… · Auto-calculate · Re-analyze · Print-to-PDF Report. The old link `#sfdHdrProj` stays in the page with `hidden` (its updater `sfdHdrProjShow` unchanged); the title block is still edited in the Project tab.
- **Project tab:** the "Project Manager" card (after the title block) becomes **"Save and open"**, first in the tab: status line; Save · Save as… · Saved projects… · New; "File on this computer": Export JSON · Import JSON (the same `#btnExport` / `#btnImport` buttons and handlers, moved into the card); Reset Inputs (unchanged) on the third row; the two hint lines. Removed: the name box `#projName`, Save, Overwrite, the drop-down `#projList` with Load / Delete and their handlers (anchor `/* project manager */`). Delete is in Saved projects… only (it asks about the GitHub copy). Old note "Autosave is on. Projects and autosave are stored…" replaced by the standard hint lines.
- **Code:** the PLIB block (anchor `/* PLIB (2026-11-02): "Saved projects…" dialog`) replaced by the STDS block (anchor `/* STDS (2026-11-05): the standard save`): `projectBar({ store: mapStore(localStorage,'sfd_projects'), save: n => projSave(n), open: <old Load path without alert>, newProject: <Reset path without its confirm>, snapshot / snapOf (state as Open leaves it, keys sorted), exportFile, importFile, fileButtons: [#btnExport, #btnImport], extras: [#btnReset], cloud: <unchanged GHS ctx.cloud> })`. `refreshProjList()` returns when `#projList` is absent (`if(!sel)return;`). Import JSON goes through `SFPL.pb.importJSON()` (asks first on unsaved changes) and clears the open name after a file is read (`SFPL.pb.setCurrent(null)`): an imported file is not a saved project. `window.SFPL = { store, dlg, pb }` (was `{ store, dlg }`).
- **Behaviour changes (asked for):** Save no longer shows the alert "Saved "x"."; Save to the open name never asks; a new duplicate name at Save as is blocked with "Replace it"; Open / New / Import ask first when there are unsaved changes; Ctrl+S / Ctrl+Shift+S.
- **Saved data (§5):** `sfd_projects` ({ name: state }) and `sfd_auto` unchanged (same text written by `projSave` and `saveAuto`); GitHub file unchanged (Export JSON text); no new key.
- **Formulas, factors, units, code references:** none (§4 does not apply).
- **How verified:** main vs branch after the same input change (scratch script): results identical, localStorage keys identical (`sfd_auto` byte-identical), Export JSON text identical (3,482 chars), Report text identical (227,477 chars), no console errors beyond main. `node tests/smoke/project-library.mjs --tool spreadfooting` (save now through the standard Save as on the branch): ALL PASS. `node tests/smoke/github-sync.mjs` (whole sync flow, Save as + "Replace it" as the overwrite): 13 / 13. `github-sync-tools.mjs --tool spreadfooting`, `home-projects.mjs`, `home-sync.mjs`, `spread-footing-scroll.mjs`, `phone-layout.mjs --tool sf`: pass. 390 px: page 390 / 390, dialog 355 / 355 (no sideways scroll); screenshots looked at.
- **Decision (pending engineer review):** "New" (default inputs) and "Reset Inputs" do the same thing; Reset Inputs is kept on the third row (unchanged) so nothing the engineer used disappears. Remove it later if New is enough.

## 2026-11-06 — PR: claude/sf-start-chooser (PR #845: https://github.com/mlococo88/All-Structural/pull/845) (START) — start-of-session project chooser ("Recent projects" strip / Saved projects dialog at start)   [TRIAL in this tool only, pending engineer review; display only; no result change]
- **Why:** engineer: "try it with the Spread Footing app to see if I like it" (a non-blocking start chooser instead of a pop-up save / load screen at every start). Shared code: `shared/projects-ui.js` `startChooser` (see `fixlog/shared-projects.md`, START).
- **Where:** the STDS block (anchor `/* STDS (2026-11-05): the standard save`), in the `SharedProjectsUI.projectBar({...})` call, after `header:$('#sfdHdrA'),chipBefore:$('#btnUndo'),headerBefore:$('#sfdAcLbl'),card:$('#sfdSaveCard'),`. Before: no `start`. After (one property added):
  `start:{tool:'spread-footing',autosaveKey:'sfd_auto',after:$('#sfdHdr'),incoming:()=>{const X=window.BridgeXfer;if(!X)return false;return ['memberReactions','foundationLoads'].some(ch=>{if(!X.isNew(ch,'spreadFooting'))return false;let at=NaN;try{at=Date.parse(localStorage.getItem(X.NS+ch+'.updatedAt'));}catch(e){}return !(at<Date.now()-30*60000);});}},`
- **Behaviour:** with an autosave and saved projects, the "Recent projects" strip under the header (Continue / up to 5 Open buttons / All saved projects… / ×; closes on the first edit, Open or ×); no autosave + saved projects: the Saved projects dialog opens by itself; no projects: nothing; "Show this when the app opens" in the dialog (off by default) opens the dialog at every start instead.
- **Incoming data (how this tool receives it):** Spread Footing applies nothing on load: the hand-offs (memberReactions from Steel Beam Design, foundationLoads from the abutment calculator / SubLoads) are pulled by the user ("Pull from …", "Import hand-off (JSON)"), shown by the "new data available" marker; no page links to it with a #hash or ?query. **Decision (pending engineer review):** the chooser is not shown when such a hand-off was sent in the last 30 minutes and is not pulled yet (the user most likely opened the tool to pull it); an older unpulled hand-off does not suppress it (else the strip would never show for a user who ignores one). Also not with a URL #hash / ?query, in a frame, or while printing.
- **Saved data (§5):** `sfd_auto`, `sfd_projects` unchanged (only read at start); new keys `bridgeSuite.v1.projectsUI.spread-footing.startDialog` and `bridgeSuite.v1.projectsUI.spread-footing.start`.
- **Formulas, factors, units, code references:** none (§4 does not apply).
- **Check case:** six saved projects "Footing F1…F6" (B = 9…14 ft), autosave = Footing F3: strip "Continue: Footing F3 … Footing F6 · F5 · F4 · F2 · F1"; Open "Footing F5" from the strip = Open from Saved projects… (B = 13 ft; identical state, results and storage).
- **How verified:** see the PR (`tests/smoke/start-chooser.mjs`; main vs branch: results, state, Export JSON text, Report text and storage identical with four seeds).

## 2026-11-06 — PR: claude/reset-to-new-sf (PR #869: https://github.com/mlococo88/All-Structural/pull/869) (RSTN) — "Save and open" card: Reset Inputs removed (New does the same; display only, no result change)
- **Engineer:** remove Reset where New does the same (approved 2026-11-06). Closes the STDS decision above ("Reset Inputs is kept … Remove it later if New is enough").
- **Comparison (main):** Reset Inputs (`#btnReset` handler): `confirm('Reset all inputs to defaults? (Saved projects are kept.)')`, then `state=defaultState();bindStaticInputs();buildPedCards();saveAuto();recalc();`. New = projectBar `newProject:()=>{state=defaultState();bindStaticInputs();buildPedCards();saveAuto();recalc();}` (the same line, no confirm of its own: projectBar asks only on unsaved changes), then no saved project is open. Same inputs, results and autosave. Only differences: Reset Inputs always asked and left the open project's name in the chip (a following Save would have written the defaults over that saved project).
- **Where:**
  - Card `#sfdSaveCard`: `<button id="btnReset" class="danger">Reset Inputs</button>` removed.
  - projectBar call: `fileButtons:[$('#btnExport'),$('#btnImport')],extras:[$('#btnReset')],` → `fileButtons:[$('#btnExport'),$('#btnImport')],`.
  - Handler `$('#btnReset').addEventListener('click',()=>{ if(!confirm('Reset all inputs to defaults? (Saved projects are kept.)'))return; state=defaultState();bindStaticInputs();buildPedCards();saveAuto();recalc();});` → the comment `/* RSTN (2026-11-06): the card's "Reset Inputs" button and its handler removed: … */`.
- **Saved data (§5):** no key or format changed.
- **Formulas, factors, units, code references:** none.
- **Check case:** default footing with every geometry value changed (×1.25 + 1) and the project name changed, then main Reset Inputs / main New / branch New: `state` and every localStorage key identical in all three (state hash e09852898b63, storage 41aa740774f7); page text after New main vs branch differs only by the "Reset Inputs" button; 0 console errors.
- **How verified:** `node tests/check-syntax.mjs "Spread Footing.html"`: pass. `node tests/smoke/project-library.mjs --tool spreadfooting`: ALL PASS. `node tests/smoke/start-chooser.mjs`: all 58 checks pass. Main-vs-branch Reset/New script (above). Screenshot of the card (1400 px) looked at. No test clicked Reset Inputs; the user manual does not name it.
## 2026-11-06 — PR: claude/sf-wall-minimums (PR #870: https://github.com/mlococo88/All-Structural/pull/870) (SFWC-1: wall inputs h_w and horizontal bars; the wall's own minimum ρ_l / ρ_t per ACI 318-19 11.6.1 / 11.6.2; 11.6.2 replaces the 0.005A_g dowel fallback; calculation change for Wall elements only)

### SFWC-1. Wall reinforcement minimums, ACI 318-19 11.6   [calculation change, Wall elements only; CLAUDE.md §4]
- **Request (engineer, 2026-11-06):** add the wall checks listed only in the REVIEW chip of SFWL (#769). This PR: the inputs, the wall's own minimum ρ_l / ρ_t (11.6), and 11.6.2 where the in-plane V_u exceeds the 11.6.1 limit, replacing the 0.005A_g dowel fallback (SFWL decision 3). Two-way shear for walls and the pedestal checks are unchanged (SFWL decisions 1 and 2 kept).
- **Provisions read in the ACI 318-19 PDF (printed pp. 169–172; paraphrased):**
  - 11.6.1: where in-plane V_u ≤ 0.5φα_cλ√f′c A_cv, minimum ρ_l and ρ_t per Table 11.6.1 (cast-in-place, deformed bars: No. 5 and smaller with f_y ≥ 60 000 psi: ρ_l 0.0012, ρ_t 0.0020; otherwise 0.0015 and 0.0025).
  - 11.6.2: (a) ρ_l ≥ the greater of Eq. 11.6.2 and 0.0025, need not exceed the ρ_t required for strength by 11.5.4.3; (b) ρ_t ≥ 0.0025. Eq. 11.6.2: ρ_l ≥ 0.0025 + 0.5(2.5 − h_w/ℓ_w)(ρ_t − 0.0025). R11.6.2: at h_w/ℓ_w ≤ 0.5 the vertical reinforcement equals the horizontal; above 2.5 only the 0.0025 minimum.
  - **The condition of 11.6.2 in this copy is printed "If in-plane V_u ≤ 0.5φα_cλ√f′c A_cv"** (read at 600 dpi), the same sign as 11.6.1.
  - 11.5.4.3, Eq. 11.5.4.3: V_n = (α_cλ√f′c + ρ_t f_yt)A_cv; α_c 3 at h_w/ℓ_w ≤ 1.5, 2 at ≥ 2.0, linear between. 11.5.4.4: net axial tension α_c = 2(1 + N_u/(500A_g)) ≥ 0.
  - Table 20.2.2.4(a): shear, stirrups / ties / hoops (deformed bars): f_yt ≤ 60 000 psi.
  - 2.2: ρ_l, ρ_t = area of distributed reinforcement / gross concrete area perpendicular to it.
- **Inputs (saved fields; §5):**
  - `peds[i].wallIn.hw` "Total wall height h_w" (ft), Pedestals card, shown for a Wall only. Blank = the pedestal height h (what SFWL used).
  - `peds[i].wallIn.hSize` / `.hSpc` "Wall horizontal bar (each face)" / "Horizontal spc (in)", Reinforcement tab, shown for a Wall only. `'tie'` / blank = the tie size / tie spacing (the long legs of the perimeter ties are the horizontal bars).
  - Number of curtains: not an input. The vertical bars are a perimeter cage, so the wall has two curtains (one near each face); vertical bar spacing s_v = the long-face bar spacing of `sfdPedBars` (not an input).
  - `newPed`: `wallIn:{hw:'',hSize:'tie',hSpc:''}`. `migrateState` (anchor `/* SFWC (2026-11-06): wall inputs`): fills absent keys with the same values; a stored value is kept. Pedestal elements never read the fields.
- **Where (code):**
  - `sfdWallInfo` (anchor `/* ---- SFWC (2026-11-06, engineer): the wall's own reinforcement`):
    - before: `const hw=p.h*12, r=…`; after: `const hw=(hwIn>0?hwIn:p.h)*12, r=…` (hwIn = `wallIn.hw`).
    - before: `o.AsMinWall=o.rhoL*Ag;o.AsMinCol=0.005*Ag; o.AsMin=o.t1161?o.AsMinWall:o.AsMinCol;`
    - after: new `o.v` (vertical: size, A_b, s_v, ρ_l = 2A_b,v/(s_v t)), `o.hz` (horizontal: ρ_t = 2A_b,h/(s_h t)), per combination `rtReq` = max(0, (V_u/(0.75A_cv) − α_cλ√f′c)/f_yt) with f_yt = min(f_y, 60 000), `o.rhoTreq` (governing), `o.tbl` (Table 11.6.1 with each bar set's size), `o.rlMin` / `o.rtMin` (11.6.1: Table 11.6.1; 11.6.2: `min(max(Eq,0.0025), max(rhoTreq,0.0025))` and 0.0025, `o.e1162`), `o.rlOK` / `o.rtOK`, `o.rhoDow = t1161 ? rhoL : rlMin`, `o.AsMinWall = rhoDow·A_g`, `o.AsMin = o.AsMinWall`.
  - `sfdDowelCheck`: before `o.rhoMin=(o.wall&&bz.wall.t1161)?bz.wall.rhoL:0.005;` after `o.rhoMin=o.wall?bz.wall.rhoDow:0.005;if(o.wall&&!bz.wall.t1161)o.w1162=true;`.
  - `sfdDowMinBasis`: before `…applied&&z.wall.t1161)?'wall':'col'`; after `…applied)?'wall':'col'`. New `sfdRhoTxt(x)`, `sfdWall1162()`.
  - Display: new `sfdWallRhoBlocks(b,w)` (Pedestal Design card 6.x, after the wall statement): ratios provided, then Table 11.6.1 or the ρ_t,req / Eq. 11.6.2 blocks, checks, and the h_w/ℓ_w line, with links to card 5.6. Report: new topic "Wall reinforcement (minimum ρ_l, ρ_t)" in the wall's Pedestal design subsection (steps `w.hw`, `w.rlp`, `w.rtp`, `w.rtq`, `w.eq`, `w.rl`, `w.rt`, `w.rlc`, `w.rtc`); `cb<i>.wthr` note and `cb<i>.dow`, `p<i>.AsMin` and card 5.6 (2e) / note / legend / formula follow 11.6.2. Dashboard: new chip "Wall reinforcement (ACI 318-19 11.6)" (FAIL where ρ_l or ρ_t is below its minimum; D/C = max(ρ_l,min/ρ_l, ρ_t,min/ρ_t)), Report result row linked to the wall's Pedestal design subsection. "Dowel steel" chip text names 11.6.2. `sfdWallTxt` and the REVIEW chip no longer list 11.6 as not computed.
- **Check case 1 (Seymour Platform Foundation, f′c 3000 psi, Ped 1 set to Wall):** ℓ_w = 118.00 in, t = 32.04 in, h_w = h = 87.0 in, h_w/ℓ_w = 0.737, α_c = 3. In-plane V_u = 0 ≤ 232.96 kip: 11.6.1.
  - Vertical: 14 #6 per long face, s_v = (118.00 − 2·2 − 0.75)/13 = 8.711 in; ρ_l = 2·0.44/(8.711·32.04) = **0.00315** ≥ 0.0015 (#6 > No. 5) OK.
  - Horizontal = the ties #4 at 12 in: ρ_t = 2·0.20/(12·32.04) = **0.00104** < 0.0020 (#4, f_y 60 000) **NG** (new chip "Wall reinforcement" FAIL; enter the actual horizontal bars).
  - Dowel minimum unchanged: 0.0015·3780.6 = 5.67 in².
- **Check case 2 (#769 high in-plane shear: default project, direct mode, Ped 1 1.5 × 6 ft Wall, V_y = 120 kip):** t = 18 in, ℓ_w = 72 in, h_w = 24 in, h_w/ℓ_w = 0.333, α_c = 3, √f′c = 63.25 psi, A_cv = 1296 in².
  - 11.6.1 limit 0.5·0.75·3·1.0·63.25·1296/1000 = 92.21 kip < 120: 11.6.2.
  - ρ_t,req = max(0, (120 000/(0.75·1296) − 3·63.25)/60 000) = max(0, (123.46 − 189.74)/60 000) = **0**.
  - ρ_t (ties #3 at 12 in) = 2·0.11/(12·18) = 0.00102. Eq. 11.6.2 = 0.0025 + 0.5(2.5 − 0.333)(0.00102 − 0.0025) = 0.00090. max(0.00090, 0.0025) = 0.0025; cap max(0, 0.0025) = 0.0025; **ρ_l,min = 0.0025**.
  - Dowel minimum: before 0.005·1296 = **6.48 in²** (D/C 6.48/6.32 = 1.025, "Dowel steel" FAIL, Ped 1 dowels NG); after 0.0025·1296 = **3.24 in²** (D/C 0.513, PASS; Ped 1 dowels OK).
  - Wall: ρ_l = 2·0.79/(33.5·18) = 0.00262 ≥ 0.0025 OK; ρ_t = 0.00102 < 0.0025 NG.
- **Decisions (pending engineer review / confirmation):**
  1. **11.6.2 condition (pending engineer confirmation, 2026-11-06):** the engineer's copy prints "≤"; 11.6.2 is applied where the in-plane V_u exceeds the 11.6.1 limit in some LRFD combination (the reading believed corrected by erratum). Stated in the app, the Report and here.
  2. **ρ_t in Eq. 11.6.2 = the provided ratio** (engineer, 2026-11-06).
  3. **The cap "need not exceed ρ_t required by 11.5.4.3" is taken as max(ρ_t,req, 0.0025).** Read literally, with ρ_t,req = 0 (V_u ≤ φα_cλ√f′c A_cv, as in check case 2) ρ_l,min would be 0 and the dowel minimum 0. The 11.6.2(b) floor 0.0025 is kept in the cap (conservative). Question to the engineer.
  4. **ρ_l is the distributed ratio of the long faces,** 2A_b,v/(s_v t), not A_st/A_g. Table 11.6.1 class from each bar set's own size (vertical / horizontal); the dowel minimum keeps the dowel bar size (SFWL).
  5. **Horizontal bars default to the ties** (size and spacing); two curtains; f_yt ≤ 60 000 psi (Table 20.2.2.4(a)); √f′c ≤ 100 psi as in the SFWL limit (conservative).
- **How verified:** see the PR (harness main vs branch on 15 cases; wall and pedestal-only cases; tests).
- **Saved data:** new field `peds[i].wallIn` (absent = h_w = h, horizontal bars = ties); no key or format change; pedestal elements unaffected.
- **Other copies:** none.

## 2026-11-06 — PR: claude/sf-wall-inplane-shear (PR #874: https://github.com/mlococo88/All-Structural/pull/874) (SFWC-2: in-plane shear of a Wall element per ACI 318-19 11.5.4; new check, existing results unchanged)

### SFWC-2. Wall in-plane shear, ACI 318-19 11.5.4   [new check, Wall elements only; CLAUDE.md §4]
- **Request (engineer, 2026-11-06):** compute the in-plane shear of a wall (11.5.4, incl. α_c from h_w/ℓ_w and the V_n limit), listed as not computed by SFWL.
- **Provisions read in the ACI 318-19 PDF (printed pp. 169–170; paraphrased):** 11.5.4.1 (V_n by 11.5.4.2–11.5.4.4; for h_w/ℓ_w < 2 strut-and-tie (Ch. 23) is permitted instead; reinforcement per 11.6, 11.7.2, 11.7.3 in all cases); 11.5.4.2 (V_n at any horizontal section ≤ 8√f′c A_cv); 11.5.4.3, Eq. 11.5.4.3 (V_n = (α_cλ√f′c + ρ_t f_yt)A_cv; α_c 3 / 2 / linear); 11.5.4.4 (net axial tension: α_c = 2(1 + N_u/(500A_g)) ≥ 0); 21.2 (φ = 0.75, shear); Table 20.2.2.4(a) (f_yt ≤ 60 000 psi for shear reinforcement, deformed bars).
- **Where:** `sfdWallInfo` (anchor `/* SFWC-2 (2026-11-06, engineer): in-plane shear`): per LRFD combination `vc` = α_cλ√f′c A_cv, `vs` = ρ_t f_yt A_cv (ρ_t provided, SFWC-1), `vmax` = 8√f′c A_cv, `vn` = min(vc + vs, vmax), `phiVn` = 0.75vn, `vr` = V_u,in-plane/φV_n; `o.vGov`, `o.vOK`. α_c and V_u,in-plane are those of SFWL (per combination). √f′c ≤ 100 psi (as SFWL, conservative).
  - Display: Pedestal Design card 6.x eqBlock "Wall: in-plane shear" + note (`sfdWallRhoBlocks`); Report topic "Wall in-plane shear (governing: …)" (steps `w.ac`, `w.vc`, `w.vs`, `w.vmax`, `w.vn`, `w.vr`); dashboard chip "Wall in-plane shear (ACI 318-19 11.5.4)" (FAIL where V_u > φV_n in any combination; D/C = V_u/φV_n) and its Report result row; REVIEW chip / `sfdWallTxt` no longer list 11.5.4.
- **Check case 1 (#769 case: default, direct, Ped 1 1.5 × 6 ft Wall, V_y = 120 kip, f′c 4000):** α_c = 3 (h_w/ℓ_w = 0.333), A_cv = 1296 in², ρ_t = 0.00102 (ties #3 @ 12 in). vc = 3·1.0·63.25·1296/1000 = 245.90 kip; vs = 0.00102·60 000·1296/1000 = 79.20 kip; vmax = 8·63.25·1296/1000 = 655.73 kip; V_n = 325.10 kip; φV_n = 243.82 kip; V_u/φV_n = 120/243.82 = **0.492 PASS**.
- **Check case 2 (same, h_w = 12 ft, horizontal #5 @ 10 in):** α_c = 2 (h_w/ℓ_w = 2.0); vc = 163.93; vs = 0.00344·60 000·1296/1000 = 267.84; V_n = 431.77; φV_n = 323.83; ratio **0.371**.
- **Check case 3 (same, V_y = 500 kip, horizontal #8 @ 4 in):** ρ_t = 2·0.79/(4·18) = 0.02194; vc + vs = 245.90 + 1706.4 = 1952.3 > vmax 655.73 → V_n = 655.73 (11.5.4.2 governs), φV_n = 491.80, ratio 500/491.80 = **1.017 FAIL**. (SFWC-1 in this case: ρ_t,req = (500 000/(0.75·1296) − 189.74)/60 000 = 0.00541, Eq. 11.6.2 = 0.02356, ρ_l,min = min(0.02356, 0.00541) = 0.00541, dowel minimum 0.00541·1296 = 7.01 in² > 6.32 provided, FAIL.) At V_y = 600 kip the page throws "Cannot read properties of null (reading 'cb')" in recalc on origin/main as well (pre-existing, not investigated here).
- **Check case 4 (Seymour, f′c 3000, Ped 1 Wall):** V_u,in-plane = 0; vc = 3·54.77·3780.6/1000 = 621.21; vs = 0.00104·60 000·3780.6/1000 = 235.99; V_n = 857.21; φV_n = 642.90; ratio **0.000 PASS**.
- **Decisions (pending engineer review):** strut-and-tie (11.5.4.1) not used (note where h_w/ℓ_w < 2); ρ_t in V_n = the provided horizontal ratio (the ties by default, SFWC-1); the check uses the in-plane shear at the interface (the only section the tool has).
- **How verified:** see the PR. **Saved data:** none. **Other copies:** none.

## 2026-11-06 — PR: claude/sf-wall-detailing (PR #875: https://github.com/mlococo88/All-Structural/pull/875) (SFWC-3: Wall bar spacing (11.7.2.1 / 11.7.3.1) and two layers (11.7.2.3), exemption input; the "Wall checks" REVIEW chip shrinks to what is still not computed; new check, existing results unchanged)

### SFWC-3. Wall detailing, ACI 318-19 11.7   [new check, Wall elements only; CLAUDE.md §4]
- **Request (engineer, 2026-11-06):** bar spacing limits 11.7.2.1 (vertical) / 11.7.3.1 (horizontal) and two curtains where thicker than 10 in (11.7.2.3), with a per-wall exemption checkbox; review the REVIEW chip.
- **Provisions read in the ACI 318-19 PDF (printed pp. 171–172; paraphrased):** 11.7.2.1 cast-in-place: vertical s ≤ the lesser of 3h and 18 in; ≤ ℓ_w/3 also where shear reinforcement is required for in-plane strength. 11.7.3.1: horizontal s ≤ the lesser of 3h and 18 in; ≤ ℓ_w/5 also where required for in-plane strength. 11.7.2.3: walls thicker than 10 in, except single-story basement walls and cantilever retaining walls, have the distributed reinforcement in each direction in at least two layers, one near each face. (h = wall thickness.)
- **Input:** `peds[i].wallIn.ex2` checkbox "Exempt from two layers" (Pedestals card, Wall only). `newPed` and `migrateState`: absent / not `true` = `false` (not exempt).
- **Where:** `sfdWallInfo` (anchor `/* SFWC-3 (2026-11-06, engineer): detailing`): `o.shReq` = ρ_t,req > 0 (SFWC-1: V_u > φα_cλ√f′c A_cv in some combination); `o.sMaxV` = min(3t, 18, ℓ_w/3 if shReq); `o.sMaxH` = min(3t, 18, ℓ_w/5 if shReq); `o.sVOK` (s_v, SFWC-1), `o.sHOK` (s_h); `o.req2` = t > 10 in and not exempt; `o.layOK` = 2 curtains (perimeter cage) ≥ required; `o.detOK`.
  - Display: Pedestal Design card 6.x eqBlock "Wall: bar spacing and layers" + note; Report topic "Wall bar spacing and layers" (steps `w.shq`, `w.sv`, `w.sh`, `w.lay`); dashboard chip "Wall bar spacing and layers (ACI 318-19 11.7)" (FAIL where a spacing or the layers fail; D/C = max(s_v/s_v,max, s_h/s_h,max); `sfdChCond` names "two layers required") and its Report result row.
  - REVIEW chip "Wall checks (ACI 318-19 Ch. 11)": before "spacing 11.7 not computed (…)"; after "out-of-plane design by the pedestal checks (stand-in for 11.5.2 / 11.5.3 / 11.5.5.1, ties 11.7.4.1); strut-and-tie (11.5.4.1) not used". `sfdWallTxt` lists the same as not computed.
- **Check cases:**
  - Seymour Ped 1 Wall (t = 32.04 in, ℓ_w = 118.0 in, ρ_t,req = 0): s_v = 8.71 ≤ min(96.12, 18) = 18 OK; s_h = 12 ≤ 18 OK; t > 10: two layers required, 2 provided OK → **PASS**.
  - #769 case (t = 18, ℓ_w = 72, ρ_t,req = 0): s_v = (72 − 4 − 1)/2 = 33.50 > 18 **NG** (D/C 1.86); s_h = 12 ≤ 18 OK; two layers OK → **FAIL**.
  - Same, V_y = 500 kip, horizontal #8 @ 4 in (ρ_t,req = 0.00541 > 0): s_v,max = min(54, 18, 24) = 18 → 33.50 NG; s_h,max = min(54, 18, 14.4) = 14.40 → 4.00 OK.
  - Default, Ped 1 0.75 × 4 ft Wall (t = 9 in ≤ 10): one layer permitted; s_v = 21.50 > 18 NG.
  - #769 case with the exemption ticked: layers "exempt"; spacing as above.
- **Decisions (pending engineer review):**
  1. "Shear reinforcement required for in-plane strength" = ρ_t,req > 0, i.e. V_u > φα_cλ√f′c A_cv in some combination.
  2. The number of curtains is not an input: the tool's perimeter cage always has a curtain near each face, so 11.7.2.3 passes for every wall; the check is shown for the record.
  3. The REVIEW chip stays (status REVIEW) and lists only what is still not computed: the Chapter 11 out-of-plane design (the pedestal P–M, shear and slenderness checks stand in) and 11.7.4.1; the strut-and-tie alternative.
- **How verified:** see the PR. **Saved data:** new field `peds[i].wallIn.ex2` (absent = false). **Other copies:** none.

## 2026-11-06 — PR: claude/sf-wall-minsteel-table (PR #881: https://github.com/mlococo88/All-Structural/pull/881) (SFWM: Wall minimum ρ_l / ρ_t = the larger of ACI 318-19 Table 11.6.1 and 11.6.2 for every wall, whatever the in-plane shear; the wall dowel minimum follows; calculation change for Wall elements only)

### SFWM. Wall minimum reinforcement: the larger of Table 11.6.1 and 11.6.2, always   [calculation change, Wall elements only; CLAUDE.md §4]
- **Decision (engineer, 2026-11-06, final):** check the 11.6.2 minimums for every wall, whatever the in-plane shear; the governing minimum is the larger of Table 11.6.1 and 11.6.2. The wall dowel minimum (16.3.4.2) follows the governing ρ_l. A note states which case the code makes the minimum. This **supersedes SFWC-1 (#870) decision 1** (11.6.2 only where the in-plane V_u exceeds the 11.6.1 limit, "pending engineer confirmation"): 11.6.2 is now applied to every wall by the engineer's choice; the reading of the 11.6.2 condition ("above the 11.6.1 limit"; the engineer's printing shows "≤") is still used, only to word the code-case note. (An interim instruction the same day, "Table 11.6.1 always", was withdrawn by the engineer before any PR.) SFWC-1 decisions 2–5 (ρ_t in Eq. 11.6.2 = provided; cap = max(ρ_t,req, 0.0025); distributed ρ_l; horizontal bars = ties by default) are unchanged.
- **Provisions (ACI 318-19, paraphrased; as read for SFWC-1):** 11.6.1 / Table 11.6.1 (cast-in-place, deformed bars: No. 5 and smaller with f_y ≥ 60 000 psi: ρ_l 0.0012, ρ_t 0.0020; otherwise 0.0015, 0.0025), the code case where in-plane V_u ≤ 0.5φα_cλ√f′c A_cv; 11.6.2(a) ρ_l ≥ max(Eq. 11.6.2, 0.0025), need not exceed ρ_t required by 11.5.4.3; 11.6.2(b) ρ_t ≥ 0.0025; Eq. 11.6.2 ρ_l = 0.0025 + 0.5(2.5 − h_w/ℓ_w)(ρ_t − 0.0025); 16.3.4.2 (wall–foundation interface: vertical reinforcement per 11.6.1).
- **Where (code):**
  - `sfdWallInfo` (anchor `/* SFWM (2026-11-06, engineer, final decision)`):
    - before: `if(o.t1161){o.rlMin=o.tbl.rl;o.rtMin=o.tbl.rt;} else{const eq=…, a=Math.max(eq,0.0025), cap=Math.max(o.rhoTreq,0.0025); o.e1162={eq,a,cap,capGov:cap<a-1e-12};o.rlMin=Math.min(a,cap);o.rtMin=0.0025;}`
    - after: `{const eq=…, a=…, cap=…; o.e1162={eq,a,cap,capGov:cap<a-1e-12,rl:Math.min(a,cap),rt:0.0025};} … o.rlMin=Math.max(o.tbl.rl,o.e1162.rl);o.rtMin=Math.max(o.tbl.rt,o.e1162.rt); o.rlBy=gv(…);o.rtBy=gv(…);` (`gv` → `'11.6.2'` / `'tbl'` / `'equal'`).
    - before: `o.rhoDow=o.t1161?o.rhoL:o.rlMin;` after: `o.rhoDow=Math.max(o.rhoL,o.e1162.rl);o.dow1162=o.e1162.rl>o.rhoL+1e-12;` (o.rhoL = Table 11.6.1 with the dowel bar size, SFWL).
    - `o.t1161` is still computed (the 11.6.1 test, worked in `cb<i>.wthr`); it now only selects the note.
  - `sfdDowelCheck`: before `if(o.wall&&!bz.wall.t1161)o.w1162=true;` after `if(o.wall&&bz.wall.dow1162)o.w1162=true;`.
  - `sfdWall1162()`: true for any applied wall (11.6.2 is checked for every wall).
  - New `sfdWallCaseTxt(w)` (the note) and `sfdWallGovTxt(by)`.
  - Display: Pedestal Design card 6.x (`sfdWallRhoBlocks`): blocks "minimum reinforcement by Table 11.6.1", "ρ_t required for in-plane strength", "minimum reinforcement by 11.6.2", "governing minimum, the larger of Table 11.6.1 and 11.6.2" (governing one named, checks), and the "Code case" note. Report topic "Wall reinforcement": steps `w.rlT`, `w.rtT`, `w.rtq`, `w.eq`, `w.rl2`, `w.rt2`, then `w.rl` / `w.rt` = the governing max (the case note on `w.rl`), `w.rlc`, `w.rtc`. `cb<i>.wthr` note and `cb<i>.dow` (max of both shown), the "Concrete bearing and dowels" note (now where 11.6.2 governs the dowel ρ_l, link `w.rl2`), `sfdWallTxt`, card 5.6 note / legend / formula / (2e), dashboard "Dowel steel" and "Wall reinforcement" chips and their Report result rows. Manual: 4C.4 dowel sentence and a "Wall reinforcement" row in the dashboard criteria table.
- **Check case 1 (Seymour Platform Foundation, f′c 3000 psi, Ped 1 Wall; below the 11.6.1 limit):** t = 32.04 in, ℓ_w = 118.00 in, A_g = 3780.6 in², h_w/ℓ_w = 87.0/118.0 = 0.737, V_u,in-plane = 0 ≤ 232.96 kip: code case 11.6.1.
  - Table 11.6.1: ρ_l,T = 0.0015 (#6 vertical, > No. 5), ρ_t,T = 0.0020 (#4 ties, f_y 60 000). Dowels #6: 0.0015.
  - 11.6.2: ρ_t (ties #4 @ 12) = 2·0.20/(12·32.04) = 0.00104; ρ_t,req = 0; Eq. 11.6.2 = 0.0025 + 0.5(2.5 − 0.737)(0.00104 − 0.0025) = 0.00121; ρ_l,62 = min(max(0.00121, 0.0025), max(0, 0.0025)) = 0.0025; ρ_t,62 = 0.0025.
  - Before: ρ_l,min **0.0015**, ρ_t,min **0.0020**; dowel minimum 0.0015·3780.6 = **5.67 in²** (D/C 5.67/14.08 = 0.403). ρ_l 0.00315 ≥ 0.0015 OK; ρ_t 0.00104 < 0.0020 NG ("Wall reinforcement" D/C 1.92 FAIL).
  - After: ρ_l,min = max(0.0015, 0.0025) = **0.0025**, ρ_t,min = max(0.0020, 0.0025) = **0.0025** (11.6.2 governs both); dowel minimum 0.0025·3780.6 = **9.45 in²** (D/C 0.671, still PASS; "Dowel steel" and "Dowels (tension, laps)" D/C 0.40 → 0.67). ρ_l 0.00315 ≥ 0.0025 OK; ρ_t 0.00104 < 0.0025 NG ("Wall reinforcement" D/C 1.92 → **2.40**, FAIL as before). Dashboard counts unchanged (3 NG, 3 REVIEW).
- **Check case 2 (#769 case: default project, direct, Ped 1 1.5 × 6 ft Wall, V_y = 120 kip, f′c 4000; above the limit):** limit 0.5·0.75·3·1.0·63.25·1296/1000 = 92.21 kip < 120: code case 11.6.2. Table 11.6.1: ρ_l,T 0.0015 (#8), ρ_t,T 0.0020 (#3 ties); 11.6.2: Eq. 0.00090, ρ_l,62 0.0025, ρ_t,62 0.0025. Governing: ρ_l,min 0.0025, ρ_t,min 0.0025, dowel minimum 0.0025·1296 = 3.24 in² — **unchanged** from #870 (D/C 0.513; ρ_t 0.00102 < 0.0025 NG, D/C 2.45). Same case with V_y = 500 kip, horizontal #8 @ 4 in: ρ_l,min 0.00541 (11.6.2), ρ_t,min 0.0025 (equal) — unchanged.
- **How verified:** headless Chromium, origin/main 9c9d807 vs branch, pinned libraries: deep diff of `R`, `P2` and the Report text on 16 cases. The 10 pedestal-only harness cases and Seymour pedestal-only at 3 ksi: **0 differences**. Wall cases: only the wall minimum fields (`rlMin`, `rtMin`, `rhoDow`, `AsMinWall`/`AsMin`/`AsDowMin`, dowel `AsMin`/`rhoMin`/`AsGov`/`dcAs`, new `e1162.rl/.rt`, `rlBy`, `rtBy`, `dow1162`, `w1162`) and the min-steel rows / notes move; the #769 cases only gain the new fields. 0 console errors, 0 KaTeX errors. Tests: see the PR.
- **Saved data:** no new field, no key or format change. Pedestal elements unaffected.
- **Other copies:** none.
- **Open items:** the cap reading of 11.6.2(a) (SFWC-1 decision 3) is still pending engineer review.

## 2026-11-06 — PR: claude/sf-wall-horiz-blank (PR #883: https://github.com/mlococo88/All-Structural/pull/883) (SFWH: the wall's horizontal bars default to blank, "Input needed" = REVIEW; engineer confirmations of SFWC-1 decisions; wall wording of the 1 % note and the "Dowel steel" chip; calculation status change for Wall elements only)

### SFWH. Wall horizontal bars: blank by default, checks that need ρ_t are REVIEW until entered   [check status change, Wall elements only; CLAUDE.md §4, §5]
- **Engineer's answers (2026-11-06) on the wall checks:**
  1. 11.6.2(a) cap = max(ρ_t,req, 0.0025) (SFWC-1 decision 3): **engineer-confirmed**. No code change.
  2. ρ_l = the distributed long-face ratio 2A_b/(s_v t) (SFWC-1 decision 4): **engineer-confirmed**. No code change.
  3. The ℓ_w/3 and ℓ_w/5 spacing limits apply where in-plane V_u > φα_cλ√f′c A_cv, i.e. ρ_t,req > 0 (SFWC-3 decision 1): **engineer-confirmed**. No code change.
  4. **Change:** the wall's horizontal bars default to BLANK instead of "same as ties" (supersedes SFWC-1 decision 5, first part). "Same as ties" stays as an explicit choice.
  5. Display wording (below).
- **Inputs / saved data (§5):**
  - Before: `newPed` `wallIn:{hw:'',hSize:'tie',hSpc:'',ex2:false}`; `migrateState`: `if(p.wallIn.hSize===undefined||p.wallIn.hSize===null||p.wallIn.hSize==='')p.wallIn.hSize='tie';`. The select offered `<option value="tie">same as ties</option>` and the bar sizes.
  - After: `newPed` `hSize:''`; `migrateState` (anchor `/* SFWH (2026-11-06, engineer): the horizontal bars default to BLANK`): `if(p.wallIn.hSize===undefined||p.wallIn.hSize===null||p.wallIn.hSize==='tie')p.wallIn.hSize='';`. Select: `<option value="">— enter —</option><option value="sameTie">same as ties</option>` + the bar sizes.
  - **Decision (pending engineer review):** #870 stored its default as `'tie'`, the same value an explicit "same as ties" choice stored, so the two cannot be told apart. A stored `'tie'` therefore loads as blank (as does an absent or blank value). "Same as ties" picked from now on is stored as `'sameTie'`. No key change; same field, one new value.
  - **Decision (pending engineer review):** a bar size entered with the spacing blank is also "input needed" (before: the tie spacing was used). With "same as ties", a blank spacing still means the tie spacing.
  - Pedestal elements never read the fields: unaffected.
- **Where (code), `sfdWallInfo` (anchor `SFWH (2026-11-06, engineer): hSize blank (the default)`):**
  - Before: `const hTie=!wi.hSize||wi.hSize==='tie', hSz=hTie?(rf.tieSize||0):(parseInt(wi.hSize,10)||0), sTie=!(num(wi.hSpc)>0), …`
  - After: `const hTie=wi.hSize==='sameTie', hSz=…, sTie=hTie&&!(num(wi.hSpc)>0), …; const hNeed=!(hSz>0)||!(hS>0);` `o.hz.need`, `o.hz.rho = null` when hNeed.
  - When `hNeed`: `o.tbl.rt = null` (Table 11.6.1 ρ_t needs the bar size; it is ≤ 0.0025 so ρ_t,min = max(Table, 0.0025) = 0.0025 whatever the size); `o.e1162 = {eq:null, a:null, cap, rl:cap, rt:0.0025, need:true, bound:cap>0.0025}`; `o.rtOK = null`; in-plane shear `vs/vn/phiVn/vr = null`, `o.vGov` = the combination with the largest V_u, `o.vOK = null`; `o.sHOK = null`; `o.layOK = null`; `o.detOK = false` where the vertical spacing fails, else `null`. `null` = "Input needed" (REVIEW).
  - ρ_l,min,62 without ρ_t: max(Eq. 11.6.2, 0.0025) ≥ 0.0025, so min(…, max(ρ_t,req, 0.0025)) = 0.0025 whatever ρ_t where ρ_t,req ≤ 0.0025 (both check cases). **Decision (pending engineer review):** where ρ_t,req > 0.0025 the value is not known without ρ_t; the cap max(ρ_t,req, 0.0025), its upper bound, is used (conservative) and stated (`sfdWallBoundTxt`).
  - Unchanged: ρ_l, ρ_l,min, ρ_t,min, ρ_t,req, the dowel minimum ρ_l A_g, the vertical spacing check.
- **Display:**
  - Dashboard (`renderDashboard`): "Wall reinforcement", "Wall in-plane shear", "Wall bar spacing and layers": status = FAIL if a part that can be checked fails, else REVIEW if a part needs input, else PASS (before: `bad.length?'fail':'pass'` with `!z.wall.rtOK` etc.). Texts read "— input needed (horizontal bars)". `sfdChCond` gives "input needed: horizontal bars". Report D/C (`sfdResultRows`): the ρ_t / s_h parts are left out while input is needed; in-plane shear D/C n/a. Verdict counts follow the chip statuses.
  - Pedestal Design card 6.x (`sfdWallRhoBlocks`): ρ_t "input needed", a warnbox "Input needed: enter the wall's horizontal bars", the Table 11.6.1 ρ_t row "≤ 0.0025 (horizontal bar size: input needed)", Eq. 11.6.2 "input needed", ρ_t check, V_n and s_h / layers "input needed (REVIEW)".
  - Report: new `sfrNeed` step (no test, REVIEW badge "input needed (horizontal bars)", the note) for `w.rtp`, `w.eq`, `w.rtc`, `w.vs`, `w.vr` (V_n not worked), `w.sh`, `w.lay`; `w.rtT` and `w.rt` show "≤ 0.0025".
  - Wording (item 5): Pedestal Design "1 % lower limit" note, before "The minimum that does govern is the 0.005A_g connection reinforcement of ACI 318-19 16.3.4.1, … (element type Wall: 16.3.4.2, see the note above)"; after, for a wall: "(element type Wall) the wall-foundation minimum of ACI 318-19 16.3.4.2, ρ_l A_g with ρ_l = x (the larger of Table 11.6.1 and 11.6.2, see the note above)"; pedestal wording unchanged. Dashboard chip title: before always "Dowel steel (min 0.005A_g)"; after `sfdDowChipName()`: unchanged without walls, "Dowel steel (min ρ_l A_g, wall)" where every element is a wall, "Dowel steel (min 0.005A_g; wall ρ_l A_g)" where mixed. The Report lookups keyed by the chip name go through `sfdChipKey` (maps both to the old name).
  - User manual: the "Wall reinforcement" dashboard-criteria row says the checks are REVIEW until the bars are entered.
- **Governing provisions (ACI 318-19, paraphrased):** 11.6.1 / Table 11.6.1, 11.6.2 / Eq. 11.6.2, 11.5.4.2, 11.5.4.3 / Eq. 11.5.4.3, 11.7.3.1, 11.7.2.3, 16.3.4.1, 16.3.4.2. No formula changed.
- **Check case 1 (Seymour Platform Foundation, f′c 3000 psi, Ped 1 set to Wall; t = 32.04 in, ℓ_w = 118.00 in, A_cv = 3780.6 in², h_w/ℓ_w = 0.737, α_c = 3, V_u,in-plane = 0):**
  - Before (#881, horizontal = ties #4 @ 12): ρ_t = 2·0.20/(12·32.04) = 0.00104 < 0.0025, "Wall reinforcement" **FAIL, D/C 2.40**; in-plane shear V_c = 3·54.77·3780.6/1000 = 621.21, V_s = 0.00104·60 000·3780.6/1000 = 235.99, V_n = 857.21, φV_n = 642.90 k, V_u/φV_n = 0.000 PASS; spacing/layers PASS (s_h 12 ≤ 18). Dashboard 3 NG, 3 REVIEW; Report verdict "3 of 30 FAIL · 20 PASS · 3 REVIEW · 4 N/A".
  - After (blank): "Wall reinforcement" **REVIEW** (ρ_l 0.00315 ≥ 0.0025 OK; ρ_t input needed; D/C 0.79 = ρ_l part); "Wall in-plane shear" **REVIEW** (V_u 0.00, φV_n input needed); "Wall bar spacing and layers" **REVIEW** (s_v 8.71 ≤ 18 OK; s_h, layers input needed). Dowel minimum unchanged 0.0025·3780.6 = 9.45 in², D/C 0.67 PASS. Dashboard 2 NG, 6 REVIEW; verdict "2 of 30 FAIL · 18 PASS · 6 REVIEW · 4 N/A".
  - After with #5 @ 12 each face entered: ρ_t = 2·0.31/(12·32.04) = **0.00161** < 0.0025 **FAIL, D/C 1.55**; Eq. 11.6.2 = 0.0025 + 0.5(2.5 − 0.737)(0.00161 − 0.0025) = 0.00172, ρ_l,min,62 = min(max(0.00172, 0.0025), 0.0025) = 0.0025; V_s = 0.00161·60 000·3780.6/1000 = 365.89, V_n = 987.10, **φV_n = 740.25 k**, ratio 0.000 PASS; s_h 12 ≤ 18 PASS. Same on origin/main with the same input (3 NG, 3 REVIEW).
  - "Same as ties" picked explicitly: identical to the #881 results (only the new field `hz.need` = false).
  - A save holding the #870 default `hSize:'tie'`: loads blank, results identical to the absent-field case.
- **Check case 2 (#769: default project, direct, Ped 1 1.5 × 6 ft Wall, V_y = 120 kip, f′c 4000; t = 18, ℓ_w = 72, A_cv = 1296 in², α_c = 3):**
  - Before (ties #3 @ 12): ρ_t 0.00102 < 0.0025 "Wall reinforcement" FAIL (D/C 2.45); φV_n = 0.75(245.90 + 79.20) = 243.82 k, ratio 0.492 PASS; spacing FAIL (s_v 33.50 > 18). Dashboard 6 NG, 2 REVIEW.
  - After (blank): "Wall reinforcement" REVIEW (ρ_l 0.00262 ≥ 0.0025 OK); in-plane shear REVIEW; spacing **still FAIL** (s_v 33.50 > 18, D/C 1.86; s_h input needed). Dowel minimum 3.24 in² unchanged. Dashboard 5 NG, 4 REVIEW.
  - After with #5 @ 12: ρ_t = 2·0.31/(12·18) = **0.00287** ≥ 0.0025 PASS; V_s = 0.00287·60 000·1296/1000 = 223.20, V_n = 469.10, **φV_n = 351.82 k**, ratio 120/351.82 = **0.341** PASS; spacing FAIL (s_v). Dashboard 5 NG, 2 REVIEW (same as origin/main with that input).
- **How verified:** headless Chromium, origin/main 638b7ae vs the branch, pinned libraries; deep diff of `R`, `P2` and the Report text on 20 cases. The 10 pedestal-only harness cases and Seymour pedestal-only at 3 ksi: **0 differences**, Report text identical. Wall cases with the bars entered (Seymour #5 @ 12, #769 #5 @ 12, #769 V_y 500 with #8 @ 4) and "same as ties": only the new field `hz.need`. Blank cases: only the ρ_t-dependent fields move to null. 0 console errors, 0 KaTeX errors. Tests: `node tests/check-syntax.mjs` (all), `tests/smoke/spread-footing-scroll.mjs`, `phone-layout.mjs --tool sf`, `project-library.mjs --tool spreadfooting`, `start-chooser.mjs` pass. Screenshots of the Pedestal Design wall card, the dashboard and the Report wall topics checked by eye.
- **Other copies:** none.

## 2026-11-06 — PR: claude/sf-header-save (PR #884: https://github.com/mlococo88/All-Structural/pull/884) (HDRS) — header: Save and Saved projects… removed (in the Project tab's "Save and open" card only); the chip opens the Project tab   [TRIAL in Spread Footing; other apps keep header Save until the engineer decides; display only; no result change]
- **Why:** engineer 2026-11-06: remove the header's Save (Ctrl+S) and Saved projects… buttons; keep them only in the Project tab's "Save and open" card. The header keeps the "Project: name ● saved / unsaved" chip (click = Project tab, as the old project link did), Undo, Redo, Auto-calculate / Re-analyze and Print. Ctrl+S and Ctrl+Shift+S work from anywhere. The "Recent projects" strip (START) is unchanged.
- **Where:** the STDS block (anchor `/* STDS (2026-11-05): the standard save`), in the `SharedProjectsUI.projectBar({...})` call, right after the line `header:$('#sfdHdrA'),chipBefore:$('#btnUndo'),headerBefore:$('#sfdAcLbl'),card:$('#sfdSaveCard'),`. Before: nothing. After (a comment `/* HDRS (2026-11-06; TRIAL here only, … */` and one line):
  `headerSave:false,chipClick:()=>{const a=document.getElementById('sfdHdrProj');if(a)a.click();},chipHint:'the Project tab (title block; Save and open)',`
  The chip click reuses the click handler of the hidden header link `#sfdHdrProj` (SFHD: Project tab via `sfdSetInTab('project',true)`, title block `#sec-title` opened, scrolled into view on narrow screens, its first input focused). Shared options: `fixlog/shared-projects.md` (HDRS).
- **Header before:** chip · Undo · Redo · Save (Ctrl+S) · Saved projects… · Auto-calculate on change · Re-analyze · Print-to-PDF Report; chip click = Saved projects… dialog. **After:** chip · Undo · Redo · Auto-calculate on change · Re-analyze · Print-to-PDF Report; chip click = Project tab (title block). The card's Save · Save as… · Saved projects… · New and Export / Import JSON are unchanged.
- **Problem:** none (layout request). **Governing provision:** none (§4 does not apply).
- **Check case:** six saved projects, open "Footing F3", Geometry tab: click the chip → Project tab, title block open, no dialog; Ctrl+Shift+S on the Geometry tab → Save as; "Footing H1" saved; one input edited → chip "unsaved changes"; Ctrl+S on the Geometry tab → chip "saved", no question.
- **How verified:** main vs branch on the 10 SF harness cases (R, P2, dashboard text and Report text identical, 0 diffs, 0 console errors); Save as / edit / Ctrl+S / Export JSON at 1400 and 390 px, main vs branch: Export JSON identical, the same localStorage keys with the same values (only time stamps differ); `tests/smoke/start-chooser.mjs` (its Saved projects… clicks now use the card button; new step 11 for the header), standard-save, project-library --tool spreadfooting, github-sync, phone-layout --tool sf, spread-footing-scroll, check-syntax; screenshots at 1400 and 390 px looked at.
- **Saved data:** no key or format changed (§5).
- **Other copies:** none. **Open items:** engineer to decide whether other apps follow (they keep the header Save until then).

## 2026-11-06 — PR: claude/sf-ldc-always (PR #900: https://github.com/mlococo88/All-Structural/pull/900) — Option "Always require ℓ_dc for dowels (detailing practice)": ℓ_dc checked for every pedestal / wall regardless of the ACI 318-19 16.3.1.2(a) bearing gate (SFLA; calculation option, default off = no change)

### SFLA. Option: always require dowel compression development ℓ_dc   [pass / fail logic option; CLAUDE.md §4]
- **Engineer (2026-11-06):** add the option, default off. On: the ℓ_dc ≤ available check applies to every pedestal and wall whatever the SFBC (#773) gate gives, as before #773. Off: exactly as now. Where only the option requires it, every display says so.
- **Provisions (cited, paraphrased):** ACI 318-19 16.3.1.2(a): the dowels need transfer only the compression beyond the lesser concrete bearing strength (16.3.3.4). 25.4.9.2: ℓ_dc = max(0.02d_b f_y/(λ√f′c), 0.0003d_b f_y, 8 in), √f′c ≤ 100 psi (25.4.1.4). The option is a detailing practice stricter than the code; ℓ_dc itself is unchanged.
- **Where:**
  - Input: Reinforcement tab, section "Pedestal Reinforcement & Dowels", checkbox after the section note (anchor `<!-- SFLA -->`), `data-path="mat.ldcAlways"`, values `'off'` (default) / `'on'`. `defaultState().mat.ldcAlways='off'`; `migrateState`: `if(state.mat.ldcAlways!=='on')state.mat.ldcAlways='off';` (saves without the field: off, the 16.3.1.2(a) gate as before).
  - `computePhase2`, concrete bearing (anchor `const ldcGate=`).
    - Before:
      ```
      const ldcReq=!isPatch&&PuMax>phiBgate+1e-9;
      ```
    - After:
      ```
      const ldcGate=!isPatch&&PuMax>phiBgate+1e-9;
      const ldcByOpt=!isPatch&&!ldcGate&&state.mat.ldcAlways==='on';
      const ldcReq=ldcGate||ldcByOpt;
      ```
      and in the returned object `...(ldcByOpt?{ldcByOpt:true}:{})` after `ldcReq` (the field exists only when true, so `P2` is unchanged with the option off). `ldcOK` is unchanged: `isPatch?true:(!ldcReq||Ldc<=availEmb)`.
  - Display where `ldcByOpt` (the text "required by the engineer's option (detailing practice); ACI 318-19 §16.3.1.2(a) would not require it here"):
    - Card 5.6: L_dc cell "(option)"; a note listing each such element (P_u ≤ φB_n, L_dc vs available, OK/NG); legend item "L_dc (option)" (`sfdBearLegend`).
    - Card 5.6 dowel table: "(engineer's option)" in the ℓ_dc column; a note under step (1) with P_u ≤ φB_n.
    - Dashboard chip "Dowel development (ℓdc)": the elements and the text appended; the Report checks-table reference (`sfdResultRows`) names the option when on.
    - Report: step `cb<i>.ldcq` note ("= 0: … would not require …; required by the engineer's option"); `cb<i>.ldc` and `p<i>.ldc` labels.
    - Report "Geometry and materials" table: new row "Dowel compression development ℓ_dc (Reinforcement tab)" = "required only where P_u exceeds the concrete bearing strength, ACI 318-19 §16.3.1.2(a)" (off) / "always required (engineer's option, detailing practice)" (on).
    - Drawings (pedestal detail elevation, `sfdwBuild`): a second note line under "DOWEL EMBED. AVAILABLE …": "L_DC REQUIRED BY THE ENGINEER'S OPTION (DETAILING PRACTICE); ACI 318-19 16.3.1.2(A) WOULD NOT REQUIRE IT HERE".
    - User manual: checks table row "Dowel development (ℓdc)" and 4C.4 describe the option.
- **Check case 1, Seymour Platform Foundation, f′c = 3000 psi, option on** (t = 24 in, bottom cover 3 in, #7 both ways: available = 24 − 3 − 0.875 − 0.875 = 19.25 in; √f′c = 54.77 psi):
  - Ped 1 (32 #6, d_b = 0.750): ℓ_dc = max(0.02·0.750·60000/(1.0·54.77) = 16.43, 0.0003·0.750·60000 = 13.50, 8) = **16.43 in** ≤ 19.25. P_u = 148.92 k ≤ min(6270.79, 6266.33) = 6266.33 k (gate: not required). Before: not required (OK); after: required by the option, **OK**.
  - Ped 2 (16 #8, d_b = 1.000): ℓ_dc = max(0.02·1.000·60000/54.77 = 21.91, 18.00, 8) = **21.91 in** > 19.25. P_u = 54.05 k ≤ min(2024.26, 2015.35) = 2015.35 k. Before: not required (OK); after: required by the option, **NG**.
  - Dashboard "Dowel development (ℓdc)": N/A → **FAIL, D/C 21.91/19.25 = 1.14**. Verdict 3 → 4 FAIL (4 → 3 N/A).
- **Check case 2, default project, option on** (#8 dowels, f′c 4000, √f′c = 63.25; t = 3 ft, available 36 − 3 − 1 − 1 = 25.00 in):
  - ℓ_dc = max(0.02·1.000·60000/63.25 = 18.97, 18.00, 8) = **18.97 in** ≤ 25.00.
  - Ped 1 P_u 240.81, Ped 2 P_u 318.81 ≤ min(1432.08, 716.04) = 716.04 k (gate: not required).
  - Chip N/A → **PASS, D/C 0.76**. Verdict 2 FAIL · 20 PASS · 4 N/A → 2 FAIL · 21 PASS · 3 N/A.
  - "thin" (t = 8 in, available 3.00 in) with the option: N/A → **FAIL, D/C 6.32** for both pedestals.
- **How verified:**
  - Headless Chromium, origin/main e62f9d9 vs the branch, pinned libraries. Deep diff of `R` and `P2`, dashboard text (collapsed and full) and Report text on 18 cases: the 10 harness cases, Seymour 4 ksi and 3 ksi, and option on for def, thin, sfe, rev, dir, sey3.
  - **Option off (12 cases):** `R`, `P2` and the dashboard identical (0 diffs). Report identical except the new "Geometry and materials" row.
  - **Option on:** only `P2.bearing[].ldcReq` false → true, the new `ldcByOpt`, and `ldcOK` true → false where ℓ_dc > available (sey3 Ped 2, thin Ped 1 and 2). The dashboard and Report move only in the ℓ_dc rows, steps and the verdict count.
  - 0 console / KaTeX errors. `node tests/check-syntax.mjs`, `tests/smoke/spread-footing-scroll.mjs`, `tests/smoke/phone-layout.mjs --tool sf`, `tests/smoke/project-library.mjs --tool spreadfooting` and `tests/smoke/start-chooser.mjs` pass. Input row, card 5.6, the dashboard and the pedestal detail note (Seymour 3 ksi, option on) checked by eye.
- **Saved data:** one new field `mat.ldcAlways` (default and backfill `'off'`); no key or other format change (§5).
- **Other copies:** none.

## 2026-11-06 — PR: claude/sf-corner-labels (PR #901: https://github.com/mlococo88/All-Structural/pull/901) (SFQL: Bearing heat map, corner-pressure labels placed clear of the centroid axes, the plot edge, the colour bar and each other; display only, no result change)

- **Why:** engineer 2026-11-06: the corner-pressure labels of the card 3.2 heat map (SFQC, #777) crowd or overlap the axis lines near the plot; reposition so they never overlap the axes, the colour bar or each other at 1280–1920 px and on a phone (390 px), including the narrow Seymour footing (5 × 13 ft) and the default project.
- **Problem (before):** `sfqcFit` chose one of three placements from an *estimated* label width (5.6 px per character + 12) and fixed thresholds, and did not look at the two centroid axes (the Plotly zero lines x = 0 and y = 0, drawn across the footing and out to the plot edge). Examples: a short footing on a phone (B × L = 14 × 4.5 ft, 390 px) put the labels inside on two lines, where q₁/q₄ and q₂/q₃ overlapped each other and all four sat on the y = 0 axis line; at the default project on a phone the estimate forced two-line labels although one line fitted; the inside placement was accepted with only 6 px between a label and the axis line.
- **Where:** `sfqcFit` (anchor `function sfqcFit(id,B,L`, before `function sfqcCard(bp,r){`), and its call in `renderPlots`, heat map.
- **Before (`sfqcFit`):**
```js
function sfqcFit(id,B,L){
 const gd=document.getElementById(id),fl=gd&&gd._fullLayout;
 if(!fl||!fl.xaxis||!fl.yaxis||!fl.xaxis._length||!fl.annotations||fl.annotations.length!==4||typeof Plotly==='undefined')return;
 const xa=fl.xaxis,ya=fl.yaxis,fw=B*xa._length/Math.abs(xa.range[1]-xa.range[0]),fh=L*ya._length/Math.abs(ya.range[1]-ya.range[0]);
 const lw=Math.max(...fl.annotations.map(a=>String(a.text).replace(/<br>/g,'').length))*5.6+12,lh=20;
 const mode=(fw>=2*lw+12&&fh>=2*lh+12)?'in':((xa._length-fw)/2>=lw+8&&fh>=2*lh+8)?'side':'two';
 const upd={};
 fl.annotations.forEach((a,k)=>{const sx=SFQC_PTS[k][0],sy=SFQC_PTS[k][1],t=String(a.text).replace(/<br>/g,' ');
  const o=mode==='side'?{xanchor:sx>0?'left':'right',xshift:4*sx,text:t,'font.size':11}:mode==='two'?{xanchor:sx>0?'right':'left',xshift:-4*sx,text:t.replace(' = ',' =<br>'),'font.size':10}:{xanchor:sx>0?'right':'left',xshift:-4*sx,text:t,'font.size':11};
  Object.keys(o).forEach(q=>{if(q==='font.size'?(a.font&&a.font.size)!==o[q]:a[q]!==o[q])upd['annotations['+k+'].'+q]=o[q];});});
 if(Object.keys(upd).length)Plotly.relayout(gd,upd);
}
```
  call: `sfqcFit('plot-heat',B,L);   /* SFQC */`
- **After:**
```js
/* SFQL (2026-11-06): the placement is chosen from the labels' own measured size (Plotly's box of the first draw, the text width
   from a canvas at the candidate font size) and checked, in plot-area pixels, against the plot area (the colour bar, title and
   axes are outside it), the two centroid axes (the zero lines x = 0 and y = 0, which run through the footing and out to the plot
   edge) and each other, with a 3 px gap. Candidates in order: inside each corner; outside the left and right edges; above and
   below the top and bottom edges; the same three on two lines at 10 pt, then 9 pt; the first that is clear is used. When none is
   clear, each corner shows its tag q₁…q₄ only (the values are in the corner table directly above the plot and in the hover).
   Chosen again after a window resize, zoom or pan (plotly_relayout). Display only: no value changes. */
function sfqcFit(id,B,L,T){
 const gd=document.getElementById(id),fl=gd&&gd._fullLayout;
 if(!fl||!fl.xaxis||!fl.yaxis||!fl.xaxis._length||!fl.annotations||fl.annotations.length!==4||typeof Plotly==='undefined')return;
 T=T||fl.annotations.map(a=>String(a.text).replace(/<br>/g,' '));   /* SFQL: the full one-line texts, as drawn by renderPlots */
 const cv=sfqcFit.cv||(sfqcFit.cv=document.createElement('canvas').getContext('2d'));
 const tw=(t,sz)=>{cv.font=sz+'px "Times New Roman", Times, serif';return cv.measureText(t).width;};
 /* padding and line height from Plotly's own box of a one-line 11 pt label (border 1 + borderpad 2 each side if not drawn yet) */
 const one=fl.annotations.find(a=>!/<br>/.test(String(a.text))&&(a.font&&a.font.size)===11&&a._xsize>0);
 if(one)gd._sfqcCal=[Math.max(one._xsize-tw(String(one.text),11),4),Math.max(one._ysize-6,12)];
 const padX=gd._sfqcCal?gd._sfqcCal[0]:6, lh11=gd._sfqcCal?gd._sfqcCal[1]:14;
 const box=(t,sz)=>{const ln=t.split('<br>');return {w:Math.max(...ln.map(x=>tw(x,sz)))+padX+1,h:ln.length*lh11*sz/11+6+1};};
 const xa=fl.xaxis,ya=fl.yaxis,W=xa._length,H=ya._length,g=3;
 const px=v=>xa.c2p(v),py=v=>ya.c2p(v),inR=(ax,v)=>(v-ax.range[0])*(v-ax.range[1])<=0;
 const X0=inR(xa,0)?px(0):null,Y0=inR(ya,0)?py(0):null;
 const C=[['in',1,11],['side',1,11],['vout',1,11],['in',2,10],['side',2,10],['vout',2,10],['in',2,9],['side',2,9],['vout',2,9],['tag',1,10]];
 const plan=c=>T.map((t0,k)=>{const sx=SFQC_PTS[k][0],sy=SFQC_PTS[k][1],pl=c[0];
  const t=pl==='tag'?t0.split(' ')[0]:c[1]===2?t0.replace(' = ',' =<br>'):t0, b=box(t,c[2]);
  const xo=pl==='side', yo=pl==='vout';
  const xan=xo?(sx>0?'left':'right'):(sx>0?'right':'left'), xsh=xo?4*sx:(yo?0:-4*sx);
  const yan=yo?(sy>0?'bottom':'top'):(sy>0?'top':'bottom'), ysh=yo?4*sy:-4*sy;
  const x0=px(sx*B/2)+xsh-(xan==='right'?b.w:0), y0=py(sy*L/2)-ysh-(yan==='bottom'?b.h:0);
  return {o:{xanchor:xan,yanchor:yan,xshift:xsh,yshift:ysh,text:t,'font.size':c[2]},x0,x1:x0+b.w,y0,y1:y0+b.h};});
 const bad=P=>{let n=0;
  P.forEach((q,i)=>{n+=Math.max(0,-q.x0)+Math.max(0,q.x1-W)+Math.max(0,-q.y0)+Math.max(0,q.y1-H);
   if(X0!==null&&q.x0-g<X0&&X0<q.x1+g)n+=Math.min(X0-q.x0+g,q.x1+g-X0);
   if(Y0!==null&&q.y0-g<Y0&&Y0<q.y1+g)n+=Math.min(Y0-q.y0+g,q.y1+g-Y0);
   for(let j=i+1;j<P.length;j++){const r=P[j],ox=Math.min(q.x1,r.x1)-Math.max(q.x0,r.x0)+g,oy=Math.min(q.y1,r.y1)-Math.max(q.y0,r.y0)+g;if(ox>0&&oy>0)n+=Math.min(ox,oy);}});
  return n;};
 let best=null,bs=Infinity;
 for(const c of C){const P=plan(c),s=bad(P);if(s<bs){best=P;bs=s;}if(s<=0.5)break;}
 const upd={};
 fl.annotations.forEach((a,k)=>{const o=best[k].o;
  Object.keys(o).forEach(q=>{if(q==='font.size'?(a.font&&a.font.size)!==o[q]:a[q]!==o[q])upd['annotations['+k+'].'+q]=o[q];});});
 gd._sfqcFit=bs<=0.5?'clear':'least overlap';
 if(Object.keys(upd).length&&!gd._sfqcBusy){gd._sfqcBusy=true;try{Plotly.relayout(gd,upd);}finally{gd._sfqcBusy=false;}}
 if(gd.on){if(gd._sfqcH&&gd.removeListener)gd.removeListener('plotly_relayout',gd._sfqcH);
  gd._sfqcH=e=>{if(!gd._sfqcBusy&&!(e&&Object.keys(e).some(k=>/^annotations/.test(k))))sfqcFit(id,B,L,T);};gd.on('plotly_relayout',gd._sfqcH);}
}
```
  call: `sfqcFit('plot-heat',B,L,qcAnn.map(a=>a.text));   /* SFQC; SFQL: the full texts */`
- **What it does:** each candidate placement is laid out in plot-area pixels from the labels' real size (Plotly's own box of the first draw gives the padding and line height; the text width comes from a canvas at the candidate font size) and scored against: the plot area (the colour bar, title and axis ticks are outside it), the two centroid axis lines, and the other labels, with a 3 px gap. Order: inside each corner (11 pt); outside the left/right edges; above/below the top/bottom edges; the same three on two lines at 10 pt, then at 9 pt; the first clear one is used. If none is clear, each corner shows only its tag q₁…q₄ (the values are in the corner table directly above the plot and in the hover); if even that is not clear, the placement with the least overlap. The placement is chosen again on a window resize, zoom or pan (`plotly_relayout`, ignoring the function's own annotation relayout). `gd._sfqcFit` records 'clear' or 'least overlap' (used by the check below).
- **Governing provision:** none (display only). No value, table, saved field or Report number changes.
- **Check case (headless Chromium at 390 / 1280 / 1600 / 1920 px):** default 10 × 8 ft; Seymour 5 × 13 ft; sfe9 and sfe (partial contact, two corners off); rev; thin; a short footing 14 × 4.5 ft; a 3 × 3 ft footing with no-contact corners. DOM check of each drawn label box against the plot area, the colour bar, the zero-line paths and the other labels: before, the short footing at 390 px had 6 overlaps (q₁ × q₄, q₂ × q₃, all four × the y = 0 axis); after, 0 overlaps in all 32 views, every view 'clear'. Seymour: 1280–1920 px unchanged (labels outside the left and right edges, one line); 390 px two lines inside, as before. Default at 390 px: one line inside (before: two lines). Short footing at 390 px: above and below the footing. Resize 1600 → 390 → 1600 px: the placement follows (one line outside → two lines inside → one line outside).
- **How verified:** SF harness (10 cases) main vs branch: `R` and `P2` deep diff 0 differences, dashboard and Report text identical, 0 console / KaTeX errors. The Report's copy of the heat map carries the four labels with the same values. Tests: check-syntax, spread-footing-scroll, phone-layout --tool sf, project-library --tool spreadfooting, start-chooser.
- **Saved data:** none touched (§5). **Other copies:** none.
- **Open item:** at 390 px the plot title is wider than the plot and is cut at both ends (unchanged; not part of this request).

## 2026-11-06 — PR: claude/sf-ecc-nolimit (PR #908: https://github.com/mlococo88/All-Structural/pull/908) (SFNE: Eccentricity limit option "No eccentricity limit (IBC 2021 / ACI 318-19)", e reported for information; calculation option, default = no change)

- **Why:** engineer 2026-11-06. On 2026-11-03 the engineer was told that IBC 2021 and ACI 318-19 set no maximum eccentricity for a spread footing: stability is checked by overturning, by bearing with partial contact, and by sliding. The engineer asked for an option that does not apply the app's eccentricity-limit check.
- **What the app did before (unchanged for every existing choice):** Stability input "Eccentricity limit" (`stab.eccMode`, default `'kern'`; `migrateState` backfills it when absent):
  - `kern`: middle third, biaxial 6|e_x|/B + 6|e_y|/L ≤ 1, on the service (ASD) combinations (SFEB, 2026-11-02);
  - `a_soil` e ≤ B/3, `a_soil4` B/4, `a_rock` 0.45B, `a_ee0` 0.33B, `a_ee1` 0.40B, `custom` f·B: AASHTO forms, per axis, on the factored (LRFD) combinations;
  - `off` "Not checked": `R.eccChk = null`, no chip, no 4.3a card, no Report section; the input echo reads "not checked"; the eccentricities are not shown anywhere as a group.
  - With a limit: `R.eccChk` gives a dashboard chip "Eccentricity limit" (PASS / FAIL; it counts in the verdict), a red design error when exceeded, card 4.3a (worked limit, table, NG box), the Report section "Eccentricity limit" (S-ecc) with DCR, and a result row with D/C = DCR.
  - "Not checked" does not do what was asked (it shows no eccentricity and no statement), so a separate choice was added and `off` was left as it is (question to the engineer below).
- **After:** new choice `none`, "No eccentricity limit (IBC 2021 / ACI 318-19) — e reported for information", placed in the same select before "Not checked". With it:
  - `R.eccChk = null`, as with `off`: no pass/fail, no D/C, no design error, no verdict count except one N/A chip.
  - New `R.eccInfo = {rows, gov}` (the key is present only with this choice, so `R` is unchanged otherwise): for each service combination e_x, e_y, |e_x|/B, |e_y|/L, the kern index 6|e_x|/B + 6|e_y|/L and the contact fraction. `gov` is the largest kern index.
  - Dashboard chip "Eccentricity (information)" with status N/A, text "eₓ = …, eᵧ = … ft, 6eₓ/B + 6eᵧ/L = … (combination); no limit (IBC 2021 / ACI 318-19)", linking to 4.3a. Result row: reference "not limited by IBC 2021 / ACI 318-19 (ACI 318-19 §13.2.6.1 …); information only, no D/C", D/C n/a.
  - Card "4.3a Eccentricity (information only; no limit)": the statement, the worked e and kern index of the largest case (no ✓ / NG), the table of every service combination, and links to overturning, bearing/contact and sliding.
  - Report: section "Eccentricity (information; no limit)" (key S-ecc) with the statement, two steps without a verdict, and the table. Input echo "none (not limited by IBC 2021 / ACI 318-19); e reported for information". References: ACI 318-19 gets "§13.2.6.1 (foundation stability: overturning and sliding per the general building code; no eccentricity limit)" only with this choice.
- **Governing provision:** ACI 318-19 13.2.6.1 (printed p. 194; checked in the PDF) has foundations proportioned for bearing effects and for stability against overturning and sliding at the soil–foundation interface under the general building code. It sets no eccentricity limit. IBC: the 2018 IBC text (Ch. 18) was searched and has no maximum-eccentricity requirement for shallow foundations. The IBC 2018→2021 structural-changes document lists none either, so no IBC section is cited for the absence. The §1807.2.3 retaining-wall FS the tool already quotes is unchanged.
- **Where / exact code (unified diff, `Spread Footing.html`):**
```diff
@@ -451,0 +452 @@ a.wkA:hover{text-decoration:underline}
+  <option value="none">No eccentricity limit (IBC 2021 / ACI 318-19) &mdash; e reported for information</option>
@@ -1656,2 +1657,11 @@ function computeAll(){
- let eccChk=null;
- if(eccMode!=='off'){
+ let eccChk=null, eccInfo=null;
+ /* SFNE (2026-11-06, engineer): 'none' = no eccentricity limit. IBC 2021 and ACI 318-19 set no maximum eccentricity for a spread
+    footing (ACI 318-19 13.2.6.1: bearing, overturning and sliding per the general building code); stability is by overturning,
+    bearing with partial contact and sliding. No check and no D/C (eccChk stays null, as 'off'); the service-combination
+    eccentricities are reported for information (eccInfo). Default and old saves keep their own eccMode (kern unless chosen). */
+ if(eccMode==='none'){
+  const rows=asd.map(a=>{const rr=a.r,ratX=(B>0)?Math.abs(rr.ex)/B:0,ratY=(L>0)?Math.abs(rr.ey)/L:0;
+   return{name:a.cb.name,ex:rr.ex,ey:rr.ey,ratX,ratY,kern:6*ratX+6*ratY,contact:(a.bear&&a.bear.contactFrac!==undefined)?a.bear.contactFrac:1};});
+  eccInfo={rows,gov:rows.length?rows.reduce((a,b)=>b.kern>a.kern?b:a):null};
+ }
+ if(eccMode!=='off'&&eccMode!=='none'){
@@ -1698 +1708 @@ function computeAll(){
-  present,combosASD,combosLRFD,asd,lrfd,govBear,govOT,govSlx,govSly,govSlr,minContact,flot,eccChk,otGate:(state.stab.otGate==='on'),
+  present,combosASD,combosLRFD,asd,lrfd,govBear,govOT,govSlx,govSly,govSlr,minContact,flot,eccChk,...(eccInfo?{eccInfo}:{}),otGate:(state.stab.otGate==='on'),
@@ -1829,0 +1840,2 @@ function renderDashboard(){
+ else if(R.eccInfo&&R.eccInfo.gov){const g=R.eccInfo.gov;   /* SFNE: information only, no pass/fail */
+  d.appendChild(chip('Eccentricity (information)','e\u2093 = '+f2(g.ex)+', e\u1D67 = '+f2(g.ey)+' ft, 6e\u2093/B + 6e\u1D67/L = '+f2(g.kern)+' ('+g.name+'); no limit (IBC 2021 / ACI 318-19)','na',undefined,{tab:'tab-stab',sec:'o-st-ecc'}));}
@@ -3185,0 +3198,16 @@ function renderStability(){
+ /* SFNE (2026-11-06): no eccentricity limit selected: the eccentricities for information, no pass / fail, no D/C */
+ if(R.eccInfo&&R.eccInfo.gov){const I=R.eccInfo,g=I.gov;
+  const be=secPanel(T,'o-st-ecc','4.3a  Eccentricity (information only; no limit)');
+  be.appendChild(el('p','note','No eccentricity limit is applied (input, Stability tab). The eccentricity is <b>not limited by IBC 2021 / ACI 318-19</b>: ACI 318-19 13.2.6.1 has the footing proportioned for bearing and for stability against overturning and sliding under the general building code, and neither code sets a maximum eccentricity. Stability is checked by overturning (\u00a74.3), bearing with partial contact (3.2, 3.3) and sliding (\u00a74.2). The values below are reported for information.'));
+  be.appendChild(eqBlock('Eccentricity of the resultant (information)','service combinations',
+   'e_x = \\frac{\\Sigma M_y}{\\Sigma P},\\; e_y = \\frac{\\Sigma M_x}{\\Sigma P},\\quad \\frac{6|e_x|}{B} + \\frac{6|e_y|}{L}\\;(\\le 1:\\ \\text{full contact})',
+   '\\text{largest: '+g.name.replace(/[\u2212]/g,'-')+':}\\; \\frac{6\\cdot'+f3(Math.abs(g.ex))+'}{'+f2(R.B)+'} + \\frac{6\\cdot'+f3(Math.abs(g.ey))+'}{'+f2(R.L)+'}',
+   'e_x = '+f3(g.ex)+',\\; e_y = '+f3(g.ey)+'\\;\\mathrm{ft};\\quad \\frac{6|e_x|}{B} + \\frac{6|e_y|}{L} = '+f3(g.kern)+'\\;(B/6 = '+f2(R.B/6)+',\\; L/6 = '+f2(R.L/6)+'\\;\\mathrm{ft};\\ \\text{contact '+f2(100*g.contact)+'\\%})'));
+  const te=document.createElement('table');te.className='tbl';
+  te.innerHTML='<tr><th>#</th><th>Service combination</th><th>e<sub>x</sub> (ft)</th><th>e<sub>y</sub> (ft)</th><th>|e<sub>x</sub>|/B</th><th>|e<sub>y</sub>|/L</th><th>6|e<sub>x</sub>|/B + 6|e<sub>y</sub>|/L</th><th>Contact (%)</th></tr>';
+  I.rows.forEach((rw,i)=>{const tr=document.createElement('tr');
+   [String(i+1),rw.name,f2(rw.ex),f2(rw.ey),f3(rw.ratX),f3(rw.ratY),f3(rw.kern),f2(100*rw.contact)].forEach(x=>{const td=document.createElement('td');td.textContent=x;tr.appendChild(td);});
+   if(rw===g)tr.style.background='#eef4fb';te.appendChild(tr);});
+  be.appendChild(te);
+  be.appendChild(sfdWorkedIn([['o-st-ot','overturning'],['o-br-press','bearing pressure and contact'],['o-st-slide','sliding']]));
+ }
@@ -3491,0 +3520 @@ function sfdResultRows(){
+  'Eccentricity (information)':()=>['not limited by IBC 2021 / ACI 318-19 (ACI 318-19 §13.2.6.1: stability by overturning and sliding per the general building code); information only, no D/C',null,['o-st-ecc']],
@@ -3584,0 +3614 @@ function sfrRefs(){
+  if(a==='ACI 318-19'&&em==='none')b=b+', §13.2.6.1 (foundation stability: overturning and sliding per the general building code; no eccentricity limit)';   /* SFNE */
@@ -3624 +3654 @@ function sfrModel(){
-   ['Overturning FS gates the result',R.otGate?'yes':'no (reported only)','–'],['Eccentricity limit',R.eccChk?sfrPlain(R.eccChk.lab):'not checked','–'],
+   ['Overturning FS gates the result',R.otGate?'yes':'no (reported only)','–'],['Eccentricity limit',R.eccChk?sfrPlain(R.eccChk.lab):(R.eccInfo?'none (not limited by IBC 2021 / ACI 318-19); e reported for information':'not checked'),'–'],
@@ -3775,0 +3806,9 @@ function sfrModel(){
+  else if(R.eccInfo&&R.eccInfo.gov){const I=R.eccInfo,g=I.gov;   /* SFNE: information only, no pass / fail, no D/C */
+   subs.push({title:'Eccentricity (information; no limit)',key:'S-ecc',items:[
+    {type:'note',text:'No eccentricity limit is applied (input). The eccentricity is not limited by IBC 2021 / ACI 318-19 (ACI 318-19 13.2.6.1: bearing, overturning and sliding per the general building code; neither code sets a maximum eccentricity). Stability is checked by overturning, bearing with partial contact and sliding ([[S-st]], [[S-bp]]). Reported for information.'},
+    {type:'steps',scope:'ecc',steps:[
+     S({id:'ex',label:'Largest eccentricity index: '+g.name,sym:'e_{x}',eq:'\\frac{\\sum M_{y}}{\\sum P}',sub:'',value:g.ex,unit:'ft',d:3,note:'e_y = '+sfrN(g.ey,3)+' ft'}),
+     S({id:'kern',label:'Kern index (≤ 1: full contact; information, no limit)',sym:'\\frac{6|e_{x}|}{B} + \\frac{6|e_{y}|}{L}',eq:'',sub:'\\frac{6\\cdot'+sfrN(Math.abs(g.ex),3)+'}{'+sfrN(R.B)+'} + \\frac{6\\cdot'+sfrN(Math.abs(g.ey),3)+'}{'+sfrN(R.L)+'}',value:g.kern,unit:'',d:3,note:'B/6 = '+sfrN(R.B/6,3)+' ft, L/6 = '+sfrN(R.L/6,3)+' ft; contact '+sfrN(100*g.contact,1)+' %'})]},
+    {type:'table',caption:'Eccentricity of each service combination (information)',head:['Combination','e_x (ft)','e_y (ft)','|e_x|/B','|e_y|/L','6|e_x|/B + 6|e_y|/L','Contact (%)'],
+     rows:I.rows.map(rw=>({cells:[rw.name,sfrCell(rw.ex,3),sfrCell(rw.ey,3),sfrCell(rw.ratX,3),sfrCell(rw.ratY,3),sfrCell(rw.kern,3),sfrCell(100*rw.contact,1)],cls:rw===g?'gov':''}))}]});
+  }
@@ -4077 +4116 @@ function sfrModel(){
-  const W={'Bearing (service)':['S-qa','S-bp'],'Overturning':['S-st'],'Eccentricity limit':['S-ecc'],'Sliding, x':['S-st'],'Sliding, y':['S-st'],'Sliding, resultant \u221a(Hx\u00b2+Hy\u00b2)':['S-st'],
+  const W={'Bearing (service)':['S-qa','S-bp'],'Overturning':['S-st'],'Eccentricity limit':['S-ecc'],'Eccentricity (information)':['S-ecc'],'Sliding, x':['S-st'],'Sliding, y':['S-st'],'Sliding, resultant \u221a(Hx\u00b2+Hy\u00b2)':['S-st'],
```
- **Check case (§4), harness case sfe9 (B × L = 10 × 8 ft; governing service combination 0.6D + 0.6(−Wx)):**
  - Inputs: ΣP and ΣM_y of that combination give e_x = ΣM_y/ΣP = −2.091 ft, e_y = 0. B/6 = 10/6 = 1.667 ft, so |e_x| > B/6.
  - **Before** (default, middle third): 6|e_x|/B + 6|e_y|/L = 6·2.091/10 + 0 = **1.255 > 1 → FAIL**, D/C 1.25. Red error "Eccentricity limit exceeded…". Verdict "7 of 26 checks FAIL · 12 PASS · 3 REVIEW · 4 N/A".
  - **After** (choice `none`): the same e_x = −2.091 ft and index 1.255 are shown as information (contact 87.25 %). No pass/fail, no D/C, no error. Verdict "6 of 26 checks FAIL · 12 PASS · 3 REVIEW · 5 N/A". The rest of `R` and all of `P2` are identical: the deep diff changes only `eccChk` (→ null), the new `eccInfo` and the removed error message.
  - Second case, rev (Seymour-based, 5 × 13 ft, biaxial): e_x = −0.703, e_y = −1.962 ft. Before: 6·0.703/5 + 6·1.962/13 = 0.844 + 0.905 = 1.749 FAIL. After: information only. Verdict 4 FAIL / 4 N/A → 3 FAIL / 5 N/A.
- **Saved data:** no new field and no key change. `stab.eccMode` gets one more allowed value. The default stays `'kern'`, and `migrateState` already backfills an absent `eccMode` with it, so old projects keep their results. A save holding `'none'` opened in an older copy of the tool falls back to the middle third (`ECC[eccMode]||ECC.kern`).
- **How verified:** the SF harness (10 cases) run on origin/main and on the branch with the default choice: `R` and `P2` 0 differences, dashboard and Report text identical, 0 console / KaTeX errors. The `none` choice on def, sfe9 and rev: 0 console / KaTeX errors, and the input set through the select itself. Screenshots of the 4.3a card and the dashboard checked. Tests: check-syntax, spread-footing-scroll, phone-layout --tool sf, project-library --tool spreadfooting, start-chooser.
- **Other copies:** none.
- **Open item (engineer):** "Not checked" (`off`) and the new choice now overlap: both apply no limit, but only the new one shows the eccentricities and the statement. Should `off` be removed (with a migration to `none`), or kept?

## 2026-11-06 — PR: claude/sf-ecc-off-remove (PR #913: https://github.com/mlococo88/All-Structural/pull/913) (SFNO: Eccentricity limit choice "Not checked" removed; saves holding it open as "No eccentricity limit"; §5 migration, pass / fail unchanged)

- **Why:** engineer 2026-11-06, answering the SFNE (#908) open item: remove "Not checked" (`stab.eccMode = 'off'`); `migrateState` maps `'off'` → `'none'`, so saved projects keep the same pass/fail and now show e for information.
- **Where / exact code (unified diff, `Spread Footing.html`):**
```diff
@@ -453 +452,0 @@ a.wkA:hover{text-decoration:underline}
-  <option value="off">Not checked</option>
@@ -777,0 +777,3 @@ function migrateState(){
+ /* SFNO (2026-11-06, engineer): the choice "Not checked" (stab.eccMode 'off') is removed. A save holding it opens as 'none'
+    (No eccentricity limit): no limit is applied either way, so pass / fail is unchanged; e is now reported for information. */
+ if(state.stab.eccMode==='off')state.stab.eccMode='none';
@@ -1656 +1658 @@ function computeAll(){
- const eccMode=state.stab.eccMode||'kern';
+ const eccMode=(state.stab.eccMode==='off')?'none':(state.stab.eccMode||'kern');   /* SFNO: 'off' (removed choice) = 'none' */
@@ -3201 +3203 @@ function renderStability(){
-  be.appendChild(el('p','note','No eccentricity limit is applied (input, Stability tab). The eccentricity is <b>not limited by IBC 2021 / ACI 318-19</b>: ACI 318-19 13.2.6.1 has the footing proportioned for bearing and for stability against overturning and sliding under the general building code, and neither code sets a maximum eccentricity. Stability is checked by overturning (\u00a74.3), bearing with partial contact (3.2, 3.3) and sliding (\u00a74.2). The values below are reported for information.'));
+  be.appendChild(el('p','note','No eccentricity limit is applied (input, Stability tab). The eccentricity is <b>not limited by IBC 2021 / ACI 318-19</b>: ACI 318-19 13.2.6.1 has the footing proportioned for bearing and for stability against overturning and sliding under the general building code, and neither code sets a maximum eccentricity. Stability is checked by overturning (\u00a74.3), bearing with partial contact (3.2, 3.3) and sliding (\u00a74.2). The values below are reported for information. Projects saved with the former choice \u201cNot checked\u201d open with this choice; their results are unchanged.'));
```
  - Input: the `<option value="off">Not checked</option>` line removed from `select[data-path="stab.eccMode"]`.
  - `migrateState` (anchor `/* SFNO (2026-11-06, engineer)`, after the stab/soil/ev backfill): `if(state.stab.eccMode==='off')state.stab.eccMode='none';`. Every load path calls it: autosave (`loadAuto`), Saved projects open and its "unsaved changes" compare (`opened`), Import JSON, start-up.
  - `computeAll`: `const eccMode=state.stab.eccMode||'kern';` → `const eccMode=(state.stab.eccMode==='off')?'none':(state.stab.eccMode||'kern');`, a guard for any state not passed through `migrateState`.
  - Card 4.3a (`none`) note: added "Projects saved with the former choice "Not checked" open with this choice; their results are unchanged."
- **§5 migration:** no key or field change. The value `'off'` is mapped to `'none'` in memory on load. The stored project keeps `'off'` until it is saved again, and then holds `'none'`. A copy of the tool from before SFNE (#908) reading `'none'` falls back to the middle third (`ECC[eccMode]||ECC.kern`). No user data is discarded.
- **§4 / §5 callout: a save with `'off'`** (default project + `stab.eccMode:'off'` in the autosave), origin/main vs the branch:
  - **Before:** select "Not checked"; `R.eccChk = null`; no eccentricity chip, no 4.3a card, no Report section; input echo "not checked". Verdict "2 of 25 checks FAIL · 19 PASS · 4 N/A".
  - **After:** select "No eccentricity limit (IBC 2021 / ACI 318-19)"; `R.eccChk = null` (no limit, as before); chip "Eccentricity (information)" N/A; card 4.3a and the Report section with e (largest 6|e_x|/B + 6|e_y|/L = 0.309, 0.6D + 0.6(+Wx)); input echo "none (not limited …)". Verdict "2 of 26 checks FAIL · 19 PASS · 5 N/A".
  - FAIL, PASS and REVIEW counts are identical. The only change in the counts is the one added N/A (the information chip). The same holds for sfe9 with `'off'` (6 FAIL · 12 PASS · 3 REVIEW, N/A 4 → 5) and dir (3 FAIL · 18 PASS, N/A 4 → 5).
  - Deep diff of `R` and `P2`, main `'off'` vs branch `'off'`: only the new `eccInfo`. Branch `'off'` vs branch `'none'`: 0 differences.
- **Governing provision:** as SFNE (ACI 318-19 13.2.6.1). No limit is applied before or after.
- **How verified:** the SF harness (10 cases, their own eccentricity modes: kern by default, rev cases kern explicitly) on origin/main and the branch: `R` / `P2` 0 differences, dashboard and Report text identical, 0 console / KaTeX errors. `'off'` saves (def, sfe9, dir) as above. Screenshots of the dashboard and Stability tab checked. Tests: check-syntax, spread-footing-scroll, phone-layout --tool sf, project-library --tool spreadfooting, start-chooser.
- **Other copies:** none.

## 2026-11-06 — PR: claude/sf-nobear-guard (PR #920: https://github.com/mlococo88/All-Structural/pull/920) (SFNB-1: no service combination with a bearing solution: crash guards, Bearing FAIL with the reason of each combination, renderer safety net, contact-area chip text; display only, no result change where the tool worked before)

- **Why (engineer decisions 1, 3, 4, 2026-11-06):** a read-only investigation found that the page threw when `R.govBear` was null (no service combination with a finite bearing D/C):
  - `renderPedCb` (card 2.6, SFPC #768): `const s=sfdPcSel(), cb=s.a.cb;` with `s.a` null. Triggers on the default project: direct mode with V_y ≥ 583.9 k (resultant off the footing in both brackets, e_y = 2700/656.9 = 4.11 ft > L/2 = 4.00 ft with lever t + h = 4.5 ft), V_x ≥ 648.9 k (i_q = 0, D/C ∞), M_x = 3000 k-ft, net uplift; case mode D.M_x = 5000, D.V_y = 1000, D.P = −2000, pedestal at x = 20 ft, direct soil q_a = 0.
  - `comboSelectorBar` read `list[govIdx].cb` with govIdx = −1 when the user had picked a combination (service or LRFD).
  - `sfrModel` (`const G=R.govBear, r=G.r`) threw, so the Report showed only "Report error".
  - `recalc` cleared the "out of date" flag and then stopped at the throw: Bearing, Stability, Design, plots, Report, Drawings and 3D kept the previous results with no marker.
  - The Contact area chip read "min 100.00 %" when every combination was off the footing (an off-footing combination counted as full contact in the text).
- **What changed (`Spread Footing.html`):**
  - New `sfdBearWhy(a)` (after `selASD`, anchor `/* SFNB (2026-11-06, engineer): why a service combination has no finite bearing D/C`): the reason a row of `R.asd` has no finite D/C: "net load not downward: ΣP = … kip"; "resultant off the footing: |e_y| 4.12 ft ≥ L/2 4.00 ft"; "zero bearing capacity: allowable q_a = 0.00 ksf ≤ 0"; "zero bearing capacity: H = … kip ≥ V = … kip, inclination factor i_q = 0 (Vesić)"; "bearing capacity could not be computed (effective area B′·L′ ≤ 0)". Helpers `sfdNoBearRows`, `sfdNoBearShort`, `sfdNoBearTable`. They read `r`, `bear`, `cap`, `DCR` only.
  - Dashboard: Bearing (service) chip with no governing combination: was "No valid combination" FAIL; now "no bearing solution in any of the n combinations — <first>: <reason> (and n−1 more, see 3. Bearing)" FAIL, linked to 3.1.
  - Bearing tab: was one red line; now card 3.1 "Bearing Check — No Governing Combination": "Bearing: FAIL…" and a table (combination, ΣP, e_x, e_y, reason), link to 2.3.
  - `comboSelectorBar`: with no governing combination, a disabled first option "— no governing combination —" when nothing is picked; the badge reads "No governing combination — no service combination has a bearing solution: Bearing FAIL (reasons in 3. Bearing)".
  - `sfdPcSel` / `renderPedCb` (card 2.6): direct mode shows the entered envelope (`R.asd[0]` when no bracket governs; the loads are the same in both); case mode shows the picked combination (service or LRFD) if any, else a message linking to 3.1.
  - Report (`sfrModel`): with no governing combination the subsections "Resultant of the governing bearing combination" (S-res), "Base pressure" (S-bp, with the reason table) and "Allowable bearing and bearing check" (S-qa) are replaced by notes "— none" (`sfrNoBear`), keys kept so the cross-references resolve. Every other section renders (summary, stability, design, appendices). The other `R.govBear` uses (plan / drawings / 3D / heat map / checks list) were already guarded; verified by the smoke test.
  - `recalc` and the tab-click handler: each renderer runs in `sfdRun` (try / catch). A failure is logged with `console.error` and its tab gets a red banner "Out of date: an error stopped this tab updating…" (`.sfdOod`) and a red tab button (`sfdTabErr`); the dashboard and warnings panels likewise. Failures are kept per tab and renderer (`SFD_OOD`, "tab|renderer"), so a later good render of a different renderer (e.g. the plots) does not clear another's banner. When nothing throws, nothing is shown and the order of the calls is unchanged.
  - Contact area chip: text only (status unchanged): all combinations off the footing → "resultant off the footing (n of n combinations)"; some → "min X % of footing (of the k combinations in contact) — resultant off the footing (m of n combinations)"; net load not downward is counted separately ("net load not downward (m of n)"). Unchanged when every combination has contact.
- **Exact code:** the unified diff of `Spread Footing.html` (excluding the new smoke test):
```diff
diff --git a/Spread Footing.html b/Spread Footing.html
index 50f3837..c2d5000 100644
--- a/Spread Footing.html	
+++ b/Spread Footing.html	
@@ -93,2 +93,5 @@ table.ldtbl input{width:58px;font-family:inherit;font-size:11px;border:1px solid
 .errbox{background:#fdecea;border:1px solid #c62828;padding:5px 8px;margin:4px 0}
+.sfdOod{border-width:2px;background:#fbd5d2;color:#8b0000;font-size:13px}   /* SFNB: "Out of date" banner */
+.dash>.sfdOod{grid-column:1/-1;flex:1 1 100%}
+#tabbar button.sfdTabErr{color:#c62828;box-shadow:inset 0 -3px 0 #c62828}
 .tabbar{margin:8px 0 0 0;border-bottom:2px solid #7a8aa0}
@@ -1723,2 +1726,29 @@ function selASD(govObj){
 }
+/* SFNB (2026-11-06, engineer): why a service combination has no finite bearing D/C, for the Bearing tab, card 2.6, the selector badge,
+   the dashboard and the Report. Display only: reads R.asd rows (r, bear, cap, DCR), computes nothing for the checks. '' = a finite D/C. */
+function sfdBearWhy(a){
+ if(!a||!a.r)return '';
+ const r=a.r,bp=a.bear||{},c=a.cap;
+ if(!(r.P>1e-9))return 'net load not downward: \u03a3P = '+f2(r.P)+' kip';
+ if(bp.mode==='unstable'){const o=[];
+  if(Math.abs(r.ex)>=R.B/2-1e-9)o.push('|e\u2093| '+f2(Math.abs(r.ex))+' ft \u2265 B/2 '+f2(R.B/2)+' ft');
+  if(Math.abs(r.ey)>=R.L/2-1e-9)o.push('|e\u1D67| '+f2(Math.abs(r.ey))+' ft \u2265 L/2 '+f2(R.L/2)+' ft');
+  return 'resultant off the footing: '+(o.join(', ')||'no contact solution');}
+ if(a.DCR!==null&&isFinite(a.DCR))return '';
+ if(c&&c.direct)return 'zero bearing capacity: allowable q\u2090 = '+f2(c.qa)+' ksf \u2264 0';
+ if(!c||c.fail)return 'bearing capacity could not be computed (effective area B\u2032\u00b7L\u2032 \u2264 0)';
+ if(c.H>1e-9&&c.iq===0)return 'zero bearing capacity: H = '+f2(c.H)+' kip \u2265 '+(c.denom!=null&&Math.abs(c.denom-c.V)>1e-9?'V + A\u2032c/tan\u03c6 = '+f2(c.denom):'V = '+f2(c.V))+' kip, inclination factor i_q = 0 (Vesi\u0107)';
+ return 'zero bearing capacity: q_allow = '+f2(c.qall)+' ksf';
+}
+/* SFNB: every service combination with its reason, when none has a bearing solution (R.govBear null) */
+function sfdNoBearRows(){return R.asd.map((a,i)=>({i,a,why:sfdBearWhy(a)||'no finite D/C'}));}
+function sfdNoBearShort(){
+ const z=sfdNoBearRows(),n=z.length;
+ return 'no bearing solution in any of the '+n+' combination'+(n===1?'':'s')+(z.length?' \u2014 '+z[0].a.cb.name+': '+z[0].why+(n>1?' (and '+(n-1)+' more, see 3. Bearing)':''):'');}
+function sfdNoBearTable(){
+ const t=document.createElement('table');t.className='tbl';
+ t.innerHTML='<tr><th>#</th><th>Combination</th><th>\u03a3P (kip)</th><th>e\u2093 (ft)</th><th>e\u1D67 (ft)</th><th>Why there is no bearing D/C</th></tr>';
+ sfdNoBearRows().forEach(z=>{const tr=document.createElement('tr');
+  [String(z.i+1),sfEsc(z.a.cb.name),f2(z.a.r.P),f2(z.a.r.ex),f2(z.a.r.ey),sfEsc(z.why)].forEach(x=>{const td=document.createElement('td');td.innerHTML=x;tr.appendChild(td);});t.appendChild(tr);});
+ return t;}
 function selLRFDindex(){
@@ -1755,2 +1785,4 @@ function comboSelectorBar(basis,govIdx,onChange){
  const lrOn=lrG&&sfdLrSel();
+ const noGov=!(govIdx>=0&&list[govIdx]);   /* SFNB: no governing combination (no service combination has a bearing solution) */
+ if(noGov&&SEL[basis]==null&&!lrOn){const o=document.createElement('option');o.value='-1';o.disabled=true;o.textContent='\u2014 no governing combination \u2014';sel.insertBefore(o,sel.firstChild);}
  const cur=(SEL[basis]!=null)?SEL[basis]:govIdx;
@@ -1761,3 +1793,4 @@ function comboSelectorBar(basis,govIdx,onChange){
  const badge=el('span','selBadge');
- if(lrOn)badge.innerHTML=' &nbsp;<b style="color:#8a4b00">Showing an LRFD (factored) combination</b> \u2014 the checks use the service combinations; governing is #'+(govIdx+1)+' ('+sfEsc(list[govIdx].cb.name)+')';
+ if(noGov)badge.innerHTML=' &nbsp;<b style="color:#c62828">No governing combination</b> \u2014 no service combination has a bearing solution: Bearing FAIL (reasons in 3. Bearing)'+(lrOn?'; showing an LRFD (factored) combination, reference only':'');
+ else if(lrOn)badge.innerHTML=' &nbsp;<b style="color:#8a4b00">Showing an LRFD (factored) combination</b> \u2014 the checks use the service combinations; governing is #'+(govIdx+1)+' ('+sfEsc(list[govIdx].cb.name)+')';
  else if(SEL[basis]!=null&&SEL[basis]!==govIdx)badge.innerHTML=' &nbsp;<b style="color:#b26a00">Showing non-governing case</b> \u2014 governing is #'+(govIdx+1)+' ('+list[govIdx].cb.name+')';
@@ -1823,3 +1856,3 @@ function renderDashboard(){
   d.appendChild(chip('Bearing (service)','DCR = '+f2(R.govBear.DCR)+' \u2014 '+R.govBear.cb.name,ok?'pass':'fail',R.asd.indexOf(R.govBear),{tab:'tab-bearing',sec:'o-br-gov'}));
- }else d.appendChild(chip('Bearing (service)','No valid combination','fail',undefined,{tab:'tab-bearing'}));
+ }else d.appendChild(chip('Bearing (service)',sfEsc(sfdNoBearShort()),'fail',undefined,{tab:'tab-bearing',sec:'o-br-gov'}));   /* SFNB */
  const anyUnstable=R.asd.some(a=>a.bear.mode==='unstable'||a.r.P<=1e-9);
@@ -1850,3 +1883,8 @@ function renderDashboard(){
     overturning govern strength); no contact or resultant off the footing (anyUnstable) FAIL. */
- d.appendChild(chip('Contact area','min '+f2(R.minContact*100)+'% of footing'+(anyUnstable?' \u2014 resultant off the footing in at least one combination':''),(anyUnstable||R.minContact<=0)?'fail':(R.minContact>=1-1e-6?'pass':'warn'),undefined,{tab:'tab-bearing',sec:'o-br-press'}));
+ /* SFNB (2026-11-06, engineer): the text counts the combinations with the resultant off the footing (or a net load not downward) and
+    gives the minimum contact of those in contact; a resultant off the footing counted as 100 % before. Status unchanged. */
+ const ctN=R.asd.length, ctOff=R.asd.filter(a=>a.r.P>1e-9&&a.bear.mode==='unstable').length, ctUp=R.asd.filter(a=>!(a.r.P>1e-9)).length,
+  ctIn=R.asd.filter(a=>a.r.P>1e-9&&a.bear.mode!=='unstable'), ctMin=ctIn.reduce((m,a)=>Math.min(m,a.bear.contactFrac!==undefined?a.bear.contactFrac:1),1),
+  ctNo=[ctOff?'resultant off the footing ('+ctOff+' of '+ctN+' combination'+(ctN===1?'':'s')+')':'',ctUp?'net load not downward ('+ctUp+' of '+ctN+')':''].filter(Boolean).join('; ');
+ d.appendChild(chip('Contact area',!ctIn.length?ctNo:'min '+f2((ctNo?ctMin:R.minContact)*100)+'% of footing'+(ctNo?' (of the '+ctIn.length+' combination'+(ctIn.length===1?'':'s')+' in contact) \u2014 '+ctNo:(anyUnstable?' \u2014 resultant off the footing in at least one combination':'')),(anyUnstable||R.minContact<=0)?'fail':(R.minContact>=1-1e-6?'pass':'warn'),undefined,{tab:'tab-bearing',sec:'o-br-press'}));
  d.appendChild(chip('Rigidity (rigid method)','\u03bb\u2113 = '+f2(Math.max(R.rig.vx,R.rig.vy))+' vs \u03c0/4 = '+f2(R.rig.limit),R.rig.rigid?'pass':'fail',undefined,{tab:'tab-stab',sec:'o-st-rig'}));
@@ -2374,3 +2412,3 @@ const SFPC_SYM={P:'P',Vx:'V\u2093',Vy:'V\u1D67',Mx:'M\u2093',My:'M\u1D67'};
 function sfdPcSel(){
- if(R.directMode)return {a:R.govBear,basis:'env',i:R.asd.indexOf(R.govBear)};
+ if(R.directMode){const a=R.govBear||R.asd[0];return {a,basis:'env',i:R.asd.indexOf(a)};}   /* SFNB: no governing bracket, the entered envelope (the same in both) */
  if(sfdLrSel())return {a:R.lrfd[SEL.asdLr],basis:'LRFD',i:SEL.asdLr};
@@ -2383,3 +2421,7 @@ function renderPedCb(b){
  if(!R.directMode)b.appendChild(comboSelectorBar('asd',gi,()=>{sfdLrPick(SEL.asdLr);}));   /* the same selection as Bearing / Stability (SEL) */
- const s=sfdPcSel(), cb=s.a.cb;
+ const s=sfdPcSel();
+ if(!s.a){   /* SFNB (2026-11-06, engineer): no governing combination and none selected */
+  b.appendChild(el('div','errbox','No governing service combination: no service combination has a bearing solution (Bearing FAIL, reasons in '+sfdLink('o-br-gov','',['tab-bearing','3.1 Bearing check'])+'). Pick a combination in the selector above to see its pedestal loads.'));
+  return;}
+ const cb=s.a.cb;
  const what=s.basis==='env'?'the direct factored envelope (pedestal loads as entered, \u03b3 = 1)':s.basis==='LRFD'?'<b>LRFD (factored) combination '+(s.i+1)+': '+sfEsc(cb.name)+'</b> (reference only)':(s.a===R.govBear?'the governing service combination ':'service combination ')+(s.i+1)+': <b>'+sfEsc(cb.name)+'</b>';
@@ -2807,3 +2849,8 @@ function renderBearing(){
  if(R.fatal)return;
- if(!R.govBear){T.appendChild(el('div','errbox','No valid bearing combination (net vertical load not downward, or resultant off the footing in all cases).'));return;}
+ if(!R.govBear){   /* SFNB (2026-11-06, engineer): Bearing FAIL with the reason of each combination */
+  const b0=secPanel(T,'o-br-gov','3.1  Bearing Check \u2014 No Governing Combination');
+  b0.appendChild(el('div','errbox','<b>Bearing: FAIL.</b> No service combination has a bearing solution, so there is no governing combination, no base pressure and no bearing D/C. The reason for each combination is below. The other checks (Stability tab: overturning, sliding, flotation) still run.'));
+  b0.appendChild(sfdNoBearTable());
+  b0.appendChild(el('p','note','Resultants and eccentricities: '+sfdLink('o-cb-asd','')+'. A resultant off the footing (|e| \u2265 B/2 or L/2) or a net load that is not downward means the footing is unstable under that combination; zero bearing capacity means the allowable pressure is zero or could not be computed.'));
+  return;}
  const govIdx=R.asd.indexOf(R.govBear);
@@ -3623,2 +3670,8 @@ function sfrRefs(){
 const sfrCell=(v,d,cls)=>({t:(typeof v==='number')?(isFinite(v)?sfrN(v,d):(v>0?'∞':'−∞')):String(v==null?'—':v),n:typeof v==='number',cls});
+/* SFNB (2026-11-06, engineer): a Report subsection in place of a governing-combination subsection when no service combination has a
+   bearing solution (R.govBear null): Bearing FAIL and why; the key is kept so the cross-references resolve. withTable: each combination's reason. */
+function sfrNoBear(title,key,withTable){
+ const it=[{type:'note',text:'Bearing: FAIL. No service combination has a bearing solution, so there is no governing bearing combination'+(key==='S-res'?' and no governing resultant is worked here; every combination\'s resultant is in [[S-asd]]':'')+(key==='S-bp'?', no base pressure and no bearing D/C':'')+(key==='S-qa'?' and the allowable bearing pressure is not compared with a pressure':'')+'. '+(withTable?'The reason for each combination:':'Reasons: [[S-bp]].')}];
+ if(withTable)it.push({type:'table',wide:true,head:['#','Combination','ΣP (kip)','e_x (ft)','e_y (ft)','Why there is no bearing D/C'],rows:sfdNoBearRows().map(z=>[String(z.i+1),z.a.cb.name,sfrCell(z.a.r.P),sfrCell(z.a.r.ex,3),sfrCell(z.a.r.ey,3),z.why])});
+ return {title:title+' \u2014 none',key,items:it};}
 const sfrDC=v=>({t:(typeof v==='number'&&isFinite(v))?sfrN(v,2):(v===Infinity?'∞':'—'),n:true,cls:(typeof v==='number')?(v>1+1e-9?'ng':(v>=0.9?'hi':'ok')):'na'});
@@ -3709,3 +3762,5 @@ function sfrModel(){
   /* resultant of the governing bearing combination */
-  const G=R.govBear, r=G.r, w2=sfrW(), vt=r.verts;
+  const G=R.govBear;
+  if(!G)subs.push(sfrNoBear('Resultant of the governing bearing combination','S-res'));   /* SFNB: none governs */
+  else{const r=G.r, w2=sfrW(), vt=r.verts;
   const lst=(f)=>vt.map(f).join(' + ');
@@ -3736,2 +3791,3 @@ function sfrModel(){
    {type:'note',text:'M_a: applied pedestal moments and the shear couples V·(t + h) about the base of the footing'+(state.stab.shearCouple==='off'?' (couples excluded by input)':'')+'. Pedestal loads act at their load points (x + e_x, y + e_y); self-weights at their centroids.'}]});
+  }   /* SFNB: end of the governing resultant */
   secs.push({title:'Loads and combinations',subs});
@@ -3740,3 +3796,5 @@ function sfrModel(){
  {
-  const subs=[], G=R.govBear, r=G.r, bp=G.bear, w=sfrW();
+  const subs=[], G=R.govBear, w=sfrW();
+  if(!G){subs.push(sfrNoBear('Base pressure (governing combination)','S-bp',true));subs.push(sfrNoBear('Allowable bearing and bearing check','S-qa'));}   /* SFNB */
+  else{const r=G.r, bp=G.bear;
   w.add({id:'kern',label:'Kern (middle third) index',sym:'k',eq:'\\frac{6|e_{x}|}{B} + \\frac{6|e_{y}|}{L}',sub:'\\frac{6\\cdot'+sfrN(Math.abs(r.ex),3)+'}{'+sfrN(R.B)+'} + \\frac{6\\cdot'+sfrN(Math.abs(r.ey),3)+'}{'+sfrN(R.L)+'}',value:bp.kern||0,unit:'',d:3,
@@ -3792,2 +3850,3 @@ function sfrModel(){
   if(T.length)subs.push({title:'Allowable bearing and bearing check',key:'S-qa',items:[sfrTopics('cap',T,{title:'Governing combination: '+G.cb.name})]});
+  }   /* SFNB: end of the governing pressure and check */
   subs.push({title:'Bearing, every combination',items:[{type:'table',wide:true,head:['Combination','ΣP (kip)','e_x (ft)','e_y (ft)','q_max (ksf)','contact (%)','DCR'],
@@ -5195,16 +5254,38 @@ function renderConsistency(){
 }
+/* SFNB safety net (2026-11-06, engineer): each renderer runs on its own (try / catch). One that throws is logged to the console and the
+   tab (or panel) it draws gets a red "Out of date" banner (and its tab button a red mark), so stale results never look current; the next
+   successful render of that tab removes it. Display only: nothing is computed here, and when nothing throws nothing changes. */
+const SFD_OOD=new Set();   /* 'tab id|renderer name' of the renderers whose last run failed */
+function sfdPlotTabs(){return [...new Set([...document.querySelectorAll('.tabpage [id^="plot-"]')].map(e=>e.closest('.tabpage')).filter(Boolean).map(e=>e.id))];}
+function sfdRun(ids,name,fn){
+ try{fn();return true;}
+ catch(e){console.error('Spread Footing: '+name+' failed; the tab it draws is marked out of date.',e);
+  (typeof ids==='function'?ids():ids||[]).forEach(id=>SFD_OOD.add(id+'|'+name));return false;}}
+function sfdMarkOod(id,bad){
+ const T=document.getElementById(id);if(!T)return;
+ let b=[...T.children].find(c=>c.classList&&c.classList.contains('sfdOod'));
+ if(bad&&!b){b=el('div','errbox sfdOod','<b>Out of date: an error stopped this tab updating.</b> What is shown here is from an earlier analysis and may not match the inputs. The error is in the browser console (F12).');T.insertBefore(b,T.firstChild);}
+ if(!bad&&b)b.remove();
+ const btn=document.querySelector('#tabbar button[data-tab="'+id+'"]');if(btn)btn.classList.toggle('sfdTabErr',!!bad);}
+/* run renderers ([ids, name, fn]); afterwards each tab they draw is marked out of date while any renderer's last run on it failed */
+function sfdRunAll(list){
+ const ran=new Set();list.forEach(([ids,name,fn])=>{(typeof ids==='function'?ids():ids||[]).forEach(id=>{ran.add(id);SFD_OOD.delete(id+'|'+name);});});
+ list.forEach(([ids,name,fn])=>sfdRun(ids,name,fn));
+ ran.forEach(id=>sfdMarkOod(id,[...SFD_OOD].some(k=>k.startsWith(id+'|'))));}
 function recalc(){
  clearTimeout(rcTimer);sfdSetStale(false);   /* SFAC */
- R=computeAll();
- P2=R.fatal?null:computePhase2(R);
- if(P2&&!P2.noCombo)P2.dev=sfdDevAll();   /* SFDV */
- renderDashboard();sfdDashDecorate();renderWarnings();renderConsistency();   /* SFDC */
- if(!R.fatal){renderSchematic();renderCombos();renderBearing();renderStability();renderFootingDesign();renderPedestalDesign();renderPlots();}
- else{['tab-schem','tab-combos','tab-bearing','tab-stab','tab-footdes','tab-peddes'].forEach(id=>{$('#'+id).innerHTML='';});}
- if($('#tab-3d').classList.contains('active')||$('#v3dwrap'))renderView3D();
- if($('#tab-report').classList.contains('active'))renderReport();   /* SFRP */
- if($('#tab-drawings').classList.contains('active'))renderDrawings();   /* SFDW */
- sfdInputTabMarks();
- sfdRebarInfo();   /* Reinforcement input tab: A_b, A_s per ft, s vs s_max (display only) */
- sfdPedBarInfo();   /* SFRQ */
+ const ALL=['dashboard','warnings','tab-schem','tab-combos','tab-bearing','tab-stab','tab-footdes','tab-peddes','tab-3d','tab-report','tab-drawings'];
+ ALL.forEach(id=>SFD_OOD.delete(id+'|computeAll'));
+ if(!sfdRun(ALL,'computeAll',()=>{R=computeAll();P2=R.fatal?null:computePhase2(R);if(P2&&!P2.noCombo)P2.dev=sfdDevAll();})){ALL.forEach(id=>sfdMarkOod(id,true));return;}   /* SFDV */
+ const L=[[['dashboard'],'renderDashboard',()=>{renderDashboard();sfdDashDecorate();}],[['warnings'],'renderWarnings',()=>{renderWarnings();renderConsistency();}]];   /* SFDC */
+ if(!R.fatal){L.push([['tab-schem'],'renderSchematic',renderSchematic],[['tab-combos'],'renderCombos',renderCombos],[['tab-bearing'],'renderBearing',renderBearing],[['tab-stab'],'renderStability',renderStability],
+  [['tab-footdes'],'renderFootingDesign',renderFootingDesign],[['tab-peddes'],'renderPedestalDesign',renderPedestalDesign],[sfdPlotTabs,'renderPlots',renderPlots]);}
+ else{['tab-schem','tab-combos','tab-bearing','tab-stab','tab-footdes','tab-peddes'].forEach(id=>{$('#'+id).innerHTML='';sfdMarkOod(id,false);});}
+ if($('#tab-3d').classList.contains('active')||$('#v3dwrap'))L.push([['tab-3d'],'renderView3D',renderView3D]);
+ if($('#tab-report').classList.contains('active'))L.push([['tab-report'],'renderReport',renderReport]);   /* SFRP */
+ if($('#tab-drawings').classList.contains('active'))L.push([['tab-drawings'],'renderDrawings',renderDrawings]);   /* SFDW */
+ L.push([[],'sfdInputTabMarks',sfdInputTabMarks]);
+ L.push([[],'sfdRebarInfo',sfdRebarInfo]);   /* Reinforcement input tab: A_b, A_s per ft, s vs s_max (display only) */
+ L.push([[],'sfdPedBarInfo',sfdPedBarInfo]);   /* SFRQ */
+ sfdRunAll(L);
  if(typeof buildManualTab==='function'&&$('#manualHost')&&!$('#manualHost').childNodes.length)buildManualTab();
@@ -5259,6 +5340,8 @@ $('#tabbar').addEventListener('click',e=>{
  b.classList.add('active');$('#'+b.dataset.tab).classList.add('active');
- if(b.dataset.tab==='tab-3d'){renderView3D();V3D.needsRender=true;}
- if(b.dataset.tab==='tab-report')renderReport();   /* SFRP */
- if(b.dataset.tab==='tab-drawings')renderDrawings();   /* SFDW */
- renderPlots();
+ const L=[];   /* SFNB: each renderer on its own, a failure marks its tab out of date */
+ if(b.dataset.tab==='tab-3d')L.push([['tab-3d'],'renderView3D',()=>{renderView3D();V3D.needsRender=true;}]);
+ if(b.dataset.tab==='tab-report')L.push([['tab-report'],'renderReport',renderReport]);   /* SFRP */
+ if(b.dataset.tab==='tab-drawings')L.push([['tab-drawings'],'renderDrawings',renderDrawings]);   /* SFDW */
+ if(R&&!R.fatal)L.push([sfdPlotTabs,'renderPlots',renderPlots]);else renderPlots();
+ sfdRunAll(L);
 });
```
- **§4:** no calculation change. `computeAll` is untouched: the governing bearing selection (finite D/Cs only) is as before. Combinations with D/C = ∞ are still excluded (that is SFNB-2, the next PR).
- **Check case (direct, default project, V_y = 600 k on Ped 1):** both brackets off the footing: ΣP = 655.93 k, e_y = 4.12 ft ≥ L/2 = 4.00 ft (dead ×1.2); 642.45 k, e_y = 4.20 ft (dead ×0.9). Before: the page threw in `renderPedCb`, tabs 3–10 stale. After: Bearing FAIL with those two reasons, card 2.6 shows the entered loads, the Report renders with the notes; Stability shows overturning FS 0.95, sliding as before.
- **How verified:**
  - SF harness (10 cases: def, rev, sfe, sfe5, dir, sfe9, revEx, thin, revHook, edgeHook), origin/main vs branch: `R`, `P2` 0 differences; dashboard text and Report text identical; 0 console / KaTeX errors.
  - New `tests/smoke/spread-footing-nobear.mjs`: the 11 triggers above (plus two selector picks): 0 console errors, no banner, Bearing chip and tab FAIL with a reason, card 2.6 renders, Stability shows overturning / sliding, Report renders with the reason and the other checks, 0 KaTeX errors; default project PASS and no banner; a renderer made to throw marks only its tab, logs to the console, and the banner goes at the next good render.
  - Mixed contact (case, wall 1.5 × 6, Wy.V_y = 600): "min 44.98% of footing (of the 12 combinations in contact) — resultant off the footing (4 of 16 combinations)".
  - Tests: check-syntax, spread-footing-scroll, phone-layout --tool sf, project-library --tool spreadfooting, start-chooser. Screenshots of the Bearing tab, card 2.6, the Report and the safety-net banner checked.
- **Saved data:** none (no key, field or format change).
- **Other copies:** none.
- **Open item (engineer):** when SOME combinations are off the footing and others have a finite D/C, the governing bearing check uses the latter (PASS possible); the off-footing combinations are errors in the warnings and fail the Overturning and Contact chips. Not changed; confirm this is intended.

## 2026-11-06 — PR: claude/sf-inf-dcr (PR #921: https://github.com/mlococo88/All-Structural/pull/921) (SFNB-2: a service combination with bearing D/C = ∞ (zero or failed bearing capacity) is included and governs bearing as FAIL; CALCULATION CHANGE, pass / fail logic; unchanged when every D/C is finite)

- **Why (engineer decision 2, 2026-11-06):** `computeAll` kept only finite D/Cs for the governing bearing combination (`asd.filter(a=>a.DCR!==null&&isFinite(a.DCR))`). A combination with D/C = ∞ was silently left out. That happens with Vesić i_q = 0 when H ≥ V + A′c/tanφ (with c = 0, H ≥ V), with a failed capacity calculation, or with q_a ≤ 0 (direct). Example: case mode, shear couple off, B = L = 18 ft, Wx.V_x = 250 k per pedestal. Here 0.6D ± 0.6Wx has H = 300 > V = 270.2 and shows D/C ∞ in table 2.3, yet the dashboard read Bearing (service) PASS 0.91 with no bearing warning. Unconservative.
- **Where / exact code (`Spread Footing.html`):**
  - `computeAll`, anchor `/* SFNB-2 (2026-11-06, engineer; CALCULATION CHANGE)`:
    - before: `const valid=asd.filter(a=>a.DCR!==null&&isFinite(a.DCR));`
    - after: `const valid=asd.filter(a=>a.DCR!==null&&!isNaN(a.DCR));`
    
    `govBear` is still the largest D/C (`reduce`, the first ∞ when several), so an ∞ row governs. Rows with no D/C (resultant off the footing, net load not downward: `DCR` null) are still not candidates (SFNB-1 handles "none").
  - `computeAll`, after the unstable-combination errors:
    ```js
    asd.filter(a=>a.DCR===Infinity).forEach(a=>W.push({lvl:'err',design:true,msg:'Bearing FAIL, combination "'+a.cb.name+'": '+sfdBearWhy(a)+' — bearing D/C = ∞.'}));
    ```
    It adds one error per ∞ combination, naming it with its reason (`sfdBearWhy`, SFNB-1). `design:true` keeps it out of the input-validation count.
  - Display:
    - Dashboard chip: `+(R.govBear.DCR===Infinity?': '+sfEsc(sfdBearWhy(R.govBear)):'')`, e.g. "DCR = ∞ — 0.6D + 0.6(+Wx): zero bearing capacity: H = 300.00 kip ≥ V = 270.22 kip, inclination factor i_q = 0 (Vesić)".
    - Bearing tab: card 3.1 gets an errbox "Bearing: FAIL, D/C = ∞. <reason>. Worked in 3.3". Card 3.3 (Vesić and direct) gets an errbox "D/C = ∞ (FAIL): <reason>", and the Vesić "capacity cannot be computed" box adds "D/C = ∞ (FAIL)".
    - Plot 2.4: an ∞ D/C is drawn as a red bar at max(1.5, 1.1 × the largest finite D/C), labelled ∞. It was a zero-height bar.
    - Report: in the DCR step `value:G.DCR===Infinity?'∞':G.DCR` (SharedSteps printed a non-finite number as "—"). S-qa gets a warn note "Bearing: FAIL, D/C = ∞ (<combination>): <reason>.", and stands as that note alone when the Vesić capacity failed. "Bearing, every combination" gets one note per ∞ row.
    - Table 2.3 already showed ∞; the governing row is now that one (bold).
- **Governing provision:** Vesić general bearing-capacity equation with load inclination factors, as AASHTO LRFD 10th Ed. (2024) Art. 10.6.3.1.2a (i_q = (1 − H/(V + A′c cotφ))^m; at H ≥ V + A′c cotφ the base is 0, so i_q = i_γ = 0). Service check per ASCE 7-16 §2.4.1. Direct: q ≤ q_a. No formula or factor changed: only which combinations take part in the governing (pass / fail) selection.
- **Check case 1 (B = L = 18 ft, shear couple off, case mode, Vesić default soil φ = 32°, c = 0, FS = 3, Wx.V_x = 250 k on each of the two pedestals):**
  - **Before:** governing "D + 0.6(+Wx)", PASS, DCR 0.911.
    - H = 0.6·(250 + 250) = 300 k; V = 450.36 k; e_x = 0.200 ft.
    - B′ = 18 − 2·0.200 = 17.600, L′ = 18, A′ = 316.81 ft²; m = 1.506.
    - i_q = (1 − 300/450.36)^1.506 = 0.3339^1.506 = 0.192; q_ult = 0 + 3.436 + 1.244 = 4.680 ksf; q_allow = 4.680/3 = 1.560 ksf.
    - q_eff = 450.36/316.81 = 1.422 ksf; DCR = 1.422/1.560 = 0.911.
    - 0.6D ± 0.6Wx (D/C ∞) left out; no bearing warning.
  - **After:** governing "0.6D + 0.6(+Wx)", FAIL, DCR ∞.
    - H = 300 k; V = 0.6·450.36 = 270.22 k; c = 0, so 1 − H/V = 1 − 300/270.22 = −0.110 → 0; i_q = i_γ = 0.
    - q_ult = 0 + 0 + 0 = 0; q_allow = 0.
    - q_eff = 270.22/316.81 = 0.853 ksf; DCR = 0.853/0 = ∞.
    - Two errors (0.6D ± 0.6Wx), and the i_q < 0.30 warning now applies to the governing combination.
- **Check case 2 (direct factored mode, default project, Ped 1 V_x = 648.9 k; Ped 2 V_x = 8 k):** H = 656.9 k.
  - Dead ×1.2: V = 655.93 k, e_x = 4.845 ft, B′ = 0.310, L′ = 8, A′ = 2.478 ft², q_eff = 264.69 ksf; i_q = 0 (H > V), q_allow = 0.
  - Dead ×0.9: V = 642.45 k; i_q = 0.
  - **Before (SFNB-1):** no governing combination; Bearing FAIL "no bearing solution…: zero bearing capacity: H = 656.90 kip ≥ V = 655.93 kip, i_q = 0" (before SFNB-1 the page threw).
  - **After:** governing "Direct LRFD (dead ×1.2)", DCR ∞, FAIL, with the same reason; two errors.
- **Cases that move:** only those with an ∞ D/C. The SF harness (10 cases: def, rev, sfe, sfe5, dir, sfe9, revEx, thin, revHook, edgeHook) has none. origin/main vs branch: `R`, `P2` 0 differences, dashboard and Report text identical, 0 console / KaTeX errors. The smoke cases that move: direct V_x = 660 (now governs ∞), case direct soil q_a = 0 (now governs ∞, "D", with 10 errors), B = L = 18 above.
- **How verified:** the SF harness as above; `tests/smoke/spread-footing-nobear.mjs` (case B = L = 18 added: governing D/C ∞ with the reason on the chip); check-syntax, spread-footing-scroll, phone-layout --tool sf, project-library --tool spreadfooting, start-chooser. Screenshots of the dashboard / Bearing tab, table 2.3 and the Report S-qa checked.
- **Saved data:** none.
- **Other copies:** none.

## 2026-11-06 — PR: claude/sf-off-governs (PR #923: https://github.com/mlococo88/All-Structural/pull/923) (SFNB-3: a service combination with no bearing solution (resultant off the footing, or net load not downward) has bearing D/C = ∞ and governs bearing as FAIL, also when other combinations have finite D/Cs; CALCULATION CHANGE, pass / fail logic; unchanged when every combination has a bearing solution)

- **Why (engineer, 2026-11-06, answer to the SFNB-1 open item):** any service combination whose resultant is off the footing must make Bearing FAIL, consistent with the ∞ rule (SFNB-2), even when other combinations have a finite D/C. Net-uplift combinations ("net load not downward") get the same treatment. Overturning and Contact area stay as they are.
- **Before:** such a combination had `DCR = null` and was left out of the governing selection. Bearing could PASS on the remaining combinations: only the "unstable" error, the Overturning chip and the Contact chip flagged it.
- **Where / exact code (`Spread Footing.html`):**
  - `computeAll`, the ASD map, before `return{cb,r,bear,cap,DCR,…}` (anchor `/* SFNB-3 (2026-11-06, engineer; CALCULATION CHANGE`): `if(DCR===null)DCR=Infinity;`. The SFNB-2 selection (`a.DCR!==null&&!isNaN(a.DCR)`, largest D/C, first ∞ on a tie) then makes it govern. Because every service combination now has a D/C, `R.govBear` is null only with no combinations. The SFNB-1 "no governing combination" displays stay, but no input now reaches them.
  - Warnings:
    - A new error after the minimum-contact warning: `Bearing FAIL: n combination(s) with no bearing solution (bearing D/C = ∞): "<name>": <reason>; …`.
    - The SFNB-2 per-combination ∞ error is limited to combinations that have a bearing solution (`unstable.indexOf(a)<0`), so nothing is repeated.
    - `sfdBearWhy(a,dB,dL)` takes the footing B, L when called from `computeAll` (R is not set yet).
  - Bearing tab:
    - Card 3.3 has a new branch when the governing (or selected) combination has no capacity (`!g.cap`): "3.3 Bearing Check — No Bearing Solution" with "D/C = ∞ (FAIL): <reason>". Before, `g.cap.fail` threw for a selected off-footing combination.
    - With an LRFD row selected, card 3.1 states the service bearing FAIL.
    - Card 3.2: a combination with net uplift (`bp.mode==='tension'`) now reads "Net vertical load is not downward (ΣP = … kip ≤ 0) — no bearing pressure, no contact. Bearing D/C = ∞ (FAIL)." Before, it read "Resultant falls outside the footing footprint", which is the off-footing message. The off-footing message adds "Bearing D/C = ∞ (FAIL): <reason>" for a service combination.
  - Report: when `!G.cap`, S-bp "Base pressure (governing combination) — no solution" and S-qa become warn notes with the reason. Its resultant is still worked in S-res. The "every combination" table and its ∞ notes, table 2.3 ("∞") and plot 2.4 (red ∞ bar) follow from the D/C.
- **Governing provision:** no formula changed. The bearing check (ASCE 7-16 §2.4.1 service; Vesić / AASHTO LRFD 10th Ed. Art. 10.6.3.1.2a, or the direct q_a) is evaluated only where a no-tension pressure solution exists. A combination without one (|e_x| ≥ B/2 or |e_y| ≥ L/2, or ΣP ≤ 0) cannot be supported in bearing, so it fails the check: D/C = ∞.
- **Check case 1 (direct factored mode, default project, Ped 1 V_y = 578 k, between the bracket thresholds 571.7 and 583.9 k):**
  - Dead ×1.2: ΣP = 655.93 k, e_y = 3.965 ft < L/2 = 4.00, partial contact 0.99 %, q_eff = 1040.4 ksf, q_allow = 0.0533 ksf, DCR 19,521.4.
  - Dead ×0.9: ΣP = 642.45 k, e_y = M_x/P = 2601.0/642.45 = 4.049 ft ≥ 4.00, off the footing.
  - **Before:** governing "Direct LRFD (dead ×1.2)", DCR 19,521.42, FAIL; the ×0.9 bracket left out.
  - **After:** governing "Direct LRFD (dead ×0.9, min)", D/C ∞, FAIL, "resultant off the footing: |e_y| 4.05 ft ≥ L/2 4.00 ft".
  - Overturning (FS 0.99, FAIL) and Contact (min 0.99 %, 1 of 2 off, FAIL) are unchanged.
- **Check case 2 (case mode, direct soil q_a = 15 ksf gross, Wx.P = −300 k on each pedestal):**
  - D + 0.6(+Wx): ΣP = 314.94 + 0.6·(−300 − 300) = −45.06 k, net load not downward. 0.6D + 0.6(+Wx): −171.04 k.
  - **Before:** governing "D + 0.75L + 0.45(−Wx) + 0.75S", ΣP = 704.94 k, q_max = 9.919 ksf, DCR = 9.919/15 = 0.661, **PASS**.
  - **After:** governing "D + 0.6(+Wx)", D/C ∞, **FAIL**, "net load not downward: ΣP = −45.06 kip".
  - Overturning FS 0.48 FAIL and Contact FAIL are unchanged.
- **Other examples that move:**
  - Case wall 1.5 × 6 ft, Wy.V_y = 600 k: was "D + 0.75L + 0.45(+Wy) + 0.75S" DCR 22.95 FAIL; now "D + 0.6(+Wy)" ∞ FAIL (|e_y| 5.13 ≥ 4.00).
  - Case B = L = 1 ft: now "D + S" ∞.
  - Every input that had no governing combination (SFNB-1 triggers) now governs with D/C ∞ and the same reason.
  - Side effect in the self-consistency list: the "No-tension solver residual" row applies only to a governing combination in partial contact, so it drops out of the V_y = 578 case. The other four MISMATCH rows there (Phase 2 diagrams at 0.99 % contact) are present on main too.
- **Harness:** SF harness (10 cases), origin/main vs branch: `R`, `P2` 0 differences; dashboard and Report text identical; 0 console / KaTeX errors. No harness case has a combination without a bearing solution, so none moved.
- **How verified:**
  - `tests/smoke/spread-footing-nobear.mjs`: the two check cases added (governing D/C ∞ with the reason on the chip); every earlier trigger now governs ∞; the LRFD-pick view states the FAIL.
  - A renderer sweep over 38 inputs (selector picks included): no renderer error, no Out-of-date banner, no Report error.
  - check-syntax, spread-footing-scroll, phone-layout --tool sf, project-library --tool spreadfooting, start-chooser. Screenshots checked.
- **Saved data:** none. **Other copies:** none.

## 2026-11-07 — PR: claude/sf-h2-phi-fy (PR #967: https://github.com/mlococo88/All-Structural/pull/967) (SFPY: φ by net tensile strain uses ε_ty = f_y/E_s, ACI 318-19 Table 21.2.2 and 21.2.2.1; CALCULATION CHANGE for f_y > 60,000 psi only; Grade 60 and below unchanged)

- **Problem:** `phiFlexure` used fixed strain limits, 0.002 (compression-controlled) and 0.005 (tension-controlled), for every f_y. ACI 318-19 Table 21.2.2 sets the limits at ε_ty and ε_ty + 0.003, with ε_ty = f_y/E_s (21.2.2.1); 0.002 is permitted only for Grade 60. For Grade 80 or 100 bars in the transition zone the old φ was too high (unconservative): pedestal P–M (strain compatibility, `pmContour.phiOf`), dowel interface tension (through `sfpmRatios`) and footing flexure (`flexCap`) all used it.
- **Where / exact code (`Spread Footing.html`, Phase 2 engine, anchor `/* SFPY (2026-11-07)`):**
  - Before: `function phiFlexure(eps_t){ … if(eps_t>=0.005)return 0.90; if(eps_t<=0.002)return 0.65; return 0.65+0.25*(eps_t-0.002)/0.003;}`
  - After: new `function sfdEty(fy){return (fy>60000)?fy/29000000:0.002;}` and `function phiFlexure(eps_t,fy){ const ety=sfdEty(fy); if(eps_t>=ety+0.003)return 0.90; if(eps_t<=ety)return 0.65; return 0.65+0.25*(eps_t-ety)/0.003;}`
  - `flexCap`: `const phi=phiFlexure(eps_t,fy);` (before `phiFlexure(eps_t)`).
  - `pmContour` → `phiOf`: `return phiFlexure(et,fy);` (before `phiFlexure(et)`). `fy` is already a parameter of `pmContour`.
  - Report, footing flexure step `phi`: the label now states ε_ty and the tension-controlled limit (display only).
- **Governing provision:** ACI 318-19 Table 21.2.2 (rows (b), (d), (f): "Other" transverse reinforcement), 21.2.2.1 (ε_ty = f_y/E_s; 0.002 permitted for Grade 60), 20.2.2.2 (E_s = 29,000,000 psi). Checked on the printed pages (PDF pp. 394–395).
- **Decision (pending engineer review):** for f_y < 60,000 psi the tool keeps ε_ty = 0.002. The code value f_y/E_s is smaller (Grade 40: 0.00138), which would give a higher φ; keeping 0.002 never raises φ above the previous value (conservative).
- **Check case 1 (the function, Grade 80, ε_t = 0.0040):** ε_ty = 80,000/29,000,000 = 0.002759; tension-controlled at 0.005759.
  - Before: φ = 0.65 + 0.25(0.0040 − 0.002)/0.003 = **0.817**.
  - After: φ = 0.65 + 0.25(0.0040 − 0.002759)/0.003 = **0.753**.
  - Grade 60, ε_t = 0.0040: 0.817 before and after (ε_ty = 0.002). Grade 80, ε_t = 0.0058: 0.900 (≥ 0.005759).
- **Check case 2 (default project, f_y = 80,000 psi, harness case `fy80`):** pedestal P–M (biaxial), governing combination 1.2D + 1.0(+Wx) + L + 0.5S:
  - Ped 1 ratio 0.0581 → **0.0647**; Ped 2 0.0636 → **0.0682** (capacity at P_u = 204.8 k: |φM_n| 251.55 → 234.65 kip-ft).
  - Footing flexure unchanged: ε_t = 0.0285 / 0.0297 ≥ 0.005759, φ = 0.90.
- **Grade 60 unchanged (proof):** with f_y = 60,000 psi, `sfdEty` returns 0.002 and 0.002 + 0.003 === 0.005 in IEEE arithmetic, so both branches and the interpolation are the same expressions as before. SF harness (16 cases: def, rev, sfe, sfe5, dir, sfe9, revEx, thin, revHook, edgeHook, slender, devsec, sey = Seymour as saved, wt, seyW, fy80), origin/main vs branch: `R` and `P2` 0 differences in every Grade 60 case (15 of 16); only `fy80` moves (52 values, all P–M ratios and capacities). Dashboard text identical in the Grade 60 cases; the Report differs only in the φ label. 0 console / KaTeX errors.
- **How verified:** SF harness as above; `phiFlexure` evaluated in Node at the check points; check-syntax, spread-footing-scroll, phone-layout --tool sf, project-library --tool spreadfooting, start-chooser, spread-footing-nobear.
- **Saved data:** none. **Other copies:** none (the φ function is local to this tool).

## 2026-11-07 — PR: claude/sf-h1-slender (PR #974: https://github.com/mlococo88/All-Structural/pull/974) (SFSL: slender pedestal: P–M check with moment magnification, ACI 318-19 6.6.4; fails where unstable or beyond 1.4× first order, 6.2.5.3; CALCULATION CHANGE for slender pedestals only)

- **Problem:** when k ℓ_u/r > 22 (6.2.5.1(a), k = 2.0 since SFKS), the tool showed a "slender" flag but the P–M ratio used the first-order base moments, so the pedestal could PASS silently.
- **Where / exact code (`Spread Footing.html`):**
  - `netResultant` (anchor `/* SFSL: factored sustained axial and pedestal-base moments */`): each `pl` entry gets `sus:{P,mx,my}`, the factored dead share (pedestal self-weight plus the D load type: P, and the base moments `mx + P e_y + V_y h`, `my + P e_x + V_x h`). In direct factored mode it is `null` (no dead / live split).
  - New `sfslMag(pt,g)` (anchor `/* ---- SFSL (2026-11-07): moment magnification of a slender pedestal`). Per combination and per axis:
    - E_c = 57√f′c ksi; (EI)_eff = 0.4E_cI_g/(1 + β).
    - P_c,s = π²(EI)_eff/(2h)², with β_ds.
    - δ_s = 1/(1 − P_u/(0.75P_c,s)) ≥ 1.
    - P_c,ns = π²(EI)_eff/h², with β_dns; δ = C_m/(1 − P_u/(0.75P_c,ns)) ≥ 1, C_m = 1.0.
    - M_2,min = P_u(0.6 + 0.03b)/12.
    - M_c = δ·max(δ_s|M_u|, M_2,min).
    - The minimum is applied about one axis at a time: point A uses the minimum about x, point B the minimum about y.
    - `unstable` when 1 − P_u/(0.75P_c) ≤ 0; `over14` when δ_sδ > 1.4 on an axis with a non-zero first-order moment.
  - `pedDes`:
    - Before: `const pmRat=isPatch?[]:sfpmRatios(pmBars,bx,by,fc,fy,pmPts,phiPn_max);`
    - After: `pmRat1` = that first-order result (kept). When `slenderFlag`, `pmRat` = per combination the worse of `sfpmRatios` on the A and B points (mode `'unstable'`, ratio ∞, where unstable). `pmPts` become the magnified points (the P–M plot), plus `slm`, `slGov`, `slFail`.
  - Displays:
    - Dashboard "Pedestal design": a fail reason when `slFail`. "Pedestal P–M (biaxial)": "slender: moments magnified … δ_sδ up to …".
    - Report: Ties and slenderness step `sl` (ok = !slFail) and a new topic "Moment magnification, slender pedestal" worked for the governing combination. A P–M branch for mode `'unstable'`.
    - Pedestal tab: an eqBlock after the slenderness screen, plus a failbox. Pedestal table: "YES (magnified)" / "YES (NG)". 3D pick table: MAGNIFIED / NG with δ_sδ.
- **Governing provisions (ACI 318-19, printed pages checked):**
  - 6.2.5.1(a) slenderness limit; 6.2.5.3 (second-order M_u ≤ 1.4 × first order).
  - 6.6.4.4.2 (P_c), 6.6.4.4.3 (k ≥ 1 for sway), 6.6.4.4.4(a) ((EI)_eff).
  - 6.6.4.6.1 / 6.6.4.6.2(b) (δ_s, with β_ds in place of β_dns); 6.6.4.6.4 → 6.6.4.5.1–6.6.4.5.4 (along the length; C_m; M_2,min).
  - 19.2.2.1(b) (E_c).
- **Decisions (pending engineer review), all conservative:**
  - The pedestal is a sway cantilever (fixed at the footing, free at the top).
  - All of the first-order base moment is treated as a sway moment (M_2ns = 0).
  - δ_s is computed for this pedestal alone (no story averaging).
  - C_m = 1.0.
  - β_ds = |dead-load share of M_u| / |M_u| about each axis; β_dns = factored dead axial / P_u. Both are 1.0 in direct factored mode.
  - Both axes are magnified whenever the pedestal is slender about its weaker axis.
  - M_2,min about one axis is combined with the actual (magnified) moment about the other. This is "each axis separately" in the sense of R6.6.4.5.4: the minimum is never applied about both axes at once.
- **Check case (harness `slender`: default project, both pedestals h = 8 ft, 18 × 18 in, Ped 2 Wx V_x = 20 k; k ℓ_u/r = 2·96/5.4 = 35.6 > 22).** Ped 2, combination 1.2D + 1.0(+Wx) + L + 0.5S, P_u = 273.24 k, M_uy = 160.0 kip-ft, M_ux = 0:
  - I_g = 18⁴/12 = 8748 in⁴; E_c = 57√4000 = 3605 ksi; (EI)_eff,s = 0.4·3605·8748 = 12.61 × 10⁶ kip-in² (β_ds = 0).
  - P_c,s = π²·12.61e6/192² = 3377.3 k; δ_s = 1/(1 − 273.24/(0.75·3377.3)) = **1.121**.
  - β_dns = 183.24/273.24 = 0.671 (1.2·(150 + 2.70)); (EI)_eff,ns = 12.61e6/1.671 = 7.55e6; P_c,ns = π²·7.55e6/96² = 8086 k; δ = 1/(1 − 273.24/6065) = **1.047**.
  - About y: M_c = 1.047·1.121·160.0 = **187.8** kip-ft. About x: M_2,min = 273.24·(0.6 + 0.03·18)/12 = 25.96 → M_c = 1.047·25.96 = **27.2** kip-ft.
  - δ_sδ = 1.174 ≤ 1.4.
  - **Before:** P–M ratio **0.649** (160.0 / 246.56), PASS, and the slender flag only.
  - **After:** **0.864** (point A: M_ux = 27.2 with M_uy = 187.8). Without the minimum about x (point B) it is 0.762. With δ_s alone (the review's estimate) it is ≈ 0.72.
  - Ped 1: 0.255 → 0.347 (governing combination now 1.2D + 1.0(−Wx) + L + 0.5S).
- **Cases that move:** only `slender`. The other 15 harness cases are not slender. Their only differences are the new `sus` fields on `combos[].nr.pl` (data, no result).
- **Saved data:** none. **Other copies:** none.

## 2026-11-07 — PR: claude/sf-h3-transverse-strip (PR #982: https://github.com/mlococo88/All-Structural/pull/982) (SFTX: combined footing, transverse strip under each pedestal (width c + d) checked alongside the full width; governing bottom D/C = the larger; CALCULATION CHANGE for footings with two or more pedestals)

- **Problem:** in a combined footing the transverse bars were checked on the full footing width, i.e. the transverse moment was spread uniformly. Under a plate the transverse moment concentrates under the pedestals. In the default project the y-bars showed D/C 0.302 where a strip under Ped 2 gives 0.465 (unconservative).
- **Where / exact code (`Spread Footing.html`, `computePhase2`):**
  - New `sfdStrip(dir,dBot,AsBot,fc,fy)` before `const desX=directionDesign('x')` (anchor `/* SFTX (2026-11-07): transverse strip`).
    - Applies with two or more pedestals, in the transverse direction(s): direction x is transverse when the spread of the pedestal centres in x is ≤ 0.25 × their spread in y, and the reverse for y. With neither (a 2-D layout), both directions are transverse.
    - For each pedestal: strip width b_s = c + d, centred on the pedestal (c = pedestal side across the strip, d = d_bot of the bars spanning the strip, d/2 each side, clipped at the footing edges).
    - Loads on the strip: the pedestals whose centres lie in it (P_u and the moment in the strip direction at the footing base). They are balanced by a linear no-tension soil pressure over the strip length.
    - The moment at each face (cantilever to the edge, minus the pedestals beyond the face) is integrated numerically (400 points); the largest over the LRFD combinations is used.
    - φM_n = `flexCap(b_s, d, A_s/ft·b_s)`. A strip whose resultant falls outside its length has D/C = ∞ (NG).
  - `directionDesign` return:
    - Before: `dcrBot:capBot.phiMn>0?(MuPos*12)/capBot.phiMn:(MuPos>0?Infinity:0),`
    - After: `dcrBotFull:` the same expression, and `strip:sfdStrip(dir,dBot,AsBot,fc,fy)`.
    - After both directions: `[desX,desY].forEach(z=>{z.dcrBot=Math.max(z.dcrBotFull,z.strip&&z.strip.applies?z.strip.dcr:0);});`
  - `dcrBot` (dashboard flexure chip, summary table, 3D pick) is now the governing value. The full-width displays (card 5.2 / 5.3 eqBlock, flexure SVG label, Report step `DCRb`) show `dcrBotFull`. A new eqBlock and note on the card, and a Report topic "Transverse strip under each pedestal" (b_s, M_u,strip, A_s,strip, φM_n,strip, D/C per pedestal).
- **Governing provisions:** ACI 318-19 13.3.4.1 (combined footings designed by Chapter 8), 13.3.4.3 (distribution of bearing pressure consistent with established principles), 22.3 (flexural strength). The code fixes no strip width; ACI 336.2R and textbook combined-footing practice design a transverse beam under each column.
- **Decision (pending engineer review):** strip width c + d. Alternatives: c + 1.5d (less conservative), or the full width alone (as before).
- **Check case (default project, y-bars, Ped 2, 1.2D + 1.6L + 0.5S):** P_u = 318.81 k on L = 8 ft gives w = 39.85 k/ft; cantilever 4.00 − 0.75 = 3.25 ft.
  - M = 39.85·3.25²/2 = **210.46** kip-ft.
  - b_s = 18 + 26.5 = 44.5 in; A_s = 1.0533·3.708 = 3.906 in²; a = 3.906·60/(0.85·4·44.5) = 1.549 in.
  - φM_n = 0.9·3.906·60·(26.5 − 0.775)/12 = **452.2** kip-ft; D/C = **0.465**.
  - Before: y-bars bottom D/C **0.302** (full width). After: **0.465** (strip governs). Ped 1 strip: 158.97 kip-ft, 0.352. x-direction (longitudinal): no strip, unchanged 0.057.
- **Seymour:** pedestals in line along y, so x is transverse.
  - Strips: Ped 1 20.21 kip-ft on b_s = 127.9 in, D/C 0.025; Ped 2 8.67 kip-ft on b_s = 47.9 in, D/C **0.028** (x full width 0.025).
  - The governing flexure (y, 0.687) is unchanged.
- **Saved data:** none. **Other copies:** none.

## 2026-11-07 — PR: claude/sf-left-breakpoint (PR #988: https://github.com/mlococo88/All-Structural/pull/988) — Summary dashboard as a left column from 1200 px (was 1500 px); 240 px wide from 1200 to 1499 px (SFLB; display only, no result change)

### SFLB. The summary dashboard is on the left at common laptop widths   [display only]
- **Decision (pending engineer review):** the engineer asked (2026-11-07, for the Retaining Wall Designer) for "the summary cards … on the left panel", most likely at a laptop width below 1500 px, where SFDC (#737) put the dashboard above the output tabs. The left column now starts at **1200 px** in Spread Footing, Retaining Wall Designer (RWLB, #984) and Light Pole and Sign Post alike. From 1200 to 1499 px it is **240 px** wide; at 1500 px and wider 280 px as before (layout and panel widths unchanged there). Below 1200 px nothing changes (dashboard above the output tabs; phone stacking, SFPH). Same collapse button (« / » → 42 px strip) and key `sfd_dashCollapsed_v1`.
- **Output panel at 1200–1499 px with the column open:** 508–748 px wide (the input panel keeps its 400 px minimum), as the output panel already is at 950–1190 px without the column. At those widths the Load Combinations, Pedestal Design, Stability, Footing Design and Report pages are wider than the panel and were cut off at its edge (`.out{overflow-x:hidden}`, an existing condition below 1200 px). With the column open from 1200 to 1499 px, each tab page now scrolls sideways inside itself (`overflow-x:auto`, as on tablets and phones, SFPH), so nothing is cut off and the page itself never scrolls sideways. Measured (main → branch): at 1280 px nothing was cut; now Load Combinations scrolls 161 px, Pedestal Design 92 px, Report 189 px inside their tab page. « (collapse) gives the width back.
- **Where:**
  - CSS: `@media screen and (min-width:1500px){` (the SFDC block, anchor `.wrap{max-width:1892px}`) → `@media screen and (min-width:1200px){` with a comment `/* SFLB … */` above; after that block, added:
```css
@media screen and (min-width:1200px) and (max-width:1499.98px){   /* SFLB */
 body.sfdDashWide #sfdDashCol{flex-basis:240px;width:240px}
 body.sfdDashWide .inp{width:calc((100% - 252px)*.33)}
 body.sfdDashWide.sfdDashColl #sfdDashCol{flex-basis:42px;width:42px}
 body.sfdDashWide.sfdDashColl .inp{width:calc((100% - 54px)*.33)}
 /* … a wide table, plot or Report page scrolls sideways inside its tab page … */
 body.sfdDashWide:not(.sfdDashColl) .tabpage{overflow-x:auto}
}
```
  - JS: `const SFDC={key:'sfd_dashCollapsed_v1',mq:window.matchMedia?window.matchMedia('screen and (min-width:1500px)'):null,…` → `'screen and (min-width:1200px)'` (comment `/* SFLB: was 1500px */`).
  - `tests/smoke/spread-footing-scroll.mjs`: the dashboard-column assertion `vw >= 1500` → `vw >= 1200` (its 1280 and 1366 px sizes now expect the column) and its comments.
- **Formulas, factors, units, code references:** none changed (§4 does not apply). **Saved data (§5):** no key or format changed.
- **How verified:** origin/main vs branch at 1920, 1280 and 1200 px, three projects (default, 2 NG; Direct load mode, 3 NG; B 7 × L 6 ft with water table at 2 ft, 6 NG): `R`, `P2`, `state` (Export JSON), the dashboard text, the Report text (Plotly / SVG figures removed: their tick labels follow the plot width) and every localStorage key and value (the `at` time stamp of `bridgeSuite.v1.projectsUI.spread-footing.start` masked) **identical**; 0 console errors. No sideways page scroll at 390, 768, 1200, 1280, 1400, 1920 px (and no output cut off on any of the ten tabs at 1200, 1280, 1400). Screenshots before / after at 1200, 1280, 1400 and after at 1920, 768, 390 looked at. Tests: check-syntax; spread-footing-scroll; phone-layout sf 390/768; project-library spreadfooting.

## 2026-11-07 — PR: claude/sf-manual-1200 (PR #997: https://github.com/mlococo88/All-Structural/pull/997) — User Manual: the summary dashboard column starts at 1200 px (SFLB follow-up; text only, no result change)
- **Why:** after SFLB (#988) the User Manual still said the dashboard is a left column on screens 1500 px and wider.
- **Where (User Manual, three sentences):**
  - §0 paragraph `The screen is split into an <b>input panel</b> …`: before `On screens 1500&nbsp;px and wider it is a left column`; after `On screens 1200&nbsp;px and wider it is a left column`.
  - next paragraph: before `(under the dashboard on screens narrower than 1500&nbsp;px)`; after `(under the dashboard on screens narrower than 1200&nbsp;px)`.
  - §3.1 `One chip per check family, on one line: …`: before `On screens 1500&nbsp;px and wider the dashboard is a left column`; after `On screens 1200&nbsp;px and wider the dashboard is a left column`.
- **Formulas, factors, units, code references:** none (§4 does not apply). **Saved data:** unchanged.
- **How verified:** origin/main vs branch at 1920 px, three projects (default; Direct mode; B 7 × L 6 ft with water at 2 ft): `R`, `P2`, `state`, dashboard, Report text and localStorage identical (the Manual is not in the Report unless "Include this manual when printing" is ticked); check-syntax passes.

## 2026-11-07 — PR: claude/sf-m3m4-depth-strain (PR #989: https://github.com/mlococo88/All-Structural/pull/989) (SFMD: footing depth d ≥ 6 in, ACI 318-19 13.3.1.2; SFET: footing mats tension-controlled, ACI 318-19 7.3.3.1 / 8.3.3.1; CALCULATION CHANGE, pass / fail logic: two new checks)

- **Problem:** two code limits were not checked.
  - The depth of the bottom reinforcement must be at least 6 in (13.3.1.2).
  - Nonprestressed slabs must be tension-controlled. Footings reach this through 13.3.2.1 (one-way → Chapter 7), 13.3.3.1 (two-way isolated → Chapters 7 and 8) and 13.3.4.1 (combined → Chapter 8).
  - Before, ε_t only lowered φ.
- **Provision verified on the printed pages:** ACI 318-19 7.3.3.1 and 8.3.3.1 require the slab to be **tension-controlled per Table 21.2.2**, i.e. ε_t ≥ ε_ty + 0.003 (0.005 for Grade 60). The "ε_t ≥ 0.004" of the review is the ACI 318-14 limit (9.3.3.1, beams); the 2019 limit is stricter and is used here.
- **Where / exact code (`Spread Footing.html`, `computePhase2`, after the SFTX line `[desX,desY].forEach(z=>{z.dcrBot=…})`; anchor `/* SFET (2026-11-07)`):**
  - `const epsTC=sfdEty(fy)+0.003;` For each direction: `tcBotOK` (bottom mat, `capBot.eps_t`), `tcStripOK` (every SFTX strip, `r.cap.eps_t`) and `tcTopOK` (top mat where it is a flexural mat).
  - `const minDepth={d:Math.min(dBotX,dBotY),min:6}; minDepth.ok=minDepth.d>=6-1e-9;`, returned as `P2.minDepth`.
  - Dashboard "Flexure (footing)": FAIL with "not tension-controlled, ε_t < ε_ty + 0.003 (…)" and / or "d = … in < 6 in (ACI 318-19 13.3.1.2)". Summary reason tags as well.
  - Report: steps `dmin` (Design basis), `tcB` / `tcT` (Flexure) and `st<i>tc` (strip). Card 5.1: a minimum-depth eqBlock and failbox. Cards 5.2 / 5.3: a tension-controlled eqBlock. New helper `sfdF5` (5-decimal strains).
- **Check case M3 (default project, t = 9 in):**
  - d_y = 9 − 3 − 1.0/2 = 5.50 in (outer layer); d_x = 9 − 3 − 1.0 − 0.5 = **4.50 in < 6** → NG.
  - Before: flexure FAIL for A_s,min (top x) only, no depth check. After: the reasons also include "d = 4.50 in < 6 in" and "not tension-controlled (bottom x)", since ε_t = 0.00441 < 0.005.
- **Check case M4 (default project, t = 12 in, bottom x #11 @ 4 in):**
  - A_s = 1.56·12/4 = 4.68 in²/ft; d_x = 12 − 3 − 1.0 − 1.41/2 = 7.295 in.
  - a = 4.68·60/(0.85·4·12) = 6.88 in; c = 6.88/0.85 = 8.10 in > d.
  - ε_t = 0.003(7.295 − 8.10)/8.10 = **−0.0003 < 0.005** → NG (before: not checked).
- **Cases that move:** none of the SF harness cases changes a value. def, sey, rev, slender: new fields only, all checks OK (default ε_t = 0.039 / 0.041, d_min = 25.5 in). thin and m3 / m4 add the new reasons to flexure that was already FAIL.

## 2026-11-07 — PR: claude/sf-m2-dev-faces (PR #1020: https://github.com/mlococo88/All-Structural/pull/1020) (SFDE: footing bar development checked at every pedestal face with moment of that sign, ACI 318-19 13.2.8.3 / 13.2.7.1; CALCULATION CHANGE, pass / fail logic)

- **Problem:** `sfdDevAll` checked ℓ_d / ℓ_dh only at the governing-moment section (`des.govMloc` / `govNegLoc`). ACI 318-19 13.2.8.3 requires the reinforcement to be developed at every critical section of 13.2.7.1, i.e. at each pedestal face. A short cantilever at another pedestal could PASS unseen.
- **Where / exact code (`Spread Footing.html`, `sfdDevAll`, anchor `/* SFDE (2026-11-07)`):**
  - Before:
    - `const endC=sfdEndCover(), avail=(hf-Math.abs(sec))*12-endC; if(!(avail>0))return;`
    - `const strOK=LdUse<=avail+1e-9, hookOK=Ldh<=avail+1e-9;` (one section)
  - After: `cand` = the governing section plus each pedestal face (`R.peds`, x ± b/2 inside the footing) where the envelope moment of that sign over the LRFD combinations (`P2.pressMomentAbout`) exceeds 0.01 kip-ft (bottom bars: sagging; top bars: hogging).
    - Every candidate gets `avail = 12(hf − |s|) − c_end`, a straight / hook status and `dc`.
    - The row reports the worst (fail > review > pass, then the larger dc): `sec`, `avail`, `status`, `dc`, plus `cand` and `wSec`.
    - ℓ_d, ℓ_dh and the 25.4.10.1 option are unchanged. A_s,req stays the governing-section value at every face (conservative).
  - Report: a "Sections checked" step listing each section (M_u, available length, status). The "available" step names the critical face. Card 5.4: a note listing the sections.
- **Governing provisions:** ACI 318-19 13.2.8.3 (development at each critical section), 13.2.7.1 / Table 13.2.7.1 (critical sections at the face of the column or pedestal), 25.4.2.4, 25.4.3.1.
- **Decision (pending engineer review):** every face with a non-zero moment of that sign is checked for the full ℓ_d (or ℓ_dh where hooked), also where the moment there is small. That is code-literal and conservative. Where the face is within the end cover of the edge, the available length is ≤ 0 and the check is NG. The 25.4.10.1 option (A_s,req/A_s,prov) reduces ℓ_d, using the governing-section A_s,req. Alternative, not taken: develop only the force at that face.
- **Check case (harness `devsec`):** B = 12 ft, Ped 1 (D 20, L 10 k) at x = −4.75, Ped 2 (D 250, L 150 k) at x = 1.5, bottom x #6 @ 12 in.
  - Ped 1 outer face x = −5.50 ft: available = 12(6 − 5.5) − 3 = **3 in**; M_u > 0; ℓ_d = 17.1 in, ℓ_dh = 12.1 in > 3 → NG.
  - Before: bottom x-bars **PASS**, D/C 0.28 (section x = 0.75 ft, 60 in available).
  - After: **FAIL**, D/C 4.05 (worst section x = −5.50 ft).
- **Other cases:**
  - `rev` (Seymour-like, Ped 1 b_y = 9.33 ft with faces 0.5 ft from the edges): bottom and top y-bars now NG at y = ±6 ft (3 in available, M_u 2.3 / −0.15 kip-ft), and bottom x-bars worst at Ped 2's face (11 in).
  - Seymour as saved: bottom x-bars were already FAIL, D/C 1.669 → 1.672 (Ped 1 face 1.335 ft). The y-bars are unchanged (PASS).
  - def, edgeHook, thin: no value change.

## 2026-11-07 — PR: claude/sf-m5-flotation (PR #1022: https://github.com/mlococo88/All-Structural/pull/1022) (SFFG: flotation FS on the gross basis and on the earlier net basis, the smaller governs; CALCULATION CHANGE where water is above the base)

- **Problem:** the flotation FS was (W_f + ΣW_ped + EV′)/U, with EV′ at the buoyant soil unit weight below the water table and U the buoyancy of the submerged concrete only. Subtracting the pore-water weight from both terms raises the ratio, although the net margin is the same. The usual definition compares the full uplift on the base, γ_w(D_f − d_w)·BL, with the weights at total unit weight. That is consistent with ASCE 7-16 2.3.6 / 2.4.1 and IBC 1605, which set the dead load against the full hydrostatic uplift H. The tool's ratio was therefore higher than the conventional one wherever submerged soil sits on the footing.
- **Where / exact code (`Spread Footing.html`, `computeAll`, anchor `/* SFFG (2026-11-07)`):**
  - Before: `const flot=(U>1e-9)?{U,R:Wf+Wpeds.reduce((a,b)=>a+b,0)+EV,FS:(Wf+Wpeds.reduce((a,b)=>a+b,0)+EV)/U}:null;`
  - After, `flot` holds both bases:
    - `net = {U, R: W_c + EV, FS}` (the earlier basis).
    - `gross = {U: γ_w·max(D_f − d_w, 0)·B·L, R: W_c + γ_EV·h_cover·A_EV, FS}`.
    - `FS = min(gross.FS, net.FS)`; `basis` = the one that governs; `U` / `R` of that basis.
  - Card 4.4: two eqBlocks (gross, net) and the min. Report: steps `Ugr`, `EVt`, `FSgr`, `FSnet`, `FSfl`. Dashboard chip: "(gross basis; min …)". Summary reference text updated.
- **Decision (pending engineer review):** the gross basis is the definition. The net basis is kept as a recognised alternative, and the smaller FS governs (conservative). Live and transient loads and surcharges stay excluded.
- **Check case (harness `wt`: default project, d_w = 0.5 ft; D_f = 4 ft; B·L = 80 ft²):**
  - Gross: U = 0.0624·(4 − 0.5)·80 = **17.47 k**; R = 30.00 + 1.35 + 0.12·1.5·75.5 = 30.00 + 1.35 + 13.59 = **44.94 k**; FS = **2.57**.
  - Net (before): U = 12.76 k (submerged concrete), R = 40.23 k (EV′ buoyant), FS = **3.15**.
  - **Before FS 3.15 → after 2.57** (gross governs). Target 1.25: PASS both.
  - `seyW` (Seymour, d_w = 1 ft): 6.72 → 6.18. Seymour as saved (no water table): not applicable, unchanged.
- **Saved data:** none. **Other copies:** none.

## 2026-11-07 — PR: claude/sf-m7-vesic-local (PR #1033: https://github.com/mlococo88/All-Structural/pull/1033) (SFVL: Vesić bearing option "Local / punching shear" with c* = 0.67c, φ* = tan⁻¹(0.67 tan φ), AASHTO LRFD 10th 10.6.3.1.2b; warning when φ < 30° in general shear; option default "general": results unchanged)

- **Problem:** Vesić mode had no local or punching shear failure mode. AASHTO LRFD 10th Ed. 10.6.3.1.2b requires reduced strength parameters where such a failure is possible (loose or compressible soils, weak soils under slow loading, dense sand under deep footings with high loads; Fig. C10.6.3.1.2b-1).
- **Where / exact code (`Spread Footing.html`):**
  - Input: Soil, "Shear failure mode" `soil.sfdShearMode` ('general' default / 'local'). `defaultState` adds `sfdShearMode:'general'`. `migrateState`: any value other than 'local' becomes 'general' (older saves: as before).
  - `computeAll` (anchor `/* SFVL (2026-11-07)`):
    - Before: `const ctx={B,L,Df,phi,c,gs,gw,…};`
    - After: `phiB = lpMode ? atan(0.67 tan φ) : φ`, `cB = lpMode ? 0.67c : c`, and `ctx={…,phi:phiB,c:cB,…}`.
    - `R.lpMode`, `R.phiB`, `R.phiBdeg` and `R.cB` are returned.
    - Sliding (μ = tan(2φ/3)) and passive (K_p) keep φ.
  - Warning: Vesić with general shear and φ < 30° → "local or punching shear failure is possible …".
  - Displays:
    - Bearing tab: an eqBlock for c*, φ*. The factor blocks show φ* (`R.phiBdeg`).
    - Report: a topic "Local / punching shear: reduced strength parameters", and the factor steps use φ*.
    - Inputs echo: "Shear failure mode".
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) 10.6.3.1.2b, Eqs. 10.6.3.1.2b-1 (c* = 0.67c) and 10.6.3.1.2b-2 (φ* = tan⁻¹(0.67 tan φ_f)). Text read in the 10th Ed. PDF.
- **Decision (pending engineer review):** whether local / punching shear governs is a geotechnical judgement, so the default stays "general" (saved projects unchanged). A warning prompts the choice when φ < 30° (conservative screening; the AASHTO figure uses relative density and D_f/B, which the tool does not take as input).
- **Check case (default project, φ = 28°, option Local / punching):**
  - φ* = tan⁻¹(0.67·tan 28°) = tan⁻¹(0.3562) = **19.61°**; c* = 0.
  - q_ult 15.11 → **5.31 ksf**; governing D + 0.75L + 0.45(+Wx) + 0.75S bearing D/C **1.196 → 3.404**.
  - With the option at "general" nothing changes. The default project (φ = 32°) shows no warning.
- **Saved data:** new field `soil.sfdShearMode`. Older saves read as 'general' (no result change).

## 2026-11-07 — PR: claude/sf-m1-bearing-dowels (PR #1047: https://github.com/mlococo88/All-Structural/pull/1047) (SFBX: concrete bearing, compression beyond φB_n is carried by the dowels, ACI 318-19 16.3.1.2(a); CALCULATION CHANGE, pass / fail logic, less conservative only where the dowels suffice)

- **Problem:** concrete bearing FAILed whenever P_u > φB_n (the lesser of the footing and pedestal bearing strengths, 16.3.3.4). ACI 318-19 16.3.1.2(a) has the reinforcement carry the compression beyond that strength; R16.3.3.4 limits the transfer to concrete alone only where there are no dowels or continuing bars. The tool already required ℓ_dc in that case (SFBC), but never computed the dowel area, so valid interfaces were rejected.
- **Where / exact code (`Spread Footing.html`, bearing map in `computePhase2`, anchor `/* SFBX (2026-11-07)`):**
  - New fields:
    - `excess = !isPatch && P_u > φB_n`.
    - `AsComp = (P_u − φB_n)/(0.65·f_y)`.
    - `phiPnDow = φB_n + 0.65·f_y·A_s,dow`.
    - `dcrEff = P_u/phiPnDow` where `excess`, otherwise `P_u/φB_n`.
    - `dcr` (concrete alone) is unchanged.
  - Uses of `dcrEff`:
    - Dashboard chip "Concrete bearing" (`brmax`, `brG`), with the text "excess to the dowels, A_s,req … vs … provided".
    - Summary D/C.
    - Card 5.6 status (`bearOK`) and its D/C cell.
    - 3D pick table.
  - Report steps `cb<i>.AsC`, `cb<i>.AsCk` and `cb<i>.DCRe` are added when `excess`. The concrete-alone `DCR` step then carries no status.
  - ℓ_dc into the footing is required as before (SFBC gate `ldcOK`, the "Dowel development (ℓdc)" check). A bearing patch (h = 0, no dowels) keeps the concrete-alone D/C.
- **Governing provisions:** ACI 318-19 16.3.1.2(a), 16.3.3.4, R16.3.3.4, Table 21.2.2 (φ = 0.65, compression-controlled), 25.4.9 (ℓ_dc).
- **Decision (pending engineer review):** φ = 0.65 on the dowels in compression (compression-controlled); f_y of the dowels = f_y of the project.
- **Check case (direct factored mode, default project, Ped 2 P = 800 k; P_u = 800 + 1.2·0.675 = 800.81 k):**
  - φB_n = 0.65·0.85·4·324 = 716.04 k (pedestal side governs).
  - A_s,req = (800.81 − 716.04)/(0.65·60) = **2.17 in²** ≤ 8 #8 = **6.32 in²**.
  - ℓ_dc = 18.97 in ≤ 25.0 in available.
  - D/C with dowels = 800.81/(716.04 + 0.65·60·6.32) = 800.81/962.52 = **0.832**.
  - **Before:** bearing D/C 1.118, **FAIL**. **After:** **PASS**, 0.832.
- **Cases that move:** only cases with P_u > φB_n. None of the other SF harness cases does. def and sey: no change.
- **Saved data:** none. **Other copies:** none.

## 2026-11-07 — PR: claude/sf-m6-loadcases (PR #1054: https://github.com/mlococo88/All-Structural/pull/1054) (SFW3: simultaneous wind 0.75(±Wx ±Wy); SFEQ: seismic load type E with the ASCE 7-16 2.3.6 / 2.4.5 combinations; CALCULATION CHANGE only where both Wx and Wy, or E, are entered; old saves unchanged)

- **Problem:** only Wx or Wy entered a combination, never both at once. MWFRS load Case 3 (ASCE 7-16 27.3.5, Fig. 27.3-8) applies 75 % of the wind in both directions simultaneously, and biaxial corner pressure under it can govern a footing. There was also no seismic load type.
- **Where / exact code (`Spread Footing.html`):**
  - `TYPES` adds `'E'`; `TYPE_DESC` / `SF3L_CASE` gain E. `migrateState` adds `loads.E` = 0 to older pedestals. The load tables show the E row.
  - `stab.windSim` ('on' for new projects; `migrateState`: anything but 'on' becomes 'off', so saves without the field keep the earlier combinations). `stab.SDS` (default 0). Both are inputs on the Stability inputs.
  - `genCombos` (anchors `/* SFW3 (2026-11-07)`, `/* SFEQ (2026-11-07)`):
    - Each wind case carries its factors `w.f` (one direction: `{Wx:±1}`).
    - With `windSim` on and both Wx and Wy present, four cases `0.75(±Wx ±Wy)` (`{Wx:±0.75, Wy:±0.75}`) join every wind combination: 2.4.1(5), (6a), (7); 2.3.1(3), (4), (5).
    - Before: `[w.k]:c*w.s`. After: `...wf(w,c)` (identical for one direction).
    - Seismic (present.E), both signs of E_h, with E_v = 0.2S_DS·D folded into the dead factor:
      - ASD 2.4.5(8): (1 + 0.14S_DS)D + 0.7E_h.
      - ASD 2.4.5(9): (1 + 0.105S_DS)D + 0.525E_h + 0.75L + 0.75S.
      - ASD 2.4.5(10): (0.6 − 0.14S_DS)D + 0.7E_h.
      - LRFD 2.3.6(6): (1.2 + 0.2S_DS)D + 1.0E_h + L + 0.2S.
      - LRFD 2.3.6(7): (0.9 − 0.2S_DS)D + 1.0E_h.
  - Warnings: Wx and Wy entered with windSim off; E entered with S_DS = 0.
- **Governing provisions:** ASCE 7-16 2.3.6 (6), (7) and 2.4.5 (8)–(10) (text read); 12.4.2.2, E_v = 0.2S_DS·D (text read); 27.3.5 / Fig. 27.3-8 Case 3. The licensed ASCE 7-16 PDF on file is truncated before Chapter 27, so the figure could not be re-read; Case 3 (75 % in both directions) is from the standard as published. The engineer should confirm.
- **Decisions (pending engineer review):**
  - The E row is E_h = ρQ_E as entered, applied with both signs, in both directions as entered (the user enters the 100 % / 30 % split if wanted). The overstrength Ω₀ is not applied unless the user enters E_mh.
  - L at 1.0 in 2.3.6(6) (exception 1, 0.5L, not taken: conservative).
  - Seismic is not combined with wind (2.3.6).
  - Wind Case 2 / 4 (torsional eccentricity) is not modelled.
  - windSim on for new projects, off for older saves (unchanged results; a warning points to it).
- **Check case 1 (default project plus Wy.V_y = 6 k on each pedestal, windSim on):**
  - ASD combinations 16 → 28, LRFD 15 → 27.
  - Governing bearing D + 0.75L + 0.45(+Wx) + 0.75S, D/C 0.699 → D + 0.75L + 0.45(0.75(+Wx + Wy)) + 0.75S, **0.706**.
- **Check case 2 (default project plus E: V_x = 15 k on each pedestal, Ped 2 V_y = 5 k; S_DS = 0.5, so E_v = 0.1D):**
  - ASD adds 1.07D + 0.7(±E), 1.053D + 0.525(±E) + 0.75L + 0.75S, 0.53D + 0.7(±E). LRFD adds 1.3D + 1.0(±E) + L + 0.2S, 0.8D + 1.0(±E).
  - Bearing D/C 0.699 → **0.771** (1.053D + 0.525(+E) + 0.75L + 0.75S). x-flexure 0.057 → 0.059.
- **Cases that move:** only projects with both Wx and Wy (and windSim on) or with E entered. SF harness def / sey: no result change (new `loads.E` and `present.E` fields only).
- **Saved data:** new fields `peds[].loads.E`, `stab.windSim`, `stab.SDS`, with a migration that keeps older saves' results (E = 0, windSim off, S_DS = 0).

## 2026-11-07 — PR: claude/sf-low-citations (PR #1062: https://github.com/mlococo88/All-Structural/pull/1062) (SFLW: review LOW items: citations, contact display, Report Include row wrap, roughening drawing note, AASHTO-based labels; d_q and the water term per AASHTO 10th; CALCULATION CHANGE only for the depth-factor option and a water table within D_f + 1.5B′)

- **L1, citation:** dashboard / summary "Flexure (footing)" cited A_s,min §7.6.1.1. For a combined footing it now cites §13.3.4.1 → §8.6.1.1 (as the Report already did, SFPR). The value is unchanged (0.0018A_g).
- **L2, citation:** self-weight cards cited "ACI 318-19 5.3 dead load" (5.3 is the load factors). They now cite "dead load D: ASCE 7-16 3.1, IBC 2021 1606".
- **L3, display:** a minimum contact below 100 % that rounds to "100.00" now reads "99.99+ (< 100; 99.9995)". New helper `sfdPct`, used in the partial-contact warning and the Contact chip.
- **L12, display:** the Report "Include:" row (`sfxControls`, `.sfx-inc`) gains `flex-wrap:wrap`, so it wraps at 390 px instead of scrolling sideways.
- **L11, drawing note:** where a pedestal joint uses μ = 1.0λ (intentionally roughened), card 5.6 shows a "Drawing note required" box: about 1/4 in amplitude, Table 22.9.4.2. The Report μ step says to specify the amplitude on the drawings.
- **L8, labels:** the eccentricity options named "AASHTO …" now read "AASHTO-based (limit of 10.6.3.3 on the ASCE 7 combinations, not the AASHTO load factors) …". The limits are unchanged.
- **L6, CALCULATION CHANGE (depth-factor option only, default off):** `vesicCapacity`.
  - Before: `const kk=(Df/Beff<=1)?Df/Beff:Math.atan(Df/Beff);` and `dq=1+2·tanφ(1−sinφ)²·kk`.
  - After: `kk=Math.atan(Df/Beff)` at every D_f/B, and `dq=Math.min(…,1.4)`. AASHTO LRFD 10th Eq. 10.6.3.1.2a-10 uses arctan(D_f/B) and caps d_q at 1.4 (text read). d_c keeps the Vesić form with the new d_q.
  - This is smaller (conservative) for D_f/B ≤ 1. The tab and Report formulas are updated.
- **L7, CALCULATION CHANGE (water table between D_f and D_f + 1.5B′):** `vesicCapacity`.
  - Before: `else if(dw<=Df+Beff){… g_eff=(gs-gw)+gw*(dw-Df)/Beff …}`
  - After: `else if(dw<=Df+1.5*Beff){… g_eff=(gs-gw)+gw*(dw-Df)/(1.5*Beff) …}`
  - The water effect on the N_γ term now vanishes at D_f + 1.5B, as in AASHTO LRFD 10th Table 10.6.3.1.2a-2 (more conservative). The γ′ form at d_w ≤ D_f is unchanged. Tab texts are updated.
- **Check case (default project, depth factors on, d_w = 6 ft; D_f = 4 ft, B_eff = 8 ft, φ = 32°):**
  - k: D_f/B = 0.500 → arctan 0.500 = **0.464**; d_q = 1 + 0.2761k: 1.138 → **1.128**.
  - γ_eff = 0.0576 + 0.0624·(6 − 4)/8 = 0.0732 → 0.0576 + 0.0624·2/12 = **0.0680** kcf.
  - q_ult 24.68 → 24.12 ksf; governing bearing D/C **0.732 → 0.749**.
  - Default project (depth factors off, no water table): no result change (only the stored k). Seymour: no change.
- **Not done (left for later):** the plain-text Report export still prints KaTeX command names such as "mathrm" (L12). That conversion is in the shared `shared/report.js` / `shared/steps.js`, which 20+ tools load, so it needs its own shared-file PR.
- **Saved data:** none. **Other copies:** none.

## 2026-11-07 — PR: claude/sf-scroll-1280 (PR #1099: https://github.com/mlococo88/All-Structural/pull/1099) (SFST: scroll smoke test waits for the dashboard chip's smooth scroll and wheels the panel back until 0; test only, the tool is unchanged)
- **Problem:** `tests/smoke/spread-footing-scroll.mjs` failed intermittently on origin/main. Under machine load it failed 3 of 3 parallel runs.
  - "dashboard chip 12 (o-fd-bear): its section is not shown in the output panel", at 1280, 1366 and 1920 px.
  - "scrollIntoView of the panel bottom: after wheeling up … output 7495", at 1280 px.
- **Cause (test, not app):**
  - The chip check waited a fixed 900 ms for a smooth `scrollIntoView` of ~7 000 px. Card 5.6 at 1280 px: after 900 ms its top was 602 px into a 703 px panel; after 2 s it was at 0.
  - The wheel-back used a fixed 40 notches of 2000 px. The lazily rendered Report grows from ~52 000 to ~145 000 px while it is wheeled up, so ~50 notches were needed.
  - The app behaves correctly: the chip opens its card and lands it at the top of the output panel, the document stays at 0, and the panel wheels back to 0.
- **Decision (pending engineer review):** this was treated as a stale test assumption. The app is not changed, and the summary column stays on the left from 1200 px (SFLB, #988).
- **Where (test only), `tests/smoke/spread-footing-scroll.mjs`:**
  - `wheelBack`, before: `for (let k = 0; k < 40; k++) await p.mouse.wheel(0, -2000);`
    after: `for (let k = 0; k < 240; k++) { await p.mouse.wheel(0, -2000); if (k % 10 === 9 && await p.$eval(sel, e => e.scrollTop === 0)) break; }`
  - Dashboard-chip loop, before: `await p.waitForTimeout(900); const vis = await p.evaluate(…)`
    after: `let vis = false; for (let t = 0; t < 30 && !vis; t++) { await p.waitForTimeout(200); vis = await p.evaluate(…); }`. The visibility condition is unchanged.
- **Formulas, factors, units, code references:** none (§4 does not apply). `Spread Footing.html` and `shared/` are byte-identical to origin/main. **Saved data:** none.
- **Check case:** default project, 1280×800, click the "Concrete bearing" chip.
  - Before: the card top was 602 px below the panel top at 900 ms (fails under load).
  - After: the test waits until the card is in view; it reaches 0 within ~2 s.
- **How verified:**
  - Scroll test: PASS in 3 parallel runs under load (main: 3/3 FAIL).
  - check-syntax: pass.
  - phone-layout `--tool sf`: pass.
  - spread-footing-nobear: pass.
  - start-chooser: 68/68 on re-run; the first run under load had 2 failures in the list order, which looks like load flakiness, with the app unchanged.
  - project-library `--tool spreadfooting`: ALL PASS.
## 2026-11-07 — PR: fix/report-plaintext-tex (PR #1138: https://github.com/mlococo88/All-Structural/pull/1138) — the plain text this tool compares keeps its pre-TXP form (shared/steps.js TXP; no change on screen or in print)
### Where
- `sfxApply` and `sfrfMove` (which tab content is added to / moved in the Report). Anchor text: `legacy` next to the call below.
- Before: `let txt='';try{txt=SharedReport.text(SharedReport.build(model));}catch(e){return model;}`
- After: `let txt='';try{txt=SharedReport.text(SharedReport.build(model),{legacy:true});}catch(e){return model;}`
- Before: `let txt='';try{txt=SharedReport.text(SharedReport.build({sections:secs}));}catch(e){return [];}`
- After: `let txt='';try{txt=SharedReport.text(SharedReport.build({sections:secs}),{legacy:true});}catch(e){return [];}`
### Problem
- shared/steps.js `toText` (and so `SharedReport.text`) now writes TeX outside the notation subset as readable text (TXP, `fixlog/shared-steps.md`).
  This tool uses that plain text internally (to decide what to copy into its Report, or as a label / note / sheet text); `{ legacy: true }`
  keeps that text exactly as before, so the Report, the labels and the sheets stay as they were.
### Governing provision
- None (display only; no computed value changes).
### Check case
- Default project, origin/main vs this branch, headless: the Report's rendered text (`.rp-doc` textContent) and the page text are identical.
### How verified
- `node tests/check-syntax.mjs`; `node tests/engine/run.mjs`; the headless comparison listed in the PR.
## 2026-11-07 — PR: fix/sf-pm-exact-clip (PR #1159: https://github.com/mlococo88/All-Structural/pull/1159) (SFPX: pedestal P–M stress block clipped exactly; CALCULATION CHANGE, P–M capacities 0.5–7 % higher, ratios lower by the same, i.e. less conservative)
### Where
- `pmContour` → inner `analyze(cDepth, angleRad)` (Phase 2 engine). Anchor text: `/* SFPX (2026-11-07)`.
- Before (the concrete compression, summed in strips):
```
  const nStrip=40;let Cc=0,Ccx=0,Ccy=0;
  const pmin=Math.min(...projs);
  for(let s=0;s<nStrip;s++){
   const u=pmax-a*(s+0.5)/nStrip; // projection coordinate of strip center
   if(u<pmin)break;
   const du=a/nStrip;
   const tvals=[];for(let tv=-Math.hypot(bx,by)/2;tv<=Math.hypot(bx,by)/2;tv+=Math.hypot(bx,by)/60){
    const px=u*ca - tv*sa, py=u*sa + tv*ca;
    if(px>=-bx/2-1e-6&&px<=bx/2+1e-6&&py>=-by/2-1e-6&&py<=by/2+1e-6)tvals.push({tv,px,py});}
   if(!tvals.length)continue;
   const wStrip=(tvals.length>1)?(tvals[tvals.length-1].tv-tvals[0].tv):0;
   const cx=tvals.reduce((q,z)=>q+z.px,0)/tvals.length, cy=tvals.reduce((q,z)=>q+z.py,0)/tvals.length;
   const dArea=wStrip*du;const f=0.85*fc;
   Cc+=f*dArea;Ccx+=f*dArea*cx;Ccy+=f*dArea*cy;
  }
```
- After (the rectangle clipped by the line proj = pmax − a; area and centroid of the clipped polygon by the shoelace formula):
```
  const cut=pmax-a, f=0.85*fc, poly=[];
  for(let k=0;k<4;k++){const A=corners[k],B=corners[(k+1)%4],fa=projs[k]-cut,fb=projs[(k+1)%4]-cut;
   if(fa>=0)poly.push(A);
   if((fa>=0)!==(fb>=0)){const t=fa/(fa-fb);poly.push({x:A.x+t*(B.x-A.x),y:A.y+t*(B.y-A.y)});}}
  let Ac=0,Sx=0,Sy=0;
  for(let k=0;k<poly.length;k++){const A=poly[k],B=poly[(k+1)%poly.length],cr=A.x*B.y-B.x*A.y;Ac+=cr;Sx+=(A.x+B.x)*cr;Sy+=(A.y+B.y)*cr;}
  Ac/=2;
  const Cc=f*Ac, Ccx=Ac>0?f*Sx/6:0, Ccy=Ac>0?f*Sy/6:0;
```
### Problem
- Each strip's width was the distance between the first and last sample points inside the section, sampled every hypot(b_x, b_y)/60 (0.424 in. on an 18 × 18 in. pedestal). That under-counts each width by up to one step (18 in. → 17.82 in.), and more at the corners of a diagonal block. The concrete force and so φM_n came out 0.5–7 % low (conservative).
- Everything else in the routine (strain compatibility, bar stresses limited to ±f_y, displaced concrete deducted for bars inside the block, φ from ε_t at the extreme tension bar with ε_ty from f_y, the φP_n,max cap, the bisection on the neutral-axis angle to the demand direction) checked correct against an independent routine and is unchanged.
- The near-diamond look of the load contour is correct, not a bug. On the default pedestal at P_u = 240.81 k the exact φ-contour gives φM_nx = φM_ny = 137.1 k-ft at 45° against 257.8 k-ft uniaxial (0.532; 0.516 before this fix). The nominal contour gives β = 0.62, inside the usual PCA range. The φ contour pinches because φ drops from 0.788 (uniaxial, ε_t = 0.0037) to 0.676 (45°, ε_t = 0.0023): bent diagonally, only the corner bar is at the extreme tension depth.
- Results affected: every pedestal P–M ratio (pmRat, pmGov, and the slender-pedestal ratios), and the dowel interface-tension ratio and k / A_s,req (sfdDowelCheck, tenRat / kGov). No other value changes.
### Governing provision
- ACI 318-19 22.2.2.4.1 (stress 0.85 f′c uniformly over the block of depth a = β1 c bounded by the section edges and a line parallel to the neutral axis), 22.2.1 / 22.2.2.1 (strain compatibility, ε_cu = 0.003), 22.4.2.1, 21.2.2. The provisions and their values are unchanged; only the numerical integration of the block is corrected.
### Check case (hand)
- Default pedestal: 18 × 18 in., f′c = 4,000 psi, f_y = 60,000 psi, 8-#8 (3 per face; bar centres 2.5 in. from each face, at x = ±6.5, 0), P_u = 240.81 k, bending about y (θ = 0°).
- β1 = 0.85. Solve φP_n = 240.81 k: c = 6.980 in., a = 5.933 in.
- C_c = 0.85 · 4 · 18 · 5.933 = 363.10 k, arm 9 − 5.933/2 = 6.033 in.
- Compression face bars (3 at d = 2.5 in.): f_s = 87·(6.98 − 2.5)/6.98 = 55.84 ksi, less 3.4 ksi displaced = 52.44 ksi → 124.28 k at x = +6.5.
- Middle bars (2 at d = 9 in.): f_s = −25.18 ksi → −39.78 k at x = 0.
- Tension face bars (3 at d = 15.5 in.): −60 ksi → −142.20 k at x = −6.5.
- P_n = 363.10 + 124.28 − 39.78 − 142.20 = 305.41 k. ε_t = 0.003 · (15.5 − 6.98)/6.98 = 0.00366 → φ = 0.65 + 0.25 · (0.00366 − 0.002)/0.003 = 0.788, so φP_n = 240.81 k.
- M_n = (363.10 · 6.033 + 124.28 · 6.5 + 142.20 · 6.5)/12 = 326.9 k-ft; φM_n = 257.76 k-ft.
- Tool before: 255.61 k-ft (the strip width was 17.82 in. instead of 18 in.). After: 257.81 k-ft (0.5 k tolerance on P_u in the c search).
- At 45° (same P_u): before |φM_n| = 186.42 k-ft, after 193.92 k-ft; the independent routine gives 193.93.
### Before / after (harness cases, governing ratios)
- Default, pedestal 1: 0.0639 → 0.0638. Pedestal 2: 0.0647 → 0.0641.
- rev, pedestal 2: 0.3454 → 0.3447 (largest per-combination change 1.78 %).
- sfe9, pedestal 1: 0.3676 → 0.3674.
- Dowels, rev pedestal 2: k 0.2803 → 0.2795, A_s,req 3.543 → 3.533 in².
- Rev pedestal 1: A_s,req 0.0030 → 0.0060 in². Both values sit at the bisection resolution of k (1/4096); the concrete-only ratio is just over 1.
- On sections that are symmetric about the moment axis, the ±W combinations now differ in the last digit (1e-16), so the reported governing name may flip between the "+" and "−" combination of equal ratio (default case: "0.9D + 1.0(+Wx)" → "0.9D + 1.0(−Wx)").
- The independent check (4 sections: 18 × 18 8-#8; 24 × 36 10-#9; 24 × 24 16-#10 with f′c 5 ksi and Gr 80; 30 × 30 12-#8; P from 0 to 1500 k; θ = 0–90°) went from −0.1 % to −7.4 % before the fix to within ±0.11 % after.
### How verified
- An independent strain-compatibility routine in Node (exact polygon clipping, 200-step bisection). See the PR description.
- The SF harness, main vs branch, 10 cases: only pmRat / pmRat1 / pmGov and dowels tenRat / tenGov / kGov / kReq / AsReq change.
- check-syntax, phone-layout --tool sf, spread-footing-nobear, start-chooser, spread-footing-scroll, project-library --tool spreadfooting.
### Other copies
- None. pmContour exists only in this tool.
### Open items
- None.
## 2026-11-07 — PR: feat/sf-pedestal-pm-views (PR #1161: https://github.com/mlococo88/All-Structural/pull/1161) (SFPV: pedestal P–M views: uniaxial P–M_x / P–M_y diagrams (default), the load contour, P–M along θ_gov, 3D surface; DISPLAY ONLY, no computed value changes)
### Where
- Phase 2 engine, `pmContour`. Anchor text: `/* SFPV (2026-11-07): the section analysis of pmContour, hoisted`.
  - Before: `function analyze(cDepth,angleRad){…}` and `function phiOf(cDepth,angleRad){…}` were nested in `pmContour`.
  - After: the same bodies, unchanged, as `function sfpmAnalyze(bars,bx,by,fc,fy,cDepth,angleRad){ const Es=29000000,ecu=0.003,b1=beta1(fc); …}` and `function sfpmPhi(bars,bx,by,fy,cDepth,angleRad){ const ecu=0.003; …}`.
  - `pmContour` now starts with:
    ```
     const analyze=(cDepth,angleRad)=>sfpmAnalyze(bars,bx,by,fc,fy,cDepth,angleRad);   // SFPV
     const phiOf=(cDepth,angleRad)=>sfpmPhi(bars,bx,by,fy,cDepth,angleRad);
    ```
- New display-only generators after `sfpmRatios`. Anchor text: `/* ---- SFPV (2026-11-07, engineer: "it doesn't look like the typical P–M curve")`.
  - `sfpmSec(bars,bx,by,fc,fy,phiPnMax,label)`: the section object.
  - `sfpmAxisCurve(S,ang)`: c is swept from 0.001D to 30D, plus the pure-tension point (−A_st f_y) and the pure-compression point (P_0). Design points are (φM_n, min(φP_n, φP_n,max)).
  - `sfpmBalanced(S,ang)`: c_b = 0.003 d_t/(0.003 + ε_ty), with ε_ty from `sfdEty`.
  - `sfpmThetaCurve(S,θ,n)`: `sfpmRatios` at n axial levels with a unit demand along θ.
  - `sfpmSurface(S,nP,nA)`: `pmContour` at nP levels; a level whose contour does not close within 1 kip is left out. Flat bottom (design tension) and flat top (φP_n,max).
- New plot helpers after `sfpPlot`. Anchor text: `/* ---- SFPV (2026-11-07): P–M plot helpers, display only.`
  - Plots: `sfpmPlotAxis(id,S,pts,ax,o)`, `sfpmPlotTheta(id,S,g,o)`, `sfpmPlot3D(id,S,pts,o)`.
  - View selector: `sfpmShow(i,v)` and `sfpmApply(w,v)`, with `SFPMV` holding the session-only view per pedestal.
  - Pedestal glue: `sfpmPedSec(pd)`, `sfpmPedPts(pd)`, `sfpmDraw3D(i)`.
  - These are reusable for any rectangular section: a section object plus demand points `{name,P,Mx,My,ratio,mode}`.
- `renderPlots`, the pedestal loop. Anchor text: `/* SFPV: the added views (display only) */`.
  - Draws `plot-pmx-i`, `plot-pmy-i` and `plot-pmt-i` after the existing contour.
  - Draws `plot-pm3-i` only while the 3D view is shown.
- Pedestal card. Anchor text: `/* SFPV (2026-11-07, engineer): four views of the same P–M check`.
  - Before: `const pmDiv=el('div','plot');pmDiv.id='plot-pm-'+i;…b.appendChild(pmDiv);` followed by the "Biaxial load contour" note.
  - After:
    - an eqBlock "Balanced points of the uniaxial P–M diagrams", not for patches;
    - a `.sfpmViews#sfpm-views-i` wrapper holding a `.sfpmSel.noprint` button group and four `data-sfpmv` panes;
    - `ux`: the P–M_x and P–M_y plots side by side (`.sfpmPair`, they wrap on a phone) and a note;
    - `pc`: the existing contour plot `#plot-pm-i` with its existing note unchanged, plus a note on the contour shape;
    - `th` (`.noprint`) and `3d` (`.noprint`), each with a note.
- CSS after `.plot{…}`: `.sfpmSel`, `.sfpmSel button(.on)`, `.sfpmPair`.
### Problem
- The engineer said the pedestal plot (the biaxial load contour at P) "doesn't look like the typical P–M curve" and asked about a 3D graphic.
- Decision: add views and keep the contour, which is the check. The uniaxial view is the default.
- The Report gets the uniaxial diagrams and the contour (static SVG, labelled without hover). The θ_gov and 3D views are screen-only.
- The colour of each combination is its biaxial ratio, the check. Its position on a uniaxial diagram is (|M_u| about that axis, P_u).
- Decision (pending engineer review): the balanced point is marked at ε_t = ε_ty with ε_ty as the tool's φ uses it (0.002 for Grade 60 and below, f_y/E_s above; SFPY). This is the compression-controlled limit of Table 21.2.2. A textbook balanced point at f_y/E_s = 0.00207 for Grade 60 would sit slightly lower.
- Decision (pending engineer review): the uniaxial diagrams show M ≥ 0 only, because the bar layouts are doubly symmetric. Demands are plotted at |M|.
### Governing provision
- None changed. The plots use the check's own routine: ACI 318-19 22.2 (strain compatibility), 21.2.2 (φ), 22.4.2.1 (φP_n,max).
### Check case
- Default project, pedestal 1 (18 × 18 in., 8-#8, f′c 4 ksi, Gr 60).
- Balanced point about x: d_t = 15.5 in., c_b = 0.003/(0.003 + 0.002) · 15.5 = 9.30 in. → P_b = 484.90 k (worked in the new block). φP_b = 0.65 P_b.
- φP_n,max = 758.84 k (the cap line), as already worked in the "Maximum nominal axial capacity" block.
- The θ_gov view shows the governing 0.9D + 1.0(−Wx): |M_u| = 16.00, |φM_n|_θ = 250.66, ratio = 0.064, as in the governing-ratio block.
### How verified
- SF harness, main vs branch, 15 cases: R and P2 identical (0 diffs). The Report text adds only the new figures, the balanced-point block and the notes.
- Screenshots of each view at 1400 and 390 px, and the Report figures rendered standalone. No horizontal overflow at 390 px. No console errors.
- Tests:
  - check-syntax: pass.
  - phone-layout `--tool sf`: pass.
  - spread-footing-nobear: pass.
  - spread-footing-scroll: PASS.
  - project-library `--tool spreadfooting`: ALL PASS.
  - start-chooser: 68/68 when run alone. In a parallel run under load, 2 recent-list order checks failed; that is the known load flakiness, and the app's storage is untouched.
- Plotly 2.35.2 (already loaded, full bundle) includes surface and scatter3d. No library added or changed.
### Saved data
- None. The view choice is kept in memory only (`SFPMV`).
### Other copies
- None.
### Open items
- None.

## 2026-11-07 — PR: claude/sf-wall-tab (PR #1162: https://github.com/mlococo88/All-Structural/pull/1162) (SFWD-1: output tab "6W. Wall Design" for Wall elements; the walls' cards, their connection to the footing, dashboard / Report / drawing links moved there; display only, no result change)

### SFWD-1. Wall Design tab   [display only] [no result change]
- **Request (engineer, 2026-11-07):** "I also want to add an output tab for walls when a wall is used, I don't want it to be simply categorized as a pedestal. Then I want to do the structural checks for that wall as well." This PR is part (a): the tab, the move of the existing wall content, and the links. Parts (b)–(d) add the wall checks and graphics.
- **What changes on screen:**
  - New output tab **"6W. Wall Design"** after "6. Pedestal Design" (`<button data-tab="tab-walldes" hidden>`, `<div class="tabpage" id="tab-walldes">`), shown only while at least one element is a wall by ACI 318-19 2.3 (element type Wall and ℓ_w/t > 3: `sfdWallInfo` `applied`). A Wall with ℓ_w/t ≤ 3 stays on the Pedestal Design tab (as before, with its note). The existing tab names, numbers and ids are unchanged. **Decision (pending engineer review):** the new tab is numbered "6W" (cards 6W.1, 6W.2, …) so that 7. 3D View … 10. Drawings keep their numbers whether or not a wall exists.
  - 6W.1 "Wall Summary": the wall rows of the 6.1 table (moved), a note on what the tab works, "Worked in" links. 6W.n "<label> — Wall Design": the wall's card, moved unchanged from the Pedestal Design tab (wall statement, 11.6 / 11.5.4 / 11.7 blocks, and the pedestal checks that still stand in for the out-of-plane design), plus **"Connection to the footing (ACI 318-19 11.2.2.2, 16.3)"**: the wall's bearing row (A₁, √(A₂/A₁), φB_n, P_u, DCR, dowel minimum / provided, ℓ_dc) and the wall's dowel and shear-friction worked blocks (moved from card 5.6; card 5.6 keeps every element in its summary tables and links to the wall cards).
  - 6. Pedestal Design: only the pedestals (rows, cards). Its cards are numbered 6.2, 6.3, … in input order among the pedestals (unchanged where there is no wall). With no pedestal, 6.1 says so and links to 6W.1. With both, 6.1 lists the walls with links.
- **Where (code), anchors:**
  - `SFD_TABNAME` (+ `'tab-walldes':'Wall Design'`); new `sfdIsWallEl(i)`, `sfdElCard(i)` ({tab, id, no, title, wall}), `sfdElLink(i)`, `sfdElNav(i)`, `sfdWallTabShow()` (anchor `/* SFWD (2026-11-07, engineer`).
  - `renderPedestalDesign`: `const TW=$('#tab-walldes');TW.innerHTML='';sfdWallTabShow();`, `wIdx` / `pIdx`, `tw` (clone of the 6.1 table head), rows to `(sfdIsWallEl(pd.idx)?tw:t)`; card: before `const b=secPanel(T,'o-pd-'+i,'6.'+(i+2)+'  '+pd.label+' — Detailed Checks',false);` after `const C=sfdElCard(i), b=secPanel(C.wall?TW:T,C.id,C.no+'  '+C.title,false);cards[i]=b;`; after the loop `wIdx.forEach(i=>sfdWallConn(cards[i],i));`. New `SFWD_INTRO`, `sfdWallConn(b,i)`.
  - `sfsfRender(bb,only)`, `sfdoRender(bb,only)`: `only` = an element index (a wall's card: its row and worked block); without it (card 5.6) every row, worked blocks of the non-walls (`S.filter(z=>only!=null||!sfdIsWallEl(z.idx))`, same for `D`). Card 5.6: a note "Walls: … worked in their cards on the Wall Design tab".
  - `recalc`: `'tab-walldes'` in `ALL`, in the `renderPedestalDesign` ids and in the cleared list (`sfdWallTabShow()` there).
  - Links: `sfdPedBarInfo` ("Worked in" → `sfdElLink(i)`); dashboard wall chips `{tab:'tab-walldes',sec:'o-wd-'+…}`; Pedestal P–M / shear / crossties / tie cover / Wall checks chips `sfdElNav(i)`; `sfdResultRows` card lists `sfdElCard(i).id` and `'o-wd-'+z.idx`; card 5.6 wall note `sfdElLink(z.idx)`; 3D info box jump `tab-walldes` for a wall; Drawings index `src`: a wall's detail sheet → "Wall Design tab", schedule "Footing Design / Pedestal Design / Wall Design".
  - Report: the wall subsections move to a new section **"Wall design"** (key `S-wd`, subsections `S-wd<i>`; step scopes `pd<i>` unchanged, so `[[pd<i>/w.rl2]]` links still resolve), placed after "Pedestal design" (`sfroOrder`: `wd=take('Wall design')`, `M.sections=[…,pd,wd,…]`); "Pedestal design" gets a "No pedestals" note when every element is a wall; summary-row links (`W` map) `S-wd<i>` for walls; `SFX_TABS` + `['tab-walldes','Wall design']`, `SFRF_TAB` + `'Wall Design'`, `sfrfTarget` `ti===7` → `'#wall:<label>'`, `sfrfMove` `#wall:` lookup; `sfxWalk` card-number pattern `\d+W?(\.\d+)*[a-z]?` (reads "6W.2"); the units note and the §5.3 note list the Wall Design tab / `[[S-wd]]` when a wall exists; the dowel-minimum step text "worked under the wall's Wall design".
  - Manual 1.1: the tab list names "6W Wall Design (shown only when an element is a wall)".
  - Test: `tests/smoke/spread-footing-scroll.mjs` clicks the visible tab buttons only (`bs.filter(x => !x.hidden)`), since the Wall Design button is hidden without a wall.
- **Formulas, factors, units, code references:** none changed (§4 does not apply). **Saved data:** none (the collapse state of the new cards uses the existing per-card mechanism; no key or format change).
- **Check case:** default project, direct mode, Ped 1 1.5 × 6 × 2 ft, element type Wall, V_y = 120 kip, horizontal #5 @ 12 (case `w769h`): before, Ped 1's card was "6.2 Ped 1 — Detailed Checks" on Pedestal Design; after, "6W.2 Ped 1 — Wall Design" on Wall Design, same blocks and values (ρ_l = 0.00262, ρ_t = 0.00287, φV_n = 351.82 k, ratio 0.341), Ped 2 becomes "6.2 Ped 2 — Detailed Checks" (was 6.3; the only pedestal card on 6). Report: the wall subsection is §11.1 "Ped 1 (wall, …)" in "Wall design", the summary rows link there.
- **How verified:** headless Chromium, origin/main c04e74f vs the branch, pinned libraries; deep diff of `R`, `P2`, the dashboard text and the Report text on 15 cases (10 harness cases, 5 wall cases: `w769`, `w769h`, `wTall`, `wAll` both elements walls, `wSel` Wall with ℓ_w/t ≤ 3). `R` / `P2`: **0 differences** in all 15; dashboard text identical in all 15; Report text identical in the 11 cases without a wall, and in the wall cases differs only by the new "Wall design" section, the § numbers after it, and the links / tab names listed above. 0 console errors, 0 KaTeX errors. Tests: see the PR.
- **Other copies:** none.

## 2026-11-07 — PR: claude/sf-wall-oop (PR #1163: https://github.com/mlococo88/All-Structural/pull/1163) (SFWD-2: wall out-of-plane design per ACI 318-19 Chapter 11 — axial + flexure per ft with slenderness, out-of-plane shear, ties 11.7.4.1, 11.5.3 / 11.3.1.1 for information; the pedestal stand-in checks of a wall replaced; wall notes as short items; CALCULATION CHANGE for Wall elements only)

### SFWD-2. Wall out-of-plane design   [CALCULATION CHANGE, Wall elements only; CLAUDE.md §4, §5]
- **Request (engineer, 2026-11-07):** "Then I want to do the structural checks for that wall as well." This is part (b): the out-of-plane P–M, the shear and the slenderness. Part (c) adds the in-plane P–M; until then the biaxial P–M of the whole section stays as the in-plane stand-in. Display request (engineer, same day, phone screenshot of the wall note): "split this up into a numbered list or bullets … so it's not just a text that will likely get overlooked". Every wall note on the Wall Design tab is now short items with bold lead words. The "Input needed: horizontal bars" warning sits at the top of the card. The stand-in wording ("Not computed by this tool … the pedestal checks above stand in") is removed. Every fact and citation is kept.
- **Provisions read in the ACI 318-19 PDF (printed page + 2 = PDF page; paraphrased):**
  - pp. 165–174: 11.1–11.8.
    - 11.4.1.3: slenderness by 6.6.4, 6.7 or 6.8, or 11.8 where its conditions hold.
    - 11.4.2.1: P_u ≤ φP_n,max per 22.4.2.1, with φ compression-controlled.
    - 11.5.1.1: φS_n ≥ U, with P–M interaction considered.
    - 11.5.2.1: a bearing wall's P_n and M_n by 22.4; 11.5.3 is permitted as an alternative.
    - 11.5.3.1 (Eq. 11.5.3.1, e ≤ h/6), Table 11.5.3.2 (k = 0.8 / 1.0 braced, 2.0 not braced against lateral translation), 11.5.3.3.
    - 11.5.5.1: out-of-plane V_n by 22.5.
    - 11.3.1.1 / Table 11.3.1.1: note [1] says the bearing and the exterior basement / foundation minimums apply only to walls designed by 11.5.3.
    - 11.7.4.1: ties where the longitudinal bars are required for compression and A_st > 0.01A_g.
    - 11.8.1.1 (a)–(e), 11.8.2.1: the alternative method models a simply supported wall with midheight moments and service deflections.
  - pp. 68–81:
    - 6.2.5.1(a) kℓ_u/r ≤ 22 (not braced), 6.2.5.1(b) ≤ 34 + 12M₁/M₂ and ≤ 40 (braced);
    - 6.2.5.2(b) r = 0.30 × the dimension in the direction considered;
    - 6.2.5.3: second-order moment ≤ 1.4 × first-order;
    - Table 6.6.3.1.1(a) (walls, cracked 0.35I_g), Table 6.6.3.1.1(b) (columns and walls: 0.35I_g ≤ I ≤ 0.875I_g);
    - 6.6.4.4.2 (P_c), 6.6.4.4.3, 6.6.4.4.4(a)–(c) ("for columns");
    - 6.6.4.5.1–6.6.4.5.4 (δ, C_m, M_2,min = P_u(0.6 + 0.03h));
    - 6.6.4.6.1, 6.6.4.6.2(b) (δ_s).
  - pp. 402–405: 22.5.1.2, Table 22.5.5.1 (row (c) for A_v < A_v,min, with N_u/(6A_g)), 22.5.5.1.1 (V_c ≤ 5λ√f′c b_w d), 22.5.5.1.2, 22.5.5.1.3 (λ_s).
  - p. 395–396: 21.2.4 (the shear φ for special systems; not applicable here).
  - Errata (ACI 318-19 errata 2022): nothing on Chapter 11, 6.6.4 or 22.4. The 22.5.1.11 "≤ → >" erratum is already reflected in SFVP.
- **Method (where: new `sfwSec`, `sfwRatio`, `sfdWallOOP`; anchor `/* ---- SFWD-2 (2026-11-07, engineer: "do the structural checks for that wall")`; `computePhase2` adds `wallD`):**
  1. **Section per ft:** a 12-in strip, thickness t, two curtains of vertical bars, A_s = 12A_b/s_v each at d′ = c + d_b/2 from each face. The cage's end bars are not counted (conservative). Strain compatibility (22.2: ε_cu 0.003, 0.85f′c over β₁c, bars ±f_y, displaced concrete deducted), φ by ε_t (21.2.2, SFPY). P₀ = 0.85f′c(A_g − A_st) + f_y A_st, φP_n,max = 0.65·0.80P₀, φP_n,t = −0.90f_y A_st.
  2. **Demand per ft, every LRFD combination:**
     - M_u,out: the base moment about the wall's long axis (M_uy for a wall along y; includes V h and P·e), magnified if slender (below), divided by ℓ_w.
     - Axial force at each end: N = P_u/ℓ_w ± 6M_u,in/ℓ_w².
     - Ratio = M/φM_n(N) at each end; the larger governs. Above φP_n,max the ratio is N/φP_n,max; below φP_n,t it is N/φP_n,t.
  3. **Slenderness:**
     - r = 0.3t; ℓ_u = input, blank = max(h, h_w); k = input, blank = 2.0 (free top) or 1.0 (braced top).
     - Limit 22 (free) or 34 (braced, M₁/M₂ = 0).
     - Above the limit, as SFSL on the whole wall: (EI)_eff = 0.35E_cI_g/(1 + β).
       - Free top: δ_s (k) and δ (k = 1).
       - Braced top: δ (k), C_m = 1.0.
       - M_2,min = P_u(0.6 + 0.03t).
     - NG where unstable or δ_sδ (δ) > 1.4.
  4. **11.5.3** (information, where every e = M_u/P_u ≤ t/6): φP_n = 0.65·0.55f′c(12t)[1 − (kℓ_u/32t)²] per ft against N_max.
  5. **Out-of-plane shear per ft:**
     - V_c = [8λ_sλρ_w^(1/3)√f′c + N_u/(6A_g)]·12d, with 0 ≤ V_c ≤ 5λ√f′c·12d.
     - ρ_w is one curtain; N_u is the net tension per ft at the less compressed end only.
     - √f′c ≤ 100 psi, φ = 0.75.
     - V_u = the out-of-plane shear (V_x for a wall along y) / ℓ_w.
  6. **Ties (11.7.4.1):** required where ρ_g = A_st/A_g > 0.01. Then the tie spacing / size (25.7.2.1, 25.7.2.2) and crossties (25.7.2.3, REVIEW) of the section apply. The bar clear spacing 25.2.3 is kept. 11.3.1.1: information (N/A).
- **What replaces what (Wall elements, ℓ_w/t > 3, only):**

  | Before (pedestal stand-in) | After (wall) |
  |---|---|
  | "Pedestal design" chip: axial DCR (22.4.2.1), ρ 1–8 % (10.6.1.1, column rule where h > 3t), n ≥ 4, bar fit, ties 25.7.2, slender limit | Removed for walls. The axial cap is in the per-ft P–M (11.4.2.1). 11.6 governs the wall minimum (Wall reinforcement). Ties: 11.7.4.1. Bar fit: "Wall ties and bar fit". |
  | "Pedestal shear" chip (22.5, both directions on the whole section, the in-plane direction included) | Removed for walls. Out of plane: "Wall out-of-plane shear (11.5.5)". In plane: 11.5.4 (unchanged chip). |
  | "Pedestal crossties" chip (25.7.2.3, REVIEW) | Only where 11.7.4.1 requires ties ("Wall ties and bar fit"). |
  | Slenderness: k = 2, ℓ_u = h, r = 0.3t, (EI) = 0.4E_cI_g/(1 + β), magnification in the biaxial P–M | Out-of-plane per ft, with k / ℓ_u / brace inputs (defaults: k 2.0, ℓ_u = max(h, h_w)), 0.35E_cI_g/(1 + β). |
  | "Pedestal P–M (biaxial)" | Kept for walls in this PR as the in-plane stand-in (part (c) replaces it). |
  | — | New chips: "Wall out-of-plane P–M (11.5.2)", "Wall out-of-plane shear (11.5.5)", "Wall ties and bar fit (11.7.4.1, 25.2.3)", "Wall minimum thickness (11.3.1.1)" (N/A, information). The "Wall checks" REVIEW chip now lists only what is not checked. |
- **Before / after (harness, origin/main 950f2a7 vs the branch):**
  - `w769h` (default project, direct mode, Ped 1 1.5 × 6 × 2 ft Wall, V_y = 120 k, horizontal #5 @ 12):
    - Pedestal shear: **FAIL 1.01** → walls removed: Ped 2 alone gives **PASS 0.30**. The 1.01 was 22.5 one-way shear in the in-plane direction on b_w 18 × d 69.5 in. The wall's in-plane shear is 11.5.4: φV_n = 351.82 k, ratio 0.341 PASS (unchanged).
    - Crossties: REVIEW → PASS (ρ_g 0.0049 ≤ 0.01: 11.7.4.1 ties not required).
    - New: out-of-plane P–M 0.11 PASS; out-of-plane shear 0.19 PASS.
  - `wTall` (Ped 1 1 × 6 × 12 ft Wall, 14 #5 (2 × 7), D 60, L 30, Wx V_x 3, Wy V_y 20 k):
    - Pedestal design: **FAIL** ("ρ outside 1–8 %; ties": ρ 0.50 % < 1 % column rule, h 144 > 3·12) → **PASS 0.42** (Ped 2 only).
    - Crossties: REVIEW → PASS (11.7.4.1 not required).
    - New out-of-plane P–M **0.62** PASS. This is higher than the stand-in biaxial ratio 0.30, because the strip at the end in tension governs.
    - New out-of-plane shear 0.087 PASS.
  - `wOOP` and `wAll`: the same pattern. The Pedestal design FAIL (ρ < 1 %) goes; the out-of-plane P–M is 0.21 / 0.22.
  - Pedestal-only cases (10 harness cases and `wSel`): R and the dashboard are unchanged (only the new field `P2.wallD` = `[{applied:false}, …]`). The Report text is identical except, in `wSel` (Wall with ℓ_w/t ≤ 3), the reworded wall note.
  - **Decision (pending engineer review): three statuses become less conservative** for walls only: the 1 % column minimum (10.6.1.1), 22.5 shear in the in-plane direction, and ties / crossties with ρ_g ≤ 1 %. These are column / pedestal provisions that ACI 318-19 replaces for walls with 11.6, 11.5.4 and 11.7.4.1, all checked. The brief asked that old saves not become less conservative; that rule is met for every new input default (below). It cannot be met for these three replacements without keeping provisions that do not apply to walls. Engineer to confirm.
- **Check case 1 (axial + out-of-plane moment; `wTall`, 0.9D + 1.0(0.75(+Wx + Wy)), f′c 4000, f_y 60 000):**
  - Inputs: t = 12, ℓ_w = 72 in (L = 6 ft), h = 12 ft, free top, k = 2.0, ℓ_u = 144 in. #5: d′ = 2 + 0.3125 = 2.3125, d = 9.6875 in, s_v = (72 − 4 − 0.625)/6 = 11.229 in, A_s = 12·0.31/11.229 = 0.3313 in²/ft each face.
  - Per ft: P₀ = 0.85·4(144 − 0.6626) + 60·0.6626 = 527.10, φP_n,max = 274.09, φP_n,t = −35.78 kip/ft.
  - Slenderness: r = 3.60, kℓ_u/r = 2·144/3.6 = 80.0 > 22: slender.
    - P_u = 63.72 k, β_dns = 1.0 (all dead), β_ds = 0 (wind moment).
    - E_c = 57√4000 = 3605 ksi, I_g = 72·12³/12 = 10 368 in⁴.
    - P_c,s = π²(0.35·3605·10 368/1)/(2·144)² = 1556.6 k, δ_s = 1/(1 − 63.72/(0.75·1556.6)) = 1.058.
    - P_c,ns = π²(0.35·3605·10 368/2)/144² = 3113 k, δ = 1.028.
    - M_2,min = 63.72(0.6 + 0.36)/12 = 5.10 k-ft. M_c = 1.028·max(1.058·27.0, 5.10) = 29.36 k-ft, δ_sδ = 1.087 ≤ 1.4.
  - Demand: N = 63.72/6 ± 6·180/6² = 10.62 ± 30.00 = 40.62 / −19.38 kip/ft; M = 29.36/6 = 4.89 k-ft/ft.
  - Capacity at N = −19.38 (both curtains yield in tension):
    - C_c = −19.38/0.9 + 2·0.3313·60 = −21.53 + 39.75 = 18.22 k, a = 18.22/(0.85·4·12) = 0.447 in, c = 0.525 in, ε_t = 0.0523, φ = 0.90.
    - M_n = 18.22(6 − 0.223) = 105.2 k-in = 8.77 k-ft, φM_n = 7.89 k-ft/ft.
  - **Ratio 4.89/7.89 = 0.620** (more compressed end, N = 40.62: 0.157). Before: the wall had no per-ft check; the stand-in biaxial ratio was 0.30, Pedestal design FAIL (ρ < 1 %).
- **Check case 2 (out-of-plane shear; same wall and combination):**
  - λ_s = √(2/(1 + 0.96875)) = 1.008 → 1.0. ρ_w = 0.3313/(12·9.6875) = 0.002850. 8·1·1·0.002850^(1/3)·63.25 = 71.73 psi.
  - N_u/(6A_g) = −19 380/(6·144) = −22.43 psi; v_c = 49.30 psi. V_c = 49.30·12·9.6875/1000 = 5.731 kip/ft, φV_c = 4.299.
  - V_u = 0.75·3.0/6 = 0.375 kip/ft → **0.087**.
  - Before (pedestal 22.5, whole section, both directions): 0.252 (governed by the in-plane V_y direction; that direction is now 11.5.4, 0.08).
- **Inputs / saved data (§5):** new fields `peds[i].wallIn.brace` ('unbraced' / 'braced'), `.k`, `.lu` (Pedestals card, Wall only). `newPed`: `brace:'unbraced',k:'',lu:''`. `migrateState` (anchor `/* SFWD-2 (2026-11-07): out-of-plane slenderness inputs`): absent → 'unbraced', '' and ''. So an old save keeps k = 2.0, as the stand-in used, with ℓ_u = max(h, h_w) ≥ h and 0.35 < 0.4 in EI: the slenderness defaults are never less conservative than before. No key or format change.
- **Display:**
  - Wall card (`sfdWallCard`, anchor `/* SFWD-2: a wall's card on the Wall Design tab`): input-needed warning first, the wall statement as items (`sfdWallItems` / `sfdWallTxt`), then: section per ft; slenderness and magnification; the governing P–M worked (N, M, c, a, C_c, bar stresses, ε_t, φ, φM_n, ratio) with every combination at both ends in a table; 11.5.3; out-of-plane shear; the in-plane stand-in; the 11.6 / 11.5.4 / 11.7 blocks (`sfdWallRhoBlocks`, notes now items via `sfwUl`); ties / bar fit / cover; 11.3.1.1; "Not checked" list (`SFWD_NOT_L`); the connection to the footing.
  - 6W.1: the items list and a wall summary table (`sfdWallSumTable`).
  - Report: `sfrWallSub` (anchor `/* SFWD-2 (2026-11-07): a wall's subsection of the Report`) builds the `S-wd<i>` subsection. The 11.6 / 11.5.4 / 11.7 topics moved unchanged into `sfrWallMinTopics` (the step ids `w.*`, scope `pd<i>`, so `[[pd<i>/w.rl2]]` still resolves). Summary rows link the new chips to `S-wd<i>`.
  - `sfdChCond`: "slender limit", "ties" / "bars do not fit" / "crossties to detail".
- **How verified:**
  - Harness: 17 cases (10 + `w769`, `w769h`, `wTall`, `wTallBr` braced top, `wAll`, `wOOP`, `wSel`) on origin/main vs the branch. 0 console errors, 0 KaTeX errors. Values as above.
  - Section routine checked in Node at N = 0 (both curtains yield: C_c = 39.75 k, M_n = 18.26 k-ft) and at the case-1 point.
  - Tests: see the PR. Screenshots, including 390 px for the wrapped items.
- **Other copies:** none.

## 2026-11-07 — PR: claude/sf-wall-beff (PR #1165: https://github.com/mlococo88/All-Structural/pull/1165) (SFWD-3: wall effective length b_eff for the out-of-plane loads, ACI 318-19 11.2.3.1 at the load and a 45° spread to the base; new inputs "Wall load application", "Bearing width b", "Spacing to adjacent concentrated loads"; top-section and per-ft dowel checks; CALCULATION CHANGE for Wall elements only)

### SFWD-3. Effective wall length for out-of-plane loads   [CALCULATION CHANGE, Wall elements only; CLAUDE.md §4, §5]
- **Request (engineer, 2026-11-07):** "If I have an out-of-plane moment at the top of the wall, how much of the wall length resists that load? Is it the whole wall?" SFWD-2 divided every out-of-plane force by the full wall length ℓ_w. It no longer does unless the engineer says the load is distributed over the full length.
- **Provision read (ACI 318-19, p. 166 = PDF p. 168; paraphrased):** 11.2.3.1: unless an analysis shows otherwise, the horizontal wall length taken as effective for each concentrated load is not more than the smaller of the centre-to-centre distance between loads and the bearing width plus four times the wall thickness; it does not extend past vertical joints unless the design transfers forces across them. Errata (2022): nothing on Chapter 11.
- **Inputs (Pedestals card, Wall only; `buildPedCards`, anchor `/* SFWD-3 (2026-11-07): how the out-of-plane load is applied`):** `peds[i].wallIn.load` ('conc' = "Concentrated, bearing width b", 'dist' = "Distributed over the full wall length"), `.bw` (b, in; blank = t), `.sLoad` (spacing to adjacent concentrated loads, in; blank = none). `newPed`: `load:'conc',bw:'',sLoad:''` (new projects: concentrated, b = t: conservative).
- **Saved data (§5), `migrateState` (anchor `/* SFWD-3 (2026-11-07): wall load application`):** absent `load` → `'env'`; `bw`, `sLoad` absent → ''. **Decision (pending engineer review):** an older save gets *both* choices computed and the more conservative governs, separately for the out-of-plane P–M (base, top, dowels: the larger `allMax`) and for the out-of-plane shear (the larger V_u/φV_c). The select shows a third option "Older project: the more conservative of the two (choose one)" only while the value is 'env'; the wall card shows "Input needed: wall load application" at the top with both D/C values; the Check Summary condition "load application: input needed". Why both and not simply "concentrated": concentrated is not always the larger ratio. In `w769h` (in-plane V_y 120 k, ±6M_u,in/ℓ_w² large) b_eff,base = 66 < 72 in raises N per ft and the base P–M ratio falls 0.1074 → 0.1058 while the shear rises 0.185 → 0.202; `'env'` keeps 0.1074 and 0.202. No key or format change; no field is removed.
- **Method (`sfdWallOOP`, anchor `/* SFWD-3 (2026-11-07, engineer: "If I have an out-of-plane moment`; the per-ft part is now `run(ldc,o)`):**
  - Concentrated: b_eff,top = min(b + 4t, s, ℓ_w) (11.2.3.1). b_eff,base = min[min(b/2 + h, a₁) + min(b/2 + h, a₂), s, ℓ_w], h = element height (load at its top), a₁, a₂ = distances from the load point (load offset e along ℓ_w, `loadEx`/`loadEy`) to the two wall ends. **Decision (pending engineer review):** the 45° spread is common practice, not a code article. b_eff,base starts from b (as specified), so for a short thick wall it can be less than b_eff,top (hand check: 60 < 118 in; conservative). b_eff,top is not cut at the wall ends (11.2.3.1 limits it only by joints, which the tool does not model).
  - Distributed: b_eff,top = b_eff,base = ℓ_w (SFWD-2 behaviour).
  - Base section (every LRFD combination): N = P_u,a/b_eff,base + W_sw/ℓ_w ± 6M_u,in/ℓ_w² (P_u,a = factored applied load `pl.Pa`, W_sw = factored element self-weight, spread over ℓ_w: **Decision**); M = M_c/b_eff,base. Slenderness on the strip b_eff,base: P_u,strip = P_u,a + W_sw·b_eff,base/ℓ_w, I_g = b_eff,base t³/12, M_2,min = P_u,strip(0.6 + 0.03t) (δ unchanged where b_eff = ℓ_w).
  - Out-of-plane shear per ft: V_u/b_eff,base (row field `LbV`).
  - New: top section at the load, first order: N_top = P_u,a/b_eff,top ± 6M_u,in,top/ℓ_w², M_top = |M_app + P_u,a e|/b_eff,top, same per-ft section (ratio `rTop`).
  - New: dowels at the base per ft: where the dowels are separate bars, A_s,dow = (n A_b/2)·12/ℓ_w per face at the vertical-bar depths (**Decision**), same N and M as the base (ratio `rDow`); where the vertical bars are the dowels, equal to the base ratio.
  - "Wall out-of-plane P–M" governs on max(base, top, dowels) (`allMax`). In-plane checks, the footing and the soil still use the full wall and the full loads (unchanged).
- **Display:** card 6W.n: "Wall: effective length for the out-of-plane load (b_eff)" worked (symbolic → substituted → result), a Decision item for the 45° spread; the base N / M with b_eff,base; P–M table columns "Top", "Dowels"; "top section at the load" and "dowels at the base" blocks; shear V_u/b_eff,base. Report `S-wd<i>`: steps `wo.bt`, `wo.bb`, `wo.N`, `wo.M`, `wo.Pc`, topic "Top section at the load and dowels at the base, per ft" (`wo.top`, `wo.dow`), `wo.V`. Dashboard chip text lists base / top / dowels and b_eff. "Not checked" list: "the spread of a concentrated load over the wall length (11.2.3.1 …)" replaced by "loads applied between the top and the base of the wall"; §11.2.3.1 removed from the "Wall checks" not-checked row.
- **§4 callout (before / after):** out-of-plane demand per ft = force/ℓ_w → force/b_eff (b_eff,top at the top, b_eff,base at the base), ACI 318-19 (2019) Art. 11.2.3.1; 45° spread: Decision, no article.
- **Hand check (case `wHC`: default project, L = 12 ft footing, Ped 1 wall 32 × 118 in (t = 32, ℓ_w = 118 in along y), h = 2 ft, 28 #6 (14 per long face), D.P = 60 k, L.M_y = 40 k-ft (out of plane), b = 12 in, no s; governing 1.2D + 1.6L + 0.5S):**
  - b_eff,top = min(12 + 4·32, ∞, 118) = min(140, ∞, 118) = **118 in**.
  - b_eff,base = min[min(6 + 24, 59) + min(6 + 24, 59), ∞, 118] = **60 in** = 5.000 ft.
  - M_u,out = 1.6·40 = 64.00 k-ft. Per ft at the base: **64.00/5.000 = 12.80 k-ft/ft**; before: 64.00/9.833 = 6.51 k-ft/ft; **×1.967 (= 118/60)**.
  - N = 168.00/5.000 + 9.44/9.833 ± 0 = 33.60 + 0.96 = 34.56 kip/ft (before 177.44/9.833 = 18.04).
  - Section per ft: d′ = 2.375, A_s = 12·0.44/8.71 = 0.606 in²/ft per face. At N = 34.56: c = 2.244, a = 1.908 in, C_c = 77.83 k, ε_t = 0.0366, φ = 0.90, φM_n = 121.86 k-ft/ft → **ratio 12.80/121.86 = 0.105** (before 6.51/102.66 = **0.063**).
  - Top: N = 168.00/9.833 = 17.08 kip/ft, M = 64.00/9.833 = 6.51 k-ft/ft, φM_n = 101.54 → 0.064 (new).
  - Shear (1.2D + 1.0(+Wx) + L + 0.5S): V_u = 8.00/5.000 = 1.60 kip/ft, φV_c = 11.45 → **0.140** (before 8.00/9.833 = 0.814 → 0.071).
  - Same wall distributed (`wHCd`): b_eff = 118 in, base 0.063 (= before), top 0.064, shear 0.071. Spacing s = 48 in (`wHCs`): b_eff = 48 / 48 in, 0.123 (top), shear 0.175. Load 3.5 ft off centre (`wHCe`): a₂ = 59 − 42 = 17 in, b_eff,base = 30 + 17 = 47 in, 0.181.
- **How verified:** harness origin/main 8ebbbd0 vs the branch: 10 pedestal cases: R, P2, dashboard and Report text identical. `wSel` (Wall with ℓ_w/t ≤ 3): only the not-checked text. Wall cases as above; `wTall`, `wTallBr`, `wAll`, `wOOP` unchanged (b_eff,base = ℓ_w: h ≥ ℓ_w/2). Migration check: a save without the fields → 'env', the select shows it, 0 errors. 0 console errors, 0 KaTeX errors. Tests: see the PR.
- **Other copies:** none.

## 2026-11-07 — PR: claude/sf-torsion (PR #1164: https://github.com/mlococo88/All-Structural/pull/1164) (SFTQ: pedestal torsion threshold check per ACI 318-19 §22.7.1.1 / Table 22.7.4.1(a)(c), new optional input T_u; "not checked" note where T_u = 0; NEW CHECK, no existing result changes)

### SFTQ. Pedestal torsion: threshold check and note   [NEW CHECK; CLAUDE.md §4, §5]
- **Request (engineer, 2026-11-07):** "I think we just note that torsion is not checked, unless it's an easy check to add." Decision: add the easy part, the ACI 318-19 threshold check (torsion may be neglected where T_u < φT_th), plus a note. Torsion design (22.7.6, Chapter 9) is not built.
- **Provisions read in the ACI 318-19 PDF (printed page + 2 = PDF page; paraphrased):**
  - p. 421: 22.7.1.1: 22.7 applies where T_u ≥ φT_th; below it torsional effects may be neglected. 22.7.1.3: λ per 19.2.4.
  - p. 421: 22.7.2.1: √f′c used for T_th and T_cr is limited to 100 psi.
  - p. 423: 22.7.4.1: T_th from Table 22.7.4.1(a) (solid) or (b) (hollow); N_u positive in compression, negative in tension.
  - p. 424: Table 22.7.4.1(a) row (c), nonprestressed member with axial force: T_th = λ√f′c (A_cp²/p_cp) √(1 + N_u/(4A_g λ√f′c)).
  - p. 391: Table 21.2.1 row (c): torsion φ = 0.75.
  - p. 157: 10.5.4.1: columns: where T_u ≥ φT_th, torsion is considered per Chapter 9. p. 133: 9.5.4.1 (neglect below φT_th; otherwise the minimum of 9.6.4 and the detailing of 9.7.5 and 9.7.6.3 apply).
  - Errata (as of July 7, 2022): no item on 21.2, 22.7, 10.5.4 or 9.5.4.
- **Input / saved data (§5):** new field `peds[i].Tu` (k-ft, factored), Pedestals card, row "Factored torsion T_u" after the load table (both load modes). It is a **direct factored value used as entered in every LRFD combination** (it is not added to the load-type table: that would need a T column in every load type and in the combination engine). `newPed`: `Tu:0`. `migrateState` (anchor `/* SFTQ (2026-11-07): factored torsion T_u; saves without the field`): absent / null / '' → 0. No key or format change; old saves open with torsion not checked, as before.
- **Calculation (new function `sfdPedTorsion`, anchor `/* ---- SFTQ (2026-11-07, engineer:`; called in the P2 assembly after `sfdCrossties`, result `P2.pedTor`):**
  ```js
  const sq=Math.min(Math.sqrt(fc),100), Acp=pd.bx*pd.by, pcp=2*(pd.bx+pd.by), Ag=Acp, base=lam*sq*Acp*Acp/pcp;   // lb-in
  // per LRFD combination: N = pl.Pa (factored applied axial at the pedestal top, kip; + compression)
  const arg=1+N*1000/(4*Ag*lam*sq), Tth=arg>0?base*Math.sqrt(arg)/12000:0, phiTth=0.75*Tth;   // k-ft
  ratio=phiTth>0?Tu/phiTth:Infinity; ok=Tu<phiTth;
  ```
  Governing = the largest ratio (smallest φT_th). Solid section, A_cp = A_g = b_x b_y, p_cp = 2(b_x + b_y). N_u = the same axial the pedestal shear uses (pedestal self-weight not counted: conservative in compression). Net tension with 1 + N_u/(4A_gλ√f′c) ≤ 0: T_th = 0 (NG for any T_u > 0). Wall elements and patch loads: not checked (walls are on the Wall Design tab).
- **Before / after:** before, torsion was not mentioned. After: T_u = 0 or blank → a note only ("Torsion: not checked (no T_u entered) …", bold-lead items on the Pedestal Design tab, "• Lead: text." in the Report); no dashboard row. T_u > 0 → worked block on the pedestal card (symbolic → substituted → result), "Pedestal torsion" chip in the Check Summary (D/C = T_u/φT_th; PASS "torsion may be neglected" / FAIL "torsion exceeds the threshold: torsion design per §22.7 / closed ties per §9.5.4 required — not performed by this tool"), Report topic "Torsion threshold" with a per-combination table, and the Report summary row.
- **Check case (default project; 18 × 18 in pedestals, f′c = 4000 psi, λ = 1.0; Ped 1 T_u = 5 k-ft, Ped 2 T_u = 40 k-ft; governing 0.9D + 1.0(+Wx)):**
  - √f′c = 63.246 psi, A_cp = 324 in², p_cp = 72 in, A_cp²/p_cp = 1458 in³, λ√f′c A_cp²/p_cp = 92 212 lb-in.
  - Ped 1: N_u = 0.9 · 120 = 108 k. 108 000/(4 · 324 · 1.0 · 63.246) = 1.3176; √2.3176 = 1.5224. T_th = 92 212 · 1.5224/12 000 = **11.70 k-ft**, φT_th = **8.77 k-ft**. D/C = 5/8.77 = **0.570 PASS**.
  - Ped 2: N_u = 0.9 · 150 = 135 k. 1 + 135 000/81 967 = 2.6470; √ = 1.6270. T_th = **12.50 k-ft**, φT_th = **9.38 k-ft**. D/C = 40/9.38 = **4.266 FAIL**.
  - Before: not checked (no value).
- **How verified:** SF harness (19 existing cases + `tq` above + `tqDir`, direct mode, Ped 1 T_u = −6 → |T_u| = 6, N_u = 264 k: φT_th = 11.84, D/C 0.507) on origin/main vs the branch: with T_u = 0 every R and P2 value identical (only the new `P2.pedTor` key), dashboard text identical, Report adds only the note; 0 console errors, 0 KaTeX errors. Old save without `Tu` migrates to 0; entering 40 in the input gives D/C 4.266. Tests: see the PR.
- **Other copies:** none.
- **Open items:** torsion design (22.7.6, A_t/s, A_ℓ, 9.6.4, 9.7.5) not performed; hollow sections (Table 22.7.4.1(b)) not offered (pedestals are solid).

## 2026-11-07 — PR: claude/sf-wall-inplane (PR #1166: https://github.com/mlococo88/All-Structural/pull/1166) (SFWD-4: wall in-plane axial and flexure of the whole wall about its strong axis by strain compatibility, every LRFD combination; the biaxial pedestal P–M stand-in removed for walls; in-plane shear 11.5.4 verified, unchanged; CALCULATION CHANGE for Wall elements only)

### SFWD-4. Wall in-plane checks   [CALCULATION CHANGE, Wall elements only; CLAUDE.md §4]
- **Request (engineer, 2026-11-07):** "do the structural checks for that wall". Part (b): in-plane. #1163 left the biaxial pedestal P–M of the whole section as an in-plane stand-in. This PR replaces it.
- **Provisions read (ACI 318-19, pp. 169–170 = PDF pp. 171–172; paraphrased):**
  - 11.5.4.1: V_n by 11.5.4.2–11.5.4.4 (strut-and-tie permitted where h_w/ℓ_w < 2: not used); reinforcement per 11.6, 11.7.2, 11.7.3.
  - 11.5.4.2: V_n ≤ 8√f′c A_cv.
  - 11.5.4.3 (Eq. 11.5.4.3): V_n = (α_cλ√f′c + ρ_t f_yt)A_cv, α_c = 3 for h_w/ℓ_w ≤ 1.5, 2 for ≥ 2.0, linear between.
  - 11.5.4.4 (Eq. 11.5.4.4): with net axial tension, α_c = 2(1 + N_u/(500A_g)) ≥ 0, N_u negative in tension.
  - 11.5.2.1 / 22.4: P_n, M_n by 22.4; 11.4.2.1 axial cap. Errata 2022: nothing on Chapter 11.
- **In-plane shear (11.5.4): verified against the text, no change.** `sfdWallInfo`: α_c from h_w/ℓ_w, Eq. 11.5.4.4 for net tension, V_c + V_s capped at 8√f′c A_cv (no λ in the cap, as printed), f_yt ≤ 60 000 psi (Table 20.2.2.4(a)), φ = 0.75, A_cv = tℓ_w, ρ_t provided; ρ_ℓ enters through 11.6.2 (Wall reinforcement). Check (`w769h`): h_w/ℓ_w = 24/72 = 0.333 → α_c = 3; φV_n = 0.75·469.10 = 351.82 k; V_u = 120 k → 0.341 (unchanged).
- **In-plane axial + flexure (new; `sfdWallOOP`, anchor `/* SFWD-4 (2026-11-07): in-plane axial and flexure of the whole wall`):**
  - Section t × ℓ_w with every vertical bar of the cage at its position along ℓ_w (`pd.pmBars`, both curtains and the end bars), `sfwSec` (22.2: ε_cu = 0.003, 0.85f′c over β₁c, bars ±f_y, displaced concrete deducted), φ by ε_t of the farthest bar (21.2.2), φP_n,max = 0.65·0.80P₀ (11.4.2.1, 22.4.2.1).
  - Demand: every LRFD combination, P_u (with self-weight) and M_u,in at the wall base (M_ux for a wall along y; V h and P e included). Ratio = M_c/φM_n(P_u); P_u/φP_n,max above the cap; P_u/φP_n,t below the tension capacity.
  - In-plane slenderness: r = 0.3ℓ_w, I_g = tℓ_w³/12, M_2,min = P_u(0.6 + 0.03ℓ_w), magnified as out of plane where kℓ_u/r exceeds the limit. **Decision (pending engineer review):** k, ℓ_u and the top bracing are the out-of-plane inputs.
  - Not a biaxial check: the out-of-plane moment acts with the in-plane moment through the per-ft check at the two ends (N = P/ℓ_w ± 6M_u,in/ℓ_w², SFWD-2/-3). **Decision (pending engineer review):** this replaces the biaxial stand-in.
- **What replaces what:** "Pedestal P–M (biaxial)" no longer includes walls (dashboard chip, Check Summary row and its card links, `sfdChCond`); new chip / Summary row "Wall in-plane P–M (ACI 318-19 11.5.2)" (`S-wd<i>` in the Report); card block "Wall: in-plane P–M, whole wall" with every combination in a table; Report topic "In-plane axial and flexure, whole wall" (`wi.Pmax`, `wi.klr`, `wi.c`, `wi.Mn`, `wi.R`); 6W.1 summary column "In-plane P–M"; the stand-in wording removed (`SFWD_INTRO`, `sfdWallItems` "In plane", "Wall checks" chip and row, the card's not-checked list).
- **§4 callout, before / after (in-plane flexure of a wall):** before: biaxial pedestal P–M ratio of the whole section (SFPM, ACI 318-19 22.4). After: uniaxial strong-axis P–M ratio, ACI 318-19 (2019) 11.5.2.1 → 22.4, 22.2.
- **Hand check (`wTall`: wall 12 × 72 in along y, h = 12 ft, 14 #5 (7 per long face), f′c 4000, f_y 60 000, governing 0.9D + 1.0(+Wy)):**
  - Bars: d′ = 2 + 0.625/2 = 2.3125 in, 7 positions at s = (72 − 4.625)/6 = 11.229 in, 2 × 0.31 in² each; A_st = 4.34 in².
  - P₀ = 0.85·4(864 − 4.34) + 60·4.34 = 3183.24 k, φP_n,max = 1655.29 k.
  - r = 0.3·72 = 21.6 in, kℓ_u/r = 2·144/21.6 = 13.33 ≤ 22: slenderness neglected.
  - P_u = 0.9(60 + 10.8) = 63.72 k, M_u,in = 20 k × 12 ft = 240.00 k-ft.
  - At P_u: c = 7.466 in, a = 0.85c = 6.346 in, C_c = 0.85·4·6.346·12 = 258.91 k, P_n = 70.80 k (φP_n = 63.72), M_n = 911.21 k-ft, ε_t = 0.0250 → φ = 0.90, φM_n = **820.09 k-ft**; ratio 240.00/820.09 = **0.293**. Checked by an independent script (same 820.09).
  - Before: Pedestal P–M (biaxial) chip 0.30 (Ped 1 wall stand-in 0.2986). After: Wall in-plane P–M 0.29; Pedestal P–M 0.06 (Ped 2 only).
  - `w769h` (18 × 72 in, 8 #9): P_u = 266.43 k, M_u,in = 240 k-ft, φM_n = 1672.98 k-ft → 0.143 (stand-in 0.148). `wHCe`: 0.152 (stand-in 0.156). `wAll`, `wOOP`, `wHC`: M_u,in = 0 → 0 (stand-in 0.20 / 0.20 / 0.06 came from the out-of-plane moment, now in the per-ft check: 0.22 / 0.21 / 0.105).
- **How verified:** harness origin/main 4f458f8 vs the branch: pedestal cases (def, rev, sfe, sfe5, dir, sfe9, revEx, thin, revHook, edgeHook): R, P2, dashboard, Report identical. Wall cases: only `P2.wallD[i].ip` added and the texts above. 0 console errors, 0 KaTeX errors. Tests: see the PR.
- **Other copies:** none.

## 2026-11-07 — PR: claude/sf-wall-graphics (PR #1168: https://github.com/mlococo88/All-Structural/pull/1168) (SFWD-5: wall graphics: elevation / plan sketch with the bars and the b_eff spread; P–M diagrams out of plane per ft, in plane whole wall, 3D surface, with a view selector; Report figures; DISPLAY ONLY, no computed value changes)

### SFWD-5. Wall graphics   [display only] [no result change]
- **Request (engineer, 2026-11-07):** part (c) of the wall work: a wall sketch with the bar layout and the b_eff spread lines, and P–M diagrams with the combinations plotted, reusing the pedestal P–M helpers of SFPV (#1161).
- **Where (code):** new `sfdWallSketchSVG(i)`, `sfdWallPMData(i)`, `SFWPV`, `sfdWallPMShow(i,v)`, `sfdWallPMDraw3D(i)`, `sfdWallPMViews(b,i)`, `sfdWallPMRender()` (anchor `/* ---- SFWD-5 (2026-11-07, engineer: wall graphics)`), before `sfdWallCard`.
  - `sfdWallCard`: the sketch after the b_eff block (`{const sv=sfdWallSketchSVG(i);…}`, `.noprint`: the Report has it as its own figure); `sfdWallPMViews(b,i);` before `sfdWallRhoBlocks(b,w);`.
  - `renderPlots`: `sfdWallPMRender();` at the end (after the pedestal P–M loop).
  - `sfrWallSub`: `{type:'figure',svg:sfdWallSketchSVG(i),caption:…}` after the wall statement.
- **Sketch:**
  - Elevation along ℓ_w, to scale both ways: the vertical bars at their positions (`pd.pmBars`), the horizontal bars at s_h (schematic, from s_h/2 above the base), the load at its offset with the bearing width b, b_eff,top dimensioned above the top (11.2.3.1), the 45° spread lines from the edges of b clipped at the wall ends, b_eff,base dimensioned below the base (the values of `sfdWallOOP`; an older save shows the concentrated values).
  - Plan t × ℓ_w with every vertical bar (t drawn larger where thinner than 10 px, stated).
  - Distributed load: arrows along the top and "b_eff = ℓ_w".
- **P–M views (selector: Out of plane per ft (default) / In plane whole wall / Both / 3D surface):**
  - Out of plane: `sfpmSec` of the 12-in strip (bars at ±(t/2 − d′), A_s per ft each, φP_n,max of the check), `sfpmPlotAxis(…,'y')`; markers = each combination at its governing end (M per ft, N per ft), coloured by its ratio; axes relabelled "M per ft (k-ft/ft)", "N per ft (kip/ft)".
  - In plane: `sfpmSec(pd.pmBars, …)` of the whole wall, `sfpmPlotAxis` about the strong axis; markers (M_c in plane, P_u), coloured by the in-plane ratio.
  - 3D: `sfpmPlot3D` of the whole wall with every combination (M_ux, M_uy, P_u, first order), coloured by the in-plane ratio; note: information only, the out-of-plane moment is checked per ft.
  - "Both" and "3D" are screen-only (`.noprint`); the Report gets the out-of-plane and in-plane diagrams (SFX figure pick-up under card 6W.n) and the sketch.
  - `sfpmPlotTheta` is not used for walls: along the in-plane direction it is the in-plane diagram.
- **Check that the plots show the checks:** the plotted design curves (sfpmAxisCurve) against the checks' own routine (`sfwSec`) at every demand's axial force: max difference 0.12 % (`wTall`, 54 points), 0.03 % (`wHC`), 0.05 % (`w769h`): the interpolation between curve points.
- **Formulas, factors, units, code references:** none changed (§4 does not apply). **Saved data:** none (the view choice is session-only, `SFWPV`).
- **How verified:** harness origin/main vs the branch on def, rev, dir, wTall, w769h, wAll, wHC, wHCe, wHCd: R and P2 **0 differences**, dashboard text identical; the Report differs only by the wall figures and their notes. 0 console errors, 0 KaTeX errors. Screenshots at 1400 and 390 px. Tests: see the PR.
- **Other copies:** none.
