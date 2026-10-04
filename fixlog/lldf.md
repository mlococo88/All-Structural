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

