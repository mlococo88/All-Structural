# Fix log — Steel Beam Design - AISC 15th.html

Governing basis used for fixes: AISC 360-16 (as stated in the tool), Steel Construction Manual 15th Ed.

Note: the file uses CRLF line endings. Many functions are defined more than once and the **last
definition wins** (see O4). Every edit below was checked to be in the live (last) definition, or in a function defined only once.

## 2026-10-04 — PR: claude/fix-steel-beam (PR link added after merge)

### F1. E7 effective width of I-shape webs used c1/c2 = 0.22/1.49   [calc change] [more conservative]
- **Where:** function `compStrength` (≈ line 1708). Anchor: `if(cc.web.cls==='slender'){const r=beOf(p.hClear,p.tw,`. Also the explanatory text in the user manual (≈ line 3928, anchor `with c₁/c₂ = `) and the worked block's `vars` (≈ line 9576, anchor `['c_1,c_2',`).
- **Problem:** the web is a stiffened element (Table E7.1 case (a), c1 = 0.18, c2 = 1.31). The code used the case (c) values for "all other elements", which overstate b_e and A_e when the web is slender in compression and E7-2 governs. The flange values (0.22/1.49) and the HSS wall values (0.20/1.38) were already correct and were not changed.
- **Governing provision:** AISC 360-16 §E7.1, Eqs. E7-2/E7-3, Table E7.1 case (a).
- **Before:**
  ```js
  if(cc.web.cls==='slender'){const r=beOf(p.hClear,p.tw,cc.web.lam,cc.web.lr,0.22,1.49);
  ```
- **After:**
  ```js
  if(cc.web.cls==='slender'){const r=beOf(p.hClear,p.tw,cc.web.lam,cc.web.lr,0.18,1.31); /* Table E7.1 case (a): stiffened element (web) */
  ```
  Text: `0.22/1.49 for most elements and 0.20/1.38 for square and rectangular HSS walls;` → `0.18/1.31 for I-shape webs (Table E7.1 case (a)), 0.20/1.38 for square and rectangular HSS walls (case (b)), and 0.22/1.49 for all other elements such as flanges (case (c));`. Vars: `'0.22, 1.49 (0.20, 1.38 for HSS walls)'` → `'0.18, 1.31 for I-shape webs; 0.20, 1.38 for HSS walls; 0.22, 1.49 for flanges'`.
- **Check case:** W21X48, A992 (F_y = 50), L_cx = L_cy = L_cz = 10 ft. A_g = 14.1 in², h = 18.76 in, t_w = 0.350 in, h/t_w = 53.6, F_cr = 34.12 ksi.
  - λ_r = 1.49√(29000/50) = 35.88. Threshold λ_r√(F_y/F_cr) = 43.44 < 53.6, so the web is reduced.
  - Before (0.22/1.49): F_el = (1.49·35.88/53.6)²·50 = 49.75 ksi; b_e = 16.635 in; removed area 0.744 in²; A_e = 13.356 in²; φP_n = 0.9(34.12)(13.356) = 410.17 kip.
  - After (0.18/1.31): F_el = (1.31·35.88/53.6)²·50 = 38.46 ksi; √(F_el/F_cr) = 1.0617; b_e = 18.76(1 − 0.18·1.0617)(1.0617) = 16.110 in; removed area (18.76 − 16.110)(0.35) = 0.927 in²; A_e = 13.173 in²; **φP_n = 404.53 kip (−1.4 %)**.
  - W24X55, L_c = 10 ft: φP_n 391.43 → 387.33 kip. At L_c = 20 ft (F_cr = 12.0 ksi) the web is not reduced, so there is no change.
- **How verified:** node run of `compStrength` from the original and the edited script; hand check above. The built-in Validation examples give identical results before and after.
- **Other copies of this code:** none known.

