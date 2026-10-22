# Fix log — Prestressed Bridge Design.html (psbeam.html until 2026-10-22)

**Renamed 2026-10-22** (PR claude/pbd-1-rename): this log was `fixlog/psbeam.md` and the tool was `psbeam.html`. Every entry before the rename entry (PBD-C, at the end) refers to `psbeam.html`; its anchors and code are unchanged in `Prestressed Bridge Design.html` unless a later entry says otherwise. `psbeam.html` is now a redirect page (PBD-C3).

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

## 2026-10-12 — PR: claude/sweep-psbeam (PR link added after merge)

Open-item sweep (engineer, 2026-10-12: "continue making updates and fixes until it's completed … use your best judgment"). It covers every psbeam item in the open-item inventory: O1–O8, OR1, OT5/OT6, AUDIT S7, A1 and A2. Items are listed in priority order: unconservative calc first, then bugs, UI, docs. Basis: AASHTO LRFD 10th Ed. (2024); MBE 3rd Ed. for the rating. Article numbers marked "verify" were not checked against a printed 10th Ed.

Line numbers are approximate, for the file after this PR. "Default" means the shipped `DEFAULTS` (PCI BT-72, L = 120 ft, S = 9 ft, interior). Every check case below was produced by the real `computeAll()` of origin/main (d6edfdd) and of this branch, run in headless Chromium (scratch `probe.mjs`).

New optional saved fields (all in `inp.opt`, with defaults in `DEFAULTS.opt`). Older files load unchanged, and a missing field takes its default through `mergeInputs`:
- `relCfac` (0.65)
- `rtPhiC` (1.0)
- `rtPhiS` (1.0)

No storage key was added or changed. The `bridgeSuite.v1.*` bootstrap / BridgeLocks / BridgeXfer blocks were not touched.

### W1. Exterior girder: effective flange width and deck dead load use S/2 + overhang (PSB-O5)   [calc change] [direction depends on the overhang: less conservative for DL and stresses when oh < S/2, more conservative for capacity/stiffness when oh > S/2]
- **Where:** `compositeProps()`, I-girder branch (≈ line 2043). Anchor: `const tribW=extG? (inp.S/2+ohT)*12 : inp.S*12;`
- **Problem:** the AUTO effective width and the deck dead-load width were S·12 for every girder. 4.6.2.6.1 takes the tributary width, which for an exterior girder is half the adjacent spacing plus the full overhang.
- **Governing provision:** AASHTO LRFD 10th Ed. 4.6.2.6.1 (effective flange width = tributary width perpendicular to the axis of the member).
- **Before:**
  ```js
    const beff=inp.beffAuto? inp.S*12 : +inp.beff;
  ...
            tsLoad, wdkW:inp.S*12, wdkHW:g.btf,
            wdkDeck:(inp.S*12*tsLoad/144)*(+inp.mat.wcdLoad||+inp.mat.wcd), wdkHaunch:(g.btf*th/144)*(+inp.mat.wcdLoad||+inp.mat.wcd),
            wdk:(inp.S*12*tsLoad/144)*(+inp.mat.wcdLoad||+inp.mat.wcd) + (g.btf*th/144)*(+inp.mat.wcdLoad||+inp.mat.wcd), isNext:false};
  ```
- **After:**
  ```js
    const extG=!!(inp.loads&&inp.loads.pos==='exterior');
    const ohT=extG? Math.max(+((inp.deck&&inp.deck.oh)||0)||0,0) : 0;
    const tribW=extG? (inp.S/2+ohT)*12 : inp.S*12;    // in
    const beff=inp.beffAuto? tribW : +inp.beff;
  ...
            tsLoad, wdkW:tribW, wdkHW:g.btf, extG, ohT,
            wdkDeck:(tribW*tsLoad/144)*(+inp.mat.wcdLoad||+inp.mat.wcd), wdkHaunch:(g.btf*th/144)*(+inp.mat.wcdLoad||+inp.mat.wcd),
            wdk:(tribW*tsLoad/144)*(+inp.mat.wcdLoad||+inp.mat.wcd) + (g.btf*th/144)*(+inp.mat.wcdLoad||+inp.mat.wcd), isNext:false};
  ```
  - The overhang is the existing `deck.oh` box ("Overhang (web→edge)", default 3.0 ft) of the Deck Design card. No new field was added.
  - For an exterior I-girder the same box now also shows on the Geometry card ("Deck overhang, girder CL → deck edge"). The AUTO button reads `AUTO (=S/2+oh)` there.
  - `computeAll` warns when an exterior girder with AUTO b_eff has an overhang of 0.
  - A MANUAL b_eff still overrides the effective width, but not the deck weight.
  - NEXT, adjacent-box and deck-slab sections keep their own branches and are unchanged.
  - The Section Props and Report b_eff and w_dk lines print the exterior form.
- **Check case:** the default girder set to exterior (posAuto off), S = 9 ft, oh = 3.0 ft, t_s = 8 in, w_cd = 0.150 kcf.
  - b_eff = (9/2 + 3.0)·12 = 90 in (was 108).
  - Deck weight = 90·8/144·0.150 = 0.750 klf (was 108·8/144·0.150 = 0.900). w_DC1 = 0.750 + 0.0875 haunch + 0.100 = 0.9375 klf (was 1.0875).
  - ΔM_DC1 at midspan = 0.15·120²/8 = 270 k-ft. M_u = 10,767.8 → 10,430.3 k-ft, which is 1.25·270 lower ✓.
  - Flexure M_u/φM_n: 10,768/13,639 = 0.790 → 10,430/13,451 = 0.775.
  - Service III bottom: −0.158 ksi (D/C 0.29) → no tension (0.00).
  - Service I compression (perm) 0.486 → 0.440. Deck compression 0.352 → 0.397. LL deflection 0.73 → 0.77.
  - Flexure RF_inv 1.561 → 1.591. DC1 reaction sent to Substructure Loading 114.785 → 105.785 kip (= 0.15·120/2 = 9.0 kip less).
  - With oh = 4.5 ft = S/2 every result is unchanged (b_eff 108 in).
  - Interior girders: unchanged.
- **How verified:** probe old/new; UI run (overhang box shown only for an exterior I-girder; warning at oh = 0); screenshots `new-ext-geom.png`, `new-report-beff-ext.png`.

### W2. Exterior-girder fatigue DF: lever rule / rigid section (one lane) ÷ 1.2 (PSB-O3d)   [calc change] [more conservative for exterior girders]
- **Where:** `distFactors()` exterior block (`rigid1`, ≈ line 2527) and the fatigue block of `computeAll` (≈ line 3349). Anchor: `const dfFatAuto=df.ext? Math.max(df.lever,df.rigid1||0) : df.m1;`
- **Problem:** with AUTO DFs the fatigue DF was the interior one-lane m1/1.2 for both girder positions.
- **Governing provision:** AASHTO LRFD 10th Ed. 3.6.1.4.3b (fatigue: one design lane, MPF removed), 4.6.2.2.2d (exterior, one lane: lever rule), C4.6.2.2.2d (rigid-section check), 3.6.1.1.2 (m = 1.2).
- **Before:**
  ```js
    let lever=0,eM=0,eV=0,rigid=0,rigidNL=0;
  ...
        const rr=mpf[NL-1]*(NL/Nb+Xext*sumE/sumX2);
        if(rr>rigid){rigid=rr;rigidNL=NL;}
  ...
    return {Kg,eg,m1,m2,v1,v2,skM,skV,th,ext,lever,eM,eV,rigid,rigidNL,dfmRaw,dfvRaw,
  ...
    const dfFat=(+inp.loads.fatM>0)? +inp.loads.fatM : (inp.loads.dfAuto? df.m1 : +inp.loads.dfm)/1.2;
  ```
- **After:**
  ```js
    let lever=0,eM=0,eV=0,rigid=0,rigidNL=0,rigid1=0;
  ...
        const rr=mpf[NL-1]*(NL/Nb+Xext*sumE/sumX2);
        if(NL===1) rigid1=rr;                     // one loaded lane (m = 1.2) — for the fatigue DF
        if(rr>rigid){rigid=rr;rigidNL=NL;}
  ...
    return {Kg,eg,m1,m2,v1,v2,skM,skV,th,ext,lever,eM,eV,rigid,rigidNL,rigid1,dfmRaw,dfvRaw,
  ...
    const dfFatAuto=df.ext? Math.max(df.lever,df.rigid1||0) : df.m1;
    const dfFat=(+inp.loads.fatM>0)? +inp.loads.fatM : (inp.loads.dfAuto? dfFatAuto : +inp.loads.dfm)/1.2;
  ```
  A pulled LL & DL fatigue DF (`fatM > 0`) and MANUAL DFs are unchanged. NEXT stays on m1 (`ext` is always false for NEXT; see O4). The Stresses tab fatigue step prints the formula that was used.
- **Check case:** the default girder, exterior, oh = 4.5 ft (so b_eff is unchanged), d_e = 2 ft, N_b = 5.
  - Lever rule: wheels at 0 and −6 ft from the exterior web, so R = 0.5(9+0)/9 + 0.5(9−6)/9 = 0.6667 and g_lever = 1.2·0.6667 = 0.800.
  - Rigid section, one lane: X_ext = 18 ft, Σx² = 810 ft², e = 18 + 2 − 5 = 15 ft, so g = 1.2(1/5 + 18·15/810) = 0.640.
  - DF_fat = 0.800/1.2 = **0.6667** (was m1/1.2 = 0.4086).
  - M_fat,girder = 1,624·1.15·DF: 763 → 1,245 k-ft.
  - Strand Δf = 4.416 → **7.205 ksi** (D/C 0.245 → 0.400; ratio 0.6667/0.4086 = 1.632 ✓).
- **How verified:** probe old/new; screenshot `new-fatigue.png` (exterior run).

### W3. Concrete compression fatigue check, 5.5.3.1 (PSB-O3b)   [calc change: new check] [more conservative]
- **Where:** fatigue block of `computeAll` (≈ line 3366, `fcFat`) and a new `checks` row after `Fatigue I (strand)`. Anchors: `const ftPermFat=` and `{n:'Fatigue I (concrete, 5.5.3.1)'`. A new Step was added to the Stresses tab fatigue card.
- **Problem:** the 0.40 f′c limit was not checked.
- **Governing provision:** AASHTO LRFD 10th Ed. 5.5.3.1. For fully prestressed components (other than segmental), the compressive stress due to the Fatigue I combination plus one-half the sum of the effective prestress and the permanent loads shall not exceed 0.40 f′c. The Fatigue I load factor is 1.75 (Table 3.4.1-1, unchanged).
- **Before:** no check. `const fat={Mfat:hl.Mfat,dfFat,Mfat1,fbPerm,dfbFat,fbMinFat,frFat,cracksFat,dfStrand,fatLimit, dc:dfStrand/fatLimit, ok:dfStrand<=fatLimit};`
- **After:**
  ```js
    const ftPermFat=PeM/g.A-PeM*ss.eMid/g.St+(Mg(L/2)+Mdc1(L/2))/g.St+(Mdc2(L/2)+Mdw(L/2))/cp.Stg;   // +comp
    const dftFat=1.75*Mfat1*12/cp.Stg;
    const fcTopFat=0.5*ftPermFat+dftFat;
    const botPermFat=grid.reduce((b,r)=>{ const f=r.s3Bot+(+inp.opt.gLLs3||0)*r.Mll/cp.Sbc; return f>b.f?{f,x:r.x}:b; },{f:-Infinity,x:L/2});
    const fcBotFat=0.5*botPermFat.f;
    const fcFatLim=0.40*m.fc;
    const fcFatTop=fcTopFat>=fcBotFat;
    const fcFat={top:fcTopFat,topPerm:ftPermFat,dTop:dftFat,bot:fcBotFat,botPerm:botPermFat.f,xBot:botPermFat.x,lim:fcFatLim,
                 v:fcFatTop?fcTopFat:fcBotFat, x:fcFatTop?L/2:botPermFat.x, where:fcFatTop?'top':'bottom',
                 dc:Math.max(fcTopFat,fcBotFat)/fcFatLim, ok:Math.max(fcTopFat,fcBotFat)<=fcFatLim};
    const fat={…as before…, extDF:!!(df.ext&&inp.loads.dfAuto&&!(+inp.loads.fatM>0)), conc:fcFat};
  ...
      {n:'Fatigue I (concrete, 5.5.3.1)',v:fat.conc.v,lim:fat.conc.lim,r:fat.conc.dc,loc:fat.conc.x,u:'ksi'},
  ```
  - Top fibre at midspan, where the fatigue moment is computed.
  - Bottom fibre: the largest ½(f_pe + permanent) over the stress grid. The live load only relieves the bottom fibre.
  - f_pe is taken without elastic gains, as in the existing fatigue block.
- **Check case:** defaults, f′c = 8.5 ksi, limit 0.40·8.5 = 3.40 ksi.
  - Top at midspan: permanent stress = 1.860 ksi; ΔLL = 1.75·763.1·12/S_tg = 0.232 ksi; ½(1.860) + 0.232 = 1.162 ksi.
  - Bottom: the largest permanent stress is 2.942 ksi at x = 3.0 ft (end of the transfer length); ½(2.942) = 1.471 ksi, which governs.
  - **D/C = 1.471/3.40 = 0.433**, PASS (new row; was not checked).
  - The strand optimizer and the span sweep include the new row in their pass/fail.
- **How verified:** probe; screenshot `new-fatigue.png`.

### W4. Rating: condition and system factors φc, φs with the 0.85 floor (PSB-O2a)   [calc change] [more conservative where φc·φs < 1]
- **Where:** rating block of `computeAll` (≈ line 3459), the shear rating `shrate`, the vehicle ratings, and a new "Condition & System Factors" card on the Rating tab. Anchor: `const phiCS=clamp(phiCraw*phiSraw,0.85,1.0);`
- **Problem:** `const phiC=1.0;` was hard-coded.
- **Governing provision:**
  - MBE 3rd Ed. Eq. 6A.4.2.1-1 (RF with φc φs).
  - Eq. 6A.4.2.1-3: φc φs ≥ 0.85.
  - Table 6A.4.2.3-1 (φc = 1.00 / 0.95 / 0.85).
  - Table 6A.4.2.4-1 (φs).
  - Equation numbers: verify.
- **Before:** `const phiC=1.0; // condition*system factor product …` and `const cap=phiVn_r-1.25*V_DCr-1.50*V_DWr;` (shear), `const capMflex = Rn; const capVshear = phiVn_r;` (vehicles).
- **After:**
  ```js
    const rtF=(v)=>{ if(v===''||v==null) return 1; const n=+v; return (isFinite(n)&&n>0)? n : 1; };
    const phiCraw=rtF(inp.opt.rtPhiC), phiSraw=rtF(inp.opt.rtPhiS);
    const phiCS=clamp(phiCraw*phiSraw,0.85,1.0);
    const phiC=phiCS;
  ...
    const shrate=(gLL)=>{ const cap=phiC*phiVn_r-1.25*V_DCr-1.50*V_DWr; … };
  ...
    const capMflex = phiC*RnMid;  const capVshear = phiC*phiVn_r;
  ```
  - Inputs: `opt.rtPhiC` and `opt.rtPhiS`, default 1.0. Blank means 1.0. The product is floored at 0.85 and capped at 1.0.
  - Applied to the flexure and shear strength ratings and to the user-entered vehicles.
  - Not applied to the Service III rating, which is a stress limit.
- **Check case:** defaults with φc = 0.95, φs = 0.85: product 0.8075, floored to 0.85.
  - Flexure (midspan governs then): (0.85·13,639 − 1.25·3,984 − 1.50·450)/(1.75·2,627) = 5,938/4,597 = **1.292** (was 1.737).
  - Shear @ 30.0 ft: (0.85·334.6 − 1.25·66.4 − 1.50·7.50)/(1.75·84.0) = 190.2/147.0 = **1.294** (was 1.635).
  - With the default 1.0 / 1.0 nothing changes.
- **How verified:** probe; UI run (0.85 × 0.85 = 0.722 → "used 0.850 (floored at 0.85 …)"); screenshot `new-rating.png`.

