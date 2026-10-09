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

## 2026-10-09 — PR: claude/tabs-psbeam (PR link added after merge)

### T1. Inputs page split into sub-tabs   [UI only — no calculation change]
- **Date / type:** 2026-10-09, UI only (no result change). Engineer's request (2026-10-09): "Go through all the apps and make sure they are all formatted with the input panel having tabs rather than one long scrolling input panel." In this tool the inputs are not a sidebar: "Inputs" is one of the top-level tabs, a page of 10 cards next to the Live Geometry panel. A sub-tab strip now sits at the top of that page and groups the 10 cards. The page layout (cards column + Live Geometry column) is unchanged.
- **How it works (React):** `InputsTab()` still renders every card exactly as before, in the same order. Each group of cards is wrapped in one `<div className="psbInPane" role="tabpanel">`; the inactive panes only get the `hidden` attribute. Nothing is unmounted or re-created when the sub-tab changes, so the card fold state, every `u('…')` setter, the strand-row table, the LL & DL / dead-load / geometry lock controls and the MIDAS banner work exactly as before. The MIDAS banner (span picker), the "Read the import guide" line and the "Detailing warnings" callout stay above the panes and show on every sub-tab, as they did above the cards.
- **Sub-tabs (in order) and the cards in each:**

| Sub-tab | Cards |
|---|---|
| Geometry | Girder & Bridge Geometry |
| Materials | Materials & Time |
| Strands | Prestressing Strands |
| Loads | Loads; Continuity for LL + SIDL |
| Handling & Deck | Handling — Lifting & Hauling; Deck Design (Transverse) |
| Analysis Options | Analysis Options |
| Reinforcement | Shear & Longitudinal Reinforcement (Trial); End-Region / Anchorage Zone |

  The order is the existing card order, so no card moved. No card is mode-dependent (Continuity, Handling and Deck keep their ON/OFF switch in the card header), so no sub-tab is ever empty or hidden.
