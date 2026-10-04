# Fix log — Concrete Beam Capacity.html

Governing basis used for fixes: ACI 318-19; AASHTO LRFD 10th Ed. (2024); ASD tab: AASHTO Standard Specifications 17th Ed. (2002) Art. 8.15 and MBE Art. 6B.6.2.3. MassDOT values kept as-is.

## 2026-10-04 — PR: claude/fix-concrete-capacity (PR link added after merge)

This file is a 3-tab shell. Each tab is a full app HTML-escaped inside an iframe srcdoc attribute: Beam Capacity (suite-frame-capacity, lines ≈53–4005), ASD Beam Calcs (suite-frame-asd, ≈4008–5040), Development & Splice (suite-frame-dev, ≈5043–6466). All edits were applied by scripted exact-string replacement restricted to the relevant srcdoc, with `&` → `&amp;` and `"` → `&quot;` escaping; each Before block occurs exactly once in its srcdoc. Line endings are CRLF and were preserved. Lines 5287/5289 (base64 images) untouched.

**Capacity tab**

### F1. Compression steel inside the stress block: displaced-concrete correction had the wrong sign   [calc change] [more conservative]
- **Where:** Capacity tab, function `flexure()` (≈ lines 569, 577) and the Flexure-tab derivation (`workFlexure`, ≈ lines 2181, 2199). Anchor: `if(L.d<a) f-=L.As*0.85*fc;`
- **Problem:** `fsOf()` returns a negative stress for compression, so the compression-bar force F is negative. Subtracting 0.85f'c·A's made the compression force larger in magnitude instead of smaller; the bar force was overstated by 2×0.85f'c·A's. Only matters when d' < a.
- **Governing provision:** ACI 318-19 §22.2 (strain compatibility; 22.2.2.4.1 stress block). Same mechanics for AASHTO LRFD 10th Ed. Art. 5.6.2.
- **Escaping:** this code sits inside `srcdoc="…"`, so in the file every `&` is written `&amp;` and every `"` is written `&quot;`. The Before/After text below is the un-escaped source; escape it the same way when re-applying by hand. Line numbers are file lines (≈).
  Edit `flex-eq`:
- **Before:**
  ```js
      C.forEach(L=>{ let f=L.As*fsOf(L.d,c); if(L.d<a) f-=L.As*0.85*fc; net-=f; });
  ```
- **After:**
  ```js
      C.forEach(L=>{ let f=L.As*fsOf(L.d,c); if(L.d<a) f+=L.As*0.85*fc; net-=f; });  /* fs<0 in compression: displaced concrete REDUCES |F| */
  ```
  Edit `flex-mom`:
- **Before:**
  ```js
      if(L.side==='C' && L.d<a){ disp=L.As*0.85*fc; F-=disp; }
  ```
- **After:**
  ```js
      if(L.side==='C' && L.d<a){ disp=L.As*0.85*fc; F+=disp; }  /* F<0 (compression); +disp reduces its magnitude */
  ```
  Edit `rep-disp1`:
- **Before:**
  ```js
      lines:[`F = A_s f_s${gL.disp>0?" - A_s(0.85f'_c)":""} = ${fmt(gL.As)}(${fmt(gL.fs,1)})${gL.disp>0?" - "+fmt(gL.disp,2):""} = ${fmt(gL.F)}\\text{ kip}`,
  ```
- **After:**
  ```js
      lines:[`F = A_s f_s${gL.disp>0?" + A_s(0.85f'_c)":""} = ${fmt(gL.As)}(${fmt(gL.fs,1)})${gL.disp>0?" + "+fmt(gL.disp,2):""} = ${fmt(gL.F)}\\text{ kip}`,
  ```
  Edit `rep-disp2`:
- **Before:**
  ```js
          `F = A'_s f'_s - \\Delta C = ${fmt(L.As)}(${fmt(L.fs,1)}) - ${fmt(L.disp,2)} = ${fmt(L.F)}\\text{ kip}`],
  ```
