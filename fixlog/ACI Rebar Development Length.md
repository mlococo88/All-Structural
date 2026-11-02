# Fix log — ACI Rebar Development Length.html

Governing basis used for fixes: ACI 318-19; AASHTO LRFD 10th Ed. (2024)

## 2026-10-04 — PR: claude/fix-rebar-dev (PR #15: https://github.com/mlococo88/All-Structural/pull/15)

All edits were applied by scripted exact-string replacement (each Before block occurs exactly once in the file). Line endings are CRLF and were preserved.

### F1. AASHTO standard-hook lightweight factor: divide by λ instead of ×1.3   [calc change] [more conservative (lightweight only; normalweight unchanged)]
- **Where:** function `calcHook` (≈ line 372 standalone) and `tabHookAASHTO` display (≈ line 895–906). Anchor: `const lw = inp.lightweight?1.3:1.0;`
- **Problem:** AASHTO hook lightweight factor was a fixed ×1.3 (the old pre-2017 lightweight factor). The current spec divides by the concrete density modification factor λ, as the tool already does for straight bars.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) Art. 5.10.8.2.4a (l_dh = l_hb × λrc·λcf / λ), λ per Art. 5.4.2.8. The tool's λ remains the fixed 0.75 checkbox (see open items).
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
- **Other copies of this code:** `Concrete Beam Capacity.html`, Dev tab (`suite-frame-dev` srcdoc, ≈ standalone line + 5048). That copy is HTML-escaped (`&` → `&amp;`, `"` → `&quot;`). The same edits are applied there in branch `claude/fix-concrete-capacity` (separate PR).

### F2. ACI 25.4.2.2 check: Ktr ≥ 0.5db for fy ≥ 80 ksi bars spaced < 6 in. c-c   [robustness / new check] [no result change (new warning + dashboard row)]
- **Where:** new function `ktrHSCheck` (≈ line 418), new optional input `barSpc` in panel D, `readInputs`, `validate`, `buildDashboard`, `applyState`. Anchor: `function ktrHSCheck(inp,f){`
- **Problem:** ACI 318-19 requires transverse reinforcement with Ktr ≥ 0.5db when fy ≥ 80,000 psi bars are spaced closer than 6 in. on center. The tool had no bar-spacing input and no check, only a generic "verify scope" notice.
- **Governing provision:** ACI 318-19 §25.4.2.2.
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
- **Other copies of this code:** `Concrete Beam Capacity.html`, Dev tab (`suite-frame-dev` srcdoc, ≈ standalone line + 5048). That copy is HTML-escaped (`&` → `&amp;`, `"` → `&quot;`). The same edits are applied there in branch `claude/fix-concrete-capacity` (separate PR).

### F3. ACI 25.5.1.1: lap splices of #14/#18 flagged as not permitted   [robustness / new check] [no result change (warning; schedule shows N/P*)]
- **Where:** new function `lapProhibited` (≈ line 426); `validate`; `tabTSplice`/`tabCSplice` banners; `tabBatch` cells and footnote; `buildDashboard`. Anchor: `function lapProhibited(inp,f)`
- **Problem:** The tool reported tension and compression lap-splice lengths for #14 and #18 bars, which ACI 318-19 does not permit (compression lap of #14/#18 to #11 and smaller only).
- **Governing provision:** ACI 318-19 §25.5.1.1 (exception §25.5.5.3; length §25.5.5.2). ACI mode only; AASHTO left unchanged (see open items).
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
- **Other copies of this code:** `Concrete Beam Capacity.html`, Dev tab (`suite-frame-dev` srcdoc, ≈ standalone line + 5048). That copy is HTML-escaped (`&` → `&amp;`, `"` → `&quot;`). The same edits are applied there in branch `claude/fix-concrete-capacity` (separate PR).

### F4. ACI compression development: add ψr (Table 25.4.9.3)   [calc change (new option)] [no result change at default ψr = 1.0; less conservative only when the user selects 0.75]
- **Where:** new select `psiRc` in new collapsed panel E2; `readInputs`; `computeFactors` (`psiR_c`); `calcComp` ACI branch (≈ line 397); `tabComp` display; `applyState`. Anchor: `const a = (0.02*inp.fy`
- **Problem:** ACI 318-19 Eq. 25.4.9.2 includes ψr (0.75 for bars enclosed in spirals/ties/hoops per Table 25.4.9.3). The tool always used 1.0 (conservative).
- **Governing provision:** ACI 318-19 §25.4.9.2(a),(b) and Table 25.4.9.3.
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
- **Other copies of this code:** `Concrete Beam Capacity.html`, Dev tab (`suite-frame-dev` srcdoc, ≈ standalone line + 5048). That copy is HTML-escaped (`&` → `&amp;`, `"` → `&quot;`). The same edits are applied there in branch `claude/fix-concrete-capacity` (separate PR).

### F5. ψo hook-location options: correct labels, remove duplicate 1.25 option   [display / bug fix] [no result change]
- **Where:** `buildInputPanel`, select `hookLoc` (≈ line 535) and the ψo commentary in `tabHook`. Anchor: `<select id="hookLoc">`
- **Problem:** The 1.25 option read "Other, terminating inside column", which is backwards (terminating inside a column core with ≥ 2.5 in. side cover is the 1.0 case). Two options had `value="1.25"`, so a restored state always showed the first of them.
- **Governing provision:** ACI 318-19 Table 25.4.3.2 (ψo).
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
- **Other copies of this code:** `Concrete Beam Capacity.html`, Dev tab (`suite-frame-dev` srcdoc, ≈ standalone line + 5048). That copy is HTML-escaped (`&` → `&amp;`, `"` → `&quot;`). The same edits are applied there in branch `claude/fix-concrete-capacity` (separate PR).

### F6. Dashboard: always-true minimum-length checks shown as "min applied"   [display] [no result change]
- **Where:** `buildDashboard` (≈ line 1106) and CSS `.check.info`. Anchor: `info:true, val:fmt(t.ld,1)`
- **Problem:** "Tension l_d ≥ 12 in", "Hook ≥ max(8db,6)", "l_dc ≥ 8" and the two splice ≥ 12 in. rows could never fail because the minimums are applied with Math.max. They looked like real checks.
- **Governing provision:** n/a
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
- **Other copies of this code:** `Concrete Beam Capacity.html`, Dev tab (`suite-frame-dev` srcdoc, ≈ standalone line + 5048). That copy is HTML-escaped (`&` → `&amp;`, `"` → `&quot;`). The same edits are applied there in branch `claude/fix-concrete-capacity` (separate PR).

### F7. localStorage.setItem wrapped in try/catch in saveProject/deleteProject   [robustness] [no result change]
- **Where:** `saveProject`, `deleteProject` (≈ lines 1300–1325). Anchor: `localStorage.setItem(LS_PROJECTS,JSON.stringify(p));`
- **Problem:** setItem throws when storage is blocked or full; the exception escaped and the user got no message.
- **Governing provision:** n/a
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
- **Other copies of this code:** `Concrete Beam Capacity.html`, Dev tab (`suite-frame-dev` srcdoc, ≈ standalone line + 5048). That copy is HTML-escaped (`&` → `&amp;`, `"` → `&quot;`). The same edits are applied there in branch `claude/fix-concrete-capacity` (separate PR).

### F8. Excess-reinforcement hint lists the code exclusions   [display] [no result change]
- **Where:** panel D2 hint (≈ line 529). Anchor: `Reduces l_d by A<sub>s,req</sub>`
- **Problem:** The hint only said "Not permitted where full fy is required (seismic, etc.)". The tool cannot check location, so the user needs the full list.
- **Governing provision:** ACI 318-19 §25.4.10.2 (a)–(e); AASHTO LRFD 10th Ed. Art. 5.10.8.2.1c (λer).
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
- **Other copies of this code:** `Concrete Beam Capacity.html`, Dev tab (`suite-frame-dev` srcdoc, ≈ standalone line + 5048). That copy is HTML-escaped (`&` → `&amp;`, `"` → `&quot;`). The same edits are applied there in branch `claude/fix-concrete-capacity` (separate PR).

