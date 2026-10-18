# Fix log — lldf.html

Governing basis used for fixes: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), Art. 4.6.2.2 / 3.6.1.1.2 (the provisions touched here, Tables 4.6.2.2.2d-1, 4.6.2.2.2e-1, 4.6.2.2.3b-1, 4.6.2.2.3c-1, Art. 4.6.2.2.2d and C3.6.1.1.2, are unchanged in substance from the 9th Ed. that the tool was written against). MassDOT Bridge Manual §3.5.3 for the dead-load "two adjacent beams" option.

## 2026-10-04 — PR: claude/fix-lldf (PR link added after merge)

Check cases below were run in Node by extracting the engine (`/* ---------- formatting helpers` … end of `computeBridge`) from the old file (origin/main) and the new file and calling `computeBridge` with the same inputs. The full page was also loaded in jsdom (no console errors). Unless stated, the inputs are the fresh-page defaults: 1 span L = 120 ft, t_s = 8 in, 5 beams at 9.75 ft, overhangs 4.0 ft, railing face 1.5 ft from the deck edge (d_e = 2.5 ft), I = 260,730 in⁴, A = 789 in², e_g = 35.5 in, n = 1, no skew.

### F1. Exterior-girder fatigue DF ignored the rigid-section method   [calc change] [more conservative]
- **Where:** function `memberDF`, beam-slab (a/e/k) exterior branch (≈ line 1845). Anchor text: `const rig1=(rig.trials&&rig.trials.length)?rig.trials[0].g:0`
- **Problem:** fatigue DF for exterior a/e/k girders was the one-lane lever rule ÷ 1.2 only. Art. 4.6.2.2.2d says the exterior DF shall not be taken less than the rigid cross-section value; the one-lane rigid value (`rig.trials[0].g`, includes m = 1.2) was computed but not used for fatigue. Strength DFs already used `rig.g` (max over all lane counts), so only fatigue changes. The rigid check is also applied to shear in this tool (strength `shrExt2` uses `rig.g`), so the same max is applied to fatigue shear.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 4.6.2.2.2d (and Eq. C4.6.2.2.2d-1); C3.6.1.1.2 (fatigue = one-lane DF ÷ 1.2).
- **Before:**
  ```js
    const base=(momExt1>=momExt2?"lever (1 ln)":(rig.g>mE?"rigid":"e-factor"));
    return {j,label,type,S,de,side,bay,emp,lever1,eM,eV,mE,vE,rig,n3info,tooWide,lvUsed,
      r:{momExt1,momExt2,shrExt1,shrExt2},gM:Math.max(momExt1,momExt2),gV:Math.max(shrExt1,shrExt2),
      fatM:fat(momExt1),fatV:fat(shrExt1),
      method:tooWide?(base==="rigid"?"rigid (S>16)":"lever (S>16)"):base};
  ```
- **After:**
  ```js
    const base=(momExt1>=momExt2?"lever (1 ln)":(rig.g>mE?"rigid":"e-factor"));
    // Fatigue (one truck): the exterior DF may not be less than the rigid-section value
    // (4.6.2.2.2d), so the one-lane basis is the larger of lever rule and rigid method, n_L = 1.
    const rig1=(rig.trials&&rig.trials.length)?rig.trials[0].g:0, fat1=Math.max(l1,rig1);
    const fatOneM=fat1*skew.scfM, fatOneV=fat1*skew.scfV;
    return {j,label,type,S,de,side,bay,emp,lever1,eM,eV,mE,vE,rig,n3info,tooWide,lvUsed,
      r:{momExt1,momExt2,shrExt1,shrExt2},gM:Math.max(momExt1,momExt2),gV:Math.max(shrExt1,shrExt2),
      fatM:fat(fatOneM),fatV:fat(fatOneV),fatOneM,fatOneV,
      fatNote:(rig1>l1+1e-9)?`One-lane basis = rigid method with one lane loaded (${f3(rig1)}), which exceeds the one-lane lever rule (${f3(l1)}); the exterior DF may not be less than the rigid-section value (4.6.2.2.2d)`:"",
      method:tooWide?(base==="rigid"?"rigid (S>16)":"lever (S>16)"):base};
  ```
  And in `memberSteps` → `fatStep` (≈ line 2050), so the derivation shows the value actually used:
  ```js
  // before
    const oneM=(md.r&&(md.r.mom1!=null?md.r.mom1:md.r.momExt1)), oneV=(md.r&&(md.r.shr1!=null?md.r.shr1:md.r.shrExt1));
  // after
    const oneM=md.fatOneM!=null?md.fatOneM:(md.r&&(md.r.mom1!=null?md.r.mom1:md.r.momExt1)), oneV=md.fatOneV!=null?md.fatOneV:(md.r&&(md.r.shr1!=null?md.r.shr1:md.r.shrExt1));
  ```
- **Check case:** defaults but overhangs OL = OR = 0.5 ft (d_e = 0.5 − 1.5 = −1.0 ft). Girders at x = 0, 9.75, 19.5, 29.25, 39 ft; x_c = 19.5, X_ext = 19.5, Σx² = 2(19.5² + 9.75²) = 950.625 ft².
  - Lever, 1 lane: wheels 2 ft from the barrier face = 3.0 ft and 9.0 ft inboard of B1 → R = ½[(9.75−3)/9.75 + (9.75−9)/9.75] = 0.3846; ×1.2 = 0.4615.
  - Rigid, 1 lane: e = (X_ext + d_e) − 5 = 18.5 − 5 = 13.5 ft → R = 1/5 + 19.5×13.5/950.625 = 0.4769; ×1.2 = 0.5723.
  - **Before:** B1/B5 fatigue g_M = g_V = 0.4615/1.2 = **0.3846**. **After:** 0.5723/1.2 = **0.4769** (+24%). Strength g_M = g_V = 0.7077 (rigid, 2 lanes) unchanged.
  - Second case: 6 beams at 8 ft, OL = OR = 2 ft: B1 fatigue 0.4375 → 0.4435.
  - Fresh-page defaults: unchanged (0.7436; lever governs).
- **How verified:** Node run of old vs new engine (above); jsdom page load shows the new note in step 4.x "Fatigue limit state".
- **Other copies of this code:** none known.

### F2. d_e outside its range of applicability, or clamped, without a warning   [display] [no result change]
- **Where:** function `bridgeWarnings` (≈ line 1967). Anchor text: `d_e range of applicability (Tables 4.6.2.2.2d-1 / 4.6.2.2.3b-1)`
- **Problem:** `memberDF` clamps d_e (beam-slab `Math.max(de0,-1.0)`; adjacent box `Math.min(de0,2.0)`; spread box to [0, 4.5]; multicell to [−2.0, 5.0]) and does not check beam-slab d_e > 5.5 ft at all. No warning was shown. Clamping at the upper bound lowers e and is **unconservative**.
- **Governing provision:** AASHTO LRFD 10th Ed. Tables 4.6.2.2.2d-1 and 4.6.2.2.3b-1 (range of applicability columns).
- **Before:** (no code; the `bridgeWarnings` function ended with)
  ```js
  if(p.spans&&p.spans.length>1) warn(`Continuous structure: L = ${f1(p.L)} ft for the selected design region (${p.Ldesc||""}) per Table C4.6.2.2.1-2.`,"info");
  return w;
  ```
- **After:** (clamping behaviour itself is unchanged)
  ```js
  if(p.spans&&p.spans.length>1) warn(`Continuous structure: L = ${f1(p.L)} ft for the selected design region (${p.Ldesc||""}) per Table C4.6.2.2.1-2.`,"info");
  { /* d_e range of applicability (Tables 4.6.2.2.2d-1 / 4.6.2.2.3b-1). memberDF clamps d_e for some
       girder types; say so whenever d_e is outside the range, and say which way the clamp acts. */
    let lo=null,hi=null,clampLo=false,clampHi=false;
    if(BEAM_SLAB.has(p.type)){ lo=-1.0; hi=5.5; clampLo=true; }
    else if(BOX.has(p.type)){ hi=2.0; clampHi=true; }
    else if(p.type==="bc"){ lo=0.0; hi=4.5; clampLo=clampHi=true; }
    else if(p.type==="d"){ lo=-2.0; hi=5.0; clampLo=clampHi=true; }
    if(hi!=null) [["left",geo.deL],["right",geo.deR]].forEach(([nm,de])=>{
      const rng=lo==null?`d_e ≤ ${f1(hi)} ft`:`${f1(lo)} ≤ d_e ≤ ${f1(hi)} ft`;
      const head=`d_e = ${f2(de)} ft at the ${nm} exterior girder is outside the range ${rng} (Tables 4.6.2.2.2d-1 / 4.6.2.2.3b-1). `;
      if(lo!=null&&de<lo-1e-9) warn(head+(clampLo?`d_e = ${f1(lo)} ft is used in the e-factors (clamped up; this raises e).`:`The e-factor equations are extrapolated.`));
      else if(de>hi+1e-9) warn(head+(clampHi?`d_e = ${f1(hi)} ft is used in the e-factors (clamped DOWN; this LOWERS e and the exterior-girder DF, which is unconservative). Check the exterior girder by another method (e.g. lever rule / refined analysis).`:`The e-factor equations are extrapolated beyond their range; check the exterior girder by another method.`));
    });
  }
  ```
  (followed by the F3 block and `return w;`)
- **Check case:** defaults with OL = OR = 8 ft (d_e = 6.5 ft): before, no warning; after, two "warn" notes (left and right). DFs identical before/after (B1 1.3846 / 1.3846 / 1.1538 / 1.1538). Type b/c with OL = 8: warning "clamped DOWN … unconservative".
- **How verified:** Node run; jsdom page shows the notes in the Notes section.
- **Other copies of this code:** none known.

### F3. Skew θ > 60° silently capped   [display] [no result change]
- **Where:** function `bridgeWarnings` (≈ line 1981). Anchor text: `if(p.skew>60 && p.type!=="slab")`
- **Problem:** `skewFactors` uses `thU=Math.min(th,60)` for both moment and shear, without telling the user.
- **Governing provision:** AASHTO LRFD 10th Ed. Table 4.6.2.2.2e-1 (θ ≤ 60°; "if θ > 60° use θ = 60°" for c1), Table 4.6.2.2.3c-1 (0° ≤ θ ≤ 60°).
- **Before:** none (see F2 "Before").
- **After:**
  ```js
  if(p.skew>60 && p.type!=="slab")
    warn(`Skew θ = ${f0(p.skew)}° exceeds the 60° limit of Tables 4.6.2.2.2e-1 / 4.6.2.2.3c-1. θ = 60° is used for BOTH the moment reduction and the shear correction (capped). The table directs θ = 60° for the moment reduction; the shear correction is only defined up to 60°, so the obtuse-corner shear may be understated. Consider a refined analysis (4.6.3).`);
  return w;
  ```
- **Check case:** defaults with skew 65°: DFs identical before/after (B1 g_V 1.1558, B2 g_V 1.2110); after, the warning appears.
- **How verified:** Node + jsdom.
- **Other copies of this code:** none known.

### F4. Lever-rule scan could step over the peak (0.25 ft grid)   [calc change] [more conservative]
- **Where:** function `leverConfig` (≈ line 1752). Anchor text: `R(s) is piecewise linear in s`
- **Problem:** the truck train was only tested at 0.25-ft steps. Peaks occur with a wheel exactly over a girder line or at the end of travel (wheel 2 ft from the far barrier face); either can fall between grid points. The review thought exterior one-lane cases were exact, but the **far-side** (right) exterior girder's governing position is the end of travel, which is not on the grid unless the roadway width happens to fit it. Every miss is unconservative.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 3.6.1.3.1 (wheel 2 ft from the barrier face), C4.6.2.2.1 (lever rule). No change to the method, only the search.
- **Before:**
  ```js
    let best=null;
    for(let s=rw0+2; s<=rw1-2-trainLen+1e-9; s+=0.25){
      let R=0; for(const o of off) R+=0.5*leverContribution(pos,Nb,j,s+o);
      if(!best||R>best.R+1e-9) best={R,s};
    }
    if(!best) return null;
  ```
- **After:**
  ```js
    let best=null;
    for(let s=rw0+2; s<=rw1-2-trainLen+1e-9; s+=0.25){
      let R=0; for(const o of off) R+=0.5*leverContribution(pos,Nb,j,s+o);
      if(!best||R>best.R+1e-9) best={R,s};
    }
    /* R(s) is piecewise linear in s, with kinks only where a wheel crosses a girder line, so its
       maximum is at such a position or at an end of the travel range. Test those exactly too, so
       the 0.25-ft grid above cannot step over the peak. */
    { const sMin=rw0+2, sMax=rw1-2-trainLen, cand=[sMax];
      for(const u of pos) for(const o of off) cand.push(u-o);
      for(const s of cand){
        if(s<sMin-1e-9||s>sMax+1e-9) continue;
        let R=0; for(const o of off) R+=0.5*leverContribution(pos,Nb,j,s+o);
        if(!best||R>best.R+1e-9) best={R,s};
      } }
    if(!best) return null;
  ```
- **Check case:** defaults with OL = OR = 4.1 ft (symmetric bridge). Deck 47.2 ft, roadway edge rw1 = 45.7 ft, end of travel s = 45.7 − 2 − 6 = 37.7 ft; the grid stops at 37.5. B5 at x = 43.1 ft, B4 at 33.35 ft.
  - Before: wheels at 37.5 / 43.5 → R = ½[(37.5−33.35) + (43.5−33.35)]/9.75 = 0.7333; g = 0.8800 (fatigue 0.7333). B1 (left, exact) = 0.9046. Symmetric bridge gave unequal exterior DFs.
  - After: wheels at 37.7 / 43.7 → R = ½(4.35 + 10.35)/9.75 = 0.7538; g = **0.9046** (fatigue 0.7538) = B1. +2.8% on B5.
  - Fresh-page defaults: unchanged.
- **How verified:** Node run old vs new.
- **Other copies of this code:** none known.

### F5. S > 16 ft (and spread box S > 18 ft) lever fallback considered only 1 and 2 trucks   [calc change] [more conservative]
- **Where:** new helper `leverMulti` (after `leverAll`, ≈ line 1779) and its four call sites in `memberDF`. Anchor text: `function leverMulti(p,geo,j)`
- **Problem:** where the lever rule replaces the "2+ lanes" equation, only `leverConfig(…,2)` was used. With wide spacing a third truck (m = 0.85) can fit in two adjacent bays and govern. `leverAll` already tried N = 1..N_L but was used only for the figure.
- **Governing provision:** AASHTO LRFD 10th Ed. Tables 4.6.2.2.2b-1 / 4.6.2.2.3a-1 (lever rule for S out of range), Art. 3.6.1.1.2 (multiple presence 1.20 / 1.00 / 0.85 / 0.65).
- **Before:**
  ```js
  // beam-slab interior
          const lv1=leverConfig(p,geo,j,1), lv2=leverConfig(p,geo,j,2);
  // beam-slab exterior
        const lv2=leverConfig(p,geo,j,2); lvUsed={lv2,eq:{mE,vE}};
  // spread box interior
        if(tooWide){ const lv1=leverConfig(p,geo,j,1),lv2=leverConfig(p,geo,j,2); lvUsed={lv1,lv2};
  // spread box exterior
      if(tooWide){ lv2=leverConfig(p,geo,j,2); mE=lv2?lv2.df:0; vE=lv2?lv2.df:0; }
  ```
- **After:**
  ```js
  /* Governing lever-rule config with two or more trucks (every lane count N = 2..N_L, each with
     its own multiple-presence factor). Used where the lever rule replaces the "2+ lanes" equation. */
  function leverMulti(p,geo,j){
    return leverAll(p,geo,j).cfgs.filter(c=>c.N>=2).reduce((a,b)=>(!a||b.df>a.df)?b:a,null);
  }
  // beam-slab interior
          const lv1=leverConfig(p,geo,j,1), lv2=leverMulti(p,geo,j);   // lv2 = governing of N = 2..N_L trucks
  // beam-slab exterior
        const lv2=leverMulti(p,geo,j); lvUsed={lv2,eq:{mE,vE}};   // governing of N = 2..N_L trucks
  // spread box interior
        if(tooWide){ const lv1=leverConfig(p,geo,j,1),lv2=leverMulti(p,geo,j); lvUsed={lv1,lv2};
  // spread box exterior
      if(tooWide){ lv2=leverMulti(p,geo,j); mE=lv2?lv2.df:0; vE=lv2?lv2.df:0; }
  ```
  Display only, in `memberSteps` (S > 16 step), the truck count is now shown: `(lv2?`\\qquad g_{2+\\,ln}=${f3(lv2.df)}\\ (${lv2.N}\\text{ trucks})`:"")` (was `(lv2?`\\qquad g_{2+\\,ln}=${f3(lv2.df)}`:"")`).
