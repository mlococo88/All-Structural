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

## 2026-10-04 — PR: claude/step1-group1 (PR link added after merge)

Feature (no result change): "← All tools" link to `tools.html` (`target="_top"`, hidden in print) and the shared project info buttons. No formula, factor, unit, storage key or saved format changed. New storage written only on "Share project info": `bridgeSuite.v1.projectMeta` and `bridgeSuite.v1.projectMeta.updatedAt` (HANDOFF.md §2/§4.1). The file keeps its CRLF line endings.

Field mapping: projectName ↔ Project (`rProj`), preparedBy ↔ Computed by (`rBy`); both are in the Print Report dialog. Other fields: not in this tool. Writes set the value and dispatch `input`, which runs the existing autosave (`movingLoadGen.autosave.v1`, already includes rProj/rBy).

### S1. Print rule for the link   [feature (no result change)]
- **Where:** top `<style>` block (≈ line 62). Anchor text: `@media(max-width:900px){.body{`
- **Problem:** none (feature). Approved step 1 of the cross-tool work: "← All tools" link and shared project info (HANDOFF.md §4.1).
- **Governing provision:** n/a (no calculation, factor, unit or code reference touched).
- **Before:**
  ```css
  @media(max-width:900px){.body{grid-template-columns:1fr}aside{position:static;max-height:none}.mets{grid-template-columns:repeat(2,1fr)}}
  </style>
  ```
- **After:**
  ```css
  @media(max-width:900px){.body{grid-template-columns:1fr}aside{position:static;max-height:none}.mets{grid-template-columns:repeat(2,1fr)}}
  @media print{.bx-alltools{display:none!important}}
  </style>
  ```
- **Check case:** n/a, no computed value changes. Functional check: see How verified.
- **How verified:** `node --check` on every plain inline script and @babel/standalone transpile of the text/babel block; BridgeXfer copy compared byte-for-byte with HANDOFF.md §5; whole page loaded in jsdom (React/ReactDOM/Babel from npm, other CDN scripts blocked); Share → Use round trip between lldf, Moving Load Generator, psbeam, stgirder and index with one shared localStorage; `git diff` shows only additions apart from the one header line that received the link.
- **Other copies:** BridgeXfer v1 and the `BXProject` glue are also in index.html, lldf.html, psbeam.html, stgirder.html and Moving Load Generator.html (this PR).

### S2. "← All tools" link in the header   [feature (no result change)]
- **Where:** `<header class="hdr">`, right-hand button group (≈ line 69). Anchor text: `<span id="status" class="st"></span>`
- **Problem:** none (feature). Approved step 1 of the cross-tool work: "← All tools" link and shared project info (HANDOFF.md §4.1).
- **Governing provision:** n/a (no calculation, factor, unit or code reference touched).
- **Before:**
  ```html
    <div><h1>BridgeLoad Pro — Continuous</h1><small>Moving live load · line girder · 1–4 spans</small></div>
    <div><span id="status" class="st"></span><button class="hb" id="runBtn">Run</button><button class="hb pri" id="csvBtn">Export CSV</button></div>
  </header>
  ```
- **After:**
  ```html
    <div><h1>BridgeLoad Pro — Continuous</h1><small>Moving live load · line girder · 1–4 spans</small></div>
    <div><span id="status" class="st"></span><a class="hb bx-alltools" href="tools.html" target="_top" title="Open the list of all tools" style="text-decoration:none">&larr; All tools</a><button class="hb" id="runBtn">Run</button><button class="hb pri" id="csvBtn">Export CSV</button></div>
  </header>
  ```
- **Check case:** n/a, no computed value changes. Functional check: see How verified.
- **How verified:** `node --check` on every plain inline script and @babel/standalone transpile of the text/babel block; BridgeXfer copy compared byte-for-byte with HANDOFF.md §5; whole page loaded in jsdom (React/ReactDOM/Babel from npm, other CDN scripts blocked); Share → Use round trip between lldf, Moving Load Generator, psbeam, stgirder and index with one shared localStorage; `git diff` shows only additions apart from the one header line that received the link.
- **Other copies:** BridgeXfer v1 and the `BXProject` glue are also in index.html, lldf.html, psbeam.html, stgirder.html and Moving Load Generator.html (this PR).

### S3. "Use shared project info" / "Share project info" buttons   [feature (no result change)]
- **Where:** Print Report modal, under Project / Computed by (≈ line 1028). Anchor text: `<input id="rProj">`
- **Problem:** none (feature). Approved step 1 of the cross-tool work: "← All tools" link and shared project info (HANDOFF.md §4.1).
- **Governing provision:** n/a (no calculation, factor, unit or code reference touched).
- **Before:**
  ```html
    <div class="g2"><div class="f"><label>Project</label><input id="rProj"></div><div class="f"><label>Computed by</label><input id="rBy"></div></div>
    <div class="lbl">Vehicles</div><div id="rVeh" class="rveh"></div>
  ```
- **After:**
  ```html
    <div class="g2"><div class="f"><label>Project</label><input id="rProj"></div><div class="f"><label>Computed by</label><input id="rBy"></div></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" id="bxProjUse" type="button" title="Fill Project and Computed by from the project info shared by another tool (asks first; never blanks a field)">Use shared project info</button><button class="btn" id="bxProjShare" type="button" title="Share Project and Computed by with the other tools">Share project info</button></div>
    <div class="lbl">Vehicles</div><div id="rVeh" class="rveh"></div>
  ```
- **Check case:** n/a, no computed value changes. Functional check: see How verified.
- **How verified:** `node --check` on every plain inline script and @babel/standalone transpile of the text/babel block; BridgeXfer copy compared byte-for-byte with HANDOFF.md §5; whole page loaded in jsdom (React/ReactDOM/Babel from npm, other CDN scripts blocked); Share → Use round trip between lldf, Moving Load Generator, psbeam, stgirder and index with one shared localStorage; `git diff` shows only additions apart from the one header line that received the link.
- **Other copies:** BridgeXfer v1 and the `BXProject` glue are also in index.html, lldf.html, psbeam.html, stgirder.html and Moving Load Generator.html (this PR).

### S4. BridgeXfer v1 + BXProject glue + field wiring   [feature (no result change)]
- **Where:** new `<script>` at the end of `<body>` (≈ line 1589). Anchor text: `initSelects(); renderSpans();`
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
  /* Shared project info: Print Report fields <-> HANDOFF.md §4.1 fields. */
  (function(){
    var MAP={projectName:'rProj',preparedBy:'rBy'};
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
