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