### W5. Flexure rating at the governing station of `flexFull` (PSB-O2b)   [calc change] [more conservative (RF ≤ the midspan RF)]
- **Where:** rating block of `computeAll`. Anchor: `flexFull.forEach(r=>{ const mll=r.mLLpos;`
- **Problem:** the HL-93 flexure rating used midspan only (`fMid`), although the strength check uses every station since F5.
- **Governing provision:** MBE 3rd Ed. 6A.4.2.1 (rate at the critical sections). The RF equation is unchanged.
- **Before:**
  ```js
    const Rn=fMid.phiMn/12;
    const MDC=(Mg(L/2)+Mdc1(L/2)+Mdc2(L/2))/12;
    const MDWr=Mdw(L/2)/12;
    const MLLr=MLL;
    const rate=(gDC,gDW,gLL)=>{ const cap=phiC*Rn-gDC*MDC-gDW*MDWr; return gLL>0? cap/(gLL*MLLr):0; };
    const RFinv=rate(1.25,1.50,1.75); const RFopr=rate(1.25,1.50,1.35);
  ```
- **After:**
  ```js
    const rateAt=(Rn_,MDC_,MDW_,MLL_,gLL)=>{ const cap=phiC*Rn_-1.25*MDC_-1.50*MDW_; return gLL>0? cap/(gLL*MLL_):0; };
    let rGov=null;
    flexFull.forEach(r=>{ const mll=r.mLLpos; if(!(mll>1e-6)||!(r.phiMn>0)) return;
      const mdc=r.mSW+r.mDC1+r.mDC2, mdw=r.mDW, rn=r.phiMn/12, rf=rateAt(rn,mdc,mdw,mll,1.75);
      if(!rGov||rf<rGov.RFinv) rGov={x:r.x,Rn:rn,MDC:mdc,MDW:mdw,MLL:mll,RFinv:rf}; });
    if(!rGov) rGov={x:L/2,Rn:RnMid,MDC:MDCmid,MDW:MDWmid,MLL:MLLr,RFinv:rateAt(RnMid,MDCmid,MDWmid,MLLr,1.75)};
    const RFinv=rGov.RFinv; const RFopr=rateAt(rGov.Rn,rGov.MDC,rGov.MDW,rGov.MLL,1.35);
  ```
  - `R.rating` gains `x` and `mid` (the midspan values, shown in the derivation note).
  - The user-entered vehicles stay at midspan: a single entered moment has no station.
- **Check case:**
  - Defaults: governing x = 58.0 ft, φM_n 13,639, M_DC 3,979.1, M_DW 449.5, M_LL 2,628.7 k-ft.
    RF_inv = (13,639 − 4,973.9 − 674.3)/(1.75·2,628.7) = 1.73701. The midspan value was 1.73706. The truck envelope peaks just off midspan.
  - L = 70 ft, debonded rows (scratch `debond2`): governing x = 33.83 ft, RF_inv 3.657 → 3.647.
- **How verified:** probe; Rating tab text.

### W6. Severe-corrosion Service III tension limit capped at 0.3 ksi; normal-weight warning (PSB-A1)   [calc change] [more conservative, f′c > 10.0 ksi only]
- **Where:** `lim` in `computeAll` (≈ line 2965) and a warning at the top of `computeAll`. Anchors: `srvT:inp.opt.corrosion==='severe'? Math.min(0.0948*sqrt(m.fc),0.3)` and `Lightweight concrete (`.
- **Problem:**
  - The severe-corrosion limit had no 0.3 ksi cap.
  - Nothing told the user that λ is not modelled.
- **Governing provision:** AASHTO LRFD 10th Ed. Table 5.9.2.3.2b-1 (severe: 0.0948λ√f′c ≤ 0.3 ksi); 5.4.2.8 (λ; normal weight w_c ≥ 0.135 kcf, verify).
- **Before:** `srvT:inp.opt.corrosion==='severe'? 0.0948*sqrt(m.fc) : Math.min(0.19*sqrt(m.fc),0.6),`
- **After:** `srvT:inp.opt.corrosion==='severe'? Math.min(0.0948*sqrt(m.fc),0.3) : Math.min(0.19*sqrt(m.fc),0.6),`
  - A new warning appears when the girder w_c, or the deck w_cd with a deck, is below 0.135 kcf. The app uses λ = 1.0 everywhere; λ is not implemented, so a lightweight design must be checked by hand.
  - The Stresses, Rating and Report texts now read "0.0948√f′c ≤ 0.3".
- **Check case:** severe corrosion, f′c = 12 ksi.
  - Limit = min(0.0948·√12 = 0.328, 0.3) = **0.300 ksi** (was 0.328).
  - Service III D/C 0.215 → 0.236.
  - Service III RF = (0.300 + 4.566 − 3.094 − 0.270)/(0.8·1.591) = **1.180** (was 1.202).
  - f′c ≤ 10.0 ksi: unchanged (0.0948√10 = 0.2998).
- **How verified:** probe (scenarios `severe`, `severe12`, `lw`).

### W7. Shear critical section at d_v from the inside face of the bearing (PSB-O6b)   [calc change] [LESS conservative: the critical section moves into the span]
- **Where:** shear-station set-up in `computeAll` (≈ line 3086). Anchor: `const dvEst=(()=>{ let x=xBear+0.72*cp.hc/12;`
- **Problem:** the critical section was 0.72h_c from the bearing centerline, not d_v from the internal face of the support.
- **Governing provision:** AASHTO LRFD 10th Ed. 5.7.3.2 (critical section d_v from the internal face of the support).
- **Before:** `const dvEst=0.72*cp.hc/12;` (defined before `xBear`).
- **After:**
  ```js
    const dvEst=(()=>{ let x=xBear+0.72*cp.hc/12;
      for(let it=0;it<4;it++){ const f=flexure(inp,g,cp,ss,x,fpe);
        const dv=Math.max(f.dp-f.a/2,0.9*f.dp,0.72*cp.hc), xn=xBear+dv/12;
        if(!isFinite(xn)) break; if(Math.abs(xn-x)<1e-4){ x=xn; break; } x=xn; }
      return x; })();
  ```
  - `xBear` = L_pad/2 (the existing "Bearing pad length" input, default 12 in) is the inside face.
  - The station is mirrored at the right end, as before. The end-zone station rule uses it unchanged.
  - The Shear-tab label now reads "Critical section: d_v from the inside face of the bearing (5.7.3.2)".
- **Check case:** defaults, x_bear = 0.5 ft.
  - d_v(5.41 ft) = max(59.0, 55.1, 57.6) = 58.92 in, so x = 0.5 + 58.92/12 = **5.41 ft** (was 4.80 ft).
  - At the critical section: V_u 361.6 → 358.6 kip; φV_n 638.2 → 639.4 kip; D/C 0.567 → 0.561.
  - The governing shear check (0.721 @ 30.01 ft) is unchanged.
  - Other runs:
    - MIDAS span 1: critical x 4.80 → 5.44 ft. Interface shear D/C 0.433 → 0.442, because the mirrored station 94.56 ft sits closer to the pier.
    - Debonded L = 70 ft: x 4.80 → 6.72 ft.
- **How verified:** probe; Shear / Report text compared old vs new.

### W8. Release compression limit factor as an input, default 0.65 (PSB-A2)   [calc change only when the input is changed]
- **Where:** new `relCfacOf(inp)` next to `Ec()`, `lim.relC` in `computeAll`, `limC` in `handlingCalc`, and a new box in Analysis Options → Service stresses. The labels on the Stresses / Report / Nomenclature / heat-map read the factor.
- **Governing provision:** AASHTO LRFD 10th Ed. Table 5.9.2.3.1a-1 (0.65 f′ci, pretensioned).
- **Before:** `relC:0.65*m.fci,` and `const limC=0.65*m.fci, …`
- **After:** `relC:relCfac*m.fci,` with `function relCfacOf(inp){ const v=inp&&inp.opt&&inp.opt.relCfac; if(v===''||v==null) return 0.65; const n=+v; return (isFinite(n)&&n>0)? n : 0.65; }`. `handlingCalc` uses the same factor.
- **Check case:** defaults 0.65: unchanged (Release comp 4.174/4.42 = 0.944). With 0.60: limit 0.60·6.8 = 4.08 ksi, so D/C = **1.023 FAIL**.
- **How verified:** probe; screenshot `new-opts.png`.

### W9. Shear and Report tabs: the interface-shear step prints the row at the same station as its V_u (PSB-O7b)   [display bug fix]
- **Where:** `ShearTab` derivation and `ReportTab` §10. Anchor: `if0=R.iface[R.shear.indexOf(sh0)]||R.iface[0]`. All 13 `R.iface[0].` references in those two places became `if0.`.
- **Problem:** `iface[0]` is the bearing-face row, but V_u and d_v were printed from `sh0` (the d_v station). The printed equation did not add up: before, 361.6/(42·58.8) printed as 0.154 ksi.
- **Check case:** defaults: 358.6/(42·58.9) = **0.145 ksi** ✓.
- **How verified:** Shear and Report tab text old vs new.

### W10. psSection published only from the tab on screen (AUDIT S7)   [bug fix — hand-off timing; payload unchanged]
- **Where:** `App()`, psSection publisher effect (≈ line 7813). Anchor: `if(document.visibilityState==='hidden') return;      // background tab: hold`
- **Problem:** every recompute published `bridgeSuite.v1.psSection`. Consider a second PS-Beam tab for another girder, hidden in the background, with a locked channel that changes its inputs. Its recompute overwrote what MCT and LL & DL follow.
- **Fix:**
  - A hidden tab does not publish.
  - On `visibilitychange` back to visible, the held change is published. The existing signature check means nothing is published when nothing changed.
  - The payload, key and schema are unchanged.
- **Check case (headless Chromium):**
  - Tab hidden, S changed 9 → 8 ft: main republished at once (I_c 1,126,663 → 1,091,313 in⁴); the branch kept 1,126,663.
  - When the tab is shown again, the branch publishes 1,091,313.
- **Governing provision:** none (HANDOFF.md psSection channel).

### W11. Lock change-log / restore texts and the DC2 / DW snapshot keep a blank box blank (PSB-OT5, OT6)   [display / restore fix — no calculation change]
- **Where:** new `dlSnapFor`, `dlBackDeltas` and `psbAdopt` after `dlMineFor` (≈ line 4444). `LockAutoSync` and the two lock toggles call `psbAdopt(…, lldfBackDeltas(lldfSnapFor(inp),after))` / `dlBackDeltas(dlSnapFor(inp),after)` instead of `BL.adopt({before:lldfMineFor(inp) / dlMineFor(inp), …})`. The dlLoads snapshot uses `dlSnapFor(inp)` instead of `dlMine()`.
- `psbAdopt` repeats the three steps of the shared `BL.adopt` (apply, `BL.log`, `BL.toast`) with deltas computed here. The shared block is untouched.
- **Check case (headless Chromium):**
  - MIDAS, DF +M blank → Lock. The log read "DF +M 0.000 → 0.650"; it now reads "DF +M blank (1.0 used) → 0.650".
  - HL-93, DC2 blank → Lock dlLoads:
    - Log "DC2 … 0.000 → 0.400" → "blank (0 used) → 0.400".
    - Snapshot `{"wBar":0,…}` → `{"wBar":"",…}`.
    - On Unlock → Restore, the box showed `0` and now stays blank.
  - The status band is identical; blank = 0 in both.
- The snapshot stays under the same key, `bridgeSuite.v1.lockSnap.psbeam`. An older snapshot holding `0` restores as before.

### W12. Lifting / hauling stability labelled "screening only — not PCI (2016) / Mast" (PSB-O1)   [UI / docs]
- **Where:** Handling card (refTag, sub-heading, callout, off-hint), Handling tab (tiles, derivation title, callout), and two check names.
- Check names: `'Lifting FS (crack)'` → `'Lifting FS (crack, screening)'`, `'Hauling FS (crack)'` → `'Hauling FS (crack, screening)'`. The two `ck.find` calls were updated. The optimizer's `/FS/` filter still matches.
- The formulas are unchanged. A full PCI / Mast implementation is listed under Needs engineer.

### W13. HL-93 "RF × 36 tons" removed from the rating tiles and text (PSB-O2c)   [UI]
- The three tiles now show the operating RF and the station instead of "≈ N tons".
- The callout explains that HL-93 has no gross weight.
- `RTinv` / `RTopr` / `RT` are still in R, not displayed.
- The vehicle-table tonnage, which uses the user's entered weight, is unchanged.

### W14. MIDAS span ending at an interior pier: hand-check warning (PSB-OR1)   [warning only]
- **Where:** after the imported-DF warning in `computeAll`. Anchor: `is an interior pier. The import has one station per node there`.
- The MCT export (`index.html`) writes one station per node. At an interior pier that one value (V_DC2, V_DW, V_LL) can be either span's element end.
- A warning now names the pier end(s) of the selected span and asks for a hand check of the shear near the pier and of the reactions sent to Substructure Loading. No value changes.
- Check: test file with supports [0, 100, 200] ft. Span 1 → "the right end (x = 100.00 ft) is an interior pier"; span 2 → left end.

### Closed / left by decision (no code change)
- **PSB-O6a (Δf_cd omits the (Δf_pSR + Δf_pCR + Δf_pR1) term, 5.9.3.4.3b):** left as is. Omitting the term over-predicts Δf_pCD, which is conservative. Adding it would lower losses and needs a §4 sign-off for a small gain. Recommendation: leave.
- **PSB-O7a (5.7.4.2 relaxation, Avf,min ≤ the amount for 1.33V_ui/φ):** not implemented. That is conservative. Recommendation: leave unless a design is governed by Avf,min.
- **PSB-O2c (W13), O1 (W12), OT5/OT6 (W11), O7b (W9), AUDIT S7 (W10):** fixed above.

### Needs engineer
1. **PSB-O4 — NEXT F distribution factors.** With no topping the K_g term is omitted; S is the beam width; there is no exterior case and no range check. Question: should NEXT beams be distributed as type (i)/(j) per beam (S = beam width, current), or per stem (S = stem spacing)? And which exterior rule should apply? Recommendation: type (i)/(j) acting as a unit, per beam, with the exterior girder by the lever rule. Range checks per Table 4.6.2.2.2b-1.
2. **PSB-O3a — strand fatigue range.** The range is taken at the bottom fibre (conservative), with an arbitrary ×1.5 when cracked. Question: is a cracked-section strand-stress analysis wanted? Recommendation: yes, compute n·Δf at the strand centroid on the cracked transformed section when f_b,min < −0.095√f′c. M size.
3. **PSB-O1 — PCI (2016) / Mast lifting and hauling.** Question: implement the full PCI method (roll stiffness K_θ, tilt equilibrium, FS against cracking, failure and rollover)? It is now labelled screening-only. L size.
4. **PSB-O8 — edition labels.** Please confirm against the printed 10th Ed. (2024) before the page label "AASHTO LRFD BDS (9th Ed. article numbering)" (Report basis line) is relabelled:
   - 0.210 ksi (5.7.4.2)
   - Eq. 5.4.2.3.2-5
   - 3.6.1.4.1
   - 5.5.3.1 (0.40 f′c)
   - Table 5.9.2.3.2b-1 (0.3 ksi cap)
   - 5.4.2.8 (λ)
   - MBE Eq. 6A.4.2.1-3
5. **φs for shear (W4).** The product φc·φs is applied to the shear rating as well as flexure, which is conservative. Question: does your MBE edition / owner manual take φs = 1.0 for shear? If yes, the shear rating should use φc only.
6. **Exterior DL tributary (W1).** The deck weight of an exterior girder now uses (S/2 + oh)·t_s, the same slab thickness as the bay. Question: does the overhang have a different (thicker) section, or should the barrier / overhang deck be taken from the LL & DL app (dlLoads) instead? Recommendation: keep the code tributary width; enter any extra overhang concrete as "Add'l non-comp distributed".

### Remaining open items
- O4, O3a, O1 (full PCI), O8: see Needs engineer.
- Found, not changed:
  - **Section Props / Report composite-centroid line:** with the haunch EXCLUDED, the printed A_h term (e.g. 70.1 in²) is still shown in "A_c = A_g + A_d + A_h". The total (1,368 = 767 + 600.8) correctly omits it. Display only.
  - **Shear derivation V_u line:** it prints the closed-form w(L/2 − x) terms even under a MIDAS import. Display only; the value is right.

### How verified (all items)
- `node --check` on all 8 inline scripts. The `text/babel` block was transpiled with @babel/standalone 7.23.5, main and branch.
- Headless Chromium (Playwright, `/opt/pw-browsers/chromium`), pinned React 18.2.0 / ReactDOM 18.2.0 / Babel 7.23.5 / Plotly 2.27.0 / KaTeX 0.16.9 served locally, main (d6edfdd) vs branch, clock frozen. Scenarios: default; all-ON; Custom; BIII-36 box; exterior; NEXT 36F; MIDAS 2-span (span 1 and span 2); blank Area per leg.
- Captured in each scenario: every tab's text, Export JSON, all localStorage, Send reactions, Export hand-off and an Export → Import → Export round trip.
  - Export JSON and the round trip are identical after removing the three new `opt` fields.
  - localStorage is identical, except psSection and superReactions in the exterior scenario (W1).
  - The hand-off file is identical except in the exterior scenario (DC1 114.785 → 105.785 kip).
  - Every text difference is explained by W1–S14. The status band gains the new "Fatigue I (concrete, 5.5.3.1)" row.
  - No console errors; the only message is Babel's existing size note, which main shows too.