- **Check case:** 5 beams at 17.5 ft, OL = OR = 3 ft, rails 1.5 ft (roadway 73 ft, N_L = 6). Interior B3 at x = 38 ft (neighbours 20.5 and 55.5).
  - 2 trucks: R = 1.4286, m = 1.00 → 1.4286 (old governing value).
  - 3 trucks, wheels 22, 28, 32, 38, 42, 48 ft: contributions 0.0857, 0.4286, 0.6571, 1.0, 0.7714, 0.4286 → R = ½ × 3.3714 = 1.6857; × 0.85 = **1.4329**.
  - Before: B2–B4 g_M = g_V = 1.4286. After: 1.4329 (+0.3%). Exterior B1/B5 unchanged (rigid governs, 1.0783).
  - 4 beams at 17 ft: unchanged (two trucks still govern).
- **How verified:** Node run old vs new, with every `leverConfig` N printed.
- **Other copies of this code:** none known.

### F6. "Two adjacent beams" DL option gave exactly P to the exterior beam for overhang loads   [calc change] [more conservative for the exterior beam; less conservative for the first interior beam]
- **Where:** dead-load module, function `distribute`, arrow `two` (≈ line 3815). Anchor text: `Overhang load: simple-span lever about the first interior beam`
- **Problem:** a load outside the exterior beam (e.g. a railing on the overhang) was given entirely to the exterior beam (P). Simple-span lever action gives P(1 + a/S) to the exterior beam and −P·a/S to the next beam.
- **Governing provision:** statics (simple-span / lever distribution); MassDOT Bridge Manual §3.5.3 offers this option. Only affects loads whose method is set to "Two adjacent beams" (not the default).
- **Before:**
  ```js
        if(xL<=ub[0]) r[0]=P; else if(xL>=ub[N-1]) r[N-1]=P;
  ```
- **After:**
  ```js
        // Overhang load: simple-span lever about the first interior beam — P(1+a/S) on the exterior
        // beam and −P·a/S on the next one (sums to P).
        if(xL<=ub[0]){ const S1=ub[1]-ub[0], a=ub[0]-xL; if(S1>0){ r[0]=P*(1+a/S1); r[1]=-P*a/S1; } else r[0]=P; }
        else if(xL>=ub[N-1]){ const S1=ub[N-1]-ub[N-2], a=xL-ub[N-1]; if(S1>0){ r[N-1]=P*(1+a/S1); r[N-2]=-P*a/S1; } else r[N-1]=P; }
  ```
  Text updated to match: the `mdDistAssume` sentence now reads "…<b>Two adjacent beams</b> (split by position to the beams either side; a load on an overhang is levered about the first interior beam: P(1+a/S) to the exterior beam and −P·a/S to the next)." and the "Distribution rules available to each load" step note now starts "<b>Two adjacent beams</b>, load on an overhang a beyond the exterior beam: R<sub>ext</sub> = P(1 + a/S), R<sub>next</sub> = −P·a/S (simple-span lever about the first interior beam, S = exterior bay). The <b>max[ ]</b> …".
- **Check case:** beams at 4, 13.75, 23.5, 33.25, 43 ft; P = 0.500 klf at x = 1.0 ft (a = 3.0 ft, S = 9.75 ft).
  - Before: B1 = 0.5000, B2 = 0.
  - After: B1 = 0.5 × (1 + 3/9.75) = **0.6538**, B2 = −0.5 × 3/9.75 = **−0.1538** (Σ = 0.500).
  - Right side, x = 45.5 (a = 2.5): B5 0.5000 → 0.6282, B4 0 → −0.1282.
  - Loads between beams and loads exactly on a beam: unchanged.
- **How verified:** the `two` arrow was extracted from both files and run in Node.
- **Other copies of this code:** none known.
- **Note:** the first interior beam now gets a negative (relief) share. The pile-cap method deliberately gives no uplift relief. See open item O6.

### F7. Blank or zero inputs gave NaN / Infinity with no message   [robustness] [no result change for valid inputs]
- **Where:** new function `inputErrors` (after `bridgeWarnings`, ≈ line 1988); guard at the top of `computeBridge`; new `showInputErrors` and a guard in `run()` (≈ line 2479). Anchor text: `function inputErrors(p){`
- **Problem:** blank fields read as 0. Span = 0 or t_s = 0 made every interior moment DF Infinity. A zero bay spacing divided by zero in the lever rule. Depth = 0 zeroed the spread-box DFs. None of this raised an error message, and the values were published to the suite.
- **Governing provision:** n/a
- **Before:**
  ```js
  function computeBridge(p){
    const geo=geometry(p);
  ...
  function run(){
    const p=readInputs();
    const R=computeBridge(p);
  ```
- **After:**
  ```js
  /* Inputs that make the equations divide by zero or go non-finite. Blank fields read as 0.
     computeBridge refuses to run with any of these, and run() lists them for the user. */
  function inputErrors(p){
    const e=[], bad=v=>!(isFinite(v)&&v>0);
    (p.spans||[]).forEach((L,i)=>{ if(bad(L)) e.push(`${p.spans.length>1?`Span ${i+1} length`:"Span length"} L is blank, zero or negative — enter a span length > 0 ft.`); });
    (p.spacings||[]).forEach((S,i)=>{ if(bad(S)) e.push(`Beam spacing Beam ${i+1} → Beam ${i+2} is blank, zero or negative — enter a spacing > 0 ft.`); });
    if(BEAM_SLAB.has(p.type)){
      if(bad(p.ts)) e.push("Slab thickness t_s is blank, zero or negative — enter t_s > 0 in.");
      if(bad(p.n*(p.I+p.A*p.eg*p.eg))) e.push("K_g = n(I + A·e_g²) is zero or negative — check n, I, A and e_g.");
    }
    if((p.type==="bc"||p.type==="d"||(BOX.has(p.type)&&p.skew>0))&&bad(p.depth)) e.push("Beam depth d is blank, zero or negative — enter d > 0 in.");
    if(BOX.has(p.type)){
      if(bad(p.boxB)) e.push("Box beam width b is blank, zero or negative.");
      if(bad(p.boxI)) e.push("Box beam I is blank, zero or negative.");
      if(bad(p.boxJ)) e.push("Box beam J is blank, zero or negative.");
    }
    return e;
  }

  function computeBridge(p){
    const inErr=inputErrors(p);
    if(inErr.length){ const er=new Error("Input error:\n"+inErr.join("\n")); er.inputErrors=inErr; throw er; }
    const geo=geometry(p);
  ...
  function showInputErrors(errs){
    $("summaryTable").innerHTML=`<tbody><tr><td style="color:var(--governs);font-weight:600;text-align:left;white-space:normal">Cannot compute the distribution factors — fix ${errs.length>1?"these inputs":"this input"}:<br>${errs.join("<br>")}</td></tr></tbody>`;
    $("steps").innerHTML=""; $("leverSection").style.display="none"; $("applSection").style.display="none";
    renderNotes(errs.map(m=>({msg:"Input error: "+m,level:"warn"})));
  }
  function run(){
    const p=readInputs();
    const inErr=inputErrors(p);
    if(inErr.length){ showInputErrors(inErr); return; }
    const R=computeBridge(p);
  ```
  Every other `computeBridge` caller already sits in a try/catch (`publishDF` shows "Compute failed — fix the inputs first", `govRegions`, `serialize`, `renderMD`), so with an input error nothing is published.
- **Check case:** t_s blank: before, B1–B5 g_M = Infinity; after, the results table says "Cannot compute … Slab thickness t_s is blank, zero or negative" and nothing is published. Span 0, bay 2 = 0, and type b/c with d = 0 behave the same way. Valid inputs: identical results.
- **How verified:** Node + jsdom (the cleared t_s field gave the message; `bridgeSuite.v1.lldf` stayed unwritten).
- **Other copies of this code:** none known.

### F8. Fresh-page default labelled AASHTO Type IV concrete properties as "Steel I-girder"   [display] [no DF change; DL self-weight reference value changes]
- **Where:** HTML `<select id="bridgeType">` and `<select id="beamShape">` (≈ lines 373, 420); `DEFAULTS` object (≈ line 2380; the object is not read anywhere, changed only for consistency). Anchor text: `<option value="k" selected>`
- **Problem:** a fresh page opened as type (a) "Concrete deck on steel beams" / "Steel I-beam", but the default I = 260,730 in⁴, A = 789 in², d = 54 in, n = 1 are AASHTO Type IV precast concrete properties. The a/e/k equations are identical, so the DFs were right for a Type IV girder, but the label was wrong and the DL module used the steel unit weight for the (reference-only) beam self-weight.
- **Governing provision:** n/a
- **Before:**
  ```html
            <option value="k">(k) Concrete deck on precast concrete I / bulb-tee beams</option>
  ...
                <option value="aashto-i">AASHTO I-beam</option>
  ```
  ```js
    inputs:{type:"a",beamShape:"steel-i",spans:[120], ...
  ```
- **After:**
  ```html
            <option value="k" selected>(k) Concrete deck on precast concrete I / bulb-tee beams</option>
  ...
                <option value="aashto-i" selected>AASHTO I-beam</option>
  ```
  ```js
    inputs:{type:"k",beamShape:"aashto-i",spans:[120], ...
  ```
- **Check case:** fresh page: all DFs unchanged (B1 0.892/0.892/0.744/0.744; B2–B4 0.723/0.935/0.408/0.625). Changed: (1) label type (k) / AASHTO I-beam; (2) the DL module's reference-only "beam self-weight" note changes from 789/144 × 0.490 = 2.685 klf (steel unit weight) to 789/144 × concrete unit weight (0.150 kcf → 0.822 klf). This value is excluded from DC1. It is published as `selfWt` in `bridgeSuite.v1.dlLoads`, but only so the MCT app can show it in a note ("DC1 excludes the girder self-weight (x klf)…"). No DC1/DC2/DW value changes; (3) a fresh page publishes `type:"k"` instead of `"a"` to `bridgeSuite.v1.lldf`. Saved projects and autosave carry their own type and are unaffected.
- **How verified:** jsdom fresh-page load (bridgeType = k, beamShape = aashto-i, same table values).
- **Other copies of this code:** none known.

## Open items (not changed)
- O1. **d_e clamping at the upper bound is unconservative.** Adjacent box (f/g) clamps d_e to ≤ 2.0 ft, spread box (b/c) to ≤ 4.5 ft and multicell (d) to ≤ 5.0 ft. All of these lower e. This PR keeps the clamp and adds a warning (F2). **Question for the engineer:** should the tool stop clamping at the upper bound (use the actual d_e, i.e. extrapolate, which is more conservative) or keep clamping with the warning? The lower-bound clamps (beam-slab −1.0, spread box 0, multicell −2.0) raise e and are conservative.
- O2. **N_b = 3 exterior interpretation** (`memberDF`, `mE=Math.min(mE, lv2.df)`; `vE = lv2.df`). The code takes the lesser of e·g_int,eq and the exterior lever rule. An alternative reading applies e to the reduced interior value (lesser of the interior equation and the interior lever rule). The results are usually close, and the rigid floor still applies. Needs the engineer's interpretation; not changed.
- O3. **Single K_g for positive and negative regions.** `govRegions` recomputes the DFs for each pier region with L = average of the adjacent spans, but reuses the same n, I, A, e_g. Some owners require K_g from the negative-region section. Needs a decision on whether to add a separate negative-region K_g input.
- O4. **CIP slab type publishes per-foot strip factors** in the same `gM`/`gV` fields of `bridgeSuite.v1.lldf` that hold per-girder factors for the other types. A consumer app could misread them. Changing the published format is a saved-data/handoff change (CLAUDE.md §5), so it was not touched. Needs a decision: a separate field or a flag (e.g. `perFootStrip:true`), plus checking how index/psbeam/stgirder read it.
- O5. **Modular ratio n for concrete library picks** is hard-set to 1 (`applySection`). AASHTO uses n = E_beam/E_deck, typically 1.1–1.3 when the girder f'c exceeds the deck f'c. The field stays editable. Not changed (it would change results).
- O6. **"Two adjacent beams" relief on the first interior beam.** F6 gives the interior beam −P·a/S, which is correct statics. The MassDOT pile-cap option deliberately takes no uplift relief. Should "two adjacent beams" also drop the negative share (sum > P, conservative for the interior beam)? Needs the engineer's preference / MassDOT confirmation.
- O7. **CIP slab strip width** uses the clear roadway, not the physical edge-to-edge width, and the slab skew factor (Eq. 4.6.2.3-3) is not applied. Both are conservative; noted only.
- O8. **N_b = 3 lever rule uses 1 and 2 trucks only** (not `leverMulti`). With N_b = 3 and S ≤ 16 ft a third truck rarely fits across two bays; left as is with O2.
- O9. **Edition label.** The page does not state the AASHTO edition. Not changed here (label-only change; out of scope for this PR).

## 2026-10-04 — PR: claude/step1-group1 (PR link added after merge)

Feature (no result change): "← All tools" link to `tools.html` (`target="_top"`, hidden in print) and the shared project info buttons. No formula, factor, unit, storage key or saved format changed. New storage written only on "Share project info": `bridgeSuite.v1.projectMeta` and `bridgeSuite.v1.projectMeta.updatedAt` (HANDOFF.md §2/§4.1). Link and buttons sit in the existing `noprint` header, so they do not print. The bridgeSuite bootstrap blocks are unchanged.

Field mapping: projectName ↔ Project (`mProject`), bridgeId ↔ Structure No. (`mStruct`), preparedBy ↔ Calc. by (`mBy`), checkedBy ↔ Checked (`mChk`), date ↔ Date (`mDate`). jobNo, client, location: not in this tool. Sheet is not mapped. Writes set the input value and dispatch `input`, which runs the existing autosave.

### S1. "← All tools" link in the toolbar title   [feature (no result change)]
- **Where:** `<header class="apphead noprint">` → `.toolbar .tt` (≈ line 321). Anchor text: `<div class="tt">`
- **Problem:** none (feature). Approved step 1 of the cross-tool work: "← All tools" link and shared project info (HANDOFF.md §4.1).
- **Governing provision:** n/a (no calculation, factor, unit or code reference touched).
- **Before:**
  ```html
      <div class="toolbar">
        <div class="tt">LL &amp; DL Distribution <span>AASHTO LRFD 4.6.2.2 · MassDOT §3.5.3</span></div>
        <div class="actions">
  ```
- **After:**
  ```html
      <div class="toolbar">
        <div class="tt"><a class="bx-alltools" href="tools.html" target="_top" title="Open the list of all tools" style="color:#9fb4c9;font-family:var(--body);font-weight:400;font-size:11.5px;text-decoration:none;margin-right:12px">&larr; All tools</a>LL &amp; DL Distribution <span>AASHTO LRFD 4.6.2.2 · MassDOT §3.5.3</span></div>
        <div class="actions">
  ```
- **Check case:** n/a, no computed value changes. Functional check: see How verified.
- **How verified:** `node --check` on every plain inline script and @babel/standalone transpile of the text/babel block; BridgeXfer copy compared byte-for-byte with HANDOFF.md §5; whole page loaded in jsdom (React/ReactDOM/Babel from npm, other CDN scripts blocked); Share → Use round trip between lldf, Moving Load Generator, psbeam, stgirder and index with one shared localStorage; `git diff` shows only additions apart from the one header line that received the link.
- **Other copies:** BridgeXfer v1 and the `BXProject` glue are also in index.html, lldf.html, psbeam.html, stgirder.html and Moving Load Generator.html (this PR).

### S2. "Use shared project info" / "Share project info" buttons   [feature (no result change)]
- **Where:** project bar, before Export JSON (≈ line 340). Anchor text: `id="projExport"`
- **Problem:** none (feature). Approved step 1 of the cross-tool work: "← All tools" link and shared project info (HANDOFF.md §4.1).
- **Governing provision:** n/a (no calculation, factor, unit or code reference touched).
- **Before:**
  ```html
        <div class="pb-group">
          <button class="btn sm" id="projExport" title="Download this calculation as a JSON file">Export JSON</button>
  ```