### F2. Built-up I-shape flag now uses the k_c-based flange limits   [calc change] [more conservative]
- **Where:** functions `classifyFlex` (≈ line 1415) and `classifyComp` (≈ line 1436); worked display in the live `classFlexBlock` (≈ line 9489) and the label in the dead earlier copy (≈ line 3156). Anchors: `return{flange:mk(lamF,0.38*rt,1.0*rt,'10')` and `return{flange:mk(lamF,0.56*rt,'1')`.
- **Problem:** with "built-up" checked, the tool still used the rolled-shape limits λ_r = 1.0√(E/F_y) (flexure) and 0.56√(E/F_y) (compression), which are unconservative for welded sections with slender webs. The flag only switched off the §G2.1(a) shear rule. The λ_r values feed F3-1, F4-13 and F5 FLB and the E7 flange effective width.
- **Governing provision:** AISC 360-16 Table B4.1b case 11 (λ_r = 0.95√(k_cE/F_L)); Table B4.1a case 2 (λ_r = 0.64√(k_cE/F_y)); k_c = 4/√(h/t_w), 0.35 ≤ k_c ≤ 0.76 (Table B4.1 note [a]); F_L = 0.7F_y for doubly symmetric sections (S_xt/S_xc = 1, Eq. F4-6a). The tool only builds doubly symmetric I-shapes.
- **Before:**
  ```js
    const lamF=(p._kind==='I')?p.bf/(2*p.tf):p.bf/p.tf;
    return{flange:mk(lamF,0.38*rt,1.0*rt,'10'),web:mk(p.htw,3.76*rt,5.70*rt,'15')};
  ...
    const lamF=(p._kind==='I')?p.bf/(2*p.tf):p.bf/p.tf;
    return{flange:mk(lamF,0.56*rt,'1'),web:mk(p.htw,1.49*rt,'5')};
  ```
- **After:**
  ```js
    const lamF=(p._kind==='I')?p.bf/(2*p.tf):p.bf/p.tf;
    if(p._kind==='I'&&p._built){ /* built-up I: Table B4.1b case 11, lambda_r = 0.95 sqrt(kc E/FL); doubly symmetric, so FL = 0.7Fy (F4-6a) */
      const kc=Math.max(0.35,Math.min(0.76,4/SQ(p.htw))),FL=0.7*Fy;
      const fl=mk(lamF,0.38*rt,0.95*SQ(kc*E/FL),'11');fl.kc=kc;fl.FL=FL;
      return{flange:fl,web:mk(p.htw,3.76*rt,5.70*rt,'15')};
    }
    return{flange:mk(lamF,0.38*rt,1.0*rt,'10'),web:mk(p.htw,3.76*rt,5.70*rt,'15')};
  ...
    const lamF=(p._kind==='I')?p.bf/(2*p.tf):p.bf/p.tf;
    if(p._kind==='I'&&p._built){ /* built-up I: Table B4.1a case 2, lambda_r = 0.64 sqrt(kc E/Fy) */
      const kc=Math.max(0.35,Math.min(0.76,4/SQ(p.htw)));
      const fl=mk(lamF,0.64*SQ(kc*E/Fy),'2');fl.kc=kc;
      return{flange:fl,web:mk(p.htw,1.49*rt,'5')};
    }
    return{flange:mk(lamF,0.56*rt,'1'),web:mk(p.htw,1.49*rt,'5')};
  ```
  Display (live `classFlexBlock`): the flange λ_r expression is `c.flange.case==='11'?'0.95\\sqrt{k_cE/F_L}':'1.0\\sqrt{E/F_y}'`, and for case 11 an extra line shows k_c and F_L. In the dead copy, the label `'Flange (B4.1b case 10)'` → `'Flange (B4.1b case '+D.clsF.flange.case+')'`.
- **Check case:** W21X48, A992, flagged built-up, L_b = 0. b_f/2t_f = 9.465, h/t_w = 53.6, Z_x = 107, S_x = 93.0.
  - k_c = 4/√53.6 = 0.546.
  - Flexure λ_r: before 1.0√(29000/50) = 24.08; after 0.95√(0.546·29000/35) = 20.21. λ_p = 9.15.
  - F3-1: M_n = 5350 − (5350 − 3255)(9.465 − 9.152)/(λ_r − 9.152). Before 5306 kip-in, so **φM_n = 397.95 kip-ft**. After 5291 kip-in, so **φM_n = 396.80 kip-ft**.
  - Compression λ_r: before 0.56√580 = 13.49; after 0.64√(0.546·29000/50) = 11.39 (flange still nonslender).
  - W14X90 built-up (k_c capped at 0.76): flexure λ_r 24.08 → 23.84; φM_n 573.61 → 573.36 kip-ft.
  - Rolled shapes (flag off): unchanged.