- `computeAll()` probes for 17 scenarios (scratch `probe.mjs`) gave every number above.
- UI runs (scratch `ui.mjs`): lock / unlock texts (W11), the psSection visibility gate (W10), φc / φs inputs (W4), and the exterior overhang box and warning (W1).
- Screenshots looked at: `new-rating.png`, `new-ext-geom.png`, `new-opts.png`, `new-fatigue.png`, `new-report-beff-ext.png`, `new-handling-card.png`, `*-ot6-restored.png`.
- **Other copies:** none. stgirder.html has the same exterior-b_eff and φc·φs items (STG-O4, STG-O3), not changed here (one tool per PR).

## 2026-10-12 — PR: claude/bootstrap-sync (shared `bridgeSuite.v1.*` bootstrap; PR link added after merge)

Cross-tool sync of the shared bootstrap blocks. The same change is in index.html, lldf.html, psbeam.html and stgirder.html (CLAUDE.md §3). No engineering formula, factor, unit or code reference changed; no computed value changes. Storage keys and saved formats are unchanged (the hand-off map keeps its key and entry format; it only loses old entries).

This is the shared-block part of X-S8 / X-S10 for PS-Beam.

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
- **After** (inserted after `if((d.schemaVersion||1)>1) return {why:'LL & DL Distribution data is v'…'Update PS-Beam.'};`):
  ```js
    // CIP slab (lldf perFootStrip): factors per 1-ft strip of slab width, not per girder. Refused (HANDOFF.md §4.3).
    if(d.perFootStrip===true) return {why:'The published distribution factors are for a cast-in-place slab: they are per 1-ft strip of slab width (AASHTO LRFD 4.6.2.3), not per girder. PS-Beam needs girder factors, so nothing was applied.\n\nRecompute in LL & DL Distribution with the girder cross-section type, then send again.'};
  ```
- **Problem:** a strip factor (≈ 0.08) used as a girder DF makes every live-load effect about 1/10 of the girder value: very unconservative.
- **Skew:** this tool does not read the payload skew; lldf's g_V already carries the shear correction at θ_V. Nothing to change.
- **Check case:** lldf type "Cast-in-place concrete slab", 1 span 120 ft, default inputs → payload `perFootStrip:true`, interior gM = gV = 0.076 (per 1-ft strip), fatM = fatV = 0.045. Before: g_M = g_V = 0.076 (fatigue 0.045) applied. After: refused with the message above; nothing applied. Girder payload (type a, θ = 30°, θ_V = 40°: gM 0.7128, gV 1.0582, fatM 0.4019, fatV 0.7075): identical before and after.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 4.6.2.3 (equivalent strip widths for slab-type bridges: the slab DF is per unit width, not per girder). No formula changed.
- **How verified:** headless Chromium, main vs branch: lldf "Send DFs" for the slab and the girder case, then the resolver called on this tool (`lldfResolveFor({loads:{pos:'interior'}})`). Slab: main applied, branch refused. Girder: identical results (only `producedAt` differs). No page errors.

## 2026-10-18 — PR: claude/psbeam-d11-report — D11: calculation-sheet report and §6 derivation links (Tier 1, display only; PR link added after merge)

- **Engineer request:** AUDIT.md D11 (2026-10-14; scope 2026-10-18: full report for every design-check tool), CLAUDE.md §6 "show the work and link to it". The tool already had a numbered calculation package: the gaps were closed, the package was not rewritten.
- **Provision:** none. No formula, factor, unit, code reference or computed result changed (`computeAll` untouched). No saved-data key or format changed (`psbeam.inputs.v1`, `psbeam.ui.v1`, `psbeam.inputTab.v1`, `psbeam.fold.*`, the JSON export, `bridgeSuite.v1.*` untouched); no input field added. The shared `bridgeSuite.v1.*` bootstrap blocks at the top of the file are not touched.

### D11-1. Report in the house calculation-sheet format (Report tab, `ReportTab`)
- **Where:** `function ReportTab({inp,R}){` (the D11 block starting `/* D11 (2026-10-18): print mode` sits before the numbered body, and the `return(` at the end renders cover, references, contents and the numbered body); helpers after `const Deriv=` (anchors `/* ---- D11 links (2026-10-18)` and `/* ---- D11 calculation-sheet report helpers`: `PsbrSee`, `PSB_TABN`, `psbGoto`, `psbFlash`, `psbJump`, `WkLink`, `WkCell`, `PSB_CK`, `psbCkLink`, `PsbRes`, `PsbRF`, `psbrNumber`, `psbrEsc`, `psbrShort`, `psbrDesc`, `psbrPageCSS`, `psbrPrintMode`, `psbrFit`); CSS block `/* ---- D11 (2026-10-18): calculation-sheet report` after `.printonly{display:none}`. To re-apply by hand, copy those blocks and `ReportTab` from this version.
- **Primitives (exact):**
  - Before: `const Card=({title,refTag,right,children,fold})=>{` … `return <div className="card">`. After: `const Card=({title,refTag,right,children,fold,id})=>{` … `return <div className="card" id={id}>`.
  - Before: `const Step=({d,r,note,children})=>(` / `<div className="mstep"><div className="mcap"><span>{d}</span>`. After: `const Step=({d,r,note,children,num,id,wk})=>(` / `<div className="mstep" id={id} data-wk={wk}><div className="mcap"><span>{num&&<span className="mnum">{num}</span>}{d}</span>`.
  - Before: `const CalcSec=({n,title,children})=>(` / `<div className="calcsec">`. After: `const CalcSec=({n,title,children,id})=>(` / `<div className="calcsec" id={id}>`.
  - Before: `const Deriv=({title,refTag,children})=>(` / `<Card title={title} refTag={refTag}>`. After: `const Deriv=({title,refTag,children,num,id})=>(` / `<Card title={num?num+' '+title:title} refTag={refTag} id={id}>`.
  - Outside the report none of the new props is passed (except `wk` on the two Fatigue I steps shared with the Stresses tab, which only adds a `data-wk` attribute), so every other tab renders as before.
- **Before:** Print button; "Design Check Summary" card; detailing warnings; "Key Quantities" and "Assumptions & Basis" cards; graphics (force-effect diagrams, stress heat map, 3D cage); heading "Calculation Package — <project> · <girder>"; sections with hard-coded numbers `1`…`5`, `5b`, `5c`, `6`…`10`, `11` (continuity, if on), then camber and three output tables numbered `R.cont?'12':'11'` … `R.cont?'15':'14'`; the steps inside were not numbered. No cover, title block, references, contents, result lines or page header/footer. Fatigue, the longitudinal tie, release-tension bonded steel, handling, deck and the load rating were not in the report.
- **After:**
  - **Cover:** "PS-Girder", "Prestressed concrete girder design · AASHTO LRFD · calculation report", project name, description (girder ID, girder, L, strands, simple span / continuous / MIDAS, interior/exterior), a codes line, and a title block Project / Project No / Calculated by / Date / Checked by / Checked date from the existing title-block fields `proj.name`, `proj.job`, `proj.by`, `proj.date`. The tool has no Checked by / Checked date fields: they print "—". **No field added.**
  - **References** (only what the tool cites): AASHTO LRFD BDS, "9th Ed. article numbering" as the tool states in Assumptions & basis, "edition: verify", with the articles the report and the included tab content cite (3.6.1.3.1 and 5.12.3.3 only with continuity; the deck articles only with the deck module); AASHTO MBE Section 6A (edition not stated by the tool: verify); PCI Design Handbook camber multipliers (edition not stated: verify).
  - **Contents:** numbered, with links, sections n and subsections n.k.
  - **Numbering:** `psbrNumber()` numbers every `CalcSec` of the report n = 1, 2, … in order and every `Step` / `Deriv` directly inside it (fragments flattened) n.k; the old hard-coded `n` props were removed. Sections (default project): 1 Design Summary (1.1 design check summary, now with a "Worked in" column; 1.2 key quantities; 1.3 assumptions & basis), 2 Graphics (2.1–2.3), 3 Materials, 4 Section Properties, 5 Strand Geometry, 6 Prestress & ES, 7 Long-term losses, 8 Elastic gains, 9 Strand force by row, 10 Loads, 11 Stress limits, 12 Governing service stresses (+ 12.6 other fiber-stress checks), 13 Strength I flexure, 14 Shear (+ 14.7 longitudinal tie; 14.11 release-tension bonded steel when that option is on), [Continuity], Fatigue I, Camber & deflection, [Handling], [Deck], Load rating (HL-93, LRFR), and the three output tables.
  - **Content added from the tabs, unchanged:** so it shows in both places without a copy, the Fatigue I steps (`fatigueSteps(inp,R)`, from the Stresses-tab card), the longitudinal-tie table (`LongTieBody`, Shear tab), the release-tension bonded-steel block (`RelSteelBody`, Anchorage Zone tab) and the three HL-93 rating derivations with their notes (`ratingDerivs(inp,R)`, Rating tab) were moved, text unchanged, into small functions that the tab and the report both call; the Handling and Deck tabs are rendered whole (`<HandlingTab/>`, `<DeckTab/>`) when those modules are on. The tab text is identical before and after (checked, below).
  - **Result lines** (`PsbRes`): one per `R.checks` entry, under the subsection that works it: "<check>: D/C = x.xx (<ref>) PASS/FAIL", with demand vs capacity / limit and x: the same `c.v`, `c.lim`, `c.r`, `c.pass` as the summary table and the status band. References are those the tool already quotes for the check (`PSB_CK`). Flexure and Min reinf are worked at midspan but checked at the governing grid station: their lines say so. "Release tens (+M, bot)" and "Srv tens (top)" have no worked step in the tool: their lines sit in 12.6, which says so and points to the stress output table. Rating (`PsbRF`): RF_inv / RF_opr for flexure (MBE 6A.4), shear (6A.5.6) and Service III (6A.5.4.1), "RF ≥ 1.00" / "RF < 1.00", from `R.rating`, `R.shrRating`, `R.svcRating`.
  - **Print:** while the report prints (`beforeprint` / `afterprint` listeners that exist only while the Report tab is open; the Print button still calls `window.print()`), `psbrPrintMode` sets `<style id="psbeam-page">` = `@media print { @page { size: letter portrait; … } }` with margin boxes: top-left "Project No: <job> / Description: <girder ID, girder, L>", top-center "Computed By: <by> / Checked By: —", top-right "Date: <date> / Date: —", bottom-left "<project> (PS-Girder)", bottom-right "Page X of Y". It adds `psb-rpt-print` to `<html>` and `<body>` so only the report prints (title block, status band, tabs and footer hidden, sheet frame off) and shrinks any display equation wider than 7.3 in (`psbrFit`). `afterprint` clears all of it. Printing any other tab is unchanged.

### D11-2. Display fixes in the report (no result change)
1. **Continuity check mark read the wrong check.** Continuity section, last step. Before: `${ck.at(-1).pass?'\\checkmark':'\\text{N.G.}'}`. After: `${cf('Neg flexure (pier)').pass?'\\checkmark':'\\text{N.G.}'}`. `ck.at(-1)` is the last check, which is "Neg flexure (pier)" only when the Handling and Deck modules are off. Check case: default project, L = 110 ft, continuity on with A_s = 8.0 in², deck module on: M_u = 4,533 k-ft, φM_n = 2,672 k-ft, D/C = 1.70 (FAIL in the summary). Before: ✓ (the pass of "Deck overhang"); after: N.G.
2. **d_t printed as "–".** Strength I flexure, "Nominal resistance & φ". `R.fMid` (a `flexFull` row) carries no `dt`, so `nx(f.dt,2)` printed "–". Before: `\frac{${nx(f.dt,2)}}{${nx(f.c,2)}}`. After: `\frac{${nx(cp.hc-ss.yLow,2)}}{${nx(f.c,2)}}`, the expression `flexure()` uses (`const dt=cp.hc-ss.yLow;`). Default project: d_t = 80 − 2 = 78.00 in, c = 7.30 in, ε_t = 0.003(78.00/7.3036 − 1) = 29.04×10⁻³ (the value printed before and after; only the substitution is new).
3. Upper-case captions changed Greek letters into other letters (γ_LL → "Γ_LL"; β, θ → "Β, Θ"; ε_s ×10³ → "ΕS"): `.psbr-root .mcap span:first-child, .psbr-root table.eng th {text-transform:none}` (report only).
4. Printed report: wide tables (the summary, the 11-column shear table) were cut at the right edge and wide equations clipped (`.scrollx` / `.mline` overflow); whole sections were pushed to the next page (`.calcsec{break-inside:avoid}`), leaving near-empty pages; the grey page background printed below the last section. In report print mode: tables wrap at a smaller size, equations are fitted, sections may break between steps (a caption stays with its first line), white background.

### D11-3. §6 links ("Worked in: → Tab · Card"; "see §n.k" in the report)
- `WkLink it={[{l,s,tab,card}]}`: in the app it reads "Worked in: <label> → <Tab> · <Card>". A click (`psbGoto` → `psbeam-goto` event; listener in `App` after `const [tab,setTab]=useState('inputs');`) opens the tab, finds the card (or output section) whose title contains `card`, or the report subsection with `data-wk=<s>`, scrolls to it and flashes it. Inside the report (`PsbrSee` context) the same component reads "<label>: see §n.k", jumps there and prints.
- **Links added:**
  - Rating tab (and report), flexure rating: φM_n at midspan → Flexure · Derivation — Strength I Flexure; φM_n at every station → Flexure · Output — Flexure Stations. Shear rating: φV_n at every station → Shear · Section-by-Section Design; at the critical section → Shear · Derivation — Shear. Service III rating: P_e, f_pe → Losses · Derivation — Refined / Approximate Long-Term Losses.
  - Stresses tab, "Derivation — Fiber Stresses" (its variable table quotes f_pi, P_i, f_pe, P_e and the section moduli): → Losses · Derivation — Elastic Shortening; → Losses · Derivation — … Long-Term Losses; → Section Props · Derivation — Composite Section.
  - Inputs tab, Loads (under the HL-93 / DF line): → Report · Loads — Dead, HL-93 & Distribution (the DFs are worked only in the report).
  - Report 1.1 summary table, new "Worked in" column: "see §n.k" per check plus, on screen, the tab link; 1.2 key quantities: total loss, P_e → §7.k; DF, M_LL+IM → §10.k; φMn / Mu → §13.k; camber → §16.k.
- Before / after for the inserted lines: before, nothing; after, for example (Inputs, after the `DF_m = <b>{fmt(R.dfm,3)}</b> · … kip</b></div>}` line): `{!R.error&&<WkLink it={[{l:'HL-93, DF_m / DF_v, M_LL+IM / V_LL+IM',s:'dfll',tab:'report',card:'Loads — Dead, HL-93 & Distribution'}]}/>}   {/* D11 links */}`. Every inserted link line ends with `{/* D11 links */}`.

### Check case (default project, fresh browser)
- Report: 20 sections, 21 letter pages (cover; references and contents, 2 pages; §1 … §20). Result lines: 19 checks + 3 RF. Flexure: M_u = 10,250.99 k-ft vs φM_n = 13,638.91 k-ft at x = 60.0 ft, D/C = 0.75 PASS (LRFD 5.6.3.2), "see §13.3". Shear: 241.19 vs 334.55 kip at x = 30.0 ft, D/C = 0.72 PASS, "see §14.6". HL-93 rating: flexure RF_inv 1.74 / RF_opr 2.25, shear 1.64 / 2.12, Service III 1.43. Same values as origin/main.
- Default + L = 110 ft, continuity, handling and deck on, severe corrosion: 23 sections, 25 pages, 26 checks + 3 RF.