- **After:**
  ```html
        <div class="pb-group">
          <button class="btn sm" id="bxProjUse" title="Fill Project, Structure No., Calc. by, Checked and Date from the project info shared by another tool (asks first; never blanks a field)">Use shared project info</button>
          <button class="btn sm" id="bxProjShare" title="Share this calculation's project info with the other tools">Share project info</button>
          <button class="btn sm" id="projExport" title="Download this calculation as a JSON file">Export JSON</button>
  ```
- **Check case:** n/a, no computed value changes. Functional check: see How verified.
- **How verified:** `node --check` on every plain inline script and @babel/standalone transpile of the text/babel block; BridgeXfer copy compared byte-for-byte with HANDOFF.md §5; whole page loaded in jsdom (React/ReactDOM/Babel from npm, other CDN scripts blocked); Share → Use round trip between lldf, Moving Load Generator, psbeam, stgirder and index with one shared localStorage; `git diff` shows only additions apart from the one header line that received the link.
- **Other copies:** BridgeXfer v1 and the `BXProject` glue are also in index.html, lldf.html, psbeam.html, stgirder.html and Moving Load Generator.html (this PR).

### S3. BridgeXfer v1 + BXProject glue + title-block wiring   [feature (no result change)]
- **Where:** new `<script>` at the end of `<body>` (≈ line 4358). Anchor text: `BridgeLocks.drawer({app:'lldf'})`
- **Problem:** none (feature). Approved step 1 of the cross-tool work: "← All tools" link and shared project info (HANDOFF.md §4.1).
- **Governing provision:** n/a (no calculation, factor, unit or code reference touched).
- **Before:**
  ```html
  </script>
  </body>
  ```
- **After:**
  ```html
  </script>
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
  /* Shared project info: lldf title block <-> HANDOFF.md §4.1 fields. */
  (function(){
    var MAP={projectName:'mProject',bridgeId:'mStruct',preparedBy:'mBy',checkedBy:'mChk',date:'mDate'};
    function el(id){ return document.getElementById(id); }
    function own(){ var o={}; Object.keys(MAP).forEach(function(k){ var e=el(MAP[k]); o[k]=e?e.value:''; }); return o; }
    var bu=el('bxProjUse'), bs=el('bxProjShare');
    if(bs) bs.onclick=function(){ if(window.BXProject) BXProject.share(own()); };
    if(bu) bu.onclick=function(){ if(!window.BXProject) return;
      BXProject.use(own(), function(upd){ Object.keys(upd).forEach(function(k){ var e=el(MAP[k]); if(!e) return;
        e.value=upd[k]; e.dispatchEvent(new Event('input',{bubbles:true})); }); }); };   // input event -> normal autosave
  })();
  </script>
  </body>
  ```
- **Check case:** n/a, no computed value changes. Functional check: see How verified.
- **How verified:** `node --check` on every plain inline script and @babel/standalone transpile of the text/babel block; BridgeXfer copy compared byte-for-byte with HANDOFF.md §5; whole page loaded in jsdom (React/ReactDOM/Babel from npm, other CDN scripts blocked); Share → Use round trip between lldf, Moving Load Generator, psbeam, stgirder and index with one shared localStorage; `git diff` shows only additions apart from the one header line that received the link.
- **Other copies:** BridgeXfer v1 and the `BXProject` glue are also in index.html, lldf.html, psbeam.html, stgirder.html and Moving Load Generator.html (this PR).

## 2026-10-04 — PR: claude/conn-lldf-movingload (PR link added after merge)

Feature: hand-off (no result change). Sender side of lldf → Moving Load Generator (channel `bridgeSuite.v1.lldf`, HANDOFF.md §4.3). No formula, factor, default, unit, storage key or saved format changed. The DF payload keeps every existing field with the same values; new fields are additive and the existing receivers (index, psbeam, stgirder) ignore them. Because of the no-op-republish check, the first send after this change rewrites the key once.

### H1. DF payload: per-span envelope, units and basis flags; build split from write; "Export DF hand-off (JSON)" button   [feature: hand-off (no result change)]
- **Where:** `publishDF` in the "Bridge Suite integration (v1)" script (≈ line 3168). Anchor text: `function publishDF(silent)`. Toolbar button after `id="sendDFBtn"` (≈ line 326). Load-handler anchor: `var b=$('sendDFBtn'); if(b) b.addEventListener`.
- **Problem:** none (feature). Moving Load Generator has a DF input per span, but lldf only published the envelope over all spans. lldf also had no file export for this channel.
- **Governing provision:** n/a. `governingBySpan[i]` uses the existing `govRegions` with the single region `s<i>`, the same computation that `governing` already runs over all spans together.
- **Before / After:** exact diff (`-` = before, `+` = after):
  ```diff
@@ -325,4 +325,5 @@ var st=document.createElement('style'); st.textContent=css;
         <button class="btn" id="mctBackBtn" title="Back to the MCT analysis app">↩ MCT</button>
         <button class="btn" id="sendDFBtn" title="Publish the computed distribution factors to shared storage so PS-Beam and ST-Girder can pull them">⇄ Send DFs to Design Apps</button>
+        <button class="btn" id="exportDFBtn" title="Download the DF hand-off (the same data as Send DFs) as a JSON file, for 'Import hand-off (JSON)' in another tool or a calc package">⇩ Export DF hand-off (JSON)</button>
         <button class="btn" id="sendDLBtn" title="Publish the selected design beam's distributed dead load (DC1 / DC2 / DW, and pedestrian LL if any) so the MCT Generator's Loads tab can import it as beam UDLs">⇄ Send DL to MCT Loads</button>
         <button class="btn" id="openPSBtn" title="Open the prestressed concrete design app (pull the DFs there with 'Pull from LL &amp; DL Distribution')">PS ↗</button>
@@ -3166,9 +3167,14 @@ function flash(msg,bad){ var el=$('saveStatus'); if(!el) return; el.textContent=
 /* ---------- OUT: publish the computed DFs ---------- */
 function publishDF(silent){
-  if(!lsOK()){ if(!silent) alert('Browser storage is unavailable — cannot publish. Use Export JSON instead.'); return false; }
+  if(!lsOK()){ if(!silent) alert('Browser storage is unavailable — cannot publish. Use "Export DF hand-off (JSON)" instead.'); return false; }
+  var payload=buildDFPayload(silent); if(!payload) return false;
+  return writeDF(payload,silent);
+}
+/* Builds the 'bridgeSuite.v1.lldf' payload (also used by "Export DF hand-off (JSON)"). */
+function buildDFPayload(silent){
   var p,R;
   try{ p=readInputs(); R=computeBridge(p); }
-  catch(e){ if(!silent) alert('Compute failed — fix the inputs first.\n\n'+(e&&e.message||e)); return false; }
-  if(!R||!R.members||!R.members.length){ if(!silent) alert('No results to send — recalculate first.'); return false; }
+  catch(e){ if(!silent) alert('Compute failed — fix the inputs first.\n\n'+(e&&e.message||e)); return null; }
+  if(!R||!R.members||!R.members.length){ if(!silent) alert('No results to send — recalculate first.'); return null; }
   var r=function(v,d){ return (v==null||!isFinite(v))?null:+(+v).toFixed(d==null?4:d); };
   var mem=R.members.map(function(m){ return {girder:m.label,type:m.type,S:r(m.S,3),
@@ -3213,4 +3219,6 @@ function publishDF(silent){
   var posGov=govRegions(spanRs.length?spanRs:['s0']);
   var negGov=pierRs.length?govRegions(pierRs):null;
+  // Same envelope for each span on its own (index i = span i+1), for receivers with per-span DF inputs.
+  var bySpan=spanRs.map(function(rg){ return govRegions([rg]); });
   var payload={_schema:'bridge-lldf-factors',schemaVersion:1,producer:'LL & DL Distribution',
     producedAt:new Date().toISOString(),
@@ -3223,7 +3231,13 @@ function publishDF(silent){
     governing:posGov,          // positive-moment / shear governing across all spans
     governingNeg:negGov,       // negative-moment governing across all interior supports; null if single-span
+    governingBySpan:bySpan,    // positive-region envelope per span (same shape as governing); added for Moving Load Generator
+    units:{spans:'ft',S:'ft',skew:'deg',laneWidth:'ft',df:'lanes per girder (dimensionless)'},
+    multiplePresenceIncluded:true, skewIncluded:true,   // gM/gV; fatM/fatV = one-lane ÷ 1.2 (no MPF), skew included
     designBeam:(window.BridgeBeam&&window.BridgeBeam.get())||null,   // the suite-wide selected beam
     beamRoster:(window.BridgeBeam&&window.BridgeBeam.roster())||null,// layout, classification, per-beam DL
-    note:'governing = positive-region DFs (span L); governingNeg = negative-region DFs at interior supports (L = ½ of adjacent spans). gM/gV include multiple presence + skew; fatM/fatV are single-lane fatigue DFs. governing.byBeam / governingNeg.byBeam give the same envelope per individual girder, keyed by the 1-based beam number, so an app with a design beam selected can use that beam directly.'};
+    note:'governing = positive-region DFs (span L); governingNeg = negative-region DFs at interior supports (L = ½ of adjacent spans). gM/gV include multiple presence + skew; fatM/fatV are single-lane fatigue DFs. governing.byBeam / governingNeg.byBeam give the same envelope per individual girder, keyed by the 1-based beam number, so an app with a design beam selected can use that beam directly. governingBySpan[i] is the positive-region envelope for span i+1 alone.'};
+  return payload;
+}
+function writeDF(payload,silent){
   try{
     // Skip a no-op republish so a locked consumer is not woken by an identical payload.
@@ -3585,4 +3599,8 @@ function mountLockToggle(btnId,ch){
 window.addEventListener('load',function(){
   var b=$('sendDFBtn'); if(b) b.addEventListener('click',function(){ publishDF(false); });
+  var xb=$('exportDFBtn'); if(xb) xb.addEventListener('click',function(){
+    var pl=buildDFPayload(false); if(!pl) return;
+    if(!window.BridgeXfer){ alert('Export is not available in this browser.'); return; }
+    var r=BridgeXfer.exportFile('lldf',pl); if(r&&r.error) alert(r.error); });
   var dlb=$('sendDLBtn'); if(dlb) dlb.addEventListener('click',function(){ publishDL(false); });
   var ps=$('openPSBtn'); if(ps) ps.addEventListener('click',function(){ bridgeNav('psbeam'); });
  ```
- **New payload fields:** `governingBySpan` (array, one entry per span, same shape as `governing`), `units` `{spans:"ft", S:"ft", skew:"deg", laneWidth:"ft", df:"lanes per girder (dimensionless)"}`, `multiplePresenceIncluded: true`, `skewIncluded: true`; `note` gains one sentence.
- **Check case:** 2 spans 100 + 120 ft, skew 20°, defaults otherwise: `governingBySpan[0].interior` = gM 0.7598, gV 0.9898, fatM 0.4352, fatV 0.6617; `governingBySpan[1].interior` = 0.7234, 0.9929, 0.4081, 0.6638; `governing.interior` = 0.7598, 0.9929, 0.4352, 0.6638 (the max of the two, unchanged from before). Hand check of span 1: see Moving Load Generator.md, same PR.
- **How verified:** `node --check` on every plain inline script of both files (no JSX in either). End-to-end in node/jsdom with one shared localStorage stub (64 checks, all pass): lldf.html loaded, set to 2 spans 100 + 120 ft, skew 20°, defaults otherwise (5 girders @ 9.75 ft, Kg = 1,255,067 in⁴), its real "Send DFs to Design Apps" button clicked; Moving Load Generator.html loaded on the same storage, real "Pull from LL & DL Distribution" → dialog → Apply. Inputs checked equal to the mapped values (interior: span 1 0.7598 / 0.9898, span 2 0.7234 / 0.9929, negative moment 0.7405); exterior and per-beam choices checked; spans only changed with the option ticked; rail DFs untouched; adopted marker written; `lldfSource` in the autosave and restored on reload; fatigue warning quotes g_fat 0.4352 / 0.6638 / 0.4208 and the analysis still uses the DF inputs; report has the source row. JSON export (lldf) → import (Moving Load) round trip. Refusals: wrong `_schema`, `schemaVersion` 2, corrupt JSON (storage and file), negative DF, DF as a string, non-finite span, `units.spans:"m"`. Hand check of span 1 interior: Table 4.6.2.2.2b-1, Kg/(12 L ts³) = 1,255,067 / (12 × 100 × 512) = 2.0428; g = 0.075 + (9.75/9.5)^0.6 (9.75/100)^0.2 (2.0428)^0.1 = 0.7598 (two lanes, governs over one lane 0.5222; skew 20° < 30° so no moment reduction); shear 0.2 + 9.75/12 − (9.75/35)² = 0.9349 × skew factor 1 + 0.20 (1/2.0428)^0.3 tan 20° = 1.0588 → 0.9898. Both match lldf and the values written into Moving Load. No result change: with no hand-off, Moving Load results (all 342 section/reaction extremes in the default, a 3-span and the fatigue configuration, plus the metric tiles and warnings) are byte-identical to the file before this change. lldf: the existing payload fields from the old and new files are identical (only timestamps differ).
- **Other copies:** none (lldf is the only sender on this channel).
- **Open items:** the payload still has `project` as a string and no `producerFile`, kept for the existing receivers; documented in HANDOFF.md §4.3.

## 2026-10-04 — PR: claude/conn-geometry-lldf (PR link added after merge)

Feature (no result change): lldf receives the `bridgeSuite.v1.lldfGeom` hand-off from **Bridge Geometry** (HANDOFF.md §4.2), in addition to MCT / PS-Beam / ST-Girder. The existing prefill banner is reused and extended. Hunks are listed in file order; the code is exact.

### H1. Geometry hand-off from Bridge Geometry: pull, import, validation, source record   [feature: hand-off (no result change)]
- **Where:**
  - Header `.projbar` → buttons. Anchor: `id="projExport"` (hunk 1).
  - `serialize()` → anchor: `out.figures=(state.refImgs||[])` (hunk 2).
  - `applyState()` → anchor: `renderRefImgs();` (hunk 3).
  - Bridge Suite integration IIFE: `geomToken()` + new helpers `projName`, `isBG`, `fmtWhen`, `escH`, `validateGeom`, `geomOverwriteList`, `renderGeomSource` (hunk 4). Anchor: `function geomToken(g)`.
  - `showBanner()` (hunks 5–6). Anchor: `Geometry received from`.
  - `applyGeom()` (hunks 7–8). Anchor: `function applyGeom(g,token,silent)`.
  - `checkGeom()` + new `_geomNewFlag`, `paintGeomPull`, `pullGeom`, `importGeomFile` (hunks 9–10). Anchor: `if(seen===token) return;`.
  - `load` handler wiring (hunk 11). Anchor: `autoPublish();\n  checkGeom();`.
