# Fix log — Moving Load Generator.html

Governing basis used for fixes: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024): Table 3.4.1-1 (load factors), Art. 3.6.1.4 / C3.6.1.1.2 (fatigue truck and its distribution). No formula, factor value or analysis result was changed in this PR.

## 2026-10-04 — PR: claude/fix-moving-load (PR link added after merge)

Verification method for every item: the page was loaded in jsdom from origin/main and from this branch, and the analysis results (every tenth point ±M, ±V and every reaction, factored per girder) were compared. For the default 2 × 100 ft HL-93 case and for the Fatigue preset, the results are **identical** before and after. `node --check` passes on the inline script. The file keeps its CRLF line endings.

### F1. Fatigue truck analysed with the strength DF / LLF, with no warning   [display] [no result change]
- **Where:** function `analyze`, warning list (≈ line 618). Anchor text: `if(m.short==='Fatigue'){const ll=m.llf`
- **Problem:** the same DF table, which includes multiple presence, and the same LLF are applied to every vehicle, including the "LRFD Fatigue Truck" preset and the "All presets / Highway" report. Fatigue needs the one-lane DF ÷ 1.2 and γ = 1.75 / 0.80. Nothing told the user.
- **Per-vehicle hook?** There is none. Presets carry axles, uniform load, impact and multi-vehicle rules, but no LLF or DF. The LLF and DFs are shared by every vehicle, including every vehicle in the report. So, as the brief allows, this is a **warning only**. It shows in the main warning box and in each report section for that vehicle (`R.warn`). Setting the LLF on preset selection would not help: the default Strength I is already 1.75 (= Fatigue I), and the problem is the DF.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 3.6.1.4.3b and C3.6.1.1.2 (one-lane DF, multiple presence removed); Table 3.4.1-1 (Fatigue I γ = 1.75, Fatigue II γ = 0.80).
- **Before:**
  ```js
    if(m.axles.some(a=>!(a[0]>0))) warn.push('One or more axles have zero or negative load.');
  ```
- **After:**
  ```js
    if(m.axles.some(a=>!(a[0]>0))) warn.push('One or more axles have zero or negative load.');
    if(m.short==='Fatigue'){const ll=m.llf,fl=Math.abs(ll-1.75)<1e-9||Math.abs(ll-0.80)<1e-9;
      warn.push(`LRFD fatigue truck: the distribution factors and live load factor entered (LLF = ${ll}) are applied exactly as given. For fatigue use the ONE-LANE distribution factor divided by 1.2 to remove the multiple presence factor (LRFD 3.6.1.4.3b, C3.6.1.1.2), not the strength (multi-lane) DF, and γ = 1.75 (Fatigue I) or 0.80 (Fatigue II), Table 3.4.1-1.${fl?'':' The current LLF is not a fatigue load factor.'}`);}
  ```
- **Check case:** default 2 × 100 ft, preset "LRFD Fatigue Truck". Before: no warning. After: the warning shows. Envelope values are identical before and after.
- **How verified:** jsdom (old vs new).
- **Other copies of this code:** none known.

### F2. HS20 / H20 presets not labelled as truck-only   [display] [no result change]
- **Where:** `const P={…}` presets (≈ line 269). Anchor text: `'HS20':HW('HS20 Truck — truck only`
- **Problem:** the presets model the truck only. They do not model the AASHTO Standard Specifications lane load (0.64 klf + 18 k moment / 26 k shear concentrated load), which can govern long spans, and the label did not say so.
- **Governing provision:** AASHTO Standard Specifications 17th Ed. Art. 3.7 (lane loading), for context only.
- **Before:**
  ```js
    'HS20':HW('HS20 Truck',[[8,0],[32,14],[32,14]],{udl:NOUDL,vary:{k:3,min:14,max:30},neglect:false,imp:{method:'const',val:1.30,onUdl:false}}),
    'H20':HW('H20 Truck',[[8,0],[32,14]],{udl:NOUDL,neglect:false,imp:{method:'const',val:1.30,onUdl:false}}),
  ```