## 2026-10-04 — PR: claude/step1-group4 (PR #30: https://github.com/mlococo88/All-Structural/pull/30)
### S1. "← All tools" link and shared project info   [feature (no result change)]
- **Date / type:** 2026-10-04, feature (no result change).
- **Where:** Title bar markup (`<div class="byline">by Mario Lococo</div>`), CSS (`.titleblock .full{grid-column:1/3;}` and the `@media print` block), `buildInputPanel()` panel A "Title Block" template (anchor `<input id="chkDate" type="date"></div>`), and two new `<script>` blocks just before the final `</body>`.
- **Purpose:** link back to `tools.html` (`target="_top"`, hidden in print); "Use shared project info" / "Share project info" on the `bridgeSuite.v1.projectMeta` channel (`_schema:"bridge-project-meta"`, HANDOFF.md §4.1). Use reads with `BridgeXfer.read('projectMeta','bridge-project-meta',1)`, shows a confirm listing every field that will be overwritten (old → new), writes only fields this tool has, never blanks a field when the shared value is empty, and skips a non-`YYYY-MM-DD` value for a date input.
- **Field mapping:** projName → projectName; projNo → jobNo; calcBy → preparedBy; chkBy → checkedBy; calcDate (date input) → date. Not in this tool (sent as ""): bridgeId, client, location. "Checked Date" is not mapped.
- **Governing provision:** none (no engineering change). Spec: HANDOFF.md §4.1 and §5.
- **Before / After** (exact; edits applied in this order, each anchor occurs once; line endings preserved):
  1.
     - Before:
  ```html
  .titleblock .full{grid-column:1/3;}
  ```
     - After:
  ```html
  .titleblock .full{grid-column:1/3;}
  .alltools{display:inline-block; margin-top:3px; font-size:12px; color:var(--accent2); text-decoration:none;}
  .alltools:hover{text-decoration:underline;}
  ```
  2.
     - Before:
  ```html
    .note .note-body{padding-top:2px;}
  }
  ```
     - After:
  ```html
    .note .note-body{padding-top:2px;}
    .alltools{display:none!important;}
  }
  ```
  3.
     - Before:
  ```html
      <div class="byline">by Mario Lococo</div>
    </div>
  ```
     - After:
  ```html
      <div class="byline">by Mario Lococo</div>
      <a class="alltools" href="tools.html" target="_top">&larr; All tools</a>
    </div>
  ```
  4.
     - Before:
  ```html
        <div class="field"><label>Checked Date</label><input id="chkDate" type="date"></div>
      </div>`)}
  ```
     - After:
  ```html
        <div class="field"><label>Checked Date</label><input id="chkDate" type="date"></div>
      </div>
      <div class="btnrow" style="margin-top:8px;">
        <button type="button" class="btn small" onclick="bxUseProjectInfo()">Use shared project info</button>
        <button type="button" class="btn small" onclick="bxShareProjectInfo()">Share project info</button>
      </div>`)}
  ```
  5. Final `</body>`.
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
     Reads and writes the title-block inputs only, through their normal input events. */
  (function(){
    var PRODUCER="Rebar Development & Splice Calculator", FILE="ACI Rebar Development Length.html";
    var MAP={projectName:'#projName', jobNo:'#projNo', preparedBy:'#calcBy', checkedBy:'#chkBy', date:'#calcDate'};
    var KEYS=['projectName','bridgeId','jobNo','client','location','preparedBy','checkedBy','date'];
    var LBL={projectName:'Project name',bridgeId:'Bridge ID',jobNo:'Job no.',client:'Client',location:'Location',
             preparedBy:'Prepared by',checkedBy:'Checked by',date:'Date'};
    function fld(k){ return MAP[k] ? document.querySelector(MAP[k]) : null; }
    window.bxShareProjectInfo=function(){
      var f={};
      KEYS.forEach(function(k){ var e=fld(k); f[k]=e ? String(e.value||'') : ''; });
      var r=BridgeXfer.publish('projectMeta',{_schema:'bridge-project-meta',fields:f},PRODUCER,FILE);
      alert(r.ok ? 'Project info shared. Other tools can load it with "Use shared project info".' : r.error);
    };
    window.bxUseProjectInfo=function(){
      var r=BridgeXfer.read('projectMeta','bridge-project-meta',1);
      if(!r.ok){ alert('Shared project info: '+r.error); return; }
      var f=r.payload.fields||{}, ch=[], skip=[];
      KEYS.forEach(function(k){
        var e=fld(k), v=(f[k]==null) ? '' : String(f[k]);
        if(!e || v==='') return;   /* field not in this tool, or shared value empty: never blank a field */
        if(e.type==='date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)){ skip.push(LBL[k]+' ("'+v+'" is not a YYYY-MM-DD date)'); return; }
        if(e.value!==v) ch.push({e:e,k:k,v:v});
      });
      var head='Shared project info from '+BridgeXfer.describe(r.payload);
      var sk=skip.length ? '\n\nSkipped: '+skip.join('; ') : '';
      if(!ch.length){ alert(head+'\n\nNothing to change: the matching fields already hold these values.'+sk); return; }
      if(!confirm(head+'\n\nThese fields will be overwritten:\n'+ch.map(function(c){
          return '  '+LBL[c.k]+': "'+c.e.value+'" → "'+c.v+'"'; }).join('\n')+sk+'\n\nContinue?')) return;
      ch.forEach(function(c){ c.e.value=c.v; c.e.dispatchEvent(new Event('input',{bubbles:true})); });
    };
  })();
  </script>
  </body>
  ```
- **Behaviour notes:** Use writes the inputs and dispatches a bubbling `input` event, so the existing `#inputPanel` listener runs `render()`, which autosaves (`rebar_aci_autosave_v1`, unchanged format).
- **Saved data:** no existing key or format changed. New keys are only the HANDOFF channel keys `bridgeSuite.v1.projectMeta` and `bridgeSuite.v1.projectMeta.updatedAt`, written on "Share project info".
- **Check case:** n/a, no computed result changes. Hand check: open the tool, type a project name, click "Share project info"; open another tool, click "Use shared project info", accept the confirm; the name appears and survives a reload.
- **How verified:** Every plain inline script syntax-checked (Node `vm.Script`, same parser as `node --check`); BridgeXfer block compared byte-for-byte with HANDOFF.md §5; page loaded in jsdom (CDN scripts not loaded) before and after the change with no new errors; Share → Use exercised between tools with jsdom localStorage (ASCE7-16 → ACI Rebar, Steel Beam → Shear and Moment, Concrete Beam Capacity shell against stub tab documents), including cancel, empty shared values (field kept), a non-ISO date on a date input (skipped), an empty channel and a wrong `_schema` (refused). `git diff` shows no removed lines other than the ones listed under Before. No calculation code was touched.
- **Other copies of this code:** The same Rebar app is embedded in `Concrete Beam Capacity.html` (Development & Splice tab). That embedded copy was **not** changed; the Concrete Beam Capacity shell writes its title block from outside instead (see that tool's log). BridgeXfer v1 is also in: ACI Rebar Development Length.html, ASCE7-16 Load Generator.html, Concrete Beam Capacity.html (shell), Steel Beam Design - AISC 15th.html, Shear and Moment Diagrams.html.

## 2026-10-09 — Input panel tabs (branch claude/tabs-rebar)
### T1. Input panel split into tabs   [UI only — no calculation change]
- **Date:** 2026-10-09. **Type:** UI only. No calculation change. Engineer's request (2026-10-09): "make sure they are all formatted with the input panel having tabs rather than one long scrolling input panel."
- **What:** `buildInputPanel()` still builds the ten collapsible panels A–H exactly as before. Straight after it, `init()` calls the new `rebarInputTabs()`, which **moves** the finished `.panel` nodes into one pane per tab. Nothing is rebuilt, so every id, `onclick`, value and listener is unchanged. All inputs stay inside `#inputPanel`, so the existing `input`/`change` listeners on `#inputPanel` still run `render()`. The panels keep their original document order (A, B, C, D, D2, E, E2, F, G, H), so `collectState().panels` keeps the same key order and the autosave and project JSON are byte-identical. Each panel still collapses and expands as before; the collapse state is still saved as before.

  | Tab | Panels |
  |---|---|
  | Project | A Title Block |
  | Code & Material | B Design Code & Material |
  | Tension | C Tension: Modification Factors, D Tension: Confinement (c_b + K_tr), D2 Excess Reinforcement |
  | Hook & Comp. | E Standard Hook Factors, E2 Compression Development (ψr) |
  | Splices | F Splices |
  | Assumptions & Save | G Engineering Assumptions, H Project Management (save/load, JSON, Print / PDF Report) |

  The tool has no mode that hides panels (ACI and AASHTO show the same panels), so no tab is ever empty. The code still hides a tab whose pane has no panel.
- **Storage:** new key `rebar_aci_inputTab_v1` (the tool's `rebar_aci_` prefix). It holds the active input tab, per browser. It is written only when a tab is clicked or picked with the keyboard. Reads and writes are wrapped in try/catch, with an in-memory fallback. An unknown stored value falls back to the first tab. The key is not part of `collectState()`, so `rebar_aci_autosave_v1`, `rebar_aci_projects_v1` and exported JSON are unchanged. The same key is meant to be shared with the embedded copy in `Concrete Beam Capacity.html` once it is synced (see Other copies).
- **Error marker:** a red dot on a tab when one of its inputs needs attention, using the tool's own signals: a number input the browser cannot parse (`validity.badInput`, e.g. "4000e"), an input with the existing `.inwarn` class (defined in CSS, not currently set by any code), the f′c hint showing "⚠" (`#fcHint`: f′c below 2,500 psi or above 10,000 psi), or a `validate()` message that names an input, matched by `REBAR_IN_WARN`: "f'c must be a positive…" → B; "c_b (cover…", "c_b = … unusually large", "Transverse steel area A_tr entered…", "ACI 25.4.2.2…" → D; "As,req … exceeds As,prov", "As,provided must be…" → D2. Messages about code caps or scope (ψt·ψe cap, (c_b+K_tr)/d_b cap, high-strength scope note, #14/#18 lap note) are not input errors and set no dot. `rebarInputTabMarks(w)` is called from `render()` with the same `w` array `render()` already computes; it only toggles a class and a title on the tab buttons.
- **Keyboard / ARIA:** `role=tablist/tab/tabpanel`, `aria-selected`, `aria-controls`, `aria-labelledby`, roving tabindex. Arrow keys, Home and End move between visible tabs.
- **Focus / scroll:** the tool has no code that focuses or scrolls to an input (validation notices are plain text). A helper `rebarShowInTabFor(el)` is included for any future "go to input" code.
- **Print:** unchanged. The whole input panel sits in `.layout.no-print`, and the report is built separately in `#printroot` by `printReport()` (identical `#printroot` HTML before and after, see below).
- **Style:** the strip copies the output tab bar (`.tabs`/`.tab`): uppercase bold labels, `--sub` text, `--accent` underline for the active tab, `--ink` bottom rule. It is sticky at the top of the scrolling input panel and wraps onto two rows when the panel is narrow.
- **Where / Before / After** (all insertions; the Before text is the anchor and is kept; CRLF line endings kept):
  1. CSS. Anchor: `.panel.collapsed .panel-body{display:none;}`
     - After it, insert the block that starts `/* ---- Input panel tabs (rebarInputTabs; UI only) ---- */` (`#rebarInTabs`, `.rebarInTab`, `.rebarInDot`, `[hidden]` rules).
  2. JS. Anchor: the end of `togglePanel()` (`  autosave();` / `}`) followed by the `VALIDATION` banner.
     - Between them, insert the block `INPUT PANEL TABS (UI only)`, which defines `REBAR_IN_TABS`, `REBAR_IN_PANEL` (panel → tab), `REBAR_IN_WARN`, `REBAR_IN_KEY='rebar_aci_inputTab_v1'`, `rebarInTabGet/Set`, `rebarInputTabs`, `rebarSetInTab`, `rebarShowInTabFor`, `rebarInTabKey` and `rebarInputTabMarks`.
  3. `render()`. Anchor: `  updateCodeHint(inp);`
     - After it, insert: `  rebarInputTabMarks(w);   // input tabs: red dot on a tab with an input that needs attention (display only)`
  4. `init()`. Anchor: `  buildInputPanel();`
     - After it, insert: `  rebarInputTabs();   // move the input panels into the input tabs (before any state is applied)`

  The exact CSS and JS blocks are in the commit; they are written to be copied verbatim (single quotes only, so only `&` needs HTML-escaping for a `srcdoc`).
- **Governing provision:** none. No formula, factor, unit, code reference or computed result changed.
- **Check case:** not applicable. Results are identical, see below.
- **How verified:**
  - `node --check` on every inline script, main and branch (3 blocks each, 0 failures).
  - Headless Chromium (Playwright, Chromium 1194). KaTeX 0.16.9 and Plotly 2.27.0 (the pinned versions) served locally from `npm pack`.
  - Main and branch compared in 13 states: default (ACI), AASHTO, AASHTO lightweight + top bar + epoxy 1.5, ACI modifiers (#5, f′c 6000, lightweight, top bar, epoxy), confinement (A_tr, s, n, c_b), f_y 80 ksi #14, f_y 100 ksi with bar spacing, excess reinforcement + Class A + 50%, bad excess (A_s,req > A_s,prov), hook factors + ψr 0.75, low f′c with c_b = 0, high f′c with c_b = 5, and title block + assumptions. In every state these were identical: dashboard and output HTML of all six output tabs (Plotly chart data and SVG, with Plotly's random element ids normalised), `#printroot` HTML from `printReport()`, `collectState()` JSON, the `rebar_aci_autosave_v1` autosave, the `rebar_aci_projects_v1` entry after Save, the Save → Load round trip, the state after a reload (autosave restore), the `bridgeSuite.v1.projectMeta` payload from "Share project info" (`producedAt` removed), and the list of localStorage keys (the branch writes no new key until a tab is clicked).
  - All 52 inputs, selects, textareas, buttons and panels in `#inputPanel` are present in both, by tag, id, data-panel and onclick. Each one is in exactly one pane.
  - No console errors.
  - Checked by hand (scripted): tab clicks, Home / End / arrows with wrap-around and focus, tab remembered across reload, bogus stored value falls back to Project, storage blocked (localStorage throws) still switches tabs with no error, red dot on and off for "4000e" and f′c 2000 (Code & Material), A_s,req > A_s,prov and f_y 80 ksi with no spacing (Tension; off once spacing 8 in. is entered), panel collapse still saved, print media hides the input panel, strip stays at the top when the panel scrolls, no horizontal scroll at 400 px (scrollWidth 400).
  - Screenshots of every tab at 1400 px and 400 px.
- **Other copies:** a near-verbatim copy of this app is embedded (HTML-escaped `srcdoc`) as the "Development & Splice" sub-app in `Concrete Beam Capacity.html` (`#suite-frame-dev`). It is **not** changed in this PR (one tool per PR, CLAUDE.md §3 and §7). It will be synced in a follow-up PR with the same four insertions (escape `&` → `&amp;`). The embedded copy has the same panels, anchors and validation messages; a dry run of the four insertions on a scratch copy of that file showed the same six tabs and no page errors. Both copies will use the same key `rebar_aci_inputTab_v1`.

## 2026-10-12 — PR: claude/sweep-cbc-rebar (PR #140: https://github.com/mlococo88/All-Structural/pull/140)

Open-item sweep of inventory section 11 (engineer 2026-10-12: "continue making updates and fixes until it's completed … use your best judgment"). Basis: ACI 318-19 and AASHTO LRFD 10th Ed. (2024). Article numbers marked "verify" were not checked against a printed copy.

**Other copies (CLAUDE.md §3):** every edit below was applied identically to the Dev tab of `Concrete Beam Capacity.html` (`#suite-frame-dev` srcdoc, HTML-escaped `&` → `&amp;`, `"` → `&quot;`) in the same PR. Checked: the line diff main → branch of this file and of the un-escaped Dev srcdoc are the same (same hunks, same text). The edits were applied by one script (exact-string replacements, each anchor found exactly once) to both copies.

**How verified (all entries):** `node --check` of every inline script of both files (10 blocks, 0 failures). Headless Chromium 1194 (Playwright), KaTeX 0.16.9 / Plotly 2.27.0 served locally. Standalone: main vs branch on the default, #14 hook (confined ticked), AASHTO #18, lightweight λ = 0.85, and a project named `A "q" <b>`; no console errors. Dev tab: 12 scenarios main vs branch (see the Concrete Beam Capacity log, same date), every difference traced to an item below; no console errors.

**Saved data (§5):** no key or format changed. One new optional field `inp.lwLambda` (number). Older files without it load with λ = 0.75 (the former fixed value), so their results are unchanged. Default panel open/closed values change for new sessions only (R6).

### R1. ψr / ψo (ACI) and the AASHTO hook confinement factor apply to No. 11 and smaller only (REB-O5)   [calc change] [MORE conservative for #14 / #18 hooks]
- **Where:** `computeFactors` (anchor `const bigHook = barNum > 11;`), `calcHook` AASHTO branch (anchor `const conf = (inp.hookConfined && !f.bigHook)`), `validate` (three new notices), `tabHook` table labels.
- **Problem:** ACI 318-19 Table 25.4.3.2 allows ψr = 1.0 and ψo = 1.0 only for No. 11 and smaller hooked bars. The tool used them for #14 / #18 when selected — and ψo = 1.0 is the default, so the Bar Schedule hook column for #14 / #18 was unconservative at the default inputs. The ψr part and the AASHTO 0.8 hook confinement factor (5.10.8.2.4b, "No. 11 and smaller") were found during this sweep and fixed the same way.
- **Before:**
  ```js
  const psiR = inp.hookConfined ? 1.0 : 1.6;
  const psiO = parseFloat(inp.hookLoc);
  ...
      const conf = inp.hookConfined?0.8:1.0;
  ```
- **After:**
  ```js
  const bigHook = barNum > 11;
  const psiR = (inp.hookConfined && !bigHook) ? 1.0 : 1.6;
  const psiO_sel = parseFloat(inp.hookLoc);
  const psiO = bigHook ? Math.max(psiO_sel, 1.25) : psiO_sel;
  const psiRForced = bigHook && inp.hookConfined;
  const psiOForced = bigHook && psiO_sel < 1.25;
  ...
      const conf = (inp.hookConfined && !f.bigHook)?0.8:1.0;   // 5.10.8.2.4b: 0.8 for No. 11 and smaller bars only
  ```
- **Governing provision:** ACI 318-19 Table 25.4.3.2 (ψr, ψo); AASHTO LRFD 10th Ed. 5.10.8.2.4b (verify).
- **Check case (ACI):** #14 (db = 1.693 in., db^1.5 = 2.2029), fy = 60,000, f′c = 4,000, uncoated, confined ticked, ψo = 1.0 selected. ψc = 4000/15000 + 0.6 = 0.8667. Before: l_dh = 60,000·1.0·1.0·1.0·0.8667/(55·1.0·63.25)·2.2029 = **32.93 in.** After: ψr = 1.6, ψo = 1.25: 32.93 × 1.6 × 1.25 = **65.86 in.** Default inputs (not confined, ψo = 1.0): Bar Schedule hook #14 52.7 → **65.9 in.**, #18 81.1 → **101.4 in.** (× 1.25); #11 and smaller unchanged.
- **Check case (AASHTO):** #18, fy = 60, f′c = 4 ksi, confined ticked: l_hb = 38·2.257·60/(60·2) = 42.88 in. Before ×0.8 = **34.31 in.**; after ×1.0 = **42.88 in.**

### R2. AASHTO: lap splices of #14 / #18 flagged as not permitted (REB-O2)   [check / display] [MORE conservative (N/P flag); no length changes]
- **Where:** `lapProhibited` (anchor `function lapProhibited(inp,f){`), new `lapRef(f)`, `validate`, `tabTSplice`, `tabCSplice`, `tabBatch` footnote, `buildDashboard` label.
- **Before:** `function lapProhibited(inp,f){ return !f.AASHTO && parseInt(inp.barSize)>=14; }`
- **After:** `function lapProhibited(inp,f){ return parseInt(inp.barSize)>=14; }` plus AASHTO-specific texts ("AASHTO 5.10.8.4.2a: lap splices shall not be used for bars larger than No. 11 …"; no 25.5.5.3 compression exception is quoted for AASHTO).
- **Governing provision:** AASHTO LRFD 10th Ed. 5.10.8.4.2a (verify article number; the rule "lap splices shall not be used for bars larger than No. 11" is the long-standing AASHTO text).
- **Check case:** AASHTO, #18: Bar Schedule splice columns 158.5 / 50.8 in. → **N/P\***; dashboard "Lap splice permitted (5.10.8.4.2a) CHK #18 N/P"; tension and compression splice tabs show the red "not permitted" box. #11 and smaller unchanged.

### R3. λ for lightweight concrete is an input (REB-O3)   [calc change (new option)] [no change at the default 0.75; less conservative only if the user enters λ > 0.75]
- **Where:** `readInputs` (`lwLambda`), `computeFactors` (anchor `const lamIn = parseFloat(inp.lwLambda);`), panel B (new field `#lwLambda` under the Lightweight checkbox; checkbox label "Lightweight concrete (λ below)"), `validate` (notice when out of range, mapped to the Code & Material tab dot), `applyState`, print echo.
- **Before:** `const lambda = inp.lightweight ? 0.75 : 1.0;`
- **After:**
  ```js
  const lamIn = parseFloat(inp.lwLambda);
  const lambda = inp.lightweight ? (isFinite(lamIn) ? Math.min(1.0, Math.max(0.75, lamIn)) : 0.75) : 1.0;
  const lambdaAdj = inp.lightweight && !(isFinite(lamIn) && lamIn>=0.75 && lamIn<=1.0);
  ```
  Default value 0.75 (former fixed value). Blank → 0.75; outside 0.75–1.0 → limited, with a notice.
- **Governing provision:** ACI 318-19 Table 19.2.4.2 (all-lightweight 0.75, sand-lightweight 0.85) and 19.2.4.1; AASHTO LRFD 10th Ed. 5.4.2.8 (0.75 ≤ λ ≤ 1.0).
- **Check case:** ACI #8, fy = 60,000, f′c = 4,000, cb = 1.5 in., Ktr = 0: l_d = 3·60,000/(40·λ·63.25·1.5)·1.0 = 47.43/λ. λ = 0.75: **63.25 in.** (before and after, default). λ = 0.85: **55.80 in.**; hook 31.89 → 28.14 in.; compression 25.30 → 22.32 in.

### R4. Loading an older project resets ψr (compression) and the bar spacing instead of keeping the current page values (REB-N1, found during this sweep)   [bug fix] [MORE conservative in that scenario]
- **Where:** `applyState`. Anchor: `set('barSpc',`.
- **Problem:** `set()` skips absent fields, so a project saved before ψr (F16) or barSpc (F14) existed kept whatever the page showed. With ψr = 0.75 on screen, loading an old project silently computed with 0.75. The new λ field would have had the same problem.
- **Before:** `set('barSpc',inp.barSpc);set('psiRc',inp.psiRc);`
- **After:** `set('barSpc',inp.barSpc!=null?inp.barSpc:'');set('psiRc',inp.psiRc!=null?inp.psiRc:'1.0');` and `set('lwLambda',(inp.lwLambda!=null&&inp.lwLambda!=='')?inp.lwLambda:0.75);`
- **Check case:** default #8 (fy = 60,000, f′c = 4,000), ψr = 0.75 on screen, then load a project saved without `psiRc` (saved with ψr = 1.0 implied): before the loaded project showed ψr = 0.75 and l_dc = **14.23 in.**; after ψr = 1.0 and l_dc = 0.02·60,000/63.25·1.0 = **18.97 in.** (checked in Chromium). Projects that contain the fields load exactly as before.

### R5. Code caps on the dashboard shown as information, not "CHK" (REB-O6)   [display only]
- **Where:** `buildDashboard`. The rows "(c_b+K_tr)/d_b (limited to 2.5)", "ψ_t·ψ_e (limited to 1.7)", "λ_rc (limited to 0.4–1.0)", "λ_rl·λ_cf (limited to 1.7)" are `info:true` and show "(limit applied)" when the cap acts. Before they were pass/fail rows that showed a red CHK although the cap is applied in the calculation.
- **Check case:** confinement Atr = 0.4, s = 6, n = 3, cb = 2.5: before "(c_b+K_tr)/d_b within 2.5 CHK 2.50"; after "(c_b+K_tr)/d_b (limited to 2.5) 2.50 (limit applied)". Lengths unchanged.

### R6. Panels D2, E, E2, F, G open by default (REB-O11)   [UI only]
- **Where:** `buildInputPanel`, the `open` argument of `panel("D2"…)`, `panel("E"…)`, `panel("E2"…)`, `panel("F"…)`, `panel("G"…)`: `false` → `true`.
- **Why:** inside the input tabs a tab otherwise opened on a collapsed header. Saved states (autosave, projects, JSON) still restore their own open/closed values; only a new session differs. The saved `panels` values of a new session are therefore `true` for these panels.

### R7. Project names escaped (REB-O10)   [bug fix] [no result change]
- **Where:** new `escHTML` after `fmt`; `refreshProjectList` (anchor `Object.keys(p).map(k=>`); print title block (project, number, by, dates).
- **Check case:** save a project named `A "q" <b>`: before the dropdown showed `A ` (broken option); after it shows `A "q" <b>` and loads.

### Items closed / not changed
- **REB-O8** (compression lap splice for fy > 80 ksi): closed, not an issue. ACI 318-19 Table 25.5.5.1 has three rows: fy ≤ 60,000 psi: 0.0005fy·db; 60,000 < fy ≤ 80,000 psi: (0.0009fy − 24)db; fy > 80,000 psi: (0.0009fy − 24)db; each ≥ 12 in. (verify against the printed table). The code matches.
- **REB-O9** (shared storage keys): already resolved by Concrete Beam Capacity F21.

### Needs engineer
1. **REB-O7 / X-C1** — Edition labels still read "AASHTO LRFD 9th Ed. §5.10.8" (code selector, print header). Recommendation: relabel to 10th Ed. after you confirm 5.10.8.2.1, 5.10.8.2.4, 5.10.8.2.5 and 5.10.8.4 against the printed 10th Ed.
2. **REB-O1** — Headed deformed bars (ACI 25.4.4; AASHTO 5.10.8.2.4c): do you want a "Headed Bar" tab? Recommendation: yes, ACI first (l_dt = fy·ψe·ψp·ψo·ψc/(75λ√f′c)·db^1.5 ≥ max(8db, 6 in.), with the 25.4.4.1 limits as checks).
3. **REB-O4** — AASHTO compression modifiers (0.75 for spiral confinement in compression development; m = 0.83 ties / 0.75 spirals for compression laps) are not offered (conservative). I did not add them because I could not confirm the 10th Ed. wording and article numbers. Recommendation: add them as options defaulting to 1.0 once you confirm the text.
4. **R1 / R2 articles** — confirm AASHTO 5.10.8.2.4b ("No. 11 and smaller" for the 0.8 hook factor) and 5.10.8.4.2a (no laps for bars larger than No. 11).

### Remaining open items
None from section 11 beyond the "Needs engineer" list.

## Open items (not changed)
- **Status 2026-10-12 (claude/sweep-cbc-rebar):** O2 → R2; O3 → R3; O5 → R1; O6 → R5; O8 closed (not an issue); O9 resolved earlier (CBC F21); O10 → R7; O11 → R6. O1, O4, O7 remain under "Needs engineer" in that entry.
- O1. **Headed deformed bars (ACI 318-19 §25.4.4; AASHTO 10th Ed. 5.10.8.2.4c) not implemented.** — Not done here: a clean implementation needs a new tab, a schedule column, a print section and new inputs (ψp needs Att/Ahs and bar spacing; plus the 25.4.4.1 applicability limits: bar ≤ #11, Abrg ≥ 4Ab, clear cover ≥ 2db, c-c spacing ≥ 3db, normalweight concrete), and the same change must be mirrored by hand into the escaped copy in `Concrete Beam Capacity.html`. That is a sizeable UI addition. — Decision needed: do you want a "Headed Bar" tab (ACI l_dt = fy·ψe·ψp·ψo·ψc/(75λ√f'c)·db^1.5 ≥ max(8db, 6 in.)), and should the AASHTO branch be included?
- O2. **AASHTO: lap splices of #14/#18.** The new N/P flag is applied in ACI mode only. I believe AASHTO 5.10.8.4 also restricts lap splices to #11 and smaller, but I did not confirm the 10th Ed. wording/article. — Confirm the AASHTO article; if confirmed, `lapProhibited()` can drop its `!f.AASHTO` condition.
- O3. **λ is a fixed 0.75 checkbox.** AASHTO 10th Ed. 5.4.2.8 computes λ from fct or wc (0.75 ≤ λ ≤ 1.0), and ACI 318-19 Table 19.2.4.2 allows 0.85 for sand-lightweight. The hook fix (F1) now uses this same λ. — Decision needed: add a λ input (value or wc)?
- O4. **AASHTO compression development modifiers** (5.10.8.2.5: e.g. 0.75 for spiral/tie confinement, λer) beyond the excess factor are not offered; m = 1 is used for AASHTO compression lap splices (5.10.8.4.5a m = 0.83 ties / 0.75 spirals not offered). Conservative. — Want them added?
- O5. **ψo for #14/#18 hooks.** Table 25.4.3.2 allows ψo = 1.0 only for #11 and smaller; the tool lets the user pick 1.0 for #14/#18. — Should the tool force 1.25 (or warn) for #14/#18?
- O6. **(c_b+K_tr)/d_b > 2.5 and the 1.7 product caps** still show as red "CHK" on the dashboard although capping is the code limit, not a deficiency. Left as-is (outside the listed task). — Relabel as information?
- O7. **Edition labels** still read "AASHTO LRFD 9th Ed." (code selector, print header). The 10th Ed. governs; I did not relabel because the remaining AASHTO provisions were not re-verified article-by-article against the 10th Ed. — Confirm and relabel in a follow-up.
- O8. **Compression lap splice for fy > 80 ksi** (`(0.0009fy − 24)db` used for all fy > 60 ksi) — reviewer asked to verify ACI 318-19 Table 25.5.5.1 coverage up to 100 ksi. Not changed.
- O9. **Shared storage keys** `rebar_aci_autosave_v1` / `rebar_aci_projects_v1` are also used by the Dev tab of `Concrete Beam Capacity.html` (same origin on Chromium `file://`). Not changed (CLAUDE.md §5). — Decision needed (see the Concrete Beam Capacity log).
- O10. Project dropdown builds `<option>` with unescaped project names (a name containing `"` or `<` breaks the list). Not in the task list; not changed.
- O11. **Tabs that open on a collapsed panel.** Panels D2, E, E2, F and G start collapsed by default (unchanged), so the Splices tab, for example, first shows only the "F Splices" header until it is clicked. The collapse state is saved in the autosave and projects, so T1 does not change it. — Decide whether panels should always be expanded once they sit in their own tab (this would change the saved `panels` values).

## 2026-10-18 — PR: claude/rebar-d11-report (PR #288: https://github.com/mlococo88/All-Structural/pull/288)

The tool file uses CRLF line endings; keep them. Line numbers drift; search for the anchor text.

### D11: calculation-sheet report (Tier 1, display only)
- **Engineer request:** AUDIT.md D11 (2026-10-14 / 2026-10-18). Format copied from Timber Beam Check / Base Plate & Anchor Designer (`/* D11 (2026-10-18)`) and Gusset Plate Rating.
- **What changes for the user:** the output of **Print / PDF Report** (the button is unchanged) and of **Ctrl+P** (see the fix below).
- **Where:** print CSS (anchor `/* D11 calculation sheet (2026-10-18)`, after `.note .note-body{padding-top:2px;}`), and the block from `/* D11 (2026-10-18): calculation-sheet report` to the `beforeprint` / `afterprint` listeners just above `INIT`: new `REBAR_RPT_TOOL`, `rebarPageCSS`, `rebarApplyPageCSS`, `rebarRefs`, `rebarResultRows`, `rebarResultBlock`, `buildReport`; `printReport()` is now `buildReport(); rebarApplyPageCSS(true); setTimeout(()=>window.print(),350);`. To re-apply by hand, copy that block and the CSS lines.
- **Before:** `printReport()` wrote a title line, a 6-field title table, Input Summary, assumptions, validation notices, then `<h3>` "1. Tension Development" … "6. Bar Development Schedule" with each tab's own output (`tabTension(inp,f,true)`, `tabHook`, `tabComp`, `tabTSplice`, `tabCSplice`, `tabBatch`), no page breaks, no references, contents, result lines or page header/footer (`@page{margin:0.7in; size:letter;}`).
- **After (same tab functions, so the same worked equations):**
  - Cover: "Rebar Development & Splice Calculation", project, bar / f_y / f′c, code ("ACI 318-19" or "AASHTO LRFD 9th Ed. §5.10.8", as before), "by Mario Lococo"; title block Project / Project No. / Calculated by / Date / Checked by / Checked date / Design code / Bar (all existing fields; **none added**); a one-line count of the checks with a link to §1.2.
  - References (`rebarRefs`): the articles the printout cites, per code (ACI 318-19: 25.3.1, 25.4.1.4, 25.4.2.1, 25.4.2.4 and Eqs. a/b, Table 25.4.2.5, 25.4.3.1 and Table 25.4.3.2, 25.4.9.1–25.4.9.2 and Table 25.4.9.3, 25.5.1.1, 25.5.2, 25.5.2.1, 25.5.5.1, 25.5.5.3; Table 19.2.4.2, 25.4.2.2, 25.4.10.1 only when lightweight / f_y ≥ 80 ksi / excess reduction apply. AASHTO: 5.4.2.8, 5.10.2.1, 5.10.8.1.1, 5.10.8.2.1a–c, 5.10.8.2.4a–b, 5.10.8.2.5, 5.10.8.4.2a, 5.10.8.4.3a, 5.10.8.4.5, "edition: verify").
  - Numbered contents with links. §1 Summary and Inputs (Input Summary, Summary of Results, Validation Notices and Engineering Assumptions when present); §2 Tension Development … §7 Bar Development Schedule, each on a new page; the tabs' cards (`.subsec`) become n.k (their own "1." / "2." replaced).
  - Result lines (`rebarResultRows`, the tool's own values): required l_d, l_dh, l_dc, l_st (factor × base l_d) and l_sc with the governing branch (minimum, 8d_b, expression (a)/(b), ×4/3), status "—" (no provided-length input, so no PASS/FAIL); checks as on the dashboard: f′c within 2,500–10,000 psi, K_tr ≥ 0.5d_b (ACI 25.4.2.2, when f_y ≥ 80 ksi), Class A eligible (when Class A is selected), Lap splice permitted (#14/#18) — PASS / FAIL, or CHK where an input is missing (bar spacing, A_s,req/A_s,prov), as the dashboard's CHK. At the end of §2–§6, and all of them in §1.2.
  - Print header / footer (`rebarPageCSS`, a `<style id="rebar-page">` filled only while printing, emptied on `afterprint`): top "Project No / Description" (#bar bar development and splices), "Computed By / Checked By", "Date / Date" (calc date / checked date); bottom "<project> (Rebar Development & Splice Calculator)" and "Page X of Y". Letter, margins 0.95 / 0.6 / 0.7 / 0.6 in.
- **Fixed along the way (report display only):**
  - **Ctrl+P** printed a blank page (nothing built yet) or a stale report from the last button press. A `beforeprint` listener now builds the current report and the header/footer; `afterprint` removes the header/footer style.
  - The hook schematic's screen-only link "view bend dimensions ↗" (`javascript:void(0)`) printed in its card title; the report title is now plain text.
- **Provision:** none. No formula, factor, unit, code reference or result changed.
- **Saved data:** none. No key or format change (`rebar_aci_autosave_v1`, `rebar_aci_projects_v1`, `rebar_aci_inputTab_v1`, JSON export untouched).
- **Check case (default: ACI, #8, f_y 60,000, f′c 4,000, c_b 1.5, K_tr 0, Class B):** 17 letter pages (cover, references + contents, §1–§7). Result lines: f′c 4000 psi PASS; l_d = 47.43 in. (§2.3); l_dh = 23.92 in. (§3.3); l_dc = 18.97 in., expression (a) (§4.1); l_st = 1.3 × 47.43 = 61.66 in. (§5.2); l_sc = 30.00 in. (§6.1). Same values as the tabs.

### D11 links: quoted values link to the card where they are worked (CLAUDE.md §6) (Tier 1, display only)
- **Helpers** before the DASHBOARD banner (anchor `/* ---- D11 links (CLAUDE.md §6, 2026-10-18)`): `REBAR_CARDS` (key → tab, card title), `rebarLenCards`, `rebarTabName`, `rebarCardTxt`, `rebarLink`, `rebarWorkedIn`, `rebarCardTitle`, `rebarGoto` and one document click handler for `a.wkA` (switches the tab as the tab button does, scrolls the output panel to the card, flashes it). CSS before `/* ---- Print ---- */` (anchor `/* D11 links (CLAUDE.md §6`).
- **New lines (screen and report):**
  1. Dashboard, under the checks: "Worked in: l_d → Tension l_d · Development Length; l_dh → Hook l_dh · Hook Development Length; l_dc → Compression l_dc · Governing Expressions; l_st → Tension Splice · Base Development Length; l_sc → Comp. Splice · Splice Length", plus "Class A →" (when Class A) and "K_tr →" (ACI, f_y ≥ 80 ksi). Anchor `+ rebarWorkedIn(rebarLenCards().concat(`.
  2. Tension Splice, Base Development Length, under the table: "Worked in: l_d → Tension l_d · Development Length" (with the note that the l_d there includes the excess-reinforcement factor when that reduction is on).
  3. Bar Schedule, under the table: "Selected bar (#8) worked in: …" (the five lengths).
- **Report only:** Input Summary K_tr "(see §2.2)" (ACI) and excess factor "(see §2.k)".
- In the report each link reads "<value>: see §n.k".
- **Check case (default):** "Worked in: l_d: see §2.3; l_dh: see §3.3; l_dc: see §4.1; l_st: see §5.2; l_sc: see §6.1".

### How verified (both entries)
- `node tests/check-syntax.mjs "ACI Rebar Development Length.html"`: all 3 scripts pass.
- `node tests/compare.mjs --tool page --file "ACI Rebar Development Length.html"`: page.storage same; page.text differs only by the dashboard "Worked in" line (KaTeX not in the kit for jsDelivr URLs).
- Main vs branch, headless Chromium, KaTeX 0.16.9 and plotly.js-dist-min 2.27.0 served locally (npm pack), 5 cases (default; ACI #11 f_y 80 ksi lightweight λ 0.85 top epoxy, K_tr, bar spacing 5 in., excess 1.0/2.5, Class A 50 %, hook factors, ψr 0.75; AASHTO #8 top epoxy excess 0.8/1.0; ACI #14 f_y 100 ksi f′c 2,500 Class A unknown; AASHTO #18 f′c 12 ksi lightweight λ 0.7): `readInputs`, `computeFactors`, every calc function for all 11 bar sizes, `validate`, every tab's text (without the "Worked in" lines), the dashboard and the autosave identical. Console messages identical (a pre-existing KaTeX "×" warning in the ×4/3 step).
- Report PDF (print media, `preferCSSPageSize`): 17 / 18 / 16 / 17 / 15 pages; every internal link resolves (38–46 per case), 0 KaTeX errors, no raw TeX, header and footer present; building the report leaves the inputs and the autosave unchanged; `afterprint` empties the header/footer style; `beforeprint` (Ctrl+P) builds all 7 sections. Pages looked at: cover, contents, §1 with FAIL/CHK lines, tension equations, Bar Schedule.
- In the app: every link of the dashboard, Tension Splice and Bar Schedule (21–27 clicks per case) opens the right tab with the right card in view and flashed; the page itself does not scroll. No console errors.
- **Other copies:** the Development & Splice tab of `Concrete Beam Capacity.html` (CLAUDE.md §3) — synced in the follow-up branch `claude/cbc-rebar-sync`.

### Open items (noticed, not changed)
- **Comp. Splice tab in AASHTO mode** shows "ACI 318-19 §25.5.5" (heading) and "§25.5.5.1" (card), and `calcCompSplice` uses the ACI 25.5.5.1 expressions for AASHTO too (comment "simplified"; m = 1, see REB-O4). The report repeats the tool's citations. Code-reference / calculation question: confirm the AASHTO 5.10.8.4.5 form.
- **§6 gaps:** (a) with the excess-reinforcement reduction on, the splice base l_d (without the factor, e.g. 134.31 in. for case 2) is not worked anywhere — the Tension tab works l_d with the factor; (b) in AASHTO mode k_tr = 40A_tr/(s·n) is used in λ_rc but worked only in the ACI tab. Add a card for each?
- Pre-existing: KaTeX warns on "×" inside `\text{(×4/3 for }…)` (Comp. Splice, f′c < 3,000 psi); it renders. The Project tab shows a "Calc Date" label above a hidden input (`calcDate2`).

## 2026-10-19 — PR: claude/rebar-aashto-compsplice (PR #322: https://github.com/mlococo88/All-Structural/pull/322)

The tool file uses CRLF line endings; keep them.

### C1. Comp. Splice tab in AASHTO mode: AASHTO citation and form, m = 1.0   [code reference change (§4)] [no result change]
- **Engineer decision (2026-10-19)** on the open item of the 2026-10-18 entry: in AASHTO mode cite AASHTO LRFD Art. 5.10.8.4.5a (edition as the tool states it: "9th Ed." on the code selector; "edition: verify") instead of ACI 318-19 §25.5.5 / §25.5.5.1, and show the AASHTO form with m written in the equation, fixed at m = 1.0 (no reduction for ties or spirals).
- **Code-text comparison before coding (no result may change):** `calcCompSplice`, AASHTO branch (unchanged code): `fy<=60000 ? 0.0005*fy*db : (0.0009*fy-24)*db`, `×4/3 if fc<3000`, `max(…,12)`, psi. AASHTO 5.10.8.4.5a as stated in the decision: ℓ_c = 0.5·m·f_y·d_b (f_y ≤ 60 ksi), m(0.9f_y − 24)d_b (f_y > 60 ksi), f_y in ksi; ×4/3 when f′c < 3 ksi; ≥ 12 in. With m = 1.0: 0.5·f_y,ksi = 0.0005·f_y,psi; 0.9·f_y,ksi = 0.0009·f_y,psi; threshold 60 ksi = 60,000 psi (both ≤); f′c < 3 ksi = f′c < 3,000 psi; 12 in. minimum the same. Identical. Checked numerically for f_y 40/60/80/100 ksi × f′c 2,500/2,999/3,000/4,000/12,000 psi × all 11 bars: 0 differences (max |Δ| = 0). No AASHTO text is in the repo; the AASHTO expressions are those of the decision and the tool's former comment, not re-read from the printed specification.
- **Where:** `calcCompSplice` comment (anchor `// AASHTO LRFD 5.10.8.4.5a (edition: verify)`); `tabCSplice` (new first line `if(f.AASHTO) return tabCSpliceAASHTO(inp,f,s);`); new `tabCSpliceAASHTO` after `tabCSplice` (anchor `/* ---- AASHTO compression lap splice branch`); `rebarRefs` AASHTO rows; `rebarResultRows` compression-splice ref.
- **Before (AASHTO mode):** heading "ACI 318-19 §25.5.5"; narrative "(§25.5.5.1)"; card "1. Splice Length §25.5.5.1" with f_y, f′c in psi; equation `l_{sc} = 0.0005\,f_y\,d_b` / `(0.0009\,f_y - 24)\,d_b` "§25.5.5.1"; minimum "§5.10.8.4.5"; result line "AASHTO 5.10.8.4.5"; references "5.10.8.4.5 (compression lap splices)" and ACI row "25.5.5 and 25.5.5.1 (cited by the Comp. Splice tab in this mode too)". Code comment `// 5.10.8.4.5: lsc = 0.5 m fy db (fy<=60), where m=1.0; higher fy adjustments; simplified` and `// same numeric as ACI in practice`.
- **After (AASHTO mode):** heading "AASHTO LRFD §5.10.8.4.5a"; card "1. Splice Length §5.10.8.4.5a" with f_y, f′c in ksi and a row m = 1.0 ("no reduction for ties or spirals taken"); equation `l_{sc} = 0.5\,m\,f_y\,d_b` → `0.5×1.0×f_y×d_b` (f_y ≤ 60 ksi) or `l_{sc} = m\,(0.9\,f_y - 24)\,d_b` → `1.0×(0.9×f_y − 24)×d_b`; "×4/3 (f′c < 3.0 ksi)" when active; minimum "§5.10.8.4.5a"; result line "AASHTO 5.10.8.4.5a"; references "5.10.8.4.5a (compression lap splices, m = 1.0)", ACI row "25.3.1 (hook geometry, cited with AASHTO 5.10.2.1)." The code lines of `calcCompSplice` are unchanged; only the comments now state the AASHTO form, m = 1.0 and the equivalence. **ACI mode unchanged.**
- **Check case (AASHTO, #9, f_y 80 ksi, f′c 2.5 ksi):** before (0.0009×80,000 − 24)×1.128×4/3 = 72.19 in.; after 1.0×(0.9×80.0 − 24)×1.128 = 54.14 ×4/3 = **72.19 in.** (≥ 12). AASHTO #8, 60 ksi, 4 ksi: 0.5×1.0×60.0×1.000 = **30.00 in.** before and after.
- **REB-O4 / note on the 2026-10-18 open item:** the compression-splice part is closed by this decision (m fixed at 1.0, shown in the equation; the tie/spiral reduction is not offered). The AASHTO compression *development* modifiers (5.10.8.2.5) remain open as before. The 2026-10-18 open item "Comp. Splice tab in AASHTO mode" is resolved here.
- **How verified:** `node tests/check-syntax.mjs`: all scripts pass. Main vs branch, headless Chromium (KaTeX / Plotly from npm pack), 6 cases (the 5 of the 2026-10-18 entry plus AASHTO #9 f_y 80 ksi f′c 2,500): inputs, factors, every calc function for all 11 bars, `validate`, dashboard, autosave identical; tab texts identical except the Comp. Splice tab in the three AASHTO cases (citation, units of the displayed inputs, m row, equation text; l_sc values identical). Report: §6.1 and its result line cite 5.10.8.4.5a, no "25.5.5" left in the AASHTO printout, all links resolve, 0 KaTeX errors. The AASHTO ×4/3 step no longer triggers the KaTeX "×" warning (ACI unchanged).
- **Other copies:** the Development & Splice tab of `Concrete Beam Capacity.html` (branch claude/cbc-rebar-sync-compsplice).

## 2026-10-19 — PR: claude/aashto10-rebar — AASHTO mode to AASHTO LRFD 10th Ed. (2024) §5.10.8 (PR #334: https://github.com/mlococo88/All-Structural/pull/334)

The tool file uses CRLF line endings; keep them. **ACI mode unchanged** (verified: every computed value, validation notice, dashboard, tab text and report text identical to main in two ACI cases).

### E1. Tension development length, AASHTO 10th Ed. 5.10.8.2.1a   [calculation change (§4)]
- **Where:** `calcTension`, AASHTO branch (anchor `// AASHTO LRFD 10th Ed. 5.10.8.2.1a (ksi): Eq. 5.10.8.2.1a-2`).
- **Before:**
  ```js
  const ldb = 2.4*f.db*f.fy_ksi/f.sqrtFc_ksi;
  const ld_calc = ldb*(f.lam_rlcf_cap*f.lam_rc*f.excess)/f.lambda;
  ```
- **After:**
  ```js
  const ldb = 0.17*f.db*Math.pow((f.excess*f.fy_ksi)/(1.97*f.lambda*f.fc4), 2);
  const ld_calc = ldb*f.lam_rlcf_cap*f.lam_rc;
  ```
  (`ld = Math.max(ld_calc, 12)` unchanged.) In symbols: ℓdb = 0.17·db·[(λer·fy − Fh/Ab)/(1.97·λ·f′c^0.25)]², Fh = 0 for straight bars and lap splices; ℓd = ℓdb·λrl·λcf·λrc ≥ 12 in. λ and λer now act squared (inside the bracket).
- **Provision:** AASHTO LRFD 10th Ed. (2024) Art. 5.10.8.2.1a, Eqs. 5.10.8.2.1a-1 and -2; λer Eq. 5.10.8.2.1c-4.
- **f′c limit (computeFactors, anchor `const fcLimA`):** before, √f′c capped at √10 ksi (comment "f′c ≤ 10 ksi"). After, tension, hooks and tension splices use f′c ≤ 15 ksi normal weight (5.10.8.2.1, 5.10.8.2.4, 5.10.8.4.3) and ≤ 10 ksi lightweight (C5.10.8.2.4); a higher input is flagged and the limit is used. Compression development keeps `sqrtFc_ksi` capped at √10 ksi (unchanged). Above 10 ksi (normal weight) a notice, a dashboard CHK and a report CHK line state the #3 @ 12 in. transverse bar requirement (5.10.8.2.1, 5.10.8.4.3) and the hook ties (5.10.8.2.4b); not checked by the tool.

### E2. λrc, AASHTO 10th Ed. 5.10.8.2.1c   [calculation change (§4)]
- **Where:** `computeFactors`, block `/* ---- AASHTO LRFD 10th Ed. (2024) factors (5.10.8.2.1) ---- */`.
- **Before:** `const ktr_a = Ktr;` (= 40·Atr/(s·n)) `const lam_rc_raw = db/(inp.cb + ktr_a); const lam_rc = Math.max(0.4, Math.min(lam_rc_raw, 1.0));`
- **After:**
  ```js
  const wcA = fcA<=5 ? 0.145 : 0.140+0.001*fcA;
  const EcA = 120000*1.0*wcA*wcA*Math.pow(fcA,0.33);
  const nsA = 29000/EcA;
  let ktr_a = 0;
  if (inp.sTr>0 && inp.nBars>0) ktr_a = inp.Atr/(inp.sTr*inp.nBars);
  const rcA = k => (inp.cb>0) ? db*inp.cb/Math.pow(inp.cb*(1-betaT)+1.67*nsA*k, 2) : 1.0;
  const lam_rc_raw = rcA(ktr_a);
  const lam_rc = Math.max(0.3, Math.min(lam_rc_raw, 1.0));
  ```
  λrc = db·cb/(cb(1−βt) + 1.67·ns·ktr)², 0.3 ≤ λrc ≤ 1.0, ktr = Atr/(s·n) (no factor 40), ns = Es/Ec with Es = 29,000 ksi (5.4.3.2), Ec by Eq. 5.4.2.4-1 with K1 = 1.0 and wc of Table 3.5.1-1 for normal weight concrete (for lightweight this Ec is high, so ns and the ktr credit are low: conservative). With Atr = 0 and βt = 0 it reduces to db/cb, as before; only the lower bound (0.4 → 0.3) and the ktr term change results.
- **New input βt** (panel D, id `betaT`, "AASHTO only", −1 to 0, default **0** = no clamping credit, conservative; out-of-range values are clamped with a notice). c_b ≤ 0 gives λrc = 1.0 (no credit; the expression itself would give 0).
- **Provision:** AASHTO LRFD 10th Ed. Art. 5.10.8.2.1c, Eqs. 5.10.8.2.1c-1 to -3; Eq. 5.4.2.4-1; 5.4.3.2; Table 3.5.1-1.

### E3. Standard hooks, AASHTO 10th Ed. 5.10.8.2.4 / .4a / .4b   [calculation change (§4)]
- **Where:** `calcHook`, AASHTO branch (anchor `// AASHTO LRFD 10th Ed. 5.10.8.2.4a (ksi): l_dh = l_d + R + db/2`).
- **Before:** `lhb = 38.0*db*fy/(60*√f′c)`, `ldh_calc = lhb*cf*conf*(1/λ)*excess` (cf 1.2 epoxy, conf 0.8 if confined and #11 or smaller), `ldh = max(ldh_calc, 8db, 6)`.
- **After:** ℓdh = tie·(ℓd + R + db/2) ≥ max(8db, 6 in.), with ℓd = ℓdb·min(λrl·λcf, 1.7)·λrc and ℓdb from Eq. 5.10.8.2.1a-2 with Fh = db·R·v·f′c (Eq. 5.10.8.2.4a-2), v = 0.85 − f′c/20, 0.45 ≤ v ≤ 0.65 (Table 5.8.2.5.3a-1, CTT node). λrl (top bar) now applies to hooks; λcf = 1.2 for coated hooked bars; with the tie box ticked (#11 and smaller) ktr = 0 in λrc and tie = 0.8 (5.10.8.2.4b), else 1.0. No 12 in. minimum on the straight portion ℓd (it applies to straight bars). When Fh/Ab ≥ λer·fy the bracket is taken as 0 (ℓd = 0), with a notice. Code:
  ```js
  const Dmin = f.barNum<=8 ? 6 : (f.barNum<=11 ? 8 : 10);
  const Rmin = (Dmin/2 + 0.5)*f.db;
  const R = Rentered ? Rin : Rmin;
  const v = Math.max(0.45, Math.min(0.65, v_raw));          // v_raw = 0.85 - f.fcA/20
  const Fh = f.db*R*v*f.fcA;
  const rlcf = Math.min(f.lam_rl*cf, 1.7);
  const lam_rc_h = ties ? f.lam_rc0 : f.lam_rc;
  const num = f.excess*f.fy_ksi - Fh/f.Ab;
  const ldb = 0.17*f.db*Math.pow(Math.max(num,0)/den, 2);   // den = 1.97*f.lambda*f.fc4
  const ld = ldb*rlcf*lam_rc_h;
  const ldh_calc = (ld + R + f.db/2)*conf;
  ```
- **New input R** (panel E, id `hookR`, "AASHTO only"): bend radius to the bar centroid. Blank (default, and every older saved project) = minimum finished bend of Table 5.10.2.3-1, R = D/2 + db/2 (D = 6db #3–#8, 8db #9–#11, 10db #14–#18). A smaller R gives a longer ℓdh, so the minimum is the conservative default; an entered R below it is used with a notice. #14/#18 hooks are flagged as outside 5.10.8.2.4 (computed, no doubling).
- **Provision:** AASHTO LRFD 10th Ed. Art. 5.10.8.2.4, 5.10.8.2.4a (Eqs. 5.10.8.2.4a-1, -2), 5.10.8.2.4b, 5.10.8.2.1b; Table 5.8.2.5.3a-1; Table 5.10.2.3-1. **Note:** the 2026-10-19 inventory wrote ℓdh = ℓd − R − db/2; Eq. 5.10.8.2.4a-1 (rendered page 5-194) is ℓdh = ℓd **+** R + db/2, which is implemented.

### E4. Tension lap splices (5.10.8.4.3a)   [result change through E1]
- `calcTensSplice` unchanged (Class A 1.0 / Class B 1.3 × ℓd without λer, ≥ 12 in.); ℓd is now that of E1. The Tension Splice tab adds, in AASHTO mode, notes for fy > 75 ksi (transverse reinforcement over the lap, 5.10.8.4) and f′c > 10 ksi (#3 @ 12 in., ≥ 3 bars, 5.10.8.4.3); dashboard and report CHK lines for both.

### E5. Renumbers and labels (no result change)
- Compression development 5.10.8.2.5 → **5.10.8.2.2a** (Eqs. 5.10.8.2.2a-1 / -2 / -3): `tabCompAASHTO`, `rebarResultRows`, comments. Calculation unchanged (λer only).
- Code selector "AASHTO LRFD 9th Ed. §5.10.8 (bridges)" → "AASHTO LRFD 10th Ed. (2024) §5.10.8 (bridges)"; report code name → "AASHTO LRFD 10th Ed. (2024) §5.10.8"; references row: "labelled "9th Ed." … (edition: verify)" → "10th Ed. (2024)" with the articles now used; tension / hook / compression headings state the edition; narrative "(8th Ed. onward)" rewritten; λer card cites Eq. 5.10.8.2.1c-4; dashboard "λ_rc (limited to 0.3–1.0)"; f′c range check 2,500–15,000 psi (10,000 lightweight) in AASHTO mode; report Input Summary shows AASHTO k_tr with a link to the new card "Confinement Factor" (`REBAR_CARDS.tConfA`); comment "5.10.8.4.2a (verify)" verified.
- §6: every new value is worked on its tab (Tension: 1 Basic Development Length, 2 Modification Factors, 3 Confinement Factor with Ec, ns, ktr, λrc, 4 Development Length; Hook: 1 Hook Force with R, v, Fh, 2 Modification Factors with λrc, 3 Straight Portion, 4 Hook Development Length) and in the report (§2.x, §3.x).

### Saved data
- No key or format change (`rebar_aci_autosave_v1`, `rebar_aci_projects_v1`, `rebar_aci_inputTab_v1`, JSON export). Two optional fields added to `inp`: `betaT`, `hookR`. `applyState` sets them to 0 / blank when absent, so older projects load with the stated defaults (checked with an older AASHTO autosave: it gives the #8 / 4 ksi numbers below).

### Check cases (AASHTO, fy = 60 ksi, c_b = 1.5 in., Atr = 0, βt = 0, bottom bar, uncoated, normal weight, no excess, Class B; lengths in in.)
| Case | ℓd before | ℓd after | ℓdh before | ℓdh after | Class B lap before | after |
|---|---|---|---|---|---|---|
| #5, f′c 4 ksi | 18.75 | **20.53** | 11.88 | **15.93** | 24.38 | **26.69** |
| #5, f′c 8 ksi | 13.26 | **14.52** | 8.40 | **10.35** | 17.24 | **18.87** |
| #8, f′c 4 ksi | 48.00 | **52.57** | 19.00 | **38.32** | 62.40 | **68.33** |
| #8, f′c 8 ksi | 33.94 | **37.17** | 13.44 | **24.03** | 44.12 | **48.32** |

Hand check #8, f′c = 4 ksi: f′c^0.25 = 1.4142; 1.97 × 1.4142 = 2.786; ℓdb = 0.17 × 1.0 × (60/2.786)² = 0.17 × 463.8 = 78.85 in.; λrc = 1.0 × 1.5/1.5² = 0.667; ℓd = 78.85 × 0.667 = 52.57 in. (before 2.4 × 1.0 × 60/2 × 0.667 = 48.00). Hook: R = 3db + db/2 = 3.5 in.; v = 0.85 − 4/20 = 0.65; Fh = 1.0 × 3.5 × 0.65 × 4 = 9.10 kip; Fh/Ab = 9.10/0.79 = 11.52 ksi; ℓdb = 0.17 × ((60 − 11.52)/2.786)² = 0.17 × 302.8 = 51.48 in.; ℓd = 51.48 × 0.667 = 34.32 in.; ℓdh = 34.32 + 3.5 + 0.5 = 38.32 in. ≥ 8 in. (before 38 × 1 × 60/(60 × 2) = 19.00 in.). #8 at 8 ksi: v = 0.85 − 0.40 = 0.45; Fh = 3.5 × 0.45 × 8 = 12.6 kip (15.95 ksi); f′c^0.25 = 1.6818; ℓdb = 0.17 × (44.05/3.313)² = 30.05; ℓd = 20.03; ℓdh = 24.03 in.

### How verified
- `node tests/check-syntax.mjs "ACI Rebar Development Length.html"`: all scripts pass.
- Headless Chromium (KaTeX 0.16.9 and plotly.js-dist-min 2.27.0 from npm pack), main vs branch, 11 cases: the four check cases (tool = hand numbers to 0.01 in.); AASHTO #8 fy 80 ksi f′c 12 ksi top, epoxy 1.5, hook epoxy and ties, Atr 0.4 / s 6 / n 2, βt −0.3, excess 0.8, Class A (λrc 0.3081, ℓd 27.13, ℓdh 13.20 in.); #11 lightweight λ 0.85, f′c 11 ksi, R 5 in.; #14 fy 100, f′c 16 ksi, c_b 0; #4 fy 40 hook R 6 in. with excess (straight portion 0, ℓdh 6.25 in.); an older saved state; ACI default and ACI mixed (identical to main in every value, notice, dashboard, tab and report text). 0 KaTeX errors and no console errors on the branch; report builds 7 sections, every internal link resolves. Tension and hook tabs looked at in screenshots.
- **Other copies:** the Development & Splice tab of `Concrete Beam Capacity.html` (follow-up branch claude/aashto10-cbc-rebar). The same 5.10.8.2.1a / hook implementation is duplicated in `abutment_calculator.html` and `Retaining Wall Designer.html` (own PRs).

### Open items (not changed; engineer decision needed)
1. **Compression development (5.10.8.2.2a):** Eq. 5.10.8.2.2a-1 divides by λ; the tool does not (unconservative for lightweight concrete; a notice now says so). λrc = 0.75 for spirals/hoops (5.10.8.2.2b) is not offered (conservative). √f′c stays capped at √10 ksi (conservative). Apply λ?
2. **Hook bracket ≤ 0:** when Fh/Ab ≥ λer·fy the tool takes the straight portion as 0 (the squared form would otherwise give a positive length). Confirm this reading.
3. **#14/#18 hooks:** outside 5.10.8.2.4; the commentary mentions doubling ℓdh after ACI. Not implemented; flagged only.
4. **AASHTO compression lap splices of #14/#18:** the tool shows "not permitted" in compression too; 5.10.8.4.2a bars only *tension* laps above #11, and 5.10.8.4.5a allows #14/#18 to #11 and smaller in compression (pre-existing).
5. The ACI-mode references row still reads "AASHTO LRFD 5.10.2.1 (hook geometry; … edition: verify)" (ACI mode left untouched by request; 5.10.2.1 is verified in the 10th Ed.).

## 2026-11-01 — PR: claude/rpt-acirebar — Report output tab in the shared report viewer (RBRP; display only, no calculation change) (PR #536: https://github.com/mlococo88/All-Structural/pull/536)

The tool file uses CRLF line endings; keep them. Line numbers are approximate; search for the anchor text. Every code site is tagged `RBRP`.

### RBRP. "Report" output tab (shared/report.js, shared/steps.js)   [display only]
- **Engineer request (2026-11-01, report rollout):** an in-app Report output tab in the shared viewer used by the Steel Bridge app and Spread Footing: navigation tree down to the topics, numbered sections, worked steps (equation → substituted values → result, CLAUDE.md §6) grouped by topic (`SharedSteps.group`), "see §x.y" links and links back to the tool's tabs, and Print with a title block (no owner cell), running header and "Page X of Y".
- **Loads:** `<script src="shared/steps.js">` and `<script src="shared/report.js">` (classic scripts, relative path) after the CDN libraries. The tool now needs the `shared` folder next to it (it is in the repository). Without it only the Report tab shows a notice; every other tab is unaffected.
- **New code** (one block before the INIT banner, anchor `REPORT TAB (RBRP, 2026-11-01)`):
  - `rbrModel()` builds the report model; `rbrTension`, `rbrHook`, `rbrComp`, `rbrTSplice`, `rbrCSplice` write one step per equation card (`eqBlock`) of the tabs and per factor of their variable tables, ACI 318-19 and AASHTO LRFD 10th Ed. branches as on the tabs; `rbAashtoRc` is the λrc card (`aashtoRcBlock`).
  - `rbTopics()` groups each list into topics with `SharedSteps.group`; `rbrRender()` mounts the viewer; `rbrGoto()` handles the `[[tab:…]]` links (the tab button's `switchTab`).
  - Print hooks: `rbrWillPrint()` and a `beforeprint` listener (as Spread Footing's SFRP).
- **Changed lines:** the tab button `<button class="tab" data-tab="report">Report</button>`; `render()` returns early into `rbrRender()` while the Report tab is shown (anchor `if(RBRP.on){ rbrRender();`); `switchTab()` sets `RBRP.on` and keeps `currentTab` on the last result tab, so the Report tab is never saved in the autosave (`rebar_aci_autosave_v1` keeps its format and values); the D11 `beforeprint` listener returns when the Report tab prints itself; three CSS lines keep the report inside the output panel at narrow widths (`.outputpanel:has(.rp){min-width:0;}`).
- **Sections:** 1 Project and inputs (title block, design inputs, summary of results from `rebarResultRows` with a § link to each derivation, validation notices, assumptions); 2 Tension development (schematic, topics: modification factors, confinement, excess reinforcement, development length; AASHTO: excess, basic length, modification factors, confinement factor with w_c, E_c, n_s, k_tr, λrc, development length); 3 Standard hook (schematic; ACI: factors, ℓdh; AASHTO: hook force, factors, λrc, straight portion, ℓdh); 4 Compression development; 5 Tension lap splice (Class A eligibility, splice length); 6 Compression lap splice; 7 Bar development schedule (the `tabBatch` functions for every size); 8 References (`rebarRefs`).
- **Values:** every step `value` is the tool's own value (`computeFactors` → `f.*`, `calcTension`, `calcHook`, `calcComp`, `calcTensSplice`, `calcCompSplice`, `classAEligible`, `ktrHSCheck`). Only substitution strings are formatted. Display-only products shown inline as on the tabs: ψt·ψe before the 1.7 cap, F_h/A_b, D = (bend factor)·d_b.
- **§6 gap closed in the report only:** with the excess-reinforcement reduction on, the tension-splice base ℓd (without λer) was not worked anywhere (open item of the 2026-10-18 entry). The report works it from the same call `calcTensSplice` makes (`computeFactors`/`calcTension` with `useExcess:false`); the tabs are unchanged.
- **Saved data:** nothing new is saved; no key or format change. The collapsed sections are kept in memory (`RBRP.closed`).
- **Provision:** none. No formula, factor, unit, code reference or result changed.
- **Check case (default: ACI, #8, f_y 60,000 psi, f′c 4,000 psi, c_b 1.5 in., K_tr 0, Class B):** report steps ℓd = 47.43 in. (§2.1, step "Tension development length (12 in. minimum)"), ℓdh = 23.92 in., ℓdc = 18.97 in. (expression (a)), ℓst = 1.3 × 47.43 = 61.66 in., ℓsc = 30.00 in. — the tab values. Hand check ℓd: 3/40 × 60,000 × 1.0 × 1.0 × 1.0 / (1.0 × 63.25 × 1.50) × 1.000 = 47.43 in.
- **How verified (headless Chromium, KaTeX 0.16.9 and plotly.js-dist-min 2.27.0 from npm pack):**
  - 7 cases (default; ACI #11 Gr 80 lightweight λ 0.85 top epoxy K_tr, spacing 5 in., excess 1.0/2.5, Class A 50 %, confined hook, ψr 0.75; AASHTO #8 top epoxy excess 0.8/1.0 A_tr β_t −0.3; ACI #14 Gr 100 f′c 2,500 Class A; AASHTO #18 f′c 12 ksi lightweight λ 0.7 Gr 80; AASHTO #6 f′c 8 ksi confined coated hook R 1.5 in. Class A excess; ACI #5 f′c 12 ksi excess 1.2/1.0): 35–65 steps, 10–15 topics, 15–20 cross-references per report, 0 unresolved or duplicate references, 0 KaTeX errors, no raw TeX, no NaN / undefined in `SharedReport.text()`; 23–31 spot values per case equal the app's values exactly (ℓd, ℓd,calc, ℓdh, ℓdh,calc, 8d_b, ℓdc, (a), (b), ℓst, ℓst,calc, splice base, class factor, ℓsc, ℓsc,calc, λer, and per code K_tr, (c_b+K_tr)/d_b, ψtψe, ψg, √f′c, ψc, ψr, ψo or ℓdb, E_c, n_s, λrc, λrc,raw, λrlλcf, f′c^0.25, F_h, v, R, hook ℓd, ℓdb, λrc, λrlλcf, √f′c).
  - Building the report leaves `readInputs()` and the autosave unchanged; the autosave's `currentTab` is never "report".
  - main vs branch, same 7 cases: the text of the six result tabs, the dashboard, the autosave and the D11 print report (Ctrl+P from a result tab) identical.
  - § links jump to their step; `[[tab:…]]` links open the result tab; Ctrl+P on the Report tab prints the report alone with the @page running header (no D11 header); Ctrl+P from another tab prints the D11 report as before. 0 console errors. At 390 px the page no longer scrolls sideways on the Report tab (scrollWidth 390).
  - `node tests/check-syntax.mjs "ACI Rebar Development Length.html"`: all scripts pass. `node tests/engine/run.mjs report steps steps-groups report-wiring`: pass (shared files unchanged).
- **Other copies:** the Development & Splice tab of `Concrete Beam Capacity.html` (CLAUDE.md §3): synced in the next PR (claude/rpt-cbc). `shared/README.md` lists this tool as a user of `steps.js` and `report.js`.
- **Open items:** none new. The tabs' own open items (2026-10-19 entry) are unchanged; the report repeats the tabs' citations.

Diff (`ACI Rebar Development Length.html`, `git diff -U0` against origin/main):

```diff
diff --git a/ACI Rebar Development Length.html b/ACI Rebar Development Length.html
index be12315..75bfaab 100644
--- a/ACI Rebar Development Length.html	
+++ b/ACI Rebar Development Length.html	
@@ -13,0 +14,3 @@
+<!-- RBRP: shared worked steps and the shared report viewer (classic scripts, relative path: keep the shared folder next to this file) -->
+<script src="shared/steps.js"></script>
+<script src="shared/report.js"></script>
@@ -198,0 +202,4 @@ a.wkA:hover{text-decoration:underline;}
+/* RBRP: the Report tab stays within the output panel at narrow widths (its wide equations and tables scroll inside it) */
+.outputpanel:has(.rp){min-width:0;}
+@media(max-width:1000px){#tabcontent .rp-body{grid-template-columns:minmax(0,1fr);} #tabcontent .rp-doc{min-width:0;}}
+
@@ -263,0 +271 @@ a.wkA:hover{text-decoration:underline;}
+        <button class="tab" data-tab="report">Report</button>
@@ -1572,0 +1581 @@ function render(){
+  if(RBRP.on){ rbrRender(); fcHintUpdate(inp); updateCodeHint(inp); rebarInputTabMarks(w); autosave(); return; }   // RBRP: the Report tab (shared viewer)
@@ -1951 +1960,2 @@ function printReport(){
-window.addEventListener('beforeprint',()=>{ try{ buildReport(); rebarApplyPageCSS(true); }catch(e){} });
+window.addEventListener('beforeprint',()=>{ if(rbrWillPrint()) return;   /* RBRP: the Report tab prints itself (shared/report.js) */
+  try{ buildReport(); rebarApplyPageCSS(true); }catch(e){} });
@@ -1953,0 +1964,327 @@ window.addEventListener('afterprint',()=>{ try{ rebarApplyPageCSS(false); }catch
+/* =====================================================================
+   REPORT TAB (RBRP, 2026-11-01): the calculation report in the shared viewer (shared/report.js: navigation tree,
+   numbered sections §n.m, collapse / expand, search, Print with a title block, running header and page numbers).
+   Worked steps are shared/steps.js steps (equation → substituted values → result), one step per card equation of
+   the result tabs (eqBlock) and per factor of their tables, grouped by topic with SharedSteps.group.
+   Every value shown is a value the tool has already computed (computeFactors, calcTension, calcHook, calcComp,
+   calcTensSplice, calcCompSplice, classAEligible, ktrHSCheck, rebarResultRows); only the substitution strings are
+   formatted here. Nothing is saved: the Report tab is not stored as currentTab (RBRP.on is in memory only) and the
+   collapsed sections are kept in memory (RBRP.closed). Display only.
+   ===================================================================== */
+const RBRP={on:false,closed:new Set(),api:null,doc:null};
+const rbN=(x,d)=>SharedSteps.n(x,d==null?2:d);
+const rbG=(x,d)=>SharedSteps.g(x,d);
+const rbP=(x,d)=>(typeof x==='number'&&x<0)?'('+rbN(x,d)+')':rbN(x,d);   // a negative value in parentheses inside a substitution
+const RB_FC="f^{\\prime}_{c}";
+/* tab HTML (sub, b, entities) to report text: X<sub>y</sub> -> $X_{y}$ notation, other tags dropped */
+const rbPlain=s=>String(s==null?'':s).replace(/<sub>(.*?)<\/sub>/g,'$$_{$1}$$').replace(/<[^>]+>/g,'')
+  .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ');
+/* the code reference with its edition, from the tool's own short citation ("§25.4.2.4", "Eq. 5.10.8.2.1a-2") */
+const rbRef=(f,r)=>(f.AASHTO?'AASHTO LRFD 10th Ed. ':'ACI 318-19 ')+String(r||'').replace(/^§/,'');
+/* a steps item whose steps are grouped in topics (one topic per list entry, in order; SharedSteps.group gives each its
+   status and one-line result) */
+function rbTopics(scope,list,opt){
+  const L=list.filter(t=>t&&t.steps&&t.steps.length);
+  const steps=[].concat(...L.map(t=>t.steps));
+  const topics=L.map(t=>{ const g=SharedSteps.group(t.steps,[{key:'k',title:t.title,ref:t.ref,ids:()=>true}],{strip:false})[0];
+    return {title:t.title,ref:t.ref||'',n:t.steps.length,cls:g.cls,chip:g.chip,res:g.res}; });
+  return Object.assign({type:'steps',scope,steps,topics},opt||{});
+}
+const rbS=o=>SharedSteps.step(o);
+
+/* ---------- tension development (tabTension / tabTensionAASHTO) ---------- */
+function rbrTension(inp,f){
+  const t=calcTension(inp,f), T=[];
+  const ex=inp.useExcess?{title:'Excess reinforcement factor',ref:rbRef(f,f.AASHTO?'Eq. 5.10.8.2.1c-4 (λer)':'§25.4.10.1'),steps:[
+    rbS({id:'asReq',label:'Area of steel required by analysis (input)',sym:'A_{s,req}',value:inp.asReq,unit:'in^{2}'}),
+    rbS({id:'asProv',label:'Area of steel provided (input)',sym:'A_{s,prov}',value:inp.asProv,unit:'in^{2}'}),
+    rbS({id:'excess',label:'Excess reinforcement factor (never more than 1.0)',sym:f.AASHTO?'\\lambda_{er}':'\\text{factor}',eq:'\\min(\\frac{A_{s,req}}{A_{s,prov}},\\, 1.0)',
+      sub:'\\min(\\frac{'+rbN(inp.asReq)+'}{'+rbN(inp.asProv)+'},\\, 1.0)',value:f.excess,unit:'',d:3,note:f.excessRaw>1?'A_s,req > A_s,prov: the ratio '+rbN(f.excessRaw,3)+' is held at 1.0 (no reduction)':''})]}:null;
+  if(!f.AASHTO){
+    T.push({title:'Modification factors',ref:'ACI 318-19 Table 25.4.2.5, 25.4.2.4',steps:[
+      rbS({id:'psiT',label:'Casting position factor ('+(inp.topBar?'top bar: more than 12 in. of fresh concrete below':'not a top bar')+')',sym:'\\psi_{t}',value:f.psiT,unit:'',d:1}),
+      rbS({id:'psiE',label:'Epoxy coating factor (as selected)',sym:'\\psi_{e}',value:f.psiE,unit:'',d:1}),
+      rbS({id:'psiS',label:'Bar size factor (#6 and smaller 0.8, else 1.0; #'+inp.barSize+')',sym:'\\psi_{s}',value:f.psiS,unit:'',d:1}),
+      rbS({id:'psiG',label:'Reinforcement grade factor (f_y = '+rbG(inp.fy,0).replace('{,}',',')+' psi: Grade 40/60 1.0, 80 1.15, 100 1.30)',sym:'\\psi_{g}',value:f.psiG,unit:'',d:2}),
+      rbS({id:'lam',label:inp.lightweight?'Lightweight concrete factor (entered, limited to 0.75–1.0)':'Lightweight concrete factor (normal weight)',sym:'\\lambda',value:f.lambda,unit:'',d:2,ref:inp.lightweight?'ACI 318-19 Table 19.2.4.2':''}),
+      rbS({id:'psiTE',label:'Product limit on ψ_t·ψ_e',sym:'\\psi_{t}\\psi_{e}',eq:'\\min(\\psi_{t}\\psi_{e},\\, 1.7)',sub:'\\min('+rbN(f.psiT,1)+'\\times '+rbN(f.psiE,1)+',\\, 1.7)',value:f.psiTEcap,unit:'',d:2,ref:'ACI 318-19 25.4.2.4'})]});
+    const kH=ktrHSCheck(inp,f), cs=[
+      rbS({id:'cb',label:'Lesser of cover and half the center-to-center spacing (input)',sym:'c_{b}',value:inp.cb,unit:'in'}),
+      rbS({id:'db',label:'Bar diameter (#'+inp.barSize+')',sym:'d_{b}',value:f.db,unit:'in',d:3}),
+      rbS({id:'Ktr',label:'Transverse reinforcement index',sym:'K_{tr}',eq:'\\frac{40 A_{tr}}{s\\, n}',
+        sub:(inp.sTr>0&&inp.nBars>0)?'\\frac{40\\times '+rbN(inp.Atr)+'}{'+rbN(inp.sTr)+'\\times '+rbN(inp.nBars,0)+'}':'',value:f.Ktr,unit:'in',d:3,ref:'ACI 318-19 Eq. 25.4.2.4b',
+        note:(inp.sTr>0&&inp.nBars>0)?'':'s or n not entered: K_tr = 0'}),
+      rbS({id:'cbKtr',label:'Confinement term (limited to 2.5)',sym:'\\frac{c_{b}+K_{tr}}{d_{b}}',eq:'\\min(\\frac{c_{b}+K_{tr}}{d_{b}},\\, 2.5)',
+        sub:'\\min(\\frac{'+rbN(inp.cb)+' + '+rbN(f.Ktr,3)+'}{'+rbN(f.db,3)+'},\\, 2.5)',value:f.cbKtr,unit:'',d:2,ref:'ACI 318-19 25.4.2.4',note:f.cbKtrCapped?'limit applied: '+rbN(f.cbKtr_raw)+' > 2.5':''})];
+    if(kH.relevant) cs.push(rbS({id:'ktrHS',label:'K_tr ≥ 0.5 d_b for f_y ≥ 80,000 psi bars spaced closer than 6 in.',sym:'K_{tr}',
+      eq:kH.applies?'\\ge 0.5 d_{b}':'',sub:kH.applies?rbN(f.Ktr,3)+(kH.ok?' \\ge ':' \\lt ')+rbN(kH.req,3):'',value:kH.known?(kH.applies?f.Ktr:'not required (spacing ≥ 6 in.)'):'spacing not entered',unit:kH.applies?'in':'',d:3,
+      ok:kH.known&&kH.ok,ref:'ACI 318-19 25.4.2.2',note:kH.known?(kH.applies?'':'developed-bar spacing '+rbN(inp.barSpc)+' in.'):'enter the developed-bar c-c spacing (panel D) to check'}));
+    T.push({title:'Confinement term',ref:'ACI 318-19 25.4.2.4 (b)',steps:cs});
+    T.push(ex);
+    T.push({title:'Development length',ref:'ACI 318-19 Eq. 25.4.2.4a, 25.4.2.1',steps:[
+      rbS({id:'sqrtFc',label:'Square root of f′c (limited to 100 psi)',sym:'\\sqrt{'+RB_FC+'}',eq:'\\min(\\sqrt{'+RB_FC+'},\\, 100)',sub:'\\min(\\sqrt{'+rbG(inp.fc,0)+'},\\, 100)',value:f.sqrtFc,unit:'psi',d:2,ref:'ACI 318-19 25.4.1.4'}),
+      rbS({id:'ldcalc',label:'Tension development length, general equation',sym:'l_{d,calc}',
+        eq:'\\frac{3}{40}\\, \\frac{f_{y} \\psi_{t}\\psi_{e} \\psi_{s} \\psi_{g}}{\\lambda \\sqrt{'+RB_FC+'} (\\frac{c_{b}+K_{tr}}{d_{b}})}\\, d_{b}'+(inp.useExcess?'\\cdot \\frac{A_{s,req}}{A_{s,prov}}':''),
+        sub:'\\frac{3}{40}\\cdot \\frac{'+rbG(inp.fy,0)+'\\times '+rbN(f.psiTEcap)+'\\times '+rbN(f.psiS,1)+'\\times '+rbN(f.psiG)+'}{'+rbN(f.lambda)+'\\times '+rbN(f.sqrtFc)+'\\times '+rbN(f.cbKtr)+'}\\times '+rbN(f.db,3)+(inp.useExcess?'\\times '+rbN(f.excess,3):''),
+        value:t.ld_calc,unit:'in',ref:'ACI 318-19 Eq. 25.4.2.4a'}),
+      rbS({id:'ld',label:'Tension development length (12 in. minimum)',sym:'l_{d}',eq:'\\max(l_{d,calc},\\, 12\\, \\text{in.})',sub:'\\max('+rbN(t.ld_calc)+',\\, 12)',value:t.ld,unit:'in',ref:'ACI 318-19 25.4.2.1',note:t.governedByMin?'the 12 in. minimum governs':''})]});
+  } else {
+    T.push(ex);
+    T.push({title:'Basic development length',ref:'AASHTO LRFD 10th Ed. Eq. 5.10.8.2.1a-2',steps:[
+      rbS({id:'fy',label:'Yield strength',sym:'f_{y}',value:f.fy_ksi,unit:'ksi',d:1}),
+      rbS({id:'fcA',label:'Concrete strength used (limited to '+rbN(f.fcLimA,0)+' ksi'+(inp.lightweight?', lightweight':', normal weight')+')',sym:RB_FC,eq:'\\min('+RB_FC+',\\, '+rbN(f.fcLimA,0)+')',sub:'\\min('+rbN(f.fc_ksi)+',\\, '+rbN(f.fcLimA,0)+')',value:f.fcA,unit:'ksi',ref:'AASHTO LRFD 10th Ed. 5.10.8.2.1, C5.10.8.2.4'}),
+      rbS({id:'fc4',label:'Fourth root of f′c',sym:'('+RB_FC+')^{0.25}',eq:'',sub:rbN(f.fcA)+'^{0.25}',value:f.fc4,unit:'ksi^{0.25}',d:4}),
+      rbS({id:'db',label:'Bar diameter (#'+inp.barSize+')',sym:'d_{b}',value:f.db,unit:'in',d:3}),
+      rbS({id:'Ab',label:'Bar area',sym:'A_{b}',value:f.Ab,unit:'in^{2}'}),
+      rbS({id:'lam',label:'Concrete density modification factor',sym:'\\lambda',value:f.lambda,unit:'',d:2,ref:'AASHTO LRFD 10th Ed. 5.4.2.8'}),
+      rbS({id:'ldb',label:'Basic tension development length (straight bar: F_h = 0)',sym:'l_{db}',
+        eq:'0.17\\, d_{b} (\\frac{\\lambda_{er} f_{y} \\minus F_{h}/A_{b}}{1.97 \\lambda ('+RB_FC+')^{0.25}})^{2}',
+        sub:'0.17\\times '+rbN(f.db,3)+'\\times (\\frac{'+rbN(f.excess,3)+'\\times '+rbN(f.fy_ksi,1)+' \\minus 0/'+rbN(f.Ab)+'}{1.97\\times '+rbN(f.lambda)+'\\times '+rbN(f.fc4,4)+'})^{2}',
+        value:t.ldb,unit:'in',ref:'AASHTO LRFD 10th Ed. Eq. 5.10.8.2.1a-2',note:inp.useExcess?'λ_er: see §excess':''})]});
+    T.push({title:'Modification factors',ref:'AASHTO LRFD 10th Ed. 5.10.8.2.1b',steps:[
+      rbS({id:'lrl',label:'Reinforcement location factor ('+(inp.topBar?'top bar':'not a top bar')+')',sym:'\\lambda_{rl}',value:f.lam_rl,unit:'',d:1}),
+      rbS({id:'lcf',label:'Coating factor (as selected)',sym:'\\lambda_{cf}',value:f.lam_cf,unit:'',d:1}),
+      rbS({id:'rlcf',label:'Product limit on λ_rl·λ_cf',sym:'\\lambda_{rl}\\lambda_{cf}',eq:'\\min(\\lambda_{rl}\\lambda_{cf},\\, 1.7)',sub:'\\min('+rbN(f.lam_rl,1)+'\\times '+rbN(f.lam_cf,1)+',\\, 1.7)',value:f.lam_rlcf_cap,unit:'',d:2})]});
+    T.push({title:'Confinement factor',ref:'AASHTO LRFD 10th Ed. 5.10.8.2.1c',steps:rbAashtoRc(inp,f,f.ktr_a,f.lam_rc_raw,f.lam_rc,false)});
+    T.push({title:'Development length',ref:'AASHTO LRFD 10th Ed. Eq. 5.10.8.2.1a-1',steps:[
+      rbS({id:'ldcalc',label:'Tension development length',sym:'l_{d,calc}',eq:'l_{db}\\, \\lambda_{rl}\\lambda_{cf}\\, \\lambda_{rc}',sub:rbN(t.ldb)+'\\times '+rbN(f.lam_rlcf_cap)+'\\times '+rbN(f.lam_rc,4),value:t.ld_calc,unit:'in',ref:'AASHTO LRFD 10th Ed. Eq. 5.10.8.2.1a-1'}),
+      rbS({id:'ld',label:'Tension development length (12 in. minimum)',sym:'l_{d}',eq:'\\max(l_{d,calc},\\, 12\\, \\text{in.})',sub:'\\max('+rbN(t.ld_calc)+',\\, 12)',value:t.ld,unit:'in',ref:'AASHTO LRFD 10th Ed. 5.10.8.2.1a',note:t.governedByMin?'the 12 in. minimum governs':''})]});
+  }
+  return T;
+}
+/* λrc of AASHTO 5.10.8.2.1c (aashtoRcBlock): E_c, n_s, k_tr, λ_rc; tie=true: the hook's k_tr = 0 (5.10.8.2.4b), E_c and n_s from §2 */
+function rbAashtoRc(inp,f,k,raw,val,tie){
+  const L=[];
+  if(!tie) L.push(
+    rbS({id:'cb',label:'Lesser of cover to bar center and half the c-c bar spacing (input)',sym:'c_{b}',value:inp.cb,unit:'in',d:3}),
+    rbS({id:'bt',label:'Permanent transverse compression factor (−1 to 0)',sym:'\\beta_{t}',value:f.betaT,unit:'',d:2,note:f.betaTAdj?'entered value outside −1 to 0: limited':''}),
+    rbS({id:'wc',label:'Unit weight of normal weight concrete',sym:'w_{c}',eq:f.fcA<=5?'0.145 \\text{ for } '+RB_FC+' \\le 5\\, \\text{ksi}':'0.140 + 0.001\\, '+RB_FC,sub:f.fcA<=5?'':'0.140 + 0.001\\times '+rbN(f.fcA),value:f.wcA,unit:'kcf',d:4,ref:'AASHTO LRFD 10th Ed. Table 3.5.1-1'}),
+    rbS({id:'Ec',label:'Modulus of elasticity of concrete (K_1 = 1.0)',sym:'E_{c}',eq:'120{,}000\\, K_{1} w_{c}^{2.0} ('+RB_FC+')^{0.33}',sub:'120{,}000\\times 1.0\\times '+rbN(f.wcA,4)+'^{2}\\times '+rbN(f.fcA)+'^{0.33}',value:f.EcA,unit:'ksi',d:0,ref:'AASHTO LRFD 10th Ed. Eq. 5.4.2.4-1'}),
+    rbS({id:'ns',label:'Modular ratio (E_s = 29,000 ksi)',sym:'n_{s}',eq:'\\frac{E_{s}}{E_{c}}',sub:'\\frac{29{,}000}{'+rbG(f.EcA,0)+'}',value:f.nsA,unit:'',d:3,ref:'AASHTO LRFD 10th Ed. 5.4.3.2'}));
+  L.push(rbS({id:tie?'ktr':'ktr',label:'Transverse reinforcement index'+(tie&&f.ktr_a>0?' (taken as 0 with the hook tie reduction, 5.10.8.2.4b)':''),sym:'k_{tr}',eq:'\\frac{A_{tr}}{s\\, n}',
+    sub:(k===0&&f.ktr_a>0)?'':((inp.sTr>0&&inp.nBars>0)?'\\frac{'+rbN(inp.Atr)+'}{'+rbN(inp.sTr)+'\\times '+rbN(inp.nBars,0)+'}':''),value:k,unit:'in',d:4,ref:'AASHTO LRFD 10th Ed. Eq. 5.10.8.2.1c-3',
+    note:(k===0&&f.ktr_a>0)?'taken as 0 (hook tie reduction, 5.10.8.2.4b)':((inp.sTr>0&&inp.nBars>0)?'':'s or n not entered: k_tr = 0')}),
+   rbS({id:'rcraw',label:'Confinement factor before its limits',sym:'\\lambda_{rc,raw}',eq:'\\frac{d_{b} c_{b}}{(c_{b}(1 \\minus \\beta_{t}) + 1.67\\, n_{s} k_{tr})^{2}}',
+    sub:inp.cb>0?'\\frac{'+rbN(f.db,3)+'\\times '+rbN(inp.cb,3)+'}{('+rbN(inp.cb,3)+'\\times (1 \\minus '+rbP(f.betaT,2)+') + 1.67\\times '+rbN(f.nsA,3)+'\\times '+rbN(k,4)+')^{2}}':'',value:raw,unit:'',d:4,ref:'AASHTO LRFD 10th Ed. Eq. 5.10.8.2.1c-1',note:(inp.cb>0?'':'c_b ≤ 0: no confinement credit (1.0). ')+(tie?'c_b: see §cb; β_t: see §bt; n_s: see §ns':'')}),
+   rbS({id:'rc',label:'Confinement factor (0.3 ≤ λ_rc ≤ 1.0)',sym:'\\lambda_{rc}',eq:'\\min(\\max(\\lambda_{rc,raw},\\, 0.3),\\, 1.0)',sub:'\\min(\\max('+rbN(raw,4)+',\\, 0.3),\\, 1.0)',value:val,unit:'',d:4,ref:'AASHTO LRFD 10th Ed. Eq. 5.10.8.2.1c-2'}));
+  return L;
+}
+
+/* ---------- standard hook (tabHook / tabHookAASHTO) ---------- */
+function rbrHook(inp,f){
+  const h=calcHook(inp,f), T=[];
+  const gov=h.gov==='8db'?'8 d_b governs':(h.gov==='6in'?'6 in. governs':'');
+  const exS=inp.useExcess?[rbS({id:'excess',label:'Excess reinforcement factor',sym:f.AASHTO?'\\lambda_{er}':'\\text{factor}',value:f.excess,unit:'',d:3,note:'see §excess'})]:[];
+  if(!f.AASHTO){
+    T.push({title:'Modification factors',ref:'ACI 318-19 Table 25.4.3.2',steps:[
+      rbS({id:'psiE',label:'Epoxy coating factor (as selected)',sym:'\\psi_{e}',value:f.psiE_h,unit:'',d:1}),
+      rbS({id:'psiR',label:'Confining reinforcement factor ('+(inp.hookConfined?'confined':'not confined')+(f.psiRForced?'; #14/#18 take 1.6':'')+')',sym:'\\psi_{r}',value:f.psiR,unit:'',d:1}),
+      rbS({id:'psiO',label:'Location factor (as selected'+(f.psiOForced?'; #14/#18 take 1.25':'')+')',sym:'\\psi_{o}',value:f.psiO,unit:'',d:2}),
+      rbS({id:'psiC',label:'Concrete strength factor',sym:'\\psi_{c}',eq:'\\min(\\frac{'+RB_FC+'}{15{,}000} + 0.6,\\, 1.0)',sub:'\\min(\\frac{'+rbG(inp.fc,0)+'}{15{,}000} + 0.6,\\, 1.0)',value:f.psiC_h,unit:'',d:3}),
+      rbS({id:'lam',label:'Lightweight concrete factor',sym:'\\lambda',value:f.lambda,unit:'',d:2,note:'see §lam'})].concat(exS)});
+    T.push({title:'Hook development length',ref:'ACI 318-19 Eq. 25.4.3.1',steps:[
+      rbS({id:'ldhcalc',label:'Standard hook development length',sym:'l_{dh,calc}',eq:'\\frac{f_{y} \\psi_{e}\\psi_{r}\\psi_{o}\\psi_{c}}{55 \\lambda \\sqrt{'+RB_FC+'}}\\, d_{b}^{1.5}'+(inp.useExcess?'\\cdot \\frac{A_{s,req}}{A_{s,prov}}':''),
+        sub:'\\frac{'+rbG(inp.fy,0)+'\\times '+rbN(f.psiE_h,1)+'\\times '+rbN(f.psiR,1)+'\\times '+rbN(f.psiO)+'\\times '+rbN(f.psiC_h,3)+'}{55\\times '+rbN(f.lambda)+'\\times '+rbN(f.sqrtFc)+'}\\times '+rbN(f.db,3)+'^{1.5}'+(inp.useExcess?'\\times '+rbN(f.excess,3):''),
+        value:h.ldh_calc,unit:'in',note:'√f′c (limited to 100 psi): see §sqrtFc'}),
+      rbS({id:'min1',label:'Minimum 8 d_b',sym:'8 d_{b}',eq:'',sub:'8\\times '+rbN(f.db,3),value:h.min1,unit:'in'}),
+      rbS({id:'ldh',label:'Standard hook development length (minimum 8 d_b and 6 in.)',sym:'l_{dh}',eq:'\\max(l_{dh,calc},\\, 8 d_{b},\\, 6\\, \\text{in.})',sub:'\\max('+rbN(h.ldh_calc)+',\\, '+rbN(h.min1)+',\\, 6)',value:h.ldh,unit:'in',ref:'ACI 318-19 25.4.3.1',note:gov})]});
+  } else {
+    const H=[
+      rbS({id:'D',label:'Minimum finished bend diameter',sym:'D',eq:rbN(h.Dmin,0)+' d_{b}',sub:rbN(h.Dmin,0)+'\\times '+rbN(f.db,3),value:h.Dmin*f.db,unit:'in',d:3,ref:'AASHTO LRFD 10th Ed. Table 5.10.2.3-1'}),
+      h.Rentered?rbS({id:'R',label:'Bend radius to the bar centroid (entered)',sym:'R',value:h.R,unit:'in',d:3,note:h.R<h.Rmin-1e-9?'less than the minimum standard bend R = '+rbN(h.Rmin,3)+' in.':''})
+        :rbS({id:'R',label:'Bend radius to the bar centroid (minimum standard bend)',sym:'R',eq:'\\frac{D}{2} + \\frac{d_{b}}{2}',sub:'\\frac{'+rbN(h.Dmin,0)+'\\times '+rbN(f.db,3)+'}{2} + \\frac{'+rbN(f.db,3)+'}{2}',value:h.R,unit:'in',d:3,ref:'AASHTO LRFD 10th Ed. Table 5.10.2.3-1'}),
+      rbS({id:'fcA',label:'Concrete strength used',sym:RB_FC,value:f.fcA,unit:'ksi',note:'see §fcA'}),
+      rbS({id:'vraw',label:'Concrete efficiency factor, CTT node, before its limits',sym:'v_{raw}',eq:'0.85 \\minus \\frac{'+RB_FC+'}{20}',sub:'0.85 \\minus \\frac{'+rbN(f.fcA)+'}{20}',value:h.v_raw,unit:'',d:3,ref:'AASHTO LRFD 10th Ed. Table 5.8.2.5.3a-1'}),
+      rbS({id:'v',label:'Concrete efficiency factor (0.45 ≤ v ≤ 0.65)',sym:'v',eq:'\\min(\\max(v_{raw},\\, 0.45),\\, 0.65)',sub:'\\min(\\max('+rbN(h.v_raw,3)+',\\, 0.45),\\, 0.65)',value:h.v,unit:'',d:3,ref:'AASHTO LRFD 10th Ed. Table 5.8.2.5.3a-1'}),
+      rbS({id:'Fh',label:'Force developed by the hook',sym:'F_{h}',eq:'d_{b} R\\, v\\, '+RB_FC,sub:rbN(f.db,3)+'\\times '+rbN(h.R,3)+'\\times '+rbN(h.v,3)+'\\times '+rbN(f.fcA),value:h.Fh,unit:'kip',d:3,ref:'AASHTO LRFD 10th Ed. Eq. 5.10.8.2.4a-2'}),
+      rbS({id:'FhAb',label:'Hook force per unit bar area',sym:'F_{h}/A_{b}',eq:'',sub:'\\frac{'+rbN(h.Fh,3)+'}{'+rbN(f.Ab)+'}',value:h.Fh/f.Ab,unit:'ksi'})];
+    T.push({title:'Hook force',ref:'AASHTO LRFD 10th Ed. Eq. 5.10.8.2.4a-2',steps:H});
+    T.push({title:'Modification factors',ref:'AASHTO LRFD 10th Ed. 5.10.8.2.1b–c, 5.10.8.2.4b',steps:[
+      rbS({id:'lrl',label:'Reinforcement location factor (also for hooks)',sym:'\\lambda_{rl}',value:f.lam_rl,unit:'',d:1}),
+      rbS({id:'lcf',label:'Coating factor, hooked bar (1.2 if coated)',sym:'\\lambda_{cf}',value:h.cf,unit:'',d:1}),
+      rbS({id:'rlcf',label:'Product limit on λ_rl·λ_cf',sym:'\\lambda_{rl}\\lambda_{cf}',eq:'\\min(\\lambda_{rl}\\lambda_{cf},\\, 1.7)',sub:'\\min('+rbN(f.lam_rl,1)+'\\times '+rbN(h.cf,1)+',\\, 1.7)',value:h.rlcf,unit:'',d:2,ref:'AASHTO LRFD 10th Ed. 5.10.8.2.1b'}),
+      rbS({id:'conf',label:'Tie factor (0.8 with ties per 5.10.8.2.4b, #11 and smaller; else 1.0)',sym:'\\text{tie factor}',value:h.conf,unit:'',d:1,ref:'AASHTO LRFD 10th Ed. 5.10.8.2.4b'}),
+      rbS({id:'lam',label:'Concrete density modification factor',sym:'\\lambda',value:f.lambda,unit:'',d:2,note:'see §lam'})].concat(exS)});
+    T.push({title:'Confinement factor'+(h.ties?' (k_tr = 0, tie reduction taken)':''),ref:'AASHTO LRFD 10th Ed. 5.10.8.2.1c',steps:rbAashtoRc(inp,f,h.ties?0:f.ktr_a,h.lam_rc_h_raw,h.lam_rc_h,true)});
+    T.push({title:'Straight portion',ref:'AASHTO LRFD 10th Ed. Eqs. 5.10.8.2.1a-1, -2',steps:[
+      rbS({id:'ldb',label:'Basic development length with the hook force',sym:'l_{db}',eq:'0.17\\, d_{b} (\\frac{\\lambda_{er} f_{y} \\minus F_{h}/A_{b}}{1.97 \\lambda ('+RB_FC+')^{0.25}})^{2}',
+        sub:'0.17\\times '+rbN(f.db,3)+'\\times (\\frac{'+rbN(f.excess,3)+'\\times '+rbN(f.fy_ksi,1)+' \\minus '+rbN(h.Fh,3)+'/'+rbN(f.Ab)+'}{1.97\\times '+rbN(f.lambda)+'\\times '+rbN(f.fc4,4)+'})^{2}',
+        value:h.ldb,unit:'in',ref:'AASHTO LRFD 10th Ed. Eq. 5.10.8.2.1a-2',note:h.num<=0?'bracket ≤ 0: the hook develops the bar, l_db = 0':'(f′c)^0.25: see §fc4'}),
+      rbS({id:'ld',label:'Straight portion of the hooked bar',sym:'l_{d}',eq:'l_{db}\\, \\lambda_{rl}\\lambda_{cf}\\, \\lambda_{rc}',sub:rbN(h.ldb)+'\\times '+rbN(h.rlcf)+'\\times '+rbN(h.lam_rc_h,4),value:h.ld,unit:'in',ref:'AASHTO LRFD 10th Ed. Eq. 5.10.8.2.1a-1'})]});
+    T.push({title:'Hook development length',ref:'AASHTO LRFD 10th Ed. Eq. 5.10.8.2.4a-1',steps:[
+      rbS({id:'ldhcalc',label:'Hooked bar development length',sym:'l_{dh,calc}',eq:(h.ties?'0.8\\, ':'')+'(l_{d} + R + \\frac{d_{b}}{2})',sub:(h.ties?'0.8\\times ':'')+'('+rbN(h.ld)+' + '+rbN(h.R,3)+' + \\frac{'+rbN(f.db,3)+'}{2})',value:h.ldh_calc,unit:'in',ref:'AASHTO LRFD 10th Ed. Eq. 5.10.8.2.4a-1'+(h.ties?', 5.10.8.2.4b':'')}),
+      rbS({id:'min1',label:'Minimum 8 d_b',sym:'8 d_{b}',eq:'',sub:'8\\times '+rbN(f.db,3),value:h.min1,unit:'in'}),
+      rbS({id:'ldh',label:'Hooked bar development length (minimum 8 d_b and 6 in.)',sym:'l_{dh}',eq:'\\max(l_{dh,calc},\\, 8 d_{b},\\, 6\\, \\text{in.})',sub:'\\max('+rbN(h.ldh_calc)+',\\, '+rbN(h.min1)+',\\, 6)',value:h.ldh,unit:'in',ref:'AASHTO LRFD 10th Ed. 5.10.8.2.4a',note:gov})]});
+  }
+  return T;
+}
+
+/* ---------- compression development (tabComp / tabCompAASHTO) ---------- */
+function rbrComp(inp,f){
+  const c=calcComp(inp,f), T=[];
+  const gov=c.gov==='8in'?'the 8 in. minimum governs':(c.gov==='eqA'?'expression (a) governs':'expression (b) governs');
+  const exS=inp.useExcess?[rbS({id:'excess',label:'Excess reinforcement factor',sym:f.AASHTO?'\\lambda_{er}':'\\text{factor}',value:f.excess,unit:'',d:3,note:'see §excess'})]:[];
+  const tail=r=>[
+    rbS({id:'ldccalc',label:'Larger expression'+(inp.useExcess?', times the excess reinforcement factor':''),sym:'l_{dc,calc}',eq:'\\max(l_{dc,a},\\, l_{dc,b})'+(inp.useExcess?'\\cdot \\frac{A_{s,req}}{A_{s,prov}}':''),
+      sub:'\\max('+rbN(c.a)+',\\, '+rbN(c.b)+')'+(inp.useExcess?'\\times '+rbN(f.excess,3):''),value:c.ldc_calc,unit:'in'}),
+    rbS({id:'ldc',label:'Compression development length (8 in. minimum)',sym:'l_{dc}',eq:'\\max(l_{dc,calc},\\, 8\\, \\text{in.})',sub:'\\max('+rbN(c.ldc_calc)+',\\, 8)',value:c.ldc,unit:'in',ref:r,note:gov})];
+  if(!f.AASHTO){
+    T.push({title:'Governing expressions',ref:'ACI 318-19 25.4.9.2',steps:[
+      rbS({id:'psiR',label:'Confining reinforcement factor (as selected)',sym:'\\psi_{r}',value:f.psiR_c,unit:'',d:2,ref:'ACI 318-19 Table 25.4.9.3'}),
+      rbS({id:'lam',label:'Lightweight concrete factor',sym:'\\lambda',value:f.lambda,unit:'',d:2,note:'see §lam'}),
+      rbS({id:'sqrtFc',label:'Square root of f′c (limited to 100 psi)',sym:'\\sqrt{'+RB_FC+'}',value:f.sqrtFc,unit:'psi',note:'see §sqrtFc'})].concat(exS,[
+      rbS({id:'a',label:'Expression (a)',sym:'l_{dc,a}',eq:'\\frac{f_{y} \\psi_{r}}{50 \\lambda \\sqrt{'+RB_FC+'}}\\, d_{b}',sub:'\\frac{'+rbG(inp.fy,0)+'\\times '+rbN(f.psiR_c)+'}{50\\times '+rbN(f.lambda)+'\\times '+rbN(f.sqrtFc)+'}\\times '+rbN(f.db,3),value:c.a,unit:'in',ref:'ACI 318-19 25.4.9.2 (a)'}),
+      rbS({id:'b',label:'Expression (b)',sym:'l_{dc,b}',eq:'0.0003\\, f_{y} \\psi_{r} d_{b}',sub:'0.0003\\times '+rbG(inp.fy,0)+'\\times '+rbN(f.psiR_c)+'\\times '+rbN(f.db,3),value:c.b,unit:'in',ref:'ACI 318-19 25.4.9.2 (b)'})])});
+    T.push({title:'Compression development length',ref:'ACI 318-19 25.4.9.1',steps:tail('ACI 318-19 25.4.9.1')});
+  } else {
+    T.push({title:'Governing expressions',ref:'AASHTO LRFD 10th Ed. 5.10.8.2.2a',steps:[
+      rbS({id:'fy',label:'Yield strength',sym:'f_{y}',value:f.fy_ksi,unit:'ksi',d:1}),
+      rbS({id:'fc',label:'Concrete strength',sym:RB_FC,value:f.fc_ksi,unit:'ksi'}),
+      rbS({id:'sqrtFc',label:'Square root of f′c (f′c limited to 10 ksi)',sym:'\\sqrt{'+RB_FC+'}',eq:'\\min(\\sqrt{'+RB_FC+'},\\, \\sqrt{10})',sub:'\\min(\\sqrt{'+rbN(f.fc_ksi)+'},\\, \\sqrt{10})',value:f.sqrtFc_ksi,unit:'ksi^{0.5}',d:3}),
+      rbS({id:'db',label:'Bar diameter (#'+inp.barSize+')',sym:'d_{b}',value:f.db,unit:'in',d:3})].concat(exS,[
+      rbS({id:'a',label:'Expression (a)',sym:'l_{dc,a}',eq:'\\frac{0.63\\, d_{b} f_{y}}{\\sqrt{'+RB_FC+'}}',sub:'\\frac{0.63\\times '+rbN(f.db,3)+'\\times '+rbN(f.fy_ksi,1)+'}{'+rbN(f.sqrtFc_ksi,3)+'}',value:c.a,unit:'in',ref:'AASHTO LRFD 10th Ed. Eq. 5.10.8.2.2a-2'}),
+      rbS({id:'b',label:'Expression (b)',sym:'l_{dc,b}',eq:'0.3\\, d_{b} f_{y}',sub:'0.3\\times '+rbN(f.db,3)+'\\times '+rbN(f.fy_ksi,1),value:c.b,unit:'in',ref:'AASHTO LRFD 10th Ed. Eq. 5.10.8.2.2a-3'})])});
+    T.push({title:'Compression development length',ref:'AASHTO LRFD 10th Ed. Eq. 5.10.8.2.2a-1',steps:tail('AASHTO LRFD 10th Ed. Eq. 5.10.8.2.2a-1')});
+  }
+  return T;
+}
+
+/* ---------- tension lap splice (tabTSplice + classABlock) ---------- */
+function rbrTSplice(inp,f){
+  const t=calcTension(inp,f), s=calcTensSplice(inp,f,t), e=classAEligible(inp,f), T=[], A=f.AASHTO;
+  const cref=A?'AASHTO LRFD 10th Ed. 5.10.8.4.3a':'ACI 318-19 25.5.2.1';
+  const cl=[];
+  if(e.known){
+    cl.push(rbS({id:'clsRatio',label:'Provided steel at least twice that required',sym:'A_{s,prov}',eq:'\\ge 2 A_{s,req}',sub:rbN(inp.asProv)+(e.ratioOK?' \\ge ':' \\lt ')+'2\\times '+rbN(inp.asReq),value:inp.asProv,unit:'in^{2}',ok:e.ratioOK}),
+      rbS({id:'clsPct',label:'Share of A_s spliced within the lap length (input) at most 50 %',sym:'\\text{spliced}',eq:'\\le 50\\%',sub:rbN(inp.pctSpliced,0)+(e.pctOK?' \\le ':' \\gt ')+'50',value:inp.pctSpliced,unit:'%',d:0,ok:e.pctOK}));
+  }
+  const elig=e.known?(e.eligible?'Class A permitted':'Class A not permitted: Class B'):'cannot be verified (A_s,req / A_s,prov not entered): Class B assumed';
+  cl.push(rbS({id:'clsA',label:'Class A eligibility'+(inp.tensClass==='A'?' (Class A selected)':''),sym:'',value:elig,unit:'',ok:inp.tensClass==='A'?(e.known&&e.eligible):undefined,
+    note:inp.tensClass==='A'&&!(e.known&&e.eligible)?'Class A is selected but is not shown to qualify: the result is unconservative':''}));
+  T.push({title:'Class A eligibility',ref:cref,steps:cl});
+  const L=[];
+  if(inp.useExcess&&f.excess<1){
+    /* splice base: l_d without the excess-reinforcement reduction (calcTensSplice: the same calcTension with useExcess off) */
+    const i0=Object.assign({},inp,{useExcess:false}), f0=computeFactors(i0), t0=calcTension(i0,f0);
+    if(!A) L.push(rbS({id:'ldcalc0',label:'l_d by the general equation without the excess reinforcement factor (factor 1.0)',sym:'l_{d,calc}',
+      eq:'\\frac{3}{40}\\, \\frac{f_{y} \\psi_{t}\\psi_{e} \\psi_{s} \\psi_{g}}{\\lambda \\sqrt{'+RB_FC+'} (\\frac{c_{b}+K_{tr}}{d_{b}})}\\, d_{b}',
+      sub:'\\frac{3}{40}\\cdot \\frac{'+rbG(inp.fy,0)+'\\times '+rbN(f0.psiTEcap)+'\\times '+rbN(f0.psiS,1)+'\\times '+rbN(f0.psiG)+'}{'+rbN(f0.lambda)+'\\times '+rbN(f0.sqrtFc)+'\\times '+rbN(f0.cbKtr)+'}\\times '+rbN(f0.db,3),value:t0.ld_calc,unit:'in',ref:'ACI 318-19 Eq. 25.4.2.4a'}));
+    else L.push(rbS({id:'ldb0',label:'l_db without the excess reinforcement factor (λ_er = 1.0)',sym:'l_{db}',eq:'0.17\\, d_{b} (\\frac{f_{y}}{1.97 \\lambda ('+RB_FC+')^{0.25}})^{2}',
+        sub:'0.17\\times '+rbN(f0.db,3)+'\\times (\\frac{'+rbN(f0.fy_ksi,1)+'}{1.97\\times '+rbN(f0.lambda)+'\\times '+rbN(f0.fc4,4)+'})^{2}',value:t0.ldb,unit:'in',ref:'AASHTO LRFD 10th Ed. Eq. 5.10.8.2.1a-2'}),
+      rbS({id:'ldcalc0',label:'l_d without the excess reinforcement factor',sym:'l_{d,calc}',eq:'l_{db}\\, \\lambda_{rl}\\lambda_{cf}\\, \\lambda_{rc}',sub:rbN(t0.ldb)+'\\times '+rbN(f0.lam_rlcf_cap)+'\\times '+rbN(f0.lam_rc,4),value:t0.ld_calc,unit:'in',ref:'AASHTO LRFD 10th Ed. Eq. 5.10.8.2.1a-1'}));
+    L.push(rbS({id:'ldBase',label:'Splice base development length (12 in. minimum; no excess reinforcement reduction for splices)',sym:'l_{d}',eq:'\\max(l_{d,calc},\\, 12\\, \\text{in.})',sub:'\\max('+rbN(t0.ld_calc)+',\\, 12)',value:s.ldBase,unit:'in'}));
+  } else L.push(rbS({id:'ldBase',label:'Tension development length (splice base, without excess reinforcement reduction)',sym:'l_{d}',value:s.ldBase,unit:'in',note:'see §ld'}));
+  L.push(rbS({id:'factor',label:'Splice class factor (Class '+s.cls+': A 1.0, B 1.3)',sym:'\\text{factor}',value:s.factor,unit:'',d:1}),
+    rbS({id:'lstcalc',label:'Lap splice length',sym:'l_{st,calc}',eq:'\\text{factor}\\times l_{d}',sub:rbN(s.factor,1)+'\\times '+rbN(s.ldBase),value:s.lst_calc,unit:'in'}),
+    rbS({id:'lst',label:'Tension lap splice length, Class '+s.cls+' (12 in. minimum)',sym:'l_{st}',eq:'\\max(l_{st,calc},\\, 12\\, \\text{in.})',sub:'\\max('+rbN(s.lst_calc)+',\\, 12)',value:s.lst,unit:'in',ref:A?'AASHTO LRFD 10th Ed. 5.10.8.4.3a':'ACI 318-19 25.5.2'}));
+  if(lapProhibited(inp,f)) L.push(rbS({id:'lapOK',label:'Lap splice permitted for #'+inp.barSize+' bars',sym:'',value:'no: use a mechanical or welded splice (the length above is for reference only)',unit:'',ok:false,ref:A?'AASHTO LRFD 10th Ed. 5.10.8.4.2a':'ACI 318-19 25.5.1.1'}));
+  T.push({title:'Splice length',ref:A?'AASHTO LRFD 10th Ed. 5.10.8.4.3a':'ACI 318-19 25.5.2',steps:L});
+  return T;
+}
+
+/* ---------- compression lap splice (tabCSplice / tabCSpliceAASHTO) ---------- */
+function rbrCSplice(inp,f){
+  const s=calcCompSplice(inp,f), A=f.AASHTO, le=inp.fy<=60000, L=[];
+  if(!A) L.push(rbS({id:'lsccalc',label:'Compression lap splice length (f_y '+(le?'≤':'>')+' 60,000 psi'+(s.lowFc?'; ×4/3 for f′c < 3,000 psi':'')+')',sym:'l_{sc,calc}',
+      eq:(le?'0.0005\\, f_{y} d_{b}':'(0.0009\\, f_{y} \\minus 24)\\, d_{b}')+(s.lowFc?'\\cdot \\frac{4}{3}':''),
+      sub:(le?'0.0005\\times '+rbG(inp.fy,0)+'\\times '+rbN(f.db,3):'(0.0009\\times '+rbG(inp.fy,0)+' \\minus 24)\\times '+rbN(f.db,3))+(s.lowFc?'\\times \\frac{4}{3}':''),value:s.lsc_calc,unit:'in',ref:'ACI 318-19 25.5.5.1'}));
+  else L.push(rbS({id:'m',label:'Modification factor (1.0: no reduction for ties or spirals taken)',sym:'m',value:1.0,unit:'',d:1}),
+    rbS({id:'lsccalc',label:'Compression lap splice length (f_y '+(le?'≤':'>')+' 60 ksi'+(s.lowFc?'; ×4/3 for f′c < 3.0 ksi':'')+')',sym:'l_{sc,calc}',
+      eq:(le?'0.5\\, m\\, f_{y} d_{b}':'m\\, (0.9\\, f_{y} \\minus 24)\\, d_{b}')+(s.lowFc?'\\cdot \\frac{4}{3}':''),
+      sub:(le?'0.5\\times 1.0\\times '+rbN(f.fy_ksi,1)+'\\times '+rbN(f.db,3):'1.0\\times (0.9\\times '+rbN(f.fy_ksi,1)+' \\minus 24)\\times '+rbN(f.db,3))+(s.lowFc?'\\times \\frac{4}{3}':''),value:s.lsc_calc,unit:'in',ref:'AASHTO LRFD 10th Ed. 5.10.8.4.5a'}));
+  L.push(rbS({id:'lsc',label:'Compression lap splice length (12 in. minimum)',sym:'l_{sc}',eq:'\\max(l_{sc,calc},\\, 12\\, \\text{in.})',sub:'\\max('+rbN(s.lsc_calc)+',\\, 12)',value:s.lsc,unit:'in',ref:A?'AASHTO LRFD 10th Ed. 5.10.8.4.5a':'ACI 318-19 25.5.5.1'}));
+  if(lapProhibited(inp,f)) L.push(rbS({id:'lapOK',label:'Lap splice of #'+inp.barSize+' to #'+inp.barSize+' permitted',sym:'',value:'no: use a mechanical or welded splice (the length above is for reference only)',unit:'',ok:false,ref:A?'AASHTO LRFD 10th Ed. 5.10.8.4.2a':'ACI 318-19 25.5.1.1, 25.5.5.3'}));
+  return [{title:'Splice length',ref:A?'AASHTO LRFD 10th Ed. 5.10.8.4.5a':'ACI 318-19 25.5.5.1',steps:L}];
+}
+
+function rbrModel(){
+  const inp=readInputs(), f=computeFactors(inp), w=validate(inp,f), A=f.AASHTO, secs=[];
+  const codeName=A?'AASHTO LRFD 10th Ed. (2024) §5.10.8':'ACI 318-19';
+  const CARD_KEY={tLd:'td/ld',hLdh:'hk/ldh',cLdc:'cd/ldc',tsLen:'ts/lst',tsClassA:'ts/clsA',tConf:'td/ktrHS',csLen:'cs/lsc'};
+  const tabLink=(tab,txt)=>'[[tab:'+tab+'|'+txt+']]';
+  /* 1. Project and inputs */
+  {
+    const subs=[];
+    subs.push({title:'Project',items:[{type:'kv',rows:[['Project',inp.projName||'—'],['Project number',inp.projNo||'—'],
+      ['Calculated by',(inp.calcBy||'—')+(inp.calcDate?', '+inp.calcDate:'')],['Checked by',(inp.chkBy||'—')+(inp.chkDate?', '+inp.chkDate:'')],['Design code',codeName]]},
+      {type:'note',text:'Units: in., psi'+(A?' (ksi in the AASHTO equations)':'')+'. Every value in this report is the value the tool computes on its tabs ('+tabLink('tension','Tension l_d')+', '+tabLink('hook','Hook l_dh')+', '+tabLink('compression','Compression l_dc')+', '+tabLink('tsplice','Tension Splice')+', '+tabLink('csplice','Comp. Splice')+', '+tabLink('batch','Bar Schedule')+').'}]});
+    const yn=b=>b?'yes':'no';
+    const rows=[['Design code',codeName,'–'],['Bar size','#'+inp.barSize+' ($d_{b}$ = '+rbN(f.db,3)+' in., $A_{b}$ = '+rbN(f.Ab)+' in²)','–'],
+      ['Yield strength $f_{y}$',rbG(inp.fy,0).replace('{,}',','),'psi'],['Concrete strength $f^{\\prime}_{c}$',rbG(inp.fc,0).replace('{,}',','),'psi'],
+      ['Lightweight concrete',inp.lightweight?'yes ($\\lambda$ = '+rbN(f.lambda)+')':'no ($\\lambda$ = 1.00)','–'],['Top bar',yn(inp.topBar),'–'],
+      ['Coating factor (tension)',rbN(f.psiE,1),'–'],['$c_{b}$',rbN(inp.cb),'in'],['$A_{tr}$ / s / n',rbN(inp.Atr)+' / '+rbN(inp.sTr)+' / '+rbN(inp.nBars,0),'in² / in / –']];
+    if(A) rows.push(['$\\beta_{t}$',rbN(f.betaT),'–']);
+    rows.push(['Developed-bar c-c spacing',isFinite(inp.barSpc)&&inp.barSpc>0?rbN(inp.barSpc):'not entered','in'],
+      ['Excess reinforcement reduction',inp.useExcess?'on: $A_{s,req}$ = '+rbN(inp.asReq)+', $A_{s,prov}$ = '+rbN(inp.asProv)+' in²':'off','–'],
+      ['Hook: coating / location / confined',rbN(f.psiE_h,1)+' / '+rbN(parseFloat(inp.hookLoc))+' / '+yn(inp.hookConfined),'–']);
+    if(A) rows.push(['Hook bend radius R',isFinite(parseFloat(inp.hookR))&&parseFloat(inp.hookR)>0?rbN(parseFloat(inp.hookR),3):'minimum standard bend','in']);
+    else rows.push(['Compression $\\psi_{r}$',rbN(f.psiR_c),'–']);
+    rows.push(['Tension splice class / % spliced','Class '+inp.tensClass+' / '+rbN(inp.pctSpliced,0)+' %','–']);
+    subs.push({title:'Design inputs',items:[{type:'table',head:['Input','Value','Unit'],rows:rows.map(r=>[r[0],r[1],r[2]])}]});
+    const RR=rebarResultRows(inp,f,null), stc=s=>s==='PASS'?'ok':s==='FAIL'?'ng':s==='CHK'?'hi':'na';
+    subs.push({title:'Summary of results',items:[{type:'table',head:['Length or check','Value','Reference','Status'],
+      rows:RR.map(r=>[rbPlain(r.lab),{t:rbPlain(r.msg),key:r.card?CARD_KEY[r.card]:undefined},rbPlain(r.ref),{t:r.st,cls:stc(r.st)}])},
+      {type:'note',text:'Lengths are required lengths: the tool has no provided-length input, so they carry no pass / fail (—); compare them with the lengths detailed. CHK: needs attention (not checked by the tool, or an input is missing).'}]});
+    if(w.length) subs.push({title:'Validation notices',items:w.map(x=>({type:'note',warn:true,text:rbPlain(x)}))});
+    if(String(inp.assumptions||'').trim()) subs.push({title:'Engineering assumptions',items:[{type:'note',text:String(inp.assumptions).trim()}]});
+    secs.push({title:'Project and inputs',subs});
+  }
+  /* 2.–6. the result tabs */
+  const sch='<svg'+(schematicSVG(inp,f).split('<svg')[1]||'');
+  const hk=hookSchematic(inp,f,calcHook(inp,f)), hsvg=(hk.match(/<svg[\s\S]*<\/svg>/)||[''])[0];
+  secs.push({title:'Tension development',subs:[{title:'Tension development length $l_{d}$',items:[
+    {type:'figure',svg:sch,caption:'Input schematic: bar in section (c_b controls)'},
+    rbTopics('td',rbrTension(inp,f),{title:'Worked steps'}),{type:'note',text:'On screen: '+tabLink('tension','Tension l_d tab')+' (with the sensitivity charts).'}]}]});
+  secs.push({title:'Standard hook',subs:[{title:'Standard hook development length $l_{dh}$',items:[
+    {type:'figure',svg:hsvg,caption:'Hook geometry (90° standard hook, schematic; '+(A?'AASHTO 5.10.2.1':'ACI 318-19 25.3.1')+')'},
+    rbTopics('hk',rbrHook(inp,f),{title:'Worked steps',see:'td'}),{type:'note',text:'On screen: '+tabLink('hook','Hook l_dh tab')+'.'}]}]});
+  secs.push({title:'Compression development',subs:[{title:'Compression development length $l_{dc}$',items:[
+    rbTopics('cd',rbrComp(inp,f),{title:'Worked steps',see:'td'}),{type:'note',text:'On screen: '+tabLink('compression','Compression l_dc tab')+'.'}]}]});
+  secs.push({title:'Tension lap splice',subs:[{title:'Tension lap splice length $l_{st}$',items:[
+    rbTopics('ts',rbrTSplice(inp,f),{title:'Worked steps',see:'td'}),{type:'note',text:'On screen: '+tabLink('tsplice','Tension Splice tab')+'.'}]}]});
+  secs.push({title:'Compression lap splice',subs:[{title:'Compression lap splice length $l_{sc}$',items:[
+    rbTopics('cs',rbrCSplice(inp,f),{title:'Worked steps'}),{type:'note',text:'On screen: '+tabLink('csplice','Comp. Splice tab')+'.'}]}]});
+  /* 7. bar schedule (tabBatch: the same functions for every bar size) */
+  {
+    const rows=BAR_ORDER.map(b=>{
+      const bi=Object.assign({},inp,{barSize:b}), bf=computeFactors(bi);
+      const t=calcTension(bi,bf), h=calcHook(bi,bf), c=calcComp(bi,bf), ts=calcTensSplice(bi,bf,t), cs=calcCompSplice(bi,bf), np=lapProhibited(bi,bf);
+      const n1=v=>({t:rbN(v,1),n:true});
+      return {cells:['#'+b,{t:rbN(BAR[b].d,3),n:true},n1(t.ld),n1(h.ldh),n1(c.ldc),np?{t:'N/P*',n:true}:n1(ts.lst),np?{t:'N/P*',n:true}:n1(cs.lsc)],cls:b===inp.barSize?'gov':''};
+    });
+    secs.push({title:'Bar development schedule',subs:[{title:'Development and splice lengths, all bar sizes',items:[
+      {type:'table',head:['Bar','$d_{b}$ (in.)','Tension $l_{d}$','Hook $l_{dh}$','Comp. $l_{dc}$','Tens. splice ('+inp.tensClass+')','Comp. splice'],rows,wide:true},
+      {type:'note',text:'All lengths in inches, rounded to 0.1 in., computed with the inputs above for each bar size (bold: the selected #'+inp.barSize+'; its lengths are worked in [[td/ld]], [[hk/ldh]], [[cd/ldc]], [[ts/lst]], [[cs/lsc]]). '+(inp.useExcess?'Excess reinforcement reduction (×'+rbN(f.excess,3)+') applied to development lengths, not to splices. ':'')+(A?'*N/P = lap splices not used for bars larger than No. 11 (AASHTO 5.10.8.4.2a).':'*N/P = lap splice not permitted (ACI 318-19 25.5.1.1).')+' On screen: '+tabLink('batch','Bar Schedule tab')+'.'}]}]});
+  }
+  /* 8. references */
+  secs.push({title:'References',subs:[{title:'Codes and articles cited',items:[{type:'table',head:['Reference','Provisions used'],rows:rebarRefs(inp,f).map(r=>[rbPlain(r[0]),rbPlain(r[1])])}]}]});
+  return {title:'Rebar Development & Splice Calculation',subtitle:(inp.projName||'Untitled')+' — #'+inp.barSize+' bar, fy = '+rbG(inp.fy,0).replace('{,}',',')+' psi, f′c = '+rbG(inp.fc,0).replace('{,}',',')+' psi',code:codeName,
+    info:[['Project',inp.projName],['Project No.',inp.projNo],['Calculated by',inp.calcBy],['Date',inp.calcDate],['Checked by',inp.chkBy],['Checked date',inp.chkDate]],
+    head:{left:'Project No. '+(inp.projNo||'—')+' — '+String(inp.projName||'—').slice(0,40),right:'Computed: '+(inp.calcBy||'—')+' '+(inp.calcDate||'')+' · Checked: '+(inp.chkBy||'—')+' '+(inp.chkDate||''),
+      foot:(inp.projName||'Untitled')+' ('+REBAR_RPT_TOOL+')'},
+    sections:secs};
+}
+function rbrRender(){
+  const T=document.getElementById('tabcontent'); if(!T) return;
+  if(!window.SharedReport||!window.SharedSteps){ T.innerHTML='<div class="warnbox"><b>Report not available:</b> shared/report.js or shared/steps.js is not loaded. Keep the shared folder next to this file.</div>'; RBRP.api=null; RBRP.doc=null; return; }
+  let M; try{ M=rbrModel(); }catch(e){ T.innerHTML='<div class="warnbox"><b>Report error:</b> '+escHTML(e&&e.message)+'</div>'; RBRP.api=null; RBRP.doc=null; return; }
+  const top=T.scrollTop;
+  const two=rbrTwoPanel();
+  RBRP.api=SharedReport.mount(T,M,{closed:RBRP.closed,onGoto:rbrGoto,stick:two?-16:0}); RBRP.doc=RBRP.api.doc;   // two-panel layout: the bar sticks at the top of #tabcontent, over its 16 px padding
+  T.scrollTop=top;   // a rebuild while typing keeps the place in the report
+  if(!T.__rbrKeep){ T.__rbrKeep=true;   // two-panel layout: a jump inside the report scrolls #tabcontent only, never the page (as rebarGoto)
+    T.addEventListener('click',()=>{ if(!RBRP.on||!rbrTwoPanel()) return; const x=window.scrollX,y=window.scrollY; setTimeout(()=>{ if(window.scrollY!==y||window.scrollX!==x) window.scrollTo(x,y); },0); },true); }
+}
+function rbrTwoPanel(){ return !!(window.matchMedia&&window.matchMedia('(min-width:981px)').matches); }
+/* [[tab:…]] links of the report: a result tab (as its tab button) */
+function rbrGoto(name){ if(REBAR_CARDS[name]) rebarGoto(name); else switchTab(name); }
+/* Ctrl+P while the Report tab is shown prints the report alone (shared/report.js print layout and running header) */
+function rbrPrinting(){ return document.body.classList.contains('rp-printing'); }
+function rbrWillPrint(){ return rbrPrinting()||!!(RBRP.on&&RBRP.doc); }
+window.addEventListener('beforeprint',()=>{
+  if(!RBRP.on||!RBRP.doc||rbrPrinting()) return;
+  let box=document.getElementById('rp-print'); if(!box){ box=document.createElement('div'); box.id='rp-print'; document.body.appendChild(box); }
+  box.innerHTML='<div class="rp"><article class="rp-doc">'+SharedReport.html(RBRP.doc,{lazy:false})+'</article></div>';
+  document.body.classList.add('rp-printing');
+});
+
@@ -1958 +2295,2 @@ function switchTab(name){
-  currentTab=name;
+  RBRP.on=name==='report';   // RBRP: the Report tab is not stored as currentTab (not saved)
+  if(!RBRP.on) currentTab=name;
```

## 2026-11-01 — PR: claude/rpt-cbc — no change to this file
- The RBRP Report tab of this tool (entry above) is synced to the Development & Splice tab of `Concrete Beam Capacity.html` (CLAUDE.md §3), whose combined Report tab also uses `rbrModel()` as its "C. Development & Splice" chapter. Tools that contain the snippet: `ACI Rebar Development Length.html`, `Concrete Beam Capacity.html`.

## 2026-11-01 — PR: claude/cbc-hide-dev-report — no change to this file
- Inside `Concrete Beam Capacity.html` the embedded copy of this tool no longer shows its own Report tab button (the suite's combined Report tab covers it); this file keeps its Report tab. Recorded as an intentional embedded difference (CLAUDE.md §3). Tools that contain the snippet: `ACI Rebar Development Length.html`, `Concrete Beam Capacity.html`.

## 2026-11-01 — PR: claude/rpt-onscreen-print — Report tab: no "On screen: ." in the printed report (RBRP-2; display only; synced to Concrete Beam Capacity.html)
- **Problem:** the viewer (shared/report.js) hides in-app tab links in print, so notes written as "On screen: <tab link>." printed "On screen: ." and the Project note printed "… on its tabs (, , , , , )."
- **Fix (rbrModel, display only):** each "On screen" note is one link whose text is the whole phrase: `'On screen: '+tabLink('tension','Tension l_d tab')+' (with the sensitivity charts).'` → `tabLink('tension','On screen: Tension l_d tab (with the sensitivity charts)')`; the same for hook, compression, tsplice, csplice and, in the bar-schedule note, `+' On screen: '+tabLink('batch','Bar Schedule tab')+'.'` → `+' '+tabLink('batch','On screen: Bar Schedule tab')`. The Project note lists the tab names as text: "… computes on its result tabs (Tension l_d, Hook l_dh, Compression l_dc, Tension Splice, Comp. Splice, Bar Schedule); each section links to its tab." On screen the links are the same; in print the link notes are left out entirely.
- **Applied by script** (scratchpad `onscreen.py`): regex `'( ?)On screen: '\+tabLink\(('…'),'…'\)\+'( \(…\))?\.'` and the literal Project-note replacement.
- **Other copies (CLAUDE.md §3):** the Development & Splice tab of `Concrete Beam Capacity.html` gets the same edits in the same PR. Tools that contain the snippet: `ACI Rebar Development Length.html`, `Concrete Beam Capacity.html`. Standalone ↔ embedded line diff unchanged (141 lines of intentional differences before and after).
- **How verified:** printed report text (Ctrl+P on the Report tab, print media): main had "On screen: ." fragments; the branch has none and prints no link fragments. Report checks (7 cases: refs, KaTeX, NaN, spot values) and main-vs-branch tab texts / autosave / D11 print unchanged. **Provision:** none. **Saved data:** none.