- **Problem:** none (feature). Approved connection Bridge Geometry → lldf on channel `lldfGeom`.
- **What changes for the user:**
  - New buttons **"Pull from <producer>"** (shows ● when a payload is new and not adopted, via `BridgeXfer.isNew` when the sender stamps `.updatedAt`, else the banner's existing seen token) and **"Import hand-off (JSON)"**. Both only raise the banner.
  - The banner also shows the time, the project (string or `{name,bridgeId}`), a "Will overwrite" list (current → new for every field sent) and the sender's `notes`.
  - Every number is validated before use (spans, spacings > 0; Nb whole and = spacings + 1; 0 ≤ skew < 90; O_L/O_R ≥ 0; t_s, d > 0; d_e finite), and any unit other than ft/deg is refused. This check applies to all producers.
  - A Bridge Geometry payload overwrites **only** spans, spacings/N_b, skew, O_L, O_R: it is applied on top of `serialize(false)`, so section, appurtenance, beam class, load overrides and figures are kept. Other producers keep the old `applyState({inputs})` path unchanged.
  - Bridge Geometry payloads are never auto-applied, even when the geometry channel is locked, and the banner offers no Lock for them. MCT / PS-Beam / ST-Girder lock behaviour is unchanged.
  - On adoption: `state.geomSource = {producer, producerFile, producedAt, project, fields}` (**new optional field** in the saved JSON and autosave; older saves load with none), `BridgeXfer.markAdopted('lldfGeom','lldf',producedAt)`, and a "Layout geometry source" line under the title block (inside `#sheet`, so it prints).
- **Mapping (Bridge Geometry → lldf):**

| Bridge Geometry (source) | Payload field | lldf input | Units |
|---|---|---|---|
| Chord distance between consecutive supports: `supportChordT(sta[i+1]) − supportChordT(sta[i])`, support centerlines (default) or bearing lines (choice) | `inputs.spans[]` | Span lengths L₁…Lₙ (`state.spans`) | ft, rounded 0.001 |
| \|skew\| per support (degrees from the normal to the chord); largest (default), smallest or average (choice) | `inputs.skew` | Skew θ (`#skew`) | deg |
| Differences of the sorted girder offsets (global, or one span's override set, choice) | `inputs.spacings[]` | Girder spacing table (`state.spacings`) | ft, rounded 0.001 |
| Number of girders | `Nb` | N_b (= spacings + 1) | — |
| girder 1 offset − left deck edge | `inputs.OL` | Left overhang O_L (`#OL`) | ft |
| right deck edge − last girder offset | `inputs.OR` | Right overhang O_R (`#OR`) | ft |
| shared project info, else library entry name | `project{name,bridgeId}` | Project (`#mProject`) only if blank | — |
| (not sent) | `de:null` | lldf keeps its own curb/railing inputs; d_e unchanged in method | — |

- **Governing provision:** n/a. No formula, factor, default, unit or code reference changed. The fields filled are the existing inputs of Art. 4.6.2.2 (L, S, N_b, θ) and the overhangs.
- **Saved data:** no key or format changed. Added the optional `geomSource` field only. The hand-off keys used are `bridgeSuite.v1.lldfGeom`, `.lldfGeom.updatedAt`, `.lldfGeom.adopted.lldf` (HANDOFF.md §2) and the existing `.lldfGeom.seen`.

HUNK 1 (≈ line 341 of the old file)
- **Before:**
  ```html
          <button class="btn sm" id="bxProjUse" title="Fill Project, Structure No., Calc. by, Checked and Date from the project info shared by another tool (asks first; never blanks a field)">Use shared project info</button>
          <button class="btn sm" id="bxProjShare" title="Share this calculation's project info with the other tools">Share project info</button>
          <button class="btn sm" id="projExport" title="Download this calculation as a JSON file">Export JSON</button>
          <button class="btn sm" id="projImport" title="Load a calculation from a JSON file">Import JSON</button>
  ```
- **After:**
  ```html
          <button class="btn sm" id="bxProjUse" title="Fill Project, Structure No., Calc. by, Checked and Date from the project info shared by another tool (asks first; never blanks a field)">Use shared project info</button>
          <button class="btn sm" id="bxProjShare" title="Share this calculation's project info with the other tools">Share project info</button>
          <button class="btn sm" id="bxGeomPull" title="Review the girder layout another tool has sent (spans, spacing, skew, overhangs) and choose whether to apply it">Pull geometry</button>
          <button class="btn sm" id="bxGeomImport" title="Load a geometry hand-off file (bridge-lldf-geometry JSON) exported by Bridge Geometry or a design app">Import hand-off (JSON)</button>
          <input type="file" id="bxGeomFile" accept="application/json,.json" style="display:none" />
          <button class="btn sm" id="projExport" title="Download this calculation as a JSON file">Export JSON</button>
          <button class="btn sm" id="projImport" title="Load a calculation from a JSON file">Import JSON</button>
  ```

HUNK 2 (≈ line 2951 of the old file)
- **Before:**
  ```js
    // Section 3.9 reference images travel with the project, alongside the inputs but not part of them.
    out.figures=(state.refImgs||[]).map(f=>({name:f.name||"",cap:f.cap||"",ref:f.ref||"",w:f.w||0,h:f.h||0,src:f.src}));
    if(includeResults){
      try{
  ```
- **After:**
  ```js
    // Section 3.9 reference images travel with the project, alongside the inputs but not part of them.
    out.figures=(state.refImgs||[]).map(f=>({name:f.name||"",cap:f.cap||"",ref:f.ref||"",w:f.w||0,h:f.h||0,src:f.src}));
    // Where the layout geometry last came from (bridgeSuite.v1.lldfGeom hand-off). New optional field; absent in older saves.
    if(state.geomSource) out.geomSource=Object.assign({},state.geomSource);
    if(includeResults){
      try{
  ```

HUNK 3 (≈ line 2973 of the old file)
- **Before:**
  ```js
        : [];
      renderRefImgs();
      if(Array.isArray(inp.spacings)&&inp.spacings.length>=1) state.spacings=inp.spacings.map(Number);
      renderSpacingTable();
  ```
- **After:**
  ```js
        : [];
      renderRefImgs();
      // Optional source record of the last geometry hand-off adopted (HANDOFF.md §3.4). Older saves have none.
      const gs=obj&&obj.geomSource;
      state.geomSource=(gs&&typeof gs==="object")?{producer:String(gs.producer||""),producerFile:String(gs.producerFile||""),
        producedAt:String(gs.producedAt||""),project:String(gs.project||""),
        fields:Array.isArray(gs.fields)?gs.fields.map(String):[]}:null;
      if(Array.isArray(inp.spacings)&&inp.spacings.length>=1) state.spacings=inp.spacings.map(Number);
      renderSpacingTable();
  ```

HUNK 4 (≈ line 3297 of the old file)
- **Before:**
  ```js
  function hideBanner(){ if(bannerEl){ bannerEl.remove(); bannerEl=null; } }
  function geomToken(g){ return (g&&((g.producedAt||'')+'@'+(g.producer||'')))||''; }
  /* One line naming what moved, for the change log and the toast. Compares the
     incoming layout against what is on screen right now, not against the last
  ```
- **After:**
  ```js
  function hideBanner(){ if(bannerEl){ bannerEl.remove(); bannerEl=null; } }
  function geomToken(g){ return (g&&((g.producedAt||'')+'@'+(g.producer||'')))||''; }
  /* ---- hand-off helpers (HANDOFF.md §3, §4.2) ----
     `project` is a plain string from MCT / PS-Beam / ST-Girder and the envelope's
     {name, bridgeId} object from Bridge Geometry; accept both. */
  function projName(g){ var p=g&&g.project; if(!p) return '';
    if(typeof p==='string') return p;
    if(typeof p==='object') return [p.name||'',p.bridgeId?('Bridge '+p.bridgeId):''].filter(Boolean).join(' · ');
    return ''; }
  function isBG(g){ return !!g&&(g.producer==='Bridge Geometry'||g.producerFile==='Bridge Geometry.html'); }
  function fmtWhen(iso){ var d=new Date(iso); if(!iso||isNaN(d)) return '—';
    var z=function(n){ return (n<10?'0':'')+n; };
    return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+' '+z(d.getHours())+':'+z(d.getMinutes()); }
  function escH(x){ return String(x==null?'':x).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  /* Every number this receiver would use is checked before anything is applied (HANDOFF.md §3.2).
     Units: the channel is feet / degrees; a payload that states any other unit is refused. */
  function validateGeom(g){
    var e=[], i=(g&&g.inputs);
    if(!g||typeof g!=='object') return ['not a geometry hand-off'];
    if(!i||typeof i!=='object') return ['the hand-off has no inputs block'];
    var fin=function(v){ return typeof v==='number'&&isFinite(v); };
    if(g.units&&typeof g.units==='object'){
      ['spans','spacings','OL','OR','de'].forEach(function(k){ if(g.units[k]!=null&&g.units[k]!=='ft') e.push(k+' is in "'+g.units[k]+'"; only ft is accepted'); });
      if(g.units.skew!=null&&g.units.skew!=='deg') e.push('skew is in "'+g.units.skew+'"; only deg is accepted');
    }
    if(i.spans!=null){ if(!Array.isArray(i.spans)||!i.spans.length) e.push('spans must be a non-empty list');
      else i.spans.forEach(function(v,k){ if(!fin(v)||v<=0) e.push('span '+(k+1)+' = '+v+' (must be a number > 0 ft)'); }); }
    if(i.spacings!=null){ if(!Array.isArray(i.spacings)||!i.spacings.length) e.push('spacings must be a non-empty list');
      else i.spacings.forEach(function(v,k){ if(!fin(v)||v<=0) e.push('spacing '+(k+1)+' = '+v+' (must be a number > 0 ft)'); }); }
    if(g.Nb!=null&&(!fin(g.Nb)||g.Nb<2||Math.round(g.Nb)!==g.Nb)) e.push('Nb = '+g.Nb+' (must be a whole number ≥ 2)');
    if(g.Nb!=null&&Array.isArray(i.spacings)&&i.spacings.length&&g.Nb!==i.spacings.length+1) e.push('Nb = '+g.Nb+' does not match '+i.spacings.length+' spacings');
    if(i.skew!=null&&(!fin(i.skew)||i.skew<0||i.skew>=90)) e.push('skew = '+i.skew+' (must be 0 ≤ θ < 90 deg)');
    ['OL','OR'].forEach(function(k){ if(i[k]!=null&&(!fin(i[k])||i[k]<0)) e.push(k+' = '+i[k]+' (must be a number ≥ 0 ft)'); });
    ['ts','depth'].forEach(function(k){ if(i[k]!=null&&(!fin(i[k])||i[k]<=0)) e.push(k+' = '+i[k]+' (must be a number > 0)'); });
    if(g.de!=null&&!fin(g.de)) e.push('d_e = '+g.de+' (must be a number)');
    return e;
  }
  /* Exactly what a prefill will overwrite, current value -> incoming value, one line per field. */
  function geomOverwriteList(g){
    var i=(g&&g.inputs)||{}, out=[], f=function(v){ return (v==null||v==='')?'—':String(v); };
    if(Array.isArray(i.spans)) out.push('Spans: '+f((state.spans||[]).join(' / '))+' → '+i.spans.join(' / ')+' ft');
    if(Array.isArray(i.spacings)){
      out.push('Number of beams N_b: '+((state.spacings||[]).length+1)+' → '+(i.spacings.length+1));
      out.push('Girder spacings: '+f((state.spacings||[]).join(' / '))+' → '+i.spacings.join(' / ')+' ft');
    }
    [['skew','Skew θ','deg'],['OL','Left overhang O_L','ft'],['OR','Right overhang O_R','ft'],['ts','Slab thickness t_s','in'],['depth','Beam depth d','in']].forEach(function(r){
      if(i[r[0]]!=null&&$(r[0])) out.push(r[1]+': '+f($(r[0]).value)+' → '+i[r[0]]+' '+r[2]); });
    if(i.OL==null&&g.de!=null&&$('OL')) out.push('Left overhang O_L: '+f($('OL').value)+' → d_e '+g.de+' ft + rail face offset');
    return out;
  }
  /* The adopted source, on screen and in the printed calculation (HANDOFF.md §3.4). */
  function renderGeomSource(){
    var gs=state.geomSource, el=document.getElementById('geomSrcLine');
    if(!gs||!gs.producer){ if(el) el.style.display='none'; return; }
    if(!el){ var tb=document.querySelector('#sheet .titleblock'); if(!tb) return;
      el=document.createElement('div'); el.id='geomSrcLine';
      el.style.cssText='margin:6px 0 0;padding:4px 8px;border:1px solid #c7d1db;border-left:4px solid #1c4fc4;font:12px/1.5 system-ui,sans-serif;color:#16212e';
      tb.parentNode.insertBefore(el,tb.nextSibling); }
    el.style.display='';
    var LBL={spans:'spans',spacings:'girder spacing',skew:'skew',OL:'left overhang',OR:'right overhang',ts:'slab thickness',depth:'beam depth'};
    var fl=(Array.isArray(gs.fields)&&gs.fields.length)?gs.fields.map(function(k){ return LBL[k]||k; }).join(', '):'layout';
    el.innerHTML='<b>Layout geometry source:</b> '+escH(fl)
      +' prefilled from <b>'+escH(gs.producer)+'</b>, '+escH(fmtWhen(gs.producedAt))
      +(gs.project?' · project '+escH(gs.project):'')
      +' <span style="color:#46586b">(inputs may have been edited since)</span>';
  }
  /* One line naming what moved, for the change log and the toast. Compares the
     incoming layout against what is on screen right now, not against the last
  ```

HUNK 5 (≈ line 3326 of the old file)
- **Before:**
  ```js
    var spans=(g.inputs&&g.inputs.spans)||[];
    var txt=document.createElement('div'); txt.style.flex='1 1 320px';
    txt.innerHTML='<b>Geometry received from '+(g.producer||'a design app')+'</b>'
      +(g.project?' · '+g.project:'')+(g.memberLabel?' · '+g.memberLabel:'')
      +'<br><span style="font-size:12px;color:#46586b">'
      +(spans.length?spans.length+' span(s): '+spans.join(' / ')+' ft':'')
      +(g.inputs&&g.inputs.spacings?' · S = '+g.inputs.spacings[0]+' ft × '+((+g.Nb||g.inputs.spacings.length+1))+' beams':'')
      +(g.position?' · '+g.position+' girder':'')
      +' — prefill this calculator? Your current inputs will be overwritten.</span>';
    var yes=document.createElement('button'); yes.className='btn'; yes.textContent='Prefill from '+(g.producer||'design app');
    yes.style.cssText='background:#1c4fc4;color:#fff;border:1.5px solid #1c4fc4;padding:5px 12px;cursor:pointer;font-weight:600';
  ```
- **After:**
  ```js
    var spans=(g.inputs&&g.inputs.spans)||[];
    var txt=document.createElement('div'); txt.style.flex='1 1 320px';
    var pn=projName(g);
    txt.innerHTML='<b>Geometry received from '+escH(g.producer||'a design app')+'</b>'
      +' · '+escH(fmtWhen(g.producedAt))
      +(pn?' · '+escH(pn):'')+(g.memberLabel?' · '+escH(g.memberLabel):'')
      +'<br><span style="font-size:12px;color:#46586b">'
      +(spans.length?spans.length+' span(s): '+spans.join(' / ')+' ft':'')
      +(g.inputs&&g.inputs.spacings?' · S = '+g.inputs.spacings[0]+' ft × '+((+g.Nb||g.inputs.spacings.length+1))+' beams':'')
      +(g.position?' · '+g.position+' girder':'')
      +' — prefill this calculator? Your current inputs will be overwritten.</span>'
      // What exactly gets overwritten, and the producer's caveats (HANDOFF.md §2 notes, §3.1).
      +'<div style="font-size:12px;margin-top:4px"><b>Will overwrite:</b><ul style="margin:2px 0 0 18px;padding:0">'
      +geomOverwriteList(g).map(function(t){ return '<li>'+escH(t)+'</li>'; }).join('')+'</ul></div>'
      +((Array.isArray(g.notes)&&g.notes.length)?'<div style="font-size:12px;margin-top:4px"><b>Notes from '+escH(g.producer||'the sender')+':</b><ul style="margin:2px 0 0 18px;padding:0">'
        +g.notes.map(function(t){ return '<li>'+escH(t)+'</li>'; }).join('')+'</ul></div>':'');
    var yes=document.createElement('button'); yes.className='btn'; yes.textContent='Prefill from '+(g.producer||'design app');
    yes.style.cssText='background:#1c4fc4;color:#fff;border:1.5px solid #1c4fc4;padding:5px 12px;cursor:pointer;font-weight:600';
  ```

HUNK 6 (≈ line 3338 of the old file)
- **Before:**
  ```js
    no.style.cssText='background:#fff;border:1.5px solid #c7d1db;padding:5px 12px;cursor:pointer;color:#46586b';
    yes.onclick=function(){ applyGeom(g,token); };
    no.onclick=function(){ try{localStorage.setItem(K_GEOM_SEEN,token);}catch(e){} hideBanner(); };
    bannerEl.appendChild(txt); bannerEl.appendChild(yes);
    // Locking from the banner does both halves at once: MCT starts republishing
    // on every layout change, and this app stops asking.
    if(window.BridgeLocks&&BridgeLocks.ok()){
      var lk=document.createElement('button'); lk.className='btn'; lk.textContent='\ud83d\udd13 Lock';
      lk.title='Follow this model\u2019s layout automatically. Spans, girder count, spacing and skew will update here whenever they change in MCT, without asking again.';
  ```
- **After:**
  ```js
    no.style.cssText='background:#fff;border:1.5px solid #c7d1db;padding:5px 12px;cursor:pointer;color:#46586b';
    yes.onclick=function(){ applyGeom(g,token); };
    no.onclick=function(){ try{localStorage.setItem(K_GEOM_SEEN,token);}catch(e){} hideBanner(); paintGeomPull(); };
    bannerEl.appendChild(txt); bannerEl.appendChild(yes);
    // Locking from the banner does both halves at once: MCT starts republishing
    // on every layout change, and this app stops asking.
    // Bridge Geometry hand-offs are never auto-followed (HANDOFF.md §3.5), so no Lock for them.
    if(window.BridgeLocks&&BridgeLocks.ok()&&!isBG(g)){
      var lk=document.createElement('button'); lk.className='btn'; lk.textContent='\ud83d\udd13 Lock';
      lk.title='Follow this model\u2019s layout automatically. Spans, girder count, spacing and skew will update here whenever they change in MCT, without asking again.';
  ```

HUNK 7 (≈ line 3360 of the old file)
- **Before:**
  ```js
  function applyGeom(g,token,silent){
    try{
      var what=silent?geomDelta(g):'';
      var inp=Object.assign({},g.inputs||{});
  ```
- **After:**
  ```js
  function applyGeom(g,token,silent){
    try{
      var bad=validateGeom(g);
      if(bad.length){
        if(!silent) alert('Geometry from '+(g&&g.producer||'the sender')+' was refused — nothing was changed:\n\n• '+bad.join('\n• '));
        else flash('⚠ Geometry from '+(g&&g.producer||'the sender')+' refused: '+bad[0],true);
        return false; }
      var what=silent?geomDelta(g):'';
      var inp=Object.assign({},g.inputs||{});
  ```

HUNK 8 (≈ line 3372 of the old file)
- **Before:**
  ```js
      // A design app sends d_e (exterior web → rail face); LLDF works with overhang OL and rail rL.
      if(inp.OL==null&&g.de!=null){ var rL=+($('rL')&&$('rL').value)||0; inp.OL=+((+g.de)+rL).toFixed(2); }
      applyState({inputs:inp});
      if(g.project&&$('mProject')&&!$('mProject').value) $('mProject').value=g.project;
      try{localStorage.setItem(K_GEOM_SEEN,token);}catch(e){}
      hideBanner();
      if(silent){
  ```
- **After:**
  ```js
      // A design app sends d_e (exterior web → rail face); LLDF works with overhang OL and rail rL.
      if(inp.OL==null&&g.de!=null){ var rL=+($('rL')&&$('rL').value)||0; inp.OL=+((+g.de)+rL).toFixed(2); }
      if(isBG(g)){
        // Bridge Geometry: overwrite ONLY the layout fields it sent. Start from the full current
        // state so section, appurtenance, beam-class and figure inputs are left exactly as they are.
        var full=serialize(false); full.inputs=Object.assign(full.inputs||{},inp);
        applyState(full);
      } else {
        applyState({inputs:inp});
      }
      var pn=projName(g);
      if(pn&&$('mProject')&&!$('mProject').value) $('mProject').value=pn;
      try{localStorage.setItem(K_GEOM_SEEN,token);}catch(e){}
      // Record the source in the saved state (new optional field) and mark it adopted.
      state.geomSource={producer:String(g.producer||''),producerFile:String(g.producerFile||''),
        producedAt:String(g.producedAt||''),project:pn,
        fields:['spans','spacings','skew','OL','OR','ts','depth'].filter(function(k){ return inp[k]!=null; })};
      if(window.BridgeXfer) BridgeXfer.markAdopted('lldfGeom','lldf',g.producedAt||'');
      renderGeomSource(); paintGeomPull();
      if(typeof scheduleAutosave==='function') scheduleAutosave();
      hideBanner();
      if(silent){
  ```

HUNK 9 (≈ line 3507 of the old file)
- **Before:**
  ```js
    var seen=null; try{seen=localStorage.getItem(K_GEOM_SEEN);}catch(e){}
    if(seen===token) return;
    // Locked = standing consent. Adopt straight away and never raise the banner.
    // The version guard above still gets the last word: a payload this build
    // cannot read is reported, not silently swallowed.
    if(window.BridgeLocks&&BridgeLocks.ok()&&BridgeLocks.isLocked('geometry')){
      if(applyGeom(g,token,true)) return;
    }
  ```
- **After:**
  ```js
    var seen=null; try{seen=localStorage.getItem(K_GEOM_SEEN);}catch(e){}
    if(seen===token) return;
    var bad=validateGeom(g);
    if(bad.length){ flash('⚠ Geometry from '+(g.producer||'a design app')+' refused: '+bad[0],true); return; }
    // Locked = standing consent. Adopt straight away and never raise the banner.
    // The version guard above still gets the last word: a payload this build
    // cannot read is reported, not silently swallowed.
    // Bridge Geometry is never auto-applied, even when locked: it always asks (HANDOFF.md §3.5).
    if(!isBG(g)&&window.BridgeLocks&&BridgeLocks.ok()&&BridgeLocks.isLocked('geometry')){
      if(applyGeom(g,token,true)) return;
    }
  ```

HUNK 10 (≈ line 3516 of the old file)
- **Before:**
  ```js
  }

  /* ---------- wire up ---------- */
  // Navigate between suite apps: post to the parent MCT when embedded (stay in one window), else open/return.
  ```
- **After:**
  ```js
  }

  /* ---------- IN: explicit "Pull from <producer>" and "Import hand-off (JSON)" (HANDOFF.md §1, §3.1) ----------
     Both only RAISE the prefill banner above; nothing is applied until "Prefill" is clicked there. */
  function _geomNewFlag(g){
    if(!g) return false;
    var at=null, seen=null; try{ at=localStorage.getItem(K_GEOM+'.updatedAt'); seen=localStorage.getItem(K_GEOM_SEEN); }catch(e){}
    // Senders that use BridgeXfer stamp .updatedAt; the older senders (MCT / PS-Beam / ST-Girder) do not,
    // so fall back to the banner's own "seen" token when .updatedAt does not belong to this payload.
    if(window.BridgeXfer&&at&&at===g.producedAt) return BridgeXfer.isNew('lldfGeom','lldf');
    return seen!==geomToken(g);
  }
  function paintGeomPull(){
    var b=$('bxGeomPull'); if(!b) return;
    var g=_geomAvail();
    b.textContent=(g?'Pull from '+(g.producer||'design app'):'Pull geometry')+(_geomNewFlag(g)?' ●':'');
    b.title=g?('Geometry sent by '+(g.producer||'a design app')+' at '+fmtWhen(g.producedAt)+(_geomNewFlag(g)?' — new data available, not yet adopted here':' — already adopted or dismissed')+'. Click to review it before applying.')
             :'Nothing has been sent on the geometry channel yet. Use "Send to LL & DL" in Bridge Geometry (or a design app).';
    b.style.fontWeight=_geomNewFlag(g)?'700':'';
  }
  function pullGeom(){
    if(!window.BridgeXfer){ alert('Hand-off helper is not available in this browser.'); return; }
    var r=BridgeXfer.read('lldfGeom','bridge-lldf-geometry',GEOM_SUPPORTED_VERSION);
    if(r.error){ alert('Cannot pull geometry: '+r.error); return; }
    var bad=validateGeom(r.payload);
    if(bad.length){ alert('Geometry from '+(r.payload.producer||'the sender')+' was refused — nothing was changed:\n\n• '+bad.join('\n• ')); return; }
    showBanner(r.payload,geomToken(r.payload));
    if(bannerEl&&bannerEl.scrollIntoView) try{ bannerEl.scrollIntoView({block:'nearest'}); }catch(e){}
  }
  function importGeomFile(file){
    if(!file||!window.BridgeXfer) return;
    BridgeXfer.importFile(file,'bridge-lldf-geometry',GEOM_SUPPORTED_VERSION,function(r){
      if(r.error){ alert('Cannot import this hand-off: '+r.error); return; }
      var bad=validateGeom(r.payload);
      if(bad.length){ alert('Geometry in this file was refused — nothing was changed:\n\n• '+bad.join('\n• ')); return; }
      showBanner(r.payload,geomToken(r.payload));
    });
  }

  /* ---------- wire up ---------- */
  // Navigate between suite apps: post to the parent MCT when embedded (stay in one window), else open/return.
  ```

HUNK 11 (≈ line 3605 of the old file)
- **Before:**
  ```js
    }
    autoPublish();
    checkGeom();
    window.addEventListener('storage',function(e){ if(!e.key||e.key===K_GEOM) checkGeom(); });
    // Locking from any app has to pull the pending layout in immediately rather
    // than waiting for MCT's next publish.
  ```
- **After:**
  ```js
    }
    autoPublish();
    var gp=$('bxGeomPull'); if(gp) gp.addEventListener('click',pullGeom);
    var gi=$('bxGeomImport'), gf=$('bxGeomFile');
    if(gi&&gf){ gi.addEventListener('click',function(){ gf.value=''; gf.click(); });
      gf.addEventListener('change',function(){ importGeomFile(gf.files&&gf.files[0]); }); }
    // Show the recorded source after any recalculation (project load, import, prefill).
    if(typeof window.run==='function'){ var _run2=window.run;
      window.run=function(){ var r=_run2.apply(this,arguments); try{ renderGeomSource(); }catch(e){} return r; }; }
    renderGeomSource(); paintGeomPull();
    checkGeom();
    window.addEventListener('storage',function(e){ if(!e.key||e.key===K_GEOM) checkGeom(); });
    window.addEventListener('storage',function(e){ if(!e.key||e.key.indexOf(K_GEOM)===0) paintGeomPull(); });
    // Locking from any app has to pull the pending layout in immediately rather
    // than waiting for MCT's next publish.
  ```

- **Check case (Bridge Geometry Example 2, "3-Span Skewed Overpass"):** stations 11+00 / 12+50 / 14+00 / 15+50 on a tangent, skew 25° at all supports, girders −22.5 … +22.5 at 9 ft, deck edges ±26 ft. Sent: spans 150 / 150 / 150 ft, θ = 25°, spacings 9 × 5, N_b = 6, O_L = O_R = −22.5 − (−26) = 3.5 ft. After "Prefill", lldf (type k defaults) gives the interior g_M = 0.6438 and g_V = 0.959, and the exterior g_M = 0.800 and g_V = 0.868. Before (lldf defaults: L = 120, 5 @ 9.75, θ = 0) the values were interior 0.7234 / 0.9349 and exterior 0.8923 / 0.8923. The change is only in the inputs; the method is unchanged.
- **How verified:** `node --check` on every inline script. jsdom end-to-end test with one shared localStorage stub: Bridge Geometry's real send dialog → lldf's real banner → Prefill. The inputs equal the payload, every other serialized input is unchanged, `geomSource` is saved, adopted is marked, the dot clears and the source line is in `#sheet`. The JSON export → import path was also tested. Wrong `_schema`, `schemaVersion` 2/3, corrupt JSON, a negative span, a non-numeric skew and `units.spans:"m"` are all refused (file and storage paths) with the inputs unchanged. An old-style MCT payload (string project, no units) still prefills as before, and the lock still auto-applies it, while a Bridge Geometry payload under lock only raises the banner. **No-hand-off regression:** the original and new lldf.html, run with an empty store, give identical `computeBridge` members/geo/Kg and identical `serialize(true)` for 4 input sets.
- **Other copies:** BridgeXfer v1 (unchanged here) is in index.html, lldf.html, psbeam.html, stgirder.html, Moving Load Generator.html, Bridge Geometry.html.
- **Open items:**
  - O-H1. The existing prefill for MCT / PS-Beam / ST-Girder calls `applyState({inputs})`, which also clears reference figures, beam-class overrides, load overrides and user loads (the MassDOT module's `applyState` wrapper resets them when absent). Not changed for those producers; the Bridge Geometry path avoids it. Fix for all producers?
  - O-H2. Validation now refuses a negative skew or a non-positive t_s / depth from MCT / PS-Beam / ST-Girder too (they previously applied). Confirm this is wanted.

## 2026-10-04 — PR: claude/fix-lldf-prefill-dataloss (PR link added after merge)

### B1. Geometry prefill wiped figures, beam-class overrides, load overrides and user loads   [bug fix] [no result change for the geometry itself]
- **Where:** Bridge Suite integration IIFE, function `applyGeom(g,token,silent)` (≈ line 3475). Anchor text: `var full=serialize(false); full.inputs=Object.assign(full.inputs||{},inp);`
- **Problem:**
  - Prefilling from an MCT Generator, PS-Beam or ST-Girder `bridgeSuite.v1.lldfGeom` payload called `applyState({inputs:inp})` with only the layout fields. This happened both when the banner's "Prefill" was clicked and when a locked auto-follow applied the payload.
  - The base `applyState` resets the §3.9 reference images when `obj.figures` is absent. The MassDOT load-distribution module's `applyState` wrapper resets `state.beamClass`, `state.loadOverrides` and `state.userLoads` to empty when they are absent.
  - So each prefill silently discarded:
    - the engineer's reference figures;
    - beam-classification overrides;
    - edited auto-load positions/weights;
    - added user loads.

    Autosave then persisted the loss.
  - The Bridge Geometry path, added in claude/conn-geometry-lldf, already applied the payload on top of the full current state. This fix uses that same path for every producer.
  - The dead-load distribution could change after a prefill, because overrides and user loads were dropped. With the fix, only the geometry fields the payload carries change, which is what the banner promises.
- **Governing provision:** n/a. No formula, factor, default, unit or code reference changed.
- **Before:**
  ```js
      if(isBG(g)){
        // Bridge Geometry: overwrite ONLY the layout fields it sent. Start from the full current
        // state so section, appurtenance, beam-class and figure inputs are left exactly as they are.
        var full=serialize(false); full.inputs=Object.assign(full.inputs||{},inp);
        applyState(full);
      } else {
        applyState({inputs:inp});
      }
  ```
- **After:**
  ```js
      // Overwrite ONLY the layout fields the payload carries (every producer). Start from the full
      // current state so section, appurtenance, beam-class, load-override, user-load and figure
      // inputs are left exactly as they are -- applyState({inputs:inp}) alone used to reset those.
      var full=serialize(false); full.inputs=Object.assign(full.inputs||{},inp);
      applyState(full);
  ```
  (On a tree without the Bridge Geometry connection, the Before is the single line `applyState({inputs:inp});`; replace it with the two lines `var full=…; applyState(full);`.)
- **Check case:** lldf defaults, plus one reference image, beam-class override {1:"interior"}, load override {railL:{plf:0.5}}, one user load (DC2, x = 10 ft, 0.1 klf), Structure No. "B-77", I = 123,456 in⁴.
  - **MCT payload** (spans 80/100, 6 beams @ 8, θ 20):
    - Before the fix, the image, beam class, load override and user load were all lost.
    - After the fix, all four are kept. Spans 80/100, spacings 8 ×5 and θ 20 are applied as before, and nothing else changes (I, type and title block are kept; a blank Project is filled from the payload as before).
  - **PS-Beam payload** (span 110, 5 @ 9, t_s 8.5, d 63, θ 10, d_e 2.25): same result.
    - t_s and d are applied.
    - O_L = 2.25 ft, the same as before the fix (see open item O-B1).
- **How verified:**
  - `node --check` on all inline scripts.
  - jsdom test `dataloss.js` (scratch): 10 failures on the pre-fix file, all pass after.
  - The connection tests (e2e, legacy/lock, BG → lldf → Moving Load chain) still pass.
  - No-hand-off regression: identical `computeBridge` results and `serialize(true)` against origin/main for 4 input sets.
- **Other copies:** none (lldf-only code).
- **Open items:**
  - O-B1. `applyGeom` converts a sender's d_e to an overhang with `rL=+($('rL')&&$('rL').value)||0`, but lldf has no `#rL` element. So O_L = d_e, not d_e + the rail face offset (`faceL`/`railOffL`). This affects PS-Beam / ST-Girder prefills that send d_e. Not changed (it changes an input value) — fix to use `faceOffset("L")`?


## 2026-10-05 — PR: claude/fix-lldf-de-railface

### F-rail. d_e from PS-Beam / ST-Girder now includes the rail-face offset   [calc input change] [more conservative]
- **Where:** `applyGeom` in the Bridge Suite integration block (≈ line 3474). Anchor text: `if(inp.OL==null&&g.de!=null)`
- **Problem:** a design app sends d_e (exterior web → barrier face). LLDF stores the overhang OL and computes d_e = OL − rL, where rL = `faceOffset("L")` (the barrier-face offset from the deck edge). The conversion read rL from a `#rL` element that does not exist, so rL was always 0 and OL = d_e. LLDF therefore used d_e − rL, which is too small by the rail-face offset. The engineer approved the fix on 2026-10-05.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 4.6.2.2.1 (d_e definition) and Table 4.6.2.2.2d-1 (e = 0.77 + d_e/9.1).
- **Before:**
  ```js
  if(inp.OL==null&&g.de!=null){ var rL=+($('rL')&&$('rL').value)||0; inp.OL=+((+g.de)+rL).toFixed(2); }
  ```
- **After:**
  ```js
  if(inp.OL==null&&g.de!=null){ var rL=+faceOffset("L")||0; inp.OL=+((+g.de)+rL).toFixed(2); }
  ```
- **Check case:** PS-Beam payload with d_e = 2.25 ft, 5 girders @ 9 ft, L = 110 ft, t_s 8.5 in, skew 10°, depth 63 in. LLDF default rail face = 1.50 ft.
  - Before: OL = 2.25, d_e(LLDF) = 0.75. e_M = 0.77 + 0.75/9.1 = 0.852. Exterior gM = 0.744 (rigid governs), gV = 0.767, fatM = 0.528.
  - After: OL = 3.75, d_e(LLDF) = 2.25, matching the sent value. e_M = 0.77 + 2.25/9.1 = 1.017. Exterior gM = 0.833 (one-lane lever rule governs), gV = 0.859, fatM = 0.694.
- **How verified:** jsdom, with lldf's real prefill button on main vs the fixed file (`railface.js`, `railface2.js`). The earlier data-loss test still passes, except its old-mapping assertion for OL, which now correctly reads 3.75.
- **Other copies of this code:** none. The open item recorded in #36 is now resolved.

## 2026-10-12 — PR: claude/sweep-lldf (PR link added after merge)

Open-item sweep (inventory section 2). Engineer's instruction 2026-10-12: work through the open items using best judgement, and list what needs the engineer. Basis: AASHTO LRFD **10th Ed. (2024)**.

Changes:
- d_e upper-bound clamp removed (LLDF-O1, **calc**).
- n from f′c for concrete girders (LLDF-O5, **calc**).
- Separate moment / shear skew, and use of Bridge Geometry's `skewDetail` (follow-up to BG-OH2, **calc**).
- Signed skew accepted as |θ| (LLDF-OH2, **calc** for a negative entry).
- N_b = 3 lever rule over every truck count (LLDF-O8, **calc**, no change found).
- `perFootStrip` flag (LLDF-O4, sender half).
- Edition basis line (LLDF-O9).

The shared `bridgeSuite.v1.*` bootstrap blocks, BridgeXfer, BridgeLocks and BridgeProjects are **not** touched. Saved data: three new optional input fields (`skewV`, `fcGirder`, `fcDeck`). Older saves load with them blank and give the same results, except where O1, O8 or OH2 apply (see each check case).

### SW1. LLDF-O1: d_e no longer clamped at the upper bound of its range   [calc change] [MORE conservative]
- **Where:**
  - `memberDF(p,geo,Kg,skew,j)`, exterior branches of the box (f/g), spread box (b/c) and multicell (d) types. Anchors: `de=Math.min(de0,2.0)`, `de=Math.max(Math.min(de0,4.5),0)`, `de=Math.max(Math.min(de0,5.0),-2.0)`.
  - `bridgeWarnings`, d_e range block. Anchor: `else if(BOX.has(p.type)){ hi=2.0;`.
  - `memberSteps`, box d_e step. Anchor: `d_e=\\min\\!\\left(O-f,\\ 2.0\\right)`.
- **Problem:**
  - Above the range of applicability (adjacent box ≤ 2.0 ft, spread box ≤ 4.5 ft, multicell ≤ 5.0 ft), d_e was limited to the bound. That lowers e and the exterior DF, which is unconservative.
  - A warning existed (F2), but the lower value was still used.
  - The lower-bound clamps (spread box 0, multicell −2.0, beam-slab −1.0) raise e and are kept.
- **Default picked:** use the actual d_e (extrapolate) and keep the out-of-range warning. It now reads: "The e-factor equations are extrapolated with the actual d_e (not limited to X ft, which would lower e); check the exterior girder by another method." There is no option: neither choice is "in range", and the clamp is the unconservative one.
- **Governing provision:** AASHTO LRFD 10th Ed., with the ranges of applicability given in the same tables:
  - Table 4.6.2.2.2d-1 (e for moment): box f/g 1.125 + d_e/30 and 1.04 + d_e/25; spread box 0.97 + d_e/28.5.
  - Table 4.6.2.2.3b-1 (e for shear): box 1.25 + d_e/20 and 1 + ((d_e + b/12 − 2.0)/40)^0.5; spread box 0.8 + d_e/10; multicell 0.64 + d_e/12.5.
- **Before:**
  ```js
    const side=(j===0)?"L":"R", de0=(side==="L")?geo.deL:geo.deR, de=Math.min(de0,2.0);
  ...
    const side=(j===0)?"L":"R", de0=(side==="L")?geo.deL:geo.deR, de=Math.max(Math.min(de0,4.5),0);
  ...
    const side=(j===0)?"L":"R", de0=(side==="L")?geo.deL:geo.deR, de=Math.max(Math.min(de0,5.0),-2.0);
  ```
  ```js
    else if(BOX.has(p.type)){ hi=2.0; clampHi=true; }
    else if(p.type==="bc"){ lo=0.0; hi=4.5; clampLo=clampHi=true; }
    else if(p.type==="d"){ lo=-2.0; hi=5.0; clampLo=clampHi=true; }
  ```
- **After:**
  ```js
    // d_e above the 2.0 ft range limit is NOT clamped (the clamp lowered e: unconservative); the
    // e-equations are extrapolated and bridgeWarnings says so.
    const side=(j===0)?"L":"R", de0=(side==="L")?geo.deL:geo.deR, de=de0;
  ...
    // lower limit 0 kept (raises e); no upper clamp at 4.5 ft (extrapolated; the clamp lowered e)
    const side=(j===0)?"L":"R", de0=(side==="L")?geo.deL:geo.deR, de=Math.max(de0,0);
  ...
    // lower limit −2.0 kept (raises e); no upper clamp at 5.0 ft (extrapolated; the clamp lowered e)
    const side=(j===0)?"L":"R", de0=(side==="L")?geo.deL:geo.deR, de=Math.max(de0,-2.0);
  ```
  ```js
    else if(BOX.has(p.type)){ hi=2.0; }
    else if(p.type==="bc"){ lo=0.0; hi=4.5; clampLo=true; }
    else if(p.type==="d"){ lo=-2.0; hi=5.0; clampLo=true; }
  ```
  - The extrapolation message replaces `The e-factor equations are extrapolated beyond their range; check the exterior girder by another method.` The `clampHi` branch is now unused.
  - The box d_e calculation step changes from `d_e=min(O−f, 2.0)` ("d_e limited to 2.0 ft for box beams") to `d_e=O−f`, with the note: "Range of applicability d_e ≤ 2.0 ft; a larger d_e is used as is (the e-equations are extrapolated, which gives a larger e than limiting d_e to 2.0 ft)."
- **Check case 1 (type f, adjacent boxes):**
  - Inputs: L = 120 ft, b = 48 in, I = 110,499 in⁴, J = 200,000 in⁴, N_b = 8 @ 4 ft, O_L = 4.0 ft, rail face 1.5 ft (curb 18 in), so d_e = 2.50 ft; θ = 20°.
  - Common values: k = 2.5(8)^−0.2 = 1.6494. Interior g: M1 = 0.15585, M2 = 0.26583, V1 = 0.40769, V2 = 0.43117. f_θ,M = 1.05 − 0.25 tan 20° = 0.95901. f_θ,V = 1 + (12×120/(90×33))√tan 20° = 1.29251.
  - Before (d_e = 2.0):
    - e_M1 = 1.125 + 2.0/30 = 1.19167; e_M2 = 1.04 + 2.0/25 = 1.12000.
    - g_M = max(1.19167×0.15585, 1.12×0.26583) × 0.95901 = 0.29773 × 0.95901 = **0.2855**.
    - e_V1 = 1.35; e_V2 = 1 + √((2.0 + 4 − 2)/40) = 1.31623.
    - g_V = max(1.35×0.40769, 1.31623×0.43117) × 1.29251 = 0.56751 × 1.29251 = **0.7335**.
  - After (d_e = 2.5):
    - e_M2 = 1.14000, so g_M = 1.14 × 0.26583 × 0.95901 = **0.2906**.
    - e_V2 = 1 + √(4.5/40) = 1.33541, so g_V = 1.33541 × 0.43117 × 1.29251 = **0.7442**.
    - Fatigue: M 0.1484 → 0.1505; V 0.5928 → 0.6038.
- **Check case 2 (type b/c, spread box):**
  - Inputs: L = 100 ft, d = 48 in, S = 11 ft (4 beams), O_L = 7 ft, rail face 1.5 ft, so d_e = 5.50 ft. g_int,V2+ = (11/7.4)^0.8 (48/1200)^0.1 = 0.99526.
  - Before (d_e = 4.5): e_V = 0.80 + 4.5/10 = 1.25, giving 1.24407. That is below the one-lane lever rule 1.2545, so g_V = **1.2545**.
  - After (d_e = 5.5): e_V = 1.35, so g_V = 1.35 × 0.99526 = **1.3436**.
  - Moment is unchanged: e_M·g = 0.8246, below the lever rule 1.2545.
- **Check case 3 (type d, multicell):**
  - Inputs: L = 100 ft, d = 60 in, S = 12 ft, O_L = 7 ft, so d_e = 5.50 ft. g_int,V2+ = (12/7.3)^0.9 (60/1200)^0.1 = 1.15923.
  - Before: e_V = 0.64 + 5.0/12.5 = 1.04, giving 1.2056 (below the lever rule 1.25), so g_V = **1.25**.
  - After: e_V = 1.08, so g_V = **1.2520**.
- **d_e inside the range:** no change. Checked for types b/c, d, f and g.

### SW2. LLDF-O5: modular ratio n from the girder and deck f′c for concrete girders   [calc change] [MORE conservative]
- **Where:**
  - HTML `#sectRow`: the n row, and a new row `#fcGirder` / `#fcDeck`.
  - New helpers `fcInput` and `nFromFc` (before `readInputs`).
  - `readInputs`, `applySection`, `serialize`, `applyState`.
  - A new `input` listener after the `stdSection` listener.
  - `bridgeWarnings`, and the `memberSteps` K_g step (n shown with 2 decimals).
  - Anchors: `id="n" value=`, `function nFromFc(`, `const nc=nFromFc(fcInput("fcGirder"),fcInput("fcDeck"));`, `["fcGirder","fcDeck"].forEach(id=>$(id).addEventListener`, `Modular ratio n = `.
- **Problem:** picking a concrete library section set n = 1, and the fresh page had n = 1 for an AASHTO Type IV. AASHTO n = E_B/E_D. With a girder f′c above the deck f′c, n ≈ 1.1–1.3, which raises K_g and the moment DFs.
- **Default picked:**
  - Two new inputs, "Girder / deck f′c", with fresh-page values 8.0 / 4.0 ksi.
  - For a concrete girder (beam shape not "Steel I-beam"), a library pick or an f′c edit sets n = E_c,girder / E_c,deck, rounded to 0.01. n stays editable.
  - A design-app section lock (geometry or psSection) still wins: f′c edits do not change n then.
  - Steel picks keep n = 8 (unchanged).
  - If an f′c is blank, a library pick sets n = 1 as before, and an info note asks for f′c.
  - If both f′c are given and n differs from the computed value by more than 0.006, a warning says so (not while locked).
- **Governing provision:** AASHTO LRFD 10th Ed.:
  - Eq. 4.6.2.2.1-1 (K_g = n(I + A e_g²)) and Eq. 4.6.2.2.1-2 (n = E_B/E_D).
  - Eq. 5.4.2.4-1, E_c = 120,000 K₁ w_c^2.0 f′c^0.33. K₁ = 1, and it cancels in the ratio.
  - w_c for normal-weight concrete per Table 3.5.1-1: 0.145 kcf for f′c ≤ 5.0 ksi; 0.140 + 0.001 f′c for 5.0 < f′c ≤ 15.0 ksi (**verify** the table values against the printed 10th Ed.).
- **Before:**
  ```html
              <div class="frow"><label>Modular ratio <span class="sym">n</span></label><div class="fval"><input type="number" id="n" value="1" step="0.1"/><span class="u"></span></div></div>
  ```
  ```js
    else { $("I").value=s.I; $("A").value=s.A; if(s.yb!=null) $("eg").value=((s.d-s.yb)+ts/2).toFixed(2); $("n").value=1; }
  ```
- **After:**
  ```html
              <div class="frow"><label>Modular ratio <span class="sym">n</span></label><div class="fval"><input type="number" id="n" value="1.31" step="0.1" title="n = E_B / E_D (Eq. 4.6.2.2.1-2). For a concrete girder it is computed from the girder and deck f&prime;c below (Eq. 5.4.2.4-1); you can still type a value."/><span class="u"></span></div></div>
              <div class="frow"><label>Girder / deck <span class="sym">f&prime;<sub>c</sub></span> <span style="font-size:10.5px;color:var(--muted)">concrete girder: sets n</span></label><div class="fval"><input type="number" id="fcGirder" value="8.0" step="0.5" style="width:72px" title="(see file)"/><span class="u">ksi</span><input type="number" id="fcDeck" value="4.0" step="0.5" style="width:72px" title="Deck concrete f&prime;c."/><span class="u">ksi</span></div></div>
  ```
  ```js
  function fcInput(id){ const e=$(id); if(!e||e.value==="") return null; const v=+e.value; return (isFinite(v)&&v>0)?v:null; }
  function nFromFc(fcB,fcD){
    if(!(fcB>0&&fcD>0)) return null;
    const wc=f=>f<=5.0?0.145:0.140+0.001*f, Ec=f=>120000*Math.pow(wc(f),2)*Math.pow(f,0.33);
    return Math.round(Ec(fcB)/Ec(fcD)*100)/100;
  }
  ```
  ```js
    else { $("I").value=s.I; $("A").value=s.A; if(s.yb!=null) $("eg").value=((s.d-s.yb)+ts/2).toFixed(2);
      // n = E_girder/E_deck from the two f'c (was hard-set to 1, which understates K_g); 1 if f'c is blank.
      const nc=nFromFc(fcInput("fcGirder"),fcInput("fcDeck")); $("n").value=(nc!=null?nc:1); }
  ```
  - `readInputs` adds `fcGirder:fcInput("fcGirder"),fcDeck:fcInput("fcDeck")`.
  - `serialize` adds `inputs.fcGirder` / `inputs.fcDeck` only when they are not blank. `applyState` sets them blank when absent.
  - The K_g step and its "where" row show n with `f2` (was `f1`, which printed 1.31 as "1.3").
- **Check case (fresh page):**
  - Inputs: type k, AASHTO Type IV (I = 260,730 in⁴, A = 789 in², e_g = 35.5 in), L = 120 ft, t_s = 8 in, S = 9.75 ft, 5 beams.
  - E_c,girder = 120,000 × 0.148² × 8^0.33 = 5,220.6 ksi. E_c,deck = 120,000 × 0.145² × 4^0.33 = 3,986.5 ksi. n = 1.3096, rounded to **1.31**.
  - Before (n = 1):
    - K_g = 260,730 + 789 × 35.5² = **1,255,067 in⁴**.
    - (K_g/12Lt_s³)^0.1 = (1,255,067/737,280)^0.1 = 1.05464.
    - g_M,2+ = 0.075 + (9.75/9.5)^0.6 (9.75/120)^0.2 × 1.05464 = 0.075 + 1.015702 × 0.605309 × 1.05464 = **0.7234**.
    - Fatigue M = g_M,1/1.2 = 0.48974/1.2 = **0.4081**.
  - After (n = 1.31):
    - K_g = **1,644,138 in⁴**; the stiffness term = 1.08350.
    - g_M,2+ = **0.7411**; fatigue M = 0.50150/1.2 = **0.4179**.
  - Only the interior girders B2–B4 change. The exterior girders (lever rule 0.892) and all shear DFs (no K_g term without skew) are unchanged.
  - Library pick AASHTO IV with f′c 8/4: n 1 → 1.31. Other f′c pairs: 6/4 gives n = 1.16; 6/5 gives 1.08; 10/5 gives 1.35.
- **Saved data:** older saves and autosaves load with both f′c blank and **their own n**, so their results do not change. An info note then asks for f′c when n ≤ 1 on a concrete girder.

### SW3. Separate skew for shear θ_V; Bridge Geometry `skewDetail` used (follow-up to BG-OH2)   [calc change: new optional input] [MORE conservative for moment when used; shear uses the sender's largest |θ|]
- **Where:**
  - HTML: new row `#skewV` under "Skew angle θ".
  - Main script: `skewFactors`; `memberDF` (spread box `fV`, multicell `fVext`/`fVint`); `bridgeWarnings`; `inputErrors`; `memberSteps` (all shear skew steps); `readInputs` (`skewVInput`); `serialize`/`applyState`; `simpleIds`.
  - Integration block: new `geomSkews(g)`; `geomOverwriteList`, `geomDelta`, `applyGeom`, the `renderGeomSource` labels, `GEOM_DRIVEN_IDS`, `buildDFPayload`.
  - Anchors: `id="skewV"`, `function skewFactors(p,geo,Kg){`, `skew.tanV`, `Separate skews:`, `function geomSkews(g){`, `var gsk=geomSkews(g);`, `payload.skewShear`.
- **Problem:**
  - lldf takes one θ and uses it for both the moment reduction and the shear correction.
  - Bridge Geometry (fixlog "Bridge Geometry" 2026-10-12 W1) now sends the moment value by default. It sends both values in the optional top-level `skewDetail`: `moment` = smallest |θ| (0 if adjacent supports differ by more than 10°) and `shear` = largest |θ|. It asks for a second run for the other action.
- **After:**
  ```js
    const th=Math.abs(+p.skew||0), thV=(p.skewV!=null&&isFinite(p.skewV))?Math.abs(+p.skewV):th;
    if(th<=0&&thV<=0) return {active:false,scfM:1,scfV:1,c1:0,thU:0,th:0,thV:0,thVU:0,tanV:0,kind:"none"};
    const thU=Math.min(th,60), rad=thU*Math.PI/180, tan=Math.tan(rad);
    const thVU=Math.min(thV,60), tanV=Math.tan(thVU*Math.PI/180);
  ```
  - Every shear correction uses `tanV` instead of `tan`: box `Math.sqrt(Math.max(0,tanV))`, beam-slab `…*tanV`, spread box and multicell `skew.tanV`. The moment corrections are unchanged.
  - With θ_V blank, `thV = th`, and every result is identical to before.
  ```js
  function geomSkews(g){
    var i=(g&&g.inputs)||{}, sd=g&&g.skewDetail;
    var ok=function(v){ return typeof v==='number'&&isFinite(v)&&Math.abs(v)<90; };
    if(sd&&typeof sd==='object'&&ok(sd.moment)&&ok(sd.shear)){
      var m=+Math.abs(sd.moment).toFixed(3), v=+Math.abs(sd.shear).toFixed(3);
      return {skew:m, skewV:(Math.abs(v-m)>1e-9)?v:'', fromDetail:true};
    }
    if(i.skew!=null) return {skew:Math.abs(+i.skew), skewV:'', fromDetail:false};
    return null;
  }
  ```
  - `applyGeom`, after the d_e → O_L line: `delete inp.skewV; var gsk=geomSkews(g); if(gsk){ inp.skew=gsk.skew; inp.skewV=gsk.skewV; }`.
  - The banner lists "Skew θ (moment): a → b deg" and "Skew for shear θ_V: a → b deg / blank (= θ)".
- **Behaviour:**
  - A Bridge Geometry hand-off with a valid `skewDetail` sets θ = `skewDetail.moment` and θ_V = `skewDetail.shear` (blank when they are equal). This happens whichever single value the engineer chose to send in `inputs.skew`, so one run gives both.
  - A hand-off with a skew but no `skewDetail` (MCT, PS-Beam, ST-Girder, older Bridge Geometry) sets θ and clears θ_V. A stale θ_V can never survive a new layout.
  - An invalid `skewDetail` is ignored.
  - `skewDetail` is still not saved; only the resulting `skew`/`skewV` inputs are.
  - The DF hand-off adds `skewShear` (θ_V) only when θ_V is entered. `skew` stays the moment θ.
- **Governing provision:** AASHTO LRFD 10th Ed.:
  - Art. 4.6.2.2.2e and Table 4.6.2.2.2e-1: moment reduction, including the 10° adjacent-support rule (**verify** the wording against the printed 10th Ed.).
  - Art. 4.6.2.2.3c and Table 4.6.2.2.3c-1: shear correction at the obtuse corner.
- **Check case:**
  - Inputs: type k with n = 1, so the inputs match the old defaults: L = 120 ft, S = 9.75 ft, t_s = 8 in, K_g = 1,255,067 in⁴.
  - c₁ = 0.25 (1,255,067/737,280)^0.25 (9.75/120)^0.5 = 0.25 × 1.14225 × 0.28504 = 0.081398.
  - Shear factor at 40°: 1 + 0.20 × (737,280/1,255,067)^0.3 × tan 40° = 1 + 0.2 × 0.85251 × 0.83910 = 1.14307.
  - Single θ = 40° (before, the only option; the "shear" run):
    - f_θ,M = 1 − 0.081398 × 0.83910^1.5 = 0.93743.
    - Interior g_M = 0.72339 × 0.93743 = **0.6781**; g_V = 0.93487 × 1.14307 = **1.0686**.
  - θ = 30°, θ_V = 40° (after, from `skewDetail` moment 30 / shear 40):
    - f_θ,M = 1 − 0.081398 × 0.57735^1.5 = 0.96429.
    - Interior g_M = **0.6976**: +2.9 %, more conservative than the 40° moment. g_V = **1.0686**, the same as the 40° run.
    - Exterior g_M 0.8365 → 0.8604; g_V 1.020, unchanged.
  - Bridge Geometry demo (supports 0° / 15° / 0°): `skewDetail` moment 0, shear 15, so θ = 0 and θ_V = 15. No moment reduction; the shear factor is taken at 15°.

### SW4. LLDF-OH2: a signed (negative) skew is accepted and used as |θ|   [calc change for a negative entry] [shear MORE conservative; moment per the code]
- **Where:**
  - `validateGeom`. Anchor: `must be |θ| < 90 deg`.
  - `geomSkews` / `applyGeom` (SW3).
  - `readInputs`. Anchor: `skew:Math.abs(+$("skew").value)`.
  - `skewFactors` (`Math.abs`).
  - `serialize`. Anchor: `skew:+$("skew").value`.
- **Problem:**
  - A negative skew from MCT / PS-Beam / ST-Girder was refused by the hand-off validation added with the Bridge Geometry connection.
  - A negative skew typed by hand gave **no** skew correction at all (`th<=0` made the skew inactive), so the shear correction was silently lost.
  - The sign of θ does not enter Tables 4.6.2.2.2e-1 / 4.6.2.2.3c-1.
- **Before:**
  ```js
    if(i.skew!=null&&(!fin(i.skew)||i.skew<0||i.skew>=90)) e.push('skew = '+i.skew+' (must be 0 ≤ θ < 90 deg)');
  ```
  ```js
      ts:+$("ts").value,depth:+$("depth").value,skew:+$("skew").value,
  ```
- **After:**
  ```js
    // A negative (signed) skew is accepted and used as |θ|: the sign does not affect the DFs (LLDF-OH2).
    if(i.skew!=null&&(!fin(i.skew)||Math.abs(i.skew)>=90)) e.push('skew = '+i.skew+' (must be |θ| < 90 deg)');
  ```
  ```js
      ts:+$("ts").value,depth:+$("depth").value,skew:Math.abs(+$("skew").value),   // sign ignored (|θ|)
  ```
  - `serialize` writes the skew **as entered** (`skew:+$("skew").value`), so saved files keep the sign.
  - The DF hand-off `skew` is |θ|.
  - A non-positive t_s or depth is still refused (unchanged).
- **Check case:** type k, n = 1, θ = −40° entered.
  - Before: interior g_M 0.7234 / g_V 0.9349; exterior 0.8923 / 0.8923. No skew correction was applied.
  - After: identical to +40°: interior 0.6781 / 1.0686; exterior 0.8365 / 1.020.
  - An MCT payload with skew −20 was refused before ("must be 0 ≤ θ < 90 deg"). It now prefills θ = 20.

### SW5. LLDF-O8: N_b = 3 lever rule takes the governing of every multi-truck count   [calc change] [never less conservative; no change found]
- **Where:** `memberDF`, beam-slab interior and exterior N_b = 3 branches. Anchors: `} else if(n3){ // Nb=3`, `} else if(n3){ const lv2=`. `memberSteps` `n3Step` now shows the truck count.
- **Before:**
  ```js
          const lv1=leverConfig(p,geo,j,1), lv2=leverConfig(p,geo,j,2);
  ...
      } else if(n3){ const lv2=leverConfig(p,geo,j,2); n3info={lv2,eqM:mE};
  ```
- **After:**
  ```js
          // lv2 = governing of N = 2..N_L trucks (leverMulti), as for S > 16 ft (was 2 trucks only)
          const lv1=leverConfig(p,geo,j,1), lv2=leverMulti(p,geo,j);
  ...
      } else if(n3){ const lv2=leverMulti(p,geo,j); n3info={lv2,eqM:mE};   // governing of N = 2..N_L trucks
  ```
- **Governing provision:** AASHTO LRFD 10th Ed.:
  - Tables 4.6.2.2.2b-1 / 4.6.2.2.3a-1 / 4.6.2.2.2d-1 / 4.6.2.2.3b-1: for N_b = 3, moment is the lesser of the equation and the lever rule, and shear is by the lever rule.
  - Art. 3.6.1.1.2: multiple presence factors 1.00 / 0.85.
- **Check case:**
  - `leverMulti` returns the 2-truck configuration whenever only two lanes exist, so nothing changes there.
  - Grid tried: types k and a, 3 girders, S = 8–16 ft, O = 2–6 ft, L = 100 ft, including 3-lane roadways. **No result changed**: three trucks × 0.85 never beat two trucks × 1.00 on three girders.
  - Hand check (interior girder, S = 14 ft):
    - 2 trucks, wheels at −8 / −2 / +2 / +8 ft: R = ½(0.429 + 0.857 + 0.857 + 0.429) = 1.286, so g = 1.286.
    - 3 trucks centred, wheels at ±3 / ±7 / ±13 ft: R = 1.357, so g = 0.85 × 1.357 = 1.153, less than 1.286.

### SW6. LLDF-O4 (sender half): `perFootStrip:true` on the CIP slab DF hand-off   [hand-off: new optional field] [no result change]
- **Where:** `buildDFPayload`, before `return payload;`. Anchor: `payload.perFootStrip=true`.
- **After:**
  ```js
    if(p.skewV!=null) payload.skewShear=+p.skewV;
    if(p.type==='slab') payload.perFootStrip=true;
  ```
- For the slab type, `gM`/`gV`/`fatM`/`fatV` are per 1-ft strip; the flag says so.
- The flag is absent for every other type, so their payloads are byte-identical to before (checked).
- **Receivers are not changed** (other tools; see "Remaining open items").

### SW7. LLDF-O9: edition basis line   [docs] [no result change]
- **Where:** title block. Anchor: `<div class="sub">AASHTO LRFD Bridge Design Specifications`.
- **Before:** `AASHTO LRFD Bridge Design Specifications · MassDOT Bridge Manual Part I`
- **After:** `AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024) · MassDOT Bridge Manual Part I`. It is inside `#sheet`, so it prints.

### Closed without a code change
- **LLDF-O7 (CIP slab strip width on the clear roadway; no slab skew factor, Eq. 4.6.2.3-3):** both are conservative. A narrower W gives a smaller E and so a larger 12/E. The skew factor r ≤ 1.0 would only reduce the strip force. Kept as is by default, and noted on the record.
- **LLDF-H1 (DF payload `project` is a string; no `producerFile`):** kept for the existing receivers, and documented in HANDOFF.md §4.3. No change.
- **O-H1 (prefill wiped user data):** fixed by B1 (2026-10-04).
- **O-B1:** fixed by F-rail (2026-10-05).

### How verified
- `node --check` on all nine inline scripts.
- Headless Chromium (Playwright), origin/main vs branch, with the same harness (scratchpad `lldfsw/run.js`, `cmp.js`, `explore.js`, `handoff.js`, `fc.js`). The page needs no CDN (KaTeX is inlined). The only console error, on both, is the blocked Google Fonts request.
- Regression set: the fresh page, 17 saved-input sets and 4 library picks.
  - The sets cover types a, k, e, b/c, d, f, g and slab; 1 and 3 spans; N_b = 3; skews 0 / 35 / 40 / −40; d_e inside and outside the range.
  - Compared: all per-region member DFs (`computeBridge` for every span and pier region), `serialize(true)`, the `bridgeSuite.v1.lldf` payload, and the warnings.
  - Every difference is explained:
    - fresh-page n (SW2);
    - the −40° case (SW4);
    - f_de_hi (SW1);
    - the slab `perFootStrip` flag (SW6);
    - warning texts: the SW1 wording, and the SW2 n note on concrete girders with n = 1 and blank f′c.
  - Everything else is identical. This includes old saves loaded with n = 1 (their n and results are kept) and the serialized inputs (no new keys when the new fields are blank). Hand-off timestamps are excluded from the comparison.
- d_e grid (`explore.js`, 41 configurations): results change only where d_e is above the upper bound and the e-factor governs (SW1 check cases 2 and 3).
- Hand-off (`handoff.js`), through the real "Pull geometry" → banner → "Prefill" path:
  - Bridge Geometry with `skewDetail` 30/40: θ 30, θ_V 40. The banner lines are correct, and `geomSource.fields` includes `skewV`.
  - Equal skews: θ_V blank.
  - `skewDetail` 0/15 with 15 sent: θ 0, θ_V 15.
  - No `skewDetail`: θ as sent, and a stale θ_V is cleared.
  - MCT payload with skew −20: refused on main; θ = 20 on the branch.
  - No page errors.
- f′c / n behaviour (`fc.js`): library picks, f′c edits, a typed n (warning), blank f′c (n = 1 and the note), steel (n = 8, f′c ignored).
- Screenshots looked at (scratchpad `lldfsw/shots/`): the skew rows after a prefill, the banner, the section-property row (wide and 420 px), and the box skew steps with θ ≠ θ_V.

### Needs engineer
- **Q-L1 (LLDF-O5 defaults):**
  - Confirm the fresh-page f′c defaults (8.0 ksi girder / 4.0 ksi deck, n = 1.31), or give the office defaults.
  - Confirm that w_c per Table 3.5.1-1 (0.140 + 0.001 f′c above 5 ksi) is the intended basis. The alternative is one unit weight for both concretes, which gives n = (f′c,B/f′c,D)^0.33 = 1.257 for 8/4.
  - Recommendation: keep both.
- **Q-L2 (SW3):** a Bridge Geometry hand-off with `skewDetail` now fills both θ (moment) and θ_V (shear), whichever single value the sender's dialog chose. Recommendation: keep, since one run gives code-correct moment and shear DFs. Bridge Geometry's dialog notes still mention a second run; that text can be relaxed in a Bridge Geometry PR.
- **LLDF-O2 (N_b = 3 exterior):** keep `min(e·g_int,eq, lever)` (current), or apply e to the reduced interior value? Recommendation: keep the current reading (the rigid floor still applies).
- **LLDF-O3 (negative-region K_g):** add a separate negative-region K_g input? Recommendation: if the owner requires it, add an optional "K_g,neg" used only for the pier regions.
- **LLDF-O6 ("two adjacent beams" relief):** keep the −P·a/S relief on the first interior beam (statics), or drop it like the MassDOT pile-cap option? Recommendation: MassDOT to confirm; keep statics meanwhile.

### Remaining open items
- **LLDF-S10 (postMessage source check):**
  - The only `message` listener in lldf.html is the `whois` responder in `BridgeApps.announce`. It sits in the shared bootstrap block, which is also in index.html, psbeam.html and stgirder.html (see fixlog/index.md R2).
  - The listener only re-sends the app's own name and file.
  - Recommendation: add `if(e.source!==window.parent) return;` in all four files in one shared-snippet PR. Not changed here (shared block).
- **LLDF-O4 (receivers):** index.html, psbeam.html, stgirder.html and Moving Load Generator.html should refuse or label a DF payload with `perFootStrip:true` (per-foot strip factors) before using `gM`/`gV` as per-girder factors. Separate PRs per receiver.
- **HANDOFF.md (docs):** not edited here (tool file and fix log only).
  - §4.3: add the optional `skewShear` and `perFootStrip` fields to `bridge-lldf-factors`.
  - §4.2: note that lldf reads `skewDetail.moment` / `.shear`.

## 2026-10-12 — PR: claude/bootstrap-sync (shared `bridgeSuite.v1.*` bootstrap; PR link added after merge)

Cross-tool sync of the shared bootstrap blocks. The same change is in index.html, lldf.html, psbeam.html and stgirder.html (CLAUDE.md §3). No engineering formula, factor, unit or code reference changed; no computed value changes. Storage keys and saved formats are unchanged (the hand-off map keeps its key and entry format; it only loses old entries).

This closes **LLDF-S10** (sweep entry above).

### XS1. `whois` responder answers only the framing page, the opener, or an own frame (X-S10, LLDF-S10)   [robustness] [no result change]
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

## 2026-10-18 — PR: claude/lldf-d11-report (AUDIT.md D11, display only; PR link added after merge)

### D11: calculation-sheet report in the Gusset Plate Rating / ST-Girder format (Tier 1, display only)
- **Engineer request:** 2026-10-14; scope decided 2026-10-18 (AUDIT.md D11: full report for every design-check tool).
- **What existed:** the page is itself a calculation sheet (title block, sections 1.0–6.0), and Print / PDF printed it as it stands. Gaps against the format:
  - no cover, references, table of contents or n.k numbering;
  - section 4.0, section 4L and Figure 2 show **one girder only** (the selected one), so the printout worked one girder;
  - no result lines;
  - a fixed running header instead of the @page header and "Page X of Y" footer;
  - with "Live recalc" off, the printout could show results that do not match the inputs on screen (stale print).
- **Where (anchors; line numbers drift):**
  - **New script block** before `/* Floating cross-app sync drawer`, anchor `/* ===== D11 (2026-10-18): CALCULATION-SHEET REPORT + DERIVATION LINKS (display only) =====` (≈ line 4576).
    - It holds `LLDF_REFS`, `wk`, `window.lldfLinks`, `gotoStep` and its click handler, `staticClone`, `titleOf`, `replaceRef`, `pageCSS` / `applyPageCSS` (`window.lldfPageCSS`, `window.lldfApplyPageCSS`), `window.lldfBuildReport`, and the `beforeprint` / `afterprint` listeners.
    - To re-apply by hand, copy the whole `<script>` block.
  - **CSS** at the end of the main `<style>`:
    - anchor `/* D11 (2026-10-18): derivation links on the sheet (CLAUDE.md §6) */` (links, flash);
    - anchor `/* D11 calculation-sheet report` (report layout). In print, `body.lldf-rpt` hides `.sheet` and `.printhead` and shows `#lldfReport`.
  - **HTML:** after the sheet's closing `</div>`: `<div id="lldfReport" class="crdoc"></div>`.
  - **`run()`**, after `renderMembers(p,R);`:
    ```js
    if(typeof window.lldfLinks==="function") window.lldfLinks(p,R);   // D11: "Worked in" links (display only)
    ```
  - **MassDOT block, `buildDistSec()`:** one `<div class="wkLink">Worked in: …</div>` line between the `mdDistTable` wrapper and `<div id="mdDistAssume"`.
- **Before:** Print / PDF ran `window.print()` on the sheet (`@page{size:letter;margin:0.6in}`). The `.printhead` fixed header read "project · Str. · LLDF — AASHTO LRFD 4.6.2.2 · By … · date".
- **After (the printout):** Print / PDF (the button or the browser's Print) fires `beforeprint`, which builds `#lldfReport`. Only the report prints.
  - **Cover:**
    - tool title and project (the Project field, else "Untitled");
    - the selected cross-section type;
    - the sheet's code line: AASHTO LRFD 10th Ed. (2024) · MassDOT Bridge Manual Part I; LL Art. 4.6.2.2 · DL MassDOT §3.5.3;
    - the design region (multi-span only);
    - the title block: Project / Structure No. / Calculated by / Date / Checked by / Checked date;
    - the suite project name and the geometry hand-off source line, when present.
    - **No field was added.** The tool has no Checked-date field, so it reads "—". Its "Structure No." stands where the format has "Project No.". "Sheet" (`mSheet`) is not printed; the footer numbers the pages.
  - **References** (`LLDF_REFS`, only what the tool cites):
    - AASHTO LRFD 10th Ed. (2024): the Art. 4.6.2.2 tables and equations, Art. 4.6.2.3, Art. 4.6.3, Art. 3.6.1.1.1, C3.6.1.1.2, Art. 3.6.1.3.1, Table 3.5.1-1 and Eq. 5.4.2.4-1;
    - MassDOT LRFD Bridge Manual Part I §3.5.3 and §3.8, and Part II Dwg 10.1.5, marked "edition: verify" (the tool states none).
  - **Numbered table of contents** with links (sections and subsections).
  - **Sections:**
    1. Design Parameters (Given): the 1.0 card, with every input printed as its value. Its groups are 1.1 Cross-section type … 1.9 Derived quantities. Hidden rows are left out.
    2. Distribution Factors — Summary:
       - 2.1: the 2.0 table;
       - 2.2: governing results. For interior and exterior girders, moment and shear: the largest design factor and the girder where it governs.
    3. Bridge Geometry: Figure 1 of the sheet.
    4. Dead & Pedestrian Load Distribution:
       - the 3.6 card: method, loads table (as values), bar chart and per-beam table;
       - the 4D worked steps, one subsection each.
    5. Reference Images: only when the project has any.
    6. … One section **per girder**, "Live Load Distribution — Girder Bj (exterior/interior)". Each section holds:
       - every worked step of section 4.0 as a subsection n.k, made by the sheet's own `memberSteps` → `renderSteps`;
       - "Lever rule — truck configurations" for types a/e/k, b/c and d: the sheet's `drawLever` figure in the governing configuration and the `renderLever` table;
       - **Results — Girder Bj:** moment g_M (1 lane, 2 or more lanes, which governs, method), shear g_V (the same) and fatigue g_M,fat · g_V,fat, each with "see §n.k".
    7. Range of Applicability: the 5.0 table and one result line per row. PASS / FAIL follows the table's OK / OUT OF RANGE exactly. Only when the sheet shows the table (types a/e/k and f/g).
    8. Notes & Assumptions: the 6.0 notes and the sheet's disclaimer.
    - The numbers close up when a section is absent.
  - **Print:** `@page` letter with margin boxes.
    - They are written into `<style id="lldf-page">` on `beforeprint` and cleared on `afterprint`.
    - Top: "Structure No / Description", "Computed By / Checked By", "Date / Date" (the second date reads "—").
    - Bottom: "<project> (LL & DL Distribution)" and "Page X of Y".
    - If building the report fails, the sheet prints as before.
  - **In-text references renumbered:**
    - "Section 4L (below)" → "§n.k" of that girder's lever subsection;
    - "§3.6" (4D.6) → "§4.1";
    - "§4D Dead Load Distribution below" → "§4.3–4.9 below";
    - box exterior "select an interior girder to see their full derivation" → "their full derivation is in girder B2: see §6.2";
    - captions "Figure 1" / "Figure 2" → "Figure n.k";
    - lever note "as input below Figure 2" → "as entered in the app";
    - reference images "Figure 3.9-i" → "Figure 5-i".
- **Fixed along the way (display only):**
  - **One girder printed.** The printout now works every girder. The sheet still shows one at a time.
  - **Stale print.** `lldfBuildReport()` first calls `run()` (what Recalculate does), so the printout always matches the inputs.
    - With Live recalc on (the default) this changes nothing.
    - With it off and edits not yet recalculated, the sheet is recalculated before printing. As with Recalculate, a locked DF / DL channel then republishes if the values changed.
  - Each girder's lever figure is drawn in its governing configuration. Afterwards, `truckShown` (the Figure 2 truck picker; not saved) and the sheet are restored to the selected girder.
- **Provision:** none. No formula, factor, unit, code reference or result changed.
  - The report runs the sheet's own functions on the same inputs.
  - The "Results" lines are the members' own `gM`, `gV`, `fatM`, `fatV` and `r.*` values (`gM = max(1 lane, 2+ lanes)` in every family).
- **Saved data:** none. No key or format changed, and no key was added. The page CSS is a `<style>` element, not storage.
- **Check case (default project: Type IV on 5 beams @ 9.75 ft, L = 120 ft):**
  - **37 letter pages:** cover, references and contents (3 pages), then 11 sections:
    1. Design Parameters (1.1–1.9);
    2. Summary (2.1–2.2);
    3. Geometry;
    4. Dead & pedestrian loads (4.1–4.9);
    5. to 9. girders B1–B5 (B1 and B5: 18 subsections; B2–B4: 13);
    10. Range of applicability;
    11. Notes.
  - **§2.2:**
    - Interior girders: moment g_M = 0.741 (B2; empirical), see §6.9; shear g_V = 0.935, see §6.9.
    - Exterior girders: moment g_M = 0.892 (B1; lever (1 ln)), see §5.14; shear 0.892, see §5.14.
  - **§5 results:**
    - "B1 (exterior) — moment: g_M = 0.892 (1 lane 0.892, 2 or more lanes 0.851: 1 lane governs; lever (1 ln)) see §5.14";
    - fatigue 0.744 · 0.744, see §5.13.
    - These are the same values as the 2.0 table and the DF hand-off (`governing.exterior.gM = 0.8923`).
  - **§10:** S = 10 ft (3.5–16 ft), L = 120 ft, t_s = 8 in, N_b = 5 and K_g = 1,644,138 in⁴: all PASS.

### D11 links: quoted values link to where they are worked (CLAUDE.md §6) (Tier 1, display only)
- **Links added on the sheet** (small "Worked in:" lines, class `wkLink` / `a.wkA`):
  1. **2.0 summary table** (a `<caption>` under the table, rebuilt by `lldfLinks`): "Worked in: B1 · B2 · … → 4.0 Detailed Calculations · governing distribution factors of that girder".
  2. **1.0 derived block:** "Worked in: K_g · d_e left (B1) · d_e right (Bn) → 4.0 Detailed Calculations".
     - K_g only for types a/e/k.
     - d_e for types a/e/k and f/g, where 4.0 has a d_e step.
  3. **3.6 per-beam dead-load table:** "Worked in: per-beam DC1 / DC2 / DW / PL and totals (4D.7) · deck slab DC1 (4D.2) · each load (4D.6) → 4D Dead Load Distribution — Detailed Calculations".
- **Clicking a link:**
  - It selects that girder exactly as a click on its summary row does (`selectedMember`, `pushDesignBeam()`, `run()`). The suite design beam follows, as before.
  - It then scrolls the worked step into view and flashes it.
  - The K_g link keeps the current girder. The dead-load links do not change the girder.
  - Inputs and results are untouched.
- **In the report,** each link reads "see §n.k" of the subsection that holds the step:
  - "B1: see §5.14 · B2: see §6.9 …";
  - "K_g: see §5.3 · d_e left (B1): see §5.2 · d_e right (B5): see §9.2";
  - "per-beam …: see §4.9 · deck slab DC1: see §4.4 · each load: see §4.8".
  - A target missing from the printout would read "(not in this printout)". None of the 7 test cases has one.
- **Check case (default project):**
  - Clicking "B4" under the summary table selects girder B4: the member list, the header chip and the 4.0 heading ("Girder B4 · interior") all follow. "4.9 Governing distribution factors — girder B4" is in view and flashed.
  - "d_e right (B5)" selects B5 and opens 4.2.
  - "K_g" stays on B1 and opens 4.3.
  - The dead-load link opens 4D.7.

### Verification (whole PR)
- **Syntax:** `node tests/check-syntax.mjs lldf.html`: all scripts pass. There are no lldf-specific tests in `tests/`.
- **Page smoke test:** `node tests/compare.mjs --tool page --file lldf.html`.
  - `page.storage` is the same.
  - `page.text` differs only by the three new "Worked in" lines.
  - 0 console errors on both sides.
- **No computed result changed.** Headless Chromium (tests/lib.mjs `openPage`), origin/main vs this branch.
  - **7 cases,** set through `applyState`:
    1. default;
    2. steel (a), N_b = 3, skew 40°, title block filled;
    3. 3-span spread box (b/c) at support 1–2, θ = 20°, θ_V = 30°;
    4. adjacent box (f), 8 beams, sidewalk + railing, wearing surface, skew 15°;
    5. type k with S = 17 ft (lever substitution);
    6. CIP slab;
    7. multicell (d), skew 25°.
  - **Compared exactly:**
    - `readInputs()`, the whole `computeBridge()` result, `serialize(true)` and `MD.distribute()`;
    - every `bridgeSuite.v1.*` key after clicking "Send DFs" and "Send DL": the DF hand-off `bridgeSuite.v1.lldf`, `dlLoads`, `beamRoster`, `designBeam` and projects.
    - Time stamps and the location-dependent `appPaths` record were normalized.
  - **Result:** 0 differences in all 7 cases.
  - On the branch, building the report changed none of these values and left the sheet's text identical (restore check). 0 console errors.
- **Report PDF** (`page.emulateMedia({media:'print'})`, `page.pdf({preferCSSPageSize:true, printBackground:true})`):
  - Page counts: default 37; steel N_b = 3 29; 3-span b/c 36; box (f) 41; S = 17 ft 33; slab 23; multicell 32.
  - In all 7 cases:
    - every internal link resolves;
    - 0 KaTeX errors and no raw-TeX fallback;
    - no empty subsection;
    - no "(not in this printout)".
  - Pages inspected:
    - cover; references and contents; the 1.5–1.9 inputs;
    - summary with results; geometry; 4.1–4.2 and 4.9;
    - girder B1 steps, lever figure and results;
    - box exterior with the interior link; steel skew steps;
    - range-of-applicability results; notes.
- **Print events:** `beforeprint` builds the report and sets the page CSS; `afterprint` clears it (headless event test).
- **Narrow screens:** at 390 px the page width is the same as on main (the toolbar already overflows there).
- **Other copies:** none. The shared `bridgeSuite.v1.*` blocks are untouched.

### Open items (not changed; engineer to decide)
- **Behaviour change to confirm:**
  - Print / PDF now prints the calculation report, with every girder, instead of the screen sheet.
  - It recalculates first (see "Stale print").
- **Design region:** a multi-span calculation prints the selected region only. The report says so in §2 and on the cover. The DF hand-off envelopes all regions. Print one report per region, or all regions in one report?
- **Title block:** there is no Checked-date field and no Project No. field (Structure No. is used). Add optional tool-prefixed fields?
- **§6 gaps (quoted, worked nowhere):**
  - S_avg, deck width, clear roadway and N_L: the 1.9 derived block states the rule, not a substitution.
  - Several steps show only symbol → result, without substituted values: e.g. the beam-slab skew shear factor; the spread-box and multicell 2+ lane and shear equations; the box 2+ lane shear e; the slab E_2+.
  - Add the substitutions?
- **Display (raised only):** the 5.0 range table rounds the value to a whole number ("S = 10 ft" for S = 9.75 ft), while PASS / FAIL uses the unrounded value. A spacing of 16.4 ft would print "S = 16 ft … OUT OF RANGE / FAIL". Show 2 decimals?
- **Calculation (raised only, not changed):**
  - Type (d) exterior fatigue moment uses W_e/14 directly, without ÷ 1.20 (the tool's own note says "verify").
  - The rigid cross-section method is always included for a/e/k exterior girders. The step note says it is required only with cross-frames or diaphragms. This is conservative.
