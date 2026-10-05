# Fix log — psbeam.html

Governing basis used for fixes: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), Section 5 (and 3.6 / 4.6.2.2); AASHTO MBE for rating (unchanged).

## 2026-10-04 — PR: claude/fix-psbeam (PR link added after merge)

Line numbers are for the file **after** this PR. Every calculation change was checked by running
the real `computeAll()` of the old (origin/main c58cb6d) and new file under node (Babel-standalone
7.23.5 transpile of the `text/babel` block; scratch `ps_cases.js`). All 16 tab components were
server-rendered with React 18.2.0 for 6 input variants (default; deck + handling + continuity on;
NEXT 36F with skew; no strands; deck spacing 0; imported demands with DF V = 0) without error.

### F1. Time-development factor ktd: 2015+ / 10th Ed. form at every occurrence   [calc change] [more conservative (slightly larger time-dependent losses)]
- **Where:** new helper `ktdAASHTO` (≈ line 1795) next to `Ec()`; used in `losses()` (≈2006), deck-shrinkage gain in `computeAll` (≈2643), continuity creep `PhiConn` (≈3145) and deck shrinkage `eDeckSh` (≈3165), and in the `LossesTab` (≈5122) and `ReportTab` (≈6630) worked calcs and their TeX formulas. Anchor: `function ktdAASHTO(t,fci)`
- **Problem:** used the pre-2015 `t/(61 − 4f′ci + t)`.
- **Governing provision:** AASHTO LRFD 10th Ed. Eq. 5.4.2.3.2-5: ktd = t / [12(100 − 4f′ci)/(f′ci + 20) + t].
- **Before:**
  ```js
    const ktd=t=>t/(61-4*m.fci+t);
  ...
      const ktdD=ddt/(61-4*m.fcd+ddt);
  ...
      ...*((m.tfin-tconn)/(61-4*m.fci+(m.tfin-tconn)))) : Phi;
  ...
      const eDeckSh = lo.ref.ks*(2.00-0.014*m.H)*kf*(ddt/(61-4*m.fcd+ddt))*0.48e-3;
  ...  (LossesTab and ReportTab, identical)
    const ktdID=(m.td-m.ti)/(61-4*m.fci+(m.td-m.ti)), ktdIF=(m.tfin-m.ti)/(61-4*m.fci+(m.tfin-m.ti)),
          ktdDF=(m.tfin-m.td)/(61-4*m.fci+(m.tfin-m.td));
  ...  TeX: k_{td}(t)=\frac{t}{61-4f'_{ci}+t} ... ${nx(61-4*m.fci,1)}
  ```
- **After:**
  ```js
  function ktdAASHTO(t,fci){ return t/(12*(100-4*fci)/(fci+20)+t); }
  ...
    const ktd=t=>ktdAASHTO(t,m.fci);                  // Eq. 5.4.2.3.2-5
  ...
      const ktdD=ktdAASHTO(ddt,m.fcd);                 // Eq. 5.4.2.3.2-5
  ...
      ...*ktdAASHTO(m.tfin-tconn,m.fci)) : Phi;
  ...
      const eDeckSh = lo.ref.ks*(2.00-0.014*m.H)*kf*ktdAASHTO(ddt,m.fcd)*0.48e-3;
  ...  (LossesTab and ReportTab)
    const ktdID=ktdAASHTO(m.td-m.ti,m.fci), ktdIF=ktdAASHTO(m.tfin-m.ti,m.fci),
          ktdDF=ktdAASHTO(m.tfin-m.td,m.fci), ktdK=12*(100-4*m.fci)/(m.fci+20);
  ...  TeX: k_{td}(t)=\frac{t}{12\left(\frac{100-4f'_{ci}}{f'_{ci}+20}\right)+t} ... ${nx(ktdK,1)}
  ```
  (The deck terms keep using the deck f′c `m.fcd` as before; only the equation form changed.)
- **Check case:** defaults (f′ci = 6.8 ksi, ti = 1, td = 90 d): denominator constant 61 − 27.2 = 33.8 → 12(72.8)/26.8 = 32.60; ktd(89 d) 0.7248 → 0.7319. Run: ε_bid 241.11 → 243.49 ×10⁻⁶; ψ_bid 0.9357 → 0.9449; total loss 47.820 → 47.818 ksi (other terms partly offset); f_pe 154.680 → 154.682 ksi; Service III D/C 0.0327 → 0.0326.
- **How verified:** node run old/new.
- **Other copies of this code:** none known (stgirder has no loss calc).