### How verified (Tier 1)
- `node tests/check-syntax.mjs psbeam.html`: all scripts pass (JSX transpiled).
- `node tests/compare.mjs --tool page --file psbeam.html`: `page.text` and `page.storage` same; the only console message on both sides is Babel's "deoptimised the styling" note.
- Headless Chromium, origin/main vs branch, 5 cases (default; Type IV, L = 90 ft, approximate losses, exterior girder, skew 35°, no bonded release steel; L = 110 ft, continuity + handling + deck, severe corrosion; L = 145 ft, transformed section at release, γ_LL = 1.0, 16 strands with debonding; NEXT 32F, L = 60 ft): `computeAll(mergeInputs(case))` hashes identical; status band identical; the text of every tab identical except the added "Worked in" lines (Stresses 1, Rating 3); every number in main's report text also in the branch's. No console errors.
- Report PDFs (`emulateMedia print`, `preferCSSPageSize`) of the default and the continuity/handling/deck cases looked at page by page: header and footer on every page; all 125 in-report links resolve; no "–" placeholder or unrendered TeX in any report equation in the 5 cases. In-app click test: Rating → Flexure derivation and the flexure-station table, Stresses → Losses derivation, Inputs/Loads → Report §10.8, report summary → Shear derivation and "see §13.3": each opens the right tab and scrolls the target into view.

### Other copies
- None (the bootstrap blocks shared with index.html, lldf.html and stgirder.html are not touched).

### Open items (not changed)
- D11-O1. **Flexure tab, same continuity bug as D11-2.1:** four places use `R.checks.at(-1).pass` for the pier check (the "−Mu / −φMn @ pier" tile colour, the callout "OK / N.G.", the KV row "PASS / FAIL" and the derivation ✓; anchor `R.checks.at(-1).pass`), so they show the Handling / Deck check's status when those modules are on. Display only; not changed (outside the report).
- D11-O2. **Flexure tab, same d_t "–" as D11-2.2** in "Derivation — Strength I Flexure @ Midspan" (`\frac{${nx(f.dt,2)}}{${nx(f.c,2)}}`). Not changed (outside the report).
- D11-O3. **Fatigue-truck citation:** the Fatigue I step cites "5.6.1.4" (engine comment "5.6.1.4.1") for the fatigue truck; the fatigue load is LRFD Art. 3.6.1.4.1. A code-reference change needs the engineer (CLAUDE.md §4). Left out of the references table.
- D11-O4. **Rating derivations print fixed factors:** the flexure / shear rating equations print "1.25(…) − 1.50(…)" and the variable table shows γ_DC = `rt.gDC!=null?rt.gDC:1.25` (`R.rating` has no `gDC`). Consistent with the engine today, but would not follow an owner load-factor change.
- D11-O5. **Shear output table vs the check:** the bearing-face rows (x = 0.5 and L − 0.5 ft) show Vu/φVn = 1.821 on the default project while the Shear check (worst station, bearing face excluded) is 0.72. Correct per the tool's method, but a reader may read 1.82 as a failure; a note in the table would help.
- D11-O6. **No worked step for two checks:** "Release tens (+M, bot)" and "Srv tens (top)" are computed on the grid but not worked symbolically anywhere (CLAUDE.md §6 gap); the report points to the tabulated stresses. Adding steps would add calculation content.
- D11-O7. **Title-block fields:** no Checked by / Checked date fields; they print "—". Optional tool-prefixed fields (absent from saved data until typed) can be added if wanted.
- D11-O8. **Edition:** the tool states "AASHTO LRFD BDS (9th Ed. article numbering)"; the fix-log basis is the 10th Ed. (2024). The report says "edition: verify".

## 2026-10-18 — PR: claude/psbeam-pier-status — Flexure tab: continuity pier-check status and d_t substitution (D11-O1, D11-O2; Tier 1, display only; PR link added after merge)

- **Engineer request:** approved 2026-10-18: fix on the Flexure tab what D11-2.1 and D11-2.2 fixed in the report only (open items D11-O1, D11-O2).
- **Provision:** none changed. No formula, factor, unit, code reference or computed result changed (`computeAll` untouched; the pier D/C and its pass flag were already right, only the flag *displayed* was wrong). No saved-data key or format changed. The shared `bridgeSuite.v1.*` bootstrap blocks are not touched.
- **Status band and Summary not affected:** the header "n/N PASS" (`nPass`, `R.checks.filter(c=>c.pass)`), the check chips, the Report 1.1 summary table and the report's continuity ✓ (fixed in D11-2.1) all read each check's own `c.pass`. No hand-off payload carries a check status. Only the four Flexure-tab places below used `R.checks.at(-1)`; no displayed overall PASS/FAIL outcome changes.

### PS1. Flexure tab: pier-check status read the last check instead of "Neg flexure (pier)"   [display] [no result change]
- **Where:** `function FlexTab({inp,R}){`. Anchor (before): `R.checks.at(-1).pass` (4 places; none left after the fix). New anchor: `const okPier=`.
- **Problem:** `R.checks.at(-1)` is "Neg flexure (pier)" only when the Handling and Deck modules are off (their checks are pushed after it in `computeAll`). With either module on, the tile colour, the callout "OK / N.G.", the KV "PASS / FAIL" and the derivation ✓ showed the status of the last Handling / Deck check, e.g. a failing pier check shown as OK. Unconservative display; the status band and the summary were already right.
- **Before / After (exact):**
  1. New line after `const ok9=(R.checks.find(c=>c.n==='Flexure')||{}).pass, okMin=(R.checks.find(c=>c.n==='Min reinf')||{}).pass;`:
     ```js
       const okPier=(R.checks.find(c=>c.n==='Neg flexure (pier)')||{}).pass;   // pier check's own flag (not the last check: Handling / Deck checks come after it)
     ```
  2. Tile "−Mu / −φMn @ pier". Before: `{R.cont&&<div className={'br '+(R.checks.at(-1).pass?'p':'f')}>`. After: `{R.cont&&<div className={'br '+(okPier?'p':'f')}>`.
  3. Moment-plot callout ("Pier check: Mu(−M) = …"). Before: `(D/C = <b>{fmt(R.cont.dc,2)}</b>, {R.checks.at(-1).pass?'OK':'N.G.'})`. After: `(D/C = <b>{fmt(R.cont.dc,2)}</b>, {okPier?'OK':'N.G.'})`.
  4. Card "Negative Moment at Pier — Continuity for LL + SIDL", KV row. Before: `['M_u / φM_n',fmt(R.cont.dc,2),R.checks.at(-1).pass?'PASS':'FAIL']]}/>`. After: `['M_u / φM_n',fmt(R.cont.dc,2),okPier?'PASS':'FAIL']]}/>`.
  5. Same card, step "Capacity — deck steel tension, bottom-flange compression", end of the second equation. Before: `\frac{M_u}{\phi M_n}=${nx(R.cont.dc,3)}\;${R.checks.at(-1).pass?'\\checkmark':'\\text{N.G.}'}`. After: `\frac{M_u}{\phi M_n}=${nx(R.cont.dc,3)}\;${okPier?'\\checkmark':'\\text{N.G.}'}`.
- **Check case:** default project, L = 110 ft, continuity on with A_s = 8.0 in², deck module on. M_u = 4,533 k-ft, φM_n = 2,672 k-ft, D/C = 4,533 / 2,672 = 1.697 > 1.0 → FAIL (status band 22/23 PASS, before and after). Last check = "Deck overhang" (pass).
  - Before: tile green, callout "(D/C = 1.70, OK)", KV "1.70 PASS", derivation "1.697 ✓".
  - After: tile red, callout "(D/C = 1.70, N.G.)", KV "1.70 FAIL", derivation "1.697 N.G.".
  - Passing case (L = 110 ft, continuity A_s = 16.0 in² default, handling + deck on): D/C = 4,533 / 5,252 = 0.863 → green / OK / PASS / ✓ before and after. Without Handling / Deck (A_s = 8.0): FAIL shown before and after (the last check was the pier check).

### PS2. Flexure tab: d_t printed as "–" in the ε_t substitution   [display] [no result change]
- **Where:** `FlexTab`, card "Derivation — Strength I Flexure @ Midspan", step "Nominal resistance, strain & φ". Anchor: `\varepsilon_t=0.003\left(\frac{d_t}{c}-1\right)=0.003\left(\frac{`.
- **Problem:** `R.fMid` is a `flexFull` row and carries no `dt`, so `nx(f.dt,2)` printed "–". Same fix as D11-2.2, the expression `flexure()` uses (`const dt=cp.hc-ss.yLow;`); `cp = R.cp`, `ss = R.ss` are already in scope in that block.
- **Before:** `\frac{${nx(f.dt,2)}}{${nx(f.c,2)}}`. **After:** `\frac{${nx(cp.hc-ss.yLow,2)}}{${nx(f.c,2)}}`.
- **Check case:** default project: d_t = h_c − y_low = 80.00 − 2.00 = 78.00 in, c = 7.30 in, ε_t = 0.003(78.00/7.30 − 1) = 29.04×10⁻³, φ = 1.000. Before: "0.003(–/7.30 − 1) = 29.04×10⁻³"; after: "0.003(78.00/7.30 − 1) = 29.04×10⁻³" (result unchanged; only the substitution is new).

### How verified (Tier 1)
- `node tests/check-syntax.mjs psbeam.html`: all scripts pass (JSX transpiled).
- `node tests/compare.mjs --tool page --file psbeam.html`: `page.text` and `page.storage` same; the only console message on both sides is Babel's "deoptimised the styling" note.
- Headless Chromium, origin/main vs branch, 5 cases (default; L = 110 / continuity A_s = 8.0 / deck; L = 110 / continuity / handling + deck; L = 110 / continuity A_s = 8.0 alone; L = 145 / transformed section / deck): `computeAll(mergeInputs(case))` hashes identical; status band identical; Flexure-tab pier status and d_t as in the check cases above. No console errors. Screenshots of the fixed tile, pier card and flexure derivation looked at.

### Other copies
- None. The report already has both fixes (D11-2.1, D11-2.2).

### Open items
- D11-O1 and D11-O2 are closed by this entry.


## 2026-10-19 — PR: claude/stgirder-disconnect-others (STDISC: ST-Girder removed from the bridge suite on the other tools' side; engineer decision 2026-10-19; cross-tool PR with index.html, psbeam.html, lldf.html, Bridge Substructure Loading.html, tools.html, HANDOFF.md, AUDIT.md, CLAUDE.md §3; ST-Girder's side is claude/stgirder-disconnect; PR link added after merge)