- **After:**
  ```js
    'HS20':HW('HS20 Truck — truck only (no Std. Spec. lane load)',[[8,0],[32,14],[32,14]],{udl:NOUDL,vary:{k:3,min:14,max:30},neglect:false,imp:{method:'const',val:1.30,onUdl:false}}),
    'H20':HW('H20 Truck — truck only (no Std. Spec. lane load)',[[8,0],[32,14]],{udl:NOUDL,neglect:false,imp:{method:'const',val:1.30,onUdl:false}}),
  ```
  The preset keys `'HS20'` / `'H20'` are unchanged.
- **Check case:** label only. The closed-form benchmark (which loads HS20) is unaffected.
- **How verified:** jsdom (preset list text).
- **Other copies of this code:** none known.

### F3. Service III live-load factor added to the limit-state list; Service IV not added   [display] [no result change]
- **Where:** the "ADDED UI" block (≈ line 877). Anchor text: `Service III / Fatigue II (0.80)`
- **Problem:** Service III (γ_LL = 0.80) was missing.
- **Governing provision:** AASHTO LRFD 10th Ed. Table 3.4.1-1 and Table 3.4.1-4. Service III γ_LL = 0.80 in general; it is 1.00 for prestressed components designed using refined estimates of time-dependent losses together with elastic gains.
- **Service IV, not added (NOT A BUG / no change):** in Table 3.4.1-1 the Service IV row (tension in prestressed concrete columns) has **no live load** (LL, IM, CE, BR, PL, LS = "—"). The 0.70 in that row is the WS (wind on structure) factor, so a "Service IV (0.70)" live-load option would be wrong.
- **Before:**
  ```js
  $('lls').options[4].insertAdjacentHTML('beforebegin','<option value="0.80">Fatigue II (0.80)</option>');
  ```
- **After:** (one option for 0.80, following the existing "Strength I / Fatigue I (1.75)" pattern. Two options with the same value would make the LLF → limit-state back-mapping ambiguous.)
  ```js
  $('lls').options[4].insertAdjacentHTML('beforebegin','<option value="0.80">Service III / Fatigue II (0.80)</option>');
  ```
- **Check case:** selecting it sets LLF = 0.80, exactly as "Fatigue II (0.80)" did before.
- **How verified:** jsdom (option list).
- **Other copies of this code:** none known.

### F4. E ≤ 0 produced NaN results reported as "Solved"   [robustness] [no result change for valid inputs]
- **Where:** start of function `analyze` (≈ line 400), and the `catch` in `run()` (≈ line 1510). Anchor text: `E must be greater than 0`
- **Problem:** E = 0 makes the stiffness matrix singular. The LU solve has no pivoting, so it gives NaN, the status still said "Solved in … ms", and the headline +M showed 0.0. (A negative E gives the same M/V/R but negative deflections.) The span lengths are already clamped to ≥ 1 ft in `readModel`; the span check was added as defence for the benchmark/report paths that build `m` directly.
- **Governing provision:** n/a
- **Before:**
  ```js
  function analyze(m){
    const ns=m.spans.length, sup=[0];
  ...
    catch(err){$('status').textContent='Error: '+err.message;console.error(err);}
  }
  ```
- **After:**
  ```js
  function analyze(m){
    if(!(m.E>0)) throw new Error(`E steel = ${m.E} ksi. E must be greater than 0 (the stiffness matrix is singular otherwise).`);
    if(!m.spans.length||m.spans.some(l=>!(l>0))) throw new Error('Every span length must be greater than 0.');
    const ns=m.spans.length, sup=[0];
  ...
    catch(err){$('status').textContent='Error: '+err.message;console.error(err);
      ['mMp','mMn','mVp','mVn','mR'].forEach(id=>{const e=$(id);if(e)e.textContent='—';});
      $('warns').classList.remove('hidden');$('warns').innerHTML='⚠ Analysis not run: '+esc(err.message)+'<br>⚠ The plots and tables below are from the previous run and are NOT current.';}
  }
  ```