- **After:**
  ```js
          `F = A'_s f'_s + \\Delta C = ${fmt(L.As)}(${fmt(L.fs,1)}) + ${fmt(L.disp,2)} = ${fmt(L.F)}\\text{ kip}\\quad(f'_s<0\\text{ in compression})`],
  ```
- **Check case:** ACI, rectangular b = 10, h = 24, As = 5.00 in² (5 #9) at d = 21, A's = 1.24 in² (4 #5) at d' = 2.5, f'c = 4, fy = 60 (β1 = 0.85). **Before:** c = 7.712, a = 6.555, Cc = 222.88, F's = 1.24(−58.80) − 4.216 = −77.12 kip, εt = 0.00517 → φ = 0.90 (tension-controlled), Mn = 448.06, φMn = 403.25 k-ft. **After:** c = 7.965, a = 6.770, Cc = 0.85·4·10·6.770 = 230.20, ε's = 0.003(7.965 − 2.5)/7.965 = 0.002058 → f's = 59.69 ksi, F's = 1.24(−59.69) + 4.216 = −69.80 kip; equilibrium 230.20 + 69.80 = 300.0 = 5.00·60 ✓; εt = 0.003(21 − 7.965)/7.965 = 0.00491 → transition φ = 0.8867 (with F2), Mn = **445.52**, φMn = **395.04 k-ft**. AASHTO same section: φ 0.90 → 0.8954, φMn 403.25 → 398.90.
- **How verified:** jsdom: Capacity srcdoc loaded without CDNs; `flexure()`/`phiFlex()` run on the original and edited file (values above); hand equilibrium check.
- **Other copies of this code:** none known (the Beam Capacity app exists only in this file).

### F2. ACI tension-controlled strain limit = εty + 0.003 (was 0.005)   [calc change] [more conservative (significant for Gr 80/100; tiny for Gr 60)]
- **Where:** function `phiFlex()` ACI branch (≈ line 614) and Flexure-tab "Section classification and φ" block. Anchor: `return {phi:0.65+0.25*(et-ety)/(0.005-ety)`
- **Problem:** ACI 318-19 Table 21.2.2 defines tension-controlled as εt ≥ εty + 0.003. The tool used the 318-14 value 0.005, giving φ = 0.90 too early for Gr 80/100. εty = fy/Es is used (as the tool already did for the compression-controlled limit).
- **Governing provision:** ACI 318-19 Table 21.2.2 and §21.2.2.1.
- **Escaping:** this code sits inside `srcdoc="…"`, so in the file every `&` is written `&amp;` and every `"` is written `&quot;`. The Before/After text below is the un-escaped source; escape it the same way when re-applying by hand. Line numbers are file lines (≈).
  Edit `phi-aci`:
- **Before:**
  ```js
    if(et>=0.005) return {phi:0.90,cls:"Tension Controlled"};
    if(et<=ety)   return {phi:0.65,cls:"Compression Controlled"};
    return {phi:0.65+0.25*(et-ety)/(0.005-ety),cls:"Transition"};
  ```
- **After:**
  ```js
    const etl=ety+0.003;   /* ACI 318-19 Table 21.2.2: tension-controlled limit eps_ty + 0.003 (was 0.005) */
    if(et>=etl) return {phi:0.90,cls:"Tension Controlled"};
    if(et<=ety)   return {phi:0.65,cls:"Compression Controlled"};
    return {phi:0.65+0.25*(et-ety)/(etl-ety),cls:"Transition"};
  ```
  Edit `phi-disp`:
- **Before:**
  ```js
      lines:[`\\varepsilon_t = ${fmt(F.eps_t,5)} \\;\\Rightarrow\\; \\text{${r.pf.cls}}`,
        `\\phi = ${fmt(r.pf.phi,3)}`],
  ```
- **After:**
  ```js
      lines:[...(S.code==='ACI'?[`\\varepsilon_{tl} = \\varepsilon_{ty}+0.003 = ${fmt(fy/ES,5)}+0.003 = ${fmt(fy/ES+0.003,5)}`]:[]),
        `\\varepsilon_t = ${fmt(F.eps_t,5)} \\;\\Rightarrow\\; \\text{${r.pf.cls}}`,
        `\\phi = ${fmt(r.pf.phi,3)}`],
  ```
- **Check case:** Gr 80: b = 12, h = 24, 4 #9 (As = 4.00) at d = 21.44, f'c = 5: εt = 0.00520, εty = 80/29,000 = 0.002759, εtl = 0.005759 → before φ = 0.90, φMn = 439.17; after φ = 0.65 + 0.25(0.00520 − 0.002759)/0.003 = **0.8534**, φMn = **416.42 k-ft** (−5.2%). Gr 60: εty = 0.002069, εtl = 0.005069 (was 0.005). Example 5 #9 at d = 21.44, f'c = 4: εt = 0.00443 → φ 0.8517 → **0.8471**, φMn 378.16 → 376.10. Gr 60 sections with εt ≥ 0.005069 unchanged.
- **How verified:** jsdom runs of `flexure()`/`phiFlex()` before/after.
- **Other copies of this code:** none known (the Beam Capacity app exists only in this file).

### F3. AASHTO: "εt ≥ 0.004 (AASHTO 5.6.2.1)" check made advisory (removed from pass/fail)   [display / check scope] [LESS conservative (an AASHTO section can no longer FAIL on this)]
- **Where:** function `detailing()`, check `dEpsMin` (≈ line 944). Anchor: `add("dEpsMin","Minimum net tensile strain"`
- **Problem:** AASHTO LRFD has no minimum net tensile strain for nonprestressed members (the 0.004 limit was removed in 2005; ductility is handled through φ, 5.5.4.2). The tool cited a non-existent "AASHTO 5.6.2.1" requirement and could fail a section on it.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 5.5.4.2 (φ varies with εt); no εt minimum in Art. 5.6.2.1. ACI branch unchanged (318-19 §9.3.3.1, see open items).
- **Escaping:** this code sits inside `srcdoc="…"`, so in the file every `&` is written `&amp;` and every `"` is written `&quot;`. The Before/After text below is the un-escaped source; escape it the same way when re-applying by hand. Line numbers are file lines (≈).
  Edit `det-eps`:
- **Before:**
  ```js
    add("dEpsMin","Minimum net tensile strain",code==='ACI'?"ACI 9.3.3.1":"AASHTO 5.6.2.1",
      F.eps_t,0.004,"\\ge","",F.eps_t>=0.004,
      [["\\varepsilon_t\\ge 0.004","\\varepsilon_t="+fmt(F.eps_t,5)+"\\ge 0.00400",
        "Limits the reinforcement ratio so the section fails in a ductile manner."]]);
  ```
- **After:**
  ```js
    /* ACI 9.3.3.1 beam minimum strain. AASHTO LRFD has no minimum net tensile strain for nonprestressed
       members (ductility is handled through phi, 5.5.4.2), so for AASHTO this is ADVISORY only (N/A in pass/fail). */
    add("dEpsMin","Minimum net tensile strain",code==='ACI'?"ACI 9.3.3.1":"Advisory (no AASHTO limit)",
      F.eps_t,0.004,"\\ge","",F.eps_t>=0.004,
      [["\\varepsilon_t\\ge 0.004","\\varepsilon_t="+fmt(F.eps_t,5)+(F.eps_t>=0.004?"\\ge":"<")+" 0.00400",
        "Limits the reinforcement ratio so the section fails in a ductile manner."]],
      code!=='ACI',
      code!=='ACI'?"Advisory only \u2014 AASHTO LRFD has no minimum net tensile strain for nonprestressed members; ductility is handled through \u03c6 (Art. 5.5.4.2). For reference \u03b5_t = "+fmt(F.eps_t,5)+(F.eps_t>=0.004?" \u2265 ":" < ")+"0.004.":"");
  ```
- **Check case:** AASHTO, section of F1: `dEpsMin` before: ref "AASHTO 5.6.2.1", na = false, counted in pass/fail; after: ref "Advisory (no AASHTO limit)", na = true, note shows εt = 0.00491 ≥ 0.004. A section with εt = 0.0035 under AASHTO: before → FAIL row in the detailing envelope; after → N/A (advisory text shows "< 0.004"). ACI: unchanged.
- **How verified:** jsdom: `computeAll()` row `det` inspected; Detailing tab renders the advisory text.
- **Other copies of this code:** none known (the Beam Capacity app exists only in this file).

### F4. AASHTO concrete modulus: Eq. 5.4.2.4-1 (120,000·K1·wc²·f'c^0.33)   [calc change] [slightly LESS conservative for AASHTO crack-control f_ss]
- **Where:** function `concreteE()` (≈ line 789). Anchor: `Ec:33000*Math.pow(wc,1.5)*Math.sqrt(fc)`
- **Problem:** The pre-8th-Edition expression 33,000·K1·wc^1.5·√f'c was used.
- **Governing provision:** AASHTO LRFD 10th Ed. Eq. 5.4.2.4-1, Ec = 120,000 K1 wc^2.0 f'c^0.33 (ksi, kcf), K1 = 1.0, wc = 0.145 kcf (fixed in the tool).
- **Escaping:** this code sits inside `srcdoc="…"`, so in the file every `&` is written `&amp;` and every `"` is written `&quot;`. The Before/After text below is the un-escaped source; escape it the same way when re-applying by hand. Line numbers are file lines (≈).
  Edit `ec`:
- **Before:**
  ```js
      return {Ec:33000*Math.pow(wc,1.5)*Math.sqrt(fc), ref:"AASHTO 5.4.2.4",
              expr:`E_c = 33{,}000\\,K_1 w_c^{1.5}\\sqrt{f'_c} = 33{,}000(1.0)(${fmt(wc,3)})^{1.5}\\sqrt{${fmt(fc)}}`};
  ```
- **After:**
  ```js
      return {Ec:120000*1.0*Math.pow(wc,2.0)*Math.pow(fc,0.33), ref:"AASHTO Eq. 5.4.2.4-1",   /* K1 = 1.0 */
              expr:`E_c = 120{,}000\\,K_1 w_c^{2.0}f'^{\\,0.33}_c = 120{,}000(1.0)(${fmt(wc,3)})^{2.0}(${fmt(fc)})^{0.33}`};
  ```
- **Check case:** f'c = 4 ksi: before 33,000(0.145)^1.5(√4) = **3,644 ksi**; after 120,000(1.0)(0.145)²(4)^0.33 = 2,523 × 1.5801 = **3,987 ksi** (+9.4%). Default section (b = 12, h = 18, 3 #5 at d = 15.19), M_s = 40 k-ft: n 7.958 → 7.274, kd 3.651 → 3.528 in., I_cr 1,184 → 1,098 in⁴, f_ss 37.21 → **37.07 ksi**. Only the AASHTO service/crack-control path uses this (ACI path unchanged).
- **How verified:** jsdom: `concreteE()` and `serviceSteelStress(false,40)` before/after; hand calc.
- **Other copies of this code:** none known (the Beam Capacity app exists only in this file).

### F5. AASHTO shear: β uses 51/(39 + sxe) when Av < Av,min; |Mu| ≥ |Vu|·dv in εs; λ in Vc; φ = 0.80 for lightweight   [calc change] [more conservative (no/light stirrups, near supports, lightweight)]
- **Where:** function `shear()` AASHTO branch (≈ lines 630–645), Shear-tab derivation (`workShear`), detailing `dStirS`/`dAvMin` (≈ lines 977–1039), spacing chart (≈ line 3451). Anchor: `beta=4.8/(1+750*eps_s);`
- **Problem:** (a) β = 4.8/(1+750εs) was used even without minimum transverse reinforcement (Eq. 5.7.3.4.2-2 needs ×51/(39+sxe)); (b) |Mu| was not floored at |Vu|dv, under-estimating εs near supports; (c) λ was missing from Vc and Av,min; (d) φ was 0.90 even for lightweight concrete. All unconservative.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 5.7.3.4.2 (Eqs. 5.7.3.4.2-1, -2, -4, -7), Eq. 5.7.3.3-3 (Vc with λ), Eq. 5.7.2.5-1 (Av,min with λ), Art. 5.5.4.2 (φ shear 0.90 NW / 0.80 LW). Assumptions: sx = dv (no intermediate crack-control layers modelled); ag = 0 when f'c > 10 ksi (conservative); lightweight ⇔ λ < 1.
- **Escaping:** this code sits inside `srcdoc="…"`, so in the file every `&` is written `&amp;` and every `"` is written `&quot;`. The Before/After text below is the un-escaped source; escape it the same way when re-applying by hand. Line numbers are file lines (≈).
  Edit `shear-aashto`:
- **Before:**
  ```js
    if(S.code==='AASHTO'){
      const phi=0.90;
      let beta=2.0,theta=45,eps_s=null;
      if(F.As>0 && (Mu>0||Vu>0)){
        eps_s=((Mu*12)/dv + Vu)/(ES*F.As);
        eps_s=Math.max(0,Math.min(0.006,eps_s));
        beta=4.8/(1+750*eps_s);
        theta=29+3500*eps_s;
      }
      const Vc=0.0316*beta*Math.sqrt(fc)*bw*dv;
      const Vs=S.stir.present? Av*fyt*dv/Math.tan(theta*Math.PI/180)/s : 0;
      const Vlim=0.25*fc*bw*dv;
      const Vn=Math.min(Vc+Vs,Vlim);
      return {phi,d,dv,Av,s,beta,theta,eps_s,Vc,Vs,Vlim,Vn,phiVn:phi*Vn,
              governed:(Vc+Vs)>Vlim,method:'AASHTO sectional'};
    }
  ```
- **After:**
  ```js
    if(S.code==='AASHTO'){
      const phi = lam<1 ? 0.80 : 0.90;   /* 5.5.4.2: shear 0.90 normal weight, 0.80 lightweight */
      let beta=2.0,theta=45,eps_s=null,beta0=2.0,sxeF=1.0,MuUse=Mu;
      /* Eq. 5.7.2.5-1: Av,min = 0.0316 lambda sqrt(f'c) bv s / fy */
      const avMinA = s>0 ? 0.0316*lam*Math.sqrt(fc)*bw*s/fyt : 0;
      const hasAvMin = S.stir.present && s>0 && Av>=avMinA-1e-12;
      /* Eq. 5.7.3.4.2-7 crack spacing parameter, used only without Av,min. sx taken as dv (no
         intermediate crack-control layers modelled); ag taken as 0 for f'c > 10 ksi (conservative). */
      const sx=dv, ag=(fc>10?0:(S.mat.dagg||0));
      const sxe=Math.max(12,Math.min(80,sx*1.38/(ag+0.63)));
      if(F.As>0 && (Mu>0||Vu>0)){
        MuUse=Math.max(Math.abs(Mu),Math.abs(Vu)*dv/12);   /* 5.7.3.4.2: |Mu| not less than |Vu|dv (k-ft) */
        eps_s=((MuUse*12)/dv + Math.abs(Vu))/(ES*F.As);
        eps_s=Math.max(0,Math.min(0.006,eps_s));
        beta0=4.8/(1+750*eps_s);
        sxeF=hasAvMin?1.0:51/(39+sxe);                    /* Eq. 5.7.3.4.2-1 (with Av,min) / -2 (without) */
        beta=beta0*sxeF;
        theta=29+3500*eps_s;
      }
      const Vc=0.0316*beta*lam*Math.sqrt(fc)*bw*dv;       /* Eq. 5.7.3.3-3 */
      const Vs=S.stir.present? Av*fyt*dv/Math.tan(theta*Math.PI/180)/s : 0;
      const Vlim=0.25*fc*bw*dv;
      const Vn=Math.min(Vc+Vs,Vlim);
      return {phi,d,dv,Av,s,beta,beta0,sxeF,sx,ag,sxe,hasAvMin,avMinA,MuUse,theta,eps_s,Vc,Vs,Vlim,Vn,phiVn:phi*Vn,
              governed:(Vc+Vs)>Vlim,method:'AASHTO sectional'};
    }
  ```
  Edit `rep-eps`:
- **Before:**
  ```js
          lines:[`\\varepsilon_s = \\dfrac{|M_u|/d_v + |V_u|}{E_s A_s}`,
            `|M_u| = ${fmt(Math.abs(r.Mu))}\\text{ k-ft}\\times 12\\;\\text{in/ft} = ${fmt(Math.abs(r.Mu)*12)}\\text{ k-in}`,
            `\\varepsilon_s = \\dfrac{\\dfrac{${fmt(Math.abs(r.Mu)*12)}\\text{ k-in}}{${fmt(sh.dv)}\\text{ in}} + ${fmt(Math.abs(r.Vu))}\\text{ kip}}{29000\\text{ ksi}\\;(${fmt(r.F.As)}\\text{ in}^2)} = ${fmt(sh.eps_s,6)}`],
  ```
- **After:**
  ```js
          lines:[`\\varepsilon_s = \\dfrac{|M_u|/d_v + |V_u|}{E_s A_s},\\qquad |M_u| \\ge |V_u|\\,d_v`,
            `|M_u| = \\max\\left(${fmt(Math.abs(r.Mu))},\\;\\dfrac{${fmt(Math.abs(r.Vu))}(${fmt(sh.dv)})}{12}\\right) = ${fmt(sh.MuUse)}\\text{ k-ft}\\times 12\\;\\text{in/ft} = ${fmt(sh.MuUse*12)}\\text{ k-in}`,
            `\\varepsilon_s = \\dfrac{\\dfrac{${fmt(sh.MuUse*12)}\\text{ k-in}}{${fmt(sh.dv)}\\text{ in}} + ${fmt(Math.abs(r.Vu))}\\text{ kip}}{29000\\text{ ksi}\\;(${fmt(r.F.As)}\\text{ in}^2)} = ${fmt(sh.eps_s,6)}`],
  ```
  Edit `rep-beta`:
- **Before:**
  ```js
          lines:[`\\beta = \\dfrac{4.8}{1+750\\varepsilon_s} = \\dfrac{4.8}{1+750(${fmt(sh.eps_s,6)})} = ${fmt(sh.beta,3)}`,
  ```
- **After:**
  ```js
          lines:[...(sh.hasAvMin
              ? [`\\beta = \\dfrac{4.8}{1+750\\varepsilon_s} = \\dfrac{4.8}{1+750(${fmt(sh.eps_s,6)})} = ${fmt(sh.beta,3)}\\quad(A_v \\ge A_{v,min})`]
              : [`A_v ${S.stir.present?"= "+fmt(sh.Av,3)+" < A_{v,min} = "+fmt(sh.avMinA,3)+"\\text{ in}^2":"= 0"}\\;\\Rightarrow\\;\\text{Eq. 5.7.3.4.2-2}`,
                 `s_{xe} = \\dfrac{1.38\\,s_x}{a_g+0.63} = \\dfrac{1.38(${fmt(sh.sx)})}{${fmt(sh.ag,2)}+0.63},\\;12 \\le s_{xe} \\le 80 \\;\\Rightarrow\\; ${fmt(sh.sxe)}\\text{ in}\\quad(s_x = d_v)`,
                 `\\beta = \\dfrac{4.8}{1+750\\varepsilon_s}\\cdot\\dfrac{51}{39+s_{xe}} = ${fmt(sh.beta0,3)}\\times\\dfrac{51}{39+${fmt(sh.sxe)}} = ${fmt(sh.beta,3)}`]),
  ```
  Edit `rep-vc`:
- **Before:**
  ```js
        lines:[`V_c = 0.0316\\,\\beta\\sqrt{f'_c}\\,b_v d_v`,
          `V_c = 0.0316(${fmt(sh.beta,3)})\\sqrt{${fmt(fc)}\\text{ ksi}}(${fmt(bw)}\\text{ in})(${fmt(sh.dv)}\\text{ in}) = ${fmt(sh.Vc)}\\text{ kip}`],
  ```
- **After:**
  ```js
        lines:[`V_c = 0.0316\\,\\beta\\lambda\\sqrt{f'_c}\\,b_v d_v`,
          `V_c = 0.0316(${fmt(sh.beta,3)})(${fmt(S.mat.lambda,2)})\\sqrt{${fmt(fc)}\\text{ ksi}}(${fmt(bw)}\\text{ in})(${fmt(sh.dv)}\\text{ in}) = ${fmt(sh.Vc)}\\text{ kip}`],
  ```
  Edit `det-vu`:
- **Before:**
  ```js
        const vu=(Vu||0)/(0.9*bw*sh.dv);
        const tight=vu>=0.125*fc;
  ```
- **After:**
  ```js
        const vu=(Vu||0)/(sh.phi*bw*sh.dv);
        const tight=vu>=0.125*fc;
  ```
  Edit `det-vu-disp`:
- **Before:**
  ```js
          `v_u=\\dfrac{${fmt(Vu||0)}}{0.9(${fmt(bw)})(${fmt(sh.dv)})}=${fmt(vu,3)}\\text{ ksi}
  ```
- **After:**
  ```js
          `v_u=\\dfrac{${fmt(Vu||0)}}{${fmt(sh.phi,2)}(${fmt(bw)})(${fmt(sh.dv)})}=${fmt(vu,3)}\\text{ ksi}
  ```
  Edit `det-avmin-a`:
- **Before:**
  ```js
        avMin=0.0316*Math.sqrt(fc)*bw/fyt;
        dv3=[["\\left(\\dfrac{A_v}{s}\\right)_{min}=0.0316\\sqrt{f'_c}\\dfrac{b_v}{f_y}",
          `0.0316\\sqrt{${fmt(fc)}}\\dfrac{${fmt(bw)}}{${fmt(fyt)}}=${fmt(avMin,4)}\\text{ in}^2/\\text{in}`,"f′c and fy in ksi."],
  ```
- **After:**
  ```js
        avMin=0.0316*S.mat.lambda*Math.sqrt(fc)*bw/fyt;   /* Eq. 5.7.2.5-1 with lambda */
        dv3=[["\\left(\\dfrac{A_v}{s}\\right)_{min}=0.0316\\lambda\\sqrt{f'_c}\\dfrac{b_v}{f_y}",
          `0.0316(${fmt(S.mat.lambda,2)})\\sqrt{${fmt(fc)}}\\dfrac{${fmt(bw)}}{${fmt(fyt)}}=${fmt(avMin,4)}\\text{ in}^2/\\text{in}`,"f′c and fy in ksi."],
  ```
  Edit `det-phiV`:
- **Before:**
  ```js
      const phiV   = code==='ACI' ? 0.75 : 0.9;
  ```
- **After:**
  ```js
      const phiV   = code==='ACI' ? 0.75 : sh.phi;
  ```
  Edit `det-avmin-b`:
- **Before:**
  ```js
        avMin0=0.0316*Math.sqrt(fc)*bw/fyt;
        avMinLine=["\\left(\\dfrac{A_v}{s}\\right)_{min}=0.0316\\sqrt{f'_c}\\dfrac{b_v}{f_y}",
          `0.0316\\sqrt{${fmt(fc)}}\\dfrac{${fmt(bw)}}{${fmt(fyt)}}=${fmt(avMin0,4)}\\text{ in}^2/\\text{in}`,"f′c and f_y in ksi."];
  ```
- **After:**
  ```js
        avMin0=0.0316*S.mat.lambda*Math.sqrt(fc)*bw/fyt;   /* Eq. 5.7.2.5-1 with lambda */
        avMinLine=["\\left(\\dfrac{A_v}{s}\\right)_{min}=0.0316\\lambda\\sqrt{f'_c}\\dfrac{b_v}{f_y}",
          `0.0316(${fmt(S.mat.lambda,2)})\\sqrt{${fmt(fc)}}\\dfrac{${fmt(bw)}}{${fmt(fyt)}}=${fmt(avMin0,4)}\\text{ in}^2/\\text{in}`,"f′c and f_y in ksi."];
  ```
  Edit `chart-phi`:
- **Before:**
  ```js
        const vu=Math.abs(gov.Vu)/(0.9*bw*sh.dv);
  ```
- **After:**
  ```js
        const vu=Math.abs(gov.Vu)/(sh.phi*bw*sh.dv);
  ```
- **Check case:** AASHTO, b = 12, h = 30, 4 #8 (As = 3.16) at d = 27.5 (27.0 with #4 stirrups) → dv = 25.18 in. (24.68 with stirrups), f'c = 4, ag = 1.0 in., Vu = 40 kip. **No stirrups, Mu = 150 k-ft:** εs = (150·12/25.18 + 40)/(29,000·3.16) = 0.001216; β0 = 4.8/(1+750·0.001216) = 2.510; sxe = 1.38·25.18/(1.0+0.63) = 21.32 in.; factor 51/(39+21.32) = 0.8455 → β = **2.122** (before 2.510); Vc = 0.0316·2.122·1.0·√4·12·25.18 = **40.52 kip** (before 47.92); φVn 43.13 → 36.47. **No stirrups, Mu = 0:** |Mu| floored to 40·25.18/12 = 83.9 k-ft → εs 0.00044 → 0.00087, β 3.616 → 2.453, Vc 69.05 → 46.83, φVn 62.14 → 42.15. **#4 2-leg @ 12 in. (Av = 0.40 ≥ Av,min = 0.0316·√4·12·12/60 = 0.152):** unchanged (β 2.494, φVn 109.60). **λ = 0.75, #4 @ 12:** φ 0.90 → 0.80, Vc 46.68 → 35.01, φVn 109.60 → **88.08 kip**; Av,min 0.152 → 0.114 in² (less conservative for the Av,min check, per Eq. 5.7.2.5-1).
- **How verified:** jsdom runs of `shear()` before/after for each case; Shear tab renders Eq. 5.7.3.4.2-2 and s_xe lines.
- **Other copies of this code:** none known (the Beam Capacity app exists only in this file).

### F6. ACI: √f'c ≤ 100 psi for Vc without Av,min (22.5.3.1) and for Tth/Tcr (22.7.2.1)   [calc change] [more conservative for Vc; for compatibility torsion the reduced design torque φTcr is lower]
- **Where:** `shear()` ACI `Vc_c` (≈ line 658), `torsion()` Tth/Tcr (≈ lines 686–687), Shear/Torsion tab derivations. Anchor: `const Vc_c=8*lam_s*lam*Math.cbrt`
- **Problem:** √f'c was not capped at 100 psi in the size-effect Vc (the no-Av,min case) or in Tth/Tcr. Matters only for f'c > 10 ksi. Vc with Av ≥ Av,min (row a) remains uncapped, as permitted by 22.5.3.2.
- **Governing provision:** ACI 318-19 §22.5.3.1 (and 22.5.3.2), §22.7.2.1.
- **Escaping:** this code sits inside `srcdoc="…"`, so in the file every `&` is written `&amp;` and every `"` is written `&quot;`. The Before/After text below is the un-escaped source; escape it the same way when re-applying by hand. Line numbers are file lines (≈).
  Edit `vc-cap`:
- **Before:**
  ```js
    const Vc_c=8*lam_s*lam*Math.cbrt(Math.max(rho_w,1e-9))*rt*bw*d/1000;
  ```
- **After:**
  ```js
    const Vc_c=8*lam_s*lam*Math.cbrt(Math.max(rho_w,1e-9))*Math.min(rt,100)*bw*d/1000;  /* 22.5.3.1: sqrt(f'c) <= 100 psi without Av,min */
  ```
  Edit `tor-cap`:
- **Before:**
  ```js
    const Tth=1.0*lam*rt*(Acp*Acp/pcp)/1000;         /* k-in, 22.7.4.1 */
    const Tcr=4.0*lam*rt*(Acp*Acp/pcp)/1000;         /* k-in, 22.7.5.1 */
  ```
- **After:**
  ```js
    const rtT=Math.min(rt,100);                      /* 22.7.2.1: sqrt(f'c) <= 100 psi for Tth, Tcr */
    const Tth=1.0*lam*rtT*(Acp*Acp/pcp)/1000;        /* k-in, 22.7.4.1 */
    const Tcr=4.0*lam*rtT*(Acp*Acp/pcp)/1000;        /* k-in, 22.7.5.1 */
  ```
  Edit `rep-vcc`:
- **Before:**
  ```js
            `V_c = 8\\lambda_s\\lambda(\\rho_w)^{1/3}\\sqrt{f'_c}\\,b_w d = 8(${fmt(sh.lam_s,3)})(${fmt(S.mat.lambda,2)})(${fmt(sh.rho_w,5)})^{1/3}\\sqrt{${fmt(fc*1000,0)}\\text{ psi}}
  ```
- **After:**
  ```js
            `V_c = 8\\lambda_s\\lambda(\\rho_w)^{1/3}\\sqrt{f'_c}\\,b_w d = 8(${fmt(sh.lam_s,3)})(${fmt(S.mat.lambda,2)})(${fmt(sh.rho_w,5)})^{1/3}${sqrtfc_psi(fc)>100?"(100\\text{ psi, max per 22.5.3.1})":"\\sqrt{"+fmt(fc*1000,0)+"\\text{ psi}}"}
  ```
  Edit `rep-tth`:
- **Before:**
  ```js
        `T_{th} = ${fmt(S.mat.lambda,2)}\\sqrt{${fmt(fc*1000,0)}\\text{ psi}}\\left(
  ```
- **After:**
  ```js
        `T_{th} = ${fmt(S.mat.lambda,2)}${sqrtfc_psi(fc)>100?"(100\\text{ psi, max per 22.7.2.1})":"\\sqrt{"+fmt(fc*1000,0)+"\\text{ psi}}"}\\left(
  ```
- **Check case:** ACI, b = 12, h = 24, 3 #8 at d = 21.5, f'c = 12 ksi (√f'c = 109.5 psi), no stirrups, Vu = 20: Vc_c 37.73 → **34.44 kip** (×100/109.5), φVn 28.30 → 25.83. With Av ≥ Av,min: Vc = 55.21 kip unchanged. Torsion (Acp = 288 in², pcp = 72 in.): Tth 10.52 → **9.60 k-ft**, Tcr 42.07 → **38.40 k-ft**. f'c ≤ 10 ksi: unchanged.
- **How verified:** jsdom runs of `shear()`/`torsion()` before/after.
- **Other copies of this code:** none known (the Beam Capacity app exists only in this file).

### F7. ACI: fyt ≤ 60 ksi for shear and torsion design   [calc change] [more conservative when fyt > 60 ksi is entered]
- **Where:** new helper `fytDesign()` (after `sqrtfc_psi`), used in `shear()`, `torsion()`, `detailing()`, `computeAll()` (shared stirrup), `workShear()`, `workTorsion()`; new validation warning. Anchor: `function fytDesign()`
- **Problem:** A user entering fyt = 80 ksi got Vs, Tn and Av,min computed with 80 ksi.
- **Governing provision:** ACI 318-19 Table 20.2.2.4(a) (deformed bars, shear and torsion: 60 ksi). AASHTO path unchanged (see open items).
- **Escaping:** this code sits inside `srcdoc="…"`, so in the file every `&` is written `&amp;` and every `"` is written `&quot;`. The Before/After text below is the un-escaped source; escape it the same way when re-applying by hand. Line numbers are file lines (≈).
  Edit `fyt-helper`:
- **Before:**
  ```js
  function sqrtfc_psi(fc){ return Math.sqrt(fc*1000); }
  ```
- **After:**
  ```js
  function sqrtfc_psi(fc){ return Math.sqrt(fc*1000); }
  /* ACI 318-19 Table 20.2.2.4(a): fyt used for shear and torsion design <= 60 ksi (deformed bars).
     AASHTO: input value used as entered. */
  function fytDesign(){ return S.code==='ACI' ? Math.min(S.mat.fyt,60) : S.mat.fyt; }
  ```
  Edit `shear-hdr`:
- **Before:**
  ```js
  function shear(F,Mu,Vu,sOv){
    const {bw,h}=S.sec, fc=S.mat.fc, fy=S.mat.fy, fyt=S.mat.fyt, lam=S.mat.lambda;
  ```
- **After:**
  ```js
  function shear(F,Mu,Vu,sOv){
    const {bw,h}=S.sec, fc=S.mat.fc, fy=S.mat.fy, fyt=fytDesign(), lam=S.mat.lambda;
  ```
  Edit `tor-hdr`:
- **Before:**
  ```js
    if(!S.tor.present || S.code!=='ACI') return null;
    const {bw,h}=S.sec, fc=S.mat.fc, fy=S.mat.fy, fyt=S.mat.fyt, lam=S.mat.lambda;
  ```
- **After:**
  ```js
    if(!S.tor.present || S.code!=='ACI') return null;
    const {bw,h}=S.sec, fc=S.mat.fc, fy=S.mat.fy, fyt=fytDesign(), lam=S.mat.lambda;
  ```
  Edit `det-hdr`:
- **Before:**
  ```js
    const {bw,h}=S.sec, fc=S.mat.fc, fy=S.mat.fy, fyt=S.mat.fyt, dagg=S.mat.dagg;
  ```
- **After:**
  ```js
    const {bw,h}=S.sec, fc=S.mat.fc, fy=S.mat.fy, fyt=fytDesign(), dagg=S.mat.dagg;
  ```
  Edit `share-fyt`:
- **Before:**
  ```js
        const Vs_left=av_left*S.mat.fyt*sh.d;
  ```
- **After:**
  ```js
        const Vs_left=av_left*fytDesign()*sh.d;
  ```
  Edit `val-fyt`:
- **Before:**
  ```js
    if(fy>75 && S.code==='AASHTO') W.push({code:"AASHTO 5.4.3.1",msg:`f_y = ${fmt(fy)} ksi exceeds the 75 ksi AASHTO limit for most applications.`});
  ```
- **After:**
  ```js
    if(fy>75 && S.code==='AASHTO') W.push({code:"AASHTO 5.4.3.1",msg:`f_y = ${fmt(fy)} ksi exceeds the 75 ksi AASHTO limit for most applications.`});
    if(S.mat.fyt>60 && S.code==='ACI') W.push({code:"ACI 20.2.2.4",msg:`f_yt = ${fmt(S.mat.fyt)} ksi exceeds 60 ksi. Shear and torsion are computed with f_yt = 60 ksi (ACI Table 20.2.2.4(a)).`});
  ```
  Edit `rep-sh-hdr`:
- **Before:**
  ```js
    const sh=r.sh, fc=S.mat.fc, bw=S.sec.bw, fyt=S.mat.fyt;
  ```
- **After:**
  ```js
    const sh=r.sh, fc=S.mat.fc, bw=S.sec.bw, fyt=fytDesign();
  ```
  Edit `rep-tor-hdr`:
- **Before:**
  ```js
    const fc=S.mat.fc, fy=S.mat.fy, fyt=S.mat.fyt, bw=S.sec.bw, h=S.sec.h, cc=S.cover.cc, ds=stirDia();
  ```
- **After:**
  ```js
    const fc=S.mat.fc, fy=S.mat.fy, fyt=fytDesign(), bw=S.sec.bw, h=S.sec.h, cc=S.cover.cc, ds=stirDia();
  ```
  Edit `rep-tor-fyt1`:
- **Before:**
  ```js
  (${fmt(S.mat.fyt)}\\text{ ksi})(${fmt(T.cot,3)})
  ```
- **After:**
  ```js
  (${fmt(fyt)}\\text{ ksi})(${fmt(T.cot,3)})
  ```
  Edit `rep-tor-fyt2`:
- **Before:**
  ```js
  (${fmt(S.mat.fyt)}\\text{ ksi})(${fmt(r.sh.d)}
  ```
- **After:**
  ```js
  (${fmt(fyt)}\\text{ ksi})(${fmt(r.sh.d)}
  ```
- **Check case:** ACI, b = 12, d = 21, f'c = 4, #4 2-leg @ 8 in. (Av = 0.40), fyt = 80: Vs = 0.40·80·21/8 = 84.0 → 0.40·60·21/8 = **63.0 kip**; φVn 86.91 → **71.16 kip**; (Av/s)min = max(0.75√4000·12/fyt, 50·12/fyt) 0.0075 → 0.0100 in²/in. Validation shows "f_yt = 80 ksi exceeds 60 ksi…". fyt ≤ 60: unchanged.
- **How verified:** jsdom runs before/after.
- **Other copies of this code:** none known (the Beam Capacity app exists only in this file).

### F8. Torsion: 25·bw/fyt (in.-lb) replaces the SI coefficient 0.175; label corrected; shown as information   [bug fix (units) / display] [no pass/fail change in practice]
- **Where:** `torsion()` `AtsFloor` (≈ line 719) and detailing check `dTorAts` (≈ line 1097). Anchor: `const AtsFloor=0.175*bw/(fyt*1000);`
- **Problem:** 0.175·bw/fyt is the SI form (MPa, mm); with fyt in psi it was ~143× too small, so the check could never fail. It was labelled "ACI 9.6.4.2". In 318-19 the 25bw/fyt term only appears inside 9.6.4.3(b) for Al,min (lesser of (a) and (b)); it is not a stand-alone minimum on At/s. The row is therefore shown for information (N/A in pass/fail) rather than turned into a new failure mode. (The tool's Al,min uses expression (a) only, which is conservative.)
- **Governing provision:** ACI 318-19 §9.6.4.3(b).
- **Escaping:** this code sits inside `srcdoc="…"`, so in the file every `&` is written `&amp;` and every `"` is written `&quot;`. The Before/After text below is the un-escaped source; escape it the same way when re-applying by hand. Line numbers are file lines (≈).
  Edit `tor-ats`:
- **Before:**
  ```js
    const AtsFloor=0.175*bw/(fyt*1000);          /* ACI 9.6.4.2 floor on A_t/s */
  ```
- **After:**
  ```js
    const AtsFloor=25*bw/(fyt*1000);             /* 25 b_w/f_yt (f_yt in psi): term of ACI 9.6.4.3(b). Was the SI coefficient 0.175. */
  ```
  Edit `det-ats`:
- **Before:**
  ```js
      add("dTorAts","Minimum A_t/s for torsion","ACI 9.6.4.2",
        tor.At_s,tor.AtsFloor,"\\ge","in\u00b2/in",tor.AtsFloorOK,
        [["\\left(\\dfrac{A_t}{s}\\right)_{min}=\\dfrac{0.175\\,b_w}{f_{yt}}",
          `\\left(\\dfrac{A_t}{s}\\right)_{min}=\\dfrac{0.175(${fmt(bw)}\\text{ in})}{${fmt(fyt*1000,0)}\\text{ psi}}=${fmt(tor.AtsFloor,6)}\\;\\tfrac{\\text{in}^2}{\\text{in}}`,
          "Floor on the transverse torsion steel used in Eq. 9.6.4.3."]]);
  ```
- **After:**
  ```js
      /* 25 b_w/f_yt (in.-lb units) appears in ACI 318-19 only inside 9.6.4.3(b) for A_l,min (lesser of (a), (b)).
         It is not a separate minimum on A_t/s, so it is shown for information (N/A in pass/fail). */
      add("dTorAts","A_t/s vs 25b_w/f_yt (information)","ACI 9.6.4.3(b)",
        tor.At_s,tor.AtsFloor,"\\ge","in\u00b2/in",tor.AtsFloorOK,
        [["\\dfrac{25\\,b_w}{f_{yt}}",
          `\\dfrac{25(${fmt(bw)}\\text{ in})}{${fmt(fyt*1000,0)}\\text{ psi}}=${fmt(tor.AtsFloor,6)}\\;\\tfrac{\\text{in}^2}{\\text{in}}`,
          "Term of 9.6.4.3(b). The tool conservatively uses expression (a) for A_\u2113,min."]],
        true,
        "Information only (not a stand-alone requirement in ACI 318-19): A_t/s = "+fmt(tor.At_s,5)+(tor.AtsFloorOK?" \u2265 ":" < ")+"25b_w/f_yt = "+fmt(tor.AtsFloor,5)+" in\u00b2/in. The term enters 9.6.4.3(b) for A_\u2113,min; the tool conservatively uses expression (a).");
  ```
- **Check case:** bw = 12, fyt = 60 ksi: before 0.175·12/60,000 = 0.0000350 in²/in; after 25·12/60,000 = **0.00500 in²/in**. #4 single leg @ 8 in.: At/s = 0.025 ≥ 0.005 (info row says ≥). Before: always PASS; after: N/A (information).
- **How verified:** jsdom runs of `torsion()` before/after; Detailing tab renders the info text.
- **Other copies of this code:** none known (the Beam Capacity app exists only in this file).

### F9. AASHTO minimum reinforcement: γ3 selectable by bar specification (default 0.67)   [calc change (new input)] [no change at default 0.67; more conservative for A706 (0.75) / A615 Gr 75 (0.76)]
- **Where:** `defaultState()` (`mat.gamma3`), Materials input (AASHTO only), `allChecks()` (≈ line 1869), Serviceability tab (≈ line 2713). Anchor: `Math.min(0.67*1.6*g.svc.Mcr`
- **Problem:** γ3 was hardcoded at 0.67 (A615 Gr 60).
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 5.6.3.3 (γ3 = 0.67 A615 Gr 60; 0.75 A706 Gr 60; 0.76 A615 Gr 75).
- **Escaping:** this code sits inside `srcdoc="…"`, so in the file every `&` is written `&amp;` and every `"` is written `&quot;`. The Before/After text below is the un-escaped source; escape it the same way when re-applying by hand. Line numbers are file lines (≈).
  Edit `state-gamma3`:
- **Before:**
  ```js
      mat:{fc:4,fy:60,fyt:60,dagg:1.0,lambda:1.0},
  ```
- **After:**
  ```js
      mat:{fc:4,fy:60,fyt:60,dagg:1.0,lambda:1.0,gamma3:0.67},
  ```
  Edit `in-gamma3`:
- **Before:**
  ```js
      fRow(b,"λ (lightweight)",numIn(()=>S.mat.lambda,v=>S.mat.lambda=v,"0.05","lam"),"");
  ```
- **After:**
  ```js
      fRow(b,"λ (lightweight)",numIn(()=>S.mat.lambda,v=>S.mat.lambda=v,"0.05","lam"),"");
      if(S.code==='AASHTO') fRow(b,"γ₃ (bar spec., 5.6.3.3)",selIn(["0.67","0.75","0.76"],()=>String(S.mat.gamma3),v=>S.mat.gamma3=+v,
        o=>o==="0.67"?"0.67 — A615 Gr 60":(o==="0.75"?"0.75 — A706 Gr 60":"0.76 — A615 Gr 75"),o=>o,"gamma3"),"");
  ```
  Edit `sum-gamma3`:
- **Before:**
  ```js
        const need=Math.min(0.67*1.6*g.svc.Mcr,Math.abs(g.Mu)>0?1.33*Math.abs(g.Mu):Infinity);
  ```
- **After:**
  ```js
        const need=Math.min((S.mat.gamma3||0.67)*1.6*g.svc.Mcr,Math.abs(g.Mu)>0?1.33*Math.abs(g.Mu):Infinity);
  ```
  Edit `svc-gamma3`:
- **Before:**
  ```js
        const g1=1.6, g3=0.67;   /* flexural cracking variability; A615 ratio (5.6.3.3) */
  ```
- **After:**
  ```js
        const g1=1.6, g3=(S.mat.gamma3||0.67);   /* flexural cracking variability; gamma3 by bar specification (5.6.3.3) */
  ```
  Edit `svc-gamma3-var`:
- **Before:**
  ```js
                ["\\gamma_3","Ratio of yield to ultimate (ASTM A615)","0.67",""],
  ```
- **After:**
  ```js
                ["\\gamma_3","Ratio of yield to ultimate (by bar specification)",fmt(g3,2),""],
  ```
- **Check case:** AASHTO, b = 12, h = 24, 2 #5, Mu = 100 k-ft: Mcr = 46.08 k-ft, φMn = 59.24. γ3 = 0.67: need = min(0.67·1.6·46.08, 1.33·100) = 49.40 → D/C **0.834** (before and after). γ3 = 0.75: need = 55.30 → D/C **0.933**. Older saved projects have no `gamma3`; `mergeState` fills the default 0.67.
- **How verified:** jsdom: `allChecks()` "Minimum reinforcement" D/C.
- **Other copies of this code:** none known (the Beam Capacity app exists only in this file).

### F10. ASD bridge: send d and As for both moment senses; ASD tab uses the one matching its own moment sense   [bug fix] [result change in the ASD tab when the governing LRFD combo's sense differs from the ASD tab's sense]
- **Where:** Capacity tab suite-bridge script `derive()` (≈ line 3979); ASD tab `compute()`, message handler and "From Beam Capacity" table. Anchor: `d_eff:   (F && isFinite(F.dCent))`
- **Problem:** The bridge sent d and As of the governing LRFD combination. If that combination was hogging, the ASD tab (positive moment by default) rated the section with the top steel and a depth measured from the bottom.
- **Governing provision:** n/a
- **Escaping:** this code sits inside `srcdoc="…"`, so in the file every `&` is written `&amp;` and every `"` is written `&quot;`. The Before/After text below is the un-escaped source; escape it the same way when re-applying by hand. Line numbers are file lines (≈).
  Edit `bridge`:
- **Before:**
  ```js
          d_eff:   (F && isFinite(F.dCent)) ? +F.dCent.toFixed(2) : '',
          as:      (F && isFinite(F.As))    ? +F.As.toFixed(2)    : '',
  ```
- **After:**
  ```js
          d_eff:   (F && isFinite(F.dCent)) ? +F.dCent.toFixed(2) : '',
          as:      (F && isFinite(F.As))    ? +F.As.toFixed(2)    : '',
          /* both senses, so the ASD tab can use the one matching its own moment sense */
          d_pos:   (cc && cc.both && isFinite(cc.both.pos.F.dCent)) ? +cc.both.pos.F.dCent.toFixed(2) : '',
          as_pos:  (cc && cc.both && isFinite(cc.both.pos.F.As))    ? +cc.both.pos.F.As.toFixed(2)    : '',
          d_neg:   (cc && cc.both && isFinite(cc.both.neg.F.dCent)) ? +cc.both.neg.F.dCent.toFixed(2) : '',
          as_neg:  (cc && cc.both && isFinite(cc.both.neg.F.As))    ? +cc.both.neg.F.As.toFixed(2)    : '',
  ```
  Edit `bridge-recv`:
- **Before:**
  ```js
      const map={fc:'fc',fy:'fy',b_eff:'b_eff',h_f:'h_f',b_w:'b_w',h_total:'h_total',d_eff:'d_eff',as:'as'};
  ```
- **After:**
  ```js
      const map={fc:'fc',fy:'fy',b_eff:'b_eff',h_f:'h_f',b_w:'b_w',h_total:'h_total',d_eff:'d_eff',as:'as',
                 d_pos:'d_pos',as_pos:'as_pos',d_neg:'d_neg',as_neg:'as_neg'};
  ```
  Edit `compute-sense`:
- **Before:**
  ```js
    const d=Math.max(0.01,+I.d_eff||1), h=+I.h_total||0, As=Math.max(0,+I.as||0);
    const isPos = M.momentType==='pos';
  ```
- **After:**
  ```js
    const isPos = M.momentType==='pos';
    /* The Capacity tab sends d and A_s for BOTH senses (d_pos/as_pos, d_neg/as_neg); use the pair that
       matches this tab's moment sense. Fall back to the single d_eff/as (older state or no live values). */
    const dS=isPos?I.d_pos:I.d_neg, aS=isPos?I.as_pos:I.as_neg;
    const bySense=(typeof dS==='number' && isFinite(dS) && typeof aS==='number' && isFinite(aS));
    const d=Math.max(0.01,+(bySense?dS:I.d_eff)||1), h=+I.h_total||0, As=Math.max(0,+(bySense?aS:I.as)||0);
  ```
  Edit `echo-sense`:
- **Before:**
  ```js
        ["d","Effective depth",fmt(I.d_eff),"in"],
        ["A_s","Tension steel area",fmt(I.as),"in²"]
  ```
- **After:**
  ```js
        ["d","Effective depth"+(typeof I.d_pos==='number'?(S.mode.momentType==='pos'?" (+M)":" (−M)"):""),fmt(typeof I.d_pos==='number'?(S.mode.momentType==='pos'?I.d_pos:I.d_neg):I.d_eff),"in"],
        ["A_s","Tension steel area"+(typeof I.as_pos==='number'?(S.mode.momentType==='pos'?" (+M)":" (−M)"):""),fmt(typeof I.as_pos==='number'?(S.mode.momentType==='pos'?I.as_pos:I.as_neg):I.as),"in²"]
  ```
- **Check case:** Default section with 4 #8 bottom, 2 #5 top, one combination Mu = −60 k-ft: payload before {d_eff: 15.19, as: 0.62} (top steel) → ASD +M used d = 15.19, As = 0.62. After: payload adds {d_pos: 15.00, as_pos: 3.16, d_neg: 15.19, as_neg: 0.62}; ASD +M uses 15.00 / 3.16 and −M uses 15.19 / 0.62. Old payload without the new keys (or an older saved ASD state): falls back to d_eff/as as before. Example in the ASD tab (T-beam 90/7/14, f'c 3,000, Gr 40): −M with d_neg = 29.0, As_neg = 3.10 → M_inv 134.4 k-ft (before, it used the +M steel 8.00 → 216.2).
- **How verified:** jsdom: postMessage payload captured from the Capacity frame; ASD frame driven with MessageEvents.
- **Other copies of this code:** none known (the Beam Capacity app exists only in this file).

**ASD tab**

### F11. ASD tab: allowable stresses tied to f'c and fy (auto, per-field override)   [calc change] [LESS conservative for Gr 60 and for f'c > 3,000 psi; default results unchanged]
- **Where:** ASD tab: new `autoAllow()`, `applyAutoAllow()`, `allowTag()` (after `lsSet`), `defaultState().allow.ovr`, `mergeState()` migration, Allowable Stresses inputs, `compute()`, `refresh()`. Anchor: `function autoAllow(fc,fy)`
- **Problem:** Same engine and issue as the standalone `Concrete Beam ASD.html`: allowables stayed at 1200/20000/1900/28000 psi regardless of the f'c/fy inherited from the Capacity tab.
- **Governing provision:** AASHTO Standard Specifications 17th Ed. (2002) Art. 8.15.2.1.1, 8.15.2.2; MBE Art. 6B.6.2.3. Operating fc stays the input (MassDOT 1,900 psi).
- **Escaping:** this code sits inside `srcdoc="…"`, so in the file every `&` is written `&amp;` and every `"` is written `&quot;`. The Before/After text below is the un-escaped source; escape it the same way when re-applying by hand. Line numbers are file lines (≈).
  Edit `helpers`:
- **Before:**
  ```js
  function lsSet(k,v){ try{localStorage.setItem(k,v);return true;}catch(e){return false;} }
  ```
- **After:**
  ```js
  function lsSet(k,v){ try{localStorage.setItem(k,v);return true;}catch(e){return false;} }
  /* Allowable stresses tied to f'c / fy (psi), auto unless the user overrides a field.
     Inventory fc = 0.40 f'c (AASHTO Std. Spec. 8.15.2.1.1). fs: inventory 20,000 psi Gr 40/50,
     24,000 psi Gr 60 (8.15.2.2); operating 28,000 psi Gr 40, 36,000 psi Gr 60 (MBE 6B.6.2.3).
     Other grades: no rule, value stays as entered. Operating fc is never auto (MassDOT value). */
  const AUTO_ALLOW=["fc_inv","fs_inv","fs_op"];
  function autoAllow(fc,fy){
    return {fc_inv: fc>0 ? +(0.40*fc).toFixed(1) : null,
            fs_inv: (fy===40000||fy===50000)?20000:(fy===60000?24000:null),
            fs_op:  fy===40000?28000:(fy===60000?36000:null)};
  }
  function applyAutoAllow(){
    const a=autoAllow(+S.inherit.fc||0,+S.inherit.fy||0);
    if(!S.allow.ovr) S.allow.ovr={fc_inv:false,fs_inv:false,fs_op:false};
    AUTO_ALLOW.forEach(k=>{ if(!S.allow.ovr[k] && a[k]!==null) S.allow[k]=a[k]; });
    return a;
  }
  function allowTag(k){ const a=autoAllow(+S.inherit.fc||0,+S.inherit.fy||0);
    return S.allow.ovr&&S.allow.ovr[k] ? " (override)" : (a[k]!==null ? " (auto)" : " (input, no grade rule)"); }
  ```
  Edit `default-allow`:
- **Before:**
  ```js
      allow:{fc_inv:1200, fs_inv:20000, fc_op:1900, fs_op:28000},
  ```
- **After:**
  ```js
      allow:{fc_inv:1200, fs_inv:20000, fc_op:1900, fs_op:28000, ovr:{fc_inv:false,fs_inv:false,fs_op:false}},
  ```
  Edit `merge`:
- **Before:**
  ```js
    ["proj","mode","allow","loads","inherit","ui"].forEach(k=>{ S[k]={...d[k],...(st[k]||{})}; });
    if(!S.ui.collapse) S.ui.collapse={};
  ```
- **After:**
  ```js
    ["proj","mode","allow","loads","inherit","ui"].forEach(k=>{ S[k]={...d[k],...(st[k]||{})}; });
    if(!S.ui.collapse) S.ui.collapse={};
    /* Older saves have no override flags: keep any saved allowable that differs from the f'c/fy-based
       value as an override, so saved data is not silently replaced. */
    const so=st.allow&&st.allow.ovr;
    if(so && typeof so==="object") S.allow.ovr={fc_inv:!!so.fc_inv,fs_inv:!!so.fs_inv,fs_op:!!so.fs_op};
    else { const a=autoAllow(+S.inherit.fc||0,+S.inherit.fy||0); S.allow.ovr={};
      AUTO_ALLOW.forEach(k=>{ S.allow.ovr[k]=!!(st.allow && st.allow[k]!==undefined && a[k]!==null && +st.allow[k]!==a[k]); }); }
  ```
  Edit `allow-ui`:
- **Before:**
  ```js
      b.appendChild(el("div","note","AASHTO 8.15.2 service-level allowables. Defaults: f_c = 0.4 f'_c; "+
        "f_s per steel grade / rating level."));
      b.appendChild(el("div","grpMini","Inventory"));
      fRow(b,"Concrete, f_{c,inv}",numIn(()=>S.allow.fc_inv,v=>S.allow.fc_inv=v,"50","fcInv"),"psi");
      fRow(b,"Steel, f_{s,inv}",numIn(()=>S.allow.fs_inv,v=>S.allow.fs_inv=v,"500","fsInv"),"psi");
      b.appendChild(el("div","grpMini","Operating"));
      fRow(b,"Concrete, f_{c,op}",numIn(()=>S.allow.fc_op,v=>S.allow.fc_op=v,"50","fcOp"),"psi");
      fRow(b,"Steel, f_{s,op}",numIn(()=>S.allow.fs_op,v=>S.allow.fs_op=v,"500","fsOp"),"psi");
  ```
- **After:**
  ```js
      b.appendChild(el("div","note","AASHTO 8.15.2 service-level allowables, set automatically from f'_c and f_y (auto): "+
        "f_c,inv = 0.40 f'_c; f_s,inv = 20,000 psi (Gr 40/50) or 24,000 psi (Gr 60); f_s,op = 28,000 psi (Gr 40) or 36,000 psi (Gr 60, MBE 6B.6.2.3). "+
        "Typing a value overrides it. Operating f_c is always the entered value."));
      b.appendChild(el("div","grpMini","Inventory"));
      fRow(b,"Concrete, f_{c,inv}"+allowTag("fc_inv"),numIn(()=>S.allow.fc_inv,v=>{S.allow.fc_inv=v;S.allow.ovr.fc_inv=true;},"50","fcInv"),"psi");
      fRow(b,"Steel, f_{s,inv}"+allowTag("fs_inv"),numIn(()=>S.allow.fs_inv,v=>{S.allow.fs_inv=v;S.allow.ovr.fs_inv=true;},"500","fsInv"),"psi");
      b.appendChild(el("div","grpMini","Operating"));
      fRow(b,"Concrete, f_{c,op} (input)",numIn(()=>S.allow.fc_op,v=>S.allow.fc_op=v,"50","fcOp"),"psi");
      fRow(b,"Steel, f_{s,op}"+allowTag("fs_op"),numIn(()=>S.allow.fs_op,v=>{S.allow.fs_op=v;S.allow.ovr.fs_op=true;},"500","fsOp"),"psi");
      const rb=el("button",null,"↺ Recompute allowables from f′c / f_y"); rb.type="button";
      rb.style.cssText="font-size:11px;margin-top:6px;cursor:pointer";
      rb.addEventListener("click",()=>{ S.allow.ovr={fc_inv:false,fs_inv:false,fs_op:false}; refresh(); });
      b.appendChild(rb);
  ```
  Edit `compute`:
- **Before:**
  ```js
    const I=S.inherit, M=S.mode, A=S.allow, L=S.loads;
    const fc=Math.max(1,+I.fc||3000), fy=+I.fy||40000;
  ```
- **After:**
  ```js
    applyAutoAllow();
    const I=S.inherit, M=S.mode, A=S.allow, L=S.loads;
    const fc=Math.max(1,+I.fc||3000), fy=+I.fy||40000;
  ```
  Edit `refresh`:
- **Before:**
  ```js
  function refresh(){
    const st=captureUI();
  ```
- **After:**
  ```js
  function refresh(){
    applyAutoAllow();
    const st=captureUI();
  ```
- **Check case:** T-beam b_eff 90, hf 7, bw 14, d 28.5, As 8.00, M_DL 250, M_LL+I 400. Inherited f'c 3,000 / Gr 40: 1200/20000/1900/28000, M_inv 353.3, RF_inv 0.258 (unchanged). Inherited **f'c 4,000 / Gr 60:** before M_inv 354.7, M_op 496.6, RF_inv 0.262; after allowables 1600/24000/1900/36000 → M_inv **425.6**, M_op **638.4**, RF_inv **0.439**. Override: fs,inv typed 18000 stays 18000 when f'c changes. Saved state from before this change with inherit f'c 4,000/Gr 60 and allowables 1200/20000/28000 → kept as overrides (results identical to before; labels show "(override)"); saved state with the default allowables and f'c 3,000/Gr 40 → auto.
- **How verified:** jsdom: ASD frame loaded alone, Capacity payloads sent as MessageEvents, `CC` inspected; same numbers as the standalone ASD tool.
- **Other copies of this code:** `Concrete Beam ASD.html` (standalone, different code, same engine) — fixed separately in branch `claude/fix-concrete-asd`.

### F12. ASD tab: modular ratio n not less than 6   [calc change] [more conservative (only f'c > ≈ 8,560 psi)]
- **Where:** ASD tab `compute()` (≈ line 4584) and Analysis tab modular-ratio block. Anchor: `n=Math.max(1,Math.round(ES/Ec))`
- **Problem:** n had a floor of 1 instead of 6.
- **Governing provision:** AASHTO Standard Specifications 17th Ed. (2002) Art. 8.15.3.4.
- **Escaping:** this code sits inside `srcdoc="…"`, so in the file every `&` is written `&amp;` and every `"` is written `&quot;`. The Before/After text below is the un-escaped source; escape it the same way when re-applying by hand. Line numbers are file lines (≈).
  Edit `n-floor`:
- **Before:**
  ```js
    const Ec=57000*Math.sqrt(fc), n=Math.max(1,Math.round(ES/Ec));
  ```
- **After:**
  ```js
    const Ec=57000*Math.sqrt(fc), n=Math.max(6,Math.round(ES/Ec));   /* Std. Spec. 8.15.3.4: nearest whole number, not less than 6 */
  ```
  Edit `n-disp`:
- **Before:**
  ```js
          "n = \\dfrac{E_s}{E_c} = \\dfrac{29{,}000{,}000}{"+grp(R.Ec)+"} = "+fmt(ES/R.Ec,2)+" \\Rightarrow "+R.n
  ```
- **After:**
  ```js
          "n = \\dfrac{E_s}{E_c} = \\dfrac{29{,}000{,}000}{"+grp(R.Ec)+"} = "+fmt(ES/R.Ec,2)+" \\Rightarrow "+R.n+(Math.round(ES/R.Ec)<6?"\\;(\\text{not less than 6, 8.15.3.4})":"")
  ```
- **Check case:** Inherited f'c 10,000 / Gr 40, same T-beam: n 5 → 6, M_inv 359.5 → 357.8 k-ft, RF_inv 0.274 → 0.269 (fc,inv now also auto 4,000 psi; steel governs).
- **How verified:** jsdom ASD frame runs.
- **Other copies of this code:** `Concrete Beam ASD.html` (standalone) — fixed separately in branch `claude/fix-concrete-asd`.

**Development & Splice tab** (mirror of the standalone ACI Rebar Development Length.html fixes)

Identical edits to branch claude/fix-rebar-dev (see fixlog/ACI Rebar Development Length.md). Suite line ≈ standalone line + 5048. After the edits, the un-escaped Dev srcdoc differs from the fixed standalone file only in the two pre-existing CSS hunks (layout and print).

### F13. AASHTO standard-hook lightweight factor: divide by λ instead of ×1.3   [calc change] [more conservative (lightweight only; normalweight unchanged)]
- **Where:** Dev tab srcdoc, function `calcHook` (≈ line 372 standalone) and `tabHookAASHTO` display (≈ line 895–906). Anchor: `const lw = inp.lightweight?1.3:1.0;`
- **Problem:** AASHTO hook lightweight factor was a fixed ×1.3 (the old pre-2017 lightweight factor). The current spec divides by the concrete density modification factor λ, as the tool already does for straight bars.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) Art. 5.10.8.2.4a (l_dh = l_hb × λrc·λcf / λ), λ per Art. 5.4.2.8. The tool's λ remains the fixed 0.75 checkbox (see open items).
- **Escaping:** in this file the code sits inside `srcdoc="…"`, so every `&` is written `&amp;` and every `"` is written `&quot;` (e.g. `&quot;1.25&quot;`, `&amp;lt;`). The Before/After text below is the un-escaped source; escape it the same way when re-applying by hand.
  Edit `hook-lw`:
- **Before:**
  ```
      const lw = inp.lightweight?1.3:1.0; // λ for lightweight hooks
  ```
- **After:**
  ```
      const lw = 1/f.lambda; // AASHTO 10th Ed. 5.10.8.2.4a: l_dh = l_hb·(λrc·λcf)/λ, λ per 5.4.2.8 (was fixed ×1.3)
  ```
  Edit `hook-tbl`:
- **Before:**
  ```
        ["\\lambda","Lightweight (1.3 if LW)",fmt(h.lw,1),"—"],
  ```
- **After:**
  ```
        ["\\lambda","Concrete density factor (divides; 0.75 if LW)",fmt(f.lambda,2),"—"],
  ```
  Edit `hook-note`:
- **Before:**
  ```
        <div class="vardef"><span class="s">λ = ${fmt(h.lw,1)}</span> — 1.3 for lightweight concrete, 1.0 normalweight.</div>`))
  ```
- **After:**
  ```
        <div class="vardef"><span class="s">λ = ${fmt(f.lambda,2)}</span> — Concrete density modification factor (§5.4.2.8). It <em>divides</em> the length, as for straight bars, so lightweight (0.75) lengthens it by 1/0.75 = 1.33; 1.0 normalweight.</div>`))
  ```
  Edit `hook-eq`:
- **Before:**
  ```
          "l_{dh} = l_{hb}\\,\\lambda_{cf}\\,\\lambda_{rc}\\,\\lambda"+(inp.useExcess?"\\,\\lambda_{er}":"")+" \\ge \\max(8d_b, 6\\text{ in})",
          `${fmt(h.lhb,2)}\\times ${fmt(h.cf,1)}\\times ${fmt(h.conf,1)}\\times ${fmt(h.lw,1)}${inp.useExcess?`\\times ${fmt(f.excess,3)}`:""}`,
  ```
- **After:**
  ```
          "l_{dh} = l_{hb}\\,\\dfrac{\\lambda_{cf}\\,\\lambda_{rc}"+(inp.useExcess?"\\,\\lambda_{er}":"")+"}{\\lambda} \\ge \\max(8d_b, 6\\text{ in})",
          `${fmt(h.lhb,2)}\\times\\dfrac{${fmt(h.cf,1)}\\times ${fmt(h.conf,1)}${inp.useExcess?`\\times ${fmt(f.excess,3)}`:""}}{${fmt(f.lambda,2)}}`,
  ```
- **Check case:** AASHTO, #8 (db = 1.000), fy = 60 ksi, f'c = 4 ksi, uncoated, unconfined, lightweight ticked (λ = 0.75): l_hb = 38.0·1.000·60/(60·√4) = 19.00 in. → before: 19.00 × 1.3 = **24.70 in.** → after: 19.00 / 0.75 = **25.33 in.** (+2.6%). #5: l_hb = 11.875 in. → before 15.44 in., after 15.83 in. Normalweight: 19.00 in. before and after.
- **How verified:** node: extracted `computeFactors`/`calcHook` from the file before and after and ran the case; jsdom render of the Hook tab (AASHTO, LW) shows 25.33 in.
- **Other copies of this code:** `ACI Rebar Development Length.html` (standalone). The same edits, unescaped, are in branch `claude/fix-rebar-dev`.

### F14. ACI 25.4.2.2 check: Ktr ≥ 0.5db for fy ≥ 80 ksi bars spaced < 6 in. c-c   [robustness / new check] [no result change (new warning + dashboard row)]
- **Where:** Dev tab srcdoc, new function `ktrHSCheck` (≈ line 418), new optional input `barSpc` in panel D, `readInputs`, `validate`, `buildDashboard`, `applyState`. Anchor: `function ktrHSCheck(inp,f){`
- **Problem:** ACI 318-19 requires transverse reinforcement with Ktr ≥ 0.5db when fy ≥ 80,000 psi bars are spaced closer than 6 in. on center. The tool had no bar-spacing input and no check, only a generic "verify scope" notice.
- **Governing provision:** ACI 318-19 §25.4.2.2.
- **Escaping:** in this file the code sits inside `srcdoc="…"`, so every `&` is written `&amp;` and every `"` is written `&quot;` (e.g. `&quot;1.25&quot;`, `&amp;lt;`). The Before/After text below is the un-escaped source; escape it the same way when re-applying by hand.
  Edit `helpers`:
- **Before:**
  ```
  /* ---------- Splices ---------- */
  ```
- **After:**
  ```
  /* ---------- ACI 25.4.2.2: fy >= 80 ksi bars spaced < 6 in. c-c need Ktr >= 0.5db ---------- */
  function ktrHSCheck(inp,f){
    const relevant = !f.AASHTO && inp.fy>=80000;
    const known = inp.barSpc>0;
    const applies = relevant && known && inp.barSpc<6;
    const req = 0.5*f.db;
    return {relevant, known, applies, req, ok: !applies || f.Ktr>=req};
  }
  /* ---------- ACI 25.5.1.1: no lap splices for #14 / #18 bars (except compression to #11 and smaller, 25.5.5.3) ---------- */
  function lapProhibited(inp,f){ return !f.AASHTO && parseInt(inp.barSize)>=14; }
  
  /* ---------- Splices ---------- */
  ```
  Edit `read-barSpc`:
- **Before:**
  ```
      nBars:num('nBars'),               // number of bars developed along split plane
  ```
- **After:**
  ```
      nBars:num('nBars'),               // number of bars developed along split plane
      barSpc:num('barSpc'),             // c-c spacing of developed bars, in (ACI 25.4.2.2 check; optional, blank = unknown)
      psiRc:g('psiRc').value,           // ψr for compression development (ACI Table 25.4.9.3): "1.0" or "0.75"
  ```
  Edit `panel-barSpc`:
- **Before:**
  ```
      <div class="hint">Leave A<sub>tr</sub>=0 for no transverse steel (conservative). K<sub>tr</sub>=40A<sub>tr</sub>/(s·n).</div>`)}
  ```
- **After:**
  ```
      <div class="hint">Leave A<sub>tr</sub>=0 for no transverse steel (conservative). K<sub>tr</sub>=40A<sub>tr</sub>/(s·n).</div>
      <div class="field" style="margin-top:8px"><label>Developed bars c-c spacing <span class="unit">(in, optional)</span></label>
        <input id="barSpc" type="number" step="0.5" min="0" placeholder="for ACI 25.4.2.2 check (fy ≥ 80 ksi)"></div>`)}
  ```
  Edit `validate`:
- **Before:**
  ```
    if (inp.fy >= 80000) w.push(`f_y = ${fmt(inp.fy,0)} psi: high-strength reinforcement. Verify the member is within the scope of ${cite} for this grade.`);
  ```
- **After:**
  ```
    if (inp.fy >= 80000) w.push(`f_y = ${fmt(inp.fy,0)} psi: high-strength reinforcement. Verify the member is within the scope of ${cite} for this grade.`);
    if (!f.AASHTO && inp.fy >= 80000){
      const k = ktrHSCheck(inp,f);
      if (!k.known) w.push(`ACI 25.4.2.2: for f_y ≥ 80,000 psi bars spaced closer than 6 in. on center, K_tr ≥ 0.5d_b (${fmt(k.req,3)} in.) is required. Enter the developed-bar c-c spacing (panel D) to check this.`);
      else if (!k.ok) w.push(`ACI 25.4.2.2 NOT satisfied: f_y ≥ 80,000 psi bars at ${fmt(inp.barSpc,2)} in. on center (&lt; 6 in.) require K_tr ≥ 0.5d_b = ${fmt(k.req,3)} in.; provided K_tr = ${fmt(f.Ktr,3)} in. Add transverse reinforcement.`);
    }
    if (lapProhibited(inp,f)) w.push(`ACI 25.5.1.1: lap splices are not permitted for #${inp.barSize} bars. Use mechanical or welded splices. In compression, #14/#18 bars may be lap spliced only to #11 and smaller bars (25.5.5.3); the splice lengths shown for this bar size do not apply.`);
  ```
  Edit `dash-extra`:
- **Before:**
  ```
    if(inp.tensClass==="A"){
      checks.push({lbl:"Class A splice eligible", ok:e.eligible, val:e.known?(e.eligible?"yes":"no"):"unknown"});
    }
  ```
- **After:**
  ```
    if(inp.tensClass==="A"){
      checks.push({lbl:"Class A splice eligible", ok:e.eligible, val:e.known?(e.eligible?"yes":"no"):"unknown"});
    }
    const kHS = ktrHSCheck(inp,f);
    if(kHS.relevant){
      checks.push({lbl:"K_tr ≥ 0.5d_b (25.4.2.2)", ok:kHS.known && kHS.ok,
        val:!kHS.known?"spacing?":(kHS.applies?fmt(f.Ktr,2)+" / "+fmt(kHS.req,2):"s ≥ 6 in")});
    }
    if(lapProhibited(inp,f)){
      checks.push({lbl:"Lap splice permitted (25.5.1.1)", ok:false, val:"#"+inp.barSize+" N/P"});
    }
  ```
  Edit `apply`:
- **Before:**
  ```
    set('useExcess',inp.useExcess);set('asReq',inp.asReq);set('asProv',inp.asProv);set('pctSpliced',inp.pctSpliced);
  ```
- **After:**
  ```
    set('useExcess',inp.useExcess);set('asReq',inp.asReq);set('asProv',inp.asProv);set('pctSpliced',inp.pctSpliced);
    set('barSpc',inp.barSpc);set('psiRc',inp.psiRc);   // optional (added later); absent in older saved states
  ```
- **Check case:** ACI, #8, fy = 80,000 psi, f'c = 4,000 psi, cb = 1.5 in.: (a) spacing blank → notice "enter the developed-bar c-c spacing", dashboard `K_tr ≥ 0.5d_b` = CHK "spacing?"; (b) spacing 4 in., Atr = 0 → Ktr = 0 < 0.5·1.000 = 0.50 in. → notice "25.4.2.2 NOT satisfied", dashboard CHK 0.00 / 0.50; (c) spacing 4 in., Atr = 0.40, s = 6, n = 2 → Ktr = 40·0.40/(6·2) = 1.333 ≥ 0.50 → OK. l_d unchanged in all cases (72.73 in. with Ktr = 0; 43.64 in. with Ktr = 1.333).
- **How verified:** node (validate() warning counts before/after) and jsdom (dashboard text).
- **Other copies of this code:** `ACI Rebar Development Length.html` (standalone). The same edits, unescaped, are in branch `claude/fix-rebar-dev`.

### F15. ACI 25.5.1.1: lap splices of #14/#18 flagged as not permitted   [robustness / new check] [no result change (warning; schedule shows N/P*)]
- **Where:** Dev tab srcdoc, new function `lapProhibited` (≈ line 426); `validate`; `tabTSplice`/`tabCSplice` banners; `tabBatch` cells and footnote; `buildDashboard`. Anchor: `function lapProhibited(inp,f)`
- **Problem:** The tool reported tension and compression lap-splice lengths for #14 and #18 bars, which ACI 318-19 does not permit (compression lap of #14/#18 to #11 and smaller only).
- **Governing provision:** ACI 318-19 §25.5.1.1 (exception §25.5.5.3; length §25.5.5.2). ACI mode only; AASHTO left unchanged (see open items).
- **Escaping:** in this file the code sits inside `srcdoc="…"`, so every `&` is written `&amp;` and every `"` is written `&quot;` (e.g. `&quot;1.25&quot;`, `&amp;lt;`). The Before/After text below is the un-escaped source; escape it the same way when re-applying by hand.
  Edit `validate`:
- **Before:**
  ```
    if (inp.fy >= 80000) w.push(`f_y = ${fmt(inp.fy,0)} psi: high-strength reinforcement. Verify the member is within the scope of ${cite} for this grade.`);
  ```
- **After:**
  ```
    if (inp.fy >= 80000) w.push(`f_y = ${fmt(inp.fy,0)} psi: high-strength reinforcement. Verify the member is within the scope of ${cite} for this grade.`);
    if (!f.AASHTO && inp.fy >= 80000){
      const k = ktrHSCheck(inp,f);
      if (!k.known) w.push(`ACI 25.4.2.2: for f_y ≥ 80,000 psi bars spaced closer than 6 in. on center, K_tr ≥ 0.5d_b (${fmt(k.req,3)} in.) is required. Enter the developed-bar c-c spacing (panel D) to check this.`);
      else if (!k.ok) w.push(`ACI 25.4.2.2 NOT satisfied: f_y ≥ 80,000 psi bars at ${fmt(inp.barSpc,2)} in. on center (&lt; 6 in.) require K_tr ≥ 0.5d_b = ${fmt(k.req,3)} in.; provided K_tr = ${fmt(f.Ktr,3)} in. Add transverse reinforcement.`);
    }
    if (lapProhibited(inp,f)) w.push(`ACI 25.5.1.1: lap splices are not permitted for #${inp.barSize} bars. Use mechanical or welded splices. In compression, #14/#18 bars may be lap spliced only to #11 and smaller bars (25.5.5.3); the splice lengths shown for this bar size do not apply.`);
  ```
  Edit `tsplice-banner`:
- **Before:**
  ```
    + classABlock(inp,f)
    + subsec("1. Base Development Length",ref, varTable([
  ```
- **After:**
  ```
    + (lapProhibited(inp,f)?`<div class="warnbox" style="border-left-color:var(--fail);background:var(--failbg)"><b style="color:var(--fail)">Lap splice NOT permitted (ACI 25.5.1.1).</b> #${inp.barSize} bars shall not be lap spliced in tension. Use a mechanical or welded splice. The length below is shown for reference only.</div>`:"")
    + classABlock(inp,f)
    + subsec("1. Base Development Length",ref, varTable([
  ```
  Edit `csplice-banner`:
- **Before:**
  ```
    + `<div class="narr">Compression lap splice length is a direct function of f_y and d_b. For f'c below 3,000 psi the
  ```
- **After:**
  ```
    + (lapProhibited(inp,f)?`<div class="warnbox" style="border-left-color:var(--fail);background:var(--failbg)"><b style="color:var(--fail)">Lap splice of #${inp.barSize} to #${inp.barSize} NOT permitted (ACI 25.5.1.1).</b> In compression, #14/#18 bars may be lap spliced only to #11 and smaller bars (25.5.5.3), with l_sc per 25.5.5.2 (larger of l_dc of the larger bar and l_sc of the smaller bar). The length below is shown for reference only.</div>`:"")
    + `<div class="narr">Compression lap splice length is a direct function of f_y and d_b. For f'c below 3,000 psi the
  ```
  Edit `sched-cells`:
- **Before:**
  ```
        <td class="num">${fmt(c.ldc,1)}</td><td class="num">${fmt(ts.lst,1)}</td>
        <td class="num">${fmt(cs.lsc,1)}</td></tr>`;
  ```
- **After:**
  ```
        <td class="num">${fmt(c.ldc,1)}</td><td class="num">${lapProhibited(bi,bf)?"N/P*":fmt(ts.lst,1)}</td>
        <td class="num">${lapProhibited(bi,bf)?"N/P*":fmt(cs.lsc,1)}</td></tr>`;
  ```
  Edit `sched-foot`:
- **Before:**
  ```
  "No excess-reinforcement reduction applied."}</div>`)
  ```
- **After:**
  ```
  "No excess-reinforcement reduction applied."}${f.AASHTO?"":" *N/P = lap splice not permitted for #14/#18 bars (ACI 25.5.1.1); in compression they may be lapped only to #11 and smaller bars (25.5.5.3)."}</div>`)
  ```
  Edit `dash-extra`:
- **Before:**
  ```
    if(inp.tensClass==="A"){
      checks.push({lbl:"Class A splice eligible", ok:e.eligible, val:e.known?(e.eligible?"yes":"no"):"unknown"});
    }
  ```
- **After:**
  ```
    if(inp.tensClass==="A"){
      checks.push({lbl:"Class A splice eligible", ok:e.eligible, val:e.known?(e.eligible?"yes":"no"):"unknown"});
    }
    const kHS = ktrHSCheck(inp,f);
    if(kHS.relevant){
      checks.push({lbl:"K_tr ≥ 0.5d_b (25.4.2.2)", ok:kHS.known && kHS.ok,
        val:!kHS.known?"spacing?":(kHS.applies?fmt(f.Ktr,2)+" / "+fmt(kHS.req,2):"s ≥ 6 in")});
    }
    if(lapProhibited(inp,f)){
      checks.push({lbl:"Lap splice permitted (25.5.1.1)", ok:false, val:"#"+inp.barSize+" N/P"});
    }
  ```
- **Check case:** ACI, #14, fy = 60 ksi, f'c = 4 ksi: lengths still computed (l_st = 176.75 in., l_sc = 50.79 in., unchanged) but: a validation notice cites 25.5.1.1; both splice tabs show a red "NOT permitted" banner; the schedule shows `N/P*` for #14 and #18 splice columns with a footnote; dashboard adds `Lap splice permitted (25.5.1.1)` = CHK. #11 and smaller: no change.
- **How verified:** node (warning count) and jsdom (schedule rows, banner, dashboard).
- **Other copies of this code:** `ACI Rebar Development Length.html` (standalone). The same edits, unescaped, are in branch `claude/fix-rebar-dev`.

### F16. ACI compression development: add ψr (Table 25.4.9.3)   [calc change (new option)] [no result change at default ψr = 1.0; less conservative only when the user selects 0.75]
- **Where:** Dev tab srcdoc, new select `psiRc` in new collapsed panel E2; `readInputs`; `computeFactors` (`psiR_c`); `calcComp` ACI branch (≈ line 397); `tabComp` display; `applyState`. Anchor: `const a = (0.02*inp.fy`
- **Problem:** ACI 318-19 Eq. 25.4.9.2 includes ψr (0.75 for bars enclosed in spirals/ties/hoops per Table 25.4.9.3). The tool always used 1.0 (conservative).
- **Governing provision:** ACI 318-19 §25.4.9.2(a),(b) and Table 25.4.9.3.
- **Escaping:** in this file the code sits inside `srcdoc="…"`, so every `&` is written `&amp;` and every `"` is written `&quot;` (e.g. `&quot;1.25&quot;`, `&amp;lt;`). The Before/After text below is the un-escaped source; escape it the same way when re-applying by hand.
  Edit `read-barSpc`:
- **Before:**
  ```
      nBars:num('nBars'),               // number of bars developed along split plane
  ```
- **After:**
  ```
      nBars:num('nBars'),               // number of bars developed along split plane
      barSpc:num('barSpc'),             // c-c spacing of developed bars, in (ACI 25.4.2.2 check; optional, blank = unknown)
      psiRc:g('psiRc').value,           // ψr for compression development (ACI Table 25.4.9.3): "1.0" or "0.75"
  ```
  Edit `cf-psiRc`:
- **Before:**
  ```
    const psiC_h = Math.min(inp.fc/15000 + 0.6, 1.0);
  ```
- **After:**
  ```
    const psiC_h = Math.min(inp.fc/15000 + 0.6, 1.0);
    // ψr for compression development (ACI 318-19 25.4.9.2 / Table 25.4.9.3); 1.0 when not selected (old saved states)
    const psiR_c = AASHTO ? 1.0 : (parseFloat(inp.psiRc) || 1.0);
  ```
  Edit `cf-return`:
- **Before:**
  ```
            psiE_h,psiR,psiO,psiC_h,
  ```
- **After:**
  ```
            psiE_h,psiR,psiO,psiC_h,psiR_c,
  ```
  Edit `comp-aci`:
- **Before:**
  ```
      const a = (0.02*inp.fy)/(f.lambda*f.sqrtFc)*f.db;
      const b = 0.0003*inp.fy*f.db;
  ```
- **After:**
  ```
      const a = (0.02*inp.fy*f.psiR_c)/(f.lambda*f.sqrtFc)*f.db;   // ACI 25.4.9.2(a): fy·ψr/(50λ√f'c)·db
      const b = 0.0003*inp.fy*f.psiR_c*f.db;                        // ACI 25.4.9.2(b): 0.0003·fy·ψr·db
  ```
  Edit `panel-psiRc`:
- **Before:**
  ```
    ${panel("F","Splices",false,`
  ```
- **After:**
  ```
    ${panel("E2","Compression Development (&psi;<sub>r</sub>)",false,`
      <div class="field"><label>Confining Reinforcement (&psi;<sub>r</sub>, ACI Table 25.4.9.3)</label>
        <select id="psiRc">
          <option value="1.0" selected>Other (1.0)</option>
          <option value="0.75">Enclosed in spiral, circular tie (db≥1/4&quot;, pitch≤4&quot;), #4 ties or hoops @ ≤4&quot; c-c (0.75)</option>
        </select></div>
      <div class="hint">ACI only. AASHTO compression modifiers are not applied (conservative).</div>`)}
  
    ${panel("F","Splices",false,`
  ```
  Edit `comp-tbl`:
- **Before:**
  ```
    + subsec("1. Governing Expressions","§25.4.9.2", varTable([
        ["f_y","Yield strength",fmt(inp.fy,0),"psi"],
        ["\\lambda","Lightweight concrete",fmt(f.lambda,2),"—"],
  ```
- **After:**
  ```
    + subsec("1. Governing Expressions","§25.4.9.2", varTable([
        ["f_y","Yield strength",fmt(inp.fy,0),"psi"],
        ["\\psi_r","Confining reinforcement (Table 25.4.9.3)",fmt(f.psiR_c,2),"—"],
        ["\\lambda","Lightweight concrete",fmt(f.lambda,2),"—"],
  ```
  Edit `comp-eqa`:
- **Before:**
  ```
          "l_{dc,a} = \\dfrac{0.02\\,f_y}{\\lambda\\sqrt{f'_c}}\\,d_b",
          `\\dfrac{0.02\\times ${fmt(inp.fy,0)}}{${fmt(f.lambda,2)}\\times ${fmt(f.sqrtFc,1)}}\\times ${fmt(f.db,3)}`,
  ```
- **After:**
  ```
          "l_{dc,a} = \\dfrac{f_y\\,\\psi_r}{50\\,\\lambda\\sqrt{f'_c}}\\,d_b",
          `\\dfrac{${fmt(inp.fy,0)}\\times ${fmt(f.psiR_c,2)}}{50\\times ${fmt(f.lambda,2)}\\times ${fmt(f.sqrtFc,1)}}\\times ${fmt(f.db,3)}`,
  ```
  Edit `comp-eqb`:
- **Before:**
  ```
          "l_{dc,b} = 0.0003\\,f_y\\,d_b",
          `0.0003\\times ${fmt(inp.fy,0)}\\times ${fmt(f.db,3)}`,
  ```
- **After:**
  ```
          "l_{dc,b} = 0.0003\\,f_y\\,\\psi_r\\,d_b",
          `0.0003\\times ${fmt(inp.fy,0)}\\times ${fmt(f.psiR_c,2)}\\times ${fmt(f.db,3)}`,
  ```
  Edit `apply`:
- **Before:**
  ```
    set('useExcess',inp.useExcess);set('asReq',inp.asReq);set('asProv',inp.asProv);set('pctSpliced',inp.pctSpliced);
  ```
- **After:**
  ```
    set('useExcess',inp.useExcess);set('asReq',inp.asReq);set('asProv',inp.asProv);set('pctSpliced',inp.pctSpliced);
    set('barSpc',inp.barSpc);set('psiRc',inp.psiRc);   // optional (added later); absent in older saved states
  ```
- **Check case:** ACI, #8, fy = 60,000, f'c = 4,000 (√ = 63.25), λ = 1: ψr = 1.0 (default) → (a) 60,000·1.0/(50·63.25)·1.0 = 18.97 in., (b) 0.0003·60,000·1.0·1.0 = 18.00 → l_dc = **18.97 in.** before and after. ψr = 0.75 → (a) 14.23, (b) 13.50 → l_dc = **14.23 in.** #11 with ψr = 0.75: 26.75 → 20.07 in. AASHTO results unchanged (ψr applies to ACI only). Old saved states have no `psiRc`, so the select keeps its default 1.0.
- **How verified:** node before/after (default case identical; 0.75 case as above); jsdom compression tab shows 14.23 in.
- **Other copies of this code:** `ACI Rebar Development Length.html` (standalone). The same edits, unescaped, are in branch `claude/fix-rebar-dev`.

### F17. ψo hook-location options: correct labels, remove duplicate 1.25 option   [display / bug fix] [no result change]
- **Where:** Dev tab srcdoc, `buildInputPanel`, select `hookLoc` (≈ line 535) and the ψo commentary in `tabHook`. Anchor: `<select id="hookLoc">`
- **Problem:** The 1.25 option read "Other, terminating inside column", which is backwards (terminating inside a column core with ≥ 2.5 in. side cover is the 1.0 case). Two options had `value="1.25"`, so a restored state always showed the first of them.
- **Governing provision:** ACI 318-19 Table 25.4.3.2 (ψo).
- **Escaping:** in this file the code sits inside `srcdoc="…"`, so every `&` is written `&amp;` and every `"` is written `&quot;` (e.g. `&quot;1.25&quot;`, `&amp;lt;`). The Before/After text below is the un-escaped source; escape it the same way when re-applying by hand.
  Edit `psiO-opts`:
- **Before:**
  ```
          <option value="1.0" selected>Confined / cover ≥2.5&quot; (1.0)</option>
          <option value="1.25">Other, terminating inside column (1.25)</option>
          <option value="1.25">Side cover &lt;2.5&quot; (1.25)</option>
  ```
- **After:**
  ```
          <option value="1.0" selected>Inside column/wall core w/ side cover ≥2.5&quot;, or side cover ≥6db (1.0)</option>
          <option value="1.25">Other, e.g. side cover &lt;2.5&quot; (1.25)</option>
  ```
  Edit `psiO-note`:
- **Before:**
  ```
  — Location. A hook near a free edge (side cover < 2.5 in) or terminating inside a column has less surrounding concrete to bear against, so it splits earlier and needs a 1.25 penalty. Well-covered hooks use 1.0.</div>
  ```
- **After:**
  ```
  — Location (Table 25.4.3.2, #11 and smaller). 1.0 where the hook terminates inside a column or structural-wall core with side cover normal to the plane of the hook ≥ 2.5 in., or where that side cover is ≥ 6d_b. All other cases (e.g. a hook near a free edge with side cover < 2.5 in.) have less concrete to bear against and use 1.25.</div>
  ```
- **Check case:** Saved value "1.0" → restores option 1 (1.0); saved "1.25" → restores option 2 (1.25) — previously restored the mislabelled option. Values unchanged, so l_dh is unchanged (ACI #8, fy 60, f'c 4, ψo = 1.25, ψr = 1.6: 29.90 in. before and after).
- **How verified:** jsdom: save/load round-trip with hookLoc = 1.25 restores selectedIndex 1.
- **Other copies of this code:** `ACI Rebar Development Length.html` (standalone). The same edits, unescaped, are in branch `claude/fix-rebar-dev`.

### F18. Dashboard: always-true minimum-length checks shown as "min applied"   [display] [no result change]
- **Where:** Dev tab srcdoc, `buildDashboard` (≈ line 1106) and CSS `.check.info`. Anchor: `info:true, val:fmt(t.ld,1)`
- **Problem:** "Tension l_d ≥ 12 in", "Hook ≥ max(8db,6)", "l_dc ≥ 8" and the two splice ≥ 12 in. rows could never fail because the minimums are applied with Math.max. They looked like real checks.
- **Governing provision:** n/a
- **Escaping:** in this file the code sits inside `srcdoc="…"`, so every `&` is written `&amp;` and every `"` is written `&quot;` (e.g. `&quot;1.25&quot;`, `&amp;lt;`). The Before/After text below is the un-escaped source; escape it the same way when re-applying by hand.
  Edit `css-info`:
- **Before:**
  ```
  .check.fail{background:var(--failbg); border-color:#e6b6b6; color:var(--fail);}
  ```
- **After:**
  ```
  .check.fail{background:var(--failbg); border-color:#e6b6b6; color:var(--fail);}
  .check.info{background:#fff; border-color:var(--line2); color:var(--sub);}
  ```
  Edit `dash-rows`:
- **Before:**
  ```
      {lbl:"Tension l_d ≥ 12 in", ok:t.ld>=12, val:fmt(t.ld,1)+" in"},
      {lbl:"Hook l_dh ≥ max(8d_b,6)", ok:h.ldh>=Math.max(h.min1,6), val:fmt(h.ldh,1)+" in"},
      {lbl:"Comp. l_dc ≥ 8 in", ok:c.ldc>=8, val:fmt(c.ldc,1)+" in"},
      {lbl:"Tension splice ≥ 12 in", ok:ts.lst>=12, val:fmt(ts.lst,1)+" in"},
      {lbl:"Comp. splice ≥ 12 in", ok:cs.lsc>=12, val:fmt(cs.lsc,1)+" in"},
  ```
- **After:**
  ```
      // Display only: these minimums are applied with Math.max in the calcs, so they cannot fail.
      {lbl:"Tension l_d (12 in min applied)", info:true, val:fmt(t.ld,1)+" in"},
      {lbl:"Hook l_dh (8d_b / 6 in min applied)", info:true, val:fmt(h.ldh,1)+" in"},
      {lbl:"Comp. l_dc (8 in min applied)", info:true, val:fmt(c.ldc,1)+" in"},
      {lbl:"Tension splice (12 in min applied)", info:true, val:fmt(ts.lst,1)+" in"},
      {lbl:"Comp. splice (12 in min applied)", info:true, val:fmt(cs.lsc,1)+" in"},
  ```
  Edit `dash-render`:
- **Before:**
  ```
        <div class="check ${k.ok?"pass":"fail"}">
          <span class="lbl">${k.lbl}</span>
          <span class="st">${k.ok?"OK":"CHK"} <span class="val">${k.val}</span></span>
  ```
- **After:**
  ```
        <div class="check ${k.info?"info":(k.ok?"pass":"fail")}">
          <span class="lbl">${k.lbl}</span>
          <span class="st">${k.info?"":(k.ok?"OK":"CHK")} <span class="val">${k.val}</span></span>
  ```
- **Check case:** Default inputs: the five rows now read e.g. "Tension l_d (12 in min applied) 47.4 in" in a neutral tile with no OK/CHK.
- **How verified:** jsdom dashboard text.
- **Other copies of this code:** `ACI Rebar Development Length.html` (standalone). The same edits, unescaped, are in branch `claude/fix-rebar-dev`.

### F19. localStorage.setItem wrapped in try/catch in saveProject/deleteProject   [robustness] [no result change]
- **Where:** Dev tab srcdoc, `saveProject`, `deleteProject` (≈ lines 1300–1325). Anchor: `localStorage.setItem(LS_PROJECTS,JSON.stringify(p));`
- **Problem:** setItem throws when storage is blocked or full; the exception escaped and the user got no message.
- **Governing provision:** n/a
- **Escaping:** in this file the code sits inside `srcdoc="…"`, so every `&` is written `&amp;` and every `"` is written `&quot;` (e.g. `&quot;1.25&quot;`, `&amp;lt;`). The Before/After text below is the un-escaped source; escape it the same way when re-applying by hand.
  Edit `save-try`:
- **Before:**
  ```
    p[name]=collectState();
    localStorage.setItem(LS_PROJECTS,JSON.stringify(p));
  ```
- **After:**
  ```
    p[name]=collectState();
    try{ localStorage.setItem(LS_PROJECTS,JSON.stringify(p)); }
    catch(e){ alert("Could not save: browser storage is blocked or full. Use Export JSON instead."); return; }
  ```
  Edit `del-try`:
- **Before:**
  ```
    localStorage.setItem(LS_PROJECTS,JSON.stringify(p)); refreshProjectList();
  ```
- **After:**
  ```
    try{ localStorage.setItem(LS_PROJECTS,JSON.stringify(p)); }
    catch(e){ alert("Could not delete: browser storage is blocked or full."); return; }
    refreshProjectList();
  ```
- **Check case:** Storage stubbed to throw: Save shows "Could not save … Use Export JSON instead."; Delete shows "Could not delete …". Keys and format unchanged.
- **How verified:** jsdom with a throwing localStorage stub.
- **Other copies of this code:** `ACI Rebar Development Length.html` (standalone). The same edits, unescaped, are in branch `claude/fix-rebar-dev`.

### F20. Excess-reinforcement hint lists the code exclusions   [display] [no result change]
- **Where:** Dev tab srcdoc, panel D2 hint (≈ line 529). Anchor: `Reduces l_d by A<sub>s,req</sub>`
- **Problem:** The hint only said "Not permitted where full fy is required (seismic, etc.)". The tool cannot check location, so the user needs the full list.
- **Governing provision:** ACI 318-19 §25.4.10.2 (a)–(e); AASHTO LRFD 10th Ed. Art. 5.10.8.2.1c (λer).
- **Escaping:** in this file the code sits inside `srcdoc="…"`, so every `&` is written `&amp;` and every `"` is written `&quot;` (e.g. `&quot;1.25&quot;`, `&amp;lt;`). The Before/After text below is the un-escaped source; escape it the same way when re-applying by hand.
  Edit `excess-hint`:
- **Before:**
  ```
      <div class="hint">Reduces l_d by A<sub>s,req</sub>/A<sub>s,prov</sub>. Not permitted where full f<sub>y</sub> is required (seismic, etc.). Also drives Class A splice eligibility.</div>`)}
  ```
- **After:**
  ```
      <div class="hint">Reduces l_d by A<sub>s,req</sub>/A<sub>s,prov</sub>. The tool does not check where the bar is, so <b>do not tick this</b> if any of these apply &mdash; ACI 25.4.10.2: (a) at noncontinuous supports, (b) where anchorage or development for f<sub>y</sub> is required, (c) where bars are required to be continuous, (d) headed or mechanically anchored bars, (e) seismic-force-resisting systems in SDC D, E or F. AASHTO &lambda;<sub>er</sub> (5.10.8.2.1c): not where development for f<sub>y</sub> is specifically required or for seismic (5.11) detailing. Never applied to splices. Also drives Class A splice eligibility.</div>`)}
  ```
- **Check case:** Display only.
- **How verified:** jsdom render.
- **Other copies of this code:** `ACI Rebar Development Length.html` (standalone). The same edits, unescaped, are in branch `claude/fix-rebar-dev`.

## 2026-10-04 — Engineer decisions applied

### F21. Dev tab: its own autosave key `rcsuite.rebar_autosave_v1`, with one-time migration; projects key stays shared   [robustness / saved data] [no result change]
- **Where:** Dev tab srcdoc (`suite-frame-dev`), constants at the top of the main script (anchor `const LS_KEY = &quot;rcsuite.rebar_autosave_v1&quot;;` in the file, `const LS_KEY = "rcsuite.rebar_autosave_v1";` unescaped), and `init()` (anchor `// one-time migration: if this tab has no autosave of its own yet`). The `autosave()` function is unchanged; it writes to `LS_KEY`, which is now the new key.
- **Problem:** O2. The Dev tab and the standalone `ACI Rebar Development Length.html` shared the autosave key `rebar_aci_autosave_v1`. On Chromium `file://` they share one origin, so each tool's autosave overwrote the other's working state.
- **Decision (engineer):** give the embedded Dev tab its own autosave key. Keep `rebar_aci_projects_v1` shared, so saved projects remain visible in both tools.
- **Governing provision:** n/a (CLAUDE.md §5, saved data).
- **Before** (unescaped; in the file `"` is `&quot;`):
  ```js
  const LS_KEY = "rebar_aci_autosave_v1";
  const LS_PROJECTS = "rebar_aci_projects_v1";
  …
    // restore autosave
    let saved=null; try{saved=JSON.parse(localStorage.getItem(LS_KEY));}catch(e){}
  ```
- **After** (unescaped):
  ```js
  const LS_KEY = "rcsuite.rebar_autosave_v1";          // own autosave key for the suite's Dev tab (was shared with the standalone tool)
  const LS_KEY_OLD = "rebar_aci_autosave_v1";          // standalone ACI Rebar Development Length.html autosave; read once for migration, never written or deleted
  const LS_PROJECTS = "rebar_aci_projects_v1";
  …
    // one-time migration: if this tab has no autosave of its own yet, start from the old shared one (left in place)
    try{ if(localStorage.getItem(LS_KEY)===null){ const old=localStorage.getItem(LS_KEY_OLD); if(old!==null) localStorage.setItem(LS_KEY,old); } }catch(e){}
    // restore autosave
    let saved=null; try{saved=JSON.parse(localStorage.getItem(LS_KEY));}catch(e){}
  ```
  The added text has no `&` or `"`, so it needs no escaping inside the srcdoc. The two constant lines were escaped (`"` → `&quot;`). CRLF line endings were preserved.
- **Saved data / migration:** the old key `rebar_aci_autosave_v1` is read once and copied into the new key **only if the new key is absent**. The old key is never altered or deleted. The projects key `rebar_aci_projects_v1` is unchanged and shared.
- **Check case:**
  - Migration statement, run in node with a localStorage stub:
    - (A) only the old key `{"inp":{"barSize":"7"}}` → the new key is created with the same value; the old key is unchanged.
    - (B) both keys present (old #7, new #9) → nothing is copied; the new key stays #9.
    - (C) neither key → nothing is written.
    - (D) new key only → unchanged.
  - jsdom boot of the unescaped Dev srcdoc:
    - Old autosave #7 plus a project store → the tab opens with bar #7. After an edit to #5 and `autosave()`, the new key holds #5, while the old key still holds #7 and `rebar_aci_projects_v1` is untouched.
    - Both keys present (old #7, new #9) → the tab opens with #9.
- **How verified:** unescaped the Dev srcdoc and ran `node --check` on its inline script: OK. Ran the migration stub test and the jsdom boot test (scratch `w/cbc_mig.js`), with no page errors.
- **Other copies of this code:** the standalone `ACI Rebar Development Length.html` intentionally keeps the old key `rebar_aci_autosave_v1` (and the shared `rebar_aci_projects_v1`). It is not changed.

## Open items (not changed)
- O1. **ACI 318-19 §9.3.3.1 beam minimum strain** (`dEpsMin`, ACI branch) still checks εt ≥ 0.004. The review believes 318-19 changed this to εty + 0.003; I am not certain of the 318-19 wording, so per instructions the code is unchanged. — Please confirm against your copy of ACI 318-19 §9.3.3.1. If it reads εty + 0.003, change `0.004` to `S.mat.fy/ES+0.003` in that check (ACI only).
- O3. **ACI Gr 60 εty.** F2 uses εty = fy/Es (0.002069 for Gr 60, so εtl = 0.005069). ACI 318-19 §21.2.2.1 permits εty = 0.002 for Grade 60, which would keep εtl = 0.005 and slightly raise φ in the transition zone. — Prefer the 0.002 permission for Gr 60?
- O4. **AASHTO φ for fy > 75 ksi.** `phiFlex` AASHTO branch keeps εtl = 0.005 and εcl = fy/Es; AASHTO 10th Ed. 5.5.4.2 / 5.6.2.1 vary these for higher-strength bars (εtl up to 0.008 at 100 ksi). Not changed (edition detail not re-verified). The tool warns above 75 ksi.
- O5. **AASHTO transverse-reinforcement yield limit** (fyt) not applied; the 60 ksi cap (F7) is ACI only. — Confirm the 10th Ed. limit to apply (5.4.3.1 / 5.7.2.8).
- O6. **ACI torsion longitudinal steel fy ≤ 60 ksi** (Table 20.2.2.4(a) also limits the longitudinal torsion bars). Not applied (only fyt was in scope); `torsion()` and the Al checks still use S.mat.fy. — Apply?
- O7. **AASHTO sxe assumptions** (F5): sx = dv (no intermediate crack-control layers modelled) and ag = 0 for f'c > 10 ksi. Both conservative. — Confirm, or add an sx input.
- O8. **AASHTO α1** fixed at 0.85 (5.6.2.2 reduces it above 10 ksi). Not changed.
- O9. **ACI Av,min trigger** uses 0.5φVc (318-14 wording); 318-19 Table 9.6.3.1 uses φλ√f'c·bw·d. Conservative; not changed.
- O10. **T-beam torsion** uses web-only Acp/pcp: conservative for the threshold but lowers φTcr for compatibility torsion. Not changed.
- O11. **Al,min** uses expression (a) of 9.6.4.3 only (conservative vs "lesser of (a), (b)"). Not changed.
- O12. **Edition labels** still read "AASHTO LRFD 9th" (code selector, input echo, "9th-Edition γ factors" title). Not relabelled because the remaining AASHTO provisions were not all re-verified against the 10th Ed. — Confirm and relabel in a follow-up.
- O13. **ASD tab, other items not in scope:** silent fallbacks in `compute()` (f'c → 3,000, d → 1, etc.) are unchanged (fixed only in the standalone ASD tool); the ASD tab still takes the Capacity title block wholesale on each refresh; no visible scope note for compression steel / ASD shear; operating fc = 1,900 psi (MassDOT — needs confirmation, kept as the default).
- O14. **ASD tab older saved states**: where saved allowables differ from the f'c/fy-based values they are kept as overrides (label "(override)"); the user must click "Recompute allowables" to switch to the code values. Intentional (saved data not silently replaced).
- O15. **γ3 options** limited to 0.67 / 0.75 / 0.76. Other specifications (e.g. A1035) not offered. — Add?
- O16. **CDN / libraries:** three.js r160 `build/three.min.js` path may 404 (UMD build removed); two Plotly and two KaTeX versions load. Not changed (no library changes without approval).
- O17. **Default title block** "MBTA — Mini-Highs" / "M. Lococo" hardcoded in defaults. Not changed.
- O18. **Dev tab open items** are the same as `fixlog/ACI Rebar Development Length.md` O1–O10 (headed bars not implemented, AASHTO #14/#18 lap rule, fixed λ = 0.75, etc.).

## Resolved items
- O2. **Storage collision (shared rebar keys).** The Dev tab and the standalone `ACI Rebar Development Length.html` both use `rebar_aci_autosave_v1` / `rebar_aci_projects_v1`; on Chromium `file://` they share one origin, so autosaves overwrite each other and simultaneous project saves can race. Keys not changed (CLAUDE.md §5). — Decision needed: keep shared (projects visible in both, as now), or give the suite copy its own prefixed keys with a one-time migration that copies the existing data.
  - **RESOLVED 2026-10-04 (F21):** engineer accepted the recommendation. The Dev tab now has its own autosave key `rcsuite.rebar_autosave_v1`, with a one-time copy from `rebar_aci_autosave_v1` (the old key is left in place). `rebar_aci_projects_v1` stays shared.