### F2. Reversed fatigue-truck axle layout   [calc change] [LESS conservative — corrects a conservative error]
- **Where:** function `hl93` (≈ line 2053). Anchor: `mAtMid([[xm,32],[xm+30,32],[xm+44,8]])`
- **Problem:** the reversed fatigue truck was `[[xm,32],[xm+14,32],[xm+44,8]]` (32-kip axles 14 ft apart). The fatigue truck has a constant 30-ft spacing between the 32-kip axles; reversed it is 32 –30– 32 –14– 8.
- **Governing provision:** AASHTO LRFD 10th Ed. 3.6.1.4.1.
- **Before:** `      mAtMid([[xm,32],[xm+14,32],[xm+44,8]]));`
- **After:** `      mAtMid([[xm,32],[xm+30,32],[xm+44,8]]));          // reversed: 32 –30 ft– 32 –14 ft– 8`
- **Check case:** L = 120 ft: Mfat 1816 → **1624 k-ft** (reviewer's hand value 1624). Defaults: Mfat1 = 1624·1.15·0.4086 = 763.1 k-ft (was 853.4); strand Δf 4.938 → 4.416 ksi; Fatigue I D/C 0.274 → **0.245**.
- **How verified:** node run old/new.
- **Other copies of this code:** stgirder.html `hl93()` has the same line but its `Mfat` is unused there (stgirder uses `fatMomentAt`, which is correct) — not changed (one tool per PR).

### F3. Interface shear: checked along the full span, 0.210 ksi waiver, and added to the check list   [calc change + bug fix] [more conservative]
- **Where:** `computeAll` interface block (≈ lines 3025–3053) and the master `checks` (≈3290); Shear tab table/hint. Anchors: `const iface=shear.map(r=>{`, `const minWaived=vui<0.210;`, `n:'Interface shear (5.7.4)'`
- **Problem:** (a) only `shear.slice(0,3)` (bearing face, dv, 0.1L) was checked, so the interior zone where the stirrup spacing opens up (sInt) was never checked; (b) the minimum Avf was waived whenever Vui/φ ≤ c·Acv, i.e. vui ≤ 0.252 ksi; (c) the interface result was only shown in a table, never in `checks`, so it could not fail the design.
- **Governing provision:** AASHTO LRFD 10th Ed. 5.7.4.2 (minimum Avf = 0.05Acv/fy; waived for a girder/slab interface roughened to 0.25 in. amplitude where vui < 0.210 ksi and all vertical shear reinforcement is extended across the interface), 5.7.4.3 (Vni = cAcv + μAvf fy ≤ min(K1f′cAcv, K2Acv)), 5.7.4.5 (vui = Vu/(bvi dv)). The 0.210 ksi value was confirmed against the 8th/9th Ed. text; **please confirm it in your 10th Ed. copy** (see O8).
- **Before:**
  ```js
    const iface=shear.slice(0,3).map(r=>{
  ...
      return {x:r.x,vui,Vui,AvfReq:Math.max(AvfReq,0),AvfMin,AvfProv,VniCap,capOK,
              ok:(AvfProv>=Math.max(AvfReq,AvfMin)||Vui/phiV<=c*Acv)&&capOK};
    });
  ```
- **After:**
  ```js
    const iface=shear.map(r=>{
  ...
      const minWaived=vui<0.210;
      const VniProv=c*Acv+mu*AvfProv*fy;                       // kip/ft (P_c = 0)
      const rStr=(Vui/phiV)/Math.max(VniProv,1e-9), rCap=(Vui/phiV)/Math.max(VniCap,1e-9);
      const rMin=minWaived? 0 : AvfMin/Math.max(AvfProv,1e-9);
      const rIf=Math.max(rStr,rCap,rMin);
      return {x:r.x,vui,Vui,AvfReq:Math.max(AvfReq,0),AvfMin,AvfProv,VniCap,capOK,minWaived,VniProv,rStr,rCap,rMin,r:rIf,
              ok:(AvfProv>=AvfReq-1e-9)&&(minWaived||AvfProv>=AvfMin-1e-9)&&capOK};
    });
    const wIface=iface.reduce((b,q)=>q.r>b.r?q:b,iface[0]);
  ...  (in checks, after 'Long. reinf (5.7.3.5)')
      (wIface.rMin>=wIface.rStr&&wIface.rMin>=wIface.rCap)
        ? {n:'Interface shear (5.7.4)',v:wIface.AvfMin,lim:wIface.AvfProv,r:wIface.r,loc:wIface.x,u:'in²/ft'}
        : {n:'Interface shear (5.7.4)',v:wIface.Vui/phiV,lim:(wIface.rCap>=wIface.rStr?wIface.VniCap:wIface.VniProv),r:wIface.r,loc:wIface.x,u:'kip/ft'},
  ```
  Stations are the full-span shear stations of F4 (19 with the defaults, previously 3), including the station just past each change in stirrup spacing. `wIface` is returned in R. The Shear-tab table shows "waived" in the Avf,min column where it applies.
- **Check case:** defaults with stirrups 0.40 in² at 18 in throughout (sEnd = sInt = 18) and DW = 2.2 klf; bvi = 42 in, Acv = 504 in²/ft, AvfMin = 0.05·504/60 = 0.420 in²/ft, AvfProv = 0.40·12/18 = 0.267 in²/ft, c·Acv = 141.1 kip/ft.
  - x = 0.5 ft: vui = 0.224 ksi (Vui/φ = 125.4 kip/ft ≤ 141.1). Before: waived (125.4 ≤ c·Acv), OK, and not in `checks`. After: 0.224 ≥ 0.210 → minimum required, 0.420/0.267 = **D/C 1.575, FAIL**.
  - Defaults: new row "Interface shear (5.7.4)" D/C 0.455 (governed by Vui/φ = 86.1 vs Vni = 189.1 kip/ft at the bearing face), OK.
- **How verified:** node run old/new.
- **Other copies of this code:** none known.

### F4. Shear design stations over the full span (+ station at each stirrup-spacing change)   [calc change] [more conservative]
- **Where:** `computeAll` shear stations (≈ lines 2834–2850) and `sProv` (≈2882). Anchor: `const shLeft=[dvEst,0.1*L,0.15*L,0.2*L,0.25*L,0.3*L,0.4*L];`
- **Problem:** stations were the bearing face, dv, 0.1L … 0.5L only (left half). With imported continuous demands the pier end of an end span carries more shear and was never checked (strength shear, longitudinal tie, interface, shear rating all use these stations). Also, `sProv` used `x <= endZoneLen·L`, which on the right half would have used the interior spacing in the right end zone.
- **Governing provision:** AASHTO LRFD 10th Ed. 5.7.3 (shear checked at all sections), 5.7.3.5, 5.7.4; MBE 6A.5.8 for the shear rating location.
- **Before:**
  ```js
    const shStations=[{x:xBear,isBearing:true},...[dvEst,0.1*L,0.15*L,0.2*L,0.25*L,0.3*L,0.4*L,0.5*L].map(x=>({x,isBearing:false}))];
  ...
      const sProv=(x<=inp.opt.endZoneLen*L)?+inp.opt.sEnd:+inp.opt.sInt;
  ```
- **After:**
  ```js
    const shLeft=[dvEst,0.1*L,0.15*L,0.2*L,0.25*L,0.3*L,0.4*L];
    const ezX=(+inp.opt.endZoneLen||0)*L;
    if(ezX>dvEst && ezX<L/2-0.05 && (+inp.opt.sEnd)!==(+inp.opt.sInt)) shLeft.push(ezX+0.01);
    const shStations=[{x:xBear,isBearing:true},
      ...shLeft.map(x=>({x,isBearing:false})),
      {x:0.5*L,isBearing:false},
      ...shLeft.map(x=>({x:L-x,isBearing:false})),
      {x:L-xBear,isBearing:true}]
      .filter((st,i,a)=>a.findIndex(o=>Math.abs(o.x-st.x)<1e-6&&o.isBearing===st.isBearing)===i)
      .sort((a,b)=>a.x-b.x||(b.isBearing-a.isBearing));
  ...
      const sProv=(Math.min(x,L-x)<=inp.opt.endZoneLen*L)?+inp.opt.sEnd:+inp.opt.sInt;   // end zone at BOTH ends
  ```
  The section geometry functions (`flexure`, `ss.at`, transfer/development ramps, Vp) are already symmetric in min(x, L−x); demands use the actual x. The critical-section location (0.72hc from the bearing CL, review B-C5) is unchanged (O6).
- **Check case:**
  - Defaults (simple span): the new station at 30.01 ft (just past the 0.25L end zone, s = 18 in) governs. Strength shear D/C 0.689 @ 36 ft → **0.721 @ 30.01 ft** (Vu = 241.2, φVn = 334.6 kip).
  - Imported end-span demands (|V_LL| 95 k at the left end, 140 k at the right/pier end; DC2/DW continuous): before D/C 0.576 @ 60 ft (left half only) → after **0.948 @ 89.99 ft**. Shear RF_inv 1.803 → **1.086**. Longitudinal tie governs at the right bearing (D/C 0.394 → 0.556).
- **How verified:** node run old/new.
- **Other copies of this code:** none known.

### F5. Strength flexure and minimum reinforcement governed over the full span (`flexFull`)   [calc change] [more conservative]
- **Where:** `computeAll` after `minMr` (≈ lines 2806–2830) and the `checks` rows (≈3286–3287); FlexTab tiles. Anchor: `let flexGov=null, minGov=null;`
- **Problem:** the "Flexure" and "Min reinf" checks were made at midspan only, although `flexFull` holds Mu and φMn at every station (harp points, debond terminations, continuous demands peaking near 0.4L).
- **Governing provision:** AASHTO LRFD 10th Ed. 5.6.3.2 (Mu ≤ φMn at every section), 5.6.3.3 (φMn ≥ min(Mcr, 1.33Mu) at every section; Mcr = γ3[(γ1fr + γ2fcpe)Sc − Mdnc(Sc/Snc − 1)], γ1 = 1.6, γ2 = 1.1, γ3 = 1.0 — same factors as before).
- **Before:**
  ```js
      {n:'Flexure',v:MuMid/12,lim:fMid.phiMn/12,r:MuMid/fMid.phiMn,loc:L/2,u:'k-ft'},
      {n:'Min reinf',v:minMr/12,lim:fMid.phiMn/12,r:minMr/fMid.phiMn,loc:L/2,u:'k-ft'},
  ```
- **After:**
  ```js
    let flexGov=null, minGov=null;
    flexFull.forEach(r=>{
      if(!(r.Mu>0) || !(r.phiMn>0)) return;
      const rf=r.Mu/r.phiMn;
      if(!flexGov || rf>flexGov.r) flexGov={x:r.x,Mu:r.Mu,phiMn:r.phiMn,r:rf};
      const xs_=clamp(Math.min(r.x,L-r.x), 0, L/2), a_=ss.at(xs_);
      const PeX=a_.Aps*fpe, fcpeX=PeX/g.A+PeX*a_.e/g.Sb;
      const MdncX=Mg(r.x)+Mdc1(r.x);
      const McrX=Math.max(1.0*((1.6*fr+1.1*fcpeX)*cp.Sbc-MdncX*(cp.Sbc/g.Sb-1)),0);
      const reqX=Math.min(McrX,1.33*r.Mu), rm=reqX/r.phiMn;
      if(!minGov || rm>minGov.r) minGov={x:r.x,Mu:r.Mu,phiMn:r.phiMn,Mcr:McrX,fcpe:fcpeX,req:reqX,r:rm};
    });
    if(!flexGov) flexGov={x:L/2,Mu:MuMid,phiMn:fMid.phiMn,r:MuMid/fMid.phiMn};
    if(!minGov) minGov={x:L/2,Mu:MuMid,phiMn:fMid.phiMn,Mcr,fcpe,req:minMr,r:minMr/fMid.phiMn};
  ...
      {n:'Flexure',v:flexGov.Mu/12,lim:flexGov.phiMn/12,r:flexGov.r,loc:flexGov.x,u:'k-ft'},
      {n:'Min reinf',v:minGov.req/12,lim:minGov.phiMn/12,r:minGov.r,loc:minGov.x,u:'k-ft'},
  ```
  Only stations with Mu > 0 are positive-flexure checks (the pier −M check is the existing continuity check). `flexGov`/`minGov` are returned in R; the Flexure tab tiles now show the governing ratio and station (with the midspan ratio alongside); the midspan worked derivations keep showing midspan values, and their ✓/N.G. now reflect the midspan numbers they display.
- **Check case:**
  - Imported demands with the +LL peak at 0.4L (sin(πx/0.8L)·4200 k-ft for x < 0.8L): midspan Mu/φMn = 12,445/13,639 = 0.9125 → governing **12,833/13,639 = 0.9409 @ x = 52 ft**.
  - Defaults: Flexure unchanged (0.7516 @ midspan). Min reinf 0.672 @ midspan → **0.688 @ x = 22 ft** (φMn = 11,994 k-ft there, reduced by strand development; req = min(Mcr, 1.33Mu) = 8,247 k-ft).
- **How verified:** node run old/new.
- **Other copies of this code:** none known.

### F6. NEXT F distribution factor: Kg term (with a composite topping)   [calc change] [moment DF more conservative; skewed shear DF slightly less conservative]
- **Where:** `distFactors`, NEXT branch (≈ lines 2276–2312); Inputs-tab DF hint. Anchor: `const hasKg=(+ts>0);`
- **Problem:** the NEXT branch dropped the (Kg/12Lts³)^0.1 term ("Kg term ~1 for tees") and used simplified skew factors. With a CIP topping, Kg = n(I + A·eg²) of the beam is available.
- **Governing provision:** AASHTO LRFD 10th Ed. Table 4.6.2.2.2b-1 (types a, e, k and i, j acting as a unit), 4.6.2.2.2e (c1 = 0.25(Kg/12Lts³)^0.25(S/L)^0.5 for 30° ≤ θ ≤ 60°), 4.6.2.2.3c (1 + 0.20(12Lts³/Kg)^0.3 tanθ).
- **Before:**
  ```js
      const m1=0.06+Math.pow(Sf/14,0.4)*Math.pow(Sf/L,0.3); // simplified (Kg term ~1 for tees)
      const m2=0.075+Math.pow(Sf/9.5,0.6)*Math.pow(Sf/L,0.2);
      const v1=0.36+Sf/25, v2=0.2+Sf/12-Math.pow(Sf/35,2);
      const th=clamp(+ld.skew||0,0,60), tanT=Math.tan(th*Math.PI/180);
      const skM=th<30?1:1-0.25*Math.pow(tanT,1.5);
      const skV=1+0.20*tanT;
      const dfmRaw=Math.max(m1,m2), dfvRaw=Math.max(v1,v2);
      return {Kg:0,eg:0,m1,m2,v1,v2,skM,skV,th,ext:false,lever:0,eM:0,eV:0,rigid:0,rigidNL:0,
              dfmRaw,dfvRaw,dfm:dfmRaw*skM,dfv:dfvRaw*skV,isNext:true,Sf};
  ```
- **After:**
  ```js
      const th=clamp(+ld.skew||0,0,60), tanT=Math.tan(th*Math.PI/180);
      const hasKg=(+ts>0);
      const nEIx=cp.Ecg/Math.max(cp.Ecd,1e-6);
      const egN=hasKg? (g.h+(+inp.th||0)+ts/2)-g.yb : 0;
      const KgN=hasKg? nEIx*(g.I+g.A*egN*egN) : 0;
      const ts3N=hasKg? ts**3 : 1;
      const kgtN=hasKg? Math.pow(KgN/(12*L*ts3N),0.1) : 1;
      const m1=0.06+Math.pow(Sf/14,0.4)*Math.pow(Sf/L,0.3)*kgtN;
      const m2=0.075+Math.pow(Sf/9.5,0.6)*Math.pow(Sf/L,0.2)*kgtN;
      const v1=0.36+Sf/25, v2=0.2+Sf/12-Math.pow(Sf/35,2);
      let skM, skV;
      if(hasKg){
        const c1N=th<30?0:0.25*Math.pow(KgN/(12*L*ts3N),0.25)*Math.pow(Sf/L,0.5);
        skM=1-c1N*Math.pow(tanT,1.5);
        skV=1+0.20*Math.pow(12*L*ts3N/KgN,0.3)*tanT;
      } else {
        skM=th<30?1:1-0.25*Math.pow(tanT,1.5);
        skV=1+0.20*tanT;
      }
      const dfmRaw=Math.max(m1,m2), dfvRaw=Math.max(v1,v2);
      return {Kg:KgN,eg:egN,kgt:kgtN,kgOmitted:!hasKg,m1,m2,v1,v2,skM,skV,th,ext:false,lever:0,eM:0,eV:0,rigid:0,rigidNL:0,
              dfmRaw,dfvRaw,dfm:dfmRaw*skM,dfv:dfvRaw*skV,isNext:true,Sf};
  ```
  eg and n are taken as in the I-girder branch (eg = h + th + ts/2 − yb, n = Ecg/Ecd). With no topping (ts = 0) the old simplified form is kept (O4).
- **Check case:** NEXT 36F, S = 12 ft (flange 144 in: I = 186,000 in⁴, A = 1,488 in², yb = 23.34 in), L = 60 ft, ts = 8 in, th = 2 in, n = 1.1983: eg = 36 + 2 + 4 − 23.34 = 18.66 in; Kg = 1.1983(186,000 + 1,488·18.66²) = 843,773 in⁴; Kg/(12·60·8³) = 2.289; ^0.1 = 1.0863.
  - skew 0: m2 0.9088 → **0.9808** (DF_m +7.9%), DF_v unchanged 1.0824.
  - skew 35°: skM 0.8535 → 0.9194, DF_m 0.7757 → **0.9018**; skV 1.1400 → 1.1092, DF_v 1.2340 → **1.2007** (−2.7%, less conservative).
- **How verified:** node run old/new; hand values above match.
- **Other copies of this code:** none known.

### F7. Robustness: no strands, deck bar spacing 0, imported DF of 0   [robustness / bug fix] [deck spacing and no-strand: more conservative; DF = 0: see note]
- **Where:** `flexure` (≈ line 2354), `computeAll` validation (≈2492) and `checks` (≈3297), `deckCalc` `cap()` (≈2238) plus a warning (≈3109), imported-LL factors (≈2540–2549), `LossesTab` worked example guard (≈5177). Anchors: `if(Aps<=0){ const fcd0=`, `const noStrands = `, `const As=(+sp>0)?`, `const fac1=(v)=>`
- **Problem:**
  - (a) With no strands `flexure()` returned only `{phiMn:0,phi:1}`, so dv = max(NaN,…) = NaN and all shear, interface and shear-rating results were NaN (30 NaN fields; reproduced). The LossesTab also crashed (`rows[0].y`).
  - (b) Deck `As = barA·12/sp` with sp = 0 gave As = ∞, φMn = −∞ and D/C = 0, i.e. **PASS**.
  - (c) Imported DF fields used `(+x||1)`, so an entered 0 silently became 1.0.
- **Before:**
  ```js
    const Aps=a_.Aps; if(Aps<=0)return{phiMn:0,phi:1};
  ...
    if(ss.Ntot<1 && ss.nh<1)
      warns.push(`No prestressing strands defined — the girder is modeled as unstressed; flexural and stress results are not meaningful for a prestressed design.`);
  ...
      const As=barA*12/sp;                         // in^2/ft
  ...
    const _mpf=(+inp.loads.extLLmpf||1);
    const extLL={ pos:(+inp.loads.extDFpos||1)*_mpf,
                  neg:(+inp.loads.extDFneg||1)*_mpf,
                  v  :(+inp.loads.extDFv  ||1)*_mpf };
  ...
        <Deriv title={`Worked example — row at y = ${fmt(rows[0].y,1)}″ ...> ... </Deriv>
  ```
- **After:**
  ```js
    const Aps=a_.Aps;
    if(Aps<=0){ const fcd0=(+inp.ts)>0? inp.mat.fcd : inp.mat.fc;
      return {c:0,a:0,fps:0,fpsFull:0,devGov:false,dp:cp.hc,dpFull:cp.hc,dt:cp.hc,et:0.005,phi:1,rect:true,
              Mn:0,phiMn:0,b1:clamp(0.85-0.05*(fcd0-4),0.65,0.85)}; }
  ...
    const noStrands = ss.Ntot<1 || !(ss.Aps>0);
    if(noStrands)
      warns.push(`No prestressing strands defined — the girder is modeled as unstressed. Flexure, shear and stress results are not meaningful; the "Prestressing strands" check fails until at least one strand row (or harped strands) is entered.`);
  ...
    if(noStrands) checks.unshift({n:'Prestressing strands',v:0,lim:1,r:Infinity,loc:0,u:'strands'});
  ...
      const As=(+sp>0)? barA*12/sp : 0;            // in^2/ft — spacing ≤ 0 is an input error: no steel credited (was ∞)
  ...
    if(inp.deck&&inp.deck.on){ deck=deckCalc(inp,g,cp);
      if(!(+inp.deck.sTop>0)||!(+inp.deck.sBot>0)) warns.push(`Deck bar spacing must be greater than 0 ...`); }
  ...
    const fac1=(v)=>{ if(v===''||v===null||v===undefined) return 1; const n=+v; return isFinite(n)? n : 1; };
    const _mpf=fac1(inp.loads.extLLmpf);
    const extLL={ pos:fac1(inp.loads.extDFpos)*_mpf,
                  neg:fac1(inp.loads.extDFneg)*_mpf,
                  v  :fac1(inp.loads.extDFv)*_mpf };
  ...
    if(useExt){ const z=[['DF +M',extLL.pos],['DF −M',extLL.neg],['DF V',extLL.v]].filter(q=>!(q[1]>0)).map(q=>q[0]);
      if(z.length) warns.push(`Imported-demand live-load factor ${z.join(', ')} (× MPF) is 0 — that live-load effect is zeroed. Enter the distribution factor (blank = 1.0).`); }
  ...
        {rows.length>0&&<Deriv title={`Worked example — row at y = ...`}> ... </Deriv>}
  ```
  I chose a warning plus a failing check, not a hard error. `computeAll` returning `{error}` hides the whole UI, including the Inputs tab, so the engineer could not add strands back. The same zero-capacity return in `flexure()` also covers sections where every strand is still inside its transfer or debond length.
- **Check case:**
  - No strands (defaults with rows = [], harp n = 0): before, 30 NaN fields (shear[], shearDiag[], iface[], shrRating, two check ratios) and a LossesTab crash. After, 0 NaN fields; "Prestressing strands" FAIL; Flexure and Min reinf D/C = ∞ (shown "—", FAIL); all tabs render.
  - Deck bottom spacing 0: before, As = ∞, φMn = −∞, D/C 0.000 (**PASS**). After, As = 0, φMn = 0, D/C ∞ (**FAIL**) plus a warning.
  - Imported DF V = 0 (|V_LL| 80 k at the support): before, VLL(0) = 80.0 k (DF taken as 1.0), Vu = 266.4 k. After, VLL(0) = 0.0, Vu = 132.0 k, and a warning. **An explicit 0 is now honoured, which is less conservative than the old silent 1.0. It is flagged on screen.** Blank still means 1.0.
- **How verified:** node run old/new; NaN scan of the returned R; React server render.
- **Other copies of this code:** stgirder.html has the same `(+x||1)` pattern for its imported DFs, not changed here (one tool per PR).

## Open items (not changed)
- O1. Lifting and hauling stability use a simplified FS. Lifting is yr/(zo + ei). Hauling has no truck roll stiffness Kθ, no tilt equilibrium and no FS against failure or rollover, so this is not the PCI (2016) / Mast method. Needs a decision: implement PCI/Mast, or relabel as "screening only".
- O2. Rating:
  - φc·φs are hard-coded to 1.0 (`phiC=1.0`). MBE 6A.4.2.3/4 requires φc and φs, with φcφs ≥ 0.85. This needs inputs.
  - The flexure rating is still at midspan only (`fMid`). The shear rating now follows the full-span governing section (F4).
  - "RF×36 tons" (`RTinv`, `RTopr`, `svcRating.RT`, `shrRating.RT*`) has no MBE basis, because HL-93 has no gross weight. Recommend removing the tonnage or labelling it as indicative. This is a display decision.
- O3. Fatigue simplifications (5.5.3), not changed:
  - The strand stress range is n·Δf at the bottom fiber, not at the strand centroid.
  - The cracked case uses an arbitrary ×1.5 instead of a cracked-section analysis.
  - The concrete compression fatigue limit (5.5.3.1, ≤ 0.40f′c) is not checked.
  - The exterior-girder fatigue DF uses the interior m1/1.2.
- O4. NEXT F DF:
  - With no topping (ts = 0) the Kg term is still omitted. The slab depth and Kg are not defined for an integral-flange "deck" in this app.
  - S is taken as the beam width, not the stem spacing.
  - The exterior position is not handled (`ext:false`).
  - There are no range-of-applicability checks.
  - These need a decision on how NEXT beams are to be classified (type (i)/(j) vs per-stem).
- O5. Exterior-girder effective width (4.6.2.6.1: S/2 + overhang) and the deck DL tributary width still use S·12.
- O6. Δfcd for the refined losses omits the (ΔfpSR + ΔfpCR + ΔfpR1)·Aps·(1/Ag + e²/Ig) term (5.9.3.4.3b). This is conservative (ΔfpCD is slightly over-predicted), so it was left as is. Separately, the shear critical section is still taken at 0.72hc from the bearing CL, not dv from the inside face of the bearing.
- O7. Interface shear:
  - The 5.7.4.2 relaxation (Avf,min need not exceed the amount needed to resist 1.33Vui/φ) is not implemented. This is conservative.
  - The worked step on the Shear and Report tabs still prints station [0] (bearing face) with the dv-station Vu. That is a display mismatch from before this PR.
- O8. Edition: 0.210 ksi (5.7.4.2), Eq. 5.4.2.3.2-5 and 3.6.1.4.1 are as in the 8th/9th Ed. Please confirm them against the 10th Ed. text. The page still says "9th Ed. article numbering" (≈ line 6686); that label was not changed.

## 2026-10-04 — PR: claude/step1-group1 (PR link added after merge)

Feature (no result change): "← All tools" link to `tools.html` (`target="_top"`, hidden in print) and the shared project info buttons. No formula, factor, unit, storage key or saved format changed. New storage written only on "Share project info": `bridgeSuite.v1.projectMeta` and `bridgeSuite.v1.projectMeta.updatedAt` (HANDOFF.md §2/§4.1). Link and buttons sit in the existing `btnrow noprint`, so they do not print. The bridgeSuite bootstrap blocks are unchanged.

Field mapping: projectName ↔ Project (`inp.proj.name`), preparedBy ↔ By (`inp.proj.by`), date ↔ Date (`inp.proj.date`), jobNo ↔ Job No. (`inp.proj.job`). Girder (`inp.proj.girderId`) is a girder label, not a bridge ID, so it is not mapped. bridgeId, client, location, checkedBy: not in this tool. Writes go through `setInp(p=>…)` (undo history + autosave as for typing).

### S1. BridgeXfer v1 + BXProject glue (plain script before the app)   [feature (no result change)]
- **Where:** new `<script>` just before `<script type="text/babel" data-presets="env,react">` (≈ line 1546). Anchor text: `<script type="text/babel" data-presets="env,react">`
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
- **Where:** `App()`, after `uP` (≈ line 7831). Anchor text: `const uP=(k,v)=>setInp({...inp,proj:{...inp.proj,[k]:v}});`
- **Problem:** none (feature). Approved step 1 of the cross-tool work: "← All tools" link and shared project info (HANDOFF.md §4.1).
- **Governing provision:** n/a (no calculation, factor, unit or code reference touched).
- **Before:**
  ```jsx
    const uP=(k,v)=>setInp({...inp,proj:{...inp.proj,[k]:v}});
    return(<div className="sheet"><div className="sheet-inner">
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
    return(<div className="sheet"><div className="sheet-inner">
  ```
- **Check case:** n/a, no computed value changes. Functional check: see How verified.
- **How verified:** `node --check` on every plain inline script and @babel/standalone transpile of the text/babel block; BridgeXfer copy compared byte-for-byte with HANDOFF.md §5; whole page loaded in jsdom (React/ReactDOM/Babel from npm, other CDN scripts blocked); Share → Use round trip between lldf, Moving Load Generator, psbeam, stgirder and index with one shared localStorage; `git diff` shows only additions apart from the one header line that received the link.
- **Other copies:** BridgeXfer v1 and the `BXProject` glue are also in index.html, lldf.html, psbeam.html, stgirder.html and Moving Load Generator.html (this PR).

### S3. "← All tools" link and the two buttons   [feature (no result change)]
- **Where:** `App()` render, title-block `btnrow noprint` (≈ line 7922). Anchor text: `<BeamChip nb=`
- **Problem:** none (feature). Approved step 1 of the cross-tool work: "← All tools" link and shared project info (HANDOFF.md §4.1).
- **Governing provision:** n/a (no calculation, factor, unit or code reference touched).
- **Before:**
  ```jsx
          <div className="btnrow noprint" style={{marginTop:6,justifyContent:'flex-end',alignItems:'center'}}>
            <BeamChip nb={Math.max(2,Math.round(+inp.nGirders||0))||null} setBy="PS-Beam"/>
  ```
- **After:**
  ```jsx
          <div className="btnrow noprint" style={{marginTop:6,justifyContent:'flex-end',alignItems:'center'}}>
            <a className="bx-alltools" href="tools.html" target="_top" title="Open the list of all tools"
              style={{fontSize:10.5,fontFamily:'var(--mono)',color:'var(--ink2)',textDecoration:'none',marginRight:'auto'}}>← All tools</a>
            <button className="btn sm ghost" onClick={bxUseProject} title="Fill Project, By, Date and Job No. from the project info shared by another tool (asks first; never blanks a field)">Use shared project info</button>
            <button className="btn sm ghost" onClick={bxShareProject} title="Share this title block with the other tools">Share project info</button>
            <span style={{width:1,height:20,background:'var(--line)',margin:'0 3px'}}></span>
            <BeamChip nb={Math.max(2,Math.round(+inp.nGirders||0))||null} setBy="PS-Beam"/>
  ```
- **Check case:** n/a, no computed value changes. Functional check: see How verified.
- **How verified:** `node --check` on every plain inline script and @babel/standalone transpile of the text/babel block; BridgeXfer copy compared byte-for-byte with HANDOFF.md §5; whole page loaded in jsdom (React/ReactDOM/Babel from npm, other CDN scripts blocked); Share → Use round trip between lldf, Moving Load Generator, psbeam, stgirder and index with one shared localStorage; `git diff` shows only additions apart from the one header line that received the link.
- **Other copies:** BridgeXfer v1 and the `BXProject` glue are also in index.html, lldf.html, psbeam.html, stgirder.html and Moving Load Generator.html (this PR).

## 2026-10-04 — PR: claude/conn-reactions-subloads (PR link added after merge)

Feature: hand-off (no result change). PS-Beam sends the **unfactored** DC1, DC2 and DW end reactions of its one girder line to Bridge Substructure Loading on channel `superReactions` (HANDOFF.md §4.4). Nothing is sent automatically: only the new "Send reactions to Substructure Loading" button writes `bridgeSuite.v1.superReactions`, `bridgeSuite.v1.superReactions.updatedAt` and the per-producer copy `bridgeSuite.v1.superReactions.by.psbeam`. "Export hand-off (JSON)" writes the same payload to a file. No formula, factor, default, unit, storage key or saved format changed; the bridgeSuite bootstrap blocks and the BridgeXfer copy are unchanged (BridgeXfer v1 already in this file from step 1).

Mapping:

| Payload field | Source in this tool |
|---|---|
| `supports[].id` | `Support 1`, `Support 2` (simple span); `Support i`, `Support i+1` for imported MIDAS span i |
| `supports[].x` (ft) | 0 and L; MIDAS: span start x0 and x0 + span length |
| `girders[0].label` | shared design beam label (`BridgeBeam.get().label`) while the position follows it (`loads.posAuto`), else the Girder ID of the title block, else "Interior/Exterior girder" |
| `girders[0].position` | `inp.loads.pos` |
| `DC1` (kip) | `(wG + wDk)·L/2` + diaphragms by statics, with `wG` = girder self-weight, `wDk` = deck + haunch + `loads.wNC` (`R.wG`, `R.wDk`); same diaphragm filter as `computeAll`. Also in MIDAS mode (PS-Beam always computes DC1 itself) |
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
- **Where:** new function directly above `function computeAll(inp){` (≈ line 2643). Anchor text: `function bxSuperRxPayload(inp,R){`
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
   Loading. Reads the load terms computeAll() already produced (R.wG, R.wDk, R.wBar, R.wDW, R.L,
   the same diaphragm filter, and buildExternal() for an active MIDAS import). Changes no result. */
function bxSuperRxPayload(inp,R){
  if(!R||R.error) return {error:'the design has an input error'+(R&&R.error?' ('+R.error+')':'')};
  const L=+R.L; if(!(L>0)) return {error:'the span length is not positive'};
  const half=w=>(+w)*L/2;                                                 // simple span: R = wL/2 at each end
  const diaph=(inp.loads.diaph||[]).filter(d=>+d.P>0 && +d.a>=0 && +d.a<=L);  // same filter as computeAll
  const diaL=diaph.reduce((s,d)=>s+(+d.P)*(L-(+d.a))/L,0), diaR=diaph.reduce((s,d)=>s+(+d.P)*(+d.a)/L,0);
  // DC1 here = everything on the bare girder: self-weight + deck/haunch (+ non-composite extra) + diaphragms
  const dc1=[half(R.wG)+half(R.wDk)+diaL, half(R.wG)+half(R.wDk)+diaR];
  let dc2=[half(R.wBar),half(R.wBar)], dw=[half(R.wDW),half(R.wDW)];
  let ids=['Support 1','Support 2'], xs=[0,L], span={index:null,length:+L.toFixed(3)}, live=null;
  const pos=inp.loads.pos==='exterior'?'exterior':'interior';
  const BB=window.BridgeBeam, db=(BB&&inp.loads.posAuto!==false)?BB.get():null;
  const label=(db&&db.label)?db.label:(String((inp.proj&&inp.proj.girderId)||'').trim()||(pos==='exterior'?'Exterior girder':'Interior girder'));
  const notes=['Single girder line: '+label+' ('+pos+') designed in PS-Beam. The values are for this one girder; Substructure Loading decides which girders they apply to.',
    'Unfactored. DC1 = girder self-weight '+R.wG.toFixed(3)+' klf + deck/haunch and other non-composite DC '+R.wDk.toFixed(3)+' klf'+(diaph.length?' + '+diaph.length+' diaphragm point load(s)':'')+', all on the non-composite girder. DC2 = barrier / SIDL. DW = wearing surface.'];
  if(R.useExt&&inp.external){
    const ext=buildExternal({...inp.external,_selSpan:inp.external._selSpan},L,{pos:1,neg:1,v:1});
    if(!ext) return {error:'the imported MIDAS demands could not be read'};
    const sL=ext.spanLen, sel=ext.sel||{}, i=Math.max(1,+sel.idx||1), x0=+sel.x0||0;
    dc2=[ext.V_DC2(0),-ext.V_DC2(sL)]; dw=[ext.V_DW(0),-ext.V_DW(sL)];    // V_ already sign-flipped to + up at the left end
    ids=['Support '+i,'Support '+(i+1)]; xs=[x0,x0+sL]; span={index:i,length:+sL.toFixed(3)};
    notes.push('MIDAS import active (span '+i+'): DC2 and DW are the imported shears at the two ends of this span, sign-corrected to reactions (+ up). At an interior pier they are this span\'s share only; add the share of the adjacent span. DC1 is computed by PS-Beam on the simple non-composite span (L = '+L.toFixed(2)+' ft).');
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
    girderLine:{label,position:pos,beamIndex:db?db.index:null,source:R.useExt?'PS-Beam DC1 + MIDAS DC2/DW':'PS-Beam simple span'},
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
  const bxSendRx=()=>{ if(window.BXSuperRx) window.BXSuperRx.send(()=>bxSuperRxPayload(inp,R),'PS-Beam','psbeam.html','psbeam'); else alert('The hand-off helper is not available in this browser.'); };
  const bxExportRx=()=>{ if(window.BXSuperRx) window.BXSuperRx.exportJSON(()=>bxSuperRxPayload(inp,R),'PS-Beam','psbeam.html'); else alert('The hand-off helper is not available in this browser.'); };
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
