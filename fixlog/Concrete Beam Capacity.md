# Fix log — Concrete Beam Capacity.html

Governing basis used for fixes: ACI 318-19; AASHTO LRFD 10th Ed. (2024); ASD tab: AASHTO Standard Specifications 17th Ed. (2002) Art. 8.15 and MBE Art. 6B.6.2.3. MassDOT values kept as-is.

## 2026-10-04 — PR: claude/fix-concrete-capacity (PR #17: https://github.com/mlococo88/All-Structural/pull/17)

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

## 2026-10-04 — PR: claude/step1-group4 (PR #30: https://github.com/mlococo88/All-Structural/pull/30)
### S1. "← All tools" link and shared project info   [feature (no result change)]
- **Date / type:** 2026-10-04, feature (no result change).
- **Where:** Outer shell only: shell `<style>` (after `.suite-frame-wrap iframe{...}`), `#suite-nav` (after the "Development & Splice" tab button), and two new `<script>` blocks before the final `</body>`. **No srcdoc content was changed.**
- **Purpose:** link back to `tools.html` (`target="_top"`, hidden in print); "Use shared project info" / "Share project info" on the `bridgeSuite.v1.projectMeta` channel (`_schema:"bridge-project-meta"`, HANDOFF.md §4.1). Use reads with `BridgeXfer.read('projectMeta','bridge-project-meta',1)`, shows a confirm listing every field that will be overwritten (old → new), writes only fields this tool has, never blanks a field when the shared value is empty, and skips a non-`YYYY-MM-DD` value for a date input.
- **Field mapping:** Beam Capacity and ASD tabs: `data-fkey="pg_Project"` → projectName; `pg_Project No.` → jobNo; `pg_Calculated By` → preparedBy; `pg_Checked By` → checkedBy; `pg_Date` (date input) → date. Development & Splice tab: projName, projNo, calcBy, chkBy, calcDate (date input), as in ACI Rebar Development Length.html. Not in this tool (sent as ""): bridgeId, client, location. Subject, Sheet and Checked Date are not mapped.
- **Governing provision:** none (no engineering change). Spec: HANDOFF.md §4.1 and §5.
- **Before / After** (exact; edits applied in this order, each anchor occurs once; line endings preserved):
  1.
     - Before:
  ```html
    .suite-frame-wrap iframe{width:100%;height:100%;border:0;display:block;background:#fff;}
  </style>
  ```
     - After:
  ```html
    .suite-frame-wrap iframe{width:100%;height:100%;border:0;display:block;background:#fff;}
    #suite-xfer{margin-left:auto;display:flex;align-items:center;gap:6px;padding-left:10px;}
    #suite-xfer .alltools{font-size:11.5px;color:#c7d4e4;text-decoration:none;white-space:nowrap;margin-right:4px;}
    #suite-xfer .alltools:hover{color:#fff;text-decoration:underline;}
    #suite-xfer button{font-size:11px;padding:3px 9px;border:1px solid rgba(255,255,255,.25);border-radius:4px;
      background:rgba(255,255,255,.06);color:#c7d4e4;cursor:pointer;white-space:nowrap;}
    #suite-xfer button:hover{background:rgba(255,255,255,.14);color:#fff;}
    @media print{#suite-xfer{display:none!important;}}
  </style>
  ```
  2.
     - Before:
  ```html
      <button class="suite-tab" id="suite-tab-dev" data-target="dev"><span class="dot"></span>Development &amp; Splice</button>
    </nav>
  ```
     - After:
  ```html
      <button class="suite-tab" id="suite-tab-dev" data-target="dev"><span class="dot"></span>Development &amp; Splice</button>
      <div id="suite-xfer">
        <a class="alltools" href="tools.html" target="_top">&larr; All tools</a>
        <button type="button" onclick="bxUseProjectInfo()" title="Fill the title blocks of all three tabs from the shared project info">Use shared project info</button>
        <button type="button" onclick="bxShareProjectInfo()" title="Share the title block of the active tab with the other tools">Share project info</button>
      </div>
    </nav>
  ```
  3. Final `</body>`.
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
     The title-block inputs live in the three embedded tabs (srcdoc iframes, which have this page's
     origin). The shell reads/writes those inputs directly through their normal input events; the
     embedded apps themselves are not modified. Share reads the active tab; Use writes every tab. */
  (function(){
    var PRODUCER='Concrete Beam Design Suite', FILE='Concrete Beam Capacity.html';
    var PG={projectName:'[data-fkey="pg_Project"]', jobNo:'[data-fkey="pg_Project No."]',
            preparedBy:'[data-fkey="pg_Calculated By"]', checkedBy:'[data-fkey="pg_Checked By"]', date:'[data-fkey="pg_Date"]'};
    var APPS=[
      {id:'capacity', name:'Beam Capacity',        frame:'suite-frame-capacity', map:PG},
      {id:'asd',      name:'ASD Beam Calcs',       frame:'suite-frame-asd',      map:PG},
      {id:'dev',      name:'Development & Splice', frame:'suite-frame-dev',
       map:{projectName:'#projName', jobNo:'#projNo', preparedBy:'#calcBy', checkedBy:'#chkBy', date:'#calcDate'}}];
    var KEYS=['projectName','bridgeId','jobNo','client','location','preparedBy','checkedBy','date'];
    var LBL={projectName:'Project name',bridgeId:'Bridge ID',jobNo:'Job no.',client:'Client',location:'Location',
             preparedBy:'Prepared by',checkedBy:'Checked by',date:'Date'};
    function doc(a){ try{ var fr=document.getElementById(a.frame); return fr ? fr.contentDocument : null; }catch(e){ return null; } }
    function fld(a,d,k){ try{ return (d && a.map[k]) ? d.querySelector(a.map[k]) : null; }catch(e){ return null; } }
    function active(){
      var t=document.querySelector('.suite-tab.active'), id=t ? t.getAttribute('data-target') : 'capacity';
      for(var i=0;i<APPS.length;i++) if(APPS[i].id===id) return APPS[i];
      return APPS[0];
    }
    window.bxShareProjectInfo=function(){
      var a=active(), d=doc(a);
      if(!d || !fld(a,d,'projectName')){ alert('Could not read the title block of the '+a.name+' tab. Wait for it to load, then try again.'); return; }
      var f={};
      KEYS.forEach(function(k){ var e=fld(a,d,k); f[k]=e ? String(e.value||'') : ''; });
      var r=BridgeXfer.publish('projectMeta',{_schema:'bridge-project-meta',fields:f},PRODUCER+' — '+a.name,FILE);
      alert(r.ok ? 'Project info from the '+a.name+' tab shared. Other tools can load it with "Use shared project info".' : r.error);
    };
    window.bxUseProjectInfo=function(){
      var r=BridgeXfer.read('projectMeta','bridge-project-meta',1);
      if(!r.ok){ alert('Shared project info: '+r.error); return; }
      var f=r.payload.fields||{}, ch=[], skip=[], lines=[];
      APPS.forEach(function(a){
        var d=doc(a); if(!d) return;
        KEYS.forEach(function(k){
          var e=fld(a,d,k), v=(f[k]==null) ? '' : String(f[k]);
          if(!e || v==='') return;   /* field not in this tab, or shared value empty: never blank a field */
          if(e.type==='date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)){ skip.push(a.name+' / '+LBL[k]+' ("'+v+'" is not a YYYY-MM-DD date)'); return; }
          if(e.value!==v){ ch.push({e:e,v:v}); lines.push('  '+a.name+' / '+LBL[k]+': "'+e.value+'" → "'+v+'"'); }
        });
      });
      var head='Shared project info from '+BridgeXfer.describe(r.payload);
      var sk=skip.length ? '\n\nSkipped: '+skip.join('; ') : '';
      if(!ch.length){ alert(head+'\n\nNothing to change: the matching fields already hold these values.'+sk); return; }
      if(!confirm(head+'\n\nThese fields will be overwritten:\n'+lines.join('\n')+sk+'\n\nContinue?')) return;
      ch.forEach(function(c){ c.e.value=c.v; c.e.dispatchEvent(new Event('input',{bubbles:true})); });
      /* let Beam Capacity re-send its project identity to the ASD tab over the existing bridge */
      try{ var cf=document.getElementById('suite-frame-capacity'); if(cf && cf.contentWindow) cf.contentWindow.postMessage({type:'requestShared'},'*'); }catch(e){}
    };
  })();
  </script>
  </body>
  ```
- **Behaviour notes:** **Design choice (logged as asked):** the buttons live in the shell, not inside the HTML-escaped srcdoc apps. srcdoc iframes have the shell's origin, so the shell reads and writes the tabs' title-block inputs directly and dispatches a bubbling `input` event, which runs each tab's own handler (`set(...)` + `autosave()` in Capacity/ASD; `render()` → autosave in Development & Splice). This avoids editing escaped code. **Share** reads the active tab. **Use** writes every tab that has the field (one confirm lists tab / field / old → new) and then posts the existing `{type:'requestShared'}` message to the Capacity tab, so the existing bridge re-sends the project identity to the ASD tab (the ASD tab inherits `proj` from Capacity). If a tab's document cannot be reached, it is skipped; Share then shows a message.
- **Saved data:** no existing key or format changed. New keys are only the HANDOFF channel keys `bridgeSuite.v1.projectMeta` and `bridgeSuite.v1.projectMeta.updatedAt`, written on "Share project info".
- **Check case:** n/a, no computed result changes. Hand check: open the tool, type a project name, click "Share project info"; open another tool, click "Use shared project info", accept the confirm; the name appears and survives a reload.
- **How verified:** Every plain inline script syntax-checked (Node `vm.Script`, same parser as `node --check`); BridgeXfer block compared byte-for-byte with HANDOFF.md §5; page loaded in jsdom (CDN scripts not loaded) before and after the change with no new errors; Share → Use exercised between tools with jsdom localStorage (ASCE7-16 → ACI Rebar, Steel Beam → Shear and Moment, Concrete Beam Capacity shell against stub tab documents), including cancel, empty shared values (field kept), a non-ISO date on a date input (skipped), an empty channel and a wrong `_schema` (refused). `git diff` shows no removed lines other than the ones listed under Before. No calculation code was touched.
- **Other copies of this code:** none (the embedded apps are untouched). BridgeXfer v1 is also in: ACI Rebar Development Length.html, ASCE7-16 Load Generator.html, Concrete Beam Capacity.html (shell), Steel Beam Design - AISC 15th.html, Shear and Moment Diagrams.html.

## 2026-10-09 — Input panel tabs (branch claude/tabs-concretebeamcapacity)
### T1. Input panels of all three sub-apps split into tabs   [UI only — no calculation change]
- **Date:** 2026-10-09. **Type:** UI only. No calculation change. Engineer's request (2026-10-09): "make sure they are all formatted with the input panel having tabs rather than one long scrolling input panel."
- **What:** each sub-app still builds its input sections exactly as before; a new function then **moves** the finished section nodes into one pane per tab (same approach as `Steel Beam Design - AISC 15th.html`). Nothing is rebuilt, so every id, `data-fkey`, handler and value is unchanged, and the sections keep their original document order and numbering. Capacity and ASD rebuild their input panel on every `refresh()`, so the move runs at the end of each `buildInput()`; the active tab is held in memory as well as in storage, so it survives the rebuild, and the existing `captureUI()`/`restoreUI()` keep the focus and caret while typing. The tab buttons carry a `data-fkey`, so `restoreUI()` also keeps keyboard focus on them. Sections that appear only in some modes keep doing so; a tab with no sections is hidden.

  **Beam Capacity** (`#suite-frame-capacity`; section numbers as shown for ACI, AASHTO renumbers them without gaps as before):

  | Tab | Sections |
  |---|---|
  | Section | 1. Section Geometry |
  | Materials & Cover | 2. Materials, 3. Cover & Exposure |
  | Reinforcement | 4. Reinforcement Layers, 5. Transverse Reinforcement |
  | Checks | 6. Torsion (ACI only; not built for AASHTO), 7. Crack Control |
  | Loads | 8. Load Combinations |
  | Assumptions | 9. Engineering Assumptions |

  **ASD Beam Calcs** (`#suite-frame-asd`). Tabs were added because the four cards are about 1,100 px tall in a 713 px panel at 1400×900 (the panel scrolls); with tabs each pane fits without scrolling.

  | Tab | Sections |
  |---|---|
  | Mode & Section | 1. Analysis Mode, 2. From Beam Capacity (moment sense selects which d and A_s are shown) |
  | Allowables | 3. Allowable Stresses |
  | Loads | 4. Applied Load Effects |

  **Development & Splice** (`#suite-frame-dev`): synced with `ACI Rebar Development Length.html` fix log T1 (PR #64). Same six tabs: Project (A) | Code & Material (B) | Tension (C, D, D2) | Hook & Comp. (E, E2) | Splices (F) | Assumptions & Save (G, H).

- **Tab strip:** sticky at the top of the scrolling input panel, wraps on narrow screens. Capacity and ASD strips reuse the look of each app's own output tab bar (`#tabBar`: slate buttons, rounded tops, active tab in the panel colour). ARIA `tablist`/`tab`/`tabpanel`; Left/Right/Up/Down (wrapping), Home, End.
- **Error marker (red dot):** Capacity: a `validate()` blocker that comes from an input (code "Geometry" → Section, except "Layer n depth d … falls outside the section" → Reinforcement; "Reinforcement" → Reinforcement; "Stirrups" → Reinforcement; "Loads" → Loads), or a number input the browser cannot parse. Warnings and notes set no dot. ASD: an `.errBox`/`.warnBox` inside a section (today only "No live values received yet" in From Beam Capacity), or an unparseable number input. Dev: as in the standalone (T1 there).
- **New storage keys (per browser; never in `S`, the autosave, saved projects or the JSON export):** `rcbeam_v2_inputTab_v1` (Capacity, prefix of `rcbeam_v2_auto` / `rcbeam_v2_projects`), `asd_v1_inputTab_v1` (ASD, prefix of `asd_v1_auto` / `asd_v1_projects`), `rebar_aci_inputTab_v1` (Dev; shared with the standalone ACI Rebar tool, as `rebar_aci_projects_v1` already is). All reads and writes are in try/catch with an in-memory fallback. No existing key or saved format changed.
- **Print:** unchanged. Capacity and ASD print `#printReport` (built from the outputs) and hide `#app` in print media; the Dev copy prints `#printroot` as before.
- **Escaping:** all code below sits inside `srcdoc="…"`. It is given un-escaped; when re-applying by hand write every `&` as `&amp;` and every `"` as `&quot;` (the blocks use single quotes, so in practice only `&&` → `&amp;&amp;` and the `&` in labels). `<` and `>` are left as-is, like the rest of the srcdoc. CRLF line endings kept. All changes are insertions; no existing line was changed or removed.
- **Where / Before / After — Beam Capacity** (restrict each search to the `suite-frame-capacity` srcdoc; each anchor occurs once there):
  1. CSS. Anchor (kept): `table.cbT button:hover{color:var(--red-600)}`. Insert after it:
  ```css
/* ---- input panel tabs (rcbInputTabs; UI only) ---- */
#rcbInTabs{position:sticky;top:-10px;z-index:12;display:flex;flex-wrap:wrap;gap:3px;margin:-10px -12px 6px;
  padding:7px 12px 0;background:var(--slate-100);border-bottom:1px solid var(--color-border)}
#rcbInTabs .rcbInTab{display:inline-flex;align-items:center;font-family:var(--font-ui);font-size:9pt;padding:5px 10px;
  cursor:pointer;border:1px solid var(--color-border);border-bottom:none;background:var(--slate-200);
  border-radius:5px 5px 0 0;color:#334155;position:relative;top:1px}
#rcbInTabs .rcbInTab:hover{background:#dde2e8}
#rcbInTabs .rcbInTab[aria-selected='true']{background:var(--color-bg);color:var(--ink);font-weight:600;
  border-bottom:1px solid var(--color-bg)}
#rcbInTabs .rcbInTab:focus-visible{outline:2px solid var(--blue-600);outline-offset:-2px}
.rcbInDot{display:none;width:7px;height:7px;border-radius:50%;background:var(--fail);margin-left:6px}
.rcbInTab.has-err .rcbInDot{display:inline-block}
.rcbInTab[hidden],.rcbInPane[hidden]{display:none!important}
  ```
  2. JS. Anchor (kept): the end of `mkSection()`: `  parent.appendChild(sec); return sec;` / `}`. Insert after it (before the `TITLE BLOCK (§13)` banner):
  ```js
/* =====================================================================
   INPUT PANEL TABS (UI only)
   buildInput() still builds every section into #inputPanel exactly as
   before; rcbInputTabs() then MOVES the finished section nodes into one
   pane per tab, in their original order. Nothing is rebuilt, so ids,
   data-fkey keys, handlers and values are untouched. The active tab is
   remembered per browser in localStorage key rcbeam_v2_inputTab_v1 (never
   in S, so the autosave, saved projects and the JSON export are unchanged).
   ===================================================================== */
const RCB_IN_TABS=[
  ['section','Section'],['materials','Materials & Cover'],['reinf','Reinforcement'],
  ['checks','Checks'],['loads','Loads'],['assume','Assumptions']];
const RCB_IN_SEC={inSection:'section',inMat:'materials',inCover:'materials',
  inRebar:'reinf',inStir:'reinf',inTor:'checks',inCrack:'checks',
  inLoads:'loads',inAssume:'assume'};
/* validate() blockers that come from an input, mapped to the section holding it */
const RCB_IN_BLOCK=[
  [b=>/^Layer \d+ depth/.test(b.msg),'inRebar'],
  [b=>b.code==='Geometry','inSection'],
  [b=>b.code==='Reinforcement','inRebar'],
  [b=>b.code==='Stirrups','inStir'],
  [b=>b.code==='Loads','inLoads']];
const RCB_IN_KEY='rcbeam_v2_inputTab_v1';
let rcbInTabCur=null;   /* in-memory copy, so the tab survives rebuilds even without storage */
function rcbInTabGet(){ if(rcbInTabCur) return rcbInTabCur; try{ return localStorage.getItem(RCB_IN_KEY)||''; }catch(e){ return ''; } }
function rcbInTabSet(t){ rcbInTabCur=t; try{ localStorage.setItem(RCB_IN_KEY,t); }catch(e){} }
function rcbInputTabs(P){
  const bar=el('div'); bar.id='rcbInTabs'; bar.setAttribute('role','tablist'); bar.setAttribute('aria-label','Input groups');
  const panes={};
  RCB_IN_TABS.forEach(([k,lab])=>{
    const b=tag(el('button','rcbInTab'),'rcbInTab_'+k); b.type='button'; b.id='rcbInTab_'+k; b.dataset.pane=k;
    b.setAttribute('role','tab'); b.setAttribute('aria-controls','rcbInPane_'+k);
    b.appendChild(el('span',null,lab));
    const dot=el('span','rcbInDot'); dot.setAttribute('aria-hidden','true'); b.appendChild(dot);
    b.addEventListener('click',()=>rcbSetInTab(k,true));
    b.addEventListener('keydown',rcbInTabKey);
    bar.appendChild(b);
    const pn=el('div','rcbInPane'); pn.id='rcbInPane_'+k; pn.setAttribute('role','tabpanel');
    pn.setAttribute('aria-labelledby','rcbInTab_'+k);
    panes[k]=pn;
  });
  /* move the built nodes; a node not in the map stays with the section before it */
  let cur='section';
  Array.from(P.childNodes).forEach(n=>{
    if(n.id&&RCB_IN_SEC[n.id]) cur=RCB_IN_SEC[n.id];
    panes[cur].appendChild(n);
  });
  P.appendChild(bar);
  RCB_IN_TABS.forEach(([k])=>{
    P.appendChild(panes[k]);
    document.getElementById('rcbInTab_'+k).hidden=!panes[k].childNodes.length;
  });
  let t=rcbInTabGet();
  if(!panes[t]||!panes[t].childNodes.length) t='section';
  rcbSetInTab(t,false);
  rcbInputTabMarks();
}
function rcbSetInTab(t,remember){
  RCB_IN_TABS.forEach(([k])=>{
    const b=document.getElementById('rcbInTab_'+k), pn=document.getElementById('rcbInPane_'+k); if(!b||!pn) return;
    const on=(k===t);
    b.setAttribute('aria-selected',on?'true':'false'); b.tabIndex=on?0:-1;
    pn.hidden=!on;
  });
  if(remember){ rcbInTabSet(t); const P=document.getElementById('inputPanel'); if(P) P.scrollTop=0; }
}
function rcbInTabKey(e){
  const vis=RCB_IN_TABS.map(([k])=>document.getElementById('rcbInTab_'+k)).filter(b=>b&&!b.hidden);
  const i=vis.indexOf(e.currentTarget); let j=-1;
  if(e.key==='ArrowRight'||e.key==='ArrowDown') j=(i+1)%vis.length;
  else if(e.key==='ArrowLeft'||e.key==='ArrowUp') j=(i-1+vis.length)%vis.length;
  else if(e.key==='Home') j=0;
  else if(e.key==='End') j=vis.length-1;
  if(j<0) return;
  e.preventDefault(); rcbSetInTab(vis[j].dataset.pane,true); vis[j].focus();
}
/* red dot on a tab holding an input named in a validate() blocker, or a
   number field the browser cannot parse (display only) */
function rcbInputTabMarks(){
  if(!document.getElementById('rcbInTabs')) return;
  const bad={};
  const mark=n=>{ const pn=n&&n.closest('.rcbInPane'); if(pn) bad[pn.id.replace('rcbInPane_','')]=1; };
  ((VALIDATION&&VALIDATION.blockers)||[]).forEach(b=>{
    const m=RCB_IN_BLOCK.find(r=>r[0](b)); if(m) mark(document.getElementById(m[1])); });
  document.querySelectorAll('#inputPanel .rcbInPane input').forEach(i=>{ if(i.validity&&i.validity.badInput) mark(i); });
  RCB_IN_TABS.forEach(([k])=>{
    const b=document.getElementById('rcbInTab_'+k); if(!b) return;
    b.classList.toggle('has-err',!!bad[k]);
    b.title=bad[k]?'An input on this tab needs attention':'';
  });
}
  ```
  3. `buildInput()`. Anchor (kept): the end of the last section: `    b.appendChild(ta);` / `  },P);`. Insert before the closing `}` of `buildInput()`:
  ```js
  rcbInputTabs(P);   /* move the sections just built into the input tabs (UI only) */
  ```
- **Where / Before / After — ASD Beam Calcs** (restrict each search to the `suite-frame-asd` srcdoc):
  1. CSS. Anchor (kept): `table.cbT button:hover{color:var(--red-600)}`. Insert after it:
  ```css
/* ---- input panel tabs (asdInputTabs; UI only) ---- */
#asdInTabs{position:sticky;top:-10px;z-index:12;display:flex;flex-wrap:wrap;gap:3px;margin:-10px -12px 6px;
  padding:7px 12px 0;background:var(--slate-100);border-bottom:1px solid var(--color-border)}
#asdInTabs .asdInTab{display:inline-flex;align-items:center;font-family:var(--font-ui);font-size:9pt;padding:5px 10px;
  cursor:pointer;border:1px solid var(--color-border);border-bottom:none;background:var(--slate-200);
  border-radius:5px 5px 0 0;color:#334155;position:relative;top:1px}
#asdInTabs .asdInTab:hover{background:#dde2e8}
#asdInTabs .asdInTab[aria-selected='true']{background:var(--color-bg);color:var(--ink);font-weight:600;
  border-bottom:1px solid var(--color-bg)}
#asdInTabs .asdInTab:focus-visible{outline:2px solid var(--blue-600);outline-offset:-2px}
.asdInDot{display:none;width:7px;height:7px;border-radius:50%;background:var(--fail);margin-left:6px}
.asdInTab.has-err .asdInDot{display:inline-block}
.asdInTab[hidden],.asdInPane[hidden]{display:none!important}
  ```
  2. JS. Anchor (kept): the end of `mkSection()`: `  parent.appendChild(sec); return sec;` / `}`. Insert after it (before the `INPUT PANEL` banner):
  ```js
/* =====================================================================
   INPUT PANEL TABS (UI only)
   buildInput() still builds every section into #inputPanel exactly as
   before; asdInputTabs() then MOVES the finished section nodes into one
   pane per tab, in their original order. Nothing is rebuilt, so ids,
   data-fkey keys, handlers and values are untouched. The active tab is
   remembered per browser in localStorage key asd_v1_inputTab_v1 (never
   in S, so the autosave, saved projects and the JSON export are unchanged).
   ===================================================================== */
const ASD_IN_TABS=[['section','Mode & Section'],['allow','Allowables'],['loads','Loads']];
const ASD_IN_SEC={inMode:'section',inInherit:'section',inAllow:'allow',inLoads:'loads'};
const ASD_IN_KEY='asd_v1_inputTab_v1';
let asdInTabCur=null;   /* in-memory copy, so the tab survives rebuilds even without storage */
function asdInTabGet(){ if(asdInTabCur) return asdInTabCur; try{ return localStorage.getItem(ASD_IN_KEY)||''; }catch(e){ return ''; } }
function asdInTabSet(t){ asdInTabCur=t; try{ localStorage.setItem(ASD_IN_KEY,t); }catch(e){} }
function asdInputTabs(P){
  const bar=el('div'); bar.id='asdInTabs'; bar.setAttribute('role','tablist'); bar.setAttribute('aria-label','Input groups');
  const panes={};
  ASD_IN_TABS.forEach(([k,lab])=>{
    const b=tagf(el('button','asdInTab'),'asdInTab_'+k); b.type='button'; b.id='asdInTab_'+k; b.dataset.pane=k;
    b.setAttribute('role','tab'); b.setAttribute('aria-controls','asdInPane_'+k);
    b.appendChild(el('span',null,lab));
    const dot=el('span','asdInDot'); dot.setAttribute('aria-hidden','true'); b.appendChild(dot);
    b.addEventListener('click',()=>asdSetInTab(k,true));
    b.addEventListener('keydown',asdInTabKey);
    bar.appendChild(b);
    const pn=el('div','asdInPane'); pn.id='asdInPane_'+k; pn.setAttribute('role','tabpanel');
    pn.setAttribute('aria-labelledby','asdInTab_'+k);
    panes[k]=pn;
  });
  /* move the built nodes; a node not in the map stays with the section before it */
  let cur='section';
  Array.from(P.childNodes).forEach(n=>{
    if(n.id&&ASD_IN_SEC[n.id]) cur=ASD_IN_SEC[n.id];
    panes[cur].appendChild(n);
  });
  P.appendChild(bar);
  ASD_IN_TABS.forEach(([k])=>{
    P.appendChild(panes[k]);
    document.getElementById('asdInTab_'+k).hidden=!panes[k].childNodes.length;
  });
  let t=asdInTabGet();
  if(!panes[t]||!panes[t].childNodes.length) t='section';
  asdSetInTab(t,false);
  asdInputTabMarks();
}
function asdSetInTab(t,remember){
  ASD_IN_TABS.forEach(([k])=>{
    const b=document.getElementById('asdInTab_'+k), pn=document.getElementById('asdInPane_'+k); if(!b||!pn) return;
    const on=(k===t);
    b.setAttribute('aria-selected',on?'true':'false'); b.tabIndex=on?0:-1;
    pn.hidden=!on;
  });
  if(remember){ asdInTabSet(t); const P=document.getElementById('inputPanel'); if(P) P.scrollTop=0; }
}
function asdInTabKey(e){
  const vis=ASD_IN_TABS.map(([k])=>document.getElementById('asdInTab_'+k)).filter(b=>b&&!b.hidden);
  const i=vis.indexOf(e.currentTarget); let j=-1;
  if(e.key==='ArrowRight'||e.key==='ArrowDown') j=(i+1)%vis.length;
  else if(e.key==='ArrowLeft'||e.key==='ArrowUp') j=(i-1+vis.length)%vis.length;
  else if(e.key==='Home') j=0;
  else if(e.key==='End') j=vis.length-1;
  if(j<0) return;
  e.preventDefault(); asdSetInTab(vis[j].dataset.pane,true); vis[j].focus();
}
/* red dot on a tab whose section shows an error/warning box (e.g. no live
   values received from Beam Capacity), or holding a number field the
   browser cannot parse (display only) */
function asdInputTabMarks(){
  if(!document.getElementById('asdInTabs')) return;
  const bad={};
  const mark=n=>{ const pn=n&&n.closest('.asdInPane'); if(pn) bad[pn.id.replace('asdInPane_','')]=1; };
  document.querySelectorAll('#inputPanel .asdInPane .errBox,#inputPanel .asdInPane .warnBox').forEach(mark);
  document.querySelectorAll('#inputPanel .asdInPane input').forEach(i=>{ if(i.validity&&i.validity.badInput) mark(i); });
  ASD_IN_TABS.forEach(([k])=>{
    const b=document.getElementById('asdInTab_'+k); if(!b) return;
    b.classList.toggle('has-err',!!bad[k]);
    b.title=bad[k]?'An input on this tab needs attention':'';
  });
}
  ```
  3. `buildInput()`. Anchor (kept): the end of section 4: `      "RF = (C − M_DL) / M_{LL+I}."));` / `  },P);`. Insert before the closing `}` of `buildInput()`:
  ```js
  asdInputTabs(P);   /* move the sections just built into the input tabs (UI only) */
  ```
- **Where / Before / After — Development & Splice** (restrict to the `suite-frame-dev` srcdoc): the four insertions of `fixlog/ACI Rebar Development Length.md` T1, copied verbatim from `ACI Rebar Development Length.html` and escaped:
  1. CSS block `/* ---- Input panel tabs (rebarInputTabs; UI only) ---- */` (13 lines) after `.panel.collapsed .panel-body{display:none;}`.
  2. JS block `INPUT PANEL TABS (UI only)` … end of `rebarInputTabMarks()` (104 lines) between the end of `togglePanel()` and the `VALIDATION` banner.
  3. `  rebarInputTabMarks(w);   // input tabs: red dot on a tab with an input that needs attention (display only)` after `  updateCodeHint(inp);` in `render()`.
  4. `  rebarInputTabs();   // move the input panels into the input tabs (before any state is applied)` after `  buildInputPanel();` in `init()`.
- **Problem:** UI request only (one long scrolling input panel). No result change.
- **Governing provision:** none. No formula, factor, unit, code reference or computed result changed.
- **Check case:** not applicable. Results are identical, see below.
- **How verified:**
  - Each srcdoc extracted and HTML-unescaped, then `node --check` on every inline script of the shell and of the three sub-apps, main and branch (7 blocks each, 0 failures). The un-escaped main → branch diff of each sub-app is insertions only (Capacity 106 lines, ASD 95, Dev 119).
  - Dev copy against the standalone: a line diff of `ACI Rebar Development Length.html` before → after PR #64 and of the un-escaped Dev srcdoc main → branch gives the same four insertions, at the same anchor lines, with identical text.
  - Headless Chromium (Playwright, Chromium 1194). Libraries served locally at the pinned versions (`npm pack`): KaTeX 0.16.11 and 0.16.9, Plotly 2.32.0 (`plotly.js-dist-min`, same build as cdn.plot.ly) and 2.27.0, three.js 0.160.0.
  - Main and branch compared in 30 states. Capacity (15): default, signed moments on all three combinations, AASHTO, T-beam, torsion off, crack control user f_s, crack control computed f_s, stirrups off, manual layer depth, b_w = 0 (blocked), stirrup s = 0 (blocked), layer d outside the section (blocked), changed materials/bars/cover with T_u, added layer and combination, title block + assumptions. ASD (8): default, negative moment, Inventory off, Operating off, allowable overrides, applied moments, M_LL+I = 0, no live values. Dev (7): default, AASHTO, ACI modifiers, confinement, excess reinforcement invalid, low f′c with c_b = 0, title block. In every state these were identical: the HTML of every output tab (Plotly data; Plotly random ids normalised), the status chip, the output tab bar, `VALIDATION`, the printed report (`#printReport` / `#printroot`, timestamp removed), `S` / `collectState()` (= Export JSON content), the autosave (`rcbeam_v2_auto`, `asd_v1_auto`, `rcsuite.rebar_autosave_v1`), the saved-project lists after Save, Save → Load and Import (`mergeState`) round trips, the state after a reload, all input values in panel order, the localStorage key list, and the `bridgeSuite.v1.projectMeta` payload from the shell's "Share project info" (`producedAt` removed). Cross-frame link: for every Capacity state, the `sharedInputs` messages Capacity posted, the ASD tab's `S.inherit` / `S.proj`, its status chip and its Summary output were identical.
  - Every input, select, textarea, button and section in each `#inputPanel` is present in both, in the same order (Capacity 61 / 55 AASHTO / 63 T-beam / 58 no stirrups; ASD 14; Dev 50), each in exactly one pane.
  - No console errors or page errors (main or branch).
  - Checked (scripted): clicks; arrows with wrap-around, Home, End and focus; tab remembered across reload; bogus stored value → first tab; localStorage throwing → tabs still work, results normal; typing in an input keeps its tab and focus across the rebuild; red dot on and off for b_w = 0, h_f ≥ h, stirrup s = 0, layer d = 30 in. (Capacity) and no live values (ASD); AASHTO hides the Torsion section and the Checks tab keeps Crack Control; a Capacity edit made in a tab still reaches the ASD tab; strip stays at the top when the panel scrolls; no horizontal scroll at 400 px in Capacity and ASD (the Dev sub-app scrolls 354 px sideways at 400 px in main as well; unchanged).
  - Screenshots of every tab of the three sub-apps at 1400 px and 400 px.
- **Other copies:** the Dev tab code is the shared snippet also in `ACI Rebar Development Length.html` (now identical, modulo srcdoc escaping). The Capacity and ASD tab code exists only here (the standalone `Concrete Beam ASD.html` has its own, different tab code, `cbasd_inputTab_v1`, fix log there).

## 2026-10-12 — PR: claude/sweep-cbc-rebar (PR #140: https://github.com/mlococo88/All-Structural/pull/140)

Open-item sweep of inventory section 10 (engineer 2026-10-12: "continue making updates and fixes until it's completed … use your best judgment"). Basis: ACI 318-19 and AASHTO LRFD 10th Ed. (2024). Article numbers marked "verify" were not checked against a printed copy. Because the Dev tab is the shared ACI Rebar app (CLAUDE.md §3), this PR also changes `ACI Rebar Development Length.html` and its log (coordinator decision under the engineer's delegation).

All edits were made on the un-escaped srcdoc of each sub-app by scripted exact-string replacement (each anchor found exactly once), then re-escaped (`&` → `&amp;`, `"` → `&quot;`) and put back; the escape round trip of the untouched text is exact. The shell relay (S10) was edited directly. CRLF kept.

**How verified (all entries):** `node --check` of every inline script of the shell and the three sub-apps (7 blocks, 0 failures). Headless Chromium 1194 (Playwright) with KaTeX 0.16.11 / 0.16.9, Plotly 2.32.0 / 2.27.0 and three.js 0.160.0 served locally, origin/main 20830eb vs branch, 42 scenarios: Capacity 21 (the 15 of the T1 comparison plus Gr 80, heavily reinforced 6#9, AASHTO f′c 12 / fy 90 / fyt 110, ACI fy 75 with torsion, wide stirrup spacing with torsion, no stirrups with V_u 9 / 7 / 4 kip), ASD 9 (T1 set plus f′c = 0 received), Dev 12 (T1 set plus #14 hook confined, AASHTO #18, λ = 0.85, AASHTO lightweight, capped factors). Compared: HTML of every output tab, status chip, VALIDATION, printed report, state / Export JSON, autosave, saved-project list, Save → Load and Import round trips (exact on both), reload, input values, localStorage keys, ASD inherited values and summary, Share-project-info payload. Every difference was traced to an item below (the aggregated list of changed fragments is in the PR verification notes); nothing else changed. No console or page errors on main or branch. Separate checks: the real `computeAll()` numbers quoted in the check cases (main vs branch), the ASD title-block follow rule, spoofed postMessages (S10), screenshots of the changed ASD and Dev views (looked at).

**Saved data (§5):** no key or format changed. New optional fields: ASD state `projFromCap` (object; absent = previous behaviour), Dev `inp.lwLambda` (see the Rebar log). New default title block (O17) affects new sessions only; saved states keep their own.

### W1. ACI 9.3.3.1 beam minimum net tensile strain: ε_t ≥ ε_ty + 0.003 (CBC-O1)   [calc change (check limit)] [MORE conservative]
- **Where:** `detailing`, check `dEpsMin`. Anchor: `const epsMinACI=fy/ES+0.003;`
- **Before:** `F.eps_t,0.004,"\\ge","",F.eps_t>=0.004,` (both codes; AASHTO is advisory)
- **After:** ACI: `need = fy/ES + 0.003`, `ok = F.eps_t >= fy/ES+0.003`, derivation `ε_t ≥ ε_ty + 0.003`. AASHTO advisory text and 0.004 unchanged.
- **Governing provision:** ACI 318-19 §9.3.3.1 (nonprestressed beams with Pu < 0.10f′cAg: ε_t ≥ ε_ty + 0.003; 318-14 had 0.004). Please confirm against your printed copy (it was open item O1).
- **Check case:** Gr 60: ε_ty = 60/29,000 = 0.002069 → limit **0.004 → 0.005069**. Gr 80: 0.002759 + 0.003 = 0.005759. Default section (ε_t = 0.01748): PASS before and after; the dashboard utilisation 0.004/0.01748 = 0.23 → 0.005069/0.01748 = 0.29. A Gr 60 beam with ε_t = 0.0045: PASS before, **FAIL** after.

### W2. AASHTO φ: tension-controlled strain limit interpolated for fy > 75 ksi (CBC-O4)   [calc change] [MORE conservative for fy > 75 ksi; no change for fy ≤ 75]
- **Where:** new `aashtoEtl(fy)` before `phiFlex`; `phiFlex` AASHTO branch; `workFlexure` Step 5 shows the ε_tl line when fy > 75; the AASHTO fy > 75 warning names ε_tl.
- **Before:**
  ```js
    if(et>=0.005) return {phi:0.90,cls:"Tension Controlled"};
    if(et<=ety)   return {phi:0.75,cls:"Compression Controlled"};
    return {phi:0.75+0.15*(et-ety)/(0.005-ety),cls:"Transition"};
  ```
- **After:**
  ```js
  function aashtoEtl(fy){ return fy<=75 ? 0.005 : Math.min(0.008,0.005+0.003*(fy-75)/25); }
  ...
    const etlA=aashtoEtl(fy);
    if(et>=etlA) return {phi:0.90,cls:"Tension Controlled"};
    if(et<=ety)   return {phi:0.75,cls:"Compression Controlled"};
    return {phi:0.75+0.15*(et-ety)/(etlA-ety),cls:"Transition"};
  ```
- **Governing provision:** AASHTO LRFD 10th Ed. 5.6.2.1 (ε_tl = 0.005 for fy ≤ 75 ksi, 0.008 for fy = 100 ksi, linear between — verify), 5.5.4.2 (φ transition). ε_cl kept at fy/Es (see Needs engineer 2).
- **Check case:** AASHTO, 12 × 18 in., f′c = 4 ksi, 4 #8 bottom, fy = 90 ksi, M_u = 150 k-ft: ε_t = 0.003514, ε_cl = 90/29,000 = 0.003103, ε_tl = 0.005 + 0.003·15/25 = 0.0068. Before φ = 0.75 + 0.15(0.003514 − 0.003103)/(0.005 − 0.003103) = **0.7824**, φM_n = 0.7824 × 286.37 = **224.07 k-ft**. After φ = 0.75 + 0.15(0.000410)/(0.003697) = **0.7666**, φM_n = **219.55 k-ft**.

### W3. AASHTO α1 reduced above 10 ksi (CBC-O8)   [calc change] [MORE conservative for AASHTO f′c > 10 ksi; no change otherwise, ACI never]
- **Where:** new `alpha1(fc)` after `beta1`; `flexure` (`Cc` and the displaced-concrete terms use `A1` instead of `0.85`); `A1` returned in `F`; Flexure tab texts show `fmt(F.A1,2)` (reads "0.85" whenever α1 = 0.85) and an α1 line in Step 4 when α1 ≠ 0.85.
- **Before:** `return 0.85*fc*(effTee?bf:bw)*a;` (and three more `0.85*fc`)
- **After:** `function alpha1(fc){ return (S.code==='AASHTO' && fc>10) ? Math.max(0.75,0.85-0.02*(fc-10)) : 0.85; }` and `return A1*fc*(effTee?bf:bw)*a;` etc.
- **Governing provision:** AASHTO LRFD 10th Ed. 5.6.2.2 (α1 = 0.85 for f′c ≤ 10 ksi, minus 0.02 per ksi above 10, ≥ 0.75). ACI 318-19 22.2.2.4.1 (0.85).
- **Check case:** AASHTO, 12 × 18 in., f′c = 12 ksi (β1 = 0.65), fy = 60, 5 #9 bottom + 3 #5 top: α1 = 0.85 − 0.02·2 = **0.81**. a: 2.313 → **2.406 in.**, c: 3.558 → 3.701 in., M_n 342.15 → **340.73 k-ft**, φM_n 307.94 → **306.65 k-ft** (φ = 0.90 both).

### W4. AASHTO transverse-reinforcement yield ≤ 100 ksi (CBC-O5)   [calc change] [MORE conservative only when fyt > 100 ksi is entered]
- **Where:** `fytDesign` (anchor `function fytDesign(){`), new validation warning.
- **Before:** `return S.code==='ACI' ? Math.min(S.mat.fyt,60) : S.mat.fyt;`
- **After:** `return S.code==='ACI' ? Math.min(S.mat.fyt,60) : Math.min(S.mat.fyt,100);`
- **Governing provision:** AASHTO LRFD 10th Ed. 5.4.3.1 / 5.7.2.8 (design yield of transverse reinforcement ≤ 100 ksi — verify; older editions used 75 ksi).
- **Check case:** default section, AASHTO, fyt = 110 ksi, V_u = 40 kip: V_s 127.23 → **115.66 kip** (× 100/110); φV_n 128.98 → **118.57 kip**; A_v,min/s 0.00689 → 0.00758 in.²/in. fyt ≤ 100: unchanged.

### W5. ACI torsion: longitudinal fy ≤ 60 ksi (CBC-O6)   [calc change] [MORE conservative when fy > 60 ksi and torsion is on]
- **Where:** `torsion` (anchor `const fyl=Math.min(fy,60);`), used in `Tn_l`, `Al_req`, `AlT1`, `AlT2`; returned as `fyl`; displays in `detailing` (dTorAl, dTorAlReq) and `workTorsion` use `fyl`; new validation warning "longitudinal torsion steel … computed with f_y = 60 ksi".
- **Before:** `const Tn_l=ph>0? 2*Ao*(Al/ph)*fy*tan : 0;` and `fy` in `Al_req`, `AlT1 = 5√f′c·Acp/fy`, `AlT2 = (At/s)·ph·fyt/fy`.
- **After:** the same with `fyl = Math.min(fy,60)`.
- **Governing provision:** ACI 318-19 Table 20.2.2.4(a) (torsion, longitudinal and transverse: fy, fyt ≤ 60,000 psi).
- **Check case:** default section, fy = 75 ksi, A_ℓ = 1.2 in.², T_u = 8 k-ft, V_u = 20 kip: T_n,ℓ = 2A_o·A_ℓ·fy/p_h·tanθ: 30.74 → **24.59 k-ft** (× 60/75); T_n = min(28.69, T_n,ℓ): 28.69 → **24.59 k-ft** (longitudinal now governs); φT_n 21.52 → **18.44 k-ft**; A_ℓ,req 0.416 → **0.521 in.²**. Flexure unchanged (still 75 ksi).

### W6. ACI A_ℓ,min: lesser of 9.6.4.3 (a) and (b) (CBC-O11)   [calc change] [LESS conservative when A_t/s < 25b_w/f_yt — §4 sign-off needed]
- **Where:** `torsion` (anchor `const AtsCredit=Math.max(At_s,AtsFloor);`), dTorAl / dTorAts texts, `workTorsion` A_ℓ,min block.
- **Before:** `const AlT2=At_s*ph*(fyt/fy); const Al_min=Math.max(0,AlT1-AlT2);` (expression (a) only)
- **After:** `const AtsCredit=Math.max(At_s,AtsFloor); const AlT2=AtsCredit*ph*(fyt/fyl); const Al_min=Math.max(0,AlT1-AlT2);` (lesser of (a) and (b) = the larger credit)
- **Governing provision:** ACI 318-19 §9.6.4.3 (A_ℓ,min = lesser of (a) 5√f′c·Acp/fy − (At/s)·ph·fyt/fy and (b) 5√f′c·Acp/fy − (25bw/fyt)·ph·fyt/fy).
- **Check case:** changes only when A_t/s < 25b_w/f_yt. Default section, no stirrups, torsion on: A_cp = 216 in.², p_h = 44 in., term 1 = 5·63.25·216/60,000 = 1.138 in.²; 25b_w/f_yt = 25·12/60,000 = 0.0050 in.²/in.; A_t/s = 0. Before A_ℓ,min = 1.138 − 0 = **1.138 in.²**; after 1.138 − 0.0050·44·1 = **0.918 in.²**. With the default #4 at 6 in. (A_t/s = 0.0333 > 0.0050): unchanged.

### W7. ACI A_v,min trigger without stirrups: V_u > φλ√f′c·b_w·d (CBC-O9)   [calc change (check trigger)] [LESS conservative — §4 sign-off needed]
- **Where:** `detailing`, no-stirrup branch (anchor `const trigV  = code==='ACI'`).
- **Before:** `const needAv = VuA > halfVc + 1e-9;` with `halfVc = 0.5·φ·V_c` (318-14 wording), V_c without A_v,min from Table 22.5.5.1(c).
- **After:** `const trigV = code==='ACI' ? phiV*S.mat.lambda*Math.min(rt,100)*bw*sh.d/1000 : halfVc;` `const needAv = VuA > trigV + 1e-9;` (AASHTO unchanged). √f′c limited to 100 psi (conservative).
- **Governing provision:** ACI 318-19 §9.6.3.1 (A_v,min where V_u > φλ√f′c·b_w·d, except Table 9.6.3.1 cases).
- **Check case:** default 12 × 18 in., f′c = 4,000 psi, 3 #5, no stirrups (d = 15.69 in.): new trigger 0.75·1.0·63.25·12·15.69/1000 = **8.93 kip**; old 0.5·0.75·V_c = 0.5·0.75·14.31 = **5.37 kip**. V_u = 7 kip: before "A_v,min required, none provided — FAIL"; after **not triggered** (N/A). V_u = 9 kip: FAIL before and after.

### W8. ASD tab: input errors instead of silent substitutes (CBC-O13a)   [bug fix] [no result change for valid inputs]
- **Where:** ASD sub-app: new `asdInputErrors()` before `compute`; `compute` returns `{errors}`; `updateStatusChip` ("Input error"); `buildOutput` (error box, no results); "From Beam Capacity" input section (error box → red tab dot).
- **Before:** `const fc=Math.max(1,+I.fc||3000), fy=+I.fy||40000;` … `d=Math.max(0.01,…||1)`, `b_w=Math.max(0.01,…)` silently replaced a blank / zero value.
- **After:** f′c ≤ 0, f_y ≤ 0, d ≤ 0 or the governing width ≤ 0 → "Input error — no results" with the list. The arithmetic for valid values is unchanged (port of the standalone ASD tool's F3).
- **Check case:** Capacity sends f′c = 0: before Inventory RF −0.56 computed with 3,000 psi; after "Input error — Concrete strength f′c must be greater than 0." Capacity with b_w = 0: before RF −0.62; after "Section width (b_w) must be greater than 0."

### W9. ASD tab title block follows Beam Capacity field by field until edited (CBC-O13b)   [bug fix / UI] [no result change]
- **Where:** ASD `message` listener. Anchor: `const last=(S.projFromCap && typeof S.projFromCap==='object')`.
- **Before:** `S.proj={...S.proj,...p.proj};` on every refresh (ASD edits overwritten).
- **After:** a field is updated when it is blank or still equals the value last received from Capacity (`S.projFromCap`, new optional state field); with no `projFromCap` (older saves, New) every field is taken, as before.
- **Check:** ASD Project edited to "ASD own", then Capacity Project "Cap name" and No. "123": ASD keeps "ASD own" and takes "123".

### W10. ASD tab scope note (CBC-O13c)   [display]
- Summary tab, after the verdict box: "Scope: singly reinforced flexure only (working stress, AASHTO Std. Spec. 8.15). Compression steel (8.15.3, 2n·A′s) is ignored and ASD shear (8.15.5) is not checked." (text of the standalone ASD F7).

### W11. Blank default project name and subject (CBC-O17 / X-C6)   [UI] [no result change]
- `defaultState()` of Capacity: `name:"MBTA — Mini-Highs"` → `""`, `subj:"Lower Ramp Beam Capacity"` → `""`; ASD: `name` → `""`. "M. Lococo" kept. New sessions only; saved states keep theirs.

### W12. postMessage source checks (CBC-S10, this tool's part of X-S10)   [robustness] [no result change]
- **Shell relay** (`window.addEventListener('message'` in the shell): `sharedInputs` accepted only from `#suite-frame-capacity`'s window, `requestShared` only from `#suite-frame-asd`'s. **Capacity bridge:** `requestShared` only from `window.parent`. **ASD:** `sharedInputs` only from `window.parent`. Target origin stays `'*'` (srcdoc frames from `file://` have an opaque origin).
- **Check:** a `sharedInputs` message with f′c = 1,234 posted by the top window, and one with 999 posted by the ASD frame to itself, are both ignored (ASD f′c stays 4,000); the normal Capacity → ASD link works in all 21 Capacity scenarios.

### Dev tab (CBC-O18)
The Rebar sweep R1–R7 (see `fixlog/ACI Rebar Development Length.md`, same date) is applied to the Dev tab identically.

### Items closed / not changed
- **CBC-O3** (Gr 60 ε_ty = 0.002 permission): not adopted; fy/Es is the general rule and slightly conservative. Listed under Needs engineer only as a preference.
- **CBC-O7** (AASHTO s_x = d_v, a_g = 0 above 10 ksi): kept (conservative). An s_x input can be added on request.
- **CBC-O10** (T-beam torsion web-only A_cp/p_cp): kept; disclosed in the Validation notes.
- **CBC-O15** (γ3 options): no other specification requested; kept.
- **CBC-O16** (two Plotly / two KaTeX versions): not changed; CLAUDE.md §2 needs a version-change OK, and the suite-wide choice is X-C3. See Needs engineer.

### Needs engineer
1. **W1, W2, W4 provisions** — confirm ACI 318-19 §9.3.3.1 (ε_ty + 0.003), AASHTO 10th Ed. 5.6.2.1 (ε_tl 0.005 → 0.008 between 75 and 100 ksi) and 5.4.3.1 / 5.7.2.8 (fyt ≤ 100 ksi).
2. **CBC-O4 (ε_cl)** — AASHTO 5.6.2.1 compression-controlled limit kept at fy/Es. If your 10th Ed. gives larger values for high-strength bars (commentary table), φ in the transition zone should use them. Recommendation: confirm fy/Es.
3. **W6 and W7 sign-off** — both follow the 318-19 text and are less conservative than before.
4. **CBC-O13d / ASD-O1** — operating f_c = 1,900 psi default (MassDOT value; MBE gives 0.60f′c). Recommendation: keep only if it is MassDOT policy.
5. **CBC-O12 / X-C1** — edition labels still read "AASHTO LRFD 9th". Recommendation: relabel to 10th after the printed-spec check.
6. **CBC-O16 / X-C3** — converge on one Plotly / KaTeX version? Recommendation: do it suite-wide under X-C3 with visual checks.
7. **CBC-O3** — use ε_ty = 0.002 for Gr 60 (ACI 21.2.2.1 permission)? Recommendation: no (keep fy/Es).

### Remaining open items
None from section 10 beyond the "Needs engineer" list.

## 2026-10-12 — PR: claude/cbc-asd-beff (PR #158: https://github.com/mlococo88/All-Structural/pull/158)

Follow-up to the standalone `Concrete Beam ASD.html` sweep (#143, its fix log F8–F10). The suite ASD tab has its own engine (`compute()` in the `#suite-frame-asd` srcdoc), so the same rule and notes are ported here. Edits were made on the un-escaped srcdoc by scripted exact-string replacement (each anchor found exactly once), re-escaped (`&` → `&amp;`, `"` → `&quot;`) and put back; CRLF kept. Only this file and this log changed.

### W13. ASD tab: b_eff ≤ b_w + 12h_f for the positive-moment T-beam (Std. Spec. 8.10.1.1), option on by default   [calc change] [MORE conservative; only when the received b_eff exceeds b_w + 12h_f in positive moment]
- **Where (ASD sub-app):** `defaultState()` (`mode.asd_beffLim:true`); `compute()` (anchor `let beffLim=null, beffEntered=null;`), result fields `beffLim`, `beffEntered`, `beffCapped`; "From Beam Capacity" input section (new checkbox "Limit b_eff to b_w + 12h_f (Std. Spec. 8.10.1.1)", data-fkey `asdBeffLim`, shown for a T-section only); Summary tab (note after the scope note, so it is also in the printed report).
- **Problem:** the received b_eff (Capacity's flange width b_f) was used as entered. An over-wide b_eff lowers kd and raises z and the concrete capacity: unconservative.
- **Before:**
  ```js
    const b_eff=+I.b_eff||0, h_f=+I.h_f||0, b_w=Math.max(0.01,+I.b_w||0);
    const isPos = M.momentType==='pos';
  ```
- **After:**
  ```js
    let b_eff=+I.b_eff||0;
    const h_f=+I.h_f||0, b_w=Math.max(0.01,+I.b_w||0);
    const isPos = M.momentType==='pos';
    let beffLim=null, beffEntered=null;
    if(I.shape==='tee' && isPos && +I.b_w>0){
      beffLim=b_w+12*Math.max(0,h_f);
      if(b_eff>beffLim){ beffEntered=b_eff; if(M.asd_beffLim!==false) b_eff=beffLim; }
    }
  ```
  The capped b_eff feeds ρ, the T-beam quadratic, the compression force, the Analysis/Input Echo tables and the section drawing. Negative moment and rectangular sections: unchanged. Note (amber when capped, red when the option is off): entered value, limit, and that the span/4, web-spacing (8.10.1.1) and one-sided-slab b_w + 6h_f (8.10.1.2) limits are not checked.
- **Governing provision:** AASHTO Standard Specifications for Highway Bridges, 17th Ed. (2002), Art. 8.10.1.1 (overhang each side ≤ 6 × slab thickness). Same reading and default as the standalone F8.
- **Saved data:** new optional field `S.mode.asd_beffLim` (boolean, tool-prefixed) in the ASD state (`asd_v1_auto`, projects, Export JSON). Older states have no field; `mergeState` fills the default (on), so an old state whose b_eff exceeds the limit now rates with the capped width and shows the note. No key change.
- **§4 callout — before:** `b_calc = b_eff` (as received). **After:** `b_calc = min(b_eff, b_w + 12h_f)` (positive-moment T-beam, option on). The standalone F8 check cases, reproduced in this tab (f′c = 3,000 psi, Gr 40, f_c,inv 1,200, f_s,inv 20,000, f_c,op 1,900, f_s,op 28,000, b_w = 14, d = 28.5, M_DL = 250, M_LL+I = 400, n = 9):
  - **Case 1** (h_f = 7, A_s = 8.00, b_eff = 120; limit 14 + 84 = **98 in.**): before b = 120, kd = 5.279, z = 26.740, M_inv = **356.5 k-ft** (steel), M_op **499.2**, RF **0.266 / 0.623**. After b = 98, kd = 5.778, z = 26.574, M_conc,inv 752.4, M_inv = **354.3 k-ft**, M_op **496.0**, RF **0.261 / 0.615**. Identical to the standalone. Option off: before values, red note.
  - **Case 2** (h_f = 3, A_s = 14.00, b_eff = 120; limit **50 in.**): before kd = 8.122, z = 26.876, M_inv **627.1** (steel), M_op 877.9, RF 0.943 / 1.570. After kd = 11.843, z = 25.894, M_conc,inv **458.9** (governs), M_op **726.6**, RF **0.522 / 1.191**. Identical to the standalone.
  - Default (b_eff 90 ≤ 98): unchanged, 353.3 / 494.7 k-ft, RF 0.258 / 0.612. b_eff = 98: unchanged. b_eff 120 in negative moment or rectangular: unchanged. h_f = 0: b_calc = b_w, results unchanged (T-beam with no flange).
- **How verified:** see "Verification" below.

### W14. ASD tab: notes for a steel allowable with no grade rule, and for f_c,op > 0.60f′c (ports of standalone F9, F10)   [display] [no result change]
- **Where:** Summary tab after the b_eff note (so in the printed report). Anchors: `has no automatic rule for`, `Confirm the owner's basis for this value`.
- **What:** for f_y with no automatic rule for f_s,inv (other than 40/50/60 ksi) or f_s,op (other than 40/60 ksi), and that field not overridden, a red note gives f_y and the value used and asks for a check against AASHTO MBE Table 6B.6.2.3-1 (verify table number). When f_c,op > 0.60f′c, an amber note gives both values and asks for the owner's basis (MBE 3rd Ed. 6B.6.2.3; the 1,900 psi MassDOT default is not changed). The suite tab had neither note.
- **Check case:** defaults (f′c 3,000, f_c,op 1,900): note "Operating f_c = 1,900 psi is greater than 0.60f′c = 1800.0 psi …"; f_y = 50,000: red note for f_s,op (28,000 psi kept from Gr 40). Results unchanged.

### Verification
- `node --check` of all inline scripts of the shell and the three sub-apps (7 blocks, 0 failures).
- Headless Chromium 1194, libraries served locally at the pinned versions, origin/main (ba1fd72) vs branch: the real `compute()` on the cases above (numbers quoted are from it), and the full suite comparison (Capacity, ASD and Dev scenarios of the previous sweep plus ASD b_eff 120, b_eff 120 option off, b_eff 120 negative moment, f_y 50,000). Differences only: the new Summary notes, the new checkbox in the ASD input panel, `mode.asd_beffLim` in the ASD state/autosave/export, and the capped results in the states where b_eff > b_w + 12h_f with the option on. Capacity and Dev outputs identical. Save → Load and Import round trips exact. No console errors.
- Screenshot of the ASD tab with the checkbox and notes looked at.

### Needs engineer
- Same as the standalone: confirm the editions (Std. Spec. 17th Ed., MBE 3rd Ed.), the MassDOT basis for f_c,op = 1,900 psi (E1) and the steel allowables for other grades (E2).

## Open items (not changed)
- **Status 2026-10-12 (claude/cbc-asd-beff):** suite ASD tab now applies b_eff ≤ b_w + 12h_f (W13, port of standalone ASD F8) and shows the stale-allowable and f_c,op > 0.60f′c notes (W14).
- **Status 2026-10-12 (claude/sweep-cbc-rebar):** O1 → W1; O4 → W2 (ε_tl; ε_cl question open); O5 → W4; O6 → W5; O8 → W3; O9 → W7; O11 → W6; O13 → W8, W9, W10 (operating f_c still open); O17 → W11; O18 → Rebar R1–R7; S10 → W12. O3, O7, O10, O15 closed (kept); O12, O16 and O13d remain under "Needs engineer" in that entry.
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

## 2026-10-18 — PR: claude/cbc-d11-report — D11: calculation-sheet report and §6 derivation links (Tier 1, display only; PR #275: https://github.com/mlococo88/All-Structural/pull/275)
- **Engineer request:** AUDIT.md D11 (2026-10-14, scope decided 2026-10-18: full report for design-check tools) and the CLAUDE.md §6 "show the work and link to it" guideline.
- **Scope:** the Beam Capacity tab (`#suite-frame-capacity`) and the ASD Beam Calcs tab (`#suite-frame-asd`). The Development & Splice tab (`#suite-frame-dev`, the duplicated ACI rebar app, CLAUDE.md §3) and the suite shell are **byte-identical** to main.
- **Editing method:** as in the 2026-10-12 entries: each srcdoc was decoded (`&quot;` → `"`, `&amp;` → `&`), edited by exact-string replacement (each anchor found once), re-encoded (`&` → `&amp;`, `"` → `&quot;`) with CRLF kept, and put back. A decode → encode of the unedited file reproduces it byte for byte.

### D11-1. Beam Capacity tab: calculation-sheet report
- **Functions / anchors:** `buildReport()` is rewritten, preceded by the new `cbcCodeLabel()`, `cbcRefs()`, `cbcPageCSS()`, `cbcApplyPageCSS()`, `cbcResultRows()` and `cbcResultBlock()` (anchor `/* D11 (2026-10-18): calculation-sheet report`). `generateReport()` calls `cbcApplyPageCSS(true)` before `window.print()`; `init()` adds `beforeprint` (build the report if none is built; page CSS on) and `afterprint` (page CSS off). CSS anchor `/* D11 calculation-sheet report (Gusset Plate Rating / ST-Girder format) */`.
- **Before:** a centred title, a 9-field title-block grid, then "n. Tab" headings with each tab's output and the disclaimer. No references, no table of contents, no result lines, no page header/footer.
- **After:**
  - **Cover:** "Reinforced Concrete Beam Capacity", project name, subject, code ("ACI 318-19" or "AASHTO LRFD, 9th Edition", as before) and the same 9-field title block (Project, Project No., Subject, Calculated by, Date, Sheet, Checked by, Checked date, Code). No new fields: every field already existed.
  - **References:** built from the printed content: every equation-block reference (`.eqRef`) and every dashboard check reference (`allChecks().ref`), grouped as ACI 318-19 and AASHTO LRFD ("labelled 9th Edition in this tool; some provisions follow the 10th Ed. — edition: verify"). Only articles the printout actually cites are listed.
  - **Numbered table of contents** with links; **sections n** = the report tabs (Input Echo, Summary & Dashboard, Flexure, Shear, Torsion when ACI with torsion, Serviceability, Detailing, Validation — the Report Contents selection still applies); **subsections n.k** = each tab's cards, the card's own leading "k." replaced (Detailing cards).
  - **Result lines** ("<check>: D/C = x.xx (<ref>[; governing combination …]) PASS / FAIL / N/A") at the end of Flexure (per combination, `r.dcM`), Shear (per combination, `r.dcV_eff`), Torsion (per combination: `tor.dcr`, `tor.lhs/tor.rhs`, `comb_req/comb_prov`, the three `allChecks` expressions), Serviceability (`allChecks` tab `tabServ`: AASHTO minimum reinforcement) and Detailing (`allChecks` tab `tabDetail`, PASS/FAIL from `forceOK` = all combinations, as the dashboard). References are the dashboard's own. PASS rule = the dashboard's (D/C ≤ 1.0001, or `forceOK`). An unbounded D/C (infinite, or ≥ 10⁶ from a zero provided value) prints "≫1".
  - **Print:** `@page` letter with margin boxes, only while printing: top "Project No / Description (Subject, else Project)", "Computed By / Checked By", "Date / Date"; bottom "<project> (Concrete Beam Design Suite — Beam Capacity)" and "Page X of Y".
  - The deselected-combination stripping of the Report Contents dialog is unchanged.
- **Provision:** none. No formula, factor, unit or result changed.

### D11-2. ASD tab: calculation-sheet report
- **Functions / anchors:** `buildReport()` rewritten, preceded by `ASD_REFS`, `asdPageCSS()`, `asdApplyPageCSS()`, `asdResultBlock()` (anchor `/* D11 (2026-10-18): calculation-sheet report`); the `rptGo` handler calls `asdApplyPageCSS(true)`; `beforeprint` / `afterprint` as above; the same CSS block.
- **After:** cover ("Concrete Beam Load Rating — ASD", existing 9-field title block incl. Method); references (AASHTO Standard Specifications Art. 8.15, 8.15.2, 8.15.3, 8.15.3.4, 8.7.1, 8.10.1.1 / 8.10.1.2 — "edition: verify (the tool's code notes refer to the 17th Ed., 2002)"; AASHTO MBE Section 6B, 6B.6.2.3, Table 6B.6.2.3-1 — "edition: verify"); numbered TOC; sections n.k (Analysis card numbers "1."–"5." replaced); a result line per rating level shown, at the end of Analysis (or Summary when Analysis is not printed): "Inventory rating: RF = 0.26 (AASHTO MBE 6B (ASD); M_all = 353.33 k-ft, steel controlled) FAIL" — RF, not D/C, PASS when RF ≥ 1.00 (the Summary's `ratePill` rule); the same `@page` boxes with "(Concrete Beam Design Suite — ASD Beam Rating)".

### D11-3. §6 links ("Worked in: → Tab · Card"; "see §n.k" in the report)
- **New helpers:** Beam Capacity, after `mkSection` (anchor `/* ---- D11 links`): `cbcTabName`, `cbcComboCi` (an identical combination links to the one that holds the derivation), `cbcComboCard`, `cbcLink`, `cbcWorkedIn`, `cbcCheckCard`, `cbcGoto` and a click handler on `a.wkA`. ASD: `ASD_CARDS`, `asdTabName`, `asdLink`, `asdWorkedIn`, `asdGoto` and its click handler. CSS `.wkLink`, `a.wkA`, `.sec.wkFlash`.
- **Link-target fields (no value change):** `allChecks()` entries gain `ci` (the combination the envelope picked) and, for detailing, `id`; `detEnvelope()` entries gain `ci`. Before: `best={dcr:v.dcr,combo:r.name,na:false}` / `E.combo=r.name;`. After: `best={dcr:v.dcr,combo:r.name,na:false,ci:r.ci}` / `E.combo=r.name; E.ci=r.ci;` (plus `ci`, `id` in the pushed objects). Nothing reads them except the links.
- **Links added (Beam Capacity):**
  1. Summary, Design Check Summary: new "Worked in" column → the card of each check at its governing combination (Flexure/Shear/Torsion combination card, Serviceability "Cracking Moment and Minimum Reinforcement", the Detailing card).
  2. Summary, Section Capacities: φM_n, φV_n, φT_n (or φT_th), M_cr → their cards for the governing combination.
  3. Section Flexural Capacity — Positive & Negative (Summary and Flexure): each sense → the first combination of that sense on the Flexure tab (no link when no combination bends in that sense).
  4. Shear, "Transverse steel shared with torsion": (A_t/s)_req,T → Torsion, same combination.
  5. Serviceability (AASHTO) minimum reinforcement: φM_n → Flexure, governing combination.
  6. Detailing cards: Maximum stirrup spacing (V_c for ACI; φ, d_v for AASHTO) and Minimum shear reinforcement without stirrups (d for ACI; V_c for AASHTO) → Shear; Minimum net tensile strain (ε_t) → Flexure; torsion detailing (p_h, A_cp, A_t/s, A_o) → Torsion; each at the combination the check was evaluated for.
- **Links added (ASD):** Summary dashboard "Worked in" column (M_all → Analysis · Allowable Moment Capacity, RF → Analysis · Load Rating); Key Parameters (n, ρ → Elastic Section Properties; k, kd → Neutral Axis; j, z → Internal Lever Arm).
- **Clicking a link** switches the tab, expands the card (`S.ui.collapse[card]=false`, which a card click already sets), scrolls the output panel (only) to it and highlights it. Inputs, results and saved data are otherwise unchanged.
- **Report:** each link becomes "see §n.k" (with the quantity, e.g. "φM_n: see §3.3"); a card in a section not printed reads "see the <tab> tab (<card>; not in this printout)". The "Worked in:" prefix is dropped in print.

### D11-4. Display fixes found while reviewing the report (no result change)
1. Shear tab, shared-stirrup notes: the text showed a literal "φ". Before: `"...available for shear, and \\u03c6T_n in the "+` and `"for shear, so \\u03c6V_n falls to..."`. After: `φ` (renders φ).
2. Detailing, Maximum stirrup spacing (ACI), step title showed raw TeX "V_{s,req}=0.00\text{ kip }does not exceed the threshold." Before: `` `V_{s,req}=${fmt(VsReq)}\\text{ kip }${tight?"exceeds":"does not exceed"} the threshold.` `` After: `` `V_s,req = ${fmt(VsReq)} kip ${tight?"exceeds":"does not exceed"} the threshold.` ``
3. Shear, Table 22.5.5.1 row titles and the size-effect warning: "A_{v,min}" → "A_v,min" (plain text).
4. Validation, Mandatory Code Limits: an unbounded D/C printed "D/C = — exceeds 1.00". Before: `msg:"D/C = "+fmt(r.dcT)+" exceeds 1.00."` (also `r.dcM`, `r.dcV_eff`). After: `msg:"D/C = "+(isFinite(r.dcT)?fmt(r.dcT):"≫1 (no capacity)")+" exceeds 1.00."`.
5. ASD, Load Rating variable table: "Allowable capacity (=M_{all})" → "Allowable capacity (= M_all)".

### Check case (default project, Beam Capacity: ACI 318-19, 12 × 18 in., 3 #5 + 3 #5, #4 @ 6 in., combinations 1.2D + 1.6L (T_u = 13.5 k-ft), 1.2D + 1.0W + L, 0.9D + 1.0W; title block filled for the test)
- 8 sections: 1 Input Echo (4 subsections), 2 Summary & Dashboard (3), 3 Flexure (5), 4 Shear (4), 5 Torsion (4), 6 Serviceability (1), 7 Detailing (13), 8 Validation (3). 37 letter pages.
- Result lines: Flexure and Shear N/A for every combination (M_u = V_u = 0); Torsion, 1.2D + 1.6L: torsional capacity D/C ≫1 FAIL (A_ℓ = 0, so φT_n = 0), cross-sectional limit 0.82 PASS, combined V+T 0.63 PASS; Detailing: clear cover 1.00 PASS … maximum closed-stirrup spacing for torsion 1.14 FAIL, longitudinal torsion steel ≫1 FAIL, crack control 0.36 PASS — the dashboard's values.
- Links: dashboard torsion rows "see §5.2"; Section Capacities "φM_n: see §3.3 · φV_n: see §4.2 · φT_n: see §5.2 · M_cr: see §6.1".
- ACI with loads (M_u = 120 / −60 / 120 k-ft) : 40 pages, flexure 1.92 FAIL / 0.96 PASS / 1.92 FAIL; "Positive: see §3.3 · Negative: see §3.4". AASHTO T-beam (+250 / −80 k-ft): 7 sections (no Torsion), 24 pages. ASD tab with its built-in inputs (f′c 3,000 psi, b_eff 90, d 28.5, A_s 8.00, M_DL 250, M_LL+I 400): 3 sections, 7 pages, Inventory RF 0.26 FAIL, Operating RF 0.61 FAIL.

### Verification (Tier 1)
- `node tests/check-syntax.mjs "Concrete Beam Capacity.html"`: the shell's scripts pass; the four srcdoc scripts fail **identically on main** (the checker reads the HTML-entity-encoded srcdoc text). The decoded Beam Capacity and ASD apps pass `node tests/check-syntax.mjs` (all scripts).
- **No result change:** headless Chromium (tests/lib.mjs `openPage`, the suite's CDN libraries served from `npm pack` copies at the pinned versions), origin/main vs branch, 5 Beam Capacity cases (default; ACI with three combinations incl. an identical one and computed service stress; AASHTO T-beam ±M; ACI without stirrups; AASHTO f′c = 12 ksi, f_y = 90 ksi) and the ASD tab (positive and negative moment) in each: `computeAll()`, `allChecks()`, `detEnvelope()`, `VALIDATION`, the status chip and the ASD `compute()` are identical apart from the new `ci` / `id` fields and the detailing step title of D11-4 item 2 (a text string inside the result object). On-screen tab text differs only by the link text and the D11-4 fixes. No console errors.
- Report PDFs (print media, `preferCSSPageSize`) looked at: cover, references/TOC, Summary dashboard with links, a combination with its result block, Torsion and Detailing results, Validation, ASD Summary/Analysis/results, header and footer boxes. Every "see §" link and TOC entry resolves to an element in the report.
- Headless click test in the suite: dashboard Flexural capacity → Flexure tab, card `flexC0` expanded at the top of the output panel; Shear "(A_t/s)_req,T" → Torsion `torC0`; ASD "M_all" → Analysis `anCap`. The page itself does not scroll (header stays visible). No console errors.

### Other copies
- None changed. The Development & Splice tab (copy of `ACI Rebar Development Length.html`) is untouched; its own print report is not in the D11 format and is left for the rebar tool's D11 PR (then synced, CLAUDE.md §3).

### Open items
- **Flexure reference in AASHTO mode:** the dashboard (`allChecks`) cites "ACI 9.3.3 / 22.2" for flexural capacity in AASHTO mode as well, and the flexure steps cite ACI articles; the report repeats the tool's citations. Not changed (a code-reference change, CLAUDE.md §4).
- **AASHTO edition label** "9th Edition" vs provisions following the 10th Ed. (open item O12) — the references row says "edition: verify".
- **Unbounded D/C display on screen:** the dashboard and the status chip print the raw ratio when a detailing "provided" value is zero (e.g. 878431372549.02, "DCR 10000000000.00"); the report prints "≫1". Not changed on screen.
- The default title block no longer carries "MBTA — Mini-Highs" (blanked by W11); an empty project prints "Untitled" on the cover and in the footer.

## 2026-10-18 — PR: claude/cbc-rebar-sync — Development & Splice tab: D11 calculation-sheet report and §6 links, synced from the rebar tool (Tier 1, display only; PR #289: https://github.com/mlococo88/All-Structural/pull/289)
- **Engineer request:** AUDIT.md D11; CLAUDE.md §3 sync of the duplicated ACI rebar app. The change itself is recorded in `fixlog/ACI Rebar Development Length.md`, entry "2026-10-18 — PR: claude/rebar-d11-report" (D11 report, D11 links, the Ctrl+P and hook-title display fixes); this branch contains that commit.
- **Scope:** only the Development & Splice srcdoc (`#suite-frame-dev`). The suite shell and the Beam Capacity and ASD srcdocs are **byte-identical** to main (everything before and after the dev srcdoc compared byte for byte).
- **Editing method:** as in the 2026-10-12 and D11 entries: the srcdoc was decoded (`&quot;` → `"`, `&amp;` → `&`), edited by exact-string replacement (the same 9 replacements as the standalone tool, each anchor found once), re-encoded (`&` → `&amp;`, `"` → `&quot;`) with CRLF kept, and put back. A decode → encode of the unedited file reproduced it byte for byte before editing.
- **Intentional differences kept** (embedded vs standalone, unchanged): screen/print layout CSS for the frame (`.appwrap`, `html,body` heights, `.layout`), no "All tools" link, no "Use / Share shared project info" buttons and no BridgeXfer scripts (the shell has them), own autosave key `rcsuite.rebar_autosave_v1` with the one-time read of `rebar_aci_autosave_v1`. After the sync the decoded tab differs from the standalone file only by these and by one new line: `const REBAR_RPT_TOOL = "Concrete Beam Design Suite — Development & Splice";` (print footer "<project> (Concrete Beam Design Suite — Development & Splice)", as the other two tabs print "(Concrete Beam Design Suite — …)").
- **Cover:** the tab prints its own cover, references and contents. The shell has no print or cover of its own; each tab prints its own report (as Beam Capacity and ASD do since D11-1 / D11-2).
- **Provision:** none. No formula, factor, unit, code reference or result changed. **Saved data:** none (`rcsuite.rebar_autosave_v1`, `rebar_aci_projects_v1`, `rebar_aci_inputTab_v1` untouched).
- **Check case (default, in the suite):** 7 sections, 17 letter pages (decoded tab printed on its own), result lines l_d 47.43 / l_dh 23.92 / l_dc 18.97 / l_st 61.66 / l_sc 30.00 in., f′c PASS; links "l_d: see §2.3; l_dh: see §3.3; l_dc: see §4.1; l_st: see §5.2; l_sc: see §6.1".
- **Verification:** `node tests/check-syntax.mjs "Concrete Beam Capacity.html"`: the shell's scripts pass; the four srcdoc scripts fail identically on main (the checker reads entity-encoded text); the decoded Development & Splice app passes. In the suite (headless Chromium, the tab's libraries from npm pack copies), main vs branch for the 5 cases of the rebar entry: every computed value, every tab's text (without the "Worked in" lines), the dashboard and the autosave identical; report built inside the frame: 7 sections, every internal link resolves, 0 KaTeX errors; dashboard links switch the tab and show the card (5–7 per case); the shell page does not scroll. Report PDF of the decoded tab (default 17 pages, AASHTO case 16) looked at. Console messages identical to main (the other tabs' CDN libraries are not served in the test), except in the #14 / f′c 2,500 case, where building the report (done only on the branch side) adds the pre-existing KaTeX "×" warnings of the ×4/3 step.
- **Other copies:** `ACI Rebar Development Length.html` (same change, branch claude/rebar-d11-report).
- **Open items:** those of the rebar entry.

## 2026-10-19 — PR: claude/cbc-rebar-sync-compsplice — Development & Splice tab: Comp. Splice cites AASHTO 5.10.8.4.5a in AASHTO mode, m = 1.0 shown, synced from the rebar tool (code reference change, no result change; PR #323: https://github.com/mlococo88/All-Structural/pull/323)
- **Engineer decision 2026-10-19;** CLAUDE.md §3 sync. The change, the code-text comparison (the AASHTO expressions with m = 1.0 equal the psi expressions the tab uses), before/after and check case are in `fixlog/ACI Rebar Development Length.md`, entry "2026-10-19 — PR: claude/rebar-aashto-compsplice" (C1); this branch contains that commit.
- **Scope:** only the Development & Splice srcdoc (`#suite-frame-dev`): `calcCompSplice` comments, `tabCSplice` first line, new `tabCSpliceAASHTO`, `rebarRefs` AASHTO rows, `rebarResultRows` compression-splice ref. ACI mode unchanged. The shell and the Beam Capacity and ASD srcdocs are byte-identical to main.
- **Editing method:** as in the 2026-10-18 sync: decode (`&quot;`, `&amp;`), the same 5 exact-string replacements as the standalone tool (each anchor found once), re-encode with CRLF. The decode → encode of the unedited file reproduced it byte for byte first. The suite-specific differences of the tab (layout CSS, no All-tools link or share buttons, `rcsuite.rebar_autosave_v1`, `REBAR_RPT_TOOL`) are unchanged: the standalone-vs-embedded diff is the same as on main apart from line numbers.
- **Check case:** AASHTO #9, f_y 80 ksi, f′c 2.5 ksi: l_sc = 1.0×(0.9×80.0 − 24)×1.128×4/3 = 72.19 in., before and after.
- **Verification:** decoded tab passes `node tests/check-syntax.mjs` (the four srcdoc scripts of the whole file fail identically on main: entity-encoded text). In the suite, main vs branch, 6 cases: every computed value, the dashboard and the autosave identical; tab text differs only on Comp. Splice in the 3 AASHTO cases; report in the frame builds 7 sections, all links resolve, 0 KaTeX errors.
- **Other copies:** `ACI Rebar Development Length.html` (same change).

## 2026-10-19 — PR: claude/aashto10-cbc-rebar — Development & Splice tab: AASHTO mode to AASHTO LRFD 10th Ed. (2024) §5.10.8, synced from the rebar tool (calculation change; PR #337: https://github.com/mlococo88/All-Structural/pull/337)
- **Engineer request / CLAUDE.md §3 sync.** The change, before/after code, provisions and check cases are in `fixlog/ACI Rebar Development Length.md`, entry "2026-10-19 — PR: claude/aashto10-rebar" (E1–E5). This branch is based on that branch (not merged yet) and contains its commit.
- **What changes in this tab (AASHTO mode only; ACI mode unchanged):** tension ℓd per 5.10.8.2.1a (Eqs. 5.10.8.2.1a-1/-2), λrc per 5.10.8.2.1c (new input βt, default 0), hooks per 5.10.8.2.4/.4a/.4b (new input R, default the minimum standard bend), f′c up to 15 ksi (10 ksi lightweight), tension laps with the new ℓd, compression renumbered to 5.10.8.2.2a, label "AASHTO LRFD 10th Ed. (2024) §5.10.8".
- **Editing method:** as in the earlier syncs: the `#suite-frame-dev` srcdoc was decoded (`&quot;` → `"`, `&amp;` → `&`; decode → encode of the unedited file reproduced it byte for byte), the same 36 exact-string replacements as the standalone tool were applied (each anchor found once), re-encoded with CRLF kept, and put back; the decoded tab read back from the file equals the edited text byte for byte.
- **Copy proof:** the line diff standalone ↔ decoded tab (the intentional embedded differences: frame layout CSS, no All-tools link / share buttons / BridgeXfer, `rcsuite.rebar_autosave_v1` with the one-time read of `rebar_aci_autosave_v1`, `REBAR_RPT_TOOL`) is 137 lines on main (main standalone vs main tab) and the same 137 lines, identical in content, after the sync (branch standalone vs branch tab). So outside those intentional differences the tab is byte-identical to the standalone file of claude/aashto10-rebar.
- **Check case:** as the rebar entry, in the suite: #5 / #8, f′c 4 / 8 ksi, fy 60 ksi: ℓd 20.53 / 14.52 / 52.57 / 37.17 in., ℓdh 15.93 / 10.35 / 38.32 / 24.03 in., Class B lap 26.69 / 18.87 / 68.33 / 48.32 in. (before 18.75 / 13.26 / 48.00 / 33.94; 11.88 / 8.40 / 19.00 / 13.44; 24.38 / 17.24 / 62.40 / 44.12).
- **Saved data:** no key or format change; the two optional fields (`betaT`, `hookR`) default to 0 / blank when absent (checked with an older `rebar_aci_autosave_v1` read by the suite).
- **Verification:** decoded tab passes `node tests/check-syntax.mjs`. In the suite frame (headless Chromium, KaTeX / Plotly from npm pack; the other tabs' CDN libraries blocked), the 11 cases of the rebar entry: every computed value and hero value equal to the standalone branch file; the two ACI cases identical to main's suite (values, notices, dashboard, tab texts, report text); report builds 7 sections, every internal link resolves, 0 KaTeX errors.
- **Other copies:** `ACI Rebar Development Length.html` (PR claude/aashto10-rebar). Open items: see the rebar entry.

## 2026-10-19 — PR: claude/aashto10-cbc-capacity — Beam Capacity tab: shear φ for lightweight concrete per AASHTO LRFD 10th Ed. 5.5.4.2; AASHTO edition stated as 10th Ed. (2024) (calculation change; PR #340: https://github.com/mlococo88/All-Structural/pull/340)
- **Branch:** based on claude/aashto10-cbc-rebar (Development & Splice tab sync, not merged yet) so the two PRs on this file do not conflict; it contains those commits. This entry changes only the `#suite-frame-capacity` srcdoc.
- **Editing method:** as the earlier entries: decode (`&quot;`, `&amp;`; decode → encode of the unedited file reproduced it byte for byte), 6 exact-string replacements (each anchor found once), re-encode with CRLF kept; the decoded tab read back equals the edited text byte for byte.

### K1. Shear resistance factor, lightweight concrete   [calculation change (§4)]
- **Where:** `shear()`, AASHTO branch, anchor `const phi = 0.90;   /* AASHTO LRFD 10th Ed. 5.5.4.2`.
- **Before:** `const phi = lam<1 ? 0.80 : 0.90;   /* 5.5.4.2: shear 0.90 normal weight, 0.80 lightweight */`
- **After:** `const phi = 0.90;   /* AASHTO LRFD 10th Ed. 5.5.4.2: shear in reinforced concrete 0.90 for normal weight and lightweight concrete (was 0.80 when lambda < 1) */`
- **Provision:** AASHTO LRFD 10th Ed. (2024) Art. 5.5.4.2, φ for shear and torsion in reinforced concrete sections: 0.90 normal weight, 0.90 lightweight. Less conservative than before; affects only λ < 1 (φV_n, DCR, and the A_v,min trigger 0.5φV_c of 5.7.2.3, which uses `sh.phi`). ACI mode unchanged.
- **Check case (AASHTO, default section 12 × 18 in., f′c 4 ksi, fy = fyt 60 ksi, 3 #5 bottom, #4 stirrups 2 legs @ 6 in., λ = 0.85, one combination Mu = 40 k-ft, Vu = 30 kip, no torsion):** d = 15.19 in., d_v = 14.24 in.; ε_s = 0.002362 → β = 1.732, θ = 37.27°; V_c = 0.0316 × 1.732 × 0.85 × √4 × 12 × 14.24 = 15.90 kip; V_s = 0.40 × 60 × 14.24 × cot 37.27° / 6 = 74.87 kip; V_n = min(90.77, 0.25 × 4 × 12 × 14.24 = 170.9) = 90.77 kip. Before φ = 0.80: φV_n = 72.62 kip, DCR = 30/72.62 = 0.413. After φ = 0.90: φV_n = **81.69 kip**, DCR = **0.367**. A_v,min trigger 0.5φV_c: 6.36 → 7.16 kip (required either way). λ = 1.0 and ACI cases identical to main.

### K2. Edition labels (no result change)
- Code selector "AASHTO LRFD 9th" → "AASHTO LRFD 10th (2024)"; input echo "AASHTO LRFD 9th Ed." → "AASHTO LRFD 10th Ed. (2024)"; `cbcCodeLabel()` "AASHTO LRFD, 9th Edition" → "AASHTO LRFD, 10th Edition (2024)"; references row "(labelled 9th Edition in this tool; some provisions follow the 10th Ed. — edition: verify)" → ", 10th Ed. (2024)"; Serviceability card title "Factored cracking moment with the 9th-Edition γ factors" → "Factored cracking moment with the γ factors" (ref "AASHTO 5.6.3.3, Eq. 5.6.3.3-1").
- Basis: the 2026-10-19 inventory lists the tab's other AASHTO items as matching the 10th Ed. (Eq. 5.4.2.4-1, 5.4.2.6, 5.4.2.8, 5.4.3.1, 5.6.2.1, 5.6.2.2, 5.6.3.3, 5.6.7, 5.7.2.3, 5.7.2.5, 5.7.2.6, 5.7.2.8, 5.7.3, 5.7.3.3, 5.7.3.4.1, 5.7.3.4.2, 5.10.1, 5.10.3.1.1, 5.10.3.1.2). Re-checked against the 10th Ed. text here: 5.5.4.2 (K1) and 5.6.3.3 (γ1 = 1.6, γ3 values; see open item).
- **Verification:** decoded tab passes `node tests/check-syntax.mjs`. Headless, main vs branch, Beam Capacity frame: the check case above (only `phi` and `phiVn` differ, validation identical); AASHTO λ = 1.0, ACI λ = 0.85 and ACI λ = 1.0 identical. No page errors.

### Open items (not changed)
- **γ3 selector (5.6.3.3):** the options read "0.67 — A615 Gr 60", "0.75 — A706 Gr 60", "0.76 — A615 Gr 75". In the 10th Ed., A615 Gr 75 is 0.75 and 0.76 is A615 Gr 80 (A706 Gr 80 = 0.80 and A1035 Gr 100 = 0.67 are not offered). The 0.76 value is ≥ the Gr 75 value (conservative), but the label names the wrong grade. Relabel to "A615 Gr 80" and/or add options? Engineer decision.
- Pre-existing (inventory): the dashboard cites "ACI 9.3.3 / 22.2" for flexure in AASHTO mode.

## 2026-11-01 — PR: claude/rpt-cbc — one combined Report tab in the suite shell, a chapter per tab; Development & Splice tab synced with the rebar tool's Report tab (CBRP / RBRP; display only, no calculation change) (PR #544: https://github.com/mlococo88/All-Structural/pull/544)

The file uses CRLF line endings; keep them. Every code site is tagged `CBRP` (suite shell, Beam Capacity and ASD tabs) or `RBRP` (Development & Splice tab).

### Engineer decision (2026-11-01)
Concrete Beam Capacity: ONE combined Report tab, a chapter per sub-app. The coordinator's rollout rules apply (shared viewer `shared/report.js`, worked steps `shared/steps.js`, values are the tool's own numbers, D11 print reports kept, no new saved data).

### CBRP-1. Suite shell: "Report" suite tab
- **Head:** the `#suite-report` CSS (anchor `/* CBRP: the combined Report tab`), then KaTeX 0.16.11 (`katex.min.css`, `katex.min.js`, the same pinned version and URL the Beam Capacity tab already loads; no new library), `shared/steps.js`, `shared/report.js` (classic scripts, relative path).
- **Nav / stage:** `<button class="suite-tab" id="suite-tab-report" data-target="report">Report</button>` and `<div class="suite-frame-wrap" data-app="report"><div id="suite-report"></div></div>`; the existing `show()` switches to it like the other tabs.
- **Script** (anchor `/* CBRP (2026-11-01): the suite's combined Report tab`, before BridgeXfer): `model()` asks each tab for its chapter (`cbcRptModel()`, `asdRptModel()`, `rbrModel()`), prefixes every step scope and cross-reference (`cap:`, `asd:`, `dev:`; `[[tab:…]]` → `[[tab:<chapter>/<tab>]]`), groups the Beam Capacity / ASD steps by topic (`SharedSteps.group`), joins the references of all chapters in a last chapter, and mounts the viewer. `go()` follows a tab link: the suite tab, then that tab's own tab (button of its tab bar, or `rbrGoto` on Development & Splice). A `beforeprint` listener prints the report alone while the Report tab is shown. The report is rebuilt each time the tab is shown; the collapsed sections are kept in memory.
- **Title block / running header:** the Beam Capacity tab's project fields (Project, Project No., Calculated by, Date, Checked by, Checked date); no owner cell.
- **Chapters:** A. Beam Capacity — Inputs, Summary of checks (`allChecks()`, each D/C linked to its worked step), Flexure / Shear / Torsion (every load combination; an identical combination refers to the first), Serviceability, Detailing (`detEnvelope()`), Validation notices. B. ASD Beam Calcs — Inputs, Analysis and rating. C. Development & Splice — the rebar tool's report (`rbrModel()`). D. References.

### CBRP-2. Beam Capacity tab: `cbcRptModel()` (anchor `SUITE REPORT CHAPTER (CBRP, 2026-11-01)`, before `function refresh(){`)
- `cbcRptFlex`, `cbcRptShear`, `cbcRptTor` follow `workFlexure`, `workShear`, `workTorsion` equation by equation; serviceability follows `buildServTab` (incl. `fsDeriv` lines and the AASHTO 5.6.3.3 minimum-reinforcement check); detailing uses each check's own `deriv` lines and a provided-vs-required step.
- **Values:** every step value is the tool's own (`CC.combos[i].F`, `.pf`, `.phiMn`, `.dcM`, `.sh`, `.share`, `.tor`, `.svc`, `.det`; `allChecks`, `detEnvelope`, `serviceSteelStress`). Display-only quantities shown inline exactly as the tabs show them: ε_tl = f_y/E_s + 0.003 (ACI), the AASHTO M_cr factored and min(M_cr, 1.33 M_u) (both computed inline by `buildServTab` and `allChecks` too), combined stress / limit and (A_v/s)_req+2(A_t/s)_req over provided (the ratios `allChecks` uses).
- Steps are plain objects in the `shared/steps.js` format (this tab does not load shared scripts); references get the edition: "ACI 318-19 …", "AASHTO LRFD 10th Ed. …".

### CBRP-3. ASD Beam Calcs tab: `asdRptModel()` (anchor `SUITE REPORT CHAPTER (CBRP, 2026-11-01)`, before `function refresh(){`)
- Follows `buildAnalysisTab`: E_c, n, ρ, k / kd (rectangular or T-section), j / z, M_conc, M_steel, M_all per level, RF per level and RF ≥ 1.00; inputs tables as the Input Echo tab; the section drawing (`drawSection`); a rating table linked to the steps. Values from `CC` (`compute()` of the last refresh).

### RBRP (Development & Splice tab): synced from `ACI Rebar Development Length.html` (CLAUDE.md §3)
- The same edits as PR #536 (fixlog `ACI Rebar Development Length.md`, entry "claude/rpt-acirebar"): shared scripts, the tab's own Report tab button, `render()` / `switchTab()` / `beforeprint` changes, the RBRP block. **Editing method:** the `#suite-frame-dev` srcdoc was decoded (`&quot;` → `"`, `&amp;` → `&`; decode → encode of the unedited file reproduces it byte for byte), the same scripted exact-string replacements as the standalone tool applied (each anchor found once), re-encoded with CRLF kept. The intentional embedded differences (frame layout CSS, no All-tools link / share buttons / BridgeXfer, `rcsuite.rebar_autosave_v1`, `REBAR_RPT_TOOL`) are unchanged. The srcdoc base URL is the suite's, so `shared/` resolves next to the suite file.
- **Tools that contain this snippet:** `ACI Rebar Development Length.html` and `Concrete Beam Capacity.html` (Development & Splice tab).

### shared/report.js
- Optional `section.part` (chapter heading): see `fixlog/shared-report.md`, entry "claude/rpt-cbc". Additive; Steel Bridge / Spread Footing report tests pass.

### Saved data / provisions
- Nothing new is saved; no key or format change (`rcbeam_v2_*`, `asd_v1_*`, `rcsuite.rebar_autosave_v1`, `rebar_aci_*`). The ASD and Beam Capacity tabs' `S.ui.tab` are not touched by the report.
- **Provision:** none. No formula, factor, unit, code reference or result changed.

### Check case (Beam Capacity default section, ACI, 12 × 18 in., 3 #5 bottom / 3 #5 top, #4 stirrups @ 6 in., f′c 4 ksi, f_y 60 ksi; combination 1: M_u 85 kip-ft, V_u 30 kip, T_u 13.5 kip-ft, A_ℓ 1.2 in²)
- Report = tab values: torsion T_n,t = 2(86.06)(0.0333)(60.00) cot 45° / 12 = 28.69 kip-ft, T_n,ℓ = 2(86.06)(1.200)(60.00)/42.00 · tan 45° / 12 = 24.59 kip-ft, φT_n = 0.75 × 24.59 = 18.44 kip-ft, DCR = 13.50 / 18.44 = 0.732; cross-sectional limit 423.7 / 474.3 psi = 0.893.

### How verified (headless Chromium; KaTeX 0.16.9 / 0.16.11, Plotly 2.27.0 / 2.32.0, three 0.160.0 from npm pack)
- 3 cases set in the Beam Capacity tab (ACI default section with three combinations incl. a hogging one, torsion 13.5 kip-ft, A_ℓ 1.2 in², service stresses for ±M_s; AASHTO T-beam 4+2 #9 / 2 #6, f_y 80 ksi, two combinations; ACI without stirrups or torsion, one combination, project fields with quotes): 105–209 steps, 32–58 topics, 35–49 cross-references, 18 numbered sections in 4 chapters; 0 unresolved or duplicate references, 0 KaTeX errors, no NaN / undefined in `SharedReport.text()`; 21–39 spot values per case equal the tabs' values exactly (per combination φM_n, M_n, c, φ, ε_t, DCR, V_c, V_n, φV_n, shear DCR (shared with torsion when it applies), T_th, A_cp, T_n, torsion DCR, A_ℓ,min; M_cr, f_r; ASD k, z, n, M_all, RF; development ℓd, ℓdh, ℓst).
- Building the report leaves every tab's state (`S` of Beam Capacity and ASD, the Development & Splice inputs and `currentTab`) and localStorage unchanged.
- main vs branch, same 3 cases: the text of every tab of the three apps (Beam Capacity 9–10 tabs, ASD 4, Development & Splice 6 with dashboard), the Beam Capacity and ASD results (`CC`) and localStorage identical.
- Tab links open the suite tab and the tab's own tab (Beam Capacity · Shear; Development & Splice · Tension Splice); Ctrl+P on the Report tab prints the combined report alone with the running header and page numbers (default case: 36 letter pages); 1280 and 390 px: no horizontal page scroll. 0 console errors.
- `node tests/check-syntax.mjs "Concrete Beam Capacity.html"`: the shell scripts pass; the srcdoc scripts fail identically on main (the checker reads entity-encoded text); each decoded tab (capacity, ASD, development) passes.
- `node tests/engine/run.mjs report steps steps-groups report-wiring`: 14 passed (shared/report.js changed).

### Open items
- At 390 px the suite's top bar (existing) shows only the first tabs; the Development & Splice and Report buttons are off screen (as Development & Splice is on main). Not changed (390 px layout fixes are a separate task).
- The Development & Splice tab keeps its own Report tab (synced copy) besides the suite's combined one.
- Beam Capacity's flexure steps work the layer with the largest moment and give the other layers in the layer table, as the Flexure tab does.


## 2026-11-01 — PR: claude/retire-cbasd — the address #asd / #dev / #capacity opens that suite tab (CBAR; UI only)

- **Why:** "Concrete Beam ASD.html" is retired (engineer decision, 2026-11-01). It now redirects to this file's ASD tab, and the tool list links to it directly. This is a cross-tool change allowed in one PR (CLAUDE.md §7 exception).
- **Where:** the suite shell script, in `DOMContentLoaded`, after the `.suite-tab` click handlers (anchor `CBAR (2026-11-01)`).
- **Added:**
  ```js
  var h0=String(location.hash||'').replace(/^#/,''); if(h0==='asd'||h0==='dev'||h0==='capacity') show(h0);
  ```
  `show()` is the existing tab switch: the same as clicking the tab, including the request for the Beam Capacity values when the ASD tab opens.
- **Behaviour:** without a hash nothing changes (Beam Capacity opens). No calculation, no saved data, no key changed.
- **Verified:** headless Chromium. No hash → Beam Capacity; `#asd` → ASD Beam Calcs; `#dev` → Development & Splice; `#capacity` → Beam Capacity. The console shows only the "failed to load" messages of the CDN files the test blocks, the same as without a hash.

## 2026-11-01 — PR: claude/cbc-hide-dev-report — the Development & Splice tab's own Report tab button removed in the suite (CBRP-2; display only)
- **Coordinator / engineer (2026-11-01):** every report self-contained; inside the suite the combined Report tab (chapter C. Development & Splice, built by the same `rbrModel()`) covers the embedded rebar app, so its own Report tab is not shown. The standalone `ACI Rebar Development Length.html` keeps its Report tab.
- **Where:** `#suite-frame-dev` srcdoc, the tab bar: the line `<button class="tab" data-tab="report">Report</button>` (entity-encoded in the srcdoc) is replaced by the comment `<!-- CBRP-2 (2026-11-01): no Report tab button in this embedded copy; the suite's combined Report tab (chapter C) covers it -->`. The RBRP code stays in the embedded copy (the combined report calls its `rbrModel()`; `rbrGoto` / `switchTab` serve the combined report's links).
- **Intentional embedded difference (CLAUDE.md §3):** add this to the list of differences between the standalone tool and the embedded copy (frame layout CSS, no All-tools link / share buttons / BridgeXfer, `rcsuite.rebar_autosave_v1`, `REBAR_RPT_TOOL`, and now no Report tab button). Tools that contain the rebar snippet: `ACI Rebar Development Length.html`, `Concrete Beam Capacity.html` (Development & Splice tab).
- **How verified:** headless Chromium, origin/main vs branch: the Development & Splice tab bar has no Report button on the branch (main: it had); the six result tabs' text, the combined Report tab's text (`SharedReport.text`), its tab links (Development & Splice · Tension Splice) and localStorage identical; 0 page errors.
- **Provision:** none. **Saved data:** none (the Report tab was never saved as `currentTab`).
- **Also fixed (combined report, display only; found while testing):** an identical load combination's note linked to `[[<chapter><first combination>/DCR]]`; when that combination's torsion is negligible its torsion work has no DCR step, so the default project had one unresolved link ("§?") in §5.3. The note now links to the first step of that combination's work (`fx…/Mu`, `sh…/d`, `tq…/Acp`). Anchor in the Beam Capacity srcdoc: `Same factored actions as Combination`. Check: default project, 0 unresolved references after (1 before).

## 2026-11-01 — PR: claude/rpt-onscreen-print — combined Report tab: no "On screen: ." in print (CBRP-3 / RBRP-2; display only)
- **Problem:** as in the rebar tool: the shared viewer hides tab links in print, so "On screen: [[tab:…|… tab]]." notes printed "On screen: .".
- **Fix:** every such note is one link whose text is the phrase: Beam Capacity chapter (`cbcRptModel`: Summary of checks note, the per-combination notes, the serviceability and detailing notes), ASD chapter (`asdRptModel` scope note), e.g. `'On screen: [[tab:tabDetail|Detailing tab]].'` → `'[[tab:tabDetail|On screen: Detailing tab]]'`; Development & Splice tab: the rebar tool's RBRP-2 edits (entry in `fixlog/ACI Rebar Development Length.md`, same PR). Applied by the same script to the decoded srcdocs (decode → regex → re-encode, CRLF kept).
- **§3:** tools that contain the rebar snippet: `ACI Rebar Development Length.html`, `Concrete Beam Capacity.html` (Development & Splice tab); the standalone ↔ embedded diff is unchanged apart from line numbers.
- **How verified:** printed combined report has no "On screen: ." fragments (main had them); combined-report checks (3 cases) and main-vs-branch tab texts, results and storage unchanged. **Provision:** none. **Saved data:** none.

## 2026-11-02 — PR: claude/phone-print-cbc — Phone / tablet: suite bar wraps, the three tabs go to one column; Report: "see see §" (PHN; display only, no calculation change)

Engineer-approved overnight job (2026-11-02): phone layout at 390 / 768 px and report print polish, one PR per tool. Every code site is tagged `PHN`.

### PHN-1. Suite bar wraps below 900 px   [display only]
- **Problem:** `#suite-nav` is a single 46 px row (`flex:0 0 46px; height:46px`). The page does not scroll, so the tabs that do not fit were cut off: at 390 px "ASD Beam Calcs", "Development & Splice", "Report", "All tools" and the share buttons; at 768 px "Report" and the share buttons. Those tabs could not be opened on a phone.
- **Where:** the suite page's own `<style>`, after `@media(max-width:1000px){#suite-report .rp-body{…}}`.
- **Added:**
```css
@media screen and (max-width:899px){#suite-nav{flex:0 0 auto;height:auto;flex-wrap:wrap;row-gap:0;padding:0 8px;} .suite-tab{padding:9px 12px;} #suite-brand{border-right:none;} #suite-xfer{margin-left:0;padding:4px 0 6px;flex-wrap:wrap;}}
```

### PHN-2. Beam Capacity and ASD Beam Calcs frames: one column below 900 px   [display only]
- **Problem:** both srcdoc frames have no small-screen layout. The input panel (`flex:0 0 33%`) stays beside the output panel, and the 6-column title grid has `minmax(120px,1fr)` columns. At 390 px the input panel was about 110 px wide, the output about 260 px, and the title grid was cut off. Nothing widened the page: it was clipped, with `html,body{overflow:hidden}`.
- **Where:** in each of the two frames (`suite-frame-capacity`, `suite-frame-asd`), before the `</style>` that follows `input.autoD{background:#F1F5F9;…;cursor:default;}`. The anchor occurs twice, once per frame, and both copies get the same block.
- **Added (in each frame):**
```css
@media screen and (max-width:899px){
  html,body{height:auto;overflow:visible}
  #app{height:auto}
  #projGrid{grid-template-columns:repeat(2,minmax(0,1fr))}
  #main{display:block}
  #inputPanel{max-width:none;overflow:visible;border-right:none;border-bottom:1px solid var(--color-border);padding-bottom:16px}
  #outputPanel{overflow:visible;padding:0 10px 40px}
}
```
- Inputs (with their tab bar) now sit above the outputs (with their tab bar); both bars already wrap. The frame's page scrolls; the panels do not scroll on their own, so the KaTeX page-scroll trap (#524) cannot occur.

### PHN-3. Development & Splice frame: the one column never grows past the window   [display only]
- **Problem:** below 980 px `.layout{grid-template-columns:1fr}` grew to the min-content width of the panels (738 px), so the frame scrolled sideways 364 px at 390 px on every one of its tabs. The Bar Schedule table (`table.vars` in `.subsec`) added another 24 px.
- **Where:** in `suite-frame-dev`, after `@media(max-width:980px){.layout{grid-template-columns:1fr; height:auto;}}`.
- **Added:**
```css
@media screen and (max-width:899px){.layout{grid-template-columns:minmax(0,1fr);} .tabcontent .subsec{overflow-x:auto;}}
```
- **Other copies:** this frame is the embedded copy of `ACI Rebar Development Length.html` (CLAUDE.md §3, known duplicate). The standalone file gets the same check in its own PR.

### PHN-4. Report: "see see §x" in print   [display only]
- **Problem:** the note "Same factored actions as Combination 2: see [[key]]" (Flexure, Shear and Torsion sections, combination 3) printed as "… see see §3.2". In print the shared viewer puts "see " in front of every § link in a note item, and the note already said "see".
- **Where:** the capacity frame's report builder, anchor `text:'Same factored actions as Combination '+(r.sameAs+1)+': see [['`.
- **Before:** `…+': see [['+pre+r.sameAs+…`
- **After:** `…+': [['+pre+r.sameAs+…`
- **Result:** print reads "… Combination 2: see §3.2." (once), and the screen reads "… Combination 2: §3.2" (a link). This is the only "see [[" in the file.

### Checked, no change
- Report → Print report: 35 pages, with the running header and page numbers. Nothing extends past the 7.5 in text width. The PDF text is unchanged apart from PHN-4.

### Smoke test
- `tests/smoke/phone-layout.mjs`: new key `cbc`. It now also counts a visible same-origin frame's sideways scroll as page scroll. It fails on origin/main (suite tabs cut off at 390 and 768 px) and passes on this branch.
- Checked once by hand at 390 and 768 px: every tab inside the three frames (capacity 15, ASD 7, dev 12). The frame never scrolls sideways on this branch. On origin/main the dev frame scrolled 364 px (Bar Schedule 43 px), and the capacity and ASD frames were clipped.

### How verified (no computed result, saved key or hand-off changed)
- origin/main vs this branch, headless Chromium, file://, at 1280 px:
  - The text of the suite and of the visible frame, on load and on the 4 suite tabs, is identical. localStorage after load is identical.
  - The whole-document `textContent` (suite and frames) differs only by PHN-4: the 3 report notes, plus the one source string.
- Screenshots at 900 and 1280 px are pixel-identical (0 differing pixels) on load and on all 4 suite tabs.

## 2026-11-02 — PR: claude/report-retire-aci, PR #685: https://github.com/mlococo88/All-Structural/pull/685 (RBRX-1 synced from ACI Rebar Development Length.html: the Development & Splice chapter of the combined Report gets the tabs' commentary and notes; display only, no result change)
- **What:** the `#suite-frame-dev` srcdoc's `rbrModel()` gets the same edits as `ACI Rebar Development Length.html` (fixlog `ACI Rebar Development Length.md`, entry "claude/report-retire-aci", RBRX-1): `rbComm` / `rbCommSub` (the tabs' `.narr` paragraphs and "Commentary — why & what" notes as report notes, a "Notes and commentary" subsection after each section's worked steps), the product shown before the 1.7 limit in steps `psiTE` / `rlcf`, the by-line and equation-convention note, the "Code checks: n of m pass" note and the Bar Schedule N/P / no-excess wording. The suite's combined Report (chapter C) shows them.
- **Editing method:** the srcdoc decoded (`&quot;` → `"`, `&amp;` → `&`; decode → encode of the unedited text reproduces it), the same scripted exact-string replacements as the standalone tool (each anchor found once), re-encoded. Only the `suite-frame-dev` srcdoc changed.
- **Not applied here (RBRX-2):** the embedded copy keeps its D11 print report for now. Retiring it with the suite's print routing (three frames and the combined Report) is the Concrete Beam Capacity report-retirement PR. Intentional embedded differences: frame layout CSS, no All-tools link / share buttons / BridgeXfer, `rcsuite.rebar_autosave_v1`, `REBAR_RPT_TOOL`, no Report tab button, and (until that PR) the D11 print report.
- **Tools that contain this snippet:** `ACI Rebar Development Length.html`, `Concrete Beam Capacity.html` (Development & Splice tab).
- **How verified:** origin/main vs branch, headless, default suite: the Development & Splice results (`computeFactors`, `calcTension`, `calcHook`, `calcComp`, `calcTensSplice`, `calcCompSplice`) and localStorage (`asd_v1_auto`, `rcbeam_v2_auto`, `rcsuite.rebar_autosave_v1`) identical; the combined Report text differs only in chapter C: 3 lines changed (project note, product limit, schedule note) and 58 added (the commentary, the code-check count); 0 unresolved references. `node tests/check-syntax.mjs "Concrete Beam Capacity.html"` and the decoded dev srcdoc: pass. `node tests/smoke/phone-layout.mjs --tool cbc`: pass.
- **Provision:** none. **Saved data:** none.

## 2026-11-02 — PR: claude/plib-rebar, PR #712: https://github.com/mlococo88/All-Structural/pull/712 — Development & Splice tab: "Saved projects…" dialog and Undo / Redo, synced from ACI Rebar Development Length.html (PLIB)   [display and storage only]
- **Where:** the embedded copy of the rebar app (`<iframe id="suite-frame-dev" srcdoc="…">`), same edits and anchors as the standalone tool:
  see `fixlog/ACI Rebar Development Length.md`, entry "claude/plib-rebar". Applied by script (decode the srcdoc → exact-string edits →
  re-encode with `&amp;` / `&quot;`; CRLF kept). In this copy the title bar has no "← All tools" link, so Undo and Redo are appended to it.
- **Saved data:** `rebar_aci_projects_v1` (shared with the standalone tool, unchanged) and this tab's autosave `rcsuite.rebar_autosave_v1`
  unchanged; no new key. The other two tabs (capacity, ASD) are not changed.
- **How verified:** headless: the frame's `readInputs()`, `computeFactors()` and dashboard text identical to origin/main on load and after
  f′c + 500 psi; Undo / Redo exact; the dialog lists and opens a project saved by the standalone tool. `node tests/smoke/phone-layout.mjs
  --tool cbc`: pass. `node tests/check-syntax.mjs`: pass.
- **Formulas, factors, units, code references:** none changed (§4 does not apply).

## 2026-11-02 — PR: claude/plib-cbc, PR #714: https://github.com/mlococo88/All-Structural/pull/714 — PLIB: Undo / Redo on the Beam Capacity and ASD Beam Calcs tabs   [display only]
- **Before:** each tab's header: New, Save Project, Open (its own projects dialog; Beam Capacity's has Rename and Duplicate), Export /
  Import JSON, Print / PDF. No undo. (The Development & Splice tab got Undo / Redo with the rebar app in PR #712.)
- **Where** (both in the srcdoc of their frame, `#suite-frame-capacity` and `#suite-frame-asd`; edited by script: decode the srcdoc →
  exact-string edits → re-encode with `&amp;` / `&quot;`; the file's CRLF kept):
  - head: after the last library script (capacity: `three@0.160.0/build/three.min.js`; ASD: `katex@0.16.11/dist/katex.min.js`):
    `<script src="shared/projects.js"></script>` and `<script src="shared/projects-ui.js"></script>`.
  - `autosave()`: **Before** `function autosave(){ lsSet(LS_AUTO,JSON.stringify(S)); }` (ASD: `lsSet(LS_AUTO, JSON.stringify(S))`)
    **After** the same plus `if(PLU) PLU.soon(); /* PLIB: one undo step per change (debounced) */` inside the braces (the step is
    recorded 400 ms after the last autosave).
  - before `function init(){`: `var PLU=null; function plibUndoInit(){…}` (anchor `/* PLIB (2026-11-02): Undo / Redo for the`): history
    over `S` without `S.ui` (output tab, collapsed cards, detail combination, print options: views) and, in ASD, without `S.projFromCap`
    (bookkeeping of the title block last received from Beam Capacity); `set` = `mergeState()` of the step with those fields as they are
    now, then `refresh()` (which autosaves; in Beam Capacity it also relays the shared inputs to ASD, as any change does). Buttons Undo,
    Redo after Open; Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z inside the tab.
  - `init()`: `plibUndoInit();` after its first `refresh();` (restoring the session is not a step).
  - opening a project starts a new history: capacity `loadProject()` and `doImport()`; ASD `projDialogGo()` and `doImport()`:
    `if(PLU) PLU.h.reset();` after their `refresh();`. New is a step (it can be undone).
  - ASD only, the live-bridge message listener (anchor `const p=d.data;`): `const plb=PLU?PLU.full():null;` before applying, and after
    its `refresh();` `if(PLU&&PLU.full()!==plb){ PLU.h.reset(); }`: a change relayed from Beam Capacity (section, materials, title
    block; CBC-O13b) is not an undo step but starts a new ASD history, so an undo in ASD never brings back values from before it (at
    start-up the first relay also changes the auto allowables, which would otherwise be a step that undoes nothing).
- **Saved data:** keys `rcbeam_v2_auto`, `rcbeam_v2_projects`, `asd_v1_auto`, `asd_v1_projects` and their formats unchanged; no new key.
- **How verified (headless, scratch scripts):** origin/main vs this branch, `S` (without `ui`) and `CC` of both tabs identical on load,
  after Beam Capacity b_w + 2 in, and after ASD M_DL + 50 / M_LL + 30; Beam Capacity: Undo → results before the change, Redo → after,
  an output-tab change not a step; ASD: two edits, Undo ×2 / Redo ×2 exact, Ctrl+Z one step; a Beam Capacity change relayed to ASD
  leaves ASD with no undo step; no new console errors. `node tests/smoke/phone-layout.mjs --tool cbc`: pass (console errors as on main).
  Header screenshot looked at. `node tests/check-syntax.mjs`: pass.
- **Formulas, factors, units, code references:** none changed (§4 does not apply).
- **Open item (raised, not changed):** the ASD Beam Calcs tab's own projects dialog has no Rename / Duplicate (Beam Capacity's and the
  Development & Splice tab's have them).

## 2026-11-02 — PR: claude/cbc-asd-rename, PR #721: https://github.com/mlococo88/All-Structural/pull/721 — ASD Beam Calcs tab: Rename / Duplicate in its projects dialog (PLIB)   [display and storage only]
- **Engineer decision (2026-11-02):** add Rename / Duplicate to the ASD tab's projects dialog, as on the Beam Capacity tab (open item of #714).
- **Before:** the ASD tab's Open dialog (`renderProjDialog()`, frame `#suite-frame-asd`) listed the saved projects (`asd_v1_projects`,
  `{ name: { when, data } }`) with a × Delete button only.
- **Where** (in the srcdoc of `#suite-frame-asd`; edited by script: decode → exact-string edits → re-encode; CRLF kept):
  - after `let PRJMODE="open", PRJSEL=null;`: `asdPutProjects(p, what)`, `renameProject(oldNm, newNm)`, `duplicateProject(nm)` (anchor
    `/* PLIB (2026-11-02): Rename / Duplicate in this tab's projects dialog`), the Beam Capacity tab's functions of the same names adapted
    to this list: Rename moves the item unchanged and keeps its place (a name in use asks before overwriting); Duplicate copies it under
    "<name> (copy)" (or "(copy 2)" …) with `when` set to now (Beam Capacity stamps its copy's `__savedAt` the same way); a refused write
    (`lsSet` false: storage full or blocked) shows a message and changes nothing (the whole list is one write).
  - `renderProjDialog()`, anchor `const acts=el("div","prjActs");`: ✎ Rename and ⧉ Duplicate buttons before × Delete (the row's existing
    `.prjActs button` style), selecting the renamed / copied item after the change.
- **Saved data:** `asd_v1_projects` and its item format unchanged; no new key.
- **How verified (headless, scratch script, two seeded projects):** origin/main vs this branch, the ASD tab's `S` (without `ui`) and `CC`
  identical on load; Rename: item byte-identical under the new name, the other item unchanged; Duplicate: "Beam B (copy)" with the same
  `data`, original unchanged; rename onto an existing name asks, Cancel changes nothing; a refused write (setItem throws
  QuotaExceededError): message shown, storage byte-identical; the renamed project opens with its values. `node tests/check-syntax.mjs`: pass.
- **Formulas, factors, units, code references:** none changed (§4 does not apply).

## 2026-11-03 — PR: claude/report-retire-cbc, PR #726: https://github.com/mlococo88/All-Structural/pull/726 (CBRX: the print reports of the Beam Capacity and ASD Beam Calcs tabs (D11, "Print / PDF" and their "Report Contents" dialogs) and the embedded Development & Splice copy's print report retired after porting what the combined Report tab lacked; "Print / PDF", "Print / PDF Report", Ctrl+P and the browser's Print print the suite's Report from every tab; display only, no result change)

### CBRX-1. What the print reports printed and the combined Report lacked, ported   [display] [no result change]
- **Engineer request (2026-11-03):** retire each tool's old print report by porting it in full into the Report tab (method of #685, #715, #718, #722, #724).
- **Compared:** the three print reports on origin/main (`buildReport()` of the Beam Capacity frame → `#printReport`, of the ASD frame → `#printReport`, of the Development & Splice frame → `#printroot`; print media, KaTeX annotations read as their TeX) against the suite's Report (`#rp-print`, print media) on the branch, with KaTeX loaded and without it. A number counts as present when the Report shows the same value, or more digits that round to it. Cases (scratch script, inputs set in each frame):
  - def: the default project of each tab;
  - c2: Beam Capacity with title block, A_ℓ = 1.2 in², service moments, three combinations (85 / −40 / 60 k-ft, torsion 13.5 / 0 / 5 k-ft), Validation and Combination 2 deselected in the saved report choice; ASD negative moment, inventory only, M_DL 180, M_LL 260 k-ft; Development & Splice AASHTO, #11, f′c 12 ksi, top bar, hook, excess reinforcement;
  - c3: Beam Capacity AASHTO tee (b_w 12, h 30, b_f 48, h_f 6 in), f_y 80 ksi, 4 #9 + 2 #6, two Strength combinations; ASD inventory and operating, M_DL 320, M_LL 500 k-ft.
- **Missing before the port** (Beam Capacity / ASD / Development & Splice, def): 20 / 1 / 1 distinct numbers; besides the print reports' section numbers:
  - Beam Capacity: the tabs' content the chapter does not repeat: the section schematic and stirrup elevation figures, the reinforcement and load-combination tables of the Input Echo, the Summary tab's all-combinations × limit-states table and section capacities, the per-combination flexure / shear / torsion tables and their worked lines (e.g. V_c = 23053 lb, V_s,max = 92212 lb, T_th = 49180 lb-in, T_cr = 196719 lb-in, φT_cr = 12.29 k-ft, T_n,t = 344.3 k-in, M_cr = 307.4 k-in), the "Results — <tab>" D/C lines, the cover and title-block lines (Subject, Sheet, code, tool / author), the front note (what the result lines mean, the omitted combinations) and the footer;
  - ASD: the Summary & Rating tab, the "Results — Load Rating" lines, the cover lines, the front note and the footer;
  - Development & Splice: its content was already in chapter C (#685, synced); only its own print path remained.
- **Ported:**
  - Beam Capacity frame (anchor `CBRX (2026-11-03): the D11 print report (buildReport -> #printReport`): `cbcRxSel()` (the saved choice, read without writing `S`, missing entries true as `normRptOpts`), `cbcRxSet()` (an Include box, "Select all", "Governing combinations only": the dialog's rules, written through `normRptOpts()` and `autosave()`), `cbcRxBoxes()`, `cbcRxHarvest()` (each chosen tab built by its own `buildOutput()` into a detached holder, every card open, a deselected combination's derivation replaced by the dialog's note, as `buildReport` did), `cbcRxResults(tab)` (the result lines of `cbcResultRows`, same PASS / FAIL rule, as a table), `cbcRxAbout()` (cover lines, front note, footer), `cbcRxFilter()` (sections of deselected tabs left out; a link into one goes to its tab "(not in this report)"; a link into an omitted combination goes to its note). `cbcRptModel()`: a deselected combination's subsection in Flexure / Shear / Torsion is the dialog's note (key `omit-<pre><ci>`), the sections are filtered by `cbcRxFilter`.
  - ASD frame (anchor `CBRX (2026-11-03): the D11 print report (buildReport -> #printReport, its &quot;Report Contents&quot; dialog, asdPageCSS)`): `asdRxSel`, `asdRxSet`, `asdRxBoxes`, `asdRxHarvest`, `asdRxResults` (the rating lines with Analysis, else with the Summary, as `buildReport`), `asdRxAbout`; `asdRptModel()` filters its sections by the choice.
  - Shell (anchor `CBRX (2026-11-03): the print reports of the Beam Capacity and ASD Beam Calcs tabs`): `rxRest(M)` reads each harvested tab in order (`rxWalk`) and adds to that tab's section ("As printed: tables, equations, notes and figures", under the tab's card titles, numbered) every table with a number the Report does not show yet (or, for a table that is not a variable list, a row of text it lacks), every equation line with such a number or a remark, every note with a sentence or number it lacks, and every figure it lacks; then "Results — <tab>"; the ASD Summary & Rating tab becomes a section of its own. References: "About the Beam Capacity chapter" / "About the ASD Beam Calcs chapter" (`rxAbout`). Title block: Subject and Sheet added. Without KaTeX an equation line is its TeX source (the Report's step note), and `rxLite` maps the few TeX commands the built-in renderer does not know (`\dfrac`, `\left( … \right)`, `\;` …) so offline lines read cleanly.
  - Include boxes on the Report bar (`rxControls` / `rxWire`): per chapter, the tabs and (Beam Capacity) the combinations with "Select all" / "Governing combinations only", the dialogs' labels. They write the frames' own field `S.ui.rptOpts` (same keys and defaults; no new key or format; no migration needed).
- **After the port:** in all three cases, with and without KaTeX, every number of the three print reports is in the Report except the print reports' section numbers, the "Generated <date time>" stamp, "63.2" of √f′c (the Report shows 63.25; √4000 = 63.246), and "120" of the TeX "120{,}000" (the Report shows 120,000).

### CBRX-2. Print reports and dialogs removed; Print prints the Report from every tab   [display]
- **Removed:**
  - Beam Capacity frame: `buildReport()`, `cbcResultBlock()`, `cbcPageCSS()`, `cbcApplyPageCSS()`, `openRptDialog()`, `closeRptDialog()`, `doPrint()`, `generateReport()`, `#printReport`, `#rptBg` / `#rptDlg` and their CSS and handlers, the D11 `beforeprint` / `afterprint` handlers.
  - ASD frame: the same set (`asdPageCSS`, `asdApplyPageCSS`, `asdResultBlock`, …).
  - Development & Splice frame (synced with ACI Rebar Development Length.html #685, RBRX): `buildReport()`, `rebarPageCSS()`, `rebarApplyPageCSS()`, `rebarResultBlock()`, `#printroot` and its print CSS, its `beforeprint` / `afterprint` handlers; the link-comment of `REBAR_CARDS` updated as in the standalone.
- **Kept:** `cbcRefs`, `cbcResultRows`, `reportTabList`, `defaultRptOpts`, `normRptOpts`, `ASD_REFS`, `REBAR_RPT_TOOL`, `rebarRefs`, `rebarResultRows`.
- **Changed:**
  - "Print / PDF" (Beam Capacity, ASD; tooltip added) → `cbcRxPrint()` / `asdRxPrint()`; "Print / PDF Report" (Development & Splice) → `printReport()`: the shell's `CBRP.printAny()` (shows the Report tab, renders it, `api.print()`); a frame opened alone prints itself.
  - Ctrl+P inside a frame: the same (`keydown`, prevented only when the shell is there).
  - Shell: an inline `beforeprint` script before `shared/steps.js` calls `CBRP.prep()` (from another tab: remembers it and shows the Report), so the browser's Print and Ctrl+P print the Report with its running header; an `afterprint` handler brings the tab of before back. Nothing is saved.
- **Governing provision:** none changed. No formula, factor, unit, code reference or computed value changed (CLAUDE.md §4).
- **Saved data:** no key or format change (`rcbeam_v2_auto`, `asd_v1_auto`, the project lists, `rcsuite.rebar_autosave_v1`); `S.ui.rptOpts` keeps its keys and defaults, written only by an Include box, as by the dialogs.
- **How verified:**
  - `node tests/check-syntax.mjs "Concrete Beam Capacity.html"`: pass (the three srcdoc frames too).
  - origin/main vs branch, the three cases, with KaTeX: the Beam Capacity `CC`, the ASD `CC` and the Development & Splice results (JSON) identical; the text of every tab of the three frames identical; localStorage identical before and after showing and printing the Report and after visiting every tab; no console errors.
  - Report: 0 unresolved references, 0 duplicate keys.
  - Print routing from each of the four suite tabs, by `beforeprint`, by `CBRP.printAny`, by each frame's button and by Ctrl+P in each frame (14 paths per case): `#rp-print` holds the Report, `body.rp-printing` and the running header are set, the tab of before comes back.
  - Include boxes: each writes only `S.ui.rptOpts` of its frame; a deselected tab's section leaves the Report; a deselected combination's derivation becomes the note; "Governing combinations only" and "Select all" set the dialog's selections.
  - `node tests/smoke/phone-layout.mjs --tool cbc`: all passed.
- **Other copies:** the Development & Splice frame is the embedded copy of ACI Rebar Development Length.html; it now matches that file's RBRX (#685) apart from the suite's print path (the shell's Report).
- **Open items (for the engineer):** the Summary tab's check table shows the "Longitudinal torsion steel to develop T_u" D/C as a raw number (878431372549.02 in the default project, where A_ℓ = 0); the old print report's result lines wrote "≫1". Unchanged here (on-screen value); raise if a cap should be shown.

## 2026-11-03 — PR: claude/cbc-al-zero-dc, PR #730: https://github.com/mlococo88/All-Structural/pull/730 (CBAZ: a detailing D/C whose provided quantity is zero shown as "≫1 (A_ℓ = 0)" instead of a raw number such as 878431372549.02; display only, no result change)

- **Problem:** `detEnvelope()` computes the D/C of a "≥" detailing check as `need/Math.max(have,1e-12)`. With A_ℓ = 0 (the default project) the "Longitudinal torsion steel to develop T_u" D/C is 0.8784 in² / 1e-12 = 878431372549.02, and that raw number was shown in the Summary tab's check table and in the Report's "Summary of checks" table (878431372549.020) and as "≫1" in the Report's "Results — Detailing" lines. Open item of the CBRX entry (#726) above. Same for "Minimum longitudinal torsion reinforcement" when A_ℓ = 0 and A_ℓ,min > 0 (918419957660.62 with no stirrups).
- **Where (Beam Capacity frame, `suite-frame-capacity` srcdoc; inside the srcdoc `"` is `&quot;` and `&&` is `&amp;&amp;`):**
  - `allChecks()`, detailing push, anchor `forceOK:E.na?null:E.allOk,id:E.id,ci:E.ci`. Before: `forceOK:E.na?null:E.allOk,id:E.id,ci:E.ci});` After: `forceOK:E.na?null:E.allOk,id:E.id,ci:E.ci,` + new line `have0:!E.na&&!!E.entry&&E.entry.cmp==="\\ge"&&E.entry.need>0&&!(E.entry.have>1e-12)});` (a display flag: the governing entry's provided quantity is zero).
  - New, before `function heatColor`: `const CBAZ_SYM={dTorAlReq:"A_ℓ",dTorAl:"A_ℓ",dAvMin:"A_v"};` and `function cbcDcZero(c){ return c&&c.have0?"≫1 ("+(CBAZ_SYM[c.id]||"provided")+" = 0)":null; }` (non-breaking spaces so the cell wraps only after "≫1").
  - `buildSummaryTab()`: before `const td2=heatTD(c.na?null:c.dcr);` after `const td2=heatTD(c.na?null:c.dcr,(!c.na&&cbcDcZero(c))||undefined);` (the cell keeps its red colour from the D/C value).
  - `cbcRptModel()`, "Summary of checks": before `{t:c.na||c.dcr==null?'—':(isFinite(c.dcr)?fmt(c.dcr,3):'∞'),…}` after `{t:c.na||c.dcr==null?'—':(cbcDcZero(c)||(isFinite(c.dcr)?fmt(c.dcr,3):'∞')),…}`.
  - `cbcResultRows()` (tabServ / tabDetail rows): a 6th element `c.na?null:cbcDcZero(c)`; `cbcRxResults()`: `([lab,ref,dcr,cmb,fok,dtx])` and the D/C text `dtx||((!isFinite(dcr)||dcr>=1e6)?"≫1":fmt(dcr,2))`.
- **Governing provision:** none changed (ACI 318-19 22.7.6.1(b) and 9.6.4.3 as before). No formula, factor, unit, code reference, D/C value or PASS / FAIL changed (CLAUDE.md §4): `dcr` itself is untouched, only its text.
- **Check case (default project, A_ℓ = 0, T_u case 1.2D + 1.6L):** A_ℓ,req = 0.878 in², A_ℓ = 0 → D/C shown before 878431372549.02 (Summary tab), 878431372549.020 (Report summary), ≫1 (Report result lines); after "≫1 (A_ℓ = 0)" in all three; FAIL before and after. With A_ℓ = 1.2 in²: D/C 0.73 PASS before and after (unchanged: the flag is off).
- **How verified:** `node tests/check-syntax.mjs "Concrete Beam Capacity.html"` pass. origin/main vs branch, headless, default project: `CC` (JSON) identical, `allChecks()` identical apart from the new `have0` field (set on dTorAlReq only), the text of every Beam Capacity tab identical except the one Summary cell, the ASD frame text identical, status chip identical; the Report's model text (901 lines) differs only in the three D/C cells above. Case A_ℓ = 1.2 in²: `CC`, checks, Summary text and Report text identical. Case without stirrups: dTorAl and dTorAlReq show "≫1 (A_ℓ = 0)", PASS / FAIL as before. CRLF line endings kept.
- **Saved data:** none (the flag is computed, never saved).
- **Other copies:** none.
- **Open items:** none.

## 2026-11-05 — PR: claude/cbc-hook-excess, PR #782: https://github.com/mlococo88/All-Structural/pull/782 (CBH1: ACI standard hook ℓ_dh no longer reduced by A_s,req/A_s,prov; panel hint quotes the ACI 318-19 25.4.10.2 list; CALCULATION CHANGE, less conservative before)

- **Problem (audit C1):** in ACI mode `calcHook()` multiplied the standard hook length by the excess-reinforcement factor when "Apply excess-reinforcement reduction" was ticked. ACI 318-19 25.4.10.1 permits the A_s,req/A_s,prov reduction only for the lengths of 25.4.2.1(a), 25.4.6.1(a), 25.4.7.1(a) and 25.4.9.1(a); 25.4.3.1 (standard hooks) is not listed, and 25.4.10.2(d) does not permit the reduction for hooked, headed or mechanically anchored bars (printed pp. 487–488; R25.4.10.2 gives the reason: hook and head anchorage is a breakout mechanism). The tool's ℓ_dh was unconservative by the factor (2× at 0.5). The panel hint quoted the 318-14 list: (d) omitted "hooked", (e) read SDC D, E or F (318-19: C, D, E or F), (f) piles to pile caps was missing.
- **Copies changed (CLAUDE.md §3):** the Development & Splice frame of `Concrete Beam Capacity.html` (`#suite-frame-dev` srcdoc; decoded with `srcdoc.py`, edited, re-encoded, exact round trip checked, CRLF kept) and `ACI Rebar Development Length.html`, with the same script (exact-string edits, each found once).
- **Where / before / after:**
  - `calcHook()`, ACI branch, anchor `const ldh_calc = (inp.fy*f.psiE_h`. Before: `const ldh_calc = (inp.fy*f.psiE_h*f.psiR*f.psiO*f.psiC_h*f.excess)/(55*f.lambda*f.sqrtFc)*Math.pow(f.db,1.5);` After: `const ldh_calc = (inp.fy*f.psiE_h*f.psiR*f.psiO*f.psiC_h)/(55*f.lambda*f.sqrtFc)*Math.pow(f.db,1.5);` plus a trailing comment citing 25.4.10.1 / 25.4.10.2(d).
  - Hook tab (ACI), anchor `+ subsec("2. Hook Development Length","Eq. 25.4.3.1",`: the line before it, `  + excessBlock(inp,f)`, becomes `  + (inp.useExcess?subsec("Excess Reinforcement Factor","§25.4.10.2(d)",note(…"Not applied to the hook" …)):"")`. The Eq. 25.4.3.1 block drops `+(inp.useExcess?"\\cdot\\tfrac{A_{s,req}}{A_{s,prov}}":"")` from the equation and `${inp.useExcess?`\\times ${fmt(f.excess,3)}`:""}` from the substitution.
  - Report `rbrHook()`, ACI branch: `.concat(exS)` on the "Modification factors" steps becomes `.concat(inp.useExcess?[{type:'note',text:'Excess reinforcement factor not applied to the hook: …25.4.10.2(d)…'}]:[])`; step `ldhcalc` drops the `A_{s,req}/A_{s,prov}` term from `eq` and `× factor` from `sub`. The AASHTO branch (and its `exS`) is unchanged.
  - Panel D2 hint, anchor `<div class="hint">Reduces l_d by`: now names which ACI lengths are reduced (straight bars in tension and bars in compression; ℓ_dh never) and lists ACI 318-19 25.4.10.2 (a)–(f) as a paraphrase: (d) hooked, headed or mechanically anchored bars, (e) SDC C, D, E or F, (f) piles and concrete-filled pipe piles to pile caps in SDC C–F. The AASHTO sentence is unchanged.
  - Bar Schedule note (tab and Report) and the Report's code-reference row: "applied to development lengths but not splices" gains " or hooks (ACI 25.4.10.2(d))" in ACI mode only; "25.4.10.1 (excess reinforcement)" becomes "25.4.10.1, 25.4.10.2(d) (excess reinforcement; not for hooks)".
- **AASHTO branch checked, unchanged:** AASHTO LRFD 10th Ed. (2024) 5.10.8.2.4a computes ℓ_dh = ℓ_d + R + d_b/2 with ℓ_d of 5.10.8.2.1 and the hook force F_h entered in Eqs. 5.10.8.2.1a-1 and -2. Eq. 5.10.8.2.1a-2 carries λ_er on f_y, and λ_er (Eq. 5.10.8.2.1c-4) has no exclusion for hooks (pp. 5-189 to 5-194). So λ_er stays in the AASHTO hook, as the code says.
- **Governing provision:** ACI 318-19 25.4.10.1, 25.4.10.2(d), Eq. 25.4.3.1; AASHTO LRFD 10th Ed. 5.10.8.2.4a, Eq. 5.10.8.2.1a-2, 5.10.8.2.1c (unchanged).
- **Check case (ACI, #8, f′c 4,000 psi, f_y 60,000 psi, ψ_e 1.0, ψ_r 1.6, ψ_o 1.0, normalweight, excess option on, A_s,req 0.50 / A_s,prov 1.00 in²):** ψ_c = min(4000/15000 + 0.6, 1.0) = 0.867; ℓ_dh,calc = 60,000 × 1.0 × 1.6 × 1.0 × 0.867 / (55 × 1.0 × 63.25) × 1.0^1.5 = 83,200 / 3,478.7 = 23.92 in. Before: × 0.5 = 11.96 in. After: 23.92 in (max with 8d_b = 8.0 in and 6 in). Bar Schedule hook column with the same inputs, before → after: #4 6.0 → 8.5, #5 6.0 → 11.8, #6 7.8 → 15.5, #7 9.8 → 19.6, #8 12.0 → 23.9, #9 14.3 → 28.7, #10 17.1 → 34.2, #11 20.0 → 40.0, #14 32.9 → 65.9, #18 50.7 → 101.4 in. With the option off nothing changes.
- **How verified:** headless (Playwright Chromium, `file://`, tests/libs), origin/main vs branch, both `Concrete Beam Capacity.html` (every frame: Beam Capacity `computeAll()`, `allChecks()`, `cbcRptModel()`, ASD `compute()`, `asdRptModel()`, Dev `rbrModel()` and calc* results, the text of every tab, and the suite Report text) and `ACI Rebar Development Length.html`:
  - default project: identical in both files;
  - ACI #8 with the option on at 0.5: only the hook ℓ_dh and its text, the Bar Schedule hook column, the notes above and the hook schematic label differ; ℓ_d, ℓ_dc, ℓ_st, ℓ_sc unchanged;
  - AASHTO #8 with the option on at 0.5: identical (ℓ_dh = 8.99 in before and after).
  - `node tests/check-syntax.mjs` (all files, srcdoc frames included): pass. `node tests/smoke/phone-layout.mjs --tool cbc,aci`: pass. `node tests/smoke/project-library.mjs --tool rebar`: ALL PASS. 0 console errors.
- **Saved data:** none changed (no key or format; `useExcess`, `asReq`, `asProv` are read as before).
- **Other copies:** `ACI Rebar Development Length.html` and the Development & Splice frame of `Concrete Beam Capacity.html` (both changed here). Spread Footing already excludes hooks (SFDH/SFEX).
- **Open items:** none from this change. (Audit C4, the 12 in floor in the tension splice base, is conservative and was not changed.)
## 2026-11-05 — PR: claude/cbc-look, PR #783: https://github.com/mlococo88/All-Structural/pull/783 (CBTH-1: suite look for the Beam Capacity and ASD Beam Calcs tabs and the suite bar, as Light Pole / apps/steel-bridge; display only, no result change)

### CBTH-1. One header, compact project bar, tab stripe, small card titles, fixed-width inputs   [display only] [no result change]
- **Engineer request (2026-11-05, Phase 1 of the concrete beam suite update, appearance):** make the suite look like the Light Pole and Steel Bridge apps (not Spread Footing; no orange). Audit item 14.
- **Where:** the `suite-frame-capacity` and `suite-frame-asd` srcdoc pages (decoded with `srcdoc.py get`, edited, re-encoded with `put`; exact round trip), first `<style>` block: a new CBTH block inserted just before the anchor `/* PHN (2026-11-02): phone / tablet`, and a CBTH phone block after the PHN media block (anchor `#outputPanel{overflow:visible;padding:0 10px 40px}` + `}`). The ASD copy is identical except `#asdInTabs .asdInTab` for `#rcbInTabs .rcbInTab`. No JS, no markup, no id or text changed.
- **Inserted (Beam Capacity copy):**
  ```css
/* CBTH (2026-11-05): suite look as Light Pole / apps/steel-bridge (display only). One header under the suite bar: title,
   byline and status chip on one line with the buttons; the title block as a compact project bar (label beside its box);
   card titles 8.5 pt upper-case; selected tabs with a 3 px blue top stripe; input boxes a fixed width with the unit on
   the same line; header buttons translucent on navy (no white primary); table heads slate #EEF2F6. */
#hdr{padding:6px 14px 7px}
#hdr .titleRow{align-items:center;gap:6px 12px}
#hdr .titleRow>div:first-child{display:flex;align-items:baseline;flex-wrap:wrap;gap:0 12px;min-width:0}
#hdr h1{font-size:14pt;line-height:1.25}
#hdr .byline{margin-top:0}
#statusChip{font-size:9pt;padding:2px 11px;border-radius:12px;margin-right:auto}
#hdrBtns button{font-size:9.5pt;padding:4px 11px;border-color:rgba(255,255,255,.35);background:rgba(255,255,255,.08)}
#hdrBtns button:hover{background:rgba(255,255,255,.18)}
#hdrBtns button.pri{background:rgba(255,255,255,.08);color:#fff;font-weight:600}
#hdrBtns button.pri:hover{background:rgba(255,255,255,.18)}
#projGrid{display:flex;flex-wrap:wrap;align-items:center;gap:5px 12px;margin-top:6px}
#projGrid label{flex-direction:row;align-items:center;gap:6px;font-size:9.5pt}
#projGrid label span{font-weight:600;font-size:8pt;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap}
#projGrid input,#projGrid select{width:104px;padding:2px 6px;border-color:rgba(255,255,255,.35)}
#projGrid input[data-fkey='pg_Project'],#projGrid input[data-fkey='pg_Subject']{width:160px}
#projGrid input[data-fkey='pg_Sheet']{width:64px}
#projGrid input[type=date]{width:124px}
#projGrid select{width:180px}
#projGrid input[readonly]{width:140px}
#tabBar button.active{color:var(--navy-800);box-shadow:inset 0 3px 0 var(--blue-600)}
#@@InTabs .@@InTab[aria-selected='true']{color:var(--navy-800);box-shadow:inset 0 3px 0 var(--blue-600)}
h2.secTitle{font-size:inherit;font-weight:inherit;letter-spacing:inherit;line-height:1.4}
.fRow{flex-wrap:nowrap;gap:8px;margin:0;padding:3px 0;border-bottom:1px solid #EEF0F3}
.fRow:last-child{border-bottom:0}
.fRow label{flex:1 1 auto;min-width:0}
.fRow input,.fRow select,.fRow textarea{flex:0 1 auto;min-width:0}
.fRow input[type=number]{width:92px;text-align:right;font-variant-numeric:tabular-nums}
.fRow select{width:auto;max-width:60%}
.fRow .unit{min-width:34px}
.fRow>input:last-child,.fRow>select:last-child{margin-right:42px}
.fRow.chk{border-bottom:0}
.fRow.chk input{margin-right:0}
table.vt th,table.rt th,table.dt th,table.lyrT th,table.cbT th{background:#EEF2F6}
  ```
- **Inserted after the PHN media block (both copies):**
  ```css
/* CBTH (2026-11-05): phone / tablet: the title block keeps two columns with the label above its box */
@media screen and (max-width:899px){
  #projGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
  #projGrid label{flex-direction:column;align-items:stretch;gap:1px}
  #projGrid input,#projGrid select,#projGrid input[data-fkey]{width:auto;max-width:none}
  #projGrid input[type=date],#projGrid input[readonly]{width:auto}
  #statusChip{margin-right:0}
}
  ```
- **Suite shell** (`#suite-nav`, the outer bar), so the suite bar and the tab's header read as one navy header:
  - Before: `background:var(--navy-900);... padding:0 12px;gap:2px;box-shadow:0 2px 6px rgba(0,0,0,.25);position:relative;z-index:10;}`
  - After: `background:var(--navy-800);... padding:0 12px;gap:2px;position:relative;z-index:10; border-bottom:1px solid rgba(255,255,255,.12);}`
- **Effect:** header ≈ 70 px instead of ≈ 140 px at 1920 (title, byline, status chip and buttons on one line; the nine title-block fields on one line at 1920, two at 1280); selected input and output tabs carry the 3 px blue top stripe; card titles 8.5 pt upper-case (were 12 pt bold) in the input and output panels; number boxes 92 px right-aligned with the unit beside them (the unit no longer wraps under the box at 390 px); "Print / PDF" is a header button like the others (was white). Phone (below 900 px): title block two columns, label above the box, as before.
- **Not changed:** every input, id, label text, default, handler, computed result, saved key / format (`rcbeam_v2_auto`, `rcbeam_v2_projects`, the ASD keys), the Report tab and print. The Development & Splice tab is re-themed in a later PR (CBTH-2).
- **How verified:** headless dump (scratchpad `look/dump.mjs`) of the visible text and every input value of every input and output tab of the three suite tabs, the Report tab and the standalone ACI Rebar tool, origin/main vs the branch: ALL IDENTICAL (55 views; main against itself also identical); 0 console errors. `node tests/check-syntax.mjs`: all pass. `node tests/smoke/phone-layout.mjs --tool cbc,aci`: all passed (no sideways scroll at 390 / 768). `node tests/smoke/project-library.mjs --tool rebar`: ALL PASS. Screenshots at 1920, 1280 and 390 px before / after beside Light Pole.
- **Other copies:** none (the CSS of the two frames is kept in step by this entry).
- **Open items:** at 390 px the ASD Summary table and the Beam Capacity Summary table are wider than the frame (their Worked in / Status columns scroll inside the table box) — as before, not changed.

## 2026-11-05 — PR: claude/cbc-aashto-fyt, PR #784: https://github.com/mlococo88/All-Structural/pull/784 (CBFY: AASHTO design yield of transverse reinforcement per 5.7.2.7, 100 ksi only for a 5.4.3.3 element under flexural shear without torsion, else 60 / 75 ksi; three stale "(verify)" markers removed; CALCULATION CHANGE in AASHTO mode, less conservative before)

- **Problem (audit C2):** in AASHTO mode `fytDesign()` returned min(f_yt, 100 ksi) for every shear calculation, citing "5.4.3.1 / 5.7.2.8 (verify)". AASHTO LRFD 10th Ed. (2024) 5.7.2.7 (p. 5-67) allows the specified yield strength up to 100 ksi only for elements and connections of 5.4.3.3 under flexural shear without torsion. For all other elements the design yield is f_yt where f_yt ≤ 60 ksi. Above 60 ksi it is the stress at a strain of 0.0035, but not more than 75 ksi. With f_yt = 100 ksi the tool used 100 ksi where the code allows at most 75 ksi, so V_s was 33 % high. ACI mode is unchanged: min(f_yt, 60), Table 20.2.2.4(a).
- **Where (Beam Capacity frame, `#suite-frame-capacity` srcdoc; decoded with `srcdoc.py`, exact-string edits, re-encoded, round trip checked, CRLF kept; inside the srcdoc `"` is `&quot;` and `&&` is `&amp;&amp;`):**
  - `fytDesign()`, anchor `function fytDesign(){`.
    - Before: `function fytDesign(){ return S.code==='ACI' ? Math.min(S.mat.fyt,60) : Math.min(S.mat.fyt,100); }`. The comment above it cited `5.4.3.1 / 5.7.2.8 (verify)`.
    - After: `function fytLimAASHTO(){ return S.mat.fyt100 ? 100 : (S.mat.fyt<=60 ? 60 : Math.min(29000*0.0035,75)); }` and `function fytDesign(){ return S.code==='ACI' ? Math.min(S.mat.fyt,60) : Math.min(S.mat.fyt,fytLimAASHTO()); }`. The comment now paraphrases 5.7.2.7. E_s × 0.0035 = 101.5 ksi, so above 60 ksi the limit is 75 ksi for the elastic-plastic bar the tool assumes.
  - `defaultState()`: `mat:{…,gamma3:0.67}` becomes `mat:{…,gamma3:0.67,fyt100:false}`.
  - Materials input (AASHTO only), after the f_yt row: a checkbox `fyt100`, "Element of 5.4.3.3, flexural shear without torsion: f_yt up to 100 ksi (5.7.2.7; otherwise 60 ksi, or 75 ksi above 60)". AASHTO mode does not evaluate torsion (the torsion module is ACI only), so the user states both conditions with this one box.
  - `validate()`: the warning `if(S.mat.fyt>100 && S.code==='AASHTO') … "AASHTO 5.7.2.8" … (AASHTO 5.4.3.1 / 5.7.2.8)` becomes `if(S.code==='AASHTO' && S.mat.fyt>fytDesign()) W.push({code:"AASHTO 5.7.2.7", …})`. It names the value used, and says when the box is not ticked.
  - Shear tab, AASHTO V_s block (`workShear`): a first line works f_y = min(f_yt, limit) (5.7.2.7). Report `cbcRptShear` AASHTO: a new step `fytd` (same working, ref AASHTO LRFD 10th Ed. 5.7.2.7) before `Vs`.
  - Input Echo and Report "Section and materials" tables (AASHTO only): a row "f_yt up to 100 ksi (5.4.3.3, no torsion; 5.7.2.7)" with yes / no.
  - C3, text only: `phiFlex()` comment "AASHTO LRFD 10th Ed. 5.6.2.1 (verify)" becomes "… 5.6.2.1". Development & Splice frame: the comment "AASHTO LRFD 5.10.8.4.5a (edition: verify)" becomes "AASHTO LRFD 10th Ed. 5.10.8.4.5a", and the Report reference row "5.10.2.1 (hook geometry; …; edition: verify)." loses "; edition: verify". All three were confirmed in the audit against the 10th Ed. text: 5.6.2.1 ε_tl 0.005 / 0.008; 5.10.2.1 Standard Hooks p. 5-176; 5.10.8.4.5a as implemented.
- **Effects of f_yt,design:** V_s (Eq. 5.7.3.3-4), A_v,min (Eq. 5.7.2.5-1, which has f_y in the denominator, so it rises), the A_v ≥ A_v,min test that chooses Eq. 5.7.3.4.2-1 or -2 for β, and the shear-torsion sharing line, as before through `fytDesign()`.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) 5.7.2.7 (p. 5-67) and 5.4.3.3 (p. 5-24). Before, the tool cited 5.4.3.1 / 5.7.2.8, which do not set this limit.
- **Check case (AASHTO; default section 12 × 18 in, 3 #5 / 3 #5, #4 two-leg stirrups at 6 in, f′c 4 ksi, f_y 60 ksi, f_yt 100 ksi; one combination M_u 120 k-ft, V_u 60 kip, T_u 5 k-ft (torsion present, box not ticked)):**
  - d_v = 14.24 in, θ = 49.9°, β = 0.876, V_c = 9.46 kip (unchanged).
  - Before: f_y = min(100, 100) = 100 ksi; V_s = 0.40 × 100 × 14.24 × cot 49.9° / 6 = 79.93 kip; V_n = 89.39; φV_n = 0.90 × 89.39 = 80.45 kip; D/C 60/80.45 = 0.746; A_v,min = 0.0316 × 1.0 × √4 × 12 × 1 / 100 = 0.0076 in²/in (D/C 0.114).
  - After: f_y = min(100, 75) = 75 ksi; V_s = 0.40 × 75 × 14.24 × 0.842 / 6 = 59.95 kip; V_n = 69.41; φV_n = 62.47 kip; D/C 0.961 (still PASS); A_v,min = 0.0101 in²/in (D/C 0.152).
  - With the box ticked (T_u 0): 100 ksi, results as before.
  - f_yt 70 ksi: min(70, 75) = 70, no change. f_yt 60: no change.
- **How verified:** headless (Playwright Chromium, `file://`, tests/libs), origin/main (after #783) vs branch.
  - What was read:
    - Beam Capacity frame: `computeAll()`, `allChecks()`, `cbcRptModel()`, every tab's text;
    - ASD frame: `compute()`, `asdRptModel()`, tab text;
    - Dev frame: `rbrModel()` and calc results, tab text;
    - suite Report text;
    - also `ACI Rebar Development Length.html`.
  - Default project (ACI): only the Dev Report reference row loses "; edition: verify" (both files); every computed value identical.
  - AASHTO f_yt 100 with torsion: the values above; nothing else moved.
  - AASHTO f_yt 100 ticked, f_yt 70, f_yt 60, and ACI f_yt 100: `computeAll()` and `allChecks()` identical; only the new f_y working line, step and echo row added.
  - Checkbox toggled in the page: φV_n 62.47 → 80.45 kip.
  - Tests:
    - `node tests/check-syntax.mjs` (all): pass.
    - `node tests/smoke/phone-layout.mjs --tool cbc,aci`: pass.
    - `node tests/smoke/project-library.mjs --tool rebar`: ALL PASS.
    - 0 console errors.
  - Screenshot of the Materials card looked at.
- **Saved data:** keys unchanged (`rcbeam_v2_auto`, `rcbeam_v2_projects`). The state gains the optional field `mat.fyt100` (default false, filled by `mergeState`). No migration that keeps the old 100 ksi was added on purpose. A saved AASHTO project with f_yt > 75 ksi now opens at 75 ksi and shows the 5.7.2.7 warning. The old value was the unconservative result this change corrects, and the user can tick the box where the element qualifies. Older copies of the tool ignore the field.
- **Other copies:** `fytDesign()` exists only in the Beam Capacity frame (the ASD frame has no transverse steel). The C3 edits in the Development & Splice frame are mirrored in `ACI Rebar Development Length.html` (CLAUDE.md §3).
- **Open items:** none.

## 2026-11-05 — PR: claude/cbc-asreq-note, PR #786: https://github.com/mlococo88/All-Structural/pull/786 (CBAR: A_s,req note in the Development & Splice frame; C5: the Report's Summary of checks prints "≫1" like the Summary tab instead of "∞"; display only, no result change)

- **Development & Splice frame (`#suite-frame-dev` srcdoc):** the same A_s,req hint as `ACI Rebar Development Length.html`. See the CBAR entry in `fixlog/ACI Rebar Development Length.md` (anchor `Also drives Class A splice eligibility.</div>`; ACI 318-19 9.6.1.1, R9.6.1.1 p. 135, R25.4.10.2 p. 488).
- **C5, Beam Capacity frame (`#suite-frame-capacity` srcdoc), `cbcRptModel()`, "Summary of checks":**
  - Before: `(cbcDcZero(c)||(isFinite(c.dcr)?fmt(c.dcr,3):'∞'))`.
  - After: `(cbcDcZero(c)||(isFinite(c.dcr)?fmt(c.dcr,3):'≫1'))`.
  - The Summary tab's `heatTD()` already shows an unbounded D/C (zero capacity) as "≫1", so the two now read the same.
  - Check case: default project, "Torsional capacity", A_ℓ = 0 gives T_n = 0. Report before: "∞ §5.1 … FAIL". After: "≫1 §5.1 … FAIL". Summary tab "≫1" before and after.
- **Governing provision:** none changed. ACI 318-19 22.7.6.1 as before. No D/C value or PASS / FAIL changed (`dcr` is untouched, only its text).
- **How verified:**
  - Headless (Playwright Chromium, `file://`, tests/libs), origin/main vs branch. Compared: every frame's results (`computeAll()`, `allChecks()`, `cbcRptModel()`, `compute()`, `asdRptModel()`, `rbrModel()`, calc results), every tab's text, and the suite Report text.
  - Default project: only the one Report D/C cell differs ("∞" → "≫1").
  - ACI excess case and AASHTO f_yt 100 case: the same one cell, or identical.
  - Tests: `node tests/check-syntax.mjs` pass; `node tests/smoke/phone-layout.mjs --tool cbc,aci` pass. CRLF kept.
- **Saved data:** none.
- **Other copies:** the A_s,req hint is also in `ACI Rebar Development Length.html` (same PR). The C5 text exists only here.
- **Open items:** none.
## 2026-11-05 — PR: claude/cbc-dev-look, PR #785: https://github.com/mlococo88/All-Structural/pull/785 (CBTH-2: Development & Splice re-themed to the suite look (Light Pole / apps/steel-bridge / the Beam Capacity tab): navy header, slate tabs with a blue stripe, card heads, one-row inputs; display only, no result change)

### CBTH-2. Beige / maroon serif theme replaced by the suite theme   [display only] [no result change]
- **Engineer request (2026-11-05, Phase 1 of the concrete beam suite update, appearance):** make the concrete beam suite look like the Light Pole and Steel Bridge apps, no orange. Audit item 14 (this tab was still the legacy beige `--panel #f7f6f2`, maroon `--accent #8a1f1f`, Times everywhere, upper-case letter-spaced tabs).
- **Where:** the `suite-frame-dev` srcdoc page (Development & Splice tab; decoded with `srcdoc.py get`, re-encoded with `put`, exact round trip). A CBTH-2 block appended at the end of the first `<style>` block (just before its `</style>`). The same block, byte for byte, is in `ACI Rebar Development Length.html`. Plus two highlight colours in JS strings (display only):
  - `renderBatch` bar-schedule row of the current bar, anchor `return `<tr style="${cur?'background:#f0e6e6;font-weight:bold;':''}">``: `#f0e6e6` → `#EEF4FB`;
  - the active bar-schedule row, anchor `if(active){active.style.background="#f0e6e6";}`: `#f0e6e6` → `#EEF4FB` (the suite's governing-row wash, as Light Pole `--accent-wash`).
- **Inserted CSS:**
  ```css
/* CBTH-2 (2026-11-05): suite look as Light Pole / apps/steel-bridge and the suite's Beam Capacity tab (display only; the same
   block in ACI Rebar Development Length.html and the Development & Splice tab of Concrete Beam Capacity.html). Navy / slate / blue
   tokens instead of beige and maroon; system sans for controls, tabs, card heads and labels, Times kept for the calculation text;
   a navy header; tabs with a white selected tab and a 3 px blue top stripe; panels as cards with 8.5 pt upper-case heads;
   each input on one row (label left, box right, the unit in the label); buttons as the suite's. */
:root{
  --navy-900:#16304F; --navy-800:#1E3A5F; --blue-600:#2563EB;
  --slate-50:#F8FAFC; --slate-100:#F1F3F5; --slate-200:#E4E7EB; --slate-300:#CBD5E1; --slate-400:#94A3B8; --slate-900:#0F172A;
  --font-ui:-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --font-doc:"Times New Roman",Times,serif;
  --ink:var(--slate-900); --sub:#475569; --line:var(--slate-200); --line2:#EEF0F3;
  --paper:#ffffff; --panel:var(--slate-100); --accent:var(--navy-800); --accent2:var(--blue-600);
  --pass:#047857; --passbg:#ECFDF5; --fail:#B91C1C; --failbg:#FEF2F2; --warn:#B45309; --warnbg:#FFFBEB;
}
body{background:var(--slate-100);}
input,select,textarea,button{font-family:var(--font-ui);}
/* header */
.titlebar{display:flex; flex-wrap:wrap; align-items:baseline; gap:2px 12px; margin:-16px -16px 12px; padding:7px 16px 8px;
  background:var(--navy-800); color:#fff; border-bottom:3px solid var(--navy-900); font-family:var(--font-ui);}
/* the navy band runs the full window width also where the page is narrower than the window (standalone, max-width 1500 px) */
.titlebar{box-shadow:0 0 0 100vmax var(--navy-800); clip-path:inset(0 -100vmax);}
@media print{.titlebar{box-shadow:none; clip-path:none;}}
.titlebar .apptitle{font-size:14pt; font-weight:600; letter-spacing:.4px; color:#fff;}
.titlebar .byline{font-size:9pt; color:#C7D4E4; margin:0;}
.titlebar .alltools{order:-1; flex:0 0 100%; margin:0; font-size:11px; color:#C7D4E4;}
.titlebar .alltools:hover{color:#fff;}
.titlebar button:first-of-type{margin-left:auto!important;}
.titlebar .btn,.titlebar .btn.small{align-self:center; font-size:9.5pt; padding:4px 11px; border:1px solid rgba(255,255,255,.35);
  background:rgba(255,255,255,.08); color:#fff; font-weight:400;}
.titlebar .btn:hover{background:rgba(255,255,255,.18); color:#fff;}
/* panels and cards */
.card{border-color:var(--line); border-radius:6px;}
.inputpanel{background:var(--slate-50); font-family:var(--font-ui); font-size:9.5pt;}
.panel{margin:10px; border:1px solid var(--line); border-radius:6px; background:#fff; overflow:hidden;}
.panel:last-child{border-bottom:1px solid var(--line);}
.panel-head{padding:6px 10px; background:var(--slate-100); border-bottom:1px solid var(--line); font-family:var(--font-ui);
  font-size:8.5pt; font-weight:600; letter-spacing:.05em; color:#334155;}
.panel.collapsed .panel-head{border-bottom:0;}
.panel-head:hover{background:#E8ECF1;}
.panel-head .tw{font-size:9px; color:#64748B;}
.panel-head .pnum{color:var(--navy-800); font-weight:700;}
.panel-body{padding:8px 10px;}
/* input tabs and output tabs */
#rebarInTabs,.tabs{gap:3px; padding:7px 12px 0; background:var(--slate-100); border-bottom:1px solid var(--line);}
#rebarInTabs .rebarInTab,.tab{font-family:var(--font-ui); font-size:9pt; font-weight:400; text-transform:none; letter-spacing:0;
  padding:5px 11px; color:#334155; background:var(--slate-200); border:1px solid var(--line); border-bottom:none;
  border-radius:5px 5px 0 0; margin-bottom:-1px;}
#rebarInTabs .rebarInTab:hover,.tab:hover{background:#DDE2E8; color:var(--ink);}
#rebarInTabs .rebarInTab[aria-selected='true'],.tab.active{background:#fff; color:var(--navy-800); font-weight:600;
  border-color:var(--line); border-bottom:1px solid #fff; box-shadow:inset 0 3px 0 var(--blue-600);}
#rebarInTabs .rebarInTab[aria-selected='true']{background:var(--slate-50); border-bottom-color:var(--slate-50);}
#rebarInTabs .rebarInTab:focus-visible,.tab:focus-visible{outline:2px solid var(--blue-600); outline-offset:-2px;}
/* input rows: label left, box right */
.titleblock,.row2,.row3{display:block;}
.field{display:grid; grid-template-columns:minmax(38%,1fr) minmax(0,auto); align-items:center; gap:2px 10px; margin:0; padding:4px 0;
  border-bottom:1px solid var(--line2);}
.field>label{grid-column:1;}
.field label{margin:0; font-size:9.5pt; font-weight:400; text-transform:none; letter-spacing:0; color:var(--ink);}
.field .unit{color:#64748B;}
.field>input,.field>select,.field>.chk{grid-column:2; justify-self:end; margin:0;}
.field>.hint,.field>textarea{grid-column:1/-1;}
.field input,.field select,.field textarea{width:auto; padding:3px 6px; border:1px solid var(--slate-300); border-radius:4px;
  font-size:9.5pt; background:#fff; color:var(--ink);}
.field input[type=number]{width:92px; text-align:right; font-variant-numeric:tabular-nums;}
.field input[type=text],.field input[type=date]{width:150px;}
.field input[type=number][placeholder]{width:230px; text-align:left;}
.field select{max-width:100%; min-width:0;}
.field textarea{width:100%;}
.field input:focus,.field select:focus,.field textarea:focus{outline:none; border-color:var(--blue-600);
  box-shadow:0 0 0 2px rgba(37,99,235,.25);}
.chk label{font-size:9.5pt;}
.hint{font-size:8.5pt; color:#64748B; line-height:1.45;}
.inwarn{border-color:var(--fail)!important; background:#FEF2F2!important;}
.btnrow{margin:6px 0;}
/* buttons */
.btn{font-family:var(--font-ui); font-size:9pt; font-weight:400; text-transform:none; letter-spacing:0; padding:4px 10px;
  border:1px solid var(--slate-300); border-radius:4px; background:#fff; color:var(--ink);}
.btn:hover{background:var(--slate-100); color:var(--ink);}
.btn.small{font-size:9pt; padding:3px 9px;}
.btn.primary{background:var(--navy-800); border-color:var(--navy-800); color:#fff; font-weight:600;}
.btn.primary:hover{background:var(--navy-900); color:#fff;}
/* summary dashboard */
.dash{background:var(--slate-50); border-bottom:1px solid var(--line); padding:10px 14px;}
.dash h3{font-family:var(--font-ui); font-size:8.5pt; font-weight:600; letter-spacing:.05em; color:#334155;}
.check{font-family:var(--font-ui); font-size:9pt; border-radius:4px;}
.check.pass{border-color:#A7F3D0;}
.check.fail{border-color:#FCA5A5;}
.check.info{border-color:var(--line);}
.check .st{font-size:8pt; letter-spacing:.06em;}
/* output text */
.result-hero{border-bottom:2px solid var(--line);}
.result-hero .rt{font-family:var(--font-ui); font-size:11pt; font-weight:600; letter-spacing:.05em; color:#334155;}
.result-hero .rs{font-family:var(--font-ui); font-size:8.5pt; color:#64748B;}
.result-hero .rv{color:var(--navy-800);}
.result-hero .rvl{font-family:var(--font-ui); font-size:8pt; color:#64748B;}
.narr{background:var(--slate-50); border-color:var(--line); border-radius:4px; color:#334155;}
.note{border-color:var(--line); border-left-color:var(--blue-600); border-radius:4px; background:#F8FAFC;}
.note > summary{font-family:var(--font-ui); font-size:8.5pt; font-weight:600; letter-spacing:.05em;}
.note > summary:hover{background:#EFF6FF;}
.subsec > .sh{font-family:var(--font-ui); font-size:8.5pt; font-weight:600; letter-spacing:.05em; color:#334155;
  border-bottom-color:var(--line);}
.subsec > .sh .ref{font-size:8pt; color:#64748B;}
table.vars th,table.vars td{border-color:var(--line);}
table.vars th{background:#EEF2F6; font-family:var(--font-ui); font-size:8pt; letter-spacing:.04em; color:#475569;}
.eq{background:var(--slate-50); border-color:var(--line); border-radius:4px;}
.eq .eqt{font-family:var(--font-ui); font-size:8.5pt; font-weight:600; letter-spacing:.05em; color:#334155;}
.eq .eqt .ref{color:var(--blue-600);}
.chartctl{font-family:var(--font-ui);}
.schematic{border-color:var(--line);}
.wkLink{font-family:var(--font-ui); font-size:8.5pt; color:#64748B;}
.warnbox{border-radius:0 4px 4px 0; color:#78350F;}
  ```
- **What it does:** the old tokens (`--ink`, `--sub`, `--line`, `--line2`, `--panel`, `--accent`, `--accent2`, `--pass` …) are redefined to the navy / slate / blue palette, so the inline `var(--accent)` etc. in the generated HTML follow (the governing value, symbols in the commentary). The title bar is a navy header ("← All tools" above the title in the standalone, title + byline, Undo / Redo right). Input and output tabs: slate, selected white with the 3 px blue top stripe, sentence case (the label text is unchanged; the upper case was CSS). Panels A–H are cards with 8.5 pt upper-case heads, letter in navy. Each input is one row: label left (with its unit, as before), box right (number 92 px, right-aligned), hint under the row; the title-block, f_y / bar-size, A_tr / s / n and A_s rows are no longer two or three to a line. Buttons as the suite's (white with a slate border; Print / PDF Report navy; header buttons translucent on navy). Summary dashboard, equation boxes, variable tables, notes and section heads in the slate palette with sans-serif heads; the calculation text stays Times.
- **Not changed:** every input, id, label text, default, handler, computed result, saved key / format (`rebar_aci_autosave_v1`, `rebar_aci_projects_v1`, `rcsuite.rebar_autosave_v1`, `rebar_aci_inputTab_v1`), the Report (shared/report.js) and print, the drawings and charts (bar colours, schematic).
- **How verified:** headless dump (scratchpad `look/dump.mjs`) of the visible text (CSS upper case ignored) and every input value of every input and output tab of the standalone tool (incl. its Report tab), the suite's three tabs and the suite Report, origin/main vs the branch: ALL IDENTICAL (55 views), 0 console errors. `node tests/check-syntax.mjs`: all pass. `node tests/smoke/phone-layout.mjs --tool cbc,aci`: all passed (no sideways scroll at 390 / 768). `node tests/smoke/project-library.mjs --tool rebar`: ALL PASS. Screenshots at 1920 and 390 px before / after (every input tab at 1600) beside Light Pole.
- **Other copies:** `ACI Rebar Development Length.html` (same block and the same two colour edits, in this PR; CLAUDE.md §3).
- **Open items:** the `.check` value text in the summary dashboard stays upper case (`47.4 IN`), as before.

## 2026-11-05 — PR: claude/cbc-shell-look, PR #787: https://github.com/mlococo88/All-Structural/pull/787 (CBTH-3: suite shell aligned: Report background and buttons, one tab colour, slimmer phone bar; display only, no result change)

### CBTH-3. Suite shell (outer page) aligned with the suite look   [display only] [no result change]
- **Engineer request (2026-11-05, Phase 1 of the concrete beam suite update, appearance):** align the outer suite bar / frame switcher with the Light Pole / Steel Bridge look, as CBTH-1 and CBTH-2 did for the three tabs. CBTH-1 already made the suite bar navy-800 without its shadow.
- **Where:** the shell's `<style>` block (outside the srcdoc pages), `Concrete Beam Capacity.html`. CSS only.
- **Before / after:**
  - `#suite-tab-asd.active .dot{background:#34d399;…}`, `#suite-tab-dev.active .dot{background:#fbbf24;…}`, `#suite-tab-report.active .dot{background:#f472b6;…}` → `background:#60a5fa` for all three, as `#suite-tab-capacity` (the amber and pink dots read as orange / off-palette next to the navy; one blue accent for the selected tab, as its underline).
  - `#suite-report{…background:#efede8;…}` → `background:#F1F3F5` (slate-100; the beige was the old theme).
  - `#suite-report .rp-bar button{font-size:9pt;padding:3px 10px;}` → the same plus `font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; border:1px solid #CBD5E1; border-radius:4px; background:#fff; color:#0F172A; cursor:pointer;` and `#suite-report .rp-bar button:hover{background:#F1F3F5;}` (the suite's ordinary button, as the Development & Splice tab after CBTH-2).
  - New, after the PHN phone rule: `@media screen and (max-width:899px){.suite-tab{padding:8px 9px;font-size:12px;gap:6px;} #suite-brand{padding-right:6px;margin-right:0;gap:7px;} #suite-xfer{padding:2px 0 6px;}}`: at 390 px the suite bar takes three rows instead of four (brand + Beam Capacity, the other three tabs, All tools + share buttons).
- **Not changed:** the tab labels, ids, handlers, hand-off buttons, Report content and print (print hides the bar as before), saved data.
- **How verified:** headless dump (visible text and input values of every tab of the three suite tabs, the Report tab and the standalone ACI Rebar tool), origin/main vs branch: ALL IDENTICAL (55 views), 0 console errors. `node tests/check-syntax.mjs`: all pass. `node tests/smoke/phone-layout.mjs --tool cbc`: all passed (390 / 768). Screenshots of the Report tab at 1920 and 390 px before / after.
- **Other copies:** none.
- **Open items:** none.

## 2026-11-05 — PR: claude/cbc-dash, PR #788: https://github.com/mlococo88/All-Structural/pull/788 (CBDC: check summary panel in the Beam Capacity tab, as Spread Footing / Light Pole; display only, no result change)

### CBDC. Check summary panel: one line per check; a left column on screens 1500 px and wider   [display only] [no result change]
- **Engineer request (2026-11-05, Phase 2 of the concrete beam suite update):** the left-column check summary panel of Spread Footing (SFDC #737, SFDF #740) and Light Pole (LPDC #747), in the Beam Capacity frame (`<iframe id="suite-frame-capacity" srcdoc=…>`). The Summary tab, the Report and printing are kept as they are.
- **Where (inside the Beam Capacity srcdoc page):**
  - Markup: in `<div id="main">`, before `<div id="inputPanel"></div>`, added `<aside id="cbcDashCol" aria-label="Check summary"></aside>`. In `<div id="outputWrap">`, before `<div id="tabBar"></div>`, added:
    ```html
    <div id="cbcDashBox"><!-- CBDC: check summary (moved into #cbcDashCol on screens 1500 px and wider) -->
      <div id="cbcDashHead"><button type="button" id="cbcDashTgl" aria-controls="cbcDash"></button><h2 id="cbcDashTtl">Check summary</h2><span id="cbcDashCnt"></span></div>
      <div id="cbcDash"></div>
    </div>
    ```
  - `refresh()`: before `buildTabs();` / `autosave();`, after `buildTabs();` / `cbcDashRender();   /* CBDC: … */` / `autosave();`.
  - CSS: at the end of the page's `<style>` (anchor `/* CBDC (2026-11-05): check summary panel`), all under `@media screen` / `@media print{#cbcDashCol,#cbcDashBox{display:none!important}}`.
  - JS: new block just before `function refresh(){` (anchor `const CBDC={key:'cbc_dashCollapsed_v1'`): `CBDC_COND`, `cbcDashDC`, `cbcDashItems`, `cbcDashGo`, `cbcDashRender`, `cbcDashPlace`, `cbcDashColl` and a start-up IIFE. The full code is below.
- **What the lines are (no new calculation):** one line per row of the Summary tab's "Design Check Summary" table, from `allChecks()` in the same order.
  - Status: as the Summary's Status column (N/A; `forceOK` for the detailing checks; else FAIL when the D/C is not finite or > 1.0001).
  - Short value: the D/C as the Summary prints it (`fmt` 2 decimals, "≫1", and the CBAZ "≫1 (A_ℓ = 0)").
  - Where a check FAILS on a condition (the detailing checks `dCover`, `dSpace`, `dLayer`, `dAsMin`, `dEpsMin`, `dStirS`, `dAvMin`, `dTorS`, `dTorAl`, `dTorAlReq`, `dTorAts`, `dTorAlDist`, `dCrack`, and the torsion cross-sectional limit), the short value is the condition (e.g. "s > s_max (torsion)", "A_s < A_s,min", "ε_t < ε_ty + 0.003", "c_c < c_c,req", "section too small"), and the D/C moves to the expanded text, with "(the ratio is within its limit; the status comes from the condition)" when it is ≤ 1. Capacity checks (flexure, shear, torsion, combined V+T, AASHTO minimum reinforcement) keep the D/C.
  - Expanded text: provided vs limit / required from the governing entry of `detEnvelope()` (detailing), or the D/C and governing combination; the N/A reason (`naWhy`, as the Summary's "Checks reported as N/A" box); the reference and "→ Tab · Card".
  - ▸ expands a line; FAIL lines start expanded; the state is kept by name for the session only. A click on the line opens the card where the check is worked (`cbcGoto(tab, cbcCheckCard(c).card)`, the D11 "Worked in" target); on a phone the card is also scrolled into view.
  - Header count: "n NG" (FAIL lines) or "no NG". With input blockers: "Input invalid: output withheld …" and the count "input invalid".
- **Layout:** ≥ 1500 px (frame width): `cbcDashPlace()` (on load and on a `matchMedia('screen and (min-width:1500px)')` change) moves `#cbcDashBox` into `#cbcDashCol` (292 px with padding; the panel height; scrolls on its own; sticky header); the input panel is 33 % of the width left after the column. « collapses the column to a 42 px strip (title written vertically, count). < 1500 px: the box sits above the output tabs as a grid of one-line chips (`minmax(min(250px,100%),1fr)`, at most 42vh tall, scrolls inside), with "▾ Hide checks" / "▸ Show checks". On a phone it is above the output tabs, after the inputs, as before for the output.
- **Saved data:** new per-browser UI key `cbc_dashCollapsed_v1` ('1' = collapsed, '0' or absent = open). Not in `S`, the autosave (`rcbeam_v2_auto`), the saved projects or the JSON export. No existing key or format changed.
- **Report and printing:** unchanged (the panel is outside `#tabPages`/`#pageBody`, which the Report reads; hidden in print).
- **Check case:** default project (ACI 318-19): Summary "3 checks not satisfied"; panel "3 NG": "Torsional capacity D/C ≫1 FAIL", "Maximum closed-stirrup spacing for torsion  s > s_max (torsion)  FAIL" (expanded: "6.00 in provided, limit ≤ 5.25 in; governing combination: 1.2D + 1.6L", "D/C 1.14"), "Longitudinal torsion steel to develop T_u  A_ℓ < A_ℓ,req  FAIL" (expanded: "0.00 in² provided, required ≥ 0.88 in²", "D/C ≫1 (A_ℓ = 0)"); "Clear cover D/C 1.00 PASS". A click on the stirrup-spacing line opens Detailing · card 7. AASHTO, default section, one combination M_u 60, V_u 20: "1 NG", "Clear cover  c_c < c_c,req  FAIL" (2.00 in provided, required ≥ 2.50 in; D/C 1.25).
- **How verified:** headless Chromium, origin/main vs branch (the panel hidden while reading the tab text): `computeAll()`, `allChecks()`, `cbcRptModel()`, the text of every tab of the three frames, the standalone ACI Rebar tool and the suite's Report tab identical in 5 cases (default, AASHTO f_yt 100 / 60, ACI with torsion, excess reinforcement); 0 console errors. `node tests/check-syntax.mjs`; `node tests/smoke/phone-layout.mjs --tool cbc,aci` (390, 768); `node tests/smoke/project-library.mjs` ALL PASS. Screenshots before / after at 1920 and 390 px, 1366 px and collapsed, looked at; no sideways scroll.
- **Other copies:** none (the Spread Footing / Light Pole code is the model, not shared).
- **Open items:**
  - At 1500 px and wider the input and output panels are narrower than before by the column (292 px; 42 px collapsed); the input tabs wrap to two rows at 1920 px.
  - Seen, not changed: a failing detailing card's "Comparison" line prints "provided ≤ required  6.000 ≤ 5.250 in" (the relation as required, not as found) for the default project's torsion stirrup spacing; the card's own result line ("s ≤ s_max: 6.00 in > 5.25 in", FAIL) is right.

#### Code added (re-apply by hand)
CSS, at the end of the `<style>` block:
```css
/* CBDC (2026-11-05): check summary panel, as Spread Footing / Light Pole (SFDC #737, SFDF #740, LPDC #747). One line per check,
   collapsible; on screens >= 1500 px a 280 px left column that scrolls on its own; below that a compact grid above the output
   tabs. Screen only; the Summary tab, the Report and printing are unchanged. */
#cbcDashCol{display:none}
@media print{#cbcDashCol,#cbcDashBox{display:none!important}}
@media screen{
  #cbcDashBox{flex:0 0 auto;font-family:var(--font-ui);padding:5px 14px 0;background:var(--slate-50);border-bottom:1px solid var(--color-border);
    max-height:42vh;overflow-y:auto}
  #cbcDashHead{display:flex;align-items:center;gap:4px 8px;flex-wrap:wrap}
  #cbcDashTtl{margin:2px 0;font-size:9pt;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--navy-800)}
  #cbcDashTgl{margin:0;padding:1px 7px;font:8.5pt var(--font-ui);border:1px solid #CBD5E1;background:var(--slate-100);border-radius:4px;cursor:pointer;color:#334155}
  #cbcDashCnt{display:inline-flex;gap:4px;flex-wrap:wrap}
  #cbcDashCnt span{font-size:8pt;font-weight:700;padding:1px 5px;border:1px solid;border-radius:3px;white-space:nowrap}
  #cbcDashCnt .cbdCf{color:#991B1B;background:#FEF2F2;border-color:var(--fail)}
  #cbcDashCnt .cbdCp{color:#065F46;background:#ECFDF5;border-color:var(--pass)}
  #cbcDashCnt .cbdCn{color:#475569;background:var(--slate-100);border-color:#CBD5E1}
  body.cbcDashColl #cbcDash{display:none}
  #cbcDash{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(250px,100%),1fr));gap:3px 6px;margin:4px 0 7px;align-items:start}
  .cbdCh{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;column-gap:5px;padding:2px 5px 2px 2px;min-width:0;
    border:1px solid var(--color-border);border-left:4px solid var(--slate-400);border-radius:3px;background:#fff;font-size:8.5pt;line-height:1.35;cursor:pointer}
  .cbdCh:hover{background:var(--slate-50)} .cbdCh:focus-visible{outline:2px solid var(--blue-600);outline-offset:-1px}
  .cbdCh.pass{border-left-color:var(--pass)} .cbdCh.fail{border-left-color:var(--fail);background:#FEF2F2}
  .cbdCh .cbdX{grid-row:1;grid-column:1;margin:0;padding:0 3px;border:none;background:transparent;font-size:9px;color:#334155;line-height:1.2;cursor:pointer}
  .cbdCh .cbdN{grid-row:1;grid-column:2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cbdCh .cbdR{grid-row:1;grid-column:3;white-space:nowrap;color:#334155;font-variant-numeric:tabular-nums}
  .cbdCh .cbdS{grid-row:1;grid-column:4;font-size:7.5pt;font-weight:700;white-space:nowrap}
  .cbdCh.pass .cbdS{color:var(--pass)} .cbdCh.fail .cbdS{color:var(--fail)} .cbdCh.na .cbdS{color:#64748b}
  .cbdCh .cbdV,.cbdCh .cbdDC,.cbdCh .cbdRef{grid-column:1/-1;display:none;padding-left:16px;overflow-wrap:anywhere}
  .cbdCh .cbdDC,.cbdCh .cbdRef{color:#475569;font-size:8pt} .cbdCh .cbdRef{font-style:italic}
  .cbdCh.cbdOpen .cbdV,.cbdCh.cbdOpen .cbdDC,.cbdCh.cbdOpen .cbdRef{display:block}
  .cbdCh.cbdOpen .cbdN{white-space:normal}
  .cbdMsg{grid-column:1/-1;font-size:8.5pt;padding:5px 8px;border:1px solid var(--color-border);border-left:4px solid var(--fail);background:#FEF2F2;color:#7F1D1D;border-radius:3px}
}
@media screen and (min-width:1500px){
  body.cbcDashWide #cbcDashCol{display:block;flex:0 0 292px;width:292px;overflow-y:auto;overflow-x:hidden;position:relative;
    padding:0 6px 24px;border-right:1px solid var(--color-border);background:var(--slate-50);overscroll-behavior:contain;font-family:var(--font-ui)}
  body.cbcDashWide #cbcDashBox{padding:0;border-bottom:0;max-height:none;overflow:visible;background:transparent}
  body.cbcDashWide #inputPanel{flex-basis:calc((100% - 292px)*.33);max-width:calc((100% - 292px)*.33)}
  body.cbcDashWide #cbcDash{grid-template-columns:minmax(0,1fr)}
  body.cbcDashWide #cbcDashHead{position:sticky;top:0;z-index:3;background:var(--slate-50);padding:5px 0 4px}
  body.cbcDashWide.cbcDashColl #cbcDashCol{flex-basis:42px;width:42px;padding:0}
  body.cbcDashWide.cbcDashColl #inputPanel{flex-basis:calc((100% - 42px)*.33);max-width:calc((100% - 42px)*.33)}
  body.cbcDashWide.cbcDashColl #cbcDashHead{flex-direction:column;align-items:center}
  body.cbcDashWide.cbcDashColl #cbcDashTtl{writing-mode:vertical-rl;transform:rotate(180deg);margin:4px 0;white-space:nowrap}
  body.cbcDashWide.cbcDashColl #cbcDashCnt{flex-direction:column;align-items:center}
  body.cbcDashWide.cbcDashColl #cbcDashCnt span{font-size:7.5pt;padding:1px 2px;white-space:normal;text-align:center;width:36px}
  body.cbcDashWide #cbcDashCol::-webkit-scrollbar{width:7px}
  body.cbcDashWide #cbcDashCol::-webkit-scrollbar-thumb{background:#c2ccd6;border-radius:4px}
}
```
JS, before `function refresh(){`:
```js
/* CBDC (2026-11-05, engineer): check summary panel, as Spread Footing / Light Pole (SFDC #737, SFDF #740, LPDC #747). One line
   per check of the Summary tab (allChecks(), the same rows, D/C, status and count): expand button, name, a short value, status.
   The short value is the Summary's D/C; for a check whose status is a condition (detailing limits, the torsion cross-section
   limit) that is not satisfied, the condition instead, and the D/C moves to the expanded text. NG lines start expanded. A line
   click opens the card where the check is worked (cbcGoto, the D11 links). No new calculation.
   On screens >= 1500 px the box is moved into the left column #cbcDashCol; below that it sits above the output tabs.
   Collapse state: per-browser UI key cbc_dashCollapsed_v1 ('1' = collapsed, '0' or absent = open); not in S, the autosave,
   the saved projects or the JSON export. */
const CBDC={key:'cbc_dashCollapsed_v1',mq:window.matchMedia?window.matchMedia('screen and (min-width:1500px)'):null,open:new Map(),coll:false};
CBDC.coll=lsGet(CBDC.key)==='1';
const CBDC_ST={pass:'PASS',fail:'FAIL',na:'N/A'};
/* the condition a detailing check (or the torsion cross-section limit) states when it is not satisfied */
const CBDC_COND={dCover:'c_c < c_c,req',dSpace:'s_clear < s_min',dLayer:'layer gap < 1 in',dAsMin:'A_s < A_s,min',
  dEpsMin:'ε_t < ε_ty + 0.003',dStirS:'s > s_max',dAvMin:'A_v/s < (A_v/s)_min',dTorS:'s > s_max (torsion)',
  dTorAl:'A_ℓ < A_ℓ,min',dTorAlReq:'A_ℓ < A_ℓ,req',dTorAts:'A_t/s < 25b_w/f_yt',dTorAlDist:'spacing > 12 in',dCrack:'s > s_max (crack)'};
function cbcDashDC(c){   /* the D/C as the Summary tab prints it (heatTD, CBAZ) */
  if(c.na||c.dcr==null) return '';
  const z=cbcDcZero(c); if(z) return 'D/C '+z;
  return 'D/C '+(isFinite(c.dcr)?fmt(c.dcr):'≫1');
}
function cbcDashItems(){
  if(!CC) return null;
  const env=detEnvelope(), byId={}; env.forEach(E=>{ byId[E.id]=E; });
  return allChecks().map(c=>{
    /* status exactly as the Summary tab's Status column */
    const st=c.na?'na':((c.forceOK!==undefined&&c.forceOK!==null)?(c.forceOK?'pass':'fail'):((!isFinite(c.dcr)||c.dcr>1.0001)?'fail':'pass'));
    const E=c.id?byId[c.id]:null, en=E&&E.entry;
    let cond='';
    if(st==='fail'){
      if(c.id&&CBDC_COND[c.id]) cond=(c.id==='dAvMin'&&c.have0)?'no stirrups':CBDC_COND[c.id];
      else if(c.label==='Torsion cross-sectional limit') cond='section too small';
    }
    let text='';
    if(c.na) text=E?('N/A: '+(E.naWhy||'')):'N/A: no load combination has this action.';
    else if(en&&!en.na&&en.cmp){
      const dec=en.unit==='in²/in'?4:(en.unit===''?5:2), u=en.unit?' '+en.unit:'';
      text=fmt(en.have,dec)+u+(en.cmp==='\\le'?' provided, limit ≤ ':' provided, required ≥ ')+fmt(en.need,dec)+u+'; governing combination: '+c.combo;
    } else text=(cbcDashDC(c)||'D/C —')+'; governing combination: '+c.combo;
    const card=cbcCheckCard(c), tn=cbcTabName(c.tab);
    return {name:c.label,st,dc:cbcDashDC(c),cond,within:c.dcr!=null&&isFinite(c.dcr)&&c.dcr<=1.0001,text,ref:c.ref,tab:c.tab,card:card?card.card:null,
      where:tn?('→ '+tn+(card?' · '+card.name:'')):''};
  });
}
function cbcDashGo(it){
  cbcGoto(it.tab,it.card);
  /* phone / tablet: the output panel does not scroll on its own there, so bring the card into view */
  setTimeout(()=>{ const op=document.getElementById('outputPanel'), e=it.card&&document.querySelector('#tabPages #'+it.card);
    if(e&&op&&op.scrollHeight<=op.clientHeight+1) e.scrollIntoView({behavior:'smooth',block:'start'}); },90);
}
function cbcDashRender(){
  const box=document.getElementById('cbcDash'), cnt=document.getElementById('cbcDashCnt'); if(!box) return;
  box.innerHTML='';
  const blocked=!!(VALIDATION&&VALIDATION.blockers&&VALIDATION.blockers.length);
  let items=null; if(!blocked){ try{ items=cbcDashItems(); }catch(e){ items=null; } }
  if(blocked||!items){
    box.innerHTML='<div class="cbdMsg">'+(blocked?'Input invalid: output withheld. See the message in the output panel.':'No results yet.')+'</div>';
    if(cnt) cnt.innerHTML=blocked?'<span class="cbdCf">input invalid</span>':'';
    return;
  }
  let nF=0;
  items.forEach(it=>{
    if(it.st==='fail') nF++;
    const short=it.cond||it.dc, dcLine=it.cond&&it.dc?it.dc:'';
    const c=el('div','cbdCh '+it.st); c.tabIndex=0; c.setAttribute('role','button');
    const x=el('button','cbdX'); x.type='button'; x.title='Show the result and the reference'; c.appendChild(x);
    c.appendChild(el('span','cbdN',it.name)); c.appendChild(el('span','cbdR',short)); c.appendChild(el('span','cbdS',CBDC_ST[it.st]));
    c.appendChild(el('div','cbdV',it.text));
    if(dcLine) c.appendChild(el('div','cbdDC',dcLine+(it.within?' (the ratio is within its limit; the status comes from the condition)':'')));
    c.appendChild(el('div','cbdRef',(it.ref||'')+(it.ref&&it.where?' · ':'')+it.where));
    c.title=it.name+': '+it.text+(dcLine?'\n'+dcLine:'')+(it.ref?'\nReference: '+it.ref:'')+(it.where?'\nClick: '+it.where:'');
    const setOpen=o=>{ c.classList.toggle('cbdOpen',o); x.setAttribute('aria-expanded',o?'true':'false'); x.textContent=o?'▾':'▸'; };
    setOpen(CBDC.open.has(it.name)?CBDC.open.get(it.name):it.st==='fail');
    x.addEventListener('click',ev=>{ ev.preventDefault(); ev.stopPropagation(); const o=!c.classList.contains('cbdOpen'); CBDC.open.set(it.name,o); setOpen(o); });
    c.addEventListener('click',()=>cbcDashGo(it));
    c.addEventListener('keydown',ev=>{ if((ev.key==='Enter'||ev.key===' ')&&ev.target===c){ ev.preventDefault(); cbcDashGo(it); } });
    box.appendChild(c);
  });
  if(cnt) cnt.innerHTML=nF?'<span class="cbdCf">'+nF+' NG</span>':(items.length?'<span class="cbdCp">no NG</span>':'<span class="cbdCn">no checks</span>');
}
function cbcDashPlace(){
  const box=document.getElementById('cbcDashBox'), col=document.getElementById('cbcDashCol'), ow=document.getElementById('outputWrap'), bar=document.getElementById('tabBar');
  if(!box||!col||!ow) return;
  const wide=!!(CBDC.mq&&CBDC.mq.matches);
  document.body.classList.toggle('cbcDashWide',wide);
  if(wide){ if(box.parentNode!==col) col.appendChild(box); }
  else if(box.parentNode!==ow) ow.insertBefore(box,bar||ow.firstChild);
  cbcDashColl(CBDC.coll,false);
}
function cbcDashColl(v,save){
  CBDC.coll=!!v; document.body.classList.toggle('cbcDashColl',CBDC.coll);
  const t=document.getElementById('cbcDashTgl'), wide=document.body.classList.contains('cbcDashWide');
  if(t){ t.setAttribute('aria-expanded',CBDC.coll?'false':'true');
    t.innerHTML=wide?(CBDC.coll?'&raquo;':'&laquo;'):(CBDC.coll?'&#9656; Show checks':'&#9662; Hide checks');
    t.title=(CBDC.coll?'Show':'Hide')+' the check list (remembered in this browser)'; }
  if(save) lsSet(CBDC.key,CBDC.coll?'1':'0');
}
(function(){
  const t=document.getElementById('cbcDashTgl'); if(t) t.addEventListener('click',()=>cbcDashColl(!CBDC.coll,true));
  if(CBDC.mq){ if(CBDC.mq.addEventListener) CBDC.mq.addEventListener('change',cbcDashPlace); else if(CBDC.mq.addListener) CBDC.mq.addListener(cbcDashPlace); }
  cbcDashPlace();
})();
```

## 2026-11-05 — PR: claude/cbc-dash-asd, PR #789: https://github.com/mlococo88/All-Structural/pull/789 (ASDC: check summary panel in the ASD Beam Calcs tab, as the Beam Capacity tab (CBDC #788); display only, no result change)

### ASDC. Check summary panel in the ASD frame   [display only] [no result change]
- **Engineer request (2026-11-05, Phase 2, PR 2 of 3):** the check summary panel of CBDC (#788) in the ASD Beam Calcs frame (`<iframe id="suite-frame-asd" srcdoc=…>`). The Summary tab, the Report and printing are unchanged.
- **Where (inside the ASD srcdoc page):**
  - Markup: as CBDC with the prefix `asd`: `<aside id="asdDashCol" aria-label="Check summary"></aside>` before `<div id="inputPanel"></div>`; `<div id="asdDashBox">` (header `#asdDashHead`: `#asdDashTgl`, `<h2 id="asdDashTtl">Check summary</h2>`, `#asdDashCnt`; list `#asdDash`) before `<div id="tabBar"></div>`.
  - `refresh()`: after `buildTabs();` added `asdDashRender();   /* ASDC: … */`.
  - CSS: at the end of the first `<style>` block, after the CBTH phone rule (anchor `/* ASDC (2026-11-05): check summary panel`). It is the CBDC CSS with `cbcDash` → `asdDash` and `cbd` → `asdd`, plus REVIEW styles (`.asddCh.warn`, `.asddCh.warn .asddS`, `#asdDashCnt .asddCw`).
  - JS: new block just before `function refresh(){` (anchor `const ASDC={key:'asd_dashCollapsed_v1'`), code below.
- **What the lines are (no new calculation):**
  - One line per rating level that the Summary tab shows (Inventory / Operating, `S.mode`). The short value is "RF x.xx" (`CC.rf_inv`, `CC.rf_op`). Status PASS when RF ≥ 1.00, FAIL below, N/A when RF is not a number (ratePill).
  - The expanded text gives M_all, the control, RF and the reference "AASHTO MBE 6B (ASD); Std. Spec. 8.15". A click opens Analysis · Load Rating (`asdGoto`).
  - One REVIEW line per Summary-tab notice, using the same test:
    - b_eff over the Std. Spec. 8.10.1.1 limit (`CC.beffEntered!==null`; short "b_eff > b_w + 12h_f");
    - a steel allowable with no grade rule (`autoAllow(...)[k]===null`, not overridden; "no rule for f_y");
    - operating f_c > 0.60f′c ("f_c,op > 0.60f′c", MBE 6B.6.2.3).
    A click opens the Summary tab, where the notice is.
  - FAIL and REVIEW lines start expanded. The header shows "n NG", "n REVIEW" or "no NG". With `CC.errors` the panel reads "Input error: no results …" and the count "input error".
- **Layout, collapse:** as CBDC. The left column is used at ≥ 1500 px; below that the box sits above the output tabs. The collapse state is kept in the new per-browser key **`asd_dashCollapsed_v1`** ('1' = collapsed). It is not in `S`, the autosave, the projects or the export. No existing key or format changed.
- **Check case:** default suite project, so the ASD tab inherits from Beam Capacity: Positive, M_DL / M_LL+I as default. The Summary reads "2 levels below 1.0" and the panel "2 NG": "Inventory rating RF −0.56 FAIL" (M_all = 25.92 k-ft, steel controlled) and "Operating rating RF −0.53 FAIL" (38.88 k-ft). With operating f_c = 2,600 psi and f_y = 55,000 psi the panel reads "2 NG 3 REVIEW": f_s,inv no rule, f_s,op no rule, f_c,op 2,600 > 0.60f′c = 2400.0. These match the Summary tab's three notices.
- **How verified:**
  - Headless comparison, origin/main vs branch, with the panels hidden while the tab text is read. Compared: computed results, `asdRptModel()`, the text of every tab of the three frames, the standalone ACI Rebar tool and the Report tab. Result: identical in 5 cases, with 0 console errors.
  - `node tests/check-syntax.mjs`, `tests/smoke/phone-layout.mjs --tool cbc,aci` and `tests/smoke/project-library.mjs` pass.
  - Screenshots before and after at 1920 and 390 px, plus 1366 px with the REVIEW lines, looked at. There is no sideways scroll.
- **Other copies:** none.
- **Open items:** none.

#### Code added (re-apply by hand)
CSS:
```css
/* ASDC (2026-11-05): check summary panel, as the Beam Capacity tab (CBDC #788) and Spread Footing / Light Pole. One line per check,
   collapsible; on screens >= 1500 px a 280 px left column that scrolls on its own; below that a compact grid above the output
   tabs. Screen only; the Summary tab, the Report and printing are unchanged. */
#asdDashCol{display:none}
@media print{#asdDashCol,#asdDashBox{display:none!important}}
@media screen{
  #asdDashBox{flex:0 0 auto;font-family:var(--font-ui);padding:5px 14px 0;background:var(--slate-50);border-bottom:1px solid var(--color-border);
    max-height:42vh;overflow-y:auto}
  #asdDashHead{display:flex;align-items:center;gap:4px 8px;flex-wrap:wrap}
  #asdDashTtl{margin:2px 0;font-size:9pt;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--navy-800)}
  #asdDashTgl{margin:0;padding:1px 7px;font:8.5pt var(--font-ui);border:1px solid #CBD5E1;background:var(--slate-100);border-radius:4px;cursor:pointer;color:#334155}
  #asdDashCnt{display:inline-flex;gap:4px;flex-wrap:wrap}
  #asdDashCnt span{font-size:8pt;font-weight:700;padding:1px 5px;border:1px solid;border-radius:3px;white-space:nowrap}
  #asdDashCnt .asddCf{color:#991B1B;background:#FEF2F2;border-color:var(--fail)}
  #asdDashCnt .asddCw{color:#92400E;background:#FFFBEB;border-color:var(--warn)}
  #asdDashCnt .asddCp{color:#065F46;background:#ECFDF5;border-color:var(--pass)}
  #asdDashCnt .asddCn{color:#475569;background:var(--slate-100);border-color:#CBD5E1}
  body.asdDashColl #asdDash{display:none}
  #asdDash{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(250px,100%),1fr));gap:3px 6px;margin:4px 0 7px;align-items:start}
  .asddCh{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;column-gap:5px;padding:2px 5px 2px 2px;min-width:0;
    border:1px solid var(--color-border);border-left:4px solid var(--slate-400);border-radius:3px;background:#fff;font-size:8.5pt;line-height:1.35;cursor:pointer}
  .asddCh:hover{background:var(--slate-50)} .asddCh:focus-visible{outline:2px solid var(--blue-600);outline-offset:-1px}
  .asddCh.pass{border-left-color:var(--pass)} .asddCh.fail{border-left-color:var(--fail);background:#FEF2F2} .asddCh.warn{border-left-color:var(--warn);background:#FFFBEB}
  .asddCh .asddX{grid-row:1;grid-column:1;margin:0;padding:0 3px;border:none;background:transparent;font-size:9px;color:#334155;line-height:1.2;cursor:pointer}
  .asddCh .asddN{grid-row:1;grid-column:2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .asddCh .asddR{grid-row:1;grid-column:3;white-space:nowrap;color:#334155;font-variant-numeric:tabular-nums}
  .asddCh .asddS{grid-row:1;grid-column:4;font-size:7.5pt;font-weight:700;white-space:nowrap}
  .asddCh.pass .asddS{color:var(--pass)} .asddCh.fail .asddS{color:var(--fail)} .asddCh.warn .asddS{color:var(--warn)} .asddCh.na .asddS{color:#64748b}
  .asddCh .asddV,.asddCh .asddDC,.asddCh .asddRef{grid-column:1/-1;display:none;padding-left:16px;overflow-wrap:anywhere}
  .asddCh .asddDC,.asddCh .asddRef{color:#475569;font-size:8pt} .asddCh .asddRef{font-style:italic}
  .asddCh.asddOpen .asddV,.asddCh.asddOpen .asddDC,.asddCh.asddOpen .asddRef{display:block}
  .asddCh.asddOpen .asddN{white-space:normal}
  .asddMsg{grid-column:1/-1;font-size:8.5pt;padding:5px 8px;border:1px solid var(--color-border);border-left:4px solid var(--fail);background:#FEF2F2;color:#7F1D1D;border-radius:3px}
}
@media screen and (min-width:1500px){
  body.asdDashWide #asdDashCol{display:block;flex:0 0 292px;width:292px;overflow-y:auto;overflow-x:hidden;position:relative;
    padding:0 6px 24px;border-right:1px solid var(--color-border);background:var(--slate-50);overscroll-behavior:contain;font-family:var(--font-ui)}
  body.asdDashWide #asdDashBox{padding:0;border-bottom:0;max-height:none;overflow:visible;background:transparent}
  body.asdDashWide #inputPanel{flex-basis:calc((100% - 292px)*.33);max-width:calc((100% - 292px)*.33)}
  body.asdDashWide #asdDash{grid-template-columns:minmax(0,1fr)}
  body.asdDashWide #asdDashHead{position:sticky;top:0;z-index:3;background:var(--slate-50);padding:5px 0 4px}
  body.asdDashWide.asdDashColl #asdDashCol{flex-basis:42px;width:42px;padding:0}
  body.asdDashWide.asdDashColl #inputPanel{flex-basis:calc((100% - 42px)*.33);max-width:calc((100% - 42px)*.33)}
  body.asdDashWide.asdDashColl #asdDashHead{flex-direction:column;align-items:center}
  body.asdDashWide.asdDashColl #asdDashTtl{writing-mode:vertical-rl;transform:rotate(180deg);margin:4px 0;white-space:nowrap}
  body.asdDashWide.asdDashColl #asdDashCnt{flex-direction:column;align-items:center}
  body.asdDashWide.asdDashColl #asdDashCnt span{font-size:7.5pt;padding:1px 2px;white-space:normal;text-align:center;width:36px}
  body.asdDashWide #asdDashCol::-webkit-scrollbar{width:7px}
  body.asdDashWide #asdDashCol::-webkit-scrollbar-thumb{background:#c2ccd6;border-radius:4px}
}
```
JS, before `function refresh(){`:
```js
/* ASDC (2026-11-05, engineer): check summary panel, as the Beam Capacity tab (CBDC #788) and Spread Footing / Light Pole
   (SFDC #737, SFDF #740, LPDC #747). One line per rating level of the Summary tab's "Load Rating Summary" (RF, PASS when
   RF >= 1.00 as ratePill; N/A when RF is not a number) and one REVIEW line per Summary notice (b_eff over the 8.10.1.1 limit;
   a steel allowable with no grade rule; operating f_c above 0.60f'c), from the same tests the Summary tab makes: no new
   calculation. The short value is the RF, or the condition for a REVIEW line. A line click opens the card where it is worked
   (asdGoto, the D11 links) or the Summary tab for a notice.
   On screens >= 1500 px the box is moved into the left column #asdDashCol; below that it sits above the output tabs.
   Collapse state: per-browser UI key asd_dashCollapsed_v1 ('1' = collapsed, '0' or absent = open); not in S, the autosave,
   the saved projects or the JSON export. */
const ASDC={key:'asd_dashCollapsed_v1',mq:window.matchMedia?window.matchMedia('screen and (min-width:1500px)'):null,open:new Map(),coll:false};
ASDC.coll=lsGet(ASDC.key)==='1';
const ASDC_ST={pass:'PASS',fail:'FAIL',warn:'REVIEW',na:'N/A'};
function asdDashItems(){
  const R=CC; if(!R||R.errors) return null;
  const out=[];
  const lvl=(name,M,ctrl,rf,mp,ma)=>{
    const na=(rf==null||!isFinite(rf));
    out.push({name:name+' rating',st:na?'na':(rf>=1.0?'pass':'fail'),short:na?'':'RF '+fmt(rf),
      text:'M_all = '+fmt(M)+' k-ft ('+String(ctrl).toLowerCase()+' controlled); RF = (M_all − M_DL)/M_LL+I = '+(na?'n/a (M_LL+I = 0)':fmt(rf)),
      ref:'AASHTO MBE 6B (ASD); Std. Spec. 8.15',tab:'tabAnalysis',card:'anRF'});
  };
  if(S.mode.inv) lvl('Inventory',R.M_inv,R.ctrl_inv,R.rf_inv);
  if(S.mode.op) lvl('Operating',R.M_op,R.ctrl_op,R.rf_op);
  /* the Summary tab's notices (buildSummaryTab), same tests */
  if(R.beffEntered!==null) out.push({name:'Effective flange width',st:'warn',short:'b_eff > b_w + 12h_f',
    text:'Entered b_eff = '+fmt(R.beffEntered)+' in > b_w + 12h_f = '+fmt(R.beffLim)+' in; '+(R.beffCapped?'b_eff = '+fmt(R.beffLim)+' in is used.':'the limit is switched off: the entered width is used.'),
    ref:'AASHTO Std. Spec. 8.10.1.1',tab:'tabSummary',card:null});
  const aa=autoAllow(+S.inherit.fc||0,+S.inherit.fy||0);
  [['fs_inv','f_s,inv'],['fs_op','f_s,op']].forEach(([k,lb])=>{
    if(!(S.allow.ovr&&S.allow.ovr[k])&&aa[k]===null) out.push({name:'Allowable '+lb,st:'warn',short:'no rule for f_y',
      text:'f_y = '+grp(R.fy)+' psi has no automatic rule for '+lb+': the value used ('+grp(R.A[k])+' psi) is the field’s current entry; check it against Table 6B.6.2.3-1.',
      ref:'AASHTO MBE Table 6B.6.2.3-1',tab:'tabSummary',card:null});
  });
  if(R.A.fc_op>0.60*R.fc+1e-9) out.push({name:'Operating f_c',st:'warn',short:'f_c,op > 0.60f′c',
    text:'Operating f_c = '+grp(R.A.fc_op)+' psi > 0.60f′c = '+fmt(0.60*R.fc,1)+' psi; confirm the owner’s basis for this value.',
    ref:'AASHTO MBE 6B.6.2.3',tab:'tabSummary',card:null});
  out.forEach(it=>{ const tn=asdTabName(it.tab); it.where=tn?'→ '+tn+(it.card?' · '+ASD_CARDS[it.card]:''):''; });
  return out;
}
function asdDashGo(it){
  asdGoto(it.tab,it.card);
  /* phone / tablet: the output panel does not scroll on its own there, so bring the card into view */
  setTimeout(()=>{ const op=document.getElementById('outputPanel'), e=it.card?document.querySelector('#tabPages #'+it.card):document.getElementById('tabBar');
    if(e&&op&&op.scrollHeight<=op.clientHeight+1) e.scrollIntoView({behavior:'smooth',block:'start'}); },90);
}
function asdDashRender(){
  const box=document.getElementById('asdDash'), cnt=document.getElementById('asdDashCnt'); if(!box) return;
  box.innerHTML='';
  let items=null; try{ items=asdDashItems(); }catch(e){ items=null; }
  if(!items){
    const er=!!(CC&&CC.errors);
    box.innerHTML='<div class="asddMsg">'+(er?'Input error: no results. Correct the value in the Beam Capacity tab.':'No results yet.')+'</div>';
    if(cnt) cnt.innerHTML=er?'<span class="asddCf">input error</span>':'';
    return;
  }
  const n={fail:0,warn:0};
  items.forEach(it=>{
    if(n[it.st]!=null) n[it.st]++;
    const c=el('div','asddCh '+it.st); c.tabIndex=0; c.setAttribute('role','button');
    const x=el('button','asddX'); x.type='button'; x.title='Show the result and the reference'; c.appendChild(x);
    c.appendChild(el('span','asddN',it.name)); c.appendChild(el('span','asddR',it.short)); c.appendChild(el('span','asddS',ASDC_ST[it.st]));
    c.appendChild(el('div','asddV',it.text));
    c.appendChild(el('div','asddRef',(it.ref||'')+(it.ref&&it.where?' · ':'')+it.where));
    c.title=it.name+': '+it.text+(it.ref?'\nReference: '+it.ref:'')+(it.where?'\nClick: '+it.where:'');
    const setOpen=o=>{ c.classList.toggle('asddOpen',o); x.setAttribute('aria-expanded',o?'true':'false'); x.textContent=o?'▾':'▸'; };
    setOpen(ASDC.open.has(it.name)?ASDC.open.get(it.name):(it.st==='fail'||it.st==='warn'));
    x.addEventListener('click',ev=>{ ev.preventDefault(); ev.stopPropagation(); const o=!c.classList.contains('asddOpen'); ASDC.open.set(it.name,o); setOpen(o); });
    c.addEventListener('click',()=>asdDashGo(it));
    c.addEventListener('keydown',ev=>{ if((ev.key==='Enter'||ev.key===' ')&&ev.target===c){ ev.preventDefault(); asdDashGo(it); } });
    box.appendChild(c);
  });
  if(!items.length) box.innerHTML='<div class="asddMsg">No rating level selected.</div>';
  if(cnt) cnt.innerHTML=(n.fail?'<span class="asddCf">'+n.fail+' NG</span>':'')+(n.warn?'<span class="asddCw">'+n.warn+' REVIEW</span>':'')
    +(items.length&&!n.fail&&!n.warn?'<span class="asddCp">no NG</span>':'');
}
function asdDashPlace(){
  const box=document.getElementById('asdDashBox'), col=document.getElementById('asdDashCol'), ow=document.getElementById('outputWrap'), bar=document.getElementById('tabBar');
  if(!box||!col||!ow) return;
  const wide=!!(ASDC.mq&&ASDC.mq.matches);
  document.body.classList.toggle('asdDashWide',wide);
  if(wide){ if(box.parentNode!==col) col.appendChild(box); }
  else if(box.parentNode!==ow) ow.insertBefore(box,bar||ow.firstChild);
  asdDashColl(ASDC.coll,false);
}
function asdDashColl(v,save){
  ASDC.coll=!!v; document.body.classList.toggle('asdDashColl',ASDC.coll);
  const t=document.getElementById('asdDashTgl'), wide=document.body.classList.contains('asdDashWide');
  if(t){ t.setAttribute('aria-expanded',ASDC.coll?'false':'true');
    t.innerHTML=wide?(ASDC.coll?'&raquo;':'&laquo;'):(ASDC.coll?'&#9656; Show checks':'&#9662; Hide checks');
    t.title=(ASDC.coll?'Show':'Hide')+' the check list (remembered in this browser)'; }
  if(save) lsSet(ASDC.key,ASDC.coll?'1':'0');
}
(function(){
  const t=document.getElementById('asdDashTgl'); if(t) t.addEventListener('click',()=>asdDashColl(!ASDC.coll,true));
  if(ASDC.mq){ if(ASDC.mq.addEventListener) ASDC.mq.addEventListener('change',asdDashPlace); else if(ASDC.mq.addListener) ASDC.mq.addListener(asdDashPlace); }
  asdDashPlace();
})();
```

## 2026-11-05 — PR: claude/cbc-asreq-from-beam, PR #790: https://github.com/mlococo88/All-Structural/pull/790 (CBAR-1: "From Beam Capacity" button for A_s,req / A_s,prov in the Development & Splice excess-reinforcement inputs; display / workflow only, no result change)

### CBAR-1. Development & Splice: A_s,req and A_s,prov filled from Beam Capacity   [workflow] [no result change]
- **Engineer request (2026-11-05, approved):** a "From Beam Capacity" button in the Development & Splice frame's excess-reinforcement inputs (panel D2) that fills A_s,req = max(flexural A_s required, A_s,min of ACI 318-19 9.6.1 or the AASHTO equivalent), A_s,prov = the provided tension steel and the bar size, from the Beam Capacity frame's current results; the values stay editable; a note says where they came from (values, flexure or minimum governing) and links to the worked steps (CLAUDE.md §6). The PR #786 note stays.
- **Mechanism (reused, no new storage key):** the suite's existing Beam Capacity → shell → ASD message (`type:'sharedInputs'`, `source:'beamCapacity'`, emitted after every Beam Capacity `refresh()` and on `requestShared`) carries a new field `data.asReq`; the shell now also forwards it to the Development & Splice frame and accepts `requestShared` from that frame. The ASD tab copies only the fields it knows (`map` in its listener), so it ignores `asReq`. A new message `type:'cbcGoto'` (Development & Splice → shell → Beam Capacity) opens a Beam Capacity card for the note's "Worked in" links. Both stay inside this file, so HANDOFF.md (cross-tool data) is not changed.
- **Values (no new provision; computed from results Beam Capacity already has, `asReqOut` in its suite-bridge script):** the flexure-governing combination (`govFlexIndex`) and its sense of bending; A_s,prov = `F.As` (its tension steel); A_s,flex = A_s,prov · |M_u| / φM_n (= A_s,prov × the flexure DCR shown on the Flexure tab: steel in proportion to the moment; φM_n grows less than in proportion to A_s at constant d, so for a section whose φ does not drop as A_s falls this is slightly more than the exact A_s needed, i.e. a larger ratio and less reduction); A_s,min = ACI: the 9.6.1.2 value of the Detailing check `dAsMin` of that combination; AASHTO: A_s,prov · min(M_cr, 1.33 M_u) / φM_n with M_cr = γ_3(γ_1 f_r)S_c, γ_1 = 1.6, as the Serviceability tab's 5.6.3.3 check (AASHTO LRFD 10th Ed.); A_s,req = max(A_s,flex, A_s,min). Filled values: A_s,req rounded up and A_s,prov rounded down to 0.01 in²; the bar size when all tension bars of that sense are one size. "Apply excess-reinforcement reduction" is not ticked by the button. With blockers, no combinations, no tension steel or φM_n = 0 nothing is changed and the note says why.
- **Shell, `Concrete Beam Capacity.html` (outside the srcdoc pages), message listener, before:**
```js
    if(d.type==='requestShared' && e.source!==src('suite-frame-asd')) return;
    if(d.type==='sharedInputs'){
      lastShared=d;
      var w=cw(asdF); if(w) w.postMessage(d,'*');
    } else if(d.type==='requestShared'){
      if(lastShared){ var w=cw(asdF); if(w) w.postMessage(lastShared,'*'); }
      var c=cw(capF); if(c) c.postMessage({type:'requestShared'},'*');
    }
```
  **after:**
```js
    if(d.type==='requestShared' && e.source!==src('suite-frame-asd') && e.source!==src('suite-frame-dev')) return;
    if(d.type==='cbcGoto' && e.source!==src('suite-frame-dev')) return;
    if(d.type==='sharedInputs'){
      lastShared=d;
      var w=cw(asdF); if(w) w.postMessage(d,'*');
      var v=cw(devF); if(v) v.postMessage(d,'*');
    } else if(d.type==='requestShared'){
      if(lastShared && e.source){ try{ e.source.postMessage(lastShared,'*'); }catch(err){} }
      var c=cw(capF); if(c) c.postMessage({type:'requestShared'},'*');
    } else if(d.type==='cbcGoto'){
      show('capacity');
      var c2=cw(capF); if(c2) c2.postMessage({type:'cbcGoto',tab:String(d.tab||''),card:String(d.card||'')},'*');
    }
```
  (a `requestShared` from the ASD frame is answered to the ASD frame as before.)
- **Beam Capacity frame (`suite-frame-capacity` srcdoc), "Suite bridge" script:** in `derive()` after `shape:   typ,` added `asReq:   asReqOut(cc),`; before `function emit(){` added:
```js
  /* CBAR-1 (2026-11-05): A_s,req and A_s,prov for the excess-reinforcement inputs of the Development & Splice tab, from the
     current results (no new provision, nothing here changes a Beam Capacity result). Flexure-governing combination
     (govFlexIndex) and its sense of bending:
       A_s,prov = F.As (tension steel of that sense);
       A_s,flex = A_s,prov x |M_u| / phi M_n (= A_s,prov x the flexure DCR; proportional to the moment, an upper bound for a
                  section whose phi does not drop as A_s falls, since phi M_n grows less than in proportion to A_s);
       A_s,min  = ACI: the 9.6.1.2 value of the Detailing check dAsMin of that combination;
                  AASHTO: A_s,prov x min(M_cr, 1.33 M_u) / phi M_n (5.6.3.3, M_cr with gamma_1 = 1.6 and gamma_3, as the
                  Serviceability tab), i.e. the steel giving M_r = min(M_cr, 1.33 M_u) on the same proportional basis;
       A_s,req  = max(A_s,flex, A_s,min). */
  function asReqOut(cc){
    try{
      var B=(typeof VALIDATION!=='undefined'&&VALIDATION&&VALIDATION.blockers)||[];
      if(B.length) return {ok:false, why:'Beam Capacity has '+B.length+' blocker'+(B.length>1?'s':'')+' ('+B.map(function(x){return x.code;}).join(', ')+') and no results.'};
      if(!cc||!cc.combos||!cc.combos.length) return {ok:false, why:'Beam Capacity has no load combinations.'};
      var r=cc.combos[cc.govFlexIndex]; if(!r) return {ok:false, why:'Beam Capacity has no flexure results.'};
      var F=r.F;
      if(!(F.As>0)||!(r.phiMn>0)||!isFinite(r.phiMn)) return {ok:false, why:'Beam Capacity has no tension steel or no flexural capacity (\u03c6M_n) in the governing sense.'};
      var Mu=Math.abs(r.Mu), asFlex=F.As*Mu/r.phiMn, mn;
      if(S.code==='ACI'){
        var e=(r.det||[]).find(function(x){return x.id==='dAsMin';});
        mn={code:'ACI', ref:'ACI 318-19 9.6.1.2', as:e?e.need:0};
      } else {
        var g3=S.mat.gamma3||0.67, McrF=g3*1.6*r.svc.Mcr, need=Math.min(McrF, Mu>0?1.33*Mu:Infinity);
        mn={code:'AASHTO', ref:'AASHTO LRFD 10th Ed. 5.6.3.3', McrF:McrF, Mu133:1.33*Mu, need:need, as:F.As*need/r.phiMn};
      }
      var asReq=Math.max(asFlex, mn.as), T=(F.T||[]);
      var sizes=T.map(function(L){return String(L.size);}).filter(function(v,i,a){return a.indexOf(v)===i;});
      var fc=(typeof cbcComboCard==='function')?cbcComboCard('flexC',r.ci):null;
      return {ok:true, code:S.code, ci:r.ci, combo:r.name, sense:r.neg?'neg':'pos', Mu:Mu, phiMn:r.phiMn, dcM:r.dcM,
              asProv:F.As, asFlex:asFlex, asMin:mn.as, min:mn, asReq:asReq, gov:(asFlex>=mn.as?'flexure':'minimum'),
              bars:T.map(function(L){return L.n+' #'+L.size;}).join(' + '), bar:sizes.length===1?sizes[0]:null,
              fc:S.mat.fc, fy:S.mat.fy,
              links:{flex:fc?{tab:'tabFlex', card:fc.card, name:fc.name}:null,
                     min:S.code==='ACI'?{tab:'tabDetail', card:'detdAsMin', name:'Minimum flexural reinforcement'}
                                       :{tab:'tabServ', card:'svcMain', name:'Cracking Moment and Minimum Reinforcement'}}};
    }catch(err){ return {ok:false, why:'Beam Capacity results are not available.'}; }
  }
```
  and in its message listener, after `if(e.data && e.data.type==='requestShared') emit();`:
```js
    if(e.data && e.data.type==='cbcGoto' && typeof cbcGoto==='function') cbcGoto(String(e.data.tab||''), String(e.data.card||''));
```
### Development & Splice frame / standalone (identical in both copies)
- **Where:** panel D2 "Excess Reinforcement" (`buildInputPanel`, anchor `<input id="asProv"`), the new block before `function init(){` (anchor `CBAR-1 (2026-11-05): "From Beam Capacity"`), `init()` (anchor `rbPlibInit();`), and `rbrModel()`'s excess-reinforcement steps (anchor `id:'asReq',label:'Area of steel required by analysis (input)'`) with the helper after `const rbS=o=>SharedSteps.step(o);`.
- **Before (D2, after the A_s provided field):**
```html
      <div class="field"><label>A<sub>s</sub> provided <span class="unit">(in²)</span></label><input id="asProv" type="number" value="1.00" step="0.01" min="0"></div>
    </div>
```
- **After:** the same, followed by
```html
    <div class="btnrow" id="asFromCapRow" style="display:none;margin-top:6px;"><button type="button" class="btn small" id="asFromCap" title="Fill A_s,req, A_s,prov and the bar size from the Beam Capacity tab's current results (you can still edit them)">From Beam Capacity</button></div>
    <div class="hint" id="asFromCapNote" style="display:none;margin-top:6px"></div>
```
  The two existing hints (the 25.4.10.2 list and the PR #786 "A_s,req for a beam" note) follow unchanged.
- **New block (before `function init(){`):**
```js
/* ---- CBAR-1 (2026-11-05): "From Beam Capacity" for the excess-reinforcement inputs (display / workflow only; no result change).
   In the Concrete Beam suite the shell relays Beam Capacity's shared inputs (type 'sharedInputs', source 'beamCapacity', the
   same message the ASD tab uses) to this frame; data.asReq holds A_s,req = max(A_s,flex, A_s,min), A_s,prov and the governing
   one, worked there. The button appears only after such a message arrives from the parent page, so it never shows in the
   standalone ACI Rebar Development Length.html (no Beam Capacity there). Clicking fills A_s,req (rounded up to 0.01 in²),
   A_s,prov (rounded down to 0.01 in²) and the bar size (when all tension bars are one size); the values stay editable. The
   note under the button says where they came from and links to the Beam Capacity cards where they are worked. Nothing is
   stored: the note is for this session, and the filled values are saved as ordinary inputs. ---- */
const RBCAP={last:null, fill:null, msg:''};
function rbCapUp2(x){ return Math.ceil(x*100-1e-6)/100; }
function rbCapDn2(x){ return Math.floor(x*100+1e-6)/100; }
function rbCapLink(l,txt){
  if(!l) return '';
  const tn={tabFlex:'Flexure',tabDetail:'Detailing',tabServ:'Serviceability'}[l.tab]||l.tab;
  return `<a class="wkA rbCapA" href="#" data-cbtab="${escHTML(l.tab)}" data-cbcard="${escHTML(l.card)}" title="Opens the Beam Capacity tab at this card">${escHTML(txt)} → Beam Capacity · ${escHTML(tn)} · ${escHTML(l.name)}</a>`;
}
function rbCapNote(){
  const n=document.getElementById('asFromCapNote'); if(!n) return;
  const F=RBCAP.fill;
  if(!F){ n.style.display=RBCAP.msg?'':'none'; n.innerHTML=RBCAP.msg; return; }
  const d=F.d, aci=d.code==='ACI', sub=s=>s.replace(/A_s,(\w+)/g,'A<sub>s,$1</sub>').replace(/M_(u|n|cr)\b/g,'M<sub>$1</sub>');
  const sense=d.sense==='neg'?'negative moment, top bars':'positive moment, bottom bars';
  const minTxt=aci
    ? `A_s,min = ${fmt(d.asMin,3)} in² (${d.min.ref})`
    : `A_s,min = A_s,prov·min(M_cr, 1.33M_u)/φM_n = ${fmt(d.asProv,2)} × min(${fmt(d.min.McrF,1)}, ${d.Mu>0?fmt(d.min.Mu133,1):'n/a'})/${fmt(d.phiMn,1)} = ${fmt(d.asMin,3)} in² (${d.min.ref})`;
  const g=document.getElementById('asReq'), p=document.getElementById('asProv');
  const edited=!g||!p||Math.abs(parseFloat(g.value)-F.asReq)>1e-9||Math.abs(parseFloat(p.value)-F.asProv)>1e-9;
  const L=RBCAP.last, stale=L&&L.ok&&(rbCapUp2(L.asReq)!==F.asReq||rbCapDn2(L.asProv)!==F.asProv);
  n.style.display='';
  n.innerHTML=sub(`<b>From Beam Capacity</b> (${escHTML(d.code==='ACI'?'ACI 318-19':'AASHTO LRFD')}, flexure-governing combination ${d.ci+1} "${escHTML(d.combo)}", ${sense}${d.bars?' '+escHTML(d.bars):''}): `
    +`A_s,req = max(A_s,flex, A_s,min) = max(${fmt(d.asFlex,3)}, ${fmt(d.asMin,3)}) = ${fmt(d.asReq,3)} in², <b>${d.gov==='flexure'?'flexure governs':'the minimum governs'}</b>; `
    +`A_s,flex = A_s,prov·|M_u|/φM_n = ${fmt(d.asProv,2)} × ${fmt(d.Mu,1)}/${fmt(d.phiMn,1)} = ${fmt(d.asFlex,3)} in² (in proportion to the moment; slightly more than the exact value); ${minTxt}; `
    +`A_s,prov = ${fmt(d.asProv,2)} in². Filled: A_s,req = ${fmt(F.asReq,2)} (rounded up), A_s,prov = ${fmt(F.asProv,2)} in² (rounded down), ratio ${fmt(F.asReq/F.asProv,3)}`
    +(F.barTxt?`; ${escHTML(F.barTxt)}`:'')+'.'
    +(F.matTxt?` <b>Check:</b> ${escHTML(F.matTxt)}`:'')
    +(document.getElementById('useExcess')&&!document.getElementById('useExcess').checked?' The reduction applies only when "Apply excess-reinforcement reduction" is ticked.':'')
    +(edited?' <b>Edited since:</b> the A_s values above are now your own.':'')
    +(stale?' <b>Beam Capacity has changed since:</b> click the button again to refresh.':'')
    +`<div class="wkLink">Worked in: ${rbCapLink(d.links&&d.links.flex,'φM_n, |M_u|')}; ${rbCapLink(d.links&&d.links.min,'A_s,min')}</div>`);
}
function rbCapFill(){
  RBCAP.msg='';
  const d=RBCAP.last;
  try{ if(window.parent!==window) window.parent.postMessage({type:'requestShared'},'*'); }catch(e){}
  if(!d){ RBCAP.fill=null; RBCAP.msg='Beam Capacity has not sent its results yet. Open the Beam Capacity tab once, then try again. Nothing was changed.'; rbCapNote(); return; }
  if(!d.ok){ RBCAP.fill=null; RBCAP.msg='Nothing was changed: '+escHTML(d.why||'Beam Capacity has no results.'); rbCapNote(); return; }
  const g=document.getElementById('asReq'), p=document.getElementById('asProv'), bs=document.getElementById('barSize');
  const F={d, asReq:rbCapUp2(d.asReq), asProv:rbCapDn2(d.asProv), barTxt:'', matTxt:''};
  g.value=F.asReq.toFixed(2); p.value=F.asProv.toFixed(2);
  if(d.bar && bs && [...bs.options].some(o=>o.value===d.bar)){
    if(bs.value!==d.bar){ F.barTxt='bar size set to #'+d.bar+' (was #'+bs.value+')'; bs.value=d.bar; } else F.barTxt='bar size #'+d.bar+' (unchanged)';
  } else if(!d.bar) F.barTxt='bar size not changed (the tension bars are of more than one size)';
  const inp=readInputs(), mm=[];
  if(isFinite(d.fc)&&Math.abs(inp.fc-d.fc*1000)>0.5) mm.push("f′c "+fmt(inp.fc,0)+" psi here, "+fmt(d.fc*1000,0)+" psi in Beam Capacity");
  if(isFinite(d.fy)&&Math.abs(inp.fy-d.fy*1000)>0.5) mm.push("f_y "+fmt(inp.fy,0)+" psi here, "+fmt(d.fy*1000,0)+" psi in Beam Capacity");
  if(mm.length) F.matTxt=mm.join('; ')+' (not changed).';
  RBCAP.fill=F;
  g.dispatchEvent(new Event('change',{bubbles:true}));   // one recalculation, autosave and undo step, as typing
  rbCapNote();
}
function rbCapInit(){
  const b=document.getElementById('asFromCap'); if(b) b.addEventListener('click',rbCapFill);
  const ip=document.getElementById('inputPanel');
  if(ip){ ip.addEventListener('input',rbCapNote); ip.addEventListener('change',rbCapNote); }
  document.addEventListener('click',e=>{
    const a=e.target&&e.target.closest?e.target.closest('a.rbCapA'):null; if(!a) return;
    e.preventDefault();
    try{ window.parent.postMessage({type:'cbcGoto',tab:a.getAttribute('data-cbtab'),card:a.getAttribute('data-cbcard')},'*'); }catch(err){}
  });
  window.addEventListener('message',e=>{
    if(!e||window.parent===window||e.source!==window.parent) return;   // only the suite shell
    const m=e.data; if(!m||m.type!=='sharedInputs'||m.source!=='beamCapacity'||!m.data) return;
    RBCAP.last=(m.data.asReq&&typeof m.data.asReq==='object')?m.data.asReq:{ok:false,why:'Beam Capacity did not send A_s values.'};
    const r=document.getElementById('asFromCapRow'); if(r) r.style.display='';
    rbCapNote();
  });
  try{ if(window.parent!==window) window.parent.postMessage({type:'requestShared'},'*'); }catch(e){}
}
```
- **`init()`:** after `rbPlibInit();   // PLIB: …` added `rbCapInit();    // CBAR-1: "From Beam Capacity" (suite only)`.
- **Report (`rbrModel`), before:**
```js
    rbS({id:'asReq',label:'Area of steel required by analysis (input)',sym:'A_{s,req}',value:inp.asReq,unit:'in^{2}'}),
    rbS({id:'asProv',label:'Area of steel provided (input)',sym:'A_{s,prov}',value:inp.asProv,unit:'in^{2}'}),
```
  **after:**
```js
    rbS(Object.assign({id:'asReq',label:'Area of steel required by analysis (input)',sym:'A_{s,req}',value:inp.asReq,unit:'in^{2}'},rbCapRpt(inp,'req'))),
    rbS(Object.assign({id:'asProv',label:'Area of steel provided (input)',sym:'A_{s,prov}',value:inp.asProv,unit:'in^{2}'},rbCapRpt(inp,'prov'))),
```
  with, after `const rbS=o=>SharedSteps.step(o);`:
```js
/* CBAR-1: Report note on A_s,req / A_s,prov while they still hold the values filled "From Beam Capacity" ({} otherwise) */
function rbCapRpt(inp,k){
  const F=(typeof RBCAP!=='undefined')?RBCAP.fill:null;
  if(!F||Math.abs(inp.asReq-F.asReq)>1e-9||Math.abs(inp.asProv-F.asProv)>1e-9) return {};
  const d=F.d, cb='Beam Capacity chapter, '+(d.links&&d.links.flex?'Flexure, '+d.links.flex.name:'Flexure');
  if(k==='prov') return {note:'from Beam Capacity: tension steel '+(d.bars||'')+' of combination '+(d.ci+1)+' = '+fmt(d.asProv,3)+' in² rounded down; see '+cb};
  return {note:'from Beam Capacity: max(A_s,flex '+fmt(d.asFlex,3)+', A_s,min '+fmt(d.asMin,3)+') = '+fmt(d.asReq,3)+' in² rounded up, '
    +(d.gov==='flexure'?'flexure governs':'minimum governs')+' (A_s,flex = A_s,prov·|M_u|/φM_n; A_s,min per '+d.min.ref+'); see '+cb
    +(d.gov==='flexure'?'':(d.code==='ACI'?' and Detailing, Minimum flexural reinforcement':' and Serviceability, Minimum flexural reinforcement'))};
}
```
- **Problem:** A_s,req / A_s,prov had to be copied by hand from the Beam Capacity tab (A_s,min from the Detailing card, A_s from the layers).
- **Governing provision:** none changed. ACI 318-19 25.4.10 / AASHTO LRFD 10th Ed. 5.10.8.2.1c (the excess factor, unchanged), ACI 318-19 9.6.1.2 and AASHTO LRFD 10th Ed. 5.6.3.3 (A_s,min, values as Beam Capacity already computes them).
- **Check case (default projects, ACI 318-19):** Beam Capacity default: b_w = 12 in, h = 18 in, cover 2.0 in, #4 stirrups, 3 #5 bottom, f′c = 4000 psi, f_y = 60 ksi, all M_u = 0 (φM_n = 62.6 k-ft). d = 18 − 2.0 − 0.5 − 0.625/2 = 15.1875 in; A_s,min = max(3√4000/60000 × 12 × 15.1875, 200/60000 × 12 × 15.1875) = max(0.576, 0.608) = 0.608 in²; A_s,flex = 0.93 × 0/62.6 = 0; A_s,req = 0.608 → **0.61 in²** (minimum governs); A_s,prov = 3 × 0.31 = **0.93 in²**; ratio 0.61/0.93 = **0.656**; bar #8 → #5. With "Apply excess-reinforcement reduction" ticked the tool's factor is 0.6559 (= 0.61/0.93), computed as before. AASHTO, M_u = 40 k-ft on combination 1: φM_n = 62.59 k-ft, M_cr = 0.67 × 1.6 × 25.92 = 27.79 k-ft, 1.33 M_u = 53.2 k-ft; A_s,flex = 0.93 × 40/62.59 = 0.594, A_s,min = 0.93 × 27.79/62.59 = 0.413 → A_s,req = 0.594 → 0.60 in² (flexure governs), ratio 0.645. Beam Capacity with no combinations (blocker "Loads"): nothing changed, note "Nothing was changed: Beam Capacity has 1 blocker (Loads) and no results."
- **How verified:** headless dump of the visible text and every input value of every input and output tab of the suite's three frames, the suite Report and the standalone ACI Rebar tool, origin/main vs branch (55 views): identical except the "From Beam Capacity" button on the Development & Splice Tension input tab; 0 console errors. Headless click test: the values above, the note, "Edited since" after typing, "Beam Capacity has changed since" after a Beam Capacity change, the AASHTO case, the no-result case, a "Worked in" link opening Beam Capacity · Detailing, and the Report step notes. `node tests/check-syntax.mjs`: all pass. `node tests/smoke/phone-layout.mjs --tool cbc,aci`: all passed. `node tests/smoke/project-library.mjs`: ALL PASS. Screenshots at 1600 and 390 px.
- **Saved data:** no key or format changed. The filled values are saved as ordinary inputs; the source note is not stored (session only).
- **Other copies:** `ACI Rebar Development Length.html` (the same Development & Splice code; the button never shows there: it appears only after a `sharedInputs` message from a parent page, and the standalone has none; listed in its fixlog as an intentional difference). CLAUDE.md §3.
- **Open items:** (1) A_s,flex is taken in proportion to the moment (A_s,prov · M_u/φM_n), slightly more than the exact steel needed; an exact inverse solve of φM_n(A_s) = M_u was not added (it would be a new calculation): engineer to say if wanted. (2) The Report notes name the Beam Capacity chapter, tab and card, not a § number.

## 2026-11-05 — PR: claude/cbc-dash-dev, PR #791: https://github.com/mlococo88/All-Structural/pull/791 (RBDC: check summary panel in the Development & Splice tab and in ACI Rebar Development Length.html, kept in step; display only, no result change)

### RBDC. Check summary panel replaces the dashboard box on screen   [display only] [no result change]
- **Engineer request (2026-11-05, Phase 2, PR 3 of 3):** the check summary panel of CBDC (#788) and ASDC (#789) in the Development & Splice frame (`<iframe id="suite-frame-dev" srcdoc=…>` of `Concrete Beam Capacity.html`) and in the standalone `ACI Rebar Development Length.html`, kept in step (CLAUDE.md §3).
  - This tool has no Summary tab. Its summary is the "Summary Dashboard — Code Checks" box (`#dashboard`, `buildDashboard`). The panel lists those same checks and takes that box's place on screen. `#dashboard` is still written; it is hidden by the screen CSS.
- **Where (both copies; the same text unless noted):**
  - Markup:
    - `<aside id="rbrDashCol" aria-label="Check summary"></aside>` as the first child of `<div class="layout no-print">`.
    - In `<div class="card outputpanel">`, before `<div class="tabs" id="tabs">`, `<div id="rbrDashBox">`. Its header `#rbrDashHead` holds `#rbrDashTgl`, `<h2 id="rbrDashTtl">Check summary</h2>` and `#rbrDashCnt`; the list is `#rbrDash`.
  - `buildDashboard(inp,f)`: before, the function ended with `document.getElementById('dashboard').innerHTML = html;`. After, that line is followed by `rbrDashRender(checks,f);   // RBDC: …`.
  - CSS: at the end of the first `<style>` block, after `.warnbox{border-radius:0 4px 4px 0; color:#78350F;}` (anchor `/* RBDC (2026-11-05): check summary panel`). It includes `@media screen{#dashboard{display:none!important}}`.
    - Standalone only: inside the 1500 px rule, `.appwrap{max-width:1792px}` (1500 + 292). At 1792 px and wider, the input and output panels keep their old widths. The suite copy is full width already.
  - JS: a new block just before `function render(){` (anchor `const RBDC={key:'rebar_dashCollapsed_v1'`). The code is below.
- **What the lines are (no new calculation):** one line per entry of `buildDashboard`'s `checks`, in its order, with its label and value.
  - **Status:**
    - INFO for the lengths and the limits applied in the calculation (`info:true`);
    - PASS / FAIL from `ok`;
    - REVIEW where the old box said CHK with the value "verify", "unknown" or "spacing?". These are the Report's CHK rows (`rebarResultRows`): Class A with A_s,req not entered, K_tr spacing not entered, #3 transverse at f′c > 10 ksi, f_y > 75 ksi.
    - The old box showed every non-OK check as "CHK". The lap-splice "N/P", f′c out of range, Class A not eligible and K_tr < 0.5d_b now read FAIL, as in the Report.
  - **Short value:** the box's value. For FAIL / REVIEW it is the condition instead: "not permitted", "out of range", "not eligible", "A_s,req not entered", "K_tr < 0.5d_b", "spacing not entered" or "verify".
  - **Expanded line:** the label with its value, then the reference and "→ Tab · Card". The references are those of `rebarResultRows` and of the worked steps: ACI 318-19 25.4.2.4 for (c_b+K_tr)/d_b ≤ 2.5 and ψ_tψ_e ≤ 1.7; AASHTO 5.10.8.2.1b for λ_rlλ_cf ≤ 1.7; 5.10.8.2.1c for λ_rc.
  - **Click:** opens the card (`rebarGoto`). The f′c line, which has no card, opens the Tension tab.
  - **Header count:** "n NG", "n REVIEW" or "no NG".
- **Layout:** at ≥ 1500 px, `.layout` becomes `292px minmax(340px,1fr) 2fr` and the column scrolls on its own (« collapses it to 42 px). Below 1500 px the box sits above the output tabs, at most 42vh tall, with ▾ Hide checks / ▸ Show checks. On a phone it is above the output tabs.
- **Saved data:** one new per-browser UI key, `rebar_dashCollapsed_v1` ('1' = collapsed). The standalone tool and the suite's Development & Splice tab share it. It is not in either autosave (`rebar_aci_autosave_v1`, `rcsuite.rebar_autosave_v1`), the saved projects or the export. No existing key or format changed.
- **Report and printing:** unchanged. The panel and the hidden box are in `.layout.no-print`. The Report uses `rebarResultRows` and `rbrModel`, not `#dashboard`.
- **Check case:**
  - Default project: "no NG". It shows 5 INFO lengths (l_d 47.4 in, l_dh 23.9 in, l_dc 19.0 in, l_st 61.7 in, l_sc 30.0 in), "(c_b+K_tr)/d_b 1.50 INFO", "f′c within code range 4000 psi PASS" and "ψ_t·ψ_e 1.00 INFO". These match the old box.
  - Standalone, AASHTO, #14, f′c 12,000 psi, Class A: "1 NG 2 REVIEW". The lines are "Lap splice permitted (5.10.8.4.2a) not permitted FAIL", "Class A splice eligible A_s,req not entered REVIEW" and "#3 transverse @ 12 in (f′c > 10 ksi) verify REVIEW". The old box showed CHK for all three.
  - A click on the Class A line opens Tension Splice · Class A Eligibility Check.
- **How verified:**
  - Headless Chromium, origin/main (after #790) vs branch. The panel and `#dashboard` were hidden while the tab text was read.
  - Compared: the dev calculations (`readInputs`, `computeFactors`, `calcTension` … `calcCompSplice`, `rbrModel()`), every tab's text in both copies, the other two suite frames and the suite Report. All identical in 5 cases (default, AASHTO f_yt 100, ACI with torsion, excess reinforcement ACI and AASHTO), with 0 console errors.
  - `node tests/check-syntax.mjs`, `tests/smoke/phone-layout.mjs --tool cbc,aci` and `tests/smoke/project-library.mjs` pass.
  - Screenshots before and after at 1920 and 390 px, for both copies, looked at.
- **Other copies:** `Concrete Beam Capacity.html` (suite-frame-dev) and `ACI Rebar Development Length.html`. The same JS and CSS are in both, except the standalone's `.appwrap` width rule.
- **Open items:** the old box's heading named the code ("(ACI 318-19)" / "(AASHTO LRFD §5.10.8)"). The panel does not; the code is shown in Code & Material and on every worked card.

#### Code added (re-apply by hand)
CSS, end of the first `<style>` block (standalone: also `.appwrap{max-width:1792px}` as the first rule inside `@media screen and (min-width:1500px){`):
```css
/* RBDC (2026-11-05): check summary panel, as the Beam Capacity and ASD tabs of Concrete Beam Capacity.html (CBDC #788, ASDC #789)
   and Spread Footing / Light Pole. One line per check of the summary dashboard, collapsible; on screens >= 1500 px a 280 px left
   column that scrolls on its own; below that a compact grid above the output tabs. It replaces the dashboard box on screen
   (#dashboard is still written by buildDashboard, hidden). Screen only; the Report and printing are unchanged. */
#rbrDashCol{display:none}
@media print{#rbrDashCol,#rbrDashBox{display:none!important}}
@media screen{
  #dashboard{display:none!important}
  #rbrDashBox{flex:0 0 auto;font-family:var(--font-ui);padding:5px 14px 0;background:var(--slate-50);border-bottom:1px solid var(--line);
    max-height:42vh;overflow-y:auto}
  #rbrDashHead{display:flex;align-items:center;gap:4px 8px;flex-wrap:wrap}
  #rbrDashTtl{margin:2px 0;font-family:var(--font-ui);font-size:9pt;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--navy-800)}
  #rbrDashTgl{margin:0;padding:1px 7px;font:8.5pt var(--font-ui);border:1px solid #CBD5E1;background:var(--slate-100);border-radius:4px;cursor:pointer;color:#334155}
  #rbrDashCnt{display:inline-flex;gap:4px;flex-wrap:wrap}
  #rbrDashCnt span{font-size:8pt;font-weight:700;padding:1px 5px;border:1px solid;border-radius:3px;white-space:nowrap}
  #rbrDashCnt .rbrdCf{color:#991B1B;background:#FEF2F2;border-color:var(--fail)}
  #rbrDashCnt .rbrdCw{color:#92400E;background:#FFFBEB;border-color:var(--warn)}
  #rbrDashCnt .rbrdCp{color:#065F46;background:#ECFDF5;border-color:var(--pass)}
  #rbrDashCnt .rbrdCn{color:#475569;background:var(--slate-100);border-color:#CBD5E1}
  body.rbrDashColl #rbrDash{display:none}
  #rbrDash{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(250px,100%),1fr));gap:3px 6px;margin:4px 0 7px;align-items:start}
  #rbrDash .rbrdCh{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;column-gap:5px;padding:2px 5px 2px 2px;min-width:0;
    border:1px solid var(--line);border-left:4px solid var(--slate-400);border-radius:3px;background:#fff;font-size:8.5pt;line-height:1.35;cursor:pointer}
  #rbrDash .rbrdCh:hover{background:var(--slate-50)} #rbrDash .rbrdCh:focus-visible{outline:2px solid var(--blue-600);outline-offset:-1px}
  #rbrDash .rbrdCh.pass{border-left-color:var(--pass)} #rbrDash .rbrdCh.fail{border-left-color:var(--fail);background:#FEF2F2} #rbrDash .rbrdCh.warn{border-left-color:var(--warn);background:#FFFBEB}
  #rbrDash .rbrdCh .rbrdX{grid-row:1;grid-column:1;margin:0;padding:0 3px;border:none;background:transparent;font-size:9px;color:#334155;line-height:1.2;cursor:pointer}
  #rbrDash .rbrdCh .rbrdN{grid-row:1;grid-column:2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #rbrDash .rbrdCh .rbrdR{grid-row:1;grid-column:3;white-space:nowrap;color:#334155;font-variant-numeric:tabular-nums}
  #rbrDash .rbrdCh .rbrdS{grid-row:1;grid-column:4;font-size:7.5pt;font-weight:700;white-space:nowrap}
  #rbrDash .rbrdCh.pass .rbrdS{color:var(--pass)} #rbrDash .rbrdCh.fail .rbrdS{color:var(--fail)} #rbrDash .rbrdCh.warn .rbrdS{color:var(--warn)} #rbrDash .rbrdCh.na .rbrdS{color:#64748b}
  #rbrDash .rbrdCh .rbrdV,#rbrDash .rbrdCh .rbrdDC,#rbrDash .rbrdCh .rbrdRef{grid-column:1/-1;display:none;padding-left:16px;overflow-wrap:anywhere}
  #rbrDash .rbrdCh .rbrdDC,#rbrDash .rbrdCh .rbrdRef{color:#475569;font-size:8pt} #rbrDash .rbrdCh .rbrdRef{font-style:italic}
  #rbrDash .rbrdCh.rbrdOpen .rbrdV,#rbrDash .rbrdCh.rbrdOpen .rbrdDC,#rbrDash .rbrdCh.rbrdOpen .rbrdRef{display:block}
  #rbrDash .rbrdCh.rbrdOpen .rbrdN{white-space:normal}
  .rbrdMsg{grid-column:1/-1;font-size:8.5pt;padding:5px 8px;border:1px solid var(--line);border-left:4px solid var(--fail);background:#FEF2F2;color:#7F1D1D;border-radius:3px}
}
@media screen and (min-width:1500px){
  body.rbrDashWide .layout{grid-template-columns:292px minmax(340px,1fr) 2fr}
  body.rbrDashWide #rbrDashCol{display:block;height:100%;overflow-y:auto;overflow-x:hidden;position:relative;
    padding:0 6px 24px;border:1px solid var(--line);border-radius:3px;background:var(--slate-50);overscroll-behavior:contain;font-family:var(--font-ui)}
  body.rbrDashWide #rbrDashBox{padding:0;border-bottom:0;max-height:none;overflow:visible;background:transparent}
  body.rbrDashWide #rbrDash{grid-template-columns:minmax(0,1fr)}
  body.rbrDashWide #rbrDashHead{position:sticky;top:0;z-index:3;background:var(--slate-50);padding:5px 0 4px}
  body.rbrDashWide.rbrDashColl .layout{grid-template-columns:42px minmax(340px,1fr) 2fr}
  body.rbrDashWide.rbrDashColl #rbrDashCol{padding:0}
  body.rbrDashWide.rbrDashColl #rbrDashHead{flex-direction:column;align-items:center}
  body.rbrDashWide.rbrDashColl #rbrDashTtl{writing-mode:vertical-rl;transform:rotate(180deg);margin:4px 0;white-space:nowrap}
  body.rbrDashWide.rbrDashColl #rbrDashCnt{flex-direction:column;align-items:center}
  body.rbrDashWide.rbrDashColl #rbrDashCnt span{font-size:7.5pt;padding:1px 2px;white-space:normal;text-align:center;width:36px}
  body.rbrDashWide #rbrDashCol::-webkit-scrollbar{width:7px}
  body.rbrDashWide #rbrDashCol::-webkit-scrollbar-thumb{background:#c2ccd6;border-radius:4px}
}
```
JS, before `function render(){`:
```js
/* RBDC (2026-11-05, engineer): check summary panel, as the Beam Capacity and ASD tabs of Concrete Beam Capacity.html (CBDC #788,
   ASDC #789) and Spread Footing / Light Pole. One line per check of the summary dashboard (buildDashboard's `checks`, the same
   values and states): expand button, name, a short value, status. Status: INFO for a length or a limit applied in the
   calculation; PASS / FAIL for a code check; REVIEW where the dashboard says "verify", "unknown" or "spacing?" (the Report's CHK).
   The short value is the dashboard's value; for a FAIL / REVIEW line, the condition. FAIL and REVIEW lines start expanded. A line
   click opens the card where it is worked (rebarGoto, the D11 links). No new calculation. The panel replaces the dashboard box
   on screen (#dashboard is still written, hidden).
   On screens >= 1500 px the box is moved into the left column #rbrDashCol; below that it sits above the output tabs.
   Collapse state: per-browser UI key rebar_dashCollapsed_v1 ('1' = collapsed, '0' or absent = open), shared by the standalone
   tool and the Development & Splice tab of Concrete Beam Capacity.html; not in the autosave, the saved projects or the export.
   The standalone tool and the Development & Splice tab carry this same block (CLAUDE.md §3). */
const RBDC={key:'rebar_dashCollapsed_v1',mq:window.matchMedia?window.matchMedia('screen and (min-width:1500px)'):null,open:new Map(),coll:false};
try{ RBDC.coll=localStorage.getItem(RBDC.key)==='1'; }catch(e){}
const RBDC_ST={pass:'PASS',fail:'FAIL',warn:'REVIEW',na:'INFO'};
/* name, card (REBAR_CARDS), reference and failing condition of each dashboard check, by the start of its label */
function rbrDashMeta(lbl,f,val){
  const A=f.AASHTO;
  const M=[
    ['Tension l_d',{card:'tLd',ref:A?'AASHTO 5.10.8.2.1a, Eq. 5.10.8.2.1a-1':'ACI 318-19 Eq. 25.4.2.4a, 25.4.2.1'}],
    ['Hook l_dh',{card:'hLdh',ref:A?'AASHTO 5.10.8.2.4a, Eq. 5.10.8.2.4a-1':'ACI 318-19 Eq. 25.4.3.1'}],
    ['Comp. l_dc',{card:'cLdc',ref:A?'AASHTO 5.10.8.2.2a':'ACI 318-19 25.4.9.2'}],
    ['Tension splice',{card:'tsLen',ref:A?'AASHTO 5.10.8.4.3a':'ACI 318-19 25.5.2'}],
    ['Comp. splice',{card:'csLen',ref:A?'AASHTO 5.10.8.4.5a':'ACI 318-19 25.5.5.1'}],
    ['λ_rc',{card:'tConfA',ref:'AASHTO 5.10.8.2.1c'}],
    ['(c_b+K_tr)/d_b',{card:'tConf',ref:'ACI 318-19 25.4.2.4'}],
    ["f'c within code range",{card:null,tab:'tension',ref:A?'AASHTO 5.10.8.2.1, C5.10.8.2.4':'ACI 318-19 25.4.1.4',cond:'out of range'}],
    ['λ_rl·λ_cf',{card:'tLd',ref:'AASHTO 5.10.8.2.1b'}],
    ['ψ_t·ψ_e',{card:'tLd',ref:'ACI 318-19 25.4.2.4'}],
    ['Class A splice eligible',{card:'tsClassA',ref:A?'AASHTO 5.10.8.4.3a':'ACI 318-19 25.5.2.1',cond:val==='unknown'?'A_s,req not entered':'not eligible'}],
    ['K_tr ≥ 0.5d_b',{card:'tConf',ref:'ACI 318-19 25.4.2.2',cond:val==='spacing?'?'spacing not entered':'K_tr < 0.5d_b'}],
    ['Lap splice permitted',{card:'tsLen',ref:lapRef(f),cond:'not permitted'}],
    ['#3 transverse',{card:'tLd',ref:'AASHTO 5.10.8.2.1, 5.10.8.4.3, 5.10.8.2.4b',cond:'verify'}],
    ['Transverse reinf.',{card:'tLd',ref:'AASHTO 5.10.8.2.1, 5.10.8.4, 5.10.8.2.4',cond:'verify'}]];
  const m=M.find(x=>lbl.indexOf(x[0])===0);
  return m?m[1]:{card:null,tab:'tension',ref:''};
}
function rbrDashGo(it){
  if(it.card) rebarGoto(it.card);
  else if(it.tab){ switchTab(it.tab); const tc=document.getElementById('tabcontent'); if(tc) tc.scrollTop=0; }
}
function rbrDashRender(checks,f){
  const box=document.getElementById('rbrDash'), cnt=document.getElementById('rbrDashCnt'); if(!box) return;
  box.innerHTML='';
  const n={fail:0,warn:0};
  const tmp=document.createElement('div');
  const txt=h=>{ tmp.innerHTML=String(h); return tmp.textContent; };
  (checks||[]).forEach(k=>{
    const val=txt(k.val), name=txt(k.lbl), m=rbrDashMeta(k.lbl,f,val);
    const st=k.info?'na':(k.ok?'pass':((val==='verify'||val==='unknown'||val==='spacing?')?'warn':'fail'));
    if(n[st]!=null) n[st]++;
    const short=(st==='fail'||st==='warn')&&m.cond?m.cond:val;
    const wh=m.card&&REBAR_CARDS[m.card]?'→ '+rebarCardTxt(m.card):(m.tab?'→ '+rebarTabName(m.tab):'');
    const c=document.createElement('div'); c.className='rbrdCh '+st; c.tabIndex=0; c.setAttribute('role','button');
    const add=(tag,cls,t)=>{ const e=document.createElement(tag); e.className=cls; e.textContent=t; c.appendChild(e); return e; };
    const x=add('button','rbrdX',''); x.type='button'; x.title='Show the value and the reference';
    add('span','rbrdN',name); add('span','rbrdR',short); add('span','rbrdS',RBDC_ST[st]);
    add('div','rbrdV',name+': '+val+(k.info?' (information)':''));
    add('div','rbrdRef',(m.ref||'')+(m.ref&&wh?' · ':'')+wh);
    c.title=name+': '+val+(m.ref?'\nReference: '+m.ref:'')+(wh?'\nClick: '+wh:'');
    const setOpen=o=>{ c.classList.toggle('rbrdOpen',o); x.setAttribute('aria-expanded',o?'true':'false'); x.textContent=o?'▾':'▸'; };
    setOpen(RBDC.open.has(name)?RBDC.open.get(name):(st==='fail'||st==='warn'));
    x.addEventListener('click',ev=>{ ev.preventDefault(); ev.stopPropagation(); const o=!c.classList.contains('rbrdOpen'); RBDC.open.set(name,o); setOpen(o); });
    const go=()=>rbrDashGo({card:m.card,tab:m.tab});
    c.addEventListener('click',go);
    c.addEventListener('keydown',ev=>{ if((ev.key==='Enter'||ev.key===' ')&&ev.target===c){ ev.preventDefault(); go(); } });
    box.appendChild(c);
  });
  if(cnt) cnt.innerHTML=(n.fail?'<span class="rbrdCf">'+n.fail+' NG</span>':'')+(n.warn?'<span class="rbrdCw">'+n.warn+' REVIEW</span>':'')
    +(!n.fail&&!n.warn?'<span class="rbrdCp">no NG</span>':'');
}
function rbrDashPlace(){
  const box=document.getElementById('rbrDashBox'), col=document.getElementById('rbrDashCol'), op=document.querySelector('.outputpanel'), tabs=document.getElementById('tabs');
  if(!box||!col||!op) return;
  const wide=!!(RBDC.mq&&RBDC.mq.matches);
  document.body.classList.toggle('rbrDashWide',wide);
  if(wide){ if(box.parentNode!==col) col.appendChild(box); }
  else if(box.parentNode!==op) op.insertBefore(box,tabs||op.firstChild);
  rbrDashColl(RBDC.coll,false);
}
function rbrDashColl(v,save){
  RBDC.coll=!!v; document.body.classList.toggle('rbrDashColl',RBDC.coll);
  const t=document.getElementById('rbrDashTgl'), wide=document.body.classList.contains('rbrDashWide');
  if(t){ t.setAttribute('aria-expanded',RBDC.coll?'false':'true');
    t.innerHTML=wide?(RBDC.coll?'&raquo;':'&laquo;'):(RBDC.coll?'&#9656; Show checks':'&#9662; Hide checks');
    t.title=(RBDC.coll?'Show':'Hide')+' the check list (remembered in this browser)'; }
  if(save){ try{ localStorage.setItem(RBDC.key,RBDC.coll?'1':'0'); }catch(e){} }
}
(function(){
  const t=document.getElementById('rbrDashTgl'); if(t) t.addEventListener('click',()=>rbrDashColl(!RBDC.coll,true));
  if(RBDC.mq){ if(RBDC.mq.addEventListener) RBDC.mq.addEventListener('change',rbrDashPlace); else if(RBDC.mq.addListener) RBDC.mq.addListener(rbrDashPlace); }
  rbrDashPlace();
})();
```

## 2026-11-05 — PR: claude/cbc-p2-display, PR #792: https://github.com/mlococo88/All-Structural/pull/792 (CBRL: a failing Detailing "Comparison" line prints the relation the values satisfy; RBDT: the Development & Splice check summary title names the code; display only, no result change)

### CBRL. Detailing "Comparison" line and Report step: the actual relation   [display only] [no result change]
- **Engineer request (2026-11-05, Phase 2 follow-up; seen in CBDC #788):** on a failing Detailing card the "Comparison" line printed the required relation with the numbers, e.g. "provided ≤ required / 6.000 ≤ 5.250 in" for the default project's torsion stirrup spacing. It should print the relation the numbers satisfy ("6.000 > 5.250 in"), the same way on every Detailing card and in the Report.
- **Where (Beam Capacity srcdoc page, `<iframe id="suite-frame-capacity" srcdoc=…>`):**
  - New helper `cbcDetRel(d)` just before `function detailing(F,sh,neg,govMu,Vu,tor){` (anchor `/* CBRL (2026-11-05, engineer)`):
    ```js
    function cbcDetRel(d){
      if(d.ok) return d.cmp;
      if(d.cmp==="\\le"&&d.have>d.need) return "\\gt";
      if(d.cmp==="\\ge"&&d.have<d.need) return "\\lt";
      return d.cmp;
    }
    ```
  - `buildDetailTab`, the "Comparison" `eqBlock`, second line. Before: ``…(d.unit===""?5:3))} ${d.cmp} ${fmt(d.need…``. After: ``…(d.unit===""?5:3))} ${cbcDetRel(d)} ${fmt(d.need…``. The first line ("provided ≤ required" / "provided ≥ required") still states the requirement.
  - `cbcRptModel`, section 7 Detailing, the worked step `d.id+'.cmp'`. Before: `sub:fmt(d.have,dp)+' '+d.cmp+' '+fmt(d.need,dp),`. After: `sub:fmt(d.have,dp)+' '+cbcDetRel(d)+' '+fmt(d.need,dp),`.
- **Logic:** a passing check prints the required relation as before (unchanged text). A failing check prints `\gt` (for a ≤ limit) or `\lt` (for a ≥ minimum) when the numbers violate it. If a check fails while its two numbers satisfy the relation (none known today), the required relation is kept. `\gt` / `\lt` are in the `shared/steps.js` TeX subset and in KaTeX. Status, D/C and every result are untouched (`d.ok` still decides).
- **Check case:** default project (ACI): card 7 "Maximum closed-stirrup spacing for torsion": before "6.000 ≤ 5.250 in", after "6.000 > 5.250 in" (s = 6 in, s_max = min(p_h/8, 12) = min(42/8, 12) = 5.25 in, FAIL). Card 9 "Longitudinal torsion steel to develop T_u": before "0.000 ≥ 0.878 in²", after "0.000 < 0.878 in²". Passing cards (e.g. card 8 "0.000 ≥ 0.000 in²") unchanged. AASHTO, f_yt 100, M_u 120 / V_u 60 / T_u 5: "Clear cover" before "2.000 ≥ 2.500", after "2.000 < 2.500 in".
- **How verified:** headless Chromium, origin/main vs branch, 5 cases (default, AASHTO f_yt 100, ACI with torsion, excess reinforcement ACI / AASHTO): `computeAll()`, `allChecks()` identical; `cbcRptModel()` differs only in the `.cmp` steps' `sub` of failing checks; tab text differs only on the Detailing tab lines above. Screenshot of card 7 looked at.

### RBDT. Development & Splice check summary title names the code   [display only]
- **Engineer request:** the panel title (RBDC #791, "Check summary") names the code, following the code mode, as the old dashboard heading did (RBDC open item).
- **Where (Development & Splice srcdoc page and `ACI Rebar Development Length.html`, the same text):** `rbrDashRender(checks,f)`, after `box.innerHTML='';`, added:
  ```js
  /* RBDT (2026-11-05): the panel title names the code of the calculation, as the old dashboard heading did */
  const tt=document.getElementById('rbrDashTtl'); if(tt) tt.textContent='Checks — '+(f&&f.AASHTO?'AASHTO LRFD 10th Ed. §5.10.8':'ACI 318-19');
  ```
- **Check case:** default (ACI) "CHECKS — ACI 318-19" (upper case by the existing CSS); Code = AASHTO: "CHECKS — AASHTO LRFD 10TH ED. §5.10.8". The markup's initial text "Check summary" is replaced at the first render.
- **How verified:** as CBRL; the only text differences in both copies are the title. Screenshots at 1600 px (column) and 1100 px (above the tabs) looked at.
- **Other copies:** `ACI Rebar Development Length.html` (same edit, logged there).
- **Tests:** `node tests/check-syntax.mjs`, `node tests/smoke/phone-layout.mjs --tool cbc,aci`, `node tests/smoke/project-library.mjs` pass.

## 2026-11-05 — PR: claude/cbc-report-order, PR #793: https://github.com/mlococo88/All-Structural/pull/793 (CBRO: the suite Report in the design order, a suite-wide "Summary of results" first, section numbers independent of the Include boxes; display only, no result change)

### CBRO. Report order and Summary of results   [display only] [no result change]
- **Engineer request (2026-11-05, Phase 4 of the concrete beam suite update):** the Spread Footing Report structure (SFRO #778, SFRF #779) in the suite Report: a suite-wide "Summary of results" first, covering the checks of all three chapters with links; each chapter in design order; numbering that does not move with the Include boxes.
- **Where:** the suite shell only (no srcdoc frame changed). New block before `  function model(){` (anchor `/* ---------- CBRO (2026-11-05`): `CBRO_ORD`, `CBRO_TTL`, `cbroOrder(M)`, `CBRO_ST`, `cbroSum()`, `cbroKeys(M)`. In `model()`:
  - Before: `    rxRest(M);   /* CBRX: what the retired print reports printed and the chapters lack */` / `    return M;`
  - After: the same, with `    cbroOrder(M);   /* CBRO: design order, the suite's Summary of results first, numbering independent of the Include boxes */` between them.
  `cbroOrder` runs after `rxRest`, so the "As printed" copies are made exactly as before; it only moves sections and adds the Summary and the one-line sections. `shared/report.js` renumbers every section and regenerates every "see §x.y" from the keys.
- **Summary of results (§1):** one subsection per chapter, one line per line of that tab's check summary panel, with the panel's name, short value (D/C, RF, length, or the condition not met), status and reference:
  - Beam Capacity: `cbcDashItems()` (CBDC #788), zipped with `allChecks()` for the combination; the Detail column is the panel's expanded text (provided vs limit, governing combination, the D/C where the status comes from a condition). With an input blocker the panel's message ("Input invalid: output withheld …") replaces the table.
  - ASD Beam Calcs: `asdDashItems()` (ASDC #789): the rating levels and the REVIEW notices.
  - Development & Splice: the lines of `#rbrDash` as shown (RBDC #791; read from the panel because its checks are local to `buildDashboard`; the standalone ACI Rebar tool is untouched), `rbrDashMeta()` for the card.
  - The last column links to the step where the check is worked: Beam Capacity `fx<i>/DCR`, `sh<i>/DCRs` or `sh<i>/DCR`, `tq<i>/size|combVT|DCR`, `sv/minr`, `dt/<id>.cmp` (the keys the chapter's own Summary of checks uses); ASD `an/inv.RF` / `an/op.RF`; Development & Splice the length step (`td/ld`, `hk/ldh`, `cd/ldc`, `ts/lst`, `cs/lsc`, `ts/clsA`, `td/ktrHS`) or the limit's step (`td/cbKtr`, `td/psiTE`, `td/rlcf`). `cbroKeys` takes the first key found in the report; else an omitted combination's note (`omit-<scope>`); else the tab's section (key `cbro:<chapter>:<tab>`).
  - A count line per chapter ("n NG", "REVIEW") and one for the suite, as the panels' header counts.
- **New order (default project):**

  | Main | Branch |
  |---|---|
  | A. 1 Inputs · 2 Summary of checks · 3 Flexure · 4 Shear · 5 Torsion · 6 Serviceability · 7 Detailing · 8 Validation notices | 1 Summary of results · A. 2 Inputs · 3 Validation notices · 4 Flexure · 5 Shear · 6 Torsion · 7 Serviceability · 8 Detailing · 9 Summary of checks |
  | B. 9 Inputs · 10 Summary & Rating · 11 Analysis and rating | B. 10 Inputs · 11 Analysis and rating · 12 Summary & Rating |
  | C. 12 Project and inputs (12.3 Summary of results) · 13–17 the five lengths · 18 Bar development schedule | C. 13 Project and inputs · 14–18 the five lengths · 19 Bar development schedule · 20 Summary of results (20.1 "Development and splice lengths and code checks", the former 12.3) |
  | D. 19 References | D. 21 References |

- **Numbering independent of the Include boxes:** a Beam Capacity or ASD tab whose Include box is off keeps its section, with one line: "Not included in this report: the Include box “…” on the report bar is off. On screen: … tab" (link). A tab that is on but adds nothing (no validation notices; an ASD Summary & Rating with nothing new) keeps a one-line section too. Before, those sections were left out and every later number moved. Torsion is a section only when the project has torsion (ACI), as before (an input, not an Include box).
- **Decisions (pending engineer review):**
  - The chapters' own summaries (Beam Capacity "Summary of checks", ASD "Summary & Rating", Development & Splice "Summary of results") are kept, at the end of their chapter, after the checks they summarize. They hold the per-combination tables and the 3-decimal D/C; the suite Summary at the front follows the panels. Moving them to the front of each chapter, or dropping them, is a one-line change in `CBRO_ORD`.
  - "Validation notices" (method choices, mandatory limits, disclosed conservatism) moved next to the inputs as the basis of the calculation, as Spread Footing's "Assumptions and warnings".
  - The Summary has no chapter letter: it is front matter for the three chapters.
  - Condition texts are the panels' own ("s > s_max (torsion)", "A_ℓ < A_ℓ,req"), not re-typeset.
- **Renamed:** Development & Splice "Summary of results" subsection → section "Summary of results" with the subsection "Development and splice lengths and code checks". Nothing removed.
- **Table-copy corruption (rowspan / colspan, as SFIE #781):** none of the shell or the three frames uses `rowspan` / `colspan` (searched), so the copier `rxWalk` cannot drop a merged cell. Nothing to fix.
- **How verified (headless Chromium, origin/main 3a00e90 vs the branch; KaTeX 0.16.9, Plotly 2.27, three r128 from tests/libs):**
  - 5 cases: default; c2 (title block with quotes, A_ℓ 1.2 in², three combinations, Validation and Combination 2 deselected; ASD negative moment; Development & Splice AASHTO #11, f′c 12 ksi, hook, excess reinforcement); c3 (AASHTO tee, f_y 80 ksi; ASD inventory and operating); off (Input Echo, Validation, Flexure, Summary & Dashboard and Combination 1 off; ASD Summary & Rating and Analysis off); bad (b_w blank, input blocker).
  - Beam Capacity `CC`, ASD `CC` and the Development & Splice results (JSON): identical. localStorage identical before the Report, and unchanged by showing and printing it.
  - Report text (screen `SharedReport.text` and the print box): every line of main is present in the branch apart from § / section numbers and the renamed subsection title. Added: the Summary of results and the one-line sections.
  - 0 unresolved references, 0 duplicate keys, 0 console errors in every case.
  - Printed PDF of the default project (42 Letter pages, main 41) looked at: contents, the Summary on page 3 with "see §x.y" in the last column.
  - `node tests/check-syntax.mjs "Concrete Beam Capacity.html"`, `node tests/engine/run.mjs report steps steps-groups report-wiring` (14 passed), `node tests/smoke/phone-layout.mjs --tool cbc` (all passed).
- **Saved data:** none read or written by the new code; no key or format change.
- **Governing provision:** none changed (no formula, factor, unit or code reference).
- **Other copies:** none (shell code). The Development & Splice frame and "ACI Rebar Development Length.html" are unchanged.
- **Open item (seen, not changed):** with an input blocker (b_w blank) the Beam Capacity panel says "Input invalid: output withheld" while the Beam Capacity chapter still prints the last results (as on main). The Summary follows the panel.

#### Code added (re-apply by hand)
```js
  /* ---------- CBRO (2026-11-05, Phase 4 of the concrete beam suite update): the Report in the design order, with a suite-wide
     "Summary of results" first (the Spread Footing Report's order, SFRO #778 / SFRF #779). Display only: sections are moved and
     the check lines are read from the tabs' own check summary panels; nothing is computed here.
     Order: 1 Summary of results · A. Beam Capacity: Inputs, Validation notices (the basis), Flexure, Shear, Torsion,
     Serviceability, Detailing, Summary of checks · B. ASD Beam Calcs: Inputs, Analysis and rating, Summary & Rating ·
     C. Development & Splice: Project and inputs, the five lengths, Bar development schedule, Summary of results · D. References.
     A section whose Include box is off (or that has nothing to show for this project) stays as a one-line section, so the
     section numbers do not move with the Include boxes. Every section of a tab gets the key cbro:<chapter>:<tab>. ---------- */
  var CBRO_ORD={cap:['tabInputEcho','tabValid','tabFlex','tabShear','tabTor','tabServ','tabDetail','tabSummary'],asd:['tabInputEcho','tabAnalysis','tabSummary']};
  var CBRO_TTL={cap:{tabInputEcho:'Inputs',tabValid:'Validation notices',tabFlex:'Flexure',tabShear:'Shear',tabTor:'Torsion',tabServ:'Serviceability',tabDetail:'Detailing',tabSummary:'Summary of checks'},
    asd:{tabInputEcho:'Inputs',tabAnalysis:'Analysis and rating',tabSummary:'Summary & Rating'}};
  function cbroOrder(M){
    var G={cap:[],asd:[],dev:[],ref:[]}, part={};
    M.sections.forEach(function(s){ var g=G[s._ch]?s._ch:'ref'; if(s.part&&!part[g]) part[g]=s.part; G[g].push(s); });
    ['cap','asd'].forEach(function(id){
      var g=G[id]; if(!g.some(function(s){ return s._tab; })) return;   /* a chapter that could not be built: as it is */
      var c=RXCH.filter(function(q){ return q.id===id; })[0], b=rxFn(c,'Boxes'), sl=rxFn(c,'Sel'), B=null, Sl=null;
      try{ B=b?b():null; Sl=sl?sl():null; }catch(e){}
      var lab={}; ((B&&B.tabs)||[]).forEach(function(t){ lab[t[0]]=t[1]; });
      var res=[];
      CBRO_ORD[id].forEach(function(t){
        var hit=g.filter(function(s){ return s._tab===t; });
        if(hit.length){ res=res.concat(hit); return; }
        if(!lab[t]) return;   /* not a tab of this project (e.g. Torsion when torsion is off) */
        var off=!!(Sl&&Sl.tabs&&Sl.tabs[t]===false), link='[[tab:'+id+'/'+t+'|On screen: '+lab[t]+' tab]]';
        res.push({title:CBRO_TTL[id][t],_ch:id,_tab:t,_stub:true,subs:[],
          note:off?'Not included in this report: the Include box “'+lab[t]+'” on the report bar is off. '+link
            :(t==='tabValid'?'No validation notices for this project. ':'The '+lab[t]+' tab adds nothing to the other sections of this chapter for this project. ')+link});
      });
      g.forEach(function(s){ if(res.indexOf(s)<0) res.push(s); });
      G[id]=res;
    });
    /* Development & Splice: its Summary of results (a subsection of "Project and inputs") becomes the last section of the chapter */
    var pi=G.dev.filter(function(s){ return s.title==='Project and inputs'; })[0], k=-1;
    if(pi) pi.subs.forEach(function(q,i){ if(k<0&&q.title==='Summary of results') k=i; });
    if(k>=0){ var q=pi.subs.splice(k,1)[0]; q.title='Development and splice lengths and code checks'; G.dev.push({title:'Summary of results',_ch:'dev',_tab:'sum',subs:[q]}); }
    var DT={'Project and inputs':'inputs','Tension development':'tension','Standard hook':'hook','Compression development':'compression','Tension lap splice':'tsplice','Compression lap splice':'csplice','Bar development schedule':'batch'};
    G.dev.forEach(function(s){ if(!s._tab&&DT[s.title]) s._tab=DT[s.title]; });
    ['cap','asd','dev','ref'].forEach(function(g){ G[g].forEach(function(s,i){ s.part=i===0?part[g]:undefined; if(s._tab&&g!=='ref') s.key='cbro:'+g+':'+s._tab; }); });
    M.sections=[cbroSum()].concat(G.cap,G.asd,G.dev,G.ref);
    cbroKeys(M);
  }
  /* the suite-wide Summary of results: one line per check of each tab's check summary panel (Beam Capacity CBDC #788
     cbcDashItems, ASD Beam Calcs ASDC #789 asdDashItems, Development & Splice RBDC #791 #rbrDash lines), the same name, short
     value (the D/C, the RF, the length, or the condition not met), status and reference; the last column links to the step
     where the check is worked (resolved in cbroKeys, else the tab's section). */
  var CBRO_ST={pass:['PASS','ok'],fail:['FAIL','ng'],na:['N/A','na'],warn:['REVIEW','hi'],info:['INFO','na']};
  function cbroSum(){
    var subs=[], tot=[];
    var head=['Check','Result','Status','Detail','Reference (worked in)'];
    var row=function(name,short,st,detail,ref,keys){ var x=CBRO_ST[st]||CBRO_ST.na;
      return [name,{t:short||'—',n:/^[−\-\d.,\s]*$|^(D\/C|RF) /.test(short||'')||undefined},{t:x[0],cls:x[1]},detail||'',{t:ref||'—',_k:keys}]; };
    var count=function(rows){ var f=0,w=0; rows.forEach(function(r){ if(r[2].t==='FAIL') f++; if(r[2].t==='REVIEW') w++; });
      return (f?f+' NG':'no NG')+(w?', '+w+' REVIEW':''); };
    var add=function(title,rows,msg,note){
      if(msg){ subs.push({title:title,items:[{type:'note',warn:true,text:msg}]}); tot.push(title+': '+msg.replace(/\.$/,'')); return; }
      var cn=count(rows); tot.push(title+': '+(rows.length?cn:'no checks'));
      subs.push({title:title,items:[{type:'note',text:rows.length?'Check summary: '+cn+' ('+rows.length+' lines).':'No checks.'}].concat(rows.length?[{type:'table',head:head,rows:rows}]:[]).concat(note?[{type:'note',text:note}]:[])});
    };
    /* A. Beam Capacity */
    (function(){ var w=win('capacity'), its=null, K=null, msg=null, rows=[];
      try{ var m=w.document.querySelector('#cbcDash .cbdMsg'); if(m) msg=m.textContent; else { its=w.cbcDashItems(); K=w.allChecks(); } }catch(e){ msg=null; its=null; }
      if(!msg&&!its) msg='No results: the Beam Capacity tab has not finished loading, or its inputs need correcting.';
      if(!msg) its.forEach(function(it,i){ var c=K[i]||{}, ks=[];
        if(!c.na&&c.ci!=null){ var ci=c.ci;
          if(c.tab==='tabFlex') ks=['fx'+ci+'/DCR'];
          else if(c.tab==='tabShear') ks=['sh'+ci+'/DCRs','sh'+ci+'/DCR'];
          else if(c.tab==='tabTor') ks=[/cross/i.test(c.label)?'tq'+ci+'/size':(/Combined/.test(c.label)?'tq'+ci+'/combVT':'tq'+ci+'/DCR')];
          else if(c.tab==='tabServ') ks=['sv/minr'];
          else if(c.tab==='tabDetail') ks=['dt/'+c.id+'.cmp']; }
        ks=ks.map(function(k){ return 'cap:'+k; });
        ks=ks.concat(ks.length?['cap:omit-'+ks[0].slice(4).split('/')[0]]:[],c.tab?['cbro:cap:'+c.tab]:[]);
        var det=it.text+(it.cond&&it.dc?'; '+it.dc+(it.within?' (the ratio is within its limit; the status comes from the condition)':''):'');
        rows.push(row(it.name,it.cond||it.dc,it.st,det,it.ref,ks)); });
      add('Beam Capacity',rows,msg?msg.replace('the output panel','the Beam Capacity tab’s output panel'):null,msg?null:'Result: the D/C, or, where a limit or condition is not met, that condition (its D/C is under Detail). Every load combination is enveloped; the tables by combination are in the Beam Capacity chapter ([[cbro:cap:tabSummary]]).');
    })();
    /* B. ASD Beam Calcs */
    (function(){ var w=win('asd'), its=null, rows=[], msg=null;
      try{ its=w.asdDashItems(); }catch(e){ its=null; }
      if(!its) msg='No results: the ASD Beam Calcs tab has not finished loading, or its inputs need correcting.';
      else its.forEach(function(it){ var ks=[];
        if(it.card==='anRF') ks=[/^Inventory/.test(it.name)?'asd:an/inv.RF':'asd:an/op.RF'];
        ks.push('cbro:asd:'+(it.tab||'tabAnalysis'));
        rows.push(row(it.name,it.short,it.st,it.text,it.ref,ks)); });
      add('ASD Beam Calcs',rows,msg,msg?null:'Result: the rating factor RF (PASS when RF ≥ 1.00), or the condition of a REVIEW notice.');
    })();
    /* C. Development & Splice: the lines of its check summary panel as shown (the dashboard's checks; RBDC) */
    (function(){ var w=win('dev'), rows=[], msg=null, f=null, CK={tLd:'td/ld',hLdh:'hk/ldh',cLdc:'cd/ldc',tsLen:'ts/lst',tsClassA:'ts/clsA',tConf:'td/ktrHS',csLen:'cs/lsc'};
      var CT={tLd:'tension',tConf:'tension',tConfA:'tension',hLdh:'hook',cLdc:'compression',tsLen:'tsplice',tsClassA:'tsplice',csLen:'csplice'};   /* card -> tab (REBAR_CARDS) */
      var NK=[['(c_b+K_tr)/d_b',['td/cbKtr']],['ψ_t·ψ_e',['td/psiTE']],['λ_rl·λ_cf',['td/rlcf']],['λ_rc',['td/lrc','td/ldcalc']],['K_tr ≥ 0.5d_b',['td/ktrHS','td/Ktr']]];   /* the step that works a limit line */
      try{ f=w.computeFactors(w.readInputs());
        [].slice.call(w.document.querySelectorAll('#rbrDash .rbrdCh')).forEach(function(c){
          var q=function(s){ var e=c.querySelector(s); return e?e.textContent:''; };
          var name=q('.rbrdN'), short=q('.rbrdR'), S=q('.rbrdS'), V=q('.rbrdV'), val=V.indexOf(name+': ')===0?V.slice(name.length+2).replace(/ \(information\)$/,''):V;
          var st={PASS:'pass',FAIL:'fail',REVIEW:'warn',INFO:'info'}[S]||'na', m=w.rbrDashMeta(name,f,val)||{}, ks=[];
          NK.forEach(function(x){ if(name.indexOf(x[0])===0) ks=ks.concat(x[1]); });
          if(m.card&&CK[m.card]) ks.push(CK[m.card]);
          ks=ks.map(function(k){ return 'dev:'+k; }).concat(['cbro:dev:'+(CT[m.card]||m.tab||'sum')]);
          rows.push(row(name,short,st,short!==val?val:'',m.ref,ks)); });
      }catch(e){ rows=[]; }
      if(!rows.length) msg='No results: the Development & Splice tab has not finished loading.';
      add('Development & Splice',rows,msg,msg?null:'INFO: a required length, or a code limit applied in the calculation (not a check). Lengths are required lengths: compare them with the lengths detailed.');
    })();
    return {title:'Summary of results',key:'cbro:sum',note:tot.join(' · ')+'.',subs:subs,_ch:'sum'};
  }
  /* each summary line links to the first of its keys found in the report (the step, else an omitted combination's note,
     else the tab's section); a line with none keeps its reference as plain text */
  function cbroKeys(M){
    var D=null; try{ D=SharedReport.build(M); }catch(e){ return; }
    M.sections[0].subs.forEach(function(q){ (q.items||[]).forEach(function(it){ if(it.type!=='table') return;
      it.rows.forEach(function(r){ var c=r[4]; if(!c||!c._k) return; var h=c._k.filter(function(k){ return D.index.has(k); })[0]; delete c._k; if(h) c.key=h; }); }); });
  }
```

   CBOV (2026-11-05): the figures of the overview at the start of the suite's Report (the shell's cbovSection): the
   cross-section of the Input Echo / Visuals tabs (svgSection, the governing sense of bending) and the stirrup elevation
   (svgElevation), each with a scale bar added below it (one scale across and up: CBOV.sec / CBOV.elev, recorded by those
   functions), and a snapshot of the Visuals tab's 3-D view (cbc3DScene, the same scene) rendered once more off screen at
   the view's start camera with every layer on. Display only; nothing is saved (the snapshot is cached in memory until
   the inputs change). The Include box is S.ui.rptOpts.ov (cbcRxSel / cbcRxSet; absent = on).
   ===================================================================== */
/* a scale bar under an svg string drawn at sc px per in, viewBox 0 0 W H: the box grows by 34 px */
function cbcOvBar(svg,d){
  if(!svg||!d||!(d.sc>0)) return svg;
  const want=d.W*0.22/d.sc, L=[1,2,3,4,6,12,18,24,36,48,60,96,120].filter(x=>x<=want).pop()||1, w=L*d.sc, x0=12, y=d.H+14;
  const lab=L%12===0?(L/12)+' ft ('+L+' in)':L+' in';
  let b='<g font-family="Arial,Helvetica,sans-serif" font-size="9" fill="#0F172A">';
  b+='<rect x="'+x0+'" y="'+y+'" width="'+(w/2)+'" height="5" fill="#0F172A"/><rect x="'+(x0+w/2)+'" y="'+y+'" width="'+(w/2)+'" height="5" fill="#fff" stroke="#0F172A" stroke-width="0.8"/>';
  b+='<rect x="'+x0+'" y="'+y+'" width="'+w+'" height="5" fill="none" stroke="#0F172A" stroke-width="0.8"/>';
  b+='<text x="'+x0+'" y="'+(y+15)+'">0</text><text x="'+(x0+w)+'" y="'+(y+15)+'" text-anchor="middle">'+lab+'</text>';
  b+='<text x="'+(x0+w+28)+'" y="'+(y+6)+'">scale bar: the drawing is to scale, the same scale across and up</text></g>';
  return svg.replace('viewBox="0 0 '+d.W+' '+d.H+'"','viewBox="0 0 '+d.W+' '+(d.H+34)+'"').replace(/<\/svg>\s*$/,b+'</svg>');
}
function cbcOvSnap3D(neg){
  if(!window.THREE) return {note:'three.js could not be loaded from its CDN, so the 3-D view is not included.'};
  const key=JSON.stringify([S.sec,S.layers,S.stir,S.cover,S.layerClear,neg]);
  if(CBOV.snapKey===key&&CBOV.snap) return CBOV.snap;
  let out, R=null;
  try{
    const cv=document.createElement('canvas'), W=1000, H=600;
    R=new THREE.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true});
    R.setSize(W,H,false); R.setClearColor(0xffffff);
    const {scene,Lb}=cbc3DScene(neg,0.45,{}), h=S.sec.h;
    const cam=new THREE.PerspectiveCamera(40,W/H,1,4000), r=Math.max(Lb,h)*1.15, t=0.7, p=0.35;   /* the 3-D view's start angles (VIS3D defaults), closer than its start distance (1.7) so the beam fills the image */
    cam.position.set(r*Math.cos(p)*Math.sin(t), r*Math.sin(p), r*Math.cos(p)*Math.cos(t)); cam.lookAt(0,0,0);
    R.render(scene,cam);
    const url=cv.toDataURL('image/png');
    out=(url.length>6000)?{url,W,H,Lb}:{note:'the 3-D view rendered blank (WebGL not available in this browser), so it is not included.'};
  }catch(e){ out={note:'WebGL is not available in this browser, so the 3-D view is not included.'}; }
  finally{ try{ if(R){ R.dispose(); if(R.forceContextLoss) R.forceContextLoss(); } }catch(e){} }
  CBOV.snap=out; CBOV.snapKey=key; return out;
}
function cbcOvFigs(){
  if(!CC||!CC.combos||!CC.combos.length) return null;
  if(VALIDATION&&VALIDATION.blockers&&VALIDATION.blockers.length) return {blocked:true};   /* as the check summary panel: no drawing from invalid input */
  const neg=CC.govRow?CC.govRow.neg:false, P=S.sec;
  CBOV.sec=null; CBOV.elev=null;
  const sec=cbcOvBar(svgSection(neg),CBOV.sec), e=svgElevation(), elev=e?cbcOvBar(e,CBOV.elev):null;
  return {neg,tee:P.type==='tee',bw:P.bw,h:P.h,bf:P.bf,hf:P.hf,sec,elev,stir:!!S.stir.present,s:S.stir.s,snap:cbcOvSnap3D(neg),
    gov:CC.govRow?'Combination '+(CC.govRow.ci+1)+' ('+CC.govRow.name+')':''};
}
```
#### Code added — shell
```js
  /* ---------- CBOV (2026-11-05): "Overview of the beam", the Report's section 2, after the Summary of results (as Spread
     Footing SFOV #780): the cross-section with its reinforcement and dimensions, the stirrup elevation (each to scale, with a
     scale bar) and a snapshot of the Visuals tab's 3-D view, from the Beam Capacity tab (cbcOvFigs). Include box "Overview
     figures" on the report bar (the tab's S.ui.rptOpts.ov, default on); off, the section stays as one line, so the numbers
     after it do not move. Display only. ---------- */
  var CBOV_N=0;
  function cbovUniq(svg){   /* the copies get their own ids (marker / gradient references resolve inside the copy, also in print) */
    var n=++CBOV_N, ids=[]; String(svg).replace(/\sid="([^"]+)"/g,function(m,id){ ids.push(id); return m; });
    ids.forEach(function(id){ var e=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      svg=svg.replace(new RegExp('id="'+e+'"','g'),'id="'+id+'-ov'+n+'"').replace(new RegExp('url\\(#'+e+'\\)','g'),'url(#'+id+'-ov'+n+')').replace(new RegExp('href="#'+e+'"','g'),'href="#'+id+'-ov'+n+'"'); });
    return svg;
  }
  function cbovSection(){
    var S0={title:'Overview of the beam',key:'cbov',_ch:'ov',subs:[]}, c=RXCH[0], sl=rxFn(c,'Sel'), on=true, w=win('capacity'), F=null;
    try{ on=!sl||sl().ov!==false; }catch(e){}
    if(!on){ S0.note='Not included in this report: the Include box “Overview figures” on the report bar is off.'; return S0; }
    try{ F=w&&typeof w.cbcOvFigs==='function'?w.cbcOvFigs():null; }catch(e){ F=null; }
    if(!F){ S0.note='No overview: the Beam Capacity tab has no results (it has not finished loading, or its inputs need correcting).'; return S0; }
    if(F.blocked){ S0.note='No overview: input invalid on the Beam Capacity tab (see its output panel), so the beam is not drawn.'; return S0; }
    var f2=function(x){ return (Math.round(x*100)/100).toFixed(2); };
    var dims='$b_{w}$ × h = '+f2(F.bw)+' × '+f2(F.h)+' in'+(F.tee?', $b_{f}$ × $h_{f}$ = '+f2(F.bf)+' × '+f2(F.hf)+' in (T-beam)':'');
    var sense=F.neg?'negative moment, top face in tension':'positive moment, bottom face in tension';
    S0.note='The beam as entered on the Beam Capacity tab, for orientation; the checks are worked in the chapters below.';
    S0.subs.push({title:'Cross-section',items:[{type:'figure',svg:cbovUniq(F.sec).replace('<svg ','<svg style="max-width:420px" '),caption:'Cross-section, '+dims+': reinforcement as entered, to scale (scale bar), for the governing sense of bending ('+sense+(F.gov?'; '+F.gov:'')+'). Dimensions in inches; d of each layer from the extreme compression fibre. Inputs: [[cbro:cap:tabInputEcho]]. [[tab:cap/tabInputEcho|On screen: Input Echo tab]]'}]});
    S0.subs.push({title:'Elevation',items:F.elev?[{type:'figure',svg:cbovUniq(F.elev),caption:'Elevation of a short run of the beam: closed stirrups at s = '+f2(F.s)+' in, to scale (scale bar); the green band is the permitted spacing range (s_max; Detailing: [[cbro:cap:tabDetail]]). [[tab:cap/tabInputEcho|On screen: Input Echo tab]]'}]
      :[{type:'note',text:'No elevation: '+(F.stir?'no results.':'the section has no stirrups (transverse reinforcement), so there is no stirrup layout to draw.')}]});
    var P=F.snap||{};
    S0.subs.push({title:'3-D view',items:P.url?[{type:'figure',svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+P.W+' '+P.H+'"><image href="'+P.url+'" x="0" y="0" width="'+P.W+'" height="'+P.H+'"/></svg>',
        caption:'3-D view of the Visuals tab at its start angles (closer in): every layer on (concrete 45 % opaque, tension bars red, compression bars blue, stirrups grey). The length shown ('+Math.round(P.Lb)+' in) is illustrative: the tool checks a cross-section, not a span. [[tab:cap/tabVisuals|On screen: Visuals tab]]'}]
      :[{type:'note',text:'3-D view not included: '+(P.note||'it could not be rendered.')+' The cross-section above shows the same reinforcement to scale.'}]});
    return S0;
  }
```
=======
## 2026-11-05 — PR: claude/cbc-p3-inputs, PR #794: https://github.com/mlococo88/All-Structural/pull/794 (Phase 3 input layout: CBIE / ASIE required inputs marked, "Input error: no results" instead of NaN; RBCM inputs by code mode in Development & Splice; RBIE required inputs in Development & Splice; §6 links on the Visuals captions and the ASD "From Beam Capacity" table)   [behaviour change: when results are shown; no formula change]

Engineer request (2026-11-05, Phase 3 of the concrete beam suite update, display / workflow only). The edits to the Development & Splice frame are the same as in `ACI Rebar Development Length.html` (CLAUDE.md §3) and are logged in full in `fixlog/ACI Rebar Development Length.md` (RBCM, RBIE). Results are unchanged whenever the inputs are valid.

### CBIE. Beam Capacity frame: required inputs   [behaviour change: when results are shown]
- **Problem:** a blank number box is stored as 0 (`numIn`: `set(isNaN(v)?0:v)`). For f′c, f_y, f_yt and λ this was not a blocker. The tab showed results built on 0. Default section, M_u 60 / V_u 20:
  - f′c = 0: D/C = ∞ for shear and torsion, "9 NG";
  - f_y = 0: φM_n = 0;
  - f_yt = 0: combined V+T D/C = ∞;
  - λ = 0: V_c = 0.
  
  The browser console also reported NaN SVG coordinates. A blank b_w was a blocker, but the box was not marked, and the warning "h/b_w = — is unusually slender" was shown beside the blocker.
- **Where (Beam Capacity srcdoc page):**
  - `validate()`, after `if(bw<=0||h<=0) B.push({code:"Geometry",msg:"Beam width and depth must be positive."});`, four new blockers with code "Materials":
    ```js
    if(!(fc>0)) B.push({code:"Materials",msg:"Concrete strength f′c must be greater than 0."});
    if(!(fy>0)) B.push({code:"Materials",msg:"Yield strength f_y must be greater than 0."});
    if(!(S.mat.fyt>0)) B.push({code:"Materials",msg:"Transverse yield strength f_yt must be greater than 0."});
    if(!(S.mat.lambda>0)) B.push({code:"Materials",msg:"λ must be greater than 0 (1.0 for normal-weight concrete)."});
    ```
  - `validate()`: changed `if(h/bw>6) W.push({code:"Proportion",` to `if(bw>0&&h>0&&h/bw>6) W.push({code:"Proportion",`. This changes only the warning list while a geometry blocker stands.
  - `RCB_IN_BLOCK`: added `[b=>b.code==='Materials','inMat']`, so the Materials & Cover input tab gets the red dot.
  - `buildInput()`: before `rcbInputTabs(P);`, added `cbcInputMarks(P);`. New functions `cbcInputErrs()` and `cbcInputMarks(P)` follow `buildInput()` (anchor `/* CBIE (2026-11-05, engineer)`).
    - They check, field by field, the input blockers of `validate()`: b_w, h, b_f and h_f (T-beam), f′c, f_y, f_yt, λ, stirrup spacing s (stirrups present) and each layer depth d.
    - A failing box gets class `cbcInErr` and `aria-invalid`. Its reason goes in a `div.cbcInErrMsg` under the row (under the layer table for a layer depth).
    - `validate()` still decides whether results are withheld.
  - CSS, end of the first `<style>`: `#inputPanel input.cbcInErr{…}`, `.cbcInErrMsg{…}`, and `@media print{.cbcInErrMsg{display:none}}`.
  - `cbcDashRender()` (CBDC check summary panel), while blocked:
    - before: "Input invalid: output withheld. See the message in the output panel." with the count "input invalid";
    - after: "Input error: no results. <the blocker messages> Correct the marked inputs." with the count "input error".
  - Torsion input card note: "T_u is entered per load combination below." is now "… on the Loads tab." The combinations are on another input tab.
- **Check case:** default project, f′c = 0. Before: results shown with D/C = ∞, "9 NG". After: status "INPUT INVALID", output "Output withheld — Materials — Concrete strength f′c must be greater than 0.", panel "Input error: no results. …", f′c box outlined with "f′c must be greater than 0." under it, red dot on Materials & Cover. f_y, f_yt, λ = 0: the same, each with its own message. b_w = 0: the box is now marked "Web width b_w must be greater than 0." and the slender warning is gone. Valid inputs: no change.

### ASIE. ASD Beam Calcs frame: allowables required; §6 link back to Beam Capacity   [behaviour change: when results are shown]
- **Problem:** a blank allowable stress (f_c,inv, f_s,inv, f_c,op, f_s,op) was stored as 0. That gave M = 0 and a negative rating factor with no error. The "From Beam Capacity" table (d, A_s) did not link to the place where those values are worked (audit item 9).
- **Where (ASD srcdoc page):**
  - `asdInputErrors()` is renamed `asdInheritErrors()`, with the body unchanged (the inherited f′c, f_y, d and b checks).
  - New `asdAllowErrs()` checks the levels shown (`S.mode.inv`, `S.mode.op`): each allowable must be > 0.
  - New `asdInputMarks(b)`.
  - The new `asdInputErrors()` is `asdInheritErrors().concat(asdAllowErrs().map(x=>x[1]))`, so `compute()` returns `{errors}` for both kinds.
  - The "From Beam Capacity" card's error box now uses `asdInheritErrors()`. The Allowable Stresses card calls `asdInputMarks(b)` after the Recompute button: red outline plus `.asdInErrMsg`.
  - `asdInputTabMarks()` also marks `.asdInErrMsg`.
  - Messages:
    - output error box: "Correct the value in the Beam Capacity tab." or, for an allowable, "Correct the marked input on the Allowables tab.";
    - status chip tooltip: "No results: an input is blank or zero.";
    - check summary panel: "Input error: no results. <messages> …".
  - §6 link: in the suite (`window.parent!==window`), under the table there is a line "Worked in: d, A_s → Beam Capacity · Flexure · Section Flexural Capacity — Positive & Negative (f′c, f_y, b, h: Beam Capacity inputs)". A click posts `{type:'cbcGoto',tab:'tabFlex',card:'flexBoth'}` to the shell.
- **Shell:** the message filter `if(d.type==='cbcGoto' && e.source!==src('suite-frame-dev')) return;` also accepts the ASD frame: `… && e.source!==src('suite-frame-asd')) return;`. The shell then shows the Beam Capacity tab and relays the message as for the Development & Splice links (CBAR-1). The card `flexBoth` tabulates d and A_s for both senses.
- **Check case:** default project with f_s,op typed as 0. Before: RF_op from M_op = 0 (negative), no error. After: "Input error — no results. Operating steel allowable f_s,op must be greater than 0." in the output and the panel, the box marked, a red dot on Allowables, and the Report "Input error, no results: …". A click on the link opens Beam Capacity · Flexure with that card (checked headless: active suite tab "capacity", `S.ui.tab` "tabFlex").

### CBIE §6 links on the Visuals tab   [display only]
`cbcWorkedIn` lines added under the captions:
- Cross-section schematic: "d, A_s → Flexure · Combination k".
- Strain diagram: "c, ε_t, f_s → Flexure · Combination k". k is the combination chosen in the Visuals selector (`S.ui.detailCombo`).
- Stirrup elevation: "s_max → Detailing · Maximum stirrup spacing", or "… · Maximum closed-stirrup spacing for torsion" when `govSmaxInfo()` names torsion.
- D/C chart: "D/C → Summary · All Combinations × Limit States".

### Input placement review (all three frames)   [Decision (pending engineer review)]
- Reviewed each input tab at 1600 and 390 px. Units stay on their line in every frame. In Development & Splice the two wide optional boxes (bar c-c spacing, bend radius R) are 150 px on screens up to 600 px wide (RBIE CSS), so their label and unit no longer clip.
- Decision (pending engineer review): no input was moved between tabs.
  - Beam Capacity: Section / Materials & Cover / Reinforcement / Checks (torsion with A_ℓ, crack control) / Loads / Assumptions.
  - ASD: Mode & Section / Allowables / Loads.
  - Development & Splice: the development options sit together. Tension holds the factors, confinement and excess reinforcement; Hook & Comp. holds the hook and compression factors; Splices holds the splices.
  - Only two cross-references were corrected: the torsion note now points to the Loads tab, and the Splices hint now names "Excess Reinforcement panel (D2, Tension tab)".
- Decision (pending engineer review): the Beam Capacity Design Code stays in the header project grid, as in the ASD frame, rather than moving to an input tab. It governs every tab.
- Decision (pending engineer review): λ is blocked only at ≤ 0. A value above 1.0 or below 0.75 is still accepted as before. Should the code range (ACI Table 19.2.4.2, AASHTO 5.4.2.8) be a blocker?

### Saved data, verification
- **Saved data:** no key or format changed. The hidden inputs keep their values and are saved as before.
- **How verified:**
  - Headless Chromium, origin/main (after #793) vs branch, 5 cases (default, AASHTO f_yt 100, ACI with torsion, excess reinforcement ACI and AASHTO), for the suite and the standalone ACI Rebar tool:
    - `computeAll()`, `allChecks()`, `cbcRptModel()`, `asdRptModel()`, the Dev calculations and `rbrModel()` are identical;
    - the tab text differs only by the new "Worked in" lines;
    - 0 console errors.
  - The invalid cases above were probed headless. A suite Report with blocked inputs shows "No results" and no NaN.
  - `node tests/check-syntax.mjs`, `node tests/smoke/phone-layout.mjs --tool cbc,aci` and `node tests/smoke/project-library.mjs` pass.
  - Screenshots looked at: Dev Tension and Hook & Comp. tabs in ACI and AASHTO at 1600 and 390 px; the error states in all three frames; the Visuals captions; the ASD link.

## 2026-11-05 — PR: claude/cbc-report-overview, PR #795: https://github.com/mlococo88/All-Structural/pull/795 (CBOV: "Overview of the beam" at the start of the suite Report — cross-section, stirrup elevation, 3-D snapshot; Include box "Overview figures"; display only, no result change)

### CBOV. Overview figures   [display only] [no result change]
- **Engineer request (2026-11-05, Phase 4 part 2):** an overview at the start of the Report, as Spread Footing SFOV #780. It shows the beam cross-section with reinforcement and dimensions, an elevation, and a 3-D snapshot of the existing 3-D view (with a fallback note when WebGL or three.js is not available). Include box "Overview figures", default on, saved like the other report options.
- **Placement:** §2 "Overview of the beam" (key `cbov`), after §1 Summary of results (CBRO #793) and before chapter A.
  - 2.1 Cross-section: the Input Echo / Visuals tab's `svgSection` for the governing sense of bending (`CC.govRow.neg`), with a scale bar.
  - 2.2 Elevation: `svgElevation` (stirrups at s, s_max band), with a scale bar. A section without stirrups gets a note instead.
  - 2.3 3-D view: a PNG snapshot. If three.js or WebGL is not available, a note replaces it.
- **Beam Capacity frame (`#suite-frame-capacity` srcdoc; decoded and re-encoded with CRLF kept):**
  - `svgSection`, before its `return s;`: `CBOV.sec={W,H,sc};` (the drawing scale in px/in). `svgElevation` the same with `CBOV.elev`. The drawings are unchanged.
  - `var CBOV=…` after `let VIS3D=…`.
  - `build3D`: the scene construction (lights, concrete, bars, stirrups) moved unchanged into the new `cbc3DScene(neg,opacity,mats)`. The only difference: the layer materials go to `mats` (`build3D` passes `VIS3D.layerMats`). `build3D` keeps its renderer, camera, controls and loop.
    - Before: `const scene=new THREE.Scene(); scene.add(…lights); const cam=…; if(VIS3D.r==null)…; /* groups */ … scene.add(gConc,gTen,gComp,gStir);`
    - After: `const cam=…; if(VIS3D.r==null)…; VIS3D.layerMats={}; const {scene,gConc,gTen,gComp,gStir,mConc}=cbc3DScene(neg,VIS3D.opacity,VIS3D.layerMats);`
  - `cbcRxSel`: `r.ov=!(o&&o.ov===false);`. `cbcRxSet`: kind `"ov"` sets `o.ov`, and "Select all" sets `o.ov=true`.
  - New `cbcOvBar`, `cbcOvSnap3D`, `cbcOvFigs` (before `function cbcRxHarvest(){`; code below).
    - With an input blocker, `cbcOvFigs` returns `{blocked:true}` and nothing is drawn, as the check panel.
    - The 3-D snapshot: a second WebGLRenderer (1000 × 600, `preserveDrawingBuffer`), the same scene, the view's start angles (θ 0.7, φ 0.35) at 1.15 × max(L, h) instead of 1.7 so the beam fills the image, every layer on, concrete 45 % opaque. The renderer is disposed after the render. The snapshot is cached until the section, bars, stirrups or cover change. A blank image (data URL under 6000 characters) or an exception gives the note.
- **Shell:** new `cbovUniq` (each copy's ids and `url(#…)` references get a suffix) and `cbovSection()`, before the Summary block. `cbroOrder`: `M.sections=[cbroSum(),cbovSection()].concat(…)`. `rxControls`: "Report: ☑ Overview figures" first on the report bar (`data-cbrx="cap|ov|"`).
- **Scale bars:** 1, 2, 3, 4, 6, 12 … in, about 22 % of the drawing width. Both drawings use one scale across and up (`svgSection`: `sc=min(…)` for both axes; `svgElevation` likewise). Default: section 6 in, elevation 1 ft. Checked on the PDF: the 6 in bar is half of the b_w = 12 in face.
- **Saved data:** new optional field `S.ui.rptOpts.ov` (boolean) of the Beam Capacity tab. It is written only by the Include box (and "Select all"), through `normRptOpts()` / `autosave()` like the other boxes, so it is kept in `rcbeam_v2_auto`, the saved projects and the JSON export. A save without the field reads as on (`o.ov===false` is the only "off"), so no migration is needed. No key or existing field changed.
- **Numbering:** with the box off, §2 stays as one line ("Not included in this report: …"), so §3 onward do not move.
- **How verified (headless Chromium, origin/main 77eb777 vs branch):**
  - Cases default, c2, c3, Include boxes off (with Overview off), input blocker, no stirrups / no torsion. In every case:
    - Beam Capacity `CC`, ASD `CC` and Development & Splice results identical;
    - localStorage identical and unchanged by the Report;
    - every line of main's Report text (screen and print) present;
    - added lines: the overview only;
    - 0 unresolved references, 0 console errors.
  - three.js blocked: the note replaces the 3-D figure, and the other figures remain.
  - Visuals tab: text identical to main; the 3-D canvas renders (884 × 380), with 2 layer materials for the highlight.
  - Include box: unticked → §2 one line, `rptOpts.ov=false` in `rcbeam_v2_auto`; after a reload the box stays off.
  - Printed PDF of the default project looked at (44 pages, main 42): p. 5 cross-section and elevation with scale bars, p. 6 the 3-D snapshot.
  - `check-syntax`, `run.mjs report steps steps-groups report-wiring` (14 passed), `phone-layout --tool cbc`, `project-library` pass.
- **Governing provision:** none. **Other copies:** none.

#### Code added — Beam Capacity frame
```js
/* CBOV (2026-11-05): the 3-D scene of the Visuals tab (concrete, longitudinal bars at their positions, closed stirrups at s),
   moved out of build3D unchanged so the Report's overview can render the same scene once more off screen (cbcOvSnap3D).
   mats: an object that receives each layer's material by layer index (build3D: VIS3D.layerMats, for the linked highlight). */
function cbc3DScene(neg,opacity,mats){
  const {bw,h,bf,hf,type}=S.sec, tee=type==='tee';
  const Lb=Math.max(4*h,48);                           /* illustrative length */
  const scene=new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff,0.75));
  const dl=new THREE.DirectionalLight(0xffffff,0.7); dl.position.set(60,120,90); scene.add(dl);
  /* groups */
  const gConc=new THREE.Group(),gTen=new THREE.Group(),gComp=new THREE.Group(),gStir=new THREE.Group();
  const mConc=new THREE.MeshLambertMaterial({color:0xcfcabb,transparent:true,opacity:opacity});
  const mStir=new THREE.MeshLambertMaterial({color:0x64748b});
  /* concrete: y measured up; section top at +h/2 */
  if(tee){
    const web=new THREE.Mesh(new THREE.BoxGeometry(bw,h-hf,Lb),mConc);
    web.position.y=-hf/2; gConc.add(web);
    const fl=new THREE.Mesh(new THREE.BoxGeometry(bf,hf,Lb),mConc);
    fl.position.y=(h-hf)/2; gConc.add(fl);
  } else gConc.add(new THREE.Mesh(new THREE.BoxGeometry(bw,h,Lb),mConc));
  /* longitudinal bars at physical positions */
  const G=layerGeom(neg);
  G.forEach(L=>{
    const geo=new THREE.CylinderGeometry(L.db/2,L.db/2,Lb,12);
    const mat=new THREE.MeshLambertMaterial({color:L.side==='T'?0xb91c1c:0x1d4ed8});
    mats[String(L.i)]=mat;
    barXs(L.n,L.db).forEach(x=>{
      const m=new THREE.Mesh(geo,mat);
      m.rotation.x=Math.PI/2;
      m.position.set(x,h/2-L.yTop,0);
      (L.side==='T'?gTen:gComp).add(m);
    });
  });
  /* stirrups: four thin box segments forming the closed hoop, at spacing s */
  if(S.stir.present){
    const cc=S.cover.cc, ds=stirDia();
    const sx=bw-2*cc-ds, sy=h-2*cc-ds, t=ds;
    const nS=Math.max(1,Math.floor(Lb/S.stir.s));
    for(let i=0;i<=nS;i++){
      const z=-Lb/2+ (Lb-(nS)*S.stir.s)/2 + i*S.stir.s;
      if(z>Lb/2) break;
      const hoop=new THREE.Group();
      const seg=(w,hh,px,py)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,hh,t),mStir);
        m.position.set(px,py,z); hoop.add(m); };
      seg(sx+t,t,0, sy/2); seg(sx+t,t,0,-sy/2);
      seg(t,sy+t,-sx/2,0); seg(t,sy+t, sx/2,0);
      gStir.add(hoop);
    }
  }
  scene.add(gConc,gTen,gComp,gStir);
  return {scene,gConc,gTen,gComp,gStir,mConc,Lb};
}
```
```js
/* ==============================================================
## 2026-11-05 — PR: claude/cbc-lambda-excess, PR #796: https://github.com/mlococo88/All-Structural/pull/796 (CBLM / RBLM: λ outside the code range is an input error; RBXS: A_s,req, A_s,prov and "From Beam Capacity" hidden while the excess box is unticked)   [behaviour change: when results are shown; no formula change]

Engineer request (2026-11-05, follow-up to the open questions of #794). The Development & Splice edits are the same as in `ACI Rebar Development Length.html` and are logged there in full (RBLM, RBXS).

### CBLM. Beam Capacity: λ within the code range   [behaviour change: when results are shown]   Decision (pending engineer review)
- **Ranges checked in the PDFs:**
  - ACI 318-19 19.2.4.1 (printed p. 357), Tables 19.2.4.1(a)/(b): λ from 0.75 to 1.0; 19.2.4.3: 1.0 for normalweight concrete.
  - AASHTO LRFD 10th Ed. 5.4.2.8 (p. 5-23): Eq. 5.4.2.8-1 (from f_ct) gives λ ≤ 1.0 with no lower bound; Eq. 5.4.2.8-2 (from w_c) gives 0.75 ≤ λ ≤ 1.0; λ = 1.0 for normal weight concrete.
  - Note: the coordinator's brief cited "Table 19.2.4.2"; 318-19 has Tables 19.2.4.1(a) and (b).
- **Where (Beam Capacity srcdoc page):**
  - `validate()`. Before: `if(!(S.mat.lambda>0)) B.push({code:"Materials",msg:"λ must be greater than 0 (1.0 for normal-weight concrete)."});` After: `if(!cbcLamOk()) B.push({code:"Materials",msg:cbcLamMsg()});`, with a CBLM comment.
  - `cbcInputErrs()`. Before: `if(!(M.lambda>0)) E.push(['lam','…']);` After: `if(!cbcLamOk()) E.push(['lam',cbcLamMsg()]);`.
  - New, before `function cbcInputMarks(P){`:
    ```js
    function cbcLamOk(){ const l=S.mat.lambda; return S.code==='ACI'?(l>=0.75&&l<=1.0):(l>0&&l<=1.0); }
    function cbcLamMsg(){ … }   // ACI: "between 0.75 and 1.0 (ACI 318-19 19.2.4.1, Tables 19.2.4.1(a)/(b); …)"; AASHTO: "greater than 0 and not more than 1.0 (AASHTO LRFD 10th Ed. 5.4.2.8; …)"
    ```
- **Check case:**

  | Code | λ | Before | After |
  |---|---|---|---|
  | ACI | 0.70 | results with λ = 0.70 | input error |
  | ACI | 1.10 | results with λ = 1.10 (unconservative) | input error |
  | ACI | 0.75, 0.85, 1.0 | results | unchanged |
  | AASHTO | 1.05 | results | input error |
  | AASHTO | 0 | input error | input error |
  | AASHTO | 0.6 (Eq. 5.4.2.8-1) | results | unchanged |
- **Decision (pending engineer review):** in AASHTO mode λ below 0.75 is accepted in Beam Capacity, where λ enters directly, because Eq. 5.4.2.8-1 permits it. Development & Splice still errors below 0.75 (see RBLM).

### RBLM / RBXS (Development & Splice frame)   Decision (pending engineer review)
See `fixlog/ACI Rebar Development Length.md`. The same edits are in `<iframe id="suite-frame-dev">`.

### Verification
- Headless Chromium, origin/main (after #794) vs branch, 5 cases (default, AASHTO f_yt 100, ACI with torsion, excess reinforcement ACI and AASHTO), suite and standalone: IDENTICAL (calculations, Report models, all tab text), 0 console errors.
- The cases above were probed headless.
- `check-syntax`, `phone-layout --tool cbc,aci` and `project-library` pass.
- Screenshots looked at: Tension input tab with the excess box on and off; the λ error state.

### Open item (raised, not changed)
- The Development & Splice λ hint cites "ACI Table 19.2.4.2" (should be 19.2.4.1(a)/(b)). It also says "AASHTO 5.4.2.8 … 0.75 ≤ λ ≤ 1.0", which is Eq. 5.4.2.8-2 only.
- ACI 318-19 19.2.4.1 says "except as required in Table 25.4.2.5", and that table's λ for development may be narrower than 0.75–1.0. Not checked here.
- Both are code-reference questions for the engineer (§4).

## 2026-11-05 — PR: claude/cbc-lambda-cite, PR #797: https://github.com/mlococo88/All-Structural/pull/797 (RBLC: λ citation corrected to ACI 318-19 19.2.4.1, Tables 19.2.4.1(a)/(b), and AASHTO 5.4.2.8 Eqs. -1 / -2 stated separately; Table 25.4.2.5 checked; text only, no result change)   [code reference (§4); no result change]

Applies to `ACI Rebar Development Length.html` and the Development & Splice frame (`suite-frame-dev`) of `Concrete Beam Capacity.html`, with the same five edits in each. No other "19.2.4.2" appears in `Concrete Beam Capacity.html`: the Beam Capacity and ASD frames and the shell have none.

### RBLC. λ citation   [text only]
- **Provision, checked in the PDF:** ACI 318-19 has no Table 19.2.4.2. Section 19.2.4.1 (printed p. 357) gives λ by Table 19.2.4.1(a) (from w_c) or Table 19.2.4.1(b) (from the aggregates), both 0.75 to 1.0. AASHTO LRFD 10th Ed. 5.4.2.8 (p. 5-23):
  - Eq. 5.4.2.8-1, λ = 4.7f_ct/√f′c ≤ 1.0 where f_ct is specified (no lower bound);
  - Eq. 5.4.2.8-2, 0.75 ≤ λ = 7.5w_c ≤ 1.0.
- **Before → after (anchor text):**
  1. `readInputs()` comment: `(ACI Table 19.2.4.2 / AASHTO 5.4.2.8); 0.75-1.0` → `(ACI 318-19 19.2.4.1, Tables 19.2.4.1(a)/(b) / AASHTO 5.4.2.8); 0.75-1.0`.
  2. `computeFactors()` comment: `limited to 0.75-1.0 (ACI 318-19 Table 19.2.4.2 / 19.2.4.1;` → `limited to 0.75-1.0 (ACI 318-19 19.2.4.1, Tables 19.2.4.1(a)/(b);`.
  3. λ input hint.
     - Before: `ACI Table 19.2.4.2: all-lightweight 0.75, sand-lightweight 0.85 (or 19.2.4.1 from w<sub>c</sub>). AASHTO 5.4.2.8: 4.7f<sub>ct</sub>/&radic;f'<sub>c</sub> or 7.5w<sub>c</sub>, 0.75 &le; &lambda; &le; 1.0.`
     - After: `ACI 318-19 19.2.4.1: Table 19.2.4.1(a) from the equilibrium density w<sub>c</sub>, or Table 19.2.4.1(b) from the aggregates (all-lightweight 0.75, sand-lightweight 0.85); 0.75 &le; &lambda; &le; 1.0. AASHTO 5.4.2.8: Eq. 5.4.2.8-1 &lambda; = 4.7f<sub>ct</sub>/&radic;f'<sub>c</sub> &le; 1.0 where f<sub>ct</sub> is specified, else Eq. 5.4.2.8-2 0.75 &le; &lambda; = 7.5w<sub>c</sub> &le; 1.0. This tool accepts 0.75 to 1.0.`
  4. `rebarRefs()` ACI row: `(inp.lightweight?"Table 19.2.4.2 (λ); ":"")` → `(inp.lightweight?"19.2.4.1, Tables 19.2.4.1(a)/(b) (λ); ":"")`.
  5. Report step `lam`: `ref:inp.lightweight?'ACI 318-19 Table 19.2.4.2':''` → `ref:inp.lightweight?'ACI 318-19 19.2.4.1, Tables 19.2.4.1(a)/(b)':''`.
- **Check case:** ACI, #8, lightweight, λ = 0.85:
  - l_d = 55.80 in before and after;
  - the Report reference changes from "ACI 318-19 Table 19.2.4.2" to "ACI 318-19 19.2.4.1, Tables 19.2.4.1(a)/(b)".
- **How verified:**
  - Headless Chromium, origin/main (after #796) vs branch: default and AASHTO excess cases IDENTICAL in the suite and the standalone tool.
  - The lightweight case above gives the same l_d, with only the reference text and the hint changed.
  - `check-syntax`, `phone-layout --tool cbc,aci` and `project-library` pass.

### Table 25.4.2.5 checked (open item for the engineer; calculation NOT changed)
- **ACI 318-19 tables (checked in the PDF):** each gives λ = 0.75 for lightweight concrete and 1.0 for normalweight concrete, with no intermediate value.
  - Table 25.4.2.5, straight bars in tension (printed p. 474, PDF p. 476);
  - Table 25.4.3.2, hooked bars (printed p. 475);
  - Table 25.4.9.3, compression (printed p. 487).
- **How this relates to 19.2.4:** 19.2.4.1 opens with "Except as required in Table 25.4.2.5". R25.4.2.5 says the development λ is the same for all types of lightweight concrete.
- **This differs from what the tool does.** In ACI mode the Development frame applies the entered λ from 0.75 to 1.0 to l_d, l_dh and l_dc (`computeFactors`: `lambda = inp.lightweight ? clamp(lwLambda, 0.75, 1.0) : 1.0`). Any λ above 0.75 for lightweight concrete gives a shorter, unconservative length.
- **Example:** #8, f′c 4000 psi, f_y 60 ksi, c_b 1.5 in, ψ = 1.0, λ = 0.85.
  - Tool: l_d = 47.43/0.85 = 55.80 in.
  - Table 25.4.2.5: l_d = 47.43/0.75 = 63.24 in.
  - The tool's length is about 12 % short.
- **AASHTO mode:** 5.10.8.2.1a uses λ of 5.4.2.8, so it is not affected by this ACI table.
- **Not changed (calculation, §4):** the engineer is to decide whether the ACI branch should force λ = 0.75 for lightweight concrete in development lengths.
## 2026-11-05 — PR: claude/cbc-report-figs, PR #798: https://github.com/mlococo88/All-Structural/pull/798 (CBRF: figures and tables found only on a tab moved into the section that works the check; the rest of the "As printed" tab copies moved to an appendix; display only, no result change)

### CBRF. Figures back in their sections, tab copies in an appendix   [display only] [no result change]
- **Engineer request (2026-11-05, Phase 4 part 3; as Spread Footing SFRF #779):** inside each chapter, each figure and each table that appears nowhere else goes in the section that works its check. The "x.4 As printed" copies go to an appendix. Reference-only material goes to the appendix.
- **Where (suite shell only):**
  - `rxRest`: the copy's subsection is tagged.
    - Before: `if(items.length) sec.subs.push({title:'As printed: tables, equations, notes and figures',items:items});`
    - After: the same object with `_rx:{ch:c.id,tab:h.id,label:h.label}`.
  - `rxWalk` `push`: each item records its tab card (`it._card=card`).
  - `model()`: `cbrfMove(M);` after `cbroOrder(M);`.
  - New `CBRF_SUB` and `cbrfMove` (anchor `/* ---------- CBRF (2026-11-05`; code below).
- **Rule:**
  - Every figure of a copy moves, with the note that follows it on the same card (its caption line on the tab).
  - A copied table moves when one of its cells (or the caption) has a number, or a text of more than 15 normalized characters, that the Report outside the tab copies lacks. The comparison uses the same number roundings as `rxRest`. Tables are taken in report order, and a moved table's text counts as shown, so a second copy of the same table stays in the appendix.
  - **Targets:**
    - a "Combination k — …" card → that combination's subsection;
    - Input Echo "Section Schematic" (both figures) and "Reinforcement" → Inputs · Reinforcement; "Load Combinations" → Inputs · Load combinations;
    - Detailing "Detailing Checks" → Detailing checks (envelope);
    - otherwise → a new subsection "Figures and tables from the <tab> tab", before "Results — <tab>".
  - A moved item gets the heading "<card or figure caption> (<tab> tab)", and a figure caption gets " (<tab> tab)".
  - What is left of each copy (notes, equation lines, tables whose values the Report already shows) goes to "Appendix: the tabs as printed": part "Appendices", after the References, one subsection per tab (key `cbrf:ap:<chapter>:<tab>`). Card headings there are renumbered.
  - The section gets a pointer note ("The <tab> tab's other notes, equation lines and tables, as printed: see §x.y"), and each appendix subsection points back to its section.
- **Default project, what moved:**
  - Inputs · Reinforcement: the two Input Echo figures (section schematic, stirrup elevation) with their caption lines.
  - Flexure: "Section Flexural Capacity — Positive & Negative".
  - Shear: Combination 1's card table into 6.1, and "Shear Results — All Combinations".
  - Torsion: "Torsional Results — All Combinations".
  - Summary of checks: the Design Check Summary table (with its "Worked in" column) and "Section Capacities".
  - Kept in the appendix as duplicates of worked sections: Input Echo Reinforcement and Load Combinations; the Flexure layer tables per combination; Flexural Results — All Combinations; the Detailing Checks table; All Combinations × Limit States; the second "Section Flexural Capacity" copy; ASD inputs; Load Rating Summary; Key Parameters. Plus every note and equation line of the copies.
- **Reference-only material:** the copies' notes and equation lines (appendix). The chapters' "About the … chapter" notes were already in References.
- **Decisions (pending engineer review):**
  - The copies' notes and equation lines stay in the appendix rather than being dropped, as Spread Footing.
  - The Development & Splice chapter has no tab copy, so it is unchanged.
  - The elevation keeps the tab's card name ("Section Schematic (to scale) (2)") with its caption line "Stirrup elevation; …".
- **Renamed:** the 11 "As printed: tables, equations, notes and figures" subsections (gone; their content is in the sections and the appendix). The moved headings and captions gain " (<tab> tab)", and their card number is dropped. Nothing removed.
- **Numbering:** the appendix comes last, so the section numbers before it do not depend on what a copy holds. The Include boxes keep the CBRO one-line sections.
- **How verified (headless Chromium, origin/main 2137868 vs branch):**
  - 6 cases: default, c2, c3, Include boxes off, input blocker, no stirrups.
  - Results (`CC` ×2, Development & Splice) and localStorage identical.
  - Report text (screen and print): every line of main is present apart from section / topic numbers, the removed "As printed" subsection titles and the renamed headings / captions (listed above).
  - 0 unresolved references, 0 duplicate keys, 0 console errors.
  - Printed PDF of the default project looked at (47 pages, main 44): the figures on pp. 9–10 in 3.2, the appendix from p. 41.
  - `check-syntax`, `run.mjs report steps steps-groups report-wiring` (14 passed), `phone-layout --tool cbc` pass.
- **Saved data:** none. **Governing provision:** none. **Other copies:** none.

#### Code added (re-apply by hand)
```js
  /* ---------- CBRF (2026-11-05, Phase 4 part 3; as Spread Footing SFRF #779): each tab copy ("As printed: tables, equations,
     notes and figures", rxRest) is split. Its figures, and its tables that hold a value or a text found nowhere else in the
     Report, go into the section that works the check (a combination's card into that combination's subsection; the Input
     Echo's into Reinforcement / Load combinations; the Detailing table into the envelope; the rest into "Figures and tables
     from the <tab> tab" before the Results lines). What is left of the copy (its notes, equation lines and the tables whose
     values the Report already shows) goes to "Appendix: the tabs as printed" after the References, one subsection per tab,
     and the section gets a pointer to it. Display only: items are moved, never changed or dropped. ---------- */
  var CBRF_SUB={cap:{tabInputEcho:[[/^Section Schematic/,'Reinforcement'],[/^Reinforcement/,'Reinforcement'],[/^Load Combinations/,'Load combinations']],tabDetail:[[/^Detailing Checks/,'Detailing checks (envelope)']]}};
  function cbrfMove(M){
    var rx=[]; M.sections.forEach(function(s){ (s.subs||[]).forEach(function(q){ if(q._rx) rx.push({s:s,q:q}); }); });
    if(!rx.length) return;
    var txt=''; try{ txt=SharedReport.text(SharedReport.build({title:M.title,sections:M.sections.map(function(s){ return {title:s.title,note:s.note,subs:(s.subs||[]).filter(function(q){ return !q._rx; })}; })})); }catch(e){ return; }
    var have=new Set(), all=rxNrm(txt);
    var addNum=function(x){ have.add(x); var v=parseFloat(x), d=(x.split('.')[1]||'').length; for(var k=0;k<d;k++) have.add(String(parseFloat(v.toFixed(k)))); };
    rxNums(txt).forEach(addNum);
    var ct=function(c){ return c&&typeof c==='object'?String(c.t==null?'':c.t):String(c==null?'':c); };
    var cells=function(it){ var o=[]; (it.head||[]).forEach(function(c){ o.push(ct(c)); }); (it.rows||[]).forEach(function(r){ (Array.isArray(r)?r:r.cells).forEach(function(c){ o.push(ct(c)); }); }); if(it.caption) o.push(ct(it.caption)); return o; };
    var unique=function(it){ return cells(it).some(function(t){ if(rxNums(t).some(function(n){ return !have.has(n); })) return true; var x=rxNrm(t); return x.length>15&&all.indexOf(x)<0; }); };
    var seen=function(it){ cells(it).forEach(function(t){ rxNums(t).forEach(addNum); all+=rxNrm(t); }); };
    var ap=[];
    rx.forEach(function(R){
      var s=R.s, q=R.q, X=q._rx, lab=X.label, keep=[], tabT=' ('+lab+' tab)', extra=null;
      var target=function(card){
        var m=/^Combination (\d+)\b/.exec(card||''); if(m){ var t=s.subs.filter(function(u){ return u.title.indexOf('Combination '+m[1]+' (')===0; })[0]; if(t) return t; }
        var L=(CBRF_SUB[X.ch]||{})[X.tab]||[]; for(var i=0;i<L.length;i++){ if(L[i][0].test(card||'')){ var nm=L[i][1], u=s.subs.filter(function(v){ return v.title===nm; })[0]; if(u) return u; } }
        if(!extra){ extra={title:'Figures and tables from the '+lab+' tab',items:[]}; var k=-1; s.subs.forEach(function(u,i){ if(k<0&&/^Results — /.test(u.title)) k=i; }); s.subs.splice(k<0?s.subs.length:k,0,extra); }
        return extra;
      };
      var prevFig=null;
      q.items.forEach(function(it){
        if(it.type==='note'&&prevFig&&(it._card||'')===(prevFig._card||'')&&!it.topic){   /* the figure's own caption line on the tab moves with it */
          var cn={}; for(var kk in it) cn[kk]=it[kk]; delete cn._card; prevFig.into.items.push(cn); prevFig=null; return; }
        prevFig=null;
        var mv=it.type==='figure'||(it.type==='table'&&unique(it));
        if(!mv){ keep.push(it); return; }
        if(it.type==='table') seen(it);
        var o={}; for(var k in it) o[k]=it[k]; delete o._card;
        var card=it._card||'';
        if(it.type==='figure') o.caption=(o.caption||card||'Figure')+tabT;
        o.topic={title:(it.type==='figure'?(it.caption||card||'Figure'):(card||'Table'))+tabT};
        var into=target(card); into.items.push(o);
        if(it.type==='figure') prevFig={_card:it._card,into:into};
      });
      s.subs.splice(s.subs.indexOf(q),1);
      if(!keep.length) return;
      /* the copy's topic headings again: the first item left of each card carries it, numbered in the appendix's order */
      var n=0, last=null; keep.forEach(function(it){ var c=it._card||''; delete it.topic; if(c!==last){ last=c; if(c) it.topic={title:c,no:++n}; } delete it._card; });
      var key='cbrf:ap:'+X.ch+':'+X.tab;
      ap.push({title:lab+' tab ('+({cap:'Beam Capacity',asd:'ASD Beam Calcs'}[X.ch]||X.ch)+')',key:key,items:[{type:'note',text:'As printed on the tab: its notes, equation lines and the tables whose values are worked in [['+(s.key||key)+']]. The figures and tables found only on the tab are in that section.'}].concat(keep)});
      s.note=(s.note?s.note+' ':'')+'The '+lab+' tab’s other notes, equation lines and tables, as printed: [['+key+']].';
    });
    rx.forEach(function(R){ if(R.q.items) R.q.items.forEach(function(it){ delete it._card; }); });
    if(ap.length) M.sections.push({part:'Appendices',title:'Appendix: the tabs as printed',key:'cbrf:ap',note:'Text and tables of the Beam Capacity and ASD Beam Calcs tabs as they print, kept for completeness. Every value here is worked, or shown, in the chapter section named at the start of each subsection; figures and tables found only on a tab are in that section.',subs:ap});
  }
```

## 2026-11-05 — PR: claude/cbc-aci-lambda-dev, PR #799: https://github.com/mlococo88/All-Structural/pull/799 (CBLA: ACI development lengths use λ = 0.75 for lightweight concrete per Tables 25.4.2.5 / 25.4.3.2 / 25.4.9.3; CALCULATION CHANGE, ACI mode, lightweight only; less conservative before)

Engineer approval: 2026-11-05, after the Table 25.4.2.5 check (RBLC, #797). This applies to `ACI Rebar Development Length.html` and to the Development & Splice frame (`suite-frame-dev`) of `Concrete Beam Capacity.html`, with the same edits in each.

Not affected:
- the Beam Capacity frame's λ (shear, torsion, 19.2.4);
- AASHTO mode (entered λ, 5.4.2.8);
- normalweight concrete (λ = 1.0).

### CBLA. λ in ACI development lengths   [CALCULATION CHANGE]
- **Governing provision (checked in the PDF):** ACI 318-19 sets λ = 0.75 for lightweight concrete and 1.0 for normalweight, with no intermediate value, in three tables:
  - Table 25.4.2.5, straight bars in tension (printed p. 474);
  - Table 25.4.3.2, hooked bars (printed p. 475);
  - Table 25.4.9.3, compression (printed p. 487).
- **Why 19.2.4.1 does not apply here:** 19.2.4.1 (p. 357) opens with "Except as required in Table 25.4.2.5", and R25.4.2.5 says the development λ is the same for all lightweight concrete.
- **Where:** `computeFactors()`, anchor `const lambda = inp.lightweight ?`.
  - Before:
    ```js
    const lambda = inp.lightweight ? (isFinite(lamIn) ? Math.min(1.0, Math.max(0.75, lamIn)) : 0.75) : 1.0;
    const lambdaAdj = inp.lightweight && !(isFinite(lamIn) && lamIn>=0.75 && lamIn<=1.0);
    ```
  - After (with a CBLA comment):
    ```js
    const lamA = inp.code==="AASHTO";
    const lambda = inp.lightweight ? (lamA ? (isFinite(lamIn) ? Math.min(1.0, Math.max(0.75, lamIn)) : 0.75) : 0.75) : 1.0;
    const lambdaAdj = lamA && inp.lightweight && !(isFinite(lamIn) && lamIn>=0.75 && lamIn<=1.0);
    ```
  - `f.lambda` feeds the ACI l_d (Eq. 25.4.2.4a), l_dh (25.4.3.1(a)) and l_dc (25.4.9.2(a)). Through them it also feeds the tension lap splice (1.0 or 1.3 × l_d), the bar schedule and the chart. The compression splice has no λ.
  - The λ input error RBLM, and the validate() warning on λ outside 0.75–1.0, now apply in AASHTO mode only, because ACI no longer reads the box.
- **Input box (decision, recorded as Decision (pending engineer review)):** the λ box stays and keeps its saved value. In ACI mode it is disabled (greyed).
  - Under it, an ACI-only hint (`rbAciOnly`) says: "ACI mode: development lengths use λ = 0.75 for lightweight concrete (ACI 318-19 Tables 25.4.2.5, 25.4.3.2 and 25.4.9.3), whatever is entered here; this box is used in AASHTO mode."
  - Code: `updateCodeHint()` sets `lw.disabled=(inp.code!=="AASHTO")`, and the CSS adds `.field input:disabled{…}`.
  - Reason: in this frame the entered λ is used only for development, so in ACI mode it has no effect.
- **Steps say so:**
  - ACI tension, hook and compression variable tables: λ row "Lightweight concrete: 0.75 per ACI Table 25.4.2.5 / 25.4.3.2 / 25.4.9.3 (entered λ not used)", or "Normalweight concrete (Table …)".
  - Tension commentary: added "ACI 318-19 Table 25.4.2.5 gives 0.75 for every lightweight concrete, so the λ entered in Code & Material is not used here (it is used in AASHTO mode)."
  - Report step `lam`: label "Lightweight concrete factor (0.75 for lightweight concrete in every ACI development length, whatever λ is entered)" or "(normalweight)". Its reference is "ACI 318-19 Tables 25.4.2.5, 25.4.3.2, 25.4.9.3".
  - Report references, ACI row: "Tables 25.4.2.5, 25.4.3.2 and 25.4.9.3 (λ for development)", in place of "19.2.4.1, Tables 19.2.4.1(a)/(b) (λ)".
- **Check case:** ACI, #8 bar, f′c 4000 psi, f_y 60 ksi, c_b 1.5 in, K_tr 0, all ψ = 1.0, lightweight with λ entered 0.85.

  | Quantity | Before (λ = 0.85) | After (λ = 0.75) | Hand check |
  |---|---|---|---|
  | l_d | 55.80 in | 63.25 in | 3/40 · 60000/(0.75·63.25) · 1/1.5 · 1.0 = 63.25 (normalweight 47.43; 47.43/0.75 = 63.24 with rounded inputs) |
  | l_dh | 28.14 in | 31.89 in | 60000·1.0·1.6·1.0·0.8667/(55·0.75·63.25) = 31.89 |
  | l_dc | 22.32 in | 25.30 in | max(0.02·60000/(0.75·63.25), 0.0003·60000) = max(25.30, 18.0) = 25.30 |
  | l_st (Class B) | 72.55 in | 82.22 in | 1.3 × 63.25 = 82.22 |
  | l_sc | 30.0 in | 30.0 in | no λ |

  With λ entered as 0.75 the results were the same before and after. AASHTO with λ 0.85: l_d 72.75, l_dh 51.50, l_dc 18.90 in before and after (unchanged).
- **Conservatism:** for any lightweight λ above 0.75 the tool was less conservative before. Lengths now grow by up to λ_entered/0.75, which is +13.3 % at 0.85.
- **How verified:**
  - Headless Chromium, origin/main (after #797) vs branch, in the suite and the standalone tool.
  - Default (normalweight) and ACI torsion cases: every numeric result identical. The only differences are the step labels, the Report λ reference, and one commentary sentence.
  - AASHTO excess case: identical.
  - The lightweight table above was computed in the page.
  - `check-syntax`, `phone-layout --tool cbc,aci` and `project-library` pass.
  - Screenshot of Code & Material looked at: λ box disabled, with the ACI hint.
- **Saved data:** no key or format change; the entered λ is still saved.
- **Other copies:** standalone tool and suite Dev frame (same edits).

## 2026-11-05 — PR: claude/cbc-report-inputerr, PR #800: https://github.com/mlococo88/All-Structural/pull/800 (CBIR: a chapter whose tab has an input error prints "Input error: no results" with the errors instead of its last results; Summary and Overview consistent; display only, no result change)

### CBIR. Input error in the suite Report   [display only] [no result change]
- **Problem (open item of CBRO #793, raised by the coordinator):** with an input blocker on the Beam Capacity tab (e.g. b_w blank), the tab, its check panel and the Summary of results said "Input error: no results", but the Beam Capacity chapter printed the last results computed before the error, together with the "As printed" tab copies and the Results lines. This is a correctness risk in a printed calculation. The ASD and Development & Splice chapters already printed a one-line "Input error, no results" section (#794), but in their own wording, and the Summary of results said "has not finished loading" for Development & Splice.
- **Fix:** for each of the three frames, when its input errors are not empty, the shell replaces that chapter's sections with one section, "Input error: no results". It has a note (the chapter has no results; nothing of the tab is printed until the inputs are corrected; a link to the tab) and the subsection "Input errors", one line per error. The key is `cbir:<chapter>`.
  - Errors come from the same tests the tabs use:
    - Beam Capacity: `VALIDATION.blockers`, through the new frame function `cbcRxErrors()`;
    - ASD: `CC.errors`, through the new `asdRxErrors()`;
    - Development & Splice: `rbInputErrors(readInputs(), computeFactors(…))`. That frame is unchanged, and so is the ACI Rebar copy.
  - `rxRest` copies no tab and adds no Results lines for that chapter.
  - The Summary of results says, for that chapter, "Input error: no results. <errors> Correct the marked inputs on the <tab> tab (see §x)".
  - The Overview says "No overview: input error on the Beam Capacity tab, no results, so the beam is not drawn (the errors: see §x)".
  - With a Beam Capacity error and a valid ASD tab, the ASD chapter's first section gets a note: its inherited values are the last ones Beam Capacity sent before the error. `derive()` sends nothing while blocked, so the ASD tab keeps its last values, on screen as well.
- **Where:**
  - Shell, new block `/* ---------- CBIR (2026-11-05` before the CBRF block: `cbirErrors`, `CBIR_TAB`, `cbirMsg`, `cbirSection` (code below).
  - `model()`:
    - `ERR={}`;
    - after the chapter is built, `var ie=cbirErrors(c.id); if(ie.length){ ERR[c.id]=ie; m={code:m.code,proj:m.proj,refs:m.refs,sections:[cbirSection(c,ie)]}; }`;
    - the section push carries `key:s._cbir`;
    - `M._err=ERR` before `rxRest`, plus the ASD note line.
  - `rxRest`: `if(M._err&&M._err[c.id]) return;` after the `Harvest` lookup.
  - `cbroSum(ERR)`: each chapter's message comes from `ERR` first.
  - `cbovSection`: the blocked note.
  - Beam Capacity frame: `function cbcRxErrors(){ return ((VALIDATION&&VALIDATION.blockers)||[]).map(b=>String(b.msg).replace(/<[^>]+>/g,'')); }`, before `function cbcRxBoxes(){`.
  - ASD frame: `function asdRxErrors(){ return (CC&&CC.errors?CC.errors:[]).map(e=>String(e).replace(/<[^>]+>/g,'')); }`, before `function asdRxBoxes(){`.
- **Check case:** default project, b_w blank.
  - Before: Report §3–§10, Beam Capacity results such as "Torsional capacity ≫1 FAIL", and the Results — Flexure lines.
  - After: §3 "Input error: no results" with "Beam width and depth must be positive."; the printed Report is 21 pages. The Summary says the same and links to §3.
- **How verified (headless Chromium, origin/main f913680 vs branch):**
  - Valid inputs: the Report text (screen and print box) is byte-identical to main in 5 cases (default, c2, c3, Include boxes off, no stirrups). Results and localStorage are identical.
  - Input errors in 4 cases (Beam Capacity b_w blank; ASD f_c,inv −5; Development & Splice f′c blank; Beam Capacity and Development & Splice together):
    - results identical to main;
    - the erroring chapter prints only its "Input error: no results" section;
    - no "Results — Flexure" lines from a blocked Beam Capacity chapter;
    - 0 unresolved references, 0 console errors.
  - Printed PDF of the b_w-blank case looked at.
  - `check-syntax`, `run.mjs report steps steps-groups report-wiring`, `phone-layout --tool cbc` pass.
- **Decisions (pending engineer review):** the ASD inheritance note above. The References table still lists the erroring chapter's references.
- **Saved data:** none. **Governing provision:** none. **Other copies:** none (the Development & Splice frame and the ACI Rebar tool are untouched).

#### Code added (re-apply by hand)
```js
  /* ---------- CBIR (2026-11-05, Phase 4 follow-up): a chapter whose tab has an input error (the tab's check summary panel and
     output say "Input error: no results": Beam Capacity VALIDATION.blockers, ASD CC.errors, Development & Splice rbInputErrors)
     prints "Input error: no results" with the list of errors in place of its worked sections, so the Report never prints the
     last results computed before the error. The Summary of results and the Overview say the same. Valid inputs: unchanged. ---------- */
  function cbirErrors(id){
    try{
      if(id==='cap'){ var f=rxFn(RXCH[0],'Errors'); return f?f():[]; }
      if(id==='asd'){ var g=rxFn(RXCH[1],'Errors'); return g?g():[]; }
      if(id==='dev'){ var w=win('dev'); if(!w||typeof w.rbInputErrors!=='function') return []; var inp=w.readInputs(); return w.rbInputErrors(inp,w.computeFactors(inp)).map(function(e){ return String(e[1]); }); }
    }catch(e){}
    return [];
  }
  var CBIR_TAB={cap:'Beam Capacity',asd:'ASD Beam Calcs',dev:'Development & Splice'};
  function cbirMsg(E,id){ return 'Input error: no results. '+E.join(' ')+' Correct the marked inputs on the '+CBIR_TAB[id]+' tab ([[cbir:'+id+']]).'; }
  function cbirSection(c,E){   /* the chapter's one section; text in the chapter's own form (model() prefixes keys and tab links) */
    return {title:'Input error: no results',_cbir:'cbir:'+c.id,
      note:'The '+c.name+' tab has an input error, so this chapter has no results: no value of this tab is printed until the inputs are corrected. [[tab:|On screen: '+c.name+' tab]]',
      subs:[{title:'Input errors',items:E.map(function(t){ return {type:'note',warn:true,text:t}; })}]};
  }
```

## 2026-11-05 — PR: claude/cbc-asd-stale, PR #801: https://github.com/mlococo88/All-Structural/pull/801 (CBST: the ASD Beam Calcs tab says on screen when its "From Beam Capacity" values are stale because Beam Capacity has an input error; REVIEW line in its check panel; display only, no result change)

### CBST. Stale inherited values on the ASD tab   [display only] [no result change]
- **Problem (coordinator, after CBIR #800):** while Beam Capacity has an input error, its `derive()` returns null and nothing is sent. The ASD tab then keeps the last inherited values and shows its results with no warning on screen. The Report already said so (CBIR).
- **Fix:**
  - On the ASD tab's "From Beam Capacity" card: a warning box reading "Values inherited from Beam Capacity are the last ones sent before its input error; correct Beam Capacity first. (Beam Capacity: <errors>)", with a link "→ Beam Capacity tab".
  - In the ASD check summary panel: a REVIEW line "Inherited from Beam Capacity — Beam Capacity input error"; a click opens the Beam Capacity tab.
  - ASD's own results are not blanked or changed.
  - The Report's Summary of results gets the same REVIEW line, because it reads `asdDashItems`.
- **Where:**
  - **ASD frame** (`#suite-frame-asd` srcdoc, decoded and re-encoded with CRLF kept):
    - New block before `function asdDashGo(it){`: `var ASDCE=[]`, `asdSetCapErrors(E)` (sets the list; calls `refresh()` only when it changed), `asdCapGo()` (posts `{type:'cbcGoto',tab:'',card:''}` to the shell).
    - `asdDashGo`: `if(it.cap){ asdCapGo(); return; }`.
    - `asdDashItems`: after the `where` loop, `if((ASDCE||[]).length) out.push({name:'Inherited from Beam Capacity',st:'warn',short:'Beam Capacity input error',cap:true,…})`.
    - `mkSection("inInherit"…)`: the warning box before `const IE=asdInheritErrors();`. `ASDCE` is not in `S`, so nothing is saved.
  - **Shell:**
    - `capStatus()` (Beam Capacity `cbcRxErrors()` → ASD `asdSetCapErrors()`; same origin) is called in `show('asd')` and at the start of the Report's `model()`.
    - It is exposed as `window.CBST_capStatus`.
- **Check case:** default project, b_w blank on Beam Capacity, then the ASD tab.
  - The panel reads "2 NG, 1 REVIEW" and shows the warning box with "Beam width and depth must be positive."; the link opens Beam Capacity.
  - ASD `CC` is identical to main.
  - After b_w = 12 is restored and ASD is shown again, the notice is gone and the panel reads "2 NG".
- **How verified (headless Chromium, origin/main afe45fa vs branch):**
  - Valid inputs:
    - the ASD tab's text and check panel are identical to main;
    - the Report text and ASD `CC` are identical to main;
    - localStorage is identical to main.
  - The error case and recovery above, with 0 console errors and a screenshot looked at.
  - `check-syntax`, `run.mjs report steps steps-groups report-wiring` (14 passed) and `phone-layout --tool cbc` pass.
- **Saved data:** none. **Governing provision:** none. **Other copies:** none (the standalone "Concrete Beam ASD.html" is a redirect; the frame alone gets no message and shows no notice).
## 2026-11-05 — PR: claude/cbc-scale-bars, PR #802: https://github.com/mlococo88/All-Structural/pull/802 (CBSB: every geometric drawing of the suite to scale with a scale bar, measured; display only, no result change)

### CBSB. Scale bars and to-scale drawings   [display only] [no result change]
- **Engineer request (2026-11-05, Phase 5 graphics, PR A):** every geometric drawing in the three frames gets a scale bar or a "to scale" note; re-measure in headless Chromium (as Spread Footing SFTS #776) and fix any drawing that is not to scale.
- **Measured (headless Chromium, 1600 px window; rendered px per in across ÷ up, 1.00 = to scale).** Default project and a deep / narrow case (Beam Capacity b_w 10 × h 48 in, stirrups at 12 in; ASD b 10, h 48, d 45 in; Development & Splice #11, c_b 3 in).

  | Drawing | main (default / deep) | branch (default / deep) | scale bar ÷ drawing |
  |---|---|---|---|
  | Beam Capacity, Input Echo "Section Schematic": cross-section (`svgSection`) | 18.68 px/in, 1.00 / 7.00 px/in, 1.00 | unchanged | 1.00 / 1.00 (6 in / 1 ft) |
  | Beam Capacity, Input Echo: stirrup elevation (`svgElevation`; stirrup pitch ÷ s vs h) | 8.63, 1.00 / 3.91, 1.00 | unchanged | 1.00 / 1.00 (1 ft) |
  | Beam Capacity, Visuals: cross-section and elevation | as Input Echo | unchanged | 1.00 / 1.00 |
  | Beam Capacity, Visuals: 3-D view | perspective (no scale); length illustrative | note says the section is modelled to scale, the view is a perspective without a scale bar | — |
  | Beam Capacity, Visuals: strain diagram, D/C chart, capacity curves (Plotly) | charts, not geometry | unchanged | — |
  | ASD, Section tab (`drawSection`; kd and d also measured on the drawing) | 25.49, 1.00 / 16.05, 1.00; kd 3.764 = 3.764, d 15.19 = 15.19 in | unchanged | 1.00 / 1.00 (6 in) |
  | Development & Splice, "Bar in section" (`schematicSVG`; c_b to bar centre vs d_b) | 1.05 / 0.95 (bar at db·14 px, cover at c_b·20 px, c_b dimensioned to the bar's edge) | 1.00 / 1.00 | 1.00 / 1.00 (3 in) |
  | Development & Splice, hook (`hookSchematic`; l_dh vs the 12 d_b tail) | 2.39 / 3.55 (lead max(8 d_b, 90 px), bend 3 d_b) | 1.00 / 1.00 | 1.00 / 1.00 (18 in / 2 ft) |
  | Report: every figure with a scale bar (overview, Input Echo copies, ASD, both Dev figures), rendered box ÷ viewBox | — | 7 figures, 1.00 each | — |

- **What changed:**
  - Beam Capacity frame (`#suite-frame-capacity` srcdoc, CRLF kept):
    - Input Echo `ieSchematic` and Visuals `visSec` / `visElev`: the drawings go through the existing CBOV scale-bar helper `cbcOvBar` (#795), which the Report overview already used. The drawing functions are unchanged.
      - Before: `f.innerHTML=svgSection(CC.govRow?CC.govRow.neg:false);` / `f2.innerHTML=e;` / `f.innerHTML=svgSection(rSel.neg);` / `f.innerHTML=e;`
      - After: `f.innerHTML=cbcOvBar(svgSection(CC.govRow?CC.govRow.neg:false),CBOV.sec);` / `f2.innerHTML=cbcOvBar(e,CBOV.elev);` / `f.innerHTML=cbcOvBar(svgSection(rSel.neg),CBOV.sec);` / `f.innerHTML=cbcOvBar(e,CBOV.elev);` (each with `/* CBSB: scale bar */`).
    - `cbcOvBar`: its `<g>` gets `class="cbc-sbar" data-in="<bar length, in>"` (used by the to-scale check). Before: `let b='<g font-family="Arial,Helvetica,sans-serif" font-size="9" fill="#0F172A">';`
    - `build3D` note. Before: `"Drag to rotate, scroll to zoom. The length shown ("+fmt(Lb,0)+" in) is illustrative; the tool checks a cross-section, not a span."` After: `"Drag to rotate, scroll to zoom. The cross-section (concrete, bars, cover, stirrups at s) is modelled to scale; the view is a perspective, so it has no scale bar (the dimensioned, to-scale section and elevation are above). The length shown ("+fmt(Lb,0)+" in) is illustrative; the tool checks a cross-section, not a span."`
  - ASD frame (`#suite-frame-asd`), `drawSection`:
    - Before: `const hTot=Math.max(R.h,R.d+2);` After: `const hTot=(R.h>R.d)?R.h:R.d+2;` The section is drawn to its real h. Before, a section whose steel centroid is within 2 in of the face (h < d + 2) was drawn d + 2 tall. The d + 2 fallback is kept for h not given (h ≤ d), with the note "h not given: drawn to d + 2 in". The default project (h 18, d 15.19) draws the same.
    - viewBox height `H+90` → `H+110`; the scale bar `asdScaleBar(scale,pad,pad+H+22,w_eff+140,…)` before `</svg>`. New `asdScaleBar(sc,x0,y,W,extra)` after `drawSection` (bar of 1, 2, 3, 4, 6, 12 … in, at most 40 % of the drawing width; the line "to scale, the same scale across and up").
  - Development & Splice frame and `ACI Rebar Development Length.html` (the same edits in both, CLAUDE.md §3): see the entry of the same date in `fixlog/ACI Rebar Development Length.md` (CBSB): `schematicSVG` and `hookSchematic` rewritten to scale, new `rbrScaleBar`, Report captions "to scale".
- **Decisions (pending engineer review):**
  - The 3-D view gets a note, not a scale bar: it is a perspective, so no single scale applies.
  - The Development & Splice drawings were schematics. They are now drawn to scale, because the hook in particular (l_dh, bend, 12 d_b tail) reads differently at true proportions. The bar-in-section drawing now dimensions c_b to the bar centre, as c_b is defined (ACI 318-19 25.4.2.4; AASHTO 5.10.8.2.1c). Before, it dimensioned c_b to the bar's edge.
  - The hook drawing uses the minimum bend diameter of ACI 318-19 Table 25.3.1 / AASHTO Table 5.10.2.3-1 (6, 8, 10 d_b), or the entered R in AASHTO mode. The drawing is a picture of the calculated l_dh: no length is computed from it.
  - The ASD drawing shows A_s as a line at d, as before: the ASD tab has no bar sizes, only A_s.
  - Pre-existing, not changed: in the deep case the "d(C2)" label of `svgSection` overlaps the "extreme compression fibre" tag (labels only).
- **How verified (headless Chromium):**
  - Results and tab text: origin/main afe45fa vs the branch, cases default, aa100, aci100, excess (Concrete Beam Capacity) and the standalone ACI Rebar tool. `CC` ×2 and the Development & Splice results are identical. Text differences are only the scale-bar labels, the 3-D note, the two Dev drawing titles and the Dev "tail ≈ 12d_b" label ("tail 12d_b"). In the Report models, only the figure SVG strings changed.
  - Scale: the table above. The script is `ph5/measure.mjs` in the session scratchpad: rendered bounding boxes of the outline, stirrups, dimension lines and the scale bar.
  - Report printed (Letter): 48 pages (main 47). Looked at the overview, the Input Echo copies (p. 9–10), the ASD section (p. 28) and the hook (p. 35).
  - Screenshots looked at: the Input Echo section and elevation, the Visuals section, elevation and 3-D, the ASD section, both Dev drawings, for default and deep.
  - `check-syntax` (all), `phone-layout --tool cbc,aci`, `project-library --tool rebar` and `run.mjs report steps steps-groups report-wiring` (14 passed) pass.
- **Saved data:** none. **Governing provision:** none changed (drawings only). **Other copies:** `ACI Rebar Development Length.html` (Dev drawings, same edit).


## 2026-11-05 — PR: claude/retire-aci-rebar, PR #804: https://github.com/mlococo88/All-Structural/pull/804 (RBRT: the standalone "ACI Rebar Development Length.html" is retired and opens this suite's Development & Splice tab; the tab takes over the old page's last session once; storage only, no result change)

- **Engineer decision (2026-11-05):** retire the standalone rebar calculator; its file is now a redirect page to `Concrete%20Beam%20Capacity.html#dev` (see `fixlog/ACI Rebar Development Length.md`, RBRT). The `#dev` deep link already existed (CBAR, 2026-11-01); unchanged.
- **Where:** Development & Splice tab srcdoc (`suite-frame-dev`), main script: new functions before `function init(){` (anchor, unescaped: `/* RBRT (2026-11-05): the standalone "ACI Rebar Development Length.html" is retired`; in the file the quotes are `&quot;` and every `&` is `&amp;`), and `init()` (anchor `// one-time migration: if this tab has no autosave of its own yet`).
- **Before** (`init()`, unescaped):
```js
  // one-time migration: if this tab has no autosave of its own yet, start from the old shared one (left in place)
  try{ if(localStorage.getItem(LS_KEY)===null){ const old=localStorage.getItem(LS_KEY_OLD); if(old!==null) localStorage.setItem(LS_KEY,old); } }catch(e){}
```
- **After** (`init()`, unescaped):
```js
  // one-time migration: if this tab has no autosave of its own yet, start from the old shared one (left in place)
  // RBRT (2026-11-05): with the standalone tool retired, also its later work, once, and a notice (rbOldAutosave, above)
  rbOldAutosave();
```
  and, inserted before `function init(){` (unescaped; encode `&` → `&amp;` and `"` → `&quot;`, CRLF, when pasting into the srcdoc):
```js
/* RBRT (2026-11-05): the standalone "ACI Rebar Development Length.html" is retired (it now opens this tab). Its last session
   (LS_KEY_OLD, never written or deleted here) is taken over ONCE (marker LS_KEY_MIG): as this tab's autosave when the tab has none
   yet (as before, F21), or else, when its inputs differ from this tab's and from every saved project, as a new saved project
   (the inputs shown are not changed). A notice above the inputs says what was done, until OK. Storage only; no result change. */
const LS_KEY_MIG = "rcsuite.rebar_oldAutosaveMigrated_v1";   // {at, did:'autosave'|'project'|'none', name, seen}
function rbInpIn(a,b){ return !!(a&&b&&typeof a==='object'&&typeof b==='object')&&Object.keys(a).every(k=>String(a[k])===String(b[k])); }
function rbOldAutosave(){
  let old=null, cur=null, mig=null;
  try{ old=localStorage.getItem(LS_KEY_OLD); cur=localStorage.getItem(LS_KEY); mig=localStorage.getItem(LS_KEY_MIG); }catch(e){ return; }
  if(old===null) return;
  if(mig!==null){ if(cur===null){ try{ localStorage.setItem(LS_KEY,old); }catch(e){} } rbOldAutosaveNote(mig); return; }   // as before (F21)
  const at=new Date().toISOString(); let m={at, did:'none', seen:true}, o=null;
  try{ o=JSON.parse(old); }catch(e){}
  if(cur===null){ try{ localStorage.setItem(LS_KEY,old); }catch(e){ return; } m={at, did:'autosave', seen:false}; }
  else if(o&&o.inp&&typeof o.inp==='object'){
    let c=null; try{ c=JSON.parse(cur); }catch(e){}
    const p=getProjects();
    if(!rbInpIn(o.inp,c&&c.inp)&&!Object.keys(p).some(k=>rbInpIn(o.inp,p[k]&&p[k].inp))){
      const base='Recovered from the standalone tool ('+at.slice(0,10)+')'; let nm=base, i=2; while(p[nm]) nm=base+' '+(i++);
      p[nm]=o; try{ localStorage.setItem(LS_PROJECTS,JSON.stringify(p)); }catch(e){ return; }
      m={at, did:'project', name:nm, seen:false};
    }
  }
  try{ localStorage.setItem(LS_KEY_MIG,JSON.stringify(m)); }catch(e){}
  rbOldAutosaveNote(JSON.stringify(m));
}
function rbOldAutosaveNote(s){
  let m=null; try{ m=JSON.parse(s); }catch(e){}
  if(!m||m.seen||(m.did!=='autosave'&&m.did!=='project')) return;
  const P=document.getElementById('inputPanel'); if(!P||document.getElementById('rbOldNote')) return;
  const d=document.createElement('div'); d.className='warnbox'; d.id='rbOldNote'; d.setAttribute('role','status'); d.style.margin='0 0 8px';
  d.innerHTML='<b>Standalone calculator retired.</b> "ACI Rebar Development Length.html" now opens this tab. '+
    (m.did==='autosave'?'The inputs last used there were opened here.'
      :'The inputs last used there differ from this tab\'s, so they were kept as the saved project <b>'+escHTML(m.name)+'</b> (input tab "Assumptions &amp; Save", Saved Project); the inputs shown were not changed.')+
    ' Projects saved there are listed here as before. <button type="button" class="btn small" style="margin-left:6px">OK</button>';
  d.querySelector('button').addEventListener('click',()=>{ m.seen=true; try{ localStorage.setItem(LS_KEY_MIG,JSON.stringify(m)); }catch(e){} d.remove(); });
  P.insertBefore(d,P.firstChild);
}
```
- **Problem:** since F21 (2026-10-04) the tab has its own autosave and copied the old page's autosave only when it had none. A user who opened the suite once and then kept working in the standalone page would, after the retirement, no longer see that later work (it stays in `rebar_aci_autosave_v1`, which only the retired page wrote). Saved projects were never affected (`rebar_aci_projects_v1` is shared).
- **Behaviour now (once per browser storage, marker `rcsuite.rebar_oldAutosaveMigrated_v1` = `{at, did, name, seen}`):**
  - no old autosave: nothing (no marker written);
  - the tab has no autosave: the old one is copied (as F21 did) and opened; notice "The inputs last used there were opened here.";
  - the tab has an autosave and the old session's inputs (every old field, compared as text) match it or a saved project: nothing added, no notice;
  - otherwise: the old session is added to the project list as "Recovered from the standalone tool (YYYY-MM-DD)" (a number is added if the name exists); the inputs shown and the tab's autosave are not changed; notice names the project.
  - The notice (a warning box above the input tabs) stays until OK; `rebar_aci_autosave_v1` is never written or deleted; nothing else is changed. If storage refuses the write, nothing is marked and the next load tries again.
- **Governing provision:** none. No formula, factor, unit, code reference or result changed (storage at start-up only).
- **Check case:** old page (f9ec0f9): AASHTO, #9, f'c 5,000, c_b 2.5, top bar, epoxy saved as "Pier 3 laps"; then f'c 6,000, #7 (last session). (A) suite never opened: the tab opens on the last session, results identical to the old page, notice; "Pier 3 laps" listed and identical. (B) suite autosave = defaults: "Recovered from the standalone tool (2026-11-05)" added, equal byte for byte to `rebar_aci_autosave_v1`, opens with the old page's results; inputs shown unchanged; reopened: no second copy, notice gone after OK. (C) suite autosave = the old session: nothing added, no notice.
- **How verified:** `node tests/check-syntax.mjs` (all files) pass. `node tests/smoke/rebar-redirect.mjs` ALL PASS. `node tests/smoke/project-library.mjs --tool rebar` (now run inside this tab, main vs branch) ALL PASS: results identical on load, after an input change, on main's autosave and on main's saved project. `node tests/smoke/phone-layout.mjs --tool aci,cbc` pass (aci = this tab's 12 tab buttons at 390 / 768 px). `node tests/compare.mjs --tool page --file "Concrete Beam Capacity.html"`: page text and storage identical.
- **Other copies:** none (the standalone page was the other copy; it is retired in this PR).
- **Open items:** none.
## 2026-11-05 — PR: claude/cbc-value-labels, PR #805: https://github.com/mlococo88/All-Structural/pull/805 (CBVL: strain, stress and force diagram with value labels beside the Beam Capacity section; elastic stress diagram on the ASD Section tab; both in the Report; display only, no result change)

### CBVL. Value labels on the graphics   [display only] [no result change]
- **Engineer request (2026-11-05, Phase 5 graphics, PR B):**
  - Beside the Beam Capacity section, for the selected or governing combination, a strain and stress (force) diagram. It shows c, ε_cu = 0.003, ε_t, the strain at each layer, f_s per layer (yield noted), the C_c / C_s / T resultants and their lever arm, M_n and φ, all from the tool's own flexure results.
  - On the ASD frame, the elastic stress diagram (kd, f_c, f_s).
  - Labels legible, signs clear, links to the worked steps (§6), and the Report copies them.
- **Beam Capacity frame (`#suite-frame-capacity` srcdoc, CRLF kept):**
  - New `cbcForceRes(r)`, `cbcLn`, `cbcForceRows(r)`, `cbcArrowHead`, `cbcArrow` and `cbcForceSVG(r)`, before `/* ---------- Plotly strain diagram ---------- */`. The code is below.
  - Visuals tab, `buildVisualsTab`: a new card `visForce`, "Strain, Stress and Forces at Nominal Strength", between the cross-section (`visSec`) and the Plotly strain diagram. It is for the combination of the tab's existing selector (`S.ui.detailCombo`; the governing combination by default). It holds the diagram (bars hover-linked as the section), a caption, the table "Quantity / Expression / Values / Result" (`cbcForceRows`), and "Worked in: … → Flexure · Combination k".
  - `cbcRptFlex(r)`: for the combination that governs flexure (`CC.govFlexIndex`, else `CC.govIndex`), the Report's flexure subsection adds the figure, the table "Values on the diagram, worked" and a note. The note links c, a, C_c, ε_t, φ, M_n and φM_n to their steps (`[[fx<ci>/c]]` …).
    - Before: `return [tbl,{type:'topics',title:'Worked steps',list:T}];`
    - After: `… .concat(sfd);`
  - **Values (no new calculation):**
    - c, a, ȳ, β₁, α₁, C_c, ε_t, d_t, and per layer d, ε_s, f_s, F, arm and M come from `flexure()` (`r.F`). φ and the class come from `r.pf`, and φM_n from `r.phiMn`.
    - The resultants are sums of the layer values:
      - T = ΣF over the layers with F > 0;
      - C_s = ΣF over the layers with F < 0;
      - lever arms about the concrete resultant: z_T = ΣM·12 / T and z_Cs = ΣM·12 / C_s, each over the same layers.
    - So (T z_T + C_s z_Cs)/12 = ΣM = M_n exactly, and T + C_s = C_c (the solver's equilibrium).
  - **Signs:** as the Flexure tab, + tension and − compression. C_c is labelled "−C_c". Arrows point right (→) for tension and left (←) for compression.
  - **Drawing:**
    - The section is to scale and drawn in its physical orientation (−M: compression at the bottom). The stress block is shaded to depth a, in flange and web pieces.
    - The strain profile runs from ε_cu at the compression fibre, through the N.A. (shared dashed line), with a marker and label at each layer. The extreme tension layer is marked "= ε_t".
    - The stress block α₁f′c is drawn over a. The force arrows are to a force scale. The lever-arm dimension z_T runs from C_c. z_Cs is shown when it is longer than 6 px.
    - A results line: T, C_s, C_c, M_n, ε_t → class, φ, φM_n.
    - Overlapping labels are moved apart (15–17 px).
    - Arrowheads are polygons, not `<marker>` ids. The Report's print copy duplicates the page, so an id reference resolves to the hidden screen copy and the heads did not print (found in the first PDF).
- **ASD frame (`#suite-frame-asd`):**
  - New `asdStressState(R)`, `cbcArrowHeadA` and `asdStressSVG(R)` after `drawSection`'s scale-bar helper. The code is below.
  - Section tab, `buildFigureTab`: a new card `figStress`, "Elastic Stress Diagram at the Allowable Moment". It holds the diagram, a caption, an eqBlock (f_c, f_s, C, T worked with values) and "Worked in" links to cards 2 (kd), 3 (z) and 4 (M_conc, M_steel, M_all).
  - `asdRptModel`: a topic "Elastic stresses at the allowable moment (inventory)" with steps `sd.fc`, `sd.fs`, `sd.C` and `sd.T`. It comes after the rating-factor topics, so their numbers do not move. The figure follows "Transformed section and stress block", and its caption links `[[an/sd.fc]]`.
  - **Values:**
    - The diagram is at the allowable moment M_all of the inventory level (operating when inventory is off). There, the controlling material is at its allowable stress.
    - The other stress comes from the same capacity equations. They are linear in the stress (M_conc = C_ff f_c z/12000, M_steel = A_s f_s z/12000), so f_c = f_c,all·M_all/M_conc and f_s = f_s,all·M_all/M_steel.
    - kd, z, C_ff, A_s, n and the moments are `compute()`'s.
    - The steel stress is drawn as f_s/n on the tension side, so both stresses lie on one straight line through the N.A. (a visual check of the transformed-section kd).
- **Decisions (pending engineer review):**
  - The force diagram is on the Visuals tab, in the card after the cross-section. That tab already has the combination selector. The other Beam Capacity tabs are unchanged. In the Report it appears once, for the combination that governs flexure, rather than for every combination.
  - The ASD stress diagram is drawn at M_all, the rating capacity. The tool computes no stress under the applied M_DL + M_LL+I (it rates by allowable moments), so no service-stress diagram is drawn.
  - z_T and z_Cs are force-weighted lever arms of the layer arms the solver uses (about the compression-block centroid ȳ, as M_n = ΣF(d − ȳ)/12).
  - Pre-existing, not changed: the ASD `drawSection` hatching uses `<pattern>` / `<clipPath>` ids and does not print in the Report (same cause as above). This is noted for a later fix.
- **Check case (default project, Combination 1 "1.2D + 1.6L", governing):**
  - c = 2.23 in, a = 0.850 × 2.23 = 1.89 in, ȳ = 0.95 in.
  - T1: d 15.19, ε_s = 0.003(15.19 − 2.23)/2.23 = 0.01748, f_s = 60.0 ksi (yield), F = 0.93 × 60.0 = 55.80 kip.
  - C2: d 2.81, ε_s = 0.00079 (tension: the N.A. is above it), f_s = 23.0 ksi, F = 21.36 kip.
  - T = 55.80 + 21.36 = 77.16 kip = C_c = 0.85 × 4 × 12 × 1.89 = 77.16 kip.
  - z_T = (55.80 × 14.24 + 21.36 × 1.87)/77.16 = 10.82 in.
  - M_n = 77.16 × 10.82/12 = 69.55 kip-ft (Flexure tab 66.22 + 3.32 = 69.55). φ = 0.900, φM_n = 62.59 kip-ft.
  - ASD default (inventory): kd 3.76, z 13.94 in, M_conc 41.96, M_steel 25.92 → M_all 25.92 kip-ft (steel controls). f_s = 24,000 psi (= allowable), f_c = 1,600 × 25.92/41.96 = 988 psi. C = 22.58 × 988/1000 = 22.32 kip = T = 0.93 × 24,000/1000 = 22.32 kip. f_s/n = 3,000 psi; 988/3.76 = 263 ≈ 3,000/11.43 = 262 psi/in (straight line).
- **How verified (headless Chromium, origin/main f9ec0f9 vs the branch):**
  - Cases default, aa100, aci100 and excess (suite) and the standalone ACI Rebar tool (identical).
  - `computeAll`, `allChecks` (Beam Capacity), `compute` (ASD) and the Development & Splice results are identical.
  - Text differences are additions only: the Visuals card, the ASD Section card and the Report additions. No line of main's Report text is missing.
  - The Report models differ only by the added items.
  - Screenshots looked at: the Visuals card for default, a two-combination case with −M selected, a T-beam (48 × 30 in) and a deep beam with three layers (one in compression); the ASD card.
  - The Report printed (49 pages) and looked at: p. 12 (Beam Capacity diagram and table, arrowheads printed) and p. 30 (ASD).
  - `check-syntax` (all), `phone-layout --tool cbc,aci` and `run.mjs report steps steps-groups report-wiring` pass.
- **Saved data:** none (the card uses the existing `S.ui.detailCombo` and collapse state). **Governing provision:** none changed. **Other copies:** none.

#### Code added (re-apply by hand) — Beam Capacity frame
```js
/* ---------- CBVL (2026-11-05, Phase 5 graphics): strain, stress and force diagram beside the cross-section ----------
   For one load combination r (CC.combos[i]): the section, the strain profile and the stresses / forces at nominal strength,
   with value labels. Every value is the flexure solver's own (r.F = flexure(): c, a, ȳ, C_c, per layer ε_s, f_s, F, arm, M;
   r.pf: φ and the class; r.phiMn). The resultants are sums of those layer values: T = ΣF of the layers in tension, C_s = ΣF
   of the layers in compression (F < 0), and their lever arms about the compression-block centroid z = ΣM·12/ΣF, so
   (T·z_T + C_s·z_Cs)/12 = ΣM = M_n exactly. Signs as the Flexure tab: + tension, − compression. Display only. */
function cbcForceRes(r){
  const F=r.F, ten=F.detail.filter(L=>L.F>0), cmp=F.detail.filter(L=>L.F<0);
  const sum=(A,k)=>A.reduce((s,L)=>s+L[k],0);
  const T=sum(ten,'F'), Cs=sum(cmp,'F'), MT=sum(ten,'M'), MCs=sum(cmp,'M');
  return {ten,cmp,T,Cs,MT,MCs,zT:T>0?MT*12/T:null,zCs:Cs<0?MCs*12/Cs:null};
}
const cbcLn=L=>L.side+(L.i+1);
/* rows: [quantity, expression, values substituted, result] — the worked lines of the diagram's labels */
function cbcForceRows(r){
  const F=r.F, R=cbcForceRes(r), rows=[];
  rows.push(['Neutral-axis depth c','axial equilibrium (Flexure, Step 4)','',fmt(F.c)+' in']);
  rows.push(['Stress-block depth a','β₁c',fmt(F.B1,3)+' × '+fmt(F.c),fmt(F.a)+' in']);
  rows.push(['Concrete strain ε_cu','extreme compression fibre','','0.003']);
  F.detail.forEach(L=>{
    rows.push(['Layer '+cbcLn(L)+' (d = '+fmt(L.d)+' in): ε_s','0.003(d − c)/c','0.003('+fmt(L.d)+' − '+fmt(F.c)+')/'+fmt(F.c),fmt(L.eps,5)]);
    rows.push(['Layer '+cbcLn(L)+': f_s','ε_s E_s, limited to ±f_y','min(|'+fmt(L.eps,5)+'| × 29000, '+fmt(S.mat.fy)+')',fmt(L.fs,1)+' ksi'+(L.yielded?' (yielded)':'')]);
    rows.push(['Layer '+cbcLn(L)+': F','A_s f_s'+(L.disp>0?' + A_sα₁f′c':''),fmt(L.As)+' × '+fmt(L.fs,1)+(L.disp>0?' + '+fmt(L.disp,2):''),fmt(L.F)+' kip']);
  });
  rows.push(['ε_t (extreme tension layer, d_t = '+fmt(F.dt)+' in)','0.003(d_t − c)/c','0.003('+fmt(F.dt)+' − '+fmt(F.c)+')/'+fmt(F.c),fmt(F.eps_t,5)]);
  rows.push(['Concrete compression C_c','α₁f′c × compression area (depth a)',fmt(F.A1,2)+' × '+fmt(S.mat.fc)+' × A(a = '+fmt(F.a)+')',fmt(F.Cc)+' kip (compression), at ȳ = '+fmt(F.ybar)+' in']);
  rows.push(['Steel tension T','ΣF, layers in tension',R.ten.length?R.ten.map(L=>fmt(L.F)).join(' + '):'none',fmt(R.T)+' kip']);
  if(R.cmp.length) rows.push(['Steel compression C_s','ΣF, layers in compression',R.cmp.map(L=>'('+fmt(L.F)+')').join(' + '),fmt(R.Cs)+' kip']);
  rows.push(['Equilibrium','C_c = T + C_s',fmt(R.T)+(R.cmp.length?' + ('+fmt(R.Cs)+')':''),fmt(R.T+R.Cs)+' kip (C_c = '+fmt(F.Cc)+')']);
  if(R.zT!=null) rows.push(['Lever arm of T about C_c','z_T = ΣF(d − ȳ)/T',R.ten.map(L=>fmt(L.F)+'('+fmt(L.arm)+')').join(' + ')+' / '+fmt(R.T),fmt(R.zT)+' in']);
  if(R.zCs!=null) rows.push(['Lever arm of C_s about C_c','z_Cs = ΣF(d − ȳ)/C_s',R.cmp.map(L=>'('+fmt(L.F)+')('+fmt(L.arm)+')').join(' + ')+' / ('+fmt(R.Cs)+')',fmt(R.zCs)+' in']);
  rows.push(['Nominal moment M_n','(T z_T'+(R.cmp.length?' + C_s z_Cs':'')+')/12','('+fmt(R.T)+' × '+fmt(R.zT)+(R.cmp.length?' + ('+fmt(R.Cs)+') × '+fmt(R.zCs):'')+')/12',fmt(F.Mn)+' kip-ft']);
  rows.push(['Strength reduction factor φ','by ε_t ('+r.pf.cls.toLowerCase()+')','ε_t = '+fmt(F.eps_t,5),fmt(r.pf.phi,3)]);
  rows.push(['Design strength φM_n','φM_n',fmt(r.pf.phi,3)+' × '+fmt(F.Mn),fmt(r.phiMn)+' kip-ft']);
  return rows;
}
/* arrowheads drawn as polygons, not <marker> ids: the Report's print copy duplicates the page, and an id reference would resolve
   to the hidden screen copy (the heads would not print) */
function cbcArrowHead(x1,y1,x2,y2,col,sz){ const a=Math.atan2(y2-y1,x2-x1), L=sz||8, w=L*0.45;
  const p=(d,o)=>[x2-L*Math.cos(a)+o*Math.sin(a), y2-L*Math.sin(a)-o*Math.cos(a)];
  const A=p(L,w), B=p(L,-w); return `<polygon points="${x2},${y2} ${A[0]},${A[1]} ${B[0]},${B[1]}" fill="${col}"/>`; }
function cbcArrow(x1,y1,x2,y2,col,sw,both){ return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${sw}"/>`+cbcArrowHead(x1,y1,x2,y2,col,6+2*sw)+(both?cbcArrowHead(x2,y2,x1,y1,col,6+2*sw):''); }
function cbcForceSVG(r){
  const F=r.F, neg=r.neg, R=cbcForceRes(r), {bw,h,bf,hf,type}=S.sec, tee=type==='tee', secW=tee?bf:bw;
  const MT=58, sc=Math.min(250/h,200/secW), H=Math.round(MT+h*sc+(neg?84:70)), xA=28;
  const xB=Math.max(320,xA+secW*sc+190), xC=xB+270, W=xC+340;   /* panels: section | strain (zero line xB) | stress and force (face line xC) */
  const Yp=y=>MT+y*sc, Y=t=>Yp(neg?h-t:t);                 /* Yp: physical depth from the top; Y: depth t from the compression fibre */
  const X=x=>xA+(secW/2+x)*sc;
  const T=(x,y,s,o)=>`<text x="${x}" y="${y}"${o||''}>${s}</text>`;
  let s=`<svg class="dwg cbvl" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="max-width:${W}px" font-family="Arial,Helvetica,sans-serif" font-size="13.5" fill="#0F172A">`;
  /* --- A: section (physical orientation, to scale) with the stress block and the bars --- */
  const out=tee?`M${X(-bf/2)},${Yp(0)} L${X(bf/2)},${Yp(0)} L${X(bf/2)},${Yp(hf)} L${X(bw/2)},${Yp(hf)} L${X(bw/2)},${Yp(h)} L${X(-bw/2)},${Yp(h)} L${X(-bw/2)},${Yp(hf)} L${X(-bf/2)},${Yp(hf)} Z`
    :`M${X(-bw/2)},${Yp(0)} L${X(bw/2)},${Yp(0)} L${X(bw/2)},${Yp(h)} L${X(-bw/2)},${Yp(h)} Z`;
  s+=`<path d="${out}" fill="#eceae4" stroke="#0F172A" stroke-width="1.3"/>`;
  const ya=Math.min(Y(0),Y(Math.min(F.a,h))), yb=Math.max(Y(0),Y(Math.min(F.a,h)));
  /* stress block: the part of the section between the compression face and depth a (flange and web pieces; no clip-path id) */
  const yb1=Math.min(neg?h-F.a:0,h), yb2=neg?h:Math.min(F.a,h);
  [[0,tee?hf:h,secW],[tee?hf:h,h,bw]].forEach(q=>{ const y1=Math.max(yb1,q[0]), y2=Math.min(yb2,q[1]); if(y2>y1+1e-9) s+=`<rect x="${X(-q[2]/2)}" y="${Yp(y1)}" width="${q[2]*sc}" height="${(y2-y1)*sc}" fill="#93c5fd" opacity="0.6"/>`; });
  F.detail.forEach(L=>{ const rr=Math.max(2.4,L.db/2*sc);
    barXs(L.n,L.db).forEach(x=>{ s+=`<circle data-layer="${L.i}" cx="${X(x)}" cy="${Yp(L.yTop)}" r="${rr}" fill="${L.F>0?'#DC2626':'#fff'}" stroke="${L.F>0?'#991B1B':'#2563EB'}" stroke-width="1.4"/>`; }); });
  s+=T(xA,MT-30,'Section, '+(neg?'\u2212M':'+M'),' font-weight="bold"');
  s+=T(xA,MT-16,'shaded: stress block, depth a',' font-size="12" fill="#334155"');
  /* neutral axis across the panels */
  if(F.c<=h) s+=`<line x1="${xA}" y1="${Y(F.c)}" x2="${xC+34}" y2="${Y(F.c)}" stroke="#B45309" stroke-width="1" stroke-dasharray="6,4"/>`+T(xA-3,Y(F.c)+4,'N.A.',' text-anchor="end" font-size="10" fill="#B45309"');
  /* --- B: strain --- */
  const epsF=EPS_CU*(h-F.c)/F.c, eMax=Math.max(EPS_CU,Math.abs(epsF),...F.detail.map(L=>Math.abs(L.eps))), es=80/eMax;
  const xs=e=>xB+e*es;   /* tension (+) to the right, compression (−) to the left */
  s+=T(xB-70,MT-30,'Strain (+ tension, − compression)',' font-weight="bold"');
  s+=`<line x1="${xB}" y1="${Y(0)}" x2="${xB}" y2="${Y(h)}" stroke="#94A3B8" stroke-width="1"/>`;
  const yc=F.c<=h?Y(F.c):Y(h);
  s+=`<polygon points="${xB},${Y(0)} ${xs(-EPS_CU)},${Y(0)} ${xB},${yc}" fill="#bfdbfe" stroke="none"/>`;
  if(F.c<h) s+=`<polygon points="${xB},${yc} ${xs(epsF)},${Y(h)} ${xB},${Y(h)}" fill="#fecaca" stroke="none"/>`;
  s+=`<line x1="${xs(-EPS_CU)}" y1="${Y(0)}" x2="${xs(epsF)}" y2="${Y(h)}" stroke="#1E3A5F" stroke-width="2"/>`;
  s+=T(xs(-EPS_CU)-4,Y(0)+(neg?14:-5),'ε_cu = 0.003',' text-anchor="end"');
  /* c dimension, compression fibre to N.A. */
  const xc=xB-125;
  if(F.c<=h){ s+=cbcArrow(xc,Y(0),xc,Y(F.c),'#334155',1,true);
    s+=`<line x1="${xc-4}" y1="${Y(0)}" x2="${xB}" y2="${Y(0)}" stroke="#94A3B8" stroke-width="0.6"/>`;
    s+=T(xc-5,(Y(0)+Y(F.c))/2+3,'c = '+fmt(F.c)+'"',' text-anchor="end" font-weight="bold"'); }
  /* layer labels, moved apart where they would overlap */
  const spread=(A,g)=>{ const o=A.slice().sort((p,q)=>p.y-q.y); for(let k=1;k<o.length;k++) if(o[k].y<o[k-1].y+g) o[k].y=o[k-1].y+g; return o; };
  spread(F.detail.map(L=>({L,y:Y(L.d)+3,y0:Y(L.d)})),17).forEach(o=>{ const L=o.L;
    s+=`<circle cx="${xs(L.eps)}" cy="${o.y0}" r="3.2" fill="${L.eps>0?'#DC2626':'#2563EB'}" stroke="#0F172A" stroke-width="0.6"/>`;
    const isT=L.d===F.dt&&L.side==='T';
    s+=T(xB+96,o.y,cbcLn(L)+': ε_s = '+(L.eps>0?'+':'')+fmt(L.eps,5)+(isT?' = ε_t':''),isT?' font-weight="bold"':''); });
  /* --- C: stresses and forces --- */
  const xF=xC+42, fMax=Math.max(F.Cc,...F.detail.map(L=>Math.abs(L.F)),1e-9), fl=v=>Math.max(8,70*Math.abs(v)/fMax);
  s+=T(xC-6,MT-30,'Stress f_s (ksi) and force F (kip)',' font-weight="bold"');
  s+=`<line x1="${xC}" y1="${Y(0)}" x2="${xC}" y2="${Y(h)}" stroke="#94A3B8" stroke-width="1"/>`;
  s+=`<rect x="${xC}" y="${ya}" width="30" height="${yb-ya}" fill="#93c5fd" stroke="#2563EB" stroke-width="0.8"/>`;
  s+=T(xC,MT-16,'α₁f′c = '+fmt(F.A1*S.mat.fc,2)+' ksi over a = '+fmt(F.a)+'"',' font-size="12"');
  const arrow=(y,v,col)=>{ const L=fl(v); return v>0?cbcArrow(xF,y,xF+L,y,col,2):cbcArrow(xF+L,y,xF,y,col,2); };
  const items=[{y0:Y(F.ybar),v:-F.Cc,col:'#1d4ed8',lab:'C_c = \u2212'+fmt(F.Cc)+' k at ȳ = '+fmt(F.ybar)+'"'}]
    .concat(F.detail.map(L=>({y0:Y(L.d),v:L.F,col:L.F>0?'#DC2626':'#2563EB',
      lab:cbcLn(L)+': '+(L.fs>0?'+':'')+fmt(L.fs,1)+' ksi'+(L.yielded?' (yield)':'')+', '+(L.F>0?'+':'')+fmt(L.F)+' k'})));
  items.forEach(o=>{ s+=arrow(o.y0,o.v,o.col); });
  spread(items.map(o=>Object.assign({},o,{y:o.y0+4})),17).forEach(o=>{ s+=T(xF+78,o.y,o.lab,' font-size="13"'); });
  /* lever arms of T and C_s about C_c */
  const arm=(x,z,lab)=>{ if(z==null) return ''; const y1=Y(F.ybar), y2=Y(F.ybar+z);
    return cbcArrow(x,y1,x,y2,'#7C3AED',1,true)
      +`<line x1="${x-3}" y1="${y2}" x2="${xC}" y2="${y2}" stroke="#C4B5FD" stroke-width="0.6"/>`+T(x-4,(y1+y2)/2+3,lab,' text-anchor="end" fill="#7C3AED" font-size="13"'); };
  s+=arm(xC-12,R.zT,'z_T = '+fmt(R.zT)+'"');
  if(R.zCs!=null&&Math.abs(R.zCs)*sc>6) s+=arm(xC-62,R.zCs,'z_Cs = '+fmt(R.zCs)+'"');
  /* results line */
  const yR=MT+h*sc+(neg?44:30);
  s+=T(xA,yR,'T = '+fmt(R.T)+' kip'+(R.cmp.length?',  C_s = '+fmt(R.Cs)+' kip':'')+',  C_c = '+fmt(F.Cc)+' kip;  M_n = (T z_T'+(R.cmp.length?' + C_s z_Cs':'')+')/12 = '+fmt(F.Mn)+' kip-ft',' font-size="14" font-weight="bold"');
  s+=T(xA,yR+20,'ε_t = '+fmt(F.eps_t,5)+' → '+r.pf.cls.toLowerCase()+', φ = '+fmt(r.pf.phi,3)+';  φM_n = '+fmt(r.phiMn)+' kip-ft  ('+r.name+')',' font-size="14" font-weight="bold"');
  s+='</svg>';
  return s;
}
```

#### Code added — ASD frame
```js
/* CBVL (2026-11-05, Phase 5 graphics): the elastic (working-stress) stress diagram, from compute()'s own results. It is drawn at
   the allowable moment M_all of the inventory level (operating when inventory is off), where the controlling material is at its
   allowable stress. The other material's stress at M_all follows from the same capacity equations, which are linear in the
   stress (M_conc = C f_c z/12000, M_steel = A_s f_s z/12000): f_c = f_c,all·M_all/M_conc, f_s = f_s,all·M_all/M_steel. kd, z,
   C (= C_ff) and A_s are compute()'s. Display only: no rating value changes. */
function asdStressState(R){
  const inv=S.mode.inv!==false||!S.mode.op, lv=inv?'Inventory':'Operating', id=inv?'inv':'op';
  const fcA=inv?R.A.fc_inv:R.A.fc_op, fsA=inv?R.A.fs_inv:R.A.fs_op, Mc=inv?R.M_conc_inv:R.M_conc_op, Ms=inv?R.M_steel_inv:R.M_steel_op;
  const Mg=inv?R.M_inv:R.M_op, ctrl=inv?R.ctrl_inv:R.ctrl_op;
  const fc=Mc>0?fcA*Mg/Mc:NaN, fs=Ms>0?fsA*Mg/Ms:NaN;
  return {lv,id,fcA,fsA,Mc,Ms,Mg,ctrl,fc,fs,C:R.Cff*fc,T:R.As*fs};
}
/* arrowhead as a polygon (no <marker> id: the Report's print copy would resolve it to the hidden screen copy) */
function cbcArrowHeadA(x1,y1,x2,y2,col,L){ const a=Math.atan2(y2-y1,x2-x1), w=L*0.45, px=x2-L*Math.cos(a), py=y2-L*Math.sin(a);
  return '<polygon points="'+x2+','+y2+' '+(px+w*Math.sin(a))+','+(py-w*Math.cos(a))+' '+(px-w*Math.sin(a))+','+(py+w*Math.cos(a))+'" fill="'+col+'"/>'; }
function asdStressSVG(R){
  const P=asdStressState(R), hD=(R.h>R.d)?R.h:R.d+2, bD=R.shape==='rect'?R.b_w:R.b_eff;
  if(!(isFinite(P.fc)&&isFinite(P.fs)&&P.fc>0&&P.fs>0&&R.kd>0)) return '';
  const W=640, MT=50, sc=Math.min(240/hD,120/bD), H=Math.round(MT+hD*sc+68), x0=30;
  const Y=y=>MT+y*sc, oh=(bD-R.b_w)/2;
  const tx=(x,y,s,o)=>'<text x="'+x+'" y="'+y+'"'+(o||'')+'>'+s+'</text>';
  let s='<svg class="dwg asdsd" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="max-width:'+W+'px" font-family="Arial,Helvetica,sans-serif" font-size="10" fill="#0F172A">';
  /* section, to scale */
  const path=R.shape==='rect'?'M'+x0+','+Y(0)+' h'+(bD*sc)+' v'+(hD*sc)+' h'+(-bD*sc)+' Z'
    :'M'+x0+','+Y(0)+' h'+(bD*sc)+' v'+(R.h_f*sc)+' h'+(-oh*sc)+' v'+((hD-R.h_f)*sc)+' h'+(-R.b_w*sc)+' v'+(-(hD-R.h_f)*sc)+' h'+(-oh*sc)+' Z';
  s+='<path d="'+path+'" fill="#eceae4" stroke="#16304F" stroke-width="1.4"/>';
  /* compression zone: flange and web pieces down to kd (no clip-path id, so it prints from the Report's copy) */
  const hfl=R.shape==='rect'?hD:Math.min(R.h_f,hD);
  s+='<rect x="'+x0+'" y="'+Y(0)+'" width="'+(bD*sc)+'" height="'+(Math.min(R.kd,hfl)*sc)+'" fill="#93c5fd" opacity="0.55"/>';
  if(R.kd>hfl) s+='<rect x="'+(x0+oh*sc)+'" y="'+Y(hfl)+'" width="'+(R.b_w*sc)+'" height="'+((R.kd-hfl)*sc)+'" fill="#93c5fd" opacity="0.55"/>';
  s+='<line x1="'+(x0+(R.shape==='rect'?0:oh*sc))+'" y1="'+Y(R.d)+'" x2="'+(x0+(R.shape==='rect'?bD:oh+R.b_w)*sc)+'" y2="'+Y(R.d)+'" stroke="#DC2626" stroke-width="4" stroke-dasharray="1,5" stroke-linecap="round"/>';
  s+=tx(x0,MT-28,'Section (to scale)',' font-weight="bold"');
  /* neutral axis */
  s+='<line x1="'+(x0-6)+'" y1="'+Y(R.kd)+'" x2="'+(W-120)+'" y2="'+Y(R.kd)+'" stroke="#2563EB" stroke-dasharray="6,4" stroke-width="1"/>'+tx(W-116,Y(R.kd)+3,'N.A.',' fill="#2563EB"');
  /* stress diagram: compression (concrete) to the right, tension (steel, drawn as f_s/n) to the left, one straight line through N.A. */
  const xS=330, fMax=Math.max(P.fc,P.fs/R.n,1e-9), k=90/fMax, xT=xS-P.fs/R.n*k;
  s+=tx(xS-90,MT-28,'Elastic stresses at M_all ('+P.lv.toLowerCase()+'): \u2190 tension | compression \u2192',' font-weight="bold"');
  s+='<line x1="'+xS+'" y1="'+Y(0)+'" x2="'+xS+'" y2="'+Y(hD)+'" stroke="#94A3B8"/>';
  s+='<polygon points="'+xS+','+Y(0)+' '+(xS+P.fc*k)+','+Y(0)+' '+xS+','+Y(R.kd)+'" fill="#bfdbfe" stroke="#2563EB" stroke-width="1"/>';
  s+='<line x1="'+xS+'" y1="'+Y(R.d)+'" x2="'+xT+'" y2="'+Y(R.d)+'" stroke="#DC2626" stroke-width="2.5"/>'+cbcArrowHeadA(xS,Y(R.d),xT,Y(R.d),'#DC2626',11);
  s+='<line x1="'+(xS+P.fc*k)+'" y1="'+Y(0)+'" x2="'+xT+'" y2="'+Y(R.d)+'" stroke="#64748B" stroke-width="0.8" stroke-dasharray="3,3"/>';
  s+=tx(xS+P.fc*k+6,Y(0)+4,'f_c = '+grp(P.fc)+' psi'+(P.ctrl==='Concrete'?' (= allowable)':''),' font-weight="bold"');
  s+=tx(xT,Y(R.d)+18,'f_s = '+grp(P.fs)+' psi'+(P.ctrl==='Steel'?' (= allowable)':'')+'; drawn as f_s/n = '+grp(P.fs/R.n)+' psi (n = '+R.n+')',' font-weight="bold"');
  /* kd and z, right of the diagram */
  const xk=xS+230;
  s+='<line x1="'+(xS+P.fc*k+4)+'" y1="'+Y(0)+'" x2="'+(xk+4)+'" y2="'+Y(0)+'" stroke="#C4B5FD" stroke-width="0.6"/>';
  s+='<line x1="'+xk+'" y1="'+Y(0)+'" x2="'+xk+'" y2="'+Y(R.kd)+'" stroke="#334155"/>'+cbcArrowHeadA(xk,Y(R.kd),xk,Y(0),'#334155',8)+cbcArrowHeadA(xk,Y(0),xk,Y(R.kd),'#334155',8)+tx(xk+5,(Y(0)+Y(R.kd))/2+4,'kd = '+fmt(R.kd)+'"');
  const yC=Y(R.d-R.z), xz=xS+160;
  s+='<line x1="'+xz+'" y1="'+yC+'" x2="'+xz+'" y2="'+Y(R.d)+'" stroke="#7C3AED"/>'+cbcArrowHeadA(xz,Y(R.d),xz,yC,'#7C3AED',8)+cbcArrowHeadA(xz,yC,xz,Y(R.d),'#7C3AED',8)+tx(xz+5,(yC+Y(R.d))/2+4,'z = '+fmt(R.z)+'" (C to T)',' fill="#7C3AED"');
  s+='<line x1="'+xS+'" y1="'+yC+'" x2="'+(xz+4)+'" y2="'+yC+'" stroke="#C4B5FD" stroke-width="0.6"/><line x1="'+xS+'" y1="'+Y(R.d)+'" x2="'+(xz+4)+'" y2="'+Y(R.d)+'" stroke="#C4B5FD" stroke-width="0.6"/>';
  const yR=Y(hD)+34;
  s+=tx(x0,yR,'C = C_ff f_c = '+fmt(P.C/1000)+' kip,  T = A_s f_s = '+fmt(P.T/1000)+' kip;  M_all = '+fmt(P.Mg)+' kip-ft ('+P.ctrl.toLowerCase()+' controls)',' font-size="10.5" font-weight="bold"');
  s+=tx(x0,yR+15,'Section to scale; stresses to their own scale. The steel stress is drawn as f_s/n, so both stresses lie on one straight line through N.A.',' font-size="9" fill="#334155"');
  return s+'</svg>';
}
```

## 2026-11-05 — PR: claude/cbc-drawings, PR #806: https://github.com/mlococo88/All-Structural/pull/806 (CBDW: Drawings tab in the Beam Capacity tab — DXF and 11 × 17 drawing sheets: cross section, typical elevation, notes and schedule; display and export only, no result change)

### CBDW. Drawing sheets   [display and export only] [no result change]
- **Engineer request (2026-11-05, Phase 5 graphics, PR C):** a Drawings tab as Spread Footing / Light Pole, using `shared/dxf.js` (viewer, sheetSVG, printSheets, PRINT_NOTE, sheetBorder 0.25 in inset), with sheets on 11 × 17 at a standard scale:
  1. the beam cross section at 1"=1'-0" or 1-1/2"=1'-0", with dimensions, cover, a bar callout per layer, the stirrup size and spacing, and a section-properties note;
  2. the beam elevation with the stirrup layout, or a typical elevation with spacing zones;
  3. a notes / schedule sheet: materials, code, cover, and the Development & Splice lengths.
  - Hooks drawn correctly; title block from the project fields; Download DXF, Print sheet and Print all sheets.
  - `SharedDxf.validate` passes, and `dxf-print-sheets` checks the sheets.
- **Where the tab lives — decision (pending engineer review):** in the **Beam Capacity** tab (frame `#suite-frame-capacity`), after Visuals.
  - That frame holds everything a sheet draws: section, layers (`layerGeom`, `barXs`), cover, stirrups (`stirDia`), materials, code, project fields and results (`CC`).
  - It reads the Development & Splice lengths from the sibling frame's own functions (`readInputs`, `computeFactors`, `calcTension`, `calcHook`, `calcComp`, `calcTensSplice`, `calcCompSplice`, `rbInputErrors`), so no value is computed twice.
  - The ASD tab has no bar layout (A_s only), and Development & Splice has no section.
- **Changes in the Beam Capacity frame** (srcdoc; decoded and re-encoded with CRLF kept):
  - `<script src="shared/dxf.js"></script>` after `shared/projects-ui.js`.
  - `TABS()`: `["tabVisuals","Visuals"],["tabDrawings","Drawings"],["tabValid","Validation"]` (was `["tabVisuals","Visuals"],["tabValid","Validation"]`).
  - `buildOutput`: `case "tabDrawings": buildDrawingsTab(pg); break;`.
  - New block CBDW before `PERSISTENCE (§10)`: `CBDW_SC`, `CBDW`, `cbdwScName`, `cbdwIn`, `cbdwReq`, `cbdwStirHook`, `cbdwDev`, `cbdwBuild`, `cbdwEsc`, `buildDrawingsTab`. The code is below.
- **Shell:** `<script src="shared/dxf.js"></script>` after `shared/report.js`.
  - The frame prints through the shell's copy (`parent.SharedDxf.printSheets`), so the sheets print as the page, one 17 × 11 page each, and not inside the iframe.
  - Ctrl+P / Print still print the Report (checked).
- **Sheets** (model space, full size in inches, side by side; title block from `S.proj`: Project, Project No., Calculated By, Date, Checked By, Checked Date, Scale, Sheet title, Subject, "Concrete Beam Design Suite", n OF N):
  1. **BEAM CROSS SECTION**, 1 1/2" = 1'-0" if it fits, else 1", 3/4", 1/2" = 1'-0".
     - Shows the concrete (rectangle or T), the bars at true diameter and their `layerGeom` positions (positive-moment orientation, as entered), and the closed stirrup drawn as a bar of true diameter.
     - The stirrup's corners are bent to the minimum inside diameter (4 d_b #3–#5, 6 d_b #6–#8). It has two 135° hooks at the top-left corner with a 6 d_b extension, not less than 3 in in ACI mode (ACI 318-19 25.3.2 / Table 25.3.2; AASHTO 10th 5.10.2.1(c), Table 5.10.2.3-1).
     - Interior legs (3 or 4 legs) are drawn straight and noted "interior legs: detailer".
     - Dimensions: b_w, h (b_f, h_f), clear cover in both directions.
     - A callout per layer ("3-#5 BOTTOM", "… TOP", "… LAYER 2") and the stirrup callout (size, spacing, legs, hook, bend).
     - Section-properties table: b_w × h, A_g, I_g (`servicecalc`), A_s bottom / top, bar centre depths, cover provided / required, and φM_n positive / negative (`CC.both`).
  2. **TYPICAL BEAM ELEVATION**, 1" = 1'-0" if it fits, else 3/4", 1/2", 1/4" = 1'-0".
     - The tool has no span, so it shows a typical length max(4h, 10s) with break lines at both ends, the bars continuous and the stirrups at s.
     - Chain dimension n@s and h. One spacing zone, labelled with s_max and its source (`govSmaxInfo`), with "s > s_max: see Detailing tab" when it fails.
     - A note that no span, supports or cutoffs are modelled.
  3. **NOTES AND SCHEDULE**, 3" = 1'-0" if it fits, else 1 1/2", 1", 3/4" = 1'-0" (the scale of the hook detail).
     - General notes: code, f′c, λ, aggregate, f_y, f_yt (and the design f_yt), cover, hooks, and that lengths and cutoffs are not determined.
     - Bar schedule: one row per layer, plus the stirrup with its hook and A_v.
     - Development & splice lengths from the Development & Splice tab: bar, code, f′c / f_y, ℓ_d, ℓ_dh, ℓ_dc, tension lap splice (class) or "not permitted", and compression lap splice, with references. Each length is **rounded up to 1/8 in, with the tab's value beside it**. A flag shows when that bar size is not a size of this section.
     - The 90° standard hook of that bar drawn to scale: ℓ_dh to the outside face of the bend, a bend of 6 / 8 / 10 d_b (or the entered R in AASHTO mode) and the 12 d_b tail (ACI Table 25.3.1 / AASHTO 5.10.2.1, Table 5.10.2.3-1). This is the same geometry as the Dev tab's hook drawing (CBSB #802).
     - Without the suite (frame opened alone) or with a Dev input error, the sheet says so instead.
- **Text:** the DXF is R12 (ASCII). ≥, ≤, φ, ², ⁴, ℓ, λ and ′ are written out (>=, PHI, ^2, L, LAMBDA, '). ° and Ø stay, because `SharedDxf.str` makes them %%d / %%c.
- **Saved data:** the chosen sheet is stored per browser in the new key `rcbeam_dwgSheet_v1` (tool prefix). It is not in the project, the autosave or the export. `S.ui.tab` may now be "tabDrawings"; older saves are unaffected. No key or format changed.
- **Decisions (pending engineer review):**
  - The tab lives in the Beam Capacity frame (above).
  - The elevation is typical, not a span (the tool has no span, supports or cutoffs). It has one spacing zone, the entered s.
  - Development / splice lengths are rounded up, never down, on the sheet.
  - Hook positions: both 135° stirrup hooks at the top-left corner. Interior legs are left to the detailer.
  - The section is drawn in the positive-moment orientation (bottom face = the "tension" layers).
- **Tests:** `tests/smoke/dxf-print-sheets.mjs` gains a `cbc` entry and a frame option (`fr`). The buttons, `known` and `n` are evaluated in the frame, while the print box and the PDFs are in the top page. The other tools are unchanged (sf, spc re-run).
- **How verified (headless Chromium):**
  - `dxf-print-sheets --tool cbc`:
    - Print sheet gives 1 page, 1224 × 792 pt, with the outer border at 18 pt.
    - b_w × h = 12 × 18 in at 1 1/2" = 1'-0" measured 108.00 × 162.00 pt (expected 108 × 162).
    - Print all gives 3 pages of 17 × 11. The box and style are removed. Ctrl+P prints the Report (49 letter pages, no sheet). 0 console errors.
  - `SharedDxf.validate`: ok (POLYLINE, CIRCLE, LINE, ARC, TEXT, DIMENSION; 11 layers) for default, a 48 × 30 T-beam, a 10 × 48 deep beam (3 layers) and a 24 × 36 beam with 4-leg #5 stirrups. Scales: 1 1/2", 1 1/2", 1" and 1 1/2" for the section, and 3" for notes.
  - Sheets and printed PDFs looked at.
  - Results: origin/main vs the branch, cases default, aa100, aci100 and excess. `computeAll`, `allChecks`, ASD and Dev are identical. The text differences are only the new Drawings tab and the tab bar.
  - `check-syntax` (all), `phone-layout --tool cbc` and `run.mjs report steps steps-groups report-wiring` pass.
- **Governing provision:** none changed (drawing geometry only, cited above). **Other copies:** none.

#### Code added — Beam Capacity frame (re-apply by hand)
```js
/* =====================================================================
   DRAWINGS tab (CBDW, 2026-11-05, Phase 5 graphics): drawing sheets, 11 x 17 (B-size) at a standard plot scale
   As Spread Footing (SFDW), Light Pole (LPDW) and Section Property Calculator (SPDW): one DXF R12 file (shared/dxf.js:
   SharedDxf.drawing -> toDXF), each sheet a 17 x 11 in sheet at its plot scale inside its border (SharedDxf.sheetBorder, 0.25 in
   inside the paper edge) and title block, side by side in model space, full size in inches; previewed from the same entities
   (SharedDxf.sheetSVG, SharedDxf.viewer) and printed one 11 x 17 landscape page per sheet at its plot scale
   (SharedDxf.printSheets; in the suite through the shell's copy, so the page prints as the shell, not inside this frame).
     1. BEAM CROSS SECTION: the section as entered, 1 1/2" = 1'-0" or 1" = 1'-0" (the larger that fits; then 3/4", 1/2"),
        dimensions, clear cover, a callout per layer (n-#size), the closed stirrup with its 135-degree hooks, a section-properties note.
     2. TYPICAL BEAM ELEVATION: the tool checks a section, not a span, so a typical length with the entered stirrup spacing
        (one spacing zone), break lines at both ends.
     3. NOTES AND SCHEDULE: materials, code, cover, bar schedule, and the development / splice lengths of the Development &
        Splice tab (read from that tab's own functions in the suite), with its 90-degree standard hook drawn to scale.
   Display and export only: geometry from layerGeom / barXs / stirDia (as svgSection), values from CC and the Development &
   Splice tab's results; nothing is computed for design. Hook and bend geometry (drawing only): stirrup 135-degree hooks with a
   6 d_b extension (ACI: not less than 3 in) and the minimum inside bend diameter 4 d_b (#3-#5) / 6 d_b (#6-#8) (ACI 318-19
   25.3.2, Table 25.3.2; AASHTO 10th 5.10.2.1(c), Table 5.10.2.3-1); 90-degree hooks of longitudinal bars 12 d_b with 6 / 8 / 10 d_b
   (ACI Table 25.3.1; AASHTO 5.10.2.1, Table 5.10.2.3-1).
   Saved: the chosen sheet, per browser, key rcbeam_dwgSheet_v1 (not in the project, the autosave or the export).
   ===================================================================== */
const CBDW_SC=[[8,'1 1/2" = 1\'-0"'],[12,'1" = 1\'-0"'],[16,'3/4" = 1\'-0"'],[24,'1/2" = 1\'-0"'],[4,'3" = 1\'-0"'],[48,'1/4" = 1\'-0"']];
const CBDW={W:17,H:11,m:0.375,tbH:1.0,key:'rcbeam_dwgSheet_v1',cur:null,B:null};
const cbdwScName=k=>(CBDW_SC.find(q=>q[0]===k)||[0,'1:'+k])[1];
const cbdwIn=v=>SharedDxf.fmtIn(v);
/* a required length on the sheet: rounded UP to 1/8 in (never shorter than the tab's value), with the tab's value beside it */
const cbdwReq=v=>isFinite(v)?SharedDxf.fmtIn(Math.ceil(v*8-1e-9)/8)+' ('+fmt(v,2)+')':'-';
/* the stirrup / tie hook and bend (drawing only; see the header) */
function cbdwStirHook(sz){ const ds=REBAR[sz].d, n=parseInt(sz,10), Di=(n<=5?4:6)*ds, ext=S.code==='ACI'?Math.max(6*ds,3):6*ds;
  return {ds,Di,ext,rc:Di/2+ds/2,ref:S.code==='ACI'?'ACI 318-19 25.3.2, TABLE 25.3.2':'AASHTO LRFD 10TH ED. 5.10.2.1(c), TABLE 5.10.2.3-1'}; }
/* the Development & Splice tab's results (suite: the sibling frame; null when not there or it has an input error) */
function cbdwDev(){
  try{ const P=window.parent; if(!P||P===window) return null;
    const fr=P.document.getElementById('suite-frame-dev'), W=fr&&fr.contentWindow; if(!W||!W.readInputs||!W.computeFactors) return null;
    const inp=W.readInputs(), f=W.computeFactors(inp);
    if(W.rbInputErrors&&W.rbInputErrors(inp,f).length) return {err:true};
    const t=W.calcTension(inp,f);
    return {inp,f,t,h:W.calcHook(inp,f),c:W.calcComp(inp,f),ts:W.calcTensSplice(inp,f,t),cs:W.calcCompSplice(inp,f),
      lapNo:W.lapProhibited?W.lapProhibited(inp,f):false};
  }catch(e){ return null; }
}
function cbdwBuild(){
  if(!window.SharedDxf) throw new Error('shared/dxf.js is not loaded');
  if(!CC||VALIDATION.blockers.length) throw new Error('no results (input error)');
  const D=SharedDxf.drawing({prefix:'CB-',fmt:cbdwIn}), SH=[], p=S.proj||{};
  /* DXF R12 text is ASCII (SharedDxf.str writes other characters as \U+XXXX, which the preview shows as typed): the symbols used
     here are written out (degree and diameter stay: SharedDxf.str makes them %%d / %%c) */
  const AS=s=>String(s==null?'':s).replace(/≥/g,'>=').replace(/≤/g,'<=').replace(/φ/g,'PHI ').replace(/²/g,'^2').replace(/⁴/g,'^4').replace(/ℓ/g,'L').replace(/λ/g,'LAMBDA').replace(/′/g,"'").replace(/[–—]/g,'-').replace(/·/g,'x').replace(/&amp;/g,'&');
  const T0=D.text, D0=D.dim; D.text=(l,x,y,hh,s,j,rot)=>T0(l,x,y,hh,AS(s),j,rot); D.dim=(l,p1,p2,b,ang,txt)=>D0(l,p1,p2,b,ang,txt==null?txt:AS(txt));
  const L={conc:D.layer('CONC',7),bar:D.layer('REBAR',1),stir:D.layer('STIRRUP',30),dim:D.layer('DIMS',3),txt:D.layer('TEXT',7),
    ldr:D.layer('LEADER',3),tbl:D.layer('TABLE',7),tb:D.layer('TBLK',7),br:D.layer('BRDR',7),brk:D.layer('BREAK',8),hid:D.layer('HIDDEN',8,'HIDDEN')};
  const AW=CBDW.W-2*CBDW.m-0.5, AH=CBDW.H-2*CBDW.m-CBDW.tbH-0.6;
  let ox=0;
  function sheet(id,title,content,ks,src){
    const i0=D.mark(); let k=null, over=false, ret=null;
    for(const kk of ks){ D.E.length=i0; D.k=kk; D.h=0.1*kk; ret=content(kk)||null; const b=D.bbox(i0);
      if(!isFinite(b[0])||((b[2]-b[0])/kk<=AW&&(b[3]-b[1])/kk<=AH)){ k=kk; break; } }
    if(k===null){ k=ks[ks.length-1]; over=true; }
    const P=k, b=D.bbox(i0), W=CBDW.W*P, H=CBDW.H*P, m=CBDW.m*P, tb=CBDW.tbH*P;
    const cx=ox+W/2, cy=m+tb+0.3*P+(AH*P)/2;
    if(isFinite(b[0])) D.move(i0,cx-(b[0]+b[2])/2,cy-(b[1]+b[3])/2);
    D.k=P; D.h=0.1*P;
    SharedDxf.sheetBorder(D,L.br,ox,W,H,P); D.rect(L.br,ox+m,m,ox+W-m,H-m);
    const x0=ox+m, y0=m, w=(CBDW.W-2*CBDW.m)*P, r=tb/2, sc=(ret&&ret.scale)||cbdwScName(k);
    D.rect(L.tb,x0,y0,x0+w,y0+tb); D.line(L.tb,x0,y0+r,x0+w,y0+r);
    const row1=[['PROJECT',p.name,4.25],['PROJECT NO.',p.num,2],['CALCULATED BY',p.by,2],['DATE',p.date,1.75],['CHECKED BY',p.chk,2],['CHECKED DATE',p.chkDate,1.75],['SCALE',sc,2.5]];
    const row2=[['SHEET TITLE',title,6.25],['SUBJECT',p.subj,3],['DRAWN BY','CONCRETE BEAM DESIGN SUITE',4],['SHEET','?',3]];
    let sheetEnt=null;
    [[row1,y0+r],[row2,y0]].forEach(([row,yb])=>{ let x=x0; row.forEach(([lab,val,cw],ci)=>{
      D.text(L.tb,x+0.05*P,yb+r-0.11*P,0.065*P,lab,0);
      const mx=Math.floor((cw-0.12)/(0.13*0.9)); D.text(L.tb,x+0.05*P,yb+0.1*P,0.13*P,String(val==null||val===''?'—':val).toUpperCase().slice(0,mx),0);
      if(lab==='SHEET') sheetEnt=D.E[D.E.length-1];
      x+=cw*P; if(ci<row.length-1) D.line(L.tb,x,yb,x,yb+r); }); });
    const sh={id,title,k,i0,i1:D.mark(),ox,W,H,over,sheetEnt,src,scale:sc,known:ret&&ret.known}; SH.push(sh); ox+=W+1*P; return sh;
  }
  function table(x0,y0,head,rows,hh,right){
    const rh=hh*2, cw=head.map((hd,c)=>Math.max(String(hd).length,...rows.map(r=>String(r[c]==null?'':r[c]).length))*hh*0.82+1.9*hh);
    const tot=cw.reduce((a,b)=>a+b,0); let y=y0;
    const line=yy=>D.line(L.tbl,x0,yy,x0+tot,yy);
    line(y); [head,...rows].forEach((r,ri)=>{ let x=x0; r.forEach((v,c)=>{ const rt=right&&right.includes(c)&&ri>0; D.text(L.tbl,rt?x+cw[c]-0.8*hh:x+0.8*hh,y-rh+0.6*hh,hh,String(v==null?'':v),rt?2:0); x+=cw[c]; });
      y-=rh; line(y); if(ri===0) line(y+0.12*hh); });
    let x=x0; [0,...cw].forEach(w=>{ x+=w; D.line(L.tbl,x,y0,x,y); });
    return {w:tot,h:y0-y};
  }
  /* a bar of diameter t drawn to scale along a centre-line path of lines and arcs: both faces (offset +-t/2) */
  function barPath(l,segs,t){ segs.forEach(sg=>{
    if(sg.a){ [sg.r-t/2,sg.r+t/2].forEach(rr=>{ if(rr>1e-6) D.arc(l,sg.c[0],sg.c[1],rr,sg.a0,sg.a1); }); return; }
    const dx=sg.x2-sg.x1, dy=sg.y2-sg.y1, Ls=Math.hypot(dx,dy)||1, nx=-dy/Ls*t/2, ny=dx/Ls*t/2;
    D.line(l,sg.x1+nx,sg.y1+ny,sg.x2+nx,sg.y2+ny); D.line(l,sg.x1-nx,sg.y1-ny,sg.x2-nx,sg.y2-ny); }); }
  const pt=(c,r,a)=>[c[0]+r*Math.cos(a*Math.PI/180),c[1]+r*Math.sin(a*Math.PI/180)];
  const {bw,h,bf,hf,type}=S.sec, tee=type==='tee', cc=S.cover.cc, G=layerGeom(false);
  const hk=S.stir.present?cbdwStirHook(S.stir.size):null;
  const faceOf=Lr=>Lr.face==='compression'?'TOP':'BOTTOM';
  const layerName=(Lr,j)=>{ const same=G.filter(q=>q.face===Lr.face), k=same.indexOf(Lr); return faceOf(Lr)+(same.length>1?' LAYER '+(k+1):''); };
  const svc=servicecalc(CC.govRow.F,false), B2=CC.both||bothSenses();
  const AsF=f=>G.filter(q=>q.face===f).reduce((s,q)=>s+q.As,0);

  /* ---------- 1. BEAM CROSS SECTION ---------- */
  sheet('sec','BEAM CROSS SECTION',P=>{
    const th=0.09*P, i0=D.mark();
    /* concrete: y up from the bottom; x from the centre line */
    if(tee) D.pline(L.conc,[[-bw/2,0],[bw/2,0],[bw/2,h-hf],[bf/2,h-hf],[bf/2,h],[-bf/2,h],[-bf/2,h-hf],[-bw/2,h-hf]],true);
    else D.rect(L.conc,-bw/2,0,bw/2,h);
    /* longitudinal bars, true size, at their positions (layerGeom, positive-moment convention: physical) */
    G.forEach(Lr=>{ barXs(Lr.n,Lr.db).forEach(x=>D.circle(L.bar,x,h-Lr.yTop,Lr.db/2)); });
    /* closed stirrup: centre line at the cover, corners bent to the minimum inside diameter, 135-degree hooks at the top-left corner */
    if(hk){ const xL=-bw/2+cc+hk.ds/2, xR=bw/2-cc-hk.ds/2, yB=cc+hk.ds/2, yT=h-cc-hk.ds/2, rc=hk.rc;
      const cTL=[xL+rc,yT-rc], cTR=[xR-rc,yT-rc], cBR=[xR-rc,yB+rc], cBL=[xL+rc,yB+rc];
      const a45=pt(cTL,rc,45), a225=pt(cTL,rc,225), u=Math.SQRT1_2;
      const segs=[
        {x1:a45[0]+hk.ext*u,y1:a45[1]-hk.ext*u,x2:a45[0],y2:a45[1]},            /* hook 1 extension (end of the left leg's hook) */
        {a:1,c:cTL,r:rc,a0:45,a1:180},                                            /* hook 1 bend 135 degrees (90 + 45) */
        {x1:xL,y1:yT-rc,x2:xL,y2:yB+rc},{a:1,c:cBL,r:rc,a0:180,a1:270},
        {x1:xL+rc,y1:yB,x2:xR-rc,y2:yB},{a:1,c:cBR,r:rc,a0:270,a1:360},
        {x1:xR,y1:yB+rc,x2:xR,y2:yT-rc},{a:1,c:cTR,r:rc,a0:0,a1:90},
        {x1:xR-rc,y1:yT,x2:xL+rc,y2:yT},
        {a:1,c:cTL,r:rc,a0:90,a1:225},                                            /* hook 2 bend 135 degrees */
        {x1:a225[0],y1:a225[1],x2:a225[0]+hk.ext*u,y2:a225[1]-hk.ext*u}];        /* hook 2 extension */
      barPath(L.stir,segs,hk.ds);
      /* interior legs (3 or 4 legs): straight legs between the faces; their hooks are by the detailer (noted) */
      for(let j=1;j<=S.stir.legs-2;j++){ const x=xL+(xR-xL)*j/(S.stir.legs-1); barPath(L.stir,[{x1:x,y1:yB,x2:x,y2:yT}],hk.ds); }
      /* stirrup callout, leader to the right leg */
      const tx=(tee?bf:bw)/2+1.6*P, ty=h*0.62;
      D.line(L.ldr,xR+hk.ds/2,ty-0.03*P,tx-0.05*P,ty+0.05*P);
      ['#'+S.stir.size+' CLOSED STIRRUP @ '+cbdwIn(S.stir.s)+' O.C., '+S.stir.legs+' LEGS'+(S.stir.legs>2?' (INTERIOR LEGS: DETAILER)':''),
       '135° HOOKS, '+cbdwIn(hk.ext)+' EXT. ('+(S.code==='ACI'?'6d_b, ≥ 3"':'6d_b')+'), BEND Ø '+cbdwIn(hk.Di)+' ('+(parseInt(S.stir.size,10)<=5?4:6)+'d_b)',
       hk.ref].forEach((s,j)=>D.text(L.txt,tx,ty-j*0.16*P,th,s,0));
    }
    /* bar callouts per layer: left of the section, leader to the first bar */
    const xl=-(tee?bf:bw)/2-1.2*P;
    G.slice().sort((a,b)=>a.yTop-b.yTop).forEach((Lr,j,A)=>{ const y=h-Lr.yTop, xs=barXs(Lr.n,Lr.db), yy=y+(j-(A.length-1)/2)*0.0;
      D.text(L.txt,xl,yy-0.04*P,th,Lr.n+'-#'+Lr.size+' '+layerName(Lr),2); D.line(L.ldr,xl+0.05*P,yy,xs[0]-Lr.db/2,y); D.circle(L.ldr,xs[0],y,0.02*P); });
    /* dimensions: b_w, h, b_f / h_f, clear cover to the stirrup (or to the bars without stirrups), d per layer from the top */
    D.dimH(L.dim,-bw/2,bw/2,-0.5*P,0);
    D.dimV(L.dim,0,h,(tee?bf:bw)/2+0.5*P,(tee?bf:bw)/2);
    if(tee){ D.dimH(L.dim,-bf/2,bf/2,h+0.45*P,h); D.dimV(L.dim,h-hf,h,-bf/2-0.45*P,-bf/2); }
    D.dimH(L.dim,-bw/2,-bw/2+cc,-0.95*P,0,'<> CLR');
    D.dimV(L.dim,0,cc,bw/2+(tee?(bf-bw)/2:0)+1.0*P,bw/2,'<> CLR');
    const sb=D.bbox(i0);
    D.text(L.txt,(sb[0]+sb[2])/2,sb[1]-0.4*P,0.16*P,'SECTION A-A',1);
    D.text(L.txt,(sb[0]+sb[2])/2,sb[1]-0.62*P,0.09*P,'SCALE '+cbdwScName(P)+';  POSITIVE-MOMENT ORIENTATION (TENSION FACE BOTTOM), AS ENTERED',1);
    /* section properties note, to the right */
    const nx=sb[0]; let ny=sb[1]-1.0*P;
    D.text(L.txt,nx,ny,0.13*P,'SECTION PROPERTIES',0); ny-=0.28*P;
    const rows=[['b_w × h',cbdwIn(bw)+' × '+cbdwIn(h)],...(tee?[['b_f × h_f',cbdwIn(bf)+' × '+cbdwIn(hf)]]:[]),
      ['A_g',fmt(tee?bf*hf+bw*(h-hf):bw*h,1)+' in²'],['I_g (gross, bars neglected)',fmt(svc.Ig,0)+' in⁴'],
      ['A_s bottom / top',fmt(AsF('tension'),2)+' / '+fmt(AsF('compression'),2)+' in²'],
      ...G.map(Lr=>['TOP OF SECTION TO '+Lr.n+'-#'+Lr.size+' '+layerName(Lr)+' (BAR CENTRE)',cbdwIn(Lr.yTop)]),
      ['CLEAR COVER (PROVIDED / REQUIRED)',cbdwIn(cc)+' / '+cbdwIn(S.cover.req)],
      ['φM_n POSITIVE / NEGATIVE',fmt(B2.pos.phiMn,1)+' / '+fmt(B2.neg.phiMn,1)+' kip-ft']];
    const t=table(nx,ny,['ITEM','VALUE'],rows,0.085*P);
    D.text(L.txt,nx,ny-t.h-0.2*P,0.07*P,'VALUES FROM THE BEAM CAPACITY TAB (INPUT ECHO, SERVICEABILITY, SUMMARY "SECTION CAPACITIES").',0);
    return {known:{w:bw/P,h:h/P,what:'concrete b_w × h = '+bw+' × '+h+' in'}};
  },[8,12,16,24],['tabInputEcho','Input Echo']);

  /* ---------- 2. TYPICAL BEAM ELEVATION ---------- */
  sheet('elev','TYPICAL BEAM ELEVATION',P=>{
    const th=0.09*P, sSp=S.stir.present?S.stir.s:null, info=govSmaxInfo();
    const Lel=Math.max(4*h,sSp?10*sSp:4*h), nS=sSp?Math.floor((Lel-sSp)/sSp)+1:0, x0s=sSp?(Lel-(nS-1)*sSp)/2:0;
    /* concrete with break lines at both ends (the length is not a span) */
    const zig=x=>[[x,0],[x,h*0.42],[x-0.12*P,h*0.47],[x+0.12*P,h*0.53],[x,h*0.58],[x,h]];
    D.line(L.conc,0,0,Lel,0); D.line(L.conc,0,h,Lel,h); if(tee) D.line(L.hid,0,h-hf,Lel,h-hf,D.ltype('HIDDEN'));
    D.pline(L.brk,zig(0),false); D.pline(L.brk,zig(Lel),false);
    G.forEach(Lr=>{ const y=h-Lr.yTop; D.line(L.bar,0.2*P,y-Lr.db/2,Lel-0.2*P,y-Lr.db/2); D.line(L.bar,0.2*P,y+Lr.db/2,Lel-0.2*P,y+Lr.db/2); });
    if(sSp){ const ds=hk.ds, xs=[];
      for(let i=0;i<nS;i++){ const x=x0s+i*sSp; xs.push(x); D.line(L.stir,x-ds/2,cc,x-ds/2,h-cc); D.line(L.stir,x+ds/2,cc,x+ds/2,h-cc); }
      D.chainH(L.dim,xs,h+0.45*P,h);
      D.dimH(L.dim,0,Lel,-0.95*P,0,'<> SHOWN (TYPICAL LENGTH, NOT A SPAN)');
      const zt='ZONE 1 (THE ONLY ZONE): #'+S.stir.size+' CLOSED STIRRUPS @ '+cbdwIn(sSp)+' O.C.'+(info?';  s_max = '+cbdwIn(info.smax)+' ('+String(info.src).toUpperCase()+')'+(sSp>info.smax+1e-9?' — s > s_max: SEE DETAILING TAB':''):'');
      D.text(L.txt,0,h+1.0*P,th,zt,0);
    } else D.text(L.txt,0,h+0.6*P,th,'NO STIRRUPS SPECIFIED',0);
    D.dimV(L.dim,0,h,-0.5*P,0);
    G.forEach((Lr,j)=>{ const y=h-Lr.yTop; D.text(L.txt,Lel+0.35*P,y-0.04*P,th,Lr.n+'-#'+Lr.size+' '+layerName(Lr)+' (CONT.)',0); D.line(L.ldr,Lel+0.3*P,y,Lel-0.2*P,y); });
    const sb=D.bbox();
    D.text(L.txt,Lel/2,-1.5*P,0.16*P,'TYPICAL BEAM ELEVATION',1);
    D.text(L.txt,Lel/2,-1.72*P,0.09*P,'SCALE '+cbdwScName(P)+';  THE TOOL CHECKS ONE CROSS SECTION: NO SPAN, SUPPORTS OR BAR CUTOFFS ARE MODELLED (SECTION A-A, SHEET 1)',1);
    return {known:{w:Lel/P,what:'length shown '+cbdwIn(Lel)}};
  },[12,16,24,48],['tabDetail','Detailing']);

  /* ---------- 3. NOTES AND SCHEDULE ---------- */
  const DV=cbdwDev();
  sheet('notes','NOTES AND SCHEDULE',P=>{
    const th=0.09*P, ACI=S.code==='ACI', notes=[
      'DESIGN CODE: '+(ACI?'ACI 318-19':'AASHTO LRFD BRIDGE DESIGN SPECIFICATIONS, 10TH ED. (2024)')+' (STRENGTH DESIGN, ONE CROSS SECTION).',
      "CONCRETE: f'c = "+fmt(S.mat.fc,2)+' KSI ('+Math.round(S.mat.fc*1000)+' PSI), λ = '+fmt(S.mat.lambda,2)+', MAX. AGGREGATE '+cbdwIn(S.mat.dagg)+'.',
      'LONGITUDINAL REINFORCEMENT: f_y = '+fmt(S.mat.fy,0)+' KSI.',
      'TRANSVERSE REINFORCEMENT: f_yt = '+fmt(S.mat.fyt,0)+' KSI (DESIGN VALUE USED: '+fmt(fytDesign(),0)+' KSI).',
      'CLEAR COVER: '+cbdwIn(cc)+' TO THE STIRRUPS (REQUIRED '+cbdwIn(S.cover.req)+', '+String(S.cover.exposure||'').toUpperCase()+').',
      'STANDARD HOOKS AND BENDS: '+(ACI?'ACI 318-19 25.3':'AASHTO 5.10.2')+'. STIRRUP HOOKS 135°, 6d_b'+(ACI?' (≥ 3")':'')+' EXTENSION.',
      'BAR LENGTHS, CUTOFFS AND SPLICE LOCATIONS ARE NOT DETERMINED BY THIS TOOL (ONE CROSS SECTION).'];
    D.text(L.txt,0,0.35*P,0.15*P,'GENERAL NOTES',0);
    notes.forEach((s,j)=>D.text(L.txt,0,-(0.05+0.2*j)*P,th,(j+1)+'. '+s,0));
    let y=-(0.3+0.2*notes.length)*P;
    D.text(L.txt,0,y,0.15*P,'BAR SCHEDULE (ONE CROSS SECTION)',0); y-=0.15*P;
    const rows=G.map((Lr,j)=>['L'+(j+1),'#'+Lr.size,String(Lr.n),layerName(Lr),'STRAIGHT (LENGTH BY SPAN)',fmt(Lr.As,2)]);
    if(hk) rows.push(['S1','#'+S.stir.size,S.stir.legs+' LEGS','CLOSED STIRRUP @ '+cbdwIn(S.stir.s),'135° HOOKS '+cbdwIn(hk.ext)+', BEND Ø '+cbdwIn(hk.Di),fmt(S.stir.legs*REBAR[S.stir.size].a,2)+' (A_v)']);
    const t1=table(0,y,['MARK','SIZE','NO.','LOCATION','SHAPE','A_s (IN²)'],rows,th,[5]); y-=t1.h+0.45*P;
    D.text(L.txt,0,y,0.15*P,'DEVELOPMENT AND SPLICE LENGTHS (DEVELOPMENT & SPLICE TAB)',0); y-=0.15*P;
    let hook=null;
    if(!DV) D.text(L.txt,0,y-0.15*P,th,'NOT AVAILABLE HERE: OPEN THE SUITE (CONCRETE BEAM CAPACITY.HTML) AND THE DEVELOPMENT & SPLICE TAB.',0);
    else if(DV.err) D.text(L.txt,0,y-0.15*P,th,'NOT SHOWN: THE DEVELOPMENT & SPLICE TAB HAS AN INPUT ERROR.',0);
    else { const i=DV.inp, f=DV.f, A=f.AASHTO, sz=String(i.barSize), inLay=G.some(q=>String(q.size)===sz);
      const r2=[['BAR','#'+sz+(inLay?'':' (NOT A SIZE OF THIS SECTION)'),'—'],['CODE',A?'AASHTO LRFD 10TH ED. 5.10.8':'ACI 318-19 25.4, 25.5','—'],
        ["f'c / f_y",fmt(i.fc,0)+' / '+fmt(i.fy,0)+' PSI','—'],
        ['TENSION DEVELOPMENT ℓ_d',cbdwReq(DV.t.ld),A?'5.10.8.2.1a':'25.4.2'],
        ['STANDARD HOOK ℓ_dh (90°)',cbdwReq(DV.h.ldh),A?'5.10.8.2.4a':'25.4.3'],
        ['COMPRESSION DEVELOPMENT ℓ_dc',cbdwReq(DV.c.ldc),A?'5.10.8.2.2a':'25.4.9'],
        ['TENSION LAP SPLICE, CLASS '+String(i.tensClass||'B'),DV.lapNo?'NOT PERMITTED':cbdwReq(DV.ts.lst),A?'5.10.8.4.3a':'25.5.2'],
        ['COMPRESSION LAP SPLICE',cbdwReq(DV.cs.lsc),A?'5.10.8.4.5a':'25.5.5']];
      const t2=table(0,y,['ITEM','VALUE','REFERENCE'],r2,th,[1]); y-=t2.h;
      D.text(L.txt,0,y-0.2*P,0.07*P,'LENGTHS ROUNDED UP TO 1/8" (THE TAB\'S VALUE IN BRACKETS), FOR THAT TAB\'S BAR AND INPUTS (c_b, K_tr, FACTORS): CHECK THEY MATCH THIS SECTION.',0);
      /* the 90-degree standard hook of that bar, to scale, right of the tables */
      const db=f.db, nb=parseInt(sz,10), Dm=(nb<=8?6:(nb<=11?8:10))*db, Rc=(A&&DV.h.R>0)?DV.h.R:Dm/2+db/2, ldh=DV.h.ldh, tail=12*db;
      const hx=Math.max(t1.w,t2.w)+2.2*P, hy=-0.3*P, yo=hy-ldh, yc=yo+db/2;
      barPath(L.bar,[{x1:hx,y1:hy,x2:hx,y2:yc+Rc},{a:1,c:[hx+Rc,yc+Rc],r:Rc,a0:180,a1:270},{x1:hx+Rc,y1:yc,x2:hx+Rc+tail,y2:yc}],db);
      D.line(L.dim,hx-0.6*P,hy,hx+0.6*P,hy,D.ltype('DASHED')); D.text(L.txt,hx+0.65*P,hy-0.04*P,th,'CRITICAL SECTION',0);
      D.dimV(L.dim,yo,hy,hx-0.7*P,hx-db/2,'ℓ_dh = '+cbdwReq(ldh));
      D.dimH(L.dim,hx+Rc,hx+Rc+tail,yo-0.45*P,yo,'12d_b = <>');
      D.text(L.txt,hx+Rc+tail+0.15*P,yc-0.04*P,th,'BEND Ø '+cbdwIn(A&&DV.h.Rentered?2*Rc-db:Dm)+(A&&DV.h.Rentered?' (ENTERED R)':' ('+(nb<=8?6:(nb<=11?8:10))+'d_b)'),0);
      D.text(L.txt,hx,yo-1.1*P,0.12*P,'STANDARD 90° HOOK, #'+sz,0);
      D.text(L.txt,hx,yo-1.3*P,0.075*P,'SCALE '+cbdwScName(P)+';  ℓ_dh TO THE OUTSIDE FACE OF THE BEND; '+(A?'AASHTO 5.10.2.1, TABLE 5.10.2.3-1':'ACI 318-19 TABLE 25.3.1'),0);
      hook={w:tail/P};
    }
    return {known:hook?{w:hook.w,what:'hook tail 12 d_b'}:null};
  },[4,8,12,16],['tabDetail','Detailing']);
  SH.forEach((s,j)=>{ s.sheetEnt.s=SharedDxf.str((j+1)+' OF '+SH.length); });
  return {D,S:SH,dev:DV};
}
function cbdwEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function buildDrawingsTab(pg){
  const T=el('div'); pg.appendChild(T);
  if(!window.SharedDxf){ T.appendChild(el('div','errBox','shared/dxf.js is not loaded: keep the shared folder next to this file.')); return; }
  let B; try{ B=cbdwBuild(); }catch(e){ T.appendChild(el('div','errBox','The drawings could not be drawn: '+(e&&e.message))); return; }
  CBDW.B=B;
  let want=CBDW.cur; if(!want){ try{ want=localStorage.getItem(CBDW.key)||''; }catch(e){ want=''; } }
  const cur=B.S.find(s=>s.id===want)||B.S[0]; CBDW.cur=cur.id;
  const PD=(()=>{ try{ const P=window.parent; return P&&P!==window&&P.SharedDxf&&P.SharedDxf.printSheets?P.SharedDxf:SharedDxf; }catch(e){ return SharedDxf; } })();
  T.innerHTML='<div class="btnRow"><label style="font-size:9pt">Sheet <select id="cbdwSheet">'+B.S.map((s,j)=>'<option value="'+s.id+'"'+(s===cur?' selected':'')+'>'+(j+1)+'. '+cbdwEsc(s.title)+'</option>').join('')+'</select></label> '+
    '<button type="button" class="b" id="cbdwDxf">Download DXF ('+B.S.length+' sheets)</button> '+
    '<button type="button" class="b" id="cbdwPrint1" title="Print the sheet shown: one 11 x 17 in landscape page at its plot scale">Print sheet</button> '+
    '<button type="button" class="b" id="cbdwPrintAll" title="Print every sheet: one 11 x 17 in landscape page per sheet, each at its plot scale">Print all sheets ('+B.S.length+')</button></div>'+
    '<div class="note">'+cbdwEsc(SharedDxf.PRINT_NOTE)+'</div>'+
    '<div class="note">One DXF file (AutoCAD R12, model space, full size in inches): each sheet is a B-size sheet (17 × 11 in) at its plot scale inside its border and title block, side by side. Layers CB-CONC, CB-REBAR, CB-STIRRUP, CB-DIMS, CB-TEXT, CB-LEADER, CB-TABLE, CB-TBLK, CB-BRDR, CB-BREAK, CB-HIDDEN. Title block: the project fields in the header (Project, Project No., Subject, Calculated By, Date, Checked By, Checked Date).'+
    (B.dev?'':' The development and splice lengths come from the Development &amp; Splice tab of the suite: not available when this tab is opened on its own.')+'</div>'+
    '<div class="note"><b>'+(B.S.indexOf(cur)+1)+'. '+cbdwEsc(cur.title)+'</b> · scale '+cbdwEsc(cur.scale)+(cur.over?' · <span style="color:var(--red-600)">does not fit the sheet even at the smallest scale</span>':'')+'</div>'+
    '<div class="cbdwBox"></div><div class="note">Wheel: zoom about the cursor · drag: pan · pinch · double-click: fit · + / − / Fit buttons.</div>'+
    '<table class="rt"><tr><th>No.</th><th>Sheet</th><th>Scale</th><th>Worked in</th></tr>'+B.S.map((s,j)=>'<tr data-cbdw="'+s.id+'" style="cursor:pointer'+(s===cur?';background:#eff6ff':'')+'"><td>'+(j+1)+'</td><td>'+cbdwEsc(s.title)+'</td><td>'+cbdwEsc(s.scale)+'</td><td><a href="#" data-cbdwgo="'+s.src[0]+'">'+cbdwEsc(s.src[1])+' tab</a></td></tr>').join('')+'</table>';
  cbcWorkedIn(T,[{tab:"tabInputEcho",c:{card:"ieSchematic",name:"Section Schematic (to scale)"},txt:"section, bars, cover"},{tab:"tabDetail",c:{card:"detdStirS",name:"Maximum stirrup spacing"},txt:"s, s_max"}]);
  SharedDxf.viewer(T.querySelector('.cbdwBox'),SharedDxf.sheetSVG(B.D,cur),{height:'62vh'});
  const pick=id=>{ CBDW.cur=id; try{ localStorage.setItem(CBDW.key,id); }catch(e){} refresh(); };
  T.querySelector('#cbdwSheet').addEventListener('change',e=>pick(e.target.value));
  T.querySelectorAll('tr[data-cbdw]').forEach(tr=>tr.addEventListener('click',e=>{ if(e.target.closest('a')) return; pick(tr.dataset.cbdw); }));
  T.querySelectorAll('a[data-cbdwgo]').forEach(a=>a.addEventListener('click',e=>{ e.preventDefault(); S.ui.tab=a.dataset.cbdwgo; autosave(); refresh(); }));
  T.querySelector('#cbdwDxf').addEventListener('click',()=>{ const txt=B.D.toDXF({ltscale:1}), chk=SharedDxf.validate(txt);
    if(!chk.ok){ alert('The DXF file failed its structure check:\n'+chk.errors.slice(0,8).join('\n')); return; }
    SharedDxf.download(txt,String(S.proj.num||S.proj.name||'concrete_beam').replace(/[^\w.-]+/g,'_')+'_drawings.dxf'); });
  const prt=list=>PD.printSheets(list.map(s=>({svg:SharedDxf.sheetSVG(B.D,s),title:s.title})),{paper:[CBDW.W,CBDW.H]});
  T.querySelector('#cbdwPrint1').addEventListener('click',()=>prt([cur]));
  T.querySelector('#cbdwPrintAll').addEventListener('click',()=>prt(B.S));
}
```

## 2026-11-05 — PR: claude/cbc-print-ids, PR #807: https://github.com/mlococo88/All-Structural/pull/807 (CBPI: Report figures print their markers, hatching and clip paths; the compression-fibre tag of the cross-section no longer overlaps a d label or b_w; display only, no result change)

### CBPI-1. SVG ids in the printed Report   [display only]
- **Problem:** at print, the Report is rendered a second time into the print box `#rp-print`, while the Report tab's own copy stays in the page, hidden.
  - A figure's `url(#id)` (marker, pattern, clip path) resolves to the first element with that id in the document. That is the hidden copy's element, which does not paint.
  - In the printed PDF this lost the dimension arrowheads of the overview cross-section and elevation (§2.1 / §2.2) and of the Input Echo copies, and the hatching (pattern `cp`, clip `cc`) of the ASD "Transformed section and stress block".
  - Found by a headless check: in the print state, every `url(#…)` / `href="#…"` inside an SVG of `#rp-print` must resolve to an element of the same figure inside `#rp-print`. Main had 10 failing references in 5 figures; the branch has 0 of 26.
- **Fix (suite shell, after the `beforeprint` listener that fills `#rp-print`; anchor `/* CBPI (2026-11-05): the print box is a second rendering`):**
  - A new `beforeprint` listener, `uniqSvgIds(box)`.
  - Each top-level SVG of the print box gets its own ids: every id defined in it gets the suffix `-pr<n>`, and the references in that SVG (`fill`, `stroke`, `clip-path`, `mask`, `filter`, `marker-*`, `style`, `href`) follow.
  - It runs after the box is filled, whether by this shell (Ctrl+P on the Report tab) or by `SharedReport.print` (Print / PDF). The Report tab's own copy and the frames are not touched.
  - Code:
```js
  var PI_N=0;
  function uniqSvgIds(root){
    var A=['fill','stroke','clip-path','mask','filter','marker-start','marker-mid','marker-end','style','href','xlink:href'];
    Array.prototype.forEach.call(root.querySelectorAll('svg'),function(svg){ if(svg.parentNode&&svg.parentNode.closest&&svg.parentNode.closest('svg')) return;
      var defs=svg.querySelectorAll('[id]'); if(!defs.length) return; var sfx='-pr'+(++PI_N), map={};
      Array.prototype.forEach.call(defs,function(e){ map[e.id]=e.id+sfx; e.id=map[e.id]; });
      Array.prototype.forEach.call(svg.querySelectorAll('*'),function(e){ A.forEach(function(a){ var v=e.getAttribute(a); if(!v||v.indexOf('#')<0) return;
        var w=v.replace(/url\((["']?)#([^"')\s]+)\1\)/g,function(m,q,id){ return map[id]?'url('+q+'#'+map[id]+q+')':m; });
        if((a==='href'||a==='xlink:href')&&w.charAt(0)==='#'&&map[w.slice(1)]) w='#'+map[w.slice(1)];
        if(w!==v) e.setAttribute(a,w); }); }); });
  }
  window.addEventListener('beforeprint',function(){
    var box=document.getElementById('rp-print'); if(!box||!document.body.classList.contains('rp-printing')||box.getAttribute('data-cbpi')===box.innerHTML.length+'') return;
    try{ uniqSvgIds(box); box.setAttribute('data-cbpi',box.innerHTML.length+''); }catch(e){}
  });
```
- **Other tools checked with the same probe (findings only; not changed here):**
  - Spread Footing: its own per-copy ids (SFCB `sfxUniq` / `sfxUniqDom`) work; markers, gradients and clip paths resolve inside each printed figure.
    - One different finding: the Report tab plan ("Plan: footing, pedestals, load points …", `planSVG`) uses `marker-start/-end="url(#a1)"` on the B dimension, but no marker `a1` is defined anywhere. The B dimension has no arrowheads on screen or in print.
    - This is a missing definition, not the print-copy pattern, so it is left for a Spread Footing PR.
  - Light Pole and Sign Post: its printed Report figures use no `url(#…)` references (0 found); nothing to fix.

### CBPI-2. Compression-fibre tag of the cross-section   [display only]
- **Problem:** in `svgSection` (Input Echo, Visuals and the Report copies), the tag "extreme compression fibre … ε = 0.003" was centred on the section.
  - On a deep or narrow section, the rotated layer-depth label of a short dimension (e.g. "d(C2)=2.81"") reaches above the top face and ran into it.
  - In negative bending, the tag (at Y(h) + 30) also sat on the "b_w = …" label (at Y(h) + 27).
- **Fix (`svgSection`, anchor `/* compression-fibre tag`):**
  - Before: `` s+=`<text x="${X(0)}" y="${compAtTop?Y(0)-6:Y(h)+30}" … text-anchor="middle" …` ``.
  - After: `` s+=`<text x="${X(-(tee?bf:bw)/2)}" y="${compAtTop?Y(0)-6:Y(h)+38}" … text-anchor="start" …` ``.
  - The tag starts at the section's left face: the layer-depth labels are all left of that face. At the bottom it sits 8 px lower, below the b_w label.
- **Checked:** bounding boxes of the tag against every other text of the drawing, for 7 cases (default, −M, 10 × 48, 10 × 48 with −M, 8 × 60 with 4 layers, a 48 × 30 T-beam, and the T-beam with −M).
  - Main: overlaps in 5 cases (d(C2); d(C3) and d(C4); b_w in the three −M cases).
  - Branch: 0 overlaps. The tag is inside the drawing in every case.
- **Saved data:** none. **Governing provision:** none. **Other copies:** none.
- **How verified:**
  - Results vs origin/main (cases default, aa100, aci100 and excess): `CC` ×2 and the Dev results are identical. The tab text is unchanged.
  - Report printed (49 pages) and looked at:
    - p. 6: overview section and elevation with arrowheads;
    - p. 29: ASD section hatched.
  - `check-syntax`, `phone-layout --tool cbc`, `dxf-print-sheets --tool cbc` and `run.mjs report steps steps-groups report-wiring` pass.

## 2026-11-05 — PR: claude/github-sync-rollout (PR #811: https://github.com/mlococo88/All-Structural/pull/811) (GHS: saved projects copied to a private GitHub repository; storage only, no result change)
- **Engineer:** the same saved projects on every device (`docs/github-sync-setup.md`; shared code `shared/github-sync.js`, fix log `shared-github-sync.md`; pilot Spread Footing, PR #808).
- **Where:** the Development & Splice frame (the escaped srcdoc page that holds the rebar calculator): after its `<script src=&quot;shared/projects-ui.js&quot;></script>`, new `<script src=&quot;shared/github-sync.js&quot;></script>`; in `rbPlibInit`, `SharedProjectsUI.libraryDialog({` gets a first property `cloud:{tool:'aci-rebar-development', …}` (anchor `GHS (2026-11-05): GitHub sync of this list`).
- **File on GitHub:** `projects/aci-rebar-development/<name>.json`: the stored item is the export (`collectState()`), indent 2. **Download (fromFile):** an object with `inp`; Open then goes through the dialog's existing `open`.
- **Saved data:** `rebar_aci_projects_v1` and the autosave unchanged (key and format). With sync off nothing is written and no request is made.
- **How verified:** `node tests/smoke/project-library.mjs` for this tool (origin/main vs branch, sync off): ALL PASS. `node tests/smoke/github-sync-tools.mjs`: Save → file on GitHub; update with sha; a GitHub-only copy opened gives the same results as the saved project; 0 console errors.
- **Formulas, factors, units, code references:** none.

## 2026-11-05 — PR: claude/header-cbc (PR #812: https://github.com/mlococo88/All-Structural/pull/812) (CBHD: compact headers; title blocks, project file and shared-project-info buttons moved to each tab's Project input tab; display only, no result change)
- **Engineer:** clean up the top of the page: the title-block inputs and the project / hand-off buttons go into the Project input tab; the header keeps the title, a read-only project line and the global actions.
- **Where / before → after** (the frames are `srcdoc`; edited decoded and re-encoded with CRLF kept; nodes moved, not copied; every id, `data-fkey`, handler and saved field is the same):
  - **Suite page** `#suite-xfer`: the two buttons `onclick="bxUseProjectInfo()"` / `onclick="bxShareProjectInfo()"` removed (anchor `HDR (2026-11-05): "Use shared project info"`); the functions are unchanged and are now called from each tab's Project tab. The bar keeps "← All tools".
  - **Beam Capacity** and **ASD Beam Calcs** frames (same change in both):
    - `#hdrBtns`: before New, Save Project, Open, (Undo, Redo), Export JSON, Import JSON, Print / PDF, `#fileIn`; then `<div id="projGrid">` under the title row. After: `#hdrProj` "Project: <name> · <number>" (link), Undo, Redo, Print / PDF.
    - `#inputPanel` now starts with `<div id="prjPane">` (three cards: "Title block" with `#projGrid` (8 fields + Design Code (Capacity) / Design Method (ASD)); "Project file" with `#btnNew`, `#btnSave`, `#btnLoad`, `#btnExport`, `#btnImport`, `#fileIn`; "Shared project info" with `#btnUseProjInfo` / `#btnShareProjInfo` → `parent.bxUseProjectInfo()` / `parent.bxShareProjectInfo()`; the card is hidden when the frame has no suite parent).
    - `buildInput()`: `const PJ=document.getElementById("prjPane")` taken before `P.innerHTML=""` and re-appended first (so it survives every rebuild; `buildProjGrid()` still refills `#projGrid` first).
    - `RCB_IN_TABS` / `ASD_IN_TABS`: `['project','Project']` added first; `RCB_IN_SEC` / `ASD_IN_SEC`: `prjPane:'project'`. A browser with no remembered tab still opens on Section / Mode & Section (`rcbeam_v2_inputTab_v1`, `asd_v1_inputTab_v1` unchanged).
    - `plibUndoInit()`: `const ref=document.getElementById('btnLoad'); … insertAdjacentElement('afterend',…)` → `const ref=document.getElementById('btnPrint'); … insertAdjacentElement('beforebegin',bu) / ('beforebegin',br)` (Undo / Redo in the header, before Print).
    - New `hdrProjShow()` (anchor `function hdrProjShow(){`): `S.proj.name · S.proj.num` or "(untitled: enter it in the Project tab)"; called from `buildInput()` and on `input` in `#projGrid`. `#hdrProj` click: Project tab, focus Project (below 900 px it first scrolls the card to just under the sticky input tab bar).
    - CSS (anchor `/* HDR (2026-11-05)`): `#hdrProj`; `#inputPanel #projGrid` two columns with the label above, dark labels and borders; `#prjPane` buttons and non-clickable card heads.
  - **Development & Splice** frame (already had a Project tab, "A Title Block"):
    - `.titlebar`: new `#hdrProj` link after the by-line (pushes Undo / Redo right; CSS `.titlebar #hdrProj~button{margin-left:8px!important}`).
    - Panel A: new `#prjShareRow` (Use shared project info / Share project info → the suite page's functions) and a one-line hint.
    - `autosave()` also calls `hdrProjShow()` (`#projName` · `#projNo`), which also runs on `input` in those two fields; one delegated click handler for the link and the two buttons.
- **Decisions (pending engineer review):**
  - Design Code (Beam Capacity, `pg_code`) moved with the title block to the Project tab (it was in the header grid). It still sets `S.code`; Section stays the tab shown on first open.
  - Development & Splice keeps its "H Project Management" panel (Save / Load / Export / Import / Print) on "Assumptions & Save": moving it would also need the wording of the retired standalone page's redirect notice (another file) changed.
  - Undo / Redo stay global actions in each header; the suite bar keeps only the tabs and "← All tools".
- **Governing provision:** none (layout only).
- **Check case / how verified** (headless Chromium, origin/main vs branch; typed into Beam Capacity: Project "Route 6 Bridge", Project No. "P-1234", Subject, Calculated By, Date, Sheet, Checked By, Checked Date; ASD: the same with Project "ASD Project"; Development & Splice: "Dev Project", "D-77", by / checked / dates):
  - Beam Capacity `CC`, ASD `CC`, Development & Splice factors / lengths, the suite Report text (`SharedReport.text(CBRP.doc)`, all three title blocks), every localStorage key, the Beam Capacity DXF (`cbdwBuild().D.toDXF()`, title block) and `bridgeSuite.v1.projectMeta` after Share: identical; after reload on that storage: identical;
  - each header shows its project line; each link focuses the tab's Project field; Use shared project info (from the Beam Capacity Project tab) fills all three tabs;
  - `phone-layout --tool cbc,aci`, `project-library --tool rebar`, `rebar-redirect`, `check-syntax`: pass; 0 console errors;
  - before / after screenshots at 1920 and 390 px of each tab and of each Project tab looked at.
- **Saved data:** no change (no key, field or format touched).

## 2026-11-06 — PR: claude/standard-save-dev (PR #841: https://github.com/mlococo88/All-Structural/pull/841) (STDS) — Development & Splice tab: the standard save: header chip + Save + Saved projects… + Print, "Save and open" first in the Project tab (moved from "Assumptions & Save"), Save as, Ctrl+S   [display / save controls only; no result change]
- **Why:** engineer decision 2026-11-05 (standard save; Development & Splice: move its save controls from "Assumptions & Save" to the Project tab). Uses `SharedProjectsUI.projectBar` (shared/projects-ui.js). All edits are inside the `srcdoc` of `<iframe id="suite-frame-dev">` (HTML-escaped `&quot;` / `&amp;`; file CRLF kept). The only copy: the standalone tool is a redirect page since RBRT (#804).
- **Header (`.titlebar` in the frame):** before: `Project: <name · no.>` link · Undo · Redo. After: chip `Project: <open saved project> ● saved / unsaved changes / not saved` (+ GitHub badge with sync on) · Undo · Redo · **Save (Ctrl+S)** · Saved projects… · **Print** (the "Print / PDF Report" button `#rbPrintBtn`, moved up from panel H; same `printReport()` handler). `#hdrProj` kept with `hidden` (its updater `hdrProjShow` unchanged).
- **Input tabs:** panel H "Project Management" (input tab "Assumptions & Save") → **"Save and open"**, first in the Project tab (`REBAR_IN_PANEL.H: 'notes'` → `'project'`; moved before panel A by `rbPlibInit`); the tab "Assumptions & Save" is now "Assumptions" (panel G only). Card: status line; Save · Save as… · Saved projects… · New; "File on this computer": Export JSON · Import JSON (the same buttons, `onclick="exportJSON()"` / import through `RBPL.pb.importJSON()`, which asks first on unsaved changes, then `#importFile` as before); the two hint lines. Removed: Saved Project drop-down `#projSelect`, Save As name box `#saveName`, Save / Load / Delete buttons (the functions `saveProject` / `loadProject` / `deleteProject` / `refreshProjectList` are kept, unused or no-ops without the drop-down). Delete is in Saved projects… only.
- **collectState (anchor `document.querySelectorAll('.panel').forEach(p=>panels[`):** added `if('H' in panels){ const h=panels.H; delete panels.H; panels.H=h; }` so the `panels` key order stays A … G, H as saved before (panel H is now first on screen). Saved text unchanged.
- **Code:** the PLIB block (anchor `function rbPlibInit(){`): `libraryDialog` + Saved projects… button → `projectBar({ store: mapStore(localStorage,'rebar_aci_projects_v1'), omit: ['currentTab','chartMode','panels'] (views), save: store.save(n, collectState()) (the item saveProject wrote), open: applyState + render + new undo history (the Load path), newProject: applyState({ inp: RB_DEF }) (default inputs captured in init before the autosave is applied: `RB_DEF=collectState().inp;`), exportFile (Save as → File: the Export JSON text), importFile: #importFile, fileButtons, header: .titlebar, card: #rbSaveCard, cloud: <unchanged GHS ctx.cloud> })`. `RBPL` gains `pb`; `RBPL.dlg` = the standard dialog. Import clears the open name (`RBPL.pb.setCurrent(null)`). RBRT notice text: `(input tab "Assumptions & Save", Saved Project)` → `(Project tab, Saved projects…)`.
- **Behaviour changes (asked for):** Save no longer asks "Overwrite existing project" nor alerts "Saved"; Save to the open name never asks; a new duplicate name at Save as is blocked ("Replace it"); Open / New / Import ask first on unsaved changes; Ctrl+S / Ctrl+Shift+S while the Development & Splice frame has the focus. New "New" button (default inputs; not in the tool before).
- **Saved data (§5):** `rebar_aci_projects_v1` ({ name: collectState() }), `rcsuite.rebar_autosave_v1`, the RBRT keys and the Export JSON format unchanged; GitHub file unchanged; no new key.
- **Formulas, factors, units, code references:** none (§4 does not apply).
- **How verified:** main vs branch (#dev) after the same input change: results (inputs, `computeFactors`, check summary) identical; localStorage keys identical (`rcsuite.rebar_autosave_v1`, `rcbeam_v2_auto`, `asd_v1_auto` byte-identical); Export JSON text identical (851 chars); output tab text identical (5,760 chars); suite Report text identical (13,866 chars); no console errors beyond main. Probe: save → saved; change → unsaved; Ctrl+S saves without a dialog; every output tab, input tab and panel toggle leaves "saved"; Open from the dialog → saved; New → default inputs, not saved; panes: Project = H, A; Assumptions = G. `project-library --tool rebar` ALL PASS (save through the standard Save as on the branch); `rebar-redirect.mjs` ALL PASS (now lists / opens projects through Saved projects…); `github-sync-tools --tool rebar`, `standard-save` (8 / 8), `github-sync` (13 / 13), `home-projects`, `home-sync`: pass; `phone-layout --tool aci` and `--tool cbc` (390, 768): pass; engine `project-registry`, `github-sync`, `projects` 32 / 32; `check-syntax` (all): pass. 390 px: page 390 / 390, dialog 355 / 355; screenshots looked at.
- **Decision (pending engineer review):** a project saved before the optional inputs existed (no `barSpc`, `psiRc`, `lwLambda`, `betaT`, `hookR`) shows "unsaved changes" right after it is opened (Open fills those with their defaults); Save writes them. Left so a later change to one of those inputs is never hidden.
- **Decision (pending engineer review):** Ctrl+S works while the Development & Splice frame has the focus (the suite page around it has no save of its own yet).

## 2026-11-06 — PR: claude/cbc-stds-capacity (PR #854: https://github.com/mlococo88/All-Structural/pull/854) (STDS) — Beam Capacity tab: the standard save: header chip + Save + Saved projects…, "Save and open" first in the Project input tab, Save as, Ctrl+S; GitHub sync of its list   [display / save controls only; no result change]
- **Why:** engineer decision 2026-11-05 / 2026-11-06 (standard save roll-out; Concrete Beam Capacity keeps its three lists; the Beam Capacity and ASD tabs move from their own Open / Save dialog to the standard dialog and bar, with GitHub sync and a home-page entry). Uses `SharedProjectsUI.projectBar` (shared/projects-ui.js). All tool edits are inside the `srcdoc` of `<iframe id="suite-frame-capacity">` (HTML-escaped `&quot;` / `&amp;`; file CRLF kept).
- **Script tags (frame head):** after `<script src="shared/projects-ui.js"></script>` added `<script src="shared/github-sync.js"></script>` (sync stays off until set up; with it off no request is made and no key is written).
- **Header (`#hdrBtns` in the frame):** before: `Project: <name · no.>` link · Undo · Redo · Print / PDF. After: chip `Project: <open saved project> ● saved / unsaved changes / not saved` (+ GitHub badge with sync on) · Undo · Redo · **Save (Ctrl+S)** · **Saved projects…** · Print / PDF. `#hdrProj` kept with `hidden` (its updater `hdrProjShow` unchanged). CSS added after `#prjPane .prjBtns button:hover{…}`: the card buttons styled as `.prjBtns` buttons, `#hdrBtns button.spChip{flex:0 0 auto;max-width:100%;white-space:nowrap}`, `body dialog.spLib{font-family:var(--font-ui)}`.
- **Project input tab:** the card "Project file" (`#prjFileSec`: New · Save Project · Open · Export JSON · Import JSON + a note) → **"Save and open"**, now first (before "Title block"). Its body `#cbcSaveCard` holds the standard card: status line; Save · Save as… · Saved projects… · New; "File on this computer": Export JSON · Import JSON (the same `#btnExport` / `#btnImport` buttons and handlers; Import asks first on unsaved changes); the two hint lines. Removed: `#btnNew`, `#btnSave`, `#btnLoad` and their listeners in `init()` (anchor `/* STDS (2026-11-06): New / Save Project / Open are the standard save controls now`). The old dialog `#prjBg` / `openProjDialog` / `saveAs` / `loadProject` / `renameProject` / `duplicateProject` / `deleteProject` are kept (no longer opened; `loadProject` is the Open path).
- **Code:** new `cbcStdsInit()` (anchor `function cbcStdsInit(){`, called at the end of `init()` after `plibUndoInit()`): `projectBar({ store: SharedProjects.mapStore(localStorage, 'rcbeam_v2_projects', { time: i => i.__savedAt, sort: 'saved' }), omit: ['ui','__savedAt'], save: n => { rec = copy of S; rec.__savedAt = now ISO; store.save(n, rec); if the title-block project name is empty, set it to n, autosave, refresh } (exactly what saveAs + projDialogGo did), snapOf (an empty project name in the saved record compares as the saved name while that is the name on screen), open: loadProject, newProject: S = defaultState(); autosave(); refresh() (the old New, still an undo step), displayName: S.proj.name, exportFile (Save as → File: the Export JSON text), importFile: #fileIn, header: #hdrBtns, card: #cbcSaveCard, cloud: { tool: 'concrete-beam-capacity', label: 'Concrete Beam Capacity', space: 2, fromFile: needs sec and mat } })`. `doImport` clears the open name (`CBPB.setCurrent(null)`).
- **Behaviour changes (asked for):** Save to the open name never asks; a new duplicate name at Save as is blocked ("Replace it"); Open / New / Import ask first only on unsaved changes (the old New always asked "Discard the current calculation…"); Ctrl+S / Ctrl+Shift+S while the Beam Capacity frame has the focus; Rename / Duplicate / Delete in Saved projects…; row Export.
- **Saved data (§5):** `rcbeam_v2_projects` ({ name: a copy of S + `__savedAt` }), `rcbeam_v2_auto` and the Export JSON format unchanged. GitHub file `projects/concrete-beam-capacity/<name>.json` = the stored record (JSON, indent 2). New keys only with sync set up: the shared engine's bookkeeping `bridgeSuite.v1.githubSync.tool.concrete-beam-capacity`.
- **Formulas, factors, units, code references:** none (§4 does not apply).
- **How verified:** main vs branch (`#capacity`, same input change, then each side's own Save of "Cmp A"): results (`CC`, `allChecks()`, check summary text) identical after the change and after Save; localStorage keys identical (`asd_v1_auto`, `rcbeam_v2_auto`, `rcbeam_v2_projects`, `rcsuite.rebar_autosave_v1`, time stamps aside); Export JSON text identical (1,428 chars); suite Report text identical (87,965 chars); output and input panel text identical (Save card and header removed); no console errors beyond main. Probe: save → saved; change → unsaved; Ctrl+S saves without a dialog; output tabs and card toggles leave "saved"; Open from the dialog asks on unsaved changes; reload finds the open project by content; New → not saved. `project-library --tool cbc` (new entry) and `--tool rebar`, `github-sync-tools --tool cbc,rebar`, `home-projects`, `home-sync`, `standard-save`, `github-sync`, `rebar-redirect`, `phone-layout --tool cbc`, `dxf-print-sheets --tool cbc`, engine `project-registry github-sync projects`, `check-syntax`: pass. Sync off: Save + dialog → no request, no sync key. 390 px: page 390 / 390, dialog 355 / 355; screenshots looked at.
- **Decision (pending engineer review):** the dialog's filter searches the project name only (the old Open dialog also searched the subject, engineer, section size and bars, and showed them under each name).
- **Decision (pending engineer review):** Duplicate copies the saved record unchanged, so the copy keeps the original's "Last saved" time (the old ⧉ gave the copy the time of the copy).
- **Decision (pending engineer review):** a project saved before newer inputs existed shows "unsaved changes" right after it is opened (Open fills them with their defaults); Save writes them (as in the Development & Splice tab, #841).

## 2026-11-06 — PR: claude/cbc-stds-asd (PR #856: https://github.com/mlococo88/All-Structural/pull/856) (STDS) — ASD tab: the standard save: header chip + Save + Saved projects…, "Save and open" first in the Project input tab, Save as, Ctrl+S; GitHub sync of its list   [display / save controls only; no result change]
- **Why:** engineer decision 2026-11-05 / 2026-11-06 (standard save roll-out; three lists kept; same change as the Beam Capacity tab, PR #854). All tool edits are inside the `srcdoc` of `<iframe id="suite-frame-asd">` (HTML-escaped; file CRLF kept).
- **Script tags (frame head):** `<script src="shared/github-sync.js"></script>` added after `shared/projects-ui.js` (sync off until set up).
- **Header (`#hdrBtns`):** chip · Undo · Redo · **Save (Ctrl+S)** · **Saved projects…** · Print / PDF; `#hdrProj` kept with `hidden`. CSS after `#prjPane .prjBtns button:hover{…}`: card buttons as `.prjBtns` buttons, `#hdrBtns button.spChip{flex:0 0 auto;max-width:100%;white-space:nowrap}`, `body dialog.spLib{font-family:var(--font-ui)}`.
- **Project input tab:** "Project file" (New · Save Project · Open · Export JSON · Import JSON + note) → **"Save and open"**, first (before "Title block"); body `#asdSaveCard` holds the standard card with the same `#btnExport` / `#btnImport`. Removed `#btnNew`, `#btnSave`, `#btnLoad` and their listeners (anchor `/* STDS (2026-11-06): New / Save Project / Open are the standard save controls now (asdStdsInit) */`). `doSave`, `doLoad`, `renderProjDialog`, `projDialogGo`, `renameProject`, `duplicateProject` and `#prjBg` kept (no longer opened).
- **Code:** new `asdStdsInit()` (anchor `function asdStdsInit(){`, called at the end of `init()` after `plibUndoInit()`): `projectBar({ store: mapStore(localStorage, 'asd_v1_projects', { pack: s => ({ when: now ISO, data: copy of s }), unpack: i => i.data, time: i => i.when }), omit: ['ui'], save: store.save(n, S) and, if the title-block project name is empty, set it to n (as doSave did; its "Saved" alert is gone), snapOf (empty saved project name compares as the saved name while that is on screen), open: mergeState(item.data), autosave, refresh, new undo history (projDialogGo's path), newProject: the old New (defaultState keeping S.inherit; an undo step), exportFile (Save as → File: the Export JSON text), importFile: #fileIn, header: #hdrBtns, card: #asdSaveCard, cloud: { tool: 'concrete-beam-asd', label: 'Concrete Beam ASD Rating', space: 2, toFile: i => i.data (the Export JSON of the saved inputs), fromFile: needs loads and allow; the file is stored through pack as { when: now, data: file } } })`. `doImport` clears the open name (`ASPB.setCurrent(null)`).
- **Behaviour changes (asked for):** Save to the open name never asks (the old Save Project always prompted for a name and silently overwrote an existing one); a new duplicate name at Save as is blocked ("Replace it"); Open / New / Import ask first only on unsaved changes; Ctrl+S / Ctrl+Shift+S while the ASD frame has the focus; Rename / Duplicate / Delete / Export in Saved projects….
- **Saved data (§5):** `asd_v1_projects` ({ name: { when, data } }), `asd_v1_auto` and the Export JSON format unchanged. GitHub file `projects/concrete-beam-asd/<name>.json` = `item.data` (indent 2). New key only with sync set up: `bridgeSuite.v1.githubSync.tool.concrete-beam-asd`.
- **Formulas, factors, units, code references:** none (§4 does not apply).
- **How verified:** main vs branch (`#asd`, same input change `mLl` + 10, then each side's own Save of "Cmp A"): results (`CC`, check summary text) identical after the change and after Save; localStorage keys identical (`asd_v1_auto`, `asd_v1_projects`, `rcbeam_v2_auto`, `rcsuite.rebar_autosave_v1`; time stamps aside); Export JSON text identical (1,031 chars); suite Report text identical (87,893 chars); output / input panel text identical; no console errors beyond main. Probe: save → saved; change → unsaved; Ctrl+S saves with no dialog; output tabs and card toggles leave "saved"; Open asks on unsaved changes; reload finds the project by content; New → not saved. Sync off: no request, no sync key. `project-library --tool asd` (new entry), `--tool cbc`, `--tool rebar`, `github-sync-tools --tool asd,cbc,rebar`, `home-projects`, `home-sync`, `standard-save`, `github-sync`, `phone-layout --tool cbc`, engine `project-registry github-sync projects`, `check-syntax`: pass. 390 px: page 390 / 390, dialog 355 / 355; screenshots looked at.
- **Decision (pending engineer review):** Duplicate copies the item unchanged (the copy keeps the original's `when`; the old ⧉ stamped the copy with now). The dialog filter searches names only (the old list showed the subject under each name).
- **Decision (pending engineer review):** the GitHub file is the saved inputs (`data`, the Export JSON format), not the `{ when, data }` wrapper, so a file from GitHub opens with Import JSON too; a file brought into this browser from GitHub gets `when` = the time it arrived.
## 2026-11-06 — PR: claude/hdrs-cbc (PR #915: https://github.com/mlococo88/All-Structural/pull/915) (HDRS) — header: Save and Saved projects… removed (in the "Save and open" card only); the chip opens the tab's Project input tab   [display only; no result change]
- **Why:** engineer 2026-11-06: every app's header as in Spread Footing (#884): no Save (Ctrl+S) and Saved projects… buttons in the header; they stay in the "Save and open" card. The header keeps the project chip (click = the tab's Project input tab), Undo, Redo, the app's other global actions and Print. Ctrl+S and Ctrl+Shift+S work from anywhere. No "Recent projects" start strip (Spread Footing only).
- **Where:** inside each tab's `srcdoc` page (decode / encode with the suite's srcdoc helper: `&quot;` and `&amp;`), in the `SharedProjectsUI.projectBar({...})` call, right after the line: Beam Capacity (`#suite-frame-capacity`) `header:hb, chipBefore:bu||pr, headerBefore:pr, card:document.getElementById('cbcSaveCard'),`; ASD (`#suite-frame-asd`) `header:hb, chipBefore:bu||pr, headerBefore:pr, card:document.getElementById('asdSaveCard'),`; Development & Splice (`#suite-frame-dev`) `header:tb, chipBefore:bu, headerBefore:pr, card:document.getElementById('rbSaveCard'),` (in each, a comment `/* HDRS (2026-11-06, …) */` and the same one line; CRLF kept).
  Before: nothing. After:
  `headerSave:false, chipClick:()=>{ const a=document.getElementById('hdrProj'); if(a) a.click(); }, chipHint:'the Project tab (Save and open)',`
  Uses the projectBar options of `shared/projects-ui.js` (HDRS, #884; `fixlog/shared-projects.md`): `headerSave:false` (the chip only in the header), `chipClick`, `chipHint` (the chip tooltip's "Click: …").
- **Header before:** each tab: chip · Undo · Redo · Save (Ctrl+S) · Saved projects… · Print / PDF (Development & Splice: … · Print); chip click = Saved projects… dialog. **After:** each tab: chip · Undo · Redo · Print / PDF (Development & Splice: Print); chip click = that tab's Project input tab (the "Save and open" card first), through the click handler of the tab's hidden header link `#hdrProj` (reused: Beam Capacity `rcbSetInTab('project',true)`, ASD the same, Development & Splice its delegated handler). The card's buttons are unchanged.
- **Problem:** none (layout request). **Governing provision:** none (§4 does not apply).
- **Check case:** each tab (#capacity, #asd, #dev), another input tab open: click the chip → that tab's Project input tab, the card on screen, no dialog; Ctrl+S in the tab (nothing saved yet) → Save as; Ctrl+Shift+S → Save as.
- **How verified:** main vs branch per tab (#capacity / #asd / #dev, read in the frame): every localStorage key (3), page text (10,629 / 3,329 / 12,377 chars), Export JSON (1,423 / 1,026 / 851 chars) and the printed text (print media, 5,436 / 2,050 / 6,664 chars) identical (clock times normalised); 0 console errors; header at 1280 / 1400 / 1920 / 390 px (390: no sideways scroll), screenshots looked at. `node tests/check-syntax.mjs "Concrete Beam Capacity.html"` (the three srcdoc pages decoded and checked), `project-library.mjs --tool cbc`, `--tool asd`, `--tool rebar`, `github-sync-tools.mjs --tool cbc,asd,rebar`, `home-projects.mjs --tool cbc,asd,rebar`, `rebar-redirect.mjs`, `phone-layout.mjs --tool cbc,aci`: pass. Line endings: 9 CRLF lines added, no other line changed (CRLF count main 10,675 → branch 10,684; LF-only lines 4 → 4).
- **Saved data:** no key or format changed (§5).
- **Other copies:** none. **Open items:** none.

## 2026-11-07 — PR: claude/cbc-aci-comp-lap-fy, PR #969: https://github.com/mlococo88/All-Structural/pull/969 (CBH2: ACI compression lap splice for f_y > 80,000 psi is the longer of (0.0009f_y − 24)d_b and l_st, per 25.5.5.1(c); CALCULATION CHANGE, Development & Splice tab, ACI mode, f_y > 80 ksi only; less conservative before)

Frame: Development & Splice (`suite-frame-dev`, srcdoc of `Concrete Beam Capacity.html`; decoded/encoded with a byte-exact srcdoc helper, CRLF kept). Found in the in-depth review of 2026-11-07 (item H2).

### CBH2. Compression lap splice, f_y > 80,000 psi   [CALCULATION CHANGE]
- **Governing provision (checked in the rendered PDF, printed p. 492):** ACI 318-19 25.5.5.1. (a) f_y ≤ 60,000 psi and (b) 60,000 < f_y ≤ 80,000 psi are as coded. (c) f_y > 80,000 psi: l_sc is the longer of (0.0009f_y − 24)d_b and l_st calculated per 25.5.2.1. The one-third increase for f′c < 3000 psi follows the three cases. The 2022 errata were not found to change 25.5.5.1. AASHTO 5.10.8.4.5a (10th Ed.) has no such case and is unchanged.
- **Where:** `calcCompSplice()`, anchor `function calcCompSplice(inp,f){`, ACI branch.
  - Before:
    ```js
    function calcCompSplice(inp,f){
      let lsc_calc;
      ...
      } else {
        if(inp.fy<=60000) lsc_calc = 0.0005*inp.fy*f.db;
        else lsc_calc = (0.0009*inp.fy-24)*f.db;
        if(inp.fc<3000) lsc_calc *= (4/3);
      }
      const lsc = Math.max(lsc_calc, 12);
      return {lsc_calc, lsc, lowFc: inp.fc<3000};
    ```
  - After:
    ```js
    function calcCompSplice(inp,f){
      let lsc_calc, hiFy = null;
      ...
      } else {
        if(inp.fy<=60000) lsc_calc = 0.0005*inp.fy*f.db;
        else lsc_calc = (0.0009*inp.fy-24)*f.db;
        // CBH2: ... (comment)
        if(inp.fy>80000){
          const e = classAEligible(inp,f);
          const cls = (inp.tensClass==="A" && e.known && e.eligible) ? "A" : "B";
          const inpC = Object.assign({},inp,{tensClass:cls});
          const ts = calcTensSplice(inpC,f,calcTension(inp,f));
          hiFy = {term:lsc_calc, lst:ts.lst, ldBase:ts.ldBase, factor:ts.factor, cls, gov: ts.lst>lsc_calc?"lst":"term"};
          lsc_calc = Math.max(lsc_calc, ts.lst);
        }
        if(inp.fc<3000) lsc_calc *= (4/3);
      }
      const lsc = Math.max(lsc_calc, 12);
      return {lsc_calc, lsc, lowFc: inp.fc<3000, hiFy};
    ```
  - l_st is the tool's own `calcTensSplice` value: factor (1.0 Class A, 1.3 Class B) × l_d without the excess-reinforcement factor, 12 in minimum.
  - Everything that shows l_sc follows: the Comp. Splice tab, the Checks panel row, the Bar Schedule (each bar size), the Report steps and table, and the Summary row.
- **Decisions (pending engineer review):**
  1. Class of l_st: Class B (1.3 l_d) unless Class A is selected in Splices and shown eligible (A_s,prov ≥ 2A_s,req entered and ≤ 50 % spliced). With Class A selected but not shown eligible, Class B is used (conservative).
  2. f′c < 3000 psi: the one-third increase is applied to the longer of the two terms (the increase is written after (a)–(c) and applies to l_sc). This is the conservative reading.
- **Display:**
  - Comp. Splice tab (ACI): a commentary line for f_y > 80,000 psi ("This applies to your input" when it does); the first equation block ends at (0.0009f_y − 24)d_b = value; a new block "f_y > 80,000 psi: longer of the above and l_st (Class …)", §25.5.5.1(c), §25.5.2.1, worked as max[term, max(factor × l_d, 12) = l_st], with a "Worked in: l_d … → Tension Splice · Base Development Length" link.
  - Report (`rbrCSplice`): for f_y > 80,000 psi the step l_sc,calc is replaced by three steps: `lscterm` (the expression), `lscst` (l_st with the class, note "see §ldBase", which links to the Tension lap splice section) and `lsccalc` (the longer, ×4/3 when f′c < 3000 psi). The cs steps topic got `see:'ts'` so the note resolves to the tension splice's step.
- **Check case:** ACI, #8 bar (d_b 1.000 in), f′c 4000 psi, f_y 100,000 psi, c_b + K_tr limited ratio 1.5, ψ_t = ψ_e = ψ_s = 1.0, ψ_g = 1.3 (Grade 100), normalweight, Class B selected.

  | Quantity | Before | After | Hand check |
  |---|---|---|---|
  | (0.0009f_y − 24)d_b | 66.00 in | 66.00 in | (90 − 24) × 1.000 = 66.0 |
  | l_d (splice base) | — | 102.77 in | 3/40 × 100000/(1.0 × 63.25) × 1.3/1.5 × 1.000 = 102.77 |
  | l_st (Class B) | — | 133.61 in | 1.3 × 102.77 = 133.61 |
  | **l_sc** | **66.00 in** | **133.61 in** | max(66.0, 133.61) |

  Other cases (in the page):
  - Class A selected without A_s,req/A_s,prov entered: 133.61 in (Class B used).
  - Class A selected and eligible (A_s,req 0.5, A_s,prov 1.0 in², 50 % spliced): 102.77 in.
  - f′c 2500 psi, Class B: before 66.0 × 4/3 = 88.0 in; after l_d 130.0, l_st 169.0, l_sc 169.0 × 4/3 = 225.3 in.
  - #6, f′c 6000, f_y 100 ksi: term 49.5 in governs over l_st 49.09 in, so l_sc unchanged at 49.5 in.
  - f_y 80,000 psi (case (b)) and every f_y ≤ 80 ksi: unchanged. AASHTO mode: unchanged.
- **Conservatism:** before, ACI f_y > 80 ksi laps could be short by up to half (66.0 vs 133.6 in in the check case).
- **How verified:**
  - Headless Chromium, origin/main vs branch, review probe cases (Beam Capacity: default, aciD, aasT, aasMinNeg, aciFy100, aciDeep, aa100; Dev: aciDefault, aasLWcomp, aasNWcomp, aasFy100, aciFy80): identical. Moved: only the ACI f_y 100 ksi Dev cases above.
  - Full dump of all frames and the Report (default project), main vs branch: values identical; differences are only the new commentary line and the topic's `see` key.
  - The Report step list for the check case was dumped from `rbrModel()`.
  - `check-syntax` (all), `phone-layout --tool cbc`, `project-library --tool cbc/asd/rebar`, `rebar-redirect`, `dxf-print-sheets --tool cbc` pass; 0 console errors. Screenshot of the Comp. Splice tab looked at.
- **Saved data:** no key or format change.
- **Other copies:** none (the standalone rebar page is a redirect since RBRT).
- **Open items:** in cases (a)/(b) with f′c < 3000 psi the tool applies ×4/3 before the 12 in floor (max(4/3·calc, 12)), not after; not changed here (raise with the engineer).

## 2026-11-07 — PR: claude/cbc-aashto-ldc-lambda, PR #972: https://github.com/mlococo88/All-Structural/pull/972 (CBH3: AASHTO compression development length divided by λ per Eq. 5.10.8.2.2a-1; CALCULATION CHANGE, Development & Splice tab, AASHTO mode, lightweight concrete only; less conservative before)

Frame: Development & Splice (`suite-frame-dev`). Found in the in-depth review of 2026-11-07 (item H3); it was listed in the tool as an open item.

### CBH3. λ in the AASHTO compression development length   [CALCULATION CHANGE]
- **Governing provision (checked in the rendered PDF, p. 5-192):** AASHTO LRFD 10th Ed. (2024) Eq. 5.10.8.2.2a-1: the modified compression development length is l_db times λ_er times λ_rc, divided by λ (the concrete density modification factor of 5.4.2.8); l_db from Eqs. 5.10.8.2.2a-2/-3; not less than 8.0 in.
- **Where:** `calcComp()`, anchor `const ldc_calc = base*f.excess`, AASHTO branch.
  - Before: `const ldc_calc = base*f.excess;   // excess reinf factor applies` (comment: "The tool applies λer only (λrc = 1.0, λ not applied; open item).")
  - After: `const ldc_calc = base*f.excess/f.lambda;   // excess reinf factor λer applies; divided by λ` (comment updated, CBH3).
  - `f.lambda` in AASHTO mode is the entered λ (0.75–1.0) for lightweight concrete and 1.0 for normalweight (`computeFactors`, unchanged). λ_rc stays 1.0 (no reduction for spirals or hoops taken, conservative, unchanged).
  - The ACI branch is unchanged (λ is already inside 25.4.9.2(a)).
- **Display:**
  - `tabCompAASHTO`: the narrative now says λ_er and λ are applied; a λ row was added to the variable table; the "Governing length" block reads l_dc = max[max(l_dc,a, l_dc,b) (× A_s,req/A_s,prov) / λ, 8 in] when λ ≠ 1 (unchanged form for λ = 1).
  - Report (`rbrComp`): AASHTO "Governing expressions" gets a step `lam` (note "see §lam"); the step `ldccalc` shows "/ λ" in AASHTO mode.
  - Removed the AASHTO validation notice that said λ was not applied to compression development (anchor "divides the compression development length by λ; this tool does not apply"), and the Hook & Comp. hint now says λ divides the compression development length.
- **Check case:** AASHTO, #8 (d_b 1.000 in), f_y 60 ksi, f′c 4.0 ksi, lightweight, λ = 0.75, no excess factor.

  | Quantity | Before | After | Hand check |
  |---|---|---|---|
  | l_dc,a = 0.63 d_b f_y/√f′c | 18.90 in | 18.90 in | 0.63 × 1.000 × 60/2.000 |
  | l_dc,b = 0.3 d_b f_y | 18.00 in | 18.00 in | |
  | **l_dc** | **18.90 in** | **25.20 in** | 18.90/0.75 |

  Also: λ 0.85 with A_s,req/A_s,prov = 0.8: 15.12 → 17.79 in (18.90 × 0.8/0.85). Normalweight (λ = 1.0) and all ACI cases unchanged.
- **Conservatism:** before, lightweight AASHTO compression development lengths were short by the factor λ (up to 25 %).
- **How verified:** headless main vs branch with the review probe cases (all Beam Capacity cases and every Dev case except the two lightweight AASHTO ones identical); full dumps of the default project (identical) and the AASHTO excess case (values identical, only the new λ step/row and narrative); screenshot of the Compression l_dc tab looked at; `check-syntax`, `phone-layout --tool cbc`, `project-library --tool cbc/asd/rebar`, `rebar-redirect`, `dxf-print-sheets --tool cbc` pass, 0 console errors.
- **Saved data:** no key or format change.
- **Open items:** none.

## 2026-11-07 — PR: claude/cbc-aci-asmin-fy80, PR #975: https://github.com/mlococo88/All-Structural/pull/975 (CBH4: ACI A_s,min with f_y limited to 80,000 psi per 9.6.1.2; CALCULATION CHANGE, Beam Capacity tab, ACI mode, f_y > 80 ksi only; less conservative before)

Frame: Beam Capacity (`suite-frame-capacity`). Found in the in-depth review of 2026-11-07 (item H4).

### CBH4. A_s,min, f_y limit   [CALCULATION CHANGE]
- **Governing provision (checked in the rendered PDF, printed p. 135):** ACI 318-19 9.6.1.2: A_s,min is the larger of (a) 3√f′c/f_y · b_w d and (b) 200/f_y · b_w d, with f_y limited to a maximum of 80,000 psi. No 2022 erratum on 9.6.1.2.
- **Where:** `detailing()`, anchor `/* minimum flexural steel */`, check `dAsMin`.
  - Before:
    ```js
    const t1=3*rt/(fy*1000)*bw*F.dCent, t2=200/(fy*1000)*bw*F.dCent;
    ```
    and the substituted line printed `${fmt(fy*1000,0)}` in both denominators, with an empty note.
  - After:
    ```js
    /* CBH4 (2026-11-07): ACI 318-19 9.6.1.2 limits f_y to 80,000 psi in (a) and (b) */
    const fyA=Math.min(fy,80);
    const t1=3*rt/(fyA*1000)*bw*F.dCent, t2=200/(fyA*1000)*bw*F.dCent;
    ```
    and the substituted line prints `${fmt(fyA*1000,0)}`, with the note "f_y = … psi is limited to 80,000 psi here (9.6.1.2)." when f_y > 80 ksi.
  - Follows: the Detailing card, the Summary row, the Report step, and the A_s,req passed to the Development & Splice tab by "From Beam Capacity" (CBAR-1 uses the dAsMin value), which can only grow.
- **Check case `aciFy100`:** ACI, 12 × 24 in, f′c 4 ksi, f_y 100 ksi, 2 #6 (A_s 0.88 in²), d = 21.125 in.
  - (a) 3√4000/80,000 · 12 · 21.125 = 0.601 in²; (b) 200/80,000 · 12 · 21.125 = 0.634 in² (governs).
  - **A_s,min: before 0.507 in² (200/100,000 · 12 · 21.125) → after 0.634 in²**; D/C 0.576 → 0.720 (still passes).
  - Same with 2 #5 (A_s 0.62 in², d 21.19 in): before 0.509 in², PASS (D/C 0.82) → after 0.636 in², **FAIL** (D/C 1.03).
  - f_y ≤ 80 ksi (e.g. the same section at f_y 80 ksi) and AASHTO mode: unchanged.
- **Conservatism:** before, A_s,min was low by the factor 80/f_y for f_y > 80 ksi (20 % at 100 ksi).
- **How verified:** headless main vs branch, review probe cases: only `aciFy100` and `aciFy100n5` moved (values above), all others (default, aciD, aasT, aasMinNeg, aciDeep, aa100, aciFy80, every Dev case) identical; full dump of the default project identical; `check-syntax`, `phone-layout --tool cbc`, `project-library --tool cbc/asd/rebar`, `rebar-redirect`, `dxf-print-sheets --tool cbc` pass, 0 console errors.
- **Saved data:** no key or format change.
- **Open items:** none (the flange-in-tension b_w of 9.6.1.2 is M4, a separate change).

## 2026-11-07 — PR: claude/cbc-aci-asmin-flange, PR #979: https://github.com/mlococo88/All-Structural/pull/979 (CBM4: ACI A_s,min of a T-section with the flange in tension uses b_w = min(b_f, 2b_w) for a statically determinate beam, per 9.6.1.2; new input "Beam (for A_s,min, flange in tension)", default statically determinate; CALCULATION CHANGE, Beam Capacity tab, ACI, T-section in negative bending only; less conservative before)

Frame: Beam Capacity (`suite-frame-capacity`). Found in the in-depth review of 2026-11-07 (item M4).

### CBM4. A_s,min with the flange in tension   [CALCULATION CHANGE]
- **Governing provision (checked in the rendered PDF, printed p. 135):** ACI 318-19 9.6.1.2: for a statically determinate beam with a flange in tension, b_w in (a) and (b) is the smaller of b_f and 2b_w (R9.6.1.2 explains why: cantilevers and other determinate beams cannot redistribute moment). No 2022 erratum.
- **Where:** `detailing()`, anchor `/* minimum flexural steel */`, check `dAsMin` (after CBH4).
  - Before: `const t1=3*rt/(fyA*1000)*bw*F.dCent, t2=200/(fyA*1000)*bw*F.dCent;` with `(${fmt(bw)})` in the substituted line.
  - After:
    ```js
    const flgT=(S.sec.type==='tee' && neg), detm=(S.sec.asminSupport!=='indeterminate');
    const bwA=(flgT && detm) ? Math.min(S.sec.bf,2*bw) : bw;
    const t1=3*rt/(fyA*1000)*bwA*F.dCent, t2=200/(fyA*1000)*bwA*F.dCent;
    ```
    with `(${fmt(bwA)})` in the substituted line, and its note says which b_w is used ("Flange in tension, statically determinate beam: b_w = min(b_f, 2b_w) = min(…) = … in (9.6.1.2)." or "… marked statically indeterminate (continuous): b_w = … in").
  - The tool places the flange at the top, so "flange in tension" is a T-section under negative M_u (`neg`), as the crack-control check already assumes (`flangeTension`).
- **New input (Section Geometry, T-beam, ACI mode only):** "Beam (for A_s,min, flange in tension)": "Statically determinate (cantilever, simple span)" / "Statically indeterminate (continuous)", saved as `S.sec.asminSupport` ("determinate" / "indeterminate"), with a hint. Listed in the Inputs table on screen and in the Report inputs.
- **Decision (pending engineer review):** the default is **statically determinate** (the conservative choice): the reduced b_w is applied whenever the flange is in tension unless the user marks the beam continuous. Saved projects have no such field; `mergeState` fills the default, so a saved ACI T-section in negative bending now gets the larger A_s,min. No migration keeps the old behaviour, because the old result was unconservative for determinate beams; a continuous beam is restored by choosing "indeterminate". Rectangular sections, positive bending and AASHTO mode are unaffected.
- **Check case `aciTeeCant`:** ACI, T-section b_w 12, h 30, b_f 48, h_f 6 in, f′c 4 ksi, f_y 60 ksi; top 4 #6 (1.76 in², d 27.125 in), bottom 3 #7; S1 M_u = −150 k-ft.
  - b_w = min(48, 2·12) = 24 in.
  - (a) 3√4000/60,000 · 24 · 27.125 = 2.059 in²; (b) 200/60,000 · 24 · 27.125 = 2.170 in² (governs).
  - **A_s,min: before 1.085 in² (b_w 12), PASS (D/C 0.62) → after 2.170 in², FAIL (D/C 1.23).**
  - Same section marked indeterminate (`aciTeeCont`): 1.085 in², PASS (unchanged). Positive combination S2: 1.083 in², unchanged. AASHTO (`aasTeeNeg`): unchanged.
- **How verified:** headless main vs branch with the review probe cases plus the three tee cases: only `aciTeeCant` moved; all other cases identical. Full dump of the default project identical. Screenshot of the Section Geometry input and the Detailing card looked at. `check-syntax`, `phone-layout --tool cbc`, `project-library --tool cbc/asd/rebar` (save round trip with the new field), `rebar-redirect`, `dxf-print-sheets --tool cbc` pass, 0 console errors.
- **Saved data:** one new field `sec.asminSupport` (additive; old saves read with the default, see the decision). No key change.
- **Open items:** none.

## 2026-11-07 — PR: claude/cbc-aashto-min-every-combo, PR #985: https://github.com/mlococo88/All-Structural/pull/985 (CBM1: AASHTO 5.6.3.3 minimum reinforcement checked for every combination, each in its own sense of bending, and enveloped; CALCULATION CHANGE (pass/fail logic), Beam Capacity tab, AASHTO mode; less conservative before)

Frame: Beam Capacity (`suite-frame-capacity`) and the suite shell's Report summary. Found in the in-depth review of 2026-11-07 (item M1).

### CBM1. 5.6.3.3 for every combination   [CALCULATION CHANGE: check logic]
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) 5.6.3.3: at any section of a flexural component the factored resistance M_r is at least the lesser of M_cr (Eq. 5.6.3.3-1, γ_3(γ_1 f_r)S_c, γ_1 = 1.6, γ_3 by bar specification) and 1.33 M_u for the strength combinations. The requirement applies in each sense of bending (top steel under negative moment as well). Formula unchanged; only which combinations are checked changes.
- **Before:** `allChecks()`, anchor `/* serviceability: min reinforcement */`:
  ```js
  if(S.code==='AASHTO'){
    const need=Math.min((S.mat.gamma3||0.67)*1.6*g.svc.Mcr,Math.abs(g.Mu)>0?1.33*Math.abs(g.Mu):Infinity);
    out.push({label:"Minimum reinforcement","ref":"AASHTO 5.6.3.3",
      dcr:g.phiMn>0?need/g.phiMn:null,combo:g.name,na:false,tab:"tabServ",ci:g.ci});
  }
  ```
  with `g=CC.govRow` (the overall governing combination only).
- **After:**
  - New `cbcMin5633(svc,Mu,phiMn)` (before `function computeAll(){`): returns {g1, g3, McrF = g3·g1·M_cr, M133 = 1.33|M_u| (Infinity when M_u = 0, as before), need = min(McrF, M133), dcr = need/φM_n (Infinity when φM_n = 0), ok}.
  - `computeAll()` row: `const mr=(S.code==='AASHTO')?cbcMin5633(svc,c.Mu,phiMn):null;`, returned as `mr` in AASHTO mode only (`...(mr?{mr}:{})`, so ACI rows are unchanged) (svc = `servicecalc(F,neg)`, so M_cr uses y_t to the tension face of that combination's sense).
  - `allChecks()`: `env("Minimum reinforcement","AASHTO 5.6.3.3",r=>r.mr?{dcr:r.mr.dcr,na:false}:{na:true},"tabServ");` (the largest ratio over every combination).
  - Edge: φM_n = 0 now gives D/C ∞ (FAIL) instead of a null ratio.
- **Display:**
  - Serviceability tab: new card "Minimum Reinforcement — Every Combination" (`svcMinAll`, AASHTO only): a table (combination, sense, y_t, M_cr (γ), 1.33|M_u|, required, φM_n, D/C, status) and, per combination, the worked lines M_cr = γ_3(γ_1 f_r) I_g/y_t, min(M_cr, 1.33M_u), φM_n vs required with D/C, and a "Worked in: φM_n → Flexure · Combination i" link. The existing card stays (governing combination) and its PASS/FAIL line now names that combination and points to the new card.
  - `cbcCheckCard`: the Summary's Minimum reinforcement row links to `svcMinAll` in AASHTO mode.
  - Report: new subsection "Minimum reinforcement, every combination (AASHTO 5.6.3.3)" (scope `svm`, steps `McrF<ci>`, `need<ci>`, `minr<ci>`) with a note linking each combination's φM_n ([[fx<ci>/phiMn]]). The chapter Summary key and the suite shell's Report summary key (`Concrete Beam Capacity.html` shell, anchor `else if(c.tab==='tabServ') ks=`) now point to `svm/minr<ci>` of the governing combination (shell falls back to `sv/minr`).
- **Check case `aasMinNeg45`:** AASHTO, 14 × 30 in, f′c 5 ksi, f_y 60 ksi, γ_3 0.67; bottom 4 #9, top 2 #4; S1 M_u +450, S2 M_u −45 k-ft.
  - f_r = 0.24√5 = 0.537 ksi; I_g = 31,500 in⁴; y_t = 15 in; M_cr = 0.537 · 31,500/15/12 = 93.9 k-ft; γ_3γ_1M_cr = 0.67 · 1.6 · 93.9 = 100.7 k-ft.
  - S2: min(100.7, 1.33 · 45 = 59.85) = 59.85 k-ft; φM_n⁻ = 58.27 k-ft → D/C 1.027 **FAIL**.
  - **Summary: before 0.219 PASS (S1 only) → after 1.03 FAIL (S2).** Same section with S2 = −40 k-ft: 0.219 → 0.913 (S2), PASS.
- **How verified:** headless main vs branch, review probe cases: only `aasMinNeg` and `aasMinNeg45` moved (values above); default, aciD, aasT, aciFy100, aciDeep, aa100, the tee cases and every Dev case identical. Full dumps: default project identical; `aa100` values identical, only the new card/subsection and link targets differ. Screenshot of the Serviceability tab looked at; Report summary link checked (§7.2). `check-syntax`, `phone-layout --tool cbc`, `project-library --tool cbc/asd/rebar`, `rebar-redirect`, `dxf-print-sheets --tool cbc` pass, 0 console errors.
- **Saved data:** no key or format change.
- **Open items:** CBAR-1 (A_s,req passed to Development & Splice) still takes the 5.6.3.3 minimum of the flexure-governing combination; unchanged.

## 2026-11-07 — PR: claude/cbc-aashto-torsion-threshold, PR #987: https://github.com/mlococo88/All-Structural/pull/987 (CBH1a: AASHTO mode checks the 5.7.2.1 torsion threshold for every combination; above it the combination FAILs "torsion must be considered" (AASHTO torsion design not implemented); T_u column shown in AASHTO mode; CALCULATION CHANGE (new check), Beam Capacity tab, AASHTO mode; less conservative before)

Frame: Beam Capacity (`suite-frame-capacity`) and the suite shell's Report summary. Found in the in-depth review of 2026-11-07 (item H1, first part: the quick blocker). The full AASHTO 5.7.3.6 torsion design is NOT in this change (see Open items).

### CBH1a. AASHTO torsion threshold   [CALCULATION CHANGE: new FAIL check]
- **Problem:** in AASHTO mode `torsion()` returns null, the T_u column was hidden, and any T_u (entered earlier or in a saved project) was ignored without a FAIL: only a Validation note said the torsion module is ACI-only.
- **Governing provisions (10th Ed. text checked):** AASHTO LRFD 10th Ed. (2024) 5.7.2.1: torsion is investigated where T_u > 0.25φT_cr (Eq. 5.7.2.1-3); solid sections T_cr = 0.126Kλ√f′c A_cp²/p_c (Eq. 5.7.2.1-4), K from Eq. 5.7.2.1-6 (1.0 without prestress); f′c not over 10 ksi for torsion; φ = 0.90 for torsion in reinforced concrete (5.5.4.2).
- **Where / what (all new, anchors `CBH1`):**
  - `cbcTorA(Tu_kft)` (before `function computeAll(){`): A_cp = b_w h, p_c = 2(b_w + h), T_cr, threshold 0.25φT_cr (kip-in), D/C = T_u/threshold, `consider` when T_u exceeds it.
  - `computeAll()` row: `torA` (AASHTO mode only).
  - `allChecks()` (after the shear row): `env("Torsion threshold, T_u ≤ 0.25φT_cr (above: torsion must be considered; not designed by this tool)","AASHTO 5.7.2.1", …,"tabShear")` with id `torA`; N/A where T_u = 0. A ratio above 1 is FAIL.
  - Shear tab: new first card "Torsion Threshold (AASHTO 5.7.2.1)" (`shTorA`): A_cp, p_c, T_cr, 0.25φT_cr worked, then each combination's comparison and, where exceeded, a FAIL box saying torsion must be considered and that the shear, longitudinal-steel and flexure results ignore it. `cbcCheckCard` links the Summary row there.
  - Loads input: the T_u column is shown in AASHTO mode (before: ACI with torsion ticked only).
  - Validation: the Scope note ("torsion module … hidden while AASHTO is selected") is replaced by a note on the threshold check; a warning lists the combinations above the threshold.
  - Report: new section "Torsion threshold (AASHTO 5.7.2.1)" (scope `tth`: steps Acp, pc, Tcr, thr, Tu<ci>); the chapter Summary and the suite shell's Report summary (anchor `else if(c.id==='torA') ks=`) link to `tth/Tu<ci>`.
- **Decisions (pending engineer review):**
  1. A_cp and p_c from the web b_w × h, flange ignored (as the ACI module): smaller T_cr, so the threshold is lower (conservative).
  2. The threshold is checked whatever the ACI "Check torsion" tick (which is hidden in AASHTO mode): any T_u entered counts. Saved AASHTO projects that carry a T_u from ACI use (e.g. the 13.5 k-ft of the default project's first combination) now show it and may FAIL; the user zeroes it if it does not apply.
  3. Compatibility torsion (5.7.2.1 allows T_u to be reduced to φT_cr with redistribution) is not taken into account here: the reduced value is still above 0.25φT_cr, so the result is the same.
- **Check cases:**
  - `aa100` (AASHTO 12 × 18 in, f′c 4 ksi, T_u 5 k-ft): A_cp 216 in², p_c 60 in, T_cr = 0.126 · 1 · 1 · 2 · 216²/60 = 195.9 k-in, 0.25 · 0.90 · 195.9 = 44.1 k-in = 3.67 k-ft; T_u 60 k-in → **D/C 1.36 FAIL (before: no torsion row, no FAIL).**
  - `aasT` (12 × 36 in tee, f′c 12 ksi → 10 ksi for torsion, T_u 25 k-ft): A_cp 432 in², p_c 96 in, T_cr = 0.126√10 · 432²/96 = 774.6 k-in; threshold 174.3 k-in (14.52 k-ft); T_u 300 k-in → **D/C 1.72 FAIL.** (The review's 848 k-in used f′c 12 ksi; 5.7.2.1 limits it to 10 ksi.)
  - Combinations with T_u = 0: N/A. ACI mode: unchanged (no `torA` field, no new row).
- **How verified:** headless main vs branch, review probe cases: ACI cases and every Dev case identical; every AASHTO case gains only the threshold row (N/A where T_u = 0), the new note and, for aa100 and aasT, the warning; no other value moved. Screenshot of the Shear tab (aasT) looked at. `check-syntax`, `phone-layout --tool cbc`, `project-library --tool cbc/asd/rebar`, `rebar-redirect`, `dxf-print-sheets --tool cbc` pass, 0 console errors.
- **Saved data:** no key or format change (T_u was already saved per combination).
- **Open items:** full AASHTO torsion design (5.7.3.4.2 V_eff in ε_s, 5.7.3.6.1/-.2 transverse, 5.7.3.6.3 longitudinal, Summary interaction) is not implemented yet; until then a combination above the threshold stays FAIL.

## 2026-11-07 — PR: claude/cbc-aashto-long-reinf, PR #992: https://github.com/mlococo88/All-Structural/pull/992 (CBM2: AASHTO 5.7.3.5 longitudinal reinforcement for moment and shear checked for every combination; CALCULATION CHANGE (new check), Beam Capacity tab, AASHTO mode; less conservative before)

Frame: Beam Capacity (`suite-frame-capacity`) and the suite shell's Report summary. Found in the in-depth review of 2026-11-07 (item M2).

### CBM2. 5.7.3.5 longitudinal reinforcement   [CALCULATION CHANGE: new check]
- **Governing provision (10th Ed. text checked):** AASHTO LRFD 10th Ed. (2024) 5.7.3.5, Eq. 5.7.3.5-1: the tensile capacity of the longitudinal reinforcement on the flexural tension side is at least |M_u|/(d_v φ_f) + 0.5N_u/φ_c + (|V_u/φ_v − V_p| − 0.5V_s) cot θ, with V_s (Eq. 5.7.3.3-4) not greater than V_u/φ_v; φ from 5.5.4.2; θ from 5.7.3.4. With torsion, 5.7.3.6.3 amends it.
- **Where / what (all new, anchors `CBM2`):**
  - `cbcLonA(F,sh,pf,Mu,Vu)` (before `function computeAll(){`): demand = |M_u|·12/(d_v φ_f) + max(0, |V_u|/φ_v − 0.5 min(V_s, |V_u|/φ_v)) cot θ (kip); capacity A_s f_y (A_s = tension steel of the combination's sense, `F.As`; f_y as in flexure); D/C = demand/capacity. No prestress (A_ps, V_p = 0) and N_u = 0 (the tool has no axial input). φ_f = the combination's flexural φ, φ_v, d_v, θ and V_s from `shear()`.
  - `computeAll()` row: `lonA` (AASHTO only).
  - `allChecks()`: `env("Longitudinal reinforcement for moment and shear","AASHTO 5.7.3.5", …,"tabShear")`, id `lonA`; N/A where M_u = V_u = 0.
  - Shear tab: new card "Longitudinal Reinforcement (AASHTO 5.7.3.5)" (`shLonA`) with the worked lines per combination and links to that combination's Shear (d_v, θ, V_s) and Flexure (φ_f) cards; `cbcCheckCard` links the Summary row there.
  - Report: new section "Longitudinal reinforcement (AASHTO 5.7.3.5)" (scope `lon`, steps Vs/dem/cap/dc per combination); chapter Summary key and suite shell Report summary (anchor `else if(c.id==='lonA') ks=`) → `lon/dc<ci>`; Report filter maps the section to the Shear tab.
- **Decisions (pending engineer review):**
  1. All tension steel of the sense is taken as fully developed at the section (the tool has no location or anchorage input; 5.7.3.5 says lack of full development shall be accounted for). Stated in the card and the Report.
  2. The end-support form (Eq. 5.7.3.5-2) is not separate: with M_u = 0, Eq. 5.7.3.5-1 gives the same shear term.
  3. Torsion (5.7.3.6.3) is not included; combinations above the 5.7.2.1 threshold already FAIL (CBH1a).
- **Check case `aasT`:** AASHTO tee 12 × 36 in, f′c 12 ksi, f_y 80 ksi, 6 #10 (7.62 in²), #4 @ 10 in, M_u 900 k-ft, V_u 120 kip.
  - d_v 31.18 in, θ 36.39°, V_s 101.54 kip, φ_f 0.90, φ_v 0.90.
  - V_s = min(101.54, 120/0.9 = 133.33) = 101.54 kip.
  - 10,800/(31.18 · 0.90) + (133.33 − 50.77) cot 36.39° = 384.9 + 112.0 = 496.9 kip.
  - A_s f_y = 7.62 · 80 = 609.6 kip → **D/C 0.815 PASS (before: no check).**
  - Other moved cases (new row only): `aasMinNeg` 1.13 FAIL (S2, top 2 #4); `aasMinNeg45` 1.22 FAIL; `aa100` 2.57 FAIL (its flexure D/C is already 1.92); `aasTeeNeg` 0.88 PASS. ACI: unchanged (no new field or row).
- **How verified:** headless main vs branch, review probe cases: ACI and Dev cases identical; AASHTO cases gain only the new row (values above). Screenshot of the Shear tab card (aasT) looked at; Report section §8 and summary link checked. `check-syntax`, `phone-layout --tool cbc`, `project-library --tool cbc/asd/rebar`, `rebar-redirect`, `dxf-print-sheets --tool cbc` pass, 0 console errors.
- **Saved data:** no key or format change.
- **Open items:** torsion in the longitudinal demand (5.7.3.6.3) with the full AASHTO torsion design.

## 2026-11-07 — PR: claude/cbc-skin-reinf, PR #1001: https://github.com/mlococo88/All-Structural/pull/1001 (CBM3: skin reinforcement checked where required — ACI 318-19 9.7.2.3 (h > 36 in) and AASHTO 5.6.7 (d_ℓ > 36 in); new input "Skin bars (each side face)", blank = none entered → FAIL where required; CALCULATION CHANGE (new checks), Beam Capacity tab; less conservative before)

Frame: Beam Capacity (`suite-frame-capacity`). Found in the in-depth review of 2026-11-07 (item M3).

### CBM3. Skin reinforcement   [CALCULATION CHANGE: new checks]
- **Governing provisions:**
  - ACI 318-19 9.7.2.3 (rendered PDF, printed p. 139; no 2022 erratum): where h exceeds 36 in, longitudinal skin reinforcement is distributed on both side faces for a distance h/2 from the tension face, with spacing not more than s of 24.3.2, c_c being the clear cover from the skin reinforcement to the side face. Table 24.3.2 / 24.3.2.1: s = min(15(40,000/f_s) − 2.5c_c, 12(40,000/f_s)), f_s may be 2/3 f_y.
  - AASHTO LRFD 10th Ed. (2024) 5.6.7 (text checked): where d_ℓ of nonprestressed members exceeds 3.0 ft, skin reinforcement on both side faces over d_ℓ/2 nearest the flexural tension reinforcement, A_sk ≥ 0.012(d_ℓ − 30) in²/ft of height on each face (Eq. 5.6.7-3); total per face need not exceed one-fourth of the required flexural tensile reinforcement; spacing not more than d_ℓ/6 or 12.0 in.
- **New input** (Transverse Reinforcement section): "Skin bars (each side face)": None / bar size, and "Skin bar spacing" (in), saved as `S.skin = {size, s}` (default `{size:"", s:0}`; `mergeState` now merges `skin` like the other groups). Shown in the Input Echo and the Report inputs note.
- **Where:** `detailing()`, new block before `/* maximum steel via net tensile strain */` (anchor `CBM3`); rows are added only where skin bars are required, so other projects are unchanged.
  - ACI, h > 36 in: `dSkin` "Skin reinforcement spacing (h > 36 in)": s_skin ≤ s_max with f_s = 2/3 f_y and c_c = cover + stirrup diameter; no bars entered → FAIL (provided "—").
  - AASHTO, d_ℓ > 36 in (d_ℓ = d of the outermost tension layer of the combination's sense): `dSkinA` A_sk = A_b·12/s ≥ min(0.012(d_ℓ − 30), (A_s/4)/(d_ℓ/24)); `dSkinS` s ≤ min(d_ℓ/6, 12 in); no bars entered → both FAIL.
  - `CBDC_COND` gets the conditions of the three new ids.
- **Decisions (pending engineer review):**
  1. ACI f_s = 2/3 f_y for the skin spacing (24.3.2.1 default), whatever crack-control basis is selected.
  2. ACI c_c to the side face = clear cover + stirrup diameter (skin bars inside the stirrup).
  3. AASHTO one-fourth cap computed with A_s provided (A_s required is not known to the tool): a larger cap, so the requirement is not reduced below what the code allows (conservative).
  4. Blank skin input = "not provided" → FAIL where required (the brief's rule).
- **Check cases:**
  - `aciDeep` (ACI 16 × 48 in, 4 #10, cover 2 in, #4 stirrups, f_y 60 ksi): f_s 40,000 psi, c_c 2.5 in, s_max = min(15 − 6.25, 12) = 8.75 in. **Before: no row (all PASS). After: no skin bars → FAIL;** with #4 @ 10 in → 10/8.75 = 1.14 FAIL; #4 @ 8 in → PASS.
  - `aasDeep` (same section, AASHTO): d_ℓ = 48 − 2 − 0.5 − 0.635 = 44.87 in; A_sk,req = 0.012(14.87) = 0.178 in²/ft (cap (5.08/4)/(44.87/24) = 0.679); s_max = min(7.48, 12) = 7.48 in. No bars → both FAIL; #4 @ 8 in → A_sk 0.30 in²/ft PASS (0.59), spacing 8/7.48 = 1.07 FAIL.
  - Sections with h ≤ 36 in (ACI) or d_ℓ ≤ 36 in (AASHTO): unchanged (no row).
- **How verified:** headless main vs branch, review probe cases: only aciDeep (and the new deep cases) moved; all other Beam Capacity and Dev cases identical. Screenshot of the Detailing tab (aasDeep) looked at. `check-syntax`, `phone-layout --tool cbc`, `project-library --tool cbc/asd/rebar` (save round trip with the new field), `rebar-redirect`, `dxf-print-sheets --tool cbc` pass, 0 console errors.
- **Saved data:** one new additive field `skin` (old saves read with the default "none"; no key change).
- **Open items:** the skin bars are not drawn in the section figure or the DXF sheets.

## 2026-11-07 — PR: claude/cbc-low-items, PR #1005: https://github.com/mlococo88/All-Structural/pull/1005 (CBL: review LOW items — L1 AASHTO γ_3 list per 5.6.3.3, L2 AASHTO-mode citations and ACI-only notes, L3 9.7.6.2.2 disclosure (reading kept), L4 h ≤ 10 in A_v,min exemption only where V_u ≤ φV_c, L6 AASHTO cover preset labels, L7 AASHTO w_c per Table 3.5.1-1; CALCULATION CHANGES in L4 (ACI, more conservative) and L7 (AASHTO f′c > 5 ksi, computed f_ss); L1 adds a γ_3 value)

Frame: Beam Capacity (`suite-frame-capacity`). Found in the in-depth review of 2026-11-07 (items L1–L7). L5 (C4, l_st from l_d after its 12 in floor) is left as is (conservative), as the brief says.

### CBL1. γ_3 by bar specification   [value set / labels]
- **Provision (10th Ed. text checked):** AASHTO LRFD 10th Ed. (2024) 5.6.3.3, γ_3: 0.67 A615 Gr 60; 0.75 A615 Gr 75; 0.76 A615 Gr 80; 0.75 A706 Gr 60; 0.80 A706 Gr 80; 0.67 A1035 Gr 100.
- **Before:** select `["0.67","0.75","0.76"]` labelled "0.67 — A615 Gr 60", "0.75 — A706 Gr 60", "0.76 — A615 Gr 75" (the 0.76 label was wrong: Gr 75 is 0.75, Gr 80 is 0.76; A706 Gr 80 = 0.80 was missing, so a user with A706 Gr 80 had to pick a lower, unconservative value).
- **After:** `G3_SPECS` (six rows above) and `cbcG3Key()` (anchor `CBL1`); the select lists the six rows; `S.mat.gamma3` still holds the number (saved format unchanged) and the new additive `S.mat.g3spec` remembers the row where two rows share a value. Old saves: 0.67 → "A615 Gr 60", 0.75 → "A615 Gr 75", 0.76 → "A615 Gr 80" (same numbers, no result change).
- **Check:** picking "0.80 — A706 Gr 80" in `aasMinNeg45` gives γ_3γ_1M_cr = 0.80 · 1.6 · 93.9 = 120.2 k-ft (the 1.33M_u term still governs S2).

### CBL2. AASHTO-mode citations   [wording]
- `allChecks()`: "Flexural capacity" cites "AASHTO 5.6.3.2 / 5.5.4.2" in AASHTO mode (before: "ACI 9.3.3 / 22.2" in both).
- `validate()`: the "Method" note (A_oh, p_h to the stirrup centreline, an ACI torsion item) and the "ACI 9.6.1.3" note are shown in ACI mode only (before: also in AASHTO mode).

### CBL3. ACI 9.7.6.2.2 reading   [disclosure only; no result change]
- The tool keeps triggering the d/4 limit from V_s required (V_u/φ − V_c). **Decision (pending engineer review):** kept as common practice; it avoids a spacing limit that depends on the spacing chosen. The Validation note now says so and states that under the literal reading (V_s provided) the limit applies wherever V_s,provided > 4√f′c b_w d, which can be tighter (for the default project: V_s,prov 60.75 > 46.10 kip, so s_max would be d/4 = 3.80 in).

### CBL4. Table 9.6.3.1 exemption for h ≤ 10 in   [CALCULATION CHANGE, ACI, more conservative]
- **Provision (rendered PDF, printed p. 136):** ACI 318-19 9.6.3.1: A_v,min where V_u > φλ√f′c b_w d, except the cases of Table 9.6.3.1 (h ≤ 10 in among them); for these cases A_v,min is still required where V_u > φV_c.
- **Before:** `} else if(smallH){` → "Exempt" (N/A) whenever h ≤ 10 in.
- **After:** `} else if(smallH && VuA<=sh.phi*sh.Vc+1e-9){` (exempt text now states V_u ≤ φV_c); otherwise the FAIL row, with a first line explaining that the exemption does not apply because V_u > φV_c.
- **Check:** ACI 12 × 10 in, 3 #5, f′c 4 ksi, no stirrups, d ≈ 7.69 in: V_c = 2√4000 · 12 · 7.69/1000 = 11.67 kip, φV_c = 8.75 kip. V_u = 6 kip → exempt (unchanged). **V_u = 9 kip → before "Exempt" (N/A), after A_v,min required: FAIL** (the shear-capacity row already failed: φV_n = φV_c < V_u).

### CBL6. AASHTO cover presets   [labels; one added preset]
- **Provision:** AASHTO LRFD 10th Ed. Table 5.10.1-1 lists "exposure to deicing salts" (2.5 in) and "exterior other than above" (2.0 in) as separate rows.
- **Before:** `{v:'exposed',label:'Exposed to weather / deicing',c:2.5}`. **After:** `{v:'exposed',label:'Exposure to deicing salts',c:2.5}` and a new `{v:'exterior',label:'Exterior, other than above',c:2.0}`. Saved projects keep 'exposed' = 2.5 in (no result change); the default AASHTO preset is still 'exposed'.

### CBL7. AASHTO E_c unit weight   [CALCULATION CHANGE, AASHTO, f′c > 5 ksi, computed f_ss only]
- **Provisions (text checked):** AASHTO LRFD 10th Ed. Eq. 5.4.2.4-1, E_c = 120,000K_1w_c^2.0f′c^0.33, w_c per Table 3.5.1-1 or C5.4.2.4; Table 3.5.1-1: normal weight 0.145 kcf for f′c ≤ 5.0 ksi, 0.140 + 0.001f′c for 5.0 < f′c ≤ 15.0 ksi.
- **Before:** `const fc=S.mat.fc, wc=0.145;` in `concreteE()`. **After:** `const wc=fc<=5?0.145:0.140+0.001*fc;` and the worked expression names w_c and Table 3.5.1-1. Used only for the cracked-section service stress f_ss (crack control with "computed" f_s) in AASHTO mode.
- **Check `aasT`** (f′c 12 ksi): w_c = 0.152 kcf; E_c = 120,000 · 0.152² · 12^0.33 = 6,297 ksi (before 5,730 ksi); n = 4.61 (before 5.06). Crack-control s_max 10.51 → 10.57 in (D/C 0.272 → 0.271). Lightweight concrete (λ < 1): the normal-weight table value is used as before (open item).
- **How verified (all LOW items):** headless main vs branch, review probe cases: ACI cases differ only in the 9.7.6.2.2 note text, except the new `aciShallowHi` (exempt → FAIL); AASHTO cases differ in the flexure citation and the removed ACI-only notes, and `aasT` in the crack s_max above; all Dev cases identical. `check-syntax`, `phone-layout --tool cbc`, `project-library --tool cbc/asd/rebar`, `rebar-redirect`, `dxf-print-sheets --tool cbc` pass, 0 console errors.
- **Saved data:** additive field `mat.g3spec`; new cover preset key 'exterior'; no key change.
- **Open items:** L5 left (conservative); lightweight w_c for E_c.

## 2026-11-07 — PR: claude/cbc-aashto-torsion, PR #1032: https://github.com/mlococo88/All-Structural/pull/1032 (CBH1b: AASHTO torsion design of a solid section for every combination above the 5.7.2.1 threshold — V_eff in ε_s (5.7.3.4.2), T_n (5.7.3.6.2), combined shear + torsion transverse steel (5.7.3.6.1), section limit, longitudinal steel with torsion (5.7.3.6.3); the threshold row no longer FAILs; CALCULATION CHANGE, Beam Capacity tab, AASHTO mode, T_u > 0.25φT_cr only)

Frame: Beam Capacity (`suite-frame-capacity`) and the suite shell's Report summary. Found in the in-depth review of 2026-11-07 (item H1, second part; the first part was CBH1a, PR #987).

### CBH1b. AASHTO torsion design   [CALCULATION CHANGE]
- **Problem:** after CBH1a a combination with T_u > 0.25φT_cr was reported FAIL ("torsion must be considered; not designed by this tool"); its shear (ε_s, β, θ), its transverse steel and its longitudinal steel ignored T_u.
- **Governing provisions (AASHTO LRFD 10th Ed. (2024), text layer and rendered pp. 5-74, 5-80, 5-81 checked):**
  - 5.7.2.1: torsion considered where T_u > 0.25φT_cr; f′c not over 10.0 ksi for torsion or torsion and shear; T_r = φT_n (Eq. 5.7.2.1-2), φ = 0.90 (5.5.4.2).
  - 5.7.3.4.2: where torsion must be considered, V_u in Eq. 5.7.3.4.2-4 (ε_s) is replaced by V_eff; solid sections Eq. 5.7.3.4.2-5, V_eff = √(V_u² + (0.9p_hT_u/2A_o)²).
  - 5.7.3.6.1: transverse reinforcement not less than the sum of that for shear (5.7.3.3) and for the concurrent torsion (5.7.2.1, 5.7.3.6.2).
  - 5.7.3.6.2: T_n = 2A_oA_tf_y cotθ/s (Eq. 5.7.3.6.2-1, λ_duct = 1); A_t = one leg of the closed stirrup; C5.7.3.6.2: for solid sections A_o may be taken as the area enclosed by the centreline of a wall of thickness b_e = A_cp/p_c.
  - 5.7.3.6.3: Eq. 5.7.3.6.3-1 (solid sections) replaces Eq. 5.7.3.5-1: the shear term becomes cotθ·√((|V_u/φ| − 0.5V_s)² + (0.45p_hT_u/(2A_oφ))²); a bar in each corner of the stirrups.
  - 5.7.2.3: transverse reinforcement is required where torsion must be considered; 5.7.2.7: f_y up to 100 ksi only for flexural shear without torsion (else ≤ 60 ksi, or the 0.0035-strain stress ≤ 75 ksi).
- **Where / what (anchors `CBH1b`):**
  - `shear(F,Mu,Vu,sOv,tq)`: new optional `tq = {Veff, fcMax:10, fyt}` (AASHTO branch): V_eff replaces |V_u| in ε_s and in the |M_u| ≥ |V_u|d_v floor, f′c ≤ 10 ksi in V_c, V_n,max and A_v,min (Eq. 5.7.2.5-1 for the β choice), f_y of the stirrups = `fytTorA()`. Returns `fcUse`, `fytUse`, `Veff`. Before: `fc=S.mat.fc, fyt=fytDesign()` and `|Vu|` in ε_s. Without `tq` nothing changes; `a_g` is still taken 0 on the specified f′c > 10 ksi.
  - New `fytTorA()`, `cbcTorGeoA()` (x_1, y_1, p_h, A_cp, p_c, b_e, A_o), `cbcVeffA()`, `cbcTorDesA()` (T_n, φT_n, (A_v/s)_V, (A_t/s)_T, combined ratio, section limit) before `computeAll()`.
  - `cbcLonA(F,sh,pf,Mu,Vu,tD)`: with `tD` the shear term is cotθ·√(vTerm² + tT²), tT = 0.45p_hT_u/(2A_oφ).
  - `computeAll()`: above the threshold `sh` is computed with `tq`, `torD` is added to the row, `dcT = max(T_u/φT_n, combined, section)`, and `share` (the torsion steel reserved first, V_s on the rest with d_v cotθ, V_n ≤ V_n,max) gives the shear D/C, as in ACI mode.
  - `detailing(...,tor,torD)`: AASHTO s_max (5.7.2.6) with v_u from V_eff and f′c ≤ 10 ksi; without stirrups, transverse reinforcement is required where torsion must be considered (5.7.2.3).
  - `allChecks()`: the threshold row (`torA`, FAIL above 1) is replaced by "Torsional resistance, T_u ≤ φT_n" (`torAT`), "Combined shear and torsion transverse reinforcement" (`torAC`), "Section limit with torsion" (`torAS`), N/A where T_u ≤ 0.25φT_cr; the 5.7.3.5 row reads "(and torsion)", 5.7.3.5 / 5.7.3.6.3 where a combination has torsion.
  - Shear tab: the Torsion Threshold card shows a warning box with a link instead of the FAIL box; new card per combination "Torsion Design, Combination n (AASHTO 5.7.3.6)" (`shTorD<ci>`, `workTorA()`); the combination's shear card shows V_eff in ε_s, the torsion f_y and f′c ≤ 10 ksi, and the transverse steel shared with torsion; the Longitudinal Reinforcement card works Eq. 5.7.3.6.3-1 for those combinations.
  - Report: section "Torsion (AASHTO 5.7.2.1, 5.7.3.6)" (threshold steps, now information, plus scope `tad`: ph/be/Ao/Veff/Tn/dcT/avV/atT/dcC/dcS per combination); shear steps show V_eff; longitudinal steps add `tT`; T_u column in the load combination table in AASHTO mode; Summary keys `tad/dcT|dcC|dcS<ci>` in the chapter and in the suite shell (anchor `c.id==='torAT'`).
  - Validation: note and warning reworded (designed, not FAIL); warning when the 100 ksi f_yt tick is overridden by torsion.
- **Decisions (pending engineer review):**
  1. A_o from C5.7.3.6.2 (b_e = A_cp/p_c, web b_w × h, flange ignored as for T_cr); p_h to the stirrup centreline.
  2. V_eff is also used in the |M_u| ≥ |V_u|d_v floor of Eq. 5.7.3.4.2-4 (its "where" list) and in v_u for the 5.7.2.6 spacing tier (5.7.3.6.2 refers to modified v and V_u): larger demand, not less conservative.
  3. Section limit: AASHTO has no separate combined limit for solid sections; Eq. 5.7.3.3-2 is applied with V_eff ≥ V_u: V_eff ≤ φ0.25f′c b_v d_v.
  4. T_u is used as entered: the compatibility-torsion reduction to φT_cr (5.7.2.1) and the reduction of longitudinal torsion steel in the flexural compression zone (C5.7.3.6.3) are not applied.
  5. The stirrups are taken as closed; the corner bars of 5.7.3.6.3 are not checked (stated on screen).
- **Check cases (hand, all intermediate values as in the tool):**
  - `aasT` (AASHTO tee, web 12 × 36 in, f′c 12 → 10 ksi, f_y 80, f_yt 60 ksi, cover 2.0 in, #4 2-leg @ 10 in, 6 #10 (7.62 in²), M_u 900 k-ft, V_u 120 kip, T_u 25 k-ft = 300 k-in):
    x_1 = 12 − 4 − 0.5 = 7.50, y_1 = 31.50, p_h = 78.0 in; b_e = 432/96 = 4.50 in; A_o = 7.5 · 31.5 = 236.25 in²;
    V_eff = √(120² + (0.9 · 78 · 300/472.5)²) = √(120² + 44.57²) = 128.01 kip;
    ε_s = (10,800/31.177 + 128.01)/(29,000 · 7.62) = 0.002147 (before 0.002111); θ = 36.51° (36.39°); β = 1.839; V_c = 0.0316 · 1.839 · √10 · 12 · 31.18 = 68.75 kip (before 76.11 with f′c 12); V_s = 0.4 · 60 · 31.18 · cot 36.51°/10 = 101.07 kip;
    T_n = 2 · 236.25 · 0.20 · 60 · 1.3507/10 = 765.9 k-in, φT_n = 689.3, **T_u/φT_n = 0.435**;
    (A_v/s)_V = (133.33 − 68.75)/(60 · 31.18 · 1.3507) = 0.02556, (A_t/s)_T = 300/(0.9 · 2 · 236.25 · 60 · 1.3507) = 0.00870; 0.02556 + 2 · 0.00870 = 0.04297 > 0.40/10 = 0.04000 → **combined 1.074 FAIL**;
    shear after the torsion steel: (0.04 − 0.01741) · 60 · 31.18 · 1.3507 = 57.08 kip, φV_n = 0.9(68.75 + 57.08) = 113.25 kip → **1.060 FAIL** (before 0.751);
    section limit 128.01/(0.9 · 0.25 · 10 · 12 · 31.18 = 841.8) = **0.152**;
    longitudinal: 10,800/(0.9 · 31.18) + 1.3507 √(82.80² + 24.76²) = 384.9 + 116.7 = 501.6 kip vs A_s f_y 609.6 → **0.823** (before 0.815, no torsion).
    **Before: threshold row 1.72 FAIL. After: no threshold FAIL; torsion design FAILs on the transverse steel (1.07).**
  - `aasRT` (new, AASHTO rectangle 14 × 30 in, f′c 5, f_y = f_yt 60 ksi, cover 1.5 in, 4 #9 bottom (4.00 in²) + 2 #6 top, #4 2-leg @ 6 in; S1 M_u 300, V_u 60, T_u 20 k-ft; S2 −50, 20, 0):
    T_cr = 0.126√5 · 420²/88 = 564.8 k-in, threshold 127.1 k-in < 240 → torsion considered;
    p_h = 2(10.5 + 26.5) = 74.0 in, b_e = 4.773 in, A_o = 9.227 · 25.227 = 232.78 in²; V_eff = √(60² + 34.33²) = 69.13 kip;
    ε_s = 0.001804, θ = 35.32°, β = 2.040, V_c = 51.82, V_s = 145.01 kip;
    T_n = 2 · 232.78 · 0.20 · 60 · 1.4116/6 = 1,314.3 k-in → **0.203**; (A_v/s)_V 0.00682 + 2 · 0.00676 = 0.02035 vs 0.06667 → **0.305**; shear after torsion φV_n 150.67 → **0.398**; section **0.171**; longitudinal 155.75 + 1.4116√(33.33² + 19.07²) = 209.96 kip vs 240.0 → **0.875**.
    **Before: threshold 1.89 FAIL. After: all PASS.**
  - `aa100` (AASHTO default 12 × 18 in, f′c 4, f_yt 100 → 75 ksi, 3 #5, #4 @ 6 in, M_u 120, V_u 60, T_u 5 k-ft): A_o = 8.4 · 14.4 = 120.96 in², p_h 42.0 in, V_eff 60.73 kip, ε_s 0.006 (cap), θ 50°, V_c 9.43, V_s 59.75 kip; T_u/φT_n = 60/(0.9 · 507.5) = **0.131**; combined (0.06386 + 2 · 0.00438)/0.06667 = **1.089 FAIL**; shear after torsion **1.087 FAIL** (before 0.961); section **0.395**; longitudinal 2.572 (before 2.567; flexure is already 1.92 FAIL). Before: threshold 1.36 FAIL.
  - `aasTnoV` (new, aasRT without stirrups, M_u 100, V_u 10, T_u 15 k-ft): before threshold 1.42 FAIL; after T_n = 0 → torsional resistance and combined steel FAIL (≫1), and the 5.7.2.3 minimum transverse steel row now FAILs (required because torsion must be considered).
  - Combinations with T_u ≤ 0.25φT_cr and all ACI cases: unchanged.
- **How verified:** headless main vs branch, review probe cases (+ aasRT, aasTnoV): every ACI and Dev case identical; AASHTO cases without torsion differ only in the reworded notes, the new N/A Summary rows and the additive `fcUse`/`fytUse` fields of `sh`; aa100, aasT, aasRT, aasTnoV move as above. Worked steps compared with an independent hand script (all values above agree to the digits shown). Report model dumped (sections 7 and 8); screenshot of the Shear tab (aasT) looked at. `check-syntax`, `phone-layout --tool cbc`, `project-library --tool cbc/asd/rebar`, `rebar-redirect`, `dxf-print-sheets --tool cbc` pass, 0 console errors.
- **Saved data:** no key or format change.
- **Open items:** hollow sections (Eqs. 5.7.2.1-5, 5.7.3.4.2-6, 5.7.3.6.3-2) are outside the tool's section types; compatibility-torsion reduction (decision 4).

## 2026-11-07 — PR: claude/cbc-aci-lap-fc-order, PR #1042: https://github.com/mlococo88/All-Structural/pull/1042 (CBH2b: ACI compression lap splice — the one-third increase for f′c < 3000 psi applied after the 12 in minimum, per 25.5.5.1; CALCULATION CHANGE, Development & Splice tab, ACI mode, f′c < 3000 psi with small bars only; less conservative before)

Frame: Development & Splice (`suite-frame-dev`; byte-exact srcdoc helper, CRLF kept). Follow-up to CBH2 (#969), open item from the 2026-11-07 review.

### CBH2b. Order of the ×4/3 and the 12 in floor   [CALCULATION CHANGE]
- **Governing provision (ACI 318-19 25.5.5.1, rendered PDF printed p. 492):** (a)–(c) give l_sc as the longer of the expression (or l_st for f_y > 80,000 psi) and 12 in; then, for f′c < 3000 psi, the length of lap is increased by one-third. The increase therefore applies to the length after the 12 in minimum.
- **Where:** `calcCompSplice()`, ACI branch (anchor `CBH2b`).
  - Before: `if(inp.fc<3000) lsc_calc *= (4/3);` then `const lsc = Math.max(lsc_calc, 12);`
  - After: `const lsc0 = Math.max(lsc_calc, 12);` and `lsc = inp.fc<3000 ? lsc0*(4/3) : lsc0` (returns `lsc0`; `lsc_calc` is now the expression without the ×4/3). The Comp. Splice tab and the Report show "l_sc = 4/3·max(l_sc,calc, 12 in)" when f′c < 3000 psi; the commentary lists the 12 in minimum before the one-third increase.
- **Check cases (ACI):**
  - #4, f_y 40,000 psi, f′c 2500 psi: 0.0005 · 40,000 · 0.5 = 10.0 in. **Before: max(10.0 · 4/3, 12) = 13.33 in. After: 4/3 · max(10.0, 12) = 16.00 in.**
  - #3, f_y 60,000, f′c 2500: 11.25 in. **Before 15.00 in; after 4/3 · 12 = 16.00 in.**
  - #8, f_y 60,000, f′c 2500: 30.0 in → 40.0 in before and after (expression above 12 in: no change). f′c ≥ 3000 psi: no change. f_y 100 ksi, f′c low (`aciFy100lowfc`): l_sc unchanged (169 · 4/3).
- **AASHTO (unchanged):** 5.10.8.4.5a puts m = 1.33 for f′c < 3.0 ksi inside Eqs. 5.10.8.4.5a-1/-2 and the 12.0 in minimum outside, so the AASHTO order (factor, then floor) is as coded. Open item: the tool uses 4/3 = 1.333 where the 10th Ed. lists m = 1.33 (0.3 % conservative).
- **How verified:** headless main vs branch, all Dev probe cases: only the f′c < 3000 psi ACI cases with expression < 12 in move (above); all Beam Capacity cases identical; screenshot of the Comp. Splice tab (#4 case) looked at. `check-syntax`, `phone-layout --tool cbc`, `project-library --tool cbc/asd/rebar`, `rebar-redirect`, `dxf-print-sheets --tool cbc` pass, 0 console errors.
- **Saved data:** no change.

## 2026-11-07 — PR: claude/cbc-lw-unit-weight, PR #1048: https://github.com/mlococo88/All-Structural/pull/1048 (CBL7b: AASHTO E_c for the computed f_ss uses an entered unit weight w_c, or 0.110 kcf for lightweight concrete (λ < 1) when none is entered; new optional input "Unit weight w_c"; CALCULATION CHANGE, Beam Capacity tab, AASHTO mode, lightweight concrete or an entered w_c, computed f_ss only; less conservative before for lightweight concrete)

Frame: Beam Capacity (`suite-frame-capacity`). Open item of CBL7 (#1005), review item L7.

### CBL7b. Lightweight / entered unit weight in E_c   [CALCULATION CHANGE]
- **Provisions (10th Ed. text checked):** AASHTO LRFD 10th Ed. Eq. 5.4.2.4-1, E_c = 120,000K_1w_c^2.0f′c^0.33, w_c from Table 3.5.1-1 or C5.4.2.4; Table 3.5.1-1 (Ch. 3): lightweight concrete 0.110 to 0.135 kcf, normal weight 0.145 kcf (f′c ≤ 5.0 ksi) or 0.140 + 0.001f′c (5.0 < f′c ≤ 15.0 ksi); 5.4.2.8 (Eq. 5.4.2.8-2) relates λ to w_c for lightweight concrete.
- **Before:** `const wc=fc<=5?0.145:0.140+0.001*fc;` in `concreteE()` at any λ (lightweight concrete got the normal weight E_c: E_c too high, n too low, f_ss too low, so the crack-control spacing too large).
- **After (`concreteE()`, anchor `CBL7b`):** `wc = S.mat.wc>0 ? S.mat.wc : (S.mat.lambda<1 ? 0.110 : table value)`; the worked E_c line says which (entered / lightweight low end / Table 3.5.1-1). New input under Materials (AASHTO mode), "Unit weight w_c (for E_c; blank = Table 3.5.1-1)" (`S.mat.wc`, kcf, default 0 = not entered), shown in the Report inputs table; a Validation warning when λ < 1, f_ss is computed and no w_c is entered. ACI mode is unchanged (E_c = 57,000√f′c).
- **Decision (pending engineer review):** lightweight without an entered w_c → 0.110 kcf, the low end of the Table 3.5.1-1 range: the smallest E_c and largest n, hence the larger computed f_ss and the smaller spacing limit (checked: aasTlw s_max 10.39 → 10.02 in).
- **Check case `aasTlw`** (aasT with f′c 6 ksi, λ 0.85, M_s 500 k-ft, f_ss computed):
  - Before: w_c = 0.140 + 0.006 = 0.146 kcf, E_c = 120,000 · 0.146² · 6^0.33 = 4,620 ksi, n = 6.28; crack-control s_max 10.39 in (D/C 0.276).
  - After: w_c = 0.110 kcf, E_c = 120,000 · 0.110² · 6^0.33 = 2,623 ksi, n = 11.06; **s_max 10.02 in (D/C 0.286).**
  - With w_c = 0.125 kcf entered (`aasTlwWc`): E_c = 3,387 ksi; s_max 10.20 in (D/C 0.281). Normal weight with w_c = 0.150 entered (`aasTwc`, f′c 12): E_c 6,130 ksi (Table 0.152 → 6,297); s_max 10.57 → 10.55 in.
  - Normal weight without an entry, and ACI mode: unchanged.
- **How verified:** headless main vs branch, all probe cases: only the three cases above move (crack-control row); all other Beam Capacity and Dev cases identical. `check-syntax`, `phone-layout --tool cbc`, `project-library --tool cbc/asd/rebar` (save round trip with the new field), `rebar-redirect`, `dxf-print-sheets --tool cbc` pass, 0 console errors.
- **Saved data:** additive field `mat.wc` (old saves read 0 = not entered: normal weight saves unchanged; lightweight AASHTO saves with computed f_ss move as above).
- **Open items:** ACI mode E_c for lightweight concrete (ACI 318-19 19.2.2.1(a), w_c^1.5·33√f′c) is not changed; the Development & Splice frame's AASHTO n_s for λ_rc still uses the normal weight E_c (higher E_c, smaller k_tr credit: conservative, as its comment states).

## 2026-11-07 — PR: claude/cbc-asmin-handoff (CBM1h: the A_s,min passed to Development & Splice ("From Beam Capacity", CBAR-1) is taken from the enveloped minimum-reinforcement check — the largest requirement among the combinations in the same sense of bending as the flexure-governing combination; CALCULATION CHANGE (hand-off value), AASHTO mode with a zero-moment combination; ACI unchanged in practice)

Frames: Beam Capacity (`suite-frame-capacity`, the shared-inputs block) and Development & Splice (`suite-frame-dev`, the "From Beam Capacity" note). Open item of CBM1 (#985), review item M1.

### CBM1h. A_s,min of the hand-off   [CALCULATION CHANGE: hand-off value]
- **Provisions:** AASHTO LRFD 10th Ed. 5.6.3.3 (checked per combination and enveloped since CBM1); ACI 318-19 9.6.1.2 (with CBH4 / CBM4).
- **Before (`asReqOut()`, anchor `CBAR-1`):** A_s,min from the flexure-governing combination (`govFlexIndex`) only: ACI its `dAsMin` need; AASHTO A_s,prov·min(γ3γ1M_cr, 1.33|M_u|)/φM_n of that combination.
- **After (anchor `CBM1h`):** among the combinations with the same sense of bending as the flexure-governing one (the same tension bars, A_s,prov), the one with the largest requirement: ACI the largest `dAsMin` need; AASHTO the largest `mr.need` (CBM1), A_s,min = A_s,prov·need/φM_n. The result names that combination (`min.ci`, `min.combo`); the Dev note adds "(combination k …: the largest minimum in this sense, as the enveloped check)" when it differs from the flexure-governing one; the AASHTO "Worked in" link goes to the Serviceability card "Minimum Reinforcement — Every Combination" (before: the governing-combination card).
- **Decision (pending engineer review):** combinations in the other sense of bending are not used (their A_s,min concerns the other face's bars). As in the enveloped Summary check, a combination with M_u = 0 counts as positive bending and takes the M_cr term alone (the convention of CBM1).
- **Check case `aasPos2`** (AASHTO 14 × 30 in, f′c 5 ksi, 2 #5 bottom (0.62 in²), γ3 0.67; S1 M_u 60, S2 5, S3 0 k-ft): f_r = 0.24√5 = 0.537 ksi, M_cr = 0.537 · 31,500/15/12 = 93.92 k-ft, γ3γ1M_cr = 0.67 · 1.6 · 93.92 = 100.68 k-ft; φM_n = 78.44 k-ft.
  - Before (S1 only): min(100.68, 1.33 · 60 = 79.8) = 79.8 → A_s,min = 0.62 · 79.8/78.44 = **0.631 in²**, A_s,req = 0.631 in².
  - After (S3, M_u = 0, the largest in the positive sense, as the Summary row): 100.68 → A_s,min = 0.62 · 100.68/78.44 = **0.796 in²**, A_s,req = 0.796 in² (the Dev excess factor A_s,req/A_s,prov rises 1.017 → capped 1.0, before 1.017 → 1.0 as well; with A_s,prov rounded down to 0.62 the λ_er is 1.0 both ways here).
  - All review probe cases (ACI and AASHTO): the hand-off is unchanged (the flexure-governing combination already had the largest requirement in its sense).
- **How verified:** headless main vs branch, the hand-off object (`RBCAP.last` in the Dev frame) for all probe cases + aasPos2 and aasMinNegTop: only aasPos2 moves. `check-syntax`, `phone-layout --tool cbc`, `project-library --tool cbc/asd/rebar`, `rebar-redirect`, `dxf-print-sheets --tool cbc` pass, 0 console errors.
- **Saved data:** no change.