- **Error marker:** red dot on a sub-tab whose pane holds an editable number box that is empty, holds text the browser cannot parse (`validity.badInput`), or is outside its own `min`/`max`. Boxes with a placeholder (the gross-section overrides, meant to be left blank) and read-only boxes driven by a lock are skipped. Refreshed after every render. Note: when `computeAll()` returns `R.error` the app shows the input-error callout instead of the whole tab area (unchanged), so the dot only covers the non-fatal cases.
- **Go-to-input links:** none exist in this tool (no code scrolls to or focuses an input), so nothing else needed a sub-tab switch.
- **Keyboard / accessibility:** `role="tablist"` / `role="tab"` (`aria-selected`, `aria-controls`) / `role="tabpanel"` (`aria-labelledby`); roving `tabindex`; ←/→, Home and End move between the sub-tabs.
- **New storage key:** `psbeam.inputTab.v1` (localStorage, plain string: `geom`, `mat`, `strands`, `loads`, `hd`, `opts` or `reinf`; follows the tool's `psbeam.*` prefix). Remembers the active sub-tab per browser. Read and write in try/catch with an in-memory fallback. **Not** in `inp`, so the autosave `psbeam.inputs.v1`, `psbeam.ui.v1`, the project library `psbeam.projects.v1`, Export/Import JSON, the MIDAS import and every `bridgeSuite.v1.*` hand-off are unchanged. No existing key or format changed.
- **Print:** unchanged. Printing while on the Inputs tab still prints every card: `@media print` shows the hidden panes (same idea as the existing `.card-b{display:block!important}` for collapsed cards) and hides the sub-tab strip (`noprint`). The Report tab does not use the Inputs page.
- **Narrow screens:** the strip wraps (`flex-wrap`) and is sticky at the top of the window while the Inputs page scrolls. Existing layout note: at 400 px the page already scrolls sideways (document width 637 px before, because of wide tables in the Loads / Strands cards); this was not changed.
- **Governing provision:** none (no engineering change).
- **Before / After** (exact; insertions only, no existing line changed or removed):
  1. CSS. Anchor (unchanged): `.tab:focus-visible{outline:2px solid var(--blue);outline-offset:-2px}`. Inserted right after it:
     ```css
     /* Inputs page sub-tabs (PsbInTabs, UI only): same look as the main .tab strip, one size down */
     .psbInTabs{position:sticky;top:0;z-index:20;display:flex;flex-wrap:wrap;gap:0;background:var(--sheet);border-bottom:1.5px solid var(--ink);margin:0 0 14px;padding-top:2px}
     .psbInTab{display:inline-flex;align-items:center;font-family:var(--sans);font-stretch:75%;font-weight:700;font-size:11.5px;letter-spacing:.6px;text-transform:uppercase;
       padding:7px 11px 6px;border:none;background:transparent;color:var(--ink2);cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-1.5px}
     .psbInTab:hover{color:var(--ink)}
     .psbInTab[aria-selected="true"]{color:var(--blue);border-bottom-color:var(--blue)}
     .psbInTab:focus-visible{outline:2px solid var(--blue);outline-offset:-2px}
     .psbInDot{display:none;width:7px;height:7px;border-radius:50%;background:var(--fail);margin-left:6px}
     .psbInTab.has-err .psbInDot{display:inline-block}
     .psbInPane[hidden]{display:none}
     ```
  2. Print CSS. Anchor (unchanged): `  .card-b{display:block!important}   /* a card collapsed on screen still prints */`. Inserted right after it:
     ```css
       .psbInPane[hidden]{display:block!important}   /* every input sub-tab pane prints, as before */
     ```
  3. Module scope of the `text/babel` script, right before `function InputsTab({inp,set,R,selRow,setSelRow,editedRows,flashRow,editLog,clearLog}){`:
     ```jsx
     /* ---------- Inputs page sub-tabs (UI only) ----------
        Every input card is still rendered exactly as before; each group of cards is
        wrapped in one pane and the inactive panes are only hidden (the `hidden`
        attribute), never unmounted, so card state, handlers and bound values are
        untouched and print still shows every card. The active sub-tab is remembered
        per browser in localStorage key psbeam.inputTab.v1 (never in inp, so the
        autosave, the project library and the JSON export are unchanged). */
     const PSB_IN_TABS=[['geom','Geometry'],['mat','Materials'],['strands','Strands'],['loads','Loads'],
       ['hd','Handling & Deck'],['opts','Analysis Options'],['reinf','Reinforcement']];
     const PSB_IN_KEY='psbeam.inputTab.v1';
     let psbInTabMem=null;   // in-memory fallback when storage is blocked
     function psbInTabLoad(){ let v=psbInTabMem; try{ const s=localStorage.getItem(PSB_IN_KEY); if(s) v=s; }catch(e){}
       return PSB_IN_TABS.some(t=>t[0]===v)?v:'geom'; }
     function psbInTabSave(v){ psbInTabMem=v; try{ localStorage.setItem(PSB_IN_KEY,v); }catch(e){} }
     /* Red dot: a pane holds an editable number box that is empty, holds text the
        browser cannot parse, or is outside its own min/max. A box with a placeholder
        (the section-property overrides) is meant to be left blank, so blank is fine there. */
     function psbInPaneBad(el){ if(!el) return false;
       const ins=el.querySelectorAll('input[type="number"]');
       for(let i=0;i<ins.length;i++){ const x=ins[i]; if(x.disabled||x.readOnly) continue; const vy=x.validity||{};
         if((x.value===''&&!x.placeholder)||vy.badInput||vy.rangeUnderflow||vy.rangeOverflow) return true; }
       return false; }
     function PsbInTabs({tab,setTab,marks}){
       const ref=useRef(null);
       const onKey=e=>{ const n=PSB_IN_TABS.length, i=PSB_IN_TABS.findIndex(t=>t[0]===tab); let j=-1;
         if(e.key==='ArrowRight') j=(i+1)%n; else if(e.key==='ArrowLeft') j=(i-1+n)%n;
         else if(e.key==='Home') j=0; else if(e.key==='End') j=n-1;
         if(j<0) return; e.preventDefault(); const k=PSB_IN_TABS[j][0]; setTab(k);
         const b=ref.current&&ref.current.querySelector('#psbInTab-'+k); if(b) b.focus(); };
       return <div ref={ref} className="psbInTabs noprint" role="tablist" aria-label="Input groups" onKeyDown={onKey}>
         {PSB_IN_TABS.map(([k,l])=>{ const bad=marks.indexOf(k)>=0;
           return <button key={k} type="button" role="tab" id={'psbInTab-'+k} aria-controls={'psbInPane-'+k}
             aria-selected={tab===k} tabIndex={tab===k?0:-1} className={'psbInTab'+(bad?' has-err':'')}
             title={bad?'A number in this group is empty or not valid':undefined}
             onClick={()=>setTab(k)}>{l}<span className="psbInDot" aria-hidden="true"></span></button>; })}
       </div>;
     }
     ```
  4. `InputsTab()`, right after `  const [showHelp,setShowHelp]=useState(false);`:
     ```jsx
       // Inputs page sub-tabs (UI only; see PsbInTabs)
       const [inTab,setInTabS]=useState(psbInTabLoad);
       const setInTab=k=>{ setInTabS(k); psbInTabSave(k); };
       const inPane=k=>({className:'psbInPane',role:'tabpanel',id:'psbInPane-'+k,'aria-labelledby':'psbInTab-'+k,hidden:inTab!==k});
       const [inMarks,setInMarks]=useState([]);
       useEffect(()=>{ const m=PSB_IN_TABS.map(t=>t[0]).filter(k=>psbInPaneBad(document.getElementById('psbInPane-'+k)));
         if(m.join()!==inMarks.join()) setInMarks(m); });
     ```
  5. `InputsTab()` render, right after `    {showHelp&&<MidasHelp onClose={()=>setShowHelp(false)}/>}`:
     ```jsx
         <PsbInTabs tab={inTab} setTab={setInTab} marks={inMarks}/>
     ```
  6. Pane wrappers (each line inserted on its own line, 4-space indent):
     - before `    <Card title="Girder & Bridge Geometry"`: `    <div {...inPane('geom')}>`
     - before `    <Card title="Materials & Time"`: `    </div>` then `    <div {...inPane('mat')}>`
     - before `    <Card title="Prestressing Strands"`: `    </div>` then `    <div {...inPane('strands')}>`
     - before `    <Card title="Loads" refTag="LRFD 3.6 / 4.6.2.2" fold>`: `    </div>` then `    <div {...inPane('loads')}>`
     - before `    <Card title="Handling — Lifting & Hauling"`: `    </div>` then `    <div {...inPane('hd')}>`
     - before `    <Card title="Analysis Options"`: `    </div>` then `    <div {...inPane('opts')}>`
     - before `    <Card title="Shear &amp; Longitudinal Reinforcement (Trial)"`: `    </div>` then `    <div {...inPane('reinf')}>`
     - after the `    </Card>` that closes `End-Region / Anchorage Zone` (the last card, just before `  </div>);`): `    </div>`
- **Check case:** n/a, no computed value changes.
- **How verified:** `node --check` on all 8 inline scripts, with the `text/babel` block transpiled by @babel/standalone 7.23.5 (presets env, react), for main and branch. Headless Chromium (Playwright) with the pinned React 18.2.0 / ReactDOM 18.2.0 / Babel 7.23.5 / Plotly 2.27.0 / KaTeX 0.16.9 served locally from npm packs, main (origin/main 3cfe453) vs branch, clock frozen. Scenarios: default; Continuity + Handling + Deck + section overrides ON; Custom girder; AASHTO BIII-36 box; NEXT 36F; MIDAS `psbeam-external-demands` import of a 2-span file with span 1 and then span 2 picked; a blank field (Area per leg). For each: text of every top-level tab (Inputs cards + every control's type/value/label, Section Props … Report, status band), Export JSON, all localStorage (autosave, `psbeam.*`, `bridgeSuite.v1.*` incl. psSection publisher) before and after "Send reactions to Substructure Loading", the "Export hand-off (JSON)" file, and an Export → Import → Export round trip in a fresh page: all identical (only difference: the test folder name inside `bridgeSuite.v1.appPaths`, normalised). Branch UI checks: 10 cards, each in exactly one pane; keyboard ←/→/Home/End; sub-tab kept after reload and after leaving and returning to the Inputs tab; storage blocked → works from memory; print media shows all 7 panes and hides the strip; red dot on the right sub-tab for a blank Materials field and for a blank field on a hidden sub-tab; no dot in the default or all-ON states; no console errors. `git diff` is additions only.
- **Other copies:** none (the `bridgeSuite.v1.*` bootstrap / BridgeXfer code was not touched).
- **Open items:**
  - O-T1. A blank MIDAS DF / multiple-presence box (taken as 1.0 by `computeAll`) gets a red dot, since the UI does not say blank is allowed there. Say if you want those excluded.
  - O-T2. Clicking a strand in the Live Geometry drawing selects a strand row but does not switch to the Strands sub-tab (it never scrolled before either). Can be added if wanted.

## 2026-10-09 — PR: claude/psbeam-subtab-followup (PR link added after merge)

Follow-up to T1 (open items O-T1 and O-T2), per the engineer's decisions of 2026-10-09.

### T2. Blank imported-LL DF / multiple-presence boxes: "blank — 1.0 used"   [UI only — no calculation change]
- **Date / type:** 2026-10-09, UI only (no result change). Engineer's decision on O-T1: "include DF boxes with a 1.0 used". The boxes stay in the red-dot check, and the UI now says that the calculation uses 1.0 when they are blank: an inline hint under each blank box, and the dot's tooltip.
- **Boxes covered:** all four appear only while a MIDAS import is active (Loads card → LL section): `DF — positive moment` (`inp.loads.extDFpos`), `DF — negative moment` (`extDFneg`), `DF — shear` (`extDFv`) and `Multiple presence (m)` (`extLLmpf`). Confirmed in `computeAll()` (anchor `const fac1=(v)=>{ if(v===''||v===null||v===undefined) return 1;`): each of the four goes through `fac1`, so blank (`''`, `null` or missing) → 1.0. An entered 0 stays 0 and raises the existing warning. No other DF / MPF box is treated this way. The non-MIDAS `dfm` / `dfv` boxes do not go through `fac1` and were not marked.
- **Before / After** (exact):
  1. `Num` component. Anchor: `const Num=({l,u,v,set,step=0.1,min,driven,src,sub`.
     Before:
     ```jsx
     const Num=({l,u,v,set,step=0.1,min,driven,src,sub})=>(
       <div className="fld"><label>{l}</label><div className="fwrap">
         <input type="number" step={step} min={min} value={v}
     ```
     After:
     ```jsx
     const Num=({l,u,v,set,step=0.1,min,driven,src,sub,blank1})=>(
       <div className="fld"><label>{l}</label><div className="fwrap">
         <input type="number" step={step} min={min} value={v} data-blank1={blank1?'1':undefined}
     ```
     In the same component, right after `    {sub&&<span className="sub">{sub}</span>}` (the line followed by `{driven&&src?<span className="bl-src">`), inserted:
     ```jsx
         {blank1&&(v===''||v===null||v===undefined)?<span className="sub">blank — 1.0 used</span>:null}
     ```
  2. `InputsTab()`, the four boxes. Anchor: `<Num l="DF — positive moment"`. On each of the four `<Num … driven={lldfLocked} src={lldfSrc}/>` lines (`DF — positive moment`, `DF — negative moment`, `DF — shear`, `Multiple presence (m)`), `src={lldfSrc}/>` → `src={lldfSrc} blank1/>`.
  3. Red-dot check (module scope, before `function PsbInTabs`). Before:
     ```jsx
     /* Red dot: a pane holds an editable number box that is empty, holds text the
        browser cannot parse, or is outside its own min/max. A box with a placeholder
        (the section-property overrides) is meant to be left blank, so blank is fine there. */
     function psbInPaneBad(el){ if(!el) return false;
       const ins=el.querySelectorAll('input[type="number"]');
       for(let i=0;i<ins.length;i++){ const x=ins[i]; if(x.disabled||x.readOnly) continue; const vy=x.validity||{};
         if((x.value===''&&!x.placeholder)||vy.badInput||vy.rangeUnderflow||vy.rangeOverflow) return true; }
       return false; }
     ```
     After:
     ```jsx
     /* Red dot: a pane holds an editable number box that is empty, holds text the
        browser cannot parse, or is outside its own min/max. A box with a placeholder
        (the section-property overrides) is meant to be left blank, so blank is fine there.
        A blank box marked data-blank1 (the imported-LL DF / multiple-presence boxes,
        which computeAll takes as 1.0 when blank) still gets the dot, but its tooltip
        says 1.0 is used. Returns '' (fine), 'bad', 'blank1' or 'both'. */
     function psbInPaneState(el){ if(!el) return '';
       let bad=false, b1=false;
       const ins=el.querySelectorAll('input[type="number"]');
       for(let i=0;i<ins.length;i++){ const x=ins[i]; if(x.disabled||x.readOnly) continue; const vy=x.validity||{};
         if(vy.badInput||vy.rangeUnderflow||vy.rangeOverflow) bad=true;
         else if(x.value===''&&!x.placeholder){ if(x.getAttribute('data-blank1')==='1') b1=true; else bad=true; } }
       return bad&&b1?'both':bad?'bad':b1?'blank1':''; }
     const PSB_IN_DOT_TIP={bad:'A number in this group is empty or not valid',
       blank1:'A DF / multiple-presence box is blank — 1.0 used',
       both:'A number in this group is empty or not valid; a blank DF / multiple-presence box uses 1.0'};
     ```
  4. `PsbInTabs()`: `const bad=marks.indexOf(k)>=0;` → `const bad=!!marks[k];` and `title={bad?'A number in this group is empty or not valid':undefined}` → `title={bad?PSB_IN_DOT_TIP[marks[k]]:undefined}`.
  5. `InputsTab()`. Before:
     ```jsx
       const [inMarks,setInMarks]=useState([]);
       useEffect(()=>{ const m=PSB_IN_TABS.map(t=>t[0]).filter(k=>psbInPaneBad(document.getElementById('psbInPane-'+k)));
         if(m.join()!==inMarks.join()) setInMarks(m); });
     ```
     After:
     ```jsx
       const [inMarks,setInMarks]=useState({});   // {sub-tab key: 'bad'|'blank1'|'both'}
       useEffect(()=>{ const m={}; PSB_IN_TABS.forEach(t=>{ const st=psbInPaneState(document.getElementById('psbInPane-'+t[0])); if(st) m[t[0]]=st; });
         if(JSON.stringify(m)!==JSON.stringify(inMarks)) setInMarks(m); });
     ```
- **Governing provision:** none changed. For reference only: DF per LRFD 4.6.2.2 and multiple presence per LRFD 3.6.1.1.2 (labels in the card, unchanged).
- **Check case (shows no result change):** MIDAS import (2-span test file, span 1) with DF +M = DF −M = DF V = m = 1.0 gives status band S0. Clearing each box in turn, and then all four at once, gives a status band identical to S0 (blank = 1.0) and identical to main for the same blank inputs. Export JSON is identical to main. The combined-factors line reads +M = −M = V = 1.000 in both.
- **How verified:** see T3.
- **Other copies:** none.

### T3. Strand clicked in the Live Geometry drawing → Strands sub-tab   [UI only — no calculation change]
- **Date / type:** 2026-10-09, UI only. Engineer's decision on O-T2: clicking a strand in the drawing (which selects its row) also switches the Inputs sub-tab to "Strands" and scrolls the selected row into view.
- **Where the drawing appears:** `CrossSection` is rendered in one place only: the Live Geometry card beside the Inputs page (`tab==='inputs'`). No other top-level tab shows it, so the switch never needs to change the top-level tab.
- **Behaviour:** only a click that *selects* a strand switches the sub-tab. A click that deselects, a click in "+ add strands" mode and the row nudge / remove buttons do not. The switch goes through the normal sub-tab setter, so `psbeam.inputTab.v1` remembers "strands" just as it does for a manual click. If the Strands card is folded, the pane (card header) is scrolled into view instead and the fold state is left alone. A pick is not replayed when the Inputs page is left and re-opened.
- **Before / After** (exact):
  1. `CrossSection` signature. `function CrossSection({inp,R,set,selRow,setSelRow,flashRow,logEdit,revertStrands,strandsDirty}){` → `function CrossSection({inp,R,set,selRow,setSelRow,flashRow,logEdit,revertStrands,strandsDirty,onPickStrand}){`
  2. `CrossSection`, strand `<circle>` click. Before:
     ```jsx
                 if(addMode){return;} setSel(selRow===s.ri&&selSlot===s.slot?null:{ri:s.ri,slot:s.slot});}):undefined}/>;})}
     ```
     After:
     ```jsx
                 if(addMode){return;} const off=selRow===s.ri&&selSlot===s.slot; setSel(off?null:{ri:s.ri,slot:s.slot});
                 if(!off&&onPickStrand) onPickStrand(s.ri);}):undefined}/>;})}
     ```
  3. `InputsTab` signature: `…,editLog,clearLog}){` → `…,editLog,clearLog,strandPick}){`. Inserted right after the `inMarks` effect (T2 item 5):
     ```jsx
       // A strand clicked in the Live Geometry drawing selects its row: show the
       // Strands sub-tab and bring that row into view (the card itself if it is folded).
       // Only picks made while this page is open count (not an old one on re-mount).
       const pickAtMount=useRef(strandPick);
       useEffect(()=>{ if(!strandPick||strandPick===pickAtMount.current) return; setInTab('strands');
         const t=setTimeout(()=>{ const pane=document.getElementById('psbInPane-strands'); if(!pane) return;
           const tr=pane.querySelector('tr[data-psb-row="'+strandPick.ri+'"]');
           const el=(tr&&tr.offsetParent!==null)?tr:pane;
           try{ el.scrollIntoView({block:tr&&el===tr?'center':'start'}); }catch(e){} },0);
         return ()=>clearTimeout(t); },[strandPick]);
     ```
  4. Strand row table in `InputsTab`: `return <tr key={i} onClick={()=>setSelRow&&setSelRow(isSel?null:i)}` → `return <tr key={i} data-psb-row={i} onClick={()=>setSelRow&&setSelRow(isSel?null:i)}`
  5. `App()`. Inserted right after `  const [selRow,setSelRow]=useState(null);`:
     ```jsx
       const [strandPick,setStrandPick]=useState(null);   // {ri}, a new object per click: a strand clicked in the drawing -> Inputs "Strands" sub-tab
     ```
     `<InputsTab … clearLog={clearLog}/>` → `<InputsTab … clearLog={clearLog} strandPick={strandPick}/>`. Under the `<CrossSection … logEdit={logEdit}` line, a new prop line `              onPickStrand={ri=>setStrandPick({ri})}` was inserted before `revertStrands=…`.
- **New storage keys:** none. `strandPick` is React state only and is never saved.
- **Governing provision:** none (no engineering change).
- **Check case:** n/a, no computed value changes.
- **How verified (T2 and T3):**
  - `node --check` on all 8 inline scripts, for main and branch. The `text/babel` block was transpiled first with @babel/standalone 7.23.5.
  - Headless Chromium (Playwright), main (598eef4) vs branch, with the clock frozen. The pinned React 18.2.0 / ReactDOM 18.2.0 / Babel 7.23.5 / Plotly 2.27.0 / KaTeX 0.16.9 were served locally.
  - The T1 comparison set: default; Continuity + Handling + Deck + overrides ON; Custom; BIII-36 box; NEXT 36F; MIDAS 2-span import (span 1, then span 2); blank Area per leg. Compared for each: every top-level tab's text, every Inputs control, the status band, Export JSON, all localStorage before and after "Send reactions to Substructure Loading", the hand-off export file, and an Export → Import → Export round trip. All identical.
  - T2: each of the four boxes blank, then all four. Status band and Export JSON identical to main and to the 1.0 values. The "blank — 1.0 used" line appears under each blank box only. The Loads sub-tab dot tooltip reads "A DF / multiple-presence box is blank — 1.0 used". With another Loads box also blank, the combined tooltip shows.
  - T3, all starting from the Geometry sub-tab:
    - Clicking a strand selects the Strands sub-tab, sets `psbeam.inputTab.v1` = `strands`, and highlights row 1 inside the viewport.
    - Clicking the same strand again (deselect) stays on Strands.
    - Clicking another strand selects row 3, in view.
    - Leaving Inputs and coming back on Geometry stays on Geometry.
    - With the Strands card folded, the click switches the sub-tab and scrolls the pane in, with no error.
    - A click in "+ add strands" mode does not switch.
  - No console errors. The only console message is Babel's existing "deoptimised the styling" note, which main shows too.
- **Other copies:** none (the `bridgeSuite.v1.*` bootstrap / BridgeXfer code was not touched).
- **Open items (found, not changed):**
  - O-T3. The "Combined factors (DF×MPF)" line under these boxes uses `(+x||1)`. An *entered 0* therefore shows as 1.000 there, while `computeAll` uses 0 (and warns). This affects the display only. Blank correctly shows 1.000. Say if the line should show 0.
  - O-T4. `lldfMineFor()` reads a blank DF / MPF box as 0 (`+''`), not 1.0. This is used for the "before" values when locking to the LL & DL app and for the unlock snapshot (`BL.saveSnap`). So: a blank box → Lock → Unlock → "Restore the values you had before locking?" → OK would restore **0**, not blank. That zeroes that live-load effect, and the existing warning fires. The confirm dialog does show "… → 0". Found by reading the code, not run. This is pre-existing and not changed here, because it touches the hand-off snapshot. Fix if wanted: snapshot the raw value, or `fac1` it.

## 2026-10-09 — PR: claude/psbeam-lock-blank (PR link added after merge)

Fixes open items O-T4 and O-T3 (above), per the engineer's decision of 2026-10-09.

### T4. LL & DL lock: a blank imported-LL DF / MPF box came back as 0 after Unlock → Restore   [BUG FIX — changes results only in that scenario]
- **Date / type:** 2026-10-09, bug fix in the lock snapshot / restore path. No formula, factor, unit or code reference changed.
- **Problem (reproduced on main 5b01018 in headless Chromium):** the four imported-LL boxes (`DF — positive moment` `loads.extDFpos`, `DF — negative moment` `extDFneg`, `DF — shear` `extDFv`, `Multiple presence (m)` `extLLmpf`) are taken as **1.0** by `computeAll()` when blank (`fac1`). `lldfMineFor()` turns them into numbers with `+v`, so a blank box became **0** in the pre-lock snapshot (`BL.saveSnap(LOCK_APP,'lldf',lldfMine())`). Blank → Lock → Unlock → "Restore the values you had before locking?" → OK then wrote 0 into the box, which zeroes that live-load effect (and the existing "… is 0 — that live-load effect is zeroed" warning fires). The dialog read "DF +M 0.650 → 0.000". Unconservative.
- **Fix:** the snapshot keeps a blank box as `''` (blank), so Restore puts it back blank and `fac1` uses 1.0 again. The restore dialog shows `blank (1.0 used)` for such a box instead of `0.000`. `lldfMineFor()` itself is unchanged, so the values the lock *adopts* and the change-log / toast text are exactly as before.
- **Other fields in the lock snapshot / restore path, checked for blank → 0:**
  | Field (channel) | Blank in the calculation | Snapshot blank → 0 matters? | Changed? |
  |---|---|---|---|
  | `extDFpos`, `extDFneg`, `extDFv`, `extLLmpf` (lldf, MIDAS mode) | 1.0 (`fac1`) | **yes** | **fixed** |
  | `fatM` (lldf, both modes) | `+'' > 0` false → auto (DF÷1.2), same as 0; no input box (set only by a pull or "clear → auto" = 0) | no | no |
  | `dfm`, `dfv` (lldf, HL-93 mode) | the boxes store `+e.target.value`, so they can never be blank (blank is stored as 0); `+inp.loads.dfm` | no | no |
  | `wBar`, `wDW` (dlLoads) | `+inp.loads.wBar` / `inp.loads.wBar*…` → 0 | no (calc identical; after Restore the box shows `0` instead of blank, display only) | no |
- **New storage keys / format:** none. The snapshot is still `bridgeSuite.v1.lockSnap.psbeam` → `{lldf:{at,data:{…}}}`; a blank box is now stored as `""` instead of `0`. A snapshot already saved by an older copy (with `0`) cannot be told apart from an entered 0 and is restored as 0, exactly as before; it is cleared on the next unlock. An older snapshot holding `null` (a box that was missing from an old project) is now shown as `blank (1.0 used)`; restoring it behaves as before (`fac1(null)` = 1.0).
- **Before / After** (exact):
  1. Module scope, right after `function lldfMineFor(inp){ … }` (anchor `  : {dfm:+inp.loads.dfm, dfv:+inp.loads.dfv, fatM:+inp.loads.fatM}; }`), inserted:
     ```jsx
     /* The imported-LL DF / multiple-presence boxes: computeAll (fac1) takes a blank
        box as 1.0, not 0. The pre-lock snapshot and the unlock "restore" prompt must
        therefore keep a blank box blank instead of turning it into 0 via +''. */
     const LLDF_BLANK1={extDFpos:1,extDFneg:1,extDFv:1,extLLmpf:1};
     function isBlank1(v){ return v===''||v===null||v===undefined; }
     function extFac1(v){ if(isBlank1(v)) return 1; const n=+v; return isFinite(n)? n : 1; }   // same rule as fac1 in computeAll
     function lldfSnapFor(inp){ const m=lldfMineFor(inp);
       if(extActiveOf(inp)) Object.keys(LLDF_BLANK1).forEach(k=>{ if(isBlank1(inp.loads[k])) m[k]=''; });
       return m; }
     function lldfBackDeltas(mine,snap){ const B='blank (1.0 used)', out=[];
       Object.keys(snap).forEach(k=>{ const a=mine[k], b=snap[k];
         if(LLDF_BLANK1[k]&&(isBlank1(a)||isBlank1(b))){ if(isBlank1(a)&&isBlank1(b)) return;
           const d=LLDF_DIG[k]; out.push({key:k, label:LLDF_LABELS[k], from:isBlank1(a)?B:(+a).toFixed(d), to:isBlank1(b)?B:(+b).toFixed(d)}); }
         else out.push(...BL.deltas({[k]:a},{[k]:b},LLDF_LABELS,LLDF_DIG)); });
       return out; }
     ```
     (`lldfBackDeltas` hands every pair without a blank to the shared `BL.deltas`, key by key in the same order, so those lines are unchanged.)
  2. `InputsTab()` → `toggleLLDFLock`, lock branch. Before:
     ```jsx
           BL.saveSnap(LOCK_APP,'lldf',lldfMine());
     ```
     After:
     ```jsx
           BL.saveSnap(LOCK_APP,'lldf',lldfSnapFor(inp));   // blank DF/MPF box stays blank (1.0), not 0
     ```
  3. Same function, unlock branch. Before:
     ```jsx
             const back=BL.deltas(lldfMine(),s.data,LLDF_LABELS,LLDF_DIG);
     ```
     After:
     ```jsx
             const back=lldfBackDeltas(lldfSnapFor(inp),s.data);
     ```
     The restore itself (`set(p=>({...p, loads:{...p.loads, ...s.data}}))`) is unchanged; it now writes `''` back for a box that was blank.
- **Governing provision:** none changed. For reference: LL distribution factors AASHTO LRFD 10th Ed. (2024) Art. 4.6.2.2; multiple presence Art. 3.6.1.1.2; Strength I load factors Table 3.4.1-1. The rule "blank = 1.0, entered 0 = 0" is the existing `fac1` in `computeAll()` (unchanged).
- **Check case (run in headless Chromium, main vs branch):** PCI BT-72 default girder, MIDAS 2-span test import (span 1, L = 100 ft, M_LL+ = 3,000 k-ft at midspan, M_LL− = −450 k-ft there, V_LL = 95 kip at the support), LL & DL publish g_M(+M) = 0.65, g_M(−M) = 0.60, g_V = 0.72 (interior). `DF — positive moment` cleared (blank); the other three boxes = 1.0. Lock → (factors adopted: 0.65 / 0.60 / 0.72 / 1.0) → Unlock → Restore OK.
  - Hand check: M_LL+IM = DF × m × M_LL,MIDAS = 1.0 × 1.0 × 3,000 = **3,000 k-ft** (blank). With DF = 0: the +M envelope is 0 × 3,000 = 0, and the displayed governing |M_LL| becomes 450 k-ft (the −M envelope at midspan). Midspan M_u = 1.25 M_DC + 1.50 M_DW + 1.75 M_LL+ loses 1.75 × 3,000 = 5,250 k-ft.
  - | Result | Blank, never locked | main after Restore (DF +M = 0) | branch after Restore (blank) |
    |---|---|---|---|
    | Restore dialog line | — | `DF +M  0.650 → 0.000` | `DF +M  0.650 → blank (1.0 used)` |
    | Box after restore | blank | `0` | blank ("blank — 1.0 used") |
    | M_LL (governing) | 3,000 k-ft | 450 k-ft | 3,000 k-ft |
    | M_u (Strength I, midspan) | 9,177 k-ft | 3,927 k-ft | 9,177 k-ft |
    | Flexure ratio M_u/φM_n (φM_n = 13,639 k-ft) | 0.673 | 0.288 | 0.673 |
    | RF_inv / RF_opr (Rating tab, flexure) | 1.85 / 2.40 | 12.33 / 15.99 | 1.85 / 2.40 |
    | Service I top comp., full load | 1.541 ksi @ 50 ft (0.30) | 1.032 ksi @ 30 ft (0.20) | 1.541 ksi @ 50 ft (0.30) |
    | Deck compression (SIDL + LL) | 0.797 ksi | 0.149 ksi | 0.797 ksi |
    | Status band: Shear | 0.74 | 0.63 | 0.74 |
    RF check: RF_inv × M_LL is the same capacity left for LL in both: 1.85 × 3,000 = 5,550 ≈ 12.33 × 450 = 5,549 k-ft. M_u check: 9,177 − 3,927 = 5,250 = 1.75 × 3,000 (the +M LL term removed).
  - The same run with the other boxes: `DF — shear` blank → main restored 0, V_LL 95 → 0 kip, status Shear 0.74 → 0.22; `Multiple presence (m)` blank → main restored 0, M_LL and V_LL both 0, RF_inv 1.85 → 99.00, Shear 0.74 → 0.22; `DF — negative moment` blank → main restored 0, −M envelope zeroed (Diagrams LL− column all 0, Report warning). On the branch every one of the four restores blank, and every result tab, the status band and Export JSON are identical to the blank-never-locked state.

### T5. "Combined factors (DF×MPF)" line uses the calculation's blank / 0 rule   [display only]
- **Date / type:** 2026-10-09, display only (O-T3). The line used `(+x||1)`, so an *entered 0* showed 1.000 while `computeAll` uses 0. It now uses `extFac1` (T4 item 1), the same rule as `fac1`: blank → 1.0, entered 0 → 0. Any other value shows as before.
- **Before / After** (exact), `InputsTab()`, anchor `Combined factors (DF×MPF): +M = <b>{fmt(`:
  - Before: `+M = <b>{fmt((+inp.loads.extDFpos||1)*(+inp.loads.extLLmpf||1),3)}</b>, −M = <b>{fmt((+inp.loads.extDFneg||1)*(+inp.loads.extLLmpf||1),3)}</b>, V = <b>{fmt((+inp.loads.extDFv||1)*(+inp.loads.extLLmpf||1),3)}</b>.`
  - After: `+M = <b>{fmt(extFac1(inp.loads.extDFpos)*extFac1(inp.loads.extLLmpf),3)}</b>, −M = <b>{fmt(extFac1(inp.loads.extDFneg)*extFac1(inp.loads.extLLmpf),3)}</b>, V = <b>{fmt(extFac1(inp.loads.extDFv)*extFac1(inp.loads.extLLmpf),3)}</b>.`
- **Governing provision:** none (display only).
- **Check case:** MIDAS import, `DF — shear` = 0 entered, others 1.0: main shows `V = 1.000`, branch shows `V = 0.000` (calculation uses 0 in both: V_LL ≈ 0 kip, warning shown). Blank boxes still show 1.000; 0.9 × 1.2 still shows 1.080.

### How verified (T4 and T5)
- `node --check` on all 8 inline scripts (the `text/babel` block transpiled with @babel/standalone 7.23.5), main and branch.
- Headless Chromium (Playwright), main (origin/main 5b01018) vs branch, clock frozen, pinned React 18.2.0 / ReactDOM 18.2.0 / Babel 7.23.5 / Plotly 2.27.0 / KaTeX 0.16.9 served locally.
- Reproduction: Blank → Lock → Unlock → Restore OK for each of the four boxes, main and branch (table above). Branch: snapshot holds `""`, box blank after restore, every result tab + status band + Export JSON identical to before locking. No console errors.
- Other lock scenarios, main vs branch (dialog texts, locked and final Export JSON, the snapshot key, all localStorage, every result tab, status band): MIDAS with numeric boxes (0.9, 1.2) and with all 1.0; MIDAS with `DF — shear` = 0 entered (only the combined-factors line differs, as intended); MIDAS with two blank boxes → Unlock → Cancel; HL-93 (non-MIDAS) lock/unlock with OK and with Cancel; dead-load lock with a blank DC2 box and DW = 0.05 (HL-93). All identical to main except, as intended: (a) entered 0: the combined-factors line reads `V = 0.000` (main `1.000`); (b) two blank boxes → Cancel: the snapshot holds `""` instead of `0` and the dialog reads `blank (1.0 used)` instead of `0.000` / `0.00`; the values kept after Cancel, Export JSON and all results are identical.
- The T1 comparison set (default; all-ON; Custom; BIII-36; NEXT 36F; MIDAS span 1 / span 2; blank Area per leg; hand-off export; Send reactions; Export → Import → Export round trip): rerun with `cmp.mjs`, 0 differences.
- **Other copies:** none. The `bridgeSuite.v1.*` bootstrap / BridgeLocks code (`BL.deltas`, `saveSnap`, `adopt`) was not touched.
- **Open items (found, not changed):**
  - O-T5. When locking, the "before" values in the lock's change-log entry and toast still come from `lldfMineFor()`, so a blank box is logged as `0.000 → 0.650`. This is text only (nothing is restored from it), and it is produced inside the shared `BL.adopt`. Left as is.
  - O-T6. After a dead-load (`dlLoads`) restore, a DC2 / DW box that was blank shows `0`. Same calculation (blank = 0 there); display only.