- **How verified:** node run of `classifyFlex`, `classifyComp` and `flexFor`, before and after, plus the hand check above.
- **Other copies of this code:** none known.

### F3. Member mode: a blocked flexure check no longer drops out of the interaction   [bug fix] [more conservative]
- **Where:** `memberDesignAll` (≈ line 4433). Anchor: `const rx=C.flexGov.dcr`
- **Problem:** if the major-axis flexure route was blocked (dcr = ∞), the member-mode interaction used rx = 0, so the Interaction check could show PASS. Beam mode already carried ∞ into the interaction.
- **Before:**
  ```js
  const rx=C.flexGov.dcr===Infinity?0:C.flexGov.dcr,ry=C.dcrMy||0,rp=C.dcrP||0;
  ```
- **After:**
  ```js
  const rx=C.flexGov.dcr,ry=C.dcrMy||0,rp=C.dcrP||0;   /* a blocked flexure check (dcr = Infinity) makes the interaction FAIL, as in beam mode */
  ```
- **Check case:** member mode, C12X20.7 A36 with b_f doubled by override (noncompact flange, so the route is blocked), M_ux = 20 kip-ft, V_ux = 5 kip, L_b = 10 ft → before: Interaction H1-1b = 0.000, PASS; after: Interaction = ∞, shown as FAIL with DCR "—". The "One or more flexural routes are blocked" warning shows in both.
- **How verified:** node run of `memberDesignAll`.
- **Other copies of this code:** batch mode already reports BLOCKED. Beam mode already behaved this way.

### F4. Axial tension: clear warning that it is not checked; H3.3 stress sum uses |P_u|   [display + calc change] [more conservative]
- **Where:** `buildDesignChecks` (≈ line 1995, right after the Interaction check push; anchor `const tenC=`); `h33Check` (≈ line 5384, anchor `const fa=`).
- **Problem:** in beam and member modes a negative P_u (tension) was silently ignored. There is no D2 check and no H1.2 interaction. Batch mode already printed a note. Also, `h33Check` used the signed P_u, so a tension **reduced** the H3.3 normal stress f_n (unconservative).
- **Decision:** a D2 check needs net area and shear-lag data that the tool does not collect, so D2/H1.2 were **not** implemented (not clean). A warning is shown instead, per the task.
- **Governing provision:** AISC 360-16 Chapter D, §H1.2, §H3.3(a).
- **Before:**
  ```js
    const fa=(dem.Pu||0)/p.A;
  ```
  (no warning)
- **After:**
  ```js
    const fa=Math.abs(dem.Pu||0)/p.A;   /* magnitude: an axial tension stress adds to the bending stress on the tension side */
  ```
  and in `buildDesignChecks`:
  ```js
  const tenC=D.perCombo.filter(c=>c.man&&(+c.man.Pu||0)<0);
  if(tenC.length)D.warns.push('Axial TENSION (Pᵤ < 0) is entered for: '+tenC.map(c=>c.name).join(', ')+'. Tension is NOT checked: Chapter D (tensile yielding and rupture) and the §H1.2 interaction are not implemented, and the tension is left out of the H1-1 interaction. Check the member in tension and its connections separately.'+(D.perCombo.some(c=>c.h33)?' (The §H3.3 stress sum includes |Pᵤ|/A.)':''));
  ```