- **Check case:** E = 0. Before: status "Solved in 200 ms", +M = 0.0. After: status "Error: E steel = 0 ksi…", the headline values show "—", and a warning box says that the plots are not current.
- **How verified:** jsdom (old vs new).
- **Other copies of this code:** none known.

### F5. No persistence: autosave and JSON save/load added   [robustness] [no result change]
- **Where:** new block `SAVE / LOAD (autosave + JSON file)` just before the final init line (≈ line 1535), and the init line itself. Anchor text: `const MLG_KEY='movingLoadGen.autosave.v1'`
- **Problem:** all inputs were lost on reload, and there was no file save.
- **What was added:**
  - The localStorage key **`movingLoadGen.autosave.v1`**. It is new and tool-prefixed; no earlier key or format existed, so no migration is needed.
  - The saved data is `{app, schema:'movingLoadGen.v1', savedAt, nSpans, axles, segs, fields}`, where `fields` holds every `aside` input/select by id plus the deflection-card inputs, the view mode and the report project/by fields.
  - Header buttons **Save JSON**, **Open JSON** and **New**. New clears the autosave and reloads the defaults.
  - The autosave runs (debounced) on any input/change and after every analysis run.
  - If the autosave is corrupt, it is ignored and the page falls back to the defaults.
- **Governing provision:** n/a
- **Before:**
  ```js
  initSelects(); renderSpans(); $('preset').value='HL93-Truck'; applyPreset('HL93-Truck'); renderSegs(); syncVis(); run();
  ```
- **After:** (the full block is in the file, between `// ═══════════ SAVE / LOAD` and the init line; the init line becomes)
  ```js
  initSelects(); renderSpans(); $('preset').value='HL93-Truck'; applyPreset('HL93-Truck'); renderSegs(); syncVis(); mlgRestore(); run();
  ```
- **Check case:** set 3 spans 90/110/90, DF 0.62, preset HS20, E = 29,500, custom-as-rail, deflection DF 0.44, and two girder segments, then run. A page reloaded with that autosave restores every field and gives **identical** envelope and reaction values. `mlgApply` of the same JSON on a fresh page also gives identical values. A corrupt autosave (`{"schema":"x"}`) loads the defaults with no error.
- **How verified:** jsdom round-trip.
- **Other copies of this code:** none known.

## Open items (not changed)
- O1. **HS20 / H20 impact** is a constant 1.30 (the Std. Spec. maximum). Using I = 50/(L + 125) ≤ 0.30 would lower it for spans over 41.7 ft. This is conservative, so it was not changed. The Std. Spec. **lane load** is not modelled (now labelled). Adding an HS20 lane-load preset (0.64 klf + 18 k / 26 k concentrated loads, which need separate moment/shear handling) would be a new feature. Do you want it?
- O2. **Per-vehicle DF/LLF for fatigue.** The proper fix is a fatigue DF set (one-lane ÷ 1.2), like the existing rail DF set, applied automatically when the fatigue truck is analysed, including in the report. This needs a UI addition and is a design decision. Recommended.
- O3. **dfNeg applies to every negative moment**, including the reversal moments in positive-moment regions. Minor, and usually conservative. Not changed.
- O4. **Blank E or blank span length silently falls back to the default** (29,000 ksi / 100 ft) through `num()`. Not singular, so not changed; it could get a warning if wanted.
- O5. **Edition label.** The page does not state the AASHTO edition. Label-only, not changed.
- O6. **Dead code:** the original `exportCsv` near the end of the file is overridden earlier by the "CSV with |V|" version. Left as is (no behaviour change).