### STDISC. PS-Beam: ST-Girder link and sibling entries removed   [no result change, Tier 0/1]
- **Engineer decision (2026-10-19):** ST-Girder (`stgirder.html`) is completely disconnected from every other bridge tool except GirderDetail (`Steel Bridge Beam Modules.html`): no MIDAS / MCT demands into ST-Girder, MCT's steel rating no longer uses ST-Girder's capacity (it falls back to MCT's own capacity inputs), ST-Girder removed from MCT's combined saved project, no ST-Girder links in the other tools; Substructure Loading reactions from GirderDetail are a later, separate change. CLAUDE.md §3 updated: the shared bootstrap block is now in index.html, lldf.html and psbeam.html only.
- **Shared bootstrap block (CLAUDE.md §3; changed identically in index.html, psbeam.html, lldf.html):** the `stgirder` entries are removed from `BridgeApps` `DEF` and `NAMES`, `BridgeLocks` `APPS` and `LOG_APPS`; the comments now say the block is byte-identical in the three files ("edit all three"), the project registry lists slices `{mct,psbeam,lldf}` (older projects may still hold a `stgirder` slice; nothing reads it), the app-path note drops "PS-Beam opens stgirder.html in a tab", the demands-channel note reads "MCT -> PS-Beam" and the `drives()` note "any app may publish capacity; MCT and PS-Beam for geometry". Nothing else in the block changed. Effects: `BridgeApps.register/set` no longer accept `stgirder` (only ST-Girder registered itself; its reduced record in stgirder.html still writes `appPaths.stgirder`, and every other app keeps that entry when it writes the object back, so GirderDetail's open-now still finds ST-Girder); `BridgeApps.all()` and the sync drawer no longer list ST-Girder; an old `syncLog.stgirder` shard is no longer merged into the change log. Verified byte-identical: `diff` of the BridgeBeam script and of the big block between the three files shows only each file's own `BridgeApps.boot('<app>')` line, as before.
- **Removed / changed in psbeam.html:** the header button `ST-Girder ↗` (`bridgeNav('stgirder')`); the superReactions glue comment (now "Only in psbeam.html since 2026-10-19 (ST-Girder's copy was removed …)") and its alert text ("In Bridge Substructure Loading, Reactions tab, click \"Pull from PS-Beam\"."); the handoff block comment ("shared verbatim with index.html (ST-Girder's copy was removed 2026-10-19)"); the capacity-lock comment. The BXSuperRx glue code itself is unchanged.
- **Saved data:** none changed. **§4:** no formula, factor or result changed.
- **How verified:** `node tests/check-syntax.mjs index.html psbeam.html lldf.html "Bridge Substructure Loading.html" tools.html` (all pass); `node tests/compare.mjs --tool page --file <each>` against main (bcbd913): psbeam, lldf, SubLoads and tools storage identical, page text differs only by the removed ST-Girder controls and the reworded ST-Girder mentions (psbeam: the "ST-Girder ↗" button; lldf: the "ST ↗" button and the self-weight notes; tools: the ST-Girder card), no console errors; index.html with a longer load timeout (scratch script): page text identical apart from the removed "🅢 Composite Steel Design App ↗" hand-off button, no console errors, the embedded-app bar lists only "PS-Beam →" / "LL & DL"; a saved ST-Girder capacity zone is replaced and the notice shown, a PS-Beam zone kept; lldf with an old ST-Girder `lldfGeom`: nothing offered; SubLoads with old ST-Girder copies: "Pull from PS-Beam" lists only PS-Beam, the short note is shown, no new-data marker for ST-Girder. ST-Girder's own checks: branch claude/stgirder-disconnect.
- **Diff (main → branch, `git diff -U0`; runs of more than 30 deleted lines and hunks that only delete are summarised by their first and last line):**
```diff
diff --git a/psbeam.html b/psbeam.html
index b5f6ae4..a492f5d 100644
--- a/psbeam.html
+++ b/psbeam.html
@@ -456,2 +456,3 @@ a.wk-a:hover{text-decoration:underline}
-     This block is byte-identical in index.html / psbeam.html / stgirder.html /
-     lldf.html — edit it in one place and copy it to the other three.
+     This block is byte-identical in index.html / psbeam.html / lldf.html — edit
+     it in one place and copy it to the other two. (ST-Girder, stgirder.html, left
+     the suite on 2026-10-19 and no longer carries it.)
@@ -530,2 +531,2 @@ var st=document.createElement('style'); st.textContent=css;
-     Bridge Suite shared-storage handoff (v1) — shared verbatim with index.html /
-     stgirder.html. Reads the analysis app's external-demands payload from
+     Bridge Suite shared-storage handoff (v1) — shared verbatim with index.html
+     (ST-Girder's copy was removed 2026-10-19). Reads the analysis app's external-demands payload from
@@ -645 +646 @@ var st=document.createElement('style'); st.textContent=css;
-     four apps; each app owns a "slice". Same-origin localStorage; identical in
+     three apps; each app owns a "slice". Same-origin localStorage; identical in
@@ -647 +648,2 @@ var st=document.createElement('style'); st.textContent=css;
-     Keys: bridgeSuite.v1.projects  { id:{name,savedAt,slices:{mct,psbeam,stgirder,lldf},demands} }
+     Keys: bridgeSuite.v1.projects  { id:{name,savedAt,slices:{mct,psbeam,lldf},demands} }
+           (projects saved before 2026-10-19 may also hold a "stgirder" slice; no app reads it now)
@@ -711,3 +713,2 @@ var st=document.createElement('style'); st.textContent=css;
-   The four apps link to each other by bare file name: MCT embeds "psbeam.html"
-   in an iframe, PS-Beam opens "stgirder.html" in a tab, every app's back link
-   points at "index.html". That works only while each file is named exactly what
+   The three apps link to each other by bare file name: MCT embeds "psbeam.html"
+   in an iframe, every app's back link points at "index.html". That works only while each file is named exactly what
@@ -731,2 +732,3 @@ var st=document.createElement('style'); st.textContent=css;
-   This block is byte-identical in index.html / psbeam.html / stgirder.html /
-   lldf.html. Edit one, edit all four.
+   This block is byte-identical in index.html / psbeam.html / lldf.html. Edit
+   one, edit all three. (ST-Girder left the suite on 2026-10-19; stgirder.html
+   keeps only a reduced app-path record of its own, which GirderDetail reads.)
@@ -736,2 +738,2 @@ var st=document.createElement('style'); st.textContent=css;
-  var DEF={mct:'index.html', psbeam:'psbeam.html', stgirder:'stgirder.html', lldf:'lldf.html'};
-  var NAMES={mct:'MCT Generator', psbeam:'PS-Beam', stgirder:'ST-Girder', lldf:'LL & DL Distribution'};
+  var DEF={mct:'index.html', psbeam:'psbeam.html', lldf:'lldf.html'};
+  var NAMES={mct:'MCT Generator', psbeam:'PS-Beam', lldf:'LL & DL Distribution'};
@@ -906 +908 @@ try{ window.BridgeApps.boot('psbeam'); }catch(e){}
-   Lock state is shared across all four apps — locking the distribution-factor
+   Lock state is shared across all three apps — locking the distribution-factor
@@ -917 +919 @@ try{ window.BridgeApps.boot('psbeam'); }catch(e){}
-   This block is byte-identical in all four apps. Edit it in one place and
+   This block is byte-identical in all three apps. Edit it in one place and
@@ -958 +960,2 @@ try{ window.BridgeApps.boot('psbeam'); }catch(e){}
-    /* The analysis hand-off, MCT -> the two design apps. `key` is the whole
+    /* The analysis hand-off, MCT -> PS-Beam (ST-Girder no longer reads it,
+       2026-10-19). `key` is the whole
@@ -970 +973 @@ try{ window.BridgeApps.boot('psbeam'); }catch(e){}
-  var APPS={mct:'MCT', psbeam:'PS-Beam', stgirder:'ST-Girder', lldf:'LL & DL'};
+  var APPS={mct:'MCT', psbeam:'PS-Beam', lldf:'LL & DL'};
@@ -1001 +1004 @@ try{ window.BridgeApps.boot('psbeam'); }catch(e){}
-     (PS-Beam and ST-Girder for capacity; MCT and both design apps for
+     (any app may publish capacity; MCT and PS-Beam for
@@ -1045 +1048 @@ try{ window.BridgeApps.boot('psbeam'); }catch(e){}
-  var LOG_APPS=['mct','psbeam','stgirder','lldf'];
+  var LOG_APPS=['mct','psbeam','lldf'];
@@ -1794,5 +1797,4 @@ try{ window.BridgeApps.boot('psbeam'); }catch(e){}
-   "Export hand-off (JSON)". Uses BridgeXfer above. Duplicated verbatim in psbeam.html and
-   stgirder.html (CLAUDE.md §3). build() returns {payload} or {error}; it runs on click only.
-   The payload goes to bridgeSuite.v1.superReactions, and a copy to
-   bridgeSuite.v1.superReactions.by.<id>, so Substructure Loading can choose when both girder
-   apps have sent. */
+   "Export hand-off (JSON)". Uses BridgeXfer above. Only in psbeam.html since 2026-10-19 (ST-Girder's
+   copy was removed: ST-Girder is connected to GirderDetail only). build() returns {payload} or {error};
+   it runs on click only. The payload goes to bridgeSuite.v1.superReactions, and a copy to
+   bridgeSuite.v1.superReactions.by.<id>, so Substructure Loading can choose between producers. */
@@ -1830 +1832 @@ try{ window.BridgeApps.boot('psbeam'); }catch(e){}
-      +'\n\nIn Bridge Substructure Loading, Reactions tab, click "Pull from PS-Beam / ST-Girder".');
+      +'\n\nIn Bridge Substructure Loading, Reactions tab, click "Pull from PS-Beam".');
@@ -8415,2 +8417,2 @@ function App(){
-    // Only one app republishes capacity, even with PS-Beam and ST-Girder
-    // both open on the same locked channel.
+    // Only one app republishes capacity, even with several tabs open on the
+    // same locked channel.
-8654 +8655,0  [deleted 1 lines: first "<button className="btn sm ghost" onClick={()=>bridgeNav('stgirder')} title="Open the composite steel design ap" ... last "<button className="btn sm ghost" onClick={()=>bridgeNav('stgirder')} title="Open"]
```

## 2026-10-19 — Fatigue truck citation 5.6.1.4 → 3.6.1.4.1 (engineer-approved, wording only)

The fatigue load (one design truck, constant 30-ft rear axle spacing, IM 15%, no lane load) is defined in AASHTO LRFD Art. 3.6.1.4.1; the tool cited "5.6.1.4". No computed value changes.

- Engine comment (anchor `// Fatigue truck`): `// Fatigue truck (5.6.1.4.1): design truck…` → `// Fatigue truck (3.6.1.4.1): design truck…`
- Fatigue tab step (anchor `Fatigue truck moment (single lane, IM = 15%, no lane load)`): `r="5.6.1.4"` → `r="3.6.1.4.1"`
- Report references row "AASHTO LRFD" (anchor `and 3.6.2 (HL-93, dynamic load allowance);`): added `3.6.1.4.1 (fatigue truck);`

Check: the Fatigue tab step and the report §15 step show "3.6.1.4.1"; the references table lists it. `node tests/check-syntax.mjs psbeam.html`: all scripts pass. Closes the open item from the D11 entry (#280).

## 2026-10-19 — PR: claude/aashto10-psbeam (AASHTO LRFD 10th Ed. gaps: debonding warnings, Service III γLL wording, 5.9.2.3.1a renumbering, edition label; PR link added after merge)

Basis: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024). Every provision below was checked against the 10th Ed. text. **No computed result changes**: only warning strings, hints, notes, comments and labels. The `bridgeSuite.v1` bootstrap block is untouched. No saved-data key or format changes. Line numbers (≈) are for the file after this PR; hunks below are exact (`-` before, `+` after).

### AE1. Debonding warnings per 10th Ed. Art. 5.9.4.3.3   [warnings only, no result change]
- **Where:** `computeAll()`, input-validation warnings. Anchors: the removed block started `// Debonding limits (5.9.4.3.3): total debonded ≤ 25%` (≈2864, it duplicated the second block); the replaced block started `// debonding limits (LRFD 5.9.4.3.3): ≤25% of total strands, ≤40% per row`, now `// Debonding (AASHTO LRFD 10th Ed. 5.9.4.3.3)` (≈2871). New item (G) check right after `const ldDebond=2.0*(fpsM-(2/3)*fpe)*ss.st.db;` (≈3364). Live summary under the strand table in `InputsTab`, anchor `// live debond summary vs` (≈5216).
- **Problem:** the tool warned above 25 % of all strands debonded and above 40 % of a row, citing 9th-edition conditions. The two warning blocks also duplicated each other (both fired). The 10th Ed. article has a per-row limit of 45 % (more with Owner approval), no total-percentage limit, a per-section termination limit, a 60 d_b termination spacing and symmetry requirements. Old warnings were more restrictive than the 10th Ed. for the row/total percentages and silent on terminations.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 5.9.4.3.3, items A–K (cited by letter; text not reproduced).
- **Now checked (from the strand table; a row's debonded strands all share one length `dbnd`, so each distinct `dbnd` is one termination section):**
  - (A) row: n_d / n > 45 % → warning (Owner approval needed). No total limit.
  - (B) Σ n_d terminating at one `dbnd` > N_max, N_max = 4 if d_b = 0.7 in. or Σ n_d (all rows) ≤ 10, else 6.
  - (C) consecutive distinct termination locations closer than 60 d_b.
  - (D) a row with an even number of strands and an odd number debonded (cannot be symmetric about the vertical CL).
  - (I) I-shapes (not NEXT, box or deck beams): Σ n_d / N_total > 25 % or b_bf / b_w > 4 → reminder that strands within the web width must stay bonded (the tool does not know which strands of a row are debonded).
  - (G) simple span (continuity off): longest `dbnd` > min(0.20 L, L/2 − ℓ_d), ℓ_d = 2.0(f_ps − ⅔ f_pe) d_b (the existing `ldDebond`, worked on the Shear tab, Strand Development Length card).
  - Not checkable from the tool's data, listed in the strand-table hint as "verify": symmetric placement/termination beyond the odd-count test (D), alternate bonded/debonded locations (E), section-type detailing (I–K), continuity restraint interaction (H, Art. 5.12.3.3).
- **Before / After:**
```diff
@@ -2863,12 +2863,2 @@ function computeAll(inp){
       warns.push(`Jacking at ${inp.str.jack}·fpu exceeds the 0.75·fpu limit for low-relaxation strand (Table 5.9.2.2-1).`);
-    // Debonding limits (5.9.4.3.3): total debonded ≤ 25% of all strands (up to 45% permitted for
-    // certain sections meeting the 9th-ed. conditions); per-row debonded ≤ 40% of that row.
-    {const nTot=ss.rows.reduce((s,r)=>s+r.n,0);
-     const nDb=ss.rows.reduce((s,r)=>s+((+r.dbnd>0)?(+r.nd||0):0),0);
-     if(nTot>0&&nDb>0){
-       const pct=100*nDb/nTot;
-       if(pct>25) warns.push(`${fmt(pct,0)}% of strands are debonded — exceeds the 25% base limit of 5.9.4.3.3 (up to 45% is permitted only where the 9th-edition conditions are met; verify).`);
-       ss.rows.forEach((r,i)=>{ if(+r.dbnd>0&&(+r.nd||0)>0.4*r.n+1e-9)
-         warns.push(`Row ${i+1}: ${r.nd} of ${r.n} strands debonded (${fmt(100*r.nd/r.n,0)}%) — exceeds the 40% per-row limit (5.9.4.3.3).`);});
-     }}
     if(ss.nh>0){
@@ -2880,10 +2870,26 @@ function computeAll(inp){
     }
-    // debonding limits (LRFD 5.9.4.3.3): ≤25% of total strands, ≤40% per row
+    // Debonding (AASHTO LRFD 10th Ed. 5.9.4.3.3). Warnings only: no computed value depends on them.
+    // Checked from the strand table: (A) per row ≤ 45% unless the Owner approves more (no limit on the
+    // total); (B) terminations per section ≤ 6, or ≤ 4 with 0.7-in. strand or when 10 or fewer strands
+    // are debonded; (C) termination sections ≥ 60 d_b apart; (D) symmetry about the vertical CL;
+    // (I) single-web flanged sections with > 25% of all strands debonded or b_f/b_w > 4. (G) is checked after ℓ_d below.
+    // All debonded strands of a row share one length dbnd, so each distinct dbnd is one termination section.
     if(ss.Ndebond>0){
-      const pctTot=100*ss.Ndebond/Math.max(ss.Ntot,1);
-      if(pctTot>25.01) warns.push(`Debonded strands (${ss.Ndebond} of ${ss.Ntot} = ${fmt(pctTot,0)}%) exceed the 25% total limit (5.9.4.3.3).`);
+      const db=ss.st.db;
       ss.rows.forEach((r,i)=>{ if(r.dbnd>0&&r.nd>0){ const pr=100*r.nd/r.n;
-        if(pr>40.01) warns.push(`Row ${i+1}: ${r.nd} of ${r.n} debonded (${fmt(pr,0)}%) exceeds the 40% per-row limit (5.9.4.3.3).`);
+        if(pr>45.01) warns.push(`Row ${i+1}: ${r.nd} of ${r.n} debonded (${fmt(pr,0)}%) exceeds the 45% per-row limit of 5.9.4.3.3(A) (permitted only with Owner approval).`);
+        if(r.nd%2===1&&r.n%2===0) warns.push(`Row ${i+1}: ${r.nd} of ${r.n} strands debonded — an odd number in a row of an even number of strands cannot be symmetric about the vertical centerline (5.9.4.3.3(D)).`);
         if(r.nd>r.n) warns.push(`Row ${i+1}: debonded count (${r.nd}) exceeds the strands in the row (${r.n}).`);
       }});
+      const term={}; ss.rows.forEach(r=>{ if(r.dbnd>0&&r.nd>0) term[r.dbnd]=(term[r.dbnd]||0)+r.nd; });
+      const nTermMax=(db>=0.7-1e-9||ss.Ndebond<=10)?4:6;
+      const why=db>=0.7-1e-9?'0.7-in. strand':ss.Ndebond<=10?`only ${ss.Ndebond} strands debonded, ≤ 10`:'';
+      const locs=Object.keys(term).map(Number).sort((a,b)=>a-b);
+      locs.forEach(x=>{ if(term[x]>nTermMax)
+        warns.push(`Debonding of ${term[x]} strands terminates at the same section (${fmt(x,2)} ft from each end) — exceeds ${nTermMax} per section${why?` (${why})`:''} (5.9.4.3.3(B)). Stagger the debond lengths.`);});
+      for(let k=1;k<locs.length;k++){ const s=(locs[k]-locs[k-1])*12;
+        if(s<60*db-1e-9) warns.push(`Debond terminations at ${fmt(locs[k-1],2)} ft and ${fmt(locs[k],2)} ft are ${fmt(s,1)}″ apart — less than 60d_b = 60 × ${db}″ = ${fmt(60*db,1)}″ (5.9.4.3.3(C)).`); }
+      const pctTot=100*ss.Ndebond/Math.max(ss.Ntot,1), bfbw=(g.bw>0)?g.bbf/g.bw:0;
+      if(!g.isNext&&!g.isBox&&!g.isDeck&&(pctTot>25.01||bfbw>4+1e-9))
+        warns.push(`Single-web flanged section with debonding: ${pctTot>25.01?`${ss.Ndebond} of ${ss.Ntot} strands (${fmt(pctTot,0)}%) debonded > 25%`:''}${pctTot>25.01&&bfbw>4+1e-9?' and ':''}${bfbw>4+1e-9?`b_f/b_w = ${fmt(g.bbf,1)}/${fmt(g.bw,1)} = ${fmt(bfbw,2)} > 4`:''} — keep the strands that lie within the web width bonded (5.9.4.3.3(I)). The tool does not check which strands of a row are debonded; verify on the strand pattern.`);
     } }
@@ -3357,2 +3363,9 @@ function computeAll(inp){
   const ldDebond=2.0*(fpsM-(2/3)*fpe)*ss.st.db;
+  // Debond length from the beam end, simple spans (10th Ed. 5.9.4.3.3(G)): ≤ min(0.20 L, L/2 − ℓ_d), ℓ_d with κ = 2.0.
+  // Warning only. Spans made continuous (continuity on) are left to 5.9.4.3.3(H) / 5.12.3.3.
+  if(ss.Ndebond>0&&!(inp.cont&&inp.cont.on)){
+    const dbMaxG=Math.min(0.20*L, L/2-ldDebond/12);
+    const dbLong=Math.max(...ss.rows.filter(r=>r.dbnd>0&&r.nd>0).map(r=>r.dbnd));
+    if(dbLong>dbMaxG+1e-9) warns.push(`Debond length ${fmt(dbLong,2)} ft exceeds min(0.20L, L/2 − ℓ_d) = min(0.20 × ${fmt(L,1)}, ${fmt(L/2,2)} − ${fmt(ldDebond/12,2)}) = ${fmt(dbMaxG,2)} ft for a simple span (5.9.4.3.3(G); ℓ_d of a debonded strand, κ = 2.0, worked on the Shear tab, Strand Development Length card).`);
+  }
   // splitting (5.9.4.4) & interface shear (5.7.4)
@@ -5202,10 +5215,9 @@ function InputsTab({inp,set,R,selRow,setSelRow,editedRows,flashRow,editLog,clear
       </div>
-      {!R.error&&(()=>{ // live debond summary vs LRFD 5.9.4.3.3
+      {!R.error&&(()=>{ // live debond summary vs AASHTO LRFD 10th Ed. 5.9.4.3.3 (display only)
         const pct=100*R.ss.Ndebond/Math.max(R.ss.Nbond,1);
-        const overTot=pct>25.01;
-        const overRow=inp.rows.some(r=>+r.dbnd>0&&+r.n>0&&100*Math.min(+r.nd||0,+r.n)/+r.n>40.01);
+        const overRow=inp.rows.some(r=>+r.dbnd>0&&+r.n>0&&100*Math.min(+r.nd||0,+r.n)/+r.n>45.01);
         if(R.ss.Ndebond===0) return null;
         return <div className="hint" style={{marginTop:6}}>
-          Debonded: <b>{R.ss.Ndebond}</b> of {R.ss.Nbond} straight strands (<b style={{color:overTot?'var(--fail)':'inherit'}}>{fmt(pct,0)}%</b>{overTot?' — exceeds 25% total':''}).
-          {overRow&&<b style={{color:'var(--fail)'}}> One or more rows exceed 40% debonded.</b>} LRFD 5.9.4.3.3 caps total debonding at 25% and 40% per row; verify termination staggering.
+          Debonded: <b>{R.ss.Ndebond}</b> of {R.ss.Nbond} straight strands (<b>{fmt(pct,0)}%</b>).
+          {overRow&&<b style={{color:'var(--fail)'}}> One or more rows exceed 45% debonded (Owner approval needed).</b>} LRFD 10th Ed. 5.9.4.3.3 — checked here (see Detailing warnings): ≤ 45% per row (A; no limit on the total), terminations per section ≤ 6, or ≤ 4 with 0.7″ strand or ≤ 10 debonded (B), terminations ≥ 60d<sub>b</sub> apart (C), odd counts in even rows (D), single-web flanged sections (I), debond length on simple spans (G). Not checked — verify on the strand pattern: symmetric termination and placement (D), alternating bonded/debonded positions (E), section-type detailing (I–K), continuity restraint interaction (H, 5.12.3.3).
         </div>;})()}
```
- **Check case** (default BT-72, L = 120 ft, 0.6-in. strand, rows 10/10/8 at y = 2/4/6 in., 12 harped; `computeAll` run headless in Chromium):
  - Row 1 n_d = 6 at 10 ft, row 2 n_d = 4 at 10 ft: before "36% … exceeds the 25% base limit", "Row 1 … exceeds the 40% per-row limit" (twice). After: row 1 = 6/10 = 60 % > 45 % (A); Σ n_d = 10 ≤ 10 → N_max = 4, 10 strands terminate at 10 ft > 4 (B); b_bf/b_w = 26/6 = 4.33 > 4 (I).
  - Rows 4/10 and 2/10 at 8 ft, 3/8 and 3/4 at 10.5 ft (Σ n_d = 12 > 10 → N_max = 6; 6 and 6 terminate: OK): spacing (10.5 − 8)·12 = 30 in. < 60 × 0.6 = 36 in. (C); rows 3 and 4 odd-in-even (D); row 4 = 75 % (A); 12/44 = 27 % > 25 % and 4.33 > 4 (I). Before: total 25 % and row 40 % warnings only.
  - 0.7-in. strand, 4 + 2 = 6 terminate at 12 ft → N_max = 4 (B). Before: no warning.
  - One row 4/10 debonded 30 ft, continuity off: ℓ_d = 191.4 in. = 15.95 ft; min(0.20 × 120, 60 − 15.95) = min(24.00, 44.05) = 24.00 ft < 30 ft (G). Continuity on: (G) not reported.
  - Compliant layout 4+2 at 6 ft, 2+4 at 10 ft, 2 at 14 ft (Σ 14 → N_max 6; spacings 48 in. ≥ 36 in.): only the (I) reminder (b_bf/b_w 4.33). Before: "32% … exceeds the 25% base limit".
- **How verified:** `computeAll()` of origin/main and of this branch run on 9 inputs (default, the debond cases above, γLL = 1.0): every field of the result other than `warns` is identical (leaf-by-leaf diff, 0 differences). Strand-table hint and Detailing warnings rendered by driving the Inputs → Strands pane headless (no console errors). `node tests/check-syntax.mjs psbeam.html` passes.
- **Other copies:** none.

### AE2. Service III γLL notes match Table 3.4.1-4   [wording only, factor and default (0.8) unchanged]
- **Where:** `InputsTab` options, anchor `<Num l="γLL Service III"` (≈5566); `StressTab` callout, anchor `Service III bottom tension uses γLL` (≈6160).
- **Problem:** the input note said "0.8 for components with bonded strand, 1.0 otherwise (Table 3.4.1-1)" and the callout "0.8 with refined losses, 1.0 legacy" — the inverse of the table. 10th Ed. Table 3.4.1-4: γLL = 1.0 only for refined time-dependent losses (Art. 5.9.3.4) taken together with the elastic gain; 0.8 for all other prestressed components.
- **Before / After:**
```diff
@@ -5553,5 +5565,5 @@ function InputsTab({inp,set,R,selRow,setSelRow,editedRows,flashRow,editLog,clear
         <Num l="γLL Service III" v={inp.opt.gLLs3} set={v=>u('opt.gLLs3',v)} step={0.1}
-             sub="0.8 for components with bonded strand, 1.0 otherwise (Table 3.4.1-1)"/>
+             sub="1.0 only with refined losses (5.9.3.4) taking the elastic gain; 0.8 otherwise (Table 3.4.1-4)"/>
         <Num l="Release compression limit (× f′ci)" v={inp.opt.relCfac} set={v=>u('opt.relCfac',v)} step={0.05} min={0}
-             sub="0.65 per Table 5.9.2.3.1a-1 (8th Ed. on); some owners require 0.60. Blank = 0.65"/>
+             sub="0.65 per Art. 5.9.2.3.1a; some owners require 0.60. Blank = 0.65"/>
         <Fld l="Corrosion exposure" sub="sets the Service III tension limit: 0.19√f′c vs. zero tension">
@@ -6147,3 +6159,3 @@ function StressTab({inp,R}){
         layout={{xaxis:{title:'x (ft)'},yaxis:{title:'stress (ksi, + = compression)'}}}/>
-      <div className="callout">Girder fiber stresses. Deck compression (SIDL + LL on composite section): max <b>{fmt((R.checks.find(c=>c.n==='Deck comp')||{}).v,3)} ksi</b> vs 0.60f′c_deck = <b>{fmt(lim.dkC2,3)} ksi</b>. Service III bottom tension uses γLL = {inp.opt.gLLs3} per LRFD Table 3.4.1-4 (0.8 with refined losses, 1.0 legacy).</div>
+      <div className="callout">Girder fiber stresses. Deck compression (SIDL + LL on composite section): max <b>{fmt((R.checks.find(c=>c.n==='Deck comp')||{}).v,3)} ksi</b> vs 0.60f′c_deck = <b>{fmt(lim.dkC2,3)} ksi</b>. Service III bottom tension uses γLL = {inp.opt.gLLs3} per LRFD Table 3.4.1-4 (1.0 only with refined losses per 5.9.3.4 taking the elastic gain; 0.8 for all other cases).</div>
     </Card>
```
- **Check:** default γLL stays 0.8; results identical with γLL 0.8 and 1.0 (case `svc`).

### AE3. "Table 5.9.2.3.1a-1" → Art. 5.9.2.3.1a   [citation only, 0.65 unchanged]
- **Where:** `DEFAULTS.opt.relCfac` comment, `relCfacOf` comment, `computeAll` comment anchor `// Release compression limit factor (`, Options input sub-text anchor `<Num l="Release compression limit (× f′ci)"`.
- **Problem:** the 10th Ed. has no Table 5.9.2.3.1a-1; the 0.65 f′ci limit is in the text of Art. 5.9.2.3.1a. The "8th Ed. on" note is dropped.
- **Before / After:**
```diff
@@ -1941,3 +1941,3 @@ const DEFAULTS = {
        relAs:0.62, relFy:60,
-       relCfac:0.65,              // release compression limit = relCfac·f'ci (Table 5.9.2.3.1a-1: 0.65; some owners use 0.60)
+       relCfac:0.65,              // release compression limit = relCfac·f'ci (Art. 5.9.2.3.1a: 0.65; some owners use 0.60)
        rtPhiC:1.0, rtPhiS:1.0,    // LRFR condition factor φc and system factor φs (MBE 6A.4.2.3 / 6A.4.2.4); product floored at 0.85
@@ -2090,3 +2090,3 @@ function shapePayload(inp,g,cp){
 function Ec(fc,wc){ return 120000*wc*wc*Math.pow(fc,0.33); } // LRFD 5.4.2.4
-// Release compression limit factor: opt.relCfac × f'ci (Table 5.9.2.3.1a-1 value 0.65; blank → 0.65).
+// Release compression limit factor: opt.relCfac × f'ci (Art. 5.9.2.3.1a value 0.65; blank → 0.65).
 function relCfacOf(inp){ const v=inp&&inp.opt&&inp.opt.relCfac; if(v===''||v==null) return 0.65; const n=+v; return (isFinite(n)&&n>0)? n : 0.65; }
@@ -3077,3 +3083,3 @@ function computeAll(inp){
   const m=inp.mat;
-  // Release compression limit factor (Table 5.9.2.3.1a-1: 0.65 f'ci for pretensioned members, 8th Ed. on);
+  // Release compression limit factor (Art. 5.9.2.3.1a, 10th Ed.: 0.65 f'ci for pretensioned members);
   // an input so an owner rule (e.g. 0.60) can be applied. Blank / invalid → 0.65.
```
(the Options sub-text change is in the AE2 hunk above.)

### AE4. Edition label: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024)   [label only]
- **Where:** `ReportTab`: references row "AASHTO LRFD" (anchor `['AASHTO LRFD','AASHTO LRFD Bridge Design Specifications`), Assumptions & basis line (anchor `composite-stage demands imported from MIDAS`), title-block Codes line (anchor `<div className="d">Codes: AASHTO LRFD`). The references row also lists 5.9.4.3.2, 5.9.4.3.3 (now cited by the warnings). No owner setting in this tool.
- **Before / After:**
```diff
@@ -7369,3 +7381,3 @@ function ReportTab({inp,R}){
   const refs=[
-    ['AASHTO LRFD','AASHTO LRFD Bridge Design Specifications. The tool states “9th Ed. article numbering” (Assumptions & basis); edition: verify. Articles cited: 2.5.2.6.2 (live-load deflection); 3.4.1, Tables 3.4.1-1 and 3.4.1-4 (load factors); 3.6.1.2.2–3.6.1.2.4'+(R.cont?', 3.6.1.3.1':'')+' and 3.6.2 (HL-93, dynamic load allowance); 3.6.1.4.1 (fatigue truck); 4.6.2.2.1, Tables 4.6.2.2.2b-1, 4.6.2.2.2d-1 and 4.6.2.2.3a-1, 4.6.2.2.2d, C4.6.2.2.2d, 4.6.2.2.2e, 4.6.2.2.3c (distribution factors); 4.6.2.6.1 (effective flange width); 5.4.2.3, 5.4.2.4 (time-dependent properties, E_c); 5.5.3.1, 5.5.3.3 (fatigue); 5.5.4.2 (φ); 5.6.2.2, 5.6.3.1.1, 5.6.3.2, 5.6.3.3 (flexure); 5.7.2.8, 5.7.3.3, 5.7.3.4.2, 5.7.3.5, 5.7.4 (shear, longitudinal tie, interface shear); Table 5.9.2.2-1, 5.9.2.3.1, 5.9.2.3.2 (stress limits); C5.9.3.2.3a, 5.9.3.3, 5.9.3.4, C5.9.3.4.3 (losses, elastic gains); 5.9.4.3.1 (transfer length); 5.9.4.4.1, 5.9.4.4.2 (anchorage zone)'+(R.cont?'; 5.12.3.3 (continuity)':'')+(R.deck?'; 4.6.2.1, Table 4.6.2.1.3-1, 4.6.2.1.6, Table A4-1, 9.7.3.2, Section 13 (deck)':'')+'.'],
+    ['AASHTO LRFD','AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024). Articles cited: 2.5.2.6.2 (live-load deflection); 3.4.1, Tables 3.4.1-1 and 3.4.1-4 (load factors); 3.6.1.2.2–3.6.1.2.4'+(R.cont?', 3.6.1.3.1':'')+' and 3.6.2 (HL-93, dynamic load allowance); 3.6.1.4.1 (fatigue truck); 4.6.2.2.1, Tables 4.6.2.2.2b-1, 4.6.2.2.2d-1 and 4.6.2.2.3a-1, 4.6.2.2.2d, C4.6.2.2.2d, 4.6.2.2.2e, 4.6.2.2.3c (distribution factors); 4.6.2.6.1 (effective flange width); 5.4.2.3, 5.4.2.4 (time-dependent properties, E_c); 5.5.3.1, 5.5.3.3 (fatigue); 5.5.4.2 (φ); 5.6.2.2, 5.6.3.1.1, 5.6.3.2, 5.6.3.3 (flexure); 5.7.2.8, 5.7.3.3, 5.7.3.4.2, 5.7.3.5, 5.7.4 (shear, longitudinal tie, interface shear); Table 5.9.2.2-1, 5.9.2.3.1, 5.9.2.3.2 (stress limits); C5.9.3.2.3a, 5.9.3.3, 5.9.3.4, C5.9.3.4.3 (losses, elastic gains); 5.9.4.3.1 (transfer length); 5.9.4.3.2, 5.9.4.3.3 (development length, debonding); 5.9.4.4.1, 5.9.4.4.2 (anchorage zone)'+(R.cont?'; 5.12.3.3 (continuity)':'')+(R.deck?'; 4.6.2.1, Table 4.6.2.1.3-1, 4.6.2.1.6, Table A4-1, 9.7.3.2, Section 13 (deck)':'')+'.'],
     ['AASHTO MBE','Manual for Bridge Evaluation, Section 6A (LRFR): 6A.4, Tables 6A.4.2.2-1, 6A.4.2.3-1, 6A.4.2.4-1, Eq. 6A.4.2.1-3, 6A.5.4.1, 6A.5.6 (HL-93 design-load rating). Edition not stated by the tool: verify.'],
@@ -7399,3 +7411,3 @@ function ReportTab({inp,R}){
         <div style={{fontSize:12,lineHeight:1.65,color:'var(--ink2)'}}>
-        AASHTO LRFD BDS (9th Ed. article numbering) · {R.useExt?<React.Fragment><b>composite-stage demands imported from MIDAS</b> (span {R.ext.sel.idx}, {fmt(R.ext.spanLen,0)} ft; DC2, DW and the LL+IM envelope by station, DF &amp; IM already applied; girder self-weight and DC1 deck/haunch computed by PS-Beam on the non-composite section) · </React.Fragment>:'simple span, '}unshored construction · {R.useT?'transformed section at release (P @ fpbt), gross/composite thereafter':'gross section properties (transformed-section elastic gains not itemized)'} · losses computed at midspan, applied uniformly · {R.useExt?'LL force effects interpolated from the imported station envelope':'LL moment shaped parabolically and shear linearly from envelope values'} · approximate fps method (5.6.3.1.1), deck f′c for the compression block · MCFT general procedure assuming ≥ minimum transverse reinforcement{R.cont?(R.cont.extPier?' · continuity: pier negative moment taken from the MIDAS envelope at the span ends':' · continuity for LL+SIDL: equal adjacent spans, pier negative moment only (positive-moment connection & restraint moments per 5.12.3.3 not computed)'):''} · time-dependent coefficients per 5.4.2.3 · units: kip, in, ksi (ft for span). Verify against jurisdiction-specific requirements (e.g., RIDOT LRFD supplements) before issue.
+        AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024) · {R.useExt?<React.Fragment><b>composite-stage demands imported from MIDAS</b> (span {R.ext.sel.idx}, {fmt(R.ext.spanLen,0)} ft; DC2, DW and the LL+IM envelope by station, DF &amp; IM already applied; girder self-weight and DC1 deck/haunch computed by PS-Beam on the non-composite section) · </React.Fragment>:'simple span, '}unshored construction · {R.useT?'transformed section at release (P @ fpbt), gross/composite thereafter':'gross section properties (transformed-section elastic gains not itemized)'} · losses computed at midspan, applied uniformly · {R.useExt?'LL force effects interpolated from the imported station envelope':'LL moment shaped parabolically and shear linearly from envelope values'} · approximate fps method (5.6.3.1.1), deck f′c for the compression block · MCFT general procedure assuming ≥ minimum transverse reinforcement{R.cont?(R.cont.extPier?' · continuity: pier negative moment taken from the MIDAS envelope at the span ends':' · continuity for LL+SIDL: equal adjacent spans, pier negative moment only (positive-moment connection & restraint moments per 5.12.3.3 not computed)'):''} · time-dependent coefficients per 5.4.2.3 · units: kip, in, ksi (ft for span). Verify against jurisdiction-specific requirements (e.g., RIDOT LRFD supplements) before issue.
         </div>
@@ -7870,3 +7882,3 @@ function ReportTab({inp,R}){
       <div className="d">{psbrDesc(inp,R)} · {R.ss.Ntot}-{inp.str.size} strands · {R.useExt?'demands imported from MIDAS (span '+R.ext.sel.idx+')':R.cont?'simple span made continuous for LL + SIDL':'simple span'} · {df.ext?'exterior':'interior'} girder</div>
-      <div className="d">Codes: AASHTO LRFD Bridge Design Specifications (9th Ed. article numbering as stated by the tool; edition: verify) · AASHTO MBE Section 6A (load rating) · PCI Design Handbook (camber multipliers)</div>
+      <div className="d">Codes: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024) · AASHTO MBE Section 6A (load rating) · PCI Design Handbook (camber multipliers)</div>
       <table className="psbr-tb"><tbody>
```
- **Check:** Report tab shows "AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024)" in the three places; no "9th Ed." or "edition: verify" for AASHTO LRFD remains in psbeam.html (the MBE and PCI rows still say "Edition not stated by the tool: verify", out of scope).

### Open items (not changed)
- Art. 5.9.2.3.1a (10th Ed.) permits 0.70 f′ci at component extremities when lateral bending (tilt, wind, transport) is explicitly considered; the tool uses 0.65 (user-editable). Engineer decision whether to note it.
- Options "Corrosion exposure" sub-text says "0.19√f′c vs. zero tension"; the calculation uses 0.0948λ√f′c ≤ 0.3 ksi for severe exposure (Table 5.9.2.3.2b-1), which the Stresses tab states correctly. Wording only.
- Item (I) shows a reminder for every debonded BT-72 design because b_bf/b_w = 26/6 > 4; the tool cannot check which strands in a row are debonded (it assumes outermost first in the 3-D view only).
- The MBE and PCI reference rows still have "edition not stated: verify".

## 2026-10-19 — PR: claude/aashto10-psbeam-2 (follow-up to #330; Options input notes, wording only; PR link added after merge)

No computed value changes: only two `sub` texts in `InputsTab` (Options pane). Basis: AASHTO LRFD 10th Ed. (2024). Closes two open items of the claude/aashto10-psbeam entry; the item (I) web-width reminder is kept as is (engineer decision 2026-10-19).

### AE5. Corrosion exposure note matches the calculation and Table 5.9.2.3.2b-1   [wording only]
- **Where:** `InputsTab`, anchor `<Fld l="Corrosion exposure"` (≈5569). Calculation unchanged: `computeAll` limits, anchor `srvT:inp.opt.corrosion==='severe'?`.
- **Problem:** the note said "0.19√f′c vs. zero tension". The calculation uses 0.0948√f′c ≤ 0.3 ksi for severe exposure (the Stresses tab and report state this). No tension applies only to unbonded tendons in Table 5.9.2.3.2b-1, which this tool does not model. λ = 1.0 throughout (normal-weight concrete only; the tool warns for lightweight).
- **Governing provision:** AASHTO LRFD 10th Ed. Table 5.9.2.3.2b-1: bonded, not worse than moderate corrosion 0.19λ√f′c ≤ 0.6 ksi; bonded, severe corrosive conditions 0.0948λ√f′c ≤ 0.3 ksi.
- **Before:**
  ```jsx
          <Fld l="Corrosion exposure" sub="sets the Service III tension limit: 0.19√f′c vs. zero tension">
  ```
- **After:**
  ```jsx
          <Fld l="Corrosion exposure" sub="sets the Service III tension limit (Table 5.9.2.3.2b-1, λ = 1.0): moderate 0.19√f′c ≤ 0.6 ksi; severe 0.0948√f′c ≤ 0.3 ksi">
  ```
- **Check:** default f′c = 8.5 ksi: moderate 0.19√8.5 = 0.554 ksi ≤ 0.6 → 0.554; severe 0.0948√8.5 = 0.276 ksi ≤ 0.3 → 0.276. Unchanged before and after (the note only).

### AE6. Release compression note: 0.70 f′ci option of Art. 5.9.2.3.1a   [wording only, 0.65 default unchanged]
- **Where:** `InputsTab`, anchor `<Num l="Release compression limit (× f′ci)"` (≈5568).
- **Problem:** the 10th Ed. article also permits 0.70 f′ci at component extremities where lateral bending (tilt, wind, transport) is explicitly considered; the note did not say so. The tool does not analyse lateral bending at release, so the default stays 0.65; the user can enter 0.70 where that analysis is done.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 5.9.2.3.1a.
- **Before:**
  ```jsx
               sub="0.65 per Art. 5.9.2.3.1a; some owners require 0.60. Blank = 0.65"/>
  ```
- **After:**
  ```jsx
               sub="0.65 per Art. 5.9.2.3.1a (10th Ed.: 0.70 at component extremities where lateral bending (tilt, wind, transport) is included in the analysis); some owners require 0.60. Blank = 0.65"/>
  ```
- **Check:** default `relCfac` 0.65: f′ci = 6.8 ksi → limit 0.65 × 6.8 = 4.42 ksi, before and after.

- **How verified (AE5, AE6):** `computeAll()` of origin/main (ee32a1c) and this branch on the same 9 inputs as AE1 (default, debond cases, γLL = 1.0): every result field, warnings included, identical. `node tests/check-syntax.mjs psbeam.html` passes.
- **Other copies:** none.

## 2026-10-22 — PR: claude/sbd-1-embed (SBD1: GirderDetail renamed to Steel Bridge Design.html and ST-Girder embedded in it; engineer-approved cross-tool rename; PR link added after merge)

### SBD1-a. Shared bootstrap block comment (byte-identical in index.html, psbeam.html, lldf.html)   [comment only]
- **Where:** the bootstrap block's header comment, anchor `This block is byte-identical in index.html / psbeam.html / lldf.html.`
- **Before:**
  ```
     one, edit all three. (ST-Girder left the suite on 2026-10-19; stgirder.html
     keeps only a reduced app-path record of its own, which GirderDetail reads.)
  ```
- **After:**
  ```
     one, edit all three. (ST-Girder left the suite on 2026-10-19; stgirder.html
     keeps only a reduced app-path record of its own. Since 2026-10-22 ST-Girder
     also runs inside Steel Bridge Design.html, GirderDetail's file, as its
     Design & Rating view; GirderDetail no longer reads that record.)
  ```
- **Other copies:** index.html, psbeam.html, lldf.html (same text; the block stays byte-identical). No code changed.

## 2026-10-22 — PR: claude/pbd-0b-label (PBD-B: capacity hand-off labels the flexure method actually used; display/label only, no computed value changed; PR link added after merge)

### PBD-B1. Capacity payload `basis` / `phiFlex` text: approximate f_ps (5.6.3.1.1), not strain compatibility   [label only] [no result change]
- **Where:** `App` → `publishCapacity` (the `bridge-design-capacity` payload, channel `bridgeSuite.v1.capacity`). Anchors: `phi:+fr.phi.toFixed(3), basis:`, `phiIncluded:true, phiFlex:`, `basis:'AASHTO LRFD`.
- **Problem:** the payload said `basis:'strain-compat'` per station, `phiFlex:'per-station (strain-based 0.75–1.0)'` and "φMn per 5.6.3 strain compatibility", but `flexure()` computes f_ps with the approximate Eq. 5.6.3.1.1-1, f_ps = f_pu(1 − k c/d_p), c by Eq. 5.6.3.1.1-3 (flanged) or -4 (rectangular), with the strand force limited by development (5.9.4.3.2). No strain-compatibility analysis (5.6.3.2.5) is made. φ is the 5.5.4.2 value from the net tensile strain ε_t = 0.003(d_t/c − 1), which the old φ text described correctly but ambiguously.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 5.6.3.1.1 (Eqs. 5.6.3.1.1-1 to -4), 5.6.3.2, 5.9.4.3.2, 5.5.4.2.
- **Before:**
  ```js
              phi:+fr.phi.toFixed(3), basis:'strain-compat'});
  ...
          phiIncluded:true, phiFlex:'per-station (strain-based 0.75–1.0)', phiShear:0.9,
  ...
          basis:'AASHTO LRFD — φMn per 5.6.3 strain compatibility with strand development along the transfer/development length; φVn per 5.7.3 MCFT general procedure with trial stirrups; −φMn = deck-reinforced continuity section at the pier (constant).',
  ```
- **After:**
  ```js
              phi:+fr.phi.toFixed(3), basis:'approx-fps'});   // f_ps by the approximate Eq. 5.6.3.1.1-1 (flexure()), not strain compatibility
  ...
          phiIncluded:true, phiFlex:'per-station: 0.75–1.0 from the net tensile strain εt (Art. 5.5.4.2), with c from the approximate fps method (Art. 5.6.3.1.1)', phiShear:0.9,
  ...
          basis:'AASHTO LRFD 10th Ed. — φMn per 5.6.3.2 with fps by the approximate Eq. 5.6.3.1.1-1 (c by Eq. 5.6.3.1.1-3 flanged / 5.6.3.1.1-4 rectangular; not a strain-compatibility analysis), strand force limited by development along the transfer/development length (5.9.4.3.2); φ per 5.5.4.2 from the net tensile strain; φVn per 5.7.3 MCFT general procedure with trial stirrups; −φMn = deck-reinforced continuity section at the pier (constant).',
  ```
- **Check case:** default project: every station's `phiMn_pos`, `phiMn_neg`, `phiVn`, `phi` unchanged (e.g. midspan φM_n and φ as on the Flexure tab); only the three strings above differ.
- **Receivers:** MCT (index.html) stores the payload's top-level `basis` in the design capacity zone when it adopts the payload and shows it on the AASHTO Rating tab as "Basis: …" (zone card). It does not read the station `basis` or `phiFlex`. A zone adopted before this change keeps the old text until the capacity is sent again. index.html is not changed here.
- **How verified:** `node tests/ps-compare.mjs` (origin/main vs this branch, all 31 cases): only `ps.pay.capacity` differs, and only in `basis`, `phiFlex` and the station `basis` strings; `tests/baselines/ps.json` updated for that section.
- **Other copies:** none.

## 2026-10-22 — PR: claude/pbd-1-rename (PBD-C: psbeam.html renamed to Prestressed Bridge Design.html; redirect page with a data download at the old name; engineer decision 2026-10-22; no result change; PR link added after merge)

### PBD-C1. File and log renamed   [rename] [no result change]
- `psbeam.html` → `Prestressed Bridge Design.html` and `fixlog/psbeam.md` → `fixlog/Prestressed Bridge Design.md` (moved with git, content unchanged apart from the lines below).
- Kept: app id `psbeam` (`BridgeApps.boot('psbeam')`, `LOCK_APP`, `APP_ID`, `PS_APP`, `superReactions.by.psbeam`), producer `'PS-Beam'`, every storage key (`psbeam.inputs.v1`, `psbeam.ui.v1`, `psbeam.projects.v1`, `psbeam.inputTab.v1`, `bridgeSuite.v1.*`) and every payload format.
- The shared bootstrap blocks (CLAUDE.md §3) are not touched: they stay byte-identical with index.html and lldf.html. Their comments and the `appPaths` defaults (`DEF.psbeam:'psbeam.html'`, `NAMES.psbeam:'PS-Beam'`) still name psbeam.html. They change with index.html and lldf.html in the MCT-removal PR. Until then the redirect page serves that default path. Once the new file is opened, `BridgeApps.register('psbeam')` records `Prestressed Bridge Design.html` for its folder, and the links use that.

### PBD-C2. Title, header and report name   [display only]
- `<title>`: `PS-Girder | AASHTO LRFD Prestressed Beam Design` → `Prestressed Bridge Design | AASHTO LRFD Prestressed Girder Design`.
- App header (`App`, anchor `<div><h1>`): `PS-Girder <span>/ AASHTO LRFD</span>` → `Prestressed Bridge Design <span>/ AASHTO LRFD</span>`.
- Footer: `PS-GIRDER v2.65 · …` → `PRESTRESSED BRIDGE DESIGN v2.65 · …`.
- Report cover (`ReportTab`, anchor `<section className="psbr-cover">`): `<h1>PS-Girder</h1>` → `<h1>Prestressed Bridge Design</h1>`. Printed page footer (`psbrPageCSS`, anchor `@bottom-left`): `(PS-Girder)` → `(Prestressed Bridge Design)`.
- superReactions sender (`bxSendRx` / `bxExportRx`): `producerFile` changes from `'psbeam.html'` to `'Prestressed Bridge Design.html'`. Receivers do not read it, and `producer` stays `'PS-Beam'`. In the comment of the BXSuperRx glue block, "Only in psbeam.html" becomes "Only in this file (Prestressed Bridge Design.html, psbeam.html until 2026-10-22)".

### PBD-C3. Redirect page `psbeam.html` with "Download my PS-Beam data (JSON)"   [new file] [saved data preserved]
- Self-contained page with no library. It forwards with `location.replace('Prestressed%20Bridge%20Design.html' + search + hash)`.
- Firefox and Safari keep the storage of each `file://` page separate. The design saved by the old psbeam.html (key `psbeam.inputs.v1`) therefore stays in this file's storage. The page stops and offers **Download my PS-Beam data (JSON)** when all four of these hold:
  - that key holds a design;
  - Prestressed Bridge Design has not registered itself in the same storage (`bridgeSuite.v1.appPaths` → `psbeam` → this folder's file is still `psbeam.html`);
  - the page is not in a frame;
  - the offer has not been shown before.
- The download is `JSON.stringify(inputs, null, 1)`, with the file named the way Export JSON names it. This is exactly Export JSON's format, so Prestressed Bridge Design's **Import** reads it unchanged (`mergeInputs`).
- Clicking Download or Open writes `psbeam.redirect.offered.v1` (the time), so the offer shows only once.
- In every other case the page forwards at once: Chrome/Edge shared storage after the new file was opened, no saved design, or inside the MCT frame. Nothing is deleted.

### How verified
- `node tests/ps-compare.mjs --baseline tests/baselines/ps.json --b "Prestressed Bridge Design.html"`: all 31 cases, every section identical to the baseline (the harness normalizes the file name and the display name).
- Redirect from the MCT: the MCT Generator (index.html) opens its PS-Beam frame through `appPaths` (default path `psbeam.html`), and the frame lands in Prestressed Bridge Design. Prestressed Bridge Design announces itself as `psbeam`, so the frame health is "ok". A `#hash` is kept.
- Download: a storage holding a design, with no `appPaths` entry for the new file (as in Firefox), shows the offer. The downloaded file, imported into Prestressed Bridge Design, gives inputs identical to the saved ones. When the new file is already registered, or there is no saved design, the page forwards at once.
- `node tests/check-syntax.mjs "Prestressed Bridge Design.html" psbeam.html`: all scripts pass.
- Shared blocks: compared with origin/main's psbeam.html, the bytes are identical (the diff shows only the lines above).
- **Other copies:** none.

## 2026-10-22 — PR: claude/pbd-2-shell (PBD-D: bridge shell — working modes, module registry, one title block, bridge model psbeam.bridge.v1 with migration, girder × span selector, project Save / Save as / Open / New; engineer decision 2026-10-22; no result change; PR link added after merge)

### PBD-D1. Engines under `window.PBD` (new plain `<script>` block before the JSX)   [new code] [no result change]
- **Where:** new block, anchor `/* ═══ Prestressed Bridge Design — bridge-level engines (window.PBD)`. Nothing in it computes an engineering value.
- `PBD.MODS` (PBD_MODS, the module registry): `{id, label, grp, when?, modes?}` for every tab, same keys, labels and order as the former fixed `TABS` list. `when` keeps Handling and Deck shown only when they are on, as before. `PBD.mods(inp, mode)` filters it. Groups: Girder (Inputs … Anchorage Zone), Analysis (Diagrams, Camber), Details (Handling, Deck), Rating, Tools (Optimize, Compare), Report (Nomenclature, Report). No module is mode-specific yet.
- Bridge model, key **`psbeam.bridge.v1`** (new; project slice **`psbeamBridge`** in `bridgeSuite.v1.projects`):
  `{ v:1, mode:'pl'|'mod', title:{name,by,date,job}, spans:[ft…], nGirders, S, sel:{g,s}, designs:{'G<g>/S<s>': inputs}, projId, src }`.
  - `PBD.migrate(inp)`: first open, built from the saved design (`psbeam.inputs.v1`), changing nothing in it. Spans: `[inp.L]`, or with imported MIDAS demands the member's spans (`externalSpans` rule, duplicated as `PBD.extSpans`) and the selected span `external._selSpan.idx`. Girders: `nGirders`, spacing `S`. Girder: the number in `proj.girderId` ("G3 (Interior)" → 3), else G1 for an exterior position, else G2. Title: `proj` name / by / date / job. Mode: Design modules when MIDAS demands are imported, else Preliminary designer (the Steel Bridge Design rule).
  - The model is held in memory and **written only after a bridge-level action** (mode, girder × span, bridge bar, Save / Save as / Open / New). Opening a design therefore changes nothing that is stored. A stored model carries the project it belongs to (`projId`). When another shared project is open, that project's slice is used, or a model is built from its design.
  - `PBD.fromInputs(b, inp)`: keeps the model in step with the design on screen (the cell's stored copy, the title; in Preliminary designer also the span of the cell, the spacing and the girder count; the imported spans). The inputs are never changed by it.
  - `PBD.select(b, cur, g, s)`: stores the design on screen in its cell and opens another. The target is the cell's stored design, else a copy of the current one. In Preliminary designer the bridge values are applied (`PBD.applyBridge`: span length or imported span, spacing, girder count, position exterior for G1 and Gn else interior, with the design-beam follow turned off when the position changes, girder label, title). In Design modules a new cell gets only its girder label (and its imported span); the title block is shared in both modes.
  - `PBD.edit(b, cur, patch)`: bridge bar edits (spans, girders, spacing). In Preliminary designer the open design follows; other cells follow when opened.
- **psbeam.inputs.v1 is unchanged in key and format** and is still the design on screen; no key is deleted.

### PBD-D2. UI (JSX)   [UI only] [no result change]
- `PbdBridgeBar` (under the title block, outside the tabs): the working mode (Preliminary designer / Design modules, as in Steel Bridge Design), spans (ft, comma-separated; read-only with MIDAS demands), girders, spacing, and the girder × span selector ("Designing G3 (Interior) × Span 1 (120.0 ft)"; • = a stored design).
- Tab strip: built from the registry, with the group names between the tabs (`.pbd-grp` labels; the `.tab` buttons, their labels and order are unchanged).
- Title block: unchanged fields. It is the bridge's one title block: its values are kept in the model and written into every girder design that is opened.
- Project buttons next to the project label: **Open…** (dialog listing the shared projects: name, saved, contents), **Save** (into the open project, else Save as), **Save as…** (uses the formerly unused `saveProjectAs`, plus the `psbeamBridge` slice), **New** (default design and a new bridge model; the open project stays saved; asks first). While a project is open the design (as before) and the model (debounced 400 ms, once written) are saved into it on every change. `adoptProject` also adopts the project's model (`pbdAdopt`).
- CSS: `.pbd-*` rules appended to the style block.

### Check case
Default project, empty storage: the bar reads "Preliminary designer", spans 120, girders 5, spacing 9, "G3 (Interior) × Span 1 (120.0 ft)". No `psbeam.bridge.v1` is written until an action. Choosing G1: the design becomes "G1 (Exterior)", `loads.pos` exterior (design-beam follow off), L = 120, S = 9; returning to G3 restores the stored interior design exactly. Changing the spans to "100, 120" (Preliminary designer, span 1 open): L becomes 100 in the open design.

### How verified
- `node tests/ps-compare.mjs --baseline tests/baselines/ps.json`: all 31 cases, every section identical (inputs, checks, R, warnings, every tab's text, report, payloads, storage).
- Scripted UI checks (scratch): migration values above; select / return round-trip identical; Save as → registry entry with slices `psbeam` and `psbeamBridge`; New → defaults; Open → the saved project's design and model; mode switch keeps the design; storage untouched until the first action; no console errors.
- `node tests/check-syntax.mjs "Prestressed Bridge Design.html"`: all scripts pass.
- **Other copies:** none (Steel Bridge Design's modes and module bar are a different implementation; only the behaviour is mirrored).

## 2026-10-22 — PR: claude/pbd-3-owner (PBD-E: owner selector, Owner Requirements card, owner defaults and checks for RIDOT / MassDOT / CTDOT; engineer decisions 2026-10-22; calculation changes for those owners only, AASHTO unchanged; PR link added after merge)

Owner manuals used (verified in the engineer's reference folder; cited, not reproduced): RIDOT Bridge Design Manual (April 2026), MassDOT LRFD Bridge Manual Part I (Hundredth Anniversary Ed.), CTDOT BRSDM Release 1 (2024) Vol. 2. AASHTO LRFD 10th Ed. (2024) remains the basis. MassDOT and the CTDOT BRSDM are written to the 9th Ed.

### PBD-E0. Framework   [new code] [AASHTO: no result change]
- **Where:** `window.PBD` engine block, anchor `/* ═══ Owner (DOT) profile — PBD-E`. `PBD.OWN_RULES`, in the format of Steel Bridge Design's `OWN_RULES` (`v`, `note`, `owners` with the same four entries, `rules[]` with `owner, id, kind, sec, value, key/lbl/show` for defaults, `nm` for checks, `where`, `text`). `PBD.ownRule(o, id)` has the same body as Steel Bridge Design's `ownRule`. **Copies (CLAUDE.md §3):** Steel Bridge Design.html (GirderDetail `OWN_RULES`, Preliminary sizing `ownRule`), and this file. The rules themselves are prestressed-concrete rules and differ.
- Owner = `inputs.owner` (absent = AASHTO, so no saved design and no AASHTO result changes). It is set in the bridge bar (Owner select, next to the working mode). The bridge is one owner: opening another girder × span gives that design the same owner.
- `PBD.ownApply(inp, owner, DEFAULTS)`: an input still at the previous owner's default (or the tool's default) takes the new owner's default; a value the engineer entered is kept. Kept values are flagged "overrides <manual> <section>: <owner value>" next to the input (Materials: H; Analysis Options: corrosion exposure; continuity card title and restraint switch) and in the card. Changing the owner shows a notice listing what was set and what was kept.
- `PBD.ownLoads(inp)`: η = η_D·η_R·η_I from the owner's yes/no questions (`opt.etaD/etaR/etaI`, default no → 1.00, as GirderDetail's GD46; RIDOT η_D fixed 1.00), and the HL-93 design load multiplier m_LL (`opt.llMult`; RIDOT only). For AASHTO both are 1, and every changed expression multiplies by exactly 1. The node comparison below shows that every AASHTO result is bit-identical.
- **Owner Requirements card** ("Rules" button in the bridge bar): every rule of the owner with its section, a paraphrase, the kind, and how it is applied here (default and value used, check with values and D/C, warning, η questions, multiplier input, sidewalk question, reported requirement). **Report:** new last section "Owner Requirements" (owner other than AASHTO only), where every owner check, the η product and the multiplier are worked. The owner checks link there ("Worked in").
- Worked equations with η or m_LL ≠ 1 show them, in the Flexure (M_u), Shear (V_u), Stresses (Service I / III, deck), pier negative moment, Deck (M_u+, M_u−, overhang) cards, the report, and the Strength I plots. The text is unchanged when the factors are 1.

### PBD-E1. Service III tension limit: severe corrosive conditions (RIDOT BDM 5.6.2; CTDOT BRSDM V2 5.9.2.3.1b; MassDOT Part I 3.7.3.2)   [calc change, owner default] [more conservative]
- **Rule:** default `opt.corrosion = 'severe'` → f_t = 0.0948√f′c ≤ 0.3 ksi (AASHTO Table 5.9.2.3.2b-1) instead of 0.19√f′c ≤ 0.6 ksi. MassDOT 3.7.3.2 gives 0.0948√f′c with no 0.3 ksi cap; the cap governs only above f′c = 10 ksi, outside MassDOT's 6.5 / 8.0 ksi mixes, so the severe setting is used. MassDOT's relaxed 0.19√f′c is allowed by overriding to moderate. A warning then asks for γ_LL = 1.0 at Service III (3.7.3.2) when it is not 1.0.
- **Before / after (defaults fixture, f′c = 8.5 ksi):** f_t 0.19√8.5 = 0.5539 → 0.0948√8.5 = 0.2764 ksi. "Srv III tens" D/C 0.033 → 0.065 (f_b = −0.018 ksi). Service III rating RF (MBE 6A.5.4.1, same f_r) 1.430 → 1.207.
- **Hand check:** √8.5 = 2.9155; 0.19 × 2.9155 = 0.554; 0.0948 × 2.9155 = 0.2764 ksi.

### PBD-E2. Relative humidity H = 80 % (RIDOT BDM 5.6.1)   [calc change, owner default] [less conservative for losses]
- **Rule:** default `mat.H = 80` (tool default 70). It enters γ_h = 1.7 − 0.01H (5.9.3.3), k_hc = 1.56 − 0.008H and k_hs = 2.00 − 0.014H (5.4.2.3).
- **Before / after (defaults, refined losses):** total loss 47.818 → 45.833 ksi; f_pe 154.682 → 156.667 ksi; Srv III bottom −0.018 → 0.000 ksi (D/C 0.033 → 0.000); flexure unchanged (D/C 0.752).
- **Hand check:** k_hs 2.00 − 0.98 = 1.02 → 2.00 − 1.12 = 0.88 (shrinkage × 0.863); k_hc 1.00 → 0.92.

### PBD-E3. HL-93 design load multiplier 1.2 (RIDOT BDM 3.4.1.2)   [calc change, owner default] [more conservative]
- **Rule:** LL+IM × m_LL at Strength I (flexure M_u, shear V_u, interface shear, longitudinal reinforcement 5.7.3.5, pier negative moment, deck M_u) and Service I / III (stresses, deck compression). Not applied to the live load deflection, fatigue or the HL-93 design-load rating (BDM 3.4.1.2: the design check rating is without the multiplier). The capacity hand-off to the MCT carries φM_n and φV_n; φV_n (MCFT) depends on the factored demand, so it follows the multiplier (and η) like the shear check. `opt.llMult`, default 1.2 for RIDOT, editable.
- **Before → after (defaults, `M_u = 1.25DC + 1.50DW + 1.75 m_LL LL`):** M_u,mid 10 251.0 → 11 170.3 k-ft (flexure D/C 0.752 → 0.819). Shear D/C 0.721 → 0.976: V_u 241.2 → 270.6 kip. φV_n changes 334.6 → 277.2 kip because the MCFT ε_s and the governing station follow the larger demand. Srv comp (full) 2.316 → 2.407 ksi. Srv III bottom −0.018 → −0.267 ksi (D/C 0.033 → 0.483). Interface shear D/C 0.455 → 0.502. Long. reinf D/C 0.459 → 0.521. Unchanged: LL deflection 1.182 in, Fatigue I 4.416 ksi, RF_inv 1.737.
- **Hand check (midspan):** 1.75 × 0.2 × M_LL = 0.35 × 2626.6 = 919.3 k-ft → 10 251.0 + 919.3 = 11 170.3 k-ft.

### PBD-E4. Load modifier η (RIDOT BDM 1.3.1–1.3.3; MassDOT Part I 3.1.4.4; CTDOT BRSDM V2 1.3.3–1.3.5; AASHTO 1.3.2.1)   [calc change when answered yes] [more conservative]
- **Rule:** Strength I effects × η = η_D·η_R·η_I. Each factor is 1.05 when its question is answered yes (nonductile; nonredundant; RIDOT ADT ≥ 5000, MassDOT critical/essential, CTDOT NHS/evacuation route); RIDOT η_D is fixed at 1.00. Default no (1.00), so choosing an owner changes nothing until a question is answered. The rating and Service are not multiplied.
- **Before → after (defaults, all yes):** MassDOT/CTDOT η = 1.05³ = 1.157625: M_u 10 251.0 → 11 866.8 k-ft (flexure D/C 0.752 → 0.870), shear D/C 0.721 → 1.119 (FAIL). RIDOT η = 1.00 × 1.05 × 1.05 = 1.1025: M_u 11 301.7 k-ft, flexure D/C 0.829, shear D/C 0.972.
- **Hand check:** 1.157625 × 10 251.0 = 11 866.8 k-ft.

### PBD-E5. Hold-down force ≤ 75 % of the beam weight (MassDOT Part I 3.7.2.2; CTDOT BRSDM V2 5.9.1.6)   [new check] 
- **Rule:** with draped strands, F_hd = 2 n_h f_pbt A_b sin α ≤ 0.75 W, W = w_sw (L + 2 × girder end beyond the bearing). Each draped strand bends at two hold-down points at the jacking stress, so the total is the sum over both points. The existing ≈ 4 kip/strand warning is kept.
- **Values (defaults: n_h = 12, f_pbt = 202.5 ksi, A_b = 0.217 in², slope 52/576 = 0.09028, α = 0.09003 rad):** per strand per point 202.5 × 0.217 × sin α = 3.951 kip; F_hd = 2 × 12 × 3.951 = 94.82 kip; W = 0.82559 × 120 = 99.07 kip; 0.75 W = 74.30 kip → D/C 1.276 FAIL (MassDOT, CTDOT). Before: no such check.

### PBD-E6. Debonded strands ≤ 25 % of all strands (CTDOT BRSDM V2 5.9.4.3.3, supplementing paragraph A)   [new check]
- **Values (debond_harp fixture):** 6 of 42 = 14.3 % ≤ 25 % → D/C 0.571 PASS. Before: no such check (the AASHTO 45 % per row and other 5.9.4.3.3 warnings are unchanged).

### PBD-E7. Concrete strengths   [new checks / warnings]
- RIDOT BDM 5.2.1: f′c ≥ 5.0 ksi (check); f′c > 8.0 ksi needs approval (warning). RIDOT 5.6.1: f′ci limited to approximately 0.70 f′c (warning, "approximately").
- MassDOT Part I 3.7.2.1: f′ci ≤ 0.80 f′c (check). Warnings: deck and box beams at f′c 6.5 ksi (8.0 ksi only to avoid a deeper beam), f′ci generally 4.5 ksi with 6.5 ksi; NEXT beams at f′c 8.0 / f′ci 6.0 ksi.
- CTDOT BRSDM V2 5.9.1.2: 6.0 ≤ f′c ≤ 10.0 ksi; 0.70 f′c ≤ f′ci ≤ 0.80 f′c and f′ci ≤ 6.5 ksi (checks).
- **Values (defaults f′c 8.5, f′ci 6.8 ksi = 0.80 f′c):** RIDOT f′c check D/C 0.588 PASS, warnings for f′ci 0.80 f′c > 0.70 f′c and for f′c > 8.0 ksi. MassDOT f′ci ≤ 6.80 ksi: D/C 1.000 PASS. CTDOT: f′c D/C 0.850 PASS; f′ci 6.8 > 6.5 ksi → D/C 1.046 FAIL.

### PBD-E8. Live load deflection L/1000 with sidewalks (MassDOT Part I 3.5.6.1)   [calc change, MassDOT interior girder]
- **Rule:** typical interior beam: L/1000 with sidewalks (question "Bridge with sidewalks", default no); without sidewalks the limit stays L/800, with a warning above the preferred L/1000. Exterior girder: the tool's L/800 as before. Same deflection (HL-93, no multiplier).
- **Before / after (defaults, sidewalks yes):** limit 120 × 12 / 800 = 1.800 → 1440/1000 = 1.440 in; Δ_LL 1.182 in → D/C 0.657 → 0.821.

### PBD-E9. Continuity (simple spans made continuous)   [owner defaults, check, requirement]
- MassDOT Part I 3.5.1.8: default restraint moments off (neglected for the standard beams). RIDOT BDM 5.6.3.3: default restraint moments off (zero with a girder age ≥ 90 days), new check t_d ≥ 90 days, and the reported requirement φM_n,conn ≥ 1.2 M_cr of the positive moment connection. This tool does not design the connection. M_cr is taken as the tool's positive cracking moment of the connection region, f_r S_b with f_r = 0.24√f′c on the gross girder S_b, as in the restraint check. CTDOT BRSDM V2 5.12.1.1CT: default continuity off (simple spans with a continuous deck); a warning when it is turned on. AASHTO: computed as before.
- **Before / after (cont_restraint fixture):** MassDOT and RIDOT net restraint moment +408.0 k-ft → not computed. The pier negative flexure check is unchanged (D/C 0.970), because the restraint moment is reported and does not enter it. RIDOT age check 90 ≥ 90 days PASS. RIDOT connection: 1.2 × 0.6997 × 14 915 / 12 = 1.2 × 869.7 = 1043.6 k-ft. CTDOT on this fixture: the engineer's continuity is kept (flagged override), with the warning.

### How verified
- Engines in node (scratch: the JSX transpiled with the offline Babel, computeAll of origin/main and of this branch). For all 31 fixtures (AASHTO), `JSON.stringify(computeAll(…))` is identical between origin/main and this branch.
- `node tests/ps-compare.mjs --baseline tests/baselines/ps.json`: the 31 existing cases have every section identical. Six owner fixtures were added (`owner_RIDOT`, `owner_MassDOT_sw`, `owner_CTDOT_debond`, `owner_RIDOT_cont`, `owner_MassDOT_cont`, `owner_CTDOT_deck`). Their A run (origin/main, which ignores the owner) gives the "before" and B the "after", and their baseline is recorded from this branch.
- UI script (scratch): owner select sets the defaults of untouched inputs and keeps entered values (flagged), the card lists the rules, η questions and multiplier change the results, switching back to AASHTO restores the defaults; no console errors.
- `node tests/check-syntax.mjs "Prestressed Bridge Design.html"`: all scripts pass.