- **Check case:** W18X35 A992 (A = 10.3 in²), P_u = −50 kip, M_ux = 60 kip-ft, V_ux = 10 kip, open-section torsion "conc_pp", L = 20 ft, T = 2 kip-ft at midspan:
  - before: f_a = −4.85 ksi, f_n = 26.74 ksi, H3.3 dcr = 26.74/45 = 0.594, no warning;
  - after: f_a = +4.85 ksi, f_n = 36.45 ksi, H3.3 dcr = 0.810, and the tension warning is shown.
  - Hand check: 50/10.3 = 4.85; 26.74 + 2(4.85) = 36.45.
  - Batch mode passes P_u clamped to ≥ 0, so it is unchanged.
- **How verified:** node run of `h33Check` and `memberDesignAll`.
- **Other copies of this code:** batch mode (`batchCheckRow`) already had its own tension note; it was not changed.

### F5. H3.3 open-section torsion: warning when flexural buckling governs below yield   [display] [no result change]
- **Where:** `buildDesignChecks` (≈ line 1997, anchor `const h33B=`).
- **Problem:** `h33Check` compares f_n with φF_y and f_v with φ0.6F_y only. §H3.3(c) also requires the buckling limit state. Where LTB or local buckling gives φM_n/S_x < φF_y, the H3.3 check can pass while the member is buckling-critical.
- **Decision:** a full H3.3(c) implementation needs a design decision on how to combine warping normal stress with LTB, so it was **not** implemented. A warning is shown instead, with the governing combination and an indicative ratio (f_bx + σ_w)/(φM_n/S_x), which is labelled "not a code DCR". The DCRs are unchanged.
- **Governing provision:** AISC 360-16 §H3.3(c).
- **Before:** (no warning)
- **After:**
  ```js
  const h33B=D.perCombo.filter(c=>c.h33&&c.flexGov&&!c.flexGov.blocked&&c.flexGov.phiMn>0&&c.flexGov.phiMn*12/D.p.Sx<0.9*D.p.mat.Fy*(1-1e-9));
  if(h33B.length){ ... D.warns.push('§H3.3 open-section torsion: the normal-stress check compares fₙ with φFᵧ only; the buckling limit state of §H3.3(c) is NOT checked. ...'); }
  ```
  (see the file for the full message text)
- **Check case:** member mode, W18X35 A992, L_b = 20 ft, C_b = 1, M_ux = 60 kip-ft, torsion as in F4 → φM_n = 60/0.8667 = 69.2 kip-ft, φM_n/S_x = 69.2·12/57.6 = 14.42 ksi < φF_y = 45 ksi. The H3.3 check still shows dcr 0.70 to 0.81 (PASS), and the new warning shows f_bx + σ_w = 31.60 ksi, indicative ratio 2.19. **This case shows that the existing H3.3 check can pass a member that is far over its LTB capacity once warping stress is added.**
- **How verified:** node run of `memberDesignAll`.
- **Other copies of this code:** batch mode (`batchCheckRow` → `h33Check`) does not show this warning (see O2).

## Open items (not changed)
- O1. **H3.3(c) buckling limit state** is not implemented, only warned (F5). Decide on the method (e.g. f_bx + σ_w ≤ φF_cr with F_cr = M_n/S_x from Chapter F, or a DG 9 interaction) before coding it as a check.
- O2. **Batch mode** has no H3.3 buckling warning and keeps its existing tension note. Decide whether to add a matching batch note.
- O3. **Axial tension (Chapter D / §H1.2)** is not implemented; it needs gross and net area, shear lag U, and the H1.2 interaction. Decide whether to add inputs for A_n and U.
- O4. **Duplicate function definitions** (`TABS` ×4, `renderTab`, `buildSummaryTab`, `shearMajor`, `compositeFor`, `constructionStage`, `buildMxTab`, `buildServiceTab`, `memberDefl`, `openTorsionFor`, `regPlot`, `xsecBlock`, `classFlexBlock`, …). Only the last definition runs. **Not cleaned up**, per instruction. F2 also updated the label in the dead earlier `classFlexBlock` (≈ line 3136) so the two copies do not disagree.
- O5. Calculated-C_b window clipped to the moment-sign region (lines ≈ 1817–1829). Not in scope; the default C_b = 1 is conservative.
- O6. The open-section torque is a single value applied to every strength combination (not scaled per combination). Not in scope.
